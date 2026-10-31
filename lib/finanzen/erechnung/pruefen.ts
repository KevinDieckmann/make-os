// ─── E-Rechnung — eigene Pflichtfeld-Prüfung der Ausgabe (rein, 31.10.) ─────
// Kein Ersatz für einen Validator (KoSIT/Schematron gibt es nicht offline in MAKE OS) — eine Prüfung der Geschäftsbegriffe, die wir
// befüllen und die EN 16931 bzw. XRechnung 3.0 verlangen. Liest die fertige XML mit dem sicheren Leser zurück (so wird genau geprüft,
// was hinausgeht). Hinweis, keine Steuerberatung.

import { kind, kinder, text, xmlLesen, type XmlKnoten } from './xml';

/** Leitweg-ID (Form wie „991-12345-67“ bzw. „04011000-1234512345-06“): Grob-ID, optional Fein-ID, zwei Prüfziffern. */
export const leitwegIdOk = (v: string | undefined): boolean => !!v && /^[0-9]{2,12}(-[0-9A-Z]{1,30})?-[0-9]{2}$/.test(v.trim().toUpperCase());

const fehltWenn = (l: string[], bedingung: boolean, satz: string) => { if (bedingung) l.push(satz); };

/** Pflichtfelder der EN 16931 (Kern), die MAKE OS befüllt — leer = vorhanden. */
export function en16931Luecken(xml: string): string[] {
  const w = xmlLesen(xml);
  const l: string[] = [];
  const doc = kind(w, 'ExchangedDocument');
  const tx = kind(w, 'SupplyChainTradeTransaction');
  const ag = kind(tx, 'ApplicableHeaderTradeAgreement');
  const st = kind(tx, 'ApplicableHeaderTradeSettlement');
  const sum = kind(st, 'SpecifiedTradeSettlementHeaderMonetarySummation');
  const seller = kind(ag, 'SellerTradeParty');
  const buyer = kind(ag, 'BuyerTradeParty');
  fehltWenn(l, !text(w, 'ExchangedDocumentContext', 'GuidelineSpecifiedDocumentContextParameter', 'ID'), 'Spezifikation (BT-24).');
  fehltWenn(l, !text(doc, 'ID'), 'Rechnungsnummer (BT-1).');
  fehltWenn(l, !text(doc, 'IssueDateTime', 'DateTimeString'), 'Rechnungsdatum (BT-2).');
  fehltWenn(l, !text(doc, 'TypeCode'), 'Rechnungsart (BT-3).');
  fehltWenn(l, !text(st, 'InvoiceCurrencyCode'), 'Währung (BT-5).');
  fehltWenn(l, !text(seller, 'Name'), 'Name des Verkäufers (BT-27).');
  fehltWenn(l, !text(seller, 'PostalTradeAddress', 'CountryID'), 'Land des Verkäufers (BT-40).');
  fehltWenn(l, !kinder(seller, 'SpecifiedTaxRegistration').length, 'Steuernummer oder USt-IdNr. des Verkäufers (BT-31/32).');
  fehltWenn(l, !text(buyer, 'Name'), 'Name des Käufers (BT-44).');
  fehltWenn(l, !text(buyer, 'PostalTradeAddress', 'CountryID'), 'Land des Käufers (BT-55).');
  fehltWenn(l, !kinder(tx, 'IncludedSupplyChainTradeLineItem').length, 'Mindestens eine Position (BG-25).');
  fehltWenn(l, !kinder(st, 'ApplicableTradeTax').length, 'Umsatzsteuer-Aufstellung (BG-23).');
  for (const k of ['LineTotalAmount', 'TaxBasisTotalAmount', 'GrandTotalAmount', 'DuePayableAmount']) fehltWenn(l, !text(sum, k), `Summe ${k} (BG-22).`);
  // BR-CO-25: offener Betrag > 0 → Fälligkeit oder Zahlungsbedingung.
  const offen = Number(text(sum, 'DuePayableAmount') ?? 0);
  fehltWenn(l, offen > 0 && !kind(st, 'SpecifiedTradePaymentTerms'), 'Fälligkeit oder Zahlungsbedingungen (BT-9/BT-20).');
  // BR-AE-02: Reverse Charge braucht beide USt-IdNr.
  const ae = kinder(st, 'ApplicableTradeTax').some(x => text(x, 'CategoryCode') === 'AE');
  const va = (p: XmlKnoten | undefined) => kinder(p, 'SpecifiedTaxRegistration').some(r => kind(r, 'ID')?.attr.schemeID === 'VA');
  fehltWenn(l, ae && !va(seller), 'Reverse Charge: USt-IdNr. des Verkäufers (BT-31).');
  fehltWenn(l, ae && !va(buyer), 'Reverse Charge: USt-IdNr. des Käufers (BT-48).');
  return l;
}

/** Zusätzliche Pflichtfelder der XRechnung 3.0 (BR-DE-…) — mit dem Satz, wo man es behebt. */
export function xrechnungLuecken(xml: string): string[] {
  const l = en16931Luecken(xml);
  const w = xmlLesen(xml);
  const tx = kind(w, 'SupplyChainTradeTransaction');
  const ag = kind(tx, 'ApplicableHeaderTradeAgreement');
  const st = kind(tx, 'ApplicableHeaderTradeSettlement');
  const seller = kind(ag, 'SellerTradeParty');
  const buyer = kind(ag, 'BuyerTradeParty');
  const kontakt = kind(seller, 'DefinedTradeContact');
  fehltWenn(l, !text(ag, 'BuyerReference'), 'Leitweg-ID der Behörde (BT-10) — an der Kundenfirma unter Zahlungsdaten bzw. im Rechnungsentwurf eintragen.');
  fehltWenn(l, !text(kontakt, 'TelephoneUniversalCommunication', 'CompleteNumber'), 'Telefon des Absenders (BT-42) — Unternehmen › Gesellschaft › Absender.');
  fehltWenn(l, !text(kontakt, 'EmailURIUniversalCommunication', 'URIID'), 'E-Mail des Absenders (BT-43) — Unternehmen › Gesellschaft › Absender.');
  fehltWenn(l, !text(seller, 'URIUniversalCommunication', 'URIID'), 'Elektronische Adresse des Absenders (BT-34, E-Mail).');
  fehltWenn(l, !text(buyer, 'URIUniversalCommunication', 'URIID'), 'E-Mail-Adresse des Empfängers (BT-49) — im Rechnungsentwurf bzw. an der Kundenfirma.');
  fehltWenn(l, !text(seller, 'PostalTradeAddress', 'CityName') || !text(seller, 'PostalTradeAddress', 'PostcodeCode'), 'Ort und PLZ des Absenders (BR-DE-3/4).');
  fehltWenn(l, !text(buyer, 'PostalTradeAddress', 'CityName') || !text(buyer, 'PostalTradeAddress', 'PostcodeCode'), 'Ort und PLZ des Empfängers (BR-DE-8/9).');
  fehltWenn(l, !kind(st, 'SpecifiedTradeSettlementPaymentMeans'), 'Zahlungsangaben (BG-16) — IBAN der Gesellschaft.');
  return l;
}
