// ─── Die Grenze um die Ordner der zweiten Person ────────────────────────────
// 06.09.: „er darf alles lesen" — und auf die Rückfrage, ob das auch für die privaten Ordner der zweiten Person gilt:
// „Nein, die bleiben draußen."
//
// Der Ausschluss greift beim LESEN, nicht beim Suchen. Ein Filter, der erst
// die Treffer siebt, kann versagen; was gar nicht erst geöffnet wird, kann
// nicht durchrutschen. Dieser Test hält genau diese Regel fest — er ist der
// Grund, warum sie nicht versehentlich gelockert wird.
//
// Seit 09.10. kommt die Regel aus den Konten (`ordnerRegel`): hier mit den gewachsenen Speichernamen des Altbestands
// (Haupt-Inhaber + zweite Person im selben Haushalt) — dieselben Fälle wie vorher. Kundeninstanzen: tests/vault-sicht.test.ts.

import { describe, it, expect } from 'vitest';
import { istPrivat, ordnerRegel, vaultPersonenAus } from '../lib/zoe/vault';

const konto = (speicher: string, name: string, rolle: 'inhaber' | 'mitglied') =>
  ({ id: `k-${speicher}`, speicher, email: `${speicher}@example.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] as string[] }, haushalt: 'h-alt' });
const REGEL = ordnerRegel(vaultPersonenAus({ konten: [konto('kevin', 'Kevin Probe', 'inhaber'), konto('malin', 'Malin Probe', 'mitglied')] }));

describe('Vault-Grenze', () => {
  it('lässt die eigenen Ordner der zweiten Person draußen', () => {
    for (const ordner of [
      '02. Malin',
      'Malin',
      'Malin an Kevin ',
      'malin-notizen',
      '05 Ziele Malin',
    ]) {
      expect(istPrivat(ordner, REGEL), ordner).toBe(true);
    }
  });

  it('lässt das gemeinsame Beziehungs-Brain herein', () => {
    // Entscheidung: was beiden gehört, bleibt lesbar.
    expect(istPrivat('03_Malin_Kevin_Brain', REGEL)).toBe(false);
    expect(istPrivat('Malin & Kevin', REGEL)).toBe(false);
  });

  it('hält normale Ordner nicht auf', () => {
    for (const ordner of ['01 Start', 'Make.Claude', 'Projects Kopie', 'KEMARIS', '05 Wissen']) {
      expect(istPrivat(ordner, REGEL), ordner).toBe(false);
    }
  });
});
