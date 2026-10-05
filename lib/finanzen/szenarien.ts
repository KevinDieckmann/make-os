// ─── Finanzplanung jetzt — Szenario-Baukasten (rein, getestet) ───────────────
// Kevin 27.09.: „Szenarien selbst bauen können — mit Kunden, Produkten und
// Preisen dahinter.“ Ein Planszenario = Basis (der Ist-Plan aus Zeilen,
// Fixkosten und dem Treiber-Szenario des Rechenkerns) + Bausteine + eigene
// Annahmen. Diese Schicht rechnet NICHT selbst: sie löst Bausteine in
// Monatsreihen (`Zusatz`) auf, legt die Annahmen über das Dokument und füttert
// damit den Rechenkern. Alles hier ist deterministisch und client-sicher.
//
// Bausteine:
//   Umsatz  = Kunde/Segment × Produkt/Leistung × Preis × Menge × Start × Laufzeit
//             (monatlich · jährlich · einmalig), Einheit aus der einen Liste
//             (lib/einheiten.ts: MAKE Innovation GmbH · Selbstständigkeit · KD Ventures · Privat),
//             Zahlungsziel in Monaten (UG/Selbstständigkeit: Leistung zählt sofort in den
//             Gewinn, das Geld kommt später — USt obendrauf wie beim Retainer).
//
// Selbstständigkeit: eigene Achse im Baukasten (Einheit `kdc`, eigene Summe, eigener Name) und
// seit 02.10. (Kevins Entscheidung, Kern-Umbau) auch im Rechenkern: ihre Bausteine laufen in die
// Kanäle `Zusatz.kdc*` und werden in `rechneSelbstAchse` für sich gerechnet — nicht mehr in den
// MAKE-Zahlen. Bausteine ohne Zuordnung (Einheit fehlt/unbekannt) bleiben wie bisher bei der MAKE Innovation GmbH.
//   Kosten  = Stelle (Brutto, Arbeitgeberanteil rechnet der Kern) · Tool · Miete ·
//             Rate · Sonstiges, gleiche Zeitlogik.
// Annahmen je Szenario: Gehälter Kevin/Malin (brutto), Steuerquote UG,
// Zahlungsziel als Vorgabe, Ausschüttung UG → Privat ab Monat.
// Regler (Was-wäre-wenn) sind gewöhnliche Bausteine mit `regler`-Marke — die
// Oberfläche findet sie wieder, die Rechnung behandelt sie wie alle anderen.

import type { Annahmen, FinanzDaten, MonatPrivat, MonatSelbst, MonatUG, Szenario, ZielStand, Zusatz } from './rechenkern';
import { rechneUG, rechnePrivat, rechneSelbstAchse, kennzahlen, zielStaende, planMonat, kalMonat, gruppeReihe, lohnJahre } from './rechenkern';
import { pruefeSteuern, steuernMit, type Steuern } from './steuern';
import type { Unterseite } from './plan/hilfen';
import { schwellenVon } from './schwellen';
import { planMitSzenario, type Formeln } from './handwerte';
import { eur } from './plan/hilfen';
import { UG_KURZ, UG_NAME, finanzOrtName, type FinanzOrt, type KernEinheit } from '@/lib/einheiten';

export type Rhythmus = 'monatlich' | 'jaehrlich' | 'einmalig';
export type BausteinArt = 'umsatz' | 'kosten';
export type KostenArt = 'stelle' | 'tool' | 'miete' | 'rate' | 'sonstiges';
/** Wo ein Baustein hingehört — die eine Einheitenliste (lib/einheiten.ts), alle vier Orte. */
export type BausteinEinheit = FinanzOrt;
export type Regler = 'umsatz' | 'miete' | 'rate';

export interface Baustein {
  id: string;
  art: BausteinArt;
  einheit: BausteinEinheit;
  name: string;
  /** Kunde oder Segment (frei oder aus dem CRM) — nur Umsatz. */
  kunde?: string;
  /** Produkt oder Leistung (frei oder aus dem CRM) — nur Umsatz. */
  produkt?: string;
  /** Kennung des Produkts im Katalog (lib/crm/typen.ts Leistung.id) — fehlt: Baustein „ohne Produkt“. */
  produktId?: string;
  /** Nur Kosten. */
  kostenArt?: KostenArt;
  /** Preis je Einheit netto (Umsatz) bzw. Betrag (Kosten). */
  preis: number;
  /** Anzahl (Kunden, Lizenzen, Stellen). */
  menge: number;
  rhythmus: Rhythmus;
  /** Plan-Monat des ersten Betrags (1 = Okt 26). */
  start: number;
  /** Laufzeit in Monaten ab Start — fehlt: bis zum Ende der Zeitachse (bei einmalig ohne Bedeutung). */
  laufzeit?: number;
  /** Zahlungsziel in Monaten (nur Umsatz UG/Selbstständigkeit); fehlt: Vorgabe aus den Szenario-Annahmen. */
  zahlungsziel?: number;
  /** Aus- und einschaltbar, ohne zu löschen. */
  an: boolean;
  regler?: Regler;
  notiz?: string;
  /**
   * Einzelne Monate von Hand überschrieben (02.10., Zelle im Business-Blatt anklicken): Schlüssel `m<Plan-Monat>` → Betrag.
   * Ein überschriebener Monat gilt unabhängig von Start und Laufzeit; „aus“ (`an: false`) schaltet auch ihn ab. Fehlt: wie bisher.
   */
  ueber?: Record<string, number>;
}

export interface PlanAnnahmen {
  kevinBrutto?: number; malinBrutto?: number;
  /** Ertragsteuer UG als Anteil (0,3 = 30 %). */
  steuerUG?: number;
  /** Vorgabe Zahlungsziel in Monaten für Umsatz-Bausteine der UG. */
  zahlungsziel?: number;
  /** Ausschüttung/Entnahme UG → Privat je Monat ab Plan-Monat (brutto). */
  ausschuettung?: { betrag: number; ab: number };
  /** Pauschale Steuerquote auf die Ausschüttung (0–1); fehlt: AUSSCHUETTUNG_STEUER_VORGABE. Hinweis, keine Steuerberatung. */
  ausschuettungSteuer?: number;
  /** Steuer auf den Ausstieg (KD Ventures) als Anteil (0–1); fehlt: die Annahme des Plans. */
  exitSteuer?: number;
  /**
   * Entnahme der Selbstständigkeit → Privat (02.10.): fester Betrag je Monat ab Plan-Monat `ab` und/oder Anteil (0–1) am positiven
   * Ergebnis nach Steuern. Schon versteuert, keine weitere Steuer. Fehlt: keine Entnahme (das Geld bleibt im Konto der Selbstständigkeit).
   */
  entnahme?: { betrag?: number; anteil?: number; ab: number };
  /** Steuer-Sätze und -Regeln nur für dieses Szenario (überlagern `FinanzDaten.steuern`, je Gesellschaft, leer = Plan). */
  steuern?: Steuern;
}
/** Kevin 27.09.: Kapitalertragsteuer + Soli als Pauschale, je Szenario einstellbar. */
export const AUSSCHUETTUNG_STEUER_VORGABE = 0.264;
export const ausschuettungSteuerVon = (a: PlanAnnahmen): number => (typeof a.ausschuettungSteuer === 'number' && Number.isFinite(a.ausschuettungSteuer) ? Math.max(0, Math.min(1, a.ausschuettungSteuer)) : AUSSCHUETTUNG_STEUER_VORGABE);

export interface Planszenario {
  id: string; name: string;
  /** Treiber-Szenario des Rechenkerns (d.szenarien[].id), auf dem es aufsetzt. */
  basis: string;
  bausteine: Baustein[];
  annahmen: PlanAnnahmen;
  notiz?: string;
  angelegt: string;
}

export const RHYTHMUS_LABEL: Record<Rhythmus, string> = { monatlich: 'monatlich', jaehrlich: 'jährlich', einmalig: 'einmalig' };
export const KOSTENART_LABEL: Record<KostenArt, string> = { stelle: 'Stelle', tool: 'Software', miete: 'Miete', rate: 'Rate', sonstiges: 'Sonstiges' };
/** Reihenfolge der Auswahl „Wo“: UG zuerst (Standard neuer Bausteine), dann Selbstständigkeit, KD Ventures, Privat. */
export const BAUSTEIN_EINHEIT_LABEL: Record<BausteinEinheit, string> = { ug: finanzOrtName('ug'), kdc: finanzOrtName('kdc'), kdv: finanzOrtName('kdv'), privat: finanzOrtName('privat') };
// ── Dokument-Helfer ──────────────────────────────────────────────────────────
export const planszenarienVon = (d: Pick<FinanzDaten, 'planszenarien'>): Planszenario[] => (Array.isArray(d.planszenarien) ? d.planszenarien : []);
export const arbeitsplanVon = (d: Pick<FinanzDaten, 'planszenarien' | 'arbeitsplan'>): Planszenario | null =>
  (d.arbeitsplan ? planszenarienVon(d).find(p => p.id === d.arbeitsplan) ?? null : null);
/** Bereich der Finanzplanung (Privat/Business) — jeder darf ein eigenes Planszenario rechnen (`FinanzDaten.bereiche`). */
export type Bereich = 'privat' | 'business';
/** Hat der Bereich eine eigene Einstellung? (sonst gilt der gemeinsame Arbeitsplan) */
export const bereichEigen = (d: Pick<FinanzDaten, 'bereiche'>, b: Bereich): boolean => !!d.bereiche?.[b];
/** Das Planszenario, das ein Bereich rechnet: seine eigene Wahl (null = Basis), sonst der gemeinsame Arbeitsplan. */
export function arbeitsplanFuer(d: Pick<FinanzDaten, 'planszenarien' | 'arbeitsplan' | 'bereiche'>, b: Bereich): Planszenario | null {
  const e = d.bereiche?.[b];
  if (!e) return arbeitsplanVon(d);
  return e.arbeitsplan ? planszenarienVon(d).find(p => p.id === e.arbeitsplan) ?? null : null;
}
/**
 * Das Dokument, wie ein Bereich es sieht: `arbeitsplan` = die Wahl des Bereichs. Alles, was mit dem Arbeitsplan rechnet oder in ihn schreibt
 * (Blätter, Baukasten, Kennzahlen), folgt damit dem Bereich. Ohne eigene Einstellung dasselbe Dokument (dieselbe Referenz).
 */
export function mitBereich<T extends Pick<FinanzDaten, 'planszenarien' | 'arbeitsplan' | 'bereiche'>>(d: T, b: Bereich): T {
  const e = d.bereiche?.[b];
  if (!e || (e.arbeitsplan ?? null) === (d.arbeitsplan ?? null)) return d;
  return { ...d, arbeitsplan: e.arbeitsplan };
}

/** Treiber-Szenario zu einem Planszenario — sonst das aktive. */
export function treiberVon(d: Pick<FinanzDaten, 'szenarien' | 'aktiv'>, ps?: Planszenario | null): Szenario {
  return (ps && d.szenarien.find(s => s.id === ps.basis)) || d.szenarien.find(s => s.id === d.aktiv) || d.szenarien[0];
}

const fin = (v: unknown, sonst = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : sonst);

// ── Bausteine in Monatsreihen ────────────────────────────────────────────────
/** Betrag eines Bausteins im Plan-Monat m — 0, wenn aus, vor dem Start, nach der Laufzeit oder (jährlich) kein Zahlmonat. */
export function betragImMonat(b: Baustein, m: number): number {
  if (!b.an) return 0;
  const o = b.ueber?.[`m${m}`];
  if (o !== undefined) return fin(o);
  if (b.start < 1 || m < b.start) return 0;
  const betrag = fin(b.preis) * fin(b.menge, 1);
  if (b.rhythmus === 'einmalig') return m === b.start ? betrag : 0;
  if (b.laufzeit != null && b.laufzeit > 0 && m >= b.start + b.laufzeit) return 0;
  if (b.rhythmus === 'jaehrlich') return (m - b.start) % 12 === 0 ? betrag : 0;
  return betrag;
}

/** Alle Bausteine eines Szenarios zu Monatsreihen (Länge N) — Zahlungsziel verschiebt nur den Eingang. */
export function reihen(ps: Planszenario, N: number): Zusatz {
  const leer = () => new Array<number>(N).fill(0);
  const x: Required<Omit<Zusatz, 'umsatzZiel'>> = { ugUmsatz: leer(), ugEingang: leer(), ugPersonal: leer(), ugSach: leer(), ausschuettung: leer(), ausschuettungSteuer: leer(), privatEin: leer(), privatAus: leer(), kdvEin: leer(), kdvAus: leer(), kdcUmsatz: leer(), kdcEingang: leer(), kdcPersonal: leer(), kdcSach: leer(), kdcEntnahme: leer(), kdcEntnahmeAnteil: leer() };
  const vorgabeZiel = Math.max(0, Math.round(fin(ps.annahmen.zahlungsziel)));
  for (const b of ps.bausteine) {
    const ziel = Math.max(0, Math.round(fin(b.zahlungsziel, vorgabeZiel)));
    for (let m = 1; m <= N; m++) {
      const v = betragImMonat(b, m); if (!v) continue;
      const i = m - 1;
      const ort = b.einheit;
      if (b.art === 'umsatz') {
        if (ort === 'ug') { x.ugUmsatz[i] += v; if (i + ziel < N) x.ugEingang[i + ziel] += v; }
        else if (ort === 'kdc') { x.kdcUmsatz[i] += v; if (i + ziel < N) x.kdcEingang[i + ziel] += v; }
        else if (ort === 'privat') x.privatEin[i] += v;
        else x.kdvEin[i] += v;
      } else if (ort === 'ug') { if (b.kostenArt === 'stelle') x.ugPersonal[i] += v; else x.ugSach[i] += v; }
      else if (ort === 'kdc') { if (b.kostenArt === 'stelle') x.kdcPersonal[i] += v; else x.kdcSach[i] += v; }
      else if (ort === 'privat') x.privatAus[i] += v;
      else x.kdvAus[i] += v;
    }
  }
  const au = ps.annahmen.ausschuettung;
  if (au && fin(au.betrag) > 0 && au.ab >= 1) { const q = ausschuettungSteuerVon(ps.annahmen); for (let m = au.ab; m <= N; m++) { x.ausschuettung[m - 1] += au.betrag; x.ausschuettungSteuer[m - 1] += au.betrag * q; } }
  const en = ps.annahmen.entnahme;
  if (en && en.ab >= 1) {
    const betrag = Math.max(0, fin(en.betrag)), anteil = Math.max(0, Math.min(1, fin(en.anteil)));
    for (let m = en.ab; m <= N; m++) { x.kdcEntnahme[m - 1] += betrag; x.kdcEntnahmeAnteil[m - 1] += anteil; }
  }
  return x;
}

/** Annahmen des Dokuments mit den Szenario-Annahmen überlagert — nur gesetzte, endliche Werte greifen. */
export function annahmenMit(a: Annahmen, pa: PlanAnnahmen | undefined): Annahmen {
  if (!pa) return a;
  const n: Annahmen = { ...a };
  if (typeof pa.kevinBrutto === 'number' && Number.isFinite(pa.kevinBrutto)) n.kevinBrutto = pa.kevinBrutto;
  if (typeof pa.malinBrutto === 'number' && Number.isFinite(pa.malinBrutto)) n.malinBrutto = pa.malinBrutto;
  if (typeof pa.steuerUG === 'number' && Number.isFinite(pa.steuerUG)) n.steuerUG = Math.max(0, Math.min(1, pa.steuerUG));
  if (typeof pa.exitSteuer === 'number' && Number.isFinite(pa.exitSteuer)) n.exitSteuer = Math.max(0, Math.min(1, pa.exitSteuer));
  return n;
}

// ── Rechnen ──────────────────────────────────────────────────────────────────
export interface Gerechnet {
  d: FinanzDaten; ps: Planszenario | null; sz: Szenario; x?: Zusatz; ug: MonatUG[]; /** Selbstständigkeit (eigene Achse seit 02.10.). */ kdc: MonatSelbst[]; pr: MonatPrivat[]; kz: ReturnType<typeof kennzahlen>;
  /** Formelwerte der von Hand überschriebenen Zellen (`<kennung>:<monat>` → Formelwert, 04.10.) — für Tooltip und Abweichung. */
  formel: Formeln;
  /** Freies Geld der Gruppe je Monat (mit Handwert `g.frei`). */
  gruppe: number[];
  /** Lohneinkünfte je Kalenderjahr, die mit der Selbstständigkeit zusammen versteuert werden (05.10., `lohnJahre`). */
  lohn: Record<number, number>;
}

/**
 * Ein Planszenario rechnen: Dokument + Szenario-Annahmen + Bausteine → Kern.
 * `treiber` erzwingt ein anderes Treiber-Szenario (Vergleich der Treiber);
 * ohne Planszenario ist es der reine Treiber (= „Basis“).
 */
export function rechneMit(d: FinanzDaten, ps: Planszenario | null, treiber?: Szenario): Gerechnet {
  const sz = treiber ?? treiberVon(d, ps);
  // Szenario-Annahmen und Szenario-Steuern (Überlagerung je Gesellschaft) liegen über dem Dokument.
  // Handwerte „nur in diesem Szenario“ (`<kennung>@<szenario>:<monat>`) überlagern die allgemeinen — Vorrang Szenario › alle › Formel.
  const plan = planMitSzenario(d.plan, ps?.id);
  const dd = ps ? { ...d, ...(plan !== d.plan ? { plan } : {}), annahmen: annahmenMit(d.annahmen, ps.annahmen), ...(ps.annahmen.steuern ? { steuern: steuernMit(d.steuern, ps.annahmen.steuern) } : {}) } : d;
  // Umsatz von Hand zieht den Eingang mit — mit der Vorgabe des Zahlungsziels dieses Szenarios (fehlt: im selben Monat).
  const x = ps ? { ...reihen(ps, d.monate.length), umsatzZiel: ps.annahmen.zahlungsziel } : undefined;
  const formel: Formeln = {};
  const ug = rechneUG(dd, sz, x, formel);
  // Die Selbstständigkeit (seit 05.10. Teil von Privat) braucht die GmbH-Monate für die gemeinsame Einkommensteuer (Gehalt 1).
  const kdc = rechneSelbstAchse(dd, x, formel, ug);
  const pr = rechnePrivat(dd, ug, sz, x, kdc, formel);
  const gruppe = gruppeReihe(dd.plan, ug, pr, kdc, formel);
  return { d: dd, ps, sz, x, ug, kdc, pr, kz: kennzahlen(ug, pr, kdc, gruppe), formel, gruppe, lohn: lohnJahre(dd, ug) };
}

// ── Auswertung: Lage in drei Zahlen ──────────────────────────────────────────
/** Plan-Monat, in dem „jetzt“ liegt — vor Okt 26 der erste Planmonat, nach der Achse der letzte. */
export function jetztMonat(d: Pick<FinanzDaten, 'einstellungen' | 'monate'>): number {
  return Math.min(d.monate.length, Math.max(1, planMonat(`${d.einstellungen.heute.slice(0, 7)}-01`)));
}
/** Summe der bekannten Kontostände einer Einheit (Verpflichtungen › Kontostände) — Kern-Name oder Kennung der einen Liste (kdc = selbststaendigkeit). */
export function kontostand(d: Pick<FinanzDaten, 'posten'>, einheit: KernEinheit | FinanzOrt): { summe: number; bekannt: number; fehlen: number } {
  const e: KernEinheit = einheit === 'kdc' ? 'selbststaendigkeit' : einheit;
  const k = d.posten.filter(p => p.art === 'konto' && p.einheit === e);
  const b = k.filter(p => p.betrag != null);
  return { summe: b.reduce((s, p) => s + (p.betrag ?? 0), 0), bekannt: b.length, fehlen: k.length - b.length };
}

export interface Auswertung {
  m0: number;
  /** Frei verfügbar diesen Monat: MAKE frei (nach Steuer, USt) + KD Ventures (nach Steuerrücklage) + Selbstständigkeit (eigenes Konto nach Rücklage und USt) + Privat (Konten + Luft dieses Monats). */
  frei: { gesamt: number; ug: number; kdv: number; kdc: number; privat: number; privatLuft: number; privatKonten: number; kontenFehlen: number;
    /** 05.10.: Business = nur die Gesellschaften (MAKE + KD Ventures); Privat-Bereich = Privat + Selbstständigkeit. gesamt = business + privatBereich. */
    business: number; privatBereich: number };
  /** Monate ab jetzt, bis UG frei bzw. Privat (seit 05.10. mit dem freien Geld der Selbstständigkeit) unter null fällt — null: im Planzeitraum nicht. */
  runway: { ug: number | null; privat: number | null; horizont: number };
  ziele: { imPlan: number; knapp: number; gekippt: number; gesamt: number; staende: ZielStand[] };
  /** Laufende UG-Kosten je Monat (Personal inkl. Stellen, Sach, Holding) — so viel Umsatz braucht die UG mindestens. */
  mindestumsatz: { jetzt: number; schnitt12: number; umsatzSchnitt12: number };
  steuer: {
    /** Rücklage der MAKE Innovation GmbH; `ruecklageKdv`/`ruecklageKdc` die der anderen beiden Gesellschaften, `ruecklageGesamt` alle drei. */
    ruecklage: number; ruecklageKdv: number; ruecklageKdc: number; ruecklageGesamt: number;
    ust: number;
    /** Nächste Ertragsteuer-Zahlung aller drei Gesellschaften zusammen (Summe im frühesten Monat ab jetzt). */
    naechsteZahlung: { monat: number; betrag: number } | null;
    /** 05.10.: nur die Gesellschaften (MAKE + KD Ventures) — für die Business-Sicht; die Selbstständigkeit gehört zu Privat. */
    ruecklageBusiness: number; naechsteZahlungBusiness: { monat: number; betrag: number } | null;
    /** pauschale Steuer auf die Ausschüttung dieses Monats */ ausschuettung: number;
  };
  uebergaenge: { gehaelterNetto: number; gehaelterBrutto: number; /** brutto aus der UG */ ausschuettung: number; ausschuettungSteuer: number; ausschuettungNetto: number; /** Entnahme aus der Selbstständigkeit (schon versteuert) */ entnahme: number };
}

export function auswertung(d: FinanzDaten, ug: MonatUG[], pr: MonatPrivat[], kdc?: MonatSelbst[]): Auswertung {
  const N = ug.length, m0 = jetztMonat(d);
  const u0 = ug[m0 - 1], p0 = pr[m0 - 1], k0 = kdc?.[m0 - 1];
  const pk = kontostand(d, 'privat');
  const privat = pk.summe + p0.luft;
  const runwayAb = (test: (m: number) => boolean): number | null => { for (let m = m0; m <= N; m++) if (test(m)) return m - m0; return null; };
  let kum = 0; const privatKonto: number[] = [];
  // Runway Privat (05.10., Kevin: „Runway Privat zählt das Konto der Selbstständigkeit mit“): Privatkonten + aufgelaufene Luft + das, was
  // auf dem Konto der Selbstständigkeit frei ist (Konto − Steuerrücklage − offene USt, `frei` der Achse) — die Selbstständigkeit gehört zu
  // Privat. Die Entnahme zählt nicht doppelt: sie verlässt das Konto der Selbstständigkeit und kommt als Luft bei Privat an.
  for (let m = 1; m <= N; m++) { if (m >= m0) kum += pr[m - 1].luft; privatKonto[m - 1] = pk.summe + kum + (kdc?.[m - 1]?.frei ?? 0); }
  const runway = {
    ug: runwayAb(m => ug[m - 1].frei < -0.5),
    privat: runwayAb(m => privatKonto[m - 1] < -0.5),
    horizont: N - m0 + 1,
  };
  const staende = zielStaende(d, ug, pr, kdc);
  const imPlan = staende.filter(z => z.status === 'erreicht' || z.status === 'im Plan').length;
  const knapp = staende.filter(z => z.status === 'knapp').length;
  // Laufende Kosten (Mindestumsatz) — aus dem Kern (`laufend`, mit Handwert).
  const kosten = (u: MonatUG) => u.laufend ?? u.kevin + u.malin + u.unterstuetzung + u.stellen + u.sach + u.holding;
  const fenster = ug.slice(m0 - 1, m0 + 11);
  const schnitt = (f: (u: MonatUG) => number) => (fenster.length ? fenster.reduce((s, u) => s + f(u), 0) / fenster.length : 0);
  let naechste: Auswertung['steuer']['naechsteZahlung'] = null, naechsteB: Auswertung['steuer']['naechsteZahlung'] = null;
  for (let m = m0; m <= N; m++) {
    const zahl = ug[m - 1].steuer + ug[m - 1].kdvSt.zahlung + (kdc?.[m - 1]?.st.zahlung ?? 0);
    if (zahl > 0.005) { naechste = { monat: m, betrag: zahl }; break; }
  }
  for (let m = m0; m <= N; m++) {
    const zahl = ug[m - 1].steuer + ug[m - 1].kdvSt.zahlung;
    if (zahl > 0.005) { naechsteB = { monat: m, betrag: zahl }; break; }
  }
  return {
    m0,
    frei: { gesamt: u0.frei + u0.kdvFrei + (k0?.frei ?? 0) + privat, ug: u0.frei, kdv: u0.kdvFrei, kdc: k0?.frei ?? 0, privat, privatLuft: p0.luft, privatKonten: pk.summe, kontenFehlen: pk.fehlen,
      business: u0.frei + u0.kdvFrei, privatBereich: privat + (k0?.frei ?? 0) },
    runway,
    ziele: { imPlan, knapp, gekippt: staende.length - imPlan - knapp, gesamt: staende.length, staende },
    mindestumsatz: { jetzt: kosten(u0), schnitt12: schnitt(kosten), umsatzSchnitt12: schnitt(u => u.umsatz) },
    steuer: { ruecklage: u0.steuerRuecklage, ruecklageKdv: u0.kdvSt.ruecklage, ruecklageKdc: k0?.steuerRuecklage ?? 0, ruecklageGesamt: u0.steuerRuecklage + u0.kdvSt.ruecklage + (k0?.steuerRuecklage ?? 0), ust: u0.ustOffen + (k0?.ustOffen ?? 0), naechsteZahlung: naechste, ausschuettung: p0.ausschuettungSteuer,
      ruecklageBusiness: u0.steuerRuecklage + u0.kdvSt.ruecklage, naechsteZahlungBusiness: naechsteB },
    uebergaenge: { gehaelterNetto: p0.kevinNetto + p0.malinNetto, gehaelterBrutto: u0.kevinBrutto + u0.malinBrutto, ausschuettung: u0.ausschuettung, ausschuettungSteuer: p0.ausschuettungSteuer, ausschuettungNetto: p0.ausschuettung, entnahme: p0.entnahme },
  };
}

// ── Was jetzt zu entscheiden ist ─────────────────────────────────────────────
export interface Entscheidung { id: string; stufe: 'kritisch' | 'achtung' | 'info'; text: string; hinweis?: string; ziel: { u: Unterseite; params?: Record<string, string> } }

const RANG: Record<Entscheidung['stufe'], number> = { kritisch: 0, achtung: 1, info: 2 };

/** Konkrete Punkte aus den Zahlen — jeder mit Sprung ins passende Feld. Höchstens `max`, kritisch zuerst. */
/** `business` (05.10.): die Steuerzahlung nur der Gesellschaften — die Selbstständigkeit gehört zu Privat. */
export function entscheidungen(d: FinanzDaten, g: Pick<Gerechnet, 'ug' | 'pr' | 'ps'>, aw: Auswertung, max = 6, business = false): Entscheidung[] {
  const { ug, pr } = g;
  const sw = schwellenVon(d);
  const out: Entscheidung[] = [];
  const monat = (m: number) => d.monate[m - 1] ?? `Monat ${m}`;
  const psParam: Record<string, string> = g.ps ? { sz: g.ps.id } : {};
  const minus = ug.filter(u => u.frei < -0.5);
  if (minus.length) {
    const tief = ug.reduce((a, u) => (u.frei < a.frei ? u : a), ug[0]);
    out.push({ id: 'ug-minus', stufe: 'kritisch', text: `${UG_KURZ} ab ${monat(minus[0].m)} unter null frei — Tiefpunkt ${eur(tief.frei)} € im ${monat(tief.m)}.`, hinweis: 'Umsatzbaustein anlegen (Kunde × Produkt × Preis) oder Kosten und Gehälter im Szenario senken.', ziel: { u: 'planen', params: { ...psParam, feld: 'umsatz' } } });
  }
  const eng = pr.filter(p => p.luft < -0.5);
  if (eng.length) out.push({ id: 'privat-minus', stufe: 'kritisch', text: `Privat in ${eng.length} Monaten im Minus — erster ${monat(eng[0].m)} (${eur(eng[0].luft)} €).`, hinweis: `Fixkosten und Raten prüfen, Ausschüttung aus der ${UG_NAME} oder Gehalt im Szenario anpassen.`, ziel: { u: 'planen', params: { ...psParam, feld: 'privat' } } });
  else if (aw.runway.privat != null && aw.runway.privat < sw.runwayWarnMonate) out.push({ id: 'privat-runway', stufe: 'achtung', text: `Privat trägt noch ${aw.runway.privat} Monate, dann rutschen die Konten unter null.`, ziel: { u: 'privat' } });
  if (!minus.length && aw.runway.ug != null && aw.runway.ug < sw.runwayWarnMonate) out.push({ id: 'ug-runway', stufe: 'achtung', text: `${UG_KURZ}-Runway ${aw.runway.ug} Monate — danach fehlt frei verfügbares Geld.`, ziel: { u: 'planen', params: { ...psParam, feld: 'umsatz' } } });
  if (aw.mindestumsatz.umsatzSchnitt12 < aw.mindestumsatz.schnitt12 - 0.5) out.push({ id: 'mindestumsatz', stufe: 'achtung', text: `Umsatz der nächsten 12 Monate (Ø ${eur(aw.mindestumsatz.umsatzSchnitt12)} €) liegt unter den laufenden ${UG_KURZ}-Kosten (Ø ${eur(aw.mindestumsatz.schnitt12)} €).`, hinweis: 'Mindestumsatz je Monat = Personal + Sachkosten + Holding. Was fehlt, kommt aus Kapital oder Bausteinen.', ziel: { u: 'gesamt' } });
  for (const z of aw.ziele.staende.filter(z => z.status === 'verfehlt').slice(0, 2)) out.push({ id: `ziel-${z.ziel.id}`, stufe: 'achtung', text: `Ziel „${z.ziel.name}“ kippt: ${eur(z.ziel.ziel)} € bis ${z.ziel.bis.slice(5)}/${z.ziel.bis.slice(2, 4)} wird im Plan nicht erreicht.`, ziel: { u: 'ziele' } });
  for (const z of aw.ziele.staende.filter(z => z.status === 'knapp').slice(0, 1)) out.push({ id: `ziel-${z.ziel.id}`, stufe: 'info', text: `Ziel „${z.ziel.name}“ ist knapp — erreicht ${z.erreichtMonat ? monat(z.erreichtMonat) : '—'}.`, ziel: { u: 'ziele' } });
  const nz = business ? aw.steuer.naechsteZahlungBusiness : aw.steuer.naechsteZahlung;
  if (nz && nz.monat - aw.m0 <= 3) out.push({ id: 'steuer', stufe: 'info', text: `${business ? 'Ertragsteuer der Gesellschaften' : 'Steuern (Gesellschaften und Einkommensteuer)'} im ${monat(nz.monat)}: ${eur(nz.betrag)} € (Näherung, keine Steuerberatung) — Rücklage prüfen.`, ziel: { u: 'toepfe' } });
  if (aw.frei.kontenFehlen) out.push({ id: 'konten', stufe: 'info', text: `${aw.frei.kontenFehlen} private Kontostände fehlen — „frei verfügbar“ ist bis dahin eine Schätzung.`, ziel: { u: 'posten' } });
  const offen = d.buchungen.filter(b => b.z === 'x.offen').length;
  if (offen >= sw.buchungenOffen) out.push({ id: 'buchungen', stufe: 'info', text: `${offen} Buchungen ohne Zuordnung — das IST ist unscharf.`, ziel: { u: 'buchungen' } });
  if (!g.ps) out.push({ id: 'arbeitsplan', stufe: 'info', text: 'Noch kein Arbeitsplan markiert — die Zahlen zeigen den reinen Treiber.', hinweis: 'In der Planungsrunde ein Szenario bauen, vergleichen und als Arbeitsplan setzen.', ziel: { u: 'planen' } });
  return out.sort((a, b) => RANG[a.stufe] - RANG[b.stufe]).slice(0, max);
}

// ── Vergleich nebeneinander ──────────────────────────────────────────────────
export interface VergleichSpalte {
  id: string | null; name: string; treiber: string; ps: Planszenario | null;
  g: Gerechnet; aw: Auswertung;
}
/** Bis zu `max` Szenarien nebeneinander — `null` steht für die Basis (reiner Treiber). */
export function vergleich(d: FinanzDaten, liste: (Planszenario | null)[], max = 3): VergleichSpalte[] {
  return liste.slice(0, max).map(ps => {
    const g = rechneMit(d, ps);
    return { id: ps?.id ?? null, name: ps?.name ?? 'Basis', treiber: g.sz.name, ps, g, aw: auswertung(g.d, g.ug, g.pr, g.kdc) };
  });
}

// ── Anlegen und prüfen ───────────────────────────────────────────────────────
export function neuesPlanszenario(id: string, name: string, basis: string, jetzt: string): Planszenario {
  return { id, name, basis, bausteine: [], annahmen: {}, angelegt: jetzt };
}
export function neuerBaustein(id: string, teil: Partial<Baustein> & Pick<Baustein, 'art'>): Baustein {
  const b: Baustein = { id, art: teil.art, einheit: teil.einheit ?? 'ug', name: teil.name ?? (teil.art === 'umsatz' ? 'Neuer Umsatz' : 'Neue Kosten'), preis: fin(teil.preis), menge: fin(teil.menge, 1), rhythmus: teil.rhythmus ?? 'monatlich', start: Math.max(1, Math.round(fin(teil.start, 1))), an: teil.an ?? true };
  if (teil.laufzeit != null) b.laufzeit = teil.laufzeit;
  if (teil.kunde) b.kunde = teil.kunde;
  if (teil.produkt) b.produkt = teil.produkt;
  if (teil.produktId) b.produktId = teil.produktId;
  if (teil.art === 'kosten') b.kostenArt = teil.kostenArt ?? 'sonstiges';
  if (teil.zahlungsziel != null) b.zahlungsziel = teil.zahlungsziel;
  if (teil.regler) b.regler = teil.regler;
  if (teil.notiz) b.notiz = teil.notiz;
  return b;
}
/** Lesbarer Kurzname: „Muster AG · Retainer · 3 × 1.500 € monatlich ab Nov 26“. */
export function bausteinText(b: Baustein, monate: string[]): string {
  const teile = [b.art === 'umsatz' ? [b.kunde, b.produkt].filter(Boolean).join(' · ') || b.name : b.name];
  teile.push(`${b.menge !== 1 ? `${eur(b.menge)} × ` : ''}${eur(b.preis)} € ${RHYTHMUS_LABEL[b.rhythmus]}`);
  teile.push(`ab ${monate[b.start - 1] ?? `Monat ${b.start}`}${b.laufzeit && b.rhythmus !== 'einmalig' ? ` · ${b.laufzeit} Monate` : ''}`);
  return teile.join(' · ');
}

const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const RHYTHMEN: Rhythmus[] = ['monatlich', 'jaehrlich', 'einmalig'];
const KOSTENARTEN: KostenArt[] = ['stelle', 'tool', 'miete', 'rate', 'sonstiges'];
// Unbekanntes → ug wie bisher (ältere Fassungen lesen kdc ebenso als ug — gleiche Rechnung, Rückweg ohne Verlust).
const EINHEITEN: BausteinEinheit[] = ['ug', 'kdc', 'privat', 'kdv'];
const REGLER: Regler[] = ['umsatz', 'miete', 'rate'];
const text = (v: unknown, n = 120): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined);

/** Einen Baustein aus rohen Daten bereinigen — null, wenn unbrauchbar. */
export function pruefeBaustein(roh: unknown): Baustein | null {
  if (!istObjekt(roh) || typeof roh.id !== 'string' || !roh.id) return null;
  const art: BausteinArt = roh.art === 'kosten' ? 'kosten' : 'umsatz';
  const b: Baustein = {
    id: roh.id.slice(0, 60), art, einheit: EINHEITEN.includes(roh.einheit as BausteinEinheit) ? (roh.einheit as BausteinEinheit) : 'ug',
    name: text(roh.name) ?? (art === 'umsatz' ? 'Umsatz' : 'Kosten'), preis: fin(roh.preis), menge: fin(roh.menge, 1),
    rhythmus: RHYTHMEN.includes(roh.rhythmus as Rhythmus) ? (roh.rhythmus as Rhythmus) : 'monatlich',
    start: Math.max(1, Math.round(fin(roh.start, 1))), an: roh.an !== false,
  };
  const laufzeit = fin(roh.laufzeit, NaN); if (Number.isFinite(laufzeit) && laufzeit > 0) b.laufzeit = Math.round(laufzeit);
  const ziel = fin(roh.zahlungsziel, NaN); if (Number.isFinite(ziel) && ziel >= 0) b.zahlungsziel = Math.round(ziel);
  const kunde = text(roh.kunde); if (kunde) b.kunde = kunde;
  const produkt = text(roh.produkt); if (produkt) b.produkt = produkt;
  const produktId = text(roh.produktId, 64); if (produktId && art === 'umsatz') b.produktId = produktId;
  if (art === 'kosten') b.kostenArt = KOSTENARTEN.includes(roh.kostenArt as KostenArt) ? (roh.kostenArt as KostenArt) : 'sonstiges';
  if (REGLER.includes(roh.regler as Regler)) b.regler = roh.regler as Regler;
  const notiz = text(roh.notiz, 600); if (notiz) b.notiz = notiz;
  if (istObjekt(roh.ueber)) {
    const ueber: Record<string, number> = {};
    for (const [k, v] of Object.entries(roh.ueber)) if (/^m\d{1,3}$/.test(k) && typeof v === 'number' && Number.isFinite(v)) ueber[k] = v;
    if (Object.keys(ueber).length) b.ueber = ueber;
  }
  return b;
}

/** Planszenarien aus rohen Daten — unbrauchbare Einträge fallen still weg (ältere Dokumente haben keine). */
export function pruefePlanszenarien(roh: unknown, treiberIds: string[]): Planszenario[] {
  if (!Array.isArray(roh)) return [];
  const out: Planszenario[] = [];
  for (const s of roh) {
    if (!istObjekt(s) || typeof s.id !== 'string' || !s.id || out.some(o => o.id === s.id)) continue;
    const a = istObjekt(s.annahmen) ? s.annahmen : {};
    const annahmen: PlanAnnahmen = {};
    for (const k of ['kevinBrutto', 'malinBrutto', 'steuerUG', 'zahlungsziel'] as const) { const v = fin(a[k], NaN); if (Number.isFinite(v)) annahmen[k] = v; }
    const q = fin(a.ausschuettungSteuer, NaN); if (Number.isFinite(q)) annahmen.ausschuettungSteuer = Math.max(0, Math.min(1, q));
    if (istObjekt(a.ausschuettung) && Number.isFinite(fin(a.ausschuettung.betrag, NaN))) annahmen.ausschuettung = { betrag: fin(a.ausschuettung.betrag), ab: Math.max(1, Math.round(fin(a.ausschuettung.ab, 1))) };
    const ex = fin(a.exitSteuer, NaN); if (Number.isFinite(ex)) annahmen.exitSteuer = Math.max(0, Math.min(1, ex));
    if (istObjekt(a.entnahme)) {
      const b = fin(a.entnahme.betrag, NaN), q = fin(a.entnahme.anteil, NaN);
      if (Number.isFinite(b) || Number.isFinite(q)) annahmen.entnahme = { ...(Number.isFinite(b) ? { betrag: Math.max(0, b) } : {}), ...(Number.isFinite(q) ? { anteil: Math.max(0, Math.min(1, q)) } : {}), ab: Math.max(1, Math.round(fin(a.entnahme.ab, 1))) };
    }
    const stn = pruefeSteuern(a.steuern); if (stn) annahmen.steuern = stn;
    const basis = typeof s.basis === 'string' && treiberIds.includes(s.basis) ? s.basis : treiberIds[0];
    const ps: Planszenario = {
      id: s.id.slice(0, 60), name: text(s.name, 80) ?? 'Szenario', basis,
      bausteine: (Array.isArray(s.bausteine) ? s.bausteine : []).map(pruefeBaustein).filter((b): b is Baustein => !!b),
      annahmen, angelegt: typeof s.angelegt === 'string' ? s.angelegt : '',
    };
    const notiz = text(s.notiz, 2000); if (notiz) ps.notiz = notiz;
    out.push(ps);
  }
  return out;
}

/** Steuerhinweis für jede Stelle, die Steuer zeigt — ein Satz, überall gleich. */
export const STEUER_HINWEIS = 'Steuern sind Näherungen aus den Annahmen — Hinweis, keine Steuerberatung.';

/** Kalendermonat eines Plan-Monats als Text („Juni“) — für Sätze in der Lage. */
export const kalMonatName = (m: number): string => ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][kalMonat(m) - 1];
