// ─── Markttraktion › Website (31.10.): Regeln, öffentliche Schnittstelle, Pflege, Bausteine-Überlagerung, /erstgespraech, Middleware, Register ──────
// Eigener Datenordner und Unterlagen-Ordner (Probe-Katalog), Datenschlüssel gesetzt, Konten eines Test-Haushalts. Erfundene Daten, kein Netz, keine Mail.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-website-'));
const unterlagen = path.join(ordner, 'unterlagen');
mkdirSync(path.join(unterlagen, 'bausteine'), { recursive: true });
process.env.MAKE_OS_DATEN_DIR = path.join(ordner, 'daten');
process.env.MAKE_OS_UNTERLAGEN_DIR = unterlagen;
process.env.MAKE_OS_KEY = 'pruef-schluessel-website-bereich';
process.env.SESSION_SECRET = 'pruef-sitzung-website-bereich-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-website-bereich';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-website-bereich-0123456789abcdef';

import * as R from '@/lib/website/regeln';

const KATALOG = { bausteine: [
  { id: 'probe-eins', titel: 'Probe eins', bereich: 'vertrieb', preis: 9900, seite: '/bausteine/probe-eins/', dateien: [{ art: 'pdf', datei: 'probe-eins.pdf', name: 'Probe eins' }] },
  { id: 'probe-zwei', titel: 'Probe zwei', bereich: 'innovation', preis: 4900, seite: '/bausteine/probe-zwei/', dateien: [{ art: 'pdf', datei: 'probe-zwei.pdf', name: 'Probe zwei' }] },
] };
writeFileSync(path.join(unterlagen, 'bausteine', 'katalog.json'), JSON.stringify(KATALOG));

type Route = { GET?: (r: Request, c?: unknown) => Promise<Response>; PATCH?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let db: typeof import('@/lib/store/local-db');
let drossel: typeof import('@/lib/zugang/drossel');
let intern: Route, inhalt: Route, erst: Route;
const HAUS = 'test-haus';
const D = 'example.invalid';
const kopf = (wer = 'kevin') => ({ 'content-type': 'application/json', 'x-make-user': wer });
const patch = (ops: unknown, k: Record<string, string> = kopf()) => intern.PATCH!(new Request('http://test/api/website/intern', { method: 'PATCH', headers: k, body: JSON.stringify({ ops }) }));
const lesen = async () => (await (await intern.GET!(new Request('http://test/api/website/intern', { headers: kopf() }))).json());
const oeffentlich = (k: Record<string, string> = {}) => inhalt.GET!(new Request('http://test/api/website/inhalt', { headers: k }));
const ANGEBOT = { bereich: 'vertrieb', titel: 'Probe-Workshop', kurz: 'Ein erfundener Tag.', preisText: 'ab 1.000 €', preisNetto: 100000, ab: true, produktId: 'l-probe', sichtbar: true, rang: 1 };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  drossel = await import('@/lib/zugang/drossel');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: `k@${D}`, name: 'Inhaber Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    { id: 'k2', speicher: 'malin', email: `m@${D}`, name: 'Mitglied Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    // 02.11. (Prüfung D, Kevin: „voller Zugriff“): ein volles Mitglied steuert wie ein Inhaber — die Sperre gilt einem Konto „nur Business“.
    { id: 'k4', speicher: 'nurbusiness', email: `nb@${D}`, name: 'Team Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS, finanzRecht: 'business' },
    { id: 'k3', speicher: 'fremd', email: `f@${D}`, name: 'Fremd Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'anderer' },
  ], einladungen: [] });
  intern = await import('@/app/api/website/intern/route') as Route;
  inhalt = await import('@/app/api/website/inhalt/route') as Route;
  erst = await import('@/app/erstgespraech/route') as Route;
});
afterEach(() => drossel._zuruecksetzen());
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('Regeln (rein)', () => {
  it('Formate der Website beim Speichern: Preistext ≤ 60 ohne < >, Bausteinpreis > 0, Links nur https oder /…, Texte ≤ 2000', () => {
    expect(R.eintragSaeubern('angebote', 'probe', { ...ANGEBOT, preisText: '' })).not.toHaveProperty('preisText');
    expect(() => R.eintragSaeubern('angebote', 'probe', { ...ANGEBOT, preisText: 'x'.repeat(61) })).toThrow(R.WebFehler);
    expect(() => R.eintragSaeubern('angebote', 'probe', { ...ANGEBOT, preisText: '<b>1</b>' })).toThrow(/ohne </);
    expect(() => R.eintragSaeubern('angebote', 'probe', { ...ANGEBOT, seite: 'http://x.example' })).toThrow(/Pfad der Website/);
    expect(() => R.eintragSaeubern('bausteine', 'probe-eins', { preisNetto: 0 })).toThrow(/größer 0/);
    expect(() => R.eintragSaeubern('bausteine', 'probe-eins', { preisNetto: 12.5 })).toThrow(/ganzen Cent/);
    expect(() => R.eintragSaeubern('events', 'we-abcd', { eventId: 'ev-1', sichtbar: true, anmeldeLink: 'javascript:alert(1)' })).toThrow();
    expect(R.eintragSaeubern('events', 'we-abcd', { eventId: 'ev-1', sichtbar: true, anmeldeLink: '/events/anmelden' })).toMatchObject({ anmeldeLink: '/events/anmelden' });
    expect(() => R.eintragSaeubern('texte', 'events.einleitung', { text: 'x'.repeat(2001) })).toThrow(R.WebFehler);
    expect(() => R.eintragSaeubern('bilder', 'wb-abcd', { medium: `md-${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}`, sichtbar: true, alt: '' })).toThrow(/Alt-Text/);
    expect(R.eintragSaeubern('angebote', 'probe', { ...ANGEBOT, monatlich: true, bald: true, seite: '/vertrieb/probe/' })).toMatchObject({ monatlich: true, bald: true, seite: '/vertrieb/probe/' });
  });
  it('Stand je Eintrag: bestehender Eintrag ohne Stand → Konflikt, mit Stand → gespeichert', () => {
    const a = R.opsAnwenden(R.leererInhalt(), [{ liste: 'angebote', art: 'setze', id: 'probe', eintrag: ANGEBOT }], { person: 'kevin', jetzt: 'x' });
    expect(a.konflikte).toEqual([]);
    const b = R.opsAnwenden(a.inhalt, [{ liste: 'angebote', art: 'setze', id: 'probe', eintrag: { ...ANGEBOT, titel: 'Neu' } }], { person: 'kevin', jetzt: 'x' });
    expect(b.konflikte).toHaveLength(1);
    expect(b.inhalt).toBe(a.inhalt);
    const c = R.opsAnwenden(a.inhalt, [{ liste: 'angebote', art: 'setze', id: 'probe', stand: R.fingerabdruck(a.inhalt.angebote[0]), eintrag: { ...ANGEBOT, titel: 'Neu' } }], { person: 'kevin', jetzt: 'x' });
    expect(c.inhalt.angebote[0].titel).toBe('Neu');
  });
  it('Abgleich mit dem Produktkatalog', () => {
    const p = [{ id: 'l-probe', name: 'Probe', preisNetto: 100000, status: 'aktiv' }];
    expect(R.preisAbgleich({ produktId: 'l-probe', preisNetto: 100000 }, p)).toEqual({ art: 'gleich' });
    expect(R.preisAbgleich({ produktId: 'l-probe', preisNetto: 90000 }, p)).toEqual({ art: 'abweichung', website: 90000, katalog: 100000 });
    expect(R.preisAbgleich({ produktId: 'l-weg' }, p)).toEqual({ art: 'produkt-fehlt' });
    expect(R.preisAbgleich({}, p)).toEqual({ art: 'ohne' });
  });
  it('Bausteine-Überlagerung: ohne Eintrag dieselben Objekte (bit-gleich), mit Eintrag Titel/Preis/Kurztext/ausgeblendet', () => {
    const k = KATALOG.bausteine as unknown as Parameters<typeof R.bausteineUeberlagern>[0];
    expect(R.bausteineUeberlagern(k, [])).toBe(k);
    const u = R.bausteineUeberlagern(k, [{ id: 'probe-eins', preisNetto: 12000, kurz: 'Kurz', sichtbar: false }]);
    expect(u[1]).toBe(k[1]);
    expect(u[0]).toMatchObject({ preis: 12000, kurz: 'Kurz', ausgeblendet: true, titel: 'Probe eins' });
  });
  it('/erstgespraech: gewählte Seite → einzige „erstgespraech-…“ → sonst keine', () => {
    const s1 = `erstgespraech-${'a'.repeat(24)}`, s2 = `beratung-${'b'.repeat(24)}`, s3 = `erstgespraech-x-${'c'.repeat(24)}`;
    expect(R.erstgespraechZiel({ gewaehlt: s2, aktiveSeiten: [s1, s2] })).toEqual({ art: 'buchung', pfad: `/buchen/${s2}` });
    expect(R.erstgespraechZiel({ aktiveSeiten: [s1, s2] })).toEqual({ art: 'buchung', pfad: `/buchen/${s1}` });
    expect(R.erstgespraechZiel({ aktiveSeiten: [s1, s3] })).toEqual({ art: 'keins' });
    expect(R.erstgespraechZiel({ gewaehlt: s2, aktiveSeiten: [] })).toEqual({ art: 'keins' });
  });
  it('öffentliche Form: nur Sichtbares, keine internen Kennungen, Events nur eigene, kommende, im Format der Website', () => {
    let i = R.opsAnwenden(R.leererInhalt(), [
      { liste: 'angebote', art: 'setze', id: 'probe', eintrag: ANGEBOT },
      { liste: 'angebote', art: 'setze', id: 'versteckt', eintrag: { ...ANGEBOT, sichtbar: false } },
      { liste: 'events', art: 'setze', id: 'we-eins', eintrag: { eventId: 'ev-eigen', sichtbar: true, anmeldeLink: 'https://anmelden.example.invalid/x' } },
      { liste: 'events', art: 'setze', id: 'we-zwei', eintrag: { eventId: 'ev-besuch', sichtbar: true } },
      { liste: 'events', art: 'setze', id: 'we-drei', eintrag: { eventId: 'ev-alt', sichtbar: true } },
      { liste: 'faq', art: 'setze', id: 'wq-eins', eintrag: { frage: 'Frage?', antwort: 'Antwort.', gruppe: 'Gruppe', sichtbar: true } },
      { liste: 'fakten', art: 'setze', id: 'wf-eins', eintrag: { titel: 'Sitz', text: 'Musterstadt', sichtbar: true } },
      { liste: 'texte', art: 'setze', id: 'events.einleitung', eintrag: { text: 'Einleitung.' } },
    ], { person: 'kevin', jetzt: 'x' }).inhalt;
    i = { ...i };
    const o = R.oeffentlicherInhalt(i, {
      katalog: [], heute: '2026-11-01', bildOk: () => true,
      events: [
        { id: 'ev-eigen', titel: 'Eigener Abend', datum: '2026-11-20', uhrzeit: '18:30', ort: 'Musterstadt', format: 'dinner', status: 'einladung', besucht: false },
        { id: 'ev-besuch', titel: 'Besuchte Messe', datum: '2026-11-21', status: 'geplant', besucht: true },
        { id: 'ev-alt', titel: 'Alter Abend', datum: '2026-10-01', status: 'geplant', besucht: false },
      ],
    });
    expect(o.angebote.map(a => a.id)).toEqual(['probe']);
    expect(o.events).toEqual([{ id: 'we-eins', titel: 'Eigener Abend', datum: '2026-11-20T18:30', ort: 'Musterstadt', format: 'Dinner', anmeldung: 'https://anmelden.example.invalid/x' }]);
    expect(o.faq).toEqual([{ id: 'wq-eins', frage: 'Frage?', antwort: 'Antwort.', gruppe: 'Gruppe' }]);
    expect(o.fakten).toEqual([{ titel: 'Sitz', text: 'Musterstadt' }]);
    expect(o.texte).toEqual({ 'events.einleitung': 'Einleitung.' });
    const text = JSON.stringify(o);
    for (const intern of ['produktId', 'l-probe', 'ev-eigen', 'eventId', 'medium', 'sichtbar', 'geaendertVon', 'kevin']) expect(text, intern).not.toContain(intern);
  });
  it('Startwerte der Website: nur fehlende Einträge, ein zweiter Lauf findet nichts mehr', () => {
    const start = JSON.parse(readFileSync(path.join(process.cwd(), 'website', 'startwerte-inhalt.json'), 'utf8'));
    const r1 = R.startwerteOps(R.leererInhalt(), start, []);
    expect(r1.fehler).toEqual([]);
    expect(r1.zaehler.angebote).toBe(start.angebote.length);
    expect(r1.zaehler.faq).toBe(start.faq.length);
    expect(r1.zaehler.fakten).toBe(start.fakten.length);
    const nach = R.opsAnwenden(R.leererInhalt(), r1.ops, { person: 'kevin', jetzt: 'x' });
    expect(nach.konflikte).toEqual([]);
    const r2 = R.startwerteOps(nach.inhalt, start, []);
    expect(r2.ops).toEqual([]);
  });
});

describe('Routen', () => {
  it('schreiben: Dienstweg 403, fremder Haushalt 403, ohne Stand 409, mit Stand gespeichert', async () => {
    expect((await patch([{ liste: 'angebote', art: 'setze', id: 'probe', eintrag: ANGEBOT }], { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' })).status).toBe(403);
    expect((await patch([{ liste: 'angebote', art: 'setze', id: 'probe', eintrag: ANGEBOT }], kopf('fremd'))).status).toBe(403);
    expect((await patch([{ liste: 'angebote', art: 'setze', id: 'probe', eintrag: { ...ANGEBOT, preisText: 'x'.repeat(61) } }])).status).toBe(413);
    const r = await patch([
      { liste: 'angebote', art: 'setze', id: 'probe', eintrag: ANGEBOT },
      { liste: 'angebote', art: 'setze', id: 'versteckt', eintrag: { ...ANGEBOT, sichtbar: false } },
      { liste: 'bausteine', art: 'setze', id: 'probe-zwei', eintrag: { preisNetto: 5900, sichtbar: false } },
    ], kopf('malin'));
    expect(r.status).toBe(200);
    const konflikt = await patch([{ liste: 'angebote', art: 'setze', id: 'probe', eintrag: { ...ANGEBOT, titel: 'Anders' } }]);
    expect(konflikt.status).toBe(409);
    const d = await lesen();
    const a = d.inhalt.angebote.find((x: { id: string }) => x.id === 'probe');
    expect((await patch([{ liste: 'angebote', art: 'setze', id: 'probe', stand: a.stand, eintrag: { ...ANGEBOT, titel: 'Anders' } }])).status).toBe(200);
    expect((await intern.GET!(new Request('http://test/api/website/intern', { headers: kopf('fremd') }))).status).toBe(403);
  });
  it('öffentlich: nur Sichtbares, ausgeblendete Bausteine fehlen, ETag + 304, zwischenspeicherbar', async () => {
    const r = await oeffentlich();
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('public, max-age=300');
    expect(r.headers.get('x-robots-tag')).toBe('noindex');
    const j = await r.json();
    expect(j.angebote.map((a: { id: string }) => a.id)).toEqual(['probe']);
    expect(j.bausteine.map((b: { id: string }) => b.id)).toEqual(['probe-eins']);
    expect(JSON.stringify(j)).not.toMatch(/produktId|l-probe|dateien|probe-eins\.pdf/);
    const n = await oeffentlich({ 'if-none-match': r.headers.get('etag')! });
    expect(n.status).toBe(304);
  });
  it('Bausteine: der Katalog ohne Eintrag ist bit-gleich zur Datei; ein ausgeblendeter ist nicht bestellbar, wird aber geliefert', async () => {
    const B = await import('@/lib/bausteine/server');
    const datei = await B.katalogDatei();
    const wirksam = await B.katalogLaden();
    expect(wirksam[0]).toEqual(datei[0]);
    expect(wirksam[1]).toMatchObject({ preis: 5900, ausgeblendet: true });
    expect(await B.bausteinVon('probe-zwei')).toBeNull();
    expect((await B.bausteinVon('probe-eins'))?.preis).toBe(9900);
  });
  it('Startwerte übernehmen: nur ein Inhaber, Vorschau zuerst', async () => {
    const post = (b: unknown, wer = 'kevin') => intern.POST!(new Request('http://test/api/website/intern', { method: 'POST', headers: kopf(wer), body: JSON.stringify(b) }));
    expect((await post({ aktion: 'startwerte' }, 'nurbusiness')).status).toBe(403);
    const v = await (await post({ aktion: 'startwerte' })).json();
    expect(v.vorschau).toBe(true);
    expect((await lesen()).inhalt.faq).toHaveLength(0);
  });
  it('/erstgespraech: ohne Seite die ruhige 404, mit einziger „erstgespraech-…“ eine Weiterleitung', async () => {
    const leer = await erst.GET!(new Request('http://test/erstgespraech'));
    expect(leer.status).toBe(404);
    expect(await leer.text()).toContain('keine Termine');
    const { karteiHaushalt } = await import('@/lib/crm/sperrliste');
    const slug = `erstgespraech-${'d'.repeat(24)}`;
    await db.saveJson(`buchung--${await karteiHaushalt()}`, { seiten: [{ slug, titel: 'Erstgespräch', aktiv: true }], buchungen: [] });
    const r = await erst.GET!(new Request('http://test/erstgespraech'));
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe(`/buchen/${slug}`);
  });
});

describe('Middleware, Register, Caddy', () => {
  let middleware: typeof import('@/middleware').middleware;
  beforeAll(async () => { ({ middleware } = await import('@/middleware')); });
  const offen = (r: Response) => r.headers.get('x-middleware-next') === '1';
  const lauf = (pfad: string, init: { method?: string; headers?: Record<string, string> } = {}) => middleware(new NextRequest(`http://localhost:3001${pfad}`, init as never));
  it('offen nur GET/HEAD auf Inhalt, Bild und /erstgespraech — ohne Köpfe einer Person; Pflege bleibt zu', async () => {
    for (const p of ['/api/website/inhalt', '/api/website/bild/wb-abcd-1234', '/erstgespraech']) {
      const r = await lauf(p, { headers: { 'x-make-user': 'kevin' } });
      expect(offen(r), p).toBe(true);
      expect(r.headers.get('x-middleware-request-x-make-user')).toBeNull();
    }
    for (const [p, m] of [['/api/website/intern', 'GET'], ['/api/website/inhalt', 'POST'], ['/api/website/bild/md-1', 'GET'], ['/api/website/bild/../intern', 'GET'], ['/erstgespraech/x', 'GET'], ['/api/website', 'GET']] as const) {
      const x = await lauf(p, m === 'POST' ? { method: 'POST', headers: { origin: 'http://localhost:3001', host: 'localhost:3001' } } : {});
      expect(offen(x), `${m} ${p}`).toBe(false);
    }
  });
  it('Register, Caddy, Köpfe, Vertrag', () => {
    const reg = readFileSync('lib/zugang/routen-register.ts', 'utf8');
    expect(reg).toMatch(/'website\/inhalt': r\('GET', 'offen'/);
    expect(readFileSync('lib/crm/speicher-register.ts', 'utf8')).toContain("H('website-inhalt',");
    const cfg = readFileSync('next.config.mjs', 'utf8');
    expect(cfg).toContain("{ source: '/erstgespraech', headers: buchung }");
    expect(cfg).toContain("{ source: '/api/website/inhalt', headers: website }");
    const vertrag = readFileSync('WEBSITE_VERTRAG_INHALT.md', 'utf8');
    for (const f of ['preisText', 'preisNetto', 'events.einleitung', 'anmeldung', '/erstgespraech']) expect(vertrag, f).toContain(f);
  });
});
