// ─── Eigene Felder: gespeicherte Werte bleiben, Umbenennen zieht mit, deutsche Beträge (29.09., A6) ─
import { describe, it, expect } from 'vitest';
import { euroAlsCent, feldWerteTypisieren, auswahlUmbenennungen } from '@/lib/aufgaben/saeubern';
import { centAus } from '@/components/os/aufgaben/EigeneFelder';

describe('Deutsche Beträge → Cent', () => {
  it('Tausenderpunkt, Komma, Euro-Zeichen, Minus — und kein 1,50 € aus „1.500“', () => {
    expect(euroAlsCent('1.500')).toBe(150000);
    expect(euroAlsCent('1.500,40')).toBe(150040);
    expect(euroAlsCent('1.500.000')).toBe(150000000);
    expect(euroAlsCent('1500,4')).toBe(150040);
    expect(euroAlsCent('12,5 €')).toBe(1250);
    expect(euroAlsCent('-3,20')).toBe(-320);
    expect(euroAlsCent('0.99')).toBe(99);
    expect(euroAlsCent('1500')).toBe(150000);
    expect(euroAlsCent('abc')).toBeNull();
    expect(euroAlsCent('1,2,3')).toBeNull();
    expect(euroAlsCent('')).toBeNull();
    // Die Oberfläche rechnet genauso.
    expect(centAus('1.500')).toBe(150000);
  });
});

describe('Nur neu gesetzte Werte prüfen', () => {
  const defs = [{ id: 'k', name: 'Kanal', typ: 'auswahl' as const, optionen: ['Messe'] }, { id: 'b', name: 'Budget', typ: 'betrag' as const }];
  it('Ein gespeicherter Wert einer entfernten Option bleibt; ein neuer ungültiger ersetzt den alten nicht', () => {
    expect(feldWerteTypisieren({ k: 'Web' }, defs, { k: 'Web' })).toEqual({ k: 'Web' });
    expect(feldWerteTypisieren({ k: 'Quatsch' }, defs, { k: 'Web' })).toEqual({ k: 'Web' });
    expect(feldWerteTypisieren({ k: 'Messe' }, defs, { k: 'Web' })).toEqual({ k: 'Messe' });
    // Ohne gespeicherten Wert wie bisher: ungültig → nicht gesetzt.
    expect(feldWerteTypisieren({ k: 'Web' }, defs)).toBeUndefined();
    expect(feldWerteTypisieren({ b: '1.500' }, defs)).toEqual({ b: 150000 });
  });
  it('Umbenennen erkennen: gleiche Stelle, neuer Wert — Entfernen/Hinzufügen ist kein Umbenennen', () => {
    const f = (optionen: string[]) => [{ id: 'k', name: 'Kanal', typ: 'auswahl' as const, optionen }];
    expect(auswahlUmbenennungen(f(['Messe', 'Web']), f(['Messe', 'Online']))).toEqual([{ feldId: 'k', von: 'Web', nach: 'Online' }]);
    expect(auswahlUmbenennungen(f(['Messe', 'Web']), f(['Messe']))).toEqual([]);
    expect(auswahlUmbenennungen(f(['Messe', 'Web']), f(['Web', 'Messe']))).toEqual([]);
    expect(auswahlUmbenennungen(f(['Messe']), f(['Messe', 'Web']))).toEqual([]);
  });
});
