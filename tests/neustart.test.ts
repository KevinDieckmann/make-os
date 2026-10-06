// ─── „Neu anfangen“ (29.09., Kevin): archivieren statt löschen, ganz oder einzeln zurück ──
// Rein (lib/aufgaben/neustart.ts, lib/planung/neustart.ts) und über die Route mit eigenem Datenordner, erfundenen
// Konten, Aufgaben, Zielen und Meilensteinen.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Task, TasksState } from '@/types/tasks';
import { aufgabenArchivieren, aufgabenZurueck, ohneArchiv, aufgabenVorschau, istModulAufgabe } from '@/lib/aufgaben/neustart';
import { aufgabenSicht } from '@/lib/aufgaben/papierkorb';
import { zieleHerausnehmen, zieleZurueck, meilensteineHerausnehmen, meilensteineZurueck } from '@/lib/planung/neustart';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-neustart-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-neustart';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const T0 = '2026-09-01T08:00:00.000Z';
const JETZT = '2026-09-30T06:00:00.000Z';
const aufgabe = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: 'p1', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'privat', ...extra });
const stand = (): TasksState => ({
  projects: [
    { id: 'p1', title: 'Haus', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat' },
    { id: 'p2', title: 'Launch', category: 'business', owner: 'both', color: '#DE9E63', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdc' },
    { id: 'p-korb', title: 'Weg', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat', geloeschtAm: T0 },
  ],
  gruppen: [{ id: 'g1', projektId: 'p2', titel: 'Marketing', farbe: '#21B5AA', sortOrder: 0 }],
  listen: [
    { id: 'l1', projektId: 'p2', titel: 'September', sortOrder: 0, gruppeId: 'g1' },
    { id: 'l2', projektId: 'p1', titel: 'Monatsabschluss', sortOrder: 0, wiederholung: { regel: 'monatlich', monatstag: 1, naechste: '2026-10-01' } },
  ],
  statusEigen: [], vorlagen: [{ id: 'v1', art: 'liste', titel: 'Vorlage', inhalt: { aufgaben: [] } }],
  tasks: [
    aufgabe('a1'),
    aufgabe('a1-u', { parentId: 'a1' }),
    aufgabe('a2', { projectId: 'p2', spaceId: 'kdc', listeId: 'l1', wiederholung: { regel: 'woechentlich', wochentage: [1] }, serieId: 'a2' }),
    aufgabe('a3', { status: 'done', completedAt: T0, projectId: 'sonstige-privat' }),
    aufgabe('steuer-kdc-ust-2026-10', { projectId: 'sonstige-kdc', spaceId: 'kdc', dueDate: '2026-10-10' }),
    aufgabe('steuer-kdc-ust-2026-08', { projectId: 'sonstige-kdc', spaceId: 'kdc', status: 'done', completedAt: T0 }),
    aufgabe('korb', { geloeschtAm: T0 }),
  ],
});

describe('rein: Aufgaben archivieren und zurückholen', () => {
  it('archiviert alles Sichtbare — Papierkorb, Vorlagen und offene Modul-Fristen bleiben; Serien ruhen', () => {
    const s = stand();
    const r = aufgabenArchivieren(s, 'na-test-1', JETZT);
    expect(r.erfasst.projekte.sort()).toEqual(['p1', 'p2']);
    expect(r.erfasst.aufgaben.sort()).toEqual(['a1', 'a1-u', 'a2', 'a3', 'steuer-kdc-ust-2026-08']);
    expect(r.erfasst.listen.sort()).toEqual(['l1', 'l2']);
    expect(r.erfasst.gruppen).toEqual(['g1']);
    expect(r.erfasst.pausiert.map(p => `${p.art}:${p.id}`).sort()).toEqual(['aufgabe:a2', 'liste:l2']);
    const a2 = r.state.tasks.find(t => t.id === 'a2')!;
    expect(a2.wiederholung).toBeUndefined();
    expect(a2).toMatchObject({ archiviertAm: JETZT, archivId: 'na-test-1', updatedAt: T0 });
    expect(r.state.vorlagen).toEqual(s.vorlagen);
    const sicht = aufgabenSicht(r.state);
    expect(sicht.tasks.map(t => t.id)).toEqual(['steuer-kdc-ust-2026-10']);
    expect(sicht.projects).toEqual([]);
    expect(sicht.listen).toEqual([]);
    expect(sicht.gruppen).toEqual([]);
    expect(istModulAufgabe({ id: 'loeschfrist-kontakte' })).toBe(true);
  });

  it('archivieren → alles zurück = identisch (auch Serien); zweimal archivieren ändert nichts', () => {
    const s = stand();
    const a = aufgabenArchivieren(s, 'na-test-1', JETZT);
    expect(aufgabenArchivieren(a.state, 'na-test-2', JETZT).state).toBe(a.state);
    const z = aufgabenZurueck(a.state, 'na-test-1', { art: 'alles' }, a.erfasst.pausiert);
    expect(z.state).toEqual(s);
    // Idempotent: ein zweites „alles zurück“ ändert nichts.
    expect(aufgabenZurueck(z.state, 'na-test-1', { art: 'alles' }, a.erfasst.pausiert).state).toBe(z.state);
    // Fremde Lauf-Kennung holt nichts.
    expect(aufgabenZurueck(a.state, 'na-anders-1', { art: 'alles' }, a.erfasst.pausiert).state).toBe(a.state);
  });

  it('einzeln: eine Aufgabe kommt mit Unteraufgaben und der Hülle ihres Projekts/ihrer Liste/Gruppe — die übrigen bleiben im Archiv', () => {
    const a = aufgabenArchivieren(stand(), 'na-test-1', JETZT);
    const z = aufgabenZurueck(a.state, 'na-test-1', { art: 'aufgabe', id: 'a2' }, a.erfasst.pausiert);
    expect(z.aufgaben).toEqual(['a2']);
    expect(z.projekte).toEqual(['p2']);
    expect(z.listen).toEqual(['l1']);
    expect(z.gruppen).toEqual(['g1']);
    const sicht = ohneArchiv(z.state);
    expect(sicht.tasks.map(t => t.id).sort()).toEqual(['a2', 'steuer-kdc-ust-2026-10']);
    expect(sicht.tasks.find(t => t.id === 'a2')!.wiederholung).toEqual({ regel: 'woechentlich', wochentage: [1] });
    // Unteraufgabe gewählt → ihre Hauptaufgabe kommt mit.
    const u = aufgabenZurueck(a.state, 'na-test-1', { art: 'aufgabe', id: 'a1-u' }, a.erfasst.pausiert);
    expect(u.aufgaben.sort()).toEqual(['a1', 'a1-u']);
    // Projekt: alles, was mit dem Lauf in diesem Projekt ging.
    const p = aufgabenZurueck(a.state, 'na-test-1', { art: 'projekt', id: 'p1' }, a.erfasst.pausiert);
    expect(p.aufgaben.sort()).toEqual(['a1', 'a1-u']);
    expect(p.listen).toEqual(['l2']);
    expect(p.state.listen!.find(l => l.id === 'l2')!.wiederholung).toMatchObject({ regel: 'monatlich' });
  });

  it('Vorschau zählt genau wie der Lauf und nennt Serien und bleibende Fristen', () => {
    const v = aufgabenVorschau(stand());
    expect(v).toMatchObject({ projekte: 2, listen: 2, gruppen: 1, aufgaben: 4, unteraufgaben: 1, erledigt: 2 });
    expect(v.serien.map(x => x.titel).sort()).toEqual(['Aufgabe a2', 'Monatsabschluss']);
    expect(v.bleiben.map(x => x.id)).toEqual(['steuer-kdc-ust-2026-10']);
  });
});

describe('rein: Ziele und Meilensteine', () => {
  const ziele = { jahr: [{ id: 'z1', titel: 'Hyrox', fortschritt: 10, space: 'privat' }], quartal: [{ id: 'z1~quartal', titel: 'Hyrox Q', fortschritt: 0, abgeleitetVon: 'z1' }], monat: [], woche: [], tag: [], fokus: { jahr: 'Gesund', 'business:jahr': '' }, _v: 1 };
  it('herausnehmen → zurück = identisch; vorhandene Kennungen werden nie überschrieben; Fokus nur in leere Plätze', () => {
    const r = zieleHerausnehmen(ziele, 'ziele');
    expect(r.ziele.map(z => z.ziel.id)).toEqual(['z1~quartal', 'z1']);
    expect(r.fokus).toEqual({ speicher: 'ziele', fokus: { jahr: 'Gesund' } });
    expect(r.rest).toMatchObject({ jahr: [], quartal: [], fokus: {}, _v: 1 });
    const z = zieleZurueck(r.rest, r.ziele, r.fokus);
    expect(z.datei).toEqual({ ...ziele, fokus: { jahr: 'Gesund' } });
    const neu = { ...r.rest, jahr: [{ id: 'z1', titel: 'Neu', fortschritt: 0 }], fokus: { jahr: 'Neuer Fokus' } };
    const z2 = zieleZurueck(neu, r.ziele, r.fokus);
    expect(z2.schon).toEqual(['z1']);
    expect(z2.datei.jahr).toEqual([{ id: 'z1', titel: 'Neu', fortschritt: 0 }]);
    expect(z2.datei.fokus).toEqual({ jahr: 'Neuer Fokus' });
  });
  it('Meilensteine: herausnehmen → zurück = identisch', () => {
    const m = { meilensteine: [{ id: 'm1', titel: 'Start', fortschritt: 0, erledigt: false }], _v: 1 };
    const r = meilensteineHerausnehmen(m);
    expect(r.rest.meilensteine).toEqual([]);
    expect(meilensteineZurueck(r.rest, r.raus).datei).toEqual(m);
  });
});

// ── Route ──────────────────────────────────────────────────────────────────
type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; POST: Handler };
let db: typeof import('@/lib/store/local-db');
const konto = (id: string, speicher: string, name: string, rolle: 'inhaber' | 'mitglied', haushalt?: string) => ({ id, speicher, email: `${speicher}@test.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const anfrage = (kopf: Record<string, string>, method = 'GET', body?: unknown, q = '') => new Request(`http://test/api/neustart${q}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const ohneV = <T,>(x: T): T => { const n = { ...(x as Record<string, unknown>) }; delete n._v; delete n.umbauVersion; return n as T; };

const ZIELE = { jahr: [{ id: 'zj', titel: 'Umsatz', fortschritt: 20, space: 'business', zielwert: 120 }], quartal: [], monat: [{ id: 'zm', titel: 'Laufen', fortschritt: 50 }], woche: [], tag: [{ id: 'zt', titel: 'Heute', fortschritt: 0 }], fokus: { jahr: 'Fokus Jahr' } };
const EIGEN = { jahr: [], quartal: [], monat: [], woche: [{ id: 'ze', titel: 'Eigenes', fortschritt: 0 }], tag: [], fokus: {} };
const MS = { meilensteine: [{ id: 'm1', titel: 'Launch', fortschritt: 0, erledigt: false, space: 'business', faellig: '2026-12-01' }] };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'Kevin Beispiel', 'inhaber', 'haus'), konto('k2', 'malin', 'Malin Beispiel', 'mitglied', 'haus'), konto('k3', 'fremd', 'Fremd', 'mitglied', 'test')], einladungen: [] });
  route = (await import('@/app/api/neustart/route')) as unknown as { GET: Handler; POST: Handler };
});
beforeEach(async () => {
  const { tasks: _t, ...rest } = stand();
  await db.saveJson('tasks', { ...rest, tasks: stand().tasks });
  await db.saveJson('ziele', ZIELE);
  await db.saveJson('ziele-eigen--malin', EIGEN);
  await db.saveJson('meilensteine', MS);
  await db.saveJson('meldungen--malin', { eintraege: [{ id: 'mz1', art: 'zuweisung', titel: 'Aufgabe a1', link: '/os/aufgaben?offen=a1', bezug: { art: 'aufgabe', id: 'a1' }, am: T0 }, { id: 'mz2', art: 'zuweisung', titel: 'Steuer', link: '/x', bezug: { art: 'aufgabe', id: 'steuer-kdc-ust-2026-10' }, am: T0 }], einstellungen: { telegram: false } });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Route /api/neustart', () => {
  it('Zugang: nur Personen im Haushalt mit eigener Sitzung — kein Dienstweg, kein fremdes Konto', async () => {
    expect((await route.GET(anfrage(sitzung('fremd')))).status).toBe(403);
    expect((await route.GET(anfrage(dienst()))).status).toBe(403);
    expect((await route.GET(anfrage(dienst('kevin')))).status).toBe(403);
    expect((await route.POST(anfrage(dienst('kevin'), 'POST', { aktion: 'neu-anfangen', laufId: 'na-dienst-1', bestaetigung: 'NEU ANFANGEN' }))).status).toBe(403);
    expect((await route.GET(anfrage(sitzung('malin')))).status).toBe(200);
  });

  it('Vorschau zählt Ziele (geteilt + persönlich), Meilensteine, Projekte, Aufgaben', async () => {
    const d = await (await route.GET(anfrage(sitzung('kevin')))).json() as { vorschau: Record<string, unknown> };
    // Vorher 4 Aufgaben. Seit dem Umbau v3 (06.10.) liest der Server die Gruppe „Marketing“ als Liste und die Liste „September“
    // als Aufgabe darin (l1) — eine Aufgabe mehr; a2 läuft als Serie und bleibt Hauptaufgabe.
    expect(d.vorschau).toMatchObject({ ziele: 4, meilensteine: 1, projekte: 2, aufgaben: 5, unteraufgaben: 1, fokus: 1 });
  });

  it('ohne getipptes „NEU ANFANGEN“ passiert nichts', async () => {
    const r = await route.POST(anfrage(sitzung('kevin'), 'POST', { aktion: 'neu-anfangen', laufId: 'na-ohne-1', bestaetigung: 'neu anfangen' }));
    expect(r.status).toBe(400);
    expect(ohneV(await db.loadJson('ziele'))).toEqual(ZIELE);
  });

  it('neu anfangen → leer (Sicherheitskopie, Glocke gelesen), idempotent; alles zurück → identisch', async () => {
    // Der Bestand, wie jeder Schreiber ihn ablegt (Übernahme: Space/Einheit abgeleitet) — das ist „vorher“.
    const { uebernehmen } = await import('@/lib/aufgaben/struktur');
    const vorher = { tasks: uebernehmen(ohneV(await db.loadJson<TasksState>('tasks'))!).state, ziele: ohneV(await db.loadJson('ziele')), eigen: ohneV(await db.loadJson('ziele-eigen--malin')), ms: ohneV(await db.loadJson('meilensteine')) };
    const r = await route.POST(anfrage(sitzung('kevin'), 'POST', { aktion: 'neu-anfangen', laufId: 'na-lauf-0001', bestaetigung: 'NEU ANFANGEN' }));
    expect(r.status).toBe(200);
    const d = await r.json() as { schon: boolean; bericht: Record<string, unknown> };
    expect(d.schon).toBe(false);
    expect(d.bericht).toMatchObject({ projekte: 2, aufgaben: 5, unteraufgaben: 1, ziele: 4, meilensteine: 1, fokus: 1, meldungenGelesen: 1 }); // vorher aufgaben: 4 (Umbau v3: l1)
    // Leser sehen nichts mehr außer der offenen Steuer-Frist.
    const { ladeAufgaben } = await import('@/lib/aufgaben/sicht');
    const sicht = aufgabenSicht(await ladeAufgaben());
    expect(sicht.tasks.map(t => t.id)).toEqual(['steuer-kdc-ust-2026-10']);
    expect(ohneV(await db.loadJson<Record<string, unknown>>('ziele'))).toMatchObject({ jahr: [], monat: [], tag: [], fokus: {} });
    expect(ohneV(await db.loadJson<Record<string, unknown>>('ziele-eigen--malin'))).toMatchObject({ woche: [] });
    expect((await db.loadJson<{ meilensteine: unknown[] }>('meilensteine'))!.meilensteine).toEqual([]);
    const glocke = await db.loadJson<{ eintraege: { id: string; gelesen?: boolean }[] }>('meldungen--malin');
    expect(glocke!.eintraege.find(m => m.id === 'mz1')!.gelesen).toBe(true);
    expect(glocke!.eintraege.find(m => m.id === 'mz2')!.gelesen).toBeFalsy();
    const { readdirSync } = await import('node:fs');
    expect(readdirSync(path.join(ordner, 'archiv')).some(n => n.startsWith('neustart-na-lauf-0001-'))).toBe(true);
    // Derselbe Lauf noch einmal: nichts Neues.
    const r2 = await (await route.POST(anfrage(sitzung('kevin'), 'POST', { aktion: 'neu-anfangen', laufId: 'na-lauf-0001', bestaetigung: 'NEU ANFANGEN' }))).json() as { schon: boolean };
    expect(r2.schon).toBe(true);
    // Archiv-Ansicht
    const a = await (await route.GET(anfrage(sitzung('malin'), 'GET', undefined, '?archiv=1'))).json() as { laeufe: { id: string; projekte: { id: string; aufgaben: number }[]; aufgaben: { id: string }[]; ziele: unknown[]; serien: unknown[]; offen: number }[] };
    expect(a.laeufe).toHaveLength(1);
    expect(a.laeufe[0].projekte.map(p => [p.id, p.aufgaben]).sort()).toEqual([['p1', 1], ['p2', 2]]); // vorher p2: 1 (Umbau v3: + l1)
    expect(a.laeufe[0].aufgaben.map(x => x.id).sort()).toEqual(['a3', 'steuer-kdc-ust-2026-08']);
    expect(a.laeufe[0].ziele).toHaveLength(4);
    expect(a.laeufe[0].serien).toHaveLength(2);
    // Alles zurück
    const z = await route.POST(anfrage(sitzung('malin'), 'POST', { aktion: 'zurueck', laufId: 'na-lauf-0001', auswahl: { art: 'alles' } }));
    expect(z.status).toBe(200);
    expect(ohneV(await db.loadJson('tasks'))).toEqual(vorher.tasks);
    expect(ohneV(await db.loadJson('ziele'))).toEqual(vorher.ziele);
    expect(ohneV(await db.loadJson('ziele-eigen--malin'))).toEqual(vorher.eigen);
    expect(ohneV(await db.loadJson('meilensteine'))).toEqual(vorher.ms);
    // Noch einmal zurück: nichts passiert.
    const z2 = await (await route.POST(anfrage(sitzung('malin'), 'POST', { aktion: 'zurueck', laufId: 'na-lauf-0001', auswahl: { art: 'alles' } }))).json() as { bericht: Record<string, number> };
    expect(z2.bericht).toMatchObject({ aufgaben: 0, ziele: 0, meilensteine: 0 });
  });

  it('einzeln zurück: ein Ziel, ein Meilenstein, ein Projekt', async () => {
    await route.POST(anfrage(sitzung('kevin'), 'POST', { aktion: 'neu-anfangen', laufId: 'na-lauf-0002', bestaetigung: 'NEU ANFANGEN' }));
    const post = (auswahl: unknown) => route.POST(anfrage(sitzung('kevin'), 'POST', { aktion: 'zurueck', laufId: 'na-lauf-0002', auswahl }));
    expect((await post({ art: 'ziel', speicher: 'ziele', horizont: 'monat', id: 'zm' })).status).toBe(200);
    expect(ohneV(await db.loadJson<Record<string, unknown>>('ziele'))).toMatchObject({ monat: [{ id: 'zm' }], jahr: [], fokus: {} });
    expect((await post({ art: 'meilenstein', id: 'm1' })).status).toBe(200);
    expect((await db.loadJson<{ meilensteine: { id: string }[] }>('meilensteine'))!.meilensteine.map(m => m.id)).toEqual(['m1']);
    expect((await post({ art: 'projekt', id: 'p2' })).status).toBe(200);
    const { ladeAufgaben } = await import('@/lib/aufgaben/sicht');
    expect(aufgabenSicht(await ladeAufgaben()).tasks.map(t => t.id).sort()).toEqual(['a2', 'l1', 'steuer-kdc-ust-2026-10']); // vorher ohne l1 (Umbau v3)
    expect((await post({ art: 'quatsch', id: 'x' })).status).toBe(400);
    expect((await route.POST(anfrage(sitzung('kevin'), 'POST', { aktion: 'zurueck', laufId: 'na-gibtsnicht', auswahl: { art: 'alles' } }))).status).toBe(404);
  });
});
