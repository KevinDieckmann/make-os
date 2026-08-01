// ─── MAKE OS — Fokus-Zuordnung (client-sicher, keine fs-Imports) ────────────
// DIE eine Quelle dafür, wie Aufgaben/Routinen den Score-Säulen zugeordnet
// werden und wie die Säulen heißen/aussehen. Wird von Wochenplaner, Tages-
// planung, Dashboard und Jarvis' Wochenvorschlag gemeinsam genutzt — damit
// der Fokus-Regler überall GLEICH lenkt.

import { THEME } from './os-data';

export type SaeuleKey = 'health' | 'business' | 'planning' | 'finance' | 'social';

/** Projekt → Score-Säule (für die Aufgaben-Lenkung durch den Fokus-Regler). */
export const SAEULE_VON_PROJEKT: Record<string, string> = {
  'proj-health': 'health',
  'proj-capos': 'business', 'proj-ig': 'business', 'proj-kdm': 'business',
  'proj-make': 'social',
  'proj-privat': 'finance',
};

/** Routine-Kategorie → Score-Säule (für „zahlt auf den Fokus ein"). */
export const KATEGORIE_ZU_SAEULE: Record<string, string> = {
  gesundheit: 'health', business: 'business', leben: 'social',
};

export const SAEULE_LABEL: Record<string, string> = {
  health: 'Gesundheit & Energie', business: 'Business', planning: 'Planung & Execution', finance: 'Finanzen', social: 'Beziehung & Team',
};

export const SAEULE_FARBE: Record<string, string> = {
  health: '#58D9CD', business: '#4A6CF7', planning: THEME.accent, finance: '#00C9B8', social: '#C77DFF',
};

/** Ab diesem Regler-Wert gilt ein Bereich als „im Fokus" (◎). */
export const FOKUS_SCHWELLE = 65;
