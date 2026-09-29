// ─── Planen — Blöcke lesen (29.09., Paket K5) ───────────────────────────────
// GET ?von=YYYY-MM-DD&bis=YYYY-MM-DD[&fuer=<person>|alle]  (bis exklusiv, höchstens 120 Tage)
//   → { bloecke: PlanBlockSicht[] } — Blöcke = iCloud-Termine der Art Fokus/Block + nicht übernommene Blöcke
//     des alten Wochenplans (Archiv, `quelle: 'archiv'`, nur lesen). Ohne `fuer`: die eigenen.
// Ersetzt GET /api/state/wochenplan (410). Schreiben: nur /api/kalender/termin (der Block IST der Termin).
// Nur der Haushalt des Inhabers (wie der Kalender).

import { NextResponse } from 'next/server';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { planBloeckeLesen } from '@/lib/planung/bloecke-server';
import { tagPlus } from '@/lib/kalender/zeit';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAG = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const z = await kalenderZugang(req);
  if (!z) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const q = new URL(req.url).searchParams;
  const von = TAG.test(q.get('von') ?? '') ? q.get('von')! : localDay();
  let bis = TAG.test(q.get('bis') ?? '') ? q.get('bis')! : tagPlus(von, 7);
  if (bis <= von) bis = tagPlus(von, 1);
  if (bis > tagPlus(von, 120)) bis = tagPlus(von, 120);
  const fuer = q.get('fuer');
  const person = fuer === 'alle' ? null : fuer && /^[a-z0-9-]{1,40}$/.test(fuer) ? fuer : z.person;
  const bloecke = await planBloeckeLesen({ person, von, bis, betrachter: z.person });
  return NextResponse.json({ ok: true, von, bis, bloecke }, { headers: { 'Cache-Control': 'no-store' } });
}
