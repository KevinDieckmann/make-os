// Inbox (09.10.): weitere Postfächer und Kundenpostfächer — Kevin: „ein zweites Google-Konto … von den Kunden Postfächer“.
// Ein Postfach in der Google-Workspace-Domain eines Kunden, verbunden über IMAP/SMTP mit App-Passwort (Anbieter `google`), Bereich = der
// Kunde (`m-<firmaId>`, CRM-Firma mit aktivem Mandat). Von Ende zu Ende mit nachgebautem Anbieter (PostSpeicher), nie ein echter Server:
// Prüfen VOR dem Speichern, Bereich Kunde (nur aktive Mandate, gespeicherter bleibt nach Mandatsende), Trennung auf dem Server
// („Sicht Privat bekommt nichts aus Kundenpostfach“, „Person B sieht Kevins Kundenpostfach nicht“, Dienstweg 403), Gmail legt Gesendetes
// selbst ab, Postfach ohne Bereich nur maskiert, Trennen. Dazu die reinen Regeln (lib/postfach/bereich.ts, anbieter.ts) und das Verzeichnis.
// Erfundene Daten (@example.invalid), keine Namen aus dem echten Bestand.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PostSpeicher as PS } from '@/lib/postfach/post-speicher';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-kundenpf-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-kundenpostfach';
process.env.MAKE_OS_KEY = 'dienst-test-kundenpostfach';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-kundenpf-0123456789abcdef';

const D = 'example.invalid';
const KUNDE_ADR = `kevin@beispielkunde.${D}`;
const APP_PW = 'abcdefghijklmnop';
const APP_PW_ANGEZEIGT = 'abcd efgh ijkl mnop';
const PRIVAT_ADR = 'kevin.privat@icloud.com';
const PRIVAT_PW = 'qrst-uvwx-yzab-cdef';
const FIRMA = 'f-beispielkunde';
const FIRMA_ALT = 'f-altkunde';
const KUNDE_NAME = 'Beispielkunde Muster GmbH';

type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let inbox: R, senden: R, postfaecher: R;
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

const KONTEN = { konten: [
  { id: 'k1', speicher: 'kevin', email: `kevin@${D}`, name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  { id: 'k2', speicher: 'malin', email: `malin@${D}`, name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
], einladungen: [] };

const crm = (statusAktiv = 'aktiv') => ({
  firmen: [{ id: FIRMA, name: KUNDE_NAME }, { id: FIRMA_ALT, name: 'Altkunde Beispiel AG' }],
  mandate: [{ id: 'm-1', firmaId: FIRMA, kunde: KUNDE_NAME, status: statusAktiv, titel: 'Beratung' }, { id: 'm-2', firmaId: FIRMA_ALT, kunde: 'Altkunde', status: 'beendet', titel: 'Alt' }],
  chancen: [], followups: [], kampagnen: [], events: [], beitraege: [], teilnahmen: [],
});

beforeAll(async () => {
  db = await import('@/lib/store/local-db'); A = await import('@/lib/postfach/abgleich'); T = await import('@/lib/postfach/transport'); P = await import('@/lib/postfach/post-speicher');
  inbox = await import('../app/api/inbox/route') as R; senden = await import('../app/api/inbox/senden/route') as R; postfaecher = await import('../app/api/inbox/postfaecher/route') as R;
});
afterAll(() => { T.transportSetzen(null); rmSync(ordner, { recursive: true, force: true }); });

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
  // Gmail über IMAP: Ordner wie bei Google (SPECIAL-USE, deutsche Namen), „Alle Nachrichten“ ist \All (nie Archiv-Ziel).
  server.set(KUNDE_ADR, new P.PostSpeicher({ passwort: APP_PW, ordner: [{ pfad: 'INBOX', specialUse: '\\Inbox' }, { pfad: '[Gmail]/Gesendet', specialUse: '\\Sent' }, { pfad: '[Gmail]/Alle Nachrichten', specialUse: '\\All' }] }));
  server.set('kevin.privat', new P.PostSpeicher({ passwort: PRIVAT_PW }));
  T.transportSetzen({
    imap: z => anbieter(z.benutzer).sitzung(z),
    smtp: (z, u, roh) => anbieter(z.benutzer === PRIVAT_ADR ? 'kevin.privat' : z.benutzer).senden(z, u, roh),
    waechter: async (z, _p, neu) => ({ stop: async () => { anbieter(z.benutzer).beobachten(neu)(); } }),
  });
  await db.saveJson('konten', KONTEN);
  await db.saveJson('kontakte', { kontakte: [] });
  await db.saveJson('crm', crm());
  server.get(KUNDE_ADR)!.ablegen('INBOX', P.rohNachricht({ von: `Kollegin <kollegin@beispielkunde.${D}>`, an: KUNDE_ADR, betreff: 'KUNDE-Projektstand', text: 'Wie ist der Stand?', messageId: `<k1@beispielkunde.${D}>` }));
  server.get('kevin.privat')!.ablegen('INBOX', P.rohNachricht({ von: `Freundin <freundin@privat.${D}>`, an: PRIVAT_ADR, betreff: 'PRIVAT-Einladung', text: 'Kommst du?', messageId: `<p1@${D}>` }));
});

async function kundeVerbinden(passwort = APP_PW_ANGEZEIGT, bereich = `m-${FIRMA}`) {
  return POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'google', adresse: KUNDE_ADR, passwort, bereich, absenderName: 'Kevin Beispiel' });
}
async function beideVerbinden(): Promise<{ kunde: string; privat: string }> {
  const a = await kundeVerbinden();
  const b = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'icloud', adresse: PRIVAT_ADR, passwort: PRIVAT_PW, bereich: 'privat' });
  expect(a.status, a.text).toBe(200); expect(b.status, b.text).toBe(200);
  await A.imapAbgleichen('kevin', a.d.id); await A.imapAbgleichen('kevin', b.d.id);
  return { kunde: a.d.id, privat: b.d.id };
}

describe('rein: Bereichs-Form und Anzeige (lib/postfach/bereich.ts)', () => {
  it('Kunde = m-<firmaId> wie der Mandanten-Space; Art, Raum, Name aus den gereichten Namen, Farben aus den vorhandenen Tokens', async () => {
    const B = await import('@/lib/postfach/bereich');
    const S = await import('@/lib/aufgaben/struktur');
    expect(B.kundenBereich(FIRMA)).toBe(S.mandantSpaceId(FIRMA));
    expect(B.firmaVonBereich(`m-${FIRMA}`)).toBe(FIRMA);
    expect(B.bereichArt(`m-${FIRMA}`)).toBe('kunde');
    expect(B.bereichArt('privat')).toBe('privat');
    expect(B.bereichArt('kdv')).toBe('gesellschaft');
    expect(B.bereichArt(null)).toBe('ohne');
    const a = B.bereichAnzeige(`m-${FIRMA}`, { [`m-${FIRMA}`]: KUNDE_NAME });
    expect(a).toMatchObject({ name: KUNDE_NAME, art: 'kunde', raum: 'business', farbe: S.MANDANT_FARBE });
    expect(B.bereichAnzeige('privat')).toMatchObject({ name: 'Privat', raum: 'privat', farbe: S.PRIVAT_FARBE });
    expect(B.bereichAnzeige(null)).toMatchObject({ art: 'ohne', raum: 'privat' });
    expect(B.bereichAnzeige(`m-${FIRMA}`)).toMatchObject({ name: 'Kunde (nicht mehr im CRM)' });
    expect(B.bereichAnzeige(`m-${FIRMA}`, {}, new Set([`m-${FIRMA}`])).archiv).toBe(true);
  });
  it('kundenBereiche: aktive Mandate wählbar, beendete nur als Archiv; Auswahl Privat · Gesellschaften · Kunden', async () => {
    const B = await import('@/lib/postfach/bereich');
    const k = B.kundenBereiche(crm());
    expect(k).toEqual([{ id: `m-${FIRMA}`, name: KUNDE_NAME, art: 'kunde' }, { id: `m-${FIRMA_ALT}`, name: 'Altkunde Beispiel AG', art: 'kunde', archiv: true }]);
    const w = B.bereichAuswahl([{ id: 'kdv', name: 'G1' }, { id: 'ug', name: 'G2' }], k);
    expect(w.map(x => x.id)).toEqual(['privat', 'kdv', 'ug', `m-${FIRMA}`]);
  });
  it('BEREICH_FORM: m-<firmaId> als Filter erlaubt, Unsinn nicht', async () => {
    const { BEREICH_FORM } = await import('@/lib/postfach/bereich');
    for (const ok of ['privat', 'kdv', 'g-abcd-1234', `m-${FIRMA}`]) expect(BEREICH_FORM.test(ok), ok).toBe(true);
    for (const nein of ['m-', 'm-X', 'm-a', 'kunde:x', '../m-a', 'm-a b']) expect(BEREICH_FORM.test(nein), nein).toBe(false);
  });
  it('imBereich: Kundenpostfach ist Business, nie Privat; Filter je Kunde', async () => {
    const { imBereich } = await import('@/lib/inbox/strom-server');
    expect(imBereich(`m-${FIRMA}`, { space: 'privat' })).toBe(false);
    expect(imBereich(`m-${FIRMA}`, { space: 'business' })).toBe(true);
    expect(imBereich(`m-${FIRMA}`, { bereich: `m-${FIRMA}` })).toBe(true);
    expect(imBereich('kdv', { bereich: `m-${FIRMA}` })).toBe(false);
  });
  it('Google-Voreinstellung: imap.gmail.com/smtp.gmail.com mit TLS, volle Adresse, App-Passwort ohne Leerzeichen; Microsoft 365 ehrlich nicht möglich', async () => {
    const An = await import('@/lib/postfach/anbieter');
    const g = An.VOREINSTELLUNGEN.google;
    expect(g.imap).toEqual({ host: 'imap.gmail.com', port: 993, sicherheit: 'ssl' });
    expect(g.smtp).toEqual({ host: 'smtp.gmail.com', port: 465, sicherheit: 'ssl' });
    expect(g.imapBenutzer('Kevin@Beispiel.example.invalid')).toBe('kevin@beispiel.example.invalid');
    expect(An.passwortFuer('google', APP_PW_ANGEZEIGT)).toBe(APP_PW);
    expect(An.passwortFuer('ionos', 'mit leer zeichen')).toBe('mit leer zeichen');
    expect(An.anbieterRaten('jemand@gmail.com')).toBe('google');
    expect(An.anbieterFuerFormular(false)).toContain('google');
    expect(g.link?.url).toBe('https://myaccount.google.com/apppasswords');
    expect(An.NICHT_MOEGLICH.some(n => /Microsoft/.test(n.name))).toBe(true);
  });
  it('postfaecherSicht: Postfach ohne Bereich in JEDER Sicht nur mit maskierter Adresse („jetzt zuordnen“)', async () => {
    const { postfaecherSicht } = await import('@/lib/inbox/strom-server');
    const d = { postfaecher: [{ id: 'gmail', bereich: null, quelle: 'gmail', adresse: `kevin@firma.${D}` }, { id: 'a', bereich: `m-${FIRMA}`, quelle: 'imap', adresse: KUNDE_ADR }], gespraeche: [], bereiche: [], absender: [] };
    const b = postfaecherSicht(d, 'business');
    expect(b.postfaecher.map(p => p.id)).toEqual(['a']);
    expect(b.ohneBereich).toEqual([{ id: 'gmail', quelle: 'gmail', adresse: `k***@firma.${D}` }]);
    expect(JSON.stringify(b.ohneBereich)).not.toContain(`kevin@firma.${D}`);
    expect(postfaecherSicht(d, null).ohneBereich).toHaveLength(1);
  });
  it('Verzeichnis: „E-Mail (Postfächer bei Kunden)“ wird einmal nachgetragen (idempotent), ohne neuen Empfänger; Art. 15 kennt es', async () => {
    const { verzeichnisVervollstaendigen, VV_EMAIL_KUNDEN_ID } = await import('@/lib/crm/datenschutz');
    const J = '2026-10-09T10:00:00.000Z';
    const r = verzeichnisVervollstaendigen([], J);
    const v = r.liste.find(x => x.id === VV_EMAIL_KUNDEN_ID)!;
    expect(v.empfaengerIds).toEqual(['hetzner', 'anthropic']);
    expect(verzeichnisVervollstaendigen(r.liste, J).geaendert).toBe(false);
    const { KONTAKT_JE_BEREICH, KONTO_VERARBEITUNGEN } = await import('@/lib/datenschutz/art15');
    expect(KONTAKT_JE_BEREICH.postfach).toContain(VV_EMAIL_KUNDEN_ID);
    expect(KONTO_VERARBEITUNGEN).toContain(VV_EMAIL_KUNDEN_ID);
  });
});

describe('Kundenpostfach von Ende zu Ende', () => {
  it('Bereiche zur Wahl: Kunden mit aktivem Mandat (Name aus dem CRM), nie beendete; Anbieter Google dabei', async () => {
    const r = await GET(postfaecher, '/api/inbox/postfaecher');
    expect(r.status).toBe(200);
    expect(r.d.bereiche).toContainEqual({ id: `m-${FIRMA}`, name: KUNDE_NAME, art: 'kunde' });
    expect(r.d.bereiche.map((b: { id: string }) => b.id)).not.toContain(`m-${FIRMA_ALT}`);
    expect(r.d.bereiche[0]).toEqual({ id: 'privat', name: 'Privat', art: 'privat' });
    expect(r.d.anbieter.map((a: { id: string }) => a.id)).toContain('google');
    expect(r.d.nichtMoeglich.length).toBeGreaterThan(0);
    // Business-Sicht: Kunden ja, Privat nicht zur Wahl.
    const b = await GET(postfaecher, '/api/inbox/postfaecher?space=business');
    expect(b.d.bereiche.map((x: { id: string }) => x.id)).toContain(`m-${FIRMA}`);
    expect(b.d.bereiche.map((x: { id: string }) => x.id)).not.toContain('privat');
  });
  it('erst prüfen, dann speichern: beendetes Mandat → 400, falsches App-Passwort → 409 — jeweils NICHTS gespeichert', async () => {
    const alt = await kundeVerbinden(APP_PW_ANGEZEIGT, `m-${FIRMA_ALT}`);
    expect(alt.status).toBe(400);
    const falsch = await kundeVerbinden('falschfalschfals');
    expect(falsch.status).toBe(409);
    expect(falsch.d).toMatchObject({ ok: false, code: 'anmeldung' });
    expect(await db.loadJson('postfach-zugang--kevin')).toBeNull();
    expect((await GET(postfaecher, '/api/inbox/postfaecher')).d.postfaecher).toEqual([]);
  });
  it('App-Passwort mit Leerzeichen wird angenommen; Register mit Google-Servern, voller Adresse, Gesendet-Ordner; Name aus dem CRM; Passwort nie in einer Antwort', async () => {
    const ids = await beideVerbinden();
    const reg = (await db.loadJson<{ postfaecher: { id: string; bereich: string; anbieter: string; imap: unknown; smtp: unknown; benutzer: string; ordner: Record<string, string> }[] }>('postfaecher--kevin'))!.postfaecher;
    const k = reg.find(p => p.id === ids.kunde)!;
    expect(k).toMatchObject({ bereich: `m-${FIRMA}`, anbieter: 'google', benutzer: KUNDE_ADR, imap: { host: 'imap.gmail.com', port: 993 }, smtp: { host: 'smtp.gmail.com', port: 465 } });
    expect(k.ordner.gesendet).toBe('[Gmail]/Gesendet');
    expect(k.ordner.archiv).toBeUndefined();
    const zugang = await db.loadJson<{ zugang: Record<string, { passwort: string }> }>('postfach-zugang--kevin');
    expect(zugang!.zugang[ids.kunde].passwort).toBe(APP_PW);
    const liste = await GET(postfaecher, '/api/inbox/postfaecher');
    const pk = liste.d.postfaecher.find((p: { id: string }) => p.id === ids.kunde);
    expect(pk).toMatchObject({ bereich: `m-${FIRMA}`, bereichName: KUNDE_NAME, anbieter: 'google' });
    const strom = await GET(inbox, '/api/inbox');
    for (const a of [liste, strom]) { expect(a.text).not.toContain(APP_PW); expect(a.text).not.toContain(PRIVAT_PW); }
  });
  it('Trennung auf dem Server: Sicht Privat bekommt nichts aus dem Kundenpostfach; Business und Filter je Kunde zeigen es', async () => {
    await beideVerbinden();
    const privat = await GET(inbox, '/api/inbox?space=privat');
    expect(privat.status).toBe(200);
    expect(privat.text).not.toContain('KUNDE-Projektstand');
    expect(privat.text).not.toContain(KUNDE_ADR);
    expect(privat.text).toContain('PRIVAT-Einladung');
    const business = await GET(inbox, '/api/inbox?space=business');
    expect(business.text).toContain('KUNDE-Projektstand');
    expect(business.text).not.toContain('PRIVAT-Einladung');
    const kunde = await GET(inbox, `/api/inbox?bereich=m-${FIRMA}`);
    expect(kunde.status).toBe(200);
    expect(kunde.d.gespraeche.map((g: { betreff: string }) => g.betreff)).toEqual(['KUNDE-Projektstand']);
    expect(kunde.d.bereiche).toContainEqual({ id: `m-${FIRMA}`, name: KUNDE_NAME });
    expect((await GET(inbox, '/api/inbox?bereich=m-X')).status).toBe(400);
    // Die Postfächer-Verwaltung der Privat-Sicht ist „alles Eigene“ (die Person verwaltet ihre Postfächer); Business zeigt das Kundenpostfach.
    const pfB = await GET(postfaecher, '/api/inbox/postfaecher?space=business');
    expect(pfB.d.postfaecher.map((p: { bereich: string }) => p.bereich)).toEqual([`m-${FIRMA}`]);
  });
  it('Person B sieht Kevins Kundenpostfach nicht (Strom, Postfächer, Suche über Bereich), Dienstweg 403', async () => {
    await beideVerbinden();
    for (const url of ['/api/inbox', '/api/inbox?space=business', `/api/inbox?bereich=m-${FIRMA}`]) {
      const m = await GET(inbox, url, sitzung('malin'));
      expect(m.text, url).not.toContain('KUNDE-Projektstand');
      expect(m.text, url).not.toContain(KUNDE_ADR);
    }
    const pf = await GET(postfaecher, '/api/inbox/postfaecher', sitzung('malin'));
    expect(pf.text).not.toContain(KUNDE_ADR);
    expect(pf.d.mitDirGeteilt ?? []).toEqual([]);
    expect((await GET(inbox, '/api/inbox', dienst())).status).toBe(403);
    expect((await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'google', adresse: KUNDE_ADR, passwort: APP_PW, bereich: `m-${FIRMA}` }, dienst())).status).toBe(403);
  });
  it('Antworten aus dem Kundenpostfach: Absender = Kundenadresse über smtp.gmail.com, keine zweite Kopie in „Gesendet“ (Gmail legt selbst ab)', async () => {
    await beideVerbinden();
    const s = server.get(KUNDE_ADR)!;
    const g = ((await GET(inbox, `/api/inbox?bereich=m-${FIRMA}`)).d.gespraeche as { id: string }[])[0];
    const r = await POST(senden, '/api/inbox/senden', { gespraech: g.id, text: 'Stand kommt morgen.', anfrageId: 'anf-21111111-2222-4333-8444-555555555555' });
    expect(r.status, r.text).toBe(200);
    expect(s.gesendet).toHaveLength(1);
    expect(s.gesendet[0]).toMatchObject({ von: KUNDE_ADR, an: [`kollegin@beispielkunde.${D}`] });
    expect(s.nachrichten('[Gmail]/Gesendet')).toHaveLength(0);
  });
  it('Bereich ändern: nur Kunden mit aktivem Mandat; nach Mandatsende bleibt der gespeicherte Bereich speicherbar, ein Wechsel auf einen beendeten nicht', async () => {
    const { kunde } = await beideVerbinden();
    expect((await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'einstellen', id: kunde, bereich: `m-${FIRMA_ALT}` })).status).toBe(400);
    await db.saveJson('crm', crm('beendet'));
    db.leseCacheLeeren();
    const r = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'einstellen', id: kunde, bereich: `m-${FIRMA}`, anzeigename: 'Beispielkunde' });
    expect(r.status, r.text).toBe(200);
    const liste = await GET(postfaecher, '/api/inbox/postfaecher');
    // Nicht mehr wählbar — aber das Postfach behält Bereich und Namen aus dem CRM.
    expect(liste.d.bereiche.map((b: { id: string }) => b.id)).not.toContain(`m-${FIRMA}`);
    expect(liste.d.postfaecher.find((p: { id: string }) => p.id === kunde)).toMatchObject({ bereich: `m-${FIRMA}`, bereichName: KUNDE_NAME });
  });
  it('Trennen: Spiegel, App-Passwort und Register-Eintrag weg — das Privat-Postfach bleibt', async () => {
    const { kunde, privat } = await beideVerbinden();
    const r = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'trennen', id: kunde });
    expect(r.status).toBe(200);
    const zugang = await db.loadJson<{ zugang: Record<string, unknown> }>('postfach-zugang--kevin');
    expect(zugang!.zugang[kunde]).toBeUndefined();
    expect(zugang!.zugang[privat]).toBeDefined();
    const alle = await GET(inbox, '/api/inbox');
    expect(alle.text).not.toContain('KUNDE-Projektstand');
    expect(alle.text).toContain('PRIVAT-Einladung');
  });
});
