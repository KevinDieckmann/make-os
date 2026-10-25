// ─── Formular „Angebot anfordern“ — der externe Link (25.10.2026) ────────────────────────────────────────────────────────────────────────
// Middleware (nur /angebot/<slug> und /api/angebot/<slug> offen, Köpfe einer Person nie durchgereicht), öffentliche Route: falscher, widerrufener und
// abgelaufener Link → dieselbe 404; Drossel; Honigtopf und Zeit-Fehler mit demselben Text; 413; nur die freigegebenen Produkte; die Antwort enthält NIE
// Bestandsdaten (auch nicht „Kunde war schon da“). Erfundene Daten (@example.invalid).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Leistung } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-angebotslink-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-angebotslink';
process.env.MAKE_OS_KEY = 'dienst-test-angebotslink';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-angebotslink-0123456789';

const D = 'example.invalid';
type Ctx = { params: Promise<{ slug: string }> };
type R = { GET: (r: Request, c: Ctx) => Promise<Response>; POST: (r: Request, c: Ctx) => Promise<Response> };
let route: R;
let formulare: { POST: (r: Request) => Promise<Response> };
let db: typeof import('@/lib/store/local-db');
let S: typeof import('@/lib/crm/formulare-speicher');
let drossel: typeof import('@/lib/zugang/drossel');
let middleware: typeof import('@/middleware').middleware;

const J = '2026-09-01T10:00:00.000Z';
const L = (id: string, name: string): Leistung => ({ id, name, typ: 'retainer', stufe: 'kern', preis: { betrag: 900, einheit: 'Monat netto', basis: 'monat' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', angebot: { leistungstext: `${name} — Leistung.` }, geaendert: J } as Leistung);
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Bert', nachname: 'Bekannt', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', ...x } as Kontakt);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = async (r: Response) => ({ status: r.status, text: await r.clone().text(), d: await r.json().catch(() => ({})) as Record<string, any> });
let ip = 1;
const kopf = (neuesNetz = true) => ({ 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${neuesNetz ? ip++ : ip}` });
const get = (slug: string, h = kopf()) => route.GET(new Request(`http://localhost/api/angebot/${slug}`, { headers: h }), { params: Promise.resolve({ slug }) }).then(j);
const post = (slug: string, body: unknown, h = kopf()) => route.POST(new Request(`http://localhost/api/angebot/${slug}`, { method: 'POST', headers: h, body: typeof body === 'string' ? body : JSON.stringify(body) }), { params: Promise.resolve({ slug }) }).then(j);
const anfrage = (email: string, produkt = 'l-frei') => ({ firma: { name: 'Neukunde GmbH' }, person: { anrede: 'Sie', vorname: 'Nina', nachname: 'Neu', email }, produkte: [{ id: produkt }] });
let n = 0;
const uuid = () => `11111111-0000-4000-8000-${String(++n).padStart(12, '0')}`;

async function linkAnlegen(produkte = ['l-frei']): Promise<{ slug: string; id: string }> {
  const r = await formulare.POST(new Request('http://localhost/api/crm/formulare', { method: 'POST', headers: { 'x-make-user': 'kevin', 'content-type': 'application/json' }, body: JSON.stringify({ aktion: 'link-neu', name: 'Rita Reisende', produkte }) })).then(j);
  expect(r.status, r.text).toBe(200);
  return { slug: String(r.d.pfad).replace('/angebot/', ''), id: r.d.link.id };
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db'); S = await import('@/lib/crm/formulare-speicher'); drossel = await import('@/lib/zugang/drossel');
  route = await import('../app/api/angebot/[slug]/route') as unknown as R;
  formulare = await import('../app/api/crm/formulare/route') as unknown as typeof formulare;
  ({ middleware } = await import('@/middleware'));
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });
beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren(); drossel._zuruecksetzen();
  vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubGlobal('fetch', async () => { throw new Error('kein Netz im Test'); });
  await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: `kevin@${D}`, name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' }], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [k('c-bekannt', { email: `bert@kunde.${D}`, firma: 'Geheime Bestandsfirma AG', firmaId: 'f-geheim' })] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', { ...leererBestand(), firmen: [{ id: 'f-geheim', name: 'Geheime Bestandsfirma AG', rolle: 'kunde', geaendert: J }], leistungen: [L('l-frei', 'Freigegebenes Paket'), L('l-intern', 'Internes Paket')] });
  await db.saveJson('gesellschaften--h', { gesellschaften: [{ id: 'ug', firmierung: 'Beispiel Innovation GmbH', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', email: `info@${D}` }] });
});

describe('Middleware: nur die Link-Adressen sind offen', () => {
  const SLUG = 'rita-0123456789abcdef01234567';
  const offen = (r: Response) => r.headers.get('x-middleware-next') === '1';
  const lauf = (p: string, init: { method?: string; headers?: Record<string, string> } = {}) => middleware(new NextRequest(`http://localhost:3001${p}`, init as never));
  it('Seite und Schnittstelle offen; Nachbarn, tiefere Pfade, fremde Formen zu; Köpfe einer Person nie durchgereicht', async () => {
    for (const p of [`/angebot/${SLUG}`, `/api/angebot/${SLUG}`]) expect(offen(await lauf(p)), p).toBe(true);
    expect(offen(await lauf(`/api/angebot/${SLUG}`, { method: 'POST', headers: { origin: 'http://localhost:3001', host: 'localhost:3001' } }))).toBe(true);
    for (const p of ['/angebot', `/angebot/${SLUG}/x`, '/angebot/kurz', `/api/angebot/${SLUG}/admin`, '/api/angebot', `/angebot/${SLUG.toUpperCase()}`, '/api/crm/formulare']) {
      const r = await lauf(p);
      expect(offen(r), p).toBe(false);
    }
    expect((await lauf(`/api/angebot/${SLUG}`, { method: 'POST', headers: { origin: 'https://fremd.example.invalid' } })).status).toBe(401);
    const r = await lauf(`/api/angebot/${SLUG}`, { headers: { 'x-make-user': 'kevin', 'x-make-person': 'kevin' } });
    expect(r.headers.get('x-middleware-request-x-make-user')).toBeNull();
    expect(r.headers.get('x-middleware-request-x-make-person')).toBeNull();
  });
});

describe('Öffentliche Route', () => {
  it('GET: nur die freigegebenen Produkte, Stempel, nie Bestandsdaten', async () => {
    const { slug } = await linkAnlegen();
    const r = await get(slug);
    expect(r.status).toBe(200);
    expect(r.d.seite.produkte.map((p: { name: string }) => p.name)).toEqual(['Freigegebenes Paket']);
    expect(r.text).not.toContain('Internes Paket');
    expect(r.text).not.toContain('Geheime Bestandsfirma');
    expect(typeof r.d.stempel).toBe('string');
  });
  it('falscher, widerrufener und abgelaufener Link → dieselbe 404', async () => {
    const { slug, id } = await linkAnlegen();
    const falsch = await get('rita-reisende-ffffffffffffffffffffffff');
    expect(falsch.status).toBe(404);
    await S.aendereFormular(b => ({ ...b, links: b.links.map(l => (l.id === id ? { ...l, bis: '2020-01-01' } : l)) }));
    const abgelaufen = await get(slug);
    expect(abgelaufen.status).toBe(404);
    expect(abgelaufen.text).toBe(falsch.text);
    await S.aendereFormular(b => ({ ...b, links: b.links.map(l => (l.id === id ? { ...l, bis: undefined, widerrufenAm: J } : l)) }));
    const widerrufen = await get(slug);
    expect(widerrufen.status).toBe(404);
    expect(widerrufen.text).toBe(falsch.text);
    expect((await post(slug, {})).status).toBe(404);
  });
  it('Honigtopf und zu schnell → derselbe Text; gefälschter Stempel 400; zu groß 413; Drossel 429', async () => {
    const { slug } = await linkAnlegen();
    const alt = S.angebotStempel(slug, Date.now() - 10_000);
    const falle = await post(slug, { anfrageId: uuid(), anfrage: anfrage(`n@neu.${D}`), stempel: alt, webseite: 'https://spam.example.invalid' });
    const schnell = await post(slug, { anfrageId: uuid(), anfrage: anfrage(`n@neu.${D}`), stempel: S.angebotStempel(slug, Date.now()) });
    expect(falle.status).toBe(400);
    expect(schnell.status).toBe(400);
    expect(falle.d.fehler).toBe(schnell.d.fehler);
    expect((await post(slug, { stempel: '123.falsch', anfrage: anfrage(`n@neu.${D}`) })).status).toBe(400);
    expect((await post(slug, 'x'.repeat(17 * 1024))).status).toBe(413);
    const h = kopf();
    let letzte = 0;
    for (let i = 0; i < 12; i++) letzte = (await get('rita-reisende-eeeeeeeeeeeeeeeeeeeeeeee', h)).status;
    expect(letzte).toBe(429);
  });
  it('Anfrage über den Link: nur freigegebene Produkte; bekannter Kunde → dieselbe Antwort wie ein neuer, ohne Bestandsdaten', async () => {
    const { slug, id } = await linkAnlegen();
    const stempel = S.angebotStempel(slug, Date.now() - 10_000);
    expect((await post(slug, { anfrageId: uuid(), anfrage: anfrage(`n@neu.${D}`, 'l-intern'), stempel })).status).toBe(400);
    const neu = await post(slug, { anfrageId: uuid(), anfrage: anfrage(`nina@neu.${D}`), stempel });
    const bekannt = await post(slug, { anfrageId: uuid(), anfrage: { ...anfrage(`bert@kunde.${D}`), person: { anrede: 'Sie', vorname: 'Bert', nachname: 'Bekannt', email: `bert@kunde.${D}` } }, stempel });
    expect(neu.status).toBe(200);
    expect(bekannt.status).toBe(200);
    expect(Object.keys(neu.d).sort()).toEqual(Object.keys(bekannt.d).sort());
    expect(neu.d.status).toBe(bekannt.d.status);
    for (const x of [neu, bekannt]) {
      expect(x.text).not.toMatch(/c-bekannt|f-geheim|Geheime Bestandsfirma|kontaktId|firmaId|angebotId|gruende/);
    }
    // Der Kontakt hängt an der vorhandenen Person (keine Dublette), die Quelle nennt den Link.
    const kk = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
    expect(kk.filter(x => x.email === `bert@kunde.${D}`)).toHaveLength(1);
    expect(kk.find(x => x.email === `nina@neu.${D}`)?.quelle).toBe('Vertrieb (Link: Rita Reisende)');
    const b = await S.ladeFormular();
    expect(b.eingaenge.every(e => e.quelle === 'link' && e.linkId === id)).toBe(true);
    expect(b.links.find(l => l.id === id)?.anzahl).toBe(2);
  });
});
