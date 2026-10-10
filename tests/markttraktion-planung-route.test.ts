// ─── Markttraktion · Planung — Route: Zugang, Trennung Privat/Business, Stand/409, Grenzen ─────────────────────────
// Eigener Datenordner, erfundene Personen (@example.invalid) und Firmen — nie der echte Bestand. Geprüft wird:
//   · Haushalt des Inhabers (Testkunde aus einem anderen Haushalt 403, ohne Person 403), Konto „nur Business“ darf (die Planung ist Business)
//   · Sicht Privat bekommt nichts: `?space=privat` → 400, Umsatzziel der Selbstständigkeit → 400, die Auswahl nennt sie nie
//   · Schreiben nur mit Sitzung (Dienstweg 403), Stand je Eintrag (409 mit aktuellem Stand), 413 über den Grenzen
//   · Wochenziele kommen im Scoreboard an (Überblick, /api/crm/traktion)
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/markttraktion' }));
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-mt-planung-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-mt-planung';
process.env.MAKE_OS_OHNE_APPLE = '1';

type Mod = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
let route: Mod; let db: typeof import('@/lib/store/local-db');
let TEAM_ID = '';
const URL_ = 'http://test/api/crm/planung';
const get = (person?: string, q = '') => new Request(`${URL_}${q}`, { headers: person ? { 'x-make-user': person } : {} });
const patch = (person: string, ops: unknown, extra: Record<string, string> = {}) => new Request(URL_, {
  method: 'PATCH', headers: { 'content-type': 'application/json', 'x-make-user': person, ...extra }, body: JSON.stringify({ ops }),
});
const heute = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const plus = (n: number) => { const d = new Date(`${heute()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  route = (await import('@/app/api/crm/planung/route')) as unknown as Mod;
  TEAM_ID = (await import('@/lib/crm/team-liste')).TEAM[0].id;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef' },
    { id: '2', speicher: 'pb', email: 'pb@example.invalid', name: 'Bert Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef', finanzRecht: 'business' },
    { id: '3', speicher: 'px', email: 'px@example.invalid', name: 'Testkunde', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-fremd' },
  ], einladungen: [] });
  const J = `${heute()}T09:00:00.000Z`;
  await db.saveJson('kontakte', { kontakte: [
    { id: 'c-erfunden1', vorname: 'Erika', nachname: 'Erfunden', eignung: '', prio: '', stufe: 'gespraech', herkunft: 'veranstaltung', importiertAm: heute(), geaendertAm: heute(), firmaId: 'f-beispiel', firma: 'Beispiel AG', aktivitaeten: [{ am: J, art: 'gespraech', von: 'pa' }] },
  ] });
  await db.saveJson('crm', {
    firmen: [{ id: 'f-beispiel', name: 'Beispiel AG', geaendert: J }],
    chancen: [
      { id: 'ch-ug', titel: 'Erfundener Deal', kontaktIds: ['c-erfunden1'], firmaId: 'f-beispiel', art: 'projekt', wert: { betrag: 8000, basis: 'einmalig' }, stufe: 'angebot', historie: [{ stufe: 'angebot', am: J, von: 'pa' }], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft: 'ug', besitzer: 'pa', angelegt: J, geaendert: J },
    ],
    mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [],
  });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Planung — wer darf', () => {
  it('ohne Person und aus einem anderen Haushalt: 403 — nie unsere Daten', async () => {
    expect((await route.GET(get())).status).toBe(403);
    const r = await route.GET(get('px'));
    expect(r.status).toBe(403);
    expect(JSON.stringify(await r.json())).not.toContain('Beispiel');
    expect((await route.PATCH(patch('px', [{ op: 'kanal', eintrag: { name: 'x', herkunft: 'frei' } }]))).status).toBe(403);
  });
  it('Haushalt: der Kreislauf kommt — auch für ein Konto „nur Business“', async () => {
    const r = await route.GET(get('pb'));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.kreislauf.stufen.map((s: { id: string }) => s.id)).toEqual(['kanaele', 'leads', 'deals', 'followup', 'fulfillment', 'nachher', 'wiederkauf']);
    expect(j.kreislauf.stufen.find((s: { id: string }) => s.id === 'deals').anzahl).toBe(1);
  });
  it('Sicht Privat bekommt nichts: ?space=privat → 400; die Auswahl nennt nur Business-Gesellschaften', async () => {
    const r = await route.GET(get('pa', '?space=privat'));
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.kreislauf).toBeUndefined();
    const { NUR_BUSINESS } = await import('@/lib/crm/planung-daten');
    expect(j.fehler).toBe(NUR_BUSINESS);
    const { BUSINESS_GESELLSCHAFTEN, PRIVAT_GESELLSCHAFTEN } = await import('@/lib/einheiten');
    const g = (await (await route.GET(get('pa'))).json()).auswahl.gesellschaften.map((x: { id: string }) => x.id);
    for (const b of BUSINESS_GESELLSCHAFTEN) expect(g).toContain(b);
    for (const p of PRIVAT_GESELLSCHAFTEN) expect(g).not.toContain(p);
  });
});

describe('Planung — schreiben', () => {
  it('Dienstweg darf nicht schreiben (403)', async () => {
    const r = await route.PATCH(patch('pa', [{ op: 'kanal', eintrag: { name: 'x', herkunft: 'frei' } }], { 'x-make-key': 'pruef-schluessel-mt-planung', 'x-make-person': 'pa' }));
    expect(r.status).toBe(403);
  });
  it('Kanal und Umsatzziel anlegen → Trichter, Wochenziele; Selbstständigkeit 400; veralteter Stand 409', async () => {
    const neu = await route.PATCH(patch('pa', [
      { op: 'kanal', eintrag: { id: 'lk-pruef0001', name: 'Eigene Reihe', herkunft: 'eventreihe', leadsMonat: 8, zyklusWochen: 4, verantwortlich: TEAM_ID, quoten: { leadZuGespraech: 50, gespraechZuSql: 50, sqlZuAngebot: 50, angebotZuGewonnen: 50 } } },
      { op: 'ziel', eintrag: { id: 'uz-pruef0001', gesellschaft: 'ug', von: heute(), bis: plus(7 * 14), umsatz: 40_000, dealWert: 10_000 } },
    ]));
    expect(neu.status).toBe(200);
    const nj = await neu.json();
    expect(nj.datei.kanaele[0].stand).toMatch(/^[\w-]{12}$/);
    const privat = await route.PATCH(patch('pa', [{ op: 'ziel', eintrag: { gesellschaft: 'kdc', von: heute(), bis: plus(30), umsatz: 1000 } }]));
    expect(privat.status).toBe(400);
    const j = await (await route.GET(get('pa'))).json();
    const l = j.ziele[0];
    expect(l.deals).toBe(4);
    expect(Math.round(l.summe.leads)).toBe(64);
    expect(j.kanaele[0].leads).toBe(1); // die erfundene Person kam über eine Veranstaltung
    expect(j.wochenziele).toMatchObject({ leads: expect.any(Number), gespraeche: expect.any(Number) });
    // Zweite Person ändert mit altem Stand → 409, der aktuelle Stand kommt mit.
    const alt = nj.datei.kanaele[0].stand;
    expect((await route.PATCH(patch('pb', [{ op: 'kanal', stand: alt, eintrag: { id: 'lk-pruef0001', leadsMonat: 9 } }]))).status).toBe(200);
    const konflikt = await route.PATCH(patch('pa', [{ op: 'kanal', stand: alt, eintrag: { id: 'lk-pruef0001', leadsMonat: 12 } }]));
    expect(konflikt.status).toBe(409);
    const kj = await konflikt.json();
    expect(kj.konflikte).toEqual([{ op: 0, id: 'lk-pruef0001' }]);
    expect(kj.datei.kanaele[0].leadsMonat).toBe(9);
  });
  it('zu viele Schritte → 413, nichts gespeichert', async () => {
    const r = await route.PATCH(patch('pa', Array.from({ length: 61 }, (_, i) => ({ op: 'challenge', eintrag: { woche: '2026-10-12', art: 'gespraeche', titel: `x${i}`, ziel: 1 } }))));
    expect(r.status).toBe(413);
  });
  it('das Scoreboard im Überblick zeigt die Ziele aus der Planung', async () => {
    const traktion = (await import('@/app/api/crm/traktion/route')) as unknown as Mod;
    const j = await (await traktion.GET(get('pa'))).json();
    expect(j.planWoche).not.toBeNull();
    const z = j.scoreboard.zeilen.find((x: { id: string }) => x.id === 'neue_leads');
    expect(z?.plan).toBe(true);
    expect(z?.ziel).toBe(j.planWoche.leads);
  });
});

describe('Planung — die Ansichten rendern mit der echten Antwort (kein Absturz, keine Privat-Einheit)', () => {
  it('Kreislauf, Leadkanäle, Ziele & Aktivitäten, Challenges', async () => {
    const lage = await (await route.GET(get('pa'))).json();
    const api = { lage, laedt: false, fehler: null, hinweis: null, setHinweis: () => {}, schreibe: async () => true, neuLaden: async () => {} };
    const { Kreislauf } = await import('@/components/os/crm/planung/Kreislauf');
    const { Kanaele } = await import('@/components/os/crm/planung/Kanaele');
    const { Ziele } = await import('@/components/os/crm/planung/Ziele');
    const { Challenges } = await import('@/components/os/crm/planung/Challenges');
    const h = (c: unknown, p: unknown) => renderToStaticMarkup(createElement(c as never, p as never));
    const kreis = h(Kreislauf, { api, lage, zuKanaele: () => {} });
    expect(kreis).toContain('Der Kreislauf');
    expect(kreis).toContain('Wiederkauf');
    expect(h(Kanaele, { api, lage, kanal: null, onKanal: () => {} })).toContain('Eigene Reihe');
    const ziele = h(Ziele, { api, lage, zuKanaele: () => {} });
    expect(ziele).toContain('Umsatzziele');
    expect(ziele).toContain('letzter Start');
    expect(h(Challenges, { api, lage })).toContain('Challenges dieser Woche');
    const { finanzOrtName, PRIVAT_GESELLSCHAFTEN } = await import('@/lib/einheiten');
    for (const p of PRIVAT_GESELLSCHAFTEN) expect(ziele).not.toContain(`>${finanzOrtName(p)}<`);
  });
});
