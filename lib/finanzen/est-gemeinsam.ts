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
import { arbeitsplanFuer, rechneMit, type Planszenario } from './szenarien';
import { bereichVon } from '@/lib/einheiten';
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
 * Dokument da ist. Gerechnet wird mit dem Arbeitsplan des Bereichs Privat (wie Finanzen › Privat › Planung, `steuerAusPlan`).
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

/** Steuerprofil einer Kapitalgesellschaft, so wie der Kern der Finanzplanung sie rechnet (`steuerParameter` des gerechneten Dokuments). */
function kapitalAus(gd: Parameters<typeof steuerParameter>[0], ort: 'ug' | 'kdv', plan: string | null): KapitalProfil {
  const k = steuerParameter(gd, ort);
  return { kapital: k.form === 'kapital', kstAn: k.kstAn, kst: k.kst, soliAn: k.soliAn, soli: k.soli, gewstAn: k.gewstAn, messzahl: k.messzahl, hebesatz: k.hebesatz, plan };
}

/** Bereich der Finanzplanung, dessen Planszenario für eine Einheit gilt (Privat-Einheiten → Privat, sonst Business). */
const planBereich = (ort: 'ug' | 'kdv'): 'privat' | 'business' => (bereichVon(ort) === 'privat' ? 'privat' : 'business');

/**
 * EIN Lauf der Finanzplanung für den Steuern-Bereich: die gemeinsame Einkommensteuer des Jahres und die Profile der Kapitalgesellschaften.
 * Je Teil das Planszenario SEINES Bereichs (17.10., L2 E1, `arbeitsplanFuer`): die Einkommensteuer (Privat + Selbstständigkeit) wie Finanzen ›
 * Privat › Planung, die Gesellschaften wie ihr Bereich (Vorgabe Business) — vorher alles der gemeinsame Arbeitsplan, auch wenn ein Bereich ein
 * eigenes Szenario rechnet. Ohne eigene Bereichs-Einstellung derselbe Lauf wie bisher (bit-gleich).
 * Seit 17.10. (L2 E2) auch KD Ventures (`kdv`): ihre Sätze (KSt, Soli, Messzahl, Hebesatz) wie in der Finanzplanung — vorher rechnete der Steuern-
 * Bereich sie mit festen 15,825 % und dem eigenen Hebesatz, die Finanzplanung mit ihrem Profil (zwei Rechnungen für dieselbe Steuer).
 */
export function steuerAusPlan(d: FinanzDaten | null | undefined, jahr: number): { est: EstGemeinsam | null; ug: KapitalProfil | null; kdv: KapitalProfil | null } {
  if (!d) return { est: null, ug: null, kdv: null };
  const laeufe = new Map<Planszenario | null, ReturnType<typeof rechneMit>>();
  const lauf = (ps: Planszenario | null) => { if (!laeufe.has(ps)) laeufe.set(ps, rechneMit(d, ps)); return laeufe.get(ps)!; };
  const psEst = arbeitsplanFuer(d, 'privat');
  const psUg = arbeitsplanFuer(d, planBereich('ug'));
  const psKdv = arbeitsplanFuer(d, planBereich('kdv'));
  const gEst = lauf(psEst);
  const ug = kapitalAus(lauf(psUg).d, 'ug', psUg?.name ?? null);
  const kdv = kapitalAus(lauf(psKdv).d, 'kdv', psKdv?.name ?? null);
  const j = estJahre(gEst.d, gEst.kdc, gEst.ug).find(x => x.jahr === jahr);
  if (!j) return { est: null, ug, kdv };
  const p = steuerParameter(gEst.d, ORT);
  return { est: { ...j, gewerbe: p.gewstAn && steuerAn(gEst.d, ORT, 'gewst'), hebesatz: p.hebesatz, freibetrag: p.freibetrag, anrechnungFaktor: p.anrechnung, splitting: !!p.splitting, plan: psEst?.name ?? null }, ug, kdv };
}
