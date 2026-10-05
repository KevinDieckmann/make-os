// ─── Zugang & Schlüssel härten, Punkt 9 (05.10.): Caddy und Compose ─────────────────────────────────────────
// Caddy entfernt x-middleware-subrequest und setzt X-Make-Vorbau (Dienstschlüssel nur von innen); Compose begrenzt
// Prozesse (pids_limit) und hält den Arbeiter schreibgeschützt. Geprüft wird der Text (Caddy/Docker laufen nur am Server).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const caddy = readFileSync('deploy/caddy/Caddyfile', 'utf8').split('\n').filter(z => !z.trim().startsWith('#')).join('\n');
const software = /\{\$MAKE_OS_DOMAIN\} \{([\s\S]*?)\n\}/.exec(caddy)?.[1] ?? '';
const compose = readFileSync('compose.yml', 'utf8');
const dienst = (name: string) => new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z]+:\\n|\\nvolumes:)`).exec(compose)?.[1] ?? '';

describe('Caddyfile (Software-Block)', () => {
  it('entfernt x-middleware-subrequest und setzt die Vorbau-Marke vor dem Weiterleiten', () => {
    expect(software).toMatch(/^\s*request_header -x-middleware-subrequest$/m);
    expect(software).toMatch(/^\s*request_header X-Make-Vorbau "1"$/m);
    expect(software).toMatch(/^\s*reverse_proxy app:3000$/m);
    // Der Zulieferer-Schlüssel muss weiter durch: x-make-key wird NICHT entfernt.
    expect(software).not.toMatch(/request_header -x-make-key/i);
  });
  it('die Marke heißt in Caddy und App gleich', () => {
    expect(readFileSync('lib/zugang/intern.ts', 'utf8')).toContain("kopf.get('x-make-vorbau')");
  });
});

describe('compose.yml', () => {
  it('pids_limit für app und arbeiter; arbeiter read_only mit tmpfs; app (noch) nicht read_only', () => {
    expect(dienst('app')).toMatch(/^\s+pids_limit: \d+$/m);
    expect(dienst('arbeiter')).toMatch(/^\s+pids_limit: \d+$/m);
    expect(dienst('arbeiter')).toMatch(/^\s+read_only: true$/m);
    expect(dienst('arbeiter')).toMatch(/^\s+tmpfs: \["\/tmp:/m);
    expect(dienst('app')).not.toMatch(/^\s+read_only: true$/m);
  });
});
