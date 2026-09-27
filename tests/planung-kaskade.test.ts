// Die Ziel-Kaskade (Kevin 27.09.): Jahresziel → Quartal/Monat/Woche/Tag, Zahlen
// anteilig, Termin-Ziele als Meilenstein; nie dupliziert, Angepasstes bleibt.

import { describe, expect, it } from 'vitest';
import { anteil, teile, abgeleiteterTitel, ebeneAbleiten, kaskadeAnwenden, meilensteineAbleiten, loesen, abgeleiteteId, meilensteinId } from '@/lib/planung/kaskade';
import type { Ziel, ZieleDatei, Meilenstein } from '@/lib/planung/typen';

const jahrZiel = (p: Partial<Ziel> = {}): Ziel => ({ id: 'z-neukunden', titel: 'Neukunden gewinnen', fortschritt: 10, space: 'business', einheit: 'Kunden', zielwert: 120, ...p });

describe('Anteile', () => {
  it('120 im Jahr sind 30 je Quartal, 10 je Monat, rund 2 je Woche mit Rest 16', () => {
    expect(anteil(120, teile('quartal', 2026))).toEqual({ genau: 30, gerundet: 30, rest: 0 });
    expect(anteil(120, teile('monat', 2026))).toEqual({ genau: 10, gerundet: 10, rest: 0 });
    const w = anteil(120, teile('woche', 2026));
    expect(w.gerundet).toBe(2);
    expect(w.rest).toBe(16);
  });
  it('unter 1 wird mit einer Nachkommastelle gerechnet — nicht auf 0', () => {
    const t = anteil(120, teile('tag', 2026));
    expect(t.gerundet).toBe(0.3);
    expect(t.rest).toBeCloseTo(120 - 0.3 * 365, 1);
  });
  it('Schaltjahr hat 366 Tage', () => {
    expect(teile('tag', 2028)).toBe(366);
    expect(teile('tag', 2026)).toBe(365);
  });
  it('Aufrunden ergibt einen Puffer statt Rest', () => {
    const q = anteil(10, 4); // 2,5 → 3 je Quartal → 12 im Jahr → Puffer 2
    expect(q.gerundet).toBe(3);
    expect(q.rest).toBe(-2);
  });
});

describe('Titel des Abgeleiteten', () => {
  it('nennt Elternziel, Anteil und Rest', () => {
    expect(abgeleiteterTitel(jahrZiel(), 'quartal', 2026)).toBe('Neukunden gewinnen · 30 im Quartal');
    expect(abgeleiteterTitel(jahrZiel(), 'woche', 2026)).toBe('Neukunden gewinnen · 2 je Woche (Rest 16 im Jahr)');
    expect(abgeleiteterTitel(jahrZiel(), 'tag', 2026)).toMatch(/^Neukunden gewinnen · 0,3 je Tag \(Rest/);
    expect(abgeleiteterTitel(jahrZiel({ zielwert: 10 }), 'quartal', 2026)).toBe('Neukunden gewinnen · 3 im Quartal (Puffer 2)');
  });
});

describe('Ebene ableiten', () => {
  it('legt je Zahlenziel genau ein abgeleitetes Ziel an — mit Space und Einheit des Elternteils', () => {
    const q = ebeneAbleiten([jahrZiel(), { id: 'z-ohne', titel: 'Ohne Zahl', fortschritt: 0 }], [], 'quartal', 2026);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ id: abgeleiteteId('z-neukunden', 'quartal'), abgeleitetVon: 'z-neukunden', space: 'business', einheit: 'Kunden', zielwert: 30, fortschritt: 0 });
  });
  it('dupliziert nicht: zweimal ableiten ergibt dieselbe Liste, Fortschritt und Rang bleiben', () => {
    const erst = ebeneAbleiten([jahrZiel()], [], 'quartal', 2026);
    const gepflegt = erst.map(z => ({ ...z, fortschritt: 40, rang: 3 }));
    const zweit = ebeneAbleiten([jahrZiel()], gepflegt, 'quartal', 2026);
    expect(zweit).toHaveLength(1);
    expect(zweit[0]).toMatchObject({ id: erst[0].id, fortschritt: 40, rang: 3 });
  });
  it('rechnet neu, wenn sich das Jahresziel ändert', () => {
    const erst = ebeneAbleiten([jahrZiel()], [], 'quartal', 2026);
    const zweit = ebeneAbleiten([jahrZiel({ zielwert: 200, titel: 'Neukunden' })], erst, 'quartal', 2026);
    expect(zweit[0].titel).toBe('Neukunden · 50 im Quartal');
    expect(zweit[0].zielwert).toBe(50);
  });
  it('eigene Ziele auf der Ebene bleiben unangetastet', () => {
    const eigen: Ziel = { id: 'q-eigen', titel: 'Website live', fortschritt: 50, rang: 1 };
    const q = ebeneAbleiten([jahrZiel()], [eigen], 'quartal', 2026);
    expect(q.map(z => z.id)).toEqual(['q-eigen', abgeleiteteId('z-neukunden', 'quartal')]);
  });
  it('Angepasstes wird nicht neu gerechnet und nicht doppelt angelegt', () => {
    const erst = ebeneAbleiten([jahrZiel()], [], 'quartal', 2026);
    const angepasst = [{ ...erst[0], titel: 'Mein eigener Text', angepasst: true }];
    const zweit = ebeneAbleiten([jahrZiel({ zielwert: 400 })], angepasst, 'quartal', 2026);
    expect(zweit).toHaveLength(1);
    expect(zweit[0].titel).toBe('Mein eigener Text');
    expect(zweit[0].angepasst).toBe(true);
  });
  it('fällt das Jahresziel weg, verschwindet das Abgeleitete — Angepasstes wird eigen', () => {
    const erst = ebeneAbleiten([jahrZiel()], [], 'quartal', 2026);
    expect(ebeneAbleiten([], erst, 'quartal', 2026)).toEqual([]);
    const angepasst = [{ ...erst[0], angepasst: true }];
    const nachher = ebeneAbleiten([], angepasst, 'quartal', 2026);
    expect(nachher).toHaveLength(1);
    expect(nachher[0].abgeleitetVon).toBeUndefined();
    expect(nachher[0].angepasst).toBeUndefined();
  });
  it('lösen macht ein abgeleitetes Ziel zu einem eigenen', () => {
    const z = loesen({ id: 'x', titel: 'T', fortschritt: 0, abgeleitetVon: 'j', angepasst: true });
    expect(z).toEqual({ id: 'x', titel: 'T', fortschritt: 0 });
  });
});

describe('Ganze Datei', () => {
  it('zieht alle vier Unterebenen nach und lässt Jahr und Fokus in Ruhe', () => {
    const datei: ZieleDatei = { jahr: [jahrZiel()], quartal: [], monat: [], woche: [], tag: [], fokus: { jahr: 'Wachsen' } };
    const aus = kaskadeAnwenden(datei, 2026);
    expect(aus.jahr).toEqual(datei.jahr);
    expect(aus.fokus).toEqual({ jahr: 'Wachsen' });
    expect(aus.quartal[0].zielwert).toBe(30);
    expect(aus.monat[0].zielwert).toBe(10);
    expect(aus.woche[0].zielwert).toBe(2);
    expect(aus.tag[0].zielwert).toBe(0.3);
  });
});

describe('Termin-Ziele als Meilensteine', () => {
  const termin = (p: Partial<Ziel> = {}): Ziel => ({ id: 'z-gmbh', titel: 'GmbH gegründet', fortschritt: 20, space: 'business', einheit: 'KD Ventures', termin: '2026-11-15', ...p });
  const bestand: Meilenstein[] = [{ id: 'ms-alt', titel: 'Bestehender', bereich: 'business', fortschritt: 0, erledigt: false }];

  it('legt je Termin-Ziel einen Meilenstein mit dem Termin als Fälligkeit an', () => {
    const ms = meilensteineAbleiten([termin(), jahrZiel()], bestand);
    expect(ms).toHaveLength(2);
    const neu = ms.find(m => m.id === meilensteinId('z-gmbh'))!;
    expect(neu).toMatchObject({ titel: 'GmbH gegründet', bereich: 'business', faellig: '2026-11-15', einheit: 'KD Ventures', abgeleitetVon: 'z-gmbh', erledigt: false });
  });
  it('privat wird Gesundheit', () => {
    const ms = meilensteineAbleiten([termin({ space: 'privat', einheit: undefined })], []);
    expect(ms[0].bereich).toBe('gesundheit');
    expect(ms[0].einheit).toBeUndefined();
  });
  it('dupliziert nicht und zieht Termin und Titel nach, Fortschritt bleibt', () => {
    const erst = meilensteineAbleiten([termin()], bestand);
    const gepflegt = erst.map(m => (m.abgeleitetVon ? { ...m, fortschritt: 70 } : m));
    const zweit = meilensteineAbleiten([termin({ termin: '2026-12-01', titel: 'GmbH steht' })], gepflegt);
    expect(zweit).toHaveLength(2);
    const m = zweit.find(x => x.abgeleitetVon === 'z-gmbh')!;
    expect(m).toMatchObject({ faellig: '2026-12-01', titel: 'GmbH steht', fortschritt: 70 });
  });
  it('ein erledigtes Ziel erledigt seinen Meilenstein', () => {
    const ms = meilensteineAbleiten([termin({ erledigt: true, erledigtAm: '2026-11-10' })], []);
    expect(ms[0]).toMatchObject({ erledigt: true, fortschritt: 100, erledigtAm: '2026-11-10' });
  });
  it('verwaiste Abgeleitete fallen weg, Angepasste bleiben als eigene', () => {
    const erst = meilensteineAbleiten([termin()], bestand);
    expect(meilensteineAbleiten([], erst).map(m => m.id)).toEqual(['ms-alt']);
    const angepasst = erst.map(m => (m.abgeleitetVon ? { ...m, angepasst: true } : m));
    const nachher = meilensteineAbleiten([], angepasst);
    expect(nachher).toHaveLength(2);
    expect(nachher.find(m => m.id === meilensteinId('z-gmbh'))?.abgeleitetVon).toBeUndefined();
  });
});
