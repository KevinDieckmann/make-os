// ─── Finanzplanung jetzt — Business-Blatt je Gesellschaft (rein, getestet) ───
// Kevin 02.10.: „Businessplanung fertig“ — je Gesellschaft ein vollständiges Blatt: Umsatz aus Produkten,
// Kosten (fix/variabel, Personal, Software, Miete), Ergebnis vor und nach Steuern, Liquidität, Runway, Break-even.
// Diese Schicht RECHNET NICHTS NEU, was der Kern schon kennt: Umsatz, Kosten, Gewinn, Konto und frei kommen aus
// `MonatUG`/`MonatPrivat` (Rechenkern v3, unverändert). Neu und nur Anzeige: Steuer-Aufwand je Monat (Gewinn seit
// Jahresbeginn × Quote, wie die Rücklage des Kerns), Ergebnis nach Steuern, Break-even-Monat, Runway je Ort.
// Alles deterministisch und client-sicher. Steuern sind Näherungen — Hinweis, keine Steuerberatung.

import type { Gesellschaftskennung } from '@/lib/einheiten';
import type { FinanzDaten, MonatUG } from './rechenkern';
import { est2026, jahrVon, kalMonat } from './rechenkern';
import { betragImMonat, kernKanal, neuerBaustein, type Baustein, type KostenArt, type Planszenario, type Rhythmus } from './szenarien';

/** Leere Vorlagen für „+ Produkt“ — nur Beispiel-Namen, Preis 0 (Kevin 02.10.: keine echten Preise). Der Name ist frei änderbar. */
export const BEISPIEL_PRODUKTE: { name: string; rhythmus: Rhythmus; laufzeit?: number }[] = [
  { name: 'Interim CSO', rhythmus: 'monatlich', laufzeit: 6 },
  { name: 'Interim Head of Sales', rhythmus: 'monatlich', laufzeit: 6 },
  { name: 'Events', rhythmus: 'einmalig' },
];

/** Kostenarten in der Reihenfolge des Blatts: Personal, Software, Miete, Raten, Sonstiges. */
export const KOSTENARTEN_BLATT: KostenArt[] = ['stelle', 'tool', 'miete', 'rate', 'sonstiges'];

const rund = (v: number) => Math.round(v * 100) / 100;
const nullen = (n: number) => new Array<number>(n).fill(0);

// ── Bausteine je Gesellschaft ───────────────────────────────────────────────
/** Bausteine eines Ortes — `kdc` zählt in der Rechnung über die Kanäle der MAKE Innovation GmbH, hat hier aber ein eigenes Blatt. */
export function bausteineVon(ps: Planszenario | null, ort: Gesellschaftskennung, art: Baustein['art'], mitRegler = false): Baustein[] {
  return (ps?.bausteine ?? []).filter(b => b.einheit === ort && b.art === art && (mitRegler || !b.regler));
}
/** Stellen rechnet der Kern mit Arbeitgeberanteil (nur im Kanal der MAKE Innovation GmbH) — so zeigen es auch die Blätter. */
export const kostenFaktor = (b: Baustein, agAnteil: number): number => (b.kostenArt === 'stelle' && kernKanal(b.einheit) === 'ug' ? 1 + agAnteil : 1);
export const bausteinReihe = (b: Baustein, N: number): number[] => Array.from({ length: N }, (_, i) => betragImMonat(b, i + 1));
const summiere = (liste: number[][], N: number): number[] => { const s = nullen(N); for (const r of liste) for (let i = 0; i < N; i++) s[i] += r[i] ?? 0; return s; };

/** Wie viel von der Summe im Kern über den UG-Kanal läuft, obwohl der Baustein zur Selbstständigkeit gehört (Kern v3 hat dafür keine eigene Achse). */
export function kdcImKern(ps: Planszenario | null, N: number): { umsatz: number[]; kosten: number[] } {
  const u = bausteineVon(ps, 'kdc', 'umsatz').filter(b => kernKanal(b.einheit) === 'ug').map(b => bausteinReihe(b, N));
  const k = bausteineVon(ps, 'kdc', 'kosten').filter(b => kernKanal(b.einheit) === 'ug').map(b => bausteinReihe(b, N));
  return { umsatz: summiere(u, N), kosten: summiere(k, N) };
}

// ── Steuer-Aufwand je Monat (Anzeige) ───────────────────────────────────────
/**
 * Steuer-Aufwand je Monat: Quote × Zuwachs des Gewinns seit Jahresbeginn (nur positiv) — summiert sich je Jahr auf
 * Quote × Jahresgewinn, wie die Rücklage des Kerns. Mit Verlust im Jahr: 0. (Zahlung und Rücklage stehen im Kern.)
 */
export function steuerAufwand(gewinn: number[], satz: number): number[] {
  let ytd = 0, jahr = -1;
  return gewinn.map((g, i) => {
    const m = i + 1;
    if (jahrVon(m) !== jahr || kalMonat(m) === 1) { ytd = 0; jahr = jahrVon(m); }
    const vor = Math.max(0, ytd); ytd += g;
    return Math.max(0, ytd) * satz - vor * satz;
  });
}
/** Einkommensteuer-Aufwand je Monat nach Grundtarif auf den Gewinn seit Jahresbeginn (abzüglich Vorsorge und Sonderausgaben je Jahr). Näherung. */
export function einkommensteuerAufwand(gewinn: number[], abzug: number): number[] {
  let ytd = 0, jahr = -1;
  return gewinn.map((g, i) => {
    const m = i + 1;
    if (jahrVon(m) !== jahr || kalMonat(m) === 1) { ytd = 0; jahr = jahrVon(m); }
    const vor = est2026(Math.max(0, ytd - abzug)); ytd += g;
    return est2026(Math.max(0, ytd - abzug)) - vor;
  });
}

// ── Break-even und Runway ───────────────────────────────────────────────────
export interface BreakEven {
  /** Erster Plan-Monat, ab dem das Monatsergebnis nicht mehr negativ wird (und es bis zum Ende bleibt) — null: nicht im Planzeitraum. */
  monatlich: number | null;
  /** Erster Plan-Monat, ab dem die Summe der Monatsergebnisse nicht mehr negativ ist (und bleibt) — null: nicht im Planzeitraum. */
  kumuliert: number | null;
}
/** Break-even aus einer Ergebnisreihe (Index = Plan-Monat − 1). Nur Nullen: Monat 1 — es gibt nichts zu decken. */
export function breakEven(ergebnis: number[]): BreakEven {
  const ab = (test: (i: number) => boolean): number | null => {
    let erster: number | null = null;
    for (let i = ergebnis.length - 1; i >= 0; i--) { if (test(i)) erster = i + 1; else break; }
    return erster;
  };
  let kum = 0; const summe = ergebnis.map(v => (kum += v));
  return { monatlich: ab(i => ergebnis[i] >= -0.5), kumuliert: ab(i => summe[i] >= -0.5) };
}

/** Monate ab `m0`, bis die Reihe (Liquidität) unter null fällt — null: im Planzeitraum nicht. 0 = jetzt schon. */
export function runwayAb(liquiditaet: number[], m0: number): number | null {
  for (let m = m0; m <= liquiditaet.length; m++) if (liquiditaet[m - 1] < -0.5) return m - m0;
  return null;
}

// ── Das Blatt ───────────────────────────────────────────────────────────────
export interface Geschaeftsblatt {
  ort: Gesellschaftskennung;
  /** Umsatz je Baustein (Produkt). */
  produkte: { b: Baustein; werte: number[] }[];
  /** Kosten je Baustein, in der Reihenfolge der Kostenarten. */
  kosten: { b: Baustein; werte: number[] }[];
  umsatz: number[];
  /** Alle Kosten dieses Ortes (positiv). */
  kostenSumme: number[];
  ergebnisVorSteuern: number[];
  /** Ertragsteuer-Aufwand je Monat (positiv); bei KD Ventures die Steuer auf den Ausstieg. */
  steuer: number[];
  ergebnisNachSteuern: number[];
  /** Kontostand bzw. frei verfügbar — je nach Ort (siehe `liquiditaetName`). */
  liquiditaet: number[];
  liquiditaetName: string;
  breakEven: BreakEven;
  runway: number | null;
}

/**
 * Das Blatt einer Gesellschaft aus dem Rechenergebnis. `satz` ist die Ertragsteuer-Quote, mit der gerechnet wurde (`steuerUG`),
 * `abzug` Vorsorge + Sonderausgaben (Selbstständigkeit). `m0` = „jetzt“ (Plan-Monat).
 */
export function geschaeftsblatt(d: Pick<FinanzDaten, 'monate' | 'selbst' | 'annahmen'>, ort: Gesellschaftskennung, ug: MonatUG[], ps: Planszenario | null, satz: number, m0: number): Geschaeftsblatt {
  const N = d.monate.length;
  const prod = bausteineVon(ps, ort, 'umsatz', true).map(b => ({ b, werte: bausteinReihe(b, N) }));
  const kosten = KOSTENARTEN_BLATT.flatMap(art => bausteineVon(ps, ort, 'kosten', true).filter(b => (b.kostenArt ?? 'sonstiges') === art)).map(b => ({ b, werte: bausteinReihe(b, N).map(v => v * kostenFaktor(b, d.annahmen.agAnteil)) }));
  let umsatz: number[], kostenSumme: number[], vor: number[], steuer: number[], liq: number[], liqName: string;
  if (ort === 'ug') {
    // Kern: Umsatz = Treiber (Ankermandat, Retainer, …) + Bausteine (auch die der Selbstständigkeit); Kosten = Personal + Stellen + Sach + Holding.
    umsatz = ug.map(u => u.umsatz);
    kostenSumme = ug.map(u => u.kevin + u.malin + u.unterstuetzung + u.stellen + u.sach + u.gruendung + u.holding);
    vor = ug.map(u => u.gewinn);
    steuer = steuerAufwand(vor, satz);
    liq = ug.map(u => u.frei); liqName = 'Frei verfügbar (nach Steuer und USt)';
  } else if (ort === 'kdv') {
    // Kern: Umlage und Partnerdarlehen-Rate gehen von der MAKE Innovation GmbH ein und als Holdingkosten bzw. Tilgung wieder aus (heben sich auf); dazu Ausstieg und Bausteine.
    umsatz = ug.map(u => u.kdvUmlage + u.kdvBjoernEin + u.kdvExit + u.kdvBausteineEin);
    kostenSumme = ug.map(u => u.kdvHolding + u.kdvBjoern + u.kdvBausteineAus);
    vor = umsatz.map((v, i) => v - kostenSumme[i]);
    steuer = ug.map(u => u.kdvExitSteuer);
    liq = ug.map(u => u.kdvKonto); liqName = 'Kontostand KD Ventures';
  } else {
    umsatz = summiere(prod.map(p => p.werte), N);
    kostenSumme = summiere(kosten.map(k => k.werte), N);
    vor = umsatz.map((v, i) => v - kostenSumme[i]);
    steuer = einkommensteuerAufwand(vor, d.selbst.vorsorge + d.selbst.sonderausgaben);
    liq = []; liqName = 'Liquidität (Kontostand heute + Ergebnis nach Steuern)';
  }
  const nach = vor.map((v, i) => v - steuer[i]);
  if (ort === 'kdc') { let k = d.selbst.kontoStart; liq = nach.map(v => (k += v)); }
  return { ort, produkte: prod, kosten, umsatz, kostenSumme, ergebnisVorSteuern: vor, steuer, ergebnisNachSteuern: nach, liquiditaet: liq, liquiditaetName: liqName, breakEven: breakEven(vor), runway: runwayAb(liq, m0) };
}

/** Summe der nächsten 12 Monate ab `m0` — für die Kacheln. */
export const summe12 = (reihe: number[], m0: number): number => rund(reihe.slice(m0 - 1, m0 + 11).reduce((s, v) => s + v, 0));

// ── Arbeitsplan sichern ─────────────────────────────────────────────────────
/**
 * Der Arbeitsplan, in den ein Baustein oder eine Annahme geschrieben wird. Gibt es keinen, entsteht beim ersten Eintrag einer
 * („Arbeitsplan“ auf dem aktiven Treiber) — die Operationen dafür stehen in `vorOps` und gehören VOR die eigentliche Änderung.
 */
export function arbeitsplanSichern(d: Pick<FinanzDaten, 'arbeitsplan' | 'planszenarien' | 'aktiv'>, neueId: string, jetzt: string): { id: string; vorOps: { pfad: string; alt?: unknown; neu?: unknown; feld?: string }[] } {
  const vorhanden = d.arbeitsplan && (d.planszenarien ?? []).some(p => p.id === d.arbeitsplan) ? d.arbeitsplan : null;
  if (vorhanden) return { id: vorhanden, vorOps: [] };
  const ps: Planszenario = { id: neueId, name: 'Arbeitsplan', basis: d.aktiv, bausteine: [], annahmen: {}, angelegt: jetzt };
  return { id: neueId, vorOps: [{ pfad: '/planszenarien/-', neu: ps, feld: 'Arbeitsplan angelegt' }, { pfad: '/arbeitsplan', alt: d.arbeitsplan ?? null, neu: neueId, feld: 'Arbeitsplan gesetzt' }] };
}

/** Neues Produkt (Umsatzbaustein) für einen Ort — leer, ohne Preis. */
export function neuesProdukt(id: string, ort: Gesellschaftskennung, teil: { name?: string; rhythmus?: Rhythmus; laufzeit?: number; start: number }): Baustein {
  return neuerBaustein(id, { art: 'umsatz', einheit: ort, name: teil.name ?? 'Neues Produkt', produkt: teil.name, preis: 0, menge: 1, rhythmus: teil.rhythmus ?? 'monatlich', start: teil.start, ...(teil.laufzeit && teil.rhythmus !== 'einmalig' ? { laufzeit: teil.laufzeit } : {}) });
}
