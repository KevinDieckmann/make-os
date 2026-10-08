// ─── Netzwerken — Erfassen (02.10., Server): POST /api/netzwerken ─────────────
// Echter Datenordner (temporär), zwei Konten im Haushalt + ein fremdes, erfundene Personen (@example.invalid), iCloud als
// nachgebauter CalDAV-Server (nie echtes iCloud). Geprüft: Speichern (Kontakt + Firma + Fotos + Sprachnotiz + Teilnahme),
// Werbe-Einwilligung „keine“, Dublette, jeder Schritt-Typ, Termin im Kalender der ANDEREN Person ohne Gäste + Meldung,
// Idempotenz (Wiederholung, Abbruch nach jedem Schritt), Rechte (Haushalt, Dienstweg 403), Danke-Mail „raus“.
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-netzwerken-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-netzwerken';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Kontakt = import('@/lib/make-one/crm').Kontakt;
type Mod = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let route: Mod;
let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/crm/speicher');
let ablage: typeof import('@/lib/dateien/ablage');
let test: typeof import('@/lib/crm/netzwerken-server').netzwerkenTest;

// ── CalDAV-Attrappe mit zwei Kalendern (Privat Kevin, Privat Malin) ──
const HOME = 'https://p42-caldav.icloud.com/123/calendars/';
const KAL = { 'Privat Kevin': `${HOME}kevin/`, 'Privat Malin': `${HOME}malin/` } as const;
let server: Record<string, Record<string, { ics: string; etag: string }>>;
let ctag = 1;
const puts: { kalender: string; ics: string }[] = [];
const ms = (inhalt: string) => new Response(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">${inhalt}</d:multistatus>`, { status: 207 });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function fakeFetch(url: string, init: RequestInit): Response {
  const kopf = (init.headers ?? {}) as Record<string, string>;
  if (url === 'https://caldav.icloud.com/' && init.method === 'PROPFIND') return ms('<d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>');
  if (url === 'https://caldav.icloud.com/123/principal/') return ms(`<d:response><d:href>/123/principal/</d:href><d:propstat><d:prop><c:calendar-home-set><d:href>${HOME}</d:href></c:calendar-home-set><c:calendar-user-address-set><d:href>mailto:konto@example.invalid</d:href></c:calendar-user-address-set></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`);
  if (url === HOME && init.method === 'PROPFIND') {
    return ms(Object.entries(KAL).map(([name, u]) => `<d:response><d:href>${u.replace('https://p42-caldav.icloud.com', '')}</d:href><d:propstat><d:prop><d:displayname>${name}</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><cs:getctag>${ctag}</cs:getctag><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join(''));
  }
  for (const [name, u] of Object.entries(KAL)) {
    if (url === u && init.method === 'REPORT') return ms(Object.entries(server[name]).map(([n, o]) => `<d:response><d:href>${u.replace('https://p42-caldav.icloud.com', '')}${n}</d:href><d:propstat><d:prop><d:getetag>"${o.etag}"</d:getetag><c:calendar-data>${esc(o.ics)}</c:calendar-data></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join(''));
    if (url.startsWith(u) && url !== u) {
      vi.setSystemTime(new Date(Date.now() + 1000)); // die Uhr läuft (der Stand trägt die Zeit des Abgleichs)
      const datei = url.slice(u.length), da = server[name][datei];
      if (init.method === 'PUT') {
        puts.push({ kalender: name, ics: String(init.body) });
        if (kopf['If-Match'] && (!da || `"${da.etag}"` !== kopf['If-Match'])) return new Response('', { status: 412 });
        if (kopf['If-None-Match'] === '*' && da) return new Response('', { status: 412 });
        server[name][datei] = { ics: String(init.body), etag: `e${puts.length}x` }; ctag++;
        return new Response(null, { status: da ? 204 : 201 });
      }
      if (init.method === 'DELETE') { delete server[name][datei]; ctag++; return new Response(null, { status: 204 }); }
    }
  }
  return new Response('nicht gefunden', { status: 404 });
}

// ── Bausteine ──
// Ein strukturell gültiges Mini-JPEG (JFIF + Scan + Ende) — der Server säubert Metadaten (netz-recht) und lehnt kaputte Aufbauten ab.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0xff, 0xd9]).toString('base64');
const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 1, 2, 3, 4, 5, 6, 7, 8]).toString('base64');
const kopf = (u: string) => ({ 'content-type': 'application/json', 'x-make-user': u });
const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(p ? { 'x-make-person': p } : {}) });
const anfrage = (body: unknown, h: Record<string, string>) => new Request('http://test/api/netzwerken', { method: 'POST', headers: h, body: JSON.stringify(body) });
const senden = async (body: unknown, user = 'kevin') => { const r = await route.POST(anfrage(body, kopf(user))); return { status: r.status, d: await r.json() as Record<string, unknown> & { ok: boolean; kontaktId?: string; fehler?: string; hinweise?: string[]; schonDa?: boolean; zusammengefuehrt?: boolean; neu?: boolean; terminUid?: string; angebotId?: string } }; };
const erfassung = (x: Record<string, unknown> = {}) => ({
  erfassungId: randomUUID(), erfasstAm: new Date().toISOString(), eventId: 'ev-test-1',
  kontakt: { vorname: 'Anna', nachname: 'Beispiel', firma: 'Beispielwerk Nord GmbH', position: 'Geschäftsführerin', email: 'anna.beispiel@example.invalid', telefon: '+49 30 1234567', mobil: '0171 2345678', webseite: 'beispielwerk.example.invalid', anschrift: 'Teststraße 1\n50667 Köln', anrede: 'Du' },
  bilder: [{ name: 'vorderseite.jpg', typ: 'image/jpeg', daten: JPEG }], schritt: 'nur-kontakt', zustaendig: 'kevin', ...x,
});
const kontakte = async () => ((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []);
const crm = () => speicher.ladeCrm();
const meldungen = async (p: string) => ((await db.loadJson<{ eintraege: { art: string; titel: string; link: string; von?: string; bezug?: { art: string; id: string } }[] }>(`meldungen--${p}`))?.eintraege ?? []);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  speicher = await import('@/lib/crm/speicher');
  ablage = await import('@/lib/dateien/ablage');
  test = (await import('@/lib/crm/netzwerken-server')).netzwerkenTest;
  route = (await import('@/app/api/netzwerken/route')) as unknown as Mod;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-02T09:00:00+02:00')); // Freitag, 09:00 Berlin
  vi.stubEnv('ICLOUD_APPLE_ID', 'konto@example.invalid');
  vi.stubEnv('ICLOUD_APP_PASSWORT', 'abcd-efgh-ijkl-mnop');
  vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  server = { 'Privat Kevin': {}, 'Privat Malin': {} };
  ctag = 1; puts.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => fakeFetch(String(u), i)));
  test.nachSchritt = null; test.vorAbhaken = null;
  const k = (id: string, speicherName: string, rolle: string, haushalt: string) => ({ id, speicher: speicherName, email: `${speicherName}@test`, name: speicherName === 'kevin' ? 'Kevin Test' : speicherName === 'malin' ? 'Malin Test' : speicherName, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
  await db.saveJson('konten', { konten: [k('k1', 'kevin', 'inhaber', 'test-haus'), k('k2', 'malin', 'mitglied', 'test-haus'), k('k3', 'fremd', 'mitglied', 'anderer-haus')], einladungen: [] });
  // Frischer Bestand je Test: Kartei, CRM (ein Event heute), Ablage, Journal, Glocken, Kalender-Bezüge.
  await db.saveJson('kontakte', { kontakte: [] });
  await db.saveJson('crm', { ...speicher.leererBestand(), events: [{ id: 'ev-test-1', titel: 'Stammtisch Beispielstadt', format: 'stammtisch', ziel: 'Gespräche', datum: '2026-10-02', status: 'geplant', geaendert: '2026-09-01' }] });
  for (const n of ['crm-dateien--test-haus', 'netzwerken-erfassungen--test-haus', 'meldungen--malin', 'meldungen--kevin', 'kalender-bezug', 'tasks', 'absichten--test-haus']) await db.saveJson(n, n.startsWith('crm-dateien') ? { eintraege: [] } : n.startsWith('netzwerken') ? { eintraege: [] } : n.startsWith('meldungen') ? { eintraege: [], einstellungen: { telegram: false } } : n === 'tasks' ? { projects: [], tasks: [] } : n === 'kalender-bezug' ? { bezuege: {} } : { absichten: [] });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Speichern: Kontakt + Firma + Fotos + Sprachnotiz + Teilnahme', () => {
  it('legt Person, Firma, Dateien und Teilnahme an — Quelle „Netzwerken“, Werbe-Einwilligung „keine“', async () => {
    const e = erfassung({ sprachnotiz: { typ: 'audio/webm;codecs=opus', daten: WEBM, dauerSek: 75 }, info: 'Sucht Unterstützung bei der Nachfolge.' });
    const r = await senden(e);
    expect(r.status).toBe(200);
    expect(r.d).toMatchObject({ ok: true, neu: true, eventId: 'ev-test-1' });
    const k = (await kontakte()).find(x => x.id === r.d.kontaktId)!;
    expect(k.id).toBe(`c-${e.erfassungId}`);
    expect(k).toMatchObject({ vorname: 'Anna', nachname: 'Beispiel', email: 'anna.beispiel@example.invalid', quelle: 'Netzwerken', herkunft: 'veranstaltung', besitzer: 'kevin', anrede: 'Du', typ: 'Netzwerk', stufe: 'neu' });
    expect(k.telefon).toBe('+49 30 1234567');
    expect(k.sms).toBe('+49 171 2345678');
    // Eine Visitenkarte ist keine Einwilligung: KEIN Eintrag — und die Kanal-Ampel für werbliche Mail wird nie grün.
    expect(k.einwilligungen ?? []).toEqual([]);
    const { kanalStatus } = await import('@/lib/crm/recht');
    expect(kanalStatus(k, 'mail').farbe).not.toBe('gruen');
    // Firma: neu, verknüpft, mit Domain/Stadt aus der Karte.
    const c = await crm();
    const f = c.firmen.find(x => x.name === 'Beispielwerk Nord GmbH')!;
    expect(f).toBeTruthy();
    expect(k.firmaId).toBe(f.id);
    expect(f.stadt).toBe('Köln');
    expect(k.notiz).toContain('Teststraße 1, 50667 Köln');
    // Verlauf: „Kennengelernt bei …“ mit Info und dem Vermerk; Sprachnotiz-Aktivität mit Platzhalter.
    const ev = k.aktivitaeten.find(a => a.art === 'event')!;
    expect(ev.text).toContain('Kennengelernt bei Stammtisch Beispielstadt');
    expect(ev.text).toContain('Sucht Unterstützung bei der Nachfolge.');
    expect(ev.text).toContain('Visitenkarte, keine Einwilligung (§ 7 UWG)');
    expect(ev.bezug).toBe('ev-test-1');
    expect(k.aktivitaeten.find(a => a.art === 'notiz')?.text).toContain('Abschrift folgt (KI)');
    expect(k.letzterKontakt).toBe('2026-10-02');
    // Teilnahme „da“ am Event + Netzwerken-Angabe; das Event zählt als durchgeführt.
    const t = c.teilnahmen.find(x => x.kontaktId === k.id)!;
    expect(t).toMatchObject({ eventId: 'ev-test-1', status: 'da', rolle: 'gast', einladenDurch: 'kevin', eingechecktVon: 'kevin', netzwerken: { erfassungId: e.erfassungId, schritt: 'nur-kontakt', zustaendig: 'kevin', erfasstVon: 'kevin', info: 'Sucht Unterstützung bei der Nachfolge.' } });
    expect(t.notiz).toBe('Sucht Unterstützung bei der Nachfolge.');
    expect(c.events.find(x => x.id === 'ev-test-1')?.status).toBe('durchgefuehrt');
    // Fotos + Sprachnotiz verschlüsselt/abgelegt am Kontakt (Art. 17: fällt mit der Person).
    const d = (await ablage.ablageListe('test-haus')).filter(x => x.kontaktId === k.id);
    expect(d.map(x => x.titel).sort()).toEqual([`Sprachnotiz · ${e.erfassungId.slice(0, 8)}`, `Visitenkarte 1/1 · ${e.erfassungId.slice(0, 8)}`]);
    const bild = d.find(x => x.datei?.typ === 'image/jpeg')!;
    expect((await ablage.lesen('test-haus', bild.id))!.bytes.toString('base64')).toBe(JPEG);
    const ton = d.find(x => x.datei?.typ === 'audio/webm')!;
    expect(ton.datei?.name).toMatch(/\.webm$/);
    expect((await ablage.lesen('test-haus', ton.id))!.bytes.toString('base64')).toBe(WEBM);
    // Journal: fertig, ohne Personenkennung.
    const j = (await db.loadJson<{ eintraege: { id: string; fertig?: string; kontaktId?: string }[] }>('netzwerken-erfassungen--test-haus'))!.eintraege;
    expect(j).toHaveLength(1);
    expect(j[0].fertig).toBeTruthy();
    expect(j[0].kontaktId).toBeUndefined();
    expect(JSON.stringify(j)).not.toMatch(/Anna|Beispiel|example/);
  });

  it('Wiederholung (Netz weg, Warteschlange): derselbe Körper tut nichts doppelt', async () => {
    const e = erfassung({ schritt: 'followup' });
    const eins = await senden(e);
    const zwei = await senden(e);
    expect(eins.d.ok && zwei.d.ok).toBe(true);
    expect(zwei.d.schonDa).toBe(true);
    expect((await kontakte())).toHaveLength(1);
    const c = await crm();
    expect(c.teilnahmen).toHaveLength(1);
    expect(c.followups).toHaveLength(1);
    expect(c.firmen).toHaveLength(1);
    expect((await ablage.ablageListe('test-haus'))).toHaveLength(1);
    expect((await kontakte())[0].aktivitaeten.filter(a => a.art === 'event')).toHaveLength(1);
  });

  it('gleichzeitig gesendet (Doppelklick): ein Lauf, ein Ergebnis', async () => {
    const e = erfassung();
    const [a, b] = await Promise.all([senden(e), senden(e)]);
    expect(a.d.ok && b.d.ok).toBe(true);
    expect((await kontakte())).toHaveLength(1);
    expect((await crm()).teilnahmen).toHaveLength(1);
  });

  it('Abbruch nach JEDEM Schritt (vor und nach dem Abhaken): die Wiederholung macht weiter und endet im selben Zustand', async () => {
    // Vor dem Abhaken (Wirkung getan, Journal nicht): ALLE Schritte. Nach dem Abhaken: die mit den schwersten Folgen.
    const alle = ['event', 'firma', 'kontakt', 'dateien', 'teilnahme', 'verlauf', 'schritt', 'termin', 'melden'];
    const lauf = [...alle.map(s => ['vorAbhaken', s] as const), ...['kontakt', 'teilnahme', 'termin'].map(s => ['nachSchritt', s] as const)];
    for (const [haken, abbruch] of lauf) {
      const was = `${haken}:${abbruch}`;
      await beforeEachNeu();
      const e = erfassung({ schritt: 'termin', zustaendig: 'malin', termin: { art: 'telefonat', dauer: 30, start: '2026-10-05T10:00' }, sprachnotiz: { typ: 'audio/webm', daten: WEBM } });
      test[haken] = s => { if (s === abbruch) throw new Error(`Testabbruch nach ${s}`); };
      const kaputt = await senden(e);
      expect(kaputt.status, was).toBe(500);
      test.nachSchritt = null; test.vorAbhaken = null;
      const heil = await senden(e);
      expect(heil.status, was).toBe(200);
      expect(await kontakte(), was).toHaveLength(1);
      const c = await crm();
      expect(c.teilnahmen, was).toHaveLength(1);
      expect(c.firmen, was).toHaveLength(1);
      expect((await ablage.ablageListe('test-haus')), was).toHaveLength(2);
      expect((await kontakte())[0].aktivitaeten.filter(a => a.art === 'event' || a.art === 'termin'), was).toHaveLength(2);
      expect((await kontakte())[0].aktivitaeten.filter(a => a.art === 'notiz'), was).toHaveLength(1);
      expect(puts.filter(p => p.kalender === 'Privat Malin'), was).toHaveLength(1);
      expect((await meldungen('malin')).filter(m => m.art === 'netzwerken'), was).toHaveLength(1);
    }
  }, 240_000);
});
async function beforeEachNeu() {
  server = { 'Privat Kevin': {}, 'Privat Malin': {} }; ctag++; puts.length = 0;
  await db.saveJson('kontakte', { kontakte: [] });
  await db.saveJson('crm', { ...speicher.leererBestand(), events: [{ id: 'ev-test-1', titel: 'Stammtisch Beispielstadt', format: 'stammtisch', ziel: 'Gespräche', datum: '2026-10-02', status: 'geplant', geaendert: '2026-09-01' }] });
  await db.saveJson('crm-dateien--test-haus', { eintraege: [] });
  await db.saveJson('netzwerken-erfassungen--test-haus', { eintraege: [] });
  await db.saveJson('meldungen--malin', { eintraege: [], einstellungen: { telegram: false } });
  await db.saveJson('kalender-bezug', { bezuege: {} });
}

describe('Kennen wir schon? — Dublette serverseitig', () => {
  const bestehend = (x: Partial<Kontakt> = {}): Kontakt => ({ id: 'c-alt-1', vorname: 'Anna', nachname: 'Beispiel', email: 'anna.beispiel@example.invalid', firma: 'Beispielwerk Nord GmbH', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', besitzer: 'malin', ...x } as Kontakt);

  it('gleiche Mail: keine zweite Person — die Erfassung hängt an der bestehenden (auch ohne Prüfung am Handy)', async () => {
    await db.saveJson('kontakte', { kontakte: [bestehend()] });
    const r = await senden(erfassung());
    expect(r.d).toMatchObject({ ok: true, zusammengefuehrt: true, kontaktId: 'c-alt-1', neu: false });
    expect(r.d.hinweise?.[0]).toContain('Anna Beispiel');
    expect(await kontakte()).toHaveLength(1);
    const k = (await kontakte())[0];
    expect(k.besitzer).toBe('malin'); // die bestehende Beziehung bleibt
    expect(k.aktivitaeten.find(a => a.art === 'event')?.text).not.toContain('keine Einwilligung'); // am Bestand wird nichts über seine Einwilligung behauptet
    expect((await crm()).teilnahmen[0].kontaktId).toBe('c-alt-1');
  });

  it('„trotzdem neu“ legt eine zweite Person an', async () => {
    await db.saveJson('kontakte', { kontakte: [bestehend()] });
    const r = await senden(erfassung({ neuErzwingen: true }));
    expect(r.d.neu).toBe(true);
    expect(await kontakte()).toHaveLength(2);
  });

  it('„diesen nehmen“: Erfassung an der gewählten Person, kein neuer Kontakt, keine neue Firma; Art. 18 → 409', async () => {
    await db.saveJson('kontakte', { kontakte: [bestehend({ email: undefined }), bestehend({ id: 'c-gesperrt-1', nachname: 'Gesperrt', eingeschraenkt: { seit: '2026-09-01', grund: 'Antrag', von: 'kevin' } })] });
    const r = await senden(erfassung({ vorhandenKontaktId: 'c-alt-1', kontakt: { vorname: 'Anna', nachname: 'Beispiel' }, schritt: 'followup' }));
    expect(r.d).toMatchObject({ ok: true, kontaktId: 'c-alt-1', neu: false });
    expect(await kontakte()).toHaveLength(2);
    expect((await crm()).firmen).toHaveLength(0);
    expect((await crm()).followups).toHaveLength(1);
    const gesperrt = await senden(erfassung({ vorhandenKontaktId: 'c-gesperrt-1', kontakt: { nachname: 'Gesperrt' } }));
    expect(gesperrt.status).toBe(409);
    expect(gesperrt.d).toMatchObject({ ok: false, eingeschraenkt: true });
  });

  it('bestehende Firma wird verknüpft (Name ohne Rechtsform), nie doppelt angelegt', async () => {
    await db.saveJson('crm', { ...speicher.leererBestand(), events: [{ id: 'ev-test-1', titel: 'Stammtisch Beispielstadt', format: 'stammtisch', ziel: 'x', datum: '2026-10-02', status: 'geplant', geaendert: '2026-09-01' }], firmen: [{ id: 'f-beispielwerk-nord-abc', name: 'Beispielwerk Nord', rolle: 'zielkunde', geaendert: '2026-09-01' }] });
    const r = await senden(erfassung());
    const k = (await kontakte()).find(x => x.id === r.d.kontaktId)!;
    expect(k.firmaId).toBe('f-beispielwerk-nord-abc');
    expect((await crm()).firmen).toHaveLength(1);
  });
});

describe('Jeder Schritt-Typ erzeugt das Richtige', () => {
  it('Follow-up: echtes FollowUp, Frist Standard +2 Werktage, zuständig wie gewählt; Frist wählbar', async () => {
    const r1 = await senden(erfassung({ schritt: 'followup' }));
    const fu = (await crm()).followups[0];
    expect(fu).toMatchObject({ kontaktId: r1.d.kontaktId, art: 'nachricht', status: 'offen', zustaendig: 'kevin', quelle: 'event', bezug: { art: 'event', id: 'ev-test-1' } });
    expect(fu.faellig).toBe('2026-10-06'); // Fr 02.10. + 2 Werktage (Sa/So + Tag der Einheit liegen am Wochenende) = Di 06.10.
    expect(fu.text).toContain('Stammtisch Beispielstadt');
    await senden(erfassung({ schritt: 'followup', followup: { faellig: '2026-10-09' }, kontakt: { vorname: 'Bert', nachname: 'Probe', email: 'bert@example.invalid' }, zustaendig: 'malin' }));
    expect((await crm()).followups.find(f => f.faellig === '2026-10-09')).toMatchObject({ zustaendig: 'malin' });
  });

  it('Qualifizieren: der Lead der Firma steht auf „Qualifizierung“ (ohne Firma: der der Person); ein weiter fortgeschrittener Lead bleibt', async () => {
    const r = await senden(erfassung({ schritt: 'qualifizieren' }));
    const f = (await crm()).firmen.find(x => x.name === 'Beispielwerk Nord GmbH')!;
    expect(f.lead?.status).toBe('qualifizierung');
    expect(r.d.ok).toBe(true);
    const ohne = await senden(erfassung({ schritt: 'qualifizieren', kontakt: { vorname: 'Carla', nachname: 'Solo', email: 'carla@example.invalid' } }));
    expect((await kontakte()).find(x => x.id === ohne.d.kontaktId)?.lead?.status).toBe('qualifizierung');
    // sql bleibt sql
    await db.saveJson('crm', { ...(await crm()), firmen: (await crm()).firmen.map(x => ({ ...x, lead: { status: 'sql', kriterien: {} } })) });
    await senden(erfassung({ schritt: 'qualifizieren', kontakt: { vorname: 'Dora', nachname: 'Dritte', firma: 'Beispielwerk Nord GmbH', email: 'dora@example.invalid' } }));
    expect((await crm()).firmen.find(x => x.name === 'Beispielwerk Nord GmbH')?.lead?.status).toBe('sql');
  });

  it('Vermitteln: ein Deal der Art „Vermittlung“ über den einen Anlageweg (wie in der Kontaktakte), nächster Schritt „Vermitteln an …“, einmal', async () => {
    const e = erfassung({ schritt: 'vermitteln', vermitteln: { an: 'Frau Muster (Steuerberatung)' }, info: 'Braucht Steuerberatung' });
    const r = await senden(e);
    expect(r.status).toBe(200);
    const c = (await crm()).chancen;
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ id: `ch-nw-${e.erfassungId}`, art: 'vermittlung', kontaktIds: [r.d.kontaktId], besitzer: 'kevin', quelle: 'event', quelleBezug: 'ev-test-1', stufe: 'qualifiziert' });
    expect(c[0].naechsterSchritt).toEqual({ text: 'Vermitteln an Frau Muster (Steuerberatung)', datum: '2026-10-06' });
    expect(c[0].notiz).toContain('Braucht Steuerberatung');
    expect(((await db.loadJson<{ tasks: unknown[] }>('tasks'))!).tasks).toHaveLength(0);
    await senden(e); // Wiederholung
    expect((await crm()).chancen).toHaveLength(1);
  });

  it('Andere: Aufgabe mit dem eigenen Text und Frist', async () => {
    await senden(erfassung({ schritt: 'andere', andere: { text: 'Studie zuschicken', faellig: '2026-10-08' } }));
    const t = ((await db.loadJson<{ tasks: { title: string; dueDate?: string }[] }>('tasks'))!).tasks;
    expect(t).toMatchObject([{ title: 'Studie zuschicken', dueDate: '2026-10-08' }]);
  });

  it('Angebot: nur ein ENTWURF im Angebots-Tool, mit Bezug zu Person und Firma — nichts gestellt', async () => {
    const r = await senden(erfassung({ schritt: 'angebot' }));
    expect(r.d.angebotId).toMatch(/^ang-nw-/);
    const a = (await crm()).angebote.find(x => x.id === r.d.angebotId)!;
    expect(a).toMatchObject({ status: 'entwurf', kontaktId: r.d.kontaktId, titel: 'Angebot für Anna Beispiel' });
    expect(a.firmaId).toBeTruthy();
    expect(a.nummer).toBeUndefined();
    expect((await crm()).angebote).toHaveLength(1);
  });

  it('Zu Make.One einladen mit Event: Gast „vorgemerkt“ für das KOMMENDE Event (wie in der Kontaktakte), Einladungsweg nach Ampel — keine Einladung', async () => {
    await db.saveJson('crm', { ...(await crm()), events: [...(await crm()).events, { id: 'ev-makeone-1', titel: 'Make.One Herbst', format: 'dinner', ziel: 'x', datum: '2026-11-12', status: 'geplant', geaendert: '2026-09-01' }] });
    const r = await senden(erfassung({ schritt: 'makeone', makeone: { eventId: 'ev-makeone-1' } }));
    const t = (await crm()).teilnahmen.filter(x => x.eventId === 'ev-makeone-1');
    expect(t).toMatchObject([{ kontaktId: r.d.kontaktId, status: 'vorgemerkt', rolle: 'gast', einladungsweg: 'persoenlich', einladenDurch: 'kevin' }]); // neue Person: keine Einwilligung → persönlich
    expect(((await db.loadJson<{ tasks: unknown[] }>('tasks'))!).tasks).toHaveLength(0);
    expect(puts).toEqual([]);
    expect((await kontakte())[0].einwilligungen ?? []).toEqual([]);
    // Das heutige Event bleibt unberührt (Teilnahme „da“ + Angabe), ein vergangenes oder unbekanntes Ziel zählt nicht.
    expect((await crm()).teilnahmen.filter(x => x.eventId === 'ev-test-1')).toHaveLength(1);
    const ohneZiel = await senden(erfassung({ schritt: 'makeone', makeone: { eventId: 'ev-test-1' }, kontakt: { vorname: 'Bert', nachname: 'Probe', email: 'bert@example.invalid' } }));
    expect((await kontakte()).find(k => k.id === ohneZiel.d.kontaktId)?.labels).toContain('Make.One-Einladung'); // nicht kommend → Rückfall
  });

  it('Zu Make.One einladen ohne Event: Rückfall Label + Aufgabe mit Bezug', async () => {
    const r = await senden(erfassung({ schritt: 'makeone' }));
    const k = (await kontakte()).find(x => x.id === r.d.kontaktId)!;
    expect(k.labels).toContain('Make.One-Einladung');
    const t = ((await db.loadJson<{ tasks: { title: string; bezug?: { kontaktId?: string } }[] }>('tasks'))!).tasks;
    expect(t).toMatchObject([{ title: 'Zu Make.One einladen: Anna Beispiel', bezug: { kontaktId: r.d.kontaktId } }]);
    expect(puts).toEqual([]);
    expect(k.einwilligungen ?? []).toEqual([]);
  });

  it('Nur Kontakt: nichts weiter — aber „Kennengelernt bei“ steht im Verlauf', async () => {
    await senden(erfassung({ schritt: 'nur-kontakt' }));
    const c = await crm();
    expect(c.followups).toHaveLength(0);
    expect(c.angebote).toHaveLength(0);
    expect(((await db.loadJson<{ tasks: unknown[] }>('tasks'))!).tasks).toHaveLength(0);
    expect(c.chancen).toHaveLength(0);
    expect((await kontakte())[0].aktivitaeten.some(a => a.art === 'event')).toBe(true);
    expect(puts).toEqual([]);
  });
});

describe('Termin im Kalender der anderen Person', () => {
  const mitTermin = (x: Record<string, unknown> = {}) => erfassung({ schritt: 'termin', zustaendig: 'malin', termin: { art: 'video', dauer: 45, start: '2026-10-05T10:00' }, ...x });

  it('Kevin bucht in MALINS Kalender: Kennenlerngespräch/Videocall, mit CRM-Bezug, OHNE Gäste/Einladung — und Malin bekommt die Meldung', async () => {
    const r = await senden(mitTermin());
    expect(r.status).toBe(200);
    expect(puts.map(p => p.kalender)).toEqual(['Privat Malin']);
    const ics = puts[0].ics.replace(/\r?\n[ \t]/g, '');
    expect(ics).toMatch(/SUMMARY:Videocall · Anna Beispiel/);
    expect(ics).toMatch(/DTSTART[^:]*:20261005T100000/);
    expect(ics).toMatch(/DTEND[^:]*:20261005T104500/);
    expect(ics).not.toMatch(/ATTENDEE|ORGANIZER/); // keine Einladung — die kommt später per Klick am Termin
    expect(ics).not.toMatch(/c-[0-9a-f]{8}-/);     // Kennungen nie im Termin
    // Bezug nur im Neben-Bestand + Meeting-Aktivität (K3: terminUid, ohne `wann`).
    const bezug = (await db.loadJson<{ bezuege: Record<string, { kontaktId?: string; von?: string }> }>('kalender-bezug'))!.bezuege;
    const [schluessel, b] = Object.entries(bezug)[0];
    expect(schluessel).toMatch(/^malin\|makeos-t-nw-/);
    expect(b).toMatchObject({ kontaktId: r.d.kontaktId, von: 'kevin' });
    const k = (await kontakte())[0];
    const m = k.aktivitaeten.filter(a => a.art === 'termin');
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ terminUid: schluessel });
    expect(m[0].wann).toBeUndefined();
    expect(r.d.terminUid).toBe(schluessel);
    // Teilnahme trägt die Termin-Zeit.
    expect((await crm()).teilnahmen[0].netzwerken).toMatchObject({ schritt: 'termin', zustaendig: 'malin', terminAm: '2026-10-05T10:00' });
    // Glocke bei MALIN (nicht bei Kevin): Art „netzwerken“, Wortlaut mit Person, Art, Kontakt, Datum — Link zum Termin.
    const mm = (await meldungen('malin')).filter(x => x.art === 'netzwerken');
    expect(mm).toHaveLength(1);
    expect(mm[0].titel).toBe('Kevin Test hat dir einen Termin gebucht: Videocall mit Anna Beispiel, Mo 05.10. um 10:00 Uhr');
    expect(mm[0]).toMatchObject({ von: 'kevin', bezug: { art: 'netzwerken', id: expect.any(String) } });
    expect(mm[0].link).toContain('/os/kalender');
    expect(mm[0].link).toContain(encodeURIComponent(schluessel));
    expect(await meldungen('kevin')).toEqual([]);
  });

  it('eigener Kalender: Termin bei mir — keine Meldung an mich selbst', async () => {
    await senden(mitTermin({ zustaendig: 'kevin' }));
    expect(puts.map(p => p.kalender)).toEqual(['Privat Kevin']);
    expect(await meldungen('kevin')).toEqual([]);
    expect(await meldungen('malin')).toEqual([]);
  });

  it('zuständig ohne Kalender in den Einstellungen: 409, die Person ist trotzdem erfasst, der Rest wiederholbar', async () => {
    await db.saveJson('konten', { konten: [
      { id: 'k1', speicher: 'kevin', email: 'k@t', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
      { id: 'k2', speicher: 'malin', email: 'm@t', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
      { id: 'k4', speicher: 'drittperson', email: 'd@t', name: 'Dritte', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
    ], einladungen: [] });
    const r = await senden(mitTermin({ zustaendig: 'drittperson' }));
    expect(r.status).toBe(409);
    expect(r.d.fehler).toMatch(/kein Kalender/);
    expect(puts).toEqual([]);
    expect(await kontakte()).toHaveLength(1); // die Person ist da
  });

  it('Überschneidung: der Termin steht trotzdem, der Hinweis sagt es', async () => {
    server['Privat Malin']['blocker.ics'] = { ics: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:blocker\r\nDTSTAMP:20260901T100000Z\r\nDTSTART;TZID=Europe/Berlin:20261005T100000\r\nDTEND;TZID=Europe/Berlin:20261005T110000\r\nSUMMARY:Anderes\r\nEND:VEVENT\r\nEND:VCALENDAR', etag: 'b1' };
    const r = await senden(mitTermin());
    expect(r.status).toBe(200);
    expect(puts).toHaveLength(1);
    expect(r.d.hinweise?.join(' ')).toMatch(/überschneidet/);
  });

  it('Zuteilung ohne Termin (z. B. Follow-up für die andere Person): Meldung „zugeteilt“ an sie', async () => {
    await senden(erfassung({ schritt: 'followup', zustaendig: 'malin' }));
    const mm = (await meldungen('malin')).filter(x => x.art === 'netzwerken');
    expect(mm).toHaveLength(1);
    expect(mm[0].titel).toBe('Kevin Test hat dir Anna Beispiel (Stammtisch Beispielstadt) zugeteilt — nächster Schritt: Follow-up');
    expect(mm[0].link).toContain('/os/markttraktion');
  });
});

describe('Rechte und Prüfung', () => {
  it('403: ohne Sitzung, fremder Haushalt, Dienstweg mit und ohne Person — nichts geschrieben', async () => {
    const e = erfassung();
    for (const h of [{ 'content-type': 'application/json' }, kopf('fremd'), kopf('unbekannt'), dienst(), dienst('kevin')]) {
      const r = await route.POST(anfrage(e, h));
      expect(r.status, JSON.stringify(h)).toBe(403);
    }
    expect((await route.GET(new Request('http://test/api/netzwerken', { headers: dienst() }))).status).toBe(403);
    expect((await route.GET(new Request('http://test/api/netzwerken', { headers: kopf('fremd') }))).status).toBe(403);
    expect(await kontakte()).toEqual([]);
    expect((await crm()).teilnahmen).toEqual([]);
  });

  it('zuständig nur aus dem Haushalt; kaputte Eingaben → 400/413/415 mit Klartext, nichts geschrieben', async () => {
    expect((await senden(erfassung({ zustaendig: 'fremd' }))).status).toBe(400);
    expect((await senden(erfassung({ erfassungId: 'keine-uuid' }))).status).toBe(400);
    expect((await senden(erfassung({ kontakt: { firma: 'Nur Firma' } }))).d.fehler).toMatch(/Vor- oder Nachname/); // 5.14: einer von beiden reicht
    expect((await senden(erfassung({ schritt: 'quatsch' }))).d.fehler).toMatch(/Schritt/);
    expect((await senden(erfassung({ bilder: [{ name: 'x.gif', typ: 'image/gif', daten: JPEG }] }))).status).toBe(415);
    expect((await senden(erfassung({ info: 'x'.repeat(1001) }))).status).toBe(413);
    expect((await senden(erfassung({ eventId: 'ev-gibt-es-nicht' }))).status).toBe(404);
    // Ein Bild, das keins ist (Typangabe stimmt, Inhalt nicht), wird nach dem Inhalt abgelehnt.
    const falsch = await senden(erfassung({ bilder: [{ name: 'x.jpg', typ: 'image/jpeg', daten: Buffer.from('kein bild').toString('base64') }] }));
    expect(falsch.status).toBe(415);
    expect((await crm()).teilnahmen).toEqual([]);
  });

  it('Event unterwegs ohne Netz angelegt: der Server legt es mit der Erfassung an (einmal)', async () => {
    const e = erfassung({ eventId: 'ev-unterwegs-1', eventNeu: { titel: 'Mixer Messehalle', datum: '2026-10-02', ort: 'Köln' } });
    expect((await senden(e)).status).toBe(200);
    await senden({ ...erfassung({ eventId: 'ev-unterwegs-1', eventNeu: { titel: 'Mixer Messehalle', datum: '2026-10-02' }, kontakt: { vorname: 'Eva', nachname: 'Zweite', email: 'eva@example.invalid' } }) });
    const evs = (await crm()).events.filter(x => x.id === 'ev-unterwegs-1');
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ titel: 'Mixer Messehalle', ort: 'Köln', status: 'durchgefuehrt', marke: 'Netzwerken' });
    expect((await crm()).teilnahmen).toHaveLength(2);
  });

  it('GET: Personen des Haushalts mit „hat Kalender“; freie Zeiten nur für Personen des Haushalts', async () => {
    const g = await (await route.GET(new Request('http://test/api/netzwerken', { headers: kopf('kevin') }))).json();
    expect(g).toMatchObject({ ok: true, ich: 'kevin', personen: [{ id: 'kevin', name: 'Kevin Test', kalender: true }, { id: 'malin', name: 'Malin Test', kalender: true }] });
    expect((await route.GET(new Request('http://test/api/netzwerken?frei=fremd&dauer=45', { headers: kopf('kevin') }))).status).toBe(400);
    expect((await route.GET(new Request('http://test/api/netzwerken?frei=malin&dauer=17', { headers: kopf('kevin') }))).status).toBe(400);
    const f = await (await route.GET(new Request('http://test/api/netzwerken?frei=malin&dauer=45', { headers: kopf('kevin') }))).json();
    expect(f.ok).toBe(true);
    expect(f.tage.length).toBeGreaterThan(0);
    expect(f.tage.length).toBeLessThanOrEqual(10);
    for (const t of f.tage) { expect(t.zeiten.length).toBeLessThanOrEqual(6); for (const z of t.zeiten) expect(z.start.slice(0, 10)).toBe(t.tag); }
    expect(JSON.stringify(f)).not.toMatch(/SUMMARY|Anderes/);
  });
});

describe('Danke-Mail: „ist raus“', () => {
  it('vermerkt Teilnahme + Aktivität ohne Folgen für Stufe/Wiedervorlage; nur wer die Karte erfasst hat; idempotent', async () => {
    const r = await senden(erfassung({ schritt: 'followup' }));
    const kid = r.d.kontaktId!;
    const body = { aktion: 'danke-raus', eventId: 'ev-test-1', kontaktId: kid, anrede: 'Du' };
    const vorher = (await kontakte()).find(x => x.id === kid)!;
    // Malin hat sie nicht kennengelernt → 403
    expect((await senden(body, 'malin')).status).toBe(403);
    expect((await senden(body)).d.ok).toBe(true);
    expect((await senden(body)).d.schonDa).toBe(true);
    const t = (await crm()).teilnahmen[0];
    expect(t.netzwerken?.danke).toMatchObject({ anrede: 'Du', rausAm: '2026-10-02' });
    expect(t.followUpAm).toBe('2026-10-02'); // zählt als nachgefasst (innerhalb 48 Std.)
    const k = (await kontakte()).find(x => x.id === kid)!;
    expect(k.aktivitaeten.filter(a => a.art === 'mail')).toHaveLength(1);
    expect(k.stufe).toBe(vorher.stufe);
    expect(k.wiedervorlage).toBe(vorher.wiedervorlage);
    expect((await senden({ aktion: 'danke-raus', eventId: 'ev-test-1', kontaktId: 'c-gibt-es-nicht' })).status).toBe(404);
    expect((await senden({ aktion: 'danke-raus', eventId: 'kaputt!', kontaktId: kid })).status).toBe(400);
  });
});

// ─── Nachbesserung Prüfung 03.10. (Branch netz-fix2) ───────────────────────────
describe('Art. 18 bei „Dublette“ (kein vorhandenKontaktId)', () => {
  const gesperrt = (x: Partial<Kontakt> = {}): Kontakt => ({ id: 'c-gesperrt-9', vorname: 'Anna', nachname: 'Beispiel', email: 'anna.beispiel@example.invalid', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', besitzer: 'malin', eingeschraenkt: { seit: '2026-09-01', grund: 'Richtigkeit bestritten', von: 'kevin' }, ...x } as Kontakt);

  it('gleiche Mail wie eine eingeschränkte Person: 409 „eingeschränkt“ — nichts angehängt, nichts neu angelegt, keine verwaiste Firma, kein Journal-Eintrag mit Folgen', async () => {
    await db.saveJson('kontakte', { kontakte: [gesperrt()] });
    const r = await senden(erfassung());
    expect(r.status).toBe(409);
    expect(r.d).toMatchObject({ ok: false, eingeschraenkt: true });
    expect(JSON.stringify(r.d)).not.toMatch(/Anna|Beispiel|c-gesperrt/);   // die Meldung nennt die Person nie
    const ks = await kontakte();
    expect(ks).toHaveLength(1);
    expect(ks[0].aktivitaeten).toEqual([]);                  // nichts angehängt
    expect(ks[0].labels ?? []).toEqual([]);
    expect((await crm()).firmen).toEqual([]);                // keine verwaiste Firma
    expect((await crm()).teilnahmen).toEqual([]);
    expect(((await db.loadJson<{ eintraege: unknown[] }>('crm-dateien--test-haus'))!).eintraege).toEqual([]);   // keine Fotos abgelegt
  });

  it('auch mit „trotzdem neu“: eine zweite Person neben der eingeschränkten wäre dieselbe Verarbeitung', async () => {
    await db.saveJson('kontakte', { kontakte: [gesperrt()] });
    const r = await senden(erfassung({ neuErzwingen: true }));
    expect(r.status).toBe(409);
    expect(await kontakte()).toHaveLength(1);
  });

  it('Telefon + gleicher Nachname trifft ebenfalls; bloß gleiche Nummer mit anderem Nachnamen (Zentrale) nicht', async () => {
    await db.saveJson('kontakte', { kontakte: [gesperrt({ email: undefined, telefon: '+49 30 1234567' })] });
    expect((await senden(erfassung({ kontakt: { vorname: 'Anna', nachname: 'Beispiel', telefon: '+49 30 1234567' } }))).status).toBe(409);
    const zentrale = await senden(erfassung({ kontakt: { vorname: 'Karl', nachname: 'Anders', telefon: '+49 30 1234567' } }));
    expect(zentrale.status).toBe(200);
  });

  it('eine NICHT eingeschränkte Person mit gleicher Mail hängt weiter an (Regel unverändert)', async () => {
    await db.saveJson('kontakte', { kontakte: [gesperrt({ eingeschraenkt: undefined, id: 'c-offen-1' })] });
    const r = await senden(erfassung());
    expect(r.d).toMatchObject({ ok: true, zusammengefuehrt: true, kontaktId: 'c-offen-1' });
  });
});

describe('Magic Bytes vor dem ersten Schreiben (415 ohne Teilzustand)', () => {
  const GIF = Buffer.from('GIF89a......').toString('base64');
  const zustand = async () => ({ kontakte: (await kontakte()).length, firmen: (await crm()).firmen.length, teilnahmen: (await crm()).teilnahmen.length, dateien: ((await db.loadJson<{ eintraege: unknown[] }>('crm-dateien--test-haus'))!).eintraege.length, journal: ((await db.loadJson<{ eintraege: unknown[] }>('netzwerken-erfassungen--test-haus'))?.eintraege ?? []).length });

  it('Foto mit Typ „jpeg“, aber GIF/Text/WebP/HEIC-Inhalt → 415, nichts geschrieben (weder Person noch Firma noch Journal)', async () => {
    const vorher = await zustand();
    const webp = Buffer.from('RIFF\0\0\0\0WEBPVP8 ').toString('base64');
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(8)]).toString('base64');
    for (const daten of [GIF, Buffer.from('kein bild, nur Text').toString('base64'), webp, heic]) {
      const r = await senden(erfassung({ bilder: [{ name: 'x.jpg', typ: 'image/jpeg', daten }] }));
      expect(r.status).toBe(415);
    }
    expect(await zustand()).toEqual(vorher);
  });

  it('zweites Foto kaputt: auch das erste wird nicht abgelegt (Prüfung kommt vor allem Schreiben)', async () => {
    const vorher = await zustand();
    const r = await senden(erfassung({ bilder: [{ name: 'a.jpg', typ: 'image/jpeg', daten: JPEG }, { name: 'b.png', typ: 'image/png', daten: GIF }] }));
    expect(r.status).toBe(415);
    expect(r.d.fehler).toMatch(/Foto 2/);
    expect(await zustand()).toEqual(vorher);
  });

  it('Sprachnotiz mit falschem Inhalt → 415 ohne Teilzustand; ein echtes WebM geht', async () => {
    const vorher = await zustand();
    const r = await senden(erfassung({ sprachnotiz: { typ: 'audio/webm', daten: Buffer.from('<html>nein</html>').toString('base64') } }));
    expect(r.status).toBe(415);
    expect(await zustand()).toEqual(vorher);
    expect((await senden(erfassung({ sprachnotiz: { typ: 'audio/webm;codecs=opus', daten: WEBM } }))).status).toBe(200);
  });

  it('PNG mit echtem Kopf wird angenommen', async () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    expect((await senden(erfassung({ bilder: [{ name: 'k.png', typ: 'image/png', daten: png }] }))).status).toBe(200);
  });
});

describe('Kontakt ohne `aktivitaeten` (Altbestand)', () => {
  it('Anhängen an eine bestehende Person ohne Verlaufsliste: kein TypeError, der Verlauf wird angelegt', async () => {
    const alt = { id: 'c-ohne-akt-1', vorname: 'Anna', nachname: 'Beispiel', email: 'anna.beispiel@example.invalid', eignung: '', prio: '', stufe: 'neu', importiertAm: '2026-09-01', geaendertAm: '2026-09-01', besitzer: 'malin' } as unknown as Kontakt;
    expect('aktivitaeten' in alt).toBe(false);
    await db.saveJson('kontakte', { kontakte: [alt] });
    const r = await senden(erfassung({ sprachnotiz: { typ: 'audio/webm', daten: WEBM } }));
    expect(r.status).toBe(200);
    expect(r.d).toMatchObject({ ok: true, zusammengefuehrt: true, kontaktId: 'c-ohne-akt-1' });
    const k = (await kontakte()).find(x => x.id === 'c-ohne-akt-1')!;
    expect(k.aktivitaeten.map(a => a.art)).toEqual(expect.arrayContaining(['event', 'notiz']));
  });
});

describe('Netzwerken-Event ist kein Make.One-Ziel', () => {
  it('„Zu Make.One einladen“ auf ein Event mit Marke „Netzwerken“: Rückfall Label + Aufgabe, keine Gast-Vormerkung', async () => {
    await db.saveJson('crm', { ...(await crm()), events: [...(await crm()).events, { id: 'ev-fremd-1', titel: 'Fremdmesse', marke: 'Netzwerken', format: 'dinner', ziel: 'x', datum: '2026-11-12', status: 'geplant', geaendert: '2026-09-01' }] });
    const r = await senden(erfassung({ schritt: 'makeone', makeone: { eventId: 'ev-fremd-1' } }));
    expect(r.status).toBe(200);
    expect((await crm()).teilnahmen.filter(x => x.eventId === 'ev-fremd-1')).toEqual([]);
    expect((await kontakte()).find(k => k.id === r.d.kontaktId)?.labels).toContain('Make.One-Einladung');
  });
});

describe('lange Alt-Kennung der Kartei als vorhandenKontaktId', () => {
  it('c-<Mail-Slug>-<Hash> (bis 64 Zeichen) wird angenommen, nicht als „ungültig“ abgelehnt', async () => {
    const lang = `c-${'anna-beispiel-example-invalid-beispielwerk-nord-gmbh'.slice(0, 50)}-0a1b2c3d4e5f`;
    expect(lang.length).toBeGreaterThan(62);
    const id = lang.slice(0, 64);
    await db.saveJson('kontakte', { kontakte: [{ id, vorname: 'Anna', nachname: 'Beispiel', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', besitzer: 'malin' } as unknown as Kontakt] });
    const r = await senden(erfassung({ vorhandenKontaktId: id, kontakt: { vorname: 'Anna', nachname: 'Beispiel' }, schritt: 'followup' }));
    expect(r.status).toBe(200);
    expect(r.d).toMatchObject({ ok: true, kontaktId: id, neu: false });
  });
});
