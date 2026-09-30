import { describe, it, expect } from 'vitest';
import { wahlFiltern, naechsterIndex, startIndex, wahlLabel, menuLage, normiere, GESELLSCHAFT_WAHL, SUCHE_AB_WAHL, anlegenZeile, neuPruefen, neuSaeubern, NEU_MIN, NEU_MAX } from '@/lib/crm/wahl';

const L = [{ id: 'entscheider', label: 'Entscheider' }, { id: 'fuersprecher', label: 'Fürsprecher' }, { id: 'nutzer', label: 'Nutzer', hinweis: 'arbeitet damit' }, { id: 'blocker', label: 'Bremst' }] as const;

describe('Wahl · Filtern', () => {
  it('leere Suche: alle, Reihenfolge bleibt', () => { expect(wahlFiltern(L, '  ').map(e => e.id)).toEqual(['entscheider', 'fuersprecher', 'nutzer', 'blocker']); });
  it('Groß-/Kleinschreibung und Umlaute egal, Hinweis zählt mit', () => {
    expect(wahlFiltern(L, 'FUERS').map(e => e.id)).toEqual(['fuersprecher']);
    expect(wahlFiltern(L, 'für').map(e => e.id)).toEqual(['fuersprecher']);
    expect(wahlFiltern(L, 'arbeitet').map(e => e.id)).toEqual(['nutzer']);
    expect(wahlFiltern(L, 'xyz')).toEqual([]);
  });
  it('normiere: ä→ae, ß→ss, Akzente weg, Leerraum eingedampft', () => { expect(normiere('  Straße  Café Größe ')).toBe('strasse cafe groesse'); });
  it('Suchfeld ab acht Werten', () => { expect(SUCHE_AB_WAHL).toBe(8); });
});

describe('Wahl · Tastatur', () => {
  it('Pfeile laufen rund, Pos1/Ende springen', () => {
    expect(naechsterIndex(0, 4, 'ArrowDown')).toBe(1);
    expect(naechsterIndex(3, 4, 'ArrowDown')).toBe(0);
    expect(naechsterIndex(0, 4, 'ArrowUp')).toBe(3);
    expect(naechsterIndex(2, 4, 'Home')).toBe(0);
    expect(naechsterIndex(1, 4, 'End')).toBe(3);
  });
  it('ohne aktiven Eintrag: ↓ zum ersten, ↑ zum letzten; leere Liste: -1', () => {
    expect(naechsterIndex(-1, 4, 'ArrowDown')).toBe(0);
    expect(naechsterIndex(-1, 4, 'ArrowUp')).toBe(3);
    expect(naechsterIndex(0, 0, 'ArrowDown')).toBe(-1);
  });
  it('Seitentasten springen fünf und bleiben am Rand', () => {
    expect(naechsterIndex(1, 20, 'PageDown')).toBe(6);
    expect(naechsterIndex(18, 20, 'PageDown')).toBe(19);
    expect(naechsterIndex(3, 20, 'PageUp')).toBe(0);
  });
  it('Start auf dem gesetzten Wert, sonst Vorschlag, sonst oben', () => {
    expect(startIndex(L, 'nutzer')).toBe(2);
    expect(startIndex(L, ['blocker'])).toBe(3);
    expect(startIndex(L, null, 'fuersprecher')).toBe(1);
    expect(startIndex(L, undefined)).toBe(0);
    expect(startIndex([], undefined)).toBe(-1);
  });
  it('Name zur Kennung — Unbekanntes bleibt sichtbar, leer ist undefined', () => {
    expect(wahlLabel(L, 'blocker')).toBe('Bremst');
    expect(wahlLabel(L as never, 'alt-wert')).toBe('alt-wert');
    expect(wahlLabel(L, null)).toBeUndefined();
  });
});

describe('Wahl · Lage im Fenster', () => {
  const fenster = { breite: 1200, hoehe: 800 };
  const anker = (top: number, left: number) => ({ top, left, bottom: top + 30, right: left + 100, width: 100 });
  it('unter dem Chip, links bündig', () => { expect(menuLage(anker(100, 200), { breite: 240, hoehe: 200 }, fenster)).toMatchObject({ top: 136, left: 200, nachOben: false }); });
  it('unten zu wenig Platz → darüber', () => {
    const l = menuLage(anker(700, 200), { breite: 240, hoehe: 300 }, fenster);
    expect(l.nachOben).toBe(true);
    expect(l.top).toBe(700 - 6 - 300);
  });
  it('nie über den rechten oder linken Rand', () => {
    expect(menuLage(anker(100, 1150), { breite: 240, hoehe: 100 }, fenster).left).toBe(1200 - 8 - 240);
    expect(menuLage(anker(100, -20), { breite: 240, hoehe: 100 }, fenster).left).toBe(8);
  });
  it('höher als der Platz: Höhe wird begrenzt, oben bleibt im Fenster', () => {
    const l = menuLage(anker(400, 100), { breite: 240, hoehe: 2000 }, fenster);
    expect(l.top).toBeGreaterThanOrEqual(8);
    expect(l.maxHoehe).toBeLessThanOrEqual(800);
  });
});

describe('Gesellschaften aus der einen Quelle', () => {
  it('MAKE Innovation GmbH statt „Neue UG“/„MAKE OS UG“, Kennungen bleiben, „offen“ zuletzt', () => {
    expect(GESELLSCHAFT_WAHL.map(g => g.id)).toEqual(['kdc', 'kdv', 'ug', 'offen']);
    expect(GESELLSCHAFT_WAHL.find(g => g.id === 'ug')?.label).toBe('MAKE Innovation GmbH');
    expect(GESELLSCHAFT_WAHL.some(g => g.label === 'Neue UG' || g.label === 'MAKE OS UG')).toBe(false);
  });
});

describe('Wahl · neu anlegen (27.09. spät)', () => {
  const T = [{ id: 'Kunde', label: 'Kunde' }, { id: 'Zielkunde', label: 'Zielkunde' }, { id: 'Tech-Gründer', label: 'Tech-Gründer' }];
  it('leere Suche (auch nur Leerzeichen): Zeile „+ neu …“', () => {
    expect(anlegenZeile(T, '')).toEqual({ art: 'neu' });
    expect(anlegenZeile(T, '   ')).toEqual({ art: 'neu' });
    expect(anlegenZeile([], '')).toEqual({ art: 'neu' });
  });
  it('Suche ohne Treffer: „„<Suchtext>“ anlegen“ mit gesäubertem Text', () => {
    expect(anlegenZeile(T, '  Business   Angel ')).toEqual({ art: 'anlegen', text: 'Business Angel' });
  });
  it('Teiltreffer: Anlegen-Zeile bleibt (unter den Treffern), genauer Treffer: keine', () => {
    expect(wahlFiltern(T, 'kunde').map(e => e.id)).toEqual(['Kunde', 'Zielkunde']);
    expect(anlegenZeile(T, 'kund')).toEqual({ art: 'anlegen', text: 'kund' });
    expect(anlegenZeile(T, 'KUNDE')).toBeNull();
    expect(anlegenZeile(T, 'tech-gruender')).toBeNull();
  });
  it('Längenprüfung: Standard 2–60, eigene Grenzen, Leerraum zählt nicht mit', () => {
    expect([NEU_MIN, NEU_MAX]).toEqual([2, 60]);
    expect(neuPruefen('  Presse ', 'Typ')).toEqual({ ok: true, wert: 'Presse' });
    expect(neuPruefen('x', 'Typ')).toEqual({ ok: false, fehler: 'Typ: 2–60 Zeichen (jetzt 1).' });
    expect(neuPruefen('   ', 'Typ').ok).toBe(false);
    expect(neuPruefen('a'.repeat(60), 'Typ').ok).toBe(true);
    expect(neuPruefen('a'.repeat(61), 'Typ').ok).toBe(false);
    expect(neuPruefen('a'.repeat(41), 'Einheit', 2, 40)).toEqual({ ok: false, fehler: 'Einheit: 2–40 Zeichen (jetzt 41).' });
    expect(neuPruefen('KD   Ventures', 'Einheit', 2, 40)).toEqual({ ok: true, wert: 'KD Ventures' });
    expect(neuSaeubern(' a \n b ')).toBe('a b');
  });
});
