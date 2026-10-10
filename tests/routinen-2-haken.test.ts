// ─── Routinen 2 (10.10.) — Abhaken mit Zähler und mehrmals täglich: EINE Schreibstelle, Route, ZOE-Werkzeug, Grenzen ──────────────────
// Zähler („5 von 8 Gläsern“) liegen je Person in `routinen-person--<person>`; der Haken im `health-log` steht, sobald das Tagesziel erreicht
// ist — die alten Leser (Quote, Index) zählen weiter richtig. Nie die Routine einer anderen Person zählen; der Bestand trägt immer das Suffix.
// Eigener Datenordner, erfundene Personen — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-routinen-2-'));
Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-routinen-2', MAKE_OS_KI_VORGABE: 'kompatibel', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus' });
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.MAKE_OS_ALTBESTAND_PERSON;
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

type Handler = (r: Request) => Promise<Response>;
let health: { GET: Handler; PATCH: Handler };
let routinenRoute: { GET: Handler; PATCH: Handler; PUT: Handler };
let db: typeof import('@/lib/store/local-db');
let heute: string;

const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const rufe = async (h: Handler, methode: string, pfad: string, kopf: Record<string, string>, body?: unknown) => {
  const r = await h(new Request(`http://test${pfad}`, { method: methode, headers: kopf, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  const text = await r.text();
  return { status: r.status, text, json: (text ? JSON.parse(text) : {}) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
};
const roh = (name: string) => { const d = path.join(ordner, `${name}.json`); return existsSync(d) ? readFileSync(d, 'utf8') : null; };

const ROUTINEN = [
  { id: 'trinken', label: 'Wasser trinken', wann: 'tag', kategorie: 'gesundheit', dauerMin: 5, aktiv: true, owner: 'pia', tagesZiel: 8, zaehlWort: 'Gläser' },
  { id: 'tabletten', label: 'Tabletten', wann: 'morgen', kategorie: 'gesundheit', dauerMin: 5, aktiv: true, owner: 'beide', uhrzeiten: ['08:00', '20:00'] },
  { id: 'lesen-olaf', label: 'Lesen Olaf', wann: 'abend', kategorie: 'leben', dauerMin: 20, aktiv: true, owner: 'olaf', tagesZiel: 3 },
  { id: 'einfach', label: 'Dehnen', wann: 'morgen', kategorie: 'gesundheit', dauerMin: 10, aktiv: true },
];

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  heute = (await import('@/lib/zeit')).localDay();
  health = (await import('@/app/api/state/health/route')) as unknown as typeof health;
  routinenRoute = (await import('@/app/api/state/routinen/route')) as unknown as typeof routinenRoute;
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'olaf', email: 'olaf@example.invalid', name: 'Olaf Prüf', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' },
    { id: 'k2', speicher: 'pia', email: 'pia@example.invalid', name: 'Pia Prüf', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: ['olaf'] }, haushalt: 'haus' },
  ], einladungen: [] });
  const ein = await import('@/lib/datenschutz/gesundheit-einwilligung');
  for (const p of ['olaf', 'pia']) for (const z of ['verarbeiten', 'ki'] as const) expect((await ein.gesundheitErklaeren(p, z, true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
  await db.saveJson('routinen', { routinen: ROUTINEN });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Zähler über PATCH /api/state/health', () => {
  it('plus zählt hoch, der Haken steht erst mit dem Tagesziel; minus nimmt ihn wieder weg', async () => {
    for (let i = 1; i <= 3; i++) {
      const r = await rufe(health.PATCH, 'PATCH', '/api/state/health', sitzung('pia'), { routine: 'trinken', zaehler: 'plus' });
      expect(r.status, r.text).toBe(200);
      expect(r.json).toMatchObject({ ist: i, ziel: 8 });
      expect(r.json.erledigt).not.toContain('trinken');
    }
    const fuenf = await rufe(health.PATCH, 'PATCH', '/api/state/health', sitzung('pia'), { routine: 'trinken', zaehler: 'plus', anzahl: 5 });
    expect(fuenf.json).toMatchObject({ ist: 8, ziel: 8 });
    expect(fuenf.json.erledigt).toContain('trinken');
    expect(JSON.parse(roh('health-log--pia')!)[heute]).toContain('trinken');
    const minus = await rufe(health.PATCH, 'PATCH', '/api/state/health', sitzung('pia'), { routine: 'trinken', zaehler: 'minus' });
    expect(minus.json).toMatchObject({ ist: 7 });
    expect(JSON.parse(roh('health-log--pia')!)[heute] ?? []).not.toContain('trinken');
    // Der Zähler liegt im eigenen Bestand — IMMER mit Suffix.
    expect(JSON.parse(roh('routinen-person--pia')!).zaehler[heute]).toEqual({ trinken: 7 });
    expect(roh('routinen-person')).toBeNull();
  });

  it('erledigt=true füllt bis zum Ziel auf, erledigt=false leert; eine Zahl setzt', async () => {
    expect((await rufe(health.PATCH, 'PATCH', '/api/state/health', sitzung('pia'), { routine: 'trinken', erledigt: true })).json).toMatchObject({ ist: 8 });
    expect((await rufe(health.PATCH, 'PATCH', '/api/state/health', sitzung('pia'), { routine: 'trinken', erledigt: false })).json).toMatchObject({ ist: 0, erledigt: [] });
    expect(JSON.parse(roh('routinen-person--pia')!).zaehler?.[heute]).toBeUndefined();
    expect((await rufe(health.PATCH, 'PATCH', '/api/state/health', sitzung('pia'), { routine: 'trinken', zaehler: 4 })).json).toMatchObject({ ist: 4 });
  });

  it('mehrmals täglich (zwei Uhrzeiten) ist ein Zähler mit Ziel 2 — je Person getrennt, auch bei einer gemeinsamen Routine', async () => {
    expect((await rufe(health.PATCH, 'PATCH', '/api/state/health', sitzung('pia'), { routine: 'tabletten', zaehler: 'plus' })).json).toMatchObject({ ist: 1, ziel: 2 });
    expect((await rufe(health.PATCH, 'PATCH', '/api/state/health', sitzung('olaf'), { routine: 'tabletten', zaehler: 'plus' })).json).toMatchObject({ ist: 1, ziel: 2 });
    const zwei = await rufe(health.PATCH, 'PATCH', '/api/state/health', sitzung('pia'), { routine: 'tabletten', zaehler: 'plus' });
    expect(zwei.json).toMatchObject({ ist: 2 });
    expect(zwei.json.erledigt).toContain('tabletten');
    expect(roh('health-log--olaf') ?? '').not.toContain('tabletten'); // Olafs Log bleibt bei 1 von 2 (kein Haken)
    expect(JSON.parse(roh('routinen-person--olaf')!).zaehler[heute]).toEqual({ tabletten: 1 });
  });

  it('die Routine einer anderen Person zählt niemand mit (404, nichts geschrieben); einfache Routinen wie bisher', async () => {
    const r = await rufe(health.PATCH, 'PATCH', '/api/state/health', sitzung('pia'), { routine: 'lesen-olaf', zaehler: 'plus' });
    expect(r.status).toBe(404);
    expect(roh('routinen-person--pia')).not.toContain('lesen-olaf');
    const e = await rufe(health.PATCH, 'PATCH', '/api/state/health', sitzung('pia'), { routine: 'einfach', zaehler: 'plus' });
    expect(e.json).toMatchObject({ ist: 1, ziel: 1 });
    expect(e.json.erledigt).toContain('einfach');
    expect(roh('routinen-person--pia')).not.toContain('einfach');
  });

  it('Unsinn → 400 mit Satz', async () => {
    for (const body of [{ routine: 'trinken', zaehler: 'viel' }, { routine: 'trinken', zaehler: 'plus', anzahl: 0 }, { routine: 'trinken', zaehler: 120 }, { routine: 'trinken' }]) {
      const r = await rufe(health.PATCH, 'PATCH', '/api/state/health', sitzung('pia'), body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.json.error).toBeTruthy();
    }
  });

  it('GET liefert die Zähler mit — dasselbe Tor wie der Log (die Person selbst oder wer geteilt bekommt)', async () => {
    const eigen = await rufe(health.GET, 'GET', '/api/state/health', sitzung('pia'));
    expect(eigen.json.zaehler[heute]).toMatchObject({ trinken: 4, tabletten: 2 });
    // Pia teilt mit Olaf → Olaf sieht ihre Zähler; Olaf teilt mit niemandem → Pia bekommt 403.
    expect((await rufe(health.GET, 'GET', '/api/state/health?fuer=pia', sitzung('olaf'))).json.zaehler[heute]).toMatchObject({ trinken: 4 });
    expect((await rufe(health.GET, 'GET', '/api/state/health?fuer=olaf', sitzung('pia'))).status).toBe(403);
  });
});

describe('ZOE `hake_routine` versteht Zähler und mehrmals täglich', () => {
  it('„2 Gläser getrunken“ → +2; ohne Anzahl +1; erledigt=false zählt herunter; das Schema nimmt nur ganze Zahlen 1–99', async () => {
    const { fuehreAus } = await import('@/lib/zoe/ausfuehren');
    const zwei = await fuehreAus('hake_routine', { routinen: ['Wasser'], anzahl: 2 }, 'http://test', { person: 'pia' });
    expect(zwei.text).toMatch(/^Abgehakt: Wasser trinken 6\/8 Gläser/);
    const eins = await fuehreAus('hake_routine', { routinen: ['Tabletten'] }, 'http://test', { person: 'olaf' });
    expect(eins.text).toMatch(/Tabletten 2\/2 — geschafft/);
    const runter = await fuehreAus('hake_routine', { routinen: ['Wasser'], erledigt: false }, 'http://test', { person: 'pia' });
    expect(runter.text).toMatch(/Zurückgenommen: Wasser trinken 5\/8/);
    expect((await fuehreAus('hake_routine', { routinen: ['Wasser'], anzahl: 0 }, 'http://test', { person: 'pia' })).ergebnis).toMatchObject({ ok: false, klasse: 'eingabe' });
    expect((await fuehreAus('hake_routine', { routinen: ['Wasser'], anzahl: 1.5 }, 'http://test', { person: 'pia' })).ergebnis).toMatchObject({ ok: false, klasse: 'eingabe' });
    // Die Routine einer anderen Person nennt und zählt ZOE nicht.
    const fremd = await fuehreAus('hake_routine', { routinen: ['Lesen Olaf'] }, 'http://test', { person: 'pia' });
    expect(fremd.ergebnis).toMatchObject({ ok: false });
    expect(roh('routinen-person--pia')).not.toContain('lesen-olaf');
  });
});

describe('Routinen-Route: neue Felder, Grenzen, „Belegt“', () => {
  it('PATCH speichert Regel, Zähler, Pausen — über den Grenzen 413, nichts gespeichert', async () => {
    const g = await rufe(routinenRoute.GET, 'GET', '/api/state/routinen', sitzung('pia'));
    const zeile = g.json.routinen.find((r: { id: string }) => r.id === 'trinken');
    const neu = { ...zeile, regel: { art: 'wochentage', tage: [1, 3, 5] }, pausen: [{ von: '2026-11-02', bis: '2026-11-06', grund: 'urlaub' }], erinnerung: true };
    delete neu.stand;
    const ok = await rufe(routinenRoute.PATCH, 'PATCH', '/api/state/routinen', sitzung('pia'), { ops: [{ op: 'upsert', eintrag: neu, stand: zeile.stand }] });
    expect(ok.status, ok.text).toBe(200);
    const gespeichert = JSON.parse(roh('routinen')!).routinen.find((r: { id: string }) => r.id === 'trinken');
    expect(gespeichert).toMatchObject({ regel: { art: 'wochentage', tage: [1, 3, 5] }, tagesZiel: 8, pausen: [{ von: '2026-11-02', bis: '2026-11-06', grund: 'urlaub' }], erinnerung: true });
    const vorher = roh('routinen');
    const zuViel = await rufe(routinenRoute.PATCH, 'PATCH', '/api/state/routinen', sitzung('pia'), { ops: [{ op: 'teil', id: 'trinken', felder: { uhrzeiten: Array.from({ length: 13 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`) } }] });
    expect(zuViel.status).toBe(413);
    expect(zuViel.json.error).toMatch(/höchstens 12 Uhrzeiten/);
    expect(roh('routinen')).toBe(vorher);
  });

  it('die andere Person sieht WANN (Regel, Uhrzeiten), aber weder Zähler noch Wort noch Pausengrund', async () => {
    const g = await rufe(routinenRoute.GET, 'GET', '/api/state/routinen', sitzung('olaf'));
    const belegt = g.json.routinen.find((r: { id: string }) => r.id === 'trinken');
    expect(belegt).toMatchObject({ label: 'Belegt', belegt: true, regel: { art: 'wochentage', tage: [1, 3, 5] }, pausen: [{ von: '2026-11-02', bis: '2026-11-06' }] });
    expect(JSON.stringify(belegt)).not.toMatch(/Gläser|urlaub|tagesZiel|erinnerung|Wasser/);
  });
});
