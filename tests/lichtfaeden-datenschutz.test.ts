// ─── Lichtfäden v2 — Datenschutz der Route (Review 03.10., erfundene Daten) ──
// „nur ich“ vererbt sich über die ganze Unteraufgaben-Kette (lib/aufgaben/sicht.ts `darfSehen`) — die Lichtfäden müssen
// dieselbe Regel anwenden (`nurIchBesitzer`): Unteraufgaben und Enkel einer privaten Aufgabe der Partnerin erscheinen
// nur als „Belegt“; eine Altaufgabe „nur ich“ ohne Anlegerin sieht NIEMAND; Familie „nur ich“ ebenso. Geprüft wird die
// ganze Antwort (Bündel, Brotkrumen, Markierungen, Engstellen samt „top“, Text) — und mit eingeschaltetem Zwischenspeicher
// (MAKE_OS_MEMO=an), dass sich die Sichten von Kevin und Malin nie vermischen.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-lichtfaeden-ds-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-lichtfaeden-ds';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

vi.mock('@/lib/kalender/zoe-sicht-server', () => ({
  termineFuerZoe: async () => ({ stand: null, quelle: 'icloud', kemaris: [], kemarisStand: null, einstellungen: {}, termine: [] }),
}));

type Antwort = { ok: boolean; ansicht: { buendel: { id: string; name: string; anzahl: number }[] }; engstellen: { top: { titel: string }[] }[] };
let route: { GET: (r: Request) => Promise<Response> };
let sicht: typeof import('@/lib/aufgaben/sicht');
const get = async (person: string, q: string) => {
  const r = await route.GET(new Request(`http://test/api/lichtfaeden?von=2026-10-01&bis=2027-03-31&${q}`, { headers: { 'x-make-user': person } }));
  expect(r.status).toBe(200);
  return { roh: await r.text(), d: null as unknown as Antwort };
};
const json = async (person: string, q: string) => { const { roh } = await get(person, q); return { roh, d: JSON.parse(roh) as Antwort }; };

/** Titel und Kennungen, die Kevin (der Partner) nie sehen darf. */
const MALINS_GEHEIMNISSE = ['Spanisch B1', 'Vokabeltest A2', 'zm-spanisch', 'm-vokabeln', 'Geschenk für Kevin', 'Geschenkpapier', 'Schleife binden', 'Ring abholen', 'Jahrestag heimlich', 'Überraschung planen', 't-geheim', 't-kind', 't-enkel', 'v-geheim', 'd-geheim', 'tag-geheim'];
/** Eine Altaufgabe „nur ich“ ohne Anlegerin — niemand darf sie sehen. */
const ALTLAST = ['Altes Tagebuch', 't-alt'];

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  sicht = await import('@/lib/aufgaben/sicht');
  const { meilensteinListeId } = await import('@/lib/planung/meilenstein-aufgaben');
  const k = (id: string, speicher: string, rolle: string, name: string) => ({ id, speicher, email: `${speicher}@test`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' });
  await db.saveJson('konten', { konten: [k('k1', 'kevin', 'inhaber', 'Kevin'), k('k2', 'malin', 'mitglied', 'Malin')], einladungen: [] });
  // Ziel und Meilenstein im Business: Malins private Aufgabe liegt in der Meilenstein-Liste (Unteraufgaben erben die Liste),
  // die Meilenstein-Ebene ist eine Blatt-Ebene (jeder Strang ein Faden mit Titel) — dort MUSS die Maskierung greifen.
  await db.saveJson('ziele', { tag: [], woche: [], monat: [], quartal: [], jahr: [{ id: 'z-1', titel: 'Gemeinsames Ziel', fortschritt: 0, space: 'business', rang: 1 }], fokus: {} });
  await db.saveJson('meilensteine', { meilensteine: [{ id: 'm-1', titel: 'Gemeinsamer Meilenstein', faellig: '2026-11-20', zielId: 'z-1', space: 'business', fortschritt: 0, erledigt: false }] });
  const t = (id: string, x: Record<string, unknown>) => ({ id, projectId: 'p1', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: '2026-09-01', updatedAt: '2026-09-01', spaceId: 'privat', ...x });
  const woche = '2026-11-10';
  const liste = meilensteinListeId('m-1');
  await db.saveJson('tasks', { projects: [{ id: 'pm-kdv', title: 'Meilensteine', spaceId: 'kdv' }], listen: [{ id: liste, projektId: 'pm-kdv', titel: 'Gemeinsamer Meilenstein', sortOrder: 0 }], tasks: [
    // Sichtbar für beide — mit Malins Privatem zusammen eine Engstelle in derselben Woche.
    t('t-a', { dueDate: woche, title: 'Wohnung streichen' }),
    t('t-b', { dueDate: woche, title: 'Steuer sortieren' }),
    t('t-c', { dueDate: woche, title: 'Reifen wechseln' }),
    // Malins private Aufgabe, ihre Unteraufgabe (OHNE eigene Markierung, Kevin zugewiesen) und ein Enkel — dringend, damit
    // sie in der Engstellen-Liste „top“ vorn stehen.
    t('t-geheim', { dueDate: woche, title: 'Geschenk für Kevin', assignee: 'malin', angelegtVon: 'malin', sichtbarkeit: 'nur-ich', spaceId: 'kdv', projectId: 'pm-kdv', listeId: liste, priority: 'critical' }),
    t('t-kind', { dueDate: woche, title: 'Geschenkpapier besorgen', parentId: 't-geheim', spaceId: 'kdv', projectId: 'pm-kdv', listeId: liste, priority: 'critical' }),
    t('t-enkel', { dueDate: woche, title: 'Schleife binden', parentId: 't-kind', assignee: 'malin', spaceId: 'kdv', projectId: 'pm-kdv', listeId: liste, priority: 'critical' }),
    // Altaufgabe „nur ich“ ohne Anlegerin und ohne Verantwortliche.
    t('t-alt', { dueDate: woche, title: 'Altes Tagebuch', assignee: undefined, sichtbarkeit: 'nur-ich', priority: 'critical' }),
  ] });
  // Malins EIGENES Ziel (ziele-eigen--malin) mit Frist und Meilenstein — für Kevin privat (Praxis-Fund F4).
  await db.saveJson('ziele-eigen--malin', { tag: [], woche: [], monat: [], quartal: [], jahr: [{ id: 'zm-spanisch', titel: 'Spanisch B1', fortschritt: 10, space: 'privat', rang: 1, termin: '2026-12-15' }], fokus: {} });
  const ms = (await db.loadJson<{ meilensteine: unknown[] }>('meilensteine'))!;
  await db.saveJson('meilensteine', { meilensteine: [...ms.meilensteine, { id: 'm-vokabeln', titel: 'Vokabeltest A2', faellig: '2026-11-25', zielId: 'zm-spanisch', space: 'privat', fortschritt: 0, erledigt: false }] });
  await db.saveJson('familie--test-haus', {
    menschen: [],
    tage: [{ id: 'tag-geheim', von: 'malin', am: '2026-09-01', sichtbarkeit: 'nur-ich', titel: 'Jahrestag heimlich', art: 'jahrestag', datum: '2026-11-11', erledigt: [] }],
    dates: [{ id: 'd-geheim', von: 'malin', am: '2026-09-01', sichtbarkeit: 'nur-ich', titel: 'Überraschung planen', ideeId: null, datum: '2026-11-12', planer: 'malin', status: 'geplant', neuesErlebnis: false, nachklang: [] }],
    vereinbarungen: [{ id: 'v-geheim', von: 'malin', am: '2026-09-01', sichtbarkeit: 'nur-ich', text: 'Ring abholen', wer: 'beide', faellig: '2026-11-13', status: 'offen' }],
  });
  route = (await import('@/app/api/lichtfaeden/route')) as unknown as typeof route;
});
afterAll(() => { delete process.env.MAKE_OS_MEMO; rmSync(ordner, { recursive: true, force: true }); vi.restoreAllMocks(); });

const EBENEN = ['wurzel=gesamt&person=alle', 'wurzel=space:privat&person=alle', 'wurzel=space:business&person=alle', 'wurzel=thema:business:planung&person=alle', 'wurzel=thema:privat:planung&person=alle', 'wurzel=thema:privat:beziehung&person=alle', 'wurzel=ziel:z-1&person=alle', 'wurzel=ms:m-1&person=alle', 'wurzel=space:privat&person=malin'];

describe('„nur ich“ vererbt sich — die Partnerin sieht keine Titel, Kennungen oder Links', () => {
  it('Regel: nurIchBesitzer entspricht darfSehen für jede Person', () => {
    const l = [
      { id: 'a', sichtbarkeit: 'nur-ich' as const, angelegtVon: 'malin' },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'b', sichtbarkeit: 'nur-ich' as const, angelegtVon: 'kevin' },
      { id: 'd', sichtbarkeit: 'nur-ich' as const },
      { id: 'e', parentId: 'x' },
      { id: 'f', parentId: 'g' }, { id: 'g', parentId: 'f' },
    ];
    const nachId = new Map(l.map(x => [x.id, x]));
    const { darfSehen, nurIchBesitzer } = sicht;
    for (const x of l) for (const p of ['kevin', 'malin']) {
      const b = nurIchBesitzer(x, nachId);
      expect(darfSehen(x, p, nachId)).toBe(b === undefined || b === p);
    }
    expect(nurIchBesitzer(l[1], nachId)).toBe('malin');
    expect(nurIchBesitzer(l[2], nachId)).toBeNull();
    expect(nurIchBesitzer(l[3], nachId)).toBeNull();
    expect(nurIchBesitzer(l[4], nachId)).toBeUndefined();
    expect(nurIchBesitzer(l[5], nachId)).toBeUndefined();
  });

  it('als Kevin: auf keiner Ebene ein Titel/eine Kennung von Malins Privatem oder der Altaufgabe — Engstellen inklusive', async () => {
    let engstellen = 0;
    for (const q of EBENEN) {
      const { roh, d } = await json('kevin', q);
      for (const geheim of [...MALINS_GEHEIMNISSE, ...ALTLAST]) expect(roh, `${q}: ${geheim}`).not.toContain(geheim);
      engstellen += d.engstellen.length;
    }
    expect(engstellen).toBeGreaterThan(0); // die Engstellen-Liste („top“) war wirklich im Spiel
    // Ohne Maskierung stünden Malins dringende Aufgaben in „top“ ganz vorn — bei ihr selbst tun sie das.
    expect((await json('malin', 'wurzel=gesamt&person=alle')).d.engstellen.some(e => e.top.some(x => x.titel === 'Geschenkpapier besorgen'))).toBe(true);
    // Business: Aufgabe, Kind, Enkel als anonymes Gewicht; die Altaufgabe gar nicht. Familie „nur ich“ der Partnerin kommt
    // gar nicht erst an (`sichtFuer` je Betrachter) — im Privat-Space also kein „Belegt“.
    expect((await json('kevin', 'wurzel=space:business&person=alle')).d.ansicht.buendel.find(b => b.name === 'Belegt')?.anzahl).toBe(3);
    // Malins eigenes Ziel: Frist und Meilenstein nur als „Belegt“ (Last bleibt), kein Knoten, kein Link, keine Markierung.
    expect((await json('kevin', 'wurzel=space:privat&person=alle')).d.ansicht.buendel.find(b => b.name === 'Belegt')?.anzahl).toBe(2);
    const r = await route.GET(new Request('http://test/api/lichtfaeden?von=2026-10-01&bis=2027-03-31&wurzel=ziel:zm-spanisch', { headers: { 'x-make-user': 'kevin' } }));
    expect(r.status).toBe(404);
    // Die Meilenstein-Ebene (Blatt) zeigt nur den Meilenstein selbst.
    expect((await json('kevin', 'wurzel=ms:m-1&person=alle')).d.ansicht.buendel.map(b => b.name)).toEqual(['Gemeinsamer Meilenstein']);
  });

  it('als Malin: ihre eigenen privaten Stränge mit Titel — die Altaufgabe ohne Anlegerin auch für sie nicht', async () => {
    const roh = (await Promise.all(EBENEN.slice(0, 8).map(q => get('malin', q)))).map(r => r.roh).join('\n');
    for (const eigen of ['Spanisch B1', 'Vokabeltest A2', 'Geschenk für Kevin', 'Geschenkpapier besorgen', 'Schleife binden', 'Jahrestag heimlich', 'Überraschung planen', 'Ring abholen']) expect(roh).toContain(eigen);
    for (const alt of ALTLAST) expect(roh).not.toContain(alt);
  });
});

describe('Zwischenspeicher an (MAKE_OS_MEMO=an): keine Vermischung der Sichten', () => {
  it('erst Kevin, dann Malin, dann wieder Kevin — jede Person bekommt ihre eigene Sicht', async () => {
    process.env.MAKE_OS_MEMO = 'an';
    try {
      const q = 'wurzel=ms:m-1&person=alle';
      const k1 = (await get('kevin', q)).roh;
      const m = (await get('malin', q)).roh;
      const k2 = (await get('kevin', q)).roh;
      for (const geheim of MALINS_GEHEIMNISSE) { expect(k1).not.toContain(geheim); expect(k2).not.toContain(geheim); }
      expect(m).toContain('Geschenkpapier besorgen');
      expect(k2).toBe(k1);
      const m2 = (await get('malin', 'wurzel=thema:privat:beziehung&person=alle')).roh;
      const k3 = (await get('kevin', 'wurzel=thema:privat:beziehung&person=alle')).roh;
      expect(m2).toContain('Ring abholen');
      expect(k3).not.toContain('Ring abholen');
    } finally { delete process.env.MAKE_OS_MEMO; }
  });
});
