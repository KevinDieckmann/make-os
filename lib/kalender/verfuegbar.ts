// ─── Kalender — freie Zeit finden (rein, getestet, 29.09., Paket K4) ─────────
// Kevin: „Gemeinsame freie Zeit (Kevin + Malin übereinander, freie Lücken vorschlagen)“ — und dieselbe
// Rechnung für die öffentliche Buchungsseite, ZOE (Werkzeug „freie_zeit“, nur lesen) und das Angebots-Tool
// („Termin zum Besprechen vorschlagen“). Deshalb EINE reine Funktion ohne Platte, Netz und Uhr: `freieZeiten`.
//
//   Eingabe   Belegungen („belegt/abwesend“), Arbeitszeit je Person — je Tag (aus K1) oder als Wochen-Fenster
//             (Buchungsseite; Standard Mo–Fr 09:00–18:00) —, gewünschte Dauer, Zeitraum (Tage ab einem Berliner Tag),
//             Puffer um jede Belegung, Vorlauf ab „jetzt“, Raster, Feiertage (Tag → Name).
//   Ausgabe   freie Lücken als Berliner Wandzeit „YYYY-MM-DDTHH:mm:ss“ — nur Zeiten, nie Titel. Feiertage stehen
//             als Hinweis am Vorschlag (oder sperren den Tag, wenn `feiertageSperren`).
//
// Zeitumstellung: gerechnet wird in Wandzeit-Minuten je Tag; ein Vorschlag, dessen echte Dauer wegen der
// Umstellung (Ende März 02:00–03:00 fehlt, Ende Oktober doppelt) nicht der gewünschten entspricht, fällt weg.
// Der Vorlauf wird über echte Zeitpunkte geprüft (`ausWandzeit`), nie über die Zone der Maschine.
//
// WANN jemand da ist (Abwesend, Arbeitsort, beschäftigt = TRANSP, Soll-Arbeitszeit aus der Wochenvorlage, Feiertage)
// rechnet NICHT diese Datei, sondern K1 `verfuegbarkeitFuer` (lib/kalender/verfuegbarkeit.ts) — lib/kalender/freie-zeit.ts
// übersetzt deren Tage in Belegungen und Arbeitszeit je Tag. Hier nur: Lücken suchen.

import { ausWandzeit, wandzeit, tagPlus, wandAus, minutenVon, tagVon } from './zeit';

/** Wer muss frei sein — Speichername einer Person des Haushalts („kevin“, „malin“). */
export type PersonName = string;
/** Wem ein Termin gehört: eine Person oder beide (gemeinsamer Kalender zählt für jede Person). */
export type BelegungWer = PersonName | 'beide';

/** Ein Zeitfenster an Wochentagen (1 = Montag … 7 = Sonntag), Uhrzeiten „HH:MM“ Berliner Wandzeit. */
export interface Fenster { tage: number[]; von: string; bis: string }

/** Standard-Arbeitszeit, solange nichts eingestellt ist: Mo–Fr 09:00–18:00. */
export const ARBEITSZEIT_STANDARD: readonly Fenster[] = [{ tage: [1, 2, 3, 4, 5], von: '09:00', bis: '18:00' }];

/** Eine Spanne in Berliner Wandzeit. */
export interface Zeitspanne { start: string; ende: string }

export interface Belegung {
  wer: BelegungWer;
  /** Berliner Wandzeit; ganztags 00:00, Ende exklusiv. */
  start: string;
  ende: string;
  art: 'belegt' | 'abwesend';
  /** Privater Termin (CLASS:PRIVATE/CONFIDENTIAL) — anderen nur als „belegt“ zeigen. */
  privat?: boolean;
}

export interface FreiEingabe {
  /** Wer muss gleichzeitig frei sein. */
  personen: PersonName[];
  belegungen: readonly Belegung[];
  /** Arbeitszeiten je Person; fehlt eine Person → `ARBEITSZEIT_STANDARD`. */
  arbeitszeiten?: Readonly<Record<string, readonly Fenster[]>>;
  /** Arbeitszeit je Person und Tag (Wandzeit-Spannen, aus K1 `verfuegbarkeitFuer`) — gewinnt vor `arbeitszeiten`. */
  arbeitszeitJeTag?: Readonly<Record<string, Readonly<Record<string, readonly Zeitspanne[]>>>>;
  /** Gewünschte Dauer in Minuten (5 … 480). */
  dauerMin: number;
  /** Erster Berliner Tag (YYYY-MM-DD). */
  von: string;
  /** Wie viele Tage ab `von` (1 … 60), Standard 14. */
  tage?: number;
  /** Jetzt (echter Zeitpunkt) — nichts vor jetzt + Vorlauf. */
  jetzt: Date;
  /** Mindestabstand zu jetzt in Minuten (z. B. 24 h für Buchungen). */
  vorlaufMin?: number;
  /** Abstand vor und nach jeder Belegung in Minuten. */
  pufferMin?: number;
  /** Raster der Startzeiten in Minuten (Standard 15). */
  rasterMin?: number;
  /** Feiertage im Zeitraum: Tag → Name (Quelle: K2, Feiertage NRW). */
  feiertage?: Readonly<Record<string, string>>;
  /** Feiertage ganz sperren (Buchungsseite) statt nur als Hinweis zu zeigen. */
  feiertageSperren?: boolean;
  /** Höchstens so viele Vorschläge je Tag (Buchungsseite: „max. je Tag“ minus schon gebuchte). */
  maxJeTag?: number;
  /** Schon belegte Plätze je Tag (für `maxJeTag`). */
  bereitsJeTag?: Readonly<Record<string, number>>;
  /** Höchstens so viele Vorschläge insgesamt (Standard 400). */
  grenze?: number;
}

export interface FreieZeit {
  start: string;
  ende: string;
  tag: string;
  /** Name des Feiertags, wenn der Vorschlag auf einen fällt (nur Hinweis). */
  feiertag?: string;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/;
const minAus = (hhmm: string) => (hhmm === '24:00' ? 1440 : Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)));
const zahl = (v: unknown, min: number, max: number, sonst: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : sonst; };

/** Wochentag eines Berliner Tags: 1 = Montag … 7 = Sonntag. */
export function wochentag(tag: string): number {
  const d = new Date(`${tag}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Fenster säubern: gültige Tage 1–7, „HH:MM“, bis > von; höchstens 21 Fenster. Leere Liste bleibt leer (= nie verfügbar). */
export function fensterSauber(roh: unknown): Fenster[] | null {
  if (!Array.isArray(roh)) return null;
  if (roh.length > 21) return null;
  const raus: Fenster[] = [];
  for (const f of roh as { tage?: unknown; von?: unknown; bis?: unknown }[]) {
    if (!f || typeof f !== 'object' || !Array.isArray(f.tage)) return null;
    const tage = Array.from(new Set((f.tage as unknown[]).map(Number).filter(t => Number.isInteger(t) && t >= 1 && t <= 7))).sort();
    const von = String(f.von ?? ''), bis = String(f.bis ?? '');
    if (!tage.length || !HHMM.test(von) || !HHMM.test(bis) || minAus(bis) <= minAus(von)) return null;
    raus.push({ tage, von, bis });
  }
  return raus;
}

type Spanne = [number, number];

/** Spannen vereinigen (sortiert, überlappende/angrenzende zusammen). */
function vereinigen(l: Spanne[]): Spanne[] {
  const s = l.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const raus: Spanne[] = [];
  for (const [a, b] of s) {
    const letzte = raus[raus.length - 1];
    if (letzte && a <= letzte[1]) letzte[1] = Math.max(letzte[1], b);
    else raus.push([a, b]);
  }
  return raus;
}

/** Schnitt zweier vereinigter Spannen-Listen. */
function schneiden(a: Spanne[], b: Spanne[]): Spanne[] {
  const raus: Spanne[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i][0], b[j][0]), hi = Math.min(a[i][1], b[j][1]);
    if (hi > lo) raus.push([lo, hi]);
    if (a[i][1] < b[j][1]) i++; else j++;
  }
  return raus;
}

/** Spannen `b` aus `a` herausnehmen. */
function abziehen(a: Spanne[], b: Spanne[]): Spanne[] {
  let rest = a;
  for (const [x, y] of b) {
    const neu: Spanne[] = [];
    for (const [p, q] of rest) {
      if (y <= p || x >= q) { neu.push([p, q]); continue; }
      if (x > p) neu.push([p, x]);
      if (y < q) neu.push([y, q]);
    }
    rest = neu;
  }
  return rest;
}

/** Arbeitsfenster einer Person an einem Tag (Minuten seit Mitternacht). */
function fensterAmTag(fenster: readonly Fenster[], tag: string): Spanne[] {
  const wt = wochentag(tag);
  return vereinigen(fenster.filter(f => f.tage.includes(wt)).map(f => [minAus(f.von), minAus(f.bis)] as Spanne));
}

/** Tage zwischen zwei Berliner Tagen (b − a). */
const tageZwischen = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/** Eine Belegung als Spanne am Tag (Minuten relativ zu 00:00 dieses Tags, mit Puffer, abgeschnitten auf 0–1440). */
function spanneAmTag(b: Belegung, tag: string, puffer: number): Spanne | null {
  const von = tageZwischen(tag, tagVon(b.start)) * 1440 + minutenVon(b.start) - puffer;
  const bis = tageZwischen(tag, tagVon(b.ende)) * 1440 + minutenVon(b.ende) + puffer;
  const s: Spanne = [Math.max(0, von), Math.min(1440, bis)];
  return s[1] > s[0] ? s : null;
}

/** Wandzeit-Spannen (Arbeitszeit je Tag) als Minuten-Spannen dieses Tags. */
function spannenAmTag(l: readonly Zeitspanne[], tag: string): Spanne[] {
  return vereinigen(l.map(x => spanneAmTag({ wer: '', start: x.start, ende: x.ende, art: 'belegt' }, tag, 0)).filter((x): x is Spanne => !!x));
}

/**
 * Freie gemeinsame Lücken der gewünschten Dauer. Rein: dieselbe Eingabe → dieselbe Ausgabe.
 * Leere `personen` → keine Vorschläge (niemand, für den man planen könnte).
 */
export function freieZeiten(e: FreiEingabe): FreieZeit[] {
  const personen = Array.from(new Set(e.personen.filter(Boolean)));
  if (!personen.length) return [];
  const dauer = zahl(e.dauerMin, 5, 480, 30);
  const tage = zahl(e.tage ?? 14, 1, 60, 14);
  const puffer = zahl(e.pufferMin ?? 0, 0, 240, 0);
  const raster = zahl(e.rasterMin ?? 15, 5, 120, 15);
  const vorlauf = zahl(e.vorlaufMin ?? 0, 0, 60 * 24 * 60, 0);
  const grenze = zahl(e.grenze ?? 400, 1, 5000, 400);
  const frueheste = e.jetzt.getTime() + vorlauf * 60_000;
  const raus: FreieZeit[] = [];
  const zaehlen = personen.map(p => ({ p, fenster: e.arbeitszeiten?.[p] ?? ARBEITSZEIT_STANDARD, jeTag: e.arbeitszeitJeTag?.[p] }));
  for (let i = 0; i < tage && raus.length < grenze; i++) {
    const tag = tagPlus(e.von, i);
    const feiertag = e.feiertage?.[tag];
    if (feiertag && e.feiertageSperren) continue;
    // Gemeinsame Arbeitszeit
    let frei: Spanne[] = [[0, 1440]];
    for (const z of zaehlen) frei = schneiden(frei, z.jeTag ? spannenAmTag(z.jeTag[tag] ?? [], tag) : fensterAmTag(z.fenster, tag));
    if (!frei.length) continue;
    // Belegungen aller Beteiligten (gemeinsame zählen für jede Person)
    const belegt = vereinigen(e.belegungen
      .filter(b => b.wer === 'beide' || personen.includes(b.wer))
      .map(b => spanneAmTag(b, tag, b.art === 'abwesend' ? 0 : puffer))
      .filter((s): s is Spanne => !!s));
    frei = abziehen(frei, belegt);
    let amTag = 0;
    const maxHeute = e.maxJeTag !== undefined ? Math.max(0, e.maxJeTag - (e.bereitsJeTag?.[tag] ?? 0)) : Infinity;
    for (const [a, b] of frei) {
      for (let m = Math.ceil(a / raster) * raster; m + dauer <= b && amTag < maxHeute && raus.length < grenze; m += raster) {
        const start = wandAus(tag, m), ende = wandAus(tag, m + dauer);
        const t0 = ausWandzeit(start).getTime(), t1 = ausWandzeit(ende).getTime();
        if (t0 < frueheste) continue;
        // Zeitumstellung: Beginn oder Ende gibt es als Uhrzeit nicht (Ende März) bzw. die echte Dauer weicht ab (Ende Oktober).
        if (t1 - t0 !== dauer * 60_000 || wandzeit(new Date(t0)) !== start || wandzeit(new Date(t1)) !== ende) continue;
        raus.push({ start, ende, tag, ...(feiertag ? { feiertag } : {}) });
        amTag++;
      }
    }
  }
  return raus;
}

/** Liegt [start, ende) in einer der Lücken? (Reservieren prüft so, ob ein Platz noch frei ist.) */
export function istFrei(start: string, ende: string, frei: readonly FreieZeit[]): boolean {
  return frei.some(f => f.start === start && f.ende === ende);
}

/** Anzeige eines Vorschlags: „Mo 06.10. · 10:00–10:30“. */
export function vorschlagText(f: Pick<FreieZeit, 'start' | 'ende'>): string {
  const WD = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const tag = tagVon(f.start);
  return `${WD[wochentag(tag)]} ${tag.slice(8, 10)}.${tag.slice(5, 7)}. · ${f.start.slice(11, 16)}–${f.ende.slice(11, 16)}`;
}
