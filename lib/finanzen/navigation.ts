// ─── Finanzen — der Aufbau in höchstens zwei Ebenen (rein, client-sicher) ────
// Kevin 08.10.: „Die Software wirkt unaufgeräumt und überladen.“ Aufräumen Etappe 2: Finanzen hat EINE Reiterleiste je Bereich
// (Ebene 1) und — nur wo nötig — eine Pillenreihe darunter (Ebene 2). Der Bereich kommt aus der Adresse (`space`), sonst aus dem
// Reiter (`s`), sonst aus dem Kopf-Schalter (gemerkter Space); ohne Haushaltszugang immer Business. Privat darf Business sehen
// (Planung zeigt dort alles), Business nie Privat — die Daten filtert weiter der Server (lib/finanzen/plan/sicht.ts).
//
//   Privat    Überblick (s=privat: Privat-Index, Für dich, Übersicht, #gesamt = die Brücke Privat → Business)
//             Konten & Buchungen (s=privat&t=…: Buchungen · Einnahmen · Analyse · Fixkosten & Budget · Ist gegen Soll ·
//                                 Schulden & Rechnungen · Buchungen der Selbstständigkeit = s=buchungen&space=privat)
//             Planung (s=finanzplanung&space=privat&u=<Blatt>; Selbstständigkeit trägt den Altbestand #altbestand)
//             Steuern (s=steuern&space=privat)
//   Business  Überblick (s=business: Cockpit · s=controlling: Controlling & Ziele)
//             Rechnungen & Zahlungen (s=rechnungen) · Liquidität (s=liquiditaet) · Buchungen (s=buchungen)
//             Planung (s=finanzplanung&space=business&u=<Blatt>) · Steuern (s=steuern)
//   Head of Finance (s=chef) ist ein Knopf auf der Seite.
//
// Werkzeug Finanzen (22.10. abends, Gruppe A — Kevin: „Ja, alle Empfehlungen“): Ebene 1 ist das MENÜ in der linken Leiste (lib/make-one/werkzeuge.ts
// `FINANZEN_WERKZEUG` liest NUR `FINANZ_MENUE` — keine zweite Liste), die Reiterleiste der Seite ist weg; Pillen bleiben Ebene 2 (Konten & Buchungen, Blätter der
// Planung), nie eine dritte. Cockpit und Controlling & Ziele sind zwei Menüpunkte (ihre Pillenreihe ist weg). Business gruppiert: Überblick (Cockpit, Controlling &
// Ziele) · Geldfluss (Rechnungen & Zahlungen, Liquidität, Buchungen) · Planung & Pflichten (Planung, Steuern); dahinter „Automationen & Head“ (= s=chef: Head of
// Finance mit Monatsabschluss und Rechnung) und im Fuß Einstellungen · 0-Punkt (Anker im Cockpit). Privat: Überblick (mit #gesamt) · Konten & Buchungen ·
// Planung · Steuern, „Automationen & Head“ (Head „Finanzen privat“, keine Prozesse), im Fuß der Altbestand.

import { PRIVAT_GESELLSCHAFTEN, finanzOrtName, gehoertZuPrivat } from '@/lib/einheiten';

export type FinanzBereich = 'privat' | 'business';
/** Reiter der Ebene 1. `privat` = Privat › Überblick, `business` = Business › Cockpit. */
export type FinanzReiter = 'privat' | 'konten' | 'business' | 'rechnungen' | 'liquiditaet' | 'buchungen' | 'finanzplanung' | 'steuern';
/** Alle gültigen Werte von `s` (Reiter, Ebene-2-Kennungen, Head of Finance und der alte Name „gesamt“). */
export const FINANZ_S = ['privat', 'business', 'controlling', 'rechnungen', 'liquiditaet', 'buchungen', 'finanzplanung', 'steuern', 'chef', 'gesamt'] as const;
export type FinanzS = typeof FINANZ_S[number];

/** Ein Punkt des Menüs (Ebene 1). `controlling` ist seit 22.10. abends ein eigener Punkt (vorher Ebene 2 unter Business › Überblick). */
export type FinanzMenueId = FinanzReiter | 'controlling';
export interface FinanzMenuePunkt { id: FinanzMenueId; label: string; titel: string; gruppe?: string }
/** Das Menü je Bereich — die EINE Liste für die Leiste (Werkzeug), die Schnellsuche und die Seite (was sie zeigt). */
export const FINANZ_MENUE: Readonly<Record<FinanzBereich, readonly FinanzMenuePunkt[]>> = {
  privat: [
    { id: 'privat', label: 'Überblick', titel: 'Privat-Index, was ansteht und was das Business fürs Leben bringen muss — unten die Brücke Gesamt' },
    { id: 'konten', label: 'Konten & Buchungen', titel: 'Eure Konten, Buchungen, Budgets und Schulden' },
    { id: 'finanzplanung', label: 'Planung', titel: 'Szenarien, Blätter und Ist-Abgleich' },
    { id: 'steuern', label: 'Steuern', titel: 'Fristen, Rücklage, Übergabe an den Steuerberater' },
  ],
  business: [
    { id: 'business', label: 'Cockpit', titel: 'Finanzielle Gesundheit, Konten und Fälliges der Gesellschaften', gruppe: 'Überblick' },
    { id: 'controlling', label: 'Controlling & Ziele', titel: 'Kurs aufs Jahresziel, Run-Rate und Runway', gruppe: 'Überblick' },
    { id: 'rechnungen', label: 'Rechnungen & Zahlungen', titel: 'Was reinkommt, was raus muss — in welcher Reihenfolge', gruppe: 'Geldfluss' },
    { id: 'liquiditaet', label: 'Liquidität', titel: 'Wie viel Geld wann da ist', gruppe: 'Geldfluss' },
    { id: 'buchungen', label: 'Buchungen', titel: 'Was auf den Konten der Gesellschaften passiert ist', gruppe: 'Geldfluss' },
    { id: 'finanzplanung', label: 'Planung', titel: 'Szenarien, Blätter und Ist-Abgleich', gruppe: 'Planung & Pflichten' },
    { id: 'steuern', label: 'Steuern', titel: 'Fristen, Rücklage, Umsatzsteuer, Übergabe an den Steuerberater', gruppe: 'Planung & Pflichten' },
  ],
};
/** Ebene 1 je Bereich (Kennung + Name) — abgeleitet aus `FINANZ_MENUE`. */
export const PRIVAT_REITER = FINANZ_MENUE.privat.map(p => ({ id: p.id, label: p.label }));
export const BUSINESS_REITER = FINANZ_MENUE.business.map(p => ({ id: p.id, label: p.label }));

/** Der Fuß des Menüs: Business Einstellungen und 0-Punkt (Anker im Cockpit), Privat der Altbestand der Selbstständigkeit (Anker unter Planung). */
export interface FinanzFussPunkt { id: 'einstellungen' | 'eroeffnung' | 'altbestand'; label: string; titel: string }
export const FINANZ_FUSS: Readonly<Record<FinanzBereich, readonly FinanzFussPunkt[]>> = {
  business: [
    { id: 'einstellungen', label: 'Einstellungen', titel: 'Schwellen, Jahresziele und Feinjustierung der Kennzahlen' },
    { id: 'eroeffnung', label: '0-Punkt', titel: 'Stichtag und Anfangsbestand je Gesellschaft' },
  ],
  privat: [{ id: 'altbestand', label: 'Altbestand', titel: 'Grundlage und Kassenbuch der Selbstständigkeit' }],
};
/** Die Adresse eines Fuß-Punkts (vorhandene Anker: `#einstellungen`, `#eroeffnung` im Cockpit; `#altbestand` unter Planung › Selbstständigkeit). */
export function finanzFussAdresse(id: FinanzFussPunkt['id']): string {
  if (id === 'altbestand') return '/os/finanzen?s=finanzplanung&space=privat&u=selbst#altbestand';
  return `${finanzAdresse('business', 'business')}#${id}`;
}

/** Welcher Punkt des Menüs ist dieser Ort? (Head of Finance = „Automationen & Head“.) */
export function finanzMenueId(o: FinanzOrt): FinanzMenueId | 'chef' {
  if (o.reiter === 'chef') return 'chef';
  if (o.reiter === 'business') return o.unter === 'controlling' ? 'controlling' : 'business';
  return o.reiter;
}
/**
 * Hat dieses Konto den Punkt? Ohne Haushalt (Konto „nur Business“) nur Cockpit, Rechnungen und Planung (mit Planzugang — der Server filtert); Steuern und
 * Controlling nur im Haushalt des Inhabers (`inhaber` noch unbekannt = ja). Dieselbe Regel für Menü und Seite.
 */
export function finanzMenueErlaubt(id: FinanzMenueId, z: { haushalt: boolean | null; planZugang?: boolean; inhaber?: boolean | null }): boolean {
  if (z.haushalt === false) return id === 'business' || ((id === 'finanzplanung' || id === 'rechnungen') && z.planZugang !== false);
  return (id !== 'steuern' && id !== 'controlling') || z.inhaber !== false;
}

/** Ebene 2 unter Privat › Konten & Buchungen: die Reiter der Haushaltsfinanzen (ohne Übersicht) + Buchungen der Privat-Einheiten. */
export type KontenUnter = 'buchungen' | 'einnahmen' | 'analyse' | 'fixkosten' | 'plan' | 'schulden' | 'firma';
export const HAUSHALT_UNTER: { id: Exclude<KontenUnter, 'firma'>; label: string }[] = [
  { id: 'buchungen', label: 'Buchungen' }, { id: 'einnahmen', label: 'Einnahmen' }, { id: 'analyse', label: 'Analyse' },
  { id: 'fixkosten', label: 'Fixkosten & Budget' }, { id: 'plan', label: 'Ist gegen Soll' }, { id: 'schulden', label: 'Schulden & Rechnungen' },
];
/** Die Pillen unter Konten & Buchungen — „firma“ nur, wenn eine Einheit (z. B. die Selbstständigkeit) zu Privat gehört. */
export function kontenUnter(): { id: KontenUnter; label: string }[] {
  const firma = PRIVAT_GESELLSCHAFTEN.length ? [{ id: 'firma' as const, label: PRIVAT_GESELLSCHAFTEN.map(finanzOrtName).join(' · ') }] : [];
  return [...HAUSHALT_UNTER, ...firma];
}

const istHaushaltUnter = (t: string | null): t is Exclude<KontenUnter, 'firma'> => HAUSHALT_UNTER.some(u => u.id === t);
const NUR_BUSINESS: string[] = ['business', 'controlling', 'rechnungen', 'liquiditaet', 'chef', 'steuern'];

export interface FinanzOrt {
  bereich: FinanzBereich;
  /** Ebene 1 — `chef` = Head of Finance („Automationen & Head“ bzw. der Knopf auf der Seite). */
  reiter: FinanzReiter | 'chef';
  /** Ebene 2 unter Konten & Buchungen; unter Business › Cockpit sagt `business`/`controlling`, welcher der beiden Menüpunkte (`finanzMenueId`). */
  unter: KontenUnter | 'business' | 'controlling' | null;
}

/**
 * Wo bin ich? Aus der Adresse (`space`, `s`, `t`, `ort`), dem gemerkten Space (Kopf-Schalter; „Alles“ = Privat) und dem Zugang.
 * `haushalt === false` (kein Haushalt, z. B. Finanzrecht „nur Business“) → immer Business.
 */
export function finanzOrt(q: URLSearchParams, o: { gemerkt?: FinanzBereich | null; haushalt?: boolean | null } = {}): FinanzOrt {
  const s = q.get('s'); const space = q.get('space'); const t = q.get('t');
  const bereich: FinanzBereich = o.haushalt === false ? 'business'
    : space === 'privat' || space === 'business' ? space
    : s === 'privat' || s === 'gesamt' ? 'privat'
    : s === 'buchungen' ? (gehoertZuPrivat(q.get('ort')) && q.get('ort') !== 'privat' ? 'privat' : 'business')
    : s && NUR_BUSINESS.includes(s) ? 'business'
    : o.gemerkt === 'business' ? 'business' : 'privat';
  if (s === 'chef') return { bereich, reiter: 'chef', unter: null };
  if (bereich === 'privat') {
    if ((s === 'privat' || s === 'gesamt' || !s) && istHaushaltUnter(t)) return { bereich, reiter: 'konten', unter: t };
    if (s === 'buchungen') return { bereich, reiter: 'konten', unter: 'firma' };
    if (s === 'finanzplanung' || s === 'steuern') return { bereich, reiter: s, unter: null };
    return { bereich, reiter: 'privat', unter: null };
  }
  if (s === 'controlling') return { bereich, reiter: 'business', unter: 'controlling' };
  if (s === 'rechnungen' || s === 'liquiditaet' || s === 'buchungen' || s === 'finanzplanung' || s === 'steuern') return { bereich, reiter: s, unter: null };
  return { bereich, reiter: 'business', unter: 'business' };
}

/** Die Adresse eines Ortes (Ebene 1 bzw. 2) — `space` steht immer dabei, damit Kopf und Leiste denselben Bereich zeigen. */
export function finanzAdresse(bereich: FinanzBereich, ziel: FinanzReiter | KontenUnter | 'controlling' | 'chef'): string {
  const q = new URLSearchParams();
  if (ziel === 'konten') { q.set('s', 'privat'); q.set('t', 'buchungen'); }
  else if (ziel === 'firma') q.set('s', 'buchungen');
  else if (bereich === 'privat' && istHaushaltUnter(ziel)) { q.set('s', 'privat'); q.set('t', ziel); }
  else q.set('s', ziel);
  q.set('space', bereich);
  return `/os/finanzen?${q.toString()}`;
}
