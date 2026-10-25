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

import type { Bahn, KnotenLage, ProzessDefinition, ProzessForm, ProzessKnoten, ModelTier } from './definition';
import { kantenVon, phasen, schritteDer, seitenZiele, type Ausgang, type Kante } from './fluss';
import { katalogEintrag } from './baustein-katalog';
import { EINORDNUNG } from '@/lib/werkzeuge/einordnung';
import { einpassen, freiesFeld, type Raender } from '@/lib/einpassen';

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
  /** Feinschliff 22.10. (Befund 3): Abstand der Zettel zueinander und zur Oberkante der Rahmen (sie liegen darüber). */
  zettelAbstand: 24,
  /**
   * Feinschliff 22.10. (Befund 4): der Name einer Raute steht um so viel tiefer — zwischen Körper und Name haben der „nein“-Ausgang, sein „+“ und die
   * Beschriftung des Fadens Platz (vorher lag „nein“ bzw. der Pfeil-Text auf dem Namen).
   */
  rauteTitel: 44,
  /** Beschriftung eines Fadens (Chip): Schriftgröße und Höhe — dieselben Maße zeichnet die Fläche. */
  chip: { schrift: 13, hoehe: 22 },
  /**
   * Feinschliff 1 (23.10., Sichtprüfung 22.10.): die Marken der Ausgänge — Radius des „+“ (kleiner bei drei Ausgängen rechts), Abstand vom Anschluss (rechts
   * bzw. senkrecht), Luft zu Beschriftungen und Knoten, Abstand des Namens. Das „+“ unten an der Raute steht RECHTS neben dem Körper auf Höhe des Stummels (dort
   * biegt der „nein“-Faden ab) — nie zwischen Körper und Name, wo ein Klick den Knoten meint (`knotenTreffer`).
   */
  ausgang: { r: 13, rKlein: 11, abstand: 20, senkrecht: 34, luft: 6, name: 12 },
} as const;

// ── Bahnen (Punkt 25) ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Eine Bahn: `kunde` · `person:<Team-Kennung>` · `mensch` (ohne Person) · `system` · `agent`. */
export type BahnSchluessel = 'kunde' | 'mensch' | 'system' | 'agent' | `person:${string}`;
export interface TeamName { id: string; name: string }
/** Das Team für die Bahnen aus der Auswahlliste „team-person“ (Rollen wie „Zuständig im Fall“ sind keine Bahn) — EINE Regel für Fläche, Panel und Auswahl. */
export const teamAusAuswahl = (liste: readonly { id: string; label: string }[] | undefined): TeamName[] =>
  (liste ?? []).filter(t => !t.id.startsWith('rolle:')).map(t => ({ id: t.id, name: t.label }));

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
  return { b: WS.knotenB, h: s + WS.beschriftung + (g === 'raute' ? WS.rauteTitel : 0), koerper: { x: (WS.knotenB - s) / 2, y: 0, b: s, h: s } };
}

/** Grundlinie der ersten Zeile des Namens (relativ zur Knoten-Box) — unter dem Körper; bei der Raute tiefer (Befund 4). Der Agent trägt den Namen im Körper. */
export const titelOben = (l: Pick<KnotenLageW, 'gestalt' | 'koerper'>): number => l.koerper.y + l.koerper.h + 22 + (l.gestalt === 'raute' ? WS.rauteTitel : 0);
/** Die Fläche von Name und Unterzeile in Welt-Koordinaten (rein, großzügig: volle Breite, zwei Zeilen) — null beim Agenten (Name im Körper). */
export function titelBox(l: Pick<KnotenLageW, 'x' | 'y' | 'b' | 'gestalt' | 'koerper'>): Box | null {
  if (l.gestalt === 'agent') return null;
  const t = titelOben(l);
  return { x: l.x + 4, y: l.y + t - 13, b: l.b - 8, h: 2 * 15 * 1.22 + 13 + 8 };
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
/**
 * Läuft dieses Warten je ab? Eine feste Dauer nicht — der Motor geht nach der Dauer „weiter“ (lib/prozesse/lauf-regeln.ts `weckenZeit`); „abgelaufen“ gibt es nur beim
 * Warten bis Datum bzw. auf ein Ereignis (Obergrenze erreicht, Datum bzw. Ereignis noch nicht da). Bau-Test 24.10.
 */
export const wartenDauer = (k: Pick<K, 'form' | 'warten' | 'katalog'>): boolean => k.form === 'warten' && (k.warten ? k.warten.art === 'dauer' : k.katalog?.id === 'warten.dauer');
/** Die Ausgänge eines Knotens (rein): die seiner Form — am Warten mit fester Dauer ohne „abgelaufen“ (außer es trägt dort schon ein Ziel, das man lösen können muss). */
export function ausgaengeVon(k: Pick<K, 'form' | 'warten' | 'katalog' | 'zweige'>): readonly Ausgang[] {
  const a = AUSGAENGE[k.form ?? 'schritt'];
  return wartenDauer(k) && !k.zweige?.abgelaufen ? a.filter(x => x !== 'abgelaufen') : a;
}
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
export function anschluesse(k: Pick<K, 'form'> & Partial<Pick<K, 'warten' | 'katalog' | 'zweige'>>): Anschluss[] {
  const f = k.form ?? 'schritt';
  const { koerper: c } = knotenMass(k);
  const cy = c.y + c.h / 2;
  const raus: Anschluss[] = [];
  if (f !== 'ausloeser') raus.push({ art: 'ein', x: c.x, y: cy, richtung: 'links' });
  if (gestaltVon(f) === 'raute') {
    for (const a of ausgaengeVon(k)) {
      if (a === 'ja' || a === 'weiter') raus.push({ art: a, x: c.x + c.b, y: cy, richtung: 'rechts' });
      else if (a === 'nein') raus.push({ art: a, x: c.x + c.b / 2, y: c.y + c.h, richtung: 'unten' });
      else raus.push({ art: a, x: c.x + c.b / 2, y: c.y, richtung: 'oben' });
    }
    return raus;
  }
  const aus = ausgaengeVon(k);
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
/**
 * Ein Faden mit Weg. `zurueck` = er läuft als Schleife außen herum (das Ziel liegt links — Geometrie); `rueckwaerts` = er führt wirklich zu einem FRÜHEREN Schritt im
 * Ablauf (Phase, dann Rang). Nur dann heißt er „zurück zu …“ (Runde 3, Bau-Test 2: eine ⌘V-Kopie links unten hieß „zurück zu …“, obwohl sie danach kommt).
 */
export interface KanteLage extends Kante { id: string; punkte: Pt[]; zurueck: boolean; rueckwaerts?: boolean; text?: string; textOrt?: Pt }
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
 * das Ziel nicht rechts vom Ausgang, läuft der Faden als Rückschleife außen unten herum (`zurueck`). `seitlich` (Befund 4, Raute unten): nach dem Stummel erst
 * so weit waagerecht nach rechts, dann die Kurve — so läuft der „nein“-Faden am Namen unter der Raute vorbei statt durch ihn.
 */
export function fadenWeg(von: Pt, richtung: Anschluss['richtung'], nach: Pt, unterkante: number, seitlich = 0): { punkte: Pt[]; zurueck: boolean } {
  const S = WS.stummel;
  const p1: Pt = richtung === 'unten' ? [von[0], von[1] + S] : richtung === 'oben' ? [von[0], von[1] - S] : [von[0] + S, von[1]];
  const quer = (richtung === 'unten' || richtung === 'oben') && seitlich > 0;
  const p2: Pt = quer ? [r1(p1[0] + seitlich), p1[1]] : p1;
  const q1: Pt = [nach[0] - S, nach[1]];
  if (q1[0] < p2[0] + 12) {
    const yu = r1(unterkante + WS.schleife);
    const rx = r1(Math.max(p2[0], von[0] + S));
    return { punkte: [von, p1, [rx, p1[1]], [rx, yu], [q1[0] - S, yu], [q1[0] - S, nach[1]], q1, nach], zurueck: true };
  }
  const dx = Math.max(40, (q1[0] - p2[0]) * 0.5);
  return { punkte: [von, ...(quer ? [p1] : []), ...kurve(p2, [p2[0] + dx, p2[1]], [q1[0] - dx, q1[1]], q1), nach], zurueck: false };
}

/** Alle Kanten mit Weg (rein). Kanten ins Leere (`nach: null` — der Lauf endet) haben keinen Faden; ein „abgelaufen“ ohne eigenes Ziel am Warten auch nicht. */
export function kantenWege(d: Pick<ProzessDefinition, 'knoten'>, knoten: ReadonlyMap<string, KnotenLageW>, kanten: readonly Kante[] = kantenVon(d), zuVon: ReadonlyMap<string, string> = new Map()): KanteLage[] {
  const nachId = new Map(d.knoten.map(k => [k.id, k]));
  // Die Reihenfolge im Ablauf (Phase, dann Rang) — „zurück zu …“ nur, wenn das Ziel davor liegt.
  const reihe = new Map(phasen(d).flatMap(p => schritteDer(d, p.id)).map((k, i) => [k.id, i]));
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
    // Raute unten (Befund 4): erst bis an den rechten Rand der Knoten-Box, dann die Kurve — der Faden kreuzt den Namen nie.
    const seitlich = aus.richtung === 'unten' && a.gestalt === 'raute' ? a.x + a.b - aus.abs[0] : 0;
    const w = fadenWeg(aus.abs, aus.richtung, ein.abs, Math.max(a.y + a.h, b.y + b.h), seitlich);
    const f = kv?.form ?? 'schritt';
    const eigen = k.ausgang === 'weiter' ? kv?.pfeilText?.weiter : kv?.pfeilText?.[k.ausgang];
    const zielTitel = nachId.get(k.nach!)?.titel ?? b.zu?.titel ?? '';
    const iVon = reihe.get(k0.von), iNach = reihe.get(k0.nach);
    const rueckwaerts = iVon !== undefined && iNach !== undefined && iNach <= iVon;
    const zeigen = eigen ?? (rueckwaerts ? `zurück zu „${zielTitel}“` : k.ausgang === 'weiter' ? undefined : ausgangName(f, k.ausgang));
    const textOrt: Pt | undefined = zeigen
      ? w.zurueck ? [r1((w.punkte[3][0] + w.punkte[4][0]) / 2), w.punkte[3][1] + 14]
        // unten (Befund 4): rechts neben dem „+“ des Ausgangs, auf dem waagerechten Stück des Fadens — über dem Namen der Raute, nie darauf.
        : aus.richtung === 'unten' ? [aus.abs[0] + 22, aus.abs[1] + 14] : aus.richtung === 'oben' ? [aus.abs[0] + 8, aus.abs[1] - 8] : [aus.abs[0] + 10, aus.abs[1] - 8]
      : undefined;
    raus.push({ ...k, id: schluessel, punkte: w.punkte, zurueck: w.zurueck, ...(rueckwaerts ? { rueckwaerts } : {}), ...(zeigen ? { text: zeigen } : {}), ...(textOrt ? { textOrt } : {}) });
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

/**
 * Wo Kopien beim Einfügen (⌘V) liegen (rein, Werkstatt-Fäden 24.10., Bau-Test): an der Mausposition (bzw. der Mitte des sichtbaren Bereichs) — die Gruppe behält ihre
 * Anordnung (Lage der Originale, sonst nebeneinander); liegt dort schon ein Knoten, rückt sie nach unten in freien Platz. Jede Kopie bleibt in ihrer Bahn (liegt der
 * Punkt außerhalb, oben in ihrer Bahn). Liefert je ALTER Kennung die gespeicherte Lage (x relativ zum Rahmen der Phase, y relativ zur Bahn).
 */
export function einfuegeLagen(kopien: readonly K[], l: Pick<WerkstattLage, 'knoten' | 'rahmen' | 'bahnen'>, punkt: Pt, phaseId: string): Map<string, KnotenLage> {
  const r = l.rahmen.find(x => x.id === phaseId);
  const raus = new Map<string, KnotenLage>();
  if (!r || !kopien.length) return raus;
  const mass = kopien.map(k => knotenMass(k));
  const orig = kopien.map(k => l.knoten.get(k.id) ?? null);
  const x0 = Math.min(...orig.map(o => o?.x ?? Infinity)), y0 = Math.min(...orig.map(o => o?.y ?? Infinity));
  const rel: Pt[] = orig.every(Boolean) ? orig.map(o => [o!.x - x0, o!.y - y0]) : kopien.map((_, i) => [i * (WS.knotenB + WS.spaltenLuecke), 0]);
  // Der Punkt ist die Mitte des ersten Körpers.
  const p0: Pt = [punkt[0] - rel[0][0] - mass[0].b / 2, punkt[1] - rel[0][1] - mass[0].koerper.y - mass[0].koerper.h / 2];
  // Je Kopie die Lage in Welt-Koordinaten: x am Punkt, y am Punkt — liegt der außerhalb ihrer Bahn, oben in ihrer Bahn.
  const bahnen = kopien.map(k => l.bahnen.find(x => x.schluessel === bahnSchluessel(k)) ?? null);
  const basis: Pt[] = kopien.map((_, j) => {
    const ax = p0[0] + rel[j][0], ay = p0[1] + rel[j][1], b = bahnen[j];
    return [ax, b && (ay < b.y || ay > b.y + b.h) ? b.y + WS.bahnRand : ay];
  });
  const belegt = [...l.knoten.values()].filter(k => !k.zu).map(k => ({ x: k.x, y: k.y, b: k.b, h: k.h }));
  const schneidet = (a: Box, b: Box) => a.x < b.x + b.b && a.x + a.b > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const reihe = WS.quadrat + WS.beschriftung + WS.reihenLuecke;
  let dy = 0;
  for (let i = 0; i < 12; i++) {
    if (!kopien.some((_, j) => belegt.some(b => schneidet({ x: basis[j][0], y: basis[j][1] + dy, b: mass[j].b, h: mass[j].h }, b)))) break;
    dy += reihe;
  }
  kopien.forEach((k, j) => {
    const by = bahnen[j]?.y ?? WS.rahmenKopf;
    raus.set(k.id, { x: Math.max(Math.round(WS.rahmenRand / 2), Math.round(basis[j][0] - r.x)), y: Math.max(0, Math.round(basis[j][1] + dy - by)) });
  });
  return raus;
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
 * Bau-Test 2 (24.10., Runde 3: „nach dem Neuladen liegen die jüngsten Schritte unter dem Einstellungs-Panel, ihr „+“ ist verdeckt“): gerechnet wird im freien Feld
 * OHNE Panel und Werkzeugleiste (`raender`, gemessen erst, wenn das Panel steht); passt der INHALT (`inhalt`, wie bei „Alles zeigen“) dort mindestens so groß wie die
 * Übersicht von „Alles zeigen“ (`WERKSTATT_UEBERSICHT_MIN`), steht er ganz da — eingepasst wie mit „Alles zeigen“ (dieselbe Rechnung). Erst darunter lesbar am Anfang.
 */
export function startKamera(box: Box, buehne: { b: number; h: number }, rand = 32, raender?: Raender, inhalt?: Box): { s: number; x: number; y: number } {
  // Feinschliff 1 (23.10.): im freien Feld neben den schwebenden Leisten (lib/einpassen.ts) — ohne Ränder wie bisher.
  const f = freiesFeld(buehne, raender);
  const s = Math.min(1, (f.b - 2 * rand) / Math.max(1, box.b), (f.h - 2 * rand) / Math.max(1, box.h));
  if (s >= WERKSTATT_LESBAR) return { s, x: Math.round(f.x + (f.b - box.b * s) / 2 - box.x * s), y: Math.round(f.y + (f.h - box.h * s) / 2 - box.y * s) };
  if (inhalt) {
    const k = einpassKamera(inhalt, buehne, rand, WERKSTATT_EINPASS_MAX, raender);
    if (k.s >= WERKSTATT_UEBERSICHT_MIN) return k;
  }
  const l = WERKSTATT_LESBAR;
  return { s: l, x: Math.round(f.x + rand - box.x * l), y: Math.round(f.y + rand - box.y * l) };
}

// ── Feinschliff 22.10. (Sichtprüfung, research/prozesse/FEINSCHLIFF_WERKSTATT.md) ────────────────────────────────────────────────────────────────

/** Höchster Zoom beim Einpassen („Alles zeigen“, Befund 4) — ein kleiner Prozess wird nie größer als 100 % gezeigt, aber auch nicht unnötig klein. */
export const WERKSTATT_EINPASS_MAX = 1;
/** Der Inhalt der Fläche: alle Knoten (mit Beschriftung) und Zettel — ohne die leeren Ränder der Bahnen und Rahmen. Ohne Knoten die ganze Box. */
/** Platz unter dem Kopf einer leeren Phase für „+ erster Schritt“ (Fläche und „Alles zeigen“). */
export const LEERE_PHASE_PLATZ = 120;
export function inhaltBox(l: Pick<WerkstattLage, 'knoten' | 'box'> & Partial<Pick<WerkstattLage, 'rahmen'>>, zettel: readonly { pos: { x: number; y: number; b?: number; h?: number } }[] = [], rand = 40): Box {
  // Kern-Bau-Test 24.10. („Alles zeigen“ schnitt leere Phasen ab): eine Phase ohne Schritt zählt mit ihrem Kopf und dem Platz für „+ erster Schritt“ (nicht mit der
  // ganzen Höhe der Bahnen — leere Bahnränder bleiben draußen, Befund 4).
  const belegt = new Set([...l.knoten.values()].map(k => k.phaseId));
  const leer = (l.rahmen ?? []).filter(r => !belegt.has(r.id)).map(r => ({ x: r.x, y: r.y, b: r.b, h: Math.min(r.h, WS.rahmenKopf + LEERE_PHASE_PLATZ) }));
  const teile: Box[] = [...l.knoten.values(), ...leer, ...zettel.map(z => ({ x: z.pos.x, y: z.pos.y, b: z.pos.b ?? WS.zettel.b, h: z.pos.h ?? WS.zettel.h }))];
  if (!teile.length) return l.box;
  const x0 = Math.min(...teile.map(t => t.x)) - rand, y0 = Math.min(...teile.map(t => t.y)) - rand;
  const x1 = Math.max(...teile.map(t => t.x + t.b)) + rand, y1 = Math.max(...teile.map(t => t.y + t.h)) + rand;
  return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
}
/**
 * „Alles zeigen“ (rein, Befund 4): auf den Inhalt einpassen (nicht auf die leeren Bahnränder), höchstens `WERKSTATT_EINPASS_MAX`, mittig — seit Feinschliff 1
 * (23.10.) im freien Feld neben Seitenfeld und schwebenden Leisten (`raender`, EINE Rechnung mit der Landkarte: lib/einpassen.ts `einpassen`).
 */
export function einpassKamera(box: Box, buehne: { b: number; h: number }, rand = 32, max = WERKSTATT_EINPASS_MAX, raender?: Raender): { s: number; x: number; y: number } {
  return einpassen(box, buehne, { raender, rand, min: 0.15, max });
}
/**
 * Die Kamera so wenig wie möglich verschieben, dass eine Box ganz zu sehen ist (rein, Befund 2: „neu angehängter Knoten liegt außerhalb des Bildes“). Der Zoom
 * bleibt; schon sichtbar → dieselbe Kamera (gleiches Objekt); größer als das Bild → mittig.
 */
export function kameraZu(k: { s: number; x: number; y: number }, box: Box, buehne: { b: number; h: number }, rand = 48, raender?: Raender): { s: number; x: number; y: number } {
  // Feinschliff 1 (23.10.): „ganz zu sehen“ heißt im freien Feld — nicht unter dem Seitenfeld bzw. einer schwebenden Leiste.
  const f = freiesFeld(buehne, raender);
  const lx = box.x * k.s + k.x - f.x, ly = box.y * k.s + k.y - f.y, rx = lx + box.b * k.s, ry = ly + box.h * k.s;
  let dx = 0, dy = 0;
  if (box.b * k.s + 2 * rand > f.b) dx = f.b / 2 - (lx + rx) / 2;
  else if (lx < rand) dx = rand - lx;
  else if (rx > f.b - rand) dx = f.b - rand - rx;
  if (box.h * k.s + 2 * rand > f.h) dy = f.h / 2 - (ly + ry) / 2;
  else if (ly < rand) dy = rand - ly;
  else if (ry > f.h - rand) dy = f.h - rand - ry;
  return dx || dy ? { s: k.s, x: Math.round(k.x + dx), y: Math.round(k.y + dy) } : k;
}
/** Wo „+“ und Name eines Ausgangs stehen (relativ zur Knoten-Box): `anker` des Namens, `name` = Name zeigen, `knick` = der Hilfsstrich zum „+“ biegt dort ab. */
export interface AusgangMarke { plus: Pt; r: number; text: Pt; anker: 'start' | 'end'; name: boolean; knick?: Pt }
/**
 * Wo „+“ und Name eines Ausgangs stehen (rein, Befund 3: „Beschriftungen überlappen die +-Knöpfe“): rechts steht das „+“ dicht am Anschluss, der Name RECHTS
 * daneben auf Höhe des Anschlusses (nie darüber) — bei drei Ausgängen übereinander (Freigabe: freigegeben · abgelehnt · abgelaufen) ist das „+“ kleiner, damit
 * die Kreise sich nicht berühren. Oben (Raute: Fehler) das „+“ in Fadenrichtung, der Name daneben.
 * Feinschliff 1 (23.10., Sichtprüfung 22.10.):
 *   · Hängt am Ausgang schon ein Faden mit Beschriftung (`chip`), nennt diese ihn — kein zweiter Name („nein“ stand doppelt) —, und das „+“ rückt nach außen,
 *     bis es keine Beschriftung des Knotens (`chips`) mehr berührt („ja“ lag halb unter dem „+“).
 *   · Unten (Raute: nein) steht das „+“ rechts neben dem Körper auf Höhe des Stummels (der Hilfsstrich knickt dort ab wie der Faden), der Name links vom Stummel —
 *     zwischen Körper und Name der Raute liegt nichts Klickbares mehr, ein Klick dort wählt den Knoten (`knotenTreffer`).
 */
export function ausgangMarke(a: Pick<Anschluss, 'x' | 'y' | 'richtung'>, o: { rechtsAnzahl: number; mitPlus: boolean; chip?: Box | null; chips?: readonly Box[] }): AusgangMarke {
  const A = WS.ausgang;
  const name = !o.chip;
  const chips = o.chips ?? (o.chip ? [o.chip] : []);
  // Das „+“ so weit nach außen, bis sein Kreis (mit Luft) keine Beschriftung mehr berührt — rechts und unten waagerecht, oben senkrecht.
  const weg = (p: Pt, r: number, richtung: 'x' | 'y-'): Pt => {
    let q: Pt = p;
    for (let i = 0; i <= chips.length; i++) {
      const kreis = { x: q[0] - r - A.luft, y: q[1] - r - A.luft, b: 2 * (r + A.luft), h: 2 * (r + A.luft) };
      const im = chips.filter(c => ueberlappt(kreis, c));
      if (!im.length) return q;
      q = richtung === 'x' ? [Math.max(...im.map(c => c.x + c.b)) + A.luft + r, q[1]] : [q[0], Math.min(...im.map(c => c.y)) - A.luft - r];
    }
    return q;
  };
  if (a.richtung === 'unten') {
    const knick: Pt = [a.x, a.y + WS.stummel];
    const plus = weg([a.x + WS.raute / 2 + A.luft + A.r, knick[1]], A.r, 'x');
    return { plus, r: A.r, text: [a.x - A.name, a.y + 16], anker: 'end', name, knick };
  }
  if (a.richtung === 'oben') return { plus: weg([a.x, a.y - A.senkrecht], A.r, 'y-'), r: A.r, text: [a.x + A.name, a.y - 8], anker: 'start', name };
  const r = o.rechtsAnzahl >= 3 ? A.rKlein : A.r;
  const plus = weg([a.x + A.abstand + r, a.y], r, 'x');
  return { plus, r, text: [o.mitPlus ? plus[0] + r + A.luft : a.x + A.name, a.y + 4], anker: 'start', name };
}
/**
 * Wo ein Klick den Knoten meint (rein, Feinschliff 1, 23.10.: „Klick auf die Mitte einer Raute samt Beschriftung trifft ein ‚+‘“): der Körper bis hinunter zum
 * Namen (bei der Raute die Spalte zwischen Körper und Name) und die Fläche von Name und Unterzeile — relativ zur Knoten-Box. Die Fläche zeichnet genau diese
 * Trefferflächen; die „+“ der Ausgänge (`ausgangMarke`) ragen nie hinein.
 */
export function knotenTreffer(l: Pick<KnotenLageW, 'b' | 'gestalt' | 'koerper'>): Box[] {
  const c = l.koerper;
  const t = titelBox({ x: 0, y: 0, b: l.b, gestalt: l.gestalt, koerper: c });
  if (!t) return [{ x: c.x, y: c.y, b: c.b, h: c.h }];
  return [{ x: c.x, y: c.y, b: c.b, h: Math.max(c.h, t.y - c.y) }, t];
}
/**
 * Die Beschriftungen der Fäden je Knoten und Ausgang (rein, Feinschliff 1) — relativ zur Knoten-Box, damit `ausgangMarke` ihnen ausweicht. Welcher Ausgang es
 * ist, sagt der Anfang des Fadens (ein „ja“ an einer Form ohne „ja“ geht vom Hauptausgang ab). Rückschleifen tragen ihre Beschriftung unten am Bogen — sie zählen nicht.
 */
export function ausgangChips(l: Pick<WerkstattLage, 'knoten' | 'kanten'>): Map<string, { art: Anschluss['art']; box: Box }[]> {
  const raus = new Map<string, { art: Anschluss['art']; box: Box }[]>();
  for (const k of l.kanten) {
    if (k.zurueck) continue;
    const c = chipBox(k), lk = l.knoten.get(k.von), p0 = k.punkte[0];
    if (!c || !lk || !p0) continue;
    const a = lk.anschluesse.find(x => x.art !== 'ein' && Math.abs(lk.x + x.x - p0[0]) < 0.5 && Math.abs(lk.y + x.y - p0[1]) < 0.5);
    if (!a) continue;
    raus.set(lk.id, [...(raus.get(lk.id) ?? []), { art: a.art, box: { x: c.x - lk.x, y: c.y - lk.y, b: c.b, h: c.h } }]);
  }
  return raus;
}
/**
 * Die Bahn eines neu angehängten Knotens (rein, Befund 5: „Zickzack Mensch/System/Mensch“): was nach außen geht (Mail-/WhatsApp-Entwurf, Einladung, Angebot
 * stellen — Rechte-Klasse „außen“) bereitet ein Mensch vor und gibt es frei; es folgt deshalb der Menschen-Bahn des Vorgängers statt in „System · Regeln“ zu
 * springen. Sonst null (die Bahn des Bausteins gilt).
 */
export function bahnBeimAnhaengen(neu: Pick<K, 'bahn' | 'katalog' | 'form'>, vor: Pick<K, 'bahn' | 'katalog' | 'form'> | undefined): BahnSchluessel | null {
  if (!vor || neu.bahn || neu.form === 'agent') return null;
  const vb = bahnSchluessel(vor);
  if (vb !== 'mensch' && !vb.startsWith('person:')) return null;
  const e = katalogEintrag(neu.katalog?.id);
  if (!(e?.rechte === 'aussen' || neu.form === 'freigabe')) return null;
  // Eine Personen-Bahn braucht das Feld „wer“ in der Maske (sonst kennt der Knoten seine Person nicht) — dann die Bahn „Menschen“ direkt daneben.
  return vb.startsWith('person:') && !e?.maske.some(f => f.id === 'wer') ? 'mensch' : vb;
}

// ── Feinschliff 22.10. (Sichtprüfung der Vorlagen): Beschriftungen, Zettel, Übersicht ──────────────────────────────────────────────────────────

/**
 * Die Mitte eines Fadens (rein, Werkstatt bau-fertig Punkt 3): der Punkt auf halber Länge des Wegs — dort steht das „+“ zum Dazwischen-Einfügen. Liegt dort die
 * Beschriftung (Chip), rückt das „+“ ein Stück weiter (auf 62 % der Länge).
 */
export function kantenMitte(punkte: readonly Pt[], anteil = 0.5): Pt {
  if (!punkte.length) return [0, 0];
  const laengen: number[] = [];
  let gesamt = 0;
  for (let i = 1; i < punkte.length; i++) { const d = Math.hypot(punkte[i][0] - punkte[i - 1][0], punkte[i][1] - punkte[i - 1][1]); laengen.push(d); gesamt += d; }
  let rest = gesamt * anteil;
  for (let i = 1; i < punkte.length; i++) {
    const d = laengen[i - 1];
    if (rest <= d && d > 0) { const t = rest / d; return [Math.round((punkte[i - 1][0] + (punkte[i][0] - punkte[i - 1][0]) * t) * 10) / 10, Math.round((punkte[i - 1][1] + (punkte[i][1] - punkte[i - 1][1]) * t) * 10) / 10]; }
    rest -= d;
  }
  return punkte[punkte.length - 1];
}
/** Wo das „+“ eines Fadens steht (rein): in der Mitte, außer dort liegt seine Beschriftung — dann weiter hinten. */
export function kantenPlus(k: Pick<KanteLage, 'punkte' | 'text' | 'textOrt' | 'zurueck'>): Pt {
  const m = kantenMitte(k.punkte);
  const c = chipBox(k);
  return c && ueberlappt({ x: m[0] - 14, y: m[1] - 14, b: 28, h: 28 }, c) ? kantenMitte(k.punkte, 0.7) : m;
}

/** Breite der Beschriftung eines Fadens (Chip) — grob nach Zeichen wie `textZeilen` (≈ 0,56 · Schriftgröße je Zeichen). Die Fläche zeichnet genau diese Breite. */
export const chipBreite = (text: string): number => Math.max(28, text.length * WS.chip.schrift * 0.56 + 14);
/** Die Fläche der Beschriftung eines Fadens in Welt-Koordinaten (rein) — null ohne Text. Rückschleifen tragen sie mittig, sonst beginnt sie am Ort. */
export function chipBox(k: Pick<KanteLage, 'text' | 'textOrt' | 'zurueck'>): Box | null {
  if (!k.text || !k.textOrt) return null;
  const b = chipBreite(k.text);
  return { x: k.zurueck ? k.textOrt[0] - b / 2 : k.textOrt[0], y: k.textOrt[1] - WS.chip.hoehe / 2, b, h: WS.chip.hoehe };
}
/** Überlappen sich zwei Flächen (rein; Berühren zählt nicht)? */
export const ueberlappt = (a: Box, b: Box): boolean => a.x < b.x + b.b && b.x < a.x + a.b && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Befund 3 (Sichtprüfung 22.10.: „der Zettel liegt über dem Phasen-Kopf“): wo ein Zettel ohne eigene Lage hingehört — ÜBER den Rahmen, links bündig mit dem
 * ersten Rahmen, mehrere nebeneinander (`i` = Platz in der Reihe). Dort liegt nie ein Phasen-Kopf, eine Bahn-Beschriftung oder ein Knoten.
 */
export function zettelObenPlatz(i = 0, mass: { h?: number } = {}): { x: number; y: number } {
  return { x: WS.bahnKopf + i * (WS.zettel.b + WS.zettelAbstand), y: -((mass.h ?? WS.zettel.h) + WS.zettelAbstand) };
}
/** Die Fläche eines Zettels (Welt-Koordinaten). */
export const zettelBox = (z: { pos: { x: number; y: number; b?: number; h?: number } }): Box => ({ x: z.pos.x, y: z.pos.y, b: z.pos.b ?? WS.zettel.b, h: z.pos.h ?? WS.zettel.h });
/** Was ein Zettel verdeckt (rein): Phasen-Köpfe, Bahn-Beschriftungen und Knoten (mit Namen) — leer = er liegt frei. */
export function zettelVerdeckt(l: Pick<WerkstattLage, 'knoten' | 'rahmen' | 'bahnen'>, z: { pos: { x: number; y: number; b?: number; h?: number } }): string[] {
  const zb = zettelBox(z);
  const raus: string[] = [];
  for (const r of l.rahmen) if (ueberlappt(zb, { x: r.x, y: r.y, b: r.b, h: WS.rahmenKopf })) raus.push(`phase:${r.id}`);
  for (const b of l.bahnen) if (ueberlappt(zb, { x: 0, y: b.y, b: WS.bahnKopf, h: Math.min(b.h, 56) })) raus.push(`bahn:${b.schluessel}`);
  for (const k of l.knoten.values()) if (ueberlappt(zb, k)) raus.push(`knoten:${k.id}`);
  return raus;
}
/**
 * Zettel, die etwas verdecken, über die Rahmen legen (rein; „Ordnen“ ruft es mit — so lässt sich auch ein schon übernommener Prozess mit einem Klick richten).
 * Freie Zettel bleiben, wo sie sind; die verschobenen bekommen den ersten freien Platz der Reihe über den Rahmen. Nichts zu tun → dieselbe Definition.
 */
export function zettelFreiLegen<D extends Pick<ProzessDefinition, 'knoten' | 'zettel'>>(d: D, o: { team?: readonly TeamName[]; zu?: ReadonlySet<string> } = {}): D {
  const zs = d.zettel ?? [];
  if (!zs.length) return d;
  const l = werkstattLage({ knoten: d.knoten }, o);
  const bleiben = zs.filter(z => !zettelVerdeckt(l, z).length);
  if (bleiben.length === zs.length) return d;
  const belegt: Box[] = bleiben.map(zettelBox);
  const neu = zs.map(z => {
    if (bleiben.includes(z)) return z;
    for (let i = 0; i < 1000; i++) {
      const p = zettelObenPlatz(i, z.pos);
      const box = { ...p, b: z.pos.b ?? WS.zettel.b, h: z.pos.h ?? WS.zettel.h };
      if (belegt.some(b => ueberlappt(b, box))) continue;
      belegt.push(box);
      return { ...z, pos: { ...z.pos, x: p.x, y: p.y } };
    }
    return z;
  });
  return { ...d, zettel: neu };
}

/** Der Zoom, mit dem „Alles zeigen“ diese Lage einpasst (rein) — im freien Feld neben den schwebenden Leisten (`raender`). */
export const einpassZoom = (l: Pick<WerkstattLage, 'knoten' | 'box'>, zettel: readonly { pos: { x: number; y: number; b?: number; h?: number } }[], buehne: { b: number; h: number }, raender?: Raender): number =>
  einpassKamera(inhaltBox(l, zettel), buehne, 32, WERKSTATT_EINPASS_MAX, raender).s;
/**
 * Mindestmaßstab für „Alles zeigen“ (Feinschliff 1, 23.10.): darunter wären die Namen (15 px) kleiner als 7,5 px — dann stehen Phasen als Kacheln da. Bewusst
 * kleiner als beim Öffnen (`WERKSTATT_LESBAR`) und als die Stufe „fern“ der Landkarte: die Übersicht soll den ganzen Prozess zeigen, solange er erkennbar bleibt
 * (Sichtprüfung 22.10.: „klappt alle Phasen zu“).
 */
export const WERKSTATT_UEBERSICHT_MIN = 0.5;
/**
 * Welche Phasen „Alles zeigen“ zuklappt (rein; Befund 6 vom 22.10. „Alles zeigen wird unlesbar“, Feinschliff 1 vom 23.10. „klappt alle Phasen zu“):
 *   · passt der ganze Prozess lesbar ins freie Feld (`lesbar`, Vorgabe: mindestens `WERKSTATT_UEBERSICHT_MIN`), klappt nichts zu;
 *   · sonst nur so viele Phasen wie nötig, die breitesten zuerst — die Phase der Auswahl (`behalten`) bleibt offen; reicht auch das nicht, stehen alle (übrigen)
 *     als Kacheln da. Bei weniger als zwei offenen Phasen gibt es nichts zuzuklappen. Ein Klick auf eine Kachel klappt sie wieder auf.
 * Zurück kommt die Menge der zuzuklappenden Phasen (leer = alles offen einpassen).
 */
export function kachelnFuerAlles(
  d: Pick<ProzessDefinition, 'knoten' | 'zettel'>, buehne: { b: number; h: number },
  o: { lesbar?: (s: number) => boolean; raender?: Raender; team?: readonly TeamName[]; zu?: ReadonlySet<string>; behalten?: string | null } = {},
): Set<string> {
  const basis = new Set(o.zu ?? []);
  const lesbar = o.lesbar ?? ((s: number) => s >= WERKSTATT_UEBERSICHT_MIN);
  const passt = (zu: ReadonlySet<string>) => lesbar(einpassZoom(werkstattLage(d, { team: o.team, zu }), d.zettel ?? [], buehne, o.raender));
  const offen = phasen(d).filter(p => !basis.has(p.id));
  if (offen.length < 2 || passt(basis)) return new Set();
  const breite = new Map(werkstattLage(d, { team: o.team, zu: basis }).rahmen.map(r => [r.id, r.b]));
  const reihe = offen.filter(p => p.id !== o.behalten).sort((a, b) => (breite.get(b.id) ?? 0) - (breite.get(a.id) ?? 0) || a.id.localeCompare(b.id));
  const zu = new Set<string>();
  for (const p of reihe) {
    zu.add(p.id);
    if (passt(new Set([...basis, ...zu]))) break;
  }
  return zu;
}
