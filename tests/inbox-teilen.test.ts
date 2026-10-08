// Inbox teilen (08.10., ROADMAP_Q4.md › Lücke 6 „Business Couple“): Übergaben (freigegebene Kopie), Team-Postfach mit „wer kümmert sich“,
// Suche über die eigenen Spiegel — rein und von Ende zu Ende mit nachgebautem Anbieter (PostSpeicher, nie ein echter Server).
// Wächter „Sicht X bekommt nichts aus Y“: die zweite Person sieht nie das private Postfach der ersten (auch nicht über Suche oder
// Übergaben), ein Konto mit `finanzRecht: 'business'` bekommt keine Privat-Übergaben, ein fremder Haushalt bekommt nichts, der Dienstweg
// nichts; Schreiben auf fremde Übergaben/Postfächer → 403/404. Erfundene Daten (@example.invalid).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Kontakt } from '@/lib/make-one/crm';
import type { PostSpeicher as PS } from '@/lib/postfach/post-speicher';
import {
  ausschnittUm, bereichZugang, frageSauber, kopiePruefen, markieren, nachrichtTreffer, postfachSichtbar, raumVon, standVon, TeilenFehler,
  uebergabeAnwenden, uebergabeEmpfaenger, uebergabenAufbewahren, uebergabeSichtbar, uebergabeZeile, UEBERGABE_GRENZEN, type Uebergabe, type UebergabeNachricht,
} from '@/lib/inbox/teilen';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/inbox' }));

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-inbox-teilen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-inbox-teilen';
process.env.MAKE_OS_KEY = 'dienst-test-inbox-teilen';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-inbox-teilen-0123456789abcdef';
delete process.env.MAKE_OS_GRABSTEINE_DIR;

const D = 'example.invalid';
const PW_KDV = 'Kennwort-KDV-0815';
const PW_PRIVAT = 'abcd-efgh-ijkl-mnop';
const PW_ZWEI = 'Kennwort-Zwei-4711';
const PW_ZWEI_PRIVAT = 'Kennwort-Zwei-Privat';
type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let inbox: R, gespraech: R, senden: R, postfaecher: R, anhang: R, uebergaben: R, suche: R;
let db: typeof import('@/lib/store/local-db');
let A: typeof import('@/lib/postfach/abgleich');
let T: typeof import('@/lib/postfach/transport');
let P: typeof import('@/lib/postfach/post-speicher');
const server = new Map<string, PS>();

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const dienst = (person: string) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person, 'content-type': 'application/json' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = async (r: Response) => ({ status: r.status, text: await r.clone().text(), d: await r.json().catch(() => ({})) as Record<string, any> });
const GET = (route: R, url: string, h: Record<string, string> = sitzung('kevin')) => route.GET!(new Request(`http://localhost${url}`, { headers: h })).then(j);
const POST = (route: R, url: string, body: unknown, h: Record<string, string> = sitzung('kevin')) => route.POST!(new Request(`http://localhost${url}`, { method: 'POST', headers: h, body: JSON.stringify(body) })).then(j);
const k = (id: string, vorname: string, nachname: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname, nachname, stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie', ...x } as Kontakt);
const konto = (id: string, speicher: string, name: string, rolle: string, haushalt: string, extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@${D}`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt, ...extra });
const KONTEN = { konten: [
  konto('k1', 'kevin', 'Erster Beispiel', 'inhaber', 'h'),
  konto('k2', 'malin', 'Zweite Beispiel', 'mitglied', 'h'),
  konto('k3', 'partner', 'Partner Beispiel', 'mitglied', 'h', { finanzRecht: 'business' }),
  konto('k4', 'fremd', 'Fremd Beispiel', 'mitglied', 'anderer-haushalt'),
], einladungen: [] };
const PRIVAT_MARKE = 'PRIVAT-Geburtstag-Teilen';

beforeAll(async () => {
  db = await import('@/lib/store/local-db'); A = await import('@/lib/postfach/abgleich'); T = await import('@/lib/postfach/transport'); P = await import('@/lib/postfach/post-speicher');
  inbox = await import('../app/api/inbox/route') as R; gespraech = await import('../app/api/inbox/gespraech/route') as R; senden = await import('../app/api/inbox/senden/route') as R;
  postfaecher = await import('../app/api/inbox/postfaecher/route') as R; anhang = await import('../app/api/inbox/anhang/route') as R;
  uebergaben = await import('../app/api/inbox/uebergaben/route') as R; suche = await import('../app/api/inbox/suche/route') as R;
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  T.transportSetzen(null); rmSync(ordner, { recursive: true, force: true });
});

const anbieter = (benutzer: string): PS => {
  const s = server.get(benutzer);
  if (!s) throw new T.PostfachFehler('netz', 'Server unbekannt', 503);
  return s;
};

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.stubEnv('GOOGLE_CLIENT_ID', ''); vi.stubEnv('GOOGLE_CLIENT_SECRET', ''); vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubGlobal('fetch', async () => { throw new Error('kein Netz im Test'); });
  (await import('@/lib/store/leseprotokoll')).leseDrosselLeeren();
  server.clear();
  server.set(`eins.kdv@firma.${D}`, new P.PostSpeicher({ passwort: PW_KDV, ordner: [{ pfad: 'INBOX' }, { pfad: 'Gesendete Objekte' }] }));
  server.set('eins.privat', new P.PostSpeicher({ passwort: PW_PRIVAT }));
  server.set(`zwei@firma.${D}`, new P.PostSpeicher({ passwort: PW_ZWEI, ordner: [{ pfad: 'INBOX' }, { pfad: 'Gesendete Objekte' }] }));
  server.set(`zwei.privat@privat.${D}`, new P.PostSpeicher({ passwort: PW_ZWEI_PRIVAT, ordner: [{ pfad: 'INBOX' }, { pfad: 'Gesendete Objekte' }] }));
  T.transportSetzen({
    imap: z => anbieter(z.benutzer).sitzung(z),
    smtp: (z, u, roh) => anbieter(z.benutzer === 'eins.privat@icloud.com' ? 'eins.privat' : z.benutzer).senden(z, u, roh),
    waechter: async (z, _p, neu) => ({ stop: async () => { anbieter(z.benutzer).beobachten(neu)(); } }),
  });
  await db.saveJson('konten', KONTEN);
  await db.saveJson('kontakte', { kontakte: [k('c-anna', 'Anna', 'Schmidt', { email: `anna@kunde.${D}` })] });
  await db.saveJson('crm', { firmen: [], chancen: [], mandate: [], followups: [], kampagnen: [], events: [], beitraege: [], teilnahmen: [] });
  const kdv = server.get(`eins.kdv@firma.${D}`)!;
  kdv.ablegen('INBOX', P.rohNachricht({ von: `Anna Schmidt <anna@kunde.${D}>`, an: `eins.kdv@firma.${D}`, betreff: 'Angebot Müller', text: 'Können Sie bis Freitag ein Angebot für Müller schicken?', messageId: `<a1@kunde.${D}>`, anhang: { name: 'Anfrage.pdf', typ: 'application/pdf', inhalt: 'PDF-ANFRAGE' } }));
  kdv.ablegen('INBOX', P.rohNachricht({ von: `Bernd <bernd@lieferant.${D}>`, an: `eins.kdv@firma.${D}`, betreff: 'Lieferung', text: 'Die Ware kommt Montag.', messageId: `<b1@lieferant.${D}>` }));
  server.get('eins.privat')!.ablegen('INBOX', P.rohNachricht({ von: `Freundin <freundin@privat.${D}>`, an: 'eins.privat@icloud.com', betreff: PRIVAT_MARKE, text: 'Kommst du zur Feier?', messageId: `<p1@${D}>` }));
});

async function verbinden(): Promise<{ kdv: string; privat: string }> {
  const a = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `eins.kdv@firma.${D}`, passwort: PW_KDV, bereich: 'kdv', anzeigename: 'KD Ventures' });
  const b = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'icloud', adresse: 'eins.privat@icloud.com', passwort: PW_PRIVAT, bereich: 'privat', anzeigename: 'Privat · iCloud' });
  expect(a.status, a.text).toBe(200); expect(b.status, b.text).toBe(200);
  await A.imapAbgleichen('kevin', a.d.id); await A.imapAbgleichen('kevin', b.d.id);
  return { kdv: a.d.id, privat: b.d.id };
}
async function zweiteVerbinden(): Promise<{ business: string; privat: string }> {
  const a = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `zwei@firma.${D}`, passwort: PW_ZWEI, bereich: 'ug', anzeigename: 'MAKE' }, sitzung('malin'));
  const b = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `zwei.privat@privat.${D}`, passwort: PW_ZWEI_PRIVAT, bereich: 'privat', anzeigename: 'Zwei Privat' }, sitzung('malin'));
  expect(a.status, a.text).toBe(200); expect(b.status, b.text).toBe(200);
  return { business: a.d.id, privat: b.d.id };
}
const gespraecheVon = async (person: string, q = '') => (await GET(inbox, `/api/inbox${q}`, sitzung(person))).d.gespraeche as { id: string; betreff: string; postfachId: string; team?: { stand: string; kuemmert?: { person: string }; postfach?: { besitzer: string } }; wiedervorlage?: string }[];
const angebot = async (person = 'kevin') => (await gespraecheVon(person)).find(g => g.betreff === 'Angebot Müller')!;
const privatGespraech = async () => (await gespraecheVon('kevin')).find(g => g.betreff === PRIVAT_MARKE)!;

// ── Rein ────────────────────────────────────────────────────────────────────

const nachricht = (x: Partial<UebergabeNachricht> = {}): UebergabeNachricht => ({ id: 'n1', am: '2026-10-08T08:00:00.000Z', von: { email: `a@${D}` }, an: [], cc: [], betreff: 'Hallo', text: 'Text', vonUns: false, anhaenge: [], ...x });
const ub = (x: Partial<Uebergabe> = {}): Uebergabe => ({
  id: 'ub-1', von: 'kevin', an: 'malin', gespraech: 'gm~abc', quelle: 'gmail', postfachId: 'gmail', bereich: 'kdv', betreff: 'Hallo', gegenueber: { email: `a@${D}` },
  kuemmert: 'malin', status: 'offen', angelegtAm: '2026-10-08T08:00:00.000Z', kopieAm: '2026-10-08T08:00:00.000Z', geaendertAm: '2026-10-08T08:00:00.000Z',
  nachrichten: [nachricht()], verlauf: [], ...x,
});

describe('Regeln (rein)', () => {
  it('Raum und Zugang: ohne Bereich streng Privat; Business für jedes Konto, Privat nie für finanzRecht business', () => {
    expect(raumVon(null)).toBe('privat');
    expect(raumVon('privat')).toBe('privat');
    expect(raumVon('kdv')).toBe('business');
    expect(raumVon('g-abcd-1234')).toBe('business');
    expect(bereichZugang({}, 'privat')).toBe(true);
    expect(bereichZugang({ finanzRecht: 'business' }, 'privat')).toBe(false);
    expect(bereichZugang({ finanzRecht: 'business' }, null)).toBe(false);
    expect(bereichZugang({ finanzRecht: 'business' }, 'kdv')).toBe(true);
  });
  it('postfachSichtbar: eigenes immer; fremdes nur geteilt + IMAP + Business — ein Privat-Postfach bleibt privat, auch wenn „geteilt“ im Bestand stünde', () => {
    const b = { speicher: 'malin' };
    expect(postfachSichtbar({ quelle: 'imap', bereich: 'privat' }, 'malin', b)).toBe(true);
    expect(postfachSichtbar({ quelle: 'imap', bereich: 'kdv' }, 'kevin', b)).toBe(false);
    expect(postfachSichtbar({ quelle: 'imap', bereich: 'kdv', geteilt: true }, 'kevin', b)).toBe(true);
    expect(postfachSichtbar({ quelle: 'imap', bereich: 'privat', geteilt: true }, 'kevin', b)).toBe(false);
    expect(postfachSichtbar({ quelle: 'imap', bereich: null, geteilt: true }, 'kevin', b)).toBe(false);
    expect(postfachSichtbar({ quelle: 'gmail', bereich: 'kdv', geteilt: true }, 'kevin', b)).toBe(false);
    expect(postfachSichtbar({ quelle: 'imap', bereich: 'kdv', geteilt: true }, 'kevin', { speicher: 'partner', finanzRecht: 'business' })).toBe(true);
  });
  it('Übergaben: Sicht und Empfänger je Bereich', () => {
    const team = [{ speicher: 'kevin' }, { speicher: 'malin' }, { speicher: 'partner', finanzRecht: 'business' as const }];
    expect(uebergabeEmpfaenger(team, 'kevin', 'privat').map(p => p.speicher)).toEqual(['malin']);
    expect(uebergabeEmpfaenger(team, 'kevin', 'kdv').map(p => p.speicher)).toEqual(['malin', 'partner']);
    expect(uebergabeSichtbar(ub({ bereich: 'privat', an: 'partner' }), { speicher: 'partner', finanzRecht: 'business' })).toBe(false);
    expect(uebergabeSichtbar(ub({ bereich: 'kdv', an: 'partner' }), { speicher: 'partner', finanzRecht: 'business' })).toBe(true);
    expect(uebergabeSichtbar(ub(), { speicher: 'fremd' })).toBe(false);
    expect(uebergabeSichtbar(ub(), { speicher: 'kevin' })).toBe(true);
  });
  it('Übergabe-Aktionen: wer darf was, Status-Folgen, Grenzen', () => {
    const j = '2026-10-09T10:00:00.000Z';
    expect(() => uebergabeAnwenden(ub(), { art: 'zurueck' }, 'kevin', j)).toThrow(TeilenFehler);
    expect(() => uebergabeAnwenden(ub(), { art: 'erledigt' }, 'fremd', j)).toThrow(/gehört dir nicht/);
    const z = uebergabeAnwenden(ub(), { art: 'zurueck', notiz: ' Bitte du ' }, 'malin', j);
    expect(z).toMatchObject({ status: 'zurueck', kuemmert: 'kevin', zurueckNotiz: 'Bitte du' });
    expect(() => uebergabeAnwenden(z, { art: 'zurueck' }, 'malin', j)).toThrow(/nicht mehr offen/);
    const w = uebergabeAnwenden(z, { art: 'wieder', notiz: 'Nochmal' }, 'kevin', j);
    expect(w).toMatchObject({ status: 'offen', kuemmert: 'malin', notiz: 'Nochmal' });
    expect(w.zurueckNotiz).toBeUndefined();
    const e = uebergabeAnwenden(w, { art: 'erledigt' }, 'malin', j);
    expect(e).toMatchObject({ status: 'erledigt', erledigtAm: j });
    expect(() => uebergabeAnwenden(e, { art: 'erledigt' }, 'kevin', j)).toThrow(/Schon erledigt/);
    expect(() => uebergabeAnwenden(ub(), { art: 'kuemmert', wer: 'partner' }, 'kevin', j)).toThrow(/beiden Personen/);
    expect(() => uebergabeAnwenden(ub(), { art: 'aktualisiert', nachrichten: [nachricht()] }, 'malin', j)).toThrow(/übergeben hat/);
    expect(() => uebergabeAnwenden(ub(), { art: 'zurueck', notiz: 'x'.repeat(UEBERGABE_GRENZEN.notiz + 1) }, 'malin', j)).toThrow(expect.objectContaining({ status: 413 }));
    expect(() => kopiePruefen(Array.from({ length: UEBERGABE_GRENZEN.nachrichten + 1 }, () => nachricht()))).toThrow(expect.objectContaining({ status: 413 }));
    expect(() => kopiePruefen([])).toThrow(expect.objectContaining({ status: 404 }));
    expect(standVon(ub())).not.toBe(standVon(e));
    expect(standVon(undefined)).toBe('0');
  });
  it('Aufbewahrung: erledigte nach 90 Tagen weg, offene bleiben', () => {
    const alt = ub({ id: 'ub-alt', status: 'erledigt', erledigtAm: '2026-06-01T00:00:00.000Z' });
    const neu = ub({ id: 'ub-neu', status: 'erledigt', erledigtAm: '2026-10-01T00:00:00.000Z' });
    const offen = ub({ id: 'ub-offen', angelegtAm: '2025-01-01T00:00:00.000Z' });
    expect(uebergabenAufbewahren([alt, neu, offen], new Date('2026-10-08T12:00:00Z')).map(u => u.id)).toEqual(['ub-neu', 'ub-offen']);
  });
  it('Suche: EINE Regel (Umlaute, alle Wörter in einer Nachricht), Ort, Ausschnitt, Hervorhebung zurück auf das Original', () => {
    const n = { betreff: 'Angebot', von: { name: 'Anna Schmidt', email: `anna@kunde.${D}` }, an: [{ email: `eins@firma.${D}` }], cc: [], text: `${'Vorlauf '.repeat(40)}Bitte das Angebot für Herrn Müller bis Freitag.${' Nachlauf'.repeat(40)}` };
    expect(nachrichtTreffer(n, 'mueller freitag')).toMatchObject({ wo: 'text' });
    expect(nachrichtTreffer(n, 'mueller freitag')!.ausschnitt).toContain('Müller');
    expect(nachrichtTreffer(n, 'mueller freitag')!.ausschnitt.length).toBeLessThan(200);
    expect(nachrichtTreffer(n, 'angebot')!.wo).toBe('betreff');
    expect(nachrichtTreffer(n, 'schmidt')!.wo).toBe('absender');
    expect(nachrichtTreffer(n, 'mueller gibtsnicht')).toBeNull();
    expect(markieren('Herr Müller kommt', 'mueller').filter(t => t.an).map(t => t.t)).toEqual(['Müller']);
    expect(markieren('Straße und STRASSE', 'strasse').filter(t => t.an).map(t => t.t)).toEqual(['Straße', 'STRASSE']);
    expect(markieren('ohne', 'xyz')).toEqual([{ t: 'ohne', an: false }]);
    expect(ausschnittUm('kurz', 'k')).toBe('kurz');
    expect(frageSauber(' a ')).toBeNull();
    expect(frageSauber('ab')).toBe('ab');
    expect(() => frageSauber('x'.repeat(121))).toThrow(TeilenFehler);
  });
});

describe('Oberfläche (serverseitig gerendert)', () => {
  it('Fach „Übergeben“: „von <Vorname>, Kopie vom …“ mit Notiz; Suche hebt Treffer hervor (auch mit Umlaut)', async () => {
    const { UebergabenKarte } = await import('@/components/os/inbox/Teilen');
    const { Markiert } = await import('@/components/os/inbox/Suche');
    const zeile = uebergabeZeile(ub({ notiz: 'Bitte du übernehmen' }), 'malin', { kevin: 'Erster', malin: 'Zweite' });
    const html = renderToStaticMarkup(createElement(UebergabenKarte, { liste: [zeile], offenId: null, onOeffnen: () => {}, i: 0, person: 'malin' }));
    expect(html).toContain('Übergeben');
    expect(html).toContain('von Erster, Kopie vom 08.10.');
    expect(html).toContain('Bitte du übernehmen');
    expect(renderToStaticMarkup(createElement(UebergabenKarte, { liste: [{ ...zeile, status: 'erledigt' as const }], offenId: null, onOeffnen: () => {}, i: 0, person: 'malin' }))).toBe('');
    const m = renderToStaticMarkup(createElement(Markiert, { text: 'Herr Müller kommt', frage: 'mueller' }));
    expect(m).toMatch(/<mark[^>]*>Müller<\/mark>/);
  });
});

// ── Übergaben von Ende zu Ende ──────────────────────────────────────────────

describe('Übergeben — freigegebene Kopie, nur per Klick', () => {
  it('Kevin übergibt ein Business-Gespräch an Malin: Kopie mit Texten, Anhänge nur als Liste, Glocke ohne Betreff, Protokoll ohne Text', async () => {
    await verbinden();
    const g = await angebot();
    const v = (await GET(gespraech, `/api/inbox/gespraech?id=${encodeURIComponent(g.id)}`)).d;
    expect(v.uebergabe.personen.map((p: { speicher: string }) => p.speicher).sort()).toEqual(['malin', 'partner']);
    const r = await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'malin', notiz: 'Bitte du — ich bin unterwegs.' });
    expect(r.status, r.text).toBe(200);
    const id = r.d.id as string;
    // doppelt → 409
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'malin' })).status).toBe(409);
    // Malin: im Strom als Übergabe (ohne Texte), im Detail die Kopie
    const s = (await GET(inbox, '/api/inbox', sitzung('malin'))).d;
    expect(s.uebergaben).toHaveLength(1);
    expect(s.uebergaben[0]).toMatchObject({ id, rolle: 'erhalten', vonName: 'Erster', notiz: 'Bitte du — ich bin unterwegs.', kuemmert: 'malin', status: 'offen' });
    expect(s.gespraeche).toEqual([]);
    const d = await GET(uebergaben, `/api/inbox/uebergaben?id=${id}`, sitzung('malin'));
    expect(d.status).toBe(200);
    expect(d.d.uebergabe.nachrichten[0].text).toContain('Angebot für Müller');
    expect(d.d.uebergabe.nachrichten[0].anhaenge).toEqual([expect.objectContaining({ name: 'Anfrage.pdf' })]);
    expect(d.text).not.toContain('PDF-ANFRAGE');
    // Glocke: neutral, ohne Betreff
    const gl = JSON.stringify(await db.loadJson('meldungen--malin'));
    expect(gl).toContain('hat dir ein Gespräch übergeben');
    expect(gl).not.toContain('Angebot');
    // Änderungsprotokoll: nur Kennung + Feldnamen
    const prot = readdirSync(ordner).filter(f => f.startsWith('aenderungsprotokoll--'));
    const alles = JSON.stringify(await Promise.all(prot.map(f => db.loadJson(f.replace(/\.json$/, '')))));
    expect(alles).toContain(id);
    expect(alles).not.toContain('unterwegs');
    expect(alles).not.toContain('Müller');
    // Lese-Protokoll: Malin las Kevins Post — Bereich inbox, betroffen kevin, kein Inhalt
    await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
    const lp = JSON.stringify(await Promise.all(readdirSync(ordner).filter(f => f.startsWith('leseprotokoll--')).map(f => db.loadJson(f.replace(/\.json$/, '')))));
    expect(lp).toContain('"bereich":"inbox"');
    expect(lp).toContain('"betroffen":"kevin"');
    expect(lp).not.toContain('Müller');
  });

  it('Privat nur an volle Mitglieder: an das Konto mit finanzRecht business → 403; wird Malin auf Business beschränkt, sieht sie die Privat-Kopie nicht mehr', async () => {
    await verbinden();
    const g = await privatGespraech();
    const v = (await GET(gespraech, `/api/inbox/gespraech?id=${encodeURIComponent(g.id)}`)).d;
    expect(v.uebergabe.personen.map((p: { speicher: string }) => p.speicher)).toEqual(['malin']);
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'partner' })).status).toBe(403);
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'fremd' })).status).toBe(403);
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'kevin' })).status).toBe(403);
    const r = await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'malin' });
    expect(r.status, r.text).toBe(200);
    for (const p of ['partner', 'fremd']) {
      const s = await GET(inbox, '/api/inbox', sitzung(p));
      expect(s.text, p).not.toContain(PRIVAT_MARKE);
      expect((await GET(uebergaben, `/api/inbox/uebergaben?id=${r.d.id}`, sitzung(p))).status, p).toBeGreaterThanOrEqual(403);
    }
    expect((await GET(uebergaben, `/api/inbox/uebergaben?id=${r.d.id}`, sitzung('malin'))).text).toContain(PRIVAT_MARKE);
    // Business-Sicht der Inbox zeigt die Privat-Übergabe nicht
    expect((await GET(inbox, '/api/inbox?space=business', sitzung('malin'))).text).not.toContain(PRIVAT_MARKE);
    // Malin wird auf Business beschränkt → die Privat-Kopie verschwindet (serverseitig, nicht versteckt)
    await db.saveJson('konten', { ...KONTEN, konten: KONTEN.konten.map(x => (x.speicher === 'malin' ? { ...x, finanzRecht: 'business' } : x)) });
    expect((await GET(uebergaben, `/api/inbox/uebergaben?id=${r.d.id}`, sitzung('malin'))).status).toBe(404);
    expect((await GET(inbox, '/api/inbox', sitzung('malin'))).text).not.toContain(PRIVAT_MARKE);
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'erledigt', id: r.d.id }, sitzung('malin'))).status).toBe(404);
  });

  it('zurück, erneut, erledigt (für beide), Stand → 409, fremde Personen → 404, Dienstweg → 403', async () => {
    await verbinden();
    const g = await angebot();
    const id = (await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'malin' })).d.id as string;
    const zeile = async (p: string) => ((await GET(uebergaben, '/api/inbox/uebergaben', sitzung(p))).d.uebergaben as { id: string; status: string; stand: string; kuemmert: string; zurueckNotiz?: string }[]).find(x => x.id === id)!;
    const alt = (await zeile('malin')).stand;
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'zurueck', id, notiz: 'Das kann nur Kevin klären.', stand: alt }, sitzung('malin'))).status).toBe(200);
    expect(await zeile('kevin')).toMatchObject({ status: 'zurueck', kuemmert: 'kevin', zurueckNotiz: 'Das kann nur Kevin klären.' });
    expect(JSON.stringify(await db.loadJson('meldungen--kevin'))).toContain('zurückgegeben');
    // veralteter Stand → 409, nichts geändert
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'wieder', id, stand: alt })).status).toBe(409);
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'wieder', id, stand: (await zeile('kevin')).stand })).status).toBe(200);
    expect((await zeile('malin')).status).toBe('offen');
    // Fremde: anderes Konto im Haushalt sieht die Übergabe nicht (404), anderer Haushalt und Dienstweg 403
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'erledigt', id }, sitzung('partner'))).status).toBe(404);
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'erledigt', id }, sitzung('fremd'))).status).toBe(403);
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'erledigt', id }, dienst('malin'))).status).toBe(403);
    expect((await GET(uebergaben, '/api/inbox/uebergaben', dienst('kevin'))).status).toBe(403);
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'erledigt', id }, sitzung('malin'))).status).toBe(200);
    expect((await zeile('kevin')).status).toBe('erledigt');
    expect((await zeile('malin')).status).toBe('erledigt');
  });

  it('Kopie aktualisieren: neue Nachrichten wandern NICHT von selbst mit — erst auf Klick der übergebenden Person', async () => {
    const { kdv } = await verbinden();
    const g = await angebot();
    const id = (await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'malin' })).d.id as string;
    server.get(`eins.kdv@firma.${D}`)!.ablegen('INBOX', P.rohNachricht({ von: `anna@kunde.${D}`, an: `eins.kdv@firma.${D}`, betreff: 'Re: Angebot Müller', text: 'NEU-NACHGEREICHT', messageId: `<a2@kunde.${D}>`, inReplyTo: `<a1@kunde.${D}>`, references: [`<a1@kunde.${D}>`] }));
    await A.imapAbgleichen('kevin', kdv);
    expect((await GET(uebergaben, `/api/inbox/uebergaben?id=${id}`, sitzung('malin'))).text).not.toContain('NEU-NACHGEREICHT');
    expect((await GET(uebergaben, `/api/inbox/uebergaben?id=${id}`)).d.neuer).toBe(1);
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'aktualisieren', id }, sitzung('malin'))).status).toBe(403);
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'aktualisieren', id })).status).toBe(200);
    expect((await GET(uebergaben, `/api/inbox/uebergaben?id=${id}`, sitzung('malin'))).text).toContain('NEU-NACHGEREICHT');
  });

  it('Antworten nur aus einem EIGENEN Postfach desselben Raums: Re: + In-Reply-To aus der Kopie; Privat-Postfach für Business-Übergabe → 403', async () => {
    await verbinden();
    const zwei = await zweiteVerbinden();
    const g = await angebot();
    const id = (await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'malin' })).d.id as string;
    const d = (await GET(uebergaben, `/api/inbox/uebergaben?id=${id}`, sitzung('malin'))).d;
    expect(d.postfaecher.map((p: { id: string }) => p.id)).toEqual([zwei.business]);
    expect((await POST(senden, '/api/inbox/senden', { uebergabe: id, postfach: zwei.privat, text: 'Hallo' }, sitzung('malin'))).status).toBe(403);
    // Kevins Postfach ist nicht Malins → 403
    const kdvId = (await gespraecheVon('kevin')).find(x => x.betreff === 'Angebot Müller')!.postfachId;
    expect((await POST(senden, '/api/inbox/senden', { uebergabe: id, postfach: kdvId, text: 'Hallo' }, sitzung('malin'))).status).toBe(403);
    // Kevin selbst antwortet nicht über die Übergabe (er hat das Original)
    expect((await POST(senden, '/api/inbox/senden', { uebergabe: id, postfach: kdvId, text: 'Hallo' })).status).toBe(403);
    const r = await POST(senden, '/api/inbox/senden', { uebergabe: id, postfach: zwei.business, text: 'Gern, das kommt bis Freitag.', anfrageId: 'anf-22222222-2222-4333-8444-555555555555' }, sitzung('malin'));
    expect(r.status, r.text).toBe(200);
    const s = server.get(`zwei@firma.${D}`)!;
    expect(s.gesendet).toHaveLength(1);
    expect(s.gesendet[0]).toMatchObject({ von: `zwei@firma.${D}`, an: [`anna@kunde.${D}`] });
    const roh = s.gesendet[0].roh.toString();
    expect(roh).toContain(`In-Reply-To: <a1@kunde.${D}>`);
    // Betreff „Re: Angebot Müller“ (mit Umlaut als RFC 2047 kodiert)
    const betreff = /^Subject: (.*)$/m.exec(roh)![1];
    expect(betreff.startsWith('Re: ') || /^=\?UTF-8\?[QB]\?/i.test(betreff)).toBe(true);
    expect((await import('@/lib/gmail/mime')).rfc2047Lesen(betreff)).toBe('Re: Angebot Müller');
    expect(server.get(`eins.kdv@firma.${D}`)!.gesendet).toHaveLength(0);
    const u = (await GET(uebergaben, `/api/inbox/uebergaben?id=${id}`)).d.uebergabe;
    expect(u.verlauf.map((x: { was: string }) => x.was)).toEqual(['uebergeben', 'geantwortet']);
  });
});

// ── Team-Postfach ───────────────────────────────────────────────────────────

describe('Team-Postfach — mit dem Team teilen, „wer kümmert sich“', () => {
  it('nur IMAP mit Business-Bereich und nur der Besitzer; Malin und das Business-Konto sehen es, ein fremder Haushalt nie; Privat bleibt privat (auch manipuliert)', async () => {
    const { kdv, privat } = await verbinden();
    expect((await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'einstellen', id: privat, geteilt: true })).status).toBe(400);
    // Malin kann Kevins Postfach nicht teilen (nicht ihr Register) → 404
    expect((await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'einstellen', id: kdv, geteilt: true }, sitzung('malin'))).status).toBe(404);
    expect((await gespraecheVon('malin')).length).toBe(0);
    expect((await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'einstellen', id: kdv, geteilt: true })).status).toBe(200);
    // Privat-Bereich für ein geteiltes Postfach → 400
    expect((await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'einstellen', id: kdv, bereich: 'privat' })).status).toBe(400);
    for (const p of ['malin', 'partner']) {
      const l = await gespraecheVon(p);
      expect(l.map(g => g.betreff).sort(), p).toEqual(['Angebot Müller', 'Lieferung']);
      expect(l[0].team?.postfach?.besitzer).toBe('kevin');
      expect(JSON.stringify(l)).not.toContain(PRIVAT_MARKE);
    }
    expect((await GET(inbox, '/api/inbox?space=privat', sitzung('malin'))).d.gespraeche).toEqual([]);
    expect((await GET(inbox, '/api/inbox', sitzung('fremd'))).status).toBe(403);
    // Postfach-Verwaltung: Malin sieht es unter „mit dir geteilt“, nicht als eigenes; Passwort nie
    const pv = await GET(postfaecher, '/api/inbox/postfaecher', sitzung('malin'));
    expect(pv.d.postfaecher).toEqual([]);
    expect(pv.d.mitDirGeteilt).toEqual([expect.objectContaining({ id: kdv, besitzerName: 'Erster' })]);
    expect(pv.text).not.toContain(PW_KDV);
    // Manipuliert: „geteilt“ am Privat-Postfach direkt im Bestand → Malin sieht trotzdem nichts
    const reg = (await db.loadJson<{ v: 1; postfaecher: { id: string; geteilt?: boolean }[] }>('postfaecher--kevin'))!;
    await db.saveJson('postfaecher--kevin', { ...reg, postfaecher: reg.postfaecher.map(p => (p.id === privat ? { ...p, geteilt: true } : p)) });
    expect((await GET(inbox, '/api/inbox', sitzung('malin'))).text).not.toContain(PRIVAT_MARKE);
    expect((await GET(suche, `/api/inbox/suche?q=${encodeURIComponent('Feier')}`, sitzung('malin'))).d.gesamt).toBe(0);
    const pg = await privatGespraech();
    expect((await GET(gespraech, `/api/inbox/gespraech?id=${encodeURIComponent(pg.id)}`, sitzung('malin'))).status).toBe(404);
  });

  it('gemeinsamer Zustand: Wiedervorlage gilt für alle; „wer kümmert sich“ mit Stand (409), nur Personen mit Zugang; Glocke an die Person', async () => {
    const { kdv } = await verbinden();
    await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'einstellen', id: kdv, geteilt: true });
    const g = await angebot('malin');
    expect((await POST(inbox, '/api/inbox', { aktion: 'spaeter', id: g.id, bis: '2099-01-01' }, sitzung('malin'))).status).toBe(200);
    expect((await angebot('kevin')).wiedervorlage).toBe('2099-01-01');
    const stand = (await angebot('malin')).team!.stand;
    expect((await POST(inbox, '/api/inbox', { aktion: 'kuemmert', id: g.id, wer: 'fremd', stand }, sitzung('malin'))).status).toBe(400);
    const r = await POST(inbox, '/api/inbox', { aktion: 'kuemmert', id: g.id, wer: 'partner', stand }, sitzung('malin'));
    expect(r.status, r.text).toBe(200);
    expect(JSON.stringify(await db.loadJson('meldungen--partner'))).toContain('Team-Postfach');
    // Kevin mit dem alten Stand → 409 mit dem aktuellen
    const k409 = await POST(inbox, '/api/inbox', { aktion: 'kuemmert', id: g.id, wer: 'kevin', stand });
    expect(k409.status).toBe(409);
    expect(k409.d.zustand.kuemmert.person).toBe('partner');
    expect((await angebot('kevin')).team!.kuemmert!.person).toBe('partner');
    expect((await POST(inbox, '/api/inbox', { aktion: 'kuemmert', id: g.id, wer: 'kevin', stand: k409.d.stand })).status).toBe(200);
    // eigenes (nicht geteiltes) Gespräch hat kein „wer kümmert sich“ → 400
    const pg = await privatGespraech();
    expect((await POST(inbox, '/api/inbox', { aktion: 'kuemmert', id: pg.id, wer: 'kevin', stand: '0' })).status).toBe(400);
  });

  it('Malin antwortet ALS das Team-Postfach (Zugang des Besitzers), im Änderungsprotokoll steht Malin; Anhang über den Besitzer; Teilen aus → weg, Zustand zurück beim Besitzer', async () => {
    const { kdv } = await verbinden();
    await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'einstellen', id: kdv, geteilt: true });
    const g = await angebot('malin');
    const r = await POST(senden, '/api/inbox/senden', { gespraech: g.id, text: 'Kommt bis Freitag.' }, sitzung('malin'));
    expect(r.status, r.text).toBe(200);
    const s = server.get(`eins.kdv@firma.${D}`)!;
    expect(s.gesendet).toHaveLength(1);
    expect(s.gesendet[0].von).toBe(`eins.kdv@firma.${D}`);
    const prot = readdirSync(ordner).filter(f => f.startsWith('aenderungsprotokoll--'));
    const eintraege = (await Promise.all(prot.map(f => db.loadJson<{ eintraege: { person?: string; felder?: string[]; bestand: string }[] }>(f.replace(/\.json$/, ''))))).flatMap(x => x?.eintraege ?? []);
    expect(eintraege.some(e => e.bestand === 'inbox' && e.person === 'malin' && e.felder?.includes('team-postfach'))).toBe(true);
    // Anhang des Team-Postfachs: ja; Anhang aus Kevins Privat-Postfach: nie
    const v = (await GET(gespraech, `/api/inbox/gespraech?id=${encodeURIComponent(g.id)}`, sitzung('malin'))).d;
    const n = v.nachrichten.find((x: { anhaenge: unknown[] }) => x.anhaenge.length);
    const a = await anhang.GET!(new Request(`http://localhost/api/inbox/anhang?nachricht=${encodeURIComponent(n.id)}&teil=${n.anhaenge[0].teil}`, { headers: sitzung('malin') }));
    expect(a.status).toBe(200);
    expect(Buffer.from(await a.arrayBuffer()).toString()).toBe('PDF-ANFRAGE');
    // Wiedervorlage im gemeinsamen Zustand, dann Teilen aus → Malin sieht nichts mehr, Kevin behält die Wiedervorlage
    await POST(inbox, '/api/inbox', { aktion: 'spaeter', id: g.id, bis: '2099-02-02' }, sitzung('malin'));
    expect((await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'einstellen', id: kdv, geteilt: false })).status).toBe(200);
    expect(await gespraecheVon('malin')).toEqual([]);
    expect((await GET(gespraech, `/api/inbox/gespraech?id=${encodeURIComponent(g.id)}`, sitzung('malin'))).status).toBe(404);
    expect((await angebot('kevin')).wiedervorlage).toBe('2099-02-02');
    expect((await angebot('kevin')).team).toBeUndefined();
  });
});

// ── Suche ───────────────────────────────────────────────────────────────────

describe('Suche über die eigenen Spiegel', () => {
  it('findet Betreff, Absender und Text (Umlaute), nur Eigenes — Malin findet Kevins Post nie, ein Begriff steht in keinem Protokoll', async () => {
    await verbinden();
    const t = await GET(suche, `/api/inbox/suche?q=${encodeURIComponent('mueller freitag')}`);
    expect(t.status).toBe(200);
    expect(t.d.treffer).toEqual([expect.objectContaining({ art: 'gespraech', betreff: 'Angebot Müller', wo: 'betreff' })]);
    expect((await GET(suche, '/api/inbox/suche?q=Feier')).d.treffer[0].betreff).toBe(PRIVAT_MARKE);
    expect((await GET(suche, '/api/inbox/suche?q=Feier&space=business')).d.gesamt).toBe(0);
    expect((await GET(suche, '/api/inbox/suche?q=bernd')).d.treffer[0]).toMatchObject({ betreff: 'Lieferung', wo: 'absender' });
    for (const p of ['malin', 'partner']) {
      for (const q of ['Feier', 'mueller', 'Lieferung', 'freundin']) expect((await GET(suche, `/api/inbox/suche?q=${q}`, sitzung(p))).d.gesamt, `${p}/${q}`).toBe(0);
    }
    expect((await GET(suche, '/api/inbox/suche?q=Feier', sitzung('fremd'))).status).toBe(403);
    expect((await GET(suche, '/api/inbox/suche?q=Feier', dienst('kevin'))).status).toBe(403);
    expect((await GET(suche, '/api/inbox/suche?q=x')).d).toMatchObject({ gesamt: 0, hinweis: expect.any(String) });
    // Lese-Protokoll: Bereich + Anzahl, nie der Suchbegriff
    await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
    const lp = JSON.stringify(await Promise.all(readdirSync(ordner).filter(f => f.startsWith('leseprotokoll--')).map(f => db.loadJson(f.replace(/\.json$/, '')))));
    expect(lp).toContain('"bereich":"inbox"');
    expect(lp).not.toMatch(/mueller|Feier|bernd/i);
  });

  it('Übergaben und Team-Postfächer sind für die Empfängerin durchsuchbar; die Grenze je Seite mit „mehr …“ (nie still gekürzt)', async () => {
    const { kdv } = await verbinden();
    const g = await privatGespraech();
    await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'malin' });
    expect((await GET(suche, '/api/inbox/suche?q=Feier', sitzung('malin'))).d.treffer).toEqual([expect.objectContaining({ art: 'uebergabe', von: 'Erster' })]);
    // viele Gespräche im Team-Postfach → Seiten
    const s = server.get(`eins.kdv@firma.${D}`)!;
    for (let i = 0; i < 45; i++) s.ablegen('INBOX', P.rohNachricht({ von: `kunde${i}@kunde.${D}`, an: `eins.kdv@firma.${D}`, betreff: `Rundfrage ${i}`, text: 'Rundfrage zum Termin', messageId: `<r${i}@kunde.${D}>` }));
    await A.imapAbgleichen('kevin', kdv);
    await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'einstellen', id: kdv, geteilt: true });
    const s1 = (await GET(suche, '/api/inbox/suche?q=rundfrage', sitzung('malin'))).d;
    expect(s1.gesamt).toBe(45);
    expect(s1.treffer).toHaveLength(40);
    const s2 = (await GET(suche, '/api/inbox/suche?q=rundfrage&ab=40', sitzung('malin'))).d;
    expect(s2.treffer).toHaveLength(5);
    expect(new Set([...s1.treffer, ...s2.treffer].map((x: { id: string }) => x.id)).size).toBe(45);
  });
});

// ── Art. 15/17 und Konto ─────────────────────────────────────────────────────

describe('Datenschutz: Art. 15/17, Konto-Export und -Löschen', () => {
  it('Art. 15 zählt Übergaben, die eine Person nennen; Art. 17 entfernt sie ganz', async () => {
    await verbinden();
    const g = await angebot();
    await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'malin' });
    const W = await import('@/lib/crm/person-weitere');
    const m = W.merkmaleVon('c-anna', { vorname: 'Anna', nachname: 'Schmidt', email: `anna@kunde.${D}` });
    const auskunft = await W.weitereAufzaehlen(m);
    expect(Object.keys(auskunft).some(n => n.startsWith('inbox-uebergaben--'))).toBe(true);
    const r = await W.weitereEntfernen(m);
    expect(Object.keys(r.speicher).some(n => n.startsWith('inbox-uebergaben--'))).toBe(true);
    expect((await GET(inbox, '/api/inbox', sitzung('malin'))).d.uebergaben).toEqual([]);
  });

  it('Löschfrist: erledigte Übergaben 90 Tage nach „Erledigt“ weg (täglicher Lauf), offene bleiben', async () => {
    await db.saveJson('inbox-uebergaben--h', { v: 1, uebergaben: [
      ub({ id: 'ub-alt', status: 'erledigt', erledigtAm: '2026-01-01T00:00:00.000Z' }), ub({ id: 'ub-offen', angelegtAm: '2025-01-01T00:00:00.000Z' }),
    ] });
    const { uebergabenAufraeumen } = await import('@/lib/inbox/uebergaben-speicher');
    expect(await uebergabenAufraeumen(new Date('2026-10-08T12:00:00Z'))).toBe(1);
    expect((await db.loadJson<{ uebergaben: { id: string }[] }>('inbox-uebergaben--h'))!.uebergaben.map(u => u.id)).toEqual(['ub-offen']);
    expect(await uebergabenAufraeumen(new Date('2026-10-08T12:00:00Z'))).toBe(0);
  });

  it('Konto-Export enthält die eigenen Übergaben; Konto löschen nimmt sie und „wer kümmert sich“ heraus', async () => {
    const { kdv } = await verbinden();
    await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'einstellen', id: kdv, geteilt: true });
    const p = await privatGespraech();
    const ubId = (await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: p.id, an: 'malin' })).d.id as string;
    const g = await angebot('malin');
    await POST(inbox, '/api/inbox', { aktion: 'kuemmert', id: g.id, wer: 'malin', stand: g.team!.stand }, sitzung('malin'));
    const K = await import('@/lib/datenschutz/konto-daten');
    const ex = await K.kontoExport('malin');
    expect(JSON.stringify(ex!.eintraege)).toContain(ubId);
    expect(Object.keys(ex!.eintraege).some(n => n.startsWith('inbox-geteilt--'))).toBe(true);
    const b = await K.kontoLoeschen('malin', { grabstein: false });
    expect(Object.keys(b!.eintraege).some(n => n.startsWith('inbox-uebergaben--'))).toBe(true);
    expect(JSON.stringify(await db.loadJson('inbox-uebergaben--h'))).not.toContain(ubId);
    expect((await angebot('kevin')).team!.kuemmert).toBeUndefined();
  });
});
