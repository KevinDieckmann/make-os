// ─── Lebenszyklus-Phase einer Person — abgeleitet, nicht getippt (27.09.) ───
// Kevin: „Die Phasen (Interessent, Opportunity, Kunde …) klein anzeigen und
// aufklappen, nicht immer groß.“ Entscheidung: die Phase kommt aus dem, was im
// System wirklich passiert ist — aktives Mandat, offener Deal, aktiver Lead —,
// von Hand bleiben nur Partner/Multiplikator (Rollen). Rein, getestet.

import type { Kontakt, Lebensphase } from '@/lib/make-one/crm';
import type { CrmBestand } from './typen';
import { OFFENE_STUFEN } from './pipeline';

export type Phase = Lebensphase | 'opportunity';
export const PHASE_LABEL: Record<Phase, string> = { kontakt: 'Kontakt', interessent: 'Interessent', opportunity: 'Opportunity', kunde: 'Kunde', ex_kunde: 'Ex-Kunde', partner: 'Partner', multiplikator: 'Multiplikator' };
const LEAD_AKTIV = new Set(['kontaktiert', 'im_gespraech', 'qualifizierung', 'sql']);

type Bestand = Pick<CrmBestand, 'mandate' | 'chancen' | 'firmen'>;

/** Phase mit Grund — der Grund steht als Tooltip/Untertitel an der Person. */
export function phaseVon(k: Kontakt, crm?: Bestand | null): { phase: Phase; grund: string; vonHand: boolean } {
  const mandate = crm?.mandate ?? [], chancen = crm?.chancen ?? [], firmen = crm?.firmen ?? [];
  const aktiv = mandate.find(m => m.status === 'aktiv' && m.kontaktIds.includes(k.id));
  if (aktiv) return { phase: 'kunde', grund: `aktives Mandat „${aktiv.kunde}“`, vonHand: false };
  const deal = chancen.find(c => OFFENE_STUFEN.includes(c.stufe) && c.kontaktIds.includes(k.id));
  if (deal) return { phase: 'opportunity', grund: `offener Deal „${deal.titel}“`, vonHand: false };
  const beendet = mandate.find(m => m.status === 'beendet' && m.kontaktIds.includes(k.id));
  if (beendet) return { phase: 'ex_kunde', grund: `Mandat „${beendet.kunde}“ beendet`, vonHand: false };
  const firmaLead = k.firmaId ? firmen.find(f => f.id === k.firmaId)?.lead : undefined;
  const lead = firmaLead ?? k.lead;
  if (lead && LEAD_AKTIV.has(lead.status)) return { phase: 'interessent', grund: `Lead ${firmaLead ? 'der Firma ' : ''}„${lead.status === 'sql' ? 'SQL' : lead.status.replace('_', ' ')}“`, vonHand: false };
  if (k.lebensphase === 'partner' || k.lebensphase === 'multiplikator') return { phase: k.lebensphase, grund: 'Rolle von Hand', vonHand: true };
  if (k.lebensphase === 'kunde') return { phase: 'kunde', grund: 'von Hand gesetzt — ohne aktives Mandat', vonHand: true };
  if (k.lebensphase === 'ex_kunde') return { phase: 'ex_kunde', grund: 'von Hand gesetzt', vonHand: true };
  if (k.lebensphase === 'interessent') return { phase: 'interessent', grund: 'von Hand gesetzt — kein aktiver Lead', vonHand: true };
  return { phase: 'kontakt', grund: 'kein Lead, kein Deal, kein Mandat', vonHand: false };
}
