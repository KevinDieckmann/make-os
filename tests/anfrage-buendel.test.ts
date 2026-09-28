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

  // Prüfbericht 28.09.: leeren() räumte nur `frisch` — ein GET, der VOR dem Speichern losging, landete danach
  // noch in `frisch`, und neue GETs hängten sich an ihn an. Wer direkt nach dem Speichern las, sah den alten Stand.
  function steuerbarerFetch() {
    const offen: { url: string; methode: string; fertig: (inhalt: unknown) => void }[] = [];
    const f = ((input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>(resolve => {
      offen.push({ url: String(input), methode: (init?.method ?? 'GET').toUpperCase(), fertig: inhalt => resolve(new Response(JSON.stringify(inhalt), { status: 200 })) });
    })) as typeof fetch;
    return { f, offen };
  }
  const warte = () => new Promise(r => setTimeout(r, 0));

  it('ein GET, der vor dem Schreiben begann, wird nicht geteilt — weder angehängt noch frisch gehalten', async () => {
    const { f, offen } = steuerbarerFetch();
    const b = buendelnderFetch(f, 'http://x');
    const alt = b('/api/state/ziele');                       // 1. GET läuft (alter Stand)
    await warte();
    const schreiben = b('/api/state/ziele', { method: 'PATCH', body: '{}' });
    await warte();
    offen[1].fertig({ ok: true });                            // Schreiben fertig
    await schreiben;
    const neu = b('/api/state/ziele');                        // 2. GET nach dem Schreiben: eigene Anfrage, nicht an den alten gehängt
    const neuNoStore = b('/api/state/ziele', { cache: 'no-store' });
    await warte();
    expect(offen.filter(o => o.methode === 'GET').length).toBe(2);
    offen[0].fertig({ stand: 'alt' });
    offen[2].fertig({ stand: 'neu' });
    expect(await (await alt).json()).toEqual({ stand: 'alt' });
    expect(await (await neu).json()).toEqual({ stand: 'neu' });
    expect(await (await neuNoStore).json()).toEqual({ stand: 'neu' });
    // Der alte landet nicht in `frisch`: das nächste Lesen bekommt den neuen (aus frisch) oder fragt neu — nie den alten.
    const danach = b('/api/state/ziele');
    await warte();
    if (offen.length > 3) offen[3].fertig({ stand: 'neu' });
    expect(await (await danach).json()).toEqual({ stand: 'neu' });
  });

  it('ein GET, der WÄHREND des Schreibens beginnt, wird nach dem Schreiben nicht frisch gehalten', async () => {
    const { f, offen } = steuerbarerFetch();
    const b = buendelnderFetch(f, 'http://x');
    const schreiben = b('/api/state/routinen', { method: 'PUT', body: '{}' });
    await warte();
    const mitten = b('/api/state/routinen');
    await warte();
    offen[1].fertig({ stand: 'mitten' });
    await mitten;
    offen[0].fertig({ ok: true });
    await schreiben;
    const danach = b('/api/state/routinen');
    await warte();
    expect(offen.length).toBe(3);                             // neu gefragt, nicht aus frisch
    offen[2].fertig({ stand: 'neu' });
    expect(await (await danach).json()).toEqual({ stand: 'neu' });
  });

  it('auch schreibende Request-Objekte zählen als Schreiben', async () => {
    const { f, offen } = steuerbarerFetch();
    const b = buendelnderFetch(f, 'http://x');
    const erst = b('/api/x'); await warte(); offen[0].fertig({ n: 1 }); await erst;
    const w = b(new Request('http://x/api/x', { method: 'DELETE' })); await warte(); offen[1].fertig({ ok: true }); await w;
    const zweit = b('/api/x'); await warte();
    expect(offen.length).toBe(3);
    offen[2].fertig({ n: 2 });
    expect(await (await zweit).json()).toEqual({ n: 2 });
  });
});
