// ─── Agenten-Nachschliff (09.10.) — Kette Kalender-Block: ZOE schlägt `plan_block` vor → Stapel → Freigabe → `blockAnlegen` → Termin ───────
// Kevin: „Das muss perfekt laufen. Denke immer einen Schritt weiter.“ Geprüft wird die ganze Kette über die echten Routen (ZOE-Gespräch, Stapel)
// gegen einen nachgebauten iCloud-CalDAV-Server (tests/fixtures/icloud-fake.ts) und einen nachgebauten Google (tests/fixtures/google-fake.ts):
//   · ZOE legt den Block NUR in den Stapel (kein Schreiben in iCloud), die andere Person sieht den Vorschlag nicht
//   · Freigabe per Klick → genau EIN Termin im Kalender der Person (Art „fokus“, beschäftigt) + `kalender-bezug` mit `von`
//   · Doppelklick → ein Termin; Kollision mit festem Termin → klarer Satz, nichts angelegt, Vorschlag „fehlgeschlagen“
//   · Business-freie Zeit → klarer Satz, nichts angelegt — und der Vorschlag gilt NICHT als „freigegeben“
//   · Google ist für Business verbunden: Blöcke bleiben trotzdem im iCloud-Kalender der Person (Regel: Blöcke/Fokus/Plan = iCloud)
// Das Kalendermodell kennt feste Plätze je Person (Plattform-Schuld, UPDATES.md) — deshalb hier Speichernamen mit Platz; alles erfunden (@example.invalid).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { rmSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { IcloudFake, einfachIcs } from './fixtures/icloud-fake';
import { GoogleFake } from './fixtures/google-fake';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-nachschliff-kalender-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-nachschliff-kalender', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.MAKE_OS_KI_ANBIETER_TOR;
  delete process.env.MAKE_OS_KI_BUDGET_MONAT_EURO;
  delete process.env.MAKE_OS_INTERN;
  return o;
});
vi.mock('@/lib/brain', async orig => {
  const o = await orig<typeof import('@/lib/brain')>();
  return { ...o, gatherBrain: vi.fn(async () => ({})), promptBrain: () => '' };
});
vi.mock('@/lib/zoe/vault', async orig => ({ ...(await orig<typeof import('@/lib/zoe/vault')>()), brainAnweisung: async () => '' }));

import { rufe, sitzung, text, werkzeug } from './fixtures/agenten-kern';
import { kiFake, type KiFake } from './fixtures/ki-fake';

type H = (r: Request) => Promise<Response>;
let kimmi: { POST: H };
let stapelRoute: { GET: H; POST: H };
let db: typeof import('@/lib/store/local-db');
let I: typeof import('@/lib/kalender/icloud');
let ki: KiFake;
let ic: IcloudFake;
let g: GoogleFake;
let altFetch: typeof fetch;

const konto = (id: string, speicher: string, rolle: string) => ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher[0].toUpperCase()}${speicher.slice(1)} Beispiel`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' });
let TAG = '', TAG_FREI = '';
const puts = () => ic.aufrufe.filter(a => a.methode === 'PUT');
const objekte = (kal: string) => Object.values(ic.kalender[kal].objekte).map(o => o.ics);

async function vorschlagVonZoe(person: string, eingabe: Record<string, unknown>): Promise<{ id: string; werkzeug: string; status: string }> {
  ki.folge.push(werkzeug(['plan_block', eingabe]), text('Der Block liegt zur Freigabe bereit.'));
  const r = await rufe(kimmi.POST, '/api/kimmi', sitzung(person), { message: 'Plane mir bitte einen Fokus-Block im Kalender ein.', zoeFaden: 'neu' });
  expect(r.status, JSON.stringify(r.d)).toBe(200);
  const s = await rufe(stapelRoute.GET, '/api/zoe/stapel', sitzung(person));
  const v = (s.d.vorschlaege as { id: string; werkzeug: string; status: string; eingabe: Record<string, unknown> }[]).filter(x => x.werkzeug === 'plan_block' && x.eingabe.titel === eingabe.titel);
  expect(v).toHaveLength(1);
  return v[0];
}
const freigeben = (person: string, id: string) => rufe(stapelRoute.POST, '/api/zoe/stapel', sitzung(person), { id, entscheidung: 'freigeben' });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  I = await import('@/lib/kalender/icloud');
  kimmi = (await import('@/app/api/kimmi/route')) as unknown as typeof kimmi;
  stapelRoute = (await import('@/app/api/zoe/stapel/route')) as unknown as typeof stapelRoute;
  const { localDay, tagePlus } = await import('@/lib/zeit');
  const heute = localDay();
  TAG = tagePlus(heute, 2);
  TAG_FREI = tagePlus(heute, 4);
  ki = kiFake();
  const kiFetch = globalThis.fetch;
  altFetch = kiFetch;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (/icloud\.com/.test(u)) return (await ic.handle(u, init ?? {}))!;
    if (/googleapis\.com|accounts\.google\.com|oauth2\.googleapis/.test(u)) return g.handle(u, init ?? {});
    return kiFetch(url as string, init);
  }) as typeof fetch;
});
afterAll(async () => { await new Promise(r => setTimeout(r, 300)); globalThis.fetch = altFetch; ki.zurueck(); vi.unstubAllEnvs(); rmSync(ordner, { recursive: true, force: true }); });

beforeEach(async () => {
  ki.folge.length = 0; ki.anfragen.length = 0;
  (await import('@/lib/anthropic'))._guthabenSetzen(0);
  (await import('@/lib/zugang/modell-drossel')).modellDrosselZuruecksetzen();
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  ic = new IcloudFake({ adresse: 'kevin@example.invalid' }).add('privat-kevin', 'Privat Kevin').add('privat-malin', 'Privat Malin').add('gemeinsam', 'Gemeinsam');
  g = new GoogleFake();
  vi.stubEnv('ICLOUD_APPLE_ID', 'kevin@example.invalid'); vi.stubEnv('ICLOUD_APP_PASSWORT', 'abcd-efgh-ijkl-mnop'); vi.stubEnv('ICLOUD_PERSON', '');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
  await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Privat Kevin', malin: 'Privat Malin', beide: 'Gemeinsam' } });
  await I.abgleichen({ erzwingen: true });
});

describe('Kette Kalender-Block: ZOE → Stapel → Freigabe → Termin', () => {
  it('ZOE legt nur in den Stapel; erst der Klick legt genau EINEN Termin im Kalender der Person an (Art fokus, beschäftigt, Bezug mit `von`)', async () => {
    const v = await vorschlagVonZoe('kevin', { date: TAG, startMin: 600, dauerMin: 60, titel: 'Fokus Angebot', art: 'fokus' });
    expect(v.status).toBe('offen');
    expect(puts()).toHaveLength(0);
    // Die andere Person sieht den Vorschlag nicht und kann ihn nicht freigeben.
    const fremd = await rufe(stapelRoute.GET, '/api/zoe/stapel', sitzung('malin'));
    expect((fremd.d.vorschlaege as { id: string }[]).some(x => x.id === v.id)).toBe(false);
    expect((await freigeben('malin', v.id)).status).toBe(404);
    const r = await freigeben('kevin', v.id);
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    expect(String(r.d.ergebnis)).toMatch(/^Eingeplant/);
    expect(puts()).toHaveLength(1);
    const ics = objekte('privat-kevin').find(x => x.includes('Fokus Angebot'))!;
    expect(ics).toBeDefined();
    expect(ics).toContain('X-MAKE-ART:fokus');
    expect(ics).toContain('TRANSP:OPAQUE');
    expect(ics).toContain(`DTSTART;TZID=Europe/Berlin:${TAG.replace(/-/g, '')}T100000`);
    const bezug = (await db.loadJson<{ bezuege: Record<string, { von?: string; art?: string }> }>('kalender-bezug'))!.bezuege;
    expect(Object.values(bezug).some(b => b.von === 'kevin' && b.art === 'fokus')).toBe(true);
    expect((r.d.vorschlag as { status: string }).status).toBe('freigegeben');
  });

  it('Doppelklick (zwei Freigaben gleichzeitig) → ein Termin', async () => {
    const v = await vorschlagVonZoe('kevin', { date: TAG, startMin: 780, dauerMin: 30, titel: 'Fokus Doppelklick', art: 'fokus' });
    const [a, b] = await Promise.all([freigeben('kevin', v.id), freigeben('kevin', v.id)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(puts()).toHaveLength(1);
    expect(objekte('privat-kevin').filter(x => x.includes('Fokus Doppelklick'))).toHaveLength(1);
  });

  it('Kollision mit einem festen Termin → klarer Satz, nichts angelegt, Vorschlag „fehlgeschlagen“', async () => {
    ic.setze('privat-kevin', 'fest.ics', einfachIcs('FEST-1', 'Beratung Beispiel GmbH', TAG, '090000', '110000'));
    await I.abgleichen({ erzwingen: true });
    const vorher = puts().length;
    const v = await vorschlagVonZoe('kevin', { date: TAG, startMin: 600, dauerMin: 60, titel: 'Fokus Kollision', art: 'fokus' });
    const r = await freigeben('kevin', v.id);
    expect(r.d.ok).toBe(false);
    expect(String(r.d.ergebnis)).toMatch(/^Kollision mit festem Termin/);
    expect(puts().length).toBe(vorher);
    expect((r.d.vorschlag as { status: string }).status).toBe('fehlgeschlagen');
  });

  it('Business-freie Zeit → klarer Satz, nichts angelegt — und der Vorschlag gilt NICHT als „freigegeben“', async () => {
    const wochentag = new Date(`${TAG_FREI}T12:00:00Z`).getUTCDay();
    await db.saveJson('arbeitsrahmen--kevin', { businessFrei: [{ tage: [wochentag], von: '06:00', bis: '23:59' }] });
    db.leseCacheLeeren();
    const v = await vorschlagVonZoe('kevin', { date: TAG_FREI, startMin: 600, dauerMin: 60, titel: 'Fokus Freizeit', art: 'fokus' });
    const r = await freigeben('kevin', v.id);
    expect(String(r.d.ergebnis)).toMatch(/Business-freien Zeit/);
    expect(puts()).toHaveLength(0);
    expect(r.d.ok).toBe(false);
    expect((r.d.vorschlag as { status: string }).status).toBe('fehlgeschlagen');
  });

  it('Google für Business verbunden: der Block bleibt im iCloud-Kalender der Person (Regel Blöcke = iCloud)', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id-test'); vi.stubEnv('GOOGLE_CLIENT_SECRET', 'geheim'); vi.stubEnv('GOOGLE_ERLAUBTE_DOMAIN', 'makeinnovation.test');
    vi.stubEnv('MAKE_OS_ADRESSE', 'https://app.makeinnovation.test');
    const V = await import('@/lib/google/verbindung');
    const A = await import('@/lib/kalender/google/abgleich');
    const email = 'kevin@makeinnovation.test';
    g.konto = { ...g.konto, email }; g.kalenderId = email;
    g.kalenderListe = [{ id: email, summary: email, primary: true, accessRole: 'owner', backgroundColor: '#9fe1e7', timeZone: 'Europe/Berlin' }];
    const { url } = await V.verbindungStarten('kevin', ['kalender']);
    await V.verbindungAbschliessen('kevin', 'code-ok', new URL(url).searchParams.get('state')!);
    await A.googleAbgleichen('kevin');
    expect((await (await import('@/lib/kalender/google/ziel')).kalenderZiel('kevin', 'business')).quelle).toBe('google');
    const v = await vorschlagVonZoe('kevin', { date: TAG, startMin: 900, dauerMin: 60, titel: 'Fokus Google', art: 'fokus' });
    const r = await freigeben('kevin', v.id);
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    expect(objekte('privat-kevin').some(x => x.includes('Fokus Google'))).toBe(true);
    expect(g.events.size).toBe(0);
  });
});
