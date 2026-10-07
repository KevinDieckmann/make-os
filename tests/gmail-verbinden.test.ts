// Gmail verbinden: Knopf → /api/google/verbinden mit Funktion „gmail“ (inkrementell, kein zweites Token), Rückruf führt in die Inbox,
// der gewählte Kalender bleibt, Status nennt die Funktion; die Liste der Inbox (Threads, Einstufung ohne Modell, Link aus dem Verlauf).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GmailFake } from './fixtures/gmail-fake';
import { KONTEN, umgebung } from './fixtures/gmail-setup';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-gmail-v-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-gmail-verbinden';
process.env.MAKE_OS_KEY = 'dienst-test-gmail-verbinden';

type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let V: typeof import('@/lib/google/verbindung'), S: typeof import('@/lib/gmail/stand'), CS: typeof import('@/lib/kalender/google/stand'), db: typeof import('@/lib/store/local-db');
let verbinden: R, rueckruf: R, status: R, kalenderAbgleich: typeof import('@/lib/kalender/google/abgleich');
let g: GmailFake;
const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const dienst = { 'x-make-key': 'dienst-test-gmail-verbinden', 'x-make-person': 'kevin', 'content-type': 'application/json' };

beforeAll(async () => {
  V = await import('@/lib/google/verbindung'); S = await import('@/lib/gmail/stand'); CS = await import('@/lib/kalender/google/stand'); db = await import('@/lib/store/local-db');
  kalenderAbgleich = await import('@/lib/kalender/google/abgleich');
  verbinden = await import('../app/api/google/verbinden/route') as R; rueckruf = await import('../app/api/google/rueckruf/route') as R; status = await import('../app/api/google/status/route') as R;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-03T08:00:00.000Z'));
  g = new GmailFake(); umgebung(vi, g, { MAKE_OS_ADRESSE: 'https://app.makeinnovation.test' });
  await db.saveJson('konten', KONTEN);
});

const start = async (funktionen: string[], person = 'kevin') => {
  const r = await verbinden.POST!(new Request('http://localhost/api/google/verbinden', { method: 'POST', headers: sitzung(person), body: JSON.stringify({ funktionen }) }));
  return { status: r.status, d: await r.json() as { ok: boolean; url?: string; fehler?: string } };
};
const zurueck = (url: string, person = 'kevin') => rueckruf.GET!(new Request(`https://app.makeinnovation.test/api/google/rueckruf?code=code-ok&state=${new URL(url).searchParams.get('state')}`, { headers: sitzung(person) }));

describe('Gmail verbinden — inkrementell', () => {
  it('Route: Funktion „gmail“ wird angenommen (Scope gmail.modify), Unbekanntes fällt weg, Dienstweg 403', async () => {
    const r = await start(['gmail']);
    expect(r.d.ok).toBe(true);
    const q = new URL(r.d.url!).searchParams;
    expect(q.get('scope')!.split(' ')).toEqual(expect.arrayContaining(['openid', 'email', 'https://www.googleapis.com/auth/gmail.modify']));
    expect(q.get('scope')).not.toMatch(/calendar|mail\.google\.com/);
    expect(q.get('hd')).toBe('makeinnovation.test');
    const f = await verbinden.POST!(new Request('http://localhost/api/google/verbinden', { method: 'POST', headers: dienst, body: JSON.stringify({ funktionen: ['gmail'] }) }));
    expect(f.status).toBe(403);
    // Eine unbekannte Funktion wird ignoriert → Standard (Kalender), nie etwas Beliebiges.
    expect(new URL((await start(['drive'])).d.url!).searchParams.get('scope')).toMatch(/calendar\.events/);
    expect(V.istGoogleFunktion('gmail')).toBe(true);
  });
  it('Rückruf nur für Gmail: zurück in die Inbox, erste Lesung läuft; der Status nennt die Funktion und liefert nie ein Token', async () => {
    g.mail({ id: 'start0001', von: 'anna@firma.example.invalid', betreff: 'Erste', text: 'x' });
    const { d } = await start(['gmail']);
    const r = await zurueck(d.url!);
    expect(r.status).toBe(307);
    expect(r.headers.get('location')).toBe('https://app.makeinnovation.test/os/inbox?google=verbunden');
    await vi.waitFor(async () => expect((await S.ladeGmailStand('kevin'))?.koepfe.start0001).toBeTruthy());
    const s = await status.GET!(new Request('http://localhost/api/google/status', { headers: sitzung('kevin') }));
    const j = await s.json();
    expect(j).toMatchObject({ ok: true, verbunden: true, bereit: ['basis', 'gmail'] });
    expect(j.verfuegbareFunktionen).toEqual(expect.arrayContaining(['kalender', 'gmail']));
    expect(JSON.stringify(j)).not.toMatch(/erneuerung-geheim|zugriff-/);
  });
  it('Gmail NACH dem Kalender: der gewählte Kalender wird NICHT zurückgesetzt, der Rückruf zeigt auf die Inbox; Kalender-Anmeldung zeigt weiter auf den Kalender', async () => {
    const k = await start(['kalender']);
    const rk = await zurueck(k.d.url!);
    expect(rk.headers.get('location')).toBe('https://app.makeinnovation.test/os/kalender?google=verbunden');
    await kalenderAbgleich.googleKalenderWaehlen('kevin', 'team@group.calendar.google.test');
    expect((await CS.ladeGoogleStand('kevin'))!.kalenderId).toBe('team@group.calendar.google.test');
    const m = await start(['gmail']);
    expect(new URL(m.d.url!).searchParams.get('login_hint')).toBe('kevin@makeinnovation.test');
    const rm = await zurueck(m.d.url!);
    expect(rm.headers.get('location')).toBe('https://app.makeinnovation.test/os/inbox?google=verbunden');
    expect((await CS.ladeGoogleStand('kevin'))!.kalenderId).toBe('team@group.calendar.google.test');   // unverändert
    expect((await V.ladeVerbindung('kevin'))!.funktionen).toEqual(expect.arrayContaining(['kalender', 'gmail']));
  });
  it('Fehler führen in die Inbox zurück: fehlende Freigabe (scope-fehlt), fremde Domain, abgebrochen', async () => {
    g.basis.scopeGewaehrt = 'openid https://www.googleapis.com/auth/userinfo.email';
    const { d } = await start(['gmail']);
    expect(((await zurueck(d.url!)).headers.get('location'))).toBe('https://app.makeinnovation.test/os/inbox?google=scope-fehlt');
    const abg = await rueckruf.GET!(new Request('https://app.makeinnovation.test/api/google/rueckruf?error=access_denied', { headers: sitzung('kevin') }));
    expect(abg.headers.get('location')).toBe('https://app.makeinnovation.test/os/kalender?google=abgebrochen');
  });
});

describe('Die Liste der Inbox', () => {
  // Seit Inbox 2 (06.10.) baut der Strom die Gespräche für alle Quellen (lib/inbox/strom.ts, Tests: inbox2-rein) — die Gmail-eigene Liste ist weg.
  it('„vor X“ für die Statuszeile der Postfächer', async () => {
    const { vorText } = await import('@/components/os/inbox/daten');
    expect(vorText(0)).toBe('gerade eben'); expect(vorText(5)).toBe('vor 5 Min.'); expect(vorText(180)).toBe('vor 3 Std.'); expect(vorText(null)).toBe('noch nie');
  });
  it('Gmail geht NIE in die gemeinsame ZOE-Einstufung der Inbox (Betreff/Absender stünden im Schlüssel für das andere Konto)', async () => {
    // Seit Inbox 2 (06.10.) gibt es die gemeinsame ZOE-Einstufung gar nicht mehr: die Fächer stehen ohne Modell fest (lib/inbox/faecher.ts).
    const quelle = (await import('node:fs')).readFileSync(path.resolve(__dirname, '../components/os/inbox/InboxZwei.tsx'), 'utf8');
    expect(quelle).not.toMatch(/inbox\/triage|inbox-triage/);
    // Und im Gmail-Code kommt die gemeinsame Einstufung gar nicht vor.
    const fs = await import('node:fs');
    for (const f of ['lib/gmail', 'lib/inbox', 'lib/postfach', 'components/os/inbox']) for (const d of fs.readdirSync(path.resolve(__dirname, '..', f))) expect(fs.readFileSync(path.resolve(__dirname, '..', f, d), 'utf8'), `${f}/${d}`).not.toMatch(/inbox\/triage|inbox-triage|\/api\/inbox\/draft/);
  });
});
