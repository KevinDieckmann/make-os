// ─── MAKE OS — Text, der in einen HTTP-Header darf ──────────────────────────
// Gefunden am 07.09.: die Apple-Kalender-Route antwortete mit 500, obwohl sie
// alles hatte, was sie brauchte. Der Kalender war kurz nicht erreichbar, die
// Route wollte pflichtbewusst den letzten guten Stand ausliefern und den Grund
// als Header mitgeben — und genau daran starb sie.
//
// HTTP-Header sind Latin-1. Eine deutsche Fehlermeldung enthält fast immer
// einen Gedankenstrich („—", U+2014), und der bringt Response.json zum Werfen.
// Der Rettungsweg scheiterte also am Text über das Scheitern.

/** Alles außerhalb von Latin-1 raus, Leerraum zusammenziehen, kürzen. */
export function kopfTauglich(text: string, max = 120): string {
  return text
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
