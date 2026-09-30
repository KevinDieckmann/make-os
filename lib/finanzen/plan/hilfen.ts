// ─── Finanzplanung jetzt — kleine, reine Helfer für Seite und Routen ─────────
// Client-sicher (keine Server-Importe): Beschriftungen, Zahlenformat, die
// Zeitachse (Historie Jan–Sep 26 + Plan Okt 26–Dez 28) und Zähler, die in
// mehreren Ansichten gebraucht werden. Gerechnet wird NUR im Rechenkern.

import type { Einheit, FinanzDaten, Zeile } from '@/lib/finanzen/rechenkern';
import { histIndex } from '@/lib/finanzen/rechenkern';
import { UG_KURZ, finanzOrtAusKern, finanzOrtName } from '@/lib/einheiten';

export const KAL = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'] as const;

/** Namen aus der einen Einheitenliste (lib/einheiten.ts); die Kern-Kennung `selbststaendigkeit` ist kdc. */
export const EINHEIT_LABEL: Record<Einheit, string> = { privat: finanzOrtName('privat'), selbststaendigkeit: finanzOrtName(finanzOrtAusKern('selbststaendigkeit')), ug: finanzOrtName('ug'), kdv: finanzOrtName('kdv') };
export const TYP_LABEL: Record<NonNullable<Zeile['typ']>, string> = { fix: 'Fixkosten', jahr: 'Jahreskosten-Topf', flex: 'Flexibel', sparen: 'Sparen' };
/** Gruppe je Budget-Art — das Privat-Blatt sortiert danach. */
export const TYP_GRUPPE: Record<NonNullable<Zeile['typ']>, string> = { fix: 'Fixkosten', jahr: 'Jahreskosten & Puffer', flex: 'Flexibel', sparen: 'Sparen' };
export const BUDGET_GRUPPEN = ['Fixkosten', 'Jahreskosten & Puffer', 'Flexibel', 'Sparen'] as const;

/** Sonderziele einer Buchung, die keine Planzeile sind. */
export const SONDER_ZEILEN: Record<string, string> = {
  'x.einnahme': 'Einnahme verlässlich', 'x.einmalig': 'Einnahme einmalig', 'x.kredit': 'Kredit erhalten', 'x.umbuchung': 'Umbuchung', 'x.offen': 'Noch nicht zugeordnet',
};
/** Berechnete Zeilen, die man je Zelle überschreiben kann. */
export const RECHENZEILEN: Record<string, string> = {
  'ug.ob': 'Ankermandat', 'ug.retainer': 'Retainer', 'ug.astarna': 'ASTARNA', 'ug.events': 'Events', 'ug.kevin': 'Kevin brutto', 'ug.malin': 'Malin brutto',
  'ug.unterstuetzung': 'Unterstützung', 'p.kevinNetto': 'Kevin netto', 'p.malinNetto': 'Malin netto', 'p.malinSelbst': 'Malin brutto (Selbstständigkeit)',
};

// ── Aufbau (Kevin 27.09. abends: acht Bereiche, die alten Unterseiten leben darunter weiter) ──
// Lage → Planen (Szenarien bauen · Treiber & Annahmen) → Privat → Business (MAKE Innovation GmbH · KD Ventures · Selbstständigkeit)
// → Gesamt (Gesamt · Entwicklung · Geldfluss) → Buchungen & Check (Buchungen · Budget · Wochen-Check · Zu erledigen ·
// Kalender & Verträge · Schulden) → Ziele & Töpfe (Ziele · Töpfe MAKE) → Protokoll. Alte `?u=`-Werte lösen weiter auf.
export type Bereich = 'lage' | 'planen' | 'privat' | 'business' | 'gesamt' | 'buchungen' | 'ziele' | 'protokoll';
export type Unterseite =
  | 'lage' | 'check' | 'budget' | 'buchungen' | 'privat' | 'ug' | 'toepfe' | 'kdv' | 'selbst' | 'szenarien' | 'ziele'
  | 'schulden' | 'posten' | 'kalender' | 'entwicklung' | 'geldfluss' | 'protokoll' | 'planen' | 'gesamt';
export const BEREICHE: { id: Bereich; label: string; unter: { id: Unterseite; label: string }[] }[] = [
  { id: 'lage', label: 'Lage', unter: [{ id: 'lage', label: 'Lage' }] },
  { id: 'planen', label: 'Planen', unter: [{ id: 'planen', label: 'Szenarien bauen' }, { id: 'szenarien', label: 'Treiber & Annahmen' }] },
  { id: 'privat', label: 'Privat', unter: [{ id: 'privat', label: 'Privat' }] },
  { id: 'business', label: 'Business', unter: [{ id: 'ug', label: finanzOrtName('ug') }, { id: 'kdv', label: 'KD Ventures' }, { id: 'selbst', label: 'Selbstständigkeit' }] },
  { id: 'gesamt', label: 'Gesamt', unter: [{ id: 'gesamt', label: 'Gesamt' }, { id: 'entwicklung', label: 'Entwicklung' }, { id: 'geldfluss', label: 'Geldfluss' }] },
  { id: 'buchungen', label: 'Buchungen & Check', unter: [{ id: 'buchungen', label: 'Buchungen' }, { id: 'budget', label: 'Budget' }, { id: 'check', label: 'Wochen-Check' }, { id: 'posten', label: 'Zu erledigen' }, { id: 'kalender', label: 'Kalender & Verträge' }, { id: 'schulden', label: 'Schulden' }] },
  { id: 'ziele', label: 'Ziele & Töpfe', unter: [{ id: 'ziele', label: 'Ziele' }, { id: 'toepfe', label: `Töpfe ${UG_KURZ}` }] },
  { id: 'protokoll', label: 'Protokoll', unter: [{ id: 'protokoll', label: 'Protokoll' }] },
];
export const bereichVon = (u: Unterseite): Bereich => BEREICHE.find(b => b.unter.some(x => x.id === u))?.id ?? 'lage';
export const istUnterseite = (v: unknown): v is Unterseite => BEREICHE.some(b => b.unter.some(x => x.id === v));

// ── Zahlen ──────────────────────────────────────────────────────────────────
const FORMATE = new Map<number, Intl.NumberFormat>();
/** Betrag in Euro ohne Zeichen: 1.234 · 1.234,50. Leer bei null/NaN. */
export function eur(v: number | null | undefined, dezimal = 0): string {
  if (v == null || Number.isNaN(v) || !Number.isFinite(v)) return '';
  let f = FORMATE.get(dezimal);
  if (!f) { f = new Intl.NumberFormat('de-DE', { maximumFractionDigits: dezimal, minimumFractionDigits: dezimal }); FORMATE.set(dezimal, f); }
  return f.format(v);
}
export const prozent = (v: number, dezimal = 0) => `${eur(v * 100, dezimal)} %`;

/**
 * Eingabe → Zahl. Deutsch (1.234,50) und englisch (1234.50) werden verstanden,
 * „€“ und Leerzeichen ignoriert. Leer → null; Unsinn → NaN.
 */
export function parseBetrag(eingabe: string): number | null {
  let s = String(eingabe ?? '').trim().replace(/\s|€/g, '');
  if (s === '') return null;
  if (/,/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const v = Number(s);
  return Number.isNaN(v) ? NaN : v;
}

// ── Zeitachse ───────────────────────────────────────────────────────────────
/** Historie + Plan als eine Achse: Index 0 = Jan 26, 8 = Sep 26, 9 = Okt 26 (Plan-Monat 1). */
export const achse = (d: Pick<FinanzDaten, 'historie' | 'monate'>): string[] => [...d.historie, ...d.monate];
export const heuteIndex = (d: Pick<FinanzDaten, 'einstellungen'>): number => histIndex(d.einstellungen.heute);
/** Der letzte volle Monat — der laufende bleibt bei Durchschnitten draußen. */
export const letzterVoller = (d: Pick<FinanzDaten, 'einstellungen'>): number => Math.max(0, heuteIndex(d) - 1);
/** Tage im Monat eines Achsen-Index (Jan 26 = 0). */
export function tageIm(idx: number): number { const j = 2026 + Math.floor(idx / 12), mo = (idx % 12) + 1; return new Date(j, mo, 0).getDate(); }
/** Plan-Monat (≥ 1) zu einem Achsen-Index; Monate vor dem Plan nehmen den ersten Planmonat als Maßstab. */
export const planMonatAus = (idx: number, d: Pick<FinanzDaten, 'historie'>): number => Math.max(1, idx - d.historie.length + 1);
/** Achsen-Label eines Plan-Monats (1 = Okt 26). */
export const monatLabel = (d: Pick<FinanzDaten, 'monate'>, m: number): string => d.monate[Math.min(Math.max(1, m), d.monate.length) - 1] ?? '';
/** „27.09.“ aus JJJJ-MM-TT. */
export const tagKurz = (datum: string): string => (datum && datum.length >= 10 ? `${datum.slice(8, 10)}.${datum.slice(5, 7)}.` : '');
export const datumLang = (datum: string): string => (datum && datum.length >= 10 ? `${datum.slice(8, 10)}.${datum.slice(5, 7)}.${datum.slice(0, 4)}` : '');
export const plusTage = (datum: string, n: number): string => new Date(new Date(`${datum}T00:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);

// ── Zeilen und Zähler ───────────────────────────────────────────────────────
export const alleZeilen = (d: Pick<FinanzDaten, 'sachkosten' | 'privatEinnahmen' | 'privatBudget' | 'privatSchulden'>): Zeile[] => [...d.sachkosten, ...d.privatEinnahmen, ...d.privatBudget, ...d.privatSchulden];
export function zeileName(d: Pick<FinanzDaten, 'sachkosten' | 'privatEinnahmen' | 'privatBudget' | 'privatSchulden'>, id: string): string {
  const z = alleZeilen(d).find(x => x.id === id);
  return z?.name ?? SONDER_ZEILEN[id] ?? RECHENZEILEN[id] ?? id;
}
export const offeneBuchungen = (d: Pick<FinanzDaten, 'buchungen'>): number => d.buchungen.filter(b => b.z === 'x.offen').length;
export const OFFENE_STATUS = ['erledigt', 'bezahlt'];
export const postenOffen = (p: { status: string }) => !OFFENE_STATUS.includes(p.status);
/** Posten, die binnen 7 Tagen fällig sind oder überfällig — Zähler für den Bereich Verpflichtungen. */
export function faelligeZahl(d: Pick<FinanzDaten, 'posten' | 'einstellungen'>): number {
  const in7 = plusTage(d.einstellungen.heute, 7);
  return d.posten.filter(p => p.art !== 'konto' && postenOffen(p) && p.faellig && p.faellig <= in7).length;
}
/** Kennung für neue Einträge — kurz, lesbar, praktisch eindeutig. */
export { neueKennung } from '@/lib/kennung';

/** Person aus alten Einträgen („Kevin“, „Malin“, „beide“) auf Speichernamen bringen. */
export const personKennung = (wer: string | null | undefined): string => String(wer ?? '').trim().toLowerCase();
