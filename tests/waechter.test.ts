// ─── Der Schrumpf-Wächter ───────────────────────────────────────────────────
// Am 06.09. wurden 57 von 64 Aufgaben auf einen Schlag erledigt und eine
// gelöscht. Ob das ein Versehen war, ist bis heute nicht geklärt — sicher ist
// nur: es gab nichts, was es aufgehalten hätte.
//
// Diese Regel ist das, was es aufhalten würde. Sie steht in einer Zeile und
// entscheidet über Datenverlust, deshalb gehört sie geprüft.

import { describe, it, expect } from 'vitest';
import { schrumpftZuStark } from '../lib/store/local-db';

describe('Schrumpf-Wächter', () => {
  it('hält den Fall vom 06.09. auf: 64 Aufgaben auf 7', () => {
    expect(schrumpftZuStark(64, 7, 10)).toBe(true);
  });

  it('lässt normales Arbeiten durch', () => {
    // Eine Aufgabe löschen, drei anlegen, die Hälfte plus eine behalten.
    expect(schrumpftZuStark(64, 63, 10)).toBe(false);
    expect(schrumpftZuStark(64, 67, 10)).toBe(false);
    expect(schrumpftZuStark(64, 33, 10)).toBe(false);
  });

  it('greift genau bei der Hälfte noch nicht, darunter schon', () => {
    // 32 ist die Hälfte von 64 — das ist noch erlaubt, 31 nicht mehr.
    expect(schrumpftZuStark(64, 32, 10)).toBe(false);
    expect(schrumpftZuStark(64, 31, 10)).toBe(true);
  });

  it('lässt kurze Listen in Ruhe — dort ist starkes Schwanken normal', () => {
    // Bei drei Kunden ist „einer weg" keine Katastrophe, sondern Alltag.
    expect(schrumpftZuStark(3, 1, 10)).toBe(false);
    expect(schrumpftZuStark(9, 0, 10)).toBe(false);
    // Ab der Schwelle greift er dann auch bei kleinen Zahlen.
    expect(schrumpftZuStark(3, 1, 3)).toBe(true);
  });

  it('hält das Leeren einer gewachsenen Liste auf', () => {
    // Der gefährlichste Fall überhaupt: ein fehlgeschlagener Lesevorgang
    // schreibt eine leere Liste zurück.
    expect(schrumpftZuStark(731, 0, 10)).toBe(true);
    expect(schrumpftZuStark(204, 0, 10)).toBe(true);
  });

  it('lässt eine leere Liste wachsen', () => {
    expect(schrumpftZuStark(0, 0, 10)).toBe(false);
    expect(schrumpftZuStark(0, 12, 10)).toBe(false);
  });
});
