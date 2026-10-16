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
  return steuerAusPlan(d, jahr).est;
}

/**
 * Steuerprofil einer Kapitalgesellschaft aus der Finanzplanung (15.10., Kevin: Steuern der Hauptgesellschaft „wie bei KD Ventures“) — Rechtsform
 * und Sätze, mit denen der Kern der Finanzplanung rechnet (`steuerParameter`, „Welche Steuern gelten?“, Arbeitsplan überlagert). Der Steuern-
 * Bereich übernimmt sie nur (lib/steuern/rechnen.ts `mitFinanzplanung`) — keine zweite Satz-Tabelle.
 */
export interface KapitalProfil {
  kapital: boolean; kstAn: boolean; kst: number; soliAn: boolean; soli: number; gewstAn: boolean; messzahl: number; hebesatz: number; plan: string | null;
}

/** EIN Lauf der Finanzplanung für den Steuern-Bereich: die gemeinsame Einkommensteuer des Jahres und das Profil der Hauptgesellschaft. */
export function steuerAusPlan(d: FinanzDaten | null | undefined, jahr: number): { est: EstGemeinsam | null; ug: KapitalProfil | null } {
  if (!d) return { est: null, ug: null };
  const ps = arbeitsplanVon(d);
  const g = rechneMit(d, ps);
  const plan = ps?.name ?? null;
  const k = steuerParameter(g.d, 'ug');
  const ug: KapitalProfil = { kapital: k.form === 'kapital', kstAn: k.kstAn, kst: k.kst, soliAn: k.soliAn, soli: k.soli, gewstAn: k.gewstAn, messzahl: k.messzahl, hebesatz: k.hebesatz, plan };
  const j = estJahre(g.d, g.kdc, g.ug).find(x => x.jahr === jahr);
  if (!j) return { est: null, ug };
  const p = steuerParameter(g.d, ORT);
  return { est: { ...j, gewerbe: p.gewstAn && steuerAn(g.d, ORT, 'gewst'), hebesatz: p.hebesatz, freibetrag: p.freibetrag, anrechnungFaktor: p.anrechnung, splitting: !!p.splitting, plan }, ug };
}
