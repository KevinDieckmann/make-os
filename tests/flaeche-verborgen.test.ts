// ─── Prüf-Fund 11.10. (8): Flächen — Plätze, die GET nicht ausliefert, gehen beim nächsten PUT nicht verloren ─────────────────────────
// GET /api/state/flaeche filtert Widgets, die nicht in die Sicht passen (lib/flaeche/sicht.ts). Schickt der Browser danach sein Layout zurück,
// legt der Schreibweg die gespeicherten, nicht ausgelieferten Plätze unverändert zurück. Eigener Datenordner, erfundene Person.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mitVerborgenenPlaetzen } from '@/lib/flaeche/sicht';
import type { Layout } from '@/lib/flaeche/modell';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-flaeche-verborgen-'));
Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-flaeche-verborgen' });
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; PUT: Handler };
let db: typeof import('@/lib/store/local-db');
let speicherFuer: typeof import('@/lib/zoe/raum').speicherFuer;
const J = '2026-10-11T08:00:00.000Z';
const kopf = { 'content-type': 'application/json', 'x-make-user': 'pia' };
const SEITE = 'uebersicht-business';

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  ({ speicherFuer } = await import('@/lib/zoe/raum'));
  route = (await import('@/app/api/state/flaeche/route')) as unknown as typeof route;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('rein', () => {
  const alt: Layout = { plaetze: [{ id: 'familie-x', art: 'familie', breite: 2, einstellungen: {} }, { id: 'dran', art: 'dran', breite: 2, einstellungen: {} }], versteckt: [], stand: J };
  it('legt nicht ausgelieferte Plätze hinten an, nichts doppelt', () => {
    const neu: Layout = { plaetze: [{ id: 'dran', art: 'dran', breite: 4, einstellungen: {} }], versteckt: [], stand: J };
    expect(mitVerborgenenPlaetzen(SEITE, neu, alt)!.plaetze.map(p => [p.id, p.breite])).toEqual([['dran', 4], ['familie-x', 2]]);
  });
  it('„auf Standard zurück“ (leer) behält die verborgenen; ohne verborgene → Eintrag weg', () => {
    expect(mitVerborgenenPlaetzen(SEITE, null, alt)!.plaetze.map(p => p.id)).toEqual(['familie-x']);
    expect(mitVerborgenenPlaetzen(SEITE, null, { ...alt, plaetze: [alt.plaetze[1]] })).toBeNull();
  });
});

describe('Route', () => {
  it('GET zeigt den Privat-Platz auf Heute › Business nicht — PUT verliert ihn trotzdem nicht', async () => {
    await db.saveJson(speicherFuer('flaeche', 'pia'), { seiten: { [SEITE]: { plaetze: [{ id: 'familie-x', art: 'familie', breite: 2, einstellungen: {} }, { id: 'dran', art: 'dran', breite: 2, einstellungen: {} }], versteckt: [], stand: J } } });
    const g = await route.GET(new Request(`http://test/api/state/flaeche?seite=${SEITE}`, { headers: kopf }));
    const gd = await g.json() as { layout: Layout };
    expect(gd.layout.plaetze.map(p => p.id)).toEqual(['dran']);
    // Der Browser schickt das (gefilterte) Layout mit geänderter Breite zurück.
    const p = await route.PUT(new Request('http://test/api/state/flaeche', { method: 'PUT', headers: kopf, body: JSON.stringify({ seite: SEITE, layout: { ...gd.layout, plaetze: [{ ...gd.layout.plaetze[0], breite: 4 }], stand: J } }) }));
    expect(p.status).toBe(200);
    const pd = await p.json() as { layout: Layout };
    expect(pd.layout.plaetze.map(x => x.id)).toEqual(['dran']); // die Antwort bleibt gefiltert
    const roh = await db.loadJson<{ seiten: Record<string, Layout> }>(speicherFuer('flaeche', 'pia'));
    expect(roh!.seiten[SEITE].plaetze.map(x => [x.id, x.breite])).toEqual([['dran', 4], ['familie-x', 2]]);
  });
});
