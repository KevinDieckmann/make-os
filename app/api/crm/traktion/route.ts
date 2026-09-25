// ─── Markttraktion — Überblick ──────────────────────────────────────────────
// GET → Traction-Score über Sales, Marketing, Event (lib/crm/traktion.ts),
//       die Kennzahlen je Welt, die Grundlage (zählt nicht in den Score),
//       die Übergaben zwischen den Welten, die Befunde („was jetzt zu tun
//       ist“) und je Head: letzter Lauf, Status, offene Vorschläge.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm } from '@/lib/crm/speicher';
import { kennzahlen } from '@/lib/crm/kennzahlen';
import { marketingKennzahlen } from '@/lib/crm/marketing';
import { eventKennzahlen, traktion, uebergaben, GRUNDLAGE, type Welt } from '@/lib/crm/traktion';
import { befunde } from '@/lib/crm/befunde';
import { HEADS, HEAD_NAME } from '@/lib/heads/prompt';
import { leererStand, standName, type HeadStand } from '@/lib/heads/stand';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const heute = localDay();
  const [roh, crm, ...staende] = await Promise.all([
    loadJson<{ kontakte: Kontakt[] }>('kontakte'), ladeCrm(),
    ...HEADS.map(h => loadJson<HeadStand>(standName(h))),
  ]);
  const kontakte = roh?.kontakte ?? [];
  const sales = kennzahlen(kontakte, crm, heute);
  const marketing = marketingKennzahlen(kontakte, crm, heute);
  const event = eventKennzahlen(kontakte, crm, heute);
  const kpis: Record<Welt, typeof sales> = { sales, marketing, event };
  const heads = HEADS.map((h, i) => {
    const s = { ...leererStand(), ...(staende[i] ?? {}) };
    const b = s.berichte[s.berichte.length - 1];
    return { id: h, name: HEAD_NAME[h], offen: s.vorschlaege.filter(v => v.status === 'offen').length, status: b?.antwort.status ?? null, zeit: b?.zeit ?? null, zusammenfassung: b?.antwort.zusammenfassung ?? s.ruhig?.text ?? null };
  });
  return NextResponse.json({
    ok: true, heute,
    traktion: traktion(kpis),
    grundlage: [...sales, ...marketing].filter(k => GRUNDLAGE.includes(k.id)),
    uebergaben: uebergaben(kontakte, crm, heute),
    befunde: befunde(kontakte, crm, heute),
    heads,
    bestand: { kontakte: kontakte.length, firmen: crm.firmen.length, chancen: crm.chancen.length, mandate: crm.mandate.length, events: crm.events.length, kampagnen: (crm.kampagnen ?? []).length },
  });
}
