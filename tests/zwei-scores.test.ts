// ─── Die zwei Scores (21.10.) — rein: Privat-Score, Filterstelle, Kurzform, KI-Sicht, Text, Säule „Prozesse“ ────────────────────────────
// Kevin 21.10.: „Am Ende müssen wir Privat wie auch im Business einen Score haben, der alles zusammenbringt.“ Geprüft (erfundene Werte):
//   (a) Privat-Score: Gewichte als Daten (50 · 21 · 14 · 14), Säulen tragen GENAU die Zahl ihres Index, Lücke statt Null, Säulen, die es für die
//       Person nicht geben kann (keine Einwilligung, kein Haushalt, Ausnahmezeit), fallen ganz heraus — ohne sie ist der Score exakt der der übrigen.
//   (b) die EINE Filterstelle: Privat nie für „nur Business“ und nie ohne Haushalt, Business nur mit Zugang; Auslieferung nur der erlaubten.
//   (c) Kurzform, KI-Sicht (ohne Einwilligung (b) ohne Gesundheit und ohne Gesamtzahl), Text für ZOE (nie gemischt).
//   (d) Business-Score: Säule „Prozesse“ (Kennung `ff`), ohne Messung bit-gleich wie bisher.
import { describe, it, expect } from 'vitest';
import { berechneModell, type IndexErgebnis } from '@/lib/kennzahlen/kern';
import {
  berechnePrivatScore, privatScoreGewichte, privatScoreSaeulen, PRIVAT_SCORE_GEWICHTE, PRIVAT_SCORE_KENNZAHLEN, quelleAus, OHNE_EINWILLIGUNG_SCORE,
  type PrivatScoreBestand, type QuellIndex,
} from '@/lib/scores/privat-score';
import { scoreRechte, scoresFuer, scoresAusliefern, scoreKurz, istScoreAnfrage, type ScoreKurz } from '@/lib/scores/sicht';
import { scoreFuerKi } from '@/lib/datenschutz/gesundheit-ki';
import { scoresSatz } from '@/lib/scores/text';
import { planungsLage } from '@/lib/scores/planung';
import { berechne } from '@/lib/business/index';
import { MESSEN, type Bestand } from '@/lib/business/messen';
import { SAEULEN, SAEULEN_TEXT, kennzahlenFuer } from '@/lib/business/register';
import { FF_GEWICHT } from '@/lib/fulfillment/prozesse/kennzahlen';
import type { Task } from '@/types/tasks';

const HEUTE = '2026-10-21';
const quelle = (index: number | null, teile: [string, number | null][] = [['a', index]]): QuellIndex =>
  ({ index, label: index == null ? 'Noch keine Daten' : 'Solide', satz: 'erfunden', teile: teile.map(([id, score]) => ({ id, label: `Teil ${id}`, score })), hebel: null });
const bestand = (x: Partial<PrivatScoreBestand> = {}): PrivatScoreBestand => ({
  heute: HEUTE,
  gesundheit: { erlaubt: true, quelle: quelle(70) },
  finanzen: { haushalt: true, quelle: quelle(50), frisch: true },
  familie: { haushalt: true, rhythmus: { score: 60, stufe: 'stabil', hinweis: 'erfunden', bausteine: [{ id: 'gespraech', titel: 'Paar-Gespräch', gewicht: 20, wert: 0.5, text: '2 von 4' }] } },
  planung: { offen: 10, ueberfaellig: 0, kritisch: 0, erledigt7: 5 },
  ...x,
});
const saeule = (pi: IndexErgebnis, id: string) => pi.saeulen.find(s => s.id === id)!;

describe('(a) Privat-Score — rein', () => {
  it('Gewichte als Daten: Gesundheit 35 · Finanzen 15 · Planung 10 · Familie 10 → 50 · 21 · 14 · 14 %; eigene ersetzen die Vorgabe', () => {
    expect(PRIVAT_SCORE_GEWICHTE).toEqual({ ge: 35, fi: 15, pl: 10, fa: 10 });
    const g = privatScoreGewichte();
    expect(Object.values(g).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, Math.round(v * 100)]))).toEqual({ ge: 50, fi: 21, pl: 14, fa: 14 });
    expect(privatScoreGewichte({ ge: 10, fi: 10, pl: 10, fa: 10 }).ge).toBeCloseTo(0.25, 9);
    expect(privatScoreGewichte({ ge: -1 }).ge).toBeCloseTo(0.5, 9); // ungültig → Vorgabe
  });

  it('eine Wahrheit: Gesundheit, Finanzen privat und Familie tragen GENAU die Zahl ihres Index; Gesamt = gewichtetes Mittel über den Kern', () => {
    const pi = berechnePrivatScore(bestand());
    expect(saeule(pi, 'ge').score).toBe(70);
    expect(saeule(pi, 'fi').score).toBe(50);
    expect(saeule(pi, 'fa').score).toBe(60);
    expect(saeule(pi, 'pl').score).toBe(100); // nichts überfällig, 10 offen (≤ 12), nichts kritisch, 5 erledigt
    const g = privatScoreGewichte();
    expect(pi.index).toBe(Math.round(70 * g.ge + 50 * g.fi + 100 * g.pl + 60 * g.fa));
    expect(pi.scope).toBe('privat-score');
    expect(pi.hebel?.saeule).toBe('Gesundheit'); // niedrig × schwer: (100 − 70) × 50 % schlägt (100 − 50) × 21 %
  });

  it('nie eine Null: ohne Werte Lücken mit Weg, kein Index', () => {
    const pi = berechnePrivatScore(bestand({ gesundheit: { erlaubt: true, quelle: null }, finanzen: { haushalt: true, quelle: null, frisch: false }, familie: { haushalt: true, rhythmus: null }, planung: null }));
    expect(pi.index).toBeNull();
    for (const s of pi.saeulen) {
      expect(s.score).toBeNull();
      for (const k of s.kennzahlen) { expect(k.gemessen).toBe(false); expect(k.punkte).toBeNull(); expect(k.details.length).toBeGreaterThan(0); }
    }
    // Ein Index ohne Zahl (vorläufig) ist eine Lücke — nie seine Teilwerte als Zahl.
    const v = berechnePrivatScore(bestand({ gesundheit: { erlaubt: true, quelle: quelle(null, [['er', 80]]) } }));
    expect(saeule(v, 'ge').score).toBeNull();
    expect(saeule(v, 'ge').kennzahlen[0].quelle).toMatch(/Gesundheits-Index hat noch keine Zahl/);
  });

  it('ohne Einwilligung, ohne Haushalt oder in der Ausnahmezeit fällt die Säule ganz heraus — der Score ist exakt der der übrigen', () => {
    const ohne = berechnePrivatScore(bestand({ gesundheit: { erlaubt: false, quelle: null } }));
    expect(saeule(ohne, 'ge').score).toBeNull();
    expect(saeule(ohne, 'ge').kennzahlen[0].quelle).toBe(OHNE_EINWILLIGUNG_SCORE);
    expect(privatScoreSaeulen(bestand({ gesundheit: { erlaubt: false, quelle: null } })).find(s => s.id === 'ge')?.nurMitMessung).toBe(true);
    const g = privatScoreGewichte();
    expect(ohne.index).toBe(Math.round((50 * g.fi + 100 * g.pl + 60 * g.fa) / (g.fi + g.pl + g.fa)));
    expect(ohne.luecken).toBe(0); // die herausgefallene Säule zählt auch nicht als Lücke
    const pause = berechnePrivatScore(bestand({ familie: { haushalt: true, rhythmus: { score: null, stufe: 'pause', hinweis: 'Pausiert', bausteine: [] } } }));
    expect(pause.index).toBe(Math.round((70 * g.ge + 50 * g.fi + 100 * g.pl) / (g.ge + g.fi + g.pl)));
    const ohneHaushalt = privatScoreSaeulen(bestand({ finanzen: { haushalt: false, quelle: null, frisch: false }, familie: { haushalt: false, rhythmus: null } }));
    expect(ohneHaushalt.filter(s => s.nurMitMessung).map(s => s.id).sort()).toEqual(['fa', 'fi']);
  });

  it('veraltete Buchungen: der Privat-Index zählt nicht (Lücke mit Satz), statt eine alte Zahl zu tragen', () => {
    const pi = berechnePrivatScore(bestand({ finanzen: { haushalt: true, quelle: quelle(90), frisch: false } }));
    expect(saeule(pi, 'fi').score).toBeNull();
    expect(saeule(pi, 'fi').kennzahlen[0].quelle).toMatch(/45 Tage/);
  });

  it('Planung: eigene private Aufgaben (verantwortlich oder beteiligt), Business und fremde zählen nie', () => {
    // Personen-Kennungen sind Speichernamen (string); der alte Typ `Owner` kennt nur zwei feste Namen — darum hier ohne ihn.
    const t = (id: string, x: Omit<Partial<Task>, 'assignee'> & { assignee?: string }): Task => ({ id, title: `Titel ${id}`, status: 'todo', priority: 'medium', assignee: 'person-a', spaceId: 'privat', createdAt: '2026-10-01', updatedAt: '2026-10-01', ...x } as unknown as Task);
    const l = planungsLage([
      t('p1', { dueDate: '2026-10-01' }), t('p2', { priority: 'critical' }), t('p3', { assignee: 'person-b', beteiligte: ['person-a'] }),
      t('p4', { status: 'done', completedAt: '2026-10-20T10:00:00.000Z' }), t('p5', { status: 'cancelled' }),
      t('fremd', { assignee: 'person-b' }), t('biz', { spaceId: 'kdv', dueDate: '2026-10-01', priority: 'critical' }),
    ], 'person-a', HEUTE)!;
    expect(l).toMatchObject({ offen: 3, ueberfaellig: 1, kritisch: 1, erledigt7: 1 });
    expect(JSON.stringify(l)).not.toContain('Titel biz');
    expect(JSON.stringify(l)).not.toContain('Titel fremd');
    expect(planungsLage([t('biz', { spaceId: 'kdv' })], 'person-a', HEUTE)).toBeNull();
  });

  it('Kennzahlen: jede mit Formel, Quelle, Weg; die Planung mit Schwellen (Ampel), die Quellen „direkt“', () => {
    for (const k of PRIVAT_SCORE_KENNZAHLEN) { expect(k.formel.length).toBeGreaterThan(20); expect(k.pflegen?.href).toMatch(/^\/os\//); }
    expect(PRIVAT_SCORE_KENNZAHLEN.filter(k => k.direkt).map(k => k.saeule).sort()).toEqual(['fa', 'fi', 'ge']);
  });
});

describe('(b) die EINE Filterstelle — Sicht X bekommt nichts aus Y', () => {
  it('Rechte nur aus dem Konto: „nur Business“ nie Privat; ohne Haushalt nie Privat; außerhalb des Inhaber-Haushalts nichts', () => {
    expect(scoreRechte({ imHaushaltDesInhabers: true, haushalt: 'h', finanzRecht: null })).toEqual({ privat: true, business: true });
    expect(scoreRechte({ imHaushaltDesInhabers: true, haushalt: 'h', finanzRecht: 'business' })).toEqual({ privat: false, business: true });
    expect(scoreRechte({ imHaushaltDesInhabers: true, haushalt: null })).toEqual({ privat: false, business: true });
    expect(scoreRechte({ imHaushaltDesInhabers: false, haushalt: 'anders' })).toEqual({ privat: false, business: false });
    expect(scoreRechte(null)).toEqual({ privat: false, business: false });
  });
  it('angefragt und erlaubt: einzelne Sicht ohne Recht → null (403); „beide“ nur das Erlaubte', () => {
    const voll = { privat: true, business: true }, nurB = { privat: false, business: true }, nichts = { privat: false, business: false };
    expect(scoresFuer('beide', voll)).toEqual(['privat', 'business']);
    expect(scoresFuer('privat', nurB)).toBeNull();
    expect(scoresFuer('beide', nurB)).toEqual(['business']);
    expect(scoresFuer('beide', nichts)).toBeNull();
    expect(istScoreAnfrage('alles')).toBe(false);
  });
  it('Auslieferung: was nicht erlaubt ist, fehlt ganz', () => {
    const roh = { privat: 'P', business: 'B' };
    expect(scoresAusliefern(roh, ['business'])).toEqual({ business: 'B' });
    expect(scoresAusliefern(roh, [])).toEqual({});
  });
});

describe('(c) Kurzform, KI-Sicht, Text', () => {
  const pi = berechnePrivatScore(bestand());
  const kurz = scoreKurz('privat', pi, [{ tag: '2026-10-19', index: 55 }, { tag: '2026-10-20', index: null }, { tag: HEUTE, index: pi.index }]);
  it('Kurzform: Name, Status aus dem Kern, Säulen ohne Punkte dahinter, Reihe nur mit Werten, Hebel mit Säulen-Kennung', () => {
    expect(kurz.name).toBe('Privat-Score');
    expect(kurz.reihe.map(r => r.tag)).toEqual(['2026-10-19', HEUTE]);
    expect(kurz.hebel?.saeuleId).toBe('ge');
    expect(JSON.stringify(kurz)).not.toContain('"details"');
    // Säulen „nur mit Messung“ ohne Messung bleiben in der Kurzform weg (Business: Kapazität, Prozesse).
    const ohne = scoreKurz('privat', berechnePrivatScore(bestand({ gesundheit: { erlaubt: false, quelle: null } })), [], ['ge']);
    expect(ohne.saeulen.map(s => s.id)).not.toContain('ge');
  });
  it('KI ohne Einwilligung (b): ohne Gesundheits-Säule, ohne Gesamtzahl, ohne Verlauf, ohne Gesundheits-Hebel; Business unverändert', () => {
    const k = scoreFuerKi(kurz, false)!;
    expect(k.index).toBeNull();
    expect(k.saeulen.map(s => s.id)).not.toContain('ge');
    expect(k.reihe).toEqual([]);
    expect(k.label).toBe('');
    const mitGesundheitsHebel: ScoreKurz = { ...kurz, hebel: { id: 'ps_gesundheit', label: 'Gesundheits-Index', saeule: 'Gesundheit', saeuleId: 'ge' } };
    expect(scoreFuerKi(mitGesundheitsHebel, false)!.hebel).toBeNull();
    expect(scoreFuerKi(kurz, true)).toBe(kurz);
    const b: ScoreKurz = { ...kurz, sicht: 'business', name: 'Business-Score' };
    expect(scoreFuerKi(b, false)).toBe(b);
  });
  it('Text für ZOE: je Score eine Zeile, nie eine gemischte Zahl; fehlt einer, steht er nicht da', () => {
    const b: ScoreKurz = { ...kurz, sicht: 'business', name: 'Business-Score', index: 75, label: 'Solide' };
    const t = scoresSatz({ privat: kurz, business: b });
    expect(t).toContain(`PRIVAT-SCORE: ${kurz.index}`);
    expect(t).toContain('BUSINESS-SCORE: 75');
    expect(t).toMatch(/nie zu einer Zahl mischen/);
    expect(scoresSatz({ business: b })).not.toContain('PRIVAT-SCORE');
    expect(scoresSatz({})).toBe('');
    expect(scoresSatz({ privat: scoreFuerKi(kurz, false)! }, { ohneGesundheitHinweis: true })).toMatch(/ohne Einwilligung/);
  });
  it('quelleAus: Zahl, Status-Satz und Teile eines Index — nur Namen und Zahlen', () => {
    const q = quelleAus(pi);
    expect(q.index).toBe(pi.index);
    expect(q.teile.map(t => t.id)).toEqual(pi.saeulen.map(s => s.id));
    expect(q.satz.length).toBeGreaterThan(5);
  });
});

describe('(d) Business-Score = Business-Index — Säule „Prozesse“ (Kennung ff)', () => {
  const leer = (x: Partial<Bestand> = {}): Bestand => ({
    heute: '2026-10-21', scope: 'gesamt', firmen: [], rechnungen: [], zahlungen: [], merkposten: [], planposten: [], finance: null,
    grundlageMonate: [], grundlageFixkosten: {}, abschluesse: [], mandate: [], chancen: [], traktion: { score: null, text: '' },
    termine: [], termineVollstaendig: true, bloecke: [], auftraege: [], meilensteine: [], fte: {}, mrrVerlauf: {}, ...x,
  });
  const monate = (u: number, k: number) => Array.from({ length: 8 }, (_, i) => ({ monat: `2026-0${i + 1}`, umsatzNetto: u, kostenNetto: k }));
  it('sichtbarer Name „Prozesse“, Kennung und Gewicht bleiben, zählt nur mit Messung; der Satz der Gewichte nennt sie', () => {
    const ff = SAEULEN.find(s => s.id === 'ff')!;
    expect(ff).toMatchObject({ label: 'Prozesse', gewicht: FF_GEWICHT, nurMitMessung: true });
    expect(SAEULEN_TEXT).toContain('Prozesse');
    expect(SAEULEN_TEXT).not.toContain('Fulfillment');
  });
  it('ohne Messung bit-gleich: der Index ist exakt der ohne die Säule (übrige Säulen im alten Verhältnis)', () => {
    const vorher = SAEULEN.filter(s => s.id !== 'ff').map(s => ({ ...s, gewicht: s.gewicht / (1 - FF_GEWICHT) }));
    for (const b of [leer(), leer({ fulfillment: null }), leer({ firmen: [{ id: 'kdv', name: 'V', kontostand: 60000, stand: null }], grundlageMonate: monate(20000, 10000), traktion: { score: 50, text: 'x' } })]) {
      const neu = berechne(b);
      const alt = berechneModell({ saeulen: vorher, kennzahlen: kennzahlenFuer(b.scope).filter(k => k.saeule !== 'ff'), messen: MESSEN, bestand: b, schwellen: b.schwellen, stand: b.heute, scope: b.scope });
      expect(neu.index).toBe(alt.index);
      expect(neu.abdeckung).toBeCloseTo(alt.abdeckung, 9);
      expect(neu.luecken).toBe(alt.luecken);
    }
  });
});
