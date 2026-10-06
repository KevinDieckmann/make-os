// ─── MAKE OS — Aufgaben: Ansichten Tabelle und Kalender/Zeitachse (rein, 28.09. spät, Paket C5) ─
// Kevin 28.09.: „Liste, Board, Tabelle (Spalten sortierbar), Kalender/Zeitachse nach Deadline.“
// Hier steht alles, was die beiden Ansichten rechnen — ohne React, client- und server-sicher, getestet in
// tests/aufgaben-ansichten.test.ts:
//   · Tabelle: Spalten (fest + eigene Felder der Projekte im Kontext), Sortierung (leere Werte immer unten,
//     Unteraufgaben bleiben unter ihrer Aufgabe), Summen für Zahl-/Betrag-Felder, Anzeige der Feldwerte
//     (Betrag aus Cent), Betrag-Eingabe zurück in Cent.
//   · Kalender: Berliner Tag, Monatsblatt/Woche, Einträge (Start → Deadline), Balken je Woche in Bahnen,
//     Verschieben einer Deadline (Start wandert mit, die Dauer bleibt).
// Geschrieben wird hier nichts — die Ansichten schicken Teile über den Aufgaben-Kontext (Einzeländerung mit Stand).

import type { EigenesFeld, FeldWert, Task, TasksState } from '@/types/tasks';
import type { Priority } from '@/types/common';
import { LEUCHT, FARBE } from '@/lib/make-one/design';
import { wandzeit, tagPlus } from '@/lib/kalender/zeit';
import { montagVon, monatsblatt } from '@/lib/kalender/layout';
import { kalenderwoche } from '@/lib/zeit/kalender-kern';

// ── Allgemein ──────────────────────────────────────────────────────────────

const TAG = /^\d{4}-\d{2}-\d{2}$/;
export const istTag = (v: unknown): v is string => typeof v === 'string' && TAG.test(v);

/** Der heutige Tag in Berlin (YYYY-MM-DD) — unabhängig von der Zeitzone des Geräts bzw. Servers. */
export const berlinHeute = (jetzt: Date = new Date()): string => wandzeit(jetzt).slice(0, 10);

/** Ganze Kalendertage von `a` nach `b` (b − a). */
export function tageZwischen(a: string, b: string): number {
  const d = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((d(b) - d(a)) / 86_400_000);
}

export const datumKurz = (d?: string): string => (d && istTag(d) ? `${d.slice(8)}.${d.slice(5, 7)}.` : '');
export const datumLang = (d?: string): string => (d && istTag(d) ? `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '');

/** Überfällig: Deadline vor heute und nicht erledigt. */
export const istUeberfaellig = (t: Pick<Task, 'dueDate' | 'status'>, heute: string): boolean => !!t.dueDate && istTag(t.dueDate) && t.dueDate < heute && t.status !== 'done';

/** Prioritäten in der Reihenfolge der Dringlichkeit (Rang 0 = kritisch) — Anzeige wie im Detail. */
export const PRIORITAETEN: readonly { id: Priority; label: string; farbe: string; rang: number }[] = [
  { id: 'critical', label: 'Kritisch', farbe: LEUCHT.kritisch, rang: 0 },
  { id: 'high', label: 'Hoch', farbe: LEUCHT.achtung, rang: 1 },
  { id: 'medium', label: 'Normal', farbe: LEUCHT.puls, rang: 2 },
  { id: 'low', label: 'Niedrig', farbe: FARBE.inkLeise, rang: 3 },
];
export const prioRang = (p: string | undefined): number => PRIORITAETEN.find(x => x.id === p)?.rang ?? 2;

// ── Tabelle: Spalten ───────────────────────────────────────────────────────

/** Feste Spalten + eigene Felder als `feld:<projektId>:<feldId>` (Feld-Kennungen gelten je Projekt). */
export type FesteSpalte = 'titel' | 'status' | 'zustaendig' | 'deadline' | 'prioritaet' | 'ort' | 'crm' | 'wartet';
export interface SpalteDef {
  id: string;
  label: string;
  /** Nur eigene Felder: Definition + Projekt, zu dem es gehört. */
  feld?: EigenesFeld;
  projektId?: string;
  projektTitel?: string;
  /** Kann nicht ausgeblendet werden (Titel). */
  immer?: boolean;
  /** Summenzeile rechnet diese Spalte (Zahl/Betrag). */
  summe?: boolean;
  /** Breite in px (die Tabelle scrollt im eigenen Behälter). */
  breite: number;
}

export const FESTE_SPALTEN: readonly SpalteDef[] = [
  { id: 'titel', label: 'Aufgabe', immer: true, breite: 280 },
  { id: 'status', label: 'Status', breite: 140 },
  { id: 'zustaendig', label: 'Zuständig', breite: 120 },
  { id: 'deadline', label: 'Deadline', breite: 150 },
  { id: 'prioritaet', label: 'Priorität', breite: 120 },
  { id: 'ort', label: 'Liste', breite: 180 },
  { id: 'crm', label: 'CRM-Bezug', breite: 180 },
  { id: 'wartet', label: 'Wartet auf', breite: 180 },
];

export const feldSpalteId = (projektId: string, feldId: string): string => `feld:${projektId}:${feldId}`;
const FELD_BREITE: Record<EigenesFeld['typ'], number> = { text: 180, zahl: 110, betrag: 130, datum: 150, auswahl: 140, link: 180, person: 120 };

/**
 * Die Spalten der Tabelle: feste, dann die eigenen Felder aller Projekte, deren Aufgaben im Kontext stehen
 * (Projekte alphabetisch, Felder in ihrer Reihenfolge). Stehen mehrere Projekte mit Feldern da, trägt der
 * Spaltentitel das Projekt mit — sonst verwechselt man „Budget“ aus zwei Projekten.
 */
export function tabellenSpalten(state: Pick<TasksState, 'projects'>, aufgaben: readonly Pick<Task, 'projectId'>[]): SpalteDef[] {
  const ids = new Set(aufgaben.map(t => t.projectId));
  const projekte = state.projects.filter(p => ids.has(p.id) && p.felder?.length).sort((a, b) => a.title.localeCompare(b.title, 'de'));
  const mehrere = projekte.length > 1;
  const felder: SpalteDef[] = [];
  for (const p of projekte) for (const f of p.felder ?? []) {
    felder.push({
      id: feldSpalteId(p.id, f.id), label: mehrere ? `${f.name} · ${p.title}` : f.name, feld: f, projektId: p.id, projektTitel: p.title,
      summe: f.typ === 'zahl' || f.typ === 'betrag', breite: FELD_BREITE[f.typ] ?? 150,
    });
  }
  return [...FESTE_SPALTEN, ...felder];
}

/** Wert eines eigenen Feldes an einer Aufgabe — nur, wenn die Aufgabe zum Projekt des Feldes gehört. */
export function feldWertVon(t: Pick<Task, 'projectId' | 'felder'>, s: Pick<SpalteDef, 'feld' | 'projektId'>): FeldWert | undefined {
  if (!s.feld || t.projectId !== s.projektId) return undefined;
  const w = t.felder?.[s.feld.id];
  return w === '' ? undefined : w;
}

// ── Tabelle: Werte anzeigen und lesen ──────────────────────────────────────

const EURO = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const ZAHL = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 4 });
/** Betrag in ganzen Cent → „1.234,56 €“. */
export const betragText = (cent: number): string => EURO.format(cent / 100);
export const zahlText = (n: number): string => ZAHL.format(n);

/**
 * Eingabe eines Betrags → ganze Cent. Versteht „1.234,56“, „1234,5“, „1234.56“, „12 €“, „-3,20“.
 * Leer → null (Feld leeren); Unlesbares → NaN (die Zelle zeigt einen Hinweis und speichert nicht).
 */
export function betragLesen(text: string): number | null {
  let s = String(text ?? '').replace(/[€\s ]/g, '').trim();
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return Number.NaN;
  return Math.round(Number(s) * 100);
}

/** Eingabe einer Zahl (deutsch oder englisch) → Zahl; leer → null; Unlesbares → NaN. */
export function zahlLesen(text: string): number | null {
  let s = String(text ?? '').replace(/[\s ]/g, '').trim();
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return Number.NaN;
  return Number(s);
}

/** Anzeige eines Feldwerts, typgerecht (Betrag aus Cent, Datum deutsch, Person über `personName`). */
export function feldText(f: Pick<EigenesFeld, 'typ'>, w: FeldWert | undefined, personName: (s: string) => string = s => s): string {
  if (w === undefined || w === '') return '';
  switch (f.typ) {
    case 'betrag': return typeof w === 'number' ? betragText(w) : String(w);
    case 'zahl': return typeof w === 'number' ? zahlText(w) : String(w);
    case 'datum': return typeof w === 'string' ? datumLang(w) || w : String(w);
    case 'person': return personName(String(w));
    default: return String(w);
  }
}

/** Neue Feldwerte einer Aufgabe: Wert setzen bzw. (null/leer) entfernen. `undefined` = keine Werte mehr. */
export function felderMit(alt: Task['felder'], feldId: string, wert: FeldWert | null): Task['felder'] {
  const n: Record<string, FeldWert> = { ...(alt ?? {}) };
  if (wert === null || wert === '' || (typeof wert === 'number' && !Number.isFinite(wert))) delete n[feldId];
  else n[feldId] = wert;
  return Object.keys(n).length ? n : undefined;
}

// ── Tabelle: Sortieren und Zeilen ──────────────────────────────────────────

export type Richtung = 'auf' | 'ab';
export interface Sortierung { spalte: string; richtung: Richtung }

/** Was die Sortierung aus der Umgebung braucht (Namen, Ränge) — die Ansicht reicht es herein. */
export interface SortKontext {
  /** Rang des Status in der Reihenfolge des Space (Offen … Erledigt, eigene dazwischen). */
  statusRang: (t: Task) => number;
  /** Anzeigename einer Person bzw. „Beide“. */
  person: (o: string) => string;
  /** „Gruppe › Liste“ (bzw. „Projekt › …“). */
  ort: (t: Task) => string;
  /** Anzeigename des (ersten) CRM-Bezugs, leer ohne Bezug. */
  crm: (t: Task) => string;
  /** Anzahl offener Aufgaben, auf die `t` wartet. */
  wartet: (t: Task) => number;
  /** Spalten (für eigene Felder). */
  spalten: readonly SpalteDef[];
}

/** Sortierwert einer Zelle — `null` = leer (steht immer unten, in beiden Richtungen). */
export function sortWert(t: Task, spalte: string, k: SortKontext): string | number | null {
  switch (spalte) {
    case 'titel': return t.title.toLocaleLowerCase('de-DE');
    case 'status': return k.statusRang(t);
    case 'zustaendig': return k.person(t.assignee).toLocaleLowerCase('de-DE') || null;
    case 'deadline': return istTag(t.dueDate) ? t.dueDate : null;
    case 'prioritaet': return prioRang(t.priority);
    case 'ort': return k.ort(t).toLocaleLowerCase('de-DE') || null;
    case 'crm': return k.crm(t).toLocaleLowerCase('de-DE') || null;
    case 'wartet': { const n = k.wartet(t); return n > 0 ? n : null; }
    default: {
      const s = k.spalten.find(x => x.id === spalte);
      if (!s?.feld) return null;
      const w = feldWertVon(t, s);
      if (w === undefined) return null;
      if (s.feld.typ === 'zahl' || s.feld.typ === 'betrag') return typeof w === 'number' ? w : null;
      if (s.feld.typ === 'person') return k.person(String(w)).toLocaleLowerCase('de-DE');
      if (s.feld.typ === 'auswahl') { const i = s.feld.optionen?.indexOf(String(w)) ?? -1; return i >= 0 ? i : String(w).toLocaleLowerCase('de-DE'); }
      return String(w).toLocaleLowerCase('de-DE');
    }
  }
}

/** Vergleich zweier Sortierwerte: leer immer zuletzt, Zahlen numerisch, Text nach deutscher Ordnung. */
export function vergleiche(a: string | number | null, b: string | number | null, richtung: Richtung): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const r = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'de', { numeric: true });
  return richtung === 'auf' ? r : -r;
}

export interface TabellenZeile {
  task: Task;
  /** 0 = oben (Aufgabe bzw. Unteraufgabe ohne Elternteil im Kontext), 1 = deren Unteraufgabe … (mehrstufig seit 01.10.). */
  tiefe: number;
  /** Anzahl direkter Unteraufgaben im Kontext (jede Ebene — für den Aufklapp-Pfeil). */
  unter: number;
}

/**
 * Die Zeilen der Tabelle. `aufgaben` kommt in der Vorgabe-Reihenfolge (wie die Liste); ohne Sortierung bleibt sie.
 * Oben stehen Aufgaben (und Unteraufgaben, deren Elternteil nicht im Kontext steht); Unteraufgaben folgen ihrem
 * Elternteil, wenn es aufgeklappt ist (`auf`), in derselben Sortierung — auf jeder Ebene (01.10.). Stabil (gleiche
 * Werte behalten die Vorgabe). Kreisfest.
 */
export function tabelleZeilen(aufgaben: readonly Task[], sort: Sortierung | null, k: SortKontext, auf: ReadonlySet<string>): TabellenZeile[] {
  const ids = new Set(aufgaben.map(t => t.id));
  const kinder = new Map<string, Task[]>();
  const oben: Task[] = [];
  for (const t of aufgaben) {
    if (t.parentId && ids.has(t.parentId) && t.parentId !== t.id) kinder.set(t.parentId, [...(kinder.get(t.parentId) ?? []), t]);
    else oben.push(t);
  }
  const ordne = (l: Task[]): Task[] => {
    if (!sort) return l;
    const werte = new Map(l.map(t => [t.id, sortWert(t, sort.spalte, k)]));
    return [...l].sort((a, b) => vergleiche(werte.get(a.id) ?? null, werte.get(b.id) ?? null, sort.richtung));
  };
  const raus: TabellenZeile[] = [];
  const gesehen = new Set<string>();
  const zeile = (t: Task, tiefe: number) => {
    if (gesehen.has(t.id)) return;
    gesehen.add(t.id);
    const u = kinder.get(t.id) ?? [];
    raus.push({ task: t, tiefe, unter: u.length });
    if (auf.has(t.id)) for (const x of ordne(u)) zeile(x, tiefe + 1);
  };
  for (const t of ordne(oben)) zeile(t, 0);
  return raus;
}

/** Nach einer Vorgabe ordnen (Kennungen in Listen-Reihenfolge); Unbekannte hinten in ihrer bisherigen Reihenfolge. */
export function nachVorgabe<T extends { id: string }>(liste: readonly T[], reihenfolge: readonly string[]): T[] {
  const rang = new Map(reihenfolge.map((id, i) => [id, i]));
  return liste.map((t, i) => ({ t, i, r: rang.get(t.id) ?? reihenfolge.length + i })).sort((a, b) => a.r - b.r).map(x => x.t);
}

/** Nächster Sortierzustand beim Klick auf einen Spaltenkopf: aufsteigend → absteigend → Vorgabe. */
export function naechsteSortierung(alt: Sortierung | null, spalte: string): Sortierung | null {
  if (!alt || alt.spalte !== spalte) return { spalte, richtung: 'auf' };
  return alt.richtung === 'auf' ? { spalte, richtung: 'ab' } : null;
}

export interface Summe { summe: number; anzahl: number }
/**
 * Summen je Zahl-/Betrag-Spalte über ALLE Aufgaben des Kontexts (auch Unteraufgaben, auch zugeklappte —
 * der einzelne Beleg trägt oft den Betrag). `anzahl` = Aufgaben mit Wert.
 */
export function summen(aufgaben: readonly Task[], spalten: readonly SpalteDef[]): Record<string, Summe> {
  const raus: Record<string, Summe> = {};
  for (const s of spalten) {
    if (!s.summe) continue;
    let summe = 0; let anzahl = 0;
    for (const t of aufgaben) { const w = feldWertVon(t, s); if (typeof w === 'number' && Number.isFinite(w)) { summe += w; anzahl++; } }
    raus[s.id] = { summe, anzahl };
  }
  return raus;
}

/** Spalten-Merker lesen (localStorage-Inhalt): ausgeblendete Spalten + Sortierung; alles Fremde fällt weg. */
export function merkerLesen(roh: string | null): { aus: string[]; sort: Sortierung | null } {
  try {
    const d = JSON.parse(roh ?? 'null') as { aus?: unknown; sort?: unknown } | null;
    const aus = Array.isArray(d?.aus) ? d.aus.filter((x): x is string => typeof x === 'string' && x !== 'titel' && x.length <= 200).slice(0, 100) : [];
    const s = d?.sort as { spalte?: unknown; richtung?: unknown } | undefined;
    const sort = s && typeof s.spalte === 'string' && (s.richtung === 'auf' || s.richtung === 'ab') ? { spalte: s.spalte, richtung: s.richtung } as Sortierung : null;
    return { aus, sort };
  } catch { return { aus: [], sort: null }; }
}

// ── Kalender / Zeitachse ───────────────────────────────────────────────────

export type KalenderAnsicht = 'monat' | 'woche';
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** ISO-Kalenderwoche eines Tages — aus dem Kalender-Kern (29.09., K2: eine Stelle). */
export { kalenderwoche };

/** Die Tage der Ansicht: Monat = 42 (sechs Wochen ab Montag), Woche = 7 ab Montag. */
export function kalenderTage(ansicht: KalenderAnsicht, anker: string): string[] {
  if (ansicht === 'woche') { const mo = montagVon(anker); return Array.from({ length: 7 }, (_, i) => tagPlus(mo, i)); }
  return monatsblatt(Number(anker.slice(0, 4)), Number(anker.slice(5, 7)));
}

/** Anker einen Schritt weiter: Monat → 1. des Nachbarmonats, Woche → ± 7 Tage. */
export function ankerSchritt(ansicht: KalenderAnsicht, anker: string, schritt: -1 | 1): string {
  if (ansicht === 'woche') return tagPlus(anker, 7 * schritt);
  let j = Number(anker.slice(0, 4)); let m = Number(anker.slice(5, 7)) + schritt;
  if (m < 1) { m = 12; j--; } if (m > 12) { m = 1; j++; }
  return `${j}-${String(m).padStart(2, '0')}-01`;
}

/** Titel der Ansicht: „September 2026“ bzw. „KW 40 · 28.09.–04.10.2026“. */
export function kalenderTitel(ansicht: KalenderAnsicht, anker: string): string {
  if (ansicht === 'woche') { const mo = montagVon(anker); const so = tagPlus(mo, 6); return `KW ${kalenderwoche(mo)} · ${datumKurz(mo)}–${datumLang(so)}`; }
  return `${MONATE[Number(anker.slice(5, 7)) - 1] ?? ''} ${anker.slice(0, 4)}`;
}

export interface KalenderEintrag {
  task: Task;
  /** Erster Tag des Balkens: Start (wenn gültig und nicht nach der Deadline), sonst die Deadline. */
  start: string;
  /** Deadline. */
  ende: string;
  ueberfaellig: boolean;
  wiederkehrend: boolean;
}

/** Aufgaben mit Deadline als Einträge (Start → Deadline). Ohne gültige Deadline: nicht dabei (→ „ohne Datum“). */
export function kalenderEintraege(aufgaben: readonly Task[], heute: string): KalenderEintrag[] {
  const raus: KalenderEintrag[] = [];
  for (const t of aufgaben) {
    if (!istTag(t.dueDate)) continue;
    const start = istTag(t.startDate) && t.startDate <= t.dueDate ? t.startDate : t.dueDate;
    raus.push({ task: t, start, ende: t.dueDate, ueberfaellig: istUeberfaellig(t, heute), wiederkehrend: !!t.wiederholung });
  }
  return raus;
}

/** Aufgaben ohne (gültige) Deadline — die Seitenliste „ohne Datum“ (offene zuerst, dann nach Titel). */
export function ohneDatum(aufgaben: readonly Task[]): Task[] {
  return aufgaben.filter(t => !istTag(t.dueDate)).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.title.localeCompare(b.title, 'de'));
}

export interface Balken {
  eintrag: KalenderEintrag;
  /** Spalte 0–6 (Montag = 0), erster und letzter Tag in dieser Woche. */
  von: number;
  bis: number;
  /** Zeile innerhalb der Woche (0 = oben). */
  bahn: number;
  /** Beginnt bzw. endet der Balken in dieser Woche (sonst läuft er über den Rand). */
  anfang: boolean;
  ende: boolean;
}
export interface WochenZeile { tage: string[]; balken: Balken[]; bahnen: number }

/**
 * Balken je Woche legen (wie ein Monatskalender mit mehrtägigen Terminen): die Tage in Wochen zu sieben, jeder
 * Eintrag, der die Woche berührt, bekommt einen Abschnitt; Bahnen gierig vergeben — früher Beginn zuerst, bei
 * gleichem Beginn der längere (der Balken, der in die Woche hineinläuft, bleibt oben).
 */
export function wochenLegen(tage: readonly string[], eintraege: readonly KalenderEintrag[]): WochenZeile[] {
  const raus: WochenZeile[] = [];
  for (let w = 0; w + 7 <= tage.length; w += 7) {
    const woche = tage.slice(w, w + 7);
    const erster = woche[0]; const letzter = woche[6];
    const drin = eintraege
      .filter(e => e.start <= letzter && e.ende >= erster)
      .map(e => ({ e, von: Math.max(0, tageZwischen(erster, e.start)), bis: Math.min(6, tageZwischen(erster, e.ende)) }))
      .sort((a, b) => a.von - b.von || (b.bis - b.von) - (a.bis - a.von) || prioRang(a.e.task.priority) - prioRang(b.e.task.priority) || a.e.task.title.localeCompare(b.e.task.title, 'de') || a.e.task.id.localeCompare(b.e.task.id));
    const bahnEnde: number[] = [];
    const balken: Balken[] = [];
    for (const x of drin) {
      let bahn = bahnEnde.findIndex(ende => ende < x.von);
      if (bahn === -1) { bahn = bahnEnde.length; bahnEnde.push(x.bis); } else bahnEnde[bahn] = x.bis;
      balken.push({ eintrag: x.e, von: x.von, bis: x.bis, bahn, anfang: x.e.start >= erster, ende: x.e.ende <= letzter });
    }
    raus.push({ tage: woche, balken, bahnen: bahnEnde.length });
  }
  return raus;
}

/** Je Tag der Woche: wie viele Balken liegen in Bahnen ab `max` (verdeckt, „+n“)? */
export function verdecktJeTag(z: WochenZeile, max: number): number[] {
  const n = [0, 0, 0, 0, 0, 0, 0];
  for (const b of z.balken) if (b.bahn >= max) for (let i = b.von; i <= b.bis; i++) n[i]++;
  return n;
}

/**
 * Deadline auf `neuerTag` legen. Mit Start wandert der Start um dieselbe Zahl Tage mit (der Balken behält seine
 * Dauer). Gleicher Tag oder ungültiges Datum → null (nichts zu schreiben).
 */
export function verschiebenTeil(t: Pick<Task, 'dueDate' | 'startDate'>, neuerTag: string): Pick<Task, 'dueDate' | 'startDate'> | null {
  if (!istTag(neuerTag) || t.dueDate === neuerTag) return null;
  if (!istTag(t.dueDate)) return { dueDate: neuerTag };
  if (!istTag(t.startDate)) return { dueDate: neuerTag };
  return { dueDate: neuerTag, startDate: tagPlus(t.startDate, tageZwischen(t.dueDate, neuerTag)) };
}
