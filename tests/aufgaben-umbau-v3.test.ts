// ─── Umbau v3 (06.10., Malins Bauplan-Karte): Gruppen auflösen — Projekt › Liste › Aufgabe › Unteraufgabe ─────
// Regel (Kevins Wahl): Gruppe → Liste (Titel, Farbe, Position), Liste in der Gruppe → Aufgabe (Kennung = Liste), deren Aufgaben →
// Unteraufgaben, zu tief → flach + Bericht/Notiz, laufende Serien bleiben Hauptaufgaben, Meilenstein-Listen bleiben Listen,
// Papierkorb/Archiv konsistent, idempotent und deterministisch; Archiv-Kopie VOR dem Umbau + Bericht; alte Links `&g=`;
// Vorlagen mit Gruppen; Malins Fall. Eigener Datenordner, erfundene Daten (nie .data).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Task, TasksState, AufgabenVorlage } from '@/types/tasks';
import { uebernehmen, baum } from '@/lib/aufgaben/struktur';
import { gruppenAufloesen, MEILENSTEIN_LISTE_PRAEFIX, listeAusGruppe, aufgabeAusListe } from '@/lib/aufgaben/umbau-gruppen';
import { MS_LISTE_PRAEFIX } from '@/lib/planung/meilenstein-aufgaben';
import { AUFGABEN_EBENEN_MAX, ebeneVon, nachIdKarte } from '@/lib/aufgaben/ebenen';
import { aufgabenSicht } from '@/lib/aufgaben/papierkorb';
import { aufgabenArchivieren, aufgabenZurueck } from '@/lib/aufgaben/neustart';
import { adresseLesen, aufgabenLink, alteAdresseUmleiten } from '@/lib/aufgaben/adresse';
import { ausVorlageAnlegen, vorlageOhneGruppen, vorlageKappen, vorlageUmfang } from '@/lib/aufgaben/vorlagen';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-umbau-v3-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-umbau-v3';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

const T0 = '2026-09-01T08:00:00.000Z';
const a = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: 'p-rw', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...extra });
const projekt = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: id === 'p-rw' ? 'Rechnungswesen' : 'Projekt', category: 'business' as const, owner: 'both' as const, color: '#6E7EF5', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...extra });

/** Malins Fall (nachgebaut, erfundene Texte): Projekt „Rechnungswesen“ (KD Ventures) › Gruppe „offene RE-Onebanking“ › die Liste,
 * die eigentlich eine Aufgabe sein sollte. Dazu eine zweite Gruppe mit echten Listen und Aufgaben, eine direkte Liste. */
const MALIN_LISTE = '2 diese Woche bezahlen, 1 nächste Woche + Vertrag Malin prüfen';
const alt = (): TasksState => ({
  projects: [projekt('p-rw')],
  gruppen: [
    { id: 'g-onebanking', projektId: 'p-rw', titel: 'offene RE-Onebanking', farbe: '#FF9F43', sortOrder: 0 },
    { id: 'g-belege', projektId: 'p-rw', titel: 'Belege', farbe: '#4FC3F7', sortOrder: 1, eingeklappt: true },
  ],
  listen: [
    { id: 'l-malin', projektId: 'p-rw', titel: MALIN_LISTE, sortOrder: 0, gruppeId: 'g-onebanking' },
    { id: 'l-jan', projektId: 'p-rw', titel: 'Januar', sortOrder: 0, gruppeId: 'g-belege' },
    { id: 'l-feb', projektId: 'p-rw', titel: 'Februar', sortOrder: 1, gruppeId: 'g-belege', wiederholung: { regel: 'monatlich', monatstag: 1, naechste: '2026-11-01' }, titelMuster: 'Belege {Monat}', vorlageId: 'v-belege' },
    { id: 'l-direkt', projektId: 'p-rw', titel: 'Direkt', sortOrder: 0 },
  ],
  statusEigen: [], vorlagen: [],
  tasks: [
    a('t-jan-1', { listeId: 'l-jan', sortOrder: 0, assignee: 'malin' }),
    a('t-jan-2', { listeId: 'l-jan', sortOrder: 1, status: 'done', completedAt: T0, assignee: 'malin' }),
    a('t-jan-1-u', { parentId: 't-jan-1', listeId: 'l-jan' }),
    a('t-direkt', { listeId: 'l-direkt' }),
  ],
});

describe('rein: Gruppen auflösen', () => {
  it('Gruppe → Liste (Titel, Farbe, vorne), Liste → Aufgabe, Aufgaben → Unteraufgaben (eine Ebene tiefer)', () => {
    const r = uebernehmen(alt(), {}, ['kevin', 'malin']);
    const s = r.state;
    expect(s.gruppen).toEqual([]);
    expect(s.listen!.every(l => !l.gruppeId)).toBe(true);
    const listen = [...s.listen!].sort((x, y) => x.sortOrder - y.sortOrder).map(l => [l.id, l.titel, l.farbe ?? null, l.sortOrder]);
    expect(listen).toEqual([['g-onebanking', 'offene RE-Onebanking', '#FF9F43', 0], ['g-belege', 'Belege', '#4FC3F7', 1], ['l-direkt', 'Direkt', null, 2]]);
    const nachId = nachIdKarte(s.tasks);
    // Malins Fall (ihr Punkt 2): der Fehleintrag ist jetzt eine AUFGABE in der Liste „offene RE-Onebanking“.
    expect(nachId.get('l-malin')).toMatchObject({ title: MALIN_LISTE, listeId: 'g-onebanking', projectId: 'p-rw', spaceId: 'kdv', status: 'todo' });
    expect(nachId.get('l-malin')!.parentId).toBeUndefined();
    // Januar = Aufgabe in „Belege“, ihre Aufgaben = Unteraufgaben, deren Unteraufgabe eine Ebene tiefer.
    expect(nachId.get('l-jan')).toMatchObject({ title: 'Januar', listeId: 'g-belege', assignee: 'malin', status: 'todo' });
    expect(nachId.get('t-jan-1')).toMatchObject({ parentId: 'l-jan', listeId: 'g-belege' });
    expect(nachId.get('t-jan-2')).toMatchObject({ parentId: 'l-jan', status: 'done' });
    expect(nachId.get('t-jan-1-u')).toMatchObject({ parentId: 't-jan-1', listeId: 'g-belege' });
    expect(ebeneVon(nachId.get('t-jan-1-u')!, nachId)).toBe(3);
    expect(nachId.get('t-direkt')).toMatchObject({ listeId: 'l-direkt' });
    // Serien-Liste: an einer Aufgabe nicht 1:1 abbildbar → Notiz (Regel, nächste, Muster), Vorlage bleibt.
    expect(nachId.get('l-feb')!.notiz).toMatch(/Wiederkehrende Liste[\s\S]*monatlich am 1\.[\s\S]*nächste 01\.11\.2026[\s\S]*Belege \{Monat\}/);
    expect(nachId.get('l-feb')!.vorlageId).toBe('v-belege');
    expect(nachId.get('l-feb')!.wiederholung).toBeUndefined();
    // Bericht: was woraus wurde.
    expect(r.umbau.filter(b => b.art === 'gruppe-liste').map(b => (b as { titel: string }).titel)).toEqual(['offene RE-Onebanking', 'Belege']);
    expect(r.umbau.filter(b => b.art === 'liste-aufgabe')).toHaveLength(3);
    expect(r.umbau.some(b => b.art === 'serie-notiz')).toBe(true);
    // Der Baum zeigt es so: Liste „offene RE-Onebanking“ mit Malins Aufgabe.
    const p = baum(s, 'kdv').find(x => x.id === 'p-rw')!;
    expect(p.listen[0]).toMatchObject({ titel: 'offene RE-Onebanking', farbe: '#FF9F43' });
    expect(p.listen[0].aufgaben.map(x => x.task.title)).toEqual([MALIN_LISTE]);
  });

  it('idempotent und deterministisch: zweimal lesen = derselbe Stand, danach nichts mehr zu tun', () => {
    const eins = uebernehmen(alt(), {}, ['kevin', 'malin']).state;
    const zwei = uebernehmen(alt(), {}, ['kevin', 'malin']).state;
    expect(JSON.stringify(zwei)).toBe(JSON.stringify(eins));
    const nochmal = uebernehmen(eins, {}, ['kevin', 'malin']);
    expect(nochmal.geaendert).toBe(false);
    expect(nochmal.umbau).toEqual([]);
    expect(nochmal.state).toEqual(eins);
    expect(gruppenAufloesen(eins).geaendert).toBe(false);
  });

  it('nie Verlust: alle Aufgaben bleiben, nur die Gruppen- und Listen-Hüllen fallen weg', () => {
    const s = uebernehmen(alt(), {}, ['kevin', 'malin']).state;
    const vorher = alt().tasks.map(t => t.id);
    expect(vorher.every(id => s.tasks.some(t => t.id === id))).toBe(true);
    expect(s.tasks.map(t => t.id).sort()).toEqual([...vorher, 'l-malin', 'l-jan', 'l-feb'].sort());
    expect(s.listen!.map(l => l.id).sort()).toEqual(['g-belege', 'g-onebanking', 'l-direkt']);
  });

  it(`Tiefe: wäre eine Kette tiefer als ${AUFGABEN_EBENEN_MAX}, hängt der Rest flach unter dem tiefsten erlaubten Vorfahren (Bericht + Notiz)`, () => {
    // Kette mit 5 Ebenen in einer Liste der Gruppe → nach dem Umbau wären es 6.
    const kette = ['e1', 'e2', 'e3', 'e4', 'e5'].map((id, i, l) => a(id, { listeId: 'l-jan', ...(i ? { parentId: l[i - 1] } : {}) }));
    const s0 = { ...alt(), tasks: [...alt().tasks, ...kette] };
    const r = uebernehmen(s0, {}, ['kevin']);
    const nachId = nachIdKarte(r.state.tasks);
    expect(nachId.get('e1')!.parentId).toBe('l-jan');
    expect(nachId.get('e5')!.parentId).toBe('e3');
    expect(ebeneVon(nachId.get('e5')!, nachId)).toBe(AUFGABEN_EBENEN_MAX);
    expect(Math.max(...r.state.tasks.map(t => ebeneVon(t, nachId)))).toBe(AUFGABEN_EBENEN_MAX);
    expect(nachId.get('e5')!.notiz).toMatch(/lag vorher unter „Aufgabe e4“/);
    expect(r.umbau).toContainEqual(expect.objectContaining({ art: 'zu-tief', aufgabeId: 'e5', vorherUnter: 'e4', jetztUnter: 'e3' }));
  });

  it('laufende Serie bleibt Hauptaufgabe in der neuen Liste (eine Serie läuft nur an Hauptaufgaben); beendete wird Unteraufgabe', () => {
    const s0 = { ...alt(), tasks: [...alt().tasks, a('serie', { listeId: 'l-jan', wiederholung: { regel: 'woechentlich', wochentage: [1] }, dueDate: '2026-10-12' }), a('serie-alt', { listeId: 'l-jan', wiederholung: { regel: 'taeglich', serieBeendet: true } })] };
    const r = uebernehmen(s0, {}, ['kevin']);
    const nachId = nachIdKarte(r.state.tasks);
    expect(nachId.get('serie')).toMatchObject({ listeId: 'g-belege' });
    expect(nachId.get('serie')!.parentId).toBeUndefined();
    expect(nachId.get('serie')!.notiz).toMatch(/stand in der Liste „Januar“/);
    expect(nachId.get('serie-alt')!.parentId).toBe('l-jan');
    expect(r.umbau).toContainEqual(expect.objectContaining({ art: 'serie-bleibt-aufgabe', aufgabeId: 'serie' }));
  });

  it('Meilenstein-Listen bleiben Listen (der Meilenstein zeigt auf sie) — nur die Gruppe fällt weg', () => {
    expect(MEILENSTEIN_LISTE_PRAEFIX).toBe(MS_LISTE_PRAEFIX);
    const s0 = { ...alt(), listen: [...alt().listen!, { id: 'lm-ms-1', projektId: 'p-rw', titel: 'Meilenstein Q4', sortOrder: 5, gruppeId: 'g-belege' }], tasks: [...alt().tasks, a('ms-a', { listeId: 'lm-ms-1' })] };
    const r = uebernehmen(s0, {}, ['kevin']);
    expect(r.state.listen!.find(l => l.id === 'lm-ms-1')).toMatchObject({ titel: 'Meilenstein Q4' });
    expect(r.state.listen!.find(l => l.id === 'lm-ms-1')!.gruppeId).toBeUndefined();
    expect(r.state.tasks.find(t => t.id === 'ms-a')).toMatchObject({ listeId: 'lm-ms-1' });
    expect(r.state.tasks.find(t => t.id === 'lm-ms-1')).toBeUndefined();
  });

  it('Papierkorb: Projekt im Papierkorb → die neuen Aufgaben gehen mit (geloeschtMit = Projekt); gelöschte Aufgabe bleibt im Papierkorb', () => {
    const s0 = { ...alt(), projects: [projekt('p-rw', { geloeschtAm: T0 })], tasks: alt().tasks.map(t => ({ ...t, geloeschtAm: T0, geloeschtMit: 'p-rw' })) };
    const r = uebernehmen(s0, {}, ['kevin']).state;
    expect(r.tasks.find(t => t.id === 'l-jan')).toMatchObject({ geloeschtAm: T0, geloeschtMit: 'p-rw' });
    expect(aufgabenSicht(r).tasks).toEqual([]);
    const einzeln = { ...alt(), tasks: alt().tasks.map(t => (t.id === 't-jan-2' ? { ...t, geloeschtAm: T0, geloeschtMit: 't-jan-2' } : t)) };
    const r2 = uebernehmen(einzeln, {}, ['kevin']).state;
    expect(r2.tasks.find(t => t.id === 't-jan-2')).toMatchObject({ parentId: 'l-jan', geloeschtAm: T0 });
    expect(aufgabenSicht(r2).tasks.some(t => t.id === 't-jan-2')).toBe(false);
    // Die Liste zählt nur, was nicht im Papierkorb liegt: t-jan-1 offen → die neue Aufgabe ist offen.
    expect(r2.tasks.find(t => t.id === 'l-jan')!.status).toBe('todo');
  });

  it('Archiv („Neu anfangen“): archivierte Gruppe/Liste → archivierte Liste/Aufgabe; „alles zurück“ holt sie mit dem Lauf zurück', () => {
    const lauf = 'na-lauf-umbau-1';
    const archiviert = aufgabenArchivieren(alt(), lauf, '2026-09-30T06:00:00.000Z').state;
    expect(archiviert.gruppen!.every(g => g.archivId === lauf)).toBe(true);
    const r = uebernehmen(archiviert, {}, ['kevin']).state;
    expect(r.listen!.find(l => l.id === 'g-belege')).toMatchObject({ archivId: lauf });
    expect(r.tasks.find(t => t.id === 'l-jan')).toMatchObject({ archivId: lauf });
    expect(aufgabenSicht(r).tasks).toEqual([]);
    const zurueck = aufgabenZurueck(r, lauf, { art: 'alles' });
    expect(zurueck.listen).toContain('g-belege');
    expect(zurueck.aufgaben).toEqual(expect.arrayContaining(['l-jan', 'l-malin', 't-jan-1']));
    expect(aufgabenSicht(zurueck.state).tasks.map(t => t.id)).toEqual(expect.arrayContaining(['l-jan', 'l-malin', 't-jan-1', 't-jan-1-u']));
  });
});

describe('alte Links (`&g=`, `&l=`)', () => {
  it('Gruppe → ihre Liste; Liste, die eine Aufgabe wurde → ihre Liste + die Aufgabe offen; gültige Adressen bleiben', () => {
    const s = uebernehmen(alt(), {}, ['kevin']).state;
    const g = adresseLesen(new URLSearchParams('s=kdv&p=p-rw&g=g-belege'));
    expect(g.g).toBe('g-belege');
    expect(alteAdresseUmleiten(g, s)).toEqual({ ansicht: 'space', s: 'kdv', p: 'p-rw', l: 'g-belege' });
    const l = adresseLesen(new URLSearchParams('s=kdv&p=p-rw&l=l-jan'));
    expect(alteAdresseUmleiten(l, s)).toEqual({ ansicht: 'space', s: 'kdv', p: 'p-rw', l: 'g-belege', a: 'l-jan' });
    const beide = adresseLesen(new URLSearchParams('s=kdv&p=p-rw&g=g-belege&l=l-feb'));
    expect(alteAdresseUmleiten(beide, s)).toEqual({ ansicht: 'space', s: 'kdv', p: 'p-rw', l: 'g-belege', a: 'l-feb' });
    expect(alteAdresseUmleiten(adresseLesen(new URLSearchParams('s=kdv&p=p-rw&l=l-direkt')), s)).toBeNull();
    expect(aufgabenLink({ ansicht: 'space', s: 'kdv', p: 'p-rw', g: 'g-belege' })).not.toContain('g=');
    expect(listeAusGruppe('g-belege', s.listen!)).toBe('g-belege');
    expect(aufgabeAusListe('l-malin', s.tasks)).toBe('l-malin');
  });
  it('Kennung schon belegt: Nachsatz (deterministisch), die Weiterleitung findet sie trotzdem', () => {
    const s0 = { ...alt(), listen: [...alt().listen!, { id: 'g-belege', projektId: 'p-x', titel: 'Fremd', sortOrder: 0 }], tasks: [...alt().tasks, a('l-jan', { projectId: 'p-x', title: 'Schon da', listeId: undefined })] };
    // Hinweis: die Aufgabe „l-jan“ gibt es schon → die neue heißt l-jan-l3; die Liste „g-belege“ gibt es schon → g-belege-g3.
    const s = uebernehmen(s0, {}, ['kevin']).state;
    expect(s.listen!.some(l => l.id === 'g-belege-g3' && l.titel === 'Belege')).toBe(true);
    expect(s.tasks.some(t => t.id === 'l-jan-l3' && t.title === 'Januar')).toBe(true);
  });
});

describe('Vorlagen mit Gruppen (von vor dem 06.10.)', () => {
  const alteVorlage: AufgabenVorlage = { id: 'v-alt', art: 'projekt', titel: 'Launch alt', inhalt: {
    gruppen: [{ titel: 'Marketing', farbe: '#E27FD0' }, { titel: 'Leer' }],
    listen: [
      { titel: 'Woche 1', gruppe: 'Marketing', gruppeIndex: 0, aufgaben: [{ titel: 'Text', versatzTage: 2, unter: [{ titel: 'E2', unter: [{ titel: 'E3', unter: [{ titel: 'E4', unter: [{ titel: 'E5' }] }] }] }] }] },
      { titel: 'Ohne Gruppe', aufgaben: [{ titel: 'Direkt' }] },
    ],
  } };
  it('nach derselben Regel: Gruppe → Liste (Farbe), Liste → Aufgabe, Aufgaben → Unteraufgaben; zu tief → flach, nie weg', () => {
    const o = vorlageOhneGruppen(alteVorlage.inhalt);
    expect(o.gruppen).toBeUndefined();
    expect(o.listen!.map(l => [l.titel, l.farbe ?? null, l.aufgaben.map(x => x.titel)])).toEqual([['Marketing', '#E27FD0', ['Woche 1']], ['Leer', '#6E7EF5', []], ['Ohne Gruppe', null, ['Direkt']]]);
    // „Woche 1“ (1) › Text (2) › E2 (3) › E3 (4) › E4 (5) — E5 wäre 6 → steht flach neben E4.
    const woche = o.listen![0].aufgaben[0];
    expect(woche.unter![0].unter![0].unter![0].unter!.map(x => x.titel)).toEqual(['E4', 'E5']);
    expect(vorlageKappen([{ titel: 'a', unter: [{ titel: 'b', unter: [{ titel: 'c' }] }] }], AUFGABEN_EBENEN_MAX).map(x => x.titel)).toEqual(['a', 'b', 'c']);
    expect(vorlageUmfang(alteVorlage)).toMatchObject({ listen: 3, aufgaben: 2 });
    const r = ausVorlageAnlegen(alteVorlage, { projects: [], tasks: [], listen: [] }, { spaceId: 'kdv', start: '2026-11-02', owner: 'kevin', praefix: 'p-neu', jetzt: T0 });
    expect('gruppen' in r).toBe(false);
    expect(r.listen.map(l => [l.titel, l.gruppeId])).toEqual([['Marketing', undefined], ['Leer', undefined], ['Ohne Gruppe', undefined]]);
    const nachId = nachIdKarte(r.tasks);
    expect(r.tasks.find(t => t.title === 'Woche 1')).toMatchObject({ listeId: 'p-neu-l1' });
    expect(r.tasks.find(t => t.title === 'Text')!.parentId).toBe(r.tasks.find(t => t.title === 'Woche 1')!.id);
    expect(r.tasks.find(t => t.title === 'Text')!.dueDate).toBe('2026-11-04');
    expect(Math.max(...r.tasks.map(t => ebeneVon(t, nachId)))).toBe(AUFGABEN_EBENEN_MAX);
    expect(r.tasks.map(t => t.title)).toEqual(expect.arrayContaining(['E4', 'E5', 'Direkt']));
  });
});

// ── Server: Archiv-Kopie VOR dem Umbau, Bericht, Merker, Route ─────────────────────────────────────────────────────
type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; PATCH: Handler };
let db: typeof import('@/lib/store/local-db');
const konto = (id: string, speicher: string, name: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher, email: `${speicher}@test.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' });
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const anfrage = (kopf: Record<string, string>, method = 'GET', body?: unknown) => new Request('http://test/api/state/tasks', { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const archiv = (praefix: string) => (existsSync(path.join(ordner, 'archiv')) ? readdirSync(path.join(ordner, 'archiv')).filter(n => n.startsWith(praefix)) : []);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'Kevin Beispiel', 'inhaber'), konto('k2', 'malin', 'Malin Beispiel', 'mitglied')], einladungen: [] });
  await db.saveJson('crm', { firmen: [], mandate: [] });
  route = (await import('@/app/api/state/tasks/route')) as unknown as typeof route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Server: Umbau beim ersten Schreiben', () => {
  it('GET zeigt schon den neuen Stand; erstes Schreiben: Kopie des ROHstands + Bericht, Merker 3; zweites: keine zweite Kopie', async () => {
    const roh = { ...alt(), umbauVersion: 2 };
    await db.saveJson('tasks', roh);
    const g = (await (await route.GET(anfrage(sitzung('malin')))).json()) as { state: Omit<TasksState, 'tasks'> & { tasks: (Task & { stand: string })[] } };
    expect(g.state.gruppen).toEqual([]);
    const malin = g.state.tasks.find(t => t.id === 'l-malin')!;
    expect(malin).toMatchObject({ title: MALIN_LISTE, listeId: 'g-onebanking' });
    expect(archiv('tasks-vor-umbau-v3-')).toHaveLength(0); // Lesen schreibt nicht
    // Malin hakt ihren (jetzt als Aufgabe erkannten) Eintrag ab — das erste Schreiben.
    const r = await route.PATCH(anfrage(sitzung('malin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...malin, status: 'done' }, stand: malin.stand }] }));
    expect(r.status).toBe(200);
    expect(archiv('tasks-vor-umbau-v3-')).toHaveLength(1);
    const { archivLesen } = await import('@/lib/store/archiv');
    expect(await archivLesen(archiv('tasks-vor-umbau-v3-')[0])).toEqual(roh);
    const bericht = await archivLesen<{ version: number; bericht: { art: string }[] }>(archiv('tasks-umbau-v3-bericht-')[0]);
    expect(bericht.version).toBe(3);
    expect(bericht.bericht.filter(b => b.art === 'gruppe-liste')).toHaveLength(2);
    const gespeichert = (await db.loadJson<TasksState & { umbauVersion?: number }>('tasks'))!;
    expect(gespeichert.umbauVersion).toBe(3);
    expect(gespeichert.gruppen).toEqual([]);
    expect(gespeichert.tasks.find(t => t.id === 'l-malin')).toMatchObject({ status: 'done', listeId: 'g-onebanking' });
    // Zweites Schreiben: keine zweite Kopie.
    const g2 = (await (await route.GET(anfrage(sitzung('kevin')))).json()) as { state: { tasks: (Task & { stand: string })[] } };
    const d = g2.state.tasks.find(t => t.id === 't-direkt')!;
    expect((await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...d, priority: 'high' }, stand: d.stand }] }))).status).toBe(200);
    expect(archiv('tasks-vor-umbau-v3-')).toHaveLength(1);
    expect(archiv('tasks-umbau-v3-bericht-')).toHaveLength(1);
  });

  it('Server lehnt neue Gruppen ab (400, klarer Text) — auch eine Liste mit Gruppe; nichts gespeichert', async () => {
    const vorher = await db.loadJson('tasks');
    const g = await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { struktur: { gruppen: [{ op: 'upsert', eintrag: { id: 'g-neu', projektId: 'p-rw', titel: 'Neu', farbe: '#FF0000', sortOrder: 0 } }] } }));
    expect(g.status).toBe(400);
    expect(((await g.json()) as { error: string }).error).toMatch(/Gruppen gibt es seit dem 06\.10\. nicht mehr.*„\+ Neue Liste“/);
    const l = await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { struktur: { listen: [{ op: 'upsert', eintrag: { id: 'l-neu', projektId: 'p-rw', titel: 'Neu', sortOrder: 9, gruppeId: 'g-belege' } }] } }));
    expect(l.status).toBe(400);
    expect(await db.loadJson('tasks')).toEqual(vorher);
    const { aufgabenAendern, keineOps } = await import('@/lib/aufgaben/speicher');
    const intern = await aufgabenAendern({ ...keineOps(), gruppen: [{ op: 'upsert', eintrag: { id: 'g-x', projektId: 'p-rw', titel: 'X', farbe: '#000000', sortOrder: 0 } }] }, { person: 'kevin' });
    expect(intern).toMatchObject({ ok: false, status: 400 });
  });
});
