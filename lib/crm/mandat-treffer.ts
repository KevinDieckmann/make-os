// ─── Welches Mandat meint ZOE? (rein, getestet, 28.09.) ─────────────────────
// Integritätsprüfung 28.09.: `setze_kunde` suchte per Teilstring („Beispiel“ traf
// „Beispiel AG“ UND „Beispielbau GmbH“) und schrieb in den ersten Treffer. Jetzt
// zählt nur ein EXAKTER Name — Groß/Klein, Leerzeichen, Umlaute und Rechtsform
// egal (`firmenSchluessel`) — oder die Kennung. Mehrere exakte offene Mandate oder
// nur ähnliche Namen → Rückfrage, es wird nichts geschrieben.

import type { Mandat } from './typen';
import { firmenSchluessel } from './firmen';

export type MandatTreffer =
  | { art: 'treffer'; mandat: Mandat }
  | { art: 'mehrdeutig'; kandidaten: Mandat[] }
  | { art: 'aehnlich'; kandidaten: Mandat[] }
  | { art: 'keiner' };

const offen = (m: Mandat) => m.status !== 'beendet';

/** Sucht das Mandat zu einem Namen (bzw. einer Kennung). Beendete Mandate zählen nicht. */
export function mandatTreffer(mandate: Mandat[], suche: { name?: string; id?: string }): MandatTreffer {
  const liste = (Array.isArray(mandate) ? mandate : []).filter(offen);
  if (suche.id) {
    const m = liste.find(x => x.id === suche.id);
    return m ? { art: 'treffer', mandat: m } : { art: 'keiner' };
  }
  const name = (suche.name ?? '').trim();
  const schluessel = firmenSchluessel(name);
  if (!schluessel) return { art: 'keiner' };
  const exakt = liste.filter(m => firmenSchluessel(m.kunde) === schluessel);
  if (exakt.length === 1) return { art: 'treffer', mandat: exakt[0] };
  if (exakt.length > 1) return { art: 'mehrdeutig', kandidaten: exakt };
  // Kein exakter Treffer: ähnliche Namen nur NENNEN, nie beschreiben (alle, mit Kennung).
  const aehnlich = schluessel.length >= 3 ? liste.filter(m => { const k = firmenSchluessel(m.kunde); return !!k && (k.includes(schluessel) || schluessel.includes(k)); }) : [];
  return aehnlich.length ? { art: 'aehnlich', kandidaten: aehnlich } : { art: 'keiner' };
}
