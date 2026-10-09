// ─── U4 (28.09.) — Team aus den Daten: Speicher team--<haushalt>, Route /api/team, Delegation, Rückfall ──
// Eigener Datenordner, erfundene Personen (Test Person, @example.invalid). Kevin und Malin sind Konten.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-team-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-team';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; PATCH: Handler };
let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/make-one/team-speicher');
let typen: typeof import('@/lib/make-one/team-typen');

const HAUS = 'test-haus';
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const anfrage = (kopf: Record<string, string>, method = 'GET', body?: unknown) => new Request('http://test/api/team', { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const konto = (id: string, sp: string, name: string, rolle: 'inhaber' | 'mitglied', haushalt?: string) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });

const testPerson = { id: 't-test', name: 'Test Person', kurz: 'Testperson', rolle: 'Finanzen', bereich: 'Controlling', email: 'test.person@example.invalid', aktiv: true };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    konto('k1', 'kevin', 'Kevin', 'inhaber', HAUS),
    konto('k2', 'malin', 'Malin', 'mitglied', HAUS),
    konto('k3', 'fremd', 'Fremd Konto', 'mitglied', 'anderes-haus'),
    konto('k4', 'ohne', 'Ohne Haushalt', 'mitglied'),
  ], einladungen: [] });
  route = (await import('@/app/api/team/route')) as unknown as typeof route;
  speicher = await import('@/lib/make-one/team-speicher');
  typen = await import('@/lib/make-one/team-typen');
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Rückfall bei leerem Speicher (09.10.: nur Konten mit neutraler Rolle, keine Platzhalter)', () => {
  it('ohne Haushalt: kein Team — keine Rollen oder Personen aus dem Code', async () => {
    const t = await speicher.teamStand(null);
    expect(t.ausDaten).toBe(false);
    expect(t.team).toEqual([]);
  });

  it('leerer Speicher: nur die Konten, Rolle aus der Konto-Rolle, Hinweis „einmal eintragen“ (ausDaten false)', async () => {
    const r = await route.GET(anfrage(sitzung('malin')));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.ausDaten).toBe(false);
    expect(d.team.every((p: { quelle: string }) => p.quelle === 'konto')).toBe(true);
    expect(d.team.map((p: { kurz: string; rolle: string; bereich?: string }) => [p.kurz, p.rolle, p.bereich])).toEqual([['Kevin', 'Inhaber', undefined], ['Malin', 'Mitglied', undefined]]);
    expect(d.team[0].inhaber).toBe(true);
  });

  it('ein Konto erbt nie Rollen über seinen Namen; Inhaber nur über die Konto-Rolle', () => {
    const { team } = typen.teamZusammen([{ speicher: 'kevin', name: 'Kevin', rolle: 'mitglied' }, { speicher: 'pia', name: 'Pia', rolle: 'inhaber' }], []);
    expect(team.map(p => [p.kurz, p.rolle, !!p.inhaber])).toEqual([['Kevin', 'Mitglied', false], ['Pia', 'Inhaber', true]]);
  });
});

describe('Route /api/team: Zugang', () => {
  it('403 ohne Haushalt, aus fremdem Haushalt, unbekannt und als Systemlauf ohne Person', async () => {
    expect((await route.GET(anfrage(sitzung('ohne')))).status).toBe(403);
    expect((await route.GET(anfrage(sitzung('fremd')))).status).toBe(403);
    expect((await route.GET(anfrage(sitzung('niemand')))).status).toBe(403);
    expect((await route.GET(anfrage(dienst()))).status).toBe(403);
    expect((await route.GET(anfrage(dienst('fremd')))).status).toBe(403);
    expect((await route.GET(anfrage(dienst('malin')))).status).toBe(200);
    const op = { ops: [{ op: 'upsert', eintrag: testPerson }] };
    expect((await route.PATCH(anfrage(sitzung('ohne'), 'PATCH', op))).status).toBe(403);
    expect((await route.PATCH(anfrage(sitzung('fremd'), 'PATCH', op))).status).toBe(403);
    expect(await db.loadJson(speicher.teamSpeicherName(HAUS))).toBeNull();
  });
});

describe('Route /api/team: Pflegen mit Stand', () => {
  it('anlegen → aus den Daten, Platzhalter fallen weg, Speicher heißt team--<haushalt>', async () => {
    const r = await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', eintrag: testPerson }] }));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.ausDaten).toBe(true);
    expect(d.team.some((p: { quelle: string }) => p.quelle === 'platzhalter')).toBe(false);
    const tp = d.team.find((p: { id: string }) => p.id === 't-test');
    expect(tp).toMatchObject({ name: 'Test Person', kurz: 'Testperson', quelle: 'daten', aktiv: true, email: 'test.person@example.invalid' });
    expect(typeof tp.stand).toBe('string');
    const f = await db.loadJson<{ team: { id: string }[] }>(`team--${HAUS}`);
    expect(f?.team.map(e => e.id)).toEqual(['t-test']);
  });

  it('GET mit ETag: 304, solange sich nichts geändert hat', async () => {
    const r1 = await route.GET(anfrage(sitzung('kevin')));
    const etag = r1.headers.get('etag')!;
    expect(etag).toBeTruthy();
    const r2 = await route.GET(anfrage({ ...sitzung('kevin'), 'if-none-match': etag }));
    expect(r2.status).toBe(304);
  });

  it('veralteter Stand → 409 mit Konflikten und aktuellem Team, nichts überschrieben', async () => {
    const d = await (await route.GET(anfrage(sitzung('kevin')))).json();
    const alt = d.team.find((p: { id: string }) => p.id === 't-test').stand as string;
    // Malin ändert zuerst …
    expect((await route.PATCH(anfrage(sitzung('malin'), 'PATCH', { ops: [{ op: 'teil', id: 't-test', felder: { rolle: 'Controlling' }, stand: alt }] }))).status).toBe(200);
    // … Kevin schickt den alten Stand
    const r = await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'teil', id: 't-test', felder: { rolle: 'Vertrieb' }, stand: alt }] }));
    expect(r.status).toBe(409);
    const k = await r.json();
    expect(k.konflikte?.length).toBe(1);
    expect(k.team.find((p: { id: string }) => p.id === 't-test').rolle).toBe('Controlling');
  });

  it('deaktivieren statt löschen; Löschen wird abgelehnt', async () => {
    expect((await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'delete', id: 't-test' }] }))).status).toBe(400);
    const r = await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'teil', id: 't-test', felder: { aktiv: false } }] }));
    expect(r.status).toBe(200);
    const team = await speicher.teamVon(HAUS);
    expect(team.find(p => p.id === 't-test')?.aktiv).toBe(false);
    expect(typen.delegierbar(team).some(p => p.id === 't-test')).toBe(false);
    await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'teil', id: 't-test', felder: { aktiv: true } }] }));
  });

  it('Kurzwort: ein Wort, eindeutig (auch gegen die Konten)', async () => {
    const doppelt = { ...testPerson, id: 't-zwei', name: 'Test Zweite', kurz: 'kevin', email: 'zwei@example.invalid' };
    expect((await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', eintrag: doppelt }] }))).status).toBe(400);
    const zweiWorte = { ...doppelt, kurz: 'zwei Worte' };
    expect((await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', eintrag: zweiWorte }] }))).status).toBe(400);
  });

  it('Konto-Eintrag: Rolle/Kurzwort pflegbar, Name bleibt aus dem Konto; fremde Konten abgelehnt', async () => {
    const r = await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', eintrag: { id: 'konto-malin', name: 'Anders', kurz: 'Malin', rolle: 'Gesundheit', aktiv: false } }] }));
    expect(r.status).toBe(200);
    const malin = (await speicher.teamVon(HAUS)).find(p => p.id === 'konto-malin')!;
    expect(malin).toMatchObject({ name: 'Malin', rolle: 'Gesundheit', aktiv: true, quelle: 'konto', speicher: 'malin' });
    expect((await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', eintrag: { id: 'konto-fremd', name: 'x', kurz: 'Fremd', rolle: '', aktiv: true } }] }))).status).toBe(400);
  });
});

describe('Leser: Delegation und Prompts aus den Daten', () => {
  it('Delegiert-Marker erkennt das Kurzwort aus den Daten (auch mit Umlaut, ohne Groß/Klein)', async () => {
    await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', eintrag: { id: 't-pruef', name: 'Test Prüfer', kurz: 'Prüfer', rolle: 'Recht', aktiv: true } }] }));
    const team = await speicher.teamVon(HAUS);
    expect(typen.delegiertAn('Unterlagen\n— Delegiert an Testperson (01.10): bitte prüfen', team)?.person?.name).toBe('Test Person');
    expect(typen.delegiertAn('— Delegiert an Prüfer (02.10)', team)?.person?.id).toBe('t-pruef');
    expect(typen.personZuKurz(team, 'testperson')?.id).toBe('t-test');
    expect(typen.delegiertAn('— Delegiert an Malin (03.10)', team)?.person?.speicher).toBe('malin');
    expect(typen.delegiertAn('nichts delegiert', team)).toBeUndefined();
    expect(typen.delegierbar(team).map(p => p.kurz)).toEqual(expect.arrayContaining(['Malin', 'Testperson', 'Prüfer']));
    expect(typen.delegierbar(team).some(p => p.kurz === 'Kevin')).toBe(false);
  });

  it('Prompt-Zeilen tragen die Namen aus den Daten', async () => {
    const zeilen = typen.teamZeilenAus(await speicher.teamFuerPerson('malin'));
    expect(zeilen.some(z => z.startsWith('Test Person (Testperson)'))).toBe(true);
    expect(zeilen.some(z => z.includes('Person A'))).toBe(false);
  });

  it('eine Person außerhalb des Haushalts bekommt kein Team', async () => {
    const team = await speicher.teamFuerPerson('fremd');
    expect(team).toEqual([]);
    const req = new Request('http://test/api/delegation', { method: 'POST', headers: sitzung('fremd') });
    expect((await speicher.teamFuerAnfrage(req)).some(p => p.name === 'Test Person')).toBe(false);
    const inhaber = new Request('http://test/api/delegation', { method: 'POST', headers: sitzung('kevin') });
    expect((await speicher.teamFuerAnfrage(inhaber)).some(p => p.name === 'Test Person')).toBe(true);
  });
});
