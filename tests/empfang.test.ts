// ─── Empfang: die Regeln des Startbildschirms ───────────────────────────────

import { describe, it, expect } from 'vitest';
import { zustandVon, inWorte, wortVerzug, vorschlaege, tagesWort } from '../lib/make-one/empfang';

describe('Zustand', () => {
  it('gibt Zuhören den Vorrang — Kevin tut in dem Moment etwas', () => {
    expect(zustandVon({ hoert: true, spricht: true, denkt: true })).toBe('hoert');
  });

  it('zeigt Sprechen, während im Hintergrund noch gedacht wird', () => {
    expect(zustandVon({ hoert: false, spricht: true, denkt: true })).toBe('spricht');
  });

  it('fällt auf Ruhe zurück, wenn nichts läuft', () => {
    expect(zustandVon({ hoert: false, spricht: false, denkt: false })).toBe('ruht');
  });
});

describe('Wörter', () => {
  it('behält Absätze — sonst geht die Form des Textes verloren', () => {
    expect(inWorte('a b\n\nc').join('')).toBe('a b\n\nc');
  });

  it('gibt keine leeren Teile zurück', () => {
    expect(inWorte('  a  ').every(t => t.length > 0)).toBe(true);
  });

  it('deckelt die Verzögerung, damit ein langer Absatz nicht ewig braucht', () => {
    expect(wortVerzug(0)).toBe(0);
    expect(wortVerzug(400)).toBeLessThanOrEqual(2.2);
  });
});

describe('Vorschläge', () => {
  it('liefert zu jeder Stunde des Tages genau vier', () => {
    for (let h = 0; h < 24; h++) expect(vorschlaege(h)).toHaveLength(4);
  });

  it('fragt morgens nach dem Tag und abends nach dem Rückblick', () => {
    expect(vorschlaege(7).join(' ')).toContain('heute');
    expect(vorschlaege(20).join(' ')).toContain('Tag');
  });

  it('kennt für jede Stunde ein Tageswort', () => {
    for (let h = 0; h < 24; h++) expect(tagesWort(h)).not.toBe('');
  });
});
