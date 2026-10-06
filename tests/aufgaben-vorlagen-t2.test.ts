// ─── Vorlagen (29.09., #69/#70): Gruppen per Index, Versatz in Werktagen (NRW), Fassung ──
import { describe, it, expect } from 'vitest';
import type { Task, TasksState } from '@/types/tasks';
import { ausVorlageAnlegen, vorlageAusProjekt, werktageZwischen, deadlineAus } from '@/lib/aufgaben/vorlagen';
import { vorlageSauber } from '@/lib/aufgaben/saeubern';

const T0 = '2026-09-01T08:00:00.000Z';
const aufgabe = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: 'p', title: `A ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdc', ...extra });
const stand = (): TasksState => ({
  projects: [{ id: 'p', title: 'Launch', category: 'business', owner: 'both', color: '#fff', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdc' }],
  gruppen: [{ id: 'g1', projektId: 'p', titel: 'Team', farbe: '#FF7EB6', sortOrder: 0 }, { id: 'g2', projektId: 'p', titel: 'Team', farbe: '#4FC3F7', sortOrder: 1 }],
  listen: [{ id: 'l1', projektId: 'p', titel: 'Eins', sortOrder: 0, gruppeId: 'g1' }, { id: 'l2', projektId: 'p', titel: 'Zwei', sortOrder: 1, gruppeId: 'g2' }],
  tasks: [aufgabe('a', { listeId: 'l1', dueDate: '2026-10-02' }), aufgabe('b', { listeId: 'l2', dueDate: '2026-10-06' })],
  statusEigen: [], vorlagen: [],
});

describe('Vorlagen T2', () => {
  it('#69: zwei Gruppen mit gleichem Titel — jede Liste landet in ihrer eigenen (seit 06.10. nach der Regel des Umbaus v3)', () => {
    // Vorher: `vorlageAusProjekt` schrieb `gruppen` + `gruppeIndex`, `ausVorlageAnlegen` legte Gruppen an (neu-g1, neu-g2) und hängte die
    // Listen hinein. Seit 06.10. gibt es keine Gruppen mehr: eine Vorlage von damals (mit Gruppen) wird beim Anwenden umgesetzt —
    // Gruppe → Liste (mit Farbe), ihre Liste → Aufgabe, deren Aufgaben → Unteraufgaben; der Index hält gleichnamige Gruppen weiter auseinander.
    const v = { id: 'v1', art: 'projekt' as const, titel: 'Launch', inhalt: {
      gruppen: [{ titel: 'Team', farbe: '#FF7EB6' }, { titel: 'Team', farbe: '#4FC3F7' }],
      listen: [{ titel: 'Eins', gruppe: 'Team', gruppeIndex: 0, aufgaben: [{ titel: 'A a', versatzTage: 1 }] }, { titel: 'Zwei', gruppe: 'Team', gruppeIndex: 1, aufgaben: [{ titel: 'A b', versatzTage: 5 }] }],
    } };
    expect(vorlageAusProjekt(stand(), 'p', { id: 'v-neu', jetzt: T0 })!.inhalt.gruppen).toBeUndefined();
    const r = ausVorlageAnlegen(v, stand(), { spaceId: 'kdc', start: '2026-11-02', owner: 'kevin', praefix: 'neu', jetzt: T0 });
    expect(r.listen.map(l => [l.id, l.titel, l.farbe, l.gruppeId])).toEqual([['neu-l1', 'Team', '#FF7EB6', undefined], ['neu-l2', 'Team', '#4FC3F7', undefined]]);
    expect(r.tasks.map(t => [t.id, t.title, t.listeId, t.parentId ?? null])).toEqual([
      ['neu-l1-a1', 'Eins', 'neu-l1', null], ['neu-l1-a1-u1', 'A a', 'neu-l1', 'neu-l1-a1'],
      ['neu-l2-a1', 'Zwei', 'neu-l2', null], ['neu-l2-a1-u1', 'A b', 'neu-l2', 'neu-l2-a1'],
    ]);
    // Die Säuberung behält den Index (nur gültige).
    const s = vorlageSauber({ ...v, inhalt: { ...v.inhalt, listen: [{ ...v.inhalt.listen![0], gruppeIndex: 7 }, v.inhalt.listen![1]] } })!;
    expect(s.inhalt.listen!.map(l => l.gruppeIndex)).toEqual([undefined, 1]);
  });

  it('#70: Versatz in Werktagen ohne Feiertage NRW; Fassung an Projekt und Aufgaben', () => {
    // Do 01.10. → Fr 02.10. = 1 Werktag; → Di 06.10. = 3 (Sa, So, Mo 05.10. zählt, 03.10. ist Feiertag + Samstag).
    expect(werktageZwischen('2026-10-01', '2026-10-02')).toBe(1);
    expect(werktageZwischen('2026-10-01', '2026-10-06')).toBe(3);
    expect(deadlineAus('2026-10-02', 1, 'werktage')).toBe('2026-10-05');
    expect(deadlineAus('2026-10-02', 1, 'tage')).toBe('2026-10-03');
    const v = vorlageAusProjekt(stand(), 'p', { id: 'v2', bezugsTag: '2026-10-01', jetzt: T0, werktage: true })!;
    expect(v.inhalt.versatzArt).toBe('werktage');
    expect(v.version).toBe(1);
    expect(v.inhalt.listen!.map(l => l.aufgaben[0].versatzTage)).toEqual([1, 3]);
    // Start an einem Samstag → ab dem nächsten Werktag gezählt, nie auf Wochenende/Feiertag.
    const r = ausVorlageAnlegen({ ...v, version: 3 }, stand(), { spaceId: 'kdc', start: '2026-12-19', owner: 'kevin', praefix: 'x', jetzt: T0 });
    expect(r.tasks.map(t => t.dueDate)).toEqual(['2026-12-22', '2026-12-24']);
    expect(r.projekt!.vorlageVersion).toBe(3);
    expect(r.tasks.every(t => t.vorlageVersion === 3)).toBe(true);
  });
});
