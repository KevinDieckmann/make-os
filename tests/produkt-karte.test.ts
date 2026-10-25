// ─── Produkte & Mandate · „Ein Produkt, eine Karte“ (P1 Kern, 19.10.) ─────────────────────────────────────────────────
// Erfundene Produkte, Preise und Namen — nie echte Inhalte einer Instanz (Plattform-Regel). Geprüft wird:
//   · jede Preis-Form des Konzepts (kostenlos, fest, monatlich mit Mindestlaufzeit, einmalig + je Event 50/50, jährlich mit Kontingent,
//     Tages- und Stundensatz mit Deckel, Erfolg) — Text, Hauptpreis, Angebot, Planung, Mandat
//   · Prüfen 400/413 (nie gekürzt), Säubern und Spiegeln der alten Felder
//   · Altbestand ohne neue Felder bleibt bit-gleich: Angebots-Position, Finanzplan-Baustein, Kapazität, Treppe, Mandat
//   · Treppe = Ansicht der Karten: Stufe + Karte zusammengeführt (Karte gewinnt, Kennung bleibt), Stufe ohne Produkt, neue Stufen
import { describe, it, expect } from 'vitest';
import {
  preisteileVon, hauptpreis, preisText, preiseText, vertragVon, produktKarte, stufenAusKatalog, stufenOhneProdukt, katalogTreppe, katalogStufeId,
  treppeMitKatalog, mandatVorlageAusProdukt, angebotPositionenAusProdukt, kapazitaetStundenWoche, planBausteinAusProdukt, preisteilPruefen,
  produktPruefen, pruefStatus, produktSpiegeln, kartenFelderSaeubern, mandatZusatzSaeubern, istKarte, istKostenlos, honorarAusPreis,
  mandatVertragAusProdukt, spiegelKonflikt, PRODUKT_GRENZEN, type PreisTeil,
} from '@/lib/crm/produkt-karte';
import { positionAusProdukt, mandatVorbelegung } from '@/lib/crm/angebote';
import { produktVorschlaege, planungFehlt, produktEinheit, margeVon } from '@/lib/finanzen/produkte';
import { kundenZeilen, zielbild, kapaBedarf, stufeStundenWoche, stufeVonMandat } from '@/lib/crm/treppe';
import { treppeAus, treppeAnwenden, type TreppeDatei, type AnwendenKontext } from '@/lib/crm/treppe-daten';
import { mandatEntwurf } from '@/lib/crm/mandat-anlegen';
import { saeubern, wendeCrmAn, leererBestand } from '@/lib/crm/speicher';
import type { Angebot, CrmBestand, Leistung, Mandat } from '@/lib/crm/typen';

const J = '2026-10-19T08:00:00.000Z';
const HEUTE = '2026-10-19';
const leistung = (x: Partial<Leistung>): Leistung => ({ id: 'l-a', name: 'Produkt A', typ: 'retainer', stufe: 'kern', preis: { betrag: 1000, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J, ...x } as Leistung);
const mandat = (x: Partial<Mandat>): Mandat => ({
  id: 'm-a', kunde: 'Beispiel GmbH', kontaktIds: ['c-a'], titel: 'Begleitung', art: 'retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-08-01', verlaengerung: 'auto', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
  ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
} as Mandat);
const teil = (x: Partial<PreisTeil>): PreisTeil => ({ id: 'pt-1', art: 'fest', rolle: 'grund', ...x } as PreisTeil);

// ── Die Preis-Formen des Konzepts (Werte erfunden) ────────────────────────────────────────────────────────────────────

const CHECK = leistung({ id: 'l-check', name: 'Kennzahlen-Check', typ: 'diagnose', preise: [teil({ art: 'kostenlos' })], ebene: 1 });
const WORKSHOP = leistung({ id: 'l-ws', name: 'Klarheitstag', typ: 'workshop', preise: [teil({ art: 'fest', betragCent: 480_000 })], regeln: { anrechnung: { auf: ['l-hos'], anteilProzent: 100 } } });
const HOS = leistung({
  id: 'l-hos', name: 'Vertriebsleitung auf Zeit', angebot: { leistungstext: 'Führung des Vertriebs.' }, lieferumfang: ['Wochenplan', 'Pipeline-Review'],
  preise: [teil({ id: 'pt-mon', art: 'monatlich', betragCent: 250_000 }), teil({ id: 'pt-bonus', art: 'erfolg', text: 'Bonus bei Zielen' })],
  vertrag: { mindestlaufzeitMonate: 6, danach: 'monatlich_kuendbar', kuendigungsfristTage: 30, zahlungszielTage: 10 }, regeln: { maxGleichzeitig: 2 }, aufwandStundenWoche: 8,
});
const EVENT = leistung({
  id: 'l-event', name: 'Messebegleitung', typ: 'vermittlung',
  preise: [teil({ id: 'pt-auf', art: 'fest', betragCent: 500_000, zahlplan: { anzahlungProzent: 50 } }), teil({ id: 'pt-je', art: 'je_einheit', betragCent: 150_000, einheit: 'je Event', rolle: 'option', zahlplan: { anzahlungProzent: 50 } })],
});
const KI = leistung({ id: 'l-ki', name: 'Assistent', typ: 'software', preise: [teil({ id: 'pt-jahr', art: 'jaehrlich', betragCent: 1_200_000, kontingent: '1.000 Anfragen' }), teil({ id: 'pt-mehr', art: 'je_einheit', betragCent: 5_000, einheit: '100 Anfragen', rolle: 'option' })], vertrag: { mindestlaufzeitMonate: 12 } });
const TAG = leistung({ id: 'l-tag', name: 'Beratungstag', typ: 'sprint', preise: [teil({ art: 'tagessatz', betragCent: 140_000 })], vertrag: { reisekosten: 'separat' } });
const STUNDE = leistung({ id: 'l-std', name: 'Sparring', typ: 'sprint', preise: [teil({ art: 'stundensatz', betragCent: 18_000, deckel: { stundenJeMonat: 20 } })] });
const PROJEKT = leistung({ id: 'l-proj', name: 'Umsetzungsprojekt', typ: 'sprint', preise: [teil({ id: 'pt-fest', art: 'fest', betragCent: 900_000 }), teil({ id: 'pt-erf', art: 'erfolg', text: 'Erfolgsbeteiligung ab 2. Vertrag' })] });

describe('Preis-Formen: Text, Hauptpreis, kombinierbar', () => {
  it('kostenlos', () => {
    expect(preiseText(CHECK)).toBe('kostenlos');
    expect(istKostenlos(CHECK)).toBe(true);
    expect(hauptpreis(CHECK)?.art).toBe('kostenlos');
    expect(planBausteinAusProdukt(CHECK)).toMatchObject({ preis: 0, basis: 'einmalig', fehlt: [] });
  });
  it('Festpreis, angerechnet auf ein anderes Produkt', () => {
    expect(preiseText(WORKSHOP)).toBe('4.800 € netto einmalig');
    expect(produktKarte(WORKSHOP, null, [WORKSHOP, HOS]).regeln.anrechnungText).toBe('voll angerechnet auf Vertriebsleitung auf Zeit');
  });
  it('monatlich mit Mindestlaufzeit, Bonus bei Zielen, höchstens 2 gleichzeitig', () => {
    expect(preiseText(HOS)).toBe('2.500 € netto/Monat · Bonus bei Zielen');
    expect(hauptpreis(HOS)?.id).toBe('pt-mon');
    expect(vertragVon(HOS).mindestlaufzeitMonate).toBe(6);
    const k = produktKarte(HOS);
    expect(k).toMatchObject({ istKarte: true, rolle: 'haupt', regeln: { maxGleichzeitig: 2, bonus: 'Bonus bei Zielen' }, aufwand: { stunden: 8, annahme: false } });
  });
  it('einmalig + je Event (Option), Zahlung 50/50', () => {
    expect(preiseText(EVENT)).toBe('5.000 € netto einmalig · Zahlung 50/50 · optional: 1.500 € netto je Event · Zahlung 50/50');
    expect(preisteileVon(EVENT).map(t => t.rolle)).toEqual(['grund', 'option']);
  });
  it('jährlich mit Kontingent und Mehrverbrauch', () => {
    expect(preiseText(KI)).toBe('12.000 € netto/Jahr · inkl. 1.000 Anfragen · optional: 50 € netto je 100 Anfragen');
    expect(planBausteinAusProdukt(KI)).toMatchObject({ preis: 12_000, basis: 'jahr', rhythmus: 'jaehrlich', laufzeit: 12, einheit: 'Jahr netto', fehlt: [] });
  });
  it('Tagessatz und Stundensatz (gedeckelt)', () => {
    expect(preiseText(TAG)).toBe('1.400 € netto/Tag');
    expect(preiseText(STUNDE)).toBe('180 € netto/Stunde · höchstens 20 Std./Monat');
  });
  it('Festpreis + Erfolgsbeteiligung; Cent und „bis“ im Text; Preis offen', () => {
    expect(preiseText(PROJEKT)).toBe('9.000 € netto einmalig · Erfolgsbeteiligung ab 2. Vertrag');
    expect(preisText(teil({ art: 'monatlich', betragCent: 123_450, bisCent: 200_000 }))).toBe('1.234,50–2.000 € netto/Monat');
    expect(preisText(teil({ art: 'fest' }))).toBe('Festpreis offen');
  });
  it('ohne Preis-Teile: ein Teil aus dem alten Preis (Monat, Jahr, Tag, kostenlos, offen)', () => {
    expect(preisteileVon(leistung({ preis: { betrag: 1500, einheit: 'Monat netto' } }))).toEqual([{ id: 'pt-preis', art: 'monatlich', betragCent: 150_000, rolle: 'grund' }]);
    expect(preisteileVon(leistung({ preis: { betrag: 9000, einheit: 'Jahr', basis: 'jahr' } }))[0].art).toBe('jaehrlich');
    expect(preisteileVon(leistung({ preis: { betrag: 1200, einheit: 'Tag netto' } }))[0].art).toBe('tagessatz');
    expect(preisteileVon(leistung({ preis: { betrag: 0, einheit: 'kostenlos' } }))[0].art).toBe('kostenlos');
    expect(preiseText(leistung({ preis: { betrag: 0, einheit: 'Monat netto' } }))).toBe('monatlich, Preis offen');
    expect(istKarte(leistung({}))).toBe(false);
  });
});

describe('Prüfen: 400 Unsinn, 413 zu groß — nie still gekürzt', () => {
  const fehler = (f: Record<string, unknown>) => produktPruefen(f, { id: 'l-x', bekannt: id => ['l-a', 'l-hos'].includes(id) });
  it('gültige Karten-Felder: keine Fehler; null = leeren ist erlaubt', () => {
    for (const l of [CHECK, WORKSHOP, HOS, EVENT, KI, TAG, STUNDE, PROJEKT]) {
      const { preise, vertrag, regeln, aufwandStundenWoche, ebene } = l;
      expect(produktPruefen({ preise, vertrag, regeln, aufwandStundenWoche, ebene }, { id: l.id, bekannt: () => true }), l.name).toEqual([]);
    }
    expect(fehler({ preise: null, vertrag: null, ziel: null })).toEqual([]);
  });
  it('Preis-Teil: unbekannte Art, Betrag bei kostenlos, Einheit/Deckel an der falschen Form, Bruchteile von Cent, Zahlplan 100 %', () => {
    expect(preisteilPruefen({ art: 'quatsch' })[0].status).toBe(400);
    expect(preisteilPruefen({ art: 'kostenlos', betragCent: 100 }).map(f => f.status)).toEqual([400]);
    expect(preisteilPruefen({ art: 'fest', einheit: 'je Event' }).length).toBe(1);
    expect(preisteilPruefen({ art: 'monatlich', deckel: { stundenJeMonat: 10 } }).length).toBe(1);
    expect(preisteilPruefen({ art: 'fest', betragCent: 10.5 }).length).toBe(1);
    expect(preisteilPruefen({ art: 'fest', betragCent: 100, zahlplan: { anzahlungProzent: 100 } }).length).toBe(1);
    expect(preisteilPruefen({ art: 'fest', betragCent: 100, bisCent: 50 }).length).toBe(1);
  });
  it('zu lang bzw. zu viele → 413; ohne Grund-Teil, doppelte Kennung, Anrechnung auf sich selbst/Unbekanntes → 400', () => {
    expect(pruefStatus(fehler({ preise: [teil({ text: 'x'.repeat(PRODUKT_GRENZEN.text + 1) })] }))).toBe(413);
    expect(pruefStatus(fehler({ preise: Array.from({ length: PRODUKT_GRENZEN.preise + 1 }, (_, i) => teil({ id: `pt-${i}` })) }))).toBe(413);
    expect(pruefStatus(fehler({ aufgabe: 'x'.repeat(PRODUKT_GRENZEN.aufgabe + 1) }))).toBe(413);
    expect(pruefStatus(fehler({ preise: [teil({ rolle: 'option' })] }))).toBe(400);
    expect(pruefStatus(fehler({ preise: [teil({}), teil({})] }))).toBe(400);
    expect(pruefStatus(fehler({ regeln: { anrechnung: { auf: ['l-x'], anteilProzent: 100 } } }))).toBe(400);
    expect(pruefStatus(fehler({ regeln: { anrechnung: { auf: ['l-weg'], anteilProzent: 100 } } }))).toBe(400);
    expect(pruefStatus(fehler({ regeln: { inklusive: [{ leistungId: 'l-a', menge: 1, je: 'woche' }] } }))).toBe(400);
    expect(pruefStatus(fehler({ vertrag: { ustSatz: 16 } }))).toBe(400);
    expect(pruefStatus(fehler({ ebene: 13 }))).toBe(400);
  });
  it('über den Server-Weg: 400 als `ungueltig`, 413 als `grenze`, Bestand unverändert', () => {
    const b: CrmBestand = { ...leererBestand(), leistungen: [leistung({})] };
    const r1 = wendeCrmAn(b, [{ liste: 'leistungen', op: 'teil', id: 'l-a', felder: { preise: [{ art: 'quatsch' }] } }], J, 'pa');
    expect(r1.ungueltig?.length).toBe(1);
    expect(r1.bestand).toBe(b);
    const r2 = wendeCrmAn(b, [{ liste: 'leistungen', op: 'teil', id: 'l-a', felder: { preise: Array.from({ length: 13 }, (_, i) => ({ id: `pt-${i}`, art: 'fest', rolle: 'grund' })) } }], J, 'pa');
    expect(r2.grenze.length).toBe(1);
    expect(r2.bestand).toBe(b);
  });
});

describe('Säubern und Spiegeln (Server)', () => {
  it('Karte → preis, laufzeitMonate, aufwand.stunden gespiegelt; Karten-Felder bleiben', () => {
    const roh = { ...HOS, preis: { betrag: 1, einheit: 'irgendwas' }, aufwand: { anteil: 0.3 } } as unknown as Record<string, unknown>;
    const s = saeubern('leistungen', roh, J, 'pa') as unknown as Leistung;
    expect(s.preis).toEqual({ betrag: 2500, einheit: 'Monat netto', basis: 'monat' });
    expect(s.laufzeitMonate).toBe(6);
    expect(s.aufwand).toEqual({ anteil: 0.3, stunden: 34.67 });
    expect(s.preise).toEqual(HOS.preise);
    expect(s.vertrag).toEqual(HOS.vertrag);
    expect(s.aufwandStundenWoche).toBe(8);
  });
  it('kostenlos und je Einheit spiegeln lesbar; Säubern vergibt fehlende Kennungen', () => {
    expect(produktSpiegeln(CHECK).preis).toEqual({ betrag: 0, einheit: 'kostenlos', basis: 'einmalig' });
    expect(produktSpiegeln(leistung({ preise: [teil({ art: 'je_einheit', betragCent: 1000, einheit: 'Seat' })] })).preis).toEqual({ betrag: 10, einheit: 'je Seat netto', basis: 'einmalig' });
    expect(kartenFelderSaeubern({ preise: [{ art: 'fest', betragCent: 100 }, { art: 'erfolg' }, { art: 'quatsch' }] }).preise).toEqual([
      { id: 'pt-1', art: 'fest', betragCent: 100, rolle: 'grund' }, { id: 'pt-2', art: 'erfolg', rolle: 'grund' },
    ]);
  });
  it('Altbestand ohne Karten-Felder: bit-gleich (gleiche Schlüssel in gleicher Reihenfolge, dasselbe Objekt beim Spiegeln)', () => {
    const alt = { id: 'l-alt', name: 'Alt', typ: 'retainer', stufe: 'kern', preis: { betrag: 1500, einheit: 'Monat netto' }, laufzeitMonate: 6, aufwand: { anteil: 0.2, stunden: 10 }, lieferumfang: ['A'], gesellschaft: 'ug', status: 'aktiv', geaendert: 'x' };
    const s = saeubern('leistungen', alt, J, 'pa')!;
    expect(Object.keys(s)).toEqual(['id', 'name', 'typ', 'stufe', 'preis', 'laufzeitMonate', 'aufwand', 'lieferumfang', 'gesellschaft', 'status', 'geaendert', 'geaendertVon']);
    expect(s.preis).toEqual({ betrag: 1500, einheit: 'Monat netto' });
    expect(kartenFelderSaeubern(alt)).toEqual({});
    const l = leistung({});
    expect(produktSpiegeln(l)).toBe(l);
  });
  it('alte Oberfläche ändert das gespiegelte Feld einer Karte → 409 mit Text, nichts still verloren', () => {
    const karte = produktSpiegeln(HOS);
    expect(spiegelKonflikt(karte, { preis: { ...karte.preis, betrag: 1 } })).toMatch(/Preis-Teile/);
    expect(spiegelKonflikt(karte, { preis: { ...karte.preis } })).toBeNull();
    expect(spiegelKonflikt(karte, { laufzeitMonate: 3 })).toMatch(/Mindestlaufzeit/);
    expect(spiegelKonflikt(leistung({}), { preis: { betrag: 5, einheit: 'Monat netto' } })).toBeNull();
    const b: CrmBestand = { ...leererBestand(), leistungen: [karte] };
    expect(wendeCrmAn(b, [{ liste: 'leistungen', op: 'teil', id: karte.id, felder: { preis: { betrag: 1, einheit: 'Monat netto' } } }], J, 'pa').abgelehnt?.length).toBe(1);
  });
  it('Zusatzmodule am Mandat: gesäubert gespeichert, Kaputtes fällt weg', () => {
    const roh = { ...mandat({}), zusatz: [{ id: 'mz-1', leistungId: 'l-event', honorar: { betragCent: 150_000, basis: 'einheit' } }, { id: 'mz-2', leistungId: 'l-x', inklusive: true, menge: 1, je: 'quartal' }, { id: 'kaputt', leistungId: 'l-y' }] } as unknown as Record<string, unknown>;
    const s = saeubern('mandate', roh, J, 'pa') as unknown as Mandat;
    expect(s.zusatz).toEqual([{ id: 'mz-1', leistungId: 'l-event', honorar: { betragCent: 150_000, basis: 'einheit' } }, { id: 'mz-2', leistungId: 'l-x', inklusive: true, menge: 1, je: 'quartal' }]);
    expect('zusatz' in (saeubern('mandate', mandat({}) as unknown as Record<string, unknown>, J, 'pa') ?? {})).toBe(false);
    expect(mandatZusatzSaeubern([])).toBeUndefined();
  });
});

describe('Angebot: Positionen aus der Karte', () => {
  it('monatlich + Erfolg: eine Position mit Laufzeit, der Erfolg als Satz im Text; USt aus dem Vertrag', () => {
    const p = angebotPositionenAusProdukt(HOS, [], { idBasis: 'p-1' });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ id: 'p-1', leistungId: 'l-hos', titel: 'Vertriebsleitung auf Zeit', menge: 1, einheit: 'Monat', einzelpreisCent: 250_000, ustSatz: 19, basis: 'monat', laufzeitMonate: 6 });
    // 24.10. (Bau-Test, Reibung): der Lieferumfang der Karte steht im Angebot.
    expect(p[0].text).toBe('Führung des Vertriebs.\n\n• Wochenplan\n• Pipeline-Review\n\nZusätzlich: Bonus bei Zielen.');
    expect(angebotPositionenAusProdukt(HOS, [], { kleinunternehmer: true })[0].ustSatz).toBe(0);
  });
  it('einmalig + je Event: die Option nur, wenn gewählt — mit eigener Einheit und Zahlplan', () => {
    expect(angebotPositionenAusProdukt(EVENT)).toHaveLength(1);
    const p = angebotPositionenAusProdukt(EVENT, ['pt-je'], { idBasis: 'p-7' });
    expect(p.map(x => [x.id, x.einheit, x.einzelpreisCent, x.basis])).toEqual([['p-7', 'pauschal', 500_000, 'einmalig'], ['p-7-2', 'Event', 150_000, 'einmalig']]);
    expect(p[1].titel).toBe('Messebegleitung · je Event');
    expect(p[1].text).toBe('Zahlung 50 % bei Auftrag, 50 % bei Abschluss.');
  });
  it('Tagessatz mit Reisekosten separat, kostenlos als 0-€-Position, nur Erfolg → 0-€-Position mit Satz', () => {
    const t = angebotPositionenAusProdukt(TAG)[0];
    expect(t).toMatchObject({ einheit: 'Tag', einzelpreisCent: 140_000 });
    expect(t.text).toContain('Reisekosten werden separat abgerechnet.');
    expect(angebotPositionenAusProdukt(CHECK)[0]).toMatchObject({ einzelpreisCent: 0, basis: 'einmalig' });
    const erfolg = angebotPositionenAusProdukt(leistung({ preise: [teil({ art: 'erfolg', text: 'Provision' })] }));
    expect(erfolg).toHaveLength(1);
    expect(erfolg[0].text).toContain('Zusätzlich: Provision.');
  });
  it('Altbestand: dieselbe Position wie bis 19.10. (Monat, Jahr ohne Basis, Tag, ohne Einheit, ohne Text)', () => {
    const l = leistung({ id: 'l-r', name: 'Retainer', preis: { betrag: 1500, einheit: 'Monat netto' }, laufzeitMonate: 6, angebot: { leistungstext: 'Text', titel: 'Begleitung' } });
    expect(positionAusProdukt(l, 'p-1')).toEqual({ id: 'p-1', leistungId: 'l-r', titel: 'Begleitung', text: 'Text', menge: 1, einheit: 'Monat', einzelpreisCent: 150_000, ustSatz: 19, basis: 'monat', laufzeitMonate: 6 });
    expect(angebotPositionenAusProdukt(l, [], { idBasis: 'p-1' })).toEqual([positionAusProdukt(l, 'p-1')]);
    expect(positionAusProdukt(leistung({ preis: { betrag: 9000, einheit: 'p. a.' }, laufzeitMonate: 24 }), 'p-2')).toMatchObject({ einheit: 'Jahr', basis: 'jahr', einzelpreisCent: 900_000, laufzeitMonate: 24 });
    expect(positionAusProdukt(leistung({ preis: { betrag: 1200, einheit: 'Tag netto' }, laufzeitMonate: 3, lieferumfang: ['Workshop'] }), 'p-3')).toEqual({
      id: 'p-3', leistungId: 'l-a', titel: 'Produkt A', text: '• Workshop', menge: 1, einheit: 'pauschal', einzelpreisCent: 120_000, ustSatz: 19, basis: 'einmalig',
    });
    expect(positionAusProdukt(leistung({ preis: { betrag: 700, einheit: 'Paket' } }), 'p-4', { kleinunternehmer: true })).toMatchObject({ einheit: 'pauschal', basis: 'einmalig', ustSatz: 0 });
  });
});

describe('Finanzplanung: Baustein aus der Karte; Altbestand bit-gleich', () => {
  const alt = [
    leistung({ id: 'l-m', name: 'A Monat', preis: { betrag: 1500, einheit: 'Monat netto' }, laufzeitMonate: 6, aufwand: { anteil: 0.25 } }),
    leistung({ id: 'l-t', name: 'B Tag', preis: { betrag: 1200, einheit: 'Tag netto' }, gesellschaft: 'kdv' }),
    leistung({ id: 'l-o', name: 'C offen', preis: { betrag: 0, einheit: 'Paket' }, gesellschaft: 'offen', status: 'entwurf' }),
    leistung({ id: 'l-k', name: 'D kostenlos', preis: { betrag: 0, einheit: 'kostenlos' } }),
    leistung({ id: 'l-j', name: 'E Jahr', preis: { betrag: 12_000, einheit: 'Lizenz', basis: 'jahr' } }),
  ];
  it('produktVorschlaege ohne Karten: dieselben Felder wie bis 19.10.', () => {
    expect(produktVorschlaege({ leistungen: alt }).map(p => [p.id, p.preis, p.einheit, p.basis, p.laufzeit, p.fehlt, p.planEinheit])).toEqual([
      ['l-m', 1500, 'Monat netto', 'monat', 6, [], 'ug'],
      ['l-t', 1200, 'Tag netto', 'einmalig', null, [], 'kdv'],
      ['l-k', 0, 'kostenlos', null, null, ['Basis (Monat · Jahr · einmalig)', 'Laufzeit'], 'ug'],
      ['l-j', 12_000, 'Lizenz', 'jahr', null, ['Laufzeit'], 'ug'],
      ['l-o', 0, 'Paket', null, null, ['Preis', 'Basis (Monat · Jahr · einmalig)', 'Laufzeit', 'Gesellschaft'], 'ug'],
    ]);
    expect(margeVon(alt[0])).toEqual({ kosten: 375, marge: 1125, anteil: 0.25 });
    expect(produktEinheit(alt[1])).toBe('Tag netto');
    expect(planungFehlt(alt[0])).toEqual([]);
  });
  it('mit Karte: Hauptpreis, Basis und Mindestlaufzeit; fehlende Laufzeit wird gemeldet', () => {
    const [p] = produktVorschlaege({ leistungen: [HOS] });
    expect(p).toMatchObject({ preis: 2500, einheit: 'Monat netto', basis: 'monat', laufzeit: 6, fehlt: [] });
    expect(planungFehlt(leistung({ preise: [teil({ art: 'monatlich', betragCent: 100 })] }))).toEqual(['Laufzeit']);
    expect(planungFehlt(leistung({ preise: [teil({ art: 'fest' })] }))).toEqual(['Preis']);
  });
});

describe('Kapazität', () => {
  it('Karte: Stunden je Woche; alt: je Preis-Einheit umgerechnet; sonst die verknüpfte Stufe; sonst nichts', () => {
    expect(kapazitaetStundenWoche(HOS)).toEqual({ stunden: 8, annahme: false });
    expect(kapazitaetStundenWoche(leistung({ aufwand: { stunden: 26 } }))).toEqual({ stunden: 6, annahme: false });
    expect(kapazitaetStundenWoche(leistung({ preis: { betrag: 3000, einheit: 'pauschal', basis: 'einmalig' }, aufwand: { stunden: 12 } }))).toEqual({ stunden: 3, annahme: true });
    const stufe = { aufwandStunden: 12, preis: { art: 'fest' as const, betrag: 3000 }, dauerTage: 21 };
    expect(kapazitaetStundenWoche(leistung({}), stufe)).toEqual({ stunden: 4, annahme: false });
    expect(kapazitaetStundenWoche(leistung({}))).toBeNull();
  });
  it('stufeStundenWoche der gespeicherten Stufen unverändert (Monat, Jahr, Dauer, Annahme)', () => {
    expect(stufeStundenWoche({ aufwandStunden: 26, preis: { art: 'monat' } })).toEqual({ stunden: (26 * 12) / 52, annahme: false });
    expect(stufeStundenWoche({ aufwandStunden: 52, preis: { art: 'jahr' } })).toEqual({ stunden: 1, annahme: false });
    expect(stufeStundenWoche({ aufwandStunden: 12, preis: { art: 'fest' }, dauerTage: 20 })).toEqual({ stunden: 12 / (20 / 7), annahme: false });
    expect(stufeStundenWoche({ aufwandStunden: 12, preis: { art: 'fest' } })).toEqual({ stunden: 3, annahme: true });
    expect(stufeStundenWoche({ preis: { art: 'fest' } })).toEqual({ stunden: 0, annahme: false });
    expect(stufeStundenWoche({ preis: { art: 'fest' }, wochenAufwand: { stunden: 5, annahme: false } })).toEqual({ stunden: 5, annahme: false });
  });
});

// ── Treppe = Ansicht der Karten ───────────────────────────────────────────────────────────────────────────────────────

/** Gespeicherte, erfundene Treppe: Einstieg ohne Produkt → Analyse (l-ana) → zwei Monatspakete (l-a; l-b und l-c gemeinsam). */
function gespeichert(): TreppeDatei {
  return treppeAus({
    zielJahr: 2026,
    stufen: [
      { id: 'ts-eins', name: 'Erstgespräch', ebene: 1, preis: { art: 'kostenlos' } },
      { id: 'ts-zwei', name: 'Analyse', ebene: 2, preis: { art: 'fest', betrag: 3000 }, dauerTage: 20, aufwandStunden: 12, lieferobjekte: ['Befund', 'Fahrplan'], leistungIds: ['l-ana'], ziel: { umsatz: 30000, kunden: 10 }, aufgabe: 'Lage klären' },
      { id: 'ts-drei', name: 'Paket operativ', ebene: 3, preis: { art: 'monat', betrag: 2000 }, aufwandStunden: 26, leistungIds: ['l-a'], regeln: { mindestlaufzeitMonate: 6, maxGleichzeitig: 1 } },
      { id: 'ts-vier', name: 'Paket strategisch', ebene: 3, preis: { art: 'monat', betrag: 4000 }, leistungIds: ['l-b', 'l-c', 'l-weg'] },
    ],
    kunden: { 'm-ana': { stufeId: 'ts-zwei', erledigt: [{ was: 'Befund', am: '2026-10-01', von: 'pa' }], verlauf: [{ stufeId: 'ts-zwei', ab: '2026-09-20' }], geaendert: J, geaendertVon: 'pa' } },
  }, 2026);
}
const ALT_KATALOG = [
  leistung({ id: 'l-ana', name: 'Analyse-Produkt', preis: { betrag: 3000, einheit: 'pauschal', basis: 'einmalig' } }),
  leistung({ id: 'l-a', name: 'Operativ', preis: { betrag: 2000, einheit: 'Monat netto' } }),
  leistung({ id: 'l-b', name: 'Strategisch B' }), leistung({ id: 'l-c', name: 'Strategisch C' }),
];
const MANDATE = [mandat({ id: 'm-ana', leistungId: 'l-ana', start: '2026-09-20', honorar: { betrag: 3000, basis: 'einmalig', netto: true } }), mandat({ id: 'm-a', leistungId: 'l-a' }), mandat({ id: 'm-b', leistungId: 'l-c', kunde: 'Zweite GmbH', firmaId: 'f-zwei' })];

describe('Treppe: Altbestand bit-gleich', () => {
  it('ohne Karten sind die Katalog-Stufen GENAU die gespeicherten (dieselben Objekte)', () => {
    const d = gespeichert();
    const s = stufenAusKatalog(ALT_KATALOG, d.stufen);
    expect(s).toHaveLength(d.stufen.length);
    s.forEach((x, i) => expect(x).toBe(d.stufen[i]));
  });
  it('Kundenzeilen, Zielbild und Kapazität rechnen mit und ohne Katalog gleich', () => {
    const d = gespeichert();
    const crm = { mandate: MANDATE, leistungen: ALT_KATALOG, chancen: [] };
    const k = treppeMitKatalog(d, ALT_KATALOG);
    const vorher = kundenZeilen({ datei: d, crm, heute: HEUTE });
    expect(kundenZeilen({ datei: k, crm, heute: HEUTE })).toEqual(vorher);
    expect(zielbild({ datei: k, crm, heute: HEUTE })).toEqual(zielbild({ datei: d, crm, heute: HEUTE }));
    expect(kapaBedarf(k, vorher)).toEqual(kapaBedarf(d, vorher));
  });
  it('Stufe ohne Produkt: gemeldet — und rechnet weiter mit (nichts geht verloren)', () => {
    const d = gespeichert();
    expect(stufenOhneProdukt(ALT_KATALOG, d.stufen).map(s => s.id)).toEqual(['ts-eins']);
    expect(stufenAusKatalog(ALT_KATALOG, d.stufen).map(s => s.id)).toContain('ts-eins');
    // Produkt im Papierkorb zählt nicht: die Stufe steht dann ohne Produkt.
    const imPapierkorb = ALT_KATALOG.map(l => (l.id === 'l-ana' ? { ...l, geloeschtAm: J } : l));
    expect(stufenOhneProdukt(imPapierkorb, d.stufen).map(s => s.id)).toEqual(['ts-eins', 'ts-zwei']);
  });
});

describe('Treppe: Stufe + Karte zusammengeführt', () => {
  const ANA_KARTE = leistung({ id: 'l-ana', name: 'Analyse kompakt', ebene: 2, preise: [teil({ art: 'fest', betragCent: 350_000 })], aufwandStundenWoche: 5, kennzahl: 'Abschlussquote' });
  it('Karte gewinnt (Name, Preis, Aufwand, Kennzahl), die Stufe füllt nur Leeres (Lieferobjekte, Aufgabe, Dauer, Ziel) — Kennung bleibt', () => {
    const d = gespeichert();
    const kat = katalogTreppe([ANA_KARTE, ...ALT_KATALOG.filter(l => l.id !== 'l-ana')], d.stufen);
    const s = kat.stufen.find(x => x.id === 'ts-zwei')!;
    expect(s).toMatchObject({ name: 'Analyse kompakt', ebene: 2, preis: { art: 'fest', betrag: 3500 }, kennzahl: 'Abschlussquote', lieferobjekte: ['Befund', 'Fahrplan'], aufgabe: 'Lage klären', dauerTage: 20, ziel: { umsatz: 30000, kunden: 10 }, wochenAufwand: { stunden: 5, annahme: false }, leistungIds: ['l-ana'] });
    expect(kat.herkunft['ts-zwei']).toEqual({ leistungId: 'l-ana', gespeichert: true, karte: true });
    // Kundenfortschritt (gewählte Stufe, erledigte Lieferobjekte) stimmt weiter.
    const k = { ...d, stufen: kat.stufen };
    expect(stufeVonMandat({ id: 'm-ana', leistungId: 'l-ana' }, k)?.stufe.id).toBe('ts-zwei');
    const zeilen = kundenZeilen({ datei: k, crm: { mandate: MANDATE, leistungen: [ANA_KARTE] }, heute: HEUTE });
    expect(zeilen.find(z => z.mandatId === 'm-ana')?.lieferobjekte).toEqual([{ was: 'Befund', erledigt: true, am: '2026-10-01' }, { was: 'Fahrplan', erledigt: false }]);
    expect(kapaBedarf(k, zeilen).jeStufe.find(x => x.stufeId === 'ts-zwei')).toMatchObject({ kunden: 1, stundenWoche: 5 });
  });
  it('produktKarte: Ebene, Lieferumfang und Mindestlaufzeit aus der Stufe, wenn die Karte sie nicht trägt', () => {
    const d = gespeichert();
    const k = produktKarte(leistung({ id: 'l-a', preise: [teil({ art: 'monatlich', betragCent: 200_000 })] }), d.stufen.find(s => s.id === 'ts-drei'));
    expect(k).toMatchObject({ ebene: 3, vertrag: { mindestlaufzeitMonate: 6 }, regeln: { maxGleichzeitig: 1 }, stufeId: 'ts-drei', aufwand: { stunden: 6, annahme: false } });
    // Preis offen am Produkt → die Stufe füllt ihn.
    expect(produktKarte(leistung({ id: 'l-a', preis: { betrag: 0, einheit: 'Monat netto' } }), d.stufen.find(s => s.id === 'ts-drei')).preisText).toBe('2.000 € netto/Monat');
  });
  it('Karte mit Ebene ohne gespeicherte Stufe → neue Stufe mit fester Kennung; Mit-Verknüpfte fallen aus der alten Stufe heraus', () => {
    const d = gespeichert();
    const neu = leistung({ id: 'l-neu', name: 'Neues Paket', ebene: 4, preise: [teil({ art: 'monatlich', betragCent: 500_000 })] });
    const c = leistung({ id: 'l-c', name: 'Strategisch C', preise: [teil({ art: 'monatlich', betragCent: 400_000 })] });
    const kat = katalogTreppe([...ALT_KATALOG.filter(l => l.id !== 'l-c'), c, neu], d.stufen);
    expect(katalogStufeId('l-neu')).toBe('ts-k-l-neu');
    expect(kat.stufen.map(s => s.id)).toEqual(['ts-eins', 'ts-zwei', 'ts-drei', 'ts-vier', 'ts-k-l-c', 'ts-k-l-neu']);
    expect(kat.stufen.find(s => s.id === 'ts-vier')!.leistungIds).toEqual(['l-b', 'l-weg']);
    expect(kat.stufen.find(s => s.id === 'ts-k-l-c')).toMatchObject({ name: 'Strategisch C', ebene: 3, leistungIds: ['l-c'], preis: { art: 'monat', betrag: 4000 }, lieferobjekte: [] });
    // Mandat auf l-c steht jetzt in der Stufe seiner Karte.
    expect(stufeVonMandat({ id: 'm-b', leistungId: 'l-c' }, { ...d, stufen: kat.stufen })?.stufe.id).toBe('ts-k-l-c');
    // Eingestellt oder Privat-Einheit: keine neue Stufe.
    expect(stufenAusKatalog([...ALT_KATALOG, { ...neu, status: 'eingestellt' }], d.stufen).map(s => s.id)).not.toContain('ts-k-l-neu');
  });
  it('Treppe schreiben: Kunde/Station dürfen auf eine Stufe aus dem Katalog zeigen, sonst 400', () => {
    let n = 0;
    const K: AnwendenKontext = { person: 'pa', jetzt: J, heute: HEUTE, standVon: x => JSON.stringify(x).length.toString(36), neueId: p => `${p}-test${(++n).toString().padStart(4, '0')}` };
    const d = gespeichert();
    expect(treppeAnwenden(d, [{ op: 'kunde', mandatId: 'm-neu', felder: { stufeId: 'ts-k-l-neu' } }], K)).toMatchObject({ ok: false, status: 400 });
    const r = treppeAnwenden(d, [{ op: 'kunde', mandatId: 'm-neu', felder: { stufeId: 'ts-k-l-neu' } }], { ...K, katalogStufen: ['ts-k-l-neu'] });
    expect(r.ok && r.datei.kunden['m-neu'].stufeId).toBe('ts-k-l-neu');
  });
});

// ── Mandat übernimmt den Vertrag ──────────────────────────────────────────────────────────────────────────────────────

describe('Mandat-Vorlage aus dem Produkt', () => {
  it('Altbestand: genau der bisherige Weg (Titel, Produkt, „retainer“, Honorar aus dem alten Preis)', () => {
    const l = leistung({ id: 'l-j', name: 'Jahrespaket', preis: { betrag: 24_000, einheit: 'Jahr netto', basis: 'jahr' }, laufzeitMonate: 12, lieferumfang: ['X'] });
    expect(mandatVorlageAusProdukt(l)).toEqual({ titel: 'Jahrespaket', leistungId: 'l-j', art: 'retainer', gesellschaft: 'ug', ...honorarAusPreis({ betrag: 24_000, basis: 'jahr' }), leistungen: [], hinweise: [] });
    expect(mandatVertragAusProdukt(l)).toEqual({});
  });
  it('mandatEntwurf mit Altbestand: dasselbe Mandat wie bis 19.10.', () => {
    const l = leistung({ id: 'l-r', name: 'Retainer', preis: { betrag: 1500, einheit: 'Monat netto' }, gesellschaft: 'kdv' });
    const m = mandatEntwurf({ id: 'm-neu', firma: { id: 'f-a', name: 'Beispiel GmbH' }, kontaktIds: ['c-a'], gesellschaft: 'ug', leistung: l, jetzt: J, person: 'pa' });
    expect(m).toEqual({
      id: 'm-neu', kunde: 'Beispiel GmbH', firmaId: 'f-a', kontaktIds: ['c-a'], titel: 'Retainer', art: 'retainer', leistungId: 'l-r', gesellschaft: 'ug', status: 'aktiv',
      vertragUnterschrieben: false, start: HEUTE, verlaengerung: 'offen', honorar: { betrag: 1500, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich',
      zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [],
      offen: ['Vertrag unterschreiben lassen', 'Kickoff-Termin festlegen'], quelle: 'Von Hand angelegt (Produkte & Mandate)', geaendert: J, geaendertVon: 'pa',
    });
    // Ohne gewählte Gesellschaft kommt sie vom Produkt.
    expect(mandatEntwurf({ id: 'm-neu', firma: { id: 'f-a', name: 'B' }, kontaktIds: [], gesellschaft: 'offen', leistung: l, jetzt: J, person: 'pa' }).gesellschaft).toBe('kdv');
  });
  it('Karte: Art, Honorar, Vertrag, Leistungen — auch im Mandats-Entwurf', () => {
    const v = mandatVorlageAusProdukt(HOS);
    expect(v).toEqual({
      titel: 'Vertriebsleitung auf Zeit', leistungId: 'l-hos', art: 'retainer', gesellschaft: 'ug', honorar: { betrag: 2500, basis: 'monat', netto: true }, rechnungsrhythmus: 'monatlich',
      mindestlaufzeitMonate: 6, kuendigungsfristTage: 30, verlaengerung: 'auto', zahlungszielTage: 10, leistungen: ['Führung des Vertriebs.', 'Wochenplan', 'Pipeline-Review'],
      // 24.10.: der Erfolgsanteil einer Kombination geht nicht mehr still verloren — ein offener Punkt am Mandat.
      hinweise: ['Erfolgsanteil: Bonus bei Zielen — Höhe beim Abrechnen festlegen.'],
    });
    const m = mandatEntwurf({ id: 'm-neu', firma: { id: 'f-a', name: 'B' }, kontaktIds: [], gesellschaft: 'ug', leistung: HOS, jetzt: J, person: 'pa' });
    expect(m).toMatchObject({ mindestlaufzeitMonate: 6, kuendigungsfristTage: 30, verlaengerung: 'auto', zahlungszielTage: 10, honorar: { betrag: 2500, basis: 'monat' }, leistungen: v.leistungen });
  });
  it('Preis-Formen im Mandat: jährlich ÷ 12, Tagessatz, Stundensatz mit Deckel (Hinweis), fest/kostenlos einmalig', () => {
    expect(mandatVorlageAusProdukt(KI)).toMatchObject({ art: 'software', honorar: { betrag: 1000, basis: 'monat' }, rechnungsrhythmus: 'monatlich', mindestlaufzeitMonate: 12 });
    expect(mandatVorlageAusProdukt(TAG)).toMatchObject({ art: 'projekt', honorar: { betrag: 1400, basis: 'tag' } });
    const s = mandatVorlageAusProdukt(STUNDE);
    expect(s.honorar).toEqual({ betrag: 3600, basis: 'monat', netto: true });
    expect(s.hinweise[0]).toMatch(/höchstens 20 Std\./);
    expect(mandatVorlageAusProdukt(WORKSHOP)).toMatchObject({ art: 'workshop', honorar: { betrag: 4800, basis: 'einmalig' }, rechnungsrhythmus: 'einmalig' });
    expect(mandatVorlageAusProdukt(CHECK)).toMatchObject({ honorar: { betrag: 0, basis: 'einmalig' } });
  });
  it('Zusatzmodule: gewählte mit Honorar, laut „inklusive“ enthaltene mit 0 € und Menge', () => {
    const cso = leistung({ id: 'l-cso', name: 'Leitung', preise: [teil({ art: 'monatlich', betragCent: 400_000 })], regeln: { inklusive: [{ leistungId: 'l-event', menge: 1, je: 'quartal' }] } });
    expect(mandatVorlageAusProdukt(cso).zusatz).toEqual([{ id: 'mz-1', leistungId: 'l-event', inklusive: true, menge: 1, je: 'quartal' }]);
    expect(mandatVorlageAusProdukt(cso, [{ leistung: TAG, ab: '2026-11-01' }]).zusatz).toEqual([
      { id: 'mz-1', leistungId: 'l-tag', ab: '2026-11-01', honorar: { betragCent: 140_000, basis: 'tag' } },
      { id: 'mz-2', leistungId: 'l-event', inklusive: true, menge: 1, je: 'quartal' },
    ]);
  });
  it('Mandat aus angenommenem Angebot: ohne Vertrag am Produkt wie bisher; mit Vertrag füllt er nur Lücken', () => {
    const a = {
      id: 'a-1', gesellschaft: 'ug', titel: 'Angebot', einleitung: '', schluss: '', gueltigBis: '2026-11-30', zahlungszielTage: 21, status: 'angenommen', version: 1, angelegt: J, geaendert: J,
      positionen: [{ id: 'p-1', leistungId: 'l-hos', titel: 'Leitung', text: '', menge: 1, einheit: 'Monat', einzelpreisCent: 300_000, ustSatz: 19, basis: 'monat' }],
    } as unknown as Angebot;
    const alt = mandatVorbelegung(a);
    expect(mandatVorbelegung(a, [leistung({ id: 'l-hos' })])).toEqual(alt);
    expect(alt).toEqual({ gesellschaft: 'ug', titel: 'Angebot', honorar: { betrag: 3000, basis: 'monat', netto: true }, leistungId: 'l-hos', ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 21, leistungen: ['Leitung'] });
    expect(mandatVorbelegung(a, [HOS])).toEqual({ ...alt, mindestlaufzeitMonate: 6, kuendigungsfristTage: 30, verlaengerung: 'auto' });
  });
});
