// ─── „Neu anfangen“ nur für volle Mitglieder (12.10., Restpunkt Sicht-Trennung — „Sicht X bekommt nichts aus Y“) ──────────
// „Neu anfangen“ nimmt Aufgaben, Ziele und Meilensteine des GANZEN Haushalts heraus — Privat, Selbstständigkeit und die Aufgaben der
// Firmen-Akte eingeschlossen. Ein Konto „nur Business“ (`finanzRecht: 'business'`) darf deshalb weder die Vorschau noch das Archiv noch
// den Neustart noch das Zurückholen benutzen (403 mit Satz, nichts gelesen, nichts geändert). Eigener Datenordner, erfundene Konten/Daten.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-neustart-sicht-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-neustart-sicht';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; POST: Handler };
let db: typeof import('@/lib/store/local-db');
let SATZ = '';
const T0 = '2026-09-01T08:00:00.000Z';
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@test.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus', ...extra });
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const anfrage = (kopf: Record<string, string>, method = 'GET', body?: unknown, q = '') => new Request(`http://test/api/neustart${q}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const aufgabe = (id: string, titel: string, extra: Record<string, unknown> = {}) => ({ id, projectId: 'p-biz', title: titel, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...extra });
const ZIELE = { jahr: [{ id: 'zp', titel: 'PRIVATZIEL-GEHEIM', fortschritt: 10, space: 'privat' }, { id: 'zb', titel: 'Umsatz', fortschritt: 20, space: 'business' }], quartal: [], monat: [], woche: [], tag: [], fokus: {} };
const MS = { meilensteine: [{ id: 'mp', titel: 'PRIVAT-MEILENSTEIN-GEHEIM', fortschritt: 0, erledigt: false, space: 'privat', faellig: '2026-12-01' }] };
const AUFGABEN = () => ({
  projects: [
    { id: 'p-biz', title: 'Webseite', category: 'business', owner: 'both', color: '#DE9E63', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv' },
    { id: 'p-priv', title: 'PRIVATPROJEKT-GEHEIM', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat' },
  ],
  gruppen: [], listen: [], statusEigen: [], vorlagen: [],
  tasks: [
    aufgabe('b1', 'Impressum ergänzen'),
    aufgabe('priv1', 'PRIVATAUFGABE-GEHEIM', { projectId: 'p-priv', spaceId: 'privat' }),
    aufgabe('usp-ug-jahresabschluss-2026', 'AKTENPFLICHT-GEHEIM — bis 31.12.', { projectId: 'sonstige-ug', spaceId: 'ug' }),
  ],
});

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  ({ NEUSTART_NUR_VOLL: SATZ } = await import('@/lib/aufgaben/neustart-server'));
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied'), konto('k3', 'fiona', 'mitglied', { finanzRecht: 'business' })], einladungen: [] });
  await db.saveJson('tasks', AUFGABEN());
  await db.saveJson('ziele', ZIELE);
  await db.saveJson('meilensteine', MS);
  route = (await import('@/app/api/neustart/route')) as unknown as { GET: Handler; POST: Handler };
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('„Neu anfangen“ · Konto „nur Business“', () => {
  it('Vorschau und Archiv: 403 mit Satz — keine Zahl, kein Titel aus Privat oder der Firmen-Akte', async () => {
    for (const q of ['', '?archiv=1']) {
      const r = await route.GET(anfrage(sitzung('fiona'), 'GET', undefined, q));
      expect(r.status).toBe(403);
      const text = await r.text();
      expect(text).toContain(SATZ);
      for (const geheim of ['GEHEIM', 'vorschau', 'laeufe']) expect(text, geheim).not.toContain(geheim);
    }
  });

  it('Neu anfangen und Zurückholen: 403, nichts geändert, nichts archiviert (auch nicht die Sicherheitskopie)', async () => {
    const vorher = { tasks: await db.loadJson('tasks'), ziele: await db.loadJson('ziele'), ms: await db.loadJson('meilensteine') };
    const r = await route.POST(anfrage(sitzung('fiona'), 'POST', { aktion: 'neu-anfangen', laufId: 'na-fiona-0001', bestaetigung: 'NEU ANFANGEN' }));
    expect(r.status).toBe(403);
    expect(await r.text()).toContain(SATZ);
    // Auch mit ungültigem Körper kein Unterschied: das Tor kommt vor allem anderen.
    expect((await route.POST(anfrage(sitzung('fiona'), 'POST', { aktion: 'quatsch' }))).status).toBe(403);
    expect((await route.POST(anfrage(sitzung('fiona'), 'POST', { aktion: 'zurueck', laufId: 'na-fiona-0001', auswahl: { art: 'alles' } }))).status).toBe(403);
    expect(await db.loadJson('tasks')).toEqual(vorher.tasks);
    expect(await db.loadJson('ziele')).toEqual(vorher.ziele);
    expect(await db.loadJson('meilensteine')).toEqual(vorher.ms);
    expect(existsSync(path.join(ordner, 'archiv')) ? readdirSync(path.join(ordner, 'archiv')).filter(n => n.startsWith('neustart-')) : []).toEqual([]);
    expect(existsSync(path.join(ordner, 'planung-neustart--haus.json'))).toBe(false);
  });

  it('ein Lauf eines vollen Mitglieds lässt sich vom Konto „nur Business“ weder ansehen noch zurückholen', async () => {
    const r = await route.POST(anfrage(sitzung('malin'), 'POST', { aktion: 'neu-anfangen', laufId: 'na-malin-0001', bestaetigung: 'NEU ANFANGEN' }));
    expect(r.status).toBe(200);
    const nachLauf = await db.loadJson('tasks');
    const archiv = await route.GET(anfrage(sitzung('fiona'), 'GET', undefined, '?archiv=1'));
    expect(archiv.status).toBe(403);
    expect(await archiv.text()).not.toContain('GEHEIM');
    expect((await route.POST(anfrage(sitzung('fiona'), 'POST', { aktion: 'zurueck', laufId: 'na-malin-0001', auswahl: { art: 'alles' } }))).status).toBe(403);
    expect((await route.POST(anfrage(sitzung('fiona'), 'POST', { aktion: 'zurueck', laufId: 'na-malin-0001', auswahl: { art: 'aufgabe', id: 'priv1' } }))).status).toBe(403);
    expect(await db.loadJson('tasks')).toEqual(nachLauf);
    // Das volle Mitglied sieht den Lauf (Archiv) und holt alles zurück.
    const a = await (await route.GET(anfrage(sitzung('malin'), 'GET', undefined, '?archiv=1'))).json() as { laeufe: { id: string }[] };
    expect(a.laeufe.map(l => l.id)).toEqual(['na-malin-0001']);
    expect((await route.POST(anfrage(sitzung('malin'), 'POST', { aktion: 'zurueck', laufId: 'na-malin-0001', auswahl: { art: 'alles' } }))).status).toBe(200);
    const { ladeAufgaben } = await import('@/lib/aufgaben/sicht');
    const { aufgabenSicht } = await import('@/lib/aufgaben/papierkorb');
    expect(aufgabenSicht(await ladeAufgaben()).tasks.map(t => t.id).sort()).toEqual(['b1', 'priv1', 'usp-ug-jahresabschluss-2026']);
  });

  it('volle Mitglieder (Inhaber und Mitglied ohne Einschränkung) bekommen Vorschau samt Privat und Firmen-Akte', async () => {
    for (const wer of ['kevin', 'malin']) {
      const r = await route.GET(anfrage(sitzung(wer)));
      expect(r.status).toBe(200);
      const d = await r.json() as { vorschau: { aufgaben: number; ziele: number; meilensteine: number } };
      expect(d.vorschau).toMatchObject({ aufgaben: 3, ziele: 2, meilensteine: 1 });
    }
  });

  it('die Sperre folgt dem Konto sofort: wer „nur Business“ wird, kann nicht mehr; wer wieder voll wird, kann wieder', async () => {
    expect((await route.GET(anfrage(sitzung('malin')))).status).toBe(200);
    await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied', { finanzRecht: 'business' }), konto('k3', 'fiona', 'mitglied', { finanzRecht: 'business' })], einladungen: [] });
    expect((await route.GET(anfrage(sitzung('malin')))).status).toBe(403);
    expect((await route.POST(anfrage(sitzung('malin'), 'POST', { aktion: 'neu-anfangen', laufId: 'na-malin-0002', bestaetigung: 'NEU ANFANGEN' }))).status).toBe(403);
    await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied'), konto('k3', 'fiona', 'mitglied', { finanzRecht: 'business' })], einladungen: [] });
    expect((await route.GET(anfrage(sitzung('malin')))).status).toBe(200);
  });

  it('weiter 403 ohne Haushalt und auf dem Dienstweg (wie vorher)', async () => {
    await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied'), konto('k4', 'fremd', 'mitglied', { haushalt: 'anderer' })], einladungen: [] });
    expect((await route.GET(anfrage(sitzung('fremd')))).status).toBe(403);
    expect((await route.GET(anfrage({ 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' }))).status).toBe(403);
  });
});

describe('„Neu anfangen“ · die Sperre sitzt in der Bibliothek, nicht nur in der Route', () => {
  it('nurVolleMitglieder: Konto „nur Business“, unbekannte Person und fremder Haushalt werfen 403; ohne Person (Systemlauf) nicht', async () => {
    await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied'), konto('k3', 'fiona', 'mitglied', { finanzRecht: 'business' }), konto('k4', 'fremd', 'mitglied', { haushalt: 'anderer' })], einladungen: [] });
    const { nurVolleMitglieder, neuAnfangen, neustartVorschau, neustartArchiv, neustartZurueck, NeustartFehler } = await import('@/lib/aufgaben/neustart-server');
    for (const p of ['fiona', 'fremd', 'niemand']) await expect(nurVolleMitglieder(p), p).rejects.toMatchObject({ status: 403 });
    await expect(nurVolleMitglieder('kevin')).resolves.toBeUndefined();
    await expect(nurVolleMitglieder('malin')).resolves.toBeUndefined();
    await expect(nurVolleMitglieder(null)).resolves.toBeUndefined();
    // Jede öffentliche Funktion trägt die Sperre selbst.
    await expect(neustartVorschau('fiona')).rejects.toBeInstanceOf(NeustartFehler);
    await expect(neustartArchiv('fiona')).rejects.toBeInstanceOf(NeustartFehler);
    await expect(neuAnfangen({ laufId: 'na-lib-0001', person: 'fiona' })).rejects.toMatchObject({ status: 403 });
    await expect(neustartZurueck({ laufId: 'na-lib-0001', auswahl: { art: 'alles' }, person: 'fiona' })).rejects.toMatchObject({ status: 403 });
  });
});
