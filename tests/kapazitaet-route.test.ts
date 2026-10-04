// ─── Kapazität · Route: Haushalt des Inhabers, Rechte, Privatfilter serverseitig ─
// Eigener Datenordner, erfundene Personen (@example.invalid), erfundene Werte — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-kapa-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-kapa';
process.env.MAKE_OS_OHNE_APPLE = '1';
delete process.env.MAKE_OS_DATENSCHLUESSEL;

type Mod = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
let route: Mod; let db: typeof import('@/lib/store/local-db');

const get = (person?: string) => new Request('http://test/api/kapazitaet', { headers: person ? { 'x-make-user': person } : {} });
const patch = (person: string, ops: unknown) => new Request('http://test/api/kapazitaet', {
  method: 'PATCH', headers: { 'content-type': 'application/json', 'x-make-user': person }, body: JSON.stringify({ ops }),
});
const tag = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  route = (await import('@/app/api/kapazitaet/route')) as unknown as Mod;
  await db.saveJson('konten', { konten: [
    // pa teilt die Gesundheit mit pb → zählt im Team-Faktor; pb teilt nicht → zählt nicht.
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: ['pb'] }, haushalt: 'h-pruef' },
    { id: '2', speicher: 'pb', email: 'pb@example.invalid', name: 'Bert Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: [] }, haushalt: 'h-pruef' },
    { id: '3', speicher: 'px', email: 'px@example.invalid', name: 'Testkunde', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: [] }, haushalt: 'h-fremd' },
  ], einladungen: [] });
  const vitals = (rec: number) => Object.fromEntries([0, 1, 2, 3].map(i => [tag(-i), { rec }]));
  await db.saveJson('vitals--pa', vitals(21));
  // pa hat selbst eingewilligt, dass ihre Erholung zählt (DSGVO-Prüfung 04.10.: Vorgabe aus).
  await db.saveJson('kapazitaet--h-pruef', { personen: { 'konto-pa': { erholungAm: '2026-10-01T10:00:00.000Z' } }, zuweisungen: [] });
  await db.saveJson('vitals--pb', vitals(88));
  await db.saveJson('meilensteine', { meilensteine: [
    { id: 'ms-gross', titel: 'Erfundener großer Schritt', space: 'business', bereich: 'business', faellig: tag(10), fortschritt: 0, erledigt: false, aufwand: 600, personen: ['konto-pa'] },
    { id: 'ms-alt', titel: 'Alter Schritt ohne Aufwand', bereich: 'business', faellig: tag(30), fortschritt: 0, erledigt: false },
    { id: 'ms-privat', titel: 'Privat', space: 'privat', bereich: 'gesundheit', faellig: tag(10), fortschritt: 0, erledigt: false },
  ] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Kapazität — wer darf sehen', () => {
  it('ohne Person und aus einem anderen Haushalt (Testkunde): 403 — nie unsere Daten', async () => {
    expect((await route.GET(get())).status).toBe(403);
    const r = await route.GET(get('px'));
    expect(r.status).toBe(403);
    expect(JSON.stringify(await r.json())).not.toContain('Erfundener');
    expect((await route.PATCH(patch('px', [{ op: 'grundwert', person: 'konto-px', stundenWoche: 10 }]))).status).toBe(403);
  });
  it('Haushalt: Machbarkeit aus den Meilensteinen (nur Business), Personen aus den Konten', async () => {
    const j = await (await route.GET(get('pb'))).json();
    expect(j.ok).toBe(true);
    expect(j.ich).toBe('konto-pb');
    expect(j.inhaber).toBe(false);
    expect(j.stand.personen.map((p: { id: string }) => p.id)).toEqual(['konto-pa', 'konto-pb']);
    const gross = j.stand.posten.find((p: { id: string }) => p.id === 'ms-gross');
    expect(gross.status).toBe('nicht-machbar');
    expect(gross.text).toMatch(/bräuchte \d/);
    expect(j.stand.posten.find((p: { id: string }) => p.id === 'ms-alt').status).toBe('aufwand-fehlt');
    expect(j.stand.posten.some((p: { id: string }) => p.id === 'ms-privat')).toBe(false);
  });
  it('Erholung: nur die eigene als Wert; geteilte zählt im Team-Faktor, nicht geteilte gar nicht', async () => {
    const fuerB = await (await route.GET(get('pb'))).json();
    const a = fuerB.stand.personen.find((p: { id: string }) => p.id === 'konto-pa');
    const b = fuerB.stand.personen.find((p: { id: string }) => p.id === 'konto-pb');
    expect(a).not.toHaveProperty('erholung'); // pb sieht Annas Wert nie
    expect(b).not.toHaveProperty('erholung'); // pb teilt nicht → kein Wert in der Rechnung, auch nicht für sich
    expect(JSON.stringify(fuerB)).not.toContain('"wert":21');
    expect(fuerB.stand.team.kopf).toMatchObject({ faktor: 0.75, personen: 1 });
    const fuerA = await (await route.GET(get('pa'))).json();
    expect(fuerA.stand.personen.find((p: { id: string }) => p.id === 'konto-pa').erholung).toEqual({ wert: 21, faktor: 0.75 });
  });
});

describe('Kapazität — Gesundheit (Art. 9, DSGVO-Prüfung 04.10.)', () => {
  it('der Business-Index bekommt NIE die Erholungs-Ableitung (auch nicht als Team-Faktor) — und keine Kennzahl „Kopf & Energie“', async () => {
    const { kapaKennzahlenFuerIndex } = await import('@/lib/kapazitaet/server');
    const k = await kapaKennzahlenFuerIndex();
    expect(k).not.toBeNull();
    expect(k!.erholung).toBeNull();
    expect(k!.erholungPersonen).toBe(0);
    const { KENNZAHLEN } = await import('@/lib/business/register');
    expect(KENNZAHLEN.some(x => x.id === 'kp_kopf' || /erholung|whoop|recovery|gesundheit/i.test(`${x.label} ${x.formel} ${x.quelle}`))).toBe(false);
  });
  it('teilt eine Person nicht mit JEDEM Konto des Haushalts, zählt ihre Erholung gar nicht — auch nicht im Team-Faktor', async () => {
    const konten = await db.loadJson<{ konten: Record<string, unknown>[] }>('konten');
    // Ein drittes Konto im selben Haushalt — pa teilt nur mit pb, nicht mit pc.
    await db.saveJson('konten', { ...konten, konten: [...konten!.konten, { id: '4', speicher: 'pc', email: 'pc@example.invalid', name: 'Carla Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: [] }, haushalt: 'h-pruef' }] });
    try {
      const fuerC = await (await route.GET(get('pc'))).json();
      expect(fuerC.ok).toBe(true);
      expect(fuerC.stand.team.kopf).toMatchObject({ faktor: 1, personen: 0 });
    } finally {
      await db.saveJson('konten', konten);
    }
  });
});

describe('Kapazität — Einwilligung Erholung (Art. 9 Abs. 2 lit. a, Vorgabe aus)', () => {
  it('nur die Person selbst schaltet sie — auch der Inhaber nicht für andere; ohne Einwilligung zählt geteilte Erholung nicht', async () => {
    expect((await route.PATCH(patch('pa', [{ op: 'erholung', person: 'konto-pb', an: true }]))).status).toBe(403); // Inhaber für pb
    expect((await route.PATCH(patch('pb', [{ op: 'erholung', person: 'konto-pa', an: false }]))).status).toBe(403);
    expect((await route.PATCH(patch('pa', [{ op: 'erholung', person: 'konto-pa', an: 'ja' }]))).status).toBe(400);
    const aus = await route.PATCH(patch('pa', [{ op: 'erholung', person: 'konto-pa', an: false }]));
    expect(aus.status).toBe(200);
    const j = await aus.json();
    expect(j.stand.team.kopf).toMatchObject({ faktor: 1, personen: 0 }); // pa teilt weiter mit pb — zählt trotzdem nicht
    expect(j.stand.personen.find((p: { id: string }) => p.id === 'konto-pa')).not.toHaveProperty('erholung');
    const an = await (await route.PATCH(patch('pa', [{ op: 'erholung', person: 'konto-pa', an: true }]))).json();
    expect(an.stand.team.kopf).toMatchObject({ faktor: 0.75, personen: 1 });
    expect(an.stand.personen.find((p: { id: string }) => p.id === 'konto-pa').erholungAm).toMatch(/^\d{4}-/);
    // Der andere sieht nicht einmal, ob pa eingewilligt hat.
    const fuerB = await (await route.GET(get('pb'))).json();
    expect(fuerB.stand.personen.find((p: { id: string }) => p.id === 'konto-pa')).not.toHaveProperty('erholungAm');
  });
});

describe('Kapazität — wer darf ändern', () => {
  it('eigene Kapa ja, fremde 403, Inhaber für das Team ja; Ausnahme-Titel sieht nur die Person selbst', async () => {
    expect((await route.PATCH(patch('pb', [{ op: 'grundwert', person: 'konto-pa', stundenWoche: 10 }]))).status).toBe(403);
    const eigen = await route.PATCH(patch('pb', [{ op: 'grundwert', person: 'konto-pb', stundenWoche: 20 }, { op: 'ausnahme', person: 'konto-pb', ausnahme: { art: 'urlaub', von: tag(40), bis: tag(44), titel: 'Erfundene Notiz' } }]));
    expect(eigen.status).toBe(200);
    expect((await route.PATCH(patch('pa', [{ op: 'grundwert', person: 'konto-pb', stundenWoche: 24 }]))).status).toBe(200);
    const fuerA = await (await route.GET(get('pa'))).json();
    const b = fuerA.stand.personen.find((p: { id: string }) => p.id === 'konto-pb');
    expect(b).toMatchObject({ grundwert: 24, grundwertQuelle: 'einstellung' });
    expect(b.ausnahmen[0]).not.toHaveProperty('titel');
    const fuerB = await (await route.GET(get('pb'))).json();
    expect(fuerB.stand.personen.find((p: { id: string }) => p.id === 'konto-pb').ausnahmen[0].titel).toBe('Erfundene Notiz');
  });
  it('kaputte Anfragen: 400; unbekannte Person: 404', async () => {
    expect((await route.PATCH(new Request('http://test/api/kapazitaet', { method: 'PATCH', headers: { 'x-make-user': 'pa' }, body: '{kaputt' }))).status).toBe(400);
    expect((await route.PATCH(patch('pa', []))).status).toBe(400);
    expect((await route.PATCH(patch('pa', [{ op: 'grundwert', person: 'konto-px', stundenWoche: 10 }]))).status).toBe(404);
  });
});
