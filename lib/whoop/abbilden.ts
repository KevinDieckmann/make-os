// ─── WHOOP — Abbildung in MAKE OS (rein, getestet, 08.10.2026) ──────────────────────────────────────────────────────────
// Aus den Rohdaten der API v2 (Felder: https://developer.whoop.com/api, FAKTEN 5) wird:
//   · der schlanke Spiegel `whoop-stand--<person>` (nur, was MAKE OS braucht — Zahlen und Zeiten, keine Namen),
//   · je Tag die Vitalwerte (`vitals--<person>`: Recovery, Schlaf, HRV, Ruhepuls) — **Handwert gewinnt**: ein Feld wird nur geschrieben,
//     wenn es leer ist oder schon von WHOOP stammt (`quellen[feld] === 'whoop'`, seit 08.10. auch `whoop-export` = alter Datenexport:
//     „Schnittstelle gewinnt“); ohne Markierung gilt es als von Hand und bleibt unberührt — auch wenn es GENAU dem WHOOP-Wert entspricht
//     (Gegenprüfung 08.10.: ein vor dem 08.10. aus der WHOOP-App abgetippter Morgen-Check ist ebenso gleich; markiert, würde ihn ein
//     Löschen/Neubewerten bei WHOOP entfernen bzw. überschreiben — nie geraten). Die Gleichheits-Regel gilt nur beim Einlesen des
//     Datenexports (lib/whoop-export.ts `einmischen`, ausdrückliche Handlung der Person),
//   · Workouts im Sport-Bestand: Läufe mit Distanz als `Lauf`, alles andere als `TrainingEinheit` — immer `quelle: 'whoop'` +
//     `externeId: 'whoop:<uuid>'` (idempotent, nie doppelt; ein Lauf von Hand am selben Tag mit ±10 % Distanz zählt als derselbe).
// Tageszuordnung (Annahme, FAKTEN 5): Schlaf/Recovery = Tag des Aufwachens in Ortszeit (`timezone_offset`), Workouts = Starttag,
// Zyklen = Starttag — beginnt ein Zyklus ab 18 Uhr Ortszeit, zählt er zum FOLGENDEN Tag (09.10., `zyklusTag`).
// Nur `SCORED` zählt (PENDING_SCORE/UNSCORABLE tragen keine Werte).
//
// 09.10. (Kevin: „Strain wird nicht angezeigt“ → „mit allen Daten, die du bekommen kannst“): der Spiegel trägt jetzt alle sinnvollen
// v2-Größen (Schlafbedarf, Atemfrequenz, Konsistenz, Störungen, Schritte, Herzfrequenz-Zonen …, Felder: https://developer.whoop.com/api ·
// https://developer.whoop.com/docs/developing/user-data/cycle), und die Tageswerte gehen über `MESS_FELDER` (Kern + Zusatz) in die
// Vitalwerte — Handwert gewinnt je Feld wie bisher. Kein neuer Scope (weiter ohne `read:body_measurement`).

import type { DayVitals, MessFeld, VitalsLog } from '@/lib/vitals';
import { MESS_FELDER } from '@/lib/vitals';
import { tagVon } from '@/lib/zeit';
import type { SportStand, Lauf, TrainingEinheit } from '@/lib/sport/modell';

// ── Spiegel-Einträge ────────────────────────────────────────────────────────

export type Bewertung = 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
/** `kal` = WHOOP kalibriert noch (`user_calibrating`, die ersten Tage nach dem Einrichten — Werte vorläufig). */
export interface WRecovery { sleepId: string; cycleId?: number; am: string; state: Bewertung; rec?: number; hrv?: number; rhr?: number; spo2?: number; hautTemp?: number; kal?: true }
/**
 * Schlaf: Phasen (ms), Leistung/Effizienz/Konsistenz (%), Atemfrequenz, Störungen, Schlafzyklen und der Schlafbedarf (`sleep_needed`, ms:
 * `bedarfMs` = Basis + Schuld + Belastung + Nickerchen, nie unter 0; `schuldMs` = Anteil aus Schlafschuld).
 */
export interface WSchlaf {
  id: string; start: string; ende: string; tz?: string; nap: boolean; state: Bewertung;
  leichtMs?: number; tiefMs?: number; remMs?: number; wachMs?: number; leistung?: number; effizienz?: number;
  konsistenz?: number; atem?: number; stoerungen?: number; zyklen?: number; bedarfMs?: number; schuldMs?: number;
}
/** Zyklus: Strain, Energie (kJ), Ø/max Puls; `schritte` = `step_count` (oben am Zyklus, im laufenden Zyklus „bisher“). */
export interface WZyklus { id: number; start: string; ende?: string; tz?: string; state: Bewertung; strain?: number; kj?: number; puls?: number; pulsMax?: number; schritte?: number }
/** Workout: dazu Höhenmeter, Anteil aufgezeichnet (%) und die Zeit je Herzfrequenz-Zone 0–5 (`zonenMs`, immer sechs Werte in ms). */
export interface WWorkout {
  id: string; start: string; ende: string; tz?: string; sport: string; sportId?: number; state: Bewertung;
  strain?: number; kj?: number; puls?: number; pulsMax?: number; distanzM?: number; hoeheM?: number; erfasst?: number; zonenMs?: number[];
}

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
    kal: s.user_calibrating === true ? (true as const) : undefined,
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
  // Schlafbedarf (`sleep_needed`): die vier Teile addiert; der Nickerchen-Teil darf negativ sein (ein Nickerchen senkt den Bedarf).
  const b = istObj(sc.sleep_needed) ? sc.sleep_needed : null;
  const teil = (k: string, min = 0) => (b ? zahl(b[k], min, 48 * 3_600_000) : undefined);
  const basis = teil('baseline_milli');
  const schuld = teil('need_from_sleep_debt_milli'), last = teil('need_from_recent_strain_milli'), nap = teil('need_from_recent_nap_milli', -48 * 3_600_000);
  const bedarf = basis === undefined ? undefined : Math.max(0, basis + (schuld ?? 0) + (last ?? 0) + (nap ?? 0));
  return ohneLeere({
    id: r.id.toLowerCase(), start, ende, tz: tz(r.timezone_offset), nap: r.nap === true, state,
    leichtMs: ms('total_light_sleep_time_milli'), tiefMs: ms('total_slow_wave_sleep_time_milli'), remMs: ms('total_rem_sleep_time_milli'), wachMs: ms('total_awake_time_milli'),
    leistung: rund(zahl(sc.sleep_performance_percentage, 0, 100)), effizienz: rund(zahl(sc.sleep_efficiency_percentage, 0, 100)),
    konsistenz: rund(zahl(sc.sleep_consistency_percentage, 0, 100)), atem: rund(zahl(sc.respiratory_rate, 3, 60), 1),
    stoerungen: rund(zahl(p.disturbance_count, 0, 1000)), zyklen: rund(zahl(p.sleep_cycle_count, 0, 100)),
    bedarfMs: rund(bedarf), schuldMs: rund(schuld),
  });
}

export function zyklusAus(r: unknown): WZyklus | null {
  if (!istObj(r)) return null;
  const id = zahl(r.id, 1, Number.MAX_SAFE_INTEGER); const start = zeit(r.start);
  if (!id || !Number.isInteger(id) || !start) return null;
  const state = bewertung(r.score_state);
  const s = istObj(r.score) && state === 'SCORED' ? r.score : {};
  // `step_count` steht oben am Zyklus (nicht in `score`) und zählt im laufenden Zyklus „bisher“ — darum unabhängig von `score_state`.
  const schritte = state === 'UNSCORABLE' ? undefined : zahl(r.step_count, 0, 500_000);
  return ohneLeere({ id, start, ende: zeit(r.end), tz: tz(r.timezone_offset), state, strain: rund(zahl(s.strain, 0, 21), 1), kj: rund(zahl(s.kilojoule, 0, 100_000)), puls: rund(zahl(s.average_heart_rate, 20, 250)), pulsMax: rund(zahl(s.max_heart_rate, 20, 250)), schritte: rund(schritte) });
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
    distanzM: rund(zahl(s.distance_meter, 0, 1_000_000)), hoeheM: rund(zahl(s.altitude_gain_meter, 0, 20_000)), erfasst: rund(zahl(s.percent_recorded, 0, 100)),
    zonenMs: zonenAus(s.zone_durations),
  });
}

const ZONEN = ['zone_zero_milli', 'zone_one_milli', 'zone_two_milli', 'zone_three_milli', 'zone_four_milli', 'zone_five_milli'] as const;
/** Zeit je Herzfrequenz-Zone 0–5 in ms — nur, wenn mindestens eine Zone einen Wert trägt (leeres Objekt = keine Angabe). */
export function zonenAus(z: unknown): number[] | undefined {
  if (!istObj(z)) return undefined;
  const w = ZONEN.map(k => zahl(z[k], 0, 48 * 3_600_000));
  if (w.every(x => x === undefined)) return undefined;
  return w.map(x => Math.round(x ?? 0));
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

/**
 * Tag eines Zyklus (rein, Annahme 09.10.): der Ortstag des Starts — beginnt der Zyklus ab 18 Uhr Ortszeit, der FOLGENDE Tag. Ob ein WHOOP-
 * Zyklus mit dem Einschlafen oder dem Aufwachen beginnt, sagt die Doku nicht (https://developer.whoop.com/docs/developing/user-data/cycle:
 * „Physiological Cycle … rather than calendar days“). Beide Lesarten landen so auf dem Tag, den der Zyklus beschreibt: ein Start am Abend
 * (Einschlafen) gehört zum nächsten Tag, ein Start am Morgen (Aufwachen) zum selben. Vorher (bis 09.10.) zählte ein Zyklus, der vor
 * Mitternacht begann, zum Vortag — der Strain von heute stand dann bei gestern.
 */
export function zyklusTag(z: Pick<WZyklus, 'start' | 'tz'>): string {
  const tag = ortsTag(z.start, z.tz);
  const t = Date.parse(z.start);
  if (!Number.isFinite(t)) return tag;
  let stunde: number;
  if (z.tz && TZ.test(z.tz)) {
    const vz = z.tz.startsWith('-') ? -1 : 1;
    const [h, m] = z.tz.slice(1).split(':').map(Number);
    stunde = new Date(t + vz * (h * 60 + m) * 60_000).getUTCHours();
  } else {
    stunde = Number(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(new Date(t)));
  }
  if (stunde < 18) return tag;
  const d = new Date(`${tag}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
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
/** Je Tag die Werte, die WHOOP liefert — dieselben Kennungen wie in den Vitalwerten (`MessFeld`, lib/vitals.ts). */
export type WhoopTag = Partial<Record<MessFeld, number>>;

const stunden = (ms: number | undefined, stellen = 2): number | undefined => (ms === undefined ? undefined : Math.round((ms / 3_600_000) * 10 ** stellen) / 10 ** stellen);
/** Nur gesetzte Werte übernehmen (der Tag bleibt schlank, nie eine 0 als „keine Angabe“). */
const setze = (w: WhoopTag, werte: WhoopTag) => { for (const [k, v] of Object.entries(werte)) if (typeof v === 'number' && Number.isFinite(v)) w[k as MessFeld] = v; };

/**
 * Je Tag die Werte, die WHOOP liefert (rein). Hauptschlaf = der Nicht-Nickerchen-Schlaf, der an diesem Tag zuletzt endet — von ihm
 * kommen Dauer, Phasen (h, zwei Nachkommastellen), Bedarf (h), Leistung/Konsistenz/Effizienz (%), Atemfrequenz und Störungen. Von der
 * Recovery dieses Schlafs: Recovery, HRV, Ruhepuls, SpO2, Hauttemperatur. Vom Zyklus des Tages (`zyklusTag`): Strain, Energie (kcal),
 * Schritte.
 */
export function tageswerte(d: WhoopSpiegelDaten): Record<string, WhoopTag> {
  const raus: Record<string, WhoopTag> = {};
  const haupt = new Map<string, WSchlaf>();
  for (const s of Object.values(d.schlaf)) {
    if (s.nap || s.state !== 'SCORED') continue;
    const t = ortsTag(s.ende, s.tz);
    const b = haupt.get(t);
    if (!b || Date.parse(s.ende) > Date.parse(b.ende)) haupt.set(t, s);
  }
  for (const [t, s] of haupt) {
    const w = (raus[t] ??= {});
    setze(w, {
      sleep: schlafStunden(s), phaseLeicht: stunden(s.leichtMs), phaseTief: stunden(s.tiefMs), phaseRem: stunden(s.remMs), phaseWach: stunden(s.wachMs),
      schlafBedarf: stunden(s.bedarfMs, 1), schlafLeistung: s.leistung, schlafKonsistenz: s.konsistenz, schlafEffizienz: s.effizienz, atem: s.atem, stoerungen: s.stoerungen,
    });
    if (!Object.keys(w).length) delete raus[t];
  }
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
    setze((raus[t] ??= {}), { rec: r.rec, hrv: r.hrv, rhr: r.rhr, spo2: r.spo2, hautTemp: r.hautTemp });
    if (!Object.keys(raus[t]).length) delete raus[t];
  }
  // Je Tag der jüngste Zyklus (zwei Zyklen auf einem Tag kommen nur bei Zeitzonenwechseln vor).
  const zJeTag = new Map<string, WZyklus>();
  for (const z of Object.values(d.zyklen)) {
    if (z.state === 'UNSCORABLE') continue;
    const t = zyklusTag(z); const b = zJeTag.get(t);
    if (!b || Date.parse(z.start) > Date.parse(b.start)) zJeTag.set(t, z);
  }
  for (const [t, z] of zJeTag) {
    const bewertet = z.state === 'SCORED';
    setze((raus[t] ??= {}), {
      strain: bewertet ? z.strain : undefined,
      kcal: bewertet && z.kj !== undefined && z.kj > 0 ? Math.round(z.kj / 4.184) : undefined,
      schritte: z.schritte,
    });
    if (!Object.keys(raus[t]).length) delete raus[t];
  }
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
    for (const f of MESS_FELDER) {
      const w = werte[tag]?.[f];
      const q = alt.quellen?.[f];
      if (w !== undefined) {
        // WHOOP ist die Quelle (08.10., Kevin Phase 0): leer, eigener Wert oder Wert aus dem alten Datenexport (`whoop-export`) → der
        // Wert der Schnittstelle. Jeder Wert ohne Herkunft (auch ein gleicher — Gegenprüfung 08.10.) und jeder `hand`-Wert bleibt.
        if (alt[f] === undefined || q === 'whoop' || q === 'whoop-export') {
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

/** Uhrzeit eines Zeitpunkts in der Ortszeit der Messung („HH:MM“); ohne Angabe Berliner Zeit (09.10.). */
export function ortsUhrzeit(iso: string, offset?: string): string | undefined {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return undefined;
  if (offset && TZ.test(offset)) {
    const vz = offset.startsWith('-') ? -1 : 1;
    const [h, m] = offset.slice(1).split(':').map(Number);
    return new Date(t + vz * (h * 60 + m) * 60_000).toISOString().slice(11, 16);
  }
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t));
}

/** Was die Person an einer importierten Einheit setzt — ein erneuter Import lässt es stehen (09.10.). */
const PERSON_FELDER = ['art', 'gefuehl', 'notiz'] as const;

/** Die Messwerte eines Workouts für Lauf/Training (09.10.): Strain, kcal, Puls, Minuten je Zone, Höhenmeter — nur gesetzte. */
function messwerte(w: WWorkout): Pick<Lauf, 'strain' | 'kcal' | 'pulsSchnitt' | 'pulsMax' | 'zonenMin' | 'hoeheM'> {
  return Object.fromEntries(Object.entries({
    strain: w.strain, kcal: w.kj !== undefined && w.kj > 0 ? Math.round(w.kj / 4.184) : undefined, pulsSchnitt: w.puls, pulsMax: w.pulsMax,
    zonenMin: w.zonenMs && w.zonenMs.some(x => x > 0) ? w.zonenMs.map(x => Math.round((x / 60_000) * 10) / 10) : undefined,
    hoeheM: w.hoeheM !== undefined && w.hoeheM >= 1 ? Math.round(w.hoeheM) : undefined,
  }).filter(([, v]) => v !== undefined));
}
const MESS_SCHLUESSEL = ['strain', 'kcal', 'pulsSchnitt', 'pulsMax', 'zonenMin', 'hoeheM'] as const;
const sortiert = (o: object) => JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))));
/** Gleiche Messwerte? (Reihenfolge der Schlüssel egal.) */
const messGleich = (a: Partial<Lauf>, b: Partial<Lauf>) => MESS_SCHLUESSEL.every(k => JSON.stringify(a[k]) === JSON.stringify(b[k]));

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
      const mw = messwerte(w);
      const uz = ortsUhrzeit(w.start, w.tz);
      const i = laeufe.findIndex(l => l.externeId === ext);
      if (i >= 0) {
        const a = laeufe[i];
        if (a.datum !== datum || a.distanzKm !== km || a.dauerSek !== sek || a.uhrzeit !== uz || !messGleich(a, mw)) {
          // Art, Gefühl, Notiz der Person bleiben; die Messwerte gehören WHOOP (fehlt einer jetzt, fällt er weg).
          const neu: Lauf = { ...a, datum, distanzKm: km, dauerSek: sek };
          for (const k of MESS_SCHLUESSEL) delete neu[k];
          delete neu.uhrzeit;
          laeufe[i] = { ...neu, ...(uz ? { uhrzeit: uz } : {}), ...mw }; geaendert++;
        }
        continue;
      }
      if (laeufe.some(l => !l.externeId && l.datum === datum && Math.abs(l.distanzKm - km) <= km * 0.1)) continue; // schon von Hand erfasst
      const l: Lauf = { id: `wh-${w.id}`, datum, distanzKm: km, dauerSek: sek, art: 'locker', quelle: 'whoop', externeId: ext, ...(uz ? { uhrzeit: uz } : {}), ...mw };
      laeufe.push(l); neu++;
      continue;
    }
    const li = laeufe.findIndex(l => l.externeId === ext && l.quelle === 'whoop');
    if (li >= 0) { laeufe.splice(li, 1); entfernt++; }
    const i = training.findIndex(x => x.externeId === ext);
    // „Zählt als“, Gefühl und Notiz gehören der Person — sie bleiben bei jedem Abgleich stehen (09.10.).
    const person = i >= 0 ? Object.fromEntries(PERSON_FELDER.filter(k => training[i][k] !== undefined).map(k => [k, training[i][k]])) : {};
    const t: TrainingEinheit = Object.fromEntries(Object.entries({
      id: `wh-${w.id}`, datum, sport: w.sport, dauerMin: Math.max(1, Math.round(dauerSek(w) / 60)), ...messwerte(w),
      distanzKm: w.distanzM ? Math.round((w.distanzM / 1000) * 100) / 100 : undefined, quelle: 'whoop', externeId: ext,
      uhrzeit: ortsUhrzeit(w.start, w.tz), ...person,
    }).filter(([, v]) => v !== undefined)) as unknown as TrainingEinheit;
    // Vergleich unabhängig von der Reihenfolge der Schlüssel (der Säuberer ordnet anders als diese Abbildung — sonst zählte jeder Lauf
    // jedes Training als „geändert“, 09.10.).
    if (i >= 0) { if (sortiert(training[i]) !== sortiert(t)) { training[i] = t; geaendert++; } }
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
