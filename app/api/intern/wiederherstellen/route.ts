// ─── Einzel-Restore aus einer Tageskopie (29.09., Paket D-A #63) — nur Inhaber ──
// GET  ?bestand=<name>                               → { tage: ['2026-09-28', …] } (neueste zuerst)
// GET  ?bestand=<name>&tag=<JJJJ-MM-TT>              → Vorschau je Liste (nur Kennungen, Stände, Feldnamen)
// GET  ?bestand&tag&liste=<feld>&ids=a,b             → die Einträge der Kopie zu diesen Kennungen (zum Ansehen)
// POST { bestand, tag, liste, auswahl: { id: stand|null } } → übernimmt einzeln, 409 bei inzwischen geändert
// Logik: lib/store/wiederherstellen.ts. Skript: scripts/einzel-wiederherstellen.mjs (Dienstweg = Systemlauf).

import { NextResponse } from 'next/server';
import { nurInhaber } from '@/lib/zugang/haushalt-inhaber';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { tageskopien, vorschau, kopieZeilen, uebernehmen, RestoreFehler } from '@/lib/store/wiederherstellen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (e: unknown) => e instanceof RestoreFehler
  ? NextResponse.json({ ok: false, fehler: e.message }, { status: e.status })
  : NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message.slice(0, 200) : 'Fehler' }, { status: 500 });

export async function GET(req: Request) {
  if (!(await nurInhaber(req))) return NextResponse.json({ ok: false, fehler: 'Nur der Inhaber.' }, { status: 403 });
  const u = new URL(req.url);
  const bestand = u.searchParams.get('bestand') ?? '';
  const tag = u.searchParams.get('tag');
  const liste = u.searchParams.get('liste');
  try {
    if (!tag) return NextResponse.json({ ok: true, bestand, tage: await tageskopien(bestand) });
    if (liste !== null) return NextResponse.json({ ok: true, zeilen: await kopieZeilen(bestand, tag, liste, (u.searchParams.get('ids') ?? '').split(',').filter(Boolean)) });
    return NextResponse.json({ ok: true, ...(await vorschau(bestand, tag)) });
  } catch (e) { return fehler(e); }
}

export async function POST(req: Request) {
  if (!(await nurInhaber(req))) return NextResponse.json({ ok: false, fehler: 'Nur der Inhaber.' }, { status: 403 });
  let b: { bestand?: unknown; tag?: unknown; liste?: unknown; auswahl?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const auswahl = b.auswahl && typeof b.auswahl === 'object' && !Array.isArray(b.auswahl) ? b.auswahl as Record<string, unknown> : null;
  if (!auswahl || Object.values(auswahl).some(v => v !== null && typeof v !== 'string')) return NextResponse.json({ ok: false, fehler: 'auswahl = { id: stand | null }' }, { status: 400 });
  try {
    const r = await uebernehmen(String(b.bestand ?? ''), String(b.tag ?? ''), String(b.liste ?? ''), auswahl as Record<string, string | null>, werAus(req));
    return r.ok ? NextResponse.json(r) : NextResponse.json(r, { status: r.status });
  } catch (e) { return fehler(e); }
}
