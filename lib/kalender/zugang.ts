// ─── Kalender — wer darf? ───────────────────────────────────────────────────
// Der Kalender ist der des Inhabers (sein iCloud-Konto). Regel und Begründung:
// lib/zugang/haushalt-inhaber.ts — gilt genauso für den Business-Index.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';

export const KEIN_KALENDER = { ok: false, fehler: 'Kein Zugang zum Kalender — er gehört zum Haushalt des Inhabers (System → Konto).' };

export const kalenderZugang = imHaushaltDesInhabers;
