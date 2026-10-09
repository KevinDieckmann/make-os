// ─── Onboarding B1 „Ebenen statt Namen“ + B5 neutrale Begrüßung (09.10., für Update 2) ─────────────────────────────────────
// ONBOARDING_PLAN.md › A5 B1/B5: die früheren Spuren mit Personen-Kennung sind weg — drei Ebenen (instanz · gemeinsam · ich) aus den
// Konten, Seiten /os/onboarding/{ich,gemeinsam,instanz}, alte Adressen nur als Weiterleitung, alte Häkchen `<speicher>-<x>` nur für
// die Person mit genau diesem Speichernamen. Dazu: eine zweite gleichwertige Inhaberin (R9) bekommt die Instanz-Schritte, aber nie
// den Altbestand des Haupt-Inhabers. Eigener Datenordner, erfundene Konten — kein echter Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs, readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-onboarding-ebenen-'));
process.env.MAKE_OS_DATEN_DIR = wurzel;
process.env.MAKE_VAULT_DIR = path.join(wurzel, 'vault'); // die Brain-Prüfung liest Regeln — nie der echte Vault
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
process.env.MAKE_OS_KEY = 'pruef-schluessel-onboarding-ebenen';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.MAKE_OS_DEMO;
afterAll(async () => { await fs.rm(wurzel, { recursive: true, force: true }); });

const D = await import('@/lib/make-one/onboarding-data');
const { SCHRITTE, EBENEN, ALT_ZU_NEU, schritteDerEbene, schrittFuer, schritteFuer, altePerson, ebeneMitId, werText } = D;
const WURZEL = path.resolve(__dirname, '..');
const lies = (f: string) => readFileSync(path.join(WURZEL, f), 'utf8');
const ohneKommentare = (q: string) => q.split('\n').filter(z => !/^\s*(\/\/|\*|\/\*)/.test(z)).join('\n');

const HAUPT = { inhaber: true, haupt: true, eingeladen: false, personen: 2, privatFinanzen: true, altbestand: true };
const ZWEITE_INHABERIN = { inhaber: true, haupt: false, eingeladen: true, personen: 2, privatFinanzen: true, altbestand: true };
const MITGLIED = { inhaber: false, haupt: false, eingeladen: true, personen: 2, privatFinanzen: true, altbestand: true };

describe('Ebenen statt Namen (Daten)', () => {
  it('drei Ebenen mit eigener Seite; jede Seite gibt es, die alten Spur-Seiten nicht mehr', () => {
    expect(EBENEN.map(e => e.id).sort()).toEqual(['gemeinsam', 'ich', 'instanz']);
    for (const e of EBENEN) {
      expect(e.href).toBe(`/os/onboarding/${e.id}`);
      expect(lies(`app/os/onboarding/${e.id}/page.tsx`)).toContain(`<EbeneView ebene="${e.id}" />`);
      expect(ebeneMitId(e.id)).toBe(e);
    }
    expect(ebeneMitId('instanz')?.nurInhaber).toBe(true);
    for (const alt of ['kevin', 'malin']) expect(existsSync(path.join(WURZEL, 'app/os/onboarding', alt)), alt).toBe(false);
    expect(existsSync(path.join(WURZEL, 'components/os/WillkommenMalin.tsx'))).toBe(false);
  });

  it('jede Ebene hat ihre Schritte, zusammen genau alle; kein Spur-Feld mehr; nur Altbestand-Kennungen tragen Namen', () => {
    const alle = EBENEN.flatMap(e => schritteDerEbene(e.id));
    expect(alle.length).toBe(SCHRITTE.length);
    expect(new Set(alle.map(s => s.id)).size).toBe(SCHRITTE.length);
    for (const s of SCHRITTE) expect('spur' in s, s.id).toBe(false);
    const q = lies('lib/make-one/onboarding-data.ts');
    expect(q).not.toMatch(/SPUREN|spurFuerRolle|schritteVon\b/);
    // Namen kommen nur noch als Schlüssel alter Häkchen vor (ALT_ZU_NEU — Altbestand), sonst nirgends im Code.
    const ohneAlt = ohneKommentare(q).replace(/export const ALT_ZU_NEU[\s\S]*?\n};/, '');
    expect(ohneAlt).not.toMatch(/\b(kevin|malin)\b/i);
  });

  it('wer welchen Schritt bekommt: Haupt-Inhaber, zweite Inhaberin, Mitglied — aus dem Konto', () => {
    const haupt = schritteFuer(HAUPT), zweite = schritteFuer(ZWEITE_INHABERIN), mitglied = schritteFuer(MITGLIED);
    const einladung = SCHRITTE.find(s => s.id === 'zweite-einladung')!;
    expect(einladung.nurEingeladen).toBe(true);
    expect(schrittFuer(einladung, HAUPT)).toBe(false);
    expect(schrittFuer(einladung, ZWEITE_INHABERIN)).toBe(true);
    expect(schrittFuer(einladung, MITGLIED)).toBe(true);
    // Ohne Angabe „eingeladen“ gilt: wer nicht Inhaber ist (ältere Kontext-Objekte).
    expect(schrittFuer(einladung, { inhaber: false, personen: 2 })).toBe(true);
    expect(schrittFuer(einladung, { inhaber: true, personen: 2 })).toBe(false);
    // Instanz und Inhaber-Schritte: jeder Inhaber, nie ein Mitglied.
    for (const s of SCHRITTE.filter(x => x.nurInhaber && !x.nurAltbestand)) {
      expect(haupt, s.id).toContain(s);
      expect(zweite, s.id).toContain(s);
      expect(mitglied, s.id).not.toContain(s);
    }
    expect(werText(einladung)).toBe('neue Person');
  });

  it('alte Häkchen: der Speichername steht im Präfix — nur Kennungen aus der Altbestand-Tabelle zählen', () => {
    for (const alt of Object.keys(ALT_ZU_NEU)) {
      const p = altePerson(alt);
      if (alt === 'updates') expect(p).toBeNull();
      else expect(p, alt).toBe(alt.split('-')[0]);
    }
    expect(altePerson('fremd-ich-sicht')).toBeNull(); // nicht in der Tabelle → nie einer Person zugeordnet
  });

  it('Weiterleitungen der alten Spur-Adressen, Schnellsuche und Einstellungen ohne Spur', async () => {
    const { default: konfig } = await import('../next.config.mjs');
    const regeln = await (konfig as { redirects: () => Promise<{ source: string; destination: string }[]> }).redirects();
    const ziel = (q: string) => regeln.find(r => r.source === q)?.destination;
    expect(ziel('/os/onboarding/kevin')).toBe('/os/onboarding');
    expect(ziel('/os/onboarding/malin')).toBe('/os/onboarding/ich');
    const seiten = lies('lib/make-one/seiten.ts');
    for (const e of EBENEN) expect(seiten).toContain(`'${e.href}'`);
    expect(seiten).not.toMatch(/onboarding\/(kevin|malin)|Spur/);
    expect(lies('lib/make-one/einstellungen.ts')).not.toMatch(/Spur/i);
    const v = lies('components/os/OnboardingView.tsx');
    expect(v).not.toMatch(/SPUREN|SpurView|spurFuerRolle/);
    expect(v).toContain('export function EbeneView');
  });
});

describe('Kontext und Befunde mit zwei Inhabern (Server)', () => {
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp[0].toUpperCase()}${sp.slice(1)} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-ebenen', ...extra });
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [konto('k1', 'erste', 'inhaber'), konto('k2', 'zweite', 'inhaber', { eingeladenVon: 'erste' }), konto('k3', 'dritte', 'mitglied', { eingeladenVon: 'erste' })], einladungen: [], einstellungen: { hauptInhaber: 'erste' } });
  });

  it('kontextFuer: Inhaber-Rechte für beide, Haupt nur der erste, eingeladen alle außer dem Haupt', async () => {
    const { kontextFuer } = await import('@/lib/onboarding-status');
    expect(await kontextFuer('erste')).toMatchObject({ inhaber: true, haupt: true, eingeladen: false, personen: 3 });
    expect(await kontextFuer('zweite')).toMatchObject({ inhaber: true, haupt: false, eingeladen: true });
    expect(await kontextFuer('dritte')).toMatchObject({ inhaber: false, haupt: false, eingeladen: true });
  });

  it('Befunde: den Altbestand (Körper des Haupt-Inhabers) prüft nur dessen Sitzung; die zweite Inhaberin sieht die Instanz voll', async () => {
    const { pruefeAlles } = await import('@/lib/onboarding-status');
    const zweite = await pruefeAlles('zweite');
    expect(zweite.altbestand).toBeUndefined();
    expect(zweite.inhaber).toMatchObject({ erfuellt: true, wert: '2 Inhaber' });
    expect(zweite.pepper?.wert).not.toMatch(/^Instanz eingerichtet/);
    const dritte = await pruefeAlles('dritte');
    expect(dritte.pepper?.wert).toMatch(/^Instanz eingerichtet/);
    expect(dritte.altbestand).toBeUndefined();
    expect((await pruefeAlles('erste')).altbestand).toBeDefined();
  });

  it('Onboarding-POST: die zweite Inhaberin hakt Instanz-Schritte ab, ein Mitglied nicht', async () => {
    const { POST } = await import('@/app/api/onboarding/route');
    const setze = (p: string, id: string) => POST(new Request('http://test/api/onboarding', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': p }, body: JSON.stringify({ id, an: true }) }));
    expect((await setze('zweite', 'datenschutz')).status).toBe(200);
    expect((await setze('dritte', 'ki-instanz')).status).toBe(403);
  });
});

describe('B5: neutrale Begrüßung neuer Personen', () => {
  it('kein Name, keine privaten Sätze im Code — der Vorname kommt vom Server', () => {
    const q = lies('components/os/Willkommen.tsx');
    expect(q).not.toMatch(/\b(kevin|malin|Schatz|liebe dich)\b/i);
    expect(lies('app/os/layout.tsx')).toContain('<Willkommen />');
    expect(lies('app/os/layout.tsx')).not.toContain('WillkommenMalin');
  });

  it('GET zeigt den Gruß genau dem eingeladenen Konto, das ihn noch nicht gesehen hat — nie dem Haupt-Inhaber', async () => {
    const db = await import('@/lib/store/local-db');
    const { GET, POST } = await import('@/app/api/state/willkommen/route');
    const hol = async (p: string) => (await GET(new Request('http://test/api/state/willkommen', { headers: { 'x-make-user': p } }))).json() as Promise<{ zeigen: boolean; vorname?: string }>;
    await db.saveJson('willkommen', { gesehen: { dritte: '2026-10-01T00:00:00.000Z' } });
    expect(await hol('erste')).toMatchObject({ zeigen: false });
    expect(await hol('zweite')).toMatchObject({ zeigen: true, vorname: 'Zweite' });
    expect(await hol('dritte')).toMatchObject({ zeigen: false });
    expect((await POST(new Request('http://test/api/state/willkommen', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': 'zweite' }, body: '{}' }))).status).toBe(200);
    expect(await hol('zweite')).toMatchObject({ zeigen: false });
  });
});
