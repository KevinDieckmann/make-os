// ─── Glocke: das ETag trägt den Konten-Stand (12.10., Restpunkt Sicht-Trennung) ─────────────────────────────────────────
// Ändert sich der Zugang einer Person (z. B. `finanzRecht: 'business'` — Privat-Bereich und Firmen-Akte fallen aus ihrer Glocke), darf
// GET /api/meldungen nicht mit 304 antworten. Der Konten-Stand steckt mittelbar in `anstehendStand`, steht seit 12.10. aber auch ausdrücklich in
// `meldungenStand` — dieser Wächter hält das VERHALTEN fest, egal auf welchem Weg der Stand ins ETag kommt.
// Eigener Datenordner, erfundene Konten und Aufgaben.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-meldungen-etag-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-meldungen-etag';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Mod = { GET: (r: Request) => Promise<Response> };
type Sicht = { ok: boolean; meldungen: { id: string; art: string; bezug?: { id: string } }[]; ungelesen: number };
let route: Mod;
let db: typeof import('@/lib/store/local-db');
let heute = '';
const sitzung = (p: string, extra: Record<string, string> = {}) => ({ 'x-make-user': p, ...extra });
const get = (h: Record<string, string>) => route.GET(new Request('http://test/api/meldungen', { headers: h }));
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@test.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus', ...extra });
const ids = (s: Sicht) => s.meldungen.map(m => m.bezug?.id).sort();

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const { heuteBerlin } = await import('@/lib/meldungen/speicher');
  heute = heuteBerlin();
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
  const t = (id: string, x: Record<string, unknown>) => ({ id, projectId: 'sonstige-privat', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'malin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: '2026-09-01', updatedAt: '2026-09-01', dueDate: heute, ...x });
  await db.saveJson('tasks', { projects: [], tasks: [
    t('t-privat', { spaceId: 'privat', space: 'privat' }),
    t('t-business', { projectId: 'sonstige-kdv', spaceId: 'kdv' }),
  ], listen: [], gruppen: [], statusEigen: [], vorlagen: [] });
  route = (await import('@/app/api/meldungen/route')) as unknown as Mod;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Glocke · ETag und Konten-Stand', () => {
  it('ändert sich der Zugang (finanzRecht „business“), liefert die Glocke den neuen Stand statt 304 — und der Privat-Bereich fällt heraus', async () => {
    const vorher = await get(sitzung('malin'));
    const etag = vorher.headers.get('etag')!;
    expect(etag).toBeTruthy();
    expect(ids((await vorher.json()) as Sicht)).toEqual(['t-business', 't-privat']);
    // Nichts geändert → 304.
    expect((await get(sitzung('malin', { 'if-none-match': etag }))).status).toBe(304);
    // Der Inhaber stellt Malins Konto auf „nur Business“ (Konten-Bestand, wie `aendereKonten` ihn schreibt).
    await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied', { finanzRecht: 'business' })], einladungen: [] });
    const nachher = await get(sitzung('malin', { 'if-none-match': etag }));
    expect(nachher.status).toBe(200);
    expect(nachher.headers.get('etag')).not.toBe(etag);
    expect(ids((await nachher.json()) as Sicht)).toEqual(['t-business']);
  });
  it('meldungenStand ändert sich allein durch eine Konten-Änderung (sonst wurde nichts geschrieben)', async () => {
    const { meldungenStand } = await import('@/lib/meldungen/speicher');
    const a = await meldungenStand('malin');
    await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
    expect(await meldungenStand('malin')).not.toBe(a);
  });
});
