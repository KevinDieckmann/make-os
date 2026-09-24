// ─── MAKE OS — Whoop-Export lesen ───────────────────────────────────────────
// Kevin, 24.09.: „als Nächstes steht der Datenexport von Whoop zur Verfügung,
// somit haben wir alles, was wir brauchen."
//
// Whoop schickt eine Mail mit Download-Link; dahinter liegt ein ZIP mit vier
// Tabellen. Die Werte für Gesundheit und Wachstums-Score stehen in
// „physiologische_zyklen.csv" (englischer Export: „physiological_cycles.csv").
// Hier stehen nur reine Regeln ohne Dateizugriff — testbar:
//   zipEintrag   liest eine Datei aus einem ZIP (ohne Zusatzpaket, zlib reicht)
//   zyklenLesen  macht aus der Tabelle Tageswerte (Recovery, Schlaf, HRV, Puls)

import { inflateRawSync } from 'zlib';

export interface WhoopTag { rec?: number; sleep?: number; hrv?: number; rhr?: number; note?: string }
export type WhoopLog = Record<string, WhoopTag>;

/** Spaltennamen des deutschen und des englischen Exports. */
const SPALTEN = {
  start: ['Startzeit des Zyklus', 'Cycle start time'],
  rec: ['Erholungswert %', 'Recovery score %'],
  rhr: ['Ruheherzfrequenz (Schläge pro Minute)', 'Resting heart rate (bpm)'],
  hrv: ['Herzfrequenzvariabilität (ms)', 'Heart rate variability (ms)'],
  schlafMin: ['Schlafdauer (Min.)', 'Asleep duration (min)'],
  aufwachen: ['Beginn des Aufwachens', 'Wake onset'],
} as const;

/** Name der Zyklen-Tabelle im ZIP — deutsch oder englisch, egal in welchem Unterordner. */
export const istZyklenDatei = (name: string) => /(physiologische_zyklen|physiological_cycles)\.csv$/i.test(name);

/**
 * Eine Datei aus einem ZIP lesen. Genügt für Whoop-Exporte: Verfahren 0
 * (gespeichert) und 8 (deflate), Einträge über das zentrale Verzeichnis.
 */
export function zipEintrag(zip: Buffer, passt: (name: string) => boolean): string | null {
  // Ende des zentralen Verzeichnisses rückwärts suchen (Signatur 0x06054b50).
  let ende = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) { ende = i; break; }
  }
  if (ende < 0) return null;
  const anzahl = zip.readUInt16LE(ende + 10);
  let pos = zip.readUInt32LE(ende + 16);
  for (let n = 0; n < anzahl; n++) {
    if (zip.readUInt32LE(pos) !== 0x02014b50) return null;
    const verfahren = zip.readUInt16LE(pos + 10);
    const gepackt = zip.readUInt32LE(pos + 20);
    const nameLen = zip.readUInt16LE(pos + 28), extraLen = zip.readUInt16LE(pos + 30), kommentarLen = zip.readUInt16LE(pos + 32);
    const lokal = zip.readUInt32LE(pos + 42);
    const name = zip.toString('utf8', pos + 46, pos + 46 + nameLen);
    if (passt(name)) {
      if (zip.readUInt32LE(lokal) !== 0x04034b50) return null;
      const start = lokal + 30 + zip.readUInt16LE(lokal + 26) + zip.readUInt16LE(lokal + 28);
      const daten = zip.subarray(start, start + gepackt);
      if (verfahren === 0) return daten.toString('utf8');
      if (verfahren === 8) return inflateRawSync(daten).toString('utf8');
      return null;
    }
    pos += 46 + nameLen + extraLen + kommentarLen;
  }
  return null;
}

/** CSV-Zeile zerlegen — Whoop quotet Felder mit Komma. */
export function zerlege(zeile: string): string[] {
  const out: string[] = [];
  let feld = '', inAnf = false;
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if (c === '"') { if (inAnf && zeile[i + 1] === '"') { feld += '"'; i++; } else inAnf = !inAnf; }
    else if (c === ',' && !inAnf) { out.push(feld); feld = ''; }
    else feld += c;
  }
  out.push(feld);
  return out;
}

const zahl = (s: string | undefined, min: number, max: number): number | undefined => {
  if (!s?.trim()) return undefined;
  const n = Number(s.replace(',', '.'));
  if (!isFinite(n) || n < min || n > max) return undefined;
  return Math.round(n);
};

/**
 * Zu welchem Tag gehört ein Zyklus? Whoop beginnt ihn mit dem Einschlafen.
 * Wer um 23:42 einschläft, dessen Recovery gilt für den Morgen danach —
 * maßgeblich ist der Tag des Aufwachens (24.09.: vorher landeten diese Werte
 * beim Vortag, und der echte Vortag ging verloren). Fehlt das Aufwachen,
 * zählt ein Beginn ab 12 Uhr zum nächsten Tag.
 */
export function tagDesZyklus(start: string, aufwachen?: string): string | null {
  const iso = /^\d{4}-\d{2}-\d{2}/;
  if (aufwachen && iso.test(aufwachen.trim())) return aufwachen.trim().slice(0, 10);
  if (!iso.test(start)) return null;
  const stunde = Number(start.slice(11, 13));
  if (!(stunde >= 12)) return start.slice(0, 10);
  const d = new Date(`${start.slice(0, 10)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type ZyklenErgebnis = { ok: true; tage: WhoopLog; ohneWerte: number } | { ok: false; fehler: string };

/** Aus „physiologische_zyklen.csv" die Tageswerte. Die Datei ist neueste-zuerst; der erste Treffer je Tag gewinnt. */
export function zyklenLesen(csv: string): ZyklenErgebnis {
  const zeilen = csv.replace(/^﻿/, '').split(/\r?\n/).filter(z => z.trim());
  if (zeilen.length < 2) return { ok: false, fehler: 'Die Tabelle ist leer.' };
  const kopf = zerlege(zeilen[0]).map(s => s.trim());
  const spalte = (k: keyof typeof SPALTEN) => SPALTEN[k].map(n => kopf.indexOf(n)).find(i => i >= 0) ?? -1;
  const idx = { start: spalte('start'), rec: spalte('rec'), rhr: spalte('rhr'), hrv: spalte('hrv'), schlafMin: spalte('schlafMin'), aufwachen: spalte('aufwachen') };
  if (idx.start < 0 || idx.rec < 0) return { ok: false, fehler: 'Das ist nicht die Zyklen-Tabelle von Whoop — „Startzeit des Zyklus" und „Erholungswert %" fehlen.' };

  const tage: WhoopLog = {};
  let ohneWerte = 0;
  for (const z of zeilen.slice(1)) {
    const f = zerlege(z);
    const datum = tagDesZyklus(f[idx.start] ?? '', idx.aufwachen >= 0 ? f[idx.aufwachen] : undefined);
    if (!datum) continue;
    const schlafMin = idx.schlafMin >= 0 ? zahl(f[idx.schlafMin], 0, 24 * 60) : undefined;
    const tag: WhoopTag = {
      rec: zahl(f[idx.rec], 0, 100),
      rhr: idx.rhr >= 0 ? zahl(f[idx.rhr], 20, 200) : undefined,
      hrv: idx.hrv >= 0 ? zahl(f[idx.hrv], 0, 300) : undefined,
      sleep: schlafMin != null ? Math.round((schlafMin / 60) * 10) / 10 : undefined,
    };
    (Object.keys(tag) as (keyof WhoopTag)[]).forEach(k => { if (tag[k] === undefined) delete tag[k]; });
    if (!Object.keys(tag).length) { ohneWerte++; continue; }
    if (!tage[datum]) tage[datum] = tag;
  }
  if (!Object.keys(tage).length) return { ok: false, fehler: 'Keine verwertbaren Zeilen gefunden.' };
  return { ok: true, tage, ohneWerte };
}

/** Neue Tage in den Bestand mischen: Messwerte vom Export, eigene Notizen bleiben. */
export function einmischen(bestand: WhoopLog, neu: WhoopLog): { log: WhoopLog; neu: number; aktualisiert: number } {
  const log: WhoopLog = { ...bestand };
  let dazu = 0, erg = 0;
  for (const [d, t] of Object.entries(neu)) {
    if (log[d]) { log[d] = { ...t, ...(log[d].note ? { note: log[d].note } : {}) }; erg++; }
    else { log[d] = t; dazu++; }
  }
  return { log, neu: dazu, aktualisiert: erg };
}
