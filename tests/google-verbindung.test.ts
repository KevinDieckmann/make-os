// Google-Verbindung je Person (lib/google/verbindung.ts): OAuth mit PKCE + state, Domain-Prüfung, Token verschlüsselt im
// Bestand, Erneuern, invalid_grant → getrennt, Scopes je Funktion (inkrementell), Trennen widerruft bei Google und löscht.
// Echter Datenspeicher in einem Temp-Ordner MIT Datenschlüssel; Google ist nachgebaut (tests/fixtures/google-fake.ts).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GoogleFake } from './fixtures/google-fake';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-google-v-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-google-verbindung';

let V: typeof import('@/lib/google/verbindung');
let db: typeof import('@/lib/store/local-db');
let g: GoogleFake;

const PKCE_B64 = /^[A-Za-z0-9_-]{43}$/;
const aus = (url: string) => new URL(url).searchParams;

beforeAll(async () => { V = await import('@/lib/google/verbindung'); db = await import('@/lib/store/local-db'); });
afterAll(() => rmSync(ordner, { recursive: true, force: true }));
beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  g = new GoogleFake();
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => g.handle(String(u), i)));
  vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id-test.apps.googleusercontent.test');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'client-geheimnis-test');
  vi.stubEnv('GOOGLE_ERLAUBTE_DOMAIN', 'makeinnovation.test');
  vi.stubEnv('MAKE_OS_ADRESSE', 'https://app.makeinnovation.test');
  vi.stubEnv('GOOGLE_RUECKRUF_URL', '');
});

/** Anmeldung bis zum Rückruf durchspielen. */
async function anmelden(person = 'kevin', funktionen: ('kalender')[] = ['kalender']) {
  const { url } = await V.verbindungStarten(person, funktionen);
  const q = aus(url);
  return { q, state: q.get('state')!, abschliessen: (p = person, code = 'code-ok') => V.verbindungAbschliessen(p, code, q.get('state')!) };
}

describe('Konfiguration', () => {
  it('ohne Client-ID/Secret: „nicht eingerichtet“ — nichts bricht, Starten wird sauber abgelehnt', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', ''); vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    expect(V.googleKonfiguriert()).toBe(false);
    expect((await V.googleStatus('kevin')).konfiguriert).toBe(false);
    await expect(V.verbindungStarten('kevin', ['kalender'])).rejects.toMatchObject({ code: 'nicht-konfiguriert' });
  });
  it('Rückruf-URL: aus der Umgebung, sonst MAKE_OS_ADRESSE + /api/google/rueckruf; Domain wird gesäubert', () => {
    expect(V.googleKonfig()?.rueckrufUrl).toBe('https://app.makeinnovation.test/api/google/rueckruf');
    vi.stubEnv('GOOGLE_RUECKRUF_URL', 'http://localhost:3001/api/google/rueckruf');
    vi.stubEnv('GOOGLE_ERLAUBTE_DOMAIN', ' @MakeInnovation.TEST ');
    expect(V.googleKonfig()).toMatchObject({ rueckrufUrl: 'http://localhost:3001/api/google/rueckruf', erlaubteDomain: 'makeinnovation.test' });
    vi.stubEnv('GOOGLE_ERLAUBTE_DOMAIN', 'kaputt domain');
    expect(V.googleKonfig()?.erlaubteDomain).toBeNull();
  });
});

describe('Anmeldeseite: PKCE, state, Scopes', () => {
  it('Authorization-Code mit S256-Challenge, state, offline, Zustimmung, bereits gewährte Scopes behalten', async () => {
    const { q } = await anmelden();
    expect(q.get('response_type')).toBe('code');
    expect(q.get('client_id')).toBe('client-id-test.apps.googleusercontent.test');
    expect(q.get('redirect_uri')).toBe('https://app.makeinnovation.test/api/google/rueckruf');
    expect(q.get('code_challenge_method')).toBe('S256');
    expect(q.get('code_challenge')).toMatch(PKCE_B64);
    expect(q.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(q.get('access_type')).toBe('offline');
    expect(q.get('prompt')).toBe('consent');
    expect(q.get('include_granted_scopes')).toBe('true');
    expect(q.get('hd')).toBe('makeinnovation.test');
  });
  it('Scopes minimal und je Funktion: Termine lesen/schreiben + Kalenderliste + Adresse — kein Mail, kein voller Kalender', async () => {
    const { q } = await anmelden();
    const s = (q.get('scope') ?? '').split(' ');
    expect(s.sort()).toEqual(['email', 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly', 'openid']);
    expect(s.some(x => /mail\.google|\/auth\/calendar$|drive/.test(x))).toBe(false);
  });
  it('die Funktionen sind eine Liste: ein weiteres Modul trägt nur seine Scopes ein (scopesFuer)', () => {
    expect(V.scopesFuer(['kalender'])).toContain('https://www.googleapis.com/auth/calendar.events');
    expect(V.scopesFuer([])).toEqual(['openid', 'email']);
    expect(V.scopesFehlen(['a', 'b'], ['a', 'c'])).toEqual(['c']);
    // Google meldet `email` als userinfo.email zurück — derselbe Scope.
    expect(V.scopesFehlen(['openid', 'https://www.googleapis.com/auth/userinfo.email'], ['openid', 'email'])).toEqual([]);
  });
  it('PKCE-Paar: Challenge = SHA-256(Verifier), jedes Mal neu', () => {
    const a = V.pkcePaar(), b = V.pkcePaar();
    expect(a.challenge).toBe(V.challengeZu(a.verifier));
    expect(a.verifier).not.toBe(b.verifier);
  });
});

describe('Rückruf', () => {
  it('Erfolg: Code gegen Tokens, Verbindung gespeichert, Funktion bereit; der Code-Tausch trägt Verifier + Secret', async () => {
    const a = await anmelden();
    const r = await a.abschliessen();
    expect(r).toMatchObject({ email: 'kevin@makeinnovation.test', fehlendeScopes: [] });
    expect(r.funktionen).toEqual(expect.arrayContaining(['basis', 'kalender']));
    const tausch = g.aufrufe.find(x => x.pfad === '/token')!;
    const p = new URLSearchParams(String(tausch.body));
    expect(p.get('code_verifier')).toMatch(PKCE_B64);
    expect(p.get('client_secret')).toBe('client-geheimnis-test');
    expect(p.get('redirect_uri')).toBe('https://app.makeinnovation.test/api/google/rueckruf');
    const st = await V.googleStatus('kevin');
    expect(st).toMatchObject({ verbunden: true, konto: 'k***@makeinnovation.test', konfiguriert: true });
    expect(st.bereit).toContain('kalender');
  });
  it('Tokens liegen NUR verschlüsselt auf der Platte — Klartext nirgends in den Dateien, nie im Status', async () => {
    await (await anmelden()).abschliessen();
    const alles = readdirSync(ordner).filter(f => statSync(path.join(ordner, f)).isFile()).map(f => readFileSync(path.join(ordner, f), 'utf8')).join('\n');
    expect(alles).not.toContain('erneuerung-geheim-1');
    expect(alles).not.toContain('zugriff-1');
    expect(alles).not.toContain('kevin@makeinnovation.test');
    const st = JSON.stringify(await V.googleStatus('kevin'));
    expect(st).not.toContain('erneuerung-geheim-1');
    expect(st).not.toContain('kevin@makeinnovation.test');
    // Lesen geht trotzdem (richtiger Schlüssel).
    expect((await V.ladeVerbindung('kevin'))?.refreshToken).toBe('erneuerung-geheim-1');
  });
  it('state ist einmalig: ein zweiter Rückruf mit demselben state scheitert', async () => {
    const a = await anmelden();
    await a.abschliessen();
    await expect(a.abschliessen()).rejects.toMatchObject({ code: 'state' });
  });
  it('unbekannter oder abgelaufener state → nichts getauscht', async () => {
    await expect(V.verbindungAbschliessen('kevin', 'code', 'x'.repeat(43))).rejects.toMatchObject({ code: 'state' });
    const { url } = await V.verbindungStarten('kevin', ['kalender'], Date.now() - 16 * 60_000);
    await expect(V.verbindungAbschliessen('kevin', 'code', aus(url).get('state')!)).rejects.toMatchObject({ code: 'state' });
    expect(g.aufrufe.filter(x => x.pfad === '/token')).toHaveLength(0);
  });
  it('fremde Person: der state gehört Kevin — Malins Sitzung kann ihn nicht einlösen (und er ist danach verbraucht)', async () => {
    const a = await anmelden('kevin');
    await expect(a.abschliessen('malin')).rejects.toMatchObject({ code: 'person' });
    expect(g.aufrufe.filter(x => x.pfad === '/token')).toHaveLength(0);
    await expect(a.abschliessen('kevin')).rejects.toMatchObject({ code: 'state' });
    expect(await V.ladeVerbindung('malin')).toBeNull();
    expect(await V.ladeVerbindung('kevin')).toBeNull();
  });
  it('falsche Domain (z. B. gmail.com): Token wird SOFORT bei Google widerrufen, nichts gespeichert', async () => {
    g.konto = { email: 'privat@gmail.test', hd: undefined as unknown as string, email_verified: true };
    const a = await anmelden();
    await expect(a.abschliessen()).rejects.toMatchObject({ code: 'domain', status: 403 });
    expect(g.widerrufen).toEqual(['erneuerung-geheim-1']);
    expect(await V.ladeVerbindung('kevin')).toBeNull();
  });
  it('Adresse auf der Domain, aber ohne hd-Anspruch oder unbestätigt → ebenfalls abgelehnt', async () => {
    g.konto = { email: 'kevin@makeinnovation.test', hd: undefined as unknown as string, email_verified: true };
    await expect((await anmelden()).abschliessen()).rejects.toMatchObject({ code: 'domain' });
    g.konto = { email: 'kevin@makeinnovation.test', hd: 'makeinnovation.test', email_verified: false };
    await expect((await anmelden()).abschliessen()).rejects.toMatchObject({ code: 'domain' });
    expect(V.domainPasst({ email: 'a@makeinnovation.test', hd: 'makeinnovation.test' }, 'makeinnovation.test')).toBe(true);
    expect(V.domainPasst({ email: 'a@evil-makeinnovation.test', hd: 'makeinnovation.test' }, 'makeinnovation.test')).toBe(false);
    expect(V.domainPasst({ email: 'a@x.invalid' }, null)).toBe(true);
  });
  it('Google lehnt den Code ab → token-Fehler, nichts gespeichert', async () => {
    const a = await anmelden();
    await expect(a.abschliessen('kevin', 'falsch')).rejects.toMatchObject({ code: 'token' });
    expect(await V.ladeVerbindung('kevin')).toBeNull();
  });
  it('Scope fehlt (Häkchen abgewählt): Verbindung steht, die Funktion ist NICHT bereit, das Token gilt nicht für sie', async () => {
    g.scopeGewaehrt = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.readonly';
    const r = await (await anmelden()).abschliessen();
    expect(r.fehlendeScopes).toEqual(['https://www.googleapis.com/auth/calendar.events']);
    expect((await V.googleStatus('kevin')).bereit).not.toContain('kalender');
    await expect(V.googleZugriffstoken('kevin', 'kalender')).rejects.toMatchObject({ code: 'scope-fehlt' });
  });
  it('inkrementell: eine zweite Anmeldung ergänzt Scopes, das Refresh-Token bleibt, die Verbindung ist EINE', async () => {
    await (await anmelden('kevin', [])).abschliessen();
    const vorher = await V.ladeVerbindung('kevin');
    expect(vorher?.funktionen).toEqual(['basis']);
    // Zweite Anmeldung ohne neues Refresh-Token (Google schickt es nur bei der ersten Zustimmung) → das alte bleibt.
    const fetchAlt = g.handle;
    g.handle = async (u, i) => { const r = await fetchAlt(u, i); if (u.endsWith('/token') && String(i?.body).includes('authorization_code')) { const j = await r.clone().json(); delete j.refresh_token; return new Response(JSON.stringify(j), { status: 200 }); } return r; };
    vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => g.handle(String(u), i)));
    await (await anmelden('kevin', ['kalender'])).abschliessen();
    const nachher = await V.ladeVerbindung('kevin');
    expect(nachher?.refreshToken).toBe('erneuerung-geheim-1');
    expect(nachher?.funktionen).toEqual(expect.arrayContaining(['basis', 'kalender']));
    expect(V.scopesFehlen(nachher!.scopes, V.scopesFuer(['kalender']))).toEqual([]);
  });
});

describe('Zugriffstoken, Erneuern, Getrennt', () => {
  it('gültiges Token wird wiederverwendet; abgelaufenes erneuert (höchstens ein Erneuern gleichzeitig)', async () => {
    await (await anmelden()).abschliessen();
    const t1 = await V.googleZugriffstoken('kevin', 'kalender');
    expect(await V.googleZugriffstoken('kevin', 'kalender')).toBe(t1);
    await db.updateJson('google-verbindung--kevin', (c: unknown) => ({ ...(c as object), ablauf: Date.now() - 1000 }));
    const [a, b] = await Promise.all([V.googleZugriffstoken('kevin', 'kalender'), V.googleZugriffstoken('kevin', 'kalender')]);
    expect(a).toBe(b);
    expect(a).not.toBe(t1);
    expect(g.aufrufe.filter(x => x.pfad === '/token' && String(x.body).includes('refresh_token'))).toHaveLength(1);
  });
  it('invalid_grant beim Erneuern: Verbindung als „getrennt“ markiert (Token verworfen), Status sagt es', async () => {
    await (await anmelden()).abschliessen();
    await db.updateJson('google-verbindung--kevin', (c: unknown) => ({ ...(c as object), ablauf: Date.now() - 1000 }));
    g.refreshOk = false;
    await expect(V.googleZugriffstoken('kevin', 'kalender')).rejects.toMatchObject({ code: 'getrennt' });
    const st = await V.googleStatus('kevin');
    expect(st).toMatchObject({ verbunden: false });
    expect(st.getrennt?.grund).toMatch(/widerrufen|abgelaufen/);
    await expect(V.googleZugriffstoken('kevin', 'kalender')).rejects.toMatchObject({ code: 'getrennt' });
  });
  it('Fremde Person ohne Verbindung: nicht verbunden', async () => {
    await (await anmelden('kevin')).abschliessen();
    await expect(V.googleZugriffstoken('malin', 'kalender')).rejects.toMatchObject({ code: 'nicht-verbunden' });
    expect((await V.googleStatus('malin')).verbunden).toBe(false);
  });
});

describe('Trennen', () => {
  it('widerruft das Refresh-Token bei Google, führt vorher den Aufräum-Haken aus und löscht den Inhalt', async () => {
    await (await anmelden()).abschliessen();
    let vorher = false;
    const r = await V.googleTrennen('kevin', async () => { vorher = true; });
    expect(r).toEqual({ war: true, widerrufen: true });
    expect(vorher).toBe(true);
    expect(g.widerrufen).toEqual(['erneuerung-geheim-1']);
    expect(await V.ladeVerbindung('kevin')).toBeNull();
    const roh = readFileSync(path.join(ordner, 'google-verbindung--kevin.json'), 'utf8');
    expect(roh).not.toContain('zugriff');
    expect(await V.googleTrennen('kevin')).toEqual({ war: false, widerrufen: false });
  });
  it('Widerruf bei Google scheitert → lokal trotzdem gelöscht, `widerrufen: false` (die Oberfläche sagt, was zu tun ist)', async () => {
    await (await anmelden()).abschliessen();
    g.fehler.push({ teil: '/revoke', status: 500 });
    expect((await V.googleTrennen('kevin')).widerrufen).toBe(false);
    expect(await V.ladeVerbindung('kevin')).toBeNull();
  });
});

describe('Nur Google-Adressen', () => {
  it('Zugangsdaten gehen nur an accounts.google.com, oauth2.googleapis.com und www.googleapis.com', () => {
    expect(V.googleHost('https://www.googleapis.com/calendar/v3/x')).toBe(true);
    expect(V.googleHost('https://oauth2.googleapis.com/token')).toBe(true);
    expect(V.googleHost('https://evil.example.invalid/token')).toBe(false);
    expect(V.googleHost('http://www.googleapis.com/x')).toBe(false);
    expect(V.googleHost('https://www.googleapis.com.evil.invalid/x')).toBe(false);
  });
  it('JWT-Nutzlast: nur lesen, kaputt → null', () => {
    expect(V.jwtNutzlast('a.eyJlbWFpbCI6ImFAYi5jIn0.c')).toEqual({ email: 'a@b.c' });
    expect(V.jwtNutzlast('kaputt')).toBeNull();
    expect(V.jwtNutzlast(undefined)).toBeNull();
  });
});
