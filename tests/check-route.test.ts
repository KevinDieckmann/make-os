// ─── Innovations-Check (24.10.): öffentliche Strecke, interne Route, Middleware, Datenschutz ─────────────────────
// Eigener Datenordner, Datenschlüssel und Pepper gesetzt, Konten mit Test-Haushalt, Verantwortlicher der Einrichtung gemockt.
// Alle Namen und Adressen erfunden (@example.invalid). Prüft: kommt AUS (404), Reihenfolge nur vom Server (Kurzcheck → Kontakt →
// Wahl → Ergebnis), keine Punkte im Browser, Token/Honigtopf/Mindestzeit/Größe, Lead ins CRM über den Anfrage-Weg, Zahlen wie die
// Auswertung, Beleg-Bewertung im Haushalt, Art. 17 und Löschfrist, Middleware öffnet nur /check und POST /api/check.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CheckBestand } from '@/lib/check/speicher';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-check-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-check';
process.env.SESSION_SECRET = 'pruef-sitzung-check-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-check-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-check-nur-im-test-0123456789abcdef';

const ds = vi.hoisted(() => ({ wert: { verantwortlich: null as string | null, seite: null as string | null } }));
vi.mock('@/lib/datenschutz/einrichtung-server', async () => ({
  ...(await vi.importActual<typeof import('@/lib/datenschutz/einrichtung-server')>('@/lib/datenschutz/einrichtung-server')),
  datenschutzOeffentlichLaden: async () => ds.wert,
}));

type Antwort = { status: number; d: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
let db: typeof import('@/lib/store/local-db');
let drossel: typeof import('@/lib/zugang/drossel');
let oeffentlich: { POST: (r: Request) => Promise<Response> };
let intern: { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
const HAUS = 'test-haus';
const sitzung = (wer = 'kevin') => ({ 'content-type': 'application/json', 'x-make-user': wer });
const check = async (body: Record<string, unknown>): Promise<Antwort> => { const r = await oeffentlich.POST(new Request('http://test/api/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() }; };
const innen = async (body: Record<string, unknown>, wer = 'kevin'): Promise<Antwort> => { const r = await intern.POST(new Request('http://test/api/check/intern', { method: 'POST', headers: sitzung(wer), body: JSON.stringify(body) })); return { status: r.status, d: await r.json() }; };
const innenLesen = async (q = '', wer = 'kevin'): Promise<Antwort> => { const r = await intern.GET(new Request(`http://test/api/check/intern${q}`, { headers: sitzung(wer) })); return { status: r.status, d: await r.json() }; };
const kontakte = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
const bestand = async () => (await db.loadJson<CheckBestand>('check-sitzungen'))!;

/** Die 15 Kurzcheck-Antworten (Handwerk, 10–49) — Klickwerte 1 bzw. 2, Beleg C5 als Text. */
const KURZ: [string, Record<string, unknown>][] = [
  ['A1', { optionIds: ['A1_0'], zusatz: false }], ['A2', { optionIds: ['A2_2'] }], ['A6', { optionIds: ['A6_1'] }],
  ['B1', { optionIds: ['B1_1'] }], ['B3', { optionIds: ['B3_1'] }], ['C1', { optionIds: ['C1_1'] }], ['C2', { optionIds: ['C2_1'] }],
  ['C5', { freitext: 'Wir probieren ChatGPT für Angebotstexte aus.' }], ['C7', { optionIds: ['C7_1'] }], ['D1', { optionIds: ['D1_1'] }],
  ['D7', { optionIds: ['D7_1'] }], ['D8', { optionIds: ['D8_1'] }], ['E1', { optionIds: ['E1_1'] }], ['E4', { optionIds: ['E4_2'] }], ['G1', { optionIds: ['G1_0'] }],
];
const T0 = new Date('2026-11-09T08:00:00Z');
let uhr = T0.getTime();
const weiter = (sek: number) => { uhr += sek * 1000; vi.setSystemTime(new Date(uhr)); };

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  db = await import('@/lib/store/local-db');
  drossel = await import('@/lib/zugang/drossel');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@example.invalid', name: 'Testo Inhaber', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    { id: 'k2', speicher: 'malin', email: 'm@example.invalid', name: 'Proba Partnerin', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
  ], einladungen: [] });
  oeffentlich = await import('@/app/api/check/route');
  intern = await import('@/app/api/check/intern/route');
});
afterEach(() => drossel._zuruecksetzen());
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

describe('kommt ausgeschaltet', () => {
  it('ohne Einschalten ist jede Aktion 404', async () => {
    expect((await check({ aktion: 'start' })).status).toBe(404);
  });
  it('einschalten nur der Inhaber — und nur mit Verantwortlichem der Instanz', async () => {
    expect((await innen({ aktion: 'einstellungen', aktiv: true }, 'malin')).status).toBe(403);
    expect((await innen({ aktion: 'einstellungen', aktiv: true })).status).toBe(409);
    ds.wert = { verantwortlich: 'Probe GmbH, datenschutz@example.invalid', seite: 'example.invalid/datenschutz' };
    const r = await innen({ aktion: 'einstellungen', aktiv: true });
    expect(r.status).toBe(200);
    expect(r.d.einstellungen.aktiv).toBe(true);
    expect((await innen({ aktion: 'einstellungen', buchungSlug: 'erstgespraech-0123456789abcdef01234567' })).status).toBe(400);
  });
  it('fremde Personen bekommen intern nichts', async () => {
    expect((await innenLesen('', 'gast')).status).toBe(403);
    expect((await intern.GET(new Request('http://test/api/check/intern'))).status).toBe(403);
  });
});

describe('die Strecke', () => {
  let S = '', T = '';
  it('Start: Sitzung + Token, Katalog ohne Punkte, Frage 1 ist die Branche', async () => {
    const r = await check({ aktion: 'start', quelle: 'linkedin_test', webseite: '' });
    expect(r.status).toBe(201);
    S = r.d.sitzung; T = r.d.token;
    expect(S).toMatch(/^ck-/); expect(T).toMatch(/^[a-f0-9]{64}$/);
    expect(r.d.schritt).toEqual({ art: 'frage', frageId: 'A1', phase: 'kurzcheck', nummer: 1, von: 15 });
    expect(r.d.katalog.fragen).toHaveLength(67);
    const text = JSON.stringify(r.d);
    for (const geheim of ['"punkte"', '"stufe":', '"rubrik"', '"code"', 'Gewicht', 'tokenHash']) expect(text).not.toContain(geheim);
    expect(r.d.zoe.begruessung.join(' ')).toContain('KI-Assistentin');
    expect(r.d.hinweis.zeilen[0]).toContain('Probe GmbH');
    const b = await bestand();
    expect(b.sitzungen[0].tokenHash).not.toBe(T);
    expect(b.sitzungen[0].quelle).toBe('linkedin_test');
  });
  it('Honigtopf beim Start → nichts angelegt', async () => {
    const vorher = (await bestand()).sitzungen.length;
    expect((await check({ aktion: 'start', webseite: 'https://spam.example.invalid' })).status).toBe(400);
    expect((await bestand()).sitzungen.length).toBe(vorher);
  });
  it('falsches Token → 404, nichts verraten', async () => {
    expect((await check({ aktion: 'stand', sitzung: S, token: 'f'.repeat(64) })).status).toBe(404);
    expect((await check({ aktion: 'stand', sitzung: 'ck-gibt-es-nicht-00000000', token: T })).status).toBe(404);
  });
  it('nur Kennungen aus dem Katalog, nur Fragen, die dran sind, Freitexte nie gekürzt', async () => {
    expect((await check({ aktion: 'antwort', sitzung: S, token: T, frage: 'A1', optionIds: ['A1_99'] })).status).toBe(400);
    expect((await check({ aktion: 'antwort', sitzung: S, token: T, frage: 'B2', optionIds: ['B2_1'] })).status).toBe(400); // Vertiefung: noch nicht dran
    expect((await check({ aktion: 'antwort', sitzung: S, token: T, frage: 'C5', freitext: 'x'.repeat(2001) })).status).toBe(413);
    expect((await check({ aktion: 'ueberspringen', sitzung: S, token: T, frage: 'B1' })).status).toBe(400); // Klickfrage im Kurzcheck
    expect((await check({ aktion: 'antwort', sitzung: S, token: T, frage: 'C4', optionIds: ['C4_0', 'C4_keine'] })).status).toBe(400);
  });
  it('15 Antworten in beliebiger Reihenfolge erlaubt — der Server sagt, was als Nächstes kommt', async () => {
    let r: Antwort | null = null;
    for (const [frage, a] of KURZ) {
      r = await check({ aktion: 'antwort', sitzung: S, token: T, frage, ...a });
      expect(r.status, frage).toBe(200);
    }
    expect(r!.d.schritt).toEqual({ art: 'kontakt' });
    expect(r!.d.fortschritt.kurz).toBe(15);
    // Vor der Kontakt-Frage gibt es weder Wahl noch Ergebnis.
    expect((await check({ aktion: 'wahl', sitzung: S, token: T, wahl: 'ergebnis' })).status).toBe(400);
    expect((await check({ aktion: 'ergebnis', sitzung: S, token: T })).status).toBe(400);
  });
  it('Kontakt: Mindestzeit und Honigtopf (gleicher Text), Prüfungen, dann Lead ins CRM', async () => {
    const k = { aktion: 'kontakt', sitzung: S, token: T, vorname: 'Testa', email: 'Testa.Probe@Example.invalid', firma: 'Probe Handwerk GmbH', rolle: 'A5_0', newsletter: false, webseite: '' };
    const zuFrueh = await check(k);
    expect(zuFrueh.status).toBe(400);
    weiter(60);
    const falle = await check({ ...k, webseite: 'x' });
    expect(falle.status).toBe(400);
    expect(falle.d.fehler).toBe(zuFrueh.d.fehler);
    expect((await check({ ...k, email: 'kein-mail' })).status).toBe(400);
    expect((await check({ ...k, rolle: 'A5_99' })).status).toBe(400);
    const r = await check(k);
    expect(r.status).toBe(200);
    expect(r.d.schritt).toEqual({ art: 'wahl' });
    expect(r.d.vorname).toBe('Testa');
    const s = (await bestand()).sitzungen.find(x => x.id === S)!;
    expect(s.kontakt).toMatchObject({ email: 'testa.probe@example.invalid', firma: 'Probe Handwerk GmbH', newsletterWunsch: false, hinweisFassung: 'check-hinweis-1' });
    expect(s.antworten.A5?.optionIds).toEqual(['A5_0']);
    expect(s.crm?.status).toBe('ok');
    const p = (await kontakte()).find(x => x.id === s.crm!.kontaktId)!;
    expect(p.email).toBe('testa.probe@example.invalid');
    expect(p.aktivitaeten.some(a => /Innovations-Check auf der Website/.test(a.text ?? ''))).toBe(true);
    // Nichts vom CRM-Verweis im Browser.
    expect(JSON.stringify(r.d)).not.toContain(s.crm!.kontaktId!);
  });
  it('Ergebnis: dieselben Zahlen wie die Auswertung, Branchensatz, vorläufig, kein Termin ohne Buchungsseite', async () => {
    const w = await check({ aktion: 'wahl', sitzung: S, token: T, wahl: 'ergebnis' });
    expect(w.d.schritt).toEqual({ art: 'ergebnis' });
    const r = await check({ aktion: 'ergebnis', sitzung: S, token: T });
    expect(r.status).toBe(200);
    const { VORLAGEN } = await import('@/lib/check/katalog');
    const { auswerten, profilAus } = await import('@/lib/check/auswertung');
    const s = (await bestand()).sitzungen.find(x => x.id === S)!;
    const v = VORLAGEN['innovations-check'];
    const soll = auswerten(v.katalog, v.regeln, profilAus(v.katalog, s.antworten), s.antworten);
    expect(r.d.ansicht.gesamt).toBe(soll.gesamt);
    expect(r.d.ansicht.stufe).toBe(soll.stufe);
    expect(r.d.ansicht.genauigkeit).toBe('vorlaeufig');
    expect(r.d.ansicht.achsen.map((a: { key: string }) => a.key)).toEqual(['strategie', 'ki', 'automatisierung', 'daten', 'team']);
    expect(r.d.ansicht.branchenSatz).toContain('10 bis 49');
    expect(r.d.ansicht.zoe[0]).toContain(`Stufe ${soll.stufe}`);
    expect(r.d.gespraech.pfad).toBeUndefined();
    expect(s.ergebnis?.lead.klasse).toMatch(/^[ABC]$/);
    expect(s.abgeschlossen).toBeTruthy();
  });
  it('Vertiefung nach der Wahl „mehr“: Robotik bei Handwerk, danach das Branchen-Modul H', async () => {
    const r = await check({ aktion: 'wahl', sitzung: S, token: T, wahl: 'mehr' });
    expect(r.d.schritt).toMatchObject({ art: 'frage', frageId: 'A3', phase: 'vertiefung' });
    expect((await check({ aktion: 'ueberspringen', sitzung: S, token: T, frage: 'A3' })).d.schritt.frageId).toBe('A4');
    expect((await check({ aktion: 'antwort', sitzung: S, token: T, frage: 'F1', optionIds: ['F1_2'] })).status).toBe(200);
    expect((await check({ aktion: 'antwort', sitzung: S, token: T, frage: 'H1', optionIds: ['H1_0'] })).status).toBe(200);
    expect((await check({ aktion: 'antwort', sitzung: S, token: T, frage: 'I1', optionIds: ['I1_0'] })).status).toBe(400); // Modul einer anderen Branche
  });
  it('intern: Liste, Einzelansicht, Beleg-Bewertung rechnet neu', async () => {
    const l = await innenLesen();
    expect(l.status).toBe(200);
    const z = l.d.liste.find((x: { id: string }) => x.id === S);
    expect(z).toMatchObject({ kontaktStand: 'erfasst', belegeOffen: 1, crm: { status: 'ok' } });
    const e = await innenLesen(`?id=${S}`);
    expect(e.d.sitzung.antworten.find((a: { frage: string }) => a.frage === 'C5').freitext).toContain('ChatGPT');
    const vorher = (await bestand()).sitzungen.find(x => x.id === S)!.ergebnis!;
    const b = await innen({ aktion: 'beleg', id: S, frage: 'C5', score: 4 });
    expect(b.status).toBe(200);
    expect(b.d.zeile.belegeOffen).toBe(0);
    const nachher = (await bestand()).sitzungen.find(x => x.id === S)!;
    expect(nachher.antworten.C5.belegScore).toBe(4);
    expect(nachher.antworten.C5.belegVon).toBe('kevin');
    expect(nachher.ergebnis!.dimensionen.ki).not.toBe(vorher.dimensionen.ki);
    expect((await innen({ aktion: 'beleg', id: S, frage: 'C5', score: 7 })).status).toBe(400);
    expect((await innen({ aktion: 'beleg', id: S, frage: 'D6', score: 2 })).status).toBe(400); // kein Text
  });
  it('ohne Kontakt: Ergebnis frei sichtbar, kein Lead', async () => {
    const st = await check({ aktion: 'start' });
    const s2 = st.d.sitzung, t2 = st.d.token;
    for (const [frage, a] of KURZ) await check({ aktion: 'antwort', sitzung: s2, token: t2, frage, ...a });
    const vorher = (await kontakte()).length;
    expect((await check({ aktion: 'ohne-kontakt', sitzung: s2, token: t2 })).d.schritt).toEqual({ art: 'wahl' });
    await check({ aktion: 'wahl', sitzung: s2, token: t2, wahl: 'ergebnis' });
    const r = await check({ aktion: 'ergebnis', sitzung: s2, token: t2 });
    expect(r.status).toBe(200);
    expect(r.d.kontakt).toBe('uebersprungen');
    expect((await kontakte()).length).toBe(vorher);
    expect((await bestand()).sitzungen.find(x => x.id === s2)!.crm).toBeUndefined();
  });
});

describe('Datenschutz', () => {
  it('Art. 17: Sitzungen mit einer Adresse der Person fallen weg', async () => {
    const { WEITERE_SPEICHER } = await import('@/lib/crm/person-weitere');
    const w = WEITERE_SPEICHER.find(x => x.name === 'check-sitzungen')!;
    const b = await bestand();
    const r = w.wirkung(b as never, { id: 'c-test', name: 'Testa Probe', emails: ['testa.probe@example.invalid'], fingerabdruecke: [] }) as unknown as { neu: CheckBestand; n: number };
    expect(r.n).toBeGreaterThan(0);
    expect(r.neu.sitzungen.some(s => s.kontakt?.email === 'testa.probe@example.invalid')).toBe(false);
    expect(r.neu.sitzungen.length).toBe(b.sitzungen.length - 1);
  });
  it('Löschfrist: ohne Kontakt 30 Tage, mit Kontakt 24 Monate', async () => {
    const { checkAufraeumen } = await import('@/lib/check/speicher');
    const b = await bestand();
    const jetzt = new Date(uhr + 31 * 86_400_000);
    const r = checkAufraeumen(b, jetzt);
    expect(r.bestand.sitzungen.every(s => !!s.kontakt)).toBe(true);
    expect(checkAufraeumen(b, new Date(uhr + 25 * 31 * 86_400_000)).bestand.sitzungen).toHaveLength(0);
  });
  it('Verzeichnis: Verarbeitung erst, wenn der Check eingeschaltet ist', async () => {
    const { verzeichnisVervollstaendigen, VV_CHECK_ID } = await import('@/lib/crm/datenschutz');
    const jetzt = new Date(uhr).toISOString();
    expect(verzeichnisVervollstaendigen([], jetzt).liste.some(v => v.id === VV_CHECK_ID)).toBe(false);
    expect(verzeichnisVervollstaendigen([], jetzt, { check: true }).liste.some(v => v.id === VV_CHECK_ID)).toBe(true);
  });
});

describe('Middleware: nur /check und POST /api/check sind offen', () => {
  let middleware: typeof import('@/middleware').middleware;
  beforeAll(async () => { ({ middleware } = await import('@/middleware')); });
  const offen = (r: Response) => r.headers.get('x-middleware-next') === '1';
  const lauf = (pfad: string, init: { method?: string; headers?: Record<string, string> } = {}) => middleware(new NextRequest(`http://localhost:3001${pfad}`, init as never));
  it('Seite (GET) und Schnittstelle (POST) offen, ohne Köpfe einer Person', async () => {
    expect(offen(await lauf('/check'))).toBe(true);
    const r = await lauf('/api/check', { method: 'POST', headers: { origin: 'http://localhost:3001', host: 'localhost:3001', 'x-make-user': 'kevin' } });
    expect(offen(r)).toBe(true);
    expect(r.headers.get('x-middleware-request-x-make-user')).toBeNull();
  });
  it('alles andere bleibt zu', async () => {
    for (const [p, m] of [['/api/check', 'GET'], ['/api/check/intern', 'GET'], ['/check/x', 'GET'], ['/api/checks', 'POST'], ['/checkliste', 'GET']] as const) {
      const r = await lauf(p, m === 'POST' ? { method: 'POST', headers: { origin: 'http://localhost:3001', host: 'localhost:3001' } } : {});
      expect(offen(r), `${m} ${p}`).toBe(false);
    }
  });
});

describe('Middleware: Schriften der öffentlichen Seiten', () => {
  let middleware: typeof import('@/middleware').middleware;
  beforeAll(async () => { ({ middleware } = await import('@/middleware')); });
  const offen = (r: Response) => r.headers.get('x-middleware-next') === '1';
  const lauf = (pfad: string, method = 'GET') => middleware(new NextRequest(`http://localhost:3001${pfad}`, { method } as never));
  it('eine .woff2 aus public/schriften ist ohne Sitzung lesbar — sonst bekäme der Check HTML statt der Schrift', async () => {
    expect(offen(await lauf('/schriften/schibsted-grotesk-latin.woff2'))).toBe(true);
    expect(offen(await lauf('/schriften/schibsted-grotesk-latin.woff2', 'HEAD'))).toBe(true);
  });
  it('sonst bleibt alles unter /schriften zu', async () => {
    for (const [p, m] of [['/schriften/schibsted-grotesk-latin.woff2', 'POST'], ['/schriften/SCHIBSTED-GROTESK-OFL.txt', 'GET'], ['/schriften/', 'GET'], ['/schriften/x/y.woff2', 'GET'], ['/schriften/..%2Fdaten.woff2', 'GET']] as const) {
      expect(offen(await lauf(p, m)), `${m} ${p}`).toBe(false);
    }
  });
});
