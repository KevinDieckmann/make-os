// Paket D-A (29.09.): Betrieb der Datenschicht — Durchsicht (#85/#89/#75), HOI-Befunde (#8/#60/#86/#87/#88),
// Einzel-Restore (#63), Rotation im laufenden Betrieb (#52), Schreibpause-Route (#61), 409/413-Zähler.
import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { promises as fs, writeFileSync, readFileSync, mkdirSync } from 'fs';
import os from 'os';
import path from 'path';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-betrieb-'));
process.env.MAKE_OS_DATEN_DIR = dir;
process.env.MAKE_OS_KEY = process.env.MAKE_OS_KEY || 'dienst-schluessel-nur-fuer-den-test-0123456789';
const db = await import('../lib/store/local-db');
const huelle = await import('../lib/store/huelle.mjs');
const { durchsichtLauf, spruengeFinden, zeilenZaehlen } = await import('../lib/store/durchsicht');
const { datenschichtBefunde } = await import('../lib/hoi/lage');
const mess = await import('../lib/store/messwerte');
afterEach(() => { delete process.env.MAKE_OS_DATEN_SCHLUESSEL; delete process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT; huelle.schluesselNeuLaden(); db.leseCacheLeeren(); });
afterAll(() => fs.rm(dir, { recursive: true, force: true }));

const JETZT = '2026-09-29T08:00:00.000Z';
const basisInnen = {
  zeit: JETZT, prozess: { laufzeitStunden: 1, heapMb: 100, rssMb: 300, node: 'v22' }, bestaende: { anzahl: 1, gesamtMb: 1, groesste: [] },
  takt: { letzterLaufMinuten: 1, fehlerquote24h: 0, wartend: 0, laufend: 0 }, fehler: { client24h: 0 }, anmeldungen: { fehl24h: 0, neueNetze7d: 0 },
  csp: { meldungen7d: 0 }, verschluesselt: true, ki: { schluessel: true, guthabenLeerSeit: null },
};
const q = (p50: number | null, p99: number | null) => ({ p50, p99, n: 10 });
const ds = (x: Partial<import('../lib/hoi/lage').DatenschichtLage> = {}) => ({
  sperrWarten: q(1, 5), sperrHalten: q(2, 8), schreiben: q(3, 9), zaehler: { '409': 0, '413': 0, sperrZeitlimit: 0, sicherungFehler: 0, klartextAbgelehnt: 0 },
  parseLangsam: [], sicherungFehler: { anzahl: 0 }, klartext: [], tmpReste: 0, fremderSchreiber: null, schluesselQuelle: 'datei' as const, ...x,
});

describe('Durchsicht der Bestände', () => {
  it('rein: Zeilen zählen, Sprünge ab −20 % (ab 10 Zeilen) und verschwundene Bestände', () => {
    expect(zeilenZaehlen({ a: [1, 2], b: [3], _v: 1 })).toBe(3);
    expect(zeilenZaehlen([1, 2, 3])).toBe(3);
    expect(spruengeFinden({ kontakte: 100, crm: 50, klein: 5, weg: 20 }, { kontakte: 79, crm: 45, klein: 1 })).toEqual([
      { name: 'weg', vorher: 20, nachher: 0 }, { name: 'kontakte', vorher: 100, nachher: 79 },
    ]);
  });
  it('liest jeden Bestand, zählt, merkt sich den Tag (Riegel) und meldet Unlesbares ohne Inhalt', async () => {
    await db.saveJson('kontakte', { kontakte: Array.from({ length: 12 }, (_, i) => ({ id: `c-${i}` })) });
    await db.saveJson('crm', { chancen: [{ id: 'ch-1' }] });
    writeFileSync(path.join(dir, 'kaputt-probe.json'), '{"geheimer-inhalt": ');
    const r1 = await durchsichtLauf(new Date('2026-09-28T04:10:00Z'), true);
    expect(r1.ergebnis!.fehler.map(f => f.name)).toContain('kaputt-probe');
    expect(JSON.stringify(r1.ergebnis)).not.toContain('geheimer-inhalt');
    await fs.rm(path.join(dir, 'kaputt-probe.json'));
    await db.saveJson('kontakte', { kontakte: [{ id: 'c-1' }] }); // über Nacht geschrumpft
    const r2 = await durchsichtLauf(new Date('2026-09-29T04:10:00Z'));
    expect(r2.ok).toBe(true);
    expect(r2.ergebnis!.spruenge).toEqual([{ name: 'kontakte', vorher: 12, nachher: 1 }]);
    expect((await durchsichtLauf(new Date('2026-09-29T05:00:00Z'))).uebersprungen).toBe(true);
  });
});

describe('HOI: Befunde der Datenschicht und Sicherung', () => {
  const finde = (b: ReturnType<typeof datenschichtBefunde>, id: string) => b.find(x => x.id === id);
  it('Sicherung: gescheitert rot, ohne Pause gelb, Ping fehlt = Pflicht-Warnung, Mac-Abholung > 48 h rot', () => {
    const rot = datenschichtBefunde({ ...basisInnen, sicherungLauf: { zeit: JETZT, ok: false, grund: 'sicherung.pub fehlt', ping: 'fehlt' } }, null, JETZT);
    expect(finde(rot, 'sicherung-geprueft')).toMatchObject({ ampel: 'rot', satz: 'sicherung.pub fehlt' });
    expect(finde(rot, 'sicherung-ping')).toMatchObject({ ampel: 'gelb', wert: 'nicht eingerichtet' });
    const gut = datenschichtBefunde({ ...basisInnen, sicherungLauf: { zeit: JETZT, ok: true, ping: 'ok', schnappschuss: 'mit-pause', dateien: 90, pruefung: { ok: true, bestaende: 80, datensaetze: 4000 } } }, { zeit: JETZT, abholung: { alter_stunden: 5 } }, JETZT);
    expect(finde(gut, 'sicherung-geprueft')?.ampel).toBe('gruen');
    expect(finde(gut, 'sicherung-ping')?.ampel).toBe('gruen');
    expect(finde(gut, 'abholung')?.ampel).toBe('gruen');
    expect(finde(datenschichtBefunde({ ...basisInnen, sicherungLauf: { zeit: JETZT, ok: true, ping: 'ok', schnappschuss: 'ohne-pause' } }, null, JETZT), 'sicherung-geprueft')?.ampel).toBe('gelb');
    expect(finde(datenschichtBefunde(basisInnen, { zeit: JETZT, abholung: { alter_stunden: 50 } }, JETZT), 'abholung')?.ampel).toBe('rot');
    expect(finde(datenschichtBefunde(basisInnen, { zeit: JETZT }, JETZT), 'abholung')).toMatchObject({ ampel: 'gelb', wert: 'noch nie abgeholt' });
  });
  it('Sicherung mit Warnung (Go-Live 29.09.): Archiv liegt, aber openssl statt age bzw. teilweise lesbar → rot, mit Dateinamen', () => {
    const ossl = datenschichtBefunde({ ...basisInnen, sicherungLauf: { zeit: JETZT, ok: false, stufe: 'warnung', archiv: true, verfahren: 'openssl', ping: 'ok', grund: 'age fehlt — Sicherung nur mit Übergangs-Verschlüsselung', pruefung: { ok: true, bestaende: 3 } } }, null, JETZT);
    expect(finde(ossl, 'sicherung-geprueft')).toMatchObject({ ampel: 'rot', wert: 'age fehlt — Sicherung nur mit Übergangs-Verschlüsselung' });
    expect(finde(ossl, 'sicherung-ping')).toMatchObject({ ampel: 'gruen', wert: 'meldet Fehler' });
    const teil = datenschichtBefunde({ ...basisInnen, sicherungLauf: { zeit: JETZT, ok: false, stufe: 'warnung', archiv: true, verfahren: 'age', ping: 'ok', pruefung: { ok: false, fehler: 1, fehlerNamen: ['crm'], archivFehlerNamen: [], ablageFehlerNamen: ['dateien/h1/d-1.bin'] } } }, null, JETZT);
    expect(finde(teil, 'sicherung-geprueft')).toMatchObject({ ampel: 'rot', wert: 'teilweise: 2 Dateien nicht lesbar' });
    expect(finde(teil, 'sicherung-geprueft')?.satz).toMatch(/crm, dateien\/h1\/d-1\.bin — Archiv trotzdem geschrieben/);
  });
  it('Datenschicht: Zeitlimit rot, Stau gelb, Tagessicherung/Klartext rot, .tmp und zweiter Schreiber gelb, Schlüssel aus der Umgebung gelb', () => {
    expect(finde(datenschichtBefunde({ ...basisInnen, datenschicht: ds() }, null, JETZT), 'sperren')?.ampel).toBe('gruen');
    expect(finde(datenschichtBefunde({ ...basisInnen, datenschicht: ds({ sperrWarten: q(100, 9000) }) }, null, JETZT), 'sperren')?.ampel).toBe('gelb');
    expect(finde(datenschichtBefunde({ ...basisInnen, datenschicht: ds({ zaehler: { '409': 2, '413': 1, sperrZeitlimit: 1, sicherungFehler: 0, klartextAbgelehnt: 0 } }) }, null, JETZT), 'sperren')).toMatchObject({ ampel: 'rot' });
    const b = datenschichtBefunde({ ...basisInnen, datenschicht: ds({ sicherungFehler: { anzahl: 2, letzter: 'crm: ENOSPC' }, klartext: ['crm'], tmpReste: 3, fremderSchreiber: { pid: 7, host: 'mac' }, schluesselQuelle: 'umgebung' }) }, null, JETZT);
    expect(finde(b, 'tagessicherung')?.ampel).toBe('rot');
    expect(finde(b, 'klartext')?.ampel).toBe('rot');
    expect(finde(b, 'tmp-reste')?.ampel).toBe('gelb');
    expect(finde(b, 'schreiber')?.ampel).toBe('gelb');
    expect(finde(b, 'schluessel-quelle')?.ampel).toBe('gelb');
  });
  it('Durchsicht: unlesbar rot, Sprung gelb, alles gut grün; nie gelaufen grau', () => {
    const k = { zeit: JETZT, bestaende: 10, zeilen: 100, fehler: 0, klartext: 0, alteHuellen: 0, alteForm: 0, spruenge: [], tmpReste: 0, verbindungen: { fehler: 0, warnung: 1, hinweis: 2 } };
    expect(finde(datenschichtBefunde({ ...basisInnen, durchsicht: k }, null, JETZT), 'durchsicht')?.ampel).toBe('gruen');
    expect(finde(datenschichtBefunde({ ...basisInnen, durchsicht: { ...k, spruenge: [{ name: 'crm', vorher: 50, nachher: 10 }] } }, null, JETZT), 'durchsicht')?.ampel).toBe('gelb');
    expect(finde(datenschichtBefunde({ ...basisInnen, durchsicht: { ...k, fehler: 1 } }, null, JETZT), 'durchsicht')?.ampel).toBe('rot');
    expect(finde(datenschichtBefunde({ ...basisInnen, durchsicht: null }, null, JETZT), 'durchsicht')?.ampel).toBe('grau');
  });
  it('innenLage sammelt die Datenschicht ein — nur Zähler, und .tmp-Reste zählen erst nach 10 Minuten', async () => {
    const alt = path.join(dir, 'x.json.1.abc.tmp');
    writeFileSync(alt, 'rest');
    await fs.utimes(alt, new Date(Date.now() - 3_600_000), new Date(Date.now() - 3_600_000));
    writeFileSync(path.join(dir, 'y.json.2.def.tmp'), 'frisch');
    const { innenLage } = await import('../lib/hoi/innen');
    const l = await innenLage();
    expect(l.datenschicht?.tmpReste).toBe(1);
    expect(l.datenschicht?.schluesselQuelle).toBe('keiner');
    await fs.rm(alt); await fs.rm(path.join(dir, 'y.json.2.def.tmp'));
  });
});

describe('Einzel-Restore aus der Tageskopie', () => {
  it('Vorschau je Liste, Übernahme einzelner Datensätze mit Stand, 409 bei inzwischen geändert; gelöschte Personen nie', async () => {
    const w = await import('../lib/store/wiederherstellen');
    const { fingerabdruck } = await import('../lib/store/fingerabdruck');
    mkdirSync(path.join(dir, 'backup'), { recursive: true });
    writeFileSync(path.join(dir, 'backup', 'probe-rest-2026-09-27.json'), JSON.stringify({ deals: [{ id: 'd1', wert: 100 }, { id: 'd2', wert: 5 }, { id: 'd3', wert: 7 }], _v: 1 }));
    await db.saveJson('probe-rest', { deals: [{ id: 'd1', wert: 999 }, { id: 'd3', wert: 7 }, { id: 'd4', wert: 1 }] });
    expect(await w.tageskopien('probe-rest')).toEqual(['2026-09-27']);
    const v = await w.vorschau('probe-rest', '2026-09-27');
    const l = v.listen.find(x => x.liste === 'deals')!;
    expect(l).toMatchObject({ gleich: 1, neuSeitdem: 1, nurInKopie: [{ id: 'd2' }] });
    expect(l.geaendert).toEqual([{ id: 'd1', stand: fingerabdruck({ id: 'd1', wert: 999 }), felder: ['wert'] }]);
    const veraltet = await w.uebernehmen('probe-rest', '2026-09-27', 'deals', { d1: 'falscher-stand' }, { art: 'person', person: 'kevin' });
    expect(veraltet).toMatchObject({ ok: false, status: 409, konflikte: ['d1'] });
    const ok = await w.uebernehmen('probe-rest', '2026-09-27', 'deals', { d1: l.geaendert[0].stand, d2: null }, { art: 'person', person: 'kevin' });
    expect(ok).toEqual({ ok: true, uebernommen: 2 });
    expect((await db.loadJson<{ deals: { id: string; wert: number }[] }>('probe-rest'))!.deals).toEqual([{ id: 'd1', wert: 100 }, { id: 'd3', wert: 7 }, { id: 'd4', wert: 1 }, { id: 'd2', wert: 5 }]);
    writeFileSync(path.join(dir, 'backup', 'kontakte-2026-09-27.json'), JSON.stringify({ kontakte: [{ id: 'c-weg' }] }));
    expect(await w.uebernehmen('kontakte', '2026-09-27', 'kontakte', { 'c-weg': null }, { art: 'person', person: 'kevin' })).toMatchObject({ ok: false, status: 409 });
  });
});

describe('Rotation im laufenden Betrieb: alles in die v2-Hülle mit dem neuen Schlüssel', () => {
  it('Bestände, Tagessicherungen, Archiv und Dateiablage — nie Klartext, danach ohne alten Schlüssel lesbar', async () => {
    process.env.MAKE_OS_DATEN_SCHLUESSEL = 'rot-alt';
    await db.saveJson('rot-a', { x: [1] });
    await db.saveJson('rot-a', { x: [1, 2] });
    const { archivSchreiben, archivLesen } = await import('../lib/store/archiv');
    await archivSchreiben('rot-archiv.json', { alt: true });
    const binOrdner = path.join(dir, 'dateien', 'haus-rot');
    mkdirSync(binOrdner, { recursive: true });
    const { inhaltVerschluesseln, inhaltLaden } = await import('../lib/dateien/ablage');
    writeFileSync(path.join(binOrdner, 'd-probe-1.bin'), inhaltVerschluesseln(Buffer.from('PDF-INHALT'), db.datenSchluessel()!));
    process.env.MAKE_OS_DATEN_SCHLUESSEL = 'rot-neu';
    process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT = 'rot-alt';
    const { allesUmschluesseln } = await import('../lib/store/umschluesseln');
    const r = await allesUmschluesseln();
    expect(r.fehler.filter(f => !/^(kaputt|verzeichnis)/.test(f))).toEqual([]);
    expect(r.archiv.neu).toBe(1);
    expect(r.ablage.neu).toBe(1);
    delete process.env.MAKE_OS_DATEN_SCHLUESSEL_ALT;
    db.leseCacheLeeren();
    expect(await db.loadJson('rot-a')).toEqual({ x: [1, 2] });
    expect(await archivLesen('rot-archiv.json')).toEqual({ alt: true });
    // Paket D-C: umgeschrieben in die Hülle v2 (Schlüssel-ID + AAD), gelesen über den Ring — ohne den alten Schlüssel.
    expect(readFileSync(path.join(binOrdner, 'd-probe-1.bin')).subarray(0, 8).toString('ascii')).toBe('MKOSDAT2');
    expect((await inhaltLaden('haus-rot', 'd-probe-1'))!.toString()).toBe('PDF-INHALT');
    const neuKid = huelle.schluesselAus('rot-neu').kid;
    for (const f of (await fs.readdir(path.join(dir, 'backup'))).filter(x => x.startsWith('rot-a-'))) expect(JSON.parse(readFileSync(path.join(dir, 'backup', f), 'utf8')).kid).toBe(neuKid);
  });
});

describe('Routen und Zähler', () => {
  it('Schreibpause nur über den Dienstweg; an → still, aus → weiter', async () => {
    const route = await import('../app/api/intern/schreibpause/route');
    const anfrage = (body: unknown, key?: string) => new Request('http://t/api/intern/schreibpause', { method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { 'x-make-key': key } : {}) }, body: JSON.stringify(body) });
    expect((await route.POST(anfrage({ an: true }))).status).toBe(403);
    const an = await (await route.POST(anfrage({ an: true, sekunden: 5 }, process.env.MAKE_OS_KEY))).json();
    expect(an).toMatchObject({ ok: true, pause: true, still: true });
    expect(db.datenschichtLage().pause).toBe(true);
    await route.POST(anfrage({ aus: true }, process.env.MAKE_OS_KEY));
    expect(db.datenschichtLage().pause).toBe(false);
  });
  it('409 und 413 werden für den Head of IT gezählt', async () => {
    const { opsFehler, listePatchen } = await import('../lib/store/patch-liste');
    const vorher = mess.messBild().zaehler;
    expect(opsFehler(Array.from({ length: 201 }, () => ({})))).toMatch(/Abgelehnt/);
    await db.saveJson('patch-zaehl', { liste: [{ id: 'a', t: 1 }] });
    const r = await listePatchen<{ id: string; t: number }, Record<string, unknown>>('patch-zaehl', 'liste', [{ op: 'teil', id: 'a', felder: { t: 2 }, stand: 'veraltet' }]);
    expect(r.ok).toBe(false);
    const nachher = mess.messBild().zaehler;
    expect(nachher['413']).toBe(vorher['413'] + 1);
    expect(nachher['409']).toBe(vorher['409'] + 1);
  });
});

describe('ETag der gepackten Fassung (#47)', () => {
  it('gzip bekommt ein eigenes ETag; beide Fassungen führen zu 304; der Delta-Abgleich findet den Stand auch über das gz-ETag', async () => {
    const { jsonAntwort, unveraendert, gzEtag } = await import('../lib/http/json-antwort');
    const { StandGedaechtnis } = await import('../lib/kontakte/delta');
    const etag = '"k3|abc|kevin"';
    const gross = { x: 'y'.repeat(20_000) };
    const gz = jsonAntwort(new Request('http://t', { headers: { 'accept-encoding': 'gzip' } }), gross, etag);
    expect(gz.headers.get('content-encoding')).toBe('gzip');
    expect(gz.headers.get('etag')).toBe(gzEtag(etag));
    expect(jsonAntwort(new Request('http://t'), gross, etag).headers.get('etag')).toBe(etag);
    expect(unveraendert(new Request('http://t', { headers: { 'if-none-match': gzEtag(etag) } }), etag)?.status).toBe(304);
    expect(unveraendert(new Request('http://t', { headers: { 'if-none-match': etag } }), etag)?.status).toBe(304);
    expect(unveraendert(new Request('http://t', { headers: { 'if-none-match': '"anders"' } }), etag)).toBeNull();
    const g = new StandGedaechtnis();
    g.merke(etag, new Map([['c-1', 's1']]));
    expect(g.hole(gzEtag(etag))?.get('c-1')).toBe('s1');
  });
});
