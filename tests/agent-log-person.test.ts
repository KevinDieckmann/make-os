// ─── Agenten-Log je Person (08.10., Kevin, Phase 0) — Wächter „Sicht A bekommt nichts aus B“ ──────────────────────────────
// Ein Lauf trägt `person` (wer ihn ausgelöst hat); Systemläufe und Altbestand ohne Person bleiben gemeinsam sichtbar. Gelesen wird
// nur über lib/agent-log.ts (`laeufeFuer`/`recentRuns`) mit der lesenden Person — die Läufe der anderen Person nie (Route, Brain,
// Wachstums-Score, Stammdaten, Loops, Tagesstart). Konto: Export enthält die eigenen, Löschen nimmt sie heraus. Erfundene Daten.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-agent-log-person-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-agent-log-person';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.MAKE_OS_GRABSTEINE_DIR;

let log: typeof import('@/lib/agent-log');
let db: typeof import('@/lib/store/local-db');
let route: { GET: (r: Request) => Promise<Response> };
const get = (q: string, p: string) => route.GET(new Request(`http://test/api/state/agent-log${q}`, { headers: { 'x-make-user': p } }));

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const k = (id: string, speicher: string, rolle: string) => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-l' });
  await db.saveJson('konten', { konten: [k('k1', 'person-a', 'inhaber'), k('k2', 'person-b', 'mitglied')], einladungen: [] });
  log = await import('@/lib/agent-log');
  // Altbestand (ohne `person`) = Systemlauf.
  await db.saveJson('agent-log', { entries: [{ id: 'alt-1', agent: 'board', title: 'Altlauf ohne Person', ts: '2026-10-01T08:00:00.000Z', payload: null }] });
  await log.logRun('loop-morgen', 'GEHEIM-LAUF-B', { notiz: 'GEHEIM-ERGEBNIS-B' }, { person: 'person-b' });
  await log.logRun('loop-morgen', 'Lauf von A', { notiz: 'Ergebnis A' }, { person: 'person-a' });
  await log.logRun('tageslauf-voll', 'Systemlauf', null, { person: null });
  await log.logRun('research', 'Ungültige Person', null, { person: 'Nicht Gültig!' }); // fällt auf „ohne Person“
  route = (await import('@/app/api/state/agent-log/route')) as unknown as typeof route;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('Regel und Lesen', () => {
  it('laufSichtbar: eigene und Systemläufe ja, fremde nie; ohne Person nur Systemläufe', () => {
    expect(log.laufSichtbar({}, 'person-a')).toBe(true);
    expect(log.laufSichtbar({ person: 'person-a' }, 'person-a')).toBe(true);
    expect(log.laufSichtbar({ person: 'person-b' }, 'person-a')).toBe(false);
    expect(log.laufSichtbar({ person: 'person-b' }, null)).toBe(false);
    expect(log.laufSichtbar({}, null)).toBe(true);
  });

  it('logRun trägt die Person nur in gültiger Form ein', async () => {
    const roh = (await db.loadJson<{ entries: { title: string; person?: string }[] }>('agent-log'))!.entries;
    expect(roh.find(e => e.title === 'GEHEIM-LAUF-B')?.person).toBe('person-b');
    expect(roh.find(e => e.title === 'Systemlauf')).not.toHaveProperty('person');
    expect(roh.find(e => e.title === 'Ungültige Person')).not.toHaveProperty('person');
  });

  it('recentRuns/laeufeFuer: person-a sieht eigene + System + Altbestand, nie den Lauf von person-b; der Systemlauf nur Systemläufe', async () => {
    const a = await log.recentRuns('person-a', { limit: 50 });
    expect(a.map(e => e.title).sort()).toEqual(['Altlauf ohne Person', 'Lauf von A', 'Systemlauf', 'Ungültige Person']);
    expect((await log.recentRuns('person-a', { prefix: 'loop-' })).map(e => e.title)).toEqual(['Lauf von A']);
    expect((await log.recentRuns('person-b', { agent: 'loop-morgen' })).map(e => e.title)).toEqual(['GEHEIM-LAUF-B']);
    expect((await log.laeufeFuer(null)).map(e => e.title).sort()).toEqual(['Altlauf ohne Person', 'Systemlauf', 'Ungültige Person']);
  });

  it('Route GET /api/state/agent-log: die Antwort an person-a enthält nichts aus dem Lauf von person-b (alle Filter)', async () => {
    for (const q of ['', '?limit=50', '?prefix=loop-&limit=50', '?agent=loop-morgen']) {
      const r = await get(q, 'person-a');
      expect(r.status).toBe(200);
      const text = await r.text();
      expect(text, q).not.toContain('GEHEIM-LAUF-B');
      expect(text, q).not.toContain('GEHEIM-ERGEBNIS-B');
    }
    expect(await (await get('?prefix=loop-', 'person-b')).text()).toContain('GEHEIM-ERGEBNIS-B');
  });
});

describe('Konto (Art. 15/17)', () => {
  it('Export enthält die eigenen Läufe (nicht die der anderen, keine Systemläufe); Löschen nimmt nur die eigenen heraus', async () => {
    const kd = await import('@/lib/datenschutz/konto-daten');
    const ex = await kd.kontoExport('person-b');
    expect((ex!.eintraege['agent-log'] as { title: string }[]).map(e => e.title)).toEqual(['GEHEIM-LAUF-B']);
    expect(JSON.stringify((await kd.kontoExport('person-a'))!.eintraege)).not.toContain('GEHEIM-LAUF-B');
    const bericht = await kd.kontoLoeschen('person-b');
    expect(bericht?.eintraege['agent-log']).toBe(1);
    const rest = (await db.loadJson<{ entries: { title: string }[] }>('agent-log'))!.entries.map(e => e.title).sort();
    expect(rest).toEqual(['Altlauf ohne Person', 'Lauf von A', 'Systemlauf', 'Ungültige Person']);
  });
});

describe('Wächter: niemand liest den Bestand am Lese-Weg vorbei', () => {
  it('`agent-log` wird nur in lib/agent-log.ts und den Datenschutz-/Register-Stellen direkt gelesen oder geschrieben', () => {
    const wurzel = path.resolve(__dirname, '..');
    const ERLAUBT = new Set(['lib/agent-log.ts', 'lib/datenschutz/konto-daten.ts', 'lib/crm/person-weitere.ts']);
    const dateien = (dir: string): string[] => readdirSync(path.join(wurzel, dir)).flatMap(n => {
      const rel = `${dir}/${n}`;
      return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel) : /\.(ts|tsx|mjs)$/.test(n) ? [rel] : [];
    });
    const treffer = ['app', 'lib', 'components', 'scripts'].flatMap(dateien)
      .filter(f => !ERLAUBT.has(f) && /(loadJson|updateJson|saveJson|updateJsonAsync)\s*(<[^>]*>)?\s*\(\s*['"]agent-log['"]/.test(readFileSync(path.join(wurzel, f), 'utf8')));
    expect(treffer).toEqual([]);
  });
});
