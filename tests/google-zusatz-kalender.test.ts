// Weitere Google-Konten (30.10.) im Kalender: Abgleich nur lesen → Überlagerung des Stands (quelle google-zusatz, nie schreibbar),
// Termine gehören ihrer Person (Verfügbarkeit, freie Zeit), andere Personen sehen nur „Belegt“ und einen neutralen Kalendernamen
// („Sicht Malin bekommt nichts aus Kevins weiterem Konto“), Überschneidungs-Hinweis, Schreiben abgelehnt, dieselbe Einladung nur
// einmal, Rückweg ohne weitere Konten. Echter Datenspeicher (Temp, verschlüsselt), Google nachgebaut, erfundene Domains.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GoogleFake, aufrufeAn } from './fixtures/google-fake';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-google-zusatz-k-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-google-zusatz-k';
process.env.MAKE_OS_KEY = 'dienst-test-google-zusatz-k';

type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response> };
let V: typeof import('@/lib/google/verbindung'), Z: typeof import('@/lib/google/zusatz'), KZ: typeof import('@/lib/kalender/google/zusatz');
let A: typeof import('@/lib/kalender/google/abgleich'), db: typeof import('@/lib/store/local-db'), I: typeof import('@/lib/kalender/icloud');
let VF: typeof import('@/lib/kalender/verfuegbarkeit'), B: typeof import('@/lib/kalender/bezug'), E: typeof import('@/lib/kalender/einstellungen');
let kalender: R, termin: R, zusatzRoute: R;
let haupt: GoogleFake, zweit: GoogleFake;

const GEHEIM = 'ZUSATZ-GEHEIMES-PROJEKT';
const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const j = async (r: Response) => ({ status: r.status, d: await r.json().catch(() => ({})) as Record<string, any> }); // eslint-disable-line @typescript-eslint/no-explicit-any
const stateAus = (url: string) => new URL(url).searchParams.get('state')!;
const ev = (g: GoogleFake, id: string, titel: string, tag: string, von: string, bis: string, extra: Record<string, unknown> = {}) =>
  g.setze({ id, summary: titel, location: 'Besprechungsraum Partner', start: { dateTime: `${tag}T${von}:00+01:00`, timeZone: 'Europe/Berlin' }, end: { dateTime: `${tag}T${bis}:00+01:00`, timeZone: 'Europe/Berlin' }, ...extra });

beforeAll(async () => {
  V = await import('@/lib/google/verbindung'); Z = await import('@/lib/google/zusatz'); KZ = await import('@/lib/kalender/google/zusatz');
  A = await import('@/lib/kalender/google/abgleich'); db = await import('@/lib/store/local-db'); I = await import('@/lib/kalender/icloud');
  VF = await import('@/lib/kalender/verfuegbarkeit'); B = await import('@/lib/kalender/bezug'); E = await import('@/lib/kalender/einstellungen');
  kalender = await import('../app/api/kalender/route') as R; termin = await import('../app/api/kalender/termin/route') as R;
  zusatzRoute = await import('../app/api/kalender/google/zusatz/route') as R;
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
  zweit.kalenderListe = [{ id: 'kevin@partnerfirma.test', summary: 'Partner', primary: true, accessRole: 'owner', timeZone: 'Europe/Berlin' }];
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => {
    const url = new URL(String(u));
    if (url.hostname === 'oauth2.googleapis.com') {
      const p = new URLSearchParams(String(i.body ?? ''));
      return ([p.get('code'), p.get('refresh_token'), p.get('token')].some(x => (x ?? '').startsWith('zweit')) ? zweit : haupt).handle(String(u), i);
    }
    return (String((i.headers as Record<string, string> | undefined)?.Authorization ?? '').startsWith('Bearer zweit') ? zweit : haupt).handle(String(u), i);
  }));
  vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id-test'); vi.stubEnv('GOOGLE_CLIENT_SECRET', 'geheim'); vi.stubEnv('GOOGLE_ERLAUBTE_DOMAIN', 'makeinnovation.test');
  vi.stubEnv('GOOGLE_ZUSATZ_DOMAINS', 'partnerfirma.test');
  vi.stubEnv('MAKE_OS_ADRESSE', 'https://app.makeinnovation.test'); vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubEnv('ICLOUD_APPLE_ID', ''); vi.stubEnv('ICLOUD_APP_PASSWORT', '');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'kevin@example.invalid', name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
    { id: 'k2', speicher: 'malin', email: 'malin@example.invalid', name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  ], einladungen: [] });
  await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Privat Kevin', malin: 'Privat Malin', beide: 'Gemeinsam' } });
  const { url } = await V.verbindungStarten('kevin', ['kalender']);
  await V.verbindungAbschliessen('kevin', 'code-ok', stateAus(url));
  await A.googleAbgleichen('kevin');
});

async function zusatzMitTermin() {
  ev(zweit, 'p1', GEHEIM, '2026-11-03', '14:00', '15:00');
  const { url } = await Z.zusatzStarten('kevin');
  const r = await Z.zusatzAbschliessen('kevin', 'zweit-code', stateAus(url));
  await KZ.zusatzAbgleichen('kevin');
  return r.konto;
}

describe('Abgleich und Überlagerung', () => {
  it('nur lesen: der Abgleich fragt Google nur mit GET; im Stand ein Kalender „Partner · partnerfirma.test“ (google-zusatz, nie schreibbar)', async () => {
    await zusatzMitTermin();
    expect(zweit.aufrufe.filter(a => a.methode !== 'GET' && a.pfad.startsWith('/calendar'))).toEqual([]);
    expect(aufrufeAn(zweit, '/events', 'GET').length).toBeGreaterThan(0);
    const s = await I.ladeStand();
    const k = s.kalender.find(x => x.quelle === 'google-zusatz')!;
    expect(k).toMatchObject({ name: 'Partner · partnerfirma.test', schreibbar: false, person: 'kevin', neutral: 'Weitere Termine · Kevin' });
    const t = I.termineImZeitraum(s, '2026-11-03', '2026-11-04').filter(x => x.titel === GEHEIM);
    expect(t).toHaveLength(1);
    expect(t[0].persoenlich).toBe('kevin');
  });
  it('Sicht Malin bekommt nichts aus Kevins weiterem Konto: GET /api/kalender nur „Belegt“ und der neutrale Kalendername', async () => {
    await zusatzMitTermin();
    const m = await j(await kalender.GET!(new Request('http://localhost/api/kalender?von=2026-11-03&bis=2026-11-04', { headers: kopf('malin') })));
    expect(m.status).toBe(200);
    const text = JSON.stringify(m.d);
    expect(text).not.toContain(GEHEIM);
    expect(text).not.toContain('Besprechungsraum Partner');
    expect(text).not.toContain('Partner · partnerfirma.test');
    expect(text).not.toContain('partnerfirma.test');
    expect(m.d.termine.some((t: { titel: string }) => t.titel === 'Belegt')).toBe(true);
    expect(m.d.kalender.some((k: { name: string }) => k.name === 'Weitere Termine · Kevin')).toBe(true);
    // Kevin selbst sieht seinen Termin mit Titel.
    const k = await j(await kalender.GET!(new Request('http://localhost/api/kalender?von=2026-11-03&bis=2026-11-04', { headers: kopf('kevin') })));
    expect(JSON.stringify(k.d)).toContain(GEHEIM);
  });
  it('maskieren: für jede andere Person „Belegt“, ohne Ort und ohne Kalendernamen', async () => {
    await zusatzMitTermin();
    const t = I.termineImZeitraum(await I.ladeStand(), '2026-11-03', '2026-11-04').find(x => x.titel === GEHEIM)!;
    const m = B.maskieren(t, 'malin');
    expect(m).toMatchObject({ titel: 'Belegt', kalender: 'Weitere Termine · Kevin', maskiert: true });
    expect(m.ort).toBeUndefined();
    expect(B.maskieren(t, 'kevin').titel).toBe(GEHEIM);
  });
  it('Einstellungen: Malin bekommt nur den neutralen Namen; der Kalender liegt im Business', async () => {
    await zusatzMitTermin();
    const e = await E.ladeEinstellungen();
    expect(e.zusatz?.['Partner · partnerfirma.test']).toBe('kevin');
    const fuerMalin = E.einstellungenFuerPerson(e, 'malin');
    expect(JSON.stringify(fuerMalin)).not.toContain('partnerfirma.test');
    expect(fuerMalin.zusatz).toEqual({ 'Weitere Termine · Kevin': 'kevin' });
    const { spaceVonKalender } = await import('@/lib/kalender/space');
    expect(spaceVonKalender(e, 'Partner · partnerfirma.test')).toBe('business');
  });
  it('dieselbe Einladung im Haupt-Kalender zählt nur dort (gleiche Kennung)', async () => {
    ev(haupt, 'gemeinsam1', 'Abstimmung', '2026-11-04', '09:00', '10:00');
    await A.googleAbgleichen('kevin');
    ev(zweit, 'gemeinsam1', 'Abstimmung', '2026-11-04', '09:00', '10:00');
    await zusatzMitTermin();
    const t = I.termineImZeitraum(await I.ladeStand(), '2026-11-04', '2026-11-05').filter(x => x.titel === 'Abstimmung');
    expect(t).toHaveLength(1);
    expect(t[0].persoenlich).toBeUndefined();
  });
});

describe('Belegt — Verfügbarkeit, Hinweis, nie schreiben', () => {
  it('Verfügbarkeit: der Termin belegt Kevin, nicht Malin', async () => {
    await zusatzMitTermin();
    const k = await VF.verfuegbarkeitFuer('kevin', '2026-11-03', '2026-11-04');
    expect(VF.istFrei(k, '2026-11-03T14:15:00', '2026-11-03T14:45:00')).toBe(false);
    const m = await VF.verfuegbarkeitFuer('malin', '2026-11-03', '2026-11-04');
    expect(JSON.stringify(m)).not.toContain(GEHEIM);
    expect(VF.istFrei(m, '2026-11-03T14:15:00', '2026-11-03T14:45:00')).toBe(VF.istFrei(m, '2026-11-03T16:15:00', '2026-11-03T16:45:00'));
  });
  it('Überschneidung: Kevin bekommt den Hinweis (Route), Malin nicht; abgesagte und „frei“ zählen nicht', async () => {
    await zusatzMitTermin();
    const url = '/api/kalender/google/zusatz?start=2026-11-03T14:30&ende=2026-11-03T15:30';
    const k = await j(await zusatzRoute.GET!(new Request(`http://localhost${url}`, { headers: kopf('kevin') })));
    expect(k.d.ueberschneidungen).toEqual([{ kalender: 'Partner · partnerfirma.test', start: '2026-11-03T14:00:00', ende: '2026-11-03T15:00:00', ganztags: false }]);
    const m = await j(await zusatzRoute.GET!(new Request(`http://localhost${url}`, { headers: kopf('malin') })));
    expect(m.d.ueberschneidungen).toEqual([]);
    const daneben = await j(await zusatzRoute.GET!(new Request('http://localhost/api/kalender/google/zusatz?start=2026-11-03T15:00&ende=2026-11-03T16:00', { headers: kopf('kevin') })));
    expect(daneben.d.ueberschneidungen).toEqual([]);
    const t = I.termineImZeitraum(await I.ladeStand(), '2026-11-03', '2026-11-04');
    expect(KZ.ueberschneidungen(t.map(x => ({ ...x, beschaeftigt: false })), 'kevin', '2026-11-03T14:30:00', '2026-11-03T15:30:00')).toEqual([]);
    expect(KZ.ueberschneidungen(t.map(x => ({ ...x, abgesagt: true as const })), 'kevin', '2026-11-03T14:30:00', '2026-11-03T15:30:00')).toEqual([]);
  });
  it('Anlegen im Haupt-Kalender zur selben Zeit: gespeichert (nie blockiert), die Antwort trägt den Hinweis', async () => {
    await zusatzMitTermin();
    const r = await j(await termin.POST!(new Request('http://localhost/api/kalender/termin', { method: 'POST', headers: kopf('kevin'), body: JSON.stringify({ titel: 'Kundengespräch', kalender: 'MAKE Kevin (Google)', start: '2026-11-03T14:30', ende: '2026-11-03T15:30', uid: 'makeos-t-zusatz0001' }) })));
    expect(r.status).toBe(200);
    expect(r.d.ok).toBe(true);
    expect(r.d.ueberschneidungen).toHaveLength(1);
  });
  it('in einen Kalender eines weiteren Kontos schreibt nichts: Anlegen 403, Ändern/Löschen eines Termins dort 403 — Google bekommt keinen Schreibaufruf', async () => {
    await zusatzMitTermin();
    const an = await termin.POST!(new Request('http://localhost/api/kalender/termin', { method: 'POST', headers: kopf('kevin'), body: JSON.stringify({ titel: 'X', kalender: 'Partner · partnerfirma.test', start: '2026-11-05T10:00', ende: '2026-11-05T11:00' }) }));
    expect(an.status).toBe(403);
    const t = I.termineImZeitraum(await I.ladeStand(), '2026-11-03', '2026-11-04').find(x => x.titel === GEHEIM)!;
    const ae = await termin.PATCH!(new Request('http://localhost/api/kalender/termin', { method: 'PATCH', headers: kopf('kevin'), body: JSON.stringify({ uid: B.objektSchluessel(t), titel: 'Neu' }) }));
    expect(ae.status).toBe(403);
    await expect(I.antwortSenden(B.objektSchluessel(t), 'zugesagt', { einladungBestaetigt: true })).rejects.toMatchObject({ status: 403 });
    expect(zweit.aufrufe.filter(a => a.methode !== 'GET' && a.pfad.startsWith('/calendar'))).toEqual([]);
  });
});

describe('Rückweg', () => {
  it('ohne weitere Konten ist der Stand derselbe wie vorher (keine Überlagerung, keine neuen Bestände)', async () => {
    const vorher = await I.ladeStand();
    expect(vorher.kalender.some(k => k.quelle === 'google-zusatz')).toBe(false);
    const konto = await zusatzMitTermin();
    expect((await I.ladeStand()).kalender.some(k => k.quelle === 'google-zusatz')).toBe(true);
    await zusatzRoute.POST!(new Request('http://localhost/api/kalender/google/zusatz', { method: 'POST', headers: kopf('kevin'), body: JSON.stringify({ aktion: 'trennen', konto }) }));
    const nachher = await I.ladeStand();
    expect(nachher.kalender).toEqual(vorher.kalender);
    expect(Object.keys(nachher.objekte)).toEqual(Object.keys(vorher.objekte));
  });
});
