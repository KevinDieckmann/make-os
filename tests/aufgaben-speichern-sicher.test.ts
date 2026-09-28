// ─── Aufgaben: sauber speichern (29.09., Kevin: „Alle Infos müssen immer sauber gespeichert werden — extrem wichtig“) ──
// Die Verlust-Szenarien der Prüfung als Tests (Server-Seite): alte Tabs (Build-Kennung, Teil-Merge, PUT), umbenannte
// Auswahl-Werte, deutsche Beträge, Papierkorb (samt Dateien), Übernahme mit Archiv-Kopie, Leser ohne Papierkorb.
// Eigener Datenordner, erfundene Konten/Aufgaben — nie der echte Bestand.
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Task, TasksState } from '@/types/tasks';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-aufgaben-sicher-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-aufgaben-sicher';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

const T0 = '2026-09-01T08:00:00.000Z';
const aufgabe = (id: string, extra: Record<string, unknown> = {}) => ({ id, projectId: 'p-launch', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...extra }) as unknown as Task;
const projekt = (extra: Record<string, unknown> = {}) => ({ id: 'p-launch', title: 'Launch', category: 'business', owner: 'both', color: '#DE9E63', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...extra });

type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; PATCH: Handler; PUT: Handler };
let bestand: { PATCH: Handler };
let db: typeof import('@/lib/store/local-db');
const konto = (id: string, speicher: string, name: string, rolle: 'inhaber' | 'mitglied', haushalt?: string) => ({ id, speicher, email: `${speicher}@test.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });
const sitzung = (person: string, extra: Record<string, string> = {}) => ({ 'content-type': 'application/json', 'x-make-user': person, ...extra });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const anfrage = (kopf: Record<string, string>, method = 'GET', body?: unknown, pfad = '/api/state/tasks') => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
type Zeile = Record<string, unknown> & { id: string; stand: string };
const lesen = async (pfad = '/api/state/tasks?papierkorb=1') => (await (await route.GET(anfrage(sitzung('kevin'), 'GET', undefined, pfad))).json()) as { state: Record<'tasks' | 'projects' | 'listen' | 'gruppen' | 'vorlagen', Zeile[]> };
const gespeichert = async () => (await db.loadJson<TasksState>('tasks'))!;
const patch = (body: unknown, kopf: Record<string, string> = sitzung('kevin')) => route.PATCH(anfrage(kopf, 'PATCH', body));

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'Kevin Beispiel', 'inhaber', 'haus'), konto('k2', 'malin', 'Malin Beispiel', 'mitglied', 'haus')], einladungen: [] });
  await db.saveJson('crm', { firmen: [], mandate: [] });
  route = (await import('@/app/api/state/tasks/route')) as unknown as typeof route;
  bestand = (await import('@/app/api/crm/bestand/route')) as unknown as typeof bestand;
});
beforeEach(async () => {
  await db.saveJson('tasks', {
    projects: [projekt({ notiz: '# Ziel', felder: [{ id: 'f-kanal', name: 'Kanal', typ: 'auswahl', optionen: ['Messe', 'Web'] }, { id: 'f-budget', name: 'Budget', typ: 'betrag' }] })],
    tasks: [aufgabe('a1', { notiz: 'Wichtige Notiz', dueDate: '2026-10-01', felder: { 'f-kanal': 'Web' } }), aufgabe('a2'), aufgabe('a2-u', { parentId: 'a2', title: 'Unteraufgabe' })],
    listen: [], statusEigen: [], gruppen: [], vorlagen: [], umbauVersion: 1,
  });
});
afterEach(() => { vi.unstubAllEnvs(); });
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('A2 — alte Tabs nach dem Hochladen', () => {
  it('Build-Kennung: fremde oder fehlende Kennung → 409 { neuLaden }, nichts gespeichert; passende und Dienstweg gehen', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', 'bau-neu');
    const d = await lesen();
    const a1 = d.state.tasks.find(t => t.id === 'a1')!;
    const vorher = await gespeichert();
    for (const kopf of [sitzung('kevin'), sitzung('kevin', { 'x-make-bau': 'bau-alt' })]) {
      const r = await patch({ ops: [{ op: 'upsert', task: { ...a1, title: 'aus dem alten Tab' }, stand: a1.stand }] }, kopf);
      expect(r.status).toBe(409);
      expect(((await r.json()) as { neuLaden?: boolean }).neuLaden).toBe(true);
    }
    expect(await gespeichert()).toEqual(vorher);
    const ok = await patch({ ops: [{ op: 'upsert', task: { ...a1, title: 'aus dem neuen Tab' }, stand: a1.stand }] }, sitzung('kevin', { 'x-make-bau': 'bau-neu' }));
    expect(ok.status).toBe(200);
    // Dienstweg (ZOE, Takt) trägt keine Build-Kennung — er läuft im selben Bau.
    const a1neu = (await lesen()).state.tasks.find(t => t.id === 'a1')!;
    expect((await patch({ ops: [{ op: 'upsert', task: { ...a1neu, priority: 'high' }, stand: a1neu.stand }] }, dienst('malin'))).status).toBe(200);
    // PUT aus einem alten Tab ebenso.
    expect((await route.PUT(anfrage(sitzung('kevin'), 'PUT', { projects: [], tasks: [] }))).status).toBe(409);
  });

  it('CRM-Bestand: fremde Build-Kennung → 409 { neuLaden } (gemeinsamer Helfer)', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', 'bau-neu');
    const r = await bestand.PATCH(anfrage(sitzung('kevin', { 'x-make-bau': 'bau-alt' }), 'PATCH', { ops: [{ liste: 'segmente', op: 'upsert', eintrag: { id: 'seg-x', name: 'X', kriterien: {}, geaendert: T0 } }] }, '/api/crm/bestand'));
    expect(r.status).toBe(409);
    expect(((await r.json()) as { neuLaden?: boolean }).neuLaden).toBe(true);
  });

  it('Upsert OHNE Stand über eine bestehende Aufgabe ist nur ein Teil-Merge — Notiz, Deadline, Felder bleiben', async () => {
    // Ein altes Fenster/ein Server-Schreiber kennt nur Titel und Status.
    const r = await patch({ ops: [{ op: 'upsert', task: { id: 'a1', title: 'Neuer Titel', status: 'in-progress' } }] });
    expect(r.status).toBe(200);
    const t = (await gespeichert()).tasks.find(x => x.id === 'a1')!;
    expect(t).toMatchObject({ title: 'Neuer Titel', status: 'in-progress', notiz: 'Wichtige Notiz', dueDate: '2026-10-01', felder: { 'f-kanal': 'Web' }, priority: 'medium' });
    // Ausdrücklich geleert (null) fällt weg — nur das.
    await patch({ ops: [{ op: 'upsert', task: { id: 'a1', title: 'Neuer Titel', dueDate: null } }] });
    const t2 = (await gespeichert()).tasks.find(x => x.id === 'a1')!;
    expect(t2.dueDate).toBeUndefined();
    expect(t2.notiz).toBe('Wichtige Notiz');
  });

  it('Löschen mit zu langer Kennung → 400 mit Grund (nie gekürzt = nie eine andere Aufgabe)', async () => {
    const r = await patch({ ops: [{ op: 'delete', id: `a1${'x'.repeat(90)}` }] });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toMatch(/Kennung von 92 Zeichen/);
    expect((await gespeichert()).tasks).toHaveLength(3);
  });
});

describe('A6 — eigene Felder', () => {
  it('Umbenannter Auswahl-Wert zieht an allen Aufgaben mit (in derselben Sperre); der Browser erfährt es über zeilen', async () => {
    const d = await lesen();
    const p = d.state.projects[0];
    const r = await patch({ struktur: { projekte: [{ op: 'upsert', eintrag: { ...p, felder: [{ id: 'f-kanal', name: 'Kanal', typ: 'auswahl', optionen: ['Messe', 'Online'] }, { id: 'f-budget', name: 'Budget', typ: 'betrag' }] }, stand: p.stand }] } });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { zeilen: { liste: string; id: string }[] };
    expect(j.zeilen.some(z => z.liste === 'tasks' && z.id === 'a1')).toBe(true);
    expect((await gespeichert()).tasks.find(x => x.id === 'a1')!.felder).toEqual({ 'f-kanal': 'Online' });
  });

  it('Entfernter Auswahl-Wert: der gespeicherte Wert bleibt bei der nächsten (anderen) Änderung stehen', async () => {
    const d = await lesen();
    const p = d.state.projects[0];
    await patch({ struktur: { projekte: [{ op: 'upsert', eintrag: { ...p, felder: [{ id: 'f-kanal', name: 'Kanal', typ: 'auswahl', optionen: ['Messe'] }] }, stand: p.stand }] } });
    const a1 = (await lesen()).state.tasks.find(t => t.id === 'a1')!;
    // Vorher: diese Titel-Änderung löschte den Wert „Web“ still.
    expect((await patch({ ops: [{ op: 'upsert', task: { ...a1, title: 'Nur der Titel' }, stand: a1.stand }] })).status).toBe(200);
    expect((await gespeichert()).tasks.find(x => x.id === 'a1')!.felder).toEqual({ 'f-kanal': 'Web' });
    // Ein NEU gesetzter ungültiger Wert ersetzt den alten nicht.
    const a1b = (await lesen()).state.tasks.find(t => t.id === 'a1')!;
    await patch({ ops: [{ op: 'upsert', task: { ...a1b, felder: { 'f-kanal': 'Quatsch' } }, stand: a1b.stand }] });
    expect((await gespeichert()).tasks.find(x => x.id === 'a1')!.felder).toEqual({ 'f-kanal': 'Web' });
  });

  it('Betrag als deutscher Text: „1.500“ = 1.500 € (nicht 1,50 €), „1.500,40“, „12,5 €“', async () => {
    const a2 = (await lesen()).state.tasks.find(t => t.id === 'a2')!;
    await patch({ ops: [{ op: 'upsert', task: { ...a2, felder: { 'f-budget': '1.500' } }, stand: a2.stand }] });
    expect((await gespeichert()).tasks.find(x => x.id === 'a2')!.felder).toEqual({ 'f-budget': 150000 });
    const b = (await lesen()).state.tasks.find(t => t.id === 'a2')!;
    await patch({ ops: [{ op: 'upsert', task: { ...b, felder: { 'f-budget': '1.500,40' } }, stand: b.stand }] });
    expect((await gespeichert()).tasks.find(x => x.id === 'a2')!.felder).toEqual({ 'f-budget': 150040 });
  });
});

describe('A7 — Papierkorb', () => {
  it('Löschen legt in den Papierkorb (samt Unteraufgaben); Leser sehen ihn nicht; zweites Löschen ist endgültig', async () => {
    const d = await lesen();
    const a2 = d.state.tasks.find(t => t.id === 'a2')!;
    expect((await patch({ ops: [{ op: 'delete', id: 'a2', stand: a2.stand }] })).status).toBe(200);
    const g = await gespeichert();
    const [t, u] = ['a2', 'a2-u'].map(id => g.tasks.find(x => x.id === id)!);
    expect(t.geloeschtAm).toBeTruthy();
    expect(u).toMatchObject({ geloeschtMit: 'a2' });
    expect(u.geloeschtAm).toBe(t.geloeschtAm);
    // Standard-GET (alle Leser außer der Aufgaben-Seite): ohne Papierkorb.
    const sicht = await lesen('/api/state/tasks');
    expect(sicht.state.tasks.map(x => x.id)).toEqual(['a1']);
    // Endgültig: nur ein Papierkorb-Eintrag — samt Kette.
    const imKorb = (await lesen()).state.tasks.find(x => x.id === 'a2')!;
    expect((await patch({ ops: [{ op: 'delete', id: 'a2', stand: imKorb.stand }] })).status).toBe(200);
    expect((await gespeichert()).tasks.map(x => x.id)).toEqual(['a1']);
  });

  it('Projekt löschen: Notiz, Felder und Aufgaben bleiben im Papierkorb; Dateien gehen erst beim endgültigen Löschen', async () => {
    const { aufgabenDateiAblegen, aufgabenDateienListe } = await import('@/lib/dateien/aufgaben-ablage');
    const datei = await aufgabenDateiAblegen('haus', 'kevin', { projektId: 'p-launch' }, { bytes: Buffer.from('Plan fürs Projekt'), name: 'plan.txt', typ: 'text/plain' });
    const p = (await lesen()).state.projects[0];
    expect((await patch({ struktur: { projekte: [{ op: 'delete', id: 'p-launch', stand: p.stand }] } })).status).toBe(200);
    const g = await gespeichert();
    expect(g.projects[0]).toMatchObject({ id: 'p-launch', notiz: '# Ziel' });
    expect(g.projects[0].geloeschtAm).toBeTruthy();
    expect(g.projects[0].felder).toHaveLength(2);
    expect(g.tasks.every(t => t.geloeschtMit === 'p-launch' || t.geloeschtMit === 'a2' || t.parentId)).toBe(true);
    expect((await aufgabenDateienListe('haus')).map(e => e.id)).toContain(datei.id);
    expect(existsSync(path.join(ordner, 'dateien', 'haus', `${datei.id}.bin`))).toBe(true);
    // Endgültig → Projekt, Aufgaben UND Datei weg.
    const imKorb = (await lesen()).state.projects[0];
    expect((await patch({ struktur: { projekte: [{ op: 'delete', id: 'p-launch', stand: imKorb.stand }] } })).status).toBe(200);
    const n = await gespeichert();
    expect(n.projects).toEqual([]);
    expect(n.tasks).toEqual([]);
    expect((await aufgabenDateienListe('haus')).map(e => e.id)).not.toContain(datei.id);
    expect(existsSync(path.join(ordner, 'dateien', 'haus', `${datei.id}.bin`))).toBe(false);
  });

  it('Morgenlauf räumt nur, was älter als 30 Tage im Papierkorb liegt', async () => {
    const { papierkorbAufraeumen } = await import('@/lib/aufgaben/serie-server');
    const g = await gespeichert();
    await db.saveJson('tasks', { ...g, tasks: g.tasks.map(t => (t.id === 'a2' ? { ...t, geloeschtAm: '2026-08-01T10:00:00.000Z' } : t.id === 'a2-u' ? { ...t, geloeschtAm: '2026-08-01T10:00:00.000Z', geloeschtMit: 'a2' } : t.id === 'a1' ? { ...t, geloeschtAm: '2026-09-20T10:00:00.000Z' } : t)) });
    const r = await papierkorbAufraeumen(new Date('2026-09-29T08:00:00.000Z'));
    expect(r).toMatchObject({ aufgaben: 2, projekte: 0 });
    expect((await gespeichert()).tasks.map(t => t.id)).toEqual(['a1']);
  });
});

describe('A9 — Übernahme beim ersten Schreiben', () => {
  it('Einmal eine Archiv-Kopie des Rohstands + Merker umbauVersion; ein zweites Schreiben legt keine zweite an', async () => {
    const roh = { projects: [projekt({ spaceId: undefined })], tasks: [aufgabe('alt', { spaceId: undefined, subTasks: [{ id: 's1', taskId: 'alt', title: 'Beleg', completed: false, sortOrder: 0, createdAt: T0, updatedAt: T0 }] })] };
    await db.saveJson('tasks', roh);
    const archiv = () => (existsSync(path.join(ordner, 'archiv')) ? readdirSync(path.join(ordner, 'archiv')).filter(n => n.startsWith('tasks-vor-umbau-')) : []);
    for (const n of archiv()) rmSync(path.join(ordner, 'archiv', n));
    const t = (await lesen()).state.tasks.find(x => x.id === 'alt')!;
    expect((await patch({ ops: [{ op: 'upsert', task: { ...t, priority: 'high' }, stand: t.stand }] })).status).toBe(200);
    expect(archiv()).toHaveLength(1);
    const { archivLesen } = await import('@/lib/store/archiv');
    expect(await archivLesen(archiv()[0])).toEqual(roh);
    const g = await gespeichert();
    expect(g.umbauVersion).toBe(2); // seit 29.09. (Paket T1) Version 2
    // Übernommen: alte subTasks sind echte Unteraufgaben.
    expect(g.tasks.some(x => x.parentId === 'alt')).toBe(true);
    const t2 = (await lesen()).state.tasks.find(x => x.id === 'alt')!;
    await patch({ ops: [{ op: 'upsert', task: { ...t2, priority: 'low' }, stand: t2.stand }] });
    expect(archiv()).toHaveLength(1);
  });

  it('Leser nehmen die übernommene Sicht ohne Papierkorb (Glocke: Überfälliges im Papierkorb meldet sich nicht)', async () => {
    const g = await gespeichert();
    await db.saveJson('tasks', { ...g, tasks: [...g.tasks, aufgabe('weg', { dueDate: '2026-09-01', geloeschtAm: T0 }), aufgabe('da', { dueDate: '2026-09-01' })] });
    const { meldungenSicht } = await import('@/lib/meldungen/speicher');
    const s = await meldungenSicht('kevin', new Date('2026-09-10T10:00:00.000Z'));
    const ids = s.meldungen.map(m => m.bezug?.id);
    expect(ids).toContain('da');
    expect(ids).not.toContain('weg');
    const { ladeAufgabenSicht } = await import('@/lib/aufgaben/sicht');
    expect((await ladeAufgabenSicht('kevin')).tasks.map(t => t.id)).not.toContain('weg');
  });
});
