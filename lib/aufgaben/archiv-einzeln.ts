// ─── MAKE OS — Eine Aufgabe archivieren und zurückholen (rein, 04.10.) ──────
// Kevin 04.10.: „…nach links swiped: dann kommt da Löschen oder Archivieren.“ Archivieren = ausblenden, jederzeit zurück.
// Es gibt dafür KEIN neues Feld: dieselbe Marke wie „Neu anfangen“ (`archiviertAm` + `archivId`, lib/aufgaben/neustart.ts),
// die alle Leser schon ausblenden (`ohneArchiv` in `aufgabenSicht`, Kalender, Meilensteine, Heute, Lichtfäden …).
//   · Die Kennung `ea-<Kennung der Aufgabe>` unterscheidet das Einzel-Archiv von den Läufen (`na-…`): die Aufgabe nimmt
//     ihren ganzen Teilbaum mit (wie der Papierkorb `geloeschtMit`); Zurückholen holt genau diese Kette.
//   · Läufe von „Neu anfangen“ bleiben unberührt: ihre Marken setzt und löscht nur der Server (`archivMarkeSchuetzen`).
//   · Serien ruhen, solange die offene Instanz im Archiv liegt (eine offene Instanz gibt es ja noch) — zurück = läuft weiter.
// Tests: tests/zeile-aktionen.test.ts.

import type { Task, TasksState } from '@/types/tasks';
import { nachfahrenIn, vorfahren, nachIdKarte } from './ebenen';
import { sonstigeProjektId, istSonstigeProjekt } from './struktur';

/** Marke des Einzel-Archivs (die Läufe von „Neu anfangen“ heißen `na-…`). */
export const EINZEL_ARCHIV = /^ea-[A-Za-z0-9_.:-]{1,77}$/;
export const istEinzelMarke = (archivId: string | undefined): boolean => !!archivId && EINZEL_ARCHIV.test(archivId);
/** Die Marke einer Wurzel — Kennungen sind höchstens 80 Zeichen, die Marke bleibt es auch. */
export const einzelMarke = (id: string): string => `ea-${id}`.slice(0, 80);
/** Liegt im Einzel-Archiv (egal ob als Wurzel oder mitgenommen)? */
export const imEinzelArchiv = (t: Pick<Task, 'archiviertAm' | 'archivId'> | undefined | null): boolean => !!t?.archiviertAm && istEinzelMarke(t.archivId);

/** Aufgabe archivieren — samt Teilbaum (was nicht schon im Papierkorb/Archiv liegt). Unsichtbar/unbekannt → unverändert. */
export function aufgabeArchivieren(state: TasksState, id: string, jetzt: string): TasksState {
  const t0 = state.tasks.find(x => x.id === id);
  if (!t0 || t0.geloeschtAm || t0.archiviertAm) return state;
  const marke = einzelMarke(id);
  const mit = new Set([id, ...nachfahrenIn(id, state.tasks).filter(t => !t.geloeschtAm && !t.archiviertAm).map(t => t.id)]);
  return { ...state, tasks: state.tasks.map(t => (mit.has(t.id) ? { ...t, archiviertAm: jetzt, archivId: marke, updatedAt: jetzt } : t)) };
}

/**
 * Zurückholen — genau die Kette dieser Marke. Liegt das Projekt inzwischen im Papierkorb/Archiv (oder fehlt), kommt die
 * Aufgabe nach „Sonstige“ ihres Space; ist ihr Elternteil weg, wird sie eine Hauptaufgabe (wie beim Papierkorb).
 */
export function aufgabeAusArchiv(state: TasksState, id: string, jetzt: string): TasksState {
  const marke = einzelMarke(id);
  const t0 = state.tasks.find(x => x.id === id);
  if (!t0 || t0.archivId !== marke) return state;
  const projekt = state.projects.find(p => p.id === t0.projectId);
  const projektWeg = !projekt ? !istSonstigeProjekt(t0.projectId) : !!(projekt.geloeschtAm || projekt.archiviertAm);
  const nachId = nachIdKarte(state.tasks);
  const eltern = t0.parentId ? nachId.get(t0.parentId) : undefined;
  const elternWeg = !!t0.parentId && (!eltern || [eltern, ...vorfahren(eltern, nachId)].some(v => v.geloeschtAm || v.archiviertAm));
  return {
    ...state,
    tasks: state.tasks.map(t => {
      if (t.archivId !== marke) return t;
      let n: Task = { ...t, updatedAt: jetzt };
      delete n.archiviertAm; delete n.archivId;
      if (projektWeg) { n = { ...n, projectId: sonstigeProjektId(n.spaceId ?? 'privat') }; delete n.listeId; }
      if (t.id === id && elternWeg) delete n.parentId;
      return n;
    }),
  };
}

export interface ArchivierteAufgabe { id: string; titel: string; spaceId?: string; projectId: string; archiviertAm: string; /** Mitgenommene Unteraufgaben. */ mit: number; erledigt: boolean }
/** Die Wurzeln des Einzel-Archivs, neueste zuerst. */
export function einzelnArchiviert(state: Pick<TasksState, 'tasks'>): ArchivierteAufgabe[] {
  const je = new Map<string, number>();
  for (const t of state.tasks) if (imEinzelArchiv(t)) je.set(t.archivId!, (je.get(t.archivId!) ?? 0) + 1);
  return state.tasks
    .filter(t => imEinzelArchiv(t) && t.archivId === einzelMarke(t.id) && !t.geloeschtAm)
    .map(t => ({ id: t.id, titel: t.title, ...(t.spaceId ? { spaceId: t.spaceId } : {}), projectId: t.projectId, archiviertAm: t.archiviertAm!, mit: (je.get(t.archivId!) ?? 1) - 1, erledigt: t.status === 'done' || t.status === 'cancelled' }))
    .sort((a, b) => b.archiviertAm.localeCompare(a.archiviertAm));
}

/**
 * Schreibweg (Server, `aufgabenAendern`): der Browser darf NUR die Einzel-Marke setzen oder lösen. Trägt die gespeicherte
 * Aufgabe die Marke eines Laufs von „Neu anfangen“, bleibt sie, wie sie ist; eine fremde/halbe Marke fällt weg.
 */
export function archivMarkeSchuetzen(n: Task, alt: Task | undefined): Task {
  if (alt?.archiviertAm && alt.archivId && !istEinzelMarke(alt.archivId)) return { ...n, archiviertAm: alt.archiviertAm, archivId: alt.archivId };
  if (n.archiviertAm && istEinzelMarke(n.archivId)) return n;
  if (n.archiviertAm === undefined && n.archivId === undefined) return n;
  const ohne = { ...n };
  delete ohne.archiviertAm; delete ohne.archivId;
  return ohne;
}
