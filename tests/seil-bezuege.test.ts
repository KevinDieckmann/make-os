// ─── Seil (07.10.): Bezüge als Daten — Kreise, Bereiche, „nur ich“, Löschen, Rückgängig ────────────────────────────────
// Kevin: „Die Karten und Ziele brauchen Abhängigkeiten.“ — „Verbindungen fehlen.“ Konzept: LICHTFAEDEN.md › Seil.
// Rein (lib/planung/bezuege.ts, lib/aufgaben/ziel-bezug.ts) und durch die echten Schreibwege (Ziele, Meilensteine, Aufgaben,
// POST /api/planung/bezuege) mit eigenem Datenordner und erfundenen Einträgen. Rückweg: der wörtlich alte Ziel-Säuberer (af4679a)
// liest ein Ziel mit `oberzielId` ohne Fehler (das Feld fällt weg).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';
import type { Task, TasksState } from '@/types/tasks';
import type { Meilenstein, Ziel, ZieleDatei } from '@/lib/planung/typen';
import {
  BEREICH_GETRENNT, NUR_ICH_BEZUG, ZIEL_FEHLT, ZIEL_KETTE_MAX, aufgabenBereich, aufgabenBezugPruefen, bereichPasst, bezuegeZurueck, meilensteinBezugPruefen,
  oberzielKandidaten, oberzielKreis, oberzielLoesen, oberzielPruefen, planBereich, projektBezugPruefen, seilWurzeln, unterziele, vorgaengerPasst, zielBezuegeLoesen,
  zielKandidaten, zielEltern, type AufgabeBezugRoh,
} from '@/lib/planung/bezuege';
import { bezugVonAufgabe, msListeKarte, zielVonAufgabe } from '@/lib/aufgaben/ziel-bezug';
import { meilensteinListeId } from '@/lib/planung/meilenstein-aufgaben';
import { sauberZiel } from '@/lib/planung/ziele';
import { taskSauber, projektSauber } from '@/lib/aufgaben/saeubern';
import * as altZ from './fixtures/alt-af4679a/ziele';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-seil-bezuege-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-seil-bezuege';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

const z = (id: string, extra: Partial<Ziel> = {}): Ziel => ({ id, titel: `Ziel ${id}`, fortschritt: 0, space: 'business', ...extra });

describe('rein · Bereich', () => {
  it('Ziel ohne Space ist gemeinsam und passt zu beiden; Privat und Business passen nicht zusammen', () => {
    expect(planBereich({})).toBeNull();
    expect(planBereich({ space: 'privat' })).toBe('privat');
    expect(bereichPasst(null, 'privat')).toBe(true);
    expect(bereichPasst('business', null)).toBe(true);
    expect(bereichPasst('privat', 'business')).toBe(false);
    expect(aufgabenBereich({ spaceId: 'privat' })).toBe('privat');
    expect(aufgabenBereich({ spaceId: 'kdv' })).toBe('business');
    expect(aufgabenBereich({ spaceId: 'm-f1' })).toBe('business');
    expect(aufgabenBereich({})).toBe('business');
  });
});

describe('rein · Ziel-Kette (Oberziel + Kaskade)', () => {
  const liste = [z('nord'), z('jahr', { oberzielId: 'nord' }), z('jahr~quartal', { abgeleitetVon: 'jahr' }), z('lose')];
  it('Wurzel folgt erst `oberzielId`, dann der Kaskade; ohne Eltern ist ein Ziel selbst Wurzel', () => {
    const w = seilWurzeln(liste);
    expect(w.get('jahr~quartal')).toBe('nord');
    expect(w.get('jahr')).toBe('nord');
    expect(w.get('lose')).toBe('lose');
    expect(zielEltern(liste[1], new Map(liste.map(x => [x.id, x])))).toBe('nord');
    expect(unterziele('nord', liste).map(x => x.id)).toEqual(['jahr']);
  });
  it('ein Kreis im Altbestand bricht nichts (kreisfest)', () => {
    const w = seilWurzeln([z('a', { oberzielId: 'b' }), z('b', { oberzielId: 'a' })]);
    expect(['a', 'b']).toContain(w.get('a'));
  });
  it('Kreis, Bereich, unbekanntes oder archiviertes Ziel werden abgelehnt — nur neu gesetzte zählen', () => {
    const vorher = new Map<string, string | undefined>([['nord', undefined], ['jahr', 'nord']]);
    expect(oberzielPruefen([z('nord', { oberzielId: 'jahr' }), z('jahr', { oberzielId: 'nord' })], ['nord'], vorher)).toMatch(/auf sich selbst/);
    expect(oberzielPruefen([z('a', { space: 'privat', oberzielId: 'b' }), z('b', { space: 'business' })], ['a'], new Map())).toBe(BEREICH_GETRENNT);
    expect(oberzielPruefen([z('a', { space: 'privat', oberzielId: 'g' }), z('g', { space: undefined })], ['a'], new Map())).toBeNull(); // gemeinsam passt
    expect(oberzielPruefen([z('a', { oberzielId: 'weg' })], ['a'], new Map())).toBe(ZIEL_FEHLT);
    expect(oberzielPruefen([z('a', { oberzielId: 'b' }), z('b', { archiviertAm: '2026-10-01T00:00:00.000Z' })], ['a'], new Map())).toBe(ZIEL_FEHLT);
    // alter (toter) Verweis blockiert keine andere Änderung
    expect(oberzielPruefen([z('a', { oberzielId: 'weg', titel: 'neu' })], ['a'], new Map([['a', 'weg']]))).toBeNull();
  });
  it('die Kette ist höchstens ZIEL_KETTE_MAX tief (tiefer = wie ein Kreis abgelehnt)', () => {
    const kette = Array.from({ length: ZIEL_KETTE_MAX + 2 }, (_, i) => z(`k${i}`, i ? { oberzielId: `k${i - 1}` } : {}));
    expect(oberzielKreis('neu', `k${ZIEL_KETTE_MAX + 1}`, [...kette, z('neu')])).toBe(true);
    expect(oberzielKreis('neu', 'k1', [...kette, z('neu')])).toBe(false);
  });
  it('Kandidaten: gleicher Bereich, offen, nicht archiviert, ohne Kreis', () => {
    const l = [z('ich'), z('kind', { oberzielId: 'ich' }), z('p', { space: 'privat' }), z('fertig', { erledigt: true }), z('gut')];
    expect(oberzielKandidaten(l[0], l).map(x => x.id)).toEqual(['gut']);
  });
});

const t = (id: string, extra: Partial<AufgabeBezugRoh> = {}): AufgabeBezugRoh => ({ id, title: `Aufgabe ${id}`, spaceId: 'kdv', ...extra });
describe('rein · Aufgaben und Projekte', () => {
  const besitzer = (x: AufgabeBezugRoh) => (x.sichtbarkeit === 'nur-ich' ? x.angelegtVon ?? null : undefined);
  const ziele = new Map([['zb', { space: 'business' as const }], ['zp', { space: 'privat' as const }], ['zg', {}]]);
  it('neu „wartet auf“ über den Bereich hinweg → abgelehnt; im Bereich → ok', () => {
    const n = new Map([['a', t('a', { abhaengigVon: ['b'] })], ['b', t('b', { spaceId: 'privat' })], ['c', t('c', { abhaengigVon: ['d'] })], ['d', t('d', { spaceId: 'ug' })]]);
    expect(aufgabenBezugPruefen(n, ['a'], new Map(), { besitzer, ziele })).toBe(BEREICH_GETRENNT);
    expect(aufgabenBezugPruefen(n, ['c'], new Map(), { besitzer, ziele })).toBeNull();
    // alter Verweis blockiert nicht
    expect(aufgabenBezugPruefen(n, ['a'], new Map([['a', { abhaengigVon: ['b'] }]]), { besitzer, ziele })).toBeNull();
  });
  it('geteilte Aufgabe wartet nie auf „nur ich“ — „nur ich“ auf die eigene „nur ich“ geht', () => {
    const n = new Map([
      ['a', t('a', { abhaengigVon: ['g'] })], ['g', t('g', { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin' })],
      ['m', t('m', { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin', abhaengigVon: ['g'] })],
    ]);
    expect(aufgabenBezugPruefen(n, ['a'], new Map(), { besitzer, ziele })).toBe(NUR_ICH_BEZUG);
    expect(aufgabenBezugPruefen(n, ['m'], new Map(), { besitzer, ziele })).toBeNull();
  });
  it('„zahlt ein auf“: Ziel muss da sein und zum Bereich passen (gemeinsam passt immer)', () => {
    const n = new Map([['a', t('a', { zielId: 'zp' })], ['b', t('b', { zielId: 'zb' })], ['c', t('c', { spaceId: 'privat', zielId: 'zg' })], ['d', t('d', { zielId: 'nix' })]]);
    expect(aufgabenBezugPruefen(n, ['a'], new Map(), { besitzer, ziele })).toBe(BEREICH_GETRENNT);
    expect(aufgabenBezugPruefen(n, ['b'], new Map(), { besitzer, ziele })).toBeNull();
    expect(aufgabenBezugPruefen(n, ['c'], new Map(), { besitzer, ziele })).toBeNull();
    expect(aufgabenBezugPruefen(n, ['d'], new Map(), { besitzer, ziele })).toBe(ZIEL_FEHLT);
    expect(aufgabenBezugPruefen(n, ['d'], new Map(), { besitzer, ziele: null })).toBe(ZIEL_FEHLT);
    expect(projektBezugPruefen([{ id: 'p', spaceId: 'privat', zielId: 'zb' }], ['p'], new Map(), ziele)).toBe(BEREICH_GETRENNT);
    expect(projektBezugPruefen([{ id: 'p', spaceId: 'privat', zielId: 'zp' }], ['p'], new Map(), ziele)).toBeNull();
  });
  it('Meilensteine: neues Ziel und neue Vorgänger nur im eigenen Bereich', () => {
    const l = [{ id: 'm1', space: 'privat' as const, zielId: 'zb' }, { id: 'm2', space: 'business' as const, wartetAuf: ['m3'] }, { id: 'm3', space: 'privat' as const }];
    expect(meilensteinBezugPruefen(l, ['m1'], new Map(), ziele)).toBe(BEREICH_GETRENNT);
    expect(meilensteinBezugPruefen(l, ['m2'], new Map(), ziele)).toBe(BEREICH_GETRENNT);
    expect(meilensteinBezugPruefen(l, ['m1'], new Map([['m1', { zielId: 'zb' }]]), ziele)).toBeNull();
  });
  it('Auswahl: Vorgänger und Ziele nur aus dem eigenen Bereich', () => {
    expect(vorgaengerPasst(t('a'), { ...t('b'), status: 'todo' })).toBe(true);
    expect(vorgaengerPasst(t('a'), { ...t('b', { spaceId: 'privat' }), status: 'todo' })).toBe(false);
    expect(vorgaengerPasst(t('a'), { ...t('b'), status: 'done' })).toBe(false);
    expect(vorgaengerPasst(t('a'), { ...t('b', { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin' }), status: 'todo' })).toBe(false);
    expect(zielKandidaten('privat', [z('a', { space: 'privat' }), z('b'), z('c', { space: undefined })]).map(x => x.id)).toEqual(['a', 'c']);
  });
});

describe('rein · wirksames Ziel einer Aufgabe (EINE Regel)', () => {
  const ms = [{ id: 'm1', titel: 'Vertrag', zielId: 'z1' }];
  const k = (extra: Partial<Parameters<typeof zielVonAufgabe>[1]> = {}) => ({ msListe: msListeKarte(ms), lebt: (id: string) => ['z1', 'z2', 'z3', 'z4'].includes(id), ...extra });
  it('Meilenstein-Liste vor eigenem Ziel vor Hauptaufgabe vor Projekt; tote Ziele zählen nicht', () => {
    const nachId = new Map([['h', { id: 'h', zielId: 'z3', projectId: 'p' }], ['u', { id: 'u', parentId: 'h', projectId: 'p' }]]);
    const projekte = new Map([['p', { zielId: 'z4' }]]);
    expect(zielVonAufgabe({ id: 'a', listeId: meilensteinListeId('m1'), zielId: 'z2' }, k())).toMatchObject({ zielId: 'z1', ueber: 'meilenstein', meilensteinId: 'm1' });
    expect(zielVonAufgabe({ id: 'a', zielId: 'z2', projectId: 'p' }, k({ projekte }))).toMatchObject({ zielId: 'z2', ueber: 'aufgabe' });
    expect(zielVonAufgabe({ id: 'u', parentId: 'h', projectId: 'p' }, k({ nachId, projekte }))).toMatchObject({ zielId: 'z3', ueber: 'eltern' });
    expect(zielVonAufgabe({ id: 'x', projectId: 'p' }, k({ projekte }))).toMatchObject({ zielId: 'z4', ueber: 'projekt' });
    expect(zielVonAufgabe({ id: 'x', zielId: 'tot', projectId: 'p' }, k({ projekte }))).toMatchObject({ zielId: 'z4' });
    expect(zielVonAufgabe({ id: 'x' }, k())).toBeNull();
  });
  it('der Chip kennt direkte Bezüge, die Liste geht vor', () => {
    const ziele = new Map([['z2', { id: 'z2', titel: 'Direkt', farbe: '#112233' }]]);
    expect(bezugVonAufgabe({ id: 'a', zielId: 'z2' }, new Map(), { ziele })).toMatchObject({ zielTitel: 'Direkt', ueber: 'aufgabe', farbe: '#112233' });
    expect(bezugVonAufgabe({ id: 'a', zielId: 'z2' }, new Map())).toBeNull(); // ohne Kontext nur die Liste (alter Aufruf)
  });
});

describe('rein · Löschen und Rückgängig', () => {
  it('Unterziele verlieren nur den Verweis; Aufgaben/Projekte mit direktem Bezug werden gefunden', () => {
    const r = oberzielLoesen([z('a', { oberzielId: 'weg' }), z('b', { oberzielId: 'bleibt' })], new Set(['weg']));
    expect(r.geloest).toEqual(['a']);
    expect(r.liste[0]).not.toHaveProperty('oberzielId');
    expect(r.liste[1].oberzielId).toBe('bleibt');
    expect(zielBezuegeLoesen({ tasks: [{ id: 't1', zielId: 'weg' }, { id: 't2' }], projects: [{ id: 'p1', zielId: 'weg' }] }, new Set(['weg']))).toEqual({ aufgaben: ['t1'], projekte: ['p1'] });
  });
  it('Rückgängig setzt nur, wo das Feld noch leer ist und das Ziel wieder lebt', () => {
    const g = { zielId: 'z', ziele: ['u1', 'u2'], meilensteine: ['m1'], aufgaben: ['t1', 't2'], projekte: ['p1'] };
    const stand = { zielLebt: true, ziele: [{ id: 'u1' }, { id: 'u2', oberzielId: 'anders' }], meilensteine: [{ id: 'm1' }], aufgaben: [{ id: 't1' }, { id: 't2', zielId: 'neu' }], projekte: [{ id: 'p1' }] };
    expect(bezuegeZurueck(g, stand)).toEqual({ ziele: ['u1'], meilensteine: ['m1'], aufgaben: ['t1'], projekte: ['p1'] });
    expect(bezuegeZurueck(g, { ...stand, zielLebt: false })).toEqual({ ziele: [], meilensteine: [], aufgaben: [], projekte: [] });
  });
});

describe('Säuberung und Rückweg', () => {
  it('neue Felder nur in gültiger Form; das Ziel zeigt nie auf sich selbst', () => {
    expect(sauberZiel({ id: 'a', titel: 'A', oberzielId: 'b~quartal' })!.oberzielId).toBe('b~quartal');
    expect(sauberZiel({ id: 'a', titel: 'A', oberzielId: 'a' })).not.toHaveProperty('oberzielId');
    expect(sauberZiel({ id: 'a', titel: 'A', oberzielId: '<script>' })).not.toHaveProperty('oberzielId');
    expect(taskSauber({ id: 't', title: 'T', zielId: 'z-1' })!.zielId).toBe('z-1');
    expect(taskSauber({ id: 't', title: 'T', zielId: 42 })).not.toHaveProperty('zielId');
    expect(projektSauber({ id: 'p', title: 'P', spaceId: 'kdv', zielId: 'z-1' })!.zielId).toBe('z-1');
  });
  it('der alte Ziel-Säuberer (af4679a) liest ein Ziel mit Oberziel ohne Fehler — das Feld fällt weg, sonst nichts', () => {
    const neu = sauberZiel({ id: 'a', titel: 'Umsatz', fortschritt: 40, space: 'business', oberzielId: 'nord', termin: '2027-03-01' })!;
    const alt = altZ.sauberZiel(neu)!;
    expect(alt).not.toHaveProperty('oberzielId');
    expect(alt).toMatchObject({ id: 'a', titel: 'Umsatz', fortschritt: 40, space: 'business', termin: '2027-03-01' });
  });
});

// ── Durch die echten Schreibwege ─────────────────────────────────────────────────────────────────────────────────────
type Handler = (r: Request) => Promise<Response>;
let db: typeof import('@/lib/store/local-db');
let zieleRoute: { GET: Handler; PATCH: Handler };
let msRoute: { GET: Handler; PATCH: Handler };
let tasksRoute: { GET: Handler; PATCH: Handler };
let bezugRoute: { POST: Handler };
const T0 = '2026-09-01T08:00:00.000Z';
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const anfrage = (pfad: string, method = 'GET', body?: unknown, kopf: Record<string, string> = sitzung('kevin')) => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const zieleLaden = async () => (await (await zieleRoute.GET(anfrage('/api/state/ziele'))).json()) as ZieleDatei & Record<string, unknown>;
const zielePatch = (horizont: string, ops: unknown[]) => zieleRoute.PATCH(anfrage('/api/state/ziele', 'PATCH', { horizont, ops }));
const aufgabe = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: 'pb', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...extra });
const tasksPatch = (body: unknown, person = 'kevin') => tasksRoute.PATCH(anfrage('/api/state/tasks', 'PATCH', body, sitzung(person)));
const gespeichert = async () => (await db.loadJson<TasksState>('tasks'))!;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' });
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
  await db.saveJson('crm', { firmen: [], mandate: [] });
  zieleRoute = (await import('@/app/api/state/ziele/route')) as unknown as typeof zieleRoute;
  msRoute = (await import('@/app/api/state/meilensteine/route')) as unknown as typeof msRoute;
  tasksRoute = (await import('@/app/api/state/tasks/route')) as unknown as typeof tasksRoute;
  bezugRoute = (await import('@/app/api/planung/bezuege/route')) as unknown as typeof bezugRoute;
});
beforeEach(async () => {
  await db.saveJson('ziele', {
    tag: [], woche: [], monat: [], quartal: [],
    jahr: [z('nord', { titel: 'Nordstern' }), z('umsatz', { titel: 'Umsatz' }), z('privat-ziel', { titel: 'Gesund', space: 'privat' }), z('gemeinsam', { titel: 'Haus', space: undefined })],
    fokus: {},
  });
  await db.saveJson('meilensteine', { meilensteine: [] });
  await db.saveJson('tasks', {
    projects: [
      { id: 'pb', title: 'Vertrieb', category: 'business', owner: 'kevin', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv' },
      { id: 'pp', title: 'Zuhause', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat' },
    ],
    tasks: [aufgabe('a'), aufgabe('b'), aufgabe('priv', { projectId: 'pp', spaceId: 'privat' }), aufgabe('geheim', { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin' })],
    listen: [], statusEigen: [], gruppen: [], vorlagen: [], umbauVersion: 3,
  });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Schreibweg Ziele: Oberziel', () => {
  it('setzen geht (auch über Horizonte hinweg); Kreis 409, Bereich 400, unbekannt 400 — nichts gespeichert', async () => {
    let d = await zieleLaden();
    const u = (d.jahr as (Ziel & { stand: string })[]).find(x => x.id === 'umsatz')!;
    expect((await zielePatch('jahr', [{ op: 'upsert', eintrag: { ...u, oberzielId: 'nord' }, stand: u.stand }])).status).toBe(200);
    // Quartalsziel zahlt auf das Jahresziel ein
    expect((await zielePatch('quartal', [{ op: 'upsert', eintrag: z('q1', { titel: 'Q1', oberzielId: 'umsatz' }) }])).status).toBe(200);
    d = await zieleLaden();
    const n = (d.jahr as (Ziel & { stand: string })[]).find(x => x.id === 'nord')!;
    const kreis = await zielePatch('jahr', [{ op: 'upsert', eintrag: { ...n, oberzielId: 'q1' }, stand: n.stand }]);
    expect(kreis.status).toBe(409);
    expect(((await kreis.json()) as { error: string }).error).toMatch(/auf sich selbst/);
    const p = (d.jahr as (Ziel & { stand: string })[]).find(x => x.id === 'privat-ziel')!;
    const bereich = await zielePatch('jahr', [{ op: 'upsert', eintrag: { ...p, oberzielId: 'nord' }, stand: p.stand }]);
    expect(bereich.status).toBe(400);
    expect(((await bereich.json()) as { error: string }).error).toBe(BEREICH_GETRENNT);
    expect((await zielePatch('jahr', [{ op: 'upsert', eintrag: { ...p, oberzielId: 'gemeinsam' }, stand: p.stand }])).status).toBe(200); // gemeinsam passt
    expect((await zielePatch('jahr', [{ op: 'upsert', eintrag: z('neu', { oberzielId: 'gibtsnicht' }) }])).status).toBe(400);
    const f = (await db.loadJson<ZieleDatei>('ziele'))!;
    expect(f.jahr.find(x => x.id === 'nord')).not.toHaveProperty('oberzielId');
    expect(f.jahr.some(x => x.id === 'neu')).toBe(false);
  });
});

describe('Schreibweg Aufgaben: „wartet auf“ und „zahlt ein auf“', () => {
  it('zielId setzen (Aufgabe + Projekt) geht im Bereich; anderer Bereich oder unbekanntes Ziel → 400, nichts gespeichert', async () => {
    expect((await tasksPatch({ ops: [{ op: 'upsert', task: { ...aufgabe('a'), zielId: 'umsatz' } }] })).status).toBe(200);
    expect((await gespeichert()).tasks.find(x => x.id === 'a')!.zielId).toBe('umsatz');
    const falsch = await tasksPatch({ ops: [{ op: 'upsert', task: { ...aufgabe('b'), zielId: 'privat-ziel' } }] });
    expect(falsch.status).toBe(400);
    expect(((await falsch.json()) as { error: string }).error).toBe(BEREICH_GETRENNT);
    expect((await tasksPatch({ ops: [{ op: 'upsert', task: { ...aufgabe('b'), zielId: 'nix' } }] })).status).toBe(400);
    expect((await gespeichert()).tasks.find(x => x.id === 'b')).not.toHaveProperty('zielId');
    // Privat-Aufgabe auf gemeinsames Ziel: ok
    expect((await tasksPatch({ ops: [{ op: 'upsert', task: { ...aufgabe('priv', { projectId: 'pp', spaceId: 'privat' }), zielId: 'gemeinsam' } }] })).status).toBe(200);
    const s = (await gespeichert()).projects.find(p => p.id === 'pb')!;
    expect((await tasksPatch({ struktur: { projekte: [{ op: 'upsert', eintrag: { ...s, zielId: 'umsatz' } }] } })).status).toBe(200);
    expect((await gespeichert()).projects.find(p => p.id === 'pb')!.zielId).toBe('umsatz');
    const pp = (await gespeichert()).projects.find(p => p.id === 'pp')!;
    expect((await tasksPatch({ struktur: { projekte: [{ op: 'upsert', eintrag: { ...pp, zielId: 'umsatz' } }] } })).status).toBe(400);
  });
  it('„wartet auf“ über den Bereich → 400; auf „nur ich“ → 400; im Bereich ok; Kreis weiter 409', async () => {
    const quer = await tasksPatch({ ops: [{ op: 'upsert', task: { ...aufgabe('a'), abhaengigVon: ['priv'] } }] });
    expect(quer.status).toBe(400);
    expect(((await quer.json()) as { error: string }).error).toBe(BEREICH_GETRENNT);
    const geheim = await tasksPatch({ ops: [{ op: 'upsert', task: { ...aufgabe('a'), abhaengigVon: ['geheim'] } }] });
    expect(geheim.status).toBe(400);
    expect(((await geheim.json()) as { error: string }).error).toBe(NUR_ICH_BEZUG);
    expect((await tasksPatch({ ops: [{ op: 'upsert', task: { ...aufgabe('a'), abhaengigVon: ['b'] } }] })).status).toBe(200);
    expect((await gespeichert()).tasks.find(x => x.id === 'a')!.abhaengigVon).toEqual(['b']);
    expect((await tasksPatch({ ops: [{ op: 'upsert', task: { ...aufgabe('b'), abhaengigVon: ['a'] } }] })).status).toBe(409);
  });
  it('ein alter Verweis über den Bereich (Altbestand) blockiert keine andere Änderung', async () => {
    const s = await gespeichert();
    await db.saveJson('tasks', { ...s, tasks: s.tasks.map(x => (x.id === 'a' ? { ...x, abhaengigVon: ['priv'], dependencies: [{ blockedByTaskId: 'priv' }] } : x)) });
    const r = await tasksPatch({ ops: [{ op: 'upsert', task: { ...aufgabe('a'), title: 'Neuer Titel', abhaengigVon: ['priv'] } }] });
    expect(r.status).toBe(200);
  });
});

describe('Schreibweg Meilensteine: Bereich', () => {
  it('ein privater Meilenstein zahlt nicht auf ein Business-Ziel ein (400); auf ein privates schon', async () => {
    const hoch = (m: Partial<Meilenstein> & { id: string }) => ({ op: 'upsert', eintrag: { titel: `M ${m.id}`, fortschritt: 0, erledigt: false, ...m } });
    const r = await msRoute.PATCH(anfrage('/api/state/meilensteine', 'PATCH', { ops: [hoch({ id: 'mp', space: 'privat', zielId: 'umsatz' })] }));
    expect(r.status).toBe(400);
    expect((await msRoute.PATCH(anfrage('/api/state/meilensteine', 'PATCH', { ops: [hoch({ id: 'mp', space: 'privat', zielId: 'privat-ziel' })] }))).status).toBe(200);
  });
});

describe('Ziel löschen räumt auf — „Rückgängig“ setzt zurück', () => {
  it('Unterziel, Meilenstein, Aufgabe und Projekt verlieren den Bezug; die Antwort nennt sie; POST /api/planung/bezuege holt sie zurück', async () => {
    // Bezüge anlegen
    let d = await zieleLaden();
    const u = (d.jahr as (Ziel & { stand: string })[]).find(x => x.id === 'umsatz')!;
    expect((await zielePatch('jahr', [{ op: 'upsert', eintrag: { ...u, oberzielId: 'nord' }, stand: u.stand }])).status).toBe(200);
    expect((await msRoute.PATCH(anfrage('/api/state/meilensteine', 'PATCH', { ops: [{ op: 'upsert', eintrag: { id: 'm1', titel: 'Vertrag', space: 'business', fortschritt: 0, erledigt: false, zielId: 'nord' } }] }))).status).toBe(200);
    expect((await tasksPatch({ ops: [{ op: 'upsert', task: { ...aufgabe('a'), zielId: 'nord' } }] })).status).toBe(200);
    const pb = (await gespeichert()).projects.find(p => p.id === 'pb')!;
    expect((await tasksPatch({ struktur: { projekte: [{ op: 'upsert', eintrag: { ...pb, zielId: 'nord' } }] } })).status).toBe(200);

    // löschen
    d = await zieleLaden();
    const nord = (d.jahr as (Ziel & { stand: string })[]).find(x => x.id === 'nord')!;
    const r = await zielePatch('jahr', [{ op: 'delete', id: 'nord', stand: nord.stand }]);
    expect(r.status).toBe(200);
    const antwort = (await r.json()) as { bezuegeGeloest: { zielId: string; ziele: string[]; meilensteine: string[]; aufgaben: string[]; projekte: string[] }[] };
    expect(antwort.bezuegeGeloest).toEqual([{ zielId: 'nord', ziele: ['umsatz'], meilensteine: ['m1'], aufgaben: ['a'], projekte: ['pb'] }]);
    expect((await db.loadJson<ZieleDatei>('ziele'))!.jahr.find(x => x.id === 'umsatz')).not.toHaveProperty('oberzielId');
    expect((await gespeichert()).tasks.find(x => x.id === 'a')).not.toHaveProperty('zielId');
    expect((await gespeichert()).projects.find(p => p.id === 'pb')).not.toHaveProperty('zielId');
    expect((await db.loadJson<{ meilensteine: Meilenstein[] }>('meilensteine'))!.meilensteine[0]).not.toHaveProperty('zielId');

    // „Rückgängig“ vor dem Zurückholen des Ziels → 409 (erst das Ziel)
    expect((await bezugRoute.POST(anfrage('/api/planung/bezuege', 'POST', { art: 'zurueck', geloest: antwort.bezuegeGeloest[0] }))).status).toBe(409);
    // Ziel zurück (ohne Stand), inzwischen bekam die Aufgabe ein anderes Ziel von Hand — das bleibt
    const { stand: _s, ...ohne } = nord;
    expect((await zielePatch('jahr', [{ op: 'upsert', eintrag: ohne }])).status).toBe(200);
    expect((await tasksPatch({ ops: [{ op: 'upsert', task: { ...aufgabe('a'), zielId: 'umsatz' } }] })).status).toBe(200);
    const zurueck = await bezugRoute.POST(anfrage('/api/planung/bezuege', 'POST', { art: 'zurueck', geloest: antwort.bezuegeGeloest[0] }));
    expect(zurueck.status).toBe(200);
    expect(((await zurueck.json()) as { gesetzt: Record<string, number> }).gesetzt).toEqual({ ziele: 1, meilensteine: 1, aufgaben: 0, projekte: 1 });
    expect((await db.loadJson<ZieleDatei>('ziele'))!.jahr.find(x => x.id === 'umsatz')!.oberzielId).toBe('nord');
    expect((await gespeichert()).tasks.find(x => x.id === 'a')!.zielId).toBe('umsatz');
    expect((await gespeichert()).projects.find(p => p.id === 'pb')!.zielId).toBe('nord');
    expect((await db.loadJson<{ meilensteine: Meilenstein[] }>('meilensteine'))!.meilensteine[0].zielId).toBe('nord');
  });
  it('Zugang: Dienstweg und fremder Haushalt bekommen 403; Unsinn 400', async () => {
    const dienst = { 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-seil-bezuege', 'x-make-person': 'kevin' };
    expect((await bezugRoute.POST(anfrage('/api/planung/bezuege', 'POST', { art: 'zurueck', geloest: { zielId: 'nord' } }, dienst))).status).toBe(403);
    expect((await bezugRoute.POST(anfrage('/api/planung/bezuege', 'POST', { art: 'zurueck', geloest: { zielId: 'nord' } }, sitzung('fremd')))).status).toBe(403);
    expect((await bezugRoute.POST(anfrage('/api/planung/bezuege', 'POST', { art: 'nix' }))).status).toBe(400);
  });
});
