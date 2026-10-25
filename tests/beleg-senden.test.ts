// ─── „Über <Postfach> senden (mit PDF)“ — Angebot und Rechnung per Klick aus der Inbox (25.10.2026) ──────────────────────────────────────
// Nachgebautes Postfach (PostSpeicher), eigener Datenordner, erfundene Daten. Geprüft: Anhang = GENAU das PDF dieses Belegs (fremde Datei-Kennung
// → abgelehnt, nichts gesendet), danach „versendet am … über …“ am Angebot bzw. an der Rechnung (Rechnung auch mit `rechnungsPdf`-Bezug als Anhang),
// beim Angebot zusätzlich die Mail-Aktivität am Kontakt. Gesendet wird nur per Sitzung (die Route bleibt Einzelklick).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { PostSpeicher as PS } from '@/lib/postfach/post-speicher';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-beleg-senden-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-beleg-senden';
process.env.MAKE_OS_KEY = 'dienst-test-beleg-senden';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-beleg-senden-0123456789';

const D = 'example.invalid';
const PW = 'Geheim-Postfach-0815';
const IBAN = ['DE89', '3704', '0044', '0532', '0130', '00'].join('');
type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let senden: R, postfaecher: R, angebot: R, rechnung: R;
let db: typeof import('@/lib/store/local-db');
let T: typeof import('@/lib/postfach/transport');
let P: typeof import('@/lib/postfach/post-speicher');
let server: PS;
const sitzung = (person = 'kevin') => ({ 'x-make-user': person, 'content-type': 'application/json' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = async (r: Response) => ({ status: r.status, text: await r.clone().text(), d: await r.json().catch(() => ({})) as Record<string, any> });
const POST = (route: R, url: string, body: unknown, h = sitzung()) => route.POST!(new Request(`http://localhost${url}`, { method: 'POST', headers: h, body: JSON.stringify(body) })).then(j);
const J = '2026-09-01T10:00:00.000Z';

beforeAll(async () => {
  db = await import('@/lib/store/local-db'); T = await import('@/lib/postfach/transport'); P = await import('@/lib/postfach/post-speicher');
  senden = await import('../app/api/inbox/senden/route') as R;
  postfaecher = await import('../app/api/inbox/postfaecher/route') as R;
  angebot = await import('../app/api/crm/angebot/route') as R;
  rechnung = await import('../app/api/rechnung/route') as R;
});
afterAll(() => { T.transportSetzen(null); rmSync(ordner, { recursive: true, force: true }); });
beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.stubEnv('GOOGLE_CLIENT_ID', ''); vi.stubEnv('GOOGLE_CLIENT_SECRET', ''); vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubGlobal('fetch', async () => { throw new Error('kein Netz im Test'); });
  server = new P.PostSpeicher({ passwort: PW, ordner: [{ pfad: 'INBOX' }, { pfad: 'Gesendete Objekte' }] });
  T.transportSetzen({ imap: z => server.sitzung(z), smtp: (z, u, roh) => server.senden(z, u, roh), waechter: async () => ({ stop: async () => {} }) });
  await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: `kevin@${D}`, name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' }], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-anna1', vorname: 'Anna', nachname: 'Kundin', email: `anna@kunde.${D}`, firmaId: 'f-muster', firma: 'Muster GmbH', eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', anrede: 'Sie' } as Kontakt] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', { ...leererBestand(), firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'kunde', geaendert: J, zahlung: { empfaenger: { anschrift: 'Hauptstraße 5, 54321 Beispielstadt' } } }] });
  await db.saveJson('gesellschaften--h', { gesellschaften: [{ id: 'kdv', firmierung: 'Beispiel Ventures UG (haftungsbeschränkt)', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', email: `info@${D}`, steuernummer: '12/345/67890', geschaeftsfuehrung: 'Erika Beispiel', register: 'Amtsgericht Musterstadt HRB 1', bank: { iban: IBAN, bic: 'COBADEFFXXX', bank: 'Beispielbank' } }] });
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', SEED);
});

async function postfach(): Promise<string> {
  const a = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `buero@firma.${D}`, passwort: PW, bereich: 'kdv', anzeigename: 'Büro' });
  expect(a.status, a.text).toBe(200);
  return a.d.id;
}
async function gestelltesAngebot(id: string): Promise<{ id: string; pdf: string; nummer: string }> {
  const e = await POST(angebot, '/api/crm/angebot', { aktion: 'speichern', id, felder: { gesellschaft: 'kdv', kontaktId: 'c-anna1', titel: 'Sprint', positionen: [{ id: 'p1', titel: 'Sprint', text: 'Analyse', menge: 1, einheit: 'pauschal', einzelpreisCent: 500000, ustSatz: 19, basis: 'einmalig' }] } });
  expect(e.status, e.text).toBe(200);
  const s = await POST(angebot, '/api/crm/angebot', { aktion: 'stellen', id, stand: e.d.angebot.stand });
  expect(s.status, s.text).toBe(200);
  return { id, pdf: s.d.pdf.id, nummer: s.d.angebot.nummer };
}

describe('Angebot über ein Postfach senden', () => {
  it('Anhang = genau dieses PDF; danach „versendet am … über …“ und die Mail-Aktivität am Kontakt', async () => {
    const pf = await postfach();
    const a = await gestelltesAngebot('ang-test-eins');
    const r = await POST(senden, '/api/inbox/senden', { neu: { postfach: pf, betreff: `Angebot ${a.nummer}` }, an: [{ email: `anna@kunde.${D}` }], text: 'Guten Tag, anbei unser Angebot.', anhaenge: [{ datei: a.pdf }], beleg: { art: 'angebot', id: a.id } });
    expect(r.status, r.text).toBe(200);
    expect(server.gesendet).toHaveLength(1);
    expect(server.gesendet[0].roh.toString('utf8')).toContain(`Angebot ${a.nummer}.pdf`);
    const c = await (await import('@/lib/crm/speicher')).ladeCrm();
    const x = c.angebote.find(y => y.id === a.id)!;
    expect(x.versendet).toHaveLength(1);
    expect(x.versendet![0]).toMatchObject({ ueber: `b***@firma.${D}`, von: 'kevin' });
    const k = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte[0];
    expect(k.aktivitaeten.some(y => y.art === 'mail' && (y.text ?? '').startsWith(`Angebot ${a.nummer} gesendet`))).toBe(true);
  });
  it('fremde Datei-Kennung (das PDF eines anderen Angebots, eine unbekannte Kennung) → abgelehnt, nichts gesendet, nichts vermerkt', async () => {
    const pf = await postfach();
    const a = await gestelltesAngebot('ang-test-zwei');
    const b = await gestelltesAngebot('ang-test-drei');
    const fremd = await POST(senden, '/api/inbox/senden', { neu: { postfach: pf, betreff: 'x' }, an: [{ email: `anna@kunde.${D}` }], text: 'x', anhaenge: [{ datei: b.pdf }], beleg: { art: 'angebot', id: a.id } });
    expect(fremd.status).toBe(400);
    const zwei = await POST(senden, '/api/inbox/senden', { neu: { postfach: pf, betreff: 'x' }, an: [{ email: `anna@kunde.${D}` }], text: 'x', anhaenge: [{ datei: a.pdf }, { datei: b.pdf }], beleg: { art: 'angebot', id: a.id } });
    expect(zwei.status).toBe(400);
    const unbekannt = await POST(senden, '/api/inbox/senden', { neu: { postfach: pf, betreff: 'x' }, an: [{ email: `anna@kunde.${D}` }], text: 'x', anhaenge: [{ datei: 'd-gibt-es-nicht-1234' }], beleg: { art: 'angebot', id: a.id } });
    expect(unbekannt.status).toBe(400);
    expect(server.gesendet).toHaveLength(0);
    const c = await (await import('@/lib/crm/speicher')).ladeCrm();
    expect(c.angebote.find(y => y.id === a.id)!.versendet).toBeUndefined();
  });
});

describe('Rechnung über ein Postfach senden', () => {
  it('das PDF der Rechnung zählt als Anhang (Bezug `rechnungsPdf`); danach „versendet am … über …“ an der Rechnung', async () => {
    const pf = await postfach();
    const n = await POST(rechnung, '/api/rechnung', { aktion: 'neu', quelle: 'frei', firmaId: 'kdv', kontaktId: 'c-anna1' });
    expect(n.status, n.text).toBe(200);
    const s = await POST(rechnung, '/api/rechnung', { aktion: 'speichern', id: n.d.rechnung.id, stand: n.d.rechnung.fassung, felder: { leistungVon: '2026-10-01', leistungBis: '2026-10-31', positionen: [{ id: 'p1', titel: 'Beratung', text: 'Oktober', menge: 1, einheit: 'Tag', einzelpreisCent: 120000, ustSatz: 19 }] } });
    expect(s.status, s.text).toBe(200);
    const g = await POST(rechnung, '/api/rechnung', { aktion: 'stellen', id: n.d.rechnung.id, stand: s.d.rechnung.fassung });
    expect(g.status, g.text).toBe(200);
    const r = g.d.rechnung;
    const ohneBeleg = await POST(senden, '/api/inbox/senden', { neu: { postfach: pf, betreff: 'x' }, an: [{ email: `anna@kunde.${D}` }], text: 'x', anhaenge: [{ datei: 'd-gibt-es-nicht-9999' }], beleg: { art: 'rechnung', id: r.id } });
    expect(ohneBeleg.status).toBe(400);
    const ok = await POST(senden, '/api/inbox/senden', { neu: { postfach: pf, betreff: `Rechnung ${r.nummer}` }, an: [{ email: `anna@kunde.${D}` }], text: 'Guten Tag, anbei die Rechnung.', anhaenge: [{ datei: r.pdfDateiId }], beleg: { art: 'rechnung', id: r.id } });
    expect(ok.status, ok.text).toBe(200);
    expect(server.gesendet).toHaveLength(1);
    expect(server.gesendet[0].roh.toString('utf8')).toContain('Content-Type: application/pdf');
    const plan = await db.loadJson<{ rechnungen: { id: string; versendet?: { ueber: string; von: string }[] }[] }>('finanzplan');
    expect(plan!.rechnungen.find(x => x.id === r.id)!.versendet).toEqual([expect.objectContaining({ ueber: `b***@firma.${D}`, von: 'kevin' })]);
  });
  it('ein Beleg geht nur mit einer neuen Mail hinaus', async () => {
    const r = await POST(senden, '/api/inbox/senden', { gespraech: 'gm~abc', text: 'x', beleg: { art: 'rechnung', id: 'r-1234' } });
    expect([400, 404]).toContain(r.status);
    expect(server.gesendet).toHaveLength(0);
  });
});
