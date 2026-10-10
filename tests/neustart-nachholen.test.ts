/* eslint-disable @typescript-eslint/no-explicit-any -- die Tests lesen Bestände als JSON */
// ─── Neustart: Business-Heads aus dem Archiv nachholen (09.10.2026 spät; lib/neustart/nachholen*.mjs, scripts/neustart-nachholen.mjs) ─────
// Regel 09.10.: „Firma und Privat liegen getrennt — auch in der Datenhaltung“ → nur head-sales/-marketing/-event. Erfundene Daten in Wegwerf-
// Ordnern (nie .data). Geprüft: nur erlaubte Namen (nie Konten/Zugänge, Gesundheit, Finanzen, gemischte Bestände) · Filter (Merksätze,
// entschiedene Vorschläge, Autonomie — keine Berichte, keine offenen) · Probelauf schreibt nichts · Ziel fehlt → neu, Ziel da → zusammengeführt
// (Ziel gewinnt) mit Sicherung der bisherigen Datei · dieselbe Krypto (v2 und kompatibel, AAD = Bestandsname) · App hält den Ordner → Code 3 ·
// unlesbar → nichts geschrieben · Kommandozeile.
import { describe, it, expect, afterAll } from 'vitest';
import { promises as fs, existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { schluesselRing, huelleImModus, huelleOeffnen, huellenVersion } from '@/lib/store/huelle.mjs';
import * as N from '@/lib/neustart/nachholen.mjs';
import { nachholenLaufen, NachholenAbbruch } from '@/lib/neustart/nachholen-lauf.mjs';

const wurzel = mkdtempSync(path.join(os.tmpdir(), 'make-os-nachholen-'));
afterAll(() => rmSync(wurzel, { recursive: true, force: true }));
const KEY = 'pruef-schluessel-nachholen-nicht-echt';
const envMit = (format: 'v2' | 'kompatibel', key: string | null = KEY): NodeJS.ProcessEnv => {
  const e: NodeJS.ProcessEnv = { ...process.env, MAKE_OS_FORMAT: format === 'v2' ? 'v2' : '' };
  delete e.MAKE_OS_DATEN_SCHLUESSEL_DATEI;
  if (key) e.MAKE_OS_DATEN_SCHLUESSEL = key; else delete e.MAKE_OS_DATEN_SCHLUESSEL;
  if (format !== 'v2') delete e.MAKE_OS_FORMAT;
  return e;
};
let nr = 0;
const ordnerPaar = async () => { const a = path.join(wurzel, `archiv-${++nr}`), d = path.join(wurzel, `daten-${nr}`); await fs.mkdir(a, { recursive: true }); await fs.mkdir(d, { recursive: true }); return { a, d }; };
const schreibe = async (ordner: string, name: string, wert: unknown, env: NodeJS.ProcessEnv) => {
  const ring = schluesselRing(env);
  const text = JSON.stringify(wert);
  await fs.writeFile(path.join(ordner, `${name}.json`), ring.aktiv ? huelleImModus(text, ring.aktiv, name, env) : text);
};
const lies = async (ordner: string, name: string, env: NodeJS.ProcessEnv) => {
  const roh = await fs.readFile(path.join(ordner, `${name}.json`), 'utf8');
  const o = JSON.parse(roh);
  return { o, wert: huellenVersion(o) ? JSON.parse(huelleOeffnen(o, schluesselRing(env), name).text) : o };
};

const STAND = {
  berichte: [{ id: 'b1', zeit: '2026-10-01T08:00:00Z', modus: 'power_hour', antwort: { text: 'BERICHT-INHALT' } }],
  vorschlaege: [
    { id: 'hs-1', art: 'nachfassen', titel: 'Vorschlag eins', status: 'angenommen', entschieden: '2026-10-01', aktualisiert: '2026-10-01' },
    { id: 'hs-2', art: 'nachfassen', titel: 'Vorschlag zwei', status: 'abgelehnt', grund: 'zeitpunkt', entschieden: '2026-10-02', aktualisiert: '2026-10-02' },
    { id: 'hs-3', art: 'kampagne', titel: 'OFFEN-MARKE', status: 'offen', aktualisiert: '2026-10-03' },
  ],
  letzte: { power_hour: '2026-10-08T07:00:00Z' }, versuche: { power_hour: '2026-10-08T07:00:00Z' }, ruhig: { zeit: 'x', text: 'y' },
  gedaechtnis: [{ id: 'm1', text: 'Wir duzen.', von: 'person-a', am: '2026-09-30', quelle: 'hand' }],
  autonomie: 'aus',
};

describe('Welche Bestände (rein)', () => {
  it('nur die Business-Heads — nie Konten/Zugänge, Gesundheit, Finanzen, gemischte oder private Bestände', () => {
    expect(N.NACHHOLBAR.map(e => e.name)).toEqual(['head-sales', 'head-marketing', 'head-event']);
    expect(N.nachholenPruefen(['head-sales', 'head-marketing', 'head-event'])).toEqual([]);
    for (const n of ['konten', 'google-verbindung--a', 'agents-config', 'agenten-skills--haus', 'agenten-skills-privat--a', 'agenten-einstellung--haus', 'zoe-gedaechtnis', 'zoe-stapel', 'zoe-verlauf', 'agent-log', 'heads-replay-sales', 'kompass', 'vitals--a', 'finanzplan', 'finanzchef', 'haushalt-chef--h', 'kontakte', 'unbekannt']) {
      expect(N.nachholenGrund(n), n).not.toBeNull();
    }
    expect(N.nachholenPruefen([])).toHaveLength(1);
    expect(N.nachholenPruefen(['head-sales', 'agents-config'])[0]).toContain('agents-config');
  });
  it('Filter: Merksätze, entschiedene Vorschläge, Autonomie — keine Berichte, keine offenen, keine Takt-Zeiten', () => {
    const f = N.headStandFiltern(STAND);
    expect(f.berichte).toEqual([]);
    expect(f.vorschlaege.map(v => v.id)).toEqual(['hs-1', 'hs-2']);
    expect(f.gedaechtnis?.map(m => m.id)).toEqual(['m1']);
    expect(f.autonomie).toBe('aus');
    expect(f.letzte).toEqual({}); expect(f.versuche).toEqual({});
    expect(JSON.stringify(f)).not.toMatch(/BERICHT-INHALT|OFFEN-MARKE|ruhig/);
  });
  it('Zusammenführen: das Ziel gewinnt; aus dem Archiv nur, was fehlt', () => {
    const ziel = { berichte: [{ id: 'neu' }], vorschlaege: [{ id: 'hs-1', status: 'abgelehnt', titel: 'schon entschieden' }], letzte: { a: 'x' }, versuche: {}, autonomie: 'intern' };
    const z = N.headStandZusammenfuehren(ziel, STAND);
    expect(z.neu).toBe(2); // hs-2 + Merksatz m1 (Autonomie hat das Ziel schon)
    expect((z.wert.vorschlaege as any[]).map(v => [v.id, v.status])).toEqual([['hs-1', 'abgelehnt'], ['hs-2', 'abgelehnt']]);
    expect(z.wert.autonomie).toBe('intern');
    expect(z.wert.berichte).toEqual([{ id: 'neu' }]);
    expect(N.headStandZusammenfuehren(z.wert, STAND).neu).toBe(0);
  });
});

describe('Ablauf mit Dateien', () => {
  it('Probelauf schreibt nichts; Ausführen: neu (gefiltert, v2-Hülle mit AAD = Name), zurückgelesen', async () => {
    const env = envMit('v2');
    const { a, d } = await ordnerPaar();
    await schreibe(a, 'head-sales', { ...STAND, _v: 1 }, env);
    await schreibe(a, 'head-event', STAND, env);
    const probe = await nachholenLaufen({ archiv: a, daten: d, bestaende: ['head-sales', 'head-marketing'], env });
    expect(probe.probelauf).toBe(true);
    expect(probe.bestaende.map(s => [s.name, s.aktion])).toEqual([['head-sales', 'neu'], ['head-marketing', 'fehlt-im-archiv']]);
    expect(probe.bestaende[0].nachher).toEqual({ merksaetze: 1, entschieden: 2, offen: 0, berichte: 0, autonomie: 'aus' });
    expect(await fs.readdir(d)).toEqual([]);
    const aus = await nachholenLaufen({ archiv: a, daten: d, bestaende: ['head-sales'], env, ausfuehren: true });
    expect(aus.geschrieben).toEqual({ bestaende: 1, gesichert: [] });
    const { o, wert } = await lies(d, 'head-sales', env);
    expect(huellenVersion(o)).toBe(2);
    expect(wert.vorschlaege.map((v: any) => v.id)).toEqual(['hs-1', 'hs-2']);
    expect(wert._v).toBe(1);
    expect(existsSync(path.join(d, 'head-event.json'))).toBe(false); // nicht genannt → nicht geholt
    expect(existsSync(path.join(d, '.schreiber'))).toBe(false);
  });
  it('Ziel vorhanden → zusammengeführt (Ziel gewinnt), bisherige Datei unverändert gesichert; zweiter Lauf: nichts zu tun', async () => {
    const env = envMit('v2');
    const { a, d } = await ordnerPaar();
    await schreibe(a, 'head-sales', STAND, env);
    const ziel = { berichte: [{ id: 'heute' }], vorschlaege: [{ id: 'hs-9', status: 'offen', titel: 'heute offen' }], letzte: {}, versuche: {} };
    await schreibe(d, 'head-sales', ziel, env);
    const vorherRoh = await fs.readFile(path.join(d, 'head-sales.json'), 'utf8');
    const r = await nachholenLaufen({ archiv: a, daten: d, bestaende: ['head-sales'], env, ausfuehren: true, jetzt: new Date('2026-10-10T06:00:00Z') });
    expect(r.bestaende[0].aktion).toBe('zusammengefuehrt');
    expect(r.geschrieben?.gesichert).toEqual(['archiv/nachholen-vor-head-sales-2026-10-10T06-00-00-000Z.json']);
    expect(await fs.readFile(path.join(d, r.geschrieben!.gesichert[0]), 'utf8')).toBe(vorherRoh);
    const { wert } = await lies(d, 'head-sales', env);
    expect(wert.berichte).toEqual([{ id: 'heute' }]);
    expect(wert.vorschlaege.map((v: any) => v.id)).toEqual(['hs-9', 'hs-1', 'hs-2']);
    expect(wert.autonomie).toBe('aus');
    const zweiter = await nachholenLaufen({ archiv: a, daten: d, bestaende: ['head-sales'], env, ausfuehren: true });
    expect(zweiter.bestaende[0].aktion).toBe('unveraendert');
    expect(zweiter.geschrieben).toEqual({ bestaende: 0, gesichert: [] });
  });
  it('Format kompatibel: v1-Hülle, kein `_v`', async () => {
    const env = envMit('kompatibel');
    const { a, d } = await ordnerPaar();
    await schreibe(a, 'head-marketing', { ...STAND, _v: 2 }, envMit('v2'));
    await nachholenLaufen({ archiv: a, daten: d, bestaende: ['head-marketing'], env, ausfuehren: true });
    const { o, wert } = await lies(d, 'head-marketing', env);
    expect(huellenVersion(o)).toBe(1);
    expect(wert._v).toBeUndefined();
    expect(wert.gedaechtnis).toHaveLength(1);
  });
  it('Abbrüche: verbotener Name, unlesbar (falscher Schlüssel), `.data`, App hält den Ordner — nichts geschrieben', async () => {
    const env = envMit('v2');
    const { a, d } = await ordnerPaar();
    await schreibe(a, 'head-sales', STAND, envMit('v2', 'ein-ganz-anderer-schluessel-nicht-echt'));
    const fang = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { return e as NachholenAbbruch; } };
    const verboten = await fang(nachholenLaufen({ archiv: a, daten: d, bestaende: ['agents-config'], env, ausfuehren: true }));
    expect(verboten).toBeInstanceOf(NachholenAbbruch);
    expect(verboten!.code).toBe(2);
    const unlesbar = await fang(nachholenLaufen({ archiv: a, daten: d, bestaende: ['head-sales'], env, ausfuehren: true }));
    expect(unlesbar!.code).toBe(2);
    expect(unlesbar!.gruende[0]).toContain('NICHTS geschrieben');
    const data = await fang(nachholenLaufen({ archiv: path.join(wurzel, '.data', 'x'), daten: d, bestaende: ['head-sales'], env }));
    expect(data!.gruende[0]).toContain('.data');
    await fs.writeFile(path.join(d, '.schreiber'), JSON.stringify({ pid: 1, host: 'anderer-container', start: new Date().toISOString(), herz: new Date().toISOString(), art: 'app' }));
    const app = await fang(nachholenLaufen({ archiv: a, daten: d, bestaende: ['head-sales'], env, ausfuehren: true }));
    expect(app!.code).toBe(3);
    expect((await fs.readdir(d)).filter(x => x !== '.schreiber')).toEqual([]);
  });
  it('Kommandozeile: Probelauf mit Bericht (nur Namen und Zahlen), ohne Bestände Abbruch 2', async () => {
    const env = envMit('v2');
    const { a, d } = await ordnerPaar();
    await schreibe(a, 'head-sales', STAND, env);
    const skript = path.resolve('scripts/neustart-nachholen.mjs');
    const ok = spawnSync(process.execPath, [skript, '--archiv', a, '--daten', d, '--bestand', 'head-sales'], { env, encoding: 'utf8' });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain('PROBELAUF');
    expect(ok.stdout).toContain('2 entschiedene Vorschläge');
    expect(ok.stdout).not.toMatch(/Vorschlag eins|Wir duzen/);
    const ohne = spawnSync(process.execPath, [skript, '--archiv', a, '--daten', d], { env, encoding: 'utf8' });
    expect(ohne.status).toBe(2);
    expect(await fs.readdir(d)).toEqual([]);
  });
});
