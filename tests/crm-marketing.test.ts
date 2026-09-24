import { describe, it, expect } from 'vitest';
import type { Kontakt, Einwilligung } from '../lib/make-one/crm';
import type { Beitrag, Chance, CrmBestand, NewsletterAusgabe } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { kontextAus } from '../lib/crm/segmente';
import {
  marketingKennzahlen, contentGespraeche, ausMarketing, wirkungZahlen, newsletterEmpfaenger, newsletterCsv, segmentCsv,
  saeubereEinstellung, abmeldequote, quotenAmpel, planFenster, imFenster, kalenderwoche, stimmenAus, ideeAusStimme, schonUebernommen,
  csvZelle, kriterienText, kriterienSauber, kriterienGleich, SEGMENT_VORLAGEN, vorlageAlsSegment,
} from '../lib/crm/marketing';

const HEUTE = '2026-09-24';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const ew = (kanal: Einwilligung['kanal'], x: Partial<Einwilligung> = {}): Einwilligung => ({ kanal, grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'DOI', ...x });
const b = (id: string, x: Partial<Beitrag> = {}): Beitrag => ({ id: `bt-${id}`, titel: id, kanal: 'linkedin', status: 'idee', wirkung: [], quellen: [], geaendert: HEUTE, ...x });
const chance = (id: string, x: Partial<Chance> = {}): Chance => ({
  id: `ch-${id}`, titel: id, kontaktIds: [], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'qualifiziert', historie: [],
  qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'offen', besitzer: 'kevin', angelegt: `${HEUTE}T09:00:00.000Z`, geaendert: HEUTE, ...x,
});
const ausgabe = (id: string, x: Partial<NewsletterAusgabe> = {}): NewsletterAusgabe => ({ id: `nl-${id}`, titel: id, status: 'versendet', inhalt: '', beitragIds: [], geaendert: HEUTE, ...x });
const bestand = (x: Partial<CrmBestand> = {}): CrmBestand => ({ ...leererBestand(), ...x });
const kpi = (l: ReturnType<typeof marketingKennzahlen>, id: string) => l.find(x => x.id === id)!;

describe('Marketing-Kennzahlen', () => {
  it('grau, solange nichts gemessen ist — nie eine erfundene Null', () => {
    const l = marketingKennzahlen([], bestand(), HEUTE);
    expect(l.every(x => x.ampel === 'grau' && x.wert === null && x.anzeige === '—')).toBe(true);
  });
  it('Veröffentlichungen je Woche: ≥ 2 grün, 1 gelb, 0 rot', () => {
    const alt = b('alt', { status: 'veroeffentlicht', datum: '2026-09-01' });
    expect(kpi(marketingKennzahlen([], bestand({ beitraege: [alt] }), HEUTE), 'veroeffentlichungen')).toMatchObject({ wert: 0, ampel: 'rot' });
    const eins = [alt, b('a', { status: 'veroeffentlicht', datum: '2026-09-22' })];
    expect(kpi(marketingKennzahlen([], bestand({ beitraege: eins }), HEUTE), 'veroeffentlichungen')).toMatchObject({ wert: 1, ampel: 'gelb' });
    // Geplant zählt nicht, Veröffentlicht in der Zukunft auch nicht.
    const zwei = [...eins, b('b', { status: 'veroeffentlicht', datum: HEUTE }), b('c', { status: 'geplant', datum: HEUTE }), b('d', { status: 'veroeffentlicht', datum: '2026-09-30' })];
    expect(kpi(marketingKennzahlen([], bestand({ beitraege: zwei }), HEUTE), 'veroeffentlichungen')).toMatchObject({ wert: 2, ampel: 'gruen' });
  });
  it('Gespräche aus Content: ≥ 2 grün, 1 gelb, 0 rot', () => {
    const pub = b('p', { status: 'veroeffentlicht', datum: '2026-09-01' });
    expect(kpi(marketingKennzahlen([], bestand({ beitraege: [pub] }), HEUTE), 'content_gespraeche')).toMatchObject({ wert: 0, ampel: 'rot' });
    const eins = { ...pub, wirkung: [{ kontaktId: 'c-a', art: 'anfrage' as const, am: '2026-09-20' }] };
    expect(kpi(marketingKennzahlen([], bestand({ beitraege: [eins] }), HEUTE), 'content_gespraeche')).toMatchObject({ wert: 1, ampel: 'gelb' });
    const zwei = { ...pub, wirkung: [...eins.wirkung, { kontaktId: 'c-b', art: 'gespraech' as const, am: HEUTE }] };
    expect(kpi(marketingKennzahlen([], bestand({ beitraege: [zwei] }), HEUTE), 'content_gespraeche')).toMatchObject({ wert: 2, ampel: 'gruen' });
  });
  it('Anteil neuer Chancen mit Marketing-Quelle: ≥ 25 % grün, 10–25 % gelb, < 10 % rot', () => {
    const mk = (n: number, von: number) => Array.from({ length: von }, (_, i) => chance(`x${i}`, { quelle: i < n ? 'content' : 'empfehlung' }));
    expect(kpi(marketingKennzahlen([], bestand({ chancen: mk(1, 4) }), HEUTE), 'marketing_anteil')).toMatchObject({ ampel: 'gruen', anzeige: '25 %' });
    expect(kpi(marketingKennzahlen([], bestand({ chancen: mk(1, 10) }), HEUTE), 'marketing_anteil').ampel).toBe('gelb');
    expect(kpi(marketingKennzahlen([], bestand({ chancen: mk(1, 11) }), HEUTE), 'marketing_anteil').ampel).toBe('rot');
    // Alte Chancen (älter als 90 Tage) sind keine neuen Chancen.
    expect(kpi(marketingKennzahlen([], bestand({ chancen: [chance('alt', { angelegt: '2026-01-01T00:00:00Z' })] }), HEUTE), 'marketing_anteil').ampel).toBe('grau');
  });
  it('Abmeldequote: < 0,5 % grün, 0,5–1 % gelb, > 1 % rot; ohne Zahlen grau', () => {
    expect(quotenAmpel(0.004)).toBe('gruen');
    expect(quotenAmpel(0.005)).toBe('gelb');
    expect(quotenAmpel(0.01)).toBe('gelb');
    expect(quotenAmpel(0.012)).toBe('rot');
    expect(abmeldequote(ausgabe('a', { status: 'bereit', empfaenger: 100, abmeldungen: 1 }))).toBeNull();
    expect(abmeldequote(ausgabe('a', { empfaenger: 100 }))).toBeNull();
    expect(abmeldequote(ausgabe('a', { empfaenger: 0, abmeldungen: 0 }))).toBeNull();
    const l = marketingKennzahlen([], bestand({ newsletter: [ausgabe('alt', { datum: '2026-08-01', empfaenger: 100, abmeldungen: 5 }), ausgabe('neu', { datum: '2026-09-20', empfaenger: 200, abmeldungen: 1 })] }), HEUTE);
    expect(kpi(l, 'abmeldequote')).toMatchObject({ wert: 0.005, anzeige: '0,5 %', ampel: 'gelb' });
  });
  it('Art. 14: 0 überfällig grün, ab 1 rot', () => {
    const ok = k('a', { fremddaten: true, importiertAm: '2026-09-20' });
    expect(kpi(marketingKennzahlen([ok], bestand(), HEUTE), 'art14')).toMatchObject({ wert: 0, ampel: 'gruen' });
    const faellig = k('b', { fremddaten: true, importiertAm: '2026-08-01' });
    expect(kpi(marketingKennzahlen([ok, faellig], bestand(), HEUTE), 'art14')).toMatchObject({ wert: 1, ampel: 'rot' });
  });
  it('Newsletter netto: neue Double-Opt-ins minus Widerrufe in 30 Tagen', () => {
    const l = [k('a', { email: 'a@x.de', einwilligungen: [ew('newsletter', { erteiltAm: '2026-09-10' })] }), k('b', { email: 'b@x.de', einwilligungen: [ew('newsletter', { erteiltAm: '2026-01-10', widerrufenAm: '2026-09-15' })] }), k('c', { email: 'c@x.de', einwilligungen: [ew('newsletter', { erteiltAm: '2026-09-12' })] })];
    expect(kpi(marketingKennzahlen(l, bestand(), HEUTE), 'newsletter_netto')).toMatchObject({ wert: 1, anzeige: '+1', ampel: 'gruen' });
  });
});

describe('Attribution', () => {
  const wirkung = [
    { kontaktId: 'c-a', art: 'anfrage' as const, am: '2026-09-10' },
    { kontaktId: 'c-a', art: 'gespraech' as const, am: '2026-09-12' },   // dieselbe Person, derselbe Beitrag → einmal
    { kontaktId: 'c-b', art: 'reaktion' as const, am: '2026-09-12' },    // Reaktion ist kein Gespräch
    { kontaktId: 'c-c', art: 'gespraech' as const, am: '2026-07-01' },   // außerhalb des Zeitraums
  ];
  it('zählt je Beitrag und Person einmal, nur Gespräch/Anfrage, nur im Zeitraum', () => {
    const l = [b('x', { wirkung }), b('y', { wirkung: [{ kontaktId: 'c-a', art: 'gespraech', am: '2026-09-20' }] })];
    expect(contentGespraeche(l, '2026-08-26', HEUTE)).toBe(2);
    expect(wirkungZahlen(l[0])).toEqual({ reaktionen: 1, gespraeche: 2, anfragen: 1 });
  });
  it('Chance zählt als Marketing bei Quelle Content/Anfrage oder Gespräch aus einem Beitrag vor Anlage', () => {
    const beitraege = [b('x', { wirkung })];
    expect(ausMarketing(chance('q', { quelle: 'inbound' }), [])).toBe(true);
    expect(ausMarketing(chance('e', { quelle: 'event' }), [])).toBe(false);
    expect(ausMarketing(chance('p', { quelle: 'empfehlung', kontaktIds: ['c-a'] }), beitraege)).toBe(true);
    expect(ausMarketing(chance('r', { kontaktIds: ['c-b'] }), beitraege)).toBe(false);            // nur Reaktion
    expect(ausMarketing(chance('f', { kontaktIds: ['c-a'], angelegt: '2026-09-01T10:00:00Z' }), beitraege)).toBe(false); // Gespräch erst NACH Anlage
  });
});

describe('Newsletter', () => {
  it('Empfänger nur mit Double-Opt-in — keine Mail-Einwilligung, kein Widerruf, keine Sperre, keine Adresse', () => {
    const l = [
      k('doi', { email: 'doi@x.de', einwilligungen: [ew('newsletter')] }),
      k('mail', { email: 'mail@x.de', einwilligungen: [ew('mail')], lebensphase: 'kunde' }),
      k('widerruf', { email: 'w@x.de', einwilligungen: [ew('newsletter', { widerrufenAm: '2026-09-10' })] }),
      k('sperre', { email: 's@x.de', einwilligungen: [ew('newsletter')], werbesperre: { seit: HEUTE, grund: 'Widerspruch' } }),
      k('ohne', { einwilligungen: [ew('newsletter')] }),
    ];
    expect(newsletterEmpfaenger(l).map(x => x.id)).toEqual(['c-doi']);
    const csv = newsletterCsv(l);
    expect(csv.startsWith('﻿name;email\n')).toBe(true);
    expect(csv).toContain('doi Test;doi@x.de');
    expect(csv).not.toContain('mail@x.de');
    expect(csv.split('\n')).toHaveLength(2);
  });
});

describe('Segment-Export', () => {
  const crm = bestand({ firmen: [{ id: 'f-a', name: 'Alpha GmbH', rolle: 'zielkunde', geaendert: HEUTE }] });
  const ctx = kontextAus(crm, HEUTE);
  it('Mail-Adresse nur bei grüner Mail-Ampel; Gesperrte und Privatnotiz nie', () => {
    const l = [
      k('gruen', { email: 'g@x.de', firmaId: 'f-a', kreis: 'A', einwilligungen: [ew('mail')], privatNotiz: 'GEHEIM' }),
      k('gelb', { email: 'y@x.de', kreis: 'A', telefon: '030 123' }),
      k('rot', { email: 'r@x.de' }),
      k('gesperrt', { email: 'x@x.de', einwilligungen: [ew('mail')], werbesperre: { seit: HEUTE, grund: 'x' } }),
    ];
    const csv = segmentCsv(l, {}, ctx);
    const zeilen = csv.replace('﻿', '').split('\n');
    expect(zeilen[0]).toBe('name;firma;email;telefon;kreis;phase;kanal_status');
    expect(zeilen).toHaveLength(4);
    expect(zeilen[1]).toBe('gruen Test;Alpha GmbH;g@x.de;;A;Kontakt;Mail grün, Newsletter rot');
    expect(zeilen[2].split(';')[2]).toBe('');
    expect(zeilen[2]).toContain('030 123');
    expect(zeilen[3].split(';')[2]).toBe('');
    expect(csv).not.toContain('y@x.de');
    expect(csv).not.toContain('r@x.de');
    expect(csv).not.toContain('x@x.de');
    expect(csv).not.toContain('GEHEIM');
  });
  it('Zellen sind Semikolon- und Formel-sicher, Telefonnummern bleiben', () => {
    expect(csvZelle('a;b')).toBe('"a;b"');
    expect(csvZelle('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvZelle('+49 30 123')).toBe('+49 30 123');
    expect(csvZelle('-5')).toBe('-5');
    expect(csvZelle('@SUM')).toBe("'@SUM");
  });
  it('Kriterien in fester Form: Klick-Reihenfolge, Leerzeichen und Leeres ändern nichts', () => {
    expect(kriterienSauber({ kreis: ['B', 'A', 'A'], branche: '  Bau ', stadt: '', prio: [], ohneKontaktSeitTagen: 0 })).toEqual({ kreis: ['A', 'B'], branche: 'Bau' });
    expect(kriterienGleich({ stichwort: 'x', kreis: ['A', 'B'] }, { kreis: ['B', 'A'], stichwort: 'x ' })).toBe(true);
    expect(kriterienGleich({ kreis: ['A'] }, { kreis: ['A'], mitChance: false })).toBe(false);
  });
  it('Vorlagen werden erst auf Klick zu Segmenten', () => {
    expect(SEGMENT_VORLAGEN).toHaveLength(3);
    const s = vorlageAlsSegment(SEGMENT_VORLAGEN[2], 'sg-1', HEUTE);
    expect(s).toMatchObject({ id: 'sg-1', name: 'Kreis A/B ohne Kontakt seit 60 Tagen', kriterien: { kreis: ['A', 'B'], ohneKontaktSeitTagen: 60 } });
    expect(kriterienText(s.kriterien)).toBe('Kreis A, B · ohne Kontakt seit 60 Tagen');
    expect(kriterienText({})).toBe('alle Personen ohne Werbesperre');
  });
});

describe('Einstellung säubern', () => {
  it('begrenzt Längen und Anzahl, verwirft Leeres und Fremdes', () => {
    const lang = 'x'.repeat(5000);
    const e = saeubereEinstellung({
      positionierung: lang, icp: lang, ton: lang, fremd: 'weg',
      saeulen: [...Array.from({ length: 12 }, (_, i) => ({ id: `s-${i}`, name: `Säule ${i} ${'y'.repeat(80)}`, beschreibung: lang })), { name: '  ' }],
    });
    expect(e.positionierung).toHaveLength(3000);
    expect(e.icp).toHaveLength(3000);
    expect(e.ton).toHaveLength(300);
    expect(e.saeulen).toHaveLength(8);
    expect(e.saeulen.every(s => s.name.length <= 60 && s.beschreibung.length <= 400)).toBe(true);
    expect(Object.keys(e).sort()).toEqual(['icp', 'positionierung', 'saeulen', 'ton']);
  });
  it('Unbrauchbares wird zur leeren Einstellung; IDs sind eindeutig und sauber', () => {
    expect(saeubereEinstellung(null)).toEqual({ positionierung: '', icp: '', ton: '', saeulen: [] });
    expect(saeubereEinstellung({ positionierung: 42, saeulen: 'x' })).toEqual({ positionierung: '', icp: '', ton: '', saeulen: [] });
    const e = saeubereEinstellung({ saeulen: [{ id: '<script>', name: 'Führung & Übergabe' }, { name: 'Führung & Übergabe' }] });
    expect(e.saeulen[0].id).toBe('fuehrung-uebergabe');
    expect(e.saeulen[1].id).not.toBe(e.saeulen[0].id);
  });
});

describe('Redaktionsplan', () => {
  it('Woche Mo–So und Monat um heute; Beiträge ohne Datum stehen immer drin', () => {
    expect(kalenderwoche(HEUTE)).toBe(39);
    expect(kalenderwoche('2026-01-01')).toBe(1);
    expect(planFenster(HEUTE, 'woche')).toMatchObject({ von: '2026-09-21', bis: '2026-09-27' });
    expect(planFenster(HEUTE, 'woche', 1)).toMatchObject({ von: '2026-09-28', bis: '2026-10-04' });
    expect(planFenster(HEUTE, 'monat', 4)).toMatchObject({ von: '2027-01-01', bis: '2027-01-31', label: 'Januar 2027' });
    const f = planFenster(HEUTE, 'woche');
    expect(imFenster({ datum: '2026-09-27' }, f)).toBe(true);
    expect(imFenster({ datum: '2026-09-28' }, f)).toBe(false);
    expect(imFenster({}, f)).toBe(true);
  });
  it('Stimme der Kunden → Idee mit Quelle, ohne Kundennamen im Text; Gesperrte fehlen', () => {
    const l = [
      k('a', { vorname: 'Anna', aktivitaeten: [{ am: '2026-09-20T10:00:00Z', art: 'gespraech', von: 'kevin', notiz: { bedarf: 'Nachfolge  ungeklärt' } }] }),
      k('s', { werbesperre: { seit: HEUTE, grund: 'x' }, aktivitaeten: [{ am: '2026-09-21T10:00:00Z', art: 'gespraech', von: 'kevin', notiz: { bedarf: 'geheim' } }] }),
    ];
    const st = stimmenAus(l);
    expect(st).toEqual([{ kontaktId: 'c-a', name: 'Anna Test', am: '2026-09-20', bedarf: 'Nachfolge  ungeklärt' }]);
    const idee = ideeAusStimme(st[0], 'bt-1', HEUTE);
    expect(idee).toMatchObject({ titel: 'Nachfolge ungeklärt', status: 'idee', quellen: ['c-a'] });
    expect(idee.text).not.toContain('Anna');
    expect(schonUebernommen(st[0], [idee])).toBe(true);
    expect(schonUebernommen(st[0], [])).toBe(false);
  });
});
