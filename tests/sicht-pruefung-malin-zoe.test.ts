// ─── Sicht-Prüfung Malin (08.10.) — ZOE-Läufe, die Malin auslösen kann ─────────────────────────────────────────────────
// (1) OKR-Agent: das Brain der AUSLÖSENDEN Person (vorher ohne Person = Inhaber → dessen „nur ich“-Aufgaben im Zielbaum).
// (2) Morgen-/Abendlauf: nur die eigenen (und personlosen) offenen Vorschläge im Prompt, nie die der anderen Person.
// Das Modell ist nachgebaut (askText fängt den Prompt ab), Datenordner temporär, erfundene Werte.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-sicht-zoe-'));
process.env.MAKE_OS_DATEN_DIR = path.join(wurzel, 'daten');
process.env.MAKE_VAULT_DIR = path.join(wurzel, 'Make.Claude');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
afterAll(async () => { await fs.rm(wurzel, { recursive: true, force: true, maxRetries: 3 }); });

const prompts: string[] = [];
vi.mock('@/lib/anthropic', async orig => ({
  ...(await orig<typeof import('@/lib/anthropic')>()),
  hasAnthropicKey: () => true,
  guthabenLeer: () => false,
  askText: async (o: { system?: string; user?: string }) => { prompts.push(`${o.system ?? ''}\n${o.user ?? ''}`); return { ok: false, error: 'nachgebaut', status: 500 }; },
  askJson: async (o: { system?: string; user?: string }) => { prompts.push(`${o.system ?? ''}\n${o.user ?? ''}`); return { ok: false, error: 'nachgebaut', status: 500 }; },
}));

const T0 = '2026-10-01T08:00:00.000Z';
const KEVIN_AUFGABE = 'SICHT-ZOE-AUFGABE-NURICH';
const KEVIN_VORSCHLAG = 'SICHT-ZOE-VORSCHLAG-KEVIN';
const MALIN_VORSCHLAG = 'SICHT-ZOE-VORSCHLAG-MALIN';
const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied') =>
  ({ id, speicher: sp, email: `${sp}@test.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-zoe' });
const anfrage = (pfad: string, person: string, body: unknown = {}) =>
  new Request(`http://test${pfad}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': person }, body: JSON.stringify(body) });

beforeAll(async () => {
  await fs.mkdir(process.env.MAKE_OS_DATEN_DIR!, { recursive: true });
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
  const a = (id: string, title: string, extra: Record<string, unknown> = {}) => ({ id, projectId: 'p-1', title, status: 'todo', priority: 'high', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'privat', ...extra });
  await db.saveJson('tasks', { projects: [], listen: [], statusEigen: [], vorlagen: [], tasks: [
    a('t-geheim', KEVIN_AUFGABE, { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin' }),
    a('t-offen', 'Gemeinsame Aufgabe Probe'),
  ] });
  const { lege } = await import('@/lib/zoe/stapel');
  await lege({ werkzeug: 'fakt_merken', gruppe: 'gedaechtnis', titel: KEVIN_VORSCHLAG, nachher: KEVIN_VORSCHLAG, eingabe: { thema: 'k', satz: KEVIN_VORSCHLAG }, person: 'kevin', quelle: 'gespraech' } as Parameters<typeof lege>[0]);
  await lege({ werkzeug: 'fakt_merken', gruppe: 'gedaechtnis', titel: MALIN_VORSCHLAG, nachher: MALIN_VORSCHLAG, eingabe: { thema: 'm', satz: MALIN_VORSCHLAG }, person: 'malin', quelle: 'gespraech' } as Parameters<typeof lege>[0]);
});

describe('OKR-Agent: Malins Lauf sieht Kevins „nur ich“-Aufgaben nicht', () => {
  it('Prompt mit der Person der Sitzung — Kevins Lauf (Gegenprobe) enthält sie', async () => {
    const { POST } = await import('@/app/api/okr/route');
    prompts.length = 0;
    await POST(anfrage('/api/okr', 'malin'));
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.join('\n')).not.toContain(KEVIN_AUFGABE);
    expect(prompts.join('\n')).toContain('Gemeinsame Aufgabe Probe');
    prompts.length = 0;
    await POST(anfrage('/api/okr', 'kevin'));
    expect(prompts.join('\n')).toContain(KEVIN_AUFGABE);
  });
});

describe('Morgenlauf: nur die eigenen offenen Vorschläge im Prompt', () => {
  it('Malin: ihr Vorschlag ja, Kevins nicht', async () => {
    const { POST } = await import('@/app/api/zoe/morgen/route');
    prompts.length = 0;
    await POST(anfrage('/api/zoe/morgen', 'malin', { zeit: 'morgen' }));
    const p = prompts.join('\n');
    expect(p).toContain(MALIN_VORSCHLAG);
    expect(p).not.toContain(KEVIN_VORSCHLAG);
  });
});
