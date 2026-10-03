// ─── Der Standard des neuen Scoring-Kerns trifft die alte Rechnung Punkt für Punkt (03.10.) ─────────────────
// Kevins Auftrag: „Standard = Werte, die die heutigen Scores möglichst nicht überraschend verändern.“ Hier der Beweis:
// zufällige Personen, Leads, Kernfragen, Fit, Aktivitäten (auch alte) — `leadScore` mit dem Standard muss in JEDEM Teil
// und in der Summe dasselbe liefern wie die wörtlich übernommene Rechnung von vor dem Umbau (tests/fixtures/…).
import { describe, it, expect } from 'vitest';
import { leadScore } from '@/lib/crm/score';
import { bisherigeRechnung } from '@/lib/crm/scoring';
// Seit 03.10. ist der Standard der geschärfte Vorschlag; die bisherige Rechnung bleibt wählbar („Bisherige Rechnung (bis 03.10.)“) und
// muss die alte Rechnung weiter Punkt für Punkt treffen — dieser Test beweist es, mit den Einstellungen der bisherigen Rechnung.
const ALT = { einstellungen: bisherigeRechnung() };
import { altScore } from './fixtures/lead-score-vor-scoring';
import type { Kontakt, Aktivitaet } from '@/lib/make-one/crm';
import type { Kriterien, Lead, Qual } from '@/lib/crm/typen';

// Deterministischer Zufall (mulberry32) — derselbe Lauf, jedes Mal.
function zufall(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const HEUTE = '2026-10-03';
const wahl = <T,>(r: () => number, l: readonly T[]): T => l[Math.floor(r() * l.length)];
const tagVor = (n: number) => new Date(Date.parse(`${HEUTE}T12:00:00Z`) - n * 864e5).toISOString().slice(0, 10);

function person(r: () => number, i: number): Kontakt {
  const art = ['mail', 'linkedin', 'anruf', 'antwort', 'termin', 'notiz', 'gespraech', 'system', 'event'] as const;
  const aktivitaeten: Aktivitaet[] = Array.from({ length: Math.floor(r() * 4) }, () => ({
    am: `${tagVor(Math.floor(r() * 500))}T10:00:00Z`, art: wahl(r, art), von: wahl(r, ['kevin', 'malin', 'system']),
    ...(r() < 0.3 ? { ergebnis: wahl(r, ['gespraech', 'termin', 'rueckruf', 'mailbox', 'nicht_erreicht'] as const) } : {}),
  }));
  return {
    id: `c-${i}`, vorname: 'T', nachname: `P${i}`, eignung: wahl(r, ['', 'ja', 'vielleicht', 'nein'] as const), prio: '',
    stufe: wahl(r, ['neu', 'angesprochen', 'gespraech', 'termin', 'angebot'] as const), aktivitaeten,
    ...(r() < 0.6 ? { email: `p${i}@example.invalid` } : {}), ...(r() < 0.4 ? { telefon: '123' } : {}), ...(r() < 0.4 ? { linkedin: 'x' } : {}),
    ...(r() < 0.2 ? { letzterKontakt: tagVor(Math.floor(r() * 500)) } : {}), ...(r() < 0.2 ? { quelle: 'Apple' } : {}),
    ...(r() < 0.15 ? { typ: 'Netzwerk' } : {}),
  } as Kontakt;
}
const kriterien = (r: () => number): Kriterien => {
  const q = () => wahl(r, ['ja', 'nein', 'unklar'] as Qual[]);
  return { schmerz: q(), entscheider: q(), budget: q(), zeitpunkt: q(), wirkung: q(), alternative: q() };
};

describe('Parität der bisherigen Rechnung — der Kern rechnet wie vorher', () => {
  it('500 zufällige Leads: Summe und jeder der vier Teile stimmen exakt überein', () => {
    const r = zufall(20261003);
    for (let n = 0; n < 500; n++) {
      const personen = Array.from({ length: 1 + Math.floor(r() * 3) }, (_, i) => person(r, n * 10 + i));
      const lead: Lead | undefined = r() < 0.7 ? { status: 'qualifizierung', kriterien: kriterien(r), ...(r() < 0.4 ? { fit: wahl(r, ['ja', 'nein', 'unklar'] as Qual[]) } : {}) } : undefined;
      const alt = altScore(personen, lead, HEUTE);
      const neu = leadScore(personen, lead, HEUTE, undefined, ALT);
      expect(neu.punkte, `Summe bei Lauf ${n}`).toBe(alt.punkte);
      for (const t of alt.teile) {
        const x = neu.teile.find(y => y.id === t.id)!;
        expect(x, `Teil ${t.id} fehlt bei Lauf ${n}`).toBeDefined();
        expect(x.punkte, `Teil ${t.id} bei Lauf ${n}`).toBe(t.punkte);
        expect(x.max).toBe(t.max);
      }
    }
  });
  it('auch mit überschriebenen Kernfragen (der 4. Parameter) und ohne Lead', () => {
    const r = zufall(7);
    for (let n = 0; n < 100; n++) {
      const personen = [person(r, n)];
      const k = kriterien(r);
      expect(leadScore(personen, undefined, HEUTE, k, ALT).punkte).toBe(altScore(personen, undefined, HEUTE, k).punkte);
    }
  });
  it('Die bisherige Rechnung summiert auf 100 mögliche Punkte in vier Teilen — Fit 30, Wärme 30, Qualifizierung 30, Erreichbar 10', () => {
    const s = leadScore([person(zufall(1), 1)], undefined, HEUTE, undefined, ALT);
    expect(s.teile.map(t => [t.id, t.max])).toEqual([['fit', 30], ['waerme', 30], ['qualifizierung', 30], ['erreichbarkeit', 10]]);
    expect(bisherigeRechnung().temperaturAb).toEqual({ lau: 25, warm: 50, heiss: 75 });
  });
  it('SQL-bereit nach der bisherigen Rechnung = die alte Regel (Schmerz + Entscheider + Budget oder Zeitpunkt)', async () => {
    const { sqlBereit, fehltBisSql } = await import('@/lib/crm/leads');
    const r = zufall(99);
    for (let n = 0; n < 300; n++) {
      const k = kriterien(r);
      const s = leadScore([person(r, n)], { status: 'qualifizierung', kriterien: k }, HEUTE, undefined, ALT);
      expect(s.scoring!.sales.erreicht, JSON.stringify(k)).toBe(sqlBereit(k));
      expect(s.scoring!.sales.fehlt, JSON.stringify(k)).toEqual(fehltBisSql(k));
    }
  });
});
