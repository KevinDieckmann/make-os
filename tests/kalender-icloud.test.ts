// Kalender über iCloud (25.09.): Wandzeit, WebDAV-Antworten, Serien, Schreiben.
import { describe, it, expect } from 'vitest';
import { wandzeit, ausWandzeit, wandAus, minutenVon, tagPlus } from '../lib/kalender/zeit';
import { antworten, istTerminKalender, text } from '../lib/kalender/dav';
import { termineAus, baueTermin, aendereTermin, uidVon, nichtBearbeitbar } from '../lib/kalender/ics';

const KAL = { id: 'https://p42-caldav.icloud.com/123/calendars/home/', name: 'Privat Kevin', farbe: '#1BADF8', schreibbar: true };
const vcal = (inhalt: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Apple Inc.//iPhone OS 18//EN\r\n${inhalt}\r\nEND:VCALENDAR`;
const BERLIN = `BEGIN:VTIMEZONE\r\nTZID:Europe/Berlin\r\nBEGIN:DAYLIGHT\r\nTZOFFSETFROM:+0100\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\nDTSTART:19810329T020000\r\nTZNAME:MESZ\r\nTZOFFSETTO:+0200\r\nEND:DAYLIGHT\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:+0200\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\nDTSTART:19961027T030000\r\nTZNAME:MEZ\r\nTZOFFSETTO:+0100\r\nEND:STANDARD\r\nEND:VTIMEZONE`;

describe('Wandzeit Berlin', () => {
  it('rechnet über die Zeitumstellung, unabhängig von der Zone der Maschine', () => {
    expect(wandzeit(new Date('2026-09-25T07:30:00Z'))).toBe('2026-09-25T09:30:00');
    expect(wandzeit(new Date('2026-12-01T07:30:00Z'))).toBe('2026-12-01T08:30:00');
    expect(ausWandzeit('2026-10-25T09:00').toISOString()).toBe('2026-10-25T08:00:00.000Z');
    expect(ausWandzeit('2026-10-24T09:00:00').toISOString()).toBe('2026-10-24T07:00:00.000Z');
    expect(wandAus('2026-09-25', 23 * 60 + 30 + 60)).toBe('2026-09-26T00:30:00');
    expect(minutenVon('2026-09-25T14:45:00')).toBe(885);
    expect(tagPlus('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('WebDAV-Antworten', () => {
  const XML = `<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:">
 <response><href>/123/calendars/home/</href>
  <propstat><prop><displayname>Privat Kevin</displayname><resourcetype><collection/><calendar xmlns="urn:ietf:params:xml:ns:caldav"/></resourcetype>
   <getctag xmlns="http://calendarserver.org/ns/">HwoQEgwAAA</getctag><calendar-color xmlns="http://apple.com/ns/ical/">#1BADF8FF</calendar-color>
   <supported-calendar-component-set xmlns="urn:ietf:params:xml:ns:caldav"><comp name="VEVENT"/></supported-calendar-component-set></prop><status>HTTP/1.1 200 OK</status></propstat>
  <propstat><prop><getetag/></prop><status>HTTP/1.1 404 Not Found</status></propstat>
 </response>
 <response><href>/123/calendars/tasks/</href><propstat><prop><displayname>Erinnerungen</displayname><resourcetype><collection/><calendar xmlns="urn:ietf:params:xml:ns:caldav"/></resourcetype>
   <supported-calendar-component-set xmlns="urn:ietf:params:xml:ns:caldav"><comp name="VTODO"/></supported-calendar-component-set></prop><status>HTTP/1.1 200 OK</status></propstat></response>
 <response><href>/123/calendars/inbox/</href><propstat><prop><displayname>Inbox</displayname><resourcetype><collection/><schedule-inbox xmlns="urn:ietf:params:xml:ns:caldav"/></resourcetype></prop><status>HTTP/1.1 200 OK</status></propstat></response>
</multistatus>`;
  it('liest Kalender mit jedem Präfix; nur Termin-Kalender zählen', () => {
    const a = antworten(XML, ['displayname', 'resourcetype', 'getctag', 'calendar-color', 'supported-calendar-component-set', 'getetag']);
    expect(a.map(x => x.href)).toEqual(['/123/calendars/home/', '/123/calendars/tasks/', '/123/calendars/inbox/']);
    expect(a[0].props.displayname).toBe('Privat Kevin');
    expect(a[0].props.getctag).toBe('HwoQEgwAAA');
    expect(a[0].props.getetag).toBeUndefined();
    expect(a.map(x => istTerminKalender(x.props))).toEqual([true, false, false]);
  });
  it('Kalenderdaten: maskiert oder CDATA, mit d:-Präfix', () => {
    const r = `<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/123/calendars/home/a%20b.ics</d:href><d:propstat><d:prop><d:getetag>"C=1@U=2"</d:getetag>
<cal:calendar-data>BEGIN:VCALENDAR&#13;
SUMMARY:A &amp; B&#13;
END:VCALENDAR</cal:calendar-data></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
<d:response><d:href>/x.ics</d:href><d:propstat><d:prop><d:getetag>"9"</d:getetag><cal:calendar-data><![CDATA[BEGIN:VCALENDAR
END:VCALENDAR]]></cal:calendar-data></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`;
    const a = antworten(r, ['getetag', 'calendar-data']);
    expect(a[0].href).toBe('/123/calendars/home/a b.ics');
    expect(a[0].props['calendar-data']).toContain('SUMMARY:A & B');
    expect(a[1].props['calendar-data']).toBe('BEGIN:VCALENDAR\nEND:VCALENDAR');
    expect(text('<d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal>', 'href')).toBe('/123/principal/');
  });
});

describe('Termine aus iCalendar', () => {
  it('Einzeltermin in Berliner Zeit, bearbeitbar', () => {
    const ics = vcal(`${BERLIN}\r\nBEGIN:VEVENT\r\nUID:e1\r\nDTSTAMP:20260901T100000Z\r\nDTSTART;TZID=Europe/Berlin:20260926T093000\r\nDTEND;TZID=Europe/Berlin:20260926T110000\r\nSUMMARY:Steuerberater\r\nLOCATION:Hamburg\r\nEND:VEVENT`);
    const t = termineAus({ href: '/e1.ics', etag: '"1"', ics }, KAL, '2026-09-21', '2026-09-28');
    expect(t).toEqual([expect.objectContaining({ id: 'e1', titel: 'Steuerberater', start: '2026-09-26T09:30:00', ende: '2026-09-26T11:00:00', ganztags: false, ort: 'Hamburg', kalender: 'Privat Kevin', serie: false, bearbeitbar: true })]);
    expect(termineAus({ href: '/e1.ics', ics }, KAL, '2026-09-28', '2026-10-05')).toEqual([]);
  });
  it('Serie mit Ausnahme und gestrichenem Vorkommen, über die Zeitumstellung — nicht bearbeitbar', () => {
    const ics = vcal(`${BERLIN}\r\nBEGIN:VEVENT\r\nUID:s1\r\nDTSTAMP:20260901T100000Z\r\nDTSTART;TZID=Europe/Berlin:20260921T090000\r\nDTEND;TZID=Europe/Berlin:20260921T100000\r\nRRULE:FREQ=WEEKLY;COUNT=8\r\nEXDATE;TZID=Europe/Berlin:20260928T090000\r\nSUMMARY:Jour fixe\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:s1\r\nDTSTAMP:20260901T100000Z\r\nRECURRENCE-ID;TZID=Europe/Berlin:20261005T090000\r\nDTSTART;TZID=Europe/Berlin:20261005T110000\r\nDTEND;TZID=Europe/Berlin:20261005T120000\r\nSUMMARY:Jour fixe (verschoben)\r\nEND:VEVENT`);
    const t = termineAus({ href: '/s1.ics', ics }, KAL, '2026-09-21', '2026-11-03');
    expect(t.map(x => [x.start, x.titel])).toEqual([
      ['2026-09-21T09:00:00', 'Jour fixe'], ['2026-10-05T11:00:00', 'Jour fixe (verschoben)'], ['2026-10-12T09:00:00', 'Jour fixe'],
      ['2026-10-19T09:00:00', 'Jour fixe'], ['2026-10-26T09:00:00', 'Jour fixe'], ['2026-11-02T09:00:00', 'Jour fixe'],
    ]);
    expect(t.every(x => x.serie && !x.bearbeitbar)).toBe(true);
    expect(new Set(t.map(x => x.id)).size).toBe(t.length);
  });
  it('Ganztags: Tag 00:00, Ende exklusiv; Termin mit Teilnehmern nicht bearbeitbar', () => {
    const ics = vcal(`BEGIN:VEVENT\r\nUID:g1\r\nDTSTAMP:20260901T100000Z\r\nDTSTART;VALUE=DATE:20260930\r\nDTEND;VALUE=DATE:20261002\r\nSUMMARY:Messe\r\nATTENDEE;CN=Malin:mailto:malin@example.invalid\r\nEND:VEVENT`);
    const [t] = termineAus({ href: '/g1.ics', ics }, KAL, '2026-10-01', '2026-10-02');
    expect(t).toMatchObject({ start: '2026-09-30T00:00:00', ende: '2026-10-02T00:00:00', ganztags: true, mitTeilnehmern: true, bearbeitbar: false });
  });
});

describe('Schreiben', () => {
  it('neuer Termin: Berliner Zone, keine Teilnehmer, lesbar zurück', () => {
    const ics = baueTermin({ uid: 'neu-1', titel: 'Fokus: Markttraktion; Plan, neu', start: '2026-10-26T09:00:00', ende: '2026-10-26T10:30:00' }, new Date('2026-09-25T10:00:00Z'));
    expect(ics).toContain('DTSTART;TZID=Europe/Berlin:20261026T090000');
    expect(ics).toContain('SUMMARY:Fokus: Markttraktion\\; Plan\\, neu');
    expect(ics).not.toContain('ATTENDEE');
    const [t] = termineAus({ href: '/neu-1.ics', ics }, KAL, '2026-10-26', '2026-10-27');
    expect(t).toMatchObject({ titel: 'Fokus: Markttraktion; Plan, neu', start: '2026-10-26T09:00:00', ende: '2026-10-26T10:30:00', bearbeitbar: true });
    const g = baueTermin({ uid: 'neu-2', titel: 'Urlaub', start: '2026-10-01T00:00:00', ende: '2026-10-03T00:00:00', ganztags: true });
    expect(g).toContain('DTSTART;VALUE=DATE:20261001');
  });
  it('verschieben: Dauer bleibt, Zone bleibt, Rest bleibt; Serien und Einladungen nicht', () => {
    const ics = vcal(`${BERLIN}\r\nBEGIN:VEVENT\r\nUID:e1\r\nDTSTAMP:20260901T100000Z\r\nDTSTART;TZID=Europe/Berlin:20260926T093000\r\nDTEND;TZID=Europe/Berlin:20260926T110000\r\nSUMMARY:Steuerberater\r\nBEGIN:VALARM\r\nTRIGGER:-PT15M\r\nACTION:DISPLAY\r\nDESCRIPTION:Erinnerung\r\nEND:VALARM\r\nEND:VEVENT`);
    const r = aendereTermin(ics, { start: '2026-09-28T14:00:00' });
    expect('ics' in r).toBe(true);
    const neu = (r as { ics: string }).ics;
    const [t] = termineAus({ href: '/e1.ics', ics: neu }, KAL, '2026-09-28', '2026-09-29');
    expect(t).toMatchObject({ start: '2026-09-28T14:00:00', ende: '2026-09-28T15:30:00', titel: 'Steuerberater' });
    expect(neu).toContain('TRIGGER:-PT15M');
    expect(neu).toContain('DTSTART;TZID=Europe/Berlin:20260928T140000');
    expect(neu).toContain('SEQUENCE:1');
    const serie = ics.replace('SUMMARY:Steuerberater', 'SUMMARY:X\r\nRRULE:FREQ=DAILY');
    expect(aendereTermin(serie, { start: '2026-09-28T14:00:00' })).toEqual({ fehler: expect.stringContaining('Serientermin') });
    const einladung = ics.replace('SUMMARY:Steuerberater', 'SUMMARY:X\r\nATTENDEE:mailto:a@example.invalid');
    expect(aendereTermin(einladung, { titel: 'Y' })).toEqual({ fehler: expect.stringContaining('Teilnehmern') });
    expect(aendereTermin(ics, { start: '2026-09-28T14:00:00', ende: '2026-09-28T13:00:00' })).toEqual({ fehler: expect.stringContaining('Ende') });
    // Zeitzonen-RRULE und Alarm-ATTENDEE machen einen Einzeltermin nicht zur Serie/Einladung.
    const mitAlarm = ics.replace('ACTION:DISPLAY', 'ACTION:EMAIL\r\nATTENDEE:mailto:kevin@example.invalid');
    expect(nichtBearbeitbar(mitAlarm)).toBeNull();
    expect(nichtBearbeitbar(serie)).toMatch(/Serientermin/);
    expect(nichtBearbeitbar(einladung)).toMatch(/Teilnehmern/);
    expect(uidVon(ics)).toBe('e1');
    expect(uidVon('BEGIN:VEVENT\r\nUID:sehr-lange-uid-die-apple-auf-zwei-zeilen-umbricht-0123456789-abcdef\r\n ghij\r\nEND:VEVENT')).toBe('sehr-lange-uid-die-apple-auf-zwei-zeilen-umbricht-0123456789-abcdefghij');
  });
});
