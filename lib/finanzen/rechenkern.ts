// ─── MAKE OS — Finanzplanung jetzt: Rechenkern v3 ───────────────────────────
// Eine Rechnung für alles: MAKE Innovation GmbH (Kennung ug) · KD Ventures · Privat · Gruppe.
// (30.09.: nur Anzeigetexte auf den neuen Namen aus lib/einheiten.ts — Namen und Formeln unverändert.)
// Deterministisch und client-safe (keine Server-Importe), damit Seite, Routen
// und ZOE dieselben Zahlen sehen. Gleiche Logik wie Finanzplan v4 (Excel),
// dort gegengerechnet. Monat 1 = Okt 26 … 27 = Dez 28.
//
// Übernommen am 27.09.2026 aus Kevins Einbaupaket (Modul_Finanzen/
// finanzen-rechenkern.ts) — DIE eine Wahrheit der Rechnung. Änderungen hier
// nur, wenn die Rechnung selbst falsch ist; die Oberfläche rechnet nie daneben.
// Steuern sind Näherungen (Hinweis, keine Steuerberatung).
//
// Erweiterung 27.09. (Szenario-Baukasten, lib/finanzen/szenarien.ts): Die
// Bausteine eines Planszenarios werden dort zu Monatsreihen (`Zusatz`) aufgelöst
// und hier nur ADDIERT — ohne Zusatz rechnet der Kern Zeile für Zeile wie bisher.
//
// Excel-Prinzip: Jede Planzeile hat einen Sollwert ab/bis Monat. Einzelne
// Zellen lassen sich überschreiben (plan["<zeile>:<monat>"]). IST liegt
// getrennt daneben (ist["<zeile>:<monat>"]) und wird später aus dem
// Finanz-Cockpit (Spalte einheit) befüllt.

import type { Planszenario } from './szenarien';
import { UG_KURZ, UG_NAME } from '@/lib/einheiten';

export type Einheit = 'privat' | 'selbststaendigkeit' | 'ug' | 'kdv';

/**
 * Monatsreihen aus Bausteinen (Index = Plan-Monat − 1), alle optional. Der Kern
 * addiert sie nur; fehlt eine Reihe, ist sie 0. Aufgelöst wird in
 * lib/finanzen/szenarien.ts — hier wird nichts interpretiert.
 */
export interface Zusatz {
  /** UG: weitere Umsätze netto (Leistung, zählt in den Gewinn). */
  ugUmsatz?: number[];
  /** UG: Zahlungseingang dieser Umsätze netto (Kasse, mit Zahlungsziel verschoben; USt kommt obendrauf). */
  ugEingang?: number[];
  /** UG: Brutto weiterer Stellen — Arbeitgeberanteil rechnet der Kern dazu. */
  ugPersonal?: number[];
  /** UG: weitere Sachkosten. */
  ugSach?: number[];
  /** UG → Privat: Ausschüttung/Entnahme brutto (Kasse UG raus; nicht im Gewinn). */
  ausschuettung?: number[];
  /** Pauschale Steuer auf die Ausschüttung — bleibt beim Finanzamt, privat kommt brutto − Steuer an (Näherung). */
  ausschuettungSteuer?: number[];
  privatEin?: number[]; privatAus?: number[];
  kdvEin?: number[]; kdvAus?: number[];
}
const zx = (r: number[] | undefined, i: number): number => r?.[i] ?? 0;

export interface Zeile {
  id: string; name: string; einheit: Einheit; gruppe: string;
  soll: number; ab?: number; bis?: number; notiz?: string;
  /** fix · jahr (Topf, monatlich angespart) · flex (Rollover) · sparen */
  typ?: 'fix' | 'jahr' | 'flex' | 'sparen';
  /** Tag im Monat für den Zahlungskalender. */
  tag?: number;
  /** Nur typ 'jahr': Jahresbetrag und Kalendermonate der Zahlung. soll = jahresbetrag / 12. */
  jahresbetrag?: number; faellig?: number[];
  kuendigung?: string;
}
export interface Ereignis { id: string; name: string; einheit: 'privat' | 'ug'; betrag: number; monat: number }
/** Buchung aus dem Finanz-Cockpit: d Datum, b Betrag (+ Eingang / − Ausgang), n Empfänger, k Konto, z Planzeile. */
export interface Buchung { id: string; d: string; b: number; n: string; k: string; z: string; fix?: boolean; e?: Einheit; hand?: boolean; notiz?: string }
/** Schuld mit Tilgungsplan. start = Plan-Monat der ersten Rate (1 = Okt 26). */
export interface Schuld { id: string; name: string; einheit: Einheit; rest: number; rate: number; zins: number; start: number; status: 'läuft' | 'unklar' | 'getilgt'; notiz?: string }
export interface Ziel { id: string; name: string; quelle: 'privat.angespart' | 'ug.frei' | 'kdv.bjoern' | 'gruppe'; ziel: number; bis: string; einheit: Einheit }
export interface Laufend { betrag: number; start: number; laufzeit: number; name?: string }
export interface AbMonat { betrag: number; ab: number }
export interface Einmal { betrag: number; monat: number }
export interface Szenario {
  id: string; name: string;
  ob: Laufend; retainer: Laufend[];
  astarna: AbMonat; events: AbMonat; erhoehung: AbMonat; unterstuetzung: AbMonat;
  exit1: Einmal; exit2: Einmal; bjoernAbloesen: boolean;
  ereignisse?: Ereignis[];
}
export interface Annahmen {
  kevinBrutto: number; kevinAb: number; malinBrutto: number; malinAb: number; agAnteil: number;
  stammkapital: number; gruendungskosten: number; darlehenKevin: number; darlehenRueckMonat: number;
  retainerVerzug: number; astarnaProvision: number; steuerUG: number; ust: number; steuerMonat: number;
  ruecklage5a: number; holdingKosten: number; holdingAb: number; kdvStart: number;
  bjoernBetrag: number; bjoernRate: number; bjoernRateVon: number; bjoernRateBis: number;
  bjoernSchluss: number; bjoernSchlussMonat: number; bjoernZinsMonat: number; bjoernZinsDeckel: number;
  exitSteuer: number; nettoTabelle: [number, number][]; gehaltTag?: number;
}
export interface Posten {
  id: string; art: 'konto' | 'forderung' | 'rechnung' | 'beleg' | 'aufgabe'; einheit: Einheit;
  name: string; betrag: number | null; status: string; notiz?: string; faellig?: string; wer?: string;
}
export interface SelbstPosten { id: string; name: string; art: 'einnahme' | 'ausgabe'; betrag: number; status: string; aus?: boolean }
export interface Schritt { id: string; text: string; wer: string; bis: string; erledigt: boolean }
export interface Aenderung { wer: string; wann: string; feld: string; alt: string; neu: string }

export interface FinanzDaten {
  version: 3; stand: string; monate: string[]; aktiv: string;
  /** Szenario-Baukasten (27.09.): eigene Szenarien aus Bausteinen über dem Treiber-Szenario. Fehlt in älteren Dokumenten → leer. */
  planszenarien?: Planszenario[];
  /** Kennung des Planszenarios, das als Arbeitsplan gilt — null/fehlt: der reine Treiber (`aktiv`). */
  arbeitsplan?: string | null;
  schulden: Schuld[];
  /** Wer hat eine Planzelle zuletzt geändert: key → {wer, wann}. */
  meta: Record<string, { wer: string; wann: string }>;
  abschluesse: { idx: number; wer: string; wann: string; uebertrag: number }[];
  /** IST-Monate vor dem Plan (Jan 26 … Sep 26) — kommen aus den Buchungen. */
  historie: string[];
  einstellungen: { heute: string; reserveMonate: number; notgroschenMonate: number };
  buchungen: Buchung[]; regeln: Record<string, string>;
  ziele: Ziel[];
  check: { punkte: string[]; eintraege: { datum: string; wer: string[]; erledigt: number[]; notiz: string }[] };
  notizen: Record<string, string>;
  annahmen: Annahmen;
  sachkosten: Zeile[]; privatEinnahmen: Zeile[]; privatBudget: Zeile[]; privatSchulden: Zeile[];
  szenarien: Szenario[];
  selbst: { posten: SelbstPosten[]; vorsorge: number; sonderausgaben: number; sicherheit: number; darlehenAnUG: number; consorsAbloesung: number; kontoStart: number };
  posten: Posten[];
  fokus: { saetze: string[]; regeln: string[]; schritte: Schritt[]; /** Die Entscheidung der Woche (Überblick › Lage). */ entscheidung?: string };
  plan: Record<string, number>; ist: Record<string, number>; protokoll: Aenderung[];
}

// ── Zeitachse ──────────────────────────────────────────────────────────────
export const jahrVon = (m: number): number => 2026 + Math.floor((m + 8) / 12);
export const kalMonat = (m: number): number => ((m + 8) % 12) + 1;

// ── Hilfen ─────────────────────────────────────────────────────────────────
const aktiv = (l: Laufend, m: number): boolean => l.start > 0 && m >= l.start && m < l.start + l.laufzeit;
const abAktiv = (a: AbMonat, m: number): number => (a.ab > 0 && m >= a.ab ? a.betrag : 0);
export const key = (id: string, m: number): string => id + ':' + m;

/** Sollwert einer Zeile im Monat m — mit Zellen-Überschreibung. */
export function wert(z: Zeile, m: number, plan: Record<string, number>): number {
  const k = key(z.id, m);
  if (k in plan) return plan[k];
  return m >= (z.ab ?? 1) && m <= (z.bis ?? 999) ? z.soll : 0;
}
/** Berechneter Basiswert, falls die Zelle nicht überschrieben wurde. */
const ov = (id: string, m: number, basis: number, plan: Record<string, number>): number => {
  const k = key(id, m); return k in plan ? plan[k] : basis;
};

/** Netto aus Brutto — lineare Interpolation in der Tabelle (StKl I, 2026). */
export function netto(brutto: number, t: [number, number][]): number {
  if (brutto <= 0) return 0;
  if (brutto <= t[0][0]) return Math.round(brutto * t[0][1] / t[0][0]);
  for (let i = 1; i < t.length; i++) {
    if (brutto <= t[i][0]) {
      const [b0, n0] = t[i - 1], [b1, n1] = t[i];
      return Math.round(n0 + (brutto - b0) * (n1 - n0) / (b1 - b0));
    }
  }
  const [b0, n0] = t[t.length - 2], [b1, n1] = t[t.length - 1];
  return Math.round(n1 + (brutto - b1) * (n1 - n0) / (b1 - b0));
}

/** Einkommensteuer Grundtarif 2026 (§ 32a EStG). */
export function est2026(zve: number): number {
  const x = Math.floor(Math.max(0, zve));
  if (x <= 12348) return 0;
  if (x <= 17799) { const y = (x - 12348) / 10000; return Math.floor((914.51 * y + 1400) * y); }
  if (x <= 69878) { const z = (x - 17799) / 10000; return Math.floor((173.10 * z + 2397) * z + 1034.87); }
  if (x <= 277825) return Math.floor(0.42 * x - 11135.63);
  return Math.floor(0.45 * x - 19470.38);
}

// ── MAKE Innovation GmbH (ug) + KD Ventures ───────────────────────────────────────────────
export interface MonatUG {
  m: number;
  ob: number; retainer: number; astarna: number; events: number; umsatz: number;
  retainerEingang: number; ustEin: number; kapital: number; einzahlungen: number;
  kevin: number; malin: number; kevinBrutto: number; malinBrutto: number;
  unterstuetzung: number; sach: number; gruendung: number; holding: number;
  ustZahlung: number; steuer: number; bjoern: number; darlehen: number; auszahlungen: number;
  saldo: number; konto: number; gewinn: number; gewinnYTD: number; steuerRuecklage: number; ustOffen: number; frei: number;
  retainerAnzahl: number;
  /** Aus Bausteinen (Szenario-Baukasten) — 0 ohne Zusatz. */
  bausteineUmsatz: number; bausteineEingang: number; stellen: number; bausteineSach: number; ausschuettung: number;
  // KD Ventures
  kdvUmlage: number; kdvBjoernEin: number; kdvExit: number; kdvExitSteuer: number;
  kdvHolding: number; kdvBjoern: number; kdvAbloesung: number; kdvKonto: number; bjoernRest: number;
  kdvBausteineEin: number; kdvBausteineAus: number;
}

export function rechneUG(d: FinanzDaten, sz: Szenario, x?: Zusatz): MonatUG[] {
  const a = d.annahmen, p = d.plan, N = d.monate.length;
  const out: MonatUG[] = [];
  let konto = 0, kdv = a.kdvStart, rest = a.bjoernBetrag, vorUst = 0;
  const gew: number[] = [];
  const retUmsatz: number[] = [];
  for (let m = 1; m <= N; m++) {
    const i = m - 1;
    const ob = ov('ug.ob', m, aktiv(sz.ob, m) ? sz.ob.betrag : 0, p);
    const ret = ov('ug.retainer', m, sz.retainer.filter(r => aktiv(r, m)).reduce((s, r) => s + r.betrag, 0), p);
    retUmsatz[i] = ret;
    const retEin = a.retainerVerzug === 0 ? ret : (i - a.retainerVerzug >= 0 ? retUmsatz[i - a.retainerVerzug] : 0);
    const ast = ov('ug.astarna', m, abAktiv(sz.astarna, m) * a.astarnaProvision, p);
    const ev = ov('ug.events', m, abAktiv(sz.events, m), p);
    const bU = zx(x?.ugUmsatz, i), bE = zx(x?.ugEingang, i), bP = zx(x?.ugPersonal, i), bS = zx(x?.ugSach, i), bA = zx(x?.ausschuettung, i);
    const umsatz = ob + ret + ast + ev + bU;
    const ustEin = (retEin + ast + ev + bE) * a.ust;
    const kapital = m === 1 ? a.stammkapital + a.darlehenKevin : 0;
    const einzahlungen = kapital + ob + retEin + ast + ev + bE + ustEin;

    const rz = abAktiv(sz.erhoehung, m);
    const kevinBrutto = ov('ug.kevin', m, m >= a.kevinAb ? a.kevinBrutto + rz : 0, p);
    const malinBrutto = ov('ug.malin', m, m >= a.malinAb ? a.malinBrutto + rz : 0, p);
    const kevin = kevinBrutto * (1 + a.agAnteil), malin = malinBrutto * (1 + a.agAnteil);
    const unterstuetzung = ov('ug.unterstuetzung', m, abAktiv(sz.unterstuetzung, m), p);
    const stellen = bP * (1 + a.agAnteil);
    const einmalig = (sz.ereignisse ?? []).filter(e => e.einheit === 'ug' && e.monat === m).reduce((s, e) => s + e.betrag, 0);
    const sach = d.sachkosten.reduce((s, z) => s + wert(z, m, p), 0) + einmalig + bS;
    const gruendung = m === 1 ? a.gruendungskosten : 0;
    const holding = m >= a.holdingAb ? a.holdingKosten : 0;
    const vorjahr = gew.reduce((s, g, j) => s + (jahrVon(j + 1) === jahrVon(m) - 1 ? g : 0), 0);
    const steuer = kalMonat(m) === a.steuerMonat ? a.steuerUG * Math.max(0, vorjahr) : 0;
    const abgeloest = sz.bjoernAbloesen && sz.exit1.monat > 0 && m >= sz.exit1.monat;
    const rateBasis = m === a.bjoernSchlussMonat ? a.bjoernSchluss : (m >= a.bjoernRateVon && m <= a.bjoernRateBis ? a.bjoernRate : 0);
    const bjoern = abgeloest ? 0 : rateBasis;
    const abloesung = sz.bjoernAbloesen && m === sz.exit1.monat && rest > 0
      ? rest + Math.min(a.bjoernZinsDeckel, a.bjoernZinsMonat * (m + 2)) : 0;
    const darlehen = m === a.darlehenRueckMonat ? a.darlehenKevin : 0;
    const auszahlungen = kevin + malin + unterstuetzung + stellen + sach + gruendung + vorUst + steuer + bjoern + holding + darlehen + bA;

    const saldo = einzahlungen - auszahlungen;
    konto += saldo;
    const gewinn = umsatz - kevin - malin - unterstuetzung - stellen - sach - gruendung - holding;
    gew[i] = gewinn;
    const ytd = gew.reduce((s, g, j) => s + (jahrVon(j + 1) === jahrVon(m) ? g : 0), 0);
    const steuerRuecklage = a.steuerUG * Math.max(0, ytd) + (kalMonat(m) < a.steuerMonat ? a.steuerUG * Math.max(0, vorjahr) : 0);
    const frei = konto - steuerRuecklage - ustEin;

    const ex = (m === sz.exit1.monat ? sz.exit1.betrag : 0) + (m === sz.exit2.monat ? sz.exit2.betrag : 0);
    const exSteuer = ex * a.exitSteuer;
    const kdvEin = zx(x?.kdvEin, i), kdvAus = zx(x?.kdvAus, i);
    kdv += holding + bjoern + ex - holding - bjoern - abloesung - exSteuer + kdvEin - kdvAus;
    rest = abloesung > 0 ? 0 : Math.max(0, rest - (m === a.bjoernSchlussMonat ? a.bjoernSchluss - a.bjoernZinsDeckel : bjoern));

    out.push({
      m, ob, retainer: ret, astarna: ast, events: ev, umsatz, retainerEingang: retEin, ustEin, kapital, einzahlungen,
      kevin, malin, kevinBrutto, malinBrutto, unterstuetzung, sach, gruendung, holding, ustZahlung: vorUst, steuer, bjoern, darlehen,
      auszahlungen, saldo, konto, gewinn, gewinnYTD: ytd, steuerRuecklage, ustOffen: ustEin, frei,
      retainerAnzahl: sz.retainer.filter(r => aktiv(r, m)).length,
      bausteineUmsatz: bU, bausteineEingang: bE, stellen, bausteineSach: bS, ausschuettung: bA,
      kdvUmlage: holding, kdvBjoernEin: bjoern, kdvExit: ex, kdvExitSteuer: exSteuer, kdvHolding: holding,
      kdvBjoern: bjoern, kdvAbloesung: abloesung, kdvKonto: kdv, bjoernRest: rest,
      kdvBausteineEin: kdvEin, kdvBausteineAus: kdvAus,
    });
    vorUst = ustEin;
  }
  return out;
}

// ── Privat ─────────────────────────────────────────────────────────────────
export interface MonatPrivat {
  m: number; einnahmenWeitere: number; kevinBrutto: number; kevinNetto: number; malinBrutto: number; malinNetto: number;
  verfuegbar: number; bedarf: number; schulden: number; ereignisse: number; luft: number; luftKum: number; sparen: number;
  fix: number; jahr: number; flex: number; sparenSoll: number; sparKum: number; angespart: number;
  /** Stand der Jahreskosten-Töpfe je Zeile. */
  toepfe: Record<string, number>;
  /** Aus Bausteinen (Szenario-Baukasten) — 0 ohne Zusatz. ausschuettung = netto (zählt zu verfuegbar), ausschuettungSteuer = pauschaler Abzug, bausteineAus mindert die Luft. */
  ausschuettung: number; ausschuettungSteuer: number; bausteineEin: number; bausteineAus: number;
}
/** Sollwert einer Budgetzeile: bei Jahreskosten der Monatsanteil. */
export function sollBudget(z: Zeile, m: number, plan: Record<string, number>): number {
  if (z.typ === 'jahr' && z.jahresbetrag != null && !(key(z.id, m) in plan)) return m >= (z.ab ?? 1) && m <= (z.bis ?? 999) ? z.jahresbetrag / 12 : 0;
  return wert(z, m, plan);
}
export function rechnePrivat(d: FinanzDaten, ug: MonatUG[], sz?: Szenario, x?: Zusatz): MonatPrivat[] {
  const a = d.annahmen, p = d.plan; let kum = 0, spar = 0;
  const topf: Record<string, number> = {};
  return ug.map(u => {
    const m = u.m;
    const weitere = d.privatEinnahmen.reduce((s, z) => s + wert(z, m, p), 0);
    const kevinBrutto = u.kevinBrutto;
    // Malin: vor der UG über Kevins Selbstständigkeit angestellt — gleiches Brutto.
    const malinBrutto = m >= a.malinAb ? u.malinBrutto : ov('p.malinSelbst', m, a.malinBrutto, p);
    const kevinNetto = ov('p.kevinNetto', m, netto(kevinBrutto, a.nettoTabelle), p);
    const malinNetto = ov('p.malinNetto', m, netto(malinBrutto, a.nettoTabelle), p);
    const bEin = zx(x?.privatEin, u.m - 1), bAus = zx(x?.privatAus, u.m - 1);
    const ausschuettungSteuer = Math.min(u.ausschuettung, zx(x?.ausschuettungSteuer, u.m - 1)), ausschuettung = u.ausschuettung - ausschuettungSteuer;
    const verfuegbar = weitere + kevinNetto + malinNetto + bEin + ausschuettung;
    const teil = (t: string) => d.privatBudget.filter(z => (z.typ ?? 'flex') === t).reduce((s, z) => s + sollBudget(z, m, p), 0);
    const fix = teil('fix'), jahr = teil('jahr'), flex = teil('flex'), sparenSoll = teil('sparen');
    const bedarf = fix + jahr + flex + sparenSoll;
    const schulden = d.privatSchulden.reduce((s, z) => s + wert(z, m, p), 0);
    const ereignisse = (sz?.ereignisse ?? []).filter(e => e.einheit === 'privat' && e.monat === m).reduce((s, e) => s + e.betrag, 0);
    const luft = verfuegbar - bedarf - schulden - ereignisse - bAus;
    kum += luft; spar += sparenSoll;
    for (const z of d.privatBudget.filter(z => z.typ === 'jahr')) {
      const f = z.faellig ?? [];
      const zahlung = f.includes(kalMonat(m)) && f.length ? (z.jahresbetrag ?? 0) / f.length : 0;
      topf[z.id] = (topf[z.id] ?? 0) + sollBudget(z, m, p) - zahlung;
    }
    return { m, einnahmenWeitere: weitere, kevinBrutto, kevinNetto, malinBrutto, malinNetto, verfuegbar, bedarf, schulden, ereignisse,
      luft, luftKum: kum, sparen: sparenSoll + luft, fix, jahr, flex, sparenSoll, sparKum: spar, angespart: kum + spar, toepfe: { ...topf },
      ausschuettung, ausschuettungSteuer, bausteineEin: bEin, bausteineAus: bAus };
  });
}

// ── Selbstständigkeit 2026 (Abschluss) ─────────────────────────────────────
export function rechneSelbst(d: FinanzDaten) {
  const s = d.selbst;
  const ein = s.posten.filter(x => x.art === 'einnahme' && !x.aus).reduce((t, x) => t + x.betrag, 0);
  const aus = s.posten.filter(x => x.art === 'ausgabe' && !x.aus).reduce((t, x) => t + x.betrag, 0);
  const gewinn = ein - aus;
  const zve = Math.max(0, gewinn - s.vorsorge - s.sonderausgaben);
  const est = est2026(zve);
  const offen = s.posten.filter(x => x.art === 'einnahme' && !x.aus && x.status !== 'bezahlt').reduce((t, x) => t + x.betrag, 0);
  const offenAus = s.posten.filter(x => x.art === 'ausgabe' && !x.aus && x.status !== 'bezahlt').reduce((t, x) => t + x.betrag, 0);
  const frei = s.kontoStart + offen - offenAus - s.darlehenAnUG - est - s.sicherheit;
  return { ein, aus, gewinn, zve, est, frei, nachConsors: frei - s.consorsAbloesung };
}

// ── Kennzahlen für Fokus & Szenarien ───────────────────────────────────────
export function kennzahlen(ug: MonatUG[], pr: MonatPrivat[]) {
  let minFrei = Infinity, minMonat = 1, minus = 0;
  ug.forEach(u => { if (u.frei < minFrei) { minFrei = u.frei; minMonat = u.m; } if (u.frei < 0) minus++; });
  const bei = (m: number) => ug[Math.min(m, ug.length) - 1];
  const jun27 = bei(9);
  const umsatzJahr = (j: number) => ug.filter(u => jahrVon(u.m) === j).reduce((s, u) => s + u.umsatz, 0);
  return {
    minFrei, minMonat, monateMinus: minus,
    freiDez26: bei(3).frei, freiDez27: bei(15).frei, freiDez28: bei(27).frei,
    kontoDez28: bei(27).konto, kdvDez28: bei(27).kdvKonto,
    obAnteilJun27: jun27.umsatz > 0 ? jun27.ob / jun27.umsatz : 0,
    retainerDez26: bei(3).retainerAnzahl, retainerJun27: jun27.retainerAnzahl,
    umsatz2027: umsatzJahr(2027), umsatz2028: umsatzJahr(2028),
    privatLuftMin: Math.min(...pr.map(p => p.luft)), privatKumDez28: pr[pr.length - 1].luftKum,
    gruppeDez28: bei(27).frei + bei(27).kdvKonto + pr[pr.length - 1].angespart,
    privatAngespartDez27: pr[14].angespart,
    bjoernRestDez27: bei(15).bjoernRest,
  };
}

// ── IST aus Buchungen (Cockpit) ────────────────────────────────────────────
/** Monats-Index der Historie aus Datum: Jan 26 = 0 … Sep 26 = 8; Plan-Monat 1 = Okt 26. */
export function histIndex(datum: string): number { const [j, mo] = datum.split('-').map(Number); return (j - 2026) * 12 + mo - 1; }
export function planMonat(datum: string): number { return histIndex(datum) - 8; }
export interface IstHistorie {
  /** Ausgaben je Planzeile und Historienmonat (positiv = ausgegeben). */
  zeilen: Record<string, number[]>;
  einnahmen: number[]; einmalig: number[]; ausgaben: number[]; offen: number[]; umbuchung: number[]; kredit: number[];
  /** Anzahl Buchungen je Monat — 0 heißt: noch keine Daten. */
  anzahl: number[];
}
export function istHistorie(d: FinanzDaten): IstHistorie {
  const n = d.historie.length + d.monate.length, leer = () => new Array(n).fill(0);
  const r: IstHistorie = { zeilen: {}, einnahmen: leer(), einmalig: leer(), ausgaben: leer(), offen: leer(), umbuchung: leer(), kredit: leer(), anzahl: leer() };
  for (const b of d.buchungen) {
    if ((b.e ?? 'privat') !== 'privat') continue;
    const i = histIndex(b.d); if (i < 0 || i >= n) continue;
    r.anzahl[i]++;
    if (b.z === 'x.einmalig') { r.einmalig[i] += b.b; r.einnahmen[i] += b.b; continue; }
    if (b.z === 'x.umbuchung') { r.umbuchung[i] += b.b; continue; }
    if (b.z === 'x.kredit') { r.kredit[i] += b.b; continue; }
    if (b.z === 'x.einnahme') { r.einnahmen[i] += b.b; continue; }
    if (b.z === 'x.offen') { r.offen[i] -= b.b; r.ausgaben[i] -= b.b; continue; }
    (r.zeilen[b.z] ??= leer())[i] -= b.b;
    r.ausgaben[i] -= b.b;
  }
  return r;
}
/** Durchschnitt der letzten k abgeschlossenen Historienmonate (ohne laufenden Monat). */
export function istSchnitt(h: number[] | undefined, k: number, bisIndex: number): number {
  if (!h) return 0; const von = Math.max(0, bisIndex - k + 1); let s = 0; for (let i = von; i <= bisIndex; i++) s += h[i] ?? 0; return s / (bisIndex - von + 1);
}
/** Regel lernen: Empfänger → Planzeile, rückwirkend auf alle Buchungen desselben Empfängers. */
export function lerneRegel(d: FinanzDaten, empfaenger: string, zeile: string): number {
  const k = empfaenger.toLowerCase(); d.regeln[k] = zeile; let n = 0;
  for (const b of d.buchungen) if (b.n.toLowerCase() === k && b.z !== zeile) { b.z = zeile; n++; }
  return n;
}

// ── Töpfe der UG (Profit First, an die Unterkonten der Bank angelehnt) ──
export interface ToepfeUG { m: number; ust: number; steuer: number; reserve: number; frei: number; reserveZiel: number; konto: number }
export function toepfeUG(ug: MonatUG[], reserveMonate: number): ToepfeUG[] {
  return ug.map(u => {
    const laufend = u.kevin + u.malin + u.unterstuetzung + u.stellen + u.sach + u.holding + u.bjoern;
    const reserveZiel = reserveMonate * laufend;
    const rest = u.konto - u.ustOffen - u.steuerRuecklage;
    const reserve = Math.max(0, Math.min(rest, reserveZiel));
    return { m: u.m, ust: u.ustOffen, steuer: u.steuerRuecklage, reserve, frei: rest - reserve, reserveZiel, konto: u.konto };
  });
}

// ── Ziele mit Tempo ────────────────────────────────────────────────────────
export interface ZielStand { ziel: Ziel; verlauf: number[]; heute: number; erreichtMonat: number | null; bisMonat: number; status: 'erreicht' | 'im Plan' | 'knapp' | 'verfehlt' }
export function zielStaende(d: FinanzDaten, ug: MonatUG[], pr: MonatPrivat[]): ZielStand[] {
  return d.ziele.map(z => {
    const verlauf = ug.map((u, i) => z.quelle === 'privat.angespart' ? pr[i].angespart : z.quelle === 'ug.frei' ? u.frei
      : z.quelle === 'kdv.bjoern' ? u.bjoernRest : u.frei + u.kdvKonto + pr[i].angespart);
    const runter = z.quelle === 'kdv.bjoern';
    const idx = verlauf.findIndex(v => runter ? v <= z.ziel + 0.5 : v >= z.ziel);
    const erreichtMonat = idx >= 0 ? idx + 1 : null;
    const bisMonat = planMonat(z.bis + '-01');
    const status = erreichtMonat === null ? 'verfehlt' : erreichtMonat <= 0 ? 'erreicht' : erreichtMonat <= bisMonat - 2 ? 'im Plan' : erreichtMonat <= bisMonat ? 'knapp' : 'verfehlt';
    return { ziel: z, verlauf, heute: verlauf[0], erreichtMonat, bisMonat, status };
  });
}

// ── Zahlungskalender ───────────────────────────────────────────────────────
export interface Termin { datum: string; text: string; betrag: number; einheit: Einheit }
export function zahlungskalender(d: FinanzDaten, ug: MonatUG[], pr: MonatPrivat[], tage: number): Termin[] {
  const heute = new Date(d.einstellungen.heute + 'T00:00:00'); const ende = new Date(heute.getTime() + tage * 864e5);
  const out: Termin[] = [];
  const dat = (m: number, t: number) => { const j = jahrVon(m), mo = kalMonat(m); const tt = Math.min(t, new Date(j, mo, 0).getDate()); return `${j}-${String(mo).padStart(2, '0')}-${String(tt).padStart(2, '0')}`; };
  const add = (m: number, t: number, text: string, betrag: number, einheit: Einheit) => {
    if (!betrag) return; const ds = dat(m, t); const dd = new Date(ds + 'T00:00:00'); if (dd >= heute && dd <= ende) out.push({ datum: ds, text, betrag, einheit });
  };
  for (const u of ug) {
    const m = u.m, p = pr[m - 1];
    for (const z of d.privatBudget) if (z.typ === 'fix' && z.tag) add(m, z.tag, z.name, -wert(z, m, d.plan), 'privat');
    for (const z of d.privatSchulden) if (z.tag) add(m, z.tag, z.name, -wert(z, m, d.plan), 'privat');
    for (const z of d.privatBudget) { const f = z.faellig ?? []; if (z.typ === 'jahr' && f.length && f.includes(kalMonat(m))) add(m, 15, z.name, -(z.jahresbetrag ?? 0) / f.length, 'privat'); }
    add(m, d.annahmen.gehaltTag ?? 28, 'Gehälter netto an Privat', p.kevinNetto + p.malinNetto, 'privat');
    add(m, d.annahmen.gehaltTag ?? 28, 'Gehälter inkl. Arbeitgeber', -(u.kevin + u.malin + u.unterstuetzung), 'ug');
    add(m, 1, 'Sachkosten', -u.sach, 'ug');
    add(m, 10, 'Umsatzsteuer an Finanzamt', -u.ustZahlung, 'ug');
    add(m, 1, 'Björn-Rate', -u.bjoern, 'kdv');
    add(m, 31, `Ertragsteuer ${UG_KURZ}`, -u.steuer, 'ug');
    add(m, 5, 'Eingang One Banking', u.ob, 'ug');
    add(m, 15, 'Eingang Retainer', u.retainerEingang * 1.19, 'ug');
    add(m, 15, 'Eingang aus Bausteinen', u.bausteineEingang * (1 + d.annahmen.ust), 'ug');
    add(m, d.annahmen.gehaltTag ?? 28, 'Weitere Stellen inkl. Arbeitgeber', -u.stellen, 'ug');
    add(m, 1, 'Ausschüttung an Privat', -u.ausschuettung, 'ug');
    add(m, 1, `Ausschüttung aus der ${UG_NAME} (netto)`, p.ausschuettung, 'privat');
    add(m, 1, 'Bausteine privat', p.bausteineEin - p.bausteineAus, 'privat');
  }
  return out.sort((a, b) => a.datum.localeCompare(b.datum));
}

// ── Schulden: Tilgungsplan und Sondertilgung ───────────────────────────────
export interface Tilgung { monate: number[]; frei: number | null; zinsen: number }
/** Rest je Plan-Monat bei Rate + Sondertilgung/Monat. frei = Plan-Monat, in dem die Schuld weg ist. */
export function tilgungsplan(s: Schuld, sonder = 0, N = 27): Tilgung {
  let rest = s.rest, zinsen = 0; const monate: number[] = []; let frei: number | null = rest <= 0 ? 0 : null;
  for (let m = 1; m <= N; m++) {
    if (rest > 0 && m >= s.start && s.status !== 'getilgt') {
      const z = rest * (s.zins / 100) / 12; zinsen += z; rest = Math.max(0, rest + z - s.rate - sonder);
      if (rest <= 0.005 && frei === null) frei = m;
    }
    monate.push(rest);
  }
  return { monate, frei, zinsen };
}
/** Monatsbudget-Tempo: wie viel vom Budget ist nach x % des Monats weg. */
export function tempo(ausgegeben: number, budget: number, tag: number, tageImMonat: number) {
  const anteilZeit = tag / tageImMonat, anteilGeld = budget > 0 ? ausgegeben / budget : 0;
  const prognose = anteilZeit > 0 ? ausgegeben / anteilZeit : ausgegeben;
  return { anteilZeit, anteilGeld, prognose, restProTag: Math.max(0, budget - ausgegeben) / Math.max(1, tageImMonat - tag) };
}
