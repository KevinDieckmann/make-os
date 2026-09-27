// ─── Fingerabdruck je Datensatz (Datenschicht Stufe 2, 27.09.) ──────────────
// „Zu zweit gewinnt der Letzte“ (DATENARCHITEKTUR.md, Punkt 6): Kevin und Malin
// konnten am selben Kontakt gegenseitig Felder überschreiben. Statt einer
// Versionsnummer, die JEDER der 18 Schreiber pflegen müsste, ist der Stand hier
// der Fingerabdruck des gespeicherten Datensatzes: ändert irgendwer irgendetwas,
// ändert er sich — ganz gleich, ob der Browser, Jarvis oder ein Signal schrieb.
// Der Browser schickt den Stand zurück, den er bekam; passt er nicht mehr, gibt
// es 409 mit dem aktuellen Datensatz statt eines stillen Überschreibens.
// Nur Server (node:crypto) — der Client bekommt den Wert als Feld `stand`.

import { createHash } from 'crypto';

/** Stabile Textform: Schlüssel sortiert (rekursiv), undefined fällt weg — zwei gleich gemeinte Datensätze haben denselben Text, egal, welcher Schreiber die Felder in welcher Reihenfolge anlegte. */
export function stabil(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stabil).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stabil(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** Kurzer, stabiler Fingerabdruck eines Datensatzes (ohne das Feld `stand` selbst, unabhängig von der Schlüsselreihenfolge). */
export function fingerabdruck(e: Record<string, unknown>): string {
  const { stand: _s, ...rest } = e;
  return createHash('sha1').update(stabil(rest)).digest('base64url').slice(0, 12);
}

/** Liste mit Fingerabdruck je Eintrag — so geht sie an den Browser. */
export function mitStand<T extends { id: string }>(liste: T[]): (T & { stand: string })[] {
  return liste.map(e => ({ ...e, stand: fingerabdruck(e as unknown as Record<string, unknown>) }));
}
