// ─── Wächter: Leistung, Kosten, Autonomie der Agenten (09.10., Paket 3; Fragerunde Teil 1 Antworten 15–17) ─────────────────
// Daumen (Speicher-Format), Annahmequote je Head (Freigabe-Listen + Stapel), Erfolgsquote je Skill, Kosten je Ergebnis, Review-Daten nur
// Zahlen, Kostenschätzung (Messung vor Annahme, Euro-Cent), Autonomie nur verschärfend über den Boden — hoch per Klick mit guter Quote,
// zurück automatisch bei schlechter.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-leistung-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-agenten-leistung';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return o;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

import { headDef } from '@/lib/agenten/katalog';
import { einstellungBestand, fadenBestand, type Faden, type Nachricht } from '@/lib/agenten/typen';
import {
  annahmeAus, annahmeAusEntscheidungen, annahmeAusListe, autonomieLage, autonomieWunschPruefen, autonomieZurueckstufen, daumenSetzen, daumenVon,
  fadenZahlen, headLeistung, kostenCent, kostenSchaetzen, euroText, reviewDatenAus, GROSS_AB_CENT, MIN_ENTSCHEIDUNGEN, autonomieSetzen, autonomiePflegen, reviewDaten,
} from '@/lib/agenten/leistung';

const T = '2026-10-05T08:00:00.000Z';
const nachricht = (id: string, rolle: Nachricht['rolle'], extra: Partial<Nachricht> = {}): Nachricht => ({ id, rolle, von: rolle === 'agent' ? 'head:sales' : 'person-a', text: 'Inhalt', zeit: T, ...extra });
const faden = (id: string, headId: string, lauf?: Faden['lauf'], nachrichten: Nachricht[] = []): Faden => ({
  id, besitzer: 'person-a', agent: { art: 'head', headId }, bereich: 'business', titel: id, status: 'fertig', fremdGelesen: false, vertraulich: false, nachrichten, erstellt: T, aktualisiert: T, ...(lauf ? { lauf } : {}),
});

describe('Kosten (rein)', () => {
  it('Stufe + Token → Euro-Cent; Schätzung: Messung (≥ 3 Läufe) vor Annahme, immer „ca.“', () => {
    expect(kostenCent({ stufe: 'stark', tokenEin: 1_000_000, tokenAus: 0 })).toBeCloseTo(4 * 100 * 0.86, 5);
    expect(kostenCent({ stufe: 'schnell', tokenEin: 0, tokenAus: 1_000_000 })).toBeCloseTo(5 * 100 * 0.86, 5);
    const a = kostenSchaetzen({ stufe: 'ausgewogen', art: 'lauf', gemessenCent: [10, 20] });
    expect(a.quelle).toBe('annahme');
    expect(a.text).toMatch(/^ca\. .* €.*noch keine Erfahrung/);
    const m = kostenSchaetzen({ stufe: 'ausgewogen', art: 'lauf', gemessenCent: [10, 20, 30], anzahl: 2 });
    expect(m).toMatchObject({ quelle: 'messung', cent: 40, laeufe: 3 });
    expect(euroText(0.4)).toBe('< 0,01 €');
    expect(euroText(1234)).toBe('12,34 €');
    expect(GROSS_AB_CENT).toBeGreaterThan(0);
  });
});

describe('Daumen, Annahmequote, Erfolgsquote, Kosten je Ergebnis (rein)', () => {
  it('Daumen nur an Agenten-Nachrichten; Speicher-Format `daumen` an der Nachricht', () => {
    expect(daumenSetzen(nachricht('n1', 'person'), { wert: 'hoch', am: T })).toBeNull();
    const n = daumenSetzen(nachricht('n2', 'agent'), { wert: 'runter', am: T, grund: 'passt_nicht' })!;
    expect(daumenVon(n)).toEqual({ wert: 'runter', am: T, grund: 'passt_nicht' });
    expect(daumenVon(daumenSetzen(n, null)!)).toBeNull();
  });
  it('Annahmequote: Freigabe-Liste ohne Selbst-Übernommenes, Stapel-Entscheidungen zu Vorschlägen des Heads; Quote erst ab genug Entscheidungen', () => {
    const liste = [
      { status: 'angenommen', entschieden: T }, { status: 'abgelehnt', entschieden: T }, { status: 'angenommen', entschieden: T, auto: { am: T } },
      { status: 'erledigt', entschieden: T }, { status: 'offen', aktualisiert: T }, { status: 'angenommen', entschieden: '2025-01-01T00:00:00.000Z' },
    ];
    expect(annahmeAusListe(liste, '2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z')).toEqual({ angenommen: 2, abgelehnt: 1 });
    const st = [
      { typ: 'entscheidung', entscheidung: 'freigegeben', bezug: { art: 'skill', id: 'sales' } },
      { typ: 'entscheidung', entscheidung: 'zurueck', bezug: { art: 'merksatz', id: 'sales' } },
      { typ: 'entscheidung', entscheidung: 'freigegeben', bezug: { art: 'skill', id: 'marketing' } },
      { typ: 'ausfuehrung', bezug: { art: 'skill', id: 'sales' } },
      { typ: 'entscheidung', entscheidung: 'freigegeben', bezug: { art: 'crm', id: 'sales' } },
    ];
    expect(annahmeAusEntscheidungen(st, 'sales')).toEqual({ angenommen: 1, abgelehnt: 1 });
    expect(annahmeAus(3, 1).quote).toBeNull();
    expect(annahmeAus(8, 2).quote).toBeCloseTo(0.8);
    expect(MIN_ENTSCHEIDUNGEN).toBe(10);
  });
  it('Läufe, Kosten, Daumen eines Heads; Kosten je Ergebnis; Review-Daten ohne Namen', () => {
    const fz = fadenZahlen([
      faden('fd-1', 'sales', { status: 'fertig', schritte: [], start: T, ende: T, kostenCent: 12 }, [daumenSetzen(nachricht('n', 'agent'), { wert: 'hoch', am: T })!]),
      faden('fd-2', 'sales', { status: 'fehler', schritte: [], start: T, kostenCent: 3 }),
      faden('fd-3', 'marketing', { status: 'fertig', schritte: [], start: T, kostenCent: 99 }),
      faden('fd-4', 'sales', undefined, [nachricht('k', 'agent', { kosten: { cent: 5 } })]),
    ], 'sales', '2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z');
    expect(fz).toMatchObject({ laeufe: { gesamt: 2, fertig: 1, fehler: 1 }, kostenCent: 20, daumen: { hoch: 1, runter: 0 }, gemessenCent: [12] });
    const l = headLeistung({ headId: 'sales', von: 'a', bis: 'b', faden: fz, entscheidungen: [{ angenommen: 3, abgelehnt: 1 }], skills: [{ id: 'sk-1', name: 'geheimer-name', erfolg: { laeufe: 4, angenommen: 3, abgelehnt: 0, fehler: 1 } }] });
    expect(l.kosten).toEqual({ cent: 20, jeErgebnisCent: 5 });
    expect(l.skills[0]).toMatchObject({ quote: 0.75, laeufe: 4 });
    const r = reviewDatenAus('2026-10', [{ ...l, autonomie: 'intern' }]);
    expect(JSON.stringify(r)).not.toContain('geheimer-name');
    expect(r.heads[0].skills[0]).toEqual({ laeufe: 4, quote: 0.75 });
  });
});

describe('Autonomie: nur verschärfen über den Boden; hoch per Klick mit Quote; zurück automatisch', () => {
  const SALES = headDef('sales')!, RESEARCH = headDef('research')!;
  const gut = annahmeAus(9, 1), schlecht = annahmeAus(2, 8), wenig = annahmeAus(1, 0);
  it('Boden: Heads mit vorhandenen Modi „intern“, alle anderen „vorschlag“ — nie darüber', () => {
    expect(autonomieLage(SALES, undefined, wenig)).toMatchObject({ boden: 'intern', stufe: 'intern' });
    expect(autonomieLage(RESEARCH, { autonomie: 'intern' }, gut)).toMatchObject({ boden: 'vorschlag', stufe: 'vorschlag' });
    expect(autonomieWunschPruefen(RESEARCH, undefined, 'intern', gut)).toMatchObject({ ok: false, status: 409 });
    expect(autonomieWunschPruefen(SALES, undefined, 'vorschlag', wenig)).toEqual({ ok: true, stufe: 'vorschlag' });
    expect(autonomieWunschPruefen(SALES, undefined, 'alles', gut)).toMatchObject({ ok: false, status: 400 });
  });
  it('hoch nur mit guter Quote; schlechte Quote stuft sofort (wirksam) und beim Pflegen (gespeichert) zurück', () => {
    expect(autonomieWunschPruefen(SALES, { autonomie: 'vorschlag' }, 'intern', wenig)).toMatchObject({ ok: false, status: 409 });
    expect(autonomieWunschPruefen(SALES, { autonomie: 'vorschlag' }, 'intern', gut)).toEqual({ ok: true, stufe: 'intern' });
    expect(autonomieLage(SALES, undefined, schlecht)).toMatchObject({ stufe: 'vorschlag', zurueck: true });
    const r = autonomieZurueckstufen({ v: 1, heads: {} }, [SALES, RESEARCH], id => (id === 'sales' ? schlecht : gut), T);
    expect(r.heads).toEqual(['sales']);
    expect(r.einst.heads.sales).toMatchObject({ autonomie: 'vorschlag', autonomieVon: 'system', autonomieGrund: 'quote' });
    // Erholt sich die Quote, bleibt es beim Gespeicherten — hoch nur per Klick.
    expect(autonomieLage(SALES, r.einst.heads.sales, gut)).toMatchObject({ stufe: 'vorschlag', hochMoeglich: true });
  });

  describe('Server', () => {
    beforeAll(async () => {
      const db = await import('@/lib/store/local-db');
      const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
        ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
      await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'inhaber', { haushalt: 'haus-a' }), konto('k2', 'gast', 'mitglied', { haushalt: 'haus-fremd' })], einladungen: [] });
      const jetzt = new Date().toISOString();
      await db.saveJson('head-sales', { berichte: [], letzte: {}, versuche: {}, vorschlaege: Array.from({ length: 10 }, (_, i) => ({ id: `hs-${i}`, status: i < 2 ? 'angenommen' : 'abgelehnt', erstellt: jetzt, aktualisiert: jetzt, entschieden: jetzt, berichtId: 'b' })) });
      await db.saveJson(fadenBestand('person-a'), { v: 1, faeden: [faden('fd-x', 'sales', { status: 'fertig', schritte: [], start: jetzt, ende: jetzt, kostenCent: 7 })] });
    });
    it('Hochstufen per Klick scheitert bei schlechter Quote; Verschärfen klappt und steht in den Einstellungen des Haushalts', async () => {
      expect(await autonomieSetzen('gast', 'sales', 'vorschlag')).toMatchObject({ ok: false, status: 403 });
      expect(await autonomieSetzen('person-a', 'gibt-es-nicht', 'vorschlag')).toMatchObject({ ok: false, status: 404 });
      const r = await autonomieSetzen('person-a', 'sales', 'vorschlag');
      expect(r).toMatchObject({ ok: true, autonomie: { stufe: 'vorschlag' } });
      const db = await import('@/lib/store/local-db');
      expect((await db.loadJson<{ heads: Record<string, unknown> }>(einstellungBestand('haus-a')))?.heads.sales).toMatchObject({ autonomie: 'vorschlag', autonomieVon: 'person-a', autonomieGrund: 'hand' });
      expect(await autonomieSetzen('person-a', 'sales', 'intern')).toMatchObject({ ok: false, status: 409 });
    });
    it('Pflegen stuft automatisch zurück, wenn gespeichert „intern“ und die Quote schlecht ist', async () => {
      const db = await import('@/lib/store/local-db');
      await db.saveJson(einstellungBestand('haus-a'), { v: 1, heads: { sales: { autonomie: 'intern' } } });
      expect(await autonomiePflegen('haus-a')).toEqual(['sales']);
      expect((await db.loadJson<{ heads: Record<string, unknown> }>(einstellungBestand('haus-a')))?.heads.sales).toMatchObject({ autonomie: 'vorschlag', autonomieGrund: 'quote' });
      expect(await autonomiePflegen('haus-a')).toEqual([]);
    });
    it('Review-Daten: nur sichtbare Heads, nur Zahlen', async () => {
      const r = await reviewDaten('person-a');
      expect(r.heads.find(h => h.headId === 'sales')).toMatchObject({ laeufe: { fertig: 1 }, kosten: { cent: 7 }, annahme: { angenommen: 2, abgelehnt: 8 } });
      expect((await reviewDaten('gast')).heads).toEqual([]);
    });
  });
});
