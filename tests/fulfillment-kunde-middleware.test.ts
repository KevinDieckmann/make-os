// ─── Fulfillment C2 — Wächter des öffentlichen Wegs: Middleware, Köpfe, Caddy (10.10.; FULFILLMENT_KONZEPT.md 5.4, 9, 12.3) ──────────────────────
// Ohne Sitzung offen sind NUR die vier Formen des Kunden-Links mit genau ihren Methoden (Seite + API-Wurzel GET, formular/upload/puls POST); die Wege
// handeln nie als jemand (Personen-Köpfe gelöscht — auch mit gültiger Sitzung), fremder Origin → 401. Die Antworten tragen die strengen Köpfe der
// Buchung (no-referrer, noindex, no-store, keine Kamera/Mikrofon, CSP ohne fremde Quellen in Produktion) — in der App (next.config.mjs) UND im Vorbau
// (deploy/caddy/Caddyfile, Block `@kunde`). Ergänzt tests/fulfillment-fundament-middleware.test.ts (C0).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';

process.env.MAKE_OS_KEY = 'pruef-schluessel-kunde-middleware';
let middleware: typeof import('@/middleware').middleware;
beforeAll(async () => { ({ middleware } = await import('@/middleware')); });

const LINK = 'kl-0123456789abcdef01234567';
const offen = (r: Response) => r.headers.get('x-middleware-next') === '1';
const eigen = { origin: 'http://localhost:3001', host: 'localhost:3001' };
const lauf = (pfad: string, init: { method?: string; headers?: Record<string, string> } = {}) => middleware(new NextRequest(`http://localhost:3001${pfad}`, init as never));

describe('Middleware: genau vier offene Formen', () => {
  it('jede Methode außer der erlaubten bleibt zu — auch HEAD/PUT/DELETE auf die Schnittstellen', async () => {
    const faelle: [string, string, boolean][] = [];
    for (const m of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      faelle.push([`/kunde/${LINK}`, m, m === 'GET' || m === 'HEAD']);
      faelle.push([`/api/kunde/${LINK}`, m, m === 'GET' || m === 'HEAD']);
      for (const w of ['formular', 'upload', 'puls']) faelle.push([`/api/kunde/${LINK}/${w}`, m, m === 'POST']);
    }
    for (const [p, m, soll] of faelle) {
      const r = await lauf(p, { method: m, headers: m === 'GET' || m === 'HEAD' ? {} : eigen });
      expect(offen(r), `${m} ${p}`).toBe(soll);
    }
  });

  it('Kennung genau kl-<24 hex, kleingeschrieben; keine Abwandlungen, keine Pfade dahinter oder davor', async () => {
    for (const p of [
      '/kunde/kl-0123456789abcdef0123456', '/kunde/kl-0123456789abcdef012345678', '/kunde/KL-0123456789abcdef01234567', '/kunde/kl-0123456789ABCDEF01234567',
      '/kunde/kl-0123456789abcdef0123456g', `/kunde/${LINK}/`, `/kunde/${LINK}/formular`, `/kunde/${LINK}%2f..`, `/x/kunde/${LINK}`, `/os/kunde/${LINK}`,
      `/api/kunde/${LINK}/formular/`, `/api/kunde/${LINK}/status`, `/api/kunde/${LINK}/../../fulfillment`, '/api/kunde/kl-0123456789abcdef01234567x',
    ]) {
      const get = await lauf(p);
      const post = await lauf(p, { method: 'POST', headers: eigen });
      expect(offen(get), `GET ${p}`).toBe(false);
      expect(offen(post), `POST ${p}`).toBe(false);
    }
  });

  it('die offenen Wege handeln nie als jemand — Personen-Köpfe fallen auch mit Dienstschlüssel-Versuch weg; fremder Origin 401', async () => {
    for (const p of [`/api/kunde/${LINK}`, `/kunde/${LINK}`]) {
      const r = await lauf(p, { headers: { 'x-make-user': 'pia', 'x-make-person': 'pia' } });
      expect(offen(r)).toBe(true);
      expect(r.headers.get('x-middleware-request-x-make-user')).toBeNull();
      expect(r.headers.get('x-middleware-request-x-make-person')).toBeNull();
    }
    const post = await lauf(`/api/kunde/${LINK}/puls`, { method: 'POST', headers: { ...eigen, 'x-make-user': 'pia' } });
    expect(offen(post)).toBe(true);
    expect(post.headers.get('x-middleware-request-x-make-user')).toBeNull();
    for (const w of ['formular', 'upload', 'puls']) expect((await lauf(`/api/kunde/${LINK}/${w}`, { method: 'POST', headers: { origin: 'https://fremd.example.invalid' } })).status, w).toBe(401);
  });

  it('die internen Wege bleiben hinter der Anmeldung', async () => {
    for (const p of ['/api/fulfillment/kunde', '/api/fulfillment/kunde/datei', '/api/fulfillment/kunde/vorschau']) {
      const r = await lauf(p);
      expect(offen(r), p).toBe(false);
      expect(r.status, p).toBe(401);
    }
  });
});

describe('Köpfe: App (next.config.mjs) und Vorbau (Caddy) — dieselben strengen Werte wie die Buchung', () => {
  const nextKonfig = readFileSync('next.config.mjs', 'utf8');
  const caddy = readFileSync('deploy/caddy/Caddyfile', 'utf8').split('\n').filter(z => !z.trim().startsWith('#')).join('\n');
  it('next.config.mjs: /kunde und /api/kunde bekommen die strenge Richtlinie', () => {
    expect(nextKonfig).toContain("{ source: '/kunde/:pfad*', headers: buchung }");
    expect(nextKonfig).toContain("{ source: '/api/kunde/:pfad*', headers: buchung }");
    expect(nextKonfig).toContain("{ key: 'Referrer-Policy', value: 'no-referrer' }");
    expect(nextKonfig).toMatch(/X-Robots-Tag', value: 'noindex, nofollow'/);
  });
  it('Caddyfile: Block @kunde mit no-referrer, Permissions-Policy wie die App, noindex, no-store — keine CSP (die setzt die App)', () => {
    expect(caddy).toMatch(/^\s*@kunde path \/kunde \/kunde\/\* \/api\/kunde \/api\/kunde\/\*$/m);
    const block = /header @kunde \{([\s\S]*?)\}/.exec(caddy)?.[1] ?? '';
    expect(block).toMatch(/Referrer-Policy no-referrer/);
    const pp = /Permissions-Policy "([^"]+)"/.exec(block)?.[1];
    expect(pp).toBe('camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    expect(nextKonfig).toContain(`{ key: 'Permissions-Policy', value: '${pp}' }`);
    expect(block).toMatch(/X-Robots-Tag "noindex, nofollow"/);
    expect(block).toMatch(/Cache-Control no-store/);
    expect(block).not.toMatch(/Content-Security-Policy/);
  });
});
