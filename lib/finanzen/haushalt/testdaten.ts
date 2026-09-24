// ─── Erfundener Test-Haushalt ───────────────────────────────────────────────
// Nur für den Haushalt „test“: damit Oberfläche und Bildschirmfotos geprüft
// werden können, ohne dass je ein echter Betrag im Bild steht. Alle Namen und
// Beträge sind ausgedacht und als Beispiel erkennbar.

import type { Beleg, Buchung, Haushalt, Kategorie, Konto, Planwert, Regel, Schuld } from './typen';
import { vollMonate, heuteBerlin, monatVon, tagPlus } from './monat';
import { fingerabdruck } from './import';

/** Malins Kategorien (Schema + Einnahme-Arten + was die alten Daten brauchten). */
export const START_KATEGORIEN: [string, Kategorie['typ'], number][] = [
  ['Gehalt', 'einnahme', 11], ['Entnahme Kevin (Selbstständigkeit)', 'einnahme', 12], ['Aktien & Krypto', 'einnahme', 13],
  ['Kredit erhalten', 'einnahme', 14], ['Erstattung / Retoure', 'einnahme', 15], ['Geschenk & Familie', 'einnahme', 16],
  ['Sonstige Einnahme', 'einnahme', 17], ['Mieteinnahme', 'einnahme', 18], ['Kindergeld & Sozialleistung', 'einnahme', 19],
  ['Zinsen', 'einnahme', 20], ['Bonus & Prämie', 'einnahme', 21], ['Verkauf privat', 'einnahme', 22], ['Steuererstattung', 'einnahme', 23],
  ['Rücküberweisung / Auslage', 'einnahme', 30],
  ['Miete & Wohnen', 'ausgabe', 20], ['Lebensmittel', 'ausgabe', 30], ['Essen auswärts', 'ausgabe', 35], ['Gesundheit', 'ausgabe', 40],
  ['Mobilität', 'ausgabe', 50], ['Versicherungen', 'ausgabe', 60], ['Abos & Verträge', 'ausgabe', 70], ['Haushalt', 'ausgabe', 80],
  ['Freizeit', 'ausgabe', 90], ['Shopping', 'ausgabe', 95], ['Sport', 'ausgabe', 100], ['Bildung', 'ausgabe', 110],
  ['Steuern', 'ausgabe', 120], ['Tilgung', 'ausgabe', 130], ['Sparen', 'ausgabe', 140], ['Umbuchung', 'umbuchung', 150], ['Sonstiges', 'ausgabe', 900],
];

/** Kleiner, fester Zufall — gleiche Daten bei jedem Aufruf. */
function zufall(saat: number) { let x = saat; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; }

export function testHaushalt(heute: string = heuteBerlin()): Haushalt {
  const jetzt = new Date().toISOString();
  const konten: Konto[] = [
    { id: 'test-konto-a', stand: 1, name: 'Testkonto Kevin (Beispiel)', inhaber: 'Kevin', einheit: 'privat', iban_suffix: '0001', bank: 'Beispielbank', waehrung: 'EUR', aktiv: true },
    { id: 'test-konto-b', stand: 1, name: 'Testkonto Malin (Beispiel)', inhaber: 'Malin', einheit: 'privat', iban_suffix: '0002', bank: 'Beispielbank', waehrung: 'EUR', aktiv: true },
    { id: 'test-konto-g', stand: 1, name: 'Gemeinsames Testkonto', inhaber: 'gemeinsam', einheit: 'privat', iban_suffix: '0003', bank: 'Beispielbank', waehrung: 'EUR', aktiv: true },
  ];
  const kategorien: Kategorie[] = START_KATEGORIEN.map(([name, typ, sortierung], i) => ({ id: `test-kat-${i}`, stand: 1, name, typ, sortierung, monatsbudget: name === 'Lebensmittel' ? 60000 : name === 'Essen auswärts' ? 20000 : null }));
  const k = (name: string) => kategorien.find(x => x.name === name)!.id;
  const r = zufall(42);
  const buchungen: Buchung[] = [];
  let n = 0;
  const add = (konto: string, datum: string, betrag: number, empfaenger: string, kat: string | null, extra: Partial<Buchung> = {}) => {
    n++;
    buchungen.push({ id: `test-b-${n}`, stand: 1, konto_id: konto, datum, betrag, beschreibung: empfaenger, empfaenger, kategorie_id: kat ? k(kat) : null, ist_umbuchung: false, ist_fixkosten: false, turnus: 'monatlich', einheit: 'privat', zeilen_hash: fingerabdruck(konto, datum, betrag, empfaenger), notiz: null, import_id: 'testdaten', erfasst_von: null, geaendert: jetzt, ...extra });
  };
  const monate = vollMonate(8, 0, heute).reverse();
  monate.push(monatVon(heute));
  monate.forEach((m, i) => {
    const laufend = m === monatVon(heute);
    const tag = (t: number) => `${m}-${String(t).padStart(2, '0')}`;
    if (laufend && Number(heute.slice(8, 10)) < 2) return;
    add('test-konto-b', tag(1), 280000, 'Beispiel GmbH Gehalt', 'Gehalt');
    add('test-konto-a', tag(2), 150000, 'Entnahme Beispiel-Selbstständigkeit', 'Entnahme Kevin (Selbstständigkeit)');
    add('test-konto-g', tag(3), -125000, 'Vermieter Beispiel', 'Miete & Wohnen', { ist_fixkosten: true });
    add('test-konto-g', tag(4), -8500, 'Stadtwerke Beispiel', 'Miete & Wohnen', { ist_fixkosten: true });
    add('test-konto-a', tag(5), -3999, 'Mobilfunk Beispiel', 'Abos & Verträge', { ist_fixkosten: true });
    add('test-konto-g', tag(6), -1799, 'Streaming Beispiel', 'Abos & Verträge', { ist_fixkosten: true });
    add('test-konto-a', tag(7), -15000, 'Ratenkredit Beispielbank', 'Tilgung', { ist_fixkosten: true });
    add('test-konto-g', tag(8), -20000, 'Auf Sparziel', null, { ist_umbuchung: true });
    if (i % 3 === 0) add('test-konto-g', tag(9), -30000, 'Hausratversicherung Beispiel', 'Versicherungen', { ist_fixkosten: true, turnus: 'quartal' });
    const tage = laufend ? Math.min(20, Number(heute.slice(8, 10))) : 26;
    for (let t = 10; t <= tage; t += 2) {
      add(r() < 0.5 ? 'test-konto-g' : 'test-konto-b', tag(t), -Math.round(1800 + r() * 9000), r() < 0.5 ? 'Supermarkt Beispiel' : 'Biomarkt Beispiel', 'Lebensmittel');
      if (r() < 0.45) add('test-konto-a', tag(t + 1), -Math.round(1500 + r() * 6000), r() < 0.5 ? 'Restaurant Beispiel' : 'Lieferdienst Beispiel', 'Essen auswärts');
      if (r() < 0.2) add('test-konto-b', tag(t + 1), -Math.round(900 + r() * 4000), 'Apotheke Beispiel', 'Gesundheit');
      if (r() < 0.15) add('test-konto-a', tag(t), -Math.round(2000 + r() * 12000), 'Onlineshop Beispiel', r() < 0.7 ? 'Shopping' : null);
    }
    if (i === 2) { add('test-konto-a', tag(12), 300000, 'Beispielbank Kredit', 'Kredit erhalten'); add('test-konto-b', tag(14), 4500, 'Rückzahlung Kevin Beispiel', 'Rücküberweisung / Auslage'); }
    if (i === 4) add('test-konto-a', tag(20), -24000, 'Jahresbeitrag Verein Beispiel', 'Sport', { ist_fixkosten: true, turnus: 'jahr' });
    if (i === 5) add('test-konto-b', tag(15), 12000, 'Finanzamt Beispiel', 'Steuererstattung');
  });
  const regeln: Regel[] = [
    { id: 'test-r-1', stand: 1, muster: 'Vermieter Beispiel', empfaenger: 'Vermieter Beispiel', kategorie_id: k('Miete & Wohnen'), ist_umbuchung: false, ist_fixkosten: true, turnus: 'monatlich', ganzes_wort: true, prioritaet: 100, treffer_zaehler: 8 },
    { id: 'test-r-2', stand: 1, muster: 'Supermarkt Beispiel', empfaenger: 'Supermarkt Beispiel', kategorie_id: k('Lebensmittel'), ist_umbuchung: false, ist_fixkosten: false, turnus: 'monatlich', ganzes_wort: true, prioritaet: 100, treffer_zaehler: 30 },
  ];
  const kreditBuchung = buchungen.find(b => b.empfaenger === 'Beispielbank Kredit');
  const schulden: Schuld[] = [
    { id: 'test-s-1', stand: 1, bezeichnung: 'Ratenkredit Beispiel', glaeubiger: 'Beispielbank', einheit: 'privat', startbetrag: 600000, restbetrag: 420000, rate: 15000, zinssatz: 5.9, rhythmus: 'monatlich', naechste_faelligkeit: tagPlus(heute, 6), endet_am: null, notiz: null, aus_buchung_id: null },
    { id: 'test-s-2', stand: 1, bezeichnung: 'Kredit Beispielbank', glaeubiger: 'Beispielbank', einheit: 'privat', startbetrag: 300000, restbetrag: 300000, rate: null, zinssatz: null, rhythmus: 'monatlich', naechste_faelligkeit: null, endet_am: null, notiz: 'Automatisch aus der Einnahme angelegt.', aus_buchung_id: kreditBuchung?.id ?? null },
  ];
  const belege: Beleg[] = [
    { id: 'test-bl-1', stand: 1, art: 'rechnung', bezeichnung: 'Nebenkostenabrechnung Beispiel', empfaenger: 'Hausverwaltung Beispiel', betrag: 18400, faellig_am: tagPlus(heute, 5), verursacher: 'Malin', einheit: 'privat', erledigt: false, bezahlt_am: null, notiz: null, buchung_id: null },
    { id: 'test-bl-2', stand: 1, art: 'rechnung', bezeichnung: 'Handwerker Beispiel', empfaenger: 'Handwerk Beispiel', betrag: 26000, faellig_am: tagPlus(heute, -3), verursacher: 'Kevin', einheit: 'privat', erledigt: false, bezahlt_am: null, notiz: null, buchung_id: null },
    { id: 'test-bl-3', stand: 1, art: 'beleg', bezeichnung: 'Quittung Hotel Beispielstadt', empfaenger: null, betrag: null, faellig_am: tagPlus(heute, 10), verursacher: 'Kevin', einheit: 'selbststaendigkeit', erledigt: false, bezahlt_am: null, notiz: null, buchung_id: null },
  ];
  const m = monatVon(heute);
  const planwerte: Planwert[] = [
    { id: 'test-p-1', stand: 1, einheit: 'privat', jahr: Number(m.slice(0, 4)), monat: Number(m.slice(5, 7)), posten: 'Ausgaben', sollwert: 280000, notiz: null },
    { id: 'test-p-2', stand: 1, einheit: 'privat', jahr: Number(m.slice(0, 4)), monat: Number(m.slice(5, 7)), posten: 'Sparrate', sollwert: 30000, notiz: null },
  ];
  return { stamm: { konten, kategorien, regeln, aliase: {} }, buchungen, schulden, belege, planwerte };
}
