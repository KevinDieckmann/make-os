// ─── Papierkorb für Projekte und Aufgaben (rein, 29.09., A7) ────────────────
import { describe, it, expect } from 'vitest';
import type { Task, TasksState, Project } from '@/types/tasks';
import {
  aufgabenSicht, projektInPapierkorb, aufgabeInPapierkorb, wiederherstellen, endgueltigEntfernen, papierkorbEintraege, papierkorbAbgelaufen,
  projektUmfang, aufgabeUmfang, umfangText,
} from '@/lib/aufgaben/papierkorb';
import { serienLauf, serienAufgabenNachholen } from '@/lib/aufgaben/serie';

const T0 = '2026-09-01T08:00:00.000Z';
const J = '2026-09-29T10:00:00.000Z';
const aufgabe = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: 'p', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...extra });
const projekt = (id: string, extra: Partial<Project> = {}): Project => ({ id, title: `Projekt ${id}`, category: 'business', owner: 'both', color: '#000000', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...extra });
const bestand = (): TasksState => ({
  projects: [projekt('p', { notiz: 'Notiz', beschreibung: 'Kurz', felder: [{ id: 'f', name: 'F', typ: 'text' }] }), projekt('q')],
  tasks: [aufgabe('a'), aufgabe('a-u', { parentId: 'a' }), aufgabe('b', { listeId: 'l1' }), aufgabe('q1', { projectId: 'q' })],
  listen: [{ id: 'l1', projektId: 'p', titel: 'Januar', sortOrder: 0 }], statusEigen: [], gruppen: [{ id: 'g1', projektId: 'p', titel: 'Marketing', farbe: '#000000', sortOrder: 0 }], vorlagen: [],
});

describe('Papierkorb', () => {
  it('Projekt: samt Aufgaben hinein; Sicht blendet Projekt, Aufgaben, Listen, Gruppen aus; Umfang für die Rückfrage', () => {
    const s = bestand();
    expect(umfangText(projektUmfang(s, 'p', 2))).toBe('2 Aufgaben, 1 Unteraufgabe, 1 Liste, Notiz, Beschreibung, 1 Feld, 2 Dateien');
    const k = projektInPapierkorb(s, 'p', J);
    expect(k.projects.find(p => p.id === 'p')).toMatchObject({ geloeschtAm: J, notiz: 'Notiz' });
    expect(k.tasks.filter(t => t.geloeschtMit === 'p').map(t => t.id).sort()).toEqual(['a', 'a-u', 'b']);
    const sicht = aufgabenSicht(k);
    expect(sicht.projects.map(p => p.id)).toEqual(['q']);
    expect(sicht.tasks.map(t => t.id)).toEqual(['q1']);
    expect(sicht.listen).toEqual([]);
    expect(sicht.gruppen).toEqual([]);
    expect(papierkorbEintraege(k)).toEqual([expect.objectContaining({ art: 'projekt', id: 'p', mit: 3, bisTag: '2026-10-29' })]);
  });

  it('Wiederherstellen holt die ganze Kette; eine einzeln gelöschte Aufgabe bleibt drin', () => {
    const s = aufgabeInPapierkorb(bestand(), 'b', '2026-09-28T10:00:00.000Z');
    const k = projektInPapierkorb(s, 'p', J);
    // b lag schon vorher drin (eigene Wurzel) — geht nicht „mit“ dem Projekt.
    expect(k.tasks.find(t => t.id === 'b')!.geloeschtMit).toBeUndefined();
    const w = wiederherstellen(k, 'projekt', 'p', J);
    expect(w.tasks.find(t => t.id === 'a')!.geloeschtAm).toBeUndefined();
    expect(w.tasks.find(t => t.id === 'a-u')!.geloeschtAm).toBeUndefined();
    expect(w.tasks.find(t => t.id === 'b')!.geloeschtAm).toBe('2026-09-28T10:00:00.000Z');
  });

  it('Aufgabe wiederherstellen, deren Projekt noch im Papierkorb liegt → „Sonstige“ ihres Space (ohne Liste)', () => {
    const k = projektInPapierkorb(aufgabeInPapierkorb(bestand(), 'b', T0), 'p', J);
    const w = wiederherstellen(k, 'aufgabe', 'b', J);
    expect(w.tasks.find(t => t.id === 'b')).toMatchObject({ projectId: 'sonstige-kdv' });
    expect(w.tasks.find(t => t.id === 'b')!.listeId).toBeUndefined();
    expect(aufgabenSicht(w).tasks.map(t => t.id)).toContain('b');
  });

  it('Endgültig nur aus dem Papierkorb; samt Kette, Listen und Gruppen des Projekts; liefert die Kennungen für die Dateien', () => {
    expect(endgueltigEntfernen(bestand(), 'projekt', 'p').projekte).toEqual([]);
    const r = endgueltigEntfernen(projektInPapierkorb(bestand(), 'p', J), 'projekt', 'p');
    expect(r.projekte).toEqual(['p']);
    expect(r.aufgaben.sort()).toEqual(['a', 'a-u', 'b']);
    expect(r.state.listen).toEqual([]);
    expect(r.state.gruppen).toEqual([]);
    expect(r.state.tasks.map(t => t.id)).toEqual(['q1']);
  });

  it('Aufgabe: Umfang nennt Unteraufgaben, Notiz, Felder, Dateien', () => {
    const s = bestand();
    s.tasks[0] = { ...s.tasks[0], notiz: 'x', felder: { f: 'y' } };
    expect(umfangText(aufgabeUmfang(s, 'a', 1))).toBe('1 Unteraufgabe, Notiz, 1 Feld, 1 Datei');
    expect(umfangText(aufgabeUmfang(s, 'q1'))).toBe('');
  });

  it('Abgelaufen (30 Tage): Wurzeln; Kette-Mitglieder gehen mit ihrer Wurzel', () => {
    const k = projektInPapierkorb(aufgabeInPapierkorb(bestand(), 'q1', '2026-09-20T00:00:00.000Z'), 'p', '2026-08-01T00:00:00.000Z');
    expect(papierkorbAbgelaufen(k, J)).toEqual([{ art: 'projekt', id: 'p' }]);
    expect(papierkorbAbgelaufen(k, '2026-10-21T00:00:00.000Z')).toEqual([{ art: 'projekt', id: 'p' }, { art: 'aufgabe', id: 'q1' }]);
  });

  it('Serien ruhen im Papierkorb: keine neue Liste für ein gelöschtes Projekt, keine neue Instanz nach gelöschter Aufgabe', () => {
    const s = bestand();
    s.listen = [{ id: 'l1', projektId: 'p', titel: 'Monat', sortOrder: 0, wiederholung: { regel: 'monatlich', monatstag: 1, naechste: '2026-09-01' } }];
    expect(serienLauf(s, '2026-09-29', J).neueListen).toHaveLength(1);
    expect(serienLauf(projektInPapierkorb(s, 'p', J), '2026-09-29', J).neueListen).toHaveLength(0);
    const erledigt = aufgabe('w', { status: 'done', completedAt: '2026-09-27T10:00:00.000Z', dueDate: '2026-09-27', wiederholung: { regel: 'taeglich' } });
    expect(serienAufgabenNachholen([erledigt], '2026-09-29', J)).toHaveLength(1);
    expect(serienAufgabenNachholen([{ ...erledigt, geloeschtAm: J }], '2026-09-29', J)).toHaveLength(0);
  });
});
