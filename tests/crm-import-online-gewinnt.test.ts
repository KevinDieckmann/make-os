// ─── Masterlisten-Import: Online gewinnt (27.09.) ───────────────────────────
// Kevins Entscheidungen: (a) die Liste füllt nur Lücken, Abweichungen an von
// Hand gepflegten Feldern werden Konflikte; (b) Zeilen ohne Owner bleiben ohne
// Besitzer; (c) tolerantes Matching, damit „Dr. Jörg Müller, Testfirma GmbH“
// nicht als zweiter Mensch neben „Joerg Mueller, Testfirma“ landet.
// Alle Daten erfunden (@example.invalid).

import { describe, it, expect } from 'vitest';
import {
  ausZeile, importieren, zusammenfuehren, schluessel, besitzerAusOwner, vonHandMarkieren, istVonHand,
  normName, normFirma, normTelefon, moeglicheDubletten, saeubereKontakt, type Kontakt,
} from '../lib/make-one/crm';

const HEUTE = '2026-09-27';
const SPAETER = '2026-10-04';

const zeile = (extra: Record<string, string> = {}): Record<string, string> => ({
  VORNAME: 'Testa', NACHNAME: 'Beispielmann', FIRMA: 'Testfirma-XYZ GmbH', EMAIL: 'testa@example.invalid',
  PRIORITAET: 'A', VERTRIEBS_EIGNUNG: 'ja', KONTAKT_TYP: 'Lead', OWNER: '(kein Owner)',
  GESPRAECHSAUFHAENGER: 'Aufhänger aus der Liste', KEVIN_NOTIZ: 'Notiz aus der Liste', ...extra,
});

describe('Merge-Regel: online gewinnt', () => {
  it('füllt leere Felder aus der Liste', () => {
    const alt: Kontakt = { ...ausZeile(zeile({ GESPRAECHSAUFHAENGER: '', FIRMA_STADT: '' }), HEUTE), vonHand: ['notiz'] };
    const r = zusammenfuehren(alt, ausZeile(zeile({ FIRMA_STADT: 'Teststadt' }), SPAETER), SPAETER);
    expect(r.kontakt.aufhaenger).toBe('Aufhänger aus der Liste');
    expect(r.kontakt.firmaStadt).toBe('Teststadt');
    expect(r.konflikte).toEqual([]);
  });

  it('überschreibt kein von Hand gesetztes Feld — es wird ein Konflikt', () => {
    const alt: Kontakt = { ...ausZeile(zeile(), HEUTE), aufhaenger: 'Von Malin online geschrieben', vonHand: ['aufhaenger'] };
    const r = zusammenfuehren(alt, ausZeile(zeile({ GESPRAECHSAUFHAENGER: 'Neu aus der Liste' }), SPAETER), SPAETER);
    expect(r.kontakt.aufhaenger).toBe('Von Malin online geschrieben');
    expect(r.geaendert).toBe(false);
    expect(r.konflikte).toEqual([{ kontaktId: alt.id, feld: 'aufhaenger', online: 'Von Malin online geschrieben', liste: 'Neu aus der Liste' }]);
  });

  it('frischt Felder auf, die nur vom Import stammen', () => {
    const alt: Kontakt = { ...ausZeile(zeile(), HEUTE), vonHand: ['notiz'] };
    const r = zusammenfuehren(alt, ausZeile(zeile({ GESPRAECHSAUFHAENGER: 'Neu aus der Liste' }), SPAETER), SPAETER);
    expect(r.kontakt.aufhaenger).toBe('Neu aus der Liste');
    expect(r.konflikte).toEqual([]);
  });

  it('Bestand ohne Herkunftsliste: nach dem Import geändert ⇒ Abweichung ist Konflikt (konservativ)', () => {
    const alt: Kontakt = { ...ausZeile(zeile(), HEUTE), geaendertAm: '2026-09-30', notiz: 'online ergänzt' };
    delete alt.vonHand;
    expect(istVonHand(alt, 'notiz')).toBe(true);
    const r = zusammenfuehren(alt, ausZeile(zeile({ KEVIN_NOTIZ: 'Liste sagt anders' }), SPAETER), SPAETER);
    expect(r.kontakt.notiz).toBe('online ergänzt');
    expect(r.konflikte.map(k => k.feld)).toEqual(['notiz']);
  });

  it('Bestand ohne Herkunftsliste, nie angefasst: Liste darf auffrischen und der Kontakt führt ab dann exakt', () => {
    const alt = ausZeile(zeile(), HEUTE);
    expect(alt.vonHand).toBeUndefined();
    const r = zusammenfuehren(alt, ausZeile(zeile({ KEVIN_NOTIZ: 'Liste sagt anders' }), SPAETER), SPAETER);
    expect(r.kontakt.notiz).toBe('Liste sagt anders');
    expect(r.kontakt.vonHand).toEqual([]);
  });

  it('füllt ein von Hand geleertes Feld nicht still wieder auf', () => {
    const alt: Kontakt = { ...ausZeile(zeile(), HEUTE), aufhaenger: undefined, vonHand: ['aufhaenger'] };
    const r = zusammenfuehren(alt, ausZeile(zeile(), SPAETER), SPAETER);
    expect(r.kontakt.aufhaenger).toBeUndefined();
    expect(r.konflikte.map(k => k.feld)).toEqual(['aufhaenger']);
  });

  it('lässt die Pipeline in Ruhe', () => {
    const alt: Kontakt = { ...ausZeile(zeile(), HEUTE), stufe: 'gespraech', wiedervorlage: '2026-10-10', besitzer: 'malin', vonHand: [] };
    const r = zusammenfuehren(alt, ausZeile(zeile({ OWNER: 'Kevin Dieckmann', LEAD_STATUS: 'OPEN_DEAL' }), SPAETER), SPAETER);
    expect(r.kontakt.stufe).toBe('gespraech');
    expect(r.kontakt.wiedervorlage).toBe('2026-10-10');
    expect(r.kontakt.besitzer).toBe('malin');
  });
});

describe('Import über den Bestand', () => {
  it('ist idempotent — zweimal laufen ändert nichts, Konflikte bleiben gleich', () => {
    const erst = importieren([], [zeile(), zeile({ VORNAME: 'Testo', EMAIL: 'testo@example.invalid' })], HEUTE);
    expect(erst.neu).toBe(2);
    const zweit = importieren(erst.kontakte, [zeile(), zeile({ VORNAME: 'Testo', EMAIL: 'testo@example.invalid' })], SPAETER);
    expect(zweit.neu).toBe(0); expect(zweit.aktualisiert).toBe(0); expect(zweit.unveraendert).toBe(2);
    expect(zweit.kontakte).toEqual(erst.kontakte);
    const dritt = importieren(zweit.kontakte, [zeile(), zeile({ VORNAME: 'Testo', EMAIL: 'testo@example.invalid' })], SPAETER);
    expect(dritt.kontakte).toEqual(zweit.kontakte);
    expect(dritt.konflikte).toEqual(zweit.konflikte);
  });

  it('sammelt Konflikte statt zu überschreiben und zählt Zeilen ohne Besitzer', () => {
    const erst = importieren([], [zeile()], HEUTE);
    const online: Kontakt = vonHandMarkieren(erst.kontakte[0], { ...erst.kontakte[0], notiz: 'Malins Notiz' });
    const r = importieren([online], [zeile({ KEVIN_NOTIZ: 'Kevins Listen-Notiz' })], SPAETER);
    expect(r.konflikte).toEqual([{ kontaktId: online.id, feld: 'notiz', online: 'Malins Notiz', liste: 'Kevins Listen-Notiz' }]);
    expect(r.kontakte[0].notiz).toBe('Malins Notiz');
    expect(r.ohneBesitzer).toBe(1);
  });

  it('meldet den Listen-Vermerk „Dublette Kevin/Malin“ als Hinweis', () => {
    const r = importieren([], [zeile({ STATUS_RECHERCHE: '⚠ Owner klären (Dublette Kevin/Malin)' })], HEUTE);
    expect(r.moeglicheDubletten).toEqual([{ kontaktId: r.kontakte[0].id, grund: 'Liste: Owner klären' }]);
  });
});

describe('Tolerantes Matching', () => {
  it('normalisiert Umlaute, Titel, Rechtsformen und Satzzeichen', () => {
    expect(normName('Dr. Jörg', 'Müller-Lüdenscheidt')).toBe('joergmuellerluedenscheidt');
    expect(normName('Prof. Dr. med. Änne', 'Straße')).toBe('aennestrasse');
    expect(normFirma('Testfirma GmbH & Co. KG')).toBe('testfirma');
    expect(normFirma('Beispiel-Werke e.K.')).toBe('beispielwerke');
    expect(normFirma('Muster UG (haftungsbeschränkt)')).toBe('muster');
    expect(normTelefon('+49 (0)30 123 45 67')).toBe('+49301234567');   // K2: E.164-nah (vorher „030…“)
    expect(normTelefon('12345')).toBe('');
  });

  it('erkennt denselben Menschen trotz Schreibweise — ohne Mail über Name+Firma', () => {
    const a = schluessel({ vorname: 'Dr. Jörg', nachname: 'Müller', firma: 'Testfirma GmbH & Co. KG' });
    const b = schluessel({ vorname: 'Joerg', nachname: 'Mueller', firma: 'Testfirma' });
    expect(a).toBe(b);
    const r = importieren(importieren([], [zeile({ EMAIL: '', VORNAME: 'Dr. Jörg', NACHNAME: 'Müller', FIRMA: 'Testfirma GmbH & Co. KG' })], HEUTE).kontakte,
      [zeile({ EMAIL: '', VORNAME: 'Joerg', NACHNAME: 'Mueller', FIRMA: 'Testfirma' })], SPAETER);
    expect(r.neu).toBe(0);
    expect(r.kontakte).toHaveLength(1);
  });

  it('E-Mail geht weiter vor — verschiedene Mails sind verschiedene Schlüssel', () => {
    expect(schluessel({ email: 'A@example.invalid', vorname: 'X', nachname: 'Y' })).toBe(schluessel({ email: 'a@example.invalid' }));
    expect(schluessel({ email: 'a@example.invalid' })).not.toBe(schluessel({ email: 'b@example.invalid' }));
  });

  it('schlägt mögliche Dubletten vor, verschmilzt sie aber nicht: gleicher Name bei anderer Firma, gleiche Telefonnummer', () => {
    const r = importieren([], [
      zeile({ EMAIL: 'eins@example.invalid', FIRMA: 'Firma Eins GmbH', TELEFON: '+49 30 1234567' }),
      zeile({ EMAIL: 'zwei@example.invalid', FIRMA: 'Firma Zwei AG' }),
      zeile({ EMAIL: 'drei@example.invalid', VORNAME: 'Anders', NACHNAME: 'Genannt', FIRMA: 'Firma Drei', TELEFON: '030/1234567' }),
    ], HEUTE);
    expect(r.kontakte).toHaveLength(3);
    const gruende = r.moeglicheDubletten.map(d => d.grund).sort();
    expect(gruende).toEqual(['gleiche Telefonnummer', 'gleicher Name, andere Firma']);
    // Ohne Beteiligung eines importierten Kontakts: kein Vorschlag (den Rest prüft Kontakte › Dubletten).
    expect(moeglicheDubletten(r.kontakte, new Set(['c-fremd']))).toEqual([]);
  });
});

describe('Owner-Mapping', () => {
  it('übersetzt OWNER in Team-Kürzel und lässt fremde oder fehlende Owner ohne Besitzer', () => {
    expect(besitzerAusOwner('Malin Würriehausen')).toBe('malin');
    expect(besitzerAusOwner('Kevin Dieckmann')).toBe('kevin');
    expect(besitzerAusOwner('Kevin Dieckmann & Malin Würriehausen')).toBe('beide');
    expect(besitzerAusOwner('(kein Owner)')).toBeUndefined();
    expect(besitzerAusOwner('')).toBeUndefined();
    expect(besitzerAusOwner('Fremde Person')).toBeUndefined();
  });

  it('setzt den Besitzer beim Import nur, wenn online keiner steht — und nie zurück', () => {
    const neu = ausZeile(zeile({ OWNER: 'Malin Würriehausen' }), HEUTE);
    expect(neu.besitzer).toBe('malin');
    expect(neu.owner).toBe('Malin Würriehausen');
    const ohne = importieren([], [zeile()], HEUTE).kontakte[0];
    expect(ohne.besitzer).toBeUndefined();
    const r1 = importieren([ohne], [zeile({ OWNER: 'Kevin Dieckmann' })], SPAETER);
    expect(r1.kontakte[0].besitzer).toBe('kevin');
    expect(r1.ohneBesitzer).toBe(0);
    const r2 = importieren(r1.kontakte, [zeile({ OWNER: '(kein Owner)' })], SPAETER);
    expect(r2.kontakte[0].besitzer).toBe('kevin');
    const r3 = importieren(r1.kontakte, [zeile({ OWNER: 'Malin Würriehausen' })], SPAETER);
    expect(r3.kontakte[0].besitzer).toBe('kevin');
  });
});

describe('Herkunft je Feld beim Schreiben von Hand', () => {
  it('merkt sich geänderte und geleerte Stammdaten-Felder, nie Pipeline-Felder', () => {
    const alt = ausZeile(zeile(), HEUTE);
    const neu = vonHandMarkieren(alt, { ...alt, aufhaenger: 'anders', notiz: undefined, stufe: 'gespraech', wiedervorlage: '2026-10-10' });
    expect(neu.vonHand?.sort()).toEqual(['aufhaenger', 'notiz']);
    // Unverändert: nichts markieren, aber Bestehendes behalten.
    expect(vonHandMarkieren({ ...alt, vonHand: ['notiz'] }, { ...alt }).vonHand).toEqual(['notiz']);
    expect(vonHandMarkieren(alt, { ...alt }).vonHand).toBeUndefined();
  });
  it('neu angelegt: jedes gefüllte Feld gilt als von Hand', () => {
    const k = vonHandMarkieren(undefined, { ...ausZeile(zeile(), HEUTE), firma: undefined });
    expect(k.vonHand).toContain('aufhaenger');
    expect(k.vonHand).not.toContain('firma');
    expect(k.vonHand).not.toContain('stufe');
  });
  it('saeubereKontakt lässt vonHand durch — nur bekannte Feldnamen, höchstens 60', () => {
    const k = saeubereKontakt({ ...ausZeile(zeile(), HEUTE), vonHand: ['notiz', 'stufe', 'id', 'fremdesFeld', 'notiz', ...Array.from({ length: 80 }, (_, i) => `x${i}`)] });
    expect(k?.vonHand).toEqual(['notiz']);
    expect(saeubereKontakt(ausZeile(zeile(), HEUTE))?.vonHand).toBeUndefined();
  });
});
