// Gmail Pub/Sub-Push: OIDC-Token von Google prüfen (Signatur, Aussteller, Audience, Dienstkonto, Ablauf, Schlüssel-Kennung) — falsches
// Token → 403 ohne Inhalt, ohne Einrichtung IMMER 403, Fehlversuche je Netz gedrosselt, höchstens ein Anstoß je Person alle 5 s, nie
// Daten in der Antwort; users.watch (nur mit Einrichtung und öffentlicher HTTPS-Adresse, Erneuerung, Stoppen); die Middleware lässt
// genau diesen Pfad (POST) ohne Sitzung durch und nichts Benachbartes.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateKeyPairSync, createSign, type KeyObject } from 'node:crypto';
import { NextRequest } from 'next/server';
import { GmailFake, gmailAufrufe } from './fixtures/gmail-fake';
import { KONTEN, umgebung } from './fixtures/gmail-setup';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-gmail-w-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-gmail-webhook';
process.env.MAKE_OS_KEY = 'dienst-test-gmail-webhook';

const AUDIENCE = 'https://app.makeinnovation.test/api/google/gmail/meldung';
const DIENSTKONTO = 'gmail-push@makeinnovation-test.iam.gserviceaccount.com';
const THEMA = 'projects/make-os-test/topics/gmail-push';
const ENV = { MAKE_OS_ADRESSE: 'https://app.makeinnovation.test', GMAIL_PUBSUB_THEMA: THEMA, GMAIL_PUSH_DIENSTKONTO: DIENSTKONTO };

let V: typeof import('@/lib/google/verbindung'), A: typeof import('@/lib/gmail/abgleich'), S: typeof import('@/lib/gmail/stand'), P: typeof import('@/lib/gmail/meldung'), db: typeof import('@/lib/store/local-db');
let route: { POST: (r: Request) => Promise<Response> };
let middleware: typeof import('@/middleware').middleware;
let g: GmailFake;
let schluessel: { privat: KeyObject; jwk: Record<string, string> };
let fremder: KeyObject;

beforeAll(async () => {
  V = await import('@/lib/google/verbindung'); A = await import('@/lib/gmail/abgleich'); S = await import('@/lib/gmail/stand'); P = await import('@/lib/gmail/meldung'); db = await import('@/lib/store/local-db');
  route = await import('../app/api/google/gmail/meldung/route') as typeof route;
  ({ middleware } = await import('@/middleware'));
  const k = generateKeyPairSync('rsa', { modulusLength: 2048 });
  schluessel = { privat: k.privateKey, jwk: { ...k.publicKey.export({ format: 'jwk' }) as Record<string, string>, kid: 'schluessel-1', alg: 'RS256', use: 'sig' } };
  fremder = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const b64 = (o: unknown) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
/** Ein OIDC-Token, wie Pub/Sub es schickt — mit wählbaren Abweichungen. */
function token(x: { aud?: string; email?: string; iss?: string; exp?: number; iat?: number; kid?: string; alg?: string; key?: KeyObject; verified?: boolean } = {}): string {
  const jetzt = Math.floor(Date.now() / 1000);
  const kopf = b64({ alg: x.alg ?? 'RS256', kid: x.kid ?? 'schluessel-1', typ: 'JWT' });
  const nutz = b64({ iss: x.iss ?? 'https://accounts.google.com', aud: x.aud ?? AUDIENCE, email: x.email ?? DIENSTKONTO, email_verified: x.verified ?? true, iat: x.iat ?? jetzt, exp: x.exp ?? jetzt + 3600, sub: '1234' });
  const sig = createSign('RSA-SHA256').update(`${kopf}.${nutz}`).sign(x.key ?? schluessel.privat).toString('base64url');
  return `${kopf}.${nutz}.${sig}`;
}
const meldung = (adresse = 'kevin@makeinnovation.test', historyId = '1234') => JSON.stringify({ message: { data: Buffer.from(JSON.stringify({ emailAddress: adresse, historyId })).toString('base64'), messageId: '1', publishTime: '2026-10-03T08:00:00Z' }, subscription: 'projects/x/subscriptions/y' });
const sende = async (t: string | null, body = meldung(), extra: Record<string, string> = {}) => {
  const r = await route.POST(new Request('http://localhost/api/google/gmail/meldung', { method: 'POST', headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}), ...extra }, body }));
  return { status: r.status, text: await r.text() };
};
let jwksAufrufe = 0;

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren(); P._gmailAnstossZuruecksetzen(); P._jwksZuruecksetzen();
  (await import('@/lib/zugang/drossel'))._zuruecksetzen();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-03T08:00:00.000Z'));
  g = new GmailFake(); umgebung(vi, g, ENV);
  jwksAufrufe = 0;
  vi.stubGlobal('fetch', async (u: string | URL, i: RequestInit = {}) => {
    if (String(u) === 'https://www.googleapis.com/oauth2/v3/certs') { jwksAufrufe++; return new Response(JSON.stringify({ keys: [schluessel.jwk] }), { status: 200, headers: { 'content-type': 'application/json' } }); }
    return g.handle(String(u), i);
  });
  await db.saveJson('konten', KONTEN);
  const { url } = await V.verbindungStarten('kevin', ['gmail']);
  await V.verbindungAbschliessen('kevin', 'code-ok', new URL(url).searchParams.get('state')!);
  g.mail({ id: 'start0001', von: 'anna@firma.example.invalid', betreff: 'Start', text: 'x' });
  await A.gmailAbgleichen('kevin');
});

describe('Token prüfen', () => {
  it('gültiges Token: 200, leere Antwort, ein Abgleich wird angestoßen und holt die neue Mail', async () => {
    g.mail({ id: 'push0001', von: 'neu@firma.example.invalid', betreff: 'Per Push', text: 'x' });
    const r = await sende(token());
    expect(r).toEqual({ status: 200, text: '' });
    await vi.waitFor(async () => expect((await S.ladeGmailStand('kevin'))!.koepfe.push0001).toBeTruthy());
  });
  it('JEDE Abweichung → 403 mit leerem Körper, kein Abgleich: falsche Audience, falsches Dienstkonto, falscher Aussteller, abgelaufen, unbestätigte Adresse, fremde Signatur, unbekannte Schlüssel-Kennung, falscher Algorithmus, Müll, kein Token', async () => {
    g.mail({ id: 'push0002', von: 'neu@firma.example.invalid', betreff: 'Nie', text: 'x' });
    const jetzt = Math.floor(Date.now() / 1000);
    const faelle: [string, string | null][] = [
      ['Audience', token({ aud: 'https://evil.example.invalid/api' })], ['Dienstkonto', token({ email: 'angreifer@x.example.invalid' })], ['Aussteller', token({ iss: 'https://evil.example.invalid' })],
      ['abgelaufen', token({ exp: jetzt - 600 })], ['unbestätigt', token({ verified: false })], ['fremde Signatur', token({ key: fremder })], ['kid', token({ kid: 'unbekannt' })],
      ['alg none', token({ alg: 'none' })], ['HS256', token({ alg: 'HS256' })], ['Müll', 'abc.def.ghi'], ['leer', ''], ['kein Token', null],
    ];
    const drossel = await import('@/lib/zugang/drossel');
    for (const [name, t] of faelle) { drossel._zuruecksetzen(); const r = await sende(t); expect(r, name).toEqual({ status: 403, text: '' }); }
    drossel._zuruecksetzen();
    // Ein verändertes Nutzlast-Stück (mit gültiger alter Signatur) fällt ebenfalls durch.
    const t = token().split('.'); t[1] = b64({ iss: 'https://accounts.google.com', aud: AUDIENCE, email: DIENSTKONTO, email_verified: true, exp: jetzt + 99999 });
    expect((await sende(t.join('.'))).status).toBe(403);
    await new Promise(r => setTimeout(r, 20));
    expect((await S.ladeGmailStand('kevin'))!.koepfe.push0002).toBeUndefined();
  });
  it('ohne Einrichtung (Dienstkonto/Thema/Adresse fehlen) antwortet der Webhook IMMER 403 — auch mit einem „gültigen“ Token', async () => {
    for (const aus of [{ GMAIL_PUSH_DIENSTKONTO: '' }, { GMAIL_PUBSUB_THEMA: '' }, { MAKE_OS_ADRESSE: 'http://localhost:3001' }, { GMAIL_PUBSUB_THEMA: 'kaputt' }]) {
      vi.stubEnv('GMAIL_PUBSUB_THEMA', ENV.GMAIL_PUBSUB_THEMA); vi.stubEnv('GMAIL_PUSH_DIENSTKONTO', ENV.GMAIL_PUSH_DIENSTKONTO); vi.stubEnv('MAKE_OS_ADRESSE', ENV.MAKE_OS_ADRESSE);
      for (const [k, v] of Object.entries(aus)) vi.stubEnv(k, v);
      expect((await sende(token({ aud: process.env.GMAIL_PUSH_AUDIENCE || AUDIENCE }))).status, JSON.stringify(aus)).toBe(403);
    }
  });
  it('eigene Audience aus der Umgebung (GMAIL_PUSH_AUDIENCE) gilt statt der Webhook-Adresse', async () => {
    vi.stubEnv('GMAIL_PUSH_AUDIENCE', 'make-os-gmail');
    expect(P.pushKonfig()).toMatchObject({ audience: 'make-os-gmail', dienstkonto: DIENSTKONTO, thema: THEMA });
    expect((await sende(token({ aud: AUDIENCE }))).status).toBe(403);
    expect((await sende(token({ aud: 'make-os-gmail' }))).status).toBe(200);
  });
  it('die öffentlichen Schlüssel werden gemerkt (eine Stunde); eine neue Kennung löst genau EIN Nachladen aus', async () => {
    await sende(token()); await sende(token());
    expect(jwksAufrufe).toBe(1);
    await sende(token({ kid: 'unbekannt' }));
    expect(jwksAufrufe).toBe(2);
  });
});

describe('Drosselung, Anstoß, Inhalt der Meldung', () => {
  it('Fehlversuche je Netz: nach zu vielen 429 — auch ein gültiges Token wird dann (kurz) nicht mehr angenommen', async () => {
    for (let i = 0; i < 10; i++) expect((await sende('x.y.z')).status).toBe(403);
    expect((await sende(null)).status).toBe(403);
    expect((await sende(token())).status).toBe(429);
  });
  it('höchstens ein Anstoß je Person alle 5 Sekunden; unbekanntes Postfach und kaputter Körper', async () => {
    const stoesse: string[] = [];
    const lauf = (body: string) => P.pushVerarbeiten({ headers: { get: (n: string) => (n.toLowerCase() === 'authorization' ? `Bearer ${token()}` : null) }, text: async () => body }, p => stoesse.push(p));
    expect(await lauf(meldung())).toEqual({ status: 200, angestossen: true });
    expect(await lauf(meldung())).toEqual({ status: 200, angestossen: false });
    vi.setSystemTime(new Date(Date.now() + 6000));
    expect(await lauf(meldung())).toEqual({ status: 200, angestossen: true });
    expect(await lauf(meldung('fremd@nirgends.example.invalid'))).toEqual({ status: 200, angestossen: false });  // bestätigen, nichts tun
    expect(await lauf('kein json')).toEqual({ status: 400 });
    expect(stoesse).toEqual(['kevin', 'kevin']);
  });
  it('Körper über 16 KB: 413 (Route); der Webhook liefert nie Daten', async () => {
    const r = await route.POST(new Request('http://localhost/api/google/gmail/meldung', { method: 'POST', headers: { 'content-length': String(20_000), authorization: `Bearer ${token()}` }, body: meldung() }));
    expect(r.status).toBe(413);
    for (const t of [token(), 'x.y.z', null]) expect((await sende(t)).text).toBe('');
  });
});

describe('users.watch', () => {
  it('nur mit Einrichtung: Thema, Labels INBOX+SENT; Ablauf im Stand; Erneuerung ab 3 Tagen Restlaufzeit; Stoppen', async () => {
    expect(await P.watchSicherstellen('kevin')).toBe('neu');
    const w = gmailAufrufe(g, '/watch', 'POST')[0].body as { topicName: string; labelIds: string[]; labelFilterBehavior: string };
    expect(w).toEqual({ topicName: THEMA, labelIds: ['INBOX', 'SENT'], labelFilterBehavior: 'INCLUDE' });
    const s = (await S.ladeGmailStand('kevin'))!;
    expect(s.watch!.ablauf).toBeGreaterThan(Date.now());
    expect(await P.watchSicherstellen('kevin')).toBe('aktiv');
    expect(gmailAufrufe(g, '/watch')).toHaveLength(1);
    vi.setSystemTime(new Date(Date.now() + 5 * 86_400_000));
    expect(await P.watchSicherstellen('kevin')).toBe('erneuert');
    await P.watchStoppen('kevin');
    expect(gmailAufrufe(g, '/stop', 'POST')).toHaveLength(1);
  });
  it('ohne Einrichtung oder öffentliche HTTPS-Adresse: „aus“ (Takt-Rückfall), nichts bei Google', async () => {
    for (const [k, v] of [['GMAIL_PUBSUB_THEMA', ''], ['GMAIL_PUSH_DIENSTKONTO', ''], ['MAKE_OS_ADRESSE', 'https://localhost'], ['MAKE_OS_ADRESSE', 'http://app.makeinnovation.test'], ['MAKE_OS_ADRESSE', 'https://203.0.113.9']] as const) {
      vi.stubEnv('GMAIL_PUBSUB_THEMA', THEMA); vi.stubEnv('GMAIL_PUSH_DIENSTKONTO', DIENSTKONTO); vi.stubEnv('MAKE_OS_ADRESSE', ENV.MAKE_OS_ADRESSE);
      vi.stubEnv(k, v);
      expect(await P.watchSicherstellen('kevin'), `${k}=${v}`).toBe('aus');
    }
    expect(gmailAufrufe(g, '/watch')).toHaveLength(0);
  });
  it('Fehler bei Google stört den Abgleich nie', async () => {
    g.fehler.push({ teil: '/watch', status: 403 });
    expect(await P.watchSicherstellen('kevin')).toBe('fehler');
    expect((await S.ladeGmailStand('kevin'))!.watch).toBeUndefined();
  });
});

describe('Middleware: offen ist NUR dieser Webhook (POST)', () => {
  const offen = (r: Response) => r.headers.get('x-middleware-next') === '1';
  const lauf = (pfad: string, init: { method?: string; headers?: Record<string, string> } = {}) => middleware(new NextRequest(`http://localhost:3001${pfad}`, init as never));
  it('POST /api/google/gmail/meldung ohne Sitzung und ohne Origin: durch — nie als Person', async () => {
    const r = await lauf('/api/google/gmail/meldung', { method: 'POST', headers: { 'x-make-user': 'kevin', 'x-make-person': 'kevin' } });
    expect(offen(r)).toBe(true);
    expect(r.headers.get('x-middleware-request-x-make-user')).toBeNull();
    expect(r.headers.get('x-middleware-request-x-make-person')).toBeNull();
  });
  it('alles Nachbarliche bleibt zu: GET auf den Webhook, Unterpfade, ähnliche Pfade, alle Gmail-Routen ohne Sitzung', async () => {
    for (const [p, m] of [['/api/google/gmail/meldung', 'GET'], ['/api/google/gmail/meldung/x', 'POST'], ['/api/google/gmail/meldungen', 'POST'], ['/api/google/gmail', 'POST'], ['/api/gmail', 'GET'], ['/api/gmail', 'POST'], ['/api/gmail/senden', 'POST'], ['/api/gmail/nachricht', 'GET'], ['/api/gmail/anhang', 'GET'], ['/api/gmail/entwurf', 'POST']] as const) {
      const r = await lauf(p, { method: m, headers: { origin: 'http://localhost:3001', host: 'localhost:3001' } });
      expect(offen(r), `${m} ${p}`).toBe(false);
      expect(r.status, `${m} ${p}`).toBe(401);
    }
  });
});
