// ─── Wächter: Anbieter-Tor auf dem Server (09.10.2026, Paket 6a) ──────────────────────────────────────────────────────────────
// Eigener Datenordner, erfundene Personen (@example.invalid), nachgebaute Anbieter (kein Netz): askText ohne Konfiguration wie heute,
// mit Tor Gesundheit nur EU+ZDR (sonst gesperrt, nie Rückfall), Instanz-Budget mit Glocke, Bilder mit unveränderter Kennzeichnung,
// Video/Tiefenbericht nur mit Klick, Sicht je Haushalt/Person.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ki-anbieter-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-anbieter';
process.env.MAKE_OS_OHNE_APPLE = '1';
process.env.MAKE_OS_KI_VORGABE = 'kompatibel';
process.env.ANTHROPIC_API_KEY = 'nur-test-schluessel';
delete process.env.MAKE_OS_DATENSCHLUESSEL;
delete process.env.MAKE_OS_KI_ANBIETER_TOR;
delete process.env.TRANSKRIPTION_AN;

const ENV_VERTEX = ['GOOGLE_VERTEX_PROJEKT', 'GOOGLE_VERTEX_DIENSTKONTO', 'GOOGLE_VERTEX_CLAUDE', 'GOOGLE_VERTEX_CLAUDE_REGION', 'GOOGLE_VERTEX_ZDR', 'GOOGLE_VERTEX_MEDIEN', 'MAKE_OS_KI_ANBIETER_TOR', 'MAKE_OS_KI_BUDGET_MONAT_EURO'];
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const DIENSTKONTO = Buffer.from(JSON.stringify({ type: 'service_account', client_email: 'make-os-test@test-projekt.iam.gserviceaccount.com', private_key: privateKey, token_uri: 'https://oauth2.googleapis.com/token' })).toString('base64');
function vertexEinrichten(o: { claude?: boolean; zdr?: boolean; medien?: boolean } = {}) {
  process.env.GOOGLE_VERTEX_PROJEKT = 'test-projekt-123';
  process.env.GOOGLE_VERTEX_DIENSTKONTO = DIENSTKONTO;
  if (o.claude !== false) process.env.GOOGLE_VERTEX_CLAUDE = 'an'; else delete process.env.GOOGLE_VERTEX_CLAUDE;
  if (o.zdr) process.env.GOOGLE_VERTEX_ZDR = 'bestaetigt'; else delete process.env.GOOGLE_VERTEX_ZDR;
  if (o.medien) process.env.GOOGLE_VERTEX_MEDIEN = 'an'; else delete process.env.GOOGLE_VERTEX_MEDIEN;
}

let db: typeof import('@/lib/store/local-db');
let anthropic: typeof import('@/lib/anthropic');
let ke: typeof import('@/lib/datenschutz/ki-einstellungen');
let http: typeof import('@/lib/ki/adapter/http');
let auth: typeof import('@/lib/ki/adapter/google-auth');
let aufruf: typeof import('@/lib/ki/aufruf');
let medien: typeof import('@/lib/ki/medien');

const MODELL_ANTWORT = (text = 'Erledigt.') => new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 3, output_tokens: 2 } }), { status: 200 });
const heute = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const warte = () => new Promise(r => setTimeout(r, 60));
/** Bis zu 3 s warten, bis die Bedingung gilt (Glocke und Protokoll schreiben im Hintergrund). */
async function bis(f: () => Promise<boolean>): Promise<void> { for (let i = 0; i < 60; i++) { if (await f()) return; await new Promise(r => setTimeout(r, 50)); } }

/** Nachgebauter Google (Token, Claude auf Vertex, Gemini-Bild, Video, Tiefenbericht). */
interface Aufruf { url: string; init: RequestInit }
let aufrufe: Aufruf[] = [];
const PNG_MIT_KENNZEICHNUNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('caBX-c2pa-MANIFEST-SynthID-Pruefmuster', 'utf8')]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42-c2pa-VIDEO', 'utf8')]);
function googleFake(url: string, init: RequestInit): Promise<Response> {
  aufrufe.push({ url, init });
  const j = (x: unknown) => Promise.resolve(new Response(JSON.stringify(x), { status: 200 }));
  if (url === 'https://oauth2.googleapis.com/token') return j({ access_token: 'tok-test', expires_in: 3600 });
  if (url.endsWith(':rawPredict')) return Promise.resolve(MODELL_ANTWORT('Aus der EU.'));
  if (url.endsWith(':generateContent')) return j({ candidates: [{ content: { parts: [{ text: 'Bild' }, { inlineData: { mimeType: 'image/png', data: PNG_MIT_KENNZEICHNUNG.toString('base64') } }] } }] });
  if (url.endsWith(':predictLongRunning')) return j({ name: 'projects/test-projekt-123/locations/global/publishers/google/models/gemini-omni-1.1-flash/operations/op-123' });
  if (url.endsWith(':fetchPredictOperation')) return j({ done: true, response: { videos: [{ mimeType: 'video/mp4', bytesBase64Encoded: MP4.toString('base64') }] } });
  if (url.endsWith('/interactions') && init.method === 'POST') return j({ name: 'projects/test-projekt-123/locations/global/interactions/ia-123' });
  if (url.endsWith('/interactions/ia-123')) return j({ status: 'completed', outputs: [{ type: 'text', text: 'Der Bericht.', annotations: [{ url: 'https://example.org/quelle', title: 'Quelle' }] }], groundingMetadata: { webSearchQueries: ['markt beispiel'], searchEntryPoint: { renderedContent: '<div>Vorschläge</div>' } } });
  return Promise.resolve(new Response('nicht nachgebaut', { status: 404 }));
}

async function registerSetzen(f: (e: import('@/lib/datenschutz/einrichtung').Empfaenger) => import('@/lib/datenschutz/einrichtung').Empfaenger) {
  const { EMPFAENGER_START } = await import('@/lib/datenschutz/einrichtung');
  await db.saveJson('datenschutz-einrichtung', { empfaenger: EMPFAENGER_START.map(e => f({ ...e })) });
}
const freigeben = (ids: string[]) => (e: import('@/lib/datenschutz/einrichtung').Empfaenger) => (ids.includes(e.id) ? { ...e, archiviert: undefined, avv: { status: 'bestaetigt' as const, am: '2026-10-09' } } : e);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  anthropic = await import('@/lib/anthropic');
  ke = await import('@/lib/datenschutz/ki-einstellungen');
  http = await import('@/lib/ki/adapter/http');
  auth = await import('@/lib/ki/adapter/google-auth');
  aufruf = await import('@/lib/ki/aufruf');
  medien = await import('@/lib/ki/medien');
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'lena', email: 'lena@example.invalid', name: 'Lena Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01T08:00:00.000Z', teilt: { gesundheit: [] }, haushalt: 'h-test' },
    { id: '2', speicher: 'jonas', email: 'jonas@example.invalid', name: 'Jonas Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01T08:00:00.000Z', teilt: { gesundheit: [] }, haushalt: 'h-test' },
    { id: '3', speicher: 'gast', email: 'gast@example.invalid', name: 'Gast Fremd', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01T08:00:00.000Z', teilt: { gesundheit: [] }, haushalt: 'h-fremd' },
  ], einladungen: [] });
  const ein = await import('@/lib/datenschutz/gesundheit-einwilligung');
  for (const z of ['verarbeiten', 'ki'] as const) expect((await ein.gesundheitErklaeren('lena', z, true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
  http._kiFetchSetzen(googleFake);
});
afterEach(async () => {
  vi.restoreAllMocks();
  for (const k of ENV_VERTEX) delete process.env[k];
  aufrufe = [];
  auth._tokenVergessen();
  await ke.aendereKiEinstellungen(d => ({ ...d, instanz: {} }));
  await db.saveJson('ki-verbrauch', { tage: [] });
  await db.saveJson('datenschutz-einrichtung', {});
});
afterAll(() => { http._kiFetchSetzen(null); rmSync(ordner, { recursive: true, force: true }); });

describe('Ohne Konfiguration: askText wie heute', () => {
  it('derselbe Aufruf an Anthropic direkt — Adresse, Köpfe, Körper unverändert; Kennzeichen „Anthropic“', async () => {
    const netz = vi.spyOn(globalThis, 'fetch').mockResolvedValue(MODELL_ANTWORT('Hallo.'));
    const r = await anthropic.askText({ system: 'SYS', user: 'FRAGE', zweck: 'test-gleich', model: 'claude-sonnet-5', ki: { lauf: 'aufruf', person: 'lena', kategorien: ['crm'] } });
    expect(r).toMatchObject({ ok: true, text: 'Hallo.', anbieter: 'anthropic' });
    expect(netz).toHaveBeenCalledTimes(1);
    const [url, init] = netz.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'x-api-key': 'nur-test-schluessel', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({ model: 'claude-sonnet-5', max_tokens: 4000, system: 'SYS', messages: [{ role: 'user', content: 'FRAGE' }] });
    expect(aufrufe).toEqual([]); // kein Weg über die neuen Adapter
  });
  it('Gesundheit mit Einwilligung geht ohne Tor wie bisher an Anthropic direkt (erst MAKE_OS_KI_ANBIETER_TOR=an erzwingt die EU)', async () => {
    const netz = vi.spyOn(globalThis, 'fetch').mockResolvedValue(MODELL_ANTWORT());
    const r = await anthropic.askText({ system: 'x', user: 'y', zweck: 'test-g-heute', ki: { lauf: 'aufruf', person: 'lena', kategorien: ['gesundheit'] } });
    expect(r.ok).toBe(true);
    expect(netz).toHaveBeenCalledTimes(1);
  });
});

describe('Mit Anbieter-Tor: Gesundheit nur EU + ZDR, Rückfall nie schwächer', () => {
  it('ohne Vertex EU: Gesundheit gesperrt mit klarem Satz, kein Byte geht hinaus', async () => {
    process.env.MAKE_OS_KI_ANBIETER_TOR = 'an';
    const netz = vi.spyOn(globalThis, 'fetch');
    const r = await anthropic.askText({ system: 'x', user: 'Recovery 40', zweck: 'test-g-tor', ki: { lauf: 'aufruf', person: 'lena', kategorien: ['gesundheit'] } });
    expect(r.error).toBe('ki-gesperrt:anbieter-stufe');
    expect(anthropic.kiSperrText(r)).toMatch(/nur an eine KI in der EU/);
    expect(netz).not.toHaveBeenCalled();
    expect(aufrufe).toEqual([]);
  });
  it('Vertex EU mit ZDR und bestätigtem AVV: Gesundheit über Vertex (Körper ohne model, mit anthropic_version), Protokoll mit Anbieter', async () => {
    process.env.MAKE_OS_KI_ANBIETER_TOR = 'an';
    vertexEinrichten({ zdr: true });
    await registerSetzen(freigeben(['google-vertex']));
    const netz = vi.spyOn(globalThis, 'fetch');
    const r = await anthropic.askText({ system: 'SYS', user: 'FRAGE', zweck: 'test-g-eu', model: 'claude-sonnet-5', ki: { lauf: 'aufruf', person: 'lena', kategorien: ['gesundheit'] } });
    expect(r).toMatchObject({ ok: true, text: 'Aus der EU.', anbieter: 'anthropic-vertex-eu' });
    expect(netz).not.toHaveBeenCalled();
    const roh = aufrufe.find(a => a.url.endsWith(':rawPredict'))!;
    expect(roh.url).toBe('https://aiplatform.eu.rep.googleapis.com/v1/projects/test-projekt-123/locations/eu/publishers/anthropic/models/claude-sonnet-5:rawPredict');
    expect((roh.init.headers as Record<string, string>).authorization).toBe('Bearer tok-test');
    const body = JSON.parse(String(roh.init.body));
    expect(body.model).toBeUndefined();
    expect(body.anthropic_version).toBe('vertex-2023-10-16');
    await warte();
    const { kiProtokollLesen } = await import('@/lib/datenschutz/ki-protokoll');
    expect((await kiProtokollLesen({ person: 'lena', monate: 1 })).find(z => z.zweck === 'test-g-eu')).toMatchObject({ anbieter: 'anthropic-vertex-eu', stufe: 'eu-zdr', ergebnis: 'ok' });
  });
  it('normale Kategorien bleiben bei Anthropic direkt; ohne ZDR ist Gesundheit gesperrt, Familie geht in die EU', async () => {
    process.env.MAKE_OS_KI_ANBIETER_TOR = 'an';
    vertexEinrichten({ zdr: false });
    await registerSetzen(freigeben(['google-vertex']));
    const netz = vi.spyOn(globalThis, 'fetch').mockResolvedValue(MODELL_ANTWORT());
    expect((await anthropic.askText({ system: 'x', user: 'y', zweck: 'test-crm', ki: { lauf: 'aufruf', person: 'lena', kategorien: ['crm'] } })).anbieter).toBe('anthropic');
    expect(netz).toHaveBeenCalledTimes(1);
    expect((await anthropic.askText({ system: 'x', user: 'y', zweck: 'test-g2', ki: { lauf: 'aufruf', person: 'lena', kategorien: ['gesundheit'] } })).error).toBe('ki-gesperrt:anbieter-stufe');
    expect((await anthropic.askText({ system: 'x', user: 'y', zweck: 'test-fam', ki: { lauf: 'aufruf', person: 'lena', kategorien: ['familie'] } })).anbieter).toBe('anthropic-vertex-eu');
    expect(netz).toHaveBeenCalledTimes(1);
  });
  it('ohne EU-Weg bleiben Gesundheitswerte und Privat-Finanzen aus den Prompts (statt alles zu sperren); ohne Tor wie bisher', async () => {
    const ein = await import('@/lib/datenschutz/gesundheit-einwilligung');
    const { kategorienMoeglich } = await import('@/lib/ki/tor');
    expect(await ein.gesundheitAnKi('lena')).toBe(true); // ohne Tor: wie bisher die Einwilligung (b)
    process.env.MAKE_OS_KI_ANBIETER_TOR = 'an';
    expect(await ein.gesundheitKiEinwilligung('lena')).toBe(true);
    expect(await ein.gesundheitAnKi('lena')).toBe(false);
    const { gatherBrain } = await import('@/lib/brain');
    expect((await gatherBrain(heute(), 'lena')).gesundheitFrei).toBe(false);
    expect(await kategorienMoeglich(['finanzen-privat'])).toBe(false);
    expect(await kategorienMoeglich(['crm'])).toBe(true);
    vertexEinrichten({ zdr: true });
    await registerSetzen(freigeben(['google-vertex']));
    expect(await ein.gesundheitAnKi('lena')).toBe(true);
    expect(await kategorienMoeglich(['finanzen-privat'])).toBe(true);
  });
  it('Vertex im Register archiviert: Familie gesperrt — nie still an Anthropic direkt', async () => {
    process.env.MAKE_OS_KI_ANBIETER_TOR = 'an';
    vertexEinrichten({ zdr: true });
    const netz = vi.spyOn(globalThis, 'fetch');
    const r = await anthropic.askText({ system: 'x', user: 'y', zweck: 'test-fam-arch', ki: { lauf: 'aufruf', person: 'lena', kategorien: ['familie', 'finanzen-privat'] } });
    expect(r.error).toBe('ki-gesperrt:avv-offen');
    expect(netz).not.toHaveBeenCalled();
    expect(aufrufe.some(a => a.url.endsWith(':rawPredict'))).toBe(false);
  });
});

describe('Instanz-Budget in Euro (gilt auch ohne Anbieter-Tor)', () => {
  const verbrauch = (usdCent: number) => db.saveJson('ki-verbrauch', { tage: [{ tag: heute(), posten: [{ modell: 'claude-sonnet-5', zweck: 'test', ein: 1, aus: 1, anzahl: 1, cent: usdCent }] }] });
  it('80 %: Aufruf geht, Glocke „80 %“; 100 %: kein Modell-Aufruf, Glocke „erreicht“, Regelwerk-Rückfall über kiGesperrt', async () => {
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { budget: { monatEuroCent: 5000 } } }));
    await verbrauch(4800); // 48 $ × 0,86 = 41,28 € → 82 %
    const netz = vi.spyOn(globalThis, 'fetch').mockResolvedValue(MODELL_ANTWORT());
    expect((await anthropic.askText({ system: 'x', user: 'y', zweck: 'test-b80', ki: { lauf: 'aufruf', person: 'lena', kategorien: ['crm'] } })).ok).toBe(true);
    await verbrauch(6000); // 51,60 € → über 100 %
    const r = await anthropic.askText({ system: 'x', user: 'y', zweck: 'test-b100', ki: { lauf: 'hintergrund', person: null, kategorien: ['crm'] } });
    expect(r.error).toBe('ki-gesperrt:budget');
    expect(anthropic.kiGesperrt(r)).toBe(true);
    expect(netz).toHaveBeenCalledTimes(1);
    await bis(async () => /erreicht/.test(JSON.stringify(await db.loadJson('meldungen--lena'))));
    const glocke = JSON.stringify(await db.loadJson('meldungen--lena'));
    expect(glocke).toMatch(/zu 80 % verbraucht/);
    expect(glocke).toMatch(/erreicht/);
    // Jede Stufe meldet sich nur einmal im Monat.
    await anthropic.askText({ system: 'x', user: 'y', zweck: 'test-b100b', ki: { lauf: 'aufruf', person: 'lena', kategorien: ['crm'] } });
    await warte();
    expect((JSON.stringify(await db.loadJson('meldungen--lena')).match(/erreicht/g) ?? []).length).toBe((glocke.match(/erreicht/g) ?? []).length);
  });
  it('Umgebung setzt das Budget, wenn der Inhaber keins eingestellt hat; budgetStand liefert die Zahl für den Balken', async () => {
    process.env.MAKE_OS_KI_BUDGET_MONAT_EURO = '50';
    await verbrauch(1000);
    const { budgetStand, budgetLage } = await import('@/lib/ki/tor');
    const b = await budgetStand();
    expect(b).toMatchObject({ monatGrenzeCent: 5000, quelle: 'umgebung' });
    expect(budgetLage(b)).toMatchObject({ grenzeCent: 5000, stufe: 0 });
    expect(Math.round(budgetLage(b).verbrauchtCent)).toBe(860);
  });
});

describe('Bilder: frei bis zum Budget, Kennzeichnung bleibt, Sicht serverseitig', () => {
  const ki = (person: string | null = 'lena') => ({ lauf: 'aufruf' as const, person, kategorien: ['allgemein' as const] });
  it('aus, solange der Inhaber Bilder nicht einschaltet; ohne Person nichts', async () => {
    vertexEinrichten({ medien: true });
    await registerSetzen(freigeben(['google-vertex']));
    expect(await aufruf.kiBild({ ki: ki(), haushalt: 'h-test', prompt: 'Abendlicht über einem Konferenztisch' })).toMatchObject({ ok: false, error: 'ki-gesperrt:faehigkeit-aus' });
    expect(await aufruf.kiBild({ ki: ki(null), haushalt: 'h-test', prompt: 'x' })).toMatchObject({ ok: false, status: 401 });
    expect(aufrufe).toEqual([]);
  });
  it('erzeugt, legt UNVERÄNDERT ab (SynthID/C2PA bleiben), bucht Kosten, Protokoll ohne Auftragstext', async () => {
    vertexEinrichten({ medien: true });
    await registerSetzen(freigeben(['google-vertex']));
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { medien: { bild: true } } }));
    const r = await aufruf.kiBild({ ki: ki(), haushalt: 'h-test', prompt: 'PROMPT-GEHEIM Abendlicht', sichtbar: { realistisch: true, orte: true } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.zeichen.noetig).toBe(true);
    const m = r.medien[0];
    expect(m).toMatchObject({ art: 'bild', mime: 'image/png', anbieter: 'google-vertex', kennzeichnung: { synthid: true, c2pa: true, eigeneMarke: true }, zeichenNoetig: true });
    // Seit Paket 4c: EINE Ablage (lib/medien/ki-ablage.ts) — das Bild ist ein Medium, die Bytes bleiben unverändert.
    const { kiMediumOeffnen } = await import('@/lib/medien/ki-ablage');
    const offen = await kiMediumOeffnen('jonas', m.id);
    expect(offen?.bytes.equals(PNG_MIT_KENNZEICHNUNG)).toBe(true);
    expect(offen?.medium.urheber.art).toBe('ki');
    await warte();
    const v = JSON.stringify(await db.loadJson('ki-verbrauch'));
    expect(v).toMatch(/"anbieter":"google-vertex"/);
    expect(v).toMatch(/bild@1k/);
    const proto = readdirSync(ordner).filter(f => f.startsWith('ki-protokoll--')).map(f => db.rohOeffnen(readFileSync(path.join(ordner, f), 'utf8'), f.replace(/\.json$/, '')).text).join('\n');
    expect(proto).toMatch(/"faehigkeit":"bild"/);
    expect(proto).not.toContain('PROMPT-GEHEIM');
  });
  it('Sicht X bekommt nichts aus Y: anderer Haushalt nichts, „nur ich“ nur die Person selbst', async () => {
    vertexEinrichten({ medien: true });
    await registerSetzen(freigeben(['google-vertex']));
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { medien: { bild: true } } }));
    const r = await aufruf.kiBild({ ki: ki(), haushalt: 'h-test', prompt: 'Nur für mich', sichtbarkeit: 'nur-ich' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const id = r.medien[0].id;
    // Seit Paket 4c: „nur ich“ = Privat der Person in der EINEN Ablage (Unsortiert sieht nur sie) — dieselbe Filterstelle wie hochgeladene Fotos.
    const { medienListe, aktionAusfuehren } = await import('@/lib/medien/server');
    const { kiMediumOeffnen } = await import('@/lib/medien/ki-ablage');
    expect((await medienListe('lena'))?.medien.some(x => x.id === id)).toBe(true);
    expect((await medienListe('jonas'))?.medien.some(x => x.id === id)).toBe(false);
    expect(await kiMediumOeffnen('jonas', id)).toBeNull();
    expect(await medienListe('gast')).toBeNull();
    expect(await aktionAusfuehren('jonas', { aktion: 'loeschen', id })).toMatchObject({ ok: false, status: 404 });
    expect(await aktionAusfuehren('lena', { aktion: 'loeschen', id })).toMatchObject({ ok: true });
    expect((await medienListe('lena'))?.medien.some(x => x.id === id)).toBe(false);
    expect(await medien.medienFuer('h-fremd', 'gast')).toEqual([]);
  });
  it('Medien-Zugang nimmt keine CRM-Daten', async () => {
    vertexEinrichten({ medien: true });
    await registerSetzen(freigeben(['google-vertex']));
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { medien: { bild: true } } }));
    expect(await aufruf.kiBild({ ki: { lauf: 'aufruf', person: 'lena', kategorien: ['crm'] }, haushalt: 'h-test', prompt: 'x' })).toMatchObject({ ok: false, error: 'ki-gesperrt:kategorie-nicht-erlaubt' });
  });
});

describe('Video und Tiefenbericht: nur mit Klick, asynchron abgeholt', () => {
  const ki = { lauf: 'aufruf' as const, person: 'lena', kategorien: ['allgemein' as const] };
  it('Video: ohne bestätigte Schätzung 409 mit Betrag; mit Klick gestartet, im Takt abgeholt und abgelegt', async () => {
    vertexEinrichten({ medien: true });
    await registerSetzen(freigeben(['google-vertex']));
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { medien: { video: true } } }));
    const ohne = await aufruf.kiVideoStarten({ ki, haushalt: 'h-test', prompt: 'Kamerafahrt über eine Stadt', sekunden: 10 });
    expect(ohne).toMatchObject({ ok: false, status: 409, error: 'ki-gesperrt:kosten-rueckfrage' });
    expect(ohne.ok ? null : ohne.schaetzung?.text).toMatch(/€/);
    expect(aufrufe.some(a => a.url.endsWith(':predictLongRunning'))).toBe(false);
    const mit = await aufruf.kiVideoStarten({ ki, haushalt: 'h-test', prompt: 'Kamerafahrt über eine Stadt', sekunden: 10, bestaetigtCent: ohne.ok ? 0 : ohne.schaetzung!.euroCent });
    expect(mit.ok).toBe(true);
    expect(await aufruf.kiAuftraegeOffen()).toBe(1);
    const r = await aufruf.kiAuftraegeAbholen();
    expect(r).toMatchObject({ fertig: 1, offen: 0, fehler: 0 });
    // Seit Paket 4c: das Auftragsbuch (ki-medien) trägt nur die Marke, das Video liegt als Medium in der EINEN Ablage.
    const v = (await medien.medienFuer('h-test', 'lena')).find(x => x.art === 'video')!;
    expect(v).toMatchObject({ status: 'fertig', uebernommenAls: expect.stringMatching(/^md-/) });
    const { kiMediumOeffnen } = await import('@/lib/medien/ki-ablage');
    const o = await kiMediumOeffnen('lena', v.uebernommenAls!);
    expect(o?.bytes.equals(MP4)).toBe(true);
    expect(o?.medium).toMatchObject({ art: 'video', typ: 'video/mp4', urheber: { art: 'ki' } });
    expect(await aufruf.kiAuftraegeOffen()).toBe(0);
  });
  it('Grenze je Auftrag gilt zusätzlich zum Budget', async () => {
    vertexEinrichten({ medien: true });
    await registerSetzen(freigeben(['google-vertex']));
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { medien: { video: true }, budget: { auftragEuroCent: 100 } } }));
    expect(await aufruf.kiVideoStarten({ ki, haushalt: 'h-test', prompt: 'x', sekunden: 10, bestaetigtCent: 10_000 })).toMatchObject({ ok: false, error: 'ki-gesperrt:grenze-auftrag' });
  });
  it('Tiefenbericht: nur die fragende Person liest ihn — mit Suchvorschlägen und Quellen', async () => {
    vertexEinrichten({ medien: true });
    await registerSetzen(freigeben(['google-vertex']));
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { medien: { tiefenbericht: true } } }));
    const s = await aufruf.kiTiefenberichtStarten({ ki, frage: 'Markt für Beispiel-Software' });
    expect(s).toMatchObject({ ok: false, error: 'ki-gesperrt:kosten-rueckfrage' });
    const g = await aufruf.kiTiefenberichtStarten({ ki, frage: 'Markt für Beispiel-Software', bestaetigtCent: s.ok ? 0 : s.schaetzung!.euroCent });
    expect(g.ok).toBe(true);
    await aufruf.kiAuftraegeAbholen();
    const { tiefenberichtFuer } = await import('@/lib/ki/tiefenbericht');
    const eigen = await tiefenberichtFuer('lena');
    expect(eigen[0]).toMatchObject({ status: 'fertig', bericht: { text: 'Der Bericht.', suchvorschlaegeHtml: '<div>Vorschläge</div>', quellen: [{ url: 'https://example.org/quelle' }] } });
    expect(await tiefenberichtFuer('jonas')).toEqual([]);
  });
  it('Transkription bleibt aus, solange TRANSKRIPTION_AN fehlt — auch mit Schalter des Inhabers', async () => {
    process.env.MISTRAL_API_KEY = 'NurTestSchluesselNurTest1234';
    await registerSetzen(freigeben(['mistral']));
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { medien: { transkript: true } } }));
    const r = await aufruf.kiTranskript({ ki: { lauf: 'aufruf', person: 'lena', kategorien: ['allgemein'] }, bytes: new Uint8Array([1, 2, 3]), mime: 'audio/mpeg' });
    expect(r).toMatchObject({ ok: false, error: 'ki-gesperrt:faehigkeit-aus' });
    expect(aufrufe).toEqual([]);
    delete process.env.MISTRAL_API_KEY;
  });
});

describe('Kein Modul außerhalb von lib/ki liest Tiefenberichte (Google-Bedingungen: nur Anzeige für die fragende Person)', () => {
  it('Brain, ZOE und Agenten kennen den Bestand nicht', () => {
    const WURZEL = path.resolve(__dirname, '..');
    const lauf = (d: string, raus: string[] = []): string[] => { for (const x of readdirSync(d, { withFileTypes: true })) { const p = path.join(d, x.name); if (x.isDirectory()) { if (x.name !== 'node_modules') lauf(p, raus); } else if (/\.(ts|tsx|mjs)$/.test(x.name)) raus.push(p); } return raus; };
    const treffer = ['app', 'lib', 'components'].flatMap(o => lauf(path.join(WURZEL, o)))
      .filter(p => !p.includes(`${path.sep}lib${path.sep}ki${path.sep}`) && /ki-tiefenbericht|tiefenberichtFuer|lib\/ki\/tiefenbericht/.test(readFileSync(p, 'utf8')))
      .map(p => path.relative(WURZEL, p))
      .filter(p => !['lib/crm/speicher-register.ts', 'lib/datenschutz/konto-daten.ts'].includes(p));
    expect(treffer).toEqual([]);
  });
});
