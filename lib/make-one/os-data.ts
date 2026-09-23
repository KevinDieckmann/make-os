// ─── MAKE OS — Kern-Datenschicht ────────────────────────────────────────────
// Ein Betriebssystem-Zustand: MSI-Masterscore + Module + Fokus + Lebensrad.
// Werte aktuell aus dem Brain abgeleitet; später live aus den Connectoren.

// „Klar"-Palette · DARK — kühl, präzise, ein Petrol-Akzent. Spiegelt globals.css.
export const THEME = {
  // 24.09. (Kevin: „N26 und Whoop"): dieselben Werte wie das Design-System —
  // weichere Flächen, Haarlinien fast unsichtbar, Zustandsfarben leuchtend,
  // die eingebettete Schrift. Alte Seiten erben das ohne Umbau.
  void: '#0B0E10', panel: '#161B1F', panel2: '#1B2126',
  line: 'rgba(255,255,255,.07)', lineSoft: 'rgba(255,255,255,.05)', lineHot: 'rgba(88,217,205,.34)',
  ink: '#E8ECEA', inkDim: '#A2ADB0', muted: '#6E7A7D',
  accent: '#58D9CD', accentSoft: 'rgba(88,217,205,.14)', accentInk: '#7FE6DC',
  amber: '#FFC93C', crit: '#FF5C5C',
  track: 'rgba(255,255,255,.08)',
  // 24.09.: T.mono trug Labels und Zahlen — als Terminal-Schrift. Jetzt die Display-Schrift.
  mono: 'var(--schrift-display),-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif',
  sans: 'var(--schrift-text),-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif',
};

// Farb-Logik für Scores (semantisch, ruhig)
export function scoreColor(v: number): string {
  if (v >= 60) return '#3DE28B';
  if (v >= 40) return THEME.amber;
  return THEME.crit;
}

// ─── FOKUS JETZT — die #1-Priorität ─────────────────────────────────────────
export interface FocusNow { level: 'crit' | 'high'; title: string; why: string; }
export const FOCUS_NOW: FocusNow = {
  level: 'crit',
  title: 'Alex: Rückfragen Market Traction beantworten',
  why: 'Echte Mail (28.07) — Zahlen für CapOS/Investoren. F&F-Launch in 3 Tagen (01.08.).',
};

// ─── MSI — MAKE Souveränitäts-Index (0–100, wie KSI) ────────────────────────
export interface MsiPillar { key: string; label: string; weight: number; score: number; hint: string; }
export const MSI_PILLARS: MsiPillar[] = [
  { key: 'health',   label: 'Gesundheit & Energie', weight: 0.25, score: 35, hint: 'Lebensrad · Routinen · Mindset' },
  { key: 'business', label: 'Business-Performance',  weight: 0.25, score: 40, hint: 'KSI 45 · KD Management · F&F' },
  { key: 'planning', label: 'Planung & Execution',   weight: 0.20, score: 55, hint: 'Meilensteine · Tasks · Fokuszeit' },
  { key: 'finance',  label: 'Finanzen',              weight: 0.15, score: 45, hint: 'Runway · Haushalt · ETF' },
  { key: 'social',   label: 'Beziehung & Team',      weight: 0.15, score: 72, hint: 'EBA 74 · Team-Deliverables' },
];
export function computeMsi(pillars: MsiPillar[] = MSI_PILLARS): number {
  const total = pillars.reduce((s, p) => s + p.weight, 0) || 1;
  return Math.round(pillars.reduce((s, p) => s + p.score * p.weight, 0) / total);
}
export function msiLabel(v: number): string {
  if (v >= 80) return 'Souverän';
  if (v >= 60) return 'Solide';
  if (v >= 40) return 'Verbesserungsfähig';
  return 'Kritisch';
}

// ─── Module-Kacheln ─────────────────────────────────────────────────────────
export interface ModuleCell {
  dom: string; val: string; sub: string; subTone?: 'att' | 'crit';
  score?: number; tag?: { text: string; tone: 'att' | 'ok' }; href?: string;
}
export const MODULES: ModuleCell[] = [
  // Ehrlichkeit vor Deko: Kacheln behaupten keine Zahlen mehr, die niemand
  // misst. Der einzige Wert (Performance) wird live vom echten Index ersetzt.
  { dom: 'Performance · Index', val: 'Performance-Index', sub: 'ein Score aus echten Daten — mit Herleitung', subTone: 'att', score: 0, tag: { text: 'Output', tone: 'att' }, href: '/os/performance' },
  { dom: 'KEMARIS · Business', val: 'CapOS & Traktion', sub: 'Pipeline, Zielliste, Wettbewerb — Säule Business', href: '/os/saeule/business', tag: { text: 'F&F 01.08', tone: 'att' } },
  { dom: 'KD Ventures · Holding', val: 'Ziel: 1 Mio € Umsatz', sub: '→ min. 300k Gewinn für Kevin & Malin · Kurs im Controlling', href: '/os/controlling', tag: { text: 'Nordstern', tone: 'att' } },
  { dom: 'Team · Delegation', val: 'Wer was trägt', sub: 'Verantwortung aus dem Miro-Board · Rituale', href: '/os/saeule/social' },
  { dom: 'Gesundheit · Aufbau', val: 'Morgen-Check & Reha', sub: 'Vitals, Routinen, Journal — privat (MAKE.One)', href: '/os/gesundheit', tag: { text: 'live', tone: 'ok' } },
  { dom: 'System · Roadmap', val: 'Was wir bauen', sub: '7 Phasen · Bauplan, Fortschritt, nächste Schritte', href: '/os/roadmap', tag: { text: 'im Bau', tone: 'ok' } },
];

// ─── Lebensrad (Bodo Schäfer · Mut zum Glücklich sein) ──────────────────────
export interface LifeArea { label: string; score: number; } // 0–10
export const LIFE_WHEEL: LifeArea[] = [
  { label: 'Gesundheit', score: 4 },
  { label: 'Finanzen', score: 5 },
  { label: 'Beziehung', score: 8 },
  { label: 'Berufung', score: 7 },
  { label: 'Persönlichkeit', score: 6 },
  { label: 'Freunde', score: 5 },
  { label: 'Lebensfreude', score: 5 },
  { label: 'Sinn', score: 6 },
];
export const MZG_PILLARS = ['Rollen', 'Werte', 'Talente', 'Spaß'];
