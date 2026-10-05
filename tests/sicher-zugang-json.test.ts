// ─── Zugang & Schlüssel härten, Punkt 8 (05.10.): JSON-Körper mit Größengrenze ─────────────────────────────
// `jsonBegrenzt(req, n)` ersetzt `req.json()` in allen Routen: über der Grenze → 413 (auch ohne Content-Length, dann
// wird nur bis zur Grenze gelesen), kaputter Körper → wie bisher 400. Wächter: keine Route liest mehr `req.json()`.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { jsonBegrenzt, jsonZuGross, AnfrageZuGross, JSON_GRENZE, JSON_GROSS } from '@/lib/zugang/json-grenze';

const post = (body: BodyInit, kopf: Record<string, string> = {}) => new Request('http://test/api/x', { method: 'POST', headers: { 'content-type': 'application/json', ...kopf }, body, duplex: 'half' } as RequestInit);
const strom = (teile: number, groesse: number) => new ReadableStream<Uint8Array>({
  start(c) { for (let i = 0; i < teile; i++) c.enqueue(new Uint8Array(groesse).fill(0x20)); c.close(); },
});

describe('jsonBegrenzt', () => {
  it('liest JSON wie req.json()', async () => {
    expect(await jsonBegrenzt(post(JSON.stringify({ a: 1, b: 'ä' })))).toEqual({ a: 1, b: 'ä' });
    expect(JSON_GRENZE).toBe(1_000_000);
    expect(JSON_GROSS).toBe(20 * 1024 * 1024);
  });
  it('Content-Length über der Grenze → AnfrageZuGross, ohne zu lesen', async () => {
    await expect(jsonBegrenzt(post('{}', { 'content-length': '2000001' }), 2_000_000)).rejects.toBeInstanceOf(AnfrageZuGross);
  });
  it('ohne Content-Length (Strom): bricht an der Grenze ab', async () => {
    await expect(jsonBegrenzt(post(strom(20, 100_000)))).rejects.toBeInstanceOf(AnfrageZuGross);
    await expect(jsonBegrenzt(post(strom(5, 100)), 1000)).rejects.toBeInstanceOf(SyntaxError);
  });
  it('leer oder kaputt → SyntaxError (die 400 der Route), nie 413', async () => {
    await expect(jsonBegrenzt(new Request('http://test', { method: 'POST' }))).rejects.toBeInstanceOf(SyntaxError);
    await expect(jsonBegrenzt(post('{kaputt'))).rejects.toBeInstanceOf(SyntaxError);
  });
  it('jsonZuGross: 413 mit Satz für die Grenze, sonst null', async () => {
    const r = jsonZuGross(new AnfrageZuGross(1_000_000))!;
    expect(r.status).toBe(413);
    expect(await r.json()).toMatchObject({ ok: false, error: 'Anfrage zu groß (höchstens 1 MB).' });
    expect(jsonZuGross(new SyntaxError('x'))).toBeNull();
  });
});

describe('in den Routen', () => {
  it('eine kleine Route antwortet 413 auf einen zu großen Körper (Anmelden)', async () => {
    const { POST } = await import('@/app/api/konto/anmelden/route');
    const gross = JSON.stringify({ email: 'a@example.invalid', passwort: 'x'.repeat(1_200_000) });
    expect((await POST(post(gross))).status).toBe(413);
  });
  it('Wächter: keine Route unter app/api liest den Körper ungebremst mit req.json()', () => {
    const treffer: string[] = [];
    const lauf = (d: string) => { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) lauf(p); else if (/\.tsx?$/.test(n) && /\b(req|request)\.json\(\)/.test(readFileSync(p, 'utf8'))) treffer.push(p); } };
    lauf('app/api');
    expect(treffer).toEqual([]);
  });
});
