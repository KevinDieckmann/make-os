// ─── MAKE OS · Reise + Fluss — der Flow (Markenzeichen, 17.10.) — wo der Faden hell ist, wo er sich staut ──────────────────────────────────────
// Rückmeldung 17.10.: „Denke dir auch immer den Flow, diese Linie, mit — das ist unser Markenzeichen.“ Unter der Reise läuft der Weg des Kunden als Lichtfaden:
// hell und fließend von links bis „Hier“, danach ruhiger und ausgefranst; an einem offenen Abstimmungspunkt (Raute) staut er sich, an einem gegebenen fließt
// er hindurch; rot bzw. gelb nur dort, wo wirklich etwas hängt. Im Fluss werden die Pfeile zu feinen Fäden: erledigte Abschnitte leuchten, offene sind
// gedämpft, der Pfeil in den aktuellen Knoten glüht; der Nein-Pfad (zur Erinnerung) im Ton der Erinnerung.
// Hier steht NUR die Regel aus denselben Daten wie die Zeichnung (BildSpalte bzw. Knoten-Zustand — „Hier“ ist die Stufe mit `zustand: 'jetzt'`, also genau die
// Stelle aus `fallStelle` bzw. dem Modell des Bereichs). Rein, ohne DOM, ohne Farben (die Zeichnung setzt die Töne aus den Token — components/os/ui/reise/
// formen.tsx `FLOW_TON`). Gemessen wird in der Zeichnung; hier kommen die gemessenen Lagen herein und der Faden (lib/lichtfaeden/flow.ts) heraus.

import type { BildSpalte, Haengt, KaestchenZustand } from './bild';
import type { FlowFaden, FlowFarbe, FlowStelle } from '@/lib/lichtfaeden/flow';

/** Die Töne des Flows — die Zeichnung setzt sie aus den Token (Petrol = erreicht, Orange = Nein-Pfad, Rot/Gelb = hängt). */
export interface FlowTon { basis: string; nein: string; rot: string; gelb: string }

/** Wo „Hier“ auf der Reise liegt: in der Mitte einer Stufe, an der Grenze dahinter (der Abstimmungspunkt IST gerade dran), am Anfang oder am Ende. */
export type ReiseHier = { art: 'mitte'; i: number } | { art: 'grenze'; i: number } | { art: 'anfang' } | { art: 'ende' };
export interface ReiseFlow {
  /** null = alle Stufen laufen zugleich (Kreislauf) — kein „Hier“, der ganze Faden fließt. */
  hier: ReiseHier | null;
  /** Die Rauten (Grenze hinter Stufe i): offen = Stau, gegeben = Durchgang. */
  rauten: { i: number; offen: boolean; haengt?: Haengt }[];
  /** Stufen, an denen etwas hängt (rot/gelb nur dann). */
  haengt: { i: number; art: Haengt }[];
  laeuft: boolean;
}

/**
 * Der Stand des Flows einer Reise — aus denselben Spalten, die die Zeile zeichnet: „Hier“ = die Stufe `jetzt` (bzw. ihre Raute, wenn der Abstimmungspunkt
 * selbst dran ist), alles fertig = bis zum Ende, nichts begonnen = am Anfang; `laeuft` (Kreislauf) = ohne „Hier“.
 */
export function reiseFlow(spalten: readonly Pick<BildSpalte, 'zustand' | 'haengt' | 'raute'>[]): ReiseFlow {
  const rauten = spalten.flatMap((s, i) => (s.raute ? [{ i, offen: !s.raute.gegeben, ...(s.raute.haengt ? { haengt: s.raute.haengt } : {}) }] : []));
  const haengt = spalten.flatMap((s, i) => (s.haengt ? [{ i, art: s.haengt }] : []));
  const laeuft = spalten.length > 0 && spalten.every(s => s.zustand === 'laeuft');
  if (laeuft) return { hier: null, rauten, haengt, laeuft };
  const j = spalten.findIndex(s => s.zustand === 'jetzt');
  // Neben anderen Stufen heißt `laeuft`: durchlaufen, darin läuft noch etwas nebenher (Fulfillment, 19.10.) — der Weg ist an ihr vorbei wie an einer fertigen.
  const vorbei = (s: Pick<BildSpalte, 'zustand'>) => s.zustand === 'fertig' || s.zustand === 'laeuft';
  let hier: ReiseHier;
  if (j >= 0) hier = spalten[j].raute?.hier ? { art: 'grenze', i: j } : { art: 'mitte', i: j };
  else if (spalten.length && spalten.every(vorbei)) hier = { art: 'ende' };
  else {
    // Keine laufende Stufe: hinter der letzten fertigen (bzw. am Anfang).
    let f = -1;
    spalten.forEach((s, i) => { if (vorbei(s)) f = i; });
    hier = f >= 0 ? { art: 'grenze', i: f } : { art: 'anfang' };
  }
  return { hier, rauten, haengt, laeuft };
}

/** Die gemessenen Lagen der Zeile entlang ihrer Achse (px der Leinwand): je Stufe von/bis, je Grenze die Mitte der Rauten-Spalte (sonst null). */
export interface ReiseLagen { stufen: readonly { von: number; bis: number }[]; grenzen: readonly (number | null)[]; quer: number; achse: 'quer' | 'hoch' }

/**
 * Der Faden einer Reise aus Stand + Lagen: ein gerader Weg vom Anfang der ersten bis hinter die letzte Stufe; hell bis „Hier“ (Leuchtpunkt), dahinter
 * ausgefranst; Stau an offenen Rauten hinter „Hier“, Durchgang an gegebenen; rot/gelb nur über Stufen bzw. Rauten, an denen etwas hängt; im Kreislauf jede
 * Stufe in ihrer Farbe (`farben`). Ohne Stufen bzw. ohne Länge: kein Faden (nie ein Schmuck-Faden).
 */
export function reiseFaden(st: ReiseFlow, lagen: ReiseLagen, ton: FlowTon, o: { farben?: readonly (string | undefined)[]; id?: string } = {}): FlowFaden | null {
  const n = lagen.stufen.length;
  if (!n) return null;
  const a = lagen.stufen[0].von;
  const grenze = (i: number) => lagen.grenzen[i] ?? lagen.stufen[i].bis;
  const e = Math.max(lagen.stufen[n - 1].bis, lagen.grenzen[n - 1] ?? -Infinity);
  const L = e - a;
  if (!(L > 4)) return null;
  const anteil = (x: number) => Math.max(0, Math.min(1, (x - a) / L));
  const h = st.hier;
  const hierX = !h || h.art === 'ende' ? e
    : h.art === 'anfang' ? a
    : h.art === 'mitte' ? (lagen.stufen[h.i].von + lagen.stufen[h.i].bis) / 2
    : grenze(h.i);
  const bisHier = st.hier ? anteil(hierX) : 1;
  const stellen: FlowStelle[] = st.rauten.map(r => ({ bei: anteil(grenze(r.i)), art: r.offen && anteil(grenze(r.i)) >= bisHier - 1e-6 ? 'stau' as const : 'durch' as const }));
  const farben: FlowFarbe[] = [];
  if (o.farben) lagen.stufen.forEach((s, i) => { const f = o.farben?.[i]; if (f) farben.push({ von: anteil(i ? grenze(i - 1) : a), bis: anteil(i < n - 1 ? grenze(i) : e), farbe: f }); });
  for (const h of st.haengt) farben.push({ von: anteil(lagen.stufen[h.i].von), bis: anteil(lagen.stufen[h.i].bis), farbe: h.art === 'rot' ? ton.rot : ton.gelb });
  for (const r of st.rauten) if (r.haengt) { const x = anteil(grenze(r.i)); farben.push({ von: Math.max(0, x - 0.04), bis: Math.min(1, x + 0.02), farbe: r.haengt === 'rot' ? ton.rot : ton.gelb }); }
  const q = lagen.quer;
  return {
    id: o.id ?? 'reise', farbe: ton.basis, staerke: 'breit', aufbau: true,
    punkte: lagen.achse === 'quer' ? [[a, q], [e, q]] : [[q, a], [q, e]],
    bisHier, hier: !!st.hier && st.hier.art !== 'ende' && st.hier.art !== 'anfang', frans: !!st.hier && bisHier < 1,
    ...(stellen.length ? { stellen } : {}), ...(farben.length ? { farben } : {}),
  };
}

// ── Der Fluss: Pfeile als Fäden ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Zustand eines Pfeils im Fluss: erledigt (leuchtet) · hier (führt in den aktuellen Knoten — leuchtet und glüht am Ende) · offen (gedämpft). */
export type PfeilZustand = 'erledigt' | 'hier' | 'offen';
/** Art eines Pfeils: weiter (bzw. „ja“) im Grundton, nein = der Pfad zur Erinnerung im Ton der Erinnerung. */
export type PfeilArt = 'weiter' | 'ja' | 'nein';

type MitZustand = { zustand: KaestchenZustand } | null | undefined;
/** Der Zustand eines Pfeils zwischen zwei Knoten — aus ihren Zuständen (dieselben wie im Bild): erst ein erledigter Knoten macht den Weg danach hell. */
export function pfeilZustand(vor: MitZustand | 'begonnen', nach: MitZustand): PfeilZustand {
  const vorFertig = vor === 'begonnen' || vor?.zustand === 'erledigt' || vor?.zustand === 'entfaellt';
  if (!vorFertig) return 'offen';
  return nach?.zustand === 'hier' ? 'hier' : 'erledigt';
}

/** Hat eine Stufe begonnen (irgendein Knoten erledigt, entfällt oder ist dran)? Dann ist der Weg vom Start zum ersten Knoten erreicht. */
export function stufeBegonnen(knoten: readonly { zustand: KaestchenZustand }[]): boolean {
  return knoten.some(k => k.zustand !== 'offen');
}

/** Ein Pfeil als Faden: von → nach (px der Leinwand), hell bzw. gedämpft, nein im Ton der Erinnerung, „hier“ glüht am Ende. */
export function pfeilFaden(id: string, von: readonly [number, number], nach: readonly [number, number], z: PfeilZustand, art: PfeilArt, ton: FlowTon): FlowFaden {
  return {
    id, punkte: [von, nach], farbe: art === 'nein' ? ton.nein : ton.basis, staerke: 'mittel',
    bisHier: z === 'offen' ? 0 : 1, ...(z === 'hier' ? { gluehen: true } : {}),
  };
}

// ── Die Fläche: Pfeile als Fäden (Welt-Koordinaten — die Ebene rechnet mit der Kamera ins Bild) ────────────────────────────────────────────

/** Ein Pfeil der Fläche als Faden: weiter/ja im Grundton, nein im Ton der Erinnerung, „zurück“ (Schleife) leise im Ton der Erinnerung. */
export function flaecheFaden(pf: { id: string; art: 'weiter' | 'ja' | 'nein' | 'zurueck'; punkte: readonly (readonly [number, number])[] }, ton: FlowTon): FlowFaden {
  const nein = pf.art === 'nein' || pf.art === 'zurueck';
  return { id: pf.id, punkte: pf.punkte, farbe: nein ? ton.nein : ton.basis, staerke: 'fein', ...(pf.art === 'zurueck' ? { bisHier: 0 } : {}) };
}
