// ─── Kreislauf Geld (29.10., Pakete 1 + 2) ─────────────────────────────────────────────────────────────────────────────────────────────────
// P1 Geld sicher: keine zweite Rechnung über ein Angebot mit Mandat (B1), offene Raten nach dem Mandatsende bleiben im Liquiplan (B2), „als bezahlt
// vermerken“ aus dem Kontoauszug (B5), Mahnaufgaben schließen bei bezahlt/Storno (B6), Ereignisse storniert/überfällig/abgelaufen + Arbeits-Marke (B7).
// P2 Nichts bleibt liegen: angenommen → Mandat + Liquiplan automatisch mit Rückgängig (a), Morgenlauf „Rechnungen vorbereiten“ (b), Liquidität
// „n Mandate nicht im Liquiplan“ (c). Eigener Datenordner, alles erfunden.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

// Eigener Datenordner VOR allen Imports (die reinen Module laden local-db mit) — Muster tests/kalender-geburtstage.test.ts.
const { ordner } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: path } = await import('node:path');
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'make-os-kreislauf-geld-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-kreislauf-geld', MAKE_OS_DATEN_SCHLUESSEL: 'pruef-datenschluessel-nur-fuer-den-kreislauf-geld-test' });
  return { ordner };
});
import type { FinanzplanFile, Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import type { Angebot, Chance, CrmBestand, Mandat } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Planposten } from '@/lib/make-one/liquiditaet';
import { mandatPosten, mandatLiquiLage } from '@/lib/crm/kunden';
import { istMahnAufgabeVon, mandateNichtImLiquiplan, rateNummer, vorbereitenAbMonat, rechnungFuerMonat, ueberfaelligFrisch, vorbereitenAufgabeId, vorbereitenMonate } from '@/lib/finanzen/rechnung/kreislauf-regeln';
import { rechnungEreignisBereich } from '@/lib/ereignisse/quellen';
import { EREIGNISSE_ANGEBUNDEN, EREIGNIS_NAME } from '@/lib/ereignisse/arten';
import { bezahltVorschlaege, offeneHinweise } from '@/lib/finanzen/kontoauszug/plan';
import { istBasisVorschlaege } from '@/lib/finanzen/produkte';
import { bereichVonGesellschaft } from '@/lib/einheiten';

const J = '2026-08-01T10:00:00.000Z';
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({
  id, kunde: 'Muster GmbH', firmaId: 'f-muster', kontaktIds: ['c-anna1'], titel: 'Begleitung', art: 'retainer', gesellschaft: 'kdv', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-08-01', verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
  ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
} as Mandat);
const rechnung = (id: string, x: Partial<Rechnung> = {}): Rechnung => ({ id, firmaId: 'kdv', kunde: 'Muster GmbH', titel: 'Rate', betrag: 119, status: 'gestellt', ...x } as Rechnung);

describe('B2 · offene Raten nach dem Mandatsende bleiben im Liquiplan, abgerechnete fallen weg', () => {
  const raten = mandat('m-raten', { honorar: { betrag: 3000, basis: 'einmalig', netto: true }, rechnungsrhythmus: 'einmalig', start: '2026-08-01', ende: '2026-08-31', raten: { anzahl: 3, abstandMonate: 1 } });
  const augGestellt = [rechnung('r-aug', { mandatId: 'm-raten', leistungVon: '2026-08-01' })];
  const heute = '2026-09-15';
  it('aktiv: 3 Raten über das Ende — die gestellte August-Rate fällt weg, September und Oktober bleiben', () => {
    const p = mandatPosten(raten, heute, { anrechnung: { mandate: [raten], rechnungen: augGestellt } });
    expect(p.map(x => x.leistungsmonat)).toEqual(['2026-09', '2026-10']);
    // Ohne Rechnungen (andere Aufrufer) wie bisher: der vergangene August zahlt ab heute + Zahlungsziel.
    expect(mandatPosten(raten, heute).map(x => x.leistungsmonat)).toEqual(['2026-08', '2026-09', '2026-10']);
  });
  it('beendet: Soll trägt die offenen Raten (auch für „Plan angleichen“); fehlen sie im Plan → „fehlt“, nicht „kein Posten“', () => {
    const b = { ...raten, status: 'beendet' as const };
    expect(mandatPosten(b, heute, { anrechnung: { mandate: [b], rechnungen: augGestellt } }).map(x => x.leistungsmonat)).toEqual(['2026-09', '2026-10']);
    expect(mandatPosten(b, heute, { beendet: true, anrechnung: { mandate: [b], rechnungen: augGestellt } })).toHaveLength(2);
    expect(mandatLiquiLage(b, [], heute, undefined, { mandate: [b], rechnungen: augGestellt }).lage).toBe('fehlt');
    // Stehen die offenen Raten im Plan, ist es „beendet“ (nicht „endet“ → „Posten beenden“ entfernte sie nicht mehr).
    const soll = mandatPosten(b, heute, { beendet: true, anrechnung: { mandate: [b], rechnungen: augGestellt } });
    expect(mandatLiquiLage(b, soll, heute, undefined, { mandate: [b], rechnungen: augGestellt }).lage).toBe('beendet');
  });
  it('beendet ohne Raten: wie bisher kein Posten', () => {
    const m = mandat('m-monat', { status: 'beendet', ende: '2026-08-31' });
    expect(mandatPosten(m, '2026-09-15')).toEqual([]);
  });
});

describe('Regeln (rein): fälliger Monat, Rate, überfällig frisch, Mahnaufgaben, Liquidität', () => {
  it('Monatshonorar: nur Monate ab der Einführung bis zum laufenden, ohne gestellte; Tagessatz und Quartal nie', () => {
    const m = mandat('m-1', { start: '2026-08-15' });
    expect(vorbereitenMonate(m, '2026-11-03', new Set(), '2026-10')).toEqual(['2026-10', '2026-11']);
    expect(vorbereitenMonate(m, '2026-11-03', new Set(['2026-10']), '2026-10')).toEqual(['2026-11']);
    expect(vorbereitenMonate(mandat('m-2', { start: '2026-12-01' }), '2026-11-03', new Set(), '2026-10')).toEqual([]);
    expect(vorbereitenMonate(mandat('m-3', { honorar: { betrag: 900, basis: 'tag', netto: true } }), '2026-11-03', new Set(), '2026-10')).toEqual([]);
    expect(vorbereitenMonate(mandat('m-4', { rechnungsrhythmus: 'quartal' }), '2026-11-03', new Set(), '2026-10')).toEqual([]);
    expect(vorbereitenMonate(mandat('m-5', { status: 'pausiert' }), '2026-11-03', new Set(), '2026-10')).toEqual([]);
  });
  it('Einführung: erst der Folgemonat (Oktober → November, Dezember → Januar)', () => {
    expect(vorbereitenAbMonat('2026-10-29')).toBe('2026-11');
    expect(vorbereitenAbMonat('2026-12-05')).toBe('2027-01');
  });
  it('Raten: die Zahlungsmonate ab der Einführung (auch nach dem Ende); Rate i von n', () => {
    const m = mandat('m-r', { honorar: { betrag: 3000, basis: 'einmalig', netto: true }, rechnungsrhythmus: 'einmalig', start: '2026-09-01', ende: '2026-09-30', raten: { anzahl: 3, abstandMonate: 1 } });
    expect(vorbereitenMonate(m, '2026-11-02', new Set(['2026-10']), '2026-10')).toEqual(['2026-11']);
    expect(rateNummer(m, '2026-11')).toEqual({ nr: 3, von: 3 });
  });
  it('Rechnung für den Monat: Entwurf oder gestellt zählt, Storno und Angebots-Rechnungen nicht', () => {
    expect(rechnungFuerMonat([rechnung('a', { mandatId: 'm', leistungVon: '2026-10-01', status: 'geplant' })], 'm', '2026-10')).toBe(true);
    expect(rechnungFuerMonat([rechnung('a', { mandatId: 'm', leistungVon: '2026-10-01', status: 'storniert' })], 'm', '2026-10')).toBe(false);
    expect(rechnungFuerMonat([rechnung('a', { mandatId: 'm', leistungVon: '2026-10-01', angebotId: 'ang-1' })], 'm', '2026-10')).toBe(false);
    expect(vorbereitenAufgabeId('m-1', '2026-10')).toBe('rv-m-1-2026-10');
  });
  it('überfällig: je Stufe nur frisch (7 Tage) — keine Flut beim Einführen', () => {
    const r = rechnung('r-ue', { faellig: '2026-10-01', nummer: 'X-1' });
    expect(ueberfaelligFrisch([r], '2026-10-10', [7, 14, 21]).map(x => x.stufe)).toEqual([1]);
    expect(ueberfaelligFrisch([r], '2026-10-20', [7, 14, 21])).toEqual([]);
    expect(ueberfaelligFrisch([rechnung('r-b', { faellig: '2026-10-01', status: 'bezahlt' })], '2026-10-10', [7, 14, 21])).toEqual([]);
    // Stufe 2: ab der Zahlungserinnerung + Abstand der Stufen.
    const r2 = rechnung('r-2', { faellig: '2026-10-01', mahnungen: [{ stufe: 1, am: '2026-10-09', von: 'pa' }] } as Partial<Rechnung>);
    expect(ueberfaelligFrisch([r2], '2026-10-17', [7, 14, 21]).map(x => x.stufe)).toEqual([2]);
  });
  it('Mahnaufgaben einer Rechnung erkennen (`mahn-<rechnung>-<stufe>`)', () => {
    expect(istMahnAufgabeVon('mahn-r-1-2', 'r-1')).toBe(true);
    expect(istMahnAufgabeVon('mahn-r-10-2', 'r-1')).toBe(false);
  });
  it('Liquidität: nur Business-Mandate mit Lage „fehlt“ zählen', () => {
    expect(mandateNichtImLiquiplan([{ lage: 'fehlt', gesellschaft: 'kdv' }, { lage: 'fehlt', gesellschaft: 'kdc' }, { lage: 'ok', gesellschaft: 'ug' }], bereichVonGesellschaft)).toBe(1);
  });
});

describe('B7 · Ereignisse: neue Arten im Katalog, Arbeits-Marke an Rechnungs-Ereignissen', () => {
  it('angebunden und benannt (die Werkstatt bietet sie als Auslöser an)', () => {
    for (const a of ['rechnung-storniert', 'rechnung-ueberfaellig', 'angebot-abgelaufen'] as const) {
      expect(EREIGNISSE_ANGEBUNDEN).toContain(a);
      expect(EREIGNIS_NAME[a]).toBeTruthy();
    }
  });
  it('Rechnung der Selbstständigkeit: privat + arbeit; Business ohne Marke', () => {
    expect(rechnungEreignisBereich('kdv')).toEqual({ bereich: 'business' });
    expect(rechnungEreignisBereich('kdc')).toEqual({ bereich: 'privat', arbeit: true });
    expect(rechnungEreignisBereich('privat')).toEqual({ bereich: 'privat' });
  });
});

describe('B5 · Kontoauszug: offene Rechnung als bezahlt vermerken (Vorschlag)', () => {
  it('derselbe Treffer wie der Hinweis — nur echte Rechnungen mit Kennung, Tag des Umsatzes', () => {
    const plan = { zeilen: [{ i: 0, status: 'neu' }, { i: 1, status: 'neu' }] } as never;
    const auszug = { eintraege: [{ datum: '2026-10-20', cent: 11900, zweck: 'Rechnung KDV-R-2026-0007', gegenpartei: 'Muster GmbH' }, { datum: '2026-10-21', cent: 5000, zweck: 'x', gegenpartei: 'Andere AG' }] } as never;
    const offen = [{ art: 'rechnung' as const, id: 'r-7', name: 'Muster GmbH', cent: 11900, nummer: 'KDV-R-2026-0007', datum: '2026-10-01' }, { art: 'forderung' as const, name: 'Andere AG', cent: 5000 }];
    expect(bezahltVorschlaege(plan, auszug, offen)).toEqual([{ rechnungId: 'r-7', nummer: 'KDV-R-2026-0007', am: '2026-10-20' }]);
    expect(offeneHinweise(plan, auszug, offen)).toHaveLength(2);
  });
});

describe('B9 · Ist-Basis der Planung: Tagessatz ohne Tage nicht als „einmalig“, Raten monatlich', () => {
  it('Tagessatz ohne geplante Tage → kein Eintrag; monatliche Raten → Monatsbetrag über die Zahl der Raten', () => {
    const crm = { leistungen: [], chancen: [], mandate: [
      mandat('m-tag', { honorar: { betrag: 900, basis: 'tag', netto: true } }),
      mandat('m-rate', { honorar: { betrag: 3000, basis: 'einmalig', netto: true }, rechnungsrhythmus: 'einmalig', raten: { anzahl: 3, abstandMonate: 1 } }),
    ] } as unknown as Pick<CrmBestand, 'mandate' | 'chancen' | 'leistungen'>;
    const l = istBasisVorschlaege(crm, '2026-10-29');
    expect(l.find(x => x.quelleId === 'm-tag')).toBeUndefined();
    expect(l.find(x => x.quelleId === 'm-rate')).toMatchObject({ betrag: 1000, rhythmus: 'monatlich', laufzeit: 3 });
  });
});

// ── Server (eigener Datenordner) ─────────────────────────────────────────────────────────────────────────────────────────────

type H = (r: Request) => Promise<Response>;
let db: typeof import('@/lib/store/local-db');
let heute = '';
let rechnungRoute: { POST: H; GET: H };
let angebotRoute: { POST: H };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Antwort = { status: number; d: Record<string, any> };
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const postAn = async (route: { POST: H }, url: string, body: Record<string, unknown>, person = 'pa'): Promise<Antwort> => {
  const x = await route.POST(new Request(`http://test${url}`, { method: 'POST', headers: sitzung(person), body: JSON.stringify(body) }));
  return { status: x.status, d: await x.json() };
};
const re = (body: Record<string, unknown>) => postAn(rechnungRoute, '/api/rechnung', body);
/** „Angenommen“ über die Route — mit dem Stand des Angebots (wie der Browser). */
async function annehmen(id: string): Promise<Antwort> {
  const [{ ladeCrm }, { mitStand }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/crm/angebot-server')]);
  const a = ((await ladeCrm()).angebote ?? []).find(x => x.id === id)!;
  return postAn(angebotRoute, '/api/crm/angebot', { aktion: 'annehmen', id, stand: mitStand(a).stand });
}
let anf = 0;
const neueAnf = () => `anf-kg-${++anf}`;
const plan = async () => (await db.loadJson<FinanzplanFile>('finanzplan'))!;
const tasks = async () => (await db.loadJson<{ tasks: { id: string; status: string; title: string; geloeschtAm?: string }[] }>('tasks'))?.tasks ?? [];
const ereignisse = async () => (await db.loadJson<{ eintraege: { id: string; art: string; stufe?: string; bereich: string | null; arbeit?: true }[] }>('ereignisse--kg-haus'))?.eintraege ?? [];
const J2 = '2026-09-01T10:00:00.000Z';
const deal = (id: string, x: Partial<Chance> = {}): Chance => ({ id, titel: 'Sprint Muster', kontaktIds: ['c-anna1'], firmaId: 'f-muster', firma: 'Muster GmbH', art: 'projekt', wert: { betrag: 3000, basis: 'einmalig' }, stufe: 'angebot', historie: [{ stufe: 'angebot', am: J2, von: 'pa' }], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'ja', alternative: 'ja' }, gesellschaft: 'kdv', besitzer: 'pa', geaendert: J2, ...x } as unknown as Chance);
const angebot = (id: string, x: Partial<Angebot> = {}): Angebot => ({ id, gesellschaft: 'kdv', kontaktId: 'c-anna1', firmaId: 'f-muster', titel: 'Strategie-Sprint', nummer: `KDV-A-2026-${id.slice(-4)}`, positionen: [{ id: 'p1', titel: 'Sprint', text: 'Analyse', menge: 1, einheit: 'pauschal', einzelpreisCent: 300000, ustSatz: 19, basis: 'einmalig' }], einleitung: '', schluss: '', gueltigBis: '2027-12-31', zahlungszielTage: 21, status: 'gestellt', version: 1, gestelltAm: J2, angelegt: J2, geaendert: J2, ...x } as Angebot);

async function gestellt(g = 'kdv'): Promise<Rechnung & { fassung: string }> {
  const n = await re({ aktion: 'neu', quelle: 'frei', firmaId: g });
  const k = await re({ aktion: 'kunde', id: n.d.rechnung.id, stand: n.d.rechnung.fassung, kundeFirmaId: 'f-muster' });
  const s = await re({ aktion: 'speichern', id: n.d.rechnung.id, stand: k.d.rechnung.fassung, felder: { leistungVon: '2026-10-01', positionen: [{ id: 'p1', titel: 'Workshop', text: '', menge: 1, einheit: 'Tag', einzelpreisCent: 100000, ustSatz: 19 }] } });
  const st = await re({ aktion: 'stellen', id: s.d.rechnung.id, stand: s.d.rechnung.fassung, anfrageId: neueAnf() });
  expect(st.status, JSON.stringify(st.d)).toBe(200);
  return st.d.rechnung;
}
async function mahnAufgabe(rechnungId: string) {
  const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
  const jetzt = new Date().toISOString();
  await systemAufgabenAendern(() => ({ neu: [{ id: `mahn-${rechnungId}-1`, title: 'Zahlungserinnerung vorbereiten', status: 'todo', priority: 'high', assignee: 'both', dueDate: heute, tags: ['rechnung'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, space: 'business' }] }), { jetzt });
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  heute = (await import('@/lib/zeit')).localDay();
  const speicher = await import('@/lib/crm/speicher');
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'kg-haus' });
  await db.saveJson('konten', { konten: [konto('k1', 'pa', 'inhaber'), konto('k2', 'pb', 'mitglied')], einladungen: [] });
  const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Anna', nachname: 'Test', email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'gewonnen', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', firmaId: 'f-muster', firma: 'Muster GmbH', ...x });
  await db.saveJson('kontakte', { kontakte: [k('c-anna1'), k('c-gesperrt1', { nachname: 'Gesperrt', eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'pa' } } as Partial<Kontakt>)] });
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'kunde', geaendert: J2, zahlung: { empfaenger: { anschrift: 'Hauptstraße 5, 54321 Beispielstadt' }, zielTage: 30 } }] } as unknown as CrmBestand);
  const IBAN = ['DE89', '3704', '0044', '0532', '0130', '00'].join('');
  const absender = (id: string) => ({ id, firmierung: `Beispiel ${id.toUpperCase()}`, strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', steuernummer: '12/345/67890', bank: { iban: IBAN }, geschaeftsfuehrung: 'Erika Beispiel', register: 'Amtsgericht Musterstadt HRB 1' });
  await db.saveJson('gesellschaften--kg-haus', { gesellschaften: [absender('kdv'), absender('kdc')] });
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', SEED);
  await db.saveJson('liquiplan', { posten: [] });
  rechnungRoute = (await import('@/app/api/rechnung/route')) as unknown as { GET: H; POST: H };
  angebotRoute = (await import('@/app/api/crm/angebot/route')) as unknown as { POST: H };
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => undefined);
  rmSync(ordner, { recursive: true, force: true });
});

describe('B6/B7 · bezahlt und Storno schließen die Mahnaufgaben; Storno meldet sich als Ereignis', () => {
  it('bezahlt → Mahnaufgabe erledigt (Weg der Rechnungsansicht)', async () => {
    const r = await gestellt();
    await mahnAufgabe(r.id);
    const b = await re({ aktion: 'bezahlt', id: r.id, am: heute });
    expect(b.status, JSON.stringify(b.d)).toBe(200);
    expect((await tasks()).find(t => t.id === `mahn-${r.id}-1`)?.status).toBe('done');
  }, 120_000);
  it('Storno (mit PDF) → Mahnaufgabe abgebrochen + Ereignis „Rechnung storniert“ (Business, ohne Arbeits-Marke)', async () => {
    const r = await gestellt();
    await mahnAufgabe(r.id);
    const s = await re({ aktion: 'storno', id: r.id, grund: 'Falscher Betrag', anfrageId: neueAnf() });
    expect(s.status, JSON.stringify(s.d)).toBe(200);
    expect((await tasks()).find(t => t.id === `mahn-${r.id}-1`)?.status).toBe('cancelled');
    expect((await ereignisse()).find(e => e.id === `rechnung:${r.id}:storniert`)).toMatchObject({ art: 'rechnung-storniert', bereich: 'business' });
  }, 120_000);
  it('Rechnung gestellt der Selbstständigkeit: Ereignis privat MIT Arbeits-Marke', async () => {
    const r = await gestellt('kdc');
    expect((await ereignisse()).find(e => e.id === `rechnung:${r.id}:gestellt`)).toMatchObject({ bereich: 'privat', arbeit: true });
  }, 120_000);
  it('überfällig: einmal je Stufe aus dem Morgenlauf (idempotent)', async () => {
    const { tagePlus } = await import('@/lib/zeit');
    await db.updateJson<FinanzplanFile>('finanzplan', cur => ({ ...cur!, rechnungen: [...cur!.rechnungen, rechnung('r-ueber', { faellig: tagePlus(heute, -8), nummer: 'KDV-R-2026-0901', datum: tagePlus(heute, -20) })] }));
    const { ueberfaelligNachziehen } = await import('@/lib/finanzen/rechnung/kreislauf');
    expect(await ueberfaelligNachziehen(heute)).toBe(1);
    expect(await ueberfaelligNachziehen(heute)).toBe(0);
    expect((await ereignisse()).find(e => e.id === 'rechnung:r-ueber:ueberfaellig:1')).toMatchObject({ art: 'rechnung-ueberfaellig', stufe: '1' });
  });
  it('Angebot abgelaufen: Ereignis dort, wo der Status gespeichert wird — eingeschränkte Personen nie', async () => {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(b => ({ ...b, angebote: [...(b.angebote ?? []), angebot('ang-alt-0001', { gueltigBis: '2026-01-31' }), angebot('ang-alt-0002', { gueltigBis: '2026-01-31', kontaktId: 'c-gesperrt1' })] }));
    const { ablaufNachziehen } = await import('@/lib/crm/angebot-server');
    expect(await ablaufNachziehen()).toBe(2);
    const e = await ereignisse();
    expect(e.find(x => x.id === 'crm:angebot:ang-alt-0001:abgelaufen')).toMatchObject({ art: 'angebot-abgelaufen', bereich: 'business' });
    expect(e.find(x => x.id === 'crm:angebot:ang-alt-0002:abgelaufen')).toBeUndefined();
  });
});

describe('B1 · Angebot mit Mandat: keine zweite Rechnung über alle Positionen', () => {
  it('409 `mandat-vorhanden` — nur die Einmalposten gehen noch', async () => {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(b => ({ ...b, mandate: [...b.mandate, mandat('m-b1', { chanceId: 'd-b1' })], angebote: [...(b.angebote ?? []), angebot('ang-b1-0001', { status: 'angenommen', dealId: 'd-b1', angenommenAm: '2026-09-02', positionen: [
      { id: 'p1', titel: 'Einführung', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 100000, ustSatz: 19, basis: 'einmalig' },
      { id: 'p2', titel: 'Begleitung', text: '', menge: 1, einheit: 'Monat', einzelpreisCent: 50000, ustSatz: 19, basis: 'monat', laufzeitMonate: 6 },
    ] })] }));
    const voll = await re({ aktion: 'neu', quelle: 'angebot', angebotId: 'ang-b1-0001', anfrageId: neueAnf() });
    expect(voll.status).toBe(409);
    expect(voll.d).toMatchObject({ grund: 'mandat-vorhanden', mandatId: 'm-b1' });
    const einmal = await re({ aktion: 'neu', quelle: 'angebot', angebotId: 'ang-b1-0001', nur: 'einmalig', anfrageId: neueAnf() });
    expect(einmal.status, JSON.stringify(einmal.d)).toBe(200);
    expect(einmal.d.rechnung.mandatId).toBe('m-b1');
  }, 60_000);
  it('rechnet das Mandat den Einmalbetrag selbst ab (einmaliges Honorar bzw. Raten), auch `nur: einmalig` → 409 `mandat-rechnet-einmal`', async () => {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    const pos = [{ id: 'p1', titel: 'Einführung', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 100000, ustSatz: 19, basis: 'einmalig' as const }];
    await aendereCrm(b => ({ ...b,
      mandate: [...b.mandate, mandat('m-ein', { chanceId: 'd-ein', honorar: { betrag: 1000, basis: 'einmalig', netto: true }, rechnungsrhythmus: 'einmalig' }),
        mandat('m-rat', { chanceId: 'd-rat', honorar: { betrag: 1000, basis: 'einmalig', netto: true }, rechnungsrhythmus: 'einmalig', raten: { anzahl: 2, abstandMonate: 1 } })],
      angebote: [...(b.angebote ?? []), angebot('ang-ein-0001', { status: 'angenommen', dealId: 'd-ein', positionen: pos }), angebot('ang-rat-0001', { status: 'angenommen', dealId: 'd-rat', positionen: pos })] }));
    for (const id of ['ang-ein-0001', 'ang-rat-0001']) {
      const x = await re({ aktion: 'neu', quelle: 'angebot', angebotId: id, nur: 'einmalig', anfrageId: neueAnf() });
      expect(x.status, id).toBe(409);
      expect(x.d.grund).toBe('mandat-rechnet-einmal');
    }
    expect((await plan()).rechnungen.some(r => r.angebotId === 'ang-ein-0001' || r.angebotId === 'ang-rat-0001')).toBe(false);
  }, 60_000);
});

describe('P2a · angenommen → Mandat + Liquiplan automatisch, mit Rückgängig', () => {
  it('legt Mandat (aus dem Angebot) und die Posten an; Rückgängig nimmt beides weg; zweites Mal nichts', async () => {
    const { aendereCrm, ladeCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(b => ({ ...b, chancen: [...b.chancen, deal('d-auto')], angebote: [...(b.angebote ?? []), angebot('ang-auto-0001', { dealId: 'd-auto' })] }));
    const a = await annehmen('ang-auto-0001');
    expect(a.status, JSON.stringify(a.d)).toBe(200);
    expect(a.d.automatik).toMatchObject({ angelegt: true, liquiplan: 1 });
    const crm = await ladeCrm();
    const m = crm.mandate.find(x => x.chanceId === 'd-auto')!;
    expect(m).toMatchObject({ gesellschaft: 'kdv', vertragUnterschrieben: true, status: 'aktiv' });
    expect(a.d.automatik.mandatId).toBe(m.id);
    const posten = (await db.loadJson<{ posten: Planposten[] }>('liquiplan'))!.posten.filter(p => p.mandatId === m.id);
    expect(posten.length).toBe(1);
    // Idempotent: noch einmal → nichts.
    const { mandatAusAngebotAutomatisch } = await import('@/lib/crm/mandat-automatik-server');
    expect(await mandatAusAngebotAutomatisch({ angebotId: 'ang-auto-0001', person: 'pa' })).toBeNull();
    expect((await ladeCrm()).mandate.filter(x => x.chanceId === 'd-auto')).toHaveLength(1);
    // Rückgängig.
    const z = await postAn(angebotRoute, '/api/crm/angebot', { aktion: 'mandat-zurueck', id: 'ang-auto-0001' });
    expect(z.status, JSON.stringify(z.d)).toBe(200);
    expect((await ladeCrm()).mandate.find(x => x.id === m.id)).toBeUndefined();
    expect((await db.loadJson<{ posten: Planposten[] }>('liquiplan'))!.posten.filter(p => p.mandatId === m.id)).toEqual([]);
    // Dienstweg darf nicht zurücknehmen.
    const dienst = await angebotRoute.POST(new Request('http://test/api/crm/angebot', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-kreislauf-geld', 'x-make-person': 'pa', 'x-forwarded-for': '127.0.0.1' }, body: JSON.stringify({ aktion: 'mandat-zurueck', id: 'ang-auto-0001' }) }));
    expect([401, 403]).toContain(dienst.status);
  }, 60_000);
  it('Rückgängig geht nicht mehr, sobald eine Rechnung am Mandat hängt (409 mit Grund)', async () => {
    const { aendereCrm, ladeCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(b => ({ ...b, chancen: [...b.chancen, deal('d-auto2')], angebote: [...(b.angebote ?? []), angebot('ang-auto-0002', { dealId: 'd-auto2' })] }));
    const a = await annehmen('ang-auto-0002');
    expect(a.d.automatik?.angelegt).toBe(true);
    const m = (await ladeCrm()).mandate.find(x => x.chanceId === 'd-auto2')!;
    const e = await re({ aktion: 'neu', quelle: 'mandat', mandatId: m.id, anfrageId: neueAnf() });
    expect(e.status, JSON.stringify(e.d)).toBe(200);
    const z = await postAn(angebotRoute, '/api/crm/angebot', { aktion: 'mandat-zurueck', id: 'ang-auto-0002' });
    expect(z.status).toBe(409);
    expect(z.d.grund).toBe('rechnung');
    expect((await ladeCrm()).mandate.find(x => x.id === m.id)).toBeTruthy();
  }, 60_000);
  it('Art. 18 einer beteiligten Person → kein Mandat (Grund in der Antwort)', async () => {
    const { aendereCrm, ladeCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(b => ({ ...b, chancen: [...b.chancen, deal('d-gesperrt', { kontaktIds: ['c-gesperrt1'] })], angebote: [...(b.angebote ?? []), angebot('ang-sperr-0001', { dealId: 'd-gesperrt', kontaktId: 'c-anna1' })] }));
    const a = await annehmen('ang-sperr-0001');
    expect(a.status, JSON.stringify(a.d)).toBe(200);
    expect(a.d.automatik).toMatchObject({ angelegt: false });
    expect((await ladeCrm()).mandate.some(x => x.chanceId === 'd-gesperrt')).toBe(false);
  }, 60_000);
});

describe('P2b · Morgenlauf „Rechnungen vorbereiten“', () => {
  it('erst ab dem Folgemonat der Einführung: Entwurf + Aufgabe — einmal; ein gelöschter Entwurf kommt nicht wieder; abschaltbar', async () => {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    const { tagePlus } = await import('@/lib/zeit');
    await aendereCrm(b => ({ ...b, mandate: [...b.mandate, mandat('m-mon', { start: '2026-01-01' })] }));
    const k = await import('@/lib/finanzen/rechnung/kreislauf');
    // Einführung heute: der laufende Monat ist Altbestand — nichts.
    const r1 = await k.rechnungenVorbereiten('kg-haus', heute);
    expect(r1.ab).toBe(heute);
    expect((await plan()).rechnungen.filter(r => r.mandatId === 'm-mon')).toHaveLength(0);
    // Im Folgemonat: genau ein Entwurf für diesen Monat + Aufgabe.
    const folge = `${vorbereitenAbMonat(heute)}-02`;
    const jetzt = new Date(`${folge}T10:00:00Z`);
    await k.rechnungenVorbereiten('kg-haus', folge, jetzt);
    const monat = folge.slice(0, 7);
    const entwuerfe = (await plan()).rechnungen.filter(r => r.mandatId === 'm-mon');
    expect(entwuerfe).toHaveLength(1);
    expect(entwuerfe[0]).toMatchObject({ status: 'geplant' });
    expect(entwuerfe[0].leistungVon?.slice(0, 7)).toBe(monat);
    expect((await tasks()).find(x => x.id === `rv-m-mon-${monat}`)?.title).toContain('Rechnung prüfen & stellen');
    // Zweiter Lauf: nichts Neues.
    await k.rechnungenVorbereiten('kg-haus', tagePlus(folge, 1), jetzt);
    expect((await plan()).rechnungen.filter(r => r.mandatId === 'm-mon')).toHaveLength(1);
    // Entwurf von Hand gelöscht → kommt nicht wieder.
    const stand = (await rechnungRoute.GET(new Request('http://test/api/rechnung', { headers: sitzung('pa') })).then(x => x.json())).rechnungen.find((r: { id: string }) => r.id === entwuerfe[0].id).fassung;
    const loesch = await re({ aktion: 'loeschen', id: entwuerfe[0].id, stand });
    expect(loesch.status, JSON.stringify(loesch.d)).toBe(200);
    await k.rechnungenVorbereiten('kg-haus', tagePlus(folge, 2), jetzt);
    expect((await plan()).rechnungen.filter(r => r.mandatId === 'm-mon')).toHaveLength(0);
    // Ausschalten (nur von Hand über die Route) → der Lauf tut nichts.
    const aus = await re({ aktion: 'vorbereiten', an: false });
    expect(aus.status, JSON.stringify(aus.d)).toBe(200);
    expect((await k.rechnungenVorbereiten('kg-haus', folge, jetzt)).aus).toBe(true);
    expect((await rechnungRoute.GET(new Request('http://test/api/rechnung', { headers: sitzung('pa') })).then(x => x.json())).vorbereiten).toBe(false);
    await re({ aktion: 'vorbereiten', an: true });
  }, 120_000);
});
