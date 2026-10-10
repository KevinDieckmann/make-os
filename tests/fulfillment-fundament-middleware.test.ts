// ─── Fulfillment C0 (10.10.): Middleware — ohne Sitzung offen sind NUR die vier Formen des Kunden-Links ─────────────────────────────────
// `/kunde/kl-<24 hex>` (nur GET), `/api/kunde/kl-<24 hex>` (nur GET), `/api/kunde/kl-<24 hex>/{formular,upload,puls}` (nur POST). Alles andere bleibt zu
// (Seiten → /anmelden, Schnittstellen → 401), die offenen Wege handeln nie als jemand (x-make-user/-person gelöscht), fremder Origin → 401.
// Die volle Prüfung des Kunden-Links (gleiche 404, Token, Drossel) gehört Paket C2 (tests/fulfillment-kunde-middleware.test.ts).
import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

process.env.MAKE_OS_KEY = 'pruef-schluessel-fulfillment-middleware';
let middleware: typeof import('@/middleware').middleware;
beforeAll(async () => { ({ middleware } = await import('@/middleware')); });

const LINK = 'kl-0123456789abcdef01234567';
const offen = (r: Response) => r.headers.get('x-middleware-next') === '1';
const eigen = { origin: 'http://localhost:3001', host: 'localhost:3001' };
const lauf = (pfad: string, init: { method?: string; headers?: Record<string, string> } = {}) => middleware(new NextRequest(`http://localhost:3001${pfad}`, init as never));

describe('Middleware: Kunden-Link (öffentlich, kommt ausgeschaltet)', () => {
  it('Seite und API-Wurzel per GET, formular/upload/puls per POST sind ohne Sitzung offen', async () => {
    for (const p of [`/kunde/${LINK}`, `/api/kunde/${LINK}`]) expect(offen(await lauf(p)), p).toBe(true);
    for (const t of ['formular', 'upload', 'puls']) expect(offen(await lauf(`/api/kunde/${LINK}/${t}`, { method: 'POST', headers: eigen })), t).toBe(true);
  });

  it('falsche Methode, fremde Formen, Nachbarn und tiefere Pfade bleiben zu', async () => {
    const zu: [string, string?][] = [
      [`/kunde/${LINK}`, 'POST'], [`/api/kunde/${LINK}`, 'POST'], [`/api/kunde/${LINK}/formular`], [`/api/kunde/${LINK}/puls`], [`/api/kunde/${LINK}/upload`],
      ['/kunde'], ['/kunde/kl-0123'], [`/kunde/${LINK}/x`], [`/kunde/${LINK.toUpperCase()}`], ['/api/kunde'], [`/api/kunde/${LINK}/admin`, 'POST'],
      [`/api/kunde/${LINK}/formular/x`, 'POST'], ['/api/fulfillment'], ['/api/fulfillment/kunde'], ['/os/mandate/fulfillment'],
    ];
    for (const [p, m] of zu) {
      const r = await lauf(p, { method: m ?? 'GET', headers: m && m !== 'GET' ? eigen : {} });
      expect(offen(r), `${m ?? 'GET'} ${p}`).toBe(false);
      expect([401, 307], `${m ?? 'GET'} ${p}`).toContain(r.status);
    }
  });

  it('fremder Origin → 401 (keine Ausnahme); Köpfe einer Person werden nie durchgereicht', async () => {
    expect((await lauf(`/api/kunde/${LINK}/formular`, { method: 'POST', headers: { origin: 'https://fremd.example.invalid' } })).status).toBe(401);
    const r = await lauf(`/api/kunde/${LINK}`, { headers: { 'x-make-user': 'pia', 'x-make-person': 'pia' } });
    expect(offen(r)).toBe(true);
    expect(r.headers.get('x-middleware-request-x-make-user')).toBeNull();
    expect(r.headers.get('x-middleware-request-x-make-person')).toBeNull();
  });

  it('Sicht Privat: die Fulfillment-Schnittstellen antworten 403, bevor die Route läuft', async () => {
    for (const p of ['/api/fulfillment?space=privat', '/api/fulfillment/fall?space=privat', '/api/fulfillment/personen?space=privat']) {
      const r = await lauf(p);
      expect(r.status, p).toBe(403);
      expect((await r.json()).andererBereich).toBe(true);
    }
  });
});
