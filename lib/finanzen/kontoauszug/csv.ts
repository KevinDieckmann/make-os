// ─── Kontoauszug einlesen — CSV beliebiger Banken (09.10., rein: Server UND Browser) ────────────────────────────────────────────────────
// ONBOARDING_PLAN.md › L8: der bisherige Import (lib/finanzen/haushalt/import.ts) kannte nur N26, verlangte die Kopfzeile in Zeile 1 und
// teilte an Komma UND Semikolon (deutsche Beträge „1.234,56“ ohne Anführungszeichen zerfielen). Hier:
//   • Trenner erkennen (; , Tab |) — EIN Trenner je Datei, Anführungszeichen nach RFC 4180 (auch Zeilenumbrüche im Feld),
//   • Zeichensatz (UTF-8 oder Windows-1252) — `textAusBytes`,
//   • Vorspann überspringen (Kontonummer, Zeitraum, „Kontostand vom …“ stehen bei vielen Banken über der Kopfzeile) und Fußzeilen erkennen,
//   • Spaltenzuordnung: Vorschlag aus bekannten Spaltennamen (nur Kopfnamen, keine Daten), jederzeit von Hand änderbar,
//   • Betrag als eine Spalte, als Soll/Haben oder mit Soll/Haben-Kennzeichen; deutsches und englisches Zahlenformat; Beträge in Cent.
// Fremder Text (Namen, Verwendungszwecke) ist Daten: nichts hier wertet ihn aus außer zum Vergleichen.

import { betragCent, datumAus, textAusBytes, textGlaetten, vergleichsText, zahlformatErkennen, type Zahlformat } from './text';
import { pruefsumme } from './camt';
import { AUSZUG_GRENZEN, SPALTEN_FELDER, type Auszug, type AuszugEintrag, type AuszugSaldo, type CsvInfo, type EintragStatus, type LeseErgebnis, type Spalten, type SpaltenFeld } from './typen';
import { ibanGrundform, ibanGueltig } from '@/lib/crm/zahlung';

// ── Zerlegen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface CsvZeile { zellen: string[]; zeile: number }

/** Text → Zeilen mit Zellen (ein Trenner, Anführungszeichen nach RFC 4180). Leere Zeilen fallen weg; `zeile` = Zeilennummer in der Datei. */
export function csvZerlegen(text: string, trenner: string): CsvZeile[] {
  const raus: CsvZeile[] = [];
  let feld = '', zeile: string[] = [], inQ = false, nr = 1, start = 1, frisch = true;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { feld += '"'; i++; } else inQ = false; }
      else { if (c === '\n') nr++; feld += c; }
      continue;
    }
    if (c === '"' && frisch) { inQ = true; feld = ''; frisch = false; continue; }
    if (c === trenner) { zeile.push(feld); feld = ''; frisch = true; continue; }
    if (c === '\r') continue;
    if (c === '\n') { zeile.push(feld); raus.push({ zellen: zeile, zeile: start }); zeile = []; feld = ''; frisch = true; nr++; start = nr; continue; }
    if (frisch && (c === ' ' || c === '\t')) { feld += c; continue; }
    frisch = false;
    feld += c;
  }
  if (feld !== '' || zeile.length) { zeile.push(feld); raus.push({ zellen: zeile, zeile: start }); }
  return raus.map(r => ({ ...r, zellen: r.zellen.map(z => z.trim()) })).filter(r => r.zellen.some(z => z !== ''));
}

const TRENNER = [';', ',', '\t', '|'] as const;

/** Trenner erkennen: der, bei dem die meisten der ersten Zeilen dieselbe Zellenzahl (≥ 2) haben (Vorspann stört so nicht). */
export function trennerErkennen(text: string): string {
  const probe = text.slice(0, 64_000);
  let best: string = ';', bestWert = -1;
  for (const t of TRENNER) {
    const zeilen = csvZerlegen(probe, t).slice(0, 60);
    const zaehler = new Map<number, number>();
    for (const z of zeilen) if (z.zellen.length >= 2) zaehler.set(z.zellen.length, (zaehler.get(z.zellen.length) ?? 0) + 1);
    let wert = 0;
    for (const [breite, anzahl] of Array.from(zaehler)) wert = Math.max(wert, anzahl * 1000 + breite);
    if (wert > bestWert) { best = t; bestWert = wert; }
  }
  return best;
}

// ── Kopfzeile und Spaltenvorschlag ───────────────────────────────────────────────────────────────────────────────────────────────

/** Spaltenname zum Vergleichen: klein, Umlaute ausgeschrieben, ohne Anführungszeichen/Doppelpunkt. */
export const kopfNorm = (s: string): string => vergleichsText(s).replace(/["':]/g, '').replace(/\s+/g, ' ').trim();

const KOPF_WOERTER = ['datum', 'date', 'buchung', 'betrag', 'amount', 'umsatz', 'zweck', 'referenz', 'reference', 'empfaenger', 'auftraggeber', 'beguenstigt',
  'zahlungspflichtig', 'zahlungsbeteiligt', 'valuta', 'wertstellung', 'wert', 'saldo', 'balance', 'waehrung', 'currency', 'iban', 'bic', 'soll', 'haben', 'name',
  'partner', 'counterparty', 'gegenpartei', 'kategorie', 'category', 'status', 'state', 'type', 'typ', 'buchungstext', 'description', 'beschreibung', 'fee',
  'gebuehr', 'kontonummer', 'auftragskonto', 'payee', 'payer'];

const siehtAusWieWert = (s: string) => !!datumAus(s) || betragCent(s) !== null || ibanGueltig(s);
const istKopfZelle = (s: string) => { const n = kopfNorm(s); return !!n && n.length <= 60 && !siehtAusWieWert(s) && KOPF_WOERTER.some(w => n.includes(w)); };

/** Index der Kopfzeile (Vorspann darüber wird übersprungen) — -1, wenn die Datei keine erkennbare hat. */
export function kopfFinden(zeilen: readonly CsvZeile[]): number {
  let bester = -1, besterWert = 0;
  const grenze = Math.min(zeilen.length - 1, 60);
  for (let i = 0; i < grenze; i++) {
    const zellen = zeilen[i].zellen.filter(z => z !== '');
    if (zellen.length < 2) continue;
    const treffer = zellen.filter(istKopfZelle).length;
    if (treffer < 2 || treffer / zellen.length < 0.34) continue;
    // Eine echte Kopfzeile hat darunter Datenzeilen mit einem Datum.
    const danach = zeilen.slice(i + 1, i + 4).some(z => z.zellen.some(c => !!datumAus(c)));
    if (danach) return i;
    if (treffer > besterWert) { bester = i; besterWert = treffer; }
  }
  return bester;
}

interface Regel { feld: SpaltenFeld; genau?: string[]; enthaelt?: string[]; nicht?: string[] }
/** Bekannte Spaltennamen (nur Kopfnamen deutscher und europäischer Banken, keine Daten) — Reihenfolge = Vorrang. */
const REGELN: Regel[] = [
  { feld: 'eigeneIban', genau: ['auftragskonto', 'iban auftragskonto', 'iban auftraggeberkonto', 'account iban'], enthaelt: ['auftragskonto', 'auftraggeberkonto'], nicht: ['bic', 'bankleitzahl', 'bezeichnung', 'bankname', 'blz'] },
  { feld: 'datum', genau: ['buchungstag', 'buchungsdatum', 'booking date', 'datum', 'date', 'completed date', 'date completed (utc)', 'date completed', 'datum der abwicklung (utc)', 'settlement date (utc)', 'transaktionsdatum', 'buchung'], enthaelt: ['buchungstag', 'buchungsdatum', 'booking date', 'completed', 'abwicklung', 'settlement'] },
  { feld: 'valuta', genau: ['valutadatum', 'valuta', 'wertstellung', 'wertstellungsdatum', 'wert', 'value date'], enthaelt: ['valuta', 'wertstellung', 'value date'] },
  { feld: 'saldo', genau: ['saldo nach buchung', 'saldo', 'kontostand', 'balance', 'saldo (eur)'], enthaelt: ['saldo', 'balance', 'kontostand'] },
  { feld: 'betrag', genau: ['betrag', 'betrag (eur)', 'amount (eur)', 'amount', 'umsatz', 'umsatz in eur', 'betrag in eur', 'betrag eur', 'gesamtbetrag (inkl. mwst.)', 'total amount (incl. vat)', 'total amount'], enthaelt: ['betrag', 'amount', 'umsatz'], nicht: ['ursprung', 'fremdw', 'original', 'orig', 'gebuehr', 'fee', 'umsatzart', 'anzahl'] },
  { feld: 'soll', genau: ['soll', 'soll (eur)', 'debit', 'belastung', 'ausgang', 'ausgaben'] },
  { feld: 'haben', genau: ['haben', 'haben (eur)', 'credit', 'gutschrift', 'eingang', 'einnahmen'] },
  { feld: 'kennzeichen', genau: ['soll/haben', 's/h', 'soll-haben', 'haben/soll', 'soll/haben-kennzeichen', 'debit/credit', 'kennzeichen', 'cdtdbtind'] },
  { feld: 'gebuehr', genau: ['fee', 'gebuehr', 'gebuehren', 'fees'] },
  { feld: 'waehrung', genau: ['waehrung', 'currency', 'whrg', 'whrg.', 'payment currency'], enthaelt: ['waehrung', 'currency'], nicht: ['orig', 'fremd', 'ursprung', 'betrag', 'kurs'] },
  { feld: 'iban', genau: ['iban zahlungsbeteiligter', 'kontonummer/iban', 'partner iban', 'iban', 'iban gegenkonto', 'gegenkonto', 'beneficiary iban', 'counterparty iban', 'iban der gegenpartei', 'kontonummer'], enthaelt: ['iban'], nicht: ['auftragskonto', 'auftraggeberkonto', 'account iban'] },
  { feld: 'gegenpartei', genau: ['name zahlungsbeteiligter', 'beguenstigter/zahlungspflichtiger', 'beguenstigter / auftraggeber', 'auftraggeber/empfaenger', 'auftraggeber / empfaenger', 'auftraggeber / beguenstigter', 'empfaenger', 'auftraggeber', 'partner name', 'name der gegenpartei', 'counterparty name', 'counterparty', 'payee', 'name', 'zahlungsempfaenger', 'beguenstigter', 'zahlungspflichtiger', 'gegenpartei', 'payer'], enthaelt: ['beguenstigt', 'zahlungsbeteiligt', 'auftraggeber', 'empfaenger', 'gegenpartei', 'counterparty', 'partner name'], nicht: ['iban', 'bic', 'konto', 'abweichend', 'blz', 'bankleitzahl', 'glaeubiger'] },
  { feld: 'kennung', genau: ['transaktions-id', 'transaction id', 'id', 'transaktionsnummer', 'umsatz-id', 'buchungsreferenz', 'referenznummer', 'transaktion id'] },
  { feld: 'status', genau: ['status', 'state', 'info', 'buchungsstatus', 'transaktionsstatus'] },
  { feld: 'kategorie', genau: ['kategorie', 'category'] },
];
const ZWECK_ERSATZ = ['payment reference', 'referenz', 'reference', 'beschreibung', 'description', 'buchungstext'];

/** Aufbau bekannter Banken — nur für die Anzeige („sieht aus wie …“); alle Merkmale müssen als Spaltenname vorkommen. */
const BANKEN: { name: string; merkmale: string[][] }[] = [
  { name: 'N26', merkmale: [['booking date', 'partner name'], ['datum', 'empfaenger', 'betrag (eur)']] },
  { name: 'Sparkasse', merkmale: [['auftragskonto', 'beguenstigter/zahlungspflichtiger']] },
  { name: 'Volks- und Raiffeisenbanken', merkmale: [['iban auftragskonto', 'name zahlungsbeteiligter']] },
  { name: 'Deutsche Bank', merkmale: [['umsatzart', 'beguenstigter / auftraggeber', 'soll', 'haben']] },
  { name: 'Commerzbank', merkmale: [['umsatzart', 'buchungstext', 'iban auftraggeberkonto']] },
  { name: 'Qonto', merkmale: [['name der gegenpartei'], ['counterparty name']] },
  { name: 'Revolut', merkmale: [['completed date', 'description', 'amount'], ['date completed (utc)', 'description', 'amount']] },
  { name: 'Kontist', merkmale: [['buchungsdatum', 'wertstellungsdatum', 'verwendungszweck']] },
];

/** Vorschlag der Spaltenzuordnung aus den Spaltennamen (jede Spalte höchstens einmal; Verwendungszweck auch über mehrere Spalten). */
export function spaltenVorschlag(kopf: readonly string[]): { vorschlag: Partial<Spalten>; bank?: string } {
  const norm = kopf.map(kopfNorm);
  const belegt = new Set<number>();
  const v: Partial<Spalten> = {};
  const finde = (r: Regel): number => {
    const frei = (i: number) => !belegt.has(i) && !!norm[i] && !(r.nicht ?? []).some(w => norm[i].includes(w));
    for (const g of r.genau ?? []) { const i = norm.findIndex((n, j) => n === g && frei(j)); if (i >= 0) return i; }
    for (const g of r.enthaelt ?? []) { const i = norm.findIndex((n, j) => n.includes(g) && frei(j)); if (i >= 0) return i; }
    return -1;
  };
  for (const r of REGELN) {
    const i = finde(r);
    if (i < 0) continue;
    // Soll/Haben nur zusammen mit einem fehlenden Betrag (sonst wären „Soll“/„Haben“-Kennzeichen doppelt gedeutet).
    if ((r.feld === 'soll' || r.feld === 'haben') && v.betrag !== undefined) continue;
    (v as Record<string, number>)[r.feld] = i;
    belegt.add(i);
  }
  const zwecke = norm.map((n, i) => (n.includes('verwendungszweck') && !belegt.has(i) ? i : -1)).filter(i => i >= 0);
  if (zwecke.length) { v.zweck = zwecke; zwecke.forEach(i => belegt.add(i)); }
  // Revolut & Co.: „Description“ ist der Händler — als Gegenseite, wenn keine eigene Spalte dafür da ist (vor dem Ersatz für den Zweck).
  if (v.gegenpartei === undefined) { const i = norm.findIndex((n, j) => (n === 'description' || n === 'beschreibung') && !belegt.has(j)); if (i >= 0) { v.gegenpartei = i; belegt.add(i); } }
  if (!zwecke.length) {
    for (const g of ZWECK_ERSATZ) { const i = norm.findIndex((n, j) => n === g && !belegt.has(j)); if (i >= 0) { v.zweck = [i]; belegt.add(i); break; } }
  }
  const menge = new Set(norm);
  const bank = BANKEN.find(b => b.merkmale.some(m => m.every(x => menge.has(x))))?.name;
  return { vorschlag: v, ...(bank ? { bank } : {}) };
}

/** Ist die Zuordnung vollständig genug zum Lesen? (Datum + Betrag oder Soll/Haben) */
export const spaltenVollstaendig = (s: Partial<Spalten>): s is Spalten =>
  typeof s.datum === 'number' && (typeof s.betrag === 'number' || typeof s.soll === 'number' || typeof s.haben === 'number');

/** Eine Zuordnung von außen (Browser) prüfen: nur bekannte Felder, ganze Zahlen innerhalb der Breite. Fehler → Satz. */
export function spaltenPruefen(roh: unknown, breite: number): { ok: true; spalten: Spalten } | { ok: false; fehler: string } {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, fehler: 'Spaltenzuordnung fehlt.' };
  const o = roh as Record<string, unknown>;
  const s: Partial<Spalten> = {};
  const nr = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < breite ? v : null);
  for (const [k, v] of Object.entries(o)) {
    if (!(SPALTEN_FELDER as readonly string[]).includes(k)) return { ok: false, fehler: `Unbekanntes Feld „${k.slice(0, 30)}“ in der Spaltenzuordnung.` };
    if (v === null || v === undefined) continue;
    if (k === 'zweck') {
      const l = Array.isArray(v) ? v : [v];
      if (l.length > 20) return { ok: false, fehler: 'Höchstens 20 Spalten für den Verwendungszweck.' };
      const nummern = l.map(nr);
      if (nummern.some(x => x === null)) return { ok: false, fehler: 'Spalte für den Verwendungszweck gibt es nicht.' };
      if (nummern.length) s.zweck = nummern as number[];
      continue;
    }
    const n = nr(v);
    if (n === null) return { ok: false, fehler: `Die Spalte für „${k}“ gibt es in dieser Datei nicht.` };
    (s as Record<string, number>)[k] = n;
  }
  if (!spaltenVollstaendig(s)) return { ok: false, fehler: 'Bitte mindestens den Buchungstag und den Betrag (bzw. Soll/Haben) zuordnen.' };
  return { ok: true, spalten: s };
}

// ── Lesen ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const VORGEMERKT = /vorgemerkt|pending|ausstehend|in bearbeitung|reserv|authori[sz]|offen/i;
const ABGELEHNT = /storniert|storno|revert|declin|abgelehnt|fail|cancel|rueckgaengig|zurueckgewiesen/i;
const statusAus = (s: string): EintragStatus => (!s ? 'gebucht' : ABGELEHNT.test(vergleichsText(s)) ? 'abgelehnt' : VORGEMERKT.test(vergleichsText(s)) ? 'vorgemerkt' : 'gebucht');
const SOLL_KZ = /^(s|soll|d|db|dbit|debit|-|belastung|ausgang)$/i;
const HABEN_KZ = /^(h|haben|c|cr|crdt|credit|\+|gutschrift|eingang)$/i;
const ENDE_SALDO = /(neuer|end|schluss)\s*-?\s*(kontostand|saldo)|^kontostand|^saldo|kontostand am|saldo am/;
const ANFANG_SALDO = /(alter|anfangs?|eroeffnungs)\s*-?\s*(kontostand|saldo)|vortrag/;
const IBAN_IN_TEXT = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g;

/** Saldo aus einer Zeile außerhalb der Daten (Vorspann/Fuß): Betrag und Datum aus den Zellen — ohne Datum keiner (nie raten). */
function saldoAusZeile(z: CsvZeile, zf: Zahlformat): { art: 'anfang' | 'ende'; saldo: AuszugSaldo } | null {
  const text = kopfNorm(z.zellen.join(' '));
  const art = ANFANG_SALDO.test(text) ? 'anfang' : ENDE_SALDO.test(text) ? 'ende' : null;
  if (!art) return null;
  let datum: string | null = null, cent: number | null = null;
  for (const c of z.zellen) {
    if (!datum) { const d = datumAus(c) ?? datumAus(/\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2}/.exec(c)?.[0] ?? ''); if (d) { datum = d; continue; } }
    const b = betragCent(c, zf);
    if (b !== null && /\d[.,]\d{2}\b/.test(c)) cent = b;
  }
  return datum && cent !== null ? { art, saldo: { cent, datum } } : null;
}

/** IBAN aus Vorspann-Zellen (gültige Prüfziffer). */
function ibanAusVorspann(zeilen: readonly CsvZeile[]): string | undefined {
  for (const z of zeilen) for (const c of z.zellen) for (const m of Array.from(c.toUpperCase().matchAll(IBAN_IN_TEXT))) if (ibanGueltig(m[0])) return ibanGrundform(m[0]);
  return undefined;
}

/**
 * CSV-Bytes → Auszug. Ohne `spalten` gilt der Vorschlag; ist der unvollständig, kommt `ok: false` MIT den CSV-Angaben (Kopf, Beispiel,
 * Vorschlag) zurück — die Oberfläche lässt dann zuordnen. Mehrere eigene Konten in einer Datei (Spalte „Auftragskonto“) → ein Auszug je Konto.
 */
export function csvLesen(bytes: Uint8Array, opt: { spalten?: unknown } = {}): LeseErgebnis {
  const { text, zeichensatz } = textAusBytes(bytes);
  const trenner = trennerErkennen(text);
  const zeilen = csvZerlegen(text, trenner);
  if (zeilen.length < 1) return { ok: false, status: 400, fehler: 'Die Datei ist leer.' };
  const k = kopfFinden(zeilen);
  const breite = Math.max(...zeilen.slice(Math.max(0, k), Math.max(0, k) + 50).map(z => z.zellen.length));
  const kopf = k >= 0 ? zeilen[k].zellen : Array.from({ length: breite }, (_, i) => `Spalte ${i + 1}`);
  const ersteDaten = k >= 0 ? k + 1 : Math.max(0, zeilen.findIndex(z => z.zellen.some(c => !!datumAus(c))));
  const daten = zeilen.slice(ersteDaten);
  const vorspann = zeilen.slice(0, k >= 0 ? k : ersteDaten);
  const { vorschlag, bank } = k >= 0 ? spaltenVorschlag(kopf) : { vorschlag: {} as Partial<Spalten>, bank: undefined };
  // Eine Zuordnung von außen (Browser) wird gegen DIESE Datei geprüft — nie blind übernommen.
  const gepr = opt.spalten !== undefined && opt.spalten !== null ? spaltenPruefen(opt.spalten, breite) : null;
  const spalten: Spalten | null = gepr ? (gepr.ok ? gepr.spalten : null) : spaltenVollstaendig(vorschlag) ? vorschlag : null;
  const geld = (s: Spalten | null) => (s ? daten.flatMap(z => [s.betrag, s.soll, s.haben, s.saldo].filter((x): x is number => typeof x === 'number').map(i => z.zellen[i] ?? '')) : []);
  const zahlformat = zahlformatErkennen(geld(spalten));
  const csv: CsvInfo = {
    trenner, zeichensatz, kopfZeile: k >= 0 ? zeilen[k].zeile : 0, kopf, beispiel: daten.slice(0, 5).map(z => z.zellen), vorschlag, spalten,
    ...(bank ? { bank } : {}), zahlformat,
  };
  if (gepr && !gepr.ok) return { ok: false, status: 400, fehler: gepr.fehler, csv };
  if (!spalten) return { ok: false, status: 400, fehler: 'Spalten zuordnen: Buchungstag und Betrag (bzw. Soll/Haben) wurden nicht sicher erkannt.', csv };

  const zelle = (z: CsvZeile, i: number | undefined) => (typeof i === 'number' ? (z.zellen[i] ?? '').trim() : '');
  const hinweise: string[] = [];
  const gruppen = new Map<string, { eintraege: AuszugEintrag[]; saldi: { saldo: number; datum: string; cent: number; pos: number }[] }>();
  let ohneDatum = 0, ohneBetrag = 0, fussAnfang: AuszugSaldo | undefined, fussEnde: AuszugSaldo | undefined;
  const ohneDatumZeilen: number[] = [];
  let pos = 0;
  for (const z of daten) {
    const datum = datumAus(zelle(z, spalten.datum));
    if (!datum) {
      const s = saldoAusZeile(z, zahlformat);
      if (s?.art === 'ende') fussEnde = s.saldo; else if (s?.art === 'anfang') fussAnfang = s.saldo;
      else { ohneDatum++; if (ohneDatumZeilen.length < 5) ohneDatumZeilen.push(z.zeile); }
      continue;
    }
    let cent: number | null;
    if (typeof spalten.betrag === 'number') {
      cent = betragCent(zelle(z, spalten.betrag), zahlformat);
      const kz = zelle(z, spalten.kennzeichen);
      if (cent !== null && kz) { if (SOLL_KZ.test(kz)) cent = -Math.abs(cent); else if (HABEN_KZ.test(kz)) cent = Math.abs(cent); }
    } else {
      const s = betragCent(zelle(z, spalten.soll), zahlformat), h = betragCent(zelle(z, spalten.haben), zahlformat);
      cent = s === null && h === null ? null : (h !== null ? Math.abs(h) : 0) - (s !== null ? Math.abs(s) : 0);
    }
    if (cent === null) { ohneBetrag++; continue; }
    const geb = betragCent(zelle(z, spalten.gebuehr), zahlformat);
    if (geb) cent -= Math.abs(geb);
    const w = zelle(z, spalten.waehrung).toUpperCase();
    const waehrung = /^[A-Z]{3}$/.test(w) ? w : 'EUR';
    const ibanRoh = zelle(z, spalten.iban);
    const zweck = (spalten.zweck ?? []).map(i => zelle(z, i)).filter(Boolean).join(' ');
    const kennung = zelle(z, spalten.kennung);
    const eigene = zelle(z, spalten.eigeneIban);
    const gruppe = eigene && ibanGueltig(eigene) ? ibanGrundform(eigene) : '';
    const g = gruppen.get(gruppe) ?? { eintraege: [], saldi: [] };
    const valuta = datumAus(zelle(z, spalten.valuta));
    const kat = zelle(z, spalten.kategorie);
    g.eintraege.push({
      datum, ...(valuta ? { valuta } : {}), cent, waehrung,
      gegenpartei: textGlaetten(zelle(z, spalten.gegenpartei)), ...(ibanRoh && ibanGueltig(ibanRoh) ? { gegenIban: ibanGrundform(ibanRoh) } : {}),
      zweck: textGlaetten(zweck), ...(kat ? { kategorie: textGlaetten(kat).slice(0, 60) } : {}), ...(kennung ? { externeId: kennung.slice(0, 120) } : {}),
      status: statusAus(zelle(z, spalten.status)), zeile: z.zeile,
    });
    const saldo = typeof spalten.saldo === 'number' ? betragCent(zelle(z, spalten.saldo), zahlformat) : null;
    if (saldo !== null) g.saldi.push({ saldo, datum, cent, pos });
    pos++;
    gruppen.set(gruppe, g);
    if (pos > AUSZUG_GRENZEN.eintraege) return { ok: false, status: 413, fehler: `Mehr als ${AUSZUG_GRENZEN.eintraege.toLocaleString('de-DE')} Umsätze in einer Datei — bitte in kleineren Zeiträumen herunterladen. Nichts gelesen.`, csv };
  }
  if (ohneDatum) hinweise.push(`${ohneDatum} ${ohneDatum === 1 ? 'Zeile ohne gültigen Buchungstag wurde' : 'Zeilen ohne gültigen Buchungstag wurden'} übersprungen (Zeile ${ohneDatumZeilen.join(', ')}${ohneDatum > ohneDatumZeilen.length ? ' …' : ''}).`);
  if (ohneBetrag) hinweise.push(`${ohneBetrag} ${ohneBetrag === 1 ? 'Zeile ohne lesbaren Betrag wurde' : 'Zeilen ohne lesbaren Betrag wurden'} übersprungen — Spalte „Betrag“ prüfen.`);
  if (!gruppen.size) return { ok: false, status: 400, fehler: 'Keine Zeile sah nach einem Umsatz aus — passt die Spaltenzuordnung?', csv };

  // Saldo aus Vorspann/Fuß (nur mit Datum).
  for (const z of vorspann) { const s = saldoAusZeile(z, zahlformat); if (s?.art === 'ende' && !fussEnde) fussEnde = s.saldo; if (s?.art === 'anfang' && !fussAnfang) fussAnfang = s.saldo; }
  const vorspannIban = ibanAusVorspann(vorspann);
  const auszuege: Auszug[] = [];
  for (const [gruppe, g] of Array.from(gruppen)) {
    const h: string[] = [];
    let saldo: AuszugSaldo | undefined, anfang: AuszugSaldo | undefined;
    if (g.saldi.length) {
      // Reihenfolge der Datei: absteigend (neueste oben) oder aufsteigend — bestimmt, welche Zeile am selben Tag die letzte war.
      const absteigend = g.eintraege.length > 1 && g.eintraege[0].datum > g.eintraege[g.eintraege.length - 1].datum;
      const nachZeit = [...g.saldi].sort((a, b) => a.datum.localeCompare(b.datum) || (absteigend ? b.pos - a.pos : a.pos - b.pos));
      const letzte = nachZeit[nachZeit.length - 1], erste = nachZeit[0];
      saldo = { cent: letzte.saldo, datum: letzte.datum };
      anfang = { cent: erste.saldo - erste.cent, datum: erste.datum };
    } else if (gruppen.size === 1) {
      saldo = fussEnde; anfang = fussAnfang;
      if (!saldo) h.push('Die Datei nennt keinen Saldo mit Datum — der Kontostand bitte von Hand eintragen.');
    }
    const iban = gruppe || (gruppen.size === 1 ? vorspannIban : undefined);
    const waehrungen = new Set(g.eintraege.map(e => e.waehrung));
    const waehrung = waehrungen.size === 1 ? Array.from(waehrungen)[0] : 'EUR';
    const pruefung = pruefsumme(anfang, saldo, g.eintraege, waehrung);
    if (pruefung && !pruefung.stimmt) h.push('Saldo-Prüfung geht nicht auf (Anfang + Umsätze ≠ Ende) — Spaltenzuordnung und Vorzeichen prüfen.');
    const vorgemerkt = g.eintraege.filter(e => e.status === 'vorgemerkt').length;
    if (vorgemerkt) h.push(`${vorgemerkt} vorgemerkte ${vorgemerkt === 1 ? 'Umsatz wird' : 'Umsätze werden'} nicht übernommen (erst, wenn sie gebucht sind).`);
    auszuege.push({ ...(iban ? { iban } : {}), waehrung, ...(saldo ? { saldo } : {}), ...(anfang ? { anfang } : {}), eintraege: g.eintraege, hinweise: h, pruefung });
  }
  if (gruppen.size > 1) hinweise.push(`Die Datei enthält ${gruppen.size} Konten (Spalte „Auftragskonto“) — übernommen wird nur das gewählte.`);
  return { ok: true, format: 'csv', auszuege, csv, hinweise };
}
