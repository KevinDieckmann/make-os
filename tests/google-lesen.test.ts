// Leser über den gemeinsamen Stand: Verfügbarkeit (freie Zeit, Buchungsseite), `termineLesen` (Auswertung, Heute) und die
// Glocke sehen die Google-Termine wie iCloud — ohne eigene Sonderbehandlung. Echter Datenspeicher, Google nachgebaut.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GoogleFake } from './fixtures/google-fake';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-google-l-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-google-lesen';
process.env.MAKE_OS_KEY = 'dienst-test-google-lesen';

let V: typeof import('@/lib/google/verbindung'), A: typeof import('@/lib/kalender/google/abgleich'), db: typeof import('@/lib/store/local-db');
let VF: typeof import('@/lib/kalender/verfuegbarkeit'), TL: typeof import('@/lib/kalender/termine-lesen'), E: typeof import('@/lib/kalender/einstellungen');
let g: GoogleFake;

beforeAll(async () => {
  V = await import('@/lib/google/verbindung'); A = await import('@/lib/kalender/google/abgleich'); db = await import('@/lib/store/local-db');
  VF = await import('@/lib/kalender/verfuegbarkeit'); TL = await import('@/lib/kalender/termine-lesen'); E = await import('@/lib/kalender/einstellungen');
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-03T08:00:00.000Z'));
  g = new GoogleFake();
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => g.handle(String(u), i)));
  vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id-test'); vi.stubEnv('GOOGLE_CLIENT_SECRET', 'geheim'); vi.stubEnv('GOOGLE_ERLAUBTE_DOMAIN', 'makeinnovation.test');
  vi.stubEnv('MAKE_OS_ADRESSE', 'https://app.makeinnovation.test'); vi.stubEnv('ICLOUD_APPLE_ID', ''); vi.stubEnv('ICLOUD_APP_PASSWORT', '');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'kevin@example.invalid', name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
    { id: 'k2', speicher: 'malin', email: 'malin@example.invalid', name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  ], einladungen: [] });
  const { url } = await V.verbindungStarten('kevin', ['kalender']);
  await V.verbindungAbschliessen('kevin', 'code-ok', new URL(url).searchParams.get('state')!);
});

const ev = (id: string, titel: string, tag: string, von: string, bis: string, extra: Record<string, unknown> = {}) => g.setze({ id, summary: titel, start: { dateTime: `${tag}T${von}:00+02:00`, timeZone: 'Europe/Berlin' }, end: { dateTime: `${tag}T${bis}:00+02:00`, timeZone: 'Europe/Berlin' }, ...extra });

describe('Leser ohne iCloud — nur Google', () => {
  it('`termineLesen` liefert Google-Termine mit wer = Person; frei (transparent) bleibt frei', async () => {
    ev('a', 'Kundentermin', '2026-10-06', '10:00', '11:00');
    ev('b', 'Merker', '2026-10-06', '12:00', '13:00', { transparency: 'transparent' });
    await A.googleAbgleichen('kevin');
    const r = await TL.termineLesen(await E.ladeEinstellungen(), '2026-10-05', '2026-10-08');
    expect(r.quelle).toBe('icloud');
    expect(r.termine.map(t => [t.titel, t.wer, t.beschaeftigt])).toEqual([['Kundentermin', 'kevin', true], ['Merker', 'kevin', false]]);
    expect(r.kalender).toEqual([{ name: 'MAKE Kevin (Google)', farbe: '#9fe1e7', schreibbar: true, wer: 'kevin' }]);
  });
  it('Verfügbarkeit: ein Google-Termin belegt Kevin (nicht Malin); „frei“ nicht; abwesend (outOfOffice) zählt als Abwesenheit', async () => {
    ev('a', 'Kundentermin', '2026-10-06', '10:00', '11:00');
    ev('b', 'Merker', '2026-10-06', '12:00', '13:00', { transparency: 'transparent' });
    ev('c', 'Urlaub', '2026-10-07', '08:00', '18:00', { eventType: 'outOfOffice' });
    await A.googleAbgleichen('kevin');
    const k = await VF.verfuegbarkeitFuer('kevin', '2026-10-06', '2026-10-08');
    const belegt = JSON.stringify(k);
    expect(belegt).toContain('10:00');
    expect(VF.istFrei(k, '2026-10-06T10:15:00', '2026-10-06T10:45:00')).toBe(false);
    expect(VF.istFrei(k, '2026-10-06T12:15:00', '2026-10-06T12:45:00')).toBe(true);
    const m = await VF.verfuegbarkeitFuer('malin', '2026-10-06', '2026-10-08');
    expect(VF.istFrei(m, '2026-10-06T10:15:00', '2026-10-06T10:45:00')).toBe(true);
  });
  it('Termin aus dem Aufbau eines privaten Termins: Malin liest ihn nur als „Belegt“ (maskieren) — Kevin selbst vollständig', async () => {
    ev('p', 'Arzttermin', '2026-10-06', '09:00', '10:00', { visibility: 'private', hangoutLink: 'https://meet.google.com/geheim-link' });
    await A.googleAbgleichen('kevin');
    const { maskieren } = await import('@/lib/kalender/bezug');
    const r = await TL.termineLesen(await E.ladeEinstellungen(), '2026-10-05', '2026-10-08');
    expect(maskieren(r.termine[0], 'kevin').titel).toBe('Arzttermin');
    expect(maskieren(r.termine[0], 'malin')).toMatchObject({ titel: 'Belegt', maskiert: true });
    expect(JSON.stringify(maskieren(r.termine[0], 'malin'))).not.toMatch(/geheim-link|Arzttermin/);
    expect((maskieren(r.termine[0], 'kevin') as { link?: string }).link).toBe('https://meet.google.com/geheim-link');
  });
});
