// ─── Lichtfäden · Seil — der Zeichner (Canvas 2D, ohne Framework, 07.10.2026) ──────────────────────────────────────────
// Zeichnet, was Modell (seil.ts) und Geometrie (seil-geometrie.ts) fertig liefern — rechnet selbst keine Lage, keine Dichte, keinen
// Pfad (DESIGN_STANDARD.md › Lichtfäden, Regel 8). Technik wie das Fädenband: `leinwand` (dpr ≤ 2), `starteLauf` (pausiert außer
// Sicht und im verborgenen Tab, „Bewegung reduzieren“ = Standbild), gleiche Farbe + gleiche Deckkraft-Stufe = EIN Path2D („Eimer“).
//
// Bewegung NUR mit Bedeutung (Kevin 07.10.: „Es braucht einfach Effekte“ — 80/20: keine Spielereien):
//   · Aufbau: beim Öffnen wachsen die Stränge von links ein (1,2 s), Seile und Kanten erscheinen, wenn die Front sie erreicht.
//   · Strang füllt sich: der erledigte Anteil wächst sichtbar auf seinen Wert (0,7 s) — beim Öffnen und nach jedem Abhaken.
//   · Seil zieht sich an: ändert sich das Momentum, wird der Drall in 0,9 s straffer (bzw. lockerer).
//   · Fasern fließen sehr ruhig zum Anker (Phase je ms, `SEIL_FORM.tempo`).
// Blockiert = gestrichelt + gedämpft bis zum Ende des Vorgängers; Fokus = andere Seile 22 %; kritischer Pfad kräftig.

import { leinwand, rgb, starteLauf, type Lauf } from './zeichnen';
import { SEIL_FORM, faserBei, glatt, kantenKurve, seilRadius, fasernWeich, strangY, type GruppenLage, type SeilLage, type SpurLage } from './seil-geometrie';
import type { SeilAnsicht, SeilStrang } from './seil';

export interface SeilFarben { heute: string; achtung: string; leise: string; kritisch: string; grund: string }
export interface SeilBild {
  ansicht: SeilAnsicht;
  lage: SeilLage;
  heuteX: number | null;
  /** Fokus-Modus: nur dieses Seil voll (Kennung des Ziels) — null = alle. */
  fokus: string | null;
  /** Hervorgehoben (Zeigen): ein Strang. */
  hervor: string | null;
  /** Senkrechte Hilfslinien (Monatsanfänge, x in px). */
  raster: readonly number[];
  farben: SeilFarben;
  handy: boolean;
}
export type SeilTreffer = { art: 'karte'; id: string; strang: string } | { art: 'strang'; id: string } | { art: 'seil'; id: string };

/** Dauer der Bewegungen (ms) — eine Stelle. */
export const SEIL_ZEIT = { aufbau: 1200, fuellen: 700, anziehen: 900, intervall: 33 } as const;
const sanft = (q: number) => { const t = Math.max(0, Math.min(1, q)); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; };
const rgba = (hex: string, a: number) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`; };

/** Ein Wert, der sanft auf sein Ziel läuft (Fortschritt, Momentum). */
interface Lauf1 { von: number; nach: number; start: number; dauer: number }
const wert = (l: Lauf1 | undefined, t: number, ruhig: boolean): number => (!l ? 0 : ruhig || l.start < 0 ? l.nach : l.von + (l.nach - l.von) * sanft((t - l.start) / l.dauer));

export interface Seilband {
  setze(bild: SeilBild): void;
  treffer(x: number, y: number): SeilTreffer | null;
  /** 0 … 1 während des Aufbaus, null = fertig bzw. reduzierte Bewegung (Prüfungen). */
  aufbau(): number | null;
  /** Läuft gerade eine Füll- oder Anzieh-Bewegung? (Prüfungen) */
  bewegt(): boolean;
  stop(): void;
  lauf: Lauf;
}

export function seilband(canvas: HTMLCanvasElement, beobachte: Element, ruhig: boolean): Seilband {
  const ctx = canvas.getContext('2d');
  let bild: SeilBild | null = null;
  let aufbauStart = -1, aufbauP: number | null = ruhig ? null : 0;
  let jetzt = 0;
  let bewegt = false;
  const fuellung = new Map<string, Lauf1>();
  const momentum = new Map<string, Lauf1>();
  const ziel = (m: Map<string, Lauf1>, id: string, nach: number, dauer: number) => {
    const l = m.get(id);
    if (!l) { m.set(id, { von: ruhig ? nach : 0, nach, start: -2, dauer }); return; }
    if (Math.abs(l.nach - nach) < 1e-6) return;
    m.set(id, { von: wert(l, jetzt, ruhig), nach, start: -2, dauer });
  };

  function zeichne(t: number) {
    jetzt = t;
    const d = bild;
    if (!ctx || !d) return;
    // Verborgener Tab (oder Vorschau ohne Bildlauf): kein Aufbau, keine Bewegung — sofort das fertige Bild (sonst bliebe es leer).
    const still = ruhig || (typeof document !== 'undefined' && document.hidden);
    if (still) aufbauP = null;
    const { lage, ansicht: a } = d;
    const dpr = leinwand(canvas, lage.breite, lage.hoehe);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, lage.breite, lage.hoehe);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Start-Zeitpunkte der Bewegungen festlegen (erst im Lauf bekannt).
    bewegt = false;
    for (const m of [fuellung, momentum]) for (const l of m.values()) { if (l.start === -2) l.start = t; if (!still && t - l.start < l.dauer) bewegt = true; }
    let front = Infinity;
    if (!still && aufbauP != null) {
      if (aufbauStart < 0) aufbauStart = t;
      const p = (t - aufbauStart) / SEIL_ZEIT.aufbau;
      if (p >= 1) aufbauP = null; else { aufbauP = Math.max(0, p); front = sanft(aufbauP) * (lage.breite + 60) - 30; }
    }
    const erreicht = (x: number) => (front === Infinity ? 1 : glatt(front - x, 0, 60));
    const tt = still ? 0 : t;

    // Raster (Monate) — kaum sichtbar.
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (const x of d.raster) ctx.fillRect(Math.round(x), 0, 1, lage.hoehe);

    for (const g of lage.gruppen) {
      const gA = d.fokus && d.fokus !== g.seil ? 0.22 : 1;
      const seil = g.seil ? a.seile.find(s => s.zielId === g.seil) : undefined;
      const mom = g.seil ? wert(momentum.get(g.seil), t, still) : 0;
      const gg: GruppenLage = { ...g, momentum: mom };
      // Seil-Körper: weicher Schein zwischen den Fasern — dichter/heller mit Momentum und Schwung.
      if (seil && g.spuren.length) zeichneSeilKoerper(ctx, gg, d, gA * erreicht(g.xSeilVon), seil.schwung, seil.farbe);
      // Stränge.
      for (const sp of g.spuren) {
        const s = a.straenge[sp.id];
        const hA = d.hervor && d.hervor !== s.id ? 0.5 : 1;
        zeichneStrang(ctx, gg, sp, s, d, gA * hA, wert(fuellung.get(s.id), t, still), tt, front);
      }
      // Anker (◎) — die Bedienung steckt im Knopf darüber (DOM); hier nur das Bild.
      if (seil && g.ankerAusserhalb == null && erreicht(g.xAnker) > 0.02) {
        const r = 6.5;
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = rgba(seil.farbe, 0.95 * gA * erreicht(g.xAnker));
        ctx.beginPath(); ctx.arc(g.xAnker, g.seilY, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = rgba(seil.farbe, (0.25 + 0.75 * mom) * gA * erreicht(g.xAnker));
        ctx.beginPath(); ctx.arc(g.xAnker, g.seilY, 2.2 + 2.3 * mom, 0, Math.PI * 2); ctx.fill();
        if (seil.ueberfaellig) { ctx.strokeStyle = rgba(d.farben.achtung, 0.9 * gA); ctx.beginPath(); ctx.arc(g.xAnker, g.seilY, r + 3, 0, Math.PI * 2); ctx.stroke(); }
      }
    }
    // Kanten (über den Strängen, unter den Karten).
    zeichneKanten(ctx, d, tt, erreicht);
    // Karten und Marken.
    for (const g of lage.gruppen) {
      const gA = d.fokus && d.fokus !== g.seil ? 0.22 : 1;
      const gg: GruppenLage = { ...g, momentum: g.seil ? wert(momentum.get(g.seil), t, still) : 0 };
      for (const sp of g.spuren) zeichneKarten(ctx, gg, sp, a.straenge[sp.id], d, gA * (d.hervor && d.hervor !== sp.id ? 0.5 : 1), tt, erreicht);
    }
    // HEUTE: eine ruhige senkrechte Linie.
    if (d.heuteX != null && erreicht(d.heuteX) > 0.02) {
      ctx.fillStyle = rgba(d.farben.heute, 0.38 * erreicht(d.heuteX));
      ctx.fillRect(d.heuteX - 0.5, 0, 1, lage.hoehe);
    }
  }

  const lauf = starteLauf({ beobachte, zeichne, ruhig, intervall: SEIL_ZEIT.intervall });
  return {
    setze(neu) {
      bild = neu;
      for (const s of Object.values(neu.ansicht.straenge)) ziel(fuellung, s.id, s.fortschritt, SEIL_ZEIT.fuellen);
      for (const s of neu.ansicht.seile) ziel(momentum, s.zielId, s.momentum, SEIL_ZEIT.anziehen);
      lauf.einmal();
    },
    treffer(x, y) { return bild ? trefferIn(bild, x, y) : null; },
    aufbau: () => aufbauP,
    bewegt: () => bewegt,
    stop() { lauf.stop(); },
    lauf,
  };
}

/** Der Seil-Körper: Fläche zwischen ±Radius, sehr leise, heller mit Momentum und Schwung. */
function zeichneSeilKoerper(ctx: CanvasRenderingContext2D, g: GruppenLage, d: SeilBild, alpha: number, schwung: number, farbe: string) {
  const x0 = Math.max(-10, g.xSeilVon), x1 = Math.min(d.lage.breite + 10, g.xAnker);
  if (x1 <= x0 || alpha <= 0.01) return;
  const n = g.spuren.length;
  const oben: [number, number][] = [], unten: [number, number][] = [];
  for (let x = x0; x <= x1; x += 4) {
    const r = seilRadius(Math.max(0.6, fasernWeich(g, x)), n, x, g.xAnker) + 1.5;
    oben.push([x, g.seilY - r]); unten.push([x, g.seilY + r]);
  }
  const p = new Path2D();
  oben.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  for (let i = unten.length - 1; i >= 0; i--) p.lineTo(unten[i][0], unten[i][1]);
  p.closePath();
  ctx.fillStyle = rgba(farbe, (0.06 + 0.12 * g.momentum + 0.06 * schwung) * alpha);
  ctx.fill(p);
}

/** Ein Strang: Röhre (Kontur), gefüllter Anteil, Blockade gestrichelt, Einmündung und Faser im Seil. */
function zeichneStrang(ctx: CanvasRenderingContext2D, g: GruppenLage, sp: SpurLage, s: SeilStrang, d: SeilBild, alpha: number, fuell: number, t: number, front: number) {
  if (alpha <= 0.01) return;
  const B = d.lage.breite;
  const R = SEIL_FORM.roehre;
  const ende = Math.min(sp.seil ? g.xAnker : sp.x1, B + 10, front);
  const start = Math.max(sp.x0, -10);
  if (ende <= start) return;
  const kritisch = s.kritisch && d.fokus === s.seil;
  const fertig = s.status === 'erledigt';
  // Führungslinie von der Beschriftungs-Spalte (links, DOM) bis zum Beginn des Strangs — ganz leise, gepunktet; wächst mit dem Aufbau.
  const fuehrung = Math.min(sp.x0 - 3, B, front);
  if (fuehrung > 1) {
    ctx.setLineDash([1, 5]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(s.farbe, 0.18 * alpha);
    ctx.beginPath(); ctx.moveTo(0, sp.y); ctx.lineTo(fuehrung, sp.y); ctx.stroke();
    ctx.setLineDash([]);
  }
  // Körper bis zur Einmündung: Punkte einmal abtasten, dann Kontur (blockierter Teil gestrichelt), Innenfläche, gefüllter Anteil.
  const koerperEnde = Math.min(sp.x1, ende);
  const xFill = sp.x0 + Math.max(0, Math.min(1, fuell)) * (sp.x1 - sp.x0);
  const pkt: [number, number][] = [];
  for (let x = start; x <= koerperEnde + 0.01; x += 3) {
    const xx = Math.min(x, koerperEnde);
    const y = strangY(g, sp, xx, t);
    if (y != null) pkt.push([xx, y]);
  }
  const zug = (von: number, bis: number, dy: number): Path2D => {
    const p = new Path2D();
    let erst = true;
    for (const [x, y] of pkt) { if (x < von - 0.01 || x > bis + 0.01) continue; if (erst) { p.moveTo(x, y + dy); erst = false; } else p.lineTo(x, y + dy); }
    return p;
  };
  const xBlock = s.status === 'blockiert' && sp.xBlockiert != null ? sp.xBlockiert : s.status === 'blockiert' ? koerperEnde : -Infinity;
  const ueber = s.status === 'ueberfaellig';
  const kontur = (von: number, bis: number, gestrichelt: boolean, farbe: string, a: number) => {
    if (bis <= von) return;
    ctx.setLineDash(gestrichelt ? [3, 4] : []);
    ctx.strokeStyle = rgba(farbe, a);
    ctx.stroke(zug(von, bis, -R)); ctx.stroke(zug(von, bis, R));
  };
  ctx.lineWidth = kritisch ? 1.4 : 1;
  // Blockiert: bis zum Ende des Vorgängers gestrichelt und gedämpft — danach normal (dann darf er laufen).
  kontur(start, Math.min(xBlock, koerperEnde), true, s.farbe, 0.36 * alpha);
  kontur(Math.max(start, xBlock), koerperEnde, ueber, ueber ? d.farben.achtung : s.farbe, 0.62 * alpha);
  ctx.setLineDash([]);
  // Innen ganz leise (die Röhre liest sich als Fläche, nicht als Doppellinie).
  ctx.lineWidth = 2 * R;
  ctx.strokeStyle = rgba(s.farbe, 0.07 * alpha);
  ctx.stroke(zug(start, koerperEnde, 0));
  // Erledigter Anteil: gefüllt (wächst sichtbar auf seinen Wert — „der Strang füllt sich“).
  if (xFill > start + 0.5) {
    ctx.lineWidth = 2 * R;
    ctx.strokeStyle = rgba(s.farbe, (fertig ? 0.92 : 0.85) * alpha);
    ctx.stroke(zug(start, Math.min(xFill, koerperEnde), 0));
  }
  // Kritischer Pfad im Fokus: eine helle Kernlinie.
  if (kritisch) { ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(d.farben.achtung, 0.95 * alpha); ctx.stroke(zug(start, koerperEnde, 0)); }
  // Faser im Seil (nach der Einmündung): erledigt kräftig, offen dünn; vorn heller als hinten (Kabel).
  if (sp.seil && ende > sp.x1) {
    const eimer = [new Path2D(), new Path2D(), new Path2D()];
    let vx = sp.x1, vy = strangY(g, sp, sp.x1, t) ?? sp.y;
    for (let x = sp.x1 + 3; x <= ende + 0.01; x += 3) {
      const f = faserBei(g, sp.faser, sp.fasern, Math.min(x, ende), t);
      const stufe = f.tiefe > 0.33 ? 2 : f.tiefe > -0.33 ? 1 : 0;
      eimer[stufe].moveTo(vx, vy); eimer[stufe].lineTo(Math.min(x, ende), f.y);
      vx = Math.min(x, ende); vy = f.y;
    }
    ctx.lineWidth = fertig ? 1.9 : 1.1;
    eimer.forEach((p, i) => { ctx.strokeStyle = rgba(s.farbe, (fertig ? 0.95 : 0.42) * (0.45 + 0.275 * i) * alpha); ctx.stroke(p); });
  }
}

/** Kanten: ruhige Bézier-Kurven vom Vorgänger zum Nachfolger. */
function zeichneKanten(ctx: CanvasRenderingContext2D, d: SeilBild, t: number, erreicht: (x: number) => number) {
  const a = d.ansicht;
  const lage = d.lage;
  const spurVon = new Map<string, { g: GruppenLage; s: SpurLage }>();
  for (const g of lage.gruppen) for (const s of g.spuren) spurVon.set(s.id, { g, s });
  const karteOrt = new Map<string, { x: number; y: number }>();
  for (const g of lage.gruppen) for (const sp of g.spuren) {
    for (const k of a.straenge[sp.id].karten) {
      if (!k.tag) continue;
      const x = Math.max(sp.x0, Math.min(sp.x1, lage.x(k.tag)));
      const y = strangY(g, sp, x, t);
      if (y != null) karteOrt.set(k.id, { x, y });
    }
  }
  for (const k of a.kanten) {
    let p: { x: number; y: number } | undefined, q: { x: number; y: number } | undefined;
    if (k.art === 'karte') { p = karteOrt.get(k.von); q = karteOrt.get(k.nach); }
    else {
      const v = spurVon.get(k.von), n = spurVon.get(k.nach);
      if (v && n) { const xe = Math.max(v.s.x0, v.s.x1 - SEIL_FORM.einmuendung); p = { x: xe, y: v.s.y }; q = { x: n.s.x0, y: n.s.y }; }
    }
    if (!p || !q) continue;
    const imFokus = !d.fokus || d.fokus === k.seil;
    const sichtbar = Math.min(erreicht(p.x), erreicht(q.x));
    if (sichtbar <= 0.02) continue;
    const kr = kantenKurve(p.x, p.y, q.x, q.y);
    const pfad = new Path2D();
    pfad.moveTo(kr[0], kr[1]); pfad.bezierCurveTo(kr[2], kr[3], kr[4], kr[5], kr[6], kr[7]);
    const kritisch = k.kritisch && d.fokus === k.seil;
    // Ohne Fokus leise (sonst ein Gewirr), im Fokus deutlich, der kritische Pfad kräftig.
    const stufe = kritisch ? 0.95 : d.fokus === k.seil ? (k.offen ? 0.7 : 0.4) : (k.offen ? 0.38 : 0.2);
    ctx.lineWidth = kritisch ? 2 : 1;
    ctx.setLineDash(k.offen ? [] : [2, 3]);
    ctx.strokeStyle = rgba(k.offen ? d.farben.achtung : d.farben.leise, stufe * (imFokus ? 1 : 0.25) * sichtbar);
    ctx.stroke(pfad);
    ctx.setLineDash([]);
    // Pfeilspitze am Nachfolger (klein).
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - 5, q.y - 3); ctx.lineTo(q.x - 5, q.y + 3); ctx.closePath(); ctx.fill();
  }
}

/** Karten (Punkte) und Marken (Termin ○, Deal €, Frist ▣) am Strang. */
function zeichneKarten(ctx: CanvasRenderingContext2D, g: GruppenLage, sp: SpurLage, s: SeilStrang, d: SeilBild, alpha: number, t: number, erreicht: (x: number) => number) {
  if (alpha <= 0.01) return;
  const fokusHier = d.fokus === s.seil;
  for (const k of s.karten) {
    if (!k.tag) continue;
    const x = Math.max(sp.x0, Math.min(sp.x1, d.lage.x(k.tag)));
    if (x < -6 || x > d.lage.breite + 6) continue;
    const y = strangY(g, sp, x, t);
    const e = erreicht(x);
    if (y == null || e <= 0.02) continue;
    const r = k.dringend ? 3.6 : 3;
    if (k.kritisch && fokusHier) { ctx.lineWidth = 1.4; ctx.strokeStyle = rgba(d.farben.achtung, 0.95 * alpha * e); ctx.beginPath(); ctx.arc(x, y, r + 3.2, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (k.status === 'erledigt') { ctx.fillStyle = rgba(s.farbe, 0.95 * alpha * e); ctx.fill(); }
    else {
      ctx.fillStyle = rgba(d.farben.grund, alpha * e); ctx.fill();
      ctx.lineWidth = 1.3;
      if (k.blockiert) ctx.setLineDash([1.5, 1.5]);
      ctx.strokeStyle = rgba(k.status === 'abgebrochen' ? d.farben.leise : k.blockiert ? d.farben.achtung : s.farbe, 0.95 * alpha * e);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  for (const m of s.marken) {
    const x = d.lage.x(m.tag);
    if (x < -6 || x > d.lage.breite + 6) continue;
    const y = (strangY(g, sp, Math.max(sp.x0, Math.min(sp.seil ? g.xAnker : sp.x1, x)), t) ?? sp.y) - 9;
    const e = erreicht(x);
    if (e <= 0.02) continue;
    ctx.strokeStyle = rgba(d.farben.leise, 0.95 * alpha * e);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 1.1;
    if (m.art === 'termin') { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.stroke(); }
    else if (m.art === 'frist') ctx.strokeRect(x - 2.5, y - 2.5, 5, 5);
    else { ctx.font = '600 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('€', x, y); }
  }
}

/** Treffer an (x, y): erst Karten (6 px), dann Stränge (Spur bzw. Weg ± 7 px), dann der Kopf eines Seils. */
export function trefferIn(d: Pick<SeilBild, 'ansicht' | 'lage'>, x: number, y: number): SeilTreffer | null {
  const { lage, ansicht: a } = d;
  let best: SeilTreffer | null = null, abstand = Infinity;
  for (const g of lage.gruppen) {
    if (y < g.y0 || y > g.y0 + g.hoehe) continue;
    for (const sp of g.spuren) {
      for (const k of a.straenge[sp.id].karten) {
        if (!k.tag) continue;
        const kx = Math.max(sp.x0, Math.min(sp.x1, lage.x(k.tag)));
        const ky = strangY(g, sp, kx, 0);
        if (ky == null) continue;
        const dd = Math.hypot(kx - x, ky - y);
        if (dd <= 7 && dd < abstand) { abstand = dd; best = { art: 'karte', id: k.id, strang: sp.id }; }
      }
    }
    if (best) return best;
    for (const sp of g.spuren) {
      const sy = strangY(g, sp, x, 0);
      if (sy == null) continue;
      const dd = Math.abs(sy - y);
      if (dd <= 7 && dd < abstand) { abstand = dd; best = { art: 'strang', id: sp.id }; }
    }
    if (best) return best;
    if (g.seil && y <= g.y0 + SEIL_FORM.kopf) return { art: 'seil', id: g.seil };
  }
  return null;
}
