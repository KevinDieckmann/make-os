// ─── MAKE OS — Aufgaben: Abhängigkeiten „B wartet auf A“ (rein, 28.09. spät) ─
// Führend ist `Task.abhaengigVon` (Kennungen). Das alte Feld `dependencies` ({ blockedByTaskId, resolvedAt }) lesen
// noch ältere Ansichten (components/os/Abhaengigkeit.tsx, lib/make-one/abhaengigkeiten.ts) — es wird daraus abgeleitet,
// `resolvedAt` bleibt erhalten. Schreibt jemand nur `dependencies` (alte Ansicht), gewinnt diese Änderung.
// Kreise („A wartet auf B wartet auf A“) lehnt der Server ab (409, lib/aufgaben/speicher.ts).

import type { Dependency, Task } from '@/types/tasks';

const gleich = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const ausDeps = (d: readonly Dependency[] | undefined): string[] => Array.from(new Set((d ?? []).map(x => x.blockedByTaskId).filter(Boolean)));

/** `dependencies` aus `abhaengigVon` — vorhandene `resolvedAt` bleiben. */
export function depsAus(ids: readonly string[], alt: readonly Dependency[] | undefined): Dependency[] {
  return ids.map(id => { const d = alt?.find(x => x.blockedByTaskId === id); return d?.resolvedAt ? { blockedByTaskId: id, resolvedAt: d.resolvedAt } : { blockedByTaskId: id }; });
}

/**
 * Beide Felder angleichen. Mit `vorher` (Schreibweg): wer sich geändert hat, gewinnt — `abhaengigVon` vor `dependencies`.
 * Ohne `vorher` (Übernahme): `abhaengigVon` führt, fehlt es, kommt es aus `dependencies`. Verweise auf Aufgaben, die es
 * nicht (mehr) gibt, fallen weg, wenn `vorhanden` mitkommt. Idempotent.
 */
export function abhaengigAngleichen<T extends Pick<Task, 'id' | 'dependencies' | 'abhaengigVon'>>(t: T, vorher?: Pick<Task, 'dependencies' | 'abhaengigVon'> | null, vorhanden?: ReadonlySet<string>): T {
  const neuIds = t.abhaengigVon ?? [];
  const deps = ausDeps(t.dependencies);
  let ids: string[];
  if (vorher) {
    const abhGeaendert = !gleich(neuIds, vorher.abhaengigVon ?? ausDeps(vorher.dependencies));
    const depsGeaendert = !gleich(deps, ausDeps(vorher.dependencies));
    ids = abhGeaendert || !depsGeaendert ? (t.abhaengigVon ?? deps) : deps;
  } else {
    ids = t.abhaengigVon ?? deps;
  }
  ids = Array.from(new Set(ids.filter(id => id !== t.id && (!vorhanden || vorhanden.has(id)))));
  const dependencies = depsAus(ids, t.dependencies);
  const n = { ...t, dependencies } as T;
  if (ids.length) n.abhaengigVon = ids; else delete n.abhaengigVon;
  return n;
}

/**
 * Gibt es einen Kreis, der eine der geprüften Aufgaben berührt? Liefert die Kette (Kennungen) oder null.
 * `abhaengigVon` muss angeglichen sein.
 */
export function kreisBei(tasks: readonly Pick<Task, 'id' | 'abhaengigVon'>[], pruefen: Iterable<string>): string[] | null {
  const nachId = new Map(tasks.map(t => [t.id, t]));
  for (const start of pruefen) {
    // Tiefensuche von `start` entlang „wartet auf“: kommt man zu `start` zurück, ist es ein Kreis.
    const weg: string[] = [];
    const gesehen = new Set<string>();
    const suche = (id: string): boolean => {
      for (const n of nachId.get(id)?.abhaengigVon ?? []) {
        if (n === start) { weg.push(n); return true; }
        if (gesehen.has(n) || !nachId.has(n)) continue;
        gesehen.add(n); weg.push(n);
        if (suche(n)) return true;
        weg.pop();
      }
      return false;
    };
    if (suche(start)) return [start, ...weg];
  }
  return null;
}

/** Würde „vonId wartet auf aufId“ einen Kreis schließen? (Für die Auswahl im Detail.) */
export function wuerdeKreisen(vonId: string, aufId: string, tasks: readonly Pick<Task, 'id' | 'abhaengigVon'>[]): boolean {
  if (vonId === aufId) return true;
  const mit = tasks.map(t => (t.id === vonId ? { ...t, abhaengigVon: [...(t.abhaengigVon ?? []), aufId] } : t));
  return !!kreisBei(mit, [vonId]);
}

/** Die Aufgaben, auf die `t` noch wartet (nicht erledigt). */
export function wartetAuf<T extends Pick<Task, 'id' | 'status'>>(t: Pick<Task, 'abhaengigVon'>, alle: readonly T[]): T[] {
  if (!t.abhaengigVon?.length) return [];
  const nachId = new Map(alle.map(x => [x.id, x]));
  return t.abhaengigVon.map(id => nachId.get(id)).filter((x): x is T => !!x && x.status !== 'done');
}
