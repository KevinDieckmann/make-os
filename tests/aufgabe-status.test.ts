// ─── Status EINER Aufgabe setzen, ohne fremde Änderungen zu verlieren (28.09.) ──
// Prüfbericht 28.09.: SaeuleView las alle Aufgaben und schrieb sie per PUT zurück.
// Legt zwischen Lesen und Schreiben jemand eine Aufgabe an, war sie weg. Der Test
// schiebt genau dort einen zweiten Schreiber dazwischen. Eigener Datenordner.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { aufgabeStatusSetzen } from '@/lib/aufgaben/status';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-aufgabe-status-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Mod = { GET: (r?: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
let route: Mod;
const aufgabe = (id: string) => ({ id, projectId: 'p1', title: `Aufgabe ${id}`, status: 'todo', priority: 'high', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' });
// Seit 28.09. abends: nur im Haushalt des Inhabers — die Sitzung nennt die Person.
const kopf = { 'content-type': 'application/json', 'x-make-user': 'kevin' };
const patch = (body: unknown) => route.PATCH(new Request('http://test/api/state/tasks', { method: 'PATCH', headers: kopf, body: JSON.stringify(body) }));
const alle = async () => ((await (await route.GET(new Request('http://test/api/state/tasks', { headers: kopf }))).json()) as { state: { tasks: { id: string; status: string }[] } }).state.tasks;

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('tasks', { projects: [{ id: 'p1', name: 'Probe' }], tasks: [aufgabe('a1'), aufgabe('a2')] });
  await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: 'kevin@test.invalid', name: 'Kevin', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' }], einladungen: [] });
  route = (await import('@/app/api/state/tasks/route')) as unknown as Mod;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('aufgabeStatusSetzen', () => {
  it('schreibt nur die eine Aufgabe — eine dazwischen angelegte Aufgabe bleibt', async () => {
    let dazwischen = false;
    const netz = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const methode = (init?.method ?? 'GET').toUpperCase();
      if (methode === 'GET') {
        const r = await route.GET(new Request('http://test/api/state/tasks', { headers: kopf }));
        // Genau hier (nach dem Lesen, vor dem Schreiben) legt Malin eine Aufgabe an.
        if (!dazwischen) { dazwischen = true; expect((await patch({ ops: [{ op: 'upsert', task: aufgabe('m1') }] })).status).toBe(200); }
        return r;
      }
      return route[methode as 'PATCH'](new Request('http://test/api/state/tasks', { ...init, headers: kopf }));
    }) as typeof fetch;
    await aufgabeStatusSetzen('a1', 'done', netz);
    const jetzt = await alle();
    expect(jetzt.map(t => t.id).sort()).toEqual(['a1', 'a2', 'm1']);
    expect(jetzt.find(t => t.id === 'a1')!.status).toBe('done');
  });

  it('SaeuleView schreibt Aufgaben nicht mehr per PUT', () => {
    const quelle = readFileSync(path.join(process.cwd(), 'components/os/SaeuleView.tsx'), 'utf8');
    expect(quelle).not.toMatch(/api\/state\/tasks['"`][^)]*method:\s*'PUT'/);
    expect(quelle).toContain('aufgabeStatusSetzen');
  });
});
