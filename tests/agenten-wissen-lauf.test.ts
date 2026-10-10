/* eslint-disable @typescript-eslint/no-explicit-any -- die Tests lesen Anfragen an die nachgebaute Messages-API als JSON */
// ─── Wächter: Wissen je Business-Head und Auftrag aus dem Brain IM LAUF (09.10.; nachgebaute Messages-API, kein Netz) ──────────────────────
// Ende zu Ende: „Aus dem Brain übernehmen“ setzt Auftrag (aus dem Vault) und Wissen für den Head of Sales → im Chat steht der Auftrag GEKAPSELT
// im System-Text (nie „von einem Menschen geschrieben“), der Head bekommt `wissen_suchen` und den Satz „DEIN WISSEN IM BRAIN“, das Werkzeug liefert
// nur Notizen aus seinem Ordner (private nie, andere Ordner nie), gekapselt, Kategorie `brain` im nächsten Modellaufruf. Modus „nur“: auch
// `suche_wissen` eines Heads sieht nur seine Ordner. Privat-Heads bekommen nie Wissen. Erfundene Konten, Vault und Notizen.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });
const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-wissen-lauf-'));
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: p.join(o, 'daten'), MAKE_OS_KEY: 'pruef-schluessel-wissen-lauf', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel',
    MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'Vault', 'Brain'), MAKE_OS_EMBEDDINGS: 'aus',
  });
  for (const k of ['ANTHROPIC_MODEL', 'MAKE_OS_KI_ANBIETER_TOR', 'MAKE_OS_KI_BUDGET_MONAT_EURO', 'MAKE_OS_DATEN_SCHLUESSEL']) delete process.env[k];
  return o;
});
type KiAufruf = { zweck?: string; system: string; ki?: { kategorien: string[] } };
const aufrufe = vi.hoisted(() => [] as KiAufruf[]);
vi.mock('@/lib/anthropic', async orig => {
  const o = await orig<typeof import('@/lib/anthropic')>();
  return { ...o, askText: async (opts: Parameters<typeof o.askText>[0]) => { aufrufe.push(opts as unknown as KiAufruf); return o.askText(opts); } };
});
import { kontenSaeen, modellFake, rufe, sitzung, text, werkzeug, type ModellFake } from './fixtures/agenten-kern';

type H = (r: Request) => Promise<Response>;
let agenten: { GET: H; POST: H };
let brain: { GET: H; POST: H };
let faden: { POST: H };
let m: ModellFake;
const VAULT = path.join(ordner, 'Vault', 'Brain');
const AG = '01. Firma/Agenten';
const WISSEN = '01. Firma/02_Vertrieb_Wissen';
const schreibe = (rel: string, t: string) => { const p = path.join(VAULT, rel); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, t, 'utf8'); };

beforeAll(async () => {
  mkdirSync(path.join(ordner, 'Vault', '.obsidian'), { recursive: true });
  schreibe(`${AG}/_Agenten_Index.md`, '---\ntype: index\nscope: intern\n---\n# Index\n\n| Vertrieb | [[vertrieb]] |\n');
  schreibe(`${AG}/vertrieb.md`, '---\ntype: agent\nscope: intern\nabteilung: sales\n---\n# Agent · Vertrieb\n\n## Mission\nAUFTRAG-AUS-DEM-VAULT pflegen.\n\n## Wissen\n[[Vertrieb_Wissen]]\n');
  schreibe(`${WISSEN}/Vertrieb_Wissen.md`, '---\nscope: intern\n---\n# Vertrieb_Wissen\n\nStaffelrabatt WISSEN-IM-ORDNER.\n');
  schreibe(`${WISSEN}/Geheim.md`, '---\nscope: privat\nowner: person-a\n---\n# Geheim\n\nStaffelrabatt PRIVAT-NIE.\n');
  schreibe('03. Anderes/Fremd.md', '---\nscope: intern\n---\n# Fremd\n\nStaffelrabatt ANDERER-ORDNER.\n');
  await kontenSaeen();
  agenten = (await import('@/app/api/agenten/route')) as unknown as typeof agenten;
  brain = (await import('@/app/api/agenten/brain/route')) as unknown as typeof brain;
  faden = (await import('@/app/api/agenten/faden/route')) as unknown as typeof faden;
  m = modellFake();
});
afterAll(async () => {
  m?.zurueck();
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => {});
  rmSync(ordner, { recursive: true, force: true });
});

const chat = async (person: string, headId: string, frage: string, ...antworten: ReturnType<typeof text>[]) => {
  aufrufe.length = 0; m.anfragen.length = 0;
  m.antworten.push(...antworten);
  const r = await rufe(faden.POST, '/api/agenten/faden', sitzung(person), { aktion: 'senden', agent: { art: 'head', headId }, text: frage });
  m.antworten.length = 0;
  return r;
};
const toolNamen = (a: Record<string, unknown>) => ((a.tools as { name: string }[] | undefined) ?? []).map(t => t.name);
const werkzeugErgebnis = (a: Record<string, unknown>) => JSON.stringify(a.messages ?? []);

describe('Übernahme → Lauf des Head of Sales', () => {
  it('Auftrag gekapselt im System-Text, `wissen_suchen` angeboten, Treffer nur aus dem Ordner (gekapselt, Kategorie brain)', async () => {
    const v = await rufe(brain.GET, '/api/agenten/brain', sitzung('person-a'));
    expect(v.status).toBe(200);
    const r = await rufe(brain.POST, '/api/agenten/brain', sitzung('person-a'), { aktion: 'uebernehmen', auswahl: v.d.vorauswahl, staende: {}, wissenStaende: {} });
    expect(r.status).toBe(200);
    expect((r.d.ergebnisse as { ok: boolean }[]).every(x => x.ok)).toBe(true);

    const c = await chat('person-b', 'sales', 'Was wissen wir über Rabatte?', werkzeug(['wissen_suchen', { frage: 'Staffelrabatt' }]), text('Laut Notiz …'));
    expect(c.status).toBe(200);
    const sys = aufrufe.find(x => x.zweck === 'agent-sales')!.system;
    expect(sys).toContain('AUS DEM BRAIN ÜBERNOMMEN');
    expect(sys).toMatch(/<fremde_daten quelle="brain-auftrag">[\s\S]*AUFTRAG-AUS-DEM-VAULT/);
    expect(sys).not.toMatch(/von einem Menschen geschrieben[^\n]*\n[^\n]*AUFTRAG-AUS-DEM-VAULT/);
    expect(sys).toContain('DEIN WISSEN IM BRAIN: „02_Vertrieb_Wissen“ (Ordner)');
    expect(toolNamen(m.anfragen[0])).toContain('wissen_suchen');
    const zweite = werkzeugErgebnis(m.anfragen[1]);
    expect(zweite).toContain('WISSEN-IM-ORDNER');
    expect(zweite).toContain('fremde_daten quelle=\\"notizen\\"');
    expect(zweite).not.toMatch(/PRIVAT-NIE|ANDERER-ORDNER/);
    expect(aufrufe[1]?.ki?.kategorien).toContain('brain');
  });
  it('Privat-Head: nie Wissen, nie `wissen_suchen`', async () => {
    const c = await chat('person-a', 'assistenz', 'Hallo', text('Hallo.'));
    expect(c.status).toBe(200);
    expect(aufrufe.find(x => x.zweck === 'agent-assistenz')!.system).not.toContain('DEIN WISSEN IM BRAIN');
    expect(toolNamen(m.anfragen[0])).not.toContain('wissen_suchen');
  });
  it('Modus „nur“: auch `suche_wissen` des Heads (Marketing) sieht nur seine Ordner', async () => {
    const kopf = ((await rufe(agenten.GET, '/api/agenten', sitzung('person-a'))).d.heads as any[]).find(h => h.id === 'marketing');
    const s = await rufe(agenten.POST, '/api/agenten', sitzung('person-a'), { aktion: 'wissen', headId: 'marketing', wissen: { pfade: [WISSEN], modus: 'nur' }, stand: kopf.einstellung.wissenStand });
    expect(s.status).toBe(200);
    const c = await chat('person-a', 'marketing', 'Rabatte?', werkzeug(['suche_wissen', { frage: 'Staffelrabatt' }]), text('Gefunden.'));
    expect(c.status).toBe(200);
    const zweite = werkzeugErgebnis(m.anfragen[1]);
    expect(zweite).toContain('WISSEN-IM-ORDNER');
    expect(zweite).not.toMatch(/ANDERER-ORDNER|PRIVAT-NIE/);
    expect(aufrufe.find(x => x.zweck === 'agent-marketing')!.system).toMatch(/NUR dort/);
  });
});
