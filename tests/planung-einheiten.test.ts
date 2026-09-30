// Business-Einheiten: Vorbelegung Selbstständigkeit · KD Ventures · MAKE Innovation GmbH · Kunden, frei anlegbar, ohne Doppelte.

import { describe, expect, it } from 'vitest';
import { EINHEITEN_STANDARD, einheitenListe, einheitHinzufuegen, sauberEinheit, sauberEinheitenDatei, passtEinheit } from '@/lib/planung/einheiten';

describe('Werteliste', () => {
  it('Standard zuerst, eigene dahinter, Doppelte (auch Groß/Klein) fallen weg', () => {
    expect(einheitenListe(null)).toEqual([...EINHEITEN_STANDARD]);
    expect(einheitenListe(['KEMARIS', 'kunden', ' KEMARIS ', 'Beteiligungen'])).toEqual([...EINHEITEN_STANDARD, 'KEMARIS', 'Beteiligungen']);
  });
  it('Namen werden gesäubert', () => {
    expect(sauberEinheit('  Neue   Einheit ')).toBe('Neue Einheit');
    expect(sauberEinheit('A')).toBeNull();
    expect(sauberEinheit(null)).toBeNull();
    expect(sauberEinheit('x'.repeat(80))?.length).toBe(40);
  });
});

describe('Hinzufügen', () => {
  it('legt Neues an und gibt den gespeicherten Namen zurück', () => {
    expect(einheitHinzufuegen([], 'KEMARIS')).toEqual({ eigene: ['KEMARIS'], einheit: 'KEMARIS', neuAngelegt: false || true });
  });
  it('Vorhandenes (auch Standard) legt nichts doppelt an, liefert aber die passende Schreibweise', () => {
    expect(einheitHinzufuegen(['KEMARIS'], 'kemaris')).toEqual({ eigene: ['KEMARIS'], einheit: 'KEMARIS', neuAngelegt: false });
    expect(einheitHinzufuegen([], 'kd ventures')).toEqual({ eigene: [], einheit: 'KD Ventures', neuAngelegt: false });
  });
  it('Unbrauchbares ändert nichts', () => {
    expect(einheitHinzufuegen(['A B'], '')).toEqual({ eigene: ['A B'], einheit: null, neuAngelegt: false });
  });
});

describe('Datei und Filter', () => {
  it('säubert den Bestand — nur eigene, nie den Standard doppelt', () => {
    expect(sauberEinheitenDatei({ eigene: ['Kunden', 'Team', 3, '  '] })).toEqual({ eigene: ['Team'] });
    expect(sauberEinheitenDatei(null)).toEqual({ eigene: [] });
  });
  it('Filter „alle“ lässt alles durch, sonst exakt', () => {
    expect(passtEinheit(undefined, 'alle')).toBe(true);
    expect(passtEinheit('Kunden', 'Kunden')).toBe(true);
    expect(passtEinheit(undefined, 'Kunden')).toBe(false);
  });
  it('Kerneinheiten aus lib/einheiten.ts, alte Schreibweisen werden vereinheitlicht', () => {
    expect(EINHEITEN_STANDARD.slice(0, 3)).toEqual(['Selbstständigkeit', 'KD Ventures', 'MAKE Innovation GmbH']);
    expect(sauberEinheit('Neue UG')).toBe('MAKE Innovation GmbH');
    expect(einheitHinzufuegen([], 'neue ug')).toEqual({ eigene: [], einheit: 'MAKE Innovation GmbH', neuAngelegt: false });
  });
});
