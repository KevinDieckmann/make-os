// Wächter: Vorschau-Kennwort auf fokusinnovation.de (Kevin 31.10.: „ein Kennwort, damit nicht alle direkt draufgucken können“).
// Die GANZE Seite (auch die App-Pfade dort) fragt Benutzer + Kennwort ab; im Repo steht nur der bcrypt-Hash (base64), nie das Kennwort.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const caddy = readFileSync(join(process.cwd(), 'deploy/caddy/Caddyfile'), 'utf8');
/** Der Block `fokusinnovation.de { … }` bis zur schließenden Klammer am Zeilenanfang. */
const block = caddy.slice(caddy.indexOf('\nfokusinnovation.de {'), caddy.indexOf('\n}', caddy.indexOf('\nfokusinnovation.de {')) + 2);

describe('fokusinnovation.de mit Vorschau-Kennwort', () => {
  it('basic_auth steht vor allen Handlern des Blocks', () => {
    expect(block).toContain('basic_auth bcrypt "Fokus Innovation" {');
    const auth = block.indexOf('basic_auth');
    expect(auth).toBeGreaterThan(0);
    expect(auth).toBeLessThan(block.indexOf('handle @app'));
    expect(auth).toBeLessThan(block.indexOf('\thandle {'));
  });

  it('der Benutzer heißt „Besucher“, das Kennwort steht nur als bcrypt-Hash da', () => {
    const m = block.match(/basic_auth[^{]*\{\s*Besucher (\S+)\s*\}/);
    expect(m).not.toBeNull();
    const hash = Buffer.from(m![1], 'base64').toString('utf8');
    expect(hash).toMatch(/^\$2a\$1[0-4]\$[./A-Za-z0-9]{53}$/);
  });

  it('ohne Kennwort (401) kommt ein kurzer Text, nicht die 404-Seite', () => {
    expect(block).toMatch(/@ohne_kennwort expression `\{err\.status_code\} == 401`/);
    expect(block).toMatch(/handle @ohne_kennwort \{[^}]*respond "[^"]+" 401/);
  });

  it('der www-Block leitet nur weiter (das Kennwort fragt die Hauptadresse)', () => {
    const www = caddy.slice(caddy.indexOf('www.fokusinnovation.de {'), caddy.indexOf('\n}', caddy.indexOf('www.fokusinnovation.de {')) + 2);
    expect(www).toContain('redir https://fokusinnovation.de{uri} 301');
    expect(www).not.toContain('basic_auth');
  });
});
