// ─── Kalender — Termin-Arten, Farben, Sichtbarkeit, Arbeitsorte (rein, 29.09., K1) ──
// Kevin 29.09. (Vorbild Google Kalender): beim Anlegen Reiter „Termin · Aufgabe ·
// Abwesend · Fokuszeit · Arbeitsort“, Farbe je Termin, frei/beschäftigt, privat,
// Erinnerungen. Hier nur die Bedeutung der Werte — client- und serversicher, ohne
// ical.js. Wie die Werte im iCalendar-Text stehen: lib/kalender/ics.ts (X-MAKE-ART,
// COLOR, TRANSP, CLASS); Bezüge zu MAKE OS nur im Neben-Bestand: lib/kalender/bezug.ts.
//
//   termin      normaler Termin (iCloud)
//   aufgabe     KEIN iCloud-Termin: dieselbe Aufgabe im Aufgaben-Modell (Deadline + dueTime),
//               der Kalender zeigt sie nur an ihrer Zeit
//   abwesend    beschäftigt, zählt als „nicht verfügbar“ (lib/kalender/belegung.ts)
//   fokus       beschäftigt, startet auf Klick die Fokus-Zeitmessung (lib/zeitmessung)
//   arbeitsort  ganztägig, frei, als Leiste über den Tagen — je Person
//   block       (K5, 29.09.) geplante eigene Zeit aus dem Modus „Planen“ (früher Wochenplan-Block): beschäftigt,
//               Unterart als X-MAKE-BLOCK (reha · routine · pause · aufgabe; ohne = „Block“), eine eingeplante
//               Aufgabe hängt über `kalender-bezug.aufgabeId` daran. Fokus-Blöcke sind Art „fokus“.
//               Nicht im „Erstellen“-Menü (TERMIN_ARTEN) — Blöcke entstehen im Modus „Planen“.

export type TerminArt = 'termin' | 'aufgabe' | 'abwesend' | 'fokus' | 'arbeitsort' | 'block';
/** Die Arten, die als iCloud-Termin gespeichert werden (Aufgabe lebt im Aufgaben-Modell). */
export type IcsArt = Exclude<TerminArt, 'aufgabe'>;
export const TERMIN_ARTEN: readonly TerminArt[] = ['termin', 'aufgabe', 'abwesend', 'fokus', 'arbeitsort'];
export const ICS_ARTEN: readonly IcsArt[] = ['termin', 'abwesend', 'fokus', 'arbeitsort', 'block'];
export const istIcsArt = (v: unknown): v is IcsArt => typeof v === 'string' && (ICS_ARTEN as readonly string[]).includes(v);
export const istTerminArt = (v: unknown): v is TerminArt => typeof v === 'string' && (TERMIN_ARTEN as readonly string[]).includes(v);

export interface ArtInfo {
  label: string;
  /** Standard „beschäftigt“ (TRANSP:OPAQUE) — Abwesend und Fokus immer, Arbeitsort nie. */
  beschaeftigt: boolean;
  /** Standard ganztägig beim Anlegen. */
  ganztags: boolean;
  /** Eigene Farbe der Art (Hex) — nur Anzeige, wenn der Termin keine eigene hat. */
  farbe?: string;
}
export const ART_INFO: Record<TerminArt, ArtInfo> = {
  termin: { label: 'Termin', beschaeftigt: true, ganztags: false },
  aufgabe: { label: 'Aufgabe', beschaeftigt: false, ganztags: false, farbe: '#4A6CF7' },
  abwesend: { label: 'Abwesend', beschaeftigt: true, ganztags: true, farbe: '#FF5C5C' },
  fokus: { label: 'Fokuszeit', beschaeftigt: true, ganztags: false, farbe: '#21B5AA' },
  arbeitsort: { label: 'Arbeitsort', beschaeftigt: false, ganztags: true, farbe: '#96A8A2' },
  block: { label: 'Block', beschaeftigt: true, ganztags: false, farbe: '#AC9D80' },
};

// ── Unterart eines Blocks (X-MAKE-BLOCK, K5) ────────────────────────────────
/** Unterart eines Blocks — so heißen die Bausteine des Planens (types/planer.ts PLAN_ARTEN ohne fokus/block). */
export type BlockArt = 'reha' | 'routine' | 'pause' | 'aufgabe';
export const BLOCK_ARTEN: readonly BlockArt[] = ['reha', 'routine', 'pause', 'aufgabe'];
export const istBlockArt = (v: unknown): v is BlockArt => typeof v === 'string' && (BLOCK_ARTEN as readonly string[]).includes(v);

/**
 * Standard für frei/beschäftigt, wenn der Termin selbst nichts sagt (kein TRANSP): Abwesend/Fokus beschäftigt,
 * Arbeitsort frei, sonst wie Google und Apple — ganztägig frei, mit Uhrzeit beschäftigt.
 */
export function beschaeftigtStandard(art: IcsArt, ganztags: boolean): boolean {
  if (art === 'abwesend' || art === 'fokus') return true;
  if (art === 'arbeitsort') return false;
  return !ganztags;
}

// ── Sichtbarkeit (CLASS) ────────────────────────────────────────────────────
/** standard = kein CLASS, oeffentlich = CLASS:PUBLIC, privat = CLASS:PRIVATE (CONFIDENTIAL wird als privat gelesen). */
export type Sichtbarkeit = 'standard' | 'oeffentlich' | 'privat';
export const SICHTBARKEITEN: readonly Sichtbarkeit[] = ['standard', 'oeffentlich', 'privat'];
export const istSichtbarkeit = (v: unknown): v is Sichtbarkeit => typeof v === 'string' && (SICHTBARKEITEN as readonly string[]).includes(v);
export const SICHTBARKEIT_LABEL: Record<Sichtbarkeit, string> = { standard: 'Standard-Sichtbarkeit', oeffentlich: 'Öffentlich', privat: 'Privat' };

// ── Farben je Termin (COLOR, RFC 7986) ──────────────────────────────────────
// RFC 7986 verlangt einen CSS3-Farbnamen. Die Kennung IST der Name; angezeigt wird der Hex-Wert (die
// Oberfläche hängt Alpha an „#RRGGBB“ an). Fremde Clients schreiben manchmal Hex — das lesen wir auch.
export interface TerminFarbe { id: string; label: string; hex: string }
export const TERMIN_FARBEN: readonly TerminFarbe[] = [
  { id: 'tomato', label: 'Tomate', hex: '#E5534B' },
  { id: 'hotpink', label: 'Flamingo', hex: '#FF7EB6' },
  { id: 'darkorange', label: 'Mandarine', hex: '#FF9F43' },
  { id: 'gold', label: 'Banane', hex: '#FFC93C' },
  { id: 'mediumseagreen', label: 'Salbei', hex: '#3DBE8B' },
  { id: 'forestgreen', label: 'Basilikum', hex: '#2E9E5B' },
  { id: 'deepskyblue', label: 'Pfau', hex: '#4FC3F7' },
  { id: 'royalblue', label: 'Heidelbeere', hex: '#4A6CF7' },
  { id: 'mediumpurple', label: 'Lavendel', hex: '#8F86FF' },
  { id: 'darkorchid', label: 'Traube', hex: '#C77DFF' },
  { id: 'gray', label: 'Graphit', hex: '#8A9490' },
];
const HEX = /^#[0-9a-f]{6}$/i;

/** Ein COLOR-Wert (Name aus der Palette oder Hex) → gesäuberte Kennung, sonst undefined (dann gilt die Kalenderfarbe). */
export function farbeSauber(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase();
  if (TERMIN_FARBEN.some(f => f.id === s)) return s;
  return HEX.test(s) ? s : undefined;
}
/** Anzeigefarbe (#RRGGBB) einer gespeicherten Farbe. */
export function farbeHex(v: string | undefined): string | undefined {
  const s = farbeSauber(v);
  if (!s) return undefined;
  return TERMIN_FARBEN.find(f => f.id === s)?.hex ?? s;
}

// ── Arbeitsort ──────────────────────────────────────────────────────────────
export type ArbeitsortArt = 'home' | 'buero' | 'unterwegs' | 'kunde' | 'frei';
export interface Arbeitsort { art: ArbeitsortArt; /** Nur bei „frei“: eigener Text (wird der Titel). */ text?: string }
export const ARBEITSORTE: readonly { id: ArbeitsortArt; label: string; zeichen: string }[] = [
  { id: 'home', label: 'Home', zeichen: '⌂' },
  { id: 'buero', label: 'Büro', zeichen: '▣' },
  { id: 'unterwegs', label: 'Unterwegs', zeichen: '➜' },
  { id: 'kunde', label: 'Beim Kunden', zeichen: '◆' },
  { id: 'frei', label: 'Anderer Ort', zeichen: '•' },
];
export function arbeitsortSauber(v: unknown): Arbeitsort | undefined {
  const o = v && typeof v === 'object' ? v as Record<string, unknown> : typeof v === 'string' ? { art: v } : null;
  if (!o) return undefined;
  const art = ARBEITSORTE.find(a => a.id === o.art)?.id;
  if (!art) return undefined;
  const text = typeof o.text === 'string' ? o.text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 60) : '';
  return art === 'frei' && text ? { art, text } : { art };
}
/** Titel eines Arbeitsorts („Home“, „Büro“ … oder der eigene Text) — so steht er im Termin (SUMMARY). */
export const arbeitsortTitel = (a: Arbeitsort): string => (a.art === 'frei' && a.text ? a.text : ARBEITSORTE.find(x => x.id === a.art)?.label ?? 'Arbeitsort');
/** Der Arbeitsort aus dem Titel eines Arbeitsort-Termins (Umkehrung von `arbeitsortTitel`; Fremdes = eigener Text). */
export function arbeitsortAusTitel(titel: string): Arbeitsort {
  const t = titel.trim();
  const fest = ARBEITSORTE.find(a => a.id !== 'frei' && a.label.toLowerCase() === t.toLowerCase());
  return fest ? { art: fest.id } : { art: 'frei', ...(t ? { text: t.slice(0, 60) } : {}) };
}

// ── Erinnerungen ────────────────────────────────────────────────────────────
export const ERINNERUNG_VORLAGEN: readonly number[] = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080];
export const ERINNERUNG_MAX = 5;
/** „10 Minuten vorher“, „1 Tag vorher“, „pünktlich“. */
export function erinnerungText(min: number): string {
  if (min <= 0) return 'Zu Beginn';
  if (min % 10080 === 0) return `${min / 10080} ${min === 10080 ? 'Woche' : 'Wochen'} vorher`;
  if (min % 1440 === 0) return `${min / 1440} ${min === 1440 ? 'Tag' : 'Tage'} vorher`;
  if (min % 60 === 0) return `${min / 60} ${min === 60 ? 'Stunde' : 'Stunden'} vorher`;
  return `${min} Minuten vorher`;
}
/** Minuten vor Beginn säubern: 0 … 4 Wochen, doppelte raus, höchstens ERINNERUNG_MAX, aufsteigend. */
export function erinnerungenSauber(v: unknown): number[] {
  const roh = Array.isArray(v) ? v : typeof v === 'number' ? [v] : [];
  const raus = Array.from(new Set(roh.map(Number).filter(n => Number.isFinite(n) && n >= 0 && n <= 4 * 10080).map(n => Math.round(n))));
  return raus.sort((a, b) => a - b).slice(0, ERINNERUNG_MAX);
}
