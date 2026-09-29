// Kalender K3 (30.09.): Aufgaben im Kalender — Sichtbarkeit (abgebrochen, Papierkorb, Archiv, fremde „nur ich“ fehlen),
// Balken Start → Deadline, Unteraufgaben gekennzeichnet, Einplanen per Ziehen (Deadline + Uhrzeit, Start wandert mit),
// Seitenliste „Ohne Termin“. Erfundene Daten.
import { describe, it, expect } from 'vitest';
import { aufgabenFuerKalender, ganztagsAm, mitZeitAm, abschnittAm, einplanenTeil, ohneTermin, zeitAusMinuten, imKalenderSichtbar } from '../lib/kalender/aufgaben';
import type { Task } from '../types/tasks';

const t = (id: string, x: Partial<Task> = {}): Task => ({
  id, projectId: 'p-1', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0,
  createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T08:00:00.000Z', spaceId: 'privat', ...x,
} as Task);
const f = { sicht: 'alle' as const, bereich: 'alle' as const, ich: 'kevin' };

describe('Aufgaben im Kalender (K3)', () => {
  it('zeigt nur offene, sichtbare Aufgaben — ohne Abgebrochene, Papierkorb, Archiv und fremde „nur ich“', () => {
    const liste = [
      t('a', { dueDate: '2026-10-01' }),
      t('b', { dueDate: '2026-10-01', status: 'cancelled' }),
      t('c', { dueDate: '2026-10-01', geloeschtAm: '2026-09-29T10:00:00.000Z' }),
      t('d', { dueDate: '2026-10-01', archiviertAm: '2026-09-29T10:00:00.000Z' }),
      t('e', { dueDate: '2026-10-01', sichtbarkeit: 'nur-ich', angelegtVon: 'malin' }),
      t('f', { dueDate: '2026-10-01', sichtbarkeit: 'nur-ich', angelegtVon: 'kevin' }),
      t('g', { dueDate: '2026-10-01', status: 'done' }),
      t('h', { dueDate: '2026-10-01', parentId: 'e' }),
    ];
    expect(aufgabenFuerKalender(liste, '2026-09-28', '2026-10-05', f).map(x => x.id)).toEqual(['a', 'f']);
    expect(imKalenderSichtbar(t('x', { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin' }))).toBe(false);
  });

  it('Balken vom Start bis zur Deadline, Uhrzeit als Block, Unteraufgabe mit Eltern-Titel', () => {
    const liste = aufgabenFuerKalender([
      t('lang', { startDate: '2026-09-29', dueDate: '2026-10-01', dueTime: '14:30' }),
      t('eltern', { title: 'Angebot Nord', dueDate: '2026-10-02' }),
      t('unter', { parentId: 'eltern', dueDate: '2026-09-30' }),
    ], '2026-09-28', '2026-10-05', f);
    expect(liste.find(x => x.id === 'unter')).toMatchObject({ eltern: 'Angebot Nord', tag: '2026-09-30' });
    const lang = liste.find(x => x.id === 'lang')!;
    expect(lang).toMatchObject({ start: '2026-09-29', tag: '2026-10-01', zeit: '14:30' });
    expect(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].map(d => abschnittAm(lang, d))).toEqual([null, 'start', 'mitte', 'ende', null]);
    // Am Deadline-Tag steht die Aufgabe mit Uhrzeit als Block im Raster, davor als Balken in der Ganztags-Zeile.
    expect(ganztagsAm(liste, '2026-09-30').map(x => [x.id, x.abschnitt])).toEqual([['lang', 'mitte'], ['unter', 'einzel']]);
    expect(ganztagsAm(liste, '2026-10-01').map(x => x.id)).toEqual([]);
    expect(mitZeitAm(liste, '2026-10-01').map(x => x.id)).toEqual(['lang']);
    // Ein Balken, der vor dem Zeitraum beginnt und darin endet, ist dabei; einer, der danach beginnt, nicht.
    expect(aufgabenFuerKalender([t('x', { startDate: '2026-09-20', dueDate: '2026-09-28' })], '2026-09-28', '2026-10-05', f)).toHaveLength(1);
    expect(aufgabenFuerKalender([t('y', { startDate: '2026-10-05', dueDate: '2026-10-09' })], '2026-09-28', '2026-10-05', f)).toHaveLength(0);
  });

  it('Sicht und Bereich: verantwortlich/beteiligt, Gemeinsam = mehrere, Business nach Space', () => {
    const liste = [t('k', { dueDate: '2026-10-01' }), t('m', { dueDate: '2026-10-01', assignee: 'malin', beteiligte: ['kevin'] }), t('b', { dueDate: '2026-10-01', spaceId: 'kdc' })];
    expect(aufgabenFuerKalender(liste, '2026-09-28', '2026-10-05', { ...f, sicht: 'malin' }).map(x => x.id)).toEqual(['m']);
    expect(aufgabenFuerKalender(liste, '2026-09-28', '2026-10-05', { ...f, sicht: 'beide' }).map(x => x.id)).toEqual(['m']);
    expect(aufgabenFuerKalender(liste, '2026-09-28', '2026-10-05', { ...f, bereich: 'business' }).map(x => x.id)).toEqual(['b']);
    expect(aufgabenFuerKalender(liste, '2026-09-28', '2026-10-05', { ...f, suche: 'aufgabe k' }).map(x => x.id)).toEqual(['k']);
  });

  it('Einplanen: Deadline + Uhrzeit, Start wandert mit, ohne Uhrzeit entfernt sie, unverändert → null', () => {
    expect(einplanenTeil({}, '2026-10-02', '09:15')).toEqual({ dueDate: '2026-10-02', dueTime: '09:15' });
    expect(einplanenTeil({ dueDate: '2026-10-01', startDate: '2026-09-28', dueTime: '14:00' }, '2026-10-03', '14:00')).toEqual({ dueDate: '2026-10-03', startDate: '2026-09-30' });
    const weg = einplanenTeil({ dueDate: '2026-10-01', dueTime: '14:00' }, '2026-10-01', null)!;
    expect('dueTime' in weg && weg.dueTime === undefined).toBe(true);
    expect(einplanenTeil({ dueDate: '2026-10-01', dueTime: '14:00' }, '2026-10-01', '14:00')).toBeNull();
    expect(einplanenTeil({}, 'morgen', null)).toBeNull();
    expect(zeitAusMinuten(9 * 60 + 22)).toBe('09:15');
    expect(zeitAusMinuten(24 * 60 + 30)).toBe('23:45');
  });

  it('Ohne Termin: offen, ohne Deadline, kritisch zuerst', () => {
    const liste = [t('a'), t('b', { priority: 'critical' }), t('c', { dueDate: '2026-10-01' }), t('d', { status: 'cancelled' })];
    expect(ohneTermin(liste, f).map(x => x.id)).toEqual(['b', 'a']);
  });
});
