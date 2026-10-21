'use client';

// ─── Platzgrenze beim Anlegen eines Mandats (21.10., Rundgang 19.10. B3) ───────────────────────────────────────────────────────────────────────────
// Kevin 21.10.: „höchstens N gleichzeitig“ — warnen, aber erlauben. Vor dem Anlegen (alle Wege: „+ Mandat“, aus Produkt, aus Deal/Angebot) fragt die
// Oberfläche „Alle N Plätze belegt — trotzdem anlegen?“; ein Klick legt trotzdem an, der Server lehnt nie ab (er gibt nur einen Hinweis). Die Regel steht
// EINMAL in lib/crm/produkt-karte.ts (`plaetzeVonProdukt`, `platzFrage`) — die Grenze von der Karte, sonst von der Treppen-Stufe des Produkts.

import { useMemo } from 'react';
import { useTreppe } from '../mandate/treppe/daten';
import { plaetzeVonProdukt, platzFrage, type PlatzLage } from '@/lib/crm/produkt-karte';
import type { CrmApi } from './daten';

/** Die Plätze des Produkts (null ohne Produkt bzw. ohne Grenze) und die Rückfrage, wenn alle belegt sind. */
export function usePlatzLage(api: CrmApi, leistungId: string | null | undefined): { lage: PlatzLage | null; frage: string | null } {
  const treppe = useTreppe();
  const stand = api.crm?.stand;
  const stufen = treppe.lage?.katalog.stufen;
  return useMemo(() => {
    const l = leistungId ? stand?.leistungen.find(x => x.id === leistungId && !x.geloeschtAm) : undefined;
    if (!l || !stand) return { lage: null, frage: null };
    const stufeMax = stufen?.find(s => s.leistungIds.includes(l.id))?.regeln.maxGleichzeitig;
    const lage = plaetzeVonProdukt(l, stand.mandate, stufeMax);
    return { lage, frage: lage?.voll ? platzFrage(lage, l.name) : null };
  }, [leistungId, stand, stufen]);
}
