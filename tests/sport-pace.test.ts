// ─── Sport · Laufen: Pace, Zeiten, Wochenkilometer, Bestzeiten ──────────────
// Alle Werte erfunden — keine echten Trainingsdaten.
import { describe, it, expect } from 'vitest';
import { paceSekProKm, formatPace, formatZeit, parseZeit, wochenKilometer, kmTrend, bestzeiten, riegel, zielPace, trainingsPaces, montagVon } from '../lib/sport/pace';
import type { Lauf } from '../lib/sport/modell';

const lauf = (id: string, datum: string, km: number, sek: number, art: Lauf['art'] = 'locker'): Lauf => ({ id, datum, distanzKm: km, dauerSek: sek, art, quelle: 'hand' });

describe('Pace und Zeiten', () => {
  it('rechnet Sekunden je km und formatiert deutsch', () => {
    expect(paceSekProKm(10, 3000)).toBe(300);
    expect(formatPace(300)).toBe('5:00');
    expect(formatPace(272.4)).toBe('4:32');
    expect(formatPace(null)).toBe('—');
    expect(paceSekProKm(0, 100)).toBeNull();
  });
  it('formatiert Zeiten mit und ohne Stunden', () => {
    expect(formatZeit(5025)).toBe('1:23:45');
    expect(formatZeit(1425)).toBe('23:45');
    expect(formatZeit(59)).toBe('0:59');
  });
  it('liest Zeiten in allen üblichen Schreibweisen', () => {
    expect(parseZeit('1:23:45')).toBe(5025);
    expect(parseZeit('23:45')).toBe(1425);
    expect(parseZeit('45')).toBe(45);
    expect(parseZeit('1h 20m')).toBe(4800);
    expect(parseZeit('90 min')).toBe(5400);
    expect(parseZeit('')).toBeNull();
    expect(parseZeit('abc')).toBeNull();
    expect(parseZeit(300)).toBe(300);
  });
});

describe('Wochenkilometer', () => {
  it('liefert 12 Wochen, aktuelle zuletzt, und summiert je Woche', () => {
    const heute = '2026-09-27'; // Sonntag → Montag 21.09.
    expect(montagVon(heute)).toBe('2026-09-21');
    const w = wochenKilometer([lauf('a', '2026-09-22', 8, 2400), lauf('b', '2026-09-26', 12.5, 3900), lauf('c', '2026-09-15', 5, 1500), lauf('d', '2026-01-01', 10, 3000)], heute);
    expect(w).toHaveLength(12);
    expect(w[11]).toMatchObject({ montag: '2026-09-21', km: 20.5, laeufe: 2 });
    expect(w[10]).toMatchObject({ montag: '2026-09-14', km: 5, laeufe: 1 });
    expect(w[0].km).toBe(0);
  });
  it('bildet den Trend aus den letzten vier gegen die vier davor', () => {
    const w = wochenKilometer([], '2026-09-27');
    w.slice(-8, -4).forEach(x => { x.km = 20; });
    w.slice(-4).forEach(x => { x.km = 25; });
    expect(kmTrend(w)).toBe(25);
    expect(kmTrend(w.slice(0, 5))).toBeNull();
  });
});

describe('Bestzeiten', () => {
  it('nimmt genaue Distanzen und rechnet leicht längere Läufe auf die Distanz', () => {
    const b = bestzeiten([lauf('a', '2026-08-01', 10, 3000), lauf('b', '2026-08-10', 10.4, 3000), lauf('c', '2026-08-12', 5, 1380), lauf('d', '2026-08-20', 21.1, 6600), lauf('e', '2026-08-21', 30, 9000)]);
    const zehn = b.find(x => x.distanzKm === 10)!;
    expect(zehn.laufId).toBe('b'); // 10,4 km in 50 min → 48:05 auf 10 km, hochgerechnet
    expect(zehn.hochgerechnet).toBe(true);
    expect(zehn.sek).toBe(Math.round((3000 / 10.4) * 10));
    expect(b.find(x => x.distanzKm === 5)!.sek).toBe(1380);
    expect(b.find(x => x.distanzKm === 21.1)!.laufId).toBe('d'); // 30 km ist zu weit weg
  });
  it('lässt Distanzen ohne passenden Lauf weg', () => {
    expect(bestzeiten([lauf('a', '2026-08-01', 3, 900)])).toEqual([]);
  });
});

describe('Zielpace', () => {
  it('leitet Zielpace und Trainingsbereiche ab', () => {
    expect(zielPace({ zielzeitSek: 3000, distanzKm: 10 })).toBe(300);
    expect(zielPace({ zielzeitSek: 3000 })).toBeNull();
    const t = trainingsPaces(300);
    expect(t.find(x => x.art === 'locker')).toEqual({ art: 'locker', von: 360, bis: 390 });
    expect(t.find(x => x.art === 'intervall')!.bis).toBeLessThan(300);
  });
  it('Riegel: 10 km aus 5 km', () => {
    expect(riegel(1500, 5, 10)).toBe(Math.round(1500 * Math.pow(2, 1.06)));
  });
});
