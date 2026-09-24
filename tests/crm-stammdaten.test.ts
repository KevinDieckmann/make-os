// CRM-Stammdaten: Firmen-Abgleich, Kennzahlen, Datenqualität.
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import { firmenAbgleich, firmenSchluessel, domainVon, firmenDubletten, rolleAus } from '../lib/crm/firmen';
import { kennzahlen, vollstaendigkeit, speicherbegrenzung } from '../lib/crm/kennzahlen';
import { leererBestand } from '../lib/crm/speicher';

const HEUTE = '2026-09-24', J = `${HEUTE}T10:00:00Z`;
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });

describe('Firmen', () => {
  it('Schlüssel ohne Rechtsform, Domain ohne Freemail', () => {
    expect(firmenSchluessel('ACME Venetian Products GmbH')).toBe(firmenSchluessel('Acme Venetian Products'));
    expect(domainVon({ email: 'max@gmail.com', firmaWebseite: 'https://www.beispiel.de/kontakt' })).toBe('beispiel.de');
    expect(domainVon({ email: 'max@gmail.com' })).toBeUndefined();
  });
  it('Abgleich: eine Firma je Unternehmen, Personen verknüpft, leere Felder gefüllt, wiederholbar', () => {
    const kontakte = [
      k('a', { firma: 'Beispiel GmbH', email: 'a@beispiel.de', firmaBranche: 'Maschinenbau', typ: 'Lead' }),
      k('b', { firma: 'Beispiel', email: 'b@beispiel.de', firmaStadt: 'Berlin', lebensphase: 'kunde' }),
      k('c', { firma: 'Andere AG', email: 'c@gmail.com' }),
      k('d', {}),
    ];
    const r = firmenAbgleich(kontakte, [], J);
    expect(r.firmen.length).toBe(2);
    const b = r.firmen.find(f => f.name === 'Beispiel GmbH')!;
    expect(b).toMatchObject({ domain: 'beispiel.de', branche: 'Maschinenbau', stadt: 'Berlin', rolle: 'kunde' });
    expect(r.kontakte.filter(x => x.firmaId === b.id).length).toBe(2);
    expect(r.kontakte[3].firmaId).toBeUndefined();
    const r2 = firmenAbgleich(r.kontakte, r.firmen.map(f => ({ ...f, branche: 'Von Hand', rolle: 'wettbewerb', rolleVonHand: true })), J);
    expect(r2.neu).toBe(0);
    expect(r2.firmen.find(f => f.id === b.id)).toMatchObject({ branche: 'Von Hand', rolle: 'wettbewerb' });
  });
  it('Rolle aus den Personen, Dubletten über Domain', () => {
    expect(rolleAus([k('x', { typ: 'Dienstleister' }), k('y', { lebensphase: 'kunde' })])).toBe('kunde');
    expect(firmenDubletten([{ id: 'f-a', name: 'Alpha', domain: 'a.de', rolle: 'offen', geaendert: J }, { id: 'f-b', name: 'Alpha Holding', domain: 'a.de', rolle: 'offen', geaendert: J }]).length).toBe(1);
  });
});

describe('Kennzahlen', () => {
  it('grau, solange nichts gemessen ist — nie eine erfundene Null', () => {
    const z = kennzahlen([k('a')], leererBestand(), HEUTE);
    expect(z.find(x => x.id === 'power_hours')).toMatchObject({ ampel: 'grau', anzeige: '—' });
    expect(z.find(x => x.id === 'gespraeche')).toMatchObject({ ampel: 'grau' });
  });
  it('Gespräche der letzten 7 Tage, Erstgespräche, Power Hours', () => {
    const kontakte = [k('a', { aktivitaeten: [{ am: '2026-09-22T10:00', art: 'anruf', ergebnis: 'gespraech', von: 'kevin' }, { am: '2026-09-23T10:00', art: 'termin', von: 'kevin' }] })];
    const crm = { ...leererBestand(), sitzungen: [{ id: 'ph-1', person: 'kevin', datum: '2026-09-22', start: '', ziel: { gespraeche: 4, termine: 1 }, karten: [] }] };
    const z = kennzahlen(kontakte, crm, HEUTE);
    expect(z.find(x => x.id === 'gespraeche')).toMatchObject({ wert: 2, ampel: 'rot' });
    expect(z.find(x => x.id === 'erstgespraeche')).toMatchObject({ wert: 1 });
    expect(z.find(x => x.id === 'power_hours')).toMatchObject({ wert: 1, ampel: 'rot' });
  });
  it('Vollständigkeit und Speicherbegrenzung (24 Monate, nie Kunden)', () => {
    expect(vollstaendigkeit([k('a', { email: 'a@b.de' }), k('b')]).find(f => f.feld === 'email')).toMatchObject({ anzahl: 1, anteil: 0.5 });
    const alt = k('alt', { importiertAm: '2024-01-01' }), kunde = k('kd', { importiertAm: '2024-01-01', lebensphase: 'kunde' });
    expect(speicherbegrenzung([alt, kunde], HEUTE).map(x => x.id)).toEqual(['c-alt']);
  });
});

import { pflichtangaben, selbstpruefung, verarbeitungenStart } from '../lib/crm/datenschutz';
import { befunde } from '../lib/crm/befunde';

describe('Datenschutz als Code', () => {
  it('Pflichtangaben: erste passende Regel, im Zweifel berechtigtes Interesse, Recherche = Fremddaten', () => {
    const v = pflichtangaben([
      k('lead', { kategorie: 'Leadliste Tech/KI Berlin', quelle: 'Recherche 27.08.' }),
      k('apple', { kategorie: 'Apple-Kontakt' }),
      k('kunde', { lebensphase: 'kunde' }),
      k('fertig', { herkunft: 'selbst', rechtsgrundlage: 'einwilligung' }),
    ], leererBestand());
    expect(v.map(x => [x.id, x.herkunft, x.rechtsgrundlage, !!x.fremddaten])).toEqual([
      ['c-lead', 'recherche', 'berechtigt', true], ['c-apple', 'bekannt', 'berechtigt', false], ['c-kunde', 'vertrag', 'vertrag', false],
    ]);
  });
  it('Selbstprüfung aus dem Bestand, Verzeichnis mit Startbestand erfüllt', () => {
    const crm = { ...leererBestand(), verarbeitungen: verarbeitungenStart(J) };
    const p = selbstpruefung([k('a', { herkunft: 'selbst', rechtsgrundlage: 'vertrag' })], crm, HEUTE, { konten: 2, mitPasswort: 2 });
    expect(p.filter(x => x.status !== 'erfuellt').map(x => x.id)).toEqual([]);
    expect(selbstpruefung([k('b')], leererBestand(), HEUTE, { konten: 1, mitPasswort: 1 }).find(x => x.id === 'rechtsgrundlage')?.status).toBe('offen');
  });
  it('Befunde: überfälliger Schritt vor offenen Punkten, jede Person nur mit echtem Anlass', () => {
    const crm = { ...leererBestand(), chancen: [{ id: 'ch-1', titel: 'X', kontaktIds: ['c-a'], art: 'retainer' as const, wert: { betrag: 1000, basis: 'monat' as const }, stufe: 'angebot' as const, historie: [{ stufe: 'angebot' as const, am: '2026-09-01', von: 'k' }], qualifizierung: { schmerz: 'ja' as const, entscheider: 'ja' as const, budget: 'ja' as const, zeitpunkt: 'ja' as const, wirkung: 'ja' as const, alternative: 'ja' as const }, gesellschaft: 'kdc' as const, besitzer: 'kevin', angelegt: '2026-09-01', geaendert: '2026-09-01', naechsterSchritt: { text: 'y', datum: '2026-09-20' } }] };
    const b = befunde([k('a', { herkunft: 'selbst', rechtsgrundlage: 'vertrag' })], crm, HEUTE);
    expect(b[0]).toMatchObject({ prio: 1, bereich: 'pipeline' });
  });
});
