// ─── Finanzplanung jetzt — Business-Blatt je Gesellschaft (rein, getestet) ───
// Kevin 02.10.: „Businessplanung fertig“ — je Gesellschaft ein vollständiges Blatt: Umsatz aus Produkten,
// Kosten (fix/variabel, Personal, Software, Miete), Ergebnis vor und nach Steuern, Liquidität, Runway, Break-even.
// Diese Schicht RECHNET NICHTS NEU, was der Kern schon kennt: Umsatz, Kosten, Gewinn, Steuern (einzeln: KSt, Soli, Gewerbesteuer,
// Einkommensteuer, Anrechnung), Ergebnis nach Steuern, Konto und frei kommen aus `MonatUG`/`MonatSelbst` (Rechenkern, Umbau 02.10.;
// seit 04.10. auch die Summen — jede ist als Handwert überschreibbar). Neu und nur Anzeige: Break-even-Monat, Runway je Ort.
// Alles deterministisch und client-sicher. Steuern sind Näherungen — Hinweis, keine Steuerberatung.

import type { Gesellschaftskennung } from '@/lib/einheiten';
import { wert, type FinanzDaten, type MonatSelbst, type MonatUG, type Zeile } from './rechenkern';
import { betragImMonat, neuerBaustein, type Baustein, type KostenArt, type Planszenario, type Rhythmus } from './szenarien';

/** Leere Vorlagen für „+ Produkt“ — nur Beispiel-Namen, Preis 0 (Kevin 02.10.: keine echten Preise). Der Name ist frei änderbar. */
export const BEISPIEL_PRODUKTE: { name: string; rhythmus: Rhythmus; laufzeit?: number }[] = [
  { name: 'Interim CSO', rhythmus: 'monatlich', laufzeit: 6 },
  { name: 'Interim Head of Sales', rhythmus: 'monatlich', laufzeit: 6 },
  { name: 'Events', rhythmus: 'einmalig' },
];

/** Kostenarten in der Reihenfolge des Blatts: Personal, Software, Miete, Raten, Sonstiges. */
export const KOSTENARTEN_BLATT: KostenArt[] = ['stelle', 'tool', 'miete', 'rate', 'sonstiges'];

const rund = (v: number) => Math.round(v * 100) / 100;

// ── Bausteine je Gesellschaft ───────────────────────────────────────────────
/** Bausteine eines Ortes (jeder Ort hat seit 02.10. eine eigene Achse im Kern). */
export function bausteineVon(ps: Planszenario | null, ort: Gesellschaftskennung, art: Baustein['art'], mitRegler = false): Baustein[] {
  return (ps?.bausteine ?? []).filter(b => b.einheit === ort && b.art === art && (mitRegler || !b.regler));
}
/** Stellen rechnet der Kern mit Arbeitgeberanteil (MAKE Innovation GmbH und Selbstständigkeit) — so zeigen es auch die Blätter. */
export const kostenFaktor = (b: Baustein, agAnteil: number): number => (b.kostenArt === 'stelle' && (b.einheit === 'ug' || b.einheit === 'kdc') ? 1 + agAnteil : 1);
export const bausteinReihe = (b: Baustein, N: number): number[] => Array.from({ length: N }, (_, i) => betragImMonat(b, i + 1));

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
/** Aufwand je Steuerart und Monat (positiv = Belastung; die Anrechnung nach § 35 EStG ist ein positiver Abzug von der Einkommensteuer). */
export interface SteuerReihen { kst: number[]; soli: number[]; gewst: number[]; est: number[]; anrechnung: number[]; exit: number[] }

export interface Geschaeftsblatt {
  ort: Gesellschaftskennung;
  /** Umsatz je Baustein (Produkt). */
  produkte: { b: Baustein; werte: number[] }[];
  /** Kosten je Baustein, nach Kostenart geordnet (Stellen inkl. Arbeitgeberanteil, wo der Kern ihn rechnet). */
  kosten: { b: Baustein; werte: number[] }[];
  umsatz: number[];
  /** Alle Kosten dieses Ortes (positiv). */
  kostenSumme: number[];
  ergebnisVorSteuern: number[];
  /** Steuer-Aufwand je Monat insgesamt (positiv) — bei KD Ventures Ertragsteuer auf die laufenden Bausteine plus Steuer auf den Ausstieg. */
  steuer: number[];
  /** Dasselbe nach Steuerarten aufgeschlüsselt. */
  steuerArten: SteuerReihen;
  ergebnisNachSteuern: number[];
  /** Kontostand bzw. frei verfügbar — je nach Ort (siehe `liquiditaetName`). */
  liquiditaet: number[];
  liquiditaetName: string;
  breakEven: BreakEven;
  runway: number | null;
}

/** Sachkosten-Zeilen, die im MAKE-Blatt stehen: alles außer den Zeilen der Selbstständigkeit (die laufen im eigenen Blatt — wie im Kern, `rechneUG`). */
export const sachkostenDerMake = <Z extends Pick<Zeile, 'einheit'>>(zeilen: readonly Z[]): Z[] => zeilen.filter(z => z.einheit !== 'selbststaendigkeit');

/** „Einmalige Kosten und Ereignisse“ im MAKE-Blatt: Sach-Gesamtbetrag des Kerns minus die gelisteten MAKE-Fixkosten und die Sach-Bausteine (nie durch Selbst-Zeilen verzerrt). */
export function einmaligeKostenMake(u: Pick<MonatUG, 'sach' | 'bausteineSach'>, d: Pick<FinanzDaten, 'sachkosten' | 'plan'>, m: number): number {
  return u.sach - sachkostenDerMake(d.sachkosten).reduce((s, z) => s + wert(z, m, d.plan), 0) - u.bausteineSach;
}

/**
 * Das Blatt einer Gesellschaft aus dem Rechenergebnis des Kerns (`ug` = MAKE + KD Ventures, `kdc` = Selbstständigkeit). `m0` = „jetzt“ (Plan-Monat).
 */
export function geschaeftsblatt(d: Pick<FinanzDaten, 'monate' | 'annahmen'>, ort: Gesellschaftskennung, g: { ug: MonatUG[]; kdc: MonatSelbst[] }, ps: Planszenario | null, m0: number): Geschaeftsblatt {
  const N = d.monate.length, ug = g.ug, kdc = g.kdc;
  const prod = bausteineVon(ps, ort, 'umsatz', true).map(b => ({ b, werte: bausteinReihe(b, N) }));
  const kosten = KOSTENARTEN_BLATT.flatMap(art => bausteineVon(ps, ort, 'kosten', true).filter(b => (b.kostenArt ?? 'sonstiges') === art)).map(b => ({ b, werte: bausteinReihe(b, N).map(v => v * kostenFaktor(b, d.annahmen.agAnteil)) }));
  let umsatz: number[], kostenSumme: number[], vor: number[], arten: SteuerReihen, liq: number[], liqName: string;
  const reihe = (f: (i: number) => number) => Array.from({ length: N }, (_, i) => f(i));
  if (ort === 'ug') {
    // Kern: Umsatz = Treiber (Ankermandat, Retainer, …) + Bausteine der MAKE Innovation GmbH; Kosten = Personal + Stellen + Sach + Holding.
    umsatz = ug.map(u => u.umsatz);
    kostenSumme = ug.map(u => u.kosten);
    vor = ug.map(u => u.gewinn);
    arten = { kst: ug.map(u => u.st.kst), soli: ug.map(u => u.st.soli), gewst: ug.map(u => u.st.gewst), est: ug.map(u => u.st.est), anrechnung: ug.map(u => u.st.anrechnung), exit: reihe(() => 0) };
    liq = ug.map(u => u.frei); liqName = 'Frei verfügbar (nach Steuer und USt)';
  } else if (ort === 'kdv') {
    // Kern: Umlage und Partnerdarlehen-Rate gehen von der MAKE Innovation GmbH ein und als Holdingkosten bzw. Tilgung wieder aus (heben sich auf); dazu Ausstieg und Bausteine.
    umsatz = ug.map(u => u.kdvEinnahmen);
    kostenSumme = ug.map(u => u.kdvAusgaben);
    vor = ug.map(u => u.kdvErgebnis);
    arten = { kst: ug.map(u => u.kdvSt.kst), soli: ug.map(u => u.kdvSt.soli), gewst: ug.map(u => u.kdvSt.gewst), est: ug.map(u => u.kdvSt.est), anrechnung: ug.map(u => u.kdvSt.anrechnung), exit: ug.map(u => u.kdvExitSteuer) };
    liq = ug.map(u => u.kdvFrei); liqName = 'Frei verfügbar KD Ventures (Konto nach Steuerrücklage)';
  } else {
    // Selbstständigkeit: eigene Achse im Kern — Umsatz und Kosten aus ihren Bausteinen und Fixkosten, Einkommensteuer nach Grundtarif, eigenes Konto.
    umsatz = kdc.map(k => k.umsatz); kostenSumme = kdc.map(k => k.kosten); vor = kdc.map(k => k.gewinn);
    arten = { kst: kdc.map(k => k.st.kst), soli: kdc.map(k => k.st.soli), gewst: kdc.map(k => k.st.gewst), est: kdc.map(k => k.st.est), anrechnung: kdc.map(k => k.st.anrechnung), exit: reihe(() => 0) };
    liq = kdc.map(k => k.frei); liqName = 'Frei verfügbar (Konto nach Steuerrücklage und USt)';
  }
  const steuer = reihe(i => arten.kst[i] + arten.soli[i] + arten.gewst[i] + arten.est[i] - arten.anrechnung[i] + arten.exit[i]);
  // Ergebnis nach Steuern aus dem Kern (04.10.: als Handwert überschreibbar; ohne Handwert = vor − Steuer).
  const nach = ort === 'ug' ? ug.map(u => u.ergebnisNach) : ort === 'kdv' ? ug.map(u => u.kdvNach) : kdc.map(k => k.ergebnisNach);
  return { ort, produkte: prod, kosten, umsatz, kostenSumme, ergebnisVorSteuern: vor, steuer, steuerArten: arten, ergebnisNachSteuern: nach, liquiditaet: liq, liquiditaetName: liqName, breakEven: breakEven(vor), runway: runwayAb(liq, m0) };
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
