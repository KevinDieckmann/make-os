// ─── Aufgaben · Dateien an Projekten und Aufgaben (28.09., Paket C2) ─────────
// GET    ?projektId=…            → Einträge des Projekts und seiner Aufgaben (nur Metadaten, ETag/304)
// GET    ?aufgabeId=…            → Einträge der Aufgabe
// GET    ?projektId=…&listeId=…  → Einträge an einer Liste (30.09., Dateien am Meilenstein)
// GET    ?id=d-…                 → Datei herunterladen (attachment, nosniff, CSP-Sandbox)
// POST   multipart: `datei` (PDF, PNG, JPG, WEBP, HEIC, DOCX, XLSX, PPTX, CSV, TXT, MD; ≤ 25 MB) + `meta` (JSON
//        { projektId, aufgabeId?, bereich, notiz? })                         → Eintrag
// PATCH  JSON { id, felder: { name?, notiz? } }                           → umbenennen / Beschreibung
// DELETE ?id=d-…                 → Eintrag + Datei weg (Änderungsprotokoll + Verlauf der Aufgabe/des Projekts)
//
// Zugang wie die CRM-Ablage: nur der Haushalt des Inhabers (Default-Deny) UND die anfragende Person muss
// ausdrücklich benannt sein und einen Haushalt am Konto tragen (`personStreng`); Dienstweg nur mit Person im
// Haushalt. Seit 09.10. (E4, EINE Konto-Sicht): ein Konto „nur Business“ sieht und schreibt die Dateien des Business-Bereichs
// (`aufgabenDateienZugang`, `aufgabenDateiSichtbar`) — Privat gibt es für es nicht (404). Die Dateien liegen verschlüsselt je Haushalt (lib/dateien/aufgaben-ablage.ts) in einem EIGENEN Bestand
// — getrennt von der CRM-Ablage, die ZOE nie liest. Diese hier liest ZOE (gekapselt, lib/zoe/aufgaben-unterlagen.ts).

import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { createHash } from 'crypto';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { AblageFehler } from '@/lib/dateien/ablage';
import { aufgabenDateienListe, aufgabenDateiAblegen, aufgabenDateiAendern, aufgabenDateiEntfernen, aufgabenDateiLesen, aufgabenDateienZugang, aufgabenDateiSichtbar } from '@/lib/dateien/aufgaben-ablage';
import { DATEI_ID, dateinameAscii, dateinameSaeubern, endung } from '@/lib/dateien/regeln';
import { AUFGABEN_KENNUNG, MAX_AUFGABEN_DATEI_BYTES, aufgabenDateienFuer, aufgabenTypErkennen } from '@/lib/dateien/aufgaben-regeln';
import { begrenztLesen } from '@/lib/dateien/begrenzt-lesen';
import { verborgeneAufgabenFuer } from '@/lib/aufgaben/sicht';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Kein Zugang zu den Projekt-Dateien — sie gehören zum Haushalt des Inhabers.' };
/** Umschlag für multipart (Grenzen, Feldnamen, meta) — großzügig, aber begrenzt. */
const UMSCHLAG = 64 * 1024;
const fehler = (text: string, status: number) => NextResponse.json({ ok: false, fehler: text }, { status });
const ZU_GROSS = () => fehler(`Datei zu groß (höchstens ${MAX_AUFGABEN_DATEI_BYTES / 1024 / 1024} MB).`, 413);
const FALSCHER_TYP = () => fehler('Nur PDF, Bilder (PNG, JPG, WEBP, HEIC), Word, Excel, PowerPoint, CSV, TXT oder Markdown — und der Inhalt muss zur Endung passen.', 415);

type Zugang = { person: string; haushalt: string; nurBusiness: boolean };
async function zugang(req: Request): Promise<Zugang | null> {
  if (!(await imHaushaltDesInhabers(req))) return null;
  return aufgabenDateienZugang(personStreng(req));
}

/**
 * Sicht-Prüfung 08.10.: Dateien an einer fremden „nur ich“-Aufgabe gibt es für diese Person nicht — weder in der Liste noch
 * zum Herunterladen, Umbenennen, Löschen oder als Ziel eines Uploads (404, wie die Aufgabe selbst). Seit 09.10. (E4) ebenso alles
 * im Privat-Bereich für ein Konto „nur Business“ (`verborgeneAufgabenFuer` kennt die Privat-Aufgaben, der Eintrag seinen Bereich).
 */
async function anVerborgener(person: string, aufgabeId: string | undefined): Promise<boolean> {
  return !!aufgabeId && (await verborgeneAufgabenFuer(person)).has(aufgabeId);
}
async function dateiVerborgen(z: Zugang, id: string): Promise<boolean> {
  const e = (await aufgabenDateienListe(z.haushalt)).find(x => x.id === id);
  return !!e && !aufgabenDateiSichtbar(e, z, await verborgeneAufgabenFuer(z.person));
}

function ausFehler(e: unknown) {
  if (e instanceof AblageFehler) return fehler(e.message, e.status);
  console.error('[aufgaben/dateien]', (e as Error)?.message);
  return fehler('Ablage nicht erreichbar.', 500);
}

export async function GET(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const q = new URL(req.url).searchParams;
  try {
    const id = q.get('id');
    if (id !== null) {
      if (!DATEI_ID.test(id)) return fehler('Unzulässige Kennung.', 400);
      const d = await aufgabenDateiLesen(z.haushalt, id);
      if (!d || !aufgabenDateiSichtbar(d.eintrag, z, await verborgeneAufgabenFuer(z.person))) return fehler('Nicht gefunden.', 404);
      const name = d.eintrag.datei.name;
      return new Response(new Uint8Array(d.bytes), {
        headers: {
          'Content-Type': d.eintrag.datei.typ,
          'Content-Length': String(d.bytes.length),
          'Content-Disposition': `attachment; filename="${dateinameAscii(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'Cache-Control': 'no-store, private',
        },
      });
    }
    const projektId = q.get('projektId') ?? undefined, aufgabeId = q.get('aufgabeId') ?? undefined, listeId = q.get('listeId') ?? undefined;
    if ((projektId && !AUFGABEN_KENNUNG.test(projektId)) || (aufgabeId && !AUFGABEN_KENNUNG.test(aufgabeId)) || (listeId && !AUFGABEN_KENNUNG.test(listeId))) return fehler('Unzulässige Kennung.', 400);
    if (!projektId && !aufgabeId) return fehler('projektId oder aufgabeId fehlt.', 400);
    const verborgen = await verborgeneAufgabenFuer(z.person);
    const eintraege = aufgabenDateienFuer(await aufgabenDateienListe(z.haushalt), { projektId, aufgabeId, listeId }).filter(e => aufgabenDateiSichtbar(e, z, verborgen));
    const etag = `"${createHash('sha256').update(JSON.stringify(eintraege)).digest('base64url').slice(0, 27)}"`;
    const kopf = { 'Cache-Control': 'no-store, private', ETag: etag };
    if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: kopf });
    return NextResponse.json({ ok: true, eintraege, anzahl: eintraege.length }, { headers: kopf });
  } catch (e) { return ausFehler(e); }
}

export async function POST(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const alterBau = bauPruefen(req); // alter Tab nach dem Hochladen (29.09., A2)
  if (alterBau) return alterBau;
  const art = req.headers.get('content-type') ?? '';
  if (!art.startsWith('multipart/form-data')) return FALSCHER_TYP();
  try {
    const roh = await begrenztLesen(req, MAX_AUFGABEN_DATEI_BYTES + UMSCHLAG);
    if (!roh) return ZU_GROSS();
    let form: FormData;
    try { form = await new Response(new Uint8Array(roh), { headers: { 'content-type': art } }).formData(); } catch { return fehler('Upload nicht lesbar.', 400); }
    const datei = form.get('datei');
    if (!datei || typeof datei === 'string') return fehler('Datei fehlt.', 400);
    if (datei.size > MAX_AUFGABEN_DATEI_BYTES) return ZU_GROSS();
    if (!datei.size) return fehler('Die Datei ist leer.', 400);
    const name = dateinameSaeubern(datei.name, endung(datei.name) || 'txt');
    const bytes = Buffer.from(await datei.arrayBuffer());
    const typ = aufgabenTypErkennen(name, bytes);
    if (!typ) return FALSCHER_TYP();
    let meta: unknown = {};
    try { meta = JSON.parse(String(form.get('meta') ?? '{}')); } catch { return fehler('meta ist kein gültiges JSON.', 400); }
    const zielAufgabe = (meta as { aufgabeId?: unknown } | null)?.aufgabeId;
    if (typeof zielAufgabe === 'string' && await anVerborgener(z.person, zielAufgabe)) return fehler('Aufgabe nicht gefunden.', 404);
    const e = await aufgabenDateiAblegen(z.haushalt, z.person, meta, { bytes, name, typ });
    return NextResponse.json({ ok: true, eintrag: e });
  } catch (e) { return ausFehler(e); }
}

export async function PATCH(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const alterBau = bauPruefen(req); // alter Tab nach dem Hochladen (29.09., A2)
  if (alterBau) return alterBau;
  let b: { id?: unknown; felder?: unknown };
  try { b = JSON.parse((await begrenztLesen(req, UMSCHLAG))?.toString('utf8') ?? 'null') ?? {}; } catch { return fehler('Kein gültiges JSON.', 400); }
  const id = String(b.id ?? '');
  if (!DATEI_ID.test(id)) return fehler('Unzulässige Kennung.', 400);
  try {
    if (await dateiVerborgen(z, id)) return fehler('Nicht gefunden.', 404);
    const e = await aufgabenDateiAendern(z.haushalt, z.person, id, b.felder);
    return e ? NextResponse.json({ ok: true, eintrag: e }) : fehler('Nicht gefunden.', 404);
  } catch (e) { return ausFehler(e); }
}

export async function DELETE(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const alterBau = bauPruefen(req); // alter Tab nach dem Hochladen (29.09., A2)
  if (alterBau) return alterBau;
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!DATEI_ID.test(id)) return fehler('Unzulässige Kennung.', 400);
  try {
    if (await dateiVerborgen(z, id)) return fehler('Nicht gefunden.', 404);
    return (await aufgabenDateiEntfernen(z.haushalt, z.person, id)) ? NextResponse.json({ ok: true }) : fehler('Nicht gefunden.', 404);
  } catch (e) { return ausFehler(e); }
}
