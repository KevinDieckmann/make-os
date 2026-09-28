// ─── Markttraktion · Stammdaten › Gesellschaften (Absender für Angebote, 28.09.) ─
// GET                                → { gesellschaften: [kdc, kdv, ug] mit stand, IBAN maskiert, luecken }
// PATCH  { id, felder, stand }       → Felder ändern (Stand/409; ungültige Werte 400 mit Feld)
// POST   multipart { id, datei }     → Logo (nur PNG/JPG, ≤ 15 MB) in die Dateiablage, verknüpft
// DELETE ?id=<gesellschaft>&logo=1   → Logo entfernen
// Speicher NUR `gesellschaften--<haushalt>` (verschlüsselt wie jeder Bestand) — nie im Code.
// Zugang: Haushalt des Inhabers UND benannte Person mit Haushalt (wie die Dateiablage).

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { protokolliereBestand, werAus } from '@/lib/store/aenderungsprotokoll';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { ablegen, entfernen, AblageFehler } from '@/lib/dateien/ablage';
import { MAX_DATEI_BYTES, dateinameSaeubern, endung, typErkennen } from '@/lib/dateien/regeln';
import { alleGesellschaften, gesellschaftAnwenden, gesellschaftenName, gesellschaftFuerAnzeige, gesellschaftLuecken, istGesellschaftId, leereGesellschaft, type Gesellschaft, type GesellschaftenDatei, type GesellschaftFehler } from '@/lib/crm/gesellschaften';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Gesellschaften gehören zum Haushalt des Inhabers — für dieses Konto nicht freigegeben.' };
const fehler = (text: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler: text, ...extra }, { status });
const standVon = (g: Gesellschaft) => fingerabdruck(g as unknown as Record<string, unknown>);
const zurAnzeige = (g: Gesellschaft) => ({ ...gesellschaftFuerAnzeige(g), stand: standVon(g), luecken: gesellschaftLuecken(g) });

async function zugang(req: Request): Promise<{ person: string; haushalt: string } | null> {
  if (!(await imHaushaltDesInhabers(req))) return null;
  const h = await haushaltVon(req);
  return h ? { person: h.person, haushalt: h.haushalt } : null;
}

async function liste(haushalt: string) {
  return alleGesellschaften(await loadJson<GesellschaftenDatei>(gesellschaftenName(haushalt))).map(zurAnzeige);
}

export async function GET(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  return NextResponse.json({ ok: true, gesellschaften: await liste(z.haushalt) }, { headers: { 'Cache-Control': 'no-store' } });
}

/** Eine Gesellschaft ändern — in EINER Sperre, mit Stand. */
async function aendern(haushalt: string, person: string, id: Gesellschaft['id'], felder: Record<string, unknown>, stand: unknown, wer: ReturnType<typeof werAus>) {
  let vorher: GesellschaftenDatei | null = null;
  let ergebnis: { g?: Gesellschaft; konflikt?: Gesellschaft; fehler?: GesellschaftFehler[] } = {};
  const nachher = await updateJson<GesellschaftenDatei>(gesellschaftenName(haushalt), cur => {
    vorher = cur;
    const l = cur?.gesellschaften ?? [];
    const alt = l.find(g => g.id === id) ?? leereGesellschaft(id);
    if (typeof stand !== 'string' || standVon(alt) !== stand) { ergebnis = { konflikt: alt }; return cur ?? { gesellschaften: [] }; }
    const r = gesellschaftAnwenden(alt, felder, new Date().toISOString(), person);
    if (r.fehler.length) { ergebnis = { fehler: r.fehler }; return cur ?? { gesellschaften: [] }; }
    ergebnis = { g: r.g };
    return { gesellschaften: [...l.filter(g => g.id !== id), r.g] };
  });
  if (ergebnis.g) await protokolliereBestand(gesellschaftenName(haushalt), vorher, nachher, wer);
  return ergebnis;
}

export async function PATCH(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  let b: { id?: unknown; felder?: unknown; stand?: unknown };
  try { b = await req.json(); } catch { return fehler('Kein JSON.', 400); }
  if (!istGesellschaftId(b.id)) return fehler('id: kdc, kdv oder ug.', 400);
  if (!b.felder || typeof b.felder !== 'object' || Array.isArray(b.felder)) return fehler('felder fehlen.', 400);
  // Das Logo hängt nur über den Upload (POST) — nie per Kennung aus dem Browser.
  const { logoDateiId: _l, ...felder } = b.felder as Record<string, unknown>;
  const r = await aendern(z.haushalt, z.person, b.id, felder, b.stand, werAus(req));
  if (r.konflikt) return fehler('Wurde inzwischen geändert — neu geladen, bitte noch einmal.', 409, { aktuell: zurAnzeige(r.konflikt) });
  if (r.fehler) return fehler(r.fehler.map(f => f.text).join(' · '), 400, { felder: r.fehler });
  return NextResponse.json({ ok: true, gesellschaft: zurAnzeige(r.g!) });
}

export async function POST(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const art = req.headers.get('content-type') ?? '';
  if (!art.startsWith('multipart/form-data')) return fehler('Logo als multipart/form-data (id, datei, stand).', 415);
  const laenge = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(laenge) && laenge > MAX_DATEI_BYTES + 64 * 1024) return fehler('Datei zu groß (höchstens 15 MB).', 413);
  let form: FormData;
  try { form = await req.formData(); } catch { return fehler('Upload nicht lesbar.', 400); }
  const id = String(form.get('id') ?? '');
  if (!istGesellschaftId(id)) return fehler('id: kdc, kdv oder ug.', 400);
  const datei = form.get('datei');
  if (!datei || typeof datei === 'string' || !datei.size) return fehler('Datei fehlt.', 400);
  if (datei.size > MAX_DATEI_BYTES) return fehler('Datei zu groß (höchstens 15 MB).', 413);
  const name = dateinameSaeubern(datei.name, endung(datei.name) || 'png');
  const bytes = Buffer.from(await datei.arrayBuffer());
  const typ = typErkennen(name, bytes.subarray(0, 16));
  if (typ !== 'image/png' && typ !== 'image/jpeg') return fehler('Logo nur als PNG oder JPG — und der Inhalt muss zur Endung passen.', 415);
  try {
    const eintrag = await ablegen(z.haushalt, z.person, { art: 'sonstig', titel: `Logo ${id.toUpperCase()}` }, { bytes, name, typ }, new Date().toISOString(), { gesellschaft: id });
    const alt = alleGesellschaften(await loadJson<GesellschaftenDatei>(gesellschaftenName(z.haushalt))).find(g => g.id === id)!;
    const r = await aendern(z.haushalt, z.person, id, { logoDateiId: eintrag.id }, form.get('stand') ?? standVon(alt), werAus(req));
    if (!r.g) { await entfernen(z.haushalt, eintrag.id).catch(() => {}); return r.konflikt ? fehler('Wurde inzwischen geändert — neu geladen, bitte noch einmal.', 409, { aktuell: zurAnzeige(r.konflikt) }) : fehler('Logo nicht gespeichert.', 400); }
    if (alt.logoDateiId && alt.logoDateiId !== eintrag.id) await entfernen(z.haushalt, alt.logoDateiId).catch(() => {});
    return NextResponse.json({ ok: true, gesellschaft: zurAnzeige(r.g) });
  } catch (e) {
    if (e instanceof AblageFehler) return fehler(e.message, e.status);
    console.error('[crm/gesellschaften]', (e as Error)?.message);
    return fehler('Logo nicht gespeichert.', 500);
  }
}

export async function DELETE(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const q = new URL(req.url).searchParams;
  const id = q.get('id') ?? '';
  if (!istGesellschaftId(id) || q.get('logo') !== '1') return fehler('?id=<kdc|kdv|ug>&logo=1', 400);
  const alt = alleGesellschaften(await loadJson<GesellschaftenDatei>(gesellschaftenName(z.haushalt))).find(g => g.id === id)!;
  if (!alt.logoDateiId) return NextResponse.json({ ok: true, gesellschaft: zurAnzeige(alt) });
  const r = await aendern(z.haushalt, z.person, id, { logoDateiId: null }, q.get('stand') ?? standVon(alt), werAus(req));
  if (!r.g) return fehler('Wurde inzwischen geändert — neu geladen, bitte noch einmal.', 409, r.konflikt ? { aktuell: zurAnzeige(r.konflikt) } : {});
  await entfernen(z.haushalt, alt.logoDateiId).catch(() => {});
  return NextResponse.json({ ok: true, gesellschaft: zurAnzeige(r.g) });
}
