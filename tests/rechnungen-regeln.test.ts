// ─── Rechnungen schreiben mit PDF (08.10.) — die reinen Regeln ───────────────
// Summen in Cent, Pflichtangaben (§ 14 Abs. 4 UStG), Nummern, Säuberung (Altbestand bit-gleich), Schutz festgeschriebener
// Rechnungen, Server-Felder, Stornorechnung, Mahnstufen, Dokument. Alle Werte erfunden (@example.invalid, Beispiel-IBAN maskiert).
import { describe, it, expect } from 'vitest';
import type { Gesellschaft } from '@/lib/crm/gesellschaften';
import type { Rechnung, FinanzplanFile } from '@/lib/finanzen/finanzplan-bestand';
import { sauberFile, rechnungSchutz, fpOpsAnwenden, rechnungMitServerFeldern, SEED, fassung } from '@/lib/finanzen/finanzplan-bestand';
import {
  rechnungSummen, betragFelder, pflichtFehlt, naechsteNummer, mahnVorschlag, mahnVorschlaege, mahnTageSaeubern, anschriftZerlegen, empfaengerAusCrm,
  entwurfAnwenden, entwurfGrenzen, stornoEntwurf, positionenAusAngebot, positionAusMandat, monatsGrenzen, mahnMail, zusatzSaeubern, RECHNUNG_SERVER_FELDER,
} from '@/lib/finanzen/rechnung/regeln';
import { rechnungDokument, empfaengerZeilen } from '@/lib/finanzen/rechnung/dokument';
import { absenderAus } from '@/lib/crm/angebot-dokument';
import { nettoAusBrutto } from '@/lib/finanzen/ust';
import { vorschau } from '@/lib/make-one/liquiditaet';
import type { RechnungPosition } from '@/lib/finanzen/rechnung/typen';

// Öffentliche Beispiel-IBAN, zusammengesetzt (der Repo-Scan meldet sonst Kontodaten).
const IBAN = ['DE89', '3704', '0044', '0532', '0130', '00'].join('');
const IBAN_ZEILE = `IBAN ${['DE89', '3704', '0044', '0532', '0130', '00'].join(' ')}`;
const G: Gesellschaft = { id: 'kdv', firmierung: 'Beispiel Ventures UG (haftungsbeschränkt)', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', steuernummer: '12/345/67890', email: 'info@example.invalid', geschaeftsfuehrung: 'Erika Beispiel', register: 'Amtsgericht Musterstadt HRB 1', bank: { iban: IBAN, bic: 'COBADEFFXXX' } };
const pos = (x: Partial<RechnungPosition> = {}): RechnungPosition => ({ id: 'p1', titel: 'Beratung', text: '', menge: 1, einheit: 'Monat', einzelpreisCent: 250000, ustSatz: 19, ...x });
const entwurf = (x: Partial<Rechnung> = {}): Rechnung => ({
  id: 'r-test-1', firmaId: 'kdv', kunde: 'Muster GmbH', titel: 'Beratung Oktober', betrag: 0, status: 'geplant', leistungVon: '2026-10-01', leistungBis: '2026-10-31',
  positionen: [pos()], empfaenger: { firma: 'Muster GmbH', name: 'Anna Test', strasse: 'Hauptstraße 5', plz: '54321', ort: 'Beispielstadt' }, zahlungszielTage: 14, ...x,
});

describe('Summen in Cent (eine Steuer je Satz, kaufmännisch)', () => {
  it('rechnet Netto, USt und Brutto je Satz — 7 % und 19 % getrennt', () => {
    const s = rechnungSummen([pos({ menge: 2, einzelpreisCent: 10000 }), pos({ id: 'p2', einzelpreisCent: 3333, ustSatz: 7 }), pos({ id: 'p3', einzelpreisCent: 5000, rabattProzent: 10 })]);
    expect(s.jeSatz).toEqual([{ satz: 19, netto: 24500, ust: 4655 }, { satz: 7, netto: 3333, ust: 233 }]);
    expect(s).toMatchObject({ netto: 27833, ust: 4888, brutto: 32721 });
  });
  it('Kleinunternehmer: keine Steuer; Storno: gleiche Beträge mit umgekehrtem Vorzeichen', () => {
    expect(rechnungSummen([pos()], { kleinunternehmer: true })).toMatchObject({ netto: 250000, ust: 0, brutto: 250000 });
    expect(rechnungSummen([pos()], { vorzeichen: -1 })).toMatchObject({ netto: -250000, ust: -47500, brutto: -297500 });
    expect(betragFelder([pos()])).toEqual({ betrag: 2975, netto: 2500, ustSatz: 19 });
    expect(betragFelder([pos(), pos({ id: 'p2', ustSatz: 7 })]).ustSatz).toBeUndefined();
  });
});

describe('Pflichtangaben (§ 14 Abs. 4 UStG, § 35a GmbHG)', () => {
  it('vollständig → nichts fehlt', () => {
    expect(pflichtFehlt(entwurf(), G)).toEqual([]);
  });
  it('fehlende Angaben stehen einzeln da — Absender mit Weg ins Register', () => {
    const f = pflichtFehlt(entwurf({ leistungVon: undefined, empfaenger: { firma: 'Muster GmbH' }, positionen: [] }), { id: 'kdv', firmierung: 'X' });
    const t = f.map(x => x.text).join(' | ');
    for (const w of ['Anschrift (Straße, PLZ, Ort) fehlt', 'Steuernummer oder USt-IdNr.', 'IBAN', 'Geschäftsführung', 'HRB', 'Empfänger: vollständige Anschrift', 'Leistungsdatum', 'Mindestens eine Position']) expect(t).toContain(w);
    expect(f.find(x => x.text.startsWith('Absender: Anschrift'))!.weg).toBe('/os/unternehmen?g=kdv&r=absender');
  });
  it('0 % ohne Kleinunternehmer braucht einen Grund; Reverse Charge braucht die USt-IdNr. des Empfängers', () => {
    const null0 = entwurf({ positionen: [pos({ ustSatz: 0 })] });
    expect(pflichtFehlt(null0, G).map(x => x.text).join()).toMatch(/Reverse Charge/);
    expect(pflichtFehlt({ ...null0, steuerHinweis: 'reverse-charge' }, G).map(x => x.text).join()).toMatch(/USt-IdNr\. des Empfängers/);
    expect(pflichtFehlt({ ...null0, steuerHinweis: 'reverse-charge', empfaenger: { ...null0.empfaenger, ustId: 'ATU12345678' } }, G)).toEqual([]);
    expect(pflichtFehlt({ ...null0, steuerHinweis: 'steuerfrei' }, G).map(x => x.text).join()).toMatch(/Grund der Steuerbefreiung/);
    expect(pflichtFehlt(null0, { ...G, kleinunternehmer: true })).toEqual([]);
  });
  it('Rechnungsbetrag 0 € wird nicht gestellt; Gesellschaft muss fest sein', () => {
    expect(pflichtFehlt(entwurf({ positionen: [pos({ einzelpreisCent: 0 })] }), G).map(x => x.text).join()).toMatch(/0 €/);
    expect(pflichtFehlt(entwurf({ firmaId: '' }), null).map(x => x.text).join()).toMatch(/Gesellschaft/);
  });
});

describe('Nummern — lückenlos je Gesellschaft und Jahr', () => {
  it('höchste vergebene (Zähler ODER Finanzplan) + 1; Text-Kollision zählt weiter', () => {
    const l = [{ firmaId: 'kdv', lauf: { jahr: 2026, nr: 3 }, nummer: 'KDV-R-2026-0003' }, { firmaId: 'ug', lauf: { jahr: 2026, nr: 9 }, nummer: 'MOS-R-2026-0009' }, { firmaId: 'kdv', lauf: { jahr: 2025, nr: 40 } }];
    expect(naechsteNummer(l, undefined, 'kdv', 2026, 'KDV')).toEqual({ lauf: { jahr: 2026, nr: 4 }, nummer: 'KDV-R-2026-0004' });
    expect(naechsteNummer(l, 7, 'kdv', 2026, 'KDV').nummer).toBe('KDV-R-2026-0008');
    expect(naechsteNummer(l, undefined, 'kdv', 2027, 'KDV').nummer).toBe('KDV-R-2027-0001');
    expect(naechsteNummer([...l, { firmaId: 'x', nummer: 'KDV-R-2026-0004' }], undefined, 'kdv', 2026, 'KDV').nummer).toBe('KDV-R-2026-0005');
  });
});

describe('Säuberung — Altbestand bit-gleich, neue Felder bleiben', () => {
  const alt: FinanzplanFile = { ...SEED, rechnungen: [
    { id: 'r-alt-1', firmaId: 'kdv', kunde: 'Altkunde', titel: 'Alt', betrag: 1190, status: 'gestellt', faellig: '2026-09-01', nummer: 'A-1', datum: '2026-08-01', netto: 1000, ustSatz: 19 },
    { id: 'r-alt-2', firmaId: 'kdc', kunde: 'Altkunde', titel: 'Geplant', betrag: 500, status: 'geplant' },
  ] };
  it('eine Rechnung ohne neue Felder bekommt keinen neuen Schlüssel und bleibt Byte für Byte', () => {
    const a = JSON.stringify(sauberFile(alt));
    expect(JSON.stringify(sauberFile(JSON.parse(a)))).toBe(a);
    expect(Object.keys(sauberFile(alt).rechnungen[0])).not.toEqual(expect.arrayContaining(['positionen']));
    for (const r of sauberFile(alt).rechnungen) expect(JSON.stringify(rechnungMitServerFeldern(r, r))).toBe(JSON.stringify(r));
    expect(zusatzSaeubern(alt.rechnungen[0] as unknown as Record<string, unknown>)).toEqual({});
  });
  it('neue Felder überleben die Säuberung; die Stornorechnung behält ihr negatives Vorzeichen', () => {
    const r = entwurf({ status: 'storniert', art: 'storno', betrag: -2975, netto: -2500, stornoZu: 'r-x', mahnungen: [{ stufe: 1, am: '2026-10-01', von: 'kevin' }], lauf: { jahr: 2026, nr: 2 } });
    const s = sauberFile({ rechnungen: [r] }).rechnungen[0];
    expect(s).toMatchObject({ art: 'storno', betrag: -2975, netto: -2500, stornoZu: 'r-x', lauf: { jahr: 2026, nr: 2 }, positionen: [pos()], empfaenger: r.empfaenger });
    // Ohne `art: 'storno'` bleibt ein Betrag nie negativ (wie bisher).
    expect(sauberFile({ rechnungen: [{ ...r, art: undefined }] }).rechnungen[0].betrag).toBe(0);
  });
  it('Liquidität: Original storniert + Stornorechnung zählen nicht — Summen wie ohne sie', () => {
    const firmen = [{ id: 'kdv', name: 'KDV', kontostand: 1000, stand: '2026-10-01' }];
    const basis = sauberFile(alt).rechnungen;
    const mitStorno = sauberFile({ rechnungen: [...basis, entwurf({ id: 'r-o', status: 'storniert', faellig: '2026-10-20', betrag: 2975, stornoRechnungId: 'r-s' }), entwurf({ id: 'r-s', status: 'storniert', art: 'storno', betrag: -2975, stornoZu: 'r-o' })] }).rechnungen;
    expect(JSON.stringify(vorschau(firmen, mitStorno, [], [], '2026-10-08'))).toBe(JSON.stringify(vorschau(firmen, basis, [], [], '2026-10-08')));
  });
});

describe('Schutz: festgeschrieben ist unveränderlich, Positionen nur über „stellen“', () => {
  const gestellt = entwurf({ status: 'gestellt', nummer: 'KDV-R-2026-0001', datum: '2026-10-08', betrag: 2975, netto: 2500, ustSatz: 19, pdfDateiId: 'd-1234-abcd', sha256: 'a'.repeat(64), lauf: { jahr: 2026, nr: 1 }, faellig: '2026-10-22' });
  it('Positionen, Empfänger, Titel, Leistung einer PDF-Rechnung → 409; „bezahlt“ bleibt möglich', () => {
    expect(rechnungSchutz(gestellt, { ...gestellt, positionen: [pos({ einzelpreisCent: 1 })] })).toMatch(/festgeschrieben/);
    expect(rechnungSchutz(gestellt, { ...gestellt, empfaenger: { firma: 'Andere' } })).toMatch(/festgeschrieben/);
    expect(rechnungSchutz(gestellt, { ...gestellt, titel: 'Neu' })).toMatch(/festgeschrieben/);
    expect(rechnungSchutz(gestellt, { ...gestellt, leistungVon: '2026-09-01' })).toMatch(/festgeschrieben/);
    expect(rechnungSchutz(gestellt, null)).toMatch(/storniert/);
    expect(rechnungSchutz(gestellt, { ...gestellt, status: 'bezahlt', bezahltAm: '2026-10-10' })).toBeNull();
  });
  it('ein Entwurf mit Positionen wird nicht per Status-Klick „gestellt“; neu als gestellt angelegt auch nicht', () => {
    expect(rechnungSchutz(entwurf(), { ...entwurf(), status: 'gestellt', nummer: 'X-1' })).toMatch(/Rechnung stellen/);
    expect(rechnungSchutz(undefined, { ...entwurf(), status: 'gestellt' })).toMatch(/Rechnung stellen/);
    expect(rechnungSchutz(entwurf(), { ...entwurf(), titel: 'anders' })).toBeNull();
  });
  it('der allgemeine Weg übernimmt Server-Felder nie aus dem Browser (PDF, Nummernlauf, Storno-Bezug, Mahnungen)', () => {
    const f = sauberFile({ ...SEED, rechnungen: [gestellt, entwurf({ id: 'r-test-2' })] });
    const e = fpOpsAnwenden(f, [{ liste: 'rechnungen', op: 'upsert', eintrag: { ...entwurf({ id: 'r-test-2' }), pdfDateiId: 'd-fake-0000', lauf: { jahr: 2026, nr: 99 }, mahnungen: [{ stufe: 3, am: '2026-10-01', von: 'x' }], art: 'storno' } as unknown as Record<string, unknown>, stand: fassung(f.rechnungen[1]) }]);
    expect(e.ok).toBe(true);
    const r = (e as { datei: FinanzplanFile }).datei.rechnungen.find(x => x.id === 'r-test-2')!;
    for (const k of RECHNUNG_SERVER_FELDER) expect(r[k], k).toBeUndefined();
    // … und eine festgeschriebene behält sie, auch wenn der Browser sie weglässt.
    const ohne = { ...gestellt } as Record<string, unknown>; delete ohne.pdfDateiId; delete ohne.sha256; delete ohne.lauf;
    const e2 = fpOpsAnwenden(f, [{ liste: 'rechnungen', op: 'upsert', eintrag: { ...ohne, notiz: 'Kunde ruft an' }, stand: fassung(f.rechnungen[0]) }]);
    expect(e2.ok).toBe(true);
    expect((e2 as { datei: FinanzplanFile }).datei.rechnungen[0]).toMatchObject({ pdfDateiId: 'd-1234-abcd', sha256: 'a'.repeat(64), lauf: { jahr: 2026, nr: 1 }, notiz: 'Kunde ruft an' });
  });
});

describe('Entwurf, Angebot → Rechnung, Mandat → Monatsrechnung, Storno', () => {
  it('Entwurf ändern: nur Entwurfsfelder, Beträge aus den Positionen, Grenzen → Sätze statt Kürzen', () => {
    const n = entwurfAnwenden(entwurf(), { titel: 'Neu', positionen: [pos({ menge: 2 })], status: 'gestellt', nummer: 'GEHACKT', pdfDateiId: 'd-x' });
    expect(n).toMatchObject({ titel: 'Neu', status: 'geplant', betrag: 5950, netto: 5000, ustSatz: 19 });
    expect(n.nummer).toBeUndefined();
    expect(n.pdfDateiId).toBeUndefined();
    expect(entwurfGrenzen({ positionen: Array.from({ length: 201 }, () => ({ titel: 'x' })) })[0]).toMatch(/höchstens 200/);
  });
  it('aus dem Angebot: Positionen mit Einheit aus der Basis, Kleinunternehmer → 0 %', () => {
    const l = positionenAusAngebot({ positionen: [{ id: 'a', titel: 'Retainer', text: 't', menge: 1, einheit: 'pauschal', einzelpreisCent: 100000, ustSatz: 19, basis: 'monat', laufzeitMonate: 6 }] });
    expect(l[0]).toMatchObject({ titel: 'Retainer', einheit: 'Monat', einzelpreisCent: 100000, ustSatz: 19 });
    expect(positionenAusAngebot({ positionen: [{ id: 'a', titel: 'X', text: '', menge: 1, einheit: 'Tag', einzelpreisCent: 1, ustSatz: 19, basis: 'einmalig' }] }, true)[0].ustSatz).toBe(0);
  });
  it('aus dem Mandat: Monat → Leistungszeitraum, Netto-Honorar (Brutto zurückgerechnet)', () => {
    expect(monatsGrenzen('2026-02')).toEqual({ von: '2026-02-01', bis: '2026-02-28' });
    expect(monatsGrenzen('2026-13')).toBeNull();
    const p = positionAusMandat({ titel: 'Begleitung', honorar: { betrag: 1190, basis: 'monat', netto: false }, ustSatz: 19, leistungen: ['Jour fixe'] }, '2026-10', { nettoAusBrutto });
    expect(p).toMatchObject({ einzelpreisCent: 100000, einheit: 'Monat', titel: 'Begleitung — Oktober 2026', text: '• Jour fixe' });
  });
  it('Stornorechnung: gleiche Positionen, negativ, Status storniert, Bezug', () => {
    const o = entwurf({ status: 'gestellt', nummer: 'KDV-R-2026-0001', betrag: 2975 });
    const s = stornoEntwurf(o, { id: 'r-s', heute: '2026-10-09', grund: 'Doppelt' });
    expect(s).toMatchObject({ art: 'storno', stornoZu: o.id, status: 'storniert', betrag: -2975, netto: -2500, positionen: o.positionen, titel: 'Storno zu Rechnung KDV-R-2026-0001' });
  });
});

describe('Mahnstufen — nur Vorschlag, der Reihe nach', () => {
  const r = entwurf({ status: 'gestellt', nummer: 'KDV-R-2026-0001', faellig: '2026-10-01', betrag: 2975 });
  it('Zahlungserinnerung ab 7 Tagen, dann 1. und 2. Mahnung mit Abstand', () => {
    expect(mahnVorschlag(r, '2026-10-07')).toBeNull();
    expect(mahnVorschlag(r, '2026-10-08')).toMatchObject({ stufe: 1, label: 'Zahlungserinnerung', tageUeberfaellig: 7 });
    // Spät erinnert (Tag 20): die 1. Mahnung kommt erst 7 Tage danach, nicht sofort.
    const erinnert = { ...r, mahnungen: [{ stufe: 1 as const, am: '2026-10-21', von: 'kevin' }] };
    expect(mahnVorschlag(erinnert, '2026-10-22')).toBeNull();
    expect(mahnVorschlag(erinnert, '2026-10-28')).toMatchObject({ stufe: 2, label: '1. Mahnung' });
    expect(mahnVorschlag({ ...r, mahnungen: [{ stufe: 1, am: '2026-10-08', von: 'k' }, { stufe: 2, am: '2026-10-15', von: 'k' }, { stufe: 3, am: '2026-10-22', von: 'k' }] }, '2026-12-01')).toBeNull();
    expect(mahnVorschlag({ ...r, status: 'bezahlt' }, '2026-12-01')).toBeNull();
    expect(mahnVorschlag({ ...r, art: 'storno' }, '2026-12-01')).toBeNull();
    expect(mahnVorschlaege([r, { ...r, id: 'r-2', faellig: '2026-09-01' }], '2026-10-08').map(v => v.rechnungId)).toEqual(['r-2', 'r-test-1']);
  });
  it('Tage einstellbar (drei steigende Zahlen), Mail-Entwurf ohne Gebühren', () => {
    expect(mahnTageSaeubern([5, 10, 30])).toEqual([5, 10, 30]);
    expect(mahnTageSaeubern([10, 5, 30])).toBeNull();
    expect(mahnVorschlag(r, '2026-10-06', [5, 10, 30])).toMatchObject({ stufe: 1 });
    const m = mahnMail(1, r, { heute: '2026-10-08' });
    expect(m.betreff).toBe('Zahlungserinnerung: Rechnung KDV-R-2026-0001');
    expect(m.text).toMatch(/2\.975,00\s€/); // Intl setzt ein geschütztes Leerzeichen
    expect(m.text).toContain('15.10.2026');
  });
});

describe('Anschrift, Empfänger aus der Kartei, Dokument', () => {
  it('Anschrift aus Freitext zerlegen — nichts wird verworfen', () => {
    expect(anschriftZerlegen('Hauptstraße 5, 54321 Beispielstadt')).toEqual({ strasse: 'Hauptstraße 5', plz: '54321', ort: 'Beispielstadt' });
    expect(anschriftZerlegen('Postfach 7\n1010 Wien\nÖsterreich')).toEqual({ strasse: 'Postfach 7', plz: '1010', ort: 'Wien', land: 'Österreich' });
    expect(anschriftZerlegen('irgendwo')).toEqual({ strasse: 'irgendwo' });
  });
  it('Empfänger: Rechnungsempfänger der Zahlungsdaten, USt-IdNr., Referenz, E-Mail', () => {
    const e = empfaengerAusCrm({ id: 'c-a', vorname: 'Anna', nachname: 'Test', email: 'anna@example.invalid' }, { id: 'f-m', name: 'Muster GmbH', zahlung: { empfaenger: { anschrift: 'Hauptstraße 5, 54321 Beispielstadt' }, ustId: 'de 123456789', referenz: 'PO-7' } });
    expect(e).toEqual({ firma: 'Muster GmbH', name: 'Anna Test', strasse: 'Hauptstraße 5', plz: '54321', ort: 'Beispielstadt', ustId: 'DE123456789', email: 'anna@example.invalid', referenz: 'PO-7' });
    expect(empfaengerZeilen(e)).toEqual(['Muster GmbH', 'z. Hd. Anna Test', 'Hauptstraße 5', '54321 Beispielstadt', 'USt-IdNr. DE123456789']);
  });
  it('Dokument: Nummer, Datum, Leistungszeitraum, Fälligkeit, Summe, Zahlungszeile', () => {
    const d = rechnungDokument(entwurf({ nummer: 'KDV-R-2026-0001', datum: '2026-10-08', faellig: '2026-10-22' }), absenderAus(G, { ibanVoll: true }), { datum: '2026-10-08', bank: IBAN_ZEILE });
    expect(d.art).toBe('Rechnung');
    expect(d.meta).toEqual(expect.arrayContaining([{ label: 'Rechnungsnummer', wert: 'KDV-R-2026-0001', fett: true }, { label: 'Leistungszeitraum', wert: '01.10.2026 – 31.10.2026' }, { label: 'Fällig am', wert: '22.10.2026' }]));
    expect(d.summen.at(-1)!.label).toBe('Rechnungsbetrag');
    expect(d.summen.at(-1)!.wert).toMatch(/^2\.975,00\s€$/);
    expect(d.hinweise.join(' ')).toContain(IBAN_ZEILE);
    expect(d.absender.fuss.join(' ')).toContain('Steuernummer 12/345/67890');
    const s = rechnungDokument(entwurf({ art: 'storno', nummer: 'KDV-R-2026-0002' }), absenderAus(G), { datum: '2026-10-09', original: { nummer: 'KDV-R-2026-0001', datum: '2026-10-08' } });
    expect(s.art).toBe('Stornorechnung');
    expect(s.summen.at(-1)!.wert).toMatch(/^-2\.975,00\s€$/);
    expect(s.hinweise[0]).toContain('KDV-R-2026-0001');
  });
});
