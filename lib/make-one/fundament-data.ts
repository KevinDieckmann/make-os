// ─── MAKE.One — FUNDAMENT (Gesundheit & Energie) ─────────────────────────────
// Quelle der Wahrheit: Gesundheit_Brain (Desktop/MAKE/Make.Claude).
// Kevin: Kraft 3×/Woche · Journaling täglich · Morgen-/Abend-Routine.
// Whoop-Zielwerte sind Vorschläge (⏳) bis Kevin sie im MAKE Abstimmung fixiert.

export type Person = 'kevin' | 'malin';

// ─── Energie-Rhythmus (Gesundheit_Brain: Verfügbar 07–09 & 17–19, Fokus 09–17)

export interface EnergyWindow {
  from: number;              // Stunde 0–24
  to: number;
  label: string;
  kind: 'available' | 'focus' | 'reset';
  note: string;
}

export const ENERGY_WINDOWS: EnergyWindow[] = [
  { from: 6,  to: 7,  label: 'Aufwachen',      kind: 'reset',     note: 'Wasser 500ml · Journal 5min · Sport 30min' },
  { from: 7,  to: 9,  label: 'Verfügbar',      kind: 'available', note: 'Briefings · MAKE Abstimmung · Team-Check-Ins' },
  { from: 9,  to: 17, label: 'Fokuszeit',      kind: 'focus',     note: 'KEINE Unterbrechungen — nur kritische Eskalationen. Malin schützt.' },
  { from: 17, to: 19, label: 'Verfügbar',      kind: 'available', note: 'Calls · Entscheidungen · MAKE Gespräche' },
  { from: 19, to: 23, label: 'Reset',          kind: 'reset',     note: 'Tages-Review · Morgen vorbereiten · Lesen 30min' },
];

// ─── Routinen & Gewohnheiten ────────────────────────────────────────────────

export interface Habit {
  id: string;
  label: string;
  short: string;
  targetPerWeek: number;     // Ziel-Tage/Woche
  accent: string;
  // 7 Tage Mo–So dieser Woche: true = erledigt, false = offen, null = Zukunft
  week: (boolean | null)[];
  streak: number;            // aktuelle Tages-Streak
}

// Heute = Mi 29.07.2026 → Index 2 (Mo=0). Do–So = Zukunft (null).
export const HABITS: Habit[] = [
  {
    id: 'kraft', label: 'Kraft-Training', short: 'HABIT_01 // KRAFT',
    targetPerWeek: 3, accent: '#00ff66',
    week: [true, false, false, null, null, null, null], streak: 0,
  },
  {
    id: 'journal', label: 'Journaling', short: 'HABIT_02 // JOURNAL',
    targetPerWeek: 7, accent: '#00aaff',
    week: [true, true, false, null, null, null, null], streak: 0,
  },
  {
    id: 'morning', label: 'Morgen-Routine', short: 'HABIT_03 // MORGEN',
    targetPerWeek: 7, accent: '#ffaa00',
    week: [true, true, true, null, null, null, null], streak: 3,
  },
  {
    id: 'evening', label: 'Abend-Routine', short: 'HABIT_04 // ABEND',
    targetPerWeek: 7, accent: '#a78bfa',
    week: [true, false, false, null, null, null, null], streak: 0,
  },
];

// Checklisten (Morgen-/Abend-Routine — Gesundheit_Brain)
export interface ChecklistStep { id: string; label: string; minutes: number; done: boolean; }

export const MORNING_ROUTINE: ChecklistStep[] = [
  { id: 'm1', label: 'Wasser 500ml',        minutes: 1,  done: true },
  { id: 'm2', label: 'Journal',             minutes: 5,  done: true },
  { id: 'm3', label: 'Sport',               minutes: 30, done: false },
  { id: 'm4', label: 'Frühstück',           minutes: 15, done: false },
];

export const EVENING_ROUTINE: ChecklistStep[] = [
  { id: 'e1', label: 'Tages-Review',        minutes: 5,  done: false },
  { id: 'e2', label: 'Morgen vorbereiten',  minutes: 10, done: false },
  { id: 'e3', label: 'Lesen',               minutes: 30, done: false },
];

// ─── Whoop (Gesundheit_Brain: nur hier, NIE in Business-Briefings) ──────────

export interface WhoopMetric {
  key: string;
  label: string;
  unit: string;
  target: string;            // Zielwert (⏳ Vorschlag)
  accent: string;
}

export const WHOOP_METRICS: WhoopMetric[] = [
  { key: 'recovery', label: 'Recovery',  unit: '%',  target: '≥ 60 % · 4 grüne Tage/Wo', accent: '#00ff66' },
  { key: 'sleep',    label: 'Schlaf',    unit: 'h',  target: '≥ 7,0 h',                  accent: '#00aaff' },
  { key: 'hrv',      label: 'HRV',       unit: 'ms', target: 'Trend steigend',           accent: '#a78bfa' },
  { key: 'strain',   label: 'Strain',    unit: '',   target: '10–14 (ausgewogen)',       accent: '#ffaa00' },
];

// Whoop-Live-Snapshot — null bis OAuth-Anbindung steht (developer.whoop.com).
export const WHOOP_SNAPSHOT: {
  connected: boolean;
  lastSync: string | null;
  values: Record<string, number | null>;
} = {
  connected: false,
  lastSync: null,
  values: { recovery: null, sleep: null, hrv: null, strain: null },
};
