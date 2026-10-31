// ─── E-Rechnung (31.10.) — rein: CII-XML nach EN 16931, Rundweg, Kategorien, Einbetten/Auslesen, sicherer XML-Leser ─
// Alles erfunden (example.invalid, öffentliche Beispiel-IBAN zusammengesetzt). Kein offizieller Validator offline — geprüft werden die
// Geschäftsbegriffe (BT), die MAKE OS befüllt, und dass Erzeugen → Einlesen dieselben Beträge ergibt.
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import type { Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import type { Gesellschaft } from '@/lib/crm/gesellschaften';
import { ciiXml, einheitCode, profilWechseln, leitwegEinsetzen, SPEZIFIKATION, FACTURX_DATEI } from '@/lib/finanzen/erechnung/cii';
import { eRechnungLesen, siehtNachERechnungAus } from '@/lib/finanzen/erechnung/lesen';
import { xmlLesen, XmlFehler, XML_MAX_ZEICHEN, kind, text } from '@/lib/finanzen/erechnung/xml';
import { en16931Luecken, xrechnungLuecken, leitwegIdOk } from '@/lib/finanzen/erechnung/pruefen';
import { facturXEinbetten, eingebetteteXml } from '@/lib/finanzen/erechnung/pdf';
import { belegAusERechnung } from '@/lib/finanzen/erechnung/beleg';
import { landCode } from '@/lib/finanzen/erechnung/land';
import { pflichtFehlt, rechnungSummen } from '@/lib/finanzen/rechnung/regeln';
import { rechnungDokument, bankZeile } from '@/lib/finanzen/rechnung/dokument';
import { absenderAus } from '@/lib/crm/angebot-dokument';
import { belegPdf } from '@/lib/crm/angebot-pdf';

const IBAN = ['DE89', '3704', '0044', '0532', '0130', '00'].join('');

const g: Gesellschaft = {
  id: 'kdv', firmierung: 'Beispiel Ventures UG (haftungsbeschränkt)', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt',
  email: 'info@example.invalid', telefon: '+49 30 1234567', steuernummer: '12/345/67890', ustId: 'DE123456789',
  geschaeftsfuehrung: 'Erika Beispiel', register: 'Amtsgericht Musterstadt HRB 1', bank: { iban: IBAN, bic: 'COBADEFFXXX', bank: 'Beispielbank', inhaber: 'Beispiel Ventures UG' },
};

const basis = (x: Partial<Rechnung> = {}): Rechnung => ({
  id: 'r-test1', firmaId: 'kdv', kunde: 'Muster GmbH', titel: 'Beratung', betrag: 0, status: 'gestellt', nummer: 'KDV-R-2026-0007', datum: '2026-10-31', faellig: '2026-11-14',
  leistungVon: '2026-10-01', leistungBis: '2026-10-31', zahlungszielTage: 14,
  empfaenger: { firma: 'Muster GmbH', name: 'Anna Test', strasse: 'Hauptstraße 5', plz: '54321', ort: 'Beispielstadt', email: 'buchhaltung@example.invalid', referenz: 'PO-7', kundennummer: 'K-0003' },
  positionen: [
    { id: 'p1', titel: 'Workshop', text: 'Zwei Tage vor Ort', menge: 2, einheit: 'Tag', einzelpreisCent: 120000, ustSatz: 19, artikelnummer: 'WS-01' },
    { id: 'p2', titel: 'Fachbuch', text: '', menge: 3, einheit: 'Stück', einzelpreisCent: 3333, ustSatz: 7, rabattProzent: 10 },
  ],
  ...x,
} as Rechnung);

describe('Ausgang: CII-XML nach EN 16931', () => {
  it('befüllt die Pflicht-Geschäftsbegriffe (BT) — die eigene Prüfung findet keine Lücke', () => {
    const xml = ciiXml({ r: basis(), g, kleinunternehmer: false });
    expect(en16931Luecken(xml)).toEqual([]);
    const w = xmlLesen(xml);
    expect(text(w, 'ExchangedDocumentContext', 'GuidelineSpecifiedDocumentContextParameter', 'ID')).toBe(SPEZIFIKATION.en16931); // BT-24
    expect(text(w, 'ExchangedDocument', 'ID')).toBe('KDV-R-2026-0007'); // BT-1
    expect(text(w, 'ExchangedDocument', 'TypeCode')).toBe('380'); // BT-3
    expect(text(w, 'ExchangedDocument', 'IssueDateTime', 'DateTimeString')).toBe('20261031'); // BT-2
    const tx = kind(w, 'SupplyChainTradeTransaction');
    const seller = kind(tx, 'ApplicableHeaderTradeAgreement', 'SellerTradeParty');
    expect(text(seller, 'Name')).toBe(g.firmierung); // BT-27
    expect(xml).toContain('<ram:ID schemeID="VA">DE123456789</ram:ID>'); // BT-31
    expect(xml).toContain('<ram:ID schemeID="FC">12/345/67890</ram:ID>'); // BT-32
    expect(text(seller, 'PostalTradeAddress', 'CountryID')).toBe('DE'); // BT-40
    const buyer = kind(tx, 'ApplicableHeaderTradeAgreement', 'BuyerTradeParty');
    expect(text(buyer, 'Name')).toBe('Muster GmbH'); // BT-44
    expect(text(buyer, 'ID')).toBe('K-0003'); // BT-46
    expect(text(tx, 'ApplicableHeaderTradeAgreement', 'BuyerOrderReferencedDocument', 'IssuerAssignedID')).toBe('PO-7'); // BT-13
    const st = kind(tx, 'ApplicableHeaderTradeSettlement');
    expect(text(st, 'SpecifiedTradePaymentTerms', 'DueDateDateTime', 'DateTimeString')).toBe('20261114'); // BT-9
    expect(text(st, 'BillingSpecifiedPeriod', 'StartDateTime', 'DateTimeString')).toBe('20261001'); // BT-73
    expect(text(st, 'BillingSpecifiedPeriod', 'EndDateTime', 'DateTimeString')).toBe('20261031'); // BT-74
    expect(text(st, 'SpecifiedTradeSettlementPaymentMeans', 'TypeCode')).toBe('58'); // BT-81
    expect(text(st, 'SpecifiedTradeSettlementPaymentMeans', 'PayeePartyCreditorFinancialAccount', 'IBANID')).toBe(IBAN); // BT-84 — nur hier voll
    expect(text(st, 'PaymentReference')).toBe('KDV-R-2026-0007'); // BT-83
    expect(xml).toContain('<ram:SellerAssignedID>WS-01</ram:SellerAssignedID>'); // BT-155
    expect(xml).toContain('unitCode="DAY"');
    expect(xml).toContain('unitCode="H87"');
  });

  it('Summen auf den Cent wie im PDF: Steuer je Satz, Rabatt als Positionsabschlag', () => {
    const r = basis();
    const s = rechnungSummen(r.positionen!);
    const xml = ciiXml({ r, g, kleinunternehmer: false });
    // 3 × 33,33 = 99,99 − 10 % = 89,99 (kaufmännisch); Abschlag 10,00
    expect(xml).toContain('<ram:ActualAmount>10.00</ram:ActualAmount>');
    expect(xml).toContain('<ram:LineTotalAmount>89.99</ram:LineTotalAmount>');
    const e = eRechnungLesen(xml)!;
    expect(e.netto).toBe(s.netto / 100);
    expect(e.ust).toBe(s.ust / 100);
    expect(e.brutto).toBe(s.brutto / 100);
    expect(e.zahlbar).toBe(s.brutto / 100);
    expect(e.saetze.sort()).toEqual([19, 7].sort());
    // Je Satz eine Kategorie S (19 und 7)
    const w = xmlLesen(xml);
    const steuern = kind(w, 'SupplyChainTradeTransaction', 'ApplicableHeaderTradeSettlement')!.kinder.filter(k => k.name === 'ApplicableTradeTax');
    expect(steuern.map(x => text(x, 'CategoryCode'))).toEqual(['S', 'S']);
    expect(steuern.map(x => text(x, 'CalculatedAmount'))).toEqual(s.jeSatz.map(x => (x.ust / 100).toFixed(2)));
  });

  it('Rundweg: erzeugen → einlesen ergibt Nummer, Datum, Fälligkeit, Parteien, Beträge', () => {
    const r = basis();
    const e = eRechnungLesen(ciiXml({ r, g, kleinunternehmer: false }))!;
    expect(e).toMatchObject({ format: 'cii', xrechnung: false, gutschrift: false, nummer: r.nummer, datum: r.datum, faellig: r.faellig, waehrung: 'EUR', leistungVon: '2026-10-01', leistungBis: '2026-10-31' });
    expect(e.verkaeufer).toEqual({ name: g.firmierung, ustId: 'DE123456789', steuernummer: '12/345/67890' });
    expect(e.kaeufer.name).toBe('Muster GmbH');
    expect(e.zweck).toBe('Workshop, Fachbuch');
  });

  it('Kleinunternehmer (§ 19 UStG): Kategorie E mit Grund, 0 % Steuer, Hinweis', () => {
    const r = basis({ positionen: [{ id: 'p1', titel: 'Beratung', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 50000, ustSatz: 0 }] });
    const xml = ciiXml({ r, g: { ...g, kleinunternehmer: true }, kleinunternehmer: true });
    expect(en16931Luecken(xml)).toEqual([]);
    expect(xml).toContain('<ram:CategoryCode>E</ram:CategoryCode>');
    expect(xml).toContain('§ 19 UStG');
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">0.00</ram:TaxTotalAmount>');
    expect(xml).toContain('unitCode="LS"');
    expect(eRechnungLesen(xml)!.brutto).toBe(500);
  });

  it('Reverse Charge (§ 13b UStG): Kategorie AE, VATEX-EU-AE, beide USt-IdNr. Pflicht', () => {
    const r = basis({ steuerHinweis: 'reverse-charge', empfaenger: { ...basis().empfaenger, land: 'Österreich', ustId: 'ATU12345678' }, positionen: [{ id: 'p1', titel: 'Beratung', text: '', menge: 1, einheit: 'Stunde', einzelpreisCent: 15000, ustSatz: 0 }] });
    const xml = ciiXml({ r, g, kleinunternehmer: false });
    expect(xml).toContain('<ram:CategoryCode>AE</ram:CategoryCode>');
    expect(xml).toContain('<ram:ExemptionReasonCode>VATEX-EU-AE</ram:ExemptionReasonCode>');
    expect(xml).toContain('<ram:CountryID>AT</ram:CountryID>');
    expect(en16931Luecken(xml)).toEqual([]);
    // Ohne USt-IdNr. des Verkäufers meldet die Prüfung BR-AE-02 — und die Pflichtangaben fangen es vorher ab.
    const ohne = ciiXml({ r, g: { ...g, ustId: undefined }, kleinunternehmer: false });
    expect(en16931Luecken(ohne).join(' ')).toContain('USt-IdNr. des Verkäufers');
    expect(pflichtFehlt(r, { ...g, ustId: undefined }).map(f => f.text).join(' ')).toContain('USt-IdNr. des Absenders');
  });

  it('steuerfrei mit Grund: Kategorie E und der Grund als Befreiungstext', () => {
    const r = basis({ steuerHinweis: 'steuerfrei', steuerfreiGrund: '§ 4 Nr. 21 UStG', positionen: [{ id: 'p1', titel: 'Seminar', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 20000, ustSatz: 0 }] });
    const xml = ciiXml({ r, g, kleinunternehmer: false });
    expect(xml).toContain('<ram:ExemptionReason>Steuerfrei: § 4 Nr. 21 UStG</ram:ExemptionReason>');
    expect(xml).toContain('<ram:CategoryCode>E</ram:CategoryCode>');
  });

  it('Stornorechnung: Art 381, positive Beträge, Bezug auf das Original (BT-25/26)', () => {
    const r = basis({ id: 'r-storno', art: 'storno', stornoZu: 'r-test1', nummer: 'KDV-R-2026-0008', status: 'storniert', faellig: undefined });
    const xml = ciiXml({ r, g, kleinunternehmer: false, original: { nummer: 'KDV-R-2026-0007', datum: '2026-10-15' } });
    expect(xml).toContain('<ram:TypeCode>381</ram:TypeCode>');
    expect(xml).toContain('<ram:IssuerAssignedID>KDV-R-2026-0007</ram:IssuerAssignedID>');
    expect(xml).toContain('<qdt:DateTimeString format="102">20261015</qdt:DateTimeString>');
    expect(en16931Luecken(xml)).toEqual([]);
    const e = eRechnungLesen(xml)!;
    expect(e.gutschrift).toBe(true);
    expect(e.brutto).toBeGreaterThan(0);
  });

  it('Anrechnung (negativer Einzelpreis) → negative Menge, Preis nie negativ (BR-27)', () => {
    const r = basis({ positionen: [
      { id: 'p1', titel: 'Begleitung', text: '', menge: 1, einheit: 'Monat', einzelpreisCent: 300000, ustSatz: 19 },
      { id: 'anr-x1', titel: 'Anrechnung Workshop', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: -50000, ustSatz: 19 },
    ] });
    const xml = ciiXml({ r, g, kleinunternehmer: false });
    expect(xml).not.toMatch(/<ram:ChargeAmount>-/);
    expect(xml).toContain('<ram:BilledQuantity unitCode="LS">-1</ram:BilledQuantity>');
    expect(xml).toContain('<ram:LineTotalAmount>-500.00</ram:LineTotalAmount>');
    expect(eRechnungLesen(xml)!.netto).toBe(2500);
  });

  it('Sonderzeichen werden maskiert — kein Einschleusen von Elementen aus Freitext', () => {
    const r = basis({ empfaenger: { ...basis().empfaenger, firma: 'A & B <Test> "GmbH"' }, positionen: [{ id: 'p1', titel: '</ram:Name><x>', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 100, ustSatz: 19 }] });
    const xml = ciiXml({ r, g, kleinunternehmer: false });
    expect(xml).toContain('A &amp; B &lt;Test&gt; &quot;GmbH&quot;');
    const e = eRechnungLesen(xml)!;
    expect(e.kaeufer.name).toBe('A & B <Test> "GmbH"');
    expect(e.zweck).toBe('</ram:Name><x>');
  });

  it('Einheiten nach UN/ECE Rec. 20', () => {
    expect(['Monat', 'Tag', 'Stunde', 'Std.', 'pauschal', 'Stück', 'irgendwas'].map(einheitCode)).toEqual(['MON', 'DAY', 'HUR', 'HUR', 'LS', 'H87', 'C62']);
  });
});

describe('XRechnung (CII, 3.0)', () => {
  it('Spezifikation + Prozess, Leitweg-ID als BT-10; Pflichtfelder vollständig', () => {
    const xml = ciiXml({ r: basis(), g, kleinunternehmer: false, leitwegId: '991-12345-67' }, 'xrechnung');
    expect(xml).toContain(SPEZIFIKATION.xrechnung);
    expect(xml).toContain('urn:fdc:peppol.eu:2017:poacc:billing:01.0');
    expect(xml).toContain('<ram:BuyerReference>991-12345-67</ram:BuyerReference>');
    expect(xrechnungLuecken(xml)).toEqual([]);
    expect(eRechnungLesen(xml)!.xrechnung).toBe(true);
  });
  it('ohne Leitweg-ID, Telefon und Käufer-E-Mail → klare Liste', () => {
    const r = basis({ empfaenger: { ...basis().empfaenger, email: undefined } });
    const l = xrechnungLuecken(ciiXml({ r, g: { ...g, telefon: undefined }, kleinunternehmer: false }, 'xrechnung')).join(' ');
    expect(l).toContain('Leitweg-ID');
    expect(l).toContain('Telefon des Absenders');
    expect(l).toContain('E-Mail-Adresse des Empfängers');
  });
  it('aus der eingebetteten ZUGFeRD-XML umgeschrieben (Profil + Leitweg) — sonst nichts verändert', () => {
    const z = ciiXml({ r: basis(), g, kleinunternehmer: false });
    const x = profilWechseln(leitwegEinsetzen(z, '04011000-1234512345-06'), 'xrechnung');
    expect(x).toContain(SPEZIFIKATION.xrechnung);
    expect(x).toContain('<ram:BuyerReference>04011000-1234512345-06</ram:BuyerReference>');
    expect(xrechnungLuecken(x)).toEqual([]);
    expect(profilWechseln(x, 'en16931')).toBe(z.replace('<ram:ApplicableHeaderTradeAgreement>', '<ram:ApplicableHeaderTradeAgreement><ram:BuyerReference>04011000-1234512345-06</ram:BuyerReference>'));
  });
  it('Leitweg-ID-Form', () => {
    expect(leitwegIdOk('991-12345-67')).toBe(true);
    expect(leitwegIdOk('04011000-1234512345-06')).toBe(true);
    expect(leitwegIdOk('abc')).toBe(false);
  });
});

describe('ZUGFeRD/Factur-X: XML in der PDF', () => {
  it('die Rechnungs-PDF trägt factur-x.xml (AF Alternative, text/xml, XMP mit fx-Schema) — auslesbar mit denselben Beträgen', async () => {
    const r = basis();
    const xml = ciiXml({ r, g, kleinunternehmer: false });
    const erstellt = new Date('2026-10-31T09:00:00Z');
    const bytes = await belegPdf(rechnungDokument(r, absenderAus(g, { ibanVoll: true }), { datum: r.datum!, bank: bankZeile(g.bank) }), { erstellt, vorSpeichern: d => facturXEinbetten(d, xml, { erstellt, titel: 'Rechnung', autor: 'Beispiel' }) });
    const roh = Buffer.from(bytes).toString('latin1');
    expect(roh).toContain('/AFRelationship /Alternative');
    expect(roh).toContain('/Subtype /text#2Fxml');
    expect(roh).toContain('urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#');
    expect(roh).toContain('<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>');
    expect(roh).toMatch(/\/AF \[/);
    const ein = await eingebetteteXml(bytes);
    expect(ein?.name).toBe(FACTURX_DATEI);
    expect(ein?.xml).toBe(xml);
    // Gleiche Eingabe → gleiche Bytes (Prüfsumme bleibt reproduzierbar).
    const nochmal = await belegPdf(rechnungDokument(r, absenderAus(g, { ibanVoll: true }), { datum: r.datum!, bank: bankZeile(g.bank) }), { erstellt, vorSpeichern: d => facturXEinbetten(d, xml, { erstellt, titel: 'Rechnung', autor: 'Beispiel' }) });
    expect(Buffer.from(nochmal).equals(Buffer.from(bytes))).toBe(true);
  });
  it('ohne vorSpeichern bleibt die PDF wie bisher (keine eingebettete Datei)', async () => {
    const r = basis();
    const bytes = await belegPdf(rechnungDokument(r, absenderAus(g, { ibanVoll: true }), { datum: r.datum! }), { erstellt: new Date('2026-10-31T09:00:00Z') });
    expect(Buffer.from(bytes).toString('latin1')).not.toContain('/EmbeddedFiles');
    expect(await eingebetteteXml(bytes)).toBeNull();
  });
  it('eine kaputte oder fremde PDF liefert null, wirft nie', async () => {
    expect(await eingebetteteXml(new TextEncoder().encode('%PDF-1.7 kaputt'))).toBeNull();
    expect(await eingebetteteXml(new Uint8Array([1, 2, 3]))).toBeNull();
  });
  it('Entpack-Bombe in einer fremden PDF: höchstens 2 MB, dann nichts', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    await doc.attach(new Uint8Array(Buffer.alloc(5_000_000, 0x41)), 'factur-x.xml', { mimeType: 'text/xml' });
    const bytes = await doc.save({ useObjectStreams: false });
    expect(bytes.length).toBeLessThan(200_000); // gepackt winzig, entpackt 5 MB
    expect(await eingebetteteXml(bytes)).toBeNull();
  });
});

describe('Eingang: fremde E-Rechnungen lesen', () => {
  const fremdeCii = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
 <rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>
 <rsm:ExchangedDocument><ram:ID>LF-2026-4711</ram:ID><ram:TypeCode>380</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">20261020</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument>
 <rsm:SupplyChainTradeTransaction>
  <ram:IncludedSupplyChainTradeLineItem><ram:SpecifiedTradeProduct><ram:Name>Software-Lizenz &amp; Wartung</ram:Name></ram:SpecifiedTradeProduct></ram:IncludedSupplyChainTradeLineItem>
  <ram:ApplicableHeaderTradeAgreement>
   <ram:SellerTradeParty><ram:Name>Lieferant Beispiel AG</ram:Name><ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">DE999999999</ram:ID></ram:SpecifiedTaxRegistration></ram:SellerTradeParty>
   <ram:BuyerTradeParty><ram:Name>Beispiel Ventures UG (haftungsbeschränkt)</ram:Name><ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">DE 123 456 789</ram:ID></ram:SpecifiedTaxRegistration></ram:BuyerTradeParty>
  </ram:ApplicableHeaderTradeAgreement>
  <ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
   <ram:ApplicableTradeTax><ram:CalculatedAmount>19.00</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode><ram:BasisAmount>100.00</ram:BasisAmount><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>19.00</ram:RateApplicablePercent></ram:ApplicableTradeTax>
   <ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">20261103</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>
   <ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>100.00</ram:LineTotalAmount><ram:TaxBasisTotalAmount>100.00</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">19.00</ram:TaxTotalAmount><ram:GrandTotalAmount>119.00</ram:GrandTotalAmount><ram:DuePayableAmount>119.00</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>
  </ram:ApplicableHeaderTradeSettlement>
 </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
  const fremdeUbl = `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
 <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
 <cbc:ID>U-88</cbc:ID><cbc:IssueDate>2026-10-05</cbc:IssueDate><cbc:DueDate>2026-10-19</cbc:DueDate><cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
 <cac:AccountingSupplierParty><cac:Party><cac:PartyTaxScheme><cbc:CompanyID>DE888888888</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>Büro Beispiel GmbH</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
 <cac:AccountingCustomerParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Jemand Anderes</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
 <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">3.50</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">50.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">3.50</cbc:TaxAmount><cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>7</cbc:Percent></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
 <cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="EUR">50.00</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="EUR">50.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">53.50</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="EUR">53.50</cbc:PayableAmount></cac:LegalMonetaryTotal>
 <cac:InvoiceLine><cbc:ID>1</cbc:ID><cac:Item><cbc:Name>Papier</cbc:Name></cac:Item></cac:InvoiceLine>
</ubl:Invoice>`;
  const eigen = { namen: ['Beispiel Ventures UG (haftungsbeschränkt)'], ustIds: ['DE123456789'], steuernummern: [] };

  it('XRechnung (CII) eines Lieferanten → Vorschlag aus der Datei, Richtung Eingang', () => {
    expect(siehtNachERechnungAus(fremdeCii)).toBe(true);
    const b = belegAusERechnung(eRechnungLesen(fremdeCii)!, eigen, { eingebettet: false });
    expect(b).toMatchObject({ richtung: 'eingang', partner: 'Lieferant Beispiel AG', datum: '2026-10-20', faellig: '2026-11-03', rechnungsnummer: 'LF-2026-4711', betragNetto: 100, betragBrutto: 119, ustSatz: 19, waehrung: 'EUR', quelle: 'e-rechnung', format: 'XRechnung (CII)', zweck: 'Software-Lizenz & Wartung' });
    expect(b.unsicher).toBeUndefined();
  });
  it('XRechnung (UBL) → Beträge, Satz, Fälligkeit; unbekannter Käufer → Richtung unklar', () => {
    const b = belegAusERechnung(eRechnungLesen(fremdeUbl)!, eigen, { eingebettet: false });
    expect(b).toMatchObject({ partner: 'Büro Beispiel GmbH', datum: '2026-10-05', faellig: '2026-10-19', rechnungsnummer: 'U-88', betragNetto: 50, betragBrutto: 53.5, ustSatz: 7, format: 'XRechnung (UBL)', richtung: 'unklar' });
    expect(b.unsicher).toContain('richtung');
  });
  it('UBL-Gutschrift → markiert, Beträge positiv', () => {
    const gs = fremdeUbl.replace(/ubl:Invoice/g, 'ubl:CreditNote').replace('Invoice-2', 'CreditNote-2').replace(/InvoiceTypeCode/g, 'CreditNoteTypeCode').replace('>380<', '>381<').replace(/InvoiceLine/g, 'CreditNoteLine');
    const b = belegAusERechnung(eRechnungLesen(gs)!, eigen, { eingebettet: false });
    expect(b.gutschrift).toBe(true);
    expect(b.betragBrutto).toBe(53.5);
    expect(b.unsicher?.join(' ')).toContain('Gutschrift');
  });
  it('eine eigene Ausgangsrechnung wird als „ausgang“ erkannt', () => {
    const b = belegAusERechnung(eRechnungLesen(ciiXml({ r: basis(), g, kleinunternehmer: false }))!, eigen, { eingebettet: true });
    expect(b).toMatchObject({ richtung: 'ausgang', partner: 'Muster GmbH', format: 'ZUGFeRD/Factur-X' });
  });
  it('anderes XML ist keine E-Rechnung', () => {
    expect(eRechnungLesen('<?xml version="1.0"?><notiz><text>hallo</text></notiz>')).toBeNull();
  });
});

describe('Sicherer XML-Leser: XXE, Entitäten, Größe, Tiefe', () => {
  it('lehnt DTD und externe Entitäten ab (XXE)', () => {
    const xxe = '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><Invoice><ID>&x;</ID></Invoice>';
    expect(() => xmlLesen(xxe)).toThrow(XmlFehler);
    expect(() => eRechnungLesen(xxe)).toThrow(XmlFehler);
  });
  it('lehnt „Billion Laughs“ ab', () => {
    const bomb = '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;">]><r>&lol2;</r>';
    expect(() => xmlLesen(bomb)).toThrow(XmlFehler);
  });
  it('unbekannte Entitäten bleiben wörtlich, vordefinierte und Zeichenreferenzen werden aufgelöst', () => {
    expect(xmlLesen('<r>&lt;a&gt; &#252;&#x00FC; &unbekannt;</r>').text).toBe('<a> üü &unbekannt;');
  });
  it('Größe und Tiefe begrenzt', () => {
    expect(() => xmlLesen(`<r>${'x'.repeat(XML_MAX_ZEICHEN)}</r>`)).toThrow(/zu groß/);
    expect(() => xmlLesen(`${'<a>'.repeat(100)}${'</a>'.repeat(100)}`)).toThrow(/tief/);
  });
  it('kaputtes XML → Fehler statt halber Daten', () => {
    expect(() => xmlLesen('<a><b></a>')).toThrow(XmlFehler);
    expect(() => xmlLesen('<a>')).toThrow(XmlFehler);
    expect(() => xmlLesen('<a/><b/>')).toThrow(XmlFehler);
  });
  it('„>“ in Attributwerten und CDATA', () => {
    const w = xmlLesen('<a x="1 > 0"><![CDATA[<kein tag>]]></a>');
    expect(w.attr.x).toBe('1 > 0');
    expect(w.text).toBe('<kein tag>');
  });
  it('linear: ein langer Tag mit vielen „>“ in Anführungszeichen ist schnell', () => {
    const s = `<a x="${'>'.repeat(500_000)}"/>`;
    const t0 = Date.now();
    xmlLesen(s);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});

describe('Pflichtangaben vor dem Stellen (E-Rechnung)', () => {
  const entwurf = () => ({ ...basis(), status: 'geplant' as const, nummer: undefined });
  it('Land, das kein Ländercode ist → Meldung; „E-Rechnung aus“ → keine', () => {
    const r = { ...entwurf(), empfaenger: { ...basis().empfaenger, land: 'Atlantis' } };
    expect(pflichtFehlt(r, g).map(f => f.text).join(' ')).toContain('Land „Atlantis“ nicht erkannt');
    expect(pflichtFehlt(r, { ...g, eRechnungAus: true }).map(f => f.text).join(' ')).not.toContain('Atlantis');
    expect(pflichtFehlt(entwurf(), g)).toEqual([]);
  });
  it('Ländercodes', () => {
    expect(['', 'Deutschland', 'österreich', 'CH', 'Vereinigtes Königreich', 'Atlantis'].map(landCode)).toEqual(['DE', 'DE', 'AT', 'CH', 'GB', null]);
  });
});
