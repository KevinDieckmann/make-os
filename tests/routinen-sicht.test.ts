// ─── Routinen: jede Person sieht nur eigene + gemeinsame (Praxis-Fund 04.10., erfundene Daten) ─
// Der Gesundheits-Index las alle Routinen des Haushalts — die der Partnerin standen mit Titel im Index und verfälschten die
// eigene Quote. Dieselbe Lücke in GET /api/state/routinen für persönliche Zählungen (`?sicht=ich`).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-routinen-sicht-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-routinen-sicht';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const r = (id: string, label: string, owner?: string) => ({ id, label, wann: 'morgen', kategorie: 'gesundheit', dauerMin: 10, aktiv: true, ...(owner ? { owner } : {}) });

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('routinen', { routinen: [r('r-k', 'Kevins Dehnen', 'kevin'), r('r-m', 'Malins Yoga', 'malin'), r('r-b', 'Gemeinsam spazieren', 'beide'), r('r-alt', 'Altroutine ohne Besitz')] });
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('Routinen-Sicht', () => {
  it('Gesundheits-Index: nur eigene, gemeinsame und Altroutinen ohne Besitz — nie die der Partnerin', async () => {
    const { ladeGesundheitBestand } = await import('@/lib/gesundheit/speicher');
    const b = await ladeGesundheitBestand('kevin', '2026-10-04');
    expect(b.routinen.map(x => x.id).sort()).toEqual(['r-alt', 'r-b', 'r-k']);
    expect(JSON.stringify(b)).not.toContain('Malins Yoga');
  });
  it('GET /api/state/routinen?sicht=ich filtert je Person; ohne Parameter der ganze Bestand (Routinen-Planer)', async () => {
    const route = (await import('@/app/api/state/routinen/route')) as unknown as { GET: (q: Request) => Promise<Response> };
    const hol = async (q: string) => ((await (await route.GET(new Request(`http://test/api/state/routinen${q}`, { headers: { 'x-make-user': 'malin' } }))).json()) as { routinen: { id: string }[] }).routinen.map(x => x.id).sort();
    expect(await hol('?sicht=ich')).toEqual(['r-alt', 'r-b', 'r-m']);
    expect(await hol('')).toEqual(['r-alt', 'r-b', 'r-k', 'r-m']);
  });
  it('persönliche Zählungen im Browser holen nur die eigene Sicht', () => {
    const w = path.resolve(__dirname, '..');
    for (const f of ['components/os/JournalView.tsx', 'components/os/RitualView.tsx', 'components/os/TagesplanView.tsx', 'components/os/EnergieView.tsx', 'components/os/kalender/Planen.tsx']) {
      const t = readFileSync(path.join(w, f), 'utf8');
      expect(t, f).toContain("'/api/state/routinen?sicht=ich'");
      expect(t, f).not.toMatch(/'\/api\/state\/routinen'\)/);
    }
    for (const f of ['lib/gesundheit/speicher.ts', 'lib/gesundheit/lauf.ts', 'lib/zoe/werkzeuge.ts', 'app/api/planung/vorschlag/route.ts', 'app/api/gesundheit/stand/route.ts']) {
      expect(readFileSync(path.join(w, f), 'utf8'), f).toContain('sichtbarFuer');
    }
  });
});
