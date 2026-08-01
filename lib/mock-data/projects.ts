import type { Project } from '@/types/tasks';

const now = new Date().toISOString();

// ─── Kevins echte Projekte (abgeleitet aus Brain + aktueller Lage) ───────────
export const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-ig',
    title: 'KEMARIS Innovation Group (IG)',
    description: 'Holding-Steuerung, F&F-Launch (01.08), Verträge, Team.',
    category: 'business', owner: 'both', color: '#005F73',
    tags: [{ id: 'tg-ig', label: 'IG', color: '#005F73' }],
    archived: false, dueDate: '2026-10-01', createdAt: now, updatedAt: now,
  },
  {
    id: 'proj-capos',
    title: 'CapOS — Produkt & Traktion',
    description: 'Capital Operations System: Market Traction, Testkunden, Produkt.',
    category: 'business', owner: 'both', color: '#00C9B8',
    tags: [{ id: 'tg-capos', label: 'CapOS', color: '#00C9B8' }],
    archived: false, dueDate: '2026-08-01', createdAt: now, updatedAt: now,
  },
  {
    id: 'proj-kdm',
    title: 'KD Management (Holding)',
    description: 'Finanzen, Mandate, Liquidität — u.a. OneBanking, Björn-Kredit.',
    category: 'business', owner: 'kevin', color: '#AC9D80',
    tags: [{ id: 'tg-kdm', label: 'KDM', color: '#AC9D80' }],
    archived: false, dueDate: '2026-12-31', createdAt: now, updatedAt: now,
  },
  {
    id: 'proj-health',
    title: 'Gesundheit & Aufbau',
    description: 'Bandscheiben-Reha, Spritze, spine-safe Aufbau, Routinen.',
    category: 'personal-kevin', owner: 'kevin', color: '#1A4A3A',
    tags: [{ id: 'tg-health', label: 'Gesundheit', color: '#1A4A3A' }],
    archived: false, dueDate: '2026-12-31', createdAt: now, updatedAt: now,
  },
  {
    id: 'proj-make',
    title: 'MAKE.One (Malin & Kevin)',
    description: 'Privat gemeinsam: Rituale, Finanzroutine, Sunday Dinner.',
    category: 'joint', owner: 'both', color: '#2BF0C0',
    tags: [{ id: 'tg-make', label: 'MAKE.One', color: '#2BF0C0' }],
    archived: false, dueDate: '', createdAt: now, updatedAt: now,
  },
  {
    id: 'proj-privat',
    title: 'Privat & Recht',
    description: 'Persönliches, Finanzen privat, Rechtsstreit Wittner.',
    category: 'personal-kevin', owner: 'kevin', color: '#2A2A2A',
    tags: [{ id: 'tg-privat', label: 'Privat', color: '#8892a0' }],
    archived: false, dueDate: '', createdAt: now, updatedAt: now,
  },
];
