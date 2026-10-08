// ─── Agenten-Log je Person — Gegenprüfung 08.10.: Läufe ohne Person rechnen für den Inhaber und stehen auch unter ihm ─────────────
// Befund: der Takt-Tageslauf (und Fokus, Performance-Analyse, OKR, Board über den Dienstweg ohne Person) rechnete mit `personAus` =
// fester Rückfall auf das Erstkonto — dessen Aufgaben samt „nur ich“ —, wurde aber als Systemlauf (ohne Person) geloggt und war damit für
// alle im Haushalt lesbar. Jetzt nehmen Rechnung und Log DIESELBE Person (`laufPerson`: benannte Person, sonst der Inhaber aus den Konten).
// Wächter „Sicht B bekommt nichts aus A“. Erfundene Personen und Daten; das Modell ist nachgebaut.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-agent-log-lauf-'));
process.env.MAKE_OS_DATEN_DIR = path.join(ordner, 'daten');
process.env.MAKE_OS_KEY = 'pruef-schluessel-agent-log-lauf';
process.env.MAKE_VAULT_DIR = path.join(ordner, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); vi.restoreAllMocks(); });

const prompts: string[] = [];
vi.mock('@/lib/anthropic', async orig => ({
  ...(await orig<typeof import('@/lib/anthropic')>()),
  hasAnthropicKey: () => true,
  guthabenLeer: () => false,
  askText: async (o: { system?: string; user?: string }) => { prompts.push(`${o.system ?? ''}\n${o.user ?? ''}`); return { ok: true, text: 'Plan für heute' }; },
}));
vi.mock('@/lib/kalender/zoe-sicht-server', () => ({
  termineFuerZoe: async () => ({ stand: null, quelle: 'icloud', kemaris: [], kemarisStand: null, einstellungen: {}, termine: [] }),
}));

const NUR_ICH = 'LAUF-NUR-ICH-AUFGABE-A';
let db: typeof import('@/lib/store/local-db');
let log: typeof import('@/lib/agent-log');
let fokus: { POST: (r: Request) => Promise<Response> };
const T0 = '2026-10-01T08:00:00.000Z';

beforeAll(async () => {
  const { mkdirSync } = await import('node:fs');
  mkdirSync(process.env.MAKE_OS_DATEN_DIR!, { recursive: true });
  db = await import('@/lib/store/local-db');
  const k = (id: string, speicher: string, rolle: string) => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-lauf' });
  await db.saveJson('konten', { konten: [k('k1', 'person-a', 'inhaber'), k('k2', 'person-b', 'mitglied')], einladungen: [] });
  const a = (id: string, title: string, extra: Record<string, unknown> = {}) => ({ id, projectId: 'p-1', title, status: 'todo', priority: 'critical', assignee: 'person-a', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'privat', ...extra });
  await db.saveJson('tasks', { projects: [], listen: [], statusEigen: [], vorlagen: [], tasks: [a('t-a', NUR_ICH, { sichtbarkeit: 'nur-ich', angelegtVon: 'person-a' })] });
  log = await import('@/lib/agent-log');
  fokus = (await import('@/app/api/fokus/route')) as unknown as typeof fokus;
}, 60_000);

const systemlauf = () => new Request('http://test/api/fokus', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY! }, body: '{}' });
const alsPerson = (p: string) => new Request('http://test/api/fokus', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': p }, body: '{}' });

describe('laufPerson', () => {
  it('benannte Person zuerst, im Systemlauf der Inhaber aus den Konten — kein fester Name', async () => {
    const { laufPerson } = await import('@/lib/finanzen/haushalt/zugriff');
    expect(await laufPerson(alsPerson('person-b'))).toBe('person-b');
    expect(await laufPerson(systemlauf())).toBe('person-a');
  });
});

describe('Systemlauf ohne Person (Takt): Rechnung und Log nehmen dieselbe Person', () => {
  it('Fokus-Lauf ohne Person rechnet mit der Sicht des Inhabers und steht unter ihm — person-b sieht ihn nicht', async () => {
    prompts.length = 0;
    const r = await fokus.POST(systemlauf());
    expect(r.status).toBe(200);
    // Die Rechnung lief aus der Sicht des Inhabers (seine „nur ich“-Aufgabe im Prompt) …
    expect(prompts.join('\n')).toContain(NUR_ICH);
    const roh = (await db.loadJson<{ entries: { agent: string; person?: string }[] }>('agent-log'))!.entries.filter(e => e.agent === 'fokus');
    expect(roh.length).toBe(1);
    // … also steht der Lauf unter dem Inhaber, nicht als Systemlauf für alle.
    expect(roh[0].person).toBe('person-a');
    expect((await log.laeufeFuer('person-b')).some(e => e.agent === 'fokus')).toBe(false);
    expect((await log.laeufeFuer('person-a')).some(e => e.agent === 'fokus')).toBe(true);
  });

  it('ausgelöst von person-b: rechnet mit ihrer Sicht (ohne die „nur ich“-Aufgabe von A) und steht unter ihr', async () => {
    prompts.length = 0;
    await fokus.POST(alsPerson('person-b'));
    expect(prompts.join('\n')).not.toContain(NUR_ICH);
    const b = (await log.laeufeFuer('person-b')).filter(e => e.agent === 'fokus');
    expect(b.map(e => e.person)).toEqual(['person-b']);
  });
});

describe('Wächter: Läufe, die aus der Sicht einer Person rechnen, loggen dieselbe Person', () => {
  it('keine Route rechnet mit `personAus(req)` und loggt `personStreng(req)` (sonst stünde ein personbezogener Lauf als Systemlauf da)', () => {
    const wurzel = path.resolve(__dirname, '..');
    const dateien = (dir: string): string[] => readdirSync(path.join(wurzel, dir)).flatMap(n => {
      const rel = `${dir}/${n}`;
      return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel) : n === 'route.ts' ? [rel] : [];
    });
    const funde: string[] = [];
    for (const f of dateien('app/api')) {
      // Je Handler, der einen Lauf loggt (die Lese-Wege ohne Log — z. B. GET /api/performance — sind ein eigener, dokumentierter Punkt).
      for (const t of readFileSync(path.join(wurzel, f), 'utf8').split(/export async function /).slice(1)) {
        if (!/logRun\(/.test(t) || !/(gatherBrain|computeIndex|resolveVitals)\(/.test(t)) continue;
        if (/(gatherBrain|computeIndex|resolveVitals)\([^)]*personAus\(req\)/.test(t)) funde.push(`${f}: rechnet mit personAus`);
        if (/logRun\([\s\S]*?\{\s*person:\s*personStreng\(req\)\s*\}\s*\)/.test(t)) funde.push(`${f}: loggt personStreng`);
      }
    }
    expect(funde).toEqual([]);
  });
});
