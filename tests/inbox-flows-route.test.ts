// Inbox-Flows (09.10.): POST /api/inbox/ablegen von Ende zu Ende — mit nachgebautem IMAP-Anbieter (PostSpeicher), nie ein echter Server.
// Die Bytes holt der SERVER aus dem eigenen Postfach; abgelegt wird nur über die vorhandenen Wege (CRM-Ablage, Projekt-Dateien), Typ am
// Inhalt, Art. 18 nie, Werbesperre nicht an der Person, Privat ↔ Business nur bewusst, andere Person 404, Dienstweg 403, Retry einmalig.
// Erfundene Daten (@example.invalid).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { PostSpeicher as PS } from '@/lib/postfach/post-speicher';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-inbox-flows-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-inbox-flows';
process.env.MAKE_OS_KEY = 'dienst-test-inbox-flows';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-inbox-flows-0123456789abcdef';

const D = 'example.invalid';
const PW_KDV = 'Geheim-Passwort-KDV-0815';
const PW_PRIVAT = 'abcd-efgh-ijkl-mnop';
const PDF = '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n';
type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let inbox: R, postfaecher: R, ablegen: R;
let db: typeof import('@/lib/store/local-db');
let A: typeof import('@/lib/postfach/abgleich');
let T: typeof import('@/lib/postfach/transport');
let P: typeof import('@/lib/postfach/post-speicher');
const server = new Map<string, PS>();

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const dienst = (person = 'kevin') => ({ 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person, 'content-type': 'application/json' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = async (r: Response) => ({ status: r.status, text: await r.clone().text(), d: await r.json().catch(() => ({})) as Record<string, any> });
const GET = (route: R, url: string, h: Record<string, string> = sitzung('kevin')) => route.GET!(new Request(`http://localhost${url}`, { headers: h })).then(j);
const POST = (route: R, url: string, body: unknown, h: Record<string, string> = sitzung('kevin')) => route.POST!(new Request(`http://localhost${url}`, { method: 'POST', headers: h, body: JSON.stringify(body) })).then(j);
const k = (id: string, vorname: string, nachname: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname, nachname, stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie', ...x } as Kontakt);
const J = '2026-09-28T10:00:00.000Z';
const projekt = (id: string, title: string, spaceId: string) => ({ id, title, spaceId, category: 'business', owner: 'kevin', color: '#fff', tags: [], archived: false, createdAt: J, updatedAt: J });

const KONTEN = { konten: [
  { id: 'k1', speicher: 'kevin', email: `kevin@${D}`, name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  { id: 'k2', speicher: 'malin', email: `malin@${D}`, name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
], einladungen: [] };

beforeAll(async () => {
  db = await import('@/lib/store/local-db'); A = await import('@/lib/postfach/abgleich'); T = await import('@/lib/postfach/transport'); P = await import('@/lib/postfach/post-speicher');
  inbox = await import('../app/api/inbox/route') as R; postfaecher = await import('../app/api/inbox/postfaecher/route') as R; ablegen = await import('../app/api/inbox/ablegen/route') as R;
});
afterAll(() => { T.transportSetzen(null); rmSync(ordner, { recursive: true, force: true }); });

const anbieter = (benutzer: string): PS => { const s = server.get(benutzer); if (!s) throw new T.PostfachFehler('netz', 'Server unbekannt', 503); return s; };

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.stubEnv('GOOGLE_CLIENT_ID', ''); vi.stubEnv('GOOGLE_CLIENT_SECRET', ''); vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubGlobal('fetch', async () => { throw new Error('kein Netz im Test'); });
  server.clear();
  server.set(`kevin.kdv@firma.${D}`, new P.PostSpeicher({ passwort: PW_KDV, ordner: [{ pfad: 'INBOX' }, { pfad: 'Gesendete Objekte' }] }));
  server.set('kevin.privat', new P.PostSpeicher({ passwort: PW_PRIVAT }));
  T.transportSetzen({ imap: z => anbieter(z.benutzer).sitzung(z), smtp: (z, u, roh) => anbieter(z.benutzer).senden(z, u, roh), waechter: async () => ({ stop: async () => {} }) });
  await db.saveJson('konten', KONTEN);
  await db.saveJson('kontakte', { kontakte: [
    k('c-anna', 'Anna', 'Schmidt', { email: `anna@kunde.${D}`, firmaId: 'f-kunde' }),
    k('c-eva', 'Eva', 'Eng', { email: `eva@kunde.${D}`, firmaId: 'f-kunde', eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'kevin' } }),
    k('c-werner', 'Werner', 'Sperr', { email: `werner@kunde.${D}`, firmaId: 'f-kunde', werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } }),
  ] });
  await db.saveJson('crm', { firmen: [{ id: 'f-kunde', name: 'Kunde GmbH' }], chancen: [{ id: 'd-1', titel: 'Rahmenvertrag', stufe: 'angebot', kontaktIds: ['c-anna'], firmaId: 'f-kunde' }], mandate: [{ id: 'm1', titel: 'Begleitung', kunde: 'Kunde GmbH', firmaId: 'f-kunde', status: 'aktiv', kontaktIds: ['c-anna'] }], followups: [], kampagnen: [], events: [], beitraege: [], teilnahmen: [] });
  await db.saveJson('tasks', { projects: [projekt('p-kunde', 'Einführung', 'm-f-kunde'), projekt('p-intern', 'Intern', 'kdv')], tasks: [], listen: [], statusEigen: [] });
  const kdv = server.get(`kevin.kdv@firma.${D}`)!;
  kdv.ablegen('INBOX', P.rohNachricht({ von: `Anna Schmidt <anna@kunde.${D}>`, an: `kevin.kdv@firma.${D}`, betreff: 'Vertrag', text: 'Anbei der Vertrag.', messageId: `<a1@kunde.${D}>`, anhang: { name: 'Rahmenvertrag.pdf', typ: 'application/pdf', inhalt: PDF } }));
  kdv.ablegen('INBOX', P.rohNachricht({ von: `Anna Schmidt <anna@kunde.${D}>`, an: `kevin.kdv@firma.${D}`, betreff: 'Liste', text: 'Die Liste.', messageId: `<a2@kunde.${D}>`, anhang: { name: 'Teilnehmer.csv', typ: 'text/csv', inhalt: 'Name;Ort\nA;B\n' } }));
  kdv.ablegen('INBOX', P.rohNachricht({ von: `Eva Eng <eva@kunde.${D}>`, an: `kevin.kdv@firma.${D}`, betreff: 'Eva', text: 'Hallo', messageId: `<e1@kunde.${D}>`, anhang: { name: 'Eva.pdf', typ: 'application/pdf', inhalt: PDF } }));
  kdv.ablegen('INBOX', P.rohNachricht({ von: `Werner Sperr <werner@kunde.${D}>`, an: `kevin.kdv@firma.${D}`, betreff: 'Werner', text: 'Hallo', messageId: `<w1@kunde.${D}>`, anhang: { name: 'Werner.pdf', typ: 'application/pdf', inhalt: PDF } }));
  server.get('kevin.privat')!.ablegen('INBOX', P.rohNachricht({ von: `Anna Schmidt <anna@kunde.${D}>`, an: 'kevin.privat@icloud.com', betreff: 'Privat von Anna', text: 'Privat', messageId: `<p1@${D}>`, anhang: { name: 'Foto.pdf', typ: 'application/pdf', inhalt: PDF } }));
});

async function verbinden() {
  const a = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `kevin.kdv@firma.${D}`, passwort: PW_KDV, bereich: 'kdv', anzeigename: 'KD Ventures' });
  const b = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'icloud', adresse: 'kevin.privat@icloud.com', passwort: PW_PRIVAT, bereich: 'privat', anzeigename: 'Privat' });
  expect(a.status, a.text).toBe(200); expect(b.status, b.text).toBe(200);
  await A.imapAbgleichen('kevin', a.d.id); await A.imapAbgleichen('kevin', b.d.id);
}
/** Gespräch + jüngste Nachricht mit Anhang zum Betreff (aus dem Strom und dem Gespräch). */
async function finde(betreff: string): Promise<{ id: string; nachricht: string; teil: string }> {
  const g = (await GET(inbox, '/api/inbox')).d.gespraeche.find((x: { betreff: string }) => x.betreff === betreff);
  const gesp = await import('../app/api/inbox/gespraech/route') as R;
  const a = await GET(gesp, `/api/inbox/gespraech?id=${encodeURIComponent(g.id)}`);
  const n = a.d.nachrichten.find((x: { anhaenge: unknown[] }) => x.anhaenge.length);
  return { id: g.id, nachricht: n.id, teil: n.anhaenge[0].teil };
}
const crmAblage = async () => (await db.loadJson<{ eintraege: { kontaktId?: string; firmaId?: string; mandatId?: string; dealId?: string; art: string; notiz?: string; datei: { name: string; verschluesselt: boolean } }[] }>('crm-dateien--h'))?.eintraege ?? [];
const projektAblage = async () => (await db.loadJson<{ eintraege: { projektId: string; aufgabeId?: string; bereich: string; notiz?: string; datei: { name: string; typ: string } }[] }>('aufgaben-dateien--h'))?.eintraege ?? [];

describe('Ablegen in die CRM-Ablage (Firma/Kontakt)', () => {
  it('PDF an Kontakt + Firma + Deal: Art aus dem Namen, Herkunft als Link, verschlüsselt, NIE ein Mandat (sonst nicht mehr löschbar)', async () => {
    await verbinden();
    const f = await finde('Vertrag');
    const r = await POST(ablegen, '/api/inbox/ablegen', { gespraech: f.id, nachricht: f.nachricht, teil: f.teil, ziel: { art: 'crm', kontaktId: 'c-anna', firmaId: 'f-kunde', dealId: 'd-1', dateiArt: 'vertrag' } });
    expect(r.status, r.text).toBe(200);
    const [e] = await crmAblage();
    expect(e).toMatchObject({ kontaktId: 'c-anna', firmaId: 'f-kunde', dealId: 'd-1', art: 'vertrag', datei: { name: 'Rahmenvertrag.pdf', verschluesselt: true } });
    expect(e.mandatId).toBeUndefined();
    expect(e.notiz).toBe(`Aus der Inbox · /os/inbox?offen=${f.id}`);
  });
  it('Typ am Inhalt: CSV → 415 (geht in die Projekt-Ablage), die Mail als Text → 415', async () => {
    await verbinden();
    const f = await finde('Liste');
    expect((await POST(ablegen, '/api/inbox/ablegen', { gespraech: f.id, nachricht: f.nachricht, teil: f.teil, ziel: { art: 'crm', firmaId: 'f-kunde' } })).status).toBe(415);
    expect((await POST(ablegen, '/api/inbox/ablegen', { gespraech: f.id, nachricht: f.nachricht, teil: 'mail', ziel: { art: 'crm', firmaId: 'f-kunde' } })).status).toBe(415);
    expect(await crmAblage()).toEqual([]);
  });
  it('nur Bezüge dieses Gesprächs; Werbesperre nie an der Person (Firma ja); Art. 18 gar nicht', async () => {
    await verbinden();
    const f = await finde('Vertrag');
    expect((await POST(ablegen, '/api/inbox/ablegen', { gespraech: f.id, nachricht: f.nachricht, teil: f.teil, ziel: { art: 'crm', kontaktId: 'c-werner' } })).status).toBe(400);
    const w = await finde('Werner');
    const wp = await POST(ablegen, '/api/inbox/ablegen', { gespraech: w.id, nachricht: w.nachricht, teil: w.teil, ziel: { art: 'crm', kontaktId: 'c-werner', firmaId: 'f-kunde' } });
    expect(wp.status).toBe(409); expect(wp.d.code).toBe('bezug');
    expect((await POST(ablegen, '/api/inbox/ablegen', { gespraech: w.id, nachricht: w.nachricht, teil: w.teil, ziel: { art: 'crm', firmaId: 'f-kunde' } })).status).toBe(200);
    const e = await finde('Eva');
    for (const ziel of [{ art: 'crm', firmaId: 'f-kunde' }, { art: 'projekt', projektId: 'p-kunde' }]) {
      const x = await POST(ablegen, '/api/inbox/ablegen', { gespraech: e.id, nachricht: e.nachricht, teil: e.teil, ziel });
      expect(x.status).toBe(409); expect(x.d.code).toBe('eingeschraenkt');
    }
    const l = await crmAblage();
    expect(l).toHaveLength(1); expect(l[0].kontaktId).toBeUndefined();
  });
});

describe('Ablegen in die Projekt-Dateien', () => {
  it('Anhang ans Kundenprojekt (Mandanten-Space) und die Mail als Text — Bereich aus dem Space, Herkunft als Link', async () => {
    await verbinden();
    const f = await finde('Liste');
    expect((await POST(ablegen, '/api/inbox/ablegen', { gespraech: f.id, nachricht: f.nachricht, teil: f.teil, ziel: { art: 'projekt', projektId: 'p-kunde' } })).status).toBe(200);
    const m = await POST(ablegen, '/api/inbox/ablegen', { gespraech: f.id, nachricht: f.nachricht, teil: 'mail', ziel: { art: 'projekt', projektId: 'p-kunde' } });
    expect(m.status, m.text).toBe(200);
    const l = await projektAblage();
    expect(l.map(x => [x.projektId, x.bereich, x.datei.typ])).toEqual([['p-kunde', 'business', 'text/csv'], ['p-kunde', 'business', 'text/plain']]);
    expect(l[1].datei.name).toMatch(/^Mail \d{4}-\d{2}-\d{2} Liste\.txt$/);
    expect(l[0].notiz).toContain('/os/inbox?offen=');
  });
  it('Privat ↔ Business nur bewusst: 409 code bereich ohne `bereichWechsel`, mit → abgelegt', async () => {
    await verbinden();
    const p = await finde('Privat von Anna');
    for (const ziel of [{ art: 'projekt', projektId: 'p-kunde' }, { art: 'crm', kontaktId: 'c-anna', firmaId: 'f-kunde' }]) {
      const x = await POST(ablegen, '/api/inbox/ablegen', { gespraech: p.id, nachricht: p.nachricht, teil: p.teil, ziel });
      expect(x.status, x.text).toBe(409); expect(x.d).toMatchObject({ code: 'bereich', von: 'privat', nach: 'business' });
    }
    expect((await POST(ablegen, '/api/inbox/ablegen', { gespraech: p.id, nachricht: p.nachricht, teil: p.teil, ziel: { art: 'projekt', projektId: 'sonstige-privat' } })).status).toBe(200);
    expect((await POST(ablegen, '/api/inbox/ablegen', { gespraech: p.id, nachricht: p.nachricht, teil: p.teil, ziel: { art: 'crm', firmaId: 'f-kunde' }, bereichWechsel: true })).status).toBe(200);
    expect((await projektAblage()).map(x => x.bereich)).toEqual(['privat']);
  });
  it('unbekanntes Projekt 404; Aufgabe muss zum Projekt gehören', async () => {
    await verbinden();
    const f = await finde('Liste');
    expect((await POST(ablegen, '/api/inbox/ablegen', { gespraech: f.id, nachricht: f.nachricht, teil: f.teil, ziel: { art: 'projekt', projektId: 'p-gibtsnicht' } })).status).toBe(404);
  });
});

describe('Rechte und Wiederholung', () => {
  it('andere Person: 404 (Gespräch gibt es für sie nicht); Dienstweg 403; Unsinn 400', async () => {
    await verbinden();
    const f = await finde('Vertrag');
    const body = { gespraech: f.id, nachricht: f.nachricht, teil: f.teil, ziel: { art: 'crm', firmaId: 'f-kunde' } };
    expect((await POST(ablegen, '/api/inbox/ablegen', body, sitzung('malin'))).status).toBe(404);
    expect((await POST(ablegen, '/api/inbox/ablegen', body, dienst())).status).toBe(403);
    expect((await POST(ablegen, '/api/inbox/ablegen', { ...body, ziel: { art: 'irgendwo' } })).status).toBe(400);
    expect((await POST(ablegen, '/api/inbox/ablegen', { ...body, teil: '../x' })).status).toBe(400);
    expect(await crmAblage()).toEqual([]);
  });
  it('dieselbe anfrageId zweimal → einmal abgelegt', async () => {
    await verbinden();
    const f = await finde('Vertrag');
    const body = { gespraech: f.id, nachricht: f.nachricht, teil: f.teil, ziel: { art: 'crm', firmaId: 'f-kunde' }, anfrageId: 'abl-0123456789abcdef' };
    expect((await POST(ablegen, '/api/inbox/ablegen', body)).status).toBe(200);
    expect((await POST(ablegen, '/api/inbox/ablegen', body)).status).toBe(200);
    expect(await crmAblage()).toHaveLength(1);
  });
});
