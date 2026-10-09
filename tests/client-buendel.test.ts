// ─── Wächter: keine Node-Module im Browser-Bündel (Generalprobe Neustart 09.10.2026) ─────────────────────────────────────────────────
// Befund: `components/os/agenten/HeadMitte.tsx` ('use client') importierte `unterlagenHead` aus lib/agenten/unterlagen-werkzeug.ts — darüber zog
// webpack lib/anthropic.ts, local-db, konten.ts (node:crypto, fs) ins Browser-Bündel, `next build` brach ab. tsc, vitest und ESLint (die
// GitHub-Prüfung) merken das NICHT; erst der Bau beim Ausrollen wäre gescheitert. Dieser Wächter folgt von jeder 'use client'-Datei allen
// Importen (statisch, `export … from`, `import()` — außer reinen Typ-Importen) durch lib/components/app und wird rot, sobald dabei ein
// Node-Modul (fs, node:*, child_process …) erreicht wird. Abhilfe: die reine Regel in eine eigene, client-sichere Datei legen
// (Vorbild lib/agenten/unterlagen-head.ts) oder den Wert über eine Route holen.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const W = path.resolve(__dirname, '..');
const NODE = /^(node:|fs$|fs\/|child_process$|net$|tls$|dns$|worker_threads$|better-sqlite3$|readline$|cluster$)/;
const OHNE = new Set(['node_modules', '.git', 'tests']);

function dateien(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap(n => {
    if (OHNE.has(n) || n.startsWith('.next')) return [];
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? dateien(p) : /\.(tsx?|mjs)$/.test(n) ? [p] : [];
  });
}

function aufloesen(von: string, spec: string): { datei?: string; extern?: string } {
  let basis: string;
  if (spec.startsWith('@/')) basis = path.join(W, spec.slice(2));
  else if (spec.startsWith('.')) basis = path.resolve(path.dirname(von), spec);
  else return { extern: spec };
  for (const k of ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx']) {
    const p = basis + k;
    if (existsSync(p) && statSync(p).isFile()) return { datei: p };
  }
  return {};
}

const cache = new Map<string, string[]>();
function importe(datei: string): string[] {
  const c = cache.get(datei);
  if (c) return c;
  const s = readFileSync(datei, 'utf8');
  const l: string[] = [];
  for (const m of s.matchAll(/^\s*(?:import|export)\s+(type\s+)?([^;'"]*?)\s*from\s+['"]([^'"]+)['"]/gm)) {
    if (m[1]) continue; // import type … / export type …
    const klammer = m[2].match(/\{([^}]*)\}/);
    const nurTypen = klammer && !m[2].replace(klammer[0], '').replace(/[,\s]/g, '')
      && klammer[1].split(',').map(x => x.trim()).filter(Boolean).every(x => x.startsWith('type '));
    if (!nurTypen) l.push(m[3]);
  }
  for (const m of s.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) l.push(m[1]);
  for (const m of s.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) l.push(m[1]);
  cache.set(datei, l);
  return l;
}

describe('Browser-Bündel ohne Node-Module', () => {
  it('keine \'use client\'-Datei erreicht über ihre Importe fs/node:*', () => {
    const alle = ['app', 'components', 'lib', 'context', 'hooks'].flatMap(d => dateien(path.join(W, d)));
    const client = alle.filter(d => /^\s*['"]use client['"]/.test(readFileSync(d, 'utf8')));
    expect(client.length).toBeGreaterThan(100);
    const funde: string[] = [];
    for (const c of client) {
      const herkunft = new Map<string, string | null>([[c, null]]);
      const stapel = [c];
      let fund: string | null = null;
      while (stapel.length && !fund) {
        const d = stapel.pop()!;
        for (const spec of importe(d)) {
          const r = aufloesen(d, spec);
          if (r.extern && NODE.test(r.extern)) {
            const kette: string[] = [];
            for (let x: string | null | undefined = d; x; x = herkunft.get(x)) kette.unshift(path.relative(W, x));
            fund = `${kette.join(' → ')} → ${r.extern}`;
            break;
          }
          if (r.datei && !herkunft.has(r.datei)) { herkunft.set(r.datei, d); stapel.push(r.datei); }
        }
      }
      if (fund) funde.push(fund);
    }
    expect(funde).toEqual([]);
  });
});
