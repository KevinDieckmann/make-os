// ─── Kern-Reste 2 (25.10.): „Mandat anlegen & Fall starten“ stößt die Produkt-Läufe an — auch über ein PAKET ────────────────────────────────────────
// Befund: „Fall anlegen“ mit dem Prozess des Produkts stieß die Starts über die Produkt-Bindung schon an (`prozessFallStarten` → `produktLaeufeAnstossen`). Startete
// der Fall dagegen über ein Paket (`fallStartenOderAnhaengen`), lief z. B. der Prozess eines Zusatzmoduls erst mit dem nächsten Takt — in der Demo (ohne Arbeiter)
// nie. Jetzt derselbe Anstoß auf Klick. Geprüft (eigener Datenordner, erfundene Konten @example.invalid, OHNE Takt):
//   · Mandat aus dem gewonnenen Deal über den EINEN Aufbau (Fenster: Start), dann Fall mit Paket → der Prozess des Zusatzmoduls läuft (einmal)
//   · idempotent: zweiter Start 409, ein Takt danach legt nichts doppelt an; ein Prozess-Schritt „Fall starten“ (`fallStartenServer`) stößt nichts an
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProzessDefinition, ProzessEintrag } from '@/lib/prozesse/definition';
import type { Chance, CrmBestand, Leistung, Mandat } from '@/lib/crm/typen';
import { definition, schritt, konto, J } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-kern-anstoss-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-kern-anstoss';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const H = 'haus-ka';
const pz = (n: number) => `pz-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PZ_ZUSATZ = pz(701);

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const eintrag = (id: string, def: ProzessDefinition, status: ProzessEintrag['status']): ProzessEintrag => ({
  id, entwurf: { ...def, id }, status, angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia', versionen: [{ nr: 1, name: 'v1', am: J, von: 'pia', definition: { ...def, id } }],
});
const ablauf = (): ProzessDefinition => definition([
  schritt(10, 'Zusatz vorbereiten', 1),
  schritt(11, 'Fertig', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
], { titel: 'Zusatz liefern', bereich: 'fulfillment', fallArt: 'mandat', laeuftAls: 'pia' });
const produkt = (id: string, x: Partial<Leistung> = {}): Leistung => ({ id, name: `Produkt ${id}`, typ: 'retainer', stufe: 'kern', preis: { betrag: 100, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J, ...x });
const deal = (id: string): Chance => ({
  id, titel: `Deal ${id}`, kontaktIds: ['c-erika'], firmaId: 'f-probe', firma: 'Probe GmbH', art: 'retainer', leistungId: 'p-haupt', wert: { betrag: 1000, basis: 'monat' },
  stufe: 'gewonnen', historie: [], gesellschaft: 'ug', besitzer: 'pia', angelegt: J, geaendert: J,
} as unknown as Chance);

type Json = Record<string, unknown>;
const holen = async (r: Response): Promise<{ status: number; j: Json }> => ({ status: r.status, j: await r.json() as Json });
const lead = async (body: Json) => holen(await (await import('@/app/api/crm/lead/route')).POST(new Request('http://test/api/crm/lead', { method: 'POST', headers: sitzung('pia'), body: JSON.stringify(body) })));
const starten = async (m: string, vorlageId: string, anfrageId: string) => holen(await (await import('@/app/api/fulfillment/fall/route')).POST(new Request('http://test/api/fulfillment/fall?space=business', {
  method: 'POST', headers: sitzung('pia'), body: JSON.stringify({ aktion: 'starten', mandatId: m, vorlageId, start: '2026-11-02', anfrageId }),
})));
const laeufe = async () => (await (await import('@/lib/prozesse/lauf-server')).laeufeLesen(H)).laeufe;
const paket = (id: string) => ({
  id, art: 'paket', titel: `Paket ${id}`, fassung: 1, geaendert: J, geaendertVon: 'pia', uebergaenge: [], freigaben: [], rollen: [],
  knoten: [{ id: `${id}-w`, titel: 'Lieferung', rang: 0 }, { id: `${id}-p`, elternId: `${id}-w`, titel: 'Start', rang: 0 }, { id: `${id}-s`, elternId: `${id}-p`, titel: 'Kick-off', rang: 0 }],
});

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H })], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-erika', vorname: 'Erika', nachname: 'Beispiel', email: 'erika@example.invalid', firmaId: 'f-probe', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', {
    ...leererBestand(), firmen: [{ id: 'f-probe', name: 'Probe GmbH', rolle: 'lead', geaendert: J }],
    // Das Hauptprodukt hat KEINEN Prozess (Paket), das Zusatzmodul schon (im Schatten).
    leistungen: [produkt('p-haupt'), produkt('p-zusatz', { prozessId: PZ_ZUSATZ })],
    chancen: [deal('ch-1')], mandate: [],
  } as unknown as CrmBestand);
  const { prozesseBestand } = await import('@/lib/prozesse/definition');
  await db.saveJson(prozesseBestand(H), { v: 1, prozesse: [eintrag(PZ_ZUSATZ, ablauf(), 'probelauf')] });
  const { laeufeBestand } = await import('@/lib/prozesse/lauf-typen');
  await db.saveJson(laeufeBestand(H), { v: 1, laeufe: [], zurueckgehalten: [], prozesse: {} });
  await db.saveJson(`fulfillment--${H}`, { version: 1, prozesse: [paket('fp-haupt'), paket('fp-zwei')], bausteine: [], rituale: [], zuordnung: { 'p-haupt': { vorlageId: 'fp-haupt' } }, agentZusatz: {}, einstellungen: {}, importLaeufe: [], marken: {} });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('„Mandat anlegen & Fall starten“ mit einem Paket stößt die Produkt-Läufe an', () => {
  let mandatId = '';
  it('Mandat über den einen Aufbau (Start gewählt) — noch kein Lauf; das Zusatzmodul mit eigenem Prozess wird gebucht', async () => {
    const r = await lead({ aktion: 'mandat', chanceId: 'ch-1', start: '2026-11-02' });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    mandatId = String(r.j.mandatId);
    const { aendereCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(b => ({ ...b, mandate: b.mandate.map(m => (m.id === mandatId ? { ...m, zusatz: [{ id: 'mz-probe', leistungId: 'p-zusatz', honorar: { betragCent: 10_000, basis: 'monat' } }] } as Mandat : m)) }), { art: 'person', person: 'pia' });
    expect((await laeufe()).filter(l => l.fall.id === mandatId)).toEqual([]);
  });
  it('Fall mit dem Paket: der Prozess des Zusatzmoduls läuft sofort (einmal, im Schatten, Auslöser Produkt)', async () => {
    const r = await starten(mandatId, 'fp-haupt', 'ka-1');
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect(r.j).toMatchObject({ ok: true, laeufe: 1, fall: { vorlageId: 'fp-haupt' } });
    const l = (await laeufe()).filter(x => x.fall.id === mandatId);
    expect(l.map(x => [x.prozessId, x.modus, x.ausloeser.art])).toEqual([[PZ_ZUSATZ, 'schatten', 'produkt']]);
  });
  it('idempotent: zweiter Start 409, ein Takt danach legt keinen zweiten Lauf an', async () => {
    expect((await starten(mandatId, 'fp-zwei', 'ka-2')).status).toBe(409);
    const S = await import('@/lib/prozesse/lauf-server');
    await S.prozesseImTakt(); await S.prozesseImTakt();
    expect((await laeufe()).filter(x => x.fall.id === mandatId)).toHaveLength(1);
  });
  it('ein Prozess-Schritt „Fall starten“ (`fallStartenServer`) stößt selbst nichts an — dort bleibt es beim Takt', async () => {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(b => ({ ...b, mandate: [...b.mandate, {
      id: 'm-motor', kunde: 'Probe GmbH', firmaId: 'f-probe', kontaktIds: ['c-erika'], titel: 'Motor', art: 'retainer', leistungId: 'p-haupt', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
      start: '2026-10-21', verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
      health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J,
      zusatz: [{ id: 'mz-motor', leistungId: 'p-zusatz', honorar: { betragCent: 10_000, basis: 'monat' } }],
    } as Mandat] }), { art: 'person', person: 'pia' });
    const { fallStartenServer } = await import('@/lib/fulfillment/prozesse/fall-server');
    await fallStartenServer({ mandatId: 'm-motor', vorlageId: 'fp-haupt', person: 'pia' });
    expect((await laeufe()).filter(x => x.fall.id === 'm-motor')).toEqual([]);
  });
});
