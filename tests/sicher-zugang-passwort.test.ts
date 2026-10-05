// ─── Zugang & Schlüssel härten, Punkt 5 (05.10.): Einladungscode kryptografisch, scrypt N=2^17 ─────────────
// Parameter am Konto (`kdf`), alte Hashes (ohne Feld = N=2^14) bleiben gültig und werden beim erfolgreichen Anmelden mit
// DEMSELBEN Salz neu gerechnet — aber nur mit MAKE_OS_KDF=stark (vorher bliebe der Rückweg zum alten Stand verbaut).
// Eigener Datenordner, nur Test-Werte.
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scryptSync } from 'node:crypto';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-passwort-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-passwort-nur-test';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
const PW = 'TESTPASSWORT-nur-fuer-den-test';

let db: typeof import('@/lib/store/local-db');
let K: typeof import('@/lib/zugang/konten');
let S: typeof import('@/lib/zugang/sitzung');
let drossel: typeof import('@/lib/zugang/drossel');
let anmelden: typeof import('@/app/api/konto/anmelden/route');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  K = await import('@/lib/zugang/konten');
  S = await import('@/lib/zugang/sitzung');
  drossel = await import('@/lib/zugang/drossel');
  anmelden = await import('@/app/api/konto/anmelden/route');
});
afterEach(() => { delete process.env.MAKE_OS_KDF; });
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

/** Ein Konto wie vor dem 05.10.: Hash mit Node-Vorgabe, kein `kdf`. */
async function altesKonto() {
  const salz = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const hash = scryptSync(PW, salz, 64).toString('hex');
  await db.saveJson('konten', { konten: [{ id: 'k-a', speicher: 'person-a', email: 'a@example.invalid', name: 'A', rolle: 'inhaber', hash, salz, angelegt: '2026-01-01', teilt: { gesundheit: [] } }], einladungen: [] });
  await db.saveJson('anmeldungen', { eintraege: [] });
  drossel._zuruecksetzen();
  return { hash, salz };
}
const login = (passwort = PW) => anmelden.POST(new Request('http://test/api/konto/anmelden', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'a@example.invalid', passwort }) }));

describe('Einladungscode', () => {
  it('kryptografischer Zufall (randomInt), nie Math.random', () => {
    const quelle = readFileSync('lib/zugang/konten.ts', 'utf8');
    expect(quelle).not.toMatch(/Math\.random\b/);
    expect(K.neuerEinladungscode(() => 0)).toBe('AAAA-AAAA');
    expect(K.neuerEinladungscode(n => n - 1)).toBe('9999-9999');
    const viele = new Set(Array.from({ length: 200 }, () => K.neuerEinladungscode()));
    expect(viele.size).toBe(200);
  });
});

describe('scrypt-Parameter', () => {
  it('stark nur mit MAKE_OS_KDF=stark (Rückweg zum alten Stand bleibt sonst offen)', () => {
    expect(K.kdfFuerNeu({})).toEqual(K.KDF_STANDARD);
    expect(K.kdfFuerNeu({ MAKE_OS_FORMAT: 'v2' })).toEqual(K.KDF_STANDARD);
    expect(K.kdfFuerNeu({ MAKE_OS_KDF: 'stark' })).toEqual({ n: 131072, r: 8, p: 1 });
    expect(K.kdfFuerNeu({ MAKE_OS_KDF: ' STARK ' })).toEqual(K.KDF_STARK);
  });
  it('ohne bzw. mit unsinnigem Feld gilt die Node-Vorgabe; nur bekannte Werte werden genommen', () => {
    expect(K.kdfVon({})).toEqual(K.KDF_STANDARD);
    expect(K.kdfVon({ kdf: { n: 1000, r: 8, p: 1 } })).toEqual(K.KDF_STANDARD);
    expect(K.kdfVon({ kdf: { n: 2 ** 30, r: 8, p: 1 } })).toEqual(K.KDF_STANDARD);
    expect(K.kdfVon({ kdf: K.KDF_STARK })).toEqual(K.KDF_STARK);
  });
  it('stark gehashte Passwörter prüfen; Parameter stehen am Ergebnis', async () => {
    const h = await K.passwortHashen(PW, K.KDF_STARK);
    expect(h.kdf).toEqual(K.KDF_STARK);
    expect(await K.passwortStimmt(PW, h)).toBe(true);
    expect(await K.passwortStimmt(PW + 'x', h)).toBe(false);
    // Derselbe Hash mit falschen Parametern gelesen passt nicht — die Parameter gehören zum Hash.
    expect(await K.passwortStimmt(PW, { hash: h.hash, salz: h.salz })).toBe(false);
  });
  it('öffentliche Sicht verrät die Parameter nicht', async () => {
    const h = await K.passwortHashen(PW, K.KDF_STANDARD);
    const o = K.oeffentlich({ id: 'k', speicher: 's', email: 'e@example.invalid', name: 'n', rolle: 'mitglied', angelegt: 'x', teilt: { gesundheit: [] }, ...h });
    expect(o).not.toHaveProperty('kdf');
    expect(o).not.toHaveProperty('hash');
  });
});

describe('Neu hashen beim Anmelden', () => {
  beforeEach(() => altesKonto());
  it('ohne MAKE_OS_KDF=stark: alter Hash bleibt (Rückweg) — Anmelden klappt', async () => {
    const vorher = (await K.ladeKonten()).konten[0];
    expect((await login()).status).toBe(200);
    const nachher = (await K.ladeKonten()).konten[0];
    expect(nachher.hash).toBe(vorher.hash);
    expect(nachher.kdf).toBeUndefined();
  });
  it('MAKE_OS_KDF=stark: nach erfolgreichem Anmelden N=2^17 mit demselben Salz — Sitzungs-Stand unverändert, Passwort gilt weiter', async () => {
    process.env.MAKE_OS_KDF = 'stark';
    const vorher = (await K.ladeKonten()).konten[0];
    expect((await login(PW + 'falsch')).status).toBe(401);
    expect((await K.ladeKonten()).konten[0].hash).toBe(vorher.hash);
    expect((await login()).status).toBe(200);
    const nachher = (await K.ladeKonten()).konten[0];
    expect(nachher.hash).not.toBe(vorher.hash);
    expect(nachher.salz).toBe(vorher.salz);
    expect(nachher.kdf).toEqual(K.KDF_STARK);
    expect(await S.kontoStand(nachher.salz)).toBe(await S.kontoStand(vorher.salz));
    expect(await K.passwortStimmt(PW, nachher)).toBe(true);
    expect((await login()).status).toBe(200);
    expect((await K.ladeKonten()).konten[0].hash).toBe(nachher.hash);
  });
});
