// ─── Kalender-Quellen: Feiertage NRW + Geburtstage (29.09., Paket K2) ───────
// GET ?von=YYYY-MM-DD&bis=YYYY-MM-DD (bis exklusiv, höchstens 400 Tage — die Jahresansicht)
//   → { ok, von, bis, feiertage: [{ tag, name }], geburtstage: Geburtstag[] }
// Feiertage rechnet auch der Browser selbst (quellen-feiertage.ts); hier kommen sie mit, damit Leser ohne eigene Rechnung
// (Heute, Widgets) EINEN Weg haben. Geburtstage über `geburtstageIm` (Familie der Person + CRM ohne Art.-18-Kontakte).
// Zugang wie der Kalender: angemeldete Person im Haushalt des Inhabers.

import { NextResponse } from 'next/server';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { feiertageIm } from '@/lib/kalender/quellen-feiertage';
import { geburtstageIm } from '@/lib/kalender/quellen-geburtstage-server';
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
  let bis = TAG.test(q.get('bis') ?? '') ? q.get('bis')! : tagPlus(von, 31);
  if (bis <= von) bis = tagPlus(von, 1);
  if (bis > tagPlus(von, 400)) bis = tagPlus(von, 400);
  const nur = q.get('space') === 'privat' || q.get('space') === 'business' ? (q.get('space') as 'privat' | 'business') : undefined;
  const geburtstage = await geburtstageIm({ von, bis }, z.person, nur ? { nur } : {});
  return NextResponse.json({ ok: true, von, bis, feiertage: feiertageIm(von, bis), geburtstage }, { headers: { 'Cache-Control': 'no-store' } });
}
