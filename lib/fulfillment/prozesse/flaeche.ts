// ─── Fulfillment · Prozesse — das Bild einer Paket-Vorlage auf der Fläche (Prozess-Editor › Fläche, 17.10.) ───────────────────────────────
// Rückmeldung 17.10.: „Zeichnen wie in Miro: freie Fläche, Kästen frei platzieren, Pfeile ziehen, zoomen und schieben, Rahmen für Phasen — nicht nur die
// geordnete Liste von oben nach unten.“ Die Fläche ist eine ANDERE ANSICHT DERSELBEN Vorlage (EINE Wahrheit) — hier steht rein (Server UND Browser):
//   · `flaecheBild(vorlage, bausteine)` — Rahmen (Phasen), Knoten (Form, Titel, Satz darunter), Start und Abstimmungspunkt je Rahmen, Gruppen und die Pfeile
//     mit ihrem gewinkelten Weg. Lage aus ./flaeche-lage.ts, Formen und Zweige aus dem Editor-Modell (./editor.ts) — nichts doppelt gerechnet.
//   · Pfeile = die Reihenfolge und die Zweige, wie sie die Vorlage schon trägt (keine zweite Liste von Verbindungen): ein Schritt zeigt auf den nächsten (bzw.
//     seinen Ja-Zweig), eine Entscheidung zusätzlich „nein“ auf ihren Nein-Zweig, ein Nein-Zweig „danach“ zurück bzw. weiter; der letzte Schritt einer Phase
//     auf den Abstimmungspunkt bzw. den Start der nächsten Phase. Beschriftung aus `pfeilText` (sonst „ja“/„nein“, „zurück“).
//   · `reiheAusPfeilen(ids, pfeile)` — die Regel „die Reihenfolge ergibt sich aus den Pfeilen“: topologisch (jeder folgt seinem Pfeil), die Schleife einer
//     Erinnerung zurück zur Entscheidung zählt nicht, bei Gleichstand gilt die Lage von oben nach unten (dann links nach rechts). Ein neuer Pfeil A → B auf
//     der Fläche hängt B direkt hinter A ein (`verbinden` in ./editor.ts) — gespeichert wird weiter die Reihenfolge (Rang), aus der jede andere Ansicht liest.
//   · `pfeilWeg(von, nach, hindernisse)` — gewinkelt wie in Miro (unten → oben, Nein nach rechts, zurück außen herum); unter wenigen Wegen der, der die
//     wenigsten Knoten kreuzt (so gut es einfach geht).
//   · `lagenAlle(bild)` — die aktuelle Lage aller Rahmen und Schritte als Op `lage` (die Fläche hält sie beim ersten Verschieben fest, damit nichts springt).
// Tests: tests/fulfillment-flaeche-modell.test.ts.

import type { Baustein, KnotenForm, ProzessVorlage } from '../typen';
import { editorModell, type EditorKnoten, type EditorModell } from './editor';
import { flussFormVon } from './reise-bild';
import type { FlussForm } from '@/lib/reise/bild';
import { flaecheLage, umrissVon, FL, type Box, type FlUmriss, type FlaecheLage } from './flaeche-lage';

export { FL, umrissVon, type Box, type FlUmriss } from './flaeche-lage';

export interface FlKnoten extends Box {
  id: string; phaseId: string; titel: string; form: FlussForm; knotenForm: KnotenForm; umriss: FlUmriss;
  /** Eine Entscheidung (ja/nein) — kein Abstimmungspunkt mit dem Kunden. */
  entscheid: boolean;
  unter?: string;
  rel: { x: number; y: number }; auto: boolean;
  /** Steht als Nein-Zweig neben dieser Entscheidung. */
  neinVon?: string;
  gruppeId?: string;
}
export interface FlRahmen extends Box { id: string; nr: number; titel: string; kundeSichtbar: boolean; auto: boolean; inhalt: { b: number; h: number } }
export interface FlMarke extends Box { id: string; phaseId: string; titel: string }
export type PfeilArt = 'weiter' | 'ja' | 'nein' | 'zurueck';
export interface FlPfeil {
  id: string; von: string; nach: string; art: PfeilArt; text?: string;
  /** Wo die Beschriftung gespeichert ist (Knoten + welcher Pfeil) — fehlt an Pfeilen vom Start bzw. vom Abstimmungspunkt. */
  textAn?: { knotenId: string; art: 'weiter' | 'ja' | 'nein' };
  /** Ein Zweig, den man lösen kann (Ja-/Nein-Zweig). Der Pfeil der Reihenfolge lässt sich nicht lösen — nur umhängen. */
  zweig?: { knotenId: string; art: 'ja' | 'nein' };
  /** Über Rahmen hinweg (Phase → nächste Phase). */
  zwischen?: true;
  punkte: [number, number][];
}
export interface FlaecheBild {
  vorlageId: string; titel: string;
  rahmen: FlRahmen[]; knoten: FlKnoten[]; starts: FlMarke[]; abstimmungen: FlMarke[];
  gruppen: { id: string; phaseId: string; titel: string; box: Box }[];
  pfeile: FlPfeil[];
  /** Alles, was auf der Fläche steht (für „Alles zeigen“ und den Export). */
  box: Box;
}

const tage = (n: number) => `${n} Tag${n === 1 ? '' : 'e'}`;
/** Der kurze Satz unter einem Knoten (wie im Fluss): Frist, wer es macht, Bausteine. */
export function flaecheUnter(k: Pick<EditorKnoten, 'frist' | 'zustaendig' | 'bausteine'>): string | undefined {
  const t = [
    k.frist !== undefined ? `Frist ${tage(k.frist)}` : null,
    k.zustaendig === 'kunde' ? 'macht der Kunde' : k.zustaendig === 'beide' ? 'gemeinsam' : null,
    k.bausteine.length ? `${k.bausteine.length} Baustein${k.bausteine.length === 1 ? '' : 'e'}` : null,
  ].filter(Boolean).join(' · ');
  return t || undefined;
}

/** Die Lage einer Vorlage mit den Formen des Editors (dieselbe Regel wie der Schreibweg). */
export function lageVon(v: ProzessVorlage, m: EditorModell): FlaecheLage {
  const form = new Map<string, KnotenForm>();
  for (const p of m.phasen) for (const a of p.abschnitte) for (const k of a.knoten) form.set(k.id, k.form);
  return flaecheLage(v.knoten, k => umrissVon(form.get(k.id) ?? k.form ?? 'schritt'));
}

export function flaecheBild(v: ProzessVorlage, bausteine: readonly (Pick<Baustein, 'id' | 'titel'> & { art: string })[] = []): FlaecheBild {
  const m = editorModell(v, bausteine);
  const lage = lageVon(v, m);
  const rahmen: FlRahmen[] = [];
  const knoten: FlKnoten[] = [];
  const starts: FlMarke[] = [];
  const abstimmungen: FlMarke[] = [];
  const pfeile: FlPfeil[] = [];
  const box = new Map<string, Box>();
  const offen: Omit<FlPfeil, 'punkte'>[] = [];
  m.phasen.forEach((p, i) => {
    const r = lage.rahmen.find(x => x.id === p.id)!;
    rahmen.push({ id: p.id, nr: p.nr, titel: p.titel, kundeSichtbar: p.kundeSichtbar, x: r.x, y: r.y, b: r.b, h: r.h, auto: r.auto, inhalt: r.inhalt });
    const st = lage.start.get(p.id)!;
    const vorige = m.phasen[i - 1];
    const startId = `start:${p.id}`;
    starts.push({ id: startId, phaseId: p.id, titel: i === 0 ? 'Start' : vorige?.abstimmung ? `Nach Abstimmung ${vorige.abstimmung.nr ?? ''}`.trim() : `Nach „${vorige?.titel ?? ''}“`, ...st });
    box.set(startId, st);
    const ab = lage.abstimmung.get(p.id);
    const abId = `ab:${p.id}`;
    if (ab && p.abstimmung) {
      abstimmungen.push({ id: abId, phaseId: p.id, titel: `Abstimmungspunkt${p.abstimmung.nr ? ` ${p.abstimmung.nr}` : ''}${p.abstimmung.titel ? ` · ${p.abstimmung.titel}` : ''}`, ...ab });
      box.set(abId, ab);
    }
    const schritte = p.abschnitte.flatMap(a => a.knoten.map(k => ({ k, gruppeId: a.gruppeId })));
    for (const { k, gruppeId } of schritte) {
      const l = lage.knoten.get(k.id)!;
      const unter = flaecheUnter(k);
      knoten.push({
        id: k.id, phaseId: p.id, titel: k.titel, form: flussFormVon(k.form), knotenForm: k.form, umriss: umrissVon(k.form), entscheid: k.form === 'entscheidung',
        ...(unter ? { unter } : {}), x: l.x, y: l.y, b: l.b, h: l.h, rel: l.rel, auto: l.auto, ...(k.neinVon ? { neinVon: k.neinVon } : {}), ...(gruppeId ? { gruppeId } : {}),
      });
      box.set(k.id, l);
    }
    // ── Pfeile dieser Phase (Reihenfolge + Zweige) ──
    const naechsterStart = m.phasen[i + 1] ? `start:${m.phasen[i + 1].id}` : null;
    const ende = ab && p.abstimmung ? abId : naechsterStart;
    const alle = schritte.map(x => x.k);
    const haupt = alle.filter(k => !k.neinVon);
    const index = new Map(alle.map((k, j) => [k.id, j]));
    const nachHaupt = (j: number) => haupt[j + 1]?.id ?? ende;
    const dazu = (pf: Omit<FlPfeil, 'punkte' | 'id'>) => offen.push({ id: `${pf.von}>${pf.nach}:${pf.art}`, ...pf });
    const ausgang = (k: EditorKnoten, sonst: string | null) => {
      const pt = v.knoten.find(x => x.id === k.id)?.pfeilText;
      const ja = k.zweige?.ja;
      const ziel = ja ?? sonst;
      if (ziel) {
        const frueher = ja ? (index.get(ja) ?? Number.MAX_SAFE_INTEGER) <= (index.get(k.id) ?? -1) : false;
        const art: PfeilArt = k.form === 'entscheidung' ? 'ja' : frueher ? 'zurueck' : 'weiter';
        const text = k.form === 'entscheidung' ? pt?.ja ?? 'ja' : ja ? pt?.ja ?? (frueher ? 'zurück' : undefined) : pt?.weiter;
        dazu({ von: k.id, nach: ziel, art, ...(text ? { text } : {}), textAn: { knotenId: k.id, art: k.form === 'entscheidung' || ja ? 'ja' : 'weiter' }, ...(ja ? { zweig: { knotenId: k.id, art: 'ja' as const } } : {}), ...(ziel.startsWith('start:') ? { zwischen: true as const } : {}) });
      }
      if (k.form === 'entscheidung' && k.zweige?.nein) dazu({ von: k.id, nach: k.zweige.nein, art: 'nein', text: pt?.nein ?? 'nein', textAn: { knotenId: k.id, art: 'nein' }, zweig: { knotenId: k.id, art: 'nein' } });
    };
    const erster = haupt[0]?.id ?? ende;
    if (erster) dazu({ von: startId, nach: erster, art: 'weiter', ...(erster.startsWith('start:') ? { zwischen: true as const } : {}) });
    haupt.forEach((k, j) => ausgang(k, nachHaupt(j)));
    for (const k of alle) {
      if (!k.neinVon) continue;
      const j = haupt.findIndex(x => x.id === k.neinVon);
      ausgang(k, j >= 0 ? nachHaupt(j) : null);
    }
    if (ab && p.abstimmung && naechsterStart) dazu({ von: abId, nach: naechsterStart, art: 'ja', text: 'ja', zwischen: true });
  });
  // Ziele, die es (noch) nicht als Kasten gibt, fallen weg (nie ein Pfeil ins Leere).
  for (const s of starts) box.set(s.id, s);
  const hindernisse = [...knoten, ...starts, ...abstimmungen].map(b => ({ x: b.x, y: b.y, b: b.b, h: b.h }));
  const gesehen = new Set<string>();
  for (const pf of offen) {
    const a = box.get(pf.von), b = box.get(pf.nach);
    if (!a || !b || gesehen.has(pf.id)) continue;
    gesehen.add(pf.id);
    pfeile.push({ ...pf, punkte: pfeilWeg(a, b, hindernisse, pf.art) });
  }
  const teile: Box[] = [...rahmen, ...knoten];
  const x0 = teile.length ? Math.min(...teile.map(t => t.x)) : 0, y0 = teile.length ? Math.min(...teile.map(t => t.y)) : 0;
  const x1 = teile.length ? Math.max(...teile.map(t => t.x + t.b)) : 0, y1 = teile.length ? Math.max(...teile.map(t => t.y + t.h)) : 0;
  const gruppen = lage.gruppen.map(g => ({ id: g.id, phaseId: g.phaseId, titel: g.titel, box: g.box }));
  return { vorlageId: v.id, titel: v.titel, rahmen, knoten, starts, abstimmungen, gruppen, pfeile, box: { x: x0, y: y0, b: x1 - x0, h: y1 - y0 } };
}

// ── Gewinkelte Pfeile ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

type Pt = [number, number];
const ABSTAND_AUSSEN = 40;

/**
 * Die Kandidaten für einen gewinkelten Weg von a nach b (Ausgänge unten/rechts/links/oben, Eingänge oben/links/rechts/unten). Die Knickstelle eines Z-Wegs
 * probiert drei Lagen (Mitte, dicht vor b, dicht hinter a) — so findet sich meist eine Gasse zwischen den Knoten (bzw. den Rahmen).
 */
function kandidaten(a: Box, b: Box, hindernisse: readonly Box[], art: PfeilArt): Pt[][] {
  const ax = a.x + a.b / 2, ay = a.y + a.h / 2, bx = b.x + b.b / 2, by = b.y + b.h / 2;
  const aU: Pt = [ax, a.y + a.h], aO: Pt = [ax, a.y], aR: Pt = [a.x + a.b, ay], aL: Pt = [a.x, ay];
  const bO: Pt = [bx, b.y], bU: Pt = [bx, b.y + b.h], bL: Pt = [b.x, by], bR: Pt = [b.x + b.b, by];
  const k: Pt[][] = [];
  const unter = b.y >= a.y + a.h + 8, rechts = b.x >= a.x + a.b + 8, links = b.x + b.b <= a.x - 8, ueber = b.y + b.h <= a.y - 8;
  const knick = (von: number, bis: number) => [...new Set([Math.round((von + bis) / 2), Math.round(bis - Math.sign(bis - von) * 30), Math.round(von + Math.sign(bis - von) * 30)])];
  if (unter) {
    for (const my of knick(a.y + a.h, b.y)) k.push([aU, [ax, my], [bx, my], bO]);
    if (bx > a.x + a.b) k.push([aR, [bx, ay], bO]);
    if (bx < a.x) k.push([aL, [bx, ay], bO]);
  }
  if (rechts) {
    for (const mx of knick(a.x + a.b, b.x)) k.push([aR, [mx, ay], [mx, by], bL]);
    if (b.y > ay) k.push([aR, [bx, ay], bO]);
    if (b.y + b.h < ay) k.push([aR, [bx, ay], bU]);
  }
  if (links) {
    for (const mx of knick(a.x, b.x + b.b)) k.push([aL, [mx, ay], [mx, by], bR]);
    if (b.y > ay) k.push([aL, [bx, ay], bO]);
    if (b.y + b.h < ay) k.push([aL, [bx, ay], bU]);
  }
  if (ueber) for (const my of knick(a.y, b.y + b.h)) k.push([aO, [ax, my], [bx, my], bU]);
  // Außen herum (rechts bzw. links an allem vorbei, was zwischen den beiden liegt; oben drüber) — für den Weg zurück und wenn etwas im Weg steht.
  const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y + a.h, b.y + b.h), xa = Math.min(a.x, b.x), xb = Math.max(a.x + a.b, b.x + b.b);
  const dazwischen = hindernisse.filter(r => r.y < y1 && r.y + r.h > y0 && r.x < xb && r.x + r.b > xa);
  const rx = Math.max(xb, ...dazwischen.map(r => r.x + r.b)) + ABSTAND_AUSSEN, lx = Math.min(xa, ...dazwischen.map(r => r.x)) - ABSTAND_AUSSEN;
  k.push([aR, [rx, ay], [rx, by], bR]);
  k.push([aL, [lx, ay], [lx, by], bL]);
  // Die Schleife zurück läuft oben herum in den Eingang der Entscheidung (nicht auf dem Nein-Pfeil zurück).
  if (art === 'zurueck') { const oy = y0 - 30; k.push([aO, [ax, oy], [bx, oy], bO]); }
  return k;
}

/** Doppelte Punkte und Punkte mitten auf einer Geraden fallen weg (sonst zählten sie als Ecke). */
function sauberWeg(w0: Pt[]): Pt[] {
  const w = w0.filter((p, i) => i === 0 || p[0] !== w0[i - 1][0] || p[1] !== w0[i - 1][1]);
  return w.filter((p, i) => i === 0 || i === w.length - 1 || !((w[i - 1][0] === p[0] && p[0] === w[i + 1][0]) || (w[i - 1][1] === p[1] && p[1] === w[i + 1][1])));
}

/** Schneidet die achsenparallele Strecke p–q das Innere der Box (etwas verkleinert, damit Berührungen am Rand nicht zählen)? */
function kreuzt(p: Pt, q: Pt, r: Box): boolean {
  const x0 = Math.min(p[0], q[0]), x1 = Math.max(p[0], q[0]), y0 = Math.min(p[1], q[1]), y1 = Math.max(p[1], q[1]);
  return x1 > r.x + 2 && x0 < r.x + r.b - 2 && y1 > r.y + 2 && y0 < r.y + r.h - 2;
}

/** Wie viele Knoten der Weg kreuzt (die beiden Enden zählen nicht). */
export function wegKreuzungen(w: readonly Pt[], hindernisse: readonly Box[], a?: Box, b?: Box): number {
  let n = 0;
  const gleich = (x: Box, y?: Box) => !!y && x.x === y.x && x.y === y.y && x.b === y.b && x.h === y.h;
  for (const r of hindernisse) {
    if (gleich(r, a) || gleich(r, b)) continue;
    for (let i = 1; i < w.length; i++) if (kreuzt(w[i - 1], w[i], r)) { n++; break; }
  }
  return n;
}

/** Der gewinkelte Weg eines Pfeils (siehe Kopf): unter den Kandidaten der mit den wenigsten Kreuzungen, dann der kürzeste mit den wenigsten Ecken. */
export function pfeilWeg(a: Box, b: Box, hindernisse: readonly Box[] = [], art: PfeilArt = 'weiter'): [number, number][] {
  let best: Pt[] | null = null;
  let wert = Number.MAX_VALUE;
  for (const w0 of kandidaten(a, b, hindernisse, art)) {
    const w = sauberWeg(w0);
    let laenge = 0;
    for (let i = 1; i < w.length; i++) laenge += Math.abs(w[i][0] - w[i - 1][0]) + Math.abs(w[i][1] - w[i - 1][1]);
    // Nein geht nach rechts; der Weg zurück nie gerade auf dem Nein-Pfeil.
    const vorzug = (art === 'nein' && w[0][0] !== a.x + a.b ? 500 : 0) + (art === 'zurueck' && w.length === 2 ? 5000 : 0);
    const v = wegKreuzungen(w, hindernisse, a, b) * 100_000 + laenge + (w.length - 2) * 30 + vorzug;
    if (v < wert) { wert = v; best = w; }
  }
  return best ?? [[a.x + a.b / 2, a.y + a.h], [b.x + b.b / 2, b.y]];
}

/** Wo die Beschriftung eines Pfeils steht: Mitte der längsten Strecke. */
export function pfeilTextOrt(punkte: readonly [number, number][]): [number, number] {
  let best = 0, len = -1;
  for (let i = 1; i < punkte.length; i++) {
    const l = Math.abs(punkte[i][0] - punkte[i - 1][0]) + Math.abs(punkte[i][1] - punkte[i - 1][1]);
    if (l > len) { len = l; best = i; }
  }
  if (best === 0) return punkte[0] ?? [0, 0];
  const a = punkte[best - 1], b = punkte[best];
  return [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)];
}

/** SVG-Pfad eines Wegs mit weichen Ecken (Radius ≤ 10). */
export function pfadVon(punkte: readonly [number, number][]): string {
  if (!punkte.length) return '';
  let d = `M${punkte[0][0]} ${punkte[0][1]}`;
  for (let i = 1; i < punkte.length; i++) {
    const p = punkte[i], v = punkte[i - 1], n = punkte[i + 1];
    if (!n) { d += ` L${p[0]} ${p[1]}`; break; }
    const r = Math.min(10, Math.abs(p[0] - v[0] + p[1] - v[1]) / 2, Math.abs(n[0] - p[0] + n[1] - p[1]) / 2);
    const ein: Pt = [p[0] - Math.sign(p[0] - v[0]) * r, p[1] - Math.sign(p[1] - v[1]) * r];
    const aus: Pt = [p[0] + Math.sign(n[0] - p[0]) * r, p[1] + Math.sign(n[1] - p[1]) * r];
    d += ` L${ein[0]} ${ein[1]} Q${p[0]} ${p[1]} ${aus[0]} ${aus[1]}`;
  }
  return d;
}

// ── Reihenfolge aus Pfeilen ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Die Reihenfolge, die man aus den Pfeilen liest (siehe Kopf): topologisch; `zurueck`-Pfeile (Erinnerung → Entscheidung) zählen nicht; bei Gleichstand gilt
 * `vorrang` (Vorgabe: die Reihenfolge der Eingabe). Bleibt durch einen Kreis etwas übrig, kommt es in seiner Vorrang-Reihenfolge ans Ende.
 */
export function reiheAusPfeilen(ids: readonly string[], pfeile: readonly Pick<FlPfeil, 'von' | 'nach' | 'art'>[], vorrang?: (id: string) => number): string[] {
  const rang = new Map(ids.map((id, i) => [id, vorrang ? vorrang(id) : i]));
  const ein = new Map(ids.map(id => [id, 0]));
  const aus = new Map<string, string[]>();
  for (const p of pfeile) {
    if (p.art === 'zurueck' || !rang.has(p.von) || !rang.has(p.nach) || p.von === p.nach) continue;
    aus.set(p.von, [...(aus.get(p.von) ?? []), p.nach]);
    ein.set(p.nach, ein.get(p.nach)! + 1);
  }
  const bereit = ids.filter(id => !ein.get(id));
  const raus: string[] = [];
  const nimm = () => { bereit.sort((a, b) => rang.get(a)! - rang.get(b)!); return bereit.shift()!; };
  while (bereit.length) {
    const x = nimm();
    raus.push(x);
    for (const y of aus.get(x) ?? []) { ein.set(y, ein.get(y)! - 1); if (!ein.get(y)) bereit.push(y); }
  }
  const rest = ids.filter(id => !raus.includes(id)).sort((a, b) => rang.get(a)! - rang.get(b)!);
  return [...raus, ...rest];
}

/** Die Lage auf der Fläche, von oben nach unten, dann links nach rechts — der Vorrang bei Gleichstand. */
export const lageVorrang = (bild: Pick<FlaecheBild, 'knoten'>) => {
  const k = new Map(bild.knoten.map(x => [x.id, x.y * 100_000 + x.x]));
  return (id: string) => k.get(id) ?? 0;
};

// ── Lage festhalten ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface LageEintrag { id: string; pos: { x: number; y: number; b?: number; h?: number } | null }

/**
 * Die aktuelle Lage aller Rahmen und Schritte (für die Op `lage`) — die Fläche hält sie beim ersten Verschieben fest, damit nichts springt (eine automatisch
 * gelegte Lage hängt sonst von den anderen ab). Rahmen ohne gespeicherte Größe bleiben ohne `b`/`h` (sie wachsen mit dem Inhalt).
 */
export function lagenAlle(bild: Pick<FlaecheBild, 'rahmen' | 'knoten'>, v?: Pick<ProzessVorlage, 'knoten'>): LageEintrag[] {
  const gross = new Map((v?.knoten ?? []).filter(k => k.pos?.b || k.pos?.h).map(k => [k.id, k.pos!]));
  return [
    ...bild.rahmen.map(r => ({ id: r.id, pos: { x: Math.round(r.x), y: Math.round(r.y), ...(gross.get(r.id)?.b ? { b: gross.get(r.id)!.b } : {}), ...(gross.get(r.id)?.h ? { h: gross.get(r.id)!.h } : {}) } })),
    ...bild.knoten.map(k => ({ id: k.id, pos: { x: Math.round(k.rel.x), y: Math.round(k.rel.y) } })),
  ];
}

/** Liegt schon alles fest (jeder Rahmen, jeder Schritt hat eine Lage)? */
export const allesFest = (bild: Pick<FlaecheBild, 'rahmen' | 'knoten'>) => bild.rahmen.every(r => !r.auto) && bild.knoten.every(k => !k.auto);

/** Auf das Raster legen (an) bzw. nur runden (aus). */
export const aufRaster = (v: number, an = true) => (an ? Math.round(v / FL.raster) * FL.raster : Math.round(v));

/** Der Rahmen unter einem Punkt der Fläche (der oberste, wenn sie sich überlappen). */
export function rahmenBei(bild: Pick<FlaecheBild, 'rahmen'>, x: number, y: number): FlRahmen | null {
  for (let i = bild.rahmen.length - 1; i >= 0; i--) {
    const r = bild.rahmen[i];
    if (x >= r.x && x <= r.x + r.b && y >= r.y && y <= r.y + r.h) return r;
  }
  return null;
}

/** Der Knoten unter einem Punkt der Fläche (Raute: echte Raute, nicht ihr Kasten). */
export function knotenBei(bild: Pick<FlaecheBild, 'knoten'>, x: number, y: number, ohne?: string): FlKnoten | null {
  for (let i = bild.knoten.length - 1; i >= 0; i--) {
    const k = bild.knoten[i];
    if (k.id === ohne) continue;
    if (x < k.x || x > k.x + k.b || y < k.y || y > k.y + k.h) continue;
    if (k.umriss === 'raute' && Math.abs(x - (k.x + k.b / 2)) / (k.b / 2) + Math.abs(y - (k.y + k.h / 2)) / (k.h / 2) > 1) continue;
    return k;
  }
  return null;
}
