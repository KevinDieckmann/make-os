// ─── MAKE OS — Kapazität: Last je Woche für den Zeitstrahl (rein, client-sicher) ─
// Die ANDOCK-STELLE für jeden Strahl (Lichtfäden im Jahr, schlichter Strahl, Kapazitäts-Ansicht): Engpass/Überlast je
// Woche im sichtbaren Fenster, mit der Lage im Fenster als Anteil 0–1 — der Strahl zeichnet nur, er rechnet nichts.
// Quelle ist der Kapazitäts-Stand (GET /api/kapazitaet bzw. lib/kapazitaet/modell.ts `kapazitaetRechnen`).
//
//   const wochen = lastJeWoche(stand, { von: fenster.von, bis: fenster.bis });
//   wochen.filter(w => w.engpass)  → Engpass-Wochen markieren
//   x = w.anteilVon × Breite, w = (w.anteilBis − w.anteilVon) × Breite

import { tagPlus } from '@/lib/zeit/kalender-kern';
import { stufeVon } from './modell';
import type { KapaStand, LastStufe } from './typen';

export interface WochenLast {
  /** Montag der Woche. */
  woche: string;
  /** Sonntag der Woche. */
  bis: string;
  /** Belastbare Stunden (Team bzw. Person). */
  kapa: number;
  /** Verplante Stunden (Zuweisungen + Aufwand). */
  bedarf: number;
  /** bedarf ÷ kapa (null ohne beides). */
  auslastung: number | null;
  stufe: LastStufe;
  /** eng oder Überlast. */
  engpass: boolean;
  /** Lage im Fenster (0–1), auf das Fenster geschnitten. */
  anteilVon: number;
  anteilBis: number;
}

const tageZwischen = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/**
 * Last je Woche im Fenster [von, bis] (YYYY-MM-DD, einschließlich). Ohne `person` das Team, sonst diese Person.
 * Wochen außerhalb des Rechenfensters des Stands fehlen (kein Wert ist ehrlicher als eine erfundene Null).
 */
export function lastJeWoche(stand: Pick<KapaStand, 'team' | 'personen'> | null | undefined, fenster: { von: string; bis: string }, person?: string): WochenLast[] {
  if (!stand) return [];
  const spanne = Math.max(1, tageZwischen(fenster.von, fenster.bis) + 1);
  const quelle: { woche: string; belastbar: number; bedarf: number }[] = person
    ? stand.personen.find(p => p.id === person)?.wochen ?? []
    : stand.team.wochen;
  return quelle
    .filter(w => w.woche <= fenster.bis && tagPlus(w.woche, 6) >= fenster.von)
    .map(w => {
      const bis = tagPlus(w.woche, 6);
      const stufe = stufeVon(w.belastbar, w.bedarf);
      const a = Math.max(0, tageZwischen(fenster.von, w.woche));
      const b = Math.min(spanne, tageZwischen(fenster.von, bis) + 1);
      return {
        woche: w.woche, bis, kapa: w.belastbar, bedarf: w.bedarf,
        auslastung: w.belastbar > 0 ? Math.round(w.bedarf / w.belastbar * 100) / 100 : null,
        stufe, engpass: stufe === 'eng' || stufe === 'ueber',
        anteilVon: a / spanne, anteilBis: b / spanne,
      };
    });
}

/** Nur die Engpass-Wochen (eng/Überlast) — für Markierungen am Strahl und Hinweise. */
export const engpassWochen = (stand: Pick<KapaStand, 'team' | 'personen'> | null | undefined, fenster: { von: string; bis: string }, person?: string): WochenLast[] =>
  lastJeWoche(stand, fenster, person).filter(w => w.engpass);
