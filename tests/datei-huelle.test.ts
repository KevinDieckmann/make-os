// ─── Paket D-C (29.09., Rest aus D-A #52/#54): Hülle der Dateiablage v2 — Schlüssel-ID, AAD, Lesen über den Ring ─
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-dc-bin-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-bin-schluessel-alt';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT;

let ablage: typeof import('@/lib/dateien/ablage');
let hb: typeof import('@/lib/store/datei-huelle.mjs');
let huelle: typeof import('@/lib/store/huelle.mjs');
beforeAll(async () => {
  ablage = await import('@/lib/dateien/ablage');
  hb = await import('@/lib/store/datei-huelle.mjs');
  huelle = await import('@/lib/store/huelle.mjs');
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); process.env.MAKE_OS_DATEN_SCHLUESSEL = ''; delete process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT; });

describe('Dateiablage: Hülle v2 und Schlüsselring', () => {
  it('neue Kennungen ohne Zeitanteil: d-<uuid>, passt zur Ablage-Regel', async () => {
    const { DATEI_ID } = await import('@/lib/dateien/regeln');
    const id = ablage.neueDateiId();
    expect(id).toMatch(/^d-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(DATEI_ID.test(id)).toBe(true);
  });
  it('schreibt „MKOSDAT2“ mit Schlüssel-ID; kein Klartext auf der Platte; liest zurück', async () => {
    await ablage.inhaltAblegen('haus-a', 'd-probe-1', Buffer.from('GEHEIMER-INHALT'));
    const roh = readFileSync(ablage.dateiPfad('haus-a', 'd-probe-1'));
    expect(roh.subarray(0, 8).toString('ascii')).toBe('MKOSDAT2');
    expect(roh.subarray(8, 20).toString('ascii')).toBe(huelle.schluesselAus('pruef-bin-schluessel-alt').kid);
    expect(roh.includes(Buffer.from('GEHEIMER-INHALT'))).toBe(false);
    expect((await ablage.inhaltLaden('haus-a', 'd-probe-1'))!.toString()).toBe('GEHEIMER-INHALT');
  });
  it('AAD: eine unter anderem Namen oder in einem anderen Haushalt abgelegte Datei öffnet sich nicht', async () => {
    renameSync(ablage.dateiPfad('haus-a', 'd-probe-1'), ablage.dateiPfad('haus-a', 'd-probe-2'));
    await expect(ablage.inhaltLaden('haus-a', 'd-probe-2')).rejects.toThrow(/nicht lesbar/);
    mkdirSync(ablage.haushaltOrdner('haus-b'), { recursive: true });
    renameSync(ablage.dateiPfad('haus-a', 'd-probe-2'), ablage.dateiPfad('haus-b', 'd-probe-2'));
    await expect(ablage.inhaltLaden('haus-b', 'd-probe-2')).rejects.toThrow(/nicht lesbar/);
  });
  it('v1-Dateien (MKOSDAT1) bleiben lesbar — auch mit einem ALTEN Schlüssel des Rings (Rotation im Betrieb)', async () => {
    const altKey = huelle.schluesselAus('pruef-bin-schluessel-alt').key;
    writeFileSync(ablage.dateiPfad('haus-a', 'd-alt-1'), ablage.inhaltVerschluesseln(Buffer.from('ALTE-DATEI'), altKey));
    await ablage.inhaltAblegen('haus-a', 'd-v2-alt', Buffer.from('V2-MIT-ALTEM'));
    // Rotation Schritt 1: neuer Schlüssel aktiv, alter nur lesend — beide Fassungen bleiben sofort abrufbar.
    process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-bin-schluessel-neu';
    process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT = 'pruef-bin-schluessel-alt';
    expect((await ablage.inhaltLaden('haus-a', 'd-alt-1'))!.toString()).toBe('ALTE-DATEI');
    expect((await ablage.inhaltLaden('haus-a', 'd-v2-alt'))!.toString()).toBe('V2-MIT-ALTEM');
    // Ohne den alten Schlüssel: 503 (Schlüssel fehlt), nie Klartext oder Absturz.
    delete process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT;
    await expect(ablage.inhaltLaden('haus-a', 'd-v2-alt')).rejects.toMatchObject({ status: 503 });
  });
  it('reine Hülle: v1/v2 erkennen, Pfad → Haushalt/Kennung (für Skripte)', () => {
    const s = huelle.schluesselAus('x');
    const b = hb.binSchreiben(Buffer.from('a'), s, 'h', 'd-1');
    expect(hb.binVersion(b)).toBe(2);
    expect(hb.binVersion(hb.binV1Schreiben(Buffer.from('a'), s.key))).toBe(1);
    expect(hb.binVersion(Buffer.from('%PDF-1.4'))).toBe(0);
    expect(hb.binAusPfad('/srv/daten/dateien/test-haus/d-abc-1.bin')).toEqual({ haushalt: 'test-haus', id: 'd-abc-1' });
    expect(hb.binOeffnen(b, { aktiv: s, alle: [s] }, 'h', 'd-1').klar.toString()).toBe('a');
  });
});
