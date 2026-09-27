// ─── Markttraktion · Wahl-Chip: reine Hilfen (27.09., Kevin: „smarter wählen“) ──
// Das Bauteil components/os/crm/Wahl.tsx zeigt nur den gesetzten Wert als Chip
// und öffnet auf Klick ein Menü. Alles, was sich ohne Oberfläche rechnen lässt,
// steht hier und ist getestet (tests/crm-wahl.test.ts): Filtern mit Suche,
// Tastatur-Index, Startpunkt im Menü, Lage des Menüs im Fenster.

import { KERN_EINHEITEN } from '@/lib/einheiten';
import type { Gesellschaft } from './typen';

/** Ein Wert in einer Wahl. `hinweis` steht leise hinter dem Namen (z. B. „30 T“ beim Kreis). */
export interface WahlEintrag<T extends string> { id: T; label: string; hinweis?: string }
/** Ein Vorschlag aus den Daten — wird nie still gespeichert, immer ein Klick. `grund` im Klartext. */
export interface WahlVorschlag<T extends string> { id: T; grund: string }

/** Ab so vielen Werten bekommt das Menü ein Suchfeld. */
export const SUCHE_AB_WAHL = 8;
/** Bis zu dieser Fensterbreite öffnet das Menü als Blatt von unten (Handy). */
export const ALS_BLATT_BIS = 560;

/** Vergleichsform: klein, Umlaute ausgeschrieben, ohne Akzente — „Geschäftsführung“ findet man mit „geschaeft“. */
export function normiere(s: string): string {
  return s.toLocaleLowerCase('de-DE')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}

/** Werte, die zur Suche passen (Name oder Hinweis) — Reihenfolge bleibt. Leere Suche: alle. */
export function wahlFiltern<T extends string>(liste: readonly WahlEintrag<T>[], suche: string): WahlEintrag<T>[] {
  const s = normiere(suche);
  if (!s) return [...liste];
  return liste.filter(e => normiere(e.label).includes(s) || (e.hinweis ? normiere(e.hinweis).includes(s) : false));
}

export type WahlTaste = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End' | 'PageDown' | 'PageUp';
export const istWahlTaste = (k: string): k is WahlTaste => k === 'ArrowDown' || k === 'ArrowUp' || k === 'Home' || k === 'End' || k === 'PageDown' || k === 'PageUp';

/**
 * Nächster aktiver Eintrag im Menü. Pfeile laufen rund (vom letzten zum
 * ersten), Seitentasten springen fünf weiter und bleiben am Rand stehen.
 * Ohne Einträge: -1. Ist noch nichts aktiv (-1), führt ↓ zum ersten und ↑ zum letzten.
 */
export function naechsterIndex(aktuell: number, anzahl: number, taste: WahlTaste): number {
  if (anzahl <= 0) return -1;
  const letzter = anzahl - 1;
  switch (taste) {
    case 'Home': return 0;
    case 'End': return letzter;
    case 'ArrowDown': return aktuell < 0 || aktuell >= letzter ? 0 : aktuell + 1;
    case 'ArrowUp': return aktuell <= 0 ? letzter : aktuell - 1;
    case 'PageDown': return Math.min(letzter, Math.max(0, aktuell) + 5);
    case 'PageUp': return Math.max(0, aktuell - 5);
  }
}

/** Wo das Menü beim Öffnen steht: auf dem gesetzten Wert, sonst auf dem Vorschlag, sonst oben. */
export function startIndex<T extends string>(liste: readonly { id: T }[], wert?: readonly T[] | T | null, vorschlag?: T | null): number {
  const gesetzt = Array.isArray(wert) ? (wert as readonly T[])[0] : (wert as T | null | undefined);
  const i = gesetzt != null ? liste.findIndex(e => e.id === gesetzt) : -1;
  if (i >= 0) return i;
  const v = vorschlag != null ? liste.findIndex(e => e.id === vorschlag) : -1;
  if (v >= 0) return v;
  return liste.length ? 0 : -1;
}

/** Name zu einer Kennung — Unbekanntes (Bestandswert außerhalb der Liste) erscheint unverändert. */
export function wahlLabel<T extends string>(liste: readonly WahlEintrag<T>[], id: T | null | undefined): string | undefined {
  if (id == null || id === '') return undefined;
  return liste.find(e => e.id === id)?.label ?? String(id);
}

export interface Rechteck { top: number; left: number; bottom: number; right: number; width: number }
export interface Lage { top: number; left: number; nachOben: boolean; maxHoehe: number }

/**
 * Lage des Menüs am Chip, immer im Fenster: unter dem Chip, wenn es dort
 * passt, sonst darüber (wo mehr Platz ist); links bündig mit dem Chip, aber nie
 * über den rechten oder linken Rand. `maxHoehe` begrenzt die Liste auf den
 * Platz, der auf der gewählten Seite bleibt.
 */
export function menuLage(anker: Rechteck, menu: { breite: number; hoehe: number }, fenster: { breite: number; hoehe: number }, abstand = 6, rand = 8): Lage {
  const untenPlatz = fenster.hoehe - anker.bottom - abstand - rand;
  const obenPlatz = anker.top - abstand - rand;
  const nachOben = menu.hoehe > untenPlatz && obenPlatz > untenPlatz;
  const maxHoehe = Math.max(120, nachOben ? obenPlatz : untenPlatz);
  const hoehe = Math.min(menu.hoehe, maxHoehe);
  const top = nachOben ? Math.max(rand, anker.top - abstand - hoehe) : anker.bottom + abstand;
  const breite = Math.min(menu.breite, fenster.breite - 2 * rand);
  const left = Math.min(Math.max(rand, anker.left), Math.max(rand, fenster.breite - rand - breite));
  return { top: Math.round(top), left: Math.round(left), nachOben, maxHoehe: Math.round(maxHoehe) };
}

/** Gesellschaften für Deals und Mandate — Namen aus der einen Quelle (lib/einheiten.ts), dazu „offen“. Gespeichert bleibt die Kennung. */
export const GESELLSCHAFT_WAHL: readonly WahlEintrag<Gesellschaft>[] = [
  ...KERN_EINHEITEN.map(e => ({ id: e.id as Gesellschaft, label: e.label })),
  { id: 'offen', label: 'offen' },
];
