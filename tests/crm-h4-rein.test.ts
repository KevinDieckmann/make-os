// ─── Paket H4 (28.09.) — reine Regeln: Löschmarken, Meeting-Zeitpunkt, IBAN-Maskierung ──
// Erfundene Daten; die IBAN wird zur Laufzeit gerechnet (tests/repo-sauber.test.ts).
import { describe, it, expect } from 'vitest';
import { aktivitaetMarke, markenSaeubern, markenMit, ohneMarkierte, istMarke, grundAnker, MARKEN_MAX } from '../lib/crm/aktivitaet-marke';
import { kontaktVereinen, saeubereKontakt, wannSaeubern, ortSaeubern, fuerPerson, wendeAktivitaetAn, type Aktivitaet, type Kontakt } from '../lib/make-one/crm';
import { aufbereiten, meetingVon, meetingWann, meetingText, ankerListe, gruppieren } from '../lib/crm/aktivitaeten';
import { zahlungMaskiert, zahlungZusammenfuehren, ibanBehalten, maskiereIban } from '../lib/crm/zahlung';

const HEUTE = '2026-09-28';
const JETZT = '2026-09-28T10:00:00.000Z';
const mod97 = (ziffern: string) => Array.from(ziffern).reduce((r, z) => (r * 10 + Number(z)) % 97, 0);
const mitPruefziffer = (bban: string) => `DE${String(98 - mod97(`${bban}131400`)).padStart(2, '0')}${bban}`;
const IBAN = mitPruefziffer('120300009876543210');
const IBAN_NEU = mitPruefziffer('500105170123456789');
const k = (x: Partial<Kontakt> = {}): Kontakt => ({ id: 'c-anna', vorname: 'Anna', nachname: 'Test', eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: HEUTE, geaendertAm: HEUTE, ...x });
const n = (am: string, text: string, von = 'kevin'): Aktivitaet => ({ am, art: 'notiz', text, von });

describe('Löschmarken', () => {
  const a = n('2026-09-20T08:00:00.000Z', 'Alt');
  it('treffen genau eine Fassung (Anker + Text)', () => {
    const m = aktivitaetMarke(a);
    expect(istMarke(m)).toBe(true);
    expect(m.startsWith(grundAnker(a))).toBe(true);
    expect(aktivitaetMarke({ ...a, text: 'Neu' })).not.toBe(m);
    expect(ohneMarkierte([a, { ...a, text: 'Neu' }], [m]).map(x => x.text)).toEqual(['Neu']);
    // Der Anker im Reiter bleibt beim Ändern gleich (Text zählt dort nicht).
    expect(ankerListe([a])).toEqual(ankerListe([{ ...a, text: 'Neu' }]));
  });
  it('säubern, begrenzen, ergänzen, zurücknehmen', () => {
    expect(markenSaeubern(['kaputt', aktivitaetMarke(a), aktivitaetMarke(a)])).toEqual([aktivitaetMarke(a)]);
    expect(markenSaeubern('x')).toBeUndefined();
    const viele = Array.from({ length: MARKEN_MAX + 20 }, (_, i) => aktivitaetMarke(n(`2026-01-01T00:00:${String(i % 60).padStart(2, '0')}.${String(i).padStart(3, '0')}Z`, `t${i}`)));
    expect(markenSaeubern(viele)).toHaveLength(MARKEN_MAX);
    expect(markenMit(['akt-a~1'], ['akt-b~2'])).toEqual(['akt-a~1', 'akt-b~2']);
    expect(markenMit(['akt-a~1', 'akt-b~2'], ['akt-c~3'], ['akt-a~1'])).toEqual(['akt-b~2', 'akt-c~3']);
    expect(markenMit(undefined, [], [])).toBeUndefined();
  });
  it('Säuberung wirft markierte Fassungen hinaus', () => {
    const s = saeubereKontakt({ ...k({ aktivitaeten: [a, n('2026-09-21T08:00:00.000Z', 'Bleibt')] }), geloeschteAktivitaeten: [aktivitaetMarke(a)] })!;
    expect(s.aktivitaeten.map(x => x.text)).toEqual(['Bleibt']);
    expect(s.geloeschteAktivitaeten).toEqual([aktivitaetMarke(a)]);
  });
  it('Vereinen: es gelten die gespeicherten Marken — nichts kommt zurück, nichts doppelt', () => {
    const neuFassung = { ...a, text: 'Geändert', bearbeitet: JETZT };
    const alt = k({ aktivitaeten: [neuFassung], geloeschteAktivitaeten: [aktivitaetMarke(a)] });
    // Älterer Stand (ohne Marken) mit der alten Fassung und einer eigenen neuen Aktivität.
    const aelter = k({ aktivitaeten: [a, n('2026-09-25T08:00:00.000Z', 'Neu aus altem Fenster')] });
    const v = kontaktVereinen(aelter, alt);
    expect(v.aktivitaeten.map(x => x.text)).toEqual(['Geändert', 'Neu aus altem Fenster']);
    expect(v.geloeschteAktivitaeten).toEqual([aktivitaetMarke(a)]);
    // Marken aus dem Browser zählen nicht.
    const frech = kontaktVereinen(k({ aktivitaeten: [neuFassung], geloeschteAktivitaeten: [aktivitaetMarke(neuFassung)] }), alt);
    expect(frech.aktivitaeten.map(x => x.text)).toEqual(['Geändert']);
    expect(frech.geloeschteAktivitaeten).toEqual([aktivitaetMarke(a)]);
  });
});

describe('Meeting-Zeitpunkt als Feld', () => {
  it('wann und ort säubern', () => {
    expect(wannSaeubern('2026-10-02')).toBe('2026-10-02');
    expect(wannSaeubern('2026-10-02T14:00')).toBe('2026-10-02T14:00');
    expect(wannSaeubern('2026-10-02T12:00:00.000Z')).toBe('2026-10-02T12:00:00.000Z');
    expect(wannSaeubern('2026-13-45')).toBeUndefined();
    expect(wannSaeubern('morgen')).toBeUndefined();
    expect(ortSaeubern('  Zoom\n Raum 2 ')).toBe('Zoom Raum 2');
    expect(ortSaeubern('   ')).toBeUndefined();
    expect(meetingWann('2026-10-02', '09:30')).toBe('2026-10-02T09:30');
    expect(meetingWann('2026-10-02', '')).toBe('2026-10-02');
  });
  it('wendeAktivitaetAn schreibt wann/ort, die Säuberung behält sie', () => {
    const e = wendeAktivitaetAn(k(), { art: 'termin', text: 'Agenda', von: 'kevin', wann: '2026-10-02T14:00', ort: 'Büro' }, HEUTE, JETZT, (d) => d);
    expect(e.aktivitaeten[0]).toMatchObject({ art: 'termin', text: 'Agenda', wann: '2026-10-02T14:00', ort: 'Büro' });
    expect(saeubereKontakt(e)!.aktivitaeten[0]).toMatchObject({ wann: '2026-10-02T14:00', ort: 'Büro' });
  });
  it('meetingVon: Feld vor Text; Altbestand aus der ersten Textzeile', () => {
    expect(meetingVon({ art: 'termin', wann: '2026-10-02T14:00', ort: 'Büro', text: 'Agenda' })).toEqual({ tag: '2026-10-02', zeit: '14:00', ort: 'Büro', notiz: 'Agenda' });
    expect(meetingVon({ art: 'termin', wann: '2026-10-02' })).toEqual({ tag: '2026-10-02' });
    // UTC-Stempel: in Berliner Zeit (MESZ +2).
    expect(meetingVon({ art: 'termin', wann: '2026-10-02T12:00:00.000Z' })).toMatchObject({ tag: '2026-10-02', zeit: '14:00' });
    expect(meetingVon({ art: 'termin', text: meetingText({ tag: '2026-10-03', zeit: '09:00', ort: 'Zoom', notiz: 'Alt' }) })).toEqual({ tag: '2026-10-03', zeit: '09:00', ort: 'Zoom', notiz: 'Alt' });
    expect(meetingVon({ art: 'notiz', wann: '2026-10-02' })).toBeNull();
  });
  it('Kommend und Sortierung nach wann — gemischt mit Altbestand', () => {
    const verlauf: Aktivitaet[] = [
      { am: '2026-09-01T08:00:00.000Z', art: 'termin', von: 'kevin', wann: '2026-10-05T10:00', text: 'Neu später' },
      { am: '2026-09-02T08:00:00.000Z', art: 'termin', von: 'kevin', text: meetingText({ tag: '2026-10-01', zeit: '09:00' }) },
      { am: '2026-09-03T08:00:00.000Z', art: 'termin', von: 'kevin', wann: '2026-09-10T10:00', text: 'Vorbei' },
    ];
    const l = aufbereiten(k({ aktivitaeten: verlauf }), null, { heute: HEUTE, jetzt: JETZT });
    const g = gruppieren(l);
    expect(g[0].id).toBe('kommend');
    expect(g[0].eintraege.map(e => e.tag)).toEqual(['2026-10-01', '2026-10-05']);
    expect(g[1]).toMatchObject({ id: '2026-09' });
    expect(g[1].eintraege[0]).toMatchObject({ tag: '2026-09-10', zeit: '10:00', text: 'Vorbei', kommend: false });
  });
});

describe('IBAN maskieren', () => {
  it('zahlungMaskiert: Maske + ibanGesetzt; ohne IBAN unverändert', () => {
    expect(zahlungMaskiert({ weg: 'sepa', iban: IBAN })).toEqual({ weg: 'sepa', iban: maskiereIban(IBAN), ibanGesetzt: true });
    expect(zahlungMaskiert({ weg: 'bar' })).toEqual({ weg: 'bar' });
    expect(zahlungMaskiert(undefined)).toBeUndefined();
    // Eine Maske noch einmal maskiert bleibt dieselbe Anzeige.
    expect(maskiereIban(maskiereIban(IBAN))).toBe(maskiereIban(IBAN));
  });
  it('zahlungZusammenfuehren: Maske/leer/kaputt = unverändert, neue gültige ersetzt, Entfernen nur ausdrücklich', () => {
    const alt = { weg: 'sepa' as const, iban: IBAN };
    expect(zahlungZusammenfuehren({ weg: 'sepa', iban: maskiereIban(IBAN), ibanGesetzt: true }, alt)).toEqual({ weg: 'sepa', iban: IBAN });
    expect(zahlungZusammenfuehren({ weg: 'sepa' }, alt)).toEqual({ weg: 'sepa', iban: IBAN });
    expect(zahlungZusammenfuehren({ weg: 'sepa', iban: '' }, alt)).toEqual({ weg: 'sepa', iban: IBAN });
    expect(zahlungZusammenfuehren({ weg: 'sepa', iban: IBAN_NEU }, alt)?.iban).toBe(IBAN_NEU);
    expect(zahlungZusammenfuehren({ weg: 'sepa', ibanEntfernen: true }, alt)).toEqual({ weg: 'sepa' });
    // Neue gültige IBAN gewinnt auch gegen einen alten Entfernen-Merker.
    expect(zahlungZusammenfuehren({ weg: 'sepa', iban: IBAN_NEU, ibanEntfernen: true }, alt)?.iban).toBe(IBAN_NEU);
    expect(zahlungZusammenfuehren(null, alt)).toEqual({ iban: IBAN });
  });
  it('ibanBehalten und fuerPerson', () => {
    expect(ibanBehalten({ weg: 'bar' }, { iban: IBAN })).toEqual({ weg: 'bar', iban: IBAN });
    expect(ibanBehalten({ iban: IBAN_NEU }, { iban: IBAN })).toEqual({ iban: IBAN_NEU });
    expect(ibanBehalten(undefined, undefined)).toBeUndefined();
    const p = k({ zahlung: { weg: 'sepa', iban: IBAN } });
    expect(JSON.stringify(fuerPerson(p, 'kevin'))).not.toContain(IBAN);
    expect(fuerPerson(p, 'kevin', { ibanVoll: true }).zahlung?.iban).toBe(IBAN);
    expect(fuerPerson(k(), 'kevin')).toEqual(k());
  });
});
