// ─── Wächter: keine Ziele, Werte oder Sonderfälle EINER Person im Verhalten (08.10. abends, Fragebogen Teil 3) ──────────
// Kevin: „Alles als eigene Daten je Person/Instanz … Feste Kevin/Malin-Stellen vollständig neutralisieren.“
// Geprüft wird VERHALTEN mit erfundenen Werten (eigener Datenordner) und — wo es nur statisch geht — der Quelltext auf
// Personen-Abfragen. Nie echte Gesundheitsangaben in diesem Test.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-privat-neutral-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

let db: typeof import('@/lib/store/local-db');
beforeAll(async () => { db = await import('@/lib/store/local-db'); });
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');

describe('Vitalwerte ohne feste Rückfallwerte (Verhalten)', () => {
  it('ohne Einträge: Nullen, Stand „—“, fallback — auch für das Erstkonto (Bestand ohne Suffix)', async () => {
    const { resolveVitals } = await import('@/lib/vitals');
    for (const p of ['kevin', 'pia']) {
      expect(await resolveVitals('2026-10-09', p), p).toEqual({ rec: 0, sleep: 0, hrv: 0, rhr: 0, stand: '—', heute: false, alterTage: 999, fallback: true });
    }
  });

  it('mit Einträgen: die eigenen Werte; fehlende Felder bleiben 0 (keine Angabe); andere Personen lesen nicht mit', async () => {
    const { resolveVitals } = await import('@/lib/vitals');
    const { speicherFuer } = await import('@/lib/zoe/raum');
    await db.saveJson(speicherFuer('vitals', 'pia'), { '2026-10-08': { rec: 61 } });
    expect(await resolveVitals('2026-10-09', 'pia')).toMatchObject({ rec: 61, sleep: 0, hrv: 0, rhr: 0, stand: '2026-10-08', heute: false, alterTage: 1, fallback: false });
    expect((await resolveVitals('2026-10-09', 'olaf')).fallback).toBe(true);
  });

  it('vitalsKurz zeigt fehlende Werte als „—“; ohne Recovery plant der Fokus GELB (`tagesZone`)', async () => {
    const { vitalsKurz, tagesZone } = await import('@/lib/vitals');
    expect(vitalsKurz({ rec: 0, sleep: 0, hrv: 0, rhr: 0 })).toBe('Recovery —, Schlaf —');
    expect(vitalsKurz({ rec: 70, sleep: 7.5, hrv: 0, rhr: 0 }, ['rec', 'sleep', 'hrv'])).toBe('Recovery 70%, Schlaf 7.5h, HRV —');
    expect(tagesZone(0)).toBe('GELB');
    expect(tagesZone(80)).toBe('GRÜN');
    expect(tagesZone(30)).toBe('ROT');
  });
});

describe('Reha-Schild nur für die eigene Routine (vorher: Ziel einer Person für alle)', () => {
  it('nie Reha geplant → kein Schild; Reha in den letzten 14 Tagen und heute keiner → Schild; heute Reha oder nichts geplant → keiner', async () => {
    const { rehaFehltHeute } = await import('@/lib/risk');
    const heute = '2026-10-09';
    const fokus = { date: heute, art: 'fokus' };
    expect(rehaFehltHeute([fokus], heute)).toBe(false);
    expect(rehaFehltHeute([{ date: '2026-10-02', art: 'reha' }, fokus], heute)).toBe(true);
    expect(rehaFehltHeute([{ date: '2026-09-20', art: 'reha' }, fokus], heute)).toBe(false); // länger her als 14 Tage
    expect(rehaFehltHeute([{ date: '2026-10-02', art: 'reha' }, fokus, { date: heute, art: 'reha' }], heute)).toBe(false);
    expect(rehaFehltHeute([{ date: '2026-10-02', art: 'reha' }], heute)).toBe(false); // heute gar nichts geplant
  });
  it('Tagesplanung „Durchgeplant“: Prüfpunkt Reha nur mit eigener Reha-Gewohnheit (Demo-Rundgang 08.10.: stand fest für jede Person)', async () => {
    const { rehaGewohnt } = await import('@/lib/planung/reha-regel');
    const heute = '2026-10-09';
    expect(rehaGewohnt([], heute)).toBe(false);
    expect(rehaGewohnt([{ date: '2026-10-02', art: 'reha' }], heute)).toBe(true);
    expect(rehaGewohnt([{ date: heute, art: 'reha' }], heute)).toBe(false); // heute zählt nicht als Gewohnheit
    expect(rehaGewohnt([{ date: '2026-09-20', art: 'reha' }], heute)).toBe(false);
    const quelle = readFileSync(path.join(process.cwd(), 'components/os/TagesplanView.tsx'), 'utf-8');
    expect(quelle).toContain('rehaGewohnt(');
    expect(quelle).not.toMatch(/\{ ok: meine\.some\(b => b\.art === 'reha'\), text: 'Reha' \}/);
  });
});

describe('Quelltext: keine Abfrage einer festen Person', () => {
  it('Gesundheits-Takt (Telegram) fragt Symptom und Zähler nur nach der eigenen Einstellung', () => {
    const lauf = lies('lib/gesundheit/lauf.ts');
    expect(lauf).not.toMatch(/===\s*'(kevin|malin)'/);
    expect(lauf).toContain('koerperLaden');
  });

  it('ZOE-Morgen/-Abend und Empfang nehmen nie den Rückfall von `personAus`', () => {
    for (const d of ['app/api/zoe/morgen/route.ts', 'app/api/zoe/empfang/route.ts']) expect(lies(d), d).not.toMatch(/personAus\(/);
  });
});

describe('Oberfläche: ein Speichern sendet genau einmal', () => {
  // Ein Knopf `typ="submit"` mit eigenem `onClick` schickt zweimal (Klick + Absenden des Formulars) — beim Körper-Profil kam
  // so nach jedem Speichern ein 409. Formulare senden nur über `onSubmit`.
  it('kein `<Knopf typ="submit" … onClick=…>` unter components/', () => {
    const funde: string[] = [];
    const lauf = (d: string) => {
      for (const n of readdirSync(path.join(wurzel, d))) {
        const rel = `${d}/${n}`;
        if (statSync(path.join(wurzel, rel)).isDirectory()) { lauf(rel); continue; }
        if (!n.endsWith('.tsx')) continue;
        const q = lies(rel);
        let i = q.indexOf('typ="submit"');
        while (i >= 0) {
          const anfang = q.lastIndexOf('<Knopf', i);
          const ende = q.indexOf('</Knopf>', i);
          if (anfang >= 0 && ende > i && /onClick=/.test(q.slice(anfang, ende))) funde.push(rel);
          i = q.indexOf('typ="submit"', i + 1);
        }
      }
    };
    lauf('components');
    expect(funde).toEqual([]);
  });
});
