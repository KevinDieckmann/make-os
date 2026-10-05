// ─── Bilder verschlüsselt und atomar (05.10., Paket „Verschlüsselung lückenlos“) ─────────────────────────────────
// Fotos zu Gerichten und Bauplan-Bildschirmfotos: auf der Platte nur die Hülle der Dateiablage (v2 im Test: „MKOSDAT2“
// mit AAD Ordner/Name), lesbar zurück; alte Klartext-Bilder werden beim ersten Lesen verschlüsselt; ein umbenanntes Bild
// öffnet sich nicht; Rotation stellt Bilder mit um; ohne Schlüssel (lokal) Klartext wie bisher. Keine .tmp-Reste.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-bilder-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
const ALT = 'test-schluessel-bilder-alt-' + 'a'.repeat(30);
const NEU = 'test-schluessel-bilder-neu-' + 'n'.repeat(30);
process.env.MAKE_OS_DATEN_SCHLUESSEL = ALT;

let gerichte: typeof import('@/lib/ernaehrung/bilder');
let bauplan: typeof import('@/lib/bauplan/speicher');
let ablage: typeof import('@/lib/store/bild-ablage');

// Ein echtes (winziges) PNG: Signatur + IHDR reichen für die Typprüfung an den ersten Bytes.
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('0000000d49484452000000010000000108060000001f15c489', 'hex'), Buffer.from('GEHEIMES-BILD')]);
const dataUrl = `data:image/png;base64,${PNG.toString('base64')}`;
const platte = (o: string, n: string) => readFileSync(path.join(ordner, o, n));

beforeAll(async () => {
  gerichte = await import('@/lib/ernaehrung/bilder');
  bauplan = await import('@/lib/bauplan/speicher');
  ablage = await import('@/lib/store/bild-ablage');
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Bilder verschlüsselt', () => {
  it('Foto zum Gericht: auf der Platte nur die Hülle, zurück das Original', async () => {
    const r = await gerichte.gerichtBildSpeichern(dataUrl);
    if (!('name' in r)) throw new Error(r.fehler);
    const roh = platte('bilder-gerichte', r.name);
    expect(roh.subarray(0, 8).toString('ascii')).toBe('MKOSDAT2');
    expect(roh.includes(Buffer.from('GEHEIMES-BILD'))).toBe(false);
    expect(roh.includes(Buffer.from('89504e47', 'hex'))).toBe(false);
    const b = await gerichte.gerichtBildLesen(r.name);
    expect(b?.mime).toBe('image/png');
    expect(Buffer.compare(b!.daten, PNG)).toBe(0);
    await gerichte.gerichtBildLoeschen(r.name);
    expect(await gerichte.gerichtBildLesen(r.name)).toBeNull();
  });

  it('Bauplan-Bild: im Datenordner (nicht mehr process.cwd()/.data), verschlüsselt, keine .tmp-Reste', async () => {
    const r = await bauplan.bildSpeichern(dataUrl);
    if (!('name' in r)) throw new Error(r.fehler);
    expect(platte('bauplan-bilder', r.name).subarray(0, 8).toString('ascii')).toBe('MKOSDAT2');
    expect(Buffer.compare((await bauplan.bildLesen(r.name))!.daten, PNG)).toBe(0);
    expect(readdirSync(path.join(ordner, 'bauplan-bilder')).filter(n => n.endsWith('.tmp'))).toEqual([]);
  });

  it('altes Klartext-Bild: lesbar, und danach liegt es verschlüsselt (Migration beim Lesen)', async () => {
    mkdirSync(path.join(ordner, 'bilder-gerichte'), { recursive: true });
    const name = '0123abcd-a1d0-4000-8000-000000000001.png';
    writeFileSync(path.join(ordner, 'bilder-gerichte', name), PNG);
    expect((await ablage.bilderZaehlen()).klartext).toBe(1);
    const b = await gerichte.gerichtBildLesen(name);
    expect(Buffer.compare(b!.daten, PNG)).toBe(0);
    expect(platte('bilder-gerichte', name).subarray(0, 8).toString('ascii')).toBe('MKOSDAT2');
    expect((await ablage.bilderZaehlen()).klartext).toBe(0);
  });

  it('ein umbenanntes/vertauschtes Bild öffnet sich nicht (AAD Ordner/Name)', async () => {
    const r = await gerichte.gerichtBildSpeichern(dataUrl);
    if (!('name' in r)) throw new Error(r.fehler);
    const fremd = '0123abcd-fe3d-4000-8000-000000000002.png';
    copyFileSync(path.join(ordner, 'bilder-gerichte', r.name), path.join(ordner, 'bilder-gerichte', fremd));
    expect(await gerichte.gerichtBildLesen(fremd)).toBeNull();
  });

  it('Rotation im laufenden Betrieb stellt Bilder mit um (alter Schlüssel nur noch zum Lesen)', async () => {
    const r = await gerichte.gerichtBildSpeichern(dataUrl);
    if (!('name' in r)) throw new Error(r.fehler);
    const vorher = platte('bilder-gerichte', r.name);
    process.env.MAKE_OS_DATEN_SCHLUESSEL = NEU;
    process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT = ALT;
    try {
      const u = await ablage.bilderUmschluesseln();
      expect(u.neu).toBeGreaterThanOrEqual(1);
      expect(Buffer.compare(platte('bilder-gerichte', r.name), vorher)).not.toBe(0);
      delete process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT; // alter Schlüssel weg — alles bleibt lesbar
      expect(Buffer.compare((await gerichte.gerichtBildLesen(r.name))!.daten, PNG)).toBe(0);
    } finally { process.env.MAKE_OS_DATEN_SCHLUESSEL = ALT; delete process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT; }
  });

  it('ohne Datenschlüssel (lokale Entwicklung) wie bisher Klartext', async () => {
    delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
    try {
      const r = await bauplan.bildSpeichern(dataUrl);
      if (!('name' in r)) throw new Error(r.fehler);
      expect(Buffer.compare(platte('bauplan-bilder', r.name), PNG)).toBe(0);
    } finally { process.env.MAKE_OS_DATEN_SCHLUESSEL = ALT; }
  });
});
