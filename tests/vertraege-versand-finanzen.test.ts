// ─── Verträge · Senden aus dem Postfach + Darlehen in die Finanzen (02.11.) ───────────────────────────────────────────
// Senden: nur per Klick einer Person (Dienstweg 403, „nur Business“ 403, fremder Haushalt 403), nur aus einem EIGENEN Business-Postfach (privat/
// unbekannt → 400), nur an eine Adresse des Vertragspartners (sonst 400), Art. 18 → 409, genau das PDF dieses Vertrags hängt an, einmal je
// anfrageId; danach „versendet“, Akte, Follow-up „Unterschrift nachfassen“ (+7 Tage, idempotent).
// Darlehen: gerechnete Platzhalter (Zinsen gesamt, Tilgungsplan als Tabelle), Plausibilität beim Fertigstellen (400), „Steht an“-Hinweis nach der
// Unterschrift, Übernahme nur per Klick (idempotent, Kennung aus dem Vertrag, `vertragId`), Raten in der Liquidität (angeglichen, beendet → offene
// weg, bezahlte bleiben), Monate außerhalb des Plans → 400, private Seite ohne Privatzugang → 403, Karte „Darlehen“ serverseitig gefiltert.
// Nachgebautes Postfach (PostSpeicher), kein Netz; erfundene Konten/Firmen (@example.invalid), eigener Datenordner.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { PostSpeicher as PS } from '@/lib/postfach/post-speicher';
import type { Vertrag } from '@/lib/vertraege/modell';
import type { Darlehen } from '@/lib/finanzen/rechenkern';
import { planFix } from './fixtures/finanz-plan';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-vertraege-versand-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-vertraege-versand';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-vertraege-versand';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-vertraege-versand-0123456789';
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

const D = 'example.invalid';
const GEHEIM = 'Pruef-Passwort-Postfach-1';
const J = '2026-11-01T10:00:00.000Z';
type Route = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let vertraege: Route, vorlagen: Route, unterschrift: Pick<Route, 'POST'>, postfaecher: Route;
let db: typeof import('@/lib/store/local-db');
let T: typeof import('@/lib/postfach/transport');
let P: typeof import('@/lib/postfach/post-speicher');
let A: typeof import('@/lib/postfach/abgleich');
const server = new Map<string, PS>();
const kopf = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = { 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-vertraege-versand', 'x-make-person': 'person-a' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const post = async (r: Pick<Route, 'POST'>, body: unknown, p = 'person-a', url = 'http://test/api/vertraege'): Promise<{ status: number; d: any }> => {
  const res = await r.POST(new Request(url, { method: 'POST', headers: kopf(p), body: JSON.stringify(body) }));
  return { status: res.status, d: await res.json() };
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const get = async (url: string, p = 'person-a'): Promise<{ status: number; d: any }> => {
  const res = await vertraege.GET(new Request(url, { headers: kopf(p) }));
  return { status: res.status, d: await res.json().catch(() => ({})) };
};
const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', haushalt: string, x: Record<string, unknown> = {}) => ({ id, speicher: sp, email: `${sp}@${D}`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt, ...x });
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Anna', nachname: 'Test', email: `anna@kunde.${D}`, eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', anrede: 'Sie', ...x } as Kontakt);
type VS = Vertrag & { stand: string };

const vorlageEinfach = {
  titel: 'Beispielvertrag', art: 'dienstleistung', felder: [{ schluessel: 'stundensatz', label: 'Stundensatz', typ: 'text', pflicht: true }],
  paragraphen: [{ id: 'p-1', nr: '§ 1', titel: 'Gegenstand', text: '{{absender.firmierung}} erbringt für {{partner.name}} Leistungen je {{stundensatz}}.' }],
};
const DF = ['darlehen_betrag', 'darlehen_auszahlung', 'darlehen_zins_prozent', 'darlehen_zinsen', 'darlehen_raten_beginn', 'darlehen_raten_anzahl', 'darlehen_rate'];
const vorlageDarlehen = {
  titel: 'Beispiel-Darlehen', art: 'sonstiges', felder: DF.map(s => ({ schluessel: s, label: s, typ: 'text', pflicht: s !== 'darlehen_zins_prozent' })),
  paragraphen: [
    { id: 'p-1', nr: '§ 1', titel: 'Darlehen', text: '{{absender.firmierung}} erhält von {{partner.name}} EUR {{darlehen_betrag}}, ausgezahlt am {{darlehen_auszahlung}}.' },
    { id: 'p-2', nr: '§ 2', titel: 'Zinsen', text: 'Zins {{darlehen_zins_prozent}} % ({{darlehen_zinsen}}), insgesamt EUR {{darlehen_zinsen_gesamt}}.' },
    { id: 'p-3', nr: '§ 3', titel: 'Tilgung', text: '{{darlehen_raten_anzahl}} Raten à EUR {{darlehen_rate}} ab {{darlehen_raten_beginn}}.\n{{darlehen_tilgungsplan}}' },
  ],
};
const WERTE_OK = { darlehen_betrag: '12.000,00', darlehen_auszahlung: '2026-12-15', darlehen_zins_prozent: '3', darlehen_zinsen: 'monatlich', darlehen_raten_beginn: '2027-01-15', darlehen_raten_anzahl: '12', darlehen_rate: '1.000,00' };
let idEinfach = '', idDarlehen = '';

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  T = await import('@/lib/postfach/transport'); P = await import('@/lib/postfach/post-speicher'); A = await import('@/lib/postfach/abgleich');
  vi.stubEnv('GOOGLE_CLIENT_ID', ''); vi.stubEnv('GOOGLE_CLIENT_SECRET', ''); vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubGlobal('fetch', async () => { throw new Error('kein Netz im Test'); });
  server.set(`person-a@firma.${D}`, new P.PostSpeicher({ passwort: GEHEIM, ordner: [{ pfad: 'INBOX' }, { pfad: 'Gesendete Objekte' }] }));
  server.set(`person-a@privat.${D}`, new P.PostSpeicher({ passwort: GEHEIM, ordner: [{ pfad: 'INBOX' }, { pfad: 'Sent' }] }));
  const anbieter = (b: string) => { const s = server.get(b); if (!s) throw new T.PostfachFehler('netz', 'Server unbekannt', 503); return s; };
  T.transportSetzen({ imap: z => anbieter(z.benutzer).sitzung(z), smtp: (z, u, roh) => anbieter(z.benutzer).senden(z, u, roh), waechter: async () => ({ stop: async () => {} }) });
  const speicher = await import('@/lib/crm/speicher');
  await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'inhaber', 'haus'), konto('k2', 'person-b', 'mitglied', 'haus'), konto('k4', 'person-c', 'mitglied', 'haus', { finanzRecht: 'business' }), konto('k3', 'testkunde', 'inhaber', 'kunde-haus')], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [k('c-anna1', { firmaId: 'f-muster', firma: 'Muster GmbH' })] });
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'zielkunde', stadt: 'Musterstadt', geaendert: J }] });
  await db.saveJson('gesellschaften--haus', { gesellschaften: [{ id: 'kdv', firmierung: 'Beispiel Ventures UG (haftungsbeschränkt)', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt' }] });
  await db.saveJson('finanzen-plan--haus', planFix());
  vertraege = (await import('@/app/api/vertraege/route')) as unknown as Route;
  vorlagen = (await import('@/app/api/vertraege/vorlagen/route')) as unknown as Route;
  unterschrift = (await import('@/app/api/vertraege/unterschrift/route')) as unknown as Route;
  postfaecher = (await import('@/app/api/inbox/postfaecher/route')) as unknown as Route;
  const a = await post(vorlagen, { aktion: 'speichern', felder: vorlageEinfach }, 'person-a', 'http://test/api/vertraege/vorlagen');
  const b = await post(vorlagen, { aktion: 'speichern', felder: vorlageDarlehen }, 'person-a', 'http://test/api/vertraege/vorlagen');
  expect(a.status, JSON.stringify(a.d)).toBe(200); expect(b.status, JSON.stringify(b.d)).toBe(200);
  idEinfach = a.d.vorlage.id; idDarlehen = b.d.vorlage.id;
});
afterAll(() => { T.transportSetzen(null); vi.unstubAllGlobals(); rmSync(ordner, { recursive: true, force: true }); });

const anlegen = async (vorlageId: string, werte: Record<string, string>): Promise<VS> => {
  const r = await post(vertraege, { aktion: 'anlegen', vorlageId, gesellschaft: 'kdv', vorbelegung: { firmaId: 'f-muster', kontaktId: 'c-anna1' } });
  expect(r.status, JSON.stringify(r.d)).toBe(200);
  const s = await post(vertraege, { aktion: 'speichern', id: r.d.vertrag.id, stand: r.d.vertrag.stand, felder: { werte } });
  expect(s.status, JSON.stringify(s.d)).toBe(200);
  return s.d.vertrag;
};
const fertig = async (v: VS): Promise<VS> => { const r = await post(vertraege, { aktion: 'fertigstellen', id: v.id, stand: v.stand, trotzdem: true }); expect(r.status, JSON.stringify(r.d)).toBe(200); return r.d.vertrag; };
const unterschreiben = async (v: VS): Promise<VS> => {
  const form = new FormData();
  form.set('id', v.id); form.set('stand', v.stand);
  form.set('datei', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46])], 'unterschrieben.pdf', { type: 'application/pdf' }));
  const res = await unterschrift.POST(new Request('http://test/api/vertraege/unterschrift', { method: 'POST', headers: { 'x-make-user': 'person-a' }, body: form }));
  const d = await res.json();
  expect(res.status, JSON.stringify(d)).toBe(200);
  return d.vertrag;
};
const aktuell = async (id: string): Promise<VS> => (await get('http://test/api/vertraege')).d.vertraege.find((x: VS) => x.id === id);

describe('Vertrag senden aus dem Postfach', () => {
  let pfBusiness = '', pfPrivat = '';
  let v: VS;
  beforeAll(async () => {
    const a = await post(postfaecher, { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `person-a@firma.${D}`, passwort: GEHEIM, bereich: 'kdv', anzeigename: 'Firma' }, 'person-a', 'http://test/api/inbox/postfaecher');
    const b = await post(postfaecher, { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `person-a@privat.${D}`, passwort: GEHEIM, bereich: 'privat', anzeigename: 'Privat' }, 'person-a', 'http://test/api/inbox/postfaecher');
    expect(a.status, JSON.stringify(a.d)).toBe(200); expect(b.status, JSON.stringify(b.d)).toBe(200);
    pfBusiness = a.d.id; pfPrivat = b.d.id;
    await A.imapAbgleichen('person-a', pfBusiness); await A.imapAbgleichen('person-a', pfPrivat);
    v = await fertig(await anlegen(idEinfach, { stundensatz: '100 €' }));
  });
  const body = (x: Record<string, unknown> = {}) => ({ aktion: 'senden', id: v.id, stand: v.stand, postfach: pfBusiness, an: `anna@kunde.${D}`, betreff: `Vertrag ${v.nummer}`, text: 'Guten Tag,\n\nanbei Ihr Vertrag zur Unterschrift.\n\nViele Grüße', anfrageId: 'vtr-send-pruef-0001', ...x });
  const gesendet = () => server.get(`person-a@firma.${D}`)!.gesendet.length + server.get(`person-a@privat.${D}`)!.gesendet.length;

  it('Dialog-Daten: Adressen des Vertragspartners + Vorgabe-Text, sendet nichts', async () => {
    const r = await get(`http://test/api/vertraege?senden=${v.id}`);
    expect(r.status).toBe(200);
    expect(r.d.adressen).toEqual([`anna@kunde.${D}`]);
    expect(r.d.vorgabe.betreff).toContain(v.nummer);
    expect(gesendet()).toBe(0);
  });

  it('Rechte: Dienstweg 403, „nur Business“ 403, fremder Haushalt 403 — nichts gesendet', async () => {
    expect((await vertraege.POST(new Request('http://test/api/vertraege', { method: 'POST', headers: dienst, body: JSON.stringify(body()) }))).status).toBe(403);
    expect((await post(vertraege, body(), 'person-c')).status).toBe(403);
    expect((await post(vertraege, body(), 'testkunde')).status).toBe(403);
    expect(gesendet()).toBe(0);
  });

  it('falsches Postfach (privat, unbekannt) → 400; fremde Empfängeradresse → 400; Entwurf → 409', async () => {
    const pr = await post(vertraege, body({ postfach: pfPrivat, anfrageId: 'vtr-send-pruef-0002' }));
    expect(pr.status).toBe(400);
    expect(pr.d.fehler).toMatch(/Business-Bereich/);
    expect((await post(vertraege, body({ postfach: 'pf-gibtsnicht', anfrageId: 'vtr-send-pruef-0003' }))).status).toBe(400);
    expect((await post(vertraege, body({ an: `jemand@anders.${D}`, anfrageId: 'vtr-send-pruef-0004' }))).status).toBe(400);
    const e = await anlegen(idEinfach, { stundensatz: '90 €' });
    expect((await post(vertraege, body({ id: e.id, stand: e.stand, anfrageId: 'vtr-send-pruef-0005' }))).status).toBe(409);
    expect(gesendet()).toBe(0);
  });

  it('Art. 18 → 409, nichts gesendet', async () => {
    const vorher = await db.loadJson<{ kontakte: Kontakt[] }>('kontakte');
    await db.saveJson('kontakte', { kontakte: vorher!.kontakte.map(x => ({ ...x, eingeschraenkt: { seit: '2026-10-01', grund: 'Art. 18', von: 'person-a' } })) });
    const r = await post(vertraege, body({ anfrageId: 'vtr-send-pruef-0006' }));
    expect(r.status).toBe(409);
    expect((await get(`http://test/api/vertraege?senden=${v.id}`)).d).toMatchObject({ adressen: [], eingeschraenkt: true });
    await db.saveJson('kontakte', vorher);
    expect(gesendet()).toBe(0);
  });

  it('gesendet mit genau dem PDF; versendet, Akte, Follow-up +7 Tage; dieselbe anfrageId sendet nicht noch einmal', async () => {
    const r = await post(vertraege, body());
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    expect(r.d.vertrag.status).toBe('versendet');
    const s = server.get(`person-a@firma.${D}`)!;
    expect(s.gesendet).toHaveLength(1);
    expect(s.gesendet[0]).toMatchObject({ von: `person-a@firma.${D}`, an: [`anna@kunde.${D}`] });
    const roh = s.gesendet[0].roh.toString();
    expect(roh).toMatch(/application\/pdf/);
    expect((roh.match(/Content-Disposition: attachment/gi) ?? []).length).toBe(1);
    const nochmal = await post(vertraege, body());
    expect(nochmal.status).toBe(200);
    expect(s.gesendet).toHaveLength(1);
    const kontakte = await db.loadJson<{ kontakte: Kontakt[] }>('kontakte');
    const akt = kontakte!.kontakte[0].aktivitaeten.filter(a => (a.text ?? '').startsWith(`Vertrag ${v.nummer} versendet`));
    expect(akt).toHaveLength(1);
    const crm = await (await import('@/lib/crm/speicher')).ladeCrm();
    const fu = crm.followups.filter(f => f.id === `fu-${v.id}`);
    expect(fu).toHaveLength(1);
    expect(fu[0].text).toMatch(/Unterschrift nachfassen/);
    const { localDay, tagePlus } = await import('@/lib/zeit');
    expect(fu[0].faellig).toBe(tagePlus(localDay(), 7));
    // Erneut senden (neue Kennung): zweite Mail, aber kein zweiter Akten-Vermerk, kein zweites Follow-up.
    const neu = await aktuell(v.id);
    expect((await post(vertraege, body({ stand: neu.stand, anfrageId: 'vtr-send-pruef-0007' }))).status).toBe(200);
    expect(s.gesendet).toHaveLength(2);
    expect((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte[0].aktivitaeten.filter(a => (a.text ?? '').startsWith(`Vertrag ${v.nummer} versendet`))).toHaveLength(1);
    expect((await (await import('@/lib/crm/speicher')).ladeCrm()).followups.filter(f => f.id === `fu-${v.id}`)).toHaveLength(1);
    // Das Änderungsprotokoll trägt nur Kennungen/Feldnamen — nie den Mailtext.
    const { readdirSync, readFileSync } = await import('node:fs');
    const protokoll = readdirSync(ordner).filter(f => f.startsWith('aenderungsprotokoll')).map(f => readFileSync(path.join(ordner, f), 'utf8')).join('');
    expect(protokoll).not.toContain('anbei Ihr Vertrag');
  });

  it('der Weg „Ist versendet“ von Hand bleibt', async () => {
    const w = await fertig(await anlegen(idEinfach, { stundensatz: '80 €' }));
    const r = await post(vertraege, { aktion: 'status', id: w.id, stand: w.stand, status: 'versendet' });
    expect(r.status).toBe(200);
    expect(r.d.vertrag.status).toBe('versendet');
  });
});

describe('Darlehensvertrag: gerechnete Platzhalter und Plausibilität', () => {
  it('rein: Zinsen gesamt und Tilgungsplan; unplausibel → Satz', async () => {
    const { darlehenPlatzhalter, darlehenAusWerten } = await import('@/lib/vertraege/darlehen');
    const p = darlehenPlatzhalter(WERTE_OK);
    expect(p.darlehen_zinsen_gesamt).toMatch(/^\d{1,3},\d{2}$/);
    const zeilen = p.darlehen_tilgungsplan.split('\n');
    expect(zeilen[0]).toBe('Monat\tRestschuld\tTilgung\tZins');
    expect(zeilen[zeilen.length - 1]).toMatch(/^Summe\t\t12\.000,00\t/);
    const f = darlehenAusWerten({ ...WERTE_OK, darlehen_rate: '900,00' });
    expect('fehler' in f && f.fehler.join(' ')).toMatch(/Raten passen nicht/);
    expect(darlehenPlatzhalter({ ...WERTE_OK, darlehen_rate: '900,00' }).darlehen_tilgungsplan).toBe('');
  });

  it('Fertigstellen: Raten passen nicht → 400; passend → Fassung mit Tabelle und Zinsen', async () => {
    const v = await anlegen(idDarlehen, { ...WERTE_OK, darlehen_rate: '900,00' });
    const r = await post(vertraege, { aktion: 'fertigstellen', id: v.id, stand: v.stand, trotzdem: true });
    expect(r.status).toBe(400);
    expect(r.d.fehlt.join(' ')).toMatch(/Raten passen nicht/);
    const ok = await fertig(await anlegen(idDarlehen, WERTE_OK));
    const text = (ok.fassung ?? []).map(p => p.text).join('\n');
    expect(text).toContain('Monat\tRestschuld\tTilgung\tZins');
    expect(text).not.toMatch(/\{\{/);
  });
});

describe('Darlehen in die Finanzen — erst der Klick', () => {
  let v: VS;
  beforeAll(async () => { v = await fertig(await anlegen(idDarlehen, WERTE_OK)); });
  const fin = (x: Record<string, unknown> = {}, p = 'person-a') => post(vertraege, { aktion: 'finanzen', id: v.id, geber: 'extern', nehmer: 'kdv', anfrageId: 'vtr-fin-pruef-0001', ...x }, p);

  it('vor der Unterschrift → 409; Dienstweg/„nur Business“ → 403', async () => {
    expect((await fin({ anfrageId: 'vtr-fin-pruef-0000' })).status).toBe(409);
    expect((await vertraege.POST(new Request('http://test/api/vertraege', { method: 'POST', headers: dienst, body: JSON.stringify({ aktion: 'finanzen', id: v.id, geber: 'extern', nehmer: 'kdv' }) }))).status).toBe(403);
    expect((await fin({ anfrageId: 'vtr-fin-pruef-0009' }, 'person-c')).status).toBe(403);
  });

  it('unterschrieben → „Steht an“ zeigt den Vorschlag (nicht dem Business-Konto); Übernahme legt EIN Darlehen + Raten an, idempotent', async () => {
    v = await unterschreiben(v);
    const { anstehendLesen } = await import('@/lib/heute/anstehend-server');
    const hinweis = (a: Awaited<ReturnType<typeof anstehendLesen>>) => a.fristen.filter(f => f.id === `vertrag-finanzen-${v.id}`);
    const vorher = await anstehendLesen('person-a');
    expect(hinweis(vorher)).toHaveLength(1);
    expect(JSON.stringify(hinweis(vorher))).not.toMatch(/12\.000/);
    expect(hinweis(await anstehendLesen('person-c'))).toHaveLength(0);
    // Bis zum Klick steht nichts in den Finanzen.
    expect(((await db.loadJson<{ darlehen?: Darlehen[] }>('finanzen-plan--haus'))!.darlehen ?? []).some(d => d.vertragId === v.id)).toBe(false);

    const r = await fin();
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    expect(r.d.darlehenId).toMatch(/^dl-v-[0-9a-f]{16}$/);
    expect(r.d.zahlungen).toBeGreaterThanOrEqual(12);
    expect(r.d.vertrag.finanzen).toMatchObject({ darlehenId: r.d.darlehenId, geber: 'extern', nehmer: 'kdv', von: 'person-a' });
    const plan = (await db.loadJson<{ darlehen?: Darlehen[] }>('finanzen-plan--haus'))!;
    const dl = (plan.darlehen ?? []).filter(d => d.vertragId === v.id);
    expect(dl).toHaveLength(1);
    expect(dl[0]).toMatchObject({ id: r.d.darlehenId, geber: 'extern', nehmer: 'kdv', betrag: 12000, ratenAnzahl: 12, rate: 1000, zinsProzent: 3, zinsen: 'laufend', aus: 3, ratenAb: 4 });
    const fp = await db.loadJson<{ zahlungen: { id: string; firmaId: string; status: string; betrag: number; faellig: string }[] }>('finanzplan');
    const raten = fp!.zahlungen.filter(z => z.id.startsWith('dl-') && !z.id.startsWith('dl-v-'));
    expect(raten.length).toBe(r.d.zahlungen);
    expect(raten.every(z => z.firmaId === 'kdv' && z.status === 'offen' && z.betrag > 0 && z.faellig.endsWith('-15'))).toBe(true);

    expect((await fin()).d.darlehenId).toBe(r.d.darlehenId); // dieselbe anfrageId → gemerkte Antwort
    const zweit = await fin({ anfrageId: 'vtr-fin-pruef-0002' });
    expect(zweit.status).toBe(200);
    expect(zweit.d.schonDa).toBe(true);
    expect(((await db.loadJson<{ darlehen?: Darlehen[] }>('finanzen-plan--haus'))!.darlehen ?? []).filter(d => d.vertragId === v.id)).toHaveLength(1);
    expect((await db.loadJson<{ zahlungen: { id: string }[] }>('finanzplan'))!.zahlungen.filter(z => z.id.startsWith('dl-') && !z.id.startsWith('dl-v-'))).toHaveLength(raten.length);
    expect(hinweis(await anstehendLesen('person-a'))).toHaveLength(0);
  });

  it('private Seite ohne Privatzugang → 403 (Business-Sicht), nichts geschrieben', async () => {
    const { vertragInFinanzen } = await import('@/lib/vertraege/finanzen');
    const req = new Request('http://test/api/vertraege', { headers: { 'x-make-user': 'person-c' } });
    await expect(vertragInFinanzen({ haushalt: 'haus', person: 'person-c', id: v.id, geber: 'privat', nehmer: 'kdv', req })).rejects.toMatchObject({ status: 403 });
  });

  it('Karte „Darlehen“: eigene Gesellschaft sieht es mit Restschuld und Vertrag; fremder Haushalt 403; private Gegenseite neutral', async () => {
    const r = await get('http://test/api/vertraege?darlehen=kdv');
    expect(r.status).toBe(200);
    const z = r.d.darlehen.find((x: { vertragId?: string }) => x.vertragId === v.id);
    expect(z).toMatchObject({ rolle: 'nehmer', gegenseite: 'außerhalb des Plans' });
    expect(typeof z.restschuld).toBe('number');
    expect((await get('http://test/api/vertraege?darlehen=kdv', 'testkunde')).status).toBe(403);
    expect((await get('http://test/api/vertraege?darlehen=kdc', 'person-c')).d.darlehen).toEqual([]);
    const { darlehenKarte } = await import('@/lib/vertraege/finanzen');
    const { DARLEHEN_NAME_PRIVAT } = await import('@/lib/finanzen/darlehen');
    const privat: Darlehen = { id: 'dl-x', name: 'Darlehen von Person', geber: 'privat', nehmer: 'ug', betrag: 5000, aus: 1, zurueck: 10 };
    const [zeile] = darlehenKarte([privat], 'ug', planFix().monate, '2026-11-20');
    expect(zeile).toMatchObject({ name: DARLEHEN_NAME_PRIVAT, gegenseite: 'Privat', rolle: 'nehmer', restschuld: 5000 });
    expect(JSON.stringify(zeile)).not.toContain('Person');
  });

  it('beendet → offene Raten verschwinden aus der Liquidität, bezahlte bleiben', async () => {
    const fp = await db.loadJson<{ zahlungen: { id: string; status: string }[] }>('finanzplan');
    const raten = fp!.zahlungen.filter(z => z.id.startsWith('dl-') && !z.id.startsWith('dl-v-'));
    const erste = raten[0].id;
    await db.saveJson('finanzplan', { ...fp, zahlungen: fp!.zahlungen.map(z => (z.id === erste ? { ...z, status: 'bezahlt' } : z)) });
    const jetzt = await aktuell(v.id);
    const r = await post(vertraege, { aktion: 'status', id: v.id, stand: jetzt.stand, status: 'beendet' });
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    const nach = (await db.loadJson<{ zahlungen: { id: string; status: string }[] }>('finanzplan'))!.zahlungen.filter(z => z.id.startsWith('dl-') && !z.id.startsWith('dl-v-'));
    expect(nach.map(z => z.id)).toEqual([erste]);
    expect(nach[0].status).toBe('bezahlt');
  });

  it('letzte Rate nach dem Planende → 400, kein Darlehen angelegt', async () => {
    const lang = await unterschreiben(await fertig(await anlegen(idDarlehen, { ...WERTE_OK, darlehen_betrag: '24.000,00', darlehen_raten_anzahl: '30', darlehen_rate: '800,00' })));
    const r = await post(vertraege, { aktion: 'finanzen', id: lang.id, geber: 'extern', nehmer: 'kdv', anfrageId: 'vtr-fin-pruef-0003' });
    expect(r.status).toBe(400);
    expect(r.d.fehler).toMatch(/Planende/);
    expect(((await db.loadJson<{ darlehen?: Darlehen[] }>('finanzen-plan--haus'))!.darlehen ?? []).some(d => d.vertragId === lang.id)).toBe(false);
    expect((await aktuell(lang.id)).finanzen).toBeUndefined();
  });
});
