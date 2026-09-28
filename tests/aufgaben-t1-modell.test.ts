// ─── Paket T1 · Datenmodell (29.09.): Feiertage NRW, „nur ich“, eine Verantwortliche + Beteiligte, „abgebrochen“ ──
// Rein, ohne Datenordner. Erfundene Kennungen, keine echten Daten.
import { describe, it, expect } from 'vitest';
import { ostersonntag, feiertageNRW, istFeiertag, istWerktag, werktagePlus, werktagAbOder } from '@/lib/aufgaben/feiertage';
import { sichtFuer, darfSehen, aufgabenFuerPerson } from '@/lib/aufgaben/sicht';
import { beideAufloesen, alleZustaendigen, istVerantwortlich, istBeteiligt } from '@/lib/aufgaben/zustaendig';
import { taskSauber, wiederholungSauber, kommentareSauber, ZuGross } from '@/lib/aufgaben/saeubern';
import { passtFilter, fortschritt, istAbgeschlossen, istOffen, statusListe, grundVon } from '@/lib/aufgaben/struktur';
import type { Task, TasksState } from '@/types/tasks';

const T0 = '2026-09-01T08:00:00.000Z';
const a = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: 'p1', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'privat', ...extra });
const stand = (tasks: Task[]): TasksState => ({ projects: [], tasks, listen: [], statusEigen: [], gruppen: [], vorlagen: [] });

describe('Feiertage NRW (Gauß)', () => {
  it('Ostersonntag 2026–2028 und bekannte Jahre', () => {
    expect(ostersonntag(2026)).toBe('2026-04-05');
    expect(ostersonntag(2027)).toBe('2027-03-28');
    expect(ostersonntag(2028)).toBe('2028-04-16');
    expect(ostersonntag(2019)).toBe('2019-04-21');
    expect(ostersonntag(1981)).toBe('1981-04-19'); // Sonderregel 26. April → 19. April
    expect(ostersonntag(2049)).toBe('2049-04-18'); // Sonderregel 25. April → 18. April
  });
  it('alle elf Feiertage 2026, 2027, 2028', () => {
    const tage = (j: number) => feiertageNRW(j).map(f => f.tag);
    expect(tage(2026)).toEqual(['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-05-14', '2026-05-25', '2026-06-04', '2026-10-03', '2026-11-01', '2026-12-25', '2026-12-26']);
    expect(tage(2027)).toEqual(['2027-01-01', '2027-03-26', '2027-03-29', '2027-05-01', '2027-05-06', '2027-05-17', '2027-05-27', '2027-10-03', '2027-11-01', '2027-12-25', '2027-12-26']);
    expect(tage(2028)).toEqual(['2028-01-01', '2028-04-14', '2028-04-17', '2028-05-01', '2028-05-25', '2028-06-05', '2028-06-15', '2028-10-03', '2028-11-01', '2028-12-25', '2028-12-26']);
    expect(feiertageNRW(2026).find(f => f.tag === '2026-06-04')?.name).toBe('Fronleichnam');
    expect(feiertageNRW(2026).find(f => f.tag === '2026-11-01')?.name).toBe('Allerheiligen');
    expect(istFeiertag('2026-12-24')).toBe(false); // Heiligabend ist kein gesetzlicher Feiertag
  });
  it('Werktage ohne Feiertage', () => {
    expect(istWerktag('2026-10-02')).toBe(true); // Freitag
    expect(istWerktag('2026-10-03')).toBe(false); // Samstag + Einheit
    expect(istWerktag('2027-10-01')).toBe(true);
    expect(istWerktag('2028-06-15')).toBe(false); // Fronleichnam (Donnerstag)
    expect(istWerktag('2028-06-15', null)).toBe(true); // ohne Land nur Mo–Fr
    expect(werktagePlus('2026-04-02', 1)).toBe('2026-04-07'); // Do → über Karfreitag, Wochenende, Ostermontag
    expect(werktagePlus('2026-04-07', -1)).toBe('2026-04-02');
    expect(werktagAbOder('2026-12-24')).toBe('2026-12-24');
    expect(werktagAbOder('2026-12-25')).toBe('2026-12-28');
  });
});

describe('Sichtbarkeit „nur ich“ (rein)', () => {
  const s = stand([
    a('offen1'),
    a('geheim', { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin' }),
    a('geheim-kind', { parentId: 'geheim' }),
    a('malin-geheim', { sichtbarkeit: 'nur-ich', angelegtVon: 'malin', assignee: 'malin' }),
    a('ohne-anlegerin', { sichtbarkeit: 'nur-ich' }),
  ]);
  it('Anlegerin sieht ihre, die andere nicht — Unteraufgaben erben', () => {
    expect(sichtFuer(s, 'kevin').tasks.map(t => t.id)).toEqual(['offen1', 'geheim', 'geheim-kind']);
    expect(sichtFuer(s, 'malin').tasks.map(t => t.id)).toEqual(['offen1', 'malin-geheim']);
  });
  it('Systemlauf (ohne Person) sieht keine „nur ich“-Aufgabe', () => {
    expect(sichtFuer(s, null).tasks.map(t => t.id)).toEqual(['offen1']);
    expect(aufgabenFuerPerson(s.tasks, undefined).map(t => t.id)).toEqual(['offen1']);
  });
  it('ohne „nur ich“ im Bestand: derselbe Stand (keine Kopie)', () => {
    const leer = stand([a('x')]);
    expect(sichtFuer(leer, 'kevin')).toBe(leer);
    expect(darfSehen(a('y'), null)).toBe(true);
  });
});

describe('Eine Verantwortliche + Beteiligte', () => {
  const personen = ['kevin', 'malin'];
  it('„both“: Anlegerin verantwortlich, die andere beteiligt, Status bleibt', () => {
    const r = beideAufloesen(a('b1', { assignee: 'both', angelegtVon: 'malin', status: 'in-progress' }), personen);
    expect(r.task.assignee).toBe('malin');
    expect(r.task.beteiligte).toEqual(['kevin']);
    expect(r.task.status).toBe('in-progress');
    expect(r.geraten).toBe(false);
  });
  it('Anlegerin aus dem Verlauf, sonst Schreiberin, sonst letzte Schreiberin — sonst erste Person + Hinweis', () => {
    const v = beideAufloesen(a('b2', { assignee: 'both', verlauf: [{ am: T0, von: 'malin', was: 'angelegt' }, { am: T0, von: 'kevin', was: 'titel' }] }), personen);
    expect(v.task.assignee).toBe('malin');
    expect(beideAufloesen(a('b3', { assignee: 'both' }), personen, 'malin').task.assignee).toBe('malin');
    const z = beideAufloesen(a('b4', { assignee: 'both', verlauf: [{ am: T0, von: 'system', durch: 'system', was: 'angelegt' }, { am: T0, von: 'malin', was: 'status' }] }), personen);
    expect(z.task.assignee).toBe('malin');
    expect(z.geraten).toBe(false);
    const g = beideAufloesen(a('b5', { assignee: 'both' }), personen);
    expect(g.task.assignee).toBe('kevin');
    expect(g.task.beteiligte).toEqual(['malin']);
    expect(g.geraten).toBe(true);
  });
  it('idempotent; ohne Personen unverändert; Verantwortliche nie unter den Beteiligten', () => {
    const r = beideAufloesen(a('b6', { assignee: 'both', angelegtVon: 'kevin' }), personen).task;
    expect(beideAufloesen(r, personen).geaendert).toBe(false);
    expect(beideAufloesen(a('b7', { assignee: 'both' }), []).geaendert).toBe(false);
    expect(beideAufloesen(a('b8', { assignee: 'malin', beteiligte: ['malin', 'kevin'] }), personen).task.beteiligte).toEqual(['kevin']);
  });
  it('Meine = verantwortlich, Filter „beteiligt“ zusätzlich', () => {
    const t = a('m1', { assignee: 'malin', beteiligte: ['kevin'] });
    expect(istVerantwortlich(t, 'kevin')).toBe(false);
    expect(istBeteiligt(t, 'kevin')).toBe(true);
    expect(passtFilter(t, { wer: 'meine', ich: 'kevin', status: 'offen', faellig: 'alle' }, '2026-09-29')).toBe(false);
    expect(passtFilter(t, { wer: 'beteiligt', ich: 'kevin', status: 'offen', faellig: 'alle' }, '2026-09-29')).toBe(true);
    expect(alleZustaendigen(t, ['kevin', 'malin'])).toEqual(['malin', 'kevin']);
  });
});

describe('Status „abgebrochen“', () => {
  it('ist abgeschlossen, aber nicht erledigt — Fortschritt nimmt ihn heraus, Filter „offen“ zeigt ihn nicht', () => {
    const t = a('c1', { status: 'cancelled', dueDate: '2026-01-01' });
    expect(istAbgeschlossen(t)).toBe(true);
    expect(istOffen(t)).toBe(false);
    expect(passtFilter(t, { wer: 'alle', status: 'offen', faellig: 'alle' }, '2026-09-29')).toBe(false);
    expect(passtFilter(t, { wer: 'alle', status: 'alle', faellig: 'ueberfaellig' }, '2026-09-29')).toBe(false);
    expect(fortschritt([{ status: 'done' }, { status: 'cancelled' }, { status: 'todo' }])).toEqual({ fertig: 1, gesamt: 2 });
    expect(grundVon('cancelled').label).toBe('Abgebrochen');
    expect(statusListe('privat', [{ id: 'verworfen', spaceId: 'privat', label: 'Verworfen', farbe: '#000000', basis: 'cancelled', sortOrder: 0 }]).map(s => s.id)).toContain('verworfen');
  });
  it('Säuberung nimmt „cancelled“ an', () => {
    expect(taskSauber({ ...a('c2'), status: 'cancelled' })?.status).toBe('cancelled');
  });
});

describe('Säuberung der neuen Felder', () => {
  it('Beteiligte, Sichtbarkeit, Anlegerin', () => {
    const t = taskSauber({ ...a('s1'), beteiligte: ['malin', 'malin', 'Böse Person', 7], sichtbarkeit: 'nur-ich', angelegtVon: 'kevin' })!;
    expect(t.beteiligte).toEqual(['malin']);
    expect(t.sichtbarkeit).toBe('nur-ich');
    expect(t.angelegtVon).toBe('kevin');
    expect(taskSauber({ ...a('s2'), sichtbarkeit: 'alle' })!.sichtbarkeit).toBeUndefined();
    expect(() => taskSauber({ ...a('s3'), beteiligte: Array.from({ length: 21 }, (_, i) => `p${i}`) })).toThrow(ZuGross);
  });
  it('Serien-Extras', () => {
    const w = wiederholungSauber({ regel: 'woechentlich', ab: 'erledigt', rotation: ['kevin', 'malin', '??'], feiertage: 'NRW', ausnahmen: ['2026-10-05', '2026-10-05', 'morgen'], serieBeendet: true })!;
    expect(w).toEqual({ regel: 'woechentlich', ab: 'erledigt', rotation: ['kevin', 'malin'], feiertage: 'NRW', ausnahmen: ['2026-10-05'], serieBeendet: true });
    expect(wiederholungSauber({ regel: 'taeglich', feiertage: 'BY' })!.feiertage).toBeUndefined();
  });
  it('Kommentar weich entfernt', () => {
    const k = kommentareSauber([{ id: 'k1', von: 'kevin', text: 'Frist 15.10. zugesagt', am: T0, entfernt: { am: T0, von: 'kevin' } }, { id: 'k2', von: 'kevin', text: 'x', am: T0, entfernt: { am: 'gestern', von: 'kevin' } }])!;
    expect(k[0].entfernt).toEqual({ am: T0, von: 'kevin' });
    expect(k[1].entfernt).toBeUndefined();
  });
});
