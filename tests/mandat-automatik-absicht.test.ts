// ─── Mandat-Automatik über das Absichtsprotokoll (30.10., Datenprüfung der Nacht) ─────────────────────────────────────────────────────────
// „Angebot angenommen → Mandat + Liquiplan automatisch“ und sein „Rückgängig“ schreiben nacheinander CRM, Kartei, Liquiplan und `rechnungswesen`.
// Abbruch vor/nach JEDEM Schritt (vorSchritt · vorAbhaken · nachAbhaken) → ein zweiter Aufruf und/oder die Wiederaufnahme bringen alles in den
// Endzustand: genau EIN Mandat, seine Liquiplan-Posten, der Rückgängig-Merker — nichts doppelt. Eigener Datenordner, alles erfunden.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { rmSync } from 'node:fs';

const { ordner } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: path } = await import('node:path');
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'make-os-mandat-absicht-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-mandat-absicht', MAKE_OS_DATEN_SCHLUESSEL: 'pruef-datenschluessel-nur-fuer-den-mandat-absicht-test' });
  return { ordner };
});
import type { Angebot, Chance, CrmBestand } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Planposten } from '@/lib/make-one/liquiditaet';
import * as A from '@/lib/store/absichten';

const J = '2026-09-01T10:00:00.000Z';
const deal = (id: string): Chance => ({ id, titel: 'Sprint Muster', kontaktIds: ['c-anna1'], firmaId: 'f-muster', firma: 'Muster GmbH', art: 'projekt', wert: { betrag: 3000, basis: 'einmalig' }, stufe: 'gewonnen', historie: [{ stufe: 'gewonnen', am: J, von: 'pa' }], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'ja', alternative: 'ja' }, gesellschaft: 'kdv', besitzer: 'pa', geaendert: J } as unknown as Chance);
const angebot = (id: string, dealId: string): Angebot => ({ id, gesellschaft: 'kdv', kontaktId: 'c-anna1', firmaId: 'f-muster', dealId, titel: 'Strategie-Sprint', nummer: `KDV-A-2026-${id.slice(-4)}`, positionen: [{ id: 'p1', titel: 'Sprint', text: 'Analyse', menge: 1, einheit: 'pauschal', einzelpreisCent: 300000, ustSatz: 19, basis: 'einmalig' }], einleitung: '', schluss: '', gueltigBis: '2027-12-31', zahlungszielTage: 21, status: 'angenommen', angenommenAm: '2026-09-02', version: 1, gestelltAm: J, angelegt: J, geaendert: J } as Angebot);

let db: typeof import('@/lib/store/local-db');
let nr = 0;
async function neuerFall() {
  const n = String(++nr).padStart(4, '0');
  const dealId = `d-abs-${n}`;
  const angebotId = `ang-abs-${n}`;
  const { aendereCrm } = await import('@/lib/crm/speicher');
  await aendereCrm(b => ({ ...b, chancen: [...b.chancen, deal(dealId)], angebote: [...(b.angebote ?? []), angebot(angebotId, dealId)] }));
  return { dealId, angebotId };
}
const ladeCrm = async () => (await import('@/lib/crm/speicher')).ladeCrm();
const automatik = async () => import('@/lib/crm/mandat-automatik-server');
const liquiplan = async () => (await db.loadJson<{ posten: Planposten[] }>('liquiplan'))?.posten ?? [];
const merker = async () => (await (await import('@/lib/finanzen/rechnung/kreislauf')).kreislaufLaden()).mandatAuto ?? {};
const offeneAbsichten = async () => (await A.absichtenLaden('ma-haus')).filter(x => x.art === 'mandat-automatik' && A.istOffen(x));
const fortsetzen = async () => (await import('@/lib/store/absichten-fortsetzen')).offeneFertigstellen();

/** Einmal abbrechen: an genau diesem Haken, diesem Schritt. */
function abbrechen(haken: 'vorSchritt' | 'vorAbhaken' | 'nachAbhaken', schritt: string) {
  let einmal = true;
  A.absichtTest[haken] = (art, s) => { if (art === 'mandat-automatik' && s === schritt && einmal) { einmal = false; throw new A.TestAbbruch(s); } };
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const speicher = await import('@/lib/crm/speicher');
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'ma-haus' });
  await db.saveJson('konten', { konten: [konto('k1', 'pa', 'inhaber'), konto('k2', 'pb', 'mitglied')], einladungen: [] });
  const k: Kontakt = { id: 'c-anna1', vorname: 'Anna', nachname: 'Test', email: 'c-anna1@example.invalid', eignung: '', prio: '', stufe: 'gewonnen', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', firmaId: 'f-muster', firma: 'Muster GmbH' } as Kontakt;
  await db.saveJson('kontakte', { kontakte: [k] });
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'interessent', geaendert: J }] } as unknown as CrmBestand);
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', SEED);
  await db.saveJson('liquiplan', { posten: [] });
});
afterEach(() => { A.absichtTest.vorSchritt = null; A.absichtTest.vorAbhaken = null; A.absichtTest.nachAbhaken = null; });
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

/** Endzustand „angelegt“: ein Mandat zum Deal, seine Posten einmal, Merker mit denselben Posten, Firma/Person Kunde, keine offene Absicht. */
async function angelegtPruefen(dealId: string, angebotId: string) {
  const crm = await ladeCrm();
  const mandate = crm.mandate.filter(x => x.chanceId === dealId);
  expect(mandate).toHaveLength(1);
  const m = mandate[0];
  const posten = (await liquiplan()).filter(p => p.mandatId === m.id);
  expect(posten.length).toBe(1);
  expect(new Set(posten.map(p => p.id)).size).toBe(posten.length);
  const mk = (await merker())[m.id];
  expect(mk).toMatchObject({ angebotId });
  expect(mk.zurueckAm).toBeUndefined();
  expect([...mk.posten].sort()).toEqual(posten.map(p => p.id).sort());
  expect(crm.firmen.find(f => f.id === 'f-muster')?.rolle).toBe('kunde');
  const kartei = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
  expect(kartei.find(x => x.id === 'c-anna1')?.lebensphase).toBe('kunde');
  expect(await offeneAbsichten()).toEqual([]);
  // Noch einmal angenommen → nichts (idempotent).
  expect(await (await automatik()).mandatAusAngebotAutomatisch({ angebotId, person: 'pa' })).toBeNull();
  expect((await ladeCrm()).mandate.filter(x => x.chanceId === dealId)).toHaveLength(1);
  return m;
}

describe('Mandat-Automatik · anlegen: Abbruch vor/nach jedem Schritt', () => {
  it('ohne Abbruch: Mandat, Posten, Merker — Absicht abgeschlossen ohne Personendaten', async () => {
    const { dealId, angebotId } = await neuerFall();
    const r = await (await automatik()).mandatAusAngebotAutomatisch({ angebotId, person: 'pa' });
    expect(r).toMatchObject({ angelegt: true, liquiplan: 1 });
    await angelegtPruefen(dealId, angebotId);
    const fertig = (await A.absichtenLaden('ma-haus')).filter(x => x.art === 'mandat-automatik' && x.status === 'fertig').at(-1)!;
    expect(Object.keys(fertig.daten).sort()).toEqual(['angebotId', 'mandatId']);
  }, 60_000);

  for (const haken of ['vorSchritt', 'vorAbhaken', 'nachAbhaken'] as const) {
    for (const schritt of ['mandat', 'kartei', 'liquiplan', 'merker']) {
      it(`${haken} „${schritt}“ → zweiter Aufruf + Wiederaufnahme = derselbe Endzustand, nichts doppelt`, async () => {
        const { dealId, angebotId } = await neuerFall();
        const M = await automatik();
        abbrechen(haken, schritt);
        const erst = await M.mandatAusAngebotAutomatisch({ angebotId, person: 'pa' });
        expect(erst).toMatchObject({ angelegt: false });
        // Ein zweiter „angenommen“-Lauf vor der Wiederaufnahme setzt dieselbe Absicht fort (bzw. findet das Mandat schon vor).
        const zweit = await M.mandatAusAngebotAutomatisch({ angebotId, person: 'pa' });
        expect(zweit === null || zweit.angelegt === true).toBe(true);
        await fortsetzen();
        await angelegtPruefen(dealId, angebotId);
      }, 60_000);
      it(`${haken} „${schritt}“ → nur die Wiederaufnahme bringt alles in den Endzustand`, async () => {
        const { dealId, angebotId } = await neuerFall();
        abbrechen(haken, schritt);
        await (await automatik()).mandatAusAngebotAutomatisch({ angebotId, person: 'pa' });
        expect((await offeneAbsichten()).length).toBe(1);
        await fortsetzen();
        await angelegtPruefen(dealId, angebotId);
      }, 60_000);
    }
  }

  it('Wiederaufnahme verwirft, wenn vor dem ersten Schreiben ein anderes Mandat zum Deal entstand', async () => {
    const { dealId, angebotId } = await neuerFall();
    abbrechen('vorSchritt', 'mandat');
    await (await automatik()).mandatAusAngebotAutomatisch({ angebotId, person: 'pa' });
    const { aendereCrm } = await import('@/lib/crm/speicher');
    const crm0 = await ladeCrm();
    await aendereCrm(b => ({ ...b, mandate: [...b.mandate, { ...crm0.mandate[0], id: 'm-von-hand-1', chanceId: dealId }] }));
    await fortsetzen();
    expect((await ladeCrm()).mandate.filter(x => x.chanceId === dealId).map(x => x.id)).toEqual(['m-von-hand-1']);
    expect(Object.values(await merker()).some(v => v.angebotId === angebotId)).toBe(false);
    expect(await offeneAbsichten()).toEqual([]);
  }, 60_000);
});

describe('Mandat-Automatik · Rückgängig: Abbruch vor/nach jedem Schritt', () => {
  for (const haken of ['vorSchritt', 'vorAbhaken', 'nachAbhaken'] as const) {
    for (const schritt of ['crm', 'liquiplan', 'merker']) {
      it(`${haken} „${schritt}“ → Wiederaufnahme: Mandat weg, Posten weg, Merker „zurück“`, async () => {
        const { dealId, angebotId } = await neuerFall();
        const M = await automatik();
        expect(await M.mandatAusAngebotAutomatisch({ angebotId, person: 'pa' })).toMatchObject({ angelegt: true });
        const m = (await ladeCrm()).mandate.find(x => x.chanceId === dealId)!;
        abbrechen(haken, schritt);
        await expect(M.mandatAutomatikZurueck({ angebotId })).rejects.toThrow();
        await fortsetzen();
        expect((await ladeCrm()).mandate.some(x => x.id === m.id)).toBe(false);
        expect((await liquiplan()).filter(p => p.mandatId === m.id)).toEqual([]);
        expect((await merker())[m.id]?.zurueckAm).toBeTruthy();
        expect(await offeneAbsichten()).toEqual([]);
        // Noch einmal Rückgängig → schon zurück, nichts weiter.
        expect(await M.mandatAutomatikZurueck({ angebotId })).toMatchObject({ ok: true, schonZurueck: true });
      }, 60_000);
    }
  }

  it('ohne Abbruch: zählt die entfernten Posten', async () => {
    const { angebotId } = await neuerFall();
    const M = await automatik();
    await M.mandatAusAngebotAutomatisch({ angebotId, person: 'pa' });
    expect(await M.mandatAutomatikZurueck({ angebotId })).toMatchObject({ ok: true, posten: 1, schonZurueck: false });
  }, 60_000);
});
