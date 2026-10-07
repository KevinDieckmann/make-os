// Inbox × WhatsApp (07.10. abends) — die Inbox kennt WhatsApp: Screener auch für Telefonnummern (früher 400), Lagebild/Fächer zählen
// WhatsApp, Gespräch mit Art/Zustellstand/Medien-Zustand, Kontakt aus WhatsApp mit Nummer (Anfrage-Kanal „WhatsApp“, Dublette über die
// Nummer, mehrdeutige Nummern nie automatisch), Verlauf mit eigener Art „whatsapp“ für Gesendetes, Postfächer-Verwaltung unter Business
// ohne Privat (serverseitig), Art. 15/17 für Nummern im Inbox-Zustand, HOI-Befund, Oberfläche (Medien nur auf Klick, Antworten über
// WhatsApp statt Mail-Editor). Nachgebautes Meta — kein Netz. Erfundene Daten (@example.invalid, Nummern ohne echten Anschluss).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHmac, createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Kontakt } from '@/lib/make-one/crm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/inbox' }));

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-inbox-wa-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-inbox-whatsapp';
process.env.MAKE_OS_KEY = 'dienst-test-inbox-whatsapp';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-inbox-wa-0123456789abcdef';

const D = 'example.invalid';
const NR_ID = '100200300400501';
const WABA = '200300400500601';
const TOKEN = 'EAAGtest' + 'Y'.repeat(120);
const GEHEIM = 'a0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5';
const VERIFY = 'd'.repeat(48);
const KUNDE = '4915112345678';
const ENV: Record<string, string> = {
  WHATSAPP_TELEFONNUMMER_ID: NR_ID, WHATSAPP_WABA_ID: WABA, WHATSAPP_ZUGRIFFSSCHLUESSEL: TOKEN, WHATSAPP_APP_GEHEIMNIS: GEHEIM,
  WHATSAPP_VERIFY_TOKEN: VERIFY, WHATSAPP_BEREICH: 'ug', WHATSAPP_PERSONEN: '', MAKE_OS_ADRESSE: 'https://app.makeinnovation.test',
  GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', ICLOUD_APPLE_ID: '', ICLOUD_APP_PASSWORT: '', NEXT_PUBLIC_MAKE_BAU: '',
};

type H = (r: Request) => Promise<Response>;
let db: typeof import('@/lib/store/local-db');
let G: typeof import('@/lib/whatsapp/graph');
let S: typeof import('@/lib/whatsapp/spiegel');
let K: typeof import('@/lib/whatsapp/konfig');
let webhook: { POST: H }, senden: { POST: H }, medien: { GET: H }, inbox: { GET: H; POST: H }, gespraech: { GET: H }, postfaecher: { GET: H; POST: H }, anfrage: { POST: H };

let aufrufe: { methode: string; url: string; body?: unknown }[] = [];
const BILD = Buffer.from('ein-erfundenes-bild-nur-fuer-den-test');
async function metaFake(url: string, init: RequestInit): Promise<Response> {
  const u = new URL(url);
  const auth = (init.headers as Record<string, string>)?.Authorization === `Bearer ${TOKEN}`;
  const body = init.body ? JSON.parse(String(init.body)) : undefined;
  aufrufe.push({ methode: init.method ?? 'GET', url: `${u.origin}${u.pathname}`, ...(body ? { body } : {}) });
  const json = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
  if (!auth) return json(401, { error: { code: 190 } });
  if (u.hostname === 'lookaside.fbsbx.com') return new Response(BILD, { status: 200, headers: { 'content-length': String(BILD.length) } });
  if (u.pathname === `/${G.GRAPH_VERSION}/${NR_ID}/messages`) return json(200, { messaging_product: 'whatsapp', contacts: [{ wa_id: KUNDE }], messages: [{ id: `wamid.OUT${aufrufe.length}abcdef` }] });
  if (u.pathname === `/${G.GRAPH_VERSION}/${NR_ID}`) return json(200, { display_phone_number: '+49 30 0000 0000', verified_name: 'Beispiel Innovation', quality_rating: 'GREEN', throughput: { level: 'STANDARD' } });
  if (/^\/v\d+\.0\/\d+$/.test(u.pathname)) return json(200, { url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1', sha256: createHash('sha256').update(BILD).digest('hex'), file_size: BILD.length, id: u.pathname.split('/').pop() });
  return json(404, { error: { code: 100 } });
}

const sig = (roh: string) => `sha256=${createHmac('sha256', GEHEIM).update(roh).digest('hex')}`;
const T = (vorStunden = 0) => String(Math.floor(Date.now() / 1000 - vorStunden * 3600));
const koerper = (werte: Record<string, unknown>) => JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: WABA, changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '4930000000', phone_number_id: NR_ID }, ...werte } }] }] });
const text = (id: string, t: string, von = KUNDE, name = 'Erika Beispiel', vorStunden = 0) => ({ contacts: [{ profile: { name }, wa_id: von }], messages: [{ from: von, id, timestamp: T(vorStunden), type: 'text', text: { body: t } }] });
const post = (roh: string) => webhook.POST(new Request('http://localhost/api/whatsapp/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig(roh) }, body: roh }));
const ich = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = async (r: Response) => ({ status: r.status, d: await r.json().catch(() => ({})) as Record<string, any> });
const GET = (route: { GET: H }, url: string, person = 'kevin') => route.GET(new Request(`http://localhost${url}`, { headers: ich(person) })).then(j);
const POST = (route: { POST: H }, url: string, body: unknown, person = 'kevin') => route.POST(new Request(`http://localhost${url}`, { method: 'POST', headers: ich(person), body: JSON.stringify(body) })).then(j);
const GID = (nr = KUNDE) => `wa~${K.postfachIdFuer(NR_ID)}~${nr}`;
const warte = async (bis: () => Promise<boolean>) => { for (let i = 0; i < 150; i++) { if (await bis()) return; await new Promise(r => setTimeout(r, 20)); } throw new Error('Zeit abgelaufen'); };
const k = (id: string, vorname: string, nachname: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname, nachname, stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie', ...x } as Kontakt);
const KONTEN = { konten: [
  { id: 'k1', speicher: 'kevin', email: `kevin@${D}`, name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  { id: 'k2', speicher: 'malin', email: `malin@${D}`, name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
], einladungen: [] };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  G = await import('@/lib/whatsapp/graph'); S = await import('@/lib/whatsapp/spiegel'); K = await import('@/lib/whatsapp/konfig');
  webhook = await import('../app/api/whatsapp/webhook/route') as typeof webhook;
  senden = await import('../app/api/whatsapp/senden/route') as typeof senden;
  medien = await import('../app/api/whatsapp/medien/route') as typeof medien;
  inbox = await import('../app/api/inbox/route') as typeof inbox;
  gespraech = await import('../app/api/inbox/gespraech/route') as typeof gespraech;
  postfaecher = await import('../app/api/inbox/postfaecher/route') as typeof postfaecher;
  anfrage = await import('../app/api/crm/anfrage/route') as typeof anfrage;
});
afterAll(() => { G._fetchSetzen(null); vi.unstubAllEnvs(); vi.unstubAllGlobals(); rmSync(ordner, { recursive: true, force: true }); });

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  (await import('@/lib/zugang/drossel'))._zuruecksetzen();
  (await import('@/lib/whatsapp/senden'))._bremseZuruecksetzen();
  for (const [a, b] of Object.entries(ENV)) vi.stubEnv(a, b);
  vi.stubGlobal('fetch', async (u: string) => { throw new Error(`Kein Netz im Test: ${u}`); });
  G._fetchSetzen(metaFake);
  aufrufe = [];
  await db.saveJson('konten', KONTEN);
  await db.saveJson('kontakte', { kontakte: [] });
  await db.saveJson('crm', { firmen: [], chancen: [], mandate: [], followups: [], kampagnen: [], events: [], beitraege: [], teilnahmen: [] });
});

const waGespraech = async (person = 'kevin', q = '') => (await GET(inbox, `/api/inbox${q}`, person)).d.gespraeche.find((g: { id: string }) => g.id === GID());

describe('Screener auch für Telefonnummern (früher 400)', () => {
  it('unbekannte Nummer → „Neue Absender“ (Lagebild zählt sie); Zulassen → Antworten; Blocken → aus der Arbeit; „offen“ → zurück — je Person', async () => {
    expect((await post(koerper(text('wamid.S1000001', 'Hallo, ich hätte eine Frage zu Ihrem Angebot.')))).status).toBe(200);
    const a = await GET(inbox, '/api/inbox');
    const g = a.d.gespraeche.find((x: { id: string }) => x.id === GID());
    expect(g).toMatchObject({ quelle: 'whatsapp', fach: 'neu', absender: `+${KUNDE}`, inArbeit: true, bereich: 'ug', whatsapp: { nummer: KUNDE, profilname: 'Erika Beispiel', fenster: { offen: true } } });
    expect(a.d.lage).toEqual([expect.objectContaining({ bereich: 'ug', neu: 1, antworten: 0 })]);

    const z = await POST(inbox, '/api/inbox', { aktion: 'zulassen', id: GID() });
    expect(z.status).toBe(200); expect(z.d.text).toMatch(/WhatsApp von dieser Nummer/);
    expect((await db.loadJson<{ absender: Record<string, unknown> }>('inbox-zustand--kevin'))!.absender).toEqual({ [`+${KUNDE}`]: expect.objectContaining({ status: 'zugelassen' }) });
    const b = await GET(inbox, '/api/inbox');
    expect(b.d.gespraeche.find((x: { id: string }) => x.id === GID()).fach).toBe('antworten');
    expect(b.d.lage[0]).toMatchObject({ antworten: 1, neu: 0 });
    // Malin hat nicht entschieden — die Entscheidung gilt je Person.
    expect((await waGespraech('malin')).fach).toBe('neu');

    expect((await POST(inbox, '/api/inbox', { aktion: 'blocken', id: GID() })).d.text).toMatch(/erscheint nicht mehr/);
    expect(await waGespraech()).toMatchObject({ fach: 'geblockt', inArbeit: false });
    expect((await GET(inbox, '/api/inbox')).d.lage).toEqual([]);
    expect((await POST(inbox, '/api/inbox', { aktion: 'offen', id: GID() })).status).toBe(200);
    expect((await waGespraech()).fach).toBe('neu');
  });
  it('Absender-Liste in „Postfächer“: Nummer zulassen/blocken/vergessen; ungültiges → 400', async () => {
    await post(koerper(text('wamid.S2000001', 'Hallo')));
    expect((await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'absender', adresse: `+${KUNDE}`, status: 'geblockt' })).status).toBe(200);
    expect((await GET(postfaecher, '/api/inbox/postfaecher')).d.absender).toEqual([expect.objectContaining({ adresse: `+${KUNDE}`, status: 'geblockt' })]);
    expect((await waGespraech()).fach).toBe('geblockt');
    expect((await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'absender', adresse: `+${KUNDE}`, status: null })).status).toBe(200);
    expect((await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'absender', adresse: '0151 kaputt', status: 'geblockt' })).status).toBe(400);
  });
  it('Schlüssel (rein): Mail klein, Nummer immer „+<Ziffern>“, nationale/kaputte Schreibweisen leer', async () => {
    const { absenderSchluessel, istTelefonSchluessel } = await import('@/lib/inbox/zustand');
    expect(absenderSchluessel(`Anna@Kunde.${D}`)).toBe(`anna@kunde.${D}`);
    expect(absenderSchluessel(KUNDE)).toBe(`+${KUNDE}`);
    expect(absenderSchluessel(`+${KUNDE}`)).toBe(`+${KUNDE}`);
    expect(absenderSchluessel('0151 1234567')).toBe('');
    expect(absenderSchluessel('+12345')).toBe('');
    expect(istTelefonSchluessel(`+${KUNDE}`)).toBe(true); expect(istTelefonSchluessel(`a@${D}`)).toBe(false);
  });
});

describe('Gespräch öffnen: WhatsApp-Infos für die Oberfläche', () => {
  it('Art, Medien-Zustand (erst nach dem Laden „abgelegt“), Zustellstand; Absender = Business-Nummer; Medien bleiben Download', async () => {
    await post(koerper(text('wamid.M1000001', 'Schauen Sie mal')));
    await post(koerper({ messages: [
      { from: KUNDE, id: 'wamid.M1000002', timestamp: T(), type: 'image', image: { id: '7777777001', mime_type: 'image/jpeg' } },
      { from: KUNDE, id: 'wamid.M1000003', timestamp: T(), type: 'audio', audio: { id: '7777777002', mime_type: 'audio/ogg; codecs=opus', voice: true } },
    ] }));
    await warte(async () => { db.leseCacheLeeren(); const n = (await S.ladeWaSpiegel()).nachrichten; return n['wamid.M1000002']?.medium?.zustand === 'abgelegt' && n['wamid.M1000003']?.medium?.zustand === 'abgelegt'; });
    await POST(inbox, '/api/inbox', { aktion: 'zulassen', id: GID() });
    const s = await POST(senden, '/api/whatsapp/senden', { gespraech: GID(), art: 'frei', text: 'Danke, schaue ich mir an.', anfrageId: 'anfrage-ui-0001' });
    expect(s.status).toBe(200);
    await post(koerper({ statuses: [{ id: s.d.id, status: 'delivered', timestamp: T(), recipient_id: KUNDE }] }));
    const a = await GET(gespraech, `/api/inbox/gespraech?id=${encodeURIComponent(GID())}`);
    expect(a.status).toBe(200);
    const n = a.d.nachrichten as { id: string; wa?: Record<string, unknown>; text: string; anhaenge: { teil: string; typ: string }[] }[];
    expect(n.find(x => x.id === 'wamid.M1000002')).toMatchObject({ text: '[Bild]', wa: { art: 'bild', medium: 'abgelegt' }, anhaenge: [{ teil: 'wa', typ: 'image/jpeg' }] });
    expect(n.find(x => x.id === 'wamid.M1000003')).toMatchObject({ wa: { art: 'sprachnachricht', medium: 'abgelegt' }, anhaenge: [{ teil: 'wa', typ: 'audio/ogg; codecs=opus' }] });
    expect(n.find(x => x.id === s.d.id)).toMatchObject({ wa: { art: 'text', status: 'zugestellt' } });
    expect(a.d.gespraech.whatsapp).toMatchObject({ nummer: KUNDE, fenster: { offen: true } });
    expect(a.d.antwort.von).toEqual([{ email: expect.stringMatching(/^\+?[0-9 ]+$|WhatsApp/) }]);
    const m = await medien.GET(new Request('http://localhost/api/whatsapp/medien?id=wamid.M1000002', { headers: ich('kevin') }));
    expect(m.status).toBe(200); expect(m.headers.get('content-type')).toBe('application/octet-stream'); expect(m.headers.get('content-disposition')).toMatch(/^attachment/);
    expect(Buffer.from(await m.arrayBuffer()).equals(BILD)).toBe(true);
  });
  it('Gelesen beim Öffnen und Erledigt (bis zur jüngsten Nachricht) wirken; neue Nachricht holt das Gespräch zurück', async () => {
    // Meta stempelt mit Sekunden — die erste Nachricht kam ein paar Minuten vor der zweiten.
    await post(koerper(text('wamid.E1000001', 'Erste Frage', KUNDE, 'Erika Beispiel', 0.1)));
    await POST(inbox, '/api/inbox', { aktion: 'zulassen', id: GID() });
    expect((await waGespraech()).ungelesen).toBe(true);
    expect((await POST(inbox, '/api/inbox', { aktion: 'gelesen', id: GID() })).status).toBe(200);
    expect((await waGespraech()).ungelesen).toBe(false);
    expect((await POST(inbox, '/api/inbox', { aktion: 'erledigt', id: GID() })).d.text).toMatch(/schreibt die Person wieder/);
    expect((await waGespraech()).inArbeit).toBe(false);
    await post(koerper(text('wamid.E1000002', 'Noch eine Frage')));
    expect(await waGespraech()).toMatchObject({ inArbeit: true, ungelesen: true });
  });
});

describe('Kontakt aus WhatsApp — mit Nummer, nur auf Klick, mehrdeutig nie automatisch', () => {
  it('„Kontakt anlegen“ → Akte mit Telefonnummer (Anfrage über WhatsApp); danach „gehört zu“; Zuordnen → Verlauf: erhalten = antwort, gesendet = whatsapp', async () => {
    await post(koerper(text('wamid.K1000001', 'Können wir bis Freitag telefonieren?')));
    const g = await waGespraech();
    expect(g.zuordnung).toBeUndefined();
    const { kontaktAusGespraech } = await import('@/lib/inbox/aus-gespraech');
    const eingabe = kontaktAusGespraech(g, 'Können wir bis Freitag telefonieren?', '2026-10-07');
    expect(eingabe).toMatchObject({ kanal: 'whatsapp', neu: { vorname: 'Erika', nachname: 'Beispiel', telefon: `+${KUNDE}` } });
    expect(JSON.stringify(eingabe)).not.toContain('email');
    const r = await POST(anfrage, '/api/crm/anfrage', { aktion: 'anlegen', ...eingabe });
    expect(r.status).toBe(200); expect(r.d.neuePerson).toBe(true);
    const akte = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(x => x.id === r.d.kontaktId)!;
    expect(akte).toMatchObject({ telefon: `+${KUNDE}`, quelle: 'Anfrage über WhatsApp', herkunft: 'selbst' });
    expect(akte.email).toBeUndefined();
    // Zweimal anlegen → hängt an derselben Akte (gleiche Nummer), keine Dublette.
    const zwei = await POST(anfrage, '/api/crm/anfrage', { aktion: 'anlegen', ...eingabe });
    expect(zwei.d).toMatchObject({ neuePerson: false, kontaktId: r.d.kontaktId, hinweis: expect.stringMatching(/gleiche Nummer/) });
    const nach = await waGespraech();
    expect(nach.zuordnung).toMatchObject({ kontaktId: r.d.kontaktId, name: 'Erika Beispiel' });
    expect(nach.fach).toBe('antworten');
    // Nichts im Verlauf (außer der Anfrage selbst), bis „Zuordnen“ geklickt ist.
    const vorher = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(x => x.id === r.d.kontaktId)!.aktivitaeten;
    expect(vorher.some(a => a.text === 'WhatsApp erhalten')).toBe(false);
    expect((await POST(inbox, '/api/inbox', { aktion: 'zuordnen', id: GID() })).status).toBe(200);
    expect((await POST(senden, '/api/whatsapp/senden', { gespraech: GID(), art: 'frei', text: 'Ja, gern.', anfrageId: 'anfrage-ui-0002' })).status).toBe(200);
    db.leseCacheLeeren();
    const a = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(x => x.id === r.d.kontaktId)!.aktivitaeten;
    expect(a.filter(x => x.text === 'WhatsApp erhalten').map(x => x.art)).toEqual(['antwort']);
    expect(a.filter(x => x.text === 'WhatsApp gesendet').map(x => x.art)).toEqual(['whatsapp']);
    expect(a.every(x => !(x.text ?? '').includes('telefonieren?') || x.text!.startsWith('Anfrage über WhatsApp'))).toBe(true);
    // Eine neue eingehende Nachricht eines bestätigten Gesprächs kommt sofort (Webhook) in den Verlauf.
    await post(koerper(text('wamid.K1000002', 'Danke!')));
    await warte(async () => { db.leseCacheLeeren(); return ((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(x => x.id === r.d.kontaktId)!.aktivitaeten.filter(x => x.text === 'WhatsApp erhalten').length) === 2; });
  });
  it('mehrdeutige Nummer: keine Zuordnung, Auswahl „Zuordnen zu …“ statt „Kontakt anlegen“, Anfrage abgelehnt; die Wahl gewinnt', async () => {
    await db.saveJson('kontakte', { kontakte: [k('c-erika-a', 'Erika', 'Alt', { telefon: '0151 12345678' }), k('c-erika-b', 'Erika', 'Neu', { sms: `+${KUNDE}` }), k('c-sperre', 'Gesperrt', 'Person', { telefon: `+${KUNDE}`, werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } } as Partial<Kontakt>)] });
    await post(koerper(text('wamid.A1000001', 'Hallo')));
    const g = await waGespraech();
    expect(g.zuordnung).toBeUndefined();
    const a = await GET(gespraech, `/api/inbox/gespraech?id=${encodeURIComponent(GID())}`);
    expect(a.d.kontext.kandidaten.map((x: { id: string }) => x.id).sort()).toEqual(['c-erika-a', 'c-erika-b']);
    expect(a.d.vorschlaege.some((v: { art: string }) => v.art === 'kontakt')).toBe(false);
    const { kontaktAusGespraech } = await import('@/lib/inbox/aus-gespraech');
    const r = await POST(anfrage, '/api/crm/anfrage', { aktion: 'anlegen', ...kontaktAusGespraech(g, 'Hallo', '2026-10-07') });
    expect(r.status).toBe(400); expect(r.d.fehler).toMatch(/mehreren Personen/);
    expect((await POST(inbox, '/api/inbox', { aktion: 'zuordnen', id: GID(), kontaktId: 'c-erika-b' })).status).toBe(200);
    expect((await waGespraech()).zuordnung).toMatchObject({ kontaktId: 'c-erika-b', name: 'Erika Neu' });
    db.leseCacheLeeren();
    const alle = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
    expect(alle.find(x => x.id === 'c-erika-b')!.aktivitaeten.map(x => x.text)).toEqual(['WhatsApp erhalten']);
    expect(alle.find(x => x.id === 'c-erika-a')!.aktivitaeten).toEqual([]);
    // Gesperrte Person ist nie Kandidat und nie zuordenbar.
    expect((await POST(inbox, '/api/inbox', { aktion: 'zuordnen', id: GID(), kontaktId: 'c-sperre' })).status).toBe(409);
  });
  it('Aktivitäts-Art „whatsapp“: Ansprache wie LinkedIn (Stufe, Wiedervorlage), Kategorie „E-Mails & Nachrichten“, Titel', async () => {
    const { stufeNach, wiedervorlageNach, AKTIVITAET_ARTEN, saeubereKontakt } = await import('@/lib/make-one/crm');
    const { KATEGORIE_VON_ART, ART_TITEL } = await import('@/lib/crm/aktivitaeten');
    expect(AKTIVITAET_ARTEN).toContain('whatsapp');
    expect(stufeNach('whatsapp', 'neu')).toBe('angesprochen');
    expect(wiedervorlageNach('whatsapp', '2026-10-07', (d, n) => `${d}+${n}`)).toBe('2026-10-07+5');
    expect(KATEGORIE_VON_ART.whatsapp).toBe('emails'); expect(ART_TITEL.whatsapp).toBe('WhatsApp-Nachricht');
    const s = saeubereKontakt({ ...k('c-test-wa', 'Test', 'Person'), aktivitaeten: [{ am: '2026-10-07T10:00:00.000Z', art: 'whatsapp', text: 'WhatsApp gesendet', von: 'kevin' }] });
    expect(s?.aktivitaeten.map(a => a.art)).toEqual(['whatsapp']);
  });
});

describe('Postfächer-Verwaltung: Business sieht nie Privat (serverseitig)', () => {
  const PRIVAT = 'pf-11111111-2222-4333-8444-555555555555';
  beforeEach(async () => {
    await db.saveJson('postfaecher--kevin', { v: 1, postfaecher: [{ id: PRIVAT, quelle: 'imap', bereich: 'privat', anzeigename: 'Privat · iCloud', adresse: `kevin.privat@${D}`, anbieter: 'icloud', angelegtAm: '2026-10-06' }] });
    await db.saveJson('imap-stand--kevin', { v: 1, person: 'kevin', postfaecher: { [PRIVAT]: { at: new Date().toISOString() } }, koepfe: {
      [`${PRIVAT}:e:1:1`]: { id: `${PRIVAT}:e:1:1`, threadId: 'x', am: new Date().toISOString(), von: { name: 'Freundin', email: `freundin@privat.${D}` }, an: [{ email: `kevin.privat@${D}` }], cc: [], betreff: 'PRIVAT-Geburtstag', ausschnitt: 'Kommst du?', labels: ['INBOX'], anhaenge: [], postfachId: PRIVAT, ordner: 'e', uidValidity: '1', uid: 1, wurzel: '<p1@x>', messageId: '<p1@x>' },
    } });
    await post(koerper(text('wamid.P1000001', 'Business-Anfrage')));
    await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'absender', adresse: `freundin@privat.${D}`, status: 'zugelassen' });
    await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'absender', adresse: `+${KUNDE}`, status: 'zugelassen' });
  });
  it('space=business: kein Privat-Postfach, kein Privat-Bereich, keine Privat-Absender — ohne Filter bzw. Privat alles Eigene', async () => {
    const b = await GET(postfaecher, '/api/inbox/postfaecher?space=business');
    expect(b.status).toBe(200); expect(b.d.nurBusiness).toBe(true);
    expect(b.d.postfaecher.map((p: { quelle: string }) => p.quelle)).toEqual(['whatsapp']);
    expect(JSON.stringify(b.d)).not.toMatch(/PRIVAT-Geburtstag|freundin@|kevin\.privat|Privat · iCloud/);
    expect(b.d.bereiche.some((x: { id: string }) => x.id === 'privat')).toBe(false);
    expect(b.d.absender.map((x: { adresse: string }) => x.adresse)).toEqual([`+${KUNDE}`]);
    for (const q of ['', '?space=privat']) {
      const a = await GET(postfaecher, `/api/inbox/postfaecher${q}`);
      expect(a.d.postfaecher.map((p: { quelle: string }) => p.quelle).sort()).toEqual(['imap', 'whatsapp']);
      expect(a.d.absender).toHaveLength(2);
      expect(a.d.bereiche.some((x: { id: string }) => x.id === 'privat')).toBe(true);
    }
    expect((await GET(postfaecher, '/api/inbox/postfaecher?space=alles')).status).toBe(400);
    // Der Strom unter Business zeigt ebenso nichts Privates (dieselbe Filterstelle).
    expect(JSON.stringify((await GET(inbox, '/api/inbox?space=business')).d)).not.toMatch(/PRIVAT-Geburtstag|freundin@/);
  });
  it('postfaecherSicht (rein): Postfach ohne Bereich zählt unter Business nicht', async () => {
    const { postfaecherSicht } = await import('@/lib/inbox/strom-server');
    const r = postfaecherSicht({ postfaecher: [{ id: 'a', bereich: 'ug' }, { id: 'b', bereich: 'privat' }, { id: 'c', bereich: null }], gespraeche: [{ postfachId: 'a', absender: 'X@Y.example' }, { postfachId: 'b', absender: 'p@q.example' }], bereiche: [{ id: 'privat', name: 'Privat' }, { id: 'ug', name: 'MAKE' }], absender: [{ adresse: 'x@y.example' }, { adresse: 'p@q.example' }] }, 'business');
    expect(r).toEqual({ postfaecher: [{ id: 'a', bereich: 'ug' }], bereiche: [{ id: 'ug', name: 'MAKE' }], absender: [{ adresse: 'x@y.example' }] });
    expect(postfaecherSicht({ postfaecher: [{ id: 'b', bereich: 'privat' }], gespraeche: [], bereiche: [], absender: [{ adresse: 'p@q.example' }] }, null).postfaecher).toHaveLength(1);
  });
});

describe('Art. 15/17: Nummern im Inbox-Zustand', () => {
  it('Screener-Entscheidung zur Nummer und Zustand ihrer WhatsApp-Gespräche fallen weg; Fremdes bleibt; Art. 15 zählt sie', async () => {
    const { inboxZustandOhne, merkmaleVon, weitererSpeicher } = await import('@/lib/crm/person-weitere');
    const m = merkmaleVon('c-erika', { vorname: 'Erika', nachname: 'Beispiel', sms: '0151 12345678' });
    expect(m.telefone).toEqual([KUNDE]);
    const cur = { v: 1, absender: { [`+${KUNDE}`]: { status: 'geblockt', seit: '2026-10-07' }, '+4917799999999': { status: 'zugelassen', seit: '2026-10-07' }, [`a@${D}`]: { status: 'zugelassen', seit: '2026-10-07' } },
      gespraeche: { [`wa~pf-x~${KUNDE}`]: { spaeter: { bis: '2026-10-09', seit: '2026-10-07' } }, 'wa~pf-x~4917799999999': { zuordnung: { kontaktId: 'c-erika', am: '2026-10-07' } }, 'gm~abc': { spaeter: { bis: '2026-10-09', seit: '2026-10-07' } } } };
    const r = inboxZustandOhne(cur, m);
    expect(Object.keys(r.neu.absender as object).sort()).toEqual(['+4917799999999', `a@${D}`]);
    expect(Object.keys(r.neu.gespraeche as object).sort()).toEqual(['gm~abc', 'wa~pf-x~4917799999999']);
    expect(JSON.stringify(r.neu)).not.toContain('c-erika');
    expect(r.n).toBeGreaterThanOrEqual(3);
    expect(weitererSpeicher('inbox-zustand--kevin')!.zaehlen!(cur, m)).toBe(r.n);
  });
});

describe('HOI-Befund WhatsApp — nur Zahlen', () => {
  it('nicht eingerichtet → kein Befund; Schlüssel abgelehnt → rot „Verbindung erneuern“; nie Nummern/Namen', async () => {
    const { whatsappBefunde } = await import('@/lib/hoi/lage');
    const { whatsappLage, whatsappLageAus } = await import('@/lib/whatsapp/lage');
    vi.stubEnv('WHATSAPP_TELEFONNUMMER_ID', '');
    expect(await whatsappLage()).toBeNull();
    expect(whatsappBefunde(null)).toEqual([]);
    vi.stubEnv('WHATSAPP_TELEFONNUMMER_ID', NR_ID);
    expect(whatsappBefunde(await whatsappLage())[0]).toMatchObject({ id: 'whatsapp', ampel: 'gelb', wert: expect.stringMatching(/noch keine Meldung/) });
    await post(koerper(text('wamid.H1000001', 'Hallo')));
    const jetzt = Date.now();
    const gruen = whatsappBefunde(await whatsappLage(jetzt))[0];
    expect(gruen).toMatchObject({ ampel: 'gruen', wert: expect.stringMatching(/^1 Gespräch · letzte Meldung vor 0 min/) });
    expect(JSON.stringify(gruen)).not.toMatch(new RegExp(`${KUNDE}|Erika`));
    const z = await S.ladeWaZustand();
    const s = await S.ladeWaSpiegel();
    const rot = whatsappBefunde(whatsappLageAus({ ...z, token: { fehlerAt: new Date().toISOString(), gemeldet: true }, telefon: { at: new Date().toISOString(), qualitaet: 'GREEN', durchsatz: 'STANDARD' } }, s, jetzt))[0];
    expect(rot).toMatchObject({ ampel: 'rot', satz: expect.stringMatching(/Verbindung erneuern/), wert: expect.stringMatching(/Qualität hoch · Durchsatz STANDARD/) });
    expect(whatsappBefunde({ ...whatsappLageAus(z, s, jetzt), qualitaet: 'RED' })[0].ampel).toBe('rot');
    expect(whatsappBefunde({ ...whatsappLageAus(z, s, jetzt), abgelehnt: 3, abgelehntFrisch: true })[0]).toMatchObject({ ampel: 'gelb', satz: expect.stringMatching(/ohne gültige Signatur/) });
    expect(whatsappBefunde({ ...whatsappLageAus(z, s, jetzt), fehlgeschlagen7d: 2 })[0].ampel).toBe('gelb');
    // Eingehängt in die Gesamtlage.
    expect(readFileSync(path.resolve(__dirname, '../lib/hoi/lage.ts'), 'utf8')).toContain('b.push(...whatsappBefunde(innen.whatsapp));');
    expect(readFileSync(path.resolve(__dirname, '../lib/hoi/innen.ts'), 'utf8')).toMatch(/whatsapp: await import\('@\/lib\/whatsapp\/lage'\)/);
  });
});

describe('Oberfläche: WhatsApp in der Inbox', () => {
  const h = (c: unknown, p: unknown) => createElement(c as never, p as never);
  const lies = (d: string) => readFileSync(path.resolve(__dirname, '..', d), 'utf8');
  it('Medien nur auf Klick: Bild → „Bild ansehen“ ohne <img>, Sprachnachricht → „abspielen“ ohne <audio>, Dokument → Download; Zustände', async () => {
    const { WaMedium } = await import('@/components/os/whatsapp');
    const bild = renderToStaticMarkup(h(WaMedium, { nachricht: 'wamid.X1', name: 'Bild', typ: 'image/jpeg', groesse: 2048, zustand: 'abgelegt', art: 'bild' }));
    expect(bild).toMatch(/Bild ansehen/); expect(bild).not.toMatch(/<img/); expect(bild).toContain('data-anzeige="bild"');
    const audio = renderToStaticMarkup(h(WaMedium, { nachricht: 'wamid.X2', name: 'Sprachnachricht', typ: 'audio/ogg; codecs=opus', groesse: 9000, zustand: 'abgelegt', art: 'sprachnachricht' }));
    expect(audio).toMatch(/Sprachnachricht abspielen/); expect(audio).not.toMatch(/<audio/);
    const doku = renderToStaticMarkup(h(WaMedium, { nachricht: 'wamid.X3', name: 'Angebot.pdf', typ: 'application/pdf', groesse: 2_000_000, zustand: 'abgelegt', art: 'dokument' }));
    expect(doku).toMatch(/href="\/api\/whatsapp\/medien\?id=wamid\.X3"/); expect(doku).toContain('download'); expect(doku).toMatch(/Angebot\.pdf/);
    const svg = renderToStaticMarkup(h(WaMedium, { nachricht: 'wamid.X4', name: 'x.svg', typ: 'image/svg+xml', groesse: 10, zustand: 'abgelegt' }));
    expect(svg).toContain('data-anzeige="download"'); // SVG nie als Vorschau
    expect(renderToStaticMarkup(h(WaMedium, { nachricht: 'wamid.X5', name: 'Video', typ: 'video/mp4', groesse: 30_000_000, zustand: 'zu-gross' }))).toMatch(/zu groß/);
    expect(renderToStaticMarkup(h(WaMedium, { nachricht: 'wamid.X6', name: 'Bild', typ: 'image/jpeg', groesse: 1, zustand: 'offen' }))).toMatch(/wird gerade/);
    // Kein Laden im Effekt — nur im Klick.
    const t = lies('components/os/whatsapp/WaMedium.tsx');
    const effekte = Array.from(t.matchAll(/useEffect\(([\s\S]*?)\}, \[/g)).map(m => m[1]);
    expect(effekte.some(e => e.includes('fetch('))).toBe(false);
  });
  it('mediumAnzeige (rein): nur sichere Bild-/Audio-Typen als Vorschau', async () => {
    const { mediumAnzeige, mediumVorschauTyp } = await import('@/lib/whatsapp/typen');
    expect(mediumAnzeige('image/png')).toBe('bild'); expect(mediumAnzeige('IMAGE/JPEG')).toBe('bild');
    expect(mediumAnzeige('audio/ogg; codecs=opus')).toBe('audio'); expect(mediumVorschauTyp('audio/ogg; codecs=opus')).toBe('audio/ogg');
    expect(mediumAnzeige('image/svg+xml')).toBe('download'); expect(mediumAnzeige('text/html')).toBe('download'); expect(mediumVorschauTyp('application/pdf')).toBeNull();
  });
  it('Antworten im Gespräch: offen → Textfeld + ZOE-Entwurf; zu → Vorlagen-Wähler, kein ZOE-Entwurf; Kopf mit Nummer + Uhr', async () => {
    const { WaAntwortInbox, WaKopf, WaZustell } = await import('@/components/os/inbox/WhatsappTeile');
    const bis = new Date(Date.now() + 3600_000).toISOString();
    const offen = renderToStaticMarkup(h(WaAntwortInbox, { gespraech: GID(), fenster: { offen: true, bis, restMin: 60 }, onGesendet: () => {}, onZu: () => {}, meldung: () => {} }));
    expect(offen).toContain('<textarea'); expect(offen).toMatch(/ZOE-Entwurf/); expect(offen).toMatch(/über die Business-Nummer/);
    const zu = renderToStaticMarkup(h(WaAntwortInbox, { gespraech: GID(), fenster: { offen: false, bis: new Date(Date.now() - 1000).toISOString(), restMin: null }, onGesendet: () => {}, onZu: () => {}, meldung: () => {} }));
    expect(zu).not.toContain('<textarea'); expect(zu).toContain('data-whatsapp="vorlagen"'); expect(zu).not.toMatch(/ZOE-Entwurf/);
    const kopf = renderToStaticMarkup(h(WaKopf, { nummer: KUNDE, profilname: 'Erika Beispiel', fenster: { offen: true, bis, restMin: 60 } }));
    expect(kopf).toContain(`+${KUNDE}`); expect(kopf).toContain('Erika Beispiel'); expect(kopf).toContain('data-whatsapp="fenster"');
    expect(renderToStaticMarkup(h(WaZustell, { wa: { art: 'text', status: 'fehlgeschlagen', fehler: 'Nummer nicht bei WhatsApp' } }))).toMatch(/nicht zugestellt: Nummer nicht bei WhatsApp/);
    expect(renderToStaticMarkup(h(WaZustell, { wa: { art: 'text' } }))).toBe('');
  });
  it('Gespräch und Liste hängen die Bausteine ein; Senden nur im Klick; Postfächer fragen die Business-Sicht beim Server an', () => {
    const g = lies('components/os/inbox/Gespraech.tsx');
    expect(g).toMatch(/antwort && wa && \(\s*<WaAntwortInbox/); expect(g).toMatch(/antwort && !wa && \(\s*<Antwort/);
    expect(g).toContain('<WaMedium '); expect(g).toContain('<WaKopf '); expect(g).toContain("tu('zuordnen', { kontaktId }");
    const l = lies('components/os/inbox/InboxZwei.tsx');
    expect(l).toContain('<WaSymbol'); expect(l).toContain('<Postfaecher space={space}');
    expect(lies('components/os/inbox/Postfaecher.tsx')).toContain("space === 'business' ? '?space=business' : ''");
    const teile = lies('components/os/inbox/WhatsappTeile.tsx');
    const effekte = Array.from(teile.matchAll(/useEffect\(([\s\S]*?)\}, \[/g)).map(m => m[1]);
    expect(effekte.some(e => e.includes('/api/whatsapp/senden') || e.includes('/api/inbox/entwurf'))).toBe(false);
    expect(lies('components/os/inbox/daten.ts')).toContain("if (quelle === 'whatsapp') return `/api/whatsapp/medien?id=");
  });
});
