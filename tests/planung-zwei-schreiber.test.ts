// ─── Ziele & Meilensteine zu zweit: Einzeländerungen mit Stand (28.09.) ──────
// Prüfbericht 28.09.: usePlanung schrieb per PUT den GANZEN Horizont — wer zuletzt
// speicherte, löschte still das Ziel, das der andere inzwischen angelegt hatte.
// Jetzt: je Ziel eine Änderung mit Stand (lib/make-one/liste-stand.ts → PATCH
// /api/state/ziele), die Kaskade läuft in derselben Sperre. Zwei Schreiber, keiner
// verliert etwas. Eigener Datenordner, erfundene Ziele.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { haushaltKonten } from './fixtures/konten';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ListenSchreiber, absichten, type MitStand } from '@/lib/make-one/liste-stand';
import type { Meilenstein, Ziel } from '@/lib/planung/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-planung-zwei-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-pz';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Handler = (r: Request) => Promise<Response>;
type Mod = { GET: Handler; PATCH: Handler; PUT: Handler };
let ziele: Mod, meilensteine: Mod;
const kopf = { 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-pz', 'x-make-person': 'kevin' };

/** fetch, der direkt die Route aufruft — so arbeitet der Schreiber wie im Browser. */
const netz = (mod: () => Mod) => (async (url: RequestInfo | URL, init?: RequestInit) =>
  mod()[(init?.method ?? 'GET') as 'PATCH'](new Request(`http://test${String(url)}`, { ...init, headers: kopf }))) as typeof fetch;

type ZZ = Ziel & MitStand;
type MZ = Meilenstein & MitStand;
const ladeZiele = async (h = 'jahr') => ((await (await ziele.GET(new Request('http://test/api/state/ziele', { headers: kopf }))).json()) as Record<string, ZZ[]>)[h];
const ladeMs = async () => ((await (await meilensteine.GET(new Request('http://test/api/state/meilensteine', { headers: kopf }))).json()) as { meilensteine: MZ[] }).meilensteine;
const schreiber = (h = 'jahr') => new ListenSchreiber<ZZ>({ pfad: '/api/state/ziele', koerper: ops => ({ horizont: h, ops }), liste: d => (Array.isArray(d[h]) ? d[h] as ZZ[] : null), fetchImpl: netz(() => ziele) });

beforeAll(async () => {
  ziele = (await import('@/app/api/state/ziele/route')) as unknown as Mod;
  meilensteine = (await import('@/app/api/state/meilensteine/route')) as unknown as Mod;
  await haushaltKonten(await import('@/lib/store/local-db'));
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Ziele: zwei Schreiber, keiner verliert etwas', () => {
  it('Kevin legt an, Malin ändert gleichzeitig ein anderes Ziel — beide Änderungen bleiben', async () => {
    const start = schreiber();
    start.kenne(await ladeZiele());
    start.aendern([], [{ id: 'z-basis', titel: 'Basis-Ziel', fortschritt: 0 }, { id: 'z-zwei', titel: 'Zweites Ziel', fortschritt: 0 }]);
    expect((await start.senden()).ok).toBe(true);

    // Beide laden denselben Stand …
    const kevin = schreiber(); const malin = schreiber();
    const stand = await ladeZiele();
    kevin.kenne(stand); malin.kenne(stand);
    // … Kevin legt ein neues Ziel an, Malin setzt den Fortschritt am Basis-Ziel.
    kevin.aendern(stand, [...stand, { id: 'z-kevin', titel: 'Kevins neues Ziel', fortschritt: 0 }]);
    malin.aendern(stand, stand.map(z => (z.id === 'z-basis' ? { ...z, fortschritt: 40 } : z)));
    const [a, b] = await Promise.all([kevin.senden(), malin.senden()]);
    expect(a.ok).toBe(true); expect(b.ok).toBe(true);

    const jetzt = await ladeZiele();
    expect(jetzt.map(z => z.id).sort()).toEqual(['z-basis', 'z-kevin', 'z-zwei']);
    expect(jetzt.find(z => z.id === 'z-basis')!.fortschritt).toBe(40);
    // Malins Sicht enthält nach der Antwort auch Kevins Ziel (Serverstand + eigene offene Änderungen).
    expect(b.sicht!.map(z => z.id)).toContain('z-kevin');
  });

  it('beide ändern DASSELBE Ziel: der zweite bekommt 409 mit dem aktuellen Stand, nichts überschrieben', async () => {
    const kevin = schreiber(); const malin = schreiber();
    const stand = await ladeZiele();
    kevin.kenne(stand); malin.kenne(stand);
    kevin.aendern(stand, stand.map(z => (z.id === 'z-zwei' ? { ...z, titel: 'Kevins Titel' } : z)));
    malin.aendern(stand, stand.map(z => (z.id === 'z-zwei' ? { ...z, titel: 'Malins Titel' } : z)));
    expect((await kevin.senden()).ok).toBe(true);
    const m = await malin.senden();
    expect(m.ok).toBe(false); expect(m.status).toBe(409);
    expect(m.sicht!.find(z => z.id === 'z-zwei')!.titel).toBe('Kevins Titel');
    expect((await ladeZiele()).find(z => z.id === 'z-zwei')!.titel).toBe('Kevins Titel');
  });

  it('Löschen mit veraltetem Stand löscht nicht, was der andere gerade geändert hat', async () => {
    const kevin = schreiber(); const malin = schreiber();
    const stand = await ladeZiele();
    kevin.kenne(stand); malin.kenne(stand);
    kevin.aendern(stand, stand.map(z => (z.id === 'z-kevin' ? { ...z, erledigt: true, fortschritt: 100 } : z)));
    malin.aendern(stand, stand.filter(z => z.id !== 'z-kevin'));
    expect((await kevin.senden()).ok).toBe(true);
    expect((await malin.senden()).status).toBe(409);
    expect((await ladeZiele()).find(z => z.id === 'z-kevin')).toMatchObject({ erledigt: true });
  });

  it('der alte Weg (PUT mit ganzem Horizont) ist zu — Fokus per PUT geht weiter', async () => {
    const r = await ziele.PUT(new Request('http://test/api/state/ziele', { method: 'PUT', headers: kopf, body: JSON.stringify({ horizont: 'jahr', ziele: [] }) }));
    expect(r.status).toBe(409);
    expect((await ladeZiele()).length).toBe(3);
    const f = await ziele.PUT(new Request('http://test/api/state/ziele', { method: 'PUT', headers: kopf, body: JSON.stringify({ horizont: 'woche', fokus: 'Probe-Fokus' }) }));
    expect(f.status).toBe(200);
  });

  it('Kaskade läuft in derselben Sperre: Jahres-Zahlenziel → Quartal, Termin → Meilenstein', async () => {
    const s = schreiber();
    const stand = await ladeZiele();
    s.kenne(stand);
    s.aendern(stand, [...stand, { id: 'z-zahl', titel: 'Neukunden', fortschritt: 0, zielwert: 120, termin: '2026-12-01' }]);
    expect((await s.senden()).ok).toBe(true);
    expect((await ladeZiele('quartal')).find(z => z.abgeleitetVon === 'z-zahl')).toMatchObject({ id: 'z-zahl~quartal', zielwert: 30 });
    expect((await ladeMs()).find(m => m.abgeleitetVon === 'z-zahl')).toMatchObject({ faellig: '2026-12-01' });
  });
});

describe('Meilensteine: Einzeländerungen mit Stand', () => {
  it('zwei Schreiber an verschiedenen Meilensteinen — beide bleiben; gleicher Meilenstein → 409', async () => {
    const netzMs = netz(() => meilensteine);
    const neu = () => new ListenSchreiber<MZ>({ pfad: '/api/state/meilensteine', liste: d => (Array.isArray(d.meilensteine) ? d.meilensteine as MZ[] : null), fetchImpl: netzMs });
    const anlage = neu();
    const leer = await ladeMs();
    anlage.kenne(leer);
    anlage.aendern(leer, [...leer, { id: 'ms-a', titel: 'Meilenstein A', bereich: 'business', fortschritt: 0, erledigt: false }, { id: 'ms-b', titel: 'Meilenstein B', bereich: 'business', fortschritt: 0, erledigt: false }]);
    expect((await anlage.senden()).ok).toBe(true);
    const stand = await ladeMs();
    expect(stand.every(m => typeof m.stand === 'string')).toBe(true);
    const a = neu(), b = neu();
    a.kenne(stand); b.kenne(stand);
    const [erster, zweiter] = ['ms-a', 'ms-b'];
    a.aendern(stand, stand.map(m => (m.id === erster ? { ...m, fortschritt: 77 } : m)));
    b.aendern(stand, [...stand.map(m => (m.id === zweiter ? { ...m, fortschritt: 55 } : m)), { id: 'ms-neu-b', titel: 'Neuer Meilenstein', bereich: 'business', fortschritt: 0, erledigt: false }]);
    expect((await a.senden()).ok).toBe(true);
    expect((await b.senden()).ok).toBe(true);
    const jetzt = await ladeMs();
    expect(jetzt.find(m => m.id === erster)!.fortschritt).toBe(77);
    expect(jetzt.find(m => m.id === zweiter)!.fortschritt).toBe(55);
    expect(jetzt.some(m => m.id === 'ms-neu-b')).toBe(true);
    // Gleicher Meilenstein, veralteter Stand
    const k = neu();
    k.kenne(stand); k.aendern(stand, stand.map(m => (m.id === erster ? { ...m, fortschritt: 2 } : m)));
    expect((await k.senden()).status).toBe(409);
    expect((await ladeMs()).find(m => m.id === erster)!.fortschritt).toBe(77);
  });
});

describe('absichten (rein)', () => {
  it('je Kennung eine Änderung, ohne Stand im Eintrag; Feldreihenfolge egal', () => {
    const alt = [{ id: 'a', titel: 'A', fortschritt: 0, stand: 's1' }, { id: 'b', titel: 'B', fortschritt: 0, stand: 's2' }];
    const neu = [{ fortschritt: 0, titel: 'A', id: 'a', stand: 's1' }, { id: 'c', titel: 'C', fortschritt: 0 }];
    expect(absichten(alt, neu)).toEqual([{ op: 'upsert', eintrag: { id: 'c', titel: 'C', fortschritt: 0 } }, { op: 'delete', id: 'b' }]);
  });
});
