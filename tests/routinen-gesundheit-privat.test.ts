// ─── Prüf-Fund 11.10. (9): eine Business-Routine trägt nie die Kategorie Gesundheit/Erholung ───────────────────────────────────────────
// Wächter „Business zeigt keine Gesundheits-Routine“: der Schreibweg (`sauberRoutine`) legt eine Gesundheits-/Erholungs-Routine, die im
// Business stehen soll, nach Privat; der Editor bietet im Business nur die Kategorie „Business“ an. Eigener Datenordner, erfundene Personen.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sauberRoutine, kategoriePasst } from '@/lib/planung/routinen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-routinen-ges-privat-'));
Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-routinen-ges' });
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; PATCH: Handler };
const kopf = { 'content-type': 'application/json', 'x-make-user': 'olaf' };

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'olaf', email: 'olaf@example.invalid', name: 'Olaf Prüf', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', haushalt: 'haus' },
  ], einladungen: [] });
  route = (await import('@/app/api/state/routinen/route')) as unknown as typeof route;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('rein', () => {
  it('Gesundheit/Erholung im Business → Privat (Business-Einheit fällt weg); Business-Kategorie bleibt Business', () => {
    expect(sauberRoutine({ id: 'r1', label: 'Dehnen', kategorie: 'gesundheit', space: 'business', einheit: 'KD Ventures' })).toMatchObject({ space: 'privat' });
    expect(sauberRoutine({ id: 'r1', label: 'Dehnen', kategorie: 'gesundheit', space: 'business', einheit: 'KD Ventures' })!.einheit).toBeUndefined();
    expect(sauberRoutine({ id: 'r2', label: 'Pause', kategorie: 'erholung', space: 'business' })!.space).toBe('privat');
    expect(sauberRoutine({ id: 'r3', label: 'Wochenplan', kategorie: 'business', space: 'business' })!.space).toBe('business');
    expect(sauberRoutine({ id: 'r4', label: 'Lesen', kategorie: 'leben', space: 'privat' })!.space).toBe('privat');
  });
  it('Editor: im Business nur „Business“, im Privat alles außer „Business“', () => {
    expect((['gesundheit', 'erholung', 'leben', 'business'] as const).filter(k => kategoriePasst('business', k))).toEqual(['business']);
    expect((['gesundheit', 'erholung', 'leben', 'business'] as const).filter(k => kategoriePasst('privat', k))).toEqual(['gesundheit', 'erholung', 'leben']);
    expect(readFileSync(path.join(process.cwd(), 'components/os/routinen/RoutineEditor.tsx'), 'utf8')).toContain('kategoriePasst(e.space, k.id)');
  });
});

describe('Wächter: Business zeigt keine Gesundheits-Routine', () => {
  it('angelegt als Business + Gesundheit → gespeichert als Privat; GET ?space=business enthält sie nicht', async () => {
    const p = await route.PATCH(new Request('http://test/api/state/routinen', { method: 'PATCH', headers: kopf, body: JSON.stringify({ ops: [
      { op: 'upsert', eintrag: { id: 'r-ges', label: 'GESUNDHEIT-MARKE', kategorie: 'gesundheit', space: 'business', owner: 'olaf', wann: 'morgen', dauerMin: 10, aktiv: true } },
      { op: 'upsert', eintrag: { id: 'r-biz', label: 'Wochenplanung', kategorie: 'business', space: 'business', owner: 'olaf', wann: 'morgen', dauerMin: 30, aktiv: true } },
    ] }) }));
    expect(p.status, await p.clone().text()).toBe(200);
    const b = await (await route.GET(new Request('http://test/api/state/routinen?space=business', { headers: kopf }))).text();
    expect(b).not.toContain('GESUNDHEIT-MARKE');
    expect(b).toContain('Wochenplanung');
    const pv = await (await route.GET(new Request('http://test/api/state/routinen?space=privat', { headers: kopf }))).text();
    expect(pv).toContain('GESUNDHEIT-MARKE');
  });
});

describe('Datenschutz-Prüfung N5 (11.10.): Business-Ansichten bekommen das Gesundheits-Log nicht', () => {
  it('GET /api/state/health?bereich=business → nur Haken/Zähler der Business-Routinen (serverseitig)', async () => {
    const db = await import('@/lib/store/local-db');
    const { speicherFuer } = await import('@/lib/zoe/raum');
    // r-ges (Gesundheit → Privat) und r-biz (Business) aus dem Test oben.
    await db.saveJson(speicherFuer('health-log', 'olaf'), { '2026-10-10': ['r-ges', 'r-biz'], '2026-10-09': ['r-ges'] });
    const health = (await import('@/app/api/state/health/route')) as unknown as { GET: Handler };
    const voll = await (await health.GET(new Request('http://test/api/state/health?space=privat', { headers: kopf }))).json() as { log: Record<string, string[]> };
    expect(voll.log['2026-10-10']).toEqual(['r-ges', 'r-biz']);
    const biz = await (await health.GET(new Request('http://test/api/state/health?bereich=business', { headers: kopf }))).json() as { log: Record<string, string[]>; zaehler: Record<string, unknown> };
    expect(biz.log).toEqual({ '2026-10-10': ['r-biz'] });
    expect(JSON.stringify(biz)).not.toContain('r-ges');
  });
  it('Tagesplanung und Routinen-Planer fragen mit Bereich (Log nur in Privat, Ziele mit ?space=)', () => {
    const lies = (d: string) => readFileSync(path.join(process.cwd(), d), 'utf8');
    for (const d of ['components/os/TagesplanView.tsx', 'components/os/RoutinenPlanerView.tsx']) {
      expect(lies(d), d).not.toMatch(/fetch\('\/api\/state\/health'\)/);
      expect(lies(d), d).toContain("'/api/state/health?bereich=business' : '/api/state/health?space=privat'");
    }
    expect(lies('components/os/TagesplanView.tsx')).toContain('fetch(`/api/state/ziele?space=${bereich}`)');
  });
});
