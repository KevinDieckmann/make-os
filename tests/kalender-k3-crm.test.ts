// Kalender K3 (30.09.): CRM am Termin (rein) — Meeting-Aktivität je Termin/Vorkommen (idempotent, ohne `wann`, Art. 18),
// geplant zählt erst nach dem Termin, Löschen mit Löschmarke, Signale über den Bezug statt Namen (keine Doppelzählung,
// Wandzeit-Vergleich), Akte zählt ein Meeting einmal, Meeting-Zeit aus dem Termin; Gäste: ICS (ORGANIZER/ATTENDEE/
// PARTSTAT, Antwort, SEQUENCE), Eingaben, Kartei-Prüfung, Formular, Bezug + Art. 17, Termine zu einer Akte. Erfundene Daten.
import { describe, it, expect } from 'vitest';
import { terminAktivitaeten, terminKontaktNachziehen, terminAktivitaetenEntfernen, hatTerminAktivitaet, type TerminFuerCrm } from '../lib/crm/termin-aktivitaet';
import { terminSignale, terminMs, bezugTermin } from '../lib/crm/signale';
import { verlaufZahlen } from '../lib/crm/akte';
import { meetingVon } from '../lib/crm/aktivitaeten';
import { baueTermin, aendereTermin, antwortSetzen, einladungsLage, termineAus, nichtBearbeitbar } from '../lib/kalender/ics';
import { gaestePruefen, anlegenPruefen, aendernPruefen } from '../lib/kalender/eingabe';
import { gaesteGegenKartei, gaesteSuchen } from '../lib/kalender/gaeste-server';
import { adresseAus, gastDazu, einladungFrage, antwortenZaehlen } from '../lib/kalender/gaeste';
import { formularStart, formularAnfrage, formularFehler, formularErgaenzen } from '../lib/kalender/formular';
import { bezugSauber, bezugAendern, mitBezug, maskieren, kontakteVon } from '../lib/kalender/bezug';
import { termineZu } from '../lib/kalender/termine-zu';
import { kalenderBezugOhne } from '../lib/crm/person-weitere';
import type { Kontakt } from '../lib/make-one/crm';
import type { Termin } from '../lib/kalender/ics';

const tagePlus = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const kontakt = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Anna', nachname: 'Beispiel', stufe: 'neu', aktivitaeten: [], ...x } as Kontakt);
const t = (x: Partial<TerminFuerCrm> = {}): TerminFuerCrm => ({ id: 'U1', uid: 'U1', titel: 'Kennenlernen', start: '2026-10-02T10:00:00', kontaktIds: ['c-anna1'], von: 'kevin', ...x });
const JETZT = '2026-09-30T08:00:00.000Z', HEUTE = '2026-09-30';

describe('Termin → Aktivität „Meeting“ (K3)', () => {
  it('genau eine je Kontakt und Termin, ohne `wann`, mit `terminUid`; geplant zählt noch nicht; Art. 18 übersprungen', () => {
    const k = [kontakt('c-anna1'), kontakt('c-carl1', { eingeschraenkt: { seit: HEUTE, grund: 'x', von: 'kevin' } })];
    const r = terminAktivitaeten(k, t({ kontaktIds: ['c-anna1', 'c-carl1'], dealId: 'ch-1' }), HEUTE, JETZT, tagePlus);
    expect(r.neu).toEqual(['c-anna1']); expect(r.eingeschraenkt).toEqual(['c-carl1']);
    const a = r.kontakte[0].aktivitaeten[0];
    expect(a).toMatchObject({ art: 'termin', terminUid: 'U1', text: 'Meeting: Kennenlernen', von: 'kevin', bezug: 'ch-1' });
    expect(a.wann).toBeUndefined();
    expect(r.kontakte[0].letzterKontakt).toBeUndefined();
    expect(r.kontakte[1]).toBe(k[1]);
    // Idempotent: ein zweiter Lauf legt nichts an (auch die Buchungs-Aktivität von K4 zählt als „schon da“).
    expect(terminAktivitaeten(r.kontakte, t(), HEUTE, JETZT, tagePlus).neu).toEqual([]);
    expect(hatTerminAktivitaet(kontakt('c-x', { aktivitaeten: [{ am: JETZT, art: 'termin', von: 'kevin', bezug: bezugTermin('U1') }] }), t())).toBe(true);
    // Privat: nie der Titel.
    expect(terminAktivitaeten([kontakt('c-anna1')], t({ privat: true }), HEUTE, JETZT, tagePlus).kontakte[0].aktivitaeten[0].text).toBe('Meeting (privat)');
  });

  it('vergangen zählt sofort; geplant, das vorbei ist, zieht den letzten Kontakt nach (nur vorwärts)', () => {
    const vorbei = terminAktivitaeten([kontakt('c-anna1')], t({ start: '2026-09-29T10:00:00' }), HEUTE, JETZT, tagePlus).kontakte[0];
    expect(vorbei.letzterKontakt).toBe('2026-09-29');
    const geplant = terminAktivitaeten([kontakt('c-anna1', { letzterKontakt: '2026-09-01' })], t(), HEUTE, JETZT, tagePlus).kontakte;
    const spaeter = terminKontaktNachziehen(geplant, new Map([['U1', { start: '2026-10-02T10:00:00' }]]), '2026-10-03', '2026-10-03T08:00:00.000Z');
    expect(spaeter.kontakte[0].letzterKontakt).toBe('2026-10-02');
    expect(terminKontaktNachziehen(geplant, new Map([['U1', { start: '2026-10-02T10:00:00' }]]), HEUTE, JETZT).geaendert).toBe(0);
  });

  it('Entfernen: Termin und alle Vorkommen einer Serie, mit Löschmarke; nur die genannten Kontakte', () => {
    const k = [kontakt('c-anna1', { aktivitaeten: [{ am: JETZT, art: 'termin', von: 'kevin', terminUid: 'S1::20261002T080000Z' }, { am: JETZT, art: 'termin', von: 'kevin', terminUid: 'S10' }] }), kontakt('c-bert1', { aktivitaeten: [{ am: JETZT, art: 'termin', von: 'kevin', terminUid: 'S1' }] })];
    const r = terminAktivitaetenEntfernen(k, 'S1', new Set(['c-anna1']));
    expect(r.weg).toBe(1);
    expect(r.kontakte[0].aktivitaeten.map(a => a.terminUid)).toEqual(['S10']);
    expect(r.kontakte[0].geloeschteAktivitaeten).toHaveLength(1);
    expect(r.kontakte[1]).toBe(k[1]);
  });
});

describe('Signale über den Bezug (K3, Befund 7 + 11)', () => {
  const k = [kontakt('c-anna1'), kontakt('c-bert1', { vorname: 'Bert', nachname: 'Muster' })];
  it('Termin mit Bezug: kein Signal (die Meeting-Aktivität kommt aus dem Bezug) — und seit F3 kein „kommend“-Zwischenspeicher', () => {
    const r = terminSignale(k, [{ id: 'U1', uid: 'U1', titel: 'Kaffee', start: '2026-10-02T10:00:00', kontaktIds: ['c-anna1', 'c-bert1'] }, { id: 'U0', uid: 'U0', titel: 'Anna Beispiel', start: '2026-09-29T10:00:00', kontaktIds: ['c-anna1'] }], JETZT);
    expect(r).toEqual({ vergangen: [] });
  });
  it('Name im Titel nur noch als Rückfall; kein zweites Signal, wenn schon ein Meeting mit der UID existiert', () => {
    const r = terminSignale(k, [{ id: 'ac-U2', uid: 'U2', titel: 'Kaffee mit Anna Beispiel', start: '2026-09-29T10:00:00' }], JETZT);
    expect(r.vergangen).toHaveLength(1);
    const mit = [kontakt('c-anna1', { aktivitaeten: [{ am: JETZT, art: 'termin', von: 'kevin', terminUid: 'U2' }] })];
    expect(terminSignale(mit, [{ id: 'ac-U2', uid: 'U2', titel: 'Kaffee mit Anna Beispiel', start: '2026-09-29T10:00:00' }], JETZT).vergangen).toEqual([]);
  });
  it('Zeitvergleich über die Wandzeit: 09:30 Berlin ist um 08:00 UTC schon vorbei (vorher bis 2 h zu spät)', () => {
    expect(terminMs('2026-09-30T09:30:00')).toBe(Date.parse('2026-09-30T07:30:00.000Z'));
    const r = terminSignale(k, [{ id: 'ac-U3', titel: 'Anna Beispiel', start: '2026-09-30T09:30:00' }], JETZT);
    expect(r.vergangen).toHaveLength(1);
  });
});

describe('Akte und Zeit aus dem Termin', () => {
  it('ein Meeting zählt einmal (terminUid; altes Signal + von Hand am selben Tag)', () => {
    const k = kontakt('c-anna1', { aktivitaeten: [
      { am: '2026-09-20T09:00:00.000Z', art: 'termin', von: 'system', bezug: 'termin-abc' },
      { am: '2026-09-19T09:00:00.000Z', art: 'termin', von: 'kevin', wann: '2026-09-20T10:00' },
      { am: JETZT, art: 'termin', von: 'kevin', terminUid: 'U1' }, { am: JETZT, art: 'termin', von: 'system', terminUid: 'U1' },
      { am: JETZT, art: 'gespraech', von: 'kevin' },
    ] });
    expect(verlaufZahlen(k).gespraeche).toBe(3);
  });
  it('Meeting mit terminUid: Tag/Zeit/Ort aus dem Termin; ohne Termin der Tag des Festhaltens', () => {
    const a = { am: '2026-09-30T08:00:00.000Z', art: 'termin' as const, text: 'Meeting: X', terminUid: 'U1' };
    expect(meetingVon(a, { U1: { start: '2026-10-05T14:30:00', ort: 'Büro Nord' } })).toEqual({ tag: '2026-10-05', zeit: '14:30', ort: 'Büro Nord', notiz: 'Meeting: X' });
    expect(meetingVon(a)).toEqual({ tag: '2026-09-30', notiz: 'Meeting: X' });
  });
});

describe('Gäste im iCalendar (K3)', () => {
  const ich = ['kevin.konto@example.invalid'];
  const mitGaesten = baueTermin({ uid: 'G1', titel: 'Runde', start: '2026-10-02T10:00:00', ende: '2026-10-02T11:00:00', gaeste: [{ email: 'anna@example.invalid', name: 'Anna "A" Beispiel' }], organisator: ich[0] });
  it('ohne Gäste kein ATTENDEE/ORGANIZER; mit: ORGANIZER + ATTENDEE (SCHEDULE-AGENT=SERVER, NEEDS-ACTION, RSVP)', () => {
    expect(baueTermin({ uid: 'G0', titel: 'X', start: '2026-10-02T10:00:00', ende: '2026-10-02T11:00:00' })).not.toMatch(/ATTENDEE|ORGANIZER/);
    const glatt = mitGaesten.replace(/\r?\n[ \t]/g, '');
    expect(glatt).toMatch(/ORGANIZER;SCHEDULE-AGENT=SERVER:mailto:kevin\.konto@example\.invalid/);
    expect(glatt).toMatch(/ATTENDEE;CN=Anna A Beispiel;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;SCHEDULE-AGENT=SERVER:mailto:anna@example\.invalid/);
    expect(() => baueTermin({ uid: 'G2', titel: 'X', start: '2026-10-02T10:00:00', ende: '2026-10-02T11:00:00', gaeste: [{ email: 'a@example.invalid' }] })).toThrow();
  });
  it('lesen: Gäste mit Antwort, wir laden ein → bearbeitbar; fremde Einladung → Gast mit eigener Antwort', () => {
    const [x] = termineAus({ href: 'h', ics: mitGaesten }, { id: 'k', name: 'K' }, '2026-09-28', '2026-10-05', ich);
    expect(x).toMatchObject({ mitTeilnehmern: true, ichOrganisator: true, bearbeitbar: true, teilnehmer: [{ email: 'anna@example.invalid', status: 'offen' }] });
    const [ohneIch] = termineAus({ href: 'h', ics: mitGaesten }, { id: 'k', name: 'K' }, '2026-09-28', '2026-10-05');
    expect(ohneIch.bearbeitbar).toBe(false);
    const fremd = mitGaesten.replace('ORGANIZER;SCHEDULE-AGENT=SERVER:mailto:kevin.konto@example.invalid', 'ORGANIZER:mailto:nora@example.invalid\r\nATTENDEE;PARTSTAT=TENTATIVE:mailto:kevin.konto@example.invalid');
    const [g] = termineAus({ href: 'h', ics: fremd }, { id: 'k', name: 'K' }, '2026-09-28', '2026-10-05', ich);
    expect(g).toMatchObject({ bearbeitbar: false, meineAntwort: 'vielleicht', organisator: { email: 'nora@example.invalid' } });
    expect(g.ichOrganisator).toBeUndefined();
    expect(einladungsLage(fremd, ich)).toMatchObject({ gast: true, empfaenger: ['nora@example.invalid'] });
    expect(einladungsLage(mitGaesten, ich)).toMatchObject({ gast: false, ichOrganisator: true, gaeste: ['anna@example.invalid'], empfaenger: ['anna@example.invalid'] });
    expect(nichtBearbeitbar(fremd, ich)).toMatch(/Gast/);
  });
  it('ändern mit Gästen nur bestätigt; Gästeliste behält Antworten; SEQUENCE nur bei Zeit/Ort; Antwort als Gast', () => {
    expect(aendereTermin(mitGaesten, { titel: 'Y' }, new Date(), { ich })).toEqual({ fehler: expect.stringContaining('bestätigen') });
    const zugesagt = mitGaesten.replace(/\r?\n[ \t]/g, '').replace('PARTSTAT=NEEDS-ACTION', 'PARTSTAT=ACCEPTED');
    const r = aendereTermin(zugesagt, { gaeste: [{ email: 'anna@example.invalid' }, { email: 'bert@example.invalid' }], titel: 'Runde 2' }, new Date(), { ich, einladungBestaetigt: true });
    expect('ics' in r).toBe(true);
    const neu = ('ics' in r ? r.ics : '').replace(/\r?\n[ \t]/g, '');
    expect(neu).toMatch(/PARTSTAT=ACCEPTED[^\r\n]*:mailto:anna@example\.invalid/);
    expect(neu).toMatch(/PARTSTAT=NEEDS-ACTION[^\r\n]*:mailto:bert@example\.invalid/);
    expect(neu).not.toMatch(/SEQUENCE/);
    const zeit = aendereTermin(mitGaesten, { start: '2026-10-02T12:00:00' }, new Date(), { ich, einladungBestaetigt: true });
    expect('ics' in zeit && zeit.ics).toMatch(/SEQUENCE:1/);
    // Ein Termin ohne Gäste bekommt neue Gäste (Einladung) nur bestätigt.
    const ohne = baueTermin({ uid: 'G3', titel: 'X', start: '2026-10-02T10:00:00', ende: '2026-10-02T11:00:00' });
    expect(aendereTermin(ohne, { gaeste: [{ email: 'anna@example.invalid' }] }, new Date(), { ich })).toEqual({ fehler: expect.stringContaining('bestätigen') });
    const eingeladen = aendereTermin(ohne, { gaeste: [{ email: 'anna@example.invalid' }] }, new Date(), { ich, einladungBestaetigt: true });
    expect('ics' in eingeladen && eingeladen.ics.replace(/\r?\n[ \t]/g, '')).toMatch(/ORGANIZER;SCHEDULE-AGENT=SERVER:mailto:kevin\.konto@example\.invalid/);
    // Antwort als Gast: nur die eigene Zeile, kein SEQUENCE; als Organisator verboten.
    const fremd = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:f\r\nDTSTAMP:20260901T100000Z\r\nDTSTART:20261002T080000Z\r\nDTEND:20261002T090000Z\r\nORGANIZER:mailto:nora@example.invalid\r\nATTENDEE;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:kevin.konto@example.invalid\r\nATTENDEE;PARTSTAT=ACCEPTED:mailto:nora@example.invalid\r\nEND:VEVENT\r\nEND:VCALENDAR';
    const a = antwortSetzen(fremd, ich, 'abgesagt');
    expect('ics' in a && a.ics.replace(/\r?\n[ \t]/g, '')).toMatch(/ATTENDEE;PARTSTAT=DECLINED:mailto:kevin\.konto@example\.invalid/);
    expect('ics' in a && a.ics).not.toMatch(/SEQUENCE/);
    expect(antwortSetzen(mitGaesten, ich, 'zugesagt')).toEqual({ fehler: expect.stringContaining('eingeladen') });
    expect(antwortSetzen(fremd, ['x@example.invalid'], 'zugesagt')).toEqual({ fehler: expect.stringContaining('Gästeliste') });
  });
});

describe('Gäste: Eingaben, Kartei, Formular, Bezug (K3)', () => {
  it('Eingaben: Adressen klein, ohne Doppelte, ungültig → Fehler; Gäste nur an Terminen; Antwort geprüft', () => {
    expect(adresseAus('mailto:Anna@Example.Invalid')).toBe('anna@example.invalid');
    expect(adresseAus('kein-at')).toBeUndefined();
    expect(gaestePruefen([{ email: 'A@example.invalid', kontaktId: 'c-anna1' }, 'a@example.invalid'])).toEqual({ ok: true, gaeste: [{ email: 'a@example.invalid', kontaktId: 'c-anna1' }] });
    expect(gaestePruefen([{ email: 'x' }]).ok).toBe(false);
    expect(anlegenPruefen({ titel: 'X', start: '2026-10-02T10:00', ende: '2026-10-02T11:00', art: 'fokus', gaeste: ['a@example.invalid'] })).toEqual({ ok: false, fehler: 'Gäste gibt es nur an Terminen.' });
    expect(anlegenPruefen({ titel: 'X', start: '2026-10-02T10:00', ende: '2026-10-02T11:00', gaeste: ['a@example.invalid'], einladungBestaetigt: true })).toMatchObject({ ok: true, e: { gaeste: [{ email: 'a@example.invalid' }], einladungBestaetigt: true } });
    expect(aendernPruefen({ uid: 'u', antwort: 'ja' }).ok).toBe(false);
    expect(aendernPruefen({ uid: 'u', antwort: 'zugesagt' })).toMatchObject({ ok: true, e: { antwort: 'zugesagt', einladungBestaetigt: false } });
    expect(gastDazu([{ email: 'a@example.invalid' }], { email: 'A@example.invalid' })).toHaveLength(1);
    expect(einladungFrage('einladung', 1)).toBe('Einladung an 1 Person über iCloud senden?');
    expect(einladungFrage('absage', 3)).toBe('Absage an 3 Personen über iCloud senden?');
    expect(antwortenZaehlen([{ status: 'zugesagt' }, { status: 'offen' }, { status: 'zugesagt' }])).toBe('2 zugesagt · 1 keine Antwort');
  });
  it('Kartei: Art. 18 lehnt ab (auch frei eingegeben), Werbesperre zählt, Adresse → Kennung; Suche ohne eingeschränkte', () => {
    const kartei = [kontakt('c-anna1', { email: 'anna@example.invalid' }), kontakt('c-bert1', { vorname: 'Bert', email: 'bert@example.invalid', werbesperre: { seit: HEUTE, grund: 'x' } }), kontakt('c-carl1', { vorname: 'Carl', email: 'carl@example.invalid', eingeschraenkt: { seit: HEUTE, grund: 'x', von: 'kevin' } })];
    expect(gaesteGegenKartei([{ email: 'carl@example.invalid' }], kartei).ok).toBe(false);
    expect(gaesteGegenKartei([{ email: 'x@example.invalid', kontaktId: 'c-carl1' }], kartei).ok).toBe(false);
    expect(gaesteGegenKartei([{ email: 'anna@example.invalid' }, { email: 'bert@example.invalid' }, { email: 'frei@example.invalid' }], kartei)).toEqual({ ok: true, werbesperre: 1, gaeste: [
      { email: 'anna@example.invalid', name: 'Anna Beispiel', kontaktId: 'c-anna1' }, { email: 'bert@example.invalid', name: 'Bert Beispiel', kontaktId: 'c-bert1' }, { email: 'frei@example.invalid' }] });
    expect(gaesteSuchen(kartei, 'bei').map(g => g.kontaktId)).toEqual(['c-anna1', 'c-bert1']);
    expect(gaesteSuchen(kartei, 'bert')[0]).toMatchObject({ werbesperre: true });
    expect(gaesteSuchen(kartei, 'carl')).toEqual([]);
    expect(gaesteSuchen(kartei, 'a')).toEqual([]);
  });
  it('Formular: CRM-Bezug + Gäste nur am Termin; alter Entwurf wird ergänzt', () => {
    const f = { ...formularStart({ tag: '2026-10-02', von: '10:00', crm: { kontaktId: 'c-anna1' } }, 60), titel: 'Runde', gaeste: [{ email: 'a@example.invalid', kontaktId: 'c-anna1', werbesperre: true as const }] };
    expect(formularAnfrage(f)).toMatchObject({ art: 'termin', koerper: { bezug: { kontaktId: 'c-anna1' }, gaeste: [{ email: 'a@example.invalid', kontaktId: 'c-anna1' }] } });
    expect(JSON.stringify(formularAnfrage(f))).not.toContain('werbesperre');
    expect(formularFehler({ ...f, art: 'fokus' })).toBe('Gäste gibt es nur an Terminen.');
    const alt = formularStart({ tag: '2026-10-02' }, 60) as unknown as Record<string, unknown>;
    delete alt.crm; delete alt.gaeste;
    expect(formularErgaenzen(alt as never)).toMatchObject({ crm: {}, gaeste: [] });
  });
  it('Bezug: Gast-Kennungen ohne Adressen, maskiert für die andere Person, Art. 17 nimmt die Person auch als Gast heraus', () => {
    const b = bezugSauber({ kontaktId: 'c-anna1', gastKontakte: ['c-anna1', 'c-bert1', 'c-bert1', 'a@b.de x'], von: 'kevin' })!;
    expect(b.gastKontakte).toEqual(['c-anna1', 'c-bert1']);
    expect(kontakteVon(b)).toEqual(['c-anna1', 'c-bert1']);
    expect(bezugAendern(b, { gastKontakte: [] }, JETZT)?.gastKontakte).toBeUndefined();
    const termin = { id: 'U1', uid: 'U1', href: '', titel: 'X', start: '2026-10-02T10:00:00', ende: '2026-10-02T11:00:00', ganztags: false, kalender: 'K', kalenderId: 'k', serie: false, mitTeilnehmern: true, bearbeitbar: true, art: 'termin', beschaeftigt: true, sichtbarkeit: 'privat', teilnehmer: [{ email: 'anna@example.invalid', status: 'offen' }] } as Termin;
    const m = mitBezug(termin, { bezuege: { U1: b } });
    expect(m.gastKontakte).toEqual(['c-anna1', 'c-bert1']);
    const fuerMalin = maskieren({ ...m, von: 'kevin' }, 'malin');
    expect(fuerMalin.teilnehmer).toBeUndefined(); expect(fuerMalin.gastKontakte).toBeUndefined();
    const r = kalenderBezugOhne({ bezuege: { U1: b, U2: { gastKontakte: ['c-anna1'], von: 'kevin' } } }, { id: 'c-anna1' } as never);
    expect(r.n).toBe(2);
    expect((r.neu as { bezuege: Record<string, unknown> }).bezuege).toEqual({ U1: { gastKontakte: ['c-bert1'], von: 'kevin', geaendert: b.geaendert }, U2: { von: 'kevin' } });
  });
  it('Termine zu einer Akte: über Bezug und Gäste, maskierte fallen weg, kommend/vergangen sortiert', () => {
    const basis = { href: '', ende: '', ganztags: false, kalender: 'K', kalenderId: 'k', serie: false, mitTeilnehmern: false, bearbeitbar: true, art: 'termin' as const, beschaeftigt: true, sichtbarkeit: 'standard' as const };
    const l = [
      { ...basis, id: 'A', uid: 'A', titel: 'A', start: '2026-10-03T10:00:00', ende: '2026-10-03T11:00:00', bezug: { kontaktId: 'c-anna1' } },
      { ...basis, id: 'B', uid: 'B', titel: 'B', start: '2026-10-01T10:00:00', ende: '2026-10-01T11:00:00', gastKontakte: ['c-anna1'] },
      { ...basis, id: 'C', uid: 'C', titel: 'C', start: '2026-09-29T10:00:00', ende: '2026-09-29T11:00:00', bezug: { dealId: 'ch-1' } },
      { ...basis, id: 'D', uid: 'D', titel: 'Belegt', start: '2026-10-01T10:00:00', ende: '2026-10-01T11:00:00', maskiert: true as const },
    ];
    const r = termineZu(l, { kontakte: ['c-anna1'], deals: ['ch-1'] }, '2026-09-30T10:00:00');
    expect(r.kommend.map(x => x.id)).toEqual(['B', 'A']);
    expect(r.vergangen.map(x => x.id)).toEqual(['C']);
    expect(termineZu(l, { firmen: ['f-1'] }, '2026-09-30T10:00:00')).toEqual({ kommend: [], vergangen: [] });
  });
});
