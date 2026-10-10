// ─── Fulfillment C3 · Demo ohne KI-Schlüssel vollständig (10.10.; FULFILLMENT_KONZEPT.md 12.7) ───────────────────────────────────────────────
// Die Saat legt ein erfundenes Dossier mit allen Abschnitten an — gespeicherte Läufe mit Kosten, Prüfbericht, F1/F2, eine Personenkarte mit Art.-14-Uhr,
// kein Leseteil — und ruft dabei NIE ein Modell (kein Schlüssel, `askText` würde scheitern). Eigener Datenordner, nie der echte Bestand.
import { describe, it, expect, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const { wurzel } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: p } = await import('node:path');
  const wurzel = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-ff-c3-demo-'));
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: p.join(wurzel, 'daten'), MAKE_VAULT_DIR: p.join(wurzel, 'daten', 'wissen'), MAKE_OS_KEY: 'pruef-schluessel-ff-c3-demo', MAKE_OS_OHNE_APPLE: '1',
    MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_EMBEDDINGS: 'aus', MAKE_OS_INTERN: 'http://localhost:3999',
  });
  for (const k of ['MAKE_OS_DATENSCHLUESSEL', 'MAKE_OS_DEMO', 'ANTHROPIC_API_KEY', 'ICLOUD_APPLE_ID', 'GOOGLE_CLIENT_ID', 'TELEGRAM_BOT_TOKEN', 'WHOOP_CLIENT_ID']) delete process.env[k];
  return { wurzel };
});
const modell = vi.hoisted(() => ({ aufrufe: 0 }));
vi.mock('@/lib/anthropic', async importOriginal => {
  const echt = await importOriginal<typeof import('@/lib/anthropic')>();
  return { ...echt, askText: vi.fn(async (o: unknown) => { modell.aufrufe++; return echt.askText(o as never); }), askWithSearch: vi.fn(async () => { modell.aufrufe++; return { ok: false, status: 0, text: '', webUsed: false }; }) };
});

afterAll(() => { rmSync(wurzel, { recursive: true, force: true }); });

describe('Demo-Dossier', () => {
  it('alle Abschnitte, Läufe mit Kosten, Prüfbericht, F1/F2, eine Karte mit Art.-14-Uhr, kein Leseteil — ohne Modell', async () => {
    const server = await import('@/lib/demo/server');
    const b = await server.demoSaenInLeerenOrdner({ passwort: 'pruef-passwort-demo' });
    expect(b.schritte.find(s => s.name === 'Fulfillment · Dossier')?.anzahl).toBe(1);
    const { fulfillmentLesen } = await import('@/lib/fulfillment/speicher');
    const d = (await fulfillmentLesen('dossiers')).dossiers['m-demo-nordwerk'];
    expect(d).toBeTruthy();
    const gefuellt = Object.values(d.abschnitte).filter(a => a && a.aussagen.length).map(a => a!.id).sort();
    expect(gefuellt).toEqual(['aussen', 'fazit', 'fragen', 'good_bad', 'hypothesen', 'markt', 'unternehmen', 'vertrieb']);
    expect(Object.keys(d.abschnitte).sort()).toEqual(['aussen', 'chancen_risiken', 'fazit', 'finanzen', 'fragen', 'gesellschafter', 'good_bad', 'hypothesen', 'markt', 'reputation', 'unternehmen', 'vertrieb']);
    expect(d.laeufe.filter(l => typeof l.kostenCent === 'number' && l.kostenCent > 0).length).toBeGreaterThanOrEqual(5);
    expect(d.f1?.funktionen).toEqual(['Geschäftsführung']);
    expect(d.interessenabwaegung).toBeTruthy();
    expect(d.pruefung?.bestanden).toBe(true);
    expect(d.pruefung?.befunde.some(x => x.ueberstimmt)).toBe(true);
    expect(d.f2).toBeTruthy();
    expect(d.diagnose?.quickWins).toHaveLength(3);
    expect(d.leseteil).toBeUndefined();
    const karten = (await fulfillmentLesen('personen')).karten;
    expect(karten).toHaveLength(1);
    expect(karten[0].art14.faelligAm).toBeTruthy();
    expect(modell.aufrufe).toBe(0);
    // Die Aufgabe des Start-Prüfers (Registerauszug) steht im Aufgaben-Bestand.
    const { loadJson } = await import('@/lib/store/local-db');
    const tasks = await loadJson<{ tasks: { title: string }[] }>('tasks');
    expect(tasks?.tasks.some(t => /Registerauszug/.test(t.title))).toBe(true);
  }, 120_000);
});
