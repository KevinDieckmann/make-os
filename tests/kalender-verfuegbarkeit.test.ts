// Kalender K1 (29.09.): Verfügbarkeit an EINER Stelle — Abwesend, Arbeitsort, Wochenvorlage, Feiertage NRW. Erfundene Daten.
import { describe, it, expect } from 'vitest';
import { verfuegbarkeitAus, istFrei, betrifft } from '../lib/kalender/verfuegbarkeit-regeln';
import type { TerminMitBezug } from '../lib/kalender/bezug';
import type { Block } from '../lib/planung/typen';

const t = (x: Partial<TerminMitBezug> & { wer: string; start: string; ende: string }): TerminMitBezug & { wer: string } => ({
  id: x.uid ?? `${x.start}-${x.wer}`, uid: x.uid ?? `${x.start}-${x.wer}`, href: '', titel: 'T', ganztags: false, kalender: 'K', kalenderId: 'k', serie: false, mitTeilnehmern: false, bearbeitbar: true,
  art: 'termin', beschaeftigt: true, sichtbarkeit: 'standard', ...x,
});
const block = (wochentag: Block['wochentag'], von: string, bis: string, owner = 'kevin', art: Block['art'] = 'business'): Block => ({ id: `b-${wochentag}-${von}-${owner}`, owner, wochentag, von, bis, art });

describe('Verfügbarkeit', () => {
  const termine = [
    t({ wer: 'kevin', art: 'abwesend', ganztags: true, start: '2026-10-05T00:00:00', ende: '2026-10-07T00:00:00', titel: 'Urlaub' }),
    t({ wer: 'kevin', art: 'arbeitsort', ganztags: true, beschaeftigt: false, start: '2026-09-30T00:00:00', ende: '2026-10-01T00:00:00', titel: 'Home', arbeitsort: { art: 'home' } }),
    t({ wer: 'kevin', art: 'fokus', start: '2026-09-30T09:00:00', ende: '2026-09-30T10:30:00' }),
    t({ wer: 'kevin', art: 'termin', beschaeftigt: false, start: '2026-09-30T12:00:00', ende: '2026-09-30T13:00:00' }),
    t({ wer: 'kevin', art: 'abwesend', start: '2026-10-01T14:00:00', ende: '2026-10-01T16:00:00', sichtbarkeit: 'privat', titel: 'Arzt' }),
    t({ wer: 'beide', art: 'abwesend', ganztags: true, start: '2026-10-02T00:00:00', ende: '2026-10-03T00:00:00', von: 'malin', titel: 'Malin weg' }),
    t({ wer: 'beide', start: '2026-10-02T19:00:00', ende: '2026-10-02T21:00:00', titel: 'Essen' }),
    t({ wer: 'malin', start: '2026-09-30T09:00:00', ende: '2026-09-30T18:00:00' }),
  ];
  const bloecke = [1, 2, 3, 4, 5].map(w => block(w as Block['wochentag'], '09:00', '17:00')).concat([block(3, '09:00', '12:00', 'malin'), block(6, '10:00', '12:00', 'kevin', 'privat')]);
  const v = verfuegbarkeitAus({ person: 'kevin', von: '2026-09-30', bis: '2026-10-07', termine, bloecke });
  const tag = (x: string) => v.tage.find(d => d.tag === x)!;

  it('wem ein Termin gilt: eigener Kalender, gemeinsamer — Abwesend/Arbeitsort dort nur für die, die ihn angelegt hat', () => {
    expect(betrifft(termine[5], 'kevin')).toBe(false); expect(betrifft(termine[5], 'malin')).toBe(true);
    expect(betrifft(termine[6], 'kevin')).toBe(true); expect(betrifft(termine[7], 'kevin')).toBe(false);
  });
  it('Arbeitsort, beschäftigt (frei zählt nicht), Soll-Arbeitszeit aus der Vorlage', () => {
    expect(tag('2026-09-30')).toMatchObject({ arbeitsort: { art: 'home', titel: 'Home' }, arbeitszeit: [{ start: '2026-09-30T09:00:00', ende: '2026-09-30T17:00:00' }], ganzAbwesend: false });
    expect(tag('2026-09-30').beschaeftigt).toEqual([{ start: '2026-09-30T09:00:00', ende: '2026-09-30T10:30:00', art: 'fokus', ganztags: false }]);
    expect(istFrei(v, '2026-09-30T10:30:00', '2026-09-30T11:00:00')).toBe(true);
    expect(istFrei(v, '2026-09-30T10:00:00', '2026-09-30T11:00:00')).toBe(false);
  });
  it('Abwesend: privat ohne Titel, ganztägig = ganzer Tag weg (keine Arbeitszeit), Feiertag NRW', () => {
    expect(tag('2026-10-01').abwesend).toEqual([{ start: '2026-10-01T14:00:00', ende: '2026-10-01T16:00:00', art: 'abwesend', ganztags: false }]);
    expect(tag('2026-10-05')).toMatchObject({ ganzAbwesend: true, arbeitszeit: [], abwesend: [{ titel: 'Urlaub', ganztags: true }] });
    expect(tag('2026-10-06').ganzAbwesend).toBe(true);
    expect(tag('2026-10-03')).toMatchObject({ feiertag: 'Tag der Deutschen Einheit', wochenende: true, arbeitszeit: [] });
    expect(istFrei(v, '2026-10-05T10:00:00', '2026-10-05T11:00:00')).toBe(false);
    expect(tag('2026-10-02')).toMatchObject({ ganzAbwesend: false, beschaeftigt: [{ start: '2026-10-02T19:00:00', ende: '2026-10-02T21:00:00' }] });
  });
});
