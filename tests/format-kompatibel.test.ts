// ─── Kompatibilitätsmodus (29.09. abends): Upload umkehrbar — MAKE_OS_FORMAT kompatibel (Standard) vs. v2 ─
// Der alte Online-Stand aeb4964 liest nur die v1-Hülle ({ __verschluesselt: 1, iv, tag, daten }) und „MKOSDAT1“, prüft die
// Sperrliste nur mit SHA-256 v1 und kennt `_v` nicht. Im Standardmodus „kompatibel“ schreibt die neue App genau so — der
// Rückweg zum alten Stand bleibt offen. Die Prüfungen unten lesen mit dem ALTEN Lesecode (wörtlich aus aeb4964 übernommen).
//
//   (a) kompatibel geschrieben → mit altem Lesecode lesbar (Bestand, Archiv, Rotation)
//   (b) v2-Bestand → nächste Schreibung (auch unverändert) ergibt v1
//   (c) Dateiablage „MKOSDAT1“ → mit alter Logik lesbar
//   (d) Sperrliste: neue Einträge tragen v1 + v2, alter Prüfer greift; keine Umrechnung
//   (e) kein `_v` auf der Platte
//   (f) Modus v2 schreibt wie bisher (v2-Hülle, kid, _v, MKOSDAT2) — die übrigen Tests laufen ohnehin in v2 (vitest.config.ts)
import { describe, it, expect, afterEach, afterAll, beforeEach } from 'vitest';
import { promises as fs, readFileSync, writeFileSync, mkdirSync } from 'fs';
import os from 'os';
import path from 'path';
import { createDecipheriv, createHash } from 'crypto';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-kompat-'));
process.env.MAKE_OS_DATEN_DIR = dir;
const db = await import('../lib/store/local-db');
const huelle = await import('../lib/store/huelle.mjs');
const hb = await import('../lib/store/datei-huelle.mjs');
const archiv = await import('../lib/store/archiv');
const ablage = await import('../lib/dateien/ablage');
const { allesUmschluesseln } = await import('../lib/store/umschluesseln');
const sp = await import('../lib/crm/sperrliste');
const { identitaetsMerkmale } = await import('../lib/make-one/crm');
const { datenschichtBefunde } = await import('../lib/hoi/lage');

const SCHL = 'kompat-test-schluessel-nicht-echt';
const PEPPER = 'kompat-test-pepper-nur-im-test-0123456789abcdef';
const vorherFormat = process.env.MAKE_OS_FORMAT;
beforeEach(() => { delete process.env.MAKE_OS_FORMAT; process.env.MAKE_OS_DATEN_SCHLUESSEL = SCHL; });
afterEach(() => {
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL; delete process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT; delete process.env.MAKE_OS_PEPPER;
  huelle.schluesselNeuLaden(); db.leseCacheLeeren();
});
afterAll(async () => {
  if (vorherFormat === undefined) delete process.env.MAKE_OS_FORMAT; else process.env.MAKE_OS_FORMAT = vorherFormat;
  await fs.rm(dir, { recursive: true, force: true });
});

// ── Alter Lesecode, wörtlich aus aeb4964 (lib/store/local-db.ts, lib/dateien/ablage.ts, lib/crm/sperrliste.ts) ──
const HUELLE = '__verschluesselt';
class SchluesselFehlt extends Error {}
class AblageFehler extends Error { constructor(msg: string, readonly status: number) { super(msg); } }
function datenSchluessel(): Buffer | null {
  const s = process.env.MAKE_OS_DATEN_SCHLUESSEL?.trim();
  return s ? createHash('sha256').update(`make-os-daten:${s}`).digest() : null;
}
/** Hülle → Klartext; ist es keine Hülle, kommt der Text unverändert zurück. Wirft SchluesselFehlt bzw. bei falschem Schlüssel. */
function entschluesseln(json: string, key: Buffer | null): string {
  const o = JSON.parse(json) as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || o[HUELLE] !== 1) return json;
  if (!key) throw new SchluesselFehlt('Der Bestand ist verschlüsselt, MAKE_OS_DATEN_SCHLUESSEL fehlt.');
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(String(o.iv), 'base64'));
  d.setAuthTag(Buffer.from(String(o.tag), 'base64'));
  return Buffer.concat([d.update(Buffer.from(String(o.daten), 'base64')), d.final()]).toString('utf8');
}
const MAGIE = Buffer.from('MKOSDAT1', 'ascii');
const istHuelle = (b: Buffer) => b.length >= MAGIE.length + 28 && b.subarray(0, MAGIE.length).equals(MAGIE);
function inhaltEntschluesseln(huelle: Buffer, key: Buffer | null): Buffer {
  if (!istHuelle(huelle)) throw new AblageFehler('Datei ist keine verschlüsselte Ablage.', 500);
  if (!key) throw new AblageFehler('Die Datei ist verschlüsselt, der Datenschlüssel fehlt.', 503);
  const iv = huelle.subarray(MAGIE.length, MAGIE.length + 12);
  const tag = huelle.subarray(MAGIE.length + 12, MAGIE.length + 28);
  const d = createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  try { return Buffer.concat([d.update(huelle.subarray(MAGIE.length + 28)), d.final()]); }
  catch { throw new AblageFehler('Datei nicht lesbar — falscher Schlüssel oder verändert.', 500); }
}
type Person = Parameters<typeof identitaetsMerkmale>[0];
const altSperrHash = (merkmal: string) => createHash('sha256').update(`make-os-sperre-v1|${merkmal}`).digest('hex');
const altSperrHashes = (k: Person) => identitaetsMerkmale(k).map(altSperrHash);
function altSperrPruefer(eintraege: { h: string[] }[]): (k: Person) => boolean {
  const alle = new Set(eintraege.flatMap(e => e.h));
  return k => alle.size > 0 && altSperrHashes(k).some(x => alle.has(x));
}
// ── Ende alter Code ──

/** Umgebung für die reinen Funktionen (ProcessEnv verlangt sonst NODE_ENV). */
const umg = (x: Record<string, string> = {}) => x as unknown as NodeJS.ProcessEnv;
const roh = (n: string) => readFileSync(path.join(dir, `${n}.json`), 'utf8');
/** So liest aeb4964 einen Bestand: nur v1, Schlüssel nur aus MAKE_OS_DATEN_SCHLUESSEL. */
const altLesen = (n: string) => JSON.parse(entschluesseln(roh(n), datenSchluessel())) as unknown;

describe('Schalter MAKE_OS_FORMAT', () => {
  it('Standard (ohne Variable) = kompatibel; nur „v2“ schaltet um; Unbekanntes gilt als kompatibel und fällt auf', () => {
    expect(huelle.formatModus(umg({}))).toBe('kompatibel');
    expect(huelle.formatModus(umg({ MAKE_OS_FORMAT: 'kompatibel' }))).toBe('kompatibel');
    expect(huelle.formatModus(umg({ MAKE_OS_FORMAT: ' V2 ' }))).toBe('v2');
    expect(huelle.formatModus(umg({ MAKE_OS_FORMAT: 'v3' }))).toBe('kompatibel');
    expect(huelle.formatModusUnbekannt(umg({ MAKE_OS_FORMAT: 'v3' }))).toBe(true);
    expect(huelle.formatModusUnbekannt(umg({}))).toBe(false);
    expect(huelle.schreibVersion(umg({}))).toBe(1);
    expect(huelle.schreibVersion(umg({ MAKE_OS_FORMAT: 'v2' }))).toBe(2);
  });
});

describe('(a) kompatibel geschrieben → mit dem alten Lesecode lesbar', () => {
  it('Bestand: v1-Hülle genau im Format von aeb4964, alter Code öffnet sie', async () => {
    await db.saveJson('kontakte', { kontakte: [{ id: 'c-1', name: 'Erfunden' }] });
    const o = JSON.parse(roh('kontakte'));
    expect(Object.keys(o)).toEqual([HUELLE, 'iv', 'tag', 'daten']);
    expect(o[HUELLE]).toBe(1);
    expect(roh('kontakte')).not.toContain('Erfunden');
    expect(altLesen('kontakte')).toEqual({ kontakte: [{ id: 'c-1', name: 'Erfunden' }] });
    // updateJson ebenso
    await db.updateJson<{ kontakte: { id: string }[] }>('kontakte', c => ({ kontakte: [...c!.kontakte, { id: 'c-2' }] }));
    expect((altLesen('kontakte') as { kontakte: unknown[] }).kontakte).toHaveLength(2);
  });
  it('Archiv: v1-Hülle, alter archivLesen (JSON.parse(entschluesseln(…))) öffnet sie', async () => {
    const n = await archiv.archivSchreiben('crm-vor-umzug-probe.json', { a: [1, 2] });
    const t = readFileSync(path.join(dir, 'archiv', n), 'utf8');
    expect(JSON.parse(t)[HUELLE]).toBe(1);
    expect(JSON.parse(entschluesseln(t, datenSchluessel()))).toEqual({ a: [1, 2] });
    expect(await archiv.archivLesen(n)).toEqual({ a: [1, 2] });
  });
  it('Rotation im laufenden Betrieb: neuer Schlüssel, alles bleibt v1/MKOSDAT1 — alter Code liest mit dem neuen Schlüssel', async () => {
    await db.saveJson('rot', { x: 1 });
    await archiv.archivSchreiben('rot-probe.json', { y: 2 });
    await ablage.inhaltAblegen('haus-r', 'd-rot-1', Buffer.from('ROT-INHALT'));
    // neuer Schlüssel aktiv, alter nur lesend
    process.env.MAKE_OS_DATEN_SCHLUESSEL = `${SCHL}-neu`;
    process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT = SCHL;
    db.leseCacheLeeren();
    const r = await allesUmschluesseln(true);
    expect(r.fehler).toEqual([]);
    delete process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT;
    expect(JSON.parse(roh('rot'))[HUELLE]).toBe(1);
    expect(altLesen('rot')).toEqual({ x: 1 });
    expect(JSON.parse(entschluesseln(readFileSync(path.join(dir, 'archiv', 'rot-probe.json'), 'utf8'), datenSchluessel()))).toEqual({ y: 2 });
    expect(inhaltEntschluesseln(readFileSync(ablage.dateiPfad('haus-r', 'd-rot-1')), datenSchluessel()).toString()).toBe('ROT-INHALT');
    // Zweiter Lauf: alles schon passend (v1 mit dem aktiven Schlüssel wird erkannt)
    const r2 = await allesUmschluesseln(true);
    expect(r2.bestaende.neu).toBe(0);
    expect(r2.archiv.neu).toBe(0);
    expect(r2.ablage.neu).toBe(0);
  });
});

describe('(b) v2 gelesen → kompatibel geschrieben ergibt v1', () => {
  it('ein v2-Bestand (mit `_v`) wird gelesen und bei der nächsten Schreibung v1 — auch wenn sich nichts ändert', async () => {
    const s = huelle.schluesselAus(SCHL);
    writeFileSync(path.join(dir, 'aufgaben-probe.json'), huelle.huelleSchreiben(JSON.stringify({ l: [1], _v: 1 }), s, 'aufgaben-probe'));
    expect(await db.loadJson('aufgaben-probe')).toEqual({ l: [1] });
    // Der alte Stand sähe die v2-Hülle als Klartext-Objekt (genau das Problem) …
    expect((altLesen('aufgaben-probe') as Record<string, unknown>)[HUELLE]).toBe(2);
    // … nach einer unveränderten Schreibung liegt v1 da, ohne `_v`:
    await db.saveJson('aufgaben-probe', { l: [1] });
    expect(JSON.parse(roh('aufgaben-probe'))[HUELLE]).toBe(1);
    expect(altLesen('aufgaben-probe')).toEqual({ l: [1] });
  });
  it('Rotation/Umschlüsseln bringt v2-Hüllen (Bestand, Tagessicherung, Archiv, Datei) zurück auf v1', async () => {
    const s = huelle.schluesselAus(SCHL);
    writeFileSync(path.join(dir, 'zurueck.json'), huelle.huelleSchreiben('{"z":1}', s, 'zurueck'));
    mkdirSync(path.join(dir, 'backup'), { recursive: true });
    writeFileSync(path.join(dir, 'backup', 'zurueck-2026-09-28.json'), huelle.huelleSchreiben('{"z":0}', s, 'zurueck'));
    mkdirSync(path.join(dir, 'archiv'), { recursive: true });
    writeFileSync(path.join(dir, 'archiv', 'zurueck-probe.json'), huelle.huelleSchreiben('{"a":1}', s, 'archiv/zurueck-probe.json'));
    mkdirSync(ablage.haushaltOrdner('haus-z'), { recursive: true });
    writeFileSync(ablage.dateiPfad('haus-z', 'd-zurueck-1'), hb.binSchreiben(Buffer.from('Z-INHALT'), s, 'haus-z', 'd-zurueck-1'));
    process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT = `${SCHL}-neu`; // Dateien aus dem Rotations-Test oben (liegen mit dem neuen Schlüssel)
    const r = await allesUmschluesseln(true);
    delete process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT;
    expect(r.fehler).toEqual([]);
    expect(altLesen('zurueck')).toEqual({ z: 1 });
    expect(JSON.parse(entschluesseln(readFileSync(path.join(dir, 'backup', 'zurueck-2026-09-28.json'), 'utf8'), datenSchluessel()))).toEqual({ z: 0 });
    expect(JSON.parse(entschluesseln(readFileSync(path.join(dir, 'archiv', 'zurueck-probe.json'), 'utf8'), datenSchluessel()))).toEqual({ a: 1 });
    expect(inhaltEntschluesseln(readFileSync(ablage.dateiPfad('haus-z', 'd-zurueck-1')), datenSchluessel()).toString()).toBe('Z-INHALT');
  });
  it('scripts/daten-verschluesselung.mjs --verschluesseln stellt im kompatiblen Modus v2 → v1 und MKOSDAT2 → MKOSDAT1 um', async () => {
    const { execFileSync } = await import('node:child_process');
    const d2 = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-kompat-skript-'));
    try {
      const s = huelle.schluesselAus(SCHL);
      writeFileSync(path.join(d2, 'crm.json'), huelle.huelleSchreiben('{"chancen":[]}', s, 'crm'));
      writeFileSync(path.join(d2, 'klar.json'), '{"k":1}');
      mkdirSync(path.join(d2, 'dateien', 'haus-s'), { recursive: true });
      writeFileSync(path.join(d2, 'dateien', 'haus-s', 'd-skript-1.bin'), hb.binSchreiben(Buffer.from('S-INHALT'), s, 'haus-s', 'd-skript-1'));
      const env: NodeJS.ProcessEnv = { ...process.env, MAKE_OS_DATEN_DIR: d2, MAKE_OS_PRUEF_PORTE: '1', MAKE_OS_DATEN_SCHLUESSEL: SCHL };
      delete env.MAKE_OS_FORMAT; // Standard = kompatibel
      const aus = execFileSync(process.execPath, ['scripts/daten-verschluesselung.mjs', '--verschluesseln'], { env, stdio: 'pipe' }).toString();
      expect(aus).toMatch(/Schreibformat: kompatibel/);
      for (const n of ['crm', 'klar']) expect(JSON.parse(readFileSync(path.join(d2, `${n}.json`), 'utf8'))[HUELLE]).toBe(1);
      expect(JSON.parse(entschluesseln(readFileSync(path.join(d2, 'crm.json'), 'utf8'), datenSchluessel()))).toEqual({ chancen: [] });
      const b = readFileSync(path.join(d2, 'dateien', 'haus-s', 'd-skript-1.bin'));
      expect(inhaltEntschluesseln(b, datenSchluessel()).toString()).toBe('S-INHALT');
      // zweiter Lauf: nichts mehr zu tun
      expect(execFileSync(process.execPath, ['scripts/daten-verschluesselung.mjs', '--verschluesseln'], { env, stdio: 'pipe' }).toString()).toMatch(/0 Dateien umgestellt/);
    } finally { await fs.rm(d2, { recursive: true, force: true }); }
  });
  it('reine Hülle: huelleAktuell/binAktuell richten sich nach dem Modus', () => {
    const ring = huelle.schluesselRing(umg({ MAKE_OS_DATEN_SCHLUESSEL: SCHL }));
    const v1 = JSON.parse(huelle.huelleV1Schreiben('{}', ring.aktiv!.key));
    const v2 = JSON.parse(huelle.huelleSchreiben('{}', ring.aktiv!, 'x'));
    expect(huelle.huelleAktuell(v1, ring, 'x', umg({}))).toBe(true);
    expect(huelle.huelleAktuell(v2, ring, 'x', umg({}))).toBe(false);
    expect(huelle.huelleAktuell(v1, ring, 'x', umg({ MAKE_OS_FORMAT: 'v2' }))).toBe(false);
    expect(huelle.huelleAktuell(v2, ring, 'x', umg({ MAKE_OS_FORMAT: 'v2' }))).toBe(true);
    expect(hb.binAktuell({ version: 1, kid: ring.aktiv!.kid }, ring.aktiv, umg({}))).toBe(true);
    expect(hb.binAktuell({ version: 2, kid: ring.aktiv!.kid }, ring.aktiv, umg({}))).toBe(false);
    expect(hb.binVersion(hb.binImModus(Buffer.from('a'), ring.aktiv!, 'h', 'd-1', umg({})))).toBe(1);
    expect(hb.binVersion(hb.binImModus(Buffer.from('a'), ring.aktiv!, 'h', 'd-1', umg({ MAKE_OS_FORMAT: 'v2' })))).toBe(2);
  });
});

describe('(c) Dateiablage kompatibel: „MKOSDAT1“, mit alter Logik lesbar', () => {
  it('inhaltAblegen schreibt MKOSDAT1; der alte Leser (istHuelle + inhaltEntschluesseln) öffnet sie; neu liest beides', async () => {
    await ablage.inhaltAblegen('haus-a', 'd-kompat-1', Buffer.from('%PDF-erfunden'));
    const b = readFileSync(ablage.dateiPfad('haus-a', 'd-kompat-1'));
    expect(b.subarray(0, 8).toString('ascii')).toBe('MKOSDAT1');
    expect(istHuelle(b)).toBe(true);
    expect(b.includes(Buffer.from('%PDF-erfunden'))).toBe(false);
    expect(inhaltEntschluesseln(b, datenSchluessel()).toString()).toBe('%PDF-erfunden');
    expect((await ablage.inhaltLaden('haus-a', 'd-kompat-1'))!.toString()).toBe('%PDF-erfunden');
    // v2-Datei wird weiter gelesen
    writeFileSync(ablage.dateiPfad('haus-a', 'd-kompat-2'), hb.binSchreiben(Buffer.from('V2'), huelle.schluesselAus(SCHL), 'haus-a', 'd-kompat-2'));
    expect((await ablage.inhaltLaden('haus-a', 'd-kompat-2'))!.toString()).toBe('V2');
  });
});

describe('(d) Sperrliste kompatibel: greift auch mit dem alten SHA-Wert', () => {
  const person = { email: 'erfunden.person@beispiel.test', vorname: 'Erfa', nachname: 'Probe', firma: 'Probe GmbH' };
  it('neue Einträge tragen v1 UND v2; der alte Prüfer (nur SHA-256 v1) erkennt die Person', async () => {
    process.env.MAKE_OS_PEPPER = PEPPER;
    expect(await sp.sperren([person], 'werbesperre', '2026-09-29')).toBe(1);
    const liste = await sp.sperrlisteLaden();
    const h = liste.flatMap(e => e.h);
    for (const x of altSperrHashes(person)) expect(h).toContain(x);
    for (const m of identitaetsMerkmale(person)) expect(h).toContain(sp.sperrHashV2(m));
    expect(altSperrPruefer(liste)(person)).toBe(true);
    expect(sp.sperrPruefer(liste)(person)).toBe(true);
    // Auf der Platte (v1-Hülle) — so, wie der alte Stand die Liste liest
    const platte = altLesen('crm-sperrliste--haupt') as { eintraege: { h: string[] }[] };
    expect(altSperrPruefer(platte.eintraege)(person)).toBe(true);
    // Grabsteine tragen ebenso beide (sie füllen nach einem Restore die Sperrliste)
    expect(sp.sperrHashes(person)).toEqual(expect.arrayContaining(altSperrHashes(person)));
  });
  it('bestehende v1-Einträge werden NICHT auf v2 umgerechnet; Aufnehmen einer bekannten Person lässt v1 stehen', () => {
    process.env.MAKE_OS_PEPPER = PEPPER;
    const alt = [{ h: altSperrHashes(person), grund: 'loeschung' as const, am: '2026-09-01' }];
    expect(sp.sperrlisteUmrechnen(alt, [person]).umgerechnet).toBe(0);
    const mit = sp.sperrlisteMit(alt, person, 'loeschung', '2026-09-29').eintraege;
    for (const x of altSperrHashes(person)) expect(mit[0].h).toContain(x);
    // Im Format v2 (bisheriges Verhalten): Umrechnung ersetzt v1 durch v2
    process.env.MAKE_OS_FORMAT = 'v2';
    const um = sp.sperrlisteUmrechnen(alt, [person]);
    expect(um.umgerechnet).toBe(1);
    expect(altSperrPruefer(um.eintraege)(person)).toBe(false);
    expect(sp.sperrHashes(person)).not.toEqual(expect.arrayContaining(altSperrHashes(person)));
  });
});

describe('(e) kein `_v` auf der Platte im kompatiblen Modus', () => {
  it('mit und ohne Schlüssel, saveJson und updateJson; ein vorhandenes `_v` verschwindet bei der nächsten Schreibung', async () => {
    await db.saveJson('journal-probe', { '2026-09-29': { text: 'erfunden' } });
    await db.updateJson<Record<string, unknown>>('journal-probe', c => ({ ...c, '2026-09-30': { text: 'auch erfunden' } }));
    const klar = entschluesseln(roh('journal-probe'), datenSchluessel());
    expect(klar).not.toContain('"_v"');
    expect(Object.keys(JSON.parse(klar))).toEqual(['2026-09-29', '2026-09-30']);
    delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
    await db.saveJson('ohne-schluessel', { a: 1 });
    expect(roh('ohne-schluessel')).toBe('{"a":1}');
    writeFileSync(path.join(dir, 'mit-v.json'), '{"a":1,"_v":1}');
    await db.updateJson<{ a: number }>('mit-v', c => ({ a: c!.a + 1 }));
    expect(roh('mit-v')).toBe('{"a":2}');
    // Durchsicht rechnet fehlendes `_v` im kompatiblen Modus nicht als „alte Form“, eine v1-Hülle nicht als „alt“
    process.env.MAKE_OS_DATEN_SCHLUESSEL = SCHL;
    const { durchsicht } = await import('../lib/store/durchsicht');
    const { ergebnis } = await durchsicht();
    expect(ergebnis.alteForm).toBe(0);
  });
});

describe('(f) Modus v2 unverändert', () => {
  it('v2-Hülle mit kid, `_v` auf der Platte, Ablage MKOSDAT2', async () => {
    process.env.MAKE_OS_FORMAT = 'v2';
    await db.saveJson('neu-v2', { a: 1 });
    const o = JSON.parse(roh('neu-v2'));
    expect(o[HUELLE]).toBe(2);
    expect(o.kid).toBe(huelle.schluesselAus(SCHL).kid);
    const r = huelle.huelleOeffnen(o, huelle.schluesselRing(), 'neu-v2');
    expect(JSON.parse(r.text)).toEqual({ a: 1, _v: 1 });
    await ablage.inhaltAblegen('haus-v', 'd-v2-1', Buffer.from('X'));
    expect(readFileSync(ablage.dateiPfad('haus-v', 'd-v2-1')).subarray(0, 8).toString('ascii')).toBe('MKOSDAT2');
    // und ein v1-Bestand wird in v2 bei der nächsten Schreibung v2 (bisheriges Verhalten)
    delete process.env.MAKE_OS_FORMAT;
    await db.saveJson('hin-und-her', { b: 1 });
    expect(JSON.parse(roh('hin-und-her'))[HUELLE]).toBe(1);
    process.env.MAKE_OS_FORMAT = 'v2';
    await db.saveJson('hin-und-her', { b: 1 });
    expect(JSON.parse(roh('hin-und-her'))[HUELLE]).toBe(2);
  });
});

describe('Head of IT zeigt den Modus', () => {
  const JETZT = '2026-09-29T08:00:00.000Z';
  const basisInnen = {
    zeit: JETZT, prozess: { laufzeitStunden: 1, heapMb: 100, rssMb: 300, node: 'v22' }, bestaende: { anzahl: 1, gesamtMb: 1, groesste: [] },
    takt: { letzterLaufMinuten: 1, fehlerquote24h: 0, wartend: 0, laufend: 0 }, fehler: { client24h: 0 }, anmeldungen: { fehl24h: 0, neueNetze7d: 0 },
    csp: { meldungen7d: 0 }, verschluesselt: true, ki: { schluessel: true, guthabenLeerSeit: null },
  };
  const q = { p50: 1, p99: 5, n: 10 };
  const ds = (x: Record<string, unknown>) => ({
    sperrWarten: q, sperrHalten: q, schreiben: q, zaehler: { '409': 0, '413': 0, sperrZeitlimit: 0, sicherungFehler: 0, klartextAbgelehnt: 0 },
    parseLangsam: [], sicherungFehler: { anzahl: 0 }, klartext: [], tmpReste: 0, fremderSchreiber: null, schluesselQuelle: 'datei' as const, ...x,
  });
  it('kompatibel gelb mit Hinweis auf den Rückweg, v2 grün', () => {
    const gelb = datenschichtBefunde({ ...basisInnen, datenschicht: ds({ format: 'kompatibel' }) }, null, JETZT).find(b => b.id === 'format');
    expect(gelb?.ampel).toBe('gelb');
    expect(gelb?.satz).toMatch(/Kompatibilitätsmodus — Rückweg zum alten Stand möglich; nach stabilen Tagen auf v2 umstellen/);
    const gruen = datenschichtBefunde({ ...basisInnen, datenschicht: ds({ format: 'v2' }) }, null, JETZT).find(b => b.id === 'format');
    expect(gruen?.ampel).toBe('gruen');
  });
  it('innenLage meldet den Modus aus der Umgebung', async () => {
    const { innenLage } = await import('../lib/hoi/innen');
    expect((await innenLage()).datenschicht?.format).toBe('kompatibel');
    process.env.MAKE_OS_FORMAT = 'v2';
    expect((await innenLage()).datenschicht?.format).toBe('v2');
  });
});
