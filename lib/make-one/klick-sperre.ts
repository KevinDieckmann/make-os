// ─── Doppelklick-Sperre für Knöpfe (rein, getestet, 28.09., K4, #19) ────────
// Ein Knopf, dessen Handlung ein Promise liefert (Speichern, Anlegen, Senden),
// ist bis zu dessen Ende gesperrt: ein zweiter Klick in der Zwischenzeit tut
// nichts — vorher legte ein Doppelklick denselben Eintrag zweimal an. Die
// Sperre ist ein Objekt (im Knopf ein useRef), damit auch zwei Klicks im selben
// Takt, bevor React neu zeichnet, sie sehen. Synchrone Handlungen sperren nicht.

export interface KlickSperre { laeuft: boolean }

/**
 * Handlung ausführen, wenn keine läuft. Liefert sie ein Promise, gilt die Sperre bis zu dessen Ende
 * (auch bei Fehler); `melde(true/false)` schaltet die Anzeige (aria-busy). Gibt das Ende zurück (für Tests).
 */
export function klickSperren(sperre: KlickSperre, handlung: (() => unknown) | undefined, melde: (laeuft: boolean) => void = () => undefined): Promise<void> {
  if (sperre.laeuft || !handlung) return Promise.resolve();
  const r = handlung();
  if (!r || typeof (r as PromiseLike<unknown>).then !== 'function') return Promise.resolve();
  sperre.laeuft = true;
  melde(true);
  const ende = () => { sperre.laeuft = false; melde(false); };
  return Promise.resolve(r as PromiseLike<unknown>).then(ende, ende);
}
