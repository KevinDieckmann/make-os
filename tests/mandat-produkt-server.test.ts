// ─── Produkte & Mandate · P3 Mandat (19.10.) — die Schreibwege mit eigenem Datenordner ──────────────────────────────────────────────
// Erfundene Produkte, Firmen und Personen (@example.invalid). Geprüft wird:
//   · Monatsrechnung mit Zusatzmodulen (laufend + inklusive) und genau EINER Anrechnung (zweiter Monat: keine)
//   · „abrechnen“ (je Event): offener Entwurf bekommt die Position dazu; ist die Monatsrechnung gestellt, eine eigene Rechnung — die den Monat nicht aufhält
//   · Deal folgt dem angenommenen Angebot (Hauptprodukt)
//   · der Bestand-Schreibweg prüft Zusatzmodule (400) und lässt einen Mandat ohne Zusatz unverändert
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Angebot, Chance, CrmBestand, Leistung, Mandat, PreisTeil } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import type { FinanzplanFile, Rechnung } from '@/lib/finanzen/finanzplan-bestand';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-mandat-produkt-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-mandat-produkt';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-nur-fuer-den-mandat-produkt-test';

const J = '2026-10-01T10:00:00.000Z';
const z = { person: 'pia', haushalt: 'test-haus', sicht: 'privat' as const, wer: { art: 'person' as const, person: 'pia' } };
const teil = (x: Partial<PreisTeil>): PreisTeil => ({ id: 'pt-1', art: 'fest', rolle: 'grund', ...x } as PreisTeil);
const leistung = (x: Partial<Leistung>): Leistung => ({ id: 'l-a', name: 'Produkt A', typ: 'retainer', stufe: 'kern', preis: { betrag: 0, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'kdv', status: 'aktiv', geaendert: J, ...x } as Leistung);
const KATALOG = [
  leistung({ id: 'l-haupt', name: 'Vertriebsbegleitung', preise: [teil({ art: 'monatlich', betragCent: 300_000 })] }),
  leistung({ id: 'l-mon', name: 'Reporting-Modul', rolle: 'zusatz', preise: [teil({ art: 'monatlich', betragCent: 50_000 })] }),
  leistung({ id: 'l-je', name: 'Messe-Einsatz', rolle: 'zusatz', preise: [teil({ art: 'je_einheit', betragCent: 150_000, einheit: 'je Event' })] }),
  leistung({ id: 'l-ws', name: 'Klarheitstag', typ: 'workshop', preise: [teil({ art: 'fest', betragCent: 200_000 })], regeln: { anrechnung: { auf: ['l-haupt'], anteilProzent: 100 } } }),
  leistung({ id: 'l-alt', name: 'Altes Paket' }),
];
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({
  id, kunde: 'Muster GmbH', firmaId: 'f-muster', kontaktIds: ['c-anna1'], titel: 'Begleitung', art: 'retainer', gesellschaft: 'kdv', status: 'aktiv', leistungId: 'l-haupt',
  vertragUnterschrieben: true, verlaengerung: 'auto', start: '2026-10-01', honorar: { betrag: 3000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich',
  zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
} as unknown as Mandat);

let db: typeof import('@/lib/store/local-db');
let server: typeof import('@/lib/finanzen/rechnung/server');
let speicher: typeof import('@/lib/crm/speicher');
const crm = async () => (await db.loadJson<CrmBestand>('crm'))!;
const rechnungen = async () => (await db.loadJson<FinanzplanFile>('finanzplan'))!.rechnungen;
const setzeStatus = async (id: string, status: Rechnung['status']) => { await db.updateJson<FinanzplanFile>('finanzplan', f => ({ ...f!, rechnungen: f!.rechnungen.map(r => (r.id === id ? { ...r, status } : r)) })); };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  speicher = await import('@/lib/crm/speicher');
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' });
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber')], einladungen: [] });
  const k = (id: string): Kontakt => ({ id, vorname: 'Anna', nachname: 'Test', email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'gewonnen', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', firmaId: 'f-muster', firma: 'Muster GmbH' } as Kontakt);
  await db.saveJson('kontakte', { kontakte: [k('c-anna1')] });
  const deal: Chance = { id: 'ch-1', titel: 'Begleitung Muster', kontaktIds: ['c-anna1'], firmaId: 'f-muster', art: 'retainer', leistungId: 'l-alt', wert: { betrag: 3000, basis: 'monat' }, stufe: 'angebot', historie: [{ stufe: 'angebot', am: J, von: 'pia' }], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft: 'kdv', besitzer: 'pia', angelegt: J, geaendert: J } as Chance;
  const angebot = { id: 'ang-0001-a', gesellschaft: 'kdv', kontaktId: 'c-anna1', firmaId: 'f-muster', dealId: 'ch-1', titel: 'Begleitung', nummer: 'KDV-A-2026-0001',
    positionen: [{ id: 'p1', leistungId: 'l-ws', titel: 'Auftakt', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 200_000, ustSatz: 19, basis: 'einmalig' }, { id: 'p2', leistungId: 'l-haupt', titel: 'Begleitung', text: '', menge: 1, einheit: 'Monat', einzelpreisCent: 300_000, ustSatz: 19, basis: 'monat', laufzeitMonate: 6 }],
    einleitung: '', schluss: '', gueltigBis: '2026-12-31', zahlungszielTage: 14, status: 'gestellt', version: 1, gestelltAm: J, angelegt: J, geaendert: J } as unknown as Angebot;
  await db.saveJson('crm', {
    ...speicher.leererBestand(), leistungen: KATALOG, chancen: [deal], angebote: [angebot],
    firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'kunde', geaendert: J, zahlung: { empfaenger: { anschrift: 'Hauptstraße 5, 54321 Beispielstadt' } } },
      { id: 'f-zwei', name: 'Zweite Beispiel GmbH', rolle: 'kunde', geaendert: J, zahlung: { empfaenger: { anschrift: 'Nebenweg 2, 54321 Beispielstadt' } } }],
    mandate: [
      mandat('m-zusatz', { zusatz: [{ id: 'mz-mon', leistungId: 'l-mon', honorar: { betragCent: 50_000, basis: 'monat' } }, { id: 'mz-je', leistungId: 'l-je', honorar: { betragCent: 150_000, basis: 'einheit' } }, { id: 'mz-inkl', leistungId: 'l-ws', inklusive: true }] }),
      mandat('m-ohne', { leistungId: undefined }),
      // 21.10. (Kevin: Anrechnung inkl. Optionen, der Rest wandert): Beginn mitten im Oktober, der Workshop (+ Option) ist größer als der Oktober.
      mandat('m-rest', { kunde: 'Zweite Beispiel GmbH', firmaId: 'f-zwei', start: '2026-10-20' }),
    ],
  } as unknown as CrmBestand);
  await db.saveJson('gesellschaften--test-haus', { gesellschaften: [{ id: 'kdv', firmierung: 'Beispiel Ventures UG (haftungsbeschränkt)', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt' }] });
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  // Der Workshop ist bezahlt (Rechnung derselben Firma mit dem Produkt) — er wird auf das Hauptprodukt angerechnet.
  await db.saveJson('finanzplan', { ...SEED, rechnungen: [{ id: 'r-ws', firmaId: 'kdv', kunde: 'Muster GmbH', titel: 'Workshop', betrag: 2380, netto: 2000, status: 'bezahlt', kundeFirmaId: 'f-muster', positionen: [{ id: 'p1', leistungId: 'l-ws', titel: 'Workshop', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 200_000, ustSatz: 19 }] },
    { id: 'r-ws2', firmaId: 'kdv', kunde: 'Zweite Beispiel GmbH', titel: 'Workshop', betrag: 5355, netto: 4500, status: 'bezahlt', kundeFirmaId: 'f-zwei', positionen: [{ id: 'p1', leistungId: 'l-ws', titel: 'Workshop', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 200_000, ustSatz: 19 }, { id: 'p2', leistungId: 'l-ws', titel: 'Workshop · je Event', text: '', menge: 1, einheit: 'Event', einzelpreisCent: 250_000, ustSatz: 19 }] }] });
  server = await import('@/lib/finanzen/rechnung/server');
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Monatsrechnung mit Zusatzmodulen und Anrechnung', () => {
  it('Haupt + laufendes Modul + inklusive (0 €) + EINE Anrechnung; der nächste Monat ohne Anrechnung', async () => {
    const okt = (await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-zusatz', monat: '2026-10' })).rechnung;
    expect(okt.positionen!.map(p => [p.titel, p.einzelpreisCent])).toEqual([
      ['Begleitung — Oktober 2026', 300_000], ['Reporting-Modul — Oktober 2026', 50_000], ['Klarheitstag — inklusive', 0], ['Anrechnung Klarheitstag', -200_000],
    ]);
    expect(okt).toMatchObject({ netto: 1500, betrag: 1785 });
    const nov = (await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-zusatz', monat: '2026-11' })).rechnung;
    expect(nov.positionen!.map(p => p.titel)).toEqual(['Begleitung — November 2026', 'Reporting-Modul — November 2026', 'Klarheitstag — inklusive']);
    expect(nov).toMatchObject({ netto: 3500, betrag: 4165 });
    // Den Entwurf noch einmal speichern: die Anrechnung bleibt negativ (Säuberung).
    const gespeichert = await server.entwurfSpeichern({ id: okt.id, felder: { positionen: okt.positionen }, stand: okt.fassung, haushalt: z.haushalt, sicht: z.sicht });
    expect(gespeichert.positionen!.at(-1)!.einzelpreisCent).toBe(-200_000);
  });
  it('„abrechnen“: offener Entwurf bekommt die Position (gleiches Modul ersetzt); ist er gestellt, eine eigene Rechnung', async () => {
    const offen = (await rechnungen()).find(r => r.mandatId === 'm-zusatz' && r.leistungVon === '2026-11-01')!;
    const a = await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-zusatz', monat: '2026-11', einheiten: [{ zusatzId: 'mz-je', menge: 2 }] });
    expect(a).toMatchObject({ vorhanden: true, rechnung: { id: offen.id, netto: 6500 } });
    expect(a.rechnung.positionen!.at(-1)).toMatchObject({ titel: 'Messe-Einsatz — November 2026', menge: 2, einheit: 'Event', einzelpreisCent: 150_000 });
    const b = await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-zusatz', monat: '2026-11', einheiten: [{ zusatzId: 'mz-je', menge: 1 }] });
    expect(b.rechnung).toMatchObject({ id: offen.id, netto: 5000 });
    await setzeStatus(offen.id, 'gestellt');
    const c = await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-zusatz', monat: '2026-11', einheiten: [{ zusatzId: 'mz-je', menge: 1 }] });
    expect(c.vorhanden).toBe(false);
    expect(c.rechnung).toMatchObject({ titel: 'Begleitung — November 2026 (abgerechnete Zusatzmodule)', netto: 1500 });
    expect(c.rechnung.positionen!.every(p => p.id.startsWith('za-'))).toBe(true);
    // Die eigene Rechnung hält den Monat nicht auf: „Rechnung für November“ ist weiter die gestellte Monatsrechnung.
    expect(await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-zusatz', monat: '2026-11' })).toMatchObject({ vorhanden: true, rechnung: { id: offen.id } });
    // Ein zweites „abrechnen“ hängt an die offene eigene Rechnung.
    const d = await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-zusatz', monat: '2026-11', einheiten: [{ zusatzId: 'mz-je', menge: 3 }] });
    expect(d).toMatchObject({ vorhanden: true, rechnung: { id: c.rechnung.id, netto: 4500 } });
  });
  it('Fehler beim Abrechnen: falsches Modul 409, Unsinn 400 — nichts angelegt', async () => {
    const vorher = (await rechnungen()).length;
    await expect(server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-zusatz', monat: '2026-12', einheiten: [{ zusatzId: 'mz-mon', menge: 1 }] })).rejects.toMatchObject({ status: 409 });
    await expect(server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-zusatz', monat: '2026-12', einheiten: 'drei' })).rejects.toMatchObject({ status: 400 });
    expect((await rechnungen()).length).toBe(vorher);
  });
  it('Anrechnung inkl. Option, Teilmonat zuerst — der Rest wandert über die nächsten Rechnungen, bis alles angerechnet ist', async () => {
    const titel = (r: Rechnung) => r.positionen!.filter(p => p.id.startsWith('anr-')).map(p => [p.einzelpreisCent, p.text]);
    // Oktober 20.–31.: 3.000 € × 12/31 = 1.161,29 € — so viel wird angerechnet, 4.500 € (Grundpreis + Option) − 1.161,29 € bleiben offen.
    const okt = (await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-rest', monat: '2026-10' })).rechnung;
    expect(titel(okt)).toEqual([[-116_129, 'Angerechnet voll: 1.161,29 € von 4.500,00 € — der Rest von 3.338,71 € folgt auf der nächsten Rechnung.']]);
    expect(okt.netto).toBe(0);
    const nov = (await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-rest', monat: '2026-11' })).rechnung;
    expect(titel(nov)).toEqual([[-300_000, 'Angerechnet voll: 3.000,00 € von 4.500,00 € (bisher 1.161,29 €) — der Rest von 338,71 € folgt auf der nächsten Rechnung.']]);
    const dez = (await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-rest', monat: '2026-12' })).rechnung;
    expect(titel(dez)).toEqual([[-33_871, 'Angerechnet voll: 338,71 € von 4.500,00 € (bisher 4.161,29 €) — damit vollständig angerechnet.']]);
    expect(dez.netto).toBe(2661.29);
    const jan = (await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-rest', monat: '2027-01' })).rechnung;
    expect(titel(jan)).toEqual([]);
    // Wird der November storniert, ist sein Teil wieder offen — die nächste neue Rechnung trägt ihn.
    await setzeStatus(nov.id, 'storniert');
    const feb = (await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-rest', monat: '2027-02' })).rechnung;
    expect(titel(feb)[0][0]).toBe(-300_000);
  });
  it('Mandat ohne Zusatz: genau eine Position wie bisher', async () => {
    const r = (await server.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-ohne', monat: '2026-10' })).rechnung;
    expect(r.positionen!.map(p => p.id)).toEqual(['p1']);
    expect(r).toMatchObject({ netto: 3000, betrag: 3570 });
  });
});

describe('Deal folgt dem Angebot', () => {
  it('angenommen: Deal gewonnen und das Hauptprodukt des Angebots (laufend) statt des alten Produkts', async () => {
    const { angebotAnnehmen } = await import('@/lib/crm/angebot-server');
    const { standVon } = await import('@/lib/crm/crm-stand');
    const a = (await crm()).angebote!.find(x => x.id === 'ang-0001-a')!;
    await angebotAnnehmen({ id: a.id, stand: standVon(a), person: 'pia' });
    expect((await crm()).chancen.find(c => c.id === 'ch-1')).toMatchObject({ stufe: 'gewonnen', leistungId: 'l-haupt' });
  });
});

describe('Bestand-Schreibweg prüft die Zusatzmodule', () => {
  it('kein Zusatzmodul (Rolle) → 400, nichts geändert; gültig → gespeichert', async () => {
    const b = await speicher.ladeCrm();
    const neu = [{ id: 'mz-x', leistungId: 'l-alt', honorar: { betragCent: 1, basis: 'monat' } }];
    const r = speicher.wendeCrmAn(b, [{ liste: 'mandate', op: 'teil', id: 'm-ohne', felder: { zusatz: neu } }], J, 'pia');
    expect(r.ungueltig?.[0]).toContain('kein Zusatzmodul');
    expect(r.angewandt).toBe(0);
    const ok = speicher.wendeCrmAn(b, [{ liste: 'mandate', op: 'teil', id: 'm-ohne', felder: { zusatz: [{ ...neu[0], leistungId: 'l-mon', zahlplan: { anzahlungProzent: 40 } }] } }], J, 'pia');
    expect(ok.ungueltig).toBeUndefined();
    expect(ok.bestand.mandate.find(m => m.id === 'm-ohne')!.zusatz).toEqual([{ id: 'mz-x', leistungId: 'l-mon', honorar: { betragCent: 1, basis: 'monat' }, zahlplan: { anzahlungProzent: 40 } }]);
    // Ohne `zusatz` in der Änderung: keine Prüfung, das Mandat bleibt (bit-gleich) ohne das Feld.
    const titel = speicher.wendeCrmAn(b, [{ liste: 'mandate', op: 'teil', id: 'm-ohne', felder: { titel: 'Begleitung 2027' } }], J, 'pia');
    expect('zusatz' in titel.bestand.mandate.find(m => m.id === 'm-ohne')!).toBe(false);
  });
});
