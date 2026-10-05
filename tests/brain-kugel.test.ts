// ─── Brain-Kugel — Sicht serverseitig, nur Kennungen, Deckel, jeder Punkt mit Weg (05.10.2026) ─
// Kevin (04.10., UMBAU_ABEND_0410.md 3): „Alles in MAKE OS als Datenpunkte … Privat bleibt privat.“ Plattform-Regel
// („Trennung serverseitig, nie nur versteckt“): Der Test hält fest, dass GET /api/brain/punkte
//   · einen fremden Haushalt, eine Anfrage ohne Sitzung und den Dienstweg mit 403 abweist,
//   · der anderen Person („Partner“) nie „nur ich“-Aufgaben samt Kette, eigene Ziele/Meilensteine, private Notizen oder
//     maskierte Termine gibt,
//   · einer Rolle ohne Privatzugang (`finanzRecht: 'business'`) NICHTS aus dem Privat-Space gibt,
//   · nur Kennung, Art, Bereich, Titel, Datum, Verknüpfungen liefert — keine Inhalte, Notiztexte, Merkmale der Sicht-Regel,
//   · Gesundheit nie als Punkt liefert (Art. 9) und Art.-18-Eingeschränkte auslässt,
//   · über dem Deckel die ältesten weglässt und das als `gekuerzt` meldet,
//   · für jeden Punkt einen Weg aus lib/wege.ts hat.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { kugelPunkteFuer, wegFuer, nachbarn, KUGEL_ARTEN, ART_BEREICH, PUNKTE_DECKEL, TITEL_MAX, punktId, type BrainPunkt, type RohPunkt } from '@/lib/brain/kugel';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-brain-kugel-'));
const vault = path.join(ordner, 'vault', 'Make.Claude');
process.env.MAKE_OS_DATEN_DIR = path.join(ordner, 'daten');
process.env.MAKE_OS_KEY = 'pruef-schluessel-brain-kugel';
process.env.MAKE_VAULT_DIR = vault;
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

vi.mock('@/lib/zeit', async orig => ({ ...(await orig<typeof import('@/lib/zeit')>()), localDay: () => '2026-10-05' }));
vi.mock('@/lib/kalender/zoe-sicht-server', () => ({
  termineFuerZoe: async (person: string) => ({
    stand: null, quelle: 'icloud', kemarisStand: null, einstellungen: { space: { 'Arbeit': 'business', 'Privat Kevin': 'privat', 'Privat Malin': 'privat' } },
    kemaris: [{ id: 'm365-0', titel: 'Spiegeltermin', start: '2026-10-06T09:00:00', ende: '2026-10-06T10:00:00', ganztags: false, kalender: 'KEMARIS', wer: 'kevin' }],
    termine: [
      { id: 'u-kunde', titel: 'Kundentermin Beispiel', start: '2026-10-07T10:00:00', ende: '2026-10-07T11:00:00', ganztags: false, kalender: 'Arbeit', wer: 'kevin', bezug: { kontaktId: 'k-1', firmaId: 'f-1' } },
      { id: 'u-kino', titel: 'Kino zu zweit', start: '2026-10-09T20:00:00', ende: '2026-10-09T22:00:00', ganztags: false, kalender: 'Privat Kevin', wer: 'beide' },
      // Für Kevin ist Malins privater Termin schon maskiert (wie `fuerZoe`).
      { id: 'u-malin', titel: person === 'malin' ? 'Geheimes Treffen' : 'Belegt', start: '2026-10-08T18:00:00', ende: '2026-10-08T19:00:00', ganztags: false, kalender: 'Privat Malin', wer: 'malin', sichtbarkeit: 'privat', ...(person === 'malin' ? {} : { maskiert: true }) },
      { id: 'u-arzt', titel: 'Arzttermin', start: '2026-10-10T08:00:00', ende: '2026-10-10T09:00:00', ganztags: false, kalender: 'Privat Kevin', wer: 'kevin' },
    ],
  }),
}));

type Antwort = { ok: boolean; sicht?: string; punkte?: BrainPunkt[]; gekuerzt?: number; deckel?: number; jeArt?: Record<string, number>; fehler?: string };
let route: { GET: (r: Request) => Promise<Response> };
const hole = async (kopf: Record<string, string>) => {
  const r = await route.GET(new Request('http://test/api/brain/punkte', { headers: kopf }));
  return { status: r.status, text: await r.clone().text(), d: (await r.json()) as Antwort };
};
const ids = (d: Antwort) => new Set((d.punkte ?? []).map(p => p.id));

beforeAll(async () => {
  mkdirSync(process.env.MAKE_OS_DATEN_DIR!, { recursive: true });
  const db = await import('@/lib/store/local-db');
  const k = (id: string, speicher: string, rolle: string, haushalt: string, name: string, extra: Record<string, unknown> = {}) => ({ id, speicher, email: `${speicher}@example.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt, ...extra });
  await db.saveJson('konten', { konten: [
    k('k1', 'kevin', 'inhaber', 'test-haus', 'Kevin'), k('k2', 'malin', 'mitglied', 'test-haus', 'Malin'),
    k('k3', 'gast', 'mitglied', 'anderer-haus', 'Gast'),
    // Teammitglied/Partner ohne Privatzugang (Rolle „nur Business“).
    k('k4', 'team1', 'mitglied', 'test-haus', 'Team', { finanzRecht: 'business' }),
  ], einladungen: [] });
  // Kartei: eine normale Person (mit privater Notiz und Freitext), eine eingeschränkte (Art. 18).
  const kontakt = (id: string, vor: string, nach: string, extra: Record<string, unknown> = {}) => ({ id, vorname: vor, nachname: nach, eignung: 'offen', prio: 'mittel', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-01-01', geaendertAm: '2026-09-20', ...extra });
  await db.saveJson('kontakte', { kontakte: [
    kontakt('k-1', 'Erika', 'Beispiel', { firmaId: 'f-1', notiz: 'INHALT-NOTIZ-KONTAKT', privatNotiz: 'INHALT-PRIVATNOTIZ', privatNotizVon: 'malin', email: 'erika@example.invalid' }),
    kontakt('k-2', 'Gesperrt', 'Person', { eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'kevin' } }),
  ] });
  await db.saveJson('crm', {
    firmen: [{ id: 'f-1', name: 'Beispiel GmbH', rolle: 'kunde', notiz: 'INHALT-FIRMA', geaendert: '2026-09-15' }, { id: 'f-alt', name: 'Archivfirma', rolle: 'kunde', geaendert: '2026-01-01', archiviertAm: '2026-02-01' }],
    chancen: [{ id: 'd-1', titel: 'Retainer Beispiel', kontaktIds: ['k-1', 'k-2'], firmaId: 'f-1', art: 'beratung', wert: { betrag: 9000, basis: 'einmalig' }, stufe: 'angebot', historie: [], qualifizierung: {}, gesellschaft: 'kdv', besitzer: 'kevin', angelegt: '2026-09-01', geaendert: '2026-10-01', notiz: 'INHALT-DEAL' }],
    mandate: [{ id: 'mand-1', kunde: 'Beispiel GmbH', firmaId: 'f-1', kontaktIds: ['k-1'], titel: 'Sprint', art: 'beratung', gesellschaft: 'kdv', status: 'aktiv', start: '2026-08-01', geaendert: '2026-09-30', notiz: 'INHALT-MANDAT' }],
  });
  // Aufgaben: Business, Privat, Malins „nur ich“ samt Unteraufgabe.
  const t = (id: string, x: Record<string, unknown>) => ({ id, projectId: 'p1', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: '2026-09-01', updatedAt: '2026-10-02', ...x });
  await db.saveJson('tasks', { projects: [], listen: [], tasks: [
    t('t-biz', { title: 'Angebot schreiben', space: 'business', bezug: { kontaktId: 'k-1', dealId: 'd-1' }, description: 'INHALT-BESCHREIBUNG' }),
    t('t-priv', { title: 'Steuerunterlagen sortieren', space: 'privat', spaceId: 'privat' }),
    t('t-geheim', { title: 'Geschenk für Kevin', assignee: 'malin', angelegtVon: 'malin', sichtbarkeit: 'nur-ich', spaceId: 'privat', space: 'privat' }),
    t('t-geheim-kind', { title: 'Geschenk einpacken', assignee: 'malin', parentId: 't-geheim' }),
  ] });
  await db.saveJson('ziele', { tag: [], woche: [], monat: [], quartal: [], fokus: {}, jahr: [
    { id: 'z-biz', titel: 'Zwölf Mandate', fortschritt: 40, space: 'business', rang: 1, termin: '2026-12-15' },
    { id: 'z-priv', titel: 'Rücklage', fortschritt: 20, space: 'privat', rang: 1, termin: '2026-12-20' },
    { id: 'z-sport', titel: 'Fitter werden', fortschritt: 0, space: 'privat', rang: 2, termin: '2026-12-30' },
  ] });
  await db.saveJson('ziele-eigen--malin', { tag: [], woche: [], monat: [], quartal: [], fokus: {}, jahr: [{ id: 'z-malin', titel: 'Spanisch B1', fortschritt: 10, space: 'privat', termin: '2026-11-30' }] });
  await db.saveJson('meilensteine', { meilensteine: [
    { id: 'm-biz', titel: 'Neun Mandate', faellig: '2026-10-30', zielId: 'z-biz', space: 'business', fortschritt: 50, erledigt: false },
    { id: 'm-malin', titel: 'Sprachkurs A2', faellig: '2026-10-20', zielId: 'z-malin', space: 'privat', fortschritt: 0, erledigt: false },
    { id: 'm-gesund', titel: 'Laufband 5 km', faellig: '2026-11-10', zielId: 'z-sport', bereich: 'gesundheit', fortschritt: 0, erledigt: false },
  ] });
  await db.saveJson('gesellschaften--test-haus', { gesellschaften: [{ id: 'g-1234', name: 'Beispiel Holding', status: 'eingetragen', angelegt: '2026-09-01', notizen: 'INHALT-REGISTER', beteiligungen: [{ id: 'bt-1', firmaId: 'f-1' }] }] });
  // Vault: eine Business-Notiz (verweist auf eine zweite), eine private Notiz von Malin, eine Privat-Bereich-Notiz, eine Gesundheitsnotiz.
  const notiz = (rel: string, text: string) => { const p = path.join(vault, rel); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, text); };
  notiz('01. Business/Strategie.md', '# Strategie\nINHALT-VAULT-TEXT verweist auf [[Zielbild]].\n');
  notiz('01. Business/Zielbild.md', '# Zielbild\nNoch ein Text.\n');
  notiz('02. Privat/Urlaub.md', '---\nscope: intern\n---\n# Urlaub\nPlanung.\n');
  notiz('01. Business/Tagebuch.md', '---\nscope: privat\nowner: malin\n---\n# Tagebuch\nINHALT-PRIVAT-MALIN\n');
  notiz('01. Business/Gesundheit Werte.md', '# Werte\nBlutdruck.\n');
  route = (await import('@/app/api/brain/punkte/route')) as unknown as typeof route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); vi.restoreAllMocks(); });

describe('Route: Zugang', () => {
  it('fremder Haushalt, ohne Sitzung und Dienstweg → 403', async () => {
    expect((await hole({ 'x-make-user': 'gast' })).status).toBe(403);
    expect((await hole({})).status).toBe(403);
    expect((await hole({ 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' })).status).toBe(403);
    expect((await hole({ 'x-make-user': 'unbekannt' })).status).toBe(403);
  });
});

describe('Route: Sicht serverseitig', () => {
  it('Inhaber sieht seine und die gemeinsamen Datensätze aller Arten — nicht Malins „nur ich“, eigene Ziele, private Notiz, maskierte Termine', async () => {
    const { status, d } = await hole({ 'x-make-user': 'kevin' });
    expect(status).toBe(200); expect(d.sicht).toBe('voll');
    const s = ids(d);
    for (const id of ['kontakt:k-1', 'firma:f-1', 'deal:d-1', 'mandat:mand-1', 'aufgabe:t-biz', 'aufgabe:t-priv', 'ziel:z-biz', 'ziel:z-priv', 'meilenstein:m-biz', 'termin:u-kunde', 'termin:u-kino', 'gesellschaft:g-1234']) expect(s.has(id), id).toBe(true);
    for (const id of ['aufgabe:t-geheim', 'aufgabe:t-geheim-kind', 'ziel:z-malin', 'meilenstein:m-malin', 'termin:u-malin']) expect(s.has(id), id).toBe(false);
    const notizen = (d.punkte ?? []).filter(p => p.art === 'notiz').map(p => p.titel);
    expect(notizen).toEqual(expect.arrayContaining(['Strategie', 'Zielbild', 'Urlaub']));
    expect(notizen).not.toContain('Tagebuch');
  });
  it('Partner (andere Person im Haushalt) sieht keine „nur ich“-Einträge, keine eigenen Ziele und keine privaten Notizen der anderen — aber die eigenen', async () => {
    const { d } = await hole({ 'x-make-user': 'malin' });
    const s = ids(d);
    expect(s.has('aufgabe:t-geheim')).toBe(true); expect(s.has('aufgabe:t-geheim-kind')).toBe(true);
    expect(s.has('ziel:z-malin')).toBe(true); expect(s.has('meilenstein:m-malin')).toBe(true);
    expect((d.punkte ?? []).some(p => p.titel === 'Tagebuch')).toBe(true);
    // …und Kevin umgekehrt nie (oben). Malin sieht Kevins private Aufgabe nicht als „nur ich“ — sie ist Privat-Space, kein „nur ich“.
    expect(s.has('aufgabe:t-priv')).toBe(true);
  });
  it('Rolle ohne Privatzugang (finanzRecht „business“) bekommt NICHTS aus dem Privat-Space', async () => {
    const { status, d } = await hole({ 'x-make-user': 'team1' });
    expect(status).toBe(200); expect(d.sicht).toBe('business');
    const s = ids(d);
    for (const id of ['aufgabe:t-priv', 'aufgabe:t-geheim', 'ziel:z-priv', 'ziel:z-malin', 'meilenstein:m-malin', 'termin:u-kino', 'termin:u-malin']) expect(s.has(id), id).toBe(false);
    expect((d.punkte ?? []).some(p => p.titel === 'Urlaub' || p.titel === 'Tagebuch')).toBe(false);
    for (const id of ['aufgabe:t-biz', 'deal:d-1', 'ziel:z-biz', 'termin:u-kunde', 'gesellschaft:g-1234']) expect(s.has(id), id).toBe(true);
  });
  it('Gesundheit wird nie ein Punkt (Art. 9): kein Gesundheitstermin, kein Gesundheits-Meilenstein/-Ziel, keine Gesundheitsnotiz', async () => {
    for (const wer of ['kevin', 'malin']) {
      const { d } = await hole({ 'x-make-user': wer });
      const s = ids(d);
      expect(s.has('termin:u-arzt')).toBe(false); expect(s.has('meilenstein:m-gesund')).toBe(false); expect(s.has('ziel:z-sport')).toBe(false);
      expect((d.punkte ?? []).some(p => /Gesundheit/.test(p.titel))).toBe(false);
    }
  });
  it('Art.-18-Eingeschränkte, Archiv und der M365-Spiegel ohne Link kommen nicht vor; Verknüpfungen nur zu Gelieferten', async () => {
    const { d } = await hole({ 'x-make-user': 'kevin' });
    const s = ids(d);
    expect(s.has('kontakt:k-2')).toBe(false); expect(s.has('firma:f-alt')).toBe(false); expect(s.has('termin:m365-0')).toBe(false);
    const deal = d.punkte!.find(p => p.id === 'deal:d-1')!;
    expect(deal.links).toEqual(expect.arrayContaining(['firma:f-1', 'kontakt:k-1']));
    expect(deal.links).not.toContain('kontakt:k-2');
    for (const p of d.punkte!) for (const l of p.links) expect(s.has(l), `${p.id} → ${l}`).toBe(true);
    // Notiz-Verweise ([[Zielbild]]) werden zu Verbindungen.
    const strategie = d.punkte!.find(p => p.titel === 'Strategie')!;
    expect(strategie.links.map(l => d.punkte!.find(p => p.id === l)?.titel)).toContain('Zielbild');
    expect(d.punkte!.find(p => p.id === 'aufgabe:t-biz')!.links).toEqual(expect.arrayContaining(['kontakt:k-1', 'deal:d-1']));
  });
});

describe('Route: nur Kennungen, keine Inhalte', () => {
  it('jeder Punkt trägt genau Kennung, Art, Bereich, Titel, Datum, Verknüpfungen — die Antwort keine Inhalte und keine Sicht-Merkmale', async () => {
    for (const wer of ['kevin', 'malin', 'team1']) {
      const { d, text } = await hole({ 'x-make-user': wer });
      expect(Object.keys(d).sort()).toEqual(['deckel', 'gekuerzt', 'jeArt', 'ok', 'punkte', 'sicht']);
      for (const p of d.punkte!) {
        expect(Object.keys(p).sort()).toEqual(['art', 'bereich', 'datum', 'id', 'links', 'titel']);
        expect(KUGEL_ARTEN).toContain(p.art); expect(p.bereich).toBe(ART_BEREICH[p.art]);
        expect(p.titel.length).toBeLessThanOrEqual(TITEL_MAX);
        expect(p.datum === null || /^\d{4}-\d{2}-\d{2}$/.test(p.datum)).toBe(true);
      }
      expect(text).not.toMatch(/INHALT-|example\.invalid|privat"|gehoert|"kennung"|Blutdruck/);
    }
  });
  it('jeder Punkt hat einen Weg aus lib/wege.ts — kein Datenpunkt ins Leere', async () => {
    const { d } = await hole({ 'x-make-user': 'kevin' });
    expect(d.punkte!.length).toBeGreaterThan(10);
    for (const p of d.punkte!) {
      const w = wegFuer(p);
      expect(w, p.id).toMatch(/^\/os\//); expect(w, p.id).not.toMatch(/undefined|null/);
    }
    const nach = (id: string) => wegFuer(d.punkte!.find(p => p.id === id)!);
    expect(nach('kontakt:k-1')).toContain('k-1'); expect(nach('termin:u-kunde')).toBe('/os/kalender?tag=2026-10-07&termin=u-kunde');
    expect(nach('gesellschaft:g-1234')).toBe('/os/unternehmen?g=g-1234'); expect(nach('ziel:z-biz')).toBe('/os/planung/ziel/z-biz');
    expect(wegFuer({ id: 'notiz:make/Make.Claude/01. Business/Strategie.md', art: 'notiz', datum: null })).toBe('/os/wissen?n=make%2FMake.Claude%2F01.+Business%2FStrategie.md');
  });
});

describe('Filterstelle und Deckel (rein)', () => {
  const roh = (n: number): RohPunkt[] => Array.from({ length: n }, (_, i) => ({
    art: 'aufgabe', kennung: `a${i}`, titel: `Aufgabe ${i}`,
    // a0 ist die älteste; a(n-1) die neueste.
    datum: new Date(Date.UTC(2020, 0, 1) + i * 86_400_000).toISOString(),
    links: i > 0 ? [punktId('aufgabe', `a${i - 1}`)] : [],
  }));
  it(`über ${PUNKTE_DECKEL} fallen die ÄLTESTEN weg und die Antwort sagt, wie viele — Verknüpfungen zu Weggefallenen verschwinden`, () => {
    const k = kugelPunkteFuer(roh(PUNKTE_DECKEL + 7), { person: 'kevin', privat: true });
    expect(k.punkte).toHaveLength(PUNKTE_DECKEL); expect(k.gekuerzt).toBe(7); expect(k.deckel).toBe(PUNKTE_DECKEL);
    const da = new Set(k.punkte.map(p => p.id));
    for (let i = 0; i < 7; i++) expect(da.has(`aufgabe:a${i}`)).toBe(false);
    expect(da.has(`aufgabe:a${PUNKTE_DECKEL + 6}`)).toBe(true);
    expect(k.punkte.find(p => p.id === 'aufgabe:a7')!.links).toEqual([]);
    expect(k.jeArt.aufgabe).toBe(PUNKTE_DECKEL);
    expect(kugelPunkteFuer(roh(5), { person: 'kevin', privat: true }).gekuerzt).toBe(0);
  });
  it('die eine Regel: privat nur mit Privatzugang, „gehört“ nur der Person (oder beiden); Titel gekürzt, doppelte einmal', () => {
    const r: RohPunkt[] = [
      { art: 'ziel', kennung: 'z1', titel: 'x'.repeat(200), privat: true },
      { art: 'ziel', kennung: 'z2', titel: 'Meins', gehoert: 'malin' },
      { art: 'ziel', kennung: 'z3', titel: 'Gemeinsam', gehoert: 'beide' },
      { art: 'ziel', kennung: 'z3', titel: 'Doppelt' },
    ];
    const kevin = kugelPunkteFuer(r, { person: 'kevin', privat: true }).punkte.map(p => p.id);
    expect(kevin).toEqual(expect.arrayContaining(['ziel:z1', 'ziel:z3'])); expect(kevin).not.toContain('ziel:z2'); expect(kevin).toHaveLength(2);
    expect(kugelPunkteFuer(r, { person: 'malin', privat: false }).punkte.map(p => p.id).sort()).toEqual(['ziel:z2', 'ziel:z3']);
    expect(kugelPunkteFuer(r, { person: 'kevin', privat: true }).punkte.find(p => p.id === 'ziel:z1')!.titel).toHaveLength(TITEL_MAX);
  });
  it('Nachbarn gelten in beide Richtungen', () => {
    const n = nachbarn([{ id: 'a:1', links: ['b:2'] }, { id: 'b:2', links: [] }, { id: 'c:3', links: ['x:9'] }]);
    expect(n.get('a:1')).toEqual(['b:2']); expect(n.get('b:2')).toEqual(['a:1']); expect(n.has('c:3')).toBe(false);
  });
});
