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

/**
 * Die 19 Kurzcheck-Antworten (Handwerk, 10–49; seit 30.10. nur Innovation — Sichtbarkeit und Vertrieb haben eigene Checks),
 * Klickwerte 1 bzw. 2 (Beleg C5 als Text, noch unbewertet).
 */
const KURZ: [string, Record<string, unknown>][] = [
  ['A1', { optionIds: ['A1_0'], zusatz: false }], ['A2', { optionIds: ['A2_2'] }], ['A6', { optionIds: ['A6_1'] }],
  ['B1', { optionIds: ['B1_1'] }], ['B2', { optionIds: ['B2_1'] }], ['B4', { optionIds: ['B4_1'] }],
  ['C1', { optionIds: ['C1_1'] }], ['C2', { optionIds: ['C2_1'] }], ['C3', { optionIds: ['C3_1'] }],
  ['C5', { freitext: 'Wir probieren ChatGPT für Angebotstexte aus.' }], ['D1', { optionIds: ['D1_1'] }], ['D2', { optionIds: ['D2_1'] }],
  ['D7', { optionIds: ['D7_1'] }], ['E1', { optionIds: ['E1_1'] }], ['E4', { optionIds: ['E4_2'] }], ['E6', { optionIds: ['E6_1'] }],
  ['G1', { optionIds: ['G1_1'] }], ['G2', { optionIds: ['G2_1'] }], ['G6', { optionIds: ['G6_1'] }],
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
  it('Leitsatz und Angebote je Bereich (30.10.): nur der Inhaber, Links nur /… oder https', async () => {
    expect((await innen({ aktion: 'einstellungen', angebote: { vertrieb: { titel: 'Vertriebsaufbau' } } }, 'malin')).status).toBe(403);
    for (const link of ['javascript:alert(1)', '//fremd.example.invalid/x', 'http://example.invalid/', '/mit leerzeichen']) {
      expect((await innen({ aktion: 'einstellungen', angebote: { vertrieb: { titel: 'Vertriebsaufbau', link } } })).status, link).toBe(400);
    }
    expect((await innen({ aktion: 'einstellungen', angebote: { marketing: { titel: 'x' } } })).status).toBe(400);
    expect((await innen({ aktion: 'einstellungen', claim: 'x'.repeat(81) })).status).toBe(400);
    // Kopf wie auf der Website (30.10.): Logo und Link zur Website nur als /… oder https.
    expect((await innen({ aktion: 'einstellungen', logo: 'javascript:alert(1)' })).status).toBe(400);
    expect((await innen({ aktion: 'einstellungen', website: '//fremd.example.invalid' })).status).toBe(400);
    const k = await innen({ aktion: 'einstellungen', logo: '/assets/zeichen-papier.svg', website: 'https://example.invalid' });
    expect(k.status).toBe(200);
    expect(k.d.einstellungen).toMatchObject({ logo: '/assets/zeichen-papier.svg', website: 'https://example.invalid' });
    const r = await innen({ aktion: 'einstellungen', claim: 'Probe braucht Ruhe.', angebote: {
      vertrieb: { titel: 'Vertriebsaufbau', text: 'Ein Satz zum Angebot.', link: '/vertrieb/' },
      innovation: { titel: 'KI im Alltag', link: 'https://example.invalid/innovation/' },
    } });
    expect(r.status).toBe(200);
    expect(r.d.einstellungen.claim).toBe('Probe braucht Ruhe.');
    expect(r.d.einstellungen.angebote).toEqual({ vertrieb: { titel: 'Vertriebsaufbau', text: 'Ein Satz zum Angebot.', link: '/vertrieb/' }, innovation: { titel: 'KI im Alltag', link: 'https://example.invalid/innovation/' } });
    // Ein Bereich mit leerem Titel fällt weg, die anderen bleiben.
    const weg = await innen({ aktion: 'einstellungen', angebote: { innovation: null } });
    expect(Object.keys(weg.d.einstellungen.angebote)).toEqual(['vertrieb']);
    await innen({ aktion: 'einstellungen', angebote: { innovation: { titel: 'KI im Alltag', link: 'https://example.invalid/innovation/' } } });
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
    expect(r.d.schritt).toEqual({ art: 'frage', frageId: 'A1', phase: 'kurzcheck', nummer: 1, von: 19 });
    expect(r.d.katalog.fragen).toHaveLength(67);
    expect(r.d.zoe.begruessung.join(' ')).toContain('ausführlich mit vollständigem Bericht per E-Mail');
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
    expect((await check({ aktion: 'antwort', sitzung: S, token: T, frage: 'B3', optionIds: ['B3_1'] })).status).toBe(400); // Vertiefung: noch nicht dran
    expect((await check({ aktion: 'antwort', sitzung: S, token: T, frage: 'C5', freitext: 'x'.repeat(2001) })).status).toBe(413);
    expect((await check({ aktion: 'ueberspringen', sitzung: S, token: T, frage: 'B1' })).status).toBe(400); // Klickfrage im Kurzcheck
    expect((await check({ aktion: 'antwort', sitzung: S, token: T, frage: 'C4', optionIds: ['C4_0', 'C4_keine'] })).status).toBe(400);
  });
  it('19 Antworten in beliebiger Reihenfolge erlaubt — der Server sagt, was als Nächstes kommt', async () => {
    let r: Antwort | null = null;
    for (const [frage, a] of KURZ) {
      r = await check({ aktion: 'antwort', sitzung: S, token: T, frage, ...a });
      expect(r.status, frage).toBe(200);
    }
    expect(r!.d.schritt).toEqual({ art: 'kontakt' });
    expect(r!.d.fortschritt.kurz).toBe(19);
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
    expect(s.kontakt).toMatchObject({ email: 'testa.probe@example.invalid', firma: 'Probe Handwerk GmbH', newsletterWunsch: false, hinweisFassung: 'check-hinweis-2' });
    expect(s.antworten.A5?.optionIds).toEqual(['A5_0']);
    expect(s.crm?.status).toBe('ok');
    const p = (await kontakte()).find(x => x.id === s.crm!.kontaktId)!;
    expect(p.email).toBe('testa.probe@example.invalid');
    expect(p.aktivitaeten.some(a => /Innovations-Check auf der Website/.test(a.text ?? ''))).toBe(true);
    expect(p.aktivitaeten.some(a => /Strategie und Führung \d+, KI im Alltag \d+/.test(a.text ?? ''))).toBe(true);
    // Nichts vom CRM-Verweis im Browser.
    expect(JSON.stringify(r.d)).not.toContain(s.crm!.kontaktId!);
  });
  it('Ergebnis: dieselben Zahlen wie die Auswertung, Branchensatz, vorläufig, kein Termin ohne Buchungsseite', async () => {
    const w = await check({ aktion: 'wahl', sitzung: S, token: T, wahl: 'ergebnis' });
    expect(w.d.schritt).toEqual({ art: 'ergebnis' });
    const r = await check({ aktion: 'ergebnis', sitzung: S, token: T });
    expect(r.status).toBe(200);
    const { VORLAGEN } = await import('@/lib/check/katalog');
    const { auswerten, profilAus, saeulenAuswerten } = await import('@/lib/check/auswertung');
    const s = (await bestand()).sitzungen.find(x => x.id === S)!;
    const v = VORLAGEN['innovations-check'];
    const soll = auswerten(v.katalog, v.regeln, profilAus(v.katalog, s.antworten), s.antworten);
    const saeulen = saeulenAuswerten(v.katalog, v.regeln, s.antworten, soll);
    // Nur Innovation (30.10.): Gesamt = Wert der Referenz-Rechnung, Stufe der Innovation.
    expect(saeulen.werte).toEqual({ innovation: soll.gesamt });
    expect(r.d.ansicht.gesamt).toBe(soll.gesamt);
    expect(r.d.ansicht.stufe).toBe(soll.stufe);
    expect(r.d.ansicht.saeulen.map((x: { key: string; wert: number }) => [x.key, x.wert])).toEqual([['innovation', soll.gesamt]]);
    expect(r.d.ansicht.genauigkeit).toBe('vorlaeufig');
    expect(r.d.ansicht.innovation.gesamt).toBe(soll.gesamt);
    expect(r.d.ansicht.innovation.stufe).toBe(soll.stufe);
    // Der Kurzcheck fragt seit 30.10. alle fünf Bereiche ab (Robotik nur in der Vertiefung).
    expect(r.d.ansicht.innovation.achsen.map((a: { key: string }) => a.key)).toEqual(['strategie', 'ki', 'automatisierung', 'daten', 'team']);
    expect(r.d.ansicht.innovation.branchenSatz).toContain('10 bis 49');
    expect(r.d.ansicht.zoe[0]).toContain(`Stufe ${soll.stufe}`);
    // Zwei nächste Schritte für die zwei größten Lücken zur Branche, das Angebot der Instanz am ersten, nie mit Punkten.
    const schritte = r.d.ansicht.schritte as { saeule: string; name: string; text: string; angebot?: { titel: string; link?: string } }[];
    expect(schritte).toHaveLength(2);
    expect(schritte.map(x => x.name)).toEqual(r.d.ansicht.innovation.luecken.slice(0, 2).map((x: { name: string }) => x.name));
    expect(schritte.every(x => x.saeule === 'innovation' && x.text.length > 20)).toBe(true);
    expect(schritte[0].angebot).toEqual({ titel: 'KI im Alltag', link: 'https://example.invalid/innovation/' });
    expect(schritte[1].angebot).toBeUndefined();
    expect(r.d.gespraech.pfad).toBeUndefined();
    expect(s.ergebnis?.saeulen).toEqual({ innovation: soll.gesamt });
    expect(s.ergebnis?.gesamt).toBe(soll.gesamt);
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
  it('Umfang „ausführlich“: nach dem Kurzcheck gleich weiter, „Jetzt auswerten“ beendet vorzeitig, dann Kontakt und Ergebnis', async () => {
    const st = await check({ aktion: 'start', umfang: 'lang' });
    const s2 = st.d.sitzung, t2 = st.d.token;
    expect(st.d.schritt).toMatchObject({ art: 'frage', frageId: 'A1', phase: 'kurzcheck', nummer: 1 });
    expect(st.d.schritt.von).toBeGreaterThan(19);
    let r: Antwort | null = null;
    for (const [frage, a] of KURZ) r = await check({ aktion: 'antwort', sitzung: s2, token: t2, frage, ...a });
    expect(r!.d.schritt).toMatchObject({ art: 'frage', phase: 'vertiefung', nummer: 20 });
    expect((await check({ aktion: 'wahl', sitzung: s2, token: t2, wahl: 'ergebnis' })).d.schritt).toEqual({ art: 'kontakt' });
    expect((await check({ aktion: 'ohne-kontakt', sitzung: s2, token: t2 })).d.schritt).toEqual({ art: 'ergebnis' });
    const e = await check({ aktion: 'ergebnis', sitzung: s2, token: t2 });
    expect(e.status).toBe(200);
    expect(e.d.ansicht.genauigkeit).toBe('vorlaeufig');
    expect((await bestand()).sitzungen.find(x => x.id === s2)!.umfang).toBe('lang');
  });
  it('Umfang „kurz“: nach den Kontaktdaten sofort das Ergebnis, ohne Wahl; unbekannter Umfang = wie bisher', async () => {
    const st = await check({ aktion: 'start', umfang: 'kurz' });
    const s2 = st.d.sitzung, t2 = st.d.token;
    expect(st.d.schritt).toMatchObject({ art: 'frage', frageId: 'A1', von: 19 });
    for (const [frage, a] of KURZ) await check({ aktion: 'antwort', sitzung: s2, token: t2, frage, ...a });
    expect((await check({ aktion: 'ohne-kontakt', sitzung: s2, token: t2 })).d.schritt).toEqual({ art: 'ergebnis' });
    expect((await check({ aktion: 'ergebnis', sitzung: s2, token: t2 })).status).toBe(200);
    const x = await check({ aktion: 'start', umfang: 'riesig' });
    expect((await bestand()).sitzungen.find(y => y.id === x.d.sitzung)!.umfang).toBeUndefined();
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

describe('Vertriebscheck und Sichtbarkeitstest (30.10.)', () => {
  /** 12 Fragen: Profil A1, A2, A6 und je drei Fragen in Organisation (VO), Zahlen (VZ) und Neukunden (VN). */
  const VERTRIEB: [string, string][] = [['A1', 'A1_1'], ['A2', 'A2_1'], ['A6', 'A6_0'], ['V1', 'V1_1'], ['V6', 'V6_1'], ['V4', 'V4_1'], ['V2', 'V2_3'], ['V3', 'V3_3'], ['V7', 'V7_3'], ['V5', 'V5_2'], ['V8', 'V8_2'], ['V9', 'V9_2']];
  it('eigene Vorlage mit eigenen Texten; nach Kontakt sofort das Ergebnis (keine Wahl), Bereiche mit Namen, jedes Angebot nur einmal', async () => {
    const st = await check({ aktion: 'start', vorlage: 'vertriebs-check', quelle: 'vertrieb_seite', webseite: '' });
    expect(st.status).toBe(201);
    expect(st.d.katalog.name).toBe('Vertriebs-Check');
    expect(st.d.schritt).toEqual({ art: 'frage', frageId: 'A1', phase: 'kurzcheck', nummer: 1, von: 12 });
    expect(st.d.zoe.begruessung.join(' ')).toContain('durch den Vertriebs-Check');
    expect(st.d.katalog.abschnittSatz.VO).toContain('organisiert');
    const s3 = st.d.sitzung, t3 = st.d.token;
    for (const [frage, o] of VERTRIEB) expect((await check({ aktion: 'antwort', sitzung: s3, token: t3, frage, optionIds: [o] })).status, frage).toBe(200);
    weiter(60);
    const k = await check({ aktion: 'kontakt', sitzung: s3, token: t3, vorname: 'Vera', email: 'vera.probe@example.invalid', firma: 'Probe Vertrieb GmbH', rolle: 'A5_0', newsletter: false, webseite: '' });
    expect(k.status).toBe(200);
    expect(k.d.schritt).toEqual({ art: 'ergebnis' });
    const r = await check({ aktion: 'ergebnis', sitzung: s3, token: t3 });
    expect(r.status).toBe(200);
    // Organisation (1+1+1)/12 = 25, Zahlen (3+3+3)/12 = 75, Neukunden (2+2+2)/12 = 50 → gesamt 50.
    expect(r.d.ansicht.saeulen.map((x: { name: string; wert: number }) => [x.name, x.wert])).toEqual([['Organisation', 25], ['Zahlen', 75], ['Neukunden', 50]]);
    expect(r.d.ansicht.gesamt).toBe(50);
    expect(r.d.ansicht.stufeName).toBe('Auf Kurs');
    expect(r.d.ansicht.genauigkeit).toBe('genau');
    expect(r.d.ansicht.innovation).toBeNull();
    const schritte = r.d.ansicht.schritte as { saeule: string; name: string; angebot?: { titel: string } }[];
    expect(schritte.map(x => x.saeule)).toEqual(['organisation', 'neukunden']);
    // Beide Bereiche gehören zum Vertriebs-Angebot — es steht nur beim ersten Schritt.
    expect(schritte[0].angebot?.titel).toBe('Vertriebsaufbau');
    expect(schritte[1].angebot).toBeUndefined();
    const s = (await bestand()).sitzungen.find(x => x.id === s3)!;
    expect(s.vorlage).toBe('vertriebs-check');
    expect(s.ergebnis?.saeulen).toEqual({ organisation: 25, zahlen: 75, neukunden: 50 });
    const p = (await kontakte()).find(x => x.id === s.crm!.kontaktId)!;
    expect(p.aktivitaeten.some(a => /Vertriebs-Check auf der Website/.test(a.text ?? '') && /Organisation 25, Zahlen 75, Neukunden 50/.test(a.text ?? ''))).toBe(true);
    const l = await innenLesen();
    const z = l.d.liste.find((x: { id: string }) => x.id === s3);
    expect(z.check).toBe('Vertriebs-Check');
    expect(z.bereiche).toEqual([{ name: 'Organisation', wert: 25 }, { name: 'Zahlen', wert: 75 }, { name: 'Neukunden', wert: 50 }]);
  });
  it('Sichtbarkeitstest startet mit eigenem Katalog; Antworten aus einem anderen Check werden abgelehnt', async () => {
    const st = await check({ aktion: 'start', vorlage: 'sichtbarkeits-test', webseite: '' });
    expect(st.d.katalog.name).toBe('Sichtbarkeits-Check');
    expect(st.d.schritt.von).toBe(12);
    expect((await check({ aktion: 'antwort', sitzung: st.d.sitzung, token: st.d.token, frage: 'V1', optionIds: ['V1_1'] })).status).toBe(400);
  });
  it('Adresse: /check?thema=… wählt den Check, sonst der Innovations-Check', async () => {
    const { vorlageFuerThema, checkPfad } = await import('@/lib/check/katalog');
    expect(vorlageFuerThema('vertrieb')).toBe('vertriebs-check');
    expect(vorlageFuerThema('sichtbarkeit')).toBe('sichtbarkeits-test');
    expect(vorlageFuerThema('unsinn')).toBe('innovations-check');
    expect(vorlageFuerThema(undefined)).toBe('innovations-check');
    expect(checkPfad('vertriebs-check')).toBe('/check?thema=vertrieb');
    expect(checkPfad('innovations-check')).toBe('/check');
  });
  it('Verantwortlich als Abweichung: steht im Hinweis, Link nur https; leer = wieder die Einrichtung', async () => {
    expect((await innen({ aktion: 'einstellungen', datenschutzLink: 'http://example.invalid/datenschutz' })).status).toBe(400);
    const r = await innen({ aktion: 'einstellungen', verantwortlich: 'Probe Holding UG, Probeweg 1, 10000 Probestadt, kontakt@example.invalid', datenschutzLink: 'https://example.invalid/datenschutz/' });
    expect(r.status).toBe(200);
    const st = await check({ aktion: 'start', webseite: '' });
    expect(st.d.hinweis.zeilen[0]).toBe('Verantwortlich: Probe Holding UG, Probeweg 1, 10000 Probestadt, kontakt@example.invalid.');
    expect(st.d.hinweis.link).toBe('https://example.invalid/datenschutz/');
    await innen({ aktion: 'einstellungen', verantwortlich: null, datenschutzLink: null });
    expect((await check({ aktion: 'start', webseite: '' })).d.hinweis.zeilen[0]).toContain('Probe GmbH');
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

describe('Öffentliche Seiten erben nichts vom Grundgerüst der Anwendung (30.10.)', () => {
  it('Check und Buchung heben Beschreibung, Manifest, App-Titel und Icon auf', async () => {
    const { OEFFENTLICH_META } = await import('@/lib/oeffentlich/metadaten');
    expect(OEFFENTLICH_META).toMatchObject({ description: null, manifest: null, appleWebApp: null, icons: null, robots: { index: false, follow: false } });
    const { readFileSync } = await import('node:fs');
    for (const datei of ['app/check/page.tsx', 'app/check/not-found.tsx', 'app/buchen/[slug]/page.tsx', 'app/buchen/[slug]/status/page.tsx', 'app/buchen/[slug]/not-found.tsx']) {
      expect(readFileSync(datei, 'utf8'), datei).toContain('...OEFFENTLICH_META');
    }
  });
});
