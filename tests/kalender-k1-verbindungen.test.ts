// Kalender K1 (29.09.): Verbindungen — Aufgabe als Termin ist DIESELBE Aufgabe (dueDate + dueTime, keine Kopie),
// Fokuszeit ↔ Zeitmessung (terminUid am laufenden Fokus und am Block, übersteht das Umzuordnen). Erfundene Daten.
import { describe, it, expect } from 'vitest';
import { taskSauber } from '../lib/aufgaben/saeubern';
import { verlaufFuer } from '../lib/aufgaben/verlauf';
import { laufendSaeubern } from '../lib/zeitmessung/fokus-regeln';
import { fokusVerbuchen, blockZuordnen, LEER_ZEIT } from '../lib/zeitmessung/modell';
import type { Task } from '../types/tasks';

const J = '2026-09-29T10:00:00.000Z';
const basis = { id: 't-1', title: 'Angebot', projectId: 'p', status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: J, updatedAt: J };

describe('Aufgabe mit Uhrzeit (dueTime)', () => {
  it('nur „HH:MM“ und nur mit Deadline', () => {
    expect(taskSauber({ ...basis, dueDate: '2026-10-02', dueTime: '14:30' })?.dueTime).toBe('14:30');
    expect(taskSauber({ ...basis, dueDate: '2026-10-02', dueTime: '25:00' })?.dueTime).toBeUndefined();
    expect(taskSauber({ ...basis, dueTime: '14:30' })).not.toHaveProperty('dueTime');
  });
  it('der Verlauf nennt die Uhrzeit an der Deadline', () => {
    const alt = taskSauber({ ...basis, dueDate: '2026-10-02' }) as Task;
    const neu = { ...alt, dueTime: '14:30' };
    expect(verlaufFuer(alt, neu, { person: 'kevin' }, J)).toEqual([expect.objectContaining({ was: 'deadline', vorher: '2026-10-02', nachher: '2026-10-02 14:30' })]);
  });
});

describe('Fokuszeit ↔ Zeitmessung', () => {
  it('der laufende Fokus behält die Termin-UID (Server-Säuberung)', () => {
    const jetzt = Date.parse(J);
    expect(laufendSaeubern({ von: J, schluessel: 'business:fokuszeit', label: 'Deep Work', terminUid: 'ABC-1', mandatId: 'm-1' }, jetzt)).toEqual({ von: J, schluessel: 'business:fokuszeit', label: 'Deep Work', terminUid: 'ABC-1', mandatId: 'm-1' });
    expect(laufendSaeubern({ von: J, schluessel: 'privat:fokuszeit', label: 'x', terminUid: 'a\nb' }, jetzt)).not.toHaveProperty('terminUid');
  });
  it('der Block trägt die UID — Umzuordnen (Aufgabe/Mandat) lässt sie stehen', () => {
    const d = fokusVerbuchen(LEER_ZEIT, { von: J, bis: '2026-09-29T11:00:00.000Z', schluessel: 'business:fokuszeit', label: 'Deep Work', terminUid: 'ABC-1', mandatId: 'm-1' });
    const block = Object.values(d.tage)[0].bloecke[0];
    expect(block).toMatchObject({ terminUid: 'ABC-1', mandatId: 'm-1', sek: 3600 });
    const z = blockZuordnen(d, J, { aufgabeId: 't-9' });
    expect(Object.values(z.datei.tage)[0].bloecke[0]).toEqual({ von: J, bis: '2026-09-29T11:00:00.000Z', schluessel: 'business:fokuszeit', label: 'Deep Work', sek: 3600, terminUid: 'ABC-1', aufgabeId: 't-9' });
  });
});
