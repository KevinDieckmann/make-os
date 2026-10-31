// ─── Unterlagen per E-Mail anfordern (31.10.): Katalog, Formular-Schnittstelle, Mail, CRM, Download-Link, Middleware, Caddy, Verzeichnis ─────
// Eigener Datenordner und eigener Unterlagen-Ordner (MAKE_OS_UNTERLAGEN_DIR), Datenschlüssel und Pepper gesetzt, Konten mit Test-Haushalt,
// Verantwortlicher der Einrichtung gemockt, Absender-Prüfung und Sendeweg (Inbox) als Fake — es geht nichts hinaus. Alle Namen und Adressen erfunden
// (@example.invalid). Prüft: ohne Website-Absender aus (aktiv false, POST 404), dieselbe Antwort für jede Adresse, Honigtopf, Größe, Grenze je Adresse
// (3 je Tag), Art. 18 → keine Mail und keine Anfrage, Werbesperre → keine Mail, Anfrage nur über den Anfrage-Weg, Token signiert (abgelaufen 410,
// gefälscht 404, nie die Adresse), Pfad-Angriffe im Katalog und über Verknüpfungen, Download-Köpfe, Newsletter-Häkchen mit Fassung.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import type { Kontakt } from '@/lib/make-one/crm';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-unterlage-'));
const unterlagen = path.join(ordner, 'unterlagen');
mkdirSync(unterlagen);
process.env.MAKE_OS_DATEN_DIR = path.join(ordner, 'daten');
process.env.MAKE_OS_UNTERLAGEN_DIR = unterlagen;
process.env.MAKE_OS_KEY = 'pruef-schluessel-unterlage';
process.env.SESSION_SECRET = 'pruef-sitzung-unterlage-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-unterlage-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-unterlage-nur-im-test-0123456789abcdef';
delete process.env.MAKE_OS_ADRESSE;

const ds = vi.hoisted(() => ({ wert: { verantwortlich: null as string | null, seite: null as string | null } }));
vi.mock('@/lib/datenschutz/einrichtung-server', async () => ({
  ...(await vi.importActual<typeof import('@/lib/datenschutz/einrichtung-server')>('@/lib/datenschutz/einrichtung-server')),
  datenschutzOeffentlichLaden: async () => ds.wert,
}));
const fake = vi.hoisted(() => ({ senden: { status: 200, body: { ok: true, von: 'versand@example.invalid' } as Record<string, unknown> }, gesendet: [] as { person: string; an: string; name?: string; betreff?: string; text: string; uwg: unknown }[] }));
vi.mock('@/lib/crm/angebot-versand', () => ({
  absenderPruefen: async (a?: { postfach: string }) => (!a ? { ok: false, grund: 'Absender-Postfach fehlt.' } : a.postfach === 'pf-probe' ? { ok: true, adresse: 'versand@example.invalid' } : { ok: false, grund: 'Dieses Postfach gibt es nicht.' }),
}));
vi.mock('@/lib/inbox/senden-server', () => ({
  inboxSenden: async (person: string, b: { neu?: { betreff?: string }; an?: { email: string; name?: string }[]; text?: string; uwgBestaetigt?: unknown }) => {
    fake.gesendet.push({ person, an: b.an?.[0]?.email ?? '', name: b.an?.[0]?.name, betreff: b.neu?.betreff, text: String(b.text ?? ''), uwg: b.uwgBestaetigt });
    return fake.senden;
  },
}));

type Antwort = { status: number; d: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
let db: typeof import('@/lib/store/local-db');
let drossel: typeof import('@/lib/zugang/drossel');
let W: typeof import('@/lib/oeffentlich/website-post');
let U: typeof import('@/lib/unterlagen/server');
let R: typeof import('@/lib/unterlagen/regeln');
let route: { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let laden: { GET: (r: Request) => Promise<Response> };
const D = 'example.invalid';
const PDF = Buffer.from('%PDF-1.4\n% Probe-Arbeitsheft\n%%EOF\n');
const XLSX = Buffer.from('PK\u0003\u0004 Probe-Tabelle');
const lesen = async (q: string): Promise<Antwort> => { const r = await route.GET(new Request(`http://test/api/unterlage${q}`)); return { status: r.status, d: await r.json() }; };
const post = async (body: Record<string, unknown>): Promise<Antwort> => { const r = await route.POST(new Request('http://test/api/unterlage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() }; };
const holen = (q: string) => laden.GET(new Request(`http://test/api/unterlage/laden${q}`));
const anfordern = (email: string, x: Record<string, unknown> = {}) => post({ id: 'vertriebsteam-aufbauen', vorname: 'Testa', email, firma: 'Probe GmbH', webseite: '', ...x });
const kontakte = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Vera', nachname: `Muster ${id.slice(2)}`, eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie', ...x } as Kontakt);
const linksAus = (text: string) => Array.from(text.matchAll(/https:\/\/\S+\/api\/unterlage\/laden\?t=([^&\s]+)&d=(pdf|xlsx)/g)).map(m => ({ t: decodeURIComponent(m[1]), d: m[2] }));

const T0 = new Date('2026-11-12T08:00:00Z');
let uhr = T0.getTime();
const weiter = (sek: number) => { uhr += sek * 1000; vi.setSystemTime(new Date(uhr)); };

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  writeFileSync(path.join(unterlagen, 'vertriebsteam-aufbauen.pdf'), PDF);
  writeFileSync(path.join(unterlagen, 'vertriebsteam-aufbauen.xlsx'), XLSX);
  writeFileSync(path.join(ordner, 'geheim.pdf'), Buffer.from('%PDF-1.4 geheim'));
  symlinkSync(path.join(ordner, 'geheim.pdf'), path.join(unterlagen, 'verknuepft.pdf'));
  writeFileSync(path.join(unterlagen, 'katalog.json'), JSON.stringify({ unterlagen: [
    { id: 'vertriebsteam-aufbauen', titel: 'Arbeitsheft: Probe-Vertriebsteam', seite: '/kostenlos/vorlagen/vertriebsteam-aufbauen/', dateien: [
      { art: 'pdf', datei: 'vertriebsteam-aufbauen.pdf', name: 'Arbeitsheft Vertriebsteam Übung.pdf' },
      { art: 'xlsx', datei: 'vertriebsteam-aufbauen.xlsx', name: 'Tabelle Vertriebsteam.xlsx' },
    ] },
    { id: 'pfad-angriff', titel: 'Angriff', seite: '/x/', dateien: [{ art: 'pdf', datei: '../geheim.pdf', name: 'x.pdf' }] },
    { id: 'verknuepft', titel: 'Verknüpft', seite: '/v/', dateien: [{ art: 'pdf', datei: 'verknuepft.pdf', name: 'v.pdf' }] },
  ] }));
  db = await import('@/lib/store/local-db');
  drossel = await import('@/lib/zugang/drossel');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: `k@${D}`, name: 'Testo Inhaber', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
  ], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [
    k('c-sperre', { email: `sperre@${D}`, werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } }),
    k('c-eng', { email: `eng@${D}`, eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'kevin' } }),
  ] });
  W = await import('@/lib/oeffentlich/website-post');
  U = await import('@/lib/unterlagen/server');
  R = await import('@/lib/unterlagen/regeln');
  route = await import('@/app/api/unterlage/route');
  laden = await import('@/app/api/unterlage/laden/route');
});
afterEach(() => { drossel._zuruecksetzen(); });
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

describe('Katalog (rein)', () => {
  it('nur sichere Dateinamen, Endung = Art, je Art eine Datei, Kennung eindeutig', () => {
    const { unterlagen: u, fehler } = R.katalogPruefen({ unterlagen: [
      { id: 'a', titel: 'A', seite: '/a/', dateien: [{ art: 'pdf', datei: 'a.pdf', name: 'A.pdf' }] },
      { id: 'a', titel: 'Doppelt', seite: '/a/', dateien: [{ art: 'pdf', datei: 'a.pdf' }] },
      ...['../a.pdf', '/etc/passwd.pdf', 'sub/a.pdf', 'a.xlsx', 'a..pdf', '.versteckt.pdf', 'a b.pdf'].map((datei, i) => ({ id: `b${i}`, titel: 'B', seite: '/b/', dateien: [{ art: 'pdf', datei }] })),
      { id: 'c', titel: 'C', seite: '//fremd.example.invalid/', dateien: [{ art: 'pdf', datei: 'c.pdf' }] },
      { id: 'd', titel: 'D', seite: '/d/', dateien: [{ art: 'doc', datei: 'd.doc' }] },
      { id: 'e', titel: 'E', seite: '/e/', dateien: [{ art: 'pdf', datei: 'e.pdf' }, { art: 'pdf', datei: 'f.pdf' }] },
      { id: 'GROSS', titel: 'G', seite: '/g/', dateien: [{ art: 'pdf', datei: 'g.pdf' }] },
    ] });
    expect(u.map(x => x.id)).toEqual(['a']);
    expect(fehler).toHaveLength(12);
    expect(u[0].dateien[0]).toEqual({ art: 'pdf', datei: 'a.pdf', name: 'A.pdf' });
    expect(R.katalogPruefen(null)).toEqual({ unterlagen: [], fehler: [] });
  });
  it('Download-Name ohne Steuerzeichen und Pfade, Kopf mit Umlauten (RFC 5987)', () => {
    expect(R.downloadName('Heft "A"/\\b\n.pdf', 'pdf', 'x.pdf')).toBe('Heft Ab.pdf');
    expect(R.downloadName('', 'xlsx', 'datei.xlsx')).toBe('datei.xlsx');
    expect(R.downloadName('Tabelle', 'xlsx', 'x')).toBe('Tabelle.xlsx');
    expect(R.anhangKopf('Übung ß.pdf')).toBe(`attachment; filename="Uebung ss.pdf"; filename*=UTF-8''${encodeURIComponent('Übung ß.pdf')}`);
  });
});

describe('ohne Website-Absender aus', () => {
  it('GET: aktiv false (Titel bleibt), POST 404; unbekannt 404', async () => {
    const g = await lesen('?id=vertriebsteam-aufbauen');
    expect(g.status).toBe(200);
    expect(g.d).toMatchObject({ ok: true, aktiv: false, titel: 'Arbeitsheft: Probe-Vertriebsteam', newsletter: null });
    expect((await anfordern(`a@${D}`)).status).toBe(404);
    expect((await lesen('?id=gibt-es-nicht')).status).toBe(404);
    expect((await lesen('?id=../x')).status).toBe(404);
    expect((await lesen('')).status).toBe(404);
    await W._nachlauf();
    expect(fake.gesendet).toHaveLength(0);
  });
  it('mit Absender, aber ohne Verantwortlichen: weiter aus', async () => {
    await db.saveJson('newsletter-einstellungen', { aktiv: false, fassung: 1, absender: { person: 'kevin', postfach: 'pf-probe', gesetztAm: T0.toISOString() }, website: `https://www.${D}`, marke: 'Probe Marke' });
    expect((await lesen('?id=vertriebsteam-aufbauen')).d.aktiv).toBe(false);
    const p = await W.websiteLagePruefen();
    expect(p.lage).toBeNull();
    expect(p.gruende.join(' ')).toMatch(/Verantwortlicher fehlt/);
  });
});

describe('anfordern', () => {
  beforeAll(() => { ds.wert = { verantwortlich: `Probe GmbH, datenschutz@${D}`, seite: `${D}/datenschutz` }; });
  it('GET: aktiv, Titel, Datenschutzhinweis aus der Instanz, kein Newsletter, solange er aus ist', async () => {
    const g = await lesen('?id=vertriebsteam-aufbauen');
    expect(g.d).toMatchObject({ ok: true, aktiv: true, titel: 'Arbeitsheft: Probe-Vertriebsteam', newsletter: null });
    expect(g.d.hinweis.zeilen[0]).toBe(`Verantwortlich: Probe GmbH, datenschutz@${D}.`);
    expect(g.d.hinweis.link).toBe(`https://${D}/datenschutz`);
    // Die Pfad-Angriffe sind gar nicht erst im Katalog.
    expect((await lesen('?id=pfad-angriff')).status).toBe(404);
  });
  it('Eingaben: Honigtopf, Adresse, Vorname (nur Buchstaben), Firma, Größe', async () => {
    const falle = await anfordern(`a@${D}`, { webseite: 'x' });
    expect(falle.status).toBe(400);
    expect(falle.d.fehler).toMatch(/nicht geklappt/);
    expect((await anfordern('kein-mail')).status).toBe(400);
    expect((await anfordern(`a@${D}`, { vorname: '' })).status).toBe(400);
    expect((await anfordern(`a@${D}`, { vorname: 'https://fremd.example.invalid' })).status).toBe(400);
    expect((await anfordern(`a@${D}`, { vorname: 'www.fremd.example.invalid' })).status).toBe(400);
    expect((await anfordern(`a@${D}`, { firma: 'x'.repeat(121) })).status).toBe(413);
    drossel._zuruecksetzen(); // Drossel je Netz: hier geht es um die Eingaben
    expect((await anfordern(`a@${D}`, { firma: 'mit <b>' })).status).toBe(400);
    expect((await post({ id: 'vertriebsteam-aufbauen', vorname: 'Testa', email: `a@${D}`, rest: 'x'.repeat(9000) })).status).toBe(413);
    expect((await anfordern(`a@${D}`, { id: 'gibt-es-nicht' })).status).toBe(404);
    await W._nachlauf();
    expect(fake.gesendet).toHaveLength(0);
  });
  it('angenommen: dieselbe Antwort, danach die Mail mit zwei Links und die Anfrage im CRM', async () => {
    const r = await anfordern(`Neu.Person@${D.toUpperCase()}`);
    expect(r.status).toBe(200);
    expect(r.d).toEqual({ ok: true, text: R.ANFORDERUNG_TEXT });
    await W._nachlauf();
    expect(fake.gesendet).toHaveLength(1);
    const m = fake.gesendet[0];
    expect(m).toMatchObject({ person: 'kevin', an: `neu.person@${D}`, name: 'Testa', uwg: true, betreff: 'Ihre Unterlage: Arbeitsheft: Probe-Vertriebsteam — Probe Marke' });
    expect(m.text).toMatch(/^Guten Tag Testa,/);
    expect(m.text).toContain('Die Links gelten 7 Tage');
    expect(m.text).toContain(`https://www.${D}/kostenlos/vorlagen/vertriebsteam-aufbauen/`);
    expect(m.text).toContain(`Verantwortlich: Probe GmbH, datenschutz@${D}`);
    const links = linksAus(m.text);
    expect(links.map(l => l.d)).toEqual(['pdf', 'xlsx']);
    expect(m.text).toContain(`https://www.${D}/api/unterlage/laden?t=`);
    // Das Token trägt nie die Adresse.
    expect(links[0].t).not.toMatch(/neu|person|example/i);
    const p = (await kontakte()).find(x => x.email === `neu.person@${D}`)!;
    expect(p).toBeTruthy();
    expect(p.aktivitaeten.some(a => /Vorlage „Arbeitsheft: Probe-Vertriebsteam“ über die Website angefordert — Download-Links per E-Mail geschickt/.test(a.text ?? ''))).toBe(true);
  });
  it('Art. 18: keine Mail, keine Anfrage — Werbesperre: keine Mail, Anfrage mit Vermerk; die Antwort ist für alle dieselbe', async () => {
    const vorher = fake.gesendet.length;
    const eng = await anfordern(`eng@${D}`);
    const sperre = await anfordern(`sperre@${D}`);
    const frei = await anfordern(`frei@${D}`);
    expect(eng).toEqual(frei);
    expect(sperre).toEqual(frei);
    await W._nachlauf();
    expect(fake.gesendet.slice(vorher).map(x => x.an)).toEqual([`frei@${D}`]);
    const ks = await kontakte();
    expect(ks.find(x => x.id === 'c-eng')!.aktivitaeten).toHaveLength(0);
    expect(ks.find(x => x.id === 'c-sperre')!.aktivitaeten.some(a => /nicht verschickt \(Werbesperre/.test(a.text ?? ''))).toBe(true);
  });
  it('Grenze je Adresse: höchstens 3 Mails am Tag, danach dieselbe Antwort ohne Mail und ohne Anfrage; am nächsten Tag wieder', async () => {
    const adr = `grenze@${D}`;
    const vorher = fake.gesendet.length;
    for (let i = 0; i < 4; i++) { expect((await anfordern(adr)).d.ok).toBe(true); await W._nachlauf(); drossel._zuruecksetzen(); }
    expect(fake.gesendet.slice(vorher).filter(x => x.an === adr)).toHaveLength(3);
    expect((await kontakte()).find(x => x.email === adr)!.aktivitaeten.filter(a => /Vorlage/.test(a.text ?? ''))).toHaveLength(3);
    weiter(24 * 3600);
    await anfordern(adr); await W._nachlauf();
    expect(fake.gesendet.filter(x => x.an === adr)).toHaveLength(4);
  });
  it('Drossel je Netz: nach 7 Anforderungen in der Viertelstunde 429', async () => {
    for (let i = 0; i < 7; i++) expect((await anfordern(`netz${i}@${D}`)).status).toBe(200);
    const r = await anfordern(`netz9@${D}`);
    expect(r.status).toBe(429);
    await W._nachlauf();
  });
  it('Versand scheitert: Anfrage mit Vermerk „von Hand schicken“, nach außen dieselbe Antwort', async () => {
    fake.senden = { status: 502, body: { fehler: 'Postfach nicht erreichbar' } };
    try {
      expect((await anfordern(`fehler@${D}`)).d).toEqual({ ok: true, text: R.ANFORDERUNG_TEXT });
      await W._nachlauf();
      expect((await kontakte()).find(x => x.email === `fehler@${D}`)!.aktivitaeten.some(a => /von Hand schicken/.test(a.text ?? ''))).toBe(true);
    } finally { fake.senden = { status: 200, body: { ok: true, von: 'versand@example.invalid' } }; }
  });
  it('Newsletter-Häkchen: nur mit der Fassung der Seite (sonst 409), dann dieselbe Anmeldung mit Bestätigungsmail', async () => {
    await db.saveJson('newsletter-einstellungen', { aktiv: true, fassung: 1, absender: { person: 'kevin', postfach: 'pf-probe', gesetztAm: T0.toISOString() }, website: `https://www.${D}`, marke: 'Probe Marke' });
    const g = await lesen('?id=vertriebsteam-aufbauen');
    expect(g.d.newsletter).toMatchObject({ fassung: 'newsletter-einwilligung-1' });
    expect(g.d.newsletter.wortlaut).toContain('Newsletter von Probe Marke');
    expect((await anfordern(`nl@${D}`, { newsletter: true, newsletterFassung: 'newsletter-einwilligung-9' })).status).toBe(409);
    const vorher = fake.gesendet.length;
    expect((await anfordern(`nl@${D}`, { newsletter: true, newsletterFassung: 'newsletter-einwilligung-1' })).status).toBe(200);
    await W._nachlauf();
    const neu = fake.gesendet.slice(vorher).filter(x => x.an === `nl@${D}`);
    expect(neu.map(x => x.betreff?.split(' — ')[0])).toEqual(['Ihre Unterlage: Arbeitsheft: Probe-Vertriebsteam', 'Bitte bestätigen Sie Ihre Anmeldung']);
  });
});

describe('Download-Link', () => {
  it('gültig: die Datei als Anhang mit strengen Köpfen — PDF und Excel', async () => {
    const t = U.linkToken('vertriebsteam-aufbauen');
    const r = await holen(`?t=${encodeURIComponent(t)}&d=pdf`);
    expect(r.status).toBe(200);
    expect(Buffer.from(await r.arrayBuffer()).equals(PDF)).toBe(true);
    expect(r.headers.get('content-type')).toBe('application/pdf');
    expect(r.headers.get('content-disposition')).toBe(R.anhangKopf('Arbeitsheft Vertriebsteam Übung.pdf'));
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('x-robots-tag')).toMatch(/noindex/);
    expect(r.headers.get('content-security-policy')).toMatch(/sandbox/);
    const x = await holen(`?t=${encodeURIComponent(t)}&d=xlsx`);
    expect(x.status).toBe(200);
    expect(x.headers.get('content-type')).toBe(R.INHALTSTYP.xlsx);
    expect((await holen(`?t=${encodeURIComponent(t)}&d=doc`)).status).toBe(404);
  });
  it('nach 7 Tagen abgelaufen (410) — mit dem Weg zur Seite; gefälscht und kaputt 404', async () => {
    const t = U.linkToken('vertriebsteam-aufbauen', new Date(uhr));
    weiter(7 * 86_400 + 60);
    const alt = await holen(`?t=${encodeURIComponent(t)}&d=pdf`);
    expect(alt.status).toBe(410);
    const html = await alt.text();
    expect(html).toContain('Der Link ist abgelaufen');
    expect(html).toContain('href="/kostenlos/vorlagen/vertriebsteam-aufbauen/"');
    expect(alt.headers.get('content-type')).toMatch(/text\/html/);
    const echt = U.linkToken('vertriebsteam-aufbauen', new Date(uhr));
    const gefaelscht = `${echt.slice(0, -4)}AAAA`;
    expect((await holen(`?t=${encodeURIComponent(gefaelscht)}&d=pdf`)).status).toBe(404);
    // Eine andere Kennung mit der Signatur einer echten: passt nicht.
    const fremd = echt.replace('u1.vertriebsteam-aufbauen.', 'u1.verknuepft.');
    expect((await holen(`?t=${encodeURIComponent(fremd)}&d=pdf`)).status).toBe(404);
    for (const q of ['', '?t=x&d=pdf', `?t=${'a'.repeat(200)}&d=pdf`]) expect((await holen(q)).status).toBe(404);
    expect(U.tokenPruefen(echt)).toEqual({ ok: true, id: 'vertriebsteam-aufbauen' });
  });
  it('Pfad-Angriff: eine Verknüpfung aus dem Ordner heraus liefert nichts; eine Kennung außerhalb des Katalogs auch nicht', async () => {
    expect((await holen(`?t=${encodeURIComponent(U.linkToken('verknuepft'))}&d=pdf`)).status).toBe(404);
    expect((await holen(`?t=${encodeURIComponent(U.linkToken('pfad-angriff'))}&d=pdf`)).status).toBe(404);
    expect((await holen(`?t=${encodeURIComponent(U.linkToken('gibt-es-nicht'))}&d=pdf`)).status).toBe(404);
  });
  it('kaputter Katalog → 503 statt still „gibt es nicht“', async () => {
    const pfad = path.join(unterlagen, 'katalog.json');
    const gut = readFileSync(pfad, 'utf8');
    writeFileSync(pfad, '{ kaputt');
    try { expect((await lesen('?id=vertriebsteam-aufbauen')).status).toBe(503); }
    finally { writeFileSync(pfad, gut); }
  });
});

describe('Middleware: nur GET/POST /api/unterlage und GET /api/unterlage/laden sind offen', () => {
  let middleware: typeof import('@/middleware').middleware;
  beforeAll(async () => { ({ middleware } = await import('@/middleware')); });
  const offen = (r: Response) => r.headers.get('x-middleware-next') === '1';
  const lauf = (pfad: string, init: { method?: string; headers?: Record<string, string> } = {}) => middleware(new NextRequest(`http://localhost:3001${pfad}`, init as never));
  const POST = { origin: 'http://localhost:3001', host: 'localhost:3001' };
  it('offen, ohne Köpfe einer Person — der Download auch als Navigation aus einem Mail-Programm', async () => {
    expect(offen(await lauf('/api/unterlage?id=a'))).toBe(true);
    const r = await lauf('/api/unterlage', { method: 'POST', headers: { ...POST, 'x-make-user': 'kevin' } });
    expect(offen(r)).toBe(true);
    expect(r.headers.get('x-middleware-request-x-make-user')).toBeNull();
    expect(offen(await lauf('/api/unterlage/laden?t=x&d=pdf', { headers: { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' } }))).toBe(true);
  });
  it('alles andere bleibt zu', async () => {
    for (const [p, m] of [['/api/unterlage/laden', 'POST'], ['/api/unterlage/x', 'GET'], ['/api/unterlagen', 'GET'], ['/api/unterlage/laden/x', 'GET'], ['/api/unterlage', 'DELETE']] as const) {
      const r = await lauf(p, m === 'GET' ? {} : { method: m, headers: POST });
      expect(offen(r), `${m} ${p}`).toBe(false);
    }
  });
  it('Caddy leitet im Block fokusinnovation.de genau /api/unterlage und /api/unterlage/* an die App; strenge Köpfe in next.config', () => {
    const caddy = readFileSync('deploy/caddy/Caddyfile', 'utf8');
    const block = caddy.slice(caddy.indexOf('\nfokusinnovation.de {'));
    expect(/@app path [^\n]*\/api\/unterlage \/api\/unterlage\/\*/.test(block)).toBe(true);
    const cfg = readFileSync('next.config.mjs', 'utf8');
    expect(cfg).toContain("{ source: '/api/unterlage', headers: buchung }");
    expect(cfg).toContain("{ source: '/api/unterlage/:pfad*', headers: buchung }");
  });
});

describe('Verzeichnis (Art. 30)', () => {
  it('Unterlagen erst, wenn eingerichtet; der Check nennt den Bericht per E-Mail — eine unveränderte alte Fassung wird gehoben', async () => {
    const { verzeichnisVervollstaendigen, verarbeitungCheck, VV_UNTERLAGEN_ID, VV_CHECK_ID } = await import('@/lib/crm/datenschutz');
    const jetzt = new Date(uhr).toISOString();
    expect(verzeichnisVervollstaendigen([], jetzt).liste.some(v => v.id === VV_UNTERLAGEN_ID)).toBe(false);
    expect(verzeichnisVervollstaendigen([], jetzt, { unterlagen: true }).liste.some(v => v.id === VV_UNTERLAGEN_ID)).toBe(true);
    const neu = verarbeitungCheck(jetzt);
    expect(neu.zweck).toMatch(/Bericht per E-Mail/);
    const alt = { ...neu, zweck: 'Kostenlose Standortbestimmung für Unternehmen: Antworten per Klick auswerten (Stufe, Dimensionen, Branchenvergleich), auf Wunsch Bericht und kostenloses Gespräch, Anfrage im Kundensystem (Follow-up), Kennzahlen des Checks', empfaengerIds: ['hetzner'], drittland: 'keine' };
    const basis = verzeichnisVervollstaendigen([], jetzt).liste;
    const gehoben = verzeichnisVervollstaendigen([...basis, alt], jetzt, { check: true }).liste.find(v => v.id === VV_CHECK_ID)!;
    expect(gehoben.zweck).toBe(neu.zweck);
    expect(gehoben.empfaengerIds).toEqual(neu.empfaengerIds);
    const vonHand = verzeichnisVervollstaendigen([...basis, { ...alt, zweck: 'von Hand' }], jetzt, { check: true }).liste.find(v => v.id === VV_CHECK_ID)!;
    expect(vonHand.zweck).toBe('von Hand');
    expect(await U.unterlagenEingerichtet()).toBe(true);
  });
});
