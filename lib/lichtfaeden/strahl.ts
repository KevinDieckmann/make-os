// ─── Lichtfäden · der ruhige Strahl der Planung (04.10.2026 abends, rein) ────
// Kevin (04.10.): „Oben die Symbole genial, aber das sieht schon zu spacig aus.“ — „Gliedere einfach mehr. Die einzelnen
// Farben von den einzelnen Themen müssen immer gebündelt sein und zusammenlaufen. Es darf nur ausgeschlagen werden, wenn
// etwas Unvorhergesehenes kommt oder etwas schiefgelaufen ist. Ziel ist, dass alle Linien immer ruhig laufen — nach Ziel,
// Plan und Meilenstein.“ (UMBAU_ABEND_0410.md › 6; Gegenbewegung zu Strahl v3.1 „deutlich größer, kräftige Wellen“.)
//
// Bauprinzip (ersetzt das verflochtene Band von v3):
//   · Je Bündel (Space, Thema, Ziel, Meilenstein — je nach Ebene) EIN Strang auf EIGENER Spur: wenige feine Fäden eng
//     beieinander, glatt. Die Spuren liegen sauber übereinander (Reihenfolge = Rang) und laufen ab HEUTE zum rechten Rand
//     zusammen — dorthin, wo das große Ziel liegt.
//   · Ruhelage = im Plan. Ausschlagen darf ein Strang NUR an einer echten Abweichung (lib/lichtfaeden/abweichung.ts:
//     Meilenstein überfällig, Frist gerissen, Ziel gekippt, später Kapazität überlastet …); Stärke = Größe der Abweichung,
//     nie Zufall/Rauschen. Er bricht nach außen aus seiner Spur aus und fächert dort leicht auf.
//   · Ruhig: keine Partikel, kein Glühen, kein Netz, kein Licht am HEUTE-Punkt (eine ruhige senkrechte Linie), keine
//     additive Mischung (sonst entstehen rosa/violette Mischtöne, wo Farben sich kreuzen).
// ALLE Parameter des Strahls stehen in `STRAHL` (eine Stelle; Wächter tests/strahl-ruhig.test.ts hält die Höchstwerte fest).
// Diese Datei ist rein und gehört der App (die Websites tragen seit „Klar 2“, 07.10., keine Lichtfäden mehr).

/** Die Parameter des Planungs-Strahls — EINE Stelle (DESIGN_STANDARD.md › Lichtfäden, LICHTFAEDEN.md › Strahl ruhig). */
export const STRAHL = {
  /** Höhe des Bandes (px): Rechner · Handy — v3.1 hatte 300 · 220. */
  band: { rechner: 200, handy: 150 },
  /** Fäden je Strang ∝ √Last (Blatt-Ebene: je Strang 1 … 3), höchstens so viele je Leinwand — v3 hatte 5 … 44 und 300 · 120. */
  faeden: { min: 3, max: 8, strangMin: 1, strangMax: 3, deckel: { rechner: 56, handy: 32 } },
  /** Deckkraft eines Fadens bei Helligkeit 1 (normal gemischt) und Strichbreite (px). */
  deckkraft: 0.17,
  strich: 0.6,
  /** Leiser Kern entlang der Leitkurve: Deckkraft und Breite (px). */
  kern: { deckkraft: 0.05, breite: { rechner: 4, handy: 3 } },
  /** Halbe Breite eines ruhigen Strangs (px) — dünn ∝ √Fäden; mehr gibt es nur an einer Abweichung. */
  strang: { min: 1.2, max: 3.2 },
  /** Spuren: höchster Abstand zweier Spuren (px), Innenrand oben/unten (px). */
  spur: { abstand: { rechner: 22, handy: 16 }, rand: 6 },
  /** Zusammenlauf: Spurabstand am rechten Ende (Anteil des vollen) — ab HEUTE laufen die Stränge zum Ziel zusammen. */
  zusammen: 0.35,
  /** Ausschlag bei Abweichung 1 (px): Rechner · Handy; der Strang fächert dort bis auf `faecher` × seine Breite auf. */
  ausschlag: { rechner: 34, handy: 24, faecher: 2.4 },
  /** Fließen der Fäden im Strang (Anteil von LICHTFAEDEN.tempo) — sehr ruhig, bleibt innerhalb der Strangbreite. */
  tempo: 0.5,
  /** Helligkeit: Vergangenheit gedämpft, Zukunft wird leiser, Last hebt sanft (kein Leuchten am HEUTE-Punkt). */
  hell: { vergangen: 0.42, fern: 0.25, last: 0.25 },
  /** HEUTE: eine ruhige senkrechte Linie (Deckkraft, Breite px). */
  heute: { deckkraft: 0.42, breite: 1 },
} as const;

/** Was die Geometrie eines Strangs von der Bühne braucht. */
export interface StrahlBuehne {
  breite: number;
  bandOben: number;
  bandHoehe: number;
  heuteX: number | null;
  /** Liegt HEUTE links vor dem Fenster (ganzes Fenster Zukunft) oder rechts dahinter (ganzes Fenster Vergangenheit)? */
  heuteSeite?: 'links' | 'rechts';
  handy: boolean;
}

/** Glatte Stufe 0 → 1 zwischen a und b (wie band.ts `glatt`, hier ohne Import, damit die Datei für sich steht). */
function stufe(v: number, a: number, b: number): number {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a || 1)));
  return t * t * (3 - 2 * t);
}

/** Wie viel Ausschlag die Bühne höchstens braucht (px) — Platz oben/unten im Band. */
export const ausschlagMax = (handy: boolean): number => (handy ? STRAHL.ausschlag.handy : STRAHL.ausschlag.rechner);

/** Abstand zweier Spuren (px): so groß wie möglich bis `spur.abstand`, aber so, dass alle Spuren + Ausschlag ins Band passen. */
export function spurAbstand(anzahl: number, b: Pick<StrahlBuehne, 'bandHoehe' | 'handy'>): number {
  if (anzahl <= 1) return 0;
  const frei = b.bandHoehe - 2 * (ausschlagMax(b.handy) + STRAHL.strang.max + STRAHL.spur.rand);
  const max = b.handy ? STRAHL.spur.abstand.handy : STRAHL.spur.abstand.rechner;
  return Math.max(4, Math.min(max, frei / (anzahl - 1)));
}

/** Zusammenlauf an der Stelle x: 1 (volle Spuren) bis HEUTE, dann sanft bis `zusammen` am rechten Rand. */
export function zusammenlauf(x: number, b: Pick<StrahlBuehne, 'breite' | 'heuteX' | 'heuteSeite'>): number {
  const ab = b.heuteX != null ? b.heuteX : b.heuteSeite === 'links' ? 0 : null;
  if (ab == null || ab >= b.breite) return 1;
  return 1 - (1 - STRAHL.zusammen) * stufe(x, ab, b.breite);
}

/** Versatz der Spur i von n gegenüber der Bandmitte (px) an der Stelle x — ohne Ausschlag. Spur 0 liegt oben. */
export function spurVersatz(i: number, anzahl: number, x: number, b: StrahlBuehne): number {
  return (i - (anzahl - 1) / 2) * spurAbstand(anzahl, b) * zusammenlauf(x, b);
}

/** Richtung, in die eine Spur ausbricht: nach außen (obere Hälfte nach oben = −1, untere nach unten = +1, Mitte nach oben). */
export const ausbruchRichtung = (i: number, anzahl: number): -1 | 1 => (i - (anzahl - 1) / 2 > 0 ? 1 : -1);

/** Halbe Breite eines Strangs (px): dünn ∝ √(Fäden / meiste Fäden), an einer Abweichung bis × `faecher`. */
export function strangBreite(faeden: number, meisteFaeden: number, abweichung: number): number {
  const anteil = Math.sqrt(Math.max(0, faeden) / Math.max(1, meisteFaeden));
  const ruhig = STRAHL.strang.min + (STRAHL.strang.max - STRAHL.strang.min) * Math.min(1, anteil);
  return ruhig * (1 + (STRAHL.ausschlag.faecher - 1) * Math.max(0, Math.min(1, abweichung)));
}

/**
 * Die Leitkurve eines Strangs (y in px) an der Stelle x: Spur (mit Zusammenlauf) + Ausschlag nach außen, im Band gehalten.
 * `abweichung` = Wert der Abweichung an dieser Stelle (0 … 1, `wocheWeich` über `Buendel.ausschlag`). Ohne Abweichung ist
 * die Kurve glatt — sie hängt dann nur von der Spur und dem sanften Zusammenlauf ab (Wächter).
 */
export function strangMitte(i: number, anzahl: number, x: number, b: StrahlBuehne, abweichung: number, breite: number): number {
  const mitte = b.bandOben + b.bandHoehe / 2;
  const a = Math.max(0, Math.min(1, abweichung));
  const y = mitte + spurVersatz(i, anzahl, x, b) + ausbruchRichtung(i, anzahl) * a * ausschlagMax(b.handy);
  const oben = b.bandOben + breite + 2, unten = b.bandOben + b.bandHoehe - breite - 2;
  return Math.max(oben, Math.min(unten, y));
}

/**
 * Wert einer Wochenreihe an der Stelle x — WEICH zwischen den Wochenmitten (Smoothstep statt linear): ein Ausschlag steigt
 * sanft an und klingt sanft ab, nie als Zacke. Woche 0 beginnt `wochenVersatz` Tage vor dem Fensteranfang.
 */
export function wocheWeich(reihe: readonly number[], x: number, d: { breite: number; tage: number; wochenVersatz: number }): number {
  const n = reihe.length;
  if (!n) return 0;
  const tag = (x / Math.max(1, d.breite)) * d.tage + d.wochenVersatz;
  const p = Math.max(0, Math.min(n - 1, tag / 7 - 0.5));
  const i = Math.floor(p), j = Math.min(n - 1, i + 1), t = p - i;
  const g = t * t * (3 - 2 * t);
  return reihe[i] * (1 - g) + reihe[j] * g;
}

/**
 * Helligkeit an einer Stelle: Vergangenheit gedämpft, ab HEUTE voll, die ferne Zukunft wird leiser; Last hebt sanft.
 * Kein Lichtschnitt am HEUTE-Punkt (v3 hatte ihn) — der Faden leuchtet nirgends auf.
 */
export function strahlHell(x: number, b: Pick<StrahlBuehne, 'heuteX' | 'heuteSeite'>, dichte: number): number {
  const H = STRAHL.hell;
  let zeit: number;
  if (b.heuteX == null) zeit = b.heuteSeite === 'rechts' ? H.vergangen : 1;
  else zeit = (H.vergangen + (1 - H.vergangen) * stufe(x, b.heuteX - 24, b.heuteX + 2)) * (1 - H.fern * stufe(x, b.heuteX + 20, b.heuteX + 600));
  return zeit * (1 - H.last + H.last * Math.max(0, Math.min(1, dichte)));
}
