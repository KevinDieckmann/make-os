// ─── Eigene Meilensteine an eigenen Zielen (10.10., Kevin: „Ja, eigene Meilensteine“) — Wächter „Sicht A bekommt nichts aus B“ ────────────
// Eigene Meilensteine liegen je Person in `meilensteine-eigen--<person>` (nie im gemeinsamen `meilensteine`), immer Privat. Sichtbar der Person
// selbst; einer anderen Person nur zu den eigenen Zielen, die die Eigentümerin teilt — gefiltert auf dem SERVER an EINER Stelle
// (lib/planung/eigene-ziele-sicht.ts). Geprüft: die reinen Regeln (Säuberung, Bezug, Fortschritt, Sicht), die Route (andere Person ohne Teilen,
// mit Teilen, ganz geteilt, Konto „nur Business“, fremder Haushalt, Dienstweg), Schreibweg (Stand/409, Grenzen 413, Bezug 400, fremd 403), der
// Fortschritt der eigenen Ziele zieht nach, Recht (Register, Konto-Bestände) und die Oberfläche hängt die Liste ein.
// Erfundene Personen: person-a Inhaber, person-b Mitglied, person-c anderer Haushalt, person-d Konto „nur Business“ im selben Haushalt.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-eigene-ms-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_VAULT_DIR = path.join(ordner, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
process.env.MAKE_OS_KEY = 'pruef-schluessel-eigene-ms';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

vi.mock('@/lib/kalender/zoe-sicht-server', () => ({
  termineFuerZoe: async () => ({ stand: null, quelle: 'icloud', kemaris: [], kemarisStand: null, einstellungen: {}, termine: [] }),
}));

const GEHEIM = 'MS-UNGETEILT-GEHEIM';
const OFFEN = 'MS-AM-GETEILTEN-ZIEL';
type H = (r: Request) => Promise<Response>;
const kopf = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const anfrage = (url: string, p: string, method = 'GET', body?: unknown) => new Request(`http://test${url}`, { method, headers: kopf(p), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const dienst = (url: string, person: string | null, method = 'GET', body?: unknown) => new Request(`http://test${url}`, {
  method, headers: { 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-eigene-ms', ...(person ? { 'x-make-person': person } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});
const lies = (rel: string) => readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
const laufend = Number(new Date().toISOString().slice(0, 4));
const URL_MS = '/api/state/meilensteine-eigen';

let route: { GET: H; PATCH: H };
let ziele: { GET: H; PATCH: H };
let db: typeof import('@/lib/store/local-db');
const k = (id: string, speicher: string, rolle: string, haushalt: string | undefined, extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}), ...extra });
const KONTEN = [
  k('k1', 'person-a', 'inhaber', 'haus-t'),
  k('k2', 'person-b', 'mitglied', 'haus-t'),
  k('k3', 'person-c', 'mitglied', 'anderes-haus'),
  k('k4', 'person-d', 'mitglied', 'haus-t', { finanzRecht: 'business' }),
];
const msRoh = async (p: string) => (await db.loadJson<{ meilensteine: { id: string; titel: string; zielId: string }[] }>(`meilensteine-eigen--${p}`))?.meilensteine ?? [];

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: KONTEN, einladungen: [] });
  await db.saveJson('ziele', { tag: [], woche: [], monat: [], quartal: [], jahr: [], fokus: {} });
  await db.saveJson('ziele-eigen--person-b', {
    tag: [], woche: [], monat: [], quartal: [],
    jahr: [
      { id: 'zb-geteilt', titel: 'GETEILT-B', fortschritt: 30, space: 'privat', rang: 1, jahr: laufend, geteilt: true },
      { id: 'zb-ungeteilt', titel: 'UNGETEILT-B', fortschritt: 50, space: 'privat', rang: 2, jahr: laufend },
      { id: 'zb-business', titel: 'BUSINESS-B', fortschritt: 0, space: 'business', rang: 3, jahr: laufend },
    ],
    fokus: {},
  });
  await db.saveJson('ziele-eigen--person-a', { tag: [], woche: [], monat: [], quartal: [], jahr: [{ id: 'za-eigen', titel: 'EIGEN-A', fortschritt: 0, space: 'privat', jahr: laufend }], fokus: {} });
  await db.saveJson('meilensteine', { meilensteine: [] });
  await db.saveJson('tasks', { projects: [], listen: [], tasks: [] });
  route = (await import('@/app/api/state/meilensteine-eigen/route')) as unknown as typeof route;
  ziele = (await import('@/app/api/state/ziele/route')) as unknown as typeof ziele;
}, 60_000);
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); vi.restoreAllMocks(); });

describe('Regeln (rein)', () => {
  it('Säuberung: Kennung, Titel und Ziel Pflicht; Privat ohne Einheit, Mandat, Aufwand, Kette, Kaskade', async () => {
    const { sauberEigenerMeilenstein } = await import('@/lib/planung/eigene-meilensteine');
    const m = sauberEigenerMeilenstein({ id: 'mse-1', titel: 'T', zielId: 'z1', fortschritt: 140, erledigt: true, faellig: '2026-12-01', einheit: 'KD Ventures', mandatId: 'm1', aufwand: 10, personen: ['x'], wartetAuf: ['mse-2'], abgeleitetVon: 'z0', space: 'business', fremd: 'weg' });
    expect(m).toEqual({ id: 'mse-1', titel: 'T', zielId: 'z1', fortschritt: 100, erledigt: true, faellig: '2026-12-01' });
    expect(sauberEigenerMeilenstein({ id: 'mse-1', titel: 'T' })).toBeNull(); // ohne Ziel
    expect(sauberEigenerMeilenstein({ id: 'mse-1', zielId: 'z1' })).toBeNull(); // ohne Titel
    expect(sauberEigenerMeilenstein({ id: 'mit leerzeichen', titel: 'T', zielId: 'z1' })).toBeNull(); // Kennung ungültig
    expect(sauberEigenerMeilenstein({ titel: 'T', zielId: 'z1' })).toBeNull(); // keine Kennung erfinden
    expect(sauberEigenerMeilenstein({ id: 'mse-1', titel: 'T', zielId: 'z1', faellig: 'morgen' })).toEqual({ id: 'mse-1', titel: 'T', zielId: 'z1', fortschritt: 0, erledigt: false });
  });

  it('Bezug: nur ein vorhandenes eigenes Ziel, nie im Business', async () => {
    const { eigenerZielBezugPruefen, eigeneZieleNachId } = await import('@/lib/planung/eigene-meilensteine');
    const { ZIEL_FEHLT, BEREICH_GETRENNT } = await import('@/lib/planung/bezuege');
    const z = eigeneZieleNachId({ jahr: [{ id: 'p', titel: 'P', fortschritt: 0, space: 'privat' }, { id: 'b', titel: 'B', fortschritt: 0, space: 'business' }], monat: [{ id: 'o', titel: 'O', fortschritt: 0 }] });
    expect(eigenerZielBezugPruefen('p', z)).toBeNull();
    expect(eigenerZielBezugPruefen('o', z)).toBeNull(); // ohne Bereich (Altbestand) ist kein Business
    expect(eigenerZielBezugPruefen('b', z)).toBe(BEREICH_GETRENNT);
    expect(eigenerZielBezugPruefen('weg', z)).toBe(ZIEL_FEHLT);
  });

  it('Fortschritt: Mittelwert der Meilensteine (erledigt = 100, archivierte zählen nicht), sonst von Hand; erledigtes Ziel = 100', async () => {
    const { eigenesZielFortschritt, eigeneZieleFortschrittAnwenden } = await import('@/lib/planung/eigene-meilensteine');
    const ms = [
      { id: '1', titel: 'a', zielId: 'z', fortschritt: 0, erledigt: true },
      { id: '2', titel: 'b', zielId: 'z', fortschritt: 20, erledigt: false },
      { id: '3', titel: 'c', zielId: 'z', fortschritt: 0, erledigt: false, archiviertAm: '2026-10-01T10:00:00.000Z' },
      { id: '4', titel: 'd', zielId: 'y', fortschritt: 90, erledigt: false },
    ];
    expect(eigenesZielFortschritt({ id: 'z', fortschritt: 5 }, ms)).toBe(60);
    expect(eigenesZielFortschritt({ id: 'ohne', fortschritt: 35 }, ms)).toBe(35);
    expect(eigenesZielFortschritt({ id: 'z', fortschritt: 5, erledigt: true }, ms)).toBe(100);
    const d = { jahr: [{ id: 'z', titel: 'Z', fortschritt: 5 }, { id: 'ohne', titel: 'O', fortschritt: 35 }, { id: 'y', titel: 'Y', fortschritt: 1, erledigt: true }] };
    const r = eigeneZieleFortschrittAnwenden(d, ms);
    expect(r.geaendert).toBe(1);
    expect(r.datei.jahr!.map(z => z.fortschritt)).toEqual([60, 35, 1]);
    expect(eigeneZieleFortschrittAnwenden(r.datei, ms).geaendert).toBe(0);
  });

  it('Sicht: alles (eigen/ganz geteilt) · geteilte (volle Mitglieder) · nichts (nur Business — auch die eigenen —, fremder Haushalt, ohne Konto, Systemlauf)', async () => {
    const { eigeneMeilensteineSicht, eigeneMeilensteineFuerBetrachter } = await import('@/lib/planung/eigene-ziele-sicht');
    const konten = [
      { speicher: 'a', haushalt: 'h' }, { speicher: 'b', haushalt: 'h' }, { speicher: 'c', haushalt: 'x' },
      { speicher: 'd', haushalt: 'h', finanzRecht: 'business' }, { speicher: 'e', haushalt: 'h', teilt: { ziele: ['a', 'd'] } }, { speicher: 'f' },
    ];
    expect(eigeneMeilensteineSicht(konten, 'a', 'a')).toBe('alles');
    expect(eigeneMeilensteineSicht(konten, 'e', 'a')).toBe('alles');
    expect(eigeneMeilensteineSicht(konten, 'b', 'a')).toBe('geteilte');
    expect(eigeneMeilensteineSicht(konten, 'b', 'c')).toBe('nichts');
    expect(eigeneMeilensteineSicht(konten, 'b', 'd')).toBe('nichts');
    expect(eigeneMeilensteineSicht(konten, 'e', 'd')).toBe('nichts'); // auch ganz geteilt nie an „nur Business“
    expect(eigeneMeilensteineSicht(konten, 'd', 'd')).toBe('nichts'); // eigene Meilensteine sind Privat
    expect(eigeneMeilensteineSicht(konten, 'b', 'f')).toBe('nichts');
    expect(eigeneMeilensteineSicht(konten, 'b', 'unbekannt')).toBe('nichts');
    expect(eigeneMeilensteineSicht(konten, 'b', null)).toBe('nichts');
    const ms = [{ id: '1', zielId: 'g' }, { id: '2', zielId: 'u' }, { id: '3' }];
    const ziele = { jahr: [{ id: 'g', geteilt: true }, { id: 'u' }], monat: [{ id: 'x', geteilt: 'ja' }] };
    expect(eigeneMeilensteineFuerBetrachter(ms, ziele, 'alles').map(m => m.id)).toEqual(['1', '2', '3']);
    expect(eigeneMeilensteineFuerBetrachter(ms, ziele, 'geteilte').map(m => m.id)).toEqual(['1']);
    expect(eigeneMeilensteineFuerBetrachter(ms, ziele, 'nichts')).toEqual([]);
    expect(eigeneMeilensteineFuerBetrachter(ms, null, 'geteilte')).toEqual([]);
  });
});

describe('Route: anlegen, lesen, Sicht X bekommt nichts aus Y', () => {
  it('person-b legt Meilensteine an ihren eigenen Zielen an — der Fortschritt der Ziele zieht nach', async () => {
    const r = await route.PATCH(anfrage(URL_MS, 'person-b', 'PATCH', { ops: [
      { op: 'upsert', eintrag: { id: 'mse-b1', titel: OFFEN, zielId: 'zb-geteilt', fortschritt: 0, erledigt: true } },
      { op: 'upsert', eintrag: { id: 'mse-b2', titel: 'OFFEN-ZWEI', zielId: 'zb-geteilt', fortschritt: 0, erledigt: false, faellig: '2026-11-01' } },
      { op: 'upsert', eintrag: { id: 'mse-b3', titel: GEHEIM, zielId: 'zb-ungeteilt', fortschritt: 0, erledigt: false } },
    ] }));
    expect(r.status, await r.clone().text()).toBe(200);
    const d = await r.json() as { meilensteine: { id: string; stand: string }[]; zieleGeaendert: number };
    expect(d.meilensteine.map(m => m.id).sort()).toEqual(['mse-b1', 'mse-b2', 'mse-b3']);
    expect(d.meilensteine.every(m => typeof m.stand === 'string')).toBe(true);
    expect(d.zieleGeaendert).toBe(2);
    const zb = await db.loadJson<{ jahr: { id: string; fortschritt: number }[] }>('ziele-eigen--person-b');
    expect(Object.fromEntries(zb!.jahr.map(z => [z.id, z.fortschritt]))).toEqual({ 'zb-geteilt': 50, 'zb-ungeteilt': 0, 'zb-business': 0 });
    // Nie im gemeinsamen Bestand.
    expect(JSON.stringify(await db.loadJson('meilensteine'))).not.toContain(OFFEN);
  });

  it('die Eigentümerin liest alle eigenen (ohne fuer, mit fuer=ich und mit ihrem Namen) und darf schreiben', async () => {
    for (const q of ['', '?fuer=ich', '?fuer=person-b']) {
      const d = await (await route.GET(anfrage(`${URL_MS}${q}`, 'person-b'))).json() as { meilensteine: { id: string }[]; darfSchreiben: boolean; fuer: string };
      expect(d.meilensteine.map(m => m.id).sort(), q).toEqual(['mse-b1', 'mse-b2', 'mse-b3']);
      expect(d.darfSchreiben).toBe(true);
      expect(d.fuer).toBe('ich');
    }
  });

  it('volles Mitglied: NUR die Meilensteine geteilter Ziele — der ungeteilte kommt nie an (auch nicht im Text)', async () => {
    const r = await route.GET(anfrage(`${URL_MS}?fuer=person-b`, 'person-a'));
    expect(r.status).toBe(200);
    const t = await r.text();
    expect(t).not.toContain(GEHEIM);
    expect(t).not.toContain('mse-b3');
    expect(t).not.toContain('zb-ungeteilt');
    const d = JSON.parse(t) as { meilensteine: { id: string }[]; darfSchreiben: boolean; nurGeteilte: boolean };
    expect(d.meilensteine.map(m => m.id).sort()).toEqual(['mse-b1', 'mse-b2']);
    expect(d.darfSchreiben).toBe(false);
    expect(d.nurGeteilte).toBe(true);
    // Ohne `fuer` sieht person-a nur ihre eigenen (hier keine).
    expect((await (await route.GET(anfrage(URL_MS, 'person-a'))).json()).meilensteine).toEqual([]);
  });

  it('ganz geteilt (Konto › teilt.ziele): alle Meilensteine der Eigentümerin', async () => {
    await db.saveJson('konten', { konten: KONTEN.map(x => (x.speicher === 'person-b' ? { ...x, teilt: { gesundheit: [], ziele: ['person-a'] } } : x)), einladungen: [] });
    try {
      const d = await (await route.GET(anfrage(`${URL_MS}?fuer=person-b`, 'person-a'))).json() as { meilensteine: { id: string }[] };
      expect(d.meilensteine.map(m => m.id).sort()).toEqual(['mse-b1', 'mse-b2', 'mse-b3']);
    } finally { await db.saveJson('konten', { konten: KONTEN, einladungen: [] }); }
  });

  it('Konto „nur Business“, fremder Haushalt, Dienstweg ohne Person: nichts (403, kein Titel)', async () => {
    for (const [wer, url] of [['person-d', `${URL_MS}?fuer=person-b`], ['person-d', URL_MS], ['person-c', `${URL_MS}?fuer=person-b`], ['person-c', URL_MS]] as const) {
      const r = await route.GET(anfrage(url, wer));
      expect(r.status, `${wer} ${url}`).toBe(403);
      const t = await r.text();
      expect(t, wer).not.toContain(GEHEIM);
      expect(t, wer).not.toContain(OFFEN);
    }
    const ohne = await route.GET(dienst(`${URL_MS}?fuer=person-b`, null));
    expect(ohne.status).toBe(403);
    expect(await ohne.text()).not.toContain(OFFEN);
  });

  it('nichts mehr geteilt → 403 wie „nicht geteilt“, ohne Zähler oder Kennung', async () => {
    const roh = await db.loadJson<{ jahr: Record<string, unknown>[] } & Record<string, unknown>>('ziele-eigen--person-b');
    await db.saveJson('ziele-eigen--person-b', { ...roh, jahr: roh!.jahr.map(z => ({ ...z, geteilt: undefined })) });
    try {
      const r = await route.GET(anfrage(`${URL_MS}?fuer=person-b`, 'person-a'));
      expect(r.status).toBe(403);
      const d = await r.json() as Record<string, unknown>;
      expect(d.geteilt).toBe(false);
      expect(JSON.stringify(d)).not.toMatch(/mse-|MS-|OFFEN/);
    } finally { await db.saveJson('ziele-eigen--person-b', roh); }
  });
});

describe('Schreibweg', () => {
  const bestandB = async () => JSON.stringify(await msRoh('person-b'));

  it('fremd schreiben → 403 (fuer einer anderen Person), ein fremdes Ziel als Bezug → 400; der Bestand der anderen bleibt bit-gleich', async () => {
    const vorher = await bestandB();
    const r1 = await route.PATCH(anfrage(URL_MS, 'person-a', 'PATCH', { fuer: 'person-b', ops: [{ op: 'delete', id: 'mse-b1' }] }));
    expect(r1.status).toBe(403);
    const r2 = await route.PATCH(anfrage(URL_MS, 'person-a', 'PATCH', { ops: [{ op: 'upsert', eintrag: { id: 'mse-b1', titel: 'übernommen', zielId: 'zb-geteilt', fortschritt: 0, erledigt: false } }] }));
    expect(r2.status).toBe(400); // zb-geteilt ist kein Ziel von person-a
    expect(await msRoh('person-a')).toEqual([]);
    expect(await bestandB()).toBe(vorher);
  });

  it('Dienstweg schreibt nie (auch mit Person) — liest aber wie die Person', async () => {
    const vorher = await bestandB();
    const r = await route.PATCH(dienst(URL_MS, 'person-b', 'PATCH', { ops: [{ op: 'delete', id: 'mse-b1' }] }));
    expect(r.status).toBe(403);
    expect(await bestandB()).toBe(vorher);
    expect((await route.PATCH(dienst(URL_MS, null, 'PATCH', { ops: [] }))).status).toBe(403);
    const g = await route.GET(dienst(URL_MS, 'person-b'));
    expect(g.status).toBe(200);
    expect((await g.json()).darfSchreiben).toBe(false);
  });

  it('Konto „nur Business“ schreibt keine (Privat) — 403, nichts angelegt', async () => {
    const r = await route.PATCH(anfrage(URL_MS, 'person-d', 'PATCH', { ops: [{ op: 'upsert', eintrag: { id: 'mse-d1', titel: 'D', zielId: 'zd', fortschritt: 0, erledigt: false } }] }));
    expect(r.status).toBe(403);
    expect(await msRoh('person-d')).toEqual([]);
  });

  it('Bezug: Business-Ziel → 400, unbekanntes Ziel → 400, ungültiger Eintrag → 400 (nie still verworfen)', async () => {
    const vorher = await bestandB();
    for (const eintrag of [
      { id: 'mse-x1', titel: 'X', zielId: 'zb-business', fortschritt: 0, erledigt: false },
      { id: 'mse-x2', titel: 'X', zielId: 'gibt-es-nicht', fortschritt: 0, erledigt: false },
      { id: 'mse-x3', titel: '', zielId: 'zb-geteilt', fortschritt: 0, erledigt: false },
      { id: 'mse-x4', titel: 'X', fortschritt: 0, erledigt: false },
    ]) {
      const r = await route.PATCH(anfrage(URL_MS, 'person-b', 'PATCH', { ops: [{ op: 'upsert', eintrag }] }));
      expect(r.status, eintrag.id).toBe(400);
    }
    // `teil`, der den Titel leert: Ablehnung (400), kein „inzwischen geändert“.
    const t = await route.PATCH(anfrage(URL_MS, 'person-b', 'PATCH', { ops: [{ op: 'teil', id: 'mse-b2', felder: { titel: '' } }] }));
    expect(t.status).toBe(400);
    expect(await bestandB()).toBe(vorher);
  });

  it('veralteter Stand → 409 mit aktuellem Bestand, nichts überschrieben; mit aktuellem Stand geht es', async () => {
    const d = await (await route.GET(anfrage(URL_MS, 'person-b'))).json() as { meilensteine: ({ id: string; stand: string } & Record<string, unknown>)[] };
    const zeile = d.meilensteine.find(m => m.id === 'mse-b2')!;
    const { stand, ...eintrag } = zeile;
    const ok = await route.PATCH(anfrage(URL_MS, 'person-b', 'PATCH', { ops: [{ op: 'upsert', stand, eintrag: { ...eintrag, titel: 'NEU-ZWEI' } }] }));
    expect(ok.status).toBe(200);
    const alt = await route.PATCH(anfrage(URL_MS, 'person-b', 'PATCH', { ops: [{ op: 'upsert', stand, eintrag: { ...eintrag, titel: 'ÜBERSCHRIEBEN' } }] }));
    expect(alt.status).toBe(409);
    const a = await alt.json() as { konflikte: { id: string }[]; meilensteine: { id: string; titel: string }[] };
    expect(a.konflikte.map(x => x.id)).toEqual(['mse-b2']);
    expect(a.meilensteine.find(m => m.id === 'mse-b2')?.titel).toBe('NEU-ZWEI');
  });

  it('Grenzen: zu viele Änderungen → 413, zu viele Meilensteine → 413 (nie gekürzt)', async () => {
    const { EIGENE_MS_OPS_MAX, EIGENE_MS_GRENZE } = await import('@/lib/planung/eigene-meilensteine');
    const viele = Array.from({ length: EIGENE_MS_OPS_MAX + 1 }, (_, i) => ({ op: 'delete', id: `mse-${i}` }));
    expect((await route.PATCH(anfrage(URL_MS, 'person-a', 'PATCH', { ops: viele }))).status).toBe(413);
    await db.saveJson('meilensteine-eigen--person-a', { meilensteine: Array.from({ length: EIGENE_MS_GRENZE }, (_, i) => ({ id: `mse-a${i}`, titel: `A${i}`, zielId: 'za-eigen', fortschritt: 0, erledigt: false })) });
    const r = await route.PATCH(anfrage(URL_MS, 'person-a', 'PATCH', { ops: [{ op: 'upsert', eintrag: { id: 'mse-zuviel', titel: 'Z', zielId: 'za-eigen', fortschritt: 0, erledigt: false } }] }));
    expect(r.status).toBe(413);
    expect(await msRoh('person-a')).toHaveLength(EIGENE_MS_GRENZE);
    await db.saveJson('meilensteine-eigen--person-a', { meilensteine: [] });
  });

  it('Löschen: der Meilenstein fällt weg, der Fortschritt des Ziels zieht nach; ein Ziel mit Meilensteinen nimmt keinen Wert von Hand an', async () => {
    const d = await (await route.GET(anfrage(URL_MS, 'person-b'))).json() as { meilensteine: { id: string; stand: string }[] };
    const b1 = d.meilensteine.find(m => m.id === 'mse-b1')!;
    expect((await route.PATCH(anfrage(URL_MS, 'person-b', 'PATCH', { ops: [{ op: 'delete', id: 'mse-b1', stand: b1.stand }] }))).status).toBe(200);
    const zb = async () => (await db.loadJson<{ jahr: { id: string; fortschritt: number; stand?: string }[] }>('ziele-eigen--person-b'))!.jahr.find(z => z.id === 'zb-geteilt')!;
    expect((await zb()).fortschritt).toBe(0); // nur noch mse-b2 (offen, 0 %)
    // Von Hand 80 % über die Ziele-Route: das Ziel hat Meilensteine → der Server zieht auf den Mittelwert zurück.
    const eigen = await (await ziele.GET(anfrage('/api/state/ziele?fuer=ich', 'person-b'))).json() as { jahr: (Record<string, unknown> & { id: string; stand: string })[] };
    const { stand, farbe: _f, ...ohne } = eigen.jahr.find(z => z.id === 'zb-geteilt')!;
    const p = await ziele.PATCH(anfrage('/api/state/ziele', 'person-b', 'PATCH', { horizont: 'jahr', fuer: 'ich', ops: [{ op: 'upsert', stand, eintrag: { ...ohne, fortschritt: 80 } }] }));
    expect(p.status).toBe(200);
    expect(((await p.json()) as { jahr: { id: string; fortschritt: number }[] }).jahr.find(z => z.id === 'zb-geteilt')?.fortschritt).toBe(0);
    expect((await zb()).fortschritt).toBe(0);
  });
});

describe('Recht und Oberfläche', () => {
  it('Speicher-Register (mit Angaben, Bereich „person“), Konto-Bestände (immer mit Suffix), Routen-Register', async () => {
    const { registerEintrag, bereichVonBestand } = await import('@/lib/crm/speicher-register');
    const e = registerEintrag('meilensteine-eigen--person-b');
    expect(e?.muster).toBe('meilensteine-eigen--*');
    expect(e?.rechtsgrundlage && e.art15 && e.loeschfrist).toBeTruthy();
    expect(bereichVonBestand('meilensteine-eigen--person-b')).toBe('person');
    const { PERSON_BESTAENDE } = await import('@/lib/datenschutz/konto-daten');
    expect(PERSON_BESTAENDE.find(b => b.basis === 'meilensteine-eigen')).toEqual({ basis: 'meilensteine-eigen', nurMitSuffix: true });
    const { eigeneMeilensteineName } = await import('@/lib/planung/eigene-meilensteine');
    expect(eigeneMeilensteineName('kevin')).toBe('meilensteine-eigen--kevin'); // auch das Erstkonto mit Suffix
    const { ROUTEN_REGISTER } = await import('@/lib/zugang/routen-register');
    expect(ROUTEN_REGISTER['state/meilensteine-eigen']?.methoden).toEqual({ GET: 'haushalt', PATCH: 'haushalt' });
  });

  it('„Meine Ziele“ trägt eigene Meilensteine (schreiben), die Spalte der anderen Person nur lesend — keine Namen im Code', () => {
    const zu = lies('components/os/planung/ZieleUebersicht.tsx');
    for (const s of ["useEigeneMeilensteine('ich', true, meine.zieleNeuLaden)", 'useEigeneMeilensteine(person.speicher)', '<EigeneMeilensteineListe', 'eigenesZielFortschritt(z, eigeneMs.ms)']) expect(zu).toContain(s);
    const liste = lies('components/os/planung/EigeneMeilensteineListe.tsx');
    for (const s of ['<ZeileAktionen', 'rueck.melden(', '<HakenZiel', "if (e.key === 'Enter') anlegen();", "from '../ui'"]) expect(liste).toContain(s);
    for (const f of [zu, liste, lies('components/os/planung/useEigeneMeilensteine.ts')]) expect(f).not.toMatch(/['"](kevin|malin)['"]/i);
  });
});
