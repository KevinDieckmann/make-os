// ─── Prüf-Funde 11.10. (Fund 1/2): Gesundheits-Log und Journal — PUT des Altwegs verliert nie mehr Haken oder Check-Antworten ────────────
// Alte Tabs/PWA (Online-Version vor dem 09.10.) schreiben den GANZEN Bestand per PUT. Fremde Bau-Kennung → 409 „neu laden“; ohne Kennung wird
// tagesweise zusammengeführt. Das Ritual schreibt nur noch per PATCH (geändertes Feld). Eigener Datenordner, erfundene Personen.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { logZusammenfuehren, journalZusammenfuehren, journalPatchFelder } from '@/lib/gesundheit/zusammenfuehren';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-put-zus-'));
Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-put-zus', MAKE_OS_KI_VORGABE: 'kompatibel', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus' });
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.MAKE_OS_ALTBESTAND_PERSON;
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

type Handler = (r: Request) => Promise<Response>;
let health: { GET: Handler; PUT: Handler; PATCH: Handler };
let journal: { GET: Handler; PUT: Handler; PATCH: Handler };
let db: typeof import('@/lib/store/local-db');

const kopf = (p: string, extra: Record<string, string> = {}) => ({ 'content-type': 'application/json', 'x-make-user': p, ...extra });
const rufe = async (h: Handler, methode: string, pfad: string, k: Record<string, string>, body?: unknown) => {
  const r = await h(new Request(`http://test${pfad}`, { method: methode, headers: k, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  const text = await r.text();
  return { status: r.status, text, json: (text ? JSON.parse(text) : {}) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
};
const roh = (name: string) => { const d = path.join(ordner, `${name}.json`); return existsSync(d) ? JSON.parse(readFileSync(d, 'utf8')) : null; };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  health = (await import('@/app/api/state/health/route')) as unknown as typeof health;
  journal = (await import('@/app/api/state/journal/route')) as unknown as typeof journal;
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'olaf', email: 'olaf@example.invalid', name: 'Olaf Prüf', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' },
  ], einladungen: [] });
  const ein = await import('@/lib/datenschutz/gesundheit-einwilligung');
  expect((await ein.gesundheitErklaeren('olaf', 'verarbeiten', true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('rein', () => {
  it('Log: je Tag vereint, nichts geht verloren, nicht genannte Tage bleiben', () => {
    const alt = { '2026-10-09': ['a', 'b'], '2026-10-10': ['c'] };
    expect(logZusammenfuehren(alt, { '2026-10-10': [], '2026-10-11': ['d', 'd'] })).toEqual({ '2026-10-09': ['a', 'b'], '2026-10-10': ['c'], '2026-10-11': ['d'] });
    expect(logZusammenfuehren(alt, { '2026-10-09': ['b', 'x'] })['2026-10-09']).toEqual(['a', 'b', 'x']);
    expect(logZusammenfuehren(alt, { kaputt: 'nein' as unknown as string[] })).toEqual(alt);
  });
  it('Journal: Felder gewinnen, check wird vereint', () => {
    const alt = { '2026-10-10': { text: 'alt', check: { koffein: true }, mood: 2 } };
    const neu = journalZusammenfuehren(alt, { '2026-10-10': { text: 'neu', mood: 4 }, '2026-10-11': { text: 'x' } });
    expect(neu['2026-10-10']).toEqual({ text: 'neu', mood: 4, check: { koffein: true } });
    expect(neu['2026-10-11']).toEqual({ text: 'x' });
  });
  it('Ritual-Körper: nur bekannte Felder, `at` nie, undefined → null', () => {
    expect(journalPatchFelder({ text: '', mood: 3, at: 'x', flags: ['y'], tagesnote: undefined })).toEqual({ text: '', mood: 3, tagesnote: null });
  });
});

describe('PUT /api/state/health (Altweg)', () => {
  it('ein alter Tab mit veraltetem Stand verliert keinen per PATCH gesetzten Haken', async () => {
    expect((await rufe(health.PATCH, 'PATCH', '/api/state/health', kopf('olaf'), { tag: '2026-10-10', routine: 'dehnen', erledigt: true })).status).toBe(200);
    // Der alte Tab kennt den Haken nicht und schickt seinen ganzen (älteren) Log.
    const put = await rufe(health.PUT, 'PUT', '/api/state/health', kopf('olaf'), { '2026-10-10': ['lesen'], '2026-10-08': ['lesen'] });
    expect(put.status, put.text).toBe(200);
    const log = roh('health-log--olaf') ?? roh('health-log');
    expect(log['2026-10-10']).toEqual(expect.arrayContaining(['dehnen', 'lesen']));
    expect(log['2026-10-08']).toEqual(['lesen']);
  });
  it('fremde Bau-Kennung → 409 neu laden, nichts geschrieben', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', 'bau-neu');
    const vorher = JSON.stringify(roh('health-log--olaf') ?? roh('health-log'));
    const put = await rufe(health.PUT, 'PUT', '/api/state/health', kopf('olaf', { 'x-make-bau': 'bau-alt' }), { '2026-10-10': [] });
    expect(put.status).toBe(409);
    expect(put.json.neuLaden).toBe(true);
    expect(JSON.stringify(roh('health-log--olaf') ?? roh('health-log'))).toBe(vorher);
    vi.unstubAllEnvs();
  });
});

describe('Journal: PUT führt zusammen, PATCH wie im Ritual', () => {
  it('Tages-Check-Antwort bleibt, wenn ein alter Tab das ganze Journal schickt', async () => {
    const frage = 'koffein-spaet';
    expect((await rufe(journal.PATCH, 'PATCH', '/api/state/journal', kopf('olaf'), { datum: '2026-10-10', eintrag: { check: { [frage]: true } } })).status).toBe(200);
    expect((await rufe(journal.PATCH, 'PATCH', '/api/state/journal', kopf('olaf'), { datum: '2026-10-10', eintrag: { gut: 'Spaziergang' } })).status).toBe(200);
    const put = await rufe(journal.PUT, 'PUT', '/api/state/journal', kopf('olaf'), { '2026-10-10': { text: 'vom alten Tab', mood: 3 } });
    expect(put.status, put.text).toBe(200);
    const j = roh('journal--olaf') ?? roh('journal');
    expect(j['2026-10-10']).toMatchObject({ text: 'vom alten Tab', mood: 3, gut: 'Spaziergang' });
    expect(j['2026-10-10'].check).toEqual({ [frage]: true });
  });
  it('fremde Bau-Kennung → 409', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', 'bau-neu');
    const put = await rufe(journal.PUT, 'PUT', '/api/state/journal', kopf('olaf', { 'x-make-bau': 'bau-alt' }), {});
    expect(put.status).toBe(409);
    vi.unstubAllEnvs();
  });
  it('PATCH nimmt tagesnote an und leert den Text mit ""', async () => {
    const a = await rufe(journal.PATCH, 'PATCH', '/api/state/journal', kopf('olaf'), { datum: '2026-10-10', eintrag: journalPatchFelder({ tagesnote: 4, text: '' }) });
    expect(a.status, a.text).toBe(200);
    expect(a.json.eintrag.tagesnote).toBe(4);
    expect(a.json.eintrag.text).toBeUndefined();
    expect(a.json.eintrag.gut).toBe('Spaziergang');
  });
  it('zu langer Text → 413, nichts gespeichert', async () => {
    const a = await rufe(journal.PATCH, 'PATCH', '/api/state/journal', kopf('olaf'), { datum: '2026-10-10', eintrag: { gut: 'x'.repeat(801) } });
    expect(a.status).toBe(413);
    expect((roh('journal--olaf') ?? roh('journal'))['2026-10-10'].gut).toBe('Spaziergang');
  });
  it('das Ritual schreibt nie mehr das ganze Journal per PUT', () => {
    const quelle = readFileSync(path.join(process.cwd(), 'components/os/RitualView.tsx'), 'utf8');
    expect(quelle).not.toMatch(/state\/journal',\s*\{\s*method:\s*'PUT'/);
    expect(quelle).toMatch(/state\/journal',\s*\{\s*method:\s*'PATCH'/);
  });
});
