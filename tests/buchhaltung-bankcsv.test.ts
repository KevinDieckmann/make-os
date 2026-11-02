// ─── Buchhaltung — CSV-Statement-Export (02.11.): Kopf, Datum TT-MM-JJJJ, Punkt-Beträge, Art des Umsatzes, Rückbuchungs-Paare; leere Unterkonten,
// Belegliste und Zinskonto ohne Zeilen als klare Auskunft (kein Fehler, nichts gelesen). Alle IBANs/Namen/Beträge erfunden.
import { describe, it, expect } from 'vitest';
import { auszugLesen } from '@/lib/finanzen/kontoauszug/lesen';
import { BELEGLISTE_TEXT, LEER_TEXT } from '@/lib/finanzen/kontoauszug/csv';
import type { LeseErgebnis } from '@/lib/finanzen/kontoauszug/typen';
import { testIban, utf8 } from './fixtures/kontoauszug';

const EIGEN = testIban('10010010', '111111111');
const FREMD = testIban('37040044', '222222222');
const KOPF = 'Completed date;Counterparty name;Counterparty IBAN;Counterparty BIC;Transaction type;Reference;Original amount;Original currency;Payment amount;Payment currency;Conversion rate;Account IBAN;Card;Running balance amount;Running balance currency';
const zeile = (d: string, wer: string, art: string, ref: string, betrag: string, saldo: string) =>
  `${d};${wer};${FREMD};TESTDEFFXXX;${art};${ref};${betrag};EUR;${betrag};EUR;1;${EIGEN};;${saldo};EUR`;
const ok = (l: LeseErgebnis) => { expect(l.ok, JSON.stringify(l).slice(0, 300)).toBe(true); return l as Extract<LeseErgebnis, { ok: true }>; };

describe('CSV-Statement-Export', () => {
  it('liest Datum, Betrag mit Punkt, eigenes Konto und markiert Rückbuchung + Fehlversuch als Storno', () => {
    const csv = [KOPF,
      zeile('01-10-2026', 'Beispiel Software GmbH', 'CARD', 'Abo Oktober', '-23.80', '976.20'),
      zeile('03-10-2026', 'Muster Kunde AG', 'INCOMING_TRANSFER', 'RE-0001', '1190.00', '2166.20'),
      zeile('05-10-2026', 'Erika Beispiel', 'OUTGOING_TRANSFER', 'Honorar', '-500.00', '1666.20'),
      zeile('06-10-2026', 'Erika Beispiel', 'OUTGOING_TRANSFER_REFUND', 'Honorar', '500.00', '2166.20'),
      zeile('07-10-2026', 'Bank Beispiel', 'FEE', 'Gebühr', '-1.50', '2164.70'),
    ].join('\n');
    const l = ok(auszugLesen(utf8(csv)));
    expect(l.format === 'csv' && l.csv.bank).toBe('Business-Konto (Statement-Export)');
    const a = l.auszuege[0];
    expect(a.iban).toBe(EIGEN);
    expect(a.eintraege.map(e => [e.datum, e.cent])).toEqual([['2026-10-01', -2380], ['2026-10-03', 119000], ['2026-10-05', -50000], ['2026-10-06', 50000], ['2026-10-07', -150]]);
    expect(a.eintraege.filter(e => e.storno).map(e => e.datum)).toEqual(['2026-10-05', '2026-10-06']);
    expect(a.pruefung?.stimmt).toBe(true);
  });

  it('leeres Unterkonto (nur Kopfzeile) → Auskunft „keine Umsätze“, keine Spaltenmaske', () => {
    const l = auszugLesen(utf8(`${KOPF}\n`));
    expect(l.ok).toBe(false);
    if (l.ok) return;
    expect(l.hinweis).toBe('leer');
    expect(l.fehler).toBe(LEER_TEXT);
    expect(l.csv).toBeUndefined();
  });

  it('Belegliste der Bank („Business documents“) → Hinweis auf den Statement-Export', () => {
    const l = auszugLesen(utf8('Internal operation id,Document name,Transaction type,Account IBAN,Amount,Currency\nop-1,beleg-erfunden.pdf,CARD,' + EIGEN + ',-23.80,EUR\n'));
    expect(l.ok).toBe(false);
    if (l.ok) return;
    expect(l.hinweis).toBe('belegliste');
    expect(l.fehler).toBe(BELEGLISTE_TEXT);
  });

  it('Zinskonto-Auszug mit Vorspann und ohne Zeilen → wie leeres Unterkonto', () => {
    const l = auszugLesen(utf8(`Zinskontoauszug\nKonto;${EIGEN}\n\nBuchungsdatum;Name der Gegenpartei;Verwendungszweck;Betrag;Saldo\n`));
    expect(l.ok).toBe(false);
    if (l.ok) return;
    expect(l.hinweis).toBe('leer');
  });

  it('eine Datei ohne erkennbaren Kopf bleibt beim bisherigen Weg (Spalten zuordnen)', () => {
    const l = auszugLesen(utf8('a;b;c\n1;2;3\n'));
    expect(l.ok).toBe(false);
    if (l.ok) return;
    expect(l.hinweis).toBeUndefined();
  });
});
