// ─── MAKE OS — Einzel-Änderungen an Listen-Beständen ────────────────────────
// Das Zwei-Fenster-Fundament als gemeinsamer Baustein. Vorher hat jede Route
// dasselbe Muster einzeln ausgeschrieben — jetzt einmal hier, sauber geprüft:
//
//   • ein Fenster schickt nur, was es selbst geändert hat
//   • updateJson führt die Schreibvorgänge serialisiert aus, zwei
//     gleichzeitige Klicks gehen beide durch
//   • gegen Massenlöschung ist gesichert: mehr als die halbe Liste auf einmal
//     zu löschen ist nie eine Absicht, sondern ein Client mit halbem Stand
//
// Die Route liefert nur ihre eigene Säuberungs-Funktion — die Regeln bleiben
// dort, wo der Bestand definiert ist.

import { updateJson, loadJson } from './local-db';

export interface ListenOp<E> { op: 'upsert' | 'delete'; eintrag?: E; id?: string }

export interface PatchErgebnis<T> {
  ok: boolean;
  angewandt: number;
  next?: T;
  fehler?: string;
}

/** Rohe Änderungen aus dem Netz in geprüfte Änderungen übersetzen. */
export function opsLesen<E extends { id: string }>(
  roh: unknown,
  saeubern: (e: unknown) => E | null,
  grenze = 200,
): ListenOp<E>[] | null {
  if (!Array.isArray(roh)) return null;
  const ops: ListenOp<E>[] = [];
  const liste = roh.slice(0, grenze) as Record<string, unknown>[];
  for (let i = 0; i < liste.length; i++) {
    const o = liste[i];
    if (o?.op === 'delete' && typeof o.id === 'string') ops.push({ op: 'delete', id: o.id });
    else if (o?.op === 'upsert' && o.eintrag) {
      const e = saeubern(o.eintrag);
      if (e) ops.push({ op: 'upsert', eintrag: e });
    }
  }
  return ops;
}

/**
 * Änderungen auf eine benannte Liste in einem Bestand anwenden.
 *
 * @param name    Bestand (Dateiname ohne .json)
 * @param feld    Feld im Bestand, das die Liste hält
 * @param ops     geprüfte Änderungen
 * @param abZahl  ab wie vielen Einträgen der Massenlösch-Schutz greift
 */
export async function listePatchen<E extends { id: string }, T extends Record<string, unknown>>(
  name: string,
  feld: keyof T & string,
  ops: ListenOp<E>[],
  abZahl = 10,
  /** Optional: neuen Eintrag mit dem aktuellen Serverstand vereinen (z. B. anhängende Logs nie verlieren). */
  vereinen?: (neu: E, alt: E) => E,
): Promise<PatchErgebnis<T>> {
  if (!ops.length) return { ok: false, angewandt: 0, fehler: 'Keine gültigen Änderungen.' };

  const vorher = await loadJson<T>(name);
  const bestand = Array.isArray(vorher?.[feld]) ? (vorher![feld] as unknown[]).length : 0;
  const loeschungen = ops.filter(o => o.op === 'delete').length;
  if (bestand >= abZahl && loeschungen > bestand / 2) {
    return { ok: false, angewandt: 0, fehler: `Abgelehnt: das hätte über die Hälfte von ${feld} gelöscht.` };
  }

  let angewandt = 0;
  const next = await updateJson<T>(name, current => {
    const f = (current ?? {}) as T;
    const liste = (Array.isArray(f[feld]) ? f[feld] : []) as E[];
    const nachId = new Map(liste.map(x => [x.id, x]));
    for (const o of ops) {
      if (o.op === 'delete') { if (nachId.delete(o.id!)) angewandt++; }
      else { const alt = nachId.get(o.eintrag!.id); nachId.set(o.eintrag!.id, alt && vereinen ? vereinen(o.eintrag!, alt) : o.eintrag!); angewandt++; }
    }
    return { ...f, [feld]: Array.from(nachId.values()) };
  });

  return { ok: true, angewandt, next };
}
