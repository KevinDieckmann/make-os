// Kalender: Serien (RRULE) und Erinnerungen (VALARM) im gebauten Termin (lib/kalender/ics.ts, 27.09.)
import { describe, it, expect } from 'vitest';
import { baueTermin, rruleText, termineAus } from '../lib/kalender/ics';

describe('Serie und Erinnerung', () => {
  it('RRULE-Text', () => {
    expect(rruleText({ freq: 'WEEKLY' })).toBe('FREQ=WEEKLY');
    expect(rruleText({ freq: 'WEEKLY', intervall: 2, tage: ['MO', 'WE', 'MO'], anzahl: 10 })).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10');
    expect(rruleText({ freq: 'MONTHLY', bis: '2026-12-31' })).toBe('FREQ=MONTHLY;UNTIL=20261231T215959Z');
  });
  it('baut RRULE und VALARM in den Termin; die Serie faltet sich in Vorkommen auf', () => {
    const ics = baueTermin({ uid: 'serie-1', titel: 'Power Hour', start: '2026-10-02T09:00:00', ende: '2026-10-02T10:00:00', wiederholung: { freq: 'WEEKLY', anzahl: 3 }, erinnerungMin: 15 });
    expect(ics).toContain('RRULE:FREQ=WEEKLY;COUNT=3');
    expect(ics).toContain('BEGIN:VALARM'); expect(ics).toContain('TRIGGER:-PT15M'); expect(ics).toContain('ACTION:DISPLAY');
    const t = termineAus({ href: '/x.ics', ics }, { id: 'k', name: 'Gemeinsam', schreibbar: true }, '2026-09-28', '2026-11-01');
    expect(t).toHaveLength(3); expect(t.every(x => x.serie)).toBe(true); expect(t[1].start.slice(0, 10)).toBe('2026-10-09');
    const ohne = baueTermin({ uid: 'e', titel: 'Einzel', start: '2026-10-02T09:00:00', ende: '2026-10-02T10:00:00' });
    // (die Zeitzone trägt ihre eigene RRULE — geprüft wird das VEVENT)
    expect(ohne.split('BEGIN:VEVENT')[1]).not.toContain('RRULE'); expect(ohne).not.toContain('VALARM');
  });
});
