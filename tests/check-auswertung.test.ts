// Innovations-Check — Auswertung (24.10.): der Nachbau in lib/check/auswertung.ts liefert für dieselben Eingaben dieselben Werte
// wie die verbindliche Referenz der Bauanleitung (Kopie: tests/fixtures/check-referenz/scoring.cjs). Erst die vier Testfälle der
// Anleitung wörtlich, dann viele Zufallsfälle gegen die Referenz.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { VORLAGEN, alleFragen } from '@/lib/check/katalog';
import { auswerten, luecken, leadPunkte, punkteFuer, profilAus, zeitPotenzial } from '@/lib/check/auswertung';
import { ergebnisSaetze } from '@/lib/check/zoe-texte';
import type { CheckAntworten, CheckProfil } from '@/lib/check/typen';

const require = createRequire(import.meta.url);
const referenz = require('./fixtures/check-referenz/scoring.cjs') as {
  score: (c: unknown, r: unknown, p: unknown, a: unknown) => Record<string, unknown>;
  gaps: (r: unknown, b: unknown, branche: string) => unknown[];
  leadScore: (ls: unknown, p: unknown, r: unknown, v: unknown) => { punkte: number; klasse: string };
};
const V = VORLAGEN['innovations-check'];
const { katalog, regeln, benchmarks, leadScoring } = V;
const pick = (id: string, i: number | string) => ({ optionIds: [`${id}_${i}`] });

describe('Testfälle der Bauanleitung (test_scoring.js)', () => {
  it('Fall 1: Handwerk, nur Kurzcheck, niedrige Werte', () => {
    const a: CheckAntworten = { B1: pick('B1', 1), B3: pick('B3', 1), C1: pick('C1', 1), C2: pick('C2', 1), C5: { belegScore: 1 }, C7: pick('C7', 1),
      D1: pick('D1', 1), D7: pick('D7', 1), D8: pick('D8', 1), E1: pick('E1', 1), E4: pick('E4', 2), G1: pick('G1', 0) };
    const r = auswerten(katalog, regeln, { branche: 'handwerk' }, a);
    expect(r.dimensionen).toEqual({ strategie: 25, ki: 25, automatisierung: 25, daten: 38, team: 0 });
    expect(r.robotik_gewertet).toBe(false);
    expect(r.gewichte.team).toBe(15);
    expect(r.gesamt).toBe(23);
    expect(r.stufe).toBe(2);
    expect(r.genauigkeit).toBe('vorlaeufig');
    expect(luecken(r, benchmarks, 'handwerk')[0].dimension).toBe('team');
    expect(leadPunkte(leadScoring, { groesse: '10-49', umsatz: '1-5m', rolle: 'inhaber_gf', budgetPunkte: 2, branche: 'handwerk' }, r, { gespraechGebucht: true, gratisProdukte: 1 }))
      .toEqual({ punkte: 31, klasse: 'A' });
  });
  it('Fall 2: hohe Klickwerte ohne Beleg → KI höchstens 60', () => {
    const r = auswerten(katalog, regeln, { branche: 'tech' }, { C1: pick('C1', 4), C2: pick('C2', 4), C5: { belegScore: 0 }, C7: pick('C7', 4) });
    expect(r.dimensionen.ki).toBe(60);
  });
  it('Fall 3: Robotik relevant und beantwortet → 5 % Robotik, 10 % Team', () => {
    const r = auswerten(katalog, regeln, { branche: 'produktion' }, { F1: pick('F1', 4), G1: pick('G1', 4), B1: pick('B1', 4) });
    expect(r.gewichte.robotik).toBe(5);
    expect(r.gewichte.team).toBe(10);
    expect(r.gesamt).toBe(100);
    expect(r.stufe).toBe(5);
  });
  it('Fall 4: Mehrfachauswahl', () => {
    expect(auswerten(katalog, regeln, { branche: 'tech' }, { C4: { optionIds: ['C4_0', 'C4_1', 'C4_2', 'C4_3'] } }).dimensionen.ki).toBe(75);
    expect(auswerten(katalog, regeln, { branche: 'tech' }, { C4: { optionIds: ['C4_keine'] } }).dimensionen.ki).toBe(0);
  });
});

/** Kleiner, fester Zufall (Mulberry32) — dieselben Fälle bei jedem Lauf. */
function zufall(saat: number) {
  let s = saat >>> 0;
  return () => { s += 0x6d2b79f5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('gleich wie die Referenz (600 Zufallsfälle)', () => {
  const fragen = alleFragen(katalog);
  const branchen = ['handwerk', 'dienstleistung', 'tech', 'produktion', 'handel', 'gesundheit', 'immobilien', 'sonstige'];
  it('score, gaps und leadScore stimmen überein', () => {
    const z = zufall(20261024);
    for (let n = 0; n < 600; n++) {
      const a: CheckAntworten = {};
      for (const f of fragen) {
        if (z() < 0.35) continue;
        if (f.typ === 'einfach' && f.optionen?.length) a[f.id] = { optionIds: [f.optionen[Math.floor(z() * f.optionen.length)].id] };
        else if (f.typ === 'mehrfach' && f.optionen?.length) {
          const ids = f.optionen.filter(() => z() < 0.4).map(o => o.id);
          a[f.id] = { optionIds: ids.includes('C4_keine') ? ['C4_keine'] : ids };
        } else if (f.typ === 'beleg' && z() < 0.8) a[f.id] = { belegScore: Math.floor(z() * 5) };
      }
      const profil: CheckProfil = { branche: branchen[Math.floor(z() * branchen.length)], ...(z() < 0.1 ? { logistik: true } : {}) };
      const mein = auswerten(katalog, regeln, profil, a);
      const ref = referenz.score(katalog, regeln, profil, a);
      expect(mein).toEqual(ref);
      expect(luecken(mein, benchmarks, profil.branche)).toEqual(referenz.gaps(ref, benchmarks, profil.branche!));
      const lp = { ...profil, groesse: ['solo', '2-9', '10-49', '50-249', '250+'][Math.floor(z() * 5)], rolle: ['inhaber_gf', 'innovation_ki', 'it'][Math.floor(z() * 3)], ...(z() < 0.5 ? { budgetPunkte: Math.floor(z() * 5) } : {}) };
      const v = { gespraechGebucht: z() < 0.3, berichtGeoeffnet: z() < 0.5, gratisProdukte: Math.floor(z() * 3) };
      expect(leadPunkte(leadScoring, lp, mein, v)).toEqual(referenz.leadScore(leadScoring, lp, ref, v));
    }
  });
});

describe('Hilfen', () => {
  it('Katalog: 65 Fragen, 15 im Kurzcheck', () => {
    expect(alleFragen(katalog)).toHaveLength(katalog.anzahl_fragen);
    expect(alleFragen(katalog).filter(f => f.kurzcheck)).toHaveLength(katalog.anzahl_kurzcheck);
  });
  it('unbewerteter Beleg zählt nicht', () => {
    const c5 = alleFragen(katalog).find(f => f.id === 'C5')!;
    expect(punkteFuer(c5, { freitext: 'Wir schreiben Angebote mit KI.' })).toBeNull();
  });
  it('Profil aus den A-Fragen, Budget aus B2, Phase aus J1', () => {
    const p = profilAus(katalog, { A1: { optionIds: ['A1_2'], zusatz: true }, A2: pick('A2', 2), A5: pick('A5', 0), B2: pick('B2', 3), J1: pick('J1', 0) });
    expect(p).toEqual({ branche: 'tech', startup: true, groesse: '10-49', rolle: 'inhaber_gf', budgetPunkte: 3, phase: 0 });
    expect(profilAus(katalog, { A1: { optionIds: ['A1_7'], optionText: 'Logistik' } })).toEqual({ branche: 'sonstige', branche_sonstige: 'Logistik' });
  });
  it('Zeit-Potenzial aus D7 als Spanne', () => {
    expect(zeitPotenzial(regeln, { D7: pick('D7', 0) })).toEqual({ stunden: 10, von: 7, bis: 13 });
    expect(zeitPotenzial(regeln, {})).toBeNull();
  });
  it('Zoes Sätze: gleichauf statt „am stärksten“, Lücke nur bei echtem Abstand', () => {
    const basis = { stufe: 3, stufe_name: 'Anwender', gesamt: 50, genauigkeit: 'genau' as const };
    const gleich = ergebnisSaetze({ ...basis, dimensionen: { strategie: 50, ki: 50, automatisierung: 50, daten: 50, team: 50 } }, []);
    expect(gleich[1]).toBe('In allen Bereichen liegst du gleichauf bei 50 Punkten.');
    expect(gleich[2]).toBe('In keinem Bereich liegst du unter dem Branchenwert.');
    const ungleich = ergebnisSaetze({ ...basis, dimensionen: { strategie: 70, ki: 30, automatisierung: 50, daten: 50, team: 50 } },
      [{ dimension: 'ki', wert: 30, branche: 45, abstand: 15 }]);
    expect(ungleich[1]).toBe('Am stärksten bist du bei Strategie und Führung mit 70 Punkten.');
    expect(ungleich[2]).toContain('KI im Alltag: 30 gegenüber 45 Punkten');
  });
});
