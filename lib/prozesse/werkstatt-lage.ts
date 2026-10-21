// ─── Prozesse · Werkstatt — die Lage auf der Fläche (Etappe B2, 21.10.; ANALYSE_100.md Punkte 18, 19, 22, 25) ───────────────────────────────────────
// Kevins Bild der Werkstatt (21.10.): „Stil wie ein n8n-Editor, aber in Klar·DARK und mit unseren Dingen“ — Knoten als abgerundete Quadrate mit Symbol, Name
// darunter; Eingang links, Ausgang rechts; Agent-Knoten breiter mit drei Andockpunkten unten (Modell · Gedächtnis · Werkzeuge), die angedockten Teile hängen als
// kleine runde Knoten darunter. Hier steht NUR die Rechnung (rein, ohne DOM, Server UND Browser) — die Zeichnung (components/os/prozesse/WerkstattFlaeche.tsx)
// rechnet nichts davon selbst:
//   · Leserichtung links → rechts (Ein- und Ausgänge der Knoten); Phasen sind Spalten-Rahmen nebeneinander, Bahnen (Punkt 25) liegen quer darüber:
//     Kunde (Außenbahn, oben) · je Person aus dem Team der Instanz · Mensch (ohne Person) · System (Regeln) · Agenten. Nur Bahnen, die etwas tragen.
//   · Wer in welcher Bahn steht, sagt `bahnSchluessel` (Bahn des Knotens, sonst des Bausteins; Person = Feld „wer“ der Maske) — nie ein Name im Code: die Namen
//     der Personen kommen zur Laufzeit aus dem Team (Auswahlquelle `team-person`).
//   · Lage eines Schritts: gespeichertes `pos` (x relativ zum Rahmen seiner Phase, y relativ zur Oberkante seiner Bahn — so bleibt er in seiner Bahn, auch wenn
//     andere Bahnen wachsen), sonst automatisch: Spalte = längster Weg im Fluss seiner Phase, Reihe = Platz in Bahn und Spalte. „Ordnen“ (Punkt 18) = alle
//     Lagen vergessen (`ordnen`), rückgängig machbar über die Geschichte. Gesetzte Lagen werden sonst respektiert.
//   · Kanten aus der EINEN Stelle `kantenVon` (lib/prozesse/fluss.ts) — hier nur ihr Weg: von einem festen Anschluss (Punkt 19: die Raute mit vier
//     Andockpunkten — links Eingang, rechts „ja“, unten „nein“, oben „Fehler“) weich zum Eingang links; Rückschleifen laufen außen unten herum und heißen
//     „zurück zu …“ (Punkt 18).
//   · Hilfslinien beim Ziehen (Punkt 19): `hilfslinien` rastet an Kanten und Mitten der Nachbarn ein und sagt, welche Linien zu zeichnen sind.
// Tests: tests/prozesse-werkstatt-lage.test.ts.

import type { Bahn, ProzessDefinition, ProzessForm, ProzessKnoten, ModelTier } from './definition';
import { kantenVon, phasen, schritteDer, seitenZiele, type Ausgang, type Kante } from './fluss';
import { katalogEintrag } from './baustein-katalog';
import { EINORDNUNG } from '@/lib/werkzeuge/einordnung';

type K = ProzessKnoten<ProzessForm>;
export interface Box { x: number; y: number; b: number; h: number }
export type Pt = [number, number];

/** Maße der Fläche (Bildpunkte der Fläche, auf dem Raster `raster`). */
export const WS = {
  raster: 20,
  /** Der Körper eines Knotens: abgerundetes Quadrat; die Raute; der Agent (breiter). */
  quadrat: 88, raute: 100, agent: { b: 240, h: 88 },
  /** Breite der Knoten-Box (mit Beschriftung darunter) und Höhe der Beschriftung (Name zwei Zeilen + Unterzeile). */
  knotenB: 184, beschriftung: 62,
  /** Agent: Andockpunkte unten — Zeile für ihre Namen, Kreise der angedockten Teile, Name darunter. */
  andock: { zeile: 22, r: 20, abstand: 48, name: 22, hoechstens: 3 },
  /** Lücke zwischen zwei Spalten bzw. zwei Reihen in einer Bahn. */
  spaltenLuecke: 72, reihenLuecke: 28,
  /** Bahnen: Spalte links mit dem Namen, Innenrand. Rahmen (Phase): Kopf mit dem Titel, Innenrand, Abstand. */
  bahnKopf: 168, bahnRand: 26,
  rahmenKopf: 64, rahmenRand: 36, rahmenAbstand: 48,
  /** Stummel am Anschluss, bevor die Kurve beginnt; Abstand der Rückschleife unter den Knoten. */
  stummel: 18, schleife: 26,
  zettel: { b: 240, h: 150 },
} as const;

// ── Bahnen (Punkt 25) ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Eine Bahn: `kunde` · `person:<Team-Kennung>` · `mensch` (ohne Person) · `system` · `agent`. */
export type BahnSchluessel = 'kunde' | 'mensch' | 'system' | 'agent' | `person:${string}`;
export interface TeamName { id: string; name: string }

/** Die Bahn eines Knotens (Feld `bahn`, sonst die des Bausteins, sonst aus der Form). */
export function bahnVon(k: Pick<K, 'bahn' | 'katalog' | 'form'>): Bahn {
  if (k.form === 'agent') return 'agent';
  if (k.bahn) return k.bahn;
  const e = katalogEintrag(k.katalog?.id);
  if (e) return e.bahn;
  return k.form === 'freigabe' || k.form === 'erinnerung' ? 'mensch' : 'system';
}
/** Die Person einer Menschen-Bahn: das Feld „wer“ der Maske (Team-Kennung), sonst keine. */
export const personVon = (k: Pick<K, 'katalog'>): string | null => {
  const w = k.katalog?.werte?.wer;
  return typeof w === 'string' && /^[a-z0-9][a-z0-9-]{0,62}$/.test(w) ? w : null;
};
export function bahnSchluessel(k: Pick<K, 'bahn' | 'katalog' | 'form'>): BahnSchluessel {
  const b = bahnVon(k);
  if (b !== 'mensch') return b;
  const p = personVon(k);
  return p ? `person:${p}` : 'mensch';
}
const BAHN_TITEL: Readonly<Record<'kunde' | 'mensch' | 'system' | 'agent', string>> = { kunde: 'Kunde', mensch: 'Mensch (offen)', system: 'System · Regeln', agent: 'Agenten' };
/** Der Name einer Bahn — Personen aus dem Team (zur Laufzeit), unbekannte als „Person (nicht mehr im Team)“. */
export function bahnTitel(s: BahnSchluessel, team: readonly TeamName[] = []): string {
  if (s.startsWith('person:')) return team.find(t => t.id === s.slice(7))?.name ?? 'Person (nicht mehr im Team)';
  return BAHN_TITEL[s as keyof typeof BAHN_TITEL];
}
/** Reihenfolge der Bahnen: Kunde außen oben, dann die Menschen (Team-Reihenfolge), System, Agenten unten. */
export function bahnenOrdnen(l: readonly BahnSchluessel[], team: readonly TeamName[] = []): BahnSchluessel[] {
  const rang = (s: BahnSchluessel) => {
    if (s === 'kunde') return 0;
    if (s.startsWith('person:')) { const i = team.findIndex(t => t.id === s.slice(7)); return 1 + (i < 0 ? 999 : i) / 10_000; }
    return s === 'mensch' ? 2 : s === 'system' ? 3 : 4;
  };
  return Array.from(new Set(l)).sort((a, b) => rang(a) - rang(b) || (a < b ? -1 : 1));
}

/**
 * Darf ein Knoten in diese Bahn gezogen werden — und wie sieht er dann aus? (rein) Agenten bleiben in der Agenten-Bahn, ein Freigabe-Schloss bei den Menschen,
 * die Kunden-Bahn trägt nur Nachrichten (Punkt 25). Eine Person setzt das Feld „wer“ — nur, wenn die Maske des Bausteins eins hat. null = nicht erlaubt.
 */
export function inBahn(k: K, ziel: BahnSchluessel): K | null {
  if (bahnSchluessel(k) === ziel) return k;
  if (k.form === 'agent' || ziel === 'agent') return null;
  if (k.form === 'freigabe' && !(ziel === 'mensch' || ziel.startsWith('person:'))) return null;
  if (ziel === 'kunde' && k.form !== 'nachricht') return null;
  const e = katalogEintrag(k.katalog?.id);
  const ohneWer = (): K => {
    if (!k.katalog?.werte || !('wer' in k.katalog.werte)) return k;
    const { wer: _w, ...rest } = k.katalog.werte;
    return { ...k, katalog: { ...k.katalog, werte: rest } };
  };
  if (ziel.startsWith('person:')) {
    if (!e?.maske.some(f => f.id === 'wer')) return null;
    return { ...k, bahn: 'mensch', katalog: { id: k.katalog!.id, werte: { ...(k.katalog!.werte ?? {}), wer: ziel.slice(7) } } };
  }
  return { ...ohneWer(), bahn: ziel as Bahn };
}

// ── Knoten: Gestalt, Maße, Anschlüsse ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Gestalt = 'quadrat' | 'raute' | 'agent';
export const gestaltVon = (f: ProzessForm | undefined): Gestalt => (f === 'entscheidung' || f === 'abstimmung' ? 'raute' : f === 'agent' ? 'agent' : 'quadrat');

/** Ein angedockter Teil am Agenten: Modell, Gedächtnis (Brain, Akte), Werkzeuge — `leer` = noch nichts angedockt („+“). */
export interface Andock { art: 'modell' | 'gedaechtnis' | 'werkzeuge'; x: number; titel: string }
export interface Unterknoten { art: Andock['art']; id: string; titel: string; cx: number; cy: number; leer?: true; schloss?: true; mehr?: number }

const STUFE_KURZ: Readonly<Record<ModelTier, string>> = { schnell: 'schnell', ausgewogen: 'ausgewogen', stark: 'stark' };

/** Die angedockten Teile eines Agenten (relativ zur Knoten-Box): je Andockpunkt die Kreise darunter. Werkzeuge der Klassen außen · Geld · Löschen tragen ein Schloss. */
export function unterknotenVon(k: Pick<K, 'agent' | 'id'>, koerper: Box): { andocks: Andock[]; teile: Unterknoten[] } {
  const A = WS.andock;
  const andocks: Andock[] = [
    { art: 'modell', x: koerper.x + koerper.b * 0.18, titel: 'Modell' },
    { art: 'gedaechtnis', x: koerper.x + koerper.b * 0.5, titel: 'Gedächtnis' },
    { art: 'werkzeuge', x: koerper.x + koerper.b * 0.82, titel: 'Werkzeuge' },
  ];
  const cy = koerper.y + koerper.h + A.zeile + A.r + 6;
  const reihe = (x: number, n: number) => Array.from({ length: n }, (_, i) => x + (i - (n - 1) / 2) * A.abstand);
  const a = k.agent;
  const teile: Unterknoten[] = [];
  const m = andocks[0];
  teile.push(a ? { art: 'modell', id: `${k.id}~modell`, titel: a.modellWahl?.modell ?? STUFE_KURZ[a.modell] ?? a.modell, cx: m.x, cy } : { art: 'modell', id: `${k.id}~modell`, titel: 'Stufe wählen', cx: m.x, cy, leer: true });
  const g = [...(a?.gedaechtnis.brain ? ['Brain'] : []), ...(a?.gedaechtnis.akte ? ['Akte'] : [])];
  if (!g.length) teile.push({ art: 'gedaechtnis', id: `${k.id}~gedaechtnis`, titel: 'kein Gedächtnis', cx: andocks[1].x, cy, leer: true });
  else reihe(andocks[1].x, g.length).forEach((x, i) => teile.push({ art: 'gedaechtnis', id: `${k.id}~g~${g[i]}`, titel: g[i], cx: x, cy }));
  const w = a?.werkzeuge ?? [];
  if (!w.length) teile.push({ art: 'werkzeuge', id: `${k.id}~werkzeuge`, titel: 'keine Werkzeuge', cx: andocks[2].x, cy, leer: true });
  else {
    const n = Math.min(w.length, A.hoechstens);
    reihe(andocks[2].x, n).forEach((x, i) => {
      const mehr = i === n - 1 && w.length > n ? w.length - n + 1 : 0;
      const name = w[i];
      const r = EINORDNUNG[name]?.rechte;
      teile.push({ art: 'werkzeuge', id: `${k.id}~w~${name}`, titel: mehr ? `+${mehr} Werkzeuge` : name, cx: x, cy, ...(mehr ? { mehr } : {}), ...(!mehr && (r === 'aussen' || r === 'geld' || r === 'loeschen') ? { schloss: true as const } : {}) });
    });
  }
  return { andocks, teile };
}

/** Maße eines Knotens: die Box (mit Beschriftung bzw. angedockten Teilen) und der Körper darin (relativ zur Box). */
export function knotenMass(k: Pick<K, 'form'>): { b: number; h: number; koerper: Box } {
  const g = gestaltVon(k.form);
  if (g === 'agent') {
    const b = WS.agent.b + 40;
    const h = WS.agent.h + WS.andock.zeile + 2 * WS.andock.r + 6 + WS.andock.name;
    return { b, h, koerper: { x: 20, y: 0, b: WS.agent.b, h: WS.agent.h } };
  }
  const s = g === 'raute' ? WS.raute : WS.quadrat;
  return { b: WS.knotenB, h: s + WS.beschriftung, koerper: { x: (WS.knotenB - s) / 2, y: 0, b: s, h: s } };
}

/** Ein Anschluss (relativ zur Knoten-Box): Eingang bzw. ein Ausgang, mit der Richtung, in die der Faden abgeht. */
export interface Anschluss { art: 'ein' | Ausgang; x: number; y: number; richtung: 'rechts' | 'unten' | 'oben' | 'links' }

/** Welche Ausgänge eine Form hat (dieselben wie die Zweige in lib/prozesse/fluss.ts; „weiter“ = der Strang). */
export const AUSGAENGE: Readonly<Record<ProzessForm, readonly Ausgang[]>> = {
  schritt: ['weiter', 'fehler'], nachricht: ['weiter', 'fehler'], termin: ['weiter', 'fehler'], abstimmung: ['weiter'],
  entscheidung: ['ja', 'nein', 'fehler'], erinnerung: ['weiter'],
  ausloeser: ['weiter'], agent: ['weiter', 'fehler'], warten: ['weiter', 'abgelaufen'], schleife: ['weiter', 'fehler'], teilprozess: ['weiter', 'fehler'],
  freigabe: ['ja', 'nein', 'abgelaufen'], ende: [],
};
/** Wie ein Ausgang an dieser Form heißt (Beschriftung des Fadens; Punkt 23: Rauten-Ausgänge immer benannt). */
export function ausgangName(f: ProzessForm, a: Ausgang): string {
  if (a === 'fehler') return 'Fehler';
  if (a === 'abgelaufen') return 'abgelaufen';
  if (f === 'freigabe') return a === 'ja' ? 'freigegeben' : a === 'nein' ? 'abgelehnt' : 'weiter';
  if (a === 'ja') return 'ja';
  if (a === 'nein') return 'nein';
  return 'weiter';
}

/** Die Anschlüsse eines Knotens (relativ zur Box). Raute: vier feste Andockpunkte (links Eingang, rechts ja, unten nein, oben Fehler). */
export function anschluesse(k: Pick<K, 'form'>): Anschluss[] {
  const f = k.form ?? 'schritt';
  const { koerper: c } = knotenMass(k);
  const cy = c.y + c.h / 2;
  const raus: Anschluss[] = [];
  if (f !== 'ausloeser') raus.push({ art: 'ein', x: c.x, y: cy, richtung: 'links' });
  if (gestaltVon(f) === 'raute') {
    for (const a of AUSGAENGE[f]) {
      if (a === 'ja' || a === 'weiter') raus.push({ art: a, x: c.x + c.b, y: cy, richtung: 'rechts' });
      else if (a === 'nein') raus.push({ art: a, x: c.x + c.b / 2, y: c.y + c.h, richtung: 'unten' });
      else raus.push({ art: a, x: c.x + c.b / 2, y: c.y, richtung: 'oben' });
    }
    return raus;
  }
  const aus = AUSGAENGE[f];
  // Rechts übereinander: der Hauptausgang mittig (bzw. oben), die übrigen darunter; „Fehler“ immer unten.
  const anteile = aus.length <= 1 ? [0.5] : aus.length === 2 ? [0.4, 0.8] : [0.26, 0.56, 0.86];
  aus.forEach((a, i) => raus.push({ art: a, x: c.x + c.b, y: c.y + c.h * anteile[i], richtung: 'rechts' }));
  return raus;
}

// ── Die Lage ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface KnotenLageW extends Box {
  id: string; phaseId: string; bahn: BahnSchluessel; gestalt: Gestalt; koerper: Box; anschluesse: Anschluss[];
  /** Automatisch gelegt (kein gespeichertes `pos`). */
  auto: boolean;
  /** Spalte und Reihe der automatischen Lage. */
  spalte: number; reihe: number;
  unterknoten?: { andocks: Andock[]; teile: Unterknoten[] };
  /** Eine zugeklappte Phase (Punkt 8: „Teilprozess zugeklappt als Kachel“) — Kennung `zu:<Phase>`, Fäden ihrer Schritte enden an der Kachel. */
  zu?: { phaseId: string; titel: string; schritte: number };
}
/** Kennung der Kachel einer zugeklappten Phase. */
export const zuKennung = (phaseId: string) => `zu:${phaseId}`;
export interface BahnLage extends Box { schluessel: BahnSchluessel; titel: string }
export interface RahmenLageW extends Box { id: string; nr: number; titel: string }
export interface KanteLage extends Kante { id: string; punkte: Pt[]; zurueck: boolean; text?: string; textOrt?: Pt }
export interface WerkstattLage {
  knoten: Map<string, KnotenLageW>; bahnen: BahnLage[]; rahmen: RahmenLageW[]; kanten: KanteLage[];
  /** Alles (Rahmen, Bahnen, Zettel). */
  box: Box;
}

const nachRang = (a: K, b: K) => a.rang - b.rang || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Spalten je Schritt einer Phase: längster Weg über die Vorwärts-Kanten (Rückschleifen Erinnerung → Entscheidung und Wege zurück zählen nicht). */
export function spaltenDer(d: Pick<ProzessDefinition, 'knoten'>, phaseId: string, kanten: readonly Kante[] = kantenVon(d)): Map<string, number> {
  const schritte = schritteDer(d, phaseId);
  const index = new Map(schritte.map((s, i) => [s.id, i]));
  const nach = new Map(schritte.map(s => [s.id, s]));
  const seite = seitenZiele(d.knoten);
  const vor = kanten.filter(k => k.nach && index.has(k.von) && index.has(k.nach) && k.von !== k.nach).filter(k => {
    const a = nach.get(k.von)!, b = nach.get(k.nach!)!;
    if (a.form === 'erinnerung' && b.form === 'entscheidung') return false;
    return index.get(k.nach!)! > index.get(k.von)! || seite.get(k.nach!) === k.von;
  });
  const spalte = new Map(schritte.map(s => [s.id, 0]));
  // Höchstens n Runden (ein Kreis im Entwurf — die Prüfung meldet ihn — hält die Rechnung nie auf).
  for (let r = 0; r < schritte.length; r++) {
    let anders = false;
    for (const k of vor) { const w = spalte.get(k.von)! + 1; if (w > spalte.get(k.nach!)! && w <= schritte.length) { spalte.set(k.nach!, w); anders = true; } }
    if (!anders) break;
  }
  return spalte;
}

/**
 * Die ganze Lage (rein, deterministisch): Rahmen der Phasen nebeneinander, Bahnen quer darüber, je Schritt Box/Körper/Anschlüsse, die Kanten mit Weg und
 * Beschriftung. `team` = Namen der Bahnen (zur Laufzeit), `zettel` = Notiz-Zettel (absolute Lage).
 */
export function werkstattLage(d: Pick<ProzessDefinition, 'knoten' | 'zettel'>, o: { team?: readonly TeamName[]; zu?: ReadonlySet<string> } = {}): WerkstattLage {
  const team = o.team ?? [];
  const ps = phasen(d);
  const kantenAlle = kantenVon(d);
  const zuPhasen = new Set(ps.filter(p => o.zu?.has(p.id)).map(p => p.id));
  const zuVon = new Map<string, string>();
  const jeAlle = ps.map(p => ({ p, schritte: schritteDer(d, p.id), spalten: spaltenDer(d, p.id, kantenAlle) }));
  for (const x of jeAlle) if (zuPhasen.has(x.p.id)) for (const s of x.schritte) zuVon.set(s.id, zuKennung(x.p.id));
  const je = jeAlle.map(x => (zuPhasen.has(x.p.id) ? { ...x, zuAnzahl: x.schritte.length, schritte: [] as K[] } : { ...x, zuAnzahl: 0 }));
  const alle = je.flatMap(x => x.schritte);
  const bahnen = bahnenOrdnen(alle.length ? alle.map(bahnSchluessel) : ['system'], team);
  const mass = new Map(alle.map(k => [k.id, knotenMass(k)]));
  // Reihen je (Phase, Bahn, Spalte): in Lese-Reihenfolge (Strang vor Abzweigen).
  const seite = seitenZiele(d.knoten);
  const reihe = new Map<string, number>();
  for (const { p, schritte, spalten } of je) {
    const belegt = new Map<string, number>();
    const reihen = [...schritte].sort((a, b) => Number(seite.has(a.id)) - Number(seite.has(b.id)) || nachRang(a, b));
    for (const s of reihen) {
      const key = `${p.id}|${bahnSchluessel(s)}|${spalten.get(s.id)}`;
      const n = belegt.get(key) ?? 0;
      reihe.set(s.id, n);
      belegt.set(key, n + 1);
    }
  }
  // Bahnen: Höhe = Reihen × Reihenhöhe (höchster Knoten der Bahn), mindestens so hoch wie gespeicherte Lagen darin.
  const bahnY = new Map<BahnSchluessel, number>();
  const bahnH = new Map<BahnSchluessel, number>();
  const bahnReiheH = new Map<BahnSchluessel, number>();
  let y = WS.rahmenKopf;
  for (const b of bahnen) {
    const drin = alle.filter(k => bahnSchluessel(k) === b);
    const reiheH = Math.max(WS.quadrat + WS.beschriftung, ...drin.map(k => mass.get(k.id)!.h)) + WS.reihenLuecke;
    const n = Math.max(1, ...drin.filter(k => !k.pos).map(k => reihe.get(k.id)! + 1));
    const fest = Math.max(0, ...drin.filter(k => k.pos).map(k => k.pos!.y + mass.get(k.id)!.h + WS.bahnRand));
    const h = Math.max(2 * WS.bahnRand + n * reiheH - WS.reihenLuecke, fest);
    bahnY.set(b, y); bahnH.set(b, h); bahnReiheH.set(b, reiheH);
    y += h;
  }
  const unten = y + WS.rahmenRand / 2;
  // Rahmen (Phasen) nebeneinander; Spaltenbreite = breitester Knoten der Spalte.
  const knoten = new Map<string, KnotenLageW>();
  const rahmen: RahmenLageW[] = [];
  let x = WS.bahnKopf;
  je.forEach(({ p, schritte, spalten, zuAnzahl }, i) => {
    if (zuPhasen.has(p.id)) {
      // Zugeklappt: eine Kachel in der obersten Bahn, mit Eingang links und Ausgang rechts.
      const m = knotenMass({ form: 'teilprozess' });
      const b = WS.knotenB + 2 * WS.rahmenRand;
      const by = bahnY.get(bahnen[0]) ?? WS.rahmenKopf;
      const id = zuKennung(p.id);
      knoten.set(id, { id, phaseId: p.id, bahn: bahnen[0], gestalt: 'quadrat', x: x + WS.rahmenRand, y: by + WS.bahnRand, b: m.b, h: m.h, koerper: m.koerper,
        anschluesse: anschluesse({ form: 'abstimmung' }), auto: true, spalte: 0, reihe: 0, zu: { phaseId: p.id, titel: p.titel, schritte: zuAnzahl } });
      rahmen.push({ id: p.id, nr: i + 1, titel: p.titel, x, y: 0, b, h: unten });
      x += b + WS.rahmenAbstand;
      return;
    }
    const nSp = Math.max(1, ...schritte.map(s => spalten.get(s.id)! + 1));
    const breite = Array.from({ length: nSp }, (_, c) => Math.max(WS.knotenB, ...schritte.filter(s => spalten.get(s.id) === c).map(s => mass.get(s.id)!.b)));
    const spX: number[] = [];
    breite.reduce((a, b, c) => { spX[c] = a; return a + b + WS.spaltenLuecke; }, WS.rahmenRand);
    const autoB = spX[nSp - 1] + breite[nSp - 1] + WS.rahmenRand;
    const festB = Math.max(0, ...schritte.filter(s => s.pos).map(s => s.pos!.x + mass.get(s.id)!.b + WS.rahmenRand));
    const b = Math.max(autoB, festB, WS.knotenB + 2 * WS.rahmenRand);
    for (const s of schritte) {
      const m = mass.get(s.id)!;
      const bahn = bahnSchluessel(s);
      const by = bahnY.get(bahn)!;
      const sp = spalten.get(s.id)!, rh = reihe.get(s.id)!;
      const ax = x + spX[sp] + (breite[sp] - m.b) / 2, ay = by + WS.bahnRand + rh * bahnReiheH.get(bahn)!;
      const kx = s.pos ? x + s.pos.x : ax, ky = s.pos ? by + s.pos.y : ay;
      knoten.set(s.id, {
        id: s.id, phaseId: p.id, bahn, gestalt: gestaltVon(s.form), x: kx, y: ky, b: m.b, h: m.h, koerper: m.koerper, anschluesse: anschluesse(s),
        auto: !s.pos, spalte: sp, reihe: rh,
        ...(s.form === 'agent' ? { unterknoten: unterknotenVon(s, m.koerper) } : {}),
      });
    }
    rahmen.push({ id: p.id, nr: i + 1, titel: p.titel, x, y: 0, b, h: unten });
    x += b + WS.rahmenAbstand;
  });
  const rechts = Math.max(x - WS.rahmenAbstand, WS.bahnKopf + 2 * WS.rahmenRand + WS.knotenB);
  const bahnLagen: BahnLage[] = bahnen.map(b => ({ schluessel: b, titel: bahnTitel(b, team), x: 0, y: bahnY.get(b)!, b: rechts, h: bahnH.get(b)! }));
  const kanten = kantenWege(d, knoten, kantenAlle, zuVon);
  const teile: Box[] = [...rahmen, ...bahnLagen, ...(d.zettel ?? []).map(z => ({ x: z.pos.x, y: z.pos.y, b: z.pos.b ?? WS.zettel.b, h: z.pos.h ?? WS.zettel.h }))];
  const x0 = Math.min(0, ...teile.map(t => t.x)), y0 = Math.min(0, ...teile.map(t => t.y));
  const x1 = Math.max(...teile.map(t => t.x + t.b)), y1 = Math.max(...teile.map(t => t.y + t.h));
  return { knoten, bahnen: bahnLagen, rahmen, kanten, box: { x: x0, y: y0, b: x1 - x0, h: y1 - y0 } };
}

// ── Kanten: Wege und Beschriftung ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ein Anschluss in Welt-Koordinaten. */
export const anschlussAbs = (k: Pick<KnotenLageW, 'x' | 'y' | 'anschluesse'>, art: Anschluss['art']): (Anschluss & { abs: Pt }) | null => {
  const a = k.anschluesse.find(x => x.art === art);
  return a ? { ...a, abs: [k.x + a.x, k.y + a.y] } : null;
};
/** Der Ausgang, an dem eine Kante abgeht: genau dieser, sonst (ein „ja“ an einer Form ohne „ja“) der Hauptausgang. */
const ausgangAn = (k: KnotenLageW, a: Ausgang) => anschlussAbs(k, a) ?? anschlussAbs(k, 'weiter') ?? anschlussAbs(k, 'ja');

const r1 = (v: number) => Math.round(v * 10) / 10;
/** Kubische Kurve (rein) als Punkte. */
function kurve(a: Pt, c1: Pt, c2: Pt, b: Pt, n = 14): Pt[] {
  const raus: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    raus.push([r1(u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0]), r1(u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1])]);
  }
  return raus;
}

/**
 * Der Weg eines Fadens von einem Ausgang zum Eingang (rein): kurzer Stummel in Richtung des Ausgangs, dann eine weiche Kurve in den Eingang (von links). Liegt
 * das Ziel nicht rechts vom Ausgang, läuft der Faden als Rückschleife außen unten herum (`zurueck`).
 */
export function fadenWeg(von: Pt, richtung: Anschluss['richtung'], nach: Pt, unterkante: number): { punkte: Pt[]; zurueck: boolean } {
  const S = WS.stummel;
  const p1: Pt = richtung === 'unten' ? [von[0], von[1] + S] : richtung === 'oben' ? [von[0], von[1] - S] : [von[0] + S, von[1]];
  const q1: Pt = [nach[0] - S, nach[1]];
  if (q1[0] < p1[0] + 12) {
    const yu = r1(unterkante + WS.schleife);
    const rx = r1(Math.max(p1[0], von[0] + S));
    return { punkte: [von, p1, [rx, p1[1]], [rx, yu], [q1[0] - S, yu], [q1[0] - S, nach[1]], q1, nach], zurueck: true };
  }
  const dx = Math.max(40, (q1[0] - p1[0]) * 0.5);
  const start: Pt = richtung === 'rechts' ? p1 : [p1[0], p1[1]];
  return { punkte: [von, ...kurve(start, [start[0] + dx, start[1]], [q1[0] - dx, q1[1]], q1), nach], zurueck: false };
}

/** Alle Kanten mit Weg (rein). Kanten ins Leere (`nach: null` — der Lauf endet) haben keinen Faden; ein „abgelaufen“ ohne eigenes Ziel am Warten auch nicht. */
export function kantenWege(d: Pick<ProzessDefinition, 'knoten'>, knoten: ReadonlyMap<string, KnotenLageW>, kanten: readonly Kante[] = kantenVon(d), zuVon: ReadonlyMap<string, string> = new Map()): KanteLage[] {
  const nachId = new Map(d.knoten.map(k => [k.id, k]));
  const raus: KanteLage[] = [];
  const gesehen = new Set<string>();
  for (const k0 of kanten) {
    if (!k0.nach) continue;
    // Fäden in eine zugeklappte Phase enden an ihrer Kachel, Fäden heraus beginnen dort; Fäden darin entfallen.
    const von = zuVon.get(k0.von) ?? k0.von, zuNach = zuVon.get(k0.nach) ?? k0.nach;
    if (von === zuNach) continue;
    const k: Kante = von === k0.von && zuNach === k0.nach ? k0 : { von, nach: zuNach, ausgang: von === k0.von ? k0.ausgang : 'weiter' };
    const schluessel = `${k.von}>${k.nach}:${k.ausgang}`;
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    const a = knoten.get(k.von), b = knoten.get(k.nach!);
    if (!a || !b) continue;
    const kv = nachId.get(k.von);
    if (k.ausgang === 'abgelaufen' && kv?.form === 'warten' && !kv.zweige?.abgelaufen) continue;
    const aus = ausgangAn(a, k.ausgang);
    const ein = anschlussAbs(b, 'ein');
    if (!aus || !ein) continue;
    const w = fadenWeg(aus.abs, aus.richtung, ein.abs, Math.max(a.y + a.h, b.y + b.h));
    const f = kv?.form ?? 'schritt';
    const eigen = k.ausgang === 'weiter' ? kv?.pfeilText?.weiter : kv?.pfeilText?.[k.ausgang];
    const zielTitel = nachId.get(k.nach!)?.titel ?? b.zu?.titel ?? '';
    const zeigen = eigen ?? (w.zurueck ? `zurück zu „${zielTitel}“` : k.ausgang === 'weiter' ? undefined : ausgangName(f, k.ausgang));
    const textOrt: Pt | undefined = zeigen
      ? w.zurueck ? [r1((w.punkte[3][0] + w.punkte[4][0]) / 2), w.punkte[3][1] + 14]
        : aus.richtung === 'unten' ? [aus.abs[0] + 8, aus.abs[1] + 14] : aus.richtung === 'oben' ? [aus.abs[0] + 8, aus.abs[1] - 8] : [aus.abs[0] + 10, aus.abs[1] - 8]
      : undefined;
    raus.push({ ...k, id: schluessel, punkte: w.punkte, zurueck: w.zurueck, ...(zeigen ? { text: zeigen } : {}), ...(textOrt ? { textOrt } : {}) });
  }
  return raus;
}

// ── Ordnen, Lage festhalten, Hilfslinien ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** „Ordnen“ (Punkt 18): alle gespeicherten Lagen der Schritte und Phasen vergessen — die automatische Lage gilt (rein; rückgängig über die Geschichte). */
export function ordnen<D extends Pick<ProzessDefinition, 'knoten'>>(d: D): D {
  if (!d.knoten.some(k => k.pos)) return d;
  return { ...d, knoten: d.knoten.map(k => { if (!k.pos) return k; const { pos: _p, ...rest } = k; return rest as K; }) };
}

/** Die aktuelle Lage aller Schritte als gespeicherte Lage (x relativ zum Rahmen, y relativ zur Bahn) — beim ersten Verschieben, damit nichts springt. */
export function lagenFesthalten<D extends Pick<ProzessDefinition, 'knoten'>>(d: D, l: Pick<WerkstattLage, 'knoten' | 'rahmen' | 'bahnen'>): D {
  const rx = new Map(l.rahmen.map(r => [r.id, r.x]));
  const by = new Map(l.bahnen.map(b => [b.schluessel, b.y]));
  return {
    ...d, knoten: d.knoten.map(k => {
      const x = l.knoten.get(k.id);
      if (!x || k.pos) return k;
      return { ...k, pos: { x: Math.round(x.x - (rx.get(x.phaseId) ?? 0)), y: Math.round(x.y - (by.get(x.bahn) ?? 0)) } };
    }),
  };
}

/** Wohin ein Punkt der Fläche fällt: Rahmen (Phase) und Bahn — null außerhalb. */
export function ortBei(l: Pick<WerkstattLage, 'rahmen' | 'bahnen'>, x: number, y: number): { phaseId: string; bahn: BahnSchluessel; rahmenX: number; bahnY: number } | null {
  const r = l.rahmen.find(r => x >= r.x && x <= r.x + r.b);
  const b = l.bahnen.find(b => y >= b.y && y <= b.y + b.h) ?? (l.bahnen.length && y > l.bahnen[l.bahnen.length - 1].y ? l.bahnen[l.bahnen.length - 1] : l.bahnen[0]);
  return r && b ? { phaseId: r.id, bahn: b.schluessel, rahmenX: r.x, bahnY: b.y } : null;
}

export interface Hilfslinie { x1: number; y1: number; x2: number; y2: number }
/**
 * Hilfslinien (Punkt 19): eine gezogene Box rastet an Kante bzw. Mitte der Nachbarn ein (Abstand ≤ `toleranz`), sonst ans Raster (`raster`, 0 = aus).
 * Liefert die eingerastete Lage und die zu zeichnenden Linien (über die ganze Strecke zwischen den Boxen).
 */
export function hilfslinien(box: Box, andere: readonly Box[], o: { toleranz?: number; raster?: number } = {}): { x: number; y: number; linien: Hilfslinie[] } {
  const t = o.toleranz ?? 6, ras = o.raster ?? 0;
  const xs = (b: Box) => [b.x, b.x + b.b / 2, b.x + b.b];
  const ys = (b: Box) => [b.y, b.y + b.h / 2, b.y + b.h];
  let bestX: { d: number; dx: number; mit: Box } | null = null, bestY: { d: number; dy: number; mit: Box } | null = null;
  for (const a of andere) {
    xs(box).forEach((v, i) => { const w = xs(a)[i]; const d = Math.abs(w - v); if (d <= t && (!bestX || d < bestX.d)) bestX = { d, dx: w - v, mit: a }; });
    ys(box).forEach((v, i) => { const w = ys(a)[i]; const d = Math.abs(w - v); if (d <= t && (!bestY || d < bestY.d)) bestY = { d, dy: w - v, mit: a }; });
  }
  const bx = bestX as { d: number; dx: number; mit: Box } | null, byy = bestY as { d: number; dy: number; mit: Box } | null;
  const rastern = (v: number) => (ras > 0 ? Math.round(v / ras) * ras : Math.round(v));
  const x = bx ? Math.round(box.x + bx.dx) : rastern(box.x);
  const y = byy ? Math.round(box.y + byy.dy) : rastern(box.y);
  const linien: Hilfslinie[] = [];
  if (bx) {
    const m = bx.mit, vx = [x, x + box.b / 2, x + box.b].find(v => xs(m).some(w => Math.abs(w - v) < 0.5)) ?? x;
    linien.push({ x1: vx, y1: Math.min(y, m.y) - 12, x2: vx, y2: Math.max(y + box.h, m.y + m.h) + 12 });
  }
  if (byy) {
    const m = byy.mit, vy = [y, y + box.h / 2, y + box.h].find(v => ys(m).some(w => Math.abs(w - v) < 0.5)) ?? y;
    linien.push({ x1: Math.min(x, m.x) - 12, y1: vy, x2: Math.max(x + box.b, m.x + m.b) + 12, y2: vy });
  }
  return { x, y, linien };
}

/** Kleinster Zoom beim Öffnen der Werkstatt: darunter wären die Namen (15 px) auf dem Bildschirm kleiner als 12 px. */
export const WERKSTATT_LESBAR = 12 / 15;
/**
 * Die Kamera beim Öffnen (rein; Befund 21.10.: „lesbar beim Öffnen“): alles zeigen, wenn es lesbar passt (höchstens 100 %); sonst lesbar (`WERKSTATT_LESBAR`)
 * und oben links am Anfang des Ablaufs beginnen — „Alles zeigen“ holt den ganzen Prozess.
 */
export function startKamera(box: Box, buehne: { b: number; h: number }, rand = 32): { s: number; x: number; y: number } {
  const s = Math.min(1, (buehne.b - 2 * rand) / Math.max(1, box.b), (buehne.h - 2 * rand) / Math.max(1, box.h));
  if (s >= WERKSTATT_LESBAR) return { s, x: Math.round((buehne.b - box.b * s) / 2 - box.x * s), y: Math.round((buehne.h - box.h * s) / 2 - box.y * s) };
  const l = WERKSTATT_LESBAR;
  return { s: l, x: Math.round(rand - box.x * l), y: Math.round(rand - box.y * l) };
}
