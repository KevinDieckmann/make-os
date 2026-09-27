// ─── Sport · Gym: e1RM (Epley), Verlauf, Vorlagen ───────────────────────────
import { describe, it, expect } from 'vitest';
import { e1rm, bestesE1rm, volumen, verlauf, rekorde, ausVorlage, alleUebungen, alleVorlagen, UEBUNGEN, VORLAGEN } from '../lib/sport/gym';
import type { GymEinheit } from '../lib/sport/modell';

describe('e1RM nach Epley', () => {
  it('kg × (1 + Wdh/30), bei 1 Wdh das Gewicht', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 5)).toBe(116.7);
    expect(e1rm(60, 10)).toBe(80);
    expect(e1rm(0, 5)).toBe(0);
  });
  it('bestes e1RM und Volumen einer Satzliste', () => {
    const s = [{ kg: 80, wdh: 8 }, { kg: 90, wdh: 3 }, { kg: 100, wdh: 1 }];
    expect(bestesE1rm(s)).toBe(101.3); // 80×(1+8/30)=101,3 schlägt 99 und 100
    expect(volumen(s)).toBe(640 + 270 + 100);
  });
});

const einheiten: GymEinheit[] = [
  { id: 'g2', datum: '2026-09-20', uebungen: [{ uebung: 'kniebeuge', saetze: [{ kg: 85, wdh: 5 }, { kg: 85, wdh: 5 }] }] },
  { id: 'g1', datum: '2026-09-13', uebungen: [{ uebung: 'kniebeuge', saetze: [{ kg: 80, wdh: 5 }] }, { uebung: 'klimmzug', saetze: [{ kg: 0, wdh: 6 }] }] },
];

describe('Verlauf und Rekorde', () => {
  it('Verlauf je Übung, älteste zuerst', () => {
    const v = verlauf(einheiten, 'kniebeuge');
    expect(v.map(x => x.datum)).toEqual(['2026-09-13', '2026-09-20']);
    expect(v[1]).toMatchObject({ topKg: 85, saetze: 2, volumen: 850 });
    expect(v[1].e1rm).toBe(e1rm(85, 5));
    expect(verlauf(einheiten, 'bankdruecken')).toEqual([]);
  });
  it('Rekorde je Übung mit Datum', () => {
    const r = rekorde(einheiten);
    expect(r.kniebeuge).toEqual({ e1rm: e1rm(85, 5), datum: '2026-09-20' });
    expect(r.klimmzug).toBeUndefined(); // ohne Zusatzgewicht kein e1RM
  });
});

describe('Bibliothek und Vorlagen', () => {
  it('eigene Übungen und Vorlagen ergänzen die Bibliothek und gewinnen bei gleicher Kennung', () => {
    const u = alleUebungen([{ id: 'kniebeuge', name: 'Frontkniebeuge', gruppe: 'beine', eigen: true }, { id: 'boxjump', name: 'Box Jump', gruppe: 'beine', eigen: true }]);
    expect(u.length).toBe(UEBUNGEN.length + 1);
    expect(u.find(x => x.id === 'kniebeuge')!.name).toBe('Frontkniebeuge');
    expect(alleVorlagen([]).length).toBe(VORLAGEN.length);
  });
  it('jede Vorlage verweist nur auf bekannte Übungen', () => {
    const ids = new Set(UEBUNGEN.map(u => u.id));
    for (const v of VORLAGEN) for (const u of v.uebungen) expect(ids.has(u.uebung)).toBe(true);
  });
  it('aus der Vorlage kommen Sätze mit dem Gewicht vom letzten Mal', () => {
    const v = VORLAGEN.find(x => x.id === 'hyrox-kraft-a')!;
    const s = ausVorlage(v, einheiten);
    const kb = s.find(x => x.uebung === 'kniebeuge')!;
    expect(kb.saetze).toHaveLength(4);
    expect(kb.saetze[0]).toEqual({ kg: 85, wdh: 6 });
    expect(s.find(x => x.uebung === 'sled-push')!.saetze[0].kg).toBe(0);
  });
});
