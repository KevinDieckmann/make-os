// ─── Bausteine bestellen (31.10.): Katalog, Bestellformular, Eingang (Anfrage + Entwurf + Bestätigung), Freigabe (Rechnung stellen + EINMAL senden),
// Ablehnen, Download-Link (Token, Ablauf, Zweck, Pfad, Storno), Verwaltung (Haushalt, Inhaber, Dienstweg), Middleware, Caddy, Art. 15/17, Verzeichnis ──
// Eigener Datenordner und eigener Unterlagen-Ordner (MAKE_OS_UNTERLAGEN_DIR) mit einem Probe-Katalog unter bausteine/, Datenschlüssel gesetzt, Konten mit
// Test-Haushalt, Verantwortlicher der Einrichtung gemockt, Absender-Prüfung und Sendeweg (Inbox) als Fake — es geht nichts hinaus. Alle Namen, Adressen
// und Beträge erfunden (@example.invalid, öffentliche Beispiel-IBAN zusammengesetzt). Die Rechnung läuft über den ECHTEN Stell-Weg (Nummer, PDF).
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import type { Kontakt } from '@/lib/make-one/crm';
import type { FinanzplanFile } from '@/lib/finanzen/finanzplan-bestand';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-bausteine-'));
const unterlagen = path.join(ordner, 'unterlagen');
const bausteine = path.join(unterlagen, 'bausteine');
mkdirSync(bausteine, { recursive: true });
process.env.MAKE_OS_DATEN_DIR = path.join(ordner, 'daten');
process.env.MAKE_OS_UNTERLAGEN_DIR = unterlagen;
process.env.MAKE_OS_KEY = 'pruef-schluessel-bausteine';
process.env.SESSION_SECRET = 'pruef-sitzung-bausteine-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-bausteine-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-bausteine-nur-im-test-0123456789abcdef';
delete process.env.MAKE_OS_ADRESSE;

const IBAN = ['DE89', '3704', '0044', '0532', '0130', '00'].join('');
const ds = vi.hoisted(() => ({ wert: { verantwortlich: null as string | null, seite: null as string | null } }));
vi.mock('@/lib/datenschutz/einrichtung-server', async () => ({
  ...(await vi.importActual<typeof import('@/lib/datenschutz/einrichtung-server')>('@/lib/datenschutz/einrichtung-server')),
  datenschutzOeffentlichLaden: async () => ds.wert,
}));
type Gesendet = { person: string; an: string; betreff?: string; text: string; anhaenge?: unknown; beleg?: unknown; uwg: unknown };
const fake = vi.hoisted(() => ({ fehlerEinmal: false, gesendet: [] as Gesendet[] }));
vi.mock('@/lib/crm/angebot-versand', () => ({
  absenderPruefen: async (a?: { postfach: string }) => (!a ? { ok: false, grund: 'Absender-Postfach fehlt.' } : a.postfach === 'pf-probe' ? { ok: true, adresse: 'versand@example.invalid' } : { ok: false, grund: 'Dieses Postfach gibt es nicht.' }),
}));
vi.mock('@/lib/inbox/senden-server', () => ({
  inboxSenden: async (person: string, b: { neu?: { betreff?: string }; an?: { email: string }[]; text?: string; uwgBestaetigt?: unknown; anhaenge?: unknown; beleg?: unknown }) => {
    if (fake.fehlerEinmal) { fake.fehlerEinmal = false; return { status: 502, body: { ok: false, fehler: 'Probe: Postfach nicht erreichbar.' } }; }
    fake.gesendet.push({ person, an: b.an?.[0]?.email ?? '', betreff: b.neu?.betreff, text: String(b.text ?? ''), anhaenge: b.anhaenge, beleg: b.beleg, uwg: b.uwgBestaetigt });
    return { status: 200, body: { ok: true, von: 'versand@example.invalid' } };
  },
}));

type Antwort = { status: number; d: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
let db: typeof import('@/lib/store/local-db');
let drossel: typeof import('@/lib/zugang/drossel');
let W: typeof import('@/lib/oeffentlich/website-post');
let S: typeof import('@/lib/bausteine/server');
let R: typeof import('@/lib/bausteine/regeln');
let route: { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let laden: { GET: (r: Request) => Promise<Response> };
let intern: { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let unterlageLaden: { GET: (r: Request) => Promise<Response> };
const D = 'example.invalid';
const PDF = Buffer.from('%PDF-1.4\n% Probe-Baustein\n%%EOF\n');
const XLSX = Buffer.from('PK\u0003\u0004 Probe-Tabelle');
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const lesen = async (q: string): Promise<Antwort> => { const r = await route.GET(new Request(`http://test/api/bestellung${q}`)); return { status: r.status, d: await r.json() }; };
const post = async (body: Record<string, unknown>): Promise<Antwort> => { const r = await route.POST(new Request('http://test/api/bestellung', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() }; };
const verwalten = async (body: Record<string, unknown>, kopf: Record<string, string> = sitzung('kevin')): Promise<Antwort> => { const r = await intern.POST(new Request('http://test/api/bausteine/intern', { method: 'POST', headers: kopf, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() }; };
const stand = async (person = 'kevin'): Promise<Antwort> => { const r = await intern.GET(new Request('http://test/api/bausteine/intern', { headers: sitzung(person) })); return { status: r.status, d: await r.json() }; };
const holen = (q: string) => laden.GET(new Request(`http://test/api/baustein/laden${q}`));
const linksAus = (text: string) => Array.from(text.matchAll(/https:\/\/\S+\/api\/baustein\/laden\?t=([^&\s]+)&b=([^&\s]+)&d=(pdf|xlsx)/g)).map(m => ({ t: decodeURIComponent(m[1]), b: decodeURIComponent(m[2]), d: m[3] }));
const plan = async () => (await db.loadJson<FinanzplanFile>('finanzplan'))!;
const bestellungen = async () => (await db.loadJson<{ bestellungen: import('@/lib/bausteine/regeln').Bestellung[] }>('baustein-bestellungen'))?.bestellungen ?? [];
const kontakte = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];

const T0 = new Date('2026-11-12T08:00:00Z');
let uhr = T0.getTime();
const weiter = (sek: number) => { uhr += sek * 1000; vi.setSystemTime(new Date(uhr)); };
let fassung = '';
/** Eine vollständige Bestellung (Stempel 10 s alt, Fassung der Seite). */
const bestellung = (x: Record<string, unknown> = {}) => ({
  id: 'probe-baustein', vorname: 'Testa', nachname: 'Muster', firma: 'Probe GmbH', strasse: 'Probeweg 1', plz: '12345', ort: 'Musterstadt', land: 'DE',
  email: `testa@${D}`, unternehmer: true, bedingungen: true, bedingungenFassung: fassung, stempel: S.bestellStempel(uhr - 10_000), webseite: '', ...x,
});

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  writeFileSync(path.join(bausteine, 'probe-baustein.pdf'), PDF);
  writeFileSync(path.join(bausteine, 'probe-baustein.xlsx'), XLSX);
  writeFileSync(path.join(bausteine, 'probe-zwei.pdf'), PDF);
  writeFileSync(path.join(ordner, 'geheim.pdf'), Buffer.from('%PDF-1.4 geheim'));
  symlinkSync(path.join(ordner, 'geheim.pdf'), path.join(bausteine, 'verknuepft.pdf'));
  writeFileSync(path.join(bausteine, 'katalog.json'), JSON.stringify({ bausteine: [
    { id: 'probe-baustein', titel: 'Probe-Baustein Vertrieb', bereich: 'Vertrieb', preis: 4900, seite: '/bausteine/probe-baustein/', dateien: [
      { art: 'pdf', datei: 'probe-baustein.pdf', name: 'Probe Baustein Übung.pdf' }, { art: 'xlsx', datei: 'probe-baustein.xlsx', name: 'Probe Tabelle.xlsx' }] },
    { id: 'probe-zwei', titel: 'Probe-Baustein Zwei', bereich: 'Innovation', preis: 9900, seite: '/bausteine/probe-zwei/', dateien: [{ art: 'pdf', datei: 'probe-zwei.pdf', name: 'Zwei.pdf' }] },
    { id: 'probe-paket', titel: 'Probe-Paket', bereich: 'Vertrieb', preis: 12900, seite: '/bausteine/probe-paket/', paket: ['probe-baustein', 'probe-zwei'] },
    { id: 'pfad-angriff', titel: 'Angriff', bereich: 'x', preis: 100, seite: '/x/', dateien: [{ art: 'pdf', datei: '../geheim.pdf', name: 'x.pdf' }] },
    { id: 'verknuepft', titel: 'Verknüpft', bereich: 'x', preis: 100, seite: '/v/', dateien: [{ art: 'pdf', datei: 'verknuepft.pdf', name: 'v.pdf' }] },
  ] }));
  // Eine Unterlage (kostenlos) — ihre Tokens dürfen nie Bausteine liefern und umgekehrt.
  writeFileSync(path.join(unterlagen, 'frei.pdf'), PDF);
  writeFileSync(path.join(unterlagen, 'katalog.json'), JSON.stringify({ unterlagen: [{ id: 'frei', titel: 'Frei', seite: '/frei/', dateien: [{ art: 'pdf', datei: 'frei.pdf', name: 'Frei.pdf' }] }] }));
  db = await import('@/lib/store/local-db');
  drossel = await import('@/lib/zugang/drossel');
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) => ({ id, speicher: sp, email: `${sp}@${D}`, name: `${sp} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber', { haushalt: 'test-haus' }), konto('k2', 'malin', 'mitglied', { haushalt: 'test-haus' }), konto('k3', 'nurbusiness', 'mitglied', { haushalt: 'test-haus', finanzRecht: 'business' }), konto('k4', 'gast', 'mitglied', { haushalt: 'anderer-haus' })], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [] });
  await db.saveJson('gesellschaften--test-haus', { gesellschaften: [
    { id: 'kdv', firmierung: 'Beispiel Ventures UG (haftungsbeschränkt)', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', email: `info@${D}`, steuernummer: '12/345/67890', bank: { iban: IBAN, bic: 'COBADEFFXXX', bank: 'Beispielbank' }, geschaeftsfuehrung: 'Erika Beispiel', register: 'Amtsgericht Musterstadt HRB 1' },
  ] });
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', SEED);
  W = await import('@/lib/oeffentlich/website-post');
  S = await import('@/lib/bausteine/server');
  R = await import('@/lib/bausteine/regeln');
  route = await import('@/app/api/bestellung/route');
  laden = await import('@/app/api/baustein/laden/route');
  intern = await import('@/app/api/bausteine/intern/route');
  unterlageLaden = await import('@/app/api/unterlage/laden/route');
});
afterEach(() => { drossel._zuruecksetzen(); W._websitePostZuruecksetzen(); });
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  vi.useRealTimers();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Katalog und Regeln (rein)', () => {
  it('Pakete nur aus gültigen Einzel-Bausteinen, Preise in ganzen Cent, Pfade sicher', () => {
    const { bausteine: b, fehler } = R.katalogPruefen({ bausteine: [
      { id: 'a', titel: 'A', bereich: 'x', preis: 4900, seite: '/a/', dateien: [{ art: 'pdf', datei: 'a.pdf', name: 'A.pdf' }] },
      { id: 'b', titel: 'B', bereich: 'x', preis: 49.5, seite: '/b/', dateien: [{ art: 'pdf', datei: 'b.pdf' }] },
      { id: 'c', titel: 'C', bereich: 'x', preis: 100, seite: '/c/', dateien: [{ art: 'pdf', datei: '../c.pdf' }] },
      { id: 'p', titel: 'P', bereich: 'x', preis: 9000, seite: '/p/', paket: ['a', 'fehlt'] },
      { id: 'q', titel: 'Q', bereich: 'x', preis: 9000, seite: '/q/', paket: ['a'] },
      { id: 'r', titel: 'R', bereich: 'x', preis: 9000, seite: '/r/', paket: ['a', 'a2'], dateien: [{ art: 'pdf', datei: 'r.pdf' }] },
      { id: 'a2', titel: 'A2', bereich: 'x', preis: 100, seite: '/a2/', dateien: [{ art: 'xlsx', datei: 'a2.xlsx' }] },
      { id: 'ok', titel: 'OK', bereich: 'x', preis: 9000, seite: '/ok/', paket: ['a', 'a2'] },
    ] });
    expect(b.map(x => x.id)).toEqual(['a', 'a2', 'ok']);
    expect(fehler).toHaveLength(5);
    expect(R.teileVon(b.find(x => x.id === 'ok')!, b).map(x => x.id)).toEqual(['a', 'a2']);
  });
  it('Beträge über ust.ts, Fassung folgt dem Text (auch dem Zahlungsziel), Bedingungen ohne Namen und Beträge', () => {
    expect(R.betraege(4900, 19)).toEqual({ netto: 4900, ust: 931, brutto: 5831, satz: 19 });
    expect(R.betraege(4900, 0).brutto).toBe(4900);
    const a = R.bedingungenFassung(R.bedingungenZeilen({}));
    expect(R.bedingungenFassung(R.bedingungenZeilen({ zahlungszielTage: 30 }))).not.toBe(a);
    expect(R.bedingungenZeilen({ zahlungszielTage: 30 }).join(' ')).toContain('innerhalb von 30 Tagen');
    expect(R.BEDINGUNGEN_VORGABE.join(' ')).not.toMatch(/€|\d+,\d\d|GmbH|UG\b/);
    expect(R.bedingungenTextPruefen('x'.repeat(4000))).toMatchObject({ ok: false, status: 413 });
  });
  it('Eingabe: Pflichtfelder, eine Zeile je Angabe, Land als Code, USt-IdNr. geformt, zu lang → 413', () => {
    const gut = { vorname: 'Testa', nachname: 'Muster', firma: 'Probe GmbH', strasse: 'Probeweg 1', plz: '12345', ort: 'Musterstadt', email: `Testa@${D}` };
    expect(R.eingabePruefen(gut)).toMatchObject({ ok: true, besteller: { land: 'DE', email: `testa@${D}` } });
    expect(R.eingabePruefen({ ...gut, firma: '' })).toMatchObject({ ok: false, status: 400 });
    expect(R.eingabePruefen({ ...gut, strasse: 'a\nb' })).toMatchObject({ ok: false, status: 400 });
    expect(R.eingabePruefen({ ...gut, land: 'Atlantis' })).toMatchObject({ ok: false, status: 400 });
    expect(R.eingabePruefen({ ...gut, land: 'Österreich', ustid: 'at u12345678' })).toMatchObject({ ok: true, besteller: { land: 'AT', ustid: 'ATU12345678' } });
    expect(R.eingabePruefen({ ...gut, firma: 'x'.repeat(121) })).toMatchObject({ ok: false, status: 413 });
  });
});

describe('ausgeschaltet bzw. unvollständig', () => {
  it('GET: aktiv false, Stempel und Bedingungen null; unbekannt 404; POST 404', async () => {
    const g = await lesen('?id=probe-baustein');
    expect(g.status).toBe(200);
    expect(g.d).toMatchObject({ ok: true, aktiv: false, titel: 'Probe-Baustein Vertrieb', preis: 4900, stempel: null, bedingungen: null });
    expect((await lesen('?id=gibt-es-nicht')).status).toBe(404);
    expect((await lesen('?id=pfad-angriff')).status).toBe(404);
    expect((await lesen('?id=../x')).status).toBe(404);
    expect((await post(bestellung())).status).toBe(404);
  });
  it('Einschalten ohne Gesellschaft bzw. Website-Absender → 409; nur ein Inhaber; nie eine Privat-Einheit; nie der Dienstweg', async () => {
    expect((await verwalten({ aktion: 'einstellungen', aktiv: true })).status).toBe(409);
    // 02.11. (Prüfung D): ein volles Mitglied steuert wie ein Inhaber — die Sperre gilt einem Konto „nur Business“.
    expect((await verwalten({ aktion: 'einstellungen', gesellschaft: 'kdv' }, sitzung('nurbusiness'))).status).toBe(403);
    expect((await verwalten({ aktion: 'einstellungen', gesellschaft: 'kdc' })).status).toBe(400);
    expect((await verwalten({ aktion: 'einstellungen', gesellschaft: 'kdv' }, { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' })).status).toBe(403);
    const r = await verwalten({ aktion: 'einstellungen', gesellschaft: 'kdv', zahlungszielTage: 14 });
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    expect(r.d.gruende.join(' ')).toMatch(/Website-Absender fehlt|Verantwortlicher fehlt/);
    expect((await verwalten({ aktion: 'einstellungen', aktiv: true })).status).toBe(409);
  });
});

describe('Bestellung', () => {
  beforeAll(async () => {
    ds.wert = { verantwortlich: `Probe GmbH, datenschutz@${D}`, seite: `${D}/datenschutz` };
    await db.saveJson('newsletter-einstellungen', { aktiv: false, fassung: 1, absender: { person: 'kevin', postfach: 'pf-probe', gesetztAm: T0.toISOString() }, website: `https://www.${D}`, marke: 'Probe Marke' });
    const r = await verwalten({ aktion: 'einstellungen', aktiv: true });
    expect(r.status, JSON.stringify(r.d)).toBe(200);
  });

  it('GET: Preis, Brutto, Stempel, Bedingungen mit Fassung, Hinweis mit Vertragspartner — nie die Kennung der Gesellschaft', async () => {
    const g = await lesen('?id=probe-baustein');
    expect(g.d).toMatchObject({ ok: true, aktiv: true, preis: 4900, ust: 19, brutto: 5831 });
    expect(typeof g.d.stempel).toBe('string');
    expect(g.d.bedingungen.zeilen.length).toBeGreaterThan(2);
    expect(g.d.bedingungen.fassung).toMatch(/^bb-[0-9a-f]{8}$/);
    expect(g.d.hinweis.zeilen[0]).toBe('Vertragspartner und Rechnungssteller: Beispiel Ventures UG (haftungsbeschränkt).');
    expect(JSON.stringify(g.d)).not.toMatch(/"kdv"|gesellschaft/);
    fassung = g.d.bedingungen.fassung;
  });

  it('Honigtopf, Stempel (gefälscht, zu schnell), Haken, Fassung, Größe — nichts gespeichert', async () => {
    expect((await post(bestellung({ webseite: 'x' }))).status).toBe(400);
    expect((await post(bestellung({ stempel: `${uhr - 10_000}.falsch` }))).status).toBe(400);
    expect((await post(bestellung({ stempel: S.bestellStempel(uhr - 1000) }))).status).toBe(400);
    expect((await post(bestellung({ unternehmer: false }))).status).toBe(400);
    drossel._zuruecksetzen();
    expect((await post(bestellung({ bedingungen: false }))).status).toBe(400);
    const alt = await post(bestellung({ bedingungenFassung: 'bb-00000000' }));
    expect(alt.status).toBe(409);
    expect(alt.d.fehler).toBe(R.FASSUNG_ALT);
    expect((await post(bestellung({ firma: 'x'.repeat(121) }))).status).toBe(413);
    expect((await post({ ...bestellung(), rest: 'x'.repeat(9000) })).status).toBe(413);
    drossel._zuruecksetzen();
    expect((await post(bestellung({ id: 'gibt-es-nicht' }))).status).toBe(404);
    expect(await bestellungen()).toHaveLength(0);
  });

  it('Drossel je Netz: nach sechs Bestellungen 429', async () => {
    for (let i = 0; i < 7; i++) await post(bestellung({ email: "kaputt" }));
    expect((await post(bestellung())).status).toBe(429);
  });

  let ersteId = '';
  it('angenommen: dieselbe Antwort; danach Anfrage im CRM, Rechnungs-Entwurf, Eingangsbestätigung, Glocke', async () => {
    const r = await post(bestellung());
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    expect(r.d).toEqual({ ok: true, text: R.BESTELL_TEXT });
    await W._nachlauf();
    const [b] = await bestellungen();
    ersteId = b.id;
    expect(b).toMatchObject({ status: 'neu', bausteinId: 'probe-baustein', preisCent: 4900, ustSatz: 19, teile: ['probe-baustein'], unternehmer: true, bedingungen: { fassung } });
    expect(b.kontaktId).toBeTruthy();
    expect(b.rechnungId).toMatch(/^r-b[0-9a-f]{24}$/);
    const k = (await kontakte()).find(x => x.id === b.kontaktId)!;
    expect(k.aktivitaeten.some(a => /Baustein „Probe-Baustein Vertrieb“ bestellt/.test(a.text ?? ''))).toBe(true);
    const re = (await plan()).rechnungen.find(x => x.id === b.rechnungId)!;
    expect(re).toMatchObject({ status: 'geplant', firmaId: 'kdv', kontaktId: b.kontaktId, betrag: 58.31, netto: 49 });
    expect(re.nummer).toBeUndefined();
    expect((re as { empfaenger?: Record<string, string> }).empfaenger).toMatchObject({ firma: 'Probe GmbH', strasse: 'Probeweg 1', plz: '12345', ort: 'Musterstadt', email: `testa@${D}` });
    // Bestätigung: genau eine Mail an die Adresse, ohne Firma/Anschrift aus dem Formular, ohne Anhang, ohne Download-Link.
    expect(fake.gesendet).toHaveLength(1);
    const m = fake.gesendet[0];
    expect(m).toMatchObject({ person: 'kevin', an: `testa@${D}`, uwg: true });
    expect(m.text).toContain('ist eingegangen');
    expect(m.text).not.toMatch(/Probeweg|Musterstadt|12345|api\/baustein/);
    expect(m.anhaenge).toBeUndefined();
    const glocke = await db.loadJson<{ eintraege: { titel: string }[] }>('meldungen--malin');
    expect(glocke?.eintraege.some(x => /^Neue Baustein-Bestellung/.test(x.titel) && !/Probe|€/.test(x.titel))).toBe(true);
  });

  it('vor der Freigabe liefert kein Link etwas', async () => {
    const t = S.linkToken(ersteId);
    expect((await holen(`?t=${encodeURIComponent(t)}&b=probe-baustein&d=pdf`)).status).toBe(404);
  });

  it('Verwaltung: nur der Haushalt sieht Bestellungen (Sicht ohne Haushalt bekommt nichts), Lesen schreibt nichts', async () => {
    const fremd = await stand('gast');
    expect(fremd.status).toBe(403);
    expect(JSON.stringify(fremd.d)).not.toMatch(/testa|Probe GmbH/);
    const ohne = await intern.GET(new Request('http://test/api/bausteine/intern'));
    expect([401, 403]).toContain(ohne.status);
    const vorher = JSON.stringify(await bestellungen());
    const s = await stand('malin');
    expect(s.status).toBe(200);
    expect(s.d.offen).toHaveLength(1);
    expect(s.d.offen[0]).toMatchObject({ firma: 'Probe GmbH', email: `testa@${D}`, brutto: 5831, status: 'neu' });
    expect(JSON.stringify(await bestellungen())).toBe(vorher);
  });

  it('Freigabe: Dienstweg 403; der Klick stellt die Rechnung und sendet GENAU einmal (Anhang = PDF der Rechnung, Links), zweiter Klick nichts', async () => {
    const dienst = await verwalten({ aktion: 'freigeben', id: ersteId }, { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' });
    expect(dienst.status).toBe(403);
    expect((await verwalten({ aktion: 'freigeben', id: ersteId }, sitzung('gast'))).status).toBe(403);
    // Erst scheitert das Senden: die Rechnung ist gestellt, die Bestellung bleibt offen, nichts doppelt.
    fake.gesendet.length = 0;
    fake.fehlerEinmal = true;
    weiter(3600);
    const f1 = await verwalten({ aktion: 'freigeben', id: ersteId }, sitzung('malin'));
    expect(f1.status).toBe(502);
    expect(f1.d.fehler).toMatch(/gestellt, die Mail ging aber nicht raus/);
    const [b1] = await bestellungen();
    expect(b1.status).toBe('neu');
    expect(b1.inArbeit).toBeUndefined();
    const re1 = (await plan()).rechnungen.find(x => x.id === b1.rechnungId)!;
    expect(re1.status).toBe('gestellt');
    expect(re1.nummer).toMatch(/^KDV-R-2026-\d{4}$/);
    expect(fake.gesendet).toHaveLength(0);
    // Zweiter Versuch: nur senden — dieselbe Nummer.
    const f2 = await verwalten({ aktion: 'freigeben', id: ersteId }, sitzung('malin'));
    expect(f2.status, JSON.stringify(f2.d)).toBe(200);
    expect(f2.d.nummer).toBe(re1.nummer);
    expect(fake.gesendet).toHaveLength(1);
    const m = fake.gesendet[0];
    expect(m).toMatchObject({ person: 'kevin', an: `testa@${D}`, uwg: true, beleg: { art: 'rechnung', id: re1.id }, anhaenge: [{ datei: re1.pdfDateiId }] });
    expect(m.betreff).toContain(re1.nummer!);
    const links = linksAus(m.text);
    expect(links.map(l => `${l.b}:${l.d}`)).toEqual(['probe-baustein:pdf', 'probe-baustein:xlsx']);
    expect(m.text).not.toMatch(/testa@|Musterstadt/);
    const [b2] = await bestellungen();
    expect(b2).toMatchObject({ status: 'geliefert', geliefert: { von: 'malin' } });
    expect(f2.d.erledigt[0].status).toBe('geliefert');
    // Dritter Klick: nichts gesendet, nichts neu gestellt.
    const f3 = await verwalten({ aktion: 'freigeben', id: ersteId }, sitzung('kevin'));
    expect(f3.d.schon).toBe(true);
    expect(fake.gesendet).toHaveLength(1);
    expect((await plan()).rechnungen.filter(x => x.id === re1.id)).toHaveLength(1);
  });

  it('Download: richtige Datei als Anhang; falsch/fremder Baustein/fremder Zweck 404; abgelaufen 410; nach Storno nichts mehr', async () => {
    const links = linksAus(fake.gesendet[0].text);
    const ok = await holen(`?t=${encodeURIComponent(links[0].t)}&b=probe-baustein&d=pdf`);
    expect(ok.status).toBe(200);
    expect(Buffer.from(await ok.arrayBuffer()).equals(PDF)).toBe(true);
    expect(ok.headers.get('content-disposition')).toMatch(/^attachment; filename="Probe Baustein Uebung\.pdf"/);
    expect(ok.headers.get('x-content-type-options')).toBe('nosniff');
    expect(ok.headers.get('content-security-policy')).toContain('sandbox');
    expect(links[0].t).not.toContain('testa');
    drossel._zuruecksetzen();
    expect((await holen(`?t=${encodeURIComponent(links[0].t)}&b=probe-zwei&d=pdf`)).status).toBe(404);
    expect((await holen(`?t=${encodeURIComponent(links[0].t)}&b=../geheim&d=pdf`)).status).toBe(404);
    expect((await holen(`?t=${encodeURIComponent(links[0].t)}&b=probe-baustein&d=doc`)).status).toBe(404);
    const falsch = await holen(`?t=${encodeURIComponent(links[0].t.slice(0, -2))}xx&b=probe-baustein&d=pdf`);
    expect(falsch.status).toBe(404);
    expect(await falsch.text()).toMatch(/Schreiben Sie uns, wir schicken einen neuen Link/);
    drossel._zuruecksetzen();
    // Ein Unterlagen-Token liefert hier nie, ein Baustein-Token dort nie.
    const { linkToken: unterlageToken } = await import('@/lib/unterlagen/server');
    expect((await holen(`?t=${encodeURIComponent(unterlageToken('frei'))}&b=probe-baustein&d=pdf`)).status).toBe(404);
    expect((await unterlageLaden.GET(new Request(`http://test/api/unterlage/laden?t=${encodeURIComponent(links[0].t)}&d=pdf`))).status).toBe(404);
    drossel._zuruecksetzen();
    // Abgelaufen (31 Tage später).
    weiter(31 * 86_400);
    const alt = await holen(`?t=${encodeURIComponent(links[0].t)}&b=probe-baustein&d=pdf`);
    expect(alt.status).toBe(410);
    // Neue Links (per Klick): gehen ohne Anhang raus und gelten wieder.
    const neu = await verwalten({ aktion: 'links-neu', id: ersteId }, sitzung('kevin'));
    expect(neu.status, JSON.stringify(neu.d)).toBe(200);
    expect(fake.gesendet).toHaveLength(2);
    expect(fake.gesendet[1].anhaenge).toBeUndefined();
    const frisch = linksAus(fake.gesendet[1].text)[0];
    expect((await holen(`?t=${encodeURIComponent(frisch.t)}&b=probe-baustein&d=pdf`)).status).toBe(200);
    // Storno der Rechnung → der Link liefert nichts mehr, die Bestellung steht als „storniert“.
    const [b] = await bestellungen();
    const server = await import('@/lib/finanzen/rechnung/server');
    await server.rechnungStornieren({ id: b.rechnungId!, grund: 'Probe-Storno', person: 'kevin', haushalt: 'test-haus', sicht: 'privat' });
    drossel._zuruecksetzen();
    expect((await holen(`?t=${encodeURIComponent(frisch.t)}&b=probe-baustein&d=pdf`)).status).toBe(404);
    expect((await stand()).d.erledigt[0].status).toBe('storniert');
    expect((await verwalten({ aktion: 'links-neu', id: ersteId })).status).toBe(409);
  });

  it('Paket: geliefert werden die Dateien seiner Teile; Pfad über eine Verknüpfung nie', async () => {
    weiter(3600);
    const g = await lesen('?id=probe-paket');
    fassung = g.d.bedingungen.fassung;
    expect((await post(bestellung({ id: 'probe-paket', email: `paket@${D}`, stempel: S.bestellStempel(uhr - 10_000) }))).status).toBe(200);
    await W._nachlauf();
    const b = (await bestellungen()).find(x => x.bausteinId === 'probe-paket')!;
    expect(b.teile).toEqual(['probe-baustein', 'probe-zwei']);
    const vorher = fake.gesendet.length;
    expect((await verwalten({ aktion: 'freigeben', id: b.id })).status).toBe(200);
    const m = fake.gesendet[fake.gesendet.length - 1];
    expect(fake.gesendet.length).toBe(vorher + 1); // die Lieferung (die Bestätigung kam schon nach dem Eingang)
    const links = linksAus(m.text);
    expect(links.map(l => `${l.b}:${l.d}`)).toEqual(['probe-baustein:pdf', 'probe-baustein:xlsx', 'probe-zwei:pdf']);
    drossel._zuruecksetzen();
    expect((await holen(`?t=${encodeURIComponent(links[2].t)}&b=probe-zwei&d=pdf`)).status).toBe(200);
    // „verknuepft“ steht im Katalog, ist aber keine Datei IM Ordner — und gehört nicht zur Bestellung.
    expect((await S.dateiLesen((await S.bausteinVon('verknuepft'))!, 'pdf'))).toBeNull();
    expect((await S.bausteinVon('pfad-angriff'))).toBeNull();
  });

  it('Ablehnen: Entwurf weg, nichts verschickt — außer die Absage ist gewählt', async () => {
    weiter(3600);
    fassung = (await lesen('?id=probe-zwei')).d.bedingungen.fassung;
    expect((await post(bestellung({ id: 'probe-zwei', email: `nein@${D}`, stempel: S.bestellStempel(uhr - 10_000) }))).status).toBe(200);
    expect((await post(bestellung({ id: 'probe-zwei', email: `absage@${D}`, stempel: S.bestellStempel(uhr - 10_000) }))).status).toBe(200);
    await W._nachlauf();
    const a = (await bestellungen()).find(x => x.besteller.email === `nein@${D}`)!;
    const c = (await bestellungen()).find(x => x.besteller.email === `absage@${D}`)!;
    expect((await plan()).rechnungen.some(r => r.id === a.rechnungId)).toBe(true);
    const vorher = fake.gesendet.length;
    const r1 = await verwalten({ aktion: 'ablehnen', id: a.id, grund: 'Probe' }, sitzung('malin'));
    expect(r1.status, JSON.stringify(r1.d)).toBe(200);
    expect((await plan()).rechnungen.some(r => r.id === a.rechnungId)).toBe(false);
    expect(fake.gesendet.length).toBe(vorher);
    expect((await bestellungen()).find(x => x.id === a.id)).toMatchObject({ status: 'abgelehnt', abgelehnt: { von: 'malin', grund: 'Probe' } });
    expect((await verwalten({ aktion: 'freigeben', id: a.id })).status).toBe(409);
    const r2 = await verwalten({ aktion: 'ablehnen', id: c.id, absage: true });
    expect(r2.status).toBe(200);
    expect(fake.gesendet.length).toBe(vorher + 1);
    expect(fake.gesendet[fake.gesendet.length - 1]).toMatchObject({ an: `absage@${D}` });
    expect(fake.gesendet[fake.gesendet.length - 1].text).toMatch(/nicht annehmen/);
  });
});

describe('Art. 15/17 und Aufbewahrung', () => {
  it('Art. 17: nicht gelieferte Bestellungen weg, gelieferte behalten die Rechnungsdaten (Telefon und Kartei-Bezug getilgt)', async () => {
    const { bestellungenOhne, GELOESCHT } = await import('@/lib/crm/person-weitere');
    const basis = { besteller: { vorname: 'A', nachname: 'B', firma: 'F', strasse: 's', plz: '1', ort: 'o', land: 'DE', email: `x@${D}`, telefon: '+49 30 1234567' } };
    const r = bestellungenOhne({ bestellungen: [{ id: 'bb-1', status: 'neu', kontaktId: 'c-x', ...basis }, { id: 'bb-2', status: 'geliefert', kontaktId: 'c-x', ...basis }, { id: 'bb-3', status: 'neu', kontaktId: 'c-anders', besteller: { ...basis.besteller, email: `y@${D}` } }] }, { id: 'c-x', name: 'A B', emails: [`x@${D}`], fingerabdruecke: [] });
    expect(r.n).toBe(2);
    const l = (r.neu as { bestellungen: Record<string, any>[] }).bestellungen; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(l.map(x => x.id)).toEqual(['bb-2', 'bb-3']);
    expect(l[0].kontaktId).toBe(GELOESCHT);
    expect(l[0].besteller).toMatchObject({ firma: 'F', strasse: 's', email: `x@${D}` });
    expect(l[0].besteller.telefon).toBeUndefined();
  });
  it('Art. 15: die Bestellungen einer Person mit Rechnungsnummer; Bereich „bausteine“ → Verzeichnis-Eintrag', async () => {
    const [b] = await bestellungen();
    const a = await S.bestellungenAuskunft({ id: b.kontaktId!, emails: [] });
    expect(a[0]).toMatchObject({ baustein: 'Probe-Baustein Vertrieb', status: 'storniert', bedingungen: { fassung: b.bedingungen.fassung } });
    expect(a[0].rechnung).toMatch(/^KDV-R-/);
    const { kontaktBereiche, verarbeitungenFuer } = await import('@/lib/datenschutz/art15');
    expect(verarbeitungenFuer('kontakt', kontaktBereiche({ bausteinBestellungen: a }))).toContain('vv-bausteine');
  });
  it('Aufbewahrung: abgelehnt nach 90 Tagen weg, geliefert 6 Jahre ab Jahresende, neu bleibt', () => {
    const b = (status: 'neu' | 'abgelehnt' | 'geliefert', am: string) => ({ id: `bb-${status}`, am, status, ...(status === 'abgelehnt' ? { abgelehnt: { am, von: 'x' } } : {}), ...(status === 'geliefert' ? { geliefert: { am, von: 'x', ueber: 'x' } } : {}) }) as unknown as import('@/lib/bausteine/regeln').Bestellung;
    const l = [b('neu', '2020-01-01T00:00:00Z'), b('abgelehnt', '2026-01-01T00:00:00Z'), b('geliefert', '2020-06-01T00:00:00Z')];
    expect(R.nachFrist(l, new Date('2026-03-01T00:00:00Z')).map(x => x.status)).toEqual(['neu', 'abgelehnt', 'geliefert']);
    expect(R.nachFrist(l, new Date('2026-05-01T00:00:00Z')).map(x => x.status)).toEqual(['neu', 'geliefert']);
    expect(R.nachFrist(l, new Date('2027-01-02T00:00:00Z')).map(x => x.status)).toEqual(['neu']);
  });
  it('Verzeichnis (Art. 30): „Bausteine bestellen“ erst, wenn eingeschaltet', async () => {
    const { verzeichnisVervollstaendigen, VV_BAUSTEINE_ID } = await import('@/lib/crm/datenschutz');
    const jetzt = new Date().toISOString();
    expect(verzeichnisVervollstaendigen([], jetzt).liste.some(v => v.id === VV_BAUSTEINE_ID)).toBe(false);
    const mit = verzeichnisVervollstaendigen([], jetzt, { bausteine: true }).liste.find(v => v.id === VV_BAUSTEINE_ID);
    expect(mit?.rechtsgrundlage).toMatch(/lit\. b/);
    expect(await S.bausteineEingerichtet()).toBe(true);
  });
});

describe('Middleware, Caddy, Köpfe', () => {
  let middleware: typeof import('@/middleware').middleware;
  beforeAll(async () => { ({ middleware } = await import('@/middleware')); });
  const offen = (r: Response) => r.headers.get('x-middleware-next') === '1';
  const lauf = (pfad: string, init: { method?: string; headers?: Record<string, string> } = {}) => middleware(new NextRequest(`http://localhost:3001${pfad}`, init as never));
  const POST = { origin: 'http://localhost:3001', host: 'localhost:3001' };
  it('offen, ohne Köpfe einer Person — der Download auch als Navigation aus einem Mail-Programm', async () => {
    expect(offen(await lauf('/api/bestellung?id=a'))).toBe(true);
    const r = await lauf('/api/bestellung', { method: 'POST', headers: { ...POST, 'x-make-user': 'kevin', 'x-make-person': 'kevin' } });
    expect(offen(r)).toBe(true);
    expect(r.headers.get('x-middleware-request-x-make-user')).toBeNull();
    expect(r.headers.get('x-middleware-request-x-make-person')).toBeNull();
    expect(offen(await lauf('/api/baustein/laden?t=x&b=a&d=pdf', { headers: { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' } }))).toBe(true);
  });
  it('alles andere bleibt zu (auch die Verwaltung)', async () => {
    for (const [p, m] of [['/api/baustein/laden', 'POST'], ['/api/baustein/x', 'GET'], ['/api/bestellungen', 'GET'], ['/api/bestellung/x', 'GET'], ['/api/bestellung', 'DELETE'], ['/api/bausteine/intern', 'GET'], ['/api/bausteine/intern', 'POST']] as const) {
      const r = await lauf(p, m === 'GET' ? {} : { method: m, headers: POST });
      expect(offen(r), `${m} ${p}`).toBe(false);
    }
  });
  it('Caddy leitet im Block makeinnovation.de genau /api/bestellung und /api/baustein/laden an die App; strenge Köpfe in next.config', () => {
    const caddy = readFileSync('deploy/caddy/Caddyfile', 'utf8');
    const block = caddy.slice(caddy.indexOf('\nmakeinnovation.de {'));
    expect(block).toMatch(/^\t@bausteine path \/api\/bestellung \/api\/baustein\/laden$/m);
    expect(block.indexOf('basic_auth')).toBeLessThan(block.indexOf('@bausteine'));
    const cfg = readFileSync('next.config.mjs', 'utf8');
    expect(cfg).toContain("{ source: '/api/bestellung', headers: buchung }");
    expect(cfg).toContain("{ source: '/api/baustein/:pfad*', headers: buchung }");
  });
});

describe('Konto löschen', () => {
  it('Bestellungen bleiben (Vertrag, Rechnung), wer freigab bzw. ablehnte wird „[gelöscht]“', async () => {
    const kd = await import('@/lib/datenschutz/konto-daten');
    const vorher = await bestellungen();
    expect(vorher.some(b => b.geliefert?.von === 'malin' || b.abgelehnt?.von === 'malin')).toBe(true);
    await kd.kontoLoeschen('malin');
    const nachher = await bestellungen();
    expect(nachher).toHaveLength(vorher.length);
    expect(JSON.stringify(nachher)).not.toContain('"malin"');
    expect(nachher.some(b => b.geliefert?.von === kd.GELOESCHT)).toBe(true);
  });
});
