// Termin-Route mit einem Google Kalender: Anlegen, Ändern, Löschen, Gäste nur nach Klick, ETag/Konflikt (Google gewinnt),
// Serien nicht änderbar, eigene Kennung (makeOsId) und eigene ID, Idempotenz, privat der anderen Person, Grenzen zwischen
// Kevin und Malin (Verbindung verwalten nur selbst, Dienstweg 403). Echter Datenspeicher (Temp, verschlüsselt), Google nachgebaut.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GoogleFake, aufrufeAn } from './fixtures/google-fake';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-google-r-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-google-route';
process.env.MAKE_OS_KEY = 'dienst-test-google-route';

type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response>; DELETE?: (r: Request) => Promise<Response> };
let termin: R, kalenderRoute: R, googleRoute: R, trennen: R, status: R, verbinden: R;
let V: typeof import('@/lib/google/verbindung'), A: typeof import('@/lib/kalender/google/abgleich'), S: typeof import('@/lib/kalender/google/stand'), db: typeof import('@/lib/store/local-db');
let g: GoogleFake;

const NAME = 'MAKE Kevin (Google)';
const MORGEN = '2026-10-04';
const kopf = (person: string | null, extra: Record<string, string> = {}) => ({ 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}), ...extra });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const j = async (r: Response) => ({ status: r.status, d: await r.json().catch(() => ({})) as Record<string, any> }); // eslint-disable-line @typescript-eslint/no-explicit-any
const anfrage = (methode: string, url: string, person: string | null, body?: unknown, extra: Record<string, string> = {}) => new Request(`http://localhost${url}`, { method: methode, headers: kopf(person, extra), ...(body ? { body: JSON.stringify(body) } : {}) });
const post = (body: unknown, person = 'kevin') => termin.POST!(anfrage('POST', '/api/kalender/termin', person, body)).then(j);
const patch = (body: unknown, person = 'kevin') => termin.PATCH!(anfrage('PATCH', '/api/kalender/termin', person, body)).then(j);
const loesch = (uid: string, person = 'kevin', q = '') => termin.DELETE!(anfrage('DELETE', `/api/kalender/termin?uid=${encodeURIComponent(uid)}${q}`, person)).then(j);
const neu = (x: Record<string, unknown> = {}) => ({ titel: 'Kennenlernen', kalender: NAME, start: `${MORGEN}T10:00`, ende: `${MORGEN}T11:00`, uid: 'makeos-t-route0001', ...x });
const SK = (uid: string) => `google-kevin|${uid}`;

beforeAll(async () => {
  V = await import('@/lib/google/verbindung'); A = await import('@/lib/kalender/google/abgleich'); S = await import('@/lib/kalender/google/stand'); db = await import('@/lib/store/local-db');
  termin = await import('../app/api/kalender/termin/route') as R; kalenderRoute = await import('../app/api/kalender/route') as R;
  googleRoute = await import('../app/api/kalender/google/route') as R; trennen = await import('../app/api/google/trennen/route') as R;
  status = await import('../app/api/google/status/route') as R; verbinden = await import('../app/api/google/verbinden/route') as R;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

async function verbunden(person: string) {
  const { url } = await V.verbindungStarten(person, ['kalender']);
  await V.verbindungAbschliessen(person, 'code-ok', new URL(url).searchParams.get('state')!);
}

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-03T08:00:00.000Z'));
  g = new GoogleFake();
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => g.handle(String(u), i)));
  vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id-test'); vi.stubEnv('GOOGLE_CLIENT_SECRET', 'geheim'); vi.stubEnv('GOOGLE_ERLAUBTE_DOMAIN', 'makeinnovation.test');
  vi.stubEnv('MAKE_OS_ADRESSE', 'https://app.makeinnovation.test'); vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubEnv('ICLOUD_APPLE_ID', ''); vi.stubEnv('ICLOUD_APP_PASSWORT', '');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'kevin@example.invalid', name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
    { id: 'k2', speicher: 'malin', email: 'malin@example.invalid', name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  ], einladungen: [] });
  await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Privat Kevin', malin: 'Privat Malin', beide: 'Gemeinsam' } });
  await verbunden('kevin');
  await A.googleAbgleichen('kevin');
});

describe('Anlegen', () => {
  it('Termin im Google Kalender: eigene ID aus der UID, makeOsId, Zeit mit Zone, Bezug + Protokoll in MAKE OS, sofort im Stand', async () => {
    const r = await post(neu({ ort: 'Büro', notiz: 'Agenda', erinnerungenMin: [15] }));
    expect(r).toMatchObject({ status: 200, d: { ok: true, uid: 'makeos-t-route0001', schluessel: SK('makeos-t-route0001'), kalender: NAME } });
    const { eventIdFuer } = await import('@/lib/kalender/google/abbilden');
    const ev = g.events.get(eventIdFuer('makeos-t-route0001'))!;
    expect(ev).toMatchObject({ summary: 'Kennenlernen', location: 'Büro', description: 'Agenda', start: { dateTime: `${MORGEN}T10:00:00`, timeZone: 'Europe/Berlin' }, extendedProperties: { private: { makeOsId: 'makeos-t-route0001' } } });
    expect(aufrufeAn(g, '/events', 'POST')[0].query.get('sendUpdates')).toBe('none');
    // Sofort sichtbar — ohne auf Abgleich oder Push zu warten — und der ETag ist als „eigene Schreibung“ gemerkt (Echo).
    const t = (await (await import('@/lib/kalender/icloud')).ladeStand()).objekte;
    expect(Object.values(t).flat().length).toBe(1);
    expect(Object.keys((await S.ladeGoogleStand('kevin'))!.eigene!)).toEqual([eventIdFuer('makeos-t-route0001')]);
    const bezug = (await db.loadJson<{ bezuege: Record<string, { von?: string }> }>('kalender-bezug'))!.bezuege[SK('makeos-t-route0001')];
    expect(bezug.von).toBe('kevin');
    const nachSync = await A.googleAbgleichen('kevin');
    expect(nachSync).toMatchObject({ echo: 1, vonAussen: 0 });
  });
  it('dieselbe UID zweimal: Google meldet 409, MAKE OS antwortet `schonDa` — nie ein Duplikat', async () => {
    await post(neu());
    const r = await post(neu());
    expect(r).toMatchObject({ status: 200, d: { ok: true, schonDa: true } });
    expect(g.events.size).toBe(1);
  });
  it('früher gelöschter Termin mit derselben UID wird wiederhergestellt (Google hält die ID reserviert)', async () => {
    await post(neu());
    expect((await loesch(SK('makeos-t-route0001'))).d.ok).toBe(true);
    expect([...g.events.values()][0].status).toBe('cancelled');
    const r = await post(neu({ titel: 'Wieder da' }));
    expect(r.d.ok).toBe(true);
    const ev = [...g.events.values()][0];
    expect(ev).toMatchObject({ status: 'confirmed', summary: 'Wieder da' });
  });
  it('Serie anlegen geht (RRULE), ganztägig und Arbeitsort auch', async () => {
    const s = await post(neu({ uid: 'makeos-t-serie001', wiederholung: { freq: 'WEEKLY', intervall: 1, tage: ['MO'], anzahl: 3 } }));
    expect(s.d.ok).toBe(true);
    expect(([...g.events.values()].find(e => (e.recurrence as string[] | undefined)?.length)?.recurrence as string[] | undefined)?.[0]).toMatch(/^RRULE:FREQ=WEEKLY/);
    const a = await post({ art: 'arbeitsort', arbeitsort: { art: 'home' }, kalender: NAME, ganztags: true, start: MORGEN, ende: '2026-10-05', uid: 'makeos-t-ort00001', titel: 'x' });
    expect(a.d.ok).toBe(true);
    expect([...g.events.values()].find(e => e.summary === 'Home')).toMatchObject({ start: { date: MORGEN }, transparency: 'transparent' });
  });
  it('ohne gewählten Kalender: Standard „privat“ bleibt der iCloud-Kalender (hier nicht verbunden → 400), bereich „business“ → Google der Person', async () => {
    const privat = await post({ titel: 'P', start: `${MORGEN}T10:00`, ende: `${MORGEN}T11:00`, wer: 'kevin', uid: 'makeos-t-privat01' });
    expect(privat.status).toBe(400);
    expect(g.events.size).toBe(0);
    const biz = await post({ titel: 'B', start: `${MORGEN}T10:00`, ende: `${MORGEN}T11:00`, wer: 'kevin', bereich: 'business', uid: 'makeos-t-business1' });
    expect(biz.d).toMatchObject({ ok: true, kalender: NAME });
    expect(g.events.size).toBe(1);
  });
  it('Malin ohne Google-Verbindung: business → ihr iCloud-Kalender (hier nicht da → 400) — nie Kevins Google', async () => {
    const r = await post({ titel: 'M', start: `${MORGEN}T10:00`, ende: `${MORGEN}T11:00`, wer: 'malin', bereich: 'business', uid: 'makeos-t-malin001' }, 'malin');
    expect(r.status).toBe(400);
    expect(g.events.size).toBe(0);
  });
  it('Google verweigert (403) / 5xx: ehrliche Fehler, kein halber Zustand im Stand', async () => {
    g.fehler.push({ teil: '/events', methode: 'POST', status: 403, body: { error: { code: 403, message: 'Forbidden', errors: [{ reason: 'forbidden' }] } } });
    expect((await post(neu())).status).toBe(403);
    g.fehler.push({ teil: '/events', methode: 'POST', status: 503 });
    expect((await post(neu())).status).toBe(502);
    expect(Object.keys((await S.ladeGoogleStand('kevin'))!.events)).toEqual([]);
  });
});

describe('Einladungen nur nach Klick', () => {
  const mitGast = (x: Record<string, unknown> = {}) => neu({ gaeste: [{ email: 'anna@example.invalid', name: 'Anna' }], ...x });
  it('ohne Bestätigung: 409 mit den Adressen, KEIN Aufruf bei Google', async () => {
    const vorher = g.aufrufe.length;
    const r = await post(mitGast());
    expect(r).toMatchObject({ status: 409, d: { einladung: 'einladung', anzahl: 1, adressen: ['anna@example.invalid'] } });
    expect(g.aufrufe.length).toBe(vorher);
  });
  it('mit Bestätigung: Gast als attendee, Google verschickt (sendUpdates=all); ohne Gäste immer none', async () => {
    const r = await post(mitGast({ einladungBestaetigt: true }));
    expect(r.d).toMatchObject({ ok: true, gaeste: 1 });
    const p = aufrufeAn(g, '/events', 'POST')[0];
    expect(p.query.get('sendUpdates')).toBe('all');
    expect((p.body as { attendees: { email: string }[] }).attendees).toEqual([{ email: 'anna@example.invalid', displayName: 'Anna' }]);
  });
  it('der Dienstweg (ZOE, Takt) darf nie einladen: 403, nichts bei Google', async () => {
    const vorher = g.aufrufe.length;
    const r = await termin.POST!(new Request('http://localhost/api/kalender/termin', { method: 'POST', headers: dienst('kevin'), body: JSON.stringify(mitGast({ einladungBestaetigt: true })) })).then(j);
    expect(r.status).toBe(403);
    expect(g.aufrufe.length).toBe(vorher);
  });
  it('Ändern/Löschen eines Termins mit Gästen braucht die Bestätigung (Absage/Änderung), dann sendUpdates=all', async () => {
    await post(mitGast({ einladungBestaetigt: true }));
    const id = SK('makeos-t-route0001');
    await A.googleAbgleichen('kevin');
    const vorher = g.aufrufe.length;
    const a = await patch({ uid: id, titel: 'Neu' });
    expect(a).toMatchObject({ status: 409, d: { einladung: 'aenderung', anzahl: 1 } });
    expect((await loesch(id)).d).toMatchObject({ einladung: 'absage' });
    expect(g.aufrufe.length).toBe(vorher);
    expect((await patch({ uid: id, titel: 'Neu', einladungBestaetigt: true })).d.ok).toBe(true);
    expect(aufrufeAn(g, '/events', 'PATCH').pop()!.query.get('sendUpdates')).toBe('all');
    expect((await loesch(id, 'kevin', '&einladungBestaetigt=1')).d.ok).toBe(true);
    expect(aufrufeAn(g, '/events', 'DELETE').pop()!.query.get('sendUpdates')).toBe('all');
  });
  it('als Gast nur antworten — nach Bestätigung, nur die EIGENE Antwort ändert sich; Titel/Zeit nie', async () => {
    g.setze({ id: 'fremd1', summary: 'Workshop Nord', organizer: { email: 'nora@example.invalid' }, attendees: [{ email: 'nora@example.invalid', organizer: true, responseStatus: 'accepted' }, { email: 'kevin@makeinnovation.test', self: true, responseStatus: 'needsAction' }], start: { dateTime: `${MORGEN}T08:00:00+02:00`, timeZone: 'Europe/Berlin' }, end: { dateTime: `${MORGEN}T09:00:00+02:00`, timeZone: 'Europe/Berlin' } });
    await A.googleAbgleichen('kevin');
    const id = SK('fremd1');
    expect((await patch({ uid: id, titel: 'Umbenannt' })).status).toBe(400); // Gast: ändern kann nur, wer eingeladen hat
    const ohne = await patch({ uid: id, antwort: 'zugesagt' });
    expect(ohne).toMatchObject({ status: 409, d: { einladung: 'antwort' } });
    const ok = await patch({ uid: id, antwort: 'zugesagt', einladungBestaetigt: true });
    expect(ok.d.ok).toBe(true);
    const ev = g.events.get('fremd1')!;
    expect((ev.attendees as { email: string; responseStatus: string }[])).toEqual([expect.objectContaining({ email: 'nora@example.invalid', responseStatus: 'accepted' }), expect.objectContaining({ email: 'kevin@makeinnovation.test', responseStatus: 'accepted' })]);
    expect(ev.summary).toBe('Workshop Nord');
  });
});

describe('Ändern und Löschen, ETag, Konflikt', () => {
  it('Ändern mit If-Match (ETag aus dem Stand); der neue Stand ist sofort da, makeOsId bleibt', async () => {
    await post(neu());
    const id = SK('makeos-t-route0001');
    const gesehen = (await kalenderGet()).termine[0];
    const r = await patch({ uid: id, stand: gesehen.stand, titel: 'Neu', ort: 'Café', start: `${MORGEN}T12:00`, ende: `${MORGEN}T13:00`, beschaeftigt: false, sichtbarkeit: 'privat' });
    expect(r.d.ok).toBe(true);
    const p = aufrufeAn(g, '/events', 'PATCH').pop()!;
    expect(p.kopf['if-match']).toBe(gesehen.stand);
    expect(p.query.get('sendUpdates')).toBe('none');
    const ev = [...g.events.values()][0];
    expect(ev).toMatchObject({ summary: 'Neu', location: 'Café', transparency: 'transparent', visibility: 'private', start: { dateTime: `${MORGEN}T12:00:00`, timeZone: 'Europe/Berlin' } });
    expect((ev.extendedProperties as { private: Record<string, string> }).private.makeOsId).toBe('makeos-t-route0001');
    expect((await kalenderGet()).termine[0].titel).toBe('Neu');
  });
  it('KONFLIKT: in Google gleichzeitig geändert → 409 mit der Fassung von Google („Google gewinnt“), nichts überschrieben', async () => {
    await post(neu());
    const id = SK('makeos-t-route0001');
    const gesehen = (await kalenderGet()).termine[0];
    const { eventIdFuer } = await import('@/lib/kalender/google/abbilden');
    g.setze({ id: eventIdFuer('makeos-t-route0001'), summary: 'Von Google geändert' }); // ohne Abgleich: der Stand kennt es noch nicht
    const r = await patch({ uid: id, stand: gesehen.stand, titel: 'Meine Fassung' });
    expect(r.status).toBe(409);
    expect(r.d.konflikt).toBe(true);
    expect(r.d.aktuell?.titel).toBe('Von Google geändert');
    expect([...g.events.values()][0].summary).toBe('Von Google geändert');
    // „Meine Fassung speichern“: dieselbe Änderung auf dem NEUEN Stand geht durch.
    const jetzt = (await kalenderGet()).termine[0];
    expect((await patch({ uid: id, stand: jetzt.stand, titel: 'Meine Fassung' })).d.ok).toBe(true);
    expect([...g.events.values()][0].summary).toBe('Meine Fassung');
  });
  it('veralteter `stand` aus dem Browser (anderer ETag als im Bestand) → 409 ohne Aufruf bei Google', async () => {
    await post(neu());
    const vorher = aufrufeAn(g, '/events', 'PATCH').length;
    const r = await patch({ uid: SK('makeos-t-route0001'), stand: '"alt"', titel: 'X' });
    expect(r).toMatchObject({ status: 409, d: { konflikt: true } });
    expect(aufrufeAn(g, '/events', 'PATCH').length).toBe(vorher);
  });
  it('Löschen: DELETE mit If-Match, Termin ist aus dem Stand und der Bezug weg; schon gelöscht = in Ordnung', async () => {
    await post(neu({ bezug: { kontaktId: 'c-anna1' } }));
    const id = SK('makeos-t-route0001');
    const gesehen = (await kalenderGet()).termine[0];
    expect((await loesch(id, 'kevin', `&stand=${encodeURIComponent(gesehen.stand)}`)).d.ok).toBe(true);
    expect(aufrufeAn(g, '/events', 'DELETE')[0].kopf['if-match']).toBe(gesehen.stand);
    expect((await kalenderGet()).termine).toEqual([]);
    expect((await db.loadJson<{ bezuege: Record<string, unknown> }>('kalender-bezug'))!.bezuege[id]).toBeUndefined();
    expect((await loesch(id)).d.ok).toBe(true);
  });
  it('Löschen in Google, während MAKE OS ändern will: 404 → klarer Text, Termin verschwindet aus dem Stand', async () => {
    await post(neu());
    const { eventIdFuer } = await import('@/lib/kalender/google/abbilden');
    g.loesche(eventIdFuer('makeos-t-route0001'));
    const r = await patch({ uid: SK('makeos-t-route0001'), titel: 'X' });
    expect(r.status).toBe(404);
    expect((await kalenderGet()).termine).toEqual([]);
  });
  it('Serien lassen sich NICHT ändern oder löschen (Hinweis: in Google Kalender)', async () => {
    g.setze({ id: 'ser', summary: 'Serie', recurrence: ['RRULE:FREQ=WEEKLY;COUNT=4'], start: { dateTime: `${MORGEN}T08:00:00+02:00`, timeZone: 'Europe/Berlin' }, end: { dateTime: `${MORGEN}T09:00:00+02:00`, timeZone: 'Europe/Berlin' } });
    await A.googleAbgleichen('kevin');
    const a = await patch({ uid: SK('ser'), titel: 'X' });
    expect(a.status).toBe(400); expect(a.d.fehler).toMatch(/Google Kalender/);
    const b = await loesch(SK('ser'));
    expect(b.status).toBe(400); expect(b.d.fehler).toMatch(/Google Kalender/);
    expect(aufrufeAn(g, '/events', 'PATCH').length + aufrufeAn(g, '/events', 'DELETE').length).toBe(0);
  });
  it('Bezüge (Kontakt/Deal …) hängen am Schlüssel google-kevin|uid und lassen sich auch an Serien ändern, ohne Google anzufassen', async () => {
    g.setze({ id: 'ser2', summary: 'Serie', recurrence: ['RRULE:FREQ=WEEKLY;COUNT=4'], start: { dateTime: `${MORGEN}T08:00:00+02:00`, timeZone: 'Europe/Berlin' }, end: { dateTime: `${MORGEN}T09:00:00+02:00`, timeZone: 'Europe/Berlin' } });
    await A.googleAbgleichen('kevin');
    const r = await patch({ uid: SK('ser2'), bezug: { mandatId: 'm-test-1' } });
    expect(r.d.ok).toBe(true);
    expect((await db.loadJson<{ bezuege: Record<string, { mandatId?: string }> }>('kalender-bezug'))!.bezuege[SK('ser2')].mandatId).toBe('m-test-1');
    expect(aufrufeAn(g, '/events', 'PATCH')).toHaveLength(0);
  });
});

async function kalenderGet(person = 'kevin') {
  const r = await j(await kalenderRoute.GET!(anfrage('GET', '/api/kalender?von=2026-10-01&bis=2026-10-31', person)));
  return r.d as { termine: { id: string; titel: string; stand: string; wer: string; maskiert?: boolean; kalenderId: string; link?: string }[]; kalender: { name: string; quelle?: string; wer: string; schreibbar: boolean }[]; google?: { person: string; abgleich: { vorMin: number | null } }[]; einstellungen: { google?: Record<string, string> }; icloud: boolean; quelle: string };
}

describe('Kalender-Antwort', () => {
  it('Google-Kalender in der Liste (quelle google, wer = Person), „letzter Abgleich“ je Google-Kalender, Space Business über die Einstellungen', async () => {
    g.setze({ id: 'a', summary: 'A', hangoutLink: 'https://meet.google.com/xyz', start: { dateTime: `${MORGEN}T08:00:00+02:00`, timeZone: 'Europe/Berlin' }, end: { dateTime: `${MORGEN}T09:00:00+02:00`, timeZone: 'Europe/Berlin' } });
    await A.googleAbgleichen('kevin');
    const d = await kalenderGet();
    expect(d).toMatchObject({ icloud: false, quelle: 'icloud' });
    expect(d.kalender).toEqual([expect.objectContaining({ name: NAME, quelle: 'google', wer: 'kevin', schreibbar: true })]);
    expect(d.google?.[0]).toMatchObject({ person: 'kevin', abgleich: { vorMin: 0 } });
    expect(d.einstellungen.google).toEqual({ [NAME]: 'kevin' });
    const { spaceVonKalender } = await import('@/lib/kalender/space');
    expect(spaceVonKalender(d.einstellungen, NAME)).toBe('business');
    expect(d.termine[0]).toMatchObject({ titel: 'A', wer: 'kevin', link: 'https://meet.google.com/xyz' });
    // Die gespeicherten Einstellungen bleiben unberührt (Rückweg): `google` wird nie geschrieben.
    expect(await db.loadJson('kalender-einstellungen')).not.toHaveProperty('google');
  });
  it('private Termine der anderen Person: nur „Belegt“; Malin kann sie weder ändern noch löschen (403)', async () => {
    await post(neu({ sichtbarkeit: 'privat', titel: 'Geheim' }));
    const malin = await kalenderGet('malin');
    expect(malin.termine[0]).toMatchObject({ titel: 'Belegt', maskiert: true });
    const id = SK('makeos-t-route0001');
    expect((await patch({ uid: id, titel: 'X' }, 'malin')).status).toBe(403);
    expect((await loesch(id, 'malin')).status).toBe(403);
    expect(aufrufeAn(g, '/events', 'PATCH').length + aufrufeAn(g, '/events', 'DELETE').length).toBe(0);
  });
});

describe('Grenzen zwischen den Personen', () => {
  it('Status/Abgleich/Kalender wählen/Trennen/Verbinden gelten nur der EIGENEN Person — Malin berührt Kevins Verbindung nie', async () => {
    const st = await j(await status.GET!(anfrage('GET', '/api/google/status', 'malin')));
    expect(st.d).toMatchObject({ verbunden: false });
    const ab = await j(await googleRoute.POST!(anfrage('POST', '/api/kalender/google', 'malin', { aktion: 'abgleichen' })));
    expect(ab.status).toBe(409);
    expect(ab.d.code).toBe('nicht-verbunden');
    const tr = await j(await trennen.POST!(anfrage('POST', '/api/google/trennen', 'malin')));
    expect(tr.d).toMatchObject({ ok: true, war: false });
    expect(g.widerrufen).toEqual([]);
    expect((await V.googleStatus('kevin')).verbunden).toBe(true);
    expect(await S.ladeGoogleStand('kevin')).toBeTruthy();
  });
  it('der Dienstweg (ZOE, Takt, Skripte) verwaltet keine Verbindung: 403 — auch nicht mit Person im Kopf', async () => {
    for (const [route, methode, url] of [[status, 'GET', '/api/google/status'], [trennen, 'POST', '/api/google/trennen'], [verbinden, 'POST', '/api/google/verbinden'], [googleRoute, 'POST', '/api/kalender/google']] as const) {
      const r = await (route[methode] as (r: Request) => Promise<Response>)(new Request(`http://localhost${url}`, { method: methode, headers: dienst('kevin'), ...(methode === 'POST' ? { body: JSON.stringify({ aktion: 'abgleichen' }) } : {}) }));
      expect(r.status, url).toBe(403);
    }
    expect((await V.googleStatus('kevin')).verbunden).toBe(true);
  });
  it('ohne Anmeldung (kein x-make-user): 403', async () => {
    expect((await status.GET!(anfrage('GET', '/api/google/status', null))).status).toBe(403);
  });
  it('Verbinden starten: nur die Person der Sitzung; die Adresse trägt PKCE + state (keine Person in der URL)', async () => {
    const r = await j(await verbinden.POST!(anfrage('POST', '/api/google/verbinden', 'malin', { funktionen: ['kalender'] })));
    expect(r.d.ok).toBe(true);
    const u = new URL(r.d.url);
    expect(u.host).toBe('accounts.google.com');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(r.d.url).not.toMatch(/malin/);
  });
  it('Trennen (eigene Person): widerruft bei Google, stoppt den Kanal, verwirft den Spiegel; die Termine bleiben in Google', async () => {
    await post(neu());
    const r = await j(await trennen.POST!(anfrage('POST', '/api/google/trennen', 'kevin')));
    expect(r.d).toMatchObject({ ok: true, war: true, widerrufen: true });
    expect((await kalenderGet()).termine).toEqual([]);
    expect(g.events.size).toBe(1);
    expect(g.widerrufen).toEqual(['erneuerung-geheim-1']);
    // Neue Business-Termine fallen zurück auf iCloud (hier nicht verbunden → keine Quelle → 409).
    expect((await post({ titel: 'B', start: `${MORGEN}T10:00`, ende: `${MORGEN}T11:00`, wer: 'kevin', bereich: 'business', uid: 'makeos-t-nachher1' })).status).toBe(409);
  });
});
