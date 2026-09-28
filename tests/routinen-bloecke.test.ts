// ─── Routinen & Wochenblöcke: Einzeländerungen, nur eigene Blöcke (28.09.) ───
// Prüfbericht 28.09.: Der Routine-Planer schickte die GANZE Blockliste beider
// Personen per PUT — Kevins Speichern löschte Malins gerade angelegten Block. Und
// PUT { routinen } las den Bestand außerhalb der Sperre und schrieb ihn mit zurück.
// Eigener Datenordner, erfundene Blöcke.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ListenSchreiber } from '@/lib/make-one/liste-stand';
import type { Block, Routine } from '@/lib/planung/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-routinen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-rt';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Handler = (r: Request) => Promise<Response>;
type Mod = { GET: Handler; PATCH: Handler; PUT: Handler };
let route: Mod;
const kopf = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-rt', ...(person ? { 'x-make-person': person } : {}) });
const anfrage = (method: string, body?: unknown, person?: string) =>
  new Request('http://test/api/state/routinen', { method, headers: kopf(person), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
type Stand = { routinen: (Routine & { stand: string })[]; bloecke: (Block & { stand: string })[] };
const lade = async () => (await (await route.GET(anfrage('GET'))).json()) as Stand;
const netz = (person: string) => (async (_u: RequestInfo | URL, init?: RequestInit) => route.PATCH(new Request('http://test/api/state/routinen', { ...init, headers: kopf(person) }))) as typeof fetch;
const blockSchreiber = (person: string) => new ListenSchreiber<Block & { stand?: string }>({ pfad: '/api/state/routinen', koerper: ops => ({ bloecke: ops }), liste: d => (Array.isArray(d.bloecke) ? d.bloecke as Block[] : null), fetchImpl: netz(person) });
const block = (id: string, owner: string, wochentag: 1 | 2 | 3 = 1): Block => ({ id, owner, wochentag, von: '09:00', bis: '12:00', art: 'business' });

beforeAll(async () => {
  route = (await import('@/app/api/state/routinen/route')) as unknown as Mod;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Wochenblöcke je Person', () => {
  it('Kevin und Malin legen gleichzeitig Blöcke an — beide bleiben', async () => {
    const stand = await lade();
    const kevin = blockSchreiber('kevin'), malin = blockSchreiber('malin');
    kevin.kenne(stand.bloecke); malin.kenne(stand.bloecke);
    kevin.aendern(stand.bloecke, [...stand.bloecke, block('bl-k1', 'kevin')]);
    malin.aendern(stand.bloecke, [...stand.bloecke, block('bl-m1', 'malin')]);
    const [a, b] = await Promise.all([kevin.senden(), malin.senden()]);
    expect(a.ok).toBe(true); expect(b.ok).toBe(true);
    expect((await lade()).bloecke.map(x => x.id).sort()).toEqual(['bl-k1', 'bl-m1']);
  });

  it('fremde Blöcke anlegen, ändern oder löschen → 403, nichts geändert', async () => {
    const stand = await lade();
    const m1 = stand.bloecke.find(b => b.id === 'bl-m1')!;
    const aendern = await route.PATCH(anfrage('PATCH', { bloecke: [{ op: 'upsert', eintrag: { ...m1, art: 'privat' }, stand: m1.stand }] }, 'kevin'));
    expect(aendern.status).toBe(403);
    // Übernehmen per Besitzer-Tausch geht auch nicht (gespeicherter Besitzer zählt).
    expect((await route.PATCH(anfrage('PATCH', { bloecke: [{ op: 'upsert', eintrag: { ...m1, owner: 'kevin' } }] }, 'kevin'))).status).toBe(403);
    expect((await route.PATCH(anfrage('PATCH', { bloecke: [{ op: 'delete', id: 'bl-m1' }] }, 'kevin'))).status).toBe(403);
    expect((await route.PATCH(anfrage('PATCH', { bloecke: [{ op: 'upsert', eintrag: block('bl-x', 'malin') }] }, 'kevin'))).status).toBe(403);
    // Ohne Person: 403.
    expect((await route.PATCH(anfrage('PATCH', { bloecke: [{ op: 'upsert', eintrag: block('bl-y', 'kevin') }] }))).status).toBe(403);
    expect((await lade()).bloecke.find(b => b.id === 'bl-m1')).toMatchObject({ art: 'business', owner: 'malin' });
  });

  it('veralteter Stand am eigenen Block → 409 mit aktuellem Bestand', async () => {
    const stand = await lade();
    const k1 = stand.bloecke.find(b => b.id === 'bl-k1')!;
    expect((await route.PATCH(anfrage('PATCH', { bloecke: [{ op: 'upsert', eintrag: { ...k1, bis: '13:00' }, stand: k1.stand }] }, 'kevin'))).status).toBe(200);
    const alt = await route.PATCH(anfrage('PATCH', { bloecke: [{ op: 'upsert', eintrag: { ...k1, bis: '14:00' }, stand: k1.stand }] }, 'kevin'));
    expect(alt.status).toBe(409);
    const d = await alt.json() as Stand;
    expect(d.bloecke.find(b => b.id === 'bl-k1')!.bis).toBe('13:00');
  });

  it('PUT { bloecke } (ganze Liste beider Personen) ist zu', async () => {
    const r = await route.PUT(anfrage('PUT', { bloecke: [block('bl-k1', 'kevin')] }, 'kevin'));
    expect(r.status).toBe(409);
    expect((await lade()).bloecke.some(b => b.id === 'bl-m1')).toBe(true);
  });

  it('PUT { routinen } lässt die Blöcke stehen, auch wenn gleichzeitig ein Block dazukommt (Lesen in der Sperre)', async () => {
    const stand = await lade();
    const routinen = stand.routinen.map(({ stand: _s, ...r }) => r);
    const [put, neu] = await Promise.all([
      route.PUT(anfrage('PUT', { routinen: [...routinen, { id: 'r-neu', label: 'Neue Routine', wann: 'morgen', kategorie: 'leben', dauerMin: 10, aktiv: true }] }, 'kevin')),
      route.PATCH(anfrage('PATCH', { bloecke: [{ op: 'upsert', eintrag: block('bl-m2', 'malin', 2) }] }, 'malin')),
    ]);
    expect(put.status).toBe(200); expect(neu.status).toBe(200);
    const jetzt = await lade();
    expect(jetzt.bloecke.map(b => b.id).sort()).toEqual(['bl-k1', 'bl-m1', 'bl-m2']);
    expect(jetzt.routinen.some(r => r.id === 'r-neu')).toBe(true);
  });

  it('Routinen einzeln mit Stand: zwei Schreiber an verschiedenen Routinen — beide bleiben', async () => {
    const stand = await lade();
    const neu = (person: string) => new ListenSchreiber<Routine & { stand?: string }>({ pfad: '/api/state/routinen', liste: d => (Array.isArray(d.routinen) ? d.routinen as Routine[] : null), fetchImpl: netz(person) });
    const a = neu('kevin'), b = neu('malin');
    a.kenne(stand.routinen); b.kenne(stand.routinen);
    const [r1, r2] = stand.routinen;
    a.aendern(stand.routinen, stand.routinen.map(r => (r.id === r1.id ? { ...r, label: 'Von Kevin' } : r)));
    b.aendern(stand.routinen, stand.routinen.map(r => (r.id === r2.id ? { ...r, aktiv: false } : r)));
    expect((await a.senden()).ok).toBe(true); expect((await b.senden()).ok).toBe(true);
    const jetzt = await lade();
    expect(jetzt.routinen.find(r => r.id === r1.id)!.label).toBe('Von Kevin');
    expect(jetzt.routinen.find(r => r.id === r2.id)!.aktiv).toBe(false);
  });
});
