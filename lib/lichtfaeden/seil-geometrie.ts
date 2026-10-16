// ─── Lichtfäden · Seil — die Geometrie (07.10.2026, rein, ohne DOM) ────────────────────────────────────────────────────
// Aus der Ansicht (seil.ts) und der Breite der Bühne werden Pixel: Spuren je Strang, Einmündung (S-Kurve) ins Seil, die Fasern des
// Seils (verdrillt wie ein Kabel), Abhängigkeits-Kurven. Der Zeichner (seilband.ts) ruft nur diese Funktionen — er rechnet keine Lage
// selbst (Regel: DESIGN_STANDARD.md › Lichtfäden 8). ALLE Maße in `SEIL_FORM` (eine Stelle; Wächter tests/seil-modell.test.ts).
//
//   ┌ Kopf (Ziel, Momentum, Fokus) ───────────────────────────────────────────── ◎ Anker
//   │ Spur 0  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮              (mündet zuletzt)
//   │ Spur 1  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮            │
//   │ Spur 2  ━━━━━━━━━━━━━━━━━━━━━━━━━━╮               │            │              (mündet zuerst — liegt dem Seil am nächsten)
//   └ Seil                               ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈▶ ◎

import { seilTage, type SeilAnsicht, type SeilStrang } from './seil';

export const SEIL_FORM = {
  /** Kopfzeile je Seil (px), Abstand der Spuren, Zone des Seils unter den Spuren, Luft zwischen zwei Seilen. */
  kopf: 30, spur: 22, seilZone: 30, luft: 18,
  /** Bündel „Ohne Ziel“: kein Seil, nur Spuren. */
  ohneZone: 8,
  /** Länge der Einmündung (S-Kurve) in px. */
  einmuendung: 46,
  /** Halbe Höhe der Strang-Röhre (Kontur) in px — sichtbar, aber ruhig. */
  roehre: 2.6,
  /** Radius des Seils (px) je nach Zahl der eingemündeten Fasern: √n zwischen min und max. */
  radius: { min: 2.2, max: 8 },
  /** Wellenlänge des Dralls (px): locker ohne Fortschritt, straff bei vollem Momentum („das Seil zieht sich an“). */
  drall: { locker: 64, straff: 24 },
  /** Vor dem Anker läuft das Seil auf diesen Anteil seines Radius zusammen (über `zulauf` px). */
  zulauf: 34, spitze: 0.3,
  /** Liegt der Anker außerhalb des Fensters, läuft das Seil so weit über den Rand hinaus (px). */
  ueberRand: 40,
  /** Fließen der Fasern zum Anker (Phase je ms) — sehr ruhig; 0 bei „Bewegung reduzieren“. */
  tempo: 0.0006,
  /** Abhängigkeits-Kurve: mindestens so viel horizontaler Bogen (px). */
  bogen: 26,
  /** Handy: Höhe des kleinen Seil-Balkens (px). */
  mini: { hoehe: 22, faser: 1.4 },
  /**
   * Beschriftungs-Spalte links (wie ein Gantt): Breite je Bühnenbreite — ab `ab.breit` px breit, ab `ab.mittel` mittel, darunter
   * schmal (unter 520 px zeigt Seil.tsx ohnehin das Handy-Seil). Die Zeit-Fläche rechts behält mindestens `zeitMin` px. `einzug` =
   * Einzug der Spur-Zeilen unter dem Ziel-Kopf, `luft` = Abstand der Zeile zur Zeit-Fläche.
   */
  spalte: { breit: 208, mittel: 172, schmal: 136, ab: { breit: 980, mittel: 720 }, zeitMin: 200, einzug: 10, luft: 12 },
  /**
   * Zeit-Achse über der Bühne in zwei Zeilen (Abnahme 15.10. C3: „HEUTE“ lag über „Okt“): oben die Monatsnamen, darunter versetzt
   * „HEUTE“ — die Zeilen überlappen nie. `zeichen` = geschätzte Breite je Zeichen (px), `luft` = Mindestabstand zweier Monatsnamen,
   * `polster` = Innenabstand links/rechts der HEUTE-Marke.
   */
  achse: {
    hoehe: 30,
    monat: { y: 1, hoehe: 15, schrift: 12, zeichen: 7, luft: 6 },
    heute: { y: 17, hoehe: 13, schrift: 11, zeichen: 9, polster: 4, text: 'HEUTE' },
  },
} as const;

export interface SpurLage {
  id: string;
  /** Spur (y in px). */
  y: number;
  /** Start und Einmündung (x in px — dürfen außerhalb der Bühne liegen). */
  x0: number; x1: number;
  /** Bis hierhin wartet der Strang (gestrichelt). */
  xBlockiert?: number;
  /** Faser im Seil (Reihenfolge der Einmündung, 0 = zuerst) und Zahl der Fasern dieses Seils. */
  faser: number; fasern: number;
  /** Mündet in ein Seil (sonst endet er bei x1). */
  seil: boolean;
}
export interface GruppenLage {
  seil: string | null;
  y0: number; hoehe: number; kopfY: number; seilY: number;
  /** Erste Einmündung und Anker (x in px). */
  xSeilVon: number; xAnker: number;
  ankerAusserhalb: 'links' | 'rechts' | null;
  momentum: number; schwung: number;
  /** Einmündungen in Reihenfolge (x, Faser) — für die Zahl der Fasern an einer Stelle. */
  muendungen: number[];
  spuren: SpurLage[];
}
export interface SeilLage { breite: number; hoehe: number; tage: number; gruppen: GruppenLage[]; x: (tag: string) => number }

/** x eines Tages im Fenster [von, bis] (Tagesmitte), linear. */
export function seilX(tag: string, von: string, bis: string, breite: number): number {
  const n = seilTage(von, bis) + 1;
  return ((seilTage(von, tag) + 0.5) / Math.max(1, n)) * breite;
}

/** Glatte Stufe 0 → 1. */
export const glatt = (v: number, a: number, b: number): number => { const t = Math.max(0, Math.min(1, (v - a) / ((b - a) || 1))); return t * t * (3 - 2 * t); };

/** Die Lage aller Seile und Spuren für eine Breite. */
export function seilLage(a: SeilAnsicht, breite: number): SeilLage {
  const F = SEIL_FORM;
  const x = (t: string) => seilX(t, a.von, a.bis, breite);
  const gruppen: GruppenLage[] = [];
  let y = 0;
  const gruppe = (seil: string | null, ids: string[], ankerTag: string | null, momentum: number, schwung: number) => {
    const l = ids.map(id => a.straenge[id]);
    // Fasern: in der Reihenfolge der Einmündung (gleiche Stelle → die untere Spur zuerst).
    const nachMuendung = l.map((s, i) => ({ s, i })).sort((p, q) => p.s.muendung.localeCompare(q.s.muendung) || q.i - p.i);
    const faser = new Map(nachMuendung.map((p, k) => [p.s.id, k]));
    const zone = seil ? F.seilZone : F.ohneZone;
    const hoehe = F.kopf + l.length * F.spur + zone + F.luft;
    const seilY = y + F.kopf + l.length * F.spur + zone / 2;
    let xAnker = ankerTag ? x(ankerTag) : breite;
    let ausserhalb: GruppenLage['ankerAusserhalb'] = null;
    if (ankerTag && ankerTag > a.bis) { xAnker = breite + F.ueberRand; ausserhalb = 'rechts'; }
    if (ankerTag && ankerTag < a.von) { xAnker = -F.ueberRand; ausserhalb = 'links'; }
    const spuren: SpurLage[] = l.map((s, i) => {
      const x1 = Math.min(x(s.muendung), seil ? xAnker : Infinity);
      const x0 = Math.min(x(s.von), x1 - 4);
      return {
        id: s.id, y: y + F.kopf + i * F.spur + F.spur / 2, x0, x1,
        ...(s.status === 'blockiert' && s.blockiertBis ? { xBlockiert: Math.min(x1, Math.max(x0, x(s.blockiertBis))) } : {}),
        faser: faser.get(s.id)!, fasern: l.length, seil: !!seil,
      };
    });
    const muendungen = nachMuendung.map(p => spuren[p.i].x1);
    gruppen.push({ seil, y0: y, hoehe, kopfY: y + F.kopf / 2, seilY, xSeilVon: muendungen.length ? muendungen[0] : xAnker, xAnker, ankerAusserhalb: ausserhalb, momentum, schwung, muendungen, spuren });
    y += hoehe;
  };
  for (const s of a.seile) gruppe(s.zielId, s.straenge, s.anker, s.momentum, s.schwung);
  if (a.ohneZiel.length) gruppe(null, a.ohneZiel, null, 0, 0);
  return { breite, hoehe: Math.max(y, 1), tage: seilTage(a.von, a.bis) + 1, gruppen, x };
}

/** Wie viele Fasern sind an der Stelle x schon eingemündet? */
export function fasernBei(g: Pick<GruppenLage, 'muendungen'>, x: number): number {
  let n = 0;
  for (const m of g.muendungen) if (m <= x) n++;
  return n;
}

/** Wie oben, aber weich: jede Faser zählt über ihre Einmündung hinweg langsam ein (kein Sprung im Radius). */
export function fasernWeich(g: Pick<GruppenLage, 'muendungen'>, x: number): number {
  let n = 0;
  for (const m of g.muendungen) n += glatt(x, m - SEIL_FORM.einmuendung, m);
  return n;
}

/** Radius des Seils (px) bei n eingemündeten Fasern (von insgesamt `gesamt`), vor dem Anker zulaufend. */
export function seilRadius(n: number, gesamt: number, x: number, xAnker: number): number {
  const F = SEIL_FORM;
  if (n <= 0) return 0;
  const r = F.radius.min + (F.radius.max - F.radius.min) * Math.sqrt(n / Math.max(1, gesamt, 8));
  return r * (1 - (1 - F.spitze) * glatt(x, xAnker - F.zulauf, xAnker));
}

/** Wellenlänge des Dralls (px) aus dem Momentum — je mehr erledigt, desto straffer. */
export const drallLaenge = (momentum: number): number => SEIL_FORM.drall.locker + (SEIL_FORM.drall.straff - SEIL_FORM.drall.locker) * Math.max(0, Math.min(1, momentum));

/**
 * y einer Faser im Seil an der Stelle x: Helix um die Seil-Mitte, Phase je Faser gleich verteilt, fließt mit der Zeit zum Anker.
 * `tiefe` (−1 … 1) = vorne/hinten — der Zeichner macht vordere Fasern heller (Kabel-Eindruck).
 */
export function faserBei(g: Pick<GruppenLage, 'seilY' | 'muendungen' | 'xAnker' | 'xSeilVon' | 'momentum'>, faser: number, fasern: number, x: number, t = 0): { y: number; tiefe: number } {
  const r = seilRadius(Math.max(0.6, fasernWeich(g, x)), fasern, x, g.xAnker);
  const phase = (2 * Math.PI * faser) / Math.max(1, fasern) + (2 * Math.PI * (x - g.xSeilVon)) / drallLaenge(g.momentum) - t * SEIL_FORM.tempo;
  return { y: g.seilY + r * Math.sin(phase), tiefe: Math.cos(phase) };
}

/**
 * Der Weg eines Strangs (y an der Stelle x): auf seiner Spur bis kurz vor der Einmündung, dann eine S-Kurve auf seine Faser, danach
 * die Faser bis zum Anker. Ohne Seil: die Spur bis x1 (danach null). Vor x0: null (der Strang hat noch nicht begonnen).
 */
export function strangY(g: GruppenLage, s: SpurLage, x: number, t = 0): number | null {
  if (x < s.x0 - 0.5) return null;
  if (!s.seil) return x <= s.x1 + 0.5 ? s.y : null;
  if (x > g.xAnker + 0.5) return null;
  const L = Math.min(SEIL_FORM.einmuendung, Math.max(8, s.x1 - s.x0));
  if (x <= s.x1 - L) return s.y;
  const f = faserBei(g, s.faser, s.fasern, Math.max(x, s.x1), t).y;
  if (x >= s.x1) return f;
  return s.y + (f - s.y) * glatt(x, s.x1 - L, s.x1);
}

/** Abhängigkeits-Kurve (kubische Bézier): Kontrollpunkte waagerecht — ruhig, auch wenn der Nachfolger früher liegt. */
export function kantenKurve(x0: number, y0: number, x1: number, y1: number): [number, number, number, number, number, number, number, number] {
  const d = Math.max(SEIL_FORM.bogen, Math.abs(x1 - x0) / 2);
  return [x0, y0, x0 + d, y0, x1 - d, y1, x1, y1];
}

/** Punkt auf einer Bézier-Kurve (für Prüfungen und Trefferflächen). */
export function bezierPunkt(k: readonly number[], u: number): { x: number; y: number } {
  const [x0, y0, a, b, c, d, x1, y1] = k;
  const m = 1 - u;
  return { x: m * m * m * x0 + 3 * m * m * u * a + 3 * m * u * u * c + u * u * u * x1, y: m * m * m * y0 + 3 * m * m * u * b + 3 * m * u * u * d + u * u * u * y1 };
}

/** Bühne teilen: links die Beschriftungs-Spalte, rechts die Zeit (px) — eine Regel für Bühne, Achse und Fenster-Breite. */
export function seilSpalte(gesamt: number): { spalte: number; zeit: number } {
  const F = SEIL_FORM.spalte;
  const spalte = gesamt >= F.ab.breit ? F.breit : gesamt >= F.ab.mittel ? F.mittel : F.schmal;
  return { spalte, zeit: Math.max(F.zeitMin, gesamt - spalte) };
}

export interface AchsenMonat { date: string; text: string; x: number; y: number; breite: number; hoehe: number; jahr: boolean; wechsel: boolean }
export interface AchsenHeute { text: string; /** Linie (x der Tagesmitte) */ x: number; /** linke Kante der Marke */ links: number; y: number; breite: number; hoehe: number }
export interface SeilAchse { hoehe: number; monate: AchsenMonat[]; heute: AchsenHeute | null }

/**
 * Die Beschriftung der Zeit-Achse (rein): Monatsnamen, die einander nicht überdecken (ein Name, der zu nah am vorigen oder über dem
 * rechten Rand läge, entfällt), und die Marke „HEUTE“ in der zweiten Zeile — mittig über der Linie, an den Rändern so verschoben,
 * dass sie ganz sichtbar bleibt. Der Zeichner/die Bühne setzen nur diese Werte.
 */
export function seilAchse(
  ticks: readonly { date: string; label: string; jahr?: string; wechsel?: boolean }[],
  x: (tag: string) => number, breite: number, heuteX: number | null,
): SeilAchse {
  const A = SEIL_FORM.achse;
  const monate: AchsenMonat[] = [];
  let rechts = -Infinity;
  for (const tk of ticks) {
    const xm = x(tk.date);
    const text = `${tk.label}${tk.jahr ? ` ${tk.jahr}` : ''}`;
    const b = text.length * A.monat.zeichen;
    if (xm - 2 <= rechts || xm + b >= breite + 4) continue;
    rechts = xm + b + A.monat.luft;
    monate.push({ date: tk.date, text, x: xm, y: A.monat.y, breite: b, hoehe: A.monat.hoehe, jahr: !!tk.jahr, wechsel: !!tk.wechsel });
  }
  let heute: AchsenHeute | null = null;
  if (heuteX != null) {
    const b = A.heute.text.length * A.heute.zeichen + 2 * A.heute.polster;
    const links = Math.max(0, Math.min(Math.max(0, breite - b), heuteX - b / 2));
    heute = { text: A.heute.text, x: heuteX, links, y: A.heute.y, breite: b, hoehe: A.heute.hoehe };
  }
  return { hoehe: A.hoehe, monate, heute };
}

/**
 * Handy (ohne Querlauf): ein kleines Seil als Balken — je Faser ein Linienzug über die Breite, erledigte vorn. Liefert die Punkte
 * (für ein SVG `polyline`), rein. `straffe` = Momentum (Drall).
 */
export function miniSeil(fasern: readonly { fertig: boolean }[], breite: number, momentum: number): { fertig: boolean; punkte: string }[] {
  const H = SEIL_FORM.mini.hoehe;
  const n = Math.max(1, fasern.length);
  const r = Math.min(H / 2 - 2, 2 + 1.4 * Math.sqrt(n));
  const lambda = drallLaenge(momentum) * 0.8;
  const reihe = fasern.map((f, i) => ({ f, i })).sort((p, q) => Number(p.f.fertig) - Number(q.f.fertig));
  return reihe.map(({ f, i }) => {
    const pts: string[] = [];
    for (let x = 0; x <= breite; x += 3) {
      const zu = 1 - (1 - SEIL_FORM.spitze) * glatt(x, breite - 24, breite);
      const y = H / 2 + r * zu * Math.sin((2 * Math.PI * i) / n + (2 * Math.PI * x) / lambda);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return { fertig: f.fertig, punkte: pts.join(' ') };
  });
}

/** Die Stränge einer Gruppe als Objekte (für den Zeichner). */
export const gruppenStraenge = (a: SeilAnsicht, g: GruppenLage): SeilStrang[] => g.spuren.map(s => a.straenge[s.id]);
