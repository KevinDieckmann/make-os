// ─── Netzwerken — Korrekturen aus der Lese-Prüfung (03.10., Server) ───────────
// Echter Datenordner (temporär), CalDAV-Attrappe, erfundene Personen. Je Punkt der Prüfung ein Test, auf das RICHTIGE Verhalten umgedreht:
// Termin-Fehlerfall (kein Termin in Danke-Mail/Bericht, „Ohne Termin abschließen“), Telefon-Dublette, Standardansicht Leads,
// Event-Kennzahlen getrennt, Firma ohne Vertrieb, Dubletten-Folgen (keine verwaiste Firma, Lücken füllen), Rechtsgrundlage,
// Erreichbarkeit (Kennungen, Label), Person der Erfassung, Termin belegt/außerhalb der Arbeitszeit.
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
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 1, 2, 3, 4, 5, 6, 7, 8]).toString('base64');
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

const mitTermin = (x: Record<string, unknown> = {}) => erfassung({ schritt: 'termin', zustaendig: 'malin', termin: { art: 'video', dauer: 45, start: '2026-10-05T10:00' }, ...x });
const drittKonten = () => db.saveJson('konten', { konten: [
  { id: 'k1', speicher: 'kevin', email: 'k@t', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
  { id: 'k2', speicher: 'malin', email: 'm@t', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
  { id: 'k4', speicher: 'drittperson', email: 'd@t', name: 'Dritte', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
], einladungen: [] });

describe('2 · Termin-Fehlerfall: nie ein Termin in Teilnahme, Danke-Mail und Bericht, den es nicht gibt', () => {
  it('Normalfall: terminAm/terminId stehen NACH dem Anlegen an der Teilnahme, die Begegnung gilt als nachgefasst', async () => {
    const r = await senden(mitTermin());
    expect(r.status).toBe(200);
    const t = (await crm()).teilnahmen[0];
    expect(t.netzwerken).toMatchObject({ schritt: 'termin', terminAm: '2026-10-05T10:00', terminId: r.d.terminUid });
    expect(t.followUpAm).toBe('2026-10-02');
    expect(r.d).toMatchObject({ terminUid: expect.any(String), terminTag: '2026-10-05' });
  });

  it('Kalender fehlt (409 teilweise): Teilnahme ohne Termin-Angabe, Danke-Mail nennt keinen Termin, Bericht sagt „Termin nicht angelegt“', async () => {
    await drittKonten();
    const r = await senden(mitTermin({ zustaendig: 'drittperson' }));
    expect(r.status).toBe(409);
    expect(r.d).toMatchObject({ teilweise: true });
    const t = (await crm()).teilnahmen[0];
    expect(t.netzwerken?.schritt).toBe('termin');
    expect(t.netzwerken?.terminAm).toBeUndefined();
    expect(t.netzwerken?.terminId).toBeUndefined();
    expect(t.followUpAm).toBeUndefined(); // nichts nachgefasst — es gibt keinen Termin
    const { dankeEntwurf, berichtAus } = await import('@/lib/crm/netzwerken');
    const danke = dankeEntwurf({ vorname: 'Anna', nachname: 'Beispiel', anrede: 'Du', eventTitel: 'X', wann: 'gestern', schritt: t.netzwerken!.schritt, terminAm: t.netzwerken!.terminAm, absender: 'K' }).text;
    expect(danke).not.toMatch(/Termin ist am/);
    const c = await crm();
    const b = berichtAus({ event: c.events[0], teilnahmen: c.teilnahmen, kontakte: await kontakte(), followups: c.followups, heute: '2026-10-02' });
    expect(b.zeilen[0].offen).toContain('Termin nicht angelegt');
  });

  it('„Ohne Termin abschließen“: dieselbe Erfassung mit ohneTermin → Follow-up zum nächsten Werktag („Termin vereinbaren“), Teilnahme wird Follow-up, Meldung ohne Termin', async () => {
    await drittKonten();
    const e = mitTermin({ zustaendig: 'drittperson', info: 'Wollte sich melden.' });
    expect((await senden(e)).status).toBe(409);
    const r = await senden({ ...e, ohneTermin: true });
    expect(r.status).toBe(200);
    expect(r.d.followupId).toBe(`fu-${e.erfassungId}`);
    expect(r.d.terminUid).toBeUndefined();
    expect(r.d.hinweise?.join(' ')).toMatch(/Ohne Termin abgeschlossen/);
    const c = await crm();
    const fu = c.followups.find(f => f.id === `fu-${e.erfassungId}`)!;
    expect(fu).toMatchObject({ faellig: '2026-10-05', zustaendig: 'drittperson', status: 'offen' }); // Freitag + 1 Werktag = Montag
    expect(fu.text).toContain('Termin vereinbaren');
    const t = c.teilnahmen[0];
    expect(t.netzwerken?.schritt).toBe('followup');
    expect(t.netzwerken?.terminAm).toBeUndefined();
    expect(puts).toEqual([]);
    // Meldung an die zuständige Person: Follow-up, nicht „Termin gebucht“.
    const m = (await meldungen('drittperson')).filter(x => x.art === 'netzwerken');
    expect(m).toHaveLength(1);
    expect(m[0].titel).toContain('nächster Schritt: Follow-up (Termin vereinbaren)');
    expect(m[0].titel).not.toContain('Termin gebucht');
    // Zweimal gesendet: nichts doppelt.
    const nochmal = await senden({ ...e, ohneTermin: true });
    expect(nochmal.d.schonDa).toBe(true);
    expect((await crm()).followups.filter(f => f.id === `fu-${e.erfassungId}`)).toHaveLength(1);
  });

  it('ohneTermin bei bereits angelegtem Termin ändert nichts (der Termin gilt)', async () => {
    const e = mitTermin();
    await senden(e);
    const r = await senden({ ...e, ohneTermin: true });
    expect(r.d.schonDa).toBe(true);
    expect((await crm()).followups).toEqual([]);
    expect((await crm()).teilnahmen[0].netzwerken?.schritt).toBe('termin');
  });
});

describe('3 · Telefon-Dublette: nur mit gleichem Nachnamen zusammenführen', () => {
  const alt = { id: 'c-alt-tel', vorname: 'Paula', nachname: 'Zentrale', email: 'zentrale@firma.example.invalid', telefon: '+49 30 1234567', firma: 'Firma Alt', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', besitzer: 'malin' };
  it('gleiche Nummer, anderer Nachname: neue Person + Hinweis „gleiche Nummer wie …“', async () => {
    await db.saveJson('kontakte', { kontakte: [alt] });
    const r = await senden(erfassung({ kontakt: { vorname: 'Anna', nachname: 'Beispiel', telefon: '+49 30 1234567' } }));
    expect(r.d).toMatchObject({ neu: true });
    expect(r.d.zusammengefuehrt).toBeUndefined();
    expect(r.d.hinweise?.join(' ')).toMatch(/Gleiche Nummer wie Paula Zentrale/);
    expect(await kontakte()).toHaveLength(2);
  });
  it('gleiche Nummer UND Nachname: zusammengeführt wie bisher', async () => {
    await db.saveJson('kontakte', { kontakte: [alt] });
    const r = await senden(erfassung({ kontakt: { vorname: 'Paula', nachname: 'Zentrale', telefon: '030 1234567' } }));
    expect(r.d).toMatchObject({ zusammengefuehrt: true, neu: false, kontaktId: 'c-alt-tel' });
    expect(await kontakte()).toHaveLength(1);
  });
});

describe('4 · Standardansicht Leads: neue Netzwerken-Leads stehen in „In Arbeit“', () => {
  it('ohne Lead → „Kontaktiert“ (an der Firma); die Zeile zählt als aktiv', async () => {
    const { leads, LEAD_STATUS } = await import('@/lib/crm/leads');
    await senden(erfassung({ schritt: 'followup' }));
    const f = (await crm()).firmen.find(x => x.name === 'Beispielwerk Nord GmbH')!;
    expect(f.lead?.status).toBe('kontaktiert');
    const z = leads(await kontakte(), await crm(), '2026-10-02').find(l => l.name === 'Beispielwerk Nord GmbH')!;
    expect(z.status).toBe('kontaktiert');
    expect(z.gesetzt).toBe(true);
    expect(LEAD_STATUS.find(s => s.id === z.status)!.aktiv).toBe(true);
  });
  it('ohne Firma: Lead an der Person; Status „neu“ wird überschrieben, ein aktiver Status bleibt', async () => {
    const { leads } = await import('@/lib/crm/leads');
    await senden(erfassung({ kontakt: { vorname: 'Solo', nachname: 'Person' }, schritt: 'nur-kontakt' }));
    expect((await kontakte())[0].lead?.status).toBe('kontaktiert');
    expect(leads(await kontakte(), await crm(), '2026-10-02')[0].status).toBe('kontaktiert');
    // bestehende Firma im Gespräch / Qualifizierung: bleibt
    await db.saveJson('crm', { ...(await crm()), firmen: [
      { id: 'f-im-gespraech', name: 'Gespraech GmbH', rolle: 'zielkunde', geaendert: '2026-09-01', lead: { status: 'im_gespraech', kriterien: { schmerz: 'ja', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } } },
      { id: 'f-neu-lead', name: 'Neulead GmbH', rolle: 'zielkunde', geaendert: '2026-09-01', lead: { status: 'neu', kriterien: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } } },
    ] });
    await senden(erfassung({ kontakt: { vorname: 'G', nachname: 'Gespräch', firma: 'Gespraech GmbH' }, schritt: 'nur-kontakt' }));
    await senden(erfassung({ kontakt: { vorname: 'N', nachname: 'Neulead', firma: 'Neulead GmbH' }, schritt: 'followup' }));
    const fi = (await crm()).firmen;
    expect(fi.find(x => x.id === 'f-im-gespraech')!.lead!.status).toBe('im_gespraech');
    expect(fi.find(x => x.id === 'f-neu-lead')!.lead!.status).toBe('kontaktiert');
  });
  it('Qualifizieren bleibt „Qualifizierung“ (nicht auf „Kontaktiert“ zurückgestuft)', async () => {
    await senden(erfassung({ schritt: 'qualifizieren' }));
    expect((await crm()).firmen.find(x => x.name === 'Beispielwerk Nord GmbH')!.lead?.status).toBe('qualifizierung');
  });
});

describe('5 · Event-Kennzahlen: Netzwerken-Events getrennt', () => {
  const neuesEventKörper = { eventId: 'ev-nw-fremd', eventNeu: { titel: 'Fremde Messe Köln', datum: '2026-10-02' } };
  it('Fünf Personen am fremden Event ergeben keine 100-%-Erscheinensquote; eigene Events zählen allein; „Netzwerken: n Kontakte, n Termine, n Follow-ups“ steht getrennt', async () => {
    const { eventKennzahlen } = await import('@/lib/crm/traktion');
    for (let i = 0; i < 5; i++) await senden(erfassung({ ...neuesEventKörper, kontakt: { vorname: 'P' + i, nachname: 'Gast' + i, email: `g${i}@example.invalid` }, schritt: i === 0 ? 'termin' : i === 1 ? 'followup' : 'nur-kontakt', ...(i === 0 ? { zustaendig: 'malin', termin: { art: 'video', dauer: 45, start: '2026-10-05T10:00' } } : {}) }));
    const c = await crm();
    expect(c.events.find(e => e.id === 'ev-nw-fremd')?.marke).toBe('Netzwerken');
    const kp = eventKennzahlen(await kontakte(), c, '2026-10-06');
    const erscheinen = kp.find(x => x.id === 'erscheinen')!;
    expect(erscheinen.ampel).toBe('grau');
    expect(erscheinen.anzeige).toBe('—');
    // Gerechnet wird über das EINE eigene Event (Stammtisch, ohne Gäste) — das fremde Event zählt weder bei den Folgegesprächen noch bei den Events.
    expect(kp.find(x => x.id === 'folgegespraeche')!.quelle).toContain('aus 1 Event(s)');
    expect(kp.find(x => x.id === 'events_90')!.anzeige).toBe('1');
    const nw = kp.find(x => x.id === 'netzwerken')!;
    expect(nw.ampel).toBe('grau'); // nie im Score
    expect(nw.quelle).toContain('Netzwerken: 5 Kontakte, 1 Termine, 1 Follow-ups');
    const { IM_SCORE } = await import('@/lib/crm/traktion');
    expect(Object.values(IM_SCORE).flat()).not.toContain('netzwerken');
  });
  it('Schritte Termin/Angebot/Vermitteln/Make.One: followUpAm = Erfassungstag (nachgefasst); Nur Kontakt und Follow-up nicht', async () => {
    for (const s of ['angebot', 'vermitteln', 'makeone', 'nur-kontakt', 'followup'] as const) {
      await senden(erfassung({ schritt: s, kontakt: { vorname: s, nachname: 'Schritt' + s.replace('-', ''), email: `${s.replace('-', '')}@example.invalid` }, ...(s === 'vermitteln' ? { vermitteln: { an: 'Peter' } } : {}) }));
    }
    const t = (await crm()).teilnahmen;
    const nach = (s: string) => t.find(x => x.netzwerken?.schritt === s)!.followUpAm;
    expect(nach('angebot')).toBe('2026-10-02');
    expect(nach('vermitteln')).toBe('2026-10-02');
    expect(nach('makeone')).toBe('2026-10-02');
    expect(nach('nur-kontakt')).toBeUndefined();
    expect(nach('followup')).toBeUndefined();
    // Die 48-h-Kennzahl rechnet sie als pünktlich nachgefasst (Frist 04.10. ist bei 06.10. vorbei): 3 von 5.
    const { eventKennzahlen } = await import('@/lib/crm/traktion');
    const n48 = eventKennzahlen(await kontakte(), await crm(), '2026-10-06').find(x => x.id === 'nachfassen_48h')!;
    expect(n48.wert).toBeCloseTo(3 / 5);
  });
});

describe('6 · Lead an Firma ohne Vertrieb', () => {
  it('Dienstleister / Kein Fit / Ruht / SQL: Lead nicht geändert, Hinweis an den Client, Label „Lead prüfen“ am Kontakt', async () => {
    const kr = { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' };
    await db.saveJson('crm', { ...(await crm()), firmen: [
      { id: 'f-dienst-1', name: 'Dienst GmbH', rolle: 'dienstleister', geaendert: '2026-09-01' },
      { id: 'f-kf-1', name: 'KeinFit GmbH', rolle: 'zielkunde', geaendert: '2026-09-01', lead: { status: 'kein_fit', kriterien: kr } },
      { id: 'f-ruht-1', name: 'Ruht GmbH', rolle: 'zielkunde', geaendert: '2026-09-01', lead: { status: 'ruht', kriterien: kr } },
    ] });
    const a = await senden(erfassung({ schritt: 'qualifizieren', kontakt: { vorname: 'D', nachname: 'Dienst', firma: 'Dienst GmbH' } }));
    const b = await senden(erfassung({ schritt: 'qualifizieren', kontakt: { vorname: 'K', nachname: 'Kein', firma: 'KeinFit GmbH' } }));
    const c = await senden(erfassung({ schritt: 'followup', kontakt: { vorname: 'R', nachname: 'Ruht', firma: 'Ruht GmbH' } }));
    expect(a.d.hinweise?.join(' ')).toContain('Firma ist als „Dienstleister“ geführt — Lead nicht geändert.');
    expect(b.d.hinweise?.join(' ')).toContain('Firma ist als „Kein Fit“ geführt — Lead nicht geändert.');
    expect(c.d.hinweise?.join(' ')).toContain('Firma ist als „Ruht“ geführt — Lead nicht geändert.');
    const fi = (await crm()).firmen;
    expect(fi.find(x => x.id === 'f-dienst-1')!.lead).toBeUndefined();
    expect(fi.find(x => x.id === 'f-kf-1')!.lead!.status).toBe('kein_fit');
    expect(fi.find(x => x.id === 'f-ruht-1')!.lead!.status).toBe('ruht');
    for (const r of [a, b, c]) expect((await kontakte()).find(k => k.id === r.d.kontaktId)!.labels).toContain('Lead prüfen');
    // Ein normaler Fall bekommt weder Hinweis noch Label.
    const ok = await senden(erfassung({ kontakt: { vorname: 'O', nachname: 'Normal', firma: 'Normal GmbH' } }));
    expect(ok.d.hinweise?.join(' ')).not.toContain('Lead nicht geändert');
    expect((await kontakte()).find(k => k.id === ok.d.kontaktId)!.labels).not.toContain('Lead prüfen');
  });
});

describe('7 · Dubletten-Folgen', () => {
  it('keine verwaiste Firma, wenn die Erfassung an einer bestehenden Person hängt (auch mit anderem Firmennamen)', async () => {
    await db.saveJson('kontakte', { kontakte: [{ id: 'c-alt-1', vorname: 'Anna', nachname: 'Beispiel', email: 'anna.beispiel@example.invalid', firma: 'Alt GmbH', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', besitzer: 'malin' }] });
    const r = await senden(erfassung({ kontakt: { vorname: 'Anna', nachname: 'Beispiel', email: 'anna.beispiel@example.invalid', firma: 'Neue Firma Name GmbH' } }));
    expect(r.d.zusammengefuehrt).toBe(true);
    expect((await crm()).firmen.map(f => f.name)).toEqual([]);
    expect((await kontakte())[0].firma).toBe('Alt GmbH');
  });
  it('Wiederholung nach Abbruch direkt nach dem Kontakt-Schritt: die Firma der neuen Person gibt es genau einmal und hängt an ihr', async () => {
    const e = erfassung();
    test.nachSchritt = s => { if (s === 'kontakt') throw new Error('Abbruch'); };
    expect((await senden(e)).status).toBe(500);
    test.nachSchritt = null;
    const r = await senden(e);
    expect(r.d.neu).toBe(true);
    expect((await crm()).firmen).toHaveLength(1);
    expect((await kontakte()).find(k => k.id === r.d.kontaktId)!.firmaId).toBe((await crm()).firmen[0].id);
  });
  it('Name + Firma ohne Mail/Nummer: neue Person + „Gibt es vermutlich schon“ + Label „Dublette prüfen“ (und keine zweite Firma)', async () => {
    await senden(erfassung({ kontakt: { vorname: 'Eva', nachname: 'Dublette', firma: 'Dubletten GmbH' } }));
    const r2 = await senden(erfassung({ kontakt: { vorname: 'Eva', nachname: 'Dublette', firma: 'Dubletten GmbH' } }));
    expect(r2.d.neu).toBe(true);
    expect(r2.d.hinweise?.join(' ')).toMatch(/Gibt es vermutlich schon: Eva Dublette/);
    const ks = await kontakte();
    expect(ks).toHaveLength(2);
    expect(ks.find(k => k.id === r2.d.kontaktId)!.labels).toEqual(['Netzwerken', 'Dublette prüfen']);
    expect(ks.find(k => k.id !== r2.d.kontaktId)!.labels).toEqual(['Netzwerken']);
    expect((await crm()).firmen).toHaveLength(1);
  });
  it('Anhängen füllt LEERE Felder (Telefon, Handy, Position, LinkedIn, Website), überschreibt nichts', async () => {
    await db.saveJson('kontakte', { kontakte: [{ id: 'c-alt-2', vorname: 'Bea', nachname: 'Bestand', email: 'bea@example.invalid', telefon: '+49 30 1111111', position: 'Leiterin', eignung: '', prio: '', stufe: 'angesprochen', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', besitzer: 'malin', quelle: 'HubSpot', herkunft: 'hubspot' }] });
    const r = await senden(erfassung({ kontakt: { vorname: 'Bea', nachname: 'Bestand', email: 'bea@example.invalid', telefon: '+49 30 7778889', mobil: '0171 2345678', position: 'Chefin', linkedin: 'https://www.linkedin.com/in/bea-bestand', webseite: 'bestand.example.invalid' } }));
    expect(r.d.zusammengefuehrt).toBe(true);
    expect(r.d.hinweise?.join(' ')).toMatch(/ergänzt: Handy, LinkedIn, Webseite/);
    const k = (await kontakte())[0];
    expect(k).toMatchObject({ telefon: '+49 30 1111111', position: 'Leiterin', sms: '+49 171 2345678', besitzer: 'malin', quelle: 'HubSpot' });
    expect(k.linkedin).toContain('linkedin.com/in/bea-bestand');
    expect(k.firmaWebseite).toContain('bestand.example.invalid');
    expect(k.labels).toContain('Netzwerken'); // auch eine bestehende Person trägt das Label
  });
  it('„Diesen nehmen“ (vorhandenKontaktId) füllt ebenso nur Lücken', async () => {
    await db.saveJson('kontakte', { kontakte: [{ id: 'c-alt-3', vorname: 'Carl', nachname: 'Bestand', telefon: '+49 30 2222222', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
    await senden(erfassung({ vorhandenKontaktId: 'c-alt-3', kontakt: { nachname: 'X', telefon: '+49 30 9999999', mobil: '0171 2345678' } }));
    const k = (await kontakte())[0];
    expect(k.telefon).toBe('+49 30 2222222');
    expect(k.sms).toBe('+49 171 2345678');
  });
});

describe('8 · Rechtsgrundlage, 9 · Erreichbarkeit', () => {
  it('neue Person: Rechtsgrundlage „berechtigt“ (B2B-Anbahnung), weiterhin KEINE Einwilligung; Label „Netzwerken“', async () => {
    const r = await senden(erfassung());
    const k = (await kontakte())[0];
    expect(k.rechtsgrundlage).toBe('berechtigt');
    expect(k.einwilligungen ?? []).toEqual([]);
    expect(k.labels).toEqual(['Netzwerken']);
    expect(r.d.neu).toBe(true);
  });
  it('der Server liefert alle Kennungen: Termin (+ Tag), Deal, Follow-up, Event, Person', async () => {
    const t = await senden(mitTermin());
    expect(t.d).toMatchObject({ kontaktId: expect.any(String), eventId: 'ev-test-1', terminUid: expect.any(String), terminTag: '2026-10-05' });
    const v = await senden(erfassung({ schritt: 'vermitteln', vermitteln: { an: 'Peter' }, kontakt: { vorname: 'V', nachname: 'Vermittlung' } }));
    expect(v.d.dealId).toBe(`ch-nw-${(await crm()).chancen[0].id.slice(6)}`);
    expect((await crm()).chancen[0].id).toBe(v.d.dealId);
    const f = await senden(erfassung({ schritt: 'followup', kontakt: { vorname: 'F', nachname: 'Folge' } }));
    expect((await crm()).followups.map(x => x.id)).toContain(f.d.followupId);
  });
  it('Abendbericht: Zeilen tragen Links (Termin, Deal, Follow-up, Event, Person) zu Kennungen, die es wirklich gibt', async () => {
    const { berichtAus } = await import('@/lib/crm/netzwerken');
    await senden(mitTermin());
    await senden(erfassung({ schritt: 'vermitteln', vermitteln: { an: 'Peter' }, kontakt: { vorname: 'V', nachname: 'Vermittlung' } }));
    const c = await crm();
    const b = berichtAus({ event: c.events[0], teilnahmen: c.teilnahmen, kontakte: await kontakte(), followups: c.followups, heute: '2026-10-02' });
    const termin = b.zeilen.find(z => z.schritt === 'termin')!, deal = b.zeilen.find(z => z.schritt === 'vermitteln')!;
    expect(termin.links.map(l => l.id)).toEqual(['termin', 'event', 'kontakt']);
    expect(termin.links[0].href).toContain(encodeURIComponent(c.teilnahmen.find(t => t.netzwerken?.schritt === 'termin')!.netzwerken!.terminId!));
    expect(deal.links.map(l => l.id)).toEqual(['deal', 'event', 'kontakt']);
    expect(deal.links[0].href).toContain(c.chancen[0].id);
  });
});

describe('12 · Person der Erfassung', () => {
  it('Erfassung von Kevin, gesendet unter Malins Sitzung: 409 mit Hinweis, nichts geschrieben; unter Kevin: ok', async () => {
    const e = erfassung({ erfasstVon: 'kevin' });
    const fremd = await senden(e, 'malin');
    expect(fremd.status).toBe(409);
    expect(fremd.d).toMatchObject({ ok: false, andere: true, erfasstVon: 'kevin' });
    expect(fremd.d.fehler).toMatch(/Kevin Test/);
    expect(await kontakte()).toEqual([]);
    expect((await crm()).teilnahmen).toEqual([]);
    const richtig = await senden(e, 'kevin');
    expect(richtig.status).toBe(200);
    expect((await crm()).teilnahmen[0].netzwerken?.erfasstVon).toBe('kevin');
  });
  it('ohne erfasstVon (alte Erfassungen in der Warteschlange): keine Prüfung', async () => {
    expect((await senden(erfassung(), 'malin')).status).toBe(200);
  });
});

describe('13 · Termin: belegt oder außerhalb der Arbeitszeit', () => {
  const blocker = () => { server['Privat Malin']['blocker.ics'] = { ics: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:blocker\r\nDTSTAMP:20260901T100000Z\r\nDTSTART;TZID=Europe/Berlin:20261005T100000\r\nDTEND;TZID=Europe/Berlin:20261005T110000\r\nSUMMARY:Anderes\r\nEND:VEVENT\r\nEND:VCALENDAR', etag: 'b1' }; ctag++; };
  it('belegt → „… ist belegt …“, kein Wort von Arbeitszeit', async () => {
    blocker();
    const r = await senden(mitTermin());
    expect(r.status).toBe(200);
    const h = r.d.hinweise?.join(' ') ?? '';
    expect(h).toMatch(/belegt/);
    expect(h).not.toMatch(/Arbeitszeit/);
  });
  it('nachts → „außerhalb der Arbeitszeit“, nicht „belegt“; der Termin steht trotzdem', async () => {
    const r = await senden(mitTermin({ termin: { art: 'video', dauer: 45, start: '2026-10-05T21:00' } }));
    expect(r.status).toBe(200);
    const h = r.d.hinweise?.join(' ') ?? '';
    expect(h).toMatch(/außerhalb der Arbeitszeit/);
    expect(h).not.toMatch(/belegt/);
    expect(puts).toHaveLength(1);
  });
  it('frei in der Arbeitszeit: kein Hinweis', async () => {
    const r = await senden(mitTermin({ termin: { art: 'video', dauer: 45, start: '2026-10-05T14:00' } }));
    expect(r.d.hinweise ?? []).toEqual([]);
  });
  it('Feiertag (03.10. Tag der Einheit): Hinweis nennt den Feiertag', async () => {
    const r = await senden(mitTermin({ termin: { art: 'video', dauer: 45, start: '2026-10-03T10:00' } }));
    expect(r.d.hinweise?.join(' ')).toMatch(/Feiertag/);
  });
  it('Termin in der Vergangenheit: 400, nichts geschrieben', async () => {
    const r = await senden(mitTermin({ termin: { art: 'video', dauer: 45, start: '2026-10-02T07:00' } }));
    expect(r.status).toBe(400);
    expect(r.d.fehler).toMatch(/Vergangenheit/);
    expect(await kontakte()).toEqual([]);
  });
});
