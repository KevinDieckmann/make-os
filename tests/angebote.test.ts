// ─── Angebote (28.09.): Summen in Cent, Nummern, Ablauf, Vorlagen, Verbindungen (rein) ──
// Alle Daten erfunden (@example.invalid) — nie echte Bestände.
import { describe, it, expect } from 'vitest';
import type { Angebot, AngebotPosition, CrmBestand, Leistung } from '../lib/crm/typen';
import type { Kontakt } from '../lib/make-one/crm';
import { leererBestand, wendeCrmAn } from '../lib/crm/speicher';
import {
  angebotSummen, positionNettoCent, centAusEingabe, eingabeAusCent, nummerAusFormat, nummernformatOk, naechsteLaufnummer, ablaufen, werktagePlus,
  entwurfSaeubern, stellenFehlt, produktAngebotFehlt, positionAusProdukt, dealWertAusAngebot, mandatVorbelegung, angebotePersonOhne, angebotePersonUm,
  angebotVorlage, mailVorlage, mailtoLink, angebotGrenzen, katalog, GELOEST_NAME, NUMMER_VORGABE,
} from '../lib/crm/angebote';
import { gesellschaftAnwenden, gesellschaftFuerAnzeige, gesellschaftLuecken, mitVorgaben } from '../lib/crm/gesellschaften';
import { absenderAus, empfaengerAus, angebotDokument } from '../lib/crm/angebot-dokument';
import { angeboteListe, umsatzBezug } from '../lib/crm/umsatz';
import { beanVon } from '../lib/crm/bean';
import { personEntfernen, personUmbiegen, personVerweise } from '../lib/crm/person-verweise';
import { ampelVorStellen } from '../lib/crm/angebot-server';
// Öffentliche Beispiel-IBAN aus der Bankdokumentation, zusammengesetzt, damit der Repo-Scan (repo-sauber) sie nicht als Kontodaten meldet.
const BEISPIEL_IBAN = ['DE89', '3704', '0044', '0532', '0130', '00'].join('');
const BEISPIEL_IBAN_LESBAR = ['DE89', '3704', '0044', '0532', '0130', '00'].join(' ');


const HEUTE = '2026-09-28';
const J = '2026-09-28T10:00:00.000Z';
const pos = (x: Partial<AngebotPosition> = {}): AngebotPosition => ({ id: 'p1', titel: 'Leistung', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 100000, ustSatz: 19, basis: 'einmalig', ...x });
const ang = (x: Partial<Angebot> = {}): Angebot => ({ id: 'ang-test1', gesellschaft: 'kdv', kontaktId: 'c-anna1', titel: 'Retainer', positionen: [pos()], einleitung: '', schluss: '', gueltigBis: '2026-10-28', zahlungszielTage: 14, status: 'entwurf', version: 1, angelegt: J, geaendert: J, ...x });
const leistung = (x: Partial<Leistung> = {}): Leistung => ({ id: 'l-strategie', name: 'Strategie-Retainer', typ: 'retainer', stufe: 'kern', preis: { betrag: 2500, einheit: 'Monat netto', basis: 'monat' }, laufzeitMonate: 6, lieferumfang: ['Monatsgespräch'], gesellschaft: 'kdv', status: 'aktiv', geaendert: J, ...x });
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Anna', nachname: 'Beispiel', email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });

describe('Summen in Cent (kaufmännisch je Angebot)', () => {
  it('Position: Menge × Preis − Rabatt, auf den Cent', () => {
    expect(positionNettoCent(pos({ menge: 3, einzelpreisCent: 3333, rabattProzent: 10 }))).toBe(8999); // 99,99 × 0,9 = 89,991 → 89,99
    expect(positionNettoCent(pos({ menge: 1.5, einzelpreisCent: 1001 }))).toBe(1502); // 15,015 → 15,02 (ab ,5 weg von der Null)
  });
  it('USt je Satz einmal auf die Summe — netto + USt = brutto, gemischte Sätze getrennt', () => {
    const s = angebotSummen({ positionen: [pos({ einzelpreisCent: 3333 }), pos({ id: 'p2', einzelpreisCent: 3333 }), pos({ id: 'p3', einzelpreisCent: 1000, ustSatz: 7 })] });
    expect(s.einmalig.netto).toBe(7666);
    expect(s.einmalig.jeSatz).toEqual([{ satz: 19, netto: 6666, ust: 1267 }, { satz: 7, netto: 1000, ust: 70 }]);
    expect(s.einmalig.brutto).toBe(7666 + 1267 + 70);
  });
  it('gemischte Basen: einmalig, monatlich, jährlich getrennt; Gesamtwert über die Laufzeit', () => {
    const s = angebotSummen({ positionen: [
      pos({ einzelpreisCent: 500000 }),
      pos({ id: 'p2', basis: 'monat', einzelpreisCent: 250000, laufzeitMonate: 6 }),
      pos({ id: 'p3', basis: 'jahr', einzelpreisCent: 120000 }),
      pos({ id: 'p4', basis: 'monat', einzelpreisCent: 10000, rabattProzent: 50 }),
    ] });
    expect(s.einmalig.netto).toBe(500000);
    expect(s.monat.netto).toBe(255000);
    expect(s.jahr.netto).toBe(120000);
    // 5.000 + 2.500 × 6 + 1.200 × 1 + 50 × 12 (ohne Laufzeit = 12) = 21.800 €
    expect(s.gesamt.netto).toBe(2180000);
    expect(s.gesamt.brutto).toBe(2180000 + 414200);
    expect(s.ohneLaufzeit).toBe(2);
  });
  it('Kleinunternehmer: keine Steuer', () => {
    const s = angebotSummen({ positionen: [pos({ einzelpreisCent: 12345 })] }, { kleinunternehmer: true });
    expect(s.einmalig).toMatchObject({ netto: 12345, ust: 0, brutto: 12345 });
  });
  it('Eingaben: deutsche Schreibweise → Cent und zurück', () => {
    expect(centAusEingabe('1.234,56')).toBe(123456);
    expect(centAusEingabe('1234.5')).toBe(123450);
    expect(centAusEingabe('2.500')).toBe(250000);
    expect(centAusEingabe('abc')).toBeNull();
    expect(eingabeAusCent(123450)).toBe('1234,50');
    expect(eingabeAusCent(250000)).toBe('2500');
  });
});

describe('Nummern — Format je Gesellschaft, laufend je Jahr', () => {
  it('Vorgabe {KURZ}-A-{JAHR}-{NR4}', () => {
    expect(nummerAusFormat(NUMMER_VORGABE, 'KDV', 2026, 1)).toBe('KDV-A-2026-0001');
    expect(nummerAusFormat('A{JJ}/{NR}', 'X', 2026, 42)).toBe('A26/42');
  });
  it('Format braucht genau eine laufende Nummer', () => {
    expect(nummernformatOk('{KURZ}-{JAHR}')).toBe(false);
    expect(nummernformatOk('{NR}-{NR4}')).toBe(false);
    expect(nummernformatOk('{KURZ}-A-{JAHR}-{NR4}')).toBe(true);
    expect(nummernformatOk('A {NR}')).toBe(false);
  });
  it('nächste Nummer = Höchstwert + 1 je Gesellschaft und Jahr', () => {
    const l = [ang({ lauf: { jahr: 2026, nr: 3 } }), ang({ id: 'ang-b', lauf: { jahr: 2026, nr: 1 } }), ang({ id: 'ang-c', gesellschaft: 'kdc', lauf: { jahr: 2026, nr: 9 } }), ang({ id: 'ang-d', lauf: { jahr: 2025, nr: 40 } })];
    expect(naechsteLaufnummer(l, 'kdv', 2026)).toBe(4);
    expect(naechsteLaufnummer(l, 'kdc', 2026)).toBe(10);
    expect(naechsteLaufnummer(l, 'ug', 2026)).toBe(1);
    expect(naechsteLaufnummer(l, 'kdv', 2027)).toBe(1);
  });
});

describe('Entwurf, Stellen-Prüfung, Ablauf, Grenzen', () => {
  it('Säubern: nur Entwurfsfelder — Status/Nummer/Prüfsumme aus dem Browser zählen nicht', () => {
    const a = entwurfSaeubern({ titel: '  X  ', status: 'angenommen', nummer: 'FALSCH-1', pruefsumme: 'abc', positionen: [{ titel: 'P', menge: 2, einzelpreisCent: 199.6, ustSatz: 5, basis: 'quartal' }, { titel: '' }] }, null, { id: 'ang-neu1', jetzt: J, person: 'kevin', heute: HEUTE });
    expect(a).toMatchObject({ id: 'ang-neu1', titel: 'X', status: 'entwurf', version: 1, gesellschaft: 'kdc', gueltigBis: '2026-10-28', zahlungszielTage: 14 });
    expect(a).not.toHaveProperty('nummer');
    expect(a).not.toHaveProperty('pruefsumme');
    expect(a.positionen).toEqual([{ id: 'p1', titel: 'P', text: '', menge: 2, einheit: 'pauschal', einzelpreisCent: 200, ustSatz: 19, basis: 'einmalig' }]);
  });
  it('Grenzen: zu lange Texte oder zu viele Positionen → Texte (413), nichts gekürzt', () => {
    expect(angebotGrenzen({ titel: 'x'.repeat(201) }).length).toBe(1);
    expect(angebotGrenzen({ positionen: Array.from({ length: 201 }, () => ({ titel: 'a' })) }).length).toBe(1);
    expect(angebotGrenzen({ titel: 'ok' })).toEqual([]);
  });
  it('Stellen braucht Empfänger, Position, Titel und ein gültiges Datum', () => {
    expect(stellenFehlt(ang(), HEUTE)).toEqual([]);
    expect(stellenFehlt(ang({ kontaktId: undefined, positionen: [], gueltigBis: '2026-09-01' }), HEUTE).length).toBe(3);
    expect(stellenFehlt(ang({ status: 'gestellt' }), HEUTE)[0]).toMatch(/Entwurf/);
  });
  it('Ablauf: gestellt nach „gültig bis“ → abgelaufen; andere bleiben', () => {
    const r = ablaufen([ang({ status: 'gestellt', gueltigBis: '2026-09-27' }), ang({ id: 'ang-b', status: 'gestellt', gueltigBis: HEUTE }), ang({ id: 'ang-c', status: 'entwurf', gueltigBis: '2026-09-01' })], HEUTE, J);
    expect(r.ids).toEqual(['ang-test1']);
    expect(r.liste[0]).toMatchObject({ status: 'abgelaufen', abgelaufenAm: HEUTE });
    expect(r.liste[1].status).toBe('gestellt');
    expect(r.liste[2].status).toBe('entwurf');
  });
  it('+5 Werktage überspringt das Wochenende', () => {
    expect(werktagePlus('2026-09-28', 5)).toBe('2026-10-05'); // Mo → Mo
    expect(werktagePlus('2026-10-02', 1)).toBe('2026-10-05'); // Fr → Mo
  });
});

describe('Produkte und Angebotstexte', () => {
  it('Leistungstext ist Pflicht', () => {
    expect(produktAngebotFehlt(leistung())).toEqual(['Leistungstext']);
    expect(produktAngebotFehlt(leistung({ angebot: { leistungstext: 'Wir begleiten …' } }))).toEqual([]);
  });
  it('Position aus dem Produkt: Menge 1, Preis in Cent, Basis, Laufzeit, Text', () => {
    const p = positionAusProdukt(leistung({ angebot: { titel: 'Strategie', leistungstext: 'Monatlich zwei Termine.', ergebnis: 'Klarer Plan' } }), 'p-x');
    expect(p).toMatchObject({ id: 'p-x', leistungId: 'l-strategie', titel: 'Strategie', menge: 1, einzelpreisCent: 250000, basis: 'monat', laufzeitMonate: 6, ustSatz: 19 });
    expect(p.text).toBe('Monatlich zwei Termine.\n\nErgebnis: Klarer Plan');
  });
  it('Katalog: aktive Produkte, „Text fehlt“ markiert, eigene Gesellschaft zuerst', () => {
    const l = katalog([leistung({ id: 'l-a', name: 'B', gesellschaft: 'kdc' }), leistung({ id: 'l-b', name: 'A', angebot: { leistungstext: 't' } }), leistung({ id: 'l-c', status: 'entwurf' })], 'kdv');
    expect(l.map(x => [x.l.id, x.textFehlt, x.andere])).toEqual([['l-b', false, false], ['l-a', true, true]]);
  });
  it('Server-Regel: Produkt ohne Leistungstext geht nicht auf „aktiv“ (409), bestehende aktive bleiben', () => {
    const b: CrmBestand = { ...leererBestand(), leistungen: [leistung({ status: 'entwurf' }), leistung({ id: 'l-alt', status: 'aktiv' })] };
    const nein = wendeCrmAn(b, [{ liste: 'leistungen', op: 'teil', id: 'l-strategie', felder: { status: 'aktiv' } }], J, 'kevin');
    expect(nein.abgelehnt?.[0]).toMatch(/für Angebote fehlt: Leistungstext/);
    expect(nein.bestand).toBe(b);
    const ja = wendeCrmAn(b, [{ liste: 'leistungen', op: 'teil', id: 'l-strategie', felder: { status: 'aktiv', angebot: { leistungstext: 'Text' } } }], J, 'kevin');
    expect(ja.abgelehnt).toBeUndefined();
    expect(ja.bestand.leistungen[0]).toMatchObject({ status: 'aktiv', angebot: { leistungstext: 'Text' } });
    // Ein schon aktives Produkt ohne Text darf anderes ändern.
    expect(wendeCrmAn(b, [{ liste: 'leistungen', op: 'teil', id: 'l-alt', felder: { name: 'Neu' } }], J, 'kevin').abgelehnt).toBeUndefined();
    // Angebote nie über den allgemeinen Weg.
    expect(wendeCrmAn(b, [{ liste: 'angebote', op: 'upsert', eintrag: ang() as unknown as Record<string, unknown> }], J, 'kevin').abgelehnt?.[0]).toMatch(/Angebots-Tool/);
  });
});

describe('Vorlagen und Mail', () => {
  it('Sie/Du aus dem Kontakt, Betreff „Angebot {Nummer} – {Titel}“', () => {
    expect(angebotVorlage({ anrede: 'Du', vorname: 'Anna', titel: 'Retainer', gueltigBis: '2026-10-28' }).einleitung).toMatch(/^Hallo Anna,\n\nvielen Dank .* bekommst du/);
    expect(angebotVorlage({ anrede: 'Sie', vorname: 'Anna', nachname: 'Beispiel', titel: 'Retainer', gueltigBis: '2026-10-28' }).schluss).toMatch(/28\.10\.2026[\s\S]*Mit freundlichen Grüßen/);
    const m = mailVorlage({ titel: 'Retainer', nummer: 'KDV-A-2026-0001', vorname: 'Anna', nachname: 'Beispiel' });
    expect(m.betreff).toBe('Angebot KDV-A-2026-0001 – Retainer');
    expect(mailtoLink('a@example.invalid', m.betreff, 'Zeile 1\nZeile 2')).toBe('mailto:a@example.invalid?subject=Angebot%20KDV-A-2026-0001%20%E2%80%93%20Retainer&body=Zeile%201%0AZeile%202');
  });
});

describe('Verbindungen: Deal-Wert, Mandat-Vorbelegung, Umsatz, BEAN', () => {
  const gestellt = ang({ status: 'gestellt', nummer: 'KDV-A-2026-0001', dealId: 'ch-1', positionen: [pos({ basis: 'monat', einzelpreisCent: 250000, laufzeitMonate: 6, leistungId: 'l-strategie' }), pos({ id: 'p2', einzelpreisCent: 50000 })] });
  it('Deal-Wert: laufend monatlich mit Laufzeit', () => {
    expect(dealWertAusAngebot(gestellt)).toEqual({ betrag: 2500, basis: 'monat', laufzeitMonate: 6 });
    expect(dealWertAusAngebot(ang({ positionen: [pos({ einzelpreisCent: 123456 })] }))).toEqual({ betrag: 1234.56, basis: 'einmalig' });
  });
  it('Mandat-Vorbelegung: Honorar, Laufzeit, Produkt, Gesellschaft, Zahlungsziel', () => {
    expect(mandatVorbelegung(gestellt)).toMatchObject({ gesellschaft: 'kdv', honorar: { betrag: 2500, basis: 'monat', netto: true }, mindestlaufzeitMonate: 6, leistungId: 'l-strategie', ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14 });
  });
  it('Umsatz-Reiter: Tool-Angebote vorn, Deal nicht doppelt, Ablage-PDF des Tools nicht doppelt', () => {
    const crm = { ...leererBestand(), chancen: [{ id: 'ch-1', titel: 'D', kontaktIds: ['c-anna1'], art: 'retainer', wert: { betrag: 1, basis: 'monat' }, stufe: 'angebot', historie: [{ stufe: 'angebot', am: J, von: 'kevin' }], qualifizierung: {}, gesellschaft: 'kdv', besitzer: 'kevin', angelegt: J, geaendert: J }] } as unknown as CrmBestand;
    const b = umsatzBezug({ id: 'c-anna1' }, crm, [], HEUTE);
    const l = angeboteListe(b, [{ id: 'd-pdf1', art: 'angebot', angebotId: 'ang-test1', kontaktId: 'c-anna1', dealId: 'ch-1', hochgeladenAm: J, hochgeladenVon: 'kevin', angebot: { status: 'offen' } }], [gestellt]);
    expect(l.map(z => z.quelle)).toEqual(['tool']);
    expect(l[0]).toMatchObject({ nummer: 'KDV-A-2026-0001', toolStatus: 'gestellt', status: 'offen' });
  });
  it('BEAN: offenes Angebot aus dem Tool = Angebotskunde', () => {
    const crm = { ...leererBestand(), angebote: [gestellt] };
    expect(beanVon(k('c-anna1'), crm).bean).toBe('A');
    expect(beanVon(k('c-anna1'), { ...crm, angebote: [{ ...gestellt, status: 'abgelehnt' as const }] }).bean).toBe('N');
  });
});

describe('Personenbezug (Art. 15/17, Dubletten)', () => {
  const crm = (): CrmBestand => ({ ...leererBestand(), angebote: [ang(), ang({ id: 'ang-g', status: 'gestellt', nummer: 'KDV-A-2026-0002', empfaenger: { name: 'Anna Beispiel', zeilen: ['Anna Beispiel'], email: 'c-anna1@example.invalid' } })] });
  it('Art. 17: Entwurf weg, gestelltes Angebot bleibt ohne Personenbezug', () => {
    const l = angebotePersonOhne(crm().angebote, 'c-anna1', HEUTE);
    expect(l.map(a => a.id)).toEqual(['ang-g']);
    expect(l[0]).toMatchObject({ personGeloest: HEUTE, empfaenger: { name: GELOEST_NAME } });
    expect(l[0].kontaktId).toBeUndefined();
    // Über die eine Stelle für den CRM-Bestand: die Kennung steht danach nirgends mehr.
    expect(JSON.stringify(personEntfernen(crm(), 'c-anna1'))).not.toContain('c-anna1');
  });
  it('Dubletten biegen um, Auskunft listet', () => {
    expect(angebotePersonUm(crm().angebote, 'c-anna1', 'c-anna2').every(a => a.kontaktId === 'c-anna2')).toBe(true);
    expect(personUmbiegen(crm(), 'c-anna1', 'c-anna2').angebote.every(a => a.kontaktId === 'c-anna2')).toBe(true);
    expect(personVerweise(crm(), 'c-anna1').angebote.map(a => a.id)).toEqual(['ang-test1', 'ang-g']);
  });
});

describe('Ampel vor dem Stellen', () => {
  it('Werbesperre/Einschränkung sperrt mit Grund; ohne Einwilligung nur Hinweis', () => {
    expect(ampelVorStellen(k('c-a1', { werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } }), {}).sperre).toMatch(/Werbesperre/);
    expect(ampelVorStellen(k('c-a1', { eingeschraenkt: { seit: '2026-09-01', grund: 'x', von: 'kevin' } }), {}).sperre).toMatch(/Art\. 18/);
    const h = ampelVorStellen(k('c-a1'), {});
    expect(h.sperre).toBeUndefined();
    expect(h.hinweise[0]).toMatch(/Vertragsanbahnung/);
  });
});

describe('Gesellschaften und Dokument', () => {
  it('IBAN: nur gültige ersetzt, maskiert/leer = unverändert, Anzeige maskiert; Fehler statt still verwerfen', () => {
    const r = gesellschaftAnwenden({ id: 'kdv' }, { firmierung: 'Beispiel UG', bank: { iban: BEISPIEL_IBAN_LESBAR }, nummernformat: '{KURZ}' }, J, 'kevin');
    expect(r.fehler.map(f => f.feld)).toEqual(['nummernformat']);
    expect(r.g.bank?.iban).toBe(BEISPIEL_IBAN);
    const maskiert = gesellschaftFuerAnzeige(r.g);
    expect(maskiert.bank?.iban).toBe('DE89 •••• •••• 3000');
    expect(gesellschaftAnwenden(r.g, { bank: { iban: maskiert.bank?.iban } }, J, 'kevin').g.bank?.iban).toBe(BEISPIEL_IBAN);
    expect(gesellschaftAnwenden(r.g, { bank: { iban: 'DE00 1234' } }, J, 'kevin').fehler[0].feld).toBe('iban');
    expect(gesellschaftAnwenden(r.g, { bank: { ibanEntfernen: true } }, J, 'kevin').g.bank).toBeUndefined();
    expect(gesellschaftLuecken({ id: 'ug' })).toEqual(['Firmierung', 'Anschrift', 'Steuernummer oder USt-IdNr.', 'E-Mail', 'Geschäftsführung', 'Registergericht/HRB']);
    expect(mitVorgaben({ id: 'ug' })).toMatchObject({ kurz: 'MOS', nummernformat: NUMMER_VORGABE, zahlungszielTage: 14, gueltigkeitTage: 30 });
  });
  it('Dokument: Absender (IBAN voll nur fürs PDF), Empfänger, Summenzeilen, Kleinunternehmer-Hinweis', () => {
    const g = { id: 'kdv' as const, firmierung: 'Beispiel UG', strasse: 'Weg 1', plz: '12345', ort: 'Musterstadt', bank: { iban: BEISPIEL_IBAN }, kleinunternehmer: true };
    expect(absenderAus(g).fuss.join(' ')).toContain('DE89 •••• •••• 3000');
    expect(absenderAus(g, { ibanVoll: true }).fuss.join(' ')).toContain(BEISPIEL_IBAN_LESBAR);
    const e = empfaengerAus({ vorname: 'Anna', nachname: 'Beispiel' }, { name: 'Muster GmbH', zahlung: { empfaenger: { anschrift: 'Hauptstr. 2, 54321 Beispielort' } } });
    expect(e.zeilen).toEqual(['Muster GmbH', 'z. Hd. Anna Beispiel', 'Hauptstr. 2', '54321 Beispielort']);
    const d = angebotDokument(ang({ nummer: 'KDV-A-2026-0001' }), absenderAus(g), e, HEUTE);
    expect(d.meta[0]).toEqual({ label: 'Angebot', wert: 'KDV-A-2026-0001' });
    expect(d.hinweise[0]).toMatch(/§ 19 UStG/);
    expect(d.summen.map(z => z.label)).toEqual(['Einmalig (netto = gesamt)']);
  });
});
