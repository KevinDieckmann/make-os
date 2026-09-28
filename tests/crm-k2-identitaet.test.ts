// ─── Paket K2 (28.09.) — Identität & Import, reine Regeln ───────────────────
// Normalisierung (#11–#14, NFD #115), gemeinsame Suche (#105), Import-Vorschau (#21–#23, #10), Herkunft/Art. 14
// (#27/#62), Sperrliste (#60/#64), CSV-Injection (#28), Server-Felder (#68), nie abschneiden, Regel 5.
// Alle Daten erfunden (@example.invalid).
import { describe, it, expect } from 'vitest';
import {
  ausZeile, importieren, schluessel, schluesselAlt, normName, normFirma, normTelefon, mailSchluessel, istSammelAdresse, datumAusListe,
  zusammenfuehren, saeubereKontakt, kontaktZuGross, serverStempel, sperreAufhebenPruefen, sperreAufhebenVermerk, sperreBehalten,
  AKTIVITAETEN_MAX, type Kontakt, type Aktivitaet,
} from '../lib/make-one/crm';
import { csvLesen, csvLesenMitBefund } from '../lib/make-one/csv';
import { suchNorm, suchPasst } from '../lib/text/such-norm';
import { dubletten } from '../lib/crm/dubletten';
import { importPruefen } from '../lib/crm/import-pruefung';
import { sperrlisteMit, sperrlisteOhne, sperrPruefer, sperrHashes } from '../lib/crm/sperrliste';
import { rueckgaengigRechnen, kontaktAbdruck, laeufeAufraeumen, laufOhne, type ImportLauf } from '../lib/crm/import-lauf';
import { csvZelle } from '../lib/crm/marketing';

const HEUTE = '2026-09-28';
const NFD = (t: string) => t.normalize('NFD');
const zeile = (extra: Record<string, string> = {}): Record<string, string> => ({ VORNAME: 'Max', NACHNAME: 'Muster', FIRMA: 'Testfirma GmbH', EMAIL: 'max@example.invalid', ...extra });
const nur = (z: Record<string, string>) => z;

describe('Normalisierung (#12–#14, NFD #115)', () => {
  it('NFC zuerst: ein NFD-Name (macOS) ergibt denselben Schlüssel wie NFC', () => {
    expect(NFD('Jörg Müller')).not.toBe('Jörg Müller');
    expect(normName(NFD('Jörg'), NFD('Müller'))).toBe(normName('Jörg', 'Müller'));
    expect(normName(NFD('Jörg'), NFD('Müller'))).toBe('joergmueller');
    expect(normFirma(NFD('Bäckerei Größe GmbH'))).toBe('baeckereigroesse');
  });

  it('Rechtsformen: „G.m.b.H.“, „GmbH & Co. KG“, „e.K.“, „e. V.“ fallen weg', () => {
    expect(normFirma('Testfirma G.m.b.H.')).toBe('testfirma');
    expect(normFirma('Testfirma GmbH & Co. KG')).toBe('testfirma');
    expect(normFirma('Testfirma GmbH & Co.KG')).toBe('testfirma');
    expect(normFirma('Beispiel-Werke e.K.')).toBe('beispielwerke');
    expect(normFirma('Musterverein e. V.')).toBe('musterverein');
    expect(normFirma('Testfirma G.m.b.H.')).toBe(normFirma('Testfirma GmbH'));
  });

  it('EINE Telefon-Normalisierung, E.164-nah', () => {
    expect(normTelefon('+49 (0)30 123 45 67')).toBe('+49301234567');
    expect(normTelefon('0049 30 1234567')).toBe('+49301234567');
    expect(normTelefon('030/1234567')).toBe('+49301234567');
    expect(normTelefon('+49 030 1234567')).toBe('+49301234567');
    expect(normTelefon('0041 44 123 45 67')).toBe('+41441234567');
    expect(normTelefon('+41 44 123 45 67')).toBe('+41441234567');
    expect(normTelefon('12345')).toBe('');
  });

  it('E-Mail-Schlüssel: nur NFC, trim, klein — „-“, „_“ und „+“ bleiben (zwei Postfächer verschmelzen nicht)', () => {
    expect(mailSchluessel(' Max-Muster@Example.INVALID ')).toBe('max-muster@example.invalid');
    expect(schluessel({ email: 'max-muster@example.invalid' })).not.toBe(schluessel({ email: 'maxmuster@example.invalid' }));
    expect(schluessel({ email: 'max_muster@example.invalid' })).not.toBe(schluessel({ email: 'maxmuster@example.invalid' }));
    expect(schluessel({ email: 'max+crm@example.invalid' })).not.toBe(schluessel({ email: 'max@example.invalid' }));
    expect(schluessel({ email: 'A.B@Firma.example.invalid' })).toBe(schluessel({ email: 'a.b@firma.example.invalid ' }));
    // vorher: beide „m:maxmuster@…“
    expect(schluesselAlt({ email: 'max-muster@example.invalid' })).toBe(schluesselAlt({ email: 'maxmuster@example.invalid' }));
  });

  it('Sammeladressen sind kein Personenschlüssel (dann Name+Firma bzw. HubSpot-ID)', () => {
    for (const a of ['info', 'kontakt', 'office', 'hallo', 'hello', 'mail', 'post', 'service', 'support', 'team', 'buero', 'büro', 'zentrale']) expect(istSammelAdresse(`${a}@firma.example.invalid`)).toBe(true);
    expect(istSammelAdresse('max@firma.example.invalid')).toBe(false);
    expect(schluessel({ email: 'info@firma.example.invalid', vorname: 'Max', nachname: 'Muster', firma: 'Firma GmbH' })).toBe('n:maxmuster|firma');
    expect(schluessel({ email: 'info@firma.example.invalid', hubspotId: '4711', vorname: 'Max' })).toBe('h:4711');
  });

  it('zwei Menschen mit derselben Sammeladresse werden beim Import zwei Kontakte', () => {
    const r = importieren([], [zeile({ EMAIL: 'info@firma.example.invalid' }), zeile({ VORNAME: 'Erika', NACHNAME: 'Beispiel', EMAIL: 'info@firma.example.invalid' })], HEUTE);
    expect(r.neu).toBe(2);
    expect(r.kontakte).toHaveLength(2);
  });

  it('„max-muster@“ und „maxmuster@“ (verschiedene Namen) werden zwei Kontakte', () => {
    const r = importieren([], [zeile({ EMAIL: 'max-muster@example.invalid' }), zeile({ VORNAME: 'Erika', NACHNAME: 'Beispiel', EMAIL: 'maxmuster@example.invalid' })], HEUTE);
    expect(r.kontakte).toHaveLength(2);
  });

  it('CSV-Lesen normalisiert NFD → NFC', () => {
    const z = csvLesen(NFD('VORNAME;NACHNAME\nJörg;Müller\n'));
    expect(z[0].VORNAME).toBe('Jörg');
    expect(z[0].NACHNAME).toBe('Müller');
    expect(z[0].NACHNAME.length).toBe(6);
  });

  it('NFD-Import trifft den NFC-Bestand (keine Dublette)', () => {
    const alt = ausZeile(nur({ VORNAME: 'Jörg', NACHNAME: 'Müller', FIRMA: 'Bäckerei GmbH' }), '2026-09-01');
    const r = importieren([alt], [nur({ VORNAME: NFD('Jörg'), NACHNAME: NFD('Müller'), FIRMA: NFD('Bäckerei G.m.b.H.') })], HEUTE);
    expect(r.kontakte).toHaveLength(1);
    expect(r.neu).toBe(0);
  });
});

describe('Übergangsregel: alter Bestand + neuer Import = keine Dublette', () => {
  /** Ein Kontakt, wie der Import VOR K2 ihn angelegt hat (Kennung aus der alten Schlüsselform). */
  const altKontakt = (z: Record<string, string>, id: string): Kontakt => ({ ...ausZeile(z, '2026-09-01'), id });

  it('Sammeladresse: früher unter m:info@… erkannt, jetzt fehlt dem Bestand die Firma → trotzdem derselbe Kontakt', () => {
    const alt = altKontakt(nur({ VORNAME: 'Max', NACHNAME: 'Muster', EMAIL: 'info@firma.example.invalid' }), 'c-minfofirmaexampleinvalid-abc123');
    expect(schluesselAlt(alt)).toBe('m:info@firma.example.invalid');
    const r = importieren([alt], [zeile({ EMAIL: 'info@firma.example.invalid', FIRMA: 'Firma GmbH' })], HEUTE);
    expect(r.kontakte).toHaveLength(1);
    expect(r.neu).toBe(0);
    expect(r.uebergang).toBe(1);
    expect(r.kontakte[0].id).toBe(alt.id);
    expect(r.kontakte[0].firma).toBe('Firma GmbH');
  });

  it('von Hand „max_muster@“, Liste „max-muster@“, gleicher Name → derselbe Kontakt (Bestand wird nicht verdoppelt)', () => {
    const alt = altKontakt(zeile({ EMAIL: 'max_muster@example.invalid' }), 'c-mmaxmusterexampleinvalid-def456');
    const r = importieren([alt], [zeile({ EMAIL: 'max-muster@example.invalid' })], HEUTE);
    expect(r.kontakte).toHaveLength(1);
    expect(r.uebergang).toBe(1);
  });

  it('… aber ein anderer Name unter der alten Form ist ein anderer Mensch (#12)', () => {
    const alt = altKontakt(zeile({ EMAIL: 'max-muster@example.invalid' }), 'c-mmaxmusterexampleinvalid-def456');
    const r = importieren([alt], [zeile({ VORNAME: 'Erika', NACHNAME: 'Beispiel', EMAIL: 'maxmuster@example.invalid' })], HEUTE);
    expect(r.kontakte).toHaveLength(2);
    expect(r.uebergang).toBe(0);
  });

  it('wer direkt getroffen wird, wird nicht zusätzlich über die alte Form an eine zweite Zeile gebunden', () => {
    const alt = altKontakt(zeile({ EMAIL: 'max-muster@example.invalid' }), 'c-mmaxmusterexampleinvalid-def456');
    const r = importieren([alt], [zeile({ EMAIL: 'maxmuster@example.invalid' }), zeile({ EMAIL: 'max-muster@example.invalid' })], HEUTE);
    expect(r.kontakte).toHaveLength(2);
    expect(r.unveraendert + r.aktualisiert).toBe(1);
  });

  it('zwei Bestands-Kontakte mit gleichem (neuem) Schlüssel gehen beim Import nicht verloren', () => {
    const a = altKontakt(nur({ VORNAME: 'Max', NACHNAME: 'Muster', FIRMA: 'Testfirma GmbH' }), 'c-nmaxmustertestfirmagmbh-aaa111');
    const b = altKontakt(nur({ VORNAME: 'Max', NACHNAME: 'Muster', FIRMA: 'Testfirma G.m.b.H.' }), 'c-nmaxmustertestfirmagmbh-bbb222');
    expect(schluessel(a)).toBe(schluessel(b));
    const r = importieren([a, b], [nur({ VORNAME: 'Erika', NACHNAME: 'Beispiel', FIRMA: 'Anderswo AG' })], HEUTE);
    expect(r.kontakte.map(k => k.id)).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(r.kontakte).toHaveLength(3);
  });
});

describe('Gemeinsame Suche (#105)', () => {
  it('„mueller“ findet „Müller“ (NFC und NFD), „strasse“ findet „Straße“', () => {
    expect(suchNorm('Müller')).toBe('mueller');
    expect(suchNorm(NFD('Müller'))).toBe('mueller');
    expect(suchPasst(['Jörg Müller'], 'mueller')).toBe(true);
    expect(suchPasst([NFD('Jörg Müller')], 'mueller')).toBe(true);
    expect(suchPasst(['Jörg Müller'], NFD('müller'))).toBe(true);
    expect(suchPasst(['Hauptstraße 1'], 'strasse')).toBe(true);
    expect(suchPasst(['Café Élan'], 'cafe elan')).toBe(true);
    expect(suchPasst(['Jörg Müller', 'Testfirma'], 'joerg testf')).toBe(true);
    expect(suchPasst(['Jörg Müller'], 'maier')).toBe(false);
  });
});

describe('Dubletten (#14, NFD)', () => {
  const k = (id: string, vorname: string, nachname: string, telefon?: string): Kontakt => ({ ...ausZeile(nur({ VORNAME: vorname, NACHNAME: nachname }), HEUTE), id, ...(telefon ? { telefon } : {}) });
  it('NFD-Name + dieselbe Nummer in anderer Schreibweise (0049 … / 030 …) ist ein Paar', () => {
    const p = dubletten([k('c-a-1111', 'Jörg', 'Müller', '0049 30 1234567'), k('c-b-2222', NFD('Jörg'), NFD('Müller'), '030 1234567')]);
    expect(p).toHaveLength(1);
  });
  it('„Mueller“ und „Müller“ sind derselbe Name', () => {
    expect(dubletten([k('c-a-1111', 'Joerg', 'Mueller', '030 1234567'), k('c-b-2222', 'Jörg', 'Müller', '+49 30 1234567')])).toHaveLength(1);
  });
});

describe('Import-Vorschau prüft (#21–#23) und Datum (#10)', () => {
  it('meldet verrutschte Zeilen, Excel-„E+“, verlorene PLZ-Null und unlesbares Datum', () => {
    const csv = [
      'VORNAME;NACHNAME;HUBSPOT_ID;TELEFON;PLZ;LETZTER_KONTAKT',
      'Max;Muster;1,23457E+11;030 1234;01067;03.09.2026',
      'Erika;Beispiel;4711;4,91701E+12;1067;31.02.2026',
      'Otto;Probe;4712;;;2026-09-01;zu viel',
    ].join('\n');
    const b = csvLesenMitBefund(csv, ';');
    const p = importPruefen(b);
    expect(p.zaehler).toEqual({ spalten: 1, excel_zahl: 2, plz_null: 1, datum: 1 });
    expect(p.warnungen.find(w => w.art === 'spalten')?.zeile).toBe(4);
    expect(p.warnungen.find(w => w.art === 'plz_null')).toMatchObject({ zeile: 3, spalte: 'PLZ' });
  });

  it('deutsches Datum → ISO, Unlesbares wird verworfen', () => {
    expect(datumAusListe('03.09.2026')).toEqual({ iso: '2026-09-03', unlesbar: false });
    expect(datumAusListe('3.9.26')).toEqual({ iso: '2026-09-03', unlesbar: false });
    expect(datumAusListe('2026-09-03')).toEqual({ iso: '2026-09-03', unlesbar: false });
    expect(datumAusListe('31.02.2026').unlesbar).toBe(true);
    expect(datumAusListe('gestern').unlesbar).toBe(true);
    expect(datumAusListe('')).toEqual({ unlesbar: false });
    expect(ausZeile(zeile({ LETZTER_KONTAKT: '03.09.2026' }), HEUTE).letzterKontakt).toBe('2026-09-03');
    expect(ausZeile(zeile({ LETZTER_KONTAKT: 'irgendwann' }), HEUTE).letzterKontakt).toBeUndefined();
  });
});

describe('Herkunft & Art. 14 (#27/#62)', () => {
  it('importierte Zeile: Herkunft „recherche“, Fremddaten → Art.-14-Uhr ab importiertAm', () => {
    const k = ausZeile(zeile(), HEUTE);
    expect(k).toMatchObject({ herkunft: 'recherche', fremddaten: true, importiertAm: HEUTE });
  });
  it('Herkunft aus QUELLE, wenn sie es klar sagt', () => {
    expect(ausZeile(zeile({ QUELLE: 'Empfehlung von Testperson' }), HEUTE)).toMatchObject({ herkunft: 'empfehlung', fremddaten: true });
    const h = ausZeile(zeile({ QUELLE: 'HubSpot-Export' }), HEUTE);
    expect(h.herkunft).toBe('hubspot');
    expect(h.fremddaten).toBeUndefined();
  });
  it('bestehende Herkunft (Handfeld) wird nie überschrieben; von Hand angelegte Personen werden nicht zur „Recherche“', () => {
    const alt: Kontakt = { ...ausZeile(zeile(), '2026-09-01'), herkunft: 'bekannt' };
    delete alt.fremddaten;
    expect(zusammenfuehren(alt, ausZeile(zeile(), HEUTE), HEUTE).kontakt.herkunft).toBe('bekannt');
    const hand: Kontakt = { ...ausZeile(zeile(), '2026-09-01'), quelle: 'Von Hand angelegt' };
    delete hand.herkunft; delete hand.fremddaten;
    const r = zusammenfuehren(hand, ausZeile(zeile(), HEUTE), HEUTE).kontakt;
    expect(r.herkunft).toBeUndefined();
    expect(r.fremddaten).toBeUndefined();
  });
  it('Altbestand aus derselben Liste ohne Herkunft bekommt sie nachgetragen', () => {
    const alt = ausZeile(zeile(), '2026-09-01');
    delete alt.herkunft; delete alt.fremddaten;
    const r = zusammenfuehren(alt, ausZeile(zeile(), HEUTE), HEUTE).kontakt;
    expect(r).toMatchObject({ herkunft: 'recherche', fremddaten: true, importiertAm: '2026-09-01' });
  });
});

describe('Sperrliste (#60/#64), rein', () => {
  const max = { vorname: 'Max', nachname: 'Muster', firma: 'Testfirma GmbH', email: 'max@example.invalid' };
  it('speichert nur SHA-256 — keine Klartexte', () => {
    const r = sperrlisteMit([], max, 'loeschung', HEUTE);
    const text = JSON.stringify(r.eintraege);
    expect(text).not.toMatch(/max|muster|testfirma|example/i);
    expect(r.eintraege[0].h.every(h => /^[0-9a-f]{64}$/.test(h))).toBe(true);
    expect(sperrlisteMit(r.eintraege, max, 'loeschung', HEUTE).geaendert).toBe(false);
  });
  it('Prüfer erkennt die Person auch mit neuer Mail (Name+Firma) und in NFD-Schreibweise', () => {
    const p = sperrPruefer(sperrlisteMit([], max, 'werbesperre', HEUTE).eintraege);
    expect(p({ ...max, email: 'max.neu@example.invalid' })).toBe(true);
    expect(p({ vorname: NFD('Max'), nachname: 'Muster', firma: 'Testfirma G.m.b.H.' })).toBe(true);
    expect(p({ vorname: 'Erika', nachname: 'Beispiel', firma: 'Testfirma GmbH', email: 'erika@example.invalid' })).toBe(false);
    expect(sperrlisteOhne(sperrlisteMit([], max, 'werbesperre', HEUTE).eintraege, max)).toEqual({ eintraege: [], entfernt: 1 });
    expect(sperrHashes({ email: 'info@firma.example.invalid' })).toEqual([]);
  });
  it('importieren: gesperrte Zeilen werden nicht angelegt, bestehende bleiben (mit Sperre)', () => {
    const gesperrt = sperrPruefer(sperrlisteMit([], max, 'loeschung', HEUTE).eintraege);
    const r = importieren([], [zeile(), zeile({ VORNAME: 'Erika', NACHNAME: 'Beispiel', EMAIL: 'erika@example.invalid' })], HEUTE, { gesperrt });
    expect(r.gesperrt).toBe(1);
    expect(r.kontakte.map(k => k.vorname)).toEqual(['Erika']);
    const da: Kontakt = { ...ausZeile(zeile(), '2026-09-01'), werbesperre: { seit: '2026-09-10', grund: 'Widerspruch' } };
    const r2 = importieren([da], [zeile()], HEUTE, { gesperrt });
    expect(r2.gesperrt).toBe(0);
    expect(r2.kontakte).toHaveLength(1);
    expect(r2.kontakte[0].werbesperre).toEqual(da.werbesperre);
  });
});

describe('Werbesperre aufheben nur mit Nachweis (#64)', () => {
  const gesperrt: Kontakt = { ...ausZeile(zeile(), '2026-09-01'), werbesperre: { seit: '2026-09-10', grund: 'Widerspruch' } };
  const ew = { kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-09-28', nachweis: 'DOI vom 28.09.' };
  it('ohne neue Einwilligung → abgelehnt; mit Nachweis → erlaubt; alte Einwilligung vor der Sperre zählt nicht', () => {
    expect(sperreAufhebenPruefen(gesperrt, { werbesperre: null })).toMatch(/Nachweis/);
    expect(sperreAufhebenPruefen(gesperrt, { werbesperre: null, einwilligungen: [{ ...ew, nachweis: '' }] })).toMatch(/Nachweis/);
    expect(sperreAufhebenPruefen(gesperrt, { werbesperre: null, einwilligungen: [{ ...ew, erteiltAm: '2026-09-01' }] })).toMatch(/Nachweis/);
    expect(sperreAufhebenPruefen(gesperrt, { werbesperre: null, einwilligungen: [ew] })).toBeNull();
    expect(sperreAufhebenPruefen(gesperrt, { notiz: 'x' })).toBeNull();
  });
  it('System-Aktivität mit Nachweis; ein ganzer Eintrag ohne Sperre hebt nie auf', () => {
    const neu = { ...gesperrt, einwilligungen: [ew] } as unknown as Kontakt;
    delete neu.werbesperre;
    const v = sperreAufhebenVermerk(gesperrt, neu, 'malin', '2026-09-28T10:00:00.000Z');
    expect(v.aktivitaeten.at(-1)).toMatchObject({ art: 'system', von: 'malin' });
    expect(v.aktivitaeten.at(-1)?.text).toContain('DOI vom 28.09.');
    expect(sperreBehalten(neu, gesperrt).werbesperre).toEqual(gesperrt.werbesperre);
  });
});

describe('CSV-Injection (#28)', () => {
  it('+ und - immer maskieren, außer reine Telefonnummern/Zahlen', () => {
    expect(csvZelle("-1+1+cmd|' /C calc'!A0")).toBe("'-1+1+cmd|' /C calc'!A0");
    expect(csvZelle('+1+1')).toBe("'+1+1");
    expect(csvZelle('-2+3')).toBe("'-2+3");
    expect(csvZelle('+49 30 123')).toBe('+49 30 123');
    expect(csvZelle('+49 (0)30 123-45')).toBe('+49 (0)30 123-45');
    expect(csvZelle('-5')).toBe('-5');
    expect(csvZelle('=1+1')).toBe("'=1+1");
  });
});

describe('Nie abschneiden, Regel 5, Server-Felder (#68)', () => {
  const akt = (i: number, von?: string): Aktivitaet => ({ am: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}.${String(i).padStart(3, '0')}Z`, art: 'notiz', text: `Notiz ${i}`, von: von as string });
  it('700 Aktivitäten und 40 Einwilligungen überleben die Säuberung', () => {
    const k = { ...ausZeile(zeile(), HEUTE), aktivitaeten: Array.from({ length: 700 }, (_, i) => akt(i, 'kevin')),
      einwilligungen: Array.from({ length: 40 }, (_, i) => ({ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: `Beleg ${i}` })) };
    const s = saeubereKontakt(k)!;
    expect(s.aktivitaeten).toHaveLength(700);
    expect(s.einwilligungen).toHaveLength(40);
  });
  it('über der Grenze: abgelehnt (null + Grund), nie gekürzt', () => {
    const k = { ...ausZeile(zeile(), HEUTE), aktivitaeten: Array.from({ length: AKTIVITAETEN_MAX + 1 }, (_, i) => akt(i, 'kevin')) };
    expect(kontaktZuGross(k)).toMatch(/abgelehnt/);
    expect(saeubereKontakt(k)).toBeNull();
  });
  it('Aktivität ohne gültiges `von` fällt nie auf „kevin“ zurück, sondern auf „system“', () => {
    const s = saeubereKontakt({ ...ausZeile(zeile(), HEUTE), aktivitaeten: [akt(1), akt(2, 'X Y')] })!;
    expect(s.aktivitaeten.map(a => a.von)).toEqual(['system', 'system']);
  });
  it('Browser-Werte für geaendertAm/importiertAm/vonHand zählen nicht', () => {
    const alt: Kontakt = { ...ausZeile(zeile(), '2026-09-01'), vonHand: ['notiz'] };
    const vomBrowser: Kontakt = { ...alt, aufhaenger: 'neu von Hand', importiertAm: '2020-01-01', geaendertAm: '2099-01-01', vonHand: ['email', 'telefon', 'firma'] };
    const s = serverStempel(vomBrowser, alt, HEUTE);
    expect(s.importiertAm).toBe('2026-09-01');
    expect(s.geaendertAm).toBe(HEUTE);
    expect([...(s.vonHand ?? [])].sort()).toEqual(['aufhaenger', 'notiz']);
    const neu = serverStempel({ ...vomBrowser, id: 'c-neu-1234' }, undefined, HEUTE);
    expect(neu.importiertAm).toBe(HEUTE);
    expect(neu.vonHand).not.toContain('nichtda');
  });
});

describe('Import-Lauf rückgängig (#25), rein', () => {
  const a = ausZeile(zeile(), '2026-09-01');
  const aNeu: Kontakt = { ...a, aufhaenger: 'aus der Liste' };
  const b = ausZeile(zeile({ VORNAME: 'Erika', NACHNAME: 'Beispiel', EMAIL: 'erika@example.invalid' }), HEUTE);
  const lauf: ImportLauf = { id: 'imp-abc123-a1b2c3', am: '2026-09-28T10:00:00.000Z', person: 'kevin', quelle: 'test', neu: [b.id], vorher: [a], nachher: { [a.id]: kontaktAbdruck(aNeu), [b.id]: kontaktAbdruck(b) } };
  it('neue fallen weg, geänderte bekommen ihren Vorher-Stand', () => {
    const r = rueckgaengigRechnen([aNeu, b], lauf, () => false);
    expect(r).toMatchObject({ zurueck: 2, konflikte: [] });
    expect(r.kontakte).toEqual([a]);
  });
  it('seitdem von Hand geändert oder verknüpft → Konflikt, nichts überschrieben', () => {
    const hand = { ...aNeu, notiz: 'von Malin' };
    const r = rueckgaengigRechnen([hand, b], lauf, id => id === b.id);
    expect(r.zurueck).toBe(0);
    expect(r.konflikte).toEqual([{ id: b.id, grund: 'inzwischen verknüpft' }, { id: a.id, grund: 'seitdem geändert' }]);
    expect(r.kontakte).toEqual([hand, b]);
  });
  it('Aufbewahrung 30 Tage; Art. 17 nimmt die Person aus dem Lauf', () => {
    expect(laeufeAufraeumen([lauf], '2026-10-27T10:00:00.000Z')).toHaveLength(1);
    expect(laeufeAufraeumen([lauf], '2026-10-29T10:00:00.000Z')).toHaveLength(0);
    const o = laufOhne(lauf, a.id);
    expect(o.n).toBe(2);
    expect(JSON.stringify(o.lauf)).not.toContain(a.id);
  });
});
