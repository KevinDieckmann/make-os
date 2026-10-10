// ─── Fulfillment C1 — Demo-Saat (10.10.; FULFILLMENT_KONZEPT.md 12.7) ─────────────────────────────────────────────────────────────────
// Die Demo zeigt einen laufenden Fall mit Landkarte, Wert-Konto (drei Messungen) und Ritualen, einen Fall im Onboarding mit überfälliger
// Willkommensmail, rund 25 Bausteine (zwei „rechtlich prüfen“, einer „nur intern“) und drei Abläufe (Trichter, Fluss, Zeitachse) — über die
// Routen gesät, erfunden. Eigener Datenordner (vi.hoisted), wie tests/demo.test.ts.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const { wurzel } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: p } = await import('node:path');
  const wurzel = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-demo-ff-'));
  const ordner = p.join(wurzel, 'daten');
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: ordner, MAKE_VAULT_DIR: p.join(ordner, 'wissen'), MAKE_OS_KEY: 'pruef-schluessel-demo-ff', MAKE_OS_OHNE_APPLE: '1',
    MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_EMBEDDINGS: 'aus', MAKE_OS_INTERN: 'http://localhost:3999',
  });
  delete process.env.MAKE_OS_DATENSCHLUESSEL; delete process.env.MAKE_OS_DEMO;
  for (const k of ['ICLOUD_APPLE_ID', 'ICLOUD_APP_PASSWORT', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'TELEGRAM_BOT_TOKEN', 'WHOOP_CLIENT_ID', 'MS_CLIENT_ID', 'ANTHROPIC_API_KEY']) delete process.env[k];
  return { wurzel };
});

import { localDay } from '@/lib/zeit';

type H = (r: Request) => Promise<Response>;
const lese = async (pfad: string, suche = '') => {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, H>;
  return await (await m.GET(new Request(`http://test/api/${pfad}${suche}`, { headers: { 'x-make-user': 'lena' } }))).json() as Record<string, unknown>;
};

let schritte: Record<string, number> = {};
beforeAll(async () => {
  const server = await import('@/lib/demo/server');
  const b = await server.demoSaenInLeerenOrdner({ passwort: 'pruef-passwort-demo', heute: localDay() });
  schritte = Object.fromEntries(b.schritte.map(s => [s.name, s.anzahl]));
}, 120_000);
afterAll(() => { rmSync(wurzel, { recursive: true, force: true }); });

describe('Demo: Fulfillment', () => {
  it('Muster, Bausteine, Abläufe, zwei Fälle', async () => {
    expect(schritte['Fulfillment: Vorlagen aus dem Muster']).toBe(3);
    expect(schritte['Fulfillment: Bausteine']).toBeGreaterThanOrEqual(25);
    expect(schritte['Fulfillment: Abläufe']).toBe(3);
    expect(schritte['Fulfillment: Fälle']).toBe(2);
    const ue = await lese('fulfillment');
    const prozesse = ue.prozesse as { art: string; form?: string }[];
    expect(prozesse.filter(p => p.art === 'ablauf').map(p => p.form).sort()).toEqual(['fluss', 'trichter', 'zeitachse']);
    const bausteine = ue.bausteine as { rechtOffen: boolean; nurIntern: boolean; vorVerkaufOffen: boolean }[];
    expect(bausteine.filter(b => b.rechtOffen)).toHaveLength(2);
    expect(bausteine.filter(b => b.nurIntern)).toHaveLength(1);
    expect(bausteine.filter(b => b.vorVerkaufOffen)).toHaveLength(1);
    expect(Object.keys(ue.zuordnung as object).sort()).toEqual(['l-demo-retainer', 'l-demo-software']);
  });

  it('Nordwerk läuft: Onboarding fertig, Wert-Konto mit drei Messungen, Ritual, Stakeholder, Entscheidungen', async () => {
    const f = await lese('fulfillment/fall', '?m=m-demo-nordwerk');
    const fall = f.fall as { status: string; stakeholder: unknown[]; entscheidungen: unknown[]; rituale: unknown[]; mitschriften: unknown[]; wertKonto: Record<string, { messungen: unknown[] }> };
    const offen = (f.onboarding as { schritte: { schluessel: string; zaehlt: boolean; erfuellt: boolean; entfaellt: boolean; text: string }[] }).schritte.filter(s => s.zaehlt && !s.erfuellt && !s.entfaellt);
    expect(offen.map(s => `${s.schluessel}: ${s.text}`)).toEqual([]);
    expect(fall.status).toBe('laeuft');
    expect(Object.values(fall.wertKonto).some(e => e.messungen.length === 3)).toBe(true);
    expect(fall.stakeholder).toHaveLength(1);
    expect(fall.entscheidungen).toHaveLength(2);
    expect(fall.rituale).toHaveLength(1);
    expect(fall.mitschriften).toHaveLength(1);
    expect(f.fortschritt as number).toBeGreaterThan(0);
  });

  it('Lumen im Onboarding: Willkommensmail überfällig, im Cockpit rot oben', async () => {
    const f = await lese('fulfillment/fall', '?m=m-demo-lumen');
    expect((f.fall as { status: string }).status).toBe('onboarding');
    expect((f.onboarding as { willkommen: { ueberfaellig: boolean } }).willkommen.ueberfaellig).toBe(true);
    const c = await lese('fulfillment/cockpit');
    expect((c.haengt as { art: string; mandatId: string }[])[0]).toMatchObject({ art: 'willkommen', mandatId: 'm-demo-lumen' });
  });
});
