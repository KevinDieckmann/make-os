// ─── Checks — Vorlagen und Katalog-Hilfen (24.10., Innovations-Check) ───────────────────────────────────────────
// Die Vorlagen liegen als JSON neben dem Code (vom Inhaber freigegeben, Texte nur nach seiner Freigabe ändern). Neuer Check =
// neuer Ordner unter lib/check/vorlagen/ + Eintrag in VORLAGEN — die Maschine (Ablauf, Auswertung, Seite) bleibt dieselbe.
// Rein, client- und serversicher.

import innovationsKatalog from './vorlagen/innovations-check/fragenkatalog.json';
import innovationsRegeln from './vorlagen/innovations-check/scoring.json';
import innovationsBenchmarks from './vorlagen/innovations-check/benchmarks.json';
import innovationsLead from './vorlagen/innovations-check/lead-scoring.json';
import type { CheckAbschnitt, CheckFrage, CheckKatalog, CheckVorlage, CheckRegeln, CheckBenchmarks, LeadScoringRegeln, DimKey } from './typen';

export const VORLAGEN: Readonly<Record<string, CheckVorlage>> = {
  'innovations-check': {
    id: 'innovations-check',
    name: 'Innovations-Check',
    katalog: innovationsKatalog as unknown as CheckKatalog,
    regeln: innovationsRegeln as unknown as CheckRegeln,
    benchmarks: innovationsBenchmarks as unknown as CheckBenchmarks,
    leadScoring: innovationsLead as unknown as LeadScoringRegeln,
  },
};

export const STANDARD_VORLAGE = 'innovations-check';

export const vorlageVon = (id: string | undefined | null): CheckVorlage | null => (id && Object.prototype.hasOwnProperty.call(VORLAGEN, id) ? VORLAGEN[id] : null);

/** Abschnitt → Dimension (B Strategie … G Team), wie in der Referenz-Auswertung. */
export const DIMENSION_JE_ABSCHNITT: Readonly<Record<string, DimKey>> = { B: 'strategie', C: 'ki', D: 'automatisierung', E: 'daten', F: 'robotik', G: 'team' };

export interface FrageMitAbschnitt extends CheckFrage { abschnitt: string }

/** Alle Fragen mit ihrem Abschnitt, nach Kennung. */
export function fragenNachId(k: CheckKatalog): Record<string, FrageMitAbschnitt> {
  const aus: Record<string, FrageMitAbschnitt> = {};
  for (const a of k.abschnitte) for (const f of a.fragen) aus[f.id] = { ...f, abschnitt: a.id };
  return aus;
}

/** Alle Fragen in Katalog-Reihenfolge. */
export const alleFragen = (k: CheckKatalog): FrageMitAbschnitt[] => k.abschnitte.flatMap(a => a.fragen.map(f => ({ ...f, abschnitt: a.id })));

/** Die Pflichtfragen des Kurzchecks in Katalog-Reihenfolge. */
export const kurzcheckFragen = (k: CheckKatalog): FrageMitAbschnitt[] => alleFragen(k).filter(f => f.kurzcheck === true);

export const abschnittVon = (k: CheckKatalog, id: string): CheckAbschnitt | undefined => k.abschnitte.find(a => a.id === id);

/** Abschnitte der Branchen-Module (ohne Dimension, mit Bedingung) — H, I, J. */
export const MODUL_ABSCHNITTE = ['H', 'I', 'J'] as const;
