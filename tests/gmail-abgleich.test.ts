// Gmail: Scopes inkrementell, Erstabgleich (30 Tage Posteingang + Gesendet), history.list inkrementell, 404 → Neuabgleich, Fehler
// (401 erneuern, 429/Retry-After, invalid_grant), Aufbewahrung, nur Metadaten bei Anhängen, Trennen räumt auf, Takt.
// Echter Datenspeicher (Temp, verschlüsselt), Google/Gmail nachgebaut.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GmailFake, GMAIL_SCOPE, gmailAufrufe } from './fixtures/gmail-fake';
import { KONTEN, umgebung } from './fixtures/gmail-setup';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-gmail-a-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-gmail-abgleich';
process.env.MAKE_OS_KEY = 'dienst-test-gmail-abgleich';

let V: typeof import('@/lib/google/verbindung'), A: typeof import('@/lib/gmail/abgleich'), S: typeof import('@/lib/gmail/stand'), db: typeof import('@/lib/store/local-db');
let T: typeof import('@/lib/gmail/takt'), TR: typeof import('@/lib/google/trennen'), AU: typeof import('@/lib/gmail/aufraeumen');
let g: GmailFake;

beforeAll(async () => {
  V = await import('@/lib/google/verbindung'); A = await import('@/lib/gmail/abgleich'); S = await import('@/lib/gmail/stand'); db = await import('@/lib/store/local-db');
  T = await import('@/lib/gmail/takt'); TR = await import('@/lib/google/trennen'); AU = await import('@/lib/gmail/aufraeumen');
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

async function verbinden(person: string, funktionen: ('kalender' | 'gmail')[]) {
  const { url } = await V.verbindungStarten(person, funktionen);
  const q = new URL(url).searchParams;
  const r = await V.verbindungAbschliessen(person, 'code-ok', q.get('state')!);
  return { url, q, r };
}

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-03T08:00:00.000Z'));
  g = new GmailFake();
  umgebung(vi, g);
  await db.saveJson('konten', KONTEN);
});

describe('Scopes inkrementell — eine Verbindung, ein Refresh-Token', () => {
  it('Gmail verlangt NUR gmail.modify (kein Vollzugriff, kein zusätzliches gmail.send)', () => {
    expect(V.GOOGLE_FUNKTIONEN.gmail.scopes).toEqual([GMAIL_SCOPE]);
    const alle = Object.values(V.GOOGLE_FUNKTIONEN).flatMap(f => f.scopes);
    expect(alle.some(s => (s as string) === 'https://mail.google.com/')).toBe(false);
    expect(alle.some(s => /gmail\.(send|readonly|compose|settings)/.test(s))).toBe(false);
  });
  it('Kalender zuerst, dann Gmail ergänzen: Scopes der Anmeldung = beide, include_granted_scopes, login_hint; danach eine Verbindung mit beiden Funktionen', async () => {
    const k = await verbinden('kevin', ['kalender']);
    expect(k.r.angefordert).toEqual(['kalender']);
    const refresh1 = (await V.ladeVerbindung('kevin'))!.refreshToken;
    const { q, r } = await verbinden('kevin', ['gmail']);
    const scopes = q.get('scope')!.split(' ');
    expect(scopes).toEqual(expect.arrayContaining(['https://www.googleapis.com/auth/calendar.events', GMAIL_SCOPE]));
    expect(q.get('include_granted_scopes')).toBe('true');
    expect(q.get('login_hint')).toBe('kevin@makeinnovation.test');
    expect(r.angefordert).toEqual(['gmail']);          // der Rückruf richtet nur Gmail ein — der Kalender bleibt, wie er ist
    expect(r.funktionen).toEqual(expect.arrayContaining(['basis', 'kalender', 'gmail']));
    const v = (await V.ladeVerbindung('kevin'))!;
    expect(v.funktionen.filter(f => f === 'gmail')).toHaveLength(1);
    expect(v.refreshToken).toBeTruthy(); expect(refresh1).toBeTruthy();
    expect(await A.gmailBereit('kevin')).toBe(true);
    expect((await V.googleStatus('kevin')).bereit).toEqual(expect.arrayContaining(['kalender', 'gmail']));
  });
  it('ohne gmail-Scope: nicht bereit, Abgleich wirft scope-fehlt (und schreibt keinen Spiegel)', async () => {
    g.basis.scopeGewaehrt = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';
    const { r } = await verbinden('kevin', ['gmail']);
    expect(r.fehlendeScopes).toContain(GMAIL_SCOPE);
    expect(await A.gmailBereit('kevin')).toBe(false);
    await expect(A.gmailAbgleichen('kevin')).rejects.toMatchObject({ code: 'scope-fehlt' });
    expect(await S.ladeGmailStand('kevin')).toBeNull();
  });
  it('Zugangsdaten gehen nur an die Google-Hosts — gmail.googleapis.com gehört dazu, andere nicht', () => {
    expect(V.googleHost('https://gmail.googleapis.com/gmail/v1/users/me/profile')).toBe(true);
    expect(V.googleHost('https://gmail.googleapis.com.evil.invalid/x')).toBe(false);
    expect(V.googleHost('http://gmail.googleapis.com/x')).toBe(false);
  });
});

describe('Erstabgleich', () => {
  beforeEach(async () => { await verbinden('kevin', ['gmail']); });

  it('letzte 30 Tage Posteingang + Gesendet; nicht: ältere, Entwürfe, Spam, Papierkorb; historyId VOR dem Lesen', async () => {
    g.mail({ id: 'm1', von: 'Anna <anna@firma.example.invalid>', betreff: 'Angebot', text: 'Hallo Kevin', vorMin: 60 });
    g.mail({ id: 'm2', von: 'kevin@makeinnovation.test', an: 'anna@firma.example.invalid', betreff: 'Re: Angebot', text: 'Danke', labels: ['SENT'], vorMin: 30, threadId: 'm1' });
    g.mail({ id: 'alt', von: 'x@y.example.invalid', betreff: 'Uralt', text: 'x', vorMin: 40 * 24 * 60 });
    g.mail({ id: 'ent', von: 'kevin@makeinnovation.test', betreff: 'Entwurf', text: 'x', labels: ['DRAFT', 'SENT'] });
    g.mail({ id: 'spam', von: 'spam@y.example.invalid', betreff: 'Gewinn', text: 'x', labels: ['SPAM'] });
    g.mail({ id: 'papier', von: 'z@y.example.invalid', betreff: 'Weg', text: 'x', labels: ['INBOX', 'TRASH'] });
    const hVorher = g.historyId;
    const r = await A.gmailAbgleichen('kevin');
    expect(r).toMatchObject({ voll: true, neu: 2, nachrichten: 2 });
    const s = (await S.ladeGmailStand('kevin'))!;
    expect(Object.keys(s.koepfe).sort()).toEqual(['m1', 'm2']);
    expect(s.historyId).toBe(hVorher);
    expect(s.email).toBe('kevin@makeinnovation.test');
    expect(s.koepfe.m1).toMatchObject({ betreff: 'Angebot', von: { name: 'Anna', email: 'anna@firma.example.invalid' }, labels: ['INBOX', 'UNREAD'], threadId: 'm1' });
    expect((await S.ladeGmailTexte('kevin')).texte.m1.t).toBe('Hallo Kevin');
    expect((await S.ladeGmailTexte('kevin')).texte.m1.adressen).toContain('anna@firma.example.invalid');
    expect(S.threadVon(s.koepfe, 'm1').map(k => k.id)).toEqual(['m1', 'm2']);
  });

  it('Anhänge nur als Metadaten — im Spiegel steht kein Inhalt; HTML wird Text (Skript/Pixel weg), Umlaute stimmen', async () => {
    g.mail({ id: 'h1', von: 'Jörg <joerg@firma.example.invalid>', betreffRoh: '=?UTF-8?Q?Gr=C3=BC=C3=9Fe?=', html: '<p>Gr&uuml;&szlig;e</p><script>x()</script><img src="https://t.example.invalid/p.gif" width=1>', anhaenge: [{ name: 'Vertrag.pdf', inhalt: 'GEHEIMER-PDF-INHALT', groesse: 4321 }] });
    await A.gmailAbgleichen('kevin');
    const s = (await S.ladeGmailStand('kevin'))!, t = await S.ladeGmailTexte('kevin');
    expect(s.koepfe.h1.betreff).toBe('Grüße');
    expect(s.koepfe.h1.anhaenge).toEqual([{ teil: '0.1', name: 'Vertrag.pdf', typ: 'application/pdf', groesse: 4321 }]);
    expect(s.koepfe.h1.bilder).toBe(1);
    expect(t.texte.h1.t).toBe('Grüße');
    const roh = JSON.stringify([s, t]);
    expect(roh).not.toMatch(/GEHEIMER-PDF-INHALT|<script|t\.example|ANG-/);
    // Die Dateien auf der Platte sind verschlüsselt (kein Klartext-Betreff).
    for (const f of readdirSync(ordner).filter(n => n.startsWith('gmail-'))) expect(readFileSync(path.join(ordner, f), 'utf8')).not.toContain('Grüße');
  });

  it('Aliase („Senden als“): nur verifizierte, die eigene Adresse zuerst', async () => {
    await A.gmailAbgleichen('kevin');
    const l = await A.aliaseSicherstellen('kevin', true);
    expect(l.map(a => a.email)).toEqual(['kevin@makeinnovation.test', 'hello@makeinnovation.test', 'alt@makeinnovation.test']);
    expect(l.filter(a => a.verifiziert).map(a => a.email)).toEqual(['kevin@makeinnovation.test', 'hello@makeinnovation.test']);
    const n = gmailAufrufe(g, '/settings/sendAs').length;
    await A.aliaseSicherstellen('kevin');           // Cache: kein zweiter Aufruf
    expect(gmailAufrufe(g, '/settings/sendAs')).toHaveLength(n);
  });
});

describe('history.list — inkrementell', () => {
  beforeEach(async () => {
    await verbinden('kevin', ['gmail']);
    g.mail({ id: 'm1', von: 'anna@firma.example.invalid', betreff: 'Eins', text: 'a', vorMin: 90 });
    g.mail({ id: 'm2', von: 'bert@firma.example.invalid', betreff: 'Zwei', text: 'b', vorMin: 80 });
    await A.gmailAbgleichen('kevin');
  });
  it('neue Nachricht, Label-Änderung (archiviert/gelesen), Löschung — ohne erneuten Gesamtlauf', async () => {
    const profile0 = gmailAufrufe(g, '/profile').length, liste0 = gmailAufrufe(g, '/messages').filter(a => !/\/messages\/./.test(a.pfad)).length;
    g.mail({ id: 'm3', von: 'carl@firma.example.invalid', betreff: 'Drei', text: 'c' });
    g.labels('m1', [], ['INBOX']);                     // in Gmail archiviert
    g.labels('m2', [], ['UNREAD']);                    // in Gmail gelesen
    const r = await A.gmailAbgleichen('kevin');
    expect(r).toMatchObject({ voll: false, neu: 1, geaendert: 2 });
    const s = (await S.ladeGmailStand('kevin'))!;
    expect(s.koepfe.m3.betreff).toBe('Drei');
    expect(s.koepfe.m1.labels).not.toContain('INBOX');     // archiviert: bleibt im Spiegel („Erledigt“), nur ohne INBOX
    expect(s.koepfe.m2.labels).not.toContain('UNREAD');
    expect(s.historyId).toBe(g.historyId);
    expect(gmailAufrufe(g, '/profile')).toHaveLength(profile0);
    expect(gmailAufrufe(g, '/messages').filter(a => !/\/messages\/./.test(a.pfad)).length).toBe(liste0);
    g.loesche('m2');
    expect(await A.gmailAbgleichen('kevin')).toMatchObject({ voll: false, entfernt: 1 });
    const s2 = (await S.ladeGmailStand('kevin'))!;
    expect(Object.keys(s2.koepfe).sort()).toEqual(['m1', 'm3']);
    expect(Object.keys((await S.ladeGmailTexte('kevin')).texte).sort()).toEqual(['m1', 'm3']);
  });
  it('Nachrichten, die in Spam/Papierkorb gehen oder dort ankommen, liegen nicht im Spiegel', async () => {
    g.mail({ id: 'sp', von: 'spam@y.example.invalid', betreff: 'Spam', text: 'x', labels: ['SPAM'] });
    g.labels('m1', ['TRASH'], ['INBOX']);
    await A.gmailAbgleichen('kevin');
    expect(Object.keys((await S.ladeGmailStand('kevin'))!.koepfe)).toEqual(['m2']);
  });
  it('404 bei history.list (historyId zu alt) → der Spiegel wird verworfen und SOFORT voll neu gelesen — nie ein halber Stand', async () => {
    g.mail({ id: 'm3', von: 'carl@firma.example.invalid', betreff: 'Drei', text: 'c' });
    g.loesche('m2');
    g.historieAbAb = Number.MAX_SAFE_INTEGER;
    const r = await A.gmailAbgleichen('kevin');
    expect(r.voll).toBe(true);
    const s = (await S.ladeGmailStand('kevin'))!;
    expect(Object.keys(s.koepfe).sort()).toEqual(['m1', 'm3']);
    expect(s.historyId).toBe(g.historyId);
    g.historieAbAb = 0;
    expect((await A.gmailAbgleichen('kevin')).voll).toBe(false);
  });
  it('läuft nie doppelt je Person: gleichzeitige Aufrufe teilen EINEN Lauf; ein Anstoß während des Laufs → ein Nachlauf', async () => {
    const [a, b] = await Promise.all([A.gmailAbgleichen('kevin'), A.gmailAbgleichen('kevin')]);
    expect(a).toEqual(b);
    g.mail({ id: 'm9', von: 'x@firma.example.invalid', betreff: 'Neun', text: 'x' });
    const lauf = A.gmailAbgleichen('kevin');
    await A.gmailAbgleichen('kevin', { nachlauf: true });
    await lauf;
    await vi.waitFor(async () => expect((await S.ladeGmailStand('kevin'))!.koepfe.m9).toBeTruthy());
  });
});

describe('Fehler', () => {
  beforeEach(async () => {
    await verbinden('kevin', ['gmail']); g.mail({ id: 'm1', von: 'anna@firma.example.invalid', betreff: 'Eins', text: 'a' }); await A.gmailAbgleichen('kevin');
    vi.setSystemTime(new Date(Date.now() + 1000)); // Fehler NACH dem letzten gelungenen Abgleich (die Uhr steht im Test sonst still)
  });
  it('Zugriffstoken abgelaufen (401) → einmal erneuern und wiederholen', async () => {
    g.basis.gueltig.clear();
    g.mail({ id: 'm2', von: 'b@firma.example.invalid', betreff: 'Zwei', text: 'b' });
    vi.setSystemTime(new Date(Date.now() + 2 * 3600_000));
    await expect(A.gmailAbgleichen('kevin')).resolves.toMatchObject({ neu: 1 });
  });
  it('429 mit Retry-After und 403-Kontingent: Pause, Fehler im Stand, kein Wurf an den Takt (faellig erst danach)', async () => {
    g.fehler.push({ teil: '/history', status: 429, kopf: { 'retry-after': '600' } });
    await expect(A.gmailAbgleichen('kevin')).rejects.toMatchObject({ status: 429 });
    const s = (await S.ladeGmailStand('kevin'))!;
    expect(s.fehler).toMatch(/Pause/);
    expect(Date.parse(s.pauseBis!) - Date.now()).toBeGreaterThanOrEqual(600_000);
    expect(A.gmailFaellig(s, Date.now() + 5 * 60_000)).toBe(false);
    expect(A.gmailFaellig(s, Date.now() + 11 * 60_000)).toBe(true);
    g.fehler.push({ teil: '/history', status: 403, body: { error: { code: 403, errors: [{ reason: 'rateLimitExceeded' }] } } });
    await expect(A.gmailAbgleichen('kevin')).rejects.toMatchObject({ status: 429 });
  });
  it('5xx und Netz: vorläufig, Backoff; ein späterer Erfolg räumt den Fehler weg', async () => {
    g.fehler.push({ teil: '/history', status: 503 });
    await expect(A.gmailAbgleichen('kevin')).rejects.toMatchObject({ vorlaeufig: true });
    expect((await S.ladeGmailStand('kevin'))!.fehlerFolge).toBe(1);
    vi.setSystemTime(new Date(Date.now() + 10 * 60_000));
    await A.gmailAbgleichen('kevin');
    const s = (await S.ladeGmailStand('kevin'))!;
    expect(s.fehler).toBeUndefined(); expect(s.pauseBis).toBeUndefined();
  });
  it('invalid_grant beim Erneuern → Verbindung „getrennt“, EINE Glocke, kein zweites Mal', async () => {
    g.basis.gueltig.clear(); g.basis.refreshOk = false;
    vi.setSystemTime(new Date(Date.now() + 2 * 3600_000));
    await expect(A.gmailAbgleichen('kevin')).rejects.toMatchObject({ code: 'getrennt' });
    expect((await V.ladeVerbindung('kevin'))!.status).toBe('getrennt');
    const gemeldet = async () => ((await db.loadJson<{ eintraege?: { art: string; titel: string }[] }>('meldungen--kevin'))?.eintraege ?? []).filter(m => m.art === 'kalender' && /Google-Verbindung ist getrennt/.test(m.titel)).length;
    expect(await gemeldet()).toBe(1);
    await expect(A.gmailAbgleichen('kevin')).rejects.toMatchObject({ code: 'getrennt' });
    expect(await gemeldet()).toBe(1);
    expect((await S.ladeGmailStand('kevin'))!.getrenntGemeldet).toBe(true);
  });
});

describe('Aufbewahrung (Frist „Mail-Spiegel“, Standard 180 Tage)', () => {
  it('rein: vor der Grenze und über der Höchstzahl fallen weg, die neuesten bleiben', () => {
    const k = (id: string, tag: string) => ({ id, threadId: id, am: `${tag}T10:00:00.000Z`, von: { email: 'a@b.example.invalid' }, an: [], cc: [], betreff: id, ausschnitt: '', labels: [], anhaenge: [] });
    const r = S.aufbewahren({ a: k('a', '2026-01-01'), b: k('b', '2026-09-01'), c: k('c', '2026-09-02'), d: k('d', '2026-09-03') }, '2026-04-01', 2);
    expect(Object.keys(r.rest).sort()).toEqual(['c', 'd']);
    expect(r.weg.sort()).toEqual(['a', 'b']);
  });
  it('der Abgleich wendet die eingestellte Frist an; der Löschlauf kürzt auch ruhende Spiegel samt Texten', async () => {
    await verbinden('kevin', ['gmail']);
    g.mail({ id: 'neu', von: 'a@firma.example.invalid', betreff: 'Neu', text: 'x', vorMin: 60 });
    g.mail({ id: 'mittel', von: 'b@firma.example.invalid', betreff: 'Mittel', text: 'x', vorMin: 20 * 24 * 60 });
    await A.gmailAbgleichen('kevin');
    expect(Object.keys((await S.ladeGmailStand('kevin'))!.koepfe).sort()).toEqual(['mittel', 'neu']);
    expect(await A.spiegelGrenze('2026-10-03')).toBe('2026-04-06');   // 180 Tage
    await db.saveJson('crm-loeschfristen', { fristen: { 'mail-spiegel': 30 } });
    expect(await A.spiegelGrenze('2026-10-03')).toBe('2026-09-03');
    // Ein ruhender Spiegel mit einer alten Nachricht: der Lauf kürzt ihn.
    await S.aendereGmailStand('kevin', s => ({ ...s, koepfe: { ...s.koepfe, uralt: { ...s.koepfe.neu, id: 'uralt', am: '2026-01-05T10:00:00.000Z' } } }));
    await S.aendereGmailTexte('kevin', t => ({ v: 1, texte: { ...t.texte, uralt: { adressen: 'a@b.example.invalid', t: 'alt' } } }));
    expect(await AU.gmailAufraeumen('2026-09-03')).toBe(1);   // nur „uralt“ (Januar); „mittel“ (20 Tage) und „neu“ bleiben
    expect(Object.keys((await S.ladeGmailStand('kevin'))!.koepfe).sort()).toEqual(['mittel', 'neu']);
    expect(Object.keys((await S.ladeGmailTexte('kevin')).texte).sort()).toEqual(['mittel', 'neu']);
    expect(await AU.gmailAufraeumen('2026-09-03')).toBe(0);   // idempotent
  });
});

describe('Trennen und Ausschalten räumen auf', () => {
  it('Trennen: Token widerrufen, users.stop, Köpfe und Texte weg (Grabstein), nichts bleibt lesbar', async () => {
    await verbinden('kevin', ['gmail']);
    g.mail({ id: 'm1', von: 'anna@firma.example.invalid', betreff: 'Eins', text: 'a' });
    await A.gmailAbgleichen('kevin');
    await S.aendereGmailStand('kevin', s => ({ ...s, watch: { ablauf: Date.now() + 86_400_000, angelegt: new Date().toISOString() } }));
    const r = await TR.googleTrennenAlles('kevin');
    expect(r).toMatchObject({ war: true, widerrufen: true });
    expect(gmailAufrufe(g, '/stop', 'POST')).toHaveLength(1);
    expect(await S.ladeGmailStand('kevin')).toBeNull();
    expect((await S.ladeGmailTexte('kevin')).texte).toEqual({});
    expect(await V.ladeVerbindung('kevin')).toBeNull();
  });
  it('Gmail ausschalten: Spiegel weg, Funktion aus der Verbindung, Kalender bleibt', async () => {
    await verbinden('kevin', ['kalender']);
    await verbinden('kevin', ['gmail']);
    await A.gmailAbgleichen('kevin');
    expect(await TR.gmailAusschalten('kevin')).toBe(true);
    expect(await S.ladeGmailStand('kevin')).toBeNull();
    const v = (await V.ladeVerbindung('kevin'))!;
    expect(v.funktionen).toContain('kalender'); expect(v.funktionen).not.toContain('gmail');
    expect(await A.gmailBereit('kevin')).toBe(false);
    expect(await TR.gmailAusschalten('kevin')).toBe(false);
  });
});

describe('Takt', () => {
  it('startet je verbundener Person: erste Lesung ohne Spiegel, danach nach 2 Minuten (nicht früher); Malin ohne Gmail nie', async () => {
    await verbinden('kevin', ['gmail']);
    await verbinden('malin', ['kalender']);
    g.mail({ id: 'm1', von: 'anna@firma.example.invalid', betreff: 'Eins', text: 'a' });
    const t0 = Date.now();
    expect((await T.gmailJobsImTakt(t0)).gestartet).toEqual(['kevin']);
    await vi.waitFor(async () => expect((await S.ladeGmailStand('kevin'))?.koepfe.m1).toBeTruthy());
    await vi.waitFor(() => expect(A.gmailAbgleichLaeuft('kevin')).toBe(false));
    expect((await T.gmailJobsImTakt(t0 + 60_000)).gestartet).toEqual([]);
    vi.setSystemTime(new Date(t0 + 125_000));
    expect((await T.gmailJobsImTakt(t0 + 125_000)).gestartet).toEqual(['kevin']);
    await vi.waitFor(() => expect(A.gmailAbgleichLaeuft('kevin')).toBe(false));
    expect(await S.ladeGmailStand('malin')).toBeNull();
  });
  it('mit laufendem Push (watch) nur alle 15 Minuten', () => {
    const jetzt = Date.now();
    const s = { at: new Date(jetzt - 5 * 60_000).toISOString(), watch: { ablauf: jetzt + 86_400_000 } };
    expect(A.gmailFaellig(s, jetzt)).toBe(false);
    expect(A.gmailFaellig({ ...s, at: new Date(jetzt - 16 * 60_000).toISOString() }, jetzt)).toBe(true);
    expect(A.gmailFaellig({ ...s, watch: undefined }, jetzt)).toBe(true);
  });
});

describe('Head of IT: Befund „Gmail (Inbox)“ — nur Zähler und Zustände', () => {
  it('Lage aus den Beständen: Personen, Alter, Push; nie Adressen oder Betreffs; ohne Gmail nichts', async () => {
    const { gmailLage } = await import('@/lib/gmail/lage');
    expect(await gmailLage()).toBeNull();
    await verbinden('kevin', ['gmail']);
    g.mail({ id: 'm1', von: 'geheim@firma.example.invalid', betreff: 'Vertrauliches Angebot', text: 'x' });
    await A.gmailAbgleichen('kevin');
    const l = (await gmailLage(Date.now() + 5 * 60_000))!;
    expect(l).toMatchObject({ personen: 1, vorMin: 5, veraltet: false, getrennt: 0, push: { aktiv: 0, von: 1, moeglich: false } });
    expect(JSON.stringify(l)).not.toMatch(/geheim@|Vertraulich|makeinnovation/);
    expect((await gmailLage(Date.now() + 40 * 60_000))).toMatchObject({ veraltet: true });
  });
  it('Ampeln: grün · veraltet gelb · ab 3 Stunden rot · getrennt rot · niemand verbunden: kein Befund', async () => {
    const { gmailBefunde } = await import('@/lib/hoi/lage');
    const ok = { personen: 2, vorMin: 3, veraltet: false, getrennt: 0, push: { aktiv: 1, von: 2, moeglich: true } };
    expect(gmailBefunde(ok)[0]).toMatchObject({ id: 'gmail', ampel: 'gruen', label: 'Gmail (Inbox)' });
    expect(gmailBefunde({ ...ok, vorMin: 45, veraltet: true })[0].ampel).toBe('gelb');
    expect(gmailBefunde({ ...ok, vorMin: 200, veraltet: true })[0].ampel).toBe('rot');
    expect(gmailBefunde({ ...ok, vorMin: null, veraltet: true })[0].ampel).toBe('rot');
    expect(gmailBefunde({ ...ok, getrennt: 1 })[0].ampel).toBe('rot');
    expect(gmailBefunde({ ...ok, fehler: 'Google bittet um Pause' })[0].ampel).toBe('gelb');
    expect(gmailBefunde(null)).toEqual([]);
    expect(gmailBefunde({ ...ok, personen: 0 })).toEqual([]);
  });
});
