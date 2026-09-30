// ─── MAKE OS — Planung: die Ziel-Kaskade ────────────────────────────────────
// Kevins Entscheidung (27.09.): Jahresziel → Quartal → Monat → Woche → Tag
// automatisch abgeleitet. Zahlenziele anteilig (120 → 30 je Quartal → gerundet
// je Woche/Tag, Rest sichtbar), Ziele mit Datum als Meilenstein im passenden
// Quartal (= Meilenstein mit diesem Fälligkeitstag). Abgeleitetes ist als
// „abgeleitet aus …“ markiert und wird beim Ändern des Jahresziels neu
// gerechnet — nie dupliziert. Eigene Änderungen an Abgeleitetem bleiben und
// heißen dann „angepasst“; auf jeder Ebene sind eigene Ziele möglich.
// Rein: keine Ansicht, kein Speicher. Tests: tests/planung-kaskade.test.ts.

import type { Meilenstein, Ziel, ZieleDatei, ZielHorizont } from './typen';
import { sortiertNachRang } from './rang';
import { bereichAusSpace } from './meilensteine';
import { zielJahr } from './zeitstrahl';

export type Unterhorizont = Exclude<ZielHorizont, 'jahr'>;
export const UNTERHORIZONTE: readonly Unterhorizont[] = ['quartal', 'monat', 'woche', 'tag'];

const schaltjahr = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** In wie viele Teile ein Jahreswert geteilt wird. */
export function teile(h: Unterhorizont, jahr: number): number {
  if (h === 'quartal') return 4;
  if (h === 'monat') return 12;
  if (h === 'woche') return 52;
  return schaltjahr(jahr) ? 366 : 365;
}

export interface Anteil { genau: number; gerundet: number; rest: number }
const rund1 = (n: number) => Math.round(n * 10) / 10;
/**
 * Der Anteil eines Jahreswerts je Teil. Ab 1 ganzzahlig gerundet, darunter mit
 * einer Nachkommastelle (0,3 je Tag statt 0). `rest` ist, was bei dieser Rundung
 * über das Jahr übrig bleibt (positiv: noch zu holen, negativ: Puffer).
 */
export function anteil(zahl: number, n: number): Anteil {
  const genau = zahl / n;
  const gerundet = genau >= 1 ? Math.round(genau) : rund1(genau);
  return { genau, gerundet, rest: rund1(zahl - gerundet * n) };
}

const zahlText = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));
const JE: Record<Unterhorizont, string> = { quartal: 'im Quartal', monat: 'im Monat', woche: 'je Woche', tag: 'je Tag' };

/** Kennung des abgeleiteten Ziels — je Elternziel und Ebene genau eine. */
export const abgeleiteteId = (elternId: string, h: Unterhorizont) => `${elternId}~${h}`;

/** Der Titel eines abgeleiteten Zahlenziels, z. B. „Neukunden · 30 im Quartal“, „… · 2 je Woche (Rest 16 im Jahr)“. */
export function abgeleiteterTitel(eltern: Ziel, h: Unterhorizont, jahr: number): string {
  const a = anteil(eltern.zielwert ?? 0, teile(h, jahr));
  const rest = a.rest > 0 ? ` (Rest ${zahlText(a.rest)} im Jahr)` : a.rest < 0 ? ` (Puffer ${zahlText(-a.rest)})` : '';
  return `${eltern.titel} · ${zahlText(a.gerundet)} ${JE[h]}${rest}`;
}

/** Das abgeleitete Ziel — mit dem, was ein bestehender Stand beisteuert (Fortschritt, Rang, Erledigt). */
export function abgeleitetesZiel(eltern: Ziel, h: Unterhorizont, jahr: number, bisher?: Ziel): Ziel {
  return {
    id: bisher?.id ?? abgeleiteteId(eltern.id, h),
    titel: abgeleiteterTitel(eltern, h, jahr),
    fortschritt: bisher?.fortschritt ?? 0,
    erledigt: bisher?.erledigt ?? false,
    ...(bisher?.erledigtAm ? { erledigtAm: bisher.erledigtAm } : {}),
    ...(bisher?.notiz ? { notiz: bisher.notiz } : {}),
    ...(bisher?.rang != null ? { rang: bisher.rang } : {}),
    ...(eltern.space ? { space: eltern.space } : {}),
    ...(eltern.einheit ? { einheit: eltern.einheit } : {}),
    // Mandat an Zielen (28.09.): das abgeleitete Ziel zahlt auf dasselbe Mandat ein.
    ...(eltern.mandatId ? { mandatId: eltern.mandatId } : {}),
    ...(eltern.firmaId ? { firmaId: eltern.firmaId } : {}),
    zielwert: anteil(eltern.zielwert ?? 0, teile(h, jahr)).gerundet,
    abgeleitetVon: eltern.id,
  };
}

export const hatZahl = (z: Ziel) => typeof z.zielwert === 'number' && isFinite(z.zielwert) && z.zielwert > 0;
export const hatTermin = (z: Ziel) => typeof z.termin === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(z.termin);

/**
 * Eine Ebene aus den Jahreszielen ableiten. Eigene Ziele bleiben, angepasste
 * bleiben (verliert das Elternteil, werden sie eigene), nicht angepasste
 * Abgeleitete werden neu gerechnet oder fallen weg, wenn das Jahresziel weg ist.
 */
export function ebeneAbleiten(jahrZiele: readonly Ziel[], liste: readonly Ziel[], h: Unterhorizont, jahr: number): Ziel[] {
  const eltern = new Map(jahrZiele.map(z => [z.id, z]));
  const aus: Ziel[] = [];
  const belegt = new Set<string>();
  for (const z of liste) {
    if (!z.abgeleitetVon) { aus.push(z); continue; }
    if (z.angepasst) {
      belegt.add(z.abgeleitetVon);
      aus.push(eltern.has(z.abgeleitetVon) ? z : loesen(z));
    }
  }
  for (const e of jahrZiele) {
    if (!hatZahl(e) || belegt.has(e.id)) continue;
    const bisher = liste.find(z => z.abgeleitetVon === e.id && !z.angepasst);
    aus.push(abgeleitetesZiel(e, h, jahr, bisher));
  }
  return sortiertNachRang(aus);
}

/** Ein abgeleitetes Ziel vom Elternteil lösen — es wird ein eigenes. */
export function loesen(z: Ziel): Ziel {
  const { abgeleitetVon: _a, angepasst: _b, ...rest } = z;
  return rest;
}

/**
 * Die ganze Datei: alle Unterebenen aus den Jahreszielen nachziehen. Nur Ziele des laufenden Jahres (`zielJahr`,
 * 30.09.) kaskadieren — ein Zahlenziel für nächstes Jahr verteilt sich erst ab dessen Januar auf Quartal/Monat/Woche/Tag
 * (die nächste Änderung im neuen Jahr zieht es nach); Abgeleitetes des Vorjahres fällt dann weg.
 */
export function kaskadeAnwenden(datei: ZieleDatei, jahr: number): ZieleDatei {
  const aus: ZieleDatei = { ...datei };
  const imJahr = (datei.jahr ?? []).filter(z => zielJahr(z, jahr) === jahr);
  for (const h of UNTERHORIZONTE) aus[h] = ebeneAbleiten(imJahr, datei[h] ?? [], h, jahr);
  return aus;
}

export const meilensteinId = (zielId: string) => `ms~${zielId}`;

/**
 * Jahresziele mit Datum als Meilensteine (Fälligkeit = Termin → liegt im
 * passenden Quartal — auch im nächsten Jahr, 30.09.: hier wird nicht nach Jahr gefiltert). Bestehende abgeleitete Meilensteine werden nachgezogen
 * (Fortschritt/Rang bleiben), angepasste bleiben, verwaiste fallen weg.
 */
export function meilensteineAbleiten(jahrZiele: readonly Ziel[], meilensteine: readonly Meilenstein[]): Meilenstein[] {
  const eltern = new Map(jahrZiele.filter(hatTermin).map(z => [z.id, z]));
  const aus: Meilenstein[] = [];
  const belegt = new Set<string>();
  for (const m of meilensteine) {
    if (!m.abgeleitetVon) { aus.push(m); continue; }
    if (m.angepasst) {
      belegt.add(m.abgeleitetVon);
      if (eltern.has(m.abgeleitetVon)) aus.push(m);
      else { const { abgeleitetVon: _a, angepasst: _b, ...rest } = m; aus.push(rest); }
    }
  }
  for (const z of eltern.values()) {
    if (belegt.has(z.id)) continue;
    const bisher = meilensteine.find(m => m.abgeleitetVon === z.id && !m.angepasst);
    const erledigt = !!z.erledigt || !!bisher?.erledigt;
    aus.push({
      id: bisher?.id ?? meilensteinId(z.id),
      titel: z.titel,
      // Seit 28.09. das echte Feld `space`; `bereich` gespiegelt für ältere Leser (lib/planung/meilensteine.ts).
      space: z.space === 'privat' ? 'privat' : 'business',
      bereich: bereichAusSpace(z.space === 'privat' ? 'privat' : 'business'),
      faellig: z.termin,
      fortschritt: erledigt ? 100 : (bisher?.fortschritt ?? z.fortschritt ?? 0),
      erledigt,
      ...(erledigt && (bisher?.erledigtAm ?? z.erledigtAm) ? { erledigtAm: bisher?.erledigtAm ?? z.erledigtAm } : {}),
      ...(bisher?.rang != null ? { rang: bisher.rang } : {}),
      ...(bisher?.messlatte ? { messlatte: bisher.messlatte } : {}),
      ...(z.einheit ? { einheit: z.einheit } : {}),
      ...(z.space === 'business' && z.mandatId ? { mandatId: z.mandatId } : {}),
      ...(z.space === 'business' && z.firmaId ? { firmaId: z.firmaId } : {}),
      abgeleitetVon: z.id,
    });
  }
  return sortiertNachRang(aus);
}
