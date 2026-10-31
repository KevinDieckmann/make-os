// ─── E-Rechnung — Eingang: aus der gelesenen XML den Beleg-Vorschlag machen (rein, 31.10.) ─
// Dieselbe Form wie die Texterkennung in /api/beleg (`BelegDaten`), nur aus der Datei statt aus dem Modell: Lieferant, Datum, Nummer,
// Netto/USt/Brutto, Fälligkeit, Satz. Richtung: steht eine EIGENE Gesellschaft als Käufer → Eingang, als Verkäufer → Ausgang (Abgleich
// über USt-IdNr., Steuernummer, Firmierung). Gutschrift/Storno (381, UBL CreditNote): Beträge bleiben positiv, `unsicher` sagt es.

import type { ERechnungGelesen } from './lesen';

export interface EigeneIdentitaet { namen: string[]; ustIds: string[]; steuernummern: string[] }

/** Dieselbe Form wie `BelegDaten` in app/api/beleg/route.ts (dort importiert). */
export interface BelegAusXml {
  richtung: 'eingang' | 'ausgang' | 'unklar';
  partner: string;
  datum?: string;
  betragBrutto?: number;
  betragNetto?: number;
  ustSatz?: number;
  waehrung?: string;
  rechnungsnummer?: string;
  zweck?: string;
  faellig?: string;
  kategorie?: string;
  unsicher?: string[];
  /** Woher der Vorschlag kommt: die E-Rechnung selbst (kein Modell). */
  quelle: 'e-rechnung';
  /** Was gelesen wurde (Anzeige): „ZUGFeRD/Factur-X“, „XRechnung (CII)“, „XRechnung (UBL)“, „E-Rechnung (UBL)“ … */
  format: string;
  gutschrift?: boolean;
}

const norm = (s: string | undefined) => (s ?? '').normalize('NFC').toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
const idNorm = (s: string | undefined) => (s ?? '').replace(/[\s/.-]/g, '').toUpperCase();

function istEigen(p: { name?: string; ustId?: string; steuernummer?: string }, eigen: EigeneIdentitaet): boolean {
  if (p.ustId && eigen.ustIds.some(x => idNorm(x) === idNorm(p.ustId))) return true;
  if (p.steuernummer && eigen.steuernummern.some(x => idNorm(x) === idNorm(p.steuernummer))) return true;
  return !!p.name && norm(p.name).length >= 4 && eigen.namen.some(n => norm(n) === norm(p.name));
}

const positiv = (n: number | undefined) => (n === undefined ? undefined : Math.abs(n) < 1e9 ? Math.round(Math.abs(n) * 100) / 100 : undefined);

/** Format für die Anzeige. `eingebettet` = aus einer PDF (ZUGFeRD/Factur-X). */
export function formatName(e: ERechnungGelesen, eingebettet: boolean): string {
  if (e.xrechnung) return `XRechnung (${e.format.toUpperCase()})`;
  if (eingebettet) return 'ZUGFeRD/Factur-X';
  return `E-Rechnung (${e.format.toUpperCase()})`;
}

export function belegAusERechnung(e: ERechnungGelesen, eigen: EigeneIdentitaet, opt: { eingebettet: boolean }): BelegAusXml {
  const kaeuferEigen = istEigen(e.kaeufer, eigen);
  const verkaeuferEigen = istEigen(e.verkaeufer, eigen);
  const richtung: BelegAusXml['richtung'] = kaeuferEigen && !verkaeuferEigen ? 'eingang' : verkaeuferEigen && !kaeuferEigen ? 'ausgang' : 'unklar';
  const partner = (richtung === 'ausgang' ? e.kaeufer.name : e.verkaeufer.name) ?? '';
  const unsicher: string[] = [];
  if (richtung === 'unklar') unsicher.push('richtung');
  if (e.gutschrift) unsicher.push('Gutschrift/Storno — Beträge mindern, bitte Vorzeichen prüfen');
  if (e.saetze.length > 1) unsicher.push(`mehrere Steuersätze (${e.saetze.join(' %, ')} %) — ustSatz leer`);
  if (e.waehrung && e.waehrung !== 'EUR') unsicher.push(`Währung ${e.waehrung}`);
  const brutto = positiv(e.brutto ?? e.zahlbar);
  const netto = positiv(e.netto);
  if (brutto !== undefined && netto !== undefined && netto > brutto) unsicher.push('betragNetto größer als Brutto — bitte prüfen');
  return {
    richtung, partner: partner.slice(0, 140),
    ...(e.datum ? { datum: e.datum } : {}),
    ...(brutto !== undefined ? { betragBrutto: brutto } : {}),
    ...(netto !== undefined ? { betragNetto: netto } : {}),
    ...(e.saetze.length === 1 ? { ustSatz: e.saetze[0] } : {}),
    waehrung: (e.waehrung ?? 'EUR').slice(0, 6).toUpperCase(),
    ...(e.nummer ? { rechnungsnummer: e.nummer.slice(0, 60) } : {}),
    ...(e.zweck ? { zweck: e.zweck.slice(0, 200) } : {}),
    ...(e.faellig ? { faellig: e.faellig } : {}),
    ...(unsicher.length ? { unsicher: unsicher.slice(0, 8) } : {}),
    quelle: 'e-rechnung', format: formatName(e, opt.eingebettet), ...(e.gutschrift ? { gutschrift: true } : {}),
  };
}
