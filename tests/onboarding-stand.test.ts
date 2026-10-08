// ─── Onboarding auf Server-Stand (08.10.) ───────────────────────────────────
// Wächter: (1) kein Schritt verweist auf den alten Mac-Betrieb (localhost, .env.local, Tailscale, Kevins IP, iCloud-Ordner)
// oder auf die falsche Regel „auch Gesundheit“; (2) jeder `pruefung`-Schlüssel ist in lib/onboarding-status.ts bekannt;
// (3) persönliche Prüfungen lesen NUR die Person der Sitzung — Sicht X bekommt nichts aus Y; (4) jeder Link zeigt auf eine Seite.
// Datenordner im Temp-Ordner, erfundene Konten — nie .data/.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs, existsSync } from 'fs';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-onboarding-'));
process.env.MAKE_OS_DATEN_DIR = path.join(wurzel, 'daten');
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ICLOUD_APPLE_ID;
delete process.env.ICLOUD_APP_PASSWORT;
delete process.env.ICLOUD_PERSON;
afterAll(async () => { await fs.rm(wurzel, { recursive: true, force: true, maxRetries: 3 }); });

const { SCHRITTE, ZONEN } = await import('@/lib/make-one/onboarding-data');
const { ALLE_PRUEFUNGEN, PERSOENLICHE_PRUEFUNGEN, pruefeAlles } = await import('@/lib/onboarding-status');

const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher: sp, email: `${sp}@test.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-onb', ...extra });

beforeAll(async () => {
  await fs.mkdir(process.env.MAKE_OS_DATEN_DIR!, { recursive: true });
  const db = await import('@/lib/store/local-db');
  // Erste Person: zweiter Faktor an, Postfach, Gesundheit erklärt, iCloud verbunden, ein ZOE-Gespräch. Zweite: nichts davon.
  await db.saveJson('konten', {
    konten: [
      konto('k1', 'erste', 'inhaber', { zweiterFaktor: { geheimnis: 'GEHEIM', seit: '2026-10-01', wiederherstellung: [] } }),
      konto('k2', 'zweite', 'mitglied'),
    ],
    einladungen: [],
  });
  await db.saveJson('postfaecher--erste', { v: 1, postfaecher: [{ id: 'pf-1', quelle: 'imap', bereich: 'privat', anzeigename: 'Test', adresse: 'erste@test.invalid' }] });
  await db.saveJson('gesundheit-einwilligungen', { ereignisse: [{ zeit: '2026-10-01T08:00:00Z', person: 'erste', zweck: 'verarbeiten', an: true, fassung: 'x', wortlaut: 'y', von: 'erste' }] });
  await db.saveJson('icloud-verbindung--erste', { v: 1, appleId: 'erste@test.invalid', passwort: 'abcd-efgh-ijkl-mnop', verbundenAm: '2026-10-01' });
  await db.saveJson('zoe-verlauf', { gespraeche: [{ id: 'g1', person: 'erste' }] });
});

const TEXT_VERBOTEN = [/localhost/i, /\.env\.local/, /tailscale/i, /ipconfig/, /Kevins-IP/i, /auch Gesundheit/i, /npm install/, /start\.sh/, /iCloud-Ordner/i, /\.data\b/, /fd_p/];
const textVon = (o: unknown) => JSON.stringify(o);

describe('Onboarding-Daten: Server-Stand', () => {
  it('kein Schritt und keine Zone verweist auf den alten Mac-Betrieb oder „auch Gesundheit“', () => {
    for (const s of SCHRITTE) for (const re of TEXT_VERBOTEN) expect(textVon(s), `${s.id}: ${re}`).not.toMatch(re);
    for (const z of ZONEN) for (const re of TEXT_VERBOTEN) expect(textVon(z), `${z.titel}: ${re}`).not.toMatch(re);
  });

  it('jeder Prüf-Schlüssel ist bekannt; persönliche Schritte prüfen nur persönliche Schlüssel (und umgekehrt)', () => {
    const persoenlich = new Set<string>(PERSOENLICHE_PRUEFUNGEN);
    for (const s of SCHRITTE) {
      if (!s.pruefung) { expect(s.persoenlich, s.id).toBeUndefined(); continue; }
      expect(ALLE_PRUEFUNGEN, s.id).toContain(s.pruefung);
      expect(!!s.persoenlich, `${s.id}: persoenlich passt nicht zu ${s.pruefung}`).toBe(persoenlich.has(s.pruefung));
    }
  });

  it('Kennungen eindeutig, jeder Link zeigt auf eine vorhandene Seite', () => {
    const ids = SCHRITTE.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SCHRITTE) {
      if (!s.wo) continue;
      const pfad = s.wo.href.split(/[?#]/)[0].replace(/^\//, '');
      expect(existsSync(path.join(process.cwd(), 'app', pfad, 'page.tsx')), `${s.id}: ${s.wo.href}`).toBe(true);
    }
  });
});

describe('Onboarding-Prüfung: nur die Person der Sitzung', () => {
  it('persönliche Befunde gelten der angemeldeten Person — die zweite sieht nie den Stand der ersten', async () => {
    const erste = await pruefeAlles('erste');
    const zweite = await pruefeAlles('zweite');
    for (const k of ['zwei-faktor', 'gesundheit-einwilligung', 'icloud', 'postfach', 'zoe']) {
      expect(erste[k]?.erfuellt, `erste ${k}`).toBe(true);
      expect(zweite[k]?.erfuellt, `zweite ${k}`).toBe(false);
    }
    // Ohne Person (Systemlauf) gibt es keine persönlichen Befunde.
    const system = await pruefeAlles(null);
    for (const k of PERSOENLICHE_PRUEFUNGEN) expect(system[k], k).toBeUndefined();
  });

  it('kein Befund trägt Geheimnis, Apple-ID oder Adresse', async () => {
    const t = JSON.stringify(await pruefeAlles('erste')) + JSON.stringify(await pruefeAlles('zweite'));
    for (const m of ['GEHEIM', 'erste@test.invalid', 'abcd-efgh']) expect(t).not.toContain(m);
  });

  it('Route: GET /api/onboarding liefert die persönlichen Befunde der Sitzung', async () => {
    const { GET } = await import('@/app/api/onboarding/route');
    const hol = async (p: string) => (await GET(new Request('http://test/api/onboarding', { headers: { 'x-make-user': p } }))).json() as Promise<{ befunde: Record<string, { erfuellt: boolean }> }>;
    expect((await hol('erste')).befunde['zwei-faktor'].erfuellt).toBe(true);
    expect((await hol('zweite')).befunde['zwei-faktor'].erfuellt).toBe(false);
  });
});
