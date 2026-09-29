// ─── Build-Kennung: alte Tabs schreiben nicht mehr mit altem Code (29.09., A2) ─
import { describe, it, expect, vi, afterEach } from 'vitest';
import { bauHuelle, bauKennung, istNeuLaden, BAU_KOPF, NEU_LADEN_HINWEIS } from '@/lib/bau/kennung';
import { bauFremd, bauPruefen } from '@/lib/bau/pruefen';

afterEach(() => { vi.unstubAllEnvs(); });

describe('Fetch-Hülle im Browser', () => {
  const ursprung = 'https://make.test';
  const mitSchreiber = () => {
    const gesehen: { url: string; methode: string; bau: string | null }[] = [];
    const original = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      gesehen.push({ url, methode: init?.method ?? 'GET', bau: new Headers(init?.headers).get(BAU_KOPF) });
      return url.includes('alt') ? new Response(JSON.stringify({ ok: false, neuLaden: true }), { status: 409 }) : new Response('{}', { status: 200 });
    }) as typeof fetch;
    return { gesehen, original };
  };
  it('Schreibende Anfragen an /api bekommen die Kennung (bestehende Köpfe bleiben); GET und fremde Ursprünge nicht', async () => {
    const { gesehen, original } = mitSchreiber();
    const f = bauHuelle(original, ursprung, 'bau-1', () => {});
    await f('/api/state/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' } });
    await f('/api/state/tasks');
    await f('https://anders.test/api/x', { method: 'POST' });
    await f('/os/aufgaben', { method: 'POST' });
    expect(gesehen.map(g => g.bau)).toEqual(['bau-1', null, null, null]);
  });
  it('409 { neuLaden } meldet sich (einmal je Antwort); die Antwort bleibt lesbar', async () => {
    const { original } = mitSchreiber();
    const melden = vi.fn();
    const f = bauHuelle(original, ursprung, 'bau-1', melden);
    const r = await f('/api/alt', { method: 'POST' });
    expect(((await r.json()) as { neuLaden: boolean }).neuLaden).toBe(true);
    await new Promise(res => setTimeout(res, 0));
    expect(melden).toHaveBeenCalledTimes(1);
    expect(istNeuLaden(409, { neuLaden: true })).toBe(true);
    expect(istNeuLaden(409, { konflikte: [] })).toBe(false);
  });
});

describe('Server-Prüfung', () => {
  const req = (kopf: Record<string, string>) => new Request('http://test/api/state/tasks', { method: 'PATCH', headers: kopf });
  it('Ohne eigene Kennung (Tests, Werkzeuge) keine Prüfung', () => {
    vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
    expect(bauKennung()).toBeNull();
    expect(bauFremd(req({}))).toBe(false);
  });
  it('Fremd oder fehlend → 409 neuLaden; passend und Dienstweg gehen', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', 'bau-2');
    vi.stubEnv('MAKE_OS_KEY', 'dienst-schluessel');
    expect(bauFremd(req({}))).toBe(true);
    expect(bauFremd(req({ [BAU_KOPF]: 'bau-1' }))).toBe(true);
    expect(bauFremd(req({ [BAU_KOPF]: 'bau-2' }))).toBe(false);
    expect(bauFremd(req({ 'x-make-key': 'dienst-schluessel' }))).toBe(false);
    const r = bauPruefen(req({ [BAU_KOPF]: 'bau-1' }))!;
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ ok: false, neuLaden: true });
  });
  it('Meldung an alte Tabs verspricht nichts (Go-Live 29.09.): nicht gespeichert, bitte neu eingeben', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', 'bau-2');
    const d = await bauPruefen(req({ [BAU_KOPF]: 'bau-1' }))!.json() as { error: string; fehler: string };
    expect(d.error).toBe('MAKE OS wurde gerade aktualisiert. Bitte die Seite neu laden. Die letzte Eingabe wurde nicht gespeichert — bitte danach noch einmal eingeben.');
    expect(d.fehler).toBe(d.error);
    expect(d.error).not.toMatch(/gemerkt|bleiben/);
    expect(NEU_LADEN_HINWEIS).toMatch(/Aufgaben-Änderungen bleiben in diesem Tab gemerkt/);
    expect(NEU_LADEN_HINWEIS).toMatch(/CRM/);
  });
});
