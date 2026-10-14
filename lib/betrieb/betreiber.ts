// ─── MAKE OS — Ist das die Betreiber-Instanz? (14.10., Abnahme A2 — rein, client-sicher) ───────────────────────────────────
// Die unabhängige Abnahme (14.10.) fand auf „Heute“ einer fremden Instanz als erste Karte eine Betreiber-Anleitung (Git, Docker, .env,
// Repo-Dateien). Kevin 14.10.: Betreiber-Einrichtungsschritte „nur in eurer Instanz“. EINE Regel, an EINER Stelle:
//
//   1. Demo-Riegel: in einer Demo-Instanz (MAKE_OS_DEMO=1) IMMER aus — auch mit Marke, auch mit MAKE_OS_BETREIBER=an.
//   2. `MAKE_OS_BETREIBER=an|aus` übersteuert (Betreiber setzt es am Server; jeder andere Wert zählt nicht).
//   3. Sonst eine vorhandene Altbestand-Marke — ohne neuen Server-Schritt für die laufende Instanz:
//      · die Marke des Neustarts `system/neustart.json` (lib/onboarding-neustart.ts, geschrieben vom Umzug lib/neustart/umzug-lauf.mjs —
//        nur die DATEI, nie die Einstellung MAKE_OS_EINRICHTUNG=neustart, die auch eine Kunden-Instanz tragen darf), oder
//      · ein Altbestand: der Haupt-Inhaber wurde vor ALTBESTAND_BIS angelegt (die gewachsene Instanz, lib/onboarding-status.ts).
//   Eine neue oder fremde Instanz hat keins von beiden → keine Betreiber-Instanz.
//
// Was daran hängt: Schritte der Einrichtung mit `betreiber: true` (lib/make-one/onboarding-data.ts) gibt es nur hier — sonst weder sichtbar
// noch gezählt noch abhakbar; Texte für Verbindungen u. ä. nennen außerhalb nur „das richtet der Betreiber eurer Instanz ein“. Server-Lesestelle:
// lib/betrieb/betreiber-server.ts `istBetreiberInstanz`. Wächter: tests/oberflaeche-neutral.test.ts.

/** Bis zu diesem Tag stand persönlicher Altbestand im Code (Übernahme lib/altbestand/*): ein Inhaber-Konto davor hat einen. */
export const ALTBESTAND_BIS = '2026-10-09';

export interface BetreiberQuellen {
  /** MAKE_OS_DEMO=1 */
  demo: boolean;
  /** Wert von MAKE_OS_BETREIBER (roh). */
  umgebung: string | undefined;
  /** Die Datei der Neustart-Marke liegt im Datenordner. */
  neustartMarke: boolean;
  /** Der Haupt-Inhaber wurde vor ALTBESTAND_BIS angelegt. */
  altbestand: boolean;
}

/** DIE Regel (rein). */
export function betreiberAus(q: BetreiberQuellen): boolean {
  if (q.demo) return false;
  const u = (q.umgebung ?? '').trim().toLowerCase();
  if (u === 'an') return true;
  if (u === 'aus') return false;
  return q.neustartMarke || q.altbestand;
}

/** Altbestand aus dem Anlege-Zeitpunkt des Haupt-Inhabers (ISO bzw. Tag). Rein. */
export const altbestandAus = (angelegt: unknown): boolean => typeof angelegt === 'string' && angelegt.slice(0, 10) < ALTBESTAND_BIS && /^\d{4}-\d{2}-\d{2}/.test(angelegt);

/**
 * Der neutrale Satz für alles, was nur der Betreiber am Server einrichtet (Schlüssel, Anwendungen bei Anbietern, Nummern) — ohne Dateinamen,
 * Ports oder Befehle. Für alle Instanzen gleich.
 */
export const BETREIBER_RICHTET_EIN = 'Diese Verbindung richtet die Inhaberin bzw. der Betreiber eurer Instanz ein.';
/**
 * Betreiber-Wissen in einem Text: Repo-Dokumente (`UPDATES.md` …), Umgebungsdateien, Server-Pfade, Befehle, lokale Ports, Skripte im Repo.
 * Dieselbe Regel für den Wächter (tests/oberflaeche-neutral.test.ts) und für Texte, die eine fremde Instanz neutral bekommt.
 */
export const BETREIBER_WISSEN = /\b[A-Z][A-Z0-9_]+\.md\b|\.env\b|\/srv\/|\bssh\s|\bopenssl\b|\bnano\s|\bgit\s+[a-z]|\bdocker\s+[a-z]|localhost:|\b(?:deploy|scripts)\/[\w.-]+/;
/** Ein Satz für eine fremde Instanz: mit Betreiber-Wissen → „das richtet der Betreiber ein“, sonst unverändert. Rein. */
export const betreiberNeutral = (text: string): string => (BETREIBER_WISSEN.test(text) ? 'Das richtet die Inhaberin bzw. der Betreiber eurer Instanz am Server ein.' : text);

/** Kein KI-Schlüssel auf der Instanz — derselbe Satz für Empfang, Brain, Recherche, Fokus und die übrigen Wege. */
export const KI_SCHLUESSEL_FEHLT = 'Die KI ist auf dieser Instanz noch nicht eingerichtet — den Schlüssel hinterlegt die Inhaberin bzw. der Betreiber eurer Instanz.';
