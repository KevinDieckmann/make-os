// ─── Lichtfäden v2 — das Fädenband (Canvas 2D, ohne Framework, 03.10.2026) ──
// EIN Zeichner für alle Ebenen (Planung Jahr, Ziel, Meilenstein, Fokus). Daten rechnet der Zeichner nie — er bekommt fertige
// Dichten und Ausschläge (Regel aus DESIGN_STANDARD.md › Lichtfäden).
//
// Strahl ruhig (04.10. abends, Kevin: „Gliedere einfach mehr … Es darf nur ausgeschlagen werden, wenn etwas Unvorhergesehenes
// kommt oder etwas schiefgelaufen ist. Ziel ist, dass alle Linien immer ruhig laufen — nach Ziel, Plan und Meilenstein.“):
//   · Je Bündel EIN Strang auf eigener Spur (lib/lichtfaeden/strahl.ts): wenige feine Fäden eng beieinander, glatt; ab HEUTE
//     laufen die Spuren zum rechten Rand zusammen (zum großen Ziel).
//   · Ausschlag NUR an Abweichungen (`BandBuendel.ausschlag`, aus lib/lichtfaeden/abweichung.ts): der Strang bricht nach außen
//     aus seiner Spur und fächert dort leicht auf — sanft an- und abklingend, Stärke = Größe der Abweichung.
//   · Ruhig: normal gemischt (keine additiven Mischtöne), keine Partikel, kein Glühen, kein Netz, keine Hilfs-/Mittellinien,
//     kein Licht am HEUTE-Punkt (eine ruhige senkrechte Linie). Vergangenheit gedämpft, ferne Zukunft leiser.
//   · Aufbau: beim Öffnen wachsen die Stränge von links ein (ohne leuchtende Spitze); Verbinder, HEUTE und Engstellen erscheinen,
//     wenn die Front sie erreicht. Die Markierungen oben laufen mit ihrem Stiel in ihren Strang (Kevin: „so kann man vorplanen“).
//   · Aufklappen (eine Ebene tiefer): die Kinder entspringen dem angeklickten Strang und fächern in ~0,7 s auf ihre Spuren;
//     zurück fließen sie zusammen. „Bewegung reduzieren“ = Standbild ohne Übergang und ohne Aufbau.

import { LICHTFAEDEN, MITTE, fadenSaaten, glatt, textSaat, type FadenSaat } from './band';
import { leinwand, rgb, starteLauf, zeichneBuendel, type Lauf, type Probe } from './zeichnen';
import { STRAHL, strahlHell, strangBreite, strangMitte, wocheWeich } from './strahl';

export interface BandBuendel {
  id: string;
  /** #RRGGBB */
  farbe: string;
  /** Dichte je Woche 0 … 1 (Woche 0 beginnt `wochenVersatz` Tage vor dem Fensteranfang). */
  dichte: readonly number[];
  /** Fäden auf der Leinwand (schon gedeckelt). */
  faeden: number;
  /** Ausschlag je Woche 0 … 1 — nur aus Abweichungen; fehlt oder 0 = der Strang liegt glatt auf seiner Spur. */
  ausschlag?: readonly number[];
}
export interface BandVerbinder { x: number; yOben: number | null; buendel: string; farbe: string; leise: boolean }
export interface BandBild {
  breite: number;
  hoehe: number;
  bandOben: number;
  bandHoehe: number;
  buendel: readonly BandBuendel[];
  /** Tage vom Montag der ersten Woche bis zum Fensteranfang, und Tage im Fenster — für die Lage einer Woche in x. */
  wochenVersatz: number;
  tage: number;
  heuteX: number | null;
  heuteSeite?: 'links' | 'rechts';
  heuteFarbe: string;
  verbinder: readonly BandVerbinder[];
  engstellen: readonly { x0: number; x1: number }[];
  engstelleFarbe: string;
  hervor: string | null;
  handy: boolean;
}
/** Ein Ebenenwechsel: `oben` = Bündel der oberen Ebene (darin `fokus`), `unten` = die Kinder des Fokus-Bündels. */
export interface BandUebergang { richtung: 'auf' | 'zu'; fokus: string; oben: readonly BandBuendel[]; unten: readonly BandBuendel[] }

/** Maße: Reihen der Markierungen, Knopf (Tippziel), Chip, Reihen bis „+n“, Bandhöhe (aus `STRAHL.band`), Luft zwischen
 *  Markierungen und Band — Rechner · Handy (Knopf 44 px). */
export const BAND_MASSE = {
  rechner: { reihe: 30, knopf: 28, chip: 24, maxReihen: 4, band: STRAHL.band.rechner, abstand: 14 },
  handy: { reihe: 46, knopf: 44, chip: 28, maxReihen: 2, band: STRAHL.band.handy, abstand: 12 },
} as const;

export const bandMasse = (breite: number) => (breite < 520 ? BAND_MASSE.handy : BAND_MASSE.rechner);
/** Dauer des Auf-/Zufächerns (ms). */
export const UEBERGANG_MS = 720;

/** Helligkeit an einer Stelle (Strahl ruhig): Vergangenheit gedämpft, ab HEUTE voll, ferne Zukunft leiser, Last hebt sanft. */
export function hellBei(x: number, d: Pick<BandBild, 'heuteX' | 'heuteSeite'>, dichte: number): number {
  return strahlHell(x, d, dichte);
}

/**
 * Engstellen-Knöpfe, die sich im Band überlappen würden (benachbarte Wochen liegen nur wenige Pixel auseinander), zu EINEM
 * Knopf zusammenfassen: „KW 42–44“. Eingabe nach x sortiert; `abstand` = Mindestabstand der Mitten (Knopfbreite).
 */
export function engstellenGruppen<T extends { x: number; kw: number }>(liste: readonly T[], abstand: number): { x: number; label: string; teile: T[] }[] {
  const aus: { x: number; label: string; teile: T[] }[] = [];
  for (const e of liste) {
    const g = aus[aus.length - 1];
    if (g && e.x - g.teile[g.teile.length - 1].x < abstand) g.teile.push(e);
    else aus.push({ x: e.x, label: '', teile: [e] });
  }
  for (const g of aus) {
    g.x = g.teile.reduce((s, e) => s + e.x, 0) / g.teile.length;
    const a = g.teile[0].kw, b = g.teile[g.teile.length - 1].kw;
    g.label = a === b ? `KW ${a}` : `KW ${a}–${b}`;
  }
  return aus;
}

/** Dichte eines Bündels an der Stelle x (Wochen linear zwischen ihren Mitten). */
export function dichteBei(b: Pick<BandBuendel, 'dichte'>, x: number, d: Pick<BandBild, 'breite' | 'tage' | 'wochenVersatz'>): number {
  return wocheBei(b.dichte, x, d);
}

/** Wert einer Wochenreihe an der Stelle x — linear zwischen den Wochenmitten (Dichte). Weich: strahl.ts `wocheWeich`. */
export function wocheBei(reihe: readonly number[], x: number, d: Pick<BandBild, 'breite' | 'tage' | 'wochenVersatz'>): number {
  const n = reihe.length;
  if (!n) return 0;
  const tag = (x / Math.max(1, d.breite)) * d.tage + d.wochenVersatz;
  const p = Math.max(0, Math.min(n - 1, tag / 7 - 0.5));
  const i = Math.floor(p), j = Math.min(n - 1, i + 1), a = p - i;
  return reihe[i] * (1 - a) + reihe[j] * a;
}

/** Sanftes Ein-/Ausschwingen 0 → 1. */
export const sanft = (q: number) => { const t = Math.max(0, Math.min(1, q)); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; };

export interface Faedenband {
  setze(bild: BandBild, uebergang?: BandUebergang | null): void;
  /** Welches Bündel liegt an (x, y)? (für Klick/Hover auf der Leinwand) */
  treffer(x: number, y: number): string | null;
  /** Läuft gerade ein Übergang? 0 … 1, null = nein (Prüfungen). */
  fortschritt(): number | null;
  /** Läuft gerade der Aufbau (v3)? 0 … 1, null = fertig bzw. reduzierte Bewegung (Prüfungen). */
  aufbau(): number | null;
  stop(): void;
  lauf: Lauf;
}

export function faedenband(canvas: HTMLCanvasElement, beobachte: Element, ruhig: boolean): Faedenband {
  const ctx = canvas.getContext('2d');
  let bild: BandBild | null = null;
  let ueb: (BandUebergang & { start: number }) | null = null;
  let q: number | null = null;
  // Aufbau: Startzeit des ersten Bildes; −1 = noch nicht begonnen. Bei reduzierter Bewegung gibt es keinen Aufbau.
  let aufbauStart = -1, aufbauP: number | null = ruhig ? null : 0;
  const saatCache = new Map<string, FadenSaat[]>();
  const saaten = (id: string, n: number) => {
    const k = `${id}|${n}`;
    let s = saatCache.get(k);
    if (!s) { s = fadenSaaten(n, textSaat(id)); saatCache.set(k, s); if (saatCache.size > 400) saatCache.clear(); }
    return s;
  };

  /** Leitkurve und Breite des Strangs i von n an der Stelle x (lib/lichtfaeden/strahl.ts — rein). */
  const geometrie = (d: BandBild, liste: readonly BandBuendel[], i: number) => {
    const meiste = Math.max(1, ...liste.map(b => b.faeden));
    const aus = liste[i].ausschlag;
    const abw = (x: number) => (aus && aus.length ? wocheWeich(aus, x, d) : 0);
    const breite = (x: number) => strangBreite(liste[i].faeden, meiste, abw(x));
    return {
      dichte: (x: number) => dichteBei(liste[i], x, d),
      mitte: (x: number) => strangMitte(i, liste.length, x, d, abw(x), breite(x)),
      breite,
    };
  };

  function zeichneSatz(d: BandBild, b: BandBuendel, geo: ReturnType<typeof geometrie>, t: number, alpha: number, von?: ReturnType<typeof geometrie>, mix = 1, front = Infinity) {
    if (!ctx || alpha <= 0.01) return;
    const schritt = d.handy ? LICHTFAEDEN.schritt.handy : LICHTFAEDEN.schritt.rechner;
    const faktor = d.hervor == null ? 1 : d.hervor === b.id ? 1.4 : 0.25;
    const proben: Probe[] = [];
    // Aufbau: die Stränge enden an der Front (ohne leuchtende Spitze — die Proben werden einfach abgeschnitten).
    const ende = Math.min(d.breite + schritt, front);
    for (let x = -schritt; x <= ende; x += schritt) {
      let y = geo.mitte(x), w = geo.breite(x);
      if (von && mix < 1) { y = von.mitte(x) + (y - von.mitte(x)) * mix; w = von.breite(x) + (w - von.breite(x)) * mix; }
      proben.push({ x, y, nx: 0, ny: 1, s: x, spreizung: w, hell: hellBei(x, d, geo.dichte(x)) * faktor * alpha });
    }
    if (proben.length < 2) return;
    const tt = t * STRAHL.tempo;
    zeichneBuendel(ctx, proben, { farbe: b.farbe, saaten: [MITTE], deckkraft: STRAHL.kern.deckkraft, strich: d.handy ? STRAHL.kern.breite.handy : STRAHL.kern.breite.rechner }, tt);
    zeichneBuendel(ctx, proben, { farbe: b.farbe, saaten: saaten(b.id, Math.max(1, b.faeden)), deckkraft: STRAHL.deckkraft, strich: STRAHL.strich }, tt);
  }

  function zeichne(t: number) {
    const d = bild;
    if (!ctx || !d || d.breite < 2) return;
    const dpr = leinwand(canvas, d.breite, d.hoehe);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, d.breite, d.hoehe);
    ctx.globalCompositeOperation = 'source-over';

    // Aufbau: die Front wandert von links nach rechts; danach unendlich (alles da).
    let front = Infinity;
    if (!ruhig && aufbauP != null) {
      if (aufbauStart < 0) aufbauStart = t;
      const p = (t - aufbauStart) / LICHTFAEDEN.aufbau;
      if (p >= 1) aufbauP = null;
      else { aufbauP = Math.max(0, p); front = sanft(aufbauP) * (d.breite + 80) - 40; }
    }
    const erreicht = (x: number) => (front === Infinity ? 1 : glatt(front - x, 0, 90));

    // Engstellen: ruhige Säulen hinter den Strängen.
    const [er, eg, eb] = rgb(d.engstelleFarbe);
    for (const e of d.engstellen) {
      const g = ctx.createLinearGradient(0, d.bandOben - 10, 0, d.bandOben + d.bandHoehe + 10);
      g.addColorStop(0, `rgba(${er},${eg},${eb},0)`); g.addColorStop(0.5, `rgba(${er},${eg},${eb},${(0.07 * erreicht(e.x0)).toFixed(3)})`); g.addColorStop(1, `rgba(${er},${eg},${eb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(e.x0, d.bandOben - 10, Math.max(2, e.x1 - e.x0), d.bandHoehe + 20);
    }

    const mitten = new Map<string, (x: number) => number>();
    // Übergang: q = 0 obere Ebene, 1 untere Ebene.
    q = null;
    if (ueb) {
      if (ueb.start < 0) ueb.start = t;
      const p = Math.min(1, (t - ueb.start) / UEBERGANG_MS);
      q = ueb.richtung === 'auf' ? p : 1 - p;
      if (p >= 1) { ueb = null; q = null; }
    }
    if (ueb && q != null) {
      const e = sanft(q);
      const fi = ueb.oben.findIndex(b => b.id === ueb!.fokus);
      const fokusGeo = fi >= 0 ? geometrie(d, ueb.oben, fi) : undefined;
      ueb.oben.forEach((b, i) => { if (i !== fi) zeichneSatz(d, b, geometrie(d, ueb!.oben, i), t, 1 - e); });
      if (fi >= 0) zeichneSatz(d, ueb.oben[fi], fokusGeo!, t, (1 - e) ** 2);
      ueb.unten.forEach((b, i) => zeichneSatz(d, b, geometrie(d, ueb!.unten, i), t, Math.sqrt(e), fokusGeo, e));
    } else {
      d.buendel.forEach((b, i) => { const g = geometrie(d, d.buendel, i); mitten.set(b.id, g.mitte); zeichneSatz(d, b, g, t, 1, undefined, 1, front); });
    }

    // HEUTE: eine ruhige senkrechte Linie durchs Band (erscheint, wenn der Aufbau sie erreicht) — kein Schein, kein Punkt.
    if (d.heuteX != null && erreicht(d.heuteX) > 0.02) {
      const [r, g, bl] = rgb(d.heuteFarbe);
      ctx.fillStyle = `rgba(${r},${g},${bl},${(STRAHL.heute.deckkraft * erreicht(d.heuteX)).toFixed(3)})`;
      ctx.fillRect(d.heuteX - STRAHL.heute.breite / 2, d.bandOben - 6, STRAHL.heute.breite, d.bandHoehe + 12);
    }

    // Verbinder: Markierung → ihr Strang, mit Knoten — so laufen Meilensteine und Fristen sauber in den Strahl (nicht im Übergang).
    if (q == null) for (const v of d.verbinder) {
      const an = mitten.get(v.buendel);
      const cy = an ? an(v.x) : d.bandOben + d.bandHoehe / 2;
      const gedimmt = d.hervor != null && d.hervor !== v.buendel;
      const a = (v.leise ? 0.5 : 1) * (gedimmt ? 0.25 : 1) * erreicht(v.x);
      if (a <= 0.01) continue;
      const [r, g, bl] = rgb(v.farbe);
      if (v.yOben != null && cy > v.yOben) {
        const lin = ctx.createLinearGradient(0, v.yOben, 0, cy);
        lin.addColorStop(0, `rgba(${r},${g},${bl},${(0.45 * a).toFixed(3)})`); lin.addColorStop(1, `rgba(${r},${g},${bl},${(0.18 * a).toFixed(3)})`);
        ctx.fillStyle = lin;
        ctx.fillRect(v.x - 0.5, v.yOben, 1, cy - v.yOben);
      }
      ctx.fillStyle = `rgba(${r},${g},${bl},${(0.18 * a).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(v.x, cy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${r},${g},${bl},${(0.95 * a).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(v.x, cy, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  const lauf = starteLauf({ beobachte, zeichne, ruhig });
  return {
    setze(neu, u) {
      bild = neu;
      ueb = u && !ruhig ? { ...u, start: -1 } : null;
      lauf.einmal();
    },
    treffer(x, y) {
      const d = bild;
      if (!d || ueb || y < d.bandOben - 8 || y > d.bandOben + d.bandHoehe + 8) return null;
      let best: string | null = null, abstand = Infinity;
      d.buendel.forEach((b, i) => {
        const g = geometrie(d, d.buendel, i);
        const a = Math.abs(y - g.mitte(x));
        if (a <= g.breite(x) + 9 && a < abstand) { abstand = a; best = b.id; }
      });
      return best;
    },
    fortschritt: () => q,
    aufbau: () => aufbauP,
    stop() { lauf.stop(); },
    lauf,
  };
}
