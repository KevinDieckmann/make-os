// Business-Einheit an Aufgaben (27.09., Kevin: „im Business immer zwischen Selbstständigkeit,
// KD Ventures und MAKE OS UG unterscheiden“): Säuberung im Schreibweg, Ableitung für System-
// Aufgaben aus der Gesellschaft, Filterlogik, Vorgabe. Eigener Datenordner — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-einheit-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-einheit';
delete process.env.MAKE_OS_DATENSCHLUESSEL;

import {
  aufgabeEinheit, einheitAusBezug, passtEinheitFilter, einheitFilterOptionen, vorgabeEinheit, einheitKurz, einheitFarbe,
  EINHEIT_ALLE, EINHEIT_OHNE, EINHEIT_GRAU,
} from '@/lib/aufgaben/einheit';
import { aufgabeAus } from '@/lib/heads/autonomie';
import { sauberRoutine } from '@/lib/planung/routinen';
import type { HeadVorschlag } from '@/lib/heads/stand';

const kopf = { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' };
const req = (url: string, body: unknown, method = 'PATCH') => new Request(`http://test${url}`, { method, headers: kopf, body: JSON.stringify(body) });
const jetzt = '2026-09-27T10:00:00.000Z';
const aufgabe = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: `Aufgabe ${id}`, projectId: 'proj-kdm', status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, ...extra });

describe('Einheit — Säuberung (rein)', () => {
  it('Business: Name vereinheitlicht, Privat verworfen, zu kurz verworfen, lang gekappt', () => {
    expect(aufgabeEinheit({ id: 'a', title: 'Angebot', projectId: 'proj-kdm', space: 'business', einheit: 'neue ug' })).toBe('MAKE OS UG');
    expect(aufgabeEinheit({ id: 'a', title: 'Angebot', projectId: 'proj-kdm', einheit: 'kdv' })).toBe('KD Ventures');
    expect(aufgabeEinheit({ id: 'a', title: 'Angebot', projectId: 'proj-kdm', space: 'privat', einheit: 'KD Ventures' })).toBeUndefined();
    expect(aufgabeEinheit({ id: 'a', title: 'Wohnung kündigen', projectId: 'x', einheit: 'KD Ventures' })).toBeUndefined();
    expect(aufgabeEinheit({ id: 'a', title: 'Angebot', projectId: 'x', space: 'business', einheit: 'x' })).toBeUndefined();
    expect(aufgabeEinheit({ id: 'a', title: 'Angebot', projectId: 'x', space: 'business', einheit: 'K'.repeat(60) })).toHaveLength(40);
    // Ort von Hand (Board › Ort) = privat → keine Einheit
    expect(aufgabeEinheit({ id: 'a', title: 'Angebot', projectId: 'proj-kdm', einheit: 'KD Ventures' }, { a: 'privat' })).toBeUndefined();
  });
  it('Routinen tragen die Einheit nur im Business', () => {
    expect(sauberRoutine({ id: 'r1', label: 'Wochenabschluss', space: 'business', einheit: 'selbststaendigkeit' })?.einheit).toBe('Selbstständigkeit');
    expect(sauberRoutine({ id: 'r2', label: 'Spazieren', space: 'privat', einheit: 'KD Ventures' })?.einheit).toBeUndefined();
    expect(sauberRoutine({ id: 'r3', label: 'Spazieren', einheit: 'KD Ventures' })?.einheit).toBeUndefined();
  });
});

describe('Einheit — Ableitung für System-Aufgaben', () => {
  const crm = {
    chancen: [{ id: 'd1', gesellschaft: 'kdv' }, { id: 'd2', gesellschaft: 'offen', leistungId: 'p1' }, { id: 'd3', gesellschaft: 'offen' }],
    mandate: [{ id: 'm1', gesellschaft: 'ug' }, { id: 'm2', gesellschaft: 'offen', chanceId: 'd1' }],
    leistungen: [{ id: 'p1', gesellschaft: 'kdc' }],
  };
  it('Mandat vor Deal vor Produkt; „offen“ ohne Bezug ergibt keine Einheit', () => {
    expect(einheitAusBezug(crm, { mandatId: 'm1' })).toBe('MAKE OS UG');
    expect(einheitAusBezug(crm, { chanceId: 'd1' })).toBe('KD Ventures');
    expect(einheitAusBezug(crm, { mandatId: 'm2' })).toBe('KD Ventures');
    expect(einheitAusBezug(crm, { chanceId: 'd2' })).toBe('Selbstständigkeit');
    expect(einheitAusBezug(crm, { chanceId: 'd3' })).toBeUndefined();
    expect(einheitAusBezug(crm, {})).toBeUndefined();
    expect(einheitAusBezug(null, { chanceId: 'd1' })).toBeUndefined();
  });
  it('Steuer-Aufgaben: Einheit aus der Kennung, privat ohne', async () => {
    const { steuerEinheit } = await import('@/lib/steuern/speicher');
    expect(steuerEinheit('steuer-kdc-ust-2026-10-10')).toBe('Selbstständigkeit');
    expect(steuerEinheit('steuer-kdv-kst-2026-12-10')).toBe('KD Ventures');
    expect(steuerEinheit('steuer-privat-est-2027-07-31')).toBeUndefined();
  });
  it('Head-Aufgabe trägt die Einheit (und damit Business) nur mit Bezug', () => {
    const v = { id: 'v1', titel: 'Angebot nachfassen', begruendung: 'Frist', prioritaet: 'mittel', frist: null } as unknown as HeadVorschlag;
    expect(aufgabeAus(v, 'Head of Sales', 'head-sales', 'kevin', jetzt, 'KD Ventures')).toMatchObject({ einheit: 'KD Ventures', space: 'business' });
    const ohne = aufgabeAus(v, 'Head of Sales', 'head-sales', 'kevin', jetzt);
    expect(ohne.einheit).toBeUndefined();
    expect(ohne.space).toBeUndefined();
  });
});

describe('Einheit — Filter und Vorgabe (rein)', () => {
  it('Filter: alle · Einheit (Schreibweise egal) · ohne', () => {
    expect(passtEinheitFilter(undefined, EINHEIT_ALLE)).toBe(true);
    expect(passtEinheitFilter('KD Ventures', 'KD Ventures')).toBe(true);
    expect(passtEinheitFilter('Neue UG', 'MAKE OS UG')).toBe(true);
    expect(passtEinheitFilter('KD Ventures', 'MAKE OS UG')).toBe(false);
    expect(passtEinheitFilter(undefined, EINHEIT_OHNE)).toBe(true);
    expect(passtEinheitFilter('Kunden', EINHEIT_OHNE)).toBe(false);
    expect(passtEinheitFilter(undefined, 'KD Ventures')).toBe(false);
  });
  it('Pillen: Alle · drei Kerneinheiten · genutzte eigene · ohne — mit Anzahl', () => {
    const o = einheitFilterOptionen(['KD Ventures', 'KD Ventures', 'Kunden', undefined, 'Pilot GmbH'], ['Selbstständigkeit', 'KD Ventures', 'MAKE OS UG', 'Kunden', 'Leerlauf']);
    expect(o.map(x => x.label)).toEqual(['Alle', 'Selbstständigkeit', 'KD Ventures', 'MAKE OS UG', 'Kunden', 'Pilot GmbH', 'ohne Einheit']);
    expect(o.find(x => x.id === 'KD Ventures')?.anzahl).toBe(2);
    expect(o.find(x => x.id === EINHEIT_OHNE)?.anzahl).toBe(1);
    expect(o[0].anzahl).toBe(5);
  });
  it('Vorgabe: gesetzter Filter, sonst zuletzt gewählt; „ohne“ → keine', () => {
    expect(vorgabeEinheit('MAKE OS UG', 'KD Ventures')).toBe('MAKE OS UG');
    expect(vorgabeEinheit(EINHEIT_ALLE, 'kdv')).toBe('KD Ventures');
    expect(vorgabeEinheit(EINHEIT_ALLE, null)).toBeUndefined();
    expect(vorgabeEinheit(EINHEIT_OHNE, 'KD Ventures')).toBeUndefined();
  });
  it('Kurzform und Farbe: Kerneinheiten eigen, eigene grau', () => {
    expect(einheitKurz('KD Ventures')).toBe('KDV');
    expect(einheitKurz('Ein sehr langer Kundenname')).toBe('Ein sehr lang…');
    expect(einheitFarbe('Kunden')).toBe(EINHEIT_GRAU);
    expect(einheitFarbe('MAKE OS UG')).not.toBe(EINHEIT_GRAU);
  });
});

describe('Einheit — Schreibweg /api/state/tasks und /api/tasks/create', () => {
  type Route = { PATCH: (r: Request) => Promise<Response>; PUT: (r: Request) => Promise<Response>; GET: () => Promise<Response> };
  let tasks: Route, anlegen: { POST: (r: Request) => Promise<Response> }, db: typeof import('@/lib/store/local-db');
  beforeAll(async () => {
    db = await import('@/lib/store/local-db');
    tasks = (await import('@/app/api/state/tasks/route')) as unknown as Route;
    anlegen = (await import('@/app/api/tasks/create/route')) as unknown as { POST: (r: Request) => Promise<Response> };
    await db.saveJson('tasks', { projects: [{ id: 'proj-kdm', title: 'KD' }], tasks: [] });
    await db.saveJson('ordnung', { orgs: { 'b-hand-privat': 'privat' } });
    // Seit 28.09. abends: Aufgaben nur im Haushalt des Inhabers — der Dienstweg nennt „kevin“, also braucht es sein Konto.
    await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: 'kevin@test.invalid', name: 'Kevin', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' }], einladungen: [] });
  });
  afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });
  const lies = async () => ((await db.loadJson<{ tasks: Record<string, unknown>[] }>('tasks'))?.tasks ?? []);

  it('PATCH: Business vereinheitlicht, Privat und Ort-privat verworfen, ohne Angabe die Einheit des Space', async () => {
    const r = await tasks.PATCH(req('/api/state/tasks', { ops: [
      { op: 'upsert', task: aufgabe('b-ug', { space: 'business', einheit: '  neue   UG ' }) },
      { op: 'upsert', task: aufgabe('b-kdc', { einheit: 'Selbstständig' }) },
      { op: 'upsert', task: aufgabe('b-eigen', { space: 'business', einheit: 'Pilot GmbH' }) },
      { op: 'upsert', task: aufgabe('p-1', { space: 'privat', einheit: 'KD Ventures' }) },
      { op: 'upsert', task: aufgabe('b-hand-privat', { einheit: 'KD Ventures' }) },
      { op: 'upsert', task: aufgabe('b-leer', { space: 'business' }) },
    ] }));
    expect(r.status).toBe(200);
    const l = await lies();
    const e = (id: string) => l.find(t => t.id === id);
    expect(e('b-ug')?.einheit).toBe('MAKE OS UG');
    expect(e('b-kdc')?.einheit).toBe('Selbstständigkeit');
    expect(e('b-eigen')?.einheit).toBe('Pilot GmbH');
    expect('einheit' in (e('p-1') ?? {})).toBe(false);
    expect('einheit' in (e('b-hand-privat') ?? {})).toBe(false);
    // Seit 28.09. abends (Aufgaben-Spaces): Business ohne Angabe liegt im Space des Projekts (KD Ventures) und trägt dessen Einheit.
    expect(e('b-leer')).toMatchObject({ spaceId: 'kdv', einheit: 'KD Ventures' });
    expect(e('b-ug')?.spaceId).toBe('ug');
    expect(e('p-1')?.spaceId).toBe('privat');
  });

  it('PUT: über einen vorhandenen Bestand 409 „neu laden“ (29.09., A2) — beim leeren Erststart säubert er genauso', async () => {
    const alt = await lies();
    const koerper = { projects: [{ id: 'proj-kdm', title: 'KD' }], tasks: [...alt.filter(t => t.id !== 'b-ug'), aufgabe('b-ug', { space: 'business', einheit: 'kdv' }), aufgabe('p-2', { space: 'privat', einheit: 'MAKE OS UG' })] };
    const abgelehnt = await tasks.PUT(req('/api/state/tasks', koerper, 'PUT'));
    expect(abgelehnt.status).toBe(409);
    expect(((await abgelehnt.json()) as { neuLaden?: boolean }).neuLaden).toBe(true);
    expect(await lies()).toEqual(alt);
    // Leerer Erststart: dann (und nur dann) darf der ganze Stand geschrieben werden.
    await db.saveJson('tasks', { projects: [], tasks: [] });
    const r = await tasks.PUT(req('/api/state/tasks', koerper, 'PUT'));
    expect(r.status).toBe(200);
    const l = await lies();
    expect(l.find(t => t.id === 'b-ug')?.einheit).toBe('KD Ventures');
    expect('einheit' in (l.find(t => t.id === 'p-2') ?? {})).toBe(false);
  });

  it('/api/tasks/create (ZOE, Meeting) nimmt die Einheit nur im Business', async () => {
    const a = await (await anlegen.POST(req('/api/tasks/create', { title: 'Vertrag UG prüfen', space: 'business', einheit: 'ug' }, 'POST'))).json();
    const b = await (await anlegen.POST(req('/api/tasks/create', { title: 'Geschenk kaufen', space: 'privat', einheit: 'KD Ventures' }, 'POST'))).json();
    const l = await lies();
    expect(l.find(t => t.id === a.id)?.einheit).toBe('MAKE OS UG');
    expect('einheit' in (l.find(t => t.id === b.id) ?? {})).toBe(false);
  });
});
