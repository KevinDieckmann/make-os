// ─── MAKE OS — Register › Unterlagen einer Gesellschaft (04.10.) ────────────────────────────────────────────────
// GET  ?id=<gesellschaft>                       → Einträge der Dateiablage mit Bezug auf diese Gesellschaft (neueste zuerst)
// POST multipart { id, datei, titel?, art? }    → Unterlage ablegen (PDF/PNG/JPG/DOCX, ≤ 15 MB, Typ am Inhalt geprüft)
// Herunterladen wie jede Ablage-Datei über GET /api/crm/dateien?id=d-… (dieselbe Ablage, derselbe Haushalt).
// Die bestehende Dateiablage (lib/dateien/ablage.ts, verschlüsselt je Haushalt) — kein zweiter Speicher. Den Bezug
// `gesellschaft` setzt nur der Server. Zugang wie /api/gesellschaften: nur der Haushalt des Inhabers (sonst 403).

import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { ablageListe, ablegen, AblageFehler } from '@/lib/dateien/ablage';
import { begrenztLesen } from '@/lib/dateien/begrenzt-lesen';
import { MAX_DATEI_BYTES, dateinameSaeubern, endung, nurCrm, typErkennen, type DateiArt } from '@/lib/dateien/regeln';
import { istGesellschaftId } from '@/lib/einheiten';
import { gesellschaftVon } from '@/lib/gesellschaften/modell';
import { ladeRegister } from '@/lib/gesellschaften/server';
import { imPapierkorb } from '@/lib/eintraege/sicher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Das Gesellschafts-Register gehört zum Haushalt des Inhabers — für dieses Konto nicht freigegeben.' };
const fehler = (text: string, status: number) => NextResponse.json({ ok: false, fehler: text }, { status });
const UMSCHLAG = 64 * 1024;

async function zugang(req: Request): Promise<{ person: string; haushalt: string } | null> {
  if (!(await imHaushaltDesInhabers(req))) return null;
  const h = await haushaltVon(req);
  return h ? { person: h.person, haushalt: h.haushalt } : null;
}

export async function GET(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!istGesellschaftId(id)) return fehler('id: kdc, kdv, ug oder g-….', 400);
  try {
    const eintraege = nurCrm(await ablageListe(z.haushalt)).filter(e => e.gesellschaft === id).sort((a, b) => b.hochgeladenAm.localeCompare(a.hochgeladenAm));
    return NextResponse.json({ ok: true, eintraege }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof AblageFehler) return fehler(e.message, e.status);
    return fehler('Ablage nicht erreichbar.', 500);
  }
}

export async function POST(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  const art = req.headers.get('content-type') ?? '';
  if (!art.startsWith('multipart/form-data')) return fehler('Unterlage als multipart/form-data (id, datei).', 415);
  const roh = await begrenztLesen(req, MAX_DATEI_BYTES + UMSCHLAG);
  if (!roh) return fehler('Datei zu groß (höchstens 15 MB).', 413);
  let form: FormData;
  try { form = await new Response(new Uint8Array(roh), { headers: { 'content-type': art } }).formData(); } catch { return fehler('Upload nicht lesbar.', 400); }
  const id = String(form.get('id') ?? '');
  if (!istGesellschaftId(id)) return fehler('id: kdc, kdv, ug oder g-….', 400);
  const g = gesellschaftVon(await ladeRegister(z.haushalt), id);
  if (!g || imPapierkorb(g)) return fehler('Gesellschaft nicht gefunden.', 404);
  const datei = form.get('datei');
  if (!datei || typeof datei === 'string') return fehler('Datei fehlt.', 400);
  if (!datei.size) return fehler('Die Datei ist leer.', 400);
  if (datei.size > MAX_DATEI_BYTES) return fehler('Datei zu groß (höchstens 15 MB).', 413);
  const name = dateinameSaeubern(datei.name, endung(datei.name) || 'pdf');
  const bytes = Buffer.from(await datei.arrayBuffer());
  const typ = typErkennen(name, bytes.subarray(0, 16));
  if (!typ) return fehler('Nur PDF, PNG, JPG oder DOCX — und der Inhalt muss zur Endung passen.', 415);
  const dateiArt: DateiArt = form.get('art') === 'vertrag' ? 'vertrag' : 'sonstig';
  const titel = String(form.get('titel') ?? '').slice(0, 160) || undefined;
  try {
    const e = await ablegen(z.haushalt, z.person, { art: dateiArt, ...(titel ? { titel } : {}) }, { bytes, name, typ }, new Date().toISOString(), { gesellschaft: id });
    return NextResponse.json({ ok: true, eintrag: e });
  } catch (e) {
    if (e instanceof AblageFehler) return fehler(e.message, e.status);
    console.error('[gesellschaften/unterlagen]', (e as Error)?.message);
    return fehler('Unterlage nicht gespeichert.', 500);
  }
}
