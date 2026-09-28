// ─── Reiter „Umsatz“: Zuordnung, Kennzahlen, Angebote, Zahlungsdaten (28.09.) ──
// Erfundene Firmen, Personen und Beträge. Die IBAN wird zur Laufzeit aus einer erfundenen Kontonummer gerechnet
// (tests/repo-sauber.test.ts: keine IBAN im Klartext in versionierten Dateien).
import { describe, it, expect } from 'vitest';
import { umsatzBezug, umsatzKennzahlen, angeboteListe, ablageFilter, kundenName, OHNE_EINHEIT, type UmsatzRechnung } from '@/lib/crm/umsatz';
import { zahlungSaeubern, ibanGueltig, ibanMaskiert, zahlungFuerAnzeige, zahlungOhneIban, zahlungsQuelle, zahlungLuecken } from '@/lib/crm/zahlung';
import { saeubern } from '@/lib/crm/speicher';
import { saeubereKontakt } from '@/lib/make-one/crm';
import { dateinameSaeubern, typErkennen, metaSaeubern, eintraegeFuer, hatBezug, type DateiEintrag } from '@/lib/dateien/regeln';
import type { Chance, CrmBestand, Firma, Mandat } from '@/lib/crm/typen';

const HEUTE = '2026-09-28';
/** DE + Prüfziffer (ISO 13616) + erfundene 18-stellige BBAN. */
const mod97 = (ziffern: string) => Array.from(ziffern).reduce((r, z) => (r * 10 + Number(z)) % 97, 0);
const mitPruefziffer = (bban: string) => `DE${String(98 - mod97(`${bban}131400`)).padStart(2, '0')}${bban}`;
const IBAN = mitPruefziffer('120300009876543210');
const gruppiert = (i: string) => i.replace(/(.{4})/g, '$1 ').trim();
const MASKE = `${IBAN.slice(0, 4)} •••• •••• ${IBAN.slice(-4)}`;

const firma = (id: string, name: string): Firma => ({ id, name, rolle: 'kunde', geaendert: HEUTE });
const mandat = (id: string, x: Partial<Mandat>): Mandat => ({
  id, kunde: 'Beispiel Werke GmbH', kontaktIds: [], titel: `Mandat ${id}`, art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true,
  verlaengerung: 'auto', honorar: { betrag: 2000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
  ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: HEUTE, ...x,
});
const deal = (id: string, x: Partial<Chance>): Chance => ({
  id, titel: `Deal ${id}`, kontaktIds: [], art: 'projekt', wert: { betrag: 5000, basis: 'einmalig' }, stufe: 'bedarf', historie: [],
  qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'kdv', besitzer: 'kevin', angelegt: HEUTE, geaendert: HEUTE, ...x,
});
const rechnung = (id: string, x: Partial<UmsatzRechnung>): UmsatzRechnung => ({ id, kunde: 'Beispiel Werke GmbH', titel: `Leistung ${id}`, betrag: 1000, status: 'gestellt', ...x });

const crm: Pick<CrmBestand, 'firmen' | 'chancen' | 'mandate'> = {
  firmen: [firma('f-beispiel', 'Beispiel Werke GmbH'), firma('f-andere', 'Andere Muster AG')],
  mandate: [
    mandat('m-eins', { firmaId: 'f-beispiel', gesellschaft: 'kdc' }),
    mandat('m-zwei', { kontaktIds: ['c-person-anna'], kunde: 'Irgendwo', gesellschaft: 'kdv', honorar: { betrag: 500, basis: 'monat', netto: true } }),
    mandat('m-fremd', { firmaId: 'f-andere', kunde: 'Andere Muster AG' }),
    mandat('m-alt', { firmaId: 'f-beispiel', status: 'beendet' }),
  ],
  chancen: [
    deal('ch-a', { firmaId: 'f-beispiel', stufe: 'gewonnen', wert: { betrag: 12000, basis: 'einmalig' }, historie: [{ stufe: 'angebot', am: '2026-05-02T10:00:00Z', von: 'kevin' }, { stufe: 'gewonnen', am: '2026-06-01T10:00:00Z', von: 'kevin' }] }),
    deal('ch-b', { kontaktIds: ['c-person-anna'], stufe: 'angebot', historie: [{ stufe: 'angebot', am: '2026-09-20T10:00:00Z', von: 'kevin' }] }),
    deal('ch-c', { firmaId: 'f-andere', stufe: 'angebot' }),
    deal('ch-d', { firma: 'Beispiel Werke GmbH', stufe: 'verloren', historie: [{ stufe: 'abschluss', am: '2026-04-01T10:00:00Z', von: 'kevin' }] }),
  ],
};
const anna = { id: 'c-person-anna', firmaId: 'f-beispiel', vorname: 'Anna', nachname: 'Probe' };

const rechnungen: UmsatzRechnung[] = [
  rechnung('r-1', { mandatId: 'm-eins', status: 'bezahlt', betrag: 2380, datum: '2025-11-01', faellig: '2025-11-15', bezahltAm: '2025-11-20', firmaId: 'kdc' }),
  rechnung('r-2', { mandatId: 'm-zwei', status: 'bezahlt', betrag: 595, faellig: '2026-03-10', bezahltAm: '2026-03-08', firmaId: 'kdv' }),
  rechnung('r-3', { mandatId: 'm-eins', status: 'gestellt', betrag: 2380, faellig: '2026-09-01' }),
  rechnung('r-4', { status: 'gestellt', betrag: 700, faellig: '2026-10-15', kunde: 'Beispiel Werke' }),
  rechnung('r-5', { mandatId: 'm-fremd', status: 'bezahlt', betrag: 9999, kunde: 'Beispiel Werke GmbH' }),
  rechnung('r-6', { status: 'bezahlt', betrag: 111, kunde: 'Andere Muster AG' }),
  rechnung('r-7', { status: 'geplant', betrag: 300, angebot: 'A-7', angebotAm: '2026-09-10', kunde: 'Beispiel Werke GmbH' }),
  rechnung('r-8', { status: 'bezahlt', betrag: 50, kunde: 'Beispiel Werke GmbH', firmaId: 'privat' }),
];

describe('Zuordnung', () => {
  const b = umsatzBezug(anna, crm, rechnungen, HEUTE);
  it('Mandate und Deals: eigene (kontaktIds) + die der Firma (Kennung, Name als Rückfall), keine fremden', () => {
    expect(b.firma?.id).toBe('f-beispiel');
    expect(b.mandate.map(m => m.id).sort()).toEqual(['m-alt', 'm-eins', 'm-zwei']);
    expect(b.deals.map(c => c.id).sort()).toEqual(['ch-a', 'ch-b', 'ch-d']);
  });
  it('Rechnungen über mandatId, sonst per Name mit Hinweis; fremdes Mandat und Privates nie', () => {
    const ids = b.rechnungen.map(z => z.r.id).sort();
    expect(ids).toEqual(['r-1', 'r-2', 'r-3', 'r-4', 'r-7']);
    expect(b.rechnungen.find(z => z.r.id === 'r-1')!.perName).toBe(false);
    expect(b.rechnungen.find(z => z.r.id === 'r-4')!.perName).toBe(true);
    expect(b.rechnungen.find(z => z.r.id === 'r-3')!.ueberfaellig).toBe(true);
    expect(b.rechnungen.find(z => z.r.id === 'r-1')!.verzugTage).toBe(5);
    expect(b.rechnungen.find(z => z.r.id === 'r-2')!.verzugTage).toBe(-2);
  });
  it('Person ohne Firma: nur eigene Mandate/Deals; Rechnungen per Personenname', () => {
    const solo = { id: 'c-solo-bert', vorname: 'Bert', nachname: 'Beispielmann' };
    const r = umsatzBezug(solo, crm, [rechnung('r-x', { kunde: 'Bert Beispielmann', status: 'bezahlt', betrag: 80 }), rechnung('r-y', { kunde: 'Jemand Anders' })], HEUTE);
    expect(r.firma).toBeUndefined();
    expect(r.mandate).toEqual([]);
    expect(r.rechnungen.map(z => z.r.id)).toEqual(['r-x']);
    expect(kundenName(solo)).toBe('Bert Beispielmann');
  });
  it('kurze Namen („SAP“) passen über den genauen Namen', () => {
    const c = { ...crm, firmen: [firma('f-sap', 'SAP')] };
    const r = umsatzBezug({ id: 'c-x-yz', firmaId: 'f-sap' }, c, [rechnung('r-s', { kunde: 'sap' })], HEUTE);
    expect(r.rechnungen).toHaveLength(1);
  });
});

describe('Kennzahlen', () => {
  const kz = umsatzKennzahlen(umsatzBezug(anna, crm, rechnungen, HEUTE));
  it('bezahlt, offen, überfällig, geplant, Monatswert, gewonnene Deals', () => {
    expect(kz.bezahlt).toBe(2380 + 595);
    expect(kz.offen).toBe(2380 + 700);
    expect(kz.ueberfaellig).toBe(2380);
    expect(kz.anzahlUeberfaellig).toBe(1);
    expect(kz.geplant).toBe(300);
    expect(kz.monatswert).toBe(2500);
    expect(kz.aktiveMandate).toBe(2);
    expect(kz.gewonneneDeals).toBe(1);
    expect(kz.gewonnenWert).toBe(12000);
    expect(kz.perName).toBe(2);
    expect(kz.verzugSchnitt).toBe(2);
  });
  it('je Einheit (aus Mandat, sonst Firma der Rechnung) und je Jahr', () => {
    const e = Object.fromEntries(kz.jeEinheit.map(x => [x.einheit, x]));
    expect(e['Selbstständigkeit']).toEqual({ einheit: 'Selbstständigkeit', bezahlt: 2380, offen: 2380 });
    expect(e['KD Ventures']).toEqual({ einheit: 'KD Ventures', bezahlt: 595, offen: 0 });
    expect(e[OHNE_EINHEIT]).toEqual({ einheit: OHNE_EINHEIT, bezahlt: 0, offen: 700 });
    expect(kz.jeJahr).toEqual([{ jahr: '2025', bezahlt: 2380 }, { jahr: '2026', bezahlt: 595 }]);
  });
});

describe('Angebote aus drei Quellen', () => {
  const b = umsatzBezug(anna, crm, rechnungen, HEUTE);
  const eintrag: DateiEintrag = { id: 'd-test-0001', art: 'angebot', titel: 'Workshop', kontaktId: anna.id, angebot: { status: 'abgelehnt', nummer: 'A-9', betrag: 800, datum: '2026-09-25' }, hochgeladenAm: '2026-09-25T10:00:00Z', hochgeladenVon: 'kevin' };
  it('Rechnung mit Angebot, Deals in/nach Angebot, Ablage — mit Status', () => {
    const l = angeboteListe(b, [eintrag]);
    const nach = Object.fromEntries(l.map(a => [a.schluessel, a]));
    expect(nach['r:r-7']).toMatchObject({ quelle: 'rechnung', nummer: 'A-7', status: 'offen' });
    expect(nach['c:ch-b']).toMatchObject({ quelle: 'deal', status: 'offen', datum: '2026-09-20' });
    expect(nach['c:ch-a']).toMatchObject({ status: 'angenommen' });
    expect(nach['c:ch-d']).toMatchObject({ status: 'abgelehnt' });
    expect(nach['d:d-test-0001']).toMatchObject({ quelle: 'ablage', status: 'abgelehnt', betrag: 800 });
    expect(nach['c:ch-d'].datum).toBe('2026-04-01');
    expect(l.map(a => a.datum)).toEqual([...l.map(a => a.datum)].sort().reverse());
  });
  it('Ablage-Eintrag mit Rechnungs- oder Deal-Bezug ersetzt die abgeleitete Zeile', () => {
    const l = angeboteListe(b, [{ ...eintrag, rechnungId: 'r-7' }, { ...eintrag, id: 'd-test-0002', dealId: 'ch-b' }]);
    expect(l.some(a => a.schluessel === 'r:r-7')).toBe(false);
    expect(l.some(a => a.schluessel === 'c:ch-b')).toBe(false);
  });
  it('Filter für die Ablage trägt Kontakt, Firma, Mandate, Deals, Rechnungen', () => {
    expect(ablageFilter(anna, b)).toMatchObject({ kontaktId: anna.id, firmaId: 'f-beispiel', mandatIds: expect.arrayContaining(['m-eins']), dealIds: expect.arrayContaining(['ch-a']), rechnungIds: expect.arrayContaining(['r-4']) });
  });
});

describe('Zahlungsdaten', () => {
  it('IBAN: Prüfziffer, Maske zeigt nie die Mitte', () => {
    expect(ibanGueltig(IBAN)).toBe(true);
    expect(ibanGueltig(gruppiert(IBAN))).toBe(true);
    expect(ibanGueltig(`${IBAN.slice(0, -1)}${(Number(IBAN.slice(-1)) + 1) % 10}`)).toBe(false);
    const m = ibanMaskiert(IBAN)!;
    expect(m).toBe(MASKE);
    expect(m).not.toContain(IBAN.slice(8, 16));
  });
  it('Säuberung: falsche IBAN fällt weg, SEPA-Daten nur bei SEPA, Link nur https, Ziel begrenzt', () => {
    const z = zahlungSaeubern({ weg: 'sepa', zielTage: '999', iban: gruppiert(IBAN).toLowerCase(), sepa: { mandatsreferenz: 'M-1', datum: '2026-01-02' }, link: 'javascript:alert(1)', empfaenger: { email: 'Rechnung@Beispiel.invalid', name: '  Buchhaltung ' }, ustId: 'de 123456789', unbekannt: 1 })!;
    expect(z).toEqual({ weg: 'sepa', zielTage: 180, iban: IBAN, sepa: { mandatsreferenz: 'M-1', datum: '2026-01-02' }, empfaenger: { name: 'Buchhaltung', email: 'rechnung@beispiel.invalid' }, ustId: 'DE123456789' });
    expect(zahlungSaeubern({ weg: 'ueberweisung', iban: 'DE00123', sepa: { mandatsreferenz: 'x' } })).toEqual({ weg: 'ueberweisung' });
    expect(zahlungSaeubern({})).toBeUndefined();
    expect(zahlungSaeubern('quatsch')).toBeUndefined();
  });
  it('Anzeige maskiert, Weg nach draußen ohne IBAN', () => {
    const z = zahlungSaeubern({ weg: 'sepa', iban: IBAN })!;
    expect(JSON.stringify(zahlungFuerAnzeige(z))).not.toContain(IBAN);
    expect(zahlungFuerAnzeige(z)!.ibanMaskiert).toBe(MASKE);
    expect(zahlungOhneIban(z)).toEqual({ weg: 'sepa' });
    expect(zahlungLuecken(z)).toContain('SEPA-Mandat (IBAN, Referenz, Datum)');
  });
  it('Quelle: Firma, wenn es eine gibt — sonst die Person', () => {
    expect(zahlungsQuelle({ firmaId: 'f-beispiel' }, { id: 'f-beispiel' })).toBe('firma');
    expect(zahlungsQuelle({ firmaId: 'f-weg' }, undefined)).toBe('kontakt');
    expect(zahlungsQuelle({}, undefined)).toBe('kontakt');
  });
  it('Firma und Kontakt tragen `zahlung` gesäubert durch den Speicher', () => {
    const f = saeubern('firmen', { id: 'f-beispiel', name: 'Beispiel', zahlung: { weg: 'bar', zielTage: 7, iban: 'falsch' } }, HEUTE, 'kevin') as unknown as Firma;
    expect(f.zahlung).toEqual({ weg: 'bar', zielTage: 7 });
    const ohne = saeubern('firmen', { id: 'f-beispiel', name: 'Beispiel', zahlung: {} }, HEUTE, 'kevin') as unknown as Firma;
    expect('zahlung' in ohne).toBe(false);
    const k = saeubereKontakt({ id: 'c-person-bert', vorname: 'Bert', stufe: 'neu', zahlung: { weg: 'ueberweisung', iban: IBAN } })!;
    expect(k.zahlung).toEqual({ weg: 'ueberweisung', iban: IBAN });
  });
});

describe('Dateiablage — reine Regeln', () => {
  it('Dateiname: kein Pfad, keine Steuer-/Sonderzeichen, Endung bleibt', () => {
    expect(dateinameSaeubern('../../etc/passwd.pdf')).toBe('passwd.pdf');
    expect(dateinameSaeubern('C:\\Users\\x\\Vertrag "2026";.pdf')).toBe('Vertrag 2026.pdf');
    expect(dateinameSaeubern('\u0000\u0007.pdf')).toBe('datei.pdf');
    expect(dateinameSaeubern('Angebot Müller.DOCX')).toBe('Angebot Müller.docx');
  });
  it('Typ am Inhalt, passend zur Endung', () => {
    const pdf = new TextEncoder().encode('%PDF-1.7 …');
    expect(typErkennen('a.pdf', pdf)).toBe('application/pdf');
    expect(typErkennen('a.png', pdf)).toBeNull();
    expect(typErkennen('a.exe', pdf)).toBeNull();
    expect(typErkennen('a.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(typErkennen('a.docx', new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toMatch(/wordprocessingml/);
  });
  it('Metadaten: Art, Bezüge nur mit sauberen Kennungen, Vertrag/Angebot nur zur Art', () => {
    const m = metaSaeubern({ art: 'vertrag', kontaktId: 'c-ok-1', mandatId: '../x', vertrag: { vertragsart: 'av', von: '2026-01-01', bis: 'morgen' }, angebot: { status: 'angenommen' } });
    expect(m).toEqual({ art: 'vertrag', kontaktId: 'c-ok-1', vertrag: { vertragsart: 'av', von: '2026-01-01' } });
    expect(hatBezug(metaSaeubern({ art: 'sonstig' }))).toBe(false);
  });
  it('Filter je Kontakt', () => {
    const e = (id: string, x: Partial<DateiEintrag>): DateiEintrag => ({ id, art: 'sonstig', hochgeladenAm: id, hochgeladenVon: 'kevin', ...x });
    const l = [e('d-1111', { kontaktId: 'c-a' }), e('d-2222', { firmaId: 'f-b' }), e('d-3333', { mandatId: 'm-1' }), e('d-4444', { kontaktId: 'c-z' })];
    expect(eintraegeFuer(l, { kontaktId: 'c-a', firmaId: 'f-b', mandatIds: ['m-1'] }).map(x => x.id)).toEqual(['d-3333', 'd-2222', 'd-1111']);
  });
});
