// ─── Agenten-Seite: Maße der drei Spalten (09.10., Paket 2) ───────────────────────────────────────────────────────────
// Die Seite selbst nimmt Farben, Schrift, Ecken, Ränder und Tippziele NUR aus lib/make-one/design.ts (DESIGN_STANDARD.md);
// was es dort nicht gibt — die Breite der Spalten und die Größe der Kugeln — steht HIER an einer Stelle, nie verstreut.

import { ABSTAND, ZIEL } from '@/lib/make-one/design';

/**
 * Spaltenbreiten (Aufräumen 09.10., Claude-Muster): Liste links, Hintergrund rechts, die Mitte nimmt den Rest — das Gespräch steht darin
 * höchstens `lese` breit und mittig (sind beide Seiten zu, keine 2.000-px-Zeile). Ob die Seiten NEBEN dem Gespräch oder als Schublade
 * DARÜBER stehen, entscheidet der gemessene Platz (klappen.ts `lageAus`), nicht nur die Fensterbreite — die Leiste der App nimmt mit.
 */
export const SPALTE = {
  team: 248,
  rechts: 320,
  /** Mitte mindestens so breit, sonst bricht der Chat. */
  mitteMin: 420,
  /** Lesebreite des Gesprächs (Kopfzeile, Verlauf, Feld). */
  lese: 760,
  /** Breite einer Schublade (Liste bzw. Hintergrund über dem Gespräch). */
  schublade: 340,
} as const;
/** Abstand zwischen Seitenfeld und Gespräch. */
export const SPALTE_ABSTAND = ABSTAND.xl;
/** Ab diesem Platz stehen Liste, Gespräch und Hintergrund nebeneinander. */
export const DREI_SPALTEN_AB = SPALTE.team + SPALTE.mitteMin + SPALTE.rechts + 2 * SPALTE_ABSTAND;
/** Ab diesem Platz steht die Liste neben dem Gespräch (der Hintergrund als Schublade). */
export const ZWEI_SPALTEN_AB = SPALTE.team + SPALTE.mitteMin + SPALTE_ABSTAND;
/** So viele Threads zeigt ein aufgeklappter Head in der Liste — der Rest hinter „+ n weitere“ (nichts unerreichbar). */
export const LISTE_THREADS = 6;

/**
 * EINE Spalte, die nie breiter wird als ihr Platz (Rundgang 09.10., Handy 390 px: ein langer Knopftext im Überblick schob die Karte
 * über den Rand). Ein Grid ohne Spaltenangabe wächst auf die Mindestbreite seines breitesten Inhalts — jedes Grid der ZOE-Mitte nimmt
 * deshalb diese Spalte (`minmax(0, 1fr)`), Wächter in tests/rundgang-funde.test.ts.
 */
export const SPALTE_EINS = 'minmax(0, 1fr)';
/** Ein Stapel untereinander, der die Breite seines Platzes nie überschreitet. */
export const einSpaltig = (gap: number) => ({ display: 'grid', gridTemplateColumns: SPALTE_EINS, gap, minWidth: 0 }) as const;

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
