// ─── Prozesse — Bedingungen „nur wenn …“ (Etappe B1, 21.10.; ANALYSE_100.md Punkte 31, 53) ──────────────────────────────────────────────────────
// EINE Stelle für Bedingungen über Felder: am Auslöser („nur wenn …“ — unpassende Ereignisse erzeugen keinen Lauf und keine Kosten), an der Raute nach
// Regel (erster passender Zweig: ja, sonst nein) und am Warten auf ein Ereignis. Reine Auswertung über ein flaches Datenobjekt (`daten['deal.stufe']`) —
// nie Code, nie ein Ausdruck aus dem Browser. Welche Felder es gibt, sagt der Aufrufer (`erlaubt`); die Werte liefert der Motor (Etappe C) aus Ereignis
// und Fall (`ereignisDaten`, lib/prozesse/ausloeser.ts). Rein und client-sicher; Tests: tests/prozesse-ausloeser.test.ts.

import { BEDINGUNG_OPS, FELD_KENNUNG, PROZESS_GRENZEN, PROZESS_TEXT, type Bedingung, type BedingungOp, type Befund, type Verknuepfung } from './definition';

/** Wie die Vergleiche heißen (Werkstatt, Vorlesen). */
export const BEDINGUNG_NAME: Readonly<Record<BedingungOp, string>> = {
  gleich: 'ist', ungleich: 'ist nicht', enthaelt: 'enthält', beginnt: 'beginnt mit', groesser: 'größer als', kleiner: 'kleiner als',
  gesetzt: 'ist gesetzt', leer: 'ist leer', 'einer-von': 'ist einer von',
};
/** Vergleiche ohne Wert. */
const OHNE_WERT: ReadonlySet<BedingungOp> = new Set(['gesetzt', 'leer']);

type O = Record<string, unknown>;
const istObj = (v: unknown): v is O => !!v && typeof v === 'object' && !Array.isArray(v);

/** Text-Vergleichsform: getrimmt, klein, NFC (Umlaute bleiben — dieselbe Regel für Ereignis-Werte und Eingaben). */
const norm = (v: unknown): string => String(v ?? '').normalize('NFC').trim().toLowerCase();
const leerWert = (v: unknown): boolean => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
const zahl = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && /^-?\d+([.,]\d+)?$/.test(v.trim())) return Number(v.trim().replace(',', '.'));
  return null;
};

/** Eine Bedingung gegen die Daten auswerten (rein). Ein fehlendes Feld ist „leer“ — und nie „gleich“ irgendetwas. */
export function bedingungTrifft(b: Bedingung, daten: Readonly<Record<string, unknown>>): boolean {
  const v = daten[b.feld];
  switch (b.op) {
    case 'gesetzt': return !leerWert(v);
    case 'leer': return leerWert(v);
    case 'gleich': return !leerWert(v) && (Array.isArray(v) ? v.some(x => norm(x) === norm(b.wert)) : norm(v) === norm(b.wert));
    case 'ungleich': return leerWert(v) || (Array.isArray(v) ? !v.some(x => norm(x) === norm(b.wert)) : norm(v) !== norm(b.wert));
    case 'enthaelt': return !leerWert(v) && (Array.isArray(v) ? v.some(x => norm(x) === norm(b.wert)) : norm(v).includes(norm(b.wert)));
    case 'beginnt': return !leerWert(v) && norm(v).startsWith(norm(b.wert));
    case 'groesser': case 'kleiner': {
      const a = zahl(v), w = zahl(b.wert);
      if (a !== null && w !== null) return b.op === 'groesser' ? a > w : a < w;
      // Tage (YYYY-MM-DD) vergleichen als Text (lexikografisch = zeitlich).
      if (typeof v === 'string' && typeof b.wert === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && /^\d{4}-\d{2}-\d{2}/.test(b.wert)) return b.op === 'groesser' ? v > b.wert : v < b.wert;
      return false;
    }
    case 'einer-von': {
      const liste = Array.isArray(b.wert) ? b.wert.map(norm) : [];
      return !leerWert(v) && (Array.isArray(v) ? v.some(x => liste.includes(norm(x))) : liste.includes(norm(v)));
    }
  }
}

/** Mehrere Bedingungen: `und` (Vorgabe) — alle; `oder` — mindestens eine. Ohne Bedingung: trifft immer. */
export function bedingungenTreffen(liste: readonly Bedingung[] | undefined, daten: Readonly<Record<string, unknown>>, v: Verknuepfung = 'und'): boolean {
  if (!liste?.length) return true;
  return v === 'oder' ? liste.some(b => bedingungTrifft(b, daten)) : liste.every(b => bedingungTrifft(b, daten));
}

/** Eine Bedingung als Satz (Werkstatt, Liste, Vorlesen): „deal.stufe ist gewonnen“. */
export function bedingungText(b: Bedingung, feldName: (id: string) => string = id => id): string {
  const w = OHNE_WERT.has(b.op) ? '' : Array.isArray(b.wert) ? ` ${b.wert.join(', ')}` : b.wert === undefined ? '' : ` ${String(b.wert)}`;
  return `${feldName(b.feld)} ${BEDINGUNG_NAME[b.op]}${w}`;
}

/**
 * Bedingungen aus der Eingabe säubern und prüfen (rein): nur bekannte Felder (`erlaubt`; ohne Liste jede Feld-Kennung), bekannte Vergleiche, Wert passend,
 * höchstens `PROZESS_GRENZEN.bedingungen` (darüber ein Befund — nie gekürzt). Liefert die sauberen Bedingungen und die Befunde (fehler).
 */
export function bedingungenAus(roh: unknown, erlaubt?: readonly string[] | null, wo = 'Bedingung'): { bedingungen: Bedingung[]; befunde: Befund[] } {
  const befunde: Befund[] = [];
  if (roh === undefined || roh === null) return { bedingungen: [], befunde };
  if (!Array.isArray(roh)) return { bedingungen: [], befunde: [{ stufe: 'fehler', text: `${wo}: als Liste.` }] };
  if (roh.length > PROZESS_GRENZEN.bedingungen) befunde.push({ stufe: 'fehler', text: `${wo}: höchstens ${PROZESS_GRENZEN.bedingungen} Bedingungen (jetzt ${roh.length}).` });
  const bedingungen: Bedingung[] = [];
  roh.forEach((x, i) => {
    const nr = `${wo} ${i + 1}`;
    if (!istObj(x)) { befunde.push({ stufe: 'fehler', text: `${nr}: unlesbar.` }); return; }
    const feld = typeof x.feld === 'string' ? x.feld.trim() : '';
    if (!FELD_KENNUNG.test(feld)) { befunde.push({ stufe: 'fehler', text: `${nr}: Feld fehlt.` }); return; }
    if (erlaubt && !erlaubt.includes(feld)) { befunde.push({ stufe: 'fehler', text: `${nr}: das Feld „${feld}“ gibt es hier nicht.` }); return; }
    const op = (BEDINGUNG_OPS as readonly string[]).includes(x.op as string) ? x.op as BedingungOp : null;
    if (!op) { befunde.push({ stufe: 'fehler', text: `${nr}: unbekannter Vergleich.` }); return; }
    if (OHNE_WERT.has(op)) { bedingungen.push({ feld, op }); return; }
    const w = x.wert;
    if (op === 'einer-von') {
      const l = Array.isArray(w) ? w.filter((y): y is string => typeof y === 'string' && !!y.trim()).map(y => y.trim()) : [];
      if (!l.length) { befunde.push({ stufe: 'fehler', text: `${nr}: mindestens ein Wert.` }); return; }
      if (l.length > PROZESS_GRENZEN.optionen) { befunde.push({ stufe: 'fehler', text: `${nr}: höchstens ${PROZESS_GRENZEN.optionen} Werte.` }); return; }
      if (l.some(y => y.length > PROZESS_TEXT.feldText)) { befunde.push({ stufe: 'fehler', text: `${nr}: ein Wert ist zu lang.` }); return; }
      bedingungen.push({ feld, op, wert: l });
      return;
    }
    if (typeof w === 'number' && Number.isFinite(w)) { bedingungen.push({ feld, op, wert: w }); return; }
    if (typeof w === 'boolean') { bedingungen.push({ feld, op, wert: w }); return; }
    if (typeof w === 'string' && w.trim()) {
      if (w.length > PROZESS_TEXT.feldText) { befunde.push({ stufe: 'fehler', text: `${nr}: der Wert ist zu lang (höchstens ${PROZESS_TEXT.feldText} Zeichen).` }); return; }
      if ((op === 'groesser' || op === 'kleiner') && zahl(w) === null && !/^\d{4}-\d{2}-\d{2}$/.test(w.trim())) { befunde.push({ stufe: 'fehler', text: `${nr}: „größer/kleiner“ vergleicht Zahlen oder Tage.` }); return; }
      bedingungen.push({ feld, op, wert: w.trim() });
      return;
    }
    befunde.push({ stufe: 'fehler', text: `${nr}: Wert fehlt.` });
  });
  return { bedingungen, befunde };
}

export const verknuepfungAus = (v: unknown): Verknuepfung | undefined => (v === 'oder' ? 'oder' : v === 'und' ? 'und' : undefined);
