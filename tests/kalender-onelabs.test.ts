// Kalender 01.11.: weitere Google-Konten als Firmen-GRUPPE (eine Ebene im Kalender), „Belegt“-Spiegel in den eigenen Google-Hauptkalender
// (anlegen / ändern / löschen, idempotent, keine Schleife, Verfügbarkeit zählt einmal), Business „Für wen: Gemeinsam“ (Google der anlegenden
// Person + Einladung nur nach Bestätigung, ohne Google-Verbindung eine klare Meldung), iCloud-Ziel wählen statt Fehler.
// Wächter „Sicht Malin bekommt nichts aus Kevins weiterem Konto“ (auch nicht den Gruppennamen). Echter Datenspeicher (Temp, verschlüsselt),
// Google und iCloud nachgebaut, erfundene Domains und Gruppen.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GoogleFake, aufrufeAn } from './fixtures/google-fake';
import { IcloudFake } from './fixtures/icloud-fake';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-onelabs-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-onelabs';
process.env.MAKE_OS_KEY = 'dienst-test-onelabs';

type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response>; PUT?: (r: Request) => Promise<Response> };
let V: typeof import('@/lib/google/verbindung'), Z: typeof import('@/lib/google/zusatz'), KZ: typeof import('@/lib/kalender/google/zusatz');
let A: typeof import('@/lib/kalender/google/abgleich'), db: typeof import('@/lib/store/local-db'), I: typeof import('@/lib/kalender/icloud');
let VF: typeof import('@/lib/kalender/verfuegbarkeit'), BS: typeof import('@/lib/kalender/google/belegt-spiegel'), ZI: typeof import('@/lib/kalender/google/ziel');
let kalender: R, termin: R, zusatzRoute: R, einstRoute: R;
let haupt: GoogleFake, zweit: GoogleFake, ic: IcloudFake | null;

const GEHEIM = 'ONELABS-GEHEIMES-PROJEKT';
const GRUPPE = 'Beispielgruppe Nord';
const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const j = async (r: Response) => ({ status: r.status, d: await r.json().catch(() => ({})) as Record<string, any> }); // eslint-disable-line @typescript-eslint/no-explicit-any
const stateAus = (url: string) => new URL(url).searchParams.get('state')!;
const ev = (g: GoogleFake, id: string, titel: string, tag: string, von: string, bis: string, extra: Record<string, unknown> = {}) =>
  g.setze({ id, summary: titel, location: 'Raum Partner', description: 'Agenda geheim', start: { dateTime: `${tag}T${von}:00+01:00`, timeZone: 'Europe/Berlin' }, end: { dateTime: `${tag}T${bis}:00+01:00`, timeZone: 'Europe/Berlin' }, ...extra });
const spiegelInHaupt = () => [...haupt.events.values()].filter(e => (e as { extendedProperties?: { private?: Record<string, unknown> } }).extendedProperties?.private?.makeOsSpiegel && e.status !== 'cancelled');

beforeAll(async () => {
  V = await import('@/lib/google/verbindung'); Z = await import('@/lib/google/zusatz'); KZ = await import('@/lib/kalender/google/zusatz');
  A = await import('@/lib/kalender/google/abgleich'); db = await import('@/lib/store/local-db'); I = await import('@/lib/kalender/icloud');
  VF = await import('@/lib/kalender/verfuegbarkeit'); BS = await import('@/lib/kalender/google/belegt-spiegel'); ZI = await import('@/lib/kalender/google/ziel');
  kalender = await import('../app/api/kalender/route') as R; termin = await import('../app/api/kalender/termin/route') as R;
  zusatzRoute = await import('../app/api/kalender/google/zusatz/route') as R; einstRoute = await import('../app/api/state/kalender-einstellungen/route') as R;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-02T08:00:00.000Z'));
  haupt = new GoogleFake();
  zweit = new GoogleFake();
  ic = null;
  zweit.vorsatz = 'zweit'; zweit.refreshWert = 'zweit-erneuerung';
  zweit.konto = { email: 'kevin@partnerfirma.test', hd: 'partnerfirma.test', email_verified: true };
  zweit.scopeGewaehrt = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.readonly';
  zweit.kalenderId = 'kevin@partnerfirma.test';
  zweit.kalenderListe = [{ id: 'kevin@partnerfirma.test', summary: 'Partner', primary: true, accessRole: 'owner', timeZone: 'Europe/Berlin' }];
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => {
    if (ic) { const r = await ic.handle(String(u), i); if (r) return r; }
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
});

async function hauptVerbinden(person: string, email: string) {
  haupt.konto = { ...haupt.konto, email }; haupt.kalenderId = email;
  haupt.kalenderListe = [{ id: email, summary: email, primary: true, accessRole: 'owner', backgroundColor: '#9fe1e7', timeZone: 'Europe/Berlin' }];
  const { url } = await V.verbindungStarten(person, ['kalender']);
  await V.verbindungAbschliessen(person, 'code-ok', stateAus(url));
  await A.googleAbgleichen(person);
}

/** Kevin: Haupt-Google + ein weiteres Konto mit Termin; optional mit Gruppe. Gibt die Konto-Kennung zurück. */
async function kevinMitZusatz(gruppe?: string) {
  await hauptVerbinden('kevin', 'kevin@makeinnovation.test');
  ev(zweit, 'p1', GEHEIM, '2026-11-03', '14:00', '15:00');
  const { url } = await Z.zusatzStarten('kevin');
  const r = await Z.zusatzAbschliessen('kevin', 'zweit-code', stateAus(url));
  if (gruppe) await Z.zusatzSetzen('kevin', r.konto, { gruppe });
  await KZ.zusatzAbgleichen('kevin');
  return r.konto;
}

describe('Firmen-Gruppe: eine Ebene im Kalender', () => {
  it('Konto mit Gruppe → EIN Kalender „<Gruppe> · <Vorname>“ (Business, eigene Farbe); Kevin sieht den Titel', async () => {
    await kevinMitZusatz(GRUPPE);
    const s = await I.ladeStand();
    const z = s.kalender.filter(k => k.quelle === 'google-zusatz');
    expect(z).toHaveLength(1);
    expect(z[0]).toMatchObject({ name: `${GRUPPE} · Kevin`, schreibbar: false, person: 'kevin', neutral: 'Weitere Termine · Kevin' });
    expect(z[0].farbe).toBe(KZ.gruppeFarbe(GRUPPE));
    const t = I.termineImZeitraum(s, '2026-11-03', '2026-11-04').filter(x => x.titel === GEHEIM);
    expect(t).toHaveLength(1);
    const { spaceVonKalender } = await import('@/lib/kalender/space');
    const { ladeEinstellungen } = await import('@/lib/kalender/einstellungen');
    expect(spaceVonKalender(await ladeEinstellungen(), `${GRUPPE} · Kevin`)).toBe('business');
  });
  it('Sicht Malin bekommt nichts aus Kevins Gruppe: nur „Belegt“, neutraler Name, kein Gruppenname, kein Titel', async () => {
    await kevinMitZusatz(GRUPPE);
    const m = await j(await kalender.GET!(new Request('http://localhost/api/kalender?von=2026-11-03&bis=2026-11-04', { headers: kopf('malin') })));
    expect(m.status).toBe(200);
    const text = JSON.stringify(m.d);
    for (const verboten of [GEHEIM, GRUPPE, 'Raum Partner', 'partnerfirma.test']) expect(text).not.toContain(verboten);
    expect(m.d.termine.some((t: { titel: string }) => t.titel === 'Belegt')).toBe(true);
    const k = await j(await kalender.GET!(new Request('http://localhost/api/kalender?von=2026-11-03&bis=2026-11-04', { headers: kopf('kevin') })));
    expect(JSON.stringify(k.d)).toContain(GEHEIM);
  });
  it('Route: Gruppe setzen/leeren nur für die eigene Person; Dienstweg 403', async () => {
    const konto = await kevinMitZusatz();
    const r = await j(await zusatzRoute.POST!(new Request('http://localhost/api/kalender/google/zusatz', { method: 'POST', headers: kopf('kevin'), body: JSON.stringify({ aktion: 'gruppe', konto, gruppe: GRUPPE }) })));
    expect(r.status).toBe(200);
    expect((await Z.ladeZusatzKonto('kevin', konto))?.gruppe).toBe(GRUPPE);
    const st = await j(await zusatzRoute.GET!(new Request('http://localhost/api/kalender/google/zusatz', { headers: kopf('kevin') })));
    expect(st.d.konten[0]).toMatchObject({ gruppe: GRUPPE, spiegeln: true });
    // Malin kennt Kevins Konto nicht.
    const m = await j(await zusatzRoute.POST!(new Request('http://localhost/api/kalender/google/zusatz', { method: 'POST', headers: kopf('malin'), body: JSON.stringify({ aktion: 'gruppe', konto, gruppe: 'X' }) })));
    expect(m.status).toBe(404);
    const d = await zusatzRoute.POST!(new Request('http://localhost/api/kalender/google/zusatz', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-key': 'dienst-test-onelabs', 'x-make-person': 'kevin' }, body: JSON.stringify({ aktion: 'gruppe', konto, gruppe: 'X' }) }));
    expect(d.status).toBe(403);
    await j(await zusatzRoute.POST!(new Request('http://localhost/api/kalender/google/zusatz', { method: 'POST', headers: kopf('kevin'), body: JSON.stringify({ aktion: 'gruppe', konto, gruppe: '' }) })));
    expect((await Z.ladeZusatzKonto('kevin', konto))?.gruppe).toBeUndefined();
  });
});

describe('„Belegt“-Spiegel in den eigenen Google-Hauptkalender', () => {
  it('legt einen neutralen Block an: Titel „Belegt · <Gruppe>“, privat, beschäftigt, Marke, ohne Ort/Beschreibung/Gäste, ohne Post', async () => {
    await kevinMitZusatz(GRUPPE);
    const bloecke = spiegelInHaupt() as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(bloecke).toHaveLength(1);
    const b = bloecke[0];
    expect(b.summary).toBe(`Belegt · ${GRUPPE}`);
    expect(b).toMatchObject({ visibility: 'private', transparency: 'opaque' });
    expect(b.description).toBeUndefined(); expect(b.location).toBeUndefined(); expect(b.attendees).toBeUndefined();
    expect(b.start.dateTime).toBe('2026-11-03T14:00:00');
    expect(String(b.extendedProperties.private.makeOsSpiegel)).toMatch(/^gz-[0-9a-f]{16}\|[0-9a-f]{24}$/);
    const schreib = haupt.aufrufe.filter(a => a.pfad.includes('/events') && a.methode !== 'GET');
    expect(schreib.every(a => a.query.get('sendUpdates') === 'none')).toBe(true);
    // Das weitere Konto bekommt nie einen Schreibaufruf.
    expect(zweit.aufrufe.filter(a => a.methode !== 'GET' && a.pfad.startsWith('/calendar'))).toEqual([]);
    // Bestand ohne Titel und Zeiten.
    const roh = JSON.stringify(await db.loadJson(BS.belegtSpiegelName('kevin')));
    expect(roh).not.toContain(GEHEIM); expect(roh).not.toContain('Belegt ·'); expect(roh).not.toContain('2026-11-03');
  });
  it('idempotent: ein zweiter Lauf schreibt nichts', async () => {
    await kevinMitZusatz();
    const vorher = haupt.aufrufe.filter(a => a.methode !== 'GET').length;
    const r = await BS.belegtSpiegeln('kevin', { erzwingen: true });
    expect(r).toMatchObject({ neu: 0, geaendert: 0, geloescht: 0 });
    expect(haupt.aufrufe.filter(a => a.methode !== 'GET').length).toBe(vorher);
    expect(spiegelInHaupt()).toHaveLength(1);
  });
  it('ändert mit der Quelle (verschoben) und löscht, wenn sie verschwindet', async () => {
    await kevinMitZusatz();
    const id = spiegelInHaupt()[0].id;
    ev(zweit, 'p1', GEHEIM, '2026-11-03', '16:00', '17:00');
    await KZ.zusatzAbgleichen('kevin');
    const neu = spiegelInHaupt() as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(neu).toHaveLength(1);
    expect(neu[0].id).toBe(id);
    expect(neu[0].start.dateTime).toBe('2026-11-03T16:00:00');
    zweit.loesche('p1');
    await KZ.zusatzAbgleichen('kevin');
    expect(spiegelInHaupt()).toHaveLength(0);
    expect(aufrufeAn(haupt, `/events/${id}`, 'DELETE').length).toBe(1);
  });
  it('abgesagte und „freie“ Termine werden nicht gespiegelt; ganztägige bleiben ganztägig', async () => {
    ev(zweit, 'frei1', 'Frei', '2026-11-05', '09:00', '10:00', { transparency: 'transparent' });
    zweit.setze({ id: 'gt1', summary: 'Messe', start: { date: '2026-11-06' }, end: { date: '2026-11-07' } });
    await kevinMitZusatz();
    const b = spiegelInHaupt() as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(b).toHaveLength(2);
    const gt = b.find(x => x.start.date);
    expect(gt).toMatchObject({ start: { date: '2026-11-06' }, end: { date: '2026-11-07' } });
  });
  it('Schalter aus → Blöcke weg; wieder an → wieder da (nur die Person selbst)', async () => {
    const konto = await kevinMitZusatz();
    const aus = await j(await zusatzRoute.POST!(new Request('http://localhost/api/kalender/google/zusatz', { method: 'POST', headers: kopf('kevin'), body: JSON.stringify({ aktion: 'spiegeln', konto, an: false }) })));
    expect(aus.status).toBe(200);
    expect(spiegelInHaupt()).toHaveLength(0);
    expect((await Z.ladeZusatzKonto('kevin', konto))?.spiegeln).toBe(false);
    await zusatzRoute.POST!(new Request('http://localhost/api/kalender/google/zusatz', { method: 'POST', headers: kopf('kevin'), body: JSON.stringify({ aktion: 'spiegeln', konto, an: true }) }));
    expect(spiegelInHaupt()).toHaveLength(1);
  });
  it('Trennen des weiteren Kontos löscht seine Blöcke', async () => {
    const konto = await kevinMitZusatz();
    expect(spiegelInHaupt()).toHaveLength(1);
    await zusatzRoute.POST!(new Request('http://localhost/api/kalender/google/zusatz', { method: 'POST', headers: kopf('kevin'), body: JSON.stringify({ aktion: 'trennen', konto }) }));
    expect(spiegelInHaupt()).toHaveLength(0);
  });
  it('keine Schleife: Spiegel im Hauptkalender zählt nie als Termin, Verfügbarkeit zählt die Zeit einmal', async () => {
    await kevinMitZusatz(GRUPPE);
    await A.googleAbgleichen('kevin', { voll: true });
    const s = await I.ladeStand();
    const ts = I.termineImZeitraum(s, '2026-11-03', '2026-11-04');
    expect(ts.filter(t => t.titel.startsWith('Belegt ·'))).toHaveLength(0);
    expect(ts.filter(t => t.titel === GEHEIM)).toHaveLength(1);
    const v = await VF.verfuegbarkeitFuer('kevin', '2026-11-03', '2026-11-04');
    expect(VF.istFrei(v, '2026-11-03T14:15:00', '2026-11-03T14:45:00')).toBe(false);
    // Ein zweiter Lauf nach dem Lesen des Hauptkalenders legt nichts doppelt an.
    expect(await BS.belegtSpiegeln('kevin', { erzwingen: true })).toMatchObject({ neu: 0, geaendert: 0 });
  });
  it('ein weiteres Konto, das selbst Spiegel enthält, wird nicht zurückgespiegelt (und nicht als Termin gezeigt)', async () => {
    ev(zweit, 'fremdspiegel', 'Belegt · Anderswo', '2026-11-04', '10:00', '11:00', { extendedProperties: { private: { makeOsSpiegel: 'gz-0000000000000000|abc' } } });
    await kevinMitZusatz();
    expect(spiegelInHaupt()).toHaveLength(1);
    const ts = I.termineImZeitraum(await I.ladeStand(), '2026-11-04', '2026-11-05');
    expect(ts.filter(t => t.titel.includes('Anderswo'))).toHaveLength(0);
  });
  it('ohne Google-Hauptkalender: nichts geschrieben', async () => {
    ev(zweit, 'p1', GEHEIM, '2026-11-03', '14:00', '15:00');
    const { url } = await Z.zusatzStarten('kevin');
    await Z.zusatzAbschliessen('kevin', 'zweit-code', stateAus(url));
    await KZ.zusatzAbgleichen('kevin');
    expect(await BS.belegtSpiegeln('kevin', { erzwingen: true })).toMatchObject({ aus: 'kein-hauptkalender' });
    expect(haupt.aufrufe.filter(a => a.methode !== 'GET')).toEqual([]);
  });
  it('rein: Soll ohne Termine, die schon im Hauptkalender stehen (dieselbe Einladung)', () => {
    const konto = { id: 'gz-1', email: 'a@b.test', label: 'b.test', refreshToken: 'x', scopes: [], kalender: ['k'], verbundenAm: '', status: 'verbunden' as const };
    const kal = { 'gz-aa': { konto: 'gz-1', kalenderId: 'k', name: 'K', events: { e1: { id: 'e1', summary: 'X', start: { dateTime: '2026-11-03T09:00:00+01:00' }, end: { dateTime: '2026-11-03T10:00:00+01:00' } } } } };
    expect(BS.sollBloecke([konto], kal, new Set(), '2026-11-02').bloecke).toHaveLength(1);
    expect(BS.sollBloecke([konto], kal, new Set(['e1']), '2026-11-02').bloecke).toHaveLength(0);
    expect(BS.sollBloecke([{ ...konto, spiegeln: false }], kal, new Set(), '2026-11-02').bloecke).toHaveLength(0);
    expect(BS.sollBloecke([konto], kal, new Set(), '2027-02-01').bloecke).toHaveLength(0); // außerhalb des Fensters
  });
});

describe('Business „Für wen“', () => {
  const koerper = (extra: Record<string, unknown> = {}) => JSON.stringify({ titel: 'Abstimmung', start: '2026-11-10T10:00', ende: '2026-11-10T11:00', bereich: 'business', ...extra });
  it('rein: Gemeinsam → Google der anlegenden Person + andere als Gäste; ohne Verbindung eine Meldung mit Weg', () => {
    const personen = { kevin: { id: 'kevin', name: 'Kevin Beispiel' }, malin: { id: 'malin', name: 'Malin Beispiel' } };
    const google = { kevin: 'MAKE Kevin (Google)', malin: 'MAKE Malin (Google)' };
    const adressen = { kevin: 'kevin@makeinnovation.test', malin: 'malin@makeinnovation.test' };
    expect(ZI.businessZielRein({ wer: 'beide', anlegend: 'kevin', personen, google, adressen, icloud: {} })).toEqual({ kalender: 'MAKE Kevin (Google)', gaeste: [{ email: 'malin@makeinnovation.test', name: 'Malin' }] });
    expect(ZI.businessZielRein({ wer: 'malin', anlegend: 'kevin', personen, google, adressen, icloud: {} })).toEqual({ kalender: 'MAKE Malin (Google)', gaeste: [] });
    const f = ZI.businessZielRein({ wer: 'beide', anlegend: 'kevin', personen, google: { kevin: google.kevin }, adressen, icloud: {} });
    expect(f).toMatchObject({ verbinden: 'google' });
    expect((f as { fehler: string }).fehler).toContain('Malin');
    expect(ZI.businessZielRein({ wer: 'malin', anlegend: 'kevin', personen, google: {}, adressen: {}, icloud: {} })).toMatchObject({ verbinden: 'google' });
  });
  it('Gemeinsam im Business braucht die Einladungs-Bestätigung; danach im Google-Kalender der anlegenden Person mit Gast', async () => {
    await hauptVerbinden('malin', 'malin@makeinnovation.test');
    await hauptVerbinden('kevin', 'kevin@makeinnovation.test');
    const r1 = await j(await termin.POST!(new Request('http://localhost/api/kalender/termin', { method: 'POST', headers: kopf('kevin'), body: koerper({ wer: 'beide', uid: 'makeos-t-gemeinsam-1' }) })));
    expect(r1.status).toBe(409);
    expect(r1.d.einladung).toBeTruthy();
    expect(r1.d.adressen).toEqual(['malin@makeinnovation.test']);
    expect(aufrufeAn(haupt, '/events', 'POST').filter(a => (a.body as { summary?: string })?.summary === 'Abstimmung')).toHaveLength(0);
    const r2 = await j(await termin.POST!(new Request('http://localhost/api/kalender/termin', { method: 'POST', headers: kopf('kevin'), body: koerper({ wer: 'beide', uid: 'makeos-t-gemeinsam-1', einladungBestaetigt: true }) })));
    expect(r2.status).toBe(200);
    expect(r2.d.kalender).toBe('MAKE Kevin (Google)');
    const p = aufrufeAn(haupt, '/events', 'POST').find(a => (a.body as { summary?: string })?.summary === 'Abstimmung')!;
    expect((p.body as { attendees: { email: string }[] }).attendees.map(x => x.email)).toEqual(['malin@makeinnovation.test']);
    expect(p.query.get('sendUpdates')).toBe('all');
  });
  it('Gemeinsam ohne Google-Verbindung der anderen Person → klare Meldung (409, verbinden), kein iCloud-Fehler', async () => {
    await hauptVerbinden('kevin', 'kevin@makeinnovation.test');
    const r = await j(await termin.POST!(new Request('http://localhost/api/kalender/termin', { method: 'POST', headers: kopf('kevin'), body: koerper({ wer: 'beide' }) })));
    expect(r.status).toBe(409);
    expect(r.d.verbinden).toBe('google');
    expect(r.d.fehler).toContain('Malin');
    expect(r.d.fehler).not.toContain('iCloud');
  });
  it('die Person im Business → ihr Google-Kalender', async () => {
    await hauptVerbinden('kevin', 'kevin@makeinnovation.test');
    const r = await j(await termin.POST!(new Request('http://localhost/api/kalender/termin', { method: 'POST', headers: kopf('kevin'), body: koerper({ wer: 'kevin', uid: 'makeos-t-person-1' }) })));
    expect(r.status).toBe(200);
    expect(r.d.kalender).toBe('MAKE Kevin (Google)');
  });
});

describe('iCloud-Ziel wählen statt Fehler', () => {
  it('fehlt „Gemeinsam“ in iCloud → Auswahl der vorhandenen Kalender; einmal festlegen (Einstellungen) → Termin speichert', async () => {
    vi.stubEnv('ICLOUD_APPLE_ID', 'kevin@example.invalid'); vi.stubEnv('ICLOUD_APP_PASSWORT', 'abcd-efgh-ijkl-mnop');
    ic = new IcloudFake().add('privat-kevin', 'Privat Kevin').add('familie', 'Familie');
    await I.abgleichen({ erzwingen: true });
    const body = JSON.stringify({ titel: 'Abendessen', start: '2026-11-10T19:00', ende: '2026-11-10T20:00', wer: 'beide', uid: 'makeos-t-icloud-wahl-1' });
    const r1 = await j(await termin.POST!(new Request('http://localhost/api/kalender/termin', { method: 'POST', headers: kopf('kevin'), body })));
    expect(r1.status).toBe(409);
    expect(r1.d.kalenderWaehlen.fach).toBe('beide');
    expect(r1.d.kalenderWaehlen.auswahl).toEqual(expect.arrayContaining(['Privat Kevin', 'Familie']));
    const e = await einstRoute.PUT!(new Request('http://localhost/api/state/kalender-einstellungen', { method: 'PUT', headers: kopf('kevin'), body: JSON.stringify({ teil: { kalender: { beide: 'Familie' } } }) }));
    expect(e.status).toBe(200);
    const r2 = await j(await termin.POST!(new Request('http://localhost/api/kalender/termin', { method: 'POST', headers: kopf('kevin'), body })));
    expect(r2.status).toBe(200);
    expect(r2.d.kalender).toBe('Familie');
    expect(Object.keys(ic.kalender.familie.objekte)).toHaveLength(1);
  });
});
