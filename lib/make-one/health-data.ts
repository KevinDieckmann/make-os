// ─── MAKE OS — Gesundheit (privat · MAKE.One) ───────────────────────────────
// Feste Inhalte aus der Zeit vor den Daten je Person — Paket A1 (Branch privat-raus-koerper) zieht sie in die Daten je Person
// (lib/gesundheit/koerper.ts). STRUKTUR & TRACKING — KEINE ärztliche Beratung. Der frühere Nordstern-Export ist entfernt (08.10.
// abends, Paket A2: der Nordstern ist ein Bestand des Haushalts, lib/planung/nordstern.ts) — beim Zusammenführen mit A1 die A1-Seite
// nehmen und tests/privat-neutral.test.ts laufen lassen.

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
  { name: 'Bandscheibenvorfall', sev: 65, tone: 'crit', status: 'Reha-Phase',
    note: 'Diagnose bestätigt (30.07.), Spritze 31.07. Jetzt: Physio, Mobilität, wirbelsäulen-sicherer Aufbau in Stufen — kein Ego-Training.' },
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

// Routinen, Wochen-Rhythmus und Gesundheitsziele (ROUTINEN, ROUTINE_ITEMS, WOCHE, HGOALS) sind seit 08.10. abends entfernt
// (Fragebogen Teil 3, Paket A2): es waren Inhalte einer echten Person. Routinen kommen nur noch aus dem Bestand `routinen`
// (eine leere Instanz startet ohne), WOCHE und HGOALS hatte niemand mehr gelesen.

// Zusammenhänge (was worauf wirkt) — für das „Ich sehe, warum"-Gefühl
export const ZUSAMMENHAENGE = [
  'Stress ↑ → Kratzen → Psoriasis-Schub  (und: Stress ↑ → Epilepsie-Risiko ↑)',
  'Schlaf fest → Epilepsie stabil  (deine größte Schutz-Stärke)',
  'Unregelmäßig essen → Entzündung ↑ → Haut schlechter',
  'Bandscheibe → Bewegung spine-safe, kein Ego-Training — Aufbau in Stufen',
];

// Bis 23.09. stand hier noch „Morgen (31.07.) ist ein großer medizinischer
// Tag" — acht Wochen lang. Ein Satz mit Datum gehört nicht in eine Konstante.
export const CARE_NOTE = 'Struktur & Tracking, keine ärztliche Beratung — deine Ärzte führen. Beim Cannabis-Schnitt: mit dem Neurologen, weil Schlaf deine Anfallsschwelle schützt.';
