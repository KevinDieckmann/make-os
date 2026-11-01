// ─── Welle A · Kampagnen-Motor (31.10.2026, lib/crm/sequenz.ts, kampagnen-post.ts, kampagnen-motor.ts) ──────────────────────────────────
// Rein: Zeitfenster/Drossel, Platzhalter (unbekannt bzw. ohne Wert = kein Versand), Pflicht-Fußzeile mit Abmeldelink, Köpfe List-Unsubscribe(-Post),
// Sequenz takten, Rückfluss erkennen, Ampel Brief/Besuch. Von Ende zu Ende mit nachgebautem Postfach (PostSpeicher), eigenem Datenordner, erfundenen
// Daten (@example.invalid): Leitplanken (Werbesperre/Art. 18/rote Ampel nie im Stapel), Sammelfreigabe nur per Sitzung (Dienstweg 403), „eigenes
// Risiko“ nur mit Schalter, gedrosselter Versand im Zeitfenster, Rückfluss idempotent (Antwort, Abmeldung), Follow-up für den Anruf-Schritt.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PostSpeicher as PS } from '@/lib/postfach/post-speicher';
import type { Kampagne, SequenzSchritt } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-motor-'));
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
const dienst = { 'x-make-key': 'dienst-test-motor', 'x-make-person': 'kevin', 'content-type': 'application/json' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = async (r: Response) => ({ status: r.status, text: await r.clone().text(), d: await r.json().catch(() => ({})) as Record<string, any> });
const GET = (url: string, h: Record<string, string> = sitzung('kevin')) => motorRoute.GET!(new Request(`http://localhost${url}`, { headers: h })).then(j);
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

// ── Rein ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Regeln (rein)', () => {
  it('Zeitfenster: werktags 8–18 Uhr Berlin, nicht am Sonntag/Feiertag, nicht vor 8 oder ab 18', async () => {
    const { imZeitfenster } = await import('@/lib/crm/kampagnen-post');
    expect(imZeitfenster(MONTAG_10)).toBe(true);
    expect(imZeitfenster(MONTAG_06)).toBe(false);
    expect(imZeitfenster(new Date('2026-11-02T17:00:00Z'))).toBe(false); // 18:00 Berlin
    expect(imZeitfenster(new Date('2026-11-01T10:00:00Z'))).toBe(false); // Sonntag
    expect(imZeitfenster(new Date('2026-12-25T10:00:00Z'))).toBe(false); // Feiertag
  });

  it('Platzhalter: unbekannt bzw. ohne Wert = Fehler; vorschauLink/abmeldeLink bleiben für den Versand', async () => {
    const { entwurfFuellen, platzhalterWerte } = await import('@/lib/crm/kampagnen-post');
    const w = platzhalterWerte({ vorname: 'Anna', nachname: 'Beispiel', betrieb: 'Anna GmbH', heute: '2026-11-02' });
    const gut = entwurfFuellen({ betreff: 'Hallo {{betrieb}}', text: '{{anrede}}, siehe {{vorschauLink}}' }, w);
    expect(gut.fehler).toBeUndefined();
    expect(gut.betreff).toBe('Hallo Anna GmbH');
    expect(gut.text).toContain('Guten Tag Anna Beispiel, siehe {{vorschauLink}}');
    expect(entwurfFuellen({ betreff: 'x', text: '{{unbekannt}}' }, w).fehler).toMatch(/unbekannt/);
    expect(entwurfFuellen({ betreff: 'x', text: 'Was fehlt: {{befund}}' }, w).fehler).toMatch(/befund/);
  });

  it('Pflicht-Fußzeile: Absender/Impressum, Art.-14-Hinweis bei Fremddaten, Abmeldelink; Rest-Platzhalter blockieren', async () => {
    const { mailFertig, ART14_VORGABE } = await import('@/lib/crm/kampagnen-post');
    const f = mailFertig('Hallo', { abmeldeLink: `https://os.${D}/abmelden/a1-x`, fusszeile: 'Beispiel GmbH · Impressum', art14: ART14_VORGABE });
    expect(f.fehler).toBeUndefined();
    expect(f.text).toMatch(/Beispiel GmbH · Impressum/);
    expect(f.text).toMatch(/Art\. 14/);
    expect(f.text).toContain(`Hier abmelden: https://os.${D}/abmelden/a1-x`);
    expect(mailFertig('{{vorschauLink}}', { abmeldeLink: 'https://x/abmelden/a1-y', fusszeile: 'F' }).fehler).toMatch(/Vorschau/);
    expect(mailFertig('{{befund}}', { abmeldeLink: 'https://x/abmelden/a1-y', fusszeile: 'F' }).fehler).toMatch(/Platzhalter/);
  });

  it('Köpfe List-Unsubscribe + List-Unsubscribe-Post (RFC 8058); ungültiger Link wirft', async () => {
    const { mimeBauen } = await import('@/lib/gmail/mime');
    const roh = mimeBauen({ von: { email: `a@${D}` }, an: [{ email: `b@${D}` }], betreff: 'x', text: 'y', listeAbmelden: { link: `https://os.${D}/abmelden/a1-0123` } });
    expect(roh).toContain(`List-Unsubscribe: <https://os.${D}/abmelden/a1-0123>`);
    expect(roh).toContain('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
    expect(() => mimeBauen({ von: { email: `a@${D}` }, an: [{ email: `b@${D}` }], betreff: 'x', text: 'y', listeAbmelden: { link: 'javascript:alert(1)' } })).toThrow();
  });

  it('Sequenz: Prüfung (Platzhalter 400, Grenze 413), Start je Tag gedeckelt, weiter → fertig, Kennzahlen je Schritt', async () => {
    const S = await import('@/lib/crm/sequenz');
    expect(S.sequenzPruefen([{ kanal: 'mail', tagAbstand: 0, betreff: 'x', text: '{{gibtsnicht}}' }]).map(f => f.status)).toContain(400);
    expect(S.sequenzPruefen(Array.from({ length: 13 }, () => ({ kanal: 'anruf', tagAbstand: 1 })))[0].status).toBe(413);
    expect(S.sequenzPruefen(SEQ)).toEqual([]);
    const k = { id: 'k', status: 'aktiv', sequenz: SEQ, kontaktIds: ['c-a', 'c-b', 'c-c'], neuJeTag: 2, ergebnisse: [] } as unknown as Kampagne;
    const r = S.staendeStarten(k, '2026-11-02', '2026-11-02T09:00:00.000Z');
    expect(r.neu).toBe(2);
    expect(S.staendeStarten({ ...k, zielStaende: r.staende }, '2026-11-02', '2026-11-02T10:00:00.000Z').neu).toBe(0);
    let s = r.staende[0];
    s = S.weiter(k, S.wartet(s, 'x', 'entwurf', 'q1'), '2026-11-02', '2026-11-02T11:00:00.000Z', 'gesendet');
    expect(s).toMatchObject({ schritt: 1, status: 'offen', faelligAm: '2026-11-05' });
    s = S.weiter(k, s, '2026-11-05', '2026-11-05T11:00:00.000Z', 'erledigt');
    expect(s.status).toBe('fertig');
    expect(S.kennzahlenJeSchritt({ ...k, zielStaende: [s] }).map(x => x.erreicht)).toEqual([1, 1]);
  });

  it('Rückfluss erkennen: Antwort über Adresse/Thread, Rückläufer über mailer-daemon, Abwesenheit zählt nicht', async () => {
    const { rueckflussArt } = await import('@/lib/crm/kampagnen-post');
    const e = { an: { email: `anna@kunde.${D}`, name: 'Anna' }, gesendet: { am: '2026-11-02T09:00:00.000Z', messageId: '<m1@x>', threadId: 't1' } };
    const k = (x: Record<string, unknown>) => ({ id: 'k', threadId: 't9', am: '2026-11-02T10:00:00.000Z', von: { email: `anna@kunde.${D}` }, betreff: 'Re: Frage', ausschnitt: '', labels: [], ...x });
    expect(rueckflussArt(e, k({}), [])).toBe('antwort');
    expect(rueckflussArt(e, k({ am: '2026-11-02T08:00:00.000Z' }), [])).toBeNull();
    expect(rueckflussArt(e, k({ von: { email: 'mailer-daemon@mail.example.invalid' }, betreff: 'Undelivered Mail', threadId: 't1' }), [])).toBe('bounce');
    expect(rueckflussArt(e, k({ betreff: 'Automatische Antwort: Abwesend', automatisch: true }), [])).toBeNull();
    expect(rueckflussArt(e, k({ von: { email: `fremd@${D}` } }), [])).toBeNull();
  });

  it('Ampel: Brief grün, Besuch gelb, mit Werbesperre beide rot', async () => {
    const { kanalStatus } = await import('@/lib/crm/recht');
    const k = kontakt('c-x', 'Xaver') as never;
    expect(kanalStatus(k, 'brief').farbe).toBe('gruen');
    expect(kanalStatus(k, 'besuch').farbe).toBe('gelb');
    const gesperrt = { ...kontakt('c-y', 'Yara'), werbesperre: { seit: '2026-10-01' } } as never;
    expect(kanalStatus(gesperrt, 'brief').farbe).toBe('rot');
    expect(kanalStatus(gesperrt, 'besuch').farbe).toBe('rot');
  });
});

// ── Von Ende zu Ende ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Motor von Ende zu Ende', () => {
  it('Leitplanken: Werbesperre, Art. 18 und rote Ampel nie im Stapel; gelb/grün als Entwurf; Anruf-Schritt wird ein Follow-up', async () => {
    await kampagneAnlegen();
    const r = await M.sequenzenFortschreiben(MONTAG_10);
    expect(r.entwuerfe).toBe(2); // Anna + Dora
    const post = await M.ladePost();
    expect(post.eintraege.map(x => x.ziel.id).sort()).toEqual(['c-anna-0001', 'c-dora-0004']);
    // Bert (Werbesperre) und Emil (Art. 18) starten gar nicht erst.
    expect(await stand('c-bert-0002')).toBeUndefined();
    expect(await stand('c-emil-0005')).toBeUndefined();
    // Cora ohne Einwilligung (rot) und der Betrieb (rot) überspringen die Mail — der Anruf kommt in 3 Tagen.
    expect(await stand('c-cora-0003')).toMatchObject({ schritt: 1, status: 'offen', faelligAm: '2026-11-05' });
    expect(await stand('f-betrieb')).toMatchObject({ schritt: 1, status: 'offen' });
    // Idempotent: ein zweiter Lauf legt nichts doppelt an.
    expect((await M.sequenzenFortschreiben(MONTAG_10)).entwuerfe).toBe(0);
    // Eine Werbesperre NACH dem Start stoppt beim Versand: der Entwurf geht nie raus.
    await db.updateJson<{ kontakte: Record<string, unknown>[] }>('kontakte', c => ({ kontakte: c!.kontakte.map(x => (x.id === 'c-dora-0004' ? { ...x, werbesperre: { seit: '2026-11-02', grund: 'Widerspruch' } } : x)) }));
    const pf = await postfachAnlegen();
    await POST(motorRoute, '/api/crm/kampagnen/motor', { aktion: 'einstellungen', fusszeile: 'Beispiel Innovation GmbH · Impressum' });
    const dora = (await M.ladePost()).eintraege.find(x => x.ziel.id === 'c-dora-0004')!;
    // Seit 02.11. (B-Prüfung, Fund 15) prüft schon die Freigabe die Lage von jetzt: Werbesperre → 409, nichts freigegeben.
    await expect(M.stapelFreigeben({ person: 'kevin', kampagneId: 'kp-test', ids: [dora.id], postfach: pf, wer: { art: 'person', person: 'kevin' } })).rejects.toMatchObject({ status: 409 });
    expect((await M.versenden(MONTAG_10)).gesendet).toBe(0);
    expect(server.gesendet).toHaveLength(0);
    await M.sequenzenFortschreiben(MONTAG_10);
    expect(await stand('c-dora-0004')).toMatchObject({ status: 'gestoppt' });
    expect((await M.ladePost()).eintraege.find(x => x.id === dora.id)?.status).toBe('verworfen');
    // Tag 3: Cora (kalt, Telefon rot, kein „eigenes Risiko“) wird übersprungen — kein Kaltanruf.
    await M.sequenzenFortschreiben(new Date('2026-11-05T09:00:00Z'));
    expect((await stand('c-cora-0003'))?.status).toBe('fertig');
    expect(((await (await import('@/lib/crm/speicher')).ladeCrm()).followups ?? []).filter(f => f.id.startsWith('fu-ks-'))).toHaveLength(0);
  });

  it('Sammelfreigabe: Dienstweg 403, per Sitzung ok; Versand nur im Fenster, gedrosselt, mit Abmeldelink und List-Unsubscribe; danach Follow-up für den Anruf', async () => {
    await kampagneAnlegen({ kontaktIds: ['c-anna-0001', 'c-dora-0004'], firmaIds: [] });
    const pf = await postfachAnlegen();
    await M.sequenzenFortschreiben(MONTAG_10);
    const g = await GET('/api/crm/kampagnen/motor?kampagneId=kp-test');
    expect(g.status, g.text).toBe(200);
    const ids = (g.d.eintraege as { id: string }[]).map(x => x.id);
    expect(ids).toHaveLength(2);
    expect((await POST(motorRoute, '/api/crm/kampagnen/motor', { aktion: 'freigeben', kampagneId: 'kp-test', ids, postfach: pf }, dienst)).status).toBe(403);
    expect((await POST(motorRoute, '/api/crm/kampagnen/motor', { aktion: 'einstellungen', tagesgrenze: 1, fusszeile: 'Beispiel Innovation GmbH · Beispielweg 1 · Impressum: https://beispiel.example.invalid/impressum' }, sitzung('malin'))).status).toBe(403);
    expect((await POST(motorRoute, '/api/crm/kampagnen/motor', { aktion: 'einstellungen', tagesgrenze: 1, fusszeile: 'Beispiel Innovation GmbH · Beispielweg 1 · Impressum: https://beispiel.example.invalid/impressum' })).status).toBe(200);
    const f = await POST(motorRoute, '/api/crm/kampagnen/motor', { aktion: 'freigeben', kampagneId: 'kp-test', ids, postfach: pf });
    expect(f.status, f.text).toBe(200);
    expect(f.d.freigegeben).toBe(2);
    // Vor 8 Uhr: nichts.
    expect((await M.versenden(MONTAG_06)).gesendet).toBe(0);
    expect(server.gesendet).toHaveLength(0);
    // Im Fenster: Tagesgrenze 1 je Postfach → eine Mail, die zweite wartet bis morgen.
    const v1 = await M.versenden(MONTAG_10);
    expect(v1.gesendet, JSON.stringify((await M.ladePost()).eintraege.map(x => [x.status, x.fehler]))).toBe(1);
    expect((await M.versenden(MONTAG_10)).gesendet).toBe(0);
    expect(server.gesendet).toHaveLength(1);
    const roh = server.gesendet[0].roh.toString('utf8');
    expect(roh).toMatch(/^List-Unsubscribe: <https:\/\/os\.example\.invalid\/abmelden\/a1-[0-9a-f]{32}>/m);
    expect(roh).toMatch(/^List-Unsubscribe-Post: List-Unsubscribe=One-Click/m);
    const text = roh.replace(/=\r?\n/g, '');
    expect(text).toMatch(/abmelden\/a1-/);
    expect(text).toMatch(/Beispielweg 1/);
    expect(text).toMatch(/Guten Tag Anna Beispiel/);
    expect(text).toMatch(/Kevin/); // {{absender}} = Vorname der zuständigen Person
    // Stand weiter, Ergebnis „angesprochen“, Aktivität mit Betreff.
    expect(await stand('c-anna-0001')).toMatchObject({ schritt: 1, status: 'offen' });
    const k = await kampagne();
    expect(k.ergebnisse.filter(e => e.ergebnis === 'angesprochen').map(e => e.kontaktId)).toEqual(['c-anna-0001']);
    // Am nächsten Werktag geht die zweite.
    expect((await M.versenden(new Date('2026-11-03T09:00:00Z'))).gesendet).toBe(1);
    // Tag 3 nach der Mail: Anruf-Schritt → echtes Follow-up „fu-ks-…“ mit Leitfaden (Anna hat eine Mail-Einwilligung, Telefon ohne Nummer → übersprungen).
    await db.updateJson<{ kontakte: { id: string; telefon?: string }[] }>('kontakte', c => ({ kontakte: c!.kontakte.map(x => (x.id === 'c-anna-0001' ? { ...x, telefon: '+49 30 3333333', einwilligungen: [...((x as { einwilligungen?: unknown[] }).einwilligungen ?? []), { ...EINW, kanal: 'telefon' }] } : x)) }));
    await M.sequenzenFortschreiben(new Date('2026-11-05T09:00:00Z'));
    const fu = ((await (await import('@/lib/crm/speicher')).ladeCrm()).followups ?? []).filter(x => x.id.startsWith('fu-ks-'));
    expect(fu).toHaveLength(1);
    expect(fu[0]).toMatchObject({ kontaktId: 'c-anna-0001', art: 'anruf', quelle: 'kampagne', status: 'offen' });
    expect(fu[0].notiz).toMatch(/Bezug auf die Mail/);
    // Power Hour: die Karte trägt den Leitfaden.
    const { werIstDran } = await import('@/lib/crm/heute');
    const kk = (await db.loadJson<{ kontakte: never[] }>('kontakte'))!.kontakte;
    const karte = werIstDran(kk, await (await import('@/lib/crm/speicher')).ladeCrm(), '2026-11-05', 'kevin').karten.find(c => c.followupId === fu[0].id);
    expect(karte?.leitfaden).toMatch(/Bezug auf die Mail/);
  });

  it('Rückfluss: Antwort stoppt die Sequenz, legt EIN Follow-up an — idempotent; Abmeldung sperrt und stoppt', async () => {
    await kampagneAnlegen({ kontaktIds: ['c-anna-0001', 'c-dora-0004'], firmaIds: [] });
    const pf = await postfachAnlegen();
    await POST(motorRoute, '/api/crm/kampagnen/motor', { aktion: 'einstellungen', fusszeile: 'Beispiel Innovation GmbH · Impressum' });
    await M.sequenzenFortschreiben(MONTAG_10);
    const ids = (await M.ladePost()).eintraege.map(x => x.id);
    await M.stapelFreigeben({ person: 'kevin', kampagneId: 'kp-test', ids, postfach: pf, wer: { art: 'person', person: 'kevin' } });
    expect((await M.versenden(MONTAG_10)).gesendet).toBe(2);
    const anna = (await M.ladePost()).eintraege.find(x => x.ziel.id === 'c-anna-0001')!;
    expect(anna.gesendet?.messageId).toMatch(/^</);
    // Anna antwortet (im Posteingang des sendenden Postfachs), der Spiegel holt es.
    const spaeter = new Date(Date.now() + 120_000).toISOString();
    server.ablegen('INBOX', P.rohNachricht({ von: `Anna <anna@kunde.${D}>`, an: `vertrieb@firma.${D}`, betreff: `Re: ${anna.betreff}`, text: 'Gern, rufen Sie an.', messageId: `<antwort-1@kunde.${D}>`, inReplyTo: anna.gesendet!.messageId, datum: spaeter }), { am: spaeter });
    const { imapAbgleichen } = await import('@/lib/postfach/abgleich');
    await imapAbgleichen('kevin', pf, { erzwingen: true });
    expect((await M.rueckfluss(MONTAG_10)).antworten).toBe(1);
    expect((await M.rueckfluss(MONTAG_10)).antworten).toBe(0);
    expect(await stand('c-anna-0001')).toMatchObject({ status: 'reagiert' });
    const crm = await (await import('@/lib/crm/speicher')).ladeCrm();
    expect((crm.followups ?? []).filter(f => f.id.startsWith('fu-kr-'))).toHaveLength(1);
    expect(crm.kampagnen[0].ergebnisse.some(e => e.kontaktId === 'c-anna-0001' && e.ergebnis === 'reagiert')).toBe(true);
    // Dora meldet sich über den Link ab → Werbesperre (Kartei), Sequenz gestoppt.
    const { abmeldeToken } = await import('@/lib/datenschutz/abmelden');
    const { abmeldenAnwenden } = await import('@/lib/datenschutz/abmelden-server');
    await abmeldenAnwenden(abmeldeToken(`dora@kunde.${D}`)!);
    expect(await stand('c-dora-0004')).toMatchObject({ status: 'gestoppt', grund: 'Abmeldung' });
    expect((await M.kampagnenAbmeldung(abmeldeToken(`dora@kunde.${D}`)!))).toBe(1); // erneut: nichts doppelt (Stand bleibt beendet)
    expect((await stand('c-dora-0004'))?.verlauf.filter(v => v.was === 'abgemeldet')).toHaveLength(1);
  });

  it('„eigenes Risiko“: rote Ampel nur im Playbook homepage-funde und nur mit Schalter — dann sichtbar an der Freigabe; aus = Versand gesperrt', async () => {
    await kampagneAnlegen({ playbook: 'homepage-funde', kontaktIds: [], firmaIds: ['f-betrieb'] });
    const pf = await postfachAnlegen();
    await POST(motorRoute, '/api/crm/kampagnen/motor', { aktion: 'einstellungen', fusszeile: 'Beispiel Innovation GmbH · Impressum' });
    await M.sequenzenFortschreiben(MONTAG_10);
    const e = (await M.ladePost()).eintraege;
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ risiko: true, status: 'entwurf' });
    const frei = (h = sitzung('kevin')) => POST(motorRoute, '/api/crm/kampagnen/motor', { aktion: 'freigeben', kampagneId: 'kp-test', ids: [e[0].id], postfach: pf }, h);
    expect((await frei()).status).toBe(409);
    await db.saveJson('kampagne-funde--h', { funde: [], bekannt: [], einstellungen: { eigenesRisiko: { an: true, seit: '2026-11-01T10:00:00.000Z', von: 'kevin' } } });
    const f = await frei();
    expect(f.status, f.text).toBe(200);
    expect(f.d.eigenesRisiko.von).toMatch(/Kevin/);
    expect((await M.ladePost()).eintraege[0].freigabe?.eigenesRisiko?.von).toBe('kevin');
    // Schalter wieder aus → der Takt sendet nicht; seit 02.11. (B-Prüfung, Fund 7) zurück in den Entwurf mit Hinweis — ein vorübergehender Grund
    // stoppt das Ziel nicht endgültig.
    await db.saveJson('kampagne-funde--h', { funde: [], bekannt: [], einstellungen: {} });
    expect((await M.versenden(MONTAG_10)).spaeter).toBe(1);
    expect(server.gesendet).toHaveLength(0);
    expect((await M.ladePost()).eintraege[0]).toMatchObject({ status: 'entwurf', hinweis: expect.stringMatching(/eigenes Risiko/) });
  });

  it('Unbekannter Platzhalter: Entwurf mit Fehler, nicht freigebbar; Sequenz mit unbekanntem Platzhalter wird nicht gespeichert', async () => {
    await kampagneAnlegen({ kontaktIds: ['c-anna-0001'], firmaIds: [], sequenz: [{ id: 'q1', tagAbstand: 0, kanal: 'mail', betreff: 'Hallo', text: 'Hallo {{gibtsnicht}}' }] });
    const pf = await postfachAnlegen();
    await M.sequenzenFortschreiben(MONTAG_10);
    const e = (await M.ladePost()).eintraege[0];
    expect(e.status).toBe('fehler');
    expect((await POST(motorRoute, '/api/crm/kampagnen/motor', { aktion: 'freigeben', kampagneId: 'kp-test', ids: [e.id], postfach: pf })).status).toBe(409);
    const s = await POST(motorRoute, '/api/crm/kampagnen/motor', { aktion: 'sequenz', kampagneId: 'kp-test', sequenz: [{ kanal: 'mail', tagAbstand: 0, betreff: 'x', text: '{{gibtsnicht}}' }] });
    expect(s.status).toBe(400);
    // Der Browser-Weg des CRM-Bestands kann den Stand je Ziel nicht überschreiben.
    const { wendeCrmAn, ladeCrm } = await import('@/lib/crm/speicher');
    const b = await ladeCrm();
    const r = wendeCrmAn(b, [{ liste: 'kampagnen', op: 'teil', id: 'kp-test', felder: { zielStaende: [] } }] as never, new Date().toISOString(), 'kevin');
    expect(r.bestand.kampagnen.find(k => k.id === 'kp-test')?.zielStaende?.length).toBe(1);
  });
});
