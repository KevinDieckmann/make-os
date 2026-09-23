// ─── Die drei Räume ─────────────────────────────────────────────────────────
// Kevin am 06.09.: „Jeder seinen Space, und einen klaren Space zusammen."
//
// Der Test hält die Zugriffsregel fest, BEVOR es einen echten Login gibt.
// Wenn der Server später kommt, wird nur personAus() ausgetauscht — die Regel
// darunter muss dieselbe bleiben, sonst verschiebt sich unbemerkt, wer was
// sieht.

import { describe, it, expect } from 'vitest';
import { darfSehen, nurSichtbar, personAus, eigenerRaum } from '../lib/jarvis/raum';

const anfrage = (kopf: Record<string, string>) => new Request('http://x/', { headers: kopf });

describe('Räume', () => {
  it('lässt jeden in seinen eigenen Raum', () => {
    expect(darfSehen('kevin', 'kevin')).toBe(true);
    expect(darfSehen('malin', 'malin')).toBe(true);
  });

  it('lässt niemanden in den Raum der anderen Person', () => {
    expect(darfSehen('malin', 'kevin')).toBe(false);
    expect(darfSehen('kevin', 'malin')).toBe(false);
  });

  it('zeigt Gemeinsames beiden', () => {
    expect(darfSehen('gemeinsam', 'kevin')).toBe(true);
    expect(darfSehen('gemeinsam', 'malin')).toBe(true);
  });

  it('lässt Altbestand ohne Raum sichtbar — sonst verschwindet Gewachsenes', () => {
    expect(darfSehen(undefined, 'kevin')).toBe(true);
    expect(darfSehen(undefined, 'malin')).toBe(true);
  });

  it('filtert Listen entsprechend', () => {
    const liste = [
      { id: 'a', raum: 'kevin' as const },
      { id: 'b', raum: 'malin' as const },
      { id: 'c', raum: 'gemeinsam' as const },
      { id: 'd' },
    ];
    expect(nurSichtbar(liste, 'malin').map(x => x.id)).toEqual(['b', 'c', 'd']);
    expect(nurSichtbar(liste, 'kevin').map(x => x.id)).toEqual(['a', 'c', 'd']);
  });

  it('liest die Person aus der Sitzung (Kopf x-make-user, von der Middleware gesetzt)', () => {
    expect(personAus(anfrage({ 'x-make-user': 'malin' }))).toBe('malin');
    expect(personAus(anfrage({ 'x-make-user': 'joerg2' }))).toBe('joerg2');
  });

  it('ignoriert das alte Personen-Cookie — seit 23.09. ist das Schutz, keine Zuschreibung', () => {
    expect(personAus(anfrage({ cookie: 'make-os-person=malin' }))).toBe('kevin');
    expect(personAus(anfrage({ 'x-make-user': '../etc' }))).toBe('kevin');
  });

  it('nimmt im Zweifel Kevin — nie die andere Person', () => {
    expect(personAus(anfrage({}))).toBe('kevin');
    expect(personAus(anfrage({ 'x-make-user': '' }))).toBe('kevin');
  });

  it('lässt den Dienstweg die Person im Kopf mitgeben — der Arbeiter hat kein Cookie', () => {
    expect(personAus(anfrage({ 'x-make-person': 'malin' }))).toBe('malin');
    // Der Kopf schlägt das Cookie: der Auftrag weiß, für wen er läuft.
    expect(personAus(anfrage({ 'x-make-person': 'malin', cookie: 'make-os-person=kevin' }))).toBe('malin');
  });

  it('legt Neues in den eigenen Raum', () => {
    expect(eigenerRaum('malin')).toBe('malin');
    expect(eigenerRaum('kevin')).toBe('kevin');
  });
});
