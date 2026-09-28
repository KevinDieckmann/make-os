// ─── MAKE OS — Aufgaben-Überblick und Projekt-Fortschritt (rein, 28.09. spät) ─
// Kevin (~22:30): „/os/aufgaben startet mit einem Überblick — oben Kacheln (meine offenen, heute fällig, überfällig,
// wartet auf Freigabe), darunter je Privat, Firma, Mandant eine Karte mit offenen/fälligen Aufgaben und Projekten.“
// Gezählt werden oberste Aufgaben UND Unteraufgaben (jede ist eine eigene Arbeit); erledigt und abgebrochen zählen nicht.
// Seit 29.09. (Paket T1): „Meine“ = verantwortlich; eine Aufgabe, die noch auf eine andere wartet (`abhaengigVon`), ist
// nicht „überfällig“, sondern „wartet“ (#36) — eigene Kachel-Art `wartet` und Zahl je Space.

import type { Task, TasksState, Project } from '@/types/tasks';
import { istSonstigeProjekt, sonstigeProjektId, istOffen as offenStatus, type AufgabenSpace } from './struktur';
import { wartetAuf } from './abhaengig';

export type KachelArt = 'meine' | 'beteiligt' | 'heute' | 'ueberfaellig' | 'wartet' | 'freigabe';
export interface ProjektStand { id: string; titel: string; farbe: string; offen: number; fertig: number; gesamt: number; ueberfaellig: number; heute: number; blockiert: number; naechste?: string }
export interface SpaceStand { space: AufgabenSpace; offen: number; heute: number; ueberfaellig: number; /** Offen, aber wartet noch auf eine andere Aufgabe (29.09.). */ wartet: number; projekte: ProjektStand[] }

const istOffen = (t: Task) => offenStatus(t);
const meine = (t: Task, ich: string) => !!ich && (t.assignee === ich || t.assignee === 'both');
const beteiligt = (t: Task, ich: string) => !!ich && (t.beteiligte ?? []).includes(ich);
/** Wartet die Aufgabe noch auf eine andere (nicht erledigte)? */
export const wartetNoch = (t: Task, alle: readonly Task[]): boolean => wartetAuf(t, alle).length > 0;

/** Die Aufgaben einer Kachel (offen), nach Deadline — „überfällig“ ohne die, die noch warten (die stehen unter „wartet“). */
export function kachelAufgaben(tasks: readonly Task[], art: KachelArt, ich: string, heute: string): Task[] {
  const l = tasks.filter(t => istOffen(t) && (
    art === 'meine' ? meine(t, ich)
      : art === 'beteiligt' ? beteiligt(t, ich)
        : art === 'heute' ? t.dueDate?.slice(0, 10) === heute
          : art === 'ueberfaellig' ? !!t.dueDate && t.dueDate.slice(0, 10) < heute && !wartetNoch(t, tasks)
            : art === 'wartet' ? wartetNoch(t, tasks)
              : t.zoe?.status === 'wartet_freigabe'));
  return l.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.title.localeCompare(b.title, 'de') || a.id.localeCompare(b.id));
}

/** Stand eines Projekts: offen/erledigt, überfällig, heute, blockiert, nächste Deadline. */
export function projektStand(state: TasksState, projekt: Pick<Project, 'id' | 'title' | 'color'>, heute: string): ProjektStand {
  // Abgebrochene zählen weder als offen noch als fertig (29.09.).
  const alle = state.tasks.filter(t => t.projectId === projekt.id && t.status !== 'cancelled');
  const offen = alle.filter(istOffen);
  const naechste = offen.map(t => t.dueDate?.slice(0, 10)).filter((d): d is string => !!d && d >= heute).sort()[0];
  return {
    id: projekt.id, titel: projekt.title, farbe: projekt.color, offen: offen.length, fertig: alle.length - offen.length, gesamt: alle.length,
    ueberfaellig: offen.filter(t => !!t.dueDate && t.dueDate.slice(0, 10) < heute && !wartetNoch(t, state.tasks)).length,
    heute: offen.filter(t => t.dueDate?.slice(0, 10) === heute).length,
    blockiert: offen.filter(t => wartetAuf(t, state.tasks).length > 0).length,
    ...(naechste ? { naechste } : {}),
  };
}

/** Karten je Space: offene/fällige Aufgaben und die Projekte (aktive zuerst, „Sonstige“ nur mit Aufgaben). */
export function spaceStaende(state: TasksState, spaces: readonly AufgabenSpace[], heute: string): SpaceStand[] {
  return spaces.map(space => {
    const im = state.tasks.filter(t => t.spaceId === space.id && istOffen(t));
    const projekte = state.projects.filter(p => p.spaceId === space.id && !p.archived && p.status !== 'abgeschlossen')
      .map(p => projektStand(state, p, heute))
      .sort((a, b) => b.ueberfaellig - a.ueberfaellig || b.offen - a.offen || a.titel.localeCompare(b.titel, 'de'));
    const sonst = im.filter(t => istSonstigeProjekt(t.projectId) || !state.projects.some(p => p.id === t.projectId));
    if (sonst.length) projekte.push(projektStand(state, { id: sonstigeProjektId(space.id), title: 'Sonstige', color: '#6E7A7D' }, heute));
    return {
      space, offen: im.length,
      heute: im.filter(t => t.dueDate?.slice(0, 10) === heute).length,
      ueberfaellig: im.filter(t => !!t.dueDate && t.dueDate.slice(0, 10) < heute && !wartetNoch(t, state.tasks)).length,
      wartet: im.filter(t => wartetNoch(t, state.tasks)).length,
      projekte,
    };
  });
}
