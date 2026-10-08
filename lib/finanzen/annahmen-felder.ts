// ─── Finanzplanung jetzt — die Annahmen als Felder (rein) ────────────────────
// Eine Liste für alle Stellen, die Annahmen zeigen (Planen › Annahmen, Business-Blätter): jedes Feld des
// Rechenkerns (`Annahmen`), das man eintragen kann, mit Beschriftung, Art und Gesellschaft. Die Steuer-Sätze
// (Ertragsteuer, USt, Zahlmonat, Ausstieg) stehen NICHT hier, sondern in der Karte „Welche Steuern gelten?“
// (lib/finanzen/steuern.ts) — jedes Feld hat genau einen Ort. (`ruecklage5a` war ohne Wirkung und ist seit dem
// Kern-Umbau 02.10. gelöscht.) `nettoTabelle` hat einen eigenen Editor.

import { UG_KURZ } from '@/lib/einheiten';
import type { Gesellschaftskennung } from '@/lib/einheiten';
import type { Annahmen } from './rechenkern';

export type AnnahmeArt = 'betrag' | 'anteil' | 'monat' | 'zahl';
export interface AnnahmeFeld { k: keyof Annahmen & string; label: string; art: AnnahmeArt; dezimal: number; /** Kurzer Hinweis unter dem Feld (optional). */ hinweis?: string }
export interface AnnahmeGruppe { id: string; label: string; ort: Gesellschaftskennung; felder: AnnahmeFeld[] }

const f = (k: keyof Annahmen & string, label: string, art: AnnahmeArt = 'betrag', hinweis?: string): AnnahmeFeld => ({ k, label, art, dezimal: art === 'anteil' ? 4 : 0, ...(hinweis ? { hinweis } : {}) });
/** Gegenprüfung 05.10. (Kevin: „Es gibt kein Gesellschafterdarlehen“): das alte Feld bleibt nur für ein echtes Darlehen von außen. */
export const DARLEHEN_ALT_HINWEIS = 'Nur eintragen, wenn es ein echtes Darlehen gibt — sonst 0. Der Geber liegt außerhalb des Plans (Geld kommt in die GmbH, Rückzahlung geht hinaus); Darlehen zwischen Privat und den Gesellschaften unter Planung › Schulden › Darlehen.';

/** `person1`/`person2`: Namen der beiden Gehaltsempfänger (aus dem Team, nie fest im Code). */
export function annahmeGruppen(person1: string, person2: string): AnnahmeGruppe[] {
  return [
    { id: 'personal', label: `Gehälter und Personal ${UG_KURZ}`, ort: 'ug', felder: [
      f('kevinBrutto', `${person1} brutto je Monat`), f('kevinAb', `${person1} ab Monat`, 'monat'), f('malinBrutto', `${person2} brutto je Monat`), f('malinAb', `${person2} ab Monat`, 'monat'),
      f('agAnteil', 'Arbeitgeberanteil', 'anteil'), f('gehaltTag', 'Gehaltstag im Monat', 'zahl'),
    ] },
    { id: 'kapital', label: `Kapital und Gründung ${UG_KURZ}`, ort: 'ug', felder: [
      f('stammkapital', 'Stammkapital'), f('gruendungskosten', 'Gründungskosten'), f('darlehenKevin', `Gesellschafterdarlehen an ${UG_KURZ} (alt)`, 'betrag', DARLEHEN_ALT_HINWEIS), f('darlehenRueckMonat', 'Rückzahlung in Monat', 'monat'),
    ] },
    { id: 'umsatz', label: `Umsatz-Treiber ${UG_KURZ}`, ort: 'ug', felder: [f('retainerVerzug', 'Retainer-Zahlungsverzug (Monate)', 'zahl'), f('astarnaProvision', 'Provision je vermitteltem Kunden')] },
    { id: 'holding', label: 'Holding und Start KD Ventures', ort: 'kdv', felder: [f('holdingKosten', 'Holdingkosten je Monat'), f('holdingAb', 'Holding ab Monat', 'monat'), f('kdvStart', 'Kontostand zum Start')] },
    { id: 'darlehen', label: 'Partnerdarlehen', ort: 'kdv', felder: [
      f('bjoernBetrag', 'Darlehen offen'), f('bjoernRate', 'Rate je Monat'), f('bjoernRateVon', 'Rate ab Monat', 'monat'), f('bjoernRateBis', 'Rate bis Monat', 'monat'),
      f('bjoernSchluss', 'Schlussrate'), f('bjoernSchlussMonat', 'Schlussrate in Monat', 'monat'), f('bjoernZinsMonat', 'Zins je Monat'), f('bjoernZinsDeckel', 'Zins-Deckel'),
    ] },
  ];
}

/** Alle Schlüssel, die die Felder abdecken — der Test prüft, dass kein Kern-Feld ohne Ort bleibt. */
export const ANNAHMEN_IN_KARTE_STEUER: (keyof Annahmen)[] = ['steuerUG', 'ust', 'steuerMonat', 'exitSteuer'];
export const ANNAHMEN_EIGENER_EDITOR: (keyof Annahmen)[] = ['nettoTabelle'];
