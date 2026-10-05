// ─── Zugang & Schlüssel härten, Punkt 3 (05.10.): erstes Konto per Einmal-Code ─────────────────────────────
// Kein Generalschlüssel mehr im Browser: /api/konto/einrichten nimmt nur den Einmal-Code aus scripts/einrichtung-token.mjs
// (als Fingerabdruck mit Ablauf in <daten>/system/einrichtung.json), danach ist die Datei weg. Eigener Datenordner.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-einrichten-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-einrichten-nur-test';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

let E: typeof import('@/lib/zugang/einrichtung.mjs');
let route: typeof import('@/app/api/konto/einrichten/route');
let K: typeof import('@/lib/zugang/konten');
let drossel: typeof import('@/lib/zugang/drossel');
const post = (body: unknown) => route.POST(new Request('http://test/api/konto/einrichten', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const daten = { email: 'inhaber@example.invalid', name: 'Testinhaber', passwort: 'TESTPASSWORT-nur-fuer-den-test' };

beforeAll(async () => {
  E = await import('@/lib/zugang/einrichtung.mjs');
  route = await import('@/app/api/konto/einrichten/route');
  K = await import('@/lib/zugang/konten');
  drossel = await import('@/lib/zugang/drossel');
});
beforeEach(async () => { rmSync(path.join(ordner, 'konten.json'), { force: true }); await E.codeVerbrauchen(ordner); drossel._zuruecksetzen(); });
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('Einrichtungs-Code', () => {
  it('Code: 5 × 4 Zeichen, kryptografisch, nur als Fingerabdruck mit Ablauf abgelegt (0600)', async () => {
    const { code, bis } = await E.codeAblegen(ordner, 24, new Date('2026-10-05T10:00:00Z'));
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){4}$/);
    expect(bis).toBe('2026-10-06T10:00:00.000Z');
    const roh = readFileSync(E.einrichtungDatei(ordner), 'utf8');
    expect(roh).not.toContain(code);
    expect(roh).not.toContain(code.replace(/-/g, ''));
    expect(statSync(E.einrichtungDatei(ordner)).mode & 0o777).toBe(0o600);
    expect(new Set(Array.from({ length: 30 }, () => E.neuerCode())).size).toBe(30);
  });
  it('prüft Groß/klein und Bindestriche egal; falsch, fehlt, abgelaufen (Datei dann weg)', async () => {
    const jetzt = new Date('2026-10-05T10:00:00Z');
    expect(await E.codePruefen(ordner, 'X', jetzt)).toBe('fehlt');
    const { code } = await E.codeAblegen(ordner, 1, jetzt);
    expect(await E.codePruefen(ordner, code.toLowerCase().replace(/-/g, ' '), jetzt)).toBe('ok');
    expect(await E.codePruefen(ordner, 'AAAA-AAAA-AAAA-AAAA-AAAA', jetzt)).toBe('falsch');
    expect(await E.codePruefen(ordner, code, new Date('2026-10-05T11:00:01Z'))).toBe('abgelaufen');
    expect(existsSync(E.einrichtungDatei(ordner))).toBe(false);
  });
});

describe('POST /api/konto/einrichten', () => {
  it('der Generalschlüssel MAKE_OS_KEY gilt nicht mehr', async () => {
    const r = await post({ ...daten, schluessel: process.env.MAKE_OS_KEY });
    expect(r.status).toBe(403);
    expect((await K.ladeKonten()).konten).toHaveLength(0);
  });
  it('ohne abgelegten Code: 403 mit Hinweis aufs Skript; falscher Code: 403', async () => {
    expect((await (await post({ ...daten, code: 'AAAA-AAAA-AAAA-AAAA-AAAA' })).json()).error).toMatch(/einrichtung-token\.mjs/);
    await E.codeAblegen(ordner);
    const r = await post({ ...daten, code: 'AAAA-AAAA-AAAA-AAAA-AAAA' });
    expect(r.status).toBe(403);
    expect((await r.json()).error).toMatch(/stimmt nicht/);
  });
  it('mit Code: Inhaber angelegt, Code verbraucht (Datei weg), zweites Mal 409', async () => {
    const { code } = await E.codeAblegen(ordner);
    const r = await post({ ...daten, code });
    expect(r.status).toBe(200);
    const k = (await K.ladeKonten()).konten;
    expect(k).toHaveLength(1);
    expect(k[0].rolle).toBe('inhaber');
    expect(existsSync(E.einrichtungDatei(ordner))).toBe(false);
    expect((await post({ ...daten, code })).status).toBe(409);
  });
  it('alte Anmeldeseite (Feld „schluessel“, leeres „code“) funktioniert mit dem Einmal-Code', async () => {
    const { code } = await E.codeAblegen(ordner);
    expect((await post({ ...daten, code: '', schluessel: code })).status).toBe(200);
  });
});

describe('scripts/einrichtung-token.mjs', () => {
  const lauf = () => execFileSync(process.execPath, ['scripts/einrichtung-token.mjs', '--stunden', '2'], { env: { ...process.env, MAKE_OS_DATEN_DIR: ordner }, encoding: 'utf8' });
  it('legt einen Code ab und zeigt ihn nur im Terminal; mit vorhandenen Konten verweigert es', async () => {
    const aus = lauf();
    const code = /([A-Z0-9]{4}(?:-[A-Z0-9]{4}){4})/.exec(aus)?.[1];
    expect(code).toBeTruthy();
    expect(await E.codePruefen(ordner, code)).toBe('ok');
    const { code: c2 } = await E.codeAblegen(ordner);
    expect((await post({ ...daten, code: c2 })).status).toBe(200);
    expect(() => lauf()).toThrow();
  });
});
