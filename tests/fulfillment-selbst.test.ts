// ─── Fulfillment für die Selbstständigkeit (25.10., Branch `fulfillment-selbst`) ───────────────────────────────────────────────────────────────────────
// Bis zur Übernahme läuft die Lieferung (Homepages, Videos …) über die Privat-Arbeits-Einheit (Instanz-Vorgabe: die Selbstständigkeit, Kennung `kdc`). EINE Regel
// (lib/fulfillment/regeln.ts `istFulfillmentMandat`): Fulfillment gilt für jedes Mandat, dessen Gesellschaft als ARBEIT zählt — der BEREICH bleibt Privat.
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz, kein Modell. Geprüft:
//   · Regel rein: Arbeit ≠ Bereich, Sicht, Kennzeichen, Aufgaben-Ort, Ereignis-Marke, Freigabe der Prozesse
//   · Mandat der Selbstständigkeit → Fall anlegen (Route), Reise (GET Fall), Cockpit, Übersicht mit Kennzeichen, Aufgaben im Space der Einheit unter Privat
//   · Sicht Business bekommt nichts aus der Selbstständigkeit: Konto „nur Business“ (alle Fulfillment-GETs, Schreiben 403, Leistungstreppe, Report) und `?space=business`
//   · Produkt-Ablauf (Schatten) läuft für ein neues Mandat der Selbstständigkeit — ein allgemeiner Business-Prozess hört nicht darauf; Läufe nur mit Privat-Recht
//   · private Ereignisse ohne Arbeits-Marke nie an Prozesse
//   · Business-Index: Fälle der Selbstständigkeit zählen nie (ohne Business-Fall null = der Index bit-gleich)
//   · Rechnung „für <Monat>“ am Mandat der Selbstständigkeit geht wie bisher (Privat › Finanzplanung)
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const o = mkdtempSync(path.join(tmpdir(), 'make-os-ff-selbst-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-ff-selbst', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus' });
  for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'ANTHROPIC_API_KEY', 'MAKE_OS_ADRESSE', 'NEXT_PUBLIC_MAKE_OS_EINHEITEN']) delete process.env[k];
  return o;
});

import type { ProzessDefinition, ProzessEintrag } from '@/lib/prozesse/definition';
import type { LaeufeDatei, ProzessLauf } from '@/lib/prozesse/lauf-typen';
import type { CrmBestand, Leistung, Mandat } from '@/lib/crm/typen';
import { definition, fk, schritt, konto, J } from './fixtures/prozess-bau';

const H = 'haus-fs';
const pz = (n: number) => `pz-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PZ_SELBST = pz(301), PZ_ALLG = pz(302), PZ_SCHARF = pz(303);
const KUNDIN = 'Homepage-Kundin Einzel';

type HR = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
async function rufe(pfad: string, methode: string, kopf: Record<string, string>, body?: unknown, suche = ''): Promise<{ status: number; j: Record<string, unknown>; text: string }> {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, HR>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
  const text = (r.headers.get('content-type') ?? '').includes('json') ? await r.text() : '';
  return { status: r.status, j: text ? JSON.parse(text) as Record<string, unknown> : {}, text };
}

const liefern = (titel: string, extra: Partial<ProzessDefinition> = {}): ProzessDefinition =>
  definition([schritt(10, 'Kick-off vereinbaren', 1, { kundeSichtbar: true }), schritt(11, 'Fertig', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } })],
    { titel, bereich: 'fulfillment', fallArt: 'mandat', laeuftAls: 'pia', ...extra });
const eintrag = (id: string, def: ProzessDefinition, status: ProzessEintrag['status']): ProzessEintrag => ({
  id, entwurf: { ...def, id }, status, angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia',
  versionen: [{ nr: 1, name: 'v1', am: J, von: 'pia', definition: { ...def, id } }],
});
const scharf = () => ({ einstellung: { scharf: { am: J, von: 'pia', version: 1, budgetCent: 0, schaetzungCent: 0, bestehende: 'nur-neue' as const, bestehendeAnzahl: 0 } }, verlauf: [] });
const produkt = (id: string, gesellschaft: string, x: Partial<Leistung> = {}): Leistung =>
  ({ id, name: `Produkt ${id}`, typ: 'retainer', stufe: 'kern', preis: { betrag: 100, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft, status: 'aktiv', geaendert: J, ...x } as Leistung);
const mandat = (id: string, gesellschaft: string, leistungId: string, x: Partial<Mandat> = {}): Mandat => ({
  id, kunde: `Probe ${id} GmbH`, firmaId: 'f-1', kontaktIds: ['c-probe'], titel: `Mandat ${id}`, art: 'retainer', leistungId, gesellschaft, status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-06-01', verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
  health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
} as Mandat);

let db: typeof import('@/lib/store/local-db');
let S: typeof import('@/lib/prozesse/lauf-server');
const laeufe = async (): Promise<LaeufeDatei> => S.laeufeLesen(H);
const laeufeVon = async (prozessId: string): Promise<ProzessLauf[]> => (await laeufe()).laeufe.filter(l => l.prozessId === prozessId);
async function mandateAnlegen(...neu: Mandat[]): Promise<void> {
  const { aendereCrm } = await import('@/lib/crm/speicher');
  await aendereCrm(b => ({ ...b, mandate: [...b.mandate, ...neu] }), { art: 'person', person: 'pia' });
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H }),
    konto('k3', 'bea', 'mitglied', { haushalt: H, finanzRecht: 'business' }),
  ], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-probe', vorname: 'Testa', nachname: 'Probe', email: 'testa@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', {
    ...leererBestand(),
    firmen: [{ id: 'f-1', name: 'Beispiel GmbH', rolle: 'kunde', geaendert: J }, { id: 'f-2', name: 'Homepage Kundin Firma', rolle: 'kunde', geaendert: J }],
    leistungen: [produkt('l-biz', 'ug', { name: 'Business-Paket' }), produkt('l-selbst', 'kdc', { name: 'Homepage', prozessId: PZ_SELBST, ebene: 1 }), produkt('l-video', 'kdc', { name: 'Video', prozessId: PZ_SCHARF })],
    mandate: [mandat('m-biz', 'ug', 'l-biz'), mandat('m-selbst', 'kdc', 'l-biz', { kunde: KUNDIN, firmaId: 'f-2' })],
  } satisfies CrmBestand);
  // Ein Produkt-Prozess der Selbstständigkeit (Probelauf → Schatten) und ein allgemeiner Business-Prozess, der auf „Mandat angelegt“ hört (scharf).
  const allg = liefern('Allgemeiner Onboarding-Prozess');
  allg.knoten = allg.knoten.map(k => (k.id === fk(3) ? { ...k, ausloeser: { art: 'ereignis' as const, ereignis: 'mandat-angelegt' as const }, katalog: { id: 'ausloeser.ereignis' } } : k));
  const { prozesseBestand } = await import('@/lib/prozesse/definition');
  await db.saveJson(prozesseBestand(H), { v: 1, prozesse: [eintrag(PZ_SELBST, liefern('Homepage liefern'), 'probelauf'), eintrag(PZ_ALLG, allg, 'aktiv'), eintrag(PZ_SCHARF, liefern('Video liefern'), 'aktiv')] });
  const { laeufeBestand } = await import('@/lib/prozesse/lauf-typen');
  await db.saveJson(laeufeBestand(H), { v: 1, laeufe: [], zurueckgehalten: [], prozesse: { [PZ_ALLG]: scharf(), [PZ_SCHARF]: scharf() } });
  await db.saveJson(`fulfillment--${H}`, { version: 1, prozesse: [{
    id: 'fp-paket', art: 'paket', titel: 'Paket liefern', fassung: 1, geaendert: J, geaendertVon: 'pia', uebergaenge: [], freigaben: [], rollen: [],
    knoten: [{ id: 'fk-w', titel: 'Paket liefern', rang: 0 }, { id: 'fk-p', elternId: 'fk-w', titel: 'Start', rang: 0 }, { id: 'fk-s', elternId: 'fk-p', titel: 'Kick-off', rang: 0, form: 'schritt' }],
  }], bausteine: [], rituale: [], zuordnung: { 'l-biz': { vorlageId: 'fp-paket' } }, agentZusatz: {}, einstellungen: {}, importLaeufe: [], marken: {} });
  await db.saveJson(`gesellschaften--${H}`, { gesellschaften: [{ id: 'kdc', firmierung: 'Probe Einzelunternehmen', strasse: 'Probeweg 2', plz: '12345', ort: 'Musterstadt' }] });
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', SEED);
  S = await import('@/lib/prozesse/lauf-server');
  // Erster Takt: der Motor merkt sich den Stand der Ereignisse (nie die Vergangenheit nachholen).
  await S.prozesseImTakt();
}, 60_000);
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Regel: Arbeit ≠ Bereich (rein)', () => {
  it('Fulfillment für Business und die Privat-Arbeits-Einheit; der Bereich bleibt Privat; Sicht, Kennzeichen, Aufgaben-Ort', async () => {
    const r = await import('@/lib/fulfillment/regeln');
    const { finanzOrtName } = await import('@/lib/einheiten');
    expect(['ug', 'kdv', 'offen', '', 'g-00000000-0000-4000-8000-000000000001', 'kdc'].map(g => r.istFulfillmentMandat(g))).toEqual([true, true, true, true, true, true]);
    expect(r.istBusinessMandat('kdc')).toBe(false);
    expect(r.istPrivatArbeitsMandat('kdc')).toBe(true);
    expect(r.istPrivatArbeitsMandat('ug')).toBe(false);
    expect(r.mandatInSicht('kdc', false)).toBe(false);
    expect(r.mandatInSicht('kdc', true)).toBe(true);
    expect(r.mandatInSicht('ug', false)).toBe(true);
    expect(r.fulfillmentBereich('kdc')).toBe('privat');
    expect(r.bereichsKennzeichen('kdc')).toEqual({ bereich: 'privat', einheit: finanzOrtName('kdc') });
    expect(r.bereichsKennzeichen('ug')).toBeNull();
    expect(r.fallAufgabeSpace({ gesellschaft: 'kdc', firmaId: 'f-2' })).toEqual({ space: 'privat', spaceId: 'kdc' });
    expect(r.fallAufgabeSpace({ gesellschaft: 'ug', firmaId: 'f-1' })).toEqual({ space: 'business', spaceId: 'm-f-1' });
    expect(r.fallAufgabeSpace({ gesellschaft: 'kdv' })).toEqual({ space: 'business', spaceId: 'kdv' });
    expect(r.fallAufgabeSpace({ gesellschaft: 'offen' })).toEqual({ space: 'business' });
  });
  it('Ereignisse: nur Mandate/Fälle der Privat-Arbeits-Einheit tragen die Arbeits-Marke; Prozesse hören nur mit Freigabe darauf', async () => {
    const { mandatEreignisBereich } = await import('@/lib/ereignisse/quellen');
    expect(mandatEreignisBereich('kdc')).toEqual({ bereich: 'privat', arbeit: true });
    expect(mandatEreignisBereich('ug')).toEqual({ bereich: 'business' });
    const { eingabeSauber } = await import('@/lib/ereignisse/typen');
    const ja = () => true;
    expect(eingabeSauber({ id: 'x:1', art: 'mandat-angelegt', quelle: 'crm', bereich: 'privat', arbeit: true, bezug: {} }, ja)).toMatchObject({ bereich: 'privat', arbeit: true });
    // Arbeit nur an Privatem — an einem Business-Ereignis fällt die Marke weg.
    expect(eingabeSauber({ id: 'x:2', art: 'mandat-angelegt', quelle: 'crm', bereich: 'business', arbeit: true, bezug: {} }, ja)).not.toHaveProperty('arbeit');
    const { ausloeserPasst, ereignisArbeitPasst } = await import('@/lib/prozesse/ausloeser');
    const a = { art: 'ereignis' as const, ereignis: 'mandat-angelegt' as const };
    const e = (x: { bereich: 'privat' | 'business'; arbeit?: true }) => ({ art: 'mandat-angelegt' as const, bezug: {}, ...x });
    expect(ausloeserPasst(a, PZ_ALLG, e({ bereich: 'business' }), {})).toBe(true);
    expect(ausloeserPasst(a, PZ_ALLG, e({ bereich: 'privat' }), {}, true)).toBe(false);
    expect(ausloeserPasst(a, PZ_ALLG, e({ bereich: 'privat', arbeit: true }), {})).toBe(false);
    expect(ausloeserPasst(a, PZ_ALLG, e({ bereich: 'privat', arbeit: true }), {}, true)).toBe(true);
    expect(ereignisArbeitPasst({ bereich: 'privat' }, true)).toBe(false);
    const { arbeitErlaubtFuer } = await import('@/lib/prozesse/produkt-bindung');
    const crm = { mandate: [mandat('m-x', 'kdc', 'l-selbst')], leistungen: [produkt('l-selbst', 'kdc', { prozessId: PZ_SELBST })] };
    expect(arbeitErlaubtFuer(PZ_SELBST, 'm-x', crm, false)).toBe(true);
    expect(arbeitErlaubtFuer(PZ_ALLG, 'm-x', crm, false)).toBe(false);
    expect(arbeitErlaubtFuer(PZ_ALLG, 'm-x', crm, true)).toBe(true);
    expect(arbeitErlaubtFuer(PZ_ALLG, 'm-fehlt', crm, true)).toBe(false);
  });
});

describe('Ein Mandat der Selbstständigkeit bekommt Fulfillment', () => {
  it('Fall anlegen, Reise, Cockpit und Übersicht — mit Bereichs-Kennzeichen', async () => {
    const s = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-selbst', vorlageId: 'fp-paket', anfrageId: 'ff-selbst-start-1' });
    expect(s.status, s.text).toBe(200);
    const f = await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-selbst');
    expect(f.status).toBe(200);
    expect(f.j.mandat).toMatchObject({ id: 'm-selbst', business: true, bereich: 'privat' });
    expect((f.j.fall as { knoten: unknown[] }).knoten.length).toBeGreaterThan(0);
    const c = await rufe('fulfillment/cockpit', 'GET', sitzung('pia'));
    const zeile = (c.j.zeilen as { mandatId: string; bereich?: string; einheit?: string }[]).find(z => z.mandatId === 'm-selbst');
    expect(zeile).toMatchObject({ bereich: 'privat' });
    expect(zeile?.einheit).toBeTruthy();
    const ue = await rufe('fulfillment', 'GET', sitzung('pia'));
    expect((ue.j.faelle as Record<string, { bereich?: string }>)['m-selbst']).toMatchObject({ bereich: 'privat' });
    expect((ue.j.mandate as Record<string, { bereich?: string }>)['m-selbst']).toMatchObject({ bereich: 'privat' });
    // Der Kunden-Link nimmt das Mandat (der Kunde sieht nur seinen Fall).
    const { fulfillmentMandat } = await import('@/lib/fulfillment/kunde/server');
    expect(fulfillmentMandat(await (await import('@/lib/crm/speicher')).ladeCrm(), 'm-selbst')?.id).toBe('m-selbst');
  }, 60_000);

  it('Business-Index: Fälle der Selbstständigkeit zählen nie — ohne Business-Fall null (Index bit-gleich), mit Business-Fall nur dieser', async () => {
    const { ffKennzahlenFuerIndex } = await import('@/lib/fulfillment/prozesse/server');
    expect(await ffKennzahlenFuerIndex()).toBeNull();
    const s = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-biz', vorlageId: 'fp-paket', anfrageId: 'ff-selbst-start-2' });
    expect(s.status, s.text).toBe(200);
    const k = await ffKennzahlenFuerIndex();
    expect(k?.zeilen).toHaveLength(1);
    expect(JSON.stringify(k)).not.toContain(KUNDIN);
  }, 60_000);

  it('Leistungstreppe: die volle Person sieht den Fortschritt (gekennzeichnet), ein Konto „nur Business“ nicht', async () => {
    const { treppeLage } = await import('@/lib/crm/treppe-server');
    const pia = await treppeLage('pia');
    expect(pia.kunden.find(z => z.mandatId === 'm-selbst')).toMatchObject({ bereich: 'privat' });
    expect((await treppeLage('pia', undefined, { nurBusiness: true })).kunden.map(z => z.mandatId)).not.toContain('m-selbst');
    expect((await treppeLage('bea')).kunden.map(z => z.mandatId)).toEqual(['m-biz']);
    // Eine Produkt-Karte der Selbstständigkeit bekommt ihre Stufe (die Treppe führt ihre Mandate); das Business-Paket des Head of Sales nimmt sie nicht.
    expect(pia.katalog.stufen.some(s => s.leistungIds.includes('l-selbst'))).toBe(true);
    const { treppeFuerHead } = await import('@/lib/crm/treppe-server');
    expect(JSON.stringify(await treppeFuerHead())).not.toContain('Homepage');
  });

  it('Rechnung „für <Monat>“ am Mandat der Selbstständigkeit geht wie bisher (Privat › Finanzplanung): Entwurf der Einheit', async () => {
    const { entwurfNeu } = await import('@/lib/finanzen/rechnung/server');
    const r = await entwurfNeu({ person: 'pia', haushalt: H, sicht: 'privat', wer: { art: 'person', person: 'pia' }, quelle: 'mandat', mandatId: 'm-selbst', monat: '2026-10' });
    expect(r.rechnung).toMatchObject({ firmaId: 'kdc', mandatId: 'm-selbst' });
  });
});

describe('Sicht Business bekommt nichts aus der Selbstständigkeit', () => {
  it('Konto „nur Business“: kein Fall, kein Mandat, keine Kundin — in jeder Fulfillment-Antwort', async () => {
    const bea = sitzung('bea');
    for (const [pfad, suche] of [['fulfillment', ''], ['fulfillment', '?nur=kurz'], ['fulfillment/cockpit', ''], ['fulfillment/dossier', '?alle=1']] as const) {
      const r = await rufe(pfad, 'GET', bea, undefined, suche);
      expect(r.status, `${pfad}${suche}`).toBe(200);
      expect(r.text, `${pfad}${suche}`).not.toMatch(new RegExp(`m-selbst|${KUNDIN}|Homepage Kundin Firma`));
    }
    // Der Business-Fall bleibt sichtbar (kein Rundum-Sperren).
    expect(Object.keys((await rufe('fulfillment', 'GET', bea)).j.faelle as object)).toEqual(['m-biz']);
    for (const [pfad, suche] of [['fulfillment/fall', '?m=m-selbst'], ['fulfillment/kunde', '?m=m-selbst'], ['fulfillment/kunde/vorschau', '?m=m-selbst'], ['fulfillment/wirkung', '?m=m-selbst&vorschau=1'],
      ['fulfillment/dossier', '?m=m-selbst'], ['fulfillment/analyse', '?m=m-selbst']] as const) {
      const r = await rufe(pfad, 'GET', bea, undefined, suche);
      expect(r.status, `${pfad}${suche}`).toBe(404);
      expect(r.text).not.toContain(KUNDIN);
    }
  }, 60_000);

  it('Konto „nur Business“ schreibt nie an einem Fall der Selbstständigkeit (403, nichts geschrieben)', async () => {
    const bea = sitzung('bea');
    const vorher = JSON.stringify((await (await import('@/lib/fulfillment/speicher')).fulfillmentLesen('faelle', H)).faelle['m-selbst']);
    expect((await rufe('fulfillment/fall', 'POST', bea, { aktion: 'nachziehen', mandatId: 'm-selbst' })).status).toBe(403);
    expect((await rufe('fulfillment/fall', 'PATCH', bea, { mandatId: 'm-selbst', ops: [{ op: 'fall-status', status: 'pausiert' }] })).status).toBe(403);
    expect((await rufe('fulfillment/kunde', 'POST', bea, { aktion: 'link-anlegen', mandatId: 'm-selbst' })).status).toBe(403);
    expect((await rufe('fulfillment/wirkung', 'POST', bea, { aktion: 'erstellen', mandatId: 'm-selbst' })).status).toBe(403);
    expect((await rufe('fulfillment/dossier', 'POST', bea, { aktion: 'anlegen', mandatId: 'm-selbst' })).status).toBe(403);
    expect((await rufe('crm/treppe/report', 'POST', bea, { aktion: 'entwurf', mandatId: 'm-selbst' })).status).toBe(403);
    expect(JSON.stringify((await (await import('@/lib/fulfillment/speicher')).fulfillmentLesen('faelle', H)).faelle['m-selbst'])).toBe(vorher);
  }, 60_000);

  it('die ausdrückliche Business-Sicht (`?space=business`) lässt die Selbstständigkeit auch für die volle Person weg', async () => {
    const pia = sitzung('pia');
    const ue = await rufe('fulfillment', 'GET', pia, undefined, '?space=business');
    expect(Object.keys(ue.j.faelle as object)).toEqual(['m-biz']);
    expect((await rufe('fulfillment/cockpit', 'GET', pia, undefined, '?space=business')).text).not.toContain('m-selbst');
    expect((await rufe('fulfillment/fall', 'GET', pia, undefined, '?m=m-selbst&space=business')).status).toBe(404);
    // Ohne Angabe (die Fulfillment-Oberfläche) sieht sie beide.
    expect(Object.keys((await rufe('fulfillment', 'GET', pia)).j.faelle as object).sort()).toEqual(['m-biz', 'm-selbst']);
  }, 60_000);
});

describe('Produkt-Ablauf der Selbstständigkeit im Lauf-Motor', () => {
  it('ein neues Mandat startet den Prozess seines Produkts (Schatten); ein allgemeiner Business-Prozess hört nicht darauf', async () => {
    await mandateAnlegen(mandat('m-selbst-neu', 'kdc', 'l-selbst', { kunde: KUNDIN, firmaId: 'f-2', start: '2026-10-20' }), mandat('m-biz-neu', 'ug', 'l-biz', { start: '2026-10-20' }),
      mandat('m-video', 'kdc', 'l-video', { kunde: KUNDIN, firmaId: 'f-2', start: '2026-10-20' }));
    // Das Ereignis „Mandat angelegt“ bleibt privat — mit Arbeits-Marke.
    const { ereignisseLaden } = await import('@/lib/ereignisse/server');
    const e = (await ereignisseLaden()).eintraege.find(x => x.art === 'mandat-angelegt' && x.bezug.mandatId === 'm-selbst-neu');
    expect(e).toMatchObject({ bereich: 'privat', arbeit: true });
    await S.prozesseImTakt();
    const selbst = await laeufeVon(PZ_SELBST);
    expect(selbst.map(l => [l.fall.id, l.modus, l.ausloeser.art])).toEqual([['m-selbst-neu', 'schatten', 'produkt']]);
    expect((await laeufeVon(PZ_ALLG)).map(l => l.fall.id)).toEqual(['m-biz-neu']);
  }, 60_000);

  it('scharf: der Lauf legt die Akte an, seine Aufgaben liegen im Space der Einheit unter Privat (nie im Mandanten-Space des Business)', async () => {
    const v = await laeufeVon(PZ_SCHARF);
    expect(v.map(l => [l.fall.id, l.modus])).toEqual([['m-video', 'scharf']]);
    const tasks = ((await db.loadJson<{ tasks: { id: string; space?: string; spaceId?: string; bezug?: { mandatId?: string } }[] }>('tasks'))?.tasks ?? []).filter(t => t.id.startsWith(v[0].id));
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every(t => t.spaceId === 'kdc' && t.space === 'privat' && t.bezug?.mandatId === 'm-video')).toBe(true);
    const faelle = (await (await import('@/lib/fulfillment/speicher')).fulfillmentLesen('faelle', H)).faelle;
    expect(faelle['m-video']?.ablauf).toEqual({ art: 'prozess', prozessId: PZ_SCHARF });
    // Die Akte sieht die volle Person, ein Konto „nur Business“ nicht.
    expect((await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-video')).status).toBe(200);
    expect((await rufe('fulfillment/fall', 'GET', sitzung('bea'), undefined, '?m=m-video')).status).toBe(404);
  }, 60_000);

  it('Läufe zu Mandaten der Selbstständigkeit nur mit Privat-Recht (Läufe-Route)', async () => {
    const lauf = (await laeufeVon(PZ_SELBST))[0];
    const pia = await rufe('prozesse/laeufe', 'GET', sitzung('pia'), undefined, `?prozess=${PZ_SELBST}&space=business`);
    expect((pia.j.laeufe as unknown[]).length).toBe(1);
    const bea = await rufe('prozesse/laeufe', 'GET', sitzung('bea'), undefined, `?prozess=${PZ_SELBST}&space=business`);
    expect(bea.status).toBe(200);
    expect(bea.j.laeufe).toEqual([]);
    expect((await rufe('prozesse/laeufe', 'GET', sitzung('bea'), undefined, '?fall=mandat:m-selbst-neu&space=business')).j.laeufe).toEqual([]);
    expect((await rufe('prozesse/laeufe', 'GET', sitzung('bea'), undefined, `?lauf=${lauf.id}&space=business`)).status).toBe(404);
    expect((await rufe('prozesse/laeufe', 'GET', sitzung('pia'), undefined, '?fall=mandat:m-selbst-neu&space=business')).j.laeufe).toHaveLength(1);
  }, 60_000);

  it('private Ereignisse OHNE Arbeits-Marke gehen nie an Prozesse', async () => {
    // Ein Mandat direkt im Bestand (ohne Ereignis) — dann ein privates Ereignis ohne Marke: kein Lauf. Erst mit Marke startet der Produkt-Prozess.
    await db.updateJson<CrmBestand>('crm', c => ({ ...c!, mandate: [...c!.mandate, mandat('m-still', 'kdc', 'l-selbst', { start: '2026-10-20' })] }));
    const { ereignis } = await import('@/lib/ereignisse/server');
    await ereignis({ id: 'probe:still:privat', art: 'mandat-angelegt', quelle: 'crm', bereich: 'privat', bezug: { mandatId: 'm-still' } });
    await S.prozesseImTakt();
    expect((await laeufe()).laeufe.some(l => l.fall.id === 'm-still')).toBe(false);
    await ereignis({ id: 'probe:still:arbeit', art: 'mandat-angelegt', quelle: 'crm', bereich: 'privat', arbeit: true, bezug: { mandatId: 'm-still' } });
    await S.prozesseImTakt();
    expect((await laeufe()).laeufe.filter(l => l.fall.id === 'm-still').map(l => l.prozessId)).toEqual([PZ_SELBST]);
  }, 60_000);
});
