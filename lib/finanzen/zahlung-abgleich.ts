// ─── Eine Zahlung — einmal in den Business-Buchungen (09.10., Endprüfung „Nahtstellen Finanzen“) ─────────────────────────────────────
// Befund: In den Bestand `buchungen` schreiben drei Wege dieselbe Geldbewegung — „Rechnung bezahlt“ (`bu-re-<id>`), „Beleg übernehmen“ und
// Buchungen von Hand (`b-…`/`bu-…`) — und seit 09.10. der Kontoauszug (`bu-ka-…`). Der Dublettenschutz des Kontoauszugs verglich nur den
// genauen Fingerabdruck (Datum, Betrag, Name, Zweck); den hat eine Rechnungs- oder Belegbuchung nie (eigener Name, eigener Zweck, eigenes
// Datum) → derselbe Zahlungseingang stand zweimal in „reingekommen“, Fluss und „Dieser Monat“.
//
// EINE Regel für beide Richtungen (rein, Server UND Browser):
//   • Kontoauszug nach der Rechnung/dem Beleg: der Bank-Umsatz gilt als „schon gebucht“ und wird nicht angelegt; die Zuordnung (Kennung der
//     vorhandenen Buchung ↔ Schlüssel des Umsatzes) hält das Lauf-Protokoll des Kontoauszugs fest — so schluckt dieselbe Buchung nie einen
//     zweiten Umsatz (auch nicht in einer späteren Datei), und „Rückgängig“ gibt sie wieder frei.
//   • Rechnung/Beleg nach dem Kontoauszug: kein zweiter Eintrag — der Bank-Umsatz bekommt den Bezug (`rechnungId` bzw. `beleg`).
// Gleich heißt: gleiche Gesellschaft (`ort`), Betrag auf den Cent gleich (mit Vorzeichen), höchstens ABGLEICH_TAGE auseinander und — damit
// zwei gleich hohe Zahlungen verschiedener Kunden nie verwechselt werden — die Rechnungsnummer steht im Verwendungszweck ODER der Name passt
// (ohne Rechtsform, ein gemeinsames Wort ab drei Buchstaben). Im Zweifel bleibt es zwei Buchungen (wie vorher), nie wird still verschluckt,
// was nicht passt.

import { vergleichsText } from './kontoauszug/text';

/** Höchstens so viele Tage zwischen Bank-Buchungstag und „bezahlt am“ bzw. Belegdatum. */
export const ABGLEICH_TAGE = 14;

const RECHTSFORM = new Set(['gmbh', 'mbh', 'ug', 'ag', 'kg', 'ohg', 'gbr', 'ev', 'eg', 'se', 'kgaa', 'co', 'cokg', 'haftungsbeschraenkt', 'partg', 'partgmbb', 'ltd', 'inc', 'llc', 'sarl', 'sas', 'bv', 'nv', 'plc']);
/** Wörter, die in vielen Namen stehen und deshalb nichts beweisen. */
const ALLERWELT = new Set([
  'und', 'der', 'die', 'das', 'von', 'fuer', 'the', 'and', 'des', 'dem', 'den', 'mit', 'bei',
  'deutschland', 'deutsche', 'deutscher', 'germany', 'german', 'europe', 'europa', 'international', 'gruppe', 'group', 'holding', 'gesellschaft',
  'service', 'services', 'online', 'bank', 'sparkasse', 'volksbank', 'raiffeisenbank', 'kasse', 'zahlung', 'rechnung', 'gutschrift', 'lastschrift',
  'ueberweisung', 'sepa', 'beratung', 'consulting', 'management', 'solutions', 'digital', 'media', 'systems', 'software', 'gmbhco',
]);

/** Die Wörter eines Namens, die ihn tragen: ohne Rechtsform, ohne Allerweltswörter, ab drei Zeichen. */
export function namensWoerter(name: unknown): string[] {
  const t = vergleichsText(name).replace(/&/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  return Array.from(new Set(t.split(' ').filter(w => w.length >= 3 && !RECHTSFORM.has(w) && !ALLERWELT.has(w))));
}

/** Passen zwei Namen (Gegenseite der Bank ↔ Kunde/Lieferant der Buchung)? Ein gemeinsames tragendes Wort reicht. */
export function namenPassen(a: unknown, b: unknown): boolean {
  const x = namensWoerter(a), y = new Set(namensWoerter(b));
  return x.some(w => y.has(w));
}

/** Steht die Rechnungsnummer (ab vier Zeichen, ohne Leer- und Trennzeichen verglichen) im Text? */
export function nummerImText(nummer: unknown, text: unknown): boolean {
  const n = vergleichsText(nummer).replace(/[^a-z0-9]/g, '');
  if (n.length < 4) return false;
  return vergleichsText(text).replace(/[^a-z0-9]/g, '').includes(n);
}

/** Tage zwischen zwei Kalendertagen (JJJJ-MM-TT), Betrag. Ungültig → unendlich. */
export function tageAbstand(a: string, b: string): number {
  const x = Date.parse(`${a.slice(0, 10)}T12:00:00Z`), y = Date.parse(`${b.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(x) && Number.isFinite(y) ? Math.round(Math.abs(x - y) / 864e5) : Infinity;
}

/** Ein Umsatz der Bank. */
export interface BankUmsatz { datum: string; cent: number; gegenpartei: string; zweck: string }
/** Eine vorhandene Buchung (Rechnung bezahlt, Beleg, von Hand) bzw. die neue Rechnungs-/Belegbuchung. */
export interface GebuchteZahlung { datum: string; cent: number; name: string; nummer?: string }

/**
 * Wie sicher ist es dieselbe Geldbewegung? 0 = Rechnungsnummer im Verwendungszweck, 1 = Name passt, null = nicht dieselbe. (Ort prüft der Aufrufer.)
 */
export function trefferStufe(bank: BankUmsatz, b: GebuchteZahlung): 0 | 1 | null {
  if (!Number.isSafeInteger(bank.cent) || bank.cent === 0 || bank.cent !== b.cent) return null;
  if (tageAbstand(bank.datum, b.datum) > ABGLEICH_TAGE) return null;
  if (b.nummer && nummerImText(b.nummer, `${bank.zweck} ${bank.gegenpartei}`)) return 0;
  return namenPassen(bank.gegenpartei, b.name) || (!bank.gegenpartei && namenPassen(bank.zweck, b.name)) ? 1 : null;
}
/** Ist das dieselbe Geldbewegung? */
export const gleicheZahlung = (bank: BankUmsatz, b: GebuchteZahlung): boolean => trefferStufe(bank, b) !== null;

/** Bester Treffer: erst die Rechnungsnummer, dann der Name; bei gleicher Stufe zeitlich am nächsten, dann der zuerst genannte. */
function bester<T>(liste: readonly T[], paar: (t: T) => [BankUmsatz, GebuchteZahlung], hoechsteStufe: 0 | 1): T | undefined {
  let best: T | undefined, rang = Infinity;
  for (const t of liste) {
    const [bank, z] = paar(t);
    const stufe = trefferStufe(bank, z);
    if (stufe === null || stufe > hoechsteStufe) continue;
    const r = stufe * 1000 + tageAbstand(bank.datum, z.datum);
    if (r < rang) { best = t; rang = r; }
  }
  return best;
}

/**
 * Zu einem Bank-Umsatz die beste passende Buchung (Kontoauszug nach Rechnung/Beleg). `hoechsteStufe` 0 = nur über die Rechnungsnummer — so
 * vergibt der Kontoauszug zuerst alle sicheren Paare und erst danach die über den Namen (ein Umsatz ohne Nummer nimmt keinem mit Nummer die Rechnung weg).
 */
export function naechsteZahlung<T>(bank: BankUmsatz, kandidaten: readonly T[], als: (t: T) => GebuchteZahlung, hoechsteStufe: 0 | 1 = 1): T | undefined {
  return bester(kandidaten, t => [bank, als(t)], hoechsteStufe);
}

/** Umgekehrt: zu einer neuen Rechnungs-/Belegbuchung der beste passende Bank-Umsatz (Rechnung/Beleg nach dem Kontoauszug). */
export function naechsterUmsatz<T>(z: GebuchteZahlung, umsaetze: readonly T[], als: (t: T) => BankUmsatz): T | undefined {
  return bester(umsaetze, u => [als(u), z], 1);
}

/** Cent aus einem Euro-Betrag der Buchungen (auf den Cent). */
export const centAus = (euro: unknown): number => Math.round(Number(euro) * 100);
