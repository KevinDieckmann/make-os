// ─── Unternehmen › Verträge › Vorlagen: Import-Vorschau aus DOCX/PDF/Text (01.11.) ────────────────────────────────────
// POST multipart (datei) bzw. JSON { text } → { vorschau: { titel, paragraphen, kandidaten, hinweis? } } — liest nur, schreibt NICHTS (kein Bestand,
// keine Ablage). Übernommen wird erst über POST /api/vertraege/vorlagen { aktion: 'speichern' } nach dem Prüfen und Markieren der Werte.
// Zugang wie die Vorlagen (Haushalt des Inhabers, volle Mitglieder; Dienstweg 403). Höchstens 15 MB.

import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { istDienst } from '@/lib/zugang/dienst';
import { begrenztLesen } from '@/lib/dateien/begrenzt-lesen';
import { VertragFehler, importVorschau } from '@/lib/vertraege/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX = 15 * 1024 * 1024;
const fehler = (text: string, status: number) => NextResponse.json({ ok: false, fehler: text }, { status });

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return fehler('Nur im Haushalt des Inhabers.', 403);
  if (istDienst(req)) return fehler('Nur per Sitzung — nie der Dienstweg.', 403);
  const h = await haushaltVon(req);
  if (!h) return fehler('Für dieses Konto nicht freigegeben.', 403);
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  const art = req.headers.get('content-type') ?? '';
  const roh = await begrenztLesen(req, MAX + 64 * 1024);
  if (!roh) return fehler('Datei zu groß (höchstens 15 MB).', 413);
  try {
    if (art.startsWith('multipart/form-data')) {
      let form: FormData;
      try { form = await new Response(new Uint8Array(roh), { headers: { 'content-type': art } }).formData(); } catch { return fehler('Upload nicht lesbar.', 400); }
      const datei = form.get('datei');
      if (!datei || typeof datei === 'string' || !datei.size) return fehler('Datei fehlt.', 400);
      return NextResponse.json({ ok: true, vorschau: await importVorschau({ bytes: Buffer.from(await datei.arrayBuffer()), name: datei.name.slice(0, 160) }) });
    }
    let b: { text?: unknown };
    try { b = JSON.parse(roh.toString('utf8')); } catch { return fehler('Kein JSON.', 400); }
    if (typeof b.text !== 'string') return fehler('text fehlt.', 400);
    return NextResponse.json({ ok: true, vorschau: await importVorschau(null, b.text) });
  } catch (e) {
    if (e instanceof VertragFehler) return fehler(e.message, e.status);
    console.error('[vertraege/import]', (e as Error)?.message);
    return fehler('Nicht gelesen — interner Fehler.', 500);
  }
}
