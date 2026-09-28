// ─── Paket T1 · Server (29.09.): Sichtfilter „nur ich“, eine Verantwortliche, Prüfregeln, Server-Zeitstempel,
// „abgebrochen“, Serien (ab Erledigung, Wechsel, Feiertage, überspringen/beenden), Meldungen gebündelt, ETag,
// Kommentare weich, Server-Schreiber, Übernahme „both“. Eigener Datenordner, erfundene Konten und Aufgaben.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { rmSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Task, TasksState } from '@/types/tasks';
// Nur REINE Module statisch — alles, was lib/store/local-db lädt, erst nach dem Umbiegen des Datenordners (dynamisch).
import { naechsteInstanz, serienAufgabenNachholen, serieUeberspringen, serienTermin, folgeinstanzenBeimOeffnen, serieVon } from '@/lib/aufgaben/serie';
import { aufgabePruefen } from '@/lib/aufgaben/pruefen';
import { uebernehmen, nachReihe } from '@/lib/aufgaben/struktur';
import { kachelAufgaben, spaceStaende } from '@/lib/aufgaben/uebersicht';
import { faelligAbleiten } from '@/lib/meldungen/regeln';
import { berlinerTag, tagPlus } from '@/lib/aufgaben/wiederholung';

const ordner = await vi.hoisted(async () => {
  // Vor allen Importen: eigener Datenordner (nie der echte).
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-aufgaben-t1-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-aufgaben-t1';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});

const gemeldet: { an: string; art: string; titel: string }[] = [];
vi.mock('@/lib/meldungen/melden', () => ({ melde: async (m: { an: string; art: string; titel: string }) => { gemeldet.push(m); } }));

type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; PATCH: Handler };
let anlegen: { POST: Handler };
let db: typeof import('@/lib/store/local-db');

const T0 = '2026-09-01T08:00:00.000Z';
const a = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: 'p1', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'privat', ...extra });
const konto = (id: string, speicher: string, name: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher, email: `${speicher}@test.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' });
const sitzung = (person: string, extra: Record<string, string> = {}) => ({ 'content-type': 'application/json', 'x-make-user': person, ...extra });
const dienst = () => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY! });
const anfrage = (kopf: Record<string, string>, method = 'GET', body?: unknown, pfad = '/api/state/tasks') => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
type Zeile = Task & { stand: string };
const lesen = async (kopf: Record<string, string>) => ((await (await route.GET(anfrage(kopf))).json()) as { state: { tasks: Zeile[] } }).state.tasks;
const gespeichert = async () => (await db.loadJson<TasksState & { umbauVersion?: number }>('tasks'))!;
const patch = (person: string, body: unknown) => route.PATCH(anfrage(sitzung(person), 'PATCH', body));
const upsert = (t: Partial<Task> & { id: string }, stand?: string) => ({ ops: [{ op: 'upsert', task: t, ...(stand ? { stand } : {}) }] });
const heute = () => berlinerTag();

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'Kevin Beispiel', 'inhaber'), konto('k2', 'malin', 'Malin Beispiel', 'mitglied')], einladungen: [] });
  await db.saveJson('crm', { firmen: [], mandate: [] });
  route = (await import('@/app/api/state/tasks/route')) as unknown as typeof route;
  anlegen = (await import('@/app/api/tasks/create/route')) as unknown as typeof anlegen;
});
beforeEach(async () => {
  gemeldet.length = 0;
  await db.saveJson('tasks', {
    projects: [{ id: 'p1', title: 'Zuhause', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat' }],
    tasks: [
      a('offen'),
      a('geheim', { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin', title: 'Geschenk für Malin' }),
      a('geheim-kind', { parentId: 'geheim', title: 'Papier kaufen' }),
    ],
    listen: [], statusEigen: [], gruppen: [], vorlagen: [], umbauVersion: 2,
  });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('„nur ich“ — Sichtfilter auf dem Lesepfad, 404 beim Schreiben', () => {
  it('GET: Kevin sieht seine (samt Unteraufgabe), Malin und der Systemlauf nicht', async () => {
    expect((await lesen(sitzung('kevin'))).map(t => t.id).sort()).toEqual(['geheim', 'geheim-kind', 'offen']);
    expect((await lesen(sitzung('malin'))).map(t => t.id)).toEqual(['offen']);
    expect((await lesen(dienst())).map(t => t.id)).toEqual(['offen']);
  });
  it('Malin schreibt/löscht die fremde „nur ich“-Aufgabe oder hängt etwas darunter → 404, nichts geändert', async () => {
    expect((await patch('malin', upsert({ ...a('geheim'), title: 'entdeckt' }))).status).toBe(404);
    expect((await patch('malin', { ops: [{ op: 'delete', id: 'geheim' }] })).status).toBe(404);
    expect((await patch('malin', upsert(a('neu-kind', { parentId: 'geheim' })))).status).toBe(404);
    expect((await gespeichert()).tasks.find(t => t.id === 'geheim')!.title).toBe('Geschenk für Malin');
  });
  it('auf „nur ich“ stellen kann nur die Anlegerin; die Anlegerin setzt der Server', async () => {
    const r = await patch('malin', upsert(a('m1', { assignee: 'malin', angelegtVon: 'kevin' })));
    expect(r.status).toBe(200);
    const m1 = (await gespeichert()).tasks.find(t => t.id === 'm1')!;
    expect(m1.angelegtVon).toBe('malin'); // behauptete Anlegerin zählt nicht
    const z = (await lesen(sitzung('kevin'))).find(t => t.id === 'm1')!;
    expect((await patch('kevin', upsert({ ...z, sichtbarkeit: 'nur-ich' }, z.stand))).status).toBe(400);
  });
  it('„nur ich“ nennt keine andere Person (verantwortlich/beteiligt) → 400', async () => {
    expect((await patch('kevin', upsert(a('g2', { sichtbarkeit: 'nur-ich', assignee: 'malin' })))).status).toBe(400);
    expect((await patch('kevin', upsert(a('g3', { sichtbarkeit: 'nur-ich', beteiligte: ['malin'] })))).status).toBe(400);
    expect((await patch('kevin', upsert(a('g4', { sichtbarkeit: 'nur-ich' })))).status).toBe(200);
  });
  it('/api/tasks/create: Duplikat-Schutz sieht nur die eigene Sicht; „nur ich“ geht durch', async () => {
    const r = await anlegen.POST(anfrage(sitzung('malin'), 'POST', { title: 'Geschenk für Malin', owner: 'malin' }, '/api/tasks/create'));
    const d = await r.json() as { ok: boolean; duplikat?: boolean; id: string };
    expect(d.duplikat).toBeUndefined();
    const g = (await gespeichert()).tasks.find(t => t.id === d.id)!;
    expect(g).toMatchObject({ assignee: 'malin', angelegtVon: 'malin' });
  });
  it('ETag: 304 bei gleichem Stand, je Person ein eigenes ETag', async () => {
    const r1 = await route.GET(anfrage(sitzung('kevin')));
    const etag = r1.headers.get('etag')!;
    expect(etag).toBeTruthy();
    expect((await route.GET(anfrage(sitzung('kevin', { 'if-none-match': etag })))).status).toBe(304);
    expect((await route.GET(anfrage(sitzung('malin', { 'if-none-match': etag })))).status).toBe(200);
    await patch('kevin', upsert(a('x1')));
    expect((await route.GET(anfrage(sitzung('kevin', { 'if-none-match': etag })))).status).toBe(200);
  });
});

describe('Eine Verantwortliche + Beteiligte (Server)', () => {
  it('„both“ beim Schreiben → Schreiberin verantwortlich, die andere beteiligt (+ Meldung „beteiligt“)', async () => {
    expect((await patch('malin', upsert(a('b1', { assignee: 'both' })))).status).toBe(200);
    expect((await gespeichert()).tasks.find(t => t.id === 'b1')).toMatchObject({ assignee: 'malin', beteiligte: ['kevin'] });
    expect(gemeldet.map(m => [m.an, m.art])).toEqual([['kevin', 'zuweisung']]);
    expect(gemeldet[0].titel).toContain('beteiligt');
  });
  it('unbekannte Person als Verantwortliche oder Beteiligte → 400', async () => {
    expect((await patch('kevin', upsert(a('b2', { assignee: 'irgendwer' as Task['assignee'] })))).status).toBe(400);
    expect((await patch('kevin', upsert(a('b3', { beteiligte: ['irgendwer'] })))).status).toBe(400);
  });
  it('Übernahme des Altbestands: „both“ → Anlegerin/Beteiligte, Status bleibt; Archiv-Kopie v2 einmal; idempotent', async () => {
    await db.saveJson('tasks', { projects: [], tasks: [a('alt1', { assignee: 'both', status: 'in-progress', verlauf: [{ am: T0, von: 'malin', was: 'angelegt' }] }), a('alt2', { assignee: 'both' })], umbauVersion: 1 });
    const archiv = () => (existsSync(path.join(ordner, 'archiv')) ? readdirSync(path.join(ordner, 'archiv')).filter(n => n.startsWith('tasks-vor-umbau-v2-')) : []);
    expect((await patch('kevin', upsert(a('anderes')))).status).toBe(200);
    const g = await gespeichert();
    expect(g.umbauVersion).toBe(2);
    expect(g.tasks.find(t => t.id === 'alt1')).toMatchObject({ assignee: 'malin', beteiligte: ['kevin'], status: 'in-progress', angelegtVon: 'malin' });
    expect(g.tasks.find(t => t.id === 'alt2')).toMatchObject({ assignee: 'kevin', beteiligte: ['malin'] }); // geraten → erste Person (Inhaber)
    expect(archiv()).toHaveLength(1);
    await patch('kevin', upsert(a('noch-eins')));
    expect(archiv()).toHaveLength(1);
    const g2 = await gespeichert();
    expect(g2.tasks.find(t => t.id === 'alt1')).toEqual(g.tasks.find(t => t.id === 'alt1'));
  });
  it('Meldungen: mehrere Zuweisungen in einem Schreibvorgang → EINE Meldung', async () => {
    const { meldungenBerechnen } = await import('@/lib/aufgaben/speicher');
    const personen = [{ speicher: 'kevin', name: 'Kevin Beispiel' }, { speicher: 'malin', name: 'Malin Beispiel' }];
    const leer: TasksState = { projects: [], tasks: [] };
    const m = meldungenBerechnen(leer, { projects: [], tasks: [a('z1', { assignee: 'malin' }), a('z2', { assignee: 'malin' }), a('z3', { assignee: 'malin' }), a('z4', { assignee: 'kevin', beteiligte: ['malin'] })] }, [], 'kevin', personen);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ an: 'malin', art: 'zuweisung', titel: 'Kevin hat dir 4 Aufgaben zugewiesen' });
    // Nie über eine „nur ich“-Aufgabe an jemand anderen.
    expect(meldungenBerechnen(leer, { projects: [], tasks: [a('z5', { assignee: 'malin', sichtbarkeit: 'nur-ich', angelegtVon: 'kevin' })] }, [], 'kevin', personen)).toEqual([]);
  });
});

describe('Prüfregeln und Server-Zeitstempel', () => {
  it('Deadline/Start nur als gültiger Tag, Start ≤ Deadline, monatlich braucht den Tag', () => {
    const k = { personen: ['kevin', 'malin'] };
    expect(aufgabePruefen(a('d', { dueDate: '2026-02-31' }), undefined, k)).toMatch(/kein gültiger Tag/);
    expect(aufgabePruefen(a('d', { dueDate: '2026-10-01T23:30:00.000Z' }), undefined, k)).toMatch(/kein gültiger Tag/);
    expect(aufgabePruefen(a('d', { startDate: '2026-10-10', dueDate: '2026-10-05' }), undefined, k)).toMatch(/nach der Deadline/);
    expect(aufgabePruefen(a('d', { wiederholung: { regel: 'monatlich' } }), undefined, k)).toMatch(/Tag im Monat/);
    // Ein alter, unveränderter Wert blockiert keine andere Änderung.
    const alt = a('d', { dueDate: 'morgen' });
    expect(aufgabePruefen({ ...alt, title: 'neu' }, alt, k)).toBeNull();
  });
  it('PATCH: ungültiges Datum → 400; createdAt/updatedAt/completedAt setzt der Server', async () => {
    expect((await patch('kevin', upsert(a('d1', { dueDate: '2026-13-45' })))).status).toBe(400);
    expect((await patch('kevin', upsert(a('d2', { createdAt: '2000-01-01T00:00:00.000Z', updatedAt: '2000-01-01T00:00:00.000Z' })))).status).toBe(200);
    const d2 = (await gespeichert()).tasks.find(t => t.id === 'd2')!;
    expect(d2.createdAt > '2026-01-01').toBe(true);
    const z = (await lesen(sitzung('kevin'))).find(t => t.id === 'd2')!;
    await patch('kevin', upsert({ ...z, status: 'done', completedAt: '1999-01-01T00:00:00.000Z', createdAt: '1990-01-01T00:00:00.000Z' }, z.stand));
    const d2b = (await gespeichert()).tasks.find(t => t.id === 'd2')!;
    expect(d2b.completedAt! > '2026-01-01').toBe(true);
    expect(d2b.createdAt).toBe(d2.createdAt);
    const z2 = (await lesen(sitzung('kevin'))).find(t => t.id === 'd2')!;
    await patch('kevin', upsert({ ...z2, status: 'todo' }, z2.stand));
    expect((await gespeichert()).tasks.find(t => t.id === 'd2')!.completedAt).toBeUndefined();
  });
  it('Kommentare weich entfernen über den Schreibweg', async () => {
    await patch('kevin', upsert(a('k1', { kommentare: [{ id: 'c1', von: 'kevin', text: 'Frist 15.10. zugesagt', am: T0 }] })));
    const z = (await lesen(sitzung('kevin'))).find(t => t.id === 'k1')!;
    await patch('kevin', upsert({ ...z, kommentare: [] }, z.stand));
    const k = (await gespeichert()).tasks.find(t => t.id === 'k1')!.kommentare!;
    expect(k).toHaveLength(1);
    expect(k[0]).toMatchObject({ text: 'Frist 15.10. zugesagt', entfernt: { von: 'kevin' } });
  });
});

describe('Status „abgebrochen“ und Serien', () => {
  const J = '2026-09-30T08:00:00.000Z';
  it('abgebrochen: keine Folgeinstanz — weder beim Schreiben noch im Morgenlauf', async () => {
    await db.saveJson('tasks', { projects: [], tasks: [a('s1', { dueDate: heute(), wiederholung: { regel: 'taeglich' } })], umbauVersion: 2 });
    const z = (await lesen(sitzung('kevin'))).find(t => t.id === 's1')!;
    const d = await (await patch('kevin', upsert({ ...z, status: 'cancelled' }, z.stand))).json() as { serien?: string[] };
    expect(d.serien).toBeUndefined();
    expect(serienAufgabenNachholen([a('s1', { status: 'cancelled', dueDate: '2026-09-29', wiederholung: { regel: 'taeglich' } })], '2026-09-30', J)).toEqual([]);
  });
  it('ab Erledigung: der Rhythmus rechnet ab dem Tag der Erledigung', () => {
    const t = a('f1', { status: 'done', dueDate: '2026-09-01', completedAt: '2026-09-11T10:00:00.000Z', wiederholung: { regel: 'taeglich', intervall: 28, ab: 'erledigt' } });
    expect(naechsteInstanz(t, [t], '2026-09-11', J)[0].dueDate).toBe('2026-10-09');
    const f = a('f2', { ...t, wiederholung: { regel: 'taeglich', intervall: 28 } });
    expect(naechsteInstanz(f, [f], '2026-09-11', J)[0].dueDate).toBe('2026-09-29');
  });
  it('Wechsel: die nächste Instanz bekommt die nächste Person', () => {
    const t = a('r1', { status: 'done', dueDate: '2026-09-28', assignee: 'kevin', beteiligte: ['malin'], wiederholung: { regel: 'woechentlich', rotation: ['kevin', 'malin'] } });
    const n = naechsteInstanz(t, [t], '2026-09-29', J)[0];
    expect(n.assignee).toBe('malin');
    expect(n.beteiligte).toBeUndefined();
    const n2 = naechsteInstanz({ ...n, status: 'done' }, [n], '2026-10-05', J)[0];
    expect(n2.assignee).toBe('kevin');
  });
  it('Feiertage NRW: „Werktage“ springt über Feiertage, andere Regeln rücken auf den nächsten Werktag', () => {
    expect(serienTermin({ regel: 'werktage' }, '2026-10-02', '2026-09-01')).toBe('2026-10-05');
    expect(serienTermin({ regel: 'werktage' }, '2026-12-23', '2026-09-01')).toBe('2026-12-24');
    expect(serienTermin({ regel: 'werktage' }, '2026-12-24', '2026-09-01')).toBe('2026-12-28');
    expect(serienTermin({ regel: 'monatlich', monatstag: 3, feiertage: 'NRW' }, '2026-09-03', '2026-09-01')).toBe('2026-10-05'); // 03.10. Samstag + Einheit
    expect(serienTermin({ regel: 'monatlich', monatstag: 3 }, '2026-09-03', '2026-09-01')).toBe('2026-10-03');
  });
  it('überspringen („nur diese löschen“): Tag in `ausnahmen`, nächste Instanz sofort; Morgenlauf legt den Tag nie wieder an', async () => {
    const tag = heute();
    await db.saveJson('tasks', { projects: [], tasks: [a('u1', { dueDate: tag, wiederholung: { regel: 'taeglich' } })], umbauVersion: 2 });
    const d = await (await patch('kevin', { ops: [{ op: 'delete', id: 'u1' }] })).json() as { serien?: string[] };
    expect(d.serien).toHaveLength(1);
    const g = await gespeichert();
    const u1 = g.tasks.find(t => t.id === 'u1')!;
    expect(u1.geloeschtAm).toBeTruthy();
    expect(u1.wiederholung!.ausnahmen).toEqual([tag]);
    const neu = g.tasks.find(t => t.id === d.serien![0])!;
    expect(neu).toMatchObject({ status: 'todo', dueDate: tagPlus(tag, 1) });
    expect(serienAufgabenNachholen(g.tasks, tag, J).map(t => t.id)).toEqual([]);
    // Rein: die übersprungene jüngste Instanz im Papierkorb → Morgenlauf holt die nächste (nie den übersprungenen Tag).
    const r = serieUeberspringen(a('u2', { dueDate: '2026-09-30', wiederholung: { regel: 'taeglich' } }), [], '2026-09-30', J)!;
    const korb = { ...r.geloescht, geloeschtAm: J };
    expect(serienAufgabenNachholen([korb], '2026-09-30', J).map(t => t.dueDate)).toEqual(['2026-10-01']);
  });
  it('beenden: die jüngste Instanz ohne `wiederholung` (oder mit `serieBeendet`) entscheidet — Morgenlauf legt nichts an', () => {
    const alt = a('e1', { status: 'done', dueDate: '2026-09-28', wiederholung: { regel: 'taeglich' } });
    const juengste = a('e2', { status: 'done', dueDate: '2026-09-29', serieId: 'e1' });
    expect(serieVon(juengste)).toBe(serieVon(alt));
    expect(serienAufgabenNachholen([alt, juengste], '2026-09-30', J)).toEqual([]);
    const beendet = a('e3', { status: 'done', dueDate: '2026-09-29', serieId: 'e1', wiederholung: { regel: 'taeglich', serieBeendet: true } });
    expect(serienAufgabenNachholen([alt, beendet], '2026-09-30', J)).toEqual([]);
    // Ohne Ende: die nächste entsteht.
    expect(serienAufgabenNachholen([alt], '2026-09-30', J)).toHaveLength(1);
  });
  it('wieder öffnen: nur die unberührte Folgeinstanz geht weg', () => {
    const vor = a('o1', { status: 'done', completedAt: J, wiederholung: { regel: 'taeglich' } });
    const inst = a('w-1', { serieId: 'o1', createdAt: J, updatedAt: J, verlauf: [{ am: J, von: 'kevin', durch: 'system', was: 'angelegt' }] });
    const offen = { ...vor, status: 'todo' as const };
    expect(folgeinstanzenBeimOeffnen([vor, inst], [offen, inst], ['o1'])).toEqual(['w-1']);
    const beruehrt = { ...inst, updatedAt: '2026-09-30T09:00:00.000Z', title: 'geändert' };
    expect(folgeinstanzenBeimOeffnen([vor, beruehrt], [offen, beruehrt], ['o1'])).toEqual([]);
  });
});

describe('Server-Schreiber gehen über den Schreibweg', () => {
  it('systemAufgabenAendern: anlegen + erledigen mit completedAt und Verlauf „durch System“', async () => {
    const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
    await systemAufgabenAendern(() => ({ neu: [{ id: 'sys-1', title: 'Beleg nachreichen', status: 'todo', priority: 'medium', assignee: 'malin', tags: ['haushalt'], dueDate: '2026-10-01T22:30:00.000Z' }] }));
    const s1 = (await gespeichert()).tasks.find(t => t.id === 'sys-1')!;
    expect(s1.dueDate).toBe('2026-10-02'); // Zeitstempel → Berliner Tag
    expect(s1.verlauf![0]).toMatchObject({ was: 'angelegt', durch: 'system' });
    expect(s1.angelegtVon).toBeUndefined(); // Systemlauf ist keine Anlegerin
    await systemAufgabenAendern(st => ({ teile: st.tasks.filter(t => t.id === 'sys-1').map(t => ({ id: t.id, felder: { status: 'done' } })) }));
    const s2 = (await gespeichert()).tasks.find(t => t.id === 'sys-1')!;
    expect(s2.status).toBe('done');
    expect(s2.completedAt).toBeTruthy();
    expect(s2.verlauf!.at(-1)).toMatchObject({ was: 'status', durch: 'system', nachher: 'Erledigt' });
    // Nichts zu tun → nichts geschrieben.
    const r = await systemAufgabenAendern(() => ({}));
    expect(r).toMatchObject({ ok: true, angewandt: 0 });
  });
});

describe('Überblick, Glocke, Sortierung', () => {
  const tasks = [a('w1', { dueDate: '2026-09-01', abhaengigVon: ['w0'] }), a('w0', { dueDate: '2026-12-01' }), a('u', { dueDate: '2026-09-01' }), a('c', { dueDate: '2026-09-01', status: 'cancelled' })];
  it('überfällig ohne Wartende und Abgebrochene; Kachel „wartet“', () => {
    expect(kachelAufgaben(tasks, 'ueberfaellig', 'kevin', '2026-09-29').map(t => t.id)).toEqual(['u']);
    expect(kachelAufgaben(tasks, 'wartet', 'kevin', '2026-09-29').map(t => t.id)).toEqual(['w1']);
    const s = spaceStaende({ projects: [], tasks }, [{ id: 'privat', label: 'Privat', bereich: 'privat', art: 'privat', farbe: '#000000' }], '2026-09-29')[0];
    expect(s).toMatchObject({ offen: 3, ueberfaellig: 1, wartet: 1 });
  });
  it('Glocke: „wartet auf …“ statt „überfällig“, abgebrochene nie', () => {
    const m = faelligAbleiten(tasks, { person: 'kevin', heute: '2026-09-29', am: T0, link: id => `/os/aufgaben?offen=${id}`, tagVonIso: iso => iso.slice(0, 10) });
    expect(m.map(x => x.bezug?.id).sort()).toEqual(['u', 'w1']);
    expect(m.find(x => x.bezug?.id === 'w1')!.titel).toContain('wartet auf „Aufgabe w0“');
  });
  it('Sortierung: sortOrder, createdAt, dann die Kennung', () => {
    const l = [a('b'), a('a'), a('c', { sortOrder: -1 })].sort(nachReihe).map(t => t.id);
    expect(l).toEqual(['c', 'a', 'b']);
  });
  it('Übernahme: Deadline als Zeitstempel → Berliner Tag', () => {
    const s = uebernehmen({ projects: [], tasks: [a('z', { dueDate: '2026-10-01T23:30:00.000Z' })] }).state;
    expect(s.tasks[0].dueDate).toBe('2026-10-02');
  });
});
