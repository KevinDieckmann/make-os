// ─── Aufgaben wie Monday/ClickUp (28.09. abends) — reine Regeln ─────────────
// Spaces (fest + Mandanten aus dem CRM + Archiv), Übernahme des Altbestands (kein Verlust, Sonstige),
// Baum Projekt → Liste → Aufgabe → Unteraufgabe, eigene Status (basis), Filter, Erwähnungen, Säuberung.
// Nur erfundene Daten.
import { describe, it, expect } from 'vitest';
import {
  alleSpaces, mandantenSpaces, istSpaceId, einheitVonSpace, uebernehmen, baum, statusListe, statusVon, statusTeil, grundVon,
  passtFilter, erwaehnungen, unteraufgabeId, sonstigeProjektId, istSonstigeProjekt, spaceFuerAltProjekt, FILTER_STANDARD, MANDANT_EINHEIT,
} from '@/lib/aufgaben/struktur';
import { taskSauber, kommentareVereinen, statusSauber, ZuGross, AUFGABEN_GRENZEN } from '@/lib/aufgaben/saeubern';
import { spaceVonAufgabe } from '@/lib/make-one/space-regeln';
import type { Task, TasksState, Project } from '@/types/tasks';

const T0 = '2026-09-01T08:00:00.000Z';
const aufgabe = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: 'p-x', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, ...extra });
const projekt = (id: string, category: Project['category'], extra: Partial<Project> = {}): Project => ({ id, title: `Projekt ${id}`, category, owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, ...extra });

describe('Spaces', () => {
  const crm = {
    firmen: [{ id: 'f-aktiv', name: 'Beispiel Aktiv GmbH' }, { id: 'f-alt', name: 'Beispiel Alt AG' }, { id: 'f-ohne', name: 'Beispiel Ohne' }],
    mandate: [
      { id: 'm1', firmaId: 'f-aktiv', status: 'aktiv' }, { id: 'm2', firmaId: 'f-alt', status: 'beendet' },
      { id: 'm3', firmaId: 'f-ohne', status: 'angebot' }, { id: 'm4', firmaId: 'f-alt', status: 'pausiert' },
    ],
  };
  it('fest: Privat, Selbstständigkeit, KD Ventures, MAKE Innovation GmbH — Mandanten aus aktiven Mandaten, beendet → Archiv', () => {
    const s = alleSpaces(crm);
    expect(s.map(x => x.id)).toEqual(['privat', 'kdc', 'kdv', 'ug', 'm-f-aktiv', 'm-f-alt']);
    expect(s.find(x => x.id === 'm-f-aktiv')).toMatchObject({ art: 'mandant', firmaId: 'f-aktiv', bereich: 'business', label: 'Beispiel Aktiv GmbH' });
    expect(s.find(x => x.id === 'm-f-aktiv')!.archiv).toBeUndefined();
    expect(s.find(x => x.id === 'm-f-alt')!.archiv).toBe(true);
    // Nur Angebot → kein Space
    expect(s.some(x => x.id === 'm-f-ohne')).toBe(false);
  });
  it('Aufgaben in einem Mandanten-Space ohne aktives Mandat (auch Firma gelöscht) bleiben lesbar — im Archiv', () => {
    const s = mandantenSpaces(crm, ['m-f-ohne', 'm-f-weg', 'kdv', undefined]);
    expect(s.find(x => x.id === 'm-f-ohne')!.archiv).toBe(true);
    expect(s.find(x => x.id === 'm-f-weg')).toMatchObject({ archiv: true, label: 'Mandant (nicht mehr im CRM)' });
  });
  it('Kennungen und Einheit je Space', () => {
    expect(['privat', 'kdc', 'kdv', 'ug', 'm-f-abc'].every(istSpaceId)).toBe(true);
    expect(['business', 'm-', 'M-f-x', 'kemaris', ''].some(istSpaceId)).toBe(false);
    expect(einheitVonSpace('privat')).toBeUndefined();
    expect(einheitVonSpace('kdc')).toBe('Selbstständigkeit');
    expect(einheitVonSpace('ug')).toBe('MAKE Innovation GmbH');
    expect(einheitVonSpace('m-f-abc')).toBe(MANDANT_EINHEIT);
  });
  it('spaceVonAufgabe folgt spaceId (alle alten Leser)', () => {
    expect(spaceVonAufgabe({ id: 'a', title: 'Wohnung', projectId: 'proj-privat', spaceId: 'kdv' })).toBe('business');
    expect(spaceVonAufgabe({ id: 'a', title: 'KD Ventures Vertrag', projectId: 'proj-kdm', spaceId: 'privat' })).toBe('privat');
  });
});

describe('Übernahme des Altbestands', () => {
  const alt: TasksState = {
    projects: [projekt('proj-kdm', 'business', { title: 'KD Ventures' }), projekt('proj-privat', 'joint', { title: 'Zuhause' }), projekt('proj-sb', 'business', { title: 'Selbständigkeit Buchhaltung' })],
    tasks: [
      aufgabe('t-biz', { projectId: 'proj-kdm', title: 'Vertrag prüfen' }),
      aufgabe('t-priv', { projectId: 'proj-privat', title: 'Wohnung streichen' }),
      aufgabe('t-ug', { projectId: 'proj-kdm', title: 'Gesellschafterliste', space: 'business', einheit: 'MAKE Innovation GmbH' }),
      aufgabe('t-sb', { projectId: 'proj-sb', title: 'Belege sammeln' }),
      aufgabe('t-ohne', { projectId: 'proj-weg', title: 'Irgendwas', space: 'privat' }),
      aufgabe('t-sub', { projectId: 'proj-privat', title: 'Umzug', subTasks: [
        { id: 's1', taskId: 't-sub', title: 'Kartons', completed: true, sortOrder: 0, createdAt: T0, updatedAt: T0 },
        { id: 's2', taskId: 't-sub', title: 'Transporter', completed: false, sortOrder: 1, createdAt: T0, updatedAt: T0 },
      ] }),
    ],
  };
  it('Projekte und Aufgaben bekommen ihren Space, keine Aufgabe geht verloren', () => {
    const { state, geaendert } = uebernehmen(alt);
    expect(geaendert).toBe(true);
    const p = Object.fromEntries(state.projects.map(x => [x.id, x.spaceId]));
    expect(p).toEqual({ 'proj-kdm': 'kdv', 'proj-privat': 'privat', 'proj-sb': 'kdc' });
    const t = Object.fromEntries(state.tasks.map(x => [x.id, x]));
    expect(t['t-biz']).toMatchObject({ spaceId: 'kdv', space: 'business', einheit: 'KD Ventures' });
    expect(t['t-priv']).toMatchObject({ spaceId: 'privat', space: 'privat' });
    expect(t['t-priv'].einheit).toBeUndefined();
    expect(t['t-ug']).toMatchObject({ spaceId: 'ug', einheit: 'MAKE Innovation GmbH' });
    expect(t['t-sb']).toMatchObject({ spaceId: 'kdc', einheit: 'Selbstständigkeit' });
    // Projekt gibt es nicht mehr → bleibt stehen, der Baum zeigt es unter „Sonstige“.
    expect(t['t-ohne']).toMatchObject({ spaceId: 'privat', projectId: 'proj-weg' });
    for (const x of alt.tasks) expect(t[x.id]).toBeTruthy();
    expect(state.tasks.find(x => x.id === 't-biz')!.title).toBe('Vertrag prüfen');
  });
  it('alte subTasks werden echte Unteraufgaben (mit Status), idempotent', () => {
    const eins = uebernehmen(alt).state;
    const s1 = eins.tasks.find(x => x.id === unteraufgabeId('t-sub', 's1'))!;
    const s2 = eins.tasks.find(x => x.id === unteraufgabeId('t-sub', 's2'))!;
    expect(s1).toMatchObject({ parentId: 't-sub', title: 'Kartons', status: 'done', spaceId: 'privat', projectId: 'proj-privat' });
    expect(s2).toMatchObject({ parentId: 't-sub', title: 'Transporter', status: 'todo' });
    expect(eins.tasks.find(x => x.id === 't-sub')!.subTasks).toEqual([]);
    const zwei = uebernehmen(eins);
    expect(zwei.geaendert).toBe(false);
    expect(zwei.state.tasks).toHaveLength(eins.tasks.length);
    expect(JSON.stringify(zwei.state)).toBe(JSON.stringify(eins));
  });
  it('Unteraufgaben: mehrstufig (01.10.), erben Space/Projekt/Liste von der Hauptaufgabe; ohne Elternteil werden sie normale Aufgaben', () => {
    const st: TasksState = {
      projects: [projekt('p1', 'business')], listen: [{ id: 'l-jan', projektId: 'p1', titel: 'Januar', sortOrder: 0 }], statusEigen: [],
      tasks: [
        aufgabe('a', { projectId: 'p1', spaceId: 'kdv', listeId: 'l-jan' }),
        aufgabe('b', { parentId: 'a', spaceId: 'privat', projectId: 'x' }),
        aufgabe('c', { parentId: 'b', spaceId: 'privat' }),
        aufgabe('d', { parentId: 'weg', spaceId: 'ug' }),
      ],
    };
    const t = Object.fromEntries(uebernehmen(st).state.tasks.map(x => [x.id, x]));
    expect(t.b).toMatchObject({ parentId: 'a', spaceId: 'kdv', projectId: 'p1', listeId: 'l-jan', space: 'business' });
    expect(t.c).toMatchObject({ parentId: 'b', spaceId: 'kdv', projectId: 'p1', listeId: 'l-jan', space: 'business' }); // Enkel bleibt unter b (vorher: an a gehängt)
    expect(t.d.parentId).toBeUndefined();
    expect(t.d.projectId).toBe('p-x');
  });
  it('Liste eines anderen Projekts fällt weg (Sonstige), Projekt fehlt → Sonstige des Space', () => {
    const st: TasksState = { projects: [projekt('p1', 'business'), projekt('p2', 'business')], listen: [{ id: 'l1', projektId: 'p1', titel: 'Januar', sortOrder: 0 }], statusEigen: [],
      tasks: [aufgabe('a', { projectId: 'p2', listeId: 'l1', spaceId: 'kdv' }), aufgabe('b', { projectId: '', spaceId: 'ug' }), aufgabe('c', { projectId: sonstigeProjektId('kdv'), spaceId: 'ug' })] };
    const t = Object.fromEntries(uebernehmen(st).state.tasks.map(x => [x.id, x]));
    expect(t.a.listeId).toBeUndefined();
    expect(t.b.projectId).toBe('sonstige-ug');
    expect(t.c.projectId).toBe('sonstige-ug');
    expect(istSonstigeProjekt('sonstige-m-f-abc')).toBe(true);
    expect(istSonstigeProjekt('sonstige-xyz')).toBe(false);
  });
  it('eigene Einheit bleibt im Business stehen, Kerneinheit folgt dem Space', () => {
    const st = uebernehmen({ projects: [], tasks: [aufgabe('a', { spaceId: 'kdc', einheit: 'Projekt Nord' }), aufgabe('b', { spaceId: 'kdc', einheit: 'KD Ventures' }), aufgabe('c', { spaceId: 'm-f-x', einheit: 'KD Ventures' })] }).state;
    expect(st.tasks.map(t => t.einheit)).toEqual(['Projekt Nord', 'Selbstständigkeit', 'Kunden']);
  });
  it('alte Projekte: persönlich/gemeinsam → Privat, Business → Selbstständigkeit per Text, sonst KD Ventures', () => {
    expect(spaceFuerAltProjekt(projekt('a', 'personal-malin'))).toBe('privat');
    expect(spaceFuerAltProjekt(projekt('a', 'business', { title: 'Consulting Kunden' }))).toBe('kdc');
    expect(spaceFuerAltProjekt(projekt('a', 'business', { title: 'KEMARIS' }))).toBe('kdv');
  });
});

describe('Baum', () => {
  const st: TasksState = uebernehmen({
    projects: [projekt('p-buch', 'business', { title: 'Buchhaltung', spaceId: 'kdc' }), projekt('p-leer', 'business', { title: 'Leer', spaceId: 'kdc' }), projekt('p-kdv', 'business', { title: 'Fremd', spaceId: 'kdv' })],
    listen: [{ id: 'l-feb', projektId: 'p-buch', titel: 'Februar', sortOrder: 1 }, { id: 'l-jan', projektId: 'p-buch', titel: 'Januar', sortOrder: 0 }],
    statusEigen: [],
    tasks: [
      aufgabe('belege', { projectId: 'p-buch', listeId: 'l-jan', spaceId: 'kdc', title: 'Fehlende Belege' }),
      aufgabe('beleg-1', { parentId: 'belege', spaceId: 'kdc', title: 'Beleg Tankstelle' }),
      aufgabe('ust', { projectId: 'p-buch', spaceId: 'kdc', title: 'USt-Voranmeldung', status: 'done' }),
      aufgabe('lose', { projectId: 'sonstige-kdc', spaceId: 'kdc', title: 'Lose Aufgabe' }),
      aufgabe('fremd', { projectId: 'p-kdv', spaceId: 'kdc', title: 'Im fremden Projekt' }),
      aufgabe('privat', { projectId: 'p-buch', spaceId: 'privat' }),
    ],
  }).state;
  it('Projekt → Listen (Reihenfolge, dann Sonstige) → Aufgaben → Unteraufgaben; fremde Projekte und Sonstige am Ende', () => {
    const b = baum(st, 'kdc');
    expect(b.map(p => p.titel)).toEqual(['Buchhaltung', 'Leer', 'Fremd', 'Sonstige']);
    const buch = b[0];
    expect(buch.listen.map(l => l.titel)).toEqual(['Januar', 'Februar', 'Sonstige']);
    expect(buch.listen[0].aufgaben[0].task.id).toBe('belege');
    expect(buch.listen[0].aufgaben[0].unter.map(u => u.id)).toEqual(['beleg-1']);
    expect(buch.listen[2].aufgaben.map(a => a.task.id)).toEqual(['ust']);
    expect(buch.offen).toBe(1);
    expect(b[2]).toMatchObject({ fremd: true });
    expect(b[3]).toMatchObject({ virtuell: true, id: 'sonstige-kdc' });
    // Die private Aufgabe im selben Projekt steht nicht im Firmen-Space (seit 05.10. trägt der Space der Selbstständigkeit selbst `space: 'privat'`).
    expect(JSON.stringify(b)).not.toContain('"id":"privat"');
  });
  it('Filter: Aufgabe erscheint, wenn sie oder eine Unteraufgabe passt; ohne Treffer steht „Sonstige“ nicht leer herum', () => {
    const nurOffen = baum(st, 'kdc', t => t.status !== 'done');
    expect(nurOffen[0].listen.find(l => l.titel === 'Sonstige')).toBeUndefined();
    const nurBeleg = baum(st, 'kdc', t => t.id === 'beleg-1', false);
    expect(nurBeleg.map(p => p.titel)).toEqual(['Buchhaltung']);
    expect(nurBeleg[0].listen[0].aufgaben[0].task.id).toBe('belege');
  });
});

describe('Status', () => {
  const eigene = [
    { id: 'st-pruefung', spaceId: 'kdc', label: 'Beim Steuerbüro', farbe: '#A99BF5', basis: 'blocked' as const, sortOrder: 0 },
    { id: 'st-abgelegt', spaceId: 'kdc', label: 'Abgelegt', farbe: '#3DE28B', basis: 'done' as const, sortOrder: 0 },
    { id: 'st-anders', spaceId: 'kdv', label: 'Anderswo', farbe: '#6E7A7D', basis: 'todo' as const, sortOrder: 0 },
  ];
  it('fest: Offen · In Arbeit · Wartend · Erledigt · Abgebrochen (29.09.); backlog zählt als Offen; eigene hinter ihrem Grundstatus', () => {
    expect(statusListe('kdc', eigene).map(s => s.label)).toEqual(['Offen', 'In Arbeit', 'Wartend', 'Beim Steuerbüro', 'Erledigt', 'Abgelegt', 'Abgebrochen']);
    expect(grundVon('backlog').label).toBe('Offen');
  });
  it('eigener Status setzt status = basis (alle Leser verstehen „erledigt“); Wechsel zurück entfernt statusId', () => {
    const t = aufgabe('a', { spaceId: 'kdc' });
    const teil = statusTeil(t, 'st-abgelegt', eigene, T0);
    expect(teil).toEqual({ status: 'done', statusId: 'st-abgelegt', completedAt: T0 });
    expect(statusVon({ ...t, ...teil }, eigene).label).toBe('Abgelegt');
    expect(statusTeil({ ...t, ...teil }, 'in-progress', eigene)).toMatchObject({ status: 'in-progress', statusId: undefined, completedAt: undefined });
    // Status eines anderen Space gilt nicht.
    expect(statusTeil(t, 'st-anders', eigene).statusId).toBeUndefined();
  });
  it('Übernahme: passt der Grundstatus, bleibt der eigene; direkt gesetzter status (Heads, Abhaken) gewinnt; fremde/unbekannte fallen weg', () => {
    const st = uebernehmen({ projects: [], statusEigen: eigene, tasks: [
      aufgabe('a', { spaceId: 'kdc', statusId: 'st-pruefung', status: 'blocked' }),
      aufgabe('z', { spaceId: 'kdc', statusId: 'st-pruefung', status: 'done' }),
      aufgabe('b', { spaceId: 'kdc', statusId: 'st-anders' }),
      aufgabe('c', { spaceId: 'kdc', statusId: 'st-weg', status: 'in-progress' }),
    ] }).state;
    expect(st.tasks.map(t => [t.status, t.statusId])).toEqual([['blocked', 'st-pruefung'], ['done', undefined], ['todo', undefined], ['in-progress', undefined]]);
  });
  it('Säuberung eines eigenen Status: Kennung, Space, Farbe, Grundstatus; feste Kennungen verboten', () => {
    expect(statusSauber({ id: 'st-x', spaceId: 'kdc', label: 'Beim Steuerbüro', farbe: '#A99BF5', basis: 'blocked', sortOrder: 2 })).toMatchObject({ basis: 'blocked' });
    expect(statusSauber({ id: 'done', spaceId: 'kdc', label: 'X', basis: 'done' })).toBeNull();
    expect(statusSauber({ id: 'st-y', spaceId: 'business', label: 'X' })).toBeNull();
    expect(statusSauber({ id: 'st-z', spaceId: 'kdc', label: 'X', farbe: 'rot', basis: 'quatsch' })).toMatchObject({ farbe: '#6E7A7D', basis: 'todo' });
  });
});

describe('Filter, Erwähnungen, Säuberung', () => {
  it('meine/alle, Status, fällig', () => {
    const h = '2026-09-28';
    const f = FILTER_STANDARD;
    expect(passtFilter(aufgabe('a', { assignee: 'malin' }), { ...f, wer: 'meine', ich: 'kevin' }, h)).toBe(false);
    expect(passtFilter(aufgabe('a', { assignee: 'both' }), { ...f, wer: 'meine', ich: 'kevin' }, h)).toBe(true);
    expect(passtFilter(aufgabe('a', { status: 'done' }), f, h)).toBe(false);
    expect(passtFilter(aufgabe('a', { status: 'backlog' }), { ...f, status: 'todo' }, h)).toBe(true);
    expect(passtFilter(aufgabe('a', { dueDate: '2026-09-27' }), { ...f, faellig: 'ueberfaellig' }, h)).toBe(true);
    expect(passtFilter(aufgabe('a', { dueDate: '2026-10-04' }), { ...f, faellig: 'woche' }, h)).toBe(true);
    expect(passtFilter(aufgabe('a', { dueDate: '2026-10-06' }), { ...f, faellig: 'woche' }, h)).toBe(false);
    expect(passtFilter(aufgabe('a'), { ...f, faellig: 'ohne' }, h)).toBe(true);
  });
  it('@-Erwähnung über Speichername oder Vorname, ohne Doppelte, keine E-Mail-Adressen', () => {
    const p = [{ speicher: 'kevin', namen: ['Kevin'] }, { speicher: 'malin', namen: ['Malin'] }];
    expect(erwaehnungen('@Malin kannst du bitte, danke @kevin und nochmal @malin', p)).toEqual(['malin', 'kevin']);
    expect(erwaehnungen('schreib an info@malin.de', p)).toEqual([]);
    expect(erwaehnungen('@niemand', p)).toEqual([]);
  });
  it('taskSauber: neue Felder, Grenzen → ZuGross statt kürzen', () => {
    const t = taskSauber({ ...aufgabe('a'), spaceId: 'm-f-abc', listeId: 'l-1', parentId: 'a', statusId: 'st-1', startDate: '2026-10-01', bezug: { kontaktId: 'c-anna-beispiel', firmaId: 'f-x', mandatId: 'mandat-1', dealId: 'deal-1', quatsch: 1 }, kommentare: [{ id: 'k1', von: 'kevin', text: ' Hallo @malin ', am: T0, erwaehnt: ['malin', 'Böse Person'] }] })!;
    expect(t).toMatchObject({ spaceId: 'm-f-abc', listeId: 'l-1', statusId: 'st-1', startDate: '2026-10-01', bezug: { kontaktId: 'c-anna-beispiel', firmaId: 'f-x', mandatId: 'mandat-1', dealId: 'deal-1' } });
    expect(t.parentId).toBeUndefined(); // nie sich selbst
    expect(t.kommentare).toEqual([{ id: 'k1', von: 'kevin', text: 'Hallo @malin', am: T0, erwaehnt: ['malin'] }]);
    expect(taskSauber({ ...aufgabe('a'), spaceId: 'business', bezug: { kontaktId: 'x' } })!.spaceId).toBeUndefined();
    const viele = Array.from({ length: AUFGABEN_GRENZEN.kommentare + 1 }, (_, i) => ({ id: `k${i}`, von: 'kevin', text: 'x', am: T0 }));
    expect(() => taskSauber({ ...aufgabe('a'), kommentare: viele })).toThrow(ZuGross);
    expect(() => taskSauber({ ...aufgabe('a'), tags: Array.from({ length: AUFGABEN_GRENZEN.tags + 1 }, () => 't') })).toThrow(ZuGross);
  });
  it('Kommentare: fremde bleiben, eigene nur weich entfernt (29.09., #76), neue tragen Person und Serverzeit', () => {
    const alt = [{ id: 'k1', von: 'malin', text: 'von Malin', am: T0 }, { id: 'k2', von: 'kevin', text: 'von Kevin', am: T0 }];
    const r = kommentareVereinen(alt, [{ id: 'k3', von: 'malin', text: 'gefälscht', am: '2000-01-01' }], 'kevin', '2026-09-28T10:00:00.000Z');
    expect(r.kommentare!.map(k => [k.id, k.von])).toEqual([['k1', 'malin'], ['k2', 'kevin'], ['k3', 'kevin']]);
    expect(r.kommentare!.find(k => k.id === 'k2')).toMatchObject({ text: 'von Kevin', entfernt: { am: '2026-09-28T10:00:00.000Z', von: 'kevin' } });
    expect(r.kommentare!.find(k => k.id === 'k1')!.entfernt).toBeUndefined();
    expect(r.neue).toEqual([{ id: 'k3', von: 'kevin', text: 'gefälscht', am: '2026-09-28T10:00:00.000Z' }]);
    // Fremden Text ändern geht nicht: der gespeicherte bleibt.
    const r2 = kommentareVereinen(alt, [{ ...alt[0], text: 'umgeschrieben' }, alt[1]], 'kevin');
    expect(r2.kommentare![0].text).toBe('von Malin');
  });
});
