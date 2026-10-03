// ─── Lichtfäden v2 — das Modell (03.10.2026, rein, client-sicher) ───────────
// Kevin (03.10.): „Das ist ein Werkzeug, was nachher Fokus anzeigt, weil extrem viele Stränge zusammenlaufen in der
// Planung … Alles läuft immer auf das größte Ziel zusammen. Business und Privat laufen zusammen in einem großen Strang.
// Dann in Privat alle Themen wie Gesundheit, Planung, Finanzen, Beziehung, und jeweils in den Themen gibt es wieder
// extrem viele Stränge.“
//
// Zwei Begriffe, sonst nichts:
//   · STRANG — EIN Ding, das Zeit oder Aufmerksamkeit bindet (Aufgabe, Meilenstein, Termin, Follow-up, Zahlung, Frist …),
//     mit Zeitpunkt (oder Spanne), Gewicht, Status, Person und einem PFAD von oben nach unten durch den Baum.
//   · KNOTEN — eine Ebene im Baum: gesamt → space → thema → ziel → meilenstein. Name und Farbe stehen hier, nicht am Strang.
// Der Baum (baum.ts) sammelt die Stränge an ihren Knoten; die Dichte eines Knotens ist die Summe seiner Kinder.
// Neue Quelle anschließen: LICHTFAEDEN.md › „Eine neue Quelle anschließen“ (Adapter in quellen/, Zeile in QUELLEN unten).

import { FADEN_FARBEN, LEUCHT } from '@/lib/make-one/design';
import type { SpaceId } from '@/lib/make-one/space-regeln';

// ── Knoten ───────────────────────────────────────────────────────────────────

export type KnotenArt = 'gesamt' | 'space' | 'thema' | 'ziel' | 'meilenstein';
export interface Knoten {
  /** Kennung — siehe `knotenId` (z. B. „gesamt“, „space:privat“, „thema:privat:gesundheit“, „ziel:z-1“, „ms:m-4“). */
  id: string;
  art: KnotenArt;
  name: string;
  /** #RRGGBB */
  farbe: string;
  /** Kennung des Elternknotens (fehlt nur an der Wurzel „gesamt“). */
  eltern?: string;
  /** Reihenfolge unter Geschwistern (klein = zuerst). */
  rang: number;
  /** Ziel/Meilenstein: wohin ein Klick auf den Namen führt (Detailseite). */
  link?: string;
}

export const GESAMT = 'gesamt';
export const knotenId = {
  space: (s: SpaceId) => `space:${s}`,
  thema: (s: SpaceId, t: ThemaId) => `thema:${s}:${t}`,
  ziel: (id: string) => `ziel:${id}`,
  meilenstein: (id: string) => `ms:${id}`,
} as const;

/** Die Themen je Space — Kevins Gliederung („Gesundheit, Planung, Finanzen, Beziehung“), neutral (keine Namen, keine Firmen). */
export type ThemaId = 'planung' | 'gesundheit' | 'beziehung' | 'finanzen' | 'markttraktion' | 'mandate';
export interface ThemaDef { id: ThemaId; name: string; farbe: string }
export const THEMEN: Record<SpaceId, readonly ThemaDef[]> = {
  privat: [
    { id: 'planung', name: 'Ziele & Planung', farbe: LEUCHT.planung },
    { id: 'gesundheit', name: 'Gesundheit', farbe: LEUCHT.gut },
    { id: 'beziehung', name: 'Familie & Beziehung', farbe: LEUCHT.beziehung },
    { id: 'finanzen', name: 'Finanzen', farbe: '#DE9E63' },
  ],
  business: [
    { id: 'planung', name: 'Ziele & Planung', farbe: LEUCHT.planung },
    { id: 'markttraktion', name: 'Markttraktion', farbe: LEUCHT.business },
    { id: 'mandate', name: 'Mandate', farbe: LEUCHT.agenten },
    { id: 'finanzen', name: 'Finanzen', farbe: '#DE9E63' },
  ],
};
export const SPACE_NAME: Record<SpaceId, string> = { privat: 'Privat', business: 'Business' };
/** Leuchtfarbe je Space — dieselbe wie das erste Ziel-Bündel des Space (Business gelb, Privat grün, wie v1). */
export const SPACE_FADEN: Record<SpaceId, string> = { privat: FADEN_FARBEN.privat[0], business: FADEN_FARBEN.business[0] };
/** Bündel der Stränge, die direkt am Wurzelknoten hängen („ohne Ziel“) — Zeit-Cyan wie v1. */
export const OHNE_FARBE = FADEN_FARBEN.ohne;
/** Anonyme „belegt“-Stränge der anderen Person: neutrales Grau, nie eine Themenfarbe. */
export const BELEGT_FARBE = '#9AA7B2';

/** Der Pfad bis zu einem Thema (Grundlage jedes Adapters). */
export const themaPfad = (s: SpaceId, t: ThemaId): string[] => [GESAMT, knotenId.space(s), knotenId.thema(s, t)];

// ── Strang ───────────────────────────────────────────────────────────────────

/** Woher ein Strang kommt — eine Zeile in QUELLEN je Wert. */
export type StrangQuelle =
  | 'ziel' | 'meilenstein' | 'aufgabe' | 'projekt'
  | 'termin' | 'belegt'
  | 'followup' | 'deal' | 'event'
  | 'zahlung' | 'rechnung' | 'frist'
  | 'wichtiger-tag' | 'date' | 'vereinbarung'
  | 'training' | 'wettkampf';

export type StrangStatus = 'offen' | 'erledigt' | 'ueberfaellig';
/** „beide“ = gehört dem Haushalt (gemeinsame Ziele, gemeinsame Termine, Finanzen). Sonst der Speichername der Person. */
export const BEIDE = 'beide';

export interface Strang {
  /** Eindeutig über alle Quellen: `<quelle>:<kennung>`. */
  id: string;
  quelle: StrangQuelle;
  titel: string;
  /** Knoten-Kennungen von oben nach unten, beginnt immer mit GESAMT (mindestens bis zum Space). */
  pfad: string[];
  /** Speichername der Person oder BEIDE. */
  person: string;
  /** Zeitpunkt (Tag) oder Spanne (Tag … bis einschließlich). */
  zeit: { tag: string; bis?: string };
  /** Gewicht aus QUELLEN (× Faktor, z. B. dringend) — erledigt zählt `ERLEDIGT_FAKTOR`. */
  gewicht: number;
  status: StrangStatus;
  /** Wohin der Strang führt (WEG-Adresse) — fehlt bei anonymen Strängen. */
  link?: string;
  /** Privat: Titel/Link nur für die eigene Person (die andere sieht ein anonymes „belegt“-Gewicht). */
  privat?: boolean;
}

/** Wie eine Quelle zählt und erscheint. `art` steuert den Engstellen-Text („Fristen“ oder „Termine“), `marke` = als Knopf über dem Band. */
export interface QuellenDef { gewicht: number; art: 'frist' | 'termin'; marke: boolean; name: string; symbol: string }

/**
 * Die Gewichtstabelle (dokumentiert in LICHTFAEDEN.md) — EINE Stelle. Grundsatz: was eine Woche wirklich bindet, wiegt
 * mehr (Meilenstein, Steuerfrist), was nebenher läuft, weniger (Termin, Training). Die Zahlen der Planung sind die von v1.
 */
export const QUELLEN: Record<StrangQuelle, QuellenDef> = {
  ziel: { gewicht: 3, art: 'frist', marke: true, name: 'Ziel-Frist', symbol: '◎' },
  meilenstein: { gewicht: 3, art: 'frist', marke: true, name: 'Meilenstein', symbol: '◇' },
  aufgabe: { gewicht: 1, art: 'frist', marke: false, name: 'Aufgabe', symbol: '●' },
  projekt: { gewicht: 2, art: 'frist', marke: true, name: 'Projekt-Ende', symbol: '▣' },
  termin: { gewicht: 0.5, art: 'termin', marke: false, name: 'Termin', symbol: '○' },
  belegt: { gewicht: 0.5, art: 'termin', marke: false, name: 'Belegt', symbol: '○' },
  followup: { gewicht: 1, art: 'frist', marke: false, name: 'Follow-up', symbol: '↻' },
  deal: { gewicht: 2, art: 'frist', marke: false, name: 'Deal-Abschluss', symbol: '€' },
  event: { gewicht: 2, art: 'termin', marke: true, name: 'Event', symbol: '✦' },
  zahlung: { gewicht: 1, art: 'frist', marke: false, name: 'Zahlung', symbol: '€' },
  rechnung: { gewicht: 1.5, art: 'frist', marke: false, name: 'Rechnung', symbol: '€' },
  frist: { gewicht: 2.5, art: 'frist', marke: true, name: 'Frist', symbol: '▣' },
  'wichtiger-tag': { gewicht: 1, art: 'termin', marke: true, name: 'Wichtiger Tag', symbol: '♥' },
  date: { gewicht: 1.5, art: 'termin', marke: false, name: 'Date', symbol: '♥' },
  vereinbarung: { gewicht: 1, art: 'frist', marke: false, name: 'Vereinbarung', symbol: '●' },
  training: { gewicht: 0.5, art: 'termin', marke: false, name: 'Routine', symbol: '○' },
  wettkampf: { gewicht: 2.5, art: 'termin', marke: true, name: 'Wettkampf', symbol: '◆' },
};
/** Faktoren auf das Grundgewicht. */
export const FAKTOR = {
  /** Aufgabe/Follow-up mit hoher oder kritischer Priorität. */
  dringend: 1.5,
  /** Termin ganztägig oder ab drei Stunden. */
  lang: 2,
  /** Erledigtes bleibt als leise Spur (Meilenstein 3 → 1). */
  erledigt: 1 / 3,
} as const;

/** Gewicht eines Strangs aus der Tabelle (+ Faktoren), auf zwei Stellen gerundet. */
export function gewichtVon(quelle: StrangQuelle, o: { dringend?: boolean; lang?: boolean; erledigt?: boolean } = {}): number {
  let g = QUELLEN[quelle].gewicht;
  if (o.dringend) g *= FAKTOR.dringend;
  if (o.lang) g *= FAKTOR.lang;
  if (o.erledigt) g *= FAKTOR.erledigt;
  return Math.round(g * 100) / 100;
}

const TAG = /^\d{4}-\d{2}-\d{2}$/;
export const istTag = (v: unknown): v is string => typeof v === 'string' && TAG.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
/** Tag aus einem Datum/Zeitstempel (nimmt die ersten 10 Zeichen) — oder null. */
export const tagAus = (v: unknown): string | null => (typeof v === 'string' && istTag(v.slice(0, 10)) ? v.slice(0, 10) : null);

/** Status aus „erledigt?“ und Fälligkeit (überfällig = offen und vor heute). */
export function statusVon(erledigt: boolean, tag: string, heute: string): StrangStatus {
  if (erledigt) return 'erledigt';
  return tag < heute ? 'ueberfaellig' : 'offen';
}

/** Ist ein Strang gültig (Pfad beginnt bei GESAMT, Tag ok, Gewicht > 0)? Adapter liefern nur gültige — der Baum prüft trotzdem. */
export function istGueltig(s: Strang): boolean {
  return !!s.id && s.pfad[0] === GESAMT && s.pfad.length >= 2 && istTag(s.zeit.tag) && (!s.zeit.bis || (istTag(s.zeit.bis) && s.zeit.bis >= s.zeit.tag)) && s.gewicht > 0;
}

// ── Person & Privat ──────────────────────────────────────────────────────────

/** Wessen Stränge zeigt eine Ansicht: eine Person (+ was beiden gehört) oder alle. */
export type PersonSicht = { art: 'person'; person: string } | { art: 'alle' };
export function passtZuPerson(s: Pick<Strang, 'person'>, sicht: PersonSicht): boolean {
  return sicht.art === 'alle' || s.person === BEIDE || s.person === sicht.person;
}

/**
 * Die Privat-Regel (wie im Kalender, lib/kalender/zoe-sicht.ts): Ein privater Strang der ANDEREN Person wird zu einem
 * anonymen „belegt“-Gewicht — ohne Titel, ohne Link, ohne Thema/Ziel im Pfad (nur der Space), Kennung verdeckt.
 */
export function fuerBetrachter(s: Strang, betrachter: string): Strang {
  if (!s.privat || s.person === BEIDE || s.person === betrachter) return s;
  const space = s.pfad[1] ?? knotenId.space('privat');
  return {
    id: `belegt:${verdeckt(s.id)}`, quelle: 'belegt', titel: 'Belegt', pfad: [GESAMT, space], person: s.person,
    zeit: { tag: s.zeit.tag, ...(s.zeit.bis ? { bis: s.zeit.bis } : {}) }, gewicht: QUELLEN.belegt.gewicht, status: s.status === 'erledigt' ? 'erledigt' : 'offen', privat: true,
  };
}

/** Verdeckte Kennung (FNV-1a) — gleich je Eingang, nicht umkehrbar in den Titel. */
export function verdeckt(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
