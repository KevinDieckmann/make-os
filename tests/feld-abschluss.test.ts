// ─── Kleines Eingabefeld (components/os/crm/teile.tsx `Feld`) — Anlegen vs. Bearbeiten (19.10., Rundgang A6) ───────────────────────────────────
// Fund: Im Lieferumfang eines Produkts blieb der Text nach Enter stehen, ein Klick daneben speicherte ihn ein zweites Mal. Wächter: ein Anlege-Feld leert
// nach dem Speichern und ein leeres Verlassen speichert nichts; ein Bearbeiten-Feld speichert nur Änderungen; jedes Feld ohne `wert` ist ein Anlege-Feld.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { anlegeFeld, feldAbschluss } from '@/lib/make-one/feld-abschluss';

/** Spielt eine Folge von Eingaben durch wie das Feld: Text tippen, Enter bzw. Verlassen; gibt zurück, was gespeichert wurde. */
function folge(anlegen: boolean, wert: string, schritte: ({ tippe: string } | 'enter' | 'verlassen')[]): string[] {
  let text = wert;
  const gespeichert: string[] = [];
  for (const s of schritte) {
    if (typeof s === 'object') { text = s.tippe; continue; }
    const a = feldAbschluss(text, wert, anlegen);
    if (a.speichern !== null) gespeichert.push(a.speichern);
    if (a.leeren) text = '';
    // Ein Bearbeiten-Feld übernimmt nach dem Speichern den neuen Wert (die Antwort des Servers) — im Anlege-Feld bleibt `wert` leer.
    if (!anlegen && a.speichern !== null) wert = a.speichern;
  }
  return gespeichert;
}

describe('A6 · Anlege-Feld: Enter speichert einmal und leert', () => {
  it('Enter, dann daneben klicken: genau EIN Eintrag (vorher zwei)', () => {
    expect(folge(true, '', [{ tippe: 'Kick-off-Workshop' }, 'enter', 'verlassen'])).toEqual(['Kick-off-Workshop']);
  });
  it('mehrere Einträge nacheinander mit Enter; Leerzeichen werden getrimmt; leeres Enter/Verlassen speichert nichts', () => {
    expect(folge(true, '', [{ tippe: ' A ' }, 'enter', { tippe: 'B' }, 'enter', 'enter', 'verlassen', { tippe: '   ' }, 'verlassen'])).toEqual(['A', 'B']);
  });
  it('Tippen und daneben klicken ohne Enter speichert auch — einmal', () => {
    expect(folge(true, '', [{ tippe: 'C' }, 'verlassen', 'verlassen'])).toEqual(['C']);
  });
});

describe('Bearbeiten-Feld unverändert', () => {
  it('speichert nur Änderungen, der Text bleibt stehen; Leeren eines Werts ist eine Änderung', () => {
    expect(folge(false, 'alt', ['verlassen', { tippe: 'neu' }, 'enter', 'verlassen'])).toEqual(['neu']);
    expect(feldAbschluss('neu', 'alt', false)).toEqual({ speichern: 'neu', leeren: false });
    expect(feldAbschluss('', 'alt', false)).toEqual({ speichern: '', leeren: false });
  });
  it('ohne `wert` ist ein Feld ein Anlege-Feld, mit `wert` (auch leer) ein Bearbeiten-Feld; `leeren` gewinnt', () => {
    expect(anlegeFeld(false)).toBe(true);
    expect(anlegeFeld(true)).toBe(false);
    expect(anlegeFeld(true, true)).toBe(true);
    expect(anlegeFeld(false, false)).toBe(false);
  });
  it('der gemeinsame Baustein nutzt die Regel (kein eigenes onBlur-Speichern mehr)', () => {
    const src = readFileSync('components/os/crm/teile.tsx', 'utf8');
    const feld = src.slice(src.indexOf('export function Feld('), src.indexOf('export function Feld(') + 1600);
    expect(feld).toContain('feldAbschluss(');
    expect(feld).toContain("anlegeFeld('wert' in props, leeren)");
    expect(feld).not.toMatch(/onBlur=\{\(\) => \{ if \(t !== wert\)/);
  });
});
