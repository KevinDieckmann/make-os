// ─── MAKE OS — Aufgaben-Abhängigkeiten ──────────────────────────────────────
// Kevins Ansage: „Abhängigkeitsmöglichkeiten reinbringen" — abgeschaut bei
// monday (Abhängigkeit direkt an der Zeile setzen, Finish-to-Start) und awork
// (Vorgänger im Aufgaben-Detail, mit Status-Farbe; Erledigen löst auf).
//
// Das Feld dafür gab es im Datenmodell von Anfang an (Task.dependencies),
// benutzt hat es nie jemand. Die Auflösung beim Erledigen sitzt im Reducer
// (TasksContext, TOGGLE_TASK) — hier stehen nur die Lese-Helfer.

import type { Task } from '@/types/tasks';

/** Die Aufgaben, auf die diese hier noch wartet (unaufgelöste Blocker). */
export function offeneBlocker(t: Task, alle: Task[]): Task[] {
  if (!t.dependencies?.length) return [];
  const nachId = new Map(alle.map(x => [x.id, x]));
  return t.dependencies
    .filter(d => !d.resolvedAt)
    .map(d => nachId.get(d.blockedByTaskId))
    .filter((x): x is Task => !!x && x.status !== 'done');
}

/** Wartet die Aufgabe noch auf etwas? */
export function istBlockiert(t: Task, alle: Task[]): boolean {
  return offeneBlocker(t, alle).length > 0;
}

/**
 * Würde „vonId wartet auf aufId" einen Kreis schließen? Dann dürfte keine der
 * beiden je fertig werden. Läuft die Kette von aufId aus rückwärts ab.
 */
export function wuerdeKreis(vonId: string, aufId: string, alle: Task[]): boolean {
  if (vonId === aufId) return true;
  const nachId = new Map(alle.map(x => [x.id, x]));
  const gesehen = new Set<string>();
  const stapel = [aufId];
  while (stapel.length) {
    const id = stapel.pop()!;
    if (id === vonId) return true;
    if (gesehen.has(id)) continue;
    gesehen.add(id);
    for (const d of nachId.get(id)?.dependencies ?? []) stapel.push(d.blockedByTaskId);
  }
  return false;
}

/**
 * Terminkonflikt wie bei monday (flexible Sicht): die wartende Aufgabe ist
 * früher fällig als ihr Blocker — das kann nicht aufgehen.
 */
export function terminKonflikt(t: Task, alle: Task[]): Task | null {
  if (!t.dueDate) return null;
  for (const b of offeneBlocker(t, alle)) {
    if (b.dueDate && b.dueDate > t.dueDate) return b;
  }
  return null;
}
