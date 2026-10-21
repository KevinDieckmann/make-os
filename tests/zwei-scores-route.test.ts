// ─── Die zwei Scores (21.10.) — Route, Trennung, ZOE, Heute, Finanzen ─────────────────────────────────────────────────────────────────
// Wächter „Sicht X bekommt nichts aus Y“ mit erfundenen Personen (Temp-Datenordner, nie .data/):
//   person-a  Inhaber, Haushalt haus-t, Einwilligung (a) Gesundheit, Körperwerte, teilt Gesundheit mit person-b
//   person-b  Mitglied haus-t (die zweite Person) — bekommt NIE den Gesundheitsteil von person-a, auch nicht geteilt
//   person-c  anderer Haushalt · person-d  Finanzrecht „nur Business“ · person-e  ohne Haushalt (Testkunde)
// Geprüft: GET /api/scores (nur eigene, je Sicht nur ihr Score, `?space=` schränkt ein, Dienstweg 403), POST nur eigene Schwellen, der Brain-Block
// (je Sicht nur ihr Score, ohne Einwilligung (b) ohne Gesundheit), Heute (Score oben, kein Wachstums-Score, kein doppelter Business-Index) und
// Finanzen › Business › Cockpit (nur die Finanzielle Gesundheit). Netz gesperrt, Modelle aus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-zwei-scores-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_VAULT_DIR = path.join(ordner, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
process.env.MAKE_OS_KEY = 'pruef-schluessel-zwei-scores';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

type H = (r: Request) => Promise<Response>;
const wurzel = path.resolve(__dirname, '..');
const lies = (rel: string) => readFileSync(path.join(wurzel, rel), 'utf8');
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const tagMinus = (n: number) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const MARKE_PRIVAT = 'MARKE-PRIVAT-AUFGABE-A';
const MARKE_BUSINESS = 'MARKE-BUSINESS-AUFGABE-A';

let route: { GET: H; POST: H };
const echtesFetch = globalThis.fetch;

beforeAll(async () => {
  globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
  const db = await import('@/lib/store/local-db');
  const k = (id: string, speicher: string, rolle: string, haushalt: string | null, extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}), ...extra });
  await db.saveJson('konten', { konten: [
    k('k1', 'person-a', 'inhaber', 'haus-t', { teilt: { gesundheit: ['person-b'] } }), k('k2', 'person-b', 'mitglied', 'haus-t'),
    k('k3', 'person-c', 'mitglied', 'anderes-haus'), k('k4', 'person-d', 'mitglied', 'haus-t', { finanzRecht: 'business' }), k('k5', 'person-e', 'mitglied', null),
  ], einladungen: [] });
  // Einwilligung (a) „verarbeiten“ nur für person-a — und Körperwerte der letzten 14 Tage (erfunden).
  await db.saveJson('gesundheit-einwilligungen', { ereignisse: [{ zeit: '2026-10-01T08:00:00.000Z', person: 'person-a', zweck: 'verarbeiten', an: true, fassung: 'x', wortlaut: 'y', von: 'person-a' }] });
  await db.saveJson('vitals--person-a', Object.fromEntries(Array.from({ length: 14 }, (_, i) => [tagMinus(i), { rec: 55, sleep: 7.2, hrv: 60, rhr: 55 }])));
  const T0 = '2026-10-01T00:00:00.000Z';
  const a = (id: string, title: string, spaceId: string, projectId: string, x: Record<string, unknown> = {}) =>
    ({ id, projectId, title, description: title, status: 'todo', priority: 'critical', assignee: 'person-a', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId, dueDate: tagMinus(3), ...x });
  await db.saveJson('tasks', {
    projects: [
      { id: 'p-privat', title: 'Haus', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat' },
      { id: 'p-business', title: 'Vertrieb', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'ug' },
    ],
    listen: [], statusEigen: [], vorlagen: [],
    tasks: [a('t-privat', MARKE_PRIVAT, 'privat', 'p-privat'), a('t-business', MARKE_BUSINESS, 'ug', 'p-business')],
  });
  route = (await import('@/app/api/scores/route')) as unknown as typeof route;
}, 60_000);
afterAll(async () => {
  globalThis.fetch = echtesFetch;
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

const holen = async (wer: string, q = '', kopf: Record<string, string> = sitzung(wer)) => {
  const r = await route.GET(new Request(`http://test/api/scores${q}`, { headers: kopf }));
  return { status: r.status, text: await r.text() };
};
const json = (t: string) => JSON.parse(t) as Record<string, unknown> & { privat?: { saeulen: { id: string; score: number | null }[]; index: number | null }; business?: { saeulen: { id: string }[] } };

describe('GET /api/scores — nur die eigenen, je Sicht nur ihr Score', () => {
  it('Inhaber: beide Scores; Sicht Privat nur Privat, Sicht Business nur Business (auch über ?space=)', async () => {
    const beide = json((await holen('person-a')).text);
    expect(Object.keys(beide).sort()).toEqual(['business', 'ok', 'privat']);
    // Gesundheit zählt mit Einwilligung (a): die Säule trägt eine Zahl.
    expect(beide.privat!.saeulen.find(s => s.id === 'ge')!.score).not.toBeNull();
    for (const q of ['?sicht=privat', '?space=privat', '?sicht=beide&space=privat']) expect(Object.keys(json((await holen('person-a', q)).text)).sort(), q).toEqual(['ok', 'privat']);
    for (const q of ['?sicht=business', '?space=business']) {
      const b = await holen('person-a', q);
      expect(Object.keys(json(b.text)).sort(), q).toEqual(['business', 'ok']);
      for (const id of ['"ge"', '"fi"', '"pl"', '"fa"', 'Privat-Score']) expect(b.text, `${q} ${id}`).not.toContain(id);
    }
    // Widerspruch Sicht/space → 403, nie still der andere Score.
    expect((await holen('person-a', '?sicht=privat&space=business')).status).toBe(403);
    expect((await holen('person-a', '?sicht=alles')).status).toBe(400);
  }, 60_000);

  it('zweite Person: bekommt NIE den Gesundheitsteil der anderen — auch geteilt und mit Personen-Parametern nur ihren eigenen', async () => {
    for (const q of ['', '?sicht=privat', '?sicht=privat&fuer=person-a&person=person-a&wer=person-a', '?sicht=privat&voll=1&fuer=person-a']) {
      const r = await holen('person-b', q);
      expect(r.status, q).toBe(200);
      const d = json(r.text);
      // person-b hat keine eigenen Körperwerte: ihre Gesundheits-Säule hat keine Zahl — die Werte von person-a (geteilt!) kommen nie an.
      if (d.privat) expect(d.privat.saeulen.find(s => s.id === 'ge')?.score ?? null, q).toBeNull();
      const pi = (d as { pi?: { saeulen: { id: string; score: number | null; kennzahlen: { gemessen: boolean }[] }[] } }).pi;
      if (pi) {
        const ge = pi.saeulen.find(s => s.id === 'ge')!;
        expect(ge.score).toBeNull();
        expect(ge.kennzahlen.every(k => !k.gemessen)).toBe(true);
      }
      // Aufgaben von person-a (privat wie Business) stehen nie in ihrer Antwort.
      expect(r.text).not.toContain(MARKE_PRIVAT);
      expect(r.text).not.toContain(MARKE_BUSINESS);
    }
    // Gegenprobe: person-a sieht im ganzen Privat-Score ihre eigene überfällige private Aufgabe — nie die Business-Aufgabe.
    const eigen = await holen('person-a', '?sicht=privat&voll=1');
    expect(eigen.text).toContain(MARKE_PRIVAT);
    expect(eigen.text).not.toContain(MARKE_BUSINESS);
  }, 60_000);

  it('„nur Business“: nie ein Privat-Score (403 bzw. fehlt); Testkunde und anderer Haushalt: 403; Dienstweg: 403', async () => {
    expect((await holen('person-d', '?sicht=privat')).status).toBe(403);
    expect((await holen('person-d', '?sicht=privat&voll=1')).status).toBe(403);
    const d = await holen('person-d');
    expect(Object.keys(json(d.text)).sort()).toEqual(['business', 'ok']);
    expect(d.text).not.toContain('Privat-Score');
    expect((await holen('person-e')).status).toBe(403);
    expect((await holen('person-c')).status).toBe(403);
    const dienst = await holen('person-a', '', { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'person-a' });
    expect(dienst.status).toBe(403);
    expect((await holen('', '', { 'content-type': 'application/json' })).status).toBe(403);
  }, 60_000);

  it('POST: nur eigene Schwellen des eigenen Privat-Scores — „nur Business“ 403, unbekannte Kennzahl 400; der Bestand liegt je Person', async () => {
    const senden = (wer: string, body: unknown) => route.POST(new Request('http://test/api/scores', { method: 'POST', headers: sitzung(wer), body: JSON.stringify(body) }));
    expect((await senden('person-a', { schwelle: { id: 'ps_offen', gruen: 8, rot: 20 } })).status).toBe(200);
    expect((await senden('person-a', { schwelle: { id: 'gibt-es-nicht', gruen: 1, rot: 2 } })).status).toBe(400);
    expect((await senden('person-d', { schwelle: { id: 'ps_offen', gruen: 8, rot: 20 } })).status).toBe(403);
    const db = await import('@/lib/store/local-db');
    expect((await db.loadJson<{ schwellen: Record<string, unknown> }>('privat-score--person-a'))!.schwellen.ps_offen).toEqual({ gruen: 8, rot: 20 });
    expect((await db.loadJson<{ schwellen?: Record<string, unknown> }>('privat-score--person-b'))?.schwellen?.ps_offen).toBeUndefined();
  }, 60_000);
});

describe('ZOE: der Brain-Block — je Sicht nur ihr Score, ohne Einwilligung (b) ohne Gesundheit, nie gemischt', () => {
  it('promptBrain mit Sicht trägt nur den Score dieser Sicht; „nur Business“ nie einen Privat-Score', async () => {
    const { gatherBrain, promptBrain, blockIndex } = await import('@/lib/brain');
    const b = await gatherBrain(heute, 'person-a');
    expect(Object.keys(b.scores).sort()).toEqual(['business', 'privat']);
    // person-a hat (b) nicht erklärt: keine Gesundheits-Säule und keine Gesamtzahl des Privat-Scores an die KI.
    expect(b.scores.privat!.index).toBeNull();
    expect(b.scores.privat!.saeulen.map(s => s.id)).not.toContain('ge');
    expect(blockIndex(b)).toContain('PRIVAT-SCORE');
    expect(blockIndex(b)).toContain('BUSINESS-SCORE');
    expect(promptBrain(b, { sicht: 'business' })).not.toContain('PRIVAT-SCORE');
    expect(promptBrain(b, { sicht: 'privat' })).not.toContain('BUSINESS-SCORE');
    expect(blockIndex(b)).not.toMatch(/PERFORMANCE-INDEX|Wachstums-Score/);
    const d = await gatherBrain(heute, 'person-d');
    expect(d.scores.privat).toBeUndefined();
    expect(blockIndex(d)).not.toContain('PRIVAT-SCORE');
  }, 120_000);
});

describe('Oberfläche: Heute, Finanzen, Fokus, Agenten', () => {
  it('Heute: der Score des Bereichs oben; kein Wachstums-Score-Widget; Business-Index nicht doppelt im Business-Standard', async () => {
    const v = lies('components/os/HeuteView.tsx');
    expect(v).toContain('<BereichScores key={`score-${sicht}`} sicht={sicht} />');
    expect(v.indexOf('<BereichScores')).toBeLessThan(v.indexOf('<Flaeche'));
    const { HEUTE_STANDARD } = await import('@/components/os/HeuteView');
    expect(HEUTE_STANDARD.privat.map(p => p.art)).not.toContain('score');
    expect(HEUTE_STANDARD.business.some(p => p.art === 'index' && p.einstellungen?.saeule === 'business')).toBe(false);
    const { WIDGETS, KATALOG } = await import('@/components/os/flaeche/widgets');
    expect(WIDGETS.score).toBeUndefined();
    expect(KATALOG.some(k => k.art === 'score')).toBe(false);
    // Ein gespeicherter Platz mit der alten Art bricht nichts: die Fläche überspringt unbekannte Arten.
    expect(lies('components/os/flaeche/Flaeche.tsx')).toContain('if (!kind && !def) return null;');
    // Die Karte liest nur die Scores-Route.
    expect(lies('components/os/scores/BereichScores.tsx')).toContain('/api/scores?sicht=${sicht}');
  });
  it('Finanzen › Business › Cockpit: nur die Finanzielle Gesundheit — der ganze Business-Score auf /os/score', () => {
    expect(lies('components/os/FinanzenView.tsx')).toContain('<BusinessCockpit eingebettet teil="finanzen"');
    const c = lies('components/os/business/BusinessCockpit.tsx');
    expect(c).toContain("{teil === 'finanzen' && (");
    expect(c).toContain('<Flaeche seite="score-business">');
    expect(c).not.toContain('Wachstums-Score');
    expect(lies('components/os/scores/ScoreView.tsx')).toContain('<BusinessCockpit key="business" eingebettet teil="index" />');
  });
  it('Fokus › Wirkung und Agenten: keine gemischte Zahl mehr; keine Route liefert den Wachstums-Score', async () => {
    expect(lies('components/os/fokus/Wirkung.tsx')).toContain('useScores(bereich)');
    expect(lies('components/os/AgentenView.tsx')).not.toContain('/api/performance');
    const perf = (await import('@/app/api/performance/route')) as Record<string, unknown>;
    expect(perf.GET).toBeUndefined();
    expect(lies('lib/performance.ts')).not.toContain('computeIndex');
    const { ROUTEN_REGISTER } = await import('@/lib/zugang/routen-register');
    expect(ROUTEN_REGISTER.scores.methoden).toEqual({ GET: 'person', POST: 'person' });
    expect(Object.keys(ROUTEN_REGISTER.performance.methoden)).toEqual(['POST']);
  });
});
