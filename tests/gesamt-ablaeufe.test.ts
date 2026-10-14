// ─── Gesamtprüfung vor dem Upload, Teil 2 (12.10.): Funde aus den Ende-zu-Ende-Abläufen ─────────────────────────────────────────────
// Kevin: „Es muss alles bestens zusammen laufen, die Infos müssen passen, alles was damit zu tun hat.“ Je Fund ein Wächter.
// Eigener Datenordner, erfundene Daten (@example.invalid) — nie der echte Bestand.
import { describe, it, expect, vi } from 'vitest';

await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  process.env.MAKE_OS_DATEN_DIR = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-gesamt-ablaeufe-'));
  process.env.MAKE_OS_OHNE_APPLE = '1';
  for (const n of ['MAKE_OS_DATEN_SCHLUESSEL', 'ICLOUD_APPLE_ID', 'ICLOUD_APP_PASSWORT', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) delete process.env[n];
});

const HAUS = 'ga-haus';
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS, ...extra });
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const KONTEN = [konto('k1', 'lena', 'inhaber'), konto('k2', 'jonas', 'mitglied'), konto('k3', 'ben', 'mitglied', { finanzRecht: 'business' })];

// ── 2. Fulfillment › Willkommen: drei Kick-off-Termine an drei Tagen ──────────────────────────────────────────────────────────────────
// Fund (Ablauf 8, Schritt 4): die Willkommensmail bot nur ZWEI Termine an — die Suche hörte nach 30 Plätzen auf (alle an den ersten zwei
// Tagen), erst danach filterte die Route „ein Platz je Tag“. Jetzt begrenzt `freieZeitFuer` selbst je Tag (`maxJeTag`).
describe('Freie Zeit — höchstens n je Tag', () => {
  it('freieZeitFuer mit maxJeTag 1 und grenze 3 liefert drei Plätze an drei verschiedenen Tagen; ohne maxJeTag wie bisher', async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: KONTEN, einladungen: [] });
    const { freieZeitFuer } = await import('@/lib/kalender/freie-zeit');
    const jetzt = new Date('2026-10-12T06:00:00Z');
    const je = await freieZeitFuer({ personen: ['lena'], dauerMin: 90, von: '2026-10-13', tage: 10, vorlaufMin: 0, rasterMin: 30, grenze: 3, maxJeTag: 1, jetzt });
    expect(je.vorschlaege).toHaveLength(3);
    expect(new Set(je.vorschlaege.map(v => v.tag)).size).toBe(3);
    const alt = await freieZeitFuer({ personen: ['lena'], dauerMin: 90, von: '2026-10-13', tage: 10, vorlaufMin: 0, rasterMin: 30, grenze: 30, jetzt });
    expect(new Set(alt.vorschlaege.map(v => v.tag)).size).toBeLessThan(3); // der alte Weg: 30 Plätze füllen die ersten Tage
  }, 60_000);

  it('Willkommen-Route fragt je Tag einen Platz an (Wächter gegen den Rückfall)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('app/api/fulfillment/fall/route.ts', 'utf8');
    expect(src).toMatch(/freieZeitFuer\(\{[^}]*maxJeTag: 1/);
  });
});

// ── 1. Kalender: Konten „nur Business“ sehen nie Termine aus Privat-Kalendern ─────────────────────────────────────────────────────────
// Fund (Ablauf 4/11): Ben (Partner, `finanzRecht: 'business'`) bekam über GET /api/kalender und /api/apple-calendar ohne `?space=` den Termin
// „Abendessen …“ aus dem Kalender „Privat“ mit Titel; /api/kalender/jahr zählte den Privat-Kalender mit.
describe('Kalender — nur Business', () => {
  it('GET /api/kalender, /api/apple-calendar, /api/kalender/jahr: Partner nur Business-Kalender, volle Mitglieder alles', async () => {
    const db = await import('@/lib/store/local-db');
    const { localDay } = await import('@/lib/zeit');
    const H = localDay();
    await db.saveJson('konten', { konten: KONTEN, einladungen: [] });
    await db.saveJson('calendar-cache', { at: new Date().toISOString(), quelle: 'mac', events: [
      { id: 'e-ga-arbeit', title: 'GA Arbeitstermin', startDate: `${H}T09:00:00`, endDate: `${H}T10:00:00`, allDay: false, calendarName: 'Arbeit' },
      { id: 'e-ga-privat', title: 'GA Abendessen privat', startDate: `${H}T19:00:00`, endDate: `${H}T21:00:00`, allDay: false, calendarName: 'Privat' },
    ] });
    const kal = await import('@/app/api/kalender/route');
    const apple = await import('@/app/api/apple-calendar/route');
    const jahr = await import('@/app/api/kalender/jahr/route');
    const lies = async (mod: { GET: (r: Request) => Promise<Response> }, pfad: string, wer: string) => {
      const r = await mod.GET(new Request(`http://x${pfad}`, { headers: sitzung(wer) }));
      expect(r.status).toBe(200);
      return JSON.stringify(await r.json());
    };
    for (const v of ['', '?space=privat', '?space=privat&belegt=1', '?space=business&belegt=1']) {
      const ben = await lies(kal, `/api/kalender${v}${v ? '&' : '?'}von=${H}&bis=${H}`, 'ben');
      expect(ben, `kalender${v}`).toContain('GA Arbeitstermin');
      expect(ben, `kalender${v}`).not.toContain('GA Abendessen privat');
      expect(ben, `kalender${v}`).not.toContain('"Privat"');
      const benApple = await lies(apple, `/api/apple-calendar${v}`, 'ben');
      expect(benApple, `apple${v}`).not.toContain('GA Abendessen privat');
    }
    expect(await lies(jahr, `/api/kalender/jahr?jahr=${H.slice(0, 4)}`, 'ben')).not.toContain('Privat');
    // Gegenprobe: volle Mitglieder sehen den gemeinsamen Privat-Kalender weiter (ohne `?space=`).
    expect(await lies(kal, `/api/kalender?von=${H}&bis=${H}`, 'jonas')).toContain('GA Abendessen privat');
    expect(await lies(apple, '/api/apple-calendar', 'lena')).toContain('GA Abendessen privat');
    expect(await lies(jahr, `/api/kalender/jahr?jahr=${H.slice(0, 4)}`, 'lena')).toContain('Privat');
  }, 60_000);

  // Abnahme 14.10. (B17): die Zeit-Auswertung zeigte dem Partner „Privat 32 % · 2 h“ — jetzt rechnet der Server für ihn nur Business.
  it('GET /api/kalender/auswertung: Partner bekommt keine Privat-Anteile (nurBusiness, Privat = 0) — volle Mitglieder wie bisher', async () => {
    const db = await import('@/lib/store/local-db');
    const { localDay } = await import('@/lib/zeit');
    const H = localDay();
    await db.saveJson('konten', { konten: KONTEN, einladungen: [] });
    await db.saveJson('calendar-cache', { at: new Date().toISOString(), quelle: 'mac', events: [
      { id: 'e-ga-arbeit2', title: 'GA Arbeitstermin', startDate: `${H}T09:00:00`, endDate: `${H}T10:00:00`, allDay: false, calendarName: 'Arbeit' },
      { id: 'e-ga-privat2', title: 'GA Abendessen privat', startDate: `${H}T19:00:00`, endDate: `${H}T21:00:00`, allDay: false, calendarName: 'Privat' },
    ] });
    const aw = await import('@/app/api/kalender/auswertung/route');
    const lies = async (wer: string) => {
      const r = await aw.GET(new Request(`http://x/api/kalender/auswertung?stichtag=${H}`, { headers: sitzung(wer) }));
      expect(r.status).toBe(200);
      return await r.json() as { nurBusiness?: boolean; woche: { space: { privat: number; business: number } }; schnitt: { privat: number }; vorher: { space: { privat: number } }[] };
    };
    const ben = await lies('ben');
    expect(ben.nurBusiness).toBe(true);
    expect(ben.woche.space.privat).toBe(0);
    expect(ben.schnitt.privat).toBe(0);
    expect(ben.vorher.every(w => w.space.privat === 0)).toBe(true);
    const jonas = await lies('jonas');
    expect(jonas.nurBusiness).toBeUndefined();
    expect(jonas.woche.space.privat).toBeGreaterThan(0);
  }, 60_000);

  it('POST /api/kalender/termin: Partner legt nichts in einem Privat-Kalender an (403, kein Aufruf an iCloud)', async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: KONTEN, einladungen: [] });
    vi.stubEnv('ICLOUD_APPLE_ID', 'lena@example.invalid');
    vi.stubEnv('ICLOUD_APP_PASSWORT', 'abcd-efgh-ijkl-mnop');
    vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
    const aufrufe: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => { aufrufe.push(`${i.method ?? 'GET'} ${String(u)}`); return new Response('nicht da', { status: 404 }); }));
    try {
      const { POST } = await import('@/app/api/kalender/termin/route');
      const neu = (kalender: string) => POST(new Request('http://x/api/kalender/termin', { method: 'POST', headers: sitzung('ben'), body: JSON.stringify({ titel: 'GA Termin', start: '2026-10-20T09:00', ende: '2026-10-20T10:00', kalender }) }));
      const r = await neu('Privat');
      expect(r.status).toBe(403);
      expect(aufrufe.filter(a => a.startsWith('PUT'))).toEqual([]);
      // Gegenprobe: in einen Business-Kalender greift die Sperre nicht (die Antwort kommt dann vom Kalender-Weg, nicht von der Sperre).
      const b = await neu('Arbeit');
      expect(JSON.stringify(await b.json())).not.toContain('nur den Business-Bereich');
    } finally { vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
  }, 60_000);
});
