// ─── Website-Anfrage von Ende zu Ende (31.10., Website-Anbau) ──────────────────────────────────────────────────────────────────────────
// In-process über die echten Routen (wie die Demo-Saat): Kontaktformular → Kontakt + Lead (Herkunft Website, Marketing-Lead) + Follow-up
// „Anfrage beantworten“ → Ereignis „neuer Lead“ mit Stufe `webseite-formular` → passt auf einen Prozess-Auslöser „Formular/Check von der Webseite“
// → Termin über die Buchungsseite (dieselbe Person, Freigabe) → Deal → Website-Zahlen im Traktions-Index. Dazu der Check-Abschluss (Stufe
// `webseite-check`). Eigener Datenordner, iCloud gemockt, erfundene Daten (@example.invalid), kein Netz.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { BuchungBestand } from '@/lib/kalender/buchung';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-website-e2e-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-website-e2e';
process.env.SESSION_SECRET = 'pruef-sitzung-website-e2e-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-website-e2e';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-website-e2e-0123456789abcdef';

// ── iCloud gemockt (wie tests/buchung-route.test.ts) ──
const ic = vi.hoisted(() => ({ termine: [] as { uid: string; id: string; titel: string; start: string; ende: string; ganztags: boolean; kalender: string; notiz?: string; art: string; beschaeftigt: boolean }[], angelegt: 0 }));
const stand = () => ({ at: new Date().toISOString(), kalender: [], objekte: {} });
vi.mock('@/lib/kalender/icloud', async () => ({
  CACHE: 'calendar-cache',
  SPEICHER: 'kalender-icloud',
  abgleichAlter: (await vi.importActual<typeof import('@/lib/kalender/icloud')>('@/lib/kalender/icloud')).abgleichAlter,
  holfenster: () => ({ von: '2026-07-01', bis: '2027-11-01' }),
  objekteKurz: () => ic.termine.map(t => ({ uid: t.uid, schluessel: t.id, tag: t.start.slice(0, 10), zusatz: null })),
  verbunden: () => true,
  ladeStand: async () => stand(),
  frischerStand: async () => stand(),
  abgleichen: async () => stand(),
  termineImZeitraum: (_s: unknown, von: string, bis: string) => ic.termine.filter(t => t.start.slice(0, 10) < bis && t.ende.slice(0, 10) >= von).map(t => ({ ...t, href: '', kalenderId: '', serie: false, mitTeilnehmern: false, bearbeitbar: true })),
  anlegen: async (e: { titel: string; kalender: string; start: string; ende: string; notiz?: string; art?: string; beschaeftigt?: boolean }) => {
    ic.angelegt++;
    const uid = `UID-WEB-${ic.angelegt}`, schluessel = `testkal|${uid}`;
    ic.termine.push({ uid, id: schluessel, titel: e.titel, start: e.start, ende: e.ende, ganztags: false, kalender: e.kalender, notiz: e.notiz, art: e.art ?? 'termin', beschaeftigt: e.beschaeftigt ?? true });
    return { uid, schluessel, kalender: e.kalender, gaeste: 0 };
  },
}));

type Ctx = { params: Promise<{ slug: string }> };
type R = { GET?: (r: Request, c?: Ctx) => Promise<Response>; POST?: (r: Request, c?: Ctx) => Promise<Response> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Antwort = { status: number; d: Record<string, any> };
let db: typeof import('@/lib/store/local-db');
let drossel: typeof import('@/lib/zugang/drossel');
let anfrage: R, intern: R, verwaltung: R, buchungOffen: R, buchungStatus: R, deal: R, traktion: R;
let SLUG = '';
const HAUS = 'test-haus';
const D = 'example.invalid';
const sitzung = (wer = 'kevin') => ({ 'content-type': 'application/json', 'x-make-user': wer });
const json = async (r: Response): Promise<Antwort> => ({ status: r.status, d: await r.json() });
const ctx = (slug: string): Ctx => ({ params: Promise.resolve({ slug }) });
const kontakte = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
const T0 = new Date('2026-11-02T07:00:00Z'); // Mo 08:00 Berlin
let uhr = T0.getTime();
const weiter = (sek: number) => { uhr += sek * 1000; vi.setSystemTime(new Date(uhr)); };

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  db = await import('@/lib/store/local-db');
  drossel = await import('@/lib/zugang/drossel');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: `k@${D}`, name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    { id: 'k2', speicher: 'malin', email: `m@${D}`, name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
  ], einladungen: [] });
  await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Testkalender', malin: 'Malin-Kalender', beide: 'Gemeinsam' } });
  anfrage = await import('@/app/api/anfrage/route') as R;
  intern = await import('@/app/api/kontaktformular/intern/route') as R;
  verwaltung = await import('@/app/api/kalender/buchung/route') as R;
  buchungOffen = await import('@/app/api/buchung/[slug]/route') as R;
  buchungStatus = await import('@/app/api/buchung/[slug]/status/route') as R;
  deal = await import('@/app/api/crm/deal/route') as R;
  traktion = await import('@/app/api/crm/traktion/route') as R;
  // Buchungsseite fürs Erstgespräch (wie im Kalender angelegt) — die Website teilt sich die Angaben der Checks (Verantwortlicher als Abweichung).
  const s = await json(await verwaltung.POST!(new Request('http://test/api/kalender/buchung', { method: 'POST', headers: sitzung(), body: JSON.stringify({ aktion: 'seite', seite: { titel: 'Erstgespräch', person: 'kevin', dauerMin: 30, fenster: [{ tage: [1, 2, 3, 4, 5, 6, 7], von: '09:00', bis: '12:00' }], tageVoraus: 7, vorlaufMin: 0, maxJeTag: 10, pufferMin: 0, rasterMin: 30, zielKalender: 'Testkalender', ort: 'Videoraum folgt', verantwortlich: `Probe GmbH, datenschutz@${D}` } }) })));
  expect(s.status).toBe(200);
  SLUG = s.d.seite.slug;
  await db.saveJson('check-einstellungen', { aktiv: false, buchungSlug: SLUG, gastgeber: 'kevin', marke: 'Probe Marke', verantwortlich: `Probe GmbH, datenschutz@${D}` });
});
afterEach(() => drossel._zuruecksetzen());
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

let kontaktId = '';

describe('Website-Anfrage: Kontaktformular → Lead → Prozess → Termin → Deal → Traktions-Index', () => {
  it('Kontaktformular kommt AUS; einschalten Inhaber und volle Mitglieder (`darfSteuern`, 02.11.)', async () => {
    const { kontaktformularStempel } = await import('@/lib/kontaktformular/server');
    const aus = await anfrage.POST!(new Request('http://test/api/anfrage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vorname: 'X', email: `x@${D}`, nachricht: 'Hallo dort', stempel: kontaktformularStempel(uhr - 5000) }) }));
    expect(aus.status).toBe(404);
    // Eine Sitzung ohne Konto im Haushalt nie; ein volles Mitglied (Malin) darf (Kevin 02.11.) — hier zuerst „aus“, damit der Rest so beginnt wie vorher.
    expect((await json(await intern.POST!(new Request('http://test/api/kontaktformular/intern', { method: 'POST', headers: sitzung('fremd'), body: JSON.stringify({ aktiv: true }) })))).status).toBe(403);
    expect((await json(await intern.POST!(new Request('http://test/api/kontaktformular/intern', { method: 'POST', headers: sitzung('malin'), body: JSON.stringify({ aktiv: false }) })))).status).toBe(200);
    const an = await json(await intern.POST!(new Request('http://test/api/kontaktformular/intern', { method: 'POST', headers: sitzung(), body: JSON.stringify({ aktiv: true }) })));
    expect(an).toMatchObject({ status: 200, d: { aktiv: true } });
  });

  it('Nachricht → neue Person mit Herkunft Website, Marketing-Lead, Einwilligung nur „Anfrage“, Follow-up „Anfrage beantworten“', async () => {
    const { kontaktformularStempel } = await import('@/lib/kontaktformular/server');
    const stempel = kontaktformularStempel(uhr);
    weiter(8);
    const r = await json(await anfrage.POST!(new Request('http://test/api/anfrage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vorname: 'Wera', nachname: 'Webgast', firma: 'Webprobe GmbH', email: `wera.webgast@${D}`, nachricht: 'Wir möchten über KI im Vertrieb sprechen.', stempel, webseite: '' }) })));
    expect(r.status).toBe(200);
    expect(r.d.ok).toBe(true);
    const k = (await kontakte()).find(x => x.email === `wera.webgast@${D}`)!;
    expect(k).toBeTruthy();
    kontaktId = k.id;
    expect(k.quelle).toBe('Anfrage über Website');
    expect(k.aktivitaeten.some(a => (a.text ?? '').startsWith('Anfrage über Website: Kontaktformular — Wir möchten'))).toBe(true);
    // Keine Werbe-Einwilligung: nur „Antwort auf Anfrage“.
    expect((k.einwilligungen ?? []).every(e => e.grundlage === 'anfrage')).toBe(true);
    expect((k.einwilligungen ?? []).some(e => e.kanal === 'newsletter')).toBe(false);
    const { istMarketingLead } = await import('@/lib/crm/scoring');
    expect(istMarketingLead([k])).toBe(true);
    const { anfrageKanal } = await import('@/lib/prozesse/kundengewinnung/fall-felder-server');
    expect(await anfrageKanal([k])).toBe('website');
    const crm = await (await import('@/lib/crm/speicher')).ladeCrm();
    const fu = (crm.followups ?? []).find(f => f.kontaktId === k.id && f.status === 'offen');
    expect(fu?.text).toMatch(/Anfrage beantworten/);
    // Lead an der (neuen) Firma bzw. Person: in Bearbeitung (nicht „neu“), Firma über den einen Weg gesichert.
    const lead = k.firmaId ? crm.firmen.find(f => f.id === k.firmaId)?.lead : k.lead;
    expect(lead?.status).toBe('kontaktiert');
  });

  it('Ereignis „neuer Lead“ mit Stufe webseite-formular — ein Auslöser „Formular/Check von der Webseite“ startet', async () => {
    const { ereignisseLaden } = await import('@/lib/ereignisse/server');
    const e = (await ereignisseLaden(HAUS)).eintraege.find(x => x.art === 'neuer-lead' && x.bezug.kontaktId === kontaktId)!;
    expect(e).toMatchObject({ quelle: 'anfrage', stufe: 'webseite-formular', bereich: 'business' });
    const { ausloeserPasst, ereignisDaten } = await import('@/lib/prozesse/ausloeser');
    const webseite = { art: 'ereignis' as const, ereignis: 'neuer-lead' as const, bedingungen: [{ feld: 'ereignis.stufe', op: 'beginnt' as const, wert: 'webseite' }] };
    expect(ausloeserPasst(webseite, 'p-web', e, ereignisDaten(e))).toBe(true);
    // Eine Anfrage von Hand (Kanal Mail) trägt keine Website-Stufe — derselbe Auslöser startet dort nicht.
    const ohne = { ...e, stufe: undefined };
    expect(ausloeserPasst(webseite, 'p-web', ohne, ereignisDaten(ohne))).toBe(false);
  });

  it('Termin über die Buchungsseite: dieselbe Person, Aktivität „Terminbuchung“, Follow-up „Termin vorbereiten“', async () => {
    const seite = await json(await buchungOffen.GET!(new Request(`http://test/api/buchung/${SLUG}`), ctx(SLUG)));
    expect(seite.status).toBe(200);
    weiter(6);
    const b = await json(await buchungOffen.POST!(new Request(`http://test/api/buchung/${SLUG}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ start: '2026-11-02T11:00:00', name: 'Wera Webgast', email: `wera.webgast@${D}`, firma: 'Webprobe GmbH', anliegen: 'Erstgespräch', einwilligung: true, stempel: seite.d.stempel, webseite: '' }) }), ctx(SLUG)));
    expect(b.status).toBe(201);
    const st = await json(await buchungStatus.POST!(new Request(`http://test/api/buchung/${SLUG}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: b.d.token, aktion: 'bestaetigen' }) }), ctx(SLUG)));
    expect(st.d.sicht.status).toBe('angefragt');
    const id = (await db.loadJson<BuchungBestand>(`buchung--${HAUS}`))!.buchungen[0].id;
    const f = await json(await verwaltung.POST!(new Request('http://test/api/kalender/buchung', { method: 'POST', headers: sitzung(), body: JSON.stringify({ aktion: 'freigeben', id }) })));
    expect(f.status).toBe(200);
    const bu = (await db.loadJson<BuchungBestand>(`buchung--${HAUS}`))!.buchungen[0];
    expect(bu.kontaktId).toBe(kontaktId); // keine zweite Person
    const k = (await kontakte()).find(x => x.id === kontaktId)!;
    expect(k.aktivitaeten.some(a => (a.text ?? '').startsWith('Anfrage über Website: Terminbuchung'))).toBe(true);
    const crm = await (await import('@/lib/crm/speicher')).ladeCrm();
    expect((crm.followups ?? []).some(x => x.id === bu.vorbereitenId && /Termin vorbereiten/.test(x.text))).toBe(true);
  });

  it('Deal aus der Anfrage: Quelle Anfrage; ohne beantwortete Kernfragen „direkt angelegt“ — der Lead steht in Qualifizierung', async () => {
    const k = (await kontakte()).find(x => x.id === kontaktId)!;
    const r = await json(await deal.POST!(new Request('http://test/api/crm/deal', { method: 'POST', headers: sitzung(), body: JSON.stringify({ aktion: 'anlegen', kontaktIds: [kontaktId], ...(k.firmaId ? { firmaId: k.firmaId } : {}), quelle: 'inbound', schritt: { text: 'Angebot nach dem Erstgespräch', datum: '2026-11-05' } }) })));
    expect(r.status).toBe(200);
    const crm = await (await import('@/lib/crm/speicher')).ladeCrm();
    const c = crm.chancen.find(x => x.kontaktIds.includes(kontaktId))!;
    expect(c).toMatchObject({ quelle: 'inbound' });
    const lead = k.firmaId ? crm.firmen.find(f => f.id === k.firmaId)?.lead : (await kontakte()).find(x => x.id === kontaktId)?.lead;
    // Kernfragen (Schmerz, Entscheider, Budget/Zeitpunkt) sind nach einer Website-Anfrage noch offen — der Deal sagt, was bis zum SQL fehlt.
    expect(r.d.text).toMatch(/noch kein SQL/);
    expect(lead?.status).toBe('qualifizierung');
  });

  it('Check-Abschluss geht denselben Weg mit Stufe webseite-check', async () => {
    const { leadAnlegen } = await import('@/lib/check/server');
    const { ladeCheckEinstellungen } = await import('@/lib/check/speicher');
    const s = { id: 'ck-probe-0001', vorlage: 'innovation', antworten: {}, uebersprungen: [], kontaktStand: 'erfasst', gestartet: new Date(uhr).toISOString(), geaendert: new Date(uhr).toISOString(), tokenHash: 'x'.repeat(64),
      kontakt: { vorname: 'Chris', firma: 'Checkprobe GmbH', email: `chris.check@${D}`, newsletterWunsch: false, hinweisFassung: 'v1', am: new Date(uhr).toISOString() } } as unknown as Parameters<typeof leadAnlegen>[0];
    const r = await leadAnlegen(s, await ladeCheckEinstellungen(), 'Innovations-Check auf der Website: Kurzcheck ausgefüllt.');
    expect(r?.status).toBe('ok');
    const { ereignisseLaden } = await import('@/lib/ereignisse/server');
    expect((await ereignisseLaden(HAUS)).eintraege.some(x => x.art === 'neuer-lead' && x.bezug.kontaktId === r?.kontaktId && x.stufe === 'webseite-check')).toBe(true);
  });

  it('Traktions-Index › Marketing zeigt die Website-Zahlen (Anfragen, Termine) mit Links', async () => {
    const r = await json(await traktion.GET!(new Request('http://test/api/crm/traktion', { headers: sitzung() })));
    expect(r.status).toBe(200);
    const kz = (r.d.index.saeulen as { id: string; kennzahlen: { id: string; wert: number | null; details: { href: string }[] }[] }[]).flatMap(s => s.kennzahlen);
    const web = (id: string) => kz.find(k => k.id === id)!;
    expect(web('web_anfragen').wert).toBe(2); // Kontaktformular + Check (je Person und Tag einmal)
    expect(web('web_termine').wert).toBe(1);
    expect(web('web_checks').wert).toBe(0);
    expect(web('web_anfragen').details.every(d => d.href.startsWith('/os/'))).toBe(true);
  });
});
