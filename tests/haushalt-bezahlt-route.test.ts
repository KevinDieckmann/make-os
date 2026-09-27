// ─── Schreibweg PATCH /api/haushalt: Rechnung „bezahlt“, Umstufung fix ↔ variabel (27.09.) ──
// Malins Rückmeldung: der Knopf „Bezahlt“ tat sichtbar nichts. Hier der ganze Weg über die Route:
// eigener Datenordner, Dienstaufruf mit Schlüssel + Person, Konto mit Test-Haushalt. Erfundene Zahlen.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-hh-bezahlt-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-hh';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
const req = (url: string, body?: unknown, method = 'GET', person = 'kevin') =>
  new Request(`http://test${url}`, { method, headers: kopf(person), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

type Mod = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
type Zeile = Record<string, unknown> & { id: string; stand: number };
type Antwort = { ok: boolean; fehler?: string; zeilen?: Zeile[]; konflikte?: { id: string; grund: string }[] };
let route: Mod;
const patch = async (teil: string, ops: unknown[], person = 'kevin') => {
  const r = await route.PATCH(req('/api/haushalt', { teil, ops }, 'PATCH', person));
  return { status: r.status, d: (await r.json()) as Antwort };
};
const lade = async () => (await (await route.GET(req('/api/haushalt'))).json()) as { belege: Zeile[]; buchungen: Zeile[] };

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test' },
    { id: 'k3', speicher: 'gast', email: 'g@test', name: 'Gast', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] } },
  ], einladungen: [] });
  route = (await import('@/app/api/haushalt/route')) as unknown as Mod;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Rechnung bezahlt — der Schreibweg', () => {
  let rechnung: Zeile;
  it('ohne Haushalt am Konto oder ohne Person: 403, nichts geschrieben', async () => {
    expect((await patch('belege', [{ op: 'upsert', eintrag: { art: 'rechnung', bezeichnung: 'x' } }], 'gast')).status).toBe(403);
    expect((await route.PATCH(new Request('http://test/api/haushalt', { method: 'PATCH', body: '{}' }))).status).toBe(403);
  });
  it('anlegen → offen; bezahlt setzen → erledigt + bezahlt_am, Stand zählt hoch, GET zeigt es', async () => {
    const a = await patch('belege', [{ op: 'upsert', eintrag: { art: 'rechnung', bezeichnung: 'Probe-Rechnung', empfaenger: 'Beispiel GmbH', betrag: 12345, faellig_am: '2026-09-20', einheit: 'privat' } }]);
    expect(a.status).toBe(200); expect(a.d.ok).toBe(true);
    rechnung = a.d.zeilen![0];
    expect(rechnung).toMatchObject({ erledigt: false, bezahlt_am: null, stand: 1 });
    const z = await patch('belege', [{ op: 'upsert', stand: rechnung.stand, eintrag: { ...rechnung, erledigt: true, bezahlt_am: '2026-09-27' } }]);
    expect(z.status).toBe(200);
    expect(z.d.zeilen![0]).toMatchObject({ id: rechnung.id, erledigt: true, bezahlt_am: '2026-09-27', stand: 2 });
    const h = await lade();
    expect(h.belege.find(x => x.id === rechnung.id)).toMatchObject({ erledigt: true, bezahlt_am: '2026-09-27', stand: 2 });
  });
  it('veralteter Stand → 409 mit dem aktuellen Stand der Zeile, nichts überschrieben', async () => {
    const k = await patch('belege', [{ op: 'upsert', stand: 1, eintrag: { ...rechnung, erledigt: false, bezahlt_am: null } }]);
    expect(k.status).toBe(409);
    expect(k.d.konflikte?.[0]).toMatchObject({ id: rechnung.id, grund: 'inzwischen geändert' });
    expect((await lade()).belege.find(x => x.id === rechnung.id)).toMatchObject({ erledigt: true, stand: 2 });
  });
  it('„Doch nicht“: wieder offen, bezahlt_am leer', async () => {
    const z = await patch('belege', [{ op: 'upsert', stand: 2, eintrag: { ...rechnung, erledigt: false, bezahlt_am: null } }]);
    expect(z.status).toBe(200);
    expect(z.d.zeilen![0]).toMatchObject({ erledigt: false, bezahlt_am: null, stand: 3 });
  });
  it('Fehler kommen als JSON mit Text — nie stumm (Einheit unbekannt → 400, unbekannter Teil → 400)', async () => {
    const e = await patch('belege', [{ op: 'upsert', stand: 3, eintrag: { ...rechnung, einheit: 'kemaris' } }]);
    expect(e.status).toBe(400); expect(e.d.ok).toBe(false); expect(e.d.fehler).toMatch(/Einheit/);
    expect((await patch('irgendwas', [{ op: 'upsert', eintrag: {} }])).status).toBe(400);
  });
});

describe('Fixkosten umstufen über den Patch-Weg', () => {
  it('Stammdaten anlegen, Buchung fix → variabel → fix, jeweils mit Stand; Rhythmus geklärt bleibt', async () => {
    expect((await patch('konten', [{ op: 'upsert', eintrag: { name: 'Prüfkonto', einheit: 'privat' } }])).status).toBe(200);
    const konto = (await patch('konten', [{ op: 'upsert', eintrag: { name: 'Zweitkonto', einheit: 'privat' } }])).d.zeilen![0];
    const kat = (await patch('kategorien', [{ op: 'upsert', eintrag: { name: 'Abos & Verträge', typ: 'ausgabe' } }])).d.zeilen![0];
    const a = await patch('buchungen', [{ op: 'upsert', eintrag: { konto_id: konto.id, datum: '2026-08-05', betrag: -1299, empfaenger: 'Streamdienst', beschreibung: 'Streamdienst', kategorie_id: kat.id, ist_fixkosten: true, turnus: 'monatlich', einheit: 'privat' } }]);
    expect(a.status).toBe(200);
    const bu = a.d.zeilen![0];
    expect(bu).toMatchObject({ ist_fixkosten: true, erfasst_von: 'kevin', stand: 1 });
    const v = await patch('buchungen', [{ op: 'upsert', stand: 1, eintrag: { ...bu, ist_fixkosten: false, turnus: 'halbjahr', turnus_geklaert: true } }]);
    expect(v.status).toBe(200);
    expect(v.d.zeilen![0]).toMatchObject({ ist_fixkosten: false, turnus: 'halbjahr', turnus_geklaert: true, stand: 2 });
    const f = await patch('buchungen', [{ op: 'upsert', stand: 2, eintrag: { ...v.d.zeilen![0], ist_fixkosten: true } }]);
    expect(f.d.zeilen![0]).toMatchObject({ ist_fixkosten: true, turnus: 'halbjahr', turnus_geklaert: true, stand: 3 });
    expect((await lade()).buchungen.find(x => x.id === bu.id)).toMatchObject({ ist_fixkosten: true, stand: 3 });
    // Fremdes Konto in der Buchung → 400 mit Text, keine Zeile geändert.
    const falsch = await patch('buchungen', [{ op: 'upsert', stand: 3, eintrag: { ...bu, konto_id: 'gibt-es-nicht' } }]);
    expect(falsch.status).toBe(400); expect(falsch.d.fehler).toMatch(/Konto/);
  });
});
