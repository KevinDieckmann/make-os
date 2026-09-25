// ─── Schnittstellen bleiben frisch (25.09.) ─────────────────────────────────
// Seit MAKE OS im schnellen Modus läuft (next start), friert Next eine
// GET-Route, die nicht ausdrücklich dynamisch ist, beim Bauen ein — sie
// liefert dann für immer den Stand vom Bau (so wäre es dem KEMARIS-Postfach
// ergangen). Jede Route mit GET trägt deshalb dynamic = 'force-dynamic'.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function routen(ordner: string): string[] {
  return readdirSync(ordner).flatMap(n => {
    const p = join(ordner, n);
    return statSync(p).isDirectory() ? routen(p) : n === 'route.ts' ? [p] : [];
  });
}

describe('Schnittstellen', () => {
  it('jede GET-Route ist dynamisch — nichts wird beim Bauen eingefroren', () => {
    const eingefroren = routen('app/api').filter(p => {
      const t = readFileSync(p, 'utf8');
      return /export (async )?function GET/.test(t) && !t.includes("export const dynamic = 'force-dynamic'");
    });
    expect(eingefroren, `Ohne force-dynamic:\n${eingefroren.join('\n')}`).toEqual([]);
  });
  it('Seiten hinter der Anmeldung werden nie beim Bauen vorab erzeugt', () => {
    const seiten = (o: string): string[] => readdirSync(o).flatMap(n => { const p = join(o, n); return statSync(p).isDirectory() ? seiten(p) : n === 'page.tsx' ? [p] : []; });
    expect(readFileSync('app/os/layout.tsx', 'utf8')).toContain("export const dynamic = 'force-dynamic'");
    expect(readFileSync('app/jarvis/page.tsx', 'utf8')).toContain("export const dynamic = 'force-dynamic'");
    expect(seiten('app/os').filter(p => readFileSync(p, 'utf8').includes('generateStaticParams'))).toEqual([]);
  });
});
