// ─── Aufgaben-Export (29.09., #81): vollständig, Sichtfilter „nur ich“, und er lässt sich wieder einlesen ──
// Eigener Datenordner, erfundene Konten, Aufgaben und Datei-Angaben.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Task, TasksState } from '@/types/tasks';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-aufgaben-export-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-aufgaben-export';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

const T0 = '2026-09-01T08:00:00.000Z';
const aufgabe = (id: string, extra: Record<string, unknown> = {}) => ({ id, projectId: 'p-1', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'privat', ...extra });
const konto = (id: string, speicher: string, name: string, rolle: 'inhaber' | 'mitglied', haushalt?: string) => ({ id, speicher, email: `${speicher}@test.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });
type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler };
let db: typeof import('@/lib/store/local-db');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'Kevin Beispiel', 'inhaber', 'haus'), konto('k2', 'malin', 'Malin Beispiel', 'mitglied', 'haus'), konto('k3', 'fremd', 'Fremd', 'mitglied', 'anders')], einladungen: [] });
  await db.saveJson('tasks', {
    projects: [{ id: 'p-1', title: 'Haus', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat', notiz: 'Projektnotiz' }],
    gruppen: [{ id: 'g-1', projektId: 'p-1', titel: 'Garten', farbe: '#3DE28B', sortOrder: 0 }],
    listen: [{ id: 'l-1', projektId: 'p-1', titel: 'Oktober', sortOrder: 0, gruppeId: 'g-1' }],
    statusEigen: [], vorlagen: [],
    tasks: [
      aufgabe('a', { listeId: 'l-1', kommentare: [{ id: 'k-1', von: 'kevin', text: 'Bleibt', am: T0 }, { id: 'k-2', von: 'malin', text: 'Weg damit', am: T0, entfernt: { am: T0, von: 'malin' } }], wiederholung: { regel: 'woechentlich', wochentage: [1] }, serieId: 'a' }),
      aufgabe('a-u', { parentId: 'a', listeId: 'l-1' }),
      aufgabe('b', { abhaengigVon: ['a'], dependencies: [{ blockedByTaskId: 'a' }] }),
      aufgabe('korb', { geloeschtAm: T0 }),
      aufgabe('archiv', { archiviertAm: T0, archivId: 'na-test-archiv' }),
      aufgabe('geheim', { sichtbarkeit: 'nur-ich', angelegtVon: 'malin', assignee: 'malin' }),
      aufgabe('geheim-u', { parentId: 'geheim', assignee: 'malin' }),
    ],
  });
  await db.saveJson('aufgaben-dateien--haus', { eintraege: [
    { id: 'd-1', art: 'sonstiges', projektId: 'p-1', aufgabeId: 'a', bereich: 'privat', datei: { name: 'plan.pdf', typ: 'pdf', groesse: 1234 }, hochgeladenAm: T0, hochgeladenVon: 'kevin' },
    { id: 'd-2', art: 'sonstiges', projektId: 'p-1', aufgabeId: 'geheim', bereich: 'privat', datei: { name: 'geschenk.pdf', typ: 'pdf', groesse: 10 }, hochgeladenAm: T0, hochgeladenVon: 'malin' },
  ] });
  route = (await import('@/app/api/aufgaben/export/route')) as unknown as typeof route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const holen = async (person: string, dienst = false) => route.GET(new Request('http://test/api/aufgaben/export', { headers: dienst ? { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person } : { 'x-make-user': person } }));

describe('GET /api/aufgaben/export', () => {
  it('nur eine Person im Haushalt mit eigener Sitzung', async () => {
    expect((await holen('fremd')).status).toBe(403);
    expect((await holen('kevin', true)).status).toBe(403);
    const r = await holen('kevin');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-disposition')).toMatch(/attachment; filename="aufgaben-export-\d{4}-\d{2}-\d{2}\.json"/);
  });

  it('vollständig: Hierarchie, Serien, Abhängigkeiten, Kommentare, Dateiliste — ohne fremde „nur ich“-Aufgaben', async () => {
    const d = await (await holen('kevin')).json();
    expect(d).toMatchObject({ format: 'make-os-aufgaben', version: 1, von: 'kevin' });
    expect(d.zahlen).toMatchObject({ projekte: 1, gruppen: 1, listen: 1, aufgaben: 4, unteraufgaben: 1, dateien: 1, serien: 1, abhaengigkeiten: 1 });
    const ids = d.aufgaben.map((t: Task) => t.id).sort();
    expect(ids).toEqual(['a', 'a-u', 'archiv', 'b', 'korb']);
    expect(d.aufgaben.find((t: Task) => t.id === 'korb').geloeschtAm).toBe(T0);
    expect(d.aufgaben.find((t: Task) => t.id === 'archiv').archivId).toBe('na-test-archiv');
    const a = d.aufgaben.find((t: Task) => t.id === 'a');
    expect(a.kommentare.map((k: { text: string }) => k.text)).toEqual(['Bleibt', 'Kommentar entfernt']);
    expect(d.serien).toEqual([expect.objectContaining({ regel: 'woechentlich', aufgaben: ['a'] })]);
    expect(d.abhaengigkeiten).toEqual([{ aufgabe: 'b', wartetAuf: 'a' }]);
    expect(d.dateien).toEqual([expect.objectContaining({ id: 'd-1', name: 'plan.pdf', aufgabeId: 'a' })]);
    expect(d.spaces.map((s: { id: string }) => s.id)).toContain('privat');
    // Malin sieht ihre eigene „nur ich“-Aufgabe samt Unteraufgabe und Datei.
    const m = await (await holen('malin')).json();
    expect(m.aufgaben.map((t: Task) => t.id)).toEqual(expect.arrayContaining(['geheim', 'geheim-u']));
    expect(m.dateien.map((x: { id: string }) => x.id).sort()).toEqual(['d-1', 'd-2']);
  });

  it('der Export lässt sich wieder einlesen — derselbe Bestand (Struktur, Aufgaben, Marken)', async () => {
    const { exportEinlesen, ExportUngueltig } = await import('@/lib/aufgaben/export');
    const { ladeAufgaben, sichtFuer } = await import('@/lib/aufgaben/sicht');
    const d = await (await holen('kevin')).json();
    const zurueck = exportEinlesen(JSON.parse(JSON.stringify(d)));
    const quelle = sichtFuer(await ladeAufgaben(), 'kevin') as TasksState;
    const ohneText = (t: Task) => ({ ...t, kommentare: t.kommentare?.map(k => (k.entfernt ? { ...k, text: 'Kommentar entfernt' } : k)) });
    const sortiert = <T extends { id: string }>(l: T[]) => [...l].sort((x, y) => x.id.localeCompare(y.id));
    const norm = (t: Task) => JSON.parse(JSON.stringify(ohneText(t)));
    expect(sortiert(zurueck.tasks).map(norm)).toEqual(sortiert(quelle.tasks).map(norm));
    expect(zurueck.projects).toEqual(quelle.projects);
    expect(zurueck.listen).toEqual(quelle.listen);
    expect(zurueck.gruppen).toEqual(quelle.gruppen);
    expect(() => exportEinlesen({ format: 'etwas-anderes' })).toThrow(ExportUngueltig);
  });
});
