// ─── Checks — Vorlagen und Katalog-Hilfen (24.10., Innovations-Check) ───────────────────────────────────────────
// Die Vorlagen liegen als JSON neben dem Code (vom Inhaber freigegeben, Texte nur nach seiner Freigabe ändern). Neuer Check =
// neuer Ordner unter lib/check/vorlagen/ + Eintrag in VORLAGEN — die Maschine (Ablauf, Auswertung, Seite) bleibt dieselbe.
// Rein, client- und serversicher.

import innovationsKatalog from './vorlagen/innovations-check/fragenkatalog.json';
import innovationsRegeln from './vorlagen/innovations-check/scoring.json';
import innovationsBenchmarks from './vorlagen/innovations-check/benchmarks.json';
import innovationsLead from './vorlagen/innovations-check/lead-scoring.json';
import innovationsSeite from './vorlagen/innovations-check/seite.json';
import vertriebKatalog from './vorlagen/vertriebs-check/fragenkatalog.json';
import vertriebRegeln from './vorlagen/vertriebs-check/scoring.json';
import vertriebSeite from './vorlagen/vertriebs-check/seite.json';
import sichtbarkeitKatalog from './vorlagen/sichtbarkeits-test/fragenkatalog.json';
import sichtbarkeitRegeln from './vorlagen/sichtbarkeits-test/scoring.json';
import sichtbarkeitSeite from './vorlagen/sichtbarkeits-test/seite.json';
import type { CheckAbschnitt, CheckFrage, CheckKatalog, CheckVorlage, CheckRegeln, CheckBenchmarks, CheckSeite, LeadScoringRegeln, DimKey, SaeuleKey } from './typen';

const vorlage = (id: string, name: string, katalog: unknown, regeln: unknown, seite: unknown): CheckVorlage => ({
  id, name, seite: seite as CheckSeite, katalog: katalog as CheckKatalog, regeln: regeln as CheckRegeln,
  // Vertriebscheck und Sichtbarkeitstest (30.10.) haben keine Innovations-Dimensionen — Benchmarks und Lead-Scoring sind dieselben Daten.
  benchmarks: innovationsBenchmarks as unknown as CheckBenchmarks,
  leadScoring: innovationsLead as unknown as LeadScoringRegeln,
});

/** Alle Checks der Website (30.10., Kevin: „kostenlosen Vertriebscheck … Sichtbarkeitstest“ — der Innovations-Check bleibt der große). */
export const VORLAGEN: Readonly<Record<string, CheckVorlage>> = {
  'innovations-check': vorlage('innovations-check', 'Innovations-Check', innovationsKatalog, innovationsRegeln, innovationsSeite),
  'vertriebs-check': vorlage('vertriebs-check', 'Vertriebs-Check', vertriebKatalog, vertriebRegeln, vertriebSeite),
  'sichtbarkeits-test': vorlage('sichtbarkeits-test', 'Sichtbarkeits-Check', sichtbarkeitKatalog, sichtbarkeitRegeln, sichtbarkeitSeite),
};

export const STANDARD_VORLAGE = 'innovations-check';

/** Adresse eines Checks: `/check` = Innovations-Check, `/check?thema=vertrieb` bzw. `?thema=sichtbarkeit` die kleinen Checks. */
export const VORLAGE_JE_THEMA: Readonly<Record<string, string>> = { vertrieb: 'vertriebs-check', sichtbarkeit: 'sichtbarkeits-test' };
export const THEMA_JE_VORLAGE: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(VORLAGE_JE_THEMA).map(([t, v]) => [v, t]));
export const vorlageFuerThema = (thema: string | undefined | null): string =>
  (thema && Object.prototype.hasOwnProperty.call(VORLAGE_JE_THEMA, thema) ? VORLAGE_JE_THEMA[thema] : STANDARD_VORLAGE);
/** Der Pfad eines Checks auf der Website (ohne Domain). */
export const checkPfad = (vorlageId: string): string => (THEMA_JE_VORLAGE[vorlageId] ? `/check?thema=${THEMA_JE_VORLAGE[vorlageId]}` : '/check');

export const vorlageVon = (id: string | undefined | null): CheckVorlage | null => (id && Object.prototype.hasOwnProperty.call(VORLAGEN, id) ? VORLAGEN[id] : null);

/** Abschnitt → Dimension (B Strategie … G Team), wie in der Referenz-Auswertung. */
export const DIMENSION_JE_ABSCHNITT: Readonly<Record<string, DimKey>> = { B: 'strategie', C: 'ki', D: 'automatisierung', E: 'daten', F: 'robotik', G: 'team' };

/** Abschnitt → Säule mit eigenen Fragen, aus dem Katalog (Feld `saeule`, 30.10.). Die Innovation hat keine eigenen Fragen. */
export function saeuleJeAbschnitt(k: CheckKatalog): Record<string, SaeuleKey> {
  return Object.fromEntries(k.abschnitte.filter(a => !!a.saeule).map(a => [a.id, a.saeule!]));
}

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
export const MODUL_ABSCHNITTE: readonly string[] = ['H', 'I', 'J'];
