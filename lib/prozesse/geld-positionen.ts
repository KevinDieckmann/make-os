// ─── Prozesse — Positionen eines Angebots-Entwurfs aus dem Fall (29.10., Kreislauf W-B1; rein) ─────────────────────────────────────────────────────────
// Eigene Datei, damit die Regeln der Geld-Bausteine (./geld-bausteine.ts, im Motor und in der Werkstatt) das Angebots-Modul nicht mitziehen — geladen nur vom
// Server (lib/zoe/crm-vorschlag.ts, Art `angebot_entwurf` mit `positionen_aus: 'fall'`). Regel siehe ./geld-bausteine.ts (Kopf).

import type { Angebot, AngebotPosition, CrmBestand } from '@/lib/crm/typen';
import { positionenAusDeal } from '@/lib/crm/angebote';

type CrmTeil = Pick<CrmBestand, 'angebote' | 'chancen' | 'mandate' | 'leistungen'>;
const neuNummeriert = (l: readonly AngebotPosition[]): AngebotPosition[] => l.map((p, i) => ({ ...p, id: `p-${i + 1}` }));

/** Positionen für einen Angebots-Entwurf aus dem Fall (siehe Kopf). Rein. */
export function angebotPositionenFuerFall(crm: CrmTeil, b: { dealId?: string; mandatId?: string }): { positionen: AngebotPosition[]; quelle: 'vorgaenger' | 'produkt'; vorgaengerId?: string } | null {
  const deal = b.dealId ? crm.chancen.find(c => c.id === b.dealId) : undefined;
  const mandat = b.mandatId ? crm.mandate.find(m => m.id === b.mandatId && !m.geloeschtAm) : undefined;
  const dealIds = new Set([deal?.id, mandat?.chanceId].filter((x): x is string => !!x));
  const vorgaenger = (crm.angebote ?? [])
    .filter((a: Angebot) => a.positionen.length && ((a.dealId && dealIds.has(a.dealId)) || (mandat && a.mandatId === mandat.id)))
    .sort((x, y) => (x.geaendert < y.geaendert ? 1 : x.geaendert > y.geaendert ? -1 : 0))[0];
  if (vorgaenger) return { positionen: neuNummeriert(vorgaenger.positionen), quelle: 'vorgaenger', vorgaengerId: vorgaenger.id };
  const leistungId = deal?.leistungId ?? mandat?.leistungId;
  const l = leistungId ? crm.leistungen.find(x => x.id === leistungId && !x.geloeschtAm) : undefined;
  if (!l) return null;
  const positionen = positionenAusDeal(l, deal?.wert && deal.wert.betrag > 0 ? { betrag: deal.wert.betrag, basis: deal.wert.basis, ...(deal.wert.laufzeitMonate ? { laufzeitMonate: deal.wert.laufzeitMonate } : {}) } : undefined);
  return positionen.length ? { positionen: neuNummeriert(positionen), quelle: 'produkt' } : null;
}

