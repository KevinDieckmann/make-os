// ─── E-Rechnung — Eingang: CII (ZUGFeRD/Factur-X/XRechnung) und UBL (XRechnung/Peppol) lesen (rein, 31.10.) ─
// Kevin 31.10.: beim Beleg-Hochladen erkennt MAKE OS eine E-Rechnung und belegt den Vorschlag aus der XML vor (Lieferant, Datum, Nummer,
// Netto/USt/Brutto, Fälligkeit) — statt aus Texterkennung. Die XML ist FREMDER Text: gelesen über den sicheren Leser (lib/finanzen/erechnung/xml.ts
// — keine DTD/Entitäten, Größe/Tiefe begrenzt), nur Felder herausgezogen, nichts ausgeführt; alle Texte gekürzt, Beträge nur als Zahl.
// Geschrieben wird hier nichts — wie bei /api/beleg bleibt es ein Vorschlag, den ein Mensch übernimmt.

import { kind, kinder, text, xmlLesen, XmlFehler, type XmlKnoten } from './xml';

export type ERechnungFormat = 'cii' | 'ubl';

export interface ERechnungGelesen {
  format: ERechnungFormat;
  /** BT-24, z. B. „urn:cen.eu:en16931:2017“ bzw. die XRechnung-Kennung. */
  spezifikation?: string;
  /** XRechnung (Spezifikation der KoSIT)? */
  xrechnung: boolean;
  /** 380 Rechnung, 381 Gutschrift, 384 Korrektur … */
  art?: string;
  /** Gutschrift/Storno (381 bzw. UBL CreditNote) — Beträge stehen hier positiv, gemeint ist eine Minderung. */
  gutschrift: boolean;
  nummer?: string;
  datum?: string;
  faellig?: string;
  waehrung?: string;
  verkaeufer: { name?: string; ustId?: string; steuernummer?: string };
  kaeufer: { name?: string; ustId?: string };
  /** Euro (zwei Stellen). */
  netto?: number;
  ust?: number;
  brutto?: number;
  zahlbar?: number;
  /** Steuersätze der Steueraufstellung (BG-23). */
  saetze: number[];
  /** Bezeichnung der ersten Position(en) — für den Zweck. */
  zweck?: string;
  leistungVon?: string;
  leistungBis?: string;
}

const kurz = (v: string | undefined, n: number) => (v ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) || undefined : undefined);
const geld = (v: string | undefined): number | undefined => {
  if (!v) return undefined;
  const n = Number(v.trim());
  return Number.isFinite(n) && Math.abs(n) < 1e10 ? Math.round(n * 100) / 100 : undefined;
};
/** „20261031“ (Format 102) oder „2026-10-31“ → „2026-10-31“. */
const tag = (v: string | undefined): string | undefined => {
  const t = (v ?? '').trim();
  const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(t);
  if (!m) return undefined;
  const d = `${m[1]}-${m[2]}-${m[3]}`;
  return Number.isFinite(Date.parse(`${d}T12:00:00Z`)) && new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d ? d : undefined;
};
const steuerIds = (party: XmlKnoten | undefined) => {
  const regs = kinder(party, 'SpecifiedTaxRegistration').map(r => kind(r, 'ID')).filter((x): x is XmlKnoten => !!x);
  return {
    ustId: kurz(regs.find(r => r.attr.schemeID === 'VA')?.text, 30),
    steuernummer: kurz(regs.find(r => r.attr.schemeID === 'FC')?.text, 40),
  };
};

function ciiLesen(w: XmlKnoten): ERechnungGelesen {
  const spez = text(w, 'ExchangedDocumentContext', 'GuidelineSpecifiedDocumentContextParameter', 'ID');
  const doc = kind(w, 'ExchangedDocument');
  const tx = kind(w, 'SupplyChainTradeTransaction');
  const ag = kind(tx, 'ApplicableHeaderTradeAgreement');
  const st = kind(tx, 'ApplicableHeaderTradeSettlement');
  const sum = kind(st, 'SpecifiedTradeSettlementHeaderMonetarySummation');
  const waehrung = kurz(text(st, 'InvoiceCurrencyCode'), 3);
  // Steuersumme in Rechnungswährung (es kann eine zweite in Steuerwährung geben, BT-111).
  const ustKnoten = kinder(sum, 'TaxTotalAmount');
  const ust = ustKnoten.find(k => !waehrung || !k.attr.currencyID || k.attr.currencyID === waehrung) ?? ustKnoten[0];
  const art = kurz(text(doc, 'TypeCode'), 4);
  const seller = kind(ag, 'SellerTradeParty');
  const buyer = kind(ag, 'BuyerTradeParty');
  const zeilen = kinder(tx, 'IncludedSupplyChainTradeLineItem').map(z => text(z, 'SpecifiedTradeProduct', 'Name')).filter(Boolean) as string[];
  const zeitraum = kind(st, 'BillingSpecifiedPeriod');
  const lieferung = text(tx, 'ApplicableHeaderTradeDelivery', 'ActualDeliverySupplyChainEvent', 'OccurrenceDateTime', 'DateTimeString');
  return {
    format: 'cii', ...(spez ? { spezifikation: kurz(spez, 200) } : {}), xrechnung: /xrechnung/i.test(spez ?? ''),
    ...(art ? { art } : {}), gutschrift: art === '381',
    nummer: kurz(text(doc, 'ID'), 60), datum: tag(text(doc, 'IssueDateTime', 'DateTimeString')),
    faellig: tag(text(st, 'SpecifiedTradePaymentTerms', 'DueDateDateTime', 'DateTimeString')),
    ...(waehrung ? { waehrung } : {}),
    verkaeufer: { name: kurz(text(seller, 'Name'), 140), ...steuerIds(seller) },
    kaeufer: { name: kurz(text(buyer, 'Name'), 140), ustId: steuerIds(buyer).ustId },
    netto: geld(text(sum, 'TaxBasisTotalAmount')), ust: geld(ust?.text), brutto: geld(text(sum, 'GrandTotalAmount')), zahlbar: geld(text(sum, 'DuePayableAmount')),
    saetze: Array.from(new Set(kinder(st, 'ApplicableTradeTax').map(x => geld(text(x, 'RateApplicablePercent'))).filter((x): x is number => x !== undefined))),
    ...(zeilen.length ? { zweck: kurz(zeilen.slice(0, 3).join(', '), 200) } : {}),
    ...(zeitraum ? { leistungVon: tag(text(zeitraum, 'StartDateTime', 'DateTimeString')), leistungBis: tag(text(zeitraum, 'EndDateTime', 'DateTimeString')) } : lieferung ? { leistungVon: tag(lieferung) } : {}),
  };
}

function ublLesen(w: XmlKnoten): ERechnungGelesen {
  const gutschrift = w.name === 'CreditNote';
  const spez = text(w, 'CustomizationID');
  const party = (rolle: string) => kind(w, rolle, 'Party');
  const name = (p: XmlKnoten | undefined) => text(p, 'PartyLegalEntity', 'RegistrationName') ?? text(p, 'PartyName', 'Name');
  const ustVon = (p: XmlKnoten | undefined) => {
    const l = kinder(p, 'PartyTaxScheme');
    const vat = l.find(x => (text(x, 'TaxScheme', 'ID') ?? '').toUpperCase() === 'VAT');
    const andere = l.find(x => x !== vat);
    return { ustId: kurz(text(vat, 'CompanyID'), 30), steuernummer: kurz(text(andere, 'CompanyID'), 40) };
  };
  const seller = party('AccountingSupplierParty');
  const buyer = party('AccountingCustomerParty');
  const sum = kind(w, 'LegalMonetaryTotal');
  const waehrung = kurz(text(w, 'DocumentCurrencyCode'), 3);
  const steuer = kinder(w, 'TaxTotal');
  const ust = (steuer.find(x => kind(x, 'TaxAmount')?.attr.currencyID === waehrung) ?? steuer[0]);
  const zeilen = kinder(w, gutschrift ? 'CreditNoteLine' : 'InvoiceLine').map(z => text(z, 'Item', 'Name')).filter(Boolean) as string[];
  const zeitraum = kind(w, 'InvoicePeriod');
  const art = kurz(text(w, gutschrift ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'), 4);
  return {
    format: 'ubl', ...(spez ? { spezifikation: kurz(spez, 200) } : {}), xrechnung: /xrechnung/i.test(spez ?? ''),
    ...(art ? { art } : {}), gutschrift: gutschrift || art === '381',
    nummer: kurz(text(w, 'ID'), 60), datum: tag(text(w, 'IssueDate')),
    faellig: tag(text(w, 'DueDate') ?? text(w, 'PaymentMeans', 'PaymentDueDate')),
    ...(waehrung ? { waehrung } : {}),
    verkaeufer: { name: kurz(name(seller), 140), ...ustVon(seller) },
    kaeufer: { name: kurz(name(buyer), 140), ustId: ustVon(buyer).ustId },
    netto: geld(text(sum, 'TaxExclusiveAmount')), ust: geld(text(ust, 'TaxAmount')), brutto: geld(text(sum, 'TaxInclusiveAmount')), zahlbar: geld(text(sum, 'PayableAmount')),
    saetze: Array.from(new Set(steuer.flatMap(x => kinder(x, 'TaxSubtotal')).map(x => geld(text(x, 'TaxCategory', 'Percent'))).filter((x): x is number => x !== undefined))),
    ...(zeilen.length ? { zweck: kurz(zeilen.slice(0, 3).join(', '), 200) } : {}),
    ...(zeitraum ? { leistungVon: tag(text(zeitraum, 'StartDate')), leistungBis: tag(text(zeitraum, 'EndDate')) } : {}),
  };
}

/**
 * Eine E-Rechnung aus XML-Text lesen — CII (Wurzel `CrossIndustryInvoice`) oder UBL (`Invoice`/`CreditNote`). Keine E-Rechnung
 * (anderes XML) → null; kaputtes/gefährliches XML → wirft `XmlFehler` (die Route meldet es, liest nichts).
 */
export function eRechnungLesen(xml: string): ERechnungGelesen | null {
  const w = xmlLesen(xml);
  if (w.name === 'CrossIndustryInvoice') return ciiLesen(w);
  if (w.name === 'Invoice' || w.name === 'CreditNote') return ublLesen(w);
  return null;
}

export { XmlFehler };

/** Grob vorab: sieht der Text wie eine E-Rechnung aus? (vor dem Lesen, billig) */
export const siehtNachERechnungAus = (s: string) => /<(?:[\w-]+:)?(CrossIndustryInvoice|Invoice|CreditNote)[\s>]/.test(s.slice(0, 4000));
