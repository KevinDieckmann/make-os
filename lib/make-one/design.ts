// ─── MAKE OS — Design-System ────────────────────────────────────────────────
// Härtung 06.09. nach Kevins UX-Analyse (Vorbilder Whoop & N26).
//
// Vorher: 34 Schriftgrößen, 37 verstreute Farbwerte, 19 Eckenradien,
// 182 Abstandswerte — kein System, sondern 3.360 Einzelentscheidungen.
//
// Ab hier gilt: wer eine Größe, Farbe oder einen Abstand braucht, nimmt sie
// HIER. Neue Werte kommen nur dazu, wenn eine echte Anforderung fehlt — nicht
// weil „13,5 px hier besser aussieht".
//
// Die Farben sind bewusst dieselben wie bisher (THEME) — nur ihre BEDEUTUNG
// ist jetzt festgelegt. Der wichtigste Satz des ganzen Systems:
// FARBE BEDEUTET ZUSTAND, NICHT DEKORATION.

/** Sechs Stufen. Mehr braucht kein Bildschirm. */
export const TYP = {
  /** Die eine Heldenzahl je Bildschirm — der Score-Ring, der Kontostand. */
  held: 56,
  /** Kennzahl in einer Kachel. */
  zahl: 26,
  /** Überschrift, Bereichsname. */
  titel: 20,
  /** Fließtext. */
  body: 15,
  /** Bedienelemente, Listenzeilen. */
  bedien: 13,
  /** Beschriftung — GROSSBUCHSTABEN mit Sperrung. Nie kleiner. */
  mikro: 11,
} as const;

/** Vier Rollen im Text — mehr Abstufungen verwässern nur. */
export const SCHRIFT = {
  // Die Variablen setzt app/layout.tsx über next/font — dadurch werden die
  // Schriften mitgeliefert statt nachgeladen (kein Schriftsprung beim Öffnen).
  display: 'var(--schrift-display),-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif',
  text: 'var(--schrift-text),-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif',
  mono: 'ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace',
} as const;

/**
 * Zehn Farben. Getrennt nach Rolle:
 *   Flächen · Text · Interaktion · Zustand
 * Firmenfarben (Ventures, KEMARIS, …) sind KEINE Systemfarben — sie leben in
 * organisation-data.ts und dürfen nur als kleiner Erkennungspunkt auftreten,
 * nie als Fläche.
 */
export const FARBE = {
  grund: '#0B0E10',
  flaeche: '#14181B',
  flaecheHoch: '#191E21',
  linie: '#232A2D',
  linieWeich: '#1A2023',

  ink: '#E8ECEA',
  inkDim: '#A2ADB0',
  inkLeise: '#6E7A7D',

  /** Interaktiv: Links, aktive Schalter, Fokus. */
  aktiv: '#58D9CD',
  aktivSanft: 'rgba(88,217,205,.14)',
  /** Schlaf — eine Farbe je Kennzahl (23.09., nach Whoop). */
  lavendel: '#A79BFF',

  /** Zustand — und NUR Zustand. */
  gut: '#21B5AA',
  achtung: '#D9A441',
  kritisch: '#E8695E',
} as const;

/** Sieben Abstände auf dem 4-px-Raster. */
export const ABSTAND = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** Zwei Radien: Bauteil und Behälter. Dazu der Pillenradius für Chips. */
export const RADIUS = { bauteil: 8, behaelter: 14, pille: 999 } as const;

/** Kleinstes Klickziel. Darunter trifft man auf einem Laptop nicht sicher. */
export const ZIEL_MIN = 32;

/**
 * Zustandsfarbe zu einem Wert von 0–100.
 * Eine Wahrheit für Score, Säulen, Kennzahlen — vorher stand diese Schwelle
 * an fünf Stellen leicht unterschiedlich im Code.
 */
export function zustandFarbe(wert: number | null | undefined): string {
  if (wert == null) return FARBE.inkLeise;
  if (wert >= 60) return FARBE.gut;
  if (wert >= 35) return FARBE.achtung;
  return FARBE.kritisch;
}

/** Beschriftung: GROSSBUCHSTABEN, gesperrt, leise. Der einzige Ort für 11 px. */
export const MIKRO = {
  fontFamily: SCHRIFT.text,
  fontSize: TYP.mikro,
  fontWeight: 600,
  letterSpacing: '.1em',
  textTransform: 'uppercase' as const,
  color: FARBE.inkLeise,
};

/** Zahl mit gleicher Ziffernbreite — überall, wo Zahlen untereinanderstehen. */
export const ZIFFERN = {
  fontFamily: SCHRIFT.display,
  fontVariantNumeric: 'tabular-nums' as const,
  letterSpacing: '-.02em',
};
