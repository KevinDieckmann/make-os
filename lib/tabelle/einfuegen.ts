// ─── Einfügen aus Excel/BWA-CSV — der gemeinsame Leser der Daten-Assistenten (09.10., rein: Server UND Browser) ───────────────────
// ONBOARDING_PLAN.md › B9 a–c / L7: Zahlen kamen nur Formular für Formular. Hier der EINE Leser für „aus Excel kopieren und einfügen“
// (Tab-getrennt aus der Zwischenablage) und für CSV-Dateien (BWA, OP-Liste, Mandatsliste) — er baut auf dem Kontoauszug-Leser auf
// (lib/finanzen/kontoauszug: Zeichensatz UTF-8/Windows-1252, Trenner, Anführungszeichen, deutsches Zahlen- und Datumsformat). Keinen zweiten
// CSV-Leser daneben bauen.
//
// Ablauf in jedem Assistenten (Monatsabschluss, offene Posten, Mandate):
//   1. `tabelleLesen`       Text oder Bytes → Zeilen mit Zellen (nie gekürzt: zu groß → Fehler, nichts gelesen)
//   2. Aufbereiten          `zeilenAufbereiten` (Datensatz = Zeile, Quelle = Spalte) bzw. eine eigene Regel (BWA: Datensatz = Monat, Quelle = Position)
//   3. Zuordnen             `zuordnungVorschlag` aus bekannten Namen (nur Begriffe, keine Daten) — jederzeit von Hand änderbar
//   4. `datensaetzeBauen`   je Datensatz die Rohtexte je Feld (mehrere Quellen auf ein Summen-Feld = mehrere Texte)
//   5. Server: prüft und rechnet (Zahlen, Daten) mit denselben Lesern, Vorschau → Übernehmen → Rückgängig.
// Fremder Text (Namen aus der Liste) ist Daten: nichts hier wertet ihn aus außer zum Vergleichen.

import { csvZerlegen, trennerErkennen, kopfNorm, type CsvZeile } from '@/lib/finanzen/kontoauszug/csv';
import { betragCent, datumAus, textAusBytes, zahlformatErkennen, type Zahlformat, type Zeichensatz } from '@/lib/finanzen/kontoauszug/text';

export type { CsvZeile } from '@/lib/finanzen/kontoauszug/csv';

/** Grenzen einer Einfügung — darüber wird NICHTS gelesen (nie still gekürzt). */
export const EINFUEGEN_GRENZEN = { zeichen: 2_000_000, zeilen: 3000, spalten: 80, datensaetze: 1000 } as const;

// ── 1 · Lesen ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type TabelleGelesen =
  | { ok: true; zeilen: CsvZeile[]; trenner: string; zeichensatz: Zeichensatz }
  | { ok: false; fehler: string };

/** Text (Zwischenablage, Tab-getrennt aus Excel/Numbers) oder Bytes (CSV-Datei) → Zeilen mit Zellen. Ein Trenner je Einfügung. */
export function tabelleLesen(eingabe: string | Uint8Array): TabelleGelesen {
  const roh = typeof eingabe === 'string' ? { text: eingabe.replace(/^﻿/, ''), zeichensatz: 'utf-8' as Zeichensatz } : textAusBytes(eingabe);
  if (roh.text.length > EINFUEGEN_GRENZEN.zeichen) return { ok: false, fehler: `Mehr als ${(EINFUEGEN_GRENZEN.zeichen / 1e6).toLocaleString('de-DE')} Mio. Zeichen — bitte in kleineren Teilen einfügen. Nichts gelesen.` };
  if (!roh.text.trim()) return { ok: false, fehler: 'Nichts eingefügt.' };
  // Aus der Zwischenablage (Excel, Numbers, Google Tabellen) kommt Tab-getrennter Text — der Tab gewinnt, sobald er vorkommt.
  const trenner = typeof eingabe === 'string' && roh.text.includes('\t') ? '\t' : trennerErkennen(roh.text);
  const zeilen = csvZerlegen(roh.text, trenner);
  if (!zeilen.length) return { ok: false, fehler: 'Nichts eingefügt.' };
  if (zeilen.length > EINFUEGEN_GRENZEN.zeilen) return { ok: false, fehler: `Mehr als ${EINFUEGEN_GRENZEN.zeilen.toLocaleString('de-DE')} Zeilen — bitte in kleineren Teilen einfügen. Nichts gelesen.` };
  if (zeilen.some(z => z.zellen.length > EINFUEGEN_GRENZEN.spalten)) return { ok: false, fehler: `Mehr als ${EINFUEGEN_GRENZEN.spalten} Spalten — so breit ist keine der Tabellen. Nichts gelesen.` };
  return { ok: true, zeilen, trenner, zeichensatz: roh.zeichensatz };
}

/** Zeilen ↔ Spalten tauschen (fehlende Zellen = leer). */
export function transponieren(zeilen: readonly CsvZeile[]): CsvZeile[] {
  const breite = Math.max(0, ...zeilen.map(z => z.zellen.length));
  return Array.from({ length: breite }, (_, s) => ({ zeile: s + 1, zellen: zeilen.map(z => z.zellen[s] ?? '') }));
}

// ── 2 · Felder und Zuordnung ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface FeldDef {
  id: string;
  label: string;
  /** Bekannte Spalten- bzw. Zeilennamen (nur Begriffe, keine Daten) — „genau“ gewinnt vor „enthält“. */
  namen?: readonly string[];
  enthaelt?: readonly string[];
  /** Wörter, die eine „enthält“-Zuordnung ausschließen (z. B. „Quote“ bei Eigenkapital). */
  nicht?: readonly string[];
  /** Ohne dieses Feld geht es nicht (Zuordnung Pflicht). */
  pflicht?: boolean;
  /** Mehrere Quellen dürfen auf dieses Feld zeigen — ihre Zahlen werden addiert (BWA: Werbe- und Reisekosten). */
  summe?: boolean;
  /** Ein Satz unter der Zuordnung (was hineingehört). */
  hilfe?: string;
}

/** Name zum Vergleichen: klein, Umlaute ausgeschrieben, Nummern vorn weg („1020 Umsatzerlöse“, „4. Personalkosten“), nur Buchstaben/Ziffern. */
export function namensSchluessel(s: string): string {
  return kopfNorm(s).replace(/^\d+[.)]?\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Eine Quelle (Spalte, BWA-Position) mit einem Beispielwert — so zeigt die Zuordnung, was darin steht. */
export interface Quelle { label: string; beispiel: string }
/** Was nach dem Aufbereiten vorliegt: die Quellen, je Datensatz die Zellen je Quelle (Index = Quelle), ein Vorschlag je Quelle. */
export interface Aufbereitet {
  quellen: Quelle[];
  datensaetze: { quelle: string; schluessel?: string; zellen: string[] }[];
  /** Feld-Kennung je Quelle (null = nicht übernehmen). */
  vorschlag: (string | null)[];
  hinweise: string[];
}
/** Ein Datensatz, wie er an den Server geht: die Rohtexte je Feld (Summen-Felder: mehrere). `quelle` sagt, woher er kommt („Zeile 4“). */
export interface Datensatz { quelle: string; schluessel?: string; werte: Record<string, string[]> }

/**
 * Vorschlag der Zuordnung Quelle → Feld aus den Namen: erst alle genauen Treffer (ein Summen-Feld darf mehrere bekommen), dann „enthält“
 * (jedes Nicht-Summen-Feld höchstens einmal). Unbekanntes bleibt `null` — nie raten.
 */
export function zuordnungVorschlag(labels: readonly string[], felder: readonly FeldDef[]): (string | null)[] {
  const norm = labels.map(namensSchluessel);
  const raus: (string | null)[] = labels.map(() => null);
  const belegt = new Set<string>();
  const nimm = (i: number, f: FeldDef) => { raus[i] = f.id; if (!f.summe) belegt.add(f.id); };
  const genau = felder.map(f => new Set((f.namen ?? []).map(namensSchluessel)));
  for (let i = 0; i < norm.length; i++) {
    if (!norm[i]) continue;
    const f = felder.find((x, j) => genau[j].has(norm[i]) && !belegt.has(x.id));
    if (f) nimm(i, f);
  }
  for (let i = 0; i < norm.length; i++) {
    if (raus[i] || !norm[i]) continue;
    const f = felder.find(x => !belegt.has(x.id) && (x.enthaelt ?? []).some(w => norm[i].includes(namensSchluessel(w)))
      && !(x.nicht ?? []).some(w => norm[i].includes(namensSchluessel(w))));
    if (f) nimm(i, f);
  }
  return raus;
}

/** Ist die Zuordnung vollständig? Pflichtfelder zugeordnet, Nicht-Summen-Felder höchstens einmal. Fehler → Satz, sonst null. */
export function zuordnungPruefen(zuordnung: readonly (string | null)[], felder: readonly FeldDef[], quellen: readonly Quelle[]): string | null {
  for (const f of felder) {
    const n = zuordnung.filter(z => z === f.id).length;
    if (f.pflicht && !n) return `Bitte „${f.label}“ zuordnen.`;
    if (!f.summe && n > 1) {
      const namen = zuordnung.map((z, i) => (z === f.id ? `„${quellen[i]?.label ?? i + 1}“` : null)).filter(Boolean).join(' und ');
      return `„${f.label}“ ist zweimal zugeordnet (${namen}) — bitte eine davon auf „nicht übernehmen“ stellen.`;
    }
  }
  return null;
}

/** Je Datensatz die nicht leeren Texte je Feld — Datensätze ohne jeden Wert fallen weg (leere Zeilen, Zwischenüberschriften). */
export function datensaetzeBauen(a: Aufbereitet, zuordnung: readonly (string | null)[]): Datensatz[] {
  const raus: Datensatz[] = [];
  for (const d of a.datensaetze) {
    const werte: Record<string, string[]> = {};
    d.zellen.forEach((z, i) => {
      const f = zuordnung[i];
      const t = (z ?? '').trim();
      if (!f || !t) return;
      (werte[f] ??= []).push(t);
    });
    if (Object.keys(werte).length) raus.push({ quelle: d.quelle, ...(d.schluessel ? { schluessel: d.schluessel } : {}), werte });
  }
  return raus;
}

// ── Datensatz = Zeile (Mandate, offene Posten) ───────────────────────────────────────────────────────────────────────────────────

const siehtAusWieWert = (s: string) => !!datumAus(s) || betragCent(s) !== null;

/**
 * Kopfzeile finden (Vorspann darüber wird übersprungen): die erste Zeile mit mindestens zwei bekannten Namen (bzw. einem, wenn es nur ein
 * Pflichtfeld gibt) — sonst Zeile 1, wenn sie nur Text trägt und darunter Werte stehen — sonst keine (Spalten heißen „Spalte n“).
 */
export function kopfFinden(zeilen: readonly CsvZeile[], felder: readonly FeldDef[]): number {
  const grenze = Math.min(zeilen.length, 30);
  const mindest = felder.length > 2 ? 2 : 1;
  for (let i = 0; i < grenze; i++) {
    const zellen = zeilen[i].zellen.filter(z => z.trim());
    if (!zellen.length || zellen.some(siehtAusWieWert)) continue;
    if (zuordnungVorschlag(zeilen[i].zellen, felder).filter(Boolean).length >= mindest) return i;
  }
  const erste = zeilen[0]?.zellen.filter(z => z.trim()) ?? [];
  if (erste.length >= 2 && !erste.some(siehtAusWieWert) && zeilen.slice(1, 4).some(z => z.zellen.some(siehtAusWieWert))) return 0;
  return -1;
}

/** Aufbereiten, wenn jede Zeile ein Datensatz ist (Spalten = Quellen). */
export function zeilenAufbereiten(zeilen: readonly CsvZeile[], felder: readonly FeldDef[]): Aufbereitet {
  const k = kopfFinden(zeilen, felder);
  const daten = zeilen.slice(k + 1);
  const breite = Math.max(0, ...zeilen.slice(Math.max(0, k)).map(z => z.zellen.length));
  const kopf = Array.from({ length: breite }, (_, i) => (k >= 0 ? (zeilen[k].zellen[i] ?? '').trim() : '') || `Spalte ${i + 1}`);
  // Spalten ohne jeden Wert bleiben aus der Zuordnung (sonst stehen leere Kopfzellen als Quellen da).
  const genutzt = kopf.map((_, i) => daten.some(z => (z.zellen[i] ?? '').trim()));
  const index = kopf.map((_, i) => i).filter(i => genutzt[i]);
  const quellen = index.map(i => ({ label: kopf[i], beispiel: daten.find(z => (z.zellen[i] ?? '').trim())?.zellen[i]?.trim() ?? '' }));
  const hinweise: string[] = [];
  if (k > 0) hinweise.push(`Die ersten ${k} Zeile${k === 1 ? '' : 'n'} (Vorspann) sind übersprungen — die Kopfzeile steht in Zeile ${zeilen[k].zeile}.`);
  if (k < 0) hinweise.push('Keine Kopfzeile erkannt — bitte jede Spalte unten zuordnen.');
  return {
    quellen,
    datensaetze: daten.map(z => ({ quelle: `Zeile ${z.zeile}`, zellen: index.map(i => z.zellen[i] ?? '') })),
    vorschlag: k >= 0 ? zuordnungVorschlag(quellen.map(q => q.label), felder) : quellen.map(() => null),
    hinweise,
  };
}

// ── Zahlen, Monate (für den Server und die Vorschau) ─────────────────────────────────────────────────────────────────────────────

/** Zahlformat aller Texte der genannten Felder (eine Einfügung = ein Format: „1.234,56“ oder „1,234.56“). */
export function zahlformatVon(ds: readonly Datensatz[], felder: readonly string[]): Zahlformat {
  return zahlformatErkennen(ds.flatMap(d => felder.flatMap(f => d.werte[f] ?? [])));
}

/** Texte eines Feldes → Summe in ganzen Cent. Leer → null; ein Text ist keine Zahl → { fehler } mit diesem Text. */
export function centSumme(texte: readonly string[] | undefined, format: Zahlformat): { cent: number | null } | { fehler: string } {
  if (!texte?.length) return { cent: null };
  let summe = 0;
  for (const t of texte) {
    const c = betragCent(t, format);
    if (c === null) return { fehler: t };
    summe += c;
  }
  return Number.isSafeInteger(summe) ? { cent: summe } : { fehler: texte.join(' + ') };
}

const MONATE: Record<string, number> = {
  jan: 1, januar: 1, january: 1, jaenner: 1, feb: 2, februar: 2, february: 2, mar: 3, maer: 3, mrz: 3, maerz: 3, march: 3, apr: 4, april: 4,
  mai: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  okt: 10, oct: 10, oktober: 10, october: 10, nov: 11, november: 11, dez: 12, dec: 12, dezember: 12, december: 12,
};
const monatText = (j: number, m: number): string | null => (j >= 2000 && j <= 2099 && m >= 1 && m <= 12 ? `${j}-${String(m).padStart(2, '0')}` : null);
const jahr = (t: string) => (t.length === 2 ? 2000 + Number(t) : Number(t));

/**
 * Text → Monat „JJJJ-MM“: „2026-01“, „01/2026“, „1/26“, „01.2026“, „2026/01“, „Jan 2026“, „Jan/26“, „Januar 2026“, „Mär. 26“, „Sept 2026“,
 * ein Datum („31.01.2026“). Zeiträume („Jan–Sep 2026“), Summen, Prozente → null (nie raten).
 */
export function monatAus(roh: unknown): string | null {
  const original = String(roh ?? '').normalize('NFC').trim();
  const t = original.toLowerCase().replace(/ä/g, 'ae');
  if (!t || t.length > 24) return null;
  let m = /^(\d{4})[-/.](\d{1,2})$/.exec(t);
  if (m) return monatText(Number(m[1]), Number(m[2]));
  m = /^(\d{1,2})[/-](\d{2}|\d{4})$/.exec(t) ?? /^(\d{1,2})\.(\d{4})$/.exec(t);
  if (m) return monatText(jahr(m[2]), Number(m[1]));
  m = /^([a-z]{3,9})\.?\s*[-/'’.]?\s*(\d{2}|\d{4})$/.exec(t);
  if (m && MONATE[m[1]]) return monatText(jahr(m[2]), MONATE[m[1]]);
  const d = datumAus(original);
  return d ? d.slice(0, 7) : null;
}

/** Monat zum Anzeigen: „2026-03“ → „März 2026“. */
export function monatLang(m: string): string {
  const n = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return /^\d{4}-\d{2}$/.test(m) ? `${n[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}` : m;
}

// ── Prüfen, was vom Browser kommt (Server) ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Datensätze aus dem Körper prüfen: Liste, höchstens `EINFUEGEN_GRENZEN.datensaetze`, nur bekannte Felder, nur Texte (≤ 500 Zeichen,
 * höchstens 40 je Feld). Zu viel → `zuGross` (413), sonst Satz (400). Gekürzt wird nie.
 */
export function datensaetzePruefen(roh: unknown, felder: readonly string[]): { ok: true; datensaetze: Datensatz[] } | { ok: false; fehler: string; zuGross?: true } {
  if (!Array.isArray(roh)) return { ok: false, fehler: 'Keine Zeilen.' };
  if (!roh.length) return { ok: false, fehler: 'Keine Zeilen mit Werten — passt die Zuordnung?' };
  if (roh.length > EINFUEGEN_GRENZEN.datensaetze) return { ok: false, zuGross: true, fehler: `Mehr als ${EINFUEGEN_GRENZEN.datensaetze} Zeilen auf einmal — bitte in Teilen einfügen. Nichts übernommen.` };
  const bekannt = new Set(felder);
  const raus: Datensatz[] = [];
  for (const [i, x] of roh.entries()) {
    const o = (x ?? {}) as Record<string, unknown>;
    const quelle = typeof o.quelle === 'string' && o.quelle.length <= 80 ? o.quelle : `Zeile ${i + 1}`;
    const schluessel = typeof o.schluessel === 'string' && o.schluessel.length <= 40 ? o.schluessel : undefined;
    const w = o.werte;
    if (!w || typeof w !== 'object' || Array.isArray(w)) return { ok: false, fehler: `${quelle}: Werte fehlen.` };
    const werte: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(w as Record<string, unknown>)) {
      if (!bekannt.has(k)) return { ok: false, fehler: `${quelle}: unbekanntes Feld „${k.slice(0, 30)}“.` };
      const l = Array.isArray(v) ? v : [v];
      if (l.length > 40) return { ok: false, zuGross: true, fehler: `${quelle}: mehr als 40 Werte für ein Feld. Nichts übernommen.` };
      if (l.some(t => typeof t !== 'string')) return { ok: false, fehler: `${quelle}: Werte als Text erwartet.` };
      if (l.some(t => (t as string).length > 500)) return { ok: false, zuGross: true, fehler: `${quelle}: ein Wert ist länger als 500 Zeichen. Nichts übernommen.` };
      const texte = (l as string[]).map(t => t.trim()).filter(Boolean);
      if (texte.length) werte[k] = texte;
    }
    raus.push({ quelle, ...(schluessel ? { schluessel } : {}), werte });
  }
  return { ok: true, datensaetze: raus };
}

/** Auswahl (welche Vorschau-Zeilen übernommen werden) prüfen: fehlt sie, gilt alles; sonst eine Liste von Schlüsseln. */
export function auswahlAus(roh: unknown): Set<string> | null {
  if (roh === undefined || roh === null) return null;
  return Array.isArray(roh) ? new Set(roh.filter((x): x is string => typeof x === 'string').slice(0, EINFUEGEN_GRENZEN.datensaetze * 2)) : new Set();
}

// ── Vorschau (gemeinsame Form für die Oberfläche) ────────────────────────────────────────────────────────────────────────────────

export type VorschauStatus = 'neu' | 'geaendert' | 'gleich' | 'fehler' | 'uebersprungen' | 'entfaellt';
export interface VorschauZeile {
  /** Eindeutig in dieser Vorschau — damit wählt die Oberfläche einzelne Zeilen ab. */
  schluessel: string;
  quelle: string;
  titel: string;
  status: VorschauStatus;
  /** Ein Satz (Fehlergrund, Hinweis, z. B. „Firma neu“). */
  text?: string;
  aenderungen?: { feld: string; alt?: string; neu?: string }[];
}
export interface VorschauAntwort {
  ok: true;
  zeilen: VorschauZeile[];
  /** Kennung genau dieser Vorschau (Stand des Bestands) — Übernehmen nur damit, sonst 409. */
  basis: string;
  hinweise: string[];
}
/** Zählung je Status (Kopf der Vorschau). */
export function vorschauZahlen(zeilen: readonly VorschauZeile[]): Record<VorschauStatus, number> {
  const z: Record<VorschauStatus, number> = { neu: 0, geaendert: 0, gleich: 0, fehler: 0, uebersprungen: 0, entfaellt: 0 };
  for (const x of zeilen) z[x.status]++;
  return z;
}
/** Welche Zeilen tragen eine Wirkung (und sind deshalb abwählbar)? */
export const wirkt = (s: VorschauStatus): boolean => s === 'neu' || s === 'geaendert' || s === 'entfaellt';
