// ─── Zwei Zugangslücken (09.10., Befunde der Prüfung „zweite Inhaberin“) ──────────────────────────────────────────────
// (1) POST /api/loop/verbesserung: Register „Inhaber bzw. Systemlauf“ — die Route ließ jede angemeldete Person durch.
// (2) GET /api/apple-reminders: die Erinnerungen vom Mac des Haupt-Inhabers gingen an den ganzen Haushalt (der Kalender zeigt sie nur ihm).
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz, kein Modell.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-zugang-luecken-'));
process.env.MAKE_OS_DATEN_DIR = path.join(ordner, 'daten');
process.env.MAKE_OS_KEY = 'pruef-schluessel-zugang-luecken';
process.env.MAKE_OS_ZULIEFERER = 'an';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;
mkdirSync(process.env.MAKE_OS_DATEN_DIR, { recursive: true });

type H = (r: Request) => Promise<Response>;
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(p ? { 'x-make-person': p } : {}) });
async function rufe(pfad: string, m: 'GET' | 'POST', kopf: Record<string, string>) {
  const mod = (await import(`@/app/api/${pfad}/route`)) as unknown as Record<string, H>;
  const r = await mod[m](new Request(`http://test/api/${pfad}`, { method: m, headers: kopf, ...(m === 'POST' ? { body: '{}' } : {}) }));
  return { status: r.status, text: await r.text() };
}
const echtesFetch = globalThis.fetch;

beforeAll(async () => {
  globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
  const db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied') =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-probe' });
  await db.saveJson('konten', { konten: [konto('k1', 'erste', 'inhaber'), konto('k2', 'zweite', 'inhaber'), konto('k3', 'dritte', 'mitglied')], einladungen: [] });
  await db.saveJson('apple-reminders-cache', { daten: [{ id: 'r1', list: 'Liste', title: 'MARKE-ERINNERUNG-HAUPT', completed: false, priority: 0, source: 'apple-reminders' }], at: new Date().toISOString(), quelle: 'zulieferung' });
}, 60_000);
afterAll(() => { globalThis.fetch = echtesFetch; rmSync(ordner, { recursive: true, force: true }); });

describe('POST /api/loop/verbesserung — nur Systemlauf oder Inhaber', () => {
  it('Mitglied per Sitzung → 403 „Nur der Inhaber.“', async () => {
    const r = await rufe('loop/verbesserung', 'POST', sitzung('dritte'));
    expect(r.status).toBe(403);
    expect(r.text).toContain('Nur der Inhaber.');
  });
  it('Inhaber (auch der zweite) und Dienstweg kommen am Tor vorbei', async () => {
    for (const kopf of [sitzung('erste'), sitzung('zweite'), dienst()]) expect((await rufe('loop/verbesserung', 'POST', kopf)).text).not.toContain('Nur der Inhaber.');
  });
});

describe('GET /api/apple-reminders — nur der Haupt-Inhaber (Mac) bzw. der Systemlauf', () => {
  it('Haupt-Inhaber und Systemlauf bekommen den Spiegel', async () => {
    expect((await rufe('apple-reminders', 'GET', sitzung('erste'))).text).toContain('MARKE-ERINNERUNG-HAUPT');
    expect((await rufe('apple-reminders', 'GET', dienst())).status).toBe(200);
  });
  it('zweite Inhaberin, Mitglied und Dienstweg „im Auftrag“ einer anderen Person → 403, nichts vom Inhalt', async () => {
    for (const kopf of [sitzung('zweite'), sitzung('dritte'), dienst('zweite')]) {
      const r = await rufe('apple-reminders', 'GET', kopf);
      expect(r.status).toBe(403);
      expect(r.text).not.toContain('MARKE-ERINNERUNG-HAUPT');
    }
  });
});
