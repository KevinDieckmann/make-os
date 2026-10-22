// ─── Prozesse — die Lage der Landkarte als Fliege und des Prozesses (Etappe A, 21.10.; ANALYSE_100.md Punkte 2, 3, 9, 13, 93; Entscheidung E1) ────
// Gerechnet wird NUR hier (Vorbild: das Hochhaus, lib/fulfillment/prozesse/landkarte.ts — die Reihen-Regel teilen sich beide über ./lage.ts); die Zeichnung
// setzt nur die fertigen Lagen. Alles in Bildpunkten der Fläche (Welt), deterministisch, rein (Server UND Browser).
//   · `fliegeLage(prozesse)` — Ebene 1: Band „Führung“ oben, die Fliege im Kern, Band „Unterstützung“ unten. Die Fliege (21.10. abends, „schön machen“):
//     zwei Flügel als getönte Flächen — links Marketing → Sales, verengt sich zum Knoten „Übergabe“ in der Mitte, rechts Fulfillment → Ausbau, weitet sich
//     wieder. Je Flügel Spalten vom Knoten nach außen; jede Spalte trägt eine Zeile je Hälfte mehr als die davor (`zeilenInnen` + Tiefe), eine Stufe mit vielen
//     Kacheln bekommt mehrere Spalten (Reihenfolge stabil: Spalte für Spalte von links, oben → unten) — so bleibt es eine Fliege, auch mit 40 Kacheln, und
//     wird nie ein Turm. Der Umriss steigt nach außen immer an (`weitung`), über jeder Spalte flach, dazwischen weich. Der Weg des Kunden läuft als
//     Lichtfaden durch die Gasse in der Mitte und durch den Knoten (`rueckgrat`).
//   · Übergaben (Punkt 9), „wenig und klar“: in der Gesamtansicht nur kurze, ruhige Wege zwischen NACHBARN (benachbarte Spalten, übereinander in derselben
//     Hälfte, nebeneinander im Band) als weiche Kurven mit verteilten Anschlüssen — ausgewählt so, dass sich keine zwei kreuzen (`sicht: 'immer'`). Alle
//     übrigen (lang, über Bänder, Rückwege) stehen nur, wenn eine Kachel überfahren oder gewählt ist (`sicht: 'fokus'`, gewinkelt um die Kacheln herum —
//     dieselbe Wegsuche wie die Fläche des Editors, `pfeilWeg`). Welche Wege ein Bild zeigt, sagt NUR `pfeileImBild`.
//   · Kacheln sind nie schmaler als ihr längstes Wort (`kachelBreite` über lib/text/umbruch.ts) — die Zeichnung bricht nur an Wortgrenzen um.
//   · `prozessLage(prozess, alle)` — Ebene 2: Start, die Phasen von links nach rechts mit ihren ersten Schritten, Ergebnis; links, woher der Prozess
//     Übergaben bekommt, rechts, wohin er übergibt (Geister-Kacheln, ein Klick fährt dorthin) — als weiche Kurven mit verteilten Anschlüssen.
//   · Rahmen zum Präsentieren (Punkt 93): erst das Ganze, dann Band für Band bzw. Stufe für Stufe entlang des Flows.

import { pfeilWeg, type Box } from '@/lib/fulfillment/prozesse/flaeche';
import { stueckBreiteMax, textBreite } from '@/lib/text/umbruch';
import { BAENDER, KERN_STUFEN, type Band, type KernStufe, type ProzessDef } from './typen';
import { kurztitel, neinVon, stufeVon } from './modell';
import { kurve, reiheVerteilen, r1, wegPunkt, wegeKreuzen, type Pt } from './lage';

/** Maße der Landkarte (Bildpunkte der Fläche). */
export const FLIEGE = {
  /** Kachel: `b` ist die Mindestbreite — braucht ein Wort mehr, werden alle Kacheln so breit (`kachelBreite`, ein ruhiges Raster). */
  kachel: { b: 280, h: 96 },
  /** Waagerecht zwischen zwei Stufen (Platz für Wege und Beschriftung), zwischen zwei Spalten derselben Stufe, senkrecht zwischen zwei Kacheln. */
  spalte: 104, unterspalte: 56, zeile: 32,
  /** Die Gasse in der Mitte der Fliege — dort läuft der Weg des Kunden. */
  gasse: 56,
  /** Seitenrand, Kopf eines Bandes (Titel), Innenrand, Abstand der Bänder, Platz für die Stufen-Titel über der Fliege. */
  rand: 56, kopf: 48, innen: 24, abstand: 64, stufenKopf: 54,
  /** Luft zwischen Kacheln und Umriss; Luft um den Knoten. */
  luft: 24, knotenLuft: 22,
  /** Zeilen je Hälfte in der innersten Spalte eines Flügels — jede Spalte weiter außen trägt eine mehr. */
  zeilenInnen: 2,
  /** Um so viel steigt der Umriss je Spalte nach außen mindestens — die Fliege bleibt eine Fliege, auch wenn außen wenig steht. */
  weitung: 24,
  /** Mindest-Halbhöhe der inneren bzw. äußeren Stufe eines Flügels (die Form bleibt mit wenigen Kacheln erkennbar). */
  minHalb: { innen: 170, aussen: 230 },
  /** So hoch darf eine kurze Übergabe zwischen Nachbarn steigen, um in der Gesamtansicht zu stehen (sonst nur mit Fokus). */
  ruhig: 2 * (96 + 32),
  /** Abstand der Kacheln im Band; Breite eines leeren Knotens. */
  bandLuecke: 40, knotenLeer: 220,
} as const;

/**
 * Schrift der Kacheln je Zoomstufe (Bildpunkte der Fläche): `groesse` bis herab zu `min`, wenn ein Wort sonst nicht passt (nie hart getrennt), höchstens
 * `zeilen` Zeilen; `innen` = was links und rechts für Rand und Zeichen weggeht. Fern ist die Schrift groß, damit die Gesamtansicht lesbar bleibt
 * (Zoom ≈ 0,45 → ≈ 12 px auf dem Bildschirm).
 */
export const KACHEL_TEXT = {
  fern: { groesse: 28, min: 24, gewicht: 700, innen: 34, zeilen: 2 },
  mittel: { groesse: 18, min: 15, gewicht: 650, innen: 60, zeilen: 2 },
  nah: { groesse: 16, min: 14, gewicht: 650, innen: 60, zeilen: 2 },
} as const;
/** Welcher Text einer Kachel in welcher Zoomstufe steht (fern der Kurztitel) — eine eigene Beschriftung (Landkarte anpassen) vor dem Titel. */
export const kachelTitel = (p: Pick<ProzessDef, 'titel'> & { beschriftung?: string }, stufe: keyof typeof KACHEL_TEXT): string => {
  const t = p.beschriftung ?? p.titel;
  return stufe === 'fern' ? kurztitel(t) : t;
};

/** Die Breite der Kacheln: mindestens `FLIEGE.kachel.b`, sonst so breit, dass das längste Wort jeder Kachel in jeder Zoomstufe in der kleinsten Schrift passt. */
export function kachelBreite(prozesse: readonly (Pick<ProzessDef, 'titel'> & { beschriftung?: string })[]): number {
  let b: number = FLIEGE.kachel.b;
  for (const p of prozesse) {
    for (const st of ['fern', 'mittel', 'nah'] as const) {
      const t = KACHEL_TEXT[st];
      b = Math.max(b, stueckBreiteMax(kachelTitel(p, st), t.min, t.gewicht) + t.innen);
    }
  }
  return Math.ceil(b / 4) * 4;
}

export type FluegelSeite = 'links' | 'knoten' | 'rechts';
/** Eine Kachel im Bild; `bereich` = ein eigener Bereich (Landkarte anpassen, `lb-…`) — er steht als Band, `band` sagt dann nur, ob oben oder unten. */
export interface KachelLage extends Box { id: string; band: Band; stufe?: KernStufe; bereich?: string }
/**
 * Eine Übergabe im Bild. `sicht`: `immer` = kurzer Weg zwischen Nachbarn (Gesamtansicht), `fokus` = nur, wenn eine ihrer Kacheln überfahren oder gewählt ist.
 * `textOrt` = wo die Beschriftung in normaler Schrift steht, `textOrtFern` = wo sie groß steht (Zoomstufe „fern“) — je die Stelle am Weg, die am wenigsten
 * Kacheln verdeckt; `textFrei` = in der Gesamtansicht ist Platz (sonst nur mit Fokus).
 */
export interface PfeilLage {
  id: string; von: string; nach: string; text: string; art: 'weiter' | 'zurueck'; punkte: [number, number][];
  textOrt: [number, number]; textOrtFern: [number, number]; textFrei: boolean; sicht: 'immer' | 'fokus';
}
/** Ein Band (Führung, Unterstützung bzw. ein eigener Bereich `lb-…` — Landkarte anpassen). */
export interface BandLage extends Box { id: string; titel: string; satz: string }
/** Eine Stufe der Fliege: ihre Spalten von `x` über `b`, Mitte `cx`, Halbhöhe des Umrisses `halb`, Grundlinie ihres Titels `titelY`. */
export interface StufeLage { id: KernStufe; titel: string; x: number; b: number; cx: number; halb: number; titelY: number }
/** Eine Spalte der Fliege (für Umriss, Tests und Präsentieren): `tiefe` = wie weit vom Knoten (0 = die innerste), `inhalt` = Halbhöhe ihrer Kacheln. */
export interface SpalteLage { stufe: KernStufe; seite: FluegelSeite; tiefe: number; x: number; b: number; halb: number; inhalt: number; zeilen: number }
export interface RahmenLage { id: string; titel: string; box: Box }
export interface FliegeLage {
  breite: number; hoehe: number; box: Box;
  baender: BandLage[];
  fliege: {
    /** Der ganze Umriss (beide Flügel und der Knoten) als ein geschlossener Pfad. */
    pfad: string; mitte: number; x0: number; x1: number;
    stufen: StufeLage[]; spalten: SpalteLage[];
    /** Der Knoten (Übergabe) als Fläche um seine Kacheln; `caption` = wo die Zeile „Kern …“ steht (über dem Knoten). */
    knoten: Box; caption: [number, number];
    /** Die Töne der Flächen von links nach rechts: je Stufe ihre Mitte als Anteil 0 … 1 (für einen Verlauf). */
    toene: { stufe: KernStufe; bei: number }[];
    /** Oberkante des Kerns (für Titel und Rahmen). */
    oben: number;
  };
  kacheln: KachelLage[];
  pfeile: PfeilLage[];
  /** Der Weg des Kunden durch die Gasse — Abschnitte je Stufe als Anteile 0 … 1 der Länge (für die Farbe der Stufe). */
  rueckgrat: { punkte: [number, number][]; abschnitte: { stufe: KernStufe; von: number; bis: number }[] };
  rahmen: RahmenLage[];
}

/** Eine Box um mehrere Boxen (mit Rand). */
export function huelle(boxen: readonly Box[], rand = 0): Box {
  if (!boxen.length) return { x: 0, y: 0, b: 0, h: 0 };
  const x0 = Math.min(...boxen.map(b => b.x)), y0 = Math.min(...boxen.map(b => b.y));
  const x1 = Math.max(...boxen.map(b => b.x + b.b)), y1 = Math.max(...boxen.map(b => b.y + b.h));
  return { x: r1(x0 - rand), y: r1(y0 - rand), b: r1(x1 - x0 + 2 * rand), h: r1(y1 - y0 + 2 * rand) };
}

/** `n` Kacheln auf Spalten mit diesen Plätzen verteilen — anteilig, der Rest nach außen; so wächst die Zahl je Spalte nach außen nie zurück. */
export function verteilen(n: number, plaetze: readonly number[]): number[] {
  const C = plaetze.reduce((a, b) => a + b, 0);
  if (!n || !C) return plaetze.map(() => 0);
  const raus = plaetze.map(c => Math.floor((n * c) / C));
  let rest = n - raus.reduce((a, b) => a + b, 0);
  for (let i = plaetze.length - 1; rest > 0; i = (i - 1 + plaetze.length) % plaetze.length) if (raus[i] < plaetze[i]) { raus[i]++; rest--; }
  return raus;
}

/** Halbhöhe eines Stapels über bzw. unter der Mittellinie (n Kacheln + halbe Gasse). */
const stapelHalb = (n: number) => (n ? FLIEGE.gasse / 2 + n * FLIEGE.kachel.h + (n - 1) * FLIEGE.zeile : 0);
/** Schrift der Beschriftung eines Wegs: normal bzw. in der Zoomstufe „fern“ (Gesamtansicht ≈ 0,44 → ≈ 10 px auf dem Bildschirm). */
export const WEG_TEXT = { nah: 13, fern: 22 } as const;
/** Maße der Beschriftung eines Wegs (die Marke, die die Zeichnung setzt — components/os/prozesse/Bilder.tsx `WegText`). */
export const wegTextMass = (t: string, g: number): { b: number; h: number } => ({ b: Math.max(28, textBreite(t, g) + g * 1.1), h: Math.round(g * 1.85) });

/**
 * Wo eine Beschriftung am Weg steht: unter den Stellen `auswahl` (Anteile der Weglänge) die, an der die Marke am wenigsten Kacheln verdeckt (die eigenen Enden
 * zählen mit — eine Marke über dem Titel einer Kachel ist genauso störend); bei Gleichstand die nächste an der Mitte.
 */
export function textOrtWaehlen(punkte: readonly Pt[], mass: { b: number; h: number }, kacheln: readonly Box[], auswahl: readonly number[] = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82]): [number, number] {
  let best: [number, number] = wegPunkt(punkte, auswahl[0]);
  let wert = Infinity;
  for (const t of auswahl) {
    const o = wegPunkt(punkte, t);
    const x0 = o[0] - mass.b / 2, y0 = o[1] - mass.h / 2;
    let flaeche = 0;
    for (const k of kacheln) {
      const w = Math.min(x0 + mass.b, k.x + k.b) - Math.max(x0, k.x), h = Math.min(y0 + mass.h, k.y + k.h) - Math.max(y0, k.y);
      if (w > 0 && h > 0) flaeche += w * h;
    }
    const v = flaeche + Math.abs(t - 0.5);
    if (v < wert) { wert = v; best = o; }
  }
  return best;
}

interface Ort { k: KachelLage; spalte: number; haelfte: 'oben' | 'unten' | 'mitte' | null; reihe: number; bandZeile: number; bandPos: number }

/**
 * Was die Landkarte anpassen darf (22.10., lib/prozesse/landkarte-anpassung.ts `landkarteAnsicht`): Namen und Sätze der Bereiche, eigene Bereiche als Bänder
 * oben (unter Führung) bzw. unten (unter Unterstützung). Ohne Angabe die Vorgabe — dieselbe Lage wie vorher (bit-gleich).
 */
export interface FliegeOptionen { bereiche?: readonly { id: string; art: 'stufe' | 'band' | 'eigen'; titel: string; satz?: string; lage?: 'oben' | 'unten' }[] }
interface BandPlan { id: string; titel: string; satz: string; typ: Exclude<Band, 'kern'>; eigen: boolean }

/** Die Lage der Landkarte als Fliege (siehe Kopf). Reihenfolge der Kacheln = Reihenfolge der Prozesse (Register zuerst, dann Vorlagen). */
export function fliegeLage(prozesse: readonly ProzessDef[], o: FliegeOptionen = {}): FliegeLage {
  const F = FLIEGE;
  const K = { b: kachelBreite(prozesse), h: F.kachel.h };
  const kacheln: KachelLage[] = [];
  const orte = new Map<string, Ort>();
  const baender: BandLage[] = [];
  const anders = (id: string) => o.bereiche?.find(b => b.id === id);
  const bandPlan = (id: Exclude<Band, 'kern'>): BandPlan => { const b = BAENDER.find(x => x.id === id)!, a = anders(id); return { id, titel: a?.titel ?? b.titel, satz: a?.satz ?? b.satz, typ: id, eigen: false }; };
  const eigeneBaender = (lage: 'oben' | 'unten'): BandPlan[] => (o.bereiche ?? []).filter(b => b.art === 'eigen' && (b.lage ?? 'unten') === lage)
    .map(b => ({ id: b.id, titel: b.titel, satz: b.satz ?? '', typ: lage === 'oben' ? 'fuehrung' : 'unterstuetzung', eigen: true }));

  // ── Spalten der Fliege planen: je Flügel vom Knoten nach außen, jede Spalte eine Zeile je Hälfte mehr ──
  const kern = prozesse.filter(p => p.band === 'kern');
  const je = new Map<KernStufe, ProzessDef[]>(KERN_STUFEN.map(s => [s.id, kern.filter(p => stufeVon(p) === s.id)]));
  const links = KERN_STUFEN.filter(s => s.seite === 'gewinnen').map(s => s.id).reverse();
  const rechts = KERN_STUFEN.filter(s => s.seite === 'liefern').map(s => s.id);
  const knotenStufen = KERN_STUFEN.filter(s => s.seite === 'knoten').map(s => s.id);
  interface Plan { stufe: KernStufe; seite: FluegelSeite; tiefe: number; zeilen: number; anzahl: number; innen: boolean }
  const fluegel = (stufen: KernStufe[], seite: FluegelSeite): Plan[] => {
    let tiefe = 0;
    const raus: Plan[] = [];
    stufen.forEach((st, si) => {
      const n = je.get(st)?.length ?? 0;
      const zeilen: number[] = [];
      let platz = 0;
      do { const z = F.zeilenInnen + tiefe + zeilen.length; zeilen.push(z); platz += 2 * z; } while (platz < n);
      verteilen(n, zeilen.map(z => 2 * z)).forEach((anzahl, j) => raus.push({ stufe: st, seite, tiefe: tiefe + j, zeilen: zeilen[j], anzahl, innen: si === 0 }));
      tiefe += zeilen.length;
    });
    return raus;
  };
  const planL = fluegel(links, 'links'), planR = fluegel(rechts, 'rechts');
  // Von links nach rechts: linker Flügel (außen zuerst), Knoten, rechter Flügel.
  const knotenAnzahl = knotenStufen.reduce((a, s) => a + (je.get(s)?.length ?? 0), 0);
  const reihe: (Plan & { b: number })[] = [
    ...[...planL].reverse().map(p => ({ ...p, b: K.b })),
    ...knotenStufen.map(st => ({ stufe: st, seite: 'knoten' as const, tiefe: 0, zeilen: 0, anzahl: je.get(st)?.length ?? 0, innen: true, b: knotenAnzahl ? K.b : F.knotenLeer })),
    ...planR.map(p => ({ ...p, b: K.b })),
  ];
  const xs: number[] = [];
  let x = F.rand;
  reihe.forEach((s, i) => { if (i) x += reihe[i - 1].stufe === s.stufe ? F.unterspalte : F.spalte; xs.push(r1(x)); x += s.b; });
  const innenX = F.rand, innenB = r1(x - F.rand);

  // ── Band (Führung bzw. Unterstützung, eigene Bereiche): Kacheln mittig in Zeilen ──
  const band = (bp: BandPlan, y0: number): number => {
    const l = prozesse.filter(p => (bp.eigen ? p.bereichEigen === bp.id : p.band === bp.typ && !p.bereichEigen));
    if (!l.length) return y0;
    const r = reiheVerteilen({ anzahl: l.length, x: innenX, breite: innenB, luecke: F.bandLuecke, kachel: K.b });
    const zeilen = Math.max(...r.map(z => z.zeile)) + 1;
    const proZeile = new Map<number, number>();
    l.forEach((p, i) => {
      const k: KachelLage = { id: p.id, band: bp.typ, ...(bp.eigen ? { bereich: bp.id } : {}), x: r[i].x, y: r1(y0 + F.kopf + r[i].zeile * (K.h + F.zeile)), b: K.b, h: K.h };
      kacheln.push(k);
      const pos = proZeile.get(r[i].zeile) ?? 0;
      proZeile.set(r[i].zeile, pos + 1);
      orte.set(p.id, { k, spalte: -1, haelfte: null, reihe: -1, bandZeile: r[i].zeile, bandPos: pos });
    });
    const h = F.kopf + zeilen * K.h + (zeilen - 1) * F.zeile + F.innen;
    baender.push({ id: bp.id, titel: bp.titel, satz: bp.satz, x: r1(innenX - F.innen - 20), y: r1(y0), b: r1(innenB + 2 * (F.innen + 20)), h: r1(h) });
    return y0 + h;
  };
  /** Bänder untereinander (je mit Abstand zum vorigen, das erste ab `y0`); gibt die Unterkante des letzten gezeichneten zurück (ohne Band: `y0`). */
  const stapelBaender = (l: readonly BandPlan[], y0: number, abstandVorne: boolean): number => {
    let y = y0, erstes = true;
    for (const bp of l) {
      const start = erstes ? (abstandVorne ? y + F.abstand : y) : y + F.abstand;
      const neu = band(bp, start);
      if (neu !== start) { y = neu; erstes = false; }
    }
    return y;
  };

  const obenBaender = [bandPlan('fuehrung'), ...eigeneBaender('oben')];
  const y = stapelBaender(obenBaender, 0, false);
  const hatFuehrung = baender.length > 0;
  const oben = r1(y + (hatFuehrung ? F.abstand : 0));

  // ── Halbhöhen: Inhalt je Spalte, Umriss je Flügel vom Knoten nach außen steigend ──
  const inhalt = reihe.map(s => {
    if (s.seite === 'knoten') return s.anzahl ? (s.anzahl * K.h + (s.anzahl - 1) * F.zeile) / 2 : 0;
    return s.anzahl ? stapelHalb(Math.ceil(s.anzahl / 2)) + F.luft : 0;
  });
  const knotenHalb = r1(Math.max(...reihe.map((s, i) => (s.seite === 'knoten' ? inhalt[i] : 0)), F.gasse / 2) + F.knotenLuft);
  const halb = reihe.map(() => 0);
  for (const seite of ['links', 'rechts'] as const) {
    const idx = reihe.map((s, i) => i).filter(i => reihe[i].seite === seite).sort((a, b) => reihe[a].tiefe - reihe[b].tiefe);
    let davor = knotenHalb;
    for (const i of idx) {
      const s = reihe[i];
      davor = r1(Math.max(inhalt[i], s.innen ? F.minHalb.innen : F.minHalb.aussen, davor + F.weitung));
      halb[i] = davor;
    }
  }
  reihe.forEach((s, i) => { if (s.seite === 'knoten') halb[i] = knotenHalb; });
  const maxHalb = Math.max(...halb);
  const mitte = r1(oben + F.stufenKopf + maxHalb);

  // ── Kacheln in die Spalten: Stufe für Stufe in Lesereihenfolge, Spalte für Spalte von links, je Spalte oben → unten ──
  const stufeIds = new Map<KernStufe, string[]>(KERN_STUFEN.map(s => [s.id, (je.get(s.id) ?? []).map(p => p.id)]));
  const genommen = new Map<KernStufe, number>();
  reihe.forEach((s, i) => {
    const ids = stufeIds.get(s.stufe) ?? [];
    const ab = genommen.get(s.stufe) ?? 0;
    const meine = ids.slice(ab, ab + s.anzahl);
    genommen.set(s.stufe, ab + s.anzahl);
    if (s.seite === 'knoten') {
      const start = mitte - inhalt[i];
      meine.forEach((id, j) => {
        const k: KachelLage = { id, band: 'kern', stufe: s.stufe, x: xs[i], y: r1(start + j * (K.h + F.zeile)), b: K.b, h: K.h };
        kacheln.push(k);
        orte.set(id, { k, spalte: i, haelfte: 'mitte', reihe: j, bandZeile: -1, bandPos: -1 });
      });
      return;
    }
    const obenN = Math.ceil(meine.length / 2);
    const obenStart = mitte - F.gasse / 2 - (obenN * K.h + Math.max(0, obenN - 1) * F.zeile);
    meine.forEach((id, j) => {
      const imOben = j < obenN;
      const yk = imOben ? obenStart + j * (K.h + F.zeile) : mitte + F.gasse / 2 + (j - obenN) * (K.h + F.zeile);
      const k: KachelLage = { id, band: 'kern', stufe: s.stufe, x: xs[i], y: r1(yk), b: K.b, h: K.h };
      kacheln.push(k);
      orte.set(id, { k, spalte: i, haelfte: imOben ? 'oben' : 'unten', reihe: imOben ? obenN - 1 - j : j - obenN, bandZeile: -1, bandPos: -1 });
    });
  });

  // ── Der Umriss: über jeder Spalte flach, dazwischen weich; außen gerade bis an den Rand ──
  const x0 = r1(innenX - 36), x1 = r1(innenX + innenB + 36);
  const ersteH = halb[0], letzteH = halb[halb.length - 1];
  const kante = (vorz: 1 | -1): string => {
    // Punkte von links nach rechts: (x, halb) — Enden, Spaltenränder.
    const pt: [number, number][] = [[x0, ersteH]];
    reihe.forEach((s, i) => { pt.push([xs[i], halb[i]]); pt.push([r1(xs[i] + s.b), halb[i]]); });
    pt.push([x1, letzteH]);
    const lauf = vorz === 1 ? pt : [...pt].reverse();
    const yv = (h: number) => r1(mitte - vorz * h);
    let d = `${vorz === 1 ? 'M' : 'L'}${lauf[0][0]} ${yv(lauf[0][1])}`;
    for (let i = 1; i < lauf.length; i++) {
      const a = lauf[i - 1], b = lauf[i];
      if (a[1] === b[1]) { d += ` L${b[0]} ${yv(b[1])}`; continue; }
      const m = r1((b[0] - a[0]) / 2);
      d += ` C${r1(a[0] + m)} ${yv(a[1])} ${r1(b[0] - m)} ${yv(b[1])} ${b[0]} ${yv(b[1])}`;
    }
    return d;
  };
  const pfad = `${kante(1)} ${kante(-1)} Z`;
  const kernUnten = r1(mitte + maxHalb);

  // ── Stufen: Bereich ihrer Spalten, Titel über dem Umriss (folgt der Form der Fliege) ──
  const stufen: StufeLage[] = KERN_STUFEN.map(s => {
    const is = reihe.map((r, i) => i).filter(i => reihe[i].stufe === s.id);
    const xa = Math.min(...is.map(i => xs[i])), xb = Math.max(...is.map(i => xs[i] + reihe[i].b));
    const h = Math.max(...is.map(i => halb[i]));
    return { id: s.id, titel: anders(s.id)?.titel ?? s.titel, x: r1(xa), b: r1(xb - xa), cx: r1((xa + xb) / 2), halb: r1(h), titelY: r1(mitte - h - 22) };
  });
  const spalten: SpalteLage[] = reihe.map((s, i) => ({ stufe: s.stufe, seite: s.seite, tiefe: s.tiefe, x: xs[i], b: s.b, halb: halb[i], inhalt: r1(inhalt[i]), zeilen: s.zeilen }));
  const ki = reihe.findIndex(s => s.seite === 'knoten');
  const knoten: Box = ki >= 0 ? { x: r1(xs[ki] - 16), y: r1(mitte - knotenHalb), b: r1(reihe[ki].b + 32), h: r1(2 * knotenHalb) } : { x: r1((x0 + x1) / 2), y: mitte, b: 0, h: 0 };
  const L = x1 - x0;
  const toene = stufen.map(s => ({ stufe: s.id, bei: r1(((s.cx - x0) / L) * 1000) / 1000 }));

  stapelBaender([bandPlan('unterstuetzung'), ...eigeneBaender('unten')], kernUnten, true);

  // ── Der Weg des Kunden durch die Gasse und den Knoten ──
  const rueckgrat = {
    punkte: [[x0, mitte], [x1, mitte]] as [number, number][],
    abschnitte: stufen.map((s, i) => ({
      stufe: s.id,
      von: i ? r1((((stufen[i - 1].x + stufen[i - 1].b + s.x) / 2 - x0) / L) * 1000) / 1000 : 0,
      bis: i < stufen.length - 1 ? r1((((s.x + s.b + stufen[i + 1].x) / 2 - x0) / L) * 1000) / 1000 : 1,
    })),
  };

  // Die Gasse ist für den Weg des Kunden da: lange Wege kreuzen sie höchstens, laufen nie in ihr entlang (in Stücken — ein Weg entlang träfe viele).
  const gasse: Box[] = [];
  for (let gx = x0; gx < x1; gx += 96) gasse.push({ x: r1(gx), y: r1(mitte - F.gasse / 2 + 4), b: r1(Math.min(96, x1 - gx)), h: F.gasse - 8 });
  const pfeile = uebergabenLegen(prozesse, kacheln, orte, gasse);
  const kernBox: Box = { x: x0, y: oben, b: r1(x1 - x0), h: r1(kernUnten - oben) };
  // Lange Wege (nur mit Fokus) zählen nicht zum Bild — „Alles zeigen“ zeigt die Landkarte so groß wie möglich; ein Weg außen herum darf am Rand stehen.
  const alles = huelle([...baender, kernBox, ...kacheln], 0);
  const rahmen: RahmenLage[] = [{ id: 'alles', titel: 'Die ganze Firma', box: huelle([alles], 40) }];
  // Rahmen der Bänder in der Reihenfolge des Bilds: oben (Führung, eigene oben), die Stufen, unten (Unterstützung, eigene unten).
  const obenIds = new Set(obenBaender.map(b => b.id));
  for (const b of baender.filter(x => obenIds.has(x.id))) rahmen.push({ id: b.id, titel: b.titel, box: huelle([b], 30) });
  for (const s of stufen) {
    const ks = kacheln.filter(k => k.stufe === s.id);
    rahmen.push({ id: s.id, titel: s.titel, box: huelle([{ x: s.x, y: r1(s.titelY - 40), b: s.b, h: r1(mitte + s.halb - s.titelY + 40) }, ...ks], 40) });
  }
  for (const b of baender.filter(x => !obenIds.has(x.id))) rahmen.push({ id: b.id, titel: b.titel, box: huelle([b], 30) });
  return {
    breite: r1(innenB + 2 * F.rand), hoehe: r1(alles.y + alles.h), box: alles, baender,
    fliege: { pfad, mitte, x0, x1, stufen, spalten, knoten, caption: [r1(knoten.x + knoten.b / 2), r1(oben + 22)], toene, oben },
    kacheln, pfeile, rueckgrat, rahmen,
  };
}

// ── Übergaben: kurz und ruhig zwischen Nachbarn, alles andere nur mit Fokus ───────────────────────────────────────────────────────────

type KSeite = 'l' | 'r' | 'o' | 'u';
interface Kandidat { id: string; von: string; nach: string; text: string; art: 'weiter' | 'zurueck'; achse: 'quer' | 'hoch'; sa: KSeite; sb: KSeite; rang: number; nr: number }

/** Sind zwei Kacheln Nachbarn (benachbarte Spalten der Fliege, übereinander in derselben Hälfte bzw. im Knoten, nebeneinander in einer Bandzeile)? */
function nachbarn(a: Ort, b: Ort): { achse: 'quer' | 'hoch'; sa: KSeite; sb: KSeite } | null {
  if (a.spalte >= 0 && b.spalte >= 0) {
    if (Math.abs(a.spalte - b.spalte) === 1) return b.spalte > a.spalte ? { achse: 'quer', sa: 'r', sb: 'l' } : { achse: 'quer', sa: 'l', sb: 'r' };
    if (a.spalte === b.spalte && a.haelfte === b.haelfte && Math.abs(a.k.y - b.k.y) <= a.k.h + FLIEGE.zeile + 0.5) return b.k.y > a.k.y ? { achse: 'hoch', sa: 'u', sb: 'o' } : { achse: 'hoch', sa: 'o', sb: 'u' };
    return null;
  }
  if (a.spalte < 0 && b.spalte < 0 && (a.k.bereich ?? a.k.band) === (b.k.bereich ?? b.k.band) && a.bandZeile === b.bandZeile && Math.abs(a.bandPos - b.bandPos) === 1) {
    return b.k.x > a.k.x ? { achse: 'quer', sa: 'r', sb: 'l' } : { achse: 'quer', sa: 'l', sb: 'r' };
  }
  return null;
}

/** Anschlüsse verteilen: je Kachel und Seite die Wege nach der Lage ihres anderen Endes sortiert, gleichmäßig über die Kante — so kreuzen sich Wege an einer Kachel nie. */
function anschluesse(ks: readonly Kandidat[], orte: ReadonlyMap<string, Ort>): Map<string, { a: Pt; b: Pt }> {
  const gruppen = new Map<string, { kid: string; seite: KSeite; e: Kandidat; anderes: KachelLage }[]>();
  const dazu = (kid: string, seite: KSeite, e: Kandidat, anderes: string) => {
    const g = gruppen.get(`${kid}:${seite}`) ?? [];
    g.push({ kid, seite, e, anderes: orte.get(anderes)!.k });
    gruppen.set(`${kid}:${seite}`, g);
  };
  for (const e of ks) { dazu(e.von, e.sa, e, e.nach); dazu(e.nach, e.sb, e, e.von); }
  const pos = new Map<string, Pt>();
  for (const g of gruppen.values()) {
    const quer = g[0].seite === 'l' || g[0].seite === 'r';
    g.sort((p, q) => (quer ? p.anderes.y + p.anderes.h / 2 - (q.anderes.y + q.anderes.h / 2) : p.anderes.x - q.anderes.x) || (p.e.nr - q.e.nr));
    const k = orte.get(g[0].kid)!.k;
    g.forEach((x, i) => {
      const p: Pt = quer
        ? [x.seite === 'r' ? k.x + k.b : k.x, r1(k.y + (k.h * (i + 1)) / (g.length + 1))]
        : [r1(k.x + 44 + i * 30), x.seite === 'u' ? k.y + k.h : k.y];
      pos.set(`${x.e.id}:${x.kid === x.e.von && x.seite === x.e.sa ? 'a' : 'b'}`, p);
    });
  }
  const raus = new Map<string, { a: Pt; b: Pt }>();
  for (const e of ks) raus.set(e.id, { a: pos.get(`${e.id}:a`)!, b: pos.get(`${e.id}:b`)! });
  return raus;
}

const wegVon = (e: Kandidat, ab: { a: Pt; b: Pt }): Pt[] => kurve(ab.a, ab.b, e.achse, e.achse === 'quer' ? 16 : 6);

function uebergabenLegen(prozesse: readonly ProzessDef[], kacheln: readonly KachelLage[], orte: ReadonlyMap<string, Ort>, gasse: readonly Box[]): PfeilLage[] {
  const hindernisse: Box[] = [...kacheln.map(k => ({ x: k.x, y: k.y, b: k.b, h: k.h })), ...gasse];
  const alle: { e: Omit<Kandidat, 'achse' | 'sa' | 'sb' | 'rang'>; n: ReturnType<typeof nachbarn> }[] = [];
  let nr = 0;
  for (const p of prozesse) for (const u of p.uebergaben ?? []) {
    const a = orte.get(p.id), b = orte.get(u.nach);
    if (!a || !b || a.k.id === b.k.id) continue;
    const zurueck = a.spalte >= 0 && b.spalte >= 0 && b.spalte < a.spalte;
    alle.push({ e: { id: `${a.k.id}>${b.k.id}`, von: a.k.id, nach: b.k.id, text: u.text, art: zurueck ? 'zurueck' : 'weiter', nr: nr++ }, n: nachbarn(a, b) });
  }
  // Kandidaten für die Gesamtansicht: Nachbarn, die nicht zu steil steigen — übereinander zuerst (kurz), dann nach Steigung, dann in Reihenfolge.
  const kandidaten: Kandidat[] = alle.filter(x => x.n).map(x => {
    const a = orte.get(x.e.von)!.k, b = orte.get(x.e.nach)!.k;
    const dy = Math.abs(a.y - b.y);
    return { ...x.e, ...x.n!, rang: x.n!.achse === 'hoch' ? -1 : dy };
  }).filter(e => e.achse === 'hoch' || e.rang <= FLIEGE.ruhig).sort((p, q) => p.rang - q.rang || p.nr - q.nr);
  // Gierig: ein Weg kommt dazu, wenn er mit den Anschlüssen aller schon gewählten keinen kreuzt.
  let gewaehlt: Kandidat[] = [];
  let wege = new Map<string, Pt[]>();
  for (const c of kandidaten) {
    const probe = [...gewaehlt, c];
    const ab = anschluesse(probe, orte);
    const w = new Map(probe.map(e => [e.id, wegVon(e, ab.get(e.id)!)] as [string, Pt[]]));
    let frei = true;
    for (let i = 0; i < probe.length && frei; i++) for (let j = i + 1; j < probe.length && frei; j++) if (wegeKreuzen(w.get(probe[i].id)!, w.get(probe[j].id)!)) frei = false;
    if (frei) { gewaehlt = probe; wege = w; }
  }
  const immer = new Set(gewaehlt.map(e => e.id));
  // Beschriftungen in der Gesamtansicht nur, wo sie Platz haben (Lücke breit genug) und keine andere überdecken.
  const belegt: Box[] = [];
  const raus: PfeilLage[] = [];
  for (const { e } of alle) {
    if (immer.has(e.id)) {
      const c = gewaehlt.find(x => x.id === e.id)!;
      const punkte = wege.get(e.id)!;
      const m = wegTextMass(e.text, WEG_TEXT.nah), mf = wegTextMass(e.text, WEG_TEXT.fern);
      // Übereinander: die Beschriftung als Marke zwischen den Kacheln, links am Weg beginnend (nie in die Lücke daneben, wo andere Wege laufen).
      const mitteWeg = wegPunkt(punkte, 0.5);
      const ort: [number, number] = c.achse === 'hoch' ? [Math.round(punkte[0][0] - 14 + m.b / 2), mitteWeg[1]] : textOrtWaehlen(punkte, m, kacheln);
      const ortFern: [number, number] = c.achse === 'hoch' ? [Math.round(punkte[0][0] - 14 + mf.b / 2), mitteWeg[1]] : textOrtWaehlen(punkte, mf, kacheln);
      const luecke = c.achse === 'quer' ? Math.abs(punkte[punkte.length - 1][0] - punkte[0][0]) : Infinity;
      const kasten: Box = { x: ort[0] - m.b / 2, y: ort[1] - m.h / 2, b: m.b, h: m.h };
      const frei = m.b <= luecke - 10 && !belegt.some(b => kasten.x < b.x + b.b && b.x < kasten.x + kasten.b && kasten.y < b.y + b.h && b.y < kasten.y + kasten.h);
      if (frei) belegt.push(kasten);
      raus.push({ id: e.id, von: e.von, nach: e.nach, text: e.text, art: e.art, punkte, textOrt: ort, textOrtFern: ortFern, textFrei: frei, sicht: 'immer' });
      continue;
    }
    const a = orte.get(e.von)!.k, b = orte.get(e.nach)!.k;
    const punkte = pfeilWeg(a, b, hindernisse, e.art === 'zurueck' ? 'zurueck' : 'weiter');
    const auswahl = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82, 0.1, 0.9];
    raus.push({
      id: e.id, von: e.von, nach: e.nach, text: e.text, art: e.art, punkte,
      textOrt: textOrtWaehlen(punkte, wegTextMass(e.text, WEG_TEXT.nah), kacheln, auswahl), textOrtFern: textOrtWaehlen(punkte, wegTextMass(e.text, WEG_TEXT.fern), kacheln, auswahl),
      textFrei: false, sicht: 'fokus',
    });
  }
  return raus;
}

/**
 * Welche Übergaben ein Bild zeigt — EINE Regel für Zeichnung und Flow (Befund 21.10.: „Linien-Durcheinander“): ohne Fokus nur die kurzen Wege zwischen
 * Nachbarn (leise); mit Fokus (überfahrene bzw. gewählte Kacheln, beim Präsentieren die Kacheln des Rahmens) dazu deren lange Wege, und alle Wege dieser
 * Kacheln hell und beschriftet. `nurAus`: nur Wege, die von einer Fokus-Kachel ausgehen (Präsentieren — die Geschichte läuft vorwärts).
 */
export function pfeileImBild(pfeile: readonly PfeilLage[], fokus: readonly string[], o: { nurAus?: boolean } = {}): { pfeil: PfeilLage; hell: boolean }[] {
  const f = new Set(fokus);
  const raus: { pfeil: PfeilLage; hell: boolean }[] = [];
  for (const p of pfeile) {
    const beruehrt = f.has(p.von) || (!o.nurAus && f.has(p.nach));
    if (p.sicht === 'fokus' && !beruehrt) continue;
    raus.push({ pfeil: p, hell: beruehrt });
  }
  // Helle Wege zuletzt (liegen oben).
  return raus.sort((a, b) => Number(a.hell) - Number(b.hell));
}

// ── Ebene 2: ein Prozess ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Maße von Ebene 2 (Bildpunkte der Fläche). Befund 21.10. (Sichtprüfung 1440 px): mit großen Lücken und weit abgesetzten Übergaben stand die Phasenkette winzig
 * in der Mitte einer großen Bühne (Schrift ≈ 5 px). Jetzt: schmalere Lücken, höchstens `jeZeile` Phasen je Zeile (mehr brechen in die nächste Zeile um — der
 * Weg läuft im Z zurück an den Anfang), Übergaben dicht daneben (dürfen am Rand angeschnitten sein). Die Kamera passt auf die KETTE ein (`einpassBox`).
 */
export const PROZESS_MASS = { phase: { b: 280, kopf: 80, zeile: 28 }, marke: { b: 160, h: 64 }, geist: { b: 240, h: 72 }, luecke: 56, zeilenLuecke: 72, geistLuecke: 72, zeigen: 4, jeZeile: 4 } as const;
/**
 * Schrift der Phasen-Titel auf Ebene 2 (Bildpunkte der Fläche): weit weg groß (die Kette wird ganz eingepasst — Zoom um 0,4 auf einer Bühne neben dem Steckbrief),
 * damit der Titel auf dem Bildschirm mindestens 12 px hat (Wächter tests/prozesse-oberflaeche.test.ts › Einpassung).
 */
export const PHASE_TITEL = { fern: 34, fernMin: 30, mittel: 19, mittelMin: 15 } as const;

export interface PhaseLage extends Box { id: string; nr: number; titel: string; zeilen: string[]; mehr: number }
export interface GeistLage extends Box { id: string; titel: string; text: string; richtung: 'von' | 'an' }
export interface ProzessLage {
  box: Box; mitte: number;
  /** Start, Phasen und Ergebnis ohne die Übergaben — darauf passt die Kamera beim Hineinfahren ein (`einpassBox`). */
  kette: Box;
  start: Box & { titel: string }; ende: Box & { titel: string };
  phasen: PhaseLage[]; geister: GeistLage[];
  /** Der Weg durch den Prozess (Start → Phasen → Ergebnis) — als Lichtfaden; die Kacheln liegen darüber, er leuchtet in den Lücken. */
  weg: [number, number][];
  pfeile: PfeilLage[];
  rahmen: RahmenLage[];
}

/** Die Lage eines Prozesses auf Ebene 2 (siehe Kopf). `alle` = alle Prozesse (für die Übergaben von und an). */
export function prozessLage(p: ProzessDef, alle: readonly ProzessDef[]): ProzessLage {
  const M = PROZESS_MASS;
  // Ebene 2 zeigt je Phase nur den Hauptweg (ohne Nein-Zweige) — Rauten und Erinnerungen gehören erst in den Ablauf (Ebene 3, Punkt 5).
  const hauptweg = p.phasen.map(ph => ph.schritte.filter(x => !neinVon(ph, x.id)));
  const hoehen = hauptweg.map(l => M.phase.kopf + Math.min(M.zeigen, l.length) * M.phase.zeile + (l.length > M.zeigen ? M.phase.zeile : 0) + 14);
  // Zeilen zu höchstens `jeZeile` Phasen; jede Zeile so hoch wie ihre höchste Phase.
  const zeilen: number[][] = [];
  p.phasen.forEach((_, i) => { if (i % M.jeZeile === 0) zeilen.push([]); zeilen[zeilen.length - 1].push(i); });
  if (!zeilen.length) zeilen.push([]);
  const zeilenH = zeilen.map(z => Math.max(M.marke.h, ...z.map(i => hoehen[i])));
  const oben: number[] = [];
  zeilenH.reduce((y, h, r) => { oben[r] = y; return y + h + M.zeilenLuecke; }, 0);
  const mitteVon = (r: number) => r1(oben[r] + zeilenH[r] / 2);
  const mitte = mitteVon(0);
  const x0 = M.marke.b + M.luecke;
  const start = { x: 0, y: r1(mitte - M.marke.h / 2), b: M.marke.b, h: M.marke.h, titel: p.steckbrief.ausloeser };
  const phasen: PhaseLage[] = p.phasen.map((ph, i) => {
    const r = Math.floor(i / M.jeZeile), j = i % M.jeZeile;
    const h = hoehen[i];
    return { id: ph.id, nr: i + 1, titel: ph.titel, x: x0 + j * (M.phase.b + M.luecke), y: r1(mitteVon(r) - h / 2), b: M.phase.b, h, zeilen: hauptweg[i].slice(0, M.zeigen).map(s => s.titel), mehr: Math.max(0, hauptweg[i].length - M.zeigen) };
  });
  const letzteZeile = zeilen.length - 1;
  const letzte = phasen.at(-1);
  const endeX = letzte ? letzte.x + letzte.b + M.luecke : x0;
  const mitteEnde = mitteVon(letzteZeile);
  const ende = { x: endeX, y: r1(mitteEnde - M.marke.h / 2), b: M.marke.b, h: M.marke.h, titel: p.steckbrief.ergebnis };
  // Der Weg: eine Zeile = eine Gerade; mehr Zeilen = ein Z (am Ende einer Zeile durch die Lücke zurück an den Anfang der nächsten).
  const weg: [number, number][] = [[start.x + start.b / 2, mitte]];
  zeilen.forEach((z, r) => {
    if (r === letzteZeile) return;
    const rechts = r1(phasen[z[z.length - 1]].x + M.phase.b + M.luecke / 2), links = r1(x0 - M.luecke / 2), luecke = r1(oben[r] + zeilenH[r] + M.zeilenLuecke / 2);
    weg.push([rechts, mitteVon(r)], [rechts, luecke], [links, luecke], [links, mitteVon(r + 1)]);
  });
  weg.push([ende.x + ende.b / 2, mitteEnde]);
  // Geister: wer an diesen Prozess übergibt (links), an wen er übergibt (rechts).
  const von = alle.filter(q => q.id !== p.id && (q.uebergaben ?? []).some(u => u.nach === p.id)).map(q => ({ q, text: q.uebergaben!.find(u => u.nach === p.id)!.text }));
  const an = (p.uebergaben ?? []).map(u => ({ q: alle.find(x => x.id === u.nach), text: u.text })).filter((x): x is { q: ProzessDef; text: string } => !!x.q && x.q.id !== p.id);
  const stapel = (n: number, i: number) => r1(mitte - (n * M.geist.h + (n - 1) * 20) / 2 + i * (M.geist.h + 20));
  const geister: GeistLage[] = [
    ...von.map(({ q, text }, i) => ({ id: q.id, titel: q.titel, text, richtung: 'von' as const, x: -(M.geist.b + M.geistLuecke), y: stapel(von.length, i), b: M.geist.b, h: M.geist.h })),
    ...an.map(({ q, text }, i) => ({ id: q.id, titel: q.titel, text, richtung: 'an' as const, x: r1(ende.x + ende.b + M.geistLuecke), y: r1(stapel(an.length, i) + mitteEnde - mitte), b: M.geist.b, h: M.geist.h })),
  ];
  // Wege von und zu den Geistern: weiche Kurven, die Anschlüsse am Start bzw. Ergebnis über die Kante verteilt (in der Reihenfolge der Geister) — so laufen
  // sie nebeneinander ein, nie übereinander und nie über Kreuz. Die Beschriftung steht nah am Geist (dort liegen die Wege am weitesten auseinander).
  const kanteVerteilt = (b: Box, i: number, n: number): number => r1(b.y + (b.h * (i + 1)) / (n + 1));
  const vonG = geister.filter(g => g.richtung === 'von'), anG = geister.filter(g => g.richtung === 'an');
  const pfeile: PfeilLage[] = [
    ...vonG.map((g, i) => {
      const punkte = kurve([g.x + g.b, g.y + g.h / 2], [start.x, kanteVerteilt(start, i, vonG.length)], 'quer');
      const ort = wegPunkt(punkte, 0.32);
      return { id: `von:${g.id}`, von: g.id, nach: p.id, text: g.text, art: 'weiter' as const, punkte, textOrt: ort, textOrtFern: ort, textFrei: true, sicht: 'immer' as const };
    }),
    ...anG.map((g, i) => {
      const punkte = kurve([ende.x + ende.b, kanteVerteilt(ende, i, anG.length)], [g.x, g.y + g.h / 2], 'quer');
      const ort = wegPunkt(punkte, 0.68);
      return { id: `an:${g.id}`, von: p.id, nach: g.id, text: g.text, art: 'weiter' as const, punkte, textOrt: ort, textOrtFern: ort, textFrei: true, sicht: 'immer' as const };
    }),
  ];
  const kette = huelle([start, ende, ...phasen], 0);
  const box = huelle([kette, ...geister], 0);
  const rahmen: RahmenLage[] = [{ id: 'alles', titel: p.titel, box: huelle([kette], 40) }, ...phasen.map(ph => ({ id: ph.id, titel: ph.titel, box: huelle([ph], 60) }))];
  return { box, kette, mitte, start, ende, phasen, geister, weg, pfeile, rahmen };
}

/** Worauf die Kamera auf Ebene 2 einpasst: die Kette (Start, Phasen, Ergebnis) mit schmalem Rand — die Übergaben links und rechts dürfen angeschnitten sein. */
export const einpassBox = (l: Pick<ProzessLage, 'kette'>): Box => huelle([l.kette], 24);

/** Wohin eine Kachel bzw. Phase im Bild zeigt (für Kamerafahrt, Minimap, Suche): Kennung → Box. */
export function boxenVon(l: { kacheln?: readonly KachelLage[]; phasen?: readonly PhaseLage[]; geister?: readonly GeistLage[] }): Map<string, Box> {
  const m = new Map<string, Box>();
  for (const k of l.kacheln ?? []) m.set(k.id, k);
  for (const k of l.phasen ?? []) m.set(k.id, k);
  for (const k of l.geister ?? []) if (!m.has(k.id)) m.set(`geist:${k.id}`, k);
  return m;
}
