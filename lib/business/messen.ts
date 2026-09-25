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
import { gewinnquote, prognose } from '@/lib/crm/pipeline';

export interface Monatsabschluss {
  firma: 'kdc' | 'kdv';
  /** YYYY-MM */
  monat: string;
  umsatz?: number; kosten?: number; personal?: number; marketingVertrieb?: number; afa?: number;
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
  traktion: { score: number | null; text: string };
  /** Kalender: Termine mit Uhrzeit (Wandzeit), owner kevin|malin|both */
  termine: { start: string; ende: string; owner?: string }[];
  /** true = der Kalender-Stand reicht mindestens 4 Wochen zurück (iCloud); der Mac-Stand nur einen Tag. */
  termineVollstaendig: boolean;
  /** Planer-Blöcke der letzten Wochen */
  bloecke: { date: string; dauerMin: number; art: string }[];
  auftraege: { status: string; beendet?: string; zeit?: string; anlass?: string }[];
  meilensteine: { bereich: string; faellig?: string; fortschritt: number; erledigt: boolean }[];
  fte: Partial<Record<'kdc' | 'kdv', number>>;
  /** MRR-Schnappschüsse: Monat → Kunde → MRR (nur diese Sicht) */
  mrrVerlauf: Record<string, Record<string, number>>;
  /** Jahresumsatzziel je Firma (Feinjustierung); gesamt kommt aus dem Controlling. */
  ziele?: Partial<Record<'kdc' | 'kdv', number>>;
  /** Eigene Schwellen dieser Sicht (Feinjustierung) — überschreiben den Standard. */
  schwellen?: Record<string, Schwelle>;
}

export type Messung = { wert: number; anzeige: string; quelle: string } | { luecke: string };

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

export interface IstMonat { monat: string; umsatz: number; kosten: number; personal?: number; marketingVertrieb?: number; afa?: number; quelle: string }

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
      if (a) return { umsatz: a.umsatz ?? 0, kosten: a.kosten ?? 0, personal: a.personal, marketingVertrieb: a.marketingVertrieb, afa: a.afa, quelle: 'Monatsabschluss' };
      if (f === 'kdc') { const g = b.grundlageMonate.find(x => x.monat === m); if (g) return { umsatz: g.umsatzNetto, kosten: g.kostenNetto, quelle: 'Grundlage' }; }
      return null;
    });
    const da = je.filter((x): x is NonNullable<typeof x> => !!x);
    const summe = (k: 'personal' | 'marketingVertrieb' | 'afa') => da.some(x => x[k] != null) ? da.reduce((s, x) => s + (x[k] ?? 0), 0) : undefined;
    const ausFirmen = (): IstMonat => ({ monat: m, umsatz: da.reduce((s, x) => s + x.umsatz, 0), kosten: da.reduce((s, x) => s + x.kosten, 0), personal: summe('personal'), marketingVertrieb: summe('marketingVertrieb'), afa: summe('afa'), quelle: Array.from(new Set(da.map(x => x.quelle))).join(' + ') });
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

/** Wiederkehrende geplante Kosten je Monat (Planposten dieser Sicht, aktiv heute). */
function wiederkehrendeKosten(b: Bestand): number | null {
  const l = nurBusiness(b.planposten).filter(p => inSicht(p.firmaId, b.scope) && istAusgabe(p) && p.rhythmus !== 'einmalig' && p.ab <= b.heute && (!p.bis || p.bis >= b.heute));
  if (l.length) return l.reduce((s, p) => s + Math.abs(p.betrag) * (MONATSFAKTOR[p.rhythmus] ?? 0), 0);
  const g = b.scope === 'gesamt' ? (b.grundlageFixkosten.kdc ?? 0) + (b.grundlageFixkosten.kdv ?? 0) : b.grundlageFixkosten[b.scope] ?? 0;
  return g > 0 ? g : null;
}

/** Geplante Kosten eines Monats (Planposten, die in den Monat fallen) — optional nur eine Kategorie. */
function geplanteKostenIm(b: Bestand, m: string, kategorie?: string): number | null {
  const l = nurBusiness(b.planposten).filter(p => inSicht(p.firmaId, b.scope) && istAusgabe(p) && (!kategorie || p.kategorie === kategorie));
  if (!l.length) return null;
  let s = 0;
  for (const p of l) {
    if (p.ab.slice(0, 7) > m || (p.bis && p.bis.slice(0, 7) < m)) continue;
    if (p.rhythmus === 'einmalig') { if (p.ab.slice(0, 7) === m) s += Math.abs(p.betrag); continue; }
    const seit = (Number(m.slice(0, 4)) - Number(p.ab.slice(0, 4))) * 12 + (Number(m.slice(5, 7)) - Number(p.ab.slice(5, 7)));
    if (p.rhythmus === 'monatlich' || (p.rhythmus === 'quartal' && seit % 3 === 0) || (p.rhythmus === 'jaehrlich' && seit % 12 === 0)) s += Math.abs(p.betrag);
  }
  return s;
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

// ── Die Kennzahlen ──────────────────────────────────────────────────────────

export const MESSEN: Record<string, (b: Bestand) => Messung> = {
  liquiditaet(b) {
    const k = kasse(b), mk = monatsKosten(b);
    if (!k) return { luecke: 'Kontostände der Geschäftskonten fehlen' };
    if (!mk || mk.betrag <= 0) return { luecke: 'Monatliche Kosten fehlen (Ist-Monate oder wiederkehrende Planposten)' };
    const w = k.betrag / mk.betrag;
    return { wert: w, anzeige: `${zahl(w)} Monate`, quelle: `${euro(k.betrag)} ÷ ${euro(mk.betrag)}/Monat (${mk.quelle})` };
  },
  runway(b) {
    const k = kasse(b);
    if (!k) return { luecke: 'Kontostände der Geschäftskonten fehlen' };
    const ist = istMonate(b).slice(-3);
    if (!ist.length) return { luecke: 'Ist-Monate fehlen' };
    const netto = ist.reduce((s, m) => s + (m.kosten - m.umsatz), 0) / ist.length;
    if (netto <= 0) return { wert: 99, anzeige: 'kein Verbrauch', quelle: `Umsatz deckt die Kosten (Ø ${euro(-netto)} Überschuss/Monat, ${quellenText(ist)})` };
    const w = k.betrag / netto;
    return { wert: w, anzeige: `${zahl(w)} Monate`, quelle: `${euro(k.betrag)} ÷ ${euro(netto)} Netto-Verbrauch/Monat (${quellenText(ist)})` };
  },
  deckung13(b) {
    const k = kasse(b), mk = monatsKosten(b);
    if (!k) return { luecke: 'Kontostände der Geschäftskonten fehlen' };
    if (!mk || mk.betrag <= 0) return { luecke: 'Monatliche Kosten fehlen' };
    const v = vorschau(b.firmen, b.rechnungen, b.zahlungen, b.merkposten, b.heute, 13, false, b.planposten, 'real', b.scope === 'gesamt' ? undefined : b.scope, true);
    const w = v.tiefpunkt.stand / mk.betrag;
    return { wert: w, anzeige: `${zahl(w)} Monate`, quelle: `tiefster Stand ${euro(v.tiefpunkt.stand)} (${v.tiefpunkt.label})${v.engpass ? ` — Engpass ab ${v.engpass.label}` : ''}` };
  },
  quick_ratio(b) {
    const v = letzterAbschluss(b, 'kurzfrVerbindlichkeiten');
    if (!v || v.wert <= 0) return { luecke: 'Kurzfristige Verbindlichkeiten im Monatsabschluss fehlen' };
    const k = kasse(b)?.betrag ?? 0;
    const ford = offeneRechnungen(b).reduce((s, r) => s + r.betrag, 0);
    const w = (k + ford) / v.wert;
    return { wert: w, anzeige: zahl(w, 2), quelle: `(${euro(k)} Kasse + ${euro(ford)} Forderungen) ÷ ${euro(v.wert)} (Abschluss ${v.monat})` };
  },
  ueberfaellig(b) {
    const alle = nurBusiness(b.rechnungen).filter(r => inSicht(r.firmaId, b.scope) && (r.status === 'gestellt' || r.status === 'bezahlt'));
    if (!alle.length) return { luecke: 'Noch keine gestellte Rechnung' };
    const offen = offeneRechnungen(b);
    const summe = offen.reduce((s, r) => s + r.betrag, 0);
    if (!summe) return { wert: 0, anzeige: '0 %', quelle: 'nichts offen' };
    const ueber = offen.filter(r => r.faellig && r.faellig < b.heute);
    const w = (ueber.reduce((s, r) => s + r.betrag, 0) / summe) * 100;
    return { wert: w, anzeige: pz(w), quelle: `${ueber.length} von ${offen.length} offenen Rechnungen überfällig (${euro(ueber.reduce((s, r) => s + r.betrag, 0))} von ${euro(summe)})` };
  },
  dso(b) {
    const grenze = `${monatPlus(monat(b.heute), -12)}-01`;
    const l = nurBusiness(b.rechnungen).filter(r => inSicht(r.firmaId, b.scope) && r.status === 'bezahlt' && r.datum && r.bezahltAm && r.bezahltAm >= grenze && r.bezahltAm >= r.datum);
    if (l.length < 2) return { luecke: `${l.length} bezahlte Rechnung${l.length === 1 ? '' : 'en'} mit Rechnungsdatum und Zahlungseingang — mindestens 2 nötig` };
    const w = l.reduce((s, r) => s + tageZwischen(r.datum!, r.bezahltAm!), 0) / l.length;
    return { wert: w, anzeige: `${zahl(w, 0)} Tage`, quelle: `Ø über ${l.length} bezahlte Rechnungen (12 Monate)` };
  },
  konzentration(b) {
    const je = new Map<string, number>();
    for (const m of aktiveMandate(b).filter(m => m.status === 'aktiv' && m.honorar.basis === 'monat' && m.honorar.betrag > 0)) je.set(m.kunde, (je.get(m.kunde) ?? 0) + m.honorar.betrag);
    const gesamt = Array.from(je.values()).reduce((a, x) => a + x, 0);
    if (!gesamt) return { luecke: 'Keine aktiven Mandate mit Monatshonorar' };
    const [kunde, wert] = Array.from(je.entries()).sort((x, y) => y[1] - x[1])[0];
    const w = (wert / gesamt) * 100;
    return { wert: w, anzeige: pz(w), quelle: `${kunde}: ${euro(wert)} von ${euro(gesamt)} MRR (${je.size} Kunde${je.size === 1 ? '' : 'n'})` };
  },
  kostenquote(b) {
    const ist = istMonate(b);
    const u = ist.reduce((s, m) => s + m.umsatz, 0);
    if (!ist.length || u <= 0) return { luecke: 'Umsatz der letzten 12 Monate fehlt' };
    const w = (ist.reduce((s, m) => s + m.kosten, 0) / u) * 100;
    return { wert: w, anzeige: pz(w), quelle: `${euro(ist.reduce((s, m) => s + m.kosten, 0))} Kosten ÷ ${euro(u)} Umsatz · ${quellenText(ist)}` };
  },
  fixkostenquote(b) {
    const fix = wiederkehrendeKosten(b);
    const ist = istMonate(b);
    const u = ist.length ? ist.reduce((s, m) => s + m.umsatz, 0) / ist.length : 0;
    if (fix == null) return { luecke: 'Keine wiederkehrenden Kosten geplant' };
    if (u <= 0) return { luecke: 'Umsatz der letzten Monate fehlt' };
    const w = (fix / u) * 100;
    return { wert: w, anzeige: pz(w), quelle: `${euro(fix)}/Monat wiederkehrend ÷ ${euro(u)} Ø Umsatz/Monat` };
  },
  plan_ist(b) {
    const ist = istMonate(b).at(-1);
    if (!ist) return { luecke: 'Ist-Kosten des letzten Monats fehlen' };
    const plan = geplanteKostenIm(b, ist.monat);
    if (plan == null || plan <= 0) return { luecke: `Für ${ist.monat} sind keine Kosten geplant` };
    const w = Math.max(0, (ist.kosten / plan - 1) * 100);
    return { wert: w, anzeige: w ? `+${pz(w)}` : 'im Plan', quelle: `${ist.monat}: ${euro(ist.kosten)} Ist ÷ ${euro(plan)} Plan (${ist.quelle})` };
  },
  kapitaldienst(b) {
    const ist = istMonate(b);
    if (ist.length < 3) return { luecke: 'Weniger als 3 Ist-Monate' };
    const faktor = 12 / ist.length;
    const ergebnis = ist.reduce((s, m) => s + m.umsatz - m.kosten + (m.afa ?? 0), 0) * faktor;
    const geplanteRaten = nurBusiness(b.planposten).filter(p => inSicht(p.firmaId, b.scope) && p.kategorie === 'kredite' && istAusgabe(p) && p.rhythmus !== 'einmalig' && p.ab <= b.heute && (!p.bis || p.bis >= b.heute))
      .reduce((s, p) => s + Math.abs(p.betrag) * (MONATSFAKTOR[p.rhythmus] ?? 0), 0);
    const raten = geplanteRaten * 12;
    if (!raten) return { wert: 99, anzeige: 'kein Kredit', quelle: 'kein Schuldendienst in den Business-Planposten (private Kredite zählen nie)' };
    const w = ergebnis / raten;
    return { wert: w, anzeige: zahl(w, 2), quelle: `${euro(ergebnis)} Ergebnis (12 M, hochgerechnet) ÷ ${euro(raten)} Raten/Jahr` };
  },
  ek_quote(b) {
    const ek = letzterAbschluss(b, 'eigenkapital'), bs = letzterAbschluss(b, 'bilanzsumme');
    if (!ek || !bs || bs.wert <= 0) return { luecke: 'Eigenkapital und Bilanzsumme im Monatsabschluss fehlen' };
    const w = (ek.wert / bs.wert) * 100;
    return { wert: w, anzeige: pz(w), quelle: `${euro(ek.wert)} ÷ ${euro(bs.wert)} (Abschluss ${bs.monat})` };
  },

  umsatz_kopf(b) {
    const fte = b.scope === 'gesamt' ? (b.fte.kdc ?? 0) + (b.fte.kdv ?? 0) : b.fte[b.scope] ?? 0;
    if (!fte) return { luecke: 'Köpfe (FTE) sind nicht eingetragen' };
    const ist = istMonate(b);
    if (!ist.length) return { luecke: 'Umsatz der letzten Monate fehlt' };
    const u12 = (ist.reduce((s, m) => s + m.umsatz, 0) / ist.length) * 12;
    const w = u12 / fte;
    return { wert: w, anzeige: euro(w), quelle: `${euro(u12)} Umsatz/Jahr${ist.length < 12 ? ' (hochgerechnet)' : ''} ÷ ${zahl(fte)} FTE` };
  },
  personalquote(b) {
    const ist = istMonate(b);
    const u = ist.reduce((s, m) => s + m.umsatz, 0);
    if (!ist.length || u <= 0) return { luecke: 'Umsatz der letzten Monate fehlt' };
    const mitPersonal = ist.filter(m => m.personal != null);
    let personal: number, quelle: string;
    if (mitPersonal.length) {
      personal = mitPersonal.reduce((s, m) => s + (m.personal ?? 0), 0) / mitPersonal.length * ist.length;
      quelle = `Monatsabschluss (${mitPersonal.length} Monate)`;
    } else {
      // Geplantes Personal in genau den Ist-Monaten — künftige Einstellungen zählen nicht rückwirkend.
      const je = ist.map(m => geplanteKostenIm(b, m.monat, 'personal'));
      if (je.every(x => x == null)) return { luecke: 'Personalkosten fehlen (Monatsabschluss oder Planposten „Personal“)' };
      personal = je.reduce<number>((s, x) => s + (x ?? 0), 0);
      quelle = `Planposten „Personal“ in ${ist.length} Monaten`;
    }
    const w = (personal / u) * 100;
    return { wert: w, anzeige: pz(w), quelle: `${euro(personal)} ÷ ${euro(u)} Umsatz (${quelle})` };
  },
  fokuszeit(b) {
    const ab = tagMinus(b.heute, 28);
    const min = b.bloecke.filter(x => x.art === 'fokus' && x.date >= ab && x.date <= b.heute).reduce((s, x) => s + x.dauerMin, 0);
    if (!b.bloecke.some(x => x.date >= ab)) return { luecke: 'In den letzten 4 Wochen ist nichts im Wochenplan' };
    const w = min / 60 / 4;
    return { wert: w, anzeige: `${zahl(w)} h/Woche`, quelle: `${zahl(min / 60)} h Fokus-Blöcke in 4 Wochen` };
  },
  meetinglast(b) {
    if (!b.termineVollstaendig) return { luecke: 'Braucht den iCloud-Kalender (der Mac-Stand reicht nur einen Tag zurück)' };
    const ab = tagMinus(b.heute, 28);
    const l = b.termine.filter(t => t.start.slice(0, 10) >= ab && t.start.slice(0, 10) < b.heute && t.owner !== 'malin');
    const h = l.reduce((s, t) => s + Math.max(0, Math.min(12, (Date.parse(t.ende) - Date.parse(t.start)) / 3_600_000)), 0);
    const w = h / 4;
    return { wert: w, anzeige: `${zahl(w)} h/Woche`, quelle: `${l.length} Termine, ${zahl(h)} h in 4 Wochen (Kevin + gemeinsam)` };
  },
  delegation(b) {
    const ab = `${tagMinus(b.heute, 28)}T00:00:00`;
    const eigen = b.auftraege.filter(a => a.status === 'fertig' && (a.beendet ?? a.zeit ?? '') >= ab && !/^Takt/i.test(a.anlass ?? ''));
    if (!b.auftraege.length) return { luecke: 'Noch keine Agenten-Aufträge' };
    const w = eigen.length / 4;
    return { wert: w, anzeige: `${zahl(w)} / Woche`, quelle: `${eigen.length} erledigte Aufträge in 4 Wochen (ohne Routine-Takt)` };
  },
  meilensteine(b) {
    const alle = b.meilensteine.filter(m => m.bereich === 'business');
    if (!alle.length) return { luecke: 'Keine Business-Meilensteine' };
    const offen = alle.filter(m => !m.erledigt);
    if (!offen.length) return { wert: 100, anzeige: '100 %', quelle: 'alle Business-Meilensteine erledigt' };
    const ueber = offen.filter(m => m.faellig && m.faellig < b.heute).length;
    const w = offen.reduce((s, m) => s + (m.faellig && m.faellig < b.heute ? 0 : m.fortschritt), 0) / offen.length;
    return { wert: w, anzeige: pz(w), quelle: `Ø Fortschritt ${offen.length} offener Meilensteine${ueber ? `, ${ueber} überfällig (zählt 0)` : ''}` };
  },

  traktion(b) {
    if (b.traktion.score == null) return { luecke: 'In der Markttraktion ist noch nichts gemessen' };
    return { wert: b.traktion.score, anzeige: `${Math.round(b.traktion.score)}`, quelle: b.traktion.text };
  },
  run_rate(b) {
    const k = jahresKurs(b);
    if ('luecke' in k) return k;
    if (k.noetig <= 0) return { wert: 200, anzeige: 'Ziel erreicht', quelle: `${euro(k.ist)} von ${euro(k.ziel)} (${k.quelle})` };
    const w = (k.aktuell / k.noetig) * 100;
    return { wert: w, anzeige: pz(w), quelle: `Ø ${euro(k.aktuell)}/Monat von nötigen ${euro(k.noetig)}/Monat · Ziel ${euro(k.ziel)} (${k.quelle})` };
  },
  win_rate(b) {
    const q = gewinnquote(chancenInSicht(b));
    if (q.quote == null) return { luecke: `${q.gewonnen} gewonnen · ${q.verloren} verloren — ab 10 Entscheidungen eine Quote` };
    return { wert: q.quote, anzeige: pz(q.quote), quelle: `${q.gewonnen} gewonnen, ${q.verloren} verloren (ab Angebot)` };
  },
  pipeline(b) {
    const k = jahresKurs(b);
    if ('luecke' in k && !k.luecke.startsWith('Keine Ist')) return k;
    const p = prognose(chancenInSicht(b), b.heute);
    const verbleibend = 'luecke' in k ? zielDer(b) ?? 0 : k.verbleibend;
    if (verbleibend <= 0) return { wert: 99, anzeige: 'Ziel erreicht', quelle: `gewichtete Pipeline ${euro(p.gewichtet)}` };
    const w = p.gewichtet / verbleibend;
    return { wert: w, anzeige: `${zahl(w, 1)}×`, quelle: `${euro(p.gewichtet)} gewichtet ÷ ${euro(verbleibend)} Lücke zum Jahresziel` };
  },
  sales_cycle(b) {
    const grenze = tagMinus(b.heute, 365);
    const l = chancenInSicht(b).map(c => {
      const start = c.historie[0]?.am, gewonnen = c.historie.find(h => h.stufe === 'gewonnen')?.am;
      return c.stufe === 'gewonnen' && start && gewonnen && gewonnen.slice(0, 10) >= grenze ? tageZwischen(start, gewonnen) : null;
    }).filter((x): x is number => x != null && x >= 0);
    if (l.length < 2) return { luecke: `${l.length} gewonnene Deal${l.length === 1 ? '' : 's'} mit Verlauf — mindestens 2 nötig` };
    const w = l.reduce((s, x) => s + x, 0) / l.length;
    return { wert: w, anzeige: `${zahl(w, 0)} Tage`, quelle: `Ø über ${l.length} gewonnene Deals (12 Monate)` };
  },
  nrr(b) {
    const monate = Object.keys(b.mrrVerlauf).sort();
    const jetzt = monate.at(-1);
    if (!jetzt) return { luecke: 'Sammelt den MRR-Verlauf — aussagekräftig ab 3 Monaten' };
    // Start: möglichst 12 Monate zurück, mindestens 3.
    const start = monate.find(m => m >= monatPlus(jetzt, -12) && m <= monatPlus(jetzt, -3));
    if (!start) return { luecke: `MRR-Verlauf seit ${monate[0]} — aussagekräftig ab 3 Monaten` };
    const a = b.mrrVerlauf[start], z = b.mrrVerlauf[jetzt];
    const basis = Object.values(a).reduce((s, x) => s + x, 0);
    if (basis <= 0) return { luecke: `Im ${start} gab es keinen MRR` };
    const heute = Object.keys(a).reduce((s, k) => s + (z[k] ?? 0), 0);
    const w = (heute / basis) * 100;
    return { wert: w, anzeige: pz(w), quelle: `Bestandskunden aus ${start}: ${euro(basis)} → ${euro(heute)} MRR (${jetzt})` };
  },
  churn(b) {
    const grenze = tagMinus(b.heute, 365);
    const l = aktiveMandate(b).filter(m => m.start && ['aktiv', 'pausiert', 'beendet'].includes(m.status));
    if (!l.length) return { luecke: 'Keine Mandate mit Startdatum' };
    const beendet = l.filter(m => m.status === 'beendet' && m.ende && m.ende >= grenze && m.ende <= b.heute).length;
    // Ø aktive über 12 Monate: Monatsenden zählen.
    let summe = 0;
    for (let i = 0; i < 12; i++) {
      const stichtag = tagMinus(b.heute, 30 * i);
      summe += l.filter(m => m.start! <= stichtag && (!m.ende || m.ende > stichtag || m.status !== 'beendet')).length;
    }
    const schnitt = summe / 12;
    if (schnitt <= 0) return { luecke: 'Keine aktiven Mandate im letzten Jahr' };
    const w = (beendet / 12 / schnitt) * 100;
    return { wert: w, anzeige: `${zahl(w, 1)} %/Monat`, quelle: `${beendet} beendet in 12 Monaten bei Ø ${zahl(schnitt, 1)} aktiven Mandaten` };
  },
  cac(b) {
    const ist = istMonate(b).filter(m => m.marketingVertrieb != null);
    if (!ist.length) return { luecke: 'Marketing- und Vertriebskosten im Monatsabschluss fehlen' };
    const grenze = tagMinus(b.heute, 365);
    const neu = new Set(aktiveMandate(b).filter(m => m.start && m.start >= grenze && m.start <= b.heute && m.status !== 'angebot' && m.status !== 'verhandlung').map(m => m.kunde)).size;
    if (!neu) return { luecke: 'Keine neuen Kunden in den letzten 12 Monaten' };
    const kosten = ist.reduce((s, m) => s + (m.marketingVertrieb ?? 0), 0) * (12 / ist.length);
    const w = kosten / neu;
    return { wert: w, anzeige: euro(w), quelle: `${euro(kosten)} Marketing & Vertrieb (12 M) ÷ ${neu} neue Kunden` };
  },
};

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
