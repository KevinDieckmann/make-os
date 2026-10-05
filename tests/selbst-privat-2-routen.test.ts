// ─── Selbstständigkeit unter Privat — Teil 2: Schnittstellen (05.10. abends) ───────────────────────────────────────────────────────
// Entscheidung 3: Privat › Selbstständigkeit bekommt den Monatsabschluss (/api/privat/abschluss, Privatzugang) — alte, im Business-Cockpit
// gespeicherte Einträge wieder sichtbar und bearbeitbar; Business bleibt 400. Entscheidung 2: die Kapazität rechnet die Meilensteine der
// Selbstständigkeit und ihre Fokuszeit unter Privat weiter als Arbeit. Eigener Datenordner, erfundene Personen und Zahlen.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-selbst2-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-selbst2';
process.env.MAKE_OS_OHNE_APPLE = '1';
delete process.env.MAKE_OS_DATENSCHLUESSEL;
delete process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN;

type Route = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let privat: Route, business: Route, kapa: Route;
let db: typeof import('@/lib/store/local-db');

const anfrage = (url: string, person?: string, body?: unknown) => new Request(`http://test${url}`, {
  method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const tag = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  privat = await import('@/app/api/privat/abschluss/route') as Route;
  business = await import('@/app/api/business/route') as Route;
  kapa = await import('@/app/api/kapazitaet/route') as Route;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef' },
    { id: '2', speicher: 'pt', email: 'pt@example.invalid', name: 'Team Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef', finanzRecht: 'business' },
    { id: '3', speicher: 'px', email: 'px@example.invalid', name: 'Testkunde', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-fremd' },
  ], einladungen: [] });
  // Altbestand: der Abschluss der Selbstständigkeit wurde vor dem 05.10. im Business-Cockpit eingetragen.
  await db.saveJson('business-abschluesse', { eintraege: [
    { firma: 'kdc', monat: '2026-08', umsatz: 12000, kosten: 4000, fakturierteTage: 10, von: 'pa', am: '2026-09-02T10:00:00.000Z' },
    { firma: 'kdv', monat: '2026-08', umsatz: 0, kosten: 300, von: 'pa', am: '2026-09-02T10:00:00.000Z' },
  ] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Monatsabschluss der Selbstständigkeit unter Privat (/api/privat/abschluss)', () => {
  it('Privatzugang: der alte Abschluss ist wieder da — nur die Selbstständigkeit, nie KD Ventures', async () => {
    const r = await privat.GET!(anfrage('/api/privat/abschluss', 'pa'));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.firmen).toEqual([{ id: 'kdc', label: 'Selbstständigkeit' }]);
    expect(j.abschluesse.map((a: { firma: string; monat: string; umsatz: number }) => [a.firma, a.monat, a.umsatz])).toEqual([['kdc', '2026-08', 12000]]);
  });
  it('ohne Person, fremder Haushalt (Testkunde) und Konto „nur Business“: 403 — nichts von der Selbstständigkeit', async () => {
    for (const p of [undefined, 'px', 'pt']) {
      const r = await privat.GET!(anfrage('/api/privat/abschluss', p));
      expect(r.status).toBe(403);
      expect(JSON.stringify(await r.json())).not.toContain('12000');
      expect((await privat.POST!(anfrage('/api/privat/abschluss', p, { aktion: 'abschluss', firma: 'kdc', monat: '2026-08', umsatz: 1 }))).status).toBe(403);
    }
  });
  it('bearbeiten und neu eintragen unter Privat; eine Business-Gesellschaft → 400; Business bleibt für die Selbstständigkeit 400', async () => {
    const neu = await privat.POST!(anfrage('/api/privat/abschluss', 'pa', { aktion: 'abschluss', firma: 'kdc', monat: '2026-08', umsatz: 12500, notiz: 'korrigiert' }));
    expect(neu.status).toBe(200);
    expect((await neu.json()).eintrag).toMatchObject({ firma: 'kdc', monat: '2026-08', umsatz: 12500, kosten: 4000, fakturierteTage: 10, notiz: 'korrigiert' });
    expect((await privat.POST!(anfrage('/api/privat/abschluss', 'pa', { aktion: 'abschluss', firma: 'kdc', monat: '2026-09', umsatz: 9000 }))).status).toBe(200);
    const kdv = await privat.POST!(anfrage('/api/privat/abschluss', 'pa', { aktion: 'abschluss', firma: 'kdv', monat: '2026-09', umsatz: 1 }));
    expect(kdv.status).toBe(400);
    expect((await kdv.json()).fehler).toMatch(/Business/);
    expect((await privat.POST!(anfrage('/api/privat/abschluss', 'pa', { aktion: 'abschluss_weg', firma: 'kdv', monat: '2026-08' }))).status).toBe(400);
    // Business-Index: die Selbstständigkeit weiter abgelehnt (selbst-privat), weder schreiben noch löschen.
    const b = await business.POST!(anfrage('/api/business', 'pa', { aktion: 'abschluss', firma: 'kdc', monat: '2026-09', umsatz: 1 }));
    expect(b.status).toBe(400);
    expect((await b.json()).fehler).toMatch(/Privat/);
    expect((await business.POST!(anfrage('/api/business', 'pa', { aktion: 'abschluss_weg', firma: 'kdc', monat: '2026-08' }))).status).toBe(400);
    // EIN Bestand: KD Ventures unberührt, die Selbstständigkeit mit beiden Monaten.
    const alle = (await db.loadJson<{ eintraege: { firma: string; monat: string; umsatz?: number }[] }>('business-abschluesse'))!.eintraege;
    expect(alle.map(a => [a.firma, a.monat, a.umsatz])).toEqual([['kdc', '2026-09', 9000], ['kdc', '2026-08', 12500], ['kdv', '2026-08', 0]]);
    // Löschen unter Privat geht nur für die Selbstständigkeit.
    expect((await privat.POST!(anfrage('/api/privat/abschluss', 'pa', { aktion: 'abschluss_weg', firma: 'kdc', monat: '2026-09' }))).status).toBe(200);
    expect((await db.loadJson<{ eintraege: { firma: string }[] }>('business-abschluesse'))!.eintraege.map(a => a.firma)).toEqual(['kdc', 'kdv']);
  });
  it('der Business-Index liefert die Abschlüsse der Selbstständigkeit weiter nicht aus', async () => {
    const { ladeAbschluesse } = await import('@/lib/business/speicher');
    expect((await ladeAbschluesse()).map(a => a.firma)).toEqual(['kdv']);
    expect((await ladeAbschluesse('privat')).map(a => a.firma)).toEqual(['kdc']);
  });
});

describe('Kapazität rechnet die Selbstständigkeit weiter als Arbeit (Meilensteine + Fokuszeit unter Privat)', () => {
  it('Meilenstein der Selbstständigkeit zählt (mit Ist aus einem Privat-Fokusblock), ein privater nicht', async () => {
    const { meilensteinListeId } = await import('@/lib/planung/meilenstein-aufgaben');
    await db.saveJson('meilensteine', { meilensteine: [
      { id: 'ms-selbst', titel: 'Erfundene Website', space: 'business', bereich: 'business', einheit: 'Selbstständigkeit', faellig: tag(40), fortschritt: 0, erledigt: false, aufwand: 30 },
      { id: 'ms-privat', titel: 'Erfundenes Privates', space: 'privat', bereich: 'gesundheit', faellig: tag(40), fortschritt: 0, erledigt: false },
    ] });
    const T = '2026-09-01T10:00:00.000Z';
    await db.saveJson('tasks', {
      projects: [{ id: 'pm-kdc', title: 'Meilensteine', category: 'business', owner: 'pa', color: '#fff', tags: [], archived: false, spaceId: 'kdc', createdAt: T, updatedAt: T }],
      listen: [{ id: meilensteinListeId('ms-selbst'), projektId: 'pm-kdc', titel: 'Erfundene Website', sortOrder: 1 }],
      tasks: [{ id: 't-web', projectId: 'pm-kdc', listeId: meilensteinListeId('ms-selbst'), spaceId: 'kdc', title: 'Texte', status: 'todo', priority: 'medium', assignee: 'pa', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T, updatedAt: T }],
    });
    // Fokus unter PRIVAT (Selbstständigkeit steht dort) — gestern, 2 Stunden auf die Aufgabe des Meilensteins.
    const von = new Date(Date.now() - 86_400_000); von.setUTCHours(8, 0, 0, 0);
    const bis = new Date(von.getTime() + 2 * 3600_000);
    const t = von.toISOString().slice(0, 10);
    await db.saveJson('zeit--pa', { tage: { [t]: { auto: {}, bewusst: {}, bloecke: [{ von: von.toISOString(), bis: bis.toISOString(), schluessel: 'privat:aufgaben', label: 'Aufgaben', sek: 7200, aufgabeId: 't-web', einheit: 'Selbstständigkeit' }] } } });
    const j = await (await kapa.GET!(anfrage('/api/kapazitaet', 'pa'))).json();
    expect(j.ok).toBe(true);
    const ms = j.stand.posten.find((p: { id: string }) => p.id === 'ms-selbst');
    expect(ms).toBeTruthy();
    expect(ms.istStunden).toBeCloseTo(2, 5);
    expect(j.stand.posten.some((p: { id: string }) => p.id === 'ms-privat')).toBe(false);
  });
});
