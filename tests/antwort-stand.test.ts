// Große JSON-Antworten (25.09., Ladegeschwindigkeit): gepackt ab 16 KB, 304 bei gleichem Stand.
import { describe, it, expect } from 'vitest';
import { gunzipSync } from 'node:zlib';
import { jsonAntwort, unveraendert, etagAus } from '../lib/http/json-antwort';

const anfrage = (kopf: Record<string, string> = {}) => new Request('http://localhost/api/x', { headers: kopf });
const gross = { kontakte: Array.from({ length: 400 }, (_, i) => ({ id: `c-${i}`, name: `Person ${i}`, text: 'x'.repeat(40) })) };

describe('jsonAntwort', () => {
  it('packt große Antworten, wenn der Browser gzip annimmt — und liefert denselben Inhalt', async () => {
    const r = jsonAntwort(anfrage({ 'accept-encoding': 'gzip, deflate, br' }), gross, etagAus('k', 'abc', 'kevin'));
    expect(r.headers.get('content-encoding')).toBe('gzip');
    expect(r.headers.get('etag')).toBe('"k|abc|kevin"');
    const text = gunzipSync(Buffer.from(await r.arrayBuffer())).toString('utf8');
    expect(JSON.parse(text).kontakte).toHaveLength(400);
  });
  it('kleine Antworten und Browser ohne gzip bekommen Klartext', async () => {
    expect(jsonAntwort(anfrage({ 'accept-encoding': 'gzip' }), { ok: true }).headers.get('content-encoding')).toBeNull();
    const r = jsonAntwort(anfrage(), gross);
    expect(r.headers.get('content-encoding')).toBeNull();
    expect((await r.json()).kontakte).toHaveLength(400);
  });
});

describe('unveraendert', () => {
  it('304 nur bei genau diesem Stand', () => {
    const etag = etagAus('b', '1a.2b', '2026-09-25', 'kevin');
    expect(unveraendert(anfrage({ 'if-none-match': etag }), etag)?.status).toBe(304);
    expect(unveraendert(anfrage({ 'if-none-match': etagAus('b', '1a.2b', '2026-09-25', 'malin') }), etag)).toBeNull();
    expect(unveraendert(anfrage(), etag)).toBeNull();
  });
});
