// ─── Kalender — Termine zu Kontakt/Firma/Deal/Mandat (30.09., Paket K3) ─────
// GET ?kontakte=c-1,c-2&firmen=f-1&deals=ch-1&mandate=m-1  → { kommend, vergangen, zeiten }
//   Für die Akten im CRM: kommende und vergangene Termine (−180 … +180 Tage), gelesen NUR über den Bezug
//   (`kalender-bezug`), ohne iCloud-Abgleich (`termineLesen`, nie ein Netzaufruf). Private Termine der anderen Person
//   sind maskiert und fallen heraus. `zeiten` = Start/Ende/Ort je Termin-Schlüssel für die Meeting-Aktivitäten
//   (`terminUid` → Zeit, lib/crm/aktivitaeten.ts `meetingVon`). Zugang: Haushalt des Inhabers (wie der Kalender).

import { NextResponse } from 'next/server';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { ladeEinstellungen } from '@/lib/kalender/einstellungen';
import { termineLesen } from '@/lib/kalender/termine-lesen';
import { maskieren, altSchluessel } from '@/lib/kalender/bezug';
import { termineZu, type TermineZuFrage } from '@/lib/kalender/termine-zu';
import { wandzeit, tagPlus } from '@/lib/kalender/zeit';
import { localDay } from '@/lib/zeit';
import type { TerminZeit } from '@/lib/crm/aktivitaeten';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const liste = (v: string | null): string[] => (v ?? '').split(',').map(x => x.trim()).filter(x => KENNUNG.test(x)).slice(0, 50);

export async function GET(req: Request) {
  const z = await kalenderZugang(req);
  if (!z) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const q = new URL(req.url).searchParams;
  const frage: TermineZuFrage = { kontakte: liste(q.get('kontakte')), firmen: liste(q.get('firmen')), deals: liste(q.get('deals')), mandate: liste(q.get('mandate')) };
  if (!frage.kontakte!.length && !frage.firmen!.length && !frage.deals!.length && !frage.mandate!.length) return NextResponse.json({ ok: false, fehler: 'kontakte, firmen, deals oder mandate fehlen.' }, { status: 400 });
  const heute = localDay();
  const gelesen = await termineLesen(await ladeEinstellungen(), tagPlus(heute, -180), tagPlus(heute, 181)).catch(() => ({ quelle: 'leer' as const, termine: [], kalender: [] }));
  const sicht = gelesen.termine.map(t => maskieren(t, z.person));
  const r = termineZu(sicht, frage, wandzeit(new Date()));
  const zeiten: Record<string, TerminZeit> = {};
  for (const t of [...r.kommend, ...r.vergangen]) {
    zeiten[t.id] = { start: t.start, ende: t.ende, ...(t.ganztags ? { ganztags: true } : {}), ...(t.ort ? { ort: t.ort } : {}), titel: t.titel };
    // Meetings vor R-K1 tragen den Schlüssel ohne Kalender (`uid`, `uid::RID`) — auch darunter auffindbar (#46).
    const alt = altSchluessel(t.id);
    if (!zeiten[alt]) zeiten[alt] = zeiten[t.id];
  }
  return NextResponse.json({ ok: true, quelle: gelesen.quelle, ...r, zeiten });
}
