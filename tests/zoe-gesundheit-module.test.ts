// ─── ZOE-Werkzeuge der Gesundheits-Module (09.10., Merge gesundheit-module) ──────────────────────────────────────────────
// `haut_eintrag` und `streak_eintrag` schreiben nur wie die Oberfläche: Einwilligung (a) der Person zuerst, dann ihr Modul
// (lib/gesundheit/module-server.ts). Ein ZOE-Eintrag schaltet ein Modul nie „von selbst“ über den Altbestand ein.
// Eigener Datenordner, erfundene Personen und Werte.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-zoe-ges-module-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-zoe-module';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

let db: typeof import('@/lib/store/local-db');
let raum: typeof import('@/lib/zoe/raum');
let W: typeof import('@/lib/zoe/werkzeuge');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  raum = await import('@/lib/zoe/raum');
  W = await import('@/lib/zoe/werkzeuge');
  const ein = await import('@/lib/datenschutz/gesundheit-einwilligung');
  const k = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied') =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Prüf`, rolle, hash: 'x', salz: 'x', angelegt: '2026-10-01T08:00:00.000Z', teilt: { gesundheit: [] }, haushalt: 'h-zoe-mod' });
  await db.saveJson('konten', { konten: [k('1', 'mitmodul', 'inhaber'), k('2', 'ohnemodul', 'mitglied'), k('3', 'ohneeinw', 'mitglied')], einladungen: [] });
  for (const p of ['mitmodul', 'ohnemodul']) expect((await ein.gesundheitErklaeren(p, 'verarbeiten', true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
  // ohneeinw: ausdrücklich NICHT eingewilligt (ein älteres Konto zählt sonst als Altbestand mit Hinweis).
  await ein.gesundheitErklaeren('ohneeinw', 'verarbeiten', false, ein.GESUNDHEIT_FASSUNG);
  expect(await ein.gesundheitVerarbeitungErlaubt('ohneeinw')).toBe(false);
  // mitmodul: beide Module ausdrücklich an (Körper-Profil, Schritt `modul`).
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const lauf = (name: string, input: Record<string, unknown>, person: string) => W.WERKZEUGE[name].lauf(input, 'http://test', person);

describe('ZOE: Symptom-Tagebuch und Zähler nur mit Einwilligung und eingeschaltetem Modul', () => {
  it('ohne Einwilligung (a): abgelehnt, nichts gespeichert', async () => {
    const t = String(await lauf('haut_eintrag', { juckreiz: 3 }, 'ohneeinw'));
    expect(t).toMatch(/^Abgelehnt: .*Einwilligung/);
    expect(await db.loadJson(raum.speicherFuer('haut', 'ohneeinw'))).toBeNull();
  });
  it('neue Person mit Einwilligung, Modul aus: abgelehnt, nichts gespeichert (kein Einschalten über den Altbestand)', async () => {
    for (const [w, best, input] of [['haut_eintrag', 'haut', { juckreiz: 2 }], ['streak_eintrag', 'streak', { sauber: true }]] as const) {
      const t = String(await lauf(w, input, 'ohnemodul'));
      expect(t, w).toMatch(/^Abgelehnt: /);
      expect(await db.loadJson(raum.speicherFuer(best, 'ohnemodul')), w).toBeNull();
    }
  });
  it('Person mit Altbestand (Modul abgeleitet an): Eintrag wird gespeichert', async () => {
    const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
    await db.saveJson(raum.speicherFuer('haut', 'mitmodul'), { '2026-10-01': { juckreiz: 1, at: '2026-10-01T20:00:00.000Z' } });
    await db.saveJson(raum.speicherFuer('streak', 'mitmodul'), { '2026-10-01': { sauber: true, at: '2026-10-01T21:00:00.000Z' } });
    expect(String(await lauf('haut_eintrag', { juckreiz: 2 }, 'mitmodul'))).not.toMatch(/^Abgelehnt/);
    expect(String(await lauf('streak_eintrag', { sauber: true }, 'mitmodul'))).not.toMatch(/^Abgelehnt/);
    const haut = await db.loadJson<Record<string, unknown>>(raum.speicherFuer('haut', 'mitmodul'));
    expect(Object.keys(haut ?? {})).toContain(heute);
  });
});
