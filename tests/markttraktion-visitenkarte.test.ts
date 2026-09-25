// ─── Markttraktion · Visitenkarte → Kontakt ─────────────────────────────────
// Geprüft wird die reine Säuberung aus lib/crm/visitenkarte.ts: was aus der
// Modellantwort ins Formular darf (E-Mail, Telefon, Namen mit Titel, LinkedIn,
// Webseite), dass nichts erfunden wird, die Bildprüfung der Route, die
// Dublettenprüfung und der neue Kartei-Eintrag (Herkunft ja, Einwilligung nie).
// Alle Personen und Firmen hier sind erfunden; Bilder sind nur Byte-Köpfe.

import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import type { Firma } from '../lib/crm/typen';
import {
  emailNormal, telefonNormal, linkedinNormal, webNormal, nameTeilen, namensSchluessel, gleicherName,
  saeubereKarte, hatInhalt, bildTypAusDaten, pruefeBild, kartenDubletten, firmaZurKarte, kontaktAusKarte, MAX_BILD_MB,
} from '../lib/crm/visitenkarte';

const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: 'Erika', nachname: 'Muster', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const f = (name: string, x: Partial<Firma> = {}): Firma => ({ id: `f-${name.toLowerCase().replace(/[^a-z]/g, '')}-x1`, name, rolle: 'offen', geaendert: '2026-08-01', ...x });
/** Base64 aus Bytes — nur der Dateikopf, kein echtes Bild. */
const b64 = (...bytes: number[]) => btoa(String.fromCharCode(...bytes, ...new Array(30).fill(0)));
const JPEG = b64(0xff, 0xd8, 0xff, 0xe0);
const PNG = b64(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

describe('E-Mail', () => {
  it('klein, ohne mailto/Leerzeichen, formal gültig', () => {
    expect(emailNormal('Anna.Weber@Beispiel-Firma.DE')).toBe('anna.weber@beispiel-firma.de');
    expect(emailNormal('mailto:anna@beispiel.de')).toBe('anna@beispiel.de');
    expect(emailNormal('E-Mail: anna@beispiel.de.')).toBe('anna@beispiel.de');
    expect(emailNormal('anna.weber @ beispiel.de')).toBe('anna.weber@beispiel.de');
    expect(emailNormal('email@beispiel.de')).toBe('email@beispiel.de');
  });
  it('Unplausibles fällt weg', () => {
    for (const x of ['anna@beispiel', 'anna.beispiel.de', 'anna@@beispiel.de', 'anna..weber@beispiel.de', '.anna@beispiel.de', '', undefined, 42, `${'a'.repeat(170)}@beispiel.de`]) {
      expect(emailNormal(x), String(x)).toBeUndefined();
    }
  });
});

describe('Telefon', () => {
  it('normalisiert auf Ländervorwahl, Gruppen wie gedruckt', () => {
    expect(telefonNormal('0211 / 123 45-67')).toBe('+49 211 123 45 67');
    expect(telefonNormal('+49 (0) 171 1234567')).toBe('+49 171 1234567');
    expect(telefonNormal('Tel.: +49 (0)89 12 34 56')).toBe('+49 89 12 34 56');
    expect(telefonNormal('(0211) 123456')).toBe('+49 211 123456');
    expect(telefonNormal('0049 40 1234567')).toBe('+49 40 1234567');
    expect(telefonNormal('+4930123456')).toBe('+49 30123456');
    expect(telefonNormal('+49 030 1234567')).toBe('+49 30 1234567');
    expect(telefonNormal('M 0171-1234567')).toBe('+49 171 1234567');
    expect(telefonNormal('0043 1 234 5678')).toBe('+43 1 234 5678');
    expect(telefonNormal('+41 44 123 45 67 (Zentrale)')).toBe('+41 44 123 45 67');
  });
  it('ohne wählbare Vorwahl oder mit falscher Länge → leer', () => {
    for (const x of ['123 456', '211 1234567', '+49 12', '+49 1234 5678 9012 3456', '0211+1234', 'Tel.', '', null]) {
      expect(telefonNormal(x), String(x)).toBeUndefined();
    }
  });
});

describe('LinkedIn und Webseite', () => {
  it('LinkedIn: nur Personenprofile auf linkedin.com, einheitlich', () => {
    expect(linkedinNormal('linkedin.com/in/erika-muster-123/')).toBe('https://www.linkedin.com/in/erika-muster-123');
    expect(linkedinNormal('https://de.linkedin.com/in/erika-muster?trk=karte')).toBe('https://www.linkedin.com/in/erika-muster');
    expect(linkedinNormal('www.linkedin.com/pub/erika-muster/1/2/3')).toBe('https://www.linkedin.com/pub/erika-muster/1/2/3');
  });
  it('LinkedIn: fremde Domains, Firmenseiten, Handles, Tricks → leer', () => {
    for (const x of ['erika-muster', 'linkedin.com', 'linkedin.com/company/beispiel', 'https://linkedin.com.boese.de/in/x', 'https://boeselinkedin.com/in/x', 'https://linkedin.com@boese.de/in/x', 'javascript:alert(1)', 'xing.com/profile/Erika_Muster']) {
      expect(linkedinNormal(x), x).toBeUndefined();
    }
  });
  it('Webseite: nur http(s), ohne Tracking, nie LinkedIn oder Mail', () => {
    expect(webNormal('www.beispiel-firma.de')).toBe('https://www.beispiel-firma.de');
    expect(webNormal('HTTP://Beispiel.de/')).toBe('http://beispiel.de');
    expect(webNormal('beispiel.de/kontakt/?utm_source=karte#oben')).toBe('https://beispiel.de/kontakt');
    for (const x of ['javascript:alert(1)', 'ftp://beispiel.de', 'mailto:anna@beispiel.de', 'anna@beispiel.de', 'linkedin.com/in/erika', 'beispiel', 'https://nutzer:pw@beispiel.de', 'bei spiel.de x', '']) {
      expect(webNormal(x), x).toBeUndefined();
    }
  });
});

describe('Namen', () => {
  it('Titel bleibt vorn im Vornamen, getrennt geliefert oder im Namen', () => {
    expect(nameTeilen({ titel: 'Dr.', vorname: 'Anna', nachname: 'Weber' })).toEqual({ vorname: 'Dr. Anna', nachname: 'Weber' });
    expect(nameTeilen({ titel: '', vorname: 'Dr. Anna', nachname: 'Weber' })).toEqual({ vorname: 'Dr. Anna', nachname: 'Weber' });
    expect(nameTeilen({ titel: 'Dr.', vorname: 'Dr. Anna', nachname: 'Weber' })).toEqual({ vorname: 'Dr. Anna', nachname: 'Weber' });
    expect(nameTeilen({ titel: 'Prof. Dr. med.', vorname: 'Jan', nachname: 'Beispiel' })).toEqual({ vorname: 'Prof. Dr. med. Jan', nachname: 'Beispiel' });
    expect(nameTeilen({ vorname: 'Dr. h. c. Jan', nachname: 'Beispiel' })).toEqual({ vorname: 'Dr. h. c. Jan', nachname: 'Beispiel' });
    expect(nameTeilen({ titel: 'dr', vorname: 'Anna', nachname: 'Weber' }).vorname).toBe('Dr. Anna');
  });
  it('alles in einem Feld wird geteilt, Namenszusätze gehören zum Nachnamen', () => {
    expect(nameTeilen({ vorname: 'Dr. Anna Weber', nachname: '' })).toEqual({ vorname: 'Dr. Anna', nachname: 'Weber' });
    expect(nameTeilen({ vorname: 'Anna Maria von der Beispiel', nachname: '' })).toEqual({ vorname: 'Anna Maria', nachname: 'von der Beispiel' });
    expect(nameTeilen({ vorname: '', nachname: 'Jan de Vries' })).toEqual({ vorname: 'Jan', nachname: 'de Vries' });
  });
  it('Anrede und Abschlüsse fallen weg, eine Initiale bleibt', () => {
    expect(nameTeilen({ vorname: 'Herr Dipl.-Kfm. Jan', nachname: 'Beispiel, MBA' })).toEqual({ vorname: 'Jan', nachname: 'Beispiel' });
    expect(nameTeilen({ vorname: 'Anna', nachname: 'Weber M.Sc.' })).toEqual({ vorname: 'Anna', nachname: 'Weber' });
    expect(nameTeilen({ vorname: 'Dr. C.', nachname: 'Weber' })).toEqual({ vorname: 'Dr. C.', nachname: 'Weber' });
  });
  it('GROSSBUCHSTABEN werden zu normaler Schreibweise, sonst bleibt sie', () => {
    expect(nameTeilen({ vorname: 'ANNA-LENA', nachname: 'MÜLLER-BEISPIEL' })).toEqual({ vorname: 'Anna-Lena', nachname: 'Müller-Beispiel' });
    expect(nameTeilen({ vorname: 'Jan', nachname: 'VON BEISPIEL' })).toEqual({ vorname: 'Jan', nachname: 'von Beispiel' });
    expect(nameTeilen({ vorname: 'Anna', nachname: 'McBeispiel' }).nachname).toBe('McBeispiel');
  });
  it('nur Titel ohne Vornamen bleibt, nur Titel ohne Namen nicht', () => {
    expect(nameTeilen({ titel: 'Dr.', vorname: '', nachname: 'Weber' })).toEqual({ vorname: 'Dr.', nachname: 'Weber' });
    expect(nameTeilen({ titel: 'Dr.', vorname: '', nachname: '' })).toEqual({});
  });
  it('Dublettenschlüssel ohne Titel, Akzente, Groß/klein', () => {
    expect(namensSchluessel('Dr. Anna', 'Weber')).toBe(namensSchluessel('anna', 'WEBER'));
    expect(namensSchluessel('José', 'Beispiel')).toBe('josebeispiel');
    expect(gleicherName({ vorname: 'Prof. Dr. Anna', nachname: 'Weber' }, { vorname: 'Anna', nachname: 'Weber' })).toBe(true);
    expect(gleicherName({ vorname: 'Anna', nachname: 'Weber' }, { vorname: 'Hanna', nachname: 'Weber' })).toBe(false);
    expect(gleicherName({ vorname: 'Anna', nachname: '' }, { vorname: 'Anna', nachname: '' })).toBe(false);
  });
});

describe('Die ganze Karte', () => {
  const roh = {
    istVisitenkarte: true, titel: 'Dr.', vorname: 'Anna', nachname: 'Weber', firma: '  Beispiel   Maschinenbau GmbH ', position: 'Geschäftsführerin',
    email: 'A.Weber@Beispiel-Maschinenbau.de', telefon: '0211 / 123 45-67', mobil: '0171 1234567', linkedin: 'linkedin.com/in/anna-weber-beispiel', webseite: 'www.beispiel-maschinenbau.de', unsicher: [],
  };

  it('putzt alle Felder', () => {
    const r = saeubereKarte(roh);
    expect(r.istVisitenkarte).toBe(true);
    expect(r.unsicher).toEqual([]);
    expect(r.daten).toEqual({
      vorname: 'Dr. Anna', nachname: 'Weber', firma: 'Beispiel Maschinenbau GmbH', position: 'Geschäftsführerin', email: 'a.weber@beispiel-maschinenbau.de',
      telefon: '+49 211 123 45 67', mobil: '+49 171 1234567', linkedin: 'https://www.linkedin.com/in/anna-weber-beispiel', webseite: 'https://www.beispiel-maschinenbau.de',
    });
  });

  it('nichts erfinden: leere Felder bleiben weg', () => {
    const r = saeubereKarte({ istVisitenkarte: true, titel: '', vorname: 'Jan', nachname: 'Beispiel', firma: '', position: '', email: '', telefon: '', mobil: '', linkedin: '', webseite: '', unsicher: [] });
    expect(r.daten).toEqual({ vorname: 'Jan', nachname: 'Beispiel' });
    expect(Object.values(r.daten).every(v => v !== '')).toBe(true);
  });

  it('nur Mobil → wird Hauptnummer; gleiche Nummer doppelt → nur einmal', () => {
    expect(saeubereKarte({ ...roh, telefon: '', mobil: '0171 1234567' }).daten).toMatchObject({ telefon: '+49 171 1234567' });
    expect(saeubereKarte({ ...roh, telefon: '', mobil: '0171 1234567' }).daten.mobil).toBeUndefined();
    const doppelt = saeubereKarte({ ...roh, telefon: '+49 171 1234567', mobil: '0171-1234567' });
    expect(doppelt.daten.telefon).toBe('+49 171 1234567');
    expect(doppelt.daten.mobil).toBeUndefined();
  });

  it('Unplausibles fällt weg und steht in „unsicher“; Modell-Unsicherheit wird abgebildet', () => {
    const r = saeubereKarte({ ...roh, email: 'a.weber@beispiel', linkedin: 'xing.com/profile/x', webseite: 'javascript:alert(1)', unsicher: ['titel', 'position', 'erfunden'] });
    expect(r.daten.email).toBeUndefined();
    expect(r.daten.linkedin).toBeUndefined();
    expect(r.daten.webseite).toBeUndefined();
    expect(r.unsicher).toEqual(['vorname', 'position', 'email', 'linkedin', 'webseite']);
    // Unsichere Mobilnummer, die zur Hauptnummer wurde, zeigt auf „telefon“.
    expect(saeubereKarte({ ...roh, telefon: '', unsicher: ['mobil'] }).unsicher).toEqual(['telefon']);
  });

  it('Längen sind begrenzt, Steuerzeichen raus', () => {
    const r = saeubereKarte({ ...roh, firma: `Beispiel\u0000${'x'.repeat(500)}`, position: 'Chef\nvom\tDienst' });
    expect(r.daten.firma!.length).toBeLessThanOrEqual(140);
    expect(r.daten.firma).not.toContain('\u0000');
    expect(r.daten.position).toBe('Chef vom Dienst');
  });

  it('Müll und „keine Karte“ werfen nicht', () => {
    for (const x of [null, undefined, 'Text', 42, [], { vorname: { boese: true } }]) expect(() => saeubereKarte(x)).not.toThrow();
    expect(saeubereKarte(null).daten).toEqual({});
    expect(hatInhalt(saeubereKarte(null).daten)).toBe(false);
    expect(saeubereKarte({ istVisitenkarte: false }).istVisitenkarte).toBe(false);
    expect(hatInhalt(saeubereKarte(roh).daten)).toBe(true);
  });
});

describe('Bild prüfen (Route)', () => {
  it('erkennt den echten Typ an den ersten Bytes', () => {
    expect(bildTypAusDaten(JPEG)).toBe('image/jpeg');
    expect(bildTypAusDaten(PNG)).toBe('image/png');
    expect(bildTypAusDaten(btoa('GIF89a' + '\0'.repeat(20)))).toBe('image/gif');
    expect(bildTypAusDaten(btoa('RIFF\0\0\0\0WEBPVP8 ' + '\0'.repeat(12)))).toBe('image/webp');
    expect(bildTypAusDaten(btoa('%PDF-1.7' + '\0'.repeat(20)))).toBeNull();
    expect(bildTypAusDaten('###')).toBeNull();
  });
  it('Data-URL oder Base64; der mitgeschickte Typ wird nicht geglaubt', () => {
    expect(pruefeBild(`data:image/jpeg;base64,${JPEG}`, 'image/jpeg')).toEqual({ ok: true, daten: JPEG, medientyp: 'image/jpeg' });
    expect(pruefeBild(PNG, 'image/jpeg')).toEqual({ ok: true, daten: PNG, medientyp: 'image/png' });
  });
  it('leer, kaputt, falsches Format, zu groß → verständlicher Fehler', () => {
    expect(pruefeBild('', 'image/jpeg')).toMatchObject({ ok: false, status: 400 });
    expect(pruefeBild(undefined, undefined)).toMatchObject({ ok: false, status: 400 });
    expect(pruefeBild('data:image/jpeg;base64,<script>', 'image/jpeg')).toMatchObject({ ok: false, status: 400 });
    expect(pruefeBild(btoa('%PDF-1.7' + '\0'.repeat(20)), 'application/pdf')).toMatchObject({ ok: false, status: 415 });
    const heic = pruefeBild(btoa('\0\0\0\x18ftypheic' + '\0'.repeat(20)), 'image/heic');
    expect(heic.ok).toBe(false);
    if (!heic.ok) expect(heic.fehler).toMatch(/HEIC/);
    const gross = btoa('\xff\xd8\xff') + 'A'.repeat(Math.ceil((MAX_BILD_MB * 1024 * 1024 * 4) / 3) + 8);
    expect(pruefeBild(gross, 'image/jpeg')).toMatchObject({ ok: false, status: 413 });
  });
});

describe('In die Kartei', () => {
  const kartei = [
    k('anna-alt', { vorname: 'Anna', nachname: 'Weber', email: 'anna.weber@beispiel.de', firma: 'Beispiel GmbH' }),
    k('jan-alt', { vorname: 'Jan', nachname: 'Beispiel' }),
  ];

  it('Dubletten: Mail ist hart, Name (ohne Titel) nur Hinweis', () => {
    expect(kartenDubletten({ email: 'Anna.Weber@beispiel.de' }, kartei).mail?.id).toBe('c-anna-alt');
    expect(kartenDubletten({ vorname: 'Dr. Anna', nachname: 'Weber', email: 'neu@anders.de' }, kartei)).toEqual({ name: kartei[0] });
    expect(kartenDubletten({ vorname: 'Anna', nachname: 'Weber', email: 'anna.weber@beispiel.de' }, kartei)).toEqual({ mail: kartei[0] });
    expect(kartenDubletten({ vorname: 'Erika', nachname: 'Neu' }, kartei)).toEqual({});
  });

  it('Firma: gleicher Name ohne Rechtsform oder gleiche Domain; ohne Firmennamen keine Zuordnung', () => {
    const firmen = [f('Beispiel Maschinenbau GmbH', { domain: 'beispiel-maschinenbau.de' }), f('Anders AG', { webseite: 'https://www.anders-ag.de' })];
    expect(firmaZurKarte({ firma: 'Beispiel Maschinenbau' }, firmen)?.name).toBe('Beispiel Maschinenbau GmbH');
    expect(firmaZurKarte({ firma: 'BM Beispiel', email: 'a@beispiel-maschinenbau.de' }, firmen)?.name).toBe('Beispiel Maschinenbau GmbH');
    expect(firmaZurKarte({ firma: 'Anders', webseite: 'https://anders-ag.de' }, firmen)?.name).toBe('Anders AG');
    expect(firmaZurKarte({ firma: 'Ganz Neu GmbH', email: 'x@gmail.com' }, firmen)).toBeUndefined();
    expect(firmaZurKarte({ email: 'a@beispiel-maschinenbau.de' }, firmen)).toBeUndefined();
  });

  it('neuer Kontakt: Herkunft Veranstaltung, keine Einwilligung, keine Art.-14-Pflicht', () => {
    const d = saeubereKarte({ titel: 'Dr.', vorname: 'Anna', nachname: 'Weber', firma: 'Beispiel GmbH', email: 'neu@beispiel.de', telefon: '0211 123456', mobil: '0171 7654321', linkedin: 'linkedin.com/in/anna-beispiel', webseite: 'beispiel.de' }).daten;
    const kontakt = kontaktAusKarte(d, { id: 'c-neu-test1', heute: '2026-09-25', jetzt: '2026-09-25T19:30:00.000Z', von: 'malin', herkunft: 'veranstaltung', firma: { id: 'f-beispiel-x1', name: 'Beispiel GmbH' }, anlass: 'Per Visitenkarte am Einlass angelegt — Stammtisch' });
    expect(kontakt).toMatchObject({
      id: 'c-neu-test1', vorname: 'Dr. Anna', nachname: 'Weber', email: 'neu@beispiel.de', telefon: '+49 211 123456', sms: '+49 171 7654321',
      linkedin: 'https://www.linkedin.com/in/anna-beispiel', firma: 'Beispiel GmbH', firmaId: 'f-beispiel-x1', firmaWebseite: 'https://beispiel.de',
      herkunft: 'veranstaltung', besitzer: 'malin', quelle: 'Visitenkarte', stufe: 'neu', lebensphase: 'kontakt', anrede: 'Sie', importiertAm: '2026-09-25',
    });
    expect(kontakt.einwilligungen).toBeUndefined();
    expect(kontakt.fremddaten).toBeUndefined();
    expect(kontakt.aktivitaeten).toEqual([{ am: '2026-09-25T19:30:00.000Z', art: 'system', text: 'Per Visitenkarte am Einlass angelegt — Stammtisch', von: 'malin' }]);
    // Kartei-ID passt zum Muster, das die Teilnahme-Prüfung verlangt.
    expect(/^c-[a-z0-9-]{4,60}$/.test(kontakt.id)).toBe(true);
  });

  it('ohne Firma in der Kartei: Name von der Karte, ohne firmaId; ohne Anlegenden: von system', () => {
    const kontakt = kontaktAusKarte({ vorname: 'Jan', nachname: 'Neu', firma: 'Neu & Co' }, { id: 'c-neu-test2', heute: '2026-09-25', jetzt: '2026-09-25T19:30:00.000Z', herkunft: 'selbst', anlass: 'Per Visitenkarte angelegt' });
    expect(kontakt.firma).toBe('Neu & Co');
    expect(kontakt.firmaId).toBeUndefined();
    expect(kontakt.besitzer).toBeUndefined();
    expect(kontakt.aktivitaeten[0].von).toBe('system');
    expect(kontakt.email).toBeUndefined();
  });
});
