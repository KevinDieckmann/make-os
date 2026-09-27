import { describe, it, expect } from 'vitest';
import { buendelnderFetch } from '@/lib/http/anfrage-buendel';

function fakeFetch() {
  const aufrufe: { url: string; methode: string }[] = [];
  let n = 0;
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);
    aufrufe.push({ url, methode: (init?.method ?? 'GET').toUpperCase() });
    n++;
    await new Promise(r => setTimeout(r, 5));
    return new Response(JSON.stringify({ n }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { f, aufrufe };
}

describe('Anfrage-Bündler', () => {
  it('teilt gleichzeitige GETs an dieselbe Adresse — eine Anfrage, drei eigene Antworten', async () => {
    const { f, aufrufe } = fakeFetch();
    const b = buendelnderFetch(f, 'http://x');
    const [a, c, d] = await Promise.all([b('/api/state/tasks'), b('/api/state/tasks'), b('/api/state/tasks')]);
    expect(aufrufe.length).toBe(1);
    expect(await a.json()).toEqual({ n: 1 }); expect(await c.json()).toEqual({ n: 1 }); expect(await d.json()).toEqual({ n: 1 });
  });
  it('hält eine fertige Antwort kurz frisch; no-store bündelt nur Laufendes', async () => {
    let t = 0; const { f, aufrufe } = fakeFetch();
    const b = buendelnderFetch(f, 'http://x', { frischMs: 8000, jetzt: () => t });
    await b('/api/konto/ich'); await b('/api/konto/ich');
    expect(aufrufe.length).toBe(1);
    t = 9000; await b('/api/konto/ich');
    expect(aufrufe.length).toBe(2);
    await b('/api/konto/ich', { cache: 'no-store' });
    expect(aufrufe.length).toBe(3);
  });
  it('ein schreibender Aufruf leert den Zwischenspeicher', async () => {
    const { f, aufrufe } = fakeFetch();
    const b = buendelnderFetch(f, 'http://x');
    await b('/api/state/tasks'); await b('/api/state/tasks', { method: 'PATCH', body: '{}' }); await b('/api/state/tasks');
    expect(aufrufe.map(a => a.methode)).toEqual(['GET', 'PATCH', 'GET']);
  });
  it('lässt Fremdes, Signale und Ausnahmen unverändert durch', async () => {
    const { f, aufrufe } = fakeFetch();
    const b = buendelnderFetch(f, 'http://x', { ausnahmen: ['/api/zoe/chat'] });
    const ac = new AbortController();
    await Promise.all([b('https://fremd.example/api/x'), b('https://fremd.example/api/x'), b('/api/zoe/chat'), b('/api/zoe/chat'), b('/api/state/tasks', { signal: ac.signal }), b('/api/state/tasks', { signal: ac.signal })]);
    expect(aufrufe.length).toBe(6);
  });
  it('unterscheidet Anfragen mit verschiedenem If-None-Match', async () => {
    const { f, aufrufe } = fakeFetch();
    const b = buendelnderFetch(f, 'http://x');
    await Promise.all([b('/api/state/kontakte', { headers: { 'If-None-Match': 'a' } }), b('/api/state/kontakte', { headers: { 'If-None-Match': 'b' } }), b('/api/state/kontakte')]);
    expect(aufrufe.length).toBe(3);
  });
  it('teilt Fehlerantworten nicht weiter', async () => {
    let n = 0; const f = (async () => { n++; return new Response('nein', { status: 500 }); }) as typeof fetch;
    const b = buendelnderFetch(f, 'http://x');
    await b('/api/x'); await b('/api/x');
    expect(n).toBe(2);
  });
});
