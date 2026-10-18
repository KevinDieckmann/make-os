// Nachprüfung 18.10. (N4/N6/N14) über die echte Route /api/crm/liquiplan: Eintragen = Zahlplan der Rechnungen (Teilmonate anteilig),
// ein alter Posten (sieben volle Zahlungen) weicht ab und wird angeglichen, „beenden“ endet mit dem Mandat (letzter Monat anteilig),
// danach sagt die Lage „beendet“ statt „Status oder Honorar fehlt“. Eigener Datenordner, Dienstaufruf per Schlüssel, erfundene Daten.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { localDay } from '@/lib/zeit';
import type { Mandat } from '@/lib/crm/typen';
import type { Planposten } from '@/lib/make-one/liquiditaet';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-mandat-liquiplan-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-18-10-liquiplan';
delete process.env.MAKE_OS_DATENSCHLUESSEL;

const H = localDay();
const tagPlus = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const kopf = { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'pia' };
const req = (body?: unknown) => new Request('http://test/api/crm/liquiplan', { method: body ? 'POST' : 'GET', headers: kopf, ...(body ? { body: JSON.stringify(body) } : {}) });

type Route = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let route: Route;
let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/crm/speicher');

// Beginn mitten im laufenden Monat (bzw. am 18., wenn heute später ist) — so gibt es immer einen angebrochenen ersten Monat.
const START = H.slice(8, 10) === '01' ? `${H.slice(0, 8)}02` : H;
const mandat = (x: Partial<Mandat> = {}): Mandat => ({
  id: 'm-route-1', kunde: 'Brückenwerk Beispiel GmbH', kontaktIds: [], titel: 'Brückenwerk Beispiel GmbH · Retainer', art: 'retainer', gesellschaft: 'ug', status: 'aktiv',
  vertragUnterschrieben: true, start: START, verlaengerung: 'offen', mindestlaufzeitMonate: 6, honorar: { betrag: 4200, basis: 'monat', netto: true }, ustSatz: 19,
  rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [],
  geaendert: `${H}T08:00:00Z`, ...x,
} as Mandat);
const posten = async () => (await db.loadJson<{ posten: Planposten[] }>('liquiplan'))?.posten ?? [];
const lage = async () => ((await (await route.GET(req())).json()) as { mandate: { id: string; lage: string; grund?: string; letzteZahlung?: string; soll: Planposten[] }[] }).mandate.find(m => m.id === 'm-route-1')!;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'pia', email: 'pia@test.invalid', name: 'Pia Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
  ], einladungen: [] });
  speicher = await import('@/lib/crm/speicher');
  route = (await import('@/app/api/crm/liquiplan/route')) as unknown as Route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Mandat → Liquiditätsplan über die Route', () => {
  it('fehlt → Eintragen: Teilmonat + volle Monate + Teilmonat; die Firma steht nicht doppelt im Titel', async () => {
    await db.saveJson('crm', { ...speicher.leererBestand(), mandate: [mandat()] });
    await db.saveJson('liquiplan', { posten: [{ id: 'lp-miete', titel: 'Miete', betrag: -900, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true }] });
    const vorher = await lage();
    expect(vorher.lage).toBe('fehlt');
    expect(vorher.soll.length).toBeGreaterThanOrEqual(2);
    const r = await route.POST(req({ mandatId: 'm-route-1', aktion: 'anlegen' }));
    expect(r.status).toBe(200);
    const l = await posten();
    expect(l.find(p => p.id === 'lp-miete')).toBeTruthy();
    const vomMandat = l.filter(p => p.id.startsWith('lp-mandat-m-route-1'));
    expect(vomMandat.length).toBe(vorher.soll.length);
    expect(vomMandat.every(p => !p.titel.includes('GmbH · Brückenwerk'))).toBe(true);
    expect((await lage()).lage).toBe('ok');
    // Das Mandat merkt sich den Monatsposten.
    expect((await speicher.ladeCrm()).mandate[0].planpostenId).toBe('lp-mandat-m-route-1');
  });

  it('ein alter Posten (volle Zahlung im ersten Monat) weicht ab und wird angeglichen', async () => {
    await db.saveJson('crm', { ...speicher.leererBestand(), mandate: [mandat({ planpostenId: undefined })] });
    await db.saveJson('liquiplan', { posten: [{ id: 'lp-mandat-m-route-1', titel: 'Alt', betrag: 4998, rhythmus: 'monatlich', ab: tagPlus(START, 14), bis: '2099-01-01', sicher: true, kategorie: 'mandat' }] });
    const a = await lage();
    expect(a.lage).toBe('abweichend');
    await route.POST(req({ mandatId: 'm-route-1', aktion: 'anlegen' }));
    expect((await lage()).lage).toBe('ok');
  });

  it('beendet → „endet“ → Posten beenden → „beendet“ mit dem letzten Zahltag (N14)', async () => {
    const ende = tagPlus(H, 40);
    await db.saveJson('crm', { ...speicher.leererBestand(), mandate: [mandat({ status: 'beendet', ende, planpostenId: 'lp-mandat-m-route-1' })] });
    const vorher = await lage();
    expect(vorher.lage).toBe('endet');
    const r = await route.POST(req({ mandatId: 'm-route-1', aktion: 'beenden' }));
    expect(r.status).toBe(200);
    const n = await lage();
    expect(n.lage).toBe('beendet');
    expect(n.grund).toMatch(/^Mandat beendet — (die letzte Zahlung im Liquiditätsplan war am|letzte Zahlung im Liquiditätsplan am) \d{2}\.\d{2}\.\d{4}\.$/);
    expect(n.letzteZahlung! <= tagPlus(ende, 14)).toBe(true);
    // keine Zahlung mehr nach Ende + Zahlungsziel
    const { zahltage } = await import('@/lib/make-one/liquiditaet');
    const nachEnde = (await posten()).filter(p => p.id.startsWith('lp-mandat-m-route-1')).flatMap(p => zahltage(p, tagPlus(ende, 15), '2030-12-31'));
    expect(nachEnde).toEqual([]);
  });

  it('beendet ohne Posten: „kein Posten“ mit dem richtigen Satz; beenden → 404', async () => {
    await db.saveJson('crm', { ...speicher.leererBestand(), mandate: [mandat({ id: 'm-route-2', status: 'beendet', ende: H })] });
    await db.saveJson('liquiplan', { posten: [] });
    const m = ((await (await route.GET(req())).json()) as { mandate: { id: string; lage: string; grund?: string }[] }).mandate.find(x => x.id === 'm-route-2')!;
    expect(m).toMatchObject({ lage: 'kein-posten', grund: 'Mandat beendet — kein Posten im Liquiditätsplan.' });
    expect((await route.POST(req({ mandatId: 'm-route-2', aktion: 'beenden' }))).status).toBe(404);
  });
});
