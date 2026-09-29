// Kalender R-K1 (29.09.) — Kern & Abgleich, rein: Zeitzonen an der Umstellung (#4/#5), fremde Zonen (#3/#9/#10), floating
// (#6), Sortierung (#1), EXDATE (#26), Obergrenze (#33), verschobene Vorkommen (#35), Endzone (#13), Serien (#20/#21/#25),
// Schlüssel Kalender + UID (#46), abgesagt/abgelehnt (#68/#100), Farbe (#47), gekürzte Antwort (#43), Backoff (#50),
// Alter des Abgleichs (#51), Erinnerungen (#8), Maskierung (#96), Sicherung (#K5), HOI.
// Läuft zusätzlich mit MAKE_OS_TEST_TZ=UTC und =America/Los_Angeles (vitest.config.ts) — nichts hier darf an der Zone
// der Maschine hängen. Erfundene Daten.
import { describe, it, expect } from 'vitest';
import { baueTermin, termineAus, aendereTermin, rruleText, VORKOMMEN_MAX, type KalenderInfo } from '../lib/kalender/ics';
import { ausWandzeit, wandzeit, minutenVon } from '../lib/kalender/zeit';
import { ausWandzeitIn, ianaZone } from '../lib/kalender/zeitzone';
import {
  kalenderKennung, terminSchluessel, schluesselTeile, objektSchluessel, altSchluessel, schluesselPasst, schluesselGehoertZu,
  bezugVon, mitBezug, bezugUmzugPlan, bezugAbgleichPlan, lebendAus, verweisLebt, maskieren, fremdPrivat, type BezugBestand,
} from '../lib/kalender/bezug';
import { termineImZeitraum, abgleichAlter, pauseMs, naechsterVersuchFaellig, retryAfterSekunden, type IcloudStand } from '../lib/kalender/icloud';
import { unvollstaendig } from '../lib/kalender/dav';
import { verfuegbarkeitAus } from '../lib/kalender/verfuegbarkeit-regeln';
import { terminSignale } from '../lib/crm/signale';
import { faelligWand, erinnerungen } from '../lib/kalender/eintraege';
import { exportIcs, objekteAusIcs, wiederherstellPlan, abgelaufen, sicherungFaellig, exportDatei, mitTeilnehmern } from '../lib/kalender/sicherung';
import { tagPlus } from '../lib/kalender/zeit';
import { kalenderBefunde } from '../lib/hoi/lage';
import type { Kontakt } from '../lib/make-one/crm';

const HOME = 'https://p42-caldav.icloud.com/123/calendars/home/';
const WORK = 'https://p42-caldav.icloud.com/123/calendars/ABC-work-7/';
const KAL: KalenderInfo = { id: HOME, name: 'Privat Kevin', schreibbar: true };
const vcal = (inhalt: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//DE\r\n${inhalt}\r\nEND:VCALENDAR`;
const ev = (uid: string, ...zeilen: string[]) => `BEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:20260901T100000Z\r\n${zeilen.join('\r\n')}\r\nEND:VEVENT`;
const obj = (ics: string, etag = 'e1', href = '/x.ics') => ({ href, etag, ics });
const vevent = (ics: string) => ics.split('BEGIN:VEVENT')[1];

describe('#5/#4 Umstellung: aus Wandzeit-Teilen, mehrdeutig = erstes Vorkommen, Lücke vorwärts', () => {
  it('25.10.2026 02:00–03:00 bleibt 02:00–03:00 (1 h im Raster) — nicht 03:00–03:00', () => {
    const ics = baueTermin({ uid: 'nacht', titel: 'Nacht', start: '2026-10-25T02:00:00', ende: '2026-10-25T03:00:00' });
    expect(vevent(ics)).toContain('DTSTART;TZID=Europe/Berlin:20261025T020000');
    expect(vevent(ics)).toContain('DTEND;TZID=Europe/Berlin:20261025T030000');
    const [t] = termineAus(obj(ics), KAL, '2026-10-25', '2026-10-26');
    expect([t.start, t.ende]).toEqual(['2026-10-25T02:00:00', '2026-10-25T03:00:00']);
    expect(minutenVon(t.ende) - minutenVon(t.start)).toBe(60);
    // RFC 5545 3.3.5: die doppelte Stunde meint das ERSTE Vorkommen (MESZ) — 02:00 MESZ = 00:00Z.
    expect(t.startMs).toBe(Date.UTC(2026, 9, 25, 0, 0));
    expect(ausWandzeit('2026-10-25T02:30').toISOString()).toBe('2026-10-25T00:30:00.000Z');
    expect(ausWandzeitIn('2026-10-25T02:30', 'Europe/Berlin').toISOString()).toBe('2026-10-25T00:30:00.000Z');
  });
  it('29.03.: 02:30 gibt es nicht — geschrieben wird 03:30; ein Apple-Termin mit 02:30 liest sich als 03:30', () => {
    const ics = baueTermin({ uid: 'luecke', titel: 'Früh', start: '2026-03-29T02:30:00', ende: '2026-03-29T04:00:00' });
    expect(vevent(ics)).toContain('DTSTART;TZID=Europe/Berlin:20260329T033000');
    expect(vevent(ics)).toContain('DTEND;TZID=Europe/Berlin:20260329T040000');
    const apple = vcal(ev('apple', 'DTSTART;TZID=Europe/Berlin:20260329T023000', 'DTEND;TZID=Europe/Berlin:20260329T033000', 'SUMMARY:Apple'));
    expect(termineAus(obj(apple), KAL, '2026-03-29', '2026-03-30')[0].start).toBe('2026-03-29T03:30:00');
    expect(ausWandzeit('2026-03-29T02:30').toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });
  it('Serie über die Umstellung: jedes Vorkommen 02:30 Wandzeit, Abstand 7 Tage bzw. 7 Tage + 1 h', () => {
    const ics = vcal(ev('s', 'DTSTART;TZID=Europe/Berlin:20261018T023000', 'DTEND;TZID=Europe/Berlin:20261018T031500', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:Nachtlauf'));
    const t = termineAus(obj(ics), KAL, '2026-10-12', '2026-11-09');
    expect(t.map(x => x.start)).toEqual(['2026-10-18T02:30:00', '2026-10-25T02:30:00', '2026-11-01T02:30:00']);
    expect((t[1].startMs! - t[0].startMs!) / 3_600_000).toBe(168);
    expect((t[2].startMs! - t[1].startMs!) / 3_600_000).toBe(169);
  });
  it('Verschieben am Umstellungstag behält die Dauer (echte Zeitpunkte) und schreibt Wandzeit', () => {
    const ics = baueTermin({ uid: 'v', titel: 'X', start: '2026-10-24T09:00:00', ende: '2026-10-24T10:00:00' });
    const r = aendereTermin(ics, { start: '2026-10-25T09:00:00' });
    if ('fehler' in r) throw new Error(r.fehler);
    expect(r.ics).toContain('DTSTART;TZID=Europe/Berlin:20261025T090000');
    expect(r.ics).toContain('DTEND;TZID=Europe/Berlin:20261025T100000');
  });
});

describe('#3/#9/#10/#6 fremde Zonen und floating', () => {
  it('#3 New York ohne VTIMEZONE = 14:00 Berlin (nicht floating), mit Zone', () => {
    const ics = vcal(ev('ny', 'DTSTART;TZID=America/New_York:20260310T090000', 'DTEND;TZID=America/New_York:20260310T100000', 'SUMMARY:Call NY'));
    const [t] = termineAus(obj(ics), KAL, '2026-03-10', '2026-03-11');
    expect(t.start).toBe('2026-03-10T14:00:00');
    expect(t.zone).toBe('America/New_York');
  });
  it('#10 Windows-Zone und Präfix: „W. Europe Standard Time“ = Berlin, /mozilla.org/…/America/New_York = New York', () => {
    expect(ianaZone('W. Europe Standard Time')).toBe('Europe/Berlin');
    expect(ianaZone('Eastern Standard Time')).toBe('America/New_York');
    expect(ianaZone('/mozilla.org/20070129_1/Europe/Berlin')).toBe('Europe/Berlin');
    expect(ianaZone('Gibt/Es_Nicht')).toBeNull();
    const win = vcal(ev('w', 'DTSTART;TZID=W. Europe Standard Time:20261005T090000', 'DTEND;TZID=W. Europe Standard Time:20261005T100000', 'SUMMARY:Outlook'));
    expect(termineAus(obj(win), KAL, '2026-10-05', '2026-10-06')[0].start).toBe('2026-10-05T09:00:00');
    const moz = vcal(ev('m', 'DTSTART;TZID=/mozilla.org/20070129_1/America/New_York:20260610T090000', 'DTEND;TZID=/mozilla.org/20070129_1/America/New_York:20260610T100000', 'SUMMARY:Thunderbird'));
    expect(termineAus(obj(moz), KAL, '2026-06-10', '2026-06-11')[0].start).toBe('2026-06-10T15:00:00');
  });
  it('#9 IANA gewinnt vor einer veralteten eingebetteten VTIMEZONE (nur -05:00, ohne Sommerzeit)', () => {
    const alt = 'BEGIN:VTIMEZONE\r\nTZID:America/New_York\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:-0500\r\nTZOFFSETTO:-0500\r\nEND:STANDARD\r\nEND:VTIMEZONE';
    const ics = vcal(`${alt}\r\n${ev('alt', 'DTSTART;TZID=America/New_York:20260610T090000', 'DTEND;TZID=America/New_York:20260610T100000', 'SUMMARY:Alt')}`);
    expect(termineAus(obj(ics), KAL, '2026-06-10', '2026-06-11')[0].start).toBe('2026-06-10T15:00:00');
  });
  it('#6 floating = Berliner Wandzeit, egal in welcher Zone die Maschine steht', () => {
    const ics = vcal(ev('f', 'DTSTART:20261005T090000', 'DTEND:20261005T100000', 'SUMMARY:Floating'));
    const [t] = termineAus(obj(ics), KAL, '2026-10-05', '2026-10-06');
    expect([t.start, t.ende]).toEqual(['2026-10-05T09:00:00', '2026-10-05T10:00:00']);
    expect(t.startMs).toBe(Date.UTC(2026, 9, 5, 7, 0));
  });
});

describe('#1 Sortierung, #26 EXDATE, #33 Obergrenze, #35 verschobene Vorkommen', () => {
  it('#1 nach dem Zeitpunkt: 02:30 MESZ (erstes Vorkommen) vor 02:15 MEZ', () => {
    const a = vcal(ev('a', 'DTSTART:20261025T011500Z', 'DTEND:20261025T013000Z', 'SUMMARY:A (MEZ)'));
    const b = vcal(ev('b', 'DTSTART;TZID=Europe/Berlin:20261025T023000', 'DTEND;TZID=Europe/Berlin:20261025T024500', 'SUMMARY:B (MESZ)'));
    const s: IcloudStand = { at: '2026-10-24T10:00:00Z', kalender: [{ ...KAL, schreibbar: true }], objekte: { [HOME]: [obj(a, 'a', '/a.ics'), obj(b, 'b', '/b.ics')] } };
    const t = termineImZeitraum(s, '2026-10-25', '2026-10-26');
    expect(t.map(x => [x.titel, x.start])).toEqual([['B (MESZ)', '2026-10-25T02:30:00'], ['A (MEZ)', '2026-10-25T02:15:00']]);
  });
  it('#26 EXDATE ohne Zone an einer Serie mit TZID streicht das Vorkommen', () => {
    const ics = vcal(ev('ex', 'DTSTART;TZID=Europe/Berlin:20261005T090000', 'DTEND;TZID=Europe/Berlin:20261005T100000', 'RRULE:FREQ=DAILY;COUNT=3', 'EXDATE:20261006T090000', 'SUMMARY:Täglich'));
    expect(termineAus(obj(ics), KAL, '2026-10-05', '2026-10-10').map(x => x.start.slice(0, 10))).toEqual(['2026-10-05', '2026-10-07']);
  });
  it('#33 MINUTELY aus fremden Daten wird nicht aufgefaltet; sonst höchstens 2000 Vorkommen je Objekt', () => {
    const min = vcal(ev('min', 'DTSTART:20261005T090000Z', 'DTEND:20261005T090100Z', 'RRULE:FREQ=MINUTELY', 'SUMMARY:Spam'));
    expect(termineAus(obj(min), KAL, '2026-10-05', '2026-10-06')).toHaveLength(1);
    const std = vcal(ev('std', 'DTSTART;TZID=Europe/Berlin:20261001T000000', 'DTEND;TZID=Europe/Berlin:20261001T001000', 'RRULE:FREQ=HOURLY', 'SUMMARY:Stündlich'));
    expect(termineAus(obj(std), KAL, '2026-10-01', '2027-01-31')).toHaveLength(VORKOMMEN_MAX);
  });
  it('#35 ein um sechs Wochen verschobenes Vorkommen erscheint in seinem neuen Zeitraum — genau einmal', () => {
    const ics = vcal([
      ev('jf', 'DTSTART;TZID=Europe/Berlin:20260928T090000', 'DTEND;TZID=Europe/Berlin:20260928T100000', 'RRULE:FREQ=WEEKLY;COUNT=10', 'SUMMARY:Jour fixe'),
      ev('jf', 'RECURRENCE-ID;TZID=Europe/Berlin:20261005T090000', 'DTSTART;TZID=Europe/Berlin:20261120T090000', 'DTEND;TZID=Europe/Berlin:20261120T100000', 'SUMMARY:Jour fixe (verschoben)'),
    ].join('\r\n'));
    const t = termineAus(obj(ics), KAL, '2026-11-16', '2026-11-23');
    expect(t.map(x => [x.start, x.titel])).toEqual([['2026-11-16T09:00:00', 'Jour fixe'], ['2026-11-20T09:00:00', 'Jour fixe (verschoben)']]);
    expect(termineAus(obj(ics), KAL, '2026-10-05', '2026-10-06')).toEqual([]);
  });
});

describe('#13 Endzone, #20/#21/#25 Serien', () => {
  it('#13 Flug Berlin → New York: eigene Endzone beim Anlegen; beim Verschieben behält DTEND seine Zone', () => {
    const ics = baueTermin({ uid: 'flug', titel: 'Flug', start: '2026-10-10T18:00:00', ende: '2026-10-10T20:00:00', endZone: 'America/New_York' });
    expect(vevent(ics)).toContain('DTEND;TZID=America/New_York:20261010T200000');
    expect(ics).toContain('TZID:America/New_York');
    const [t] = termineAus(obj(ics), KAL, '2026-10-10', '2026-10-12');
    expect([t.start, t.ende]).toEqual(['2026-10-10T18:00:00', '2026-10-11T02:00:00']);
    const r = aendereTermin(ics, { start: '2026-10-11T18:00:00' });
    if ('fehler' in r) throw new Error(r.fehler);
    expect(r.ics).toContain('DTSTART;TZID=Europe/Berlin:20261011T180000');
    expect(r.ics).toContain('DTEND;TZID=America/New_York:20261011T200000');
  });
  it('#20 DTSTART liegt auf dem ersten echten Vorkommen (Mi angelegt, „montags“ → Mo)', () => {
    const ics = baueTermin({ uid: 'mo', titel: 'Montag', start: '2026-09-30T10:00:00', ende: '2026-09-30T11:00:00', wiederholung: { freq: 'WEEKLY', tage: ['MO'], anzahl: 2 } });
    expect(vevent(ics)).toContain('DTSTART;TZID=Europe/Berlin:20261005T100000');
    expect(termineAus(obj(ics), KAL, '2026-09-28', '2026-10-20').map(x => x.start.slice(0, 10))).toEqual(['2026-10-05', '2026-10-12']);
  });
  it('#21 UNTIL = 23:59:59 Wandzeit der Zone; #25 WKST=MO', () => {
    expect(rruleText({ freq: 'DAILY', bis: '2026-12-03' })).toBe('FREQ=DAILY;UNTIL=20261203T225959Z;WKST=MO');
    expect(rruleText({ freq: 'DAILY', bis: '2026-07-03' })).toBe('FREQ=DAILY;UNTIL=20260703T215959Z;WKST=MO');
    expect(rruleText({ freq: 'DAILY', bis: '2026-12-03' }, false, 'America/New_York')).toBe('FREQ=DAILY;UNTIL=20261204T045959Z;WKST=MO');
    const ics = baueTermin({ uid: 'spaet', titel: 'Spät', start: '2026-12-01T23:30:00', ende: '2026-12-02T00:00:00', wiederholung: { freq: 'DAILY', bis: '2026-12-03' } });
    expect(vevent(ics)).toContain('RRULE:FREQ=DAILY;UNTIL=20261203T225959Z;WKST=MO');
    expect(termineAus(obj(ics), KAL, '2026-12-01', '2026-12-06').map(x => x.start.slice(0, 10))).toEqual(['2026-12-01', '2026-12-02', '2026-12-03']);
  });
});

describe('#46 Schlüssel = Kalender + UID', () => {
  it('Kennung aus der Kalender-Adresse; Schlüssel zerlegen; alte Form bleibt lesbar', () => {
    expect(kalenderKennung(HOME)).toBe('home');
    expect(kalenderKennung(WORK)).toBe('ABC-work-7');
    expect(kalenderKennung('https://x.icloud.com/1/calendars/%E2%9C%93|x/')).toMatch(/^k[0-9a-z]+$/);
    expect(terminSchluessel('home', 'u1', '20261005T090000')).toBe('home|u1::20261005T090000');
    expect(schluesselTeile('home|u1::R')).toEqual({ kal: 'home', uid: 'u1', rid: 'R' });
    expect(schluesselTeile('u1')).toEqual({ uid: 'u1' });
    expect(objektSchluessel({ id: 'home|u1::R' })).toBe('home|u1');
    expect(altSchluessel('home|u1::R')).toBe('u1::R');
    expect(schluesselPasst('u1', 'home|u1')).toBe(true);
    expect(schluesselPasst('work|u1', 'home|u1')).toBe(false);
    expect(schluesselGehoertZu('home|u1::R', 'home|u1')).toBe(true);
    expect(schluesselGehoertZu('home|u1', 'home|u1::R')).toBe(false);
  });
  it('gleiche UID in zwei Kalendern → zwei Termine mit eigener id; Bezug trifft nur den richtigen', () => {
    const ics = vcal(ev('gleich', 'DTSTART;TZID=Europe/Berlin:20261005T090000', 'DTEND;TZID=Europe/Berlin:20261005T100000', 'SUMMARY:Kopie'));
    const s: IcloudStand = { at: 'x', kalender: [{ id: HOME, name: 'Privat Kevin', schreibbar: true }, { id: WORK, name: 'Arbeit', schreibbar: true }], objekte: { [HOME]: [obj(ics)], [WORK]: [obj(ics)] } };
    const t = termineImZeitraum(s, '2026-10-05', '2026-10-06');
    expect(t.map(x => x.id).sort()).toEqual(['ABC-work-7|gleich', 'home|gleich']);
    const bestand: BezugBestand = { bezuege: { 'home|gleich': { kontaktId: 'c-1', geaendert: 'x' } } };
    expect(t.map(x => mitBezug(x, bestand).bezug?.kontaktId ?? null).sort()).toEqual(['c-1', null]);
    // Alte Einträge (nur UID) gelten weiter — für jede Kopie.
    const alt: BezugBestand = { bezuege: { gleich: { kontaktId: 'c-2', geaendert: 'x' } } };
    expect(t.every(x => bezugVon(alt, x)?.kontaktId === 'c-2')).toBe(true);
  });
  it('Umzug alter Schlüssel: nur eindeutige UIDs ziehen um, mehrdeutige bleiben; Lebend-Prüfung in beiden Formen', () => {
    const objekte = [
      { uid: 'eins', schluessel: 'home|eins', zusatz: null },
      { uid: 'doppelt', schluessel: 'home|doppelt', zusatz: null }, { uid: 'doppelt', schluessel: 'work|doppelt', zusatz: null },
    ];
    const bestand: BezugBestand = { bezuege: { eins: { kontaktId: 'c-1', geaendert: 'x' }, 'eins::R1': { kontaktId: 'c-3', geaendert: 'x' }, doppelt: { kontaktId: 'c-2', geaendert: 'x' } } };
    expect(bezugUmzugPlan(objekte, bestand).sort()).toEqual([['eins', 'home|eins'], ['eins::R1', 'home|eins::R1']]);
    const l = lebendAus(objekte);
    expect([verweisLebt('eins', l), verweisLebt('home|eins', l), verweisLebt('work|eins', l), verweisLebt('weg', l)]).toEqual([true, true, false, false]);
  });
});

describe('#68/#100 abgesagt, abgelehnt, vorläufig', () => {
  const ICH = ['kevin@example.invalid'];
  const abgesagt = vcal(ev('c', 'DTSTART;TZID=Europe/Berlin:20261005T090000', 'DTEND;TZID=Europe/Berlin:20261005T100000', 'STATUS:CANCELLED', 'SUMMARY:Fällt aus'));
  const abgelehnt = vcal(ev('d', 'DTSTART;TZID=Europe/Berlin:20261005T110000', 'DTEND;TZID=Europe/Berlin:20261005T120000', 'ORGANIZER:mailto:anna@example.invalid', 'ATTENDEE;PARTSTAT=DECLINED:mailto:kevin@example.invalid', 'ATTENDEE;PARTSTAT=ACCEPTED:mailto:anna@example.invalid', 'SUMMARY:Einladung'));
  const vorlaeufig = vcal(ev('t', 'DTSTART;TZID=Europe/Berlin:20261005T140000', 'DTEND;TZID=Europe/Berlin:20261005T150000', 'STATUS:TENTATIVE', 'SUMMARY:Vielleicht'));
  it('STATUS:CANCELLED und eigenes DECLINED belegen nicht; TENTATIVE ist ein Feld und belegt', () => {
    const [c] = termineAus(obj(abgesagt), KAL, '2026-10-05', '2026-10-06', ICH);
    const [d] = termineAus(obj(abgelehnt), KAL, '2026-10-05', '2026-10-06', ICH);
    const [t] = termineAus(obj(vorlaeufig), KAL, '2026-10-05', '2026-10-06', ICH);
    expect(c).toMatchObject({ status: 'abgesagt', abgesagt: true, beschaeftigt: false });
    expect(d).toMatchObject({ meineAntwort: 'abgesagt', abgesagt: true, beschaeftigt: false });
    expect(t).toMatchObject({ status: 'vorlaeufig', beschaeftigt: true });
    expect(t.abgesagt).toBeUndefined();
    const v = verfuegbarkeitAus({ person: 'kevin', von: '2026-10-05', bis: '2026-10-06', termine: [c, d, t].map(x => ({ ...x, wer: 'kevin' })) });
    expect(v.tage[0].beschaeftigt.map(b => b.start)).toEqual(['2026-10-05T14:00:00']);
  });
  it('#100 CRM: ein abgesagter Termin mit Namen im Titel erzeugt kein Signal', () => {
    const anna = { id: 'c-anna', vorname: 'Anna', nachname: 'Muster', aktivitaeten: [] } as unknown as Kontakt;
    const r = terminSignale([anna], [{ id: 'x', titel: 'Termin Anna Muster', start: '2026-10-01T09:00:00', abgesagt: true }, { id: 'y', titel: 'Anna Muster Folge', start: '2026-12-01T09:00:00', abgesagt: true }], '2026-10-05T10:00:00Z');
    expect(r).toEqual({ vergangen: [] });
  });
});

describe('#47 Farbe gespiegelt, #96 Maskierung ohne UID', () => {
  it('Abgleich sichert COLOR im Bezug; fehlt COLOR in Apple, kommt sie aus der Sicherung', () => {
    const plan = bezugAbgleichPlan([{ uid: 'f', schluessel: 'home|f', zusatz: { art: 'fokus', farbe: 'tomato' } }], { bezuege: {} }, '2026-10-01T00:00:00Z');
    expect(plan['home|f']).toMatchObject({ art: 'fokus', farbe: 'tomato' });
    const ohneFarbe = termineAus(obj(vcal(ev('f', 'DTSTART;TZID=Europe/Berlin:20261005T090000', 'DTEND;TZID=Europe/Berlin:20261005T100000', 'SUMMARY:F'))), KAL, '2026-10-05', '2026-10-06')[0];
    expect(mitBezug(ohneFarbe, { bezuege: plan })).toMatchObject({ farbeId: 'tomato' });
  });
  it('maskiert: keine echte UID nach außen; fremdPrivat nur für die andere Person', () => {
    const t = { ...termineAus(obj(vcal(ev('geheim', 'DTSTART;TZID=Europe/Berlin:20261005T090000', 'DTEND;TZID=Europe/Berlin:20261005T100000', 'CLASS:PRIVATE', 'SUMMARY:Arzt'))), KAL, '2026-10-05', '2026-10-06')[0], wer: 'kevin' };
    const m = maskieren(t, 'malin');
    expect(m).toMatchObject({ titel: 'Belegt', maskiert: true, bearbeitbar: false });
    expect(JSON.stringify(m)).not.toContain('geheim');
    expect(fremdPrivat(t, 'malin')).toBe(true);
    expect(fremdPrivat(t, 'kevin')).toBe(false);
  });
});

describe('#43/#50/#51 Abgleich: gekürzt, Backoff, Alter', () => {
  it('#43 eine gekürzte Antwort (507) wird erkannt, nicht still übersprungen', () => {
    expect(unvollstaendig('<d:multistatus xmlns:d="DAV:"><d:response><d:href>/k/</d:href><d:status>HTTP/1.1 507 Insufficient Storage</d:status></d:response></d:multistatus>')).toMatch(/gekürzt/);
    expect(unvollstaendig('<d:multistatus xmlns:d="DAV:"><d:number-of-matches-within-limits/></d:multistatus>')).toMatch(/gekürzt/);
    expect(unvollstaendig('<d:multistatus xmlns:d="DAV:"><d:response><d:href>/a.ics</d:href><d:propstat><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>')).toBeNull();
  });
  it('#50 Pause: exponentiell 2 → 30 Min., nie kürzer als Retry-After; Anmeldung 30 Min.', () => {
    expect([1, 2, 3, 4, 5, 9].map(n => pauseMs(n, false) / 60_000)).toEqual([2, 4, 8, 16, 30, 30]);
    expect(pauseMs(1, false, 600)).toBe(600_000);
    expect(pauseMs(1, true)).toBe(30 * 60_000);
    expect(retryAfterSekunden('120')).toBe(120);
    expect(retryAfterSekunden(new Date(Date.parse('2026-10-05T10:05:00Z')).toUTCString(), Date.parse('2026-10-05T10:00:00Z'))).toBe(300);
    const jetzt = Date.parse('2026-10-05T10:00:00Z');
    const s: IcloudStand = { at: '2026-10-05T09:00:00Z', fehlerAt: '2026-10-05T09:59:00Z', pauseBis: '2026-10-05T10:07:00Z', kalender: [], objekte: {} };
    expect(naechsterVersuchFaellig(s, jetzt)).toBe(false);
    expect(naechsterVersuchFaellig(s, jetzt + 8 * 60_000)).toBe(true);
  });
  it('#51 „letzter Abgleich vor X Min.“, ab 30 Min. veraltet; HOI meldet es', () => {
    const jetzt = Date.parse('2026-10-05T10:00:00Z');
    expect(abgleichAlter({ at: '2026-10-05T09:50:00Z' }, jetzt)).toMatchObject({ vorMin: 10, veraltet: false });
    const alt = abgleichAlter({ at: '2026-10-05T09:15:00Z', fehler: 'iCloud nicht erreichbar.', fehlerAt: '2026-10-05T09:58:00Z', hinweise: [{ kalender: 'Geteilt', grund: '403' }] }, jetzt);
    expect(alt).toMatchObject({ vorMin: 45, veraltet: true, fehler: 'iCloud nicht erreichbar.' });
    expect(abgleichAlter({}, jetzt)).toMatchObject({ vorMin: null, veraltet: true });
    const b = kalenderBefunde({ vorMin: 45, veraltet: true, hinweise: 1, fehler: 'x', sicherung: { letzter: '2026-10-05T01:00:00Z', kalender: 2, fehler: 0 } }, '2026-10-05T10:00:00Z');
    expect(b.find(x => x.id === 'kalender')).toMatchObject({ ampel: 'gelb' });
    expect(b.find(x => x.id === 'kalender-sicherung')).toMatchObject({ ampel: 'gruen' });
    expect(kalenderBefunde({ vorMin: 5, veraltet: false, hinweise: 0, anmeldung: true }, '2026-10-05T10:00:00Z')[0].ampel).toBe('rot');
  });
});

describe('#8 Erinnerungen: reines Datum', () => {
  it('reines Datum bleibt der Tag ohne Uhrzeit, Wandzeit ohne Zone gilt als Berlin, mit Zone wird umgerechnet', () => {
    expect(faelligWand('2026-10-05', wandzeit)).toBe('2026-10-05T00:00:00');
    expect(faelligWand('2026-10-05T09:30:00', wandzeit)).toBe('2026-10-05T09:30:00');
    expect(faelligWand('2026-10-05T07:30:00Z', wandzeit)).toBe('2026-10-05T09:30:00');
    expect(faelligWand('Quatsch', wandzeit)).toBeNull();
    const e = erinnerungen([{ id: 'r1', title: 'Müll', due: '2026-10-05' }], '2026-10-05', '2026-10-06', wandzeit);
    expect(e).toEqual([{ id: 'er-r1', tag: '2026-10-05', titel: 'Müll' }]);
  });
});

describe('#K5 Sicherung (rein): Export als ICS, Probelauf, Teilnehmer-Sperre, Frist', () => {
  const a = vcal(ev('a', 'DTSTART;TZID=Europe/Berlin:20261005T090000', 'DTEND;TZID=Europe/Berlin:20261005T100000', 'SUMMARY:A'));
  const b = vcal(ev('b', 'DTSTART;TZID=America/New_York:20261006T090000', 'DTEND;TZID=America/New_York:20261006T100000', 'SUMMARY:B'));
  const g = vcal(ev('g', 'DTSTART;TZID=Europe/Berlin:20261007T090000', 'DTEND;TZID=Europe/Berlin:20261007T100000', 'ORGANIZER:mailto:kevin@example.invalid', 'ATTENDEE:mailto:gast@example.invalid', 'SUMMARY:Mit Gast'));
  it('eine Datei je Kalender; zurück je UID; Plan zählt nur und sperrt Termine mit Gästen', () => {
    const x = exportIcs([obj(a), obj(b), obj(g), obj('kaputt')], 'Privat Kevin');
    expect(x).toMatchObject({ termine: 3, unlesbar: 1 });
    expect(x.ics).toContain('X-WR-CALNAME:Privat Kevin');
    const zurueck = objekteAusIcs(x.ics);
    expect(zurueck.map(o => o.uid).sort()).toEqual(['a', 'b', 'g']);
    expect(termineAus(obj(zurueck.find(o => o.uid === 'b')!.ics), KAL, '2026-10-06', '2026-10-07')[0].start).toBe('2026-10-06T15:00:00');
    expect(mitTeilnehmern(g)).toBe(true);
    // In iCloud: a unverändert, b und g gelöscht, c neu.
    const c = vcal(ev('c', 'DTSTART;TZID=Europe/Berlin:20261008T090000', 'DTEND;TZID=Europe/Berlin:20261008T100000', 'SUMMARY:C'));
    const plan = wiederherstellPlan(zurueck, [{ uid: 'a', ics: a }, { uid: 'c', ics: c }]);
    expect(plan).toEqual({ fehlt: ['b'], gesperrt: ['g'], geaendert: [], gleich: 1, neu: 1 });
  });
  it('Frist 14 Tage nach dem Tag im Namen; fällig einmal je Berliner Tag ab 03:00', () => {
    const d = (t: string) => exportDatei('home', t);
    expect(d('2026-10-05')).toBe('kalender-export-home-2026-10-05.json');
    expect(abgelaufen([d('2026-09-20'), d('2026-09-21'), d('2026-10-05'), 'crm-vorher.json'], '2026-10-05', tagPlus)).toEqual([d('2026-09-20')]);
    expect(sicherungFaellig(undefined, '2026-10-05T02:59:00')).toBe(false);
    expect(sicherungFaellig('2026-10-04', '2026-10-05T03:00:00')).toBe(true);
    expect(sicherungFaellig('2026-10-05', '2026-10-05T23:00:00')).toBe(false);
  });
  it('U1 M4: nur 03:00–04:59, frühestens 30 Min. nach dem Start, nie in einer iCloud-Pause', () => {
    expect(sicherungFaellig('2026-10-04', '2026-10-05T04:59:00')).toBe(true);
    expect(sicherungFaellig('2026-10-04', '2026-10-05T05:00:00')).toBe(false);
    expect(sicherungFaellig('2026-10-04', '2026-10-05T23:00:00')).toBe(false);
    expect(sicherungFaellig('2026-10-04', '2026-10-05T03:10:00', { laufzeitMs: 29 * 60_000 })).toBe(false);
    expect(sicherungFaellig('2026-10-04', '2026-10-05T03:10:00', { laufzeitMs: 30 * 60_000 })).toBe(true);
    const jetztMs = Date.parse('2026-10-05T01:10:00Z');
    expect(sicherungFaellig('2026-10-04', '2026-10-05T03:10:00', { pauseBis: '2026-10-05T01:20:00Z', jetztMs })).toBe(false);
    expect(sicherungFaellig('2026-10-04', '2026-10-05T03:10:00', { pauseBis: '2026-10-05T01:00:00Z', jetztMs })).toBe(true);
  });
});
