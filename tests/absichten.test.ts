// ─── Paket D-C (29.09., #17/#21/#33): Absichtsprotokoll für Vorgänge über mehrere Bestände ─
// Kern: Abbruch nach JEDEM Schritt (vor und nach dem Abhaken) → Wiederaufnahme → derselbe Endzustand wie ohne Abbruch.
// Eigener Datenordner, Daten-Schlüssel und Pepper gesetzt. Alle Namen, Adressen und Kennungen erfunden.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-dc-absicht-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
delete process.env.MAKE_OS_GRABSTEINE_DIR;
process.env.MAKE_OS_KEY = 'pruef-schluessel-d-c';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-d-c-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-d-c-nur-im-test-0123456789abcdef';

type Route = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let db: typeof import('@/lib/store/local-db');
let ab: typeof import('@/lib/store/absichten');
let fort: typeof import('@/lib/store/absichten-fortsetzen');
let pb: typeof import('@/lib/crm/person-bestaende');
const HAUS = 'test-haus';
const kopf = { 'x-make-key': 'pruef-schluessel-d-c', 'x-make-person': 'kevin', 'content-type': 'application/json' };
const post = (url: string, body: unknown) => new Request(`http://test${url}`, { method: 'POST', headers: kopf, body: JSON.stringify(body) });

const WEG = 'c-testawegmannexampleinvalid-1a2b3c';
const BLEIBT = 'c-bleibt-9z8y7x';
const MAIL = 'testa.wegmann@example.invalid';
const k = (id: string, vorname: string, nachname: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname, nachname, stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', ...x } as Kontakt);
const leer = (): CrmBestand => ({ firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [] });

/** Alle Bestände außer den Datenordner-Dateien, die zufällige/zeitliche Teile tragen, als ein vergleichbarer Text. */
async function stand(ohne: RegExp = /^(konten|absichten--.*|crm-loeschprotokoll|datenschutz-.*|aenderungsprotokoll--.*|protokoll-siegel|crm-sperrliste--.*)$/): Promise<string> {
  const namen = readdirSync(ordner).filter(n => n.endsWith('.json')).map(n => n.slice(0, -5)).filter(n => !ohne.test(n)).sort();
  const teile = await Promise.all(namen.map(async n => `${n}:${JSON.stringify(await db.loadJson(n))}`));
  // Zeitstempel (updatedAt, geaendert …) unterscheiden sich zwischen zwei Läufen — gleich gemacht.
  return teile.join('\n').replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, 'ZEIT');
}
function allesLeeren() {
  for (const n of readdirSync(ordner)) if (n !== 'konten.json') rmSync(path.join(ordner, n), { recursive: true, force: true });
  db.leseCacheLeeren();
}

/** Eine Welt mit Personenbezug in vielen Speichern. */
async function weltArt17() {
  allesLeeren();
  await db.saveJson('kontakte', { kontakte: [k(WEG, 'Testa', 'Wegmann', { email: MAIL, firma: 'Probe GmbH' }), k(BLEIBT, 'Testo', 'Bleiber')] });
  await db.saveJson('crm', { ...leer(), chancen: [{ id: 'ch1', titel: 'Beratung Testa Wegmann', kontaktIds: [WEG, BLEIBT], stufe: 'angebot', historie: [], wert: { betrag: 1, basis: 'monat' }, art: 'retainer', gesellschaft: 'offen', besitzer: 'kevin', angelegt: 'x', geaendert: 'x' }] });
  await db.saveJson('crm-signale', { kommend: { [WEG]: { titel: 'Kaffee', start: '2026-10-01T10:00:00Z' }, [BLEIBT]: { titel: 'Tee', start: '2026-10-02T10:00:00Z' } } });
  await db.saveJson('tasks', { tasks: [{ id: 't-1', title: 'Rückruf Testa Wegmann', bezug: { kontaktId: WEG, dealId: 'ch1' } }, { id: 't-2', title: 'Anderes' }] });
  await db.saveJson('zoe-stapel', { vorschlaege: [{ id: 'v-1', zeit: 'x', werkzeug: 'notiere_kontakt', status: 'offen', titel: `Notiz an ${WEG}` }, { id: 'v-2', zeit: 'x', werkzeug: 'x', status: 'offen', titel: 'Bleibt' }] });
  await db.saveJson('head-sales', { vorschlaege: [{ id: 'hs-1', kontakt_id: WEG, titel: 'Testa Wegmann anrufen', art: 'nachfassen', status: 'offen', erstellt: 'x' }], berichte: [] });
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    { id: 'k2', speicher: 'malin', email: 'm@test', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
  ], einladungen: [] });
  ab = await import('@/lib/store/absichten');
  fort = await import('@/lib/store/absichten-fortsetzen');
  pb = await import('@/lib/crm/person-bestaende');
});
afterEach(() => { ab.absichtTest.vorSchritt = null; ab.absichtTest.vorAbhaken = null; ab.absichtTest.nachAbhaken = null; });
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Absichtsprotokoll — Kern', () => {
  it('beginnen → abhaken → abschließen leert Daten und Schlüssel; je Art + Schlüssel höchstens eine offene', async () => {
    allesLeeren();
    const a = await ab.absichtBeginnen(HAUS, { art: 'import', schluessel: 'imp-1', schritte: ['a', 'b'], daten: { name: 'Testa Wegmann', laufId: 'imp-1' } });
    expect(a.neu).toBe(true);
    const b = await ab.absichtBeginnen(HAUS, { art: 'import', schluessel: 'imp-1', schritte: ['a', 'b'] });
    expect(b.neu).toBe(false);
    expect(b.absicht.id).toBe(a.absicht.id);
    await ab.schrittAbhaken(HAUS, a.absicht.id, 'a', { zwischen: 3 });
    await ab.schrittAbhaken(HAUS, a.absicht.id, 'a'); // idempotent
    let l = await ab.absichtenLaden(HAUS);
    expect(ab.naechsterSchritt(l[0])).toBe('b');
    expect(l[0].daten).toMatchObject({ name: 'Testa Wegmann', zwischen: 3 });
    await ab.absichtAbschliessen(HAUS, a.absicht.id, 'fertig', ['laufId']);
    l = await ab.absichtenLaden(HAUS);
    expect(l[0].status).toBe('fertig');
    expect(l[0].daten).toEqual({ laufId: 'imp-1' });
    expect(l[0].schluessel).toBe('—');
    expect(JSON.stringify(l)).not.toContain('Wegmann');
  });
  it('Fehlversuche zählen bis zur Grenze → „gescheitert“; erneut versuchen setzt zurück; aufräumen nach 30 Tagen', async () => {
    allesLeeren();
    const { absicht } = await ab.absichtBeginnen(HAUS, { art: 'import', schluessel: 'imp-2', schritte: ['a'] });
    for (let i = 0; i < ab.GRENZE_VERSUCHE; i++) await ab.fehlschlagVermerken(HAUS, absicht.id, new Error('Platte voll'));
    let a = (await ab.absichtenLaden(HAUS))[0];
    expect(a.status).toBe('gescheitert');
    expect(a.letzterFehler).toContain('Platte voll');
    expect(await ab.absichtErneutVersuchen(HAUS, absicht.id)).toBe(true);
    a = (await ab.absichtenLaden(HAUS))[0];
    expect(a.status).toBe('offen');
    expect(a.versuche).toBe(0);
    const alt = { ...a, status: 'fertig' as const, abgeschlossen: '2026-01-01T00:00:00.000Z' };
    expect(ab.aufraeumen([alt, a], '2026-09-29T00:00:00.000Z')).toEqual([a]);
  });
  it('Rückzug: nach einem Fehlversuch wartet der Takt 30 min je Versuch; beim Start/Durchsicht (ohne Mindestalter) nicht', () => {
    const jetzt = Date.parse('2026-09-29T12:00:00Z');
    const a = { id: 'ab-x', art: 'import' as const, schluessel: 's', angelegt: '2026-09-29T10:00:00Z', status: 'offen' as const, schritte: [], daten: {}, versuche: 1, letzterVersuch: '2026-09-29T11:50:00Z' };
    expect(fort.faelligZurWiederaufnahme(a, jetzt, fort.MINDEST_ALTER_MS)).toBe(false);
    expect(fort.faelligZurWiederaufnahme({ ...a, letzterVersuch: '2026-09-29T11:00:00Z' }, jetzt, fort.MINDEST_ALTER_MS)).toBe(true);
    expect(fort.faelligZurWiederaufnahme({ ...a, angelegt: '2026-09-29T11:55:00Z', versuche: 0, letzterVersuch: undefined }, jetzt, fort.MINDEST_ALTER_MS)).toBe(false);
    expect(fort.faelligZurWiederaufnahme(a, jetzt, 0)).toBe(true);
  });
});

describe('Art. 17 mit Absichtsprotokoll (#17/#21)', () => {
  const protokoll = { datum: '2026-09-29', grund: 'Art. 17 DSGVO', von: 'kevin' };
  let soll = '';
  it('ohne Abbruch: alle Schritte ok, Protokoll „vollständig“, Absicht fertig und ohne Personendaten', async () => {
    await weltArt17();
    const b = await pb.personEntfernen(WEG, undefined, { protokoll, person: 'kevin' });
    expect(b.vollstaendig).toBe(true);
    expect(Object.values(b.schritte!).every(x => x === 'ok')).toBe(true);
    soll = await stand();
    expect(soll).not.toMatch(/Wegmann|testa\.wegmann|c-testawegmann/);
    expect(soll).toContain('Testo');
    const prot = (await db.loadJson<{ eintraege: { status: string; fehlend?: string[] }[] }>('crm-loeschprotokoll'))!.eintraege;
    expect(prot).toHaveLength(1);
    expect(prot[0].status).toBe('vollstaendig');
    const a = await ab.absichtenLaden(HAUS);
    expect(a).toHaveLength(1);
    expect(a[0].status).toBe('fertig');
    expect(JSON.stringify(a)).not.toMatch(/Wegmann|testa|c-testawegmann/);
  });
  // Dieselbe Liste wie lib/crm/person-bestaende.ts ART17_SCHRITTE (geprüft im ersten Test) — hier als Literal, weil die
  // Tests beim Einsammeln entstehen, bevor die Module mit dem Test-Datenordner geladen sind.
  const SCHRITTE = ['protokoll', 'kartei', 'sperrliste', 'grabstein', 'laeufe', 'crm', 'ablage', 'konflikte', 'heads', 'signale', 'tasks', 'weitere', 'index'];
  it('die Schrittliste im Test ist die des Vorgangs', () => { expect([...pb.ART17_SCHRITTE]).toEqual(SCHRITTE); });
  for (const wann of ['vorAbhaken', 'nachAbhaken'] as const) {
    for (const schritt of SCHRITTE) {
      it(`Abbruch ${wann === 'vorAbhaken' ? 'vor' : 'nach'} dem Abhaken von „${schritt}“ → Wiederaufnahme → derselbe Endzustand`, async () => {
        await weltArt17();
        ab.absichtTest[wann] = (art, s) => { if (art === 'art17' && s === schritt) throw new ab.TestAbbruch(s); };
        await expect(pb.personEntfernen(WEG, undefined, { protokoll, person: 'kevin' })).rejects.toThrow(/Testabbruch/);
        ab.absichtTest[wann] = null;
        const offen = (await ab.absichtenLaden(HAUS)).filter(ab.istOffen);
        expect(offen).toHaveLength(1);
        // Die Absicht hält, was die restlichen Schritte brauchen — auch wenn die Kartei die Person schon nicht mehr kennt.
        expect(JSON.stringify(offen[0].daten)).toContain('Wegmann');
        const r = await fort.offeneFertigstellen();
        expect(r).toMatchObject({ gefunden: 1, fertig: 1, gescheitert: 0 });
        expect(await stand()).toBe(soll);
        const prot = (await db.loadJson<{ eintraege: { status: string }[] }>('crm-loeschprotokoll'))!.eintraege;
        expect(prot).toHaveLength(1);
        expect(prot[0].status).toBe('vollstaendig');
        expect(JSON.stringify(await ab.absichtenLaden(HAUS))).not.toMatch(/Wegmann|c-testawegmann/);
      });
    }
  }
  it('#21: ein Bestand scheitert → die anderen laufen weiter, Protokoll „unvollständig“ mit Schrittnamen; Wiederaufnahme vollendet', async () => {
    await weltArt17();
    ab.absichtTest.vorSchritt = (art, s) => { if (art === 'art17' && s === 'crm') throw new Error('Bestand crm beschädigt'); };
    const b = await pb.personEntfernen(WEG, undefined, { protokoll, person: 'kevin' });
    expect(b.vollstaendig).toBe(false);
    expect(b.schritte).toMatchObject({ kartei: 'ok', crm: 'fehler', tasks: 'ok', weitere: 'ok' });
    expect(b.fehler).toEqual(['crm']);
    let prot = (await db.loadJson<{ eintraege: { status: string; fehlend?: string[] }[] }>('crm-loeschprotokoll'))!.eintraege;
    expect(prot[0]).toMatchObject({ status: 'unvollstaendig', fehlend: ['crm'] });
    expect(JSON.stringify(await db.loadJson('crm'))).toContain('Wegmann'); // noch nicht getilgt
    expect(JSON.stringify(await db.loadJson('tasks'))).not.toContain('Wegmann'); // der Rest schon
    // HOI: offen
    expect((await fort.absichtenLage()).offen).toBe(1);
    ab.absichtTest.vorSchritt = null;
    const r = await fort.offeneFertigstellen();
    expect(r.fertig).toBe(1);
    expect(JSON.stringify(await db.loadJson('crm'))).not.toContain('Wegmann');
    prot = (await db.loadJson<{ eintraege: { status: string; fehlend?: string[] }[] }>('crm-loeschprotokoll'))!.eintraege;
    expect(prot).toHaveLength(1);
    expect(prot[0].status).toBe('vollstaendig');
    expect(prot[0].fehlend).toBeUndefined();
  });
  it('wiederholtes Scheitern → „gescheitert“ → Head of IT rot', async () => {
    await weltArt17();
    ab.absichtTest.vorSchritt = (art, s) => { if (art === 'art17' && s === 'signale') throw new Error('kaputt'); };
    await pb.personEntfernen(WEG, undefined, { protokoll, person: 'kevin' });
    for (let i = 0; i < ab.GRENZE_VERSUCHE; i++) await fort.offeneFertigstellen();
    const a = (await ab.absichtenLaden(HAUS))[0];
    expect(a.status).toBe('gescheitert');
    const lage = await fort.absichtenLage();
    expect(lage.gescheitert).toBe(1);
    const { datenschichtBefunde } = await import('@/lib/hoi/lage');
    const b = datenschichtBefunde({ absichten: lage } as unknown as Parameters<typeof datenschichtBefunde>[0], null, new Date().toISOString());
    expect(b.find(x => x.id === 'absichten')?.ampel).toBe('rot');
    // Nach Behebung von Hand wieder freigeben → fertig.
    ab.absichtTest.vorSchritt = null;
    await ab.absichtErneutVersuchen(HAUS, a.id);
    expect((await fort.offeneFertigstellen()).fertig).toBe(1);
  });
  it('Kartei-Löschen (PATCH op delete): Vormerkung VOR dem Schreiben; abgebrochen danach → Wiederaufnahme räumt alles', async () => {
    await weltArt17();
    const kontakteRoute = (await import('@/app/api/state/kontakte/route')) as unknown as { PATCH: (r: Request) => Promise<Response> };
    ab.absichtTest.vorSchritt = (art, s) => { if (art === 'art17' && s === 'protokoll') throw new ab.TestAbbruch(s); };
    await expect(kontakteRoute.PATCH(new Request('http://test/api/state/kontakte', { method: 'PATCH', headers: kopf, body: JSON.stringify({ ops: [{ op: 'delete', id: WEG }] }) }))).rejects.toThrow(/Testabbruch/);
    ab.absichtTest.vorSchritt = null;
    expect(JSON.stringify(await db.loadJson('kontakte'))).not.toContain('Wegmann'); // Kartei schon geschrieben
    expect(JSON.stringify(await db.loadJson('crm'))).toContain('Wegmann'); // Rest noch nicht
    await fort.offeneFertigstellen();
    expect(await stand(/^(konten|absichten--.*|crm-loeschprotokoll|datenschutz-.*|aenderungsprotokoll--.*|protokoll-siegel|crm-sperrliste--.*)$/)).not.toMatch(/Wegmann|c-testawegmann/);
  });
  it('eine Vormerkung ohne Löschen (abgelehnt/abgebrochen vor der Kartei) verfällt — die Person bleibt', async () => {
    await weltArt17();
    const kontakt = ((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte).find(x => x.id === WEG)!;
    await pb.art17Vormerken(WEG, kontakt, { person: 'kevin', quelle: 'kartei' });
    await fort.offeneFertigstellen();
    expect(JSON.stringify(await db.loadJson('kontakte'))).toContain('Wegmann');
    expect((await ab.absichtenLaden(HAUS))[0].status).toBe('verworfen');
  });
});

describe('Dubletten zusammenführen (#33)', () => {
  const A = 'c-dublette-a-1', B = 'c-dublette-b-2';
  async function welt() {
    allesLeeren();
    await db.saveJson('kontakte', { kontakte: [k(A, 'Testi', 'Doppel', { email: 'testi.doppel@example.invalid' }), k(B, 'Testi', 'Doppel', { email: 'testi.doppel@example.invalid' })] });
    await db.saveJson('crm', { ...leer(), chancen: [{ id: 'ch9', titel: 'Deal', kontaktIds: [B], stufe: 'angebot', historie: [], wert: { betrag: 1, basis: 'monat' }, art: 'retainer', gesellschaft: 'offen', besitzer: 'kevin', angelegt: 'x', geaendert: 'x' }] });
    await db.saveJson('tasks', { tasks: [{ id: 't-9', title: 'X', bezug: { kontaktId: B } }] });
  }
  let soll = '';
  // Lauf-ID zufällig; der Fingerabdruck des zusammengeführten Kontakts trägt den Zeitpunkt seiner Aktivität.
  const norm = (t: string) => t.replace(/imp-[0-9a-z]+-[0-9a-f]{6}/g, 'LAUF').replace(new RegExp(`"${A}":"[A-Za-z0-9_-]{12}"`, 'g'), 'FP');
  it('ohne Abbruch', async () => {
    await welt();
    const route = (await import('@/app/api/crm/dubletten/route')) as unknown as Route;
    const r = await route.POST!(post('/api/crm/dubletten', { behalten: A, weg: B }));
    expect(r.status).toBe(200);
    soll = norm(await stand());
    expect(JSON.stringify(await db.loadJson('crm'))).not.toContain(B);
  });
  for (const wann of ['vorAbhaken', 'nachAbhaken'] as const) {
    it(`Abbruch ${wann === 'vorAbhaken' ? 'vor' : 'nach'} dem Abhaken der Kartei → Wiederaufnahme biegt die Verweise um`, async () => {
      await welt();
      const route = (await import('@/app/api/crm/dubletten/route')) as unknown as Route;
      ab.absichtTest[wann] = (art, s) => { if (art === 'zusammenfuehren' && s === 'kartei') throw new ab.TestAbbruch(s); };
      await expect(route.POST!(post('/api/crm/dubletten', { behalten: A, weg: B }))).rejects.toThrow(/Testabbruch/);
      ab.absichtTest[wann] = null;
      expect(JSON.stringify(await db.loadJson('crm'))).toContain(B); // halber Stand: Deal zeigt auf die gelöschte Kennung
      await fort.offeneFertigstellen();
      expect(norm(await stand())).toBe(soll);
    });
  }
  it('Abbruch VOR der Kartei (nichts geschehen) → die Absicht verfällt, beide Personen bleiben', async () => {
    await welt();
    const route = (await import('@/app/api/crm/dubletten/route')) as unknown as Route;
    ab.absichtTest.vorSchritt = (art, s) => { if (art === 'zusammenfuehren' && s === 'kartei') throw new ab.TestAbbruch(s); };
    await expect(route.POST!(post('/api/crm/dubletten', { behalten: A, weg: B }))).rejects.toThrow(/Testabbruch/);
    ab.absichtTest.vorSchritt = null;
    await fort.offeneFertigstellen();
    expect((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte).toHaveLength(2);
    expect((await ab.absichtenLaden(HAUS)).find(a => a.art === 'zusammenfuehren')?.status).toBe('verworfen');
  });
});

describe('Import (#17)', () => {
  const csv = ['VORNAME;NACHNAME;EMAIL;FIRMA;KEVIN_NOTIZ', 'Testa;Liste;testa.liste@example.invalid;Listenfirma GmbH;neu', 'Testo;Online;testo.online@example.invalid;Onlinefirma;Liste sagt B'].join('\n');
  async function welt() {
    allesLeeren();
    await db.saveJson('kontakte', { kontakte: [k('c-online-1', 'Testo', 'Online', { email: 'testo.online@example.invalid', notiz: 'Online sagt A', vonHand: ['notiz'] } as Partial<Kontakt>)] });
    await db.saveJson('crm', leer());
  }
  /** Vergleichbar: Kontakte nach Name (Kennungen zufällig), Firmen, Konflikte, Segmente, Lauf (Zahlen). */
  async function ergebnis() {
    const kontakte = ((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []).map(x => `${x.vorname} ${x.nachname}|${x.firmaId ?? ''}|${x.notiz ?? ''}`).sort();
    const crm = (await db.loadJson<CrmBestand>('crm'))!;
    const konflikte = ((await db.loadJson<{ konflikte: { feld: string }[] }>('crm-import-konflikte'))?.konflikte ?? []).map(x => x.feld);
    const laeufe = (await db.loadJson<{ laeufe: { neu: string[]; nachher: Record<string, string>; firmenNeu?: Record<string, string> }[] }>(`crm-import-laeufe--${HAUS}`))?.laeufe ?? [];
    return { kontakte, firmen: crm.firmen.map(f => f.id).sort(), segmente: crm.segmente.map(s => s.id), konflikte, laeufe: laeufe.map(l => ({ neu: l.neu.length, nachher: Object.keys(l.nachher).length, firmen: Object.keys(l.firmenNeu ?? {}).length })) };
  }
  let soll: Awaited<ReturnType<typeof ergebnis>>;
  it('ohne Abbruch', async () => {
    await welt();
    const route = (await import('@/app/api/crm/import/route')) as unknown as Route;
    const r = await route.POST!(post('/api/crm/import', { csv, name: 'probe.csv' }));
    expect(r.status).toBe(200);
    soll = await ergebnis();
    expect(soll.konflikte).toEqual(['notiz']);
    expect(soll.laeufe[0].nachher).toBeGreaterThan(0);
    expect(soll.firmen.length).toBeGreaterThan(0);
  });
  for (const wann of ['vorAbhaken', 'nachAbhaken'] as const) {
    for (const schritt of ['kartei', 'konflikte', 'segment', 'firmen', 'lauf']) {
      it(`Abbruch ${wann === 'vorAbhaken' ? 'vor' : 'nach'} dem Abhaken von „${schritt}“ → Wiederaufnahme → derselbe Endzustand`, async () => {
        await welt();
        const route = (await import('@/app/api/crm/import/route')) as unknown as Route;
        ab.absichtTest[wann] = (art, s) => { if (art === 'import' && s === schritt) throw new ab.TestAbbruch(s); };
        await expect(route.POST!(post('/api/crm/import', { csv, name: 'probe.csv' }))).rejects.toThrow(/Testabbruch/);
        ab.absichtTest[wann] = null;
        await fort.offeneFertigstellen();
        const ist = await ergebnis();
        // Bricht der Lauf im Kartei-Schritt ab, BEVOR er abgehakt ist, sind die Konflikte der Liste verloren (dokumentiert):
        // der Rest ist gleich, ein zweiter Import der Liste (idempotent) legt sie wieder ab.
        if (schritt === 'kartei' && wann === 'vorAbhaken') {
          expect({ ...ist, konflikte: [] }).toEqual({ ...soll, konflikte: [] });
          await route.POST!(post('/api/crm/import', { csv, name: 'probe.csv' }));
          expect((await ergebnis()).konflikte).toEqual(soll.konflikte);
        } else expect(ist).toEqual(soll);
        expect((await ab.absichtenLaden(HAUS)).filter(ab.istOffen)).toEqual([]);
      });
    }
  }
});

describe('CRM-Folgen gelöschter Deals (crmSchreiben, Kartei innen)', () => {
  it('Abbruch nach dem Kartei-Schreiben, CRM nicht geschrieben → Ausgleich holt den Lead zurück', async () => {
    allesLeeren();
    const lead = { status: 'sql', chanceId: 'ch-l', sqlAm: '2026-09-01', geaendert: '2026-09-01T00:00:00.000Z' };
    await db.saveJson('kontakte', { kontakte: [k('c-lead-1', 'Testa', 'Lead', { lead } as Partial<Kontakt>)] });
    await db.saveJson('crm', { ...leer(), chancen: [{ id: 'ch-l', titel: 'Deal', kontaktIds: ['c-lead-1'], stufe: 'angebot', historie: [], wert: { betrag: 1, basis: 'monat' }, art: 'retainer', gesellschaft: 'offen', besitzer: 'kevin', angelegt: 'x', geaendert: 'x' }] });
    const { aendereCrm } = await import('@/lib/crm/speicher');
    ab.absichtTest.nachAbhaken = (art, s) => { if (art === 'crm-folgen' && s === 'kartei') throw new ab.TestAbbruch(s); };
    await expect(aendereCrm(c => ({ ...c, chancen: [] }))).rejects.toThrow(/Testabbruch/);
    ab.absichtTest.nachAbhaken = null;
    expect((await db.loadJson<CrmBestand>('crm'))!.chancen).toHaveLength(1); // CRM nicht geschrieben
    expect((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte[0].lead).toEqual(lead); // Lead zurück
    expect((await ab.absichtenLaden(HAUS)).filter(ab.istOffen)).toEqual([]);
  });
  it('Wiederaufnahme nach Absturz: Deal ist weg (CRM geschrieben) → die Kartei-Folge wird sicher angewandt', async () => {
    allesLeeren();
    await db.saveJson('kontakte', { kontakte: [k('c-lead-2', 'Testa', 'Lead', { lead: { status: 'sql', chanceId: 'ch-x', sqlAm: '2026-09-01' } } as Partial<Kontakt>)] });
    await db.saveJson('crm', leer());
    const { absicht } = await ab.absichtBeginnen(HAUS, { art: 'crm-folgen', schluessel: 'deals:ch-x', schritte: ['kartei', 'crm'], daten: { weg: ['ch-x'], vorherLeads: [] } });
    const { crmFolgenFortsetzen } = await import('@/lib/crm/speicher');
    await crmFolgenFortsetzen(HAUS, absicht);
    const lead = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte[0].lead!;
    expect(lead.chanceId).toBeUndefined();
    expect(lead.status).toBe('qualifizierung');
  });
});
