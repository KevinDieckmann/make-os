// ─── Lichtfäden v2 — das Fädenband (Canvas 2D, ohne Framework, 03.10.2026) ──
// EIN Zeichner für alle Ebenen (Planung Jahr, Ziel, Meilenstein, Fokus): je Bündel der Ansicht feine Fäden in seiner
// Farbe, alle zu EINEM Band verflochten (band.ts `buendelMitte`); Spreizung und Leuchten je Woche aus der Dichte
// (baum.ts). Vergangenheit gedämpft, HEUTE als leuchtender Schnitt, Engstellen als ruhige Lichtsäulen, Verbinder von den
// Markierungen (DOM-Knöpfe) zu ihrem Bündel. Hover/Fokus hebt ein Bündel hervor, die anderen dimmen.
//
// Aufklappen (eine Ebene tiefer): Die Kinder entspringen dem angeklickten Bündel — sie beginnen auf seiner Leitkurve mit
// seiner Spreizung und fächern in ~0,7 s auf ihre eigenen Bahnen, während die übrigen Bündel verlöschen. Zurück
// (Brotkrume) läuft dasselbe rückwärts: die Kinder fließen in ihr Bündel zusammen. Bei „Bewegung reduzieren“ kein
// Übergang, nur das Standbild.
// Daten rechnet der Zeichner nie — er bekommt fertige Dichten (Regel aus DESIGN_STANDARD.md › Lichtfäden).
//
// Strahl v3 (04.10., Kevin: „Der Strahl läuft im Grunde genommen immer von links nach rechts.“):
//   · Aufbau: beim ersten Bild wachsen die Fäden in `LICHTFAEDEN.aufbau` ms von links nach rechts ein, ihre Spitzen leuchten;
//     ein leises Licht läuft der Front voraus. Markierungs-Verbinder, HEUTE und Engstellen erscheinen, wenn die Front sie erreicht.
//   · Fließen: alle Wellen wandern in Zeitrichtung (band.ts), Partikel laufen entlang der Fäden nach rechts.
//   · Zukunft: rechts von HEUTE fransen die Fäden aus und werden blasser; links (Vergangenheit) gedämpft.
//   · Spitzen: aus der UNgeglätteten Last (`spitze` je Woche, baum.ts) — scharfe Ausschläge, die Fäden fächern um sie auf.
//   · Glühen dichter Stellen (Schein-Puffer), dünne helle Mittellinie, gestrichelte Hilfslinien, Netz-Motiv oben rechts.

import { LICHTFAEDEN, MITTE, buendelMitte, fadenSaaten, glatt, spreizung as spreizungBei, textSaat, type FadenSaat } from './band';
import { glanzPuffer, leinwand, rgb, starteLauf, zeichneBuendel, zeichneNetz, type Lauf, type Probe, type PunkteStil } from './zeichnen';

export interface BandBuendel {
  id: string;
  /** #RRGGBB */
  farbe: string;
  /** Dichte je Woche 0 … 1 (Woche 0 beginnt `wochenVersatz` Tage vor dem Fensteranfang). */
  dichte: readonly number[];
  /** Fäden auf der Leinwand (schon gedeckelt). */
  faeden: number;
  /** Spitzen je Woche 0 … 1 (v3, ungeglättet) — scharfe Ausschläge; fehlt = keine. */
  spitze?: readonly number[];
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

/** Maße: Reihen der Markierungen, Knopf (Tippziel), Chip, Reihen bis „+n“, Bandhöhe — Rechner · Handy (Knopf 44 px). */
export const BAND_MASSE = {
  // v3.1 (04.10., Kevin: „Band deutlich größer, kräftige Wellen“): das Band nimmt etwa die Hälfte des Zeichenbereichs ein; die
  // Markierungen haben ihre eigene Zone darüber (`abstand` = Luft zwischen Zone und Band), Spitzen bleiben im Band (`randBei`).
  rechner: { reihe: 30, knopf: 28, chip: 24, maxReihen: 4, band: 300, abstand: 18 },
  handy: { reihe: 46, knopf: 44, chip: 28, maxReihen: 2, band: 220, abstand: 14 },
} as const;
/** Kontrast ruhig/voll: Exponent auf die Dichte für die Spreizung — ruhige Wochen bleiben eng an der Mittellinie. */
export const SPREIZ_EXPONENT = 1.35;
/** Höchste Spreizung eines Bündels (Anteil der halben Bandhöhe) und Ausschlag der Spitzen (Anteil der halben Bandhöhe). */
export const BAND_FORM = { spreizMax: 0.72, hub: { rechner: 0.86, handy: 0.7 } } as const;

/**
 * Weiche Grenze der Leitkurve: Ausschlag `o` (Pixel ab der Mittellinie) bleibt innerhalb ±`grenze` — linear in der Mitte, sanft
 * gesättigt am Rand (tanh). So schlagen Spitzen kräftig aus, ragen aber nie aus dem Band in die Zone der Markierungen.
 */
export function randBei(o: number, grenze: number): number {
  const g = Math.max(1, grenze);
  return g * Math.tanh(o / g);
}
export const bandMasse = (breite: number) => (breite < 520 ? BAND_MASSE.handy : BAND_MASSE.rechner);
/** Dauer des Auf-/Zufächerns (ms). */
export const UEBERGANG_MS = 720;

/** Helligkeit an einer Stelle: Vergangenheit gedämpft, HEUTE leuchtet, Dichte hebt; die ferne Zukunft wird leiser (v3). */
export function hellBei(x: number, d: Pick<BandBild, 'heuteX' | 'heuteSeite'>, dichte: number): number {
  let zeit: number;
  if (d.heuteX == null) zeit = d.heuteSeite === 'rechts' ? 0.32 : 1;
  else zeit = (0.32 + 0.68 * glatt(x, d.heuteX - 26, d.heuteX + 4)) * (1 - 0.3 * glatt(x, d.heuteX + 20, d.heuteX + 560));
  const schnitt = d.heuteX == null ? 0 : Math.exp(-(((x - d.heuteX) / 14) ** 2)) * 0.15;
  // v3.1: Dichte hebt sanfter (vorher +0,85) — das größere Band fächert stärker auf, sonst laufen volle Stellen ins Weiße.
  return zeit * (0.55 + 0.6 * dichte) + schnitt;
}

/** Ausfransen 0 … 1 an einer Stelle (v3): ab HEUTE nach rechts zunehmend — die Zukunft ist unsicher. */
export function fransBei(x: number, d: Pick<BandBild, 'heuteX' | 'heuteSeite' | 'breite'>): number {
  if (d.heuteX == null) return d.heuteSeite === 'links' ? 0.7 : 0;
  return glatt(x, d.heuteX + 6, d.heuteX + Math.max(160, d.breite * 0.42));
}

/** Vorzeichen eines Ausschlags je Woche und Bündel (−1 = nach oben): je Bündel eine Richtung (das erste nach oben, das zweite
 *  nach unten …), selten gekippt — so bilden benachbarte volle Wochen einen Grat statt eines Zitterns. */
export const spitzeRichtung = (woche: number, buendel: number) => ((buendel % 2 === 0 ? -1 : 1) * ((woche + buendel * 3) % 7 === 3 ? -1 : 1));

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

/** Wert einer Wochenreihe an der Stelle x — linear zwischen den Wochenmitten (bei Spitzen: ein scharfes Dreieck). */
export function wocheBei(reihe: readonly number[], x: number, d: Pick<BandBild, 'breite' | 'tage' | 'wochenVersatz'>, vorzeichen?: (w: number) => number): number {
  const n = reihe.length;
  if (!n) return 0;
  const tag = (x / Math.max(1, d.breite)) * d.tage + d.wochenVersatz;
  const p = Math.max(0, Math.min(n - 1, tag / 7 - 0.5));
  const i = Math.floor(p), j = Math.min(n - 1, i + 1), a = p - i;
  const vi = vorzeichen ? vorzeichen(i) : 1, vj = vorzeichen ? vorzeichen(j) : 1;
  return reihe[i] * vi * (1 - a) + reihe[j] * vj * a;
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
  let letztesT = 0, q: number | null = null;
  // Aufbau (v3): Startzeit des ersten Bildes; −1 = noch nicht begonnen. Bei reduzierter Bewegung gibt es keinen Aufbau.
  let aufbauStart = -1, aufbauP: number | null = ruhig ? null : 0;
  const glanz = glanzPuffer();
  const saatCache = new Map<string, FadenSaat[]>();
  const saaten = (id: string, n: number) => {
    const k = `${id}|${n}`;
    let s = saatCache.get(k);
    if (!s) { s = fadenSaaten(n, textSaat(id)); saatCache.set(k, s); if (saatCache.size > 400) saatCache.clear(); }
    return s;
  };

  /** Leitkurve und Spreizung eines Bündels i von n an der Stelle x. */
  const geometrie = (d: BandBild, liste: readonly BandBuendel[], i: number, t: number) => {
    const halb = d.bandHoehe / 2, mitte = d.bandOben + halb;
    const maxF = Math.max(1, ...liste.map(b => b.faeden));
    const dicke = 0.55 + 0.45 * Math.sqrt(liste[i].faeden / maxF);
    const sp = liste[i].spitze;
    const richtung = (w: number) => spitzeRichtung(w, i);
    const hubPx = halb * (d.handy ? BAND_FORM.hub.handy : BAND_FORM.hub.rechner);
    const hub = (x: number) => (sp && sp.length ? hubPx * wocheBei(sp, x, d, richtung) : 0);
    // Spreizung mit Kontrast: ruhig eng, voll voluminös — aber nie breiter als `spreizMax` der halben Bandhöhe.
    const spreizung = (x: number) => Math.min(halb * BAND_FORM.spreizMax, spreizungBei(Math.pow(dichteBei(liste[i], x, d), SPREIZ_EXPONENT), halb) * dicke);
    return {
      dichte: (x: number) => dichteBei(liste[i], x, d),
      hub,
      // Leitkurve: Schwingen + Spitze, weich begrenzt, damit das ganze Bündel (± Spreizung) im Band bleibt.
      mitte: (x: number) => mitte + randBei(halb * buendelMitte(i, liste.length, x, t, dichteBei(liste[i], x, d)) + hub(x), Math.max(halb * 0.28, halb * 0.97 - spreizung(x) * 1.05)),
      spreizung,
    };
  };

  function zeichneSatz(d: BandBild, b: BandBuendel, geo: ReturnType<typeof geometrie>, t: number, alpha: number, von?: ReturnType<typeof geometrie>, mix = 1, front = Infinity) {
    if (!ctx || alpha <= 0.01) return;
    const schritt = d.handy ? LICHTFAEDEN.schritt.handy : LICHTFAEDEN.schritt.rechner;
    // Viele Fäden übereinander laufen additiv ins Weiße — je mehr Fäden auf der Leinwand, desto leiser jeder (v3: bis 300 Fäden).
    const gesamt = d.buendel.reduce((s, x) => s + x.faeden, 0);
    const faktor = (d.hervor == null ? 1 : d.hervor === b.id ? 1.45 : 0.16) * Math.min(1, Math.sqrt(150 / Math.max(1, gesamt)));
    const proben: Probe[] = [];
    for (let x = -schritt; x <= d.breite + schritt; x += schritt) {
      const dx = geo.dichte(x);
      let y = geo.mitte(x), sp = geo.spreizung(x), hub = geo.hub(x);
      if (von && mix < 1) { y = von.mitte(x) + (y - von.mitte(x)) * mix; sp = von.spreizung(x) * 0.8 + (sp - von.spreizung(x) * 0.8) * mix; hub *= mix; }
      proben.push({ x, y, nx: 0, ny: 1, s: x, spreizung: sp, hell: hellBei(x, d, dx) * faktor * alpha, frans: fransBei(x, d), hub });
    }
    const punkte: PunkteStil = d.handy ? { ...LICHTFAEDEN.punkte, abstand: 14, jeder: 3 } : { ...LICHTFAEDEN.punkte, jeder: 2 };
    // Schein entlang der Leitkurve — breiter und kräftiger als v3, damit volle Stellen glühen (er folgt den Spitzen).
    zeichneBuendel(ctx, proben, { farbe: b.farbe, saaten: [MITTE], deckkraft: 0.065, strich: d.handy ? 12 : 20, front }, t);
    zeichneBuendel(ctx, proben, { farbe: b.farbe, saaten: saaten(b.id, Math.max(1, b.faeden)), front, punkte }, t);
  }

  function zeichne(t: number) {
    letztesT = t;
    const d = bild;
    if (!ctx || !d || d.breite < 2) return;
    const dpr = leinwand(canvas, d.breite, d.hoehe);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, d.breite, d.hoehe);
    const halb = d.bandHoehe / 2, mitte = d.bandOben + halb;

    // Aufbau (v3): die Front wandert von links nach rechts; danach unendlich (alles da).
    let front = Infinity;
    if (!ruhig && aufbauP != null) {
      if (aufbauStart < 0) aufbauStart = t;
      const p = (t - aufbauStart) / LICHTFAEDEN.aufbau;
      if (p >= 1) aufbauP = null;
      else { aufbauP = Math.max(0, p); front = sanft(aufbauP) * (d.breite + LICHTFAEDEN.aufbauVerzug + 80) - 40; }
    }
    const erreicht = (x: number) => (front === Infinity ? 1 : glatt(front - x, 0, 90));

    // Engstellen: ruhige Lichtsäulen hinter dem Band.
    ctx.globalCompositeOperation = 'source-over';
    const [er, eg, eb] = rgb(d.engstelleFarbe);
    for (const e of d.engstellen) {
      const g = ctx.createLinearGradient(0, d.bandOben - 10, 0, d.bandOben + d.bandHoehe + 10);
      g.addColorStop(0, `rgba(${er},${eg},${eb},0)`); g.addColorStop(0.5, `rgba(${er},${eg},${eb},${(0.09 * erreicht(e.x0)).toFixed(3)})`); g.addColorStop(1, `rgba(${er},${eg},${eb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(e.x0, d.bandOben - 10, Math.max(2, e.x1 - e.x0), d.bandHoehe + 20);
    }
    // Hilfslinien (gestrichelt) und die dünne helle Mittellinie — an den Rändern ausgeblendet.
    ctx.save();
    ctx.setLineDash([3, 7]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    for (const f of [-0.84, 0.84]) { const y = Math.round(mitte + halb * f) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(d.breite, y); ctx.stroke(); }
    ctx.restore();
    const ml = ctx.createLinearGradient(0, 0, d.breite, 0);
    ml.addColorStop(0, 'rgba(255,255,255,0)'); ml.addColorStop(0.06, 'rgba(255,255,255,.17)'); ml.addColorStop(0.94, 'rgba(255,255,255,.17)'); ml.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = ml;
    ctx.fillRect(0, mitte - 0.5, front === Infinity ? d.breite : Math.max(0, Math.min(d.breite, front)), 1);
    // Netz-Motiv oben rechts (nur Rechner), sehr leise und langsam.
    if (!d.handy && d.breite > 640) zeichneNetz(ctx, { x: d.breite * 0.74, y: Math.max(0, d.bandOben - 6), breite: d.breite * 0.25, hoehe: d.bandHoehe * 0.3, t, farbe: d.heuteFarbe, saat: 41, knoten: 12, deckkraft: 0.07 * erreicht(d.breite * 0.8) });

    ctx.globalCompositeOperation = 'lighter';
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
      const fokusGeo = fi >= 0 ? geometrie(d, ueb.oben, fi, t) : undefined;
      ueb.oben.forEach((b, i) => { if (i !== fi) zeichneSatz(d, b, geometrie(d, ueb!.oben, i, t), t, 1 - e); });
      if (fi >= 0) zeichneSatz(d, ueb.oben[fi], fokusGeo!, t, (1 - e) ** 2);
      ueb.unten.forEach((b, i) => zeichneSatz(d, b, geometrie(d, ueb!.unten, i, t), t, Math.sqrt(e), fokusGeo, e));
    } else {
      d.buendel.forEach((b, i) => { const g = geometrie(d, d.buendel, i, t); mitten.set(b.id, g.mitte); zeichneSatz(d, b, g, t, 1, undefined, 1, front); });
    }
    // Glühen dichter Stellen: das Gezeichnete klein und weich additiv darüber (ein drawImage hin, eines zurück).
    if (glanz && d.buendel.length) glanz.auf(ctx, canvas, d.breite, d.hoehe, d.handy ? 0.6 : LICHTFAEDEN.glanz.staerke);
    // Die Front des Aufbaus: ein leises Licht, das vorausläuft und mit dem Ende des Aufbaus verlischt.
    if (front !== Infinity && aufbauP != null) {
      const [r, g, bl] = rgb(d.heuteFarbe);
      const fx = Math.max(0, Math.min(d.breite, front));
      const licht = ctx.createRadialGradient(fx, mitte, 0, fx, mitte, halb * 1.3);
      licht.addColorStop(0, `rgba(${r},${g},${bl},${(0.2 * (1 - aufbauP)).toFixed(3)})`); licht.addColorStop(1, `rgba(${r},${g},${bl},0)`);
      ctx.fillStyle = licht;
      ctx.fillRect(fx - halb * 1.3, mitte - halb * 1.3, halb * 2.6, halb * 2.6);
    }

    // HEUTE: leuchtender Schnitt durchs Band (erscheint, wenn der Aufbau ihn erreicht).
    if (d.heuteX != null && erreicht(d.heuteX) > 0.02) {
      const [r, g, bl] = rgb(d.heuteFarbe);
      const x = d.heuteX;
      const schein = ctx.createRadialGradient(x, mitte, 0, x, mitte, halb * 1.1);
      schein.addColorStop(0, `rgba(${r},${g},${bl},${(0.16 * erreicht(x)).toFixed(3)})`); schein.addColorStop(1, `rgba(${r},${g},${bl},0)`);
      ctx.fillStyle = schein;
      ctx.fillRect(x - halb * 1.1, mitte - halb * 1.1, halb * 2.2, halb * 2.2);
      const linie = ctx.createLinearGradient(0, d.bandOben - 8, 0, d.bandOben + d.bandHoehe + 8);
      linie.addColorStop(0, `rgba(${r},${g},${bl},0)`); linie.addColorStop(0.5, `rgba(${r},${g},${bl},.62)`); linie.addColorStop(1, `rgba(${r},${g},${bl},0)`);
      ctx.fillStyle = linie;
      ctx.fillRect(x - 0.75, d.bandOben - 8, 1.5, d.bandHoehe + 16);
    }

    // Verbinder: Markierung → ihr Bündel (mitfließend), mit leuchtendem Knoten — nicht während des Übergangs.
    ctx.globalCompositeOperation = 'source-over';
    if (q == null) for (const v of d.verbinder) {
      const an = mitten.get(v.buendel);
      const cy = an ? an(v.x) : mitte;
      const gedimmt = d.hervor != null && d.hervor !== v.buendel;
      const a = (v.leise ? 0.5 : 1) * (gedimmt ? 0.25 : 1) * erreicht(v.x);
      if (a <= 0.01) continue;
      const [r, g, bl] = rgb(v.farbe);
      if (v.yOben != null && cy > v.yOben) {
        const lin = ctx.createLinearGradient(0, v.yOben, 0, cy);
        lin.addColorStop(0, `rgba(${r},${g},${bl},${(0.5 * a).toFixed(3)})`); lin.addColorStop(1, `rgba(${r},${g},${bl},${(0.18 * a).toFixed(3)})`);
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
        const g = geometrie(d, d.buendel, i, letztesT);
        const a = Math.abs(y - g.mitte(x));
        if (a <= g.spreizung(x) + 12 && a < abstand) { abstand = a; best = b.id; }
      });
      return best;
    },
    fortschritt: () => q,
    aufbau: () => aufbauP,
    stop() { lauf.stop(); },
    lauf,
  };
}
