// Verschlüsselung im Ruhezustand (26.09.): mit Schlüssel liegt auf der Platte
// nur eine AES-GCM-Hülle, gelesen wird beides; ohne passenden Schlüssel wird
// laut abgebrochen statt still „leer“ gelesen (das würde Daten überschreiben).
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-db-'));
process.env.MAKE_OS_DATEN_DIR = dir;
const db = await import('../lib/store/local-db');

const lies = (n: string) => fs.readFile(path.join(dir, `${n}.json`), 'utf8');
afterEach(() => { delete process.env.MAKE_OS_DATEN_SCHLUESSEL; });
afterAll(() => fs.rm(dir, { recursive: true, force: true }));
beforeAll(() => { delete process.env.MAKE_OS_DATEN_SCHLUESSEL; });

describe('local-db verschlüsselt', () => {
  it('ohne Schlüssel: Klartext wie bisher', async () => {
    await db.saveJson('klar', { a: 1 });
    expect(JSON.parse(await lies('klar'))).toEqual({ a: 1 });
    expect(await db.loadJson('klar')).toEqual({ a: 1 });
  });

  it('mit Schlüssel: nur die Hülle auf der Platte, Lesen liefert die Daten', async () => {
    process.env.MAKE_OS_DATEN_SCHLUESSEL = 'test-schluessel-nicht-echt';
    await db.saveJson('geheim', { journal: 'privat', n: [1, 2, 3] });
    const roh = JSON.parse(await lies('geheim'));
    expect(roh[db.HUELLE]).toBe(1);
    expect(await lies('geheim')).not.toContain('privat');
    expect(await db.loadJson('geheim')).toEqual({ journal: 'privat', n: [1, 2, 3] });
    // updateJson liest die Hülle und schreibt wieder eine
    const neu = await db.updateJson<{ n: number[] }>('geheim', c => ({ ...c!, n: [...c!.n, 4] }));
    expect(neu.n).toEqual([1, 2, 3, 4]);
    expect(JSON.parse(await lies('geheim'))[db.HUELLE]).toBe(1);
  });

  it('Klartext von früher bleibt lesbar, wenn der Schlüssel neu dazukommt — und wird beim Schreiben verschlüsselt', async () => {
    await db.saveJson('alt', { x: 'vorher' });
    process.env.MAKE_OS_DATEN_SCHLUESSEL = 'test-schluessel-nicht-echt';
    expect(await db.loadJson('alt')).toEqual({ x: 'vorher' });
    await db.updateJson<{ x: string }>('alt', c => ({ x: `${c!.x}-nachher` }));
    expect(await lies('alt')).not.toContain('nachher');
    expect(await db.loadJson('alt')).toEqual({ x: 'vorher-nachher' });
  });

  it('verschlüsselt ohne oder mit falschem Schlüssel: Fehler, keine .corrupt-Datei, kein „leer“', async () => {
    process.env.MAKE_OS_DATEN_SCHLUESSEL = 'richtig';
    await db.saveJson('streng', { wichtig: true });
    delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
    await expect(db.loadJson('streng')).rejects.toThrow(/verschlüsselt/);
    process.env.MAKE_OS_DATEN_SCHLUESSEL = 'falsch';
    await expect(db.loadJson('streng')).rejects.toThrow(/Entschlüsselung/);
    expect((await fs.readdir(dir)).some(f => f.startsWith('streng.json.corrupt'))).toBe(false);
    process.env.MAKE_OS_DATEN_SCHLUESSEL = 'richtig';
    expect(await db.loadJson('streng')).toEqual({ wichtig: true });
  });

  it('kaputtes JSON wird weiter beiseitegelegt (nicht mit „kein Schlüssel“ verwechselt)', async () => {
    await fs.writeFile(path.join(dir, 'kaputt.json'), '{ nicht json', 'utf8');
    expect(await db.loadJson('kaputt')).toBeNull();
    expect((await fs.readdir(dir)).some(f => f.startsWith('kaputt.json.corrupt'))).toBe(true);
  });

  it('Hülle selbst: hin und zurück, fremder Tag fällt auf', () => {
    const key = (() => { process.env.MAKE_OS_DATEN_SCHLUESSEL = 'k'; return db.datenSchluessel()!; })();
    const h = db.verschluesseln('{"a":1}', key);
    expect(db.entschluesseln(h, key)).toBe('{"a":1}');
    expect(db.entschluesseln('{"a":1}', key)).toBe('{"a":1}');
    const o = JSON.parse(h); o.daten = Buffer.from('xx').toString('base64');
    expect(() => db.entschluesseln(JSON.stringify(o), key)).toThrow();
  });
});
