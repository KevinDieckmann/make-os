// ─── Eigene Ziele nur geteilt lesbar (08.10., Kevin, Phase 0) — Wächter „Sicht A bekommt nichts aus B“ ────────────────────
// Persönliche Ziele (`ziele-eigen--<person>`, samt Fokus) liest eine andere Person des Haushalts NUR, wenn die Eigentümerin sie
// ausdrücklich teilt (Konto › `teilt.ziele`, Vorgabe „nicht geteilt“, schalten nur sie selbst). Nicht geteilt ⇒ nichts davon in
// Ziele-Route, Lichtfäden, Seil, Meilensteinen (Altbestand), Kapazität, Verbindungsprüfung — auch keine Kennung, kein „Belegt“.
// Erfundene Personen (person-a = Inhaber, person-b = Mitglied, person-c = anderer Haushalt) und erfundene Ziele.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-eigene-ziele-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
// Nie Kevins echten Vault/Index berühren (gatherBrain, ZOE-Werkzeuge).
process.env.MAKE_VAULT_DIR = path.join(ordner, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
process.env.MAKE_OS_KEY = 'pruef-schluessel-eigene-ziele';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

vi.mock('@/lib/kalender/zoe-sicht-server', () => ({
  termineFuerZoe: async () => ({ stand: null, quelle: 'icloud', kemaris: [], kemarisStand: null, einstellungen: {}, termine: [] }),
}));

const GEHEIM = ['GEHEIM-ZIEL-B', 'GEHEIM-FOKUS-B', 'GEHEIM-MS-B', 'GEHEIM-MS-BIZ', 'zb-geheim', 'm-alt', 'm-alt-biz'];
type H = (r: Request) => Promise<Response>;
const kopf = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const anfrage = (url: string, p: string, method = 'GET', body?: unknown) => new Request(`http://test${url}`, { method, headers: kopf(p), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const ohneGeheim = (text: string, wo: string) => { for (const g of GEHEIM) expect(text, `${wo}: ${g}`).not.toContain(g); };

let ziele: { GET: H; PATCH: H; PUT: H };
let teilen: { PUT: H };
let ich: { GET: H };
let licht: { GET: H };
let ms: { GET: H; PATCH: H };
let seil: { GET: H };
let kapa: { GET: H };
let detail: { GET: H; POST: H };
let tasks: { GET: H; PATCH: H };
let anlegen: { POST: H };
let db: typeof import('@/lib/store/local-db');

const zieleTeilen = async (wer: string, liste: string[]) => {
  const r = await teilen.PUT(anfrage('/api/konto/teilen', wer, 'PUT', { ziele: liste }));
  expect(r.status).toBe(200);
};

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const k = (id: string, speicher: string, rolle: string, haushalt: string, teilt: Record<string, string[]> = { gesundheit: [] }) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt, haushalt });
  await db.saveJson('konten', { konten: [
    k('k1', 'person-a', 'inhaber', 'haus-t'),
    k('k2', 'person-b', 'mitglied', 'haus-t', { gesundheit: ['person-a'] }),
    k('k3', 'person-c', 'mitglied', 'anderes-haus'),
  ], einladungen: [] });
  await db.saveJson('ziele', { tag: [], woche: [], monat: [], quartal: [], jahr: [{ id: 'z-wir', titel: 'Gemeinsames Ziel', fortschritt: 10, space: 'business', rang: 1, termin: '2026-12-15' }], fokus: {} });
  await db.saveJson('ziele-eigen--person-b', { tag: [], woche: [], monat: [], quartal: [], jahr: [{ id: 'zb-geheim', titel: 'GEHEIM-ZIEL-B', fortschritt: 10, space: 'privat', rang: 1, termin: '2026-12-10', mandatId: 'm-gibt-es-nicht' }], fokus: { jahr: 'GEHEIM-FOKUS-B' } });
  // Altbestand: zwei Meilensteine hängen noch an person-b's eigenem Ziel (seit 07.10. entsteht so keiner mehr).
  await db.saveJson('meilensteine', { meilensteine: [
    { id: 'm-wir', titel: 'Gemeinsamer Meilenstein', faellig: '2026-11-20', zielId: 'z-wir', space: 'business', fortschritt: 0, erledigt: false },
    { id: 'm-alt', titel: 'GEHEIM-MS-B', faellig: '2026-11-25', zielId: 'zb-geheim', space: 'privat', fortschritt: 0, erledigt: false },
    { id: 'm-alt-biz', titel: 'GEHEIM-MS-BIZ', faellig: '2026-12-01', zielId: 'zb-geheim', space: 'business', bereich: 'business', fortschritt: 0, erledigt: false, aufwand: 20, mandatId: 'm-gibt-es-nicht' },
  ] });
  await db.saveJson('tasks', { projects: [], listen: [], tasks: [] });
  ziele = (await import('@/app/api/state/ziele/route')) as unknown as typeof ziele;
  teilen = (await import('@/app/api/konto/teilen/route')) as unknown as typeof teilen;
  ich = (await import('@/app/api/konto/ich/route')) as unknown as typeof ich;
  licht = (await import('@/app/api/lichtfaeden/route')) as unknown as typeof licht;
  ms = (await import('@/app/api/state/meilensteine/route')) as unknown as typeof ms;
  seil = (await import('@/app/api/seil/route')) as unknown as typeof seil;
  kapa = (await import('@/app/api/kapazitaet/route')) as unknown as typeof kapa;
  detail = (await import('@/app/api/planung/meilenstein/route')) as unknown as typeof detail;
  tasks = (await import('@/app/api/state/tasks/route')) as unknown as typeof tasks;
  anlegen = (await import('@/app/api/tasks/create/route')) as unknown as typeof anlegen;
}, 60_000);
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); vi.restoreAllMocks(); });

describe('Regel (rein)', () => {
  it('eigene immer; fremde nur geteilt UND im selben Haushalt; ohne Person nie', async () => {
    const { eigeneZieleLesbar, lesbareEigentuemer, verborgeneZielIds, meilensteineFuerBetrachter, zieleFuerBetrachter, GEMEINSAM } = await import('@/lib/planung/eigene-ziele-sicht');
    const konten = [
      { speicher: 'a', haushalt: 'h' }, { speicher: 'b', haushalt: 'h', teilt: { ziele: ['a', 'c'] } }, { speicher: 'c', haushalt: 'x' }, { speicher: 'd', haushalt: 'h' },
    ];
    expect(eigeneZieleLesbar(konten, 'a', 'a')).toBe(true);
    expect(eigeneZieleLesbar(konten, 'b', 'a')).toBe(true);
    expect(eigeneZieleLesbar(konten, 'b', 'd')).toBe(false); // nicht geteilt
    expect(eigeneZieleLesbar(konten, 'b', 'c')).toBe(false); // geteilt, aber anderer Haushalt
    expect(eigeneZieleLesbar(konten, 'a', 'b')).toBe(false); // Vorgabe: Feld fehlt = niemand
    expect(eigeneZieleLesbar(konten, 'b', null)).toBe(false); // Systemlauf
    expect([...lesbareEigentuemer(konten, 'a')].sort()).toEqual(['a', 'b']);
    expect(lesbareEigentuemer(konten, null).size).toBe(0);
    const z = [{ id: 'g', person: GEMEINSAM }, { id: 'ea', person: 'a' }, { id: 'eb', person: 'b' }, { id: 'ed', person: 'd' }];
    expect(zieleFuerBetrachter(z, lesbareEigentuemer(konten, 'd')).map(x => x.id)).toEqual(['g', 'ed']);
    const verborgen = verborgeneZielIds(z, lesbareEigentuemer(konten, 'd'));
    expect([...verborgen].sort()).toEqual(['ea', 'eb']);
    expect(meilensteineFuerBetrachter([{ id: 'm1', zielId: 'g' }, { id: 'm2', zielId: 'eb' }, { id: 'm3' }], verborgen).map(m => m.id)).toEqual(['m1', 'm3']);
  });
});

describe('nicht geteilt (Vorgabe) — person-a bekommt nichts aus den eigenen Zielen von person-b', () => {
  it('Ziele-Route: ?fuer=person-b → 403 ohne Inhalt; Schreiben → 403; die Eigentümerin liest selbst', async () => {
    const r = await ziele.GET(anfrage('/api/state/ziele?fuer=person-b', 'person-a'));
    expect(r.status).toBe(403);
    ohneGeheim(await r.text(), 'GET ?fuer');
    expect((await ziele.PATCH(anfrage('/api/state/ziele', 'person-a', 'PATCH', { horizont: 'jahr', fuer: 'person-b', ops: [{ op: 'delete', id: 'zb-geheim' }] }))).status).toBe(403);
    expect((await ziele.PUT(anfrage('/api/state/ziele', 'person-a', 'PUT', { horizont: 'jahr', fokus: 'x', fuer: 'person-b' }))).status).toBe(403);
    // Der gemeinsame Bestand bleibt für alle lesbar und nennt das fremde eigene Ziel nicht.
    const wir = await ziele.GET(anfrage('/api/state/ziele', 'person-a'));
    expect(wir.status).toBe(200);
    ohneGeheim(await wir.text(), 'GET wir');
    const selbst = await (await ziele.GET(anfrage('/api/state/ziele?fuer=ich', 'person-b'))).text();
    expect(selbst).toContain('GEHEIM-ZIEL-B');
    expect(selbst).toContain('GEHEIM-FOKUS-B');
  });

  it('Konto: „teilt nicht mit dir“', async () => {
    const d = await (await ich.GET(anfrage('/api/konto/ich', 'person-a'))).json() as { andere: { speicher: string; teiltZieleMitMir: boolean }[] };
    expect(d.andere.find(a => a.speicher === 'person-b')?.teiltZieleMitMir).toBe(false);
  });

  it('Lichtfäden: kein Titel, keine Kennung, auch kein „Belegt“ aus dem eigenen Ziel und seinen Meilensteinen', async () => {
    for (const w of ['gesamt', 'space:privat', 'space:business', 'thema:privat:planung', 'thema:business:planung']) {
      const r = await licht.GET(anfrage(`/api/lichtfaeden?von=2026-10-01&bis=2027-03-31&wurzel=${w}&person=alle`, 'person-a'));
      expect(r.status).toBe(200);
      const text = await r.text();
      ohneGeheim(text, w);
      if (w === 'space:privat') expect((JSON.parse(text) as { ansicht: { buendel: { name: string }[] } }).ansicht.buendel.some(b => b.name === 'Belegt')).toBe(false);
    }
    // Gegenprobe: die Eigentümerin sieht ihre Stränge mit Titel.
    const b = await (await licht.GET(anfrage('/api/lichtfaeden?von=2026-10-01&bis=2027-03-31&wurzel=space:privat&person=alle', 'person-b'))).text();
    expect(b).toContain('GEHEIM-ZIEL-B');
  });

  it('Meilensteine (Altbestand): person-a bekommt sie nicht und kann sie nicht ändern (403); die Eigentümerin schon', async () => {
    const r = await ms.GET(anfrage('/api/state/meilensteine', 'person-a'));
    const text = await r.text();
    ohneGeheim(text, 'meilensteine GET');
    expect(text).toContain('Gemeinsamer Meilenstein');
    expect((await ms.PATCH(anfrage('/api/state/meilensteine', 'person-a', 'PATCH', { ops: [{ op: 'teil', id: 'm-alt', felder: { titel: 'überschrieben' } }] }))).status).toBe(403);
    expect((await ms.PATCH(anfrage('/api/state/meilensteine', 'person-a', 'PATCH', { ops: [{ op: 'delete', id: 'm-alt-biz' }] }))).status).toBe(403);
    expect((await db.loadJson<{ meilensteine: { id: string; titel: string }[] }>('meilensteine'))!.meilensteine.map(m => m.titel)).toEqual(['Gemeinsamer Meilenstein', 'GEHEIM-MS-B', 'GEHEIM-MS-BIZ']);
    expect(await (await ms.GET(anfrage('/api/state/meilensteine', 'person-b'))).text()).toContain('GEHEIM-MS-B');
  });

  it('Seil: nichts aus dem eigenen Ziel', async () => {
    const r = await seil.GET(anfrage('/api/seil?ebene=jahr&bereich=alle&von=2026-09-01&bis=2027-12-31', 'person-a'));
    expect(r.status).toBe(200);
    ohneGeheim(await r.text(), 'seil');
  });

  it('Kapazität: den Meilenstein am fremden eigenen Ziel gibt es für person-a nicht — kein Titel, keine Kennung (Gegenprüfung 08.10.)', async () => {
    const r = await kapa.GET(anfrage('/api/kapazitaet', 'person-a'));
    expect(r.status).toBe(200);
    ohneGeheim(await r.text(), 'kapazität person-a');
    expect(await (await kapa.GET(anfrage('/api/kapazitaet', 'person-b'))).text()).toContain('GEHEIM-MS-BIZ');
    // Pure Regel: Posten weg (auch aus „kritisch“ und dem Wochenplan), die Summen bleiben.
    const { ohneVerborgenePosten } = await import('@/lib/kapazitaet/modell');
    const posten = { art: 'meilenstein' as const, id: 'm-x', titel: 'X', personen: [], status: 'machbar' as const, text: '' };
    const stand = { heute: '2026-10-08', wochen: [], personen: [], team: { wochen: [], kopf: { faktor: 1, personen: 0, tage: 0 } }, posten: [posten], zuweisungen: [],
      kennzahlen: { kritisch: [posten] }, wochenPlan: { woche: '2026-10-05', ab: '2026-10-08', personen: [{ id: 'p', quelle: 'konto' as const, verfuegbar: 10, geplant: 5, gebunden: 0, posten: [{ art: 'meilenstein' as const, id: 'm-x', stunden: 5 }], zuweisungen: [] }] } };
    const aus = ohneVerborgenePosten(stand as unknown as Parameters<typeof ohneVerborgenePosten>[0], new Set(['meilenstein:m-x']));
    expect(JSON.stringify(aus)).not.toContain('m-x');
    expect(aus.wochenPlan!.personen[0].geplant).toBe(5);
  });

  it('Meilenstein-Detail (GET/POST /api/planung/meilenstein): für person-a 404 ohne Inhalt, auch kein Verlauf schreiben; die Eigentümerin öffnet ihn', async () => {
    const g = await detail.GET(anfrage('/api/planung/meilenstein?id=m-alt', 'person-a'));
    expect(g.status).toBe(404);
    ohneGeheim(await g.text(), 'detail GET');
    const p = await detail.POST(anfrage('/api/planung/meilenstein', 'person-a', 'POST', { id: 'm-alt', aktion: { art: 'senden', text: 'von außen' } }));
    expect(p.status).toBe(404);
    expect(await db.loadJson('meilenstein-raum--haus-t')).toBeNull();
    // Die Eigentümerin öffnet ihn — dabei entsteht (lazy) seine Aufgaben-Liste mit dem Titel (für den Aufgaben-Test unten).
    const b = await detail.GET(anfrage('/api/planung/meilenstein?id=m-alt', 'person-b'));
    expect(b.status).toBe(200);
    expect(await b.text()).toContain('GEHEIM-MS-B');
  });

  it('Aufgaben: die Liste des verborgenen Meilensteins heißt für person-a (und den Systemlauf) nur neutral; ändern/löschen 404', async () => {
    const { LISTE_NICHT_GETEILT } = await import('@/lib/planung/eigene-ziele-sicht');
    const roh = (await db.loadJson<{ listen: { id: string; titel: string }[] }>('tasks'))!;
    const liste = roh.listen.find(l => l.titel === 'GEHEIM-MS-B');
    expect(liste).toBeTruthy();
    const a = await tasks.GET(anfrage('/api/state/tasks', 'person-a'));
    expect(a.status).toBe(200);
    const text = await a.text();
    expect(text).not.toContain('GEHEIM-MS-B');
    expect(text).toContain(LISTE_NICHT_GETEILT);
    expect(await (await tasks.GET(anfrage('/api/state/tasks', 'person-b'))).text()).toContain('GEHEIM-MS-B');
    const { ladeAufgabenSicht } = await import('@/lib/aufgaben/sicht');
    expect(JSON.stringify(await ladeAufgabenSicht('person-a'))).not.toContain('GEHEIM-MS-B');
    expect(JSON.stringify(await ladeAufgabenSicht(null))).not.toContain('GEHEIM-MS-B');
    for (const op of [{ op: 'delete', id: liste!.id }, { op: 'upsert', eintrag: { ...liste, titel: LISTE_NICHT_GETEILT } }]) {
      expect((await tasks.PATCH(anfrage('/api/state/tasks', 'person-a', 'PATCH', { struktur: { listen: [op] } }))).status).toBe(404);
    }
    expect((await db.loadJson<{ listen: { id: string; titel: string }[] }>('tasks'))!.listen.find(l => l.id === liste!.id)?.titel).toBe('GEHEIM-MS-B');
    // Eine Aufgabe am verborgenen Meilenstein anlegen: „gibt es nicht“.
    const c = await anlegen.POST(anfrage('/api/tasks/create', 'person-a', 'POST', { title: 'Aufgabe von außen', meilensteinId: 'm-alt' }));
    expect(c.status).toBe(404);
  });

  it('Kalender-Fristen (Kalender, Glocke, Heute): ohne den Meilenstein — auch im Systemlauf', async () => {
    const { fristenLesen } = await import('@/lib/kalender/fristen-server');
    ohneGeheim(JSON.stringify(await fristenLesen('2026-10-01', '2027-01-31', '2026-10-08', 'person-a')), 'fristen person-a');
    ohneGeheim(JSON.stringify(await fristenLesen('2026-10-01', '2027-01-31', '2026-10-08', null)), 'fristen system');
    expect(JSON.stringify(await fristenLesen('2026-10-01', '2027-01-31', '2026-10-08', 'person-b'))).toContain('GEHEIM-MS-B');
  });

  it('ZOE: Kontext (gatherBrain), setze_meilenstein + Vorschau finden ihn für person-a nicht und nennen ihn nicht', async () => {
    const { gatherBrain } = await import('@/lib/brain');
    ohneGeheim(JSON.stringify((await gatherBrain('2026-10-08', 'person-a')).meilensteine), 'brain person-a');
    expect(JSON.stringify((await gatherBrain('2026-10-08', 'person-b')).meilensteine)).toContain('GEHEIM-MS-BIZ');
    const { WERKZEUGE } = await import('@/lib/zoe/werkzeuge');
    const t = await WERKZEUGE.setze_meilenstein.lauf({ titel: 'GEHEIM', fortschritt: 50 }, 'http://test', 'person-a');
    expect(t).toMatch(/Kein Meilenstein/);
    ohneGeheim(t, 'setze_meilenstein');
    expect((await db.loadJson<{ meilensteine: { id: string; fortschritt: number }[] }>('meilensteine'))!.meilensteine.find(m => m.id === 'm-alt')?.fortschritt).toBe(0);
    const { vorschauVon } = await import('@/lib/zoe/register');
    ohneGeheim(JSON.stringify(await vorschauVon('setze_meilenstein', { titel: 'GEHEIM' }, 'person-a')), 'vorschau person-a');
    expect(JSON.stringify(await vorschauVon('setze_meilenstein', { titel: 'GEHEIM-MS-B' }, 'person-b'))).toContain('GEHEIM-MS-B');
  });

  it('Business-Index (an alle im Haushalt): der Meilenstein zählt mit, aber ohne Titel und Kennung; Schilde und Gesundheit ohne ihn', async () => {
    const { ladeRoh } = await import('@/lib/business/speicher');
    const roh = await ladeRoh('2026-10-08');
    ohneGeheim(JSON.stringify(roh.meilensteine), 'business');
    expect(roh.meilensteine.filter(m => !m.titel).length).toBe(2);
    const { computeShields } = await import('@/lib/risk');
    ohneGeheim(JSON.stringify(await computeShields('2026-12-31', 'person-a')), 'schilde person-a');
    ohneGeheim(JSON.stringify(await computeShields('2026-12-31', null)), 'schilde system');
    expect(JSON.stringify(await computeShields('2026-12-31', 'person-b'))).toContain('GEHEIM-MS-B');
    const { ladeGesundheitBestand } = await import('@/lib/gesundheit/speicher');
    ohneGeheim(JSON.stringify((await ladeGesundheitBestand('person-a', '2026-10-08')).meilensteine), 'gesundheit person-a');
  });

  it('Verbindungsprüfung: Befunde/Reparatur nur über geteilte und EIGENE Ziele — Meilensteine am fremden Ziel gelten nicht als tot', async () => {
    const [{ ladeVerbindungsBestaende }, { verbindungenPruefen }] = await Promise.all([import('@/lib/crm/verbindungen-laden'), import('@/lib/crm/verbindungen')]);
    const fuerA = verbindungenPruefen(await ladeVerbindungsBestaende('2026-10-08', 'person-a'));
    ohneGeheim(JSON.stringify(fuerA), 'verbindungen person-a');
    expect(fuerA.some(b => b.id === 'meilenstein-ziel-tot')).toBe(false);
    const fuerB = verbindungenPruefen(await ladeVerbindungsBestaende('2026-10-08', 'person-b'));
    expect(JSON.stringify(fuerB.find(b => b.id === 'ziel-mandat-tot'))).toContain('zb-geheim');
    // Gegenprüfung 08.10.: auch der tote Mandats-Bezug des verborgenen Meilensteins wird person-a weder gemeldet noch repariert.
    expect(fuerA.some(b => b.id === 'meilenstein-mandat-tot')).toBe(false);
    expect(JSON.stringify(fuerB.find(b => b.id === 'meilenstein-mandat-tot'))).toContain('m-alt-biz');
    const { meilensteinDateiBereinigen } = await import('@/lib/crm/verbindungen-planung');
    const datei = (await db.loadJson<{ meilensteine: unknown[] }>('meilensteine'))!;
    const lebend = { mandate: new Set<string>(), firmen: new Set<string>() };
    expect(meilensteinDateiBereinigen(datei, lebend, new Set(['meilenstein-mandat-tot']), new Set(['m-alt-biz'])).anzahl).toBe(0);
    expect(meilensteinDateiBereinigen(datei, lebend, new Set(['meilenstein-mandat-tot'])).anzahl).toBe(1);
  });
});

describe('geteilt — lesen ja, schreiben nie; Zurücknehmen wirkt sofort', () => {
  it('person-b teilt mit person-a: Ziele-Route liefert (nur lesen); Gesundheits-Freigabe bleibt unberührt', async () => {
    await zieleTeilen('person-b', ['person-a', 'person-c', 'person-b', 'unbekannt']);
    const konten = await db.loadJson<{ konten: { speicher: string; teilt: { gesundheit: string[]; ziele?: string[] } }[] }>('konten');
    const b = konten!.konten.find(k => k.speicher === 'person-b')!;
    expect(b.teilt).toEqual({ gesundheit: ['person-a'], ziele: ['person-a', 'person-c'] });
    const r = await ziele.GET(anfrage('/api/state/ziele?fuer=person-b', 'person-a'));
    expect(r.status).toBe(200);
    const d = await r.json() as { darfSchreiben: boolean; jahr: { titel: string }[]; fokus: Record<string, string> };
    expect(d.darfSchreiben).toBe(false);
    expect(d.jahr.map(z => z.titel)).toEqual(['GEHEIM-ZIEL-B']);
    expect(d.fokus.jahr).toBe('GEHEIM-FOKUS-B');
    expect((await ziele.PATCH(anfrage('/api/state/ziele', 'person-a', 'PATCH', { horizont: 'jahr', fuer: 'person-b', ops: [{ op: 'delete', id: 'zb-geheim' }] }))).status).toBe(403);
    const di = await (await ich.GET(anfrage('/api/konto/ich', 'person-a'))).json() as { andere: { speicher: string; teiltZieleMitMir: boolean }[] };
    expect(di.andere.find(a => a.speicher === 'person-b')?.teiltZieleMitMir).toBe(true);
    // Geteilt mit person-c, aber anderer Haushalt: kommt nicht einmal an die Route.
    expect((await ziele.GET(anfrage('/api/state/ziele?fuer=person-b', 'person-c'))).status).toBe(403);
  });

  it('Meilensteine am geteilten Ziel sind lesbar; die Sammel-Ansicht bleibt streng („Belegt“, kein Titel)', async () => {
    expect(await (await ms.GET(anfrage('/api/state/meilensteine', 'person-a'))).text()).toContain('GEHEIM-MS-B');
    const text = await (await licht.GET(anfrage('/api/lichtfaeden?von=2026-10-01&bis=2027-03-31&wurzel=space:privat&person=alle', 'person-a'))).text();
    expect(text).not.toContain('GEHEIM-ZIEL-B');
    expect((JSON.parse(text) as { ansicht: { buendel: { name: string }[] } }).ansicht.buendel.some(b => b.name === 'Belegt')).toBe(true);
  });

  it('nur die Eigentümerin schaltet: person-a kann die Freigabe von person-b nicht setzen; Zurücknehmen → wieder 403', async () => {
    await zieleTeilen('person-a', ['person-b']); // ändert nur person-a's eigene Freigabe
    const konten = await db.loadJson<{ konten: { speicher: string; teilt: { ziele?: string[] } }[] }>('konten');
    expect(konten!.konten.find(k => k.speicher === 'person-b')!.teilt.ziele).toEqual(['person-a', 'person-c']);
    await zieleTeilen('person-b', []);
    const r = await ziele.GET(anfrage('/api/state/ziele?fuer=person-b', 'person-a'));
    expect(r.status).toBe(403);
    ohneGeheim(await r.text(), 'nach Zurücknehmen');
    expect((await teilen.PUT(anfrage('/api/konto/teilen', 'person-b', 'PUT', {}))).status).toBe(400);
  });
});
