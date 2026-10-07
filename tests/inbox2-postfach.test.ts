// Inbox 2 (06.10.): Postfächer über IMAP/SMTP von Ende zu Ende — mit nachgebautem Anbieter (PostSpeicher), nie ein echter Server:
// Verbinden (Prüfung VOR dem Speichern), Abgleich (stabile Kennungen, UIDVALIDITY, verschwundene UIDs, Flags), Bereichstrennung auf dem
// Server (Business sieht nie Privat, andere Person sieht nichts, Dienstweg 403), Zugangsdaten nie in einer Antwort, Erledigt/Gelesen
// zurückgeschrieben, Senden (Absender = Postfach, Antwort im Gespräch, Kopie in „Gesendet“), abgelehnte Anmeldung → keine weiteren
// Versuche bis „Verbindung erneuern“, Zuordnen erst per Klick → Verlauf, Screener, Trennen. Erfundene Daten (@example.invalid).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { PostSpeicher as PS } from '@/lib/postfach/post-speicher';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-inbox2-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-inbox2-route';
process.env.MAKE_OS_KEY = 'dienst-test-inbox2';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-inbox2-0123456789abcdef';

const D = 'example.invalid';
const GEHEIM_KDV = 'Geheim-Passwort-KDV-4711';
const GEHEIM_PRIVAT = 'abcd-efgh-ijkl-mnop';
type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let inbox: R, gespraech: R, senden: R, postfaecher: R, anhang: R;
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

const KONTEN = { konten: [
  { id: 'k1', speicher: 'kevin', email: `kevin@${D}`, name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  { id: 'k2', speicher: 'malin', email: `malin@${D}`, name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
], einladungen: [] };

beforeAll(async () => {
  db = await import('@/lib/store/local-db'); A = await import('@/lib/postfach/abgleich'); T = await import('@/lib/postfach/transport'); P = await import('@/lib/postfach/post-speicher');
  inbox = await import('../app/api/inbox/route') as R; gespraech = await import('../app/api/inbox/gespraech/route') as R; senden = await import('../app/api/inbox/senden/route') as R;
  postfaecher = await import('../app/api/inbox/postfaecher/route') as R; anhang = await import('../app/api/inbox/anhang/route') as R;
});
afterAll(() => { T.transportSetzen(null); rmSync(ordner, { recursive: true, force: true }); });

/** Der Anbieter einer Adresse (Benutzer = volle Adresse bzw. Teil vor dem @ bei iCloud). */
const anbieter = (benutzer: string): PS => {
  const s = server.get(benutzer);
  if (!s) throw new T.PostfachFehler('netz', 'Server unbekannt', 503);
  return s;
};

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.stubEnv('GOOGLE_CLIENT_ID', ''); vi.stubEnv('GOOGLE_CLIENT_SECRET', ''); vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubGlobal('fetch', async () => { throw new Error('kein Netz im Test'); });
  server.clear();
  server.set(`kevin.kdv@firma.${D}`, new P.PostSpeicher({ passwort: GEHEIM_KDV, ordner: [{ pfad: 'INBOX' }, { pfad: 'Gesendete Objekte' }] }));
  server.set('kevin.privat', new P.PostSpeicher({ passwort: GEHEIM_PRIVAT }));
  T.transportSetzen({
    imap: z => anbieter(z.benutzer).sitzung(z),
    smtp: (z, u, roh) => anbieter(z.benutzer === `kevin.privat@icloud.com` ? 'kevin.privat' : z.benutzer).senden(z, u, roh),
    waechter: async (z, _p, neu) => ({ stop: async () => { anbieter(z.benutzer).beobachten(neu)(); } }),
  });
  await db.saveJson('konten', KONTEN);
  await db.saveJson('kontakte', { kontakte: [k('c-anna', 'Anna', 'Schmidt', { email: `anna@kunde.${D}` }), k('c-eva', 'Eva', 'Eng', { email: `eva@${D}`, eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'kevin' } })] });
  await db.saveJson('crm', { firmen: [], chancen: [{ id: 'd-1', titel: 'Rahmenvertrag', stufe: 'angebot', kontaktIds: ['c-anna'] }], mandate: [], followups: [], kampagnen: [], events: [], beitraege: [], teilnahmen: [] });
  const kdv = server.get(`kevin.kdv@firma.${D}`)!;
  kdv.ablegen('INBOX', P.rohNachricht({ von: `Anna Schmidt <anna@kunde.${D}>`, an: `kevin.kdv@firma.${D}`, betreff: 'Angebot', text: 'Können Sie bis Freitag ein Angebot schicken?', messageId: `<a1@kunde.${D}>`, anhang: { name: 'Anfrage.pdf', typ: 'application/pdf', inhalt: 'PDF-ANFRAGE' } }));
  kdv.ablegen('INBOX', P.rohNachricht({ von: `Unbekannt <neu@irgendwo.${D}>`, an: `kevin.kdv@firma.${D}`, betreff: 'Kooperation', text: 'Hallo', messageId: `<u1@${D}>` }));
  const pr = server.get('kevin.privat')!;
  pr.ablegen('INBOX', P.rohNachricht({ von: `Freundin <freundin@privat.${D}>`, an: `kevin.privat@icloud.com`, betreff: 'PRIVAT-Geburtstag', text: 'Kommst du?', messageId: `<p1@${D}>` }));
});

async function verbinden(): Promise<{ kdv: string; privat: string }> {
  const a = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `kevin.kdv@firma.${D}`, passwort: GEHEIM_KDV, bereich: 'kdv', anzeigename: 'KD Ventures', absenderName: 'Kevin Beispiel', signatur: 'Kevin Beispiel · KD Ventures' });
  const b = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'icloud', adresse: 'kevin.privat@icloud.com', passwort: GEHEIM_PRIVAT, bereich: 'privat', anzeigename: 'Privat · iCloud' });
  expect(a.status, a.text).toBe(200); expect(b.status, b.text).toBe(200);
  await A.imapAbgleichen('kevin', a.d.id); await A.imapAbgleichen('kevin', b.d.id);
  return { kdv: a.d.id, privat: b.d.id };
}

describe('Verbinden: erst prüfen, dann speichern — Passwörter nie zurück', () => {
  it('falsches Passwort → 409 mit klarem Satz, NICHTS gespeichert; richtiges → gespeichert, Ordner + IDLE gemessen', async () => {
    const f = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `kevin.kdv@firma.${D}`, passwort: 'falsch', bereich: 'kdv' });
    expect(f.status).toBe(409);
    expect(f.d).toMatchObject({ ok: false, code: 'anmeldung' });
    expect((await GET(postfaecher, '/api/inbox/postfaecher')).d.postfaecher).toEqual([]);
    expect(await db.loadJson('postfach-zugang--kevin')).toBeNull();
    const ids = await verbinden();
    const reg = (await db.loadJson<{ postfaecher: { id: string; ordner: unknown; idle: boolean; benutzer: string }[] }>('postfaecher--kevin'))!.postfaecher;
    expect(reg.find(p => p.id === ids.kdv)).toMatchObject({ ordner: { posteingang: 'INBOX', gesendet: 'Gesendete Objekte' }, idle: true, benutzer: `kevin.kdv@firma.${D}` });
    expect(reg.find(p => p.id === ids.privat)).toMatchObject({ benutzer: 'kevin.privat', ordner: { gesendet: 'Sent Messages', archiv: 'Archive' } });
  });
  it('Bereich ist Pflicht und muss existieren; Demo-Anbieter nur in der Demo-Instanz; Ziel im eigenen Netz abgelehnt', async () => {
    expect((await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `x@${D}`, passwort: 'p', bereich: 'g-gibtsnicht' })).status).toBe(400);
    expect((await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'demo', adresse: `x@${D}`, passwort: 'p', bereich: 'privat' })).status).toBe(400);
    expect((await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'eigen', adresse: `x@${D}`, passwort: 'p', bereich: 'privat', imap: { host: 'localhost', port: 993 }, smtp: { host: 'smtp.a.de', port: 465 } })).status).toBe(400);
  });
  it('kein Passwort in IRGENDEINER Antwort (Postfächer, Strom, Gespräch)', async () => {
    await verbinden();
    const antworten = [await GET(postfaecher, '/api/inbox/postfaecher'), await GET(inbox, '/api/inbox')];
    const g = antworten[1].d.gespraeche[0];
    antworten.push(await GET(gespraech, `/api/inbox/gespraech?id=${encodeURIComponent(g.id)}`));
    for (const a of antworten) { expect(a.text).not.toContain(GEHEIM_KDV); expect(a.text).not.toContain(GEHEIM_PRIVAT); expect(a.text).not.toContain('passwort"'); }
  });
});

describe('Trennung auf dem Server', () => {
  it('space=business: nur KD Ventures, nie Privates; bereich=privat: nur Privat; Alle: beides', async () => {
    await verbinden();
    const alle = await GET(inbox, '/api/inbox');
    expect(alle.d.postfaecher).toHaveLength(2);
    expect(alle.text).toContain('PRIVAT-Geburtstag');
    const b = await GET(inbox, '/api/inbox?space=business');
    expect(b.d.postfaecher.map((p: { bereich: string }) => p.bereich)).toEqual(['kdv']);
    expect(b.text).not.toContain('PRIVAT-Geburtstag');
    expect(b.text).not.toContain('freundin@');
    expect(b.d.lage.map((l: { bereich: string }) => l.bereich)).toEqual(['kdv']);
    const p = await GET(inbox, '/api/inbox?bereich=privat');
    expect(p.text).toContain('PRIVAT-Geburtstag');
    expect(p.text).not.toContain('Angebot');
    expect((await GET(inbox, '/api/inbox?bereich=../x')).status).toBe(400);
  });
  it('eine andere Person sieht nichts von Kevins Postfächern; der Dienstweg bekommt überall 403', async () => {
    const { kdv } = await verbinden();
    const m = await GET(inbox, '/api/inbox', sitzung('malin'));
    expect(m.d.postfaecher).toEqual([]); expect(m.d.gespraeche).toEqual([]);
    const gid = (await GET(inbox, '/api/inbox')).d.gespraeche[0].id;
    expect((await GET(gespraech, `/api/inbox/gespraech?id=${encodeURIComponent(gid)}`, sitzung('malin'))).status).toBe(404);
    expect((await POST(inbox, '/api/inbox', { aktion: 'erledigt', id: gid }, sitzung('malin'))).status).toBe(404);
    expect((await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'trennen', id: kdv }, sitzung('malin'))).d.war).toBe(false);
    expect((await POST(senden, '/api/inbox/senden', { gespraech: gid, text: 'x' }, sitzung('malin'))).status).toBe(404);
    for (const [r, u] of [[inbox, '/api/inbox'], [gespraech, `/api/inbox/gespraech?id=${encodeURIComponent(gid)}`], [postfaecher, '/api/inbox/postfaecher'], [anhang, `/api/inbox/anhang?nachricht=${kdv}:e:1:1&teil=2`]] as const) expect((await GET(r, u, dienst())).status, u).toBe(403);
    for (const [r, u, b] of [[inbox, '/api/inbox', { aktion: 'abgleichen' }], [senden, '/api/inbox/senden', { gespraech: gid, text: 'x' }], [postfaecher, '/api/inbox/postfaecher', { aktion: 'trennen', id: kdv }]] as const) expect((await POST(r, u, b, dienst())).status, u).toBe(403);
    expect((await GET(inbox, '/api/inbox', { 'content-type': 'application/json' })).status).toBe(403);
  });
});

describe('Abgleich: stabile Kennungen', () => {
  it('kein Doppel beim zweiten Lauf; neue Post kommt dazu; UIDVALIDITY neu → neu gelesen, Gesprächs-Kennung bleibt; verschwundene UID fällt weg; Flags ziehen nach', async () => {
    const { kdv } = await verbinden();
    const vorher = (await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche as { id: string; betreff: string; ungelesen: boolean }[];
    expect(vorher).toHaveLength(2);
    await A.imapAbgleichen('kevin', kdv);
    expect((await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche).toHaveLength(2);
    const s = server.get(`kevin.kdv@firma.${D}`)!;
    s.neuNummerieren('INBOX');
    await A.imapAbgleichen('kevin', kdv);
    const nachher = (await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche as { id: string }[];
    expect(nachher.map(g => g.id).sort()).toEqual(vorher.map(g => g.id).sort());
    const st = await db.loadJson<{ koepfe: Record<string, unknown> }>('imap-stand--kevin');
    expect(Object.keys(st!.koepfe).filter(x => x.startsWith(`${kdv}:e:1100:`))).toHaveLength(2);
    // gelesen beim Anbieter → im Spiegel; eine Mail woanders hin verschoben → raus
    s.nachrichten('INBOX')[0].flags.add('\\Seen');
    const z = await s.sitzung({ passwort: GEHEIM_KDV }); await z.oeffnen('INBOX'); s.ordnerAnlegen('Woanders'); await z.verschieben([s.nachrichten('INBOX')[1].uid], 'Woanders');
    await A.imapAbgleichen('kevin', kdv);
    const g = (await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche as { betreff: string; ungelesen: boolean }[];
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ betreff: 'Angebot', ungelesen: false });
  });
});

describe('Aktionen gehen ans Postfach zurück', () => {
  it('gelesen = \\Seen; erledigt = in den Archiv-Ordner (fehlt er, legt MAKE OS „Archiv“ an); zurück = wieder in den Posteingang', async () => {
    const { kdv } = await verbinden();
    const s = server.get(`kevin.kdv@firma.${D}`)!;
    const g = ((await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche as { id: string; betreff: string }[]).find(x => x.betreff === 'Angebot')!;
    expect((await POST(inbox, '/api/inbox', { aktion: 'gelesen', id: g.id })).d.ok).toBe(true);
    expect(s.nachrichten('INBOX').find(n => n.messageId === `<a1@kunde.${D}>`)!.flags.has('\\Seen')).toBe(true);
    expect((await POST(inbox, '/api/inbox', { aktion: 'erledigt', id: g.id })).d.ok).toBe(true);
    expect(s.nachrichten('INBOX').some(n => n.messageId === `<a1@kunde.${D}>`)).toBe(false);
    expect(s.nachrichten('Archiv').some(n => n.messageId === `<a1@kunde.${D}>`)).toBe(true);
    expect((await db.loadJson<{ postfaecher: { id: string; ordner: { archiv?: string } }[] }>('postfaecher--kevin'))!.postfaecher.find(p => p.id === kdv)!.ordner.archiv).toBe('Archiv');
    const nach = (await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche as { id: string; inArbeit: boolean }[];
    expect(nach.find(x => x.id === g.id)?.inArbeit).toBe(false);
    expect((await POST(inbox, '/api/inbox', { aktion: 'zurueck', id: g.id })).d.ok).toBe(true);
    expect(s.nachrichten('INBOX').some(n => n.messageId === `<a1@kunde.${D}>`)).toBe(true);
  });
  it('später: ruht bis zum Datum; Datum in der Vergangenheit → 400', async () => {
    await verbinden();
    const g = ((await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche as { id: string; betreff: string }[]).find(x => x.betreff === 'Angebot')!;
    expect((await POST(inbox, '/api/inbox', { aktion: 'spaeter', id: g.id, bis: '2020-01-01' })).status).toBe(400);
    expect((await POST(inbox, '/api/inbox', { aktion: 'spaeter', id: g.id, bis: '2099-01-01' })).d.ok).toBe(true);
    expect(((await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche as { id: string; inArbeit: boolean; wiedervorlage?: string }[]).find(x => x.id === g.id)).toMatchObject({ inArbeit: false, wiedervorlage: '2099-01-01' });
  });
  it('Screener: neuer Absender im Fach „neu“, blocken blendet aus (nichts gelöscht), offen holt zurück', async () => {
    await verbinden();
    const n = ((await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche as { id: string; fach: string }[]).find(x => x.fach === 'neu')!;
    expect(n).toBeTruthy();
    await POST(inbox, '/api/inbox', { aktion: 'blocken', id: n.id });
    expect(((await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche as { id: string; fach: string; inArbeit: boolean }[]).find(x => x.id === n.id)).toMatchObject({ fach: 'geblockt', inArbeit: false });
    expect(server.get(`kevin.kdv@firma.${D}`)!.nachrichten('INBOX')).toHaveLength(2);
    expect((await GET(postfaecher, '/api/inbox/postfaecher')).d.absender).toMatchObject([{ adresse: `neu@irgendwo.${D}`, status: 'geblockt' }]);
    await POST(inbox, '/api/inbox', { aktion: 'offen', id: n.id });
    expect(((await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche as { id: string; fach: string }[]).find(x => x.id === n.id)!.fach).toBe('neu');
  });
  it('Anhang nur als Download (octet-stream, nosniff, sandbox), frisch vom Anbieter', async () => {
    await verbinden();
    const g = ((await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche as { id: string; betreff: string }[]).find(x => x.betreff === 'Angebot')!;
    const a = (await GET(gespraech, `/api/inbox/gespraech?id=${encodeURIComponent(g.id)}`)).d;
    const n = a.nachrichten[0];
    const r = await anhang.GET!(new Request(`http://localhost/api/inbox/anhang?nachricht=${encodeURIComponent(n.id)}&teil=${n.anhaenge[0].teil}`, { headers: sitzung('kevin') }));
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('application/octet-stream');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('content-disposition')).toContain('attachment');
    expect(Buffer.from(await r.arrayBuffer()).toString()).toBe('PDF-ANFRAGE');
  });
});

describe('Senden — nur Einzelklick, Absender = Postfach', () => {
  it('Antwort im Gespräch über SMTP des Postfachs: Umschlag-Absender, In-Reply-To, Re:, Kopie in „Gesendet“ (genau einmal); danach „Warten auf“', async () => {
    const { kdv } = await verbinden();
    const s = server.get(`kevin.kdv@firma.${D}`)!;
    const g = ((await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche as { id: string; betreff: string }[]).find(x => x.betreff === 'Angebot')!;
    const r = await POST(senden, '/api/inbox/senden', { gespraech: g.id, text: 'Gern, kommt bis Freitag.\n\n-- \nKevin Beispiel · KD Ventures', anfrageId: 'anf-11111111-2222-4333-8444-555555555555' });
    expect(r.status, r.text).toBe(200);
    expect(s.gesendet).toHaveLength(1);
    expect(s.gesendet[0]).toMatchObject({ von: `kevin.kdv@firma.${D}`, an: [`anna@kunde.${D}`] });
    const roh = s.gesendet[0].roh.toString();
    expect(roh).toContain(`In-Reply-To: <a1@kunde.${D}>`);
    expect(roh).toMatch(/Subject: Re: Angebot/);
    expect(roh).toContain('From: "Kevin Beispiel" <kevin.kdv@firma.example.invalid>');
    expect(s.nachrichten('Gesendete Objekte')).toHaveLength(1);
    // derselbe Klick noch einmal (Netz-Retry) → nichts doppelt
    await POST(senden, '/api/inbox/senden', { gespraech: g.id, text: 'Gern, kommt bis Freitag.', anfrageId: 'anf-11111111-2222-4333-8444-555555555555' });
    expect(s.gesendet).toHaveLength(1);
    await A.imapAbgleichen('kevin', kdv);
    const nach = ((await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche as { id: string; fach: string; anzahl: number }[]).find(x => x.id === g.id)!;
    expect(nach).toMatchObject({ fach: 'warten', anzahl: 2 });
  });
  it('legt der Anbieter selbst ab, wird nicht doppelt angehängt; eine fremde Absenderadresse → 400, nichts gesendet; Art. 18 → 409', async () => {
    await verbinden();
    const s = server.get(`kevin.kdv@firma.${D}`)!;
    s.legtGesendetSelbstAb = true;
    const g = ((await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche as { id: string; betreff: string }[]).find(x => x.betreff === 'Angebot')!;
    expect((await POST(senden, '/api/inbox/senden', { gespraech: g.id, text: 'x', von: `kevin.privat@icloud.com` })).status).toBe(400);
    expect(s.gesendet).toHaveLength(0);
    expect((await POST(senden, '/api/inbox/senden', { gespraech: g.id, text: 'Danke!' })).status).toBe(200);
    expect(s.nachrichten('Gesendete Objekte')).toHaveLength(1);
    const neu = await POST(senden, '/api/inbox/senden', { neu: { postfach: (await GET(inbox, '/api/inbox?bereich=kdv')).d.postfaecher[0].id, betreff: 'Hallo' }, an: [{ email: `eva@${D}` }], text: 'Hallo Eva' });
    expect(neu.status).toBe(409);
    expect(neu.d.code).toBe('eingeschraenkt');
  });
});

describe('Abgelehnte Anmeldung (Apple: App-Passwort nach Passwortwechsel ungültig)', () => {
  it('Zustand „anmeldung“, EINE Glocke, danach KEINE weiteren Anmeldeversuche, bis „Verbindung erneuern“ — erneuern prüft zuerst', async () => {
    const { privat } = await verbinden();
    const s = server.get('kevin.privat')!;
    s.passwort = 'neues-app-passwort';
    await expect(A.imapAbgleichen('kevin', privat)).rejects.toMatchObject({ code: 'anmeldung' });
    const p = ((await GET(inbox, '/api/inbox')).d.postfaecher as { id: string; zustand: { stufe: string } }[]).find(x => x.id === privat)!;
    expect(p.zustand.stufe).toBe('anmeldung');
    const vorher = s.anmeldungen;
    await expect(A.imapAbgleichen('kevin', privat)).rejects.toMatchObject({ code: 'anmeldung' });
    expect(s.anmeldungen).toBe(vorher);
    expect(A.imapFaellig((await db.loadJson<{ postfaecher: Record<string, never> }>('imap-stand--kevin'))!.postfaecher[privat])).toBe(false);
    const glocke = await db.loadJson<{ meldungen?: { art: string }[] }>('meldungen--kevin');
    expect(JSON.stringify(glocke)).toContain('postfach');
    expect((await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'erneuern', id: privat, passwort: 'immer-noch-falsch' })).status).toBe(409);
    expect((await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'erneuern', id: privat, passwort: 'neues-app-passwort' })).status).toBe(200);
    await A.imapAbgleichen('kevin', privat);
    expect(((await GET(inbox, '/api/inbox')).d.postfaecher as { id: string; zustand: { stufe: string } }[]).find(x => x.id === privat)!.zustand.stufe).toBe('aktuell');
  });
});

describe('Zuordnen nur per Klick (Kevin 06.10.: „ZOE macht alles nur als Vorschlag“)', () => {
  it('„gehört zu“ wird angezeigt, der Verlauf der Akte bleibt leer — erst „zuordnen“ schreibt; neue Nachrichten im Gespräch kommen dann mit', async () => {
    const { kdv } = await verbinden();
    const g = ((await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche as { id: string; betreff: string; zuordnung?: { kontaktId: string } }[]).find(x => x.betreff === 'Angebot')!;
    expect(g.zuordnung?.kontaktId).toBe('c-anna');
    const akte = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(c => c.id === 'c-anna')!.aktivitaeten;
    expect(await akte()).toHaveLength(0);
    const v = (await GET(gespraech, `/api/inbox/gespraech?id=${encodeURIComponent(g.id)}`)).d;
    expect(v.vorschlaege.map((x: { art: string }) => x.art)).toContain('zuordnen');
    expect(v.kontext.deals).toEqual([{ id: 'd-1', titel: 'Rahmenvertrag', stufe: 'angebot' }]);
    const z = await POST(inbox, '/api/inbox', { aktion: 'zuordnen', id: g.id });
    expect(z.d.ok).toBe(true);
    const a = await akte();
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ art: 'antwort', text: 'Betreff: Angebot', mailLink: `/os/inbox?offen=${g.id}` });
    expect(JSON.stringify(a)).not.toContain('bis Freitag ein Angebot');
    server.get(`kevin.kdv@firma.${D}`)!.ablegen('INBOX', P.rohNachricht({ von: `anna@kunde.${D}`, an: `kevin.kdv@firma.${D}`, betreff: 'Re: Angebot', text: 'Und?', messageId: `<a2@kunde.${D}>`, inReplyTo: `<a1@kunde.${D}>`, references: [`<a1@kunde.${D}>`] }));
    await A.imapAbgleichen('kevin', kdv);
    expect(await akte()).toHaveLength(2);
  });
});

describe('Trennen', () => {
  it('Spiegel, Texte, Zugang und Inbox-Zustand des Postfachs sind weg; beim Anbieter bleibt alles', async () => {
    const { kdv } = await verbinden();
    const g = ((await GET(inbox, '/api/inbox?bereich=kdv')).d.gespraeche as { id: string }[])[0];
    await POST(inbox, '/api/inbox', { aktion: 'spaeter', id: g.id, bis: '2099-01-01' });
    const r = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'trennen', id: kdv });
    expect(r.d).toMatchObject({ ok: true, war: true, nachrichten: 2 });
    const st = await db.loadJson<{ koepfe: Record<string, { postfachId: string }> }>('imap-stand--kevin');
    expect(Object.values(st!.koepfe).some(x => x.postfachId === kdv)).toBe(false);
    const tx = await db.loadJson<{ texte: Record<string, unknown> }>('imap-text--kevin');
    expect(Object.keys(tx!.texte).some(x => x.startsWith(kdv))).toBe(false);
    expect(JSON.stringify(await db.loadJson('postfach-zugang--kevin'))).not.toContain(GEHEIM_KDV);
    expect(JSON.stringify(await db.loadJson('inbox-zustand--kevin'))).not.toContain(kdv);
    expect(server.get(`kevin.kdv@firma.${D}`)!.nachrichten('INBOX')).toHaveLength(2);
  });
});
