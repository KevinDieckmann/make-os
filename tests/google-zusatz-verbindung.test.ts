// Weitere Google-Konten je Person (30.10.): Anmeldung (state/PKCE, nur lesen, Kontowahl), Domains aus der Umgebung, Haupt-Konto und
// Doppelte abgelehnt (Token widerrufen), fremde Person, abgelaufene Anmeldung → „abgelaufen“ + EINE Glocke, Trennen, Rückruf über
// denselben Pfad, Haupt-Verbindung bit-gleich, Dienstweg 403. Echter Datenspeicher (Temp, verschlüsselt), Google nachgebaut.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GoogleFake } from './fixtures/google-fake';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-google-zusatz-v-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-google-zusatz';
process.env.MAKE_OS_KEY = 'dienst-test-google-zusatz';

type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let V: typeof import('@/lib/google/verbindung'), Z: typeof import('@/lib/google/zusatz'), KZ: typeof import('@/lib/kalender/google/zusatz');
let A: typeof import('@/lib/kalender/google/abgleich'), db: typeof import('@/lib/store/local-db');
let route: R, rueckruf: R;
let haupt: GoogleFake, zweit: GoogleFake;

const kopf = (person: string | null) => ({ 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}) });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const j = async (r: Response) => ({ status: r.status, d: await r.json().catch(() => ({})) as Record<string, any> }); // eslint-disable-line @typescript-eslint/no-explicit-any
const stateAus = (url: string) => new URL(url).searchParams.get('state')!;

async function zusatzVerbinden(person = 'kevin') {
  const { url } = await Z.zusatzStarten(person);
  return Z.zusatzAbschliessen(person, 'zweit-code', stateAus(url));
}

beforeAll(async () => {
  V = await import('@/lib/google/verbindung'); Z = await import('@/lib/google/zusatz'); KZ = await import('@/lib/kalender/google/zusatz');
  A = await import('@/lib/kalender/google/abgleich'); db = await import('@/lib/store/local-db');
  route = await import('../app/api/kalender/google/zusatz/route') as R; rueckruf = await import('../app/api/google/rueckruf/route') as R;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-30T08:00:00.000Z'));
  haupt = new GoogleFake();
  zweit = new GoogleFake();
  zweit.vorsatz = 'zweit'; zweit.refreshWert = 'zweit-erneuerung';
  zweit.konto = { email: 'kevin@partnerfirma.test', hd: 'partnerfirma.test', email_verified: true };
  zweit.scopeGewaehrt = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.readonly';
  zweit.kalenderId = 'kevin@partnerfirma.test';
  zweit.kalenderListe = [{ id: 'kevin@partnerfirma.test', summary: 'Partner', primary: true, accessRole: 'owner', timeZone: 'Europe/Berlin' }, { id: 'projekt@group.calendar.google.test', summary: 'Projekt', accessRole: 'reader' }];
  // Zwei Konten, ein Google: der Code, das Refresh-Token und das Zugriffstoken verraten, welches Konto gemeint ist.
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => {
    const url = new URL(String(u));
    if (url.hostname === 'oauth2.googleapis.com') {
      const p = new URLSearchParams(String(i.body ?? ''));
      const zw = [p.get('code'), p.get('refresh_token'), p.get('token')].some(x => (x ?? '').startsWith('zweit'));
      return (zw ? zweit : haupt).handle(String(u), i);
    }
    const auth = String((i.headers as Record<string, string> | undefined)?.Authorization ?? '');
    return (auth.startsWith('Bearer zweit') ? zweit : haupt).handle(String(u), i);
  }));
  vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id-test'); vi.stubEnv('GOOGLE_CLIENT_SECRET', 'geheim'); vi.stubEnv('GOOGLE_ERLAUBTE_DOMAIN', 'makeinnovation.test');
  vi.stubEnv('GOOGLE_ZUSATZ_DOMAINS', 'partnerfirma.test, zweitfirma.test');
  vi.stubEnv('MAKE_OS_ADRESSE', 'https://app.makeinnovation.test'); vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubEnv('ICLOUD_APPLE_ID', ''); vi.stubEnv('ICLOUD_APP_PASSWORT', '');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'kevin@example.invalid', name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
    { id: 'k2', speicher: 'malin', email: 'malin@example.invalid', name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  ], einladungen: [] });
  await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Privat Kevin', malin: 'Privat Malin', beide: 'Gemeinsam' } });
  const { url } = await V.verbindungStarten('kevin', ['kalender']);
  await V.verbindungAbschliessen('kevin', 'code-ok', stateAus(url));
});

describe('Konfiguration und reine Regeln', () => {
  it('Domains aus der Umgebung, gesäubert — leer = aus', () => {
    expect(Z.zusatzDomains(' Partnerfirma.test ,@zweitfirma.test;;kaputt')).toEqual(['partnerfirma.test', 'zweitfirma.test']);
    expect(Z.zusatzDomains('')).toEqual([]);
    expect(Z.zusatzKonfiguriert()).toBe(true);
    vi.stubEnv('GOOGLE_ZUSATZ_DOMAINS', '');
    expect(Z.zusatzKonfiguriert()).toBe(false);
  });
  it('Domain-Regel: Adresse auf eine freigegebene Domain, ein hd-Anspruch muss dieselbe sein, unbestätigt nie', () => {
    const d = ['partnerfirma.test'];
    expect(Z.zusatzDomainPasst({ email: 'a@partnerfirma.test', hd: 'partnerfirma.test' }, d)).toBe(true);
    expect(Z.zusatzDomainPasst({ email: 'a@partnerfirma.test' }, d)).toBe(true);
    expect(Z.zusatzDomainPasst({ email: 'a@partnerfirma.test', hd: 'andere.test' }, d)).toBe(false);
    expect(Z.zusatzDomainPasst({ email: 'a@andere.test', hd: 'andere.test' }, d)).toBe(false);
    expect(Z.zusatzDomainPasst({ email: 'a@partnerfirma.test', emailBestaetigt: false }, d)).toBe(false);
    expect(Z.zusatzDomainPasst({ email: 'a@partnerfirma.test' }, [])).toBe(false);
  });
  it('Bezeichnung: 1–40 Zeichen, ohne Steuerzeichen und ohne den Trenner „·“; Vorgabe = Domain', () => {
    expect(Z.labelSauber('  Partner · Firma ')).toBe('Partner Firma');
    expect(Z.labelSauber('x'.repeat(41))).toBeNull();
    expect(Z.vorgabeLabel('a@partnerfirma.test')).toBe('partnerfirma.test');
  });
});

describe('Verbinden', () => {
  it('Anmelde-Adresse: nur lesen (kein Schreiben, kein Gmail), offline, Zustimmung + Kontowahl, PKCE, ohne inkrementelle Scopes', async () => {
    const { url } = await Z.zusatzStarten('kevin');
    const p = new URL(url).searchParams;
    expect(p.get('scope')).toBe('openid email https://www.googleapis.com/auth/calendar.readonly');
    expect(p.get('prompt')).toBe('consent select_account');
    expect(p.get('access_type')).toBe('offline');
    expect(p.get('code_challenge_method')).toBe('S256');
    expect(p.get('include_granted_scopes')).toBeNull();
    expect(p.get('hd')).toBeNull();
    expect(p.get('redirect_uri')).toBe('https://app.makeinnovation.test/api/google/rueckruf');
    expect(await Z.istZusatzState(p.get('state'))).toBe(true);
  });
  it('verbinden legt ein Konto an (gz-…, Vorgabe-Bezeichnung, Hauptkalender) — der Status nennt nur die maskierte Adresse, nie Tokens', async () => {
    const r = await zusatzVerbinden();
    expect(r.neu).toBe(true);
    expect(Z.istZusatzKonto(r.konto)).toBe(true);
    const st = await j(await route.GET!(new Request('http://localhost/api/kalender/google/zusatz', { headers: kopf('kevin') })));
    expect(st.status).toBe(200);
    expect(st.d.konten).toHaveLength(1);
    expect(st.d.konten[0]).toMatchObject({ id: r.konto, konto: 'k***@partnerfirma.test', label: 'partnerfirma.test', status: 'verbunden', kalender: ['primary'] });
    const text = JSON.stringify(st.d);
    expect(text).not.toContain('zweit-erneuerung');
    expect(text).not.toContain('kevin@partnerfirma.test');
    expect(text).not.toMatch(/zweit-\d/);
  });
  it('fremde Domain → abgelehnt, das frische Token sofort widerrufen, nichts gespeichert', async () => {
    zweit.konto = { email: 'kevin@unbekannt.test', hd: 'unbekannt.test', email_verified: true };
    await expect(zusatzVerbinden()).rejects.toMatchObject({ code: 'domain', status: 403 });
    expect(zweit.widerrufen).toContain('zweit-erneuerung');
    expect((await Z.ladeZusatz('kevin')).konten).toEqual([]);
  });
  it('dieselbe Adresse wie das Haupt-Konto → „gleich“; ein zweites Mal dasselbe Konto → „doppelt“', async () => {
    vi.stubEnv('GOOGLE_ZUSATZ_DOMAINS', 'partnerfirma.test,makeinnovation.test');
    zweit.konto = { email: 'kevin@makeinnovation.test', hd: 'makeinnovation.test', email_verified: true };
    await expect(zusatzVerbinden()).rejects.toMatchObject({ code: 'gleich' });
    zweit.konto = { email: 'kevin@partnerfirma.test', hd: 'partnerfirma.test', email_verified: true };
    await zusatzVerbinden();
    await expect(zusatzVerbinden()).rejects.toMatchObject({ code: 'doppelt' });
    expect((await Z.ladeZusatz('kevin')).konten).toHaveLength(1);
  });
  it('ohne Lesezugriff auf den Kalender (Häkchen weggelassen) → abgelehnt und widerrufen', async () => {
    zweit.scopeGewaehrt = 'openid https://www.googleapis.com/auth/userinfo.email';
    await expect(zusatzVerbinden()).rejects.toMatchObject({ code: 'scope-fehlt' });
    expect(zweit.widerrufen.length).toBeGreaterThan(0);
  });
  it('der state gehört der Person, die gestartet hat — eine andere Sitzung löst ihn nicht ein; einmal benutzt ist er verbraucht', async () => {
    const { url } = await Z.zusatzStarten('kevin');
    await expect(Z.zusatzAbschliessen('malin', 'zweit-code', stateAus(url))).rejects.toMatchObject({ code: 'person', status: 403 });
    await expect(Z.zusatzAbschliessen('kevin', 'zweit-code', stateAus(url))).rejects.toMatchObject({ code: 'state' });
  });
  it('ohne freigegebene Domains: nicht eingerichtet (409), die Oberfläche sagt es', async () => {
    vi.stubEnv('GOOGLE_ZUSATZ_DOMAINS', '');
    await expect(Z.zusatzStarten('kevin')).rejects.toMatchObject({ code: 'nicht-konfiguriert' });
    const st = await j(await route.GET!(new Request('http://localhost/api/kalender/google/zusatz', { headers: kopf('kevin') })));
    expect(st.d.konfiguriert).toBe(false);
  });
  it('höchstens fünf weitere Konten', async () => {
    for (let n = 0; n < Z.ZUSATZ_MAX; n++) {
      zweit.konto = { email: `k${n}@partnerfirma.test`, hd: 'partnerfirma.test', email_verified: true };
      await zusatzVerbinden();
    }
    await expect(Z.zusatzStarten('kevin')).rejects.toMatchObject({ code: 'voll' });
  });
});

describe('Rückruf über denselben Pfad', () => {
  it('ein Zusatz-State läuft in den Zusatz-Weg (→ ?google-zusatz=verbunden), die Haupt-Verbindung bleibt unberührt', async () => {
    const vorher = await db.loadJson('google-verbindung--kevin');
    const { url } = await Z.zusatzStarten('kevin');
    const r = await rueckruf.GET!(new Request(`http://localhost/api/google/rueckruf?code=zweit-code&state=${stateAus(url)}`, { headers: kopf('kevin') }));
    expect(r.status).toBe(307);
    expect(r.headers.get('location')).toContain('/os/kalender?google-zusatz=verbunden');
    expect(await db.loadJson('google-verbindung--kevin')).toEqual(vorher);
    expect((await Z.ladeZusatz('kevin')).konten).toHaveLength(1);
  });
  it('ein Haupt-State geht weiter den Weg der Haupt-Verbindung (?google=…)', async () => {
    const { url } = await V.verbindungStarten('kevin', ['kalender']);
    const r = await rueckruf.GET!(new Request(`http://localhost/api/google/rueckruf?code=code-ok&state=${stateAus(url)}`, { headers: kopf('kevin') }));
    expect(r.headers.get('location')).toContain('google=verbunden');
    expect((await Z.ladeZusatz('kevin')).konten).toEqual([]);
  });
  it('Abbruch bei Google → ?google-zusatz=abgebrochen, nichts gespeichert', async () => {
    const { url } = await Z.zusatzStarten('kevin');
    const r = await rueckruf.GET!(new Request(`http://localhost/api/google/rueckruf?error=access_denied&state=${stateAus(url)}`, { headers: kopf('kevin') }));
    expect(r.headers.get('location')).toContain('google-zusatz=abgebrochen');
    expect((await Z.ladeZusatz('kevin')).konten).toEqual([]);
  });
});

describe('Ablauf, Neu verbinden, Trennen', () => {
  it('invalid_grant → „abgelaufen“ + EINE Glocke (neutral, ohne Adresse); ein zweiter Lauf meldet nicht noch einmal', async () => {
    const { konto } = await zusatzVerbinden();
    zweit.refreshOk = false;
    vi.setSystemTime(new Date('2026-10-30T10:00:00.000Z')); // Zugriffstoken abgelaufen
    await KZ.zusatzAbgleichen('kevin');
    await KZ.zusatzAbgleichen('kevin', { voll: true });
    expect((await Z.ladeZusatzKonto('kevin', konto))!.status).toBe('abgelaufen');
    const m = await db.loadJson<{ eintraege: { titel: string; art: string }[] }>('meldungen--kevin');
    const glocken = (m?.eintraege ?? []).filter(e => e.titel === Z.ZUSATZ_MELDUNG);
    expect(glocken).toHaveLength(1);
    expect(glocken[0].titel).not.toContain('@');
    // Der Takt fragt ein abgelaufenes Konto nicht weiter.
    expect(KZ.zusatzFaellig(await KZ.ladeZusatzSpiegel('kevin'), (await Z.ladeZusatz('kevin')).konten, Date.now() + 3600_000)).toBe(false);
  });
  it('Neu verbinden: dasselbe Konto mit einem Klick (login_hint), Zustand wieder „verbunden“, das alte Refresh-Token widerrufen', async () => {
    const { konto } = await zusatzVerbinden();
    zweit.refreshOk = false;
    vi.setSystemTime(new Date('2026-10-30T10:00:00.000Z'));
    await KZ.zusatzAbgleichen('kevin');
    zweit.refreshOk = true; zweit.refreshWert = 'zweit-erneuerung-2';
    const { url } = await Z.zusatzStarten('kevin', { konto });
    expect(new URL(url).searchParams.get('login_hint')).toBe('kevin@partnerfirma.test');
    const r = await Z.zusatzAbschliessen('kevin', 'zweit-code', stateAus(url));
    expect(r).toEqual({ konto, neu: false });
    expect((await Z.ladeZusatzKonto('kevin', konto))!.status).toBe('verbunden');
    expect(zweit.widerrufen).toContain('zweit-erneuerung');
  });
  it('beim Neu-Verbinden ein anderes Konto gewählt → abgelehnt, das alte bleibt', async () => {
    const { konto } = await zusatzVerbinden();
    const { url } = await Z.zusatzStarten('kevin', { konto });
    zweit.konto = { email: 'jemand@partnerfirma.test', hd: 'partnerfirma.test', email_verified: true };
    await expect(Z.zusatzAbschliessen('kevin', 'zweit-code', stateAus(url))).rejects.toMatchObject({ code: 'anderes-konto' });
    expect((await Z.ladeZusatz('kevin')).konten.map(k => k.email)).toEqual(['kevin@partnerfirma.test']);
  });
  it('Trennen (Route): Widerruf bei Google, Zugang und Spiegel weg; die Haupt-Verbindung bit-gleich', async () => {
    const vorher = await db.loadJson('google-verbindung--kevin');
    const { konto } = await zusatzVerbinden();
    await KZ.zusatzAbgleichen('kevin');
    expect(await db.loadJson('kalender-google-zusatz--kevin')).not.toBeNull();
    const r = await j(await route.POST!(new Request('http://localhost/api/kalender/google/zusatz', { method: 'POST', headers: kopf('kevin'), body: JSON.stringify({ aktion: 'trennen', konto }) })));
    expect(r.d).toMatchObject({ ok: true, war: true, widerrufen: true });
    expect(zweit.widerrufen).toContain('zweit-erneuerung');
    expect(await db.loadJson('google-zusatz--kevin')).toBeNull();
    expect(await db.loadJson('kalender-google-zusatz--kevin')).toBeNull();
    expect(await db.loadJson('google-verbindung--kevin')).toEqual(vorher);
  });
});

describe('Zugang', () => {
  it('Dienstweg (auch mit Person) → 403; fremdes Konto ohne Haushalt → 403; ein fremdes Konto einer anderen Person → 404', async () => {
    for (const h of [dienst(), dienst('kevin')]) {
      expect((await route.GET!(new Request('http://localhost/api/kalender/google/zusatz', { headers: h }))).status).toBe(403);
      expect((await route.POST!(new Request('http://localhost/api/kalender/google/zusatz', { method: 'POST', headers: h, body: JSON.stringify({ aktion: 'verbinden' }) }))).status).toBe(403);
    }
    expect((await route.GET!(new Request('http://localhost/api/kalender/google/zusatz', { headers: kopf('fremd') }))).status).toBe(403);
    const { konto } = await zusatzVerbinden();
    const r = await route.POST!(new Request('http://localhost/api/kalender/google/zusatz', { method: 'POST', headers: kopf('malin'), body: JSON.stringify({ aktion: 'trennen', konto }) }));
    expect(r.status).toBe(404);
    expect((await Z.ladeZusatz('kevin')).konten).toHaveLength(1);
    const st = await j(await route.GET!(new Request('http://localhost/api/kalender/google/zusatz', { headers: kopf('malin') })));
    expect(st.d.konten).toEqual([]);
  });
  it('Rückweg: ohne weitere Konten liest der Abgleich der Haupt-Verbindung wie vorher (dieselben Bestände, keine neuen)', async () => {
    await A.googleAbgleichen('kevin');
    const namen = readdirSync(ordner).join(' ');
    expect(namen).not.toMatch(/google-zusatz/);
  });
});
