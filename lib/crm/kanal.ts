// ─── Herkunftskanal (rein, getestet) ─────────────────────────────────────────
// Aus score.ts herausgelöst (03.10.), damit der Scoring-Kern (`istMarketingLead`) ihn nutzen kann, ohne einen Importkreis über
// score.ts → scoring.ts zu bauen. score.ts exportiert alles unverändert weiter.

import type { Kontakt } from '@/lib/make-one/crm';
import { hatTyp, kategorieBeginnt } from './mehrfach';

export type KanalId = 'empfehlung' | 'event' | 'content' | 'outreach' | 'bestand' | 'inbound' | 'kampagne' | 'netzwerk' | 'unbekannt';
export const KANAL: { id: KanalId; label: string }[] = [
  { id: 'empfehlung', label: 'Empfehlung' }, { id: 'event', label: 'Event' }, { id: 'content', label: 'Content' }, { id: 'outreach', label: 'Outreach' },
  { id: 'inbound', label: 'Inbound' }, { id: 'kampagne', label: 'Kampagne' }, { id: 'netzwerk', label: 'Netzwerk' }, { id: 'bestand', label: 'Bestand' }, { id: 'unbekannt', label: 'Unbekannt' },
];
export const kanalLabel = (k: KanalId) => KANAL.find(x => x.id === k)!.label;

/** Über welchen Kanal ein Kontakt zu uns kam: erst die gepflegte Herkunft, sonst die Quelle aus der Liste. */
export function kanalVon(k: Pick<Kontakt, 'herkunft' | 'quelle' | 'kategorie' | 'typ'>): KanalId {
  switch (k.herkunft) {
    case 'empfehlung': return 'empfehlung';
    case 'veranstaltung': return 'event';
    case 'recherche': return 'outreach';
    case 'bekannt': return 'netzwerk';
    case 'selbst': return 'inbound';
    case 'hubspot': case 'vertrag': return 'bestand';
    default: break;
  }
  const q = (k.quelle ?? '').toLowerCase();
  if (/empfehl/.test(q)) return 'empfehlung';
  if (/event|messe|veranstalt|meetup/.test(q)) return 'event';
  if (/linkedin|content|newsletter|beitrag/.test(q)) return 'content';
  if (/kampagne/.test(q)) return 'kampagne';
  if (/inbound|anfrage|website/.test(q)) return 'inbound';
  if (/apple/.test(q) || kategorieBeginnt(k, 'Apple') || hatTyp(k, 'Netzwerk')) return 'netzwerk';
  if (/hubspot|import|export|bestand/.test(q)) return 'bestand';
  if (/leadliste|recherche|kaltakquise/.test(q)) return 'outreach';
  return 'unbekannt';
}

