// ─── MAKE OS — Finanzplanung jetzt: Rechenkern v3 ───────────────────────────
// Eine Rechnung für alles: MAKE Innovation GmbH (Kennung ug) · KD Ventures · Privat · Gruppe.
// (30.09.: nur Anzeigetexte auf den neuen Namen aus lib/einheiten.ts — Namen und Formeln unverändert.)
// KERN-UMBAU 02.10. (Kevin hat am 02.10. ausdrücklich entschieden, den Kern zu ändern — die Regel „Namen/Formeln unverändert bis
// Kevins Wort“ ist für genau diese vier Punkte aufgehoben):
//   1. Ertragsteuern einzeln statt EINER Quote (lib/finanzen/ertragsteuer.ts): MAKE Innovation GmbH und KD Ventures rechnen
//      Körperschaftsteuer + Soli + Gewerbesteuer, Verlustvortrag, Zahlung im Folgejahr oder Vorauszahlung je Quartal.
//   2. Selbstständigkeit hat eine eigene Monatsachse (`rechneSelbstAchse`, `MonatSelbst`) — Umsatz, Kosten, Ergebnis, Konto,
//      Einkommensteuer; ihre Bausteine laufen nicht mehr über die MAKE-Kanäle. Entnahme → Privat.
//   3. Einkommensteuer der Selbstständigkeit nach dem echten Grundtarif (`estTarif`, Eckwerte einstellbar, Vorgabe 2026).
//   4. `ruecklage5a` und `notgroschenMonate` sind gelöscht (waren ohne Wirkung); Altdaten mit den Feldern werden beim Lesen ignoriert.
// Alles Neue ist ein editierbares Feld mit Vorgabe (lib/finanzen/steuern.ts) — leer = wie vorher, soweit es geht.
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
//
// HANDWERTE (04.10., Kevins ausdrückliches Wort: „Jede Zahl bearbeitbar. Nur die Formeln sind im Hintergrund immer hart
// gecodet.“): Jeder gerechnete Wert läuft über `hand()` — steht im Plan `plan["<kennung>:<monat>"]` ein Handwert, gilt er
// statt des Formelwerts, und alles Nachgelagerte rechnet damit weiter. Die Formeln sind unverändert; ohne Handwert ist das
// Ergebnis bit-genau wie vorher (Summen mit Handwert wirken über ihre Abweichung `d…`, die ohne Handwert genau 0 ist).
// Die Kennungen und was sie bewirken: lib/finanzen/handwerte.ts (HAND_FELDER). Den Formelwert einer überschriebenen Zelle
// sammelt `f` (Formeln) — für Tooltip und Abweichung in der Oberfläche.

import type { Planszenario } from './szenarien';
import type { Steuern } from './steuern';
import { steuerParameter } from './steuern';
import { estTarif, neuerSteuerrechner, type SteuerHand, type SteuerMonat } from './ertragsteuer';
import type { Formeln } from './handwerte';
import type { Schwellen } from './schwellen';
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
  /** Selbstständigkeit (eigene Achse seit 02.10.): Umsatz netto (Leistung, zählt ins Ergebnis). */
  kdcUmsatz?: number[];
  /** Selbstständigkeit: Zahlungseingang dieser Umsätze netto (mit Zahlungsziel verschoben; USt kommt obendrauf). */
  kdcEingang?: number[];
  /** Selbstständigkeit: Brutto weiterer Stellen — Arbeitgeberanteil rechnet der Kern dazu. */
  kdcPersonal?: number[];
  /** Selbstständigkeit: weitere Sachkosten. */
  kdcSach?: number[];
  /** Selbstständigkeit → Privat: feste Entnahme (Kasse der Selbstständigkeit raus, Privat verfügbar rein; nicht im Ergebnis, keine weitere Steuer). */
  kdcEntnahme?: number[];
  /** Selbstständigkeit → Privat: Anteil (0–1) am positiven Ergebnis nach Steuern des Monats als Entnahme. */
  kdcEntnahmeAnteil?: number[];
  /**
   * Zahlungsziel in Monaten für Umsatz von Hand (04.10. Nachtrag, Kevin: „Umsatz von Hand zieht den Zahlungseingang mit“): die Abweichung
   * einer Umsatz-Summe von Hand (`ug.umsatz`, `kdc.umsatz`) kommt um so viele Monate später als Eingang (netto, USt obendrauf). Fehlt: im selben Monat.
   */
  umsatzZiel?: number;
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
  retainerVerzug: number; astarnaProvision: number;
  /** Früherer Ertragsteuer-Gesamtsatz der MAKE Innovation GmbH — seit 02.10. nur noch die Vorgabe, aus der der Hebesatz abgeleitet wird (die Steuern rechnet der Kern einzeln). */
  steuerUG: number; ust: number;
  /** Kalendermonat der Steuerzahlung im Folgejahr (Vorgabe für alle Gesellschaften; je Gesellschaft überschreibbar). */
  steuerMonat: number;
  holdingKosten: number; holdingAb: number; kdvStart: number;
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
/** Protokolleintrag. `pfad` (seit 04.10.) = der geänderte Pfad — damit die Business-Sicht nur Business-Einträge zeigt; ältere Einträge haben keinen. */
export interface Aenderung { wer: string; wann: string; feld: string; alt: string; neu: string; pfad?: string }

export interface FinanzDaten {
  version: 3; stand: string; monate: string[]; aktiv: string;
  /** Szenario-Baukasten (27.09.): eigene Szenarien aus Bausteinen über dem Treiber-Szenario. Fehlt in älteren Dokumenten → leer. */
  planszenarien?: Planszenario[];
  /** Kennung des Planszenarios, das als Arbeitsplan gilt — null/fehlt: der reine Treiber (`aktiv`). */
  arbeitsplan?: string | null;
  /** Welche Steuern gelten und wie hoch (02.10., Rechtsform, Sätze und Regeln je Ort) — der Kern rechnet damit (`steuerParameter`); leere Felder = Vorgabe. Fehlt in älteren Dokumenten. */
  steuern?: Steuern;
  /** Eigene Ampel-Schwellen (02.10.) — fehlt: die bisherigen Vorgaben. */
  schwellen?: Partial<Schwellen>;
  schulden: Schuld[];
  /** Wer hat eine Planzelle zuletzt geändert: key → {wer, wann}. */
  meta: Record<string, { wer: string; wann: string }>;
  abschluesse: { idx: number; wer: string; wann: string; uebertrag: number }[];
  /** IST-Monate vor dem Plan (Jan 26 … Sep 26) — kommen aus den Buchungen. */
  historie: string[];
  einstellungen: { heute: string; reserveMonate: number };
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
/**
 * Die Handwert-Schicht (04.10.): liefert zu einem gerechneten Wert den Handwert aus dem Plan (`<id>:<m>`) oder den gerechneten.
 * Nur endliche Zahlen gelten als Handwert. Ist `f` da, merkt sie sich den Formelwert jeder überschriebenen Zelle.
 */
export function hand(plan: Record<string, number>, f?: Formeln): (id: string, m: number, basis: number) => number {
  return (id, m, basis) => {
    const k = id + ':' + m;
    if (!(k in plan)) return basis;
    const v = plan[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) return basis;
    if (f) f[k] = basis;
    return v;
  };
}
/** Handwerte des Steuerrechners für einen Ort und Monat (`<ort>.kst`, `<ort>.steuer`, `<ort>.verlustvortrag` …). */
const steuerHand = (h: ReturnType<typeof hand>, ort: string, m: number): SteuerHand => (feld, basis) => h(`${ort}.${feld}`, m, basis);

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
export function est2026(zve: number): number { return estTarif(zve); }

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
  /** Eingang aus Umsatz von Hand (Abweichung der Umsatz-Summe, mit Zahlungsziel verschoben) — 0 ohne Handwert. Selbst ein Handwert (`ug.umsatzEingang`). */
  umsatzEingang: number;
  // KD Ventures
  kdvUmlage: number; kdvBjoernEin: number; kdvExit: number; kdvExitSteuer: number;
  kdvHolding: number; kdvBjoern: number; kdvAbloesung: number; kdvKonto: number; bjoernRest: number;
  kdvBausteineEin: number; kdvBausteineAus: number;
  /** Ertragsteuer der MAKE Innovation GmbH im Detail (02.10.): Aufwand je Steuerart, Zahlung, Rücklage, Verlustvortrag. `steuer`/`steuerRuecklage` oben sind Zahlung und Rücklage daraus. */
  st: SteuerMonat;
  /** KD Ventures (02.10.): laufendes Ergebnis aus Bausteinen (ohne Ausstieg — der hat seine eigene pauschale Steuer), dessen Ertragsteuer im Detail, und frei = Konto minus Rücklage. */
  kdvGewinn: number; kdvSt: SteuerMonat; kdvFrei: number;
  /**
   * Summen, die bisher nur die Oberfläche bildete (04.10., Handwerte): Personal inkl. Arbeitgeber (Gehälter + Unterstützung), einmalige
   * Kosten und Ereignisse, laufende Kosten (= Mindestumsatz: Personal + Stellen + Sach + Holding), Kosten gesamt, Ergebnis nach Steuern;
   * KD Ventures: Einnahmen, Ausgaben, Ergebnis vor und nach Steuern. Jede ist von Hand überschreibbar.
   */
  personal: number; einmalig: number; laufend: number; kosten: number; ergebnisNach: number;
  kdvEinnahmen: number; kdvAusgaben: number; kdvErgebnis: number; kdvNach: number;
}

/** Sachkosten-Zeilen, die der Selbstständigkeit zugeordnet sind, laufen dort; alle anderen bei der MAKE Innovation GmbH wie bisher. */
const istSelbstZeile = (z: Zeile): boolean => z.einheit === 'selbststaendigkeit';

export function rechneUG(d: FinanzDaten, sz: Szenario, x?: Zusatz, f?: Formeln): MonatUG[] {
  const a = d.annahmen, p = d.plan, N = d.monate.length;
  const h = hand(p, f);
  const out: MonatUG[] = [];
  let konto = 0, kdv = a.kdvStart, rest = a.bjoernBetrag, vorUst = 0;
  const gew: number[] = [];
  const retUmsatz: number[] = [];
  const handEin = new Array<number>(N).fill(0), ziel = Math.max(0, Math.round(x?.umsatzZiel ?? 0));
  const stUG = neuerSteuerrechner(steuerParameter(d, 'ug'), jahrVon, kalMonat);
  const stKdv = neuerSteuerrechner(steuerParameter(d, 'kdv'), jahrVon, kalMonat);
  const sachZeilen = d.sachkosten.filter(z => !istSelbstZeile(z));
  for (let m = 1; m <= N; m++) {
    const i = m - 1;
    const ob = h('ug.ob', m, aktiv(sz.ob, m) ? sz.ob.betrag : 0);
    const ret = h('ug.retainer', m, sz.retainer.filter(r => aktiv(r, m)).reduce((s, r) => s + r.betrag, 0));
    retUmsatz[i] = ret;
    const retEin = h('ug.retainerEingang', m, a.retainerVerzug === 0 ? ret : (i - a.retainerVerzug >= 0 ? retUmsatz[i - a.retainerVerzug] : 0));
    const ast = h('ug.astarna', m, abAktiv(sz.astarna, m) * a.astarnaProvision);
    const ev = h('ug.events', m, abAktiv(sz.events, m));
    const bU = zx(x?.ugUmsatz, i), bP = zx(x?.ugPersonal, i), bS = zx(x?.ugSach, i);
    const bE = h('ug.bausteineEingang', m, zx(x?.ugEingang, i)), bA = h('ug.ausschuettung', m, zx(x?.ausschuettung, i));
    const umsatzRoh = ob + ret + ast + ev + bU;
    const umsatz = h('ug.umsatz', m, umsatzRoh);
    // Umsatz von Hand zieht den Zahlungseingang mit (Zahlungsziel `umsatzZiel`); ohne Handwert ist die Abweichung genau 0.
    if (umsatz !== umsatzRoh && i + ziel < N) handEin[i + ziel] += umsatz - umsatzRoh;
    const uE = h('ug.umsatzEingang', m, handEin[i]);
    const ustEin = h('ug.ustEin', m, (retEin + ast + ev + bE + uE) * a.ust);
    const kapital = h('ug.kapital', m, m === 1 ? a.stammkapital + a.darlehenKevin : 0);
    const einzahlungen = h('ug.einzahlungen', m, kapital + ob + retEin + ast + ev + bE + uE + ustEin);

    const rz = abAktiv(sz.erhoehung, m);
    const kevinBrutto = h('ug.kevin', m, m >= a.kevinAb ? a.kevinBrutto + rz : 0);
    const malinBrutto = h('ug.malin', m, m >= a.malinAb ? a.malinBrutto + rz : 0);
    const kevin = kevinBrutto * (1 + a.agAnteil), malin = malinBrutto * (1 + a.agAnteil);
    const unterstuetzung = h('ug.unterstuetzung', m, abAktiv(sz.unterstuetzung, m));
    const stellen = bP * (1 + a.agAnteil);
    const einmalig = h('ug.einmalig', m, (sz.ereignisse ?? []).filter(e => e.einheit === 'ug' && e.monat === m).reduce((s, e) => s + e.betrag, 0));
    const sach = sachZeilen.reduce((s, z) => s + wert(z, m, p), 0) + einmalig + bS;
    const gruendung = h('ug.gruendung', m, m === 1 ? a.gruendungskosten : 0);
    const holding = h('ug.holding', m, m >= a.holdingAb ? a.holdingKosten : 0);
    // Summen mit Handwert: wirken über ihre Abweichung (ohne Handwert genau 0 — die Rechnung bleibt bit-genau wie vorher).
    const personalRoh = kevin + malin + unterstuetzung;
    const personal = h('ug.personal', m, personalRoh), dPers = personal - personalRoh;
    const laufendRoh = personal + stellen + sach + holding;
    const laufend = h('ug.laufend', m, laufendRoh), dLauf = laufend - laufendRoh;
    const kostenRoh = personal + stellen + sach + gruendung + holding + dLauf;
    const kosten = h('ug.kosten', m, kostenRoh), dKost = kosten - kostenRoh;
    const gewinn = h('ug.gewinn', m, umsatz - kevin - malin - unterstuetzung - stellen - sach - gruendung - holding - dPers - dLauf - dKost);
    const st0 = stUG(m, gewinn, steuerHand(h, 'ug', m));
    const steuer = st0.zahlung;
    const abgeloest = sz.bjoernAbloesen && sz.exit1.monat > 0 && m >= sz.exit1.monat;
    const rateBasis = m === a.bjoernSchlussMonat ? a.bjoernSchluss : (m >= a.bjoernRateVon && m <= a.bjoernRateBis ? a.bjoernRate : 0);
    const bjoern = h('ug.bjoern', m, abgeloest ? 0 : rateBasis);
    const abloesung = h('kdv.abloesung', m, sz.bjoernAbloesen && m === sz.exit1.monat && rest > 0
      ? rest + Math.min(a.bjoernZinsDeckel, a.bjoernZinsMonat * (m + 2)) : 0);
    const darlehen = h('ug.darlehen', m, m === a.darlehenRueckMonat ? a.darlehenKevin : 0);
    const ustZahlung = h('ug.ustZahlung', m, vorUst);
    const auszahlungen = h('ug.auszahlungen', m, kevin + malin + unterstuetzung + stellen + sach + gruendung + ustZahlung + steuer + bjoern + holding + darlehen + bA + dPers + dLauf + dKost);

    const saldo = einzahlungen - auszahlungen;
    konto = h('ug.konto', m, konto + saldo);
    gew[i] = gewinn;
    const ytd = gew.reduce((s, g, j) => s + (jahrVon(j + 1) === jahrVon(m) ? g : 0), 0);
    const steuerRuecklage = h('ug.steuerRuecklage', m, st0.ruecklage);
    const st: SteuerMonat = steuerRuecklage === st0.ruecklage ? st0 : { ...st0, ruecklage: steuerRuecklage };
    const ustOffen = h('ug.ustOffen', m, ustEin);
    const frei = h('ug.frei', m, konto - steuerRuecklage - ustOffen);
    const ergebnisNach = h('ug.ergebnisNach', m, gewinn - (st.kst + st.soli + st.gewst + st.est - st.anrechnung + 0));

    const ex = h('kdv.exit', m, (m === sz.exit1.monat ? sz.exit1.betrag : 0) + (m === sz.exit2.monat ? sz.exit2.betrag : 0));
    const exSteuer = h('kdv.exitSteuer', m, ex * a.exitSteuer);
    const kdvEin = zx(x?.kdvEin, i), kdvAus = zx(x?.kdvAus, i);
    // KD Ventures: Umlage und Partnerdarlehen-Rate kommen von der MAKE Innovation GmbH und gehen als Holdingkosten bzw. Tilgung wieder hinaus (heben
    // sich nach Formel auf); laufendes Ergebnis = Bausteine, dessen Ertragsteuer zahlt das Konto (Ausstieg: eigene pauschale Steuer).
    const kdvUmlage = h('kdv.umlage', m, holding), kdvBjoernEin = h('kdv.bjoernEin', m, bjoern);
    const kdvHolding = h('kdv.holding', m, holding), kdvTilgung = h('kdv.tilgung', m, bjoern);
    const einnRoh = kdvUmlage + kdvBjoernEin + ex + kdvEin;
    const kdvEinnahmen = h('kdv.einnahmen', m, einnRoh), dE = kdvEinnahmen - einnRoh;
    const ausgRoh = kdvHolding + kdvTilgung + kdvAus;
    const kdvAusgaben = h('kdv.ausgaben', m, ausgRoh), dA = kdvAusgaben - ausgRoh;
    const ergRoh = kdvEinnahmen - kdvAusgaben;
    const kdvErgebnis = h('kdv.ergebnis', m, ergRoh), dErg = kdvErgebnis - ergRoh;
    const kdvGewinn = (kdvUmlage - kdvHolding) + (kdvBjoernEin - kdvTilgung) + (kdvEin - kdvAus) + dE - dA + dErg;
    const kdvSt0 = stKdv(m, kdvGewinn, steuerHand(h, 'kdv', m));
    kdv = h('kdv.konto', m, kdv + (kdvUmlage + kdvBjoernEin + ex - kdvHolding - kdvTilgung - abloesung - exSteuer + kdvEin - kdvAus - kdvSt0.zahlung + dE - dA));
    rest = h('kdv.darlehenOffen', m, abloesung > 0 ? 0 : Math.max(0, rest - (m === a.bjoernSchlussMonat ? a.bjoernSchluss - a.bjoernZinsDeckel : kdvTilgung)));
    const kdvRuecklage = h('kdv.steuerRuecklage', m, kdvSt0.ruecklage);
    const kdvSt: SteuerMonat = kdvRuecklage === kdvSt0.ruecklage ? kdvSt0 : { ...kdvSt0, ruecklage: kdvRuecklage };
    const kdvFrei = h('kdv.frei', m, kdv - kdvRuecklage);
    const kdvNach = h('kdv.ergebnisNach', m, kdvErgebnis - (kdvSt.kst + kdvSt.soli + kdvSt.gewst + kdvSt.est - kdvSt.anrechnung + exSteuer));

    out.push({
      m, ob, retainer: ret, astarna: ast, events: ev, umsatz, retainerEingang: retEin, ustEin, kapital, einzahlungen,
      kevin, malin, kevinBrutto, malinBrutto, unterstuetzung, sach, gruendung, holding, ustZahlung, steuer, bjoern, darlehen,
      auszahlungen, saldo, konto, gewinn, gewinnYTD: ytd, steuerRuecklage, ustOffen, frei,
      retainerAnzahl: sz.retainer.filter(r => aktiv(r, m)).length,
      bausteineUmsatz: bU, bausteineEingang: bE, stellen, bausteineSach: bS, ausschuettung: bA, umsatzEingang: uE,
      kdvUmlage, kdvBjoernEin, kdvExit: ex, kdvExitSteuer: exSteuer, kdvHolding,
      kdvBjoern: kdvTilgung, kdvAbloesung: abloesung, kdvKonto: kdv, bjoernRest: rest,
      kdvBausteineEin: kdvEin, kdvBausteineAus: kdvAus,
      st, kdvGewinn, kdvSt, kdvFrei,
      personal, einmalig, laufend, kosten, ergebnisNach, kdvEinnahmen, kdvAusgaben, kdvErgebnis, kdvNach,
    });
    vorUst = ustOffen;
  }
  return out;
}

// ── Selbstständigkeit — eigene Monatsachse (02.10.) ───────────────────────────
export interface MonatSelbst {
  m: number;
  /** Umsatz netto (Leistung) und Zahlungseingang netto (mit Zahlungsziel), USt darauf. */
  umsatz: number; eingang: number; ustEin: number;
  /** Personal inkl. Arbeitgeberanteil, Sach- und Fixkosten, Kosten gesamt. */
  personal: number; sach: number; kosten: number;
  /** Ergebnis vor Steuern, Ertragsteuer im Detail (Einkommensteuer, Gewerbesteuer, Anrechnung), Ergebnis nach Steuern (Aufwand). */
  gewinn: number; st: SteuerMonat; ergebnisNach: number;
  ustZahlung: number;
  /** Entnahme nach Privat (Kasse der Selbstständigkeit raus; keine weitere Steuer). */
  entnahme: number;
  einzahlungen: number; auszahlungen: number; saldo: number;
  /** Eigenes Konto (Start: Kontostand heute aus dem Abschluss), Steuerrücklage, USt offen, frei = Konto − Rücklage − USt. */
  konto: number; steuerRuecklage: number; ustOffen: number; frei: number;
}

/**
 * Die Selbstständigkeit (Einzelunternehmen) für sich: Umsatz und Kosten aus ihren Bausteinen (`Zusatz.kdc*`) und ihren Sachkosten-Zeilen,
 * Einkommensteuer nach Grundtarif plus Gewerbesteuer (Freibetrag, Anrechnung) über `neuerSteuerrechner`, eigenes Konto, Entnahme nach Privat.
 * Ohne Zusatz ist sie leer (nur das Konto steht). Der Abschluss 2026 mit seinen Posten (`rechneSelbst`) bleibt eigenständig daneben.
 */
export function rechneSelbstAchse(d: FinanzDaten, x?: Zusatz, f?: Formeln): MonatSelbst[] {
  const a = d.annahmen, p = d.plan, N = d.monate.length;
  const h = hand(p, f);
  const st = neuerSteuerrechner(steuerParameter(d, 'kdc'), jahrVon, kalMonat);
  const zeilen = d.sachkosten.filter(istSelbstZeile);
  const out: MonatSelbst[] = [];
  let konto = d.selbst.kontoStart, vorUst = 0;
  const handEin = new Array<number>(N).fill(0), ziel = Math.max(0, Math.round(x?.umsatzZiel ?? 0));
  for (let m = 1; m <= N; m++) {
    const i = m - 1;
    const umsatzRoh = zx(x?.kdcUmsatz, i);
    const umsatz = h('kdc.umsatz', m, umsatzRoh);
    if (umsatz !== umsatzRoh && i + ziel < N) handEin[i + ziel] += umsatz - umsatzRoh;   // Umsatz von Hand → Eingang (Zahlungsziel)
    const eingang = h('kdc.eingang', m, zx(x?.kdcEingang, i) + handEin[i]);
    const ustEin = h('kdc.ustEin', m, eingang * a.ust);
    const personal = zx(x?.kdcPersonal, i) * (1 + a.agAnteil);
    const sach = zeilen.reduce((s, z) => s + wert(z, m, p), 0) + zx(x?.kdcSach, i);
    const kosten = h('kdc.kosten', m, personal + sach);
    const gewinn = h('kdc.gewinn', m, umsatz - kosten);
    const s0 = st(m, gewinn, steuerHand(h, 'kdc', m));
    const nach = h('kdc.ergebnisNach', m, gewinn - s0.summe);
    const entnahme = h('kdc.entnahme', m, zx(x?.kdcEntnahme, i) + zx(x?.kdcEntnahmeAnteil, i) * Math.max(0, nach));
    const einzahlungen = h('kdc.einzahlungen', m, eingang + ustEin);
    const ustZahlung = h('kdc.ustZahlung', m, vorUst);
    const auszahlungen = h('kdc.auszahlungen', m, kosten + ustZahlung + s0.zahlung + entnahme);
    const saldo = einzahlungen - auszahlungen;
    konto = h('kdc.konto', m, konto + saldo);
    const ruecklage = h('kdc.steuerRuecklage', m, s0.ruecklage);
    const s: SteuerMonat = ruecklage === s0.ruecklage ? s0 : { ...s0, ruecklage };
    const ustOffen = h('kdc.ustOffen', m, ustEin);
    out.push({
      m, umsatz, eingang, ustEin, personal, sach, kosten, gewinn, st: s, ergebnisNach: nach, ustZahlung, entnahme, einzahlungen, auszahlungen, saldo,
      konto, steuerRuecklage: ruecklage, ustOffen, frei: h('kdc.frei', m, konto - ruecklage - ustOffen),
    });
    vorUst = ustOffen;
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
  /** Entnahme aus der Selbstständigkeit (02.10.) — zählt zu verfuegbar, ist dort schon versteuert. 0 ohne Entnahme-Regel. */
  entnahme: number;
}
/** Sollwert einer Budgetzeile: bei Jahreskosten der Monatsanteil. */
export function sollBudget(z: Zeile, m: number, plan: Record<string, number>): number {
  if (z.typ === 'jahr' && z.jahresbetrag != null && !(key(z.id, m) in plan)) return m >= (z.ab ?? 1) && m <= (z.bis ?? 999) ? z.jahresbetrag / 12 : 0;
  return wert(z, m, plan);
}
export function rechnePrivat(d: FinanzDaten, ug: MonatUG[], sz?: Szenario, x?: Zusatz, kdc?: MonatSelbst[], f?: Formeln): MonatPrivat[] {
  const a = d.annahmen, p = d.plan; let kum = 0, spar = 0;
  const h = hand(p, f);
  const topf: Record<string, number> = {};
  return ug.map(u => {
    const m = u.m;
    const weitere = h('p.weitere', m, d.privatEinnahmen.reduce((s, z) => s + wert(z, m, p), 0));
    const kevinBrutto = u.kevinBrutto;
    // Malin: vor der UG über Kevins Selbstständigkeit angestellt — gleiches Brutto.
    const malinBrutto = m >= a.malinAb ? u.malinBrutto : h('p.malinSelbst', m, a.malinBrutto);
    const kevinNetto = h('p.kevinNetto', m, netto(kevinBrutto, a.nettoTabelle));
    const malinNetto = h('p.malinNetto', m, netto(malinBrutto, a.nettoTabelle));
    const bEin = h('p.bausteineEin', m, zx(x?.privatEin, u.m - 1)), bAus = h('p.bausteineAus', m, zx(x?.privatAus, u.m - 1));
    const ausschuettungSteuer = h('p.ausschuettungSteuer', m, Math.min(u.ausschuettung, zx(x?.ausschuettungSteuer, u.m - 1)));
    const ausschuettung = h('p.ausschuettung', m, u.ausschuettung - ausschuettungSteuer);
    const entnahme = h('p.entnahme', m, kdc?.[u.m - 1]?.entnahme ?? 0);
    const verfuegbar = h('p.verfuegbar', m, weitere + kevinNetto + malinNetto + bEin + ausschuettung + entnahme);
    const teil = (t: string) => d.privatBudget.filter(z => (z.typ ?? 'flex') === t).reduce((s, z) => s + sollBudget(z, m, p), 0);
    const fix = teil('fix'), jahr = teil('jahr'), flex = teil('flex'), sparenSoll = teil('sparen');
    const bedarf = h('p.bedarf', m, fix + jahr + flex + sparenSoll);
    const schulden = h('p.schulden', m, d.privatSchulden.reduce((s, z) => s + wert(z, m, p), 0));
    const ereignisse = h('p.ereignisse', m, (sz?.ereignisse ?? []).filter(e => e.einheit === 'privat' && e.monat === m).reduce((s, e) => s + e.betrag, 0));
    const luft = h('p.luft', m, verfuegbar - bedarf - schulden - ereignisse - bAus);
    kum += luft; spar += sparenSoll;
    // Angespart von Hand: die Folgemonate sparen von diesem Stand aus weiter.
    const angespartRoh = kum + spar;
    const angespart = h('p.angespart', m, angespartRoh);
    if (angespart !== angespartRoh) kum = angespart - spar;
    for (const z of d.privatBudget.filter(z => z.typ === 'jahr')) {
      const fa = z.faellig ?? [];
      const zahlung = fa.includes(kalMonat(m)) && fa.length ? (z.jahresbetrag ?? 0) / fa.length : 0;
      topf[z.id] = (topf[z.id] ?? 0) + sollBudget(z, m, p) - zahlung;
    }
    return { m, einnahmenWeitere: weitere, kevinBrutto, kevinNetto, malinBrutto, malinNetto, verfuegbar, bedarf, schulden, ereignisse,
      luft, luftKum: kum, sparen: h('p.sparen', m, sparenSoll + luft), fix, jahr, flex, sparenSoll, sparKum: spar, angespart, toepfe: { ...topf },
      ausschuettung, ausschuettungSteuer, bausteineEin: bEin, bausteineAus: bAus, entnahme };
  });
}

// ── Gruppe ─────────────────────────────────────────────────────────────────
/** Freies Geld der Gruppe je Monat (04.10., Handwert `g.frei`): MAKE frei + KD Ventures frei + Selbstständigkeit frei + Privat angespart. */
export function gruppeReihe(plan: Record<string, number>, ug: MonatUG[], pr: MonatPrivat[], kdc?: MonatSelbst[], f?: Formeln): number[] {
  const h = hand(plan, f);
  return ug.map((u, i) => h('g.frei', u.m, u.frei + u.kdvFrei + (kdc?.[i]?.frei ?? 0) + pr[i].angespart));
}

// ── Selbstständigkeit 2026 (Abschluss) ─────────────────────────────────────
/** Abschluss 2026 — ohne Monat; Handwerte stehen unter Monat 0 (`ab.est:0` …). */
export function rechneSelbst(d: FinanzDaten, f?: Formeln) {
  const s = d.selbst;
  const h = hand(d.plan ?? {}, f);
  const ein = h('ab.ein', 0, s.posten.filter(x => x.art === 'einnahme' && !x.aus).reduce((t, x) => t + x.betrag, 0));
  const aus = h('ab.aus', 0, s.posten.filter(x => x.art === 'ausgabe' && !x.aus).reduce((t, x) => t + x.betrag, 0));
  const gewinn = h('ab.gewinn', 0, ein - aus);
  const zve = h('ab.zve', 0, Math.max(0, gewinn - s.vorsorge - s.sonderausgaben));
  const est = h('ab.est', 0, estTarif(zve, steuerParameter(d, 'kdc').tarif));
  const offen = s.posten.filter(x => x.art === 'einnahme' && !x.aus && x.status !== 'bezahlt').reduce((t, x) => t + x.betrag, 0);
  const offenAus = s.posten.filter(x => x.art === 'ausgabe' && !x.aus && x.status !== 'bezahlt').reduce((t, x) => t + x.betrag, 0);
  const frei = h('ab.frei', 0, s.kontoStart + offen - offenAus - s.darlehenAnUG - est - s.sicherheit);
  return { ein, aus, gewinn, zve, est, frei, nachConsors: h('ab.nachConsors', 0, frei - s.consorsAbloesung) };
}

// ── Kennzahlen für Fokus & Szenarien ───────────────────────────────────────
/** Abweichung eines Handwerts „Freies Geld Gruppe“ im Monat 27 (Dez 28) — ohne Handwert (oder ohne Reihe) genau 0. */
function gruppeHand(ug: MonatUG[], pr: MonatPrivat[], kdc?: MonatSelbst[], gruppe?: number[]): number {
  const i = Math.min(27, ug.length) - 1;
  if (!gruppe || gruppe[i] === undefined || !pr[i]) return 0;
  return gruppe[i] - (ug[i].frei + ug[i].kdvFrei + (kdc?.[i]?.frei ?? 0) + pr[i].angespart);
}
export function kennzahlen(ug: MonatUG[], pr: MonatPrivat[], kdc?: MonatSelbst[], gruppe?: number[]) {
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
    kdcFreiDez28: kdc?.[Math.min(27, kdc.length) - 1]?.frei ?? 0,
    gruppeDez28: bei(27).frei + bei(27).kdvFrei + (kdc?.[Math.min(27, kdc.length) - 1]?.frei ?? 0) + pr[pr.length - 1].angespart + gruppeHand(ug, pr, kdc, gruppe),
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
/** `plan`/`f` (04.10.): Handwerte für Reserve-Ziel, Reserve und frei (`ug.reserveZiel`, `ug.reserve`, `ug.topfFrei`). */
export function toepfeUG(ug: MonatUG[], reserveMonate: number, plan: Record<string, number> = {}, f?: Formeln): ToepfeUG[] {
  const h = hand(plan, f);
  return ug.map(u => {
    // Laufende Kosten = Personal + Stellen + Sach + Holding (`laufend`, mit Handwert) plus die Partnerdarlehen-Rate.
    const laufend = (u.laufend ?? u.kevin + u.malin + u.unterstuetzung + u.stellen + u.sach + u.holding) + u.bjoern;
    const reserveZiel = h('ug.reserveZiel', u.m, reserveMonate * laufend);
    const rest = u.konto - u.ustOffen - u.steuerRuecklage;
    const reserve = h('ug.reserve', u.m, Math.max(0, Math.min(rest, reserveZiel)));
    return { m: u.m, ust: u.ustOffen, steuer: u.steuerRuecklage, reserve, frei: h('ug.topfFrei', u.m, rest - reserve), reserveZiel, konto: u.konto };
  });
}

// ── Ziele mit Tempo ────────────────────────────────────────────────────────
export interface ZielStand { ziel: Ziel; verlauf: number[]; heute: number; erreichtMonat: number | null; bisMonat: number; status: 'erreicht' | 'im Plan' | 'knapp' | 'verfehlt' }
export function zielStaende(d: FinanzDaten, ug: MonatUG[], pr: MonatPrivat[], kdc?: MonatSelbst[]): ZielStand[] {
  const gr = gruppeReihe(d.plan ?? {}, ug, pr, kdc);
  return d.ziele.map(z => {
    const verlauf = ug.map((u, i) => z.quelle === 'privat.angespart' ? pr[i].angespart : z.quelle === 'ug.frei' ? u.frei
      : z.quelle === 'kdv.bjoern' ? u.bjoernRest : gr[i]);
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
export function zahlungskalender(d: FinanzDaten, ug: MonatUG[], pr: MonatPrivat[], tage: number, kdc?: MonatSelbst[]): Termin[] {
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
    add(m, d.annahmen.gehaltTag ?? 28, 'Gehälter inkl. Arbeitgeber', -(u.personal ?? u.kevin + u.malin + u.unterstuetzung), 'ug');
    add(m, 1, 'Sachkosten', -u.sach, 'ug');
    add(m, 10, 'Umsatzsteuer an Finanzamt', -u.ustZahlung, 'ug');
    add(m, 1, 'Björn-Rate', -u.bjoern, 'kdv');
    add(m, 31, `Ertragsteuer ${UG_KURZ}`, -u.steuer, 'ug');
    add(m, 31, 'Ertragsteuer KD Ventures', -u.kdvSt.zahlung, 'kdv');
    add(m, 5, 'Eingang One Banking', u.ob, 'ug');
    add(m, 15, 'Eingang Retainer', u.retainerEingang * 1.19, 'ug');
    add(m, 15, 'Eingang aus Bausteinen', u.bausteineEingang * (1 + d.annahmen.ust), 'ug');
    add(m, d.annahmen.gehaltTag ?? 28, 'Weitere Stellen inkl. Arbeitgeber', -u.stellen, 'ug');
    add(m, 1, 'Ausschüttung an Privat', -u.ausschuettung, 'ug');
    add(m, 1, `Ausschüttung aus der ${UG_NAME} (netto)`, p.ausschuettung, 'privat');
    add(m, 1, 'Bausteine privat', p.bausteineEin - p.bausteineAus, 'privat');
    const k = kdc?.[m - 1];
    if (k) {
      add(m, 15, 'Eingang Selbstständigkeit', k.eingang + k.ustEin, 'selbststaendigkeit');
      add(m, 10, 'Umsatzsteuer Selbstständigkeit an Finanzamt', -k.ustZahlung, 'selbststaendigkeit');
      add(m, 31, 'Steuer Selbstständigkeit', -k.st.zahlung, 'selbststaendigkeit');
      add(m, 1, 'Entnahme an Privat', -k.entnahme, 'selbststaendigkeit');
      add(m, 1, 'Entnahme aus der Selbstständigkeit', p.entnahme, 'privat');
    }
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
