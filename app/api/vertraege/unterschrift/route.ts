// ─── Vertrieb › Verträge: unterschriebenes PDF hochladen (01.11.) ─────────────────────────────────────────────────────
// POST multipart { id, stand, am?, datei (PDF) } → Beleg in der Ablage (fester Bezug `vertragId`, nicht löschbar), Status „unterschrieben“,
// Mandat `vertragUnterschrieben`, Eintrag in `vertraege[]` der Gesellschaft im Register (Fristen → Kalender, Erinnerung).
// Zugang: Haushalt des Inhabers mit vollem Haushaltszugang, nur per Sitzung (Dienstweg 403). Höchstens 15 MB.

import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { istDienst } from '@/lib/zugang/dienst';
import { begrenztLesen } from '@/lib/dateien/begrenzt-lesen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { VertragFehler, mitStand, vertragUnterschrieben } from '@/lib/vertraege/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX = 15 * 1024 * 1024;
const fehler = (text: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler: text, ...extra }, { status });

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return fehler('Nur im Haushalt des Inhabers.', 403);
  if (istDienst(req)) return fehler('„Unterschrieben“ vermerkt nur eine Person per Klick — nie der Dienstweg.', 403);
  const h = await haushaltVon(req);
  if (!h) return fehler('Für dieses Konto nicht freigegeben.', 403);
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  const art = req.headers.get('content-type') ?? '';
  if (!art.startsWith('multipart/form-data')) return fehler('Als multipart/form-data (id, stand, datei).', 415);
  const roh = await begrenztLesen(req, MAX + 64 * 1024);
  if (!roh) return fehler('Datei zu groß (höchstens 15 MB).', 413);
  let form: FormData;
  try { form = await new Response(new Uint8Array(roh), { headers: { 'content-type': art } }).formData(); } catch { return fehler('Upload nicht lesbar.', 400); }
  const datei = form.get('datei');
  if (!datei || typeof datei === 'string' || !datei.size) return fehler('Datei fehlt.', 400);
  try {
    const r = await vertragUnterschrieben({
      haushalt: h.haushalt, person: h.person, id: String(form.get('id') ?? ''), stand: String(form.get('stand') ?? ''), am: form.get('am') ?? undefined,
      datei: { bytes: Buffer.from(await datei.arrayBuffer()), name: datei.name || 'Vertrag unterschrieben.pdf' }, wer: werAus(req),
    });
    return NextResponse.json({ ok: true, vertrag: mitStand(r.vertrag), hinweise: r.hinweise });
  } catch (e) {
    if (e instanceof VertragFehler) return fehler(e.message, e.status, e.extra);
    console.error('[vertraege/unterschrift]', (e as Error)?.message);
    return fehler('Nicht gespeichert — interner Fehler.', 500);
  }
}
