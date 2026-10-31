// ─── E-Rechnung — Ausgang: CII-XML nach EN 16931 (ZUGFeRD 2.x „EN 16931“/Factur-X, XRechnung) (rein, 31.10.) ─
// Kevin 31.10.: „E-Rechnung — heute fertig.“ Aus DENSELBEN Daten wie das PDF (lib/finanzen/rechnung/dokument.ts) entsteht die
// strukturierte Rechnung im UN/CEFACT-CII-Format (Cross Industry Invoice D16B), Profil EN 16931 („COMFORT“). Dieselbe Funktion
// liefert die XRechnung (CII-Syntax) — nur die Spezifikationskennung (BT-24) und der Geschäftsprozess (BT-23) unterscheiden sich.
// Beträge kommen in Cent (Positionen) und gehen als Dezimalzahl mit zwei Stellen hinaus; Steuer je Satz über `rechnungSummen`
// (lib/finanzen/ust.ts, kaufmännisch je Rechnung) — dieselben Summen wie im PDF und im Finanzplan.
//
// Befüllte Geschäftsbegriffe (BT = Business Term der EN 16931):
//   BT-1 Nummer · BT-2 Datum · BT-3 Art (380 Rechnung, 381 Gutschrift = Stornorechnung) · BT-5 Währung EUR · BT-9 Fälligkeit · BT-10 Käuferreferenz
//   (Leitweg-ID) · BT-13 Bestellnummer · BT-20 Zahlungsbedingungen · BT-22 Hinweise · BT-23/24 Prozess/Spezifikation · BT-25/26 Bezug (Storno)
//   BG-4 Verkäufer: BT-27 Name, BT-31 USt-IdNr., BT-32 Steuernummer, BT-34 E-Mail, BT-35–40 Anschrift; BG-6 Kontakt BT-41–43
//   BG-7 Käufer: BT-44 Name, BT-46 Kundennummer, BT-48 USt-IdNr., BT-49 E-Mail, BT-50–55 Anschrift; BG-9 Ansprechperson BT-56
//   BT-72 Leistungsdatum bzw. BG-14 Leistungszeitraum BT-73/74 · BG-16 Zahlung: BT-81 (58 = SEPA-Überweisung), BT-83 Verwendungszweck, BT-84 IBAN,
//   BT-85 Kontoinhaber, BT-86 BIC · BG-22 Summen BT-106/109/110/112/115 · BG-23 Steuer je Kategorie BT-116–121
//   BG-25 Positionen: BT-126 Nr., BT-129/130 Menge + Einheit, BT-131 Netto, BT-136 Rabatt (Positionsabschlag), BT-146 Einzelpreis,
//   BT-151/152 Kategorie + Satz, BT-153 Bezeichnung, BT-154 Beschreibung, BT-155 Artikelnummer.
// Steuerkategorien: S (19/7 %), AE (Reverse Charge § 13b UStG, VATEX-EU-AE), E (steuerfrei mit Grund; Kleinunternehmer § 19 UStG).
// Hinweis, keine Steuerberatung — die Datei einmal mit einem Validator (z. B. KoSIT) prüfen lassen (CLAUDE.md › E-Rechnung).

import type { Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import type { Gesellschaft } from '@/lib/crm/gesellschaften';
import { mitVorgaben } from '@/lib/crm/gesellschaften';
import { rechnungSummen, positionNetto } from '@/lib/finanzen/rechnung/regeln';
import { kaufmaennisch } from '@/lib/finanzen/ust';
import { landCode } from './land';
import { xmlText } from './xml';

export type ERechnungProfil = 'en16931' | 'xrechnung';

/** Spezifikationskennungen (BT-24). */
export const SPEZIFIKATION: Record<ERechnungProfil, string> = {
  en16931: 'urn:cen.eu:en16931:2017',
  xrechnung: 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0',
};
/** Geschäftsprozess (BT-23) — nur in der XRechnung. */
export const PROZESS_XRECHNUNG = 'urn:fdc:peppol.eu:2017:poacc:billing:01.0';
/** Dateiname der eingebetteten Datei (Factur-X 1.0 / ZUGFeRD 2.1+). */
export const FACTURX_DATEI = 'factur-x.xml';

const NS = {
  rsm: 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100',
  ram: 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100',
  qdt: 'urn:un:unece:uncefact:data:standard:QualifiedDataType:100',
  udt: 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100',
} as const;

export interface ERechnungDaten {
  /** Die GESTELLTE Rechnung (Nummer, Datum, Fälligkeit, Positionen, Empfänger …) — bei einer Stornorechnung die Stornorechnung. */
  r: Rechnung;
  /** Der Absender aus dem Gesellschafts-Register (roh — IBAN voll; sie steht nur hier und im PDF). */
  g: Gesellschaft;
  /** Kleinunternehmer (§ 19 UStG) — aus der Gesellschaft. */
  kleinunternehmer: boolean;
  /** Stornorechnung: Nummer und Datum der aufgehobenen Rechnung (BT-25/26). */
  original?: Pick<Rechnung, 'nummer' | 'datum'>;
  /** Leitweg-ID (BT-10) — sonst die am Empfänger. */
  leitwegId?: string;
}

/** Cent → „123.45“ (Punkt, zwei Stellen). */
export const betrag = (cent: number) => { const c = Math.round(cent); const s = c < 0 ? '-' : ''; const a = Math.abs(c); return `${s}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`; };
const zahl = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10000) / 10000));
const tag102 = (d: string) => d.slice(0, 10).replace(/-/g, '');
const t = (name: string, wert: string | undefined, attr = '') => (wert === undefined || wert.trim() === '' ? '' : `<${name}${attr}>${xmlText(wert.trim())}</${name}>`);
const datum = (name: string, d: string | undefined) => (d ? `<${name}><udt:DateTimeString format="102">${tag102(d)}</udt:DateTimeString></${name}>` : '');

/** Einheit der Position → UN/ECE-Empfehlung 20 (BT-130). */
export function einheitCode(einheit: string): string {
  const x = einheit.normalize('NFC').trim().toLowerCase();
  if (/^(monat|monate|mon\.?|monatlich)$/.test(x)) return 'MON';
  if (/^(tag|tage|tagessatz|pt|personentag(e)?)$/.test(x)) return 'DAY';
  if (/^(stunde|stunden|std\.?|h)$/.test(x)) return 'HUR';
  if (/^(woche|wochen)$/.test(x)) return 'WEE';
  if (/^(jahr|jahre|jährlich)$/.test(x)) return 'ANN';
  if (/^(minute|minuten|min\.?)$/.test(x)) return 'MIN';
  if (/^(stück|stk\.?|stueck)$/.test(x)) return 'H87';
  if (/^(km|kilometer)$/.test(x)) return 'KMT';
  if (/^(pauschal|pauschale|psch\.?)$/.test(x)) return 'LS';
  return 'C62';
}

type Kategorie = 'S' | 'AE' | 'E';
interface SteuerArt { kat: Kategorie; satz: number; grund?: string; code?: string }

/** Steuerkategorie einer Position (alle 0-%-Positionen tragen denselben Grund — es gibt EINEN Steuerhinweis je Rechnung). */
export function steuerArt(satz: number, r: Pick<Rechnung, 'steuerHinweis' | 'steuerfreiGrund'>, kleinunternehmer: boolean): SteuerArt {
  if (kleinunternehmer) return { kat: 'E', satz: 0, grund: 'Kleinunternehmerregelung: gemäß § 19 UStG wird keine Umsatzsteuer berechnet.' };
  if (satz > 0) return { kat: 'S', satz };
  if (r.steuerHinweis === 'reverse-charge') return { kat: 'AE', satz: 0, grund: 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, § 13b UStG)', code: 'VATEX-EU-AE' };
  return { kat: 'E', satz: 0, grund: r.steuerfreiGrund ? `Steuerfrei: ${r.steuerfreiGrund}` : 'Steuerfrei' };
}

function adresse(a: { strasse?: string; plz?: string; ort?: string; land?: string }): string {
  return `<ram:PostalTradeAddress>${t('ram:PostcodeCode', a.plz)}${t('ram:LineOne', a.strasse)}${t('ram:CityName', a.ort)}<ram:CountryID>${landCode(a.land) ?? 'DE'}</ram:CountryID></ram:PostalTradeAddress>`;
}

/** Die Hinweise (BT-22) — dieselben Sätze wie im PDF, dazu die Pflichtangaben einer Kapitalgesellschaft (§ 35a GmbHG) unter „REG“. */
function hinweise(d: ERechnungDaten, storno: boolean): string {
  const { r, g } = d;
  const l: { text: string; code?: string }[] = [];
  if (storno && d.original?.nummer) l.push({ text: `Diese Stornorechnung hebt die Rechnung ${d.original.nummer} vollständig auf.` });
  if (d.kleinunternehmer) l.push({ text: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.' });
  else if (r.steuerHinweis === 'reverse-charge') l.push({ text: 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, § 13b UStG).' });
  else if (r.steuerHinweis === 'steuerfrei' && r.steuerfreiGrund) l.push({ text: `Steuerfrei: ${r.steuerfreiGrund}.` });
  const v = mitVorgaben(g);
  const reg = [v.name, [g.strasse, [g.plz, g.ort].filter(Boolean).join(' ')].filter(Boolean).join(', '), g.geschaeftsfuehrung ? `Geschäftsführung: ${g.geschaeftsfuehrung}` : '', g.register ?? ''].filter(Boolean).join(' · ');
  if (g.geschaeftsfuehrung || g.register) l.push({ text: reg, code: 'REG' });
  return l.map(x => `<ram:IncludedNote>${t('ram:Content', x.text)}${x.code ? `<ram:SubjectCode>${x.code}</ram:SubjectCode>` : ''}</ram:IncludedNote>`).join('');
}

/**
 * Die CII-XML einer gestellten Rechnung bzw. Stornorechnung. Stornorechnung = Art 381 (Gutschrift) mit POSITIVEN Beträgen und Bezug
 * auf das Original (so liest jede Buchhaltung sie als Minderung). Anrechnungen (`anr-…`, negativer Einzelpreis) stehen als negative Menge
 * mit positivem Preis (EN 16931 BR-27: der Einzelpreis ist nie negativ).
 */
export function ciiXml(d: ERechnungDaten, profil: ERechnungProfil = 'en16931'): string {
  const { r, g } = d;
  const storno = r.art === 'storno';
  const ku = d.kleinunternehmer;
  const pos = r.positionen ?? [];
  const s = rechnungSummen(pos, { kleinunternehmer: ku });
  const v = mitVorgaben(g);
  const emp = r.empfaenger ?? {};
  const leitweg = d.leitwegId || emp.leitwegId;

  const zeilen = pos.map((p, i) => {
    const art = steuerArt(ku ? 0 : p.ustSatz, r, ku);
    const netto = positionNetto(p);
    const negativ = p.einzelpreisCent < 0;
    const menge = negativ ? -p.menge : p.menge;
    const preis = Math.abs(p.einzelpreisCent);
    // Rabatt als Positionsabschlag (BG-27): Menge × Preis − Abschlag = Netto, auf den Cent.
    const brutto = kaufmaennisch(menge * preis);
    const abschlag = brutto - netto;
    return `<ram:IncludedSupplyChainTradeLineItem>`
      + `<ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>`
      + `<ram:SpecifiedTradeProduct>${t('ram:SellerAssignedID', p.artikelnummer)}${t('ram:Name', p.titel || 'Leistung')}${t('ram:Description', p.text)}</ram:SpecifiedTradeProduct>`
      + `<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${betrag(preis)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>`
      + `<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${einheitCode(p.einheit)}">${zahl(menge)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>`
      + `<ram:SpecifiedLineTradeSettlement>`
      + `<ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${art.kat}</ram:CategoryCode><ram:RateApplicablePercent>${zahl(art.satz)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>`
      + (abschlag > 0 ? `<ram:SpecifiedTradeAllowanceCharge><ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator><ram:ActualAmount>${betrag(abschlag)}</ram:ActualAmount><ram:Reason>Rabatt${p.rabattProzent ? ` ${zahl(p.rabattProzent)} %` : ''}</ram:Reason></ram:SpecifiedTradeAllowanceCharge>` : '')
      + `<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${betrag(netto)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>`
      + `</ram:SpecifiedLineTradeSettlement></ram:IncludedSupplyChainTradeLineItem>`;
  }).join('');

  const verkaeuferKontakt = (g.telefon || g.email)
    ? `<ram:DefinedTradeContact>${t('ram:PersonName', g.geschaeftsfuehrung || v.name)}${g.telefon ? `<ram:TelephoneUniversalCommunication>${t('ram:CompleteNumber', g.telefon)}</ram:TelephoneUniversalCommunication>` : ''}${g.email ? `<ram:EmailURIUniversalCommunication>${t('ram:URIID', g.email)}</ram:EmailURIUniversalCommunication>` : ''}</ram:DefinedTradeContact>`
    : '';
  const verkaeufer = `<ram:SellerTradeParty>${t('ram:Name', v.name)}${verkaeuferKontakt}${adresse(g)}`
    + (g.email ? `<ram:URIUniversalCommunication>${t('ram:URIID', g.email, ' schemeID="EM"')}</ram:URIUniversalCommunication>` : '')
    + (g.ustId ? `<ram:SpecifiedTaxRegistration>${t('ram:ID', g.ustId, ' schemeID="VA"')}</ram:SpecifiedTaxRegistration>` : '')
    + (g.steuernummer ? `<ram:SpecifiedTaxRegistration>${t('ram:ID', g.steuernummer, ' schemeID="FC"')}</ram:SpecifiedTaxRegistration>` : '')
    + `</ram:SellerTradeParty>`;
  const kaeuferName = emp.firma || emp.name || r.kunde || 'Kunde';
  const kaeufer = `<ram:BuyerTradeParty>${t('ram:ID', emp.kundennummer)}${t('ram:Name', kaeuferName)}`
    + (emp.firma && emp.name ? `<ram:DefinedTradeContact>${t('ram:PersonName', emp.name)}</ram:DefinedTradeContact>` : '')
    + adresse(emp)
    + (emp.email ? `<ram:URIUniversalCommunication>${t('ram:URIID', emp.email, ' schemeID="EM"')}</ram:URIUniversalCommunication>` : '')
    + (emp.ustId ? `<ram:SpecifiedTaxRegistration>${t('ram:ID', emp.ustId, ' schemeID="VA"')}</ram:SpecifiedTaxRegistration>` : '')
    + `</ram:BuyerTradeParty>`;
  const vereinbarung = `<ram:ApplicableHeaderTradeAgreement>${t('ram:BuyerReference', leitweg)}${verkaeufer}${kaeufer}`
    + (emp.referenz ? `<ram:BuyerOrderReferencedDocument>${t('ram:IssuerAssignedID', emp.referenz)}</ram:BuyerOrderReferencedDocument>` : '')
    + `</ram:ApplicableHeaderTradeAgreement>`;

  const zeitraum = !!(r.leistungVon && r.leistungBis && r.leistungBis !== r.leistungVon);
  const lieferung = `<ram:ApplicableHeaderTradeDelivery>${!zeitraum && r.leistungVon ? `<ram:ActualDeliverySupplyChainEvent>${datum('ram:OccurrenceDateTime', r.leistungVon)}</ram:ActualDeliverySupplyChainEvent>` : ''}</ram:ApplicableHeaderTradeDelivery>`;

  const steuern = s.jeSatz.map(x => {
    const art = steuerArt(x.satz, r, ku);
    return `<ram:ApplicableTradeTax><ram:CalculatedAmount>${betrag(x.ust)}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode>${t('ram:ExemptionReason', art.grund)}`
      + `<ram:BasisAmount>${betrag(x.netto)}</ram:BasisAmount><ram:CategoryCode>${art.kat}</ram:CategoryCode>${t('ram:ExemptionReasonCode', art.code)}`
      + `<ram:RateApplicablePercent>${zahl(art.satz)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>`;
  }).join('');

  const iban = g.bank?.iban?.replace(/\s/g, '');
  const zahlung = iban
    ? `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount>${t('ram:IBANID', iban)}${t('ram:AccountName', g.bank?.inhaber || v.name)}</ram:PayeePartyCreditorFinancialAccount>`
      + (g.bank?.bic ? `<ram:PayeeSpecifiedCreditorFinancialInstitution>${t('ram:BICID', g.bank.bic)}</ram:PayeeSpecifiedCreditorFinancialInstitution>` : '')
      + `</ram:SpecifiedTradeSettlementPaymentMeans>`
    : '';
  const deDatum = (x?: string) => (x ? `${x.slice(8, 10)}.${x.slice(5, 7)}.${x.slice(0, 4)}` : '');
  const bedingung = storno
    ? `<ram:SpecifiedTradePaymentTerms>${t('ram:Description', `Stornorechnung zu ${d.original?.nummer ?? 'der Rechnung'} — der Betrag wird verrechnet bzw. erstattet.`)}</ram:SpecifiedTradePaymentTerms>`
    : r.faellig
      ? `<ram:SpecifiedTradePaymentTerms>${t('ram:Description', `Zahlbar ohne Abzug bis zum ${deDatum(r.faellig)} unter Angabe der Rechnungsnummer.`)}${datum('ram:DueDateDateTime', r.faellig)}</ram:SpecifiedTradePaymentTerms>`
      : '';
  const summen = `<ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>${betrag(s.netto)}</ram:LineTotalAmount>`
    + `<ram:TaxBasisTotalAmount>${betrag(s.netto)}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">${betrag(s.ust)}</ram:TaxTotalAmount>`
    + `<ram:GrandTotalAmount>${betrag(s.brutto)}</ram:GrandTotalAmount><ram:DuePayableAmount>${betrag(s.brutto)}</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>`;
  const bezug = storno && d.original?.nummer
    ? `<ram:InvoiceReferencedDocument>${t('ram:IssuerAssignedID', d.original.nummer)}${d.original.datum ? `<ram:FormattedIssueDateTime><qdt:DateTimeString format="102">${tag102(d.original.datum)}</qdt:DateTimeString></ram:FormattedIssueDateTime>` : ''}</ram:InvoiceReferencedDocument>`
    : '';
  const abrechnung = `<ram:ApplicableHeaderTradeSettlement>${t('ram:PaymentReference', r.nummer)}<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>${zahlung}${steuern}`
    + (zeitraum ? `<ram:BillingSpecifiedPeriod>${datum('ram:StartDateTime', r.leistungVon)}${datum('ram:EndDateTime', r.leistungBis)}</ram:BillingSpecifiedPeriod>` : '')
    + `${bedingung}${summen}${bezug}</ram:ApplicableHeaderTradeSettlement>`;

  const kontext = `<rsm:ExchangedDocumentContext>${profil === 'xrechnung' ? `<ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>${PROZESS_XRECHNUNG}</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter>` : ''}`
    + `<ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${SPEZIFIKATION[profil]}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>`;
  const dokument = `<rsm:ExchangedDocument>${t('ram:ID', r.nummer ?? r.id)}<ram:TypeCode>${storno ? '381' : '380'}</ram:TypeCode>${datum('ram:IssueDateTime', r.datum)}${hinweise(d, storno)}</rsm:ExchangedDocument>`;

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rsm:CrossIndustryInvoice xmlns:rsm="${NS.rsm}" xmlns:ram="${NS.ram}" xmlns:qdt="${NS.qdt}" xmlns:udt="${NS.udt}">`
    + kontext + dokument
    + `<rsm:SupplyChainTradeTransaction>${zeilen}${vereinbarung}${lieferung}${abrechnung}</rsm:SupplyChainTradeTransaction>`
    + `</rsm:CrossIndustryInvoice>\n`;
}

/** Eine CII-XML in die andere Spezifikation umschreiben (BT-23/24) — für die XRechnung aus der eingebetteten ZUGFeRD-Datei. */
export function profilWechseln(xml: string, profil: ERechnungProfil): string {
  const ohne = xml.replace(/<ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>[^<]*<\/ram:ID><\/ram:BusinessProcessSpecifiedDocumentContextParameter>/, '');
  const neu = `${profil === 'xrechnung' ? `<ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>${PROZESS_XRECHNUNG}</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter>` : ''}<ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${SPEZIFIKATION[profil]}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>`;
  return ohne.replace(/<ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>[^<]*<\/ram:ID><\/ram:GuidelineSpecifiedDocumentContextParameter>/, neu);
}

/** Leitweg-ID (BT-10) in eine CII-XML ohne Käuferreferenz einsetzen (nur unsere eigene Ausgabe — fester Aufbau). */
export function leitwegEinsetzen(xml: string, leitwegId: string): string {
  if (xml.includes('<ram:BuyerReference>')) return xml;
  return xml.replace('<ram:ApplicableHeaderTradeAgreement>', `<ram:ApplicableHeaderTradeAgreement>${t('ram:BuyerReference', leitwegId)}`);
}
