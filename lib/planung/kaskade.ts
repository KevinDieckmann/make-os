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

// 14.10. (Abnahme B13): ab 1.000 mit Tausenderpunkt („2.083“ statt „2083“) — kleine Zahlen wie bisher („30“, „0,3“).
const zahlText = (n: number) => (Number.isInteger(n) ? (Math.abs(n) >= 1000 ? n.toLocaleString('de-DE') : String(n)) : n.toFixed(1).replace('.', ','));
const JE: Record<Unterhorizont, string> = { quartal: 'im Quartal', monat: 'im Monat', woche: 'je Woche', tag: 'je Tag' };

export type ZielTakt = 'tag' | 'woche' | 'monat' | 'quartal' | 'jahr';
/** Was ein Zahlenziel zählt (aus dem Titel): die Einheit hinter der Zahl und ob es eine Rate „je Monat“ usw. ist. */
export interface ZahlenzielArt { einheit?: string; takt?: ZielTakt }
const SYMBOL = /^\s*(T€|k€|€|EUR|%)/;
const WORT = /^\s+([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]*)/;
const KEIN_EINHEITSWORT = new Set(['je', 'pro', 'im', 'in', 'bis', 'für', 'ab', 'pa', 'p']);
const TAKT_WORT: Record<string, ZielTakt> = { tag: 'tag', woche: 'woche', monat: 'monat', quartal: 'quartal', jahr: 'jahr', täglich: 'tag', wöchentlich: 'woche', monatlich: 'monat', quartalsweise: 'quartal', jährlich: 'jahr' };
const TAKT = /^\s*(?:(?:je|pro|im|\/)\s*(Tag|Woche|Monat|Quartal|Jahr)|(täglich|wöchentlich|monatlich|quartalsweise|jährlich))(?![A-Za-zÄÖÜäöüß])/i;
const zahlAus = (t: string) => Number(t.replace(/\./g, '').replace(',', '.'));
/**
 * Einheit und Takt eines Zahlenziels aus seinem Titel (Abnahme 14.10., B13 — vorher „2083 im Monat“ ohne Einheit, aus einem Ziel „25.000 € je Monat“
 * durch 12 geteilt): die Zahl im Titel, die dem Zielwert entspricht, und was direkt dahinter steht. „120 Neukunden“ → Einheit „Neukunden“;
 * „Umsatz 300.000 €“ → „€“; „25.000 € je Monat“ → „€“ mit Takt „monat“. Ohne passende Zahl im Titel: nichts (die Kaskade bleibt, wie sie war).
 */
export function zahlenzielArt(z: Pick<Ziel, 'titel' | 'zielwert'>): ZahlenzielArt {
  if (!(typeof z.zielwert === 'number' && z.zielwert > 0)) return {};
  for (const m of z.titel.matchAll(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g)) {
    if (Math.abs(zahlAus(m[0]) - z.zielwert) > 0.001) continue;
    let rest = z.titel.slice((m.index ?? 0) + m[0].length);
    let einheit: string | undefined;
    const sy = rest.match(SYMBOL);
    if (sy) { einheit = sy[1] === 'EUR' ? '€' : sy[1]; rest = rest.slice(sy[0].length); }
    else { const w = rest.match(WORT); if (w && !KEIN_EINHEITSWORT.has(w[1].toLowerCase())) { einheit = w[1]; rest = rest.slice(w[0].length); } }
    const t = rest.match(TAKT);
    const takt = t ? TAKT_WORT[(t[1] ?? t[2]).toLowerCase()] : undefined;
    return { ...(einheit ? { einheit } : {}), ...(takt ? { takt } : {}) };
  }
  return {};
}
/**
 * Eine Rate („25.000 € je Monat“, „3 Gespräche je Woche“) ist ein STAND, der erreicht werden soll — keine Jahressumme. Sie wird nicht auf Quartal,
 * Monat, Woche und Tag aufgeteilt: jede Ebene trägt dasselbe Ziel (B13). „… im Jahr“ ist eine Summe und wird aufgeteilt wie bisher.
 */
export const istRatenziel = (z: Pick<Ziel, 'titel' | 'zielwert'>): boolean => { const t = zahlenzielArt(z).takt; return !!t && t !== 'jahr'; };
/** Der Zielwert als Text mit Einheit und Takt aus dem Titel (B13): „25.000 € je Monat“, „120 Neukunden“, ohne Angabe nur die Zahl. */
export function zielwertText(z: Pick<Ziel, 'titel' | 'zielwert'>): string {
  if (!(typeof z.zielwert === 'number' && z.zielwert > 0)) return '';
  const a = zahlenzielArt(z);
  const TAKT_TEXT: Record<ZielTakt, string> = { tag: 'je Tag', woche: 'je Woche', monat: 'je Monat', quartal: 'je Quartal', jahr: 'im Jahr' };
  return `${zahlText(z.zielwert)}${a.einheit ? (a.einheit === '%' ? ' %' : ` ${a.einheit}`) : ''}${a.takt ? ` ${TAKT_TEXT[a.takt]}` : ''}`;
}

/** Kennung des abgeleiteten Ziels — je Elternziel und Ebene genau eine. */
export const abgeleiteteId = (elternId: string, h: Unterhorizont) => `${elternId}~${h}`;

/** Der Titel eines abgeleiteten Zahlenziels, z. B. „Neukunden · 30 im Quartal“, „… · 2 je Woche (Rest 16 im Jahr)“. */
export function abgeleiteterTitel(eltern: Ziel, h: Unterhorizont, jahr: number): string {
  // Rate (B13): dasselbe Ziel auf jeder Ebene — nie „25.000 € je Monat · 2083 im Monat“.
  if (istRatenziel(eltern)) return eltern.titel;
  const a = anteil(eltern.zielwert ?? 0, teile(h, jahr));
  // Mit der Einheit aus dem Titel (B13): „… · 2.083 € im Monat“ statt „2083 im Monat“.
  const e = zahlenzielArt(eltern).einheit;
  const mit = (n: number) => `${zahlText(n)}${e ? (e === '%' ? ' %' : ` ${e}`) : ''}`;
  const rest = a.rest > 0 ? ` (Rest ${mit(a.rest)} im Jahr)` : a.rest < 0 ? ` (Puffer ${mit(-a.rest)})` : '';
  return `${eltern.titel} · ${mit(a.gerundet)} ${JE[h]}${rest}`;
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
    // Rate (B13): nicht aufgeteilt — jede Ebene trägt den Zielwert des Jahresziels.
    zielwert: istRatenziel(eltern) ? (eltern.zielwert ?? 0) : anteil(eltern.zielwert ?? 0, teile(h, jahr)).gerundet,
    abgeleitetVon: eltern.id,
    // Geteilt (09.10., eigene Ziele): das abgeleitete Ziel folgt dem Jahresziel — geteilt ist es, wenn das Jahresziel es ist.
    ...(eltern.geteilt ? { geteilt: true } : {}),
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

/**
 * Titel abgeleiteter Ziele nach der GELTENDEN Regel — nur zur Anzeige (14.10., Kevins Entscheidung zu B13: alte Titel wie „· 2083 im Monat“
 * standen weiter da, bis die Kaskade wieder lief). Lesen schreibt nicht: der Stand der Zeile bleibt der gespeicherte, gespeichert wird der neue
 * Titel beim nächsten Schreiben über die Kaskade (`kaskadeAnwenden`). Angepasste und eigene Ziele bleiben, wie sie sind. Rein.
 */
export function titelNachRegel<D extends ZieleDatei>(datei: D, jahr: number): D {
  const eltern = new Map((datei.jahr ?? []).filter(z => zielJahr(z, jahr) === jahr && hatZahl(z)).map(z => [z.id, z]));
  if (!eltern.size) return datei;
  const aus: D = { ...datei };
  for (const h of UNTERHORIZONTE) {
    const l = datei[h];
    if (!l?.length) continue;
    aus[h] = l.map(z => {
      const e = z.abgeleitetVon && !z.angepasst ? eltern.get(z.abgeleitetVon) : undefined;
      if (!e) return z;
      const titel = abgeleiteterTitel(e, h, jahr);
      return titel === z.titel ? z : { ...z, titel };
    });
  }
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
      // Kette (01.10.): „wartet auf“ bleibt beim Nachziehen stehen (wer es setzt, ändert den Meilenstein → „angepasst“, dann greift das hier nie).
      ...(bisher?.wartetAuf?.length ? { wartetAuf: bisher.wartetAuf } : {}),
      // Kapazität (04.10.): Aufwand und Personen bleiben beim Nachziehen stehen.
      ...(bisher?.aufwand ? { aufwand: bisher.aufwand } : {}),
      ...(bisher?.personen?.length ? { personen: bisher.personen } : {}),
      ...(z.einheit ? { einheit: z.einheit } : {}),
      ...(z.space === 'business' && z.mandatId ? { mandatId: z.mandatId } : {}),
      ...(z.space === 'business' && z.firmaId ? { firmaId: z.firmaId } : {}),
      abgeleitetVon: z.id,
    });
  }
  return sortiertNachRang(aus);
}
