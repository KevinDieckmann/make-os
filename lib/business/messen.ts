// ─── Business-Index — messen (rein, getestet) ───────────────────────────────
// Jede Kennzahl aus dem Bestand, getrennt nach Sicht (gesamt · Consulting ·
// KD Ventures). Privates zählt nie. Fehlt etwas, gibt es keinen Schätzwert,
// sondern eine Messlücke.
//
// Ist-Zahlen je Monat (Umsatz, Kosten, Personal …) in dieser Reihenfolge:
//   1. Monatsabschluss (von euch eingetragen, je Firma) — die belastbarste Zahl
//   2. Grundlage (V1-Export der Selbständigkeit) — nur für Consulting
//   3. Controlling (Monatsumsatz/-kosten) — nur für die Gesamtsicht

import type { Scope, Schwelle } from './register';
import type { FinanceState } from '@/lib/make-one/finance-data';
import { computeMetrics } from '@/lib/make-one/finance-data';
import type { Firma, Rechnung, Zahlung, Merkposten, Planposten } from '@/lib/make-one/liquiditaet';
import { vorschau, nurBusiness, businessFirmen } from '@/lib/make-one/liquiditaet';
import type { Mandat, Chance } from '@/lib/crm/typen';
import { gewinnquote, prognose, gesamtwert, wahrscheinlichkeit, OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { markttraktion } from '@/lib/crm/adresse';
import { WEG } from '@/lib/wege';

export interface Monatsabschluss {
  firma: 'kdc' | 'kdv';
  /** YYYY-MM */
  monat: string;
  umsatz?: number; kosten?: number; personal?: number; marketingVertrieb?: number; afa?: number;
  /** Fakturierte Beratertage im Monat — für Auslastung und effektiven Tagessatz. */
  fakturierteTage?: number;
  eigenkapital?: number; bilanzsumme?: number; kurzfrVerbindlichkeiten?: number; bankschulden?: number;
  notiz?: string; von?: string; am?: string;
}

export interface Bestand {
  heute: string;
  scope: Scope;
  firmen: Firma[];
  rechnungen: (Rechnung & { firmaId?: string })[];
  zahlungen: Zahlung[];
  merkposten: Merkposten[];
  planposten: Planposten[];
  finance: FinanceState | null;
  /** Consulting-Ist aus dem V1-Export: Monat → Netto */
  grundlageMonate: { monat: string; umsatzNetto: number; kostenNetto: number }[];
  /** Wiederkehrende Fixkosten je Monat aus dem V1-Export (Selbständigkeit → Consulting, UG → KD Ventures).
   *  Die Kredite im V1-Export sind PRIVAT und fließen hier nie ein. */
  grundlageFixkosten: Partial<Record<'kdc' | 'kdv', number>>;
  abschluesse: Monatsabschluss[];
  mandate: Mandat[];
  chancen: Chance[];
  traktion: { score: number | null; text: string; welten?: { id: string; label: string; score: number | null }[] };
  /** Kalender: Termine mit Uhrzeit (Wandzeit), owner kevin|malin|both */
  termine: { start: string; ende: string; owner?: string }[];
  /** true = der Kalender-Stand reicht mindestens 4 Wochen zurück (iCloud); der Mac-Stand nur einen Tag. */
  termineVollstaendig: boolean;
  /** Planer-Blöcke der letzten Wochen */
  bloecke: { date: string; dauerMin: number; art: string }[];
  auftraege: { status: string; beendet?: string; zeit?: string; anlass?: string; name?: string; auftrag?: string }[];
  meilensteine: { id?: string; titel?: string; bereich: string; faellig?: string; fortschritt: number; erledigt: boolean }[];
  fte: Partial<Record<'kdc' | 'kdv', number>>;
  /** MRR-Schnappschüsse: Monat → Kunde → MRR (nur diese Sicht) */
  mrrVerlauf: Record<string, Record<string, number>>;
  /** Jahresumsatzziel je Firma (Feinjustierung); gesamt kommt aus dem Controlling. */
  ziele?: Partial<Record<'kdc' | 'kdv', number>>;
  /** Verfügbare Beratertage je Monat und Firma (Kapazität) — für die Auslastung. */
  kapazitaet?: Partial<Record<'kdc' | 'kdv', number>>;
  /** Eigene Schwellen dieser Sicht (Feinjustierung) — überschreiben den Standard. */
  schwellen?: Record<string, Schwelle>;
}

export type { Messung, Detail } from '@/lib/kennzahlen/kern';
import type { Messung, Detail, Ampel } from '@/lib/kennzahlen/kern';

// ── Hilfen ──────────────────────────────────────────────────────────────────

const monat = (tag: string) => tag.slice(0, 7);
function monatPlus(m: string, n: number): string {
  const [j, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(j, mo - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
const tageZwischen = (a: string, b: string) => Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
export const euro = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n));
const zahl = (n: number, s = 1) => n.toLocaleString('de-DE', { maximumFractionDigits: s, minimumFractionDigits: 0 });
const pz = (n: number) => `${zahl(n, 1)} %`;
const FIRMEN_LABEL: Record<string, string> = { kdc: 'Consulting', kdv: 'KD Ventures' };

/** Gehört ein Posten zu dieser Sicht? (Privates ist vorher schon raus.) Ohne Firma → gesamt und Consulting (ältere Einträge). */
function inSicht(firmaId: string | undefined, scope: Scope): boolean {
  if (scope === 'gesamt') return true;
  return (firmaId ?? 'kdc') === scope;
}
const gesellschaftInSicht = (g: string | undefined, scope: Scope) => scope === 'gesamt' || g === scope;

export interface IstMonat { monat: string; umsatz: number; kosten: number; personal?: number; marketingVertrieb?: number; afa?: number; fakturierteTage?: number; quelle: string }

/**
 * Die abgeschlossenen Ist-Monate der Sicht (höchstens 12, vor dem laufenden
 * Monat), aus der besten vorhandenen Quelle je Monat.
 */
export function istMonate(b: Bestand): IstMonat[] {
  const aktuell = monat(b.heute);
  const fenster = Array.from({ length: 12 }, (_, i) => monatPlus(aktuell, -12 + i));
  const firmen: ('kdc' | 'kdv')[] = b.scope === 'gesamt' ? ['kdc', 'kdv'] : [b.scope];
  const raus: IstMonat[] = [];
  for (const m of fenster) {
    const je = firmen.map(f => {
      const a = b.abschluesse.find(x => x.firma === f && x.monat === m && (x.umsatz != null || x.kosten != null));
      if (a) return { umsatz: a.umsatz ?? 0, kosten: a.kosten ?? 0, personal: a.personal, marketingVertrieb: a.marketingVertrieb, afa: a.afa, fakturierteTage: a.fakturierteTage, quelle: 'Monatsabschluss' };
      if (f === 'kdc') { const g = b.grundlageMonate.find(x => x.monat === m); if (g) return { umsatz: g.umsatzNetto, kosten: g.kostenNetto, quelle: 'Grundlage' }; }
      return null;
    });
    const da = je.filter((x): x is NonNullable<typeof x> => !!x);
    const summe = (k: 'personal' | 'marketingVertrieb' | 'afa' | 'fakturierteTage') => da.some(x => x[k] != null) ? da.reduce((s, x) => s + (x[k] ?? 0), 0) : undefined;
    const ausFirmen = (): IstMonat => ({ monat: m, umsatz: da.reduce((s, x) => s + x.umsatz, 0), kosten: da.reduce((s, x) => s + x.kosten, 0), personal: summe('personal'), marketingVertrieb: summe('marketingVertrieb'), afa: summe('afa'), fakturierteTage: summe('fakturierteTage'), quelle: Array.from(new Set(da.map(x => x.quelle))).join(' + ') });
    // Eine Firma, oder alle Firmen vollständig: deren Zahlen.
    if (da.length && da.length === firmen.length) { raus.push(ausFirmen()); continue; }
    // Gesamtsicht mit Lücken: erst das Controlling (euer Gesamt-Ist), sonst die Firmen, die es gibt.
    if (b.scope === 'gesamt') {
      const r = b.finance && Number(m.slice(0, 4)) === b.finance.jahr ? b.finance.months?.[Number(m.slice(5, 7)) - 1] : undefined;
      if (r && ((r.umsatz || 0) > 0 || (r.kosten || 0) > 0)) { raus.push({ monat: m, umsatz: r.umsatz || 0, kosten: r.kosten || 0, quelle: 'Controlling' }); continue; }
      if (da.length) raus.push({ ...ausFirmen(), quelle: `${ausFirmen().quelle} (nur ${da.length} von ${firmen.length} Firmen)` });
    }
  }
  return raus;
}

const quellenText = (l: IstMonat[]) => `${l.length} Monat${l.length === 1 ? '' : 'e'} (${Array.from(new Set(l.flatMap(x => x.quelle.split(' + ')))).join(', ')})`;

function kasse(b: Bestand): { betrag: number; konten: number } | null {
  const k = businessFirmen(b.firmen).filter(f => (b.scope === 'gesamt' || f.id === b.scope) && typeof f.kontostand === 'number');
  return k.length ? { betrag: k.reduce((s, f) => s + (f.kontostand as number), 0), konten: k.length } : null;
}

/** Monatliche Kosten: Ø der letzten 3 Ist-Monate, sonst die geplanten wiederkehrenden Kosten. */
function monatsKosten(b: Bestand): { betrag: number; quelle: string } | null {
  const ist = istMonate(b).slice(-3).filter(m => m.kosten > 0);
  if (ist.length) return { betrag: ist.reduce((s, m) => s + m.kosten, 0) / ist.length, quelle: `Ø Kosten ${ist.length} Monat${ist.length === 1 ? '' : 'e'}` };
  const plan = wiederkehrendeKosten(b);
  return plan ? { betrag: plan, quelle: 'geplante wiederkehrende Kosten' } : null;
}

const MONATSFAKTOR: Record<string, number> = { monatlich: 1, quartal: 1 / 3, jaehrlich: 1 / 12 };
const istAusgabe = (p: Planposten) => p.betrag < 0;

const postenMonat = (p: Planposten) => Math.abs(p.betrag) * (MONATSFAKTOR[p.rhythmus] ?? 0);

/** Wiederkehrende geplante Ausgaben dieser Sicht, die heute laufen — optional nur eine Kategorie. */
function wiederkehrendePosten(b: Bestand, kategorie?: string): Planposten[] {
  return nurBusiness(b.planposten).filter(p => inSicht(p.firmaId, b.scope) && istAusgabe(p) && p.rhythmus !== 'einmalig' && p.ab <= b.heute && (!p.bis || p.bis >= b.heute) && (!kategorie || p.kategorie === kategorie));
}

/** Wiederkehrende geplante Kosten je Monat (Planposten dieser Sicht, aktiv heute; sonst die Fixkosten aus dem V1-Export). */
function wiederkehrendeKosten(b: Bestand): number | null {
  const l = wiederkehrendePosten(b);
  if (l.length) return l.reduce((s, p) => s + postenMonat(p), 0);
  const g = b.scope === 'gesamt' ? (b.grundlageFixkosten.kdc ?? 0) + (b.grundlageFixkosten.kdv ?? 0) : b.grundlageFixkosten[b.scope] ?? 0;
  return g > 0 ? g : null;
}

/** Die Fixkosten je Monat einer Sicht (für Break-even und das Geschäftsmodell). */
export const fixkostenDer = (b: Bestand) => wiederkehrendeKosten(b);

/** Geplante Ausgaben, die in einen Monat fallen (je Posten mit Betrag) — null, wenn gar nichts geplant ist. */
function geplantePostenIm(b: Bestand, m: string, kategorie?: string): { p: Planposten; betrag: number }[] | null {
  const l = nurBusiness(b.planposten).filter(p => inSicht(p.firmaId, b.scope) && istAusgabe(p) && (!kategorie || p.kategorie === kategorie));
  if (!l.length) return null;
  const raus: { p: Planposten; betrag: number }[] = [];
  for (const p of l) {
    if (p.ab.slice(0, 7) > m || (p.bis && p.bis.slice(0, 7) < m)) continue;
    if (p.rhythmus === 'einmalig') { if (p.ab.slice(0, 7) === m) raus.push({ p, betrag: Math.abs(p.betrag) }); continue; }
    const seit = (Number(m.slice(0, 4)) - Number(p.ab.slice(0, 4))) * 12 + (Number(m.slice(5, 7)) - Number(p.ab.slice(5, 7)));
    if (p.rhythmus === 'monatlich' || (p.rhythmus === 'quartal' && seit % 3 === 0) || (p.rhythmus === 'jaehrlich' && seit % 12 === 0)) raus.push({ p, betrag: Math.abs(p.betrag) });
  }
  return raus;
}

const offeneRechnungen = (b: Bestand) => nurBusiness(b.rechnungen).filter(r => inSicht(r.firmaId, b.scope) && r.status === 'gestellt');
const aktiveMandate = (b: Bestand) => b.mandate.filter(m => gesellschaftInSicht(m.gesellschaft, b.scope));
const chancenInSicht = (b: Bestand) => b.chancen.filter(c => gesellschaftInSicht(c.gesellschaft, b.scope));

function letzterAbschluss(b: Bestand, feld: keyof Monatsabschluss): { wert: number; monat: string } | null {
  const firmen: ('kdc' | 'kdv')[] = b.scope === 'gesamt' ? ['kdc', 'kdv'] : [b.scope];
  const je = firmen.map(f => b.abschluesse.filter(a => a.firma === f && typeof a[feld] === 'number').sort((x, y) => y.monat.localeCompare(x.monat))[0]);
  if (je.some(x => !x)) return null;
  return { wert: je.reduce((s, a) => s + (a![feld] as number), 0), monat: je.map(a => a!.monat).sort()[0] };
}

// ── Punkte hinter den Kennzahlen (Kevin, 25.09.: „dahinter wieder 2–3 Punkte“) ─
// Jede Messung nennt die Einträge, aus denen sie besteht — mit Weg dorthin,
// wo man handelt: die überfällige Rechnung, der Kunde, der Monat, der Posten.

const tagKurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
const MONATSNAMEN = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const monatKurz = (m: string) => `${MONATSNAMEN[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
/** Geltende Grenzen einer Kennzahl (eigene Schwelle vor Standard) — für die Ampel der Punkte. */
const grenzen = (b: Bestand, id: string, gruen: number, rot: number) => b.schwellen?.[id] ?? { gruen, rot };
function ampelVon(w: number, g: { gruen: number; rot: number }): Ampel {
  const hoch = g.gruen >= g.rot;
  return hoch ? (w >= g.gruen ? 'gruen' : w < g.rot ? 'rot' : 'gelb') : (w <= g.gruen ? 'gruen' : w > g.rot ? 'rot' : 'gelb');
}

function kontenDetails(b: Bestand): Detail[] {
  return businessFirmen(b.firmen).filter(f => b.scope === 'gesamt' || f.id === b.scope).map(f => {
    const da = typeof f.kontostand === 'number';
    const alt = da && f.stand ? tageZwischen(f.stand, b.heute) : null;
    return {
      titel: `Konto ${FIRMEN_LABEL[f.id] ?? f.name}`, wert: da ? euro(f.kontostand as number) : 'fehlt',
      unter: !da ? 'Kontostand eintragen' : f.stand ? `Stand ${tagKurz(f.stand)}${alt != null && alt > 14 ? ` — ${alt} Tage alt` : ''}` : 'ohne Datum',
      href: WEG.kontostaende(), ...(!da ? { ampel: 'grau' as Ampel } : alt != null && alt > 14 ? { ampel: 'gelb' as Ampel } : {}),
    };
  });
}
const kostenDetail = (b: Bestand, mk: { betrag: number; quelle: string }): Detail =>
  ({ titel: 'Monatliche Kosten', wert: `${euro(mk.betrag)}/Monat`, unter: mk.quelle, href: mk.quelle.startsWith('Ø') ? WEG.abschluss(b.scope) : WEG.planposten() });
const monatsWeg = (b: Bestand, m: IstMonat) => (m.quelle === 'Grundlage' ? WEG.grundlage() : m.quelle === 'Controlling' ? WEG.controlling() : WEG.abschluss(b.scope));
const monatDetail = (b: Bestand, m: IstMonat, wert?: string, ampel?: Ampel): Detail =>
  ({ titel: monatKurz(m.monat), wert: wert ?? euro(m.umsatz - m.kosten), unter: `Umsatz ${euro(m.umsatz)} · Kosten ${euro(m.kosten)} · ${m.quelle}`, href: monatsWeg(b, m), ...(ampel ? { ampel } : {}) });
const rechnungDetail = (r: Rechnung, unter: string, ampel?: Ampel): Detail =>
  ({ titel: `${r.kunde}${r.nummer ? ` · ${r.nummer}` : ''}`, wert: euro(r.betrag), unter, href: WEG.rechnung(r.id), ...(ampel ? { ampel } : {}) });
/** Das Mandat, auf das ein Kunde verlinkt (laufendes zuerst). */
function mandatVon(b: Bestand, kunde: string): string | undefined {
  const l = aktiveMandate(b).filter(m => m.kunde === kunde);
  return (l.find(m => m.status === 'aktiv') ?? l.find(m => m.status !== 'beendet') ?? l[0])?.id;
}
const kundeDetail = (b: Bestand, kunde: string, wert: string, unter?: string, ampel?: Ampel): Detail =>
  ({ titel: kunde, wert, ...(unter ? { unter } : {}), href: WEG.mandat(mandatVon(b, kunde)), ...(ampel ? { ampel } : {}) });
const postenDetail = (p: Planposten, unter?: string): Detail =>
  ({ titel: p.titel, wert: `${euro(Math.abs(p.betrag) * (MONATSFAKTOR[p.rhythmus] ?? 0) || Math.abs(p.betrag))}${p.rhythmus === 'einmalig' ? '' : '/Monat'}`, unter: unter ?? RHYTHMUS[p.rhythmus] ?? p.rhythmus, href: WEG.planposten(p.id) });
const RHYTHMUS: Record<string, string> = { monatlich: 'monatlich', quartal: 'je Quartal', jaehrlich: 'jährlich', einmalig: 'einmalig' };
const dealDetail = (c: Chance, wert: string, unter: string, ampel?: Ampel): Detail =>
  ({ titel: c.titel, wert, unter, href: WEG.deal(c.id), ...(ampel ? { ampel } : {}) });
/** Die letzten vier Wochen (älteste zuerst), je mit Montag und Tagesgrenzen. */
function vierWochen(heute: string): { von: string; bis: string }[] {
  return [0, 1, 2, 3].map(i => ({ von: tagMinus(heute, 28 - 7 * i), bis: tagMinus(heute, 22 - 7 * i) }));
}

// ── Die Kennzahlen ──────────────────────────────────────────────────────────

/** Die Geschäftsmodell-Kennzahlen (25.09., Kevin: „Geschäftsmodell abbilden“). */
export const MESSEN_MODELL: Record<string, (b: Bestand) => Messung> = {
  break_even(b) {
    const ist = istMonate(b).slice(-6);
    const fix = wiederkehrendeKosten(b);
    if (ist.length < 2) return { luecke: 'Weniger als 2 Ist-Monate' };
    if (fix == null || fix <= 0) return { luecke: 'Keine wiederkehrenden Kosten geplant' };
    const umsatz = ist.reduce((s, m) => s + m.umsatz, 0) / ist.length;
    const kosten = ist.reduce((s, m) => s + m.kosten, 0) / ist.length;
    if (umsatz <= 0) return { luecke: 'Kein Umsatz in den letzten Monaten' };
    const variabel = Math.max(0, kosten - fix);
    const dbQuote = (umsatz - variabel) / umsatz;
    if (dbQuote <= 0) return { wert: -100, anzeige: 'kein Deckungsbeitrag', quelle: `variable Kosten (${euro(variabel)}) ≥ Umsatz (${euro(umsatz)})` };
    const be = fix / dbQuote;
    const w = ((umsatz - be) / umsatz) * 100;
    return { wert: w, anzeige: pz(w), quelle: `Ø ${euro(umsatz)} Umsatz/Monat · Break-even ${euro(be)}/Monat (Fixkosten ${euro(fix)} ÷ DB-Quote ${pz(dbQuote * 100)})`,
      details: [
        { titel: 'Break-even-Umsatz', wert: `${euro(be)}/Monat`, unter: 'ab hier deckt der Umsatz alle Kosten' },
        { titel: 'Ø Umsatz', wert: `${euro(umsatz)}/Monat`, unter: `${ist.length} Monate (${ist[0].monat} – ${ist.at(-1)!.monat})` },
        { titel: 'Fixkosten', wert: `${euro(fix)}/Monat`, unter: 'wiederkehrende Planposten', href: WEG.planposten() },
      ] };
  },
  auslastung(b) {
    const firmen: ('kdc' | 'kdv')[] = b.scope === 'gesamt' ? ['kdc'] : [b.scope as 'kdc' | 'kdv'];
    const kap = firmen.reduce((s, f) => s + (b.kapazitaet?.[f] ?? 0), 0);
    if (!kap) return { luecke: 'Kapazität (verfügbare Beratertage je Monat) ist nicht eingetragen', details: [{ titel: 'Kapazität eintragen', href: WEG.einstellungen() }] };
    const ist = istMonate({ ...b, scope: firmen.length === 1 ? firmen[0] : b.scope }).filter(m => m.fakturierteTage != null).slice(-3);
    if (!ist.length) return { luecke: 'Fakturierte Tage im Monatsabschluss fehlen' };
    const tage = ist.reduce((s, m) => s + (m.fakturierteTage ?? 0), 0) / ist.length;
    const w = (tage / kap) * 100;
    return { wert: w, anzeige: pz(w), quelle: `Ø ${zahl(tage)} fakturierte Tage ÷ ${zahl(kap)} verfügbare Tage je Monat (${ist.length} Monate)`,
      details: ist.map(m => ({ titel: m.monat, wert: `${zahl(m.fakturierteTage ?? 0)} Tage`, unter: `${pz(((m.fakturierteTage ?? 0) / kap) * 100)} ausgelastet`, href: WEG.abschluss(b.scope) })).concat([{ titel: 'Kapazität', wert: `${zahl(kap)} Tage/Monat`, unter: 'verfügbare Beratertage', href: WEG.einstellungen() }]) };
  },
  tagessatz(b) {
    const firma = b.scope === 'gesamt' ? 'kdc' : b.scope;
    const ist = istMonate({ ...b, scope: firma }).filter(m => (m.fakturierteTage ?? 0) > 0).slice(-3);
    if (!ist.length) return { luecke: 'Fakturierte Tage im Monatsabschluss fehlen' };
    const tage = ist.reduce((s, m) => s + (m.fakturierteTage ?? 0), 0);
    const w = ist.reduce((s, m) => s + m.umsatz, 0) / tage;
    return { wert: w, anzeige: euro(w), quelle: `${euro(ist.reduce((s, m) => s + m.umsatz, 0))} Umsatz ÷ ${zahl(tage)} fakturierte Tage (${ist.length} Monate)`,
      details: ist.map(m => ({ titel: m.monat, wert: euro(m.umsatz / (m.fakturierteTage || 1)), unter: `${euro(m.umsatz)} ÷ ${zahl(m.fakturierteTage ?? 0)} Tage`, href: WEG.abschluss(b.scope) })) };
  },
  recurring(b) {
    const je = mrrKunden(b);
    const mrr = Array.from(je.values()).reduce((s, x) => s + x, 0);
    const ist = istMonate(b);
    const u12 = ist.length ? (ist.reduce((s, m) => s + m.umsatz, 0) / ist.length) * 12 : 0;
    if (!u12) return { luecke: 'Umsatz der letzten Monate fehlt' };
    const w = Math.min(100, ((mrr * 12) / u12) * 100);
    return { wert: w, anzeige: pz(w), quelle: `${euro(mrr)} MRR × 12 ÷ ${euro(u12)} Umsatz/Jahr${ist.length < 12 ? ' (hochgerechnet)' : ''}`,
      details: Array.from(je.entries()).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([kunde, v]) => kundeDetail(b, kunde, `${euro(v)}/Monat`, `${pz((v / (mrr || 1)) * 100)} des MRR`)) };
  },
  ltv(b) {
    const k = kundenwert(b);
    if (!k) return { luecke: 'Keine Mandate mit Monatshonorar und Startdatum' };
    return { wert: k.wert, anzeige: euro(k.wert), quelle: `Ø ${euro(k.mrrSchnitt)}/Monat je Kunde × Ø ${zahl(k.laufzeit)} Monate Laufzeit (${k.kunden} Kunden)`,
      details: [
        { titel: 'Ø Honorar je Kunde', wert: `${euro(k.mrrSchnitt)}/Monat`, href: WEG.mandat() },
        { titel: 'Ø Laufzeit', wert: `${zahl(k.laufzeit)} Monate`, unter: 'laufende Mandate zählen bis heute', href: WEG.mandat() },
      ] };
  },
  ltv_cac(b) {
    const k = kundenwert(b);
    const c = MESSEN.cac(b);
    if (!k) return { luecke: 'Kundenwert fehlt (Mandate mit Monatshonorar und Start)' };
    if ('luecke' in c) return { luecke: `Kundengewinnungskosten fehlen — ${c.luecke}` };
    const w = k.wert / c.wert;
    return { wert: w, anzeige: `${zahl(w, 1)}×`, quelle: `${euro(k.wert)} Kundenwert ÷ ${euro(c.wert)} Gewinnungskosten`,
      details: [{ titel: 'Kundenwert (LTV)', wert: euro(k.wert), href: WEG.mandat() }, { titel: 'Gewinnungskosten je Kunde', wert: euro(c.wert), unter: 'Marketing & Vertrieb ÷ neue Kunden', href: WEG.abschluss(b.scope) }] };
  },
};

export const MESSEN: Record<string, (b: Bestand) => Messung> = {
  ...MESSEN_MODELL,
  liquiditaet(b) {
    const k = kasse(b), mk = monatsKosten(b);
    if (!k) return { luecke: 'Kontostände der Geschäftskonten fehlen', details: kontenDetails(b) };
    if (!mk || mk.betrag <= 0) return { luecke: 'Monatliche Kosten fehlen (Ist-Monate oder wiederkehrende Planposten)', details: [...kontenDetails(b), { titel: 'Monatsabschluss eintragen', href: WEG.abschluss(b.scope) }] };
    const w = k.betrag / mk.betrag;
    return { wert: w, anzeige: `${zahl(w)} Monate`, quelle: `${euro(k.betrag)} ÷ ${euro(mk.betrag)}/Monat (${mk.quelle})`, details: [...kontenDetails(b), kostenDetail(b, mk)] };
  },
  runway(b) {
    const k = kasse(b);
    if (!k) return { luecke: 'Kontostände der Geschäftskonten fehlen', details: kontenDetails(b) };
    const ist = istMonate(b).slice(-3);
    if (!ist.length) return { luecke: 'Ist-Monate fehlen', details: [{ titel: 'Monatsabschluss eintragen', href: WEG.abschluss(b.scope) }] };
    const netto = ist.reduce((s, m) => s + (m.kosten - m.umsatz), 0) / ist.length;
    const details = [...kontenDetails(b), ...ist.slice().reverse().map(m => monatDetail(b, m, undefined, m.umsatz - m.kosten < 0 ? 'rot' : 'gruen'))];
    if (netto <= 0) return { wert: 99, anzeige: 'kein Verbrauch', quelle: `Umsatz deckt die Kosten (Ø ${euro(-netto)} Überschuss/Monat, ${quellenText(ist)})`, details };
    const w = k.betrag / netto;
    return { wert: w, anzeige: `${zahl(w)} Monate`, quelle: `${euro(k.betrag)} ÷ ${euro(netto)} Netto-Verbrauch/Monat (${quellenText(ist)})`, details };
  },
  deckung13(b) {
    const k = kasse(b), mk = monatsKosten(b);
    if (!k) return { luecke: 'Kontostände der Geschäftskonten fehlen', details: kontenDetails(b) };
    if (!mk || mk.betrag <= 0) return { luecke: 'Monatliche Kosten fehlen' };
    const v = vorschau(b.firmen, b.rechnungen, b.zahlungen, b.merkposten, b.heute, 13, false, b.planposten, 'real', b.scope === 'gesamt' ? undefined : b.scope, true);
    const w = v.tiefpunkt.stand / mk.betrag;
    const bisTief = v.wochen.slice(0, Math.max(1, v.wochen.findIndex(x => x.label === v.tiefpunkt.label) + 1));
    const groesste = bisTief.flatMap(x => x.bewegungen).filter(x => x.betrag < 0).sort((x, y) => x.betrag - y.betrag).slice(0, 2);
    return { wert: w, anzeige: `${zahl(w)} Monate`, quelle: `tiefster Stand ${euro(v.tiefpunkt.stand)} (${v.tiefpunkt.label})${v.engpass ? ` — Engpass ab ${v.engpass.label}` : ''}`,
      details: [
        { titel: 'Tiefster Stand', wert: euro(v.tiefpunkt.stand), unter: v.tiefpunkt.label, href: WEG.liquiditaet(), ampel: v.tiefpunkt.stand < 0 ? 'rot' : v.tiefpunkt.stand < mk.betrag ? 'gelb' : 'gruen' },
        ...(v.engpass ? [{ titel: 'Engpass', wert: euro(v.engpass.stand), unter: `ab ${v.engpass.label} (${tagKurz(v.engpass.von)})`, href: WEG.liquiditaet(), ampel: 'rot' as Ampel }] : []),
        ...groesste.map(x => ({ titel: x.text, wert: euro(x.betrag), unter: `${tagKurz(x.datum)} · ${x.art === 'fix' ? 'Fixkosten' : 'Zahlung'}`, href: x.art === 'fix' ? WEG.planposten() : WEG.rechnungen() })),
      ] };
  },
  quick_ratio(b) {
    const v = letzterAbschluss(b, 'kurzfrVerbindlichkeiten');
    if (!v || v.wert <= 0) return { luecke: 'Kurzfristige Verbindlichkeiten im Monatsabschluss fehlen', details: [{ titel: 'Monatsabschluss eintragen', unter: 'Feld „kurzfristige Verbindlichkeiten“', href: WEG.abschluss(b.scope) }] };
    const k = kasse(b)?.betrag ?? 0;
    const ford = offeneRechnungen(b).reduce((s, r) => s + r.betrag, 0);
    const w = (k + ford) / v.wert;
    return { wert: w, anzeige: zahl(w, 2), quelle: `(${euro(k)} Kasse + ${euro(ford)} Forderungen) ÷ ${euro(v.wert)} (Abschluss ${v.monat})`,
      details: [
        { titel: 'Kasse', wert: euro(k), href: WEG.kontostaende() },
        { titel: 'Offene Forderungen', wert: euro(ford), unter: `${offeneRechnungen(b).length} gestellte Rechnungen`, href: WEG.rechnungen() },
        { titel: 'Kurzfristige Verbindlichkeiten', wert: euro(v.wert), unter: `Abschluss ${monatKurz(v.monat)}`, href: WEG.abschluss(b.scope) },
      ] };
  },
  ueberfaellig(b) {
    const alle = nurBusiness(b.rechnungen).filter(r => inSicht(r.firmaId, b.scope) && (r.status === 'gestellt' || r.status === 'bezahlt'));
    if (!alle.length) return { luecke: 'Noch keine gestellte Rechnung', details: [{ titel: 'Rechnungen öffnen', href: WEG.rechnungen() }] };
    const offen = offeneRechnungen(b);
    const summe = offen.reduce((s, r) => s + r.betrag, 0);
    if (!summe) return { wert: 0, anzeige: '0 %', quelle: 'nichts offen', details: [{ titel: 'Nichts offen', unter: 'alle gestellten Rechnungen sind bezahlt', href: WEG.rechnungen(), ampel: 'gruen' }] };
    const ueber = offen.filter(r => r.faellig && r.faellig < b.heute).sort((x, y) => y.betrag - x.betrag);
    const bald = offen.filter(r => !r.faellig || r.faellig >= b.heute).sort((x, y) => (x.faellig ?? '9').localeCompare(y.faellig ?? '9'));
    const w = (ueber.reduce((s, r) => s + r.betrag, 0) / summe) * 100;
    return { wert: w, anzeige: pz(w), quelle: `${ueber.length} von ${offen.length} offenen Rechnungen überfällig (${euro(ueber.reduce((s, r) => s + r.betrag, 0))} von ${euro(summe)})`,
      details: [
        ...ueber.map(r => rechnungDetail(r, `seit ${tageZwischen(r.faellig!, b.heute)} Tagen überfällig · fällig ${tagKurz(r.faellig!)}`, 'rot')),
        ...bald.slice(0, Math.max(0, 3 - ueber.length)).map(r => rechnungDetail(r, r.faellig ? `fällig in ${tageZwischen(b.heute, r.faellig)} Tagen` : 'ohne Fälligkeit — Zahlungsziel eintragen', r.faellig ? 'gruen' : 'gelb')),
      ] };
  },
  dso(b) {
    const grenze = `${monatPlus(monat(b.heute), -12)}-01`;
    const l = nurBusiness(b.rechnungen).filter(r => inSicht(r.firmaId, b.scope) && r.status === 'bezahlt' && r.datum && r.bezahltAm && r.bezahltAm >= grenze && r.bezahltAm >= r.datum);
    const g = grenzen(b, 'dso', 40, 55);
    const langeOffen = offeneRechnungen(b).filter(r => r.datum).sort((x, y) => x.datum!.localeCompare(y.datum!))[0];
    const offenDetail: Detail[] = langeOffen ? [rechnungDetail(langeOffen, `noch offen — seit ${tageZwischen(langeOffen.datum!, b.heute)} Tagen gestellt`, ampelVon(tageZwischen(langeOffen.datum!, b.heute), g))] : [];
    if (l.length < 2) return { luecke: `${l.length} bezahlte Rechnung${l.length === 1 ? '' : 'en'} mit Rechnungsdatum und Zahlungseingang — mindestens 2 nötig`, details: [{ titel: 'Rechnungsdatum und „bezahlt am“ pflegen', href: WEG.rechnungen() }, ...offenDetail] };
    const w = l.reduce((s, r) => s + tageZwischen(r.datum!, r.bezahltAm!), 0) / l.length;
    const langsam = l.map(r => ({ r, t: tageZwischen(r.datum!, r.bezahltAm!) })).sort((x, y) => y.t - x.t).slice(0, 3);
    return { wert: w, anzeige: `${zahl(w, 0)} Tage`, quelle: `Ø über ${l.length} bezahlte Rechnungen (12 Monate)`,
      details: [...langsam.map(({ r, t }) => ({ ...rechnungDetail(r, `gestellt ${tagKurz(r.datum!)} · bezahlt ${tagKurz(r.bezahltAm!)}`, ampelVon(t, g)), wert: `${t} Tage` })), ...offenDetail] };
  },
  konzentration(b) {
    const je = mrrKunden(b);
    const gesamt = Array.from(je.values()).reduce((a, x) => a + x, 0);
    if (!gesamt) return { luecke: 'Keine aktiven Mandate mit Monatshonorar', details: [{ titel: 'Mandate öffnen', href: WEG.mandat() }] };
    const reihe = Array.from(je.entries()).sort((x, y) => y[1] - x[1]);
    const [kunde, wert] = reihe[0];
    const w = (wert / gesamt) * 100;
    const g = grenzen(b, 'konzentration', 30, 50);
    return { wert: w, anzeige: pz(w), quelle: `${kunde}: ${euro(wert)} von ${euro(gesamt)} MRR (${je.size} Kunde${je.size === 1 ? '' : 'n'})`,
      details: reihe.slice(0, 3).map(([k, v]) => kundeDetail(b, k, pz((v / gesamt) * 100), `${euro(v)}/Monat`, ampelVon((v / gesamt) * 100, g))) };
  },
  kostenquote(b) {
    const ist = istMonate(b);
    const u = ist.reduce((s, m) => s + m.umsatz, 0);
    if (!ist.length || u <= 0) return { luecke: 'Umsatz der letzten 12 Monate fehlt', details: [{ titel: 'Monatsabschluss eintragen', href: WEG.abschluss(b.scope) }] };
    const w = (ist.reduce((s, m) => s + m.kosten, 0) / u) * 100;
    const g = grenzen(b, 'kostenquote', 85, 95);
    return { wert: w, anzeige: pz(w), quelle: `${euro(ist.reduce((s, m) => s + m.kosten, 0))} Kosten ÷ ${euro(u)} Umsatz · ${quellenText(ist)}`,
      details: ist.slice(-3).reverse().map(m => monatDetail(b, m, m.umsatz > 0 ? pz((m.kosten / m.umsatz) * 100) : 'ohne Umsatz', m.umsatz > 0 ? ampelVon((m.kosten / m.umsatz) * 100, g) : 'rot')) };
  },
  fixkostenquote(b) {
    const fix = wiederkehrendeKosten(b);
    const ist = istMonate(b);
    const u = ist.length ? ist.reduce((s, m) => s + m.umsatz, 0) / ist.length : 0;
    const posten = wiederkehrendePosten(b).sort((x, y) => postenMonat(y) - postenMonat(x));
    const details: Detail[] = posten.length ? posten.slice(0, 4).map(p => postenDetail(p)) : fix ? [{ titel: 'Fixkosten aus dem V1-Export', wert: `${euro(fix)}/Monat`, unter: 'keine eigenen Planposten — Grundlage', href: WEG.grundlage() }] : [];
    if (fix == null) return { luecke: 'Keine wiederkehrenden Kosten geplant', details: [{ titel: 'Planposten anlegen', href: WEG.planposten() }] };
    if (u <= 0) return { luecke: 'Umsatz der letzten Monate fehlt', details };
    const w = (fix / u) * 100;
    return { wert: w, anzeige: pz(w), quelle: `${euro(fix)}/Monat wiederkehrend ÷ ${euro(u)} Ø Umsatz/Monat`, details };
  },
  plan_ist(b) {
    const ist = istMonate(b).at(-1);
    if (!ist) return { luecke: 'Ist-Kosten des letzten Monats fehlen', details: [{ titel: 'Monatsabschluss eintragen', href: WEG.abschluss(b.scope) }] };
    const posten = geplantePostenIm(b, ist.monat);
    const plan = posten ? posten.reduce((s, x) => s + x.betrag, 0) : null;
    if (plan == null || plan <= 0) return { luecke: `Für ${ist.monat} sind keine Kosten geplant`, details: [{ titel: 'Planposten anlegen', href: WEG.planposten() }] };
    const w = Math.max(0, (ist.kosten / plan - 1) * 100);
    return { wert: w, anzeige: w ? `+${pz(w)}` : 'im Plan', quelle: `${ist.monat}: ${euro(ist.kosten)} Ist ÷ ${euro(plan)} Plan (${ist.quelle})`,
      details: [
        { titel: `Ist ${monatKurz(ist.monat)}`, wert: euro(ist.kosten), unter: ist.quelle, href: monatsWeg(b, ist), ampel: ampelVon(w, grenzen(b, 'plan_ist', 5, 15)) },
        { titel: `Plan ${monatKurz(ist.monat)}`, wert: euro(plan), unter: `${posten!.length} Planposten`, href: WEG.planposten() },
        ...posten!.sort((x, y) => y.betrag - x.betrag).slice(0, 2).map(x => ({ ...postenDetail(x.p), wert: euro(x.betrag), unter: 'größter Planposten im Monat' })),
      ] };
  },
  kapitaldienst(b) {
    const ist = istMonate(b);
    if (ist.length < 3) return { luecke: 'Weniger als 3 Ist-Monate', details: [{ titel: 'Monatsabschluss eintragen', href: WEG.abschluss(b.scope) }] };
    const faktor = 12 / ist.length;
    const ergebnis = ist.reduce((s, m) => s + m.umsatz - m.kosten + (m.afa ?? 0), 0) * faktor;
    const kredite = wiederkehrendePosten(b, 'kredite');
    const raten = kredite.reduce((s, p) => s + postenMonat(p), 0) * 12;
    if (!raten) return { wert: 99, anzeige: 'kein Kredit', quelle: 'kein Schuldendienst in den Business-Planposten (private Kredite zählen nie)', details: [{ titel: 'Kein Business-Kredit geplant', unter: 'Raten als Planposten „Kredite“ anlegen', href: WEG.planposten(), ampel: 'gruen' }] };
    const w = ergebnis / raten;
    return { wert: w, anzeige: zahl(w, 2), quelle: `${euro(ergebnis)} Ergebnis (12 M, hochgerechnet) ÷ ${euro(raten)} Raten/Jahr`,
      details: [{ titel: 'Ergebnis vor Abschreibung', wert: euro(ergebnis), unter: quellenText(ist), href: WEG.abschluss(b.scope) }, ...kredite.slice(0, 3).map(p => postenDetail(p, 'Kreditrate'))] };
  },
  ek_quote(b) {
    const ek = letzterAbschluss(b, 'eigenkapital'), bs = letzterAbschluss(b, 'bilanzsumme');
    if (!ek || !bs || bs.wert <= 0) return { luecke: 'Eigenkapital und Bilanzsumme im Monatsabschluss fehlen', details: [{ titel: 'Monatsabschluss eintragen', unter: 'Eigenkapital und Bilanzsumme aus der BWA/Bilanz', href: WEG.abschluss(b.scope) }] };
    const w = (ek.wert / bs.wert) * 100;
    return { wert: w, anzeige: pz(w), quelle: `${euro(ek.wert)} ÷ ${euro(bs.wert)} (Abschluss ${bs.monat})`,
      details: [{ titel: 'Eigenkapital', wert: euro(ek.wert), unter: `Abschluss ${monatKurz(ek.monat)}`, href: WEG.abschluss(b.scope) }, { titel: 'Bilanzsumme', wert: euro(bs.wert), unter: `Abschluss ${monatKurz(bs.monat)}`, href: WEG.abschluss(b.scope) }] };
  },

  umsatz_kopf(b) {
    const fte = b.scope === 'gesamt' ? (b.fte.kdc ?? 0) + (b.fte.kdv ?? 0) : b.fte[b.scope] ?? 0;
    if (!fte) return { luecke: 'Köpfe (FTE) sind nicht eingetragen', details: [{ titel: 'Köpfe eintragen', href: WEG.einstellungen() }] };
    const ist = istMonate(b);
    if (!ist.length) return { luecke: 'Umsatz der letzten Monate fehlt', details: [{ titel: 'Monatsabschluss eintragen', href: WEG.abschluss(b.scope) }] };
    const u12 = (ist.reduce((s, m) => s + m.umsatz, 0) / ist.length) * 12;
    const w = u12 / fte;
    return { wert: w, anzeige: euro(w), quelle: `${euro(u12)} Umsatz/Jahr${ist.length < 12 ? ' (hochgerechnet)' : ''} ÷ ${zahl(fte)} FTE`,
      details: [{ titel: 'Umsatz im Jahr', wert: euro(u12), unter: quellenText(ist), href: WEG.abschluss(b.scope) }, { titel: 'Köpfe (FTE)', wert: zahl(fte), href: WEG.einstellungen() }] };
  },
  personalquote(b) {
    const ist = istMonate(b);
    const u = ist.reduce((s, m) => s + m.umsatz, 0);
    if (!ist.length || u <= 0) return { luecke: 'Umsatz der letzten Monate fehlt', details: [{ titel: 'Monatsabschluss eintragen', href: WEG.abschluss(b.scope) }] };
    const mitPersonal = ist.filter(m => m.personal != null);
    let personal: number, quelle: string, details: Detail[];
    if (mitPersonal.length) {
      personal = mitPersonal.reduce((s, m) => s + (m.personal ?? 0), 0) / mitPersonal.length * ist.length;
      quelle = `Monatsabschluss (${mitPersonal.length} Monate)`;
      details = mitPersonal.slice(-3).reverse().map(m => ({ titel: monatKurz(m.monat), wert: euro(m.personal ?? 0), unter: m.umsatz > 0 ? `${pz(((m.personal ?? 0) / m.umsatz) * 100)} vom Umsatz` : 'ohne Umsatz', href: WEG.abschluss(b.scope) }));
    } else {
      // Geplantes Personal in genau den Ist-Monaten — künftige Einstellungen zählen nicht rückwirkend.
      const je = ist.map(m => geplantePostenIm(b, m.monat, 'personal'));
      if (je.every(x => x == null)) return { luecke: 'Personalkosten fehlen (Monatsabschluss oder Planposten „Personal“)', details: [{ titel: 'Monatsabschluss eintragen', unter: 'Feld „Personal“', href: WEG.abschluss(b.scope) }] };
      personal = je.reduce<number>((s, x) => s + (x ?? []).reduce((a, y) => a + y.betrag, 0), 0);
      quelle = `Planposten „Personal“ in ${ist.length} Monaten`;
      details = wiederkehrendePosten(b, 'personal').slice(0, 3).map(p => postenDetail(p, 'Planposten Personal'));
    }
    const w = (personal / u) * 100;
    return { wert: w, anzeige: pz(w), quelle: `${euro(personal)} ÷ ${euro(u)} Umsatz (${quelle})`, details };
  },
  fokuszeit(b) {
    const ab = tagMinus(b.heute, 28);
    const min = b.bloecke.filter(x => x.art === 'fokus' && x.date >= ab && x.date <= b.heute).reduce((s, x) => s + x.dauerMin, 0);
    if (!b.bloecke.some(x => x.date >= ab)) return { luecke: 'In den letzten 4 Wochen ist nichts im Wochenplan', details: [{ titel: 'Diese Woche planen', href: WEG.woche() }] };
    const w = min / 60 / 4;
    const g = grenzen(b, 'fokuszeit', 10, 4);
    return { wert: w, anzeige: `${zahl(w)} h/Woche`, quelle: `${zahl(min / 60)} h Fokus-Blöcke in 4 Wochen`,
      details: vierWochen(b.heute).reverse().map(x => {
        const h = b.bloecke.filter(y => y.art === 'fokus' && y.date >= x.von && y.date <= x.bis).reduce((s, y) => s + y.dauerMin, 0) / 60;
        return { titel: `Woche ab ${tagKurz(x.von)}`, wert: `${zahl(h)} h`, href: WEG.woche(x.von), ampel: ampelVon(h, g) };
      }) };
  },
  meetinglast(b) {
    if (!b.termineVollstaendig) return { luecke: 'Braucht den iCloud-Kalender (der Mac-Stand reicht nur einen Tag zurück)', details: [{ titel: 'Kalender öffnen', href: WEG.woche() }] };
    const ab = tagMinus(b.heute, 28);
    const zaehlt = (t: { start: string; owner?: string }, von: string, bis: string) => t.start.slice(0, 10) >= von && t.start.slice(0, 10) <= bis && t.owner !== 'malin';
    const dauer = (t: { start: string; ende: string }) => Math.max(0, Math.min(12, (Date.parse(t.ende) - Date.parse(t.start)) / 3_600_000));
    const l = b.termine.filter(t => zaehlt(t, ab, tagMinus(b.heute, 1)));
    const h = l.reduce((s, t) => s + dauer(t), 0);
    const w = h / 4;
    const g = grenzen(b, 'meetinglast', 20, 30);
    return { wert: w, anzeige: `${zahl(w)} h/Woche`, quelle: `${l.length} Termine, ${zahl(h)} h in 4 Wochen (Kevin + gemeinsam)`,
      details: vierWochen(b.heute).reverse().map(x => {
        const wl = b.termine.filter(t => zaehlt(t, x.von, x.bis < b.heute ? x.bis : tagMinus(b.heute, 1)));
        const wh = wl.reduce((s, t) => s + dauer(t), 0);
        return { titel: `Woche ab ${tagKurz(x.von)}`, wert: `${zahl(wh)} h`, unter: `${wl.length} Termine`, href: WEG.woche(x.von), ampel: ampelVon(wh, g) };
      }) };
  },
  delegation(b) {
    const ab = `${tagMinus(b.heute, 28)}T00:00:00`;
    const eigen = b.auftraege.filter(a => a.status === 'fertig' && (a.beendet ?? a.zeit ?? '') >= ab && !/^Takt/i.test(a.anlass ?? ''));
    if (!b.auftraege.length) return { luecke: 'Noch keine Agenten-Aufträge', details: [{ titel: 'Agenten öffnen', href: WEG.agenten() }] };
    const w = eigen.length / 4;
    const letzte = eigen.slice().sort((x, y) => (y.beendet ?? y.zeit ?? '').localeCompare(x.beendet ?? x.zeit ?? '')).slice(0, 3);
    return { wert: w, anzeige: `${zahl(w)} / Woche`, quelle: `${eigen.length} erledigte Aufträge in 4 Wochen (ohne Routine-Takt)`,
      details: letzte.map(a => ({ titel: (a.auftrag ?? a.name ?? 'Auftrag').slice(0, 70), unter: `erledigt ${tagKurz((a.beendet ?? a.zeit ?? '').slice(0, 10))}`, href: WEG.agenten() })) };
  },
  meilensteine(b) {
    const alle = b.meilensteine.filter(m => m.bereich === 'business');
    if (!alle.length) return { luecke: 'Keine Business-Meilensteine', details: [{ titel: 'Meilenstein anlegen', href: WEG.jahr() }] };
    const offen = alle.filter(m => !m.erledigt);
    if (!offen.length) return { wert: 100, anzeige: '100 %', quelle: 'alle Business-Meilensteine erledigt', details: [{ titel: 'Nächsten Meilenstein setzen', href: WEG.jahr(), ampel: 'gruen' }] };
    const istUeber = (m: { faellig?: string }) => !!m.faellig && m.faellig < b.heute;
    const ueber = offen.filter(istUeber).length;
    const w = offen.reduce((s, m) => s + (istUeber(m) ? 0 : m.fortschritt), 0) / offen.length;
    const reihe = offen.slice().sort((x, y) => Number(istUeber(y)) - Number(istUeber(x)) || x.fortschritt - y.fortschritt);
    return { wert: w, anzeige: pz(w), quelle: `Ø Fortschritt ${offen.length} offener Meilensteine${ueber ? `, ${ueber} überfällig (zählt 0)` : ''}`,
      details: reihe.slice(0, 3).map(m => ({ titel: m.titel ?? 'Meilenstein', wert: `${Math.round(m.fortschritt)} %`, unter: istUeber(m) ? `überfällig seit ${tagKurz(m.faellig!)}` : m.faellig ? `fällig ${tagKurz(m.faellig)}` : 'ohne Termin', href: WEG.jahr(), ampel: istUeber(m) ? 'rot' : m.fortschritt >= 70 ? 'gruen' : m.fortschritt >= 40 ? 'gelb' : 'rot' })) };
  },

  traktion(b) {
    const details: Detail[] = (b.traktion.welten ?? []).map(x => ({ titel: x.label, wert: x.score == null ? 'fehlt' : String(Math.round(x.score)), href: markttraktion(x.id), ampel: x.score == null ? 'grau' : x.score >= 70 ? 'gruen' : x.score >= 40 ? 'gelb' : 'rot' }));
    if (b.traktion.score == null) return { luecke: 'In der Markttraktion ist noch nichts gemessen', details };
    return { wert: b.traktion.score, anzeige: `${Math.round(b.traktion.score)}`, quelle: b.traktion.text, details };
  },
  run_rate(b) {
    const k = jahresKurs(b);
    if ('luecke' in k) return { ...k, details: [{ titel: b.scope === 'gesamt' ? 'Jahresziel im Controlling' : 'Jahresziel eintragen', href: b.scope === 'gesamt' ? WEG.controlling() : WEG.einstellungen() }] };
    const details: Detail[] = [
      { titel: 'Ist seit Januar', wert: euro(k.ist), unter: k.quelle, href: b.scope === 'gesamt' ? WEG.controlling() : WEG.abschluss(b.scope) },
      { titel: 'Jahresziel', wert: euro(k.ziel), unter: `noch ${euro(k.verbleibend)}`, href: b.scope === 'gesamt' ? WEG.controlling() : WEG.einstellungen() },
      { titel: 'Nötig je Monat', wert: euro(k.noetig), unter: `aktuell Ø ${euro(k.aktuell)}`, href: WEG.deals(), ampel: k.aktuell >= k.noetig ? 'gruen' : k.aktuell >= k.noetig * 0.7 ? 'gelb' : 'rot' },
    ];
    if (k.noetig <= 0) return { wert: 200, anzeige: 'Ziel erreicht', quelle: `${euro(k.ist)} von ${euro(k.ziel)} (${k.quelle})`, details };
    const w = (k.aktuell / k.noetig) * 100;
    return { wert: w, anzeige: pz(w), quelle: `Ø ${euro(k.aktuell)}/Monat von nötigen ${euro(k.noetig)}/Monat · Ziel ${euro(k.ziel)} (${k.quelle})`, details };
  },
  win_rate(b) {
    const cs = chancenInSicht(b);
    const q = gewinnquote(cs);
    const entschieden = cs.filter(c => c.stufe === 'gewonnen' || c.stufe === 'verloren')
      .map(c => ({ c, am: c.historie.filter(h => h.stufe === c.stufe).at(-1)?.am ?? c.geaendert ?? '' }))
      .sort((x, y) => y.am.localeCompare(x.am)).slice(0, 3);
    const details = entschieden.map(({ c, am }) => dealDetail(c, c.stufe === 'gewonnen' ? 'gewonnen' : 'verloren', `${am ? tagKurz(am.slice(0, 10)) : ''}${c.grund ? ` · ${c.grund}` : ''}`, c.stufe === 'gewonnen' ? 'gruen' : 'rot'));
    if (q.quote == null) return { luecke: `${q.gewonnen} gewonnen · ${q.verloren} verloren — ab 10 Entscheidungen eine Quote`, details };
    return { wert: q.quote, anzeige: pz(q.quote), quelle: `${q.gewonnen} gewonnen, ${q.verloren} verloren (ab Angebot)`, details };
  },
  pipeline(b) {
    const k = jahresKurs(b);
    const offen = chancenInSicht(b).filter(c => OFFENE_STUFEN.includes(c.stufe));
    const details = offen.map(c => ({ c, g: gesamtwert(c) * wahrscheinlichkeit(c.stufe) / 100 })).sort((x, y) => y.g - x.g).slice(0, 3)
      .map(({ c, g }) => dealDetail(c, euro(g), `${euro(gesamtwert(c))} × ${wahrscheinlichkeit(c.stufe)} % · ${c.naechsterSchritt ? `→ ${c.naechsterSchritt.text}` : 'kein nächster Schritt'}`, c.naechsterSchritt ? undefined : 'gelb'));
    if ('luecke' in k && !k.luecke.startsWith('Keine Ist')) return { ...k, details };
    const p = prognose(chancenInSicht(b), b.heute);
    const verbleibend = 'luecke' in k ? zielDer(b) ?? 0 : k.verbleibend;
    if (verbleibend <= 0) return { wert: 99, anzeige: 'Ziel erreicht', quelle: `gewichtete Pipeline ${euro(p.gewichtet)}`, details };
    const w = p.gewichtet / verbleibend;
    return { wert: w, anzeige: `${zahl(w, 1)}×`, quelle: `${euro(p.gewichtet)} gewichtet ÷ ${euro(verbleibend)} Lücke zum Jahresziel`, details };
  },
  sales_cycle(b) {
    const grenze = tagMinus(b.heute, 365);
    const l = chancenInSicht(b).map(c => {
      const start = c.historie[0]?.am, gewonnen = c.historie.find(h => h.stufe === 'gewonnen')?.am;
      return c.stufe === 'gewonnen' && start && gewonnen && gewonnen.slice(0, 10) >= grenze ? { c, t: tageZwischen(start, gewonnen) } : null;
    }).filter((x): x is { c: Chance; t: number } => x != null && x.t >= 0);
    const g = grenzen(b, 'sales_cycle', 60, 120);
    const details = l.slice().sort((x, y) => y.t - x.t).slice(0, 3).map(({ c, t }) => dealDetail(c, `${t} Tage`, 'gewonnen', ampelVon(t, g)));
    if (l.length < 2) return { luecke: `${l.length} gewonnene Deal${l.length === 1 ? '' : 's'} mit Verlauf — mindestens 2 nötig`, details };
    const w = l.reduce((s, x) => s + x.t, 0) / l.length;
    return { wert: w, anzeige: `${zahl(w, 0)} Tage`, quelle: `Ø über ${l.length} gewonnene Deals (12 Monate)`, details };
  },
  nrr(b) {
    const monate = Object.keys(b.mrrVerlauf).sort();
    const jetzt = monate.at(-1);
    if (!jetzt) return { luecke: 'Sammelt den MRR-Verlauf — aussagekräftig ab 3 Monaten' };
    // Start: möglichst 12 Monate zurück, mindestens 3.
    const start = monate.find(m => m >= monatPlus(jetzt, -12) && m <= monatPlus(jetzt, -3));
    if (!start) return { luecke: `MRR-Verlauf seit ${monate[0]} — aussagekräftig ab 3 Monaten`, details: [{ titel: 'Mandate mit Monatshonorar pflegen', href: WEG.mandat() }] };
    const a = b.mrrVerlauf[start], z = b.mrrVerlauf[jetzt];
    const basis = Object.values(a).reduce((s, x) => s + x, 0);
    if (basis <= 0) return { luecke: `Im ${start} gab es keinen MRR` };
    const heute = Object.keys(a).reduce((s, k) => s + (z[k] ?? 0), 0);
    const w = (heute / basis) * 100;
    const aenderung = Object.keys(a).map(k => ({ k, d: (z[k] ?? 0) - a[k] })).filter(x => x.d !== 0).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 3);
    return { wert: w, anzeige: pz(w), quelle: `Bestandskunden aus ${start}: ${euro(basis)} → ${euro(heute)} MRR (${jetzt})`,
      details: aenderung.map(x => kundeDetail(b, x.k, `${x.d > 0 ? '+' : ''}${euro(x.d)}/Monat`, `${euro(a[x.k])} → ${euro(z[x.k] ?? 0)}`, x.d > 0 ? 'gruen' : 'rot')) };
  },
  churn(b) {
    const grenze = tagMinus(b.heute, 365);
    const l = aktiveMandate(b).filter(m => m.start && ['aktiv', 'pausiert', 'beendet'].includes(m.status));
    if (!l.length) return { luecke: 'Keine Mandate mit Startdatum', details: [{ titel: 'Mandate pflegen', unter: 'Start und Ende eintragen', href: WEG.mandat() }] };
    const beendetL = l.filter(m => m.status === 'beendet' && m.ende && m.ende >= grenze && m.ende <= b.heute);
    const beendet = beendetL.length;
    // Ø aktive über 12 Monate: Monatsenden zählen.
    let summe = 0;
    for (let i = 0; i < 12; i++) {
      const stichtag = tagMinus(b.heute, 30 * i);
      summe += l.filter(m => m.start! <= stichtag && (!m.ende || m.ende > stichtag || m.status !== 'beendet')).length;
    }
    const schnitt = summe / 12;
    if (schnitt <= 0) return { luecke: 'Keine aktiven Mandate im letzten Jahr' };
    const w = (beendet / 12 / schnitt) * 100;
    const bald = l.filter(m => m.status === 'aktiv' && m.ende && m.ende > b.heute && m.ende <= tagMinus(b.heute, -90)).sort((x, y) => x.ende!.localeCompare(y.ende!));
    return { wert: w, anzeige: `${zahl(w, 1)} %/Monat`, quelle: `${beendet} beendet in 12 Monaten bei Ø ${zahl(schnitt, 1)} aktiven Mandaten`,
      details: [
        ...beendetL.sort((x, y) => y.ende!.localeCompare(x.ende!)).slice(0, 3).map(m => ({ titel: m.kunde, wert: 'beendet', unter: `${m.titel} · Ende ${tagKurz(m.ende!)}`, href: WEG.mandat(m.id), ampel: 'rot' as Ampel })),
        ...bald.slice(0, 2).map(m => ({ titel: m.kunde, wert: `endet ${tagKurz(m.ende!)}`, unter: `${m.titel} · jetzt verlängern`, href: WEG.mandat(m.id), ampel: 'gelb' as Ampel })),
      ] };
  },
  cac(b) {
    const ist = istMonate(b).filter(m => m.marketingVertrieb != null);
    if (!ist.length) return { luecke: 'Marketing- und Vertriebskosten im Monatsabschluss fehlen', details: [{ titel: 'Monatsabschluss eintragen', unter: 'Feld „Marketing & Vertrieb“', href: WEG.abschluss(b.scope) }] };
    const grenze = tagMinus(b.heute, 365);
    const neuL = aktiveMandate(b).filter(m => m.start && m.start >= grenze && m.start <= b.heute && m.status !== 'angebot' && m.status !== 'verhandlung');
    const neu = new Set(neuL.map(m => m.kunde)).size;
    if (!neu) return { luecke: 'Keine neuen Kunden in den letzten 12 Monaten', details: [{ titel: 'Pipeline öffnen', href: WEG.deals() }] };
    const kosten = ist.reduce((s, m) => s + (m.marketingVertrieb ?? 0), 0) * (12 / ist.length);
    const w = kosten / neu;
    return { wert: w, anzeige: euro(w), quelle: `${euro(kosten)} Marketing & Vertrieb (12 M) ÷ ${neu} neue Kunden`,
      details: [
        { titel: 'Marketing & Vertrieb (12 Monate)', wert: euro(kosten), unter: `${ist.length} Monate im Abschluss${ist.length < 12 ? ', hochgerechnet' : ''}`, href: WEG.abschluss(b.scope) },
        ...neuL.sort((x, y) => y.start!.localeCompare(x.start!)).slice(0, 3).map(m => ({ titel: m.kunde, wert: 'neu', unter: `seit ${tagKurz(m.start!)} · ${m.titel}`, href: WEG.mandat(m.id) })),
      ] };
  },
};

/** Monatshonorare je Kunde dieser Sicht (aktiv, > 0). */
function mrrKunden(b: Bestand): Map<string, number> {
  const je = new Map<string, number>();
  for (const m of aktiveMandate(b).filter(m => m.status === 'aktiv' && m.honorar.basis === 'monat' && m.honorar.betrag > 0)) je.set(m.kunde, (je.get(m.kunde) ?? 0) + m.honorar.betrag);
  return je;
}

/** Kundenwert: Ø Monatshonorar je Kunde × Ø Laufzeit (beendete: Start→Ende, laufende: Start→heute, mind. 1 Monat). */
function kundenwert(b: Bestand): { wert: number; mrrSchnitt: number; laufzeit: number; kunden: number } | null {
  const l = aktiveMandate(b).filter(m => m.start && m.honorar.basis === 'monat' && m.honorar.betrag > 0 && ['aktiv', 'pausiert', 'beendet'].includes(m.status));
  if (!l.length) return null;
  const monate = (a: string, z: string) => Math.max(1, (Date.parse(`${z.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / (30.44 * 86_400_000));
  const laufzeit = l.reduce((s, m) => s + monate(m.start!, m.status === 'beendet' && m.ende ? m.ende : b.heute), 0) / l.length;
  const kunden = new Set(l.map(m => m.kunde)).size;
  const mrrSchnitt = l.reduce((s, m) => s + m.honorar.betrag, 0) / kunden;
  return { wert: mrrSchnitt * laufzeit, mrrSchnitt, laufzeit, kunden };
}

/** Das Jahresumsatzziel der Sicht: gesamt aus dem Controlling, je Firma aus den Einstellungen. */
function zielDer(b: Bestand): number | null {
  if (b.scope === 'gesamt') return b.finance && b.finance.zielUmsatz > 0 && b.finance.jahr === Number(b.heute.slice(0, 4)) ? b.finance.zielUmsatz : null;
  const z = b.ziele?.[b.scope];
  return z && z > 0 ? z : null;
}

/**
 * Kurs aufs Jahresziel: Ist seit Jahresbeginn, Ø je aktivem Monat und der nötige
 * Monatsumsatz für den Rest des Jahres (laufender Monat zählt als Rest).
 * Gesamt rechnet wie das Controlling; je Firma aus den Ist-Monaten.
 */
function jahresKurs(b: Bestand): { ziel: number; ist: number; aktuell: number; noetig: number; verbleibend: number; quelle: string } | { luecke: string } {
  const ziel = zielDer(b);
  if (!ziel) return { luecke: b.scope === 'gesamt' ? 'Jahresziel im Controlling fehlt' : 'Jahresumsatzziel für diese Firma fehlt' };
  if (b.scope === 'gesamt' && b.finance) {
    const m = computeMetrics(b.finance, new Date(`${b.heute}T12:00:00`));
    if (!m.aktiveMonate) return { luecke: 'Keine Ist-Monate im Controlling' };
    return { ziel, ist: m.istUmsatz, aktuell: m.runRateAktuell, noetig: m.runRateNoetig, verbleibend: m.verbleibend, quelle: 'Controlling' };
  }
  const jahr = b.heute.slice(0, 4);
  const ist = istMonate(b).filter(m => m.monat.startsWith(jahr));
  if (!ist.length) return { luecke: 'Keine Ist-Monate in diesem Jahr' };
  const summe = ist.reduce((s, m) => s + m.umsatz, 0);
  const rest = 12 - (Number(b.heute.slice(5, 7)) - 1);
  const verbleibend = Math.max(0, ziel - summe);
  return { ziel, ist: summe, aktuell: summe / ist.length, noetig: rest > 0 ? verbleibend / rest : verbleibend, verbleibend, quelle: quellenText(ist) };
}

function tagMinus(tag: string, n: number): string {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** MRR je Kunde dieser Sicht (für die Monats-Schnappschüsse). */
export function mrrJeKunde(mandate: Mandat[], scope: Scope): Record<string, number> {
  const je: Record<string, number> = {};
  for (const m of mandate.filter(m => gesellschaftInSicht(m.gesellschaft, scope) && m.status === 'aktiv' && m.honorar.basis === 'monat')) je[m.kunde] = (je[m.kunde] ?? 0) + m.honorar.betrag;
  return je;
}

export { FIRMEN_LABEL };
