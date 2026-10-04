// ─── Paket K4 (28.09.) — Route /api/crm/bestand: Stand/409, Löschsperre, Grenze ──
// Eigener Datenordner, Dienstaufruf per Schlüssel — nie der echte Bestand. Alle Daten erfunden.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Firma, Mandat } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-k4-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-28-09-k4';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const kopf = (person = 'kevin') => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
type Route = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
let bestand: Route;
let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/crm/speicher');

const H = '2026-09-28T08:00:00.000Z';
const FIRMA: Firma = { id: 'f-werke', name: 'Beispiel Werke GmbH', rolle: 'kunde', geaendert: H };
const LEER: Firma = { id: 'f-leer', name: 'Leere Hülle GmbH', rolle: 'offen', geaendert: H };
const MANDAT = { id: 'm-werke', kunde: 'Beispiel Werke', firmaId: 'f-werke', kontaktIds: [], titel: 'Retainer', art: 'retainer', gesellschaft: 'offen', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 100, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: {}, leistungen: [], offen: [], geaendert: H } as unknown as Mandat;

const patch = (ops: unknown[], person = 'kevin') => bestand.PATCH(new Request('http://test/api/crm/bestand', { method: 'PATCH', headers: kopf(person), body: JSON.stringify({ ops }) }));
async function lade(): Promise<{ firmen: (Firma & { stand: string })[]; mandate: (Mandat & { stand: string })[] }> {
  const r = await bestand.GET(new Request('http://test/api/crm/bestand', { headers: kopf() }));
  return ((await r.json()) as { stand: { firmen: (Firma & { stand: string })[]; mandate: (Mandat & { stand: string })[] } }).stand;
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  // Regel 5 (28.09. abends): der Dienstweg braucht eine Person im Haushalt des Inhabers — erfundene Konten.
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test.invalid', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
    { id: 'k2', speicher: 'malin', email: 'm@test.invalid', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
  ], einladungen: [] });
  speicher = await import('@/lib/crm/speicher');
  bestand = (await import('@/app/api/crm/bestand/route')) as unknown as Route;
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [FIRMA, LEER], mandate: [MANDAT] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-anna', vorname: 'Anna', nachname: 'Beispiel', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], firmaId: 'f-werke' }] });
  await db.saveJson('finanzplan', { rechnungen: [{ id: 'r-1', firmaId: 'kdc', mandatId: 'm-werke', kunde: 'Beispiel Werke', titel: 'Leistung', betrag: 100, status: 'gestellt' }] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Stand je Eintrag (#35/#42)', () => {
  it('GET liefert jeden Eintrag mit stand', async () => {
    const s = await lade();
    expect(s.firmen.every(f => typeof f.stand === 'string' && f.stand.length > 5)).toBe(true);
    expect(s.mandate[0].stand).toMatch(/\S/);
  });

  it('zwei Schreiber auf dasselbe Feld mit demselben Stand: der zweite bekommt 409 mit dem aktuellen Eintrag', async () => {
    const f = (await lade()).firmen.find(x => x.id === 'f-werke')!;
    const r1 = await patch([{ liste: 'firmen', op: 'teil', id: 'f-werke', felder: { stadt: 'Köln' }, stand: f.stand }], 'kevin');
    expect(r1.status).toBe(200);
    const r2 = await patch([{ liste: 'firmen', op: 'teil', id: 'f-werke', felder: { stadt: 'Bonn' }, stand: f.stand }], 'malin');
    expect(r2.status).toBe(409);
    const k = (await r2.json()) as { ok: boolean; konflikte: { id: string; grund: string; aktuell: Firma & { stand: string } }[] };
    expect(k.ok).toBe(false);
    expect(k.konflikte[0]).toMatchObject({ id: 'f-werke', grund: 'inzwischen geändert', aktuell: { stadt: 'Köln' } });
    expect((await speicher.ladeCrm()).firmen.find(x => x.id === 'f-werke')!.stadt).toBe('Köln');
    // Mit dem Stand aus der 409-Antwort geht es.
    const r3 = await patch([{ liste: 'firmen', op: 'teil', id: 'f-werke', felder: { stadt: 'Bonn' }, stand: k.konflikte[0].aktuell.stand }], 'malin');
    expect(r3.status).toBe(200);
  });

  it('ohne Stand (Altweg) bleibt teil feldweise: verschiedene Felder kommen beide an', async () => {
    expect((await patch([{ liste: 'firmen', op: 'teil', id: 'f-werke', felder: { branche: 'Maschinenbau' } }], 'kevin')).status).toBe(200);
    expect((await patch([{ liste: 'firmen', op: 'teil', id: 'f-werke', felder: { mitarbeiter: '50' } }], 'malin')).status).toBe(200);
    expect((await speicher.ladeCrm()).firmen.find(x => x.id === 'f-werke')).toMatchObject({ branche: 'Maschinenbau', mitarbeiter: '50', stadt: 'Bonn' });
  });

  it('ein ganzer Eintrag über einen bestehenden ohne Stand → 409; mit aktuellem Stand → 200', async () => {
    const m = (await lade()).mandate[0];
    const { stand, ...eintrag } = m;
    const ohne = await patch([{ liste: 'mandate', op: 'upsert', eintrag: { ...eintrag, titel: 'Überschrieben' } }]);
    expect(ohne.status).toBe(409);
    expect((await speicher.ladeCrm()).mandate[0].titel).toBe('Retainer');
    const mitStand = await patch([{ liste: 'mandate', op: 'upsert', eintrag: { ...eintrag, titel: 'Retainer 2027' }, stand }]);
    expect(mitStand.status).toBe(200);
    expect((await speicher.ladeCrm()).mandate[0].titel).toBe('Retainer 2027');
  });
});

describe('Löschsperre (#49)', () => {
  it('Firma mit Person, Mandat und Rechnung → 409 mit Anzahlen, nichts gelöscht', async () => {
    const r = await patch([{ liste: 'firmen', op: 'delete', id: 'f-werke' }]);
    expect(r.status).toBe(409);
    const b = (await r.json()) as { fehler: string; sperren: { anzahl: Record<string, number> }[] };
    expect(b.sperren[0].anzahl).toEqual({ personen: 1, deals: 0, mandate: 1, rechnungen: 1 });
    expect(b.fehler).toContain('1 Person · 1 Mandat · 1 Rechnung');
    expect((await speicher.ladeCrm()).firmen.map(f => f.id)).toContain('f-werke');
  });
  it('Mandat mit Rechnung → 409; leere Firma → gelöscht', async () => {
    expect((await patch([{ liste: 'mandate', op: 'delete', id: 'm-werke' }])).status).toBe(409);
    // Seit 04.10. (lib/crm/ablage.ts): endgültig nur aus dem Papierkorb — erst hinein, dann weg.
    expect((await patch([{ liste: 'firmen', op: 'delete', id: 'f-leer' }])).status).toBe(409);
    expect((await patch([{ liste: 'firmen', op: 'teil', id: 'f-leer', felder: { geloeschtAm: new Date().toISOString() } }])).status).toBe(200);
    expect((await patch([{ liste: 'firmen', op: 'delete', id: 'f-leer' }])).status).toBe(200);
    expect((await speicher.ladeCrm()).firmen.map(f => f.id)).toEqual(['f-werke']);
  });
});

describe('Regel 5 (28.09. abends): Dienstweg ohne Person oder mit fremder Person → 403', () => {
  it('ohne Person und mit einer Person außerhalb des Haushalts des Inhabers wird nichts gelesen', async () => {
    const ohne = { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY! };
    expect((await bestand.GET(new Request('http://test/api/crm/bestand', { headers: ohne }))).status).toBe(403);
    expect((await bestand.GET(new Request('http://test/api/crm/bestand', { headers: { ...ohne, 'x-make-person': 'fremd' } }))).status).toBe(403);
  });
});
