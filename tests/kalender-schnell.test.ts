// Kalender: Schnelleingabe und Überlappungs-Layout (lib/kalender/schnell.ts, layout.ts)
import { describe, it, expect } from 'vitest';
import { schnellLesen } from '@/lib/kalender/schnell';
import { spaltenLegen, montagVon, monatsblatt } from '@/lib/kalender/layout';

const HEUTE = '2026-09-27'; // Sonntag

describe('schnellLesen', () => {
  it('versteht Wochentag, Uhrzeit, Dauer und Titel', () => {
    const s = schnellLesen('Mo 10 Uhr Kaffee mit Anna 45min', HEUTE);
    expect(s).toMatchObject({ titel: 'Kaffee mit Anna', tag: '2026-09-28', von: '10:00', bis: '10:45', dauerMin: 45, ganztags: false });
  });
  it('morgen mit Zeitspanne, Person und Ort', () => {
    const s = schnellLesen('morgen 14:30-16 Steuerberater @kevin in Berlin', HEUTE);
    expect(s).toMatchObject({ titel: 'Steuerberater', tag: '2026-09-28', von: '14:30', bis: '16:00', wer: 'kevin', ort: 'Berlin' });
  });
  it('Datum ohne Jahr springt ins nächste Vorkommen, ganztags ohne Zeiten, Wiederholung', () => {
    const g = schnellLesen('3.10. Geburtstag Oma ganztags', HEUTE);
    expect(g).toMatchObject({ titel: 'Geburtstag Oma', tag: '2026-10-03', ganztags: true }); expect(g.von).toBeUndefined();
    const alt = schnellLesen('1.1. Neujahr', HEUTE); expect(alt.tag).toBe('2027-01-01');
    const w = schnellLesen('Fr 9 Uhr Power Hour jede Woche', HEUTE);
    expect(w).toMatchObject({ titel: 'Power Hour', tag: '2026-10-02', von: '09:00', bis: '10:00', wiederholung: 'WEEKLY' });
    expect(w.erkannt).toContain('jede Woche');
  });
  it('ohne Zeit: Vorgabe 9 Uhr und Standarddauer; nur Titel bleibt Titel', () => {
    const s = schnellLesen('Rücken-Übungen', HEUTE, 30);
    expect(s).toMatchObject({ titel: 'Rücken-Übungen', tag: HEUTE, von: '09:00', bis: '09:30' });
    expect(schnellLesen('um 7 Laufen 1h', HEUTE)).toMatchObject({ titel: 'Laufen', von: '07:00', bis: '08:00' });
    expect(schnellLesen('Do 18.15 Uhr Abendessen', HEUTE)).toMatchObject({ tag: '2026-10-01', von: '18:15' });
  });
});

describe('Layout', () => {
  it('legt überlappende Termine in Spalten, getrennte Gruppen unabhängig', () => {
    const p = spaltenLegen([{ id: 'a', von: 540, bis: 600 }, { id: 'b', von: 570, bis: 630 }, { id: 'c', von: 600, bis: 660 }, { id: 'd', von: 800, bis: 860 }]);
    const je = Object.fromEntries(p.map(x => [x.id, x]));
    expect(je.a).toMatchObject({ spalte: 0, spalten: 2 }); expect(je.b).toMatchObject({ spalte: 1, spalten: 2 }); expect(je.c).toMatchObject({ spalte: 0, spalten: 2 });
    expect(je.d).toMatchObject({ spalte: 0, spalten: 1 });
  });
  it('Montag und Monatsblatt', () => {
    expect(montagVon('2026-09-27')).toBe('2026-09-21'); expect(montagVon('2026-09-21')).toBe('2026-09-21');
    const b = monatsblatt(2026, 10);
    expect(b).toHaveLength(42); expect(b[0]).toBe('2026-09-28'); expect(b).toContain('2026-10-31');
  });
});
