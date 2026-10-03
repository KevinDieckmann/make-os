// ─── Praxis-Prüfung 03.10. — die behobenen Funde (Branch praxis-fix) ────────────────────────────────
// Erfundene Personen (@example.invalid), eigener Datenordner. Geprüft je Fund:
//   H4  Danke-Text und CSV-Herkunft nach Fall (neu/Bestand, gesprochen/nicht, Event-Tag), Werbe-Einwilligung nach Stand
//   M1  Firma zur Karte: Name gewinnt, Domain nur bei passendem Namen, freie Anbieter nie, Vorschlag nur ohne Namen
//   M2  gelöschtes Event steht durch eine wartende Erfassung nicht wieder auf
//   M3  SQL-bereit ohne Entscheidung bleibt in der Runde (eigene Gruppe oben)
//   M7  Firma wechseln: keine Vorauswahl der Person bei Firmen-Lead mit mehreren Personen
//   M8  Raus/Parken bei SQL/Deal: Hinweis vorab, Knopf gesperrt
//   M10 besuchte Events: Erfassung = besucht (auch bei künftigem Datum), Follow-up-Quote mit Definition
//   NIEDRIG: deutsches Datum in Liquiplan-Hinweisen, Firmenakte-Status, CSS-Wächter für Tippziele
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-praxis-fix-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-praxis-fix';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

import type { Kontakt } from '../lib/make-one/crm';
import type { Chance, Event, Firma, Teilnahme } from '../lib/crm/typen';
import { dankeEntwurf } from '../lib/crm/netzwerken';
import { weitergabeAnkuendigen, datenschutzHinweisText, KEINE_WERBE_EINWILLIGUNG } from '../lib/crm/netzwerken-recht';
import { exportHerkunft, exportWerbeEinwilligung, kundenExport, besuchWirkung, besuchKennzahlen, besuchUebersicht, begegnungStatus, zaehltAlsBesucht, FOLLOWUP_QUOTE_DEFINITION, type BesuchKontext } from '../lib/crm/besuche';
import { firmaZurKarte, firmaVorschlagAusDomain } from '../lib/crm/visitenkarte';
import { zuQualifizieren, sqlEntscheidungOffen, ausscheidenGesperrt, AUSSCHEIDEN_GESPERRT, leereKriterien, type LeadZeile } from '../lib/crm/leads';
import { liquiplanStand } from '../lib/crm/event-bruecke';
import type { Kriterien } from '../lib/crm/typen';

const A = { mail: 'datenschutz@beispiel.example', seite: 'beispiel.example/datenschutz#kontakte', verantwortlich: 'Beispiel GmbH' };
const basis = { vorname: 'Anna', nachname: 'Beispiel', anrede: 'Sie' as const, eventTitel: 'Kundentag Beispielstadt', wann: 'neulich' as const, absender: 'Kevin', datenschutz: A };

// ── H4 ──────────────────────────────────────────────────────────────────────────────────────────────
describe('H4 · Danke-Entwurf nach Fall', () => {
  it('neu angelegt: „kennengelernt“, Visitenkarte, Weitergabe an den Kunden (nur wenn angekündigt wird)', () => {
    const t = dankeEntwurf({ ...basis, kunde: 'Kundenwerk GmbH', eventDatum: '2026-10-08', heute: '2026-10-09' }).text;
    expect(t).toContain('schön, Sie gestern bei Kundentag Beispielstadt kennengelernt zu haben.');
    expect(t).toContain('Vielen Dank für das Gespräch');
    expect(t).toContain('von Ihrer Visitenkarte notiert');
    expect(t).toContain('Wir waren für Kundenwerk GmbH auf der Veranstaltung und geben Ihre Kontaktdaten an Kundenwerk GmbH weiter.');
  });
  it('Bestandsperson: „wiedergesehen“, KEIN „Visitenkarte notiert“, keine Ankündigung der Weitergabe — auch wenn der Aufrufer einen Kunden mitgibt', () => {
    const t = dankeEntwurf({ ...basis, neu: false, kunde: 'Kundenwerk GmbH', eventDatum: '2026-10-08', heute: '2026-10-09' }).text;
    expect(t).toContain('schön, Sie gestern bei Kundentag Beispielstadt wiedergesehen zu haben.');
    expect(t).not.toContain('kennengelernt');
    expect(t).not.toContain('Visitenkarte');
    expect(t).not.toContain('Wir waren für');
    expect(t).not.toContain('weiter.');
    expect(t).toContain('Datenschutz: Ich verarbeite Ihre Kontaktdaten, um mit Ihnen in Verbindung zu bleiben (Art. 6 Abs. 1 lit. f DSGVO, Verantwortlich: Beispiel GmbH)');
    expect(t).toContain(A.mail); // Rechte und Kontaktweg bleiben
  });
  it('nicht gesprochen: kein „Danke für das Gespräch“, ehrliche Zeile', () => {
    const t = dankeEntwurf({ ...basis, gesprochen: false, eventDatum: '2026-10-08', heute: '2026-10-09' });
    expect(t.text).not.toContain('Gespräch');
    expect(t.betreff).not.toContain('Gespräch');
    expect(t.text).toContain('schön, dass wir uns gestern bei Kundentag Beispielstadt begegnet sind.');
  });
  it('„gestern“ gilt für den TAG DES EVENTS, nicht für den Erfassungstag; sonst steht das Datum', () => {
    const am = (heute: string) => dankeEntwurf({ ...basis, wann: 'gestern', eventDatum: '2026-10-08', heute }).text;
    expect(am('2026-10-09')).toContain('Sie gestern bei');
    expect(am('2026-10-12')).toContain('Sie am 08.10. bei');
    expect(am('2026-10-12')).not.toContain('gestern');
    // ohne Event-Tag bleibt `wann`
    expect(dankeEntwurf({ ...basis, wann: 'neulich' }).text).toContain('Sie neulich bei');
  });
  it('weitergabeAnkuendigen: nur neu angelegt, nie gesperrt', () => {
    expect(weitergabeAnkuendigen({}, { neuAngelegt: true })).toBe(true);
    expect(weitergabeAnkuendigen({}, {})).toBe(false);
    expect(weitergabeAnkuendigen({}, undefined)).toBe(false);
    expect(weitergabeAnkuendigen({ werbesperre: { seit: '2026-10-01', grund: 'x' } } as Kontakt, { neuAngelegt: true })).toBe(false);
  });
  it('der Hinweisblock kennt beide Quellen', () => {
    expect(datenschutzHinweisText({ du: true, angaben: A })).toContain('von deiner Visitenkarte');
    expect(datenschutzHinweisText({ du: true, quelle: 'bestand', angaben: A })).toContain('Ich verarbeite deine Kontaktdaten');
  });
});

const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Muster', email: `${id}@example.invalid`, eignung: '', prio: '', aktivitaeten: [], ...x } as unknown as Kontakt);
const nw = (x: Record<string, unknown> = {}) => ({ netzwerken: { erfassungId: 'x', schritt: 'nur-kontakt', zustaendig: 'kevin', erfasstVon: 'kevin', erfasstAm: '2026-10-08T18:00:00.000Z', ...x } } as unknown as Pick<Teilnahme, 'netzwerken'>);

describe('H4 · CSV: Herkunft und Werbe-Einwilligung aus den Daten', () => {
  it('Herkunft: neu/Bestand × gesprochen/nicht gesprochen — nie „persönlich kennengelernt“ ohne Gespräch', () => {
    const neu = { neuAngelegt: true, kartenfoto: true };
    expect(exportHerkunft(k('a'), nw(neu))).toBe('Persönlich auf der Veranstaltung kennengelernt, Visitenkarte übergeben');
    expect(exportHerkunft(k('a'), nw({ neuAngelegt: true }))).toBe('Persönlich auf der Veranstaltung kennengelernt');
    expect(exportHerkunft(k('a'), nw({ ...neu, keinGespraech: true }))).toBe('Visitenkarte auf der Veranstaltung erhalten, kein persönliches Gespräch');
    expect(exportHerkunft(k('a'), nw({ neuAngelegt: true, keinGespraech: true }))).toBe('Auf der Veranstaltung erfasst, kein persönliches Gespräch');
    expect(exportHerkunft(k('a', { herkunft: 'bekannt' }), nw())).toMatch(/^Bereits bekannt \(.+\), auf der Veranstaltung wiedergetroffen$/);
    expect(exportHerkunft(k('a', { herkunft: 'bekannt' }), nw({ keinGespraech: true }))).toContain('wiedergesehen, kein persönliches Gespräch');
  });
  it('Werbe-Einwilligung: „keine (Visitenkarte, § 7 UWG)“ nur bei Visitenkarten-Erfassung, sonst der echte Stand', () => {
    expect(exportWerbeEinwilligung(k('a'), nw({ neuAngelegt: true }))).toBe(KEINE_WERBE_EINWILLIGUNG);
    expect(exportWerbeEinwilligung(k('b'), nw())).toBe('keine vermerkt');
    const mit = k('c', { einwilligungen: [{ kanal: 'newsletter', grundlage: 'einwilligung', erteiltAm: '2026-03-12', nachweis: 'DOI' }, { kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-01-02', nachweis: 'x', widerrufenAm: '2026-02-01' }] });
    expect(exportWerbeEinwilligung(mit, nw())).toBe('Newsletter seit 12.03.2026');
    // Einwilligungen ohne Grundlage „einwilligung“ (z. B. Bestandskunde § 7 Abs. 3) sind keine Einwilligung
    expect(exportWerbeEinwilligung(k('d', { einwilligungen: [{ kanal: 'mail', grundlage: 'bestandskunde_7_3', erteiltAm: '2026-01-02', nachweis: 'x' }] }), nw())).toBe('keine vermerkt');
  });
  it('im Export steht die Zeile je Person passend: Bestandsperson mit Haken bekommt NICHT den Visitenkarten-Vermerk', () => {
    const e = { id: 'ev-a', titel: 'Kundentag', format: 'sonstig', ziel: '', datum: '2026-10-08', status: 'durchgefuehrt', marke: 'Netzwerken', geaendert: '2026-10-01' } as Event;
    const kontakte = [k('neu'), k('alt', { herkunft: 'bekannt', einwilligungen: [{ kanal: 'newsletter', grundlage: 'einwilligung', erteiltAm: '2026-03-12', nachweis: 'DOI' }] })];
    const teilnahmen = [
      { id: 't1', eventId: 'ev-a', kontaktId: 'c-neu', status: 'da', geaendert: '2026-10-08', ...nw({ neuAngelegt: true, erfasstAm: '2026-10-08T18:00:00.000Z' }) },
      { id: 't2', eventId: 'ev-a', kontaktId: 'c-alt', status: 'da', geaendert: '2026-10-08', ...nw({ erfasstAm: '2026-10-08T18:05:00.000Z' }) },
    ] as Teilnahme[];
    const csv = kundenExport({ event: e, teilnahmen, kontakte, bestandIds: ['c-alt'] }).csv;
    const zeilen = csv.split('\r\n');
    expect(zeilen.find(z => z.includes('neu@example.invalid'))).toContain(KEINE_WERBE_EINWILLIGUNG);
    const alt = zeilen.find(z => z.includes('alt@example.invalid'))!;
    expect(alt).not.toContain(KEINE_WERBE_EINWILLIGUNG);
    expect(alt).toContain('Newsletter seit 12.03.2026');
  });
});

// ── M1 ──────────────────────────────────────────────────────────────────────────────────────────────
describe('M1 · Firma zur Karte', () => {
  const f = (name: string, x: Partial<Firma> = {}): Firma => ({ id: `f-${name.toLowerCase().replace(/\W+/g, '')}`, name, rolle: 'offen', geaendert: '2026-09-01', ...x } as Firma);
  const firmen = [f('Alpha Logistik GmbH', { domain: 'alpha-logistik.example' }), f('Konzern Holding AG', { domain: 'konzern.example' })];
  it('gleicher Name gewinnt', () => {
    expect(firmaZurKarte({ firma: 'Alpha Logistik', email: 'x@konzern.example' }, firmen)?.name).toBe('Alpha Logistik GmbH');
  });
  it('gleiche Domain NUR bei passendem Namen (dasselbe Wort, anders geschrieben)', () => {
    expect(firmaZurKarte({ firma: 'Alpha Logistik International', email: 'x@alpha-logistik.example' }, firmen)?.name).toBe('Alpha Logistik GmbH');
  });
  it('nennt die Karte einen ANDEREN Firmennamen, entsteht keine Zuordnung über die Domain (neue Firma)', () => {
    expect(firmaZurKarte({ firma: 'Delta Maschinenbau AG', email: 'dieter@alpha-logistik.example' }, firmen)).toBeUndefined();
    expect(firmaZurKarte({ firma: 'BM Beispiel', email: 'a@konzern.example' }, firmen)).toBeUndefined();
  });
  it('freie Mail-Anbieter zählen nie; ohne Firmennamen keine automatische Zuordnung', () => {
    expect(firmaZurKarte({ firma: 'Ganz Neu GmbH', email: 'x@gmail.com' }, [f('Gmail Fans', { domain: 'gmail.com' })])).toBeUndefined();
    expect(firmaZurKarte({ email: 'a@alpha-logistik.example' }, firmen)).toBeUndefined();
  });
  it('ohne Namen nur ein VORSCHLAG über die Domain (nie freie Anbieter)', () => {
    expect(firmaVorschlagAusDomain({ email: 'a@alpha-logistik.example' }, firmen)?.name).toBe('Alpha Logistik GmbH');
    expect(firmaVorschlagAusDomain({ email: 'a@gmail.com' }, [f('Gmail Fans', { domain: 'gmail.com' })])).toBeUndefined();
  });
});

// ── M2 ──────────────────────────────────────────────────────────────────────────────────────────────
type Mod = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let route: Mod;
let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/crm/speicher');
let gel: typeof import('@/lib/crm/events-geloescht');
let test: typeof import('@/lib/crm/netzwerken-server').netzwerkenTest;
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 1, 2, 3, 4, 5, 6, 7, 8]).toString('base64');
type Antwort = Record<string, unknown> & { ok: boolean; fehler?: string; eventFehler?: boolean; hinweise?: string[] };
const senden = async (body: unknown, user = 'kevin') => {
  const r = await route.POST(new Request('http://test/api/netzwerken', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': user }, body: JSON.stringify(body) }));
  return { status: r.status, d: await r.json() as Antwort };
};
const erfassung = (x: Record<string, unknown> = {}) => ({
  erfassungId: randomUUID(), erfasstAm: new Date().toISOString(), eventId: 'ev-test-1',
  kontakt: { vorname: 'Anna', nachname: 'Beispiel', firma: 'Beispielwerk Nord GmbH', email: 'anna.beispiel@example.invalid', anrede: 'Du' },
  bilder: [{ name: 'vorderseite.jpg', typ: 'image/jpeg', daten: JPEG }], schritt: 'nur-kontakt', zustaendig: 'kevin', ...x,
});
const crm = () => speicher.ladeCrm();
const EVENT = { id: 'ev-test-1', titel: 'Stammtisch Beispielstadt', format: 'sonstig', ziel: 'Gespräche', datum: '2026-10-02', status: 'geplant', marke: 'Netzwerken', geaendert: '2026-09-01' };
const ANDERES = { id: 'ev-andere', titel: 'Anderes Event', format: 'sonstig', ziel: 'Gespräche', datum: '2026-10-20', status: 'geplant', marke: 'Netzwerken', geaendert: '2026-09-01' };
const NEU = { titel: 'Stammtisch Beispielstadt', datum: '2026-10-02' };

async function frisch(events: object[] = [EVENT, ANDERES]) {
  await db.saveJson('kontakte', { kontakte: [] });
  await db.saveJson('events-geloescht', { eintraege: [] });
  await db.saveJson('crm', { ...speicher.leererBestand(), events });
  for (const n of ['crm-dateien--test-haus', 'netzwerken-erfassungen--test-haus', 'meldungen--malin', 'meldungen--kevin', 'tasks', 'absichten--test-haus']) {
    await db.saveJson(n, n.startsWith('crm-dateien') || n.startsWith('netzwerken') ? { eintraege: [] } : n.startsWith('meldungen') ? { eintraege: [], einstellungen: { telegram: false } } : n === 'tasks' ? { projects: [], tasks: [] } : { absichten: [] });
  }
}
/** Das Event „am Rechner löschen“ — über den echten Schreibweg des CRM (der merkt die Löschung). */
const loescheEvent = (id: string) => speicher.aendereCrm(b => ({ ...b, events: b.events.filter(e => e.id !== id), teilnahmen: b.teilnahmen.filter(t => t.eventId !== id) }));

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  speicher = await import('@/lib/crm/speicher');
  gel = await import('@/lib/crm/events-geloescht');
  test = (await import('@/lib/crm/netzwerken-server')).netzwerkenTest;
  route = (await import('@/app/api/netzwerken/route')) as unknown as Mod;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-02T09:00:00+02:00'));
  vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  const kto = (id: string, s: string, rolle: string) => ({ id, speicher: s, email: `${s}@test`, name: s, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' });
  await db.saveJson('konten', { konten: [kto('k1', 'kevin', 'inhaber'), kto('k2', 'malin', 'mitglied')], einladungen: [] });
  test.nachSchritt = null; test.vorAbhaken = null;
  await frisch();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('M2 · ein bewusst gelöschtes Event steht nicht wieder auf', () => {
  it('jede Löschung über den CRM-Schreibweg wird gemerkt (Kennung + Tag, keine Personendaten)', async () => {
    await loescheEvent('ev-test-1');
    expect(await gel.warEventGeloescht('ev-test-1')).toBe(true);
    expect(await gel.warEventGeloescht('ev-andere')).toBe(false);
    const roh = await db.loadJson<{ eintraege: { id: string; am: string }[] }>('events-geloescht');
    expect(roh?.eintraege).toEqual([{ id: 'ev-test-1', am: '2026-10-02' }]);
  });
  it('gelöscht + wartende Erfassung mit `eventNeu`: 404 mit `eventFehler` („Anderes Event wählen“), das Event wird NICHT neu angelegt, nichts erfasst', async () => {
    await loescheEvent('ev-test-1');
    const r = await senden(erfassung({ eventNeu: NEU }));
    expect(r.status).toBe(404);
    expect(r.d.eventFehler).toBe(true);
    expect(r.d.fehler).toContain('gelöscht');
    const c = await crm();
    expect(c.events.some(e => e.id === 'ev-test-1')).toBe(false);
    expect(c.teilnahmen).toHaveLength(0);
    expect(((await db.loadJson<{ kontakte: unknown[] }>('kontakte'))?.kontakte ?? [])).toHaveLength(0);
  });
  it('Event, das der Server NIE hatte (unterwegs lokal angelegt): `eventNeu` legt es an — wie bisher', async () => {
    await loescheEvent('ev-test-1'); // eine andere Kennung ist davon unberührt
    const r = await senden(erfassung({ eventId: 'ev-lokal-1', eventNeu: { titel: 'Unterwegs-Event', datum: '2026-10-02' } }));
    expect(r.status).toBe(200);
    expect((await crm()).events.some(e => e.id === 'ev-lokal-1')).toBe(true);
  });
  it('nach abgehaktem Schritt „event“ gelöscht: ebenfalls 404, kein Wiederauferstehen', async () => {
    const e = erfassung({ eventNeu: NEU });
    test.nachSchritt = s => { if (s === 'event') throw new Error('Testabbruch'); };
    expect((await senden(e)).status).toBe(500);
    test.nachSchritt = null;
    await loescheEvent('ev-test-1');
    const r = await senden(e);
    expect(r.status).toBe(404);
    expect(r.d.eventFehler).toBe(true);
    expect((await crm()).events.some(x => x.id === 'ev-test-1')).toBe(false);
  });
  it('nach 90 Tagen wird die Kennung vergessen — und beim Schreiben aufgeräumt', async () => {
    await db.saveJson('events-geloescht', { eintraege: [{ id: 'ev-alt', am: '2026-06-01' }, { id: 'ev-neu', am: '2026-09-20' }] });
    expect(await gel.warEventGeloescht('ev-alt')).toBe(false);
    expect(await gel.warEventGeloescht('ev-neu')).toBe(true);
    await gel.eventsAlsGeloeschtMerken(['ev-x']);
    expect((await db.loadJson<{ eintraege: { id: string }[] }>('events-geloescht'))?.eintraege.map(x => x.id)).toEqual(['ev-neu', 'ev-x']);
  });
});

// ── M3 / M8 ─────────────────────────────────────────────────────────────────────────────────────────
const HEUTE = '2026-09-27';
const alleJa: Kriterien = { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'ja', alternative: 'ja' };
const zeile = (o: Partial<LeadZeile>): LeadZeile => ({
  id: 'c-x', art: 'person', name: 'X', personen: [], status: 'qualifizierung', gesetzt: true, kriterien: alleJa, besitzer: 'malin', ohneBesitzer: false, bean: 'N',
  score: { punkte: 40, temperatur: 'lau', teile: [] }, kanal: 'bestand', qualifiziertAm: '2026-09-26', ...o,
});

describe('M3 · SQL bereit — Entscheidung offen bleibt in der Runde', () => {
  const sqlOffen = zeile({ id: 'sql-offen', name: 'SQL offen', score: { punkte: 20, temperatur: 'kalt', teile: [] } });
  const alter = zeile({ id: 'alter', name: 'Alter Lead', kriterien: leereKriterien(), qualifiziertAm: undefined, score: { punkte: 70, temperatur: 'warm', teile: [] } });
  const mitDeal = zeile({ id: 'deal', deal: { id: 'ch-1', titel: 'D', stufe: 'bedarf', wert: 0, offen: true } });
  const istSql = zeile({ id: 'sql', status: 'sql' });
  const geparkt = zeile({ id: 'ruht', status: 'ruht' });
  it('frisch geprüft und SQL-bereit ohne Deal: „Entscheidung offen“ — auch kalt, auch wenn die Prüfung frisch ist', () => {
    expect(sqlEntscheidungOffen(sqlOffen)).toBe(true);
    expect(sqlEntscheidungOffen(mitDeal)).toBe(false);
    expect(sqlEntscheidungOffen(istSql)).toBe(false);
    expect(sqlEntscheidungOffen(geparkt)).toBe(false);
    expect(sqlEntscheidungOffen(alter)).toBe(false); // nicht SQL-bereit
  });
  it('die Runde zeigt sie als Gruppe OBEN, vor Leads mit höherem Score; Leads mit Deal oder SQL-Status fehlen', () => {
    const r = zuQualifizieren([alter, sqlOffen, mitDeal, istSql, geparkt], { wer: 'alle', heute: HEUTE });
    expect(r.map(z => z.id)).toEqual(['sql-offen', 'alter']);
  });
  it('Besitzer- und Kanal-Filter gelten weiter', () => {
    expect(zuQualifizieren([sqlOffen], { wer: 'kevin', heute: HEUTE })).toEqual([]);
    expect(zuQualifizieren([sqlOffen], { wer: 'malin', heute: HEUTE })).toHaveLength(1);
    expect(zuQualifizieren([sqlOffen], { wer: 'alle', heute: HEUTE, kanal: 'event' })).toEqual([]);
  });
});

describe('M8 · Raus/Parken bei SQL oder Deal: Hinweis vorab, Knopf gesperrt', () => {
  it('die eine Regel für Server und Oberfläche', () => {
    expect(ausscheidenGesperrt(zeile({}))).toBeNull();
    expect(ausscheidenGesperrt(zeile({ status: 'sql' }))).toBe(AUSSCHEIDEN_GESPERRT);
    expect(ausscheidenGesperrt(zeile({ status: 'kunde' }))).toBe(AUSSCHEIDEN_GESPERRT);
    expect(ausscheidenGesperrt(zeile({ deal: { id: 'ch-1', titel: 'D', stufe: 'bedarf', wert: 0, offen: true } }))).toBe(AUSSCHEIDEN_GESPERRT);
    expect(ausscheidenGesperrt(zeile({ deal: { id: 'ch-1', titel: 'D', stufe: 'verloren', wert: 0, offen: false } }))).toBeNull();
  });
  it('der Dialog zeigt den Hinweis sofort und sperrt „Raus“ (auch mit gewähltem Grund); ohne Sperre bleibt er bedienbar', async () => {
    const { RausDialog, ParkenDialog } = await import('../components/os/crm/quali/KleineDialoge');
    const api = { crm: { heute: HEUTE }, laden: async () => {} } as never;
    const mit = (z: LeadZeile, K: typeof RausDialog) => renderToStaticMarkup(createElement(K, { api, z, onZu: () => {}, onFertig: () => {} }));
    for (const K of [RausDialog, ParkenDialog]) {
      const gesperrt = mit(zeile({ status: 'sql', name: 'Alpha' }), K);
      expect(gesperrt).toContain(AUSSCHEIDEN_GESPERRT);
      expect(gesperrt).toMatch(/<button[^>]*disabled=""[^>]*>(Raus|Parken)<\/button>/);
    }
    // ParkenDialog ist ohne Sperre sofort bedienbar (Wiedervorlage ist vorbelegt)
    expect(mit(zeile({ name: 'Alpha' }), ParkenDialog)).not.toContain(AUSSCHEIDEN_GESPERRT);
    expect(mit(zeile({ name: 'Alpha' }), ParkenDialog)).not.toMatch(/<button[^>]*disabled=""[^>]*>Parken<\/button>/);
  });
});

// ── M7 ──────────────────────────────────────────────────────────────────────────────────────────────
describe('M7 · Firma wechseln: keine Vorauswahl der Person bei einem Firmen-Lead', () => {
  const personen = [{ id: 'c-p1', name: 'Petra Alpha' }, { id: 'c-p2', name: 'Carsten Gamma' }];
  const kontakte = personen.map(p => k(p.id.slice(2), { vorname: p.name.split(' ')[0], nachname: p.name.split(' ')[1], firmaId: 'f-alpha', firma: 'Alpha Logistik GmbH' }));
  const api = { crm: { heute: HEUTE, stand: { ...{ firmen: [{ id: 'f-alpha', name: 'Alpha Logistik GmbH', rolle: 'offen', geaendert: '2026-09-01' }], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [] } } }, kontakte, ich: 'kevin' } as never;
  it('mehrere Personen: keine ist gewählt, der Hinweis steht da, „Firma ändern“ bleibt gesperrt', async () => {
    const { FirmaWechselnDialog } = await import('../components/os/crm/quali/FirmaWechseln');
    const z = zeile({ id: 'f-alpha', art: 'firma', name: 'Alpha Logistik GmbH', firmaId: 'f-alpha', hauptKontaktId: 'c-p1', personen: personen as never });
    const html = renderToStaticMarkup(createElement(FirmaWechselnDialog, { api, z, onZu: () => {}, onFertig: () => {} }));
    expect(html).toContain('Bitte eine Person wählen');
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Firma ändern<\/button>/);
  });
  it('eine einzige Person (oder ein Personen-Lead) ist die selbstverständliche Wahl', async () => {
    const { FirmaWechselnDialog } = await import('../components/os/crm/quali/FirmaWechseln');
    const z = zeile({ id: 'c-p1', art: 'person', name: 'Petra Alpha', hauptKontaktId: 'c-p1', personen: [personen[0]] as never });
    const html = renderToStaticMarkup(createElement(FirmaWechselnDialog, { api, z, onZu: () => {}, onFertig: () => {} }));
    expect(html).not.toContain('Bitte eine Person wählen');
    expect(html).toContain('bisher:');
  });
});

// ── M10 ─────────────────────────────────────────────────────────────────────────────────────────────
const ev = (x: Partial<Event> = {}): Event => ({ id: 'ev-a', titel: 'Kundentag', format: 'sonstig', ziel: '', datum: '2026-10-08', status: 'geplant', marke: 'Netzwerken', anmeldung: 'angemeldet', geaendert: '2026-09-01', ...x } as Event);
const tn = (id: string, eventId: string, x: Partial<Teilnahme> = {}): Teilnahme => ({ id: `t-${id}`, eventId, kontaktId: `c-${id}`, status: 'da', geaendert: '2026-10-01', ...x } as Teilnahme);
const ctx = (teilnahmen: Teilnahme[], heute = '2026-10-03'): BesuchKontext => ({ teilnahmen, kontakte: ['a', 'b', 'c', 'd'].map(i => k(i)), chancen: [] as Chance[], heute });

describe('M10 · besuchte Events: Erfassung = besucht; Follow-up-Quote mit Definition', () => {
  it('ein Event mit Erfassungen zählt auch bei künftigem Datum und „angemeldet“; ohne Erfassung und mit Zukunftsdatum nicht', () => {
    const z = [tn('a', 'ev-a', nw({ neuAngelegt: true }))];
    expect(zaehltAlsBesucht(ev(), z, '2026-10-03')).toBe(true);
    expect(zaehltAlsBesucht(ev(), [], '2026-10-03')).toBe(false);
    expect(zaehltAlsBesucht(ev({ anmeldung: 'besucht', datum: '2026-10-20' }), [], '2026-10-03')).toBe(false);
    expect(zaehltAlsBesucht(ev({ anmeldung: 'besucht', datum: '2026-10-01' }), [], '2026-10-03')).toBe(true);
    expect(zaehltAlsBesucht(ev({ anmeldung: 'abgesagt', status: 'abgesagt' }), z, '2026-10-03')).toBe(false);
    const u = besuchUebersicht([ev()], ctx(z));
    expect(u.zeilen).toHaveLength(1);
    expect(u.summe.kontakte).toBe(1);
  });
  it('die Kennzahlen zählen Events mit Erfassungen unabhängig vom Datum', () => {
    const z = [tn('a', 'ev-a', nw({ neuAngelegt: true })), tn('b', 'ev-a', nw({ neuAngelegt: true }))];
    const kpis = besuchKennzahlen([ev()], ctx(z));
    expect(kpis.find(x => x.id === 'besuche_events')?.anzeige).toBe('1');
    expect(kpis.find(x => x.id === 'besuche_kontakte')?.anzeige).toBe('2');
  });
  it('Follow-up-Quote: rechtzeitig (≤ 2 Tage nach dem Event) nachgefasst / erfasst ohne bewussten Verzicht — mit Definition', () => {
    const e = ev({ datum: '2026-10-01', status: 'durchgefuehrt', anmeldung: 'besucht' });
    const z = [
      tn('a', 'ev-a', { followUpAm: '2026-10-01', ...nw({ neuAngelegt: true }) }),            // am Eventtag: zählt
      tn('b', 'ev-a', { followUpAm: '2026-10-03', ...nw({ neuAngelegt: true }) }),            // am 2. Tag: zählt
      tn('c', 'ev-a', { followUpAm: '2026-10-09', ...nw({ neuAngelegt: true }) }),            // zu spät: zählt nicht
      tn('d', 'ev-a', { nachfassenVerzichtet: true, ...nw({ neuAngelegt: true }) }),          // „Nur Kontakt“: nicht im Nenner
    ];
    const w = besuchWirkung(e, ctx(z, '2026-10-12'));
    expect(w.kontakte).toBe(4);
    expect(w.followupBasis).toBe(3);
    expect(w.nachgefasst).toBe(2);
    expect(w.followupQuote).toBeCloseTo(2 / 3);
    const kpi = besuchKennzahlen([e], ctx(z, '2026-10-12')).find(x => x.id === 'besuche_followup')!;
    expect(kpi.anzeige).toBe('67 %');
    expect(kpi.definition).toBe(FOLLOWUP_QUOTE_DEFINITION);
    expect(FOLLOWUP_QUOTE_DEFINITION).toContain('innerhalb von 2 Tagen');
    expect(kpi.quelle).toBe('2 von 3 Personen rechtzeitig nachgefasst');
  });
  it('lauter „Nur Kontakt“: keine Quote statt 0 %', () => {
    const e = ev({ datum: '2026-10-01', status: 'durchgefuehrt', anmeldung: 'besucht' });
    const w = besuchWirkung(e, ctx([tn('a', 'ev-a', { nachfassenVerzichtet: true, ...nw({ neuAngelegt: true }) })], '2026-10-12'));
    expect(w.followupQuote).toBeNull();
  });
});

// ── NIEDRIG ─────────────────────────────────────────────────────────────────────────────────────────
describe('Kleinigkeiten', () => {
  it('Liquiplanung-Hinweise nennen das deutsche Datum, nie „2026-10-08“', () => {
    const e = ev({ kostenEuro: 500, status: 'geplant' });
    const s = liquiplanStand(e, null, '2026-10-03');
    expect(s.hinweis).toContain('08.10.2026');
    expect(s.hinweis).not.toContain('2026-10-08');
    const ok = liquiplanStand(e, { id: 'ev-ev-a', titel: 'Event', betrag: -500, ab: '2026-10-08', sicher: true, notiz: 'übernommen am 2026-10-03' } as never, '2026-10-03');
    expect(ok.hinweis).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
  it('Firmenakte: ein künftiges Event heißt „angemeldet“/„geplant“, nicht „besucht“', () => {
    const b = (e: Event, getroffen: boolean) => begegnungStatus({ event: e, getroffen }, '2026-10-03');
    expect(b(ev(), false)).toBe('angemeldet');
    expect(b(ev({ anmeldung: 'geplant' }), false)).toBe('geplant');
    expect(b(ev({ anmeldung: 'besucht', datum: '2026-10-20' }), false)).toBe('angemeldet');
    expect(b(ev({ anmeldung: 'besucht', datum: '2026-10-01', status: 'durchgefuehrt' }), false)).toBe('besucht');
    expect(b(ev(), true)).toBe('besucht');
    expect(b(ev({ marke: undefined }), false)).toBe('Make.One');
  });
  it('CSS-Wächter: Tippziele ≥ 44 px und 16-px-Eingaben nur für die geprüften Bereiche am Handy; Platz neben dem ZOE-Knopf', () => {
    const css = readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');
    for (const regel of ['.quali-flaeche button', '.quali-seite button', '.os-fenster button', '.os-fenster .os-fenster-zu', '.deal-anlegen input', '.quali-seite input', '.quali-aktionen { padding-right: 76px', '.quali-nav { margin-left: 0']) expect(css, regel).toContain(regel);
  });
  it('kein Umbruch mitten im Wort: Mail-Adressen bekommen Umbruchstellen nach @ . - _', async () => {
    const { weicheUmbrueche } = await import('../components/os/netzwerken/Erfassen');
    expect(weicheUmbrueche('petra.alpha@example.invalid · +49 40 5550111')).toBe('petra.​alpha@​example.​invalid · +49 40 5550111');
    expect(weicheUmbrueche('Ohne Adresse')).toBe('Ohne Adresse');
  });
});
