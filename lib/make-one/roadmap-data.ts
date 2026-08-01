// ─── MAKE OS — Roadmap: die Reihenfolge, in der wir bauen ───────────────────
// Aus Kevins Braindump (31.07.) strukturiert. Die Phasen bauen aufeinander auf:
// erst der Takt, dann vollständige Daten, dann Steuerung, dann Delegation.
// Ohne diese Reihenfolge baut man Messbarkeit auf Daten, die es nicht gibt.

export interface Phase {
  id: string;
  nr: number;
  name: string;
  ziel: string;
  /** Woran man merkt, dass die Phase fertig ist. */
  fertigWenn: string;
}

export const PHASEN: Phase[] = [
  {
    id: 'takt', nr: 1, name: 'Der tägliche Takt',
    ziel: 'Du machst morgens auf und weißt, wo du stehst — ohne etwas zu suchen.',
    fertigWenn: 'Der Tagesstart läuft jeden Morgen dieselbe Kette durch: Postfächer, Transkripte, Aufgaben, Termine, News. Mehrmals täglich, nicht nur früh.',
  },
  {
    id: 'eingang', nr: 2, name: 'Alles fließt rein',
    ziel: 'Keine Information geht mehr verloren — egal ob Mail, Gespräch oder Notiz.',
    fertigWenn: 'Postfächer, Transkripte, Erinnerungen, Whoop und Miro laufen automatisch ins System.',
  },
  {
    id: 'steuerung', nr: 3, name: 'Steuerung & Messbarkeit',
    ziel: 'Vom Ziel zur Aufgabe — und zurück: jede Aufgabe zahlt nachweisbar auf einen Meilenstein ein.',
    fertigWenn: 'Meilensteine aus dem Businessplan hängen im System, Aufgaben leiten sich daraus ab, der Score misst den Fortschritt vollständig.',
  },
  {
    id: 'delegation', nr: 4, name: 'Delegation & Autonomie',
    ziel: 'Alles, was nicht zwingend du bist, läuft über Agenten, Frank oder Malin.',
    fertigWenn: 'Jede neue Aufgabe wird automatisch auf „wer macht das" geprüft. Die Agenten-Abteilungen arbeiten sichtbar zusammen.',
  },
  {
    id: 'kunden', nr: 5, name: 'Kunden & Projekte',
    ziel: 'Dieselbe Maschine, die dich steuert, betreut auch deine Kunden.',
    fertigWenn: 'Kunden liegen im System, du und Malin arbeitet darüber, Upselling und Cashflow sind sichtbar.',
  },
  {
    id: 'gesundheit', nr: 6, name: 'Gesundheit in der Tiefe',
    ziel: 'Der größte Hebel: Ernährung, Reha und Ruhe werden planbar statt Zufall.',
    fertigWenn: 'Ernährung ist vorbereitet (Rezepte, Einkauf), Malin ist eingebunden, die Gesundheits-Meilensteine sind überprüfbar.',
  },
  {
    id: 'produkt', nr: 7, name: 'Aus dem System ein Produkt',
    ziel: 'Was für dich funktioniert, wird für andere verkaufbar.',
    fertigWenn: 'Module lassen sich abkapseln, Mandanten trennen, das Ökosystem steht.',
  },
];

/** Ordnet die Roadmap-Phase je Bauplan-Punkt zu (id → phase-id). */
export const PHASE_VON: Record<string, string> = {};
