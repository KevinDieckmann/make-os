// ─── Lichtfäden v2 — Route GET /api/lichtfaeden: Haushalts-Tor, Dienstweg, Personen-/Privat-Regel (erfundene Daten) ─
// Eigener Datenordner, Konten mit Test-Haushalt, erfundene Ziele/Meilensteine/Aufgaben/Familie/Sport; der Kalender kommt
// aus einer Attrappe (ein privater Termin der Partnerin, ein Gesundheitstermin, ein gemeinsamer).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-lichtfaeden-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-lichtfaeden';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

vi.mock('@/lib/kalender/zoe-sicht-server', () => ({
  termineFuerZoe: async () => ({
    stand: null, quelle: 'icloud', kemaris: [], kemarisStand: null, einstellungen: { space: { Arbeit: 'business' } },
    termine: [
      { id: 'Privat|u1', titel: 'Geheimes Treffen Malin', start: '2026-10-20T18:00:00', ende: '2026-10-20T20:00:00', ganztags: false, kalender: 'Malin', art: 'termin', sichtbarkeit: 'privat', wer: 'malin' },
      { id: 'Malin|u2', titel: 'Physiotherapie', start: '2026-10-21T08:00:00', ende: '2026-10-21T09:00:00', ganztags: false, kalender: 'Malin', art: 'termin', sichtbarkeit: 'standard', wer: 'malin' },
      { id: 'Gemeinsam|u3', titel: 'Elternabend', start: '2026-10-22T19:00:00', ende: '2026-10-22T20:00:00', ganztags: false, kalender: 'Gemeinsam', art: 'termin', sichtbarkeit: 'standard', wer: 'beide' },
      { id: 'Arbeit|u4', titel: 'Kundentermin', start: '2026-10-23T10:00:00', ende: '2026-10-23T11:00:00', ganztags: false, kalender: 'Arbeit', art: 'termin', sichtbarkeit: 'standard', wer: 'kevin' },
    ],
  }),
}));

type Antwort = { ok: boolean; fehler?: string; sicht: string; personen: { id: string; name: string; ich: boolean }[]; ansicht: { wurzel: { id: string }; pfad: { id: string }[]; buendel: { id: string; name: string; anzahl: number; tiefer?: string }[]; marken: { titel: string }[] }; engstellen: unknown[]; text: string };
let route: { GET: (r: Request) => Promise<Response> };
const sitzung = (p: string) => ({ 'x-make-user': p });
const dienst = (p?: string) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, ...(p ? { 'x-make-person': p } : {}) });
const get = (q: string, h: Record<string, string>) => route.GET(new Request(`http://test/api/lichtfaeden?von=2026-10-01&bis=2027-03-31&${q}`, { headers: h }));
const json = async (q: string, h: Record<string, string>) => { const r = await get(q, h); return { status: r.status, d: (await r.json()) as Antwort }; };

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const k = (id: string, speicher: string, rolle: string, haushalt: string, name: string) => ({ id, speicher, email: `${speicher}@test`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
  await db.saveJson('konten', { konten: [k('k1', 'kevin', 'inhaber', 'test-haus', 'Kevin'), k('k2', 'malin', 'mitglied', 'test-haus', 'Malin'), k('k3', 'gast', 'mitglied', 'anderer-haus', 'Gast')], einladungen: [] });
  await db.saveJson('ziele', { tag: [], woche: [], monat: [], quartal: [{ id: 'z-biz~quartal', titel: 'Drei Mandate im Quartal (angepasst)', fortschritt: 0, space: 'business', abgeleitetVon: 'z-biz', angepasst: true }], jahr: [{ id: 'z-biz', titel: 'Zwölf Mandate', fortschritt: 40, space: 'business', rang: 1 }], fokus: {} });
  await db.saveJson('meilensteine', { meilensteine: [{ id: 'm-1', titel: 'Neun Mandate', faellig: '2026-10-30', zielId: 'z-biz', space: 'business', fortschritt: 50, erledigt: false }] });
  const t = (id: string, x: Record<string, unknown>) => ({ id, projectId: 'p1', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: '2026-09-01', updatedAt: '2026-09-01', ...x });
  await db.saveJson('tasks', { projects: [], listen: [], tasks: [
    t('t-1', { dueDate: '2026-10-28', title: 'Angebot schreiben' }),
    t('t-geheim', { dueDate: '2026-10-29', title: 'Geschenk für Kevin', assignee: 'malin', angelegtVon: 'malin', sichtbarkeit: 'nur-ich', spaceId: 'privat' }),
  ] });
  await db.saveJson('sport--malin', { version: 1, ziele: [{ id: 's-1', art: 'hyrox', titel: 'Hyrox Wettkampf Hamburg', datum: '2026-11-21' }] });
  route = (await import('@/app/api/lichtfaeden/route')) as unknown as typeof route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); vi.restoreAllMocks(); });

describe('Zugang', () => {
  it('ohne Sitzung, fremder Haushalt und Dienstweg (auch mit Person) → 403', async () => {
    expect((await get('', {})).status).toBe(403);
    expect((await get('', sitzung('gast'))).status).toBe(403);
    expect((await get('', dienst())).status).toBe(403);
    expect((await get('', dienst('kevin'))).status).toBe(403);
  });
  it('ungültige Parameter → 400; unbekannte Ebene → 404; Person außerhalb des Haushalts → 400', async () => {
    expect((await get('wurzel=<script>', sitzung('kevin'))).status).toBe(400);
    expect((await route.GET(new Request('http://test/api/lichtfaeden?von=2026-10-01&bis=2030-12-31', { headers: sitzung('kevin') }))).status).toBe(400);
    expect((await get('wurzel=ziel:gibtsnicht', sitzung('kevin'))).status).toBe(404);
    expect((await get('person=gast', sitzung('kevin'))).status).toBe(400);
  });
});

describe('Ansicht', () => {
  it('Gesamt: Business und Privat, Personen des Haushalts (ich markiert), Textäquivalent', async () => {
    const { status, d } = await json('wurzel=gesamt&person=alle', sitzung('kevin'));
    expect(status).toBe(200);
    expect(d.ansicht.buendel.map(b => b.id).sort()).toEqual(['space:business', 'space:privat']);
    expect(d.personen).toEqual([{ id: 'kevin', name: 'Kevin', ich: true }, { id: 'malin', name: 'Malin', ich: false }]);
    expect(d.text).toContain('Lichtfäden Gesamt');
  });
  it('abgeleitetes, angepasstes Ziel (ZielDetail fragt seine eigene Kennung an) → die Fäden seines Jahresziels, kein 404', async () => {
    const r = await get('wurzel=ziel:z-biz~quartal', sitzung('kevin'));
    expect(r.status).toBe(200);
    const d = (await r.json()) as Antwort;
    expect(d.ansicht.wurzel.id).toBe('ziel:z-biz');
    expect(d.ansicht.buendel.map(b => b.id)).toContain('ms:m-1');
  });
  it('eine Ebene tiefer: Ziel → Meilenstein-Bündel; Meilenstein-Markierung', async () => {
    const { d } = await json('wurzel=ziel:z-biz', sitzung('kevin'));
    expect(d.ansicht.pfad.map(k => k.id)).toEqual(['gesamt', 'space:business', 'thema:business:planung', 'ziel:z-biz']);
    expect(d.ansicht.buendel.map(b => b.id)).toContain('ms:m-1');
    expect(d.ansicht.marken.map(m => m.titel)).toContain('Neun Mandate');
  });
});

describe('Personen-/Privat-Regel', () => {
  it('Partner sieht KEINE Titel privater Termine, Gesundheit oder „nur ich“-Aufgaben der anderen Person — nur „Belegt“', async () => {
    const { d } = await json('wurzel=gesamt&person=alle', sitzung('kevin'));
    const roh = JSON.stringify(d);
    for (const geheim of ['Geheimes Treffen', 'Physiotherapie', 'Geschenk für Kevin', 'Hyrox', 'u1', 't-geheim']) expect(roh).not.toContain(geheim);
    const privat = (await json('wurzel=space:privat&person=alle', sitzung('kevin'))).d;
    const belegt = privat.ansicht.buendel.find(b => b.name === 'Belegt');
    expect(belegt?.anzahl).toBe(4); // privater Termin, Gesundheitstermin, „nur ich“-Aufgabe, Wettkampf
    expect(belegt?.tiefer).toBeUndefined();
    // Blatt-Ebene (Thema ohne Ziele): jeder Strang ein Faden mit Titel — der gemeinsame Termin bleibt sichtbar, Privates fehlt.
    const blatt = JSON.stringify((await json('wurzel=thema:privat:planung&person=alle', sitzung('kevin'))).d);
    expect(blatt).toContain('Elternabend');
    for (const geheim of ['Geheimes Treffen', 'Geschenk für Kevin']) expect(blatt).not.toContain(geheim);
    const ges = (await json('wurzel=thema:privat:gesundheit&person=alle', sitzung('kevin'))).d;
    expect(ges.ansicht.buendel).toEqual([]); // Gesundheit der Partnerin taucht nicht einmal als Thema auf
  });
  it('die Person selbst sieht ihre eigenen privaten Stränge mit Titel', async () => {
    const roh = JSON.stringify((await json('wurzel=thema:privat:planung&person=ich', sitzung('malin'))).d);
    expect(roh).toContain('Geheimes Treffen Malin');
    expect(roh).toContain('Geschenk für Kevin');
    const ges = JSON.stringify((await json('wurzel=thema:privat:gesundheit&person=ich', sitzung('malin'))).d);
    expect(ges).toContain('Physiotherapie');
    expect(ges).toContain('Hyrox Wettkampf Hamburg');
  });
  it('Person-Umschalter: „ich“ zeigt nur eigene + gemeinsame, die Partnerin per Kennung', async () => {
    const ich = (await json('wurzel=gesamt&person=ich', sitzung('kevin'))).d;
    expect(ich.sicht).toBe('kevin');
    const malin = (await json('wurzel=space:privat&person=malin', sitzung('kevin'))).d;
    expect(malin.sicht).toBe('malin');
    expect(malin.ansicht.buendel.find(b => b.name === 'Belegt')?.anzahl).toBe(4);
    const kevinPrivat = (await json('wurzel=space:privat&person=ich', sitzung('kevin'))).d;
    expect(kevinPrivat.ansicht.buendel.some(b => b.name === 'Belegt')).toBe(false);
  });
});
