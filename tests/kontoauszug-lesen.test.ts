// ─── Kontoauszug einlesen — Leser und Plan (rein, 09.10., ONBOARDING_PLAN.md › B9 d / L8) ─────────────────────────────────────────────────
// CAMT.053 (.02/.08, Status, Sammelbuchung, mehrere Tagesauszüge, Saldo-Prüfung), XML-Sicherheit (DTD/XXE/Entitäten abgelehnt, Tiefe), Grenzen
// (5 MB → 413, 10.000 Umsätze → 413), CSV beliebiger Banken (Vorspann, Soll/Haben, Fußzeile, Windows-1252, Semikolon + deutsche Zahlen, Kennzeichen,
// zweistellige Jahre, vorgemerkt, Auftragskonto, englisches Format mit Gebühr), Spaltenvorschlag/-prüfung, Zuordnung zum Konto, Plan mit Dublettenschutz.
import { describe, it, expect } from 'vitest';
import { auszugLesen, bytesAusBase64, bytesZuBase64 } from '@/lib/finanzen/kontoauszug/lesen';
import { xmlLesen, XmlFehler } from '@/lib/finanzen/kontoauszug/camt';
import { betragCent, datumAus, textAusBytes, zahlformatErkennen } from '@/lib/finanzen/kontoauszug/text';
import { spaltenPruefen, spaltenVorschlag, kopfFinden, csvZerlegen, trennerErkennen } from '@/lib/finanzen/kontoauszug/csv';
import { auszugZuordnen, planBauen, businessZeilen, businessId, type BusinessBuchung } from '@/lib/finanzen/kontoauszug/plan';
import type { LeseErgebnis } from '@/lib/finanzen/kontoauszug/typen';
import { camt, cp1252, testIban, utf8 } from './fixtures/kontoauszug';

const ok = (l: LeseErgebnis) => { expect(l.ok, JSON.stringify(l).slice(0, 400)).toBe(true); return l as Extract<LeseErgebnis, { ok: true }>; };
const IBAN_A = testIban('37040044', '532013000');
const IBAN_B = testIban('10010010', '123456789');
const IBAN_C = testIban('50010517', '987654321');

describe('Bausteine: Beträge, Daten, Zeichensatz', () => {
  it('Beträge in Cent — deutsch, englisch, Vorzeichen hinten, S/H, Währung, Klammern; Unklares → null', () => {
    expect(betragCent('1.234,56')).toBe(123456);
    expect(betragCent('-1.234,56 €')).toBe(-123456);
    expect(betragCent('+12,00 EUR')).toBe(1200);
    expect(betragCent('12,34-')).toBe(-1234);
    expect(betragCent('12,34 S')).toBe(-1234);
    expect(betragCent('12,34 H')).toBe(1234);
    expect(betragCent('(5,00)')).toBe(-500);
    expect(betragCent('−12,50')).toBe(-1250);
    expect(betragCent('1,234.56', 'punkt')).toBe(123456);
    expect(betragCent('-12.5', 'punkt')).toBe(-1250);
    expect(betragCent('-12.5')).toBe(-1250);            // komma-Format, aber „.5“ kann kein Tausender sein
    expect(betragCent('1.234')).toBe(123400);           // Tausender im Komma-Format
    expect(betragCent('0,005')).toBe(1);                // dritte Stelle gerundet
    expect(betragCent('abc')).toBeNull();
    expect(betragCent('')).toBeNull();
    expect(betragCent('1,2,3')).toBeNull();
    expect(zahlformatErkennen(['1.234,56', '-12,00'])).toBe('komma');
    expect(zahlformatErkennen(['1234.56', '-12.00', '3'])).toBe('punkt');
  });
  it('Daten: ISO, mit Zeit und Zone (Berliner Tag), deutsch, zweistellig, ungültig → null', () => {
    expect(datumAus('2026-10-01')).toBe('2026-10-01');
    expect(datumAus('2026-09-30T23:30:00Z')).toBe('2026-10-01');
    expect(datumAus('2026-09-30T23:30:00+0000')).toBe('2026-10-01');
    expect(datumAus('2026-10-01 10:00:00')).toBe('2026-10-01');
    expect(datumAus('01.10.2026')).toBe('2026-10-01');
    expect(datumAus('1.10.26')).toBe('2026-10-01');
    expect(datumAus('31.02.2026')).toBeNull();
    expect(datumAus('Buchungstag')).toBeNull();
  });
  it('Zeichensatz: UTF-8 (BOM weg), sonst Windows-1252 (€, Umlaute)', () => {
    expect(textAusBytes(utf8('﻿Ärger;€')).text).toBe('Ärger;€');
    const w = textAusBytes(cp1252('Müller;€'));
    expect(w).toEqual({ text: 'Müller;€', zeichensatz: 'windows-1252' });
  });
  it('base64 hin und zurück', () => {
    const b = utf8('Grüße;1.234,56\n'.repeat(5000));
    expect(Array.from(bytesAusBase64(bytesZuBase64(b))!)).toEqual(Array.from(b));
    expect(bytesAusBase64('%%%')).toBeNull();
  });
});

describe('CAMT.053', () => {
  const posten = [
    { betrag: '1500.00', datum: '2026-10-01', name: 'Beispiel GmbH', iban: IBAN_B, zweck: ['Rechnung 4711', 'Oktober'], ref: 'REF-1' },
    { betrag: '45.90', dbit: true, datum: '2026-10-02', name: 'Muster Versand AG', zweck: ['Kundennr. 12'], ref: 'REF-2' },
    { betrag: '3.20', dbit: true, datum: '2026-10-03', name: 'Kaffee Beispiel', ref: 'REF-3' },
    { betrag: '3.20', dbit: true, datum: '2026-10-03', name: 'Kaffee Beispiel', ref: 'REF-4' },
    { betrag: '99.00', dbit: true, datum: '2026-10-04', name: 'Vorgemerkt AG', status: 'PDNG', ref: 'REF-5' },
  ];
  for (const fassung of ['02', '08'] as const) {
    it(`camt.053.001.${fassung}: IBAN, Salden, Umsätze mit Vorzeichen, Gegenseite, Zweck, Status, Saldo-Prüfung stimmt`, () => {
      const l = ok(auszugLesen(utf8(camt({ iban: IBAN_A, fassung, anfang: { betrag: '100.00', datum: '2026-09-30' }, ende: { betrag: '1547.70', datum: '2026-10-04' }, posten }))));
      expect(l.format).toBe('camt');
      if (l.format !== 'camt') return;
      expect(l.version).toBe(`camt.053.001.${fassung}`);
      expect(l.auszuege).toHaveLength(1);
      const a = l.auszuege[0];
      expect(a.iban).toBe(IBAN_A);
      expect(a.saldo).toEqual({ cent: 154770, datum: '2026-10-04' });
      expect(a.anfang).toEqual({ cent: 10000, datum: '2026-09-30' });
      expect(a.eintraege.map(e => e.cent)).toEqual([150000, -4590, -320, -320, -9900]);
      expect(a.eintraege[0]).toMatchObject({ gegenpartei: 'Beispiel GmbH', gegenIban: IBAN_B, zweck: 'Rechnung 4711 Oktober', externeId: 'REF-1', status: 'gebucht', datum: '2026-10-01' });
      expect(a.eintraege[1].gegenpartei).toBe('Muster Versand AG');
      expect(a.eintraege[4].status).toBe('vorgemerkt');
      expect(a.pruefung).toMatchObject({ stimmt: true, abweichung: 0 });
      expect(a.hinweise.join(' ')).toContain('vorgemerkt');
    });
  }
  it('Saldo-Prüfung geht nicht auf → deutlicher Hinweis mit Abweichung', () => {
    const l = ok(auszugLesen(utf8(camt({ iban: IBAN_A, anfang: { betrag: '100.00', datum: '2026-09-30' }, ende: { betrag: '200.00', datum: '2026-10-04' }, posten: posten.slice(0, 2) }))));
    expect(l.auszuege[0].pruefung).toMatchObject({ stimmt: false, abweichung: 20000 - (10000 + 150000 - 4590) });
    expect(l.auszuege[0].hinweise.join(' ')).toContain('Saldo-Prüfung');
  });
  it('Sicherheit: DOCTYPE/ENTITY (XXE, „Billion Laughs“) → 415, unbekannte Entitäten bleiben wörtlich, Zeichenreferenzen gelten', () => {
    const xxe = `<?xml version="1.0"?><!DOCTYPE d [<!ENTITY x SYSTEM "file:///etc/passwd">]><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt><Stmt>&x;</Stmt></BkToCstmrStmt></Document>`;
    const r = auszugLesen(utf8(xxe));
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(415); expect(r.fehler).toContain('DTD'); }
    expect(() => xmlLesen('<a><!ENTITY lol "lol"></a>')).toThrow(XmlFehler);
    const k = xmlLesen('<a>&unbekannt; &amp; &#228; &#xFC;</a>');
    expect(k.kinder[0].text).toBe('&unbekannt; & ä ü');
    expect(() => xmlLesen(`${'<a>'.repeat(80)}${'</a>'.repeat(80)}`)).toThrow(/tief/);
    expect(() => xmlLesen('<a><b></a>')).toThrow(XmlFehler);
  });
  it('Fremde Währung, mehrere Tagesauszüge desselben Kontos werden zusammengefasst', () => {
    const tag1 = camt({ iban: IBAN_A, anfang: { betrag: '10.00', datum: '2026-10-01' }, ende: { betrag: '20.00', datum: '2026-10-01' }, posten: [{ betrag: '10.00', datum: '2026-10-01', name: 'A', ref: 'R1' }] });
    const tag2 = camt({ iban: IBAN_A, anfang: { betrag: '20.00', datum: '2026-10-02' }, ende: { betrag: '15.00', datum: '2026-10-02' }, posten: [{ betrag: '5.00', dbit: true, datum: '2026-10-02', name: 'B', ref: 'R2' }] });
    const stmt2 = /<Stmt>[\s\S]*<\/Stmt>/.exec(tag2)![0];
    const zwei = tag1.replace('</Stmt>', `</Stmt>${stmt2}`);
    const a = ok(auszugLesen(utf8(zwei))).auszuege;
    expect(a).toHaveLength(1);
    expect(a[0].eintraege).toHaveLength(2);
    expect(a[0].saldo).toEqual({ cent: 1500, datum: '2026-10-02' });
    expect(a[0].anfang).toEqual({ cent: 1000, datum: '2026-10-01' });
    expect(a[0].pruefung?.stimmt).toBe(true);
    const usd = ok(auszugLesen(utf8(camt({ iban: IBAN_A, ccy: 'USD', posten: [{ betrag: '1.00', datum: '2026-10-01', name: 'X' }] }))));
    expect(usd.auszuege[0].waehrung).toBe('USD');
  });
  it('Grenzen: über 5 MB → 413, über 10.000 Umsätze → 413, PDF/ZIP → 415', () => {
    const gross = new Uint8Array(5 * 1024 * 1024 + 1).fill(0x41);
    expect(auszugLesen(gross)).toMatchObject({ ok: false, status: 413 });
    const viele = camt({ iban: IBAN_A, posten: Array.from({ length: 10_001 }, (_, i) => ({ betrag: '1.00', datum: '2026-10-01', name: 'X', ref: `R${i}` })) });
    expect(auszugLesen(utf8(viele))).toMatchObject({ ok: false, status: 413 });
    expect(auszugLesen(utf8('%PDF-1.7 …'))).toMatchObject({ ok: false, status: 415 });
    expect(auszugLesen(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2]))).toMatchObject({ ok: false, status: 415 });
  });
});

describe('CSV beliebiger Banken', () => {
  it('Vorspann über der Kopfzeile, Soll/Haben-Spalten, Fußzeile „Kontostand“ (Aufbau wie Deutsche Bank)', () => {
    const t = [
      'Umsätze Girokonto;Zeitraum: 01.10.2026 - 05.10.2026',
      `Kontonummer;${IBAN_A}`,
      '',
      'Buchungstag;Wert;Umsatzart;Begünstigter / Auftraggeber;Verwendungszweck;IBAN;BIC;Soll;Haben;Währung',
      `01.10.2026;01.10.2026;Gutschrift;Beispiel GmbH;Rechnung 4711;${IBAN_B};BICXXX;;1.500,00;EUR`,
      '02.10.2026;02.10.2026;Lastschrift;Muster Versand AG;Kundennr. 12;;;-45,90;;EUR',
      'Kontostand;05.10.2026;;;1.554,10;EUR',
    ].join('\r\n');
    const l = ok(auszugLesen(utf8(t)));
    if (l.format !== 'csv') throw new Error('csv erwartet');
    expect(l.csv.kopfZeile).toBe(4);
    expect(l.csv.bank).toBe('Deutsche Bank');
    expect(l.csv.vorschlag).toMatchObject({ datum: 0, valuta: 1, gegenpartei: 3, zweck: [4], iban: 5, soll: 7, haben: 8, waehrung: 9 });
    const a = l.auszuege[0];
    expect(a.iban).toBe(IBAN_A);
    expect(a.eintraege.map(e => e.cent)).toEqual([150000, -4590]);
    expect(a.eintraege[0]).toMatchObject({ gegenpartei: 'Beispiel GmbH', zweck: 'Rechnung 4711', gegenIban: IBAN_B, zeile: 5 });
    expect(a.saldo).toEqual({ cent: 155410, datum: '2026-10-05' });
  });
  it('Windows-1252, Semikolon, deutsche Beträge ohne Anführungszeichen, Saldo-Spalte → Saldo, Anfangssaldo, Prüfung (Aufbau wie VR-Banken)', () => {
    const t = [
      'Bezeichnung Auftragskonto;IBAN Auftragskonto;Buchungstag;Valutadatum;Name Zahlungsbeteiligter;IBAN Zahlungsbeteiligter;Buchungstext;Verwendungszweck;Betrag;Waehrung;Saldo nach Buchung',
      `Girokonto;${IBAN_A};03.10.2026;03.10.2026;Bäckerei Müller;;Kartenzahlung;Brötchen;-3,20;EUR;1.296,80`,
      `Girokonto;${IBAN_A};02.10.2026;02.10.2026;Beispiel GmbH;${IBAN_B};Gutschrift;Gehalt;1.000,00;EUR;1.300,00`,
    ].join('\n');
    const l = ok(auszugLesen(cp1252(t)));
    if (l.format !== 'csv') throw new Error('csv erwartet');
    expect(l.csv.zeichensatz).toBe('windows-1252');
    expect(l.csv.bank).toBe('Volks- und Raiffeisenbanken');
    const a = l.auszuege[0];
    expect(a.iban).toBe(IBAN_A);
    expect(a.eintraege[0]).toMatchObject({ gegenpartei: 'Bäckerei Müller', zweck: 'Brötchen', cent: -320 });
    // Absteigend sortiert: der jüngste Saldo ist der der obersten Zeile; Anfang = Saldo der ältesten minus ihr Betrag.
    expect(a.saldo).toEqual({ cent: 129680, datum: '2026-10-03' });
    expect(a.anfang).toEqual({ cent: 30000, datum: '2026-10-02' });
    expect(a.pruefung).toMatchObject({ stimmt: true });
  });
  it('Sparkasse-Aufbau: zweistellige Jahre, „Umsatz vorgemerkt“, mehrere Verwendungszweck-Spalten zusammengefügt', () => {
    const t = [
      '"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Verwendungszweck 2";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"Betrag";"Waehrung";"Info"',
      `"${IBAN_A}";"05.10.26";"05.10.26";"LASTSCHRIFT";"Abo";"Oktober";"Streaming Beispiel";"${IBAN_C}";"-9,99";"EUR";"Umsatz gebucht"`,
      `"${IBAN_A}";"06.10.26";"06.10.26";"KARTE";"Tanken";"";"Tankstelle Beispiel";"";"-50,00";"EUR";"Umsatz vorgemerkt"`,
    ].join('\n');
    const l = ok(auszugLesen(utf8(t)));
    if (l.format !== 'csv') throw new Error('csv erwartet');
    expect(l.csv.bank).toBe('Sparkasse');
    expect(l.csv.vorschlag.zweck).toEqual([4, 5]);
    const [e1, e2] = l.auszuege[0].eintraege;
    expect(e1).toMatchObject({ datum: '2026-10-05', zweck: 'Abo Oktober', gegenpartei: 'Streaming Beispiel', cent: -999, status: 'gebucht', gegenIban: IBAN_C });
    expect(e2.status).toBe('vorgemerkt');
  });
  it('Englisches Format mit Komma-Trenner, ISO-Zeit, Gebühr und Status (Aufbau wie Revolut)', () => {
    const t = [
      'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance',
      'CARD_PAYMENT,Current,2026-10-01 09:00:00,2026-10-01 10:00:00,Coffee Example,-3.20,0.00,EUR,COMPLETED,96.80',
      'TRANSFER,Current,2026-10-02 09:00:00,2026-10-02 09:00:00,"Transfer to Anna Beispiel, thanks",-50.00,0.50,EUR,COMPLETED,46.30',
      'CARD_PAYMENT,Current,2026-10-03 09:00:00,,Shop Example,-10.00,0.00,EUR,PENDING,',
    ].join('\n');
    const l = ok(auszugLesen(utf8(t)));
    if (l.format !== 'csv') throw new Error('csv erwartet');
    expect(l.csv.trenner).toBe(',');
    expect(l.csv.bank).toBe('Revolut');
    const a = l.auszuege[0];
    expect(a.eintraege.map(e => e.cent)).toEqual([-320, -5050]);   // dritte Zeile: kein Abschlussdatum → ohne Buchungstag übersprungen
    expect(a.eintraege[1].gegenpartei).toBe('Transfer to Anna Beispiel, thanks');
    expect(a.saldo).toEqual({ cent: 4630, datum: '2026-10-02' });
    expect(a.pruefung?.stimmt).toBe(true);
  });
  it('Betrag mit Soll/Haben-Kennzeichen; Spaltenzuordnung von Hand; ohne Datum/Betrag → 400 mit Kopf und Vorschlag', () => {
    const t = ['Tag;Text;Umsatz;S/H', '01.10.2026;Beispiel;12,00;S', '02.10.2026;Beispiel;5,00;H'].join('\n');
    const l = ok(auszugLesen(utf8(t), { spalten: { datum: 0, betrag: 2, kennzeichen: 3, zweck: [1] } }));
    expect(l.auszuege[0].eintraege.map(e => e.cent)).toEqual([-1200, 500]);
    const ohne = auszugLesen(utf8('A;B;C\n01.10.2026;x;12,00\n'));
    expect(ohne.ok).toBe(false);
    if (!ohne.ok) { expect(ohne.status).toBe(400); expect(ohne.csv?.kopf).toBeDefined(); }
    expect(auszugLesen(utf8(t), { spalten: { datum: 0, betrag: 99 } })).toMatchObject({ ok: false, status: 400 });
    expect(spaltenPruefen({ datum: 0 }, 4)).toMatchObject({ ok: false });
    expect(spaltenPruefen({ datum: 0, betrag: 1, boese: 2 }, 4)).toMatchObject({ ok: false });
    expect(spaltenPruefen({ datum: 0, soll: 1, haben: 2, zweck: [3] }, 4)).toMatchObject({ ok: true });
  });
  it('Trenner, Anführungszeichen mit Zeilenumbruch, Kopfzeile ohne Vorspann', () => {
    const t = 'Datum;Betrag;Zweck\n01.10.2026;"1.234,56";"zwei\nZeilen"\n';
    expect(trennerErkennen(t)).toBe(';');
    const z = csvZerlegen(t, ';');
    expect(z[1].zellen[2]).toBe('zwei\nZeilen');
    expect(kopfFinden(z)).toBe(0);
    expect(spaltenVorschlag(['Datum', 'Betrag', 'Zweck']).vorschlag).toMatchObject({ datum: 0, betrag: 1 });
  });
});

describe('Zuordnung und Plan', () => {
  const lese = (iban = IBAN_A) => ok(auszugLesen(utf8(camt({ iban, anfang: { betrag: '0.00', datum: '2026-09-30' }, ende: { betrag: '93.60', datum: '2026-10-03' }, posten: [
    { betrag: '100.00', datum: '2026-10-01', name: 'Beispiel GmbH', ref: 'A1' },
    { betrag: '3.20', dbit: true, datum: '2026-10-03', name: 'Kaffee Beispiel', zweck: ['Kaffee'] },
    { betrag: '3.20', dbit: true, datum: '2026-10-03', name: 'Kaffee Beispiel', zweck: ['Kaffee'] },
    { betrag: '5.00', datum: '2026-10-03', name: 'Fremd', ccy: 'USD' },
  ] }))));
  const konto = { id: 'kt-1', name: 'Geschäftskonto', iban: IBAN_A, staende: [] as { betrag: number; datum: string }[] };

  it('per IBAN; falsche IBAN → 409 mit dem passenden Konto; ohne IBAN am Konto per Wahl mit Hinweis', () => {
    expect(auszugZuordnen(lese(), konto, []).ok).toBe(true);
    const falsch = auszugZuordnen(lese(), { id: 'kt-2', name: 'Anderes', iban: IBAN_B }, [konto]);
    expect(falsch).toMatchObject({ ok: false, status: 409, anderesKonto: { id: 'kt-1' } });
    const wahl = auszugZuordnen(lese(), { id: 'kt-3', name: 'Ohne IBAN' }, []);
    expect(wahl.ok && wahl.hinweise[0]).toContain('keine hinterlegt');
  });

  it('Business: neu/schon da als Menge (zwei gleiche Kaffees), fremde Währung übersprungen, Saldo neu; zweiter Lauf → alles schon da', () => {
    const a = lese().auszuege[0];
    const p1 = planBauen({ auszug: a, konto, ziel: { art: 'business', ort: 'ug' }, business: [], heute: '2026-10-09' });
    expect(p1.zahlen).toEqual({ gelesen: 4, neu: 3, vorhanden: 0, uebersprungen: 1 });
    expect(p1.zeilen[3]).toMatchObject({ status: 'uebersprungen', grund: 'fremde Währung (USD)' });
    expect(p1.saldo).toMatchObject({ cent: 9360, status: 'neu', geltend: true });
    const zeilen = businessZeilen(p1, a, konto, 'ka-test');
    expect(zeilen.map(z => z.id)).toEqual(p1.zeilen.filter(z => z.status === 'neu').map(z => businessId('kt-1', z.schluessel)));
    expect(new Set(zeilen.map(z => z.id)).size).toBe(3);
    expect(zeilen[1]).toMatchObject({ betrag: -3.2, wer: 'Kaffee Beispiel', zweck: 'Kaffee', ort: 'ug', konto: 'Geschäftskonto', auszug: 'ka-test' });
    // Zweiter Lauf mit diesen Zeilen im Bestand: nichts neu, gleiche Basis bleibt stabil.
    const p2 = planBauen({ auszug: a, konto: { ...konto, staende: [{ betrag: 93.6, datum: '2026-10-03' }] }, ziel: { art: 'business', ort: 'ug' }, business: zeilen, heute: '2026-10-09' });
    expect(p2.zahlen).toMatchObject({ neu: 0, vorhanden: 3 });
    expect(p2.saldo?.status).toBe('vorhanden');
    expect(planBauen({ auszug: a, konto, ziel: { art: 'business', ort: 'ug' }, business: [], heute: '2026-10-09' }).basis).toBe(p1.basis);
    // Ein Kaffee schon von Hand erfasst (ohne Kennung): nur einer davon zählt als schon da.
    const vonHand: BusinessBuchung = { id: 'b-hand', datum: '2026-10-03', wer: 'Kaffee Beispiel', betrag: -3.2, kategorie: 'Sonstiges', zweck: 'Kaffee', ort: 'ug' };
    expect(planBauen({ auszug: a, konto, ziel: { art: 'business', ort: 'ug' }, business: [vonHand], heute: '2026-10-09' }).zahlen).toMatchObject({ neu: 2, vorhanden: 1 });
    // Andere Gesellschaft bzw. anderes Register-Konto zählt nicht.
    expect(planBauen({ auszug: a, konto, ziel: { art: 'business', ort: 'ug' }, business: [{ ...vonHand, ort: 'kdv' }, { ...vonHand, id: businessId('kt-anders', 'x') }], heute: '2026-10-09' }).zahlen.neu).toBe(3);
  });

  it('Zukunft, Umbuchung auf ein eigenes Konto, Ziel „keins“', () => {
    const a = lese().auszuege[0];
    const p = planBauen({ auszug: a, konto, ziel: { art: 'business', ort: 'ug' }, business: [], heute: '2026-10-02' });
    expect(p.zeilen.filter(z => z.grund === 'Buchungstag liegt in der Zukunft')).toHaveLength(2);
    expect(p.saldo?.status).toBe('nicht');
    const k = planBauen({ auszug: a, konto, ziel: { art: 'keins', grund: 'nur Saldo' }, heute: '2026-10-09' });
    expect(k.zahlen.neu).toBe(0);
    expect(k.saldo?.status).toBe('neu');
    const umb = ok(auszugLesen(utf8(camt({ iban: IBAN_A, posten: [{ betrag: '50.00', dbit: true, datum: '2026-10-01', name: 'Ich selbst', iban: IBAN_C, ref: 'U1' }] })))).auszuege[0];
    const pu = planBauen({ auszug: umb, konto, ziel: { art: 'business', ort: 'ug' }, business: [], eigeneIbans: new Set([IBAN_C]), heute: '2026-10-09' });
    expect(pu.zeilen[0].umbuchung).toBe(true);
    expect(businessZeilen(pu, umb, konto, 'ka-x')[0].kategorie).toBe('Umbuchung');
  });
});

describe('Oberfläche', () => {
  it('Konto-Zeile zeigt „Kontoauszug einlesen“ (zugeklappt, ohne Abruf)', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { KontoauszugEinlesen } = await import('@/components/os/konten/KontoauszugEinlesen');
    const konto = { id: 'kt-1', name: 'Geschäftskonto', art: 'giro', ort: 'ug', staende: [], angelegtVon: 'pa', angelegtAm: '2026-10-01T00:00:00Z', geltend: null, fassung: 'f' } as never;
    const html = renderToStaticMarkup(createElement(KontoauszugEinlesen, { konto, bereich: 'business', onGeaendert: () => {} }));
    expect(html).toContain('Kontoauszug einlesen');
  });
});

describe('Haushalts-Import (L8): ein Trenner, Kopfzeile unter dem Vorspann', () => {
  it('Semikolon + deutsche Beträge ohne Anführungszeichen werden nicht mehr am Komma zerteilt; Vorspann wird übersprungen', async () => {
    const { ausCsv } = await import('@/lib/finanzen/haushalt/import');
    const t = ['Kontoauszug;Girokonto', 'Zeitraum;01.10.2026 - 31.10.2026', 'Datum;Empfänger;Verwendungszweck;Betrag', '01.10.2026;Supermarkt Beispiel;Einkauf;-1.234,56', '02.10.2026;Beispiel GmbH;Lohn;2.500,00'].join('\n');
    const b = ausCsv(t).buchungen;
    expect(b.map(x => x.betrag)).toEqual([-123456, 250000]);
    expect(b[0]).toMatchObject({ datum: '2026-10-01', empfaenger: 'Supermarkt Beispiel', beschreibung: 'Einkauf' });
  });
});
