// ─── MAKE OS — Wiederholung: nächster Termin je Regel (rein, Paket C3, 28.09. spät) ──
// Kevin 28.09.: „Denk in diesem ganzen Konstrukt immer wieder daran, dass es Listen gibt, die immer wieder
// kommen — wiederkehrende Aufgaben.“ Hier steht NUR die Kalenderrechnung (client- und server-sicher):
//   · Regeln täglich · Werktage (Mo–Fr) · wöchentlich (Wochentage) · monatlich (Monatstag, 31 → 30/28/29 gekappt)
//     · jährlich; Intervall „alle n …“; `bis` beendet die Serie.
//   · Gerechnet wird mit Kalendertagen „YYYY-MM-DD“ über UTC-Mittag — die Zeitumstellung kann keinen Tag
//     verschieben. „Heute“ ist immer der Berliner Tag (`berlinerTag`, lib/kalender/zeit.ts), nie die Uhr der Maschine.
//   · Titel-Platzhalter {Monat} {Jahr} {KW} {Datum} für wiederkehrende Listen („Monatsabschluss {Monat} {Jahr}“).
// Serien (Instanz beim Erledigen, Listen im Morgenlauf) baut lib/aufgaben/serie.ts darauf. Tests: tests/aufgaben-serie.test.ts.

import type { Wiederholung, WiederholungRegel } from '@/types/tasks';
import { wandzeit, tagVon, tagPlus } from '@/lib/kalender/zeit';

export { tagPlus };

const TAG = /^\d{4}-\d{2}-\d{2}$/;
/** Gültiger Kalendertag „YYYY-MM-DD“ (auch der 30.02. fällt durch). */
export function istTag(v: unknown): v is string {
  if (typeof v !== 'string' || !TAG.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Heute (bzw. der Tag eines Zeitpunkts) als Berliner Kalendertag — der Server steht in UTC. */
export const berlinerTag = (jetzt: Date = new Date()): string => tagVon(wandzeit(jetzt));

const zwei = (n: number) => String(n).padStart(2, '0');
const teile = (tag: string) => ({ j: Number(tag.slice(0, 4)), m: Number(tag.slice(5, 7)), t: Number(tag.slice(8, 10)) });
const tagAus = (j: number, m: number, t: number) => `${String(j).padStart(4, '0')}-${zwei(m)}-${zwei(t)}`;

/** Tage im Monat (m = 1–12), Schaltjahr eingerechnet. */
export const tageImMonat = (j: number, m: number): number => new Date(Date.UTC(j, m, 0)).getUTCDate();
/** Wochentag 0 = Sonntag … 6 = Samstag (wie `Wiederholung.wochentage`). */
export const wochentag = (tag: string): number => new Date(`${tag}T12:00:00Z`).getUTCDay();
/** Kalendertage von a nach b (b − a). */
export const tageZwischen = (a: string, b: string): number => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const istWerktag = (tag: string) => { const w = wochentag(tag); return w !== 0 && w !== 6; };
const montagVon = (tag: string) => tagPlus(tag, -((wochentag(tag) + 6) % 7));
function monatPlus(j: number, m: number, n: number): { j: number; m: number } {
  const i = j * 12 + (m - 1) + n;
  return { j: Math.floor(i / 12), m: (((i % 12) + 12) % 12) + 1 };
}
/** Tag im Monat, gekappt aufs Monatsende (31 → 30/28/29). */
const gekappt = (j: number, m: number, t: number) => tagAus(j, m, Math.min(Math.max(1, t), tageImMonat(j, m)));

const intervall = (w: Wiederholung) => Math.max(1, Math.min(365, Math.trunc(Number(w.intervall ?? 1)) || 1));
const tageDerWoche = (w: Wiederholung) => Array.from(new Set((w.wochentage ?? []).filter(x => Number.isInteger(x) && x >= 0 && x <= 6))).sort();

/**
 * Ein Schritt der Regel von `basis` aus — vorwärts (+1) zum nächsten, rückwärts (−1) zum vorigen Termin.
 * `basis` gilt als Anker der Serie (in der Regel der letzte Termin). `bis` wird hier NICHT geprüft.
 */
export function schritt(w: Wiederholung, basis: string, richtung: 1 | -1 = 1): string {
  const n = intervall(w);
  switch (w.regel) {
    case 'taeglich':
      return tagPlus(basis, richtung * n);
    case 'werktage': {
      let d = basis;
      for (let i = 0; i < n; i++) { do { d = tagPlus(d, richtung); } while (!istWerktag(d)); }
      return d;
    }
    case 'woechentlich': {
      const tage = tageDerWoche(w);
      if (!tage.length) return tagPlus(basis, richtung * 7 * n);
      const woche = montagVon(basis);
      // Noch in derselben Woche (Mo–So)?
      for (let d = tagPlus(basis, richtung); montagVon(d) === woche; d = tagPlus(d, richtung)) if (tage.includes(wochentag(d))) return d;
      // Sonst n Wochen weiter: dort der erste (vorwärts) bzw. letzte (rückwärts) passende Tag.
      const ziel = tagPlus(woche, richtung * 7 * n);
      const reihe = Array.from({ length: 7 }, (_, i) => tagPlus(ziel, i)).filter(d => tage.includes(wochentag(d)));
      return richtung > 0 ? reihe[0] : reihe[reihe.length - 1];
    }
    case 'monatlich': {
      const { j, m, t } = teile(basis);
      const soll = w.monatstag ?? t;
      const hier = gekappt(j, m, soll);
      if (richtung > 0 ? hier > basis : hier < basis) return hier;
      const z = monatPlus(j, m, richtung * n);
      return gekappt(z.j, z.m, soll);
    }
    case 'jaehrlich': {
      // Monat der Basis; `monatstag` hält den Tag fest (29.02. → 28.02. → … → wieder 29.02. im Schaltjahr).
      const { j, m, t } = teile(basis);
      const soll = w.monatstag ?? t;
      const hier = gekappt(j, m, soll);
      if (richtung > 0 ? hier > basis : hier < basis) return hier;
      return gekappt(j + richtung * n, m, soll);
    }
    default:
      return tagPlus(basis, richtung);
  }
}

/** Nächster Termin nach `basis` — null, wenn er hinter `bis` läge (Serie zu Ende). */
export function naechsterTermin(w: Wiederholung, basis: string): string | null {
  if (!istTag(basis)) return null;
  const d = schritt(w, basis, 1);
  return w.bis && d > w.bis ? null : d;
}

/** Voriger Termin vor `basis` (für den Bezugstag einer laufenden Periode). */
export function vorherigerTermin(w: Wiederholung, basis: string): string | null {
  return istTag(basis) ? schritt(w, basis, -1) : null;
}

/**
 * Erster Termin am oder nach `ab` (Start einer Serie). Regeln ohne festen Tag (täglich, wöchentlich ohne
 * Wochentage, monatlich ohne Monatstag, jährlich) beginnen am Tag selbst — er wird ihr Anker.
 */
export function ersterTermin(w: Wiederholung, ab: string): string | null {
  if (!istTag(ab)) return null;
  let d: string;
  if (w.regel === 'taeglich' || w.regel === 'jaehrlich' || (w.regel === 'woechentlich' && !tageDerWoche(w).length) || (w.regel === 'monatlich' && !w.monatstag)) d = ab;
  else if (w.regel === 'werktage') d = istWerktag(ab) ? ab : schritt({ ...w, intervall: 1 }, ab, 1);
  else d = schritt({ ...w, intervall: 1 }, tagPlus(ab, -1), 1);
  return w.bis && d > w.bis ? null : d;
}

/** Höchstzahl an Schritten beim Nachrechnen (täglich über ~27 Jahre) — Schutz vor Endlosschleifen. */
const MAX_SCHRITTE = 10_000;

/**
 * Der nächste Termin nach `basis`, aber nie in der Vergangenheit: liegt er vor `heute` (lange weg gewesen),
 * springt die Serie zum ersten Termin am oder nach heute — keine Lawine überfälliger Instanzen.
 */
export function naechsterAbHeute(w: Wiederholung, basis: string, heute: string): string | null {
  let d = naechsterTermin(w, basis);
  for (let i = 0; d && d < heute && i < MAX_SCHRITTE; i++) d = naechsterTermin(w, d);
  return d && d >= heute ? d : null;
}

/** Die nächsten `anzahl` Termine nach `basis` (Vorschau). */
export function termineNach(w: Wiederholung, basis: string, anzahl = 3): string[] {
  const raus: string[] = [];
  let d = naechsterTermin(w, basis);
  while (d && raus.length < anzahl) { raus.push(d); d = naechsterTermin(w, d); }
  return raus;
}

/** Alle Termine ab `start` (einschließlich) bis `heute` — höchstens `max` (+ ob es mehr gäbe). */
export function faelligeTermine(w: Wiederholung, start: string, heute: string, max = 400): { termine: string[]; mehr: boolean } {
  const termine: string[] = [];
  let d: string | null = istTag(start) && (!w.bis || start <= w.bis) ? start : null;
  while (d && d <= heute) {
    if (termine.length >= max) return { termine, mehr: true };
    termine.push(d);
    d = naechsterTermin(w, d);
  }
  return { termine, mehr: false };
}

/** Wiederholung ohne den gespeicherten „nächsten Termin“ (für Kopien). */
export function ohneNaechste(w: Wiederholung): Wiederholung {
  const { naechste: _n, ...rest } = w;
  return rest;
}

// ── Anzeige ────────────────────────────────────────────────────────────────

export const WOCHENTAGE_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;
export const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'] as const;
export const REGEL_LABEL: Record<WiederholungRegel, string> = { taeglich: 'täglich', werktage: 'Werktage', woechentlich: 'wöchentlich', monatlich: 'monatlich', jaehrlich: 'jährlich' };

/** „Mo 05.10.“ */
export const kurzTag = (tag: string): string => (istTag(tag) ? `${WOCHENTAGE_KURZ[wochentag(tag)]} ${tag.slice(8, 10)}.${tag.slice(5, 7)}.` : '');
/** „05.10.2026“ */
export const langTag = (tag: string): string => (istTag(tag) ? `${tag.slice(8, 10)}.${tag.slice(5, 7)}.${tag.slice(0, 4)}` : '');

/** „alle 2 Wochen (Mo, Do) bis 31.12.2026“ — für Titel/Hinweise. */
export function wiederholungText(w: Wiederholung): string {
  const n = intervall(w);
  const tage = tageDerWoche(w);
  const wt = tage.length ? ` (${[...tage.filter(x => x !== 0), ...tage.filter(x => x === 0)].map(x => WOCHENTAGE_KURZ[x]).join(', ')})` : '';
  let s: string;
  switch (w.regel) {
    case 'taeglich': s = n === 1 ? 'täglich' : `alle ${n} Tage`; break;
    case 'werktage': s = n === 1 ? 'werktags (Mo–Fr)' : `alle ${n} Werktage`; break;
    case 'woechentlich': s = `${n === 1 ? 'wöchentlich' : `alle ${n} Wochen`}${wt}`; break;
    case 'monatlich': s = `${n === 1 ? 'monatlich' : `alle ${n} Monate`}${w.monatstag ? ` am ${w.monatstag}.${w.monatstag > 28 ? ' (sonst Monatsende)' : ''}` : ''}`; break;
    case 'jaehrlich': s = n === 1 ? 'jährlich' : `alle ${n} Jahre`; break;
    default: s = 'wiederkehrend';
  }
  return w.bis ? `${s} bis ${langTag(w.bis)}` : s;
}

// ── Titel-Platzhalter ──────────────────────────────────────────────────────

/** ISO-Kalenderwoche (Mo–So, die Woche mit dem 4. Januar ist KW 1). */
export function kalenderwoche(tag: string): { kw: number; jahr: number } {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3); // Donnerstag dieser Woche
  const jahr = d.getUTCFullYear();
  const vierter = new Date(Date.UTC(jahr, 0, 4, 12));
  const kw = 1 + Math.round(((d.getTime() - vierter.getTime()) / 86_400_000 - 3 + ((vierter.getUTCDay() + 6) % 7)) / 7);
  return { kw, jahr };
}

const PLATZHALTER = /\{(Monat|Jahr|KW|Datum)\}/g;
export const hatPlatzhalter = (s: string): boolean => /\{(Monat|Jahr|KW|Datum)\}/.test(s);
/** {Monat} → „Oktober“, {Jahr} → „2026“, {KW} → „41“, {Datum} → „05.10.2026“ (zum Tag des Listenstarts). */
export function titelMitPlatzhaltern(muster: string, tag: string): string {
  if (!istTag(tag)) return muster;
  const { j, m } = teile(tag);
  return muster.replace(PLATZHALTER, (_, p: string) => (p === 'Monat' ? MONATE[m - 1] : p === 'Jahr' ? String(j) : p === 'KW' ? zwei(kalenderwoche(tag).kw) : langTag(tag)));
}

/** Das übliche Muster je Regel, wenn eine Vorlage keinen Platzhalter trägt. */
export function standardMuster(grund: string, regel: WiederholungRegel): string {
  const g = grund.trim();
  switch (regel) {
    case 'monatlich': return `${g} {Monat} {Jahr}`;
    case 'jaehrlich': return `${g} {Jahr}`;
    case 'woechentlich': return `${g} KW {KW}/{Jahr}`;
    default: return `${g} {Datum}`;
  }
}

/** Einen schon ausgefüllten Titel („Monatsabschluss September 2026“) auf seinen Grund zurückführen. */
export function grundTitel(titel: string): string {
  const monate = MONATE.join('|');
  const ende = new RegExp(`(?:\\s*[·–—/-]?\\s*(?:${monate}|KW\\s?\\d{1,2}(?:/\\d{4})?|\\d{4}|\\d{1,2}\\.\\d{1,2}\\.(?:\\d{4})?))+\\s*$`, 'u');
  const g = titel.replace(ende, '').trim();
  return g || titel.trim();
}
