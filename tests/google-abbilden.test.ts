// Google Kalender ⇄ MAKE OS: die Abbildung (rein). Google-Ereignis → ICS → `termineAus` (derselbe Kern wie iCloud):
// Einzeltermin, ganztägig, Serie mit EXDATE und Ausnahme, abgesagtes Vorkommen, Zeitumstellung 25.10.2026, Gäste,
// Meet-Link, Art/Sichtbarkeit; und die Gegenrichtung (Körper für insert/patch, eigene ID aus der UID).
import { describe, it, expect } from 'vitest';
import { objekteAus, schlank, eventIdFuer, neuBody, patchBody, antwortBody, htmlZuText, icsZeit, uidVonEvent, artVon, type GEvent } from '@/lib/kalender/google/abbilden';
import { termineAus } from '@/lib/kalender/ics';
import { kalenderKennung } from '@/lib/kalender/bezug';
import { ausnahmeAusId, aufraeumen } from '@/lib/kalender/google/abgleich';
import { ereignisseAnwenden } from '@/lib/kalender/google/stand';

const kal = { id: 'google:kalender/google-kevin', name: 'MAKE Kevin (Google)', schreibbar: true };
const ich = ['kevin@makeinnovation.test'];
const e = (x: Record<string, unknown>) => schlank(x) as GEvent;
const termine = (evs: GEvent[], von: string, bis: string) => {
  const { objekte } = objekteAus(Object.fromEntries(evs.map(x => [x.id, x])), 'kevin');
  return objekte.flatMap(o => termineAus(o, kal, von, bis, ich)).sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0));
};
const berlin = (tag: string, uhr: string, ende: string) => ({ start: { dateTime: `${tag}T${uhr}:00+02:00`, timeZone: 'Europe/Berlin' }, end: { dateTime: `${tag}T${ende}:00+02:00`, timeZone: 'Europe/Berlin' } });

describe('Kennung des Kalenders in MAKE OS', () => {
  it('google:kalender/google-<person> → Kennung google-<person> (eigener Schlüsselraum, nie mit iCloud verwechselt)', () => {
    expect(kalenderKennung(kal.id)).toBe('google-kevin');
  });
});

describe('Einzeltermin und ganztägig', () => {
  it('Titel, Zeit in Berliner Wandzeit, Ort, Notiz, Stand = ETag, Schlüssel google-kevin|uid', () => {
    const [t] = termine([e({ id: 'abc1', etag: '"7"', summary: 'Pitch, Teil 2; final', description: 'Agenda\nPunkt 1', location: 'Büro', ...berlin('2026-10-03', '14:00', '15:30') })], '2026-10-01', '2026-10-10');
    expect(t).toMatchObject({ id: 'google-kevin|abc1', uid: 'abc1', titel: 'Pitch, Teil 2; final', start: '2026-10-03T14:00:00', ende: '2026-10-03T15:30:00', ganztags: false, ort: 'Büro', stand: '"7"', bearbeitbar: true, serie: false, mitTeilnehmern: false });
    expect(t.notiz).toBe('Agenda\nPunkt 1');
  });
  it('ganztägig (date, Ende exklusiv) bleibt ganztägig und ist ohne Angabe „frei“ nur, wenn Google es so sagt', () => {
    const [t] = termine([e({ id: 'g1', summary: 'Messe', start: { date: '2026-10-05' }, end: { date: '2026-10-07' }, transparency: 'transparent' })], '2026-10-01', '2026-10-10');
    expect(t).toMatchObject({ ganztags: true, start: '2026-10-05T00:00:00', ende: '2026-10-07T00:00:00', beschaeftigt: false });
  });
  it('Zeitzone ohne timeZone: Offset → UTC, dieselbe Uhrzeit in Berlin', () => {
    const [t] = termine([e({ id: 'z1', summary: 'Call', start: { dateTime: '2026-10-03T12:00:00Z' }, end: { dateTime: '2026-10-03T13:00:00Z' } })], '2026-10-01', '2026-10-10');
    expect(t.start).toBe('2026-10-03T14:00:00');
  });
  it('andere Zone (New York): Anzeige in Berliner Wandzeit, die Zone des Termins bleibt erkennbar', () => {
    const [t] = termine([e({ id: 'ny', summary: 'NY', start: { dateTime: '2026-10-03T09:00:00-04:00', timeZone: 'America/New_York' }, end: { dateTime: '2026-10-03T10:00:00-04:00', timeZone: 'America/New_York' } })], '2026-10-01', '2026-10-10');
    expect(t.start).toBe('2026-10-03T15:00:00');
    expect(t.zone).toBe('America/New_York');
  });
  it('Meet-Link (hangoutLink) kommt als `link`, nur https', () => {
    const [t] = termine([e({ id: 'm1', summary: 'Meet', hangoutLink: 'https://meet.google.com/abc-defg-hij', ...berlin('2026-10-03', '10:00', '11:00') })], '2026-10-01', '2026-10-10');
    expect((t as { link?: string }).link).toBe('https://meet.google.com/abc-defg-hij');
    const [u] = termine([e({ id: 'm2', summary: 'Böse', hangoutLink: 'javascript:alert(1)', ...berlin('2026-10-03', '10:00', '11:00') })], '2026-10-01', '2026-10-10');
    expect((u as { link?: string }).link).toBeUndefined();
  });
});

describe('Zeitumstellung am 25.10.2026 (Einzeltermine)', () => {
  it('doppelte Stunde: 02:30 vor und nach der Umstellung sind zwei verschiedene Zeitpunkte — Reihenfolge nach dem echten Zeitpunkt', () => {
    const t = termine([
      e({ id: 'spaet', summary: 'Zweites 02:30', start: { dateTime: '2026-10-25T02:30:00+01:00', timeZone: 'Europe/Berlin' }, end: { dateTime: '2026-10-25T03:00:00+01:00', timeZone: 'Europe/Berlin' } }),
      e({ id: 'frueh', summary: 'Erstes 02:30', start: { dateTime: '2026-10-25T02:30:00+02:00', timeZone: 'Europe/Berlin' }, end: { dateTime: '2026-10-25T02:50:00+02:00', timeZone: 'Europe/Berlin' } }),
    ], '2026-10-24', '2026-10-27');
    expect(t.map(x => x.titel)).toEqual(['Erstes 02:30', 'Zweites 02:30']);
    expect(t[1].startMs! - t[0].startMs!).toBe(3600_000);
  });
  it('ein Termin über die Umstellung: 01:00 CEST bis 04:00 CET sind vier echte Stunden, die Wandzeit zeigt 01:00–04:00', () => {
    const [x] = termine([e({ id: 'lang', summary: 'Nachtschicht', start: { dateTime: '2026-10-25T01:00:00+02:00', timeZone: 'Europe/Berlin' }, end: { dateTime: '2026-10-25T04:00:00+01:00', timeZone: 'Europe/Berlin' } })], '2026-10-24', '2026-10-27');
    expect(x).toMatchObject({ start: '2026-10-25T01:00:00', ende: '2026-10-25T04:00:00' });
  });
  it('Schreiben um die Umstellung: Wandzeit + Zone gehen so zu Google — Google rechnet den Versatz (kein eigener Offset von uns)', () => {
    const b = neuBody({ uid: 'makeos-t-umstellung', titel: 'x', start: '2026-10-25T02:30:00', ende: '2026-10-25T03:30:00' }, true);
    expect(b.start).toEqual({ dateTime: '2026-10-25T02:30:00', timeZone: 'Europe/Berlin' });
    expect(JSON.stringify(b)).not.toMatch(/\+0[12]:00/);
  });
  it('Tageswechsel in der Zone: ein Termin 23:30 New York ist in Berlin schon der nächste Tag', () => {
    const [x] = termine([e({ id: 'ny2', summary: 'Spät', start: { dateTime: '2026-10-03T23:30:00-04:00', timeZone: 'America/New_York' }, end: { dateTime: '2026-10-04T00:30:00-04:00', timeZone: 'America/New_York' } })], '2026-10-03', '2026-10-06');
    expect(x.start).toBe('2026-10-04T05:30:00');
  });
});

describe('Serien', () => {
  const master = e({ id: 'serie1', etag: '"s1"', summary: 'Montagsrunde', recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=6'], ...berlin('2026-10-05', '10:00', '11:00') });
  it('wöchentlich über die Zeitumstellung am 25.10.2026: die Uhrzeit bleibt 10:00 Berliner Zeit', () => {
    const t = termine([master], '2026-10-01', '2026-11-30');
    expect(t.map(x => x.start)).toEqual(['2026-10-05T10:00:00', '2026-10-12T10:00:00', '2026-10-19T10:00:00', '2026-10-26T10:00:00', '2026-11-02T10:00:00', '2026-11-09T10:00:00']);
    expect(t.every(x => x.serie && !x.bearbeitbar)).toBe(true);
    // 10:00 CEST = 08:00 UTC, 10:00 CET = 09:00 UTC — der echte Zeitpunkt springt, die Wandzeit nicht.
    expect(new Date(t[2].startMs!).toISOString()).toBe('2026-10-19T08:00:00.000Z');
    expect(new Date(t[3].startMs!).toISOString()).toBe('2026-10-26T09:00:00.000Z');
  });
  it('abgesagtes Vorkommen (cancelled-Ausnahme) fällt als EXDATE weg', () => {
    const weg = e({ id: 'serie1_20261012T080000Z', status: 'cancelled', recurringEventId: 'serie1', originalStartTime: { dateTime: '2026-10-12T10:00:00+02:00', timeZone: 'Europe/Berlin' } });
    const t = termine([master, weg], '2026-10-01', '2026-11-30');
    expect(t.map(x => x.start.slice(0, 10))).not.toContain('2026-10-12');
    expect(t).toHaveLength(5);
  });
  it('verschobenes Vorkommen (Ausnahme mit anderer Zeit) ersetzt das Original; Titel der Ausnahme gilt', () => {
    const verschoben = e({ id: 'serie1_20261019T080000Z', recurringEventId: 'serie1', originalStartTime: { dateTime: '2026-10-19T10:00:00+02:00', timeZone: 'Europe/Berlin' }, summary: 'Montagsrunde (Ausnahme)', ...berlin('2026-10-20', '15:00', '16:00') });
    const t = termine([master, verschoben], '2026-10-01', '2026-11-30');
    expect(t.find(x => x.start === '2026-10-19T10:00:00')).toBeUndefined();
    expect(t.find(x => x.start === '2026-10-20T15:00:00')?.titel).toBe('Montagsrunde (Ausnahme)');
  });
  it('ganztägige Serie (date) bleibt ganztägig', () => {
    const t = termine([e({ id: 'ser2', summary: 'Homeoffice', recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=FR;COUNT=3'], start: { date: '2026-10-02' }, end: { date: '2026-10-03' } })], '2026-10-01', '2026-11-01');
    expect(t.map(x => x.start.slice(0, 10))).toEqual(['2026-10-02', '2026-10-09', '2026-10-16']);
    expect(t.every(x => x.ganztags)).toBe(true);
  });
  it('Ausnahme ohne Master im Bestand (Master außerhalb des Fensters) wird zum Einzeltermin', () => {
    const waise = e({ id: 'x_20261012T080000Z', recurringEventId: 'x', summary: 'Waise', ...berlin('2026-10-12', '10:00', '11:00') });
    const t = termine([waise], '2026-10-01', '2026-10-30');
    expect(t).toHaveLength(1);
    expect(t[0].serie).toBe(false);
  });
  it('Instanz-Kennung → Master und Original-Beginn (Fallback für abgesagte Vorkommen ohne Felder)', () => {
    expect(ausnahmeAusId('abc_20261012T080000Z')).toEqual({ recurringEventId: 'abc', originalStartTime: { dateTime: '2026-10-12T08:00:00Z' } });
    expect(ausnahmeAusId('abc_20261012')).toEqual({ recurringEventId: 'abc', originalStartTime: { date: '2026-10-12' } });
    expect(ausnahmeAusId('keineinstanz')).toBeNull();
  });
});

describe('Status, Art, Sichtbarkeit, Gäste', () => {
  it('abgesagtes Einzel-Ereignis gibt kein Objekt (Abgleich entfernt es)', () => {
    expect(termine([e({ id: 'c', status: 'cancelled', summary: 'Weg', ...berlin('2026-10-03', '10:00', '11:00') })], '2026-10-01', '2026-10-10')).toHaveLength(0);
  });
  it('vorläufig (tentative) belegt wie bestätigt; privat → Sichtbarkeit privat; Art aus unserer Marke, sonst aus Googles eventType', () => {
    const [t, u, v] = termine([
      e({ id: 'a', status: 'tentative', visibility: 'private', summary: 'Privat', ...berlin('2026-10-03', '09:00', '10:00') }),
      e({ id: 'b', summary: 'Weg', eventType: 'outOfOffice', ...berlin('2026-10-03', '11:00', '12:00') }),
      e({ id: 'c', summary: 'Block', extendedProperties: { private: { art: 'fokus', makeOsId: 'makeos-t-123456789' } }, ...berlin('2026-10-03', '13:00', '14:00') }),
    ], '2026-10-01', '2026-10-10');
    expect(t).toMatchObject({ status: 'vorlaeufig', sichtbarkeit: 'privat', beschaeftigt: true });
    expect(u.art).toBe('abwesend');
    expect(v).toMatchObject({ art: 'fokus', uid: 'makeos-t-123456789' });
  });
  it('Gäste: Organisator + Antworten; ich = Organisator → bearbeitbar; ich = Gast → nicht bearbeitbar, eigene Antwort sichtbar', () => {
    const gaeste = [
      { email: 'kevin@makeinnovation.test', responseStatus: 'accepted', organizer: true, self: true },
      { email: 'anna@example.invalid', displayName: 'Anna Beispiel', responseStatus: 'needsAction' },
    ];
    const [org] = termine([e({ id: 'g1', summary: 'Gespräch', attendees: gaeste, organizer: { email: 'kevin@makeinnovation.test', self: true }, ...berlin('2026-10-03', '10:00', '11:00') })], '2026-10-01', '2026-10-10');
    expect(org).toMatchObject({ mitTeilnehmern: true, ichOrganisator: true, bearbeitbar: true });
    expect(org.teilnehmer?.map(x => x.status)).toEqual(['offen']);
    const [gast] = termine([e({ id: 'g2', summary: 'Fremdes', attendees: [{ email: 'nora@example.invalid', organizer: true, responseStatus: 'accepted' }, { email: 'kevin@makeinnovation.test', self: true, responseStatus: 'tentative' }], organizer: { email: 'nora@example.invalid' }, ...berlin('2026-10-03', '10:00', '11:00') })], '2026-10-01', '2026-10-10');
    expect(gast).toMatchObject({ mitTeilnehmern: true, bearbeitbar: false, meineAntwort: 'vielleicht' });
  });
  it('Erinnerungen (overrides) → Minuten; HTML-Beschreibung → Text', () => {
    const [t] = termine([e({ id: 'r', summary: 'R', description: '<p>Hallo<br>Welt</p><ul><li>eins</li></ul>', reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }, { method: 'email', minutes: 60 }] }, ...berlin('2026-10-03', '10:00', '11:00') })], '2026-10-01', '2026-10-10');
    expect(t.erinnerungen).toEqual([10, 60]);
    expect(t.notiz).toContain('Hallo\nWelt');
    expect(htmlZuText('<b>fett</b> &amp; mehr')).toBe('fett & mehr');
    expect(htmlZuText('einfach')).toBe('einfach');
  });
  it('schlank säubert: ohne id → null; unbekannte Felder fallen weg; Steuerzeichen/fremde recurrence-Zeilen raus', () => {
    expect(schlank({ summary: 'x' })).toBeNull();
    expect(schlank(null)).toBeNull();
    const s = schlank({ id: 'k', summary: 'T', kaputt: 1, creator: { email: 'a@b.c' }, recurrence: ['RRULE:FREQ=DAILY', 'ATTENDEE:evil', 'EXRULE:x'] })!;
    expect(s).not.toHaveProperty('kaputt');
    expect(s).not.toHaveProperty('creator');
    expect(s.recurrence).toEqual(['RRULE:FREQ=DAILY', 'EXRULE:x']);
  });
  it('Ereignisse anwenden: abgesagtes Master-Ereignis nimmt seine Ausnahmen mit; Aufräumen: Altes raus, Serien bleiben', () => {
    const a = e({ id: 'm', recurrence: ['RRULE:FREQ=DAILY'], ...berlin('2026-10-05', '10:00', '11:00') });
    const x = e({ id: 'm_1', recurringEventId: 'm', ...berlin('2026-10-06', '10:00', '11:00') });
    expect(Object.keys(ereignisseAnwenden({ m: a, m_1: x }, [{ id: 'm', status: 'cancelled' }]))).toEqual([]);
    const alt = e({ id: 'alt', ...berlin('2026-01-05', '10:00', '11:00') }), neu = e({ id: 'neu', ...berlin('2026-10-05', '10:00', '11:00') });
    expect(Object.keys(aufraeumen({ alt, neu, m: a }, '2026-07-01')).sort()).toEqual(['m', 'neu']);
  });
});

describe('MAKE OS → Google', () => {
  it('Google-ID aus der UID: gültig (a–v, 0–9), stabil, je UID verschieden', () => {
    const id = eventIdFuer('makeos-t-abc12345');
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/);
    expect(eventIdFuer('makeos-t-abc12345')).toBe(id);
    expect(eventIdFuer('makeos-t-abc12346')).not.toBe(id);
  });
  it('neuBody: Zeit mit Zone, makeOsId, Art-Marke, frei/privat, Erinnerungen, Serie, Gäste', () => {
    const b = neuBody({ uid: 'makeos-t-abc12345', titel: 'Kickoff', start: '2026-10-26T10:00:00', ende: '2026-10-26T11:00:00', art: 'termin', beschaeftigt: false, sichtbarkeit: 'privat', erinnerungenMin: [10, 10, 30], wiederholung: { freq: 'WEEKLY', intervall: 1, tage: ['MO'], anzahl: 3 } as never, gaeste: [{ email: 'anna@example.invalid', name: 'Anna' }], ort: 'Büro', notiz: 'Text' }, true);
    expect(b).toMatchObject({
      id: eventIdFuer('makeos-t-abc12345'), summary: 'Kickoff', location: 'Büro', description: 'Text',
      start: { dateTime: '2026-10-26T10:00:00', timeZone: 'Europe/Berlin' }, end: { dateTime: '2026-10-26T11:00:00', timeZone: 'Europe/Berlin' },
      transparency: 'transparent', visibility: 'private',
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }, { method: 'popup', minutes: 30 }] },
      attendees: [{ email: 'anna@example.invalid', displayName: 'Anna' }],
      extendedProperties: { private: { makeOsId: 'makeos-t-abc12345' } },
    });
    expect(b.recurrence?.[0]).toMatch(/^RRULE:FREQ=WEEKLY/);
  });
  it('neuBody ganztägig und Arbeitsort/Block: date, Titel aus dem Arbeitsort, Art + Unterart im Privatfeld', () => {
    const a = neuBody({ uid: 'makeos-t-ganztag1', titel: 'x', start: '2026-10-05', ende: '2026-10-06', ganztags: true, art: 'arbeitsort', arbeitsort: { art: 'home' } }, false);
    expect(a).toMatchObject({ summary: 'Home', start: { date: '2026-10-05' }, end: { date: '2026-10-06' }, transparency: 'transparent', extendedProperties: { private: { art: 'arbeitsort' } } });
    const bl = neuBody({ uid: 'makeos-t-block001', titel: 'Reha', start: '2026-10-05T07:00:00', ende: '2026-10-05T07:30:00', art: 'block', blockArt: 'reha' }, true);
    expect(bl.extendedProperties?.private).toMatchObject({ art: 'block', blockArt: 'reha' });
  });
  it('patchBody: nur Geändertes; null löscht; Zeit immer in Berlin; Gästeliste behält Antworten und den Organisator', () => {
    const bisher = e({ id: 'p', summary: 'Alt', attendees: [{ email: 'kevin@makeinnovation.test', organizer: true, self: true, responseStatus: 'accepted' }, { email: 'anna@example.invalid', responseStatus: 'accepted' }], ...berlin('2026-10-03', '10:00', '11:00') });
    expect(patchBody({ titel: 'Neu' }, bisher)).toEqual({ summary: 'Neu' });
    expect(patchBody({ ort: null, notiz: null }, bisher)).toEqual({ location: null, description: null });
    expect(patchBody({ start: '2026-10-04T09:00:00', ende: '2026-10-04T10:00:00' }, bisher)).toEqual({ start: { dateTime: '2026-10-04T09:00:00', timeZone: 'Europe/Berlin' }, end: { dateTime: '2026-10-04T10:00:00', timeZone: 'Europe/Berlin' } });
    const g = patchBody({ gaeste: [{ email: 'Anna@Example.invalid' }, { email: 'bert@example.invalid' }] }, bisher);
    expect(g.attendees).toEqual([{ email: 'anna@example.invalid', responseStatus: 'accepted' }, { email: 'bert@example.invalid' }, { email: 'kevin@makeinnovation.test', responseStatus: 'accepted' }]);
    expect(patchBody({ art: 'termin', farbe: null }, bisher).extendedProperties?.private).toEqual({ art: null, farbe: null });
  });
  it('antwortBody ändert NUR die eigene Antwort', () => {
    const bisher = e({ id: 'p', attendees: [{ email: 'nora@example.invalid', organizer: true, responseStatus: 'accepted' }, { email: 'kevin@makeinnovation.test', self: true, responseStatus: 'needsAction' }], ...berlin('2026-10-03', '10:00', '11:00') });
    expect(antwortBody(bisher, ich, 'abgesagt').attendees).toEqual([{ email: 'nora@example.invalid', responseStatus: 'accepted' }, { email: 'kevin@makeinnovation.test', responseStatus: 'declined' }]);
  });
  it('UID eines Termins: makeOsId vor Google-ID; ICS-Zeit: Datum, Zone, UTC', () => {
    expect(uidVonEvent({ id: 'g1', privat: { makeOsId: 'makeos-x' } })).toBe('makeos-x');
    expect(uidVonEvent({ id: 'g1' })).toBe('g1');
    expect(icsZeit({ date: '2026-10-05' })).toEqual({ param: ';VALUE=DATE', wert: '20261005' });
    expect(icsZeit({ dateTime: '2026-10-26T10:00:00+01:00', timeZone: 'Europe/Berlin' })).toEqual({ param: ';TZID=Europe/Berlin', wert: '20261026T100000' });
    expect(icsZeit({ dateTime: '2026-10-26T09:00:00Z' })?.wert).toBe('20261026T090000Z');
    expect(artVon({ eventType: 'focusTime' })).toBe('fokus');
  });
});
