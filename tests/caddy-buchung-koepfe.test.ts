// ─── Upload U1 N1 (29.09.): Caddy überschreibt die strengen Köpfe der Buchungsseite nicht mehr ─
// Die App setzt für /buchen… und /api/buchung… `Referrer-Policy: no-referrer` und eine Permissions-Policy ohne
// Kamera/Mikrofon (next.config.mjs). Caddy setzte früher für ALLE Pfade die allgemeinen Werte und überschrieb sie.
// Geprüft wird der Text der Caddyfile (Caddy selbst läuft nur auf dem Server).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const caddy = readFileSync('deploy/caddy/Caddyfile', 'utf8').split('\n').filter(z => !z.trim().startsWith('#')).join('\n');
const nextKonfig = readFileSync('next.config.mjs', 'utf8');

describe('Caddyfile: Referrer-/Permissions-Policy', () => {
  it('allgemein nur als Vorgabe („?“) — nie ein harter Überschreiber', () => {
    expect(caddy).toMatch(/^\s*\?Referrer-Policy strict-origin-when-cross-origin$/m);
    expect(caddy).toMatch(/^\s*\?Permissions-Policy /m);
    expect(caddy).not.toMatch(/^\s*Referrer-Policy strict-origin-when-cross-origin$/m);
  });
  it('Buchungspfade: dieselben strengen Werte wie die App', () => {
    expect(caddy).toMatch(/@buchung path \/buchen \/buchen\/\* \/api\/buchung \/api\/buchung\/\*/);
    const block = /header @buchung \{([\s\S]*?)\}/.exec(caddy)?.[1] ?? '';
    expect(block).toMatch(/Referrer-Policy no-referrer/);
    const pp = /Permissions-Policy "([^"]+)"/.exec(block)?.[1];
    expect(pp).toBe('camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    expect(nextKonfig).toContain(`{ key: 'Permissions-Policy', value: '${pp}' }`);
    expect(nextKonfig).toContain("{ key: 'Referrer-Policy', value: 'no-referrer' }");
  });
});
