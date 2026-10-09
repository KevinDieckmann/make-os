// ─── Sport · Plan-Baukasten: Wochen mit Einheiten, Vorlagen, Blöcke, Plan ↔ Ist (rein, getestet, 09.10.2026) ───────────────
// Kevin 09.10.: „Malin hat so viele Sachen da — das soll super auf sie zugeschnitten werden, dass sie sich Trainingspläne bauen kann.“
// Gebaut AUF dem Bestehenden (lib/sport/plan.ts: Wochenstruktur `woche`, Plan/Ist, Deload), nie daneben:
//   · `woche` bleibt die Standardwoche. Ein Tag trägt optional bis zu vier Einheiten (Sparte, Typ, Dauer, Intensität, Zone, Strain-Ziel).
//   · Vorlagen: drei neutrale Startvorlagen (erfunden, im Code, nie im Bestand) + eigene je Person (`planVorlagen`).
//   · Block: Woche für Woche eine Vorlage und eine Phase (Aufbau · Deload · Taper), optional auf ein Ziel (Wettkampf) hin. Deload kann fest im
//     Rhythmus stehen ODER „nach Tagesform“ kommen (Regel lib/sport/entlastung.ts → die Person nimmt die Entlastung für eine Woche an).
//   · Plan ↔ Ist: die tatsächlichen Einheiten (lib/sport/training.ts `alleEinheiten`, alle Quellen) werden den geplanten zugeordnet — gleicher
//     Tag zuerst, dann ±1 Tag in derselben Woche; gleiche Sparte zuerst, dann eine erlaubte Ersatz-Sparte (`ERSATZ`).
// Umfang von Deload/Taper (Vorgabe 60 %) ist ein Vorschlag und je Person einstellbar. Struktur und Erfassung, keine Trainingsberatung.

import type { BlockPhase, Intensitaet, PlanBlock, PlanEinheit, PlanTag, PlanVorlage, Sparte, SportStand, Woche, Wochentag, Ziel } from './modell';
import { EINHEIT_TYPEN, WOCHENTAGE, leereWoche } from './modell';
import { montagVon, tagPlus, tageZwischen } from './pace';
import { alleEinheiten, inWoche, summe, type Einheit } from './training';

// ── Einheiten eines Tages ────────────────────────────────────────────────────

/** Die Intensität einer Einheit: angegeben, sonst die Vorgabe ihres Typs, sonst „mittel“ (Gym/Hyrox) bzw. „leicht“. */
export function intensitaetVon(e: Pick<PlanEinheit, 'intensitaet' | 'typ' | 'sparte'>): Intensitaet {
  if (e.intensitaet) return e.intensitaet;
  const t = e.typ ? EINHEIT_TYPEN.find(x => x.id === e.typ) : undefined;
  if (t) return t.intensitaet;
  return e.sparte === 'mobility' ? 'leicht' : 'mittel';
}

/** Die Einheiten eines Plan-Tags: die eingetragenen, sonst EINE aus der Art des Tages (ältere Pläne), Ruhe/frei = keine. */
export function einheitenVon(tag: PlanTag, wt: Wochentag): PlanEinheit[] {
  if (tag.einheiten?.length) return tag.einheiten;
  if (tag.art === 'ruhe' || tag.art === 'frei') return [];
  return [{ id: `${wt}-1`, sparte: tag.art, ...(tag.dauerMin ? { dauerMin: tag.dauerMin } : {}), ...(tag.notiz ? { notiz: tag.notiz } : {}) }];
}

/** Einen Tag aus Einheiten bauen (Art/Dauer abgeleitet wie im Säuberer); leer = frei, `ruhe` = Ruhetag. */
export function tagAus(einheiten: readonly PlanEinheit[], ruhe = false): PlanTag {
  if (!einheiten.length) return { art: ruhe ? 'ruhe' : 'frei' };
  const d = einheiten.reduce((a, e) => a + (e.dauerMin ?? 0), 0);
  return { art: einheiten[0].sparte, ...(d ? { dauerMin: d } : {}), einheiten: [...einheiten] };
}

// ── Vorlagen ─────────────────────────────────────────────────────────────────

const E = (id: string, sparte: Sparte, typ: PlanEinheit['typ'], dauerMin: number, extra: Partial<PlanEinheit> = {}): PlanEinheit => ({ id, sparte, ...(typ ? { typ } : {}), dauerMin, ...extra });
const W = (tage: Partial<Record<Wochentag, PlanEinheit[] | 'ruhe'>>): Woche => {
  const w = leereWoche();
  for (const t of WOCHENTAGE) { const x = tage[t]; if (x === 'ruhe') w[t] = { art: 'ruhe' }; else if (x?.length) w[t] = tagAus(x); }
  return w;
};

/**
 * Startvorlagen — erfundene, neutrale Wochen als Ausgangspunkt (keine Person, keine echten Daten). Sie lassen sich übernehmen und als eigene
 * Vorlage kopieren, aber nicht ändern. Kennungen beginnen mit `start-` (der Säuberer erkennt sie daran).
 */
export const START_VORLAGEN: readonly PlanVorlage[] = [
  {
    id: 'start-hyrox-4', name: 'Hyrox · 4 Tage',
    notiz: 'Laufen, Kraft und Stationen im Wechsel — harte Tage mit Luft dazwischen.',
    woche: W({
      di: [E('di-1', 'lauf', 'intervall', 45, { zone: 4 })],
      do: [E('do-1', 'gym', 'kraft', 60)],
      sa: [E('sa-1', 'hyrox', 'stationen', 60)],
      mo: [E('mo-1', 'lauf', 'grundlage', 45, { zone: 2 })],
      so: 'ruhe',
    }),
  },
  {
    id: 'start-hyrox-5', name: 'Hyrox · 5 Tage',
    notiz: 'Mehr Lauf unter Vorermüdung: Stationen und Lauf an einem Tag, eine Simulation am Wochenende — harte Tage mit Luft dazwischen.',
    woche: W({
      mo: [E('mo-1', 'lauf', 'grundlage', 50, { zone: 2 }), E('mo-2', 'mobility', 'mobility', 15)],
      di: [E('di-1', 'hyrox', 'stationen', 40), E('di-2', 'lauf', 'tempo', 20, { notiz: 'direkt nach den Stationen' })],
      mi: [E('mi-1', 'gym', 'kraft', 60)],
      do: [E('do-1', 'lauf', 'intervall', 45, { zone: 4 })],
      sa: [E('sa-1', 'hyrox', 'simulation', 75)],
      so: 'ruhe',
    }),
  },
  {
    id: 'start-lauf-3', name: 'Laufen · 3 Tage',
    notiz: 'Ein langer Lauf, ein schneller, ein lockerer — dazu Kraft als Stütze.',
    woche: W({
      di: [E('di-1', 'lauf', 'intervall', 45, { zone: 4 })],
      do: [E('do-1', 'lauf', 'locker', 40, { zone: 2 }), E('do-2', 'gym', 'kraft', 30)],
      so: [E('so-1', 'lauf', 'longrun', 90, { zone: 2 })],
      mi: 'ruhe',
    }),
  },
];

export const STANDARD = 'standard';

/** Eine Vorlage nach Kennung: `standard` = die Standardwoche der Person, `start-…` aus dem Code, sonst eine eigene. */
export function vorlageVon(stand: Pick<SportStand, 'woche' | 'planVorlagen'>, id: string): PlanVorlage | null {
  if (id === STANDARD) return { id: STANDARD, name: 'Standardwoche', woche: stand.woche };
  return START_VORLAGEN.find(v => v.id === id) ?? stand.planVorlagen?.find(v => v.id === id) ?? null;
}

/** Alle Vorlagen zur Wahl: Standardwoche, eigene, Startvorlagen. */
export function alleVorlagen(stand: Pick<SportStand, 'woche' | 'planVorlagen'>): (PlanVorlage & { art: 'standard' | 'eigen' | 'start' })[] {
  return [
    { id: STANDARD, name: 'Standardwoche', woche: stand.woche, art: 'standard' as const },
    ...(stand.planVorlagen ?? []).map(v => ({ ...v, art: 'eigen' as const })),
    ...START_VORLAGEN.map(v => ({ ...v, art: 'start' as const })),
  ];
}

// ── Phasen ───────────────────────────────────────────────────────────────────

/** Vorgabe: Deload und Taper mit 60 % Umfang — je Person einstellbar (`einstellungen.deloadProzent`/`taperProzent`). */
export const PHASE_VORGABE = { deloadProzent: 60, taperProzent: 60 } as const;

const auf5 = (n: number) => Math.max(10, Math.round(n / 5) * 5);

/**
 * Eine Woche in einer Phase (rein): Aufbau unverändert; Deload = Umfang × Deload-%, „hart“ wird „mittel“; Taper = Umfang × Taper-%,
 * Intensität bleibt (kurz und knackig vor dem Wettkampf). Strain-Ziele schrumpfen mit dem Umfang.
 */
export function wocheInPhase(w: Woche, phase: BlockPhase, prozent: { deload?: number; taper?: number } = {}): Woche {
  if (phase === 'aufbau') return w;
  const p = (phase === 'deload' ? prozent.deload ?? PHASE_VORGABE.deloadProzent : prozent.taper ?? PHASE_VORGABE.taperProzent) / 100;
  const r = leereWoche();
  for (const t of WOCHENTAGE) {
    const ein = einheitenVon(w[t], t);
    if (!ein.length) { r[t] = w[t]; continue; }
    r[t] = tagAus(ein.map(e => ({
      ...e,
      ...(e.dauerMin ? { dauerMin: auf5(e.dauerMin * p) } : {}),
      ...(e.strain !== undefined ? { strain: Math.round(e.strain * p * 10) / 10 } : {}),
      ...(phase === 'deload' && intensitaetVon(e) === 'hart' ? { intensitaet: 'mittel' as const } : {}),
    })));
  }
  return r;
}

// ── Welche Woche gilt? ───────────────────────────────────────────────────────

export interface PlanWoche {
  montag: string;
  woche: Woche;
  quelle: 'standard' | 'block';
  vorlage: { id: string; name: string };
  /** Phase dieser Woche — aus dem Block oder von der Person gesetzt (`wochenPhase`, z. B. Entlastung angenommen). */
  phase: BlockPhase;
  /** Hat die Person die Phase dieser Woche selbst gesetzt? */
  eigenePhase?: true;
  /** Im Block: Woche n von m. */
  blockWoche?: number;
  blockWochen?: number;
  /** Fehlt eine Vorlage des Blocks (z. B. eine Startvorlage, die es nicht mehr gibt), gilt die Standardwoche. */
  ersatz?: true;
  /** Tage dieser Woche mit eigenem Plan (`SportStand.tage`: verschoben, Taper) — sie gewinnen und werden nicht skaliert. */
  eigeneTage?: Wochentag[];
}

/** Einzeltage (`SportStand.tage`) über eine Woche legen. */
function mitTagen(w: Woche, montag: string, tage: SportStand['tage']): { woche: Woche; eigene: Wochentag[] } {
  if (!tage) return { woche: w, eigene: [] };
  const r = { ...w };
  const eigene: Wochentag[] = [];
  WOCHENTAGE.forEach((t, i) => { const x = tage[tagPlus(montag, i)]; if (x) { r[t] = x; eigene.push(t); } });
  return { woche: eigene.length ? r : w, eigene };
}

/** Die geplante Woche ab `montag`: Block (wenn er die Woche umfasst), sonst Standardwoche; Phase der Person gewinnt. */
export function wocheFuer(stand: Pick<SportStand, 'woche' | 'planVorlagen' | 'block' | 'wochenPhase' | 'einstellungen' | 'tage'>, montag: string): PlanWoche {
  const m = montagVon(montag);
  const prozent = { deload: stand.einstellungen?.deloadProzent, taper: stand.einstellungen?.taperProzent };
  const eigen = stand.wochenPhase?.[m];
  const b = stand.block;
  const i = b ? Math.round(tageZwischen(b.start, m) / 7) : -1;
  if (b && i >= 0 && i < b.wochen.length) {
    const bw = b.wochen[i];
    const v = vorlageVon(stand, bw.vorlage);
    const basis = v ?? { id: STANDARD, name: 'Standardwoche', woche: stand.woche };
    const phase = eigen ?? bw.phase;
    const t = mitTagen(wocheInPhase(basis.woche, phase, prozent), m, stand.tage);
    return {
      montag: m, woche: t.woche, quelle: 'block', vorlage: { id: basis.id, name: basis.name }, phase,
      ...(eigen ? { eigenePhase: true as const } : {}), blockWoche: i + 1, blockWochen: b.wochen.length, ...(v ? {} : { ersatz: true as const }),
      ...(t.eigene.length ? { eigeneTage: t.eigene } : {}),
    };
  }
  const phase = eigen ?? 'aufbau';
  const t = mitTagen(wocheInPhase(stand.woche, phase, prozent), m, stand.tage);
  return { montag: m, woche: t.woche, quelle: 'standard', vorlage: { id: STANDARD, name: 'Standardwoche' }, phase, ...(eigen ? { eigenePhase: true as const } : {}), ...(t.eigene.length ? { eigeneTage: t.eigene } : {}) };
}

export interface GeplanteEinheit { datum: string; wochentag: Wochentag; einheit: PlanEinheit; intensitaet: Intensitaet }

/** Alle geplanten Einheiten einer Woche in Tagesreihenfolge. */
export function geplanteEinheiten(stand: Parameters<typeof wocheFuer>[0], montag: string): GeplanteEinheit[] {
  const w = wocheFuer(stand, montag);
  return WOCHENTAGE.flatMap((t, i) => einheitenVon(w.woche[t], t).map(e => ({ datum: tagPlus(w.montag, i), wochentag: t, einheit: e, intensitaet: intensitaetVon(e) })));
}

// ── Plan ↔ Ist ───────────────────────────────────────────────────────────────

/** Welche tatsächliche Sparte eine geplante auch erfüllt (nach der gleichen Sparte): Hyrox-Training kommt oft als „Krafttraining“, Ausdauer als Rad/Lauf. */
export const ERSATZ: Readonly<Record<Sparte, readonly Sparte[]>> = {
  lauf: [], gym: ['hyrox'], hyrox: ['gym'], rad: ['ausdauer'], ausdauer: ['rad', 'lauf'], mobility: [], sonstiges: ['lauf', 'gym', 'hyrox', 'rad', 'ausdauer', 'mobility', 'sonstiges'],
};
/** Toleranz in Tagen (innerhalb derselben Woche). */
export const TOLERANZ_TAGE = 1;

export type PlanStatus = 'erfuellt' | 'verpasst' | 'heute' | 'offen';
export interface PlanZeile { plan: GeplanteEinheit; ist?: Einheit; status: PlanStatus; /** Tage Abstand (−1/+1), wenn nicht am geplanten Tag. */ versetzt?: number; ersatz?: true }
export interface PlanGegenIst {
  montag: string;
  zeilen: PlanZeile[];
  /** Zählende Einheiten der Woche, die keiner geplanten zugeordnet sind. */
  zusaetzlich: Einheit[];
  geplant: number;
  erfuellt: number;
  verpasst: number;
  /** erfüllt ÷ geplant (0–1), ohne Plan 0. */
  anteil: number;
  minutenPlan: number;
  minutenIst: number;
  /** Summe der Strain-Ziele (nur wenn mindestens eine Einheit eins hat). */
  strainPlan?: number;
  /** Summe der Einheiten-Strains der Woche. */
  strainIst?: number;
}

/** Plan gegen Ist einer Woche. `alle` = `alleEinheiten(stand)` (wenn schon gerechnet). */
export function planGegenIst(stand: SportStand, montag: string, heute: string, alle?: readonly Einheit[]): PlanGegenIst {
  const m = montagVon(montag);
  const geplant = geplanteEinheiten(stand, m);
  const ist = inWoche(alle ?? alleEinheiten(stand), m).filter(e => e.zaehlt);
  const frei = new Set(ist.map(e => e.id));
  const zuordnung = new Map<number, { e: Einheit; versetzt?: number; ersatz?: true }>();
  const abstand = (a: string, b: string) => Math.round(tageZwischen(a, b));
  // Vier Durchgänge: gleiche Sparte am Tag → gleiche Sparte ±1 → Ersatz am Tag → Ersatz ±1. Bei mehreren Kandidaten die mit der nächsten Dauer.
  const durchgaenge: { ersatz: boolean; tage: number }[] = [{ ersatz: false, tage: 0 }, { ersatz: false, tage: TOLERANZ_TAGE }, { ersatz: true, tage: 0 }, { ersatz: true, tage: TOLERANZ_TAGE }];
  for (const d of durchgaenge) {
    geplant.forEach((g, i) => {
      if (zuordnung.has(i)) return;
      const k = ist.filter(e => frei.has(e.id) && Math.abs(abstand(g.datum, e.datum)) <= d.tage && (d.ersatz ? ERSATZ[g.einheit.sparte].includes(e.klasse as Sparte) : e.klasse === g.einheit.sparte))
        .sort((a, b) => Math.abs(abstand(g.datum, a.datum)) - Math.abs(abstand(g.datum, b.datum)) || Math.abs((a.dauerMin ?? 0) - (g.einheit.dauerMin ?? 0)) - Math.abs((b.dauerMin ?? 0) - (g.einheit.dauerMin ?? 0)));
      const e = k[0];
      if (!e) return;
      frei.delete(e.id);
      const v = abstand(g.datum, e.datum);
      zuordnung.set(i, { e, ...(v ? { versetzt: v } : {}), ...(d.ersatz ? { ersatz: true as const } : {}) });
    });
  }
  const zeilen: PlanZeile[] = geplant.map((g, i) => {
    const z = zuordnung.get(i);
    if (z) return { plan: g, ist: z.e, status: 'erfuellt', ...(z.versetzt ? { versetzt: z.versetzt } : {}), ...(z.ersatz ? { ersatz: true as const } : {}) };
    // Noch offen ist, was heute oder später kommt — „verpasst“ erst, wenn auch die Toleranz vorbei ist.
    const status: PlanStatus = g.datum === heute ? 'heute' : tagPlus(g.datum, TOLERANZ_TAGE) < heute ? 'verpasst' : 'offen';
    return { plan: g, status };
  });
  const zusaetzlich = ist.filter(e => frei.has(e.id));
  const s = summe(ist);
  const mitStrain = geplant.filter(g => g.einheit.strain !== undefined);
  const erfuellt = zeilen.filter(z => z.status === 'erfuellt').length;
  return {
    montag: m, zeilen, zusaetzlich, geplant: geplant.length, erfuellt, verpasst: zeilen.filter(z => z.status === 'verpasst').length,
    anteil: geplant.length ? erfuellt / geplant.length : 0,
    minutenPlan: geplant.reduce((a, g) => a + (g.einheit.dauerMin ?? 0), 0), minutenIst: s.minuten,
    ...(mitStrain.length ? { strainPlan: Math.round(mitStrain.reduce((a, g) => a + (g.einheit.strain ?? 0), 0) * 10) / 10 } : {}),
    ...(s.strain !== undefined ? { strainIst: s.strain } : {}),
  };
}

// ── Block bauen ──────────────────────────────────────────────────────────────

export interface BlockWunsch {
  id: string;
  /** Montag der ersten Woche. */
  start: string;
  /** Vorlage für Aufbau-, Deload- und Taper-Wochen (eine für alle — einzelne Wochen ändert man danach). */
  vorlage: string;
  /** Wochenzahl — oder `bis` (Datum des Wettkampfs: der Block endet mit dessen Woche). */
  wochen?: number;
  bis?: string;
  /** Rhythmus: so viele Aufbau-Wochen, dann so viele Deload-Wochen; `deload: 0` = Deload nach Tagesform (keine festen Deload-Wochen). */
  aufbau: number;
  deload: number;
  /** Taper-Wochen am Ende (die Wettkampfwoche zählt mit). */
  taper: number;
  zielId?: string;
}

/** Ein Block aus einem Wunsch (rein). Mindestens eine Woche; höchstens 52. */
export function blockBauen(w: BlockWunsch): PlanBlock {
  const start = montagVon(w.start);
  const n = Math.max(1, Math.min(52, w.bis ? Math.floor(tageZwischen(start, montagVon(w.bis)) / 7) + 1 : Math.round(w.wochen ?? 4)));
  const taper = Math.max(0, Math.min(n, Math.round(w.taper)));
  const aufbau = Math.max(1, Math.round(w.aufbau));
  const deload = Math.max(0, Math.round(w.deload));
  const wochen = Array.from({ length: n }, (_, i): { vorlage: string; phase: BlockPhase } => {
    if (i >= n - taper) return { vorlage: w.vorlage, phase: 'taper' };
    const imZyklus = deload ? i % (aufbau + deload) : 0;
    return { vorlage: w.vorlage, phase: deload && imZyklus >= aufbau ? 'deload' : 'aufbau' };
  });
  return { id: w.id, start, wochen, ...(w.zielId ? { zielId: w.zielId } : {}) };
}

// ── Wettkampf-Ziele: Countdown, Saison, Taper-Vorschlag ─────────────────────

export interface Wettkampf { ziel: Ziel; tage: number; wochen: number; text: string }

/** Countdown als Satz: „heute“, „morgen“, „in 8 Tagen“, ab 3 Wochen „in 5 Wochen“. */
export function countdownText(tage: number): string {
  if (tage <= 0) return 'heute';
  if (tage === 1) return 'morgen';
  if (tage < 21) return `in ${tage} Tagen`;
  return `in ${Math.round(tage / 7)} Wochen`;
}

/** Die kommenden Ziele mit Datum (die Saison), nächstes zuerst — offene, ab heute. */
export function saison(ziele: readonly Ziel[], heute: string): Wettkampf[] {
  return ziele.filter(z => !z.erledigt && z.datum && z.datum >= heute).sort((a, b) => (a.datum! < b.datum! ? -1 : 1)).map(z => {
    const tage = Math.round(tageZwischen(heute, z.datum!));
    return { ziel: z, tage, wochen: Math.ceil(tage / 7), text: countdownText(tage) };
  });
}

/**
 * Taper-Vorschlag (rein): liegt ein Wettkampf in den nächsten 21 Tagen und deckt kein Block seine Woche mit Taper ab, schlägt die Regel einen
 * kurzen Wettkampfblock vor — ab der laufenden Woche bis zur Wettkampfwoche, die letzte Woche (≤ 10 Tage: nur sie; sonst die letzten zwei)
 * als Taper. Null = nichts vorzuschlagen.
 */
export function taperVorschlag(stand: Pick<SportStand, 'ziele' | 'block' | 'woche' | 'planVorlagen' | 'wochenPhase' | 'einstellungen' | 'tage'>, heute: string): { ziel: Ziel; tage: number; wunsch: Omit<BlockWunsch, 'id'> } | null {
  const naechster = saison(stand.ziele, heute)[0];
  if (!naechster || naechster.tage > 21) return null;
  const rennWoche = montagVon(naechster.ziel.datum!);
  if (wocheFuer(stand, rennWoche).phase === 'taper') return null;
  const taper = naechster.tage <= 10 ? 1 : 2;
  const vorlage = stand.block?.wochen[0]?.vorlage ?? STANDARD;
  return { ziel: naechster.ziel, tage: naechster.tage, wunsch: { start: montagVon(heute), vorlage, bis: naechster.ziel.datum!, aufbau: 3, deload: 0, taper, zielId: naechster.ziel.id } };
}

// ── Tage flexibel: prüfen und vorschlagen ────────────────────────────────────
// Wunsch der trainierenden Person (09.10.): Trainingstage flexibel — der Baukasten schlägt Tage vor, alles bleibt verschiebbar. Zwei Regeln
// (Vorschlag, keine Trainingsberatung): harte Einheiten nicht an aufeinanderfolgenden Tagen (auch So → Mo der nächsten Woche), der lange
// Lauf bevorzugt am Wochenende.

const NACHBAR: Record<Wochentag, Wochentag> = { mo: 'di', di: 'mi', mi: 'do', do: 'fr', fr: 'sa', sa: 'so', so: 'mo' };
const hartAm = (w: Woche, t: Wochentag) => einheitenVon(w[t], t).some(e => intensitaetVon(e) === 'hart');
const langAm = (w: Woche, t: Wochentag) => einheitenVon(w[t], t).some(e => e.typ === 'longrun');

export interface PlanHinweis { art: 'hart-folge' | 'lang-unter-der-woche'; tage: Wochentag[]; text: string }

/** Hinweise zu einer Woche (rein) — leer, wenn alles passt. */
export function planPruefen(w: Woche): PlanHinweis[] {
  const r: PlanHinweis[] = [];
  const L: Record<Wochentag, string> = { mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr', sa: 'Sa', so: 'So' };
  for (const t of WOCHENTAGE) {
    const n = NACHBAR[t];
    if (hartAm(w, t) && hartAm(w, n)) r.push({ art: 'hart-folge', tage: [t, n], text: `Harte Einheiten an zwei Tagen hintereinander (${L[t]} und ${L[n]}${t === 'so' ? ' der nächsten Woche' : ''}) — einen Tag Luft dazwischen hilft der Erholung.` });
  }
  const lang = WOCHENTAGE.filter(t => langAm(w, t) && t !== 'sa' && t !== 'so');
  if (lang.length) r.push({ art: 'lang-unter-der-woche', tage: lang, text: `Der lange Lauf liegt unter der Woche (${lang.map(t => L[t]).join(', ')}) — am Wochenende ist meist mehr Zeit und Ruhe danach.` });
  return r;
}

/**
 * Einheiten auf Tage verteilen (rein): zuerst der lange Lauf aufs Wochenende (So, sonst Sa), dann die harten Einheiten mit Luft dazwischen,
 * dann der Rest auf freie Tage — nur auf `tage` (verfügbare Trainingstage), höchstens vier je Tag. Was ohne Regelbruch nicht passt, kommt auf
 * den Tag mit den wenigsten Einheiten (dann meldet `planPruefen` es). Ruhetage = verfügbare Tage ohne Einheit bleiben frei, übrige Tage Ruhe.
 */
export function tageVorschlagen(einheiten: readonly PlanEinheit[], tage: readonly Wochentag[] = WOCHENTAGE): Woche {
  const verfuegbar = WOCHENTAGE.filter(t => tage.includes(t));
  const plan: Record<Wochentag, PlanEinheit[]> = { mo: [], di: [], mi: [], do: [], fr: [], sa: [], so: [] };
  if (!verfuegbar.length) return leereWoche();
  const voll = (t: Wochentag) => plan[t].length >= 4;
  const hart = (t: Wochentag) => plan[t].some(e => intensitaetVon(e) === 'hart');
  const vorher = (t: Wochentag) => WOCHENTAGE[(WOCHENTAGE.indexOf(t) + 6) % 7];
  const wenigste = () => [...verfuegbar].filter(t => !voll(t)).sort((a, b) => plan[a].length - plan[b].length)[0];
  const lange = einheiten.filter(e => e.typ === 'longrun');
  const harte = einheiten.filter(e => e.typ !== 'longrun' && intensitaetVon(e) === 'hart');
  const rest = einheiten.filter(e => e.typ !== 'longrun' && intensitaetVon(e) !== 'hart');
  for (const e of lange) {
    const t = (['so', 'sa'] as Wochentag[]).find(x => verfuegbar.includes(x) && !plan[x].length) ?? (['so', 'sa'] as Wochentag[]).find(x => verfuegbar.includes(x) && !voll(x)) ?? wenigste();
    if (t) plan[t].push(e);
  }
  // Harte Einheiten: Reihenfolge mit Abstand (Di, Do, Sa, Mo, Fr, Mi, So), nie neben einem harten Tag und nicht auf den Tag des langen Laufs.
  const REIHE_HART: Wochentag[] = ['di', 'do', 'sa', 'mo', 'fr', 'mi', 'so'];
  for (const e of harte) {
    const ok = REIHE_HART.find(t => verfuegbar.includes(t) && !plan[t].length && !hart(vorher(t)) && !hart(NACHBAR[t]))
      ?? REIHE_HART.find(t => verfuegbar.includes(t) && !voll(t) && !hart(t) && !hart(vorher(t)) && !hart(NACHBAR[t]))
      ?? wenigste();
    if (ok) plan[ok].push(e);
  }
  // Der Rest: freie Tage zuerst, dann die Tage mit den wenigsten Einheiten.
  for (const e of rest) { const t = verfuegbar.find(x => !plan[x].length) ?? wenigste(); if (t) plan[t].push(e); }
  const w = leereWoche();
  // Kennungen je Tag neu (`<tag>-<n>`) — so bleiben sie innerhalb eines Tages eindeutig, auch wenn Einheiten zweier Tage zusammenkommen.
  for (const t of WOCHENTAGE) w[t] = plan[t].length ? tagAus(plan[t].map((e, i) => ({ ...e, id: `${t}-${i + 1}` }))) : verfuegbar.includes(t) ? { art: 'frei' } : { art: 'ruhe' };
  return w;
}

/** Alle Einheiten einer Woche als Liste (für „Tage neu vorschlagen“). */
export const einheitenDerWoche = (w: Woche): PlanEinheit[] => WOCHENTAGE.flatMap(t => einheitenVon(w[t], t));
