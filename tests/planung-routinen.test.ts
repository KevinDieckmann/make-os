// Routinen (27.09.): Säuberung im Schreibweg bleibt additiv — Altbestand ohne
// space/owner/rhythmus ist gültig; Sichtbarkeit je Person; heute fällig; Blöcke.

import { describe, expect, it } from 'vitest';
import { sauberRoutine, sauberBlock, sichtbarFuer, heuteFaellig, erledigtTage, bloeckeFuer, standardBloecke, spaceVonRoutine, ownerVonRoutine } from '@/lib/planung/routinen';
import type { Routine } from '@/lib/planung/typen';

describe('Säuberung Routine', () => {
  it('Altbestand bleibt gültig — ohne space, owner, rhythmus', () => {
    const r = sauberRoutine({ id: 'journal', label: 'Journal', wann: 'morgen', kategorie: 'gesundheit', dauerMin: 15, aktiv: true })!;
    expect(r).toEqual({ id: 'journal', label: 'Journal', wann: 'morgen', kategorie: 'gesundheit', dauerMin: 15, aktiv: true });
    expect(spaceVonRoutine(r)).toBe('privat');
    expect(ownerVonRoutine(r)).toBe('beide');
  });
  it('nimmt die neuen Felder mit und wirft Unsinn weg', () => {
    const r = sauberRoutine({ label: 'Steuererklärung', wann: 'tag', kategorie: 'business', dauerMin: 999, space: 'business', owner: 'kevin', rhythmus: 'jaehrlich', naechstesMal: '2026-10-15', rang: 2 })!;
    expect(r).toMatchObject({ space: 'business', owner: 'kevin', rhythmus: 'jaehrlich', naechstesMal: '2026-10-15', rang: 2, dauerMin: 120 });
    const kaputt = sauberRoutine({ label: 'X', space: 'firma', owner: 'Böse Person!', rhythmus: 'alle-zwei-tage', naechstesMal: 'morgen', rang: -3 })!;
    expect(kaputt.space).toBeUndefined();
    expect(kaputt.owner).toBe('beide');
    expect(kaputt.rhythmus).toBeUndefined();
    expect(kaputt.naechstesMal).toBeUndefined();
    expect(kaputt.rang).toBeUndefined();
  });
  it('täglich wird nicht gespeichert (Vorgabe), 3×/Woche kennt kein „nächstes Mal“', () => {
    expect(sauberRoutine({ label: 'A', rhythmus: 'taeglich', naechstesMal: '2026-10-01' })).not.toHaveProperty('rhythmus');
    expect(sauberRoutine({ label: 'A', rhythmus: '3x-woche', naechstesMal: '2026-10-01' })).not.toHaveProperty('naechstesMal');
  });
  it('ohne Label nichts', () => {
    expect(sauberRoutine({ label: '   ' })).toBeNull();
  });
});

describe('Säuberung Block', () => {
  it('gültiger Block', () => {
    expect(sauberBlock({ owner: 'malin', wochentag: 1, von: '09:00', bis: '18:00', art: 'business', titel: 'Arbeit' })).toMatchObject({ owner: 'malin', wochentag: 1, von: '09:00', bis: '18:00', art: 'business', titel: 'Arbeit' });
  });
  it('lehnt ab: ohne Person, falscher Tag, Ende vor Anfang, kaputte Uhrzeit', () => {
    expect(sauberBlock({ wochentag: 1, von: '09:00', bis: '18:00' })).toBeNull();
    expect(sauberBlock({ owner: 'kevin', wochentag: 8, von: '09:00', bis: '18:00' })).toBeNull();
    expect(sauberBlock({ owner: 'kevin', wochentag: 2, von: '18:00', bis: '09:00' })).toBeNull();
    expect(sauberBlock({ owner: 'kevin', wochentag: 2, von: '9 Uhr', bis: '18:00' })).toBeNull();
  });
  it('unbekannte Art wird privat', () => {
    expect(sauberBlock({ owner: 'kevin', wochentag: 6, von: '10:00', bis: '12:00', art: 'sport' })?.art).toBe('privat');
  });
});

describe('Sichtbarkeit und Fälligkeit heute', () => {
  const heute = '2026-09-30';
  const routinen: Routine[] = [
    { id: 'j', label: 'Journal', wann: 'morgen', kategorie: 'gesundheit', dauerMin: 15, aktiv: true }, // beide, täglich, privat
    { id: 'k', label: 'Kevins Reha', wann: 'abend', kategorie: 'gesundheit', dauerMin: 20, aktiv: true, owner: 'kevin' },
    { id: 'm', label: 'Malins Lauf', wann: 'morgen', kategorie: 'gesundheit', dauerMin: 45, aktiv: true, owner: 'malin', rhythmus: '3x-woche' },
    { id: 'b', label: 'Buchhaltung', wann: 'tag', kategorie: 'business', dauerMin: 60, aktiv: true, space: 'business', owner: 'beide', rhythmus: 'monatlich' },
    { id: 'p', label: 'Pausiert', wann: 'tag', kategorie: 'leben', dauerMin: 10, aktiv: false },
  ];

  it('eine Person sieht Eigenes und Gemeinsames', () => {
    expect(sichtbarFuer(routinen, 'kevin').map(r => r.id)).toEqual(['j', 'k', 'b', 'p']);
    expect(sichtbarFuer(routinen, 'malin').map(r => r.id)).toEqual(['j', 'm', 'b', 'p']);
  });

  it('erledigte Tage aus dem Log dieser Person', () => {
    expect(erledigtTage({ '2026-09-28': ['j', 'b'], '2026-09-29': ['j'], '2026-09-30': ['x'] }, 'j')).toEqual(['2026-09-28', '2026-09-29']);
  });

  it('heute fällig je Person und Space — Pausiertes nie, heute Abgehaktes bleibt sichtbar', () => {
    const log = { '2026-09-30': ['j'], '2026-08-30': ['b'] };
    const kevin = heuteFaellig(routinen, 'kevin', log, heute);
    expect(kevin.map(x => x.routine.id)).toEqual(['j', 'k', 'b']);
    expect(kevin.find(x => x.routine.id === 'j')).toMatchObject({ heuteErledigt: true, f: { faellig: false } });
    expect(kevin.find(x => x.routine.id === 'b')?.f).toMatchObject({ faellig: true, ueberfaellig: false, naechstes: '2026-09-30' });
    expect(heuteFaellig(routinen, 'kevin', log, heute, 'business').map(x => x.routine.id)).toEqual(['b']);
    expect(heuteFaellig(routinen, 'kevin', log, heute, 'privat').map(x => x.routine.id)).toEqual(['j', 'k']);
  });

  it('Monatsroutine nach Erledigung nicht mehr dran', () => {
    const log = { '2026-09-29': ['b'] };
    expect(heuteFaellig(routinen, 'malin', log, heute, 'business')).toEqual([]);
  });
});

describe('Blöcke', () => {
  it('Standard: Mo–Fr Business, sortiert je Person', () => {
    const std = standardBloecke('malin');
    expect(std).toHaveLength(5);
    expect(std.every(b => b.art === 'business' && b.owner === 'malin')).toBe(true);
    expect(bloeckeFuer([...std, { id: 'x', owner: 'kevin', wochentag: 1, von: '08:00', bis: '09:00', art: 'privat' }], 'malin', 1).map(b => b.id)).toEqual(['bl-malin-1-std']);
    expect(bloeckeFuer(std, 'kevin')).toEqual([]);
  });
});
