// ─── Kalender — wer darf? ───────────────────────────────────────────────────
// Der Kalender ist der des Inhabers (sein iCloud-Konto). Regel und Begründung:
// lib/zugang/haushalt-inhaber.ts — gilt genauso für den Business-Index.

import { imHaushaltDesInhabers, imHaushaltOderSystemlauf } from '@/lib/zugang/haushalt-inhaber';

export const KEIN_KALENDER = { ok: false, fehler: 'Kein Zugang zum Kalender — er gehört zum Haushalt des Inhabers (System → Konto).' };

export const kalenderZugang = imHaushaltDesInhabers;
/** Lesen des Kalenders (GET /api/apple-calendar): zusätzlich der Systemlauf ohne Person (Zulieferer vom Mac, Takt) — 28.09. */
export const kalenderLesen = imHaushaltOderSystemlauf;
