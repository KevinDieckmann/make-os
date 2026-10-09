// ─── Sport · Training: alle Einheiten aller Quellen an EINER Stelle (rein, getestet, 09.10.2026) ──────────────────────────
// Kevin 09.10.: „Malins Daten sind glaube ich nicht richtig durchgegangen. Die Trainingsdaten fehlen ihr.“ Befund: WHOOP-Workouts ohne
// Distanz landen in `SportStand.training[]` — und keine Ansicht las diese Liste (Plan/Ist, „Für dich“, Sport-Kachel zählten nur Läufe,
// Gym und Hyrox). Ab jetzt liest JEDE Ansicht, die Einheiten zählt oder zeigt, über `alleEinheiten` — nie mehr die Listen einzeln.
//
// Drei Regeln stehen hier und nur hier:
//   1. Zuordnung Sportart → Sparte: EINE Tabelle (`SPORT_ZUORDNUNG`), dann die eigene Zuordnung der Person (`SportStand.sportArten`), dann
//      „zählt als“ an der einzelnen Einheit (`TrainingEinheit.art`). Unbekannt = „Sonstiges“ (zählt). Erholung und Alltag zählen nicht.
//   2. Nichts doppelt: eine importierte Einheit am selben Tag in derselben Sparte wie ein Eintrag von Hand ist DIESELBE (1:1, mit Distanz
//      ±10 %) — der Eintrag von Hand führt, die Messwerte des Imports (Strain, kcal, Puls, Zonen) kommen dazu. Zwei Importe derselben
//      Einheit (z. B. WHOOP und später Strava) sind dieselbe, wenn Tag und Sparte gleich sind, die Startzeiten ≤ 20 min auseinander liegen
//      und die Dauer ±10 % passt (vorbereitet, heute gibt es nur WHOOP).
//   3. Gezählt wird je Sparte; „Einheiten“ = alle zählenden.
//
// Sportarten von WHOOP: offizielle Liste https://developer.whoop.com/docs/developing/user-data/workout (abgerufen 09.10.2026). Der Name
// kommt in der API als `sport_name` („Name of the WHOOP Sport performed during the workout“); Schreibweise (groß/klein, Leerzeichen) ist
// nicht dokumentiert — `sportSchluessel` macht daraus einen festen Schlüssel. Eine eigene Sportart „Hyrox“ führt WHOOP nicht; Hyrox-Training
// steht dort meist als „Functional Fitness“, „HIIT“ oder „Obstacle Course Racing“ (Annahme) — darum die Sparte „Hyrox & Functional“.
// Struktur und Erfassung, keine Trainingsberatung.

import type { GymEinheit, HyroxEinheit, Klasse, Lauf, Quelle, Sparte, SportStand, TrainingEinheit } from './modell';
import { KLASSE_LABEL, SPARTEN, zaehltAlsTraining } from './modell';
import { montagVon, tagPlus } from './pace';

// ── 1. Zuordnung ─────────────────────────────────────────────────────────────

/** Fester Schlüssel einer Sportart: klein, Umlaute vereinfacht, alles außer a–z/0–9 wird ein Bindestrich („Hiking/Rucking“ → „hiking-rucking“). */
export function sportSchluessel(name: string): string {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
}

/**
 * Sportart → Sparte (Vorgabe für jede Instanz). Nur, was NICHT „Sonstiges“ ist, steht hier; alles andere (Ballsport, Kampfsport, Tanz,
 * „Activity“, „Other“ …) zählt als Sonstiges. Die Person stellt eine Sportart unter Sport › Training › „Sportarten zuordnen“ um.
 */
export const SPORT_ZUORDNUNG: Readonly<Record<string, Klasse>> = {
  // Laufen
  'running': 'lauf', 'track-field': 'lauf', 'stroller-jogging': 'lauf',
  // Gym & Kraft
  'weightlifting': 'gym', 'powerlifting': 'gym', 'strength-trainer': 'gym',
  // Hyrox & Functional
  'functional-fitness': 'hyrox', 'hiit': 'hyrox', 'obstacle-course-racing': 'hyrox', 'f45-training': 'hyrox', 'barry-s': 'hyrox', 'box-fitness': 'hyrox',
  // Rad
  'cycling': 'rad', 'mountain-biking': 'rad', 'spin': 'rad', 'assault-bike': 'rad',
  // Ausdauer
  'rowing': 'ausdauer', 'swimming': 'ausdauer', 'elliptical': 'ausdauer', 'stairmaster': 'ausdauer', 'cross-country-skiing': 'ausdauer',
  'hiking-rucking': 'ausdauer', 'jumping-rope': 'ausdauer', 'stadium-steps': 'ausdauer', 'triathlon': 'ausdauer', 'duathlon': 'ausdauer',
  'kayaking': 'ausdauer', 'paddleboarding': 'ausdauer', 'climber': 'ausdauer', 'inline-skating': 'ausdauer', 'wheelchair-pushing': 'ausdauer',
  // Mobility & Yoga
  'yoga': 'mobility', 'hot-yoga': 'mobility', 'pilates': 'mobility', 'stretching': 'mobility', 'barre': 'mobility', 'barre3': 'mobility',
  // Erholung (zählt nicht als Training)
  'sauna': 'erholung', 'ice-bath': 'erholung', 'massage-therapy': 'erholung', 'air-compression': 'erholung', 'percussive-massage': 'erholung', 'meditation': 'erholung',
  // Alltag (zählt nicht als Training)
  'walking': 'alltag', 'dog-walking': 'alltag', 'stroller-walking': 'alltag', 'commuting': 'alltag', 'manual-labor': 'alltag', 'yard-work': 'alltag',
  'cooking': 'alltag', 'cleaning': 'alltag', 'dedicated-parenting': 'alltag', 'babywearing': 'alltag', 'toddlerwearing': 'alltag', 'gaming': 'alltag',
  'watching-sports': 'alltag', 'high-stress-work': 'alltag', 'public-speaking': 'alltag', 'stage-performance': 'alltag', 'musical-performance': 'alltag',
  'caddying': 'alltag', 'coaching': 'alltag', 'operations-tactical': 'alltag', 'operations-medical': 'alltag', 'operations-flying': 'alltag', 'operations-water': 'alltag',
};

/** Deutsche Namen der häufigen Sportarten — sonst wird der Schlüssel lesbar gemacht („rock-climbing“ → „Rock Climbing“). */
const SPORT_NAME: Readonly<Record<string, string>> = {
  'running': 'Laufen', 'track-field': 'Leichtathletik', 'stroller-jogging': 'Laufen mit Kinderwagen', 'weightlifting': 'Gewichtheben',
  'powerlifting': 'Powerlifting', 'strength-trainer': 'Krafttraining', 'functional-fitness': 'Functional Fitness', 'hiit': 'HIIT',
  'obstacle-course-racing': 'Hindernislauf', 'cycling': 'Radfahren', 'mountain-biking': 'Mountainbike', 'spin': 'Spinning', 'assault-bike': 'Assault Bike',
  'rowing': 'Rudern', 'swimming': 'Schwimmen', 'elliptical': 'Crosstrainer', 'stairmaster': 'Stepper', 'cross-country-skiing': 'Langlauf',
  'hiking-rucking': 'Wandern', 'jumping-rope': 'Seilspringen', 'stadium-steps': 'Treppenläufe', 'yoga': 'Yoga', 'hot-yoga': 'Hot Yoga', 'pilates': 'Pilates',
  'stretching': 'Dehnen', 'sauna': 'Sauna', 'ice-bath': 'Eisbad', 'massage-therapy': 'Massage', 'meditation': 'Meditation', 'walking': 'Gehen',
  'dog-walking': 'Gassi gehen', 'activity': 'Aktivität', 'other': 'Sonstiges', 'training': 'Training', 'f45-training': 'F45 Training',
  'barry-s': 'Barry’s', 'box-fitness': 'Box Fitness', 'jiu-jitsu': 'Jiu Jitsu', 'air-compression': 'Kompression', 'percussive-massage': 'Massagepistole',
};

/** Name einer Sportart für die Anzeige. */
export function sportName(sport: string): string {
  const k = sportSchluessel(sport);
  if (SPORT_NAME[k]) return SPORT_NAME[k];
  if (!k) return 'Training';
  return k.split('-').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/** Sparte einer Sportart: eigene Zuordnung der Person vor der Tabelle; unbekannt = Sonstiges. */
export function klasseVonSport(sport: string, eigene?: Readonly<Record<string, Klasse>>): Klasse {
  const k = sportSchluessel(sport);
  return eigene?.[k] ?? SPORT_ZUORDNUNG[k] ?? 'sonstiges';
}

/** Sparte einer Trainingseinheit: „zählt als“ an der Einheit vor der Sportart. */
export function klasseVonTraining(t: Pick<TrainingEinheit, 'sport' | 'art'>, eigene?: Readonly<Record<string, Klasse>>): Klasse {
  return t.art ?? klasseVonSport(t.sport, eigene);
}

// ── 2. Eine Liste aller Einheiten ────────────────────────────────────────────

export type Herkunft = 'lauf' | 'gym' | 'hyrox' | 'training';

/** Eine Einheit, wie die Ansichten sie zeigen — aus Läufen, Gym, Hyrox und Training zusammengeführt. */
export interface Einheit {
  /** Kennung des führenden Eintrags im Bestand. */
  id: string;
  herkunft: Herkunft;
  datum: string;
  uhrzeit?: string;
  klasse: Klasse;
  zaehlt: boolean;
  titel: string;
  /** Rohname der Sportart (nur Training) — für „Sportarten zuordnen“. */
  sport?: string;
  quelle: Quelle;
  /** Weitere Quellen, deren Eintrag in dieser Einheit aufging (z. B. WHOOP-Messwerte an einem Lauf von Hand). */
  auch?: Quelle[];
  /** Kennungen der aufgegangenen Einträge. */
  gleich?: string[];
  /** Wurde „zählt als“ von der Person gesetzt (an der Einheit oder je Sportart)? */
  eigeneZuordnung?: boolean;
  dauerMin?: number;
  distanzKm?: number;
  strain?: number;
  kcal?: number;
  pulsSchnitt?: number;
  pulsMax?: number;
  zonenMin?: number[];
  hoeheM?: number;
  gefuehl?: number;
  notiz?: string;
}

const HYROX_ART: Record<HyroxEinheit['art'], string> = { training: 'Training', simulation: 'Simulation', wettkampf: 'Wettkampf' };
const km = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
const MESS = ['strain', 'kcal', 'pulsSchnitt', 'pulsMax', 'zonenMin', 'hoeheM'] as const;
const mess = (x: Partial<Pick<Lauf, typeof MESS[number]>>) => Object.fromEntries(MESS.filter(k => x[k] !== undefined).map(k => [k, x[k]])) as Partial<Einheit>;

function ausLauf(l: Lauf): Einheit {
  return {
    id: l.id, herkunft: 'lauf', datum: l.datum, ...(l.uhrzeit ? { uhrzeit: l.uhrzeit } : {}), klasse: 'lauf', zaehlt: true, titel: `Lauf · ${km(l.distanzKm)} km`, quelle: l.quelle,
    dauerMin: Math.max(1, Math.round(l.dauerSek / 60)), distanzKm: l.distanzKm, ...mess(l),
    ...(l.gefuehl ? { gefuehl: l.gefuehl } : {}), ...(l.notiz ? { notiz: l.notiz } : {}),
  };
}
function ausGym(g: GymEinheit, vorlagen?: Readonly<Record<string, string>>): Einheit {
  const name = g.vorlage ? vorlagen?.[g.vorlage] : undefined;
  return {
    id: g.id, herkunft: 'gym', datum: g.datum, klasse: 'gym', zaehlt: true, titel: name ? `Gym · ${name}` : `Gym · ${g.uebungen.length} Übung${g.uebungen.length === 1 ? '' : 'en'}`,
    quelle: 'hand', ...(g.dauerMin ? { dauerMin: g.dauerMin } : {}), ...(g.notiz ? { notiz: g.notiz } : {}),
  };
}
function ausHyrox(h: HyroxEinheit): Einheit {
  const sek = h.gesamtSek;
  return {
    id: h.id, herkunft: 'hyrox', datum: h.datum, klasse: 'hyrox', zaehlt: true, titel: `Hyrox · ${HYROX_ART[h.art]}`, quelle: 'hand',
    ...(sek ? { dauerMin: Math.max(1, Math.round(sek / 60)) } : {}), ...(h.notiz ? { notiz: h.notiz } : {}),
  };
}
function ausTraining(t: TrainingEinheit, eigene?: Readonly<Record<string, Klasse>>): Einheit {
  const klasse = klasseVonTraining(t, eigene);
  return {
    id: t.id, herkunft: 'training', datum: t.datum, ...(t.uhrzeit ? { uhrzeit: t.uhrzeit } : {}), klasse, zaehlt: zaehltAlsTraining(klasse),
    titel: t.quelle === 'hand' ? (t.sport.trim() || KLASSE_LABEL[klasse]) : sportName(t.sport), sport: t.sport, quelle: t.quelle,
    ...(t.art || eigene?.[sportSchluessel(t.sport)] ? { eigeneZuordnung: true } : {}),
    dauerMin: t.dauerMin, ...(t.distanzKm ? { distanzKm: t.distanzKm } : {}), ...mess(t),
    ...(t.gefuehl ? { gefuehl: t.gefuehl } : {}), ...(t.notiz ? { notiz: t.notiz } : {}),
  };
}

const minuten = (uz?: string) => (uz ? Number(uz.slice(0, 2)) * 60 + Number(uz.slice(3, 5)) : undefined);
const nahe = (a?: number, b?: number, anteil = 0.1) => a === undefined || b === undefined || Math.abs(a - b) <= Math.max(a, b) * anteil;

/** Gehören zwei Einträge zu derselben Einheit? (Regel 2 im Kopf.) */
export function gleicheEinheit(hand: Einheit, imp: Einheit): boolean {
  if (hand.datum !== imp.datum || hand.klasse !== imp.klasse || !imp.zaehlt) return false;
  if (hand.distanzKm !== undefined && imp.distanzKm !== undefined && !nahe(hand.distanzKm, imp.distanzKm)) return false;
  if (hand.quelle !== 'hand') {
    // Zwei Importe: Startzeit und Dauer müssen passen (ohne Startzeit nie zusammenlegen — lieber doppelt als falsch verschmolzen).
    const a = minuten(hand.uhrzeit), b = minuten(imp.uhrzeit);
    if (a === undefined || b === undefined || Math.abs(a - b) > 20 || hand.quelle === imp.quelle) return false;
    return nahe(hand.dauerMin, imp.dauerMin);
  }
  return true;
}

function verschmelzen(fuehrt: Einheit, dazu: Einheit): Einheit {
  const r: Einheit = { ...fuehrt, auch: [...new Set([...(fuehrt.auch ?? []), dazu.quelle, ...(dazu.auch ?? [])])].filter(q => q !== fuehrt.quelle), gleich: [...(fuehrt.gleich ?? []), dazu.id] };
  // Messwerte des Imports füllen, was der führende Eintrag nicht hat — nie überschreiben.
  for (const k of ['uhrzeit', 'dauerMin', 'distanzKm', ...MESS] as const) if (r[k] === undefined && dazu[k] !== undefined) (r as unknown as Record<string, unknown>)[k] = dazu[k];
  if (!r.auch?.length) delete r.auch;
  return r;
}

/** Rangfolge der Importquellen, wenn zwei Importe dieselbe Einheit sind (die führende liefert Titel und Dauer). */
const QUELLE_RANG: Record<Quelle, number> = { hand: 0, whoop: 1, strava: 2, 'apple-health': 3 };

/**
 * Alle Einheiten der Person, neueste zuerst, ohne Doppelte. `vorlagen` = Name je Gym-Vorlage (für den Titel).
 * Erholung/Alltag stehen mit `zaehlt: false` in der Liste.
 */
export function alleEinheiten(stand: Pick<SportStand, 'laeufe' | 'gym' | 'hyrox' | 'training' | 'sportArten'>, vorlagen?: Readonly<Record<string, string>>): Einheit[] {
  const eigene = stand.sportArten;
  const roh: Einheit[] = [
    ...stand.laeufe.map(ausLauf),
    ...stand.gym.einheiten.map(g => ausGym(g, vorlagen)),
    ...stand.hyrox.map(ausHyrox),
    ...(stand.training ?? []).map(t => ausTraining(t, eigene)),
  ];
  const hand = roh.filter(e => e.quelle === 'hand');
  const importe = roh.filter(e => e.quelle !== 'hand').sort((a, b) => QUELLE_RANG[a.quelle] - QUELLE_RANG[b.quelle] || (a.uhrzeit ?? '').localeCompare(b.uhrzeit ?? '') || a.id.localeCompare(b.id));
  const ergebnis: Einheit[] = [...hand];
  const belegt = new Set<string>();
  for (const imp of importe) {
    // Zuerst ein Eintrag von Hand (am nächsten an der Dauer), dann ein schon übernommener anderer Import.
    const kandidaten = ergebnis.map((e, i) => ({ e, i })).filter(({ e }) => !belegt.has(e.id) && gleicheEinheit(e, imp))
      .sort((a, b) => (a.e.quelle === 'hand' ? 0 : 1) - (b.e.quelle === 'hand' ? 0 : 1) || Math.abs((a.e.dauerMin ?? 0) - (imp.dauerMin ?? 0)) - Math.abs((b.e.dauerMin ?? 0) - (imp.dauerMin ?? 0)));
    const k = kandidaten[0];
    if (k) { ergebnis[k.i] = verschmelzen(k.e, imp); belegt.add(k.e.id); continue; }
    ergebnis.push(imp);
  }
  return ergebnis.sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : (b.uhrzeit ?? '').localeCompare(a.uhrzeit ?? '') || a.id.localeCompare(b.id)));
}

/** Nur die Einheiten, die als Training zählen. */
export const zaehlende = (l: readonly Einheit[]): Einheit[] => l.filter(e => e.zaehlt);

// ── 3. Zählen ────────────────────────────────────────────────────────────────

export interface Summe {
  /** Zählende Einheiten. */
  einheiten: number;
  je: Record<Sparte, number>;
  minuten: number;
  /** Summe der Einheiten-Strains (WHOOP-Skala 0–21 je Einheit — eine Summe, keine Tages-Strain). Fehlt ohne einen Wert. */
  strain?: number;
  kcal?: number;
  /** Laufkilometer (nur Sparte Laufen). */
  km: number;
  /** Minuten je Herzfrequenz-Zone 0–5 über alle Einheiten mit Zonen (fehlt ohne). */
  zonenMin?: number[];
}

const leerJe = (): Record<Sparte, number> => Object.fromEntries(SPARTEN.map(s => [s, 0])) as Record<Sparte, number>;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Zählt die Einheiten (nur zählende). */
export function summe(einheiten: readonly Einheit[]): Summe {
  const z = zaehlende(einheiten);
  const je = leerJe();
  let min = 0, strain = 0, mitStrain = 0, kcal = 0, mitKcal = 0, kmS = 0;
  let zonen: number[] | undefined;
  for (const e of z) {
    je[e.klasse as Sparte] += 1;
    min += e.dauerMin ?? 0;
    if (e.strain !== undefined) { strain += e.strain; mitStrain++; }
    if (e.kcal !== undefined) { kcal += e.kcal; mitKcal++; }
    if (e.klasse === 'lauf' && e.distanzKm) kmS += e.distanzKm;
    if (e.zonenMin?.length === 6) zonen = (zonen ?? [0, 0, 0, 0, 0, 0]).map((v, i) => v + e.zonenMin![i]);
  }
  return {
    einheiten: z.length, je, minuten: Math.round(min), km: r1(kmS),
    ...(mitStrain ? { strain: r1(strain) } : {}), ...(mitKcal ? { kcal: Math.round(kcal) } : {}), ...(zonen ? { zonenMin: zonen.map(r1) } : {}),
  };
}

/** Die Einheiten einer Woche (Montag bis Sonntag). */
export const inWoche = (l: readonly Einheit[], montag: string): Einheit[] => { const ende = tagPlus(montag, 6); return l.filter(e => e.datum >= montag && e.datum <= ende); };

export interface WochenGruppe { montag: string; einheiten: Einheit[]; summe: Summe }

/** Liste je Woche, die laufende zuerst — für die Ansicht „Training“ (`wochen` Wochen zurück, leere Wochen fallen weg). */
export function wochenListe(l: readonly Einheit[], heute: string, wochen = 8): WochenGruppe[] {
  const start = montagVon(heute);
  const r: WochenGruppe[] = [];
  for (let i = 0; i < wochen; i++) {
    const montag = tagPlus(start, -7 * i);
    const e = inWoche(l, montag);
    if (e.length) r.push({ montag, einheiten: e, summe: summe(e) });
  }
  return r;
}

/** Die Sportarten aus Importen mit ihrer aktuellen Sparte — für „Sportarten zuordnen“ (häufigste zuerst). */
export function sportartenUebersicht(stand: Pick<SportStand, 'training' | 'sportArten'>): { schluessel: string; name: string; klasse: Klasse; vorgabe: Klasse; eigen: boolean; anzahl: number }[] {
  const n = new Map<string, number>();
  for (const t of stand.training ?? []) if (t.quelle !== 'hand') { const k = sportSchluessel(t.sport); if (k) n.set(k, (n.get(k) ?? 0) + 1); }
  for (const k of Object.keys(stand.sportArten ?? {})) if (!n.has(k)) n.set(k, 0);
  return [...n.entries()].map(([k, anzahl]) => {
    const vorgabe = SPORT_ZUORDNUNG[k] ?? 'sonstiges';
    const eigen = stand.sportArten?.[k];
    return { schluessel: k, name: sportName(k), klasse: eigen ?? vorgabe, vorgabe, eigen: !!eigen, anzahl };
  }).sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name, 'de'));
}
