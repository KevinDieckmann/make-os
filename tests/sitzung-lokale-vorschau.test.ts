// ─── Lokale Vorschau (Safari, http://localhost): nur dort ohne __Host-/secure — auf dem Server wirkungslos (11.10.) ─────────────
import { describe, it, expect, afterEach, vi } from 'vitest';

const merken = { ...process.env };
afterEach(() => { process.env = { ...merken }; vi.resetModules(); });

async function name(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  const m = await import('@/lib/zugang/sitzung');
  return { cookie: m.SITZUNG_COOKIE, lokal: m.lokaleVorschau() };
}

describe('lokale Vorschau', () => {
  it('Server (production + https): immer __Host-, auch mit gesetzter Variable', async () => {
    const r = await name({ NODE_ENV: 'production', MAKE_OS_ADRESSE: 'https://beispiel.example', MAKE_OS_LOKALE_VORSCHAU: '1' });
    expect(r).toEqual({ cookie: '__Host-make-os-sitzung', lokal: false });
  });
  it('production + http://localhost ohne Variable: __Host- wie bisher', async () => {
    const r = await name({ NODE_ENV: 'production', MAKE_OS_ADRESSE: 'http://localhost:3204', MAKE_OS_LOKALE_VORSCHAU: undefined });
    expect(r.cookie).toBe('__Host-make-os-sitzung');
  });
  it('production + http://localhost + Variable: Entwicklungs-Name', async () => {
    const r = await name({ NODE_ENV: 'production', MAKE_OS_ADRESSE: 'http://localhost:3204', MAKE_OS_LOKALE_VORSCHAU: '1' });
    expect(r).toEqual({ cookie: 'make-os-sitzung', lokal: true });
  });
  it('fremder http-Host zählt nicht als lokal', async () => {
    const r = await name({ NODE_ENV: 'production', MAKE_OS_ADRESSE: 'http://10.0.0.5:3000', MAKE_OS_LOKALE_VORSCHAU: '1' });
    expect(r.lokal).toBe(false);
  });
});

describe('Geräte-Cookie (16.10., Gerät merken): dieselbe Namensregel wie die Sitzung', () => {
  async function geraet(env: Record<string, string | undefined>) {
    vi.resetModules();
    for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    const m = await import('@/lib/zugang/sitzung');
    return { cookie: m.GERAET_COOKIE, sicher: m.cookieNurHttps() };
  }
  it('Server: __Host- und secure', async () => {
    expect(await geraet({ NODE_ENV: 'production', MAKE_OS_ADRESSE: 'https://beispiel.example', MAKE_OS_LOKALE_VORSCHAU: '1' })).toEqual({ cookie: '__Host-make-os-geraet', sicher: true });
  });
  it('lokale Vorschau: ohne __Host-, ohne secure', async () => {
    expect(await geraet({ NODE_ENV: 'production', MAKE_OS_ADRESSE: 'http://localhost:3204', MAKE_OS_LOKALE_VORSCHAU: '1' })).toEqual({ cookie: 'make-os-geraet', sicher: false });
  });
});
