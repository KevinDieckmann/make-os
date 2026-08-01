// ─── MAKE OS — Gesundheit (privat · MAKE.One) ───────────────────────────────
// Kevins echte, selbst berichtete Daten + Whoop-Export. STRUKTUR & TRACKING —
// KEINE ärztliche Beratung; seine Ärzte führen. Nordstern: mehr Ruhe.

export const NORTHSTAR = 'Mehr Ruhe — den Körper planbar aufbauen, den Kopf runterfahren.';

// Whoop-Gerätedaten (Export 30.07.2026, 246 Messtage)
export const WHOOP = {
  rec: 74, recAvg: 67,      // Recovery heute / Ø30T
  rhr: 51, rhrAvg: 58,      // Ruhepuls
  hrv: 90, hrvAvg: 66,      // HRV (ms)
  sleepLast: 5.2, sleepAvg: 7.8, sleepPerf: 78, // Schlaf letzte Nacht / Ø / Leistung %
  spo2: 94.3, resp: 14.2,
  stand: '30.07.2026',
};

// tone: 'good' (Stärke), 'watch' (dranbleiben), 'crit' (akut)
export interface Beschwerde { name: string; sev: number; tone: 'good' | 'watch' | 'crit'; status: string; note: string; }
export const BESCHWERDEN: Beschwerde[] = [
  { name: 'Schuppenflechte (Psoriasis)', sev: 70, tone: 'crit', status: 'aktiver Schub',
    note: 'Beine ~60 %, Rücken 3–4 Stellen, beide Ellbogen (links schlimmer). Zyklus: Anspannung → Kratzen → Juckreiz.' },
  { name: 'Bandscheibenvorfall', sev: 65, tone: 'crit', status: 'Spritze Fr 31.07',
    note: 'Diagnose bestätigt. Danach: schonen, Physio, wirbelsäulen-sicherer Aufbau. Kein Sport direkt nach der Spritze.' },
  { name: 'Nagelpilz', sev: 25, tone: 'watch', status: 'klein',
    note: 'Hautarzt-Termin für Diagnose + Antimykotikum, dann dranbleiben bis weg.' },
  { name: 'Epilepsie', sev: 20, tone: 'good', status: 'anfallsfrei · stabil',
    note: 'Haupt-Trigger = Schlafmangel, gut gemanagt. Anfall kam nach ~12 Wochen Dauerstress → Warnsignal ernst nehmen.' },
];

export interface Hebel { name: string; score: number; tone: 'good' | 'watch' | 'crit'; note: string; }
export const HEBEL: Hebel[] = [
  { name: 'Ernährung', score: 38, tone: 'crit', note: 'Dein aktiver Hebel gegen Psoriasis: regelmäßig + anti-entzündlich (mediterran). Isst aktuell unregelmäßig.' },
  { name: 'Stress', score: 45, tone: 'crit', note: 'Der Master-Hebel — triggert Psoriasis UND Epilepsie. Anspannung früh bemerken statt aushalten.' },
  { name: 'Bewegung & Ergonomie', score: 55, tone: 'watch', note: 'Für die Bandscheibe: spine-safe Reha + Sitzpausen. Du bewegst dich mehr, als dein Selbstbild sagt.' },
  { name: 'Schlaf', score: 76, tone: 'good', note: 'STÄRKE — Ø 7,8 h, fest. Schützt die Epilepsie. Hebel ist Konstanz, nicht Erholungsfähigkeit.' },
  { name: 'Alkohol', score: 82, tone: 'good', note: 'Kein Thema — nur ~2×/Monat.' },
  { name: 'Cannabis-Cut', score: 40, tone: 'watch', note: 'Ziel: sauberer Ausstieg — mit dem Neurologen (Schlaf schützen, Anfallsschwelle). Ersatz für die Stress-Funktion aufbauen.' },
];

// Aufbau-Stufenplan (Kevins eigener Weg — NICHT Hyrox/Marathon, das ist Malin)
export interface Stufe { phase: string; name: string; desc: string; state: 'now' | 'next' | 'later'; }
export const AUFBAU: Stufe[] = [
  { phase: '0', name: 'Reha & Mobilität', desc: 'Nach der Spritze — schonen, Physio, Gehen, Mobilität', state: 'now' },
  { phase: '1', name: 'Core & Stabilität', desc: 'Rumpf aufbauen, wirbelsäulen-sicher', state: 'next' },
  { phase: '2', name: 'Kraft-Fundament', desc: '22 J. Handball & Kraft — zurück zur Basis', state: 'later' },
  { phase: '3', name: 'Conditioning · Navy', desc: 'Ausdauer & Kondition, „aus mir eine Maschine"', state: 'later' },
  { phase: '4', name: 'Boxen · Paddeln', desc: 'Kampf/Skill + Draußen, mit Team/Connect', state: 'later' },
];

export const ROUTINEN = {
  morgen: ['Journal · 5 Min', 'Supplements nehmen', 'Kurz Licht/Bewegung'],
  abend: ['Lesen · 30 Min (ohne Bildschirm)', 'Reha & Mobilität · 20 Min', 'Shutdown / runterfahren'],
  supps: ['Vitamin D', 'Omega-3', 'Magnesium', 'Zink', 'Vitamin B-Komplex', 'Probiotika', 'Kurkuma', 'Vitamin C', 'Eisen', 'Kollagen', 'Ashwagandha'],
};

// Abhakbare Tages-Routine (mit Tracking) — IDs stabil für die Persistenz.
export interface RoutineItem { id: string; label: string; when: 'morgen' | 'abend'; }
export const ROUTINE_ITEMS: RoutineItem[] = [
  { id: 'journal', label: 'Journal · 5 Min', when: 'morgen' },
  { id: 'supps', label: 'Supplements genommen', when: 'morgen' },
  { id: 'licht', label: 'Morgenlicht / kurz Bewegung', when: 'morgen' },
  { id: 'essen', label: 'Regelmäßig & anti-entzündlich gegessen', when: 'morgen' },
  { id: 'reha', label: 'Reha & Mobilität · 20 Min', when: 'abend' },
  { id: 'lesen', label: 'Lesen · 30 Min (ohne Bildschirm)', when: 'abend' },
  { id: 'shutdown', label: 'Shutdown / bewusst runtergefahren', when: 'abend' },
];

// Wochen-Rhythmus (echt) — Fokuszeit 09–17 schützen, Reha täglich, feste Rituale.
export type BlockKind = 'health' | 'focus' | 'business' | 'ruhe' | 'move';
export interface WeekBlock { t: string; name: string; kind: BlockKind; }
export interface WeekDay { day: string; label: string; blocks: WeekBlock[]; }
export const WOCHE: WeekDay[] = [
  { day: 'Mo', label: 'Montag', blocks: [
    { t: '09:30', name: 'KEMARIS Check-In (Kevin × Frank)', kind: 'business' },
    { t: '09–17', name: 'Fokuszeit geschützt', kind: 'focus' },
    { t: 'abends', name: 'MAKE Abstimmung mit Malin', kind: 'ruhe' },
    { t: 'täglich', name: 'Reha & Mobilität', kind: 'health' },
  ]},
  { day: 'Di', label: 'Dienstag', blocks: [
    { t: '07:00', name: 'Running Club (locker, spine-safe)', kind: 'move' },
    { t: '09–17', name: 'Fokuszeit geschützt', kind: 'focus' },
    { t: 'täglich', name: 'Reha & Mobilität', kind: 'health' },
  ]},
  { day: 'Mi', label: 'Mittwoch', blocks: [
    { t: '09–17', name: 'Fokuszeit geschützt', kind: 'focus' },
    { t: 'nach Bedarf', name: 'Arzt / Reha-Termine', kind: 'health' },
    { t: 'täglich', name: 'Reha & Mobilität', kind: 'health' },
  ]},
  { day: 'Do', label: 'Donnerstag', blocks: [
    { t: 'vorm.', name: 'Frank × Kevin · Bullshit-freie Zone', kind: 'business' },
    { t: '09–17', name: 'Fokuszeit geschützt', kind: 'focus' },
    { t: 'täglich', name: 'Reha & Mobilität', kind: 'health' },
  ]},
  { day: 'Fr', label: 'Freitag', blocks: [
    { t: '10:00', name: 'CapOS TownHall', kind: 'business' },
    { t: 'morgens', name: 'MAKE Reflexion + Weekly Review', kind: 'ruhe' },
    { t: 'täglich', name: 'Reha & Mobilität', kind: 'health' },
  ]},
  { day: 'Sa', label: 'Samstag', blocks: [
    { t: 'frei', name: 'Bewegung/Gehen · Aufbau (schonend)', kind: 'move' },
    { t: 'ruhe', name: 'Erholung — Kopf runterfahren', kind: 'ruhe' },
  ]},
  { day: 'So', label: 'Sonntag', blocks: [
    { t: '19:00', name: 'Sunday Dinner mit Malin (ohne Handy)', kind: 'ruhe' },
    { t: 'ruhe', name: 'Reflexion & Regeneration', kind: 'ruhe' },
  ]},
];

export interface HGoal { title: string; why: string; progress: number; }
export const HGOALS: HGoal[] = [
  { title: 'Mehr Ruhe', why: 'Der Nordstern — Anspannung runter, damit Psoriasis & Epilepsie ruhig bleiben.', progress: 35 },
  { title: 'Psoriasis beruhigen', why: 'Über Stress + regelmäßiges, anti-entzündliches Essen — nicht über „mehr Disziplin".', progress: 30 },
  { title: 'Cannabis sauber cutten', why: 'Mit dem Neurologen, Schlaf schützen, Ersatz für die Stress-Funktion.', progress: 40 },
  { title: 'Körper aufbauen — „Maschine"', why: 'Spine-safe Stufenplan, Sport als Lebensstil, am liebsten mit Team/Connect.', progress: 20 },
  { title: 'Sozialen Kontakt zurück', why: 'Die Scham über die Haut hält dich vom Sport ab — genau da liegt der soziale Verlust.', progress: 25 },
];

// Zusammenhänge (was worauf wirkt) — für das „Ich sehe, warum"-Gefühl
export const ZUSAMMENHAENGE = [
  'Stress ↑ → Kratzen → Psoriasis-Schub  (und: Stress ↑ → Epilepsie-Risiko ↑)',
  'Schlaf fest → Epilepsie stabil  (deine größte Schutz-Stärke)',
  'Unregelmäßig essen → Entzündung ↑ → Haut schlechter',
  'Bandscheibe → Bewegung spine-safe, kein Ego-Training — Aufbau in Stufen',
];

export const CARE_NOTE = 'Struktur & Tracking, keine ärztliche Beratung — deine Ärzte führen. Morgen (31.07) ist ein großer medizinischer Tag: Spritze + Cannabis-Entscheidung mit dem Neurologen. Nicht noch mehr draufpacken.';
