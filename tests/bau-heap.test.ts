// ─── Bau braucht mehr als 2 GB Heap (14.10.) ──────────────────────────────────────────────────────────────────────────────────
// Der Produktionsbau lief lokal (8 GB) mit dem Standard-Heap (~¼ des Arbeitsspeichers) in „heap out of memory“. Der Bild-Bau auf dem
// GitHub-Runner (7 GB) hätte dasselbe Problem — das Ausrollen wäre gescheitert. Wächter: jeder Bau-Weg setzt den Heap ausdrücklich.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const lies = (d: string) => readFileSync(path.join(process.cwd(), d), 'utf8');

describe('Bau-Heap', () => {
  it('Dockerfile und start.sh bauen mit --max-old-space-size ≥ 4096', () => {
    for (const d of ['Dockerfile', 'start.sh']) {
      const zeilen = lies(d).split('\n').filter(z => z.includes('next build') && !z.trim().startsWith('#') && !z.includes('echo'));
      expect(zeilen.length, d).toBeGreaterThan(0);
      for (const z of zeilen) {
        const m = z.match(/--max-old-space-size=(\d+)/);
        expect(m, `${d}: ${z.trim()}`).not.toBeNull();
        expect(Number(m![1])).toBeGreaterThanOrEqual(4096);
      }
    }
  });
});
