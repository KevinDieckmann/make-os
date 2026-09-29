// ─── Upload U1 (29.09.): Kalender-Sicherung beim ersten Start — H2 (Fenster), M4 (gestaffelt, Startverzug, Pause), N2 ─
//   H2  die Tagessicherung holt nur Termine im Fenster −400 … +800 Tage (nicht „alles“)
//   M4  nie im ersten Takt nach dem Start (≥ 30 Min. Laufzeit), nur 03:00–05:00, nie in einer iCloud-Pause; höchstens EIN
//       Kalender-Job je Takt (Abgleich → Sicherung → Spiegel)
//   N2  ein unlesbarer Stand `kalender-sicherung` wird nicht leer gelesen und überschrieben — die Sicherung bricht ab
// Eigener Datenordner (vor allen Imports), iCloud-Netz über ein gestubbtes fetch (nie ein echter Aufruf), erfundene Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const ic = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: path } = await import('node:path');
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'make-os-sicherung-u1-'));
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: ordner, MAKE_OS_DATEN_SCHLUESSEL: 'pruef-datenschluessel-sich-u1-nur-im-test',
    MAKE_OS_PEPPER: 'pruef-pepper-sicherung-u1-nur-im-test-0123456789abcdef',
    ICLOUD_APPLE_ID: 'test@example.invalid', ICLOUD_APP_PASSWORT: 'nur-im-test',
  });
  return { ordner, stand: {} as Record<string, unknown>, anfragen: [] as string[], abgleiche: 0, spiegel: 0 };
});
vi.mock('@/lib/kalender/icloud', async orig => {
  const echt = await orig<typeof import('@/lib/kalender/icloud')>();
  return { ...echt, ladeStand: async () => ic.stand, abgleichen: async () => { ic.abgleiche++; return ic.stand; } };
});
vi.mock('@/lib/kalender/spiegel-server', () => ({ eventSpiegelImTakt: async () => { ic.spiegel++; return 0; } }));

const KAL = { id: 'https://p42-caldav.icloud.com/123/calendars/home/', name: 'Privat Test', schreibbar: true };
const T0 = new Date('2026-10-05T01:00:00Z'); // 03:00 Berlin — der Prozess „startet“
const plus = (min: number) => new Date(T0.getTime() + min * 60_000);
let icl: typeof import('@/lib/kalender/icloud');
let sv: typeof import('@/lib/kalender/sicherung-server');
let tj: typeof import('@/lib/kalender/takt-jobs');

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  vi.stubGlobal('fetch', async (_url: string, init: { body?: string }) => {
    ic.anfragen.push(String(init?.body ?? ''));
    return new Response('<d:multistatus xmlns:d="DAV:"></d:multistatus>', { status: 207 });
  });
  icl = await import('@/lib/kalender/icloud');
  sv = await import('@/lib/kalender/sicherung-server');
  tj = await import('@/lib/kalender/takt-jobs');
});
afterAll(() => { vi.useRealTimers(); vi.unstubAllGlobals(); rmSync(ic.ordner, { recursive: true, force: true }); });

describe('H2: Fenster der Sicherung', () => {
  it('holt −400 … +800 Tage (CalDAV time-range), nicht alles', async () => {
    ic.anfragen.length = 0;
    await icl.holeSicherungsObjekte(KAL);
    expect(ic.anfragen).toHaveLength(1);
    // Heute = 2026-10-05 → −400 = 2025-08-31, +800 = 2028-12-13
    expect(ic.anfragen[0]).toContain('<c:time-range start="20250831T000000Z" end="20281213T000000Z"/>');
    expect([icl.SICHERUNG_VON, icl.SICHERUNG_BIS]).toEqual([-400, 800]);
  });
});

describe('M4: nie gleich nach dem Start, nie in der Pause, gestaffelt', () => {
  it('Takt 10 Min. nach dem Start um 03:10: Kalender frisch → keine Sicherung, sondern der Spiegel', async () => {
    ic.stand = { at: plus(9).toISOString(), kalender: [KAL], objekte: {} };
    const vorher = ic.spiegel;
    expect(await tj.kalenderJobsImTakt(plus(10))).toBe('spiegel');
    expect(ic.spiegel).toBe(vorher + 1);
    expect(await sv.kalenderSicherungTaeglich(plus(10))).toBeNull();
  });

  it('Kalender veraltet → NUR der Abgleich startet in diesem Takt', async () => {
    ic.stand = { at: plus(30).toISOString(), kalender: [KAL], objekte: {} };
    const [a, s] = [ic.abgleiche, ic.spiegel];
    expect(await tj.kalenderJobsImTakt(plus(40))).toBe('abgleich');
    expect([ic.abgleiche, ic.spiegel]).toEqual([a + 1, s]);
  });

  it('iCloud pausiert nach einem Fehler → weder Abgleich noch Sicherung', async () => {
    ic.stand = { at: plus(20).toISOString(), fehlerAt: plus(38).toISOString(), pauseBis: plus(50).toISOString(), kalender: [KAL], objekte: {} };
    const a = ic.abgleiche;
    expect(await tj.kalenderJobsImTakt(plus(41))).toBe('spiegel');
    expect(ic.abgleiche).toBe(a);
    expect(await sv.kalenderSicherungTaeglich(plus(41))).toBeNull();
  });

  it('40 Min. nach dem Start, 03:40, frisch, keine Pause → die Sicherung (allein) läuft', async () => {
    ic.stand = { at: plus(39).toISOString(), kalender: [KAL], objekte: {} };
    const s = ic.spiegel;
    expect(await tj.kalenderJobsImTakt(plus(40))).toBe('sicherung');
    expect(ic.spiegel).toBe(s);
    await vi.waitFor(async () => expect((await sv.ladeSicherungStand()).letzterTag).toBe('2026-10-05'));
    // Derselbe Tag: nicht noch einmal.
    expect(await sv.kalenderSicherungTaeglich(plus(45))).toBeNull();
  });

  it('nach 05:00 nicht mehr (ein Neustart um 04:50 verschiebt auf die nächste Nacht)', async () => {
    unlinkSync(path.join(ic.ordner, 'kalender-sicherung.json'));
    ic.stand = { at: plus(119).toISOString(), kalender: [KAL], objekte: {} };
    expect(await sv.kalenderSicherungTaeglich(plus(120))).toBeNull(); // 05:00 Berlin
  });
});

describe('N2: unlesbarer Stand', () => {
  it('bricht ab und überschreibt nichts', async () => {
    const datei = path.join(ic.ordner, 'kalender-sicherung.json');
    const kaputt = JSON.stringify({ __verschluesselt: 2, kid: 'x', iv: 'AAAAAAAAAAAAAAAA', tag: 'AAAAAAAAAAAAAAAAAAAAAA==', daten: 'kaputt' });
    writeFileSync(datei, kaputt);
    ic.stand = { at: plus(59).toISOString(), kalender: [KAL], objekte: {} };
    await expect(sv.kalenderSicherungTaeglich(plus(60))).rejects.toThrow();
    await expect(sv.ladeSicherungStand()).rejects.toThrow();
    expect(await sv.kalenderSicherungFaellig(plus(60)).catch(() => 'wirft')).toBe('wirft');
    expect(readFileSync(datei, 'utf8')).toBe(kaputt);
    // Der Takt läuft trotzdem weiter (eine Zeile ins Protokoll, dann der Spiegel).
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await tj.kalenderJobsImTakt(plus(61))).toBe('spiegel');
    expect(warn.mock.calls.flat().join(' ')).toMatch(/\[kalender-sicherung\] Stand nicht lesbar/);
    warn.mockRestore();
  });
});
