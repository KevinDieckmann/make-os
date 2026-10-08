// ─── Kontoauszug einlesen — Bausteine: Zeichensatz, Beträge, Daten, Fingerabdruck (09.10., rein: Server UND Browser) ───────────────────
// ONBOARDING_PLAN.md › B9 d / L7 / L8 / L32: bis die Bank-Anbindung (finAPI) läuft, kommen Umsätze und Saldo aus der Datei der Bank (CAMT.053
// oder CSV). Hier nur die kleinen Leser, die CAMT und CSV gemeinsam brauchen — ohne neue Abhängigkeiten, ohne Node-Module (der Browser liest
// die Datei für die Spaltenzuordnung selbst, der Server liest sie zum Übernehmen noch einmal — die Datei wird nie gespeichert).

import { tagVon, istKalendertag } from '@/lib/zeit';

// ── Zeichensatz ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Windows-1252, oberer Bereich 0x80–0x9F (Rest = Latin-1) — selbst gelesen wie in lib/gmail/mime.ts (dort mit Node-Abhängigkeiten). */
const CP1252_OBEN = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';

export type Zeichensatz = 'utf-8' | 'windows-1252';

/** Bytes → Text: UTF-8 (BOM weg), wenn die Bytes gültiges UTF-8 sind — sonst Windows-1252 (Excel-CSV deutscher Banken). */
export function textAusBytes(bytes: Uint8Array): { text: string; zeichensatz: Zeichensatz } {
  try {
    const t = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { text: t.replace(/^﻿/, ''), zeichensatz: 'utf-8' };
  } catch {
    let aus = '';
    for (const b of bytes) aus += b >= 0x80 && b <= 0x9f ? CP1252_OBEN[b - 0x80] : String.fromCharCode(b);
    return { text: aus, zeichensatz: 'windows-1252' };
  }
}

// ── Beträge (immer in ganzen Cent) ───────────────────────────────────────────────────────────────────────────────────────────────

/** Dezimaltrenner einer Spalte: „komma“ (deutsch, 1.234,56) oder „punkt“ (1,234.56 / CAMT / Revolut). */
export type Zahlformat = 'komma' | 'punkt';

/** Format einer ganzen Spalte erkennen — eine Zahl mit „,dd“ am Ende entscheidet für Komma, „.dd“ (ohne jede „,dd“) für Punkt. */
export function zahlformatErkennen(werte: readonly string[]): Zahlformat {
  let komma = 0, punkt = 0;
  for (const roh of werte) {
    const w = String(roh ?? '').replace(/[^\d.,]/g, '');
    if (/,\d{1,2}$/.test(w)) komma++;
    else if (/\.\d{1,2}$/.test(w)) punkt++;
  }
  return punkt > komma ? 'punkt' : 'komma';
}

const WAEHRUNGS_ZEICHEN = /(EUR|USD|CHF|GBP|€|\$|£)/gi;

/**
 * Text → Cent (ganze Zahl, Vorzeichen: + Eingang, − Ausgang). Versteht „1.234,56“, „-1.234,56“, „1234,56“, „+12,00 €“, „1,234.56“, „-12.5“,
 * „12,34-“ (Minus hinten), „12,34 S“/„12,34 H“ (Soll/Haben), „(12,34)“, „−12,34“ (typografisches Minus). Unklar → null (nie raten).
 */
export function betragCent(roh: unknown, format: Zahlformat = 'komma'): number | null {
  let t = String(roh ?? '').normalize('NFKC').trim();
  if (!t) return null;
  let vz = 1;
  const sh = /^(.*\d)\s*([SH])$/i.exec(t);
  if (sh) { t = sh[1]; if (sh[2].toUpperCase() === 'S') vz = -1; }
  t = t.replace(WAEHRUNGS_ZEICHEN, '').replace(/[\s  ']/g, '').replace(/−/g, '-');
  if (/^\(.*\)$/.test(t)) { vz *= -1; t = t.slice(1, -1); }
  if (t.endsWith('-')) { vz *= -1; t = t.slice(0, -1); }
  if (t.startsWith('-')) { vz *= -1; t = t.slice(1); } else if (t.startsWith('+')) t = t.slice(1);
  if (!/^\d[\d.,]*$/.test(t) || /[.,]$/.test(t)) return null;
  const k = t.lastIndexOf(','), p = t.lastIndexOf('.');
  let dez = -1;
  if (k >= 0 && p >= 0) dez = Math.max(k, p);
  else if (k >= 0) dez = format === 'punkt' && /^\d{1,3}(,\d{3})+$/.test(t) ? -1 : k;
  else if (p >= 0) dez = format === 'komma' && /^\d{1,3}(\.\d{3})+$/.test(t) ? -1 : p;
  const ganzText = (dez >= 0 ? t.slice(0, dez) : t).replace(/[.,]/g, '');
  const bruchText = dez >= 0 ? t.slice(dez + 1) : '';
  if (!/^\d*$/.test(ganzText) || !/^\d*$/.test(bruchText) || (!ganzText && !bruchText)) return null;
  // Tausender-Gruppen prüfen: im ganzzahligen Teil darf nur der andere Trenner stehen.
  if (dez >= 0 && /[.,]/.test(t.slice(0, dez)) && t.slice(0, dez).includes(t[dez])) return null;
  const ganz = ganzText ? Number(ganzText) : 0;
  const b = (bruchText + '000').slice(0, 3);
  let cent = ganz * 100 + Number(b.slice(0, 2));
  if (Number(b[2]) >= 5) cent += 1;   // dritte Stelle (Wechselkurs-Beträge): kaufmännisch runden
  if (!Number.isSafeInteger(cent)) return null;
  return vz * cent;
}

/** Cent → € auf den Cent (für Bestände, die in Euro rechnen: Konten-Register, Business-Buchungen). */
export const centZuEuro = (c: number): number => Math.round(c) / 100;

// ── Daten ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Text → Berliner Kalendertag „JJJJ-MM-TT“: „2026-10-01“, „2026-10-01T10:00:00+02:00“ (mit Zone → Berliner Tag), „2026-10-01 10:00:00“,
 * „01.10.2026“, „1.10.26“ (zweistellig = 20xx), „01/10/2026“ (Tag zuerst), „20261001“. Ungültig („31.02.2026“) → null.
 */
export function datumAus(roh: unknown): string | null {
  const t = String(roh ?? '').trim();
  if (!t) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/.exec(t);
  if (m) {
    const tag = `${m[1]}-${m[2]}-${m[3]}`;
    if (!istKalendertag(tag)) return null;
    if (m[4] && m[7]) return tagVon(t.replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
    return tag;
  }
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/.exec(t);
  if (m) {
    const jahr = m[3].length === 2 ? `20${m[3]}` : m[3];
    const tag = `${jahr}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return istKalendertag(tag) ? tag : null;
  }
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (m) { const tag = `${m[1]}-${m[2]}-${m[3]}`; return istKalendertag(tag) ? tag : null; }
  return null;
}

// ── Texte und Fingerabdruck ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Für Vergleiche: klein, Umlaute ausgeschrieben, Leerraum zusammengefasst (gleiche Regel wie lib/finanzen/haushalt/regeln.ts `normal`). */
export function vergleichsText(s: unknown): string {
  return String(s ?? '').normalize('NFC').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ').trim();
}

/** Zwei unabhängige 32-Bit-FNV-1a-Durchläufe → 64 Bit, base36 — stabil, rein (kein Node-crypto), für Kennungen und Dubletten-Schlüssel. */
export function kurzHash(text: string): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a ^= c; a = Math.imul(a, 0x01000193);
    b ^= c; b = Math.imul(b, 0x01000193) ^ (b >>> 13);
  }
  return (a >>> 0).toString(36).padStart(7, '0') + (b >>> 0).toString(36).padStart(7, '0');
}

/** Leerraum glätten, Steuerzeichen weg — für Gegenpartei und Verwendungszweck (fremder Text: nur Daten). */
export function textGlaetten(s: unknown): string {
  // eslint-disable-next-line no-control-regex
  return String(s ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}
