// ─── Agenten-Seite: Maße der drei Spalten (09.10., Paket 2) ───────────────────────────────────────────────────────────
// Die Seite selbst nimmt Farben, Schrift, Ecken, Ränder und Tippziele NUR aus lib/make-one/design.ts (DESIGN_STANDARD.md);
// was es dort nicht gibt — die Breite der Spalten und die Größe der Kugeln — steht HIER an einer Stelle, nie verstreut.

import { ZIEL } from '@/lib/make-one/design';

/** Spaltenbreiten ab `SPALTEN_AB` (1.180 px): Team links, Hintergrund rechts, die Mitte nimmt den Rest. */
export const SPALTE = {
  team: 272,
  rechts: 340,
  /** Team-Spalte bei mittlerer Breite (720–1.180 px, zwei Spalten). */
  teamMittel: 236,
  /** Mitte mindestens so breit, sonst bricht der Chat. */
  mitteMin: 420,
} as const;

/** Kürzel-Kugeln: in Listen, im Kopf eines Heads, ZOE im Kopf der Mitte. */
export const KUGEL_GROESSE = { klein: 28, liste: 36, kopf: 52 } as const;

/** Einrückung der Mitarbeiter-Threads unter ihrem Head (links, „wie Ordner“). */
export const EINZUG = 22;

/**
 * Höhe der Handy-Leiste unten (components/os/Leiste.tsx: 6 + 48 + 6 px + 1 px Rand) — die Reiter Gespräch · Team · Läuft
 * stehen direkt darüber, das Eingabefeld darüber.
 */
export const HANDY_LEISTE = 61;
/** Höhe der Reiterleiste Gespräch · Team · Läuft am Handy (Tippziel 44 + Rand). */
export const HANDY_REITER = ZIEL.handy + 12;

/** Lesebreite einer Nachricht in der Mitte (Zeichen je Zeile bleiben lesbar). */
export const NACHRICHT_MAX = 720;
/** Höhe des Chat-Feldes (Zeilen). */
export const FELD_ZEILEN = 3;
