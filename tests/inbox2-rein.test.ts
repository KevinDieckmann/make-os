// Inbox 2 (06.10.): die reinen Teile — Rohnachricht lesen (IMAP → dieselbe Kopf-Form wie Gmail), Fächer (Antworten/Warten/Neu/Info/
// Termine/Geld), Fristen im Text, Gespräche über Message-ID-Bezüge (stabile Schlüssel), Lagebild, ZOE-Satz, Bereichs-Filter, Übernahme-
// Regel aus dem alten Bau, Anbieter-Voreinstellungen, Ziel-Prüfung (kein eigenes Netz). Alles erfunden (@example.invalid).
import { describe, it, expect } from 'vitest';
import { kopfAusAbruf, labelsAus, fehlerZustand, imapFaellig } from '@/lib/postfach/abgleich';
import { anhaengeAusStruktur, parameter, kurzHash, istAutomatisch, kopfzeilen } from '@/lib/postfach/rfc822';
import { rohNachricht, PostSpeicher } from '@/lib/postfach/post-speicher';
import { fachVon, fristAus, istRundschreiben, type FachNachricht } from '@/lib/inbox/faecher';
import { gespraecheBauen, imapFaeden, lageBauen, zoeSatz, gespraechTeile, istGespraechId, type StromKopf } from '@/lib/inbox/strom';
import { imBereich } from '@/lib/inbox/strom-server';
import { uebernahme } from '@/lib/inbox/zustand';
import { VOREINSTELLUNGEN, hostOk, anbieterRaten } from '@/lib/postfach/anbieter';
import { ordnerBestimmen } from '@/lib/postfach/pruefen';
import { ipIntern, fehlerUebersetzen, PostfachFehler } from '@/lib/postfach/transport';
import { serverAus } from '@/lib/postfach/register';
import { vorschlaegeFuer } from '@/lib/inbox/gespraech-server';

const D = 'example.invalid';
const PF = 'pf-11111111-2222-4333-8444-555555555555';
const abruf = (roh: string, uid = 7, flags: string[] = []) => ({ uid, flags, internalDate: '2026-10-05T08:00:00.000Z', groesse: roh.length, quelle: Buffer.from(roh.replace(/\r?\n/g, '\r\n'), 'utf8') });

describe('Rohnachricht → Kopf + Text (dieselbe Form wie Gmail)', () => {
  it('RFC 2047 im Betreff, UTF-8-Text, Message-ID/References, stabile Kennung, Ausschnitt, Labels aus Flags', () => {
    const roh = rohNachricht({ von: '=?UTF-8?Q?J=C3=BCrgen_M=C3=BCller?= <juergen@x.' + D + '>', an: `ich@${D}`, betreff: '=?UTF-8?B?w4RuZGVydW5nIGRlcyBWZXJ0cmFncw==?=', text: 'Grüße aus Köln — bitte bis Freitag antworten.', messageId: `<m1@${D}>`, references: [`<wurzel@${D}>`, `<mitte@${D}>`], inReplyTo: `<mitte@${D}>` });
    const { kopf, text } = kopfAusAbruf(PF, 'e', '42', abruf(roh));
    expect(kopf.id).toBe(`${PF}:e:42:7`);
    expect(kopf.von).toMatchObject({ name: 'Jürgen Müller', email: `juergen@x.${D}` });
    expect(kopf.betreff).toBe('Änderung des Vertrags');
    expect(text).toContain('Grüße aus Köln');
    expect(kopf.ausschnitt).toContain('bis Freitag');
    expect(kopf.messageId).toBe(`<m1@${D}>`);
    expect(kopf.wurzel).toBe(`<wurzel@${D}>`);
    expect(kopf.labels).toEqual(['INBOX', 'UNREAD']);
    expect(kopfAusAbruf(PF, 'e', '42', abruf(roh, 7, ['\\Seen', '\\Flagged'])).kopf.labels).toEqual(['INBOX', 'STARRED']);
    expect(labelsAus('g', [])).toEqual(['SENT']);
  });
  it('Multipart mit Anhang: Teil-Kennungen nach IMAP-Zählung, Anhang nur als Metadaten, HTML nie als HTML', () => {
    const roh = rohNachricht({ von: `a@${D}`, an: `b@${D}`, betreff: 'Rechnung', text: '<p>Hallo <b>Welt</b><img src="https://track.example.invalid/p.gif"><script>alert(1)</script></p>', html: true, messageId: `<m2@${D}>`, anhang: { name: 'Rechnung-1.pdf', typ: 'application/pdf', inhalt: '%PDF-1.4 x' } });
    const { kopf, text } = kopfAusAbruf(PF, 'e', '1', abruf(roh));
    expect(text).toContain('Hallo Welt');
    expect(text).not.toContain('<script');
    expect(text).not.toContain('alert');
    expect(kopf.anhaenge).toHaveLength(1);
    expect(kopf.anhaenge[0]).toMatchObject({ teil: '2', name: 'Rechnung-1.pdf', typ: 'application/pdf' });
  });
  it('Rundschreiben und automatische Antworten am Kopf erkannt', () => {
    const nl = kopfAusAbruf(PF, 'e', '1', abruf(rohNachricht({ von: `news@${D}`, an: `b@${D}`, betreff: 'News', text: 'x', messageId: `<n@${D}>`, kopf: { 'List-Id': `<liste.${D}>` } }))).kopf;
    expect(nl.liste).toBe(true);
    const auto = kopfAusAbruf(PF, 'e', '1', abruf(rohNachricht({ von: `marie@${D}`, an: `b@${D}`, betreff: 'Automatische Antwort: Frage', text: 'nicht da', messageId: `<a@${D}>`, kopf: { 'Auto-Submitted': 'auto-replied' } }))).kopf;
    expect(auto.automatisch).toBe(true);
    expect(istAutomatisch(kopfzeilen(Buffer.from('Auto-Submitted: no\r\n')))).toBe(false);
  });
  it('BODYSTRUCTURE → Anhänge mit echter Größe (base64 → ¾), eingebettete Bilder markiert; RFC-2231-Dateinamen', () => {
    const a = anhaengeAusStruktur({ type: 'multipart/mixed', childNodes: [
      { part: '1', type: 'text/plain', size: 10 },
      { part: '2', type: 'application/pdf', encoding: 'base64', size: 4000, disposition: 'attachment', dispositionParameters: { filename: 'a.pdf' } },
      { part: '3', type: 'image/png', size: 100, id: '<bild1>', disposition: 'inline' },
    ] });
    expect(a).toEqual([{ teil: '2', name: 'a.pdf', typ: 'application/pdf', groesse: 3000 }, { teil: '3', name: 'Anhang', typ: 'image/png', groesse: 100, eingebettet: true }]);
    expect(parameter("attachment; filename*=UTF-8''%C3%84nderung.pdf", 'filename')).toBe('Änderung.pdf');
    expect(parameter('attachment; filename*0="Teil"; filename*1="eins.pdf"', 'filename')).toBe('Teileins.pdf');
  });
});

const n = (x: Partial<FachNachricht>): FachNachricht => ({ am: '2026-10-05T10:00:00Z', von: { email: `x@${D}` }, betreff: 'Frage', labels: [], anhaenge: [], vonUns: false, ...x });

describe('Fächer — ohne Modell, nur Kopf', () => {
  const basis = { zugeordnet: true, angeschrieben: false, heute: '2026-10-07' };
  it('jüngste ECHTE Nachricht entscheidet: von außen → Antworten; von uns → Warten (Abwesenheitsnotiz zählt nicht); Nachfassen ab 3 Tagen; > 30 Tage verjährt', () => {
    expect(fachVon({ ...basis, nachrichten: [n({})] }).fach).toBe('antworten');
    const w = fachVon({ ...basis, nachrichten: [n({ vonUns: true, am: '2026-10-03T10:00:00Z' }), n({ automatisch: true, betreff: 'Automatische Antwort: Frage', am: '2026-10-03T11:00:00Z' })] });
    expect(w).toMatchObject({ fach: 'warten', wartetTage: 4, nachfassen: true, massgeblich: 0 });
    expect(fachVon({ ...basis, nachrichten: [n({ vonUns: true, am: '2026-10-06T10:00:00Z' })] })).toMatchObject({ fach: 'warten', wartetTage: 1 });
    expect(fachVon({ ...basis, nachrichten: [n({ vonUns: true, am: '2026-08-01T10:00:00Z' })] }).verjaehrt).toBe(true);
  });
  it('Screener: unbekannt + nie angeschrieben + kein Rundschreiben → Neue Absender; zugelassen/angeschrieben → nicht; geblockt → raus (außer Kartei)', () => {
    const fremd = { zugeordnet: false, heute: '2026-10-07' };
    expect(fachVon({ ...fremd, angeschrieben: false, nachrichten: [n({})] }).fach).toBe('neu');
    expect(fachVon({ ...fremd, angeschrieben: true, nachrichten: [n({})] }).fach).toBe('antworten');
    expect(fachVon({ ...fremd, angeschrieben: false, absender: 'zugelassen', nachrichten: [n({})] }).fach).toBe('antworten');
    expect(fachVon({ ...fremd, angeschrieben: false, absender: 'geblockt', nachrichten: [n({})] }).fach).toBe('geblockt');
    expect(fachVon({ ...basis, absender: 'geblockt', nachrichten: [n({})] }).fach).toBe('antworten');
  });
  it('Rundschreiben → Info (auch noreply und Gmail-Kategorien), nie wenn die Person in der Kartei steht; Termine; Geld & Papier', () => {
    const fremd = { zugeordnet: false, angeschrieben: false, heute: '2026-10-07' };
    expect(fachVon({ ...fremd, nachrichten: [n({ liste: true })] }).fach).toBe('info');
    expect(fachVon({ ...fremd, nachrichten: [n({ von: { email: `no-reply@shop.${D}` } })] }).fach).toBe('info');
    expect(istRundschreiben(n({ labels: ['CATEGORY_PROMOTIONS'] }))).toBe(true);
    expect(fachVon({ ...basis, nachrichten: [n({ liste: true })] }).fach).toBe('antworten');
    expect(fachVon({ ...basis, nachrichten: [n({ betreff: 'Einladung: Workshop', anhaenge: [{ name: 'invite.ics', typ: 'text/calendar' }] })] }).fach).toBe('termine');
    expect(fachVon({ ...basis, nachrichten: [n({ betreff: 'Unterlagen', anhaenge: [{ name: 'Rechnung-12.pdf', typ: 'application/pdf' }] })] }).fach).toBe('geld');
    expect(fachVon({ ...basis, nachrichten: [n({ betreff: 'Mahnung zur Rechnung 4' })] }).fach).toBe('geld');
  });
  it('Fristen im Text: „bis Freitag“, „bis 15.10.“, „bis morgen“ — nur Zukunft', () => {
    expect(fristAus('Bitte bis Freitag zurückmelden', '2026-10-07')).toEqual({ datum: '2026-10-09', text: 'bis Freitag' });
    expect(fristAus('kannst du bis 15.10. eine Fassung schicken', '2026-10-07')!.datum).toBe('2026-10-15');
    expect(fristAus('bis 03.01. bitte', '2026-10-07')!.datum).toBe('2027-01-03');
    expect(fristAus('bis morgen', '2026-10-07')!.datum).toBe('2026-10-08');
    expect(fristAus('nichts Eiliges', '2026-10-07')).toBeNull();
  });
});

const kopf = (id: string, x: Partial<StromKopf>): StromKopf => ({ id, threadId: '', am: '2026-10-05T10:00:00.000Z', von: { email: `x@${D}` }, an: [{ email: `ich@${D}` }], cc: [], betreff: 'Thema', ausschnitt: '', labels: ['INBOX'], anhaenge: [], postfachId: PF, ordner: 'e', ...x } as StromKopf);

describe('Gespräche — Message-ID-Bezüge, stabile Schlüssel', () => {
  it('In-Reply-To ohne References und References ohne Wurzel landen im selben Gespräch; der Schlüssel bleibt, wenn eine Antwort dazukommt', () => {
    const a = kopf('a', { messageId: `<a@${D}>`, wurzel: `<a@${D}>`, am: '2026-10-01T10:00:00Z' });
    const b = kopf('b', { messageId: `<b@${D}>`, inReplyTo: `<a@${D}>`, wurzel: `<a@${D}>`, am: '2026-10-02T10:00:00Z', ordner: 'g', labels: ['SENT'] });
    const c = kopf('c', { messageId: `<c@${D}>`, references: [`<b@${D}>`], wurzel: `<b@${D}>`, am: '2026-10-03T10:00:00Z' });
    const x = kopf('x', { messageId: `<x@${D}>`, wurzel: `<x@${D}>` });
    const f1 = imapFaeden([a, b, x], kurzHash);
    const f2 = imapFaeden([a, b, c, x], kurzHash);
    expect(f2.get('a')).toBe(f2.get('c'));
    expect(f2.get('a')).toBe(f1.get('a'));
    expect(f2.get('x')).not.toBe(f2.get('a'));
    expect(f2.get('a')).toMatch(/^[0-9a-f]{20}$/);
  });
  it('Gespräch-Kennungen: Gmail-Thread, IMAP Postfach + Schlüssel, WhatsApp vorbereitet', () => {
    expect(gespraechTeile('gm~abc123def')).toEqual({ quelle: 'gmail', postfach: 'gmail', schluessel: 'abc123def' });
    expect(gespraechTeile(`im~${PF}~0123456789abcdef0123`)).toMatchObject({ quelle: 'imap', postfach: PF });
    expect(istGespraechId(`wa~${PF}~491701234567`)).toBe(true);
    expect(istGespraechId('im~../../etc~x')).toBe(false);
  });
  it('gespraecheBauen: Fächer, Gegenseite, Wiedervorlage (ruht / fällig / neue Nachricht holt zurück), erledigt bis Nachricht X, Lagebild, ZOE-Satz', () => {
    const p = [{ id: PF, quelle: 'imap' as const, bereich: 'kdv', anzeigename: 'KDV', eigene: [`ich@${D}`] }];
    const koepfe = [
      kopf('k1', { messageId: `<k1@${D}>`, wurzel: `<k1@${D}>`, von: { email: `anna@${D}`, name: 'Anna' }, betreff: 'Angebot bis Freitag', ausschnitt: 'bitte bis Freitag', am: '2026-10-04T10:00:00Z' }),
      kopf('k2', { messageId: `<k2@${D}>`, wurzel: `<k2@${D}>`, von: { email: `ich@${D}` }, an: [{ email: `tom@${D}`, name: 'Tom' }], ordner: 'g', labels: ['SENT'], betreff: 'Unterlagen', am: '2026-10-01T10:00:00Z' }),
      kopf('k3', { messageId: `<k3@${D}>`, wurzel: `<k3@${D}>`, von: { email: `neu@${D}` }, betreff: 'Hallo', am: '2026-10-06T10:00:00Z' }),
      kopf('k4', { messageId: `<k4@${D}>`, wurzel: `<k4@${D}>`, von: { email: `ruht@${D}` }, betreff: 'Später', am: '2026-10-03T10:00:00Z' }),
    ];
    const ids = imapFaeden(koepfe, kurzHash);
    const gid = (k: string) => `im~${PF}~${ids.get(k)}`;
    const g = gespraecheBauen({ postfaecher: p, koepfe: { [PF]: koepfe }, zuordnung: { k1: { kontaktId: 'c-anna', name: 'Anna Beispiel' } }, absender: {}, heute: '2026-10-07', hash: kurzHash,
      zustand: { [gid('k4')]: { spaeter: { bis: '2026-10-10', seit: '2026-10-04T00:00:00Z' } } } });
    const von = (k: string) => g.find(x => x.id === gid(k))!;
    expect(von('k1')).toMatchObject({ fach: 'antworten', inArbeit: true, frist: { datum: '2026-10-09' }, wartetAufUns: 3 });
    expect(von('k2')).toMatchObject({ fach: 'warten', nachfassen: true, wartetTage: 6, gegenueber: { email: `tom@${D}` }, inArbeit: true });
    expect(von('k3').fach).toBe('neu');
    expect(von('k4')).toMatchObject({ wiedervorlage: '2026-10-10', inArbeit: false });
    const lage = lageBauen(g);
    expect(lage).toEqual([{ bereich: 'kdv', antworten: 1, warten: 1, nachfassen: 1, termine: 0, geld: 0, neu: 1, info: 0, wiedervorlage: 0 }]);
    expect(zoeSatz(g)).toEqual({ text: 'Anna Beispiel braucht „Angebot bis Freitag“ bis Freitag — am besten heute antworten.', gespraech: gid('k1') });
    // fällig und „erledigt bis“
    const g2 = gespraecheBauen({ postfaecher: p, koepfe: { [PF]: koepfe }, zuordnung: {}, absender: {}, heute: '2026-10-10', hash: kurzHash,
      zustand: { [gid('k4')]: { spaeter: { bis: '2026-10-10', seit: '2026-10-04T00:00:00Z' } }, [gid('k2')]: { erledigt: { bis: 'k2', am: '2026-10-06T00:00:00Z' } } } });
    expect(g2.find(x => x.id === gid('k4'))).toMatchObject({ wiedervorlage: 'faellig', inArbeit: true });
    expect(g2.find(x => x.id === gid('k2'))!.inArbeit).toBe(false);
    expect(zoeSatz(g2).text).toMatch(/^Heute wieder dran/);
  });
});

describe('Bereichstrennung — EINE Filterstelle', () => {
  it('space=business nur Business-Bereiche (nie privat, nie die Selbstständigkeit, nie ohne Bereich); bereich=X genau X; ohne Filter alles Eigene', () => {
    expect(imBereich('kdv', { space: 'business' })).toBe(true);
    expect(imBereich('g-firma-neu1', { space: 'business' })).toBe(true);
    expect(imBereich('privat', { space: 'business' })).toBe(false);
    expect(imBereich('kdc', { space: 'business' })).toBe(false);
    expect(imBereich(null, { space: 'business' })).toBe(false);
    expect(imBereich(null, { space: 'privat' })).toBe(false);
    expect(imBereich('kdc', { space: 'privat' })).toBe(true);
    expect(imBereich('privat', { bereich: 'kdv' })).toBe(false);
    expect(imBereich(null, {})).toBe(true);
  });
});

describe('Übernahme aus dem alten Bau (dokumentierte Regel)', () => {
  it('nur Gmail-Wiedervorlagen der EIGENEN Nachrichten (ab heute), Apple/M365 verworfen; Absender nur für den Inhaber', () => {
    const z = uebernahme({
      alterStatus: { 'gmail-msg111': { status: 'snoozed', bis: '2026-10-09' }, 'gmail-fremd99': { status: 'snoozed', bis: '2026-10-09' }, 'gmail-msg222': { status: 'snoozed', bis: '2026-10-01' }, 'apple-mail-18': { status: 'snoozed', bis: '2026-10-09' }, 'gmail-msg333': { status: 'erledigt' } },
      alteAbsender: { [`a@${D}`]: { status: 'geblockt', seit: '2026-09-01' }, [`b@${D}`]: { status: 'durchgelassen' }, 'kaputt': { status: 'geblockt' } },
      gmailThreads: { msg111: 'thr1', msg222: 'thr2', msg333: 'thr3' }, inhaber: true, heute: '2026-10-07', jetzt: '2026-10-07T08:00:00.000Z',
    });
    expect(z.gespraeche).toEqual({ 'gm~thr1': { spaeter: { bis: '2026-10-09', seit: '2026-10-07T08:00:00.000Z' } } });
    expect(z.absender).toEqual({ [`a@${D}`]: { status: 'geblockt', seit: '2026-09-01' }, [`b@${D}`]: { status: 'zugelassen', seit: '2026-10-07' } });
    expect(uebernahme({ alterStatus: null, alteAbsender: { [`a@${D}`]: { status: 'geblockt' } }, gmailThreads: {}, inhaber: false, heute: '2026-10-07', jetzt: 'x' }).absender).toEqual({});
  });
});

describe('Anbieter, Ordner, Ziele, Fehler', () => {
  it('Voreinstellungen (belegt): iCloud 993/587 + App-Passwort, IMAP-Benutzer ohne Domain; IONOS 993/465, volle Adresse', () => {
    expect(VOREINSTELLUNGEN.icloud.imap).toEqual({ host: 'imap.mail.me.com', port: 993, sicherheit: 'ssl' });
    expect(VOREINSTELLUNGEN.icloud.smtp).toEqual({ host: 'smtp.mail.me.com', port: 587, sicherheit: 'starttls' });
    expect(VOREINSTELLUNGEN.icloud.imapBenutzer('Lena.Muster@icloud.com')).toBe('lena.muster');
    expect(VOREINSTELLUNGEN.icloud.link?.url).toBe('https://appleid.apple.com');
    expect(VOREINSTELLUNGEN.ionos.imap).toEqual({ host: 'imap.ionos.de', port: 993, sicherheit: 'ssl' });
    expect(VOREINSTELLUNGEN.ionos.smtp).toEqual({ host: 'smtp.ionos.de', port: 465, sicherheit: 'ssl' });
    expect(VOREINSTELLUNGEN.ionos.imapBenutzer('Info@Firma.de')).toBe('info@firma.de');
    expect(anbieterRaten('x@me.com')).toBe('icloud');
  });
  it('eigener Anbieter: Hostnamen geprüft, kein localhost/IP/eigenes Netz; STARTTLS nur bei 587 gewählt', () => {
    expect(hostOk('imap.anbieter.de')).toBe(true);
    for (const h of ['localhost', '127.0.0.1', 'imap.local', 'http://x.de', 'a b.de', 'intern.lan']) expect(hostOk(h), h).toBe(false);
    expect(() => serverAus('eigen', { imap: { host: 'localhost', port: 993 }, smtp: { host: 'smtp.a.de', port: 465 } })).toThrow();
    expect(serverAus('eigen', { imap: { host: 'imap.a.de', port: 993 }, smtp: { host: 'smtp.a.de', port: 587, sicherheit: 'starttls' } }).smtp.sicherheit).toBe('starttls');
    for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.2', '172.20.0.1', '169.254.1.1', '100.64.0.1', '::1', 'fd00::1', '::ffff:127.0.0.1']) expect(ipIntern(ip), ip).toBe(true);
    expect(ipIntern('93.184.216.34')).toBe(false);
  });
  it('Ordner aus SPECIAL-USE, sonst bekannte Namen (IONOS „Gesendete Objekte“, iCloud „Sent Messages“/„Archive“)', () => {
    expect(ordnerBestimmen([{ pfad: 'INBOX' }, { pfad: 'Gesendete Objekte' }, { pfad: 'Papierkorb' }])).toEqual({ posteingang: 'INBOX', gesendet: 'Gesendete Objekte' });
    expect(ordnerBestimmen([{ pfad: 'INBOX' }, { pfad: 'Sent Messages', specialUse: '\\Sent' }, { pfad: 'Archive', specialUse: '\\Archive' }])).toEqual({ posteingang: 'INBOX', gesendet: 'Sent Messages', archiv: 'Archive' });
    expect(ordnerBestimmen([{ pfad: 'INBOX' }, { pfad: 'INBOX.Archiv' }])).toMatchObject({ archiv: 'INBOX.Archiv' });
  });
  it('Fehler übersetzt, nie mit Zugangsdaten; Anmeldung abgelehnt → nie wieder fällig bis zum Erneuern; sonst Pause', () => {
    expect(fehlerUebersetzen({ authenticationFailed: true, message: 'LOGIN failed for geheim123' })).toMatchObject({ code: 'anmeldung' });
    expect(fehlerUebersetzen({ authenticationFailed: true, message: 'geheim123' }).message).not.toContain('geheim123');
    expect(fehlerUebersetzen({ code: 'ETIMEDOUT' }).code).toBe('zeit');
    expect(fehlerUebersetzen({ code: 'CERT_HAS_EXPIRED' }).code).toBe('tls');
    const z = fehlerZustand(new PostfachFehler('anmeldung', 'x'), { ordner: {} }, Date.parse('2026-10-07T08:00:00Z'));
    expect(z.fehlerAnmeldung).toBe(true);
    expect(imapFaellig({ ordner: {}, ...z }, Date.parse('2026-10-08T08:00:00Z'))).toBe(false);
    const netz = fehlerZustand(new PostfachFehler('netz', 'x'), { ordner: {} }, Date.parse('2026-10-07T08:00:00Z'));
    expect(imapFaellig({ ordner: {}, ...netz }, Date.parse('2026-10-07T08:01:00Z'))).toBe(false);
    expect(imapFaellig({ ordner: {}, ...netz }, Date.parse('2026-10-07T09:00:00Z'))).toBe(true);
    expect(imapFaellig({ ordner: {}, at: '2026-10-07T08:00:00Z', idleSeit: '2026-10-07T07:00:00Z' }, Date.parse('2026-10-07T08:05:00Z'))).toBe(false);
  });
});

describe('Vorschläge (nur Knöpfe, ohne Modell)', () => {
  it('Frist → Aufgabe mit Datum; Geld + PDF → Beleg; bekannte Person → Zuordnen; höchstens drei', () => {
    const g = { id: 'gm~abc123def', fach: 'geld', zuordnung: { kontaktId: 'c-1', name: 'Anna' }, zugeordnet: false } as never;
    const v = vorschlaegeFuer(g, [{ id: 'm1', am: '', von: { email: `a@${D}` }, an: [], cc: [], betreff: 'Rechnung', text: 'Bitte bis 15.10. bezahlen.', vonUns: false, ungelesen: true, anhaenge: [{ teil: '2', name: 'r.pdf', typ: 'application/pdf', groesse: 10 }] }], '2026-10-07');
    expect(v.map(x => x.art)).toEqual(['aufgabe', 'beleg', 'zuordnen']);
    expect(v[0].datum).toBe('2026-10-15');
  });
});

describe('Postfach im Speicher (Fake für Tests und Demo)', () => {
  it('falsches Passwort → Anmeldung abgelehnt; MOVE, SEARCH Message-ID, Teil holen', async () => {
    const s = new PostSpeicher({ passwort: 'ok' });
    await expect(s.sitzung({ passwort: 'nein' })).rejects.toMatchObject({ code: 'anmeldung' });
    const uid = s.ablegen('INBOX', rohNachricht({ von: `a@${D}`, an: `b@${D}`, betreff: 'x', text: 'y', messageId: `<q@${D}>`, anhang: { name: 'a.txt', typ: 'text/plain', inhalt: 'INHALT' } }));
    const z = await s.sitzung({ passwort: 'ok' });
    await z.oeffnen('INBOX');
    expect((await z.teil(uid, '2', 1000)).bytes.toString()).toBe('INHALT');
    await z.verschieben([uid], 'Archive');
    await z.oeffnen('Archive');
    expect(await z.sucheMessageId(`<q@${D}>`)).toHaveLength(1);
  });
});
