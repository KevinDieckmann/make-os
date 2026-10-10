// ─── Gesundheit im Alltag — Einstellungen je Person (09.10.2026, rein, getestet) ────────────────────────────────────────
// Schlaf-Hilfe, Tages-Check und Essens-Orientierung brauchen Einstellungen, die vorher niemand hatte: Aufstehzeit (heute und Ziel)
// mit Schrittweite, eigenes Schlafziel, Abend-Erinnerung (an/aus, Vorlauf, auch aufs Handy), welche Check-Fragen, Orientierung an/aus,
// und welche eigenen Routinen aus einer Ergänzungs-Vorlage stammen. Plattform-Regel: alles ist eine Einstellung JE PERSON — nie fest
// für eine Person im Code; ohne Eintrag gelten die Vorgaben unten (die Schlaf-Hilfe rechnet dann noch nichts).
//
// Bestand `gesundheit-alltag` (Erstkonto) bzw. `gesundheit-alltag--<person>` (speicherFuer), gelesen und geschrieben NUR über
// /api/gesundheit/alltag von der Person selbst (wie das Körper-Profil: auch bei geteiltem Gesundheitsbereich nie für andere).
// Der Riegel der Abend-Erinnerung (`erinnert`) liegt im selben Bestand, zählt aber NICHT zum Stand der Einstellungen (sonst gäbe
// jede Erinnerung einen 409 beim nächsten Speichern) — ihn setzt nur der Takt (lib/gesundheit/alltag-server.ts).
//
// Rein (Server UND Browser): Form, Säuberung beim Lesen (nie kürzen), Schritte. Über einer Grenze 413, ungültig 400 — ein
// ungültiger Schritt lässt den ganzen Stapel liegen.

import { CHECK_FRAGEN, CHECK_MAX, istCheckFrage } from './tages-check';
import { aufstehenStufe, istUhr } from './schlaf';
import { istErgaenzung, type ErgaenzungId } from '@/lib/ernaehrung/orientierung';

export const ALLTAG_BASIS = 'gesundheit-alltag';

export interface SchlafEinstellung {
  /** Aufstehzeit zu Beginn der Stufen („HH:MM“). */
  aufstehen?: string;
  /** Ziel-Aufstehzeit („HH:MM“) — die Schlaf-Hilfe verschiebt schrittweise dorthin. */
  aufstehenZiel?: string;
  /** Minuten je Stufe (5–60). */
  schrittMin: number;
  /** Tage je Stufe (1–14). */
  schrittTage: number;
  /** Tag, ab dem die Stufen zählen — setzt NUR der Schreibweg (beim Ändern von Start, Ziel oder Schrittweite). */
  ab?: string;
  /** Eigenes Schlafziel in Stunden (4–12) — gilt, wenn WHOOP keinen Schlafbedarf liefert. */
  schlafziel?: number;
  /** Abend-Erinnerung zur Schlafenszeit (Vorgabe aus). */
  erinnerung: boolean;
  /** Vorlauf der Erinnerung (Minuten, 0–180). */
  vorlaufMin: number;
  /** Auch aufs Handy über den ZOE-Kanal (WhatsApp/Telegram) — immer neutral, Vorgabe aus. */
  handy: boolean;
}

export interface AlltagStand {
  v: 1;
  schlaf: SchlafEinstellung;
  /** Gewählte Check-Fragen (fehlt = Vorgabe aus lib/gesundheit/tages-check.ts). */
  check?: { fragen: string[] };
  /** Essens-Orientierung nach WHOOP an/aus (Vorgabe an — sie zeigt nur etwas, wenn es WHOOP-Werte gibt). */
  essen: { orientierung: boolean };
  /** Eigene Routinen aus einer Ergänzungs-Vorlage: Routine-Kennung → Vorlage. (Nie in der Kennung der Routine — die sähe der Partner.) */
  ergaenzungen: Record<string, ErgaenzungId>;
  /** Riegel der Abend-Erinnerung: Tag der letzten Erinnerung. Setzt nur der Takt, zählt nicht zum Stand. */
  erinnert?: string;
  /** Zeitpunkt der letzten Änderung der Einstellungen (setzt der Server). */
  geaendert?: string;
}

export const SCHLAF_VORGABE: SchlafEinstellung = { schrittMin: 15, schrittTage: 3, erinnerung: false, vorlaufMin: 30, handy: false };
export const ALLTAG_GRENZEN = { schrittMin: [5, 60], schrittTage: [1, 14], schlafziel: [4, 12], vorlaufMin: [0, 180], ergaenzungen: 20, ops: 20 } as const;

export function leererAlltag(): AlltagStand {
  return { v: 1, schlaf: { ...SCHLAF_VORGABE }, essen: { orientierung: true }, ergaenzungen: {} };
}

/** Fehler eines Schritts: 400 ungültig, 413 über einer Grenze. */
export class AlltagFehler extends Error {
  constructor(readonly status: 400 | 413, nachricht: string) { super(nachricht); }
}

const obj = (x: unknown): Record<string, unknown> | null => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : null);
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const ROUTINE_ID = /^[A-Za-z0-9_-]{1,60}$/;
const inGrenze = (n: unknown, [min, max]: readonly [number, number]): n is number => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;

/** Gelesenen Bestand in saubere Form bringen (nie kürzen; Unbekanntes fällt weg, Fehlendes bekommt die Vorgabe). */
export function alltagSaeubern(roh: unknown): AlltagStand {
  const o = obj(roh);
  const a = leererAlltag();
  if (!o) return a;
  const s = obj(o.schlaf) ?? {};
  if (istUhr(s.aufstehen)) a.schlaf.aufstehen = s.aufstehen;
  if (istUhr(s.aufstehenZiel)) a.schlaf.aufstehenZiel = s.aufstehenZiel;
  if (inGrenze(s.schrittMin, ALLTAG_GRENZEN.schrittMin)) a.schlaf.schrittMin = Math.round(s.schrittMin);
  if (inGrenze(s.schrittTage, ALLTAG_GRENZEN.schrittTage)) a.schlaf.schrittTage = Math.round(s.schrittTage);
  if (typeof s.ab === 'string' && TAG.test(s.ab)) a.schlaf.ab = s.ab;
  if (inGrenze(s.schlafziel, ALLTAG_GRENZEN.schlafziel)) a.schlaf.schlafziel = Math.round(s.schlafziel * 4) / 4;
  a.schlaf.erinnerung = s.erinnerung === true;
  if (inGrenze(s.vorlaufMin, ALLTAG_GRENZEN.vorlaufMin)) a.schlaf.vorlaufMin = Math.round(s.vorlaufMin);
  a.schlaf.handy = s.handy === true;
  const c = obj(o.check);
  if (c && Array.isArray(c.fragen)) a.check = { fragen: CHECK_FRAGEN.map(f => f.id).filter(id => (c.fragen as unknown[]).includes(id)) };
  const e = obj(o.essen);
  if (e && e.orientierung === false) a.essen.orientierung = false;
  for (const [k, v] of Object.entries(obj(o.ergaenzungen) ?? {})) if (ROUTINE_ID.test(k) && istErgaenzung(v)) a.ergaenzungen[k] = v;
  if (typeof o.erinnert === 'string' && TAG.test(o.erinnert)) a.erinnert = o.erinnert;
  if (typeof o.geaendert === 'string') a.geaendert = o.geaendert;
  return a;
}

/** Was zum Stand gehört: die Einstellungen ohne Riegel und Zeitstempel. */
export function alltagEinstellungen(a: AlltagStand): Omit<AlltagStand, 'erinnert' | 'geaendert'> {
  const { erinnert: _e, geaendert: _g, ...rest } = a;
  return rest;
}

// ── Schritte ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export type SchlafFelder = Partial<{ aufstehen: string | null; aufstehenZiel: string | null; schrittMin: number; schrittTage: number; schlafziel: number | null; erinnerung: boolean; vorlaufMin: number; handy: boolean }>;
export type AlltagOp =
  | { op: 'schlaf'; felder: SchlafFelder }
  | { op: 'check'; fragen: string[] }
  | { op: 'essen'; orientierung: boolean }
  | { op: 'ergaenzung'; routine: string; vorlage: ErgaenzungId | null };

/** Nur ausschalten (Erinnerung, Handy, Orientierung) bzw. alle Fragen ab? Das geht auch ohne Einwilligung (a) — es hört auf, verarbeitet nichts. */
export function nurAusschalten(ops: unknown): boolean {
  if (!Array.isArray(ops) || !ops.length) return false;
  return ops.every(o => {
    const x = obj(o);
    if (!x) return false;
    if (x.op === 'essen') return x.orientierung === false;
    if (x.op === 'check') return Array.isArray(x.fragen) && x.fragen.length === 0;
    if (x.op === 'schlaf') { const f = obj(x.felder); return !!f && Object.keys(f).length > 0 && Object.entries(f).every(([k, v]) => (k === 'erinnerung' || k === 'handy') && v === false); }
    return false;
  });
}

const SCHLAF_FELDER = ['aufstehen', 'aufstehenZiel', 'schrittMin', 'schrittTage', 'schlafziel', 'erinnerung', 'vorlaufMin', 'handy'] as const;

function schlafAnwenden(alt: SchlafEinstellung, felderRoh: unknown, heute: string): SchlafEinstellung {
  const f = obj(felderRoh);
  if (!f || !Object.keys(f).length) throw new AlltagFehler(400, 'schlaf: felder fehlen.');
  for (const k of Object.keys(f)) if (!(SCHLAF_FELDER as readonly string[]).includes(k)) throw new AlltagFehler(400, `schlaf: unbekanntes Feld „${k.slice(0, 30)}“.`);
  const neu: SchlafEinstellung = { ...alt };
  const uhr = (k: 'aufstehen' | 'aufstehenZiel') => {
    if (!(k in f)) return;
    const v = f[k];
    if (v === null || v === '') { delete neu[k]; return; }
    if (!istUhr(v)) throw new AlltagFehler(400, `${k === 'aufstehen' ? 'Aufstehzeit' : 'Ziel'}: bitte als „HH:MM“.`);
    neu[k] = v;
  };
  uhr('aufstehen'); uhr('aufstehenZiel');
  const zahlFeld = (k: 'schrittMin' | 'schrittTage' | 'vorlaufMin', name: string) => {
    if (!(k in f)) return;
    const g = ALLTAG_GRENZEN[k];
    if (!inGrenze(f[k], g)) throw new AlltagFehler(400, `${name}: ${g[0]}–${g[1]}.`);
    neu[k] = Math.round(f[k] as number);
  };
  zahlFeld('schrittMin', 'Schrittweite (Minuten)'); zahlFeld('schrittTage', 'Tage je Stufe'); zahlFeld('vorlaufMin', 'Vorlauf (Minuten)');
  if ('schlafziel' in f) {
    if (f.schlafziel === null || f.schlafziel === '') delete neu.schlafziel;
    else if (!inGrenze(f.schlafziel, ALLTAG_GRENZEN.schlafziel)) throw new AlltagFehler(400, `Schlafziel: ${ALLTAG_GRENZEN.schlafziel[0]}–${ALLTAG_GRENZEN.schlafziel[1]} Stunden.`);
    else neu.schlafziel = Math.round((f.schlafziel as number) * 4) / 4;
  }
  for (const k of ['erinnerung', 'handy'] as const) {
    if (!(k in f)) continue;
    if (typeof f[k] !== 'boolean') throw new AlltagFehler(400, `${k}: an oder aus (true/false).`);
    neu[k] = f[k] as boolean;
  }
  // Stufen neu ansetzen, wenn sich Start, Ziel oder Schrittweite ändern: ausdrücklich neue Aufstehzeit → ab heute von dort; sonst
  // von der Stufe, auf der die Person HEUTE steht (nie ein Sprung zurück an den alten Start).
  const geaendert = (['aufstehen', 'aufstehenZiel', 'schrittMin', 'schrittTage'] as const).some(k => neu[k] !== alt[k]);
  if (geaendert) {
    if (!('aufstehen' in f) && alt.aufstehen) {
      const stufe = aufstehenStufe(alt, heute);
      if (stufe) neu.aufstehen = stufe.aufstehen;
    }
    if (neu.aufstehen) neu.ab = heute; else delete neu.ab;
  }
  return neu;
}

/** Schritte auf die Einstellungen anwenden (rein). Wirft `AlltagFehler` — dann bleibt alles, wie es war. */
export function alltagAnwenden(alt: AlltagStand, ops: unknown, heute: string): AlltagStand {
  if (!Array.isArray(ops) || !ops.length) throw new AlltagFehler(400, 'ops (Liste von Schritten) fehlt.');
  if (ops.length > ALLTAG_GRENZEN.ops) throw new AlltagFehler(413, `Abgelehnt: höchstens ${ALLTAG_GRENZEN.ops} Schritte je Aufruf.`);
  let a: AlltagStand = { ...alt, schlaf: { ...alt.schlaf }, essen: { ...alt.essen }, ergaenzungen: { ...alt.ergaenzungen }, ...(alt.check ? { check: { fragen: [...alt.check.fragen] } } : {}) };
  for (const roh of ops) {
    const o = obj(roh);
    if (!o) throw new AlltagFehler(400, 'Schritt ungültig.');
    if (o.op === 'schlaf') a = { ...a, schlaf: schlafAnwenden(a.schlaf, o.felder, heute) };
    else if (o.op === 'check') {
      if (!Array.isArray(o.fragen)) throw new AlltagFehler(400, 'check: fragen (Liste) fehlt.');
      const unbekannt = o.fragen.find(id => !istCheckFrage(id));
      if (unbekannt !== undefined) throw new AlltagFehler(400, `check: unbekannte Frage „${String(unbekannt).slice(0, 40)}“.`);
      const ids = CHECK_FRAGEN.map(f => f.id).filter(id => (o.fragen as unknown[]).includes(id));
      if (ids.length > CHECK_MAX) throw new AlltagFehler(413, `Abgelehnt: höchstens ${CHECK_MAX} Fragen gleichzeitig — damit der Check in 10 Sekunden geht.`);
      a = { ...a, check: { fragen: ids } };
    } else if (o.op === 'essen') {
      if (typeof o.orientierung !== 'boolean') throw new AlltagFehler(400, 'essen: orientierung an oder aus.');
      a = { ...a, essen: { orientierung: o.orientierung } };
    } else if (o.op === 'ergaenzung') {
      if (typeof o.routine !== 'string' || !ROUTINE_ID.test(o.routine)) throw new AlltagFehler(400, 'ergaenzung: routine (Kennung) fehlt.');
      const erg = { ...a.ergaenzungen };
      if (o.vorlage === null) delete erg[o.routine];
      else if (istErgaenzung(o.vorlage)) erg[o.routine] = o.vorlage;
      else throw new AlltagFehler(400, 'ergaenzung: unbekannte Vorlage.');
      if (Object.keys(erg).length > ALLTAG_GRENZEN.ergaenzungen) throw new AlltagFehler(413, `Abgelehnt: höchstens ${ALLTAG_GRENZEN.ergaenzungen} Ergänzungs-Routinen.`);
      a = { ...a, ergaenzungen: erg };
    } else throw new AlltagFehler(400, `Unbekannter Schritt „${String(o.op).slice(0, 30)}“.`);
  }
  return a;
}
