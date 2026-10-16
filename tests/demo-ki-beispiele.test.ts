// ─── Demo: KI-Beispiele (15.10., Abnahme 2 B13 — Kevin: „Beispiel-Ergebnisse säen“) ──────────────────────────────────────────────────────
// Wächter: (1) die Demo zeigt KI-Beispiele — Heads, Head of Finance, ZOE-Stapel, ZOE-Gespräch —, jedes mit der Marke `beispiel: true` an den Daten;
// (2) eine Live-Instanz ohne Demo-Marke bzw. ohne MAKE_OS_DEMO=1 bekommt NIE Beispiele (der Riegel sitzt in der Saat-Funktion selbst);
// (3) die Oberfläche zeigt die Marke an jedem dieser Orte (Chip „Beispiel“). Eigener Datenordner, erfundene Daten.
import { describe, it, expect, afterAll, vi } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const { wurzel } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: p } = await import('node:path');
  const wurzel = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-ki-beispiele-'));
  const ordner = p.join(wurzel, 'daten');
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_VAULT_DIR: p.join(ordner, 'wissen'), MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_EMBEDDINGS: 'aus', MAKE_OS_OHNE_APPLE: '1' });
  delete process.env.MAKE_OS_DATENSCHLUESSEL; delete process.env.MAKE_OS_DEMO; delete process.env.ANTHROPIC_API_KEY;
  return { wurzel };
});
afterAll(() => { rmSync(wurzel, { recursive: true, force: true }); delete process.env.MAKE_OS_DEMO; });

const db = await import('@/lib/store/local-db');
const { beispieleErlaubt, istBeispiel } = await import('@/lib/demo/beispiel');
const { kiBeispieleSaen } = await import('@/lib/demo/saat-ki');
const { DEMO_MARKE } = await import('@/lib/demo/schutz');
const { vorschlagAnzeige } = await import('@/lib/zoe/vorschlag-anzeige');

const kontext = () => ({ lena: 'lena', jonas: 'jonas', haushalt: 'demo', heute: '2026-10-15', jetzt: new Date('2026-10-15T08:00:00.000Z'), kontaktId: (k: string) => `c-${k}` });
const nichtsGeschrieben = async () => {
  for (const b of ['head-sales', 'head-marketing', 'head-event', 'finanzchef', 'haushalt-chef--demo', 'zoe-stapel', 'agenten-faeden--lena']) expect(await db.loadJson(b), b).toBeNull();
};

describe('Riegel: Beispiele nur in einer Demo-Instanz', () => {
  it('rein: nur mit MAKE_OS_DEMO=1 UND Demo-Marke', () => {
    expect(beispieleErlaubt({ env: { MAKE_OS_DEMO: '1' }, marke: { saat: 1 } })).toBe(true);
    expect(beispieleErlaubt({ env: {}, marke: { saat: 1 } })).toBe(false);
    expect(beispieleErlaubt({ env: { MAKE_OS_DEMO: '1' }, marke: null })).toBe(false);
    expect(beispieleErlaubt({ env: { MAKE_OS_DEMO: '1' }, marke: { saat: 'x' } })).toBe(false);
    expect(istBeispiel({ beispiel: true })).toBe(true);
    expect(istBeispiel({ beispiel: 'ja' })).toBe(false);
  });
  it('Live-Instanz ohne Demo-Marke: auch mit MAKE_OS_DEMO=1 wird nichts gesät', async () => {
    process.env.MAKE_OS_DEMO = '1';
    const r = await kiBeispieleSaen(kontext());
    expect(r.every(s => s.anzahl === 0)).toBe(true);
    await nichtsGeschrieben();
  });
  it('mit Demo-Marke, aber ohne MAKE_OS_DEMO=1: nichts', async () => {
    delete process.env.MAKE_OS_DEMO;
    await db.saveJson(DEMO_MARKE, { saat: 1, haushalt: 'demo' });
    const r = await kiBeispieleSaen(kontext());
    expect(r.every(s => s.anzahl === 0)).toBe(true);
    await nichtsGeschrieben();
  });
});

describe('Demo zeigt KI-Beispiele — jedes als Beispiel markiert', () => {
  it('Heads, Head of Finance, ZOE-Stapel und ZOE-Gespräch', async () => {
    process.env.MAKE_OS_DEMO = '1';
    const r = await kiBeispieleSaen(kontext());
    expect(Object.fromEntries(r.map(s => [s.name, s.anzahl]))).toMatchObject({ 'KI-Beispiele: ZOE-Stapel': 1, 'KI-Beispiele: ZOE-Gespräch': 1 });
    for (const h of ['sales', 'marketing', 'event']) {
      const st = await db.loadJson<{ berichte: { beispiel?: true; antwort: { zusammenfassung: string } }[]; vorschlaege: { beispiel?: true; status: string; frist: string | null }[] }>(`head-${h}`);
      expect(st?.berichte.length, h).toBe(1);
      expect(st!.berichte.every(istBeispiel), h).toBe(true);
      expect(st!.vorschlaege.length, h).toBeGreaterThanOrEqual(2);
      expect(st!.vorschlaege.length, h).toBeLessThanOrEqual(3);
      expect(st!.vorschlaege.every(v => istBeispiel(v) && v.status === 'offen' && !!v.frist), h).toBe(true);
    }
    for (const b of ['finanzchef', 'haushalt-chef--demo']) {
      const st = await db.loadJson<{ berichte: { beispiel?: true }[]; vorschlaege: { beispiel?: true }[] }>(b);
      expect(st!.berichte.every(istBeispiel) && st!.berichte.length === 1, b).toBe(true);
      expect(st!.vorschlaege.length, b).toBe(2);
      expect(st!.vorschlaege.every(istBeispiel), b).toBe(true);
    }
    const stapel = await db.loadJson<{ vorschlaege: { beispiel?: true; titel: string; nachher: string; anlass?: string }[] }>('zoe-stapel');
    const v = stapel!.vorschlaege[0];
    expect(istBeispiel(v)).toBe(true);
    const a = vorschlagAnzeige(v);
    expect(a.beispiel).toBe(true);
    expect(a.titel && a.was && a.wofuer).toBeTruthy();
    // Ein zweites Säen legt nichts doppelt an (feste Kennungen).
    await kiBeispieleSaen(kontext());
    expect((await db.loadJson<{ berichte: unknown[] }>('head-sales'))!.berichte.length).toBe(1);
    // Das ZOE-Gespräch: Antworten von ZOE tragen KI- und Beispiel-Marke.
    const { bestandLesen, eigeneFaedenLesen } = await import('@/lib/agenten/faeden-server');
    const koepfe = (await bestandLesen('lena')).faeden.filter(k => k.agent.art === 'zoe');
    expect(koepfe).toHaveLength(1);
    const [zoe] = await eigeneFaedenLesen('lena', koepfe);
    const antworten = zoe.nachrichten.filter(n => n.rolle === 'agent');
    expect(antworten.length).toBeGreaterThan(0);
    expect(antworten.every(n => n.ki && n.beispiel)).toBe(true);
  });
  it('kein Betrag in den Texten der Beispiele (der Prüfer der Heads verlangt Belege für jede Zahl)', async () => {
    for (const b of ['head-sales', 'head-marketing', 'head-event', 'finanzchef']) {
      expect(JSON.stringify(await db.loadJson(b)), b).not.toMatch(/\d\s?€/);
    }
  });
});

describe('Oberfläche: die Marke „Beispiel“ an jedem Ort', () => {
  const quelle = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');
  it('Heads, Head of Finance, Freigaben (Stapel, Heute, Hintergrund), Gespräch, Analyse', () => {
    expect(quelle('components/os/crm/HeadPanel.tsx')).toMatch(/bericht\?\.beispiel && <BeispielMarke \/>/);
    expect(quelle('components/os/crm/HeadPanel.tsx')).toMatch(/v\.beispiel && <BeispielMarke \/>/);
    expect(quelle('components/os/FinanzchefView.tsx')).toMatch(/v\.beispiel && <BeispielMarke \/>/);
    for (const p of ['components/os/StapelView.tsx', 'components/os/flaeche/widgets.tsx', 'components/os/agenten/Hintergrund.tsx']) expect(quelle(p), p).toMatch(/a\.beispiel/);
    expect(quelle('components/os/agenten/Chat.tsx')).toMatch(/n\.beispiel && <BeispielMarke \/>/);
    expect(quelle('components/os/fulfillment/analyse/Laeufe.tsx')).toMatch(/l\.beispiel/);
    expect(quelle('components/os/fulfillment/analyse/FallAnalyse.tsx')).toMatch(/d\.dossier\.beispiel/);
  });
});
