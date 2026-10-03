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
  flaeche: '#161B1F',
  flaecheHoch: '#1B2126',
  linie: '#1F262A',
  linieWeich: '#1A2023',

  ink: '#E8ECEA',
  inkDim: '#A2ADB0',
  inkLeise: '#86918F', // 03.10.: von #6E7A7D angehoben — ≥ 5:1 auf Grund und Fläche (WCAG AA), auch bei Hallenlicht lesbar

  /** Interaktiv: Links, aktive Schalter, Fokus. */
  aktiv: '#58D9CD',
  aktivSanft: 'rgba(88,217,205,.14)',
  /** Schlaf — eine Farbe je Kennzahl (23.09., nach Whoop). */
  lavendel: '#A79BFF',

  /** Zustand — und NUR Zustand. Seit 24.09. leuchtend (= LEUCHT), damit alte und neue Seiten dasselbe sagen. */
  gut: '#3DE28B',
  achtung: '#FFC93C',
  kritisch: '#FF5C5C',
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

/**
 * Leuchtfarben (24.09., nach Kevins Ansage „das sieht tot aus"): Whoop lebt
 * von kräftigen, leuchtenden Kennzahlfarben auf dunklem Grund. FARBE bleibt
 * für Flächen und Text; die Kennzahlen der schlanken Seiten nehmen DIESE.
 * Weiter gilt: Farbe bedeutet Zustand — grün/gelb/rot — plus eine feste Farbe
 * je Kennzahl (Schlaf, Puls, Geld, Business, Planung, Beziehung).
 */
export const LEUCHT = {
  gut: '#3DE28B',
  achtung: '#FFC93C',
  kritisch: '#FF5C5C',
  schlaf: '#8F86FF',
  puls: '#4FC3F7',
  geld: '#58D9CD',
  business: '#FF9F43',
  planung: '#4FC3F7',
  beziehung: '#FF7EB6',
  agenten: '#C77DFF',
} as const;

/**
 * Tiefe Akzente (25.09., Kevin: „nicht diese Neonfarben, sondern diese schönen
 * tiefen Akzente — genau so muss das überall durchgezogen werden“). Vorbild
 * ist das Kürzel in der Kontakt-Akte: Die Farbe trägt die Aussage, aber nie
 * grell. EIN Rezept für alles, was groß ist (Ringe, Balken, Kürzel, Karten):
 *   fläche  — Akzent 9 % auf dem Grund (die getönte Scheibe)
 *   rand    — Akzent ~55 %, halbtransparent statt Vollfarbe (Ring, Balken, Kontur)
 *   schein  — weich und nach innen gezogen, kein Leuchtkranz
 *   schrift — der Akzent selbst (wie die Initialen)
 * Kleine Punkte und Chips bleiben farbig, aber ohne Leuchtkranz.
 * Farben als 6-stelliges Hex übergeben (#RRGGBB) — Alpha wird angehängt.
 */
export const TIEF = {
  flaeche: (f: string) => `${f}18`,
  rand: (f: string) => `${f}8C`,
  /** Balken/Ring-Füllung, etwas kräftiger als der Rand. */
  fuellung: (f: string) => `${f}A6`,
  schein: (f: string, px = 24) => `0 0 ${px}px -${Math.round(px / 4)}px ${f}`,
  /** Für SVG-Filter (drop-shadow kennt keinen negativen Rand): leise statt grell. */
  svgSchein: (f: string, px = 10) => `drop-shadow(0 0 ${px}px ${f}4D)`,
  /** Der tiefere Ton einer Akzentfarbe — für Verläufe (Ring, Balken): Farbe mit Tiefe statt flach oder grell. */
  tiefer: (f: string, anteil = 55) => `color-mix(in srgb, ${f} ${anteil}%, #0B0E10)`,
  /** Balken-Füllung: vom tiefen Ton in die volle Farbe. */
  verlauf: (f: string) => `linear-gradient(90deg, color-mix(in srgb, ${f} 55%, #0B0E10), ${f})`,
  /** Hauptknopf: getönt, farbige Kontur und Schrift — statt Vollfarbe mit Leuchtschatten. */
  knopf: (f: string) => ({ background: `${f}24`, border: `1px solid ${f}80`, color: f }),
} as const;

/** Zustandsfarbe in Leuchtstärke — dieselben Schwellen wie zustandFarbe. */
export function leuchtFarbe(wert: number | null | undefined): string {
  if (wert == null) return FARBE.inkLeise;
  if (wert >= 60) return LEUCHT.gut;
  if (wert >= 35) return LEUCHT.achtung;
  return LEUCHT.kritisch;
}


// ─── Der Standard (03.10., DESIGN_STANDARD.md) ──────────────────────────────
// Kevin: „Bei Netzwerken ist das Ganze edler gebaut — den Standard will ich überall.“ Was Netzwerken edel macht, steht hier als
// Token; gebaut wird es in components/os/ui. Neue Werte nur hier, nie als Literal in einer Seite.

/** Tippziele: Hauptaktion 48, alles andere am Handy mindestens 44, am Rechner 40 (dichte Listen bleiben lesbar). */
export const ZIEL = { haupt: 48, handy: 44, rechner: 40 } as const;

/** Ecken: Eingabe, Knopf, flache Fläche, gehobene Karte. Pillen bleiben RADIUS.pille. */
export const ECKE = { eingabe: 12, knopf: 14, flach: 16, karte: 20 } as const;

/** Ränder: Haarlinie (Trenner), Rand einer flachen Fläche, kräftiger Rand (Eingabe, Chip), gestrichelt (Leerzustand). */
export const RAND = {
  haar: 'rgba(255,255,255,.07)',
  flaeche: 'rgba(255,255,255,.08)',
  stark: 'rgba(255,255,255,.14)',
  leer: '1px dashed rgba(255,255,255,.14)',
} as const;

/**
 * Flächen-Hierarchie in drei Stufen: Grund → Fläche (flach, ein Weißhauch) → gehobene Karte (Verlauf, Lichtkante, Tiefenschatten).
 * `getoent(farbe)` = die Bereichsfarbe als Hauch in der Fläche (wie „Heute bei“ in Netzwerken): Verlauf, farbiger Rand, weicher Schein.
 */
export const FLAECHE_STIL = {
  eingabe: { background: 'rgba(255,255,255,.05)', border: `1px solid ${RAND.stark}` },
  flach: { background: 'rgba(255,255,255,.04)', border: `1px solid ${RAND.flaeche}` },
  leise: { background: 'rgba(255,255,255,.025)', border: `1px solid ${RAND.haar}` },
  gehoben: { background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)' },
  getoent: (f: string) => ({
    background: `linear-gradient(150deg, ${f}26 0%, ${f}0D 46%, rgba(255,255,255,.02) 100%)`,
    border: `1px solid ${TIEF.rand(f)}`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,.07), 0 16px 36px -22px ${f}`,
  }),
} as const;

/** Bedeutung eines Hinweises: gut · achtung · kritisch · info (Bereichsakzent) · neutral. Farbe bedeutet Zustand. */
export type Bedeutung = 'gut' | 'achtung' | 'kritisch' | 'info' | 'neutral';
export const BEDEUTUNG_FARBE: Record<Bedeutung, string> = { gut: LEUCHT.gut, achtung: LEUCHT.achtung, kritisch: LEUCHT.kritisch, info: FARBE.aktiv, neutral: FARBE.inkDim };
