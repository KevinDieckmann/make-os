// ─── MAKE OS — Wächter gegen Massen-Erledigung ──────────────────────────────
// Am 06.09. zwischen 13:12 und 13:15 wurden 57 von 64 Aufgaben auf erledigt
// gesetzt und eine gelöscht. Der bestehende Schutz hat das NICHT gesehen —
// und konnte es nicht sehen: er zählt die LÄNGE der Liste, und die bleibt
// beim Erledigen gleich. Er schützt vor Löschen, nicht vor Zuklappen.
//
// Das ist der zweite Weg, auf dem Arbeit verschwindet, und er fühlt sich
// harmloser an als der erste: gelöschte Aufgaben vermisst man, erledigte
// glaubt man erledigt zu haben.
//
// Die Regel hier ist absichtlich stumpf und leicht erklärbar: mehr als eine
// Handvoll auf einen Schlag ist kein Arbeiten mehr, sondern eine Aktion, die
// man bewusst gewollt haben muss.

/** Ab wie vielen gleichzeitigen Erledigungen nachgefragt wird. */
export const MASSEN_GRENZE = 12;

interface MitStatus { id: string; status?: string }

/**
 * Wie viele Aufgaben kippen in diesem Schreibvorgang von „nicht erledigt"
 * auf „erledigt"? Nur diese Richtung zählt — etwas wieder aufzumachen ist
 * nie gefährlich.
 */
export function neuErledigt(alt: MitStatus[], neu: MitStatus[]): string[] {
  const vorher = new Map(alt.map(t => [t.id, t.status]));
  return neu
    .filter(t => t.status === 'done' && vorher.has(t.id) && vorher.get(t.id) !== 'done')
    .map(t => t.id);
}

/**
 * Ist dieser Schreibvorgang eine Massen-Erledigung, die nachgefragt gehört?
 *
 * `bestaetigt` ist die ausdrückliche Zustimmung des Aufrufers — die Oberfläche
 * fragt einmal nach und schickt sie mit. Ohne sie wird abgelehnt, nicht
 * stillschweigend ausgeführt: lieber ein Klick zu viel als eine Woche Arbeit,
 * von der niemand weiß, wohin sie ist.
 */
export function brauchtBestaetigung(alt: MitStatus[], neu: MitStatus[], bestaetigt = false): { noetig: boolean; anzahl: number } {
  const anzahl = neuErledigt(alt, neu).length;
  return { noetig: !bestaetigt && anzahl > MASSEN_GRENZE, anzahl };
}
