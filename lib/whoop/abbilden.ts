// ─── WHOOP — Abbildung in MAKE OS (rein, getestet, 08.10.2026) ──────────────────────────────────────────────────────────
// Aus den Rohdaten der API v2 (Felder: https://developer.whoop.com/api, FAKTEN 5) wird:
//   · der schlanke Spiegel `whoop-stand--<person>` (nur, was MAKE OS braucht — Zahlen und Zeiten, keine Namen),
//   · je Tag die Vitalwerte (`vitals--<person>`: Recovery, Schlaf, HRV, Ruhepuls) — **Handwert gewinnt**: ein Feld wird nur geschrieben,
//     wenn es leer ist oder schon von WHOOP stammt (`quellen[feld] === 'whoop'`, seit 08.10. auch `whoop-export` = alter Datenexport:
//     „Schnittstelle gewinnt“); ohne Markierung gilt es als von Hand (nur ein Wert, der GENAU dem WHOOP-Wert entspricht, wird als
//     WHOOP-Wert markiert — der Wert selbst ändert sich dabei nicht),
//   · Workouts im Sport-Bestand: Läufe mit Distanz als `Lauf`, alles andere als `TrainingEinheit` — immer `quelle: 'whoop'` +
//     `externeId: 'whoop:<uuid>'` (idempotent, nie doppelt; ein Lauf von Hand am selben Tag mit ±10 % Distanz zählt als derselbe).
// Tageszuordnung (Annahme, FAKTEN 5): Schlaf/Recovery = Tag des Aufwachens in Ortszeit (`timezone_offset`), Workouts/Zyklen = Starttag.
// Nur `SCORED` zählt (PENDING_SCORE/UNSCORABLE tragen keine Werte).

import type { DayVitals, VitalFeld, VitalsLog } from '@/lib/vitals';
import { VITAL_FELDER } from '@/lib/vitals';
import { tagVon } from '@/lib/zeit';
import type { SportStand, Lauf, TrainingEinheit } from '@/lib/sport/modell';

// ── Spiegel-Einträge ────────────────────────────────────────────────────────

export type Bewertung = 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
export interface WRecovery { sleepId: string; cycleId?: number; am: string; state: Bewertung; rec?: number; hrv?: number; rhr?: number; spo2?: number; hautTemp?: number }
export interface WSchlaf { id: string; start: string; ende: string; tz?: string; nap: boolean; state: Bewertung; leichtMs?: number; tiefMs?: number; remMs?: number; wachMs?: number; leistung?: number; effizienz?: number }
export interface WZyklus { id: number; start: string; ende?: string; tz?: string; state: Bewertung; strain?: number; kj?: number; puls?: number; pulsMax?: number }
export interface WWorkout { id: string; start: string; ende: string; tz?: string; sport: string; sportId?: number; state: Bewertung; strain?: number; kj?: number; puls?: number; pulsMax?: number; distanzM?: number }

const istObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const zahl = (v: unknown, min: number, max: number): number | undefined => { const n = Number(v); return v !== null && v !== '' && Number.isFinite(n) && n >= min && n <= max ? n : undefined; };
const zeit = (v: unknown): string | undefined => (typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v)) ? v : undefined);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const istUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const TZ = /^[+-]\d{2}:\d{2}$/;
const tz = (v: unknown): string | undefined => (typeof v === 'string' && TZ.test(v) ? v : undefined);
const bewertung = (v: unknown): Bewertung => (v === 'SCORED' || v === 'UNSCORABLE' ? v : 'PENDING_SCORE');
const rund = (n: number | undefined, stellen = 0): number | undefined => (n === undefined ? undefined : Math.round(n * 10 ** stellen) / 10 ** stellen);
/** Nur gesetzte Felder (undefined fällt weg — der Spiegel bleibt schlank). */
const ohneLeere = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

export function recoveryAus(r: unknown): WRecovery | null {
  if (!istObj(r) || !istUuid(r.sleep_id)) return null;
  const am = zeit(r.created_at) ?? zeit(r.updated_at);
  if (!am) return null;
  const state = bewertung(r.score_state);
  const s = istObj(r.score) && state === 'SCORED' ? r.score : {};
  return ohneLeere({
    sleepId: r.sleep_id.toLowerCase(), cycleId: zahl(r.cycle_id, 1, Number.MAX_SAFE_INTEGER), am, state,
    rec: rund(zahl(s.recovery_score, 0, 100)), hrv: rund(zahl(s.hrv_rmssd_milli, 0, 400)), rhr: rund(zahl(s.resting_heart_rate, 20, 250)),
    spo2: rund(zahl(s.spo2_percentage, 50, 100), 1), hautTemp: rund(zahl(s.skin_temp_celsius, 20, 45), 2),
  });
}

export function schlafAus(r: unknown): WSchlaf | null {
  if (!istObj(r) || !istUuid(r.id)) return null;
  const start = zeit(r.start), ende = zeit(r.end);
  if (!start || !ende) return null;
  const state = bewertung(r.score_state);
  const sc = istObj(r.score) && state === 'SCORED' ? r.score : {};
  const p = istObj(sc.stage_summary) ? sc.stage_summary : {};
  const ms = (k: string) => zahl(p[k], 0, 48 * 3_600_000);
  return ohneLeere({
    id: r.id.toLowerCase(), start, ende, tz: tz(r.timezone_offset), nap: r.nap === true, state,
    leichtMs: ms('total_light_sleep_time_milli'), tiefMs: ms('total_slow_wave_sleep_time_milli'), remMs: ms('total_rem_sleep_time_milli'), wachMs: ms('total_awake_time_milli'),
    leistung: rund(zahl(sc.sleep_performance_percentage, 0, 100)), effizienz: rund(zahl(sc.sleep_efficiency_percentage, 0, 100)),
  });
}

export function zyklusAus(r: unknown): WZyklus | null {
  if (!istObj(r)) return null;
  const id = zahl(r.id, 1, Number.MAX_SAFE_INTEGER); const start = zeit(r.start);
  if (!id || !Number.isInteger(id) || !start) return null;
  const state = bewertung(r.score_state);
  const s = istObj(r.score) && state === 'SCORED' ? r.score : {};
  return ohneLeere({ id, start, ende: zeit(r.end), tz: tz(r.timezone_offset), state, strain: rund(zahl(s.strain, 0, 21), 1), kj: rund(zahl(s.kilojoule, 0, 100_000)), puls: rund(zahl(s.average_heart_rate, 20, 250)), pulsMax: rund(zahl(s.max_heart_rate, 20, 250)) });
}

export function workoutAus(r: unknown): WWorkout | null {
  if (!istObj(r) || !istUuid(r.id)) return null;
  const start = zeit(r.start), ende = zeit(r.end);
  if (!start || !ende || Date.parse(ende) <= Date.parse(start)) return null;
  const state = bewertung(r.score_state);
  const s = istObj(r.score) && state === 'SCORED' ? r.score : {};
  const sport = typeof r.sport_name === 'string' ? r.sport_name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) : '';
  return ohneLeere({
    id: r.id.toLowerCase(), start, ende, tz: tz(r.timezone_offset), sport: sport || 'training', sportId: zahl(r.sport_id, -1, 100_000), state,
    strain: rund(zahl(s.strain, 0, 21), 1), kj: rund(zahl(s.kilojoule, 0, 100_000)), puls: rund(zahl(s.average_heart_rate, 20, 250)), pulsMax: rund(zahl(s.max_heart_rate, 20, 250)),
    distanzM: rund(zahl(s.distance_meter, 0, 1_000_000)),
  });
}

// ── Tageszuordnung ──────────────────────────────────────────────────────────

/** Kalendertag eines Zeitpunkts in der Ortszeit der Messung (`±HH:MM`); ohne Angabe der Berliner Tag. */
export function ortsTag(iso: string, offset?: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso.slice(0, 10);
  if (!offset || !TZ.test(offset)) return tagVon(iso);
  const vz = offset.startsWith('-') ? -1 : 1;
  const [h, m] = offset.slice(1).split(':').map(Number);
  return new Date(t + vz * (h * 60 + m) * 60_000).toISOString().slice(0, 10);
}

/** Schlafdauer in Stunden (leicht + Tiefschlaf + REM, wie der alte Rohbau), eine Nachkommastelle. */
export function schlafStunden(s: WSchlaf): number | undefined {
  const ms = (s.leichtMs ?? 0) + (s.tiefMs ?? 0) + (s.remMs ?? 0);
  return ms > 0 ? Math.round((ms / 3_600_000) * 10) / 10 : undefined;
}

export interface WhoopSpiegelDaten {
  recovery: Record<string, WRecovery>;
  schlaf: Record<string, WSchlaf>;
  zyklen: Record<string, WZyklus>;
  workouts: Record<string, WWorkout>;
}
export type WhoopTag = Partial<Record<VitalFeld, number>> & { strain?: number };

/** Je Tag die Werte, die WHOOP liefert (rein). Hauptschlaf = der Nicht-Nickerchen-Schlaf, der an diesem Tag zuletzt endet. */
export function tageswerte(d: WhoopSpiegelDaten): Record<string, WhoopTag> {
  const raus: Record<string, WhoopTag> = {};
  const haupt = new Map<string, WSchlaf>();
  for (const s of Object.values(d.schlaf)) {
    if (s.nap || s.state !== 'SCORED') continue;
    const t = ortsTag(s.ende, s.tz);
    const b = haupt.get(t);
    if (!b || Date.parse(s.ende) > Date.parse(b.ende)) haupt.set(t, s);
  }
  for (const [t, s] of haupt) { const h = schlafStunden(s); if (h !== undefined) (raus[t] ??= {}).sleep = h; }
  const recJeTag = new Map<string, WRecovery>();
  for (const r of Object.values(d.recovery)) {
    if (r.state !== 'SCORED') continue;
    const s = d.schlaf[r.sleepId];
    const t = s ? ortsTag(s.ende, s.tz) : tagVon(r.am);
    const b = recJeTag.get(t);
    const istHaupt = haupt.get(t)?.id === r.sleepId;
    const bHaupt = !!b && haupt.get(t)?.id === b.sleepId;
    if (!b || (istHaupt && !bHaupt) || (istHaupt === bHaupt && r.am > b.am)) recJeTag.set(t, r);
  }
  for (const [t, r] of recJeTag) {
    const w = (raus[t] ??= {});
    if (r.rec !== undefined) w.rec = r.rec;
    if (r.hrv !== undefined) w.hrv = r.hrv;
    if (r.rhr !== undefined) w.rhr = r.rhr;
  }
  for (const z of Object.values(d.zyklen)) if (z.state === 'SCORED' && z.strain !== undefined) (raus[ortsTag(z.start, z.tz)] ??= {}).strain = z.strain;
  return raus;
}

// ── Vitalwerte: Handwert gewinnt ────────────────────────────────────────────

/**
 * WHOOP-Werte in das Vital-Log der Person einmischen (rein). `abTag` = ältester Tag, den der Spiegel abdeckt: nur dort werden
 * WHOOP-Werte, die WHOOP nicht mehr liefert (gelöscht), wieder entfernt — ältere Tage bleiben, wie sie sind. Handwerte (Feld ohne
 * `whoop`-Markierung) werden nie verändert. `geaendert` = Zahl der berührten Tage.
 */
export function vitalsAnwenden(log: VitalsLog, werte: Record<string, WhoopTag>, abTag: string): { log: VitalsLog; geaendert: number } {
  const neu: VitalsLog = { ...log };
  let geaendert = 0;
  const tage = new Set<string>([...Object.keys(werte), ...Object.keys(log).filter(t => t >= abTag && Object.values(log[t]?.quellen ?? {}).includes('whoop'))]);
  for (const tag of tage) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tag)) continue;
    const alt: DayVitals = log[tag] ?? {};
    const tagNeu: DayVitals = { ...alt, ...(alt.quellen ? { quellen: { ...alt.quellen } } : {}) };
    let anders = false;
    for (const f of VITAL_FELDER) {
      const w = werte[tag]?.[f];
      const q = alt.quellen?.[f];
      if (w !== undefined) {
        // WHOOP ist die Quelle (08.10., Kevin Phase 0): leer, eigener Wert oder Wert aus dem alten Datenexport (`whoop-export`) → der
        // Wert der Schnittstelle. Altbestand ohne Herkunft, der GENAU dem WHOOP-Wert entspricht, bekommt nur die Herkunft (keine
        // Wertänderung); jeder andere Wert ohne Herkunft und jeder `hand`-Wert bleibt (echte Handeingabe wird nie geraten).
        if (alt[f] === undefined || q === 'whoop' || q === 'whoop-export' || (q === undefined && alt[f] === w)) {
          if (alt[f] !== w || q !== 'whoop') { tagNeu[f] = w; (tagNeu.quellen ??= {})[f] = 'whoop'; anders = true; }
        }
      } else if (q === 'whoop' && tag >= abTag) {
        delete tagNeu[f]; delete tagNeu.quellen![f]; anders = true;
      }
    }
    if (!anders) continue;
    if (tagNeu.quellen && !Object.keys(tagNeu.quellen).length) delete tagNeu.quellen;
    if (Object.keys(tagNeu).length) neu[tag] = tagNeu; else delete neu[tag];
    geaendert++;
  }
  return { log: neu, geaendert };
}

// ── Workouts → Sport ────────────────────────────────────────────────────────

export const externeIdVon = (workoutId: string): string => `whoop:${workoutId}`;
const LAUF = /^(running|run|laufen|trail-running|treadmill-running)$/;
/** Ist dieses Workout ein Lauf mit Distanz? (Annahme: `sport_name` „running“ — FAKTEN 5.) */
export const istLauf = (w: WWorkout): boolean => LAUF.test(w.sport) && (w.distanzM ?? 0) >= 100;

const dauerSek = (w: WWorkout) => Math.max(10, Math.round((Date.parse(w.ende) - Date.parse(w.start)) / 1000));

/**
 * Die WHOOP-Workouts in den Sport-Stand einmischen (rein). Idempotent über `externeId`; Felder, die die Person am Eintrag gesetzt hat
 * (Art, Gefühl, Notiz), bleiben. Ein Lauf von Hand am selben Tag mit ±10 % Distanz gilt als derselbe (kein zweiter). Nicht mehr von WHOOP
 * gelieferte Einträge (gelöscht) fallen ab `abTag` weg — nur WHOOP-Einträge.
 */
export function sportAnwenden(stand: SportStand, workouts: readonly WWorkout[], abTag: string): { stand: SportStand; neu: number; geaendert: number; entfernt: number } {
  const laeufe = [...stand.laeufe];
  const training = [...(stand.training ?? [])];
  let neu = 0, geaendert = 0, entfernt = 0;
  const gewollt = new Set<string>();
  for (const w of workouts) {
    if (w.state === 'UNSCORABLE') continue;
    const ext = externeIdVon(w.id);
    gewollt.add(ext);
    const datum = ortsTag(w.start, w.tz);
    if (istLauf(w)) {
      const km = Math.round((w.distanzM! / 1000) * 100) / 100;
      const sek = dauerSek(w);
      // Falls es vorher ein Training war (Sportart geändert): dort heraus.
      const ti = training.findIndex(t => t.externeId === ext);
      if (ti >= 0) { training.splice(ti, 1); entfernt++; }
      const i = laeufe.findIndex(l => l.externeId === ext);
      if (i >= 0) {
        const a = laeufe[i];
        if (a.datum !== datum || a.distanzKm !== km || a.dauerSek !== sek) { laeufe[i] = { ...a, datum, distanzKm: km, dauerSek: sek }; geaendert++; }
        continue;
      }
      if (laeufe.some(l => !l.externeId && l.datum === datum && Math.abs(l.distanzKm - km) <= km * 0.1)) continue; // schon von Hand erfasst
      const l: Lauf = { id: `wh-${w.id}`, datum, distanzKm: km, dauerSek: sek, art: 'locker', quelle: 'whoop', externeId: ext };
      laeufe.push(l); neu++;
      continue;
    }
    const li = laeufe.findIndex(l => l.externeId === ext && l.quelle === 'whoop');
    if (li >= 0) { laeufe.splice(li, 1); entfernt++; }
    const t: TrainingEinheit = Object.fromEntries(Object.entries({
      id: `wh-${w.id}`, datum, sport: w.sport, dauerMin: Math.max(1, Math.round(dauerSek(w) / 60)), strain: w.strain,
      kcal: w.kj !== undefined && w.kj > 0 ? Math.round(w.kj / 4.184) : undefined, pulsSchnitt: w.puls, pulsMax: w.pulsMax,
      distanzKm: w.distanzM ? Math.round((w.distanzM / 1000) * 100) / 100 : undefined, quelle: 'whoop', externeId: ext,
    }).filter(([, v]) => v !== undefined)) as unknown as TrainingEinheit;
    const i = training.findIndex(x => x.externeId === ext);
    if (i >= 0) { if (JSON.stringify(training[i]) !== JSON.stringify(t)) { training[i] = t; geaendert++; } }
    else { training.push(t); neu++; }
  }
  const weg = <T extends { externeId?: string; quelle: string; datum: string }>(l: T[]) => l.filter(x => {
    const raus = x.quelle === 'whoop' && !!x.externeId?.startsWith('whoop:') && x.datum >= abTag && !gewollt.has(x.externeId);
    if (raus) entfernt++;
    return !raus;
  });
  const nachDatum = <T extends { datum: string }>(l: T[]) => [...l].sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
  const l2 = nachDatum(weg(laeufe));
  const t2 = nachDatum(weg(training));
  const s: SportStand = { ...stand, laeufe: l2 };
  if (t2.length) s.training = t2; else delete s.training;
  return { stand: s, neu, geaendert, entfernt };
}
