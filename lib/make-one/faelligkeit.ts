// ─── MAKE OS — Fälligkeiten rechnen ─────────────────────────────────────────
// Stand bis 07.09. in components/os/Faelligkeit.tsx. Herausgezogen, weil
// Datumsarithmetik keine Ansicht ist — und weil sie in einer .tsx-Datei nicht
// prüfbar war (der Testläufer kann kein JSX parsen, das Projekt übersetzt mit
// jsx: preserve).
//
// Die Uhrzeit 12:00 in allen Umrechnungen ist kein Zufall: nur so kann die
// Zeitumstellung — eine Stunde vor oder zurück — den Tag nicht kippen. Ohne
// sie landete ein „+1 Tag" über die Oktobernacht auf demselben Datum.

import { THEME as T } from './os-data';
import { localDay } from '@/lib/zeit';

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Tage auf ein ISO-Datum rechnen — ohne Zeitzonen-Überraschung. */
export function tageDazu(iso: string, tage: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + tage);
  return localDay(d);
}

/** „Mo 04.08." — kurz, mit Wochentag, weil man beim Planen in Tagen denkt. */
export function datumKurz(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${WOCHENTAG[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

/** Wie weit weg — für die Farbe und den Zusatz „überfällig". */
export function tageBis(iso: string, heute = localDay()): number {
  return Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(`${heute}T12:00:00`).getTime()) / 864e5);
}

export function datumFarbe(iso: string | undefined, heute = localDay()): string {
  if (!iso) return T.muted;
  const d = tageBis(iso, heute);
  if (d < 0) return T.crit;
  if (d === 0) return T.amber;
  if (d <= 2) return T.accentInk;
  return T.inkDim;
}
