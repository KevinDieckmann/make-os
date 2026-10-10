// ─── Fulfillment C1 — Säule „Fulfillment“ im Business-Index (10.10.) ──────────────────────────────────────────────────────────────────
// 10 %, nur mit Messung: ohne Fall ist der Index BIT-gleich zum bisherigen (alle übrigen Säulen im alten Verhältnis); mit Fällen zählt sie,
// jede gemessene Kennzahl hat zwei bis drei Punkte mit Sprung in den Fall; die Sicht einer Gesellschaft sieht nur ihre Fälle.
import { describe, it, expect } from 'vitest';
import { berechne } from '@/lib/business/index';
import { MESSEN, type Bestand } from '@/lib/business/messen';
import { SAEULEN, KENNZAHLEN, kennzahlenFuer } from '@/lib/business/register';
import { berechneModell } from '@/lib/kennzahlen/kern';
import { FF_GEWICHT, FF_KENNZAHLEN, type FfIndexDaten } from '@/lib/fulfillment/prozesse/kennzahlen';

const leer = (x: Partial<Bestand> = {}): Bestand => ({
  heute: '2026-10-10', scope: 'gesamt', firmen: [], rechnungen: [], zahlungen: [], merkposten: [], planposten: [], finance: null,
  grundlageMonate: [], grundlageFixkosten: {}, abschluesse: [], mandate: [], chancen: [], traktion: { score: null, text: '' },
  termine: [], termineVollstaendig: true, bloecke: [], auftraege: [], meilensteine: [], fte: {}, mrrVerlauf: {}, ...x,
});
const monate = (u: number, k: number) => Array.from({ length: 8 }, (_, i) => ({ monat: `2026-0${i + 1}`, umsatzNetto: u, kostenNetto: k }));
const KAPA: Bestand['kapa'] = { last4: 120, bedarf4: 192, belastbar4: 160, machbar: { machbar: 1, eng: 0, nicht: 1, ueberfaellig: 0, ohneAufwand: 0, ohneTermin: 0, bewertet: 2 }, machbarAnteil: 50, planTreue: 60, istStdWoche: 24, planStdWoche: 48, pufferStdWoche: -8, erholung: 90, erholungPersonen: 1, engpassWochen: [], kritisch: [] };

/** Der Index vor der Säule „Fulfillment“: dieselben Säulen ohne `ff`, Gewichte im alten Maß (÷ 0,9). */
const VORHER = SAEULEN.filter(s => s.id !== 'ff').map(s => ({ ...s, gewicht: s.gewicht / (1 - FF_GEWICHT) }));
const vorherIndex = (b: Bestand) => berechneModell({ saeulen: VORHER, kennzahlen: kennzahlenFuer(b.scope).filter(k => k.saeule !== 'ff'), messen: MESSEN, bestand: b, schwellen: b.schwellen, stand: b.heute, scope: b.scope });

const FF: FfIndexDaten = {
  heute: '2026-10-10',
  zeilen: [
    { mandatId: 'm-a', gesellschaft: 'ug', kunde: 'Probe A AG', health: 'gruen', haengt: [], puls: { wert: 8, am: '2026-10-01' }, wert: 60 },
    { mandatId: 'm-b', gesellschaft: 'ug', kunde: 'Probe B GmbH', health: 'gelb', haengt: ['Willkommensmail überfällig'], wert: null },
    { mandatId: 'm-c', gesellschaft: 'kdv', kunde: 'Probe C KG', health: 'rot', haengt: [], wert: 20 },
  ],
};

describe('Business-Index: Säule „Fulfillment“', () => {
  it('10 %, die übrigen Säulen ×0,9 im alten Verhältnis; Gewichte summieren 1', () => {
    const g = Object.fromEntries(SAEULEN.map(s => [s.id, s.gewicht]));
    expect(g.ff).toBe(FF_GEWICHT);
    expect(Math.round(SAEULEN.reduce((s, x) => s + x.gewicht, 0) * 1e9) / 1e9).toBe(1);
    expect(SAEULEN.find(s => s.id === 'ff')).toMatchObject({ nurMitMessung: true });
    expect(KENNZAHLEN.filter(k => k.saeule === 'ff').map(k => k.id)).toEqual(FF_KENNZAHLEN.map(k => k.id));
    for (const k of KENNZAHLEN.filter(x => x.saeule === 'ff')) { expect(k.formel.length).toBeGreaterThan(40); expect(k.pflegen?.href).toMatch(/^\/os\/.*fulfillment/); }
  });

  it('ohne Fall ist der Index BIT-gleich zum bisherigen — auch mit gemessener Kapazität und an der Abdeckungs-Grenze', () => {
    const faelle: Bestand[] = [
      leer(),
      leer({ fulfillment: null }),
      leer({ fulfillment: { heute: '2026-10-10', zeilen: [] } }),
      leer({ firmen: [{ id: 'kdc', name: 'C', kontostand: 60000, stand: null }], grundlageMonate: monate(20000, 10000), traktion: { score: 50, text: 'x' } }),
      leer({ firmen: [{ id: 'kdc', name: 'C', kontostand: 60000, stand: null }], grundlageMonate: monate(20000, 10000) }),
      leer({ traktion: { score: 70, text: 'x' }, kapa: KAPA }),
      leer({ scope: 'ug', firmen: [{ id: 'ug', name: 'U', kontostand: 10000, stand: null }], grundlageMonate: monate(9000, 12000) }),
    ];
    for (const b of faelle) {
      const neu = berechne(b), alt = vorherIndex(b);
      const ff = neu.saeulen.find(s => s.id === 'ff');
      expect(ff == null || ff.score == null || ff.zuDuenn).toBe(true);
      expect(neu.index).toBe(alt.index);
      expect(neu.label).toBe(alt.label);
      expect(neu.teil).toEqual(alt.teil);
      expect(neu.abdeckung).toBeCloseTo(alt.abdeckung, 9);
    }
  });

  it('mit Fällen zählt sie — jede gemessene Kennzahl hat Punkte mit Sprung in den Fall', () => {
    const b = leer({ firmen: [{ id: 'ug', name: 'U', kontostand: 60000, stand: null }], traktion: { score: 50, text: 'x' }, kapa: KAPA, fulfillment: FF });
    const g = berechne(b);
    const ff = g.saeulen.find(s => s.id === 'ff')!;
    expect(ff.score).not.toBeNull();
    const vorher = vorherIndex(b);
    expect(g.abdeckung).toBeGreaterThan(vorher.abdeckung);
    expect(g.teil!.saeulen).toBe(vorher.teil!.saeulen + 1);
    const gemessen = ff.kennzahlen.filter(k => k.wert != null);
    expect(gemessen.map(k => k.id).sort()).toEqual(['ff_health', 'ff_puls', 'ff_takt', 'ff_wert']);
    for (const k of gemessen) {
      expect(k.details.length).toBeGreaterThanOrEqual(1);
      expect(k.details.length).toBeLessThanOrEqual(3);
      for (const d of k.details) expect(d.href).toMatch(/^\/os\/.*fulfillment/);
    }
    expect(ff.kennzahlen.find(k => k.id === 'ff_takt')!.wert).toBeCloseTo(200 / 3, 6);
  });

  it('Sicht einer Gesellschaft: nur ihre Fälle (Sicht „ug“ bekommt nichts aus „kdv“)', () => {
    const g = berechne(leer({ scope: 'ug', fulfillment: FF }));
    const ff = g.saeulen.find(s => s.id === 'ff')!;
    const texte = JSON.stringify(ff.kennzahlen.map(k => k.details));
    expect(texte).toContain('Probe A AG');
    expect(texte).not.toContain('Probe C KG');
    expect(ff.kennzahlen.find(k => k.id === 'ff_wert')!.wert).toBe(60);
  });
});
