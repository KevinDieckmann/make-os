// ─── Apple-Erinnerungen einmal als Aufgaben übernehmen (08.10., Lücke 10 der Roadmap, Kevin R6) — rein, getestet ─────────
// Der Mac-Zulieferer hat die Erinnerungen in den Spiegel `apple-reminders-cache` gelegt (`{ daten: [...], at, quelle }`). Bevor er
// abgeschaltet wird, übernimmt der Inhaber sie EINMAL als Aufgaben: Vorschau (Titel, Fälligkeit, Liste → vorgeschlagener Space,
// „schon übernommen“) → Bestätigen. Geschrieben wird nur über den Aufgaben-Schreibweg (lib/zulieferer/server.ts →
// `systemAufgabenAendern`); hier steht nur die Regel.
//
// Idempotenz: jede Erinnerung bekommt eine FESTE Kennung `ar-<fnv>` — aus der Apple-UID (`x-apple-reminder://…`, seit 08.10. liefert
// der Mac sie mit), sonst aus Liste + Titel + Vorkommen (ältere Spiegel kennen keine UID). „Schon übernommen“ prüft BEIDE Kennungen,
// damit ein späterer Spiegel mit UID nichts doppelt anlegt. Zweimal bestätigen legt nichts doppelt an.
// Inhalte: Notiz → Notiz der Aufgabe, Fälligkeit → `dueDate`/`dueTime` (Berliner Wandzeit), Verantwortlich = der Inhaber,
// „nur ich“ als Vorgabe im Space Privat, erledigte Erinnerungen nur auf Wunsch (als erledigte Aufgabe).

import type { Priority } from '@/types/common';
import { faelligWand } from '@/lib/kalender/eintraege';
import { istKalendertag } from '@/lib/zeit';

/** So liegt eine Erinnerung im Spiegel (alte Form: id/list/title/due/priority; seit 08.10. zusätzlich uid/notes/completed). */
export interface ErinnerungRoh { id?: unknown; uid?: unknown; list?: unknown; title?: unknown; due?: unknown; notes?: unknown; completed?: unknown; priority?: unknown }

export interface Erinnerung {
  /** Kennung der künftigen Aufgabe (`ar-…`): aus der Apple-UID, sonst aus Liste + Titel + Vorkommen. */
  kennung: string;
  /** Alle Kennungen, unter denen sie schon übernommen sein kann (UID-Kennung und Rückfall-Kennung). */
  kennungen: string[];
  liste: string;
  titel: string;
  /** Fälligkeit als Berliner Kalendertag (YYYY-MM-DD). */
  tag?: string;
  /** Uhrzeit „HH:MM“ (nur mit Tag; Mitternacht = ganztägig, ohne Uhrzeit). */
  zeit?: string;
  notiz?: string;
  erledigt: boolean;
  prioritaet: Priority;
}

/** Name einer Liste ohne Namen im Spiegel. */
export const LISTE_OHNE_NAME = 'Erinnerungen';
/** Vorgeschlagener Space je Apple-Liste (Kevin: „Vorgabe privat, je Apple-Liste wählbar“). */
export const SPACE_VORGABE = 'privat';
/** Schlagwort an jeder übernommenen Aufgabe (zum Wiederfinden). */
export const UEBERNAHME_TAG = 'apple-erinnerung';
/** Grenzen der Auswahl (Körper der Route) — darüber 413, nie still gekürzt. */
export const WAHL_GRENZEN = { listen: 200, ohne: 5000, listenName: 200 } as const;
/** Titel einer Aufgabe (lib/aufgaben/saeubern.ts) und Notiz-Grenze (AUFGABEN_GRENZEN.notiz). */
const TITEL_MAX = 300;
const NOTIZ_MAX = 50_000;

const KENNUNG = /^ar-[a-z0-9]{2,32}$/;
export const istUebernahmeKennung = (v: unknown): v is string => typeof v === 'string' && KENNUNG.test(v);

function fnv(t: string): string {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
/** Feste Kennung aus einem Schlüsseltext — zwei FNV-Läufe (≈ 64 Bit), damit auch viele Erinnerungen nicht zusammenfallen. */
export const kennungAus = (schluessel: string): string => `ar-${fnv(schluessel)}${fnv(`§${schluessel}`)}`;

const text = (v: unknown, max = 20_000): string => {
  if (typeof v !== 'string') return '';
  const t = v.replace(/\r\n?/g, '\n').trim();
  return t === 'missing value' ? '' : t.slice(0, max);
};

/** Apple-Priorität (0 keine, 1–4 hoch, 5 mittel, 6–9 niedrig) → Priorität der Aufgabe. */
export function prioritaetAus(v: unknown): Priority {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 'medium';
  if (n <= 4) return 'high';
  if (n === 5) return 'medium';
  return 'low';
}

/** Fälligkeit → Tag + Uhrzeit (Berliner Wandzeit; ein reines Datum bleibt der Tag). Unlesbar → leer. */
export function faelligkeitAus(due: unknown, wand: (d: Date) => string): { tag?: string; zeit?: string } {
  if (typeof due !== 'string' || !due.trim()) return {};
  const w = faelligWand(due, wand);
  if (!w) return {};
  const tag = w.slice(0, 10);
  if (!istKalendertag(tag)) return {};
  const zeit = w.slice(11, 16);
  return /^\d{2}:\d{2}$/.test(zeit) && zeit !== '00:00' ? { tag, zeit } : { tag };
}

/**
 * Den Spiegel lesen (`daten` des Bestands): jede Erinnerung mit Titel, in der Reihenfolge des Spiegels, ohne Doppelte.
 * `wand` = Date → Berliner Wandzeit (lib/kalender/zeit.ts `wandzeit`).
 */
export function erinnerungenLesen(roh: unknown, wand: (d: Date) => string): Erinnerung[] {
  if (!Array.isArray(roh)) return [];
  const raus: Erinnerung[] = [];
  const gesehen = new Set<string>();
  const vorkommen = new Map<string, number>();
  for (const x of roh as ErinnerungRoh[]) {
    if (!x || typeof x !== 'object') continue;
    const titel = text(x.title, 2000).replace(/\s+/g, ' ');
    if (!titel) continue;
    const liste = text(x.list, 200).replace(/\s+/g, ' ') || LISTE_OHNE_NAME;
    const uid = text(x.uid, 300);
    const schluesselAlt = `${liste}\n${titel}`;
    const n = (vorkommen.get(schluesselAlt) ?? 0) + 1;
    vorkommen.set(schluesselAlt, n);
    const alt = kennungAus(`alt:${schluesselAlt}\n${n}`);
    const kennung = uid ? kennungAus(`uid:${uid}`) : alt;
    if (gesehen.has(kennung)) continue;
    gesehen.add(kennung);
    const notiz = text(x.notes);
    raus.push({
      kennung, kennungen: uid ? [kennung, alt] : [alt], liste, titel,
      ...faelligkeitAus(x.due, wand),
      ...(notiz ? { notiz } : {}),
      erledigt: x.completed === true || x.completed === 'true',
      prioritaet: prioritaetAus(x.priority),
    });
  }
  return raus;
}

// ── Mac-Seite: eine Zeile des AppleScripts (app/api/apple-reminders/route.ts) → Eintrag des Spiegels ──
/** Feldtrenner (US, 31) und Satztrenner (RS, 30) des Skripts — Notizen dürfen Zeilenumbrüche haben. */
export const SKRIPT_FELD = '\u001f';
export const SKRIPT_SATZ = '\u001e';
export interface SpiegelEintrag { id: string; uid?: string; list: string; title: string; due?: string; notes?: string; completed: boolean; priority: number; source: 'apple-reminders' }

/** Felder: Liste · Titel · Fälligkeit („JJJJ-MM-TTTHH:MM“, Wandzeit des Macs) · Priorität · Apple-Kennung · Notiz · erledigt. */
export function skriptZeileLesen(zeile: string, idx: number): SpiegelEintrag | null {
  const [list, title, due, prio, uid, notes, erl] = zeile.split(SKRIPT_FELD);
  if (!title?.trim()) return null;
  const d = (due ?? '').trim();
  const u = (uid ?? '').trim();
  const n = (notes ?? '').trim();
  return {
    id: `reminder-${idx}`,
    ...(u && u !== 'missing value' ? { uid: u } : {}),
    list: (list ?? '').trim(),
    title: title.trim(),
    ...(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d) ? { due: d } : {}),
    ...(n && n !== 'missing value' ? { notes: n } : {}),
    completed: (erl ?? '').trim() === 'true',
    priority: Number((prio ?? '0').trim()) || 0,
    source: 'apple-reminders',
  };
}

/** Ist sie schon als Aufgabe da (unter einer ihrer Kennungen — auch im Papierkorb oder Archiv)? */
export const schonUebernommen = (e: Pick<Erinnerung, 'kennungen'>, vorhanden: ReadonlySet<string>): boolean => e.kennungen.some(k => vorhanden.has(k));

// ── Auswahl (Körper der Bestätigung) ─────────────────────────────────────────

export interface UebernahmeWahl {
  /** Apple-Liste → Space-Kennung (fehlt = `SPACE_VORGABE`). */
  spaces: Record<string, string>;
  /** Erledigte Erinnerungen mitnehmen (als erledigte Aufgaben)? Vorgabe: nein. */
  erledigte: boolean;
  /** Im Space Privat „nur ich“ setzen? Vorgabe: ja. */
  nurIchPrivat: boolean;
  /** Kennungen, die NICHT übernommen werden sollen (abgewählt in der Vorschau). */
  ohne: string[];
}
export const WAHL_VORGABE: UebernahmeWahl = { spaces: {}, erledigte: false, nurIchPrivat: true, ohne: [] };

export type WahlErgebnis = { ok: true; wahl: UebernahmeWahl } | { ok: false; status: 400 | 413; fehler: string };

/** Auswahl aus dem Körper prüfen — Spaces nur aus `erlaubt`, Kennungen nur `ar-…`. Über den Grenzen 413, nie gekürzt. */
export function wahlSauber(roh: unknown, erlaubt: readonly string[]): WahlErgebnis {
  if (roh === undefined || roh === null) return { ok: true, wahl: { ...WAHL_VORGABE } };
  if (typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, status: 400, fehler: 'Auswahl: Objekt erwartet. Nichts übernommen.' };
  const r = roh as Record<string, unknown>;
  const spaces: Record<string, string> = {};
  if (r.spaces !== undefined) {
    if (!r.spaces || typeof r.spaces !== 'object' || Array.isArray(r.spaces)) return { ok: false, status: 400, fehler: 'Auswahl: „spaces“ muss Liste → Space sein. Nichts übernommen.' };
    const paare = Object.entries(r.spaces as Record<string, unknown>);
    if (paare.length > WAHL_GRENZEN.listen) return { ok: false, status: 413, fehler: `Abgelehnt: höchstens ${WAHL_GRENZEN.listen} Listen. Nichts übernommen.` };
    for (const [liste, space] of paare) {
      if (!liste || liste.length > WAHL_GRENZEN.listenName) return { ok: false, status: 400, fehler: 'Auswahl: unbekannter Listenname. Nichts übernommen.' };
      if (typeof space !== 'string' || !erlaubt.includes(space)) return { ok: false, status: 400, fehler: 'Auswahl: diesen Space gibt es nicht. Nichts übernommen.' };
      spaces[liste] = space;
    }
  }
  let ohne: string[] = [];
  if (r.ohne !== undefined) {
    if (!Array.isArray(r.ohne)) return { ok: false, status: 400, fehler: 'Auswahl: „ohne“ muss eine Liste sein. Nichts übernommen.' };
    if (r.ohne.length > WAHL_GRENZEN.ohne) return { ok: false, status: 413, fehler: `Abgelehnt: höchstens ${WAHL_GRENZEN.ohne} abgewählte Erinnerungen. Nichts übernommen.` };
    if (!r.ohne.every(istUebernahmeKennung)) return { ok: false, status: 400, fehler: 'Auswahl: unbekannte Kennung. Nichts übernommen.' };
    ohne = Array.from(new Set(r.ohne as string[]));
  }
  for (const k of ['erledigte', 'nurIchPrivat'] as const) {
    if (r[k] !== undefined && typeof r[k] !== 'boolean') return { ok: false, status: 400, fehler: `Auswahl: „${k}“ ist ja oder nein. Nichts übernommen.` };
  }
  return { ok: true, wahl: { spaces, ohne, erledigte: r.erledigte === true, nurIchPrivat: r.nurIchPrivat !== false } };
}

export const spaceFuer = (liste: string, wahl: Pick<UebernahmeWahl, 'spaces'>): string => wahl.spaces[liste] ?? SPACE_VORGABE;

// ── Vorschau ─────────────────────────────────────────────────────────────────

export interface VorschauZeile {
  kennung: string; titel: string; liste: string; tag?: string; zeit?: string; erledigt: boolean;
  /** Hat sie eine Notiz (der Text selbst geht erst beim Übernehmen in die Aufgabe)? */
  notiz: boolean;
  /** Schon als Aufgabe da (auch im Papierkorb/Archiv) — wird nicht noch einmal angelegt. */
  schon: boolean;
}
export interface VorschauListe { name: string; anzahl: number; offen: number; erledigt: number; schon: number; space: string }
export interface Vorschau {
  zeilen: VorschauZeile[];
  listen: VorschauListe[];
  zaehler: { gesamt: number; offen: number; erledigt: number; schon: number; neuOffen: number; neuErledigt: number };
}

export function vorschauBauen(liste: readonly Erinnerung[], vorhanden: ReadonlySet<string>, wahl: Pick<UebernahmeWahl, 'spaces'> = WAHL_VORGABE): Vorschau {
  const zeilen: VorschauZeile[] = liste.map(e => ({
    kennung: e.kennung, titel: e.titel, liste: e.liste, ...(e.tag ? { tag: e.tag } : {}), ...(e.zeit ? { zeit: e.zeit } : {}),
    erledigt: e.erledigt, notiz: !!e.notiz, schon: schonUebernommen(e, vorhanden),
  }));
  const listen = new Map<string, VorschauListe>();
  for (const z of zeilen) {
    const l = listen.get(z.liste) ?? { name: z.liste, anzahl: 0, offen: 0, erledigt: 0, schon: 0, space: spaceFuer(z.liste, wahl) };
    l.anzahl++;
    if (z.erledigt) l.erledigt++; else l.offen++;
    if (z.schon) l.schon++;
    listen.set(z.liste, l);
  }
  const neu = zeilen.filter(z => !z.schon);
  return {
    zeilen: [...zeilen].sort((a, b) => Number(a.erledigt) - Number(b.erledigt) || a.liste.localeCompare(b.liste, 'de') || (a.tag ?? '9999').localeCompare(b.tag ?? '9999') || a.titel.localeCompare(b.titel, 'de')),
    listen: Array.from(listen.values()).sort((a, b) => a.name.localeCompare(b.name, 'de')),
    zaehler: {
      gesamt: zeilen.length, offen: zeilen.filter(z => !z.erledigt).length, erledigt: zeilen.filter(z => z.erledigt).length,
      schon: zeilen.length - neu.length, neuOffen: neu.filter(z => !z.erledigt).length, neuErledigt: neu.filter(z => z.erledigt).length,
    },
  };
}

// ── Aufgaben bauen ───────────────────────────────────────────────────────────

/** Welche Erinnerungen diese Bestätigung anlegt: nicht schon da, nicht abgewählt, erledigte nur auf Wunsch. */
export function zuUebernehmen(liste: readonly Erinnerung[], vorhanden: ReadonlySet<string>, wahl: UebernahmeWahl): Erinnerung[] {
  const ohne = new Set(wahl.ohne);
  return liste.filter(e => !schonUebernommen(e, vorhanden) && !ohne.has(e.kennung) && (wahl.erledigte || !e.erledigt));
}

export class NotizZuLang extends Error { readonly status = 413; constructor(titel: string) { super(`Abgelehnt: die Notiz der Erinnerung „${titel.slice(0, 60)}“ ist länger als ${NOTIZ_MAX.toLocaleString('de-DE')} Zeichen. Nichts übernommen.`); } }

/**
 * Die neuen Aufgaben (roh — der Schreibweg säubert sie). Ein Titel über 300 Zeichen wird gekürzt, der volle Titel steht dann
 * oben in der Notiz (nichts geht verloren). Wirft `NotizZuLang`, statt eine Notiz zu kürzen.
 */
export function aufgabenBauen(liste: readonly Erinnerung[], wahl: UebernahmeWahl, o: { inhaber: string; jetzt: string }): Record<string, unknown>[] {
  return liste.map((e, i) => {
    const space = spaceFuer(e.liste, wahl);
    const lang = e.titel.length > TITEL_MAX;
    const notiz = [lang ? `Voller Titel: ${e.titel}` : '', e.notiz ?? ''].filter(Boolean).join('\n\n');
    if (notiz.length > NOTIZ_MAX) throw new NotizZuLang(e.titel);
    return {
      id: e.kennung,
      title: lang ? `${e.titel.slice(0, TITEL_MAX - 1).trimEnd()}…` : e.titel,
      description: `Übernommen aus Apple Erinnerungen · Liste „${e.liste}“`,
      ...(notiz ? { notiz } : {}),
      status: e.erledigt ? 'done' : 'todo',
      priority: e.prioritaet,
      assignee: o.inhaber,
      tags: [UEBERNAHME_TAG],
      subTasks: [], dependencies: [], sortOrder: i, createdAt: o.jetzt, updatedAt: o.jetzt,
      spaceId: space,
      ...(space === 'privat' && wahl.nurIchPrivat ? { sichtbarkeit: 'nur-ich' } : {}),
      ...(e.tag ? { dueDate: e.tag } : {}),
      ...(e.tag && e.zeit ? { dueTime: e.zeit } : {}),
    };
  });
}
