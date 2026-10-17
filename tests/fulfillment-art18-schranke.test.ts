// ─── Gesamtprüfung 18.10. (L3 B6/B7): Fulfillment-Analyse — Art. 18 nie ans Modell, Stundenbudget je Person ──────────────────────────────
// B6: Personenkarten, deren verknüpfter Kontakt eingeschränkt ist (Art. 18), gingen über ZOE `fulfillment_lage` und das Agenten-Werkzeug
// `dossier_teile` weiter an den KI-Anbieter. Jetzt fallen sie heraus, nur ihre Zahl bleibt. B7: die Analyse-Route (bis zu 20 Modellaufrufe mit
// Web-Suche bzw. der Tiefenbericht) lief ohne `modellSchranke` (Regel 7). Eigener Datenordner, erfundene Daten (@example.invalid).
import { describe, it, expect, afterAll, vi } from 'vitest';
import { rmSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ordner = await vi.hoisted(async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const p = await import('node:path');
  const o = mkdtempSync(p.join(tmpdir(), 'make-os-ff-art18-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-ff-art18', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus' });
  for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'ANTHROPIC_API_KEY']) delete process.env[k];
  return o;
});

import { kartenOhneEingeschraenkte, ausgeblendetText } from '@/lib/fulfillment/analyse/dsgvo';

afterAll(() => rmSync(ordner, { recursive: true, force: true }));
const lies = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

describe('B6: Karten eingeschränkter Kontakte gehen nie ans Modell', () => {
  it('rein: herausnehmen, nur die Zahl bleibt; Karten ohne Kontakt bleiben', () => {
    const karten = [{ id: 'a', kontaktId: 'c-frei' }, { id: 'b', kontaktId: 'c-gesperrt' }, { id: 'c' }];
    const r = kartenOhneEingeschraenkte(karten, new Set(['c-gesperrt']));
    expect(r.karten.map(k => k.id)).toEqual(['a', 'c']);
    expect(r.ausgeblendet).toBe(1);
    expect(ausgeblendetText(2)).toMatch(/^2 Karten ausgeblendet \(Art\. 18/);
  });
  it('beide Wege ans Modell filtern über dieselbe Stelle', () => {
    for (const f of ['lib/fulfillment/analyse/zoe-werkzeug.ts', 'lib/fulfillment/analyse/werkzeuge.ts']) {
      const q = lies(f);
      expect(q, f).toContain('kartenOhneEingeschraenkte(');
      expect(q, f).toContain('eingeschraenkteKennungen()');
    }
  });
  it('eingeschraenkteKennungen liest die Kartei (Art.-18-Marke)', async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('kontakte', { kontakte: [
      { id: 'c-frei', vorname: 'Frei', nachname: 'Probe', aktivitaeten: [] },
      { id: 'c-gesperrt', vorname: 'Gesperrt', nachname: 'Probe', aktivitaeten: [], eingeschraenkt: { seit: '2026-10-01', grund: 'Antrag', von: 'pia' } },
    ] });
    const { eingeschraenkteKennungen } = await import('@/lib/crm/verarbeitung');
    expect([...(await eingeschraenkteKennungen())]).toEqual(['c-gesperrt']);
  });
});

describe('B7: Analyse-Route mit `modellSchranke`', () => {
  it('ist das Stundenbudget der Person aufgebraucht, starten und Tiefenbericht → 429 (vor jeder Arbeit)', async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'pia', email: 'pia@example.invalid', name: 'Pia', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-a18' }], einladungen: [] });
    const { modellErlaubt } = await import('@/lib/zugang/modell-drossel');
    while (modellErlaubt('pia', 40).ok) { /* Budget aufbrauchen */ }
    const route = await import('@/app/api/fulfillment/analyse/route');
    const post = (b: Record<string, unknown>) => route.POST(new Request('http://test/api/fulfillment/analyse', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': 'pia' }, body: JSON.stringify(b) }));
    expect((await post({ aktion: 'starten', mandatId: 'm-1', agent: 'a1', bestaetigtCent: 100, anfrageId: 'a-1' })).status).toBe(429);
    expect((await post({ aktion: 'tiefenbericht', mandatId: 'm-1', bestaetigtCent: 100, anfrageId: 'a-2' })).status).toBe(429);
  });
});

describe('C7: Suchschritt der Analyse rahmt die Eingaben als Daten', () => {
  it('Schritt 1 „Suchen“ gibt die Dossier-Eingaben nur über fremd(…) ans Modell (wie Schritt 2)', () => {
    expect(lies('lib/fulfillment/analyse/lauf.ts')).toContain("user: fremd('eingaben', `Unternehmen: ${d.eingaben.firma}");
  });
});
