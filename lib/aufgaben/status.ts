// ─── MAKE OS — Status EINER Aufgabe setzen (28.09.) ─────────────────────────
// Prüfbericht 28.09.: SaeuleView las den ganzen Aufgaben-Stand und schrieb ihn per
// PUT zurück — was zwischen Lesen und Schreiben an ANDEREN Aufgaben geändert wurde
// (Malin hakt ab, ZOE legt an), war still weg. Jetzt: frisch lesen, genau diese
// eine Aufgabe als Einzeländerung (PATCH upsert) schicken. Getestet in
// tests/aufgabe-status.test.ts.

interface MitId { id: string }

/** Wirft bei jedem Fehler — die Ansicht dreht dann ihre Anzeige zurück. */
export async function aufgabeStatusSetzen(id: string, status: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const r = await fetchImpl('/api/state/tasks', { cache: 'no-store' });
  if (!r.ok) throw new Error('Stand nicht lesbar');
  const cur = await r.json() as { state?: { tasks?: unknown } };
  const aktuell = Array.isArray(cur?.state?.tasks) ? (cur.state!.tasks as MitId[]).find(x => x.id === id) : undefined;
  if (!aktuell) throw new Error('Aufgabe nicht mehr da');
  const w = await fetchImpl('/api/state/tasks', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ops: [{ op: 'upsert', task: { ...aktuell, status, updatedAt: new Date().toISOString() } }] }),
  });
  if (!w.ok) throw new Error('nicht gespeichert');
}
