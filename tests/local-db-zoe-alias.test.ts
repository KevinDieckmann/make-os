// Umbenennung Jarvis → ZOE: alte Bestandsdateien werden beim ersten Lesen einmal umbenannt.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-zoe-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
delete process.env.MAKE_OS_DATENSCHLUESSEL;
let db: typeof import('@/lib/store/local-db');
beforeAll(async () => { db = await import('@/lib/store/local-db'); });
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('ZOE liest alte Jarvis-Dateien', () => {
  it('zoe-verlauf findet jarvis-verlauf.json, benennt um und liest den Inhalt', async () => {
    writeFileSync(path.join(ordner, 'jarvis-verlauf.json'), JSON.stringify({ eintraege: [{ text: 'alt' }] }));
    const d = await db.loadJson<{ eintraege: { text: string }[] }>('zoe-verlauf');
    expect(d?.eintraege[0].text).toBe('alt');
    expect(existsSync(path.join(ordner, 'zoe-verlauf.json'))).toBe(true);
    expect(existsSync(path.join(ordner, 'jarvis-verlauf.json'))).toBe(false);
  });
  it('ohne alte Datei bleibt es null; andere Namen sind nicht betroffen', async () => {
    expect(await db.loadJson('zoe-nix')).toBeNull();
    writeFileSync(path.join(ordner, 'jarvis-x.json'), '{"a":1}');
    expect(await db.loadJson('kontakte')).toBeNull();
    expect(existsSync(path.join(ordner, 'jarvis-x.json'))).toBe(true);
  });
});
