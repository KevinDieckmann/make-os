// ─── Follow-up = Aufgabe (29.09., #99): Abgleich in beide Richtungen, idempotent; Liste zeigt Aufgaben mit CRM-Bezug ──
// Eigener Datenordner, erfundene Konten, Kontakte, Aufgaben und Follow-ups. melde() wird nicht gebraucht (still).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Task, TasksState } from '@/types/tasks';
import { neuErledigt, followupsErledigen, aufgabenAlsFaellig } from '@/lib/crm/followup-aufgabe';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-followup-aufgabe-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-followup-aufgabe';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

const T0 = '2026-09-01T08:00:00.000Z';
const IN5 = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
const aufgabe = (id: string, extra: Record<string, unknown> = {}) => ({ id, projectId: 'sonstige-kdv', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...extra }) as unknown as Task;
const fu = (id: string, aufgabeId?: string, extra: Record<string, unknown> = {}) => ({ id, bezug: { art: 'kontakt', id: 'c-1' }, kontaktId: 'c-1', art: 'anruf', text: `Follow-up ${id}`, faellig: IN5, zustaendig: 'kevin', status: 'offen', quelle: 'hand', ...(aufgabeId ? { aufgabeId } : {}), angelegt: T0, geaendert: T0, ...extra });
const konto = (id: string, speicher: string, name: string, rolle: 'inhaber' | 'mitglied', haushalt?: string) => ({ id, speicher, email: `${speicher}@test.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
type Handler = (r: Request) => Promise<Response>;
let tasksRoute: { GET: Handler; PATCH: Handler };
let fuRoute: { GET: Handler; POST: Handler };
let db: typeof import('@/lib/store/local-db');
const crmFollowups = async () => ((await db.loadJson<{ followups?: { id: string; status: string; aufgabeId?: string }[] }>('crm'))?.followups ?? []);
const task = async (id: string) => (await db.loadJson<TasksState>('tasks'))!.tasks.find(t => t.id === id)!;

describe('rein', () => {
  it('neu erledigt, Follow-ups erledigen (idempotent), Aufgaben mit Bezug als Fälliges', () => {
    const vor = { tasks: [aufgabe('a'), aufgabe('b', { status: 'done' })] };
    const nach = { tasks: [aufgabe('a', { status: 'done' }), aufgabe('b', { status: 'done' })] };
    expect(neuErledigt(vor, nach)).toEqual(['a']);
    const c = { followups: [fu('f1', 'a'), fu('f2', 'x'), fu('f3', 'a', { status: 'erledigt' })] } as never;
    const r = followupsErledigen(c, ['a'], 'kevin', T0);
    expect(r.erledigt).toEqual(['f1']);
    expect(followupsErledigen(r.crm, ['a'], 'kevin', T0).crm).toBe(r.crm);
    const f = aufgabenAlsFaellig([aufgabe('m', { bezug: { kontaktId: 'c-1' }, dueDate: '2026-09-28' }), aufgabe('n', { dueDate: '2026-09-28' }), aufgabe('o', { bezug: { firmaId: 'f' }, dueDate: '2026-12-01' })], '2026-09-29');
    expect(f.map(x => [x.aufgabeId, x.tageUeber])).toEqual([['m', 1]]);
  });
});

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'Kevin Beispiel', 'inhaber', 'haus'), konto('k2', 'malin', 'Malin Beispiel', 'mitglied', 'haus')], einladungen: [] });
  tasksRoute = (await import('@/app/api/state/tasks/route')) as unknown as typeof tasksRoute;
  fuRoute = (await import('@/app/api/crm/followup/route')) as unknown as typeof fuRoute;
});
beforeEach(async () => {
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-1', vorname: 'Erika', nachname: 'Beispiel', stufe: 'warm' }] });
  await db.saveJson('crm', { firmen: [], mandate: [], chancen: [], teilnahmen: [], followups: [fu('f-1', 't-1'), fu('f-2', 't-2'), fu('f-3')] });
  await db.saveJson('tasks', { projects: [], tasks: [aufgabe('t-1', { bezug: { kontaktId: 'c-1' } }), aufgabe('t-2', { bezug: { kontaktId: 'c-1' } })], listen: [], statusEigen: [], gruppen: [], vorlagen: [] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Abgleich über die Routen', () => {
  it('Aufgabe erledigt (Aufgaben-Seite) → verknüpftes Follow-up erledigt; nochmal ändert nichts', async () => {
    const d = await (await tasksRoute.GET(new Request('http://test/api/state/tasks', { headers: sitzung('kevin') }))).json() as { state: { tasks: (Task & { stand: string })[] } };
    const t1 = d.state.tasks.find(t => t.id === 't-1')!;
    const r = await tasksRoute.PATCH(new Request('http://test/api/state/tasks', { method: 'PATCH', headers: sitzung('kevin'), body: JSON.stringify({ ops: [{ op: 'upsert', task: { ...t1, status: 'done' }, stand: t1.stand }] }) }));
    expect(r.status).toBe(200);
    const f = await crmFollowups();
    expect(f.find(x => x.id === 'f-1')!.status).toBe('erledigt');
    expect(f.find(x => x.id === 'f-2')!.status).toBe('offen');
    expect(f.find(x => x.id === 'f-3')!.status).toBe('offen');
  });

  it('Follow-up erledigt (Markttraktion) → verknüpfte Aufgabe erledigt (über den Schreibweg, mit Verlauf); idempotent', async () => {
    const r = await fuRoute.POST(new Request('http://test/api/crm/followup', { method: 'POST', headers: sitzung('malin'), body: JSON.stringify({ aktion: 'erledigen', id: 'f-2', ergebnis: 'gespraech' }) }));
    expect(r.status).toBe(200);
    const t2 = await task('t-2');
    expect(t2.status).toBe('done');
    expect(t2.completedAt).toBeTruthy();
    expect(t2.verlauf?.some(v => v.was === 'status' && v.durch === 'system')).toBe(true);
    // Das Follow-up bleibt einmal erledigt (die Rückrichtung findet nichts Offenes mehr).
    expect((await crmFollowups()).filter(x => x.id === 'f-2').map(x => x.status)).toEqual(['erledigt']);
    // Ohne Aufgabe: nichts passiert an den Aufgaben.
    const vorher = JSON.stringify((await db.loadJson<TasksState>('tasks'))!.tasks);
    await fuRoute.POST(new Request('http://test/api/crm/followup', { method: 'POST', headers: sitzung('kevin'), body: JSON.stringify({ aktion: 'erledigen', id: 'f-3' }) }));
    expect(JSON.stringify((await db.loadJson<TasksState>('tasks'))!.tasks)).toBe(vorher);
  });
});
