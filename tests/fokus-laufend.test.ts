// ─── Laufender Fokus: der Server hält den Start fest (29.09.) ───────────────
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { laufendSaeubern, laufendAbgleich } from '@/lib/zeitmessung/fokus-regeln';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fokus-laufend-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
const J = Date.parse('2026-09-29T10:00:00.000Z');

describe('Regeln', () => {
  it('säubert: Beginn + Schlüssel Pflicht, nicht in der Zukunft, nicht älter als 7 Tage, Zuordnung nur gültig', () => {
    expect(laufendSaeubern({ von: '2026-09-29T09:00:00.000Z', schluessel: 'business:crm', label: ' CRM ', aufgabeId: 'a-1', einheit: 'KD Ventures', mandatId: '<x>' }, J))
      .toEqual({ von: '2026-09-29T09:00:00.000Z', schluessel: 'business:crm', label: 'CRM', aufgabeId: 'a-1', einheit: 'KD Ventures' });
    expect(laufendSaeubern({ von: '2026-09-29T09:00:00.000Z', schluessel: 'quatsch' }, J)).toBeNull();
    expect(laufendSaeubern({ von: '2026-09-30T09:00:00.000Z', schluessel: 'privat:home' }, J)).toBeNull();
    expect(laufendSaeubern({ von: '2026-09-01T09:00:00.000Z', schluessel: 'privat:home' }, J)).toBeNull();
    expect(laufendSaeubern(null, J)).toBeNull();
  });
  it('Abgleich: Server gewinnt; kennt er keinen, lädt der Browser hoch', () => {
    const a = { von: '2026-09-29T09:00:00.000Z', schluessel: 'business:crm', label: 'CRM' };
    const b = { ...a, von: '2026-09-29T09:30:00.000Z' };
    expect(laufendAbgleich(a, null)).toEqual({ art: 'uebernehmen', laufend: a });
    expect(laufendAbgleich(a, b)).toEqual({ art: 'uebernehmen', laufend: a });
    expect(laufendAbgleich(a, a).art).toBe('nichts');
    expect(laufendAbgleich(null, b)).toEqual({ art: 'hochladen', laufend: b });
    expect(laufendAbgleich(null, null).art).toBe('nichts');
  });
});

describe('Route /api/state/fokus — Gerätewechsel verliert den Start nicht', () => {
  type H = (r: Request) => Promise<Response>;
  let route: { GET: H; POST: H };
  beforeAll(async () => { route = (await import('@/app/api/state/fokus/route')) as unknown as typeof route; });
  afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });
  const req = (person: string | null, method = 'GET', body?: unknown) => new Request('http://test/api/state/fokus', { method, headers: { 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  it('setzen auf Gerät A, lesen auf Gerät B, beenden; je Person getrennt; ohne Person 401', async () => {
    const von = new Date(Date.now() - 10 * 60_000).toISOString();
    expect((await route.POST(req('kevin', 'POST', { laufend: { von, schluessel: 'business:crm', label: 'CRM' } }))).status).toBe(200);
    expect(((await (await route.GET(req('kevin'))).json()) as { laufend: { von: string } }).laufend.von).toBe(von);
    expect(((await (await route.GET(req('malin'))).json()) as { laufend: unknown }).laufend).toBeNull();
    expect((await route.GET(req(null))).status).toBe(401);
    expect((await route.POST(req('kevin', 'POST', { laufend: { von: 'kaputt' } }))).status).toBe(400);
    expect(((await (await route.GET(req('kevin'))).json()) as { laufend: { von: string } }).laufend.von).toBe(von);
    expect((await route.POST(req('kevin', 'POST', { laufend: null }))).status).toBe(200);
    expect(((await (await route.GET(req('kevin'))).json()) as { laufend: unknown }).laufend).toBeNull();
  });
});
