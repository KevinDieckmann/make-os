// ─── Aufgaben-Vertiefung (28.09. spät): Gruppen, Notizen, eigene Felder, Abhängigkeiten, Wiederholung, ZOE, Vorlagen, Verlauf ──
// Reine Regeln + Route mit eigenem Datenordner und erfundenen Konten/Aufgaben.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Task, TasksState } from '@/types/tasks';
import { taskSauber, projektSauber, listeSauber, gruppeSauber, vorlageSauber, feldWerteTypisieren, wiederholungSauber, zoeSauber, ZuGross, AUFGABEN_GRENZEN } from '@/lib/aufgaben/saeubern';
import { uebernehmen } from '@/lib/aufgaben/struktur';
import { abhaengigAngleichen, kreisBei, wuerdeKreisen, wartetAuf } from '@/lib/aufgaben/abhaengig';
import { verlaufFuer, verlaufAnhaengen, verlaufText, VERLAUF_MAX } from '@/lib/aufgaben/verlauf';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-aufgaben-vertiefung-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-aufgaben-vertiefung';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

const T0 = '2026-09-01T08:00:00.000Z';
const aufgabe = (id: string, extra: Record<string, unknown> = {}) => ({ id, projectId: 'p-launch', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...extra }) as unknown as Task;

describe('Säuberung der neuen Felder', () => {
  it('Aufgabe: Notiz, Felder, wartet auf, Wiederholung, Vorlage, ZOE — Verlauf vom Browser fällt weg', () => {
    const t = taskSauber({ ...aufgabe('a'), notiz: '# Plan\n- [ ] eins', felder: { budget: 12345, kanal: 'Messe', 'bö se': 'x' }, abhaengigVon: ['b', 'b', 'a', '<x>'], wiederholung: { regel: 'monatlich', monatstag: 1, intervall: 0 }, vorlageId: 'v-1', zoe: { status: 'wartet_freigabe', stapelId: 's-1' }, verlauf: [{ am: T0, von: 'kevin', was: 'angelegt' }] })!;
    expect(t.notiz).toBe('# Plan\n- [ ] eins');
    expect(t.felder).toEqual({ budget: 12345, kanal: 'Messe' });
    expect(t.abhaengigVon).toEqual(['b']);
    expect(t.wiederholung).toEqual({ regel: 'monatlich', monatstag: 1 });
    expect(t.zoe).toEqual({ status: 'wartet_freigabe', stapelId: 's-1' });
    expect(t.vorlageId).toBe('v-1');
    expect(t.verlauf).toBeUndefined();
  });
  it('413 statt kürzen: zu lange Notiz, zu viele Felder/Abhängigkeiten/Mitglieder', () => {
    expect(() => taskSauber({ ...aufgabe('a'), notiz: 'x'.repeat(AUFGABEN_GRENZEN.notiz + 1) })).toThrow(ZuGross);
    expect(() => taskSauber({ ...aufgabe('a'), abhaengigVon: Array.from({ length: 201 }, (_, i) => `t${i}`) })).toThrow(ZuGross);
    expect(() => taskSauber({ ...aufgabe('a'), felder: Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`f${i}`, 1])) })).toThrow(ZuGross);
    expect(() => projektSauber({ id: 'p', title: 'P', spaceId: 'kdv', mitglieder: Array.from({ length: 21 }, (_, i) => `p${i}`) })).toThrow(ZuGross);
    expect(() => projektSauber({ id: 'p', title: 'P', spaceId: 'kdv', notiz: 'x'.repeat(AUFGABEN_GRENZEN.notiz + 1) })).toThrow(ZuGross);
  });
  it('Projekt: Status, Zeitraum, Mitglieder, Felder; Ende vor Start fällt weg', () => {
    const p = projektSauber({ id: 'p', title: 'Launch', spaceId: 'kdv', status: 'pausiert', start: '2026-10-01', ende: '2026-09-01', mitglieder: ['kevin', 'kevin', 'Malin!'], beschreibung: 'Kurz', felder: [{ id: 'f1', name: 'Budget', typ: 'betrag' }, { id: 'f2', name: 'Kanal', typ: 'auswahl', optionen: ['Messe', 'Web', 'Messe'] }, { id: 'f1', name: 'doppelt', typ: 'text' }, { id: 'f3', name: 'X', typ: 'quatsch' }] })!;
    expect(p).toMatchObject({ status: 'pausiert', start: '2026-10-01', mitglieder: ['kevin'], beschreibung: 'Kurz' });
    expect(p.ende).toBeUndefined();
    expect(p.felder).toEqual([{ id: 'f1', name: 'Budget', typ: 'betrag' }, { id: 'f2', name: 'Kanal', typ: 'auswahl', optionen: ['Messe', 'Web'] }, { id: 'f3', name: 'X', typ: 'text' }]);
  });
  it('Feldwerte typgerecht: Zahl, Betrag in Cent, Datum, Auswahl, Link, Person; unbekannte bleiben', () => {
    const defs = [
      { id: 'z', name: 'Zahl', typ: 'zahl' as const }, { id: 'b', name: 'Betrag', typ: 'betrag' as const }, { id: 'd', name: 'Datum', typ: 'datum' as const },
      { id: 'a', name: 'Auswahl', typ: 'auswahl' as const, optionen: ['Ja'] }, { id: 'l', name: 'Link', typ: 'link' as const }, { id: 'p', name: 'Person', typ: 'person' as const },
    ];
    expect(feldWerteTypisieren({ b: '1.500,40' }, defs)).toEqual({ b: 150040 });
    expect(feldWerteTypisieren({ z: '3,5', b: 1999.6, d: '2026-10-01', a: 'Ja', l: 'https://beispiel.invalid/x', p: 'malin', frei: 'bleibt' }, defs)).toEqual({ z: 3.5, b: 2000, d: '2026-10-01', a: 'Ja', l: 'https://beispiel.invalid/x', p: 'malin', frei: 'bleibt' });
    expect(feldWerteTypisieren({ z: 'abc', d: '1.10.', a: 'Nein', l: 'javascript:alert(1)', p: 'Mal In' }, defs)).toBeUndefined();
  });
  it('Liste mit Gruppe/Wiederholung, Gruppe, Wiederholung, ZOE, Vorlage', () => {
    expect(listeSauber({ id: 'l', projektId: 'p', titel: 'Januar', sortOrder: 0, gruppeId: 'g-1', wiederholung: { regel: 'monatlich' } })).toMatchObject({ gruppeId: 'g-1', wiederholung: { regel: 'monatlich' } });
    expect(gruppeSauber({ id: 'g', projektId: 'p', titel: 'Marketing', farbe: 'rot', sortOrder: 2 })).toEqual({ id: 'g', projektId: 'p', titel: 'Marketing', farbe: '#6E7A7D', sortOrder: 2 });
    expect(wiederholungSauber({ regel: 'woechentlich', wochentage: [5, 1, 1, 9], bis: '2026-12-31' })).toEqual({ regel: 'woechentlich', wochentage: [1, 5], bis: '2026-12-31' });
    expect(wiederholungSauber({ regel: 'stuendlich' })).toBeUndefined();
    expect(zoeSauber({ status: 'fertig' })).toBeUndefined();
    expect(zoeSauber({ status: 'offen', von: 'malin', hinweis: '  kurz  ' })).toEqual({ status: 'offen', von: 'malin', hinweis: 'kurz' });
    expect(zoeSauber({ status: 'offen', von: 'Mal In' })).toEqual({ status: 'offen' });
    expect(() => zoeSauber({ status: 'offen', hinweis: 'x'.repeat(AUFGABEN_GRENZEN.zoeHinweis + 1) })).toThrow(ZuGross);
    const v = vorlageSauber({ id: 'v', art: 'projekt', titel: 'Launch', inhalt: { gruppen: [{ titel: 'Marketing' }], listen: [{ titel: 'Woche 1', gruppe: 'Marketing', aufgaben: [{ titel: 'Pressetext', versatzTage: 3, unter: [{ titel: 'Entwurf', unter: [{ titel: 'zu tief' }] }] }] }] } })!;
    expect(v.inhalt.listen![0].aufgaben[0]).toEqual({ titel: 'Pressetext', versatzTage: 3, unter: [{ titel: 'Entwurf' }] });
    expect(() => vorlageSauber({ id: 'v', art: 'liste', titel: 'Groß', inhalt: { notiz: 'x'.repeat(AUFGABEN_GRENZEN.vorlageZeichen + 1) } })).toThrow(ZuGross);
  });
});

describe('Übernahme (idempotent, nie Verlust)', () => {
  const alt = (): TasksState => ({
    projects: [{ id: 'p-launch', title: 'Launch', category: 'business', owner: 'both', color: '#DE9E63', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv' }],
    tasks: [aufgabe('a', { dependencies: [{ blockedByTaskId: 'b', resolvedAt: T0 }, { blockedByTaskId: 'geist' }] }), aufgabe('b')],
    listen: [{ id: 'l1', projektId: 'p-launch', titel: 'Woche 1', sortOrder: 0, gruppeId: 'g-weg' }],
  } as unknown as TasksState);
  it('Altbestand ohne gruppen/vorlagen: Listen bekommen [], tote Gruppe fällt von der Liste, dependencies → abhaengigVon', () => {
    const r = uebernehmen(alt());
    expect(r.state.gruppen).toEqual([]);
    expect(r.state.vorlagen).toEqual([]);
    expect(r.state.listen![0].gruppeId).toBeUndefined();
    const a = r.state.tasks.find(t => t.id === 'a')!;
    expect(a.abhaengigVon).toEqual(['b']);
    expect(a.dependencies).toEqual([{ blockedByTaskId: 'b', resolvedAt: T0 }]);
    expect(r.state.tasks.map(t => t.id).sort()).toEqual(['a', 'b']);
    const zwei = uebernehmen(r.state);
    expect(zwei.geaendert).toBe(false);
    expect(zwei.state).toEqual(r.state);
  });
  it('Gruppe des eigenen Projekts bleibt an der Liste', () => {
    const s = { ...alt(), gruppen: [{ id: 'g-weg', projektId: 'p-launch', titel: 'Marketing', farbe: '#FF0000', sortOrder: 0 }], vorlagen: [] };
    expect(uebernehmen(s).state.listen![0].gruppeId).toBe('g-weg');
  });
});

describe('Serien-Felder (C3): serieId, titelMuster, Notiz/Felder in Vorlagen', () => {
  it('Altbestand vorlageId „serie:…“ → serieId (idempotent), Herkunftsvorlage frei', () => {
    const s = { projects: [], tasks: [aufgabe('w1', { vorlageId: 'serie:a1', wiederholung: { regel: 'taeglich' } })] } as unknown as TasksState;
    const r = uebernehmen(s);
    expect(r.state.tasks[0].serieId).toBe('a1');
    expect(r.state.tasks[0].vorlageId).toBeUndefined();
    expect(uebernehmen(r.state).geaendert).toBe(false);
    expect(taskSauber({ ...aufgabe('x'), serieId: 'a1' })!.serieId).toBe('a1');
  });
  it('titelMuster an der Liste, Notiz/Felder in Vorlage-Aufgaben', () => {
    expect(listeSauber({ id: 'l', projektId: 'p', titel: 'X', sortOrder: 0, titelMuster: 'Monatsabschluss {Monat} {Jahr}' })!.titelMuster).toBe('Monatsabschluss {Monat} {Jahr}');
    const v = vorlageSauber({ id: 'v', art: 'liste', titel: 'L', inhalt: { aufgaben: [{ titel: 'A', notiz: '- [ ] x', felder: { budget: 100, kanal: 'Web' } }] } })!;
    expect(v.inhalt.aufgaben![0]).toEqual({ titel: 'A', notiz: '- [ ] x', felder: { budget: 100, kanal: 'Web' } });
    expect(() => vorlageSauber({ id: 'v', art: 'liste', titel: 'L', inhalt: { aufgaben: [{ titel: 'A', notiz: 'x'.repeat(AUFGABEN_GRENZEN.notiz + 1) }] } })).toThrow(ZuGross);
  });
});

describe('Abhängigkeiten', () => {
  it('angleichen: abhaengigVon gewinnt, geänderte dependencies (alte Ansicht) auch', () => {
    const vorher = aufgabe('a', { abhaengigVon: ['b'], dependencies: [{ blockedByTaskId: 'b' }] });
    expect(abhaengigAngleichen({ ...vorher, abhaengigVon: ['b', 'c'] }, vorher).dependencies).toEqual([{ blockedByTaskId: 'b' }, { blockedByTaskId: 'c' }]);
    const alteAnsicht = abhaengigAngleichen({ ...vorher, dependencies: [] }, vorher);
    expect(alteAnsicht.abhaengigVon).toBeUndefined();
    expect(alteAnsicht.dependencies).toEqual([]);
  });
  it('Kreis erkennen, wartet auf', () => {
    const l = [aufgabe('a', { abhaengigVon: ['b'] }), aufgabe('b', { abhaengigVon: ['c'] }), aufgabe('c')];
    expect(kreisBei(l, ['a'])).toBeNull();
    expect(wuerdeKreisen('c', 'a', l)).toBe(true);
    expect(wuerdeKreisen('a', 'c', l)).toBe(false);
    expect(kreisBei([...l.slice(0, 2), aufgabe('c', { abhaengigVon: ['a'] })], ['c'])).toEqual(['c', 'a', 'b', 'c']);
    expect(wartetAuf(l[0], l).map(t => t.id)).toEqual(['b']);
  });
});

describe('Verlauf', () => {
  it('Einträge mit Kurzwerten, nie Texte', () => {
    const a = aufgabe('a', { title: 'Geheim 4711', description: 'Betrag 99' });
    const n = { ...a, status: 'done', assignee: 'malin', dueDate: '2026-10-01', title: 'Geheim 4712', description: 'Betrag 98', felder: { f1: 5 }, kommentare: [{ id: 'k', von: 'kevin', text: 'Kommentartext', am: T0 }] } as Task;
    const v = verlaufFuer(a, n, { person: 'kevin' }, T0);
    expect(v.map(e => e.was)).toEqual(['status', 'zustaendig', 'deadline', 'titel', 'beschreibung', 'kommentar', 'feld']);
    expect(v[0]).toMatchObject({ vorher: 'Offen', nachher: 'Erledigt', von: 'kevin' });
    expect(JSON.stringify(v)).not.toMatch(/Geheim|4711|Betrag|Kommentartext/);
    expect(verlaufFuer(undefined, a, { person: 'malin', durch: 'zoe' }, T0)).toEqual([{ am: T0, von: 'malin', durch: 'zoe', was: 'angelegt' }]);
  });
  it(`Grenze ${VERLAUF_MAX}: älteste werden zusammengefasst, nie still`, () => {
    const e = (i: number) => ({ am: `2026-09-01T00:00:${String(i % 60).padStart(2, '0')}Z`, von: 'kevin', was: 'titel' as const });
    let l = verlaufAnhaengen(undefined, Array.from({ length: VERLAUF_MAX }, (_, i) => e(i)))!;
    expect(l).toHaveLength(VERLAUF_MAX);
    l = verlaufAnhaengen(l, [e(1), e(2)])!;
    expect(l).toHaveLength(VERLAUF_MAX);
    expect(l[0]).toMatchObject({ was: 'zusammengefasst', anzahl: 3 });
    l = verlaufAnhaengen(l, [e(3)])!;
    expect(l[0]).toMatchObject({ was: 'zusammengefasst', anzahl: 4 });
    expect(verlaufText(l[0])).toBe('+4 ältere Änderungen');
  });
});

// ── Route ──
type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; PATCH: Handler; PUT: Handler };
let anlegen: { POST: Handler };
let db: typeof import('@/lib/store/local-db');
const konto = (id: string, speicher: string, name: string, rolle: 'inhaber' | 'mitglied', haushalt?: string) => ({ id, speicher, email: `${speicher}@test.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const anfrage = (kopf: Record<string, string>, method = 'GET', body?: unknown, pfad = '/api/state/tasks') => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
type Zeile = Record<string, unknown> & { id: string; stand: string };
const lesen = async () => (await (await route.GET(anfrage(sitzung('kevin')))).json()) as { state: Record<'tasks' | 'projects' | 'listen' | 'gruppen' | 'vorlagen', Zeile[]> };
const gespeichert = async () => (await db.loadJson<TasksState>('tasks'))!;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'Kevin Beispiel', 'inhaber', 'haus'), konto('k2', 'malin', 'Malin Beispiel', 'mitglied', 'haus')], einladungen: [] });
  await db.saveJson('crm', { firmen: [], mandate: [] });
  route = (await import('@/app/api/state/tasks/route')) as unknown as typeof route;
  anlegen = (await import('@/app/api/tasks/create/route')) as unknown as typeof anlegen;
});
beforeEach(async () => {
  // Altbestand (vor der Vertiefung): ohne gruppen/vorlagen, mit alter Abhängigkeit, ohne Space.
  await db.saveJson('tasks', {
    projects: [{ id: 'p-launch', title: 'Launch', category: 'business', owner: 'both', color: '#DE9E63', tags: [], archived: false, createdAt: T0, updatedAt: T0 }],
    tasks: [aufgabe('a1', { spaceId: undefined, dependencies: [{ blockedByTaskId: 'a2' }] }), aufgabe('a2', { spaceId: undefined })],
  });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Route: Gruppen, Felder, Verlauf, Kreise', () => {
  it('Gruppen + Liste in Gruppe + Projektfelder in einem Aufruf; Feldwert typgerecht; Verlauf entsteht', async () => {
    const d = await lesen();
    const p = d.state.projects.find(x => x.id === 'p-launch')!;
    const a1 = d.state.tasks.find(x => x.id === 'a1')!;
    expect(a1.abhaengigVon).toEqual(['a2']);
    const r = await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', {
      struktur: {
        projekte: [{ op: 'upsert', eintrag: { ...p, felder: [{ id: 'f-budget', name: 'Budget', typ: 'betrag' }], status: 'aktiv', notiz: '## Ziel\n- [x] Termin' }, stand: p.stand }],
        gruppen: [{ op: 'upsert', eintrag: { id: 'g-mkt', projektId: 'p-launch', titel: 'Marketing', farbe: '#E36A6A', sortOrder: 0 } }],
        listen: [{ op: 'upsert', eintrag: { id: 'l-w1', projektId: 'p-launch', titel: 'Woche 1', sortOrder: 0, gruppeId: 'g-mkt' } }],
      },
      ops: [{ op: 'upsert', task: { ...a1, listeId: 'l-w1', status: 'in-progress', felder: { 'f-budget': 150040 } }, stand: a1.stand }],
    }));
    expect(r.status).toBe(200);
    const antwort = await r.json() as { zeilen: { liste: string; id: string; verlauf?: { was: string }[] }[] };
    expect(antwort.zeilen.find(z => z.id === 'a1')!.verlauf!.map(v => v.was)).toEqual(['status', 'verschoben', 'feld']);
    const g = await gespeichert();
    expect(g.gruppen).toHaveLength(1);
    expect(g.listen![0].gruppeId).toBe('g-mkt');
    const t = g.tasks.find(x => x.id === 'a1')!;
    expect(t.felder).toEqual({ 'f-budget': 150040 });
    expect(t.verlauf![0]).toMatchObject({ von: 'kevin', was: 'status', vorher: 'Offen', nachher: 'In Arbeit' });
    // Der Browser kann den Verlauf nicht fälschen.
    const d2 = await lesen();
    const b = d2.state.tasks.find(x => x.id === 'a1')!;
    await route.PATCH(anfrage(sitzung('malin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...b, verlauf: [], priority: 'high' }, stand: b.stand }] }));
    const v = (await gespeichert()).tasks.find(x => x.id === 'a1')!.verlauf!;
    expect(v.map(e => e.was)).toEqual(['status', 'verschoben', 'feld', 'prioritaet']);
    expect(v[3]).toMatchObject({ von: 'malin', vorher: 'Normal', nachher: 'Hoch' });
  });
  it('Kreis in „wartet auf“ → 409 mit kreis, nichts gespeichert', async () => {
    const d = await lesen();
    const a2 = d.state.tasks.find(x => x.id === 'a2')!;
    const r = await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...a2, abhaengigVon: ['a1'] }, stand: a2.stand }] }));
    expect(r.status).toBe(409);
    const j = await r.json() as { kreis: string[]; error: string };
    expect(j.kreis).toEqual(['a2', 'a1', 'a2']);
    expect(j.error).toMatch(/auf sich selbst warten/);
    expect((await gespeichert()).tasks.find(x => x.id === 'a2')!.abhaengigVon).toBeUndefined();
  });
  it('alte Ansicht schreibt nur dependencies → abhaengigVon folgt', async () => {
    const d = await lesen();
    const a1 = d.state.tasks.find(x => x.id === 'a1')!;
    await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...a1, dependencies: [] }, stand: a1.stand }] }));
    const t = (await gespeichert()).tasks.find(x => x.id === 'a1')!;
    expect(t.abhaengigVon).toBeUndefined();
    expect(t.dependencies).toEqual([]);
  });
  it('413: zu lange Notiz an einer Aufgabe, zu viele Gruppen-Änderungen', async () => {
    const d = await lesen();
    const a1 = d.state.tasks.find(x => x.id === 'a1')!;
    expect((await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...a1, notiz: 'x'.repeat(AUFGABEN_GRENZEN.notiz + 1) }, stand: a1.stand }] }))).status).toBe(413);
    const viele = Array.from({ length: 201 }, (_, i) => ({ op: 'upsert', eintrag: { id: `g${i}`, projektId: 'p-launch', titel: 'G', farbe: '#000000', sortOrder: i } }));
    expect((await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { struktur: { gruppen: viele } }))).status).toBe(413);
  });
  it('PUT über einen vorhandenen Bestand: 409 „neu laden“, Verlauf, Gruppen und Vorlagen bleiben (29.09., A2)', async () => {
    const d = await lesen();
    const a1 = d.state.tasks.find(x => x.id === 'a1')!;
    await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { struktur: { gruppen: [{ op: 'upsert', eintrag: { id: 'g-ops', projektId: 'p-launch', titel: 'Operations', farbe: '#3DE28B', sortOrder: 0 } }], vorlagen: [{ op: 'upsert', eintrag: { id: 'v-1', art: 'liste', titel: 'Monatsabschluss', inhalt: { aufgaben: [{ titel: 'Belege' }] } } }] }, ops: [{ op: 'upsert', task: { ...a1, status: 'done' }, stand: a1.stand }] }));
    const g = await gespeichert();
    // Ein altes Fenster schickt den ganzen Stand (ohne Verlauf, ohne Gruppen) — früher ersetzte das alles.
    const r = await route.PUT(anfrage(sitzung('kevin'), 'PUT', { projects: g.projects, tasks: g.tasks.map(t => ({ ...t, verlauf: undefined, title: 'alt' })) }));
    expect(r.status).toBe(409);
    expect(((await r.json()) as { neuLaden?: boolean }).neuLaden).toBe(true);
    const n = await gespeichert();
    expect(n).toEqual(g);
    expect(n.tasks.find(t => t.id === 'a1')!.verlauf!.length).toBeGreaterThan(0);
    expect(n.gruppen!.map(x => x.id)).toEqual(['g-ops']);
    expect(n.vorlagen!.map(x => x.id)).toEqual(['v-1']);
  });
  it('zoe.status per PATCH wird ignoriert (nur /api/aufgaben/zoe, T1 #78); zoe.von setzt der Server (die schreibende Person)', async () => {
    const d = await lesen();
    const a1 = d.state.tasks.find(x => x.id === 'a1')!;
    await route.PATCH(anfrage(sitzung('malin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...a1, zoe: { status: 'offen', von: 'kevin' } }, stand: a1.stand }] }));
    expect((await gespeichert()).tasks.find(x => x.id === 'a1')!.zoe).toBeUndefined();
    // Liegt die Aufgabe schon bei ZOE (Status unverändert), gilt der Rest — die Auftraggeberin ist, wer sie ändert.
    const roh = await gespeichert();
    await db.saveJson('tasks', { ...roh, tasks: roh.tasks.map(t => (t.id === 'a1' ? { ...t, zoe: { status: 'offen', von: 'kevin' } } : t)) });
    const a1b = (await lesen()).state.tasks.find(x => x.id === 'a1')!;
    await route.PATCH(anfrage(sitzung('malin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...a1b, zoe: { status: 'offen', von: 'malin', hinweis: 'bitte kurz' } }, stand: a1b.stand }] }));
    expect((await gespeichert()).tasks.find(x => x.id === 'a1')!.zoe).toEqual({ status: 'offen', von: 'malin', hinweis: 'bitte kurz' });
  });
  it('/api/tasks/create: Verlauf „angelegt“ (ZOE im Auftrag)', async () => {
    const r = await (await anlegen.POST(anfrage(dienst('malin'), 'POST', { title: 'Von ZOE vorbereitet' }, '/api/tasks/create'))).json() as { id: string };
    const t = (await gespeichert()).tasks.find(x => x.id === r.id)!;
    expect(t.verlauf).toEqual([expect.objectContaining({ von: 'malin', durch: 'zoe', was: 'angelegt' })]);
  });
});
