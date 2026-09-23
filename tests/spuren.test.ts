// Überlappende Termine nebeneinander legen — der Donnerstag-Fall aus Kevins
// Screenshot (03.08.) ist hier für immer festgehalten: drei ineinander
// liegende Termine müssen drei Spuren bekommen.

import { describe, expect, it } from 'vitest';
import { verteileSpuren, spurStil } from '@/lib/make-one/spuren';

describe('verteileSpuren', () => {
  it('legt den Donnerstag-Fall in drei Spuren (Vorbereitung · Buchhaltung · Reha)', () => {
    const lage = verteileSpuren([
      { id: 'vorbereitung', startMin: 16 * 60 + 30, dauerMin: 150 },
      { id: 'buchhaltung', startMin: 17 * 60, dauerMin: 120 },
      { id: 'reha', startMin: 18 * 60, dauerMin: 30 },
    ]);
    expect(lage.get('vorbereitung')).toEqual({ spur: 0, spuren: 3 });
    expect(lage.get('buchhaltung')).toEqual({ spur: 1, spuren: 3 });
    expect(lage.get('reha')).toEqual({ spur: 2, spuren: 3 });
  });

  it('behandelt Kanten-Berührung (Ende = Start) NICHT als Überlappung', () => {
    const lage = verteileSpuren([
      { id: 'a', startMin: 600, dauerMin: 60 },
      { id: 'b', startMin: 660, dauerMin: 60 },
    ]);
    expect(lage.get('a')).toEqual({ spur: 0, spuren: 1 });
    expect(lage.get('b')).toEqual({ spur: 0, spuren: 1 });
  });

  it('trennt Trauben: eine breite Stelle am Morgen macht den Nachmittag nicht schmal', () => {
    const lage = verteileSpuren([
      { id: 'frueh1', startMin: 540, dauerMin: 60 },
      { id: 'frueh2', startMin: 570, dauerMin: 60 },
      { id: 'spaet', startMin: 900, dauerMin: 60 },
    ]);
    expect(lage.get('frueh1')!.spuren).toBe(2);
    expect(lage.get('spaet')).toEqual({ spur: 0, spuren: 1 });
  });

  it('füllt Lücken wieder auf: nach Ende eines Termins wird seine Spur frei', () => {
    const lage = verteileSpuren([
      { id: 'lang', startMin: 600, dauerMin: 180 },   // 10–13
      { id: 'kurz1', startMin: 600, dauerMin: 60 },   // 10–11 → Spur 2
      { id: 'kurz2', startMin: 660, dauerMin: 60 },   // 11–12 → wieder Spur 2
    ]);
    expect(lage.get('kurz1')!.spur).toBe(lage.get('kurz2')!.spur);
    expect(lage.get('lang')!.spuren).toBe(2);
  });

  it('kommt mit leerer Liste klar', () => {
    expect(verteileSpuren([]).size).toBe(0);
  });
});

describe('spurStil', () => {
  it('gibt einem Einzel-Termin die volle Breite', () => {
    expect(spurStil({ spur: 0, spuren: 1 })).toEqual({ left: '3px', width: 'calc(100% - 6px)' });
    expect(spurStil(undefined)).toEqual({ left: '3px', width: 'calc(100% - 6px)' });
  });

  it('teilt bei zwei Spuren die Breite hälftig', () => {
    expect(spurStil({ spur: 1, spuren: 2 }).left).toBe('calc(50% + 3px)');
  });
});
