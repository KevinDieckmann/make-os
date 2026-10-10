// ─── MAKE OS — Planung: Rhythmus und Fälligkeit von Routinen ────────────────
// Malin (27.09.): Routinen täglich · 3×/Woche · wöchentlich · monatlich ·
// quartalsweise · halbjährlich · jährlich, mit Fälligkeit „nächstes Mal am“
// (Arzt, Steuererklärung). Gerechnet wird rein auf YYYY-MM-DD — kein
// Zeitzonen-Sprung, kein UTC-Vortag. Monatsende wird geklemmt (31.01. + 1
// Monat = 28./29.02.). Tests: tests/planung-rhythmus.test.ts.
//
// Routinen 2 (10.10., Rückmeldung aus dem Onboarding: „mehr Einstellungen bei den einzelnen Routinen — täglich, mehrmals täglich, 1× pro
// Woche und individuell einstellbar“): EINE Rechenstelle für alle Regeln (`RoutineRegel`, lib/planung/typen.ts). Der alte `rhythmus` ist
// nur eine Kurzform davon (`regelVonRhythmus`) und rechnet GENAU wie bisher (Wächter tests/routinen-2-rhythmus.test.ts gegen den
// wörtlich übernommenen alten Code). Feste Kalendertage (Werktage, feste Wochentage, Monatstag, n-ter Wochentag) rechnet die vorhandene
// Wiederholung der Aufgaben (lib/aufgaben/wiederholung.ts) — hier gibt es keine zweite Kalenderrechnung. Dazu Pausen, Zeitraum, Zähler
// (Tagesziel) und Streak/Erfüllungsquote je Regel (`routineStatistik`). Rein und client-sicher.

import type { Rhythmus, Routine, RoutineRegel, RegelArt, IntervallEinheit, Wochentag, RoutinePause } from './typen';
import { montagVon, tagePlus } from './zeitraum';
import { ersterTermin, naechsterTermin, istTag, tageZwischen } from '@/lib/aufgaben/wiederholung';
import type { Wiederholung } from '@/types/tasks';

const p = (n: number) => String(n).padStart(2, '0');
const tageImMonat = (y: number, m1: number) => new Date(y, m1, 0).getDate();

/** Monate dazurechnen — Tag auf das Monatsende geklemmt. */
export function monatePlus(tag: string, n: number): string {
  const y = Number(tag.slice(0, 4)), m = Number(tag.slice(5, 7)), d = Number(tag.slice(8, 10));
  const gesamt = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(gesamt / 12), nm = (gesamt % 12) + 1;
  return `${ny}-${p(nm)}-${p(Math.min(d, tageImMonat(ny, nm)))}`;
}

/** Wann ist eine Routine nach einer Erledigung am Tag `ab` das nächste Mal dran? `null` für 3×/Woche (zählt statt zu terminieren). */
export function naechstesMalNach(r: Rhythmus, ab: string): string | null {
  switch (r) {
    case 'taeglich': return tagePlus(ab, 1);
    case '3x-woche': return null;
    case 'woechentlich': return tagePlus(ab, 7);
    case 'monatlich': return monatePlus(ab, 1);
    case 'quartal': return monatePlus(ab, 3);
    case 'halbjahr': return monatePlus(ab, 6);
    case 'jaehrlich': return monatePlus(ab, 12);
  }
}

// ── Regel: die eine Form ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Grenzen der Einstellungen — darüber lehnt der Schreibweg ab (nie gekürzt). */
export const ROUTINE_GRENZEN = {
  proWoche: 7, alleTage: 365, alleWochen: 52, alleMonate: 24, wochenAlle: 8, monateAlle: 12,
  tagesZiel: 50, uhrzeiten: 12, pausen: 20, zaehlWort: 20,
} as const;

export const REGEL_ARTEN: readonly RegelArt[] = ['taeglich', 'werktage', 'wochentage', 'pro-woche', 'intervall', 'monatlich'];
const EINHEITEN: readonly IntervallEinheit[] = ['tag', 'woche', 'monat'];
/** Anker für „alle n Wochen/Monate“ ohne eigenen Start — ein Montag, fest (deterministisch). */
const EPOCHE = '2024-01-01';
const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;
const ganz = (v: unknown, min: number, max: number): number | null => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };

/** Der alte Rhythmus als Regel — genau dieselbe Rechnung wie vor dem 10.10. */
export function regelVonRhythmus(rh: Rhythmus | undefined): RoutineRegel {
  switch (rh ?? 'taeglich') {
    case '3x-woche': return { art: 'pro-woche', anzahl: 3 };
    case 'woechentlich': return { art: 'intervall', alle: 1, einheit: 'woche' };
    case 'monatlich': return { art: 'intervall', alle: 1, einheit: 'monat' };
    case 'quartal': return { art: 'intervall', alle: 3, einheit: 'monat' };
    case 'halbjahr': return { art: 'intervall', alle: 6, einheit: 'monat' };
    case 'jaehrlich': return { art: 'intervall', alle: 12, einheit: 'monat' };
    default: return { art: 'taeglich' };
  }
}

/** Die Regel einer Routine: `regel`, sonst aus dem alten `rhythmus` (fehlt = täglich). Lesen NUR hierüber. */
export function regelVon(r: Pick<Routine, 'rhythmus' | 'regel'>): RoutineRegel {
  return r.regel ?? regelVonRhythmus(r.rhythmus);
}

/** Lässt sich die Regel GENAU als alter Rhythmus schreiben? Dann speichert der Schreibweg den alten (Form des alten Stands). */
export function rhythmusAusRegel(g: RoutineRegel): Rhythmus | null {
  const alle = g.alle ?? 1;
  if (g.art === 'taeglich') return 'taeglich';
  if (g.art === 'pro-woche' && g.anzahl === 3) return '3x-woche';
  if (g.art === 'intervall') {
    const e = g.einheit ?? 'tag';
    if (e === 'woche' && alle === 1) return 'woechentlich';
    if (e === 'monat') return alle === 1 ? 'monatlich' : alle === 3 ? 'quartal' : alle === 6 ? 'halbjahr' : alle === 12 ? 'jaehrlich' : null;
  }
  return null;
}

/**
 * Eine Regel prüfen und in ihre kürzeste Form bringen (Vorgaben fallen weg: `alle` 1, `einheit` tag). Unbrauchbares → null (dann gilt der
 * alte Rhythmus). „Alle 1 Tag“ ist täglich, „monatlich“ ohne Tag rechnet ab dem letzten Mal (wie bisher).
 */
export function regelSaeubern(roh: unknown): RoutineRegel | null {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return null;
  const g = roh as Record<string, unknown>;
  const art = g.art as RegelArt;
  if (!REGEL_ARTEN.includes(art)) return null;
  switch (art) {
    case 'taeglich': case 'werktage': return { art };
    case 'pro-woche': {
      const anzahl = ganz(g.anzahl, 1, ROUTINE_GRENZEN.proWoche);
      return anzahl ? { art, anzahl } : null;
    }
    case 'intervall': {
      const einheit: IntervallEinheit = EINHEITEN.includes(g.einheit as IntervallEinheit) ? g.einheit as IntervallEinheit : 'tag';
      const max = einheit === 'tag' ? ROUTINE_GRENZEN.alleTage : einheit === 'woche' ? ROUTINE_GRENZEN.alleWochen : ROUTINE_GRENZEN.alleMonate;
      const alle = ganz(g.alle ?? 1, 1, max);
      if (!alle) return null;
      if (einheit === 'tag' && alle === 1) return { art: 'taeglich' };
      return { art, alle, ...(einheit !== 'tag' ? { einheit } : {}) };
    }
    case 'wochentage': {
      const tage = Array.isArray(g.tage) ? [...new Set(g.tage.map(Number).filter(t => Number.isInteger(t) && t >= 1 && t <= 7))].sort((a, b) => a - b) as Wochentag[] : [];
      if (!tage.length) return null;
      const alle = ganz(g.alle ?? 1, 1, ROUTINE_GRENZEN.wochenAlle);
      if (!alle) return null;
      if (tage.length === 7 && alle === 1) return { art: 'taeglich' };
      const start = alle > 1 && istTag(g.start) ? g.start : undefined;
      return { art, tage, ...(alle > 1 ? { alle } : {}), ...(start ? { start } : {}) };
    }
    case 'monatlich': {
      const alle = ganz(g.alle ?? 1, 1, ROUTINE_GRENZEN.monateAlle);
      if (!alle) return null;
      const nRoh = g.nter && typeof g.nter === 'object' ? g.nter as Record<string, unknown> : null;
      const n = nRoh ? Number(nRoh.n) : NaN;
      const nter = nRoh && [1, 2, 3, 4, -1].includes(n) && ganz(nRoh.tag, 1, 7) ? { n: n as 1 | 2 | 3 | 4 | -1, tag: Number(nRoh.tag) as Wochentag } : undefined;
      const monatstag = nter ? null : ganz(g.monatstag, 1, 31);
      // Ohne festen Tag: „alle n Monate ab dem letzten Mal“ (wie der alte Rhythmus monatlich/quartal …).
      if (!nter && !monatstag) return { art: 'intervall', alle, einheit: 'monat' };
      const start = alle > 1 && istTag(g.start) ? g.start : undefined;
      return { art, ...(nter ? { nter } : { monatstag: monatstag! }), ...(alle > 1 ? { alle } : {}), ...(start ? { start } : {}) };
    }
  }
}

// ── Feste Kalendertage über die Wiederholung der Aufgaben (EINE Kalenderrechnung) ─────────────────────────────────────────────

/** Die Regel als Wiederholung der Aufgaben — nur für Regeln mit festen Kalendertagen. Wochentage dort: 0 = So … 6 = Sa. */
function alsWiederholung(g: RoutineRegel): Wiederholung | null {
  switch (g.art) {
    case 'werktage': return { regel: 'werktage' };
    case 'wochentage': return { regel: 'woechentlich', wochentage: (g.tage ?? []).map(t => t % 7), intervall: g.alle ?? 1 };
    case 'monatlich': return { regel: 'monatlich', intervall: g.alle ?? 1, ...(g.nter ? { nter: { n: g.nter.n, wochentag: g.nter.tag % 7 } } : { monatstag: g.monatstag ?? 1 }) };
    default: return null;
  }
}
const istKalenderRegel = (g: RoutineRegel) => g.art === 'werktage' || g.art === 'wochentage' || g.art === 'monatlich';
const monatIndex = (tag: string) => Number(tag.slice(0, 4)) * 12 + Number(tag.slice(5, 7)) - 1;
const monatsErster = (i: number) => `${Math.floor(i / 12)}-${p((i % 12) + 1)}-01`;
const MAX_TERMINE = 2000;

/** Ein Anker kurz vor `tag`, auf dem Takt der Regel (bei „alle n Wochen/Monate“ ab `start`). */
function ankerVor(g: RoutineRegel, w: Wiederholung, tag: string): string {
  const alle = g.alle ?? 1;
  if (g.art === 'werktage') return tagePlus(tag, -7);
  if (g.art === 'wochentage') {
    const mo = montagVon(tag);
    if (alle === 1) return tagePlus(mo, -7);
    const basis = montagVon(g.start ?? EPOCHE);
    if (mo <= basis) return basis;
    const k = Math.max(0, Math.floor(Math.round(tageZwischen(basis, mo) / 7) / alle) - 1);
    return tagePlus(basis, 7 * alle * k);
  }
  // monatlich
  if (alle === 1) return monatsErster(monatIndex(tag) - 2);
  const erste = ersterTermin(w, g.start ?? EPOCHE) ?? (g.start ?? EPOCHE);
  const m0 = monatIndex(erste);
  const k = Math.max(0, Math.floor((monatIndex(tag) - m0) / alle) - 1);
  return monatsErster(m0 + k * alle);
}

/** Alle Termine einer Kalender-Regel in [von, bis] (aufsteigend). Vor `start` gibt es keine. */
export function termineIm(g: RoutineRegel, von: string, bis: string): string[] {
  const w = alsWiederholung(g);
  if (!w || von > bis) return [];
  const raus: string[] = [];
  let d: string | null = ersterTermin(w, ankerVor(g, w, von));
  for (let i = 0; d && d <= bis && i < MAX_TERMINE; i++) {
    if (d >= von && (!g.start || d >= g.start)) raus.push(d);
    d = naechsterTermin(w, d);
  }
  return raus;
}
/** Ist `tag` ein Termin der Kalender-Regel? */
const istTermin = (g: RoutineRegel, tag: string) => termineIm(g, tag, tag).length > 0;
/** Längste Lücke zwischen zwei Terminen (Suchfenster). */
const spanne = (g: RoutineRegel) => (g.art === 'monatlich' ? 31 * (g.alle ?? 1) + 31 : g.art === 'wochentage' ? 7 * (g.alle ?? 1) + 7 : 14);
/** Erster Termin am oder nach `ab`. */
export function terminAb(g: RoutineRegel, ab: string): string | null {
  return termineIm(g, ab, tagePlus(ab, spanne(g) + 31))[0] ?? null;
}
/** Letzter Termin am oder vor `tag`. */
function terminBis(g: RoutineRegel, tag: string): string | null {
  const l = termineIm(g, tagePlus(tag, -spanne(g)), tag);
  return l.length ? l[l.length - 1] : null;
}

/** Ein Schritt „alle n Tage/Wochen/Monate“ (ab dem letzten Mal). */
function intervallSchritt(g: RoutineRegel, ab: string): string {
  const alle = g.alle ?? 1;
  const e = g.einheit ?? 'tag';
  return e === 'monat' ? monatePlus(ab, alle) : tagePlus(ab, e === 'woche' ? 7 * alle : alle);
}

/** Nach einer Erledigung am Tag `ab`: wann ist die Regel wieder dran? (x-mal pro Woche: null — sie zählt.) */
export function naechstesMalNachRegel(g: RoutineRegel, ab: string): string | null {
  if (g.art === 'taeglich') return tagePlus(ab, 1);
  if (g.art === 'pro-woche') return null;
  if (g.art === 'intervall') return intervallSchritt(g, ab);
  return terminAb(g, tagePlus(ab, 1));
}

// ── Pausen, Zeitraum, Zähler ─────────────────────────────────────────────────────────────────────────────────────────────────

type Rahmen = Pick<Routine, 'pausen' | 'zeitraum'>;
/** Liegt der Tag in einer Pause? */
export const pausiertAm = (r: Rahmen, tag: string): RoutinePause | undefined => (r.pausen ?? []).find(x => x.von <= tag && tag <= x.bis);
/** Liegt der Tag außerhalb des Zeitraums? */
const ausserhalbAm = (r: Rahmen, tag: string): boolean => (!!r.zeitraum?.von && tag < r.zeitraum.von) || (!!r.zeitraum?.bis && tag > r.zeitraum.bis);
/** Zählt der Tag nicht (Pause oder außerhalb des Zeitraums)? */
const ruhtAm = (r: Rahmen, tag: string): boolean => !!pausiertAm(r, tag) || ausserhalbAm(r, tag);
/** Ruhetage (Pause) zwischen zwei Tagen (beide ausgeschlossen) — verlängern die Frist bei „alle n …“. */
function ruhetageZwischen(r: Rahmen, a: string, b: string): number {
  let n = 0;
  for (const x of r.pausen ?? []) {
    const von = x.von > a ? x.von : tagePlus(a, 1), bis = x.bis < b ? x.bis : tagePlus(b, -1);
    if (von <= bis) n += tageZwischen(von, bis) + 1;
  }
  return n;
}

/** Wie oft am Tag (Zähler / mehrmals täglich): mit ≥ 2 Uhrzeiten mindestens deren Zahl, sonst das Tagesziel, sonst 1. */
export function tagesZielVon(r: Pick<Routine, 'tagesZiel' | 'uhrzeiten'>): number {
  const z = r.uhrzeiten?.length ?? 0;
  return Math.max(r.tagesZiel ?? 1, z >= 2 ? z : 1);
}

// ── Fälligkeit ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Faelligkeit {
  /** Heute dran (auch wenn überfällig)? */
  faellig: boolean;
  /** Der Tag, an dem sie (wieder) dran ist — heute oder früher heißt fällig. */
  naechstes: string;
  ueberfaellig: boolean;
  /** Nur x-mal pro Woche (früher 3×/Woche): wie oft diese Woche schon. */
  dieseWoche?: number;
  /** Nur x-mal pro Woche: das Wochenziel. */
  proWoche?: number;
  /** Heute in einer Pause (Urlaub, krank) — nicht dran, der Streak reißt nicht. */
  pausiert?: true;
  /** Außerhalb des Zeitraums: noch nicht begonnen bzw. vorbei. */
  ausserhalb?: 'vorher' | 'nachher';
}

export type FaelligEingabe = Pick<Routine, 'rhythmus' | 'naechstesMal'> & Partial<Pick<Routine, 'regel' | 'pausen' | 'zeitraum' | 'angelegtAm'>>;

/** Erster Tag am oder nach `ab`, an dem die Regel dran sein kann (für „ab …“ nach einer Pause oder vor dem Zeitraum). */
function ersterDranAb(g: RoutineRegel, anker: string | undefined, ab: string): string {
  if (istKalenderRegel(g)) return terminAb(g, ab) ?? ab;
  if (g.art === 'intervall' && anker && anker > ab) return anker;
  return ab;
}

/** Die Regel allein — ohne Pause und Zeitraum. */
function faelligKern(g: RoutineRegel, ankerRoh: string | undefined, erledigtTage: readonly string[], heute: string, angelegtAm?: string): Faelligkeit {
  const heuteErledigt = erledigtTage.includes(heute);
  switch (g.art) {
    case 'taeglich':
      return { faellig: !heuteErledigt, naechstes: heuteErledigt ? tagePlus(heute, 1) : heute, ueberfaellig: false };
    case 'pro-woche': {
      const n = g.anzahl ?? 3;
      const mo = montagVon(heute), so = tagePlus(mo, 6);
      const dieseWoche = erledigtTage.filter(d => d >= mo && d <= so).length;
      const faellig = !heuteErledigt && dieseWoche < n;
      return { faellig, naechstes: faellig ? heute : dieseWoche >= n ? tagePlus(mo, 7) : tagePlus(heute, 1), ueberfaellig: false, dieseWoche, proWoche: n };
    }
    case 'intervall': {
      // Wie bisher wöchentlich … jährlich: ab der letzten Erledigung, „nächstes Mal am“ gewinnt, bis danach erledigt wurde.
      const letzte = erledigtTage.reduce<string | null>((m, d) => (m == null || d > m ? d : m), null);
      const anker = ankerRoh && ISO_TAG.test(ankerRoh) ? ankerRoh : undefined;
      const naechstes = letzte && (!anker || letzte >= anker) ? intervallSchritt(g, letzte) : (anker ?? heute);
      return { faellig: naechstes <= heute, naechstes, ueberfaellig: naechstes < heute };
    }
    case 'werktage': case 'wochentage': {
      // Feste Tage ohne Nachholen (wie täglich): nur am Tag selbst dran.
      if (istTermin(g, heute) && !heuteErledigt) return { faellig: true, naechstes: heute, ueberfaellig: false };
      return { faellig: false, naechstes: terminAb(g, tagePlus(heute, 1)) ?? tagePlus(heute, 1), ueberfaellig: false };
    }
    case 'monatlich': {
      // Fester Tag im Monat: ab dem Tag dran, bis erledigt — höchstens bis zum nächsten Termin (kein Stapel verpasster Monate).
      const akt = terminBis(g, heute);
      const gilt = akt && (!angelegtAm || akt >= angelegtAm) ? akt : null;
      if (gilt && !erledigtTage.some(d => d >= gilt && d <= heute)) return { faellig: true, naechstes: gilt, ueberfaellig: gilt < heute };
      return { faellig: false, naechstes: terminAb(g, tagePlus(heute, 1)) ?? tagePlus(heute, 1), ueberfaellig: false };
    }
  }
}

/**
 * Fälligkeit einer Routine für eine Person: `erledigtTage` sind die Tage, an
 * denen diese Person die Routine abgehakt hat (aus ihrem health-log; bei Zählern die Tage mit erreichtem Tagesziel).
 *   täglich        → dran, solange heute nicht abgehakt
 *   Werktage/feste Wochentage → nur an diesen Tagen, ohne Nachholen
 *   x-mal pro Woche → dran, solange heute nicht abgehakt und diese Woche (Mo–So) < x
 *   alle n Tage/Wochen/Monate (wöchentlich … jährlich) → ab `naechstesMal` bzw. ab der letzten Erledigung
 *   monatlich am Tag / n-ten Wochentag → ab dem Tag dran, bis erledigt (höchstens bis zum nächsten Termin)
 * Pause (Urlaub, krank) und Zeitraum: nicht dran; `naechstes` = erster Tag danach.
 */
export function faelligkeit(r: FaelligEingabe, erledigtTage: readonly string[], heute: string): Faelligkeit {
  const g = regelVon(r);
  const zr = r.zeitraum;
  if (zr?.bis && heute > zr.bis) return { faellig: false, naechstes: zr.bis, ueberfaellig: false, ausserhalb: 'nachher' };
  if (zr?.von && heute < zr.von) return { faellig: false, naechstes: ersterDranAb(g, r.naechstesMal, zr.von), ueberfaellig: false, ausserhalb: 'vorher' };
  const pause = pausiertAm(r, heute);
  if (pause) {
    let nach = tagePlus(pause.bis, 1);
    for (let i = 0; i < ROUTINE_GRENZEN.pausen; i++) { const w = pausiertAm(r, nach); if (!w) break; nach = tagePlus(w.bis, 1); }
    const k = faelligKern(g, r.naechstesMal, erledigtTage, nach, r.angelegtAm);
    const naechstes = k.naechstes > nach ? k.naechstes : ersterDranAb(g, r.naechstesMal, nach);
    return { faellig: false, naechstes, ueberfaellig: false, pausiert: true, ...(g.art === 'pro-woche' ? { dieseWoche: k.dieseWoche, proWoche: k.proWoche } : {}) };
  }
  return faelligKern(g, r.naechstesMal, erledigtTage, heute, r.angelegtAm);
}

/**
 * Die Tage in [von, bis], an denen die Routine geplant ist (Kalender-Block): täglich jeder Tag, feste Tage ihre Termine, „alle n …“ nur der
 * nächste fällige Tag (ab heute), x-mal pro Woche keiner (kein fester Tag). Pausen und Tage außerhalb des Zeitraums fallen weg.
 */
export function geplanteTage(r: FaelligEingabe, erledigtTage: readonly string[], von: string, bis: string): string[] {
  const g = regelVon(r);
  let tage: string[] = [];
  if (g.art === 'taeglich') { for (let d = von; d <= bis; d = tagePlus(d, 1)) tage.push(d); }
  else if (istKalenderRegel(g)) tage = termineIm(g, von, bis);
  else if (g.art === 'intervall') {
    const n = faelligKern(g, r.naechstesMal, erledigtTage, von, r.angelegtAm).naechstes;
    const tag = n < von ? von : n;
    if (tag <= bis) tage = [tag];
  }
  return tage.filter(d => !ruhtAm(r, d));
}

// ── Streak und Erfüllungsquote — je Regel gerecht ────────────────────────────────────────────────────────────────────────────

export interface RoutineStatistik {
  /** Wie oft hintereinander erfüllt — in `einheit`. */
  streak: number;
  /** Tage (täglich, Werktage, feste Wochentage), Wochen (x-mal pro Woche) oder Termine (alle n …, monatlich). */
  einheit: 'tag' | 'woche' | 'termin';
  /** Erfüllt ÷ Soll im Fenster — null, solange es nichts zu messen gibt. */
  quote: number | null;
  erfuellt: number;
  soll: number;
  /** Fenster in Tagen (bis heute). */
  fenster: number;
}

export type StatistikEingabe = FaelligEingabe;
const FENSTER_TAGE = 28;
const STREAK_TAGE = 400;

/**
 * Streak und Erfüllungsquote, so wie der Rhythmus es meint (10.10.):
 *   täglich / Werktage / feste Wochentage → je Termin-Tag (die letzten 4 Wochen); heute zählt erst, wenn erledigt
 *   x-mal pro Woche → je Woche (die Woche zählt, nicht der Tag); die laufende Woche erst, wenn sie erfüllt ist
 *   monatlich am Tag → je Termin (erledigt bis zum nächsten Termin), die letzten 6 Termine
 *   alle n Tage/Wochen/Monate → je Erledigung: rechtzeitig (≤ Frist + Pausentage) oder nicht; überfällig = Streak 0
 * Pausen und Tage außerhalb des Zeitraums zählen nie gegen — weder für die Quote noch für den Streak („ohne Streak-Verlust“).
 * Gemessen wird ab `angelegtAm` bzw. (Altbestand) ab dem ersten Haken; ohne beides: noch nichts zu messen.
 */
export function routineStatistik(r: StatistikEingabe, erledigtTage: readonly string[], heute: string): RoutineStatistik {
  const g = regelVon(r);
  const erledigt = new Set(erledigtTage);
  const erster = erledigtTage.reduce<string | null>((m, d) => (m == null || d < m ? d : m), null);
  const start = [r.angelegtAm && ISO_TAG.test(r.angelegtAm) ? r.angelegtAm : erster, r.zeitraum?.von].filter((x): x is string => !!x).sort().pop() ?? null;
  const einheit: RoutineStatistik['einheit'] = g.art === 'pro-woche' ? 'woche' : g.art === 'intervall' || g.art === 'monatlich' ? 'termin' : 'tag';
  const leer = (fenster: number): RoutineStatistik => ({ streak: 0, einheit, quote: null, erfuellt: 0, soll: 0, fenster });
  if (!start || start > heute) return leer(FENSTER_TAGE);

  if (g.art === 'taeglich' || g.art === 'werktage' || g.art === 'wochentage') {
    const tageIm = (von: string, bis: string): string[] => {
      if (g.art !== 'taeglich') return termineIm(g, von, bis);
      const l: string[] = [];
      for (let d = von; d <= bis; d = tagePlus(d, 1)) l.push(d);
      return l;
    };
    const zaehlt = (d: string) => d >= start && !ruhtAm(r, d) && !(d === heute && !erledigt.has(heute));
    const fensterTage = tageIm(tagePlus(heute, -(FENSTER_TAGE - 1)), heute).filter(zaehlt);
    const erfuellt = fensterTage.filter(d => erledigt.has(d)).length;
    let streak = 0;
    for (const d of tageIm(tagePlus(heute, -STREAK_TAGE), heute).filter(zaehlt).reverse()) { if (!erledigt.has(d)) break; streak++; }
    return { streak, einheit, quote: fensterTage.length ? erfuellt / fensterTage.length : null, erfuellt, soll: fensterTage.length, fenster: FENSTER_TAGE };
  }

  if (g.art === 'pro-woche') {
    const n = g.anzahl ?? 3;
    const woche = (mo: string) => {
      const tage = Array.from({ length: 7 }, (_, i) => tagePlus(mo, i));
      // Tage vor dem Start, in einer Pause oder außerhalb des Zeitraums senken das Wochenziel (Urlaub Mo–Mi → diese Woche nur noch 0 von 3).
      const weg = tage.filter(d => d < start || ruhtAm(r, d)).length;
      return { soll: Math.max(0, n - weg), ist: tage.filter(d => d <= heute && erledigt.has(d)).length, ende: tage[6] };
    };
    const mo0 = montagVon(heute);
    const auswerten = (k: number) => woche(tagePlus(mo0, -7 * k));
    // Fenster: die letzten 4 abgeschlossenen Wochen + die laufende, sobald sie erfüllt ist.
    let erfuellt = 0, soll = 0;
    for (let k = 0; k <= 4; k++) {
      const w = auswerten(k);
      if (w.soll === 0 || w.ende < start) continue;
      if (k === 0 && w.ist < w.soll) continue; // laufende Woche: erst, wenn erfüllt
      erfuellt += Math.min(w.ist, w.soll); soll += w.soll;
    }
    let streak = 0;
    for (let k = 0; k < STREAK_TAGE / 7; k++) {
      const w = auswerten(k);
      if (w.ende < start) break;
      if (w.soll === 0) continue;
      if (w.ist >= w.soll) { streak++; continue; }
      if (k === 0) continue; // laufende Woche, noch nicht erfüllt: reißt nicht
      break;
    }
    return { streak, einheit, quote: soll ? erfuellt / soll : null, erfuellt, soll, fenster: 35 };
  }

  if (g.art === 'monatlich') {
    const alle = g.alle ?? 1;
    const fenster = Math.min(STREAK_TAGE, 31 * alle * 7);
    const termine = termineIm(g, tagePlus(heute, -STREAK_TAGE), heute);
    const danach = terminAb(g, tagePlus(heute, 1));
    const perioden = termine.map((t, i) => ({ t, bis: i + 1 < termine.length ? tagePlus(termine[i + 1], -1) : (danach ? tagePlus(danach, -1) : heute) }));
    const bewertet: boolean[] = []; // neueste zuerst; nur, was zählt
    for (let i = perioden.length - 1; i >= 0; i--) {
      const { t, bis } = perioden[i];
      if (t < start) break;
      const ok = [...erledigt].some(d => d >= t && d <= bis && d <= heute);
      if (!ok && (i === perioden.length - 1 || ruhtAm(r, t))) continue; // laufender Termin bzw. in einer Pause: offen, nicht verfehlt
      bewertet.push(ok);
    }
    const sechs = bewertet.slice(0, 6);
    const erfuellt = sechs.filter(Boolean).length;
    let streak = 0;
    for (const ok of bewertet) { if (!ok) break; streak++; }
    return { streak, einheit, quote: sechs.length ? erfuellt / sechs.length : null, erfuellt, soll: sechs.length, fenster };
  }

  // intervall: je Erledigung rechtzeitig?
  const schrittTage = Math.max(1, tageZwischen(heute, intervallSchritt(g, heute)));
  const fenster = Math.max(FENSTER_TAGE, 4 * schrittTage);
  const liste = [...erledigt].filter(d => d <= heute).sort();
  const rechtzeitig = (vor: string, nach: string) => nach <= tagePlus(intervallSchritt(g, vor), ruhetageZwischen(r, vor, nach));
  const letzte = liste[liste.length - 1];
  const ueberfaellig = !!letzte && heute > tagePlus(intervallSchritt(g, letzte), ruhetageZwischen(r, letzte, heute) + (ruhtAm(r, heute) ? 1 : 0));
  let streak = 0;
  if (letzte && !ueberfaellig) {
    streak = 1;
    for (let i = liste.length - 1; i > 0 && liste[i - 1] >= start; i--) { if (!rechtzeitig(liste[i - 1], liste[i])) break; streak++; }
  }
  const von = tagePlus(heute, -(fenster - 1));
  const imFenster = liste.map((d, i) => ({ d, ok: i === 0 || rechtzeitig(liste[i - 1], d) })).filter(x => x.d >= von && x.d >= start);
  const soll = imFenster.length + (ueberfaellig ? 1 : 0);
  const erfuellt = imFenster.filter(x => x.ok).length;
  return { streak, einheit, quote: soll ? erfuellt / soll : null, erfuellt, soll, fenster };
}

// ── Anzeige ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Der Rhythmus als Wort — für Chips. */
export function rhythmusKurz(r: Rhythmus | undefined): string {
  switch (r ?? 'taeglich') {
    case 'taeglich': return 'täglich';
    case '3x-woche': return '3×/Woche';
    case 'woechentlich': return 'wöchentlich';
    case 'monatlich': return 'monatlich';
    case 'quartal': return 'quartalsweise';
    case 'halbjahr': return 'halbjährlich';
    case 'jaehrlich': return 'jährlich';
  }
}

export const WT_KURZ: Readonly<Record<Wochentag, string>> = { 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa', 7: 'So' };
export const WT_LANG: Readonly<Record<Wochentag, string>> = { 1: 'Montag', 2: 'Dienstag', 3: 'Mittwoch', 4: 'Donnerstag', 5: 'Freitag', 6: 'Samstag', 7: 'Sonntag' };
const nterWort = (n: number) => (n === -1 ? 'letzten' : `${n}.`);
const einheitWort = (e: IntervallEinheit, n: number) => (e === 'monat' ? (n === 1 ? 'Monat' : 'Monate') : e === 'woche' ? (n === 1 ? 'Woche' : 'Wochen') : (n === 1 ? 'Tag' : 'Tage'));

/** Die Regel als kurzes Wort für Chips („Mo · Do“, „3×/Wo“, „alle 3 Tage“, „am 15.“, „1. Mo“). Täglich → „täglich“. */
export function regelKurz(g: RoutineRegel): string {
  const alt = rhythmusAusRegel(g);
  if (alt) return rhythmusKurz(alt);
  const alle = g.alle ?? 1;
  switch (g.art) {
    case 'werktage': return 'werktags';
    case 'wochentage': return `${(g.tage ?? []).map(t => WT_KURZ[t]).join(' · ')}${alle > 1 ? ` · alle ${alle} Wo.` : ''}`;
    case 'pro-woche': return `${g.anzahl}×/Woche`;
    case 'intervall': return `alle ${alle} ${einheitWort(g.einheit ?? 'tag', alle)}`;
    case 'monatlich': return `${g.nter ? `${nterWort(g.nter.n)} ${WT_KURZ[g.nter.tag]}` : `am ${g.monatstag}.`}${alle > 1 ? ` · alle ${alle} Mon.` : ' im Monat'}`;
    default: return 'täglich';
  }
}

/** Die Regel als Satz (Editor, Erklärung): „jeden Montag und Donnerstag“, „3× pro Woche, egal an welchem Tag“ … */
export function regelText(g: RoutineRegel): string {
  const alle = g.alle ?? 1;
  switch (g.art) {
    case 'taeglich': return 'jeden Tag';
    case 'werktage': return 'werktags (Mo–Fr, ohne Feiertage)';
    case 'wochentage': {
      const t = (g.tage ?? []).map(x => WT_LANG[x]);
      const liste = t.length > 1 ? `${t.slice(0, -1).join(', ')} und ${t[t.length - 1]}` : t[0] ?? '';
      return `${alle > 1 ? `alle ${alle} Wochen am` : 'jeden'} ${liste}`;
    }
    case 'pro-woche': return `${g.anzahl}× pro Woche, egal an welchem Tag`;
    case 'intervall': return `alle ${alle} ${einheitWort(g.einheit ?? 'tag', alle)}, gerechnet ab dem letzten Mal`;
    case 'monatlich': {
      const tag = g.nter ? `am ${nterWort(g.nter.n)} ${WT_LANG[g.nter.tag]}` : `am ${g.monatstag}.${(g.monatstag ?? 0) > 28 ? ' (sonst am Monatsende)' : ''}`;
      return `${alle > 1 ? `alle ${alle} Monate` : 'jeden Monat'} ${tag}`;
    }
  }
}

/** Rhythmus einer Routine fürs Auge — Regel, dazu „8 Gläser“ bzw. „3× täglich (08:00 · 13:00 · 20:00)“. Täglich ohne Zähler → ''. */
export function routineRhythmusKurz(r: Pick<Routine, 'rhythmus' | 'regel' | 'tagesZiel' | 'zaehlWort' | 'uhrzeiten'>): string {
  const g = regelVon(r);
  const teile: string[] = [];
  if (g.art !== 'taeglich') teile.push(regelKurz(g));
  const ziel = tagesZielVon(r);
  if (ziel > 1) teile.push(r.zaehlWort ? `${ziel} ${r.zaehlWort}` : `${ziel}× ${g.art === 'taeglich' ? 'täglich' : 'am Tag'}`);
  if (r.uhrzeiten?.length) teile.push(r.uhrzeiten.join(' · '));
  return teile.join(' · ');
}
