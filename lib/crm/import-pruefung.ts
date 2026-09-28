// ─── CRM — Import-Vorschau prüft die Datei (28.09., K2 #21–#23, #10) ────────
// Excel verstümmelt beim Öffnen und Wiederspeichern still: lange Ziffernfolgen
// werden „1,23E+11“ (HubSpot-ID, Telefon), Postleitzahlen verlieren die
// führende Null („01067“ → „1067“), und ein Semikolon im Text ohne
// Anführungszeichen verschiebt alle Spalten der Zeile. Nichts davon darf still
// in die Kartei. Die Vorschau meldet es je Zeile; ein deutsches Datum wird zu
// ISO, ein unlesbares verworfen (`datumAusListe`) — und hier gemeldet.
// Rein, getestet (tests/crm-k2-import.test.ts).

import { datumAusListe } from '@/lib/make-one/crm';
import type { CsvBefund } from '@/lib/make-one/csv';

export type WarnArt = 'spalten' | 'excel_zahl' | 'plz_null' | 'datum';
export interface ImportWarnung { art: WarnArt; zeile: number; spalte?: string; text: string }
export interface ImportPruefung { warnungen: ImportWarnung[]; zaehler: Record<WarnArt, number> }

/** Höchstens so viele Warnungen gehen in die Antwort (die Zähler zählen alle). */
export const WARNUNGEN_MAX = 60;

const EXCEL_ZAHL = /\dE\+\d/i;
const PLZ_SPALTE = /(^|_)(PLZ|POSTLEITZAHL|ZIP|POSTCODE)($|_)/i;
/** Spalten mit Datum: LETZTER_KONTAKT (liest der Import) und alles mit DATUM im Namen. */
const DATUM_SPALTE = /^LETZTER_KONTAKT$|DATUM/i;

export function importPruefen(b: Pick<CsvBefund, 'kopf' | 'zeilen' | 'spalten' | 'zeileNr'>): ImportPruefung {
  const warnungen: ImportWarnung[] = [];
  const zaehler: Record<WarnArt, number> = { spalten: 0, excel_zahl: 0, plz_null: 0, datum: 0 };
  const melde = (w: ImportWarnung) => { zaehler[w.art]++; if (warnungen.length < WARNUNGEN_MAX) warnungen.push(w); };
  b.zeilen.forEach((z, i) => {
    const zeile = b.zeileNr[i] ?? i + 2;
    const n = b.spalten[i] ?? b.kopf.length;
    if (n !== b.kopf.length) melde({ art: 'spalten', zeile, text: `${n} statt ${b.kopf.length} Spalten — Zeile verrutscht (Semikolon im Text?)` });
    for (const spalte of b.kopf) {
      const v = z[spalte] ?? '';
      if (!v) continue;
      if (EXCEL_ZAHL.test(v)) melde({ art: 'excel_zahl', zeile, spalte, text: `„${v.slice(0, 24)}“ sieht nach Excel-Kurzform aus (Ziffern verloren)` });
      if (PLZ_SPALTE.test(spalte) && /^\d{4}$/.test(v)) melde({ art: 'plz_null', zeile, spalte, text: `Postleitzahl „${v}“ hat nur vier Stellen — führende Null verloren?` });
      if (DATUM_SPALTE.test(spalte) && datumAusListe(v).unlesbar) melde({ art: 'datum', zeile, spalte, text: `Datum „${v.slice(0, 24)}“ unlesbar — wird verworfen` });
    }
  });
  return { warnungen, zaehler };
}
