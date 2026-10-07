// ─── Seil (07.10.): GET /api/seil — Tor, Bereich serverseitig, „nur ich“, Adapter Planungsjahr + Aufgaben, Verbindungen ─────
// Eigener Datenordner, erfundene Ziele/Meilensteine/Aufgaben/Projekte/Deals; der Kalender kommt aus einer Attrappe (ein Termin an einer
// Aufgabe, ein maskierter Termin der anderen Person mit Aufgabe — er darf nicht als Marke erscheinen).
// Wächter (Plattform-Regel): „Sicht Business bekommt nichts aus Privat“ — weder über `bereich=business` noch über ein Konto mit
// `finanzRecht: 'business'` (das bekommt Business, auch wenn es „alle“ verlangt).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { SeilAnsicht } from '@/lib/lichtfaeden/seil';
import { meilensteinListeId } from '@/lib/planung/meilenstein-aufgaben';

const LM = meilensteinListeId('m-website');

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-seil-route-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-seil-route';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

vi.mock('@/lib/kalender/zoe-sicht-server', () => ({
  termineFuerZoe: async () => ({
    stand: null, quelle: 'icloud', kemaris: [], kemarisStand: null, einstellungen: {},
    termine: [
      { id: 'Arbeit|t1', titel: 'Workshop Website', start: '2026-11-18T10:00:00', ende: '2026-11-18T12:00:00', ganztags: false, kalender: 'Arbeit', art: 'termin', sichtbarkeit: 'standard', wer: 'kevin', bezug: { aufgabeId: 'a-texte' } },
      { id: 'Privat|t2', titel: 'Belegt', start: '2026-11-19T10:00:00', ende: '2026-11-19T12:00:00', ganztags: false, kalender: 'Malin', art: 'termin', sichtbarkeit: 'privat', wer: 'malin', maskiert: true, bezug: { aufgabeId: 'a-texte' } },
    ],
  }),
}));

type Antwort = { ok: boolean; fehler?: string; ebene: string; bereich: string; ansicht: SeilAnsicht };
let route: { GET: (r: Request) => Promise<Response> };
const sitzung = (p: string) => ({ 'x-make-user': p });
const get = (q: string, h: Record<string, string>) => route.GET(new Request(`http://test/api/seil?von=2026-09-01&bis=2027-12-31&${q}`, { headers: h }));
const json = async (q: string, h: Record<string, string> = sitzung('kevin')) => { const r = await get(q, h); return { status: r.status, d: (await r.json()) as Antwort }; };
const T0 = '2026-09-01T08:00:00.000Z';

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const k = (id: string, speicher: string, rolle: string, haushalt: string, extra: Record<string, unknown> = {}) => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt, ...extra });
  await db.saveJson('konten', { konten: [k('k1', 'kevin', 'inhaber', 'test-haus'), k('k2', 'malin', 'mitglied', 'test-haus'), k('k3', 'partner', 'mitglied', 'test-haus', { finanzRecht: 'business' }), k('k4', 'gast', 'mitglied', 'anderer-haus')], einladungen: [] });
  await db.saveJson('ziele', {
    tag: [], woche: [], monat: [],
    quartal: [{ id: 'z-q1', titel: 'Erstes Quartal stark', fortschritt: 30, space: 'business', oberzielId: 'z-umsatz', termin: '2027-03-31' }],
    jahr: [
      { id: 'z-umsatz', titel: 'Umsatz verdoppeln', fortschritt: 20, space: 'business', rang: 1, termin: '2027-06-30', jahr: 2027 },
      { id: 'z-gesund', titel: 'Geheimer Gesundheitsplan', fortschritt: 10, space: 'privat', rang: 2, jahr: 2026 },
      { id: 'z-alt', titel: 'Archiviertes Ziel', fortschritt: 0, space: 'business', jahr: 2026, archiviertAm: '2026-09-02T10:00:00.000Z' },
    ],
    fokus: {},
  });
  await db.saveJson('ziele-eigen--malin', { tag: [], woche: [], monat: [], quartal: [], jahr: [{ id: 'z-eigen', titel: 'Malins eigenes Ziel', fortschritt: 0, space: 'privat' }], fokus: {} });
  await db.saveJson('meilensteine', { meilensteine: [
    { id: 'm-vertrag', titel: 'Vertrag unterschrieben', faellig: '2026-11-15', zielId: 'z-umsatz', space: 'business', bereich: 'business', fortschritt: 100, erledigt: true, erledigtAm: '2026-10-01' },
    { id: 'm-website', titel: 'Website live', faellig: '2027-02-01', zielId: 'z-umsatz', space: 'business', bereich: 'business', fortschritt: 40, erledigt: false, wartetAuf: ['m-vertrag'] },
    { id: 'm-launch', titel: 'Launch', faellig: '2027-05-01', zielId: 'z-umsatz', space: 'business', bereich: 'business', fortschritt: 0, erledigt: false, wartetAuf: ['m-website'] },
    { id: 'm-arzt', titel: 'Arzttermin Geheim', faellig: '2026-12-01', zielId: 'z-gesund', space: 'privat', bereich: 'gesundheit', fortschritt: 0, erledigt: false },
    { id: 'm-lose', titel: 'Messe ohne Ziel', faellig: '2026-12-10', space: 'business', bereich: 'business', fortschritt: 0, erledigt: false },
  ] });
  const t = (id: string, x: Record<string, unknown>) => ({ id, projectId: 'p-vertrieb', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...x });
  await db.saveJson('crm', { firmen: [], mandate: [], kontakte: [], chancen: [{ id: 'd-1', titel: 'Großkunde', stufe: 'angebot', erwartetAm: '2027-01-20', wert: 1 }] });
  await db.saveJson('tasks', {
    projects: [
      { id: 'p-vertrieb', title: 'Vertrieb', category: 'business', owner: 'kevin', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv', zielId: 'z-umsatz' },
      { id: 'p-mehrheit', title: 'Marketing', category: 'business', owner: 'kevin', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv' },
      { id: 'p-haus', title: 'Zuhause Privat', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat' },
      { id: 'pm-kdv', title: 'Meilensteine', category: 'business', owner: 'both', color: '#E0A84E', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv' },
    ],
    listen: [{ id: LM, projektId: 'pm-kdv', titel: 'Website live', sortOrder: 1 }],
    tasks: [
      t('a-texte', { title: 'Texte schreiben', dueDate: '2026-11-20', projectId: 'pm-kdv', listeId: LM, status: 'done', completedAt: '2026-10-05T10:00:00.000Z' }),
      t('a-design', { title: 'Design abnehmen', dueDate: '2026-12-10', projectId: 'pm-kdv', listeId: LM, abhaengigVon: ['a-texte'] }),
      t('a-akquise', { title: 'Akquise', dueDate: '2026-11-05', bezug: { dealId: 'd-1' } }),
      t('a-direkt', { title: 'Direkt eingezahlt', dueDate: '2026-11-25', projectId: 'p-mehrheit', zielId: 'z-umsatz' }),
      t('a-mehr', { title: 'Noch eine', dueDate: '2026-11-26', projectId: 'p-mehrheit', zielId: 'z-umsatz' }),
      t('a-privat', { title: 'Privates Geheimnis', dueDate: '2026-11-11', projectId: 'p-haus', spaceId: 'privat', zielId: 'z-gesund' }),
      t('a-nurich', { title: 'Überraschung für Kevin', dueDate: '2026-11-12', projectId: 'p-vertrieb', assignee: 'malin', angelegtVon: 'malin', sichtbarkeit: 'nur-ich' }),
    ],
    gruppen: [], statusEigen: [], vorlagen: [], umbauVersion: 3,
  });
  route = (await import('@/app/api/seil/route')) as unknown as typeof route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); vi.restoreAllMocks(); });

const PRIVAT = ['Geheimer Gesundheitsplan', 'Arzttermin Geheim', 'Privates Geheimnis', 'Zuhause Privat', 'Malins eigenes Ziel'];

describe('Zugang und Parameter', () => {
  it('ohne Sitzung, fremder Haushalt, Dienstweg → 403; ungültig → 400', async () => {
    expect((await get('', {})).status).toBe(403);
    expect((await get('', sitzung('gast'))).status).toBe(403);
    expect((await get('', { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' })).status).toBe(403);
    expect((await get('ebene=quer', sitzung('kevin'))).status).toBe(400);
    expect((await get('bereich=fremd', sitzung('kevin'))).status).toBe(400);
    expect((await route.GET(new Request('http://test/api/seil?von=2026-09-01&bis=2031-01-01', { headers: sitzung('kevin') }))).status).toBe(400);
  });
});

describe('Planungsjahr', () => {
  it('Seile je Ziel, Unterziel mündet ein, Meilensteine/Projekt/Einzelne Karten als Stränge, Ohne Ziel eigenes Bündel', async () => {
    const { status, d } = await json('ebene=jahr&bereich=alle');
    expect(status).toBe(200);
    const a = d.ansicht;
    expect(a.seile.map(s => s.zielId)).toEqual(['z-umsatz', 'z-gesund']);
    const u = a.seile[0];
    expect(u.straenge).toEqual(expect.arrayContaining(['ms:m-vertrag', 'ms:m-website', 'ms:m-launch', 'ziel:z-q1', 'projekt:p-vertrieb', 'karten:z-umsatz']));
    expect(a.straenge['ms:m-launch']).toMatchObject({ status: 'blockiert', grund: expect.stringContaining('Website live') });
    expect(a.straenge['ms:m-vertrag'].status).toBe('erledigt');
    expect(a.ohneZiel).toEqual(['ms:m-lose']);
    expect(a.straenge['karten:z-umsatz'].karten.map(k => k.id).sort()).toEqual(['a-direkt', 'a-mehr']);
    expect(a.straenge['ms:m-website'].karten.map(k => k.id)).toEqual(['a-texte', 'a-design']);
    expect(JSON.stringify(a)).not.toContain('Archiviertes Ziel');
  });
  it('Verbindungen: Termin an einer Aufgabe und Deal an einer Aufgabe sind Marken am Strang; der maskierte Termin nicht', async () => {
    const a = (await json('ebene=jahr&bereich=alle')).d.ansicht;
    expect(a.straenge['ms:m-website'].marken.map(m => [m.art, m.titel])).toEqual([['termin', 'Workshop Website']]);
    expect(a.straenge['projekt:p-vertrieb'].marken.map(m => m.art)).toEqual(['deal']);
    expect(JSON.stringify(a)).not.toContain('Privat|t2');
  });
  it('„nur ich“ der anderen Person kommt nie an — auch nicht als Karte', async () => {
    expect(JSON.stringify((await json('ebene=jahr&bereich=alle')).d)).not.toContain('Überraschung für Kevin');
    expect(JSON.stringify((await json('ebene=aufgaben&bereich=alle')).d)).not.toContain('Überraschung für Kevin');
    // die Anlegerin selbst sieht sie
    expect(JSON.stringify((await json('ebene=aufgaben&bereich=alle', sitzung('malin'))).d)).toContain('Überraschung für Kevin');
  });
  it('eigene Ziele einer Person gehören nicht ins Seil', async () => {
    expect(JSON.stringify((await json('ebene=jahr&bereich=alle', sitzung('malin'))).d)).not.toContain('Malins eigenes Ziel');
  });
});

describe('Wächter: Sicht Business bekommt nichts aus Privat', () => {
  it('bereich=business: kein privater Titel, kein privates Ziel', async () => {
    for (const ebene of ['jahr', 'aufgaben']) {
      const { d } = await json(`ebene=${ebene}&bereich=business`);
      expect(d.bereich).toBe('business');
      const text = JSON.stringify(d);
      for (const p of PRIVAT) expect(text, `${ebene}: ${p}`).not.toContain(p);
    }
  });
  it('Konto mit finanzRecht „business“ bekommt Business, auch wenn es „alle“ oder „privat“ verlangt', async () => {
    for (const b of ['alle', 'privat']) {
      const { status, d } = await json(`ebene=jahr&bereich=${b}`, sitzung('partner'));
      expect(status).toBe(200);
      expect(d.bereich).toBe('business');
      const text = JSON.stringify(d);
      for (const p of PRIVAT) expect(text).not.toContain(p);
    }
  });
  it('bereich=privat: nur Privates', async () => {
    const a = (await json('ebene=jahr&bereich=privat')).d.ansicht;
    expect(a.seile.map(s => s.zielId)).toEqual(['z-gesund']);
    expect(JSON.stringify(a)).not.toContain('Umsatz verdoppeln');
  });
});

describe('Aufgaben-Zeitstrahl', () => {
  it('Projekt mit Ziel, Projekt per Mehrheit seiner Karten, Meilenstein-Liste mit dem Ziel ihres Meilensteins', async () => {
    const a = (await json('ebene=aufgaben&bereich=business')).d.ansicht;
    expect(a.straenge['projekt:p-vertrieb'].seil).toBe('z-umsatz');
    expect(a.straenge['projekt:p-mehrheit'].seil).toBe('z-umsatz');
    expect(a.straenge[`liste:${LM}`]).toMatchObject({ seil: 'z-umsatz', titel: 'Website live', art: 'liste' });
    expect(a.kanten.find(k => k.id === 'k:a-texte>k:a-design')).toMatchObject({ offen: false });
    expect(a.seile.map(s => s.zielId)).toEqual(['z-umsatz']);
  });
});
