// ─── Lesbarkeit: nichts unter 11 px ─────────────────────────────────────────
// Aus der UX-Analyse vom 06.09. (Vorbilder Whoop & N26): die meistgenutzte
// Schriftgröße der Software war 9,5 px. Auf einem Laptop ist das für Kevin und
// Malin im Alltag nicht lesbar — und es war nie eine Entscheidung, sondern
// entstand beim Abtippen von Datei zu Datei.
//
// 397 Stellen wurden auf 11 px (TYP.mikro) angehoben. Dieser Test hält den
// Stand: wer wieder 9,5 schreibt, merkt es sofort, statt es erst zu sehen,
// wenn die Seite schon steht.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Alle .tsx unter einem Ordner, rekursiv. */
function dateien(ordner: string): string[] {
  const raus: string[] = [];
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) raus.push(...dateien(pfad));
    else if (name.endsWith('.tsx')) raus.push(pfad);
  }
  return raus;
}

describe('Lesbarkeit', () => {
  it('setzt nirgends Text unter 11 px', () => {
    const zuKlein: string[] = [];
    for (const pfad of [...dateien('components'), ...dateien('app')]) {
      const text = readFileSync(pfad, 'utf8');
      const zeilen = text.split('\n');
      zeilen.forEach((zeile, i) => {
        // Array.from, weil das Projekt ohne downlevelIteration übersetzt.
        for (const treffer of Array.from(zeile.matchAll(/fontSize: (\d+(?:\.\d+)?)/g))) {
          if (Number(treffer[1]) < 11) zuKlein.push(`${pfad}:${i + 1} — ${treffer[1]}px`);
        }
      });
    }
    expect(zuKlein, `Zu kleine Schrift:\n${zuKlein.join('\n')}`).toEqual([]);
  });
});
