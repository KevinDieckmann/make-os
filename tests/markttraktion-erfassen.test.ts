// ─── Markttraktion — Erfassen ohne Reibung (25.09.) ─────────────────────────
// 453 Personen, zwei echte Aktivitäten: Gespräche finden statt, landen aber
// nicht in MAKE OS. Geprüft wird die reine Logik dahinter — Anrufen per Tipp
// nur, wo die Ampel es erlaubt, „Wie lief's?“ nach Terminen, das Ja im
// Gespräch als Einwilligung mit Wortlaut und die Jarvis-Schnellnotiz.

import { describe, it, expect } from 'vitest';
import type { Kontakt, Aktivitaet } from '../lib/make-one/crm';
import { telLink, mailLink, linkedinLink, kanalLink, nachbereitung, einwilligungUebernehmen, einwilligungVorlage, jarvisNotiz, erfassungAnwenden } from '../lib/crm/erfassen';
import { bezugTermin } from '../lib/crm/signale';
import { kanalStatus } from '../lib/crm/recht';
import { fuerDich } from '../lib/crm/team';
import { leererBestand } from '../lib/crm/speicher';

const HEUTE = '2026-09-25';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const termin = (am: string, titel = 'Kennenlernen Marc Test', id = am): Aktivitaet => ({ am, art: 'termin', text: `Termin: ${titel}`, von: 'system', bezug: bezugTermin(id) });

describe('Anrufen per Tipp — Telefonnummer normalisieren', () => {
  it('Leerzeichen und Klammern raus, führende 0 bleibt', () => {
    expect(telLink('(030) 123 45 67')).toBe('tel:0301234567');
    expect(telLink('0171 / 555-12 34')).toBe('tel:01715551234');
    expect(telLink('0049 30 1234567')).toBe('tel:0049301234567');
  });
  it('+49 bleibt, die „(0)“ der deutschen Schreibweise wird nicht gewählt', () => {
    expect(telLink('+49 30 1234567')).toBe('tel:+49301234567');
    expect(telLink('+49 (0) 171 5551234')).toBe('tel:+491715551234');
    expect(telLink('+49 0171 5551234')).toBe('tel:+491715551234');
    expect(telLink('+41 (0)44 123 45 67')).toBe('tel:+41441234567');
  });
  it('mehrere Nummern: die erste; leer oder Unsinn: kein Link', () => {
    expect(telLink('030 1234567, 0171 5551234')).toBe('tel:0301234567');
    expect(telLink('')).toBeNull();
    expect(telLink(undefined)).toBeNull();
    expect(telLink('k. A.')).toBeNull();
  });
});

describe('Mail und LinkedIn — nur echte Ziele werden zum Link', () => {
  it('mailto nur für eine plausible Adresse', () => {
    expect(mailLink(' marc@beispiel.de ')).toBe('mailto:marc@beispiel.de');
    expect(mailLink('marc at beispiel')).toBeNull();
    expect(mailLink('a@b.de, c@d.de')).toBeNull();
  });
  it('LinkedIn: Profil-URL mit https, Kurzform ergänzt, fremde oder gefährliche Ziele nie', () => {
    expect(linkedinLink('https://www.linkedin.com/in/marc-test')).toBe('https://www.linkedin.com/in/marc-test');
    expect(linkedinLink('linkedin.com/in/marc-test')).toBe('https://linkedin.com/in/marc-test');
    expect(linkedinLink('marc-test')).toBe('https://www.linkedin.com/in/marc-test');
    expect(linkedinLink('javascript:alert(1)')).toBeNull();
    expect(linkedinLink('https://boese.example/linkedin.com')).toBeNull();
  });
});

describe('Kanal-Link folgt der Ampel (§ 7 UWG)', () => {
  const ziele = { telefon: '+49 30 1', email: 'marc@beispiel.de', linkedin: 'linkedin.com/in/marc' };
  it('rot ist nie ein Link — ein Kaltanruf bleibt ein Chip', () => {
    const kalt = k('kalt', { telefon: '030 1', email: 'marc@beispiel.de', linkedin: 'linkedin.com/in/marc' });
    expect(kanalStatus(kalt, 'telefon').farbe).toBe('rot');
    expect(kanalLink(kanalStatus(kalt, 'telefon'), ziele)).toBeNull();
    expect(kanalLink(kanalStatus(kalt, 'mail'), ziele)).toBeNull();
    // Vernetzen ohne Werbebotschaft ist erlaubt — das Profil öffnet sich.
    expect(kanalLink(kanalStatus(kalt, 'vernetzen'), ziele)).toBe('https://linkedin.com/in/marc');
  });
  it('gelb und grün öffnen Telefon, Mailprogramm und Profil', () => {
    expect(kanalLink({ kanal: 'telefon', farbe: 'gelb' }, ziele)).toBe('tel:+49301');
    expect(kanalLink({ kanal: 'mail', farbe: 'gruen' }, ziele)).toBe('mailto:marc@beispiel.de');
    expect(kanalLink({ kanal: 'linkedin', farbe: 'gelb' }, ziele)).toBe('https://linkedin.com/in/marc');
    expect(kanalLink({ kanal: 'mail', farbe: 'gelb' }, { telefon: '030 1' })).toBeNull();
  });
});

describe('„Wie lief\'s?“ — Termine nachbereiten', () => {
  it('vergangener Termin ohne menschliche Aktivität danach → nachbereiten, mit Titel, Tag und für wen', () => {
    const l = nachbereitung([k('marc', { aktivitaeten: [termin('2026-09-24T10:00:00')] })], HEUTE);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ kontaktId: 'c-marc', titel: 'Kennenlernen Marc Test', tag: '2026-09-24', fuer: 'kevin', bezug: bezugTermin('2026-09-24T10:00:00') });
  });
  it('nur die letzten drei Tage — am Montag noch der Termin vom Freitag, ältere nicht', () => {
    expect(nachbereitung([k('a', { aktivitaeten: [termin('2026-09-22T09:00:00')] })], HEUTE)).toHaveLength(1);
    expect(nachbereitung([k('a', { aktivitaeten: [termin('2026-09-21T09:00:00')] })], HEUTE)).toHaveLength(0);
  });
  it('eine menschliche Aktivität nach dem Termin erledigt ihn — System, Übergabe und Früheres zählen nicht', () => {
    const t = termin('2026-09-24T10:00:00');
    const mit = (a: Aktivitaet) => nachbereitung([k('a', { aktivitaeten: [t, a] })], HEUTE);
    expect(mit({ am: '2026-09-24T15:00:00.000Z', art: 'gespraech', von: 'kevin' })).toHaveLength(0);
    expect(mit({ am: '2026-09-25T08:00:00.000Z', art: 'notiz', von: 'jarvis', text: 'Termin fand nicht statt' })).toHaveLength(0);
    expect(mit({ am: '2026-09-24T15:00:00.000Z', art: 'antwort', von: 'system', bezug: 'mail-x' })).toHaveLength(1);
    expect(mit({ am: '2026-09-24T15:00:00.000Z', art: 'uebergabe', von: 'kevin', text: 'an Malin' })).toHaveLength(1);
    expect(mit({ am: '2026-09-20T15:00:00.000Z', art: 'anruf', von: 'kevin', ergebnis: 'termin' })).toHaveLength(1);
  });
  it('je Person höchstens einmal — der jüngste Termin; jüngste zuerst', () => {
    const l = nachbereitung([
      k('a', { aktivitaeten: [termin('2026-09-23T10:00:00', 'Erstgespräch A Test'), termin('2026-09-24T16:00:00', 'Folgetermin A Test')] }),
      k('b', { aktivitaeten: [termin('2026-09-25T08:00:00', 'Frühstück B Test')] }),
    ], HEUTE);
    expect(l.map(x => [x.kontaktId, x.titel])).toEqual([['c-b', 'Frühstück B Test'], ['c-a', 'Folgetermin A Test']]);
  });
  it('mit Person nur das Eigene (und „beide“); gesperrte Personen nie', () => {
    const kontakte = [
      k('k', { aktivitaeten: [termin('2026-09-24T10:00:00')] }),
      k('m', { besitzer: 'malin', aktivitaeten: [termin('2026-09-24T11:00:00')] }),
      k('b', { besitzer: 'beide', aktivitaeten: [termin('2026-09-24T12:00:00')] }),
      k('s', { werbesperre: { seit: '2026-09-24', grund: 'Widerspruch' }, aktivitaeten: [termin('2026-09-24T13:00:00')] }),
    ];
    expect(nachbereitung(kontakte, HEUTE, 'kevin').map(x => x.kontaktId).sort()).toEqual(['c-b', 'c-k']);
    expect(nachbereitung(kontakte, HEUTE, 'malin').map(x => x.kontaktId).sort()).toEqual(['c-b', 'c-m']);
    expect(nachbereitung(kontakte, HEUTE)).toHaveLength(3);
  });
  it('ein Termin, den jemand von Hand eingetragen hat, ist kein Kalender-Termin', () => {
    expect(nachbereitung([k('a', { aktivitaeten: [{ am: '2026-09-24T10:00:00.000Z', art: 'termin', von: 'kevin' }] })], HEUTE)).toHaveLength(0);
  });
  it('steht in „Für dich“ als „Termine nachbereiten“ → Power Hour', () => {
    const f = fuerDich('kevin', [k('a', { aktivitaeten: [termin('2026-09-24T10:00:00')] })], leererBestand(), HEUTE);
    expect(f.find(x => x.id === 'nachbereiten')).toMatchObject({ welt: 'sales', titel: 'Termine nachbereiten', anzahl: 1, ziel: { s: 'sales', a: 'heute' } });
    expect(fuerDich('malin', [k('a', { aktivitaeten: [termin('2026-09-24T10:00:00')] })], leererBestand(), HEUTE).some(x => x.id === 'nachbereiten')).toBe(false);
  });
});

describe('Einwilligung im Gespräch — nur ein ausdrückliches Ja mit Wortlaut', () => {
  it('Vorlage in der Anrede der Person', () => {
    expect(einwilligungVorlage()).toBe('Darf ich Ihnen dazu etwas per Mail schicken? — Ja');
    expect(einwilligungVorlage('Du')).toMatch(/^Darf ich dir/);
  });
  it('eine vorhandene Rechtsgrundlage (z. B. Vertrag) bleibt — die Einwilligung gilt nur für die Werbung per Mail', () => {
    const n = einwilligungUebernehmen(k('v', { rechtsgrundlage: 'vertrag' }), einwilligungVorlage(), HEUTE, 'kevin')!;
    expect(n.rechtsgrundlage).toBe('vertrag');
    expect(n.einwilligungen?.[0].kanal).toBe('mail');
  });
  it('legt die Mail-Einwilligung mit Wortlaut, Tag und Fragendem an und setzt die Rechtsgrundlage', () => {
    const vorher = k('a', { einwilligungen: [{ kanal: 'telefon', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'Anruf erlaubt' }] });
    const n = einwilligungUebernehmen(vorher, einwilligungVorlage(), HEUTE, 'kevin')!;
    expect(n.rechtsgrundlage).toBe('einwilligung');
    expect(n.einwilligungen).toHaveLength(2);
    expect(n.einwilligungen![1]).toEqual({ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: HEUTE, nachweis: 'Im Gespräch (Kevin): Darf ich Ihnen dazu etwas per Mail schicken? — Ja' });
    // Danach ist Mail grün — die Ampel liest genau diese Einwilligung.
    expect(kanalStatus({ ...n, email: 'a@b.de' }, 'mail').farbe).toBe('gruen');
    expect(vorher.einwilligungen).toHaveLength(1);
  });
  it('ohne Wortlaut keine Einwilligung; eine gültige gibt es nicht doppelt, eine widerrufene wird neu erteilt', () => {
    expect(einwilligungUebernehmen(k('a'), '   ', HEUTE)).toBeNull();
    const hat = k('a', { einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'ja' }] });
    expect(einwilligungUebernehmen(hat, 'Ja', HEUTE)).toBeNull();
    const widerrufen = k('a', { einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'ja', widerrufenAm: '2026-09-10' }] });
    expect(einwilligungUebernehmen(widerrufen, 'Ja', HEUTE)!.einwilligungen).toHaveLength(2);
  });
});

describe('Jarvis-Schnellnotiz — Verlauf, Notiz und nächster Schritt in einem Aufruf', () => {
  it('„Hab mit Marc telefoniert, will Angebot bis Freitag“', () => {
    const e = jarvisNotiz({ kontakt: 'Marc', art: 'anruf', ergebnis: 'gespraech', bedarf: 'Angebot für den Retainer', naechster_schritt: 'Angebot schicken', faellig: '2026-09-26' }, HEUTE);
    expect(e).toEqual({ art: 'anruf', ergebnis: 'gespraech', notiz: { bedarf: 'Angebot für den Retainer' }, naechster: { text: 'Angebot schicken', datum: '2026-09-26' }, datumAngenommen: false });
  });
  it('ohne Datum in fünf Tagen (und gesagt); unbekannte Art ist ein Fehler, unbekanntes Ergebnis fällt weg', () => {
    const e = jarvisNotiz({ art: 'gespraech', naechster_schritt: 'Nachfassen', ergebnis: 'super' }, HEUTE);
    expect(e).toMatchObject({ art: 'gespraech', naechster: { text: 'Nachfassen', datum: '2026-09-30' }, datumAngenommen: true });
    expect((e as { ergebnis?: string }).ergebnis).toBeUndefined();
    expect(jarvisNotiz({ art: 'fax' }, HEUTE)).toMatch(/^Fehlgeschlagen/);
  });
  it('wendet es an wie die Power Hour: Verlauf mit Notiz, nächster Schritt, Stufe vorwärts, Wiedervorlage = Schritt', () => {
    const alt = k('marc', { stufe: 'angesprochen' });
    const n = erfassungAnwenden(alt, { art: 'anruf', von: 'kevin', ergebnis: 'gespraech', notiz: { bedarf: 'Angebot' }, naechster: { text: 'Angebot schicken', datum: '2026-09-26' } }, { stufe: 'gespraech', wiedervorlage: '2026-10-02' }, HEUTE, '2026-09-25T09:00:00.000Z');
    expect(n.aktivitaeten.at(-1)).toMatchObject({ art: 'anruf', ergebnis: 'gespraech', notiz: { bedarf: 'Angebot' }, von: 'kevin' });
    expect(n.naechsterSchritt).toEqual({ text: 'Angebot schicken', datum: '2026-09-26' });
    expect(n.wiedervorlage).toBe('2026-09-26');
    expect(n.stufe).toBe('gespraech');
    expect(n.letzterKontakt).toBe(HEUTE);
  });
  it('ein erledigter fälliger Schritt fällt nach dem Gespräch weg; Sperre sperrt sofort', () => {
    const alt = k('a', { naechsterSchritt: { text: 'Anrufen', datum: '2026-09-24' }, wiedervorlage: '2026-09-24' });
    expect(erfassungAnwenden(alt, { art: 'anruf', von: 'kevin', ergebnis: 'gespraech' }, null, HEUTE, '2026-09-25T09:00:00.000Z').naechsterSchritt).toBeUndefined();
    const gesperrt = erfassungAnwenden(alt, { art: 'anruf', von: 'kevin', ergebnis: 'sperre' }, { stufe: 'ruht', werbesperre: true }, HEUTE, '2026-09-25T09:00:00.000Z');
    expect(gesperrt.werbesperre).toEqual({ seit: HEUTE, grund: 'Widerspruch im Gespräch' });
    expect(gesperrt.naechsterSchritt).toBeUndefined();
    expect(gesperrt.wiedervorlage).toBeUndefined();
  });
});
