'use client';

// ─── MAKE OS — Listen-Abgleich im Browser ───────────────────────────────────
// Die Client-Hälfte des Zwei-Fenster-Fundaments: aus altem und neuem Stand die
// Unterschiede bilden und nur die schicken. Gleiches Muster wie bei Aufgaben
// und Wochenplan, hier für alle Listen-Bestände (Kunden, Meilensteine,
// Routinen …).
//
// Fällt der Unterschied zu groß aus (Erststand, Massenänderung), geht wie
// bisher die ganze Liste raus — dort ist Vollschreiben die richtige Wahl.

interface MitId { id: string }
type Op<E> = { op: 'upsert'; eintrag: E } | { op: 'delete'; id: string };

/** Unterschied zweier Listen: geänderte/neue Einträge + gelöschte Ids. */
export function listenOps<E extends MitId>(alt: E[], neu: E[]): Op<E>[] {
  const ops: Op<E>[] = [];
  const altNachId = new Map(alt.map(e => [e.id, JSON.stringify(e)]));
  for (const e of neu) {
    if (altNachId.get(e.id) !== JSON.stringify(e)) ops.push({ op: 'upsert', eintrag: e });
  }
  const neuIds = new Set(neu.map(e => e.id));
  for (const e of alt) if (!neuIds.has(e.id)) ops.push({ op: 'delete', id: e.id });
  return ops;
}

/**
 * Liste schreiben — als Einzel-Änderungen, wenn der vorige Stand bekannt ist.
 *
 * @param pfad   z. B. '/api/state/kunden'
 * @param feld   Feldname für das Vollschreiben, z. B. 'kunden'
 */
export async function listeSchreiben<E extends MitId>(
  pfad: string,
  feld: string,
  alt: E[] | null,
  neu: E[],
  maxOps = 20,
): Promise<void> {
  const ops = alt ? listenOps(alt, neu) : null;
  if (ops && ops.length === 0) return;

  if (ops && ops.length <= maxOps) {
    await fetch(pfad, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ops }),
    }).catch(() => { /* offline — nächste Änderung versucht es erneut */ });
    return;
  }

  await fetch(pfad, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [feld]: neu }),
  }).catch(() => { /* offline — nächste Änderung versucht es erneut */ });
}
