// Wächter: Vorschau-Kennwort auf den Websites (Kevin 31.10.: „ein Kennwort, damit nicht alle direkt draufgucken können“;
// 12.11.: „auf jeder Seite einen kleinen Login, bis wir offiziell rausgehen“). Die GANZE Seite (auch die App-Pfade dort) fragt
// Benutzer + Kennwort ab; im Repo steht nur der bcrypt-Hash (base64), nie das Kennwort.
// Seit 12.11. liegt das Dach unter makeinnovation.de (vorher fokusinnovation.de); dazu kommen makestudios.de und makerevenue.de.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const caddy = readFileSync(join(process.cwd(), 'deploy/caddy/Caddyfile'), 'utf8');
/** Der Block `<adresse> { … }` bis zur schließenden Klammer am Zeilenanfang. */
const blockVon = (adresse: string): string => {
  const a = caddy.indexOf('\n' + adresse + ' {');
  return a < 0 ? '' : caddy.slice(a, caddy.indexOf('\n}', a) + 2);
};
const hashVon = (block: string): string | null => block.match(/basic_auth[^{]*\{\s*Besucher (\S+)\s*\}/)?.[1] ?? null;

describe('makeinnovation.de (das Dach) mit Vorschau-Kennwort', () => {
  const block = blockVon('makeinnovation.de');

  it('basic_auth steht vor allen Handlern des Blocks', () => {
    expect(block).toContain('basic_auth bcrypt "MAKE Innovation" {');
    const auth = block.indexOf('basic_auth');
    expect(auth).toBeGreaterThan(0);
    expect(auth).toBeLessThan(block.indexOf('handle @app'));
    expect(auth).toBeLessThan(block.indexOf('\thandle {'));
  });

  it('der Benutzer heißt „Besucher“, das Kennwort steht nur als bcrypt-Hash da', () => {
    const m = hashVon(block);
    expect(m).not.toBeNull();
    const hash = Buffer.from(m!, 'base64').toString('utf8');
    expect(hash).toMatch(/^\$2a\$1[0-4]\$[./A-Za-z0-9]{53}$/);
  });

  it('ohne Kennwort (401) kommt ein kurzer Text, nicht die 404-Seite', () => {
    expect(block).toMatch(/@ohne_kennwort expression `\{err\.status_code\} == 401`/);
    expect(block).toMatch(/handle @ohne_kennwort \{[^}]*respond "[^"]+" 401/);
  });

  it('die www-Adresse und die frühere Adresse fokusinnovation.de leiten nur weiter (das Kennwort fragt die Hauptadresse)', () => {
    for (const adresse of ['www.makeinnovation.de', 'fokusinnovation.de, www.fokusinnovation.de']) {
      const b = blockVon(adresse);
      expect(b, adresse).toContain('redir https://makeinnovation.de{uri} 301');
      expect(b, adresse).not.toContain('basic_auth');
    }
  });
});

describe.each([['makestudios.de', 'MAKE Studios', '/srv/makestudios'], ['makerevenue.de', 'MAKE Revenue', '/srv/makerevenue']])('%s (Marke) mit Vorschau-Kennwort', (adresse, name, ordner) => {
  const block = blockVon(adresse);

  it('basic_auth steht vor dem Ausliefern, Benutzer „Besucher“, nur der bcrypt-Hash', () => {
    expect(block).toContain('basic_auth bcrypt "' + name + '" {');
    expect(block.indexOf('basic_auth')).toBeLessThan(block.indexOf('\thandle {'));
    const hash = Buffer.from(hashVon(block) ?? '', 'base64').toString('utf8');
    expect(hash).toMatch(/^\$2a\$1[0-4]\$[./A-Za-z0-9]{53}$/);
  });

  it('überall dasselbe Vorschau-Kennwort wie beim Dach', () => {
    expect(hashVon(block)).toBe(hashVon(blockVon('makeinnovation.de')));
  });

  it('liefert nur aus ihrem Ordner, für Suchmaschinen gesperrt, Arbeitsdateien nie', () => {
    expect(block).toContain('root * ' + ordner);
    expect(block).toContain('import marke_dateien');
    expect(block).not.toMatch(/reverse_proxy/);
    const dateien = caddy.slice(caddy.indexOf('\n(marke_dateien) {'), caddy.indexOf('\n}', caddy.indexOf('\n(marke_dateien) {')) + 2);
    expect(dateien).toMatch(/@intern path \*\.md \*\.mjs \/seo\.json \/seo-stand\.json \/seiten\.json \/websites\/daten\.json \/\.vorschau \/logo-entwuerfe\/\* \/beispiele\/_vorlage\/\*/);
    expect(dateien).toContain('respond @intern 404');
    const koepfe = caddy.slice(caddy.indexOf('\n(marke_koepfe) {'), caddy.indexOf('\n}', caddy.indexOf('\n(marke_koepfe) {')) + 2);
    expect(koepfe).toContain('X-Robots-Tag "noindex, nofollow"');
    expect(koepfe).toMatch(/Content-Security-Policy "default-src 'self';[^"]*script-src 'self' 'wasm-unsafe-eval';[^"]*frame-ancestors 'none'/);
  });

  it('ohne Kennwort (401) kommt ein kurzer Text; die www-Adresse leitet nur weiter', () => {
    expect(block).toMatch(/handle @ohne_kennwort \{[^}]*respond "[^"]+" 401/);
    const www = blockVon('www.' + adresse);
    expect(www).toContain('redir https://' + adresse + '{uri} 301');
    expect(www).not.toContain('basic_auth');
  });

  it('die Einbindung in compose.yml zeigt auf den Prototyp-Ordner, nur lesen', () => {
    const compose = readFileSync(join(process.cwd(), 'compose.yml'), 'utf8');
    expect(compose).toMatch(new RegExp('- \\./prototype/make-(studios|revenue):' + ordner.replace(/\//g, '\\/') + ':ro'));
  });
});
