// ─── Prozesse × Fulfillment — Produkt → Prozess, die reinen Teile (22.10.; lib/prozesse/produkt-bindung.ts) ─────────────────────────────────────────
// Kevin 21.10.: „Fulfillment = das Werkzeug“ — jedes Produkt zeigt auf genau EINEN Ablauf (Paket des Fulfillments ODER Prozess der Werkstatt), ein neues
// Mandat startet ihn, ein Zusatzmodul seinen eigenen. Geprüft (ohne Daten, ohne Netz):
//   · wählbar: nur Werkstatt-Prozesse mit Fall-Art Mandat in Fulfillment · Übergabe · Ausbau, nicht archiviert
//   · Wahl auf der Produktkarte: erst das Neue setzen, dann das Alte lösen — nie zwei Abläufe, unveränderte Teile unberührt
//   · Start: „Mandat angelegt“ → Haupt + Zusatzmodule, „Zusatzmodul gebucht“ → nur dieses; ein Prozess höchstens einmal; Papierkorb/beendet nie
//   · Ereignis „Zusatzmodul gebucht“ nur für NEUE Module an bestehenden Mandaten — das Anlegen eines Mandats meldet weiter genau „mandat-angelegt“ (bit-gleich)
//   · Produkt: `prozessId` gesäubert (nur pz-…), ohne Verweis bleibt der Eintrag bit-gleich, KEIN Karten-Feld (Treppe unberührt)
//   · Landkarte: „für <Produkt>“ nur, wenn der Titel es nicht schon sagt
import { describe, it, expect } from 'vitest';
import { ablaufVon, ablaufWechsel, fuerProduktWaehlbar, mandateMitProduktLauf, produktMandate, produktStarts, produkteVonProzess, produkteVonVorlage, produktZeile, PRODUKT_BEREICHE } from '@/lib/prozesse/produkt-bindung';
import { onboardingKandidaten } from '@/lib/fulfillment/regeln';
import { crmDiff } from '@/lib/ereignisse/quellen';
import { EREIGNISSE_ANGEBUNDEN, EREIGNIS_NAME } from '@/lib/ereignisse/arten';
import { eingabeSauber } from '@/lib/ereignisse/typen';
import { istEreignisArt } from '@/lib/ereignisse/arten';
import { PROZESS_EREIGNISSE, EREIGNIS_FELDER } from '@/lib/prozesse/ausloeser';
import { saeubern, wendeCrmAn, leererBestand } from '@/lib/crm/speicher';
import { istKarte, produktPruefen, produktProzessKennung } from '@/lib/crm/produkt-karte';
import { kachelTexte } from '@/lib/prozesse/modell';
import type { CrmBestand, Leistung, Mandat } from '@/lib/crm/typen';

const PZ = 'pz-00000000-0000-4000-8000-000000000a01';
const PZ2 = 'pz-00000000-0000-4000-8000-000000000a02';
const J = '2026-10-22T08:00:00.000Z';
const produkt = (id: string, x: Partial<Leistung> = {}): Leistung => ({ id, name: `Produkt ${id}`, typ: 'retainer', stufe: 'kern', preis: { betrag: 100, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J, ...x });
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({ id, kunde: 'Probe GmbH', firmaId: 'f-1', kontaktIds: ['c-1'], titel: 'Probe', art: 'retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: false, geaendert: J, ...x } as Mandat);

describe('Wählbar auf der Produktkarte', () => {
  const kurz = (x: Partial<Parameters<typeof fuerProduktWaehlbar>[0]> = {}) => ({ quelle: 'werkstatt' as const, fallArt: 'mandat' as const, bereich: 'fulfillment' as const, status: 'entwurf' as const, ...x });
  it('Werkstatt, Fall-Art Mandat, Bereich Fulfillment · Übergabe · Ausbau, nicht archiviert', () => {
    expect(PRODUKT_BEREICHE).toEqual(['fulfillment', 'uebergabe', 'ausbau']);
    for (const b of PRODUKT_BEREICHE) expect(fuerProduktWaehlbar(kurz({ bereich: b })), b).toBe(true);
    for (const s of ['probelauf', 'aktiv', 'pausiert'] as const) expect(fuerProduktWaehlbar(kurz({ status: s })), s).toBe(true);
    expect(fuerProduktWaehlbar(kurz({ status: 'archiviert' }))).toBe(false);
    expect(fuerProduktWaehlbar(kurz({ fallArt: 'lead' }))).toBe(false);
    expect(fuerProduktWaehlbar(kurz({ bereich: 'sales' }))).toBe(false);
    // Pakete wählt die Produktkarte aus der Fulfillment-Liste (wie bisher) — die Brücke der Werkstatt zählt hier nicht.
    expect(fuerProduktWaehlbar(kurz({ quelle: 'fulfillment', status: null }))).toBe(false);
  });
});

describe('Genau EIN Ablauf je Produkt — der Wechsel', () => {
  const ohne = produkt('p-1');
  const mitProzess = produkt('p-1', { prozessId: PZ });
  const zu = { 'p-1': { vorlageId: 'fp-paket' } };
  it('ablaufVon: Prozess der Werkstatt, sonst Paket, sonst nichts', () => {
    expect(ablaufVon(ohne, {})).toBeNull();
    expect(ablaufVon(ohne, zu)).toEqual({ art: 'paket', id: 'fp-paket' });
    expect(ablaufVon(mitProzess, {})).toEqual({ art: 'prozess', id: PZ });
    expect(ablaufVon(mitProzess, null)).toEqual({ art: 'prozess', id: PZ });
  });
  it('Paket → Prozess: erst den Prozess setzen, dann die Paket-Zuordnung lösen', () => {
    expect(ablaufWechsel(ohne, zu, PZ)).toEqual([{ art: 'produkt', prozessId: PZ }, { art: 'zuordnung', vorlageId: null }]);
  });
  it('Prozess → Paket: erst zuordnen, dann den Verweis am Produkt lösen', () => {
    expect(ablaufWechsel(mitProzess, {}, 'fp-paket')).toEqual([{ art: 'zuordnung', vorlageId: 'fp-paket' }, { art: 'produkt', prozessId: null }]);
  });
  it('ohne Ablauf: beides lösen, was gesetzt ist; unverändert: nichts', () => {
    expect(ablaufWechsel(mitProzess, zu, null)).toEqual([{ art: 'produkt', prozessId: null }, { art: 'zuordnung', vorlageId: null }]);
    expect(ablaufWechsel(ohne, {}, null)).toEqual([]);
    expect(ablaufWechsel(mitProzess, {}, PZ)).toEqual([]);
    expect(ablaufWechsel(ohne, zu, 'fp-paket')).toEqual([]);
    expect(ablaufWechsel(mitProzess, {}, PZ2)).toEqual([{ art: 'produkt', prozessId: PZ2 }]);
  });
});

describe('Start über die Produkt-Bindung', () => {
  const crm = (mandate: Mandat[], leistungen: Leistung[]) => ({ mandate, leistungen });
  const katalog = [produkt('p-haupt', { prozessId: PZ }), produkt('p-zusatz', { rolle: 'zusatz', prozessId: PZ2 }), produkt('p-ohne'), produkt('p-weg', { prozessId: PZ2, geloeschtAm: J })];
  it('„Mandat angelegt“: Hauptprodukt, dann die Zusatzmodule am Mandat — jeder Prozess höchstens einmal', () => {
    const m = mandat('ma-1', { leistungId: 'p-haupt', zusatz: [{ id: 'mz-1', leistungId: 'p-zusatz' }, { id: 'mz-2', leistungId: 'p-ohne' }] });
    expect(produktStarts({ art: 'mandat-angelegt', bezug: { mandatId: 'ma-1' } }, crm([m], katalog))).toEqual([
      { prozessId: PZ, leistungId: 'p-haupt', rolle: 'haupt' }, { prozessId: PZ2, leistungId: 'p-zusatz', rolle: 'zusatz' },
    ]);
    const gleich = mandat('ma-2', { leistungId: 'p-haupt', zusatz: [{ id: 'mz-3', leistungId: 'p-haupt' }] });
    expect(produktStarts({ art: 'mandat-angelegt', bezug: { mandatId: 'ma-2' } }, crm([gleich], katalog))).toHaveLength(1);
  });
  it('„Zusatzmodul gebucht“: nur das Produkt des Moduls, solange es am Mandat hängt und das Mandat nicht beendet ist', () => {
    const m = mandat('ma-1', { leistungId: 'p-haupt', zusatz: [{ id: 'mz-1', leistungId: 'p-zusatz' }] });
    expect(produktStarts({ art: 'zusatz-gebucht', bezug: { mandatId: 'ma-1', leistungId: 'p-zusatz' } }, crm([m], katalog))).toEqual([{ prozessId: PZ2, leistungId: 'p-zusatz', rolle: 'zusatz' }]);
    expect(produktStarts({ art: 'zusatz-gebucht', bezug: { mandatId: 'ma-1', leistungId: 'p-haupt' } }, crm([m], katalog))).toEqual([]);
    expect(produktStarts({ art: 'zusatz-gebucht', bezug: { mandatId: 'ma-1', leistungId: 'p-zusatz' } }, crm([{ ...m, status: 'beendet' }], katalog))).toEqual([]);
  });
  it('nichts: ohne Bindung, Produkt im Papierkorb, Mandat weg bzw. im Papierkorb, andere Ereignisse', () => {
    const m = mandat('ma-1', { leistungId: 'p-ohne', zusatz: [{ id: 'mz-9', leistungId: 'p-weg' }] });
    expect(produktStarts({ art: 'mandat-angelegt', bezug: { mandatId: 'ma-1' } }, crm([m], katalog))).toEqual([]);
    expect(produktStarts({ art: 'mandat-angelegt', bezug: { mandatId: 'ma-x' } }, crm([m], katalog))).toEqual([]);
    expect(produktStarts({ art: 'mandat-angelegt', bezug: { mandatId: 'ma-1' } }, crm([{ ...m, leistungId: 'p-haupt', geloeschtAm: J } as Mandat], katalog))).toEqual([]);
    expect(produktStarts({ art: 'mandat-beendet', bezug: { mandatId: 'ma-1' } }, crm([{ ...m, leistungId: 'p-haupt' }], katalog))).toEqual([]);
  });
  it('bestehende Fälle beim Scharfschalten: nur aktive Mandate, deren Haupt- oder Zusatzprodukt auf den Prozess zeigt', () => {
    const l = [mandat('ma-a', { leistungId: 'p-haupt' }), mandat('ma-b', { leistungId: 'p-ohne', zusatz: [{ id: 'mz-1', leistungId: 'p-haupt' }] }), mandat('ma-c', { leistungId: 'p-haupt', status: 'beendet' }), mandat('ma-d', { leistungId: 'p-ohne' })];
    expect(produktMandate(PZ, crm(l, katalog)).map(x => [x.mandat.id, x.rolle])).toEqual([['ma-a', 'haupt'], ['ma-b', 'zusatz']]);
  });
});

describe('Ereignis „Zusatzmodul gebucht“ (CRM-Diff) — und das Anlegen bleibt bit-gleich', () => {
  const c = (mandate: Mandat[]): Pick<CrmBestand, 'chancen' | 'firmen' | 'mandate'> => ({ chancen: [], firmen: [], mandate });
  it('neues Mandat (auch mit Zusatzmodulen): genau EIN Ereignis „mandat-angelegt“ wie bisher — kein „zusatz-gebucht“', () => {
    const neu = crmDiff(c([]), c([mandat('ma-1', { leistungId: 'p-haupt', zusatz: [{ id: 'mz-1', leistungId: 'p-zusatz' }] })]));
    expect(neu).toEqual([{ id: neu[0].id, art: 'mandat-angelegt', quelle: 'crm', bereich: 'business', bezug: { mandatId: 'ma-1', firmaId: 'f-1', kontaktId: 'c-1' } }]);
  });
  it('neues Modul an einem bestehenden Mandat → je Modul einmal, mit Produkt im Bezug; dieselbe Lage → dieselbe Kennung', () => {
    const vorher = mandat('ma-1', { zusatz: [{ id: 'mz-1', leistungId: 'p-a' }] });
    const nachher = mandat('ma-1', { zusatz: [{ id: 'mz-1', leistungId: 'p-a' }, { id: 'mz-2', leistungId: 'p-zusatz' }] });
    const l = crmDiff(c([vorher]), c([nachher]));
    expect(l).toEqual([expect.objectContaining({ art: 'zusatz-gebucht', quelle: 'crm', bereich: 'business', bezug: { mandatId: 'ma-1', firmaId: 'f-1', kontaktId: 'c-1', leistungId: 'p-zusatz' } })]);
    expect(crmDiff(c([vorher]), c([nachher]))[0].id).toBe(l[0].id);
    expect(crmDiff(c([nachher]), c([nachher]))).toEqual([]);
    expect(crmDiff(c([vorher]), c([{ ...nachher, status: 'beendet' }])).map(e => e.art)).toEqual(['mandat-beendet']);
    // Die Selbstständigkeit gehört zu Privat — das Ereignis sagt es (der Motor startet auf Privates nie).
    expect(crmDiff(c([{ ...vorher, gesellschaft: 'kdc' }]), c([{ ...nachher, gesellschaft: 'kdc' }]))[0].bereich).toBe('privat');
  });
  it('angebunden, benannt, Prozess-Auslöser; die Ereignisstelle hält das Produkt im Bezug', () => {
    expect(EREIGNISSE_ANGEBUNDEN).toContain('zusatz-gebucht');
    expect(PROZESS_EREIGNISSE).toContain('zusatz-gebucht');
    expect(EREIGNIS_NAME['zusatz-gebucht']).toBe('Zusatzmodul gebucht');
    expect(EREIGNIS_FELDER.some(f => f.id === 'bezug.leistungid')).toBe(true);
    expect(eingabeSauber({ id: 'crm:mandat:ma-1:zusatz:mz-2', art: 'zusatz-gebucht', quelle: 'crm', bezug: { mandatId: 'ma-1', leistungId: 'p-zusatz' }, bereich: 'business' }, istEreignisArt)?.bezug).toEqual({ mandatId: 'ma-1', leistungId: 'p-zusatz' });
  });
});

describe('Produkt: Verweis auf den Prozess (CRM-Säuberer, Prüfung)', () => {
  const roh = (x: Record<string, unknown> = {}) => ({ ...produkt('p-1'), ...x }) as unknown as Record<string, unknown>;
  it('ohne Verweis bit-gleich (kein neues Feld); mit gültigem Verweis gespeichert; Unsinn bzw. null fällt weg', () => {
    const ohne = saeubern('leistungen', roh(), J, 'pia')!;
    expect(Object.keys(ohne)).not.toContain('prozessId');
    expect(saeubern('leistungen', roh({ prozessId: PZ }), J, 'pia')).toEqual({ ...ohne, prozessId: PZ });
    for (const x of ['fp-paket', 'pz-kaputt', 42, null, '']) expect(saeubern('leistungen', roh({ prozessId: x }), J, 'pia'), String(x)).toEqual(ohne);
  });
  it('über den CRM-Schreibweg (Produktkarte, `teil`): setzen, Unsinn → 400 (nichts gespeichert), null löst', () => {
    const b = { ...leererBestand(), leistungen: [produkt('p-1', { status: 'entwurf' })] };
    const ja = wendeCrmAn(b, [{ liste: 'leistungen', op: 'teil', id: 'p-1', felder: { prozessId: PZ } }], J, 'pia');
    expect(ja.bestand.leistungen[0].prozessId).toBe(PZ);
    const nein = wendeCrmAn(ja.bestand, [{ liste: 'leistungen', op: 'teil', id: 'p-1', felder: { prozessId: 'fp-paket' } }], J, 'pia');
    expect(nein.ungueltig?.[0]).toMatch(/Kennung aus der Werkstatt/);
    expect(nein.bestand.leistungen[0].prozessId).toBe(PZ);
    const weg = wendeCrmAn(ja.bestand, [{ liste: 'leistungen', op: 'teil', id: 'p-1', felder: { prozessId: null } }], J, 'pia');
    expect('prozessId' in weg.bestand.leistungen[0]).toBe(false);
  });
  it('kein Karten-Feld: die Treppe rechnet weiter wie vorher', () => {
    expect(istKarte(produkt('p-1', { prozessId: PZ }))).toBe(false);
  });
  it('Prüfung: nur pz-… (400 sonst), null löst den Verweis', () => {
    expect(produktProzessKennung(PZ)).toBe(PZ);
    expect(produktProzessKennung('pz-1')).toBeUndefined();
    expect(produktPruefen({ prozessId: 'fp-paket' })).toEqual([{ status: 400, text: 'Prozess: eine Kennung aus der Werkstatt (pz-…).' }]);
    expect(produktPruefen({ prozessId: null })).toEqual([]);
    expect(produktPruefen({ prozessId: PZ })).toEqual([]);
  });
});

describe('Sicht: welche Produkte gehören zu einem Prozess', () => {
  const katalog = [produkt('p-1', { name: 'Diagnose', prozessId: PZ }), produkt('p-2', { name: 'Begleitung' }), produkt('p-3', { name: 'Altprodukt', prozessId: PZ, geloeschtAm: J })];
  it('Werkstatt über prozessId, Paket über die Zuordnung — ohne Papierkorb', () => {
    expect(produkteVonProzess(katalog, PZ)).toEqual([{ id: 'p-1', name: 'Diagnose' }]);
    expect(produkteVonVorlage(katalog, { 'p-2': { vorlageId: 'fp-x' }, 'p-3': { vorlageId: 'fp-x' } }, 'fp-x')).toEqual([{ id: 'p-2', name: 'Begleitung' }]);
  });
  it('Kachel: „für <Produkt>“ nur, wenn der Titel es nicht schon sagt (jede Information einmal)', () => {
    expect(produktZeile('Diagnose', [{ id: 'p-1', name: 'Diagnose' }])).toBeNull();
    expect(produktZeile('Diagnose liefern', [{ id: 'p-1', name: 'Diagnose' }])).toBe('für Diagnose');
    expect(produktZeile('Liefern', [{ id: 'p-1', name: 'Diagnose' }, { id: 'p-2', name: 'Begleitung' }])).toBe('für Diagnose und 1 weitere');
    const p = { titel: 'Liefern', quelle: 'werkstatt' as const, steckbrief: { ausloeser: '', eingang: '', ergebnis: '', empfaenger: '', eigner: 'noch offen' } };
    expect(kachelTexte({ ...p, produkte: [{ id: 'p-1', name: 'Diagnose', href: '/os/mandate?s=produkte&k=p-1' }] }, undefined, 'mittel')).toMatchObject({ titel: 'Liefern', produkt: 'für Diagnose' });
    // Ohne Produkt bleibt die Kachel wie bisher (kein neuer Schlüssel).
    expect(Object.keys(kachelTexte(p, undefined, 'mittel'))).toEqual(['titel']);
    expect(Object.keys(kachelTexte({ ...p, produkte: [{ id: 'p-1', name: 'Diagnose', href: '' }] }, undefined, 'fern'))).toEqual(['titel']);
  });
});

describe('Fulfillment-Kandidaten: „Dort ausblenden“ (Kevin 22.10.) — EINE Regel', () => {
  const katalog = [produkt('p-haupt', { prozessId: PZ }), produkt('p-zusatz', { rolle: 'zusatz', prozessId: PZ2 }), produkt('p-paket')];
  const lauf = (mandatId: string, prozessId: string, status: 'laeuft' | 'wartet' | 'fertig' | 'abgebrochen' = 'wartet') => ({ prozessId, fall: { art: 'mandat' as const, id: mandatId }, status });
  const mandate = [
    mandat('m-haupt', { leistungId: 'p-haupt', vertragUnterschrieben: true }), mandat('m-ohne-lauf', { leistungId: 'p-haupt', vertragUnterschrieben: true }),
    mandat('m-paket', { leistungId: 'p-paket', vertragUnterschrieben: true, zusatz: [{ id: 'mz-1', leistungId: 'p-zusatz' }] }), mandat('m-ab', { leistungId: 'p-haupt', vertragUnterschrieben: true }),
    mandat('m-fertig', { leistungId: 'p-haupt', vertragUnterschrieben: true }),
  ];
  it('Lauf des Prozesses des HAUPTprodukts (scharf oder Schatten, auch fertig) → ausgeblendet; abgebrochen, nur Zusatz-Lauf, ohne Lauf → nicht', () => {
    const l = [lauf('m-haupt', PZ), lauf('m-paket', PZ2), lauf('m-ab', PZ, 'abgebrochen'), lauf('m-fertig', PZ, 'fertig'), lauf('m-fremd', PZ)];
    expect([...mandateMitProduktLauf(l, { mandate, leistungen: katalog })].sort()).toEqual(['m-fertig', 'm-haupt']);
    // Ein Lauf eines anderen Prozesses (z. B. eigener Auslöser „Mandat angelegt“ ohne Bindung) ist nicht der Ablauf des Produkts.
    expect([...mandateMitProduktLauf([lauf('m-haupt', PZ2)], { mandate, leistungen: katalog })]).toEqual([]);
    expect(mandateMitProduktLauf([], { mandate, leistungen: katalog }).size).toBe(0);
  });
  it('onboardingKandidaten: mit der Menge fehlen genau diese Mandate; ohne Menge bzw. leer bit-gleich wie vorher', () => {
    const c = { mandate, angebote: [], chancen: [] };
    const vorher = onboardingKandidaten(c, {}, {}, '2026-10-22');
    expect(vorher.map(k => k.mandatId).sort()).toEqual(['m-ab', 'm-fertig', 'm-haupt', 'm-ohne-lauf', 'm-paket']);
    expect(onboardingKandidaten(c, {}, {}, '2026-10-22', new Set())).toEqual(vorher);
    const menge = mandateMitProduktLauf([lauf('m-haupt', PZ), lauf('m-fertig', PZ, 'fertig')], { mandate, leistungen: katalog });
    const danach = onboardingKandidaten(c, {}, {}, '2026-10-22', menge);
    expect(danach.map(k => k.mandatId).sort()).toEqual(['m-ab', 'm-ohne-lauf', 'm-paket']);
    expect(danach).toEqual(vorher.filter(k => !menge.has(k.mandatId)));
  });
});

