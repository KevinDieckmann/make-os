// Kalender K1 (29.09.): Termin-Modell nach Google-Vorbild — Arten, Farbe, frei/beschäftigt, Sichtbarkeit, Zeitzone,
// volle Wiederholung, mehrere Erinnerungen, Arbeitsort; Bezug-Bestand (nur Kennungen) mit Sicherung; Eingaben der Route.
// Alle Daten erfunden.
import { describe, it, expect } from 'vitest';
import { baueTermin, termineAus, aendereTermin, icsZusatz, objektKurz } from '../lib/kalender/ics';
import { rruleText, wiederholungSauber, wiederholungBeschreiben, wiederholungVorlagen, wochentagNr } from '../lib/kalender/wiederholung';
import { gmtText, ausWandzeitIn, wandzeitIn, vtimezoneText, zoneGueltig } from '../lib/kalender/zeitzone';
import { farbeSauber, farbeHex, arbeitsortAusTitel, arbeitsortTitel, erinnerungenSauber, erinnerungText, beschaeftigtStandard } from '../lib/kalender/arten';
import { bezugSauber, bezugAendern, mitBezug, maskieren, eigentuemer, bezugAbgleichPlan, artVerloren, kennungenVon } from '../lib/kalender/bezug';
import { anlegenPruefen, aendernPruefen } from '../lib/kalender/eingabe';

const KAL = { id: 'https://p42-caldav.icloud.com/1/calendars/home/', name: 'Privat Kevin', farbe: '#1BADF8', schreibbar: true };
const J = '2026-09-29T10:00:00.000Z';

describe('Wiederholung (voll)', () => {
  it('RRULE: Wochentage sortiert, Monatstag, letzter Tag, n-ter Wochentag, ganztägiges Ende als Datum', () => {
    expect(rruleText({ freq: 'WEEKLY', intervall: 2, tage: ['WE', 'MO', 'MO'], anzahl: 10 })).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10;WKST=MO');
    expect(rruleText({ freq: 'MONTHLY', monatstag: -1 })).toBe('FREQ=MONTHLY;BYMONTHDAY=-1;WKST=MO');
    expect(rruleText({ freq: 'MONTHLY', monatstag: 15, bis: '2026-12-31' })).toBe('FREQ=MONTHLY;BYMONTHDAY=15;UNTIL=20261231T225959Z;WKST=MO');
    expect(rruleText({ freq: 'MONTHLY', wochentagImMonat: { nr: -1, tag: 'TU' } })).toBe('FREQ=MONTHLY;BYDAY=-1TU;WKST=MO');
    expect(rruleText({ freq: 'YEARLY', bis: '2030-01-01' }, true)).toBe('FREQ=YEARLY;UNTIL=20300101;WKST=MO');
  });
  it('säubert fremde Eingaben', () => {
    expect(wiederholungSauber({ freq: 'WEEKLY', tage: ['FR', 'XX', 'MO'], intervall: '3', anzahl: 0, bis: '2026-12-01' })).toEqual({ freq: 'WEEKLY', tage: ['MO', 'FR'], intervall: 3, bis: '2026-12-01' });
    expect(wiederholungSauber({ freq: 'MONTHLY', wochentagImMonat: { nr: 2, tag: 'TH' }, monatstag: 3 })).toEqual({ freq: 'MONTHLY', wochentagImMonat: { nr: 2, tag: 'TH' } });
    expect(wiederholungSauber({ freq: 'MONTHLY', monatstag: 40 })).toEqual({ freq: 'MONTHLY' });
    expect(wiederholungSauber({ freq: 'HOURLY' })).toBeNull();
  });
  it('in Worten und als Vorlagen wie Google (Di, 29.09.2026 = 5. und letzter Dienstag)', () => {
    expect(wochentagNr('2026-09-29')).toEqual({ nr: 5, letzter: true });
    expect(wiederholungBeschreiben({ freq: 'WEEKLY', tage: ['MO', 'TU', 'WE', 'TH', 'FR'] }, '2026-09-29')).toBe('Jeden Werktag (Mo–Fr)');
    expect(wiederholungBeschreiben({ freq: 'WEEKLY', intervall: 2, tage: ['MO', 'WE'], anzahl: 6 }, '2026-09-29')).toBe('Alle 2 Wochen am Mo, Mi, 6-mal');
    expect(wiederholungBeschreiben({ freq: 'MONTHLY', monatstag: -1, bis: '2027-03-31' }, '2026-09-30')).toBe('Monatlich am letzten Tag, bis 31.3.2027');
    expect(wiederholungBeschreiben({ freq: 'YEARLY' }, '2026-09-29')).toBe('Jährlich am 29. September');
    const v = wiederholungVorlagen('2026-09-29').map(x => x.label);
    expect(v).toEqual(['Wiederholt sich nicht', 'Täglich', 'Wöchentlich am Dienstag', 'Monatlich am letzten Dienstag', 'Monatlich am 29.', 'Jährlich am 29. September', 'Jeden Werktag (Mo–Fr)', 'Benutzerdefiniert …']);
    expect(wiederholungVorlagen('2026-09-08').map(x => x.label)).toContain('Monatlich am 2. Dienstag');
    expect(wiederholungVorlagen('2026-09-30').map(x => x.label)).toContain('Monatlich am letzten Tag');
  });
});

describe('Zeitzonen', () => {
  it('GMT-Text wie Google und Wandzeit in fremden Zonen', () => {
    expect(gmtText('Europe/Berlin', new Date('2026-09-29T10:00:00Z'))).toBe('GMT+02');
    expect(gmtText('Europe/Berlin', new Date('2026-12-01T10:00:00Z'))).toBe('GMT+01');
    expect(gmtText('America/New_York', new Date('2026-09-29T10:00:00Z'))).toBe('GMT-04');
    expect(gmtText('Asia/Kolkata', new Date('2026-09-29T10:00:00Z'))).toBe('GMT+05:30');
    expect(gmtText('UTC', new Date('2026-09-29T10:00:00Z'))).toBe('GMT+00');
    expect(ausWandzeitIn('2026-09-29T10:00:00', 'America/New_York').toISOString()).toBe('2026-09-29T14:00:00.000Z');
    expect(wandzeitIn(new Date('2026-03-29T01:30:00Z'), 'Europe/London')).toBe('2026-03-29T02:30:00');
    expect(zoneGueltig('America/New_York')).toBe(true);
    expect(zoneGueltig('Mars/Olympus')).toBe(false);
    expect(zoneGueltig('../../etc')).toBe(false);
  });
  it('VTIMEZONE aus den Zonendaten: Jahresregeln bzw. nur Standard', () => {
    const london = vtimezoneText('Europe/London', 2026);
    expect(london).toContain('TZID:Europe/London');
    expect(london).toContain('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU');
    expect(london).toContain('DTSTART:19700329T010000');
    expect(london).toContain('RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU');
    const ny = vtimezoneText('America/New_York', 2026);
    expect(ny).toContain('BYMONTH=3;BYDAY=2SU'); expect(ny).toContain('BYMONTH=11;BYDAY=1SU'); expect(ny).toContain('TZOFFSETTO:-0400');
    const tokio = vtimezoneText('Asia/Tokyo', 2026);
    expect(tokio).toContain('BEGIN:STANDARD'); expect(tokio).not.toContain('DAYLIGHT'); expect(tokio).toContain('TZOFFSETTO:+0900');
  });
});

describe('Termin-Modell (ICS)', () => {
  it('Fokuszeit in New York: Art, Farbe, privat, beschäftigt, Zone, zwei Erinnerungen — und keine Bezüge im Termin', () => {
    const ics = baueTermin({ uid: 'f-1', titel: 'Deep Work', start: '2026-09-30T10:00', ende: '2026-09-30T11:30', art: 'fokus', farbe: 'tomato', sichtbarkeit: 'privat', zone: 'America/New_York', erinnerungenMin: [60, 10, 10] }, new Date(J));
    expect(ics).toContain('X-MAKE-ART:fokus'); expect(ics).toContain('COLOR:tomato'); expect(ics).toContain('CLASS:PRIVATE'); expect(ics).toContain('TRANSP:OPAQUE');
    expect(ics).toContain('DTSTART;TZID=America/New_York:20260930T100000');
    expect(ics).toContain('BEGIN:VTIMEZONE\r\nTZID:America/New_York');
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(ics).not.toMatch(/aufgabe|mandat|kontakt|X-MAKEOS/i);
    const [t] = termineAus({ href: '/f-1.ics', etag: 'e7', ics }, KAL, '2026-09-30', '2026-10-01');
    expect(t).toMatchObject({ art: 'fokus', farbeId: 'tomato', farbeEigen: farbeHex('tomato'), sichtbarkeit: 'privat', beschaeftigt: true, zone: 'America/New_York', erinnerungen: [10, 60], stand: 'e7', start: '2026-09-30T16:00:00', ende: '2026-09-30T17:30:00' });
    expect(icsZusatz(ics)).toEqual({ art: 'fokus', farbe: 'tomato', sichtbarkeit: 'privat' });
    expect(objektKurz(ics)).toMatchObject({ uid: 'f-1', tag: '2026-09-30', zusatz: { art: 'fokus' } });
  });
  it('Arbeitsort: ganztägig, frei, Titel = Ort; Abwesend: beschäftigt', () => {
    const ics = baueTermin({ uid: 'o-1', titel: 'egal', start: '2026-09-30', ende: '2026-10-01', ganztags: true, art: 'arbeitsort', arbeitsort: { art: 'home' } });
    expect(ics).toContain('SUMMARY:Home'); expect(ics).toContain('TRANSP:TRANSPARENT'); expect(ics).toContain('X-MAKE-ART:arbeitsort');
    const [t] = termineAus({ href: '/o-1.ics', ics }, KAL, '2026-09-30', '2026-10-01');
    expect(t).toMatchObject({ art: 'arbeitsort', arbeitsort: { art: 'home' }, beschaeftigt: false, ganztags: true });
    const ab = baueTermin({ uid: 'a-1', titel: 'Urlaub', start: '2026-10-05', ende: '2026-10-10', ganztags: true, art: 'abwesend' });
    expect(ab).toContain('TRANSP:OPAQUE');
    expect(termineAus({ href: '/a.ics', ics: ab }, KAL, '2026-10-05', '2026-10-06')[0]).toMatchObject({ art: 'abwesend', beschaeftigt: true });
  });
  it('Apple-Termin ohne Zusätze: Termin, mit Zeit beschäftigt, ganztägig frei, Standard-Sichtbarkeit', () => {
    const roh = (d: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:x\r\nDTSTAMP:20260901T100000Z\r\n${d}\r\nSUMMARY:Apple\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    expect(termineAus({ href: '/x', ics: roh('DTSTART:20260930T080000Z\r\nDTEND:20260930T090000Z') }, KAL, '2026-09-30', '2026-10-01')[0]).toMatchObject({ art: 'termin', beschaeftigt: true, sichtbarkeit: 'standard' });
    expect(termineAus({ href: '/x', ics: roh('DTSTART;VALUE=DATE:20260930\r\nDTEND;VALUE=DATE:20261001') }, KAL, '2026-09-30', '2026-10-01')[0]).toMatchObject({ beschaeftigt: false });
    expect(icsZusatz(roh('DTSTART:20260930T080000Z\r\nCOLOR:gold'))).toBeNull();
  });
  it('ändern: Farbe, Art, frei/beschäftigt, Sichtbarkeit — Serie weiter nur in Apple', () => {
    const ics = baueTermin({ uid: 'e-1', titel: 'Termin', start: '2026-09-30T10:00', ende: '2026-09-30T11:00', farbe: 'gold', sichtbarkeit: 'privat' });
    const r = aendereTermin(ics, { farbe: null, art: 'abwesend', beschaeftigt: false, sichtbarkeit: 'standard' }) as { ics: string };
    expect(r.ics).not.toContain('COLOR'); expect(r.ics).not.toContain('CLASS'); expect(r.ics).toContain('X-MAKE-ART:abwesend'); expect(r.ics).toContain('TRANSP:TRANSPARENT');
    const serie = baueTermin({ uid: 's', titel: 'S', start: '2026-09-30T10:00', ende: '2026-09-30T11:00', wiederholung: { freq: 'WEEKLY' } });
    expect(aendereTermin(serie, { farbe: 'gold' })).toEqual({ fehler: expect.stringContaining('Serientermin') });
  });
});

describe('Arten, Farben, Erinnerungen', () => {
  it('Farbe nach RFC 7986 (CSS-Name) oder Hex; Arbeitsort aus dem Titel; Erinnerungen gesäubert', () => {
    expect(farbeSauber('Tomato')).toBe('tomato'); expect(farbeSauber('#AABBCC')).toBe('#aabbcc'); expect(farbeSauber('rot')).toBeUndefined();
    expect(arbeitsortAusTitel('Büro')).toEqual({ art: 'buero' }); expect(arbeitsortAusTitel('Kanzlei Müller')).toEqual({ art: 'frei', text: 'Kanzlei Müller' });
    expect(arbeitsortTitel({ art: 'kunde' })).toBe('Beim Kunden');
    expect(erinnerungenSauber([30, 10, 10, -5, 99999, 0, 1, 2, 3])).toEqual([0, 1, 2, 3, 10]);
    expect(erinnerungText(1440)).toBe('1 Tag vorher'); expect(erinnerungText(0)).toBe('Zu Beginn');
    expect(beschaeftigtStandard('termin', true)).toBe(false); expect(beschaeftigtStandard('fokus', true)).toBe(true);
  });
});

describe('Bezug (Neben-Bestand, nur Kennungen)', () => {
  const termin = baueTermin({ uid: 'b-1', titel: 'Fokus', start: '2026-09-30T10:00', ende: '2026-09-30T11:00' });
  const [t] = termineAus({ href: '/b', ics: termin }, KAL, '2026-09-30', '2026-10-01');
  it('säubert: nur Kennungen, Person, Sicherung; ohne Inhalt → null', () => {
    expect(bezugSauber({ aufgabeId: 't-1', mandatId: 'm 1', titel: 'Geheim', von: 'kevin', art: 'fokus', privat: true, tag: '2026-09-30' }, J)).toEqual({ aufgabeId: 't-1', von: 'kevin', art: 'fokus', privat: true, tag: '2026-09-30', geaendert: J });
    expect(bezugSauber({ tag: '2026-09-30' }, J)).toBeNull();
    expect(bezugAendern({ aufgabeId: 't-1', geaendert: J }, { aufgabeId: null }, J)).toBeNull();
    expect(bezugAendern({ aufgabeId: 't-1', geaendert: J }, { mandatId: 'm-1', privat: null }, J)).toEqual({ aufgabeId: 't-1', mandatId: 'm-1', geaendert: J });
    expect(kennungenVon({ kontaktId: 'c-1', von: 'kevin' } as never)).toEqual({ kontaktId: 'c-1' });
  });
  it('Sicherung: Art zurück, wenn Apple X-MAKE-ART verlor; privat gilt, wenn eine Seite privat sagt', () => {
    const b = { bezuege: { 'b-1': { art: 'fokus' as const, privat: true as const, mandatId: 'm-1', von: 'malin', geaendert: J } } };
    expect(mitBezug(t, b)).toMatchObject({ art: 'fokus', sichtbarkeit: 'privat', bezug: { mandatId: 'm-1' }, von: 'malin' });
    expect(mitBezug({ ...t, art: 'abwesend' }, b).art).toBe('abwesend');
    expect(mitBezug(t, null)).toBe(t);
    expect(artVerloren([{ uid: 'b-1', zusatz: null }], b)).toEqual(['b-1']);
    expect(artVerloren([{ uid: 'b-1', zusatz: { art: 'fokus' } }], b)).toEqual([]);
  });
  it('privat: die andere Person sieht nur „Belegt“ — die Eigentümerin alles', () => {
    const p = { ...t, sichtbarkeit: 'privat' as const, ort: 'Praxis', notiz: 'x', bezug: { kontaktId: 'c-1' }, wer: 'beide', von: 'malin' };
    expect(eigentuemer(p)).toBe('malin'); expect(eigentuemer({ wer: 'kevin' })).toBe('kevin'); expect(eigentuemer({ wer: 'beide' })).toBeUndefined();
    const fremd = maskieren(p, 'kevin');
    expect(fremd).toMatchObject({ titel: 'Belegt', bearbeitbar: false, maskiert: true, start: p.start });
    expect(fremd.ort).toBeUndefined(); expect(fremd.bezug).toBeUndefined(); expect(fremd.notiz).toBeUndefined();
    expect(maskieren(p, 'malin')).toBe(p);
    expect(maskieren({ ...p, von: undefined }, 'kevin')).toMatchObject({ titel: 'Fokus' });
  });
  it('Abgleich: Termine mit X-MAKE-ART ohne Eintrag bekommen die Sicherung, Starttage werden nachgezogen', () => {
    const plan = bezugAbgleichPlan([
      { uid: 'neu', tag: '2026-10-01', zusatz: { art: 'abwesend', sichtbarkeit: 'privat' } },
      { uid: 'apple', tag: '2026-10-01', zusatz: null },
      { uid: 'alt', tag: '2026-10-02', zusatz: { art: 'fokus' } },
    ], { bezuege: { alt: { art: 'fokus', tag: '2026-10-01', geaendert: J } } }, J);
    expect(plan).toEqual({ neu: { art: 'abwesend', privat: true, tag: '2026-10-01', geaendert: J }, alt: { art: 'fokus', tag: '2026-10-02', geaendert: J } });
  });
});

describe('Eingaben der Termin-Route', () => {
  it('anlegen: Arbeitsort wird Titel, Abwesend immer beschäftigt, Zone/Wiederholung/Sichtbarkeit geprüft, Bezug nur Kennungen', () => {
    const a = anlegenPruefen({ art: 'arbeitsort', arbeitsort: { art: 'buero' }, start: '2026-09-30', ende: '2026-10-01', ganztags: true });
    expect(a).toMatchObject({ ok: true, e: { titel: 'Büro', beschaeftigt: false, zone: 'Europe/Berlin' } });
    expect(anlegenPruefen({ art: 'abwesend', titel: 'Reha', start: '2026-09-30T08:00', ende: '2026-09-30T12:00', beschaeftigt: false })).toMatchObject({ ok: true, e: { beschaeftigt: true, art: 'abwesend' } });
    expect(anlegenPruefen({ titel: 'X', start: '2026-09-30T08:00', ende: '2026-09-30T09:00', zone: 'Mars/X' })).toEqual({ ok: false, fehler: 'Unbekannte Zeitzone.' });
    expect(anlegenPruefen({ titel: 'X', start: '2026-09-30T08:00', ende: '2026-09-30T09:00', wiederholung: { freq: 'SELTEN' } })).toEqual({ ok: false, fehler: 'Wiederholung unvollständig.' });
    expect(anlegenPruefen({ titel: 'X', start: '2026-09-30T09:00', ende: '2026-09-30T08:00' }).ok).toBe(false);
    const b = anlegenPruefen({ titel: 'Kunde', start: '2026-09-30T08:00', ende: '2026-09-30T09:00', erinnerungMin: 15, erinnerungenMin: [60], bezug: { kontaktId: 'c-1', titel: 'Name' }, sichtbarkeit: 'privat', farbe: 'gold' });
    expect(b).toMatchObject({ ok: true, e: { erinnerungenMin: [15, 60], bezug: { kontaktId: 'c-1' }, sichtbarkeit: 'privat', farbe: 'gold' } });
  });
  it('ändern: Termin-Felder und Bezug getrennt, Stand wird mitgenommen', () => {
    expect(aendernPruefen({ uid: 'u', stand: 'e1', farbe: '', art: 'fokus', bezug: { aufgabeId: 't-1', mandatId: null } })).toEqual({ ok: true, e: { uid: 'u', stand: 'e1', termin: { art: 'fokus', farbe: null }, bezug: { aufgabeId: 't-1', mandatId: null }, einladungBestaetigt: false } });
    expect(aendernPruefen({ uid: 'u', bezug: { aufgabeId: '../x y' } })).toEqual({ ok: false, fehler: 'Ungültige Kennung (aufgabeId).' });
    expect(aendernPruefen({ uid: 'u', farbe: 'lila' })).toEqual({ ok: false, fehler: 'Unbekannte Farbe.' });
  });
});
