// ─── K4 (29.09.): Middleware — ohne Sitzung offen sind NUR die Buchungsadressen ─
// /buchen/<slug>, /buchen/<slug>/status, /api/buchung/<slug>, /api/buchung/<slug>/status — mit einer Adresse der Form
// „<vorsatz>-<24 hex>“. Alles andere bleibt zu (Seiten → /anmelden, Schnittstellen → 401), und die offenen Wege
// handeln nie als jemand (x-make-user/-person werden gelöscht).
import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

process.env.MAKE_OS_KEY = 'pruef-schluessel-k4-middleware';
let middleware: typeof import('@/middleware').middleware;
beforeAll(async () => { ({ middleware } = await import('@/middleware')); });

const SLUG = 'erstgesprach-0123456789abcdef01234567';
const offen = (r: Response) => r.headers.get('x-middleware-next') === '1';
const lauf = (pfad: string, init: { method?: string; headers?: Record<string, string> } = {}) => middleware(new NextRequest(`http://localhost:3001${pfad}`, init as never));

describe('Middleware: öffentliche Buchung', () => {
  it('Buchungsseite, Status-Seite und ihre zwei Schnittstellen sind ohne Sitzung offen', async () => {
    for (const p of [`/buchen/${SLUG}`, `/buchen/${SLUG}/status`, `/api/buchung/${SLUG}`, `/api/buchung/${SLUG}/status`]) expect(offen(await lauf(p)), p).toBe(true);
    expect(offen(await lauf(`/api/buchung/${SLUG}`, { method: 'POST', headers: { origin: 'http://localhost:3001', host: 'localhost:3001' } }))).toBe(true);
  });

  it('alles andere bleibt zu — auch Nachbarn, tiefere Pfade und fremde Formen', async () => {
    const zu = ['/buchen', `/buchen/${SLUG}/status/x`, `/buchen/${SLUG}/andere`, '/buchen/kurz', '/api/buchung', `/api/buchung/${SLUG}/admin`, '/api/kalender/buchung', '/api/kalender/frei', '/os/kalender', '/api/state/tasks', `/buchen/${SLUG.toUpperCase()}`, `/api/buchungen/${SLUG}`];
    for (const p of zu) {
      const r = await lauf(p);
      expect(offen(r), p).toBe(false);
      expect([401, 307], p).toContain(r.status);
    }
  });

  it('fremder Origin beim Buchen → 401 (CSRF); Köpfe einer Person werden nie durchgereicht', async () => {
    expect((await lauf(`/api/buchung/${SLUG}`, { method: 'POST', headers: { origin: 'https://fremd.example.invalid' } })).status).toBe(401);
    const r = await lauf(`/api/buchung/${SLUG}`, { headers: { 'x-make-user': 'kevin', 'x-make-person': 'kevin' } });
    expect(offen(r)).toBe(true);
    // Die weitergereichten Anfrage-Köpfe stehen als x-middleware-request-* in der Antwort.
    expect(r.headers.get('x-middleware-request-x-make-user')).toBeNull();
    expect(r.headers.get('x-middleware-request-x-make-person')).toBeNull();
  });
});
