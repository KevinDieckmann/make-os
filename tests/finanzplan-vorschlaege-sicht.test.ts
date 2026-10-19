// ─── Finanzplanung · Vorschläge aus dem CRM mit Sicht (19.10., Rundgang A5) ─────────────────────────────────────────────────────────────────
// Fund: Ein Konto „nur Business“ (`finanzRecht: 'business'`) bekam von GET /api/finanzplan/vorschlaege 403 (Klasse finanz-privat, `haushaltVon`), obwohl es
// die Business-Finanzplanung sehen darf — Planen zeigte „Produkt (nicht im Katalog)“, die Produktseite keine Szenarien. Jetzt: Zugang wie /api/finanzplan
// (`planZugangVon`), Sicht aus dem Konto bzw. ?sicht=business. Wächter: „nur Business“ bekommt den Katalog, aber nichts Privates (keine Produkte, Mandate,
// Deals der Selbstständigkeit, keine privaten Bausteine in den Szenarien); der Privat-Bereich bleibt wie bisher. Erfundene Namen und Zahlen.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Leistung, Mandat } from '../lib/crm/typen';
import { neuerBaustein } from '../lib/finanzen/szenarien';
import { planFix, arbeitsplanFix } from './fixtures/finanz-plan';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fp-vorschlaege-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-vorschlaege';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const J = '2026-10-01T10:00:00.000Z';
/** Merkmale der Selbstständigkeit (Privat) — dürfen nie in der Business-Sicht stehen. */
const GEHEIM = ['Geheimberatung', 'Geheimmandat', 'Selbstkunde', 'Geheimbaustein', '6543.21'];

const leistung = (id: string, name: string, gesellschaft: Leistung['gesellschaft'], betrag: number): Leistung => ({
  id, name, typ: 'retainer', stufe: 'kern', preis: { betrag, einheit: 'Monat netto', basis: 'monat' }, laufzeitMonate: 6, lieferumfang: [], gesellschaft, status: 'aktiv',
  angebot: { leistungstext: `${name}: Leistungstext.` }, geaendert: J,
});
const mandat = (id: string, kunde: string, titel: string, gesellschaft: Mandat['gesellschaft'], leistungId: string, betrag: number): Mandat => ({
  id, kunde, kontaktIds: [], titel, art: 'retainer' as Mandat['art'], leistungId, gesellschaft, status: 'aktiv', vertragUnterschrieben: true, start: '2026-10-01', verlaengerung: 'offen',
  honorar: { betrag, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
  health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J,
});

type Antwort = { ok: boolean; produkte: { id: string; name: string }[]; istBasis: { quelleId: string; kunde: string }[]; inSzenarien: Record<string, { id: string }[]>; arbeitsplan: string | null };
let route: { GET: (r: Request) => Promise<Response> };
const holen = async (person: string, url = '/api/finanzplan/vorschlaege') => {
  const r = await route.GET(new Request(`http://test${url}`, { headers: { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person } }));
  return { status: r.status, text: await r.clone().text(), j: (await r.json()) as Antwort };
};

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const speicher = await import('@/lib/crm/speicher');
  const konto = (id: string, sp: string, rolle: string, extra: Record<string, unknown> = {}) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-vorschlaege', ...extra });
  await db.saveJson('konten', { konten: [konto('k1', 'lena', 'inhaber'), konto('k2', 'ben', 'mitglied', { finanzRecht: 'business' }), konto('k3', 'fremd', 'mitglied', { haushalt: undefined })], einladungen: [] });
  await db.saveJson('crm', {
    ...speicher.leererBestand(),
    leistungen: [leistung('l-cockpit', 'Cockpit-Lizenz', 'ug', 1200), leistung('l-ventures', 'Beteiligungs-Check', 'kdv', 900), leistung('l-geheim', 'Geheimberatung', 'kdc', 6543.21)],
    mandate: [mandat('m-nord', 'Nordwerk GmbH', 'Cockpit Nordwerk', 'ug', 'l-cockpit', 1200), mandat('m-geheim', 'Selbstkunde', 'Geheimmandat', 'kdc', 'l-geheim', 6543.21)],
  });
  const ps = arbeitsplanFix();
  ps.bausteine.push(neuerBaustein('bu', { art: 'umsatz', einheit: 'ug', name: 'Cockpit', produkt: 'Cockpit-Lizenz', produktId: 'l-cockpit', preis: 1200, menge: 3, start: 1 }));
  ps.bausteine.push(neuerBaustein('bg', { art: 'umsatz', einheit: 'kdc', name: 'Geheimbaustein', produkt: 'Geheimberatung', produktId: 'l-geheim', preis: 6543.21, menge: 1, start: 1 }));
  const sp = await import('@/lib/finanzen/plan/speicher');
  await sp.importieren('test-vorschlaege', { ...planFix(14000), planszenarien: [ps], arbeitsplan: ps.id }, false, 'lena', 'Test');
  route = (await import('@/app/api/finanzplan/vorschlaege/route')) as unknown as typeof route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('A5 · Vorschläge aus dem CRM: „nur Business“ bekommt den Katalog, nichts Privates', () => {
  it('Konto „nur Business“: 200, Business-Produkte und -Mandate, Szenarien nur mit Business-Bausteinen — auch mit ?sicht=privat', async () => {
    for (const url of ['/api/finanzplan/vorschlaege', '/api/finanzplan/vorschlaege?sicht=privat', '/api/finanzplan/vorschlaege?sicht=business']) {
      const { status, text, j } = await holen('ben', url);
      expect(status, url).toBe(200);
      expect(j.produkte.map(p => p.id).sort(), url).toEqual(['l-cockpit', 'l-ventures']);
      expect(j.istBasis.map(b => b.quelleId), url).toEqual(['m-nord']);
      expect(j.inSzenarien['l-cockpit']?.map(s => s.id), url).toEqual(['ps1']);
      expect(j.inSzenarien['l-geheim'], url).toBeUndefined();
      for (const g of GEHEIM) expect(text.includes(g), `${url}: ${g}`).toBe(false);
    }
  });

  it('Privat-Bereich (volles Mitglied) wie bisher: alles, auch die Selbstständigkeit; der Business-Bereich sieht auch für die Inhaberin nie Privat', async () => {
    const voll = await holen('lena');
    expect(voll.status).toBe(200);
    expect(voll.j.produkte.map(p => p.id).sort()).toEqual(['l-cockpit', 'l-geheim', 'l-ventures']);
    expect(voll.j.istBasis.map(b => b.quelleId).sort()).toEqual(['m-geheim', 'm-nord']);
    expect(voll.j.inSzenarien['l-geheim']?.map(s => s.id)).toEqual(['ps1']);
    expect(voll.j.arbeitsplan).toBe('ps1');
    const business = await holen('lena', '/api/finanzplan/vorschlaege?sicht=business');
    for (const g of GEHEIM) expect(business.text.includes(g), g).toBe(false);
    expect(business.j.produkte.map(p => p.id).sort()).toEqual(['l-cockpit', 'l-ventures']);
  });

  it('ohne Haushalt am Konto weiter 403', async () => {
    expect((await holen('fremd')).status).toBe(403);
  });
});
