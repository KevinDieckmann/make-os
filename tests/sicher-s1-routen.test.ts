// ─── S1 (29.09.): Funde der Sicherheits-/Rechte-/DSGVO-Prüfung — an den Routen ─────
// Eigener Datenordner, Dienstschlüssel, Konten mit Test-Haushalt und einem Konto aus einem anderen Haushalt. Kein iCloud,
// kein Modellaufruf (Schlüssel nur gesetzt, um bis zur Personen-Prüfung zu kommen). Alle Daten erfunden (@example.invalid).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-s1-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-s1';
delete process.env.ICLOUD_APPLE_ID;
delete process.env.ICLOUD_APP_PASSWORT;

type H = (r: Request, ctx?: unknown) => Promise<Response>;
let db: typeof import('@/lib/store/local-db');
let stapel: { GET: H; POST: H }, takt: { GET: H; POST: H }, loop: { POST: H }, planung: { POST: H }, apfel: { GET: H };
let buchung: { GET: H; POST: H }, tasks: { POST: H }, kimmi: { POST: H };

const sitzung = (person: string, extra: Record<string, string> = {}) => ({ 'content-type': 'application/json', 'x-make-user': person, ...extra });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const req = (pfad: string, kopf: Record<string, string>, body?: unknown) => new Request(`http://test${pfad}`, body === undefined ? { headers: kopf } : { method: 'POST', headers: kopf, body: JSON.stringify(body) });

const SEITE = {
  id: 'bs-s1-seite-1', slug: '30-min-s1-0123456789abcdef01234567', titel: '30 min Test', dauerMin: 30, person: 'kevin',
  fenster: [{ tage: [1, 2, 3, 4, 5], von: '10:00', bis: '12:00' }], tageVoraus: 5, vorlaufMin: 60, maxJeTag: 3, pufferMin: 0, rasterMin: 30,
  zielKalender: 'Testkalender', ort: '', fragen: { firma: true, anliegen: true }, verantwortlich: 'Test GmbH, test@example.invalid', aktiv: true,
  angelegt: '2026-09-29T10:00:00.000Z', geaendert: '2026-09-29T10:00:00.000Z',
};
const BUCHUNG = (id: string, email: string, extra: Record<string, unknown> = {}) => ({
  id, seiteId: SEITE.id, start: '2026-10-06T10:00:00', ende: '2026-10-06T10:30:00', status: 'abgelehnt', name: 'Testa Gast', email,
  einwilligung: { wortlaut: 'x', version: 'v', am: '2026-09-29T10:00:00.000Z' }, tokenHash: 'a'.repeat(64), angelegt: '2026-09-29T10:00:00.000Z',
  reserviertBis: '2026-09-29T10:30:00.000Z', statusAm: new Date().toISOString(), mailLink: { hash: 'f'.repeat(64), bis: '2026-10-10T00:00:00.000Z', am: '2026-09-29T00:00:00.000Z' }, ...extra,
});

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
    { id: 'k2', speicher: 'malin', email: 'm@test', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
    { id: 'k3', speicher: 'gast', email: 'g@test', name: 'Gast', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'anderer-haus' },
  ], einladungen: [] });
  await db.saveJson('zoe-stapel', { vorschlaege: [
    { id: 'zv-system', zeit: '2026-09-29T08:00:00Z', tag: '2026-09-29', werkzeug: 'create_task', gruppe: 'aufgaben', titel: 'System-Vorschlag', nachher: 'x', eingabe: { title: 'x' }, status: 'offen' },
  ] });
  await db.saveJson('calendar-cache', { at: new Date().toISOString(), events: [
    { id: 'kal1|u-privat', uid: 'u-privat', title: 'Privattermin Beispiel', location: 'Musterweg 1', startDate: '2026-10-06T09:00:00', endDate: '2026-10-06T10:00:00', calendarName: 'Privat Kevin', category: 'private-kevin', owner: 'kevin', privat: true, von: 'kevin', source: 'icloud' },
    { id: 'kal2|u-offen', uid: 'u-offen', title: 'Gemeinsames Essen', startDate: '2026-10-07T19:00:00', endDate: '2026-10-07T20:00:00', calendarName: 'Kalender', category: 'joint', owner: 'both', source: 'icloud' },
  ] });
  await db.saveJson('buchung--test-haus', { seiten: [SEITE], buchungen: [
    BUCHUNG('bu-gast-1', 'testa@example.invalid'),
    BUCHUNG('bu-gast-2', 'Testa@Example.invalid', { status: 'abgelaufen' }),
    BUCHUNG('bu-mitkontakt', 'kontakt@example.invalid', { kontaktId: 'c-kontakt' }),
  ] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-kontakt', vorname: 'Kora', nachname: 'Kontakt', email: 'kontakt@example.invalid', eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' }] });
  stapel = await import('@/app/api/zoe/stapel/route') as unknown as typeof stapel;
  takt = await import('@/app/api/zoe/takt/route') as unknown as typeof takt;
  loop = await import('@/app/api/loop/route') as unknown as typeof loop;
  planung = await import('@/app/api/planung/vorschlag/route') as unknown as typeof planung;
  apfel = await import('@/app/api/apple-calendar/route') as unknown as typeof apfel;
  buchung = await import('@/app/api/kalender/buchung/route') as unknown as typeof buchung;
  tasks = await import('@/app/api/tasks/create/route') as unknown as typeof tasks;
  kimmi = await import('@/app/api/kimmi/route') as unknown as typeof kimmi;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Tore: Haushalt des Inhabers (#2, #3, #16, #22)', () => {
  it('ein Konto aus einem anderen Haushalt kommt nicht an Stapel, Takt, Loop und Wochenplan', async () => {
    expect((await stapel.GET(req('/api/zoe/stapel', sitzung('gast')))).status).toBe(403);
    expect((await stapel.POST(req('/api/zoe/stapel', sitzung('gast'), { id: 'zv-system', entscheidung: 'ablehnen' }))).status).toBe(403);
    expect((await takt.GET(req('/api/zoe/takt', sitzung('gast')))).status).toBe(403);
    expect((await takt.POST(req('/api/zoe/takt', sitzung('gast'), {}))).status).toBe(403);
    expect((await loop.POST(req('/api/loop', sitzung('gast'), { loop: 'morgen' }))).status).toBe(403);
    expect((await planung.POST(req('/api/planung/vorschlag', sitzung('gast'), { woche: '2026-10-05' }))).status).toBe(403);
    // Dienstweg ohne Person: kein Rückfall auf „kevin“ mehr.
    expect((await stapel.GET(req('/api/zoe/stapel', dienst()))).status).toBe(403);
    expect((await loop.POST(req('/api/loop', dienst(), { loop: 'morgen' }))).status).toBe(403);
  });
  it('im Haushalt sieht man den System-Vorschlag', async () => {
    const d = await (await stapel.GET(req('/api/zoe/stapel', sitzung('malin')))).json() as { vorschlaege: { id: string }[] };
    expect(d.vorschlaege.map(v => v.id)).toContain('zv-system');
  });
});

describe('#1 /api/apple-calendar maskiert je Person, roh nur für den Systemlauf', () => {
  it('Malin sieht Kevins privaten Termin nur als „Belegt“', async () => {
    const d = await (await apfel.GET(req('/api/apple-calendar', sitzung('malin')))).json() as { title: string; location?: string; uid?: string }[];
    const txt = JSON.stringify(d);
    expect(txt).not.toContain('Privattermin');
    expect(txt).not.toContain('Musterweg');
    expect(txt).not.toContain('u-privat');
    expect(d.map(e => e.title)).toEqual(['Belegt', 'Gemeinsames Essen']);
  });
  it('Kevin sieht seinen Termin; der Mac-Zulieferer (Dienstweg ohne Person) den rohen Stand', async () => {
    expect(JSON.stringify(await (await apfel.GET(req('/api/apple-calendar', sitzung('kevin')))).json())).toContain('Privattermin');
    expect(JSON.stringify(await (await apfel.GET(req('/api/apple-calendar', dienst()))).json())).toContain('Privattermin');
    expect(JSON.stringify(await (await apfel.GET(req('/api/apple-calendar', dienst('malin')))).json())).not.toContain('Privattermin');
    expect((await apfel.GET(req('/api/apple-calendar', sitzung('gast')))).status).toBe(403);
  });
});

describe('#13–#15 Buchungsseiten verwalten', () => {
  it('Dienstweg darf keine Seiten und keine Freigaben (#14)', async () => {
    expect((await buchung.POST(req('/api/kalender/buchung', dienst('kevin'), { aktion: 'seite', seite: { ...SEITE }, stand: SEITE.geaendert }))).status).toBe(403);
    expect((await buchung.POST(req('/api/kalender/buchung', dienst('kevin'), { aktion: 'freigeben', id: 'bu-gast-1' }))).status).toBe(403);
  });
  it('Seite für eine Person außerhalb des Haushalts → 400 (#13)', async () => {
    const r = await buchung.POST(req('/api/kalender/buchung', sitzung('kevin'), { aktion: 'seite', seite: { ...SEITE, id: undefined, person: 'gast' } }));
    expect(r.status).toBe(400);
  });
  it('Ändern nur mit dem gelesenen Stand (409), zu große Körper → 413 (#15)', async () => {
    expect((await buchung.POST(req('/api/kalender/buchung', sitzung('kevin'), { aktion: 'seite', seite: { ...SEITE, titel: 'Neu' } }))).status).toBe(409);
    expect((await buchung.POST(req('/api/kalender/buchung', sitzung('kevin'), { aktion: 'seite', seite: { ...SEITE, titel: 'Neu' }, stand: '2020-01-01T00:00:00.000Z' }))).status).toBe(409);
    const ok = await buchung.POST(req('/api/kalender/buchung', sitzung('kevin'), { aktion: 'seite', seite: { ...SEITE, titel: '30 min Neu' }, stand: SEITE.geaendert }));
    expect(ok.status).toBe(200);
    expect((await buchung.POST(req('/api/kalender/buchung', sitzung('kevin'), { aktion: 'seite', seite: { ...SEITE, titel: 'x'.repeat(70_000) } }))).status).toBe(413);
  });
});

describe('#6 Gäste ohne CRM-Kontakt: Auskunft und Löschung', () => {
  it('Auskunft: Kopie ohne Token- und Link-Hash, beide Schreibweisen der Adresse', async () => {
    const r = await buchung.POST(req('/api/kalender/buchung', sitzung('kevin'), { aktion: 'buchung-auskunft', email: 'TESTA@example.invalid' }));
    expect(r.status).toBe(200);
    const d = await r.json() as { buchungen: { id: string }[] };
    expect(d.buchungen.map(b => b.id).sort()).toEqual(['bu-gast-1', 'bu-gast-2']);
    const txt = JSON.stringify(d);
    expect(txt).not.toContain('a'.repeat(64));
    expect(txt).not.toContain('f'.repeat(64));
    expect(txt).not.toContain('tokenHash');
  });
  it('mit Kontakt → 409 (über die Akte); Dienstweg → 403', async () => {
    expect((await buchung.POST(req('/api/kalender/buchung', sitzung('kevin'), { aktion: 'buchung-auskunft', email: 'kontakt@example.invalid' }))).status).toBe(409);
    expect((await buchung.POST(req('/api/kalender/buchung', dienst('kevin'), { aktion: 'buchung-loeschen', email: 'testa@example.invalid', bestaetigt: true }))).status).toBe(403);
  });
  it('Löschen erst nach Rückfrage, dann sind die Buchungen weg; das Protokoll nennt nur Kennungen', async () => {
    const frage = await (await buchung.POST(req('/api/kalender/buchung', sitzung('kevin'), { aktion: 'buchung-loeschen', email: 'testa@example.invalid' }))).json() as { rueckfrage?: boolean; buchungen?: number };
    expect(frage).toMatchObject({ rueckfrage: true, buchungen: 2 });
    const r = await (await buchung.POST(req('/api/kalender/buchung', sitzung('kevin'), { aktion: 'buchung-loeschen', email: 'testa@example.invalid', bestaetigt: true }))).json() as { ok: boolean; geloescht: number };
    expect(r).toMatchObject({ ok: true, geloescht: 2 });
    const rest = await db.loadJson<{ buchungen: { id: string }[] }>('buchung--test-haus');
    expect(rest!.buchungen.map(b => b.id)).toEqual(['bu-mitkontakt']);
    const { promises: fs } = await import('node:fs');
    const protokolle = (await fs.readdir(ordner)).filter(n => n.startsWith('aenderungsprotokoll--'));
    const alles = JSON.stringify(await Promise.all(protokolle.map(n => db.loadJson(n.slice(0, -5)))));
    expect(alles).toContain('bu-gast-1');
    expect(alles).not.toContain('testa@');
  });
});

describe('U1-Routen nach den S1-Regeln (nur von Hand)', () => {
  it('Übernahme (ausführen/erneut/zurücknehmen) und Spiegel-Löschen: Dienstweg → 403', async () => {
    const uebernahme = await import('@/app/api/planung/uebernahme/route') as unknown as { POST: H };
    const spiegel = await import('@/app/api/kalender/spiegel/route') as unknown as { POST: H };
    for (const aktion of ['ausfuehren', 'erneut', 'zuruecknehmen']) expect((await uebernahme.POST(req('/api/planung/uebernahme', dienst('kevin'), { aktion }))).status, aktion).toBe(403);
    expect((await spiegel.POST(req('/api/kalender/spiegel', dienst('kevin'), { art: 'event', aktion: 'loeschen', id: 'ev-test-1' }))).status).toBe(403);
  });
});

describe('#17/#18 Aufgabe anlegen: kein Rückfall, nie gekürzt', () => {
  it('Titel zu lang → 413; Systemlauf ohne Person und ohne owner → 400', async () => {
    expect((await tasks.POST(req('/api/tasks/create', sitzung('kevin'), { title: 'x'.repeat(301) }))).status).toBe(413);
    expect((await tasks.POST(req('/api/tasks/create', sitzung('kevin'), { title: 'ok', einheit: 'e'.repeat(41) }))).status).toBe(413);
    expect((await tasks.POST(req('/api/tasks/create', sitzung('kevin'), { title: 'ok', description: 'd'.repeat(4001) }))).status).toBe(413);
    expect((await tasks.POST(req('/api/tasks/create', dienst(), { title: 'Systemlauf ohne owner' }))).status).toBe(400);
  });
});

describe('#17 ZOE-Gespräch ohne Person', () => {
  it('Dienstweg ohne Person → 400 (nie „kevin“)', async () => {
    const vorher = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'nur-bis-zur-personen-pruefung';
    try {
      const r = await kimmi.POST(req('/api/kimmi', dienst(), { message: 'Hallo' }));
      expect(r.status).toBe(400);
    } finally { if (vorher === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = vorher; }
  });
});
