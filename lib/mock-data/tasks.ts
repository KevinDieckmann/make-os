import type { Task } from '@/types/tasks';

const now = new Date().toISOString();
const today = new Date();
const d = (offset: number) => {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  return date.toISOString().split('T')[0];
};

// Tags
const T_IG = { id: 'tg-ig', label: 'IG', color: '#005F73' };
const T_CAPOS = { id: 'tg-capos', label: 'CapOS', color: '#00C9B8' };
const T_KDM = { id: 'tg-kdm', label: 'KDM', color: '#AC9D80' };
const T_HEALTH = { id: 'tg-health', label: 'Gesundheit', color: '#1A4A3A' };
const T_PRIV = { id: 'tg-privat', label: 'Privat', color: '#8892a0' };
const T_MAKE = { id: 'tg-make', label: 'MAKE.One', color: '#2BF0C0' };

const base = { subTasks: [], dependencies: [], createdAt: now, updatedAt: now };

// ─── Kevins echte Aufgaben (Stand 30.07.2026) ───────────────────────────────
export const MOCK_TASKS: Task[] = [
  { ...base, id: 'k-1', projectId: 'proj-capos', title: 'Market-Traction-Zahlen an Alex liefern', description: 'Echte Zahlen für 4 Kategorien (ersetzt Mockup) — für CapOS/Investoren. Alex (Quapler) wartet.', status: 'in-progress', priority: 'critical', assignee: 'kevin', tags: [T_CAPOS], dueDate: d(2), sortOrder: 0 },
  { ...base, id: 'k-2', projectId: 'proj-kdm', title: 'Björn-Kredit — Eingang prüfen (17 k€)', description: 'Björn hat 30.07 überwiesen — Eingang morgen prüfen; dann Rechnungen + Liqui-Planung.', status: 'todo', priority: 'high', assignee: 'kevin', tags: [T_KDM], dueDate: d(1), sortOrder: 1 },
  { ...base, id: 'k-3', projectId: 'proj-kdm', title: 'OneBanking — Rechnung stellen', description: 'Kunde OneBanking: Leistung abrechnen, Rechnung raus.', status: 'todo', priority: 'critical', assignee: 'kevin', tags: [T_KDM], dueDate: d(3), sortOrder: 2 },
  { ...base, id: 'k-4', projectId: 'proj-kdm', title: 'OneBanking-Mandat ausarbeiten — mehr Kundenwert', description: 'Mehr Substanz/Deliverables für den Kunden liefern.', status: 'todo', priority: 'medium', assignee: 'kevin', tags: [T_KDM], dueDate: d(5), sortOrder: 3 },
  { ...base, id: 'k-5', projectId: 'proj-ig', title: 'Longlist F&F · je 10 Kandidaten', description: 'Für F&F-Launch 01.08 — deine 10 Namen. Björn/Alex/Frank haben ihre. (Delegation: Frank sammelt.)', status: 'todo', priority: 'high', assignee: 'both', tags: [T_IG], dueDate: d(2), sortOrder: 4 },
  { ...base, id: 'k-6', projectId: 'proj-ig', title: 'Einladungstext F&F finalisieren', description: 'Kevin + Jan. Für den Launch 01.08.', status: 'todo', priority: 'medium', assignee: 'kevin', tags: [T_IG], dueDate: d(2), sortOrder: 5 },
  { ...base, id: 'k-7', projectId: 'proj-ig', title: 'Welcome-Call-Agenda + Onboarding-Skript (erste 5)', description: 'Frank + Kevin. Sauberer Start für die ersten Testkunden.', status: 'todo', priority: 'medium', assignee: 'both', tags: [T_IG], dueDate: d(2), sortOrder: 6 },
  { ...base, id: 'k-8', projectId: 'proj-ig', title: 'Vertragswerke: GV IG + CapOS + Partner + NDA', description: 'Inkl. Testvereinbarung-Vorlage.', status: 'todo', priority: 'high', assignee: 'kevin', tags: [T_IG], dueDate: d(4), sortOrder: 7 },
  { ...base, id: 'k-9', projectId: 'proj-ig', title: 'Wöchentliche F&F-Update-Mail versenden', description: '4 Mails bis Launch — MAKE entwirft, du gibst frei.', status: 'todo', priority: 'low', assignee: 'kevin', tags: [T_IG], dueDate: '', sortOrder: 8 },
  { ...base, id: 'k-10', projectId: 'proj-capos', title: 'Andreas Sternberg onboarden (KEMARIS Consulting)', description: 'Hat zugesagt — Pilotpartner.', status: 'todo', priority: 'medium', assignee: 'kevin', tags: [T_CAPOS], dueDate: '', sortOrder: 9 },
  { ...base, id: 'k-11', projectId: 'proj-ig', title: 'Katharina festziehen (Sales)', description: 'Verpflichtung klären.', status: 'todo', priority: 'medium', assignee: 'kevin', tags: [T_IG], dueDate: '', sortOrder: 10 },
  { ...base, id: 'k-12', projectId: 'proj-health', title: 'Spritze / Infiltration wahrnehmen', description: 'Bandscheibenvorfall — Infiltration beim Orthopäden. Danach schonen, kein Sport.', status: 'todo', priority: 'critical', assignee: 'kevin', tags: [T_HEALTH], dueDate: d(1), sortOrder: 11 },
  { ...base, id: 'k-13', projectId: 'proj-health', title: 'Reha & Mobilität (spine-safe)', description: 'Täglich: nach Spritze schonen, Physio, Gehen, Mobilität.', status: 'todo', priority: 'medium', assignee: 'kevin', tags: [T_HEALTH], dueDate: '', sortOrder: 12 },
  { ...base, id: 'k-14', projectId: 'proj-privat', title: 'ETF-Sparplan einrichten', description: 'MSCI World + EM + Small Cap · Start 01.08.', status: 'todo', priority: 'medium', assignee: 'kevin', tags: [T_PRIV], dueDate: d(2), sortOrder: 13 },
  { ...base, id: 'k-15', projectId: 'proj-privat', title: 'Wittner: Unterlagen an RA Lietz + Mietpreisbremse', description: 'Az. 142/2025 — WhatsApp ab 07/2024, Nebenkosten, Fotos; Mietpreisbremse-Berechnung.', status: 'todo', priority: 'high', assignee: 'kevin', tags: [T_PRIV], dueDate: '', sortOrder: 14 },
  { ...base, id: 'k-16', projectId: 'proj-make', title: 'Sunday Dinner mit Malin vorbereiten', description: 'Ohne Handy, bewusst Zeit.', status: 'todo', priority: 'medium', assignee: 'both', tags: [T_MAKE], dueDate: d(3), sortOrder: 15 },
];
