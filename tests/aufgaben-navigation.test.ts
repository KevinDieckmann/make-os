// ─── Aufgaben: Adressen, Notiz, Zeit je Aufgabe, Überblick, Baum mit Gruppen (28.09. spät, rein) ──
import { describe, it, expect } from 'vitest';
import { adresseLesen, aufgabenLink } from '@/lib/aufgaben/adresse';
import { WEG } from '@/lib/wege';
import { notizBloecke, checkUmschalten, checkStand, inline, sichererLink } from '@/lib/aufgaben/notiz';
import { zeitJeAufgabe, dauerText } from '@/lib/aufgaben/zeit';
import { kachelAufgaben, spaceStaende, projektStand } from '@/lib/aufgaben/uebersicht';
import { baum, FESTE_SPACES } from '@/lib/aufgaben/struktur';
import type { Task, TasksState } from '@/types/tasks';

const q = (s: string) => new URLSearchParams(s.split('?')[1] ?? '');

describe('Adressen', () => {
  it('ohne Angabe Überblick; Space, Projekt, Gruppe, Liste, Reiter, Aufgabe', () => {
    expect(adresseLesen(q(''))).toEqual({ ansicht: 'ueberblick' });
    const a = adresseLesen(q('?s=kdv&p=p-launch&g=g-mkt&l=l-w1&t=notizen&a=t-1&ansicht=board'));
    expect(a).toEqual({ ansicht: 'space', s: 'kdv', p: 'p-launch', g: 'g-mkt', l: 'l-w1', t: 'notizen', a: 't-1', darstellung: 'board' });
    expect(adresseLesen(q(aufgabenLink(a)))).toEqual({ ...a, bereich: 'business' });
  });
  it('alte Adressen: offen = a, r = s, space=privat allein = Privat-Space, space=business allein = Überblick', () => {
    expect(adresseLesen(q('?offen=t-9'))).toEqual({ ansicht: 'ueberblick', a: 't-9' });
    expect(adresseLesen(q('?space=business&r=m-f-beispiel&p=p1'))).toMatchObject({ ansicht: 'space', s: 'm-f-beispiel', p: 'p1', bereich: 'business' });
    expect(adresseLesen(q('?space=privat'))).toMatchObject({ ansicht: 'space', s: 'privat' });
    expect(adresseLesen(q('?space=business'))).toEqual({ ansicht: 'ueberblick', bereich: 'business' });
    expect(adresseLesen(q('?space=privat&b=ueberblick'))).toEqual({ ansicht: 'ueberblick', bereich: 'privat' });
  });
  it('ungültiges fällt weg; Gruppe/Liste/Reiter nur mit Projekt', () => {
    expect(adresseLesen(q('?s=quatsch&a=<x>'))).toEqual({ ansicht: 'ueberblick' });
    expect(adresseLesen(q('?s=kdc&g=g1&l=l1&t=felder'))).toEqual({ ansicht: 'space', s: 'kdc' });
  });
  it('Links: WEG.aufgaben, Seitenleiste wird mitgeführt, Überblick im Privat ausdrücklich', () => {
    expect(WEG.aufgaben()).toBe('/os/aufgaben');
    expect(WEG.aufgaben({ s: 'kdc', p: 'p1', t: 'aufgaben' })).toBe('/os/aufgaben?space=business&s=kdc&p=p1');
    expect(WEG.aufgaben({ space: 'business', r: 'm-f-beispiel' })).toBe('/os/aufgaben?space=business&s=m-f-beispiel');
    expect(WEG.aufgaben({ b: 'archiv' })).toBe('/os/aufgaben?b=archiv');
    expect(aufgabenLink({ ansicht: 'ueberblick', bereich: 'privat' })).toBe('/os/aufgaben?space=privat&b=ueberblick');
    expect(WEG.aufgabe('t-1')).toBe('/os/aufgaben?offen=t-1');
  });
});

describe('Notiz (sichere Markdown-Teilmenge)', () => {
  const text = '# Ziel\nLaunch im **Oktober** mit *Presse*\n\n- [ ] Pressetext\n- [x] Termin\n1. eins\n---\n[Plan](https://beispiel.invalid/plan) und [böse](javascript:alert(1)) und /os/aufgaben';
  it('Blöcke, Checklisten, Links nur http(s) und /os/', () => {
    const b = notizBloecke(text);
    expect(b.map(x => x.art)).toEqual(['ueberschrift', 'absatz', 'liste', 'liste', 'trenner', 'absatz']);
    const liste = b[2] as Extract<typeof b[number], { art: 'liste' }>;
    expect(liste.punkte.map(p => [p.check, p.zeile])).toEqual([[false, 3], [true, 4]]);
    const letzter = b[5] as Extract<typeof b[number], { art: 'absatz' }>;
    expect(letzter.inhalt.filter(i => i.art === 'link')).toEqual([
      { art: 'link', text: 'Plan', href: 'https://beispiel.invalid/plan', intern: false },
      { art: 'link', text: '/os/aufgaben', href: '/os/aufgaben', intern: true },
    ]);
    expect(JSON.stringify(letzter.inhalt)).toContain('javascript:alert(1)'); // als Text, nie als Link
    expect(sichererLink('//fremd.invalid')).toBeNull();
    expect(inline('**fett [x](https://a.invalid)**')).toEqual([{ art: 'fett', kinder: [{ art: 'text', text: 'fett ' }, { art: 'link', text: 'x', href: 'https://a.invalid', intern: false }] }]);
  });
  it('Abhaken ändert nur die eine Zeile; Stand zählt', () => {
    const n = checkUmschalten(text, 3);
    expect(n.split('\n')[3]).toBe('- [x] Pressetext');
    expect(n.replace('- [x] Pressetext', '- [ ] Pressetext')).toBe(text);
    expect(checkUmschalten(text, 0)).toBe(text);
    expect(checkStand(n)).toEqual({ fertig: 2, gesamt: 2 });
  });
});

describe('Zeit je Aufgabe', () => {
  it('summiert gebuchte Fokus-Blöcke je Person, auch Unteraufgaben', () => {
    const datei = (bloecke: { aufgabeId?: string; sek: number; bis: string }[]) => ({ tage: { '2026-09-28': { auto: {}, bewusst: {}, bloecke: bloecke.map(b => ({ von: '2026-09-28T08:00:00Z', schluessel: 'business:aufgaben', label: 'x', ...b })) } } });
    const z = zeitJeAufgabe([
      { person: 'kevin', name: 'Kevin', datei: datei([{ aufgabeId: 't1', sek: 3600, bis: '2026-09-28T09:00:00Z' }, { aufgabeId: 'x', sek: 999, bis: '2026-09-28T09:00:00Z' }]) },
      { person: 'malin', name: 'Malin', datei: datei([{ aufgabeId: 't1--u', sek: 1800, bis: '2026-09-28T10:00:00Z' }, { sek: 50, bis: '2026-09-28T10:00:00Z' }]) },
    ], ['t1', 't1--u']);
    expect(z).toMatchObject({ sek: 5400, bloecke: 2, jeAufgabe: { t1: 3600, 't1--u': 1800 }, letzter: '2026-09-28T10:00:00Z' });
    expect(z.je.map(j => [j.person, j.sek])).toEqual([['kevin', 3600], ['malin', 1800]]);
    expect(dauerText(5400)).toBe('1:30 h');
    expect(dauerText(600)).toBe('10 min');
  });
});

const T0 = '2026-09-01T08:00:00.000Z';
const t = (id: string, x: Partial<Task> = {}): Task => ({ id, projectId: 'p1', title: id, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...x });
const state: TasksState = {
  projects: [{ id: 'p1', title: 'Launch', category: 'business', owner: 'both', color: '#DE9E63', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv' }],
  tasks: [
    t('a', { listeId: 'l1', dueDate: '2026-09-27' }), t('b', { listeId: 'l2', dueDate: '2026-09-28', assignee: 'malin', abhaengigVon: ['a'] }),
    t('c', { status: 'done' }), t('d', { zoe: { status: 'wartet_freigabe' }, projectId: 'sonstige-kdv' }), t('e', { spaceId: 'privat', projectId: 'sonstige-privat' }),
  ],
  listen: [{ id: 'l1', projektId: 'p1', titel: 'Woche 1', sortOrder: 0, gruppeId: 'g1' }, { id: 'l2', projektId: 'p1', titel: 'Direkt', sortOrder: 1 }],
  statusEigen: [],
  gruppen: [{ id: 'g1', projektId: 'p1', titel: 'Marketing', farbe: '#FF7EB6', sortOrder: 0 }, { id: 'g2', projektId: 'p1', titel: 'Sales', farbe: '#FF9F43', sortOrder: 1 }],
};

describe('Überblick', () => {
  it('Kacheln: meine, heute, überfällig, wartet auf Freigabe', () => {
    expect(kachelAufgaben(state.tasks, 'meine', 'kevin', '2026-09-28').map(x => x.id)).toEqual(['a', 'd', 'e']);
    expect(kachelAufgaben(state.tasks, 'heute', 'kevin', '2026-09-28').map(x => x.id)).toEqual(['b']);
    expect(kachelAufgaben(state.tasks, 'ueberfaellig', 'kevin', '2026-09-28').map(x => x.id)).toEqual(['a']);
    expect(kachelAufgaben(state.tasks, 'freigabe', 'kevin', '2026-09-28').map(x => x.id)).toEqual(['d']);
  });
  it('Karten je Space und Projekt-Stand (blockiert, nächste Deadline)', () => {
    const s = spaceStaende(state, FESTE_SPACES, '2026-09-28');
    const kdv = s.find(x => x.space.id === 'kdv')!;
    expect(kdv).toMatchObject({ offen: 3, heute: 1, ueberfaellig: 1 });
    expect(kdv.projekte.map(p => p.titel)).toEqual(['Launch', 'Sonstige']);
    expect(projektStand(state, state.projects[0], '2026-09-28')).toMatchObject({ offen: 2, fertig: 1, gesamt: 3, ueberfaellig: 1, heute: 1, blockiert: 1, naechste: '2026-09-28' });
  });
});

describe('Baum mit Gruppen', () => {
  it('Gruppen in Reihenfolge (auch leere), Listen tragen ihre Gruppe', () => {
    const b = baum(state, 'kdv');
    const p = b.find(x => x.id === 'p1')!;
    expect(p.gruppen.map(g => [g.titel, g.offen])).toEqual([['Marketing', 1], ['Sales', 0]]);
    expect(p.listen.map(l => [l.titel, l.gruppeId ?? null])).toEqual([['Woche 1', 'g1'], ['Direkt', null], ['Sonstige', null]]);
  });
});
