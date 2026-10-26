// Angebots-Tool 26.10. (Kevin): Platzhalter sauber gefüllt, Zahlungsweise (Raten · Anzahlung · eigener Text), Standardtext, Lücken-Hinweis.
import { describe, expect, it } from 'vitest';
import type { Angebot, AngebotPosition, Leistung } from '@/lib/crm/typen';
import {
  angebotTitelAus, angebotTitelAutomatisch, angebotPlatzhalterFuellen, angebotPlatzhalterWerte, angebotStandardtext, angebotLuecken, entwurfSaeubern,
  ratenCent, zahlweiseSaeubern, zahlweiseText, zahlweisePruefen, zahlweiseProblem, stellenFehlt,
} from '@/lib/crm/angebote';
import { angebotDokument } from '@/lib/crm/angebot-dokument';

/** Intl schreibt ein geschütztes Leerzeichen vor „€“. */
const n = (t: string | null) => t?.replace(/\u00a0/g, ' ') ?? null;

const pos = (o: Partial<AngebotPosition> = {}): AngebotPosition => ({ id: 'p-1', titel: 'Landing für {{firma.name}}', text: 'Wir bauen für {{firma.name}} eine Seite.', menge: 1, einheit: 'pauschal', einzelpreisCent: 299_000, ustSatz: 19, basis: 'einmalig', ...o });
const produkt = { id: 'l-1', name: 'Landing', rolle: 'haupt', angebot: { titel: 'Landing für {{firma.name}}' } } as unknown as Leistung;

describe('Platzhalter', () => {
  it('Titel aus einem Produkt mit {{firma.name}}: Firma eingesetzt, nicht doppelt davor', () => {
    const p = pos({ leistungId: 'l-1' });
    expect(angebotTitelAus({ positionen: [p] }, [produkt], 'Beispiel GmbH')).toBe('Landing für Beispiel GmbH');
    // Ohne Firma bleibt der Platzhalter, bis sie gewählt ist.
    expect(angebotTitelAus({ positionen: [p] }, [produkt], null)).toBe('Landing für {{firma.name}}');
    // Ein so entstandener Titel gilt weiter als automatisch.
    expect(angebotTitelAutomatisch('Landing für Beispiel GmbH', { firma: 'Beispiel GmbH', leistungen: [produkt], positionen: [p] })).toBe(true);
  });
  it('füllt Positionen, Titel und Texte; unbekannte Werte bleiben stehen', () => {
    const a = { titel: 'Angebot {{angebot.nummer}}', positionen: [pos()], einleitung: '{{kontakt.gruss}}, für {{firma.name}}', schluss: 'Bis {{angebot.gueltigBis}}' };
    const w = angebotPlatzhalterWerte({ anrede: 'Sie', vorname: 'Erika', nachname: 'Muster', firma: 'Beispiel GmbH', titel: '', gueltigBis: '2026-11-25' });
    const r = angebotPlatzhalterFuellen(a, w);
    expect(r.positionen[0].titel).toBe('Landing für Beispiel GmbH');
    expect(r.positionen[0].text).toBe('Wir bauen für Beispiel GmbH eine Seite.');
    expect(r.einleitung).toBe('Guten Tag Erika Muster, für Beispiel GmbH');
    expect(r.schluss).toBe('Bis 25.11.2026');
    expect(r.titel).toBe('Angebot {{angebot.nummer}}'); // Nummer gibt es erst beim Stellen
    // Nichts zu tun → dasselbe Objekt (kein Speichern ausgelöst).
    const fertig = angebotPlatzhalterFuellen(r, {});
    expect(fertig).toBe(r);
    const leer = { titel: 'Titel mit Leerzeichen ', positionen: [pos({ titel: 'x', text: '' })], einleitung: '', schluss: '' };
    expect(angebotPlatzhalterFuellen(leer, w)).toBe(leer); // tippt jemand, wird nichts getrimmt
  });
  it('Lücken: [von Hand: …] und rohe Platzhalter werden gemeldet', () => {
    expect(angebotLuecken({ titel: 'ok', positionen: [pos({ titel: 'a', text: 'b' })], einleitung: 'Ziel [von Hand: Ziel]', schluss: '' })).toEqual(['Einleitung']);
    expect(angebotLuecken({ titel: 'ok', positionen: [pos()], einleitung: '', schluss: '' })).toEqual(['Position 1']);
    expect(angebotLuecken({ titel: 'ok', positionen: [pos({ titel: 'a', text: 'b' })], einleitung: 'x', schluss: 'y' })).toEqual([]);
  });
});

describe('Standardtext', () => {
  it('immer Sie, unverbindliches Angebot', () => {
    const t = angebotStandardtext({ vorname: 'Erika', nachname: 'Muster', gueltigBis: '2026-11-25' });
    expect(t.einleitung).toBe('Guten Tag Erika Muster,\n\nvielen Dank für Ihr Interesse an unseren Produkten. Hiermit unterbreiten wir Ihnen ein unverbindliches Angebot.');
    expect(t.schluss).toContain('25.11.2026');
    expect(t.schluss).toContain('Mit freundlichen Grüßen');
  });
});

describe('Zahlungsweise', () => {
  it('Raten auf den Cent, Rest auf die letzte', () => {
    expect(ratenCent(100_000, 3)).toEqual([33_333, 33_333, 33_334]);
    expect(ratenCent(299_000, 2)).toEqual([149_500, 149_500]);
  });
  it('Satz für das PDF: Raten, Anzahlung, eigener Text; Kleinunternehmer netto', () => {
    const a = { positionen: [pos()] };
    expect(n(zahlweiseText({ ...a, zahlweise: { art: 'raten', anzahl: 2, abstandMonate: 1 } }, { kleinunternehmer: true }))).toBe('Zahlung des einmaligen Betrags in 2 Raten (monatlich): je 1.495,00 €, die erste bei Auftrag.');
    expect(n(zahlweiseText({ ...a, zahlweise: { art: 'raten', anzahl: 3, abstandMonate: 2 } }, { kleinunternehmer: true }))).toBe('Zahlung des einmaligen Betrags in 3 Raten (alle 2 Monate): 996,67 € bei Auftrag, 996,67 € nach 2 Monaten, 996,66 € nach 4 Monaten.');
    expect(n(zahlweiseText({ ...a, zahlweise: { art: 'anzahlung', prozent: 50, rest: 'bei Abnahme' } }))).toBe('Zahlung des einmaligen Betrags (inkl. USt): 50 % Anzahlung (1.779,05 €) bei Auftrag, Rest (1.779,05 €) bei Abnahme.');
    expect(n(zahlweiseText({ ...a, zahlweise: { art: 'frei', text: '50 % bei Auftrag, 50 % nach Go-live' } }))).toBe('Zahlung: 50 % bei Auftrag, 50 % nach Go-live.');
    expect(n(zahlweiseText(a))).toBeNull();
    // Ohne einmaligen Betrag: Raten gelten nicht.
    expect(n(zahlweiseText({ positionen: [pos({ basis: 'monat' })], zahlweise: { art: 'raten', anzahl: 2, abstandMonate: 1 } }))).toBeNull();
  });
  it('prüfen: 2–12 Raten, 1–12 Monate, 1–99 %, Text nötig — jede Zahl dazwischen geht, alles andere mit Satz', () => {
    for (let n = 2; n <= 12; n++) expect(zahlweisePruefen({ art: 'raten', anzahl: String(n), abstandMonate: '1' })).toBeNull();
    for (const n of ['', '0', '1', '13', '24', '26', '2.5', 'x']) expect(zahlweisePruefen({ art: 'raten', anzahl: n, abstandMonate: '1' })).toMatch(/2 bis 12/);
    expect(zahlweisePruefen({ art: 'raten', anzahl: 6, abstandMonate: 0 })).toMatch(/1 bis 12 Monate/);
    expect(zahlweisePruefen({ art: 'raten', anzahl: 6, abstandMonate: 12 })).toBeNull();
    expect(zahlweisePruefen({ art: 'anzahlung', prozent: '30', rest: '' })).toBeNull();
    expect(zahlweisePruefen({ art: 'anzahlung', prozent: '100', rest: '' })).toMatch(/1 bis 99/);
    expect(zahlweisePruefen({ art: 'frei', text: '  ' })).toMatch(/bitte etwas eintragen/);
    expect(zahlweisePruefen(null)).toBeNull();
    expect(zahlweisePruefen({ art: 'kredit' })).toMatch(/unbekannte/);
  });
  it('Raten ohne einmaligen Betrag: Problem, Stellen gesperrt; Anzahlung ohne „Rest“ = bei Abnahme', () => {
    const monat = { positionen: [pos({ basis: 'monat' })], zahlweise: { art: 'raten' as const, anzahl: 6, abstandMonate: 1 } };
    expect(zahlweiseProblem(monat)).toMatch(/einmaligen Betrag/);
    expect(zahlweiseProblem({ ...monat, zahlweise: { art: 'frei', text: 'monatlich' } })).toBeNull();
    const a = { id: 'ang-x', gesellschaft: 'kdc', kontaktId: 'c-x', titel: 'T', einleitung: '', schluss: '', gueltigBis: '2099-01-01', zahlungszielTage: 14, status: 'entwurf', version: 1, angelegt: '', geaendert: '' } as unknown as Angebot;
    expect(stellenFehlt({ ...a, ...monat }, '2026-10-26').join(' ')).toMatch(/einmaligen Betrag/);
    expect(stellenFehlt({ ...a, positionen: [pos()], zahlweise: { art: 'raten', anzahl: 6, abstandMonate: 1 } }, '2026-10-26')).toEqual([]);
    expect(n(zahlweiseText({ positionen: [pos()], zahlweise: { art: 'anzahlung', prozent: 30, rest: '' } }, { kleinunternehmer: true }))).toBe('Zahlung des einmaligen Betrags: 30 % Anzahlung (897,00 €) bei Auftrag, Rest (2.093,00 €) bei Abnahme.');
    expect(n(zahlweiseText({ positionen: [pos()], zahlweise: { art: 'raten', anzahl: 6, abstandMonate: 1 } }, { kleinunternehmer: true }))).toBe('Zahlung des einmaligen Betrags in 6 Raten (monatlich): 498,33 € bei Auftrag, 498,33 € nach 1 Monat, 498,33 € nach 2 Monaten, 498,33 € nach 3 Monaten, 498,33 € nach 4 Monaten, 498,35 € nach 5 Monaten.');
  });
  it('säubern: Grenzen, unbrauchbar → keine', () => {
    expect(zahlweiseSaeubern({ art: 'raten', anzahl: 30, abstandMonate: 1 })).toBeUndefined();
    expect(zahlweiseSaeubern({ art: 'raten', anzahl: '4' })).toEqual({ art: 'raten', anzahl: 4, abstandMonate: 1 });
    expect(zahlweiseSaeubern({ art: 'anzahlung', prozent: 30 })).toEqual({ art: 'anzahlung', prozent: 30, rest: 'bei Abnahme' });
    expect(zahlweiseSaeubern({ art: 'frei', text: '  ' })).toBeUndefined();
    expect(zahlweiseSaeubern({ art: 'kredit' })).toBeUndefined();
  });
  it('Entwurf speichert sie, null nimmt sie weg; im Dokument steht der Satz', () => {
    const basis = { id: 'ang-x', jetzt: '2026-10-26T10:00:00Z', person: 'p', heute: '2026-10-26' };
    const a = entwurfSaeubern({ gesellschaft: 'kdc', titel: 'T', positionen: [pos()], zahlweise: { art: 'raten', anzahl: 2, abstandMonate: 1 } }, null, basis);
    expect(a.zahlweise).toEqual({ art: 'raten', anzahl: 2, abstandMonate: 1 });
    expect(entwurfSaeubern({ zahlweise: null }, a, basis).zahlweise).toBeUndefined();
    expect(entwurfSaeubern({ titel: 'U' }, a, basis).zahlweise).toEqual(a.zahlweise);
    const absender = { firmierung: 'Muster', zeilen: [], kontakt: [], fuss: [], kleinunternehmer: true };
    const d = angebotDokument(a as Angebot, absender, { name: 'X', zeilen: ['X'] }, '2026-10-26');
    expect(d.hinweise.map(n)).toContain('Zahlung des einmaligen Betrags in 2 Raten (monatlich): je 1.495,00 €, die erste bei Auftrag.');
    const ohne = angebotDokument({ ...a, zahlweise: undefined } as Angebot, absender, { name: 'X', zeilen: ['X'] }, '2026-10-26');
    expect(ohne.hinweise.some(h => h.startsWith('Zahlung des'))).toBe(false);
  });
});
