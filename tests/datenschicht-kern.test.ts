// Paket D-A (29.09.): Datenschicht-Kern — atomar & dauerhaft, Sperren, Hülle v2 mit AAD und Schlüsselring,
// ETag-Zähler, Schemaversion, Schreibpause/Abschaltung, Lockfile. Alles in einem Temp-Ordner.
import { describe, it, expect, afterAll, afterEach, vi } from 'vitest';
import { promises as fs, readFileSync, writeFileSync, mkdtempSync } from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-kern-'));
process.env.MAKE_OS_DATEN_DIR = dir;
const db = await import('../lib/store/local-db');
const atomar = await import('../lib/store/atomar.mjs');
const huelle = await import('../lib/store/huelle.mjs');
const schema = await import('../lib/store/schema');
const schreiber = await import('../lib/store/schreiber.mjs');
const datei = (n: string) => path.join(dir, `${n}.json`);
const warte = (ms: number) => new Promise(r => setTimeout(r, ms));

afterEach(() => {
  for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'MAKE_OS_DATEN_SCHLUESSEL_ALT', 'MAKE_OS_DATEN_SCHLUESSEL_DATEI', 'MAKE_OS_DATEN_SCHLUESSEL_ALT_DATEI', 'MAKE_OS_SPERR_LIMIT_MS', 'MAKE_OS_KLARTEXT_MIGRATION']) delete process.env[k];
  huelle.schluesselNeuLaden();
  db.leseCacheLeeren();
  db.abschaltungZuruecksetzen();
  db.schreibpauseAufheben();
  schema.schemaFuerTestSetzen(null);
  vi.restoreAllMocks();
});
afterAll(() => fs.rm(dir, { recursive: true, force: true }));

describe('atomarSchreiben (#2/#3/#5)', () => {
  it('schreibt vollständig, 0600, ohne .tmp-Reste — auch Bytes', async () => {
    const p = path.join(dir, 'atomar.bin');
    await atomar.atomarSchreiben(p, Buffer.from([1, 2, 3]));
    expect([...readFileSync(p)]).toEqual([1, 2, 3]);
    expect((await fs.stat(p)).mode & 0o777).toBe(0o600);
    await atomar.atomarSchreiben(p, 'text');
    expect(readFileSync(p, 'utf8')).toBe('text');
    expect((await fs.readdir(dir)).some(f => f.endsWith('.tmp'))).toBe(false);
  });
  it('Fehler beim Schreiben: Ziel unverändert, keine .tmp-Datei', async () => {
    await expect(atomar.atomarSchreiben(path.join(dir, 'fehlt', 'x.json'), 'a')).rejects.toThrow();
    expect((await fs.readdir(dir)).some(f => f.endsWith('.tmp'))).toBe(false);
  });
  it('ordnerSync schluckt nur EINVAL/ENOTSUP, E/A-Fehler werfen', async () => {
    const fsMod = await import('node:fs');
    const mitFehler = (code: string) => vi.spyOn(fsMod.promises, 'open').mockResolvedValueOnce({ sync: async () => { throw Object.assign(new Error(code), { code }); }, close: async () => {} } as never);
    mitFehler('EINVAL');
    await expect(atomar.ordnerSync(dir)).resolves.toBeUndefined();
    mitFehler('ENOTSUP');
    await expect(atomar.ordnerSync(dir)).resolves.toBeUndefined();
    mitFehler('EIO');
    await expect(atomar.ordnerSync(dir)).rejects.toThrow('EIO');
  });
});

describe('Tagessicherung und Beiseitelegen (#5/#7/#86)', () => {
  it('scheitert die Sicherung, wird es laut gezählt und am nächsten Schreiben erneut versucht', async () => {
    await db.saveJson('sich', { n: 1 });
    const fehlerVorher = db.datenschichtLage().sicherungFehler.anzahl;
    await fs.rm(path.join(dir, 'backup'), { recursive: true, force: true });
    writeFileSync(path.join(dir, 'backup'), 'kein ordner'); // mkdir scheitert
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await db.saveJson('sich', { n: 2 });
    expect(db.datenschichtLage().sicherungFehler.anzahl).toBe(fehlerVorher + 1);
    expect(log).toHaveBeenCalled();
    await fs.rm(path.join(dir, 'backup'));
    await db.saveJson('sich', { n: 3 });
    const kopien = (await fs.readdir(path.join(dir, 'backup'))).filter(f => f.startsWith('sich-'));
    expect(kopien).toHaveLength(1);
    expect(JSON.parse(readFileSync(path.join(dir, 'backup', kopien[0]), 'utf8')).n).toBe(2);
  });
  it('saveJson legt kaputtes JSON beiseite und schreibt NICHT darüber', async () => {
    writeFileSync(datei('kaputt-save'), '{ "a": ');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(db.saveJson('kaputt-save', { a: 1 })).rejects.toBeInstanceOf(db.BestandBeschaedigt);
    expect((await fs.readdir(dir)).some(f => f.startsWith('kaputt-save.json.corrupt-'))).toBe(true);
  });
  it('scheitert das Beiseitelegen, wird BestandBeschaedigt geworfen — die kaputte Datei bleibt unangetastet', async () => {
    writeFileSync(datei('kaputt-fest'), '{ "a": ');
    const fsMod = await import('fs');
    vi.spyOn(fsMod.promises, 'rename').mockRejectedValueOnce(Object.assign(new Error('EACCES'), { code: 'EACCES' }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(db.updateJson('kaputt-fest', () => ({ a: 1 }))).rejects.toBeInstanceOf(db.BestandBeschaedigt);
    expect(readFileSync(datei('kaputt-fest'), 'utf8')).toBe('{ "a": ');
  });
});

describe('Sperren (#11/#12)', () => {
  it('Wiedereintritt wirft sofort statt ewig zu warten', async () => {
    await expect(db.updateJsonAsync('wieder', async () => { await db.updateJson('wieder', () => ({})); return {}; })).rejects.toBeInstanceOf(db.SperreFalsch);
  });
  it('Rangfolge: crm → kontakte erlaubt, kontakte → crm wirft', async () => {
    await expect(db.updateJsonAsync('crm', async c => { await db.updateJson('kontakte', k => k ?? { kontakte: [] }); return c ?? {}; })).resolves.toBeDefined();
    await expect(db.updateJsonAsync('kontakte', async k => { await db.updateJson('crm', c => c ?? {}); return k ?? {}; })).rejects.toThrow(/Rangfolge/);
  });
  it('nach dem Freigeben darf ein nachlaufender Schritt denselben Bestand wieder sperren', async () => {
    let spaeter: Promise<unknown> = Promise.resolve();
    await db.updateJson('nachlauf', () => { spaeter = warte(5).then(() => db.updateJson('nachlauf', () => ({ b: 1 }))); return { a: 1 }; });
    await expect(spaeter).resolves.toEqual({ b: 1 });
  });
  it('Zeitlimit: wer zu lange wartet, bekommt SperreZeitlimit — der Halter schreibt trotzdem, die Reihenfolge bleibt', async () => {
    process.env.MAKE_OS_SPERR_LIMIT_MS = '60';
    const lang = db.updateJsonAsync<{ l: number[] }>('limit', async c => { await warte(200); return { l: [...(c?.l ?? []), 1] }; });
    await warte(5);
    await expect(db.updateJson<{ l: number[] }>('limit', c => ({ l: [...(c?.l ?? []), 2] }))).rejects.toBeInstanceOf(db.SperreZeitlimit);
    delete process.env.MAKE_OS_SPERR_LIMIT_MS;
    const danach = db.updateJson<{ l: number[] }>('limit', c => ({ l: [...(c?.l ?? []), 3] })); // wartet brav hinter dem Halter
    await lang;
    expect((await danach).l).toEqual([1, 3]);
  });
  it('Sperren liegen auf globalThis: zwei Modul-Instanzen (Hot-Reload) verlieren keine Änderung', async () => {
    vi.resetModules();
    const db2 = await import('../lib/store/local-db');
    expect(db2).not.toBe(db);
    await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? db : db2).updateJsonAsync<{ n: number[] }>('hmr', async c => { await warte(1); return { n: [...(c?.n ?? []), i] }; })));
    expect(((await db.loadJson<{ n: number[] }>('hmr'))!.n).length).toBe(20);
  });
});

describe('Hülle v2: Schlüssel-ID, AAD, Schlüsselring (#52/#54/#55/#50)', () => {
  it('schreibt v2 mit kid; eine unter fremdem Namen zurückgespielte Datei scheitert an der AAD', async () => {
    process.env.MAKE_OS_DATEN_SCHLUESSEL = 'kern-a';
    await db.saveJson('haushalt--a', { geheim: 1 });
    const roh = JSON.parse(readFileSync(datei('haushalt--a'), 'utf8'));
    expect(roh[db.HUELLE]).toBe(2);
    expect(roh.kid).toBe(huelle.schluesselAus('kern-a').kid);
    await fs.copyFile(datei('haushalt--a'), datei('haushalt--b'));
    await expect(db.loadJson('haushalt--b')).rejects.toThrow(/Entschlüsselung/);
  });
  it('v1-Hüllen bleiben lesbar und werden beim nächsten Schreiben v2', async () => {
    process.env.MAKE_OS_DATEN_SCHLUESSEL = 'kern-a';
    writeFileSync(datei('v1'), db.verschluesseln('{"x":1}', db.datenSchluessel()!));
    expect(await db.loadJson('v1')).toEqual({ x: 1 });
    await db.updateJson('v1', c => c);
    expect(JSON.parse(readFileSync(datei('v1'), 'utf8'))[db.HUELLE]).toBe(2);
  });
  it('Rotation im laufenden Betrieb: alt + neu lesbar, Bestand für Bestand umschlüsseln, nie Klartext', async () => {
    process.env.MAKE_OS_DATEN_SCHLUESSEL = 'kern-alt';
    await db.saveJson('rot', { a: 1 });
    await db.saveJson('rot', { a: 2 }); // Tagessicherung mit altem Schlüssel
    process.env.MAKE_OS_DATEN_SCHLUESSEL = 'kern-neu';
    process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT = 'kern-alt';
    expect(await db.loadJson('rot')).toEqual({ a: 2 });
    const r = await db.bestandUmschluesseln('rot');
    expect(r).toMatchObject({ bestand: 'neu', fehler: [] });
    expect(r.sicherungen).toBeGreaterThanOrEqual(1);
    const neuKid = huelle.schluesselAus('kern-neu').kid;
    expect(JSON.parse(readFileSync(datei('rot'), 'utf8')).kid).toBe(neuKid);
    for (const f of (await fs.readdir(path.join(dir, 'backup'))).filter(x => x.startsWith('rot-'))) expect(JSON.parse(readFileSync(path.join(dir, 'backup', f), 'utf8')).kid).toBe(neuKid);
    delete process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT;
    db.leseCacheLeeren();
    expect(await db.loadJson('rot')).toEqual({ a: 2 });
    expect((await db.bestandUmschluesseln('rot')).bestand).toBe('schon');
  });
  it('Schlüssel aus einer Datei (0400) statt aus der Umgebung', async () => {
    const f = path.join(mkdtempSync(path.join(os.tmpdir(), 'make-os-schl-')), 'daten');
    writeFileSync(f, 'aus-datei\n', { mode: 0o400 });
    process.env.MAKE_OS_DATEN_SCHLUESSEL_DATEI = f;
    expect(huelle.schluesselQuelle()).toBe('datei');
    await db.saveJson('aus-datei', { d: 1 });
    expect(JSON.parse(readFileSync(datei('aus-datei'), 'utf8')).kid).toBe(huelle.schluesselAus('aus-datei').kid);
  });
  it('Klartext bei gesetztem Schlüssel wird abgelehnt und für den HOI gemerkt', async () => {
    writeFileSync(datei('untergeschoben'), '{"x":1}');
    process.env.MAKE_OS_DATEN_SCHLUESSEL = 'kern-a';
    await expect(db.loadJson('untergeschoben')).rejects.toBeInstanceOf(db.KlartextBestand);
    expect(db.datenschichtLage().klartext).toContain('untergeschoben');
  });
});

describe('ETag-Zähler, kompaktes JSON, Schemaversion (#41/#76/#22/#24/#26)', () => {
  it('jede Schreibung ändert den Stand — auch bei gleicher Größe', async () => {
    await db.saveJson('etag', { w: 'a' });
    const a = await db.speicherStand(['etag']);
    await db.saveJson('etag', { w: 'b' });
    expect(await db.speicherStand(['etag'])).not.toBe(a);
  });
  it('auf der Platte ohne Einrückung, mit `_v`; gelesen ohne `_v`', async () => {
    await db.saveJson('kompakt', { a: [1, 2] });
    expect(readFileSync(datei('kompakt'), 'utf8')).toBe('{"a":[1,2],"_v":1}');
    expect(await db.loadJson('kompakt')).toEqual({ a: [1, 2] });
    await db.saveJson('liste-roh', [1, 2]); // Arrays tragen kein `_v`
    expect(readFileSync(datei('liste-roh'), 'utf8')).toBe('[1,2]');
    writeFileSync(datei('eingerueckt'), JSON.stringify({ alt: true }, null, 2)); // Lesen bleibt tolerant
    expect(await db.loadJson('eingerueckt')).toEqual({ alt: true });
  });
  it('Migration: alte Form (ohne `_v`) → aktuelle beim Lesen, updateJson speichert sie; idempotent; neuere Version wird nicht überschrieben', async () => {
    const m2 = (d: Record<string, unknown>) => ({ ...d, liste: Array.isArray(d.liste) ? d.liste : [], name: String(d.name ?? '').trim() });
    schema.schemaFuerTestSetzen([{ muster: /^mig$/, version: 2, migrationen: { 2: m2 } }]);
    writeFileSync(datei('mig'), JSON.stringify({ name: ' Probe ' }));
    expect(await db.loadJson('mig')).toEqual({ name: 'Probe', liste: [] });
    await db.updateJson<Record<string, unknown>>('mig', c => ({ ...c!, extra: 1 }));
    const roh = JSON.parse(readFileSync(datei('mig'), 'utf8'));
    expect(roh._v).toBe(2);
    expect(m2(m2({ name: ' x ' }))).toEqual(m2({ name: ' x ' }));
    writeFileSync(datei('mig'), JSON.stringify({ name: 'x', _v: 9 }));
    await expect(db.updateJson('mig', c => c)).rejects.toThrow(/neuer als diese App/);
  });
});

describe('Schreibpause und Abschaltung (#61/#16)', () => {
  it('Schreibpause: neue Schreibungen warten, laufende sind durch; danach geht es weiter', async () => {
    const r = await db.schreibpauseSetzen(2000);
    expect(r.still).toBe(true);
    let fertig = false;
    const w = db.saveJson('pause', { p: 1 }).then(() => { fertig = true; });
    await warte(60);
    expect(fertig).toBe(false);
    db.schreibpauseAufheben();
    await w;
    expect(fertig).toBe(true);
  });
  it('Schreibpause wartet auf eine laufende Schreibung', async () => {
    const lang = db.updateJsonAsync('pause-lang', async () => { await warte(80); return { x: 1 }; });
    await warte(5);
    const t0 = Date.now();
    const r = await db.schreibpauseSetzen(2000);
    expect(r.still).toBe(true);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(50);
    await lang;
  });
  it('Abschaltung: nach dem Nachlauf lehnt die Datenschicht neue Schreibungen mit 503 ab', async () => {
    db.abschaltungBeginnen(Date.now() - 21_000);
    const e = await db.saveJson('ab', { x: 1 }).catch(x => x);
    expect(e).toBeInstanceOf(db.SchreibenGesperrt);
    expect(e.status).toBe(503);
    db.abschaltungZuruecksetzen();
    db.abschaltungBeginnen(Date.now());
    await expect(db.saveJson('ab', { x: 1 })).resolves.toBeUndefined(); // im Nachlauf noch erlaubt
  });
});

describe('Lockfile `.schreiber` (#9)', () => {
  it('lebt nur mit frischem Herzschlag; eigene PID zählt, fremder Host über den Herzschlag', () => {
    const jetzt = Date.now();
    const e = { pid: 999_999, host: 'anderer-host', start: new Date(jetzt).toISOString(), herz: new Date(jetzt - 10_000).toISOString(), art: 'app' };
    expect(schreiber.schreiberLebt(e, jetzt, 'hier')).toBe(true);
    expect(schreiber.schreiberLebt({ ...e, herz: new Date(jetzt - 120_000).toISOString() }, jetzt, 'hier')).toBe(false);
    expect(schreiber.schreiberLebt({ ...e, host: 'hier' }, jetzt, 'hier')).toBe(false); // PID gibt es nicht
    expect(schreiber.schreiberLebt({ ...e, host: 'hier', pid: process.pid }, jetzt, 'hier')).toBe(true);
  });
  it('Skripte brechen ab, solange eine lebende App den Datenordner hält; die App entfernt nur den eigenen Eintrag', async () => {
    const ordner = mkdtempSync(path.join(os.tmpdir(), 'make-os-lock-'));
    const skript = () => spawnSync(process.execPath, ['scripts/daten-verschluesselung.mjs', '--verschluesseln'], { env: { ...process.env, MAKE_OS_DATEN_DIR: ordner, MAKE_OS_DATEN_SCHLUESSEL: 'lock-test', MAKE_OS_PRUEF_PORTE: '1' }, encoding: 'utf8' });
    const jetzt = new Date().toISOString();
    writeFileSync(path.join(ordner, '.schreiber'), JSON.stringify({ pid: 4242, host: 'app-container', start: jetzt, herz: jetzt, art: 'app' }));
    const r = skript();
    expect(r.status).toBe(3);
    expect(r.stderr).toMatch(/laufende App hält den Datenordner/);
    expect(r.stderr).not.toContain('lock-test');
    schreiber.schreiberEntfernenSync(ordner); // fremder Eintrag bleibt
    expect(readFileSync(path.join(ordner, '.schreiber'), 'utf8')).toContain('app-container');
    writeFileSync(path.join(ordner, '.schreiber'), JSON.stringify({ pid: 4242, host: 'app-container', start: jetzt, herz: new Date(Date.now() - 100_000).toISOString(), art: 'app' }));
    expect(skript().status).toBe(0);
    await schreiber.schreiberSetzen(ordner);
    schreiber.schreiberEntfernenSync(ordner);
    await expect(fs.access(path.join(ordner, '.schreiber'))).rejects.toThrow();
    await fs.rm(ordner, { recursive: true, force: true });
  });
});
