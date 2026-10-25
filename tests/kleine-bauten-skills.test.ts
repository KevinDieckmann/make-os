// ─── Kleine Bauten · Punkt 11 (25.10.): bis zu 100 Skills je Head ─────────────────────────────────────────────────────────────────────────────
// Eine Lieferung bringt einem Head 54 Skills (vorher höchstens 50). Die Grenze steht jetzt bei 100 — darüber 413, nie gekürzt. Vorher geprüft: im
// System-Text eines Heads steht je Skill NUR Kennung, Name und Beschreibung (`skillsBlock`) — die Anleitung holt der Agent erst mit `skill_laden`. Mit 100
// Skills an ihren Grenzen bleibt der Block unter 120.000 Zeichen (≈ 30.000 Tokens), weit unter dem Kontext des Modells.
// Eigener Datenordner, erfundene Konten @example.invalid, kein Netz, Modell aus.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-kleine-bauten-skills-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-kleine-bauten-skills';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.MAKE_OS_GRABSTEINE_DIR;
  return o;
});
const echtesFetch = globalThis.fetch;
afterAll(() => { globalThis.fetch = echtesFetch; rmSync(ordner, { recursive: true, force: true }); });

import { GRENZEN, skillsHaushaltBestand } from '@/lib/agenten/typen';
import * as SK from '@/lib/agenten/skills-server';
import { skillsBlock } from '@/lib/agenten/gespraech';

const ENTWURF = {
  headId: 'sales', name: 'probe-skill', beschreibung: 'Ein erfundener Skill für die Grenze.',
  anleitung: '1. Lesen.\n2. Vorschlagen — nie senden.', werkzeuge: ['angebote_lage'], ausloeser: { art: 'hand' },
};

beforeAll(async () => {
  globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'person-a', email: 'person-a@example.invalid', name: 'person-a', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-a' },
  ], einladungen: [] });
});

describe('Skills je Head: Grenze 100', () => {
  it('die Grenze steht bei 100', () => {
    expect(GRENZEN.skillsJeHead).toBe(100);
  });
  it('der 100. Skill geht, der 101. gibt 413 mit Satz — nichts gekürzt, nichts gespeichert', async () => {
    const erst = await SK.skillAnlegen('person-a', { ...ENTWURF, name: 'probe-1' });
    expect(erst.ok, JSON.stringify(erst)).toBe(true);
    const db = await import('@/lib/store/local-db');
    const name = skillsHaushaltBestand('haus-a');
    const w = await db.loadJson<{ skills: { id: string; name: string }[] }>(name);
    const vorlage = w!.skills[0];
    // 98 weitere (erfundene) Skills direkt in den Bestand — zusammen 99.
    const mehr = Array.from({ length: GRENZEN.skillsJeHead - 2 }, (_, i) => ({ ...vorlage, id: `sk-00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, name: `probe-${i + 2}` }));
    await db.saveJson(name, { ...w, skills: [...w!.skills, ...mehr] });
    const hundert = await SK.skillAnlegen('person-a', { ...ENTWURF, name: 'probe-100' });
    expect(hundert.ok, JSON.stringify(hundert)).toBe(true);
    const zuViel = await SK.skillAnlegen('person-a', { ...ENTWURF, name: 'probe-101' });
    expect(zuViel).toMatchObject({ ok: false, status: 413 });
    expect(JSON.stringify(zuViel)).toMatch(/Höchstens 100 Skills je Head/);
    expect((await db.loadJson<{ skills: unknown[] }>(name))!.skills).toHaveLength(100);
  });
  it('im Prompt nur Kennung, Name, Beschreibung: 100 Skills an ihren Grenzen bleiben unter 120.000 Zeichen; die Anleitung steht nie darin', () => {
    const skills = Array.from({ length: GRENZEN.skillsJeHead }, (_, i) => ({
      id: `sk-00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, name: 'n'.repeat(GRENZEN.skillName), beschreibung: 'b'.repeat(GRENZEN.skillBeschreibung), anleitung: 'GEHEIME-ANLEITUNG',
    }));
    const block = skillsBlock(skills);
    expect(block.split('\n')).toHaveLength(GRENZEN.skillsJeHead + 1);
    expect(block.length).toBeLessThan(120_000);
    expect(block).not.toContain('GEHEIME-ANLEITUNG');
    expect(skillsBlock([])).toBe('');
  });
});
