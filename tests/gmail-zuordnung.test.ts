// Gmail: Zuordnung (Kontakt über Haupt- UND weitere Adressen → Firma/Deal), Verlauf der Kontaktakte (Betreff + Link, nie Text; idempotent),
// Art. 18/Werbesperre/Sammeladressen, unbekannter Absender → Kontakt anlegen (Anfrage über Mail, Marketing-Lead), Aufgabe/Follow-up/
// Termin/Kontakt aus der Mail über die vorhandenen Schreibwege, Art. 15/17 im Spiegel (Original bleibt in Gmail), Speicher-Register.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import { GmailFake } from './fixtures/gmail-fake';
import { KONTEN, umgebung } from './fixtures/gmail-setup';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-gmail-z-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-gmail-zuordnung';
process.env.MAKE_OS_KEY = 'dienst-test-gmail-zuordnung';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-gmail-zuordnung-0123456789abcdef';

type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response> };
let V: typeof import('@/lib/google/verbindung'), A: typeof import('@/lib/gmail/abgleich'), S: typeof import('@/lib/gmail/stand'), Z: typeof import('@/lib/gmail/zuordnung'), db: typeof import('@/lib/store/local-db');
let AM: typeof import('@/lib/gmail/aus-mail'), anfrage: R, followup: R, tasks: R;
let g: GmailFake;

const k = (id: string, vorname: string, nachname: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname, nachname, stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie', ...x } as Kontakt);
const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const post = (route: R, url: string, body: unknown, h: Record<string, string> = sitzung('kevin')) => route.POST!(new Request(`http://localhost${url}`, { method: 'POST', headers: h, body: JSON.stringify(body) })).then(async r => ({ status: r.status, d: await r.json() as Record<string, any> })); // eslint-disable-line @typescript-eslint/no-explicit-any

beforeAll(async () => {
  V = await import('@/lib/google/verbindung'); A = await import('@/lib/gmail/abgleich'); S = await import('@/lib/gmail/stand'); Z = await import('@/lib/gmail/zuordnung'); db = await import('@/lib/store/local-db');
  AM = await import('@/lib/gmail/aus-mail');
  anfrage = await import('../app/api/crm/anfrage/route') as R; followup = await import('../app/api/crm/followup/route') as R; tasks = await import('../app/api/tasks/create/route') as R;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const kontakte = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-03T08:00:00.000Z'));
  g = new GmailFake(); umgebung(vi, g);
  await db.saveJson('konten', KONTEN);
  await db.saveJson('kontakte', { kontakte: [
    k('c-anna-schmidt', 'Anna', 'Schmidt', { email: 'anna@firma.example.invalid', emails: [{ adresse: 'anna@firma.example.invalid', haupt: true }, { adresse: 'a.schmidt@privat.example.invalid', art: 'privat' }], firma: 'Beispiel GmbH', firmaId: 'f-beispiel' }),
    k('c-ben-sperre', 'Ben', 'Sperre', { email: 'ben@x.example.invalid', werbesperre: { seit: '2026-08-01', grund: 'Widerspruch' } as never }),
    k('c-eva-eingeschraenkt', 'Eva', 'Eng', { email: 'eva@y.example.invalid', eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'kevin' } }),
    k('c-info-sammel', 'Info', 'Firma', { email: 'info@sammel.example.invalid' }),
  ] });
  await db.saveJson('crm', { firmen: [{ id: 'f-beispiel', name: 'Beispiel GmbH' }], chancen: [{ id: 'd-1', titel: 'Rahmenvertrag', stufe: 'angebot', kontaktIds: ['c-anna-schmidt'] }], mandate: [], followups: [], kampagnen: [], events: [], beitraege: [], teilnahmen: [] });
  const { url } = await V.verbindungStarten('kevin', ['gmail']);
  await V.verbindungAbschliessen('kevin', 'code-ok', new URL(url).searchParams.get('state')!);
});

describe('Zuordnung und Verlauf', () => {
  it('Absender → Kontakt über die HAUPT- und über eine WEITERE Adresse; Firma und offener Deal stehen dabei; Verlauf: eine Zeile, Betreff + Link, nie der Text', async () => {
    g.mail({ id: 'm1', von: 'Anna Schmidt <anna@firma.example.invalid>', betreff: 'Rahmenvertrag — Rückfrage', text: 'STRENG-VERTRAULICHER-TEXT über Preise', vorMin: 90 });
    g.mail({ id: 'm2', von: 'A. Schmidt <a.schmidt@privat.example.invalid>', betreff: 'Noch eine Frage', text: 'nur Text', vorMin: 50 });
    await A.gmailAbgleichen('kevin');
    const s = (await S.ladeGmailStand('kevin'))!;
    const z = await Z.zuordnungenFuer(Object.values(s.koepfe), s);
    expect(z.m1).toMatchObject({ kontaktId: 'c-anna-schmidt', name: 'Anna Schmidt', firma: 'Beispiel GmbH', firmaId: 'f-beispiel', dealId: 'd-1', dealTitel: 'Rahmenvertrag' });
    expect(z.m2.kontaktId).toBe('c-anna-schmidt');
    // Inbox 2 (06.10.): angezeigt wird sofort, in den Verlauf kommt es erst nach „Zuordnen“ (je Gespräch, ein Klick).
    expect((await kontakte()).find(c => c.id === 'c-anna-schmidt')!.aktivitaeten).toHaveLength(0);
    const inbox = await import('../app/api/inbox/route') as R;
    for (const id of ['gm~m1', 'gm~m2']) expect((await post(inbox, '/api/inbox', { aktion: 'zuordnen', id })).d.ok, id).toBe(true);
    const a = (await kontakte()).find(c => c.id === 'c-anna-schmidt')!.aktivitaeten;
    expect(a).toHaveLength(2);
    expect(a.find(x => x.mailLink === '/os/inbox?offen=gmail-m1')).toMatchObject({ art: 'antwort', text: 'Betreff: Rahmenvertrag — Rückfrage', von: 'system' });
    expect(JSON.stringify(a)).not.toContain('STRENG-VERTRAULICH');
    expect((await kontakte()).find(c => c.id === 'c-anna-schmidt')!.letzterKontakt).toBe('2026-10-03');
    // Wiederholung: nichts doppelt
    await A.gmailAbgleichen('kevin', { voll: true });
    expect((await kontakte()).find(c => c.id === 'c-anna-schmidt')!.aktivitaeten).toHaveLength(2);
  });
  it('gesendete Mail: Aktivität „E-Mail“ mit der Person, die gesendet hat; Sammeladresse und Unbekannte: keine Zeile', async () => {
    g.mail({ id: 's1', von: 'kevin@makeinnovation.test', an: 'anna@firma.example.invalid', betreff: 'Re: Rahmenvertrag', text: 'x', labels: ['SENT'] });
    g.mail({ id: 'i1', von: 'Info <info@sammel.example.invalid>', betreff: 'Newsletter', text: 'x' });
    g.mail({ id: 'u1', von: 'fremd@nirgends.example.invalid', betreff: 'Unbekannt', text: 'x' });
    await A.gmailAbgleichen('kevin');
    const inbox = await import('../app/api/inbox/route') as R;
    expect((await post(inbox, '/api/inbox', { aktion: 'zuordnen', id: 'gm~s1' })).d.ok).toBe(true);
    // Sammeladresse: es gibt keine Person zum Zuordnen.
    expect((await post(inbox, '/api/inbox', { aktion: 'zuordnen', id: 'gm~i1' })).status).toBe(400);
    const ks = await kontakte();
    expect(ks.find(c => c.id === 'c-anna-schmidt')!.aktivitaeten[0]).toMatchObject({ art: 'mail', von: 'kevin', text: 'E-Mail gesendet · Betreff: Re: Rahmenvertrag', mailLink: '/os/inbox?offen=gmail-s1' });
    expect(ks.find(c => c.id === 'c-info-sammel')!.aktivitaeten).toHaveLength(0);
    const s = (await S.ladeGmailStand('kevin'))!;
    expect((await Z.zuordnungenFuer([s.koepfe.u1, s.koepfe.i1], s))).toEqual({});
  });
  it('Werbesperre und Art. 18: Anzeige ja (mit Kennzeichnung), aber KEIN Verlauf', async () => {
    g.mail({ id: 'b1', von: 'ben@x.example.invalid', betreff: 'Bitte keine Werbung', text: 'x' });
    g.mail({ id: 'e1', von: 'eva@y.example.invalid', betreff: 'Hallo', text: 'x' });
    await A.gmailAbgleichen('kevin');
    const s = (await S.ladeGmailStand('kevin'))!;
    const z = await Z.zuordnungenFuer(Object.values(s.koepfe), s);
    expect(z.b1).toMatchObject({ name: 'Ben Sperre', sperre: 'werbesperre', mailAmpel: 'rot' });
    expect(z.e1).toMatchObject({ name: 'Eva Eng', sperre: 'eingeschraenkt', mailAmpel: 'rot' });
    const ks = await kontakte();
    expect(ks.find(c => c.id === 'c-ben-sperre')!.aktivitaeten).toHaveLength(0);
    expect(ks.find(c => c.id === 'c-eva-eingeschraenkt')!.aktivitaeten).toHaveLength(0);
  });
  it('die Zeile steht auch dann, wenn die Person erst NACH der Mail in die Kartei kommt (nächster Lauf zieht nach)', async () => {
    g.mail({ id: 'n1', von: 'Neu Person <neu@spaeter.example.invalid>', betreff: 'Anfrage zum Produkt', text: 'Guten Tag' });
    await A.gmailAbgleichen('kevin');
    const s = (await S.ladeGmailStand('kevin'))!;
    expect(await Z.gmailVerlaufSchreiben('kevin', s)).toBe(0);
    await db.saveJson('kontakte', { kontakte: [...(await kontakte()), k('c-neu-person', 'Neu', 'Person', { email: 'neu@spaeter.example.invalid' })] });
    expect(await Z.gmailVerlaufSchreiben('kevin', s)).toBe(1);
    expect((await kontakte()).find(c => c.id === 'c-neu-person')!.aktivitaeten[0].mailLink).toBe('/os/inbox?offen=gmail-n1');
    expect(await Z.gmailVerlaufSchreiben('kevin', s)).toBe(0);
  });
  it('die Link-Form wird gesäubert (nur /os/inbox?offen=gmail-<Kennung>) und überlebt die Kartei-Säuberung', async () => {
    const { saeubereKontakt } = await import('@/lib/make-one/crm');
    const mk = (mailLink: string) => saeubereKontakt({ ...k('c-test-link', 'T', 'L', { stufe: 'neu' }), aktivitaeten: [{ am: '2026-10-03T08:00:00.000Z', art: 'antwort', von: 'system', text: 'Betreff: x', mailLink }] })!.aktivitaeten[0].mailLink;
    expect(mk('/os/inbox?offen=gmail-18c0000001ab')).toBe('/os/inbox?offen=gmail-18c0000001ab');
    for (const bose of ['https://evil.example.invalid/', '/os/inbox?offen=gmail-x', 'javascript:alert(1)', '/os/inbox?offen=gmail-abc123&x=1', '//evil.example.invalid']) expect(mk(bose)).toBeUndefined();
  });
});

describe('Unbekannter Absender → Kontakt anlegen (Anfrage über Mail) — Marketing-Lead', () => {
  it('Eingabe aus der Mail: Namen geteilt, Adresse, Betreff + Kurzfassung (nie der ganze Text); über /api/crm/anfrage: Herkunft „selbst“, Vertrag/Anbahnung, „Antwort auf Anfrage“, Follow-up', async () => {
    g.mail({ id: 'n1', von: '"Schulz, Petra" <petra@neu.example.invalid>', betreff: 'Re: Anfrage Beratung', text: 'Guten Tag, wir interessieren uns für Ihre Beratung. Das hier ist ein sehr langer Text …'.repeat(20) });
    await A.gmailAbgleichen('kevin');
    const kopf = (await S.ladeGmailStand('kevin'))!.koepfe.n1;
    const e = AM.kontaktAusMail(kopf, '2026-10-03');
    expect(e).toMatchObject({ kanal: 'mail', neu: { vorname: 'Petra', nachname: 'Schulz', email: 'petra@neu.example.invalid' }, datum: '2026-10-03' });
    expect(e.text.length).toBeLessThanOrEqual(600);
    expect(e.text.startsWith('Anfrage Beratung')).toBe(true);
    const r = await post(anfrage, '/api/crm/anfrage', { aktion: 'anlegen', ...e });
    expect(r.status).toBe(200);
    expect(r.d.neuePerson).toBe(true);
    const c = (await kontakte()).find(x => x.email === 'petra@neu.example.invalid')!;
    expect(c).toMatchObject({ herkunft: 'selbst', rechtsgrundlage: 'vertrag', quelle: 'Anfrage über Mail', stufe: 'angesprochen' });
    expect(c.einwilligungen?.[0]).toMatchObject({ kanal: 'mail', grundlage: 'anfrage' });
    expect(c.aktivitaeten[0].text?.startsWith('Anfrage über Mail:')).toBe(true);
    // Eine Anfrage über Mail zählt als Marketing-Lead (istMarketingLead) — Anfrage = Marketing-Herkunft.
    const { istMarketingLead } = await import('@/lib/crm/scoring');
    expect(istMarketingLead([c])).toBe(true);
    // Der nächste Abgleich hängt die Mail an die neue Person (Zuordnung).
    await A.gmailAbgleichen('kevin', { voll: true });
    const s = (await S.ladeGmailStand('kevin'))!;
    expect((await Z.zuordnungenFuer([s.koepfe.n1], s)).n1).toMatchObject({ name: 'Petra Schulz' });
    expect((await Z.zuordnungenFuer([s.koepfe.n1], s)).n1.sperre).toBeUndefined();
  });
  it('Namen teilen: „Vorname Nachname“, „Nachname, Vorname“, nur Adresse', () => {
    expect(AM.nameTeilen('Anna Maria Schmidt')).toEqual({ vorname: 'Anna Maria', nachname: 'Schmidt' });
    expect(AM.nameTeilen('Schmidt, Anna')).toEqual({ vorname: 'Anna', nachname: 'Schmidt' });
    expect(AM.nameTeilen('Schmidt')).toEqual({ vorname: '', nachname: 'Schmidt' });
    expect(AM.nameTeilen('anna@x.example.invalid')).toEqual({ vorname: '', nachname: '' });
    expect(AM.nameTeilen(undefined)).toEqual({ vorname: '', nachname: '' });
  });
});

describe('Aufgabe, Follow-up, Termin aus der Mail — über die vorhandenen Schreibwege', () => {
  async function mail() {
    g.mail({ id: 'm1', von: 'Anna Schmidt <anna@firma.example.invalid>', betreff: 'AW: Rahmenvertrag — Rückfrage', text: 'Bitte um Rückruf' });
    await A.gmailAbgleichen('kevin');
    const s = (await S.ladeGmailStand('kevin'))!;
    return { kopf: s.koepfe.m1, z: (await Z.zuordnungenFuer([s.koepfe.m1], s)).m1 };
  }
  it('Aufgabe: Titel aus dem Betreff (ohne AW:), Beschreibung mit Absender + Link zurück zur Mail, Bezug Kontakt/Firma/Deal — angelegt über /api/tasks/create', async () => {
    const { kopf, z } = await mail();
    const a = AM.aufgabeAusMail(kopf, z);
    expect(a).toMatchObject({ title: 'Rahmenvertrag — Rückfrage', space: 'business', bezug: { kontaktId: 'c-anna-schmidt', firmaId: 'f-beispiel', dealId: 'd-1' } });
    expect(a.description).toBe('Aus Gmail · Anna Schmidt <anna@firma.example.invalid>\n/os/inbox?offen=gmail-m1');
    expect(a.description).not.toContain('Bitte um Rückruf');   // nie der Mailtext
    const r = await post(tasks, '/api/tasks/create', { title: a.title, description: a.description, space: a.space, bezug: a.bezug, owner: 'kevin' });
    expect(r.status).toBe(200);
    expect(r.d.id).toBeTruthy();
    const { aufgabenSicht } = await import('@/lib/aufgaben/papierkorb');
    void aufgabenSicht;
    const roh = JSON.stringify(await db.loadJson('tasks'));
    expect(roh).toContain('/os/inbox?offen=gmail-m1');
    expect(roh).toContain('c-anna-schmidt');
    // zweites Mal: nicht doppelt
    expect((await post(tasks, '/api/tasks/create', { title: a.title, description: a.description, owner: 'kevin' })).d.duplikat).toBe(true);
  });
  it('Follow-up: nur mit zugeordneter Person; Text = „Mail beantworten: Betreff“, Notiz mit Link; über /api/crm/followup', async () => {
    const { kopf, z } = await mail();
    expect(AM.followUpAusMail(kopf, null, '2026-10-04')).toBeNull();
    const f = AM.followUpAusMail(kopf, z, '2026-10-04')!;
    expect(f).toMatchObject({ aktion: 'anlegen', bezug: { art: 'kontakt', id: 'c-anna-schmidt' }, kontaktId: 'c-anna-schmidt', art: 'mail', faellig: '2026-10-04' });
    expect(f.text).toBe('Mail beantworten: Rahmenvertrag — Rückfrage');
    expect(f.notiz).toContain('/os/inbox?offen=gmail-m1');
    const r = await post(followup, '/api/crm/followup', f);
    expect(r.status).toBe(200);
    const crm = await db.loadJson<{ followups: { text: string; kontaktId: string; faellig: string; notiz?: string }[] }>('crm');
    expect(crm!.followups.at(-1)).toMatchObject({ text: 'Mail beantworten: Rahmenvertrag — Rückfrage', kontaktId: 'c-anna-schmidt', faellig: '2026-10-04' });
  });
  it('Termin: Vorgabe für den Termin-Dialog mit Titel, Bezug und Notiz mit Link; Business landet über kalenderZiel im Google Kalender der Person', async () => {
    const { kopf, z } = await mail();
    const v = AM.terminVorgabe(kopf, z, '2026-10-03', 'kevin', 'https://app.makeinnovation.test');
    expect(v).toMatchObject({ tag: '2026-10-03', wer: 'kevin', titel: 'Rahmenvertrag — Rückfrage', crm: { kontaktId: 'c-anna-schmidt', firmaId: 'f-beispiel', dealId: 'd-1' } });
    expect(v.notiz).toBe('Aus Gmail · Anna Schmidt <anna@firma.example.invalid>\nhttps://app.makeinnovation.test/os/inbox?offen=gmail-m1');
    const { formularStart } = await import('@/lib/kalender/formular');
    expect(formularStart(v, 60).notiz).toBe(v.notiz);
    expect(formularStart(v, 60).crm).toEqual(v.crm);
    // Business → Google Kalender der Person: die Zuordnung liefert für `business` den Google-Kalender, sobald Kalender verbunden ist.
    const { url } = await V.verbindungStarten('kevin', ['kalender']);
    await V.verbindungAbschliessen('kevin', 'code-ok', new URL(url).searchParams.get('state')!);
    const { googleKalenderWaehlen } = await import('@/lib/kalender/google/abgleich');
    await googleKalenderWaehlen('kevin', 'primary');
    const { kalenderZiel } = await import('@/lib/kalender/google/ziel');
    const ziel = await kalenderZiel('kevin', 'business');
    expect(ziel).toMatchObject({ quelle: 'google' });
  });
});

describe('Art. 15/17 im Spiegel — das Original bleibt in Gmail', () => {
  it('Mails, die die Person nennen, fallen in Kopf UND Text weg; andere bleiben; „dort löschen“ wird gezählt; Auskunft zählt vorher', async () => {
    g.mail({ id: 'a1', von: 'Anna <anna@firma.example.invalid>', betreff: 'Eins', text: 'Hallo' });
    g.mail({ id: 'a2', von: 'kevin@makeinnovation.test', an: 'a.schmidt@privat.example.invalid', betreff: 'Zwei', text: 'Danke', labels: ['SENT'] });
    g.mail({ id: 'x1', von: 'jemand@sonst.example.invalid', betreff: 'Drei', text: 'Erwähnt Anna Schmidt im Text' });
    g.mail({ id: 'x2', von: 'jemand@sonst.example.invalid', betreff: 'Vier', text: 'Ganz anderes Thema' });
    await A.gmailAbgleichen('kevin');
    const { personAufzaehlen, personEntfernen } = await import('@/lib/crm/person-bestaende');
    const ausk = await personAufzaehlen('c-anna-schmidt');
    expect(JSON.stringify(ausk)).toMatch(/gmail-stand--kevin/);
    const b = await personEntfernen('c-anna-schmidt');
    // a1 (Absender), a2 (Empfänger über die weitere Adresse) und x1 (der Name steht im Ausschnitt/Text) nennen die Person — x2 nicht.
    expect(b.speicher['gmail-stand--kevin']).toBe(3);
    expect(b.speicher['gmail-text--kevin']).toBe(3);
    expect(b.nurInApple?.['gmail-stand--kevin']).toBe(3);    // Hinweis „dort löschen“: das Original bleibt in Gmail
    const s = (await S.ladeGmailStand('kevin'))!, t = await S.ladeGmailTexte('kevin');
    expect(Object.keys(s.koepfe)).toEqual(['x2']);
    expect(Object.keys(t.texte)).toEqual(['x2']);
    expect(JSON.stringify([s, t])).not.toMatch(/anna@firma|a\.schmidt@privat|Anna Schmidt/);
    expect(g.nachrichten.size).toBe(4);                        // in Gmail ist nichts angefasst worden
  });
  it('Speicher-Register: die beiden Bestände sind registriert (entfernen, Frist Mail-Spiegel), der Löschlauf kennt sie', async () => {
    const { registerEintrag } = await import('@/lib/crm/speicher-register');
    const { weitererSpeicher } = await import('@/lib/crm/person-weitere');
    for (const n of ['gmail-stand--kevin', 'gmail-text--malin']) {
      expect(registerEintrag(n)).toMatchObject({ bezug: 'dritte', behandlung: 'entfernen', frist: 'mail-spiegel' });
      expect(weitererSpeicher(n)?.behandlung).toBe('entfernen');
    }
    expect(weitererSpeicher('gmail-stand--../x')).toBeNull();
    const { LOESCHFRISTEN } = await import('@/lib/crm/loeschfristen');
    expect(LOESCHFRISTEN.find(f => f.id === 'mail-spiegel')).toMatchObject({ standard: 180, einheit: 'tage', wirkung: 'automatisch' });
  });
  it('VVT „E-Mail (Google Workspace)“ wird idempotent nachgetragen und nennt Auftragsverarbeiter, Frist und Scope', async () => {
    const { verarbeitungEmailNachtragen, VV_EMAIL_GOOGLE_ID } = await import('@/lib/crm/datenschutz');
    const a = verarbeitungEmailNachtragen([], '2026-10-03T10:00:00Z');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ id: VV_EMAIL_GOOGLE_ID, name: 'E-Mail (Google Workspace)' });
    expect(a[0].empfaenger).toMatch(/Google/); expect(a[0].loeschfrist).toMatch(/180 Tage/); expect(a[0].toms).toMatch(/gmail\.modify/);
    expect(verarbeitungEmailNachtragen(a, '2026-10-04T10:00:00Z')).toHaveLength(1);
  });
});
