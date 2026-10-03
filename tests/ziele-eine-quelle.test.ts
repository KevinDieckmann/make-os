// ─── Ziele: EINE Quelle für Farbe, Space-Regel, Wurzel und Planungsdaten im Browser (Review 03.10., Wächter) ─
// Vorher rechneten Lichtfäden, Ziel-Chip und Ziel-Bezug die Ziel-Farbe je selbst aus verschiedenen Eingabemengen (→ dasselbe
// Ziel in drei Farben), zwei Stellen hatten verschiedene Regeln für „Space ohne Angabe“, und drei Bausteine hielten je einen
// eigenen Zwischenspeicher der Planungsdaten. Dieser Test hält fest:
//   1. Dasselbe Ziel trägt in Lichtfäden (Knoten), Ziel-Chip (Aufgabe → Meilenstein → Ziel) und Ziel-Bezug (Seitenkopf)
//      dieselbe Farbe — die vom Server (GET /api/state/ziele, lib/planung/ziel-farben-server.ts).
//   2. `zielFarben(` wird nur serverseitig an EINER Stelle aufgerufen; kein Client-Baustein rechnet Farben.
//   3. Space ohne Angabe: nur `spaceVonZiel` (modell.ts) — keine zweite Regel in den Ziel-Lesern.
//   4. Planungsdaten im Browser nur über lib/planung/ziele-client.ts (kein eigenes fetch in ui/ und MeilensteinVerweis).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ziele-quelle-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-ziele-quelle';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

vi.mock('@/lib/kalender/zoe-sicht-server', () => ({
  termineFuerZoe: async () => ({ stand: null, quelle: 'icloud', kemaris: [], kemarisStand: null, einstellungen: {}, termine: [] }),
}));

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
function dateien(dir: string, ende = /\.tsx?$/): string[] {
  return readdirSync(path.join(wurzel, dir)).flatMap(n => {
    const rel = `${dir}/${n}`;
    return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel, ende) : ende.test(n) ? [rel] : [];
  });
}

type ZieleAntwort = Record<string, unknown>;
let zieleAntwort: ZieleAntwort;
let lichtKnoten: Map<string, string>;

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const k = (id: string, speicher: string, rolle: string, name: string) => ({ id, speicher, email: `${speicher}@test`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' });
  await db.saveJson('konten', { konten: [k('k1', 'kevin', 'inhaber', 'Kevin'), k('k2', 'malin', 'mitglied', 'Malin')], einladungen: [] });
  // Gemeinsame Ziele: zwei private, ein Business-Ziel ohne Space-Angabe, ein abgeleitetes (angepasst) im Quartal.
  await db.saveJson('ziele', {
    tag: [], woche: [], monat: [],
    quartal: [{ id: 'zp-b~quartal', titel: 'Etappe', fortschritt: 0, space: 'privat', abgeleitetVon: 'zp-b', angepasst: true }],
    jahr: [
      { id: 'zp-b', titel: 'Gesund bleiben', fortschritt: 10, space: 'privat', rang: 2 },
      { id: 'zp-c', titel: 'Haus fertig', fortschritt: 10, space: 'privat', rang: 3 },
      { id: 'zb-ohne', titel: 'Umsatz', fortschritt: 10, rang: 1, termin: '2026-12-15' },
    ],
    fokus: {},
  });
  // Malins eigenes Ziel steht im Rang VOR den gemeinsamen — es verschiebt die Farben. Lichtfäden sahen es, Chip/Bezug nicht.
  await db.saveJson('ziele-eigen--malin', { tag: [], woche: [], monat: [], quartal: [], jahr: [{ id: 'zm-1', titel: 'Eigenes Ziel', fortschritt: 0, space: 'privat', rang: 1 }], fokus: {} });
  await db.saveJson('meilensteine', { meilensteine: [
    { id: 'm-b', titel: 'Check-up', faellig: '2026-11-05', zielId: 'zp-b~quartal', space: 'privat', bereich: 'gesundheit', fortschritt: 0, erledigt: false },
    { id: 'm-c', titel: 'Dach', faellig: '2026-11-06', zielId: 'zp-c', space: 'privat', bereich: 'gesundheit', fortschritt: 0, erledigt: false },
  ] });
  await db.saveJson('tasks', { projects: [], listen: [], tasks: [] });

  const ziele = (await import('@/app/api/state/ziele/route')) as unknown as { GET: (r: Request) => Promise<Response> };
  const rz = await ziele.GET(new Request('http://test/api/state/ziele', { headers: { 'x-make-user': 'kevin' } }));
  expect(rz.status).toBe(200);
  zieleAntwort = await rz.json() as ZieleAntwort;

  const licht = (await import('@/app/api/lichtfaeden/route')) as unknown as { GET: (r: Request) => Promise<Response> };
  lichtKnoten = new Map();
  for (const w of ['thema:privat:gesundheit', 'thema:privat:planung', 'thema:business:planung']) {
    const r = await licht.GET(new Request(`http://test/api/lichtfaeden?wurzel=${w}&person=alle&von=2026-10-01&bis=2027-03-31`, { headers: { 'x-make-user': 'kevin' } }));
    expect(r.status).toBe(200);
    const d = await r.json() as { ansicht: { buendel: { id: string; farbe: string }[] } };
    for (const b of d.ansicht.buendel) if (b.id.startsWith('ziel:')) lichtKnoten.set(b.id.slice(5), b.farbe);
  }
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); vi.restoreAllMocks(); });

describe('1 · dieselbe Farbe überall', () => {
  it('GET /api/state/ziele liefert `farbe` an jeder Zeile — aus ALLEN Zielen des Haushalts (auch Malins eigenen)', async () => {
    const { zieleAusAntwort } = await import('@/lib/planung/ziele-client');
    const { FADEN_FARBEN } = await import('@/lib/make-one/design');
    const l = zieleAusAntwort(zieleAntwort);
    const f = new Map(l.map(z => [z.id, z.farbe]));
    // Privat in Rang-Reihenfolge über den Haushalt: Malins zm-1 (Rang 1) → zp-b → zp-c.
    expect(f.get('zp-b')).toBe(FADEN_FARBEN.privat[1]);
    expect(f.get('zp-c')).toBe(FADEN_FARBEN.privat[2]);
    expect(f.get('zp-b~quartal')).toBe(f.get('zp-b')); // abgeleitet = Farbe des Jahresziels
    expect(f.get('zb-ohne')).toBe(FADEN_FARBEN.business[0]); // ohne Space = Business
  });

  it('Lichtfäden-Knoten, Ziel-Chip und Ziel-Bezug zeigen für jedes Ziel dieselbe Farbe', async () => {
    const { zieleAusAntwort } = await import('@/lib/planung/ziele-client');
    const { bezugNachListe } = await import('@/lib/aufgaben/ziel-bezug');
    const { zielBezug } = await import('@/lib/make-one/ziel-bezug');
    const { meilensteinListeId } = await import('@/lib/planung/meilenstein-aufgaben');
    const ziele = zieleAusAntwort(zieleAntwort);
    const server = new Map(ziele.map(z => [z.id, z.farbe]));
    const ms = [{ id: 'm-b', titel: 'Check-up', zielId: 'zp-b~quartal', bereich: 'gesundheit' as const }, { id: 'm-c', titel: 'Dach', zielId: 'zp-c', bereich: 'gesundheit' as const }];
    // Ziel-Chip (Aufgabe in der Liste des Meilensteins)
    const chips = bezugNachListe(ziele, ms);
    expect(chips.get(meilensteinListeId('m-c'))?.farbe).toBe(server.get('zp-c'));
    expect(chips.get(meilensteinListeId('m-b'))?.farbe).toBe(server.get('zp-b'));
    // Ziel-Bezug (Seitenkopf Gesundheit)
    const bezug = zielBezug('gesundheit', ziele, ms, 5);
    expect(bezug.map(b => b.id)).toEqual(['zp-b', 'zp-c']);
    for (const b of bezug) expect(b.farbe).toBe(server.get(b.id));
    // Lichtfäden (Ziel-Knoten)
    for (const id of ['zp-b', 'zp-c', 'zb-ohne']) expect(lichtKnoten.get(id), id).toBe(server.get(id));
  });
});

describe('2 · die Farbregel läuft nur an EINER Stelle (serverseitig)', () => {
  it('`zielFarben(` wird nur in lib/planung/ziel-farben-server.ts aufgerufen', () => {
    const treffer = [...dateien('lib'), ...dateien('components'), ...dateien('app'), ...dateien('hooks')]
      .filter(f => /\bzielFarben\(/.test(ohneKommentare(lies(f))) && !f.endsWith('lib/lichtfaeden/modell.ts'));
    expect(treffer).toEqual(['lib/planung/ziel-farben-server.ts']);
  });
  it('kein Client-Baustein importiert die Farbregel', () => {
    const client = [...dateien('components'), ...dateien('hooks')].filter(f => /\bzielFarben\b/.test(ohneKommentare(lies(f))));
    expect(client).toEqual([]);
  });
});

describe('3 · Space ohne Angabe: nur spaceVonZiel', () => {
  it('keine zweite Regel („z.space ?? …“, „space === undefined“) in den Ziel-Lesern', () => {
    const leser = [...dateien('lib/lichtfaeden'), 'lib/make-one/ziel-bezug.ts', 'lib/aufgaben/ziel-bezug.ts', 'lib/planung/ziel-farben-server.ts', 'lib/planung/ziele-client.ts'];
    const zweite = leser.filter(f => !f.endsWith('lib/lichtfaeden/modell.ts') && /\b(z|ziel|w)\??\.space\s*(\?\?|[!=]==?\s*undefined)/.test(ohneKommentare(lies(f))));
    expect(zweite).toEqual([]);
    expect(lies('lib/lichtfaeden/modell.ts')).toMatch(/export const spaceVonZiel = \(z: \{ space\?: SpaceId \}\): SpaceId => z\.space \?\? 'business';/);
  });
});

describe('4 · Planungsdaten im Browser: ein Zwischenspeicher', () => {
  it('ui/ und MeilensteinVerweis holen Ziele/Meilensteine nur über lib/planung/ziele-client.ts', () => {
    const bausteine = [...dateien('components/os/ui'), 'components/os/planung/MeilensteinVerweis.tsx'];
    const eigen = bausteine.filter(f => /api\/state\/(ziele|meilensteine)/.test(ohneKommentare(lies(f))));
    expect(eigen).toEqual([]);
    for (const f of ['components/os/ui/ziel.tsx', 'components/os/ui/ziel-bezug.tsx', 'components/os/planung/MeilensteinVerweis.tsx']) expect(lies(f)).toContain("from '@/lib/planung/ziele-client'");
  });
  it('der Ziel-Bezug baut seinen Chip aus dem Baustein `Chip` (kein Handbau)', () => {
    const t = lies('components/os/ui/ziel-bezug.tsx');
    expect(t).toContain('<Chip farbe={e.farbe}>');
    expect(t).not.toMatch(/TIEF\.flaeche|borderRadius: 999/);
  });
  it('kein Durchreiche-Wrapper: lib/aufgaben/ziel-bezug.ts reicht die Farbregel nicht weiter', () => {
    expect(ohneKommentare(lies('lib/aufgaben/ziel-bezug.ts'))).not.toMatch(/zielFarben|farbRegel/);
  });
});

describe('5 · Farbtöne der Lichtfäden (Review 03.10.)', () => {
  it('kein Ziel trägt eine Zustandsfarbe (Gelb = Engstelle, Rot = kritisch); keine Farb-Literale im Modell', async () => {
    const { FADEN_FARBEN, LEUCHT } = await import('@/lib/make-one/design');
    for (const f of [...FADEN_FARBEN.business, ...FADEN_FARBEN.privat]) expect([LEUCHT.achtung, LEUCHT.kritisch]).not.toContain(f);
    expect(ohneKommentare(lies('lib/lichtfaeden/modell.ts'))).not.toMatch(/'#[0-9A-Fa-f]{6}'/);
  });
});
