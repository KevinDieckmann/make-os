// ─── Umzug Business → Privat (29.09., #4): Dateien ziehen ihren Bereich mit ──
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Task } from '@/types/tasks';
import { bereichGewechselt } from '@/lib/aufgaben/umzug-dateien';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-aufgaben-umzug-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-aufgaben-umzug';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

const T0 = '2026-09-01T08:00:00.000Z';
const aufgabe = (id: string, extra: Record<string, unknown> = {}) => ({ id, projectId: 'sonstige-kdv', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...extra });
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher, email: `${speicher}@test.invalid`, name: `${speicher} Beispiel`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' });
type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; PATCH: Handler };
let db: typeof import('@/lib/store/local-db');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
  await db.saveJson('tasks', { projects: [], tasks: [aufgabe('a', { bezug: { firmaId: 'f-1' } }), aufgabe('a-u', { parentId: 'a' }), aufgabe('b')], listen: [], statusEigen: [], gruppen: [], vorlagen: [] });
  await db.saveJson('aufgaben-dateien--haus', { eintraege: [
    { id: 'd-1', art: 'sonstiges', projektId: 'sonstige-kdv', aufgabeId: 'a', bereich: 'business', datei: { name: 'x.pdf', typ: 'pdf', groesse: 1 }, hochgeladenAm: T0, hochgeladenVon: 'kevin' },
    { id: 'd-2', art: 'sonstiges', projektId: 'sonstige-kdv', aufgabeId: 'a-u', bereich: 'business', datei: { name: 'y.pdf', typ: 'pdf', groesse: 1 }, hochgeladenAm: T0, hochgeladenVon: 'kevin' },
    { id: 'd-3', art: 'sonstiges', projektId: 'sonstige-kdv', aufgabeId: 'b', bereich: 'business', datei: { name: 'z.pdf', typ: 'pdf', groesse: 1 }, hochgeladenAm: T0, hochgeladenVon: 'kevin' },
  ] });
  route = (await import('@/app/api/state/tasks/route')) as unknown as typeof route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Umzug nach Privat', () => {
  it('rein: nur Aufgaben mit anderem Bereich', () => {
    const m = bereichGewechselt({ tasks: [aufgabe('a'), aufgabe('b'), aufgabe('c', { spaceId: 'kdc' })] as unknown as Task[] }, { tasks: [aufgabe('a', { spaceId: 'privat' }), aufgabe('b', { spaceId: 'kdc' }), aufgabe('c', { spaceId: 'kdv' })] as unknown as Task[] });
    // 05.10.: kdv → kdc und kdc → kdv wechseln jetzt auch den Bereich (die Selbstständigkeit steht unter Privat) — vorher nur 'a'.
    expect(Array.from(m.entries())).toEqual([['a', 'privat'], ['b', 'privat'], ['c', 'business']]);
  });
  it('Aufgabe (samt Unteraufgabe) nach Privat → ihre Dateien werden „privat“, andere bleiben', async () => {
    const d = await (await route.GET(new Request('http://test/api/state/tasks', { headers: { 'x-make-user': 'kevin' } }))).json() as { state: { tasks: (Task & { stand: string })[] } };
    const a = d.state.tasks.find(t => t.id === 'a')!;
    const r = await route.PATCH(new Request('http://test/api/state/tasks', { method: 'PATCH', headers: { 'x-make-user': 'kevin' }, body: JSON.stringify({ ops: [{ op: 'upsert', task: { ...a, spaceId: 'privat', projectId: 'sonstige-privat', space: 'privat', bezug: undefined }, stand: a.stand }] }) }));
    expect(r.status).toBe(200);
    const e = (await db.loadJson<{ eintraege: { id: string; bereich: string }[] }>('aufgaben-dateien--haus'))!.eintraege;
    expect(Object.fromEntries(e.map(x => [x.id, x.bereich]))).toEqual({ 'd-1': 'privat', 'd-2': 'privat', 'd-3': 'business' });
  });
});
