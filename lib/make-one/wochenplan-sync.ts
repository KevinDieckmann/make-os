'use client';

// ─── MAKE OS — Wochenplan-Abgleich ──────────────────────────────────────────
// Das Zwei-Fenster-Fundament für den Planer (gleiches Muster wie bei den
// Aufgaben): geschrieben wird nur, was sich wirklich geändert hat — als
// Einzel-Änderungen je Block. So überschreibt Kevins Zug nicht mehr Malins
// Zug, nur weil beide dieselbe Woche offen haben.
//
// Benutzt vom Wochenplaner UND der Tagesplanung — beide schreiben in
// denselben Bestand.

interface BlockMin { id: string }

type Op<B> = { op: 'upsert'; block: B } | { op: 'delete'; id: string };

/** Unterschied zweier Stände: geänderte/neue Blöcke + gelöschte Ids. */
export function planOps<B extends BlockMin>(alt: B[], neu: B[]): Op<B>[] {
  const ops: Op<B>[] = [];
  const altNachId = new Map(alt.map(b => [b.id, JSON.stringify(b)]));
  for (const b of neu) {
    if (altNachId.get(b.id) !== JSON.stringify(b)) ops.push({ op: 'upsert', block: b });
  }
  const neuIds = new Set(neu.map(b => b.id));
  for (const b of alt) if (!neuIds.has(b.id)) ops.push({ op: 'delete', id: b.id });
  return ops;
}

/**
 * Neuen Stand schreiben. Kennt man den zuletzt gespeicherten Stand, gehen nur
 * die Unterschiede raus (PATCH); sonst — oder bei einer Massenänderung wie
 * „Jarvis belegt die Woche" — die ganze Woche (PUT, wie bisher).
 */
export async function wochenplanSchreiben<B extends BlockMin>(
  woche: string,
  alt: B[] | null,
  neu: B[],
): Promise<void> {
  const ops = alt ? planOps(alt, neu) : null;
  if (ops && ops.length === 0) return;

  if (ops && ops.length <= 25) {
    await fetch('/api/state/wochenplan', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ woche, ops }),
    }).catch(() => { /* offline — der nächste Zug versucht es erneut */ });
    return;
  }

  await fetch('/api/state/wochenplan', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ woche, bloecke: neu }),
  }).catch(() => { /* offline — der nächste Zug versucht es erneut */ });
}
