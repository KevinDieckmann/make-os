// ─── Unternehmen › Risiken als Matrix: Wahrscheinlichkeit × Schwere, Punkte = Risiken (rein, client-sicher, 11.10.) ───────────────────
// Kevin 11.10.: „Bild statt Liste“ — jedes bewertete Risiko ist ein Punkt in seinem Feld (Eintritt 1–5 × Wirkung 1–5, Skala der Recherche, ./risiken.ts),
// das Feld trägt die Farbe der Ampel (rot ab 15 oder Wirkung 5, gelb 8–14). Nummern nach Schwere (1 = schwerstes), damit Bild und Legende
// zusammenpassen. Achsen in Klartext. Für eine Gesellschaft oder alle (dann mit Namen der Gesellschaft in der Legende). Der Zeichner setzt nur.

import { ampelVon, type RisikoAmpel, type RisikoZeile } from './risiken';
import type { Stufe } from './typen';

/** Achsen in Klartext — die Zahlen der Skala stehen nur klein daneben. */
export const EINTRITT_KLAR: Record<Stufe, string> = { 1: 'selten', 2: 'gelegentlich', 3: 'möglich', 4: 'wahrscheinlich', 5: 'fast sicher' };
export const WIRKUNG_KLAR: Record<Stufe, string> = { 1: 'gering', 2: 'spürbar', 3: 'deutlich', 4: 'schwer', 5: 'bestandsgefährdend' };

export interface MatrixPunkt { nr: number; risikoId: string; titel: string; gesellschaftId: string; gesellschaft: string; eintritt: Stufe; wirkung: Stufe; ampel: RisikoAmpel; score: number }
export interface MatrixZelle { eintritt: Stufe; wirkung: Stufe; ampel: RisikoAmpel; punkte: MatrixPunkt[] }
export interface Matrix { zellen: MatrixZelle[]; punkte: MatrixPunkt[]; unbewertet: number }

/** Die Matrix (rein): Zellen von oben (Eintritt 5) nach unten, links (Wirkung 1) nach rechts; Punkte nummeriert nach Schwere. Erledigte fallen weg. */
export function risikoMatrix(je: readonly { gesellschaftId: string; gesellschaft: string; risiken: readonly RisikoZeile[] }[]): Matrix {
  const alle = je.flatMap(g => g.risiken.filter(r => r.r.status !== 'erledigt').map(r => ({ g, r })));
  const bewertet = alle.filter(x => x.r.bewertung)
    .sort((a, b) => (b.r.score ?? 0) - (a.r.score ?? 0) || b.r.bewertung!.wirkung - a.r.bewertung!.wirkung || a.r.r.titel.localeCompare(b.r.r.titel, 'de'));
  const punkte: MatrixPunkt[] = bewertet.map((x, i) => ({
    nr: i + 1, risikoId: x.r.r.id, titel: x.r.r.titel, gesellschaftId: x.g.gesellschaftId, gesellschaft: x.g.gesellschaft,
    eintritt: x.r.bewertung!.eintritt, wirkung: x.r.bewertung!.wirkung, ampel: ampelVon(x.r.bewertung), score: x.r.score ?? 0,
  }));
  const zellen: MatrixZelle[] = [];
  for (const e of [5, 4, 3, 2, 1] as Stufe[]) for (const w of [1, 2, 3, 4, 5] as Stufe[]) {
    zellen.push({ eintritt: e, wirkung: w, ampel: ampelVon({ eintritt: e, wirkung: w }), punkte: punkte.filter(p => p.eintritt === e && p.wirkung === w) });
  }
  return { zellen, punkte, unbewertet: alle.length - bewertet.length };
}
