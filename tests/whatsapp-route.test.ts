// WhatsApp Business (07.10.) — die Routen mit einem nachgebauten Meta (kein Netz): Webhook (Verifizierung, Signatur, Körpergrenze,
// Idempotenz, Medien verschlüsselt), Strom der Inbox (Bereichstrennung: Privat sieht die Business-Nummer nie, fremder Haushalt nie,
// WHATSAPP_PERSONEN), Gespräch öffnen, Gelesen, Senden frei vs. Vorlage (Fenster, Genehmigung, Einzelklick, Dienstweg 403), Fehler
// von Meta (Schlüssel ungültig → EINE Glocke), Status ohne Geheimnisse, Middleware, Art. 17 + Medien-Waisen, Konto löschen.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHmac, createHash } from 'node:crypto';
import { NextRequest } from 'next/server';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-whatsapp-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-whatsapp-route';
process.env.MAKE_OS_KEY = 'dienst-test-whatsapp';

const NR_ID = '100200300400500';
const WABA = '200300400500600';
const TOKEN = 'EAAGtest' + 'Z'.repeat(120);
const GEHEIM = 'f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5';
const VERIFY = 'c'.repeat(48);
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
let webhook: { GET: H; POST: H }, senden: { POST: H }, vorlagen: { GET: H }, status: { GET: H; POST: H }, medien: { GET: H }, inbox: { GET: H; POST: H }, gespraech: { GET: H };
let middleware: typeof import('@/middleware').middleware;

/** Was an „Meta“ ging (nur Methode, Pfad, Körper — der Schlüssel wird geprüft, nie gespeichert). */
let aufrufe: { methode: string; url: string; body?: unknown; auth: boolean }[] = [];
let antwortSenden: (body: unknown) => { status: number; json: unknown } = () => ({ status: 200, json: { messaging_product: 'whatsapp', contacts: [{ wa_id: KUNDE }], messages: [{ id: `wamid.OUT${aufrufe.length}abcdef` }] } });
const BILD = Buffer.from('ein-erfundenes-bild-nur-fuer-den-test');
const VORLAGEN = [
  { name: 'termin_erinnerung', language: 'de', status: 'APPROVED', category: 'UTILITY', components: [{ type: 'BODY', text: 'Hallo {{1}}, wir sehen uns am {{2}}.' }] },
  { name: 'angebot_neu', language: 'de', status: 'PENDING', category: 'MARKETING', components: [{ type: 'BODY', text: 'Neu: {{1}}' }] },
  { name: 'abend_einladung', language: 'de', status: 'APPROVED', category: 'MARKETING', components: [{ type: 'BODY', text: 'Einladung: {{1}}' }] },
];

async function metaFake(url: string, init: RequestInit): Promise<Response> {
  const u = new URL(url);
  const auth = (init.headers as Record<string, string>)?.Authorization === `Bearer ${TOKEN}`;
  const body = init.body ? JSON.parse(String(init.body)) : undefined;
  aufrufe.push({ methode: init.method ?? 'GET', url: `${u.origin}${u.pathname}`, ...(body ? { body } : {}), auth });
  const json = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
  if (!auth) return json(401, { error: { code: 190, message: 'Invalid OAuth access token - token=geheim' } });
  if (u.hostname === 'lookaside.fbsbx.com') return new Response(BILD, { status: 200, headers: { 'content-length': String(BILD.length) } });
  if (u.pathname === `/${G.GRAPH_VERSION}/${NR_ID}/messages`) { const r = antwortSenden(body); return json(r.status, r.json); }
  if (u.pathname === `/${G.GRAPH_VERSION}/${NR_ID}/register`) return json(200, { success: true });
  if (u.pathname === `/${G.GRAPH_VERSION}/${WABA}/message_templates`) return json(200, { data: VORLAGEN });
  if (u.pathname === `/${G.GRAPH_VERSION}/${NR_ID}`) return json(200, { display_phone_number: '+49 30 0000 0000', verified_name: 'Beispiel Innovation', quality_rating: 'GREEN', throughput: { level: 'STANDARD' }, id: NR_ID });
  if (/^\/v\d+\.0\/\d+$/.test(u.pathname)) return json(200, { url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1', mime_type: 'image/jpeg', sha256: createHash('sha256').update(BILD).digest('hex'), file_size: BILD.length, id: u.pathname.split('/').pop(), messaging_product: 'whatsapp' });
  return json(404, { error: { code: 100 } });
}

const sig = (roh: string, g = GEHEIM) => `sha256=${createHmac('sha256', g).update(roh).digest('hex')}`;
const T = () => String(Math.floor(Date.now() / 1000));
const koerper = (werte: Record<string, unknown>, nummerId = NR_ID) => JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: WABA, changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '4930000000', phone_number_id: nummerId }, ...werte } }] }] });
const textNachricht = (id: string, text: string, von = KUNDE, ts = T(), name = von === KUNDE ? 'Erika Beispiel' : 'Max Andere') => ({ contacts: [{ profile: { name }, wa_id: von }], messages: [{ from: von, id, timestamp: ts, type: 'text', text: { body: text } }] });
const post = (roh: string, kopf: Record<string, string | null> = {}) => {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  for (const [k, v] of Object.entries(kopf)) if (v !== null) h[k] = v;
  if (!('x-hub-signature-256' in kopf)) h['x-hub-signature-256'] = sig(roh);
  return webhook.POST(new Request('http://localhost/api/whatsapp/webhook', { method: 'POST', headers: h, body: roh }));
};
const ich = (person: string, extra: Record<string, string> = {}) => ({ 'content-type': 'application/json', 'x-make-user': person, ...extra });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-forwarded-for': '127.0.0.1', ...(person ? { 'x-make-person': person } : {}) });
const anfrage = (pfad: string, kopf: Record<string, string>, methode = 'GET', body?: unknown) => new Request(`http://localhost${pfad}`, { method: methode, headers: kopf, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const GID = () => `wa~${K.postfachIdFuer(NR_ID)}~${KUNDE}`;
const warte = async (bis: () => Promise<boolean>) => { for (let i = 0; i < 100; i++) { if (await bis()) return; await new Promise(r => setTimeout(r, 20)); } throw new Error('Zeit abgelaufen'); };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  G = await import('@/lib/whatsapp/graph'); S = await import('@/lib/whatsapp/spiegel'); K = await import('@/lib/whatsapp/konfig');
  webhook = await import('../app/api/whatsapp/webhook/route') as typeof webhook;
  senden = await import('../app/api/whatsapp/senden/route') as typeof senden;
  vorlagen = await import('../app/api/whatsapp/vorlagen/route') as typeof vorlagen;
  status = await import('../app/api/whatsapp/status/route') as typeof status;
  medien = await import('../app/api/whatsapp/medien/route') as typeof medien;
  inbox = await import('../app/api/inbox/route') as typeof inbox;
  gespraech = await import('../app/api/inbox/gespraech/route') as typeof gespraech;
  ({ middleware } = await import('@/middleware'));
});
afterAll(() => { G._fetchSetzen(null); vi.unstubAllEnvs(); vi.unstubAllGlobals(); rmSync(ordner, { recursive: true, force: true }); });

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  (await import('@/lib/zugang/drossel'))._zuruecksetzen();
  (await import('@/lib/whatsapp/senden'))._bremseZuruecksetzen();
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.stubGlobal('fetch', async (u: string) => { throw new Error(`Kein Netz im Test: ${u}`); });
  G._fetchSetzen(metaFake);
  aufrufe = [];
  antwortSenden = () => ({ status: 200, json: { messaging_product: 'whatsapp', contacts: [{ wa_id: KUNDE }], messages: [{ id: `wamid.OUT${aufrufe.length}abcdef` }] } });
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'kevin@example.invalid', name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
    { id: 'k2', speicher: 'malin', email: 'malin@example.invalid', name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
    { id: 'k4', speicher: 'gast', email: 'gast@example.invalid', name: 'Gast', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'anderer' },
  ], einladungen: [] });
});

describe('Webhook: Verifizierung (GET)', () => {
  const get = (q: string) => webhook.GET(new Request(`http://localhost/api/whatsapp/webhook?${q}`));
  it('richtiges Verify-Token → 200 mit genau der Challenge (text/plain)', async () => {
    const r = await get(`hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=1158201444`);
    expect(r.status).toBe(200); expect(await r.text()).toBe('1158201444'); expect(r.headers.get('content-type')).toMatch(/text\/plain/);
  });
  it('falsches Token → 403 ohne Inhalt; nach zehn Fehlversuchen gedrosselt (429)', async () => {
    const r = await get('hub.mode=subscribe&hub.verify_token=falsch&hub.challenge=1');
    expect(r.status).toBe(403); expect(await r.text()).toBe('');
    for (let i = 0; i < 12; i++) await get('hub.mode=subscribe&hub.verify_token=falsch&hub.challenge=1');
    expect((await get(`hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=1`)).status).toBe(429);
  });
  it('ohne Einrichtung gibt es keinen Webhook (404) — auch POST', async () => {
    vi.stubEnv('WHATSAPP_APP_GEHEIMNIS', '');
    expect((await get(`hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=1`)).status).toBe(404);
    expect((await post(koerper(textNachricht('wamid.X0000001', 'x')))).status).toBe(404);
  });
});

describe('Webhook: Meldungen (POST)', () => {
  it('gültige Signatur → 200 leer, Nachricht im Spiegel, Zähler + „zuletzt empfangen“', async () => {
    const r = await post(koerper(textNachricht('wamid.T1000001', 'Hallo, bis Freitag bitte das Angebot')));
    expect(r.status).toBe(200); expect(await r.text()).toBe('');
    const s = await S.ladeWaSpiegel();
    expect(s.nachrichten['wamid.T1000001']).toMatchObject({ nummer: KUNDE, richtung: 'ein', text: 'Hallo, bis Freitag bitte das Angebot' });
    expect((await S.ladeWaZustand()).webhook).toMatchObject({ anzahl: 1 });
  });
  it('ungültige/fehlende Signatur, manipulierter Körper → 403, nichts gespeichert, Ablehnung gezählt', async () => {
    const roh = koerper(textNachricht('wamid.T1000002', 'x'));
    expect((await post(roh, { 'x-hub-signature-256': sig(roh, 'falsches-geheimnis-12345678') })).status).toBe(403);
    expect((await post(roh, { 'x-hub-signature-256': null })).status).toBe(403);
    expect((await post(roh.replace('"x"', '"y"'), { 'x-hub-signature-256': sig(roh) })).status).toBe(403);
    expect(Object.keys((await S.ladeWaSpiegel()).nachrichten)).toEqual([]);
    expect((await S.ladeWaZustand()).webhook?.abgelehnt).toBe(3);
  });
  it('Körpergrenze → 413; kaputtes JSON mit gültiger Signatur → 400', async () => {
    const gross = koerper({ messages: [{ from: KUNDE, id: 'wamid.G1000001', type: 'text', text: { body: 'x'.repeat(600 * 1024) } }] });
    expect((await post(gross)).status).toBe(413);
    expect((await post('{kaputt')).status).toBe(400);
  });
  it('idempotent: Meta schickt dieselbe Meldung erneut → eine Nachricht', async () => {
    const roh = koerper(textNachricht('wamid.T1000003', 'Einmal'));
    expect((await post(roh)).status).toBe(200);
    expect((await post(roh)).status).toBe(200);
    expect(Object.keys((await S.ladeWaSpiegel()).nachrichten)).toEqual(['wamid.T1000003']);
  });
  it('fremde Telefonnummer-ID (gleiches Konto) → bestätigt, nicht verarbeitet', async () => {
    expect((await post(koerper(textNachricht('wamid.T1000004', 'x'), '999999999999'))).status).toBe(200);
    expect(Object.keys((await S.ladeWaSpiegel()).nachrichten)).toEqual([]);
  });
  it('Bild: Medium wird geladen (Meta-Host, Schlüssel nur im Kopf), verschlüsselt abgelegt und nur für Berechtigte ausgeliefert', async () => {
    const roh = koerper({ messages: [{ from: KUNDE, id: 'wamid.B1000001', timestamp: T(), type: 'image', image: { id: '7777777777', mime_type: 'image/jpeg', caption: 'Beleg' } }] });
    expect((await post(roh)).status).toBe(200);
    await warte(async () => { db.leseCacheLeeren(); return (await S.ladeWaSpiegel()).nachrichten['wamid.B1000001']?.medium?.zustand === 'abgelegt'; });
    expect(aufrufe.every(a => a.auth)).toBe(true);
    expect(aufrufe.map(a => a.url)).toEqual([`${G.GRAPH_BASIS}/7777777777`, 'https://lookaside.fbsbx.com/whatsapp_business/attachments/']);
    const datei = (await S.ladeWaSpiegel()).nachrichten['wamid.B1000001'].medium!.datei!;
    const platte = readFileSync(path.join(ordner, 'whatsapp-medien', datei));
    expect(platte.subarray(0, 7).toString('ascii')).toBe('MKOSDAT');
    expect(platte.includes(BILD)).toBe(false);
    const r = await medien.GET(anfrage('/api/whatsapp/medien?id=wamid.B1000001', ich('kevin')));
    expect(r.status).toBe(200); expect(r.headers.get('content-disposition')).toMatch(/attachment/); expect(Buffer.from(await r.arrayBuffer())).toEqual(BILD);
    expect((await medien.GET(anfrage('/api/whatsapp/medien?id=wamid.B1000001', ich('gast')))).status).toBe(403);
    expect((await medien.GET(anfrage('/api/whatsapp/medien?id=wamid.B1000001', dienst('kevin')))).status).toBe(403);
  });
});

describe('Strom der Inbox: Bereichstrennung und Zugang', () => {
  beforeEach(async () => { await post(koerper(textNachricht('wamid.T2000001', 'Guten Tag'))); });
  const strom = async (person: string, q = '') => { const r = await inbox.GET(anfrage(`/api/inbox${q}`, ich(person))); return { status: r.status, j: r.status === 200 ? await r.json() as { gespraeche: { id: string; quelle: string; bereich: string; whatsapp?: { fenster: { offen: boolean } } }[]; postfaecher: { id: string; quelle: string; adresse: string }[] } : null }; };
  it('Kevin und Malin sehen das Gespräch (Business, Fenster offen) — mit Postfach der Nummer', async () => {
    for (const p of ['kevin', 'malin']) {
      const { j } = await strom(p);
      const g = j!.gespraeche.find(x => x.quelle === 'whatsapp')!;
      expect(g).toMatchObject({ id: GID(), bereich: 'ug' });
      expect(g.whatsapp!.fenster.offen).toBe(true);
      expect(j!.postfaecher.some(x => x.quelle === 'whatsapp' && x.id === K.postfachIdFuer(NR_ID))).toBe(true);
    }
  });
  it('Sicht „Privat“ bekommt die Business-Nummer NIE; „Business“ und der Bereich ug schon', async () => {
    expect((await strom('kevin', '?space=privat')).j!.gespraeche.some(x => x.quelle === 'whatsapp')).toBe(false);
    expect((await strom('kevin', '?space=privat')).j!.postfaecher.some(x => x.quelle === 'whatsapp')).toBe(false);
    expect((await strom('kevin', '?space=business')).j!.gespraeche.some(x => x.quelle === 'whatsapp')).toBe(true);
    expect((await strom('kevin', '?bereich=ug')).j!.gespraeche.some(x => x.quelle === 'whatsapp')).toBe(true);
    expect((await strom('kevin', '?bereich=kdv')).j!.gespraeche.some(x => x.quelle === 'whatsapp')).toBe(false);
  });
  it('fremder Haushalt → 403; WHATSAPP_PERSONEN=kevin → Malin sieht nichts davon', async () => {
    expect((await strom('gast')).status).toBe(403);
    vi.stubEnv('WHATSAPP_PERSONEN', 'kevin');
    expect((await strom('malin')).j!.gespraeche.some(x => x.quelle === 'whatsapp')).toBe(false);
    expect((await strom('kevin')).j!.gespraeche.some(x => x.quelle === 'whatsapp')).toBe(true);
    expect((await gespraech.GET(anfrage(`/api/inbox/gespraech?id=${GID()}`, ich('malin')))).status).toBe(404);
  });
  it('Gespräch öffnen: Nachrichten mit Text; „gelesen“ setzt gelesen bis (ohne Lesebestätigung an Meta)', async () => {
    const r = await gespraech.GET(anfrage(`/api/inbox/gespraech?id=${GID()}`, ich('kevin')));
    expect(r.status).toBe(200);
    const j = await r.json() as { nachrichten: { text: string; vonUns: boolean }[]; gespraech: { ungelesen: boolean } };
    expect(j.nachrichten).toEqual([expect.objectContaining({ text: 'Guten Tag', vonUns: false })]);
    expect(j.gespraech.ungelesen).toBe(true);
    const a = await inbox.POST(anfrage('/api/inbox', ich('kevin'), 'POST', { aktion: 'gelesen', id: GID() }));
    expect(a.status).toBe(200);
    db.leseCacheLeeren();
    expect((await strom('kevin')).j!.gespraeche.find(x => x.id === GID())).toMatchObject({ ungelesen: false });
    expect(aufrufe).toEqual([]);
  });
});

describe('Senden: frei vs. Vorlage, Einzelklick', () => {
  beforeEach(async () => { await post(koerper(textNachricht('wamid.T3000001', 'Bitte um Rückruf'))); aufrufe = []; });
  const sende = (person: string, body: Record<string, unknown>, kopf: Record<string, string> = ich(person)) => senden.POST(anfrage('/api/whatsapp/senden', kopf, 'POST', body));
  it('frei im offenen Fenster → an Meta (Text, eine Nummer), im Spiegel als ausgehend; Antwort ohne Schlüssel', async () => {
    const r = await sende('kevin', { gespraech: GID(), art: 'frei', text: 'Gern, ich rufe heute an.', anfrageId: 'anfrage-wa-0001' });
    const t = await r.text();
    expect(r.status).toBe(200); expect(t).not.toContain(TOKEN.slice(0, 20));
    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0]).toMatchObject({ methode: 'POST', url: `${G.GRAPH_BASIS}/${NR_ID}/messages`, body: { messaging_product: 'whatsapp', recipient_type: 'individual', to: KUNDE, type: 'text', text: { preview_url: false, body: 'Gern, ich rufe heute an.' } } });
    const id = (JSON.parse(t) as { id: string }).id;
    expect((await S.ladeWaSpiegel()).nachrichten[id]).toMatchObject({ richtung: 'aus', status: 'angenommen', von: 'kevin' });
    // Dieselbe Anfrage-Kennung noch einmal → nichts doppelt
    (await import('@/lib/whatsapp/senden'))._bremseZuruecksetzen();
    expect((await sende('kevin', { gespraech: GID(), art: 'frei', text: 'Gern, ich rufe heute an.', anfrageId: 'anfrage-wa-0001' })).status).toBe(200);
    expect(aufrufe).toHaveLength(1);
  });
  it('frei bei geschlossenem Fenster → 409 „fenster“ mit klarer Meldung, nichts an Meta', async () => {
    await S.aendereWaSpiegel(s => ({ ...s, kontakte: { ...s.kontakte, [KUNDE]: { ...s.kontakte[KUNDE], zuletztEingehend: new Date(Date.now() - 25 * 3600_000).toISOString() } } }));
    const r = await sende('kevin', { gespraech: GID(), art: 'frei', text: 'Hallo?' });
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ art: 'fenster', fehler: expect.stringMatching(/24-Stunden-Fenster ist zu/) });
    expect(aufrufe).toEqual([]);
  });
  it('Vorlage jederzeit (auch bei geschlossenem Fenster): genehmigt, Platzhalter vollständig → template mit Parametern', async () => {
    await S.aendereWaSpiegel(s => ({ ...s, kontakte: { ...s.kontakte, [KUNDE]: { ...s.kontakte[KUNDE], zuletztEingehend: new Date(Date.now() - 48 * 3600_000).toISOString() } } }));
    const r = await sende('malin', { gespraech: GID(), art: 'vorlage', vorlage: { name: 'termin_erinnerung', sprache: 'de', parameter: ['Erika', 'Montag'] } });
    expect(r.status).toBe(200);
    const s = aufrufe.find(a => a.methode === 'POST')!;
    expect(s.body).toEqual({ messaging_product: 'whatsapp', recipient_type: 'individual', to: KUNDE, type: 'template', template: { name: 'termin_erinnerung', language: { code: 'de' }, components: [{ type: 'body', parameters: [{ type: 'text', text: 'Erika' }, { type: 'text', text: 'Montag' }] }] } });
    const aus = Object.values((await S.ladeWaSpiegel()).nachrichten).find(n => n.richtung === 'aus')!;
    expect(aus).toMatchObject({ art: 'vorlage', text: 'Hallo Erika, wir sehen uns am Montag.', von: 'malin', vorlage: { name: 'termin_erinnerung', sprache: 'de' } });
  });
  it('Vorlage nicht genehmigt bzw. falsche Platzhalter-Zahl → 409/400, nichts gesendet', async () => {
    const a = await sende('kevin', { gespraech: GID(), art: 'vorlage', vorlage: { name: 'angebot_neu', sprache: 'de', parameter: ['x'] } });
    expect(a.status).toBe(409); expect((await a.json() as { art: string }).art).toBe('vorlage');
    const b = await sende('kevin', { gespraech: GID(), art: 'vorlage', vorlage: { name: 'termin_erinnerung', sprache: 'de', parameter: ['nur einer'] } });
    expect(b.status).toBe(400);
    expect(aufrufe.filter(x => x.methode === 'POST')).toEqual([]);
  });
  // Kevin 07.10.: Werbe-Vorlagen (MARKETING) nur mit nachgewiesener Einwilligung „WhatsApp“ — ohne zugeordnete Akte nie.
  it('Werbe-Vorlage: ohne Akte 409, Akte ohne WhatsApp-Einwilligung 409 (Mail-Einwilligung zählt nicht), mit Einwilligung → gesendet', async () => {
    const vorl = { gespraech: GID(), art: 'vorlage', vorlage: { name: 'abend_einladung', sprache: 'de', parameter: ['Fokus Innovation Berlin'] } };
    const bremse = async () => (await import('@/lib/whatsapp/senden'))._bremseZuruecksetzen();
    const a = await sende('kevin', vorl);
    expect(a.status).toBe(409); expect((await a.json() as { fehler: string }).fehler).toMatch(/zugeordnete Person mit Einwilligung „WhatsApp“/);
    const ew = (kanal: string) => ({ kanal, grundlage: 'einwilligung', erteiltAm: '2026-10-01', nachweis: 'Formular', zeitpunkt: '2026-10-01T09:00:00.000Z', erfasstVon: 'kevin', wortlaut: 'Ja, ich möchte Einladungen per WhatsApp erhalten.', belegRef: 'd-1' });
    const akte = (einwilligungen: unknown[]) => ({ id: 'c-erika', vorname: 'Erika', nachname: 'Beispiel', telefon: `+${KUNDE}`, stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie', einwilligungen });
    await db.saveJson('kontakte', { kontakte: [akte([ew('mail')])] });
    await bremse();
    const b = await sende('kevin', vorl);
    expect(b.status).toBe(409); expect((await b.json() as { fehler: string }).fehler).toMatch(/Einwilligung „WhatsApp“/);
    expect(aufrufe.filter(x => x.methode === 'POST')).toEqual([]);
    await db.saveJson('kontakte', { kontakte: [akte([ew('whatsapp')])] });
    await bremse();
    const c = await sende('kevin', vorl);
    expect(c.status).toBe(200);
    expect(aufrufe.filter(x => x.methode === 'POST')).toHaveLength(1);
  });
  it('Dienstweg (ZOE/Takt) → 403; fremder Haushalt → 403; zwei Klicks binnen 2 s → 429', async () => {
    expect((await sende('kevin', { gespraech: GID(), art: 'frei', text: 'x' }, dienst('kevin'))).status).toBe(403);
    expect((await sende('gast', { gespraech: GID(), art: 'frei', text: 'x' })).status).toBe(403);
    expect((await sende('kevin', { gespraech: GID(), art: 'frei', text: 'eins' })).status).toBe(200);
    expect((await sende('kevin', { gespraech: GID(), art: 'frei', text: 'zwei' })).status).toBe(429);
  });
  it('Meta lehnt ab: Fenster zu (131047) → 409 „fenster“; Limit (130429) → 429; Rohtext von Meta nie in der Antwort', async () => {
    antwortSenden = () => ({ status: 400, json: { error: { code: 131047, message: 'Re-engagement message — interne Details' } } });
    const a = await sende('kevin', { gespraech: GID(), art: 'frei', text: 'x' });
    expect(a.status).toBe(409); const ta = await a.text(); expect(ta).toContain('fenster'); expect(ta).not.toContain('interne Details');
    (await import('@/lib/whatsapp/senden'))._bremseZuruecksetzen();
    antwortSenden = () => ({ status: 429, json: { error: { code: 130429 } } });
    expect((await sende('kevin', { gespraech: GID(), art: 'frei', text: 'y' })).status).toBe(429);
  });
  it('Schlüssel ungültig (190) → 502 „Verbindung erneuern“ + EINE Glocke je Person mit Zugang; Status zeigt „token“', async () => {
    vi.stubEnv('WHATSAPP_ZUGRIFFSSCHLUESSEL', 'EAAGabgelaufen' + 'Q'.repeat(100));
    const r = await sende('kevin', { gespraech: GID(), art: 'frei', text: 'x' });
    expect(r.status).toBe(502); expect(await r.json()).toMatchObject({ art: 'token', erneuern: true });
    (await import('@/lib/whatsapp/senden'))._bremseZuruecksetzen();
    await sende('kevin', { gespraech: GID(), art: 'frei', text: 'y' });
    for (const p of ['kevin', 'malin']) {
      const m = await db.loadJson<{ eintraege: { art: string; titel: string }[] }>(`meldungen--${p}`);
      expect(m!.eintraege.filter(x => x.art === 'postfach' && /WhatsApp/.test(x.titel))).toHaveLength(1);
    }
    const st = await (await status.GET(anfrage('/api/whatsapp/status', ich('kevin')))).json() as { verbindung: string };
    expect(st.verbindung).toBe('token');
  });
});

describe('Vorlagen und Status', () => {
  it('Vorlagen: nur mit Zugang; genehmigte zuerst; Cache', async () => {
    const r = await vorlagen.GET(anfrage('/api/whatsapp/vorlagen', ich('kevin')));
    const j = await r.json() as { vorlagen: { name: string; status: string; parameter: string[] }[] };
    expect(j.vorlagen.map(v => [v.name, v.status])).toEqual([['abend_einladung', 'APPROVED'], ['termin_erinnerung', 'APPROVED'], ['angebot_neu', 'PENDING']]);
    expect(j.vorlagen.find(v => v.name === 'termin_erinnerung')!.parameter).toEqual(['1', '2']);
    await vorlagen.GET(anfrage('/api/whatsapp/vorlagen', ich('kevin')));
    expect(aufrufe.filter(a => a.url.endsWith('/message_templates'))).toHaveLength(1);
    await vorlagen.GET(anfrage('/api/whatsapp/vorlagen?neu=1', ich('kevin')));
    expect(aufrufe.filter(a => a.url.endsWith('/message_templates'))).toHaveLength(2);
    expect((await vorlagen.GET(anfrage('/api/whatsapp/vorlagen', ich('gast')))).status).toBe(403);
    expect((await vorlagen.GET(anfrage('/api/whatsapp/vorlagen', dienst('kevin')))).status).toBe(403);
  });
  it('Status: Nummer, Anzeigename, Qualität, Webhook — und NIE Schlüssel, App-Geheimnis oder Verify-Token', async () => {
    await post(koerper(textNachricht('wamid.T4000001', 'Hallo')));
    const t = await (await status.POST(anfrage('/api/whatsapp/status', ich('kevin'), 'POST', { aktion: 'pruefen' }))).text();
    const j = JSON.parse(t);
    expect(j).toMatchObject({ eingerichtet: true, zugang: true, nummer: '+49 30 0000 0000', anzeigename: 'Beispiel Innovation', qualitaet: 'GREEN', durchsatz: 'STANDARD', verbindung: 'ok', bereich: 'ug', webhookAdresse: 'https://app.makeinnovation.test/api/whatsapp/webhook', webhook: { anzahl: 1 } });
    for (const geheim of [TOKEN, GEHEIM, VERIFY, NR_ID, WABA]) expect(t).not.toContain(geheim);
  });
  it('Status ohne Einrichtung: nur die NAMEN der fehlenden Variablen; ohne Zugang keine Einzelheiten', async () => {
    vi.stubEnv('WHATSAPP_ZUGRIFFSSCHLUESSEL', '');
    const a = await (await status.GET(anfrage('/api/whatsapp/status', ich('kevin')))).json();
    expect(a).toMatchObject({ eingerichtet: false, fehlend: ['WHATSAPP_ZUGRIFFSSCHLUESSEL'] });
    vi.stubEnv('WHATSAPP_ZUGRIFFSSCHLUESSEL', TOKEN); vi.stubEnv('WHATSAPP_PERSONEN', 'kevin');
    const b = await (await status.GET(anfrage('/api/whatsapp/status', ich('malin')))).json();
    expect(b).toEqual({ ok: true, webhookAdresse: 'https://app.makeinnovation.test/api/whatsapp/webhook', eingerichtet: true, fehlend: [], zugang: false, verbindung: 'ungeprueft' });
    expect((await status.GET(anfrage('/api/whatsapp/status', dienst('kevin')))).status).toBe(403);
  });
});

describe('Nummer registrieren (einmalig, nur der Inhaber)', () => {
  const reg = (person: string, body: Record<string, unknown>) => status.POST(anfrage('/api/whatsapp/status', ich(person), 'POST', { aktion: 'registrieren', ...body }));
  it('Inhaber mit 6-stelliger PIN und Speicherort DE → POST /register mit data_localization_region DE; die PIN wird nirgends gespeichert', async () => {
    const r = await reg('kevin', { pin: '123456', speicherort: 'DE' });
    expect(r.status).toBe(200);
    expect(aufrufe.find(a => a.url.endsWith('/register'))!.body).toEqual({ messaging_product: 'whatsapp', pin: '123456', data_localization_region: 'DE' });
    const z = await S.ladeWaZustand();
    expect(z.registriert).toMatchObject({ speicherort: 'DE' });
    for (const f of readdirSync(ordner)) if (f.endsWith('.json')) expect(readFileSync(path.join(ordner, f), 'utf8')).not.toContain('123456');
  });
  it('ohne Local Storage: kein data_localization_region; Malin (nicht Inhaber) → 403; falsche PIN → 400; Dienstweg → 403', async () => {
    expect((await reg('kevin', { pin: '654321', speicherort: 'ohne' })).status).toBe(200);
    expect(aufrufe.find(a => a.url.endsWith('/register'))!.body).toEqual({ messaging_product: 'whatsapp', pin: '654321' });
    expect((await reg('malin', { pin: '123456', speicherort: 'DE' })).status).toBe(403);
    expect((await reg('kevin', { pin: '12345', speicherort: 'DE' })).status).toBe(400);
    expect((await reg('kevin', { pin: '123456' })).status).toBe(400);
    expect((await status.POST(anfrage('/api/whatsapp/status', dienst('kevin'), 'POST', { aktion: 'registrieren', pin: '123456', speicherort: 'DE' }))).status).toBe(403);
  });
});

describe('Middleware: genau der Webhook ist ohne Sitzung offen', () => {
  const mw = (pfad: string, methode = 'GET') => middleware(new NextRequest(`https://app.makeinnovation.test${pfad}`, { method: methode, headers: { 'content-type': 'application/json' } }));
  it('GET/POST /api/whatsapp/webhook ohne Sitzung kommen durch (die Route prüft selbst); alles andere → 401', async () => {
    vi.stubEnv('SESSION_SECRET', 's'.repeat(40));
    expect((await mw('/api/whatsapp/webhook?hub.mode=subscribe')).status).not.toBe(401);
    expect((await mw('/api/whatsapp/webhook', 'POST')).status).not.toBe(401);
    expect((await mw('/api/whatsapp/senden', 'POST')).status).toBe(401);
    expect((await mw('/api/whatsapp/status')).status).toBe(401);
    expect((await mw('/api/whatsapp/webhook/x', 'POST')).status).toBe(401);
  });
});

describe('Art. 17 und Konto löschen', () => {
  it('Kontakt mit der Nummer löschen → Nachrichten + Gesprächspartner weg, Mediendatei beim nächsten Takt weg', async () => {
    await post(koerper({ ...textNachricht('wamid.T5000001', 'Hallo'), messages: [{ from: KUNDE, id: 'wamid.B5000001', timestamp: T(), type: 'image', image: { id: '7777777778', mime_type: 'image/jpeg' } }] }));
    await post(koerper(textNachricht('wamid.T5000002', 'Andere Person', '4917099999999')));
    await warte(async () => { db.leseCacheLeeren(); return (await S.ladeWaSpiegel()).nachrichten['wamid.B5000001']?.medium?.zustand === 'abgelegt'; });
    const { weitereEntfernen, weitereAufzaehlen, merkmaleVon } = await import('@/lib/crm/person-weitere');
    const m = merkmaleVon('c-1', { vorname: 'Erika', nachname: 'Beispiel', telefon: '0151 1234 5678' });
    expect((await weitereAufzaehlen(m))['whatsapp-spiegel']).toBe(2);
    const r = await weitereEntfernen(m);
    expect(r.speicher['whatsapp-spiegel']).toBe(2);
    db.leseCacheLeeren();
    const s = await S.ladeWaSpiegel();
    expect(Object.keys(s.nachrichten)).toEqual(['wamid.T5000002']);
    expect(Object.keys(s.kontakte)).toEqual(['4917099999999']);
    const dateien = readdirSync(path.join(ordner, 'whatsapp-medien'));
    expect(dateien).toHaveLength(1);
    const alt = new Date(Date.now() - 3600_000);
    utimesSync(path.join(ordner, 'whatsapp-medien', dateien[0]), alt, alt);
    await (await import('@/lib/whatsapp/takt')).whatsappJobsImTakt();
    expect(existsSync(path.join(ordner, 'whatsapp-medien', dateien[0]))).toBe(false);
  });
  it('Konto löschen: gesendete Nachrichten bleiben, „wer gesendet hat“ wird „[gelöscht]“; Export enthält die eigenen', async () => {
    await post(koerper(textNachricht('wamid.T6000001', 'Hallo')));
    expect((await senden.POST(anfrage('/api/whatsapp/senden', ich('malin'), 'POST', { gespraech: GID(), art: 'frei', text: 'Antwort von Malin' }))).status).toBe(200);
    const { kontoExport, kontoLoeschen } = await import('@/lib/datenschutz/konto-daten');
    const ex = await kontoExport('malin');
    expect(ex!.eintraege['whatsapp-spiegel']).toEqual([expect.objectContaining({ text: 'Antwort von Malin', art: 'text' })]);
    expect(JSON.stringify(ex!.eintraege['whatsapp-spiegel'])).not.toContain(KUNDE);
    await kontoLoeschen('malin', { grabstein: false });
    db.leseCacheLeeren();
    const aus = Object.values((await S.ladeWaSpiegel()).nachrichten).find(n => n.richtung === 'aus')!;
    expect(aus.von).toBe('[gelöscht]');
  });
  it('Frist: alte Nachrichten fallen weg, Medien vor der Medien-Frist werden „abgelaufen“', async () => {
    const vor = String(Math.floor(Date.parse('2026-01-02T10:00:00Z') / 1000));
    await post(koerper(textNachricht('wamid.T7000001', 'sehr alt', KUNDE, vor)));
    await post(koerper(textNachricht('wamid.T7000002', 'neu')));
    const { whatsappAufraeumen } = await import('@/lib/whatsapp/aufraeumen');
    const r = await whatsappAufraeumen('2026-04-01', '2026-07-01');
    expect(r.nachrichten).toBe(1);
    db.leseCacheLeeren();
    expect(Object.keys((await S.ladeWaSpiegel()).nachrichten)).toEqual(['wamid.T7000002']);
  });
});
