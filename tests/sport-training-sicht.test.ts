// ─── Wächter (Art. 9): Trainings sieht nur die Person selbst — auch wer Gesundheit geteilt bekommt, sieht den Sport NICHT (09.10.) ────
// Sport ist persönlich (Route ohne ?fuer=, Bestand je Person). Geprüft: GET /api/sport, „Für dich“ (/api/fluss Gesundheit), die Sport-Kachel
// in einer fremden Ansicht, und die Trainings-Ansicht selbst (statisches Rendern, erfundene WHOOP-Workouts). Eigener Datenordner, nie .data.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { rmSync } from 'node:fs';

// Datenordner VOR allen Imports (die Abbildung hängt über die Vitalwerte an der Datenschicht).
const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-sport-sicht-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-sport-sicht';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/sport' }));
vi.mock('@/lib/kalender/zoe-sicht-server', () => ({ termineFuerZoe: async () => ({ termine: [] }) }));

import { workoutAus, sportAnwenden } from '@/lib/whoop/abbilden';
import { training } from './fixtures/whoop-fake';
import { leererStand, type SportStand } from '@/lib/sport/modell';
import { localDay } from '@/lib/zeit';
import { tagPlus, montagVon } from '@/lib/sport/pace';

const HEUTE = localDay();
const MONTAG = montagVon(HEUTE);
const z = (tag: string, uhr: string) => `${tag}T${uhr}:00+02:00`;
/** Erfundene Workouts der laufenden Woche (ab Montag) — ohne Distanz, wie die vermissten. */
const workouts = [
  workoutAus(training(1, z(MONTAG, '07:00'), 60, 'Functional Fitness', { strain: 13.5, zonen: [1, 5, 20, 22, 10, 2] }))!,
  workoutAus(training(2, z(MONTAG, '18:00'), 45, 'Strength Trainer', { strain: 9 }))!,
  workoutAus(training(3, z(tagPlus(MONTAG, -7), '17:00'), 30, 'Sauna'))!,
];
const STAND: SportStand = { ...sportAnwenden(leererStand(), workouts, '2020-01-01').stand, einstieg: { fertig: true } };

type Mod = { GET: (r: Request) => Promise<Response> };
let sport: Mod; let fluss: Mod;
const req = (url: string, person: string) => new Request(`http://test${url}`, { headers: { 'x-make-user': person } });

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const k = (id: string, speicher: string, rolle: string, teilt: string[]) => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: teilt }, haushalt: 'pruef-haus' });
  // Pia teilt ihre Gesundheit ausdrücklich mit Olaf — der Sport bleibt trotzdem nur ihrer.
  await db.saveJson('konten', { konten: [k('k1', 'pia', 'inhaber', ['olaf']), k('k2', 'olaf', 'mitglied', [])], einladungen: [] });
  const { speicherFuer } = await import('@/lib/zoe/raum');
  await db.saveJson(speicherFuer('sport', 'pia'), STAND);
  sport = (await import('@/app/api/sport/route')) as unknown as Mod;
  fluss = (await import('@/app/api/fluss/route')) as unknown as Mod;
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => {});
  rmSync(ordner, { recursive: true, force: true });
});

describe('Sicht Olaf bekommt nichts aus Pias Training', () => {
  it('GET /api/sport: Pia sieht ihre Trainings, Olaf einen eigenen leeren Stand — auch mit ?fuer=pia', async () => {
    const p = await (await sport.GET(req('/api/sport', 'pia'))).json();
    expect(p.stand.training).toHaveLength(3);
    for (const url of ['/api/sport', '/api/sport?fuer=pia', '/api/sport?person=pia']) {
      const o = await (await sport.GET(req(url, 'olaf'))).json();
      expect(o.ich, url).toBe('olaf');
      expect(o.stand.training, url).toBeUndefined();
      expect(JSON.stringify(o), url).not.toMatch(/functional-fitness|strength-trainer|whoop:/);
    }
  });
  it('„Für dich“ (Fluss Gesundheit): Pias Einheiten zählen nur bei Pia', async () => {
    const summe = (a: number[]) => a.reduce((x, y) => x + y, 0);
    const p = await (await fluss.GET(req('/api/fluss?bereich=gesundheit', 'pia'))).json();
    expect(summe(p.fluss.ist)).toBe(2); // Functional + Kraft; die Sauna zählt nicht
    const o = await (await fluss.GET(req('/api/fluss?bereich=gesundheit', 'olaf'))).json();
    expect(summe(o.fluss.ist)).toBe(0);
  });
  it('die Sport-Kachel einer fremden Ansicht lädt nichts und zeigt nur den Satz', async () => {
    const { SportKurz } = await import('@/components/os/sport/SportKurz');
    const html = renderToStaticMarkup(createElement(SportKurz, { eigene: false }));
    expect(html).toContain('Sport ist persönlich');
  });
});

describe('Ansicht „Training“ (statisch gerendert, erfundene Werte)', () => {
  it('zeigt WHOOP-Trainings mit Sparte, Dauer, Strain, Quelle, Zonen — Sauna mit „zählt nicht“', async () => {
    const { TrainingTeil } = await import('@/components/os/sport/TrainingTeil');
    const html = renderToStaticMarkup(createElement(TrainingTeil, { stand: STAND, heute: HEUTE, vorlagen: [], schicke: async () => true, onReiter: () => {} }));
    expect(html).toContain('Functional Fitness');
    expect(html).toContain('Krafttraining');
    expect(html).toContain('Hyrox &amp; Functional');
    expect(html).toContain('Strain 13,5');
    expect(html).toContain('WHOOP');
    expect(html).toContain('Herzfrequenz-Zonen');
    expect(html).toContain('zählt nicht');
    expect(html).toContain('Sportarten zuordnen');
    expect(html).not.toMatch(/Noch keine Einheiten/);
  });
  it('die Sport-Kachel zählt die Trainings der Woche (vorher „0 von …“)', async () => {
    const { wocheIst } = await import('@/lib/sport/plan');
    expect(wocheIst(STAND, MONTAG)).toMatchObject({ einheiten: 2, hyrox: 1, gym: 1 });
  });
});
