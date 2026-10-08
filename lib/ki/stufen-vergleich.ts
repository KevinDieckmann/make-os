// ─── Modellstufen vergleichen, bevor umgestellt wird (09.10.2026, Paket 6a) — rein ─────────────────────────────────────────
// Kevin 08.10. (Antwort 20): „Haiku 5.5 / Sonnet 5.5 / Opus 5.5 nach Test“ — und Antwort 17: „Tests vor jeder Änderung“. Grundlage sind die
// Evals der Heads (lib/heads/eval.ts: feste Prüfungen + pass^k über gespeicherte Replay-Fälle). POST /api/heads/eval mit
// `{ vergleich: true }` beantwortet DIESELBEN Fälle k-mal mit dem Satz „bisher“ und dem Satz „neu“ (lib/ki/modelle.ts); diese Datei fasst das
// zusammen und gibt eine nüchterne Empfehlung. Umgestellt wird nie automatisch — Kevin stellt um (Umgebung oder Einstellung).

import { passK, PRUEFUNGEN, type Bewertung } from '@/lib/heads/eval';

export interface StufenSeite { faelle: Bewertung[][]; kostenCent: number; fehler: number }
export interface StufenVergleich {
  je_pruefung: { id: string; label: string; bisher: number; neu: number; delta: number }[];
  bisher: { quote: number; kostenCent: number; faelle: number; fehler: number };
  neu: { quote: number; kostenCent: number; faelle: number; fehler: number };
  empfehlung: 'umstellen' | 'nicht-umstellen' | 'mehr-faelle';
  grund: string;
}

/** Ab so vielen Fällen trägt ein Vergleich (sonst „mehr Fälle sammeln“). */
export const MINDEST_FAELLE = 5;
/** Größter erlaubter Rückgang einer Prüfung (Prozentpunkte), damit „umstellen“ empfohlen wird. */
export const TOLERANZ_PUNKTE = 5;

const mittel = (q: { quote: number }[]) => (q.length ? Math.round(q.reduce((a, x) => a + x.quote, 0) / q.length) : 0);

export function stufenVergleichen(bisher: StufenSeite, neu: StufenSeite): StufenVergleich {
  const a = passK(bisher.faelle), b = passK(neu.faelle);
  const je = PRUEFUNGEN.map(p => {
    const x = a.find(q => q.id === p.id)?.quote ?? 0, y = b.find(q => q.id === p.id)?.quote ?? 0;
    return { id: p.id, label: p.label, bisher: x, neu: y, delta: y - x };
  });
  const faelle = Math.min(bisher.faelle.length, neu.faelle.length);
  const schlechter = je.filter(j => j.delta < -TOLERANZ_PUNKTE);
  const ergebnis = { bisher: { quote: mittel(a), kostenCent: bisher.kostenCent, faelle: bisher.faelle.length, fehler: bisher.fehler }, neu: { quote: mittel(b), kostenCent: neu.kostenCent, faelle: neu.faelle.length, fehler: neu.fehler } };
  if (faelle < MINDEST_FAELLE || bisher.fehler + neu.fehler > faelle) {
    return { je_pruefung: je, ...ergebnis, empfehlung: 'mehr-faelle', grund: `Zu wenige verwertbare Fälle (${faelle}, nötig ${MINDEST_FAELLE}) — erst weitere Läufe der Heads sammeln.` };
  }
  if (schlechter.length) {
    return { je_pruefung: je, ...ergebnis, empfehlung: 'nicht-umstellen', grund: `Schlechter um mehr als ${TOLERANZ_PUNKTE} Punkte: ${schlechter.map(s => `${s.label} (${s.bisher} → ${s.neu} %)`).join(', ')}.` };
  }
  const billiger = neu.kostenCent <= bisher.kostenCent;
  return { je_pruefung: je, ...ergebnis, empfehlung: 'umstellen', grund: `Keine Prüfung schlechter als ${TOLERANZ_PUNKTE} Punkte${billiger ? ', und günstiger' : `, aber teurer (${Math.round(neu.kostenCent)} statt ${Math.round(bisher.kostenCent)} US-Cent)`}.` };
}
