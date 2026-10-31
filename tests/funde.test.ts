// ─── Kampagne „Homepage“ (30.10.2026, lib/funde) — rein + von Ende zu Ende ───────────────────────────────────────────────────
// Nachgebautes Postfach (PostSpeicher), nachgebautes OpenStreetMap (`holen`), kein Netz, eigener Datenordner, erfundene Daten (@example.invalid).
// Geprüft: Bewertung/Lesen/Vorschau/Entwurf rein; Rechte (Inhaber, Mitglied, fremder Haushalt, Dienstweg); Abendlauf legt nur Vorschläge (nichts
// in der Kartei, nichts gesendet); Freigabe OHNE „eigenes Risiko“ übernimmt nur (keine Mail); MIT Risiko geht genau eine Mail mit Vorschau-Link,
// Abmeldelink und Datenschutzhinweis; öffentliche Vorschau nur mit gültigem Token; Löschfrist; Art. 17 der Funde.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PostSpeicher as PS } from '@/lib/postfach/post-speicher';
import type { OsmRoh } from '@/lib/funde/osm';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-funde-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-funde';
process.env.MAKE_OS_KEY = 'dienst-test-funde';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-funde-0123456789abcdef';

const D = 'example.invalid';
const PW = 'Geheim-Postfach-4711';
type R = { GET?: (r: Request, c?: unknown) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let funde: R, postfaecher: R, stapel: R, vorschauSeite: R;
let db: typeof import('@/lib/store/local-db');
let T: typeof import('@/lib/postfach/transport');
let P: typeof import('@/lib/postfach/post-speicher');
let server: PS;

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = async (r: Response) => ({ status: r.status, text: await r.clone().text(), d: await r.json().catch(() => ({})) as Record<string, any> });
const GET = (route: R, url: string, h: Record<string, string> = sitzung('kevin')) => route.GET!(new Request(`http://localhost${url}`, { headers: h })).then(j);
const POST = (route: R, url: string, body: unknown, h: Record<string, string> = sitzung('kevin')) => route.POST!(new Request(`http://localhost${url}`, { method: 'POST', headers: h, body: JSON.stringify(body) })).then(j);

const KONTEN = { konten: [
  { id: 'k1', speicher: 'kevin', email: `kevin@${D}`, name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  { id: 'k2', speicher: 'malin', email: `malin@${D}`, name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  { id: 'k4', speicher: 'fremd', email: `fremd@${D}`, name: 'Fremd', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'anderer' },
], einladungen: [] };

const OSM: OsmRoh[] = [
  { osmId: 'n1', name: 'Café Erfunden <b>', branche: 'gastro', kategorie: 'cafe', adresse: { strasse: 'Testweg', hausnummer: '1', plz: '10115', ort: 'Berlin' }, email: `hallo@cafe.${D}`, oeffnungszeiten: 'Mo-Fr 08:00-18:00' },
  { osmId: 'n2', name: 'Imbiss Ohne Mail', branche: 'gastro', telefon: '+49 30 0000000; 0171 0000000' },
  { osmId: 'n3', name: 'Laden Mit Seite', branche: 'gastro', website: `https://laden.${D}`, email: `info@laden.${D}` },
];
const holen = async () => OSM;

beforeAll(async () => {
  db = await import('@/lib/store/local-db'); T = await import('@/lib/postfach/transport'); P = await import('@/lib/postfach/post-speicher');
  funde = await import('../app/api/crm/funde/route') as R;
  postfaecher = await import('../app/api/inbox/postfaecher/route') as R;
  stapel = await import('../app/api/zoe/stapel/route') as R;
  vorschauSeite = await import('../app/vorschau/[token]/route') as R;
});
afterAll(() => { T.transportSetzen(null); rmSync(ordner, { recursive: true, force: true }); });

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.stubEnv('GOOGLE_CLIENT_ID', ''); vi.stubEnv('GOOGLE_CLIENT_SECRET', ''); vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', ''); vi.stubEnv('PAGESPEED_API_KEY', '');
  vi.stubEnv('MAKE_OS_ADRESSE', `https://os.${D}`); vi.stubEnv('ANTHROPIC_API_KEY', '');
  vi.stubGlobal('fetch', async () => { throw new Error('kein Netz im Test'); });
  server = new P.PostSpeicher({ passwort: PW, ordner: [{ pfad: 'INBOX' }, { pfad: 'Gesendete Objekte' }] });
  T.transportSetzen({ imap: z => server.sitzung(z), smtp: (z, u, roh) => server.senden(z, u, roh), waechter: async () => ({ stop: async () => {} }) });
  await db.saveJson('konten', KONTEN);
  await db.saveJson('kontakte', { kontakte: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', { ...leererBestand(), firmen: [{ id: 'f-laden', name: 'Laden Mit Seite', rolle: 'offen', geaendert: '2026-09-01T10:00:00.000Z' }] });
  await db.saveJson('gesellschaften--h', { gesellschaften: [{ id: 'ug', firmierung: 'Beispiel Innovation GmbH', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', email: `info@${D}` }] });
  await db.saveJson('datenschutz-einrichtung', { verantwortlicher: { name: 'Beispiel Innovation GmbH', anschrift: 'Beispielweg 1, 12345 Musterstadt', mail: `datenschutz@${D}` } });
});

async function einrichten() {
  const a = await POST(funde, '/api/crm/funde', { aktion: 'einrichten' });
  expect(a.status, a.text).toBe(200);
  const e = await POST(funde, '/api/crm/funde', { aktion: 'einstellungen', stadt: 'Berlin', gebiete: ['Mitte'] });
  expect(e.status, e.text).toBe(200);
}
async function laufen() {
  const { fundeLauf } = await import('@/lib/funde/lauf');
  return fundeLauf({ person: null, holen });
}
const offeneFundVorschlaege = async () => ((await db.loadJson<{ vorschlaege: { id: string; status: string; bezug?: { art: string; id: string } }[] }>('zoe-stapel'))?.vorschlaege ?? []).filter(v => v.bezug?.art === 'fund' && v.status === 'offen');

// ── Rein ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Regeln (rein)', () => {
  it('Bewertung: ohne Website 100, gute Seite unter der Schwelle, alte Seite darüber; Plattformen zählen nicht als eigene Website', async () => {
    const { bewerten, seiteAuswerten, eigeneWebsite, websiteNormal, mailAusHtml } = await import('@/lib/funde/bewertung');
    const { BEDARF_AB } = await import('@/lib/funde/typen');
    expect(bewerten({ website: false, jahrHeute: 2026, gemessenAm: 'x' }).punkte).toBe(100);
    const gut = seiteAuswerten('<html><meta name="viewport" content="width=device-width"><footer>© 2026 · <a href="/impressum">Impressum</a></footer>', 'https://gut.example.invalid/');
    expect(bewerten({ website: true, signale: gut, pagespeed: 90, jahrHeute: 2026, gemessenAm: 'x' }).punkte).toBeLessThan(BEDARF_AB);
    const alt = seiteAuswerten('<html><body><center><font>Willkommen</font></center> Copyright 2012 <a href="mailto:Info@Alt.example.invalid">Mail</a>', 'http://alt.example.invalid/');
    expect(alt).toMatchObject({ https: false, mobil: false, jahr: 2012, alteTechnik: true, email: 'info@alt.example.invalid' });
    const b = bewerten({ website: true, signale: alt, pagespeed: 20, jahrHeute: 2026, gemessenAm: 'x' });
    expect(b.punkte).toBe(100);
    expect(b.gruende.join(' ')).toMatch(/HTTPS/);
    expect(eigeneWebsite(websiteNormal('facebook.com/cafe'))).toBe(false);
    const { fremdeUnterseite, seitePasstZumNamen } = await import('@/lib/funde/bewertung');
    expect(seitePasstZumNamen('<h1>Trattoria Sole</h1>', 'https://x.example.invalid/', 'Trattoria Sole')).toBe(true);
    expect(seitePasstZumNamen('<h1>Tischlerei Holz</h1>', 'https://holz.example.invalid/', 'Café Mondschein')).toBe(false);
    expect(seitePasstZumNamen('<h1>Willkommen</h1>', 'https://mondschein.example.invalid/', 'Café Mondschein')).toBe(true);
    expect(bewerten({ website: true, signale: { erreichbar: true, https: true, mobil: true, alteTechnik: false, impressum: true, fremd: true }, jahrHeute: 2026, gemessenAm: 'x' }).punkte).toBe(0);
    expect(fremdeUnterseite('https://hotel.example.invalid/standorte/berlin')).toBe(true);
    expect(fremdeUnterseite('https://cafe.example.invalid/')).toBe(false);
    expect(websiteNormal('javascript:alert(1)')).toBeNull();
    expect(mailAusHtml('<a href="mailto:name@domain.de">')).toBeUndefined();
    // Bot-Sperre ist kein Mangel; tote Domain und kaputtes Zertifikat schon — mit eigenem Satz.
    const nichts = { erreichbar: false, https: true, mobil: false, alteTechnik: false, impressum: false };
    expect(bewerten({ website: true, signale: { ...nichts, erreichbar: true, blockiert: true }, jahrHeute: 2026, gemessenAm: 'x' }).punkte).toBe(0);
    expect(bewerten({ website: true, signale: { ...nichts, fehler: 'zertifikat' }, jahrHeute: 2026, gemessenAm: 'x' }).gruende[0]).toMatch(/zertifikat/i);
    expect(bewerten({ website: true, signale: { ...nichts, fehler: 'dns' }, jahrHeute: 2026, gemessenAm: 'x' }).gruende[0]).toMatch(/Domain/);
    const { fehlerArt } = await import('@/lib/funde/web');
    expect(fehlerArt({ cause: { code: 'CERT_HAS_EXPIRED' } })).toBe('zertifikat');
    expect(fehlerArt({ cause: { code: 'ENOTFOUND' } })).toBe('dns');
  });

  it('OSM: Abfrage maskiert, Ketten und Doppelte fallen weg, robots.txt „Disallow: /“ wird erkannt', async () => {
    const { abfrage, antwortLesen } = await import('@/lib/funde/osm');
    const { robotsVerbietet } = await import('@/lib/funde/web');
    expect(abfrage('Ber"lin', 'Mit\\te', 'gastro')).toContain('"Ber\\"lin"');
    const l = antwortLesen({ elements: [
      { type: 'node', id: 1, tags: { name: 'A', amenity: 'cafe', website: 'a.example.invalid' } },
      { type: 'node', id: 1, tags: { name: 'A', amenity: 'cafe' } },
      { type: 'node', id: 2, tags: { name: 'Kette', amenity: 'fast_food', brand: 'Kette' } },
      { type: 'way', id: 3, tags: { amenity: 'cafe' } },
    ] }, 'gastro');
    expect(l.map(x => x.osmId)).toEqual(['n1']);
    expect(robotsVerbietet('User-agent: *\nDisallow: /')).toBe(true);
    expect(robotsVerbietet('User-agent: Googlebot\nDisallow: /\nUser-agent: *\nDisallow: /intern')).toBe(false);
    const { adresseIntern } = await import('@/lib/funde/web');
    expect(adresseIntern('64:ff9b::d9a0:3')).toBe(false);          // 217.160.0.3 — öffentlich
    expect(adresseIntern('64:ff9b::a00:1')).toBe(true);            // 10.0.0.1 — intern
    expect(adresseIntern('64:ff9b::127.0.0.1')).toBe(true);
    expect(adresseIntern('64:ff9b:1::1')).toBe(true);              // anderes Präfix: wie die gemeinsame Regel (fail-closed)
    expect(adresseIntern('127.0.0.1')).toBe(true);
  });

  it('Vorschau maskiert alles und lädt nichts von außen; Entwurf ohne KI, mit Datenschutz, Platzhaltern und Risiko-Hinweis', async () => {
    const { vorschauHtml, vorschauRegelwerk, vorschauAusKi } = await import('@/lib/funde/vorschau');
    const { entwurfBauen, linksEinsetzen, LINK_PLATZHALTER, RISIKO_HINWEIS } = await import('@/lib/funde/entwurf');
    const f = { id: 'fd-1', name: '<script>alert(1)</script>', branche: 'gastro' as const };
    const html = vorschauHtml(f, vorschauAusKi(f, { ueberschrift: '<img src=x>', leistungen: ['a'] }), { absender: 'Beispiel', intern: false });
    expect(html).not.toMatch(/<script|<img|https?:\/\//);
    expect(vorschauRegelwerk(f).ki).toBe(false);
    const e = entwurfBauen({ name: 'Café', quelle: 'osm', bewertung: { punkte: 100, website: false, gruende: [], gemessenAm: 'x' } }, { absender: 'Beispiel GmbH', datenschutz: { mail: `ds@${D}` } });
    expect(e.ki).toBe(false);
    expect(e.text).toContain(LINK_PLATZHALTER);
    expect(e.text).toMatch(/OpenStreetMap/);
    expect(e.text).toMatch(/widersprechen/);
    expect(linksEinsetzen(e.text, 'https://x/vorschau/v1-a', null)).not.toContain(LINK_PLATZHALTER);
    expect(RISIKO_HINWEIS).toMatch(/§ 7 Abs\. 2 UWG/);
  });

  it('Telefon: Handy erkannt und vorn, Erreichbarkeit Handy > Festnetz > Mail > nichts', async () => {
    const { nummernAus, telefonFelder, erreichbarkeit, fundReihenfolge } = await import('@/lib/funde/telefon');
    expect(nummernAus('030 1234567; 0171 2345678')).toEqual([{ nummer: '+491712345678', art: 'mobil' }, { nummer: '+49301234567', art: 'festnetz' }]);
    expect(telefonFelder('+49 (0)30 123456', '0049 160 9876543')).toEqual({ mobil: '+491609876543', telefon: '+4930123456' });
    expect(erreichbarkeit({ mobil: '+4917' })).toBe(100);
    expect(erreichbarkeit({ telefon: '+4930' })).toBe(60);
    expect(erreichbarkeit({ email: 'a@b.de' })).toBe(25);
    const l = [{ angelegt: '1', email: 'a@b.de' }, { angelegt: '2', telefon: '+4930' }, { angelegt: '3', mobil: '+49171' }].sort(fundReihenfolge as never);
    expect(l.map((x: { angelegt: string }) => x.angelegt)).toEqual(['3', '2', '1']);
  });

  it('Website-Analyse: gute Restaurant-Seite nah an unserem Niveau, schwache weit darunter — mit Lücken und Aufhängern', async () => {
    const { merkmaleAus, niveauBerechnen, unterNiveau } = await import('@/lib/funde/analyse');
    const gut = merkmaleAus(`<html><head><title>Trattoria Beispiel — Berlin Mitte</title><meta name="viewport" content="width=device-width"><meta name="description" content="Italienische Küche in Berlin-Mitte, täglich frische Pasta, Mittagstisch und Abendkarte."><meta property="og:image" content="x.jpg">
      <script type="application/ld+json">{"@type":"Restaurant","name":"x"}</script></head><body><h1>Trattoria</h1><a href="/speisekarte">Speisekarte</a> <a href="https://www.quandoo.de/x">Reservieren</a>
      <p>Mo–Fr 12:00 – 22:00 Uhr</p><a href="tel:+4930123">Anrufen</a> <a href="https://maps.google.com/?q=x">Karte</a> <a href="https://instagram.com/x">Insta</a> <a href="/impressum">Impressum</a> <a href="/datenschutz">Datenschutz</a></body></html>`, 'https://trattoria.example.invalid/');
    const a = niveauBerechnen(gut, { leistung: { lcpMs: 1800, quelle: 'chrome' }, jahrHeute: 2026, gemessenAm: 'x' });
    expect(a.niveau).toBeGreaterThanOrEqual(95);
    expect(unterNiveau(a)).toBe(false);
    const schwach = merkmaleAus(`<html><body><center><font>Willkommen</font></center><a href="karte.pdf">Speisekarte</a> 030 123 © 2014
      <link href="https://fonts.googleapis.com/css?family=X" rel="stylesheet"></body></html>`, 'http://alt.example.invalid/');
    const b = niveauBerechnen(schwach, { leistung: { lcpMs: 7000, quelle: 'chrome' }, design: 1, jahrHeute: 2026, gemessenAm: 'x' });
    expect(b.niveau).toBeLessThan(20);
    expect(unterNiveau(b)).toBe(true);
    expect(schwach).toMatchObject({ speisekarteNurPdf: true, googleFontsExtern: true, mobil: false, https: false, jahr: 2014 });
    expect(b.aufhaenger).toHaveLength(3);
    expect(b.luecken.join(' ')).toMatch(/PDF/);
    expect(b.luecken.join(' ')).toMatch(/Google Fonts/);
  });

  it('Löschfrist: nicht übernommene nach der Frist, übernommene nach Ablauf der Vorschau', async () => {
    const { fundeUeberFrist } = await import('@/lib/funde/aufraeumen');
    const f = (id: string, status: string, angelegt: string) => ({ id, kampagneId: 'k', quelle: 'osm', name: id, branche: 'gastro', status, angelegt, geaendert: angelegt }) as never;
    const weg = fundeUeberFrist([f('a', 'vorbereitet', '2026-10-01'), f('b', 'vorbereitet', '2026-10-25'), f('c', 'gesendet', '2026-10-01'), f('d', 'gesendet', '2026-08-01')], '2026-10-30', 21);
    expect(weg.map((x: { id: string }) => x.id)).toEqual(['a', 'd']);
  });

  it('Öffentlicher Pfad: Middleware lässt nur die Token-Form durch (nur GET/HEAD)', () => {
    const mw = readFileSync(path.resolve(__dirname, '../middleware.ts'), 'utf8');
    expect(mw).toContain('const VORSCHAU_OFFEN = /^\\/vorschau\\/v1-[0-9a-f]{32}$/;');
    expect(mw).toMatch(/VORSCHAU_OFFEN\.test\(pfad\) && \(req\.method === 'GET' \|\| req\.method === 'HEAD'\)/);
  });
});

// ── Von Ende zu Ende ──────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Rechte (Trennung auf dem Server)', () => {
  it('fremder Haushalt bekommt nichts; Dienstweg schreibt nichts; nur der Inhaber richtet ein und schaltet das Risiko', async () => {
    expect((await GET(funde, '/api/crm/funde', sitzung('fremd'))).status).toBe(403);
    expect((await POST(funde, '/api/crm/funde', { aktion: 'einrichten' }, sitzung('fremd'))).status).toBe(403);
    expect((await POST(funde, '/api/crm/funde', { aktion: 'einrichten' }, sitzung('malin'))).status).toBe(403);
    expect((await POST(funde, '/api/crm/funde', { aktion: 'einrichten' }, { 'x-make-key': 'dienst-test-funde', 'x-make-person': 'kevin', 'content-type': 'application/json' })).status).toBe(403);
    await einrichten();
    expect((await POST(funde, '/api/crm/funde', { aktion: 'risiko', an: true }, sitzung('malin'))).status).toBe(403);
    const g = await GET(funde, '/api/crm/funde', sitzung('malin'));
    expect(g.status).toBe(200);
    expect(g.d.eingerichtet).toBe(true);
    expect(g.d.absenderWahl).toBeUndefined();
  });
});

describe('Abendlauf, Freigabe, Versand', () => {
  it('Lauf legt nur Vorschläge: Kartei-Firma und Kette bleiben draußen, nichts in der Kartei, nichts gesendet', async () => {
    await einrichten();
    const r = await laufen();
    expect(r).toMatchObject({ ok: true, vorbereitet: 2 });
    const b = await (await import('@/lib/funde/speicher')).ladeFunde();
    expect(b.funde.map(f => f.name).sort()).toEqual(['Café Erfunden <b>', 'Imbiss Ohne Mail']);
    expect(b.funde.every(f => f.status === 'vorbereitet' && f.vorschau && f.entwurf && !f.kontaktId)).toBe(true);
    expect(b.funde.find(f => f.name === 'Imbiss Ohne Mail')).toMatchObject({ mobil: '+491710000000', telefon: '+49300000000' });
    // Die Liste zeigt den Fund mit Handy zuerst.
    expect((await GET(funde, '/api/crm/funde')).d.funde[0].name).toBe('Imbiss Ohne Mail');
    expect(await offeneFundVorschlaege()).toHaveLength(2);
    expect((await db.loadJson<{ kontakte: unknown[] }>('kontakte'))!.kontakte).toHaveLength(0);
    expect(server.gesendet).toHaveLength(0);
    // Ein zweiter Lauf bringt dieselben Betriebe nicht wieder.
    await db.saveJson('kampagne-funde--h', { ...(await db.loadJson<Record<string, unknown>>('kampagne-funde--h')), lauf: undefined });
    expect((await laufen()).vorbereitet).toBe(0);
    // Der Browser bekommt nie den Fingerabdruck eines Tokens.
    const g = await GET(funde, '/api/crm/funde');
    expect(g.text).not.toMatch(/tokenHash/);
  });

  it('Persona-Filter: nur gewählte Arten, nur mit Mail-Adresse', async () => {
    await einrichten();
    expect((await POST(funde, '/api/crm/funde', { aktion: 'einstellungen', arten: ['cafe'], nurMitMail: true })).status).toBe(200);
    const r = await laufen();
    expect(r.vorbereitet).toBe(1);
    const b = await (await import('@/lib/funde/speicher')).ladeFunde();
    expect(b.funde.map(f => f.name)).toEqual(['Café Erfunden <b>']);
    expect(b.einstellungen).toMatchObject({ arten: ['cafe'], nurMitMail: true });
  });

  it('Freigabe ohne „eigenes Risiko“: übernommen (Kontakt, Firma, Label, Kampagne, Follow-up), KEINE Mail', async () => {
    await einrichten();
    await laufen();
    const v = (await offeneFundVorschlaege())[0];
    const f = await POST(stapel, '/api/zoe/stapel', { id: v.id, entscheidung: 'freigeben' });
    expect(f.status, f.text).toBe(200);
    expect(server.gesendet).toHaveLength(0);
    const kk = (await db.loadJson<{ kontakte: { id: string; labels?: string[]; herkunft?: string; fremddaten?: boolean }[] }>('kontakte'))!.kontakte;
    expect(kk).toHaveLength(1);
    expect(kk[0]).toMatchObject({ labels: ['homepage-funnel'], herkunft: 'recherche', fremddaten: true });
    const crm = await (await import('@/lib/crm/speicher')).ladeCrm();
    expect(crm.kampagnen[0].kontaktIds).toEqual([kk[0].id]);
    expect(crm.segmente.some(s => s.id === 'seg-homepage-funnel')).toBe(true);
    expect((crm.followups ?? []).filter(x => x.kontaktId === kk[0].id)).toHaveLength(1);
  });

  it('Freigabe MIT Risiko + Absender: genau eine Mail mit Vorschau-Link, Abmeldelink und Datenschutz; Vorschau öffentlich nur mit Token', async () => {
    await einrichten();
    const pf = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `hallo@firma.${D}`, passwort: PW, bereich: 'ug', anzeigename: 'Vertrieb', absenderName: 'Vertrieb Beispiel' });
    expect(pf.status, pf.text).toBe(200);
    expect((await POST(funde, '/api/crm/funde', { aktion: 'einstellungen', absender: pf.d.id })).status).toBe(200);
    expect((await POST(funde, '/api/crm/funde', { aktion: 'risiko', an: true })).status).toBe(200);
    await laufen();
    const b0 = await (await import('@/lib/funde/speicher')).ladeFunde();
    const cafe = b0.funde.find(x => x.email)!;
    const v = (await offeneFundVorschlaege()).find(x => x.bezug?.id === cafe.id)!;
    // Dienstweg gibt nie frei (der Stapel lässt nur die Person selbst).
    const f = await POST(stapel, '/api/zoe/stapel', { id: v.id, entscheidung: 'freigeben' });
    expect(f.status, f.text).toBe(200);
    expect(server.gesendet).toHaveLength(1);
    expect(server.gesendet[0].an).toEqual([`hallo@cafe.${D}`]);
    const roh = server.gesendet[0].roh.toString('utf8').replace(/=\r?\n/g, '');
    const token = /\/vorschau\/(v1-[0-9a-f]{32})/.exec(roh)?.[1];
    expect(token).toBeTruthy();
    expect(roh).toMatch(/abmelden\/a1-/);
    expect(roh).toMatch(/Datenschutz/);
    const seite = await vorschauSeite.GET!(new Request(`http://localhost/vorschau/${token}`), { params: Promise.resolve({ token }) });
    expect(seite.status).toBe(200);
    const html = await seite.text();
    expect(html).toContain('Café Erfunden &lt;b&gt;');
    expect(html).not.toMatch(/<script/);
    const falsch = await vorschauSeite.GET!(new Request('http://localhost/vorschau/v1-00000000000000000000000000000000'), { params: Promise.resolve({ token: 'v1-00000000000000000000000000000000' }) });
    expect(falsch.status).toBe(404);
    const b = await (await import('@/lib/funde/speicher')).ladeFunde();
    expect(b.funde.find(x => x.id === cafe.id)).toMatchObject({ status: 'gesendet', gesendet: { eigenesRisiko: true } });
    expect(b.funde.find(x => x.id === cafe.id)?.angesehenAm).toBeTruthy();
    // Kein zweites Mal (nachsenden nur aus „übernommen“).
    expect((await POST(funde, '/api/crm/funde', { aktion: 'senden', id: cafe.id })).status).toBe(409);
    expect(server.gesendet).toHaveLength(1);
  });

  it('Import einer Recherche-Datei: nur Inhaber, Doppelte und Kartei-Firmen übersprungen, über 200 → 413, alles wartet im Stapel', async () => {
    await einrichten();
    const datei = { format: 'make-os-funde', funde: [
      { osmId: 'n77', name: 'Bistro Datei', branche: 'gastro', adresse: { strasse: 'Dateiweg', hausnummer: '2', plz: '10999', ort: 'Berlin' }, email: `kontakt@bistro.${D}`, gebiet: 'Mitte', bewertung: { punkte: 90, website: true, erreichbar: false, gruende: ['Die Adresse der Website führt ins Leere — die Domain gibt es nicht (mehr).'] },
        inhaber: 'Erika Beispiel', inhaberArt: 'person', instagram: '@bistro.datei', quellen: { inhaber: `https://bistro.${D}/impressum`, kaputt: 'javascript:alert(1)' },
        analyse: { niveau: 140, teile: { technik: 10, gaeste: 5, auffindbar: 0, recht: 5 }, design: 2, luecken: ['Keine Speisekarte auf der Seite.<script>'], aufhaenger: ['Gäste finden keine Speisekarte.', 'a', 'b', 'c'], leistung: { lcpMs: 6200, quelle: 'chrome' } } },
      { osmId: 'n80', name: 'Geschlossen Datei', branche: 'gastro', geschlossen: true },
      { osmId: 'n78', name: 'Laden Mit Seite', branche: 'gastro' },
      { osmId: 'n79', name: 'Bistro Datei', branche: 'gastro' },
      { name: '', branche: 'gastro' },
    ] };
    expect((await POST(funde, '/api/crm/funde', { aktion: 'import', datei }, sitzung('malin'))).status).toBe(403);
    const r = await POST(funde, '/api/crm/funde', { aktion: 'import', datei });
    expect(r.status, r.text).toBe(200);
    expect(r.d.neu).toBe(1);
    expect(r.d.uebersprungen.map((u: { grund: string }) => u.grund).sort()).toEqual(['Firma steht schon in der Kartei', 'Name des Betriebs fehlt.', 'laut Recherche dauerhaft geschlossen', 'schon als Fund bekannt']);
    expect(await offeneFundVorschlaege()).toHaveLength(1);
    const f = (await (await import('@/lib/funde/speicher')).ladeFunde()).funde[0];
    expect(f).toMatchObject({ quelle: 'osm', osmId: 'n77', status: 'vorbereitet', bewertung: { punkte: 90 } });
    // Mit Niveau-Analyse nennt die Mail deren Aufhänger statt der Gründe der Bewertung (unten geprüft).
    expect(f).toMatchObject({ inhaber: 'Erika Beispiel', inhaberArt: 'person', instagram: 'bistro.datei', quellen: { inhaber: `https://bistro.${D}/impressum` } });
    expect(f.quellen).not.toHaveProperty('kaputt');
    expect(f.entwurf?.text).toMatch(/^Guten Tag Erika Beispiel,/);
    expect(f.entwurf?.anruf).toMatch(/Instagram @bistro\.datei/);
    expect(f.analyse).toMatchObject({ niveau: 100, design: 2, aufhaenger: ['Gäste finden keine Speisekarte.', 'a', 'b'], leistung: { lcpMs: 6200, quelle: 'chrome' } });
    expect(f.analyse?.luecken[0]).not.toMatch(/</);
    expect(f.entwurf?.text).toMatch(/Gäste finden keine Speisekarte/);
    expect(f.entwurf?.anruf).toMatch(/Website-Niveau 100\/100/);
    // Übernahme: Inhaber wird der Name des Kontakts, Instagram + Quellen stehen in der Notiz.
    const v = (await offeneFundVorschlaege())[0];
    expect((await POST(stapel, '/api/zoe/stapel', { id: v.id, entscheidung: 'freigeben' })).status).toBe(200);
    const kk = (await db.loadJson<{ kontakte: { vorname: string; nachname: string; notiz?: string; firma?: string }[] }>('kontakte'))!.kontakte;
    expect(kk[0]).toMatchObject({ vorname: 'Erika', nachname: 'Beispiel', firma: 'Bistro Datei' });
    expect(kk[0].notiz).toMatch(/Instagram: @bistro\.datei/);
    expect((await POST(funde, '/api/crm/funde', { aktion: 'import', datei: { format: 'make-os-funde', funde: Array.from({ length: 201 }, (_, i) => ({ name: `X${i}`, branche: 'gastro' })) } })).status).toBe(413);
    expect((await POST(funde, '/api/crm/funde', { aktion: 'import', datei: { funde: [] } })).status).toBe(400);
  });

  it('Art. 17: Funde, die die Person nennen, fallen weg', async () => {
    await einrichten();
    await laufen();
    const { weitererSpeicher, merkmaleVon } = await import('@/lib/crm/person-weitere');
    const s = weitererSpeicher('kampagne-funde--h')!;
    const cur = await db.loadJson<Record<string, unknown>>('kampagne-funde--h');
    const r = s.wirkung(cur as never, merkmaleVon('c-x', { email: `hallo@cafe.${D}` }));
    expect(((r.neu as { funde: { email?: string }[] }).funde).some(f => f.email === `hallo@cafe.${D}`)).toBe(false);
  });
});
