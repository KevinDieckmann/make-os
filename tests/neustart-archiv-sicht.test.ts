// ─── Sichtprüfung 29.09., F6 — Archiv-Ansicht nach „Alles wiederherstellen“ ──
// Verlust-Szenario (Anzeige) nachgebaut: nach dem Wiederherstellen standen Projekt-Aufgaben unter „Aufgaben ohne Projekt“,
// und dieselbe Serie (erledigtes Original + neue Instanz) stand doppelt unter „Serien ruhen“, obwohl die Vorschau
// „1 Serie“ sagte. Rein, erfundene Aufgaben.
import { describe, it, expect } from 'vitest';
import type { Task, TasksState } from '@/types/tasks';
import { aufgabenArchivieren, aufgabenZurueck, aufgabenVorschau, archivSicht } from '@/lib/aufgaben/neustart';

const T0 = '2026-09-01T08:00:00.000Z';
const JETZT = '2026-09-30T06:00:00.000Z';
const LAUF = 'na-f6-pruefung';
const aufgabe = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: 'p1', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'privat', ...extra });
const REGEL = { regel: 'woechentlich' as const, wochentage: [1] };
const stand = (): TasksState => ({
  projects: [
    { id: 'p1', title: 'Haus', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat' },
  ],
  gruppen: [], listen: [], statusEigen: [], vorlagen: [],
  tasks: [
    aufgabe('a1'),
    aufgabe('a1-u', { parentId: 'a1' }),
    aufgabe('a2'),
    // Eine Serie: das erledigte Original und die neue Instanz tragen beide den Rhythmus.
    aufgabe('s-alt', { title: 'Wochenrückblick', status: 'done', completedAt: T0, wiederholung: REGEL, serieId: 's-alt' }),
    aufgabe('s-neu', { title: 'Wochenrückblick', wiederholung: REGEL, serieId: 's-alt' }),
    aufgabe('lose', { projectId: 'sonstige-privat' }),
  ],
});

describe('Archiv-Ansicht eines Laufs (F6)', () => {
  const vorher = stand();
  const { state: archiviert, erfasst } = aufgabenArchivieren(vorher, LAUF, JETZT);

  it('im Archiv: Projekt-Aufgaben stehen beim Projekt, nur die lose Aufgabe ohne Projekt; die Serie einmal', () => {
    expect(aufgabenVorschau(vorher).serien).toHaveLength(1);
    const s = archivSicht(archiviert, LAUF, erfasst);
    expect(s.projekte).toEqual([expect.objectContaining({ id: 'p1', aufgaben: 4, zurueck: false })]);
    expect(s.aufgaben.map(a => a.id)).toEqual(['lose']);
    expect(s.serien).toEqual([{ art: 'aufgabe', titel: 'Wochenrückblick', regel: 'woechentlich', zurueck: false }]);
  });

  it('nach „Alles wiederherstellen“: dieselbe Einteilung, alles als zurück markiert, Serie weiter einmal', () => {
    const zurueck = aufgabenZurueck(archiviert, LAUF, { art: 'alles' }, erfasst.pausiert).state;
    const s = archivSicht(zurueck, LAUF, erfasst);
    expect(s.aufgaben.map(a => a.id)).toEqual(['lose']);
    expect(s.aufgaben.every(a => a.zurueck)).toBe(true);
    expect(s.projekte).toEqual([expect.objectContaining({ id: 'p1', aufgaben: 4, zurueck: true })]);
    expect(s.serien).toEqual([{ art: 'aufgabe', titel: 'Wochenrückblick', regel: 'woechentlich', zurueck: true }]);
  });

  it('nur eine Aufgabe zurück (Hülle kommt mit): die übrigen Projekt-Aufgaben sind einzeln zurückzuholen', () => {
    const z = aufgabenZurueck(archiviert, LAUF, { art: 'aufgabe', id: 'a1' }, erfasst.pausiert).state;
    const s = archivSicht(z, LAUF, erfasst);
    // a1 ist zurück und gehört wieder zum Projekt; a2 und die Serie liegen noch im Archiv → lose, einzeln zurückholbar.
    expect(s.aufgaben.map(a => a.id).sort()).toEqual(['a2', 'lose', 's-alt', 's-neu'].sort());
    expect(s.projekte[0]).toMatchObject({ zurueck: true, aufgaben: 1 });
    expect(s.serien[0].zurueck).toBe(false);
  });
});
