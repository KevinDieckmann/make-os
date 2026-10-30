// ─── Check × Newsletter (30.10.): das Häkchen im Check läuft in dieselbe Anmeldung wie /newsletter ─────────────────────
// Eigener Datenordner, Konten mit Test-Haushalt, Verantwortlicher der Einrichtung, Absender-Prüfung und Sendeweg gemockt (es geht nichts
// hinaus). Alle Namen und Adressen erfunden (@example.invalid). Prüft: Häkchen nur mit der gezeigten Fassung (sonst 409, nichts
// gespeichert), mit ihr eine wartende Anmeldung + EINE Bestätigungsmail (Double-Opt-in), ohne Häkchen keine Anmeldung, ist die
// Anmeldung aus, nimmt der Check kein Häkchen an.

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AnmeldungenBestand } from '@/lib/newsletter/regeln';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-check-nl-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-check-nl';
process.env.SESSION_SECRET = 'pruef-sitzung-check-nl-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-check-nl-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-check-nl-nur-im-test-0123456789abcdef';

const ds = vi.hoisted(() => ({ wert: { verantwortlich: null as string | null, seite: null as string | null } }));
vi.mock('@/lib/datenschutz/einrichtung-server', async () => ({
  ...(await vi.importActual<typeof import('@/lib/datenschutz/einrichtung-server')>('@/lib/datenschutz/einrichtung-server')),
  datenschutzOeffentlichLaden: async () => ds.wert,
}));
const fake = vi.hoisted(() => ({ gesendet: [] as { an: string; betreff?: string }[] }));
vi.mock('@/lib/crm/angebot-versand', () => ({
  absenderPruefen: async (a?: { postfach: string }) => (a?.postfach === 'pf-probe' ? { ok: true, adresse: 'versand@example.invalid' } : { ok: false, grund: 'Absender-Postfach fehlt.' }),
}));
vi.mock('@/lib/inbox/senden-server', () => ({
  inboxSenden: async (_person: string, b: { neu?: { betreff?: string }; an?: { email: string }[] }) => {
    fake.gesendet.push({ an: b.an?.[0]?.email ?? '', betreff: b.neu?.betreff });
    return { status: 200, body: { ok: true, von: 'versand@example.invalid' } };
  },
}));

type Antwort = { status: number; d: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
let db: typeof import('@/lib/store/local-db');
let drossel: typeof import('@/lib/zugang/drossel');
let NL: typeof import('@/lib/newsletter/server');
let check: { POST: (r: Request) => Promise<Response> };
let checkIntern: { POST: (r: Request) => Promise<Response> };
let nlIntern: { POST: (r: Request) => Promise<Response> };
const HAUS = 'test-haus';
const sitzung = { 'content-type': 'application/json', 'x-make-user': 'kevin' };
const post = async (r: { POST: (r: Request) => Promise<Response> }, url: string, body: Record<string, unknown>, k: Record<string, string> = { 'content-type': 'application/json' }): Promise<Antwort> => {
  const x = await r.POST(new Request(`http://test${url}`, { method: 'POST', headers: k, body: JSON.stringify(body) }));
  return { status: x.status, d: await x.json() };
};
const anmeldungen = async () => ((await db.loadJson<AnmeldungenBestand>('newsletter-anmeldungen')) ?? { anmeldungen: [] }).anmeldungen;

/** Die 17 Kurzcheck-Antworten wie in tests/check-route.test.ts. */
const KURZ: [string, Record<string, unknown>][] = [
  ['A1', { optionIds: ['A1_0'], zusatz: false }], ['A2', { optionIds: ['A2_2'] }], ['A6', { optionIds: ['A6_1'] }],
  ['S1', { optionIds: ['S1_2'] }], ['S2', { optionIds: ['S2_2'] }], ['S3', { optionIds: ['S3_2'] }],
  ['V1', { optionIds: ['V1_1'] }], ['V2', { optionIds: ['V2_1'] }], ['V3', { optionIds: ['V3_1'] }],
  ['B1', { optionIds: ['B1_1'] }], ['C1', { optionIds: ['C1_1'] }], ['C2', { optionIds: ['C2_1'] }],
  ['C5', { freitext: 'Wir probieren ein KI-Werkzeug für Angebotstexte aus.' }], ['D1', { optionIds: ['D1_1'] }],
  ['D7', { optionIds: ['D7_1'] }], ['E1', { optionIds: ['E1_1'] }], ['E4', { optionIds: ['E4_2'] }],
];
let uhr = new Date('2026-11-09T08:00:00Z').getTime();
const weiter = (sek: number) => { uhr += sek * 1000; vi.setSystemTime(new Date(uhr)); };

/** Eine Sitzung bis zur Kontakt-Frage. */
async function bisKontakt(): Promise<{ sitzung: string; token: string }> {
  const s = await post(check, '/api/check', { aktion: 'start', webseite: '' });
  expect(s.status).toBe(201);
  for (const [frage, a] of KURZ) expect((await post(check, '/api/check', { aktion: 'antwort', sitzung: s.d.sitzung, token: s.d.token, frage, ...a })).status, frage).toBe(200);
  weiter(60);
  return { sitzung: s.d.sitzung, token: s.d.token };
}
const kontakt = (x: { sitzung: string; token: string }, email: string, extra: Record<string, unknown>) =>
  post(check, '/api/check', { aktion: 'kontakt', ...x, vorname: 'Testa', email, firma: 'Probe Handwerk GmbH', rolle: 'A5_0', webseite: '', ...extra });

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(uhr));
  db = await import('@/lib/store/local-db');
  drossel = await import('@/lib/zugang/drossel');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@example.invalid', name: 'Testo Inhaber', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
  ], einladungen: [] });
  NL = await import('@/lib/newsletter/server');
  check = await import('@/app/api/check/route');
  checkIntern = await import('@/app/api/check/intern/route');
  nlIntern = await import('@/app/api/newsletter/intern/route');
  ds.wert = { verantwortlich: 'Probe GmbH, datenschutz@example.invalid', seite: 'example.invalid/datenschutz' };
  expect((await post(checkIntern, '/api/check/intern', { aktion: 'einstellungen', aktiv: true }, sitzung)).status).toBe(200);
});
afterEach(() => drossel._zuruecksetzen());
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

describe('Check × Newsletter', () => {
  it('ist die Anmeldung aus, nimmt der Check kein Häkchen an (409, nichts gespeichert)', async () => {
    const x = await bisKontakt();
    const r = await kontakt(x, 'aus.probe@example.invalid', { newsletter: true, newsletterFassung: 'nl-1' });
    expect(r.status).toBe(409);
    expect(await anmeldungen()).toEqual([]);
    expect((await kontakt(x, 'aus.probe@example.invalid', {})).status).toBe(200);
  });

  it('läuft sie: nur mit der gezeigten Fassung, dann eine wartende Anmeldung und EINE Bestätigungsmail', async () => {
    expect((await post(nlIntern, '/api/newsletter/intern', { aktion: 'einstellungen', absender: 'pf-probe', website: 'https://www.example.invalid/' }, sitzung)).status).toBe(200);
    expect((await post(nlIntern, '/api/newsletter/intern', { aktion: 'einstellungen', aktiv: true }, sitzung)).status).toBe(200);
    const bereit = await NL.newsletterBereit();
    expect(bereit).not.toBeNull();
    const x = await bisKontakt();
    expect((await kontakt(x, 'nl.probe@example.invalid', { newsletter: true, newsletterFassung: 'nl-999' })).status).toBe(409);
    expect(await anmeldungen()).toEqual([]);
    const r = await kontakt(x, 'NL.Probe@Example.invalid', { newsletter: true, newsletterFassung: bereit!.fassung });
    expect(r.status).toBe(200);
    await NL._nachlauf();
    const liste = await anmeldungen();
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ email: 'nl.probe@example.invalid', vorname: 'Testa', fassung: bereit!.fassung, wortlaut: bereit!.wortlaut });
    expect(liste[0].bestaetigt).toBeUndefined();
    expect(fake.gesendet.map(m => m.an)).toEqual(['nl.probe@example.invalid']);
  });

  it('ohne Häkchen keine Anmeldung', async () => {
    const x = await bisKontakt();
    expect((await kontakt(x, 'ohne.probe@example.invalid', { newsletter: false })).status).toBe(200);
    await NL._nachlauf();
    expect((await anmeldungen()).map(a => a.email)).toEqual(['nl.probe@example.invalid']);
    expect(fake.gesendet).toHaveLength(1);
  });
});
