// ─── Einwilligung ↔ Dateiablage (rein, getestet, 28.09.) ─────────────────────
// Integritätsprüfung W10: Eine Einwilligung kann ihren Beleg in der Dateiablage
// haben (`belegRef` = Kennung „d-…“, z. B. das unterschriebene Formular). Wurde
// die Datei gelöscht, zeigte der Nachweis ins Leere — Art. 7 Abs. 1 DSGVO verlangt,
// dass die Einwilligung nachweisbar BLEIBT, auch nach einem Widerruf.
//   · Löschen einer solchen Datei → 409 mit Grund (lib/dateien/ablage.ts `entfernen`)
//   · Verbindungsprüfung `einwilligung-beleg-tot` (lib/crm/verbindungen.ts)

import type { Kontakt } from '@/lib/make-one/crm';

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Die Kennung als ganzes Wort in einem Text (nicht als Teil einer längeren Kennung). */
const nenntKennung = (text: string | undefined, id: string) => !!text && !!id && new RegExp(`(?<![A-Za-z0-9_-])${esc(id)}(?![A-Za-z0-9_-])`).test(text);
/** Kennungen der Dateiablage in einem Beleg-Verweis („d-…“). */
const DATEI_KENNUNG = /(?<![A-Za-z0-9_-])d-[a-z0-9-]{4,60}(?![A-Za-z0-9_-])/g;

/** Wie viele Einwilligungen (auch widerrufene — der Nachweis bleibt) belegen sich mit dieser Datei? Nur Kennungen, nie Namen. */
export function einwilligungenMitBeleg(kontakte: Pick<Kontakt, 'id' | 'einwilligungen'>[], dateiId: string): { anzahl: number; kontaktIds: string[] } {
  let anzahl = 0;
  const ids = new Set<string>();
  for (const k of kontakte) for (const e of k.einwilligungen ?? []) if (nenntKennung(e.belegRef, dateiId)) { anzahl++; ids.add(k.id); }
  return { anzahl, kontaktIds: Array.from(ids) };
}

/** Der Satz für die 409-Antwort. */
export const belegGesperrtText = (n: number) => `Die Datei ist der Beleg für ${n === 1 ? 'eine Einwilligung' : `${n} Einwilligungen`} (Art. 7 Abs. 1 DSGVO: der Nachweis muss bleiben, auch nach einem Widerruf) — sie wird nicht gelöscht.`;

/** Personen, deren Einwilligung auf einen Ablage-Eintrag zeigt, den es nicht (mehr) gibt. */
export function einwilligungBelegTot(kontakte: Pick<Kontakt, 'id' | 'einwilligungen'>[], dateiIds: Set<string>): string[] {
  const raus: string[] = [];
  for (const k of kontakte) {
    const tot = (k.einwilligungen ?? []).some(e => Array.from((e.belegRef ?? '').matchAll(DATEI_KENNUNG)).some(m => !dateiIds.has(m[0])));
    if (tot) raus.push(k.id);
  }
  return raus;
}
