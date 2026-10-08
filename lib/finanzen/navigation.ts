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
//   Head of Finance (s=chef) ist ein Knopf neben den Reitern, kein Reiter.

import { PRIVAT_GESELLSCHAFTEN, finanzOrtName, gehoertZuPrivat } from '@/lib/einheiten';

export type FinanzBereich = 'privat' | 'business';
/** Reiter der Ebene 1. `privat` = Privat › Überblick, `business` = Business › Überblick. */
export type FinanzReiter = 'privat' | 'konten' | 'business' | 'rechnungen' | 'liquiditaet' | 'buchungen' | 'finanzplanung' | 'steuern';
/** Alle gültigen Werte von `s` (Reiter, Ebene-2-Kennungen, Head of Finance und der alte Name „gesamt“). */
export const FINANZ_S = ['privat', 'business', 'controlling', 'rechnungen', 'liquiditaet', 'buchungen', 'finanzplanung', 'steuern', 'chef', 'gesamt'] as const;
export type FinanzS = typeof FINANZ_S[number];

export const PRIVAT_REITER: { id: FinanzReiter; label: string }[] = [
  { id: 'privat', label: 'Überblick' }, { id: 'konten', label: 'Konten & Buchungen' }, { id: 'finanzplanung', label: 'Planung' }, { id: 'steuern', label: 'Steuern' },
];
export const BUSINESS_REITER: { id: FinanzReiter; label: string }[] = [
  { id: 'business', label: 'Überblick' }, { id: 'rechnungen', label: 'Rechnungen & Zahlungen' }, { id: 'liquiditaet', label: 'Liquidität' },
  { id: 'buchungen', label: 'Buchungen' }, { id: 'finanzplanung', label: 'Planung' }, { id: 'steuern', label: 'Steuern' },
];

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
/** Ebene 2 unter Business › Überblick. */
export const UEBERBLICK_UNTER: { id: 'business' | 'controlling'; label: string }[] = [{ id: 'business', label: 'Cockpit' }, { id: 'controlling', label: 'Controlling & Ziele' }];

const istHaushaltUnter = (t: string | null): t is Exclude<KontenUnter, 'firma'> => HAUSHALT_UNTER.some(u => u.id === t);
const NUR_BUSINESS: string[] = ['business', 'controlling', 'rechnungen', 'liquiditaet', 'chef', 'steuern'];

export interface FinanzOrt {
  bereich: FinanzBereich;
  /** Ebene 1 — `chef` = Head of Finance (Knopf, kein Reiter). */
  reiter: FinanzReiter | 'chef';
  /** Ebene 2, wo es sie gibt: Konten & Buchungen bzw. Business-Überblick. */
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
