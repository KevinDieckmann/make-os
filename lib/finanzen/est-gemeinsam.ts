// ─── Gemeinsame Einkommensteuer für den Steuern-Bereich (05.10., rein, getestet) ─────────────────────────────────────────────
// Kevin 05.10.: „Ich habe in der Selbstständigkeit einfach ein Gewerbe angemeldet“ → gewerblich MIT Gewerbesteuer, und die
// Einkommensteuer wird über Privat + Selbstständigkeit gemeinsam gerechnet. Der Steuern-Bereich (lib/steuern) rechnete bis dahin die
// Selbstständigkeit als Freiberuf ohne Gewerbesteuer und die Einkommensteuer als „Gewinn × Steuerquote“ — eine zweite Rechnung neben der
// Finanzplanung. Seit 05.10. gibt es EINE Rechenquelle: diese Datei liest das Jahr aus der Finanzplanung (Arbeitsplan, `rechneMit` →
// `estJahre` in lib/finanzen/rechenkern.ts, dieselbe `jahresSteuer` mit Differenzmethode, Gewerbesteuer-Freibetrag, § 35, Soli) und das
// Steuerprofil der Selbstständigkeit (`steuerParameter`, „Welche Steuern gelten?“ — Hebesatz, Freibetrag, Gewerbesteuer an/aus).
// Nichts wird hier neu gerechnet; es wird nur ausgewählt und benannt. Hinweis, keine Steuerberatung.

import type { FinanzDaten } from './rechenkern';
import { estJahre, type EstJahr } from './rechenkern';
import { arbeitsplanVon, rechneMit } from './szenarien';
import { steuerAn, steuerParameter } from './steuern';

/** Die Kennung der Selbstständigkeit im Rechenkern der Finanzplanung (dort heißt die Achse fest `kdc`). */
const ORT = 'kdc' as const;

export interface EstGemeinsam extends EstJahr {
  /** Gewerbesteuer der Selbstständigkeit gilt (Schalter „Gewerbesteuer“ in „Welche Steuern gelten?“ — Vorgabe: ja, gewerblich). */
  gewerbe: boolean;
  /** Hebesatz in Prozent, Gewerbesteuer-Freibetrag in Euro, Anrechnungsfaktor § 35 — so, wie die Finanzplanung sie rechnet. */
  hebesatz: number; freibetrag: number; anrechnungFaktor: number;
  /** Zusammenveranlagung (Splitting) eingestellt. */
  splitting: boolean;
  /** Name des Arbeitsplans, aus dem gerechnet wurde (null = Basis). */
  plan: string | null;
}

/**
 * Das Steuerjahr `jahr` aus der Finanzplanung — null, wenn es dort nicht vorkommt (Plan beginnt später, endet früher) oder kein
 * Dokument da ist. Gerechnet wird mit dem Arbeitsplan wie überall (Kennzahlen, ZOE).
 */
export function estGemeinsamFuer(d: FinanzDaten | null | undefined, jahr: number): EstGemeinsam | null {
  if (!d) return null;
  const ps = arbeitsplanVon(d);
  const g = rechneMit(d, ps);
  const j = estJahre(g.d, g.kdc, g.ug).find(x => x.jahr === jahr);
  if (!j) return null;
  const p = steuerParameter(g.d, ORT);
  return { ...j, gewerbe: p.gewstAn && steuerAn(g.d, ORT, 'gewst'), hebesatz: p.hebesatz, freibetrag: p.freibetrag, anrechnungFaktor: p.anrechnung, splitting: !!p.splitting, plan: ps?.name ?? null };
}
