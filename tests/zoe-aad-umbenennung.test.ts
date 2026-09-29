// Go-Live-Prüfung 29.09.: die v2-Hülle bindet den Bestandsnamen als AAD. Die Umbenennung Jarvis → ZOE (27.09.) darf
// verschlüsselte Bestände nicht unlesbar machen — weder beim Umbenennen durch die App (`altenNamenUebernehmen`) noch
// wenn eine schon umbenannte Datei die AAD `jarvis-…` trägt, noch durch das Verschlüsselungs-Skript.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { huelleSchreiben, huelleOeffnen, schluesselAus, schluesselRing, aadAlternativen } from '@/lib/store/huelle.mjs';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-zoe-aad-'));
const SCHL = 'zoe-aad-test-schluessel';
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = SCHL;
let db: typeof import('@/lib/store/local-db');
beforeAll(async () => { db = await import('@/lib/store/local-db'); });
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); delete process.env.MAKE_OS_DATEN_SCHLUESSEL; });

const s = schluesselAus(SCHL);
const ring = () => schluesselRing({ MAKE_OS_DATEN_SCHLUESSEL: SCHL } as unknown as NodeJS.ProcessEnv);
const hueller = (daten: unknown, aad: string) => huelleSchreiben(JSON.stringify(daten), s, aad);
const lies = (datei: string) => JSON.parse(readFileSync(datei, 'utf8'));
async function bis(bedingung: () => boolean, ms = 2000): Promise<void> {
  const ende = Date.now() + ms;
  while (!bedingung()) { if (Date.now() > ende) throw new Error('Zeit abgelaufen'); await new Promise(r => setTimeout(r, 20)); }
}

describe('Hülle: gleichwertige Altnamen', () => {
  it('nur jarvis ↔ zoe, sonst nichts', () => {
    expect(aadAlternativen('zoe-verlauf')).toEqual(['jarvis-verlauf']);
    expect(aadAlternativen('jarvis-x')).toEqual(['zoe-x']);
    expect(aadAlternativen('zoe')).toEqual(['jarvis']);
    expect(aadAlternativen('zoenix')).toEqual([]);
    expect(aadAlternativen('kontakte')).toEqual([]);
  });
  it('v2 mit AAD jarvis-x öffnet unter zoe-x (mit aadAlt), unter fremdem Namen weiter nicht', () => {
    const o = JSON.parse(hueller({ a: 1 }, 'jarvis-x'));
    expect(huelleOeffnen(o, ring(), 'zoe-x')).toMatchObject({ version: 2, aadAlt: 'jarvis-x' });
    expect(huelleOeffnen(o, ring(), 'jarvis-x').aadAlt).toBeUndefined();
    expect(() => huelleOeffnen(o, ring(), 'kontakte')).toThrow(/falschem Namen/);
  });
});

describe('App: Umbenennen mit Neu-Verschlüsseln', () => {
  it('jarvis-x.json (v2, AAD jarvis-x) → zoe-x.json mit AAD zoe-x, lesbar, alte Datei weg', async () => {
    writeFileSync(path.join(ordner, 'jarvis-x.json'), hueller({ eintraege: [{ text: 'alt' }] }, 'jarvis-x'));
    const d = await db.loadJson<{ eintraege: { text: string }[] }>('zoe-x');
    expect(d?.eintraege[0].text).toBe('alt');
    expect(existsSync(path.join(ordner, 'jarvis-x.json'))).toBe(false);
    const neu = huelleOeffnen(lies(path.join(ordner, 'zoe-x.json')), ring(), 'zoe-x');
    expect(neu.aadAlt).toBeUndefined(); // wirklich mit dem neuen Namen verschlüsselt
    expect(JSON.parse(neu.text).eintraege[0].text).toBe('alt');
    expect(() => huelleOeffnen(lies(path.join(ordner, 'zoe-x.json')), ring(), 'jarvis-q')).toThrow();
  });
  it('schon umbenannte Datei mit AAD jarvis-y: lesbar, danach von selbst mit AAD zoe-y neu geschrieben', async () => {
    writeFileSync(path.join(ordner, 'zoe-y.json'), hueller({ n: 7 }, 'jarvis-y'));
    expect(await db.loadJson<{ n: number }>('zoe-y')).toMatchObject({ n: 7 });
    await bis(() => !huelleOeffnen(lies(path.join(ordner, 'zoe-y.json')), ring(), 'zoe-y').aadAlt);
    expect(await db.loadJson<{ n: number }>('zoe-y')).toMatchObject({ n: 7 });
  });
  it('updateJson ohne Änderung schreibt eine Altnamen-Hülle trotzdem um (kein „unverändert“)', async () => {
    writeFileSync(path.join(ordner, 'zoe-z.json'), hueller({ n: 1 }, 'jarvis-z'));
    await db.updateJson<{ n: number }>('zoe-z', cur => cur!);
    await bis(() => !huelleOeffnen(lies(path.join(ordner, 'zoe-z.json')), ring(), 'zoe-z').aadAlt);
  });
  it('liegen beide Dateien, bleibt zoe-… maßgeblich und jarvis-… unberührt', async () => {
    writeFileSync(path.join(ordner, 'zoe-w.json'), hueller({ w: 'neu' }, 'zoe-w'));
    writeFileSync(path.join(ordner, 'jarvis-w.json'), hueller({ w: 'alt' }, 'jarvis-w'));
    expect(await db.loadJson<{ w: string }>('zoe-w')).toMatchObject({ w: 'neu' });
    expect(existsSync(path.join(ordner, 'jarvis-w.json'))).toBe(true);
  });
  it('eine unter fremdem Namen zurückgespielte Datei scheitert weiter laut', async () => {
    writeFileSync(path.join(ordner, 'zoe-fremd.json'), hueller({ a: 1 }, 'kontakte'));
    await expect(db.loadJson('zoe-fremd')).rejects.toThrow(/falschem Namen/);
  });
});

describe('Skript daten-verschluesselung.mjs: jarvis-* vor dem Verschlüsseln umbenennen', () => {
  it('Klartext jarvis-a → zoe-a (AAD zoe-a); verwaiste jarvis-b neben zoe-b bekommt den Zielnamen als AAD', () => {
    const d = path.join(ordner, 'skript');
    mkdirSync(path.join(d, 'backup'), { recursive: true });
    writeFileSync(path.join(d, 'jarvis-a.json'), JSON.stringify({ a: 1 }));
    writeFileSync(path.join(d, 'jarvis-b.json'), JSON.stringify({ b: 'alt' }));
    writeFileSync(path.join(d, 'zoe-b.json'), JSON.stringify({ b: 'neu' }));
    writeFileSync(path.join(d, 'zoe-c.json'), hueller({ c: 1 }, 'jarvis-c')); // schon umbenannt, AAD alt
    writeFileSync(path.join(d, 'backup', 'jarvis-a-2026-09-20.json'), JSON.stringify({ a: 0 }));
    const r = spawnSync(process.execPath, ['scripts/daten-verschluesselung.mjs', '--verschluesseln'], { env: { ...process.env, MAKE_OS_DATEN_DIR: d, MAKE_OS_DATEN_SCHLUESSEL: SCHL, MAKE_OS_PRUEF_PORTE: '1' }, encoding: 'utf8' });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(existsSync(path.join(d, 'jarvis-a.json'))).toBe(false);
    const a = huelleOeffnen(lies(path.join(d, 'zoe-a.json')), ring(), 'zoe-a');
    expect(a.aadAlt).toBeUndefined();
    expect(JSON.parse(a.text)).toEqual({ a: 1 });
    expect(huelleOeffnen(lies(path.join(d, 'jarvis-b.json')), ring(), 'zoe-b').aadAlt).toBeUndefined();
    expect(JSON.parse(huelleOeffnen(lies(path.join(d, 'zoe-b.json')), ring(), 'zoe-b').text)).toEqual({ b: 'neu' });
    expect(huelleOeffnen(lies(path.join(d, 'zoe-c.json')), ring(), 'zoe-c').aadAlt).toBeUndefined();
    expect(huelleOeffnen(lies(path.join(d, 'backup', 'jarvis-a-2026-09-20.json')), ring(), 'zoe-a').aadAlt).toBeUndefined();
  });
});
