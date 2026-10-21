// ─── Prozesse — die Lage der Landkarte als Fliege und des Prozesses (Etappe A, 21.10.; ANALYSE_100.md Punkte 2, 3, 9, 13, 93; Entscheidung E1) ────
// Gerechnet wird NUR hier (Vorbild: das Hochhaus, lib/fulfillment/prozesse/landkarte.ts — die Reihen-Regel teilen sich beide über ./lage.ts); die Zeichnung
// setzt nur die fertigen Lagen. Alles in Bildpunkten der Fläche (Welt), deterministisch, rein (Server UND Browser).
//   · `fliegeLage(prozesse)` — Ebene 1: Band „Führung“ oben, die Fliege im Kern (Marketing → Sales → Übergabe → Fulfillment → Ausbau; links weit, in der
//     Mitte der Knoten, rechts wieder weit), Band „Unterstützung“ unten. Je Stufe eine Spalte, die Kacheln über und unter der Mittellinie — dort läuft der
//     Weg des Kunden als Lichtfaden durch die Gasse (`rueckgrat`). Übergaben (Punkt 9) als gewinkelte Wege um die Kacheln herum (dieselbe Wegsuche wie die
//     Fläche des Editors, `pfeilWeg`), mit Beschriftung; Rückwege (nach links) als „zurück“.
//   · `prozessLage(prozess, alle)` — Ebene 2: Start, die Phasen von links nach rechts mit ihren ersten Schritten, Ergebnis; links, woher der Prozess
//     Übergaben bekommt, rechts, wohin er übergibt (Geister-Kacheln, ein Klick fährt dorthin).
//   · `praesentationsRahmen` — die Rahmen zum Präsentieren (Punkt 93): erst das Ganze, dann Band für Band bzw. Phase für Phase entlang des Flows.

import { pfeilWeg, pfeilTextOrt, type Box } from '@/lib/fulfillment/prozesse/flaeche';
import { BAENDER, KERN_STUFEN, type Band, type KernStufe, type ProzessDef } from './typen';
import { neinVon, stufeVon } from './modell';
import { reiheVerteilen, r1 } from './lage';

/** Maße der Landkarte (Bildpunkte der Fläche). */
export const FLIEGE = {
  kachel: { b: 280, h: 96 },
  /** Waagerecht zwischen zwei Stufen (Platz für Wege und ihre Beschriftung), senkrecht zwischen zwei Kacheln einer Spalte. */
  spalte: 128, zeile: 24,
  /** Die Gasse in der Mitte der Fliege — dort läuft der Weg des Kunden. */
  gasse: 56,
  /** Seitenrand, Kopf eines Bandes (Titel), Innenrand, Abstand der Bänder, Platz für die Stufen-Titel über der Fliege. */
  rand: 80, kopf: 56, innen: 28, abstand: 80, stufenKopf: 44,
  /** Mindest-Halbhöhe der Fliege je Stufe — so bleibt die Form erkennbar, auch mit wenigen Kacheln (der Knoten in der Mitte hat keine). */
  minHalb: { marketing: 250, sales: 190, uebergabe: 0, fulfillment: 190, ausbau: 250 } as Record<KernStufe, number>,
  /** Luft zwischen Kacheln und Umriss der Fliege. */
  luft: 26,
} as const;

export interface KachelLage extends Box { id: string; band: Band; stufe?: KernStufe }
export interface PfeilLage { id: string; von: string; nach: string; text: string; art: 'weiter' | 'zurueck'; punkte: [number, number][]; textOrt: [number, number] }
export interface BandLage extends Box { id: Band; titel: string; satz: string }
export interface StufeLage { id: KernStufe; titel: string; x: number; b: number; cx: number; halb: number }
export interface RahmenLage { id: string; titel: string; box: Box }
export interface FliegeLage {
  breite: number; hoehe: number; box: Box;
  baender: BandLage[];
  fliege: { pfad: string; mitte: number; x0: number; x1: number; stufen: StufeLage[]; titelY: number };
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

/** Halbhöhe eines Stapels über bzw. unter der Mittellinie (n Kacheln + Gasse). */
const stapelHalb = (n: number) => (n ? FLIEGE.gasse / 2 + n * FLIEGE.kachel.h + (n - 1) * FLIEGE.zeile : 0);

/** Die Lage der Landkarte als Fliege (siehe Kopf). Reihenfolge der Kacheln = Reihenfolge der Prozesse (Register zuerst, dann Vorlagen). */
export function fliegeLage(prozesse: readonly ProzessDef[]): FliegeLage {
  const F = FLIEGE, K = F.kachel;
  const kernBreite = KERN_STUFEN.length * K.b + (KERN_STUFEN.length - 1) * F.spalte;
  const breite = 2 * F.rand + kernBreite;
  const innenX = F.rand, innenB = kernBreite;
  const kacheln: KachelLage[] = [];
  const baender: BandLage[] = [];
  const bandInfo = (id: Band) => BAENDER.find(b => b.id === id)!;

  // ── Band (Führung bzw. Unterstützung): Kacheln mittig in Zeilen ──
  const band = (id: Band, y0: number): number => {
    const l = prozesse.filter(p => p.band === id);
    if (!l.length) return y0;
    const reihe = reiheVerteilen({ anzahl: l.length, x: innenX, breite: innenB, luecke: 40, kachel: K.b });
    const zeilen = Math.max(...reihe.map(r => r.zeile)) + 1;
    l.forEach((p, i) => kacheln.push({ id: p.id, band: id, x: reihe[i].x, y: r1(y0 + F.kopf + reihe[i].zeile * (K.h + F.zeile)), b: K.b, h: K.h }));
    const h = F.kopf + zeilen * K.h + (zeilen - 1) * F.zeile + F.innen;
    const b = bandInfo(id);
    baender.push({ id, titel: b.titel, satz: b.satz, x: r1(innenX - F.innen - 20), y: r1(y0), b: r1(innenB + 2 * (F.innen + 20)), h: r1(h) });
    return y0 + h;
  };

  let y = 0;
  y = band('fuehrung', y);
  const hatFuehrung = baender.length > 0;
  // ── Die Fliege ──
  const kern = prozesse.filter(p => p.band === 'kern');
  const spalten = KERN_STUFEN.map((s, i) => {
    const l = kern.filter(p => stufeVon(p) === s.id);
    const oben = Math.ceil(l.length / 2), unten = l.length - oben;
    const halb = Math.max(stapelHalb(oben), stapelHalb(unten)) + (l.length ? F.luft : 0);
    return { s, i, l, oben, unten, x: innenX + i * (K.b + F.spalte), halb: Math.max(halb, F.minHalb[s.id], l.length ? 0 : F.gasse / 2 + 24) };
  });
  const maxHalb = Math.max(...spalten.map(s => s.halb));
  const titelY = r1(y + (hatFuehrung ? F.abstand : 0) + F.stufenKopf / 2);
  const mitte = r1(y + (hatFuehrung ? F.abstand : 0) + F.stufenKopf + maxHalb);
  for (const sp of spalten) {
    const obenStart = mitte - F.gasse / 2 - (sp.oben * K.h + Math.max(0, sp.oben - 1) * F.zeile);
    sp.l.forEach((p, j) => {
      const yk = j < sp.oben ? obenStart + j * (K.h + F.zeile) : mitte + F.gasse / 2 + (j - sp.oben) * (K.h + F.zeile);
      kacheln.push({ id: p.id, band: 'kern', stufe: sp.s.id, x: r1(sp.x), y: r1(yk), b: K.b, h: K.h });
    });
  }
  const x0 = innenX - 40, x1 = innenX + innenB + 40;
  const stufen: StufeLage[] = spalten.map(sp => ({ id: sp.s.id, titel: sp.s.titel, x: r1(sp.x), b: K.b, cx: r1(sp.x + K.b / 2), halb: r1(sp.halb) }));
  // Umriss: weich von Spaltenmitte zu Spaltenmitte, außen gerade bis an den Rand — oben von links nach rechts, unten zurück.
  const kurve = (vorz: 1 | -1) => {
    const pt = stufen.map(s => [s.cx, r1(mitte - vorz * s.halb)] as [number, number]);
    const reihe = vorz === 1 ? pt : [...pt].reverse();
    const anfangX = vorz === 1 ? x0 : x1, endeX = vorz === 1 ? x1 : x0;
    let d = `${vorz === 1 ? 'M' : 'L'}${anfangX} ${reihe[0][1]} L${reihe[0][0]} ${reihe[0][1]}`;
    for (let i = 1; i < reihe.length; i++) {
      const a = reihe[i - 1], b = reihe[i], m = (b[0] - a[0]) / 2;
      d += ` C${r1(a[0] + m)} ${a[1]} ${r1(b[0] - m)} ${b[1]} ${b[0]} ${b[1]}`;
    }
    return `${d} L${endeX} ${reihe[reihe.length - 1][1]}`;
  };
  const pfad = `${kurve(1)} ${kurve(-1)} Z`;
  y = mitte + maxHalb;
  const kernBox: Box = { x: x0, y: r1(mitte - maxHalb), b: r1(x1 - x0), h: r1(2 * maxHalb) };
  y = band('unterstuetzung', y + F.abstand);

  // ── Der Weg des Kunden durch die Gasse ──
  const L = x1 - x0;
  const rueckgrat = {
    punkte: [[x0, mitte], [x1, mitte]] as [number, number][],
    abschnitte: stufen.map((s, i) => ({
      stufe: s.id,
      von: r1(((i ? (stufen[i - 1].x + K.b + s.x) / 2 : x0) - x0) / L * 1000) / 1000,
      bis: r1(((i < stufen.length - 1 ? (s.x + K.b + stufen[i + 1].x) / 2 : x1) - x0) / L * 1000) / 1000,
    })),
  };

  // ── Übergaben (Punkt 9) ──
  const nach = new Map(kacheln.map(k => [k.id, k]));
  const hindernisse: Box[] = kacheln.map(k => ({ x: k.x, y: k.y, b: k.b, h: k.h }));
  const spalteVon = (k: KachelLage) => (k.stufe ? KERN_STUFEN.findIndex(s => s.id === k.stufe) : -1);
  const pfeile: PfeilLage[] = [];
  for (const p of prozesse) for (const u of p.uebergaben ?? []) {
    const a = nach.get(p.id), b = nach.get(u.nach);
    if (!a || !b || a.id === b.id) continue;
    const zurueck = a.band === 'kern' && b.band === 'kern' && spalteVon(b) < spalteVon(a);
    const punkte = pfeilWeg(a, b, hindernisse, zurueck ? 'zurueck' : 'weiter');
    pfeile.push({ id: `${a.id}>${b.id}`, von: a.id, nach: b.id, text: u.text, art: zurueck ? 'zurueck' : 'weiter', punkte, textOrt: pfeilTextOrt(punkte) });
  }

  const alles = huelle([...baender, kernBox, ...kacheln], 0);
  const rahmen: RahmenLage[] = [{ id: 'alles', titel: 'Die ganze Firma', box: huelle([alles], 40) }];
  for (const b of baender.filter(x => x.id === 'fuehrung')) rahmen.push({ id: b.id, titel: b.titel, box: huelle([b], 30) });
  for (const s of stufen) {
    const ks = kacheln.filter(k => k.stufe === s.id);
    rahmen.push({ id: s.id, titel: s.titel, box: huelle([{ x: s.x, y: r1(mitte - s.halb), b: s.b, h: r1(2 * s.halb) }, ...ks], 40) });
  }
  for (const b of baender.filter(x => x.id === 'unterstuetzung')) rahmen.push({ id: b.id, titel: b.titel, box: huelle([b], 30) });
  return { breite: r1(breite), hoehe: r1(alles.y + alles.h), box: alles, baender, fliege: { pfad, mitte, x0, x1, stufen, titelY }, kacheln, pfeile, rueckgrat, rahmen };
}

// ── Ebene 2: ein Prozess ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const PROZESS_MASS = { phase: { b: 300, kopf: 80, zeile: 28 }, marke: { b: 200, h: 64 }, geist: { b: 260, h: 72 }, luecke: 96, zeigen: 4 } as const;

export interface PhaseLage extends Box { id: string; nr: number; titel: string; zeilen: string[]; mehr: number }
export interface GeistLage extends Box { id: string; titel: string; text: string; richtung: 'von' | 'an' }
export interface ProzessLage {
  box: Box; mitte: number;
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
  const maxH = Math.max(M.marke.h, ...hoehen);
  const mitte = r1(maxH / 2);
  let x = 0;
  const start = { x, y: r1(mitte - M.marke.h / 2), b: M.marke.b, h: M.marke.h, titel: p.steckbrief.ausloeser };
  x += M.marke.b + M.luecke;
  const phasen: PhaseLage[] = p.phasen.map((ph, i) => {
    const h = hoehen[i];
    const l: PhaseLage = { id: ph.id, nr: i + 1, titel: ph.titel, x, y: r1(mitte - h / 2), b: M.phase.b, h, zeilen: hauptweg[i].slice(0, M.zeigen).map(s => s.titel), mehr: Math.max(0, hauptweg[i].length - M.zeigen) };
    x += M.phase.b + M.luecke;
    return l;
  });
  const ende = { x, y: r1(mitte - M.marke.h / 2), b: M.marke.b, h: M.marke.h, titel: p.steckbrief.ergebnis };
  const weg: [number, number][] = [[start.x + start.b / 2, mitte], [ende.x + ende.b / 2, mitte]];
  // Geister: wer an diesen Prozess übergibt (links), an wen er übergibt (rechts).
  const von = alle.filter(q => q.id !== p.id && (q.uebergaben ?? []).some(u => u.nach === p.id)).map(q => ({ q, text: q.uebergaben!.find(u => u.nach === p.id)!.text }));
  const an = (p.uebergaben ?? []).map(u => ({ q: alle.find(x => x.id === u.nach), text: u.text })).filter((x): x is { q: ProzessDef; text: string } => !!x.q && x.q.id !== p.id);
  const stapel = (n: number, i: number) => r1(mitte - (n * M.geist.h + (n - 1) * 20) / 2 + i * (M.geist.h + 20));
  const geister: GeistLage[] = [
    ...von.map(({ q, text }, i) => ({ id: q.id, titel: q.titel, text, richtung: 'von' as const, x: -(M.geist.b + M.luecke * 1.4), y: stapel(von.length, i), b: M.geist.b, h: M.geist.h })),
    ...an.map(({ q, text }, i) => ({ id: q.id, titel: q.titel, text, richtung: 'an' as const, x: r1(ende.x + ende.b + M.luecke * 1.4), y: stapel(an.length, i), b: M.geist.b, h: M.geist.h })),
  ];
  const hindernisse: Box[] = [start, ende, ...phasen, ...geister];
  const pfeile: PfeilLage[] = geister.map(g => {
    const [a, b] = g.richtung === 'von' ? [g, start] : [ende, g];
    const punkte = pfeilWeg(a, b, hindernisse, 'weiter');
    return { id: `${g.richtung}:${g.id}`, von: g.richtung === 'von' ? g.id : p.id, nach: g.richtung === 'von' ? p.id : g.id, text: g.text, art: 'weiter' as const, punkte, textOrt: pfeilTextOrt(punkte) };
  });
  const box = huelle([start, ende, ...phasen, ...geister], 0);
  const rahmen: RahmenLage[] = [{ id: 'alles', titel: p.titel, box: huelle([box], 40) }, ...phasen.map(ph => ({ id: ph.id, titel: ph.titel, box: huelle([ph], 60) }))];
  return { box, mitte, start, ende, phasen, geister, weg, pfeile, rahmen };
}

/** Wohin eine Kachel bzw. Phase im Bild zeigt (für Kamerafahrt, Minimap, Suche): Kennung → Box. */
export function boxenVon(l: { kacheln?: readonly KachelLage[]; phasen?: readonly PhaseLage[]; geister?: readonly GeistLage[] }): Map<string, Box> {
  const m = new Map<string, Box>();
  for (const k of l.kacheln ?? []) m.set(k.id, k);
  for (const k of l.phasen ?? []) m.set(k.id, k);
  for (const k of l.geister ?? []) if (!m.has(k.id)) m.set(`geist:${k.id}`, k);
  return m;
}
