// ─── MAKE OS — Gesundheit: Routinen-Vorlagen, Woche, Ziele (privat · MAKE.One) ─────────────────────
// Seit 08.10. abends (Fragebogen Teil 3) stehen Körper-Profil, Beschwerden, Hebel, Stufenplan, Zusammenhänge und
// Hinweistext nicht mehr hier, sondern als Daten je Person (lib/gesundheit/koerper.ts). Routinen, Woche und Ziele: Paket A2.

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
    { t: '09:30', name: 'KEMARIS Check-In (Team)', kind: 'business' },
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
    { t: 'vorm.', name: 'Jour fixe Finanzen · Bullshit-freie Zone', kind: 'business' },
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
