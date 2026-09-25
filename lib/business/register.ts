// ─── Business-Index — die Kennzahlen (eine Wahrheit) ────────────────────────
// Kevin 25.09.2026: „Die ganzen Kennzahlen des KSI-Scores sind Gold wert für
// den kompletten Business-Bereich.“ Entschieden: eigener Name (Business-Index),
// dieselbe Logik — Finanzielle Gesundheit 50 % · Unternehmer-DNA 30 % ·
// Markttraktion 20 % —, gerechnet NUR mit unseren eigenen Zahlen. Übernommen
// sind Struktur und Standard-Kennzahlen (Lehrbuch: Runway, DSO, Quick Ratio,
// Win Rate, NRR …), kein Code und keine Daten aus KEMARIS/POINCAP/HubSpot.
// Schwellen: FH-/MDNA-Marktanalyse und DevSpec 08.07. (Win Rate ≥ 25 %).
//
// Jede Kennzahl sagt, wie sie rechnet (formel), woher (quelle), was gut ist
// (gruen/rot) und — wenn Daten fehlen — wie man die Lücke schließt.

export type SaeuleId = 'fh' | 'ud' | 'mt';
export type Scope = 'gesamt' | 'kdc' | 'kdv';
export const SCOPES: { id: Scope; label: string }[] = [
  { id: 'gesamt', label: 'Gesamt' },
  { id: 'kdc', label: 'Consulting' },
  { id: 'kdv', label: 'KD Ventures' },
];

export const SAEULEN: { id: SaeuleId; label: string; gewicht: number; satz: string }[] = [
  { id: 'fh', label: 'Finanzielle Gesundheit', gewicht: 0.5, satz: 'Liquidität, Forderungen, Ausgaben, Kapital' },
  { id: 'ud', label: 'Unternehmer-DNA', gewicht: 0.3, satz: 'Produktivität und wie der Unternehmer arbeitet' },
  { id: 'mt', label: 'Markttraktion', gewicht: 0.2, satz: 'Vertrieb, Kunden, Wachstum' },
];

import type { KennzahlDefBasis, Schwelle as KernSchwelle } from '@/lib/kennzahlen/kern';
import { WEG } from '@/lib/wege';
export type { Einheit, Richtung } from '@/lib/kennzahlen/kern';

export interface KennzahlDef extends KennzahlDefBasis {
  saeule: SaeuleId;
  /** Nur in der Gesamtsicht (personen- oder firmenübergreifend). */
  nurGesamt?: boolean;
  /** Gilt in diesen Sichten nicht (z. B. operative Vertriebskennzahlen für die Holding). */
  nichtFuer?: Scope[];
}

const ABSCHLUSS = { text: 'Monatsabschluss eintragen', href: WEG.abschluss() };
const RECHNUNGEN = { text: 'Rechnungen pflegen', href: WEG.rechnungen() };
const KONTEN = { text: 'Kontostände pflegen', href: WEG.kontostaende() };
const PLANPOSTEN = { text: 'Planposten pflegen', href: WEG.planposten() };
const EINSTELLUNGEN = (text: string) => ({ text, href: WEG.einstellungen() });
const MANDATE = { text: 'Mandate pflegen', href: WEG.mandat() };
const DEALS = { text: 'Deals pflegen', href: WEG.deals() };

export const KENNZAHLEN: KennzahlDef[] = [
  // ── Finanzielle Gesundheit · Liquidität ──
  { id: 'liquiditaet', label: 'Liquidität', saeule: 'fh', gruppe: 'Liquidität', gewicht: 1.5, einheit: 'monate', richtung: 'hoch', gruen: 3, rot: 1,
    formel: 'Kontostände der Geschäftskonten ÷ monatliche Kosten', quelle: 'Kontostände (Finanzplanung) + Kosten der letzten 3 Monate',
    luecke: 'Kontostände und Monatskosten fehlen', pflegen: KONTEN },
  { id: 'runway', label: 'Runway', saeule: 'fh', gruppe: 'Liquidität', gewicht: 1.5, einheit: 'monate', richtung: 'hoch', gruen: 6, rot: 3,
    formel: 'Liquidität ÷ Ø Netto-Verbrauch (Kosten − Umsatz) der letzten 3 Monate', quelle: 'Kontostände + Ist-Monate',
    luecke: 'Kontostände oder Ist-Monate fehlen', pflegen: KONTEN },
  { id: 'deckung13', label: '13-Wochen-Deckung', saeule: 'fh', gruppe: 'Liquidität', gewicht: 1.25, einheit: 'monate', richtung: 'hoch', gruen: 1, rot: 0,
    formel: 'tiefster Kassenstand der 13-Wochen-Vorschau ÷ monatliche Kosten', quelle: 'Liquiditäts-Vorschau (Rechnungen, Zahlungen, Planposten)',
    luecke: 'Kontostände fehlen', pflegen: { text: 'Liquidität öffnen', href: WEG.liquiditaet() } },
  { id: 'quick_ratio', label: 'Quick Ratio', saeule: 'fh', gruppe: 'Liquidität', einheit: 'faktor', richtung: 'hoch', gruen: 1, rot: 0.8,
    formel: '(Kasse + offene Forderungen) ÷ kurzfristige Verbindlichkeiten', quelle: 'Kontostände, Rechnungen, Monatsabschluss',
    luecke: 'Kurzfristige Verbindlichkeiten fehlen', pflegen: ABSCHLUSS },
  // ── Forderungen ──
  { id: 'ueberfaellig', label: 'Überfällige Forderungen', saeule: 'fh', gruppe: 'Forderungen', gewicht: 1.25, einheit: 'prozent', richtung: 'niedrig', gruen: 10, rot: 25,
    formel: 'überfälliger Betrag ÷ offener Betrag gestellter Rechnungen', quelle: 'Rechnungen (Finanzplanung)',
    luecke: 'Noch keine Rechnung gestellt', pflegen: RECHNUNGEN },
  { id: 'dso', label: 'DSO (Zahlungsdauer)', saeule: 'fh', gruppe: 'Forderungen', einheit: 'tage', richtung: 'niedrig', gruen: 40, rot: 55,
    formel: 'Ø Tage von Rechnungsdatum bis Zahlungseingang (12 Monate)', quelle: 'Rechnungen mit Datum und „bezahlt am“',
    luecke: 'Mindestens 2 bezahlte Rechnungen mit Rechnungsdatum und Zahlungseingang nötig', pflegen: RECHNUNGEN },
  { id: 'konzentration', label: 'Kundenkonzentration', saeule: 'fh', gruppe: 'Forderungen', nichtFuer: ['kdv'], einheit: 'prozent', richtung: 'niedrig', gruen: 30, rot: 50,
    formel: 'größter Kunde ÷ monatlicher Honorarumsatz (MRR)', quelle: 'aktive Mandate mit Monatshonorar',
    luecke: 'Keine aktiven Mandate mit Monatshonorar', pflegen: MANDATE },
  // ── Ausgaben ──
  { id: 'kostenquote', label: 'Kostenquote (CIR)', saeule: 'fh', gruppe: 'Ausgaben', einheit: 'prozent', richtung: 'niedrig', gruen: 85, rot: 95,
    formel: 'Kosten ÷ Umsatz der letzten 12 Monate', quelle: 'Ist-Monate (Monatsabschluss, Grundlage, Controlling)',
    luecke: 'Umsatz der letzten 12 Monate fehlt', pflegen: ABSCHLUSS },
  { id: 'fixkostenquote', label: 'Fixkostenquote', saeule: 'fh', gruppe: 'Ausgaben', einheit: 'prozent', richtung: 'niedrig', gruen: 50, rot: 70,
    formel: 'wiederkehrende Kosten je Monat ÷ Ø Umsatz je Monat', quelle: 'Planposten (wiederkehrend) bzw. Fixkosten + Ist-Umsatz',
    luecke: 'Wiederkehrende Kosten oder Umsatz fehlen', pflegen: PLANPOSTEN },
  { id: 'plan_ist', label: 'Kosten über Plan', saeule: 'fh', gruppe: 'Ausgaben', einheit: 'prozent', richtung: 'niedrig', gruen: 5, rot: 15,
    formel: 'Ist-Kosten ÷ geplante Kosten − 1 (letzter abgeschlossener Monat; unter Plan = 0)', quelle: 'Planposten + Ist-Monat',
    luecke: 'Plan oder Ist-Kosten des letzten Monats fehlen', pflegen: ABSCHLUSS },
  // ── Kapital ──
  { id: 'kapitaldienst', label: 'Kapitaldienstfähigkeit', saeule: 'fh', gruppe: 'Kapital', einheit: 'faktor', richtung: 'hoch', gruen: 1.2, rot: 1,
    formel: '(Ergebnis + Abschreibungen, 12 Monate) ÷ Schuldendienst (Raten, 12 Monate)', quelle: 'Ist-Monate, Monatsabschluss, Kredite',
    luecke: 'Ergebnis der letzten 12 Monate fehlt', pflegen: ABSCHLUSS },
  { id: 'ek_quote', label: 'Eigenkapitalquote', saeule: 'fh', gruppe: 'Kapital', einheit: 'prozent', richtung: 'hoch', gruen: 30, rot: 10,
    formel: 'Eigenkapital ÷ Bilanzsumme', quelle: 'Monatsabschluss (BWA/Bilanz)',
    luecke: 'Eigenkapital und Bilanzsumme fehlen', pflegen: ABSCHLUSS },

  { id: 'break_even', label: 'Break-even-Abstand', saeule: 'fh', gruppe: 'Ausgaben', einheit: 'prozent', richtung: 'hoch', gruen: 30, rot: 10, gewicht: 1.25,
    formel: '(Ø Umsatz − Break-even-Umsatz) ÷ Ø Umsatz; Break-even = Fixkosten ÷ Deckungsbeitragsquote', quelle: 'Ist-Monate + wiederkehrende Kosten',
    luecke: 'Umsatz und wiederkehrende Kosten der letzten Monate fehlen', pflegen: PLANPOSTEN },

  // ── Unternehmer-DNA ──
  { id: 'umsatz_kopf', label: 'Umsatz je Kopf', saeule: 'ud', gruppe: 'Produktivität', nichtFuer: ['kdv'], einheit: 'eur', richtung: 'hoch', gruen: 120_000, rot: 80_000,
    formel: 'Umsatz der letzten 12 Monate ÷ Köpfe (FTE)', quelle: 'Ist-Monate + FTE-Einstellung',
    luecke: 'Köpfe (FTE) oder Umsatz fehlen', pflegen: EINSTELLUNGEN('Köpfe eintragen') },
  { id: 'personalquote', label: 'Personalaufwandsquote', saeule: 'ud', gruppe: 'Produktivität', einheit: 'prozent', richtung: 'niedrig', gruen: 60, rot: 75,
    formel: 'Personalkosten ÷ Umsatz der letzten 12 Monate', quelle: 'Monatsabschluss (Personal) bzw. Planposten „Personal“',
    luecke: 'Personalkosten fehlen', pflegen: ABSCHLUSS },
  { id: 'auslastung', label: 'Auslastung', saeule: 'ud', gruppe: 'Produktivität', einheit: 'prozent', richtung: 'hoch', gruen: 70, rot: 50, nichtFuer: ['kdv'],
    formel: 'fakturierte Tage ÷ verfügbare Beratertage (Kapazität), letzte Monate', quelle: 'Monatsabschluss (fakturierte Tage) + Kapazität je Firma',
    luecke: 'Fakturierte Tage im Monatsabschluss oder Kapazität fehlen', pflegen: ABSCHLUSS },
  { id: 'tagessatz', label: 'Effektiver Tagessatz', saeule: 'ud', gruppe: 'Produktivität', einheit: 'eur', richtung: 'hoch', gruen: 1200, rot: 800, nichtFuer: ['kdv'],
    formel: 'Umsatz ÷ fakturierte Tage (letzte Monate)', quelle: 'Monatsabschluss (Umsatz, fakturierte Tage)',
    luecke: 'Fakturierte Tage im Monatsabschluss fehlen', pflegen: ABSCHLUSS },
  { id: 'fokuszeit', label: 'Fokuszeit', saeule: 'ud', gruppe: 'Arbeitsweise', einheit: 'stunden', richtung: 'hoch', gruen: 10, rot: 4, nurGesamt: true,
    formel: 'geplante Fokus-Blöcke je Woche (Ø 4 Wochen)', quelle: 'Kalender · Wochenplan',
    luecke: 'Noch keine Fokus-Blöcke geplant', pflegen: { text: 'Fokus-Blöcke planen', href: WEG.woche() } },
  { id: 'meetinglast', label: 'Meeting-Last', saeule: 'ud', gruppe: 'Arbeitsweise', einheit: 'stunden', richtung: 'niedrig', gruen: 20, rot: 30, nurGesamt: true,
    formel: 'Termin-Stunden je Woche in Kevins und den gemeinsamen Kalendern (Ø 4 Wochen)', quelle: 'Apple Kalender (iCloud)',
    luecke: 'Kalender-Stand fehlt', pflegen: { text: 'Kalender öffnen', href: WEG.woche() } },
  { id: 'delegation', label: 'Delegation an Agenten', saeule: 'ud', gruppe: 'Arbeitsweise', einheit: 'anzahl', richtung: 'hoch', gruen: 10, rot: 3, nurGesamt: true,
    formel: 'erledigte Agenten-Aufträge je Woche, die ihr angestoßen habt (ohne Routine-Takt, Ø 4 Wochen)', quelle: 'Jarvis-Aufträge',
    luecke: 'Noch keine Agenten-Aufträge', pflegen: { text: 'Agenten öffnen', href: WEG.agenten() } },
  { id: 'meilensteine', label: 'Meilenstein-Kurs', saeule: 'ud', gruppe: 'Arbeitsweise', einheit: 'prozent', richtung: 'hoch', gruen: 70, rot: 40, nurGesamt: true,
    formel: 'Ø Fortschritt offener Business-Meilensteine (überfällige zählen 0)', quelle: 'Meilensteine (Bereich Business)',
    luecke: 'Keine Business-Meilensteine', pflegen: { text: 'Meilensteine pflegen', href: WEG.jahr() } },

  // ── Markttraktion ──
  { id: 'traktion', label: 'Traktions-Score', saeule: 'mt', gruppe: 'Vertrieb', einheit: 'punkte', richtung: 'hoch', gruen: 70, rot: 40, nurGesamt: true, direkt: true,
    formel: 'Sales 50 · Marketing 40 · Event 10 (geometrisches Mittel der Ampeln)', quelle: 'Markttraktion',
    luecke: 'In der Markttraktion ist noch nichts gemessen', pflegen: { text: 'Markttraktion öffnen', href: WEG.markttraktion() } },
  { id: 'run_rate', label: 'Umsatz-Kurs', saeule: 'mt', gruppe: 'Wachstum', einheit: 'prozent', richtung: 'hoch', gruen: 100, rot: 70,
    formel: 'Ø Monatsumsatz ÷ nötiger Monatsumsatz fürs Jahresziel', quelle: 'Jahresziel (gesamt: Controlling · je Firma: Einstellungen) + Ist-Monate',
    luecke: 'Jahresumsatzziel oder Ist-Monate fehlen', pflegen: EINSTELLUNGEN('Ziel eintragen') },
  { id: 'win_rate', label: 'Win Rate', saeule: 'mt', gruppe: 'Vertrieb', nichtFuer: ['kdv'], einheit: 'prozent', richtung: 'hoch', gruen: 25, rot: 15,
    formel: 'gewonnen ÷ (gewonnen + verloren), ab Angebot', quelle: 'Deals (Pipeline)',
    luecke: 'Ab 10 Entscheidungen (gewonnen oder verloren) aussagekräftig', pflegen: DEALS },
  { id: 'pipeline', label: 'Pipeline-Deckung', saeule: 'mt', gruppe: 'Vertrieb', nichtFuer: ['kdv'], einheit: 'faktor', richtung: 'hoch', gruen: 3, rot: 1,
    formel: 'gewichtete Pipeline ÷ Umsatzlücke zum Jahresziel', quelle: 'Deals + Jahresziel',
    luecke: 'Jahresumsatzziel fehlt', pflegen: EINSTELLUNGEN('Ziel eintragen') },
  { id: 'sales_cycle', label: 'Sales Cycle', saeule: 'mt', gruppe: 'Vertrieb', nichtFuer: ['kdv'], einheit: 'tage', richtung: 'niedrig', gruen: 60, rot: 120,
    formel: 'Ø Tage vom Anlegen eines Deals bis „gewonnen“ (12 Monate)', quelle: 'Deals mit Stufen-Verlauf',
    luecke: 'Mindestens 2 gewonnene Deals mit Verlauf nötig', pflegen: DEALS },
  { id: 'recurring', label: 'Wiederkehrender Umsatz', saeule: 'mt', gruppe: 'Geschäftsmodell', einheit: 'prozent', richtung: 'hoch', gruen: 60, rot: 30, nichtFuer: ['kdv'],
    formel: 'Monatshonorare (MRR) × 12 ÷ Umsatz der letzten 12 Monate', quelle: 'aktive Mandate + Ist-Monate',
    luecke: 'MRR oder Umsatz der letzten Monate fehlen', pflegen: MANDATE },
  { id: 'ltv', label: 'Kundenwert (LTV)', saeule: 'mt', gruppe: 'Geschäftsmodell', einheit: 'eur', richtung: 'hoch', gruen: 30000, rot: 10000, nichtFuer: ['kdv'],
    formel: 'Ø Monatshonorar je Kunde × Ø Laufzeit der Mandate (Monate)', quelle: 'Mandate (Honorar, Start, Ende)',
    luecke: 'Keine Mandate mit Monatshonorar und Startdatum', pflegen: MANDATE },
  { id: 'ltv_cac', label: 'LTV ÷ Gewinnungskosten', saeule: 'mt', gruppe: 'Geschäftsmodell', einheit: 'faktor', richtung: 'hoch', gruen: 3, rot: 1, nichtFuer: ['kdv'],
    formel: 'Kundenwert (LTV) ÷ Kundengewinnungskosten (CAC)', quelle: 'LTV + CAC',
    luecke: 'Kundenwert oder Kundengewinnungskosten fehlen', pflegen: ABSCHLUSS },
  { id: 'nrr', label: 'Net Revenue Retention', saeule: 'mt', gruppe: 'Kunden', nichtFuer: ['kdv'], einheit: 'prozent', richtung: 'hoch', gruen: 110, rot: 100,
    formel: '(MRR Start + Ausbau − Rückgang − Kündigung) ÷ MRR Start, Bestandskunden', quelle: 'Monats-Schnappschüsse des MRR',
    luecke: 'Sammelt den MRR-Verlauf — aussagekräftig ab 3 Monaten', pflegen: MANDATE },
  { id: 'churn', label: 'Kündigungsrate', saeule: 'mt', gruppe: 'Kunden', nichtFuer: ['kdv'], einheit: 'prozent', richtung: 'niedrig', gruen: 1, rot: 2.5,
    formel: 'beendete Mandate je Monat ÷ aktive Mandate (12 Monate)', quelle: 'Mandate (Start/Ende)',
    luecke: 'Keine Mandate mit Start-/Enddatum', pflegen: MANDATE },
  { id: 'cac', label: 'Kundengewinnungskosten', saeule: 'mt', gruppe: 'Kunden', nichtFuer: ['kdv'], einheit: 'eur', richtung: 'niedrig', gruen: 2500, rot: 5000,
    formel: '(Marketing + Vertrieb, 12 Monate) ÷ neue Kunden', quelle: 'Monatsabschluss (Marketing & Vertrieb) + Mandate',
    luecke: 'Marketing-/Vertriebskosten oder neue Kunden fehlen', pflegen: ABSCHLUSS },
];

export const KENNZAHL = Object.fromEntries(KENNZAHLEN.map(k => [k.id, k])) as Record<string, KennzahlDef>;

/** Die Kennzahlen, die in einer Sicht gelten. */
export const kennzahlenFuer = (scope: Scope) => KENNZAHLEN.filter(k => (scope === 'gesamt' || !k.nurGesamt) && !k.nichtFuer?.includes(scope));

export type Schwelle = KernSchwelle;

/**
 * Eine eigene Schwelle prüfen (Feinjustierung): Zahlen, und die Richtung muss
 * stimmen (hoch: grün > rot · niedrig: grün < rot) — sonst wäre die Ampel verdreht.
 */
export function schwelleSauber(id: string, roh: { gruen?: unknown; rot?: unknown }): { ok: true; schwelle: Schwelle } | { ok: false; fehler: string } {
  const k = KENNZAHL[id];
  if (!k) return { ok: false, fehler: 'Unbekannte Kennzahl.' };
  const gruen = Number(roh.gruen), rot = Number(roh.rot);
  if (!Number.isFinite(gruen) || !Number.isFinite(rot)) return { ok: false, fehler: 'Bitte zwei Zahlen eintragen.' };
  if (k.richtung === 'hoch' ? !(gruen > rot) : !(gruen < rot)) return { ok: false, fehler: k.richtung === 'hoch' ? 'Grün muss über Rot liegen (mehr ist besser).' : 'Grün muss unter Rot liegen (weniger ist besser).' };
  return { ok: true, schwelle: { gruen: Math.round(gruen * 1000) / 1000, rot: Math.round(rot * 1000) / 1000 } };
}

