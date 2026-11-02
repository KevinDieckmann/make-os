// ─── Prüfung B „Aktive Ansprache und Versand“ (02.11.2026, Branch kg-versand) — je Fund mindestens ein Fall (vorher rot → nachher grün). ──────
// Erfundene Daten (@example.invalid), eigener Datenordner, nachgebautes Postfach (PostSpeicher), kein Netz.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PostSpeicher as PS } from '@/lib/postfach/post-speicher';
import type { Kampagne, SequenzSchritt } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-kg-versand-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-motor';
process.env.MAKE_OS_KEY = 'dienst-test-motor';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-motor-0123456789abcdef';

const D = 'example.invalid';
const PW = 'Geheim-Postfach-4711';
type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let motorRoute: R, postfaecher: R;
let db: typeof import('@/lib/store/local-db');
let T: typeof import('@/lib/postfach/transport');
let P: typeof import('@/lib/postfach/post-speicher');
let M: typeof import('@/lib/crm/kampagnen-motor');
let server: PS;

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = async (r: Response) => ({ status: r.status, text: await r.clone().text(), d: await r.json().catch(() => ({})) as Record<string, any> });
const POST = (route: R, url: string, body: unknown, h: Record<string, string> = sitzung('kevin')) => route.POST!(new Request(`http://localhost${url}`, { method: 'POST', headers: h, body: JSON.stringify(body) })).then(j);

const KONTEN = { konten: [
  { id: 'k1', speicher: 'kevin', email: `kevin@${D}`, name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  { id: 'k2', speicher: 'malin', email: `malin@${D}`, name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
], einladungen: [] };
const EINW = { kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-10-01', zeitpunkt: '2026-10-01T10:00:00.000Z', erfasstVon: 'kevin', wortlaut: 'Ja, gern per Mail.', belegRef: 'Gespräch vom 2026-10-01' };
const kontakt = (id: string, vorname: string, extra: Record<string, unknown> = {}) => ({ id, vorname, nachname: 'Beispiel', email: `${vorname.toLowerCase()}@kunde.${D}`, stufe: 'neu', aktivitaeten: [], importiertAm: '2026-10-01', ...extra });
const SEQ: SequenzSchritt[] = [
  { id: 'q1', tagAbstand: 0, kanal: 'mail', betreff: 'Kurze Frage an {{betrieb}}', text: '{{anrede}},\n\nwir haben eine Idee für {{betrieb}}.\n\nViele Grüße\n{{absender}}' },
  { id: 'q2', tagAbstand: 3, kanal: 'anruf', leitfaden: 'Bezug auf die Mail nehmen.' },
];
// Montag, 02.11.2026, 10:00 Uhr Berlin (Werktag, im Fenster) bzw. 06:00 Uhr (davor).
const MONTAG_10 = new Date('2026-11-02T09:00:00Z');
const MONTAG_06 = new Date('2026-11-02T05:00:00Z');

beforeAll(async () => {
  db = await import('@/lib/store/local-db'); T = await import('@/lib/postfach/transport'); P = await import('@/lib/postfach/post-speicher');
  M = await import('@/lib/crm/kampagnen-motor');
  motorRoute = await import('../app/api/crm/kampagnen/motor/route') as R;
  postfaecher = await import('../app/api/inbox/postfaecher/route') as R;
});
afterAll(() => { T.transportSetzen(null); rmSync(ordner, { recursive: true, force: true }); });

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  M._motorZuruecksetzen();
  vi.stubEnv('GOOGLE_CLIENT_ID', ''); vi.stubEnv('GOOGLE_CLIENT_SECRET', ''); vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubEnv('MAKE_OS_ADRESSE', `https://os.${D}`); vi.stubEnv('ANTHROPIC_API_KEY', '');
  vi.stubGlobal('fetch', async () => { throw new Error('kein Netz im Test'); });
  server = new P.PostSpeicher({ passwort: PW, ordner: [{ pfad: 'INBOX' }, { pfad: 'Gesendete Objekte' }] });
  T.transportSetzen({ imap: z => server.sitzung(z), smtp: (z, u, roh) => server.senden(z, u, roh), waechter: async () => ({ stop: async () => {} }) });
  await db.saveJson('konten', KONTEN);
  await db.saveJson('kontakte', { kontakte: [
    kontakt('c-anna-0001', 'Anna', { einwilligungen: [EINW], firma: 'Anna GmbH' }),
    kontakt('c-bert-0002', 'Bert', { einwilligungen: [EINW], werbesperre: { seit: '2026-10-02', grund: 'Widerspruch' } }),
    kontakt('c-cora-0003', 'Cora', { telefon: '+49 30 1111111' }),
    kontakt('c-dora-0004', 'Dora', { einwilligungen: [EINW], firma: 'Dora KG' }),
    kontakt('c-emil-0005', 'Emil', { einwilligungen: [EINW], eingeschraenkt: { seit: '2026-10-03', grund: 'Art. 18', von: 'kevin' } }),
  ] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', { ...leererBestand(), firmen: [{ id: 'f-betrieb', name: 'Betrieb Erfunden', rolle: 'offen', email: `info@betrieb.${D}`, telefon: '+49 30 2222222', geaendert: '2026-09-01T10:00:00.000Z' }] });
  await db.saveJson('datenschutz-einrichtung', { verantwortlicher: { name: 'Beispiel Innovation GmbH', anschrift: 'Beispielweg 1, 12345 Musterstadt', mail: `datenschutz@${D}` } });
});

async function kampagneAnlegen(k: Partial<Kampagne> = {}) {
  // Direkt in den Bestand (ohne Personen-Schranke): so steht es da, wenn eine Person NACH der Aufnahme eine Werbesperre bzw. Einschränkung bekam.
  const neu: Kampagne = { id: 'kp-test', name: 'Test-Kampagne', playbook: 'eigen', ziel: 'Gespräche', zielgruppe: {}, kanal: 'mail', status: 'aktiv', schritte: [], kontaktIds: ['c-anna-0001', 'c-bert-0002', 'c-cora-0003', 'c-dora-0004', 'c-emil-0005'], firmaIds: ['f-betrieb'], ergebnisse: [], von: 'hand', sequenz: SEQ, neuJeTag: 20, zustaendig: 'kevin', geaendert: '2026-10-01T10:00:00.000Z', ...k };
  await db.updateJson<{ kampagnen: Kampagne[] }>('crm', c => ({ ...c!, kampagnen: [...(c!.kampagnen ?? []).filter(x => x.id !== neu.id), neu] }));
}
async function postfachAnlegen(person = 'kevin') {
  const pf = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `vertrieb@firma.${D}`, passwort: PW, bereich: 'ug', anzeigename: 'Vertrieb', absenderName: 'Vertrieb Beispiel' }, sitzung(person));
  expect(pf.status, pf.text).toBe(200);
  return pf.d.id as string;
}
const kampagne = async () => (await (await import('@/lib/crm/speicher')).ladeCrm()).kampagnen.find(k => k.id === 'kp-test')!;
const stand = async (id: string) => (await kampagne()).zielStaende?.find(s => s.id === id);


const crmLaden = async () => (await import('@/lib/crm/speicher')).ladeCrm();
const fussSetzen = () => POST(motorRoute, '/api/crm/kampagnen/motor', { aktion: 'einstellungen', fusszeile: 'Beispiel Innovation GmbH · Impressum' });
async function antwortVon(email: string, x: { betreff: string; gesendet?: { messageId?: string } }, pf: string) {
  const spaeter = new Date(Date.now() + 120_000).toISOString();
  server.ablegen('INBOX', P.rohNachricht({ von: `Ziel <${email}>`, an: `vertrieb@firma.${D}`, betreff: `Re: ${x.betreff}`, text: 'Bitte anrufen.', messageId: `<antwort-${Math.random().toString(16).slice(2)}@kunde.${D}>`, inReplyTo: x.gesendet?.messageId, datum: spaeter }), { am: spaeter });
  const { imapAbgleichen } = await import('@/lib/postfach/abgleich');
  await imapAbgleichen('kevin', pf, { erzwingen: true });
}
const MI = new Date('2026-11-04T09:00:00Z');

describe('Fund 1 · Werbesperre des Betriebs', () => {
  it('faellige blendet werbliche Follow-ups des Betriebs aus — am Betrieb, an seiner Person und den Besuch der Sequenz', async () => {
    const { faellige, neuesFollowUp } = await import('@/lib/crm/followup');
    const { leererBestand } = await import('@/lib/crm/speicher');
    const fu = (id: string, extra: Record<string, unknown>) => neuesFollowUp({ id, art: 'anruf', text: 'Kampagne: Anrufen', faellig: '2026-11-02', zustaendig: 'kevin', quelle: 'kampagne', bezug: { art: 'firma', id: 'f-b' }, ...extra } as never, undefined, 'system', '2026-11-02T08:00:00Z');
    const crm = { ...leererBestand(), firmen: [{ id: 'f-b', name: 'Betrieb', werbesperre: { seit: '2026-11-01', grund: 'Abmeldelink' } }, { id: 'f-ok', name: 'Anderer Betrieb' }],
      followups: [fu('fu-ks-0000000000000001', {}), fu('fu-ks-0000000000000002', { bezug: { art: 'kontakt', id: 'c-p' }, kontaktId: 'c-p' }), fu('fu-ks-0000000000000003', { art: 'sonstig', bezug: { art: 'firma', id: 'f-b' } }),
        fu('fu-x-termin', { art: 'termin' }), fu('fu-ks-0000000000000004', { bezug: { art: 'firma', id: 'f-ok' } })] } as never;
    const kontakte = [{ id: 'c-p', vorname: 'P', nachname: 'Beispiel', firmaId: 'f-b', stufe: 'neu', aktivitaeten: [] }] as never;
    const raus: string[] = [];
    const ids = faellige(kontakte, crm, '2026-11-02', { beiSperre: f => raus.push(f.id) }).map(f => f.id);
    expect(ids.sort()).toEqual(['fu-ks-0000000000000004', 'fu-x-termin']);
    expect(raus).toHaveLength(3);
    // Sperrliste des Betriebs (vom Aufrufer geprüft)
    const crm2 = { ...(crm as object), firmen: [{ id: 'f-ok', name: 'Anderer Betrieb' }] } as never;
    expect(faellige([], crm2, '2026-11-02', { firmaGesperrt: id => id === 'f-ok' }).map(f => f.id)).not.toContain('fu-ks-0000000000000004');
  });

  it('neue Werbesperre am Betrieb (jeder Schreibweg) sagt seine werblichen Follow-ups ab; der Motor beendet die Sequenz', async () => {
    await kampagneAnlegen({ kontaktIds: [], firmaIds: ['f-betrieb'], sequenz: [{ id: 'q1', tagAbstand: 0, kanal: 'besuch', leitfaden: 'Kurz vorbeischauen.' }] });
    await M.sequenzenFortschreiben(MONTAG_10);
    const vorher = (await crmLaden()).followups!.filter(f => f.id.startsWith('fu-ks-'));
    expect(vorher).toHaveLength(1);
    expect(vorher[0]).toMatchObject({ art: 'sonstig', status: 'offen' });
    const { aendereCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(c => ({ ...c, firmen: c.firmen.map(f => (f.id === 'f-betrieb' ? { ...f, werbesperre: { seit: '2026-11-02', grund: 'Widerspruch' } } : f)) }), { art: 'person', person: 'kevin' });
    const nach = (await crmLaden()).followups!.find(f => f.id === vorher[0].id)!;
    expect(nach.status).toBe('abgesagt');
    await M.sequenzenFortschreiben(MONTAG_10);
    expect(await stand('f-betrieb')).toMatchObject({ status: 'gestoppt' });
  });

  it('Abmeldung wirkt in JEDER Kampagne mit diesem Ziel (Stand gestoppt, Follow-up abgesagt)', async () => {
    await kampagneAnlegen({ kontaktIds: ['c-anna-0001'], firmaIds: [], sequenz: [SEQ[0]] });
    await kampagneAnlegen({ id: 'kp-zwei', name: 'Zweite', kontaktIds: ['c-anna-0001'], firmaIds: [], sequenz: [{ id: 'z1', tagAbstand: 0, kanal: 'linkedin' }] });
    await M.sequenzenFortschreiben(MONTAG_10);
    const zwei = () => crmLaden().then(c => c.kampagnen.find(k => k.id === 'kp-zwei')!);
    expect((await zwei()).zielStaende?.[0]).toMatchObject({ status: 'wartet' });
    const { abmeldeToken } = await import('@/lib/datenschutz/abmelden');
    expect(await M.kampagnenAbmeldung(abmeldeToken(`anna@kunde.${D}`)!)).toBe(1);
    expect((await zwei()).zielStaende?.[0]).toMatchObject({ status: 'gestoppt', grund: 'Abmeldung' });
    expect((await crmLaden()).followups!.find(f => f.id.startsWith('fu-ks-'))?.status).toBe('abgesagt');
    expect((await M.ladePost()).eintraege[0].status).toBe('gesperrt');
  });
});

describe('Fund 2/3/9/17 · Ende eines Ziels verwirft schon Freigegebenes', () => {
  it('Antwort auf Schritt 1: Entwurf von Schritt 2 wird verworfen, nichts geht raus; Antwort steht in der Akte; zweite Kampagne stoppt', async () => {
    const SEQ2: SequenzSchritt[] = [SEQ[0], { id: 'q2', tagAbstand: 2, kanal: 'mail', betreff: 'Nachfrage', text: '{{anrede}},\n\nnoch einmal kurz.\n\n{{absender}}' }];
    await kampagneAnlegen({ kontaktIds: ['c-anna-0001'], firmaIds: [], sequenz: SEQ2 });
    await kampagneAnlegen({ id: 'kp-zwei', name: 'Zweite', kontaktIds: ['c-anna-0001'], firmaIds: [], sequenz: [{ id: 'z1', tagAbstand: 5, kanal: 'anruf' }] });
    const pf = await postfachAnlegen();
    await fussSetzen();
    await M.sequenzenFortschreiben(MONTAG_10);
    const e1 = (await M.ladePost()).eintraege[0];
    await M.stapelFreigeben({ person: 'kevin', kampagneId: 'kp-test', ids: [e1.id], postfach: pf, wer: { art: 'person', person: 'kevin' } }, MONTAG_10);
    expect((await M.versenden(MONTAG_10)).gesendet).toBe(1);
    await M.sequenzenFortschreiben(MI);
    const e2 = (await M.ladePost()).eintraege.find(x => x.schrittId === 'q2')!;
    expect(e2.status).toBe('entwurf');
    await M.stapelFreigeben({ person: 'kevin', kampagneId: 'kp-test', ids: [e2.id], postfach: pf, wer: { art: 'person', person: 'kevin' } }, MI);
    const anna = (await M.ladePost()).eintraege.find(x => x.schrittId === 'q1')!;
    await antwortVon(`anna@kunde.${D}`, anna, pf);
    expect((await M.rueckfluss(MI)).antworten).toBe(1);
    expect((await M.ladePost()).eintraege.find(x => x.id === e2.id)?.status).toBe('verworfen');
    const vorher = server.gesendet.length;
    await M.versenden(new Date('2026-11-04T10:00:00Z'));
    expect(server.gesendet.length).toBe(vorher);
    // Akte: Aktivität „antwort“ mit Betreff, letzter Kontakt gesetzt — idempotent.
    await M.rueckfluss(MI);
    const k = (await db.loadJson<{ kontakte: { id: string; aktivitaeten: { art: string; text?: string }[]; letzterKontakt?: string }[] }>('kontakte'))!.kontakte.find(x => x.id === 'c-anna-0001')!;
    expect(k.aktivitaeten.filter(a => a.art === 'antwort')).toHaveLength(1);
    expect(k.aktivitaeten.find(a => a.art === 'antwort')?.text).toMatch(/Antwort auf Kampagnen-Mail: Re:/);
    expect(k.letzterKontakt).toBeTruthy();
    // Die zweite Kampagne endet für Anna (keine zweite Ansprache nach einer Antwort).
    expect((await crmLaden()).kampagnen.find(x => x.id === 'kp-zwei')!.zielStaende?.[0]).toMatchObject({ status: 'gestoppt' });
  });

  it('Ziel aus der Kampagne genommen bzw. Schritt entfernt: freigegebene Mail wird verworfen, nicht gesendet', async () => {
    await kampagneAnlegen({ kontaktIds: ['c-anna-0001', 'c-dora-0004'], firmaIds: [] });
    const pf = await postfachAnlegen();
    await fussSetzen();
    await M.sequenzenFortschreiben(MONTAG_06);
    const ids = (await M.ladePost()).eintraege.map(x => x.id);
    await M.stapelFreigeben({ person: 'kevin', kampagneId: 'kp-test', ids, postfach: pf, wer: { art: 'person', person: 'kevin' } }, MONTAG_06);
    await db.updateJson<{ kampagnen: Kampagne[] }>('crm', c => ({ ...c!, kampagnen: c!.kampagnen.map(k => ({ ...k, kontaktIds: ['c-dora-0004'] })) }));
    // Auch OHNE Fortschreiben dazwischen prüft der Versand selbst (Stand + Liste).
    const v = await M.versenden(MONTAG_10);
    expect(v.gesendet).toBe(1);
    const post = await M.ladePost();
    expect(post.eintraege.find(x => x.ziel.id === 'c-anna-0001')?.status).toBe('verworfen');
    expect(Object.values(post.tage).reduce((a, b) => a + b, 0)).toBe(1); // die verworfene verbraucht kein Kontingent
    // Fortschreiben beendet den Stand und verwirft, was noch offen ist.
    await M.sequenzenFortschreiben(MONTAG_10);
    expect(await stand('c-anna-0001')).toMatchObject({ status: 'gestoppt' });
  });

  it('rein: schonAngeschrieben zählt eine Mail einer ANDEREN Kampagne der letzten 30 Tage', async () => {
    const x = (kampagneId: string, am: string) => ({ id: `km-${kampagneId}`, kampagneId, ziel: { art: 'kontakt', id: 'c-a' }, schrittId: 'q1', kanal: 'mail', an: { name: 'A' }, betreff: '', text: '', status: 'gesendet', gesendet: { am }, angelegt: am, geaendert: am }) as never;
    expect(M.schonAngeschrieben({ id: 'kp-b' }, [x('kp-a', '2026-10-20T10:00:00Z')], [], '2026-11-02').has('kontakt:c-a')).toBe(true);
    expect(M.schonAngeschrieben({ id: 'kp-b' }, [x('kp-a', '2026-09-20T10:00:00Z')], [], '2026-11-02').has('kontakt:c-a')).toBe(false);
  });
});

describe('Fund 4/16 · vorübergehende Sendefehler, Drossel', () => {
  it('Verbindung weg: bleibt freigegeben, Kontingent zurück, Rückoff, EINE Glocke je Tag an die freigebende Person', async () => {
    await kampagneAnlegen({ kontaktIds: ['c-anna-0001'], firmaIds: [] });
    const pf = await postfachAnlegen();
    await fussSetzen();
    await M.sequenzenFortschreiben(MONTAG_10);
    const ids = (await M.ladePost()).eintraege.map(x => x.id);
    await M.stapelFreigeben({ person: 'kevin', kampagneId: 'kp-test', ids, postfach: pf, wer: { art: 'person', person: 'kevin' } });
    const { PostfachFehler } = await import('@/lib/postfach/transport');
    T.transportSetzen({ imap: z => server.sitzung(z), smtp: async () => { throw new PostfachFehler('netz', 'Der Server des Anbieters ist gerade nicht erreichbar.'); }, waechter: async () => ({ stop: async () => {} }) });
    const v = await M.versenden(MONTAG_10);
    expect(v).toMatchObject({ gesendet: 0, spaeter: 1 });
    let post = await M.ladePost();
    const e = post.eintraege[0];
    expect(e).toMatchObject({ status: 'freigegeben', versuche: 1 });
    expect(e.hinweis).toMatch(/vorübergehend/);
    expect(e.naechsterVersuch! > MONTAG_10.toISOString()).toBe(true);
    expect(Object.values(post.tage).reduce((a, b) => a + b, 0)).toBe(0);
    const person = e.freigabe!.von;
    const glocke = async () => ((await db.loadJson<{ meldungen?: { titel: string }[]; eintraege?: { titel: string }[] }>(`meldungen--${person}`)) ?? {}) as Record<string, { titel: string }[]>;
    const titel = (g: Record<string, { titel: string }[]>) => Object.values(g).flat().filter(m => m && typeof m === 'object' && /Kampagnen-Versand hakt/.test(m.titel ?? ''));
    expect(titel(await glocke())).toHaveLength(1);
    // Vor dem Rückoff: kein neuer Versuch; danach erneut — immer noch eine Glocke.
    expect((await M.versenden(MONTAG_10)).spaeter).toBe(0);
    await db.updateJson<{ eintraege: { naechsterVersuch?: string }[] }>('kampagnen-post--h', c => ({ ...c!, eintraege: c!.eintraege.map(x => ({ ...x, naechsterVersuch: '2026-11-01T00:00:00.000Z' })) }));
    expect((await M.versenden(MONTAG_10)).spaeter).toBe(1);
    expect(titel(await glocke())).toHaveLength(1);
    // Verbindung wieder da → gesendet.
    T.transportSetzen({ imap: z => server.sitzung(z), smtp: (z, u, roh) => server.senden(z, u, roh), waechter: async () => ({ stop: async () => {} }) });
    await db.updateJson<{ eintraege: { naechsterVersuch?: string }[] }>('kampagnen-post--h', c => ({ ...c!, eintraege: c!.eintraege.map(x => ({ ...x, naechsterVersuch: '2026-11-01T00:00:00.000Z' })) }));
    expect((await M.versenden(MONTAG_10)).gesendet).toBe(1);
    post = await M.ladePost();
    expect(post.eintraege[0].hinweis).toBeUndefined();
  });

  it('rein: Fehlerarten und Kontingent je Stunde', async () => {
    const { sendefehlerArt, stundenKontingent } = await import('@/lib/crm/kampagnen-post');
    expect(sendefehlerArt({ status: 502, body: { code: 'versand', ursache: 'netz' } })).toBe('vorlaeufig');
    expect(sendefehlerArt({ status: 409, body: { code: 'versand', ursache: 'anmeldung' } })).toBe('vorlaeufig');
    expect(sendefehlerArt({ status: 429, body: {} })).toBe('vorlaeufig');
    expect(sendefehlerArt({ status: 502, body: { code: 'versand', ursache: 'zeit' } })).toBe('unklar');
    expect(sendefehlerArt({ status: 502, body: { geworfen: true } })).toBe('unklar');
    expect(sendefehlerArt({ status: 400, body: { code: 'adresse' } })).toBe('endgueltig');
    expect(sendefehlerArt({ status: 502, body: { code: 'versand', ursache: 'abgelehnt' } })).toBe('endgueltig');
    expect(sendefehlerArt({ status: 409, body: { code: 'uwg' } })).toBe('sperre');
    // 30 je Tag, 10 Uhr (8 Fensterstunden übrig) → 4 in dieser Stunde
    expect(stundenKontingent({ tagesgrenze: 30, heuteGesendet: 0, dieseStunde: 0, stunde: 10 })).toBe(4);
    expect(stundenKontingent({ tagesgrenze: 30, heuteGesendet: 4, dieseStunde: 4, stunde: 10 })).toBe(0);
    expect(stundenKontingent({ tagesgrenze: 30, heuteGesendet: 20, dieseStunde: 0, stunde: 17 })).toBe(10);
  });
});

describe('Fund 7/15 · Lage beim Freigeben und Senden neu prüfen', () => {
  it('Adresse geändert nach der Freigabe: zurück in den Entwurf mit Hinweis (neue Adresse), Ziel läuft weiter', async () => {
    await kampagneAnlegen({ kontaktIds: ['c-anna-0001'], firmaIds: [] });
    const pf = await postfachAnlegen();
    await fussSetzen();
    await M.sequenzenFortschreiben(MONTAG_10);
    const ids = (await M.ladePost()).eintraege.map(x => x.id);
    await M.stapelFreigeben({ person: 'kevin', kampagneId: 'kp-test', ids, postfach: pf, wer: { art: 'person', person: 'kevin' } });
    await db.updateJson<{ kontakte: Record<string, unknown>[] }>('kontakte', c => ({ kontakte: c!.kontakte.map(x => (x.id === 'c-anna-0001' ? { ...x, email: `anna.neu@kunde.${D}` } : x)) }));
    const v = await M.versenden(MONTAG_10);
    expect(v).toMatchObject({ gesendet: 0, gesperrt: 0, spaeter: 1 });
    const e = (await M.ladePost()).eintraege[0];
    expect(e).toMatchObject({ status: 'entwurf', an: { email: `anna.neu@kunde.${D}` } });
    expect(e.freigabe).toBeUndefined();
    expect(e.hinweis).toMatch(/Adresse/);
    await M.sequenzenFortschreiben(MONTAG_10);
    expect(await stand('c-anna-0001')).toMatchObject({ status: 'wartet' });
  });

  it('Freigabe prüft die Lage von JETZT: Werbesperre nach dem Anlegen → 409, nichts freigegeben', async () => {
    await kampagneAnlegen({ kontaktIds: ['c-anna-0001'], firmaIds: [] });
    const pf = await postfachAnlegen();
    await M.sequenzenFortschreiben(MONTAG_10);
    const ids = (await M.ladePost()).eintraege.map(x => x.id);
    await db.updateJson<{ kontakte: Record<string, unknown>[] }>('kontakte', c => ({ kontakte: c!.kontakte.map(x => (x.id === 'c-anna-0001' ? { ...x, einwilligungen: [] } : x)) }));
    const r = await M.stapelFreigeben({ person: 'kevin', kampagneId: 'kp-test', ids, postfach: pf, wer: { art: 'person', person: 'kevin' } }).catch(e => e as Error & { status?: number });
    expect((r as { status?: number }).status).toBe(409);
    expect((await M.ladePost()).eintraege[0].status).toBe('entwurf');
  });
});

describe('Fund 5 · Motor mit Wache', () => {
  it('Herzschlag je Teil; HOI-Befund rot, wenn er steht oder ein Teil wiederholt scheitert', async () => {
    await kampagneAnlegen({ kontaktIds: ['c-anna-0001'], firmaIds: [] });
    await M.motorImTakt(MONTAG_06, { sofort: true });
    const lauf = await db.loadJson<{ zuletzt: string; teile: Record<string, { ok?: string }> }>('kampagnen-motor-lauf');
    expect(lauf?.zuletzt).toBe(MONTAG_06.toISOString());
    expect(Object.keys(lauf!.teile).sort()).toEqual(['aufraeumen', 'fortschreiben', 'rueckfluss', 'versand', 'willkommen', 'willkommen-rueckfluss']);
    const { kampagnenMotorBefunde } = await import('@/lib/hoi/lage');
    const basis = { zuletzt: 'x', minutenSeit: 3, fehlerTeile: [], freigegeben: 0, fehler: 0, unklar: 0, sequenzen: 1 };
    expect(kampagnenMotorBefunde(basis)[0].ampel).toBe('gruen');
    expect(kampagnenMotorBefunde({ ...basis, minutenSeit: 90 })[0].ampel).toBe('rot');
    expect(kampagnenMotorBefunde({ ...basis, fehlerTeile: [{ teil: 'versand', n: 3 }] })[0].ampel).toBe('rot');
    expect(kampagnenMotorBefunde({ ...basis, fehler: 2 })[0].ampel).toBe('gelb');
    expect(kampagnenMotorBefunde(null)).toEqual([]);
    expect(JSON.stringify(await M.kampagnenMotorLage())).not.toMatch(/anna|kunde/i);
  });
});

describe('Fund 13/14/18 · Kleines', () => {
  it('Trichter je Schritt zählt Ergebnisse von Betrieben ohne Person', async () => {
    const { kennzahlenJeSchritt } = await import('@/lib/crm/sequenz');
    const k = { sequenz: SEQ, ergebnisse: [], firmenErgebnisse: [{ firmaId: 'f-a', ergebnis: 'chance', am: '2026-11-02' }],
      zielStaende: [{ art: 'firma', id: 'f-a', schritt: 0, schrittId: 'q1', faelligAm: '2026-11-02', status: 'reagiert', verlauf: [{ am: '2026-11-02T09:00:00Z', was: 'gesendet', schritt: 'q1' }] }] } as unknown as Kampagne;
    expect(kennzahlenJeSchritt(k)[0]).toMatchObject({ erreicht: 1, reagiert: 1, gespraech: 1, chance: 1 });
  });

  it('„Als Lead übernehmen“: schließt „Antwort bearbeiten“, zweiter Klick hält nichts doppelt fest', async () => {
    await kampagneAnlegen({ kontaktIds: [], firmaIds: ['f-betrieb'] });
    const { postEintragId, antwortFollowupId } = await import('@/lib/crm/kampagnen-post');
    const { neuesFollowUp } = await import('@/lib/crm/followup');
    const id = postEintragId('kp-test', { art: 'firma', id: 'f-betrieb' }, 'q1');
    await M.aenderePost(b => ({ ...b, eintraege: [{ id, kampagneId: 'kp-test', ziel: { art: 'firma', id: 'f-betrieb' }, schrittId: 'q1', kanal: 'mail', an: { email: `info@betrieb.${D}`, name: 'Betrieb Erfunden' }, betreff: 'x', text: 'x', status: 'gesendet', rueckfluss: { art: 'antwort', am: '2026-11-02T10:00:00.000Z' }, angelegt: '', geaendert: '' }] }));
    const fu = antwortFollowupId(id);
    await db.updateJson<{ followups?: unknown[] }>('crm', c => ({ ...c!, followups: [neuesFollowUp({ id: fu, bezug: { art: 'firma', id: 'f-betrieb' }, art: 'mail', text: 'Antwort bearbeiten', faellig: '2026-11-02', zustaendig: 'kevin', quelle: 'kampagne' }, undefined, 'system', '2026-11-02T10:00:00Z')] }));
    const [a, b] = await Promise.all([
      POST(motorRoute, '/api/crm/kampagnen/motor', { aktion: 'als-lead', followupId: fu }),
      POST(motorRoute, '/api/crm/kampagnen/motor', { aktion: 'als-lead', followupId: fu }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect([a.d.schon, b.d.schon].filter(Boolean)).toHaveLength(1);
    const crm = await crmLaden();
    expect(crm.followups!.find(f => f.id === fu)).toMatchObject({ status: 'erledigt', ergebnis: 'chance' });
    expect(crm.kampagnen[0].firmenErgebnisse!.filter(e => e.ergebnis === 'chance')).toHaveLength(1);
  });

  it('„unklar“: gesendete Kopie im Spiegel → gesendet; „Erneut vorbereiten“ nur mit Bestätigung', async () => {
    const { gesendeteKopie } = await import('@/lib/crm/kampagnen-motor');
    const x = { an: { email: `anna@kunde.${D}`, name: 'Anna' }, betreff: 'Kurze Frage', sendetSeit: '2026-11-02T09:00:00.000Z', geaendert: '2026-11-02T09:00:00.000Z' };
    const kopf = (o: Record<string, unknown>) => ({ id: 'g1', threadId: 't1', am: '2026-11-02T09:00:05.000Z', von: { email: `vertrieb@firma.${D}` }, betreff: 'Kurze Frage', ausschnitt: '', labels: ['SENT'], an: [{ email: `anna@kunde.${D}` }], ...o }) as never;
    expect(gesendeteKopie(x, [kopf({})])).toBeTruthy();
    expect(gesendeteKopie(x, [kopf({ betreff: 'Anderes' })])).toBeNull();
    expect(gesendeteKopie(x, [kopf({ labels: ['INBOX'] })])).toBeNull();
    await kampagneAnlegen({ kontaktIds: ['c-anna-0001'], firmaIds: [] });
    const id = 'km-0123456789abcdef';
    await M.aenderePost(b => ({ ...b, eintraege: [{ id, kampagneId: 'kp-test', ziel: { art: 'kontakt', id: 'c-anna-0001' }, schrittId: 'q1', kanal: 'mail', an: { email: `anna@kunde.${D}`, name: 'Anna' }, betreff: 'x', text: 'x', status: 'unklar', sendetSeit: '2026-11-02T09:00:00.000Z', freigabe: { von: 'kevin', am: '2026-11-02T08:00:00.000Z', postfach: 'pf-x' }, angelegt: '', geaendert: '' }] }));
    const ohne = await POST(motorRoute, '/api/crm/kampagnen/motor', { aktion: 'erneut', kampagneId: 'kp-test', ids: [id] });
    expect(ohne.status).toBe(409);
    expect(ohne.d.rueckfrage).toBe(true);
    const mit = await POST(motorRoute, '/api/crm/kampagnen/motor', { aktion: 'erneut', kampagneId: 'kp-test', ids: [id], bestaetigt: true });
    expect(mit.status, mit.text).toBe(200);
    expect((await M.ladePost()).eintraege[0].status).toBe('entwurf');
  });

  it('Willkommen: gescheiterte Stufe kommt nicht automatisch wieder; Funde-Kampagne nicht aktiv → ehrlicher Hinweis', async () => {
    const { willkommenFaellig } = await import('@/lib/crm/willkommen');
    // Seit R2-4 (Fund 5): nach einer gescheiterten Stufe steht die Strecke, bis „erneut“/„überspringen“ entschieden ist (tests/kg-nach.test.ts).
    expect(willkommenFaellig([{ tag: 0 }, { tag: 3 }], '2026-10-20', [], '2026-11-02', [0])).toBeNull();
    expect(willkommenFaellig([{ tag: 0 }, { tag: 3 }], '2026-10-20', [], '2026-11-02', [], [0])).toBe(1);
    expect(willkommenFaellig([{ tag: 0 }], '2026-10-20', [], '2026-11-02', [0])).toBeNull();
    // Freigegebene Mail einer nicht (mehr) aktiven Kampagne trägt den Grund
    await kampagneAnlegen({ kontaktIds: ['c-anna-0001'], firmaIds: [] });
    const pf = await postfachAnlegen();
    await fussSetzen();
    await M.sequenzenFortschreiben(MONTAG_10);
    await M.stapelFreigeben({ person: 'kevin', kampagneId: 'kp-test', ids: (await M.ladePost()).eintraege.map(x => x.id), postfach: pf, wer: { art: 'person', person: 'kevin' } });
    await db.updateJson<{ kampagnen: Kampagne[] }>('crm', c => ({ ...c!, kampagnen: c!.kampagnen.map(k => ({ ...k, status: 'entwurf' as const })) }));
    expect((await M.versenden(MONTAG_10)).gesendet).toBe(0);
    expect((await M.ladePost()).eintraege[0].hinweis).toMatch(/nicht aktiv/);
  });
});

describe('Fund 8/11 · Antworten im ganzen Haushalt, auch auf Willkommens-Mails', () => {
  const PF_M = 'pf-00000000-0000-4000-8000-0000000000aa', PF_P = 'pf-00000000-0000-4000-8000-0000000000bb';
  const kopf = (id: string, pf: string, von: string, am: string, betreff: string) => ({ id: `${pf}:e:1:${id}`, postfachId: pf, threadId: `t-${id}`, am, von: { email: von }, an: [{ email: `info@firma.${D}` }], betreff, ausschnitt: '', labels: [], ordner: 'e' });
  async function spiegelMalin(von: string, am: string, betreff = 'Re: Frage') {
    await db.saveJson('postfaecher--malin', { v: 1, postfaecher: [
      { id: PF_M, quelle: 'imap', bereich: 'ug', anzeigename: 'Team', adresse: `info@firma.${D}` },
      { id: PF_P, quelle: 'imap', bereich: 'privat', anzeigename: 'Privat', adresse: `malin@privat.${D}` },
    ] });
    await db.saveJson('imap-stand--malin', { v: 1, person: 'malin', postfaecher: {}, koepfe: {
      a: kopf('1', PF_M, von, am, betreff),
    } });
  }

  it('Antwort im Business-Postfach einer anderen Person zählt; im Privat-Postfach nie', async () => {
    await kampagneAnlegen({ kontaktIds: ['c-anna-0001'], firmaIds: [] });
    const id = 'km-00000000000000aa';
    await M.aenderePost(b => ({ ...b, eintraege: [{ id, kampagneId: 'kp-test', ziel: { art: 'kontakt', id: 'c-anna-0001' }, schrittId: 'q1', kanal: 'mail', an: { email: `anna@kunde.${D}`, name: 'Anna' }, betreff: 'Frage', text: 'x', status: 'gesendet', gesendet: { am: '2026-11-02T09:00:00.000Z' }, freigabe: { von: 'kevin', am: '2026-11-02T08:00:00.000Z', postfach: 'pf-x' }, angelegt: '', geaendert: '' }] }));
    // Privat-Postfach: zählt nicht.
    await db.saveJson('postfaecher--malin', { v: 1, postfaecher: [{ id: PF_P, quelle: 'imap', bereich: 'privat', anzeigename: 'Privat', adresse: `malin@privat.${D}` }] });
    await db.saveJson('imap-stand--malin', { v: 1, person: 'malin', postfaecher: {}, koepfe: { a: kopf('1', PF_P, `anna@kunde.${D}`, '2026-11-02T11:00:00.000Z', 'Re: Frage') } });
    expect((await M.rueckfluss(MONTAG_10)).antworten).toBe(0);
    // Business-Postfach: zählt.
    await spiegelMalin(`anna@kunde.${D}`, '2026-11-02T11:00:00.000Z');
    expect((await M.rueckfluss(MONTAG_10)).antworten).toBe(1);
    expect((await M.ladePost()).eintraege[0].rueckfluss?.art).toBe('antwort');
  });

  it('Antwort auf eine Willkommens-Mail → Follow-up „Antwort bearbeiten“ an Marketing, Aktivität in der Akte; idempotent', async () => {
    await M.aenderePost(b => ({ ...b, willkommen: { 'c-anna-0001': { start: '2026-10-20', gesendet: [0], mails: [{ stufe: 0, am: '2026-11-02T09:00:00.000Z', von: 'kevin' }] } } }));
    await spiegelMalin(`anna@kunde.${D}`, '2026-11-02T12:00:00.000Z', 'Re: Danke für Ihr Interesse');
    const { willkommenRueckfluss } = await import('@/lib/crm/willkommen');
    expect(await willkommenRueckfluss(MONTAG_10)).toBe(1);
    expect(await willkommenRueckfluss(MONTAG_10)).toBe(0);
    const fu = (await crmLaden()).followups!.filter(f => f.id.startsWith('fu-kw-'));
    expect(fu).toHaveLength(1);
    expect(fu[0]).toMatchObject({ kontaktId: 'c-anna-0001', status: 'offen', text: 'Antwort bearbeiten: Willkommens-Mail' });
    const k = (await db.loadJson<{ kontakte: { id: string; aktivitaeten: { art: string; text?: string }[] }[] }>('kontakte'))!.kontakte.find(x => x.id === 'c-anna-0001')!;
    expect(k.aktivitaeten.some(a => a.art === 'antwort' && /Willkommens-Mail/.test(a.text ?? ''))).toBe(true);
  });
});
