// ─── R-K2 (29.09.): Buchungsseite — frisch (#73), E-Mail bestätigen (#76), Datenschutz (#79), freie Tage (#72),
// „zählt als belegt“ (#69). Eigener Datenordner, iCloud gemockt (nie echte Aufrufe), Zugang des Haushalts gemockt
// (x-make-user) — der Dienstweg (x-make-key) bleibt echt. Alle Namen und Adressen erfunden (@example.invalid).
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { BuchungBestand } from '@/lib/kalender/buchung';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-rk2-buchung-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-rk2-buchung';
process.env.SESSION_SECRET = 'pruef-sitzung-rk2-buchung-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-rk2-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-rk2-nur-im-test-0123456789abcdef';

type T = { uid: string; id: string; titel: string; start: string; ende: string; ganztags: boolean; kalender: string; notiz?: string; art: string; beschaeftigt: boolean; abgesagt?: boolean };
const ic = vi.hoisted(() => ({ verbunden: true, termine: [] as T[], angelegt: 0, gaeste: [] as { email: string }[][], alterMin: 0, fehler: false, abgleichFehler: false, erzwungen: 0 }));
// Nach einem gescheiterten Abgleich ist `at` der letzte gelungene (hier 3 Min. alt), `fehlerAt` jetzt.
const stand = () => ({ at: new Date(Date.now() - (ic.alterMin || (ic.fehler ? 3 : 0)) * 60_000).toISOString(), ...(ic.fehler ? { fehler: 'iCloud nicht erreichbar', fehlerAt: new Date().toISOString() } : {}), kalender: [], objekte: {} });
vi.mock('@/lib/kalender/icloud', async () => ({
  CACHE: 'calendar-cache',
  SPEICHER: 'kalender-icloud',
  // Die Frische-Regel ist die echte (R-K1 `abgleichAlter`) — nur die Daten sind nachgebaut.
  abgleichAlter: (await vi.importActual<typeof import('@/lib/kalender/icloud')>('@/lib/kalender/icloud')).abgleichAlter,
  holfenster: () => ({ von: '2026-07-01', bis: '2027-11-01' }),
  objekteKurz: () => ic.termine.map(t => ({ uid: t.uid, schluessel: t.id, tag: t.start.slice(0, 10), zusatz: null })),
  verbunden: () => ic.verbunden,
  ladeStand: async () => stand(),
  frischerStand: async () => stand(),
  abgleichen: async (opt: { erzwingen?: boolean } = {}) => { if (ic.abgleichFehler) throw new Error('iCloud nicht erreichbar'); if (opt.erzwingen) ic.erzwungen++; return stand(); },
  termineImZeitraum: (_s: unknown, von: string, bis: string) => ic.termine.filter(t => t.start.slice(0, 10) < bis && t.ende.slice(0, 10) >= von).map(t => ({ ...t, href: '', kalenderId: '', serie: false, mitTeilnehmern: false, bearbeitbar: true })),
  anlegen: async (e: { titel: string; kalender: string; start: string; ende: string; notiz?: string; art?: string; beschaeftigt?: boolean; gaeste?: { email: string }[] }) => {
    ic.angelegt++;
    ic.gaeste.push(e.gaeste ?? []);
    const uid = `UID-RK2-${ic.angelegt}`, schluessel = `testkal|${uid}`;
    ic.termine.push({ uid, id: schluessel, titel: e.titel, start: e.start, ende: e.ende, ganztags: false, kalender: e.kalender, notiz: e.notiz, art: e.art ?? 'termin', beschaeftigt: e.beschaeftigt ?? true });
    return { uid, schluessel, kalender: e.kalender, gaeste: (e.gaeste ?? []).length };
  },
}));
vi.mock('@/lib/kalender/zugang', () => ({
  KEIN_KALENDER: { ok: false, fehler: 'Kein Zugang.' },
  kalenderZugang: async (req: Request) => { const p = req.headers.get('x-make-user'); return p === 'kevin' || p === 'malin' ? { person: p, dienst: false } : null; },
}));

type Ctx = { params: Promise<{ slug: string }> };
type Route = { GET?: (r: Request, c: Ctx) => Promise<Response>; POST?: (r: Request, c: Ctx) => Promise<Response> };
type Verwaltung = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let db: typeof import('@/lib/store/local-db');
let drossel: typeof import('@/lib/zugang/drossel');
let verwaltung: Verwaltung, oeffentlich: Route, status: Route;
let SLUG = '';
const HAUS = 'test-haus-rk2';

const hand = { 'content-type': 'application/json', 'x-make-user': 'kevin' };
const verwalten = async (body: Record<string, unknown>, kopf: Record<string, string> = hand) => { const r = await verwaltung.POST(new Request('http://test/api/kalender/buchung', { method: 'POST', headers: kopf, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() as J }; };
const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const holen = async (slug = SLUG) => { const r = await oeffentlich.GET!(new Request(`http://test/api/buchung/${slug}`), ctx(slug)); return { status: r.status, d: await r.json() as J }; };
const buchenRoh = async (body: Record<string, unknown>, slug = SLUG) => { const r = await oeffentlich.POST!(new Request(`http://test/api/buchung/${slug}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), ctx(slug)); return { status: r.status, d: await r.json() as J }; };
const statusAktion = async (token: string, aktion: string, slug = SLUG) => { const r = await status.POST!(new Request(`http://test/api/buchung/${slug}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, aktion }) }), ctx(slug)); return { status: r.status, d: await r.json() as J }; };
const bestand = async () => (await db.loadJson<BuchungBestand>(`buchung--${HAUS}`))!;
const kontakte = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
const T0 = new Date('2026-10-05T06:00:00Z'); // Mo 08:00 Berlin
let uhr = T0.getTime();
const weiter = (sek: number) => { uhr += sek * 1000; vi.setSystemTime(new Date(uhr)); };
const zeitSetzen = (d: Date) => { uhr = d.getTime(); vi.setSystemTime(d); };

/** Buchen (GET → Stempel → POST) und auf der Status-Seite bestätigen → { id, token } der angefragten Buchung. */
async function anfragen(start: string, email: string): Promise<{ id: string; token: string }> {
  const { d } = await holen();
  weiter(5);
  const r = await buchenRoh({ start, name: 'Testa Gast', email, einwilligung: true, stempel: d.stempel });
  expect(r.status, JSON.stringify(r.d)).toBe(201);
  drossel._zuruecksetzen();
  expect((await statusAktion(r.d.token, 'bestaetigen')).d.sicht.status).toBe('angefragt');
  return { id: (await bestand()).buchungen.find(x => x.email === email)!.id, token: r.d.token };
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  db = await import('@/lib/store/local-db');
  drossel = await import('@/lib/zugang/drossel');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@example.invalid', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    { id: 'k2', speicher: 'malin', email: 'm@example.invalid', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
  ], einladungen: [] });
  await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Testkalender', malin: 'Malin-Kalender', beide: 'Gemeinsam' } });
  verwaltung = await import('@/app/api/kalender/buchung/route');
  oeffentlich = await import('@/app/api/buchung/[slug]/route');
  status = await import('@/app/api/buchung/[slug]/status/route');
});
afterEach(() => { drossel._zuruecksetzen(); ic.alterMin = 0; ic.fehler = false; ic.abgleichFehler = false; ic.verbunden = true; });
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

const SEITE = { titel: 'Kennenlernen', person: 'kevin', dauerMin: 30, fenster: [{ tage: [1, 2, 3, 4, 5, 6, 7], von: '09:00', bis: '12:00' }], tageVoraus: 7, vorlaufMin: 0, maxJeTag: 10, pufferMin: 0, rasterMin: 30, zielKalender: 'Testkalender', ort: 'Videoraum folgt' };

describe('#79 Verantwortlich ist Pflicht, Hinweis passt zum Verhalten', () => {
  it('Seite ohne Verantwortlichen → 400; mit → angelegt', async () => {
    expect((await verwalten({ aktion: 'seite', seite: SEITE })).status).toBe(400);
    const r = await verwalten({ aktion: 'seite', seite: { ...SEITE, verantwortlich: 'Probe GmbH, datenschutz@example.invalid' } });
    expect(r.status).toBe(200);
    SLUG = r.d.seite.slug;
  });
  it('Altbestand ohne Verantwortlichen: keine Plätze, Buchen 503', async () => {
    await db.updateJson<BuchungBestand>(`buchung--${HAUS}`, cur => ({ ...cur!, seiten: [...cur!.seiten, { ...cur!.seiten[0], id: 'bs-alt-ohne', slug: 'alt-ohne-0123456789abcdef01234567', verantwortlich: '' }] }));
    const g = await holen('alt-ohne-0123456789abcdef01234567');
    expect(g.d.plaetze).toEqual([]);
    expect(g.d.hinweis).toContain('keine Termine buchbar');
    weiter(5);
    expect((await buchenRoh({ start: '2026-10-06T09:00:00', name: 'X Y', email: 'alt@example.invalid', einwilligung: true, stempel: g.d.stempel }, 'alt-ohne-0123456789abcdef01234567')).status).toBe(503);
    await db.updateJson<BuchungBestand>(`buchung--${HAUS}`, cur => ({ ...cur!, seiten: cur!.seiten.filter(s => s.id !== 'bs-alt-ohne') }));
  });
  it('Hinweis: erst die Freigabe legt den Geschäftskontakt an; abgelehnte Anfrage hinterlässt im CRM nichts', async () => {
    const g = await holen();
    const text = (g.d.seite.hinweis as string[]).join(' ');
    expect(text).toContain('Erst wenn wir den Termin bestätigen, legen wir Sie als Geschäftskontakt an');
    expect(text).toContain('30 Tage');
    expect(g.d.seite.verantwortlich).toContain('Probe GmbH');
    const { id } = await anfragen('2026-10-06T09:00:00', 'abgelehnt@example.invalid');
    expect((await kontakte()).some(k => k.email === 'abgelehnt@example.invalid')).toBe(false);
    expect((await verwalten({ aktion: 'ablehnen', id })).status).toBe(200);
    expect((await kontakte()).some(k => k.email === 'abgelehnt@example.invalid')).toBe(false);
    expect(JSON.stringify(await db.loadJson('crm'))).not.toContain('abgelehnt@example.invalid');
  });
});

describe('#73 Buchung nur mit frischem Kalender', () => {
  it('Stand älter als 30 Min., Abgleich mit Fehler oder ohne iCloud → keine Plätze', async () => {
    expect((await holen()).d.plaetze.length).toBeGreaterThan(0);
    ic.alterMin = 31;
    expect(await holen()).toMatchObject({ d: { plaetze: [], hinweis: expect.stringContaining('keine Termine buchbar') } });
    ic.alterMin = 0; ic.fehler = true;
    expect((await holen()).d.plaetze).toEqual([]);
    ic.fehler = false; ic.verbunden = false;
    expect((await holen()).d.plaetze).toEqual([]);
  });
  it('POST gleicht erzwungen ab; scheitert der Abgleich → 503, nichts reserviert', async () => {
    const { d } = await holen();
    weiter(15);
    ic.abgleichFehler = true;
    const r = await buchenRoh({ start: '2026-10-06T10:00:00', name: 'Testo Zwei', email: 'fehler@example.invalid', einwilligung: true, stempel: d.stempel });
    expect(r.status).toBe(503);
    expect((await bestand()).buchungen.some(x => x.email === 'fehler@example.invalid')).toBe(false);
    ic.abgleichFehler = false;
    drossel._zuruecksetzen();
    weiter(15);
    const vorher = ic.erzwungen;
    const ok = await buchenRoh({ start: '2026-10-06T10:00:00', name: 'Testo Zwei', email: 'fehler@example.invalid', einwilligung: true, stempel: d.stempel });
    expect(ok.status).toBe(201);
    expect(ic.erzwungen).toBe(vorher + 1);
  });
  it('am iPhone belegt → die Buchung ist nicht mehr möglich (409)', async () => {
    const { d } = await holen();
    ic.termine.push({ uid: 'iphone-1', id: 'iphone-1', titel: 'Privat', start: '2026-10-06T11:00:00', ende: '2026-10-06T11:30:00', ganztags: false, kalender: 'Testkalender', art: 'termin', beschaeftigt: true });
    weiter(15);
    expect((await buchenRoh({ start: '2026-10-06T11:00:00', name: 'Testa Drei', email: 'drei@example.invalid', einwilligung: true, stempel: d.stempel })).status).toBe(409);
    ic.termine = ic.termine.filter(t => t.uid !== 'iphone-1');
  });
  it('abgesagte Termine blockieren nicht (dieselbe Regel wie K1/R-K1 `abgesagt`)', async () => {
    const vorher = ((await holen()).d.plaetze as { start: string }[]).filter(p => p.start.startsWith('2026-10-09')).length;
    ic.termine.push({ uid: 'abgesagt-1', id: 'abgesagt-1', titel: 'Fällt aus', start: '2026-10-09T09:00:00', ende: '2026-10-09T12:00:00', ganztags: false, kalender: 'Testkalender', art: 'termin', beschaeftigt: true, abgesagt: true });
    expect(((await holen()).d.plaetze as { start: string }[]).filter(p => p.start.startsWith('2026-10-09'))).toHaveLength(vorher);
    ic.termine = ic.termine.filter(t => t.uid !== 'abgesagt-1');
  });
  it('Freigabe: Platz inzwischen belegt → 409 konflikt, nichts angelegt; „trotzdem“ legt an; Abgleich scheitert → 503', async () => {
    const { id } = await anfragen('2026-10-07T09:00:00', 'konflikt@example.invalid');
    ic.termine.push({ uid: 'iphone-2', id: 'iphone-2', titel: 'Zahnarzt', start: '2026-10-07T09:15:00', ende: '2026-10-07T10:00:00', ganztags: false, kalender: 'Testkalender', art: 'termin', beschaeftigt: true });
    const vorher = ic.angelegt;
    ic.abgleichFehler = true;
    expect((await verwalten({ aktion: 'freigeben', id })).status).toBe(503);
    ic.abgleichFehler = false;
    const k = await verwalten({ aktion: 'freigeben', id });
    expect(k).toMatchObject({ status: 409, d: { konflikt: true } });
    expect(ic.angelegt).toBe(vorher);
    expect((await bestand()).buchungen.find(x => x.id === id)!.status).toBe('angefragt');
    expect((await kontakte()).some(x => x.email === 'konflikt@example.invalid')).toBe(false); // auch kein halber CRM-Vorgang
    expect((await verwalten({ aktion: 'freigeben', id, trotzKonflikt: true })).status).toBe(200);
    expect(ic.angelegt).toBe(vorher + 1);
    ic.termine = ic.termine.filter(t => t.uid !== 'iphone-2');
  });
});

describe('#76 E-Mail-Adresse bestätigen (Entwurf + Klick, einmaliger Link)', () => {
  let id = '', token = '', link = '';
  it('Link nur von Hand, nur für angefragte/bestätigte Buchungen; im Bestand nur der Hash', async () => {
    const a = await anfragen('2026-10-08T09:00:00', 'mail.gast@example.invalid');
    id = a.id; token = a.token;
    expect((await verwalten({ aktion: 'mail-link', id }, { ...hand, 'x-make-key': 'pruef-schluessel-rk2-buchung' })).status).toBe(403);
    const r = await verwalten({ aktion: 'mail-link', id });
    expect(r.status).toBe(200);
    expect(r.d.pfad).toBe(`/buchen/${SLUG}/status#mail=${r.d.token}`);
    link = r.d.token;
    const b = (await bestand()).buchungen.find(x => x.id === id)!;
    expect(b.mailLink?.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(await bestand())).not.toContain(link);
    const g = await verwaltung.GET(new Request('http://test/api/kalender/buchung', { headers: hand }));
    const gd = await g.json() as { buchungen: Record<string, unknown>[] };
    const sicht = gd.buchungen.find(x => x.id === id)!;
    expect(sicht).not.toHaveProperty('mailLink');
    expect(sicht.mailLinkBis).toBeTruthy();
  });
  it('Einladen an die unbestätigte Adresse nur nach dem Warnhinweis (409 unbestaetigt)', async () => {
    const r = await verwalten({ aktion: 'freigeben', id, einladen: true, einladungBestaetigt: true });
    expect(r).toMatchObject({ status: 409, d: { unbestaetigt: true } });
    expect((await bestand()).buchungen.find(x => x.id === id)!.status).toBe('angefragt');
  });
  it('falsches oder Status-Token passt nicht; der echte Link bestätigt genau einmal', async () => {
    expect((await statusAktion('B'.repeat(43), 'mail-bestaetigen')).status).toBe(404);
    expect((await statusAktion(token, 'mail-bestaetigen')).status).toBe(404); // Status-Token ist kein Mail-Token
    const ok = await statusAktion(link, 'mail-bestaetigen');
    expect(ok).toMatchObject({ status: 200, d: { ok: true, mail: true, sicht: { emailBestaetigt: true } } });
    const b = (await bestand()).buchungen.find(x => x.id === id)!;
    expect(b.emailBestaetigtAm).toBeTruthy();
    expect(b.mailLink).toBeUndefined();
    drossel._zuruecksetzen();
    expect((await statusAktion(link, 'mail-bestaetigen')).status).toBe(404); // verbraucht
    expect((await verwalten({ aktion: 'mail-link', id })).status).toBe(409); // schon bestätigt
  });
  it('Freigabe nach Bestätigung: Nachweis „bestätigt“; einladen ohne Warnung möglich', async () => {
    const r = await verwalten({ aktion: 'freigeben', id, einladen: true, einladungBestaetigt: true });
    expect(r.status).toBe(200);
    expect(ic.gaeste[ic.gaeste.length - 1]).toEqual([{ email: 'mail.gast@example.invalid', name: 'Testa Gast' }]);
    const k = (await kontakte()).find(x => x.email === 'mail.gast@example.invalid')!;
    const ew = k.einwilligungen!.find(e => e.belegRef === `buchung:${id}`)!;
    expect(ew.nachweis).toContain('per Bestätigungslink bestätigt');
  });
  it('Bestätigung NACH der Freigabe hängt eine zweite Einwilligung „bestätigt“ an (Liste wächst nur)', async () => {
    const a = await anfragen('2026-10-08T10:00:00', 'spaet@example.invalid');
    expect((await verwalten({ aktion: 'freigeben', id: a.id })).status).toBe(200);
    const vorher = (await kontakte()).find(x => x.email === 'spaet@example.invalid')!.einwilligungen!.filter(e => e.belegRef === `buchung:${a.id}`);
    expect(vorher).toHaveLength(1);
    expect(vorher[0].nachweis).toContain('unbestätigt');
    const l = await verwalten({ aktion: 'mail-link', id: a.id });
    expect((await statusAktion(l.d.token, 'mail-bestaetigen')).status).toBe(200);
    const nach = (await kontakte()).find(x => x.email === 'spaet@example.invalid')!.einwilligungen!.filter(e => e.belegRef === `buchung:${a.id}`);
    expect(nach).toHaveLength(2);
    expect(nach[0].nachweis).toContain('unbestätigt');
    expect(nach[1].nachweis).toContain('per Bestätigungslink bestätigt');
  });
  it('Link läuft nach 7 Tagen ab; ein neuer Link ersetzt den alten', async () => {
    const a = await anfragen('2026-10-09T09:00:00', 'ablauf@example.invalid');
    const alt = (await verwalten({ aktion: 'mail-link', id: a.id })).d.token as string;
    const neu = (await verwalten({ aktion: 'mail-link', id: a.id })).d.token as string;
    expect((await statusAktion(alt, 'mail-bestaetigen')).status).toBe(404);
    const merk = uhr;
    zeitSetzen(new Date(uhr + 8 * 86_400_000));
    expect((await statusAktion(neu, 'mail-bestaetigen')).status).toBe(404);
    zeitSetzen(new Date(merk));
  });
});

describe('#72 frei, aber nicht gesetzlich · #69 zählt als belegt', () => {
  it('24.12. und 31.12. sind gesperrt (einstellbar); an Feiertagen ohnehin', async () => {
    zeitSetzen(new Date('2026-12-21T06:00:00Z')); // Mo
    const tage = new Set(((await holen()).d.plaetze as { start: string }[]).map(p => p.start.slice(0, 10)));
    expect(tage.has('2026-12-23')).toBe(true);
    expect(tage.has('2026-12-24')).toBe(false); // Heiligabend (frei, nicht gesetzlich)
    expect(tage.has('2026-12-25')).toBe(false); // 1. Weihnachtstag (Feiertag NRW)
    await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Testkalender', malin: 'Malin-Kalender', beide: 'Gemeinsam' }, freieTage: [] });
    expect(((await holen()).d.plaetze as { start: string }[]).some(p => p.start.startsWith('2026-12-24'))).toBe(true);
    const { freieZeitFuer } = await import('@/lib/kalender/freie-zeit');
    await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Testkalender', malin: 'Malin-Kalender', beide: 'Gemeinsam' } });
    const f = await freieZeitFuer({ personen: ['kevin'], dauerMin: 30, von: '2026-12-21', tage: 14 });
    expect(f.vorschlaege.some(v => v.tag === '2026-12-24' || v.tag === '2026-12-31')).toBe(false);
    expect(f.vorschlaege.some(v => v.tag === '2026-12-23')).toBe(true);
    zeitSetzen(T0);
  });
  it('ein nicht zugeordneter Kalender blockiert niemanden — erst mit Schalter „zählt als belegt“', async () => {
    ic.termine.push({ uid: 'abo-1', id: 'abo-1', titel: 'Abo', start: '2026-10-06T09:00:00', ende: '2026-10-06T12:00:00', ganztags: false, kalender: 'Abo-Kalender', art: 'termin', beschaeftigt: true });
    const frei = ((await holen()).d.plaetze as { start: string }[]).filter(p => p.start.startsWith('2026-10-06')).length;
    expect(frei).toBeGreaterThan(0);
    await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Testkalender', malin: 'Malin-Kalender', beide: 'Gemeinsam' }, belegt: { 'Abo-Kalender': true } });
    expect(((await holen()).d.plaetze as { start: string }[]).filter(p => p.start.startsWith('2026-10-06'))).toHaveLength(0);
    // Und umgekehrt: der eigene Kalender kann ausgeschaltet werden.
    await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Testkalender', malin: 'Malin-Kalender', beide: 'Gemeinsam' }, belegt: { 'Abo-Kalender': false } });
    expect(((await holen()).d.plaetze as { start: string }[]).filter(p => p.start.startsWith('2026-10-06')).length).toBe(frei);
    ic.termine = ic.termine.filter(t => t.uid !== 'abo-1');
    await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Testkalender', malin: 'Malin-Kalender', beide: 'Gemeinsam' } });
  });
});
