// ─── Planen im nächsten Jahr — durch die echten Schreibwege (30.09.) ────────
// Kevin: „bis Ende nächsten Jahres planen“. Jahresziele mit `jahr`, Meilensteine
// mit Datum im nächsten Jahr, „Fokus des Jahres“ je Jahr, ZOE verschiebt ins
// nächste Jahr. Geprüft über die Routen (wie im Browser) und das ZOE-Werkzeug.
// Eigener Datenordner, erfundene Einträge.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { localDay } from '@/lib/zeit';
import type { Meilenstein, Ziel, ZieleDatei } from '@/lib/planung/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-naechstes-jahr-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-nj';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Handler = (r: Request) => Promise<Response>;
type Mod = { GET: Handler; PATCH: Handler; PUT: Handler };
let ziele: Mod, meilensteine: Mod;
let db: typeof import('@/lib/store/local-db');
const kopf = { 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-nj', 'x-make-person': 'kevin' };
const J = Number(localDay().slice(0, 4));
const N = J + 1;
const req = (url: string, method = 'GET', body?: unknown) => new Request(`http://test${url}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const ladeZiele = async () => (await (await ziele.GET(req('/api/state/ziele'))).json()) as ZieleDatei & { fokus: Record<string, string> };
const ladeMs = async () => ((await (await meilensteine.GET(req('/api/state/meilensteine'))).json()) as { meilensteine: Meilenstein[] }).meilensteine;

beforeAll(async () => {
  ziele = (await import('@/app/api/state/ziele/route')) as unknown as Mod;
  meilensteine = (await import('@/app/api/state/meilensteine/route')) as unknown as Mod;
  db = await import('@/lib/store/local-db');
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Jahresziele im nächsten Jahr', () => {
  it('Altbestand ohne Jahr wird beim Schreiben gestempelt; ein Zahlenziel fürs nächste Jahr kaskadiert noch nicht', async () => {
    // Altbestand (wie vor dem 30.09. gespeichert): ein Jahresziel ohne `jahr`.
    await db.saveJson('ziele', { tag: [], woche: [], monat: [], quartal: [], jahr: [{ id: 'z-alt', titel: 'Altes Jahresziel', fortschritt: 10, zielwert: 12 }], fokus: {} });
    const r = await ziele.PATCH(req('/api/state/ziele', 'PATCH', { horizont: 'jahr', ops: [
      { op: 'upsert', eintrag: { id: 'z-next', titel: 'Neukunden nächstes Jahr', fortschritt: 0, zielwert: 120, jahr: N, space: 'business' } },
      { op: 'upsert', eintrag: { id: 'z-launch', titel: 'Launch nächstes Jahr', fortschritt: 0, termin: `${N}-03-15`, jahr: N, space: 'business' } },
    ] }));
    expect(r.status).toBe(200);
    const d = await ladeZiele();
    const jahr = new Map(d.jahr.map((z: Ziel) => [z.id, z]));
    expect(jahr.get('z-alt')!.jahr).toBe(J);
    expect(jahr.get('z-next')!.jahr).toBe(N);
    // Nur das Ziel des laufenden Jahres kaskadiert in Quartal/Monat.
    expect(d.quartal.map((q: Ziel) => q.abgeleitetVon)).toEqual(['z-alt']);
    expect(d.monat.map((q: Ziel) => q.abgeleitetVon)).toEqual(['z-alt']);
    // Das Termin-Ziel im nächsten Jahr ist ein Meilenstein im nächsten Jahr geworden.
    const ms = await ladeMs();
    expect(ms.find(m => m.abgeleitetVon === 'z-launch')).toMatchObject({ faellig: `${N}-03-15`, space: 'business' });
  });
});

describe('Meilensteine im nächsten Jahr — über den vorhandenen Schreibweg', () => {
  it('anlegen mit Datum im nächsten Jahr und Ziel-Bezug; verschieben; löschen und zurückholen', async () => {
    const neu = { id: 'ms-n1', titel: 'Messe nächstes Jahr', space: 'business', faellig: `${N}-06-10`, fortschritt: 0, erledigt: false, zielId: 'z-next', einheit: 'KD Ventures' };
    expect((await meilensteine.PATCH(req('/api/state/meilensteine', 'PATCH', { ops: [{ op: 'upsert', eintrag: neu }] }))).status).toBe(200);
    let m = (await ladeMs()).find(x => x.id === 'ms-n1')!;
    expect(m).toMatchObject({ faellig: `${N}-06-10`, zielId: 'z-next', bereich: 'business' });
    // Verschieben (mit Stand, wie das Fenster).
    const stand = (m as Meilenstein & { stand?: string }).stand;
    expect((await meilensteine.PATCH(req('/api/state/meilensteine', 'PATCH', { ops: [{ op: 'upsert', eintrag: { ...m, faellig: `${N}-09-01` }, stand }] }))).status).toBe(200);
    m = (await ladeMs()).find(x => x.id === 'ms-n1')!;
    expect(m.faellig).toBe(`${N}-09-01`);
    // Löschen, dann „Rückgängig“ = ohne Stand wieder anlegen.
    const stand2 = (m as Meilenstein & { stand?: string }).stand;
    expect((await meilensteine.PATCH(req('/api/state/meilensteine', 'PATCH', { ops: [{ op: 'delete', id: 'ms-n1', stand: stand2 }] }))).status).toBe(200);
    expect((await ladeMs()).some(x => x.id === 'ms-n1')).toBe(false);
    const { stand: _s, ...ohne } = m as Meilenstein & { stand?: string };
    expect((await meilensteine.PATCH(req('/api/state/meilensteine', 'PATCH', { ops: [{ op: 'upsert', eintrag: ohne }] }))).status).toBe(200);
    expect((await ladeMs()).find(x => x.id === 'ms-n1')).toMatchObject({ faellig: `${N}-09-01` });
  });
  it('ZOE verschiebt ins nächste Jahr; ein abgeleiteter Meilenstein bleibt dann „angepasst“', async () => {
    const { WERKZEUGE } = await import('@/lib/zoe/werkzeuge');
    expect(await WERKZEUGE.setze_meilenstein.lauf({ titel: 'Launch nächstes', faellig: `${N}-04-20`, fortschritt: 20 }, 'http://test', 'kevin')).toMatch(/verschoben.*20%/);
    const m = (await ladeMs()).find(x => x.abgeleitetVon === 'z-launch')!;
    expect(m).toMatchObject({ faellig: `${N}-04-20`, fortschritt: 20, angepasst: true });
    // Die nächste Kaskade zieht das Datum nicht auf den Termin des Ziels zurück.
    await ziele.PATCH(req('/api/state/ziele', 'PATCH', { horizont: 'jahr', ops: [{ op: 'upsert', eintrag: { id: 'z-weiter', titel: 'Noch ein Ziel', fortschritt: 0 } }] }));
    expect((await ladeMs()).find(x => x.abgeleitetVon === 'z-launch')!.faellig).toBe(`${N}-04-20`);
    expect(await WERKZEUGE.setze_meilenstein.lauf({ titel: 'Messe', faellig: `${N}-02-30` }, 'http://test', 'kevin')).toMatch(/^Fehlgeschlagen/);
  });
});

describe('Fokus des Jahres je Jahr', () => {
  it('das nächste Jahr bekommt einen eigenen Satz; das laufende steht mit und ohne Jahr', async () => {
    expect((await ziele.PUT(req('/api/state/ziele', 'PUT', { horizont: `business:jahr:${N}`, fokus: 'Skalieren' }))).status).toBe(200);
    expect((await ziele.PUT(req('/api/state/ziele', 'PUT', { horizont: `business:jahr:${J}`, fokus: 'Aufbauen' }))).status).toBe(200);
    const roh = (await db.loadJson<ZieleDatei & { fokus: Record<string, string> }>('ziele'))!.fokus;
    expect(roh).toMatchObject({ [`business:jahr:${N}`]: 'Skalieren', [`business:jahr:${J}`]: 'Aufbauen', 'business:jahr': 'Aufbauen' });
    // Alte Leser (ohne Jahr) sehen weiter das laufende Jahr.
    expect((await ladeZiele()).fokus['business:jahr']).toBe('Aufbauen');
    // Der alte Weg ohne Jahr schreibt das laufende Jahr mit.
    await ziele.PUT(req('/api/state/ziele', 'PUT', { horizont: 'business:jahr', fokus: 'Aufbauen 2' }));
    expect((await db.loadJson<{ fokus: Record<string, string> }>('ziele'))!.fokus[`business:jahr:${J}`]).toBe('Aufbauen 2');
    // Unplausible Jahre und kaputte Schlüssel lehnt der Schreibweg ab; „prio:…“ mit „jahr“ im Namen bleibt erlaubt.
    expect((await ziele.PUT(req('/api/state/ziele', 'PUT', { horizont: `jahr:${J + 40}`, fokus: 'x' }))).status).toBe(400);
    expect((await ziele.PUT(req('/api/state/ziele', 'PUT', { horizont: 'prio:jahresabschluss', fokus: 'x' }))).status).toBe(200);
  });
  it('ZOE setzt den Fokus fürs nächste Jahr', async () => {
    const { WERKZEUGE } = await import('@/lib/zoe/werkzeuge');
    expect(await WERKZEUGE.setze_fokus.lauf({ horizont: 'jahr', space: 'privat', jahr: N, text: 'Gesund bleiben' }, 'http://test', 'kevin')).toMatch(/Gilt ab Januar/);
    const roh = (await db.loadJson<{ fokus: Record<string, string> }>('ziele'))!.fokus;
    expect(roh[`privat:jahr:${N}`]).toBe('Gesund bleiben');
    expect(roh['privat:jahr']).toBeUndefined();
  });
});
