// ─── Die Grenze um Malins Ordner ────────────────────────────────────────────
// Kevin am 06.09.: „er darf alles lesen" — und auf die Rückfrage, ob das auch
// für Malins private Ordner gilt: „Nein, die bleiben draußen."
//
// Der Ausschluss greift beim LESEN, nicht beim Suchen. Ein Filter, der erst
// die Treffer siebt, kann versagen; was gar nicht erst geöffnet wird, kann
// nicht durchrutschen. Dieser Test hält genau diese Regel fest — er ist der
// Grund, warum sie nicht versehentlich gelockert wird.

import { describe, it, expect } from 'vitest';
import { istPrivat } from '../lib/jarvis/vault';

describe('Vault-Grenze', () => {
  it('lässt Malins eigene Ordner draußen', () => {
    for (const ordner of [
      '02. Malin',
      'Malin',
      'Malin an Kevin ',
      'malin-notizen',
      '05 Ziele Malin',
    ]) {
      expect(istPrivat(ordner), ordner).toBe(true);
    }
  });

  it('lässt das gemeinsame Beziehungs-Brain herein', () => {
    // Kevins Entscheidung: was beiden gehört, bleibt lesbar.
    expect(istPrivat('03_Malin_Kevin_Brain')).toBe(false);
    expect(istPrivat('Malin & Kevin')).toBe(false);
  });

  it('hält normale Ordner nicht auf', () => {
    for (const ordner of ['01 Start', 'Make.Claude', 'Projects Kopie', 'KEMARIS', '05 Wissen']) {
      expect(istPrivat(ordner), ordner).toBe(false);
    }
  });
});
