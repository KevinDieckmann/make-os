// Erfundene Belege für die Gold-Prüfungen der kleinen Bauten (25.10.) — tests/kleine-bauten-gold.test.ts, tests/kleine-bauten.test.ts.
import { angebotDokument, type AngebotDokument } from '@/lib/crm/angebot-dokument';
import { rechnungDokument } from '@/lib/finanzen/rechnung/dokument';
import type { Angebot, AngebotAbsender } from '@/lib/crm/typen';
import type { Rechnung } from '@/lib/finanzen/finanzplan-bestand';

export const GOLD_ABSENDER: AngebotAbsender = {
  firmierung: 'Beispiel Werkstatt GmbH', zeilen: ['Musterweg 1', '12345 Musterstadt'], kontakt: ['Tel. 0000 000', 'hallo@example.invalid'],
  fuss: ['Beispiel Werkstatt GmbH · Musterweg 1 · 12345 Musterstadt', 'Geschäftsführung: Erika Muster · Amtsgericht Musterstadt HRB 0000', 'USt-IdNr. DE000000000', 'Beispielbank · IBAN DE00 0000 0000 0000 0000 00'],
  kleinunternehmer: false,
};
export const GOLD_ANGEBOT: Angebot = {
  id: 'ang-gold-1', nummer: 'BW-A-2026-0007', lauf: { jahr: 2026, nr: 7 }, gesellschaft: 'ug', kontaktId: 'c-gold-0001', firmaId: 'f-gold',
  titel: 'Beispielkunde · Begleitung', einleitung: 'Guten Tag Max Muster,\n\nhier unser Angebot.', schluss: 'Mit freundlichen Grüßen',
  positionen: [
    { id: 'p-1', leistungId: 'l-gold', preisTeilId: 'pt-1', titel: 'Begleitung', text: 'Leistungstext über mehrere Wörter, damit er umbricht und die Zeilen im PDF zählen.', menge: 1, einheit: 'Monat', einzelpreisCent: 250000, ustSatz: 19, basis: 'monat', laufzeitMonate: 6 },
    { id: 'p-1-2', leistungId: 'l-gold', preisTeilId: 'pt-2', titel: 'Begleitung · Festpreis', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 90000, rabattProzent: 10, ustSatz: 19, basis: 'einmalig' },
  ],
  gueltigBis: '2026-11-30', zahlungszielTage: 14, status: 'gestellt', version: 1, angelegt: '2026-10-20T10:00:00.000Z', geaendert: '2026-10-20T10:00:00.000Z',
};
export const GOLD_RECHNUNG: Rechnung = {
  id: 'r-gold-1', firmaId: 'ug', kunde: 'Beispielkunde GmbH', titel: 'Begleitung — Oktober 2026', betrag: 2975, status: 'gestellt', nummer: 'BW-R-2026-0003', datum: '2026-10-20',
  faellig: '2026-11-03', netto: 2500, ustSatz: 19, leistungVon: '2026-10-01', leistungBis: '2026-10-31',
  positionen: [{ id: 'p1', leistungId: 'l-gold', titel: 'Begleitung — Oktober 2026', text: '• Leistung eins\n• Leistung zwei', menge: 1, einheit: 'Monat', einzelpreisCent: 250000, ustSatz: 19 }],
  empfaenger: { firma: 'Beispielkunde GmbH', name: 'Max Muster', strasse: 'Kundenweg 2', plz: '54321', ort: 'Kundenstadt', referenz: 'PO-1' },
  zahlungszielTage: 14, einleitung: 'vielen Dank für Ihren Auftrag.', schluss: 'Mit freundlichen Grüßen',
} as Rechnung;

export const goldDokumente = (): Record<string, AngebotDokument> => ({
  angebot: angebotDokument(GOLD_ANGEBOT, GOLD_ABSENDER, { name: 'Max Muster', firma: 'Beispielkunde GmbH', zeilen: ['Beispielkunde GmbH', 'z. Hd. Max Muster', 'Kundenstadt'] }, '2026-10-20'),
  rechnung: rechnungDokument(GOLD_RECHNUNG, GOLD_ABSENDER, { datum: '2026-10-20', bank: 'IBAN DE00 0000 0000 0000 0000 00' }),
  storno: rechnungDokument({ ...GOLD_RECHNUNG, id: 'r-gold-2', nummer: 'BW-R-2026-0004', art: 'storno', stornoZu: 'r-gold-1', status: 'storniert' } as Rechnung, GOLD_ABSENDER, { datum: '2026-10-21', original: { nummer: 'BW-R-2026-0003', datum: '2026-10-20' } }),
});
