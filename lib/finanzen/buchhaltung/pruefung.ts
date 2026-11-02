// ─── Buchhaltung — Prüfmodus „Zu prüfen“ (02.11., rein: Server UND Browser) ───────────────────────────────────────────────────────────
// Kevin 02.11.: Die Buchungen werden vorbereitet (Paket, Regeln), ein Mensch gibt frei. Eine Buchung ist „zu prüfen“, solange
//   • ihre Prüfung offen ist (`pruefung.status === 'offen'` — mit Vorschlag und ggf. einer Frage), oder
//   • sie „Bewirtung“ ist und Anlass ODER Teilnehmer fehlen (Hinweis, keine Steuerberatung).
// „Passt“ setzt die vorgeschlagene Kategorie fest (von Hand, keine Regel überschreibt sie mehr) und bestätigt; wer und wann stempelt NUR der
// Server (lib/finanzen/buchhaltung/teil.ts). Die Ansicht gruppiert nach Gegenseite.

import { suchNorm } from '@/lib/text/such-norm';
import { KAT, ohneSteuerzeichen } from './kategorien';
import type { BhBuchung } from './arbeitsliste';

export interface PruefFrage { text: string; optionen?: string[] }
export interface Pruefung {
  status: 'offen' | 'bestaetigt';
  /** Vorgeschlagene Kategorie (Paket, Regel) — erst „Passt“ macht sie zur Kategorie. */
  vorschlag?: string;
  frage?: PruefFrage;
  /** Antwort auf die Frage (Chip oder eigener Text). */
  antwort?: string;
  /** Speichername der Person — nur der Server. */
  geprueftVon?: string;
  /** ISO — nur der Server. */
  geprueftAm?: string;
}
export interface Bewirtung { anlass?: string; teilnehmer?: string }
/** Beleg-Hinweis (anders als `beleg` = Kennung eines übernommenen Belegs `b-…`): gibt es einen Beleg, und wo liegt er? */
export interface BelegHinweis { vorhanden: boolean; quelle?: string; datei?: string }

export const FRAGE_MAX = 300, OPTION_MAX = 80, OPTIONEN_MAX = 8, ANTWORT_MAX = 500, BEWIRTUNG_MAX = 300, BELEG_TEXT_MAX = 200;

const text = (v: unknown, max: number): string | undefined | null => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') return null;
  const t = ohneSteuerzeichen(v.normalize('NFC').replace(/\r?\n/g, ' ')).trim();
  if (t.length > max) return null;
  return t || undefined;
};

export type Saeuberung<T> = { ok: true; wert: T | undefined } | { ok: false; status: 400 | 413; fehler: string };
const zuLang = (was: string, max: number) => ({ ok: false as const, status: 413 as const, fehler: `${was} ist zu lang (höchstens ${max} Zeichen) — gekürzt wird nie, nichts gespeichert.` });
const laenge = (v: unknown, max: number) => typeof v === 'string' && ohneSteuerzeichen(v).trim().length > max;

export function frageSauber(roh: unknown): Saeuberung<PruefFrage> {
  if (roh === undefined || roh === null) return { ok: true, wert: undefined };
  if (typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, status: 400, fehler: 'Die Frage hat die falsche Form — nichts gespeichert.' };
  const o = roh as Record<string, unknown>;
  if (laenge(o.text, FRAGE_MAX)) return zuLang('Die Frage', FRAGE_MAX);
  const t = text(o.text, FRAGE_MAX);
  if (!t) return { ok: false, status: 400, fehler: 'Die Frage braucht einen Text — nichts gespeichert.' };
  let optionen: string[] | undefined;
  if (o.optionen !== undefined) {
    if (!Array.isArray(o.optionen)) return { ok: false, status: 400, fehler: 'Die Antwort-Möglichkeiten müssen eine Liste sein — nichts gespeichert.' };
    if (o.optionen.length > OPTIONEN_MAX) return zuLang(`Die Liste der Antwort-Möglichkeiten (höchstens ${OPTIONEN_MAX})`, OPTIONEN_MAX);
    optionen = [];
    for (const x of o.optionen) {
      if (laenge(x, OPTION_MAX)) return zuLang('Eine Antwort-Möglichkeit', OPTION_MAX);
      const s = text(x, OPTION_MAX);
      if (!s) return { ok: false, status: 400, fehler: 'Eine Antwort-Möglichkeit ist leer — nichts gespeichert.' };
      if (!optionen.includes(s)) optionen.push(s);
    }
    if (!optionen.length) optionen = undefined;
  }
  return { ok: true, wert: { text: t, ...(optionen ? { optionen } : {}) } };
}

export function bewirtungSauber(roh: unknown): Saeuberung<Bewirtung> {
  if (roh === undefined || roh === null) return { ok: true, wert: undefined };
  if (typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, status: 400, fehler: 'Die Bewirtungs-Angaben haben die falsche Form — nichts gespeichert.' };
  const o = roh as Record<string, unknown>;
  if (laenge(o.anlass, BEWIRTUNG_MAX)) return zuLang('Der Anlass', BEWIRTUNG_MAX);
  if (laenge(o.teilnehmer, BEWIRTUNG_MAX)) return zuLang('Die Teilnehmer', BEWIRTUNG_MAX);
  const anlass = text(o.anlass, BEWIRTUNG_MAX), teilnehmer = text(o.teilnehmer, BEWIRTUNG_MAX);
  if (anlass === null || teilnehmer === null) return { ok: false, status: 400, fehler: 'Anlass und Teilnehmer müssen Text sein — nichts gespeichert.' };
  return { ok: true, wert: anlass || teilnehmer ? { ...(anlass ? { anlass } : {}), ...(teilnehmer ? { teilnehmer } : {}) } : undefined };
}

export function belegHinweisSauber(roh: unknown): Saeuberung<BelegHinweis> {
  if (roh === undefined || roh === null) return { ok: true, wert: undefined };
  if (typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, status: 400, fehler: 'Der Beleg-Hinweis hat die falsche Form — nichts gespeichert.' };
  const o = roh as Record<string, unknown>;
  if (typeof o.vorhanden !== 'boolean') return { ok: false, status: 400, fehler: 'Beim Beleg fehlt „vorhanden“ (ja/nein) — nichts gespeichert.' };
  if (laenge(o.quelle, BELEG_TEXT_MAX)) return zuLang('Die Beleg-Quelle', BELEG_TEXT_MAX);
  if (laenge(o.datei, BELEG_TEXT_MAX)) return zuLang('Der Beleg-Dateiname', BELEG_TEXT_MAX);
  const quelle = text(o.quelle, BELEG_TEXT_MAX), datei = text(o.datei, BELEG_TEXT_MAX);
  if (quelle === null || datei === null) return { ok: false, status: 400, fehler: 'Quelle und Datei des Belegs müssen Text sein — nichts gespeichert.' };
  return { ok: true, wert: { vorhanden: o.vorhanden, ...(quelle ? { quelle } : {}), ...(datei ? { datei } : {}) } };
}

/** Gespeicherte Prüfung lesen (Form; Unbekanntes fällt weg). */
export function pruefungLesen(roh: unknown): Pruefung | undefined {
  if (!roh || typeof roh !== 'object') return undefined;
  const o = roh as Record<string, unknown>;
  if (o.status !== 'offen' && o.status !== 'bestaetigt') return undefined;
  const f = frageSauber(o.frage);
  const s = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
  const vorschlag = s(o.vorschlag, 60), antwort = s(o.antwort, ANTWORT_MAX), von = s(o.geprueftVon, 80), am = s(o.geprueftAm, 40);
  return {
    status: o.status,
    ...(vorschlag ? { vorschlag } : {}), ...(f.ok && f.wert ? { frage: f.wert } : {}), ...(antwort ? { antwort } : {}),
    ...(von ? { geprueftVon: von } : {}), ...(am ? { geprueftAm: am } : {}),
  };
}

/** Fehlen bei einer Bewirtung Anlass oder Teilnehmer? */
export const bewirtungFehlt = (b: Pick<BhBuchung, 'kategorie'> & { bewirtung?: Bewirtung; pruefung?: Pruefung }): boolean =>
  (b.kategorie === KAT.bewirtung || (b.pruefung?.status === 'offen' && b.pruefung.vorschlag === KAT.bewirtung)) && !(b.bewirtung?.anlass && b.bewirtung?.teilnehmer);

export type PruefBuchung = BhBuchung;

/** Ist die Buchung „zu prüfen“? */
export const zuPruefen = (b: PruefBuchung): boolean => b.pruefung?.status === 'offen' || bewirtungFehlt(b);

/** Hinweise einer Buchung in „Zu prüfen“ (kurze Sätze für die Ansicht). */
export function pruefHinweise(b: PruefBuchung): string[] {
  const h: string[] = [];
  if (bewirtungFehlt(b)) h.push('Anlass/Teilnehmer fehlen');
  if (b.pruefung?.status === 'offen' && b.pruefung.frage && !b.pruefung.antwort) h.push('Frage offen');
  if (b.belegHinweis && !b.belegHinweis.vorhanden) h.push('ohne Beleg');
  return h;
}

/** Darf „Alle ohne Frage bestätigen“ diese Buchung bestätigen? (offen, Vorschlag oder Kategorie da, keine offene Frage, Bewirtung vollständig) */
export const ohneFrageBestaetigbar = (b: PruefBuchung): boolean =>
  b.pruefung?.status === 'offen' && !(b.pruefung.frage && !b.pruefung.antwort) && !bewirtungFehlt(b);

export interface PruefGruppe { schluessel: string; gegenseite: string; buchungen: PruefBuchung[]; summeCent: number }
/** „Zu prüfen“, gruppiert nach Gegenseite (normalisiert), größte Gruppe zuerst; in der Gruppe neueste zuerst. */
export function pruefGruppen(alle: readonly PruefBuchung[]): PruefGruppe[] {
  const m = new Map<string, PruefGruppe>();
  for (const b of alle) {
    if (!zuPruefen(b)) continue;
    const k = suchNorm(b.wer).trim() || '—';
    const g = m.get(k) ?? { schluessel: k, gegenseite: b.wer || '—', buchungen: [], summeCent: 0 };
    g.buchungen.push(b); g.summeCent += Math.round(Number(b.betrag) * 100);
    m.set(k, g);
  }
  return Array.from(m.values()).map(g => ({ ...g, buchungen: g.buchungen.sort((a, b) => b.datum.localeCompare(a.datum) || a.id.localeCompare(b.id)) }))
    .sort((a, b) => b.buchungen.length - a.buchungen.length || a.gegenseite.localeCompare(b.gegenseite, 'de'));
}
