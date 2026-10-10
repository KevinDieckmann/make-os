// ─── Fulfillment · Prozesse — gemeinsame Prüf-Werkzeuge der reinen Schreibregeln (C1, 10.10.) ──────────────────────────────────────
// Die reinen `…Anwenden`-Funktionen (Vorlagen, Fall, Import) lehnen über `nein(...)` ab: eine Ausnahme mit Status (400 Unsinn, 403 Recht,
// 404 unbekannt, 409 Stand/Regel, 413 Grenze), die der Aufrufer in ein `AnwendenErgebnis` übersetzt — alles oder nichts, nie gekürzt.
// Rein und client-sicher.

import { textZuLang, type TextFeld } from '../grenzen';
import type { AnwendenErgebnis } from '../typen';

export type AblehnStatus = 400 | 403 | 404 | 409 | 413;
export class Abgelehnt extends Error {
  constructor(public status: AblehnStatus, msg: string, public konflikte?: { id: string; stand: string }[]) { super(msg); }
}
export const nein = (msg: string, status: AblehnStatus = 400, konflikte?: { id: string; stand: string }[]): never => { throw new Abgelehnt(status, msg, konflikte); };

/** Eine reine Änderung ausführen: Ausnahmen `Abgelehnt` werden zum abgelehnten Ergebnis, alles andere fliegt weiter. */
export function ausfuehren<D>(f: () => { datei: D; geaendert: string[] }): AnwendenErgebnis<D> {
  try {
    const r = f();
    return { ok: true, datei: r.datei, geaendert: r.geaendert };
  } catch (e) {
    if (e instanceof Abgelehnt) return { ok: false, status: e.status, fehler: e.message, ...(e.konflikte ? { konflikte: e.konflikte } : {}) };
    throw e;
  }
}

type O = Record<string, unknown>;
export const istObj = (v: unknown): v is O => !!v && typeof v === 'object' && !Array.isArray(v);

/** Pflicht-Text (getrimmt, nicht leer, nicht zu lang) — sonst 400/413 mit dem Namen des Felds. */
export function pflichtText(v: unknown, feld: TextFeld, name: string): string {
  if (typeof v !== 'string' || !v.trim()) return nein(`${name} fehlt.`);
  const t = v.trim();
  const zu = textZuLang(feld, t, name);
  return zu ? nein(zu, 413) : t;
}
/** Optionaler Text: undefined bleibt undefined, `null`/'' heißt „entfernen“ (→ null), sonst geprüft wie Pflicht. */
export function optText(v: unknown, feld: TextFeld, name: string): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || (typeof v === 'string' && !v.trim())) return null;
  if (typeof v !== 'string') return nein(`${name}: Text erwartet.`);
  const t = v.trim();
  const zu = textZuLang(feld, t, name);
  return zu ? nein(zu, 413) : t;
}
/** Optionaler Wahlwert aus einer festen Liste. */
export function optWahl<T extends string>(v: unknown, liste: readonly T[], name: string): T | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return typeof v === 'string' && (liste as readonly string[]).includes(v) ? (v as T) : nein(`${name}: unbekannter Wert.`);
}
/** Optionale Zahl in einer Spanne. */
export function optZahl(v: unknown, min: number, max: number, name: string): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : nein(`${name}: ${min.toLocaleString('de-DE')} bis ${max.toLocaleString('de-DE')}.`);
}
/** Optionaler Tag (YYYY-MM-DD, echter Kalendertag). */
export function optTag(v: unknown, name: string): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return nein(`${name}: Datum im Format JJJJ-MM-TT.`);
  const [j, m, t] = v.split('-').map(Number);
  const d = new Date(Date.UTC(j, m - 1, t));
  return d.getUTCFullYear() === j && d.getUTCMonth() === m - 1 && d.getUTCDate() === t ? v : nein(`${name}: kein gültiger Tag.`);
}
export const optBool = (v: unknown, name: string): boolean | null | undefined =>
  v === undefined ? undefined : v === null ? null : typeof v === 'boolean' ? v : nein(`${name}: ja oder nein.`);

/** Liste kurzer Texte (Gliederung, Agenda, Platzhalter, Tags) — jeder Punkt geprüft, Anzahl begrenzt (413), nie gekürzt. */
export function textListe(v: unknown, feld: TextFeld, name: string, max: number): string[] | undefined {
  if (v === undefined) return undefined;
  if (v === null) return [];
  if (!Array.isArray(v)) return nein(`${name}: Liste erwartet.`);
  if (v.length > max) return nein(`${name}: höchstens ${max} Punkte (jetzt ${v.length}). Nichts gespeichert.`, 413);
  return v.map((x, i) => pflichtText(x, feld, `${name} (Punkt ${i + 1})`));
}

/** Felder eines Teil-Eintrags auf den alten legen: `null` entfernt ein optionales Feld, `undefined` lässt es, wie es ist. */
export function mischen<T extends object>(alt: T | undefined, teil: Record<string, unknown>): T {
  const raus: O = { ...(alt ?? {}) } as O;
  for (const [k, v] of Object.entries(teil)) { if (v === null) delete raus[k]; else if (v !== undefined) raus[k] = v; }
  return raus as T;
}

/** Stand prüfen: fehlt er, gilt die Änderung (Server-Wege); passt er nicht, 409 mit dem aktuellen Stand. */
export function standPruefen(stand: unknown, aktuell: string, id: string): void {
  if (stand === undefined || stand === null || stand === '') return;
  if (stand !== aktuell) nein('Inzwischen hat jemand anders geändert — bitte neu laden. Nichts gespeichert.', 409, [{ id, stand: aktuell }]);
}

/** Kleiner, stabiler Fingerabdruck (FNV-1a 2×32 Bit, hex) — für feste Kennungen aus Daten (Import), nie für Geheimnisse. */
export function fnv(s: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0; h2 = Math.imul(h2 ^ s.charCodeAt(i), 2246822519) >>> 0; }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

/** Text → Kennungs-Teil: klein, Umlaute ausgeschrieben, nur a–z/0–9/Bindestrich, höchstens `max` Zeichen. */
export function slug(t: string, max = 60): string {
  const s = t.normalize('NFC').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s.slice(0, max).replace(/-+$/g, '') || 'x';
}

/** Vergleichsform eines Titels (ohne Groß-/Kleinschreibung, Umlaute gefaltet, Satzzeichen zu Leerzeichen). */
export const titelForm = (t: string): string => slug(t, 200).replace(/-/g, ' ');
