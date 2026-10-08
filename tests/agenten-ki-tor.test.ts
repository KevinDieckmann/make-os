// ─── Wächter: KI-Tor im Agenten-Bereich — nur die Kategorien des Heads, Business nie Gesundheit (09.10., Paket 1 „Kern“) ─────────
// Jeder Modellaufruf eines Heads/Mitarbeiters geht über `askText` mit `ki: { lauf, person, kategorien }` — die Kategorien sind die
// AKTIVEN des Heads (Schalter, Einwilligung). Werkzeuge = Schnittmenge (Katalog ∩ Schalter ∩ Einwilligung). Das Tor sperrt, was
// nicht erlaubt ist (kein Byte geht hinaus). Modell als Fake (kein Netz), `askText` wird mitgeschnitten und ECHT ausgeführt.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-ki-tor-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-agenten-ki-tor', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_MODEL;
  return o;
});

type KiAufruf = { zweck?: string; model?: string; system: string; ki?: { lauf?: string; person?: string | null; kategorien: string[] }; tools?: { name: string }[] };
const aufrufe = vi.hoisted(() => [] as KiAufruf[]);
vi.mock('@/lib/anthropic', async orig => {
  const o = await orig<typeof import('@/lib/anthropic')>();
  return { ...o, askText: async (opts: Parameters<typeof o.askText>[0]) => { aufrufe.push(opts as unknown as KiAufruf); return o.askText(opts); } };
});

import { headDef } from '@/lib/agenten/katalog';
import { HEAD_WERKZEUGE, MITARBEITER_WERKZEUGE } from '@/lib/agenten/typen';
import { HEAD_ZUSATZ, MITARBEITER_ZUSATZ } from '@/lib/agenten/werkzeuge';
import { MODEL_BY_TIER } from '@/lib/agent-config';
import { kontenSaeen, modellFake, rufe, sitzung, text, type ModellFake } from './fixtures/agenten-kern';

type H = (r: Request) => Promise<Response>;
let faden: { POST: H };
let m: ModellFake;
const AGENT_W = new Set<string>([...HEAD_WERKZEUGE, ...MITARBEITER_WERKZEUGE, ...MITARBEITER_ZUSATZ, ...HEAD_ZUSATZ]);

beforeAll(async () => {
  await kontenSaeen();
  const { gesundheitErklaeren, GESUNDHEIT_FASSUNG } = await import('@/lib/datenschutz/gesundheit-einwilligung');
  for (const z of ['verarbeiten', 'ki'] as const) expect((await gesundheitErklaeren('person-b', z, true, GESUNDHEIT_FASSUNG)).ok).toBe(true);
  faden = (await import('@/app/api/agenten/faden/route')) as unknown as typeof faden;
  m = modellFake();
});
afterAll(() => { m.zurueck(); rmSync(ordner, { recursive: true, force: true }); });

const senden = async (person: string, agent: Record<string, unknown>, t = 'Was steht an?') => {
  aufrufe.length = 0;
  m.antworten.push(text('Antwort.'));
  return rufe(faden.POST, '/api/agenten/faden', sitzung(person), { aktion: 'senden', agent, text: t });
};

describe('KI-Tor je Head', () => {
  it('Sales: Kategorien ⊆ die des Heads, nie Gesundheit; Werkzeuge ⊆ Katalog + Agenten-Werkzeuge; Lauf „gespraech“, Zweck agent-sales, Modell „ausgewogen“', async () => {
    const r = await senden('person-b', { art: 'head', headId: 'sales' });
    expect(r.status).toBe(200);
    const a = aufrufe.find(x => x.zweck === 'agent-sales')!;
    expect(a).toBeTruthy();
    const sales = headDef('sales')!;
    for (const k of a.ki!.kategorien) expect([...sales.kategorien, 'allgemein'], k).toContain(k);
    expect(a.ki!.kategorien).not.toContain('gesundheit');
    expect(a.ki!.person).toBe('person-b');
    expect(a.ki!.lauf).toBe('gespraech');
    expect(a.model).toBe(MODEL_BY_TIER.ausgewogen);
    for (const t of a.tools ?? []) expect(sales.werkzeuge.includes(t.name) || AGENT_W.has(t.name), t.name).toBe(true);
    expect((a.tools ?? []).map(t => t.name)).toContain('an_mitarbeiter');
  });
  it('Business nie Gesundheit — auch nicht bei einer Person MIT Einwilligung (a)+(b)', async () => {
    for (const id of ['marketing', 'finanzen', 'strategie']) {
      await senden('person-b', { art: 'head', headId: id });
      const a = aufrufe.find(x => x.zweck === `agent-${id}`)!;
      expect(a.ki!.kategorien, id).not.toContain('gesundheit');
      expect(a.system, id).not.toMatch(/KÖRPER \(privat/);
    }
  });
  it('Gesundheit mit (a)+(b): Kategorie gesundheit, nur Gesundheits-Werkzeuge, Wellness-Satz, nur eigene Werte (kein Personen-Parameter)', async () => {
    const r = await senden('person-b', { art: 'head', headId: 'gesundheit' });
    expect(r.status).toBe(200);
    const a = aufrufe.find(x => x.zweck === 'agent-gesundheit')!;
    expect(a.ki!.kategorien).toContain('gesundheit');
    expect(a.system).toMatch(/keine Diagnose, keine Therapie/);
    const g = headDef('gesundheit')!;
    for (const t of a.tools ?? []) expect(g.werkzeuge.includes(t.name) || AGENT_W.has(t.name), t.name).toBe(true);
    const index = (a.tools ?? []).find(t => t.name === 'gesundheits_index') as unknown as { input_schema: { properties: Record<string, unknown> } } | undefined;
    if (index) expect(index.input_schema.properties).not.toHaveProperty('person');
  });
  it('Mitarbeiter: Modell aus der Vorlage („schnell“), Werkzeuge = seine ∩ die des Heads, nie an_mitarbeiter (Tiefe 2)', async () => {
    const r = await senden('person-a', { art: 'mitarbeiter', headId: 'sales', mitarbeiterId: 'sales-crm-pflege' });
    expect(r.status).toBe(200);
    const a = aufrufe.find(x => x.zweck === 'agent-sales')!;
    expect(a.model).toBe(MODEL_BY_TIER.schnell);
    const vorlage = headDef('sales')!.mitarbeiter.find(x => x.id === 'sales-crm-pflege')!;
    const namen = (a.tools ?? []).map(t => t.name);
    expect(namen).not.toContain('an_mitarbeiter');
    for (const n of namen) expect(vorlage.werkzeuge.includes(n) || AGENT_W.has(n), n).toBe(true);
    // Aushilfe über `auchFuer`: Mitarbeiter des Event-Heads arbeitet für Sales nur mit der Schnittmenge.
    await senden('person-a', { art: 'mitarbeiter', headId: 'sales', mitarbeiterId: 'event-nachfassen' });
    const b = aufrufe.find(x => x.zweck === 'agent-sales')!;
    const aus = headDef('event')!.mitarbeiter.find(x => x.id === 'event-nachfassen')!;
    for (const t of b.tools ?? []) if (!AGENT_W.has(t.name)) { expect(aus.werkzeuge, t.name).toContain(t.name); expect(headDef('sales')!.werkzeuge, t.name).toContain(t.name); }
  });
  it('KI-Schalter: Markttraktion für die Person aus → keine CRM-Werkzeuge, keine Kategorie crm, ruhiger Hinweis', async () => {
    const { aendereKiEinstellungen, kiEinstellungenVergessen } = await import('@/lib/datenschutz/ki-einstellungen');
    await aendereKiEinstellungen(d => ({ ...d, personen: { ...(d.personen ?? {}), 'team-c': { bereiche: { crm: false } } } }));
    kiEinstellungenVergessen();
    const r = await senden('team-c', { art: 'head', headId: 'sales' });
    expect(r.status).toBe(200);
    const a = aufrufe.find(x => x.zweck === 'agent-sales')!;
    expect(a.ki!.kategorien).not.toContain('crm');
    expect((a.tools ?? []).map(t => t.name).filter(n => /crm|kontakt|firma|pipeline|lage$/.test(n))).toEqual([]);
    expect(String(r.d.hinweis ?? '')).toMatch(/Markttraktion ist für die KI ausgeschaltet/);
  });
  it('das Tor sperrt selbst: Gesundheit ohne (b) geht nie hinaus (auch wenn ein Aufrufer es versuchte)', async () => {
    const { askText } = await import('@/lib/anthropic');
    const vorher = m.anfragen.length;
    const r = await askText({ system: 'x', user: 'y', zweck: 'agent-gesundheit', ki: { lauf: 'gespraech', person: 'person-a', kategorien: ['gesundheit'] } });
    expect(r.error).toBe('ki-gesperrt:einwilligung-gesundheit');
    expect(m.anfragen.length).toBe(vorher);
  });
});
