// ─── Kalender-Einstellungen (eine Wahrheit) ─────────────────────────────────
// Welcher Apple-Kalender gehört wem, wie lange dauern die Arten, wann ist
// Arbeitszeit. Vorher nur in der Route — jetzt brauchen sie auch der
// iCloud-Kalender (wohin schreibt „Kevin“/„Malin“/„gemeinsam“?) und die
// Planer-Ansichten.

import { loadJson } from '@/lib/store/local-db';

export type Wer = 'kevin' | 'malin' | 'beide';
export interface KalenderEinstellungen {
  /** Welcher Apple-Kalender gehört wem. Namen wie in der Kalender-App. */
  kalender: Record<Wer, string>;
  /** Standarddauer je Art in Minuten. */
  dauer: { termin: number; fokus: number; routine: number; aufgabe: number; reha: number };
  /** Arbeitsfenster — außerhalb schlägt das System nichts vor. */
  vonStunde: number;
  bisStunde: number;
  /** Welche Sicht beim Öffnen steht. */
  standardSicht: 'alle' | Wer;
}

export const EINSTELLUNGEN_LEER: KalenderEinstellungen = {
  kalender: { kevin: 'Privat Kevin', malin: 'Privat Malin', beide: 'Kalender' },
  dauer: { termin: 60, fokus: 90, routine: 30, aufgabe: 45, reha: 30 },
  vonStunde: 7,
  bisStunde: 20,
  standardSicht: 'alle',
};

const zahl = (v: unknown, min: number, max: number, sonst: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : sonst;
};
const text = (v: unknown, sonst: string) => String(v ?? '').trim().slice(0, 60) || sonst;

export function einstellungenSauber(d: Partial<KalenderEinstellungen> | null): KalenderEinstellungen {
  const L = EINSTELLUNGEN_LEER;
  const sicht = ['alle', 'kevin', 'malin', 'beide'].includes(String(d?.standardSicht)) ? d!.standardSicht! : L.standardSicht;
  return {
    kalender: { kevin: text(d?.kalender?.kevin, L.kalender.kevin), malin: text(d?.kalender?.malin, L.kalender.malin), beide: text(d?.kalender?.beide, L.kalender.beide) },
    dauer: {
      termin: zahl(d?.dauer?.termin, 5, 600, L.dauer.termin), fokus: zahl(d?.dauer?.fokus, 5, 600, L.dauer.fokus),
      routine: zahl(d?.dauer?.routine, 5, 600, L.dauer.routine), aufgabe: zahl(d?.dauer?.aufgabe, 5, 600, L.dauer.aufgabe), reha: zahl(d?.dauer?.reha, 5, 600, L.dauer.reha),
    },
    vonStunde: zahl(d?.vonStunde, 0, 23, L.vonStunde),
    bisStunde: zahl(d?.bisStunde, 1, 24, L.bisStunde),
    standardSicht: sicht,
  };
}

export async function ladeEinstellungen(): Promise<KalenderEinstellungen> {
  return einstellungenSauber(await loadJson<KalenderEinstellungen>('kalender-einstellungen'));
}

/**
 * Wem gehört ein Kalender (nach Name)? Zuerst die Einstellungen, dann der
 * Name selbst („Kevin Dieckmann“ ist Kevins Arbeitskalender) — sonst gemeinsam.
 */
export function wemGehoert(e: KalenderEinstellungen, kalenderName: string): Wer {
  const n = kalenderName.trim().toLowerCase();
  if (n === e.kalender.kevin.trim().toLowerCase()) return 'kevin';
  if (n === e.kalender.malin.trim().toLowerCase()) return 'malin';
  if (n === e.kalender.beide.trim().toLowerCase()) return 'beide';
  const kevin = /\bkevin\b/.test(n), malin = /\bmalin\b/.test(n);
  return kevin && !malin ? 'kevin' : malin && !kevin ? 'malin' : 'beide';
}
