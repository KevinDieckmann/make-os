// ─── Markttraktion · Dateiablage (Verträge, Angebote, Rechnungen) — 28.09. ───
// GET    ?kontakt=&firma=&mandat=a,b&deal=c,d&rechnung=r1  → Einträge (nur Metadaten)
// GET    ?id=d-…                                          → Datei herunterladen (attachment)
// POST   multipart: `datei` (PDF/PNG/JPG/DOCX, ≤ 15 MB) + `meta` (JSON)  → Eintrag
// POST   JSON { meta }                                    → Angebot ohne Datei
// PATCH  JSON { id, felder }                              → Metadaten ändern
// DELETE ?id=d-…                                          → Eintrag + Datei weg
//
// Zugang: nur der Haushalt des Inhabers (Default-Deny) — UND die anfragende
// Person muss ausdrücklich benannt sein und einen Haushalt am Konto tragen; die
// Dateien liegen je Haushalt (lib/dateien/ablage.ts, verschlüsselt). Ein
// Dienstaufruf ohne Person bekommt 403, mit Person sieht er nur deren Haushalt.
// Kein ZOE-Werkzeug, kein Agent liest hier. Dateien an Projekten/Aufgaben: app/api/aufgaben/dateien (eigener Bestand).
// Rolle „nur Business“ (13.10., Kevin: „Nur lesen + Entwürfe“; Regel lib/crm/nur-business.ts `dateiFuerNurBusiness`): liest Liste und
// Download nur an Business-Bezügen (Kontakt/Firma, Angebot/Mandat/Deal einer Business-Gesellschaft) — nie Firmen-Akte (Gesellschafts-
// Unterlagen), nie Rechnungen; das Logo eines Business-Absenders per Kennung (Angebots-Vorschau). Hochladen nur an Business-Bezügen;
// ändern und löschen → 403. Fremdes gibt es für sie nicht (404 wie „nicht gefunden“).

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { businessHaushaltVon } from '@/lib/zugang/konto-sicht-server';
import { loadJson } from '@/lib/store/local-db';
import { ladeCrm } from '@/lib/crm/speicher';
import { alleGesellschaften, gesellschaftenName, type GesellschaftenDatei } from '@/lib/crm/gesellschaften';
import { dateiFuerNurBusiness, logoFuerNurBusiness, NUR_BUSINESS_SICHT, NUR_LESEN } from '@/lib/crm/nur-business';
import { ablageListe, ablegen, aendern, entfernen, lesen, AblageFehler } from '@/lib/dateien/ablage';
import { DATEI_ID, MAX_DATEI_BYTES, dateinameAscii, dateinameSaeubern, eintraegeFuer, endung, metaSaeubern, nurCrm, typErkennen } from '@/lib/dateien/regeln';
import { begrenztLesen } from '@/lib/dateien/begrenzt-lesen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Kein Zugang zur Dateiablage — sie gehört zum Haushalt des Inhabers.' };
/** Umschlag für multipart (Grenzen, Feldnamen) — großzügig, aber begrenzt. */
const UMSCHLAG = 64 * 1024;
const fehler = (text: string, status: number) => NextResponse.json({ ok: false, fehler: text }, { status });
const ZU_GROSS = () => fehler(`Datei zu groß (höchstens ${MAX_DATEI_BYTES / 1024 / 1024} MB).`, 413);
const FALSCHER_TYP = () => fehler('Nur PDF, PNG, JPG oder DOCX — und der Inhalt muss zur Endung passen.', 415);

async function zugang(req: Request): Promise<{ person: string; haushalt: string; nurBusiness: boolean } | null> {
  const w = await imHaushaltDesInhabers(req);
  if (!w) return null;
  return businessHaushaltVon(req);
}

/** Rolle „nur Business“: welche Einträge sie sieht (EINE Regel, lib/crm/nur-business.ts) — das CRM wird nur für sie geladen. */
async function nurBusinessFilter(): Promise<(e: Parameters<typeof dateiFuerNurBusiness>[0]) => boolean> {
  const crm = await ladeCrm();
  return e => dateiFuerNurBusiness(e, crm);
}

function ausFehler(e: unknown) {
  if (e instanceof AblageFehler) return fehler(e.message, e.status);
  console.error('[crm/dateien]', (e as Error)?.message);
  return fehler('Ablage nicht erreichbar.', 500);
}

const idListe = (v: string | null) => (v ?? '').split(',').map(s => s.trim()).filter(s => /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(s)).slice(0, 100);

export async function GET(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const q = new URL(req.url).searchParams;
  try {
    const id = q.get('id');
    if (id !== null) {
      if (!DATEI_ID.test(id)) return fehler('Unzulässige Kennung.', 400);
      const d = await lesen(z.haushalt, id);
      if (!d) return fehler('Nicht gefunden.', 404);
      if (z.nurBusiness && !(await (await nurBusinessFilter())(d.eintrag))
        && !(d.eintrag.gesellschaft && logoFuerNurBusiness(id, alleGesellschaften(await loadJson<GesellschaftenDatei>(gesellschaftenName(z.haushalt)))))) return fehler('Nicht gefunden.', 404);
      const name = d.eintrag.datei!.name;
      return new Response(new Uint8Array(d.bytes), {
        headers: {
          'Content-Type': d.eintrag.datei!.typ,
          'Content-Length': String(d.bytes.length),
          'Content-Disposition': `attachment; filename="${dateinameAscii(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'Cache-Control': 'no-store, private',
        },
      });
    }
    // Schutz in der Tiefe (28.09., C2): Aufgaben-Dateien liegen in einem eigenen Bestand — stünde je einer hier, bliebe er draußen.
    const roh = nurCrm(await ablageListe(z.haushalt));
    const alle = z.nurBusiness ? roh.filter(await nurBusinessFilter()) : roh;
    const filter = { kontaktId: q.get('kontakt') ?? undefined, firmaId: q.get('firma') ?? undefined, mandatIds: idListe(q.get('mandat')), dealIds: idListe(q.get('deal')), rechnungIds: idListe(q.get('rechnung')) };
    const gefiltert = filter.kontaktId || filter.firmaId || filter.mandatIds.length || filter.dealIds.length || filter.rechnungIds.length;
    // Nie abschneiden (28.09.): vorher nur die letzten 500 von bis zu 2.000 — jetzt alle (neueste zuerst), mit Anzahl.
    const eintraege = gefiltert ? eintraegeFuer(alle, filter) : [...alle].reverse();
    return NextResponse.json({ ok: true, eintraege, anzahl: eintraege.length }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return ausFehler(e); }
}

export async function POST(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const art = req.headers.get('content-type') ?? '';
  try {
    if (art.startsWith('application/json')) {
      let b: { meta?: unknown };
      try { b = JSON.parse((await begrenztLesen(req, UMSCHLAG))?.toString('utf8') ?? 'null') ?? {}; } catch { return fehler('Kein gültiges JSON.', 400); }
      if (z.nurBusiness && !(await (await nurBusinessFilter())(metaSaeubern(b.meta)))) return fehler(NUR_BUSINESS_SICHT, 403);
      const e = await ablegen(z.haushalt, z.person, b.meta, null);
      return NextResponse.json({ ok: true, eintrag: e });
    }
    if (!art.startsWith('multipart/form-data')) return FALSCHER_TYP();
    const roh = await begrenztLesen(req, MAX_DATEI_BYTES + UMSCHLAG);
    if (!roh) return ZU_GROSS();
    let form: FormData;
    try { form = await new Response(new Uint8Array(roh), { headers: { 'content-type': art } }).formData(); } catch { return fehler('Upload nicht lesbar.', 400); }
    const datei = form.get('datei');
    if (!datei || typeof datei === 'string') return fehler('Datei fehlt.', 400);
    if (datei.size > MAX_DATEI_BYTES) return ZU_GROSS();
    if (!datei.size) return fehler('Die Datei ist leer.', 400);
    const name = dateinameSaeubern(datei.name, endung(datei.name) || 'pdf');
    const bytes = Buffer.from(await datei.arrayBuffer());
    const typ = typErkennen(name, bytes.subarray(0, 16));
    if (!typ) return FALSCHER_TYP();
    let meta: unknown = {};
    try { meta = JSON.parse(String(form.get('meta') ?? '{}')); } catch { return fehler('meta ist kein gültiges JSON.', 400); }
    // Rolle „nur Business“: hochladen nur an Business-Bezügen (vor dem Schreiben).
    if (z.nurBusiness && !(await (await nurBusinessFilter())(metaSaeubern(meta)))) return fehler(NUR_BUSINESS_SICHT, 403);
    const e = await ablegen(z.haushalt, z.person, meta, { bytes, name, typ });
    return NextResponse.json({ ok: true, eintrag: e });
  } catch (e) { return ausFehler(e); }
}

export async function PATCH(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  if (z.nurBusiness) return fehler(NUR_LESEN, 403);
  let b: { id?: unknown; felder?: unknown };
  try { b = JSON.parse((await begrenztLesen(req, UMSCHLAG))?.toString('utf8') ?? 'null') ?? {}; } catch { return fehler('Kein gültiges JSON.', 400); }
  const id = String(b.id ?? '');
  if (!DATEI_ID.test(id)) return fehler('Unzulässige Kennung.', 400);
  try {
    const e = await aendern(z.haushalt, z.person, id, b.felder);
    return e ? NextResponse.json({ ok: true, eintrag: e }) : fehler('Nicht gefunden.', 404);
  } catch (e) { return ausFehler(e); }
}

export async function DELETE(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  if (z.nurBusiness) return fehler(NUR_LESEN, 403);
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!DATEI_ID.test(id)) return fehler('Unzulässige Kennung.', 400);
  try {
    // Beleg einer Einwilligung (28.09., W10): `entfernen` lehnt mit 409 und Grund ab (lib/dateien/ablage.ts).
    return (await entfernen(z.haushalt, id)) ? NextResponse.json({ ok: true }) : fehler('Nicht gefunden.', 404);
  } catch (e) { return ausFehler(e); }
}
