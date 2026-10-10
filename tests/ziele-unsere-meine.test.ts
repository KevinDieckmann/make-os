// ─── Ziele im Privat-Bereich: Unsere · Meine · <Name> (09.10., Kevin) — Wächter „Sicht A bekommt nichts aus B“ ───────────────
// Kevin 09.10.: „Wir müssen im privaten Bereich irgendwie einen Bereich haben, wo wir zusammen unsere Ziele eintragen können — und jeder
// für sich. Das ist unfassbar wichtig. Auch bei der Planung.“ Eigene Ziele (`ziele-eigen--<person>`) lassen sich JE ZIEL teilen
// (`geteilt: true`); eine andere Person sieht dann NUR diese — der Server filtert (lib/planung/eigene-ziele-sicht.ts `nurGeteilte`).
// Geprüft: die reine Regel, die Ziele-Route (ungeteiltes eigenes Ziel kommt nie an — auch nicht im Text der Antwort), Konto „nur
// Business“ und fremder Haushalt bekommen nichts, Schreiben auf fremde Ziele 403, die Kaskade vererbt `geteilt`, `/api/konto/ich` nennt die
// Partner, und die Oberfläche hängt die Spalten ein. Erfundene Personen (person-a Inhaber, person-b Mitglied, person-c anderer Haushalt,
// person-d Konto „nur Business“ im selben Haushalt).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ziele-unsere-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_VAULT_DIR = path.join(ordner, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
process.env.MAKE_OS_KEY = 'pruef-schluessel-ziele-unsere';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

vi.mock('@/lib/kalender/zoe-sicht-server', () => ({
  termineFuerZoe: async () => ({ stand: null, quelle: 'icloud', kemaris: [], kemarisStand: null, einstellungen: {}, termine: [] }),
}));

const UNGETEILT = ['UNGETEILT-B-JAHR', 'UNGETEILT-B-QUARTAL', 'zb-ungeteilt', 'zb-q-ungeteilt', 'GEHEIM-FOKUS-B'];
type H = (r: Request) => Promise<Response>;
const kopf = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const anfrage = (url: string, p: string, method = 'GET', body?: unknown) => new Request(`http://test${url}`, { method, headers: kopf(p), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const lies = (rel: string) => readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
const laufend = Number(new Date().toISOString().slice(0, 4));

let ziele: { GET: H; PATCH: H; PUT: H };
let ich: { GET: H };
let db: typeof import('@/lib/store/local-db');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const k = (id: string, speicher: string, rolle: string, haushalt: string, extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher === 'person-b' ? 'Bea' : speicher === 'person-a' ? 'Ada' : speicher} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt, ...extra });
  await db.saveJson('konten', { konten: [
    k('k1', 'person-a', 'inhaber', 'haus-t'),
    k('k2', 'person-b', 'mitglied', 'haus-t'),
    k('k3', 'person-c', 'mitglied', 'anderes-haus'),
    k('k4', 'person-d', 'mitglied', 'haus-t', { finanzRecht: 'business' }),
  ], einladungen: [] });
  await db.saveJson('ziele', { tag: [], woche: [], monat: [], quartal: [], jahr: [{ id: 'z-wir', titel: 'Gemeinsames Ziel', fortschritt: 10, space: 'privat', rang: 1, jahr: laufend }], fokus: {} });
  await db.saveJson('ziele-eigen--person-b', {
    tag: [], woche: [], monat: [],
    quartal: [{ id: 'zb-q-ungeteilt', titel: 'UNGETEILT-B-QUARTAL', fortschritt: 0, space: 'privat' }],
    jahr: [
      { id: 'zb-geteilt', titel: 'GETEILT-B', fortschritt: 30, space: 'privat', rang: 1, jahr: laufend, geteilt: true },
      { id: 'zb-ungeteilt', titel: 'UNGETEILT-B-JAHR', fortschritt: 50, space: 'privat', rang: 2, jahr: laufend },
    ],
    fokus: { jahr: 'GEHEIM-FOKUS-B' },
  });
  await db.saveJson('meilensteine', { meilensteine: [] });
  await db.saveJson('tasks', { projects: [], listen: [], tasks: [] });
  ziele = (await import('@/app/api/state/ziele/route')) as unknown as typeof ziele;
  ich = (await import('@/app/api/konto/ich/route')) as unknown as typeof ich;
}, 60_000);
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); vi.restoreAllMocks(); });

describe('Regel (rein)', () => {
  it('Sicht je Paar: alles (eigen/ganz geteilt) · geteilte (volle Mitglieder desselben Haushalts) · nichts', async () => {
    const { eigeneZieleSicht, partnerVon } = await import('@/lib/planung/eigene-ziele-sicht');
    const konten = [
      { speicher: 'a', haushalt: 'h' }, { speicher: 'b', haushalt: 'h' }, { speicher: 'c', haushalt: 'x' },
      { speicher: 'd', haushalt: 'h', finanzRecht: 'business' }, { speicher: 'e', haushalt: 'h', teilt: { ziele: ['a'] } }, { speicher: 'f' },
    ];
    expect(eigeneZieleSicht(konten, 'a', 'a')).toBe('alles');
    expect(eigeneZieleSicht(konten, 'e', 'a')).toBe('alles'); // ganz geteilt (Konto › teilt.ziele, 08.10.)
    expect(eigeneZieleSicht(konten, 'b', 'a')).toBe('geteilte');
    expect(eigeneZieleSicht(konten, 'b', 'c')).toBe('nichts'); // anderer Haushalt
    expect(eigeneZieleSicht(konten, 'b', 'd')).toBe('nichts'); // Konto „nur Business“ sieht nie Privates
    expect(eigeneZieleSicht(konten, 'd', 'a')).toBe('nichts'); // … und teilt auch nichts einzeln
    expect(eigeneZieleSicht(konten, 'b', 'f')).toBe('nichts'); // ohne Haushalt
    expect(eigeneZieleSicht(konten, 'b', null)).toBe('nichts'); // Systemlauf
    expect(partnerVon(konten, 'a').sort()).toEqual(['b', 'e']);
    expect(partnerVon(konten, 'd')).toEqual([]);
    expect(partnerVon(konten, 'c')).toEqual([]);
    expect(partnerVon(konten, null)).toEqual([]);
  });

  it('nurGeteilte: nur `geteilt === true`, Fokus nur unter geteilten Schlüsseln, die Liste selbst nie', async () => {
    const { nurGeteilte, hatGeteiltes } = await import('@/lib/planung/eigene-ziele-sicht');
    const d = {
      jahr: [{ id: '1', titel: 'g', geteilt: true }, { id: '2', titel: 'u' }, { id: '3', titel: 'x', geteilt: 'ja' }],
      monat: [{ id: '4', titel: 'u2' }], fokus: { jahr: 'J', monat: 'M' }, fokusGeteilt: ['monat'], fremdesFeld: 'weg',
    };
    const g = nurGeteilte(d) as Record<string, unknown>;
    expect((g.jahr as { id: string }[]).map(z => z.id)).toEqual(['1']);
    expect(g.monat).toEqual([]);
    expect(g.fokus).toEqual({ monat: 'M' });
    expect('fokusGeteilt' in g).toBe(false);
    expect('fremdesFeld' in g).toBe(false);
    expect(hatGeteiltes(d)).toBe(true);
    expect(hatGeteiltes({ jahr: [{ id: '2', titel: 'u' }], fokus: { jahr: 'J' } })).toBe(false);
    expect(hatGeteiltes(null)).toBe(false);
  });

  it('Schreibweg kennt `geteilt` nur als true; die Kaskade vererbt es vom Jahresziel', async () => {
    const { sauberZiel } = await import('@/lib/planung/ziele');
    expect(sauberZiel({ id: 'z', titel: 'T', geteilt: true })?.geteilt).toBe(true);
    expect('geteilt' in (sauberZiel({ id: 'z', titel: 'T', geteilt: 'ja' }) ?? {})).toBe(false);
    expect('geteilt' in (sauberZiel({ id: 'z', titel: 'T', geteilt: false }) ?? {})).toBe(false);
    const { abgeleitetesZiel } = await import('@/lib/planung/kaskade');
    expect(abgeleitetesZiel({ id: 'j', titel: 'J', fortschritt: 0, zielwert: 12, geteilt: true }, 'quartal', laufend).geteilt).toBe(true);
    expect('geteilt' in abgeleitetesZiel({ id: 'j', titel: 'J', fortschritt: 0, zielwert: 12 }, 'quartal', laufend)).toBe(false);
  });
});

describe('Ziele-Route: Sicht A bekommt nichts aus B', () => {
  const ohneUngeteilt = async (r: Response, wo: string) => { const t = await r.text(); for (const g of UNGETEILT) expect(t, `${wo}: ${g}`).not.toContain(g); return t; };

  it('Partner (volles Mitglied) liest NUR das einzeln Geteilte — in jedem Horizont, ohne ungeteilten Fokus', async () => {
    const r = await ziele.GET(anfrage('/api/state/ziele?fuer=person-b', 'person-a'));
    expect(r.status).toBe(200);
    const t = await ohneUngeteilt(r, 'GET fuer=person-b');
    const d = JSON.parse(t) as Record<string, unknown>;
    expect((d.jahr as { id: string }[]).map(z => z.id)).toEqual(['zb-geteilt']);
    expect(d.quartal).toEqual([]);
    expect(d.darfSchreiben).toBe(false);
    expect(d.nurGeteilte).toBe(true);
    expect(d.fokus).toEqual(expect.not.objectContaining({ jahr: expect.anything() }));
  });

  it('die Eigentümerin selbst sieht alles; der gemeinsame Bestand bleibt wie er ist', async () => {
    const r = await ziele.GET(anfrage('/api/state/ziele?fuer=ich', 'person-b'));
    const d = await r.json() as { jahr: { id: string }[]; quartal: unknown[] };
    expect(d.jahr.map(z => z.id).sort()).toEqual(['zb-geteilt', 'zb-ungeteilt']);
    expect(d.quartal).toHaveLength(1);
    const w = await (await ziele.GET(anfrage('/api/state/ziele', 'person-a'))).json() as { jahr: { id: string }[] };
    expect(w.jahr.map(z => z.id)).toEqual(['z-wir']);
  });

  it('Konto „nur Business“, fremder Haushalt und Systemlauf bekommen nichts (403, kein Titel)', async () => {
    for (const wer of ['person-d', 'person-c']) {
      const r = await ziele.GET(anfrage('/api/state/ziele?fuer=person-b', wer));
      expect(r.status, wer).toBe(403);
      const t = await ohneUngeteilt(r, wer);
      expect(t, wer).not.toContain('GETEILT-B');
    }
  });

  it('schreiben auf fremde Ziele bleibt verboten (403) — auch auf geteilte', async () => {
    const p = await ziele.PATCH(anfrage('/api/state/ziele', 'person-a', 'PATCH', { horizont: 'jahr', fuer: 'person-b', ops: [{ op: 'upsert', eintrag: { id: 'zb-geteilt', titel: 'übernommen', fortschritt: 0 } }] }));
    expect(p.status).toBe(403);
    const u = await ziele.PUT(anfrage('/api/state/ziele', 'person-a', 'PUT', { horizont: 'jahr', fuer: 'person-b', fokus: 'x' }));
    expect(u.status).toBe(403);
    const roh = await db.loadJson<{ jahr: { id: string; titel: string }[] }>('ziele-eigen--person-b');
    expect(roh?.jahr.find(z => z.id === 'zb-geteilt')?.titel).toBe('GETEILT-B');
  });

  it('nichts mehr geteilt → 403 wie „nicht geteilt“; teilen über den eigenen Schreibweg (PATCH fuer=ich), Kaskade vererbt', async () => {
    const lesen = () => ziele.GET(anfrage('/api/state/ziele?fuer=person-b', 'person-a'));
    const eigen = async () => (await (await ziele.GET(anfrage('/api/state/ziele?fuer=ich', 'person-b'))).json()) as { jahr: (Record<string, unknown> & { id: string; stand: string })[] };
    const zeile = (await eigen()).jahr.find(z => z.id === 'zb-geteilt')!;
    const { stand, farbe: _f, ...ohne } = zeile;
    let r = await ziele.PATCH(anfrage('/api/state/ziele', 'person-b', 'PATCH', { horizont: 'jahr', fuer: 'ich', ops: [{ op: 'upsert', stand, eintrag: { ...ohne, geteilt: undefined } }] }));
    expect(r.status).toBe(200);
    const nichts = await lesen();
    expect(nichts.status).toBe(403);
    expect((await nichts.json()).geteilt).toBe(false);
    // Ein Zahlenziel teilen: das abgeleitete Quartalsziel kommt mit (Kaskade, derselbe Schreibweg).
    const z2 = (await eigen()).jahr.find(z => z.id === 'zb-ungeteilt')!;
    const { stand: s2, farbe: _f2, ...ohne2 } = z2;
    r = await ziele.PATCH(anfrage('/api/state/ziele', 'person-b', 'PATCH', { horizont: 'jahr', fuer: 'ich', ops: [{ op: 'upsert', stand: s2, eintrag: { ...ohne2, titel: 'JETZT-GETEILT', zielwert: 40, geteilt: true } }] }));
    expect(r.status).toBe(200);
    const d = await (await lesen()).json() as { jahr: { titel: string }[]; quartal: { abgeleitetVon?: string; geteilt?: boolean }[] };
    expect(d.jahr.map(z => z.titel)).toEqual(['JETZT-GETEILT']);
    expect(d.quartal.some(z => z.abgeleitetVon === 'zb-ungeteilt' && z.geteilt === true)).toBe(true);
    expect(JSON.stringify(d)).not.toContain('UNGETEILT-B-QUARTAL');
  });

  it('/api/konto/ich nennt die Partner (volle Mitglieder desselben Haushalts) — nie „nur Business“ oder fremde', async () => {
    const d = await (await ich.GET(anfrage('/api/konto/ich', 'person-a'))).json() as { andere: { speicher: string; partner: boolean }[] };
    const p = Object.fromEntries(d.andere.map(a => [a.speicher, a.partner]));
    expect(p).toEqual({ 'person-b': true, 'person-c': false, 'person-d': false });
  });
});

describe('Oberfläche hängt die Spalten ein', () => {
  it('ZieleMeilensteine: im Privat-Filter die Übersicht statt der Ziele-Karte; Heute Privat trägt die Karte „ziele“', () => {
    const zm = lies('components/os/planung/ZieleMeilensteine.tsx');
    expect(zm).toContain("{spaceFilter !== 'business' && (");
    expect(zm).toContain("ohneUnsere={spaceFilter === 'alle'}");
    expect(zm).toContain("{spaceFilter !== 'privat' && <Karte i={i + 1} akzent={farbe}>");
    const zu = lies('components/os/planung/ZieleUebersicht.tsx');
    for (const s of ['Unsere Ziele', 'Meine Ziele', "usePlanung(horizont, true, 'ich')", 'usePlanung(horizont, true, person.speicher)', 'usePlanPersonen()', '<NordsternKarte eingebettet />']) expect(zu).toContain(s);
    // Namen nur aus den Konten — kein Personenname im Code.
    expect(zu).not.toMatch(/['"](kevin|malin)['"]/i);
    expect(lies('components/os/HeuteView.tsx')).toContain("{ id: 'ziele', art: 'ziele', breite: 4 }");
    expect(lies('components/os/flaeche/widgets.tsx')).toContain('useZieleSpalten(h, laufend)');
  });
});
