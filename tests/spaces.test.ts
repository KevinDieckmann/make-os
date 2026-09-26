// Spaces (26.09.): Muster-Matching, aktiver Eintrag, Space aus der Adresse.
import { describe, it, expect } from 'vitest';
import { passtZu, aktiverSpaceEintrag, spaceVonAdresse, SPACES, EIGEN, UNTEN } from '../lib/make-one/spaces';

describe('Spaces', () => {
  it('passtZu: Pfad gleich oder Unterpfad, Parameter müssen stimmen', () => {
    expect(passtZu('/os/aufgaben/board', '?space=privat&offen=1', '/os/aufgaben?space=privat')).toBe(true);
    expect(passtZu('/os/aufgaben', '?space=business', '/os/aufgaben?space=privat')).toBe(false);
    expect(passtZu('/os/planung/woche', '', '/os/planung')).toBe(true);
    expect(passtZu('/os/planungx', '', '/os/planung')).toBe(false);
    expect(passtZu('/os/finanzen/liquiditaet', '', '/os/finanzen/')).toBe(true);
  });
  it('aktiver Eintrag: genauestes Muster gewinnt, Spaces und Eigene getrennt', () => {
    expect(aktiverSpaceEintrag('/os/finanzen', '?s=steuern')).toMatchObject({ space: 'business', eintrag: { label: 'Finanzen' } });
    expect(aktiverSpaceEintrag('/os/finanzen', '?s=privat')).toMatchObject({ space: 'privat', eintrag: { label: 'Finanzen' } });
    expect(aktiverSpaceEintrag('/os/gesundheit', '?s=ernaehrung')).toMatchObject({ space: 'privat', eintrag: { label: 'Gesundheit' } });
    expect(aktiverSpaceEintrag('/os/stapel', '')).toMatchObject({ space: null, eintrag: { label: 'Agenten' } });
    expect(aktiverSpaceEintrag('/os/wissen', '')).toMatchObject({ space: null, eintrag: { label: 'Brain' } });
    expect(aktiverSpaceEintrag('/os/wachstum', '').eintrag).toBeNull();
  });
  it('Space aus der Adresse: ?space= gewinnt, sonst der Eintrag, sonst null', () => {
    expect(spaceVonAdresse('/os/planung/jahr', '?space=business')).toBe('business');
    expect(spaceVonAdresse('/os/markttraktion', '?s=sales')).toBe('business');
    expect(spaceVonAdresse('/os/familie', '')).toBe('privat');
    expect(spaceVonAdresse('/os', '')).toBeNull();
    expect(spaceVonAdresse('/os/heute', '')).toBeNull();
  });
  it('jeder Space hat sechs bis sieben Punkte mit eindeutigen Adressen, Übersicht zuerst; Agenten steht eigen', () => {
    for (const s of SPACES) {
      expect(s.eintraege.length).toBeGreaterThanOrEqual(6);
      expect(s.eintraege.length).toBeLessThanOrEqual(7);
      expect(new Set(s.eintraege.map(e => e.href)).size).toBe(s.eintraege.length);
      expect(s.eintraege[0].label).toBe('Übersicht');
    }
    expect(EIGEN.map(e => e.label)).toEqual(['Agenten']);
    expect(UNTEN.map(e => e.label)).toEqual(['Jarvis', 'Brain']);
  });
});
