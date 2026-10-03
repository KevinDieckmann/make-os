// ─── Lichtfäden — das Zeitband der Planung (Canvas 2D, ohne Framework, 03.10.2026) ─
// Kevin (03.10.): Vorbild ein Zeitstrahl aus hunderten feinen, leuchtenden Linien, die an aktiven Stellen auffächern —
// „hier bei der Planung wäre geil, wenn das so reinkommt mit mehreren Elektro-Fäden“.
// Je Ziel ein Bündel in seiner Farbe, alle zu EINEM Band verflochten (band.ts `buendelMitte`); Spreizung und Leuchten je
// Woche aus `faedenDichte` (dichte.ts). Vergangenheit gedämpft, HEUTE als leuchtender Schnitt, Zukunft klar. Darüber
// die Verbinder: feine Linie von jeder Markierung (DOM-Knopf, components/os/Zeitstrahl.tsx) hinunter zu ihrem Bündel.
// Hover/Fokus einer Markierung hebt ihr Bündel hervor, die anderen dimmen.
// Die React-Hülle ist components/os/planung/LichtBand.tsx; die Leinwand ist `aria-hidden`, das Textäquivalent steht dort.

import { LICHTFAEDEN, buendelMitte, fadenSaaten, glatt, spreizung as spreizungBei, textSaat, wertBei, MITTE, type FadenSaat } from './band';
import { leinwand, rgb, starteLauf, zeichneBuendel, type Lauf, type Probe } from './zeichnen';

export interface ZeitbandBuendel {
  id: string;
  /** #RRGGBB */
  farbe: string;
  /** Dichte je Woche 0 … 1 (gleich breite Felder über die ganze Breite). */
  dichte: readonly number[];
}
export interface ZeitbandVerbinder {
  /** Lage der Markierung (CSS-Pixel in der Fläche). */
  x: number;
  /** Unterkante der Markierung — null = nur ein Punkt auf dem Bündel (gebündelte „+n“). */
  yOben: number | null;
  buendel: string;
  farbe: string;
  leise: boolean;
}
export interface ZeitbandDaten {
  breite: number;
  hoehe: number;
  bandOben: number;
  bandHoehe: number;
  buendel: readonly ZeitbandBuendel[];
  /** HEUTE in Pixeln (null = nicht im Fenster); links davon gedämpft. */
  heuteX: number | null;
  /** Lage der Vergangenheit, wenn HEUTE außerhalb liegt: 'links' = alles Zukunft, 'rechts' = alles Vergangenheit. */
  heuteSeite?: 'links' | 'rechts';
  heuteFarbe: string;
  verbinder: readonly ZeitbandVerbinder[];
  /** Hervorgehobenes Bündel (Hover/Fokus) — die anderen dimmen. */
  hervor: string | null;
  handy: boolean;
}

/**
 * Maße des Lichtband-Zeitstrahls: Reihenhöhe der Markierungen, Höhe des Knopfs (Tippziel), Höhe des sichtbaren Chips,
 * Reihen bis zum Bündeln, Bandhöhe — Rechner · Handy (Handy: Knopf 44 px). Tests: keine Überlappung der Markierungen.
 */
export const ZEITBAND_MASSE = {
  rechner: { reihe: 30, knopf: 28, chip: 24, maxReihen: 5, band: 140 },
  handy: { reihe: 46, knopf: 44, chip: 28, maxReihen: 3, band: 104 },
} as const;
export const zeitbandMasse = (breite: number) => (breite < 520 ? ZEITBAND_MASSE.handy : ZEITBAND_MASSE.rechner);

/** Helligkeit an einer Stelle: Vergangenheit gedämpft, HEUTE leuchtet, Dichte hebt. */
export function hellBei(x: number, d: ZeitbandDaten, dichte: number): number {
  let zeit: number;
  if (d.heuteX == null) zeit = d.heuteSeite === 'rechts' ? 0.32 : 1;
  else zeit = 0.32 + 0.68 * glatt(x, d.heuteX - 26, d.heuteX + 4);
  const schnitt = d.heuteX == null ? 0 : Math.exp(-(((x - d.heuteX) / 14) ** 2)) * 0.4;
  return zeit * (0.55 + 0.85 * dichte) + schnitt;
}

export interface Zeitband {
  setze(d: ZeitbandDaten): void;
  stop(): void;
  lauf: Lauf;
}

/** Das Zeitband an eine Leinwand hängen. `beobachte` = das Element, dessen Sichtbarkeit den Lauf steuert. */
export function zeitband(canvas: HTMLCanvasElement, beobachte: Element, ruhig: boolean): Zeitband {
  const ctx = canvas.getContext('2d');
  let d: ZeitbandDaten | null = null;
  const saatCache = new Map<string, FadenSaat[]>();
  const saaten = (id: string, n: number) => {
    const k = `${id}|${n}`;
    let s = saatCache.get(k);
    if (!s) { s = fadenSaaten(n, textSaat(id)); saatCache.set(k, s); }
    return s;
  };

  function zeichne(t: number) {
    if (!ctx || !d || d.breite < 2) return;
    const dpr = leinwand(canvas, d.breite, d.hoehe);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, d.breite, d.hoehe);
    const halb = d.bandHoehe / 2, mitte = d.bandOben + halb;
    const schritt = d.handy ? LICHTFAEDEN.schritt.handy : LICHTFAEDEN.schritt.rechner;
    const nFaeden = d.handy ? LICHTFAEDEN.faeden.handy : LICHTFAEDEN.faeden.rechner;

    // Mittellinie — fein, über die ganze Breite.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    ctx.fillRect(0, mitte - 0.5, d.breite, 1);

    ctx.globalCompositeOperation = 'lighter';
    const n = d.buendel.length;
    const mitten = new Map<string, (x: number) => number>();
    d.buendel.forEach((b, i) => {
      const faktor = d!.hervor == null ? 1 : d!.hervor === b.id ? 1.45 : 0.16;
      const dichteAn = (x: number) => wertBei(b.dichte, x / d!.breite);
      const mitteAn = (x: number) => mitte + halb * buendelMitte(i, n, x, t, dichteAn(x));
      mitten.set(b.id, mitteAn);
      const proben: Probe[] = [];
      for (let x = -schritt; x <= d!.breite + schritt; x += schritt) {
        const dx = dichteAn(x);
        proben.push({ x, y: mitteAn(x), nx: 0, ny: 1, s: x, spreizung: spreizungBei(dx, halb), hell: hellBei(x, d!, dx) * faktor });
      }
      // Schein entlang der Leitkurve (breit, sehr leise), dann die Fäden.
      zeichneBuendel(ctx, proben, { farbe: b.farbe, saaten: [MITTE], deckkraft: 0.05, strich: d!.handy ? 8 : 12 }, t);
      zeichneBuendel(ctx, proben, { farbe: b.farbe, saaten: saaten(b.id, nFaeden) }, t);
    });

    // HEUTE: leuchtender Schnitt durchs Band.
    if (d.heuteX != null) {
      const [r, g, bl] = rgb(d.heuteFarbe);
      const x = d.heuteX;
      const glanz = ctx.createRadialGradient(x, mitte, 0, x, mitte, halb * 1.1);
      glanz.addColorStop(0, `rgba(${r},${g},${bl},.16)`);
      glanz.addColorStop(1, `rgba(${r},${g},${bl},0)`);
      ctx.fillStyle = glanz;
      ctx.fillRect(x - halb * 1.1, mitte - halb * 1.1, halb * 2.2, halb * 2.2);
      const linie = ctx.createLinearGradient(0, d.bandOben - 8, 0, d.bandOben + d.bandHoehe + 8);
      linie.addColorStop(0, `rgba(${r},${g},${bl},0)`);
      linie.addColorStop(0.5, `rgba(${r},${g},${bl},.85)`);
      linie.addColorStop(1, `rgba(${r},${g},${bl},0)`);
      ctx.fillStyle = linie;
      ctx.fillRect(x - 0.75, d.bandOben - 8, 1.5, d.bandHoehe + 16);
    }

    // Verbinder: Markierung → ihr Bündel (an dieser Stelle, mitfließend), mit leuchtendem Knoten.
    ctx.globalCompositeOperation = 'source-over';
    for (const v of d.verbinder) {
      const an = mitten.get(v.buendel) ?? mitten.values().next().value;
      const cy = an ? an(v.x) : mitte;
      const gedimmt = d.hervor != null && d.hervor !== v.buendel;
      const a = (v.leise ? 0.5 : 1) * (gedimmt ? 0.25 : 1);
      const [r, g, bl] = rgb(v.farbe);
      if (v.yOben != null && cy > v.yOben) {
        const lin = ctx.createLinearGradient(0, v.yOben, 0, cy);
        lin.addColorStop(0, `rgba(${r},${g},${bl},${(0.5 * a).toFixed(3)})`);
        lin.addColorStop(1, `rgba(${r},${g},${bl},${(0.18 * a).toFixed(3)})`);
        ctx.fillStyle = lin;
        ctx.fillRect(v.x - 0.5, v.yOben, 1, cy - v.yOben);
      }
      ctx.fillStyle = `rgba(${r},${g},${bl},${(0.22 * a).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(v.x, cy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${r},${g},${bl},${(0.95 * a).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(v.x, cy, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  const lauf = starteLauf({ beobachte, zeichne, ruhig });
  return {
    setze(neu) { d = neu; lauf.einmal(); },
    stop() { lauf.stop(); },
    lauf,
  };
}
