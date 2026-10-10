// ─── Erholung je Person — die Rechnungen (rein, getestet, 10.10.) ────────────────────────────────────────────────────────────────
// Alles, was die Oberfläche, das Heute-Widget, ZOE (nur mit Einwilligung (b)) und die Route über die Erholung einer Person sagen,
// rechnet HIER — nie in einer Ansicht. Server UND Browser (keine Bestände, kein Netz).
//
//   heute fällig      aktive Programme: fester Wochentag → heute dran; flexibel → dran, solange die Woche ihr Soll nicht hat
//   Woche             je Programm „2 von 3 diese Woche“
//   Tag               Erholung eines Tages aus ALLEN Quellen: Einheiten (Programm/Vorlage), erledigte Aufgaben mit Marke „Erholung“
//                     (Privat), erledigte Routinen der Kategorie „Erholung“, bewusst gemessene Erholungs-Zeit, geplante Blöcke
//   Streak            „Erholung gehalten“: Tage in Folge mit mindestens einer Erholung (heute zählt mit, sobald etwas da ist —
//                     ohne heute läuft die Folge ab gestern weiter, bis der Tag vorbei ist)
//   Ziele             Woche/Monat: Einheiten und/oder Minuten, optional nur ein Programm
//   Vorschlag         EINE Regel aus den eigenen Körperwerten (Recovery, Strain-Rahmen, HRV-/Ruhepuls-Trend, Schlafschuld) —
//                     „heute Erholungstag · leichte Einheit · Entlastungswoche · Schlaf nachholen“ — nur ein Vorschlag
//   Zusammenhang      Erholung erledigt ↔ Beschwerde am Folgetag (eigenes Symptom-Tagebuch), erst ab einer Mindestmenge, als
//                     Zusammenhang formuliert — nie als Ursache
//   Pausen            nächste Pause im Arbeitstag (Einstellung der Person)

import { montagVon, tagPlus, wochentag } from '@/lib/zeit/kalender-kern';
import { belastungLage, recZone } from './belastung';
import { ERHOLUNG_VORLAGEN, erholungArtName, type Behandlung, type ErholungEinheit, type ErholungProgramm, type ErholungStand, type ErholungZiel, type PausenEinstellung } from './erholung';

const de = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

// ── Minuten ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Dauer eines Programms: Summe der Übungen mit Minuten, sonst die Dauer der Vorlage, sonst 0. */
export function programmMinuten(p: Pick<ErholungProgramm, 'uebungen' | 'art'>): number {
  const summe = p.uebungen.reduce((s, u) => s + (u.minuten ?? 0), 0);
  return summe || (ERHOLUNG_VORLAGEN.find(v => v.id === p.art)?.minuten ?? 0);
}
/** Minuten einer Einheit: eingetragen, sonst die Dauer ihres Programms bzw. ihrer Vorlage. */
export function einheitMinuten(e: ErholungEinheit, programme: readonly ErholungProgramm[]): number {
  if (e.minuten) return e.minuten;
  const p = e.programmId ? programme.find(x => x.id === e.programmId) : undefined;
  if (p) return programmMinuten(p);
  return ERHOLUNG_VORLAGEN.find(v => v.id === e.art)?.minuten ?? 0;
}

// ── Woche und heute fällig ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Die Tage der Woche (Mo–So) um `tag`. */
export const wocheVon = (tag: string): string[] => { const m = montagVon(tag); return Array.from({ length: 7 }, (_, i) => tagPlus(m, i)); };
const imZeitraum = (tag: string, zeitraum: 'woche' | 'monat', bezug: string) => (zeitraum === 'woche' ? montagVon(tag) === montagVon(bezug) : tag.slice(0, 7) === bezug.slice(0, 7));

export interface ProgrammWoche { id: string; name: string; soll: number; ist: number; heuteErledigt: boolean }
/** Je aktivem Programm: erledigte Einheiten diese Woche gegen das Soll. */
export function wochenFortschritt(s: ErholungStand, heute: string): ProgrammWoche[] {
  const woche = new Set(wocheVon(heute));
  return s.programme.filter(p => p.status === 'aktiv').map(p => {
    const eigene = s.einheiten.filter(e => e.programmId === p.id);
    return { id: p.id, name: p.name, soll: p.proWoche, ist: eigene.filter(e => woche.has(e.tag)).length, heuteErledigt: eigene.some(e => e.tag === heute) };
  });
}

export interface FaelligEintrag { programm: ErholungProgramm; erledigt: boolean; grund: string; minuten: number }
/**
 * Was heute dran ist: aktive Programme mit festem Tag heute, flexible, solange ihre Woche das Soll nicht hat — und alles, was heute
 * schon erledigt wurde (damit Abhaken zurücknehmbar bleibt). Pausierte und beendete nie.
 */
export function heuteFaellig(s: ErholungStand, heute: string): FaelligEintrag[] {
  const wt = wochentag(heute);
  const woche = new Map(wochenFortschritt(s, heute).map(w => [w.id, w]));
  const aus: FaelligEintrag[] = [];
  for (const p of s.programme) {
    if (p.status !== 'aktiv') continue;
    const w = woche.get(p.id)!;
    const minuten = programmMinuten(p);
    if (w.heuteErledigt) { aus.push({ programm: p, erledigt: true, grund: `${w.ist} von ${w.soll} diese Woche`, minuten }); continue; }
    if (p.tage.length) {
      if (p.tage.includes(wt)) aus.push({ programm: p, erledigt: false, grund: 'fester Tag', minuten });
      continue;
    }
    if (w.ist < w.soll) aus.push({ programm: p, erledigt: false, grund: `noch ${w.soll - w.ist} diese Woche`, minuten });
  }
  return aus;
}

// ── Erholung eines Tages aus allen Quellen ──────────────────────────────────────────────────────────────────────────────────

export interface ErholungQuellen {
  /** Erledigte Aufgaben mit Marke „Erholung“ je Tag (nur Privat, nur die Person) — Anzahl. */
  aufgabenJeTag?: Record<string, number>;
  /** Erledigte Routinen der Kategorie „Erholung“ je Tag — Anzahl. */
  routinenJeTag?: Record<string, number>;
  /** Bewusst gemessene Erholungs-Zeit je Tag (Sekunden, Fokus-Zähler mit Bereich „Erholung“). */
  zeitJeTag?: Record<string, number>;
  /** Geplante Erholungs-Blöcke im Kalender je Tag (Minuten). */
  geplantJeTag?: Record<string, number>;
}
export interface TagesErholung { tag: string; einheiten: number; minuten: number; aufgaben: number; routinen: number; zeitMin: number; geplantMin: number; erholt: boolean }

/** Ab wie vielen bewusst gemessenen Minuten ein Tag als „erholt“ zählt (ohne andere Quelle). */
export const ZEIT_ZAEHLT_AB_MIN = 5;

export function tagesErholung(s: ErholungStand, q: ErholungQuellen, tag: string): TagesErholung {
  const eh = s.einheiten.filter(e => e.tag === tag);
  const minuten = eh.reduce((x, e) => x + einheitMinuten(e, s.programme), 0);
  const aufgaben = q.aufgabenJeTag?.[tag] ?? 0, routinen = q.routinenJeTag?.[tag] ?? 0;
  const zeitMin = Math.round((q.zeitJeTag?.[tag] ?? 0) / 60), geplantMin = q.geplantJeTag?.[tag] ?? 0;
  return { tag, einheiten: eh.length, minuten, aufgaben, routinen, zeitMin, geplantMin, erholt: eh.length > 0 || aufgaben > 0 || routinen > 0 || zeitMin >= ZEIT_ZAEHLT_AB_MIN };
}

/** Tage mit mindestens einer Erholung (alle Quellen) in den `n` Tagen bis `heute`. */
export function erholteTage(s: ErholungStand, q: ErholungQuellen, heute: string, n = 90): Set<string> {
  const aus = new Set<string>();
  for (let i = 0; i < n; i++) { const t = tagPlus(heute, -i); if (tagesErholung(s, q, t).erholt) aus.add(t); }
  return aus;
}

/** „Erholung gehalten“: Tage in Folge bis heute (ohne Eintrag heute ab gestern). */
export function erholungStreak(tage: ReadonlySet<string>, heute: string): { tage: number; heuteDabei: boolean } {
  const heuteDabei = tage.has(heute);
  let t = heuteDabei ? heute : tagPlus(heute, -1), n = 0;
  while (tage.has(t) && n < 3650) { n++; t = tagPlus(t, -1); }
  return { tage: n, heuteDabei };
}

// ── Ziele ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ZielFortschritt { id: string; titel: string; zeitraum: 'woche' | 'monat'; soll: { einheiten?: number; minuten?: number }; ist: { einheiten: number; minuten: number }; anteil: number; erreicht: boolean }
/**
 * Fortschritt eines Erholungs-Ziels im laufenden Zeitraum. An ein Programm gebunden: nur dessen Einheiten. Sonst jede Erholung:
 * Einheiten + erledigte Erholungs-Aufgaben + Erholungs-Routinen zählen als Einheiten, Minuten = Einheiten + gemessene Erholungs-Zeit.
 * Mit beiden Sollwerten zählt der kleinere Anteil (beides muss stehen).
 */
export function zielFortschritt(z: ErholungZiel, s: ErholungStand, q: ErholungQuellen, heute: string): ZielFortschritt {
  const eh = s.einheiten.filter(e => imZeitraum(e.tag, z.zeitraum, heute) && e.tag <= heute && (!z.programmId || e.programmId === z.programmId));
  let einheiten = eh.length, minuten = eh.reduce((x, e) => x + einheitMinuten(e, s.programme), 0);
  if (!z.programmId) {
    const summe = (r?: Record<string, number>) => Object.entries(r ?? {}).filter(([t]) => imZeitraum(t, z.zeitraum, heute) && t <= heute).reduce((x, [, n]) => x + n, 0);
    einheiten += summe(q.aufgabenJeTag) + summe(q.routinenJeTag);
    minuten += Math.round(summe(q.zeitJeTag) / 60);
  }
  const anteile = [z.einheiten ? einheiten / z.einheiten : null, z.minuten ? minuten / z.minuten : null].filter((x): x is number => x !== null);
  const anteil = Math.min(1, anteile.length ? Math.min(...anteile) : 0);
  return { id: z.id, titel: z.titel, zeitraum: z.zeitraum, soll: { ...(z.einheiten ? { einheiten: z.einheiten } : {}), ...(z.minuten ? { minuten: z.minuten } : {}) }, ist: { einheiten, minuten }, anteil, erreicht: anteil >= 1 };
}

// ── Behandlungen ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface BehandlungLage { id: string; art: string; erledigt: number; geplant?: number; naechster?: { tag: string; uhr?: string; terminId?: string }; text: string }
/** „6 von 10“, nächster offener Termin ab heute. */
export function behandlungLage(b: Behandlung, heute: string): BehandlungLage {
  const erledigt = b.termine.filter(t => t.erledigt).length;
  const n = b.termine.find(t => !t.erledigt && t.tag >= heute);
  const zahl = b.geplant ? `${erledigt} von ${b.geplant}` : `${erledigt} erledigt`;
  const naechster = n ? { tag: n.tag, ...(n.uhr ? { uhr: n.uhr } : {}), ...(n.terminId ? { terminId: n.terminId } : {}) } : undefined;
  return { id: b.id, art: b.art, erledigt, ...(b.geplant ? { geplant: b.geplant } : {}), ...(naechster ? { naechster } : {}), text: zahl };
}

// ── Vorschlag aus den Körperwerten (EINE Regel) ─────────────────────────────────────────────────────────────────────────────

/** Schlafschuld (Stunden), ab der „Schlaf nachholen“ vorgeschlagen wird — dieselbe Schwelle wie der Schlaf-Tipp (lib/gesundheit/schlaf.ts). */
export const SCHULD_VORSCHLAG_H = 2;

export type VorschlagArt = 'erholungstag' | 'entlastungswoche' | 'schlaf' | 'leicht' | 'normal';
export const VORSCHLAG_TITEL: Record<VorschlagArt, string> = {
  erholungstag: 'Heute Erholungstag',
  entlastungswoche: 'Entlastungswoche',
  schlaf: 'Schlaf nachholen',
  leicht: 'Heute eine leichte Einheit',
  normal: 'Normal belastbar',
};
export interface VorschlagEingabe {
  /** Recovery heute (0–100) — nur, wenn der Wert von heute ist. */
  rec?: number;
  /** Strain und Recovery von gestern (Belastung zur Tagesform). */
  strainGestern?: number;
  recGestern?: number;
  /** Ergebnis der Entlastungs-Regel (lib/sport/entlastung.ts) — HRV-/Ruhepuls-Trend. */
  entlastung?: { vorschlag: boolean; text: string } | null;
  /** Schlafschuld der letzten 7 Nächte (Stunden, lib/gesundheit/schlaf.ts). */
  schlafSchuldH?: number;
}
export interface ErholungVorschlag { art: VorschlagArt; titel: string; text: string; gruende: string[] }

/**
 * DIE Regel (Reihenfolge = Vorrang):
 *   1. Recovery rot (< 40)                                   → heute Erholungstag
 *   2. HRV-/Ruhepuls-Trend auffällig (Entlastungs-Regel)       → Entlastungswoche
 *   3. Schlafschuld ≥ 2 h                                       → Schlaf nachholen
 *   4. Recovery gelb ODER gestern über dem Strain-Rahmen       → leichte Einheit
 *   5. Recovery grün                                           → normal belastbar (Erholung wie geplant)
 * Ohne einen einzigen Wert: null (nie raten). Ein Vorschlag, keine Beratung — die Person entscheidet.
 */
export function erholungVorschlag(e: VorschlagEingabe): ErholungVorschlag | null {
  const zone = recZone(e.rec);
  const gestern = belastungLage(e.strainGestern, e.recGestern);
  const gruende: string[] = [];
  if (zone) gruende.push(`Recovery ${Math.round(e.rec!)} % (${zone === 'gruen' ? 'grün' : zone === 'gelb' ? 'gelb' : 'rot'})`);
  if (gestern && gestern.ampel !== 'offen' && gestern.ampel !== 'gut') gruende.push(`gestern Belastung ${de(e.strainGestern!)} — ${gestern.kurz}`);
  if (e.entlastung?.vorschlag) gruende.push(e.entlastung.text);
  if (typeof e.schlafSchuldH === 'number' && e.schlafSchuldH >= SCHULD_VORSCHLAG_H) gruende.push(`Schlafschuld ${de(e.schlafSchuldH)} h in 7 Nächten`);
  const mit = (art: VorschlagArt, text: string): ErholungVorschlag => ({ art, titel: VORSCHLAG_TITEL[art], text, gruende });
  if (zone === 'rot') return mit('erholungstag', 'Heute nur Leichtes: Spaziergang, Mobility, Atemübung, früh ins Bett.');
  if (e.entlastung?.vorschlag) return mit('entlastungswoche', 'Diese Woche leichter planen — weniger Umfang, mehr Erholungseinheiten.');
  if (typeof e.schlafSchuldH === 'number' && e.schlafSchuldH >= SCHULD_VORSCHLAG_H) return mit('schlaf', 'Heute früher ins Bett und eine ruhige Abendroutine — Schlaf ist die wirksamste Erholung.');
  if (zone === 'gelb' || (gestern && (gestern.ampel === 'achtung' || gestern.ampel === 'kritisch'))) return mit('leicht', 'Heute eher eine leichte Einheit: Mobility, Dehnen oder locker gehen.');
  if (zone === 'gruen') return mit('normal', 'Belastbar — Erholung wie geplant.');
  return null;
}

// ── Zusammenhang Erholung ↔ Beschwerde am Folgetag ───────────────────────────────────────────────────────────────────────────

/** Mindestmenge je Gruppe (Tage mit bzw. ohne Erholung, jeweils mit Eintrag am Folgetag). */
export const ZUSAMMENHANG_MIN = 5;
/** Ab welcher Differenz (Skalenpunkte) ein Unterschied genannt wird. */
export const ZUSAMMENHANG_DELTA = 0.5;
export interface Zusammenhang { mit: number; ohne: number; nMit: number; nOhne: number; satz: string }

/**
 * Wie lag die eigene Beschwerde (Skala 0–10, eigenes Symptom-Tagebuch) am TAG NACH einem Tag mit Erholung gegenüber einem Tag ohne?
 * Nur eigene Daten, erst ab `ZUSAMMENHANG_MIN` Tagen je Gruppe — sonst null. Formuliert als Zusammenhang, nie als Ursache.
 */
export function erholungZusammenhang(erholt: ReadonlySet<string>, symptom: Readonly<Record<string, { juckreiz?: number } | null | undefined>>, heute: string, tage = 60, name = 'Beschwerde'): Zusammenhang | null {
  const mit: number[] = [], ohne: number[] = [];
  for (let i = 1; i <= tage; i++) {
    const tag = tagPlus(heute, -i), folge = tagPlus(tag, 1);
    const w = symptom[folge]?.juckreiz;
    if (typeof w !== 'number' || !Number.isFinite(w)) continue;
    (erholt.has(tag) ? mit : ohne).push(w);
  }
  if (mit.length < ZUSAMMENHANG_MIN || ohne.length < ZUSAMMENHANG_MIN) return null;
  const m = (l: number[]) => Math.round((l.reduce((a, b) => a + b, 0) / l.length) * 10) / 10;
  const a = m(mit), b = m(ohne);
  const diff = b - a;
  const kern = Math.abs(diff) < ZUSAMMENHANG_DELTA
    ? `${name} am Folgetag etwa gleich — nach Erholung Ø ${de(a)}, sonst Ø ${de(b)}`
    : diff > 0 ? `${name} am Folgetag niedriger — nach Erholung Ø ${de(a)}, sonst Ø ${de(b)}` : `${name} am Folgetag höher — nach Erholung Ø ${de(a)}, sonst Ø ${de(b)}`;
  return { mit: a, ohne: b, nMit: mit.length, nOhne: ohne.length, satz: `${kern} (${mit.length} bzw. ${ohne.length} Tage). Ein Zusammenhang in deinen Einträgen — kein Beleg für eine Ursache.` };
}

// ── Pausen im Arbeitstag ────────────────────────────────────────────────────────────────────────────────────────────────────

const minVon = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
/**
 * Die nächste Pause: ab `von` alle `alleMin` Minuten bis `bis`; nach einer eingetragenen Pause (`letztePauseMin`) zählt der Abstand
 * von dort. null = aus, außerhalb des Arbeitstags oder nach der letzten Pause des Tages.
 */
export function naechstePause(p: PausenEinstellung | undefined, jetztMin: number, letztePauseMin?: number): { um: string; faellig: boolean } | null {
  if (!p?.an) return null;
  const von = minVon(p.von), bis = minVon(p.bis);
  if (jetztMin < von - 60 || jetztMin >= bis) return null;
  const basis = typeof letztePauseMin === 'number' && letztePauseMin >= von ? letztePauseMin : von;
  const um = basis + p.alleMin;
  if (um >= bis) return null;
  return { um: hhmm(um), faellig: jetztMin >= um };
}

/** Der Satz für ZOE (nur mit Einwilligung (b), lib/brain.ts) — ohne Werte einer anderen Person, Programmnamen sind Text der Person. */
export function erholungZoeZeilen(s: ErholungStand, heute: string, vorschlag: ErholungVorschlag | null): string {
  const f = heuteFaellig(s, heute);
  const offen = f.filter(x => !x.erledigt).map(x => x.programm.name.replace(/[<>]/g, ' '));
  const erledigt = f.filter(x => x.erledigt).length;
  const teile = [
    vorschlag ? `Vorschlag heute: ${vorschlag.titel}` : '',
    offen.length ? `heute dran: ${offen.join(', ')}` : f.length ? 'heute alles erledigt' : '',
    erledigt ? `${erledigt} erledigt` : '',
    s.fokus.trim() ? `eigener Fokus: ${s.fokus.replace(/[<>]/g, ' ')}` : '',
  ].filter(Boolean);
  return teile.length ? `Erholung (eigene Angaben): ${teile.join(' · ')}` : '';
}

/** Kurzname für eine Einheit (Programm oder Erholungsart). */
export const einheitName = (e: ErholungEinheit, programme: readonly ErholungProgramm[]): string =>
  (e.programmId ? programme.find(p => p.id === e.programmId)?.name : undefined) ?? erholungArtName(e.art);
