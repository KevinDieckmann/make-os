// ─── Prozesse C1 · Wächter: kein Server-Code im Browser-Bündel der Prozesse (22.10.) ─────────────────────────────────────────────────────────────
// Nach B2 scheiterte der Produktionsbau, weil die Werkstatt über definition-pruefen → ausloeser → lib/agenten/zeitplan.ts Server-Code zog (tsc und vitest
// merken das nicht). Dieser Wächter geht den Import-Graphen (statisch + dynamisch, ohne reine Typ-Importe) von jeder Datei unter components/os/prozesse
// und von den reinen Motor-Regeln (lib/prozesse/lauf-regeln.ts, lauf-typen.ts) — erreicht darf nichts werden, was Bestände, Node-Module, `next/server`,
// das KI-Tor oder `*-server.ts` lädt. Motor-Code (Bestände, Takt, askText, `after`) gehört nur in lib/prozesse/lauf-server.ts, lauf-stapel.ts und Routen.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const WURZEL = path.resolve(__dirname, '..');
const SERVER_MODUL = /^(node:|fs$|path$|crypto$|os$|child_process$|next\/server$|better-sqlite3|imapflow|nodemailer|pdf-lib)/;
const SERVER_DATEI = /(-server\.ts$|lib\/store\/local-db\.ts$|lib\/anthropic\.ts$|^app\/api\/|lib\/prozesse\/lauf-herkunft\.ts$|lib\/prozesse\/lauf-stapel\.ts$)/;

function aufloesen(von: string, spec: string): string | null {
  const p = spec.startsWith('@/') ? path.join(WURZEL, spec.slice(2)) : path.resolve(path.dirname(von), spec);
  for (const c of [p, `${p}.ts`, `${p}.tsx`, `${p}.mjs`, `${p}.js`, path.join(p, 'index.ts'), path.join(p, 'index.tsx')]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
}
/** Importe einer Datei, die wirklich geladen werden (ohne `import type` und ohne Klammern nur aus `type …`). */
function importe(quelle: string): string[] {
  const raus: string[] = [];
  const re = /(?:^|\n)\s*(import|export)\s+([^'";]*?)\s*from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(quelle))) {
    if (m[4] || m[5]) { raus.push((m[4] ?? m[5])!); continue; }
    const klausel = m[2].trim();
    if (/^type\b/.test(klausel)) continue;
    const klammer = /^\{([\s\S]*)\}$/.exec(klausel);
    if (klammer && klammer[1].split(',').map(s => s.trim()).filter(Boolean).every(s => s.startsWith('type '))) continue;
    if (m[1] === 'export' && !klammer && klausel !== '*' && !klausel.startsWith('* as')) continue;
    raus.push(m[3]);
  }
  return raus;
}
function serverFunde(eintritte: readonly string[]): string[] {
  const gesehen = new Set<string>();
  const funde: string[] = [];
  const geh = (f: string) => {
    if (gesehen.has(f)) return;
    gesehen.add(f);
    for (const spec of importe(fs.readFileSync(f, 'utf8'))) {
      const rel = path.relative(WURZEL, f);
      if (!spec.startsWith('.') && !spec.startsWith('@/')) { if (SERVER_MODUL.test(spec)) funde.push(`${rel} → ${spec}`); continue; }
      const z = aufloesen(f, spec);
      if (!z) continue;
      const zr = path.relative(WURZEL, z);
      if (SERVER_DATEI.test(zr)) { funde.push(`${rel} → ${zr}`); continue; }
      geh(z);
    }
  };
  for (const e of eintritte) geh(e);
  return funde;
}
const dateienIn = (ordner: string): string[] => (fs.existsSync(ordner) ? fs.readdirSync(ordner, { recursive: true }).map(x => path.join(ordner, String(x))).filter(f => /\.(tsx?|mjs)$/.test(f) && fs.statSync(f).isFile()) : []);

describe('Kein Server-Code im Browser-Bündel der Prozesse', () => {
  it('components/os/prozesse/** erreicht weder Bestände noch Node-Module noch *-server.ts', () => {
    const eintritte = dateienIn(path.join(WURZEL, 'components/os/prozesse'));
    expect(eintritte.length).toBeGreaterThan(0);
    expect(serverFunde(eintritte)).toEqual([]);
  });
  it('die reinen Motor-Regeln (lauf-regeln, lauf-typen) sind client-sicher — die Werkstatt darf sie für Probelauf und Läufe-Ansicht nutzen', () => {
    expect(serverFunde([path.join(WURZEL, 'lib/prozesse/lauf-regeln.ts'), path.join(WURZEL, 'lib/prozesse/lauf-typen.ts')])).toEqual([]);
  });
  it('der Wächter selbst erkennt Server-Code (Gegenprobe: der Motor-Server lädt Bestände)', () => {
    expect(serverFunde([path.join(WURZEL, 'lib/prozesse/lauf-server.ts')]).length).toBeGreaterThan(0);
  });
});
