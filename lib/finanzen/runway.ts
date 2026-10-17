// ─── Runway — EINE Rechnung (17.10., Abnahme 3 · B1) ────────────────────────
// Vorher zeigten vier Seiten vier Antworten: Cockpit „kein Verbrauch“, Controlling „3,2 Monate“ (Kasse ÷ Ø Kosten OHNE Umsatz,
// bei einem Konto „nur Business“ sogar 0,0), Finanzplanung „> 27 M“ und der Head of Finance „—“. CLAUDE.md: „Eine Kasse … Keine
// zweite Runway-Formel bauen.“ Seitdem gilt:
//
//   Runway = Business-Kasse ÷ Ø Netto-Verbrauch (Kosten minus Umsatz) der letzten drei abgeschlossenen Ist-Monate.
//   Deckt der Umsatz die Kosten, gibt es keinen Verbrauch — dann „kein Verbrauch“ statt einer Zahl.
//
// Rechnen tut das NUR diese Datei (Business-Index `runway`, `computeMetrics` für Controlling/ZOE/Schilde/Board, Head of Finance).
// Die Finanzplanung zeigt daneben eine ANDERE, benannte Größe: „Runway laut Plan“ (Monate ab jetzt, bis frei verfügbar im Plan unter
// null fällt) — sie kommt aus dem Rechenkern und bleibt dort (Regel „Formeln unverändert bis Kevins Wort“). Rein, Server und Browser.

/** Wie viele abgeschlossene Ist-Monate in den Schnitt eingehen. */
export const RUNWAY_BASIS_MONATE = 3;

/** Ein Satz Erklärung — überall derselbe (Cockpit, Controlling, Head of Finance). */
export const RUNWAY_ERKLAERUNG = 'Runway = Business-Kasse ÷ Ø Netto-Verbrauch (Kosten minus Umsatz) der letzten drei abgeschlossenen Monate.';
/** Die benannte Variante der Finanzplanung (eigene Größe, aus dem Rechenkern). */
export const RUNWAY_PLAN_NAME = 'Runway laut Plan';
export const RUNWAY_PLAN_ERKLAERUNG = 'Monate ab jetzt, bis frei verfügbar im Finanzplan unter null fällt — vorausgerechnet, nicht aus den Ist-Monaten.';

export interface RunwayIst {
  /** Monate, solange es einen Netto-Verbrauch gibt; sonst null. */
  monate: number | null;
  /** Umsatz deckt die Kosten — die Kasse schrumpft nicht. */
  keinVerbrauch: boolean;
  /** Ø Kosten minus Umsatz je Monat (negativ = Überschuss); null ohne Ist-Monate. */
  nettoVerbrauch: number | null;
  /** Wie viele Monate eingingen. */
  basisMonate: number;
  kasse: number | null;
  /** Warum es keine Zahl gibt (keine Kasse, keine Ist-Monate) — sonst undefiniert. */
  luecke?: 'kasse' | 'monate';
}

/**
 * Die eine Runway-Rechnung. `monate` = die abgeschlossenen Ist-Monate in zeitlicher Reihenfolge (die letzten drei zählen);
 * `kasse` = Summe der Business-Konten (null = kein Kontostand bekannt).
 */
export function runwayRechnen(kasse: number | null, monate: readonly { umsatz: number; kosten: number }[]): RunwayIst {
  const basis = monate.slice(-RUNWAY_BASIS_MONATE);
  if (!basis.length) return { monate: null, keinVerbrauch: false, nettoVerbrauch: null, basisMonate: 0, kasse, luecke: 'monate' };
  const netto = basis.reduce((s, m) => s + ((m.kosten || 0) - (m.umsatz || 0)), 0) / basis.length;
  if (netto <= 0) return { monate: null, keinVerbrauch: true, nettoVerbrauch: netto, basisMonate: basis.length, kasse };
  if (kasse == null) return { monate: null, keinVerbrauch: false, nettoVerbrauch: netto, basisMonate: basis.length, kasse, luecke: 'kasse' };
  return { monate: Math.max(0, kasse) / netto, keinVerbrauch: false, nettoVerbrauch: netto, basisMonate: basis.length, kasse };
}

/** Anzeige: „kein Verbrauch“ · „3,2 Monate“ · „—“. */
export function runwayAnzeige(r: Pick<RunwayIst, 'monate' | 'keinVerbrauch'>, kurz = false): string {
  if (r.keinVerbrauch) return 'kein Verbrauch';
  if (r.monate == null) return '—';
  const z = r.monate.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  return kurz ? `${z} Mon.` : `${z} Monate`;
}
