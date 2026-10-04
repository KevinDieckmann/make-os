// ─── Markttraktion · Stammdaten › Gesellschaften (Absender für Angebote, 28.09.) ─
// GET                                → { gesellschaften: [kdc, kdv, ug] mit stand, IBAN maskiert, luecken }
// PATCH  { id, felder, stand }       → Felder ändern (Stand/409; ungültige Werte 400 mit Feld)
// POST   multipart { id, datei }     → Logo (nur PNG/JPG, ≤ 15 MB) in die Dateiablage, verknüpft
// DELETE ?id=<gesellschaft>&logo=1   → Logo entfernen
// Speicher NUR `gesellschaften--<haushalt>` (verschlüsselt wie jeder Bestand) — nie im Code. Seit 04.10. ist er das
// Gesellschafts-Register (/os/unternehmen, /api/gesellschaften); hier nur die Absender der drei festen Gesellschaften.
// Zugang: Haushalt des Inhabers UND benannte Person mit Haushalt (wie die Dateiablage).

import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { loadJson } from '@/lib/store/local-db';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { registerAendern, standVon as registerStand } from '@/lib/gesellschaften/server';
import type { RegisterGesellschaft } from '@/lib/gesellschaften/modell';
import { ablegen, entfernen, AblageFehler } from '@/lib/dateien/ablage';
import { MAX_DATEI_BYTES, dateinameSaeubern, endung, typErkennen } from '@/lib/dateien/regeln';
import { alleGesellschaften, gesellschaftAnwenden, gesellschaftenName, gesellschaftFuerAnzeige, gesellschaftLuecken, istGesellschaftId, type Gesellschaft, type GesellschaftenDatei, type GesellschaftFehler } from '@/lib/crm/gesellschaften';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Gesellschaften gehören zum Haushalt des Inhabers — für dieses Konto nicht freigegeben.' };
const fehler = (text: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler: text, ...extra }, { status });
/**
 * Für den Browser: nur die Absender-Felder (IBAN maskiert) — Cap-Table, Verträge und Notizen des Registers bleiben in
 * /api/gesellschaften (sensibel, 04.10.). Der Stand ist der Fingerabdruck des GANZEN Eintrags (eine Schreibstelle).
 */
function zurAnzeige(g: Gesellschaft) {
  const { gesellschafter: _gs, beteiligungen: _bt, vertraege: _vt, notizen: _nz, ...absender } = g as Gesellschaft & Partial<Pick<RegisterGesellschaft, 'gesellschafter' | 'beteiligungen' | 'vertraege' | 'notizen'>>;
  return { ...gesellschaftFuerAnzeige(absender as Gesellschaft), stand: registerStand(g as unknown as RegisterGesellschaft), luecken: gesellschaftLuecken(g) };
}

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

/**
 * Eine Gesellschaft ändern — in EINER Sperre, mit Stand. Seit 04.10. über die gemeinsame Schreibstelle des Registers
 * (lib/gesellschaften/server.ts): derselbe Speicher, derselbe Stand, dasselbe Protokoll wie /os/unternehmen.
 */
async function aendern(haushalt: string, person: string, id: Gesellschaft['id'], felder: Record<string, unknown>, stand: unknown, wer: ReturnType<typeof werAus>) {
  const r = await registerAendern(haushalt, person, id, stand, wer, alt => {
    const x = gesellschaftAnwenden(alt as unknown as Gesellschaft, felder, new Date().toISOString(), person);
    return x.fehler.length ? { fehler: x.fehler } : { g: x.g as unknown as RegisterGesellschaft };
  });
  return { g: r.g as unknown as Gesellschaft | undefined, konflikt: r.konflikt as unknown as Gesellschaft | undefined, fehler: r.fehler as GesellschaftFehler[] | undefined };
}

export async function PATCH(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const alterBau = bauPruefen(req); // alter Tab nach dem Hochladen (29.09., A2)
  if (alterBau) return alterBau;
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
  const alterBau = bauPruefen(req); // alter Tab nach dem Hochladen (29.09., A2)
  if (alterBau) return alterBau;
  const art = req.headers.get('content-type') ?? '';
  if (!art.startsWith('multipart/form-data')) return fehler('Logo als multipart/form-data (id, datei, stand).', 415);
  const laenge = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(laenge) && laenge > MAX_DATEI_BYTES + 64 * 1024) return fehler('Datei zu groß (höchstens 15 MB).', 413);
  let form: FormData;
  try { form = await req.formData(); } catch { return fehler('Upload nicht lesbar.', 400); }
  const id = String(form.get('id') ?? '');
  if (!istGesellschaftId(id)) return fehler('id: kdc, kdv oder ug.', 400);
  // Ohne Stand kein Logo (29.09.): vorher galt dann der aktuelle Stand — ein altes Fenster überschrieb unbemerkt.
  const stand = form.get('stand');
  if (typeof stand !== 'string' || !stand) return fehler('Stand fehlt — bitte die Seite neu laden und noch einmal.', 409);
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
    const r = await aendern(z.haushalt, z.person, id, { logoDateiId: eintrag.id }, stand, werAus(req));
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
  const alterBau = bauPruefen(req); // alter Tab nach dem Hochladen (29.09., A2)
  if (alterBau) return alterBau;
  const q = new URL(req.url).searchParams;
  const id = q.get('id') ?? '';
  if (!istGesellschaftId(id) || q.get('logo') !== '1') return fehler('?id=<kdc|kdv|ug>&logo=1&stand=…', 400);
  const stand = q.get('stand');
  if (!stand) return fehler('Stand fehlt — bitte die Seite neu laden und noch einmal.', 409);
  const alt = alleGesellschaften(await loadJson<GesellschaftenDatei>(gesellschaftenName(z.haushalt))).find(g => g.id === id)!;
  if (!alt.logoDateiId) return NextResponse.json({ ok: true, gesellschaft: zurAnzeige(alt) });
  const r = await aendern(z.haushalt, z.person, id, { logoDateiId: null }, stand, werAus(req));
  if (!r.g) return fehler('Wurde inzwischen geändert — neu geladen, bitte noch einmal.', 409, r.konflikt ? { aktuell: zurAnzeige(r.konflikt) } : {});
  await entfernen(z.haushalt, alt.logoDateiId).catch(() => {});
  return NextResponse.json({ ok: true, gesellschaft: zurAnzeige(r.g) });
}
