// CRM-Fundament: Pipeline aus KEMARIS Operations, Kanal-Ampel (§ 7 UWG), Power Hour, Mandate, Events.
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import { gesamtwert, gesundheit, prognose, wechsleStufe, gewinnquote } from '../lib/crm/pipeline';
import { kanalStatus, besterKanal, art14 } from '../lib/crm/recht';
import { werIstDran, folgeAus, werktagePlus } from '../lib/crm/heute';
import { mandatLage, planpostenAus, mrr, konzentration } from '../lib/crm/kunden';
import { eventZahlen, followUpBis } from '../lib/crm/events';
import { leererBestand, wendeCrmAn, kundenAusMandaten } from '../lib/crm/speicher';
import { dubletten, zusammenfuehren, verweiseUmbiegen } from '../lib/crm/dubletten';
import { sauberRolle, ausBrain } from '../lib/crm/umzug';
import type { Chance, Mandat } from '../lib/crm/typen';

const HEUTE = '2026-09-24'; // Donnerstag
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const ch = (x: Partial<Chance> = {}): Chance => ({
  id: 'ch-1', titel: 'Retainer', kontaktIds: ['c-a'], art: 'retainer', wert: { betrag: 3000, basis: 'monat', laufzeitMonate: 6 }, stufe: 'angebot',
  historie: [{ stufe: 'angebot', am: '2026-09-20', von: 'kevin' }], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'kdc', besitzer: 'kevin', angelegt: '2026-09-01', geaendert: '2026-09-20', naechsterSchritt: { text: 'Angebot nachfassen', datum: '2026-09-30' }, ...x,
});
const md = (x: Partial<Mandat> = {}): Mandat => ({
  id: 'm-1', kunde: 'Beispiel GmbH', kontaktIds: ['c-a'], titel: 'Beratung', art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-08-01', verlaengerung: 'manuell', honorar: { betrag: 3000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
  ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: HEUTE, ...x,
});

describe('Pipeline (aus KEMARIS Operations)', () => {
  it('Wert je Basis: Monat × Laufzeit, Jahr, einmalig', () => {
    expect(gesamtwert(ch())).toBe(18000);
    expect(gesamtwert(ch({ wert: { betrag: 3000, basis: 'monat' } }))).toBe(36000);
    expect(gesamtwert(ch({ wert: { betrag: 5000, basis: 'einmalig' } }))).toBe(5000);
  });
  it('Ampel: überfälliger Schritt oder > 30 Tage still → rot; ohne Schritt → gelb', () => {
    expect(gesundheit(ch({ naechsterSchritt: { text: 'x', datum: '2026-09-20' } }), HEUTE).ampel).toBe('rot');
    expect(gesundheit(ch({ historie: [{ stufe: 'angebot', am: '2026-08-01', von: 'k' }] }), HEUTE).ampel).toBe('rot');
    expect(gesundheit(ch({ naechsterSchritt: undefined }), HEUTE).ampel).toBe('gelb');
    expect(gesundheit(ch(), HEUTE).ampel).toBe('gruen');
  });
  it('verloren braucht Grund, geparkt braucht Wiedervorlage, Historie wächst', () => {
    expect(wechsleStufe(ch(), 'verloren', 'kevin', `${HEUTE}T10:00`).ok).toBe(false);
    expect(wechsleStufe(ch(), 'geparkt', 'kevin', `${HEUTE}T10:00`).ok).toBe(false);
    const r = wechsleStufe(ch(), 'abschluss', 'malin', `${HEUTE}T10:00`);
    expect(r.ok && r.chance.historie.map(h => h.stufe)).toEqual(['angebot', 'abschluss']);
  });
  it('Prognose: gewichtet, Commit (Abschluss), Best Case (ab Angebot)', () => {
    const p = prognose([ch(), ch({ id: 'ch-2', stufe: 'abschluss', wert: { betrag: 10000, basis: 'einmalig' } }), ch({ id: 'ch-3', stufe: 'gewonnen' })], HEUTE);
    expect(p.offen).toBe(28000);
    expect(p.gewichtet).toBe(Math.round(18000 * 0.75) + 9000);
    expect(p.commit).toBe(10000);
    expect(p.bestCase).toBe(28000);
  });
  it('Gewinnquote erst ab 10 Entscheidungen', () => {
    expect(gewinnquote([ch({ stufe: 'gewonnen' })]).quote).toBeNull();
  });
});

describe('Kanal-Ampel (§ 7 UWG)', () => {
  it('kalter Lead: Mail/LinkedIn/Telefon rot, Vernetzen grün', () => {
    const x = k('a', { email: 'a@b.de', telefon: '030', linkedin: 'https://linkedin.com/in/a' });
    expect(kanalStatus(x, 'mail').farbe).toBe('rot');
    expect(kanalStatus(x, 'linkedin').farbe).toBe('rot');
    expect(kanalStatus(x, 'telefon').farbe).toBe('rot');
    expect(besterKanal(x)?.kanal).toBe('vernetzen');
  });
  it('Einwilligung macht grün, Widerruf wieder rot, Werbesperre sperrt alles', () => {
    const e = { kanal: 'mail' as const, grundlage: 'einwilligung' as const, erteiltAm: '2026-09-01', nachweis: 'DOI' };
    expect(kanalStatus(k('a', { email: 'a@b.de', einwilligungen: [e] }), 'mail').farbe).toBe('gruen');
    expect(kanalStatus(k('a', { email: 'a@b.de', einwilligungen: [{ ...e, widerrufenAm: '2026-09-10' }] }), 'mail').farbe).toBe('rot');
    expect(kanalStatus(k('a', { email: 'a@b.de', einwilligungen: [e], werbesperre: { seit: '2026-09-11', grund: 'Widerspruch' } }), 'mail').farbe).toBe('rot');
  });
  it('Bestandskunde: Mail grün; persönlich bekannt: Telefon gelb (mutmaßlich)', () => {
    expect(kanalStatus(k('a', { email: 'a@b.de' }), 'mail', { hatMandat: true }).grundlage).toBe('bestandskunde_7_3');
    expect(kanalStatus(k('a', { telefon: '030', kreis: 'A' }), 'telefon').farbe).toBe('gelb');
  });
  it('Art.-14-Uhr ab Tag 25', () => {
    expect(art14(k('a', { fremddaten: true, importiertAm: '2026-08-28' }), HEUTE)).toEqual({ tage: 27, faellig: true });
    expect(art14(k('a', { fremddaten: true, importiertAm: '2026-08-28', art14InformiertAm: '2026-09-01' }), HEUTE)).toBeNull();
  });
});

describe('Wer ist heute dran (Power Hour)', () => {
  it('Versprechen vor Signalen vor Chancen vor Pflege vor Neu; Sperre und Kaltkontakte fliegen raus', () => {
    const kontakte = [
      k('neu', { prio: 'A', aufhaenger: 'Podcast', linkedin: 'https://l/x' }),
      k('pflege', { kreis: 'A', telefon: '030', letzterKontakt: '2026-07-01' }),
      k('chance', { telefon: '030', stufe: 'gespraech' }),
      k('antwort', { email: 'x@y.de', kreis: 'B', letzterKontakt: '2026-09-23', aktivitaeten: [{ am: '2026-09-23T09:00', art: 'antwort', von: 'kevin' }] }),
      k('wv', { telefon: '030', kreis: 'B', wiedervorlage: '2026-09-22' }),
      k('gesperrt', { telefon: '030', kreis: 'A', wiedervorlage: '2026-09-20', werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } }),
      k('kalt', { prio: 'A', aufhaenger: 'x', telefon: '030' }),
    ];
    const crm = { ...leererBestand(), chancen: [ch({ kontaktIds: ['c-chance'], naechsterSchritt: { text: 'Angebot nachfassen', datum: '2026-09-23' } })] };
    const a = werIstDran(kontakte, crm, HEUTE, 'kevin');
    expect(a.karten.map(x => `${x.kategorie}:${x.kontakt.vorname}`)).toEqual(['versprechen:wv', 'signale:antwort', 'chancen:chance', 'pflege:pflege', 'neu:neu']);
    expect(a.ausgefiltert.sperre).toBe(1);
    expect(a.ausgefiltert.ohneKanal).toBe(1);
  });
  it('Ergebnis-Knöpfe setzen den nächsten Schritt (Werktage)', () => {
    expect(werktagePlus(HEUTE, 2)).toBe('2026-09-28'); // Do + 2 Werktage = Mo
    expect(folgeAus('mailbox', HEUTE, 'angesprochen').wiedervorlage).toBe('2026-09-29');
    expect(folgeAus('sperre', HEUTE, 'neu').werbesperre).toBe(true);
  });
});

describe('Kunden & Mandate', () => {
  it('Laufzeitende, Frist, Health (nur bewertete Faktoren)', () => {
    const l = mandatLage(md({ ende: '2026-11-15', kuendigungsfristTage: 30, health: { beteiligung: 80, umsetzung: 60, wirkung: null, zahlung: 100, stimmung: null } }), HEUTE);
    expect(l.endeIn).toBe(52);
    expect(l.fristBis).toBe('2026-10-16');
    expect(l.health).toBe(Math.round((80 * 25 + 60 * 25 + 100 * 10) / 60));
    expect(l.ampel).toBe('rot'); // endet in ≤ 60 Tagen ohne Verlängerung
  });
  it('Planposten: brutto, Eingang nach Zahlungsziel, Reverse Charge ohne USt', () => {
    expect(planpostenAus(md(), HEUTE)).toMatchObject({ betrag: 3570, rhythmus: 'monatlich', ab: '2026-09-15', sicher: true, kategorie: 'mandat', firmaId: 'kdc' });
    expect(planpostenAus(md({ ustSatz: 0, status: 'verhandlung', vertragUnterschrieben: false }), HEUTE)).toMatchObject({ betrag: 3000, sicher: false, wahrscheinlich: 50 });
  });
  it('MRR und Kundenkonzentration', () => {
    const l = [md(), md({ id: 'm-2', kunde: 'Zwei AG', honorar: { betrag: 1000, basis: 'monat', netto: true } })];
    expect(mrr(l)).toBe(4000);
    expect(konzentration(l)).toEqual({ kunde: 'Beispiel GmbH', anteil: 75 });
  });
});

describe('Events', () => {
  it('Nachfassen binnen 48 h, Zusage und Erscheinen getrennt, Folgegespräche', () => {
    const e = { id: 'ev-1', titel: 'Stammtisch', format: 'stammtisch' as const, ziel: 'drei Folgegespräche mit Inhabern', datum: '2026-09-10', status: 'durchgefuehrt' as const, geaendert: HEUTE, kostenEuro: 300 };
    expect(followUpBis(e)).toBe('2026-09-12');
    const t = [
      { id: 't1', eventId: 'ev-1', kontaktId: 'c-a', status: 'da' as const, followUpAm: '2026-09-11', geaendert: HEUTE },
      { id: 't2', eventId: 'ev-1', kontaktId: 'c-b', status: 'da' as const, geaendert: HEUTE },
      { id: 't3', eventId: 'ev-1', kontaktId: 'c-c', status: 'no_show' as const, geaendert: HEUTE },
    ];
    const z = eventZahlen(e, t, [k('a', { aktivitaeten: [{ am: '2026-09-15T10:00', art: 'gespraech', von: 'kevin' }] })], []);
    expect(z).toMatchObject({ zugesagt: 3, da: 2, noShow: 1, nachgefasst: 1, nachfassenOffen: 1, folgegespraeche: 1, kostenJeFolgegespraech: 300, erscheinquote: null });
  });
});

describe('Speicher', () => {
  it('Einzeländerungen säubern je Liste — Unbekanntes fällt weg', () => {
    const r = wendeCrmAn(leererBestand(), [
      { liste: 'chancen', op: 'upsert', eintrag: { id: 'ch-x', titel: 'Neu', stufe: 'quatsch', wert: { betrag: '3000', basis: 'monat' }, boese: 'x' } },
      { liste: 'mandate', op: 'upsert', eintrag: { id: 'BÖSE ID', kunde: 'x', titel: 'y' } },
    ], `${HEUTE}T10:00`, 'kevin');
    expect(r.angewandt).toBe(1);
    expect(r.bestand.chancen[0]).toMatchObject({ stufe: 'qualifiziert', wert: { betrag: 3000, basis: 'monat' }, besitzer: 'kevin' });
    expect('boese' in r.bestand.chancen[0]).toBe(false);
  });
});

describe('Dubletten', () => {
  it('gleicher Name + gleiche Firma = Dublette; nur gleicher Name nicht', () => {
    const a = k('a', { vorname: 'Tim', nachname: 'Jeske', firma: 'ReachOut', email: 'tim@r.app' });
    const b = k('b', { vorname: 'Tim', nachname: 'Jeske', firma: 'ReachOut', email: 'tim.jeske@r.app', aktivitaeten: [{ am: '2026-09-01T10:00', art: 'mail', von: 'kevin' }], werbesperre: { seit: '2026-09-02', grund: 'Widerspruch' } });
    const c = k('c', { vorname: 'Tim', nachname: 'Jeske', firma: 'Andere GmbH' });
    expect(dubletten([a, b, c]).map(([x, y]) => `${x.id}|${y.id}`)).toEqual(['c-a|c-b']);
    const m = zusammenfuehren(a, b, 'kevin', `${HEUTE}T10:00:00Z`);
    expect(m.werbesperre?.grund).toBe('Widerspruch');
    expect(m.aktivitaeten.length).toBe(2);
    expect(m.notiz).toContain('tim.jeske@r.app');
    const crm = verweiseUmbiegen({ ...leererBestand(), chancen: [ch({ kontaktIds: ['c-b', 'c-a'] })] }, 'c-b', 'c-a');
    expect(crm.chancen[0].kontaktIds).toEqual(['c-a']);
  });
});

describe('Übernahme aus dem Brain', () => {
  it('Rolle ohne Quellenvermerke, Kunden als Kartei-Einträge, wiederholbar', () => {
    expect(sauberRolle("COO / Chief Growth Officer (OneBanking_Brain 17.09.) — Malins Punkte nennen ihn CEO")).toBe('COO / Chief Growth Officer');
    expect(sauberRolle('Chief Partnership Officer laut OneBanking_Brain; extern')).toBe('Chief Partnership Officer');
    const d = { kunden: [{ name: 'Beispiel GmbH', ansprechpartner: [{ name: "Max Muster ('Maxi')", rolle: 'Geschäftsführer' }], status: 'aktiv' }], mandate: [{ kunde: 'Beispiel GmbH', titel: 'Retainer', art: 'retainer', honorar: { betrag: 2000, einheit: 'Monat', netto: true }, status: 'aktiv', offen: ['Laufzeit unklar'] }], produkte: [{ name: 'Klarheits-Sprint', preis: { betrag: 0, einheit: 'einmalig' } }] };
    const r1 = ausBrain(d, leererBestand(), [], HEUTE, `${HEUTE}T10:00`, 'kevin');
    expect(r1.kontakte[0]).toMatchObject({ vorname: 'Max', nachname: 'Muster', lebensphase: 'kunde', kreis: 'A', position: 'Geschäftsführer' });
    expect(r1.bestand.mandate[0]).toMatchObject({ kontaktIds: [r1.kontakte[0].id], honorar: { betrag: 2000, basis: 'monat' }, offen: ['Laufzeit unklar'] });
    expect(r1.bestand.leistungen[0]).toMatchObject({ typ: 'sprint', status: 'entwurf' });
    const r2 = ausBrain(d, r1.bestand, r1.kontakte, HEUTE, `${HEUTE}T11:00`, 'kevin');
    expect(r2.neu).toEqual({ mandate: 0, leistungen: 0, kontakte: 0 });
    expect(kundenAusMandaten(r2.bestand).kunden).toEqual([{ name: 'Beispiel GmbH', status: 'aktiv', cashflow: 2000 }]);
  });
});
