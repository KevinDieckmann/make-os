// Gmail-Routen: nur die eigene Person (Dienstweg 403, Malin sieht nie Kevins Mails), Liste/Thread/Anhang (nur Download, nosniff,
// Größengrenze), Markieren/Archivieren geht an Gmail zurück, Antwort im Thread mit richtigen Köpfen und Absender-Alias, Senden NUR per
// Einzelklick (ZOE/Takt/Skripte 403), § 7 UWG-Rückfrage, Art. 18, Idempotenz, kein Header-Injection, ZOE-Entwurf (Fremdtext als
// Daten, Du/Sie, Art. 18). Echter Datenspeicher (Temp, verschlüsselt), Google/Gmail und die KI nachgebaut.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import { GmailFake, gmailAufrufe } from './fixtures/gmail-fake';
import { KONTEN, umgebung } from './fixtures/gmail-setup';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-gmail-r-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-gmail-route';
process.env.MAKE_OS_KEY = 'dienst-test-gmail-route';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-gmail-route-0123456789abcdef';

type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let V: typeof import('@/lib/google/verbindung'), A: typeof import('@/lib/gmail/abgleich'), S: typeof import('@/lib/gmail/stand'), db: typeof import('@/lib/store/local-db'), M: typeof import('@/lib/gmail/mime');
let liste: R, nachricht: R, anhang: R, senden: R, entwurf: R;
let g: GmailFake;
let anthropic: { url: string; body: Record<string, any> }[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any

const k = (id: string, vorname: string, nachname: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname, nachname, stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie', ...x } as Kontakt);
const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const dienst = (person = 'kevin') => ({ 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person, 'content-type': 'application/json' });
const j = async (r: Response) => ({ status: r.status, d: await r.json().catch(() => ({})) as Record<string, any>, r }); // eslint-disable-line @typescript-eslint/no-explicit-any
const GET = (route: R, url: string, h: Record<string, string> = sitzung('kevin')) => route.GET!(new Request(`http://localhost${url}`, { headers: h })).then(j);
const POST = (route: R, url: string, body: unknown, h: Record<string, string> = sitzung('kevin')) => route.POST!(new Request(`http://localhost${url}`, { method: 'POST', headers: h, body: JSON.stringify(body) })).then(j);

beforeAll(async () => {
  V = await import('@/lib/google/verbindung'); A = await import('@/lib/gmail/abgleich'); S = await import('@/lib/gmail/stand'); db = await import('@/lib/store/local-db'); M = await import('@/lib/gmail/mime');
  liste = await import('../app/api/gmail/route') as R; nachricht = await import('../app/api/gmail/nachricht/route') as R; anhang = await import('../app/api/gmail/anhang/route') as R;
  senden = await import('../app/api/gmail/senden/route') as R; entwurf = await import('../app/api/gmail/entwurf/route') as R;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

async function verbinden(person: string) {
  const { url } = await V.verbindungStarten(person, ['gmail']);
  await V.verbindungAbschliessen(person, 'code-ok', new URL(url).searchParams.get('state')!);
}

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  (await import('@/lib/zugang/drossel'))._zuruecksetzen();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-03T08:00:00.000Z'));
  g = new GmailFake(); umgebung(vi, g);
  anthropic = [];
  vi.stubGlobal('fetch', async (u: string | URL, i: RequestInit = {}) => {
    if (String(u).includes('api.anthropic.com')) { anthropic.push({ url: String(u), body: JSON.parse(String(i.body)) }); return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Guten Tag Frau Schmidt,\n\nvielen Dank für Ihre Nachricht.\n\nBeste Grüße\nKevin' }], stop_reason: 'end_turn' }), { status: 200, headers: { 'content-type': 'application/json' } }); }
    return g.handle(String(u), i);
  });
  await db.saveJson('konten', KONTEN);
  await db.saveJson('kontakte', { kontakte: [
    k('c-anna-schmidt', 'Anna', 'Schmidt', { email: 'anna@firma.example.invalid', firma: 'Beispiel GmbH', firmaId: 'f-beispiel' }),
    k('c-ben-sperre', 'Ben', 'Sperre', { email: 'ben@x.example.invalid', werbesperre: { seit: '2026-08-01', grund: 'Widerspruch' } as never }),
    k('c-eva-eng', 'Eva', 'Eng', { email: 'eva@y.example.invalid', eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'kevin' } }),
  ] });
  await db.saveJson('crm', { firmen: [{ id: 'f-beispiel', name: 'Beispiel GmbH' }], chancen: [], mandate: [], followups: [], kampagnen: [], events: [], beitraege: [], teilnahmen: [] });
  await verbinden('kevin');
  g.mail({ id: 'mail01', threadId: 'mail01', von: 'Anna Schmidt <anna@firma.example.invalid>', an: 'hello@makeinnovation.test', cc: 'Bert <bert@firma.example.invalid>', betreff: 'Rahmenvertrag', text: `Bitte um Rückruf.\nSiehe https://x.example.invalid/pfad\n${'.'.repeat(200)}\nENDMARKE-NUR-IM-TEXT`, vorMin: 60, messageId: '<orig-1@mail.example.invalid>', kopf: { References: '<davor@mail.example.invalid>' }, anhaenge: [{ name: 'Ang"ebot\r\nÄ.pdf', inhalt: 'PDF-INHALT' }] });
  g.mail({ id: 'mail02', threadId: 'mail01', von: 'kevin@makeinnovation.test', an: 'anna@firma.example.invalid', betreff: 'Re: Rahmenvertrag', text: 'Gern.', labels: ['SENT'], vorMin: 45 });
  g.mail({ id: 'ben001', von: 'Ben <ben@x.example.invalid>', betreff: 'Frage', text: 'Hallo', vorMin: 30 });
  g.mail({ id: 'eva001', von: 'Eva <eva@y.example.invalid>', betreff: 'Frage', text: 'Hallo', vorMin: 20 });
  await A.gmailAbgleichen('kevin');
});

describe('Zugang: nur die eigene Person — nie der Dienstweg, nie das andere Konto', () => {
  it('Dienstweg (ZOE, Takt, Skripte) bekommt auf JEDEM Gmail-Weg 403 — auch mit Person im Kopf', async () => {
    for (const [r, u] of [[liste, '/api/gmail'], [nachricht, '/api/gmail/nachricht?id=mail01'], [anhang, '/api/gmail/anhang?id=mail01&teil=0.1']] as const) expect((await GET(r, u, dienst())).status, u).toBe(403);
    for (const [r, u, b] of [[liste, '/api/gmail', { aktion: 'abgleichen' }], [senden, '/api/gmail/senden', { ausNachricht: 'mail01', text: 'x' }], [entwurf, '/api/gmail/entwurf', { id: 'mail01' }]] as const) expect((await POST(r, u, b, dienst())).status, u).toBe(403);
    expect(g.gesendet).toHaveLength(0);
    expect(anthropic).toHaveLength(0);
  });
  it('ohne Sitzung gar nichts (Middleware) — und Malin sieht nie Kevins Mails: eigener Spiegel, fremde Kennung → 404, Senden/Anhang/Markieren auf Kevins Mail scheitern', async () => {
    const m = await GET(liste, '/api/gmail', sitzung('malin'));
    expect(m.d).toMatchObject({ ok: true, bereit: false, nachrichten: [] });
    expect((await GET(nachricht, '/api/gmail/nachricht?id=mail01', sitzung('malin'))).status).toBe(404);
    expect((await GET(anhang, '/api/gmail/anhang?id=mail01&teil=0.1', sitzung('malin'))).status).toBe(404);
    expect((await POST(senden, '/api/gmail/senden', { ausNachricht: 'mail01', text: 'x' }, sitzung('malin'))).status).toBe(409);
    expect((await POST(liste, '/api/gmail', { aktion: 'markieren', id: 'mail01', was: 'gelesen' }, sitzung('malin'))).status).toBe(404);
    // Malin verbindet sich selbst: eigener Spiegel — Kevins Kennungen kennt er nicht.
    await verbinden('malin');
    await S.setzeGmailStand('malin', { v: 1, person: 'malin', email: 'malin@makeinnovation.test', koepfe: { z9: { id: 'z9', threadId: 'z9', am: '2026-10-03T07:00:00.000Z', von: { email: 'x@y.example.invalid' }, an: [], cc: [], betreff: 'Malins Mail', ausschnitt: '', labels: ['INBOX'], anhaenge: [] } }, at: new Date().toISOString() });
    const ml = await GET(liste, '/api/gmail', sitzung('malin'));
    expect(ml.d.nachrichten.map((n: { id: string }) => n.id)).toEqual(['z9']);
    expect(JSON.stringify(ml.d)).not.toMatch(/Rahmenvertrag|anna@firma/);
    expect((await GET(nachricht, '/api/gmail/nachricht?id=mail01', sitzung('malin'))).status).toBe(404);
    const kl = await GET(liste, '/api/gmail');
    expect(JSON.stringify(kl.d)).not.toContain('Malins Mail');
  });
  it('Antworten enthalten nie Tokens', async () => {
    const roh = JSON.stringify([(await GET(liste, '/api/gmail')).d, (await GET(nachricht, '/api/gmail/nachricht?id=mail01')).d]);
    expect(roh).not.toMatch(/erneuerung-geheim|zugriff-\d|refreshToken|accessToken/);
  });
});

describe('Liste, Thread, Anhang', () => {
  it('die Liste ist schlank (kein Text), ungelesen/Posteingang/gesendet, mit Zuordnung', async () => {
    const r = await GET(liste, '/api/gmail');
    expect(r.d).toMatchObject({ ok: true, bereit: true, konto: expect.stringMatching(/^k\*+@makeinnovation\.test$/), eigene: 'kevin@makeinnovation.test', push: 'aus' });
    const mail01 = r.d.nachrichten.find((n: { id: string }) => n.id === 'mail01');
    expect(mail01).toMatchObject({ threadId: 'mail01', betreff: 'Rahmenvertrag', ungelesen: true, posteingang: true, gesendet: false, anhaenge: 1, zuordnung: { kontaktId: 'c-anna-schmidt', firma: 'Beispiel GmbH' } });
    expect(r.d.nachrichten.find((n: { id: string }) => n.id === 'mail02')).toMatchObject({ gesendet: true, posteingang: false });
    expect(JSON.stringify(r.d)).not.toContain('ENDMARKE');   // nur der Ausschnitt, nie der Text
    expect(r.d.aliase.map((a: { email: string }) => a.email)).toEqual(['kevin@makeinnovation.test', 'hello@makeinnovation.test']);
  });
  it('ETag: unverändert → 304', async () => {
    const a = await GET(liste, '/api/gmail');
    const etag = a.r.headers.get('etag')!;
    expect(etag).toBeTruthy();
    const b = await liste.GET!(new Request('http://localhost/api/gmail', { headers: { ...sitzung('kevin'), 'if-none-match': etag } }));
    expect(b.status).toBe(304);
  });
  it('Thread: alle Nachrichten (alt → neu) mit Text, Standard-Empfänger der Antwort/„allen“ ohne die eigenen Adressen', async () => {
    const r = await GET(nachricht, '/api/gmail/nachricht?id=mail01');
    expect(r.d.thread.map((n: { kopf: { id: string } }) => n.kopf.id)).toEqual(['mail01', 'mail02']);
    expect(r.d.thread[0].text).toContain('Bitte um Rückruf');
    expect(r.d.empfaenger.antworten).toEqual({ an: [{ name: 'Anna Schmidt', email: 'anna@firma.example.invalid' }], cc: [] });
    expect(r.d.empfaenger.allen.an.map((a: { email: string }) => a.email)).toEqual(['anna@firma.example.invalid']);
    expect(r.d.empfaenger.allen.cc.map((a: { email: string }) => a.email)).toEqual(['bert@firma.example.invalid']);   // hello@ (Alias) fehlt: das sind wir
    expect((await GET(nachricht, '/api/gmail/nachricht?id=../x')).status).toBe(400);
    expect((await GET(nachricht, '/api/gmail/nachricht?id=gibtsnicht1')).status).toBe(404);
  });
  it('Anhang: nur als Download (octet-stream, attachment, nosniff, sandbox), sauberer Dateiname, Inhalt frisch aus Gmail; zu groß 413; falsche Teile 404/400', async () => {
    const s = (await S.ladeGmailStand('kevin'))!;
    const a = s.koepfe.mail01.anhaenge[0];
    const r = await anhang.GET!(new Request(`http://localhost/api/gmail/anhang?id=mail01&teil=${a.teil}`, { headers: sitzung('kevin') }));
    expect(r.status).toBe(200);
    expect(Buffer.from(await r.arrayBuffer()).toString()).toBe('PDF-INHALT');
    expect(r.headers.get('content-type')).toBe('application/octet-stream');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('content-security-policy')).toBe('sandbox');
    expect(r.headers.get('cache-control')).toBe('no-store');
    const dispo = r.headers.get('content-disposition')!;
    expect(dispo).toMatch(/^attachment; filename="[^"\r\n]+"; filename\*=UTF-8''/);
    expect(dispo).not.toMatch(/[\r\n]/);
    expect(dispo).not.toContain('Ang"ebot');
    await S.aendereGmailStand('kevin', st => ({ ...st, koepfe: { ...st.koepfe, mail01: { ...st.koepfe.mail01, anhaenge: [{ ...a, groesse: 30 * 1024 * 1024 }] } } }));
    expect((await GET(anhang, `/api/gmail/anhang?id=mail01&teil=${a.teil}`)).status).toBe(413);
    expect((await GET(anhang, '/api/gmail/anhang?id=mail01&teil=9.9')).status).toBe(404);
    expect((await GET(anhang, '/api/gmail/anhang?id=mail01&teil=../../etc')).status).toBe(400);
    expect((await GET(anhang, '/api/gmail/anhang?id=mail01')).status).toBe(400);
  });
});

describe('Markieren und Archivieren gehen an Gmail zurück', () => {
  it('gelesen (Thread), archivieren (Label INBOX weg, Spiegel sofort), zurück in den Posteingang, ungelesen (nur die Nachricht)', async () => {
    let r = await POST(liste, '/api/gmail', { aktion: 'markieren', id: 'mail01', was: 'gelesen' });
    expect(r.d).toMatchObject({ ok: true });
    expect(g.nachrichten.get('mail01')!.labelIds).not.toContain('UNREAD');
    expect(gmailAufrufe(g, '/threads/mail01/modify', 'POST')).toHaveLength(1);
    expect((await S.ladeGmailStand('kevin'))!.koepfe.mail01.labels).toEqual(['INBOX']);
    r = await POST(liste, '/api/gmail', { aktion: 'markieren', id: 'mail01', was: 'archivieren' });
    expect(r.d.ok).toBe(true);
    expect(g.nachrichten.get('mail01')!.labelIds).not.toContain('INBOX');
    expect((await S.ladeGmailStand('kevin'))!.koepfe.mail01.labels).not.toContain('INBOX');
    await POST(liste, '/api/gmail', { aktion: 'markieren', id: 'mail01', was: 'posteingang' });
    expect(g.nachrichten.get('mail01')!.labelIds).toContain('INBOX');
    await POST(liste, '/api/gmail', { aktion: 'markieren', id: 'mail01', was: 'ungelesen' });
    expect(gmailAufrufe(g, '/messages/mail01/modify', 'POST')).toHaveLength(1);
    expect(g.nachrichten.get('mail01')!.labelIds).toContain('UNREAD');
    // Nie Löschen: es gibt keinen Weg dafür.
    expect((await POST(liste, '/api/gmail', { aktion: 'markieren', id: 'mail01', was: 'loeschen' })).status).toBe(400);
    expect((await POST(liste, '/api/gmail', { aktion: 'markieren', id: 'mail01', was: 'TRASH' })).status).toBe(400);
    expect((await POST(liste, '/api/gmail', { aktion: 'markieren', id: 'gibtsnicht1', was: 'gelesen' })).status).toBe(404);
    expect(gmailAufrufe(g, 'trash').length + gmailAufrufe(g, 'delete').length).toBe(0);
  });
  it('„Gmail ausschalten“ und „Jetzt abgleichen“ über die Route', async () => {
    g.mail({ id: 'neu1', von: 'x@y.example.invalid', betreff: 'Neu', text: 'x' });
    expect((await POST(liste, '/api/gmail', { aktion: 'abgleichen' })).d).toMatchObject({ ok: true, neu: 1 });
    expect((await POST(liste, '/api/gmail', { aktion: 'ausschalten' })).d).toMatchObject({ ok: true, war: true });
    expect((await GET(liste, '/api/gmail')).d).toMatchObject({ bereit: false });
    expect((await POST(liste, '/api/gmail', { aktion: 'quatsch' })).status).toBe(400);
  });
});

describe('Antwort im Thread und Senden NUR per Einzelklick', () => {
  it('Antwort auf mail01: threadId, In-Reply-To, References (bisherige + diese), Re:, Absender = der Alias, an den die Mail ging, Empfänger = Absender; erscheint sofort im Thread und im Verlauf', async () => {
    const r = await POST(senden, '/api/gmail/senden', { ausNachricht: 'mail01', text: 'Hallo Frau Schmidt,\n\ngern rufe ich Sie zurück — Grüße, Kevin', anfrageId: 'anfrage-0001' });
    expect(r.status).toBe(200);
    expect(r.d).toMatchObject({ ok: true, von: 'hello@makeinnovation.test', an: ['anna@firma.example.invalid'] });
    expect(g.gesendet).toHaveLength(1);
    const x = g.gesendet[0];
    expect(x.threadId).toBe('mail01');
    const m = M.rfc822Lesen(x.raw);
    expect(m.kopf['in-reply-to']).toEqual(['<orig-1@mail.example.invalid>']);
    expect(m.kopf.references).toEqual(['<davor@mail.example.invalid> <orig-1@mail.example.invalid>']);
    expect(M.rfc2047Lesen(m.kopf.subject[0])).toBe('Re: Rahmenvertrag');
    expect(M.adressenLesen(m.kopf.from[0])).toEqual([{ name: 'MAKE Hello', email: 'hello@makeinnovation.test' }]);
    expect(M.adressenLesen(m.kopf.to[0])).toEqual([{ name: 'Anna Schmidt', email: 'anna@firma.example.invalid' }]);
    expect(m.text).toBe('Hallo Frau Schmidt,\n\ngern rufe ich Sie zurück — Grüße, Kevin');
    // sofort im Spiegel (Thread) und im Verlauf der Kontaktakte
    const thread = await GET(nachricht, '/api/gmail/nachricht?id=mail01');
    expect(thread.d.thread).toHaveLength(3);
    const ks = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
    expect(ks.find(c => c.id === 'c-anna-schmidt')!.aktivitaeten.some(a => a.art === 'mail' && a.von === 'kevin' && a.text?.startsWith('E-Mail gesendet'))).toBe(true);
    // Protokoll ohne Inhalt
    const proto = JSON.stringify(await db.loadJson(`aenderungsprotokoll--h--2026-10`));
    expect(proto).not.toContain('gern rufe ich');
  });
  it('Allen antworten: Empfänger An + Cc ohne die eigenen Adressen; Netz-Retry mit derselben anfrageId sendet nichts zweimal', async () => {
    const b = { ausNachricht: 'mail01', text: 'Danke an alle', an: [{ email: 'anna@firma.example.invalid' }], cc: [{ email: 'bert@firma.example.invalid' }], anfrageId: 'anfrage-0002' };
    const r1 = await POST(senden, '/api/gmail/senden', b);
    const r2 = await POST(senden, '/api/gmail/senden', b);
    expect(r1.status).toBe(200); expect(r2.status).toBe(200);
    expect(r2.d.id).toBe(r1.d.id);
    expect(g.gesendet).toHaveLength(1);
    expect(M.adressenLesen(M.rfc822Lesen(g.gesendet[0].raw).kopf.cc[0]).map(a => a.email)).toEqual(['bert@firma.example.invalid']);
  });
  it('Absender: nur eigene Adresse oder verifizierter Alias — fremde und unbestätigte → 400, nichts gesendet', async () => {
    for (const von of ['ceo@evil.example.invalid', 'alt@makeinnovation.test']) {
      const r = await POST(senden, '/api/gmail/senden', { ausNachricht: 'mail01', text: 'x', von });
      expect(r.status, von).toBe(400); expect(r.d.code).toBe('absender');
    }
    expect((await POST(senden, '/api/gmail/senden', { ausNachricht: 'mail01', text: 'x', von: 'kevin@makeinnovation.test' })).status).toBe(200);
    expect(M.adressenLesen(M.rfc822Lesen(g.gesendet[0].raw).kopf.from[0])[0].email).toBe('kevin@makeinnovation.test');
  });
  it('Eingaben: kein Text, ungültige Adressen (auch mit Zeilenumbruch), zu viele Empfänger, neue Mail ohne Betreff/Empfänger, unbekannte Mail → klare Fehler; kein Header-Injection', async () => {
    expect((await POST(senden, '/api/gmail/senden', { ausNachricht: 'mail01', text: '   ' })).d.code).toBe('kein-text');
    expect((await POST(senden, '/api/gmail/senden', { ausNachricht: 'mail01', text: 'x', an: [{ email: 'a@b.example.invalid\r\nBcc: e@x.example.invalid' }] })).d.code).toBe('adresse');
    expect((await POST(senden, '/api/gmail/senden', { ausNachricht: 'mail01', text: 'x', an: Array.from({ length: 21 }, (_, i) => ({ email: `p${i}@x.example.invalid` })) })).d.code).toBe('zu-viele');
    expect((await POST(senden, '/api/gmail/senden', { text: 'x', an: [{ email: 'a@b.example.invalid' }] })).d.code).toBe('betreff');
    expect((await POST(senden, '/api/gmail/senden', { text: 'x', betreff: 'Hallo' })).d.code).toBe('kein-empfaenger');
    expect((await POST(senden, '/api/gmail/senden', { ausNachricht: 'gibtsnicht1', text: 'x' })).status).toBe(404);
    expect(g.gesendet).toHaveLength(0);
    const neu = await POST(senden, '/api/gmail/senden', { text: 'Hallo', betreff: 'Neu\r\nBcc: evil@example.invalid', an: [{ email: 'a@b.example.invalid', name: 'A\r\nBcc: e@x.example.invalid' }] });
    expect(neu.status).toBe(200);
    const kopf = g.gesendet[0].raw.split('\r\n\r\n')[0];
    expect(kopf).not.toMatch(/^Bcc:/im);
    expect(g.gesendet[0].threadId).toBeUndefined();
  });
  it('§ 7 UWG: werblicher Text an eine Person mit Werbesperre → Rückfrage (409), nichts gesendet; bestätigt → gesendet; eine sachliche 1:1-Antwort geht ohne Rückfrage', async () => {
    const werblich = { ausNachricht: 'ben001', text: 'Gern schicke ich Ihnen ein Angebot und lade Sie zu unserem Webinar ein.' };
    const r = await POST(senden, '/api/gmail/senden', werblich);
    expect(r.status).toBe(409);
    expect(r.d).toMatchObject({ code: 'uwg', uwg: { woerter: expect.arrayContaining(['angebot', 'webinar']), empfaenger: [{ name: 'Ben Sperre' }] } });
    expect(g.gesendet).toHaveLength(0);
    expect((await POST(senden, '/api/gmail/senden', { ...werblich, uwgBestaetigt: true })).status).toBe(200);
    expect(g.gesendet).toHaveLength(1);
    expect((await POST(senden, '/api/gmail/senden', { ausNachricht: 'ben001', text: 'Ihre Frage beantworte ich so: ja.' })).status).toBe(200);
    // Eine Person mit gelber Ampel (bekannt) bekommt auch werbliche Wörter ohne Rückfrage — gewarnt wird nur ohne Grundlage (rot).
    expect((await POST(senden, '/api/gmail/senden', { ausNachricht: 'mail01', text: 'Anbei das Angebot.' })).status).toBe(200);
  });
  it('Art. 18: an eingeschränkte Personen nie (409) — auch nicht, wenn die Adresse frei eingegeben wird', async () => {
    const r = await POST(senden, '/api/gmail/senden', { ausNachricht: 'eva001', text: 'Hallo' });
    expect(r.status).toBe(409); expect(r.d.code).toBe('eingeschraenkt');
    expect((await POST(senden, '/api/gmail/senden', { text: 'Hallo', betreff: 'Frei', an: [{ email: 'EVA@y.example.invalid' }] })).d.code).toBe('eingeschraenkt');
    expect(g.gesendet).toHaveLength(0);
  });
  it('Google lehnt ab: 403 → Hinweis „erneut verbinden“, 400 → 502 — und die Mail steht NICHT im Spiegel', async () => {
    g.fehler.push({ teil: '/messages/send', status: 403 });
    const r = await POST(senden, '/api/gmail/senden', { ausNachricht: 'mail01', text: 'x', anfrageId: 'anfrage-0003' });
    expect(r.status).toBe(409); expect(r.d.fehler).toMatch(/Gmail verbinden/);
    g.fehler.push({ teil: '/messages/send', status: 400 });
    expect((await POST(senden, '/api/gmail/senden', { ausNachricht: 'mail01', text: 'x', anfrageId: 'anfrage-0003' })).status).toBe(502);
    expect(Object.keys((await S.ladeGmailStand('kevin'))!.koepfe)).toHaveLength(4);
    // Ein neuer Versuch mit derselben anfrageId darf laufen (die Ablehnung hat nichts bewirkt).
    expect((await POST(senden, '/api/gmail/senden', { ausNachricht: 'mail01', text: 'x', anfrageId: 'anfrage-0003' })).status).toBe(200);
  });
});

describe('ZOE-Entwurf — nur ein Vorschlag', () => {
  it('ohne Key: 503 needsKey; mit Key: der Entwurf; die fremde Mail geht als DATEN (fremde_daten), Anrede aus der Karte, nichts wird gesendet', async () => {
    expect((await POST(entwurf, '/api/gmail/entwurf', { id: 'mail01' })).d).toMatchObject({ ok: false, needsKey: true });
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-nur-im-test');
    const r = await POST(entwurf, '/api/gmail/entwurf', { id: 'mail01', hinweis: 'Rückruf anbieten' });
    expect(r.status).toBe(200);
    expect(r.d.draft).toContain('Guten Tag Frau Schmidt');
    expect(anthropic).toHaveLength(1);
    expect(anthropic[0].url).toBe('https://api.anthropic.com/v1/messages');
    const prompt = JSON.stringify(anthropic[0].body);
    expect(prompt).toContain('<fremde_daten quelle=\\"gmail\\">');
    expect(prompt).toContain('Bitte um Rückruf');
    expect(prompt).toContain('Sie-Form');
    expect(prompt).toContain('Rückruf anbieten');
    expect(prompt).toContain('Gib NUR den Mailtext aus');
    expect(g.gesendet).toHaveLength(0);
  });
  it('Art. 18: für eine eingeschränkte Person kein Entwurf (409), kein Modellaufruf; Dienstweg 403', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-nur-im-test');
    const r = await POST(entwurf, '/api/gmail/entwurf', { id: 'eva001' });
    expect(r.status).toBe(409);
    expect(anthropic).toHaveLength(0);
    expect((await POST(entwurf, '/api/gmail/entwurf', { id: 'mail01' }, dienst())).status).toBe(403);
    expect((await POST(entwurf, '/api/gmail/entwurf', { id: 'gibtsnicht1' })).status).toBe(404);
  });
  it('Brain-Kontext: Privates nie in die Mail an Dritte; der Systemtext trägt Stimme, Anrede und die Regel „nur Entwurf“', async () => {
    const { brainKontext, entwurfSystem } = await import('@/lib/gmail/entwurf');
    const t = (id: string, scope?: string) => ({ id, titel: `Notiz ${id}`, wurzel: 'x', bereich: 'Business', scope, punkte: 1, ausschnitt: `Inhalt ${id}`, ueberschriften: [], geaendert: '2026-10-01' });
    const ctx = brainKontext([t('a'), t('b', 'privat'), t('c')], 40);
    expect(ctx).toContain('Notiz a'); expect(ctx).toContain('Notiz c'); expect(ctx).not.toContain('Notiz b');
    expect(entwurfSystem('kevin', 'Du')).toContain('Du-Form');
    expect(entwurfSystem('kevin', 'Sie')).toContain('Sie-Form');
    expect(entwurfSystem('malin', undefined)).toContain('Malin');
    expect(entwurfSystem('kevin', 'Sie')).toMatch(/ENTWURF/);
  });
});
