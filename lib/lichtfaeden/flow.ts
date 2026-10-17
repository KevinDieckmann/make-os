// ─── Markenzeichen: der Flow — EIN Faden-Zeichner für jeden Weg (17.10.2026) ──────────────────────────────────────────────────────────────
// Rückmeldung 17.10. (Bild aus der Markttraktion, „Verlauf · 20 Tage“ unter dem Traktions-Index): „Denke dir auch immer den Flow, diese Linie, mit — das ist
// unser Markenzeichen nachher bzw. soll es werden.“ — „Das war damit gemeint — dass alles immer nach und nach in den Flow kommt.“
// Der Flow ist der Lichtfaden aus Strahl v3 im Pfad-Modus: ein dünnes Bündel feiner Fäden entlang EINES beliebigen Weges (Polylinie), hell und fließend
// bis „Hier“ (erreicht), danach ruhiger, gedämpft und — wo der Weg in die Zukunft geht — ausgefranst. Er fließt immer in Laufrichtung (wachsendes `s`).
// Eine Stelle für alles (DESIGN_STANDARD.md › Markenzeichen: der Flow):
//   · rein (getestet): `flowProben` — die Stützpunkte eines Fadens aus Weg, „Hier“, Stau-/Durchgangsstellen und Farbabschnitten (kein DOM).
//   · Zeichnen: `zeichneFaden` — Kern (breiter, leiser Schein) + Fäden + Partikel; DIESELBE Funktion zeichnet die FadenLinie (Index-Verläufe,
//     lib/lichtfaeden/fadenlinie.ts) — eine Quelle für das Aussehen. `zeichneFlow` legt „Hier“-Punkt und Glühen dazu.
//   · Takt: `taktLauf` — EIN gemeinsamer requestAnimationFrame für alle Faden-Ebenen einer Seite (FadenLinie, Reise, Fluss, Fläche), ~30 Bilder je
//     Sekunde, pausiert außer Sicht und im verborgenen Tab; reduzierte Bewegung = kein Takt, nur ein Standbild auf Zuruf (`starteLauf` ruhig).
//   · Ebene: `flowEbene` — eine Leinwand mit beliebig vielen Fäden (optional mit Kamera Welt → Bild für die Fläche), ohne React.
// Daten rechnet der Zeichner nie — er bekommt fertige Wege (Reise/Fluss: lib/reise/flow.ts, Fläche: lib/fulfillment/prozesse/flaeche.ts).

import { LICHTFAEDEN, MITTE, fadenSaaten, glatt, textSaat, type FadenSaat } from './band';
import { leinwand, rgb, starteLauf, zeichneBuendel, type Lauf, type LaufMessung, type PunkteStil, type Probe } from './zeichnen';

/** Die Parameter des Flows — EINE Stelle (DESIGN_STANDARD.md › Markenzeichen: der Flow). */
export const FLOW = {
  /** Mindestabstand der Bilder (ms) — ~30 Bilder je Sekunde reichen für das ruhige Fließen. */
  intervall: 33,
  /** Stützpunkte alle n Bildpunkte entlang des Weges. */
  schritt: 4,
  /** Fäden je Bündel nach Stärke (Rechner · Handy). */
  faeden: { fein: [4, 3], mittel: [8, 6], breit: [12, 8] } as Record<FlowStaerke, readonly [number, number]>,
  /** Spreizung des Bündels (px) nach Stärke. */
  spreizung: { fein: 1.4, mittel: 2.6, breit: 4.2 } as Record<FlowStaerke, number>,
  /** Der Kern: ein breiter, sehr leiser Schein entlang der Mitte (Strichbreite nach Stärke). Dieselben Werte wie die FadenLinie (breit = Rechner, mittel = Handy). */
  kern: { deckkraft: 0.07, strich: { fein: 3, mittel: 4, breit: 5 } as Record<FlowStaerke, number> },
  /** Die feinen Fäden. */
  faden: { deckkraft: 0.3, strich: 0.7 },
  /** Partikel entlang der Fäden (wandern in Laufrichtung). */
  punkte: { ...LICHTFAEDEN.punkte, abstand: 8, groesse: 1, hell: 2.2, jeder: 2 } as PunkteStil,
  /** Helligkeit hinter „Hier“ bzw. eines offenen Abschnitts (1 = erreicht). */
  gedaempft: 0.36,
  /** Weicher Übergang hell → gedämpft (px). */
  uebergang: 18,
  /** Stau vor einer offenen Stelle (Abstimmungspunkt, Abhängigkeit): Länge (px), Spreizung ×, Helligkeit (Ziel an der Stelle), „Hals“ dahinter (Anteil der Spreizung). */
  stau: { laenge: 34, spreiz: 2.4, hell: 1.25, hals: 0.4 },
  /** Durchgang an einer gegebenen Stelle: kurzes Aufleuchten. */
  durch: { laenge: 12, hell: 1.4 },
  /** Der Leuchtpunkt an „Hier“ (Radius Schein · Kern, px). */
  hier: { schein: 7, kern: 2.6 },
  /** Glühen am Ende (der aktuelle Knoten im Fluss): Radius (px), Pulsdauer (ms). */
  gluehen: { radius: 7, puls: 2600 },
  /** Aufbau von links (ms) — nur Wege mit `aufbau` (Reise). */
  aufbau: 1400,
  /** Standbild als SVG (Export der Fläche, Druck): breiter leiser Schein + feiner Kern in der Farbe des Fadens. */
  standbild: { schein: { breite: 6, deckkraft: 0.16 }, kern: { breite: 1.4, deckkraft: 0.9 }, gedaempft: 0.45 },
} as const;

export type FlowStaerke = 'fein' | 'mittel' | 'breit';
export type FlowPunkt = readonly [number, number];
/** Eine Stelle auf dem Weg (Anteil 0 … 1 der Länge): `stau` = offen, der Faden staut sich davor; `durch` = gegeben, er fließt hindurch. */
export interface FlowStelle { bei: number; art: 'stau' | 'durch' }
/** Ein Abschnitt in eigener Farbe (Anteile 0 … 1) — z. B. eine Stufe, an der etwas hängt, oder die Welt einer Stufe im Kreislauf. */
export interface FlowFarbe { von: number; bis: number; farbe: string }
/** Ein Faden — ein Weg mit Stand. Das ist die ganze Schnittstelle: jede Ansicht mit Weg, Verlauf, Reihenfolge oder Fortschritt hängt so ein. */
export interface FlowFaden {
  id: string;
  /** Der Weg (px der Leinwand bzw. der Welt bei Kamera), mindestens zwei Punkte. */
  punkte: readonly FlowPunkt[];
  /** #RRGGBB — die Grundfarbe (Bereich bzw. Token). */
  farbe: string;
  /** Bis wohin der Weg erreicht ist (Anteil 0 … 1 der Länge): davor hell, dahinter gedämpft. Vorgabe 1 = ganz erreicht. */
  bisHier?: number;
  /** Leuchtpunkt an „Hier“ (Reise). */
  hier?: boolean;
  /** Hinter „Hier“ ausfransen (die Zukunft) — sonst nur gedämpft. */
  frans?: boolean;
  /** Sanftes Glühen am Ende (der Pfeil in den aktuellen Knoten). */
  gluehen?: boolean;
  stellen?: readonly FlowStelle[];
  farben?: readonly FlowFarbe[];
  staerke?: FlowStaerke;
  /** Aufbau von links nach rechts beim ersten Zeichnen. */
  aufbau?: boolean;
  /** Saat der Fäden (Vorgabe: die Kennung) — gleiche Saat, gleiche Fäden. */
  saat?: string;
}

/** Die fertigen Stützpunkte eines Fadens (rein). `laeufe` = Abschnitte gleicher Farbe als Indizes [von, bis] (überlappen um einen Punkt). */
export interface FlowProben { proben: Probe[]; laenge: number; hierS: number | null; laeufe: { farbe: string; von: number; bis: number }[] }

const klemm = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** Länge einer Polylinie. */
export function weglaenge(p: readonly FlowPunkt[]): number {
  let l = 0;
  for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return l;
}

/** Punkt an der Weglänge s (linear zwischen den Punkten). */
function punktBei(p: readonly FlowPunkt[], kum: readonly number[], s: number): [number, number] {
  if (s <= 0) return [p[0][0], p[0][1]];
  const L = kum[kum.length - 1];
  if (s >= L) return [p[p.length - 1][0], p[p.length - 1][1]];
  let i = 1;
  while (i < kum.length - 1 && kum[i] < s) i++;
  const a = kum[i - 1], b = kum[i], u = (s - a) / (b - a || 1);
  return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * u, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * u];
}

/**
 * Die Stützpunkte eines Fadens (rein, deterministisch): alle `FLOW.schritt` px ein Punkt, Normale aus der Richtung über ±6 px (weich um Ecken),
 * Helligkeit 1 bis „Hier“, dahinter gedämpft (weicher Übergang), Ausfransen hinter „Hier“ (nur `frans`), Stau vor offenen Stellen (Bündel weitet sich und
 * leuchtet, dahinter ein schmaler Hals), kurzes Aufleuchten an gegebenen Stellen. `skala` = Spreizung × (Fläche: 1 / Zoom, damit sie im Bild gleich bleibt).
 */
export function flowProben(f: FlowFaden, o: { handy?: boolean; skala?: number; schritt?: number } = {}): FlowProben {
  const leer: FlowProben = { proben: [], laenge: 0, hierS: null, laeufe: [] };
  const p = f.punkte.filter(x => Number.isFinite(x[0]) && Number.isFinite(x[1]));
  if (p.length < 2) return leer;
  const kum = [0];
  for (let i = 1; i < p.length; i++) kum.push(kum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  const L = kum[kum.length - 1];
  if (!(L > 1)) return leer;
  const skala = o.skala ?? 1;
  const st = Math.max(0.5, o.schritt ?? FLOW.schritt * skala);
  const basis = FLOW.spreizung[f.staerke ?? 'fein'] * skala * (o.handy ? 0.85 : 1);
  const hierAnteil = klemm(f.bisHier ?? 1);
  const hierS = hierAnteil >= 1 ? null : hierAnteil * L;
  const halb = 6 * skala;
  const stellen = (f.stellen ?? []).map(x => ({ s: klemm(x.bei) * L, art: x.art }));
  const S = FLOW.stau, D = FLOW.durch;
  const proben: Probe[] = [];
  const n = Math.max(1, Math.ceil(L / st));
  for (let k = 0; k <= n; k++) {
    const s = Math.min(L, k * st);
    const [x, y] = punktBei(p, kum, s);
    const [ax, ay] = punktBei(p, kum, Math.max(0, s - halb));
    const [bx, by] = punktBei(p, kum, Math.min(L, s + halb));
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
    let hell = 1, spreiz = basis, frans = 0;
    if (hierS != null) {
      // Noch nichts erreicht (bisHier 0): der ganze Weg gleich gedämpft — kein heller Anfang.
      hell = hierS <= 0 ? FLOW.gedaempft : 1 + (FLOW.gedaempft - 1) * glatt(s, hierS, hierS + FLOW.uebergang * skala);
      if (f.frans) frans = glatt(s, hierS + 2 * skala, hierS + Math.max(40 * skala, (L - hierS) * 0.8)) * 0.9;
    }
    for (const x0 of stellen) {
      if (x0.art === 'stau') {
        const lang = S.laenge * skala;
        // Der Stau leuchtet auf eine feste Helligkeit hin (S.hell) — auch im gedämpften Teil hinter „Hier“ sichtbar.
        if (s > x0.s - lang && s <= x0.s) { const u = (s - (x0.s - lang)) / lang; spreiz *= 1 + (S.spreiz - 1) * u ** 1.5; hell += (S.hell - hell) * u; }
        else if (s > x0.s && s < x0.s + lang * 0.6) spreiz *= S.hals + (1 - S.hals) * glatt(s, x0.s, x0.s + lang * 0.6);
      } else {
        const d = Math.abs(s - x0.s), lang = D.laenge * skala;
        if (d < lang) hell *= 1 + (D.hell - 1) * (1 - d / lang);
      }
    }
    proben.push({ x, y, nx: -dy / l, ny: dx / l, s, spreizung: spreiz, hell, ...(frans > 0 ? { frans } : {}) });
  }
  return { proben, laenge: L, hierS, laeufe: farbLaeufe(f, proben, L) };
}

/** Die Abschnitte gleicher Farbe (Indizes der Proben) — Grundfarbe, darüber die `farben` in ihrer Reihenfolge. */
function farbLaeufe(f: FlowFaden, proben: readonly Probe[], L: number): FlowProben['laeufe'] {
  const farbeBei = (s: number) => {
    let c = f.farbe;
    for (const x of f.farben ?? []) if (s >= x.von * L - 1e-6 && s < x.bis * L + 1e-6) c = x.farbe;
    return c;
  };
  const raus: FlowProben['laeufe'] = [];
  for (let i = 0; i < proben.length; i++) {
    const c = farbeBei(proben[i].s);
    const letzter = raus[raus.length - 1];
    if (letzter && letzter.farbe === c) letzter.bis = i;
    // Der neue Abschnitt beginnt an DEMSELBEN Punkt, an dem der vorige endet — die Fäden laufen nahtlos weiter (gleiche Saat, gleiches `s`).
    else { if (letzter) letzter.bis = i; raus.push({ farbe: c, von: i, bis: i }); }
  }
  return raus;
}

export interface FadenStil {
  farbe: string;
  saaten: readonly FadenSaat[];
  /** Aufbau: bis zu diesem Weg ist der Faden gewachsen. */
  front?: number;
  /** Strichbreite des Kerns (Vorgabe: breit). */
  kernStrich?: number;
  /** Partikel (Vorgabe FLOW.punkte; null = keine). */
  punkte?: PunkteStil | null;
  /** Deckkraft × (gedämpfte Ebenen, z. B. 0,5). */
  deckkraft?: number;
  /** Strichbreite × (Fläche: 1 / Zoom). */
  skala?: number;
}

/**
 * EIN Aussehen für jeden Faden (FadenLinie, Reise, Fluss, Fläche): der leise Kern entlang der Mitte, darüber die feinen Fäden mit Partikeln — additiv
 * gemischt („lighter“), damit dichte Stellen von selbst leuchten. Gibt die Zahl der Striche zurück (Messung).
 */
export function zeichneFaden(ctx: CanvasRenderingContext2D, proben: readonly Probe[], s: FadenStil, t: number): number {
  if (proben.length < 2) return 0;
  const sk = s.skala ?? 1, dk = s.deckkraft ?? 1;
  const vorher = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  const pk = s.punkte === null ? null : (s.punkte ?? FLOW.punkte);
  let n = zeichneBuendel(ctx, proben, { farbe: s.farbe, saaten: [MITTE], deckkraft: FLOW.kern.deckkraft * dk, strich: (s.kernStrich ?? FLOW.kern.strich.breit) * sk, ...(s.front != null ? { front: s.front } : {}) }, t);
  n += zeichneBuendel(ctx, proben, {
    farbe: s.farbe, saaten: s.saaten, deckkraft: FLOW.faden.deckkraft * dk, strich: FLOW.faden.strich * sk, ...(s.front != null ? { front: s.front } : {}),
    punkte: pk ? { ...pk, abstand: pk.abstand * sk, groesse: pk.groesse * sk, tempo: pk.tempo * sk } : null,
  }, t);
  ctx.globalCompositeOperation = vorher || 'source-over';
  return n;
}

/** Saaten eines Fadens (zwischengespeichert je Kennung + Zahl). */
function saatenFuer(f: FlowFaden, handy: boolean, merk: Map<string, readonly FadenSaat[]>): readonly FadenSaat[] {
  const n = FLOW.faeden[f.staerke ?? 'fein'][handy ? 1 : 0];
  const key = `${f.saat ?? f.id}|${n}`;
  let s = merk.get(key);
  if (!s) { s = fadenSaaten(n, textSaat(f.saat ?? f.id)); merk.set(key, s); }
  return s;
}

/** Einen Faden zeichnen: je Farbabschnitt `zeichneFaden`, dazu „Hier“-Punkt und Glühen am Ende. */
export function zeichneFlow(ctx: CanvasRenderingContext2D, f: FlowFaden, fp: FlowProben, saaten: readonly FadenSaat[], t: number, o: { front?: number; skala?: number; handy?: boolean } = {}): number {
  if (fp.proben.length < 2) return 0;
  const sk = o.skala ?? 1;
  const kern = FLOW.kern.strich[f.staerke ?? 'fein'] * (o.handy ? 0.85 : 1);
  let n = 0;
  for (const l of fp.laeufe) n += zeichneFaden(ctx, fp.proben.slice(l.von, l.bis + 1), { farbe: l.farbe, saaten, kernStrich: kern, skala: sk, ...(o.front != null ? { front: o.front } : {}) }, t);
  const reicht = (s: number) => o.front == null || o.front > s;
  const punkt = (x: number, y: number, farbe: string, r: number, a: number) => {
    const [cr, cg, cb] = rgb(farbe);
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${a.toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  };
  if (f.hier && fp.hierS != null && reicht(fp.hierS)) {
    const p = fp.proben.reduce((a, x) => (Math.abs(x.s - fp.hierS!) < Math.abs(a.s - fp.hierS!) ? x : a));
    const c = farbeBei(fp, p.s, f.farbe);
    punkt(p.x, p.y, c, FLOW.hier.schein * sk, 0.22);
    punkt(p.x, p.y, c, FLOW.hier.kern * sk, 0.95);
  }
  if (f.gluehen && reicht(fp.laenge)) {
    const e = fp.proben[fp.proben.length - 1];
    const puls = t ? 0.5 + 0.5 * Math.sin((t / FLOW.gluehen.puls) * Math.PI * 2) : 0.5;
    const c = farbeBei(fp, e.s, f.farbe);
    punkt(e.x, e.y, c, FLOW.gluehen.radius * sk, 0.1 + 0.08 * puls);
    punkt(e.x, e.y, c, FLOW.gluehen.radius * 0.45 * sk, 0.32 + 0.2 * puls);
  }
  return n;
}
function farbeBei(fp: FlowProben, s: number, basis: string): string {
  for (const l of fp.laeufe) if (fp.proben[l.von].s <= s && fp.proben[l.bis].s >= s) return l.farbe;
  return basis;
}

// ── Der gemeinsame Takt ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Gast { zeichne: (t: number) => void; sichtbar: boolean; intervall: number; zuletzt: number; bilder: number; summe: number; laengstes: number }
const gaeste = new Set<Gast>();
let rafId = 0, generation = 0, startT = -1, sichtHoerer = false;
const versteckt = () => typeof document !== 'undefined' && !!document.hidden;
const rafJetzt = (f: FrameRequestCallback): number => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(f) : (setTimeout(() => f(Date.now()), 16) as unknown as number));
const cafJetzt = (id: number) => { if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id); else clearTimeout(id); };

function planen() {
  if (rafId || versteckt()) return;
  let irgend = false;
  for (const g of gaeste) if (g.sichtbar) { irgend = true; break; }
  if (!irgend) return;
  const meine = ++generation;
  rafId = rafJetzt(j => schritt(j, meine));
}
function schritt(j: number, meine: number) {
  if (meine !== generation) return; // ein überholter Aufruf (nach stop/planen) zeichnet nie doppelt
  rafId = 0;
  if (versteckt()) return;
  if (startT < 0) startT = j;
  let irgend = false;
  for (const g of gaeste) {
    if (!g.sichtbar) continue;
    irgend = true;
    if (j - g.zuletzt >= g.intervall - 1) {
      g.zuletzt = j;
      const a = typeof performance !== 'undefined' ? performance.now() : Date.now();
      g.zeichne(j - startT);
      const d = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - a;
      g.bilder++; g.summe += d; if (d > g.laengstes) g.laengstes = d;
    }
  }
  if (irgend) { const n = ++generation; rafId = rafJetzt(x => schritt(x, n)); }
}
function sichtWechsel() { if (!versteckt()) planen(); }

/** Wie viele Faden-Ebenen der gemeinsame Takt gerade bedient und ob er läuft (Messung, Tests). */
export function taktStand(): { gaeste: number; laeuft: boolean } { return { gaeste: gaeste.size, laeuft: rafId !== 0 }; }

/**
 * Ein Platz im gemeinsamen Takt — dieselbe Schnittstelle wie `starteLauf` (zeichnen.ts). `ruhig` (prefers-reduced-motion, Kunden-Ansicht, Druck):
 * KEIN Takt — ein Standbild (t = 0), neu nur über `einmal()`. Sonst zeichnet der EINE requestAnimationFrame aller Ebenen höchstens alle `intervall` ms,
 * solange `beobachte` im Bild und der Tab sichtbar ist.
 */
export function taktLauf(o: { beobachte: Element | null; zeichne: (t: number) => void; ruhig: boolean; intervall?: number }): Lauf {
  if (o.ruhig) return starteLauf({ beobachte: o.beobachte, zeichne: o.zeichne, ruhig: true });
  const g: Gast = { zeichne: o.zeichne, sichtbar: true, intervall: Math.max(0, o.intervall ?? FLOW.intervall), zuletzt: -1e9, bilder: 0, summe: 0, laengstes: 0 };
  let io: IntersectionObserver | null = null;
  if (o.beobachte && typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver(es => { g.sichtbar = es.some(e => e.isIntersecting); if (g.sichtbar) planen(); }, { rootMargin: '120px 0px' });
    io.observe(o.beobachte);
  }
  if (!sichtHoerer && typeof document !== 'undefined' && typeof document.addEventListener === 'function') { document.addEventListener('visibilitychange', sichtWechsel); sichtHoerer = true; }
  gaeste.add(g);
  planen();
  let beendet = false;
  return {
    einmal() { if (beendet) return; g.zuletzt = -1e9; planen(); },
    stop() {
      if (beendet) return;
      beendet = true;
      gaeste.delete(g);
      io?.disconnect();
      if (!gaeste.size) { if (rafId) cafJetzt(rafId); rafId = 0; generation++; startT = -1; }
    },
    messung: (): LaufMessung => ({ bilder: g.bilder, mittelMs: g.bilder ? g.summe / g.bilder : 0, laengstesMs: g.laengstes }),
  };
}

// ── Die Ebene: eine Leinwand, viele Fäden ───────────────────────────────────────────────────────────────────────────────────────────────

/** Kamera Welt → Bild (wie components/os/ui/flaeche/kamera.ts): x_bild = x · s + x0. */
export interface FlowKamera { s: number; x: number; y: number }

export interface FlowEbene {
  /** Die Fäden und die Größe der Leinwand (CSS-Pixel). */
  setze(faeden: readonly FlowFaden[], groesse: { breite: number; hoehe: number }): void;
  /** Nur den Weg eines Fadens ändern (beim Ziehen — ohne die übrigen neu zu rechnen). */
  weg(id: string, punkte: readonly FlowPunkt[]): void;
  /** Der Faden, der beim Ziehen eines neuen Pfeils mitläuft (null = keiner). */
  zug(f: FlowFaden | null): void;
  /** Kamera (Fläche): Welt → Bild; null = die Wege sind schon in Leinwand-Pixeln. */
  kamera(k: FlowKamera | null): void;
  einmal(): void;
  stop(): void;
  lauf: Lauf;
  /** Aufbau 0 … 1, null = fertig bzw. ruhig. */
  aufbau(): number | null;
}

/**
 * Die Faden-Ebene einer Leinwand (ohne React). Rechnet die Stützpunkte nur bei neuen Daten, neuer Größe oder neuer Kamera; das Fließen zeichnet der
 * gemeinsame Takt. Mit Kamera werden Wege außerhalb des Bildes übersprungen, Spreizung und Striche bleiben im Bild gleich breit.
 */
export function flowEbene(canvas: HTMLCanvasElement, beobachte: Element | null, o: { ruhig: boolean; handy?: boolean }): FlowEbene {
  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  let faeden: FlowFaden[] = [];
  let zugFaden: FlowFaden | null = null;
  let groesse = { breite: 0, hoehe: 0 };
  let kam: FlowKamera | null = null;
  const proben = new Map<string, FlowProben>();
  const saatMerk = new Map<string, readonly FadenSaat[]>();
  let start = -1, aufbauP: number | null = o.ruhig ? null : 0;
  const handy = !!o.handy;
  const mitAufbau = () => faeden.some(f => f.aufbau);

  const imBild = (f: FlowFaden): FlowFaden => {
    if (!kam) return f;
    const k = kam;
    return { ...f, punkte: f.punkte.map(([x, y]) => [x * k.s + k.x, y * k.s + k.y] as const) };
  };
  const sichtbar = (f: FlowFaden) => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, y] of f.punkte) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
    const m = 24;
    return c >= -m && d >= -m && a <= groesse.breite + m && b <= groesse.hoehe + m;
  };
  const probenVon = (f: FlowFaden): FlowProben | null => {
    let fp = proben.get(f.id);
    if (!fp) {
      const b = imBild(f);
      if (!sichtbar(b)) return null;
      fp = flowProben(b, { handy });
      proben.set(f.id, fp);
    }
    return fp;
  };

  function zeichne(t: number) {
    if (!ctx || groesse.breite < 2 || groesse.hoehe < 2) return;
    const dpr = leinwand(canvas, groesse.breite, groesse.hoehe);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, groesse.breite, groesse.hoehe);
    // Aufbau (nur Wege mit `aufbau`): der Faden wächst in Laufrichtung ein — die Front je Faden aus SEINER Länge (quer wie senkrecht gleich schnell).
    let anteil: number | null = null;
    if (!o.ruhig && aufbauP != null && mitAufbau()) {
      if (start < 0) start = t;
      const p = (t - start) / FLOW.aufbau;
      if (p >= 1) aufbauP = null;
      else { aufbauP = Math.max(0, p); anteil = 1 - (1 - aufbauP) ** 3; }
    } else if (!mitAufbau()) aufbauP = null;
    for (const f of zugFaden ? [...faeden, zugFaden] : faeden) {
      const fp = probenVon(f);
      if (!fp) continue;
      const front = f.aufbau && anteil != null ? anteil * (fp.laenge + LICHTFAEDEN.aufbauVerzug * 0.4) - 10 : undefined;
      zeichneFlow(ctx, f, fp, saatenFuer(f, handy, saatMerk), t, { handy, ...(front != null ? { front } : {}) });
    }
  }

  const lauf = taktLauf({ beobachte, zeichne, ruhig: o.ruhig, intervall: FLOW.intervall });
  return {
    setze(neu, g) { faeden = [...neu]; groesse = { breite: Math.max(0, g.breite), hoehe: Math.max(0, g.hoehe) }; proben.clear(); lauf.einmal(); },
    weg(id, punkte) { const i = faeden.findIndex(f => f.id === id); if (i < 0) return; faeden[i] = { ...faeden[i], punkte }; proben.delete(id); lauf.einmal(); },
    zug(f) { zugFaden = f; proben.delete(f?.id ?? '__zug'); if (f) proben.delete(f.id); lauf.einmal(); },
    kamera(k) {
      const gleich = (!k && !kam) || (!!k && !!kam && k.s === kam.s && k.x === kam.x && k.y === kam.y);
      if (gleich) return;
      kam = k ? { ...k } : null; proben.clear(); lauf.einmal();
    },
    einmal: () => lauf.einmal(),
    stop() { lauf.stop(); },
    lauf,
    aufbau: () => aufbauP,
  };
}

/** Hat das Gerät Bewegung abbestellt? (wie zeichnen.ts — hier für die Bausteine des Flows) */
export { bewegungReduziert } from './zeichnen';
