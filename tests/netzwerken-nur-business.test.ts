// ─── Gesamtprüfung 12.10.: Netzwerken ist Business — auch für ein Konto „nur Business“ ────────────────────────────────────────────
// Der Vertriebspartner (`finanzRecht: 'business'`, im Haushalt der Inhaber) bekam auf /os/netzwerken nur 403: beide Routen bestimmten den
// Haushalt über `haushaltFuer`/`haushaltVon`, die seit 04.10. Konten „nur Business“ ausschließen (gedacht für die PRIVATEN Haushaltsfinanzen).
// Jetzt: eigene Visitenkarten und Netzwerken-Grunddaten wie jedes Mitglied; ein fremder Haushalt und ein Konto ohne Haushalt bleiben draußen.
// Eigener Datenordner, erfundene Konten.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-netz-nb-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-netz-nb';
process.env.MAKE_OS_OHNE_APPLE = '1';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Mod = Record<string, (r: Request) => Promise<Response>>;
const anfrage = (pfad: string, person: string) => new Request(`http://test${pfad}`, { headers: { 'x-make-user': person } });
let netz: Mod, karten: Mod;

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const konto = (speicher: string, rolle: string, extra: Record<string, unknown> = {}) => ({ id: `k-${speicher}`, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Prüf`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('pa', 'inhaber', { haushalt: 'h-pruef' }), konto('pp', 'mitglied', { haushalt: 'h-pruef', finanzRecht: 'business' }),
    konto('pf', 'mitglied', { haushalt: 'h-fremd', finanzRecht: 'business' }), konto('pg', 'mitglied'),
  ], einladungen: [] });
  netz = (await import('@/app/api/netzwerken/route')) as unknown as Mod;
  karten = (await import('@/app/api/netzwerken/karten/route')) as unknown as Mod;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Netzwerken für ein Konto „nur Business“', () => {
  it('GET /api/netzwerken: Partner im Haushalt 200 (ich = er selbst), fremder Haushalt und ohne Haushalt 403', async () => {
    const r = await netz.GET(anfrage('/api/netzwerken', 'pp'));
    expect(r.status).toBe(200);
    expect((await r.json()).ich).toBe('pp');
    expect((await netz.GET(anfrage('/api/netzwerken', 'pf'))).status).toBe(403);
    expect((await netz.GET(anfrage('/api/netzwerken', 'pg'))).status).toBe(403);
  });

  it('GET /api/netzwerken/karten: eigene Profile 200; die Inhaberin pflegt sie mit ?fuer=; ohne Haushalt 403', async () => {
    const r = await karten.GET(anfrage('/api/netzwerken/karten', 'pp'));
    expect(r.status).toBe(200);
    expect((await r.json()).person).toBe('pp');
    const fuer = await karten.GET(anfrage('/api/netzwerken/karten?fuer=pp', 'pa'));
    expect(fuer.status).toBe(200);
    expect((await fuer.json()).fuerAndere).toBe(true);
    expect((await karten.GET(anfrage('/api/netzwerken/karten', 'pg'))).status).toBe(403);
    // Ein Konto „nur Business“ eines ANDEREN Haushalts nie über den Partner-Weg (der gilt nur im Haushalt der Inhaber).
    expect((await karten.GET(anfrage('/api/netzwerken/karten?fuer=pf', 'pa'))).status).toBe(403);
  });
});
