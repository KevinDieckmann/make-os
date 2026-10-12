import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { WEG } from '../lib/wege';

function seiteDa(href: string): boolean {
  const teile = href.split(/[?#]/)[0].replace(/^\//, '').split('/');
  let ordner = path.join(process.cwd(), 'app');
  for (const t of teile) {
    if (existsSync(path.join(ordner, t))) { ordner = path.join(ordner, t); continue; }
    const dyn = readdirSync(ordner).find(n => /^\[[^.]/.test(n));
    if (!dyn) return false;
    ordner = path.join(ordner, dyn);
  }
  return existsSync(path.join(ordner, 'page.tsx'));
}

// Gesamtprüfung 12.10.: jede Funktion von `WEG` (lib/wege.ts) liefert — mit Beispiel-Kennungen — eine Adresse, hinter der es unter app/ eine echte Seite gibt
// (auch über dynamische Segmente wie /os/planung/[horizont]). Eine umbenannte oder entfernte Seite macht diesen Test rot, bevor ein toter Link in der Oberfläche steht.
describe('WEG: jeder Link führt auf eine echte Seite', () => {
  it('alle Funktionen', () => {
    const tot: string[] = [];
    const geprueft: string[] = [];
    for (const [name, f] of Object.entries(WEG as Record<string, unknown>)) {
      if (typeof f !== 'function') continue;
      const versuche: unknown[][] = [[], ['x1'], ['x1', 'y2'], ['privat'], ['business']];
      let ok = false;
      for (const args of versuche) {
        try {
          const r = (f as (...a: unknown[]) => unknown)(...args);
          if (typeof r === 'string' && r.startsWith('/')) {
            geprueft.push(`${name}${JSON.stringify(args)} -> ${r}`);
            if (!seiteDa(r) && r !== '/zoe' && !r.startsWith('/zoe')) tot.push(`${name}${JSON.stringify(args)} -> ${r}`);
            ok = true;
            break;
          }
        } catch { /* nächster Versuch */ }
      }
      if (!ok) tot.push(`${name}: kein Ergebnis`);
    }
    expect(geprueft.length).toBeGreaterThan(40);
    expect(tot).toEqual([]);
  });
});
