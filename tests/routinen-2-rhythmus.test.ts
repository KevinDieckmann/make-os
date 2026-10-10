// ─── Routinen 2 (10.10.) — die eine Rechenstelle: Regeln, Fälligkeit, Pause, Zeitraum, Zähler, Streak/Quote ──────────────────────
// (1) Altbestand: dieselbe Fälligkeit wie der alte Code (wörtlich in tests/fixtures/routinen-vor-10-10.ts) und dieselben Bytes aus der
//     Säuberung — auf der Live-Instanz stehen gerade echte Routinen. (2) Die neuen Regeln rechnen über die Wiederholung der Aufgaben.
import { describe, expect, it } from 'vitest';
import {
  faelligkeit, regelSaeubern, regelVon, rhythmusAusRegel, routineStatistik, tagesZielVon, termineIm, naechstesMalNachRegel,
  regelKurz, regelText, routineRhythmusKurz,
} from '@/lib/planung/rhythmus';
import { sauberRoutine, routineBelegt, heuteFaellig, heuteIst, routineGrenzenFehler } from '@/lib/planung/routinen';
import { tagePlus } from '@/lib/planung/zeitraum';
import { faelligkeitAlt, sauberRoutineAlt } from './fixtures/routinen-vor-10-10';
import type { Rhythmus, Routine, RoutineRegel } from '@/lib/planung/typen';
import { nterImMonat, schritt, wiederholungText } from '@/lib/aufgaben/wiederholung';

const basis = { id: 'r-x', label: 'X', wann: 'morgen' as const, kategorie: 'leben' as const, dauerMin: 15, aktiv: true };

describe('Altbestand rechnet genau wie vorher', () => {
  const rhythmen: (Rhythmus | undefined)[] = [undefined, 'taeglich', '3x-woche', 'woechentlich', 'monatlich', 'quartal', 'halbjahr', 'jaehrlich'];
  const anker: (string | undefined)[] = [undefined, '2026-09-15', '2026-10-15', 'kaputt'];
  const muster: string[][] = [[], ['2026-09-28'], ['2026-09-28', '2026-09-29', '2026-09-30'], ['2026-08-31'], ['2026-01-31', '2026-07-15'], ['2025-10-01', '2026-10-16'], ['2026-09-01', '2026-09-08', '2026-09-30', '2026-10-02']];
  const tage = Array.from({ length: 75 }, (_, i) => tagePlus('2026-09-01', i));

  it('Fälligkeit je Rhythmus × „nächstes Mal“ × Haken × 75 Tage — gleich', () => {
    let n = 0;
    for (const rhythmus of rhythmen) for (const naechstesMal of anker) for (const erledigt of muster) for (const heute of tage) {
      const neu = faelligkeit({ rhythmus, naechstesMal }, erledigt, heute);
      const alt = faelligkeitAlt({ rhythmus, naechstesMal }, erledigt, heute);
      expect({ faellig: neu.faellig, naechstes: neu.naechstes, ueberfaellig: neu.ueberfaellig, ...(neu.dieseWoche !== undefined ? { dieseWoche: neu.dieseWoche } : {}) }, `${rhythmus}/${naechstesMal}/${erledigt}/${heute}`).toEqual(alt);
      n++;
    }
    expect(n).toBe(8 * 4 * 7 * 75);
  });

  it('Säuberung: der Altbestand kommt Byte für Byte so heraus wie mit dem alten Code (und wie er gespeichert ist)', () => {
    const alteFormen: Record<string, unknown>[] = [
      { id: 'journal', label: 'Journal', wann: 'morgen', kategorie: 'gesundheit', dauerMin: 15, aktiv: true },
      { id: 'r-1', label: 'Steuererklärung', wann: 'tag', kategorie: 'business', dauerMin: 60, aktiv: true, space: 'business', owner: 'pia', rhythmus: 'jaehrlich', naechstesMal: '2027-05-31', rang: 2, einheit: 'Einheit A' },
      { id: 'r-2', label: 'Sport', wann: 'abend', kategorie: 'gesundheit', dauerMin: 45, aktiv: true, owner: 'beide', rhythmus: '3x-woche', rang: 1 },
      { id: 'r-3', label: 'Erholung', wann: 'abend', kategorie: 'erholung', dauerMin: 20, aktiv: false, space: 'privat', owner: 'olaf', rhythmus: 'woechentlich', naechstesMal: '2026-10-12' },
      { id: 'r-4', label: 'Vorsorge', wann: 'tag', kategorie: 'gesundheit', dauerMin: 120, aktiv: true, rhythmus: 'halbjahr', naechstesMal: '2026-11-01' },
      { id: 'r-5', label: 'Quartal', wann: 'tag', kategorie: 'leben', dauerMin: 30, aktiv: true, rhythmus: 'quartal' },
      { id: 'r-6', label: 'Monat', wann: 'morgen', kategorie: 'leben', dauerMin: 10, aktiv: true, rhythmus: 'monatlich', naechstesMal: '2026-10-30', rang: 7 },
    ];
    for (const r of alteFormen) {
      const alt = sauberRoutineAlt(r);
      expect(JSON.stringify(sauberRoutine(r)), String(r.id)).toBe(JSON.stringify(alt));
      // Gespeichert ist die gesäuberte Form — sie bleibt beim nächsten Schreiben unverändert (kein stilles Umschreiben).
      expect(JSON.stringify(sauberRoutine(alt)), String(r.id)).toBe(JSON.stringify(alt));
    }
    // Auch Unsinn wird wie vorher behandelt (Rhythmus unbekannt, „nächstes Mal“ bei 3×/Woche).
    for (const r of [{ ...basis, rhythmus: 'alle-zwei-tage', naechstesMal: 'morgen' }, { ...basis, rhythmus: '3x-woche', naechstesMal: '2026-10-01' }, { ...basis, dauerMin: 999, rang: -3 }]) {
      expect(JSON.stringify(sauberRoutine(r))).toBe(JSON.stringify(sauberRoutineAlt(r)));
    }
  });

  it('heuteFaellig ohne neue Felder: dieselbe Liste wie vorher, Zähler 0/1', () => {
    const r: Routine = { ...basis, rhythmus: '3x-woche' };
    const l = heuteFaellig([r], 'pia', { '2026-09-28': ['r-x'] }, '2026-09-30');
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ heuteErledigt: false, ziel: 1, ist: 0, f: { faellig: true, dieseWoche: 1 } });
  });
});

describe('Regel: prüfen, kürzeste Form, alte Form wo möglich', () => {
  it('lässt sich die Regel als alter Rhythmus schreiben, steht der alte im Bestand (ohne `regel`)', () => {
    expect(sauberRoutine({ ...basis, regel: { art: 'intervall', alle: 1, einheit: 'woche' } })).toEqual({ ...basis, rhythmus: 'woechentlich' });
    expect(sauberRoutine({ ...basis, regel: { art: 'pro-woche', anzahl: 3 } })).toEqual({ ...basis, rhythmus: '3x-woche' });
    expect(sauberRoutine({ ...basis, regel: { art: 'monatlich' } })).toEqual({ ...basis, rhythmus: 'monatlich' });
    expect(sauberRoutine({ ...basis, regel: { art: 'intervall', alle: 3, einheit: 'monat' }, naechstesMal: '2026-12-01' })).toEqual({ ...basis, rhythmus: 'quartal', naechstesMal: '2026-12-01' });
    expect(sauberRoutine({ ...basis, regel: { art: 'taeglich' }, rhythmus: 'jaehrlich' })).toEqual(basis);
    expect(sauberRoutine({ ...basis, regel: { art: 'wochentage', tage: [1, 2, 3, 4, 5, 6, 7] } })).toEqual(basis);
    expect(sauberRoutine({ ...basis, regel: { art: 'intervall', alle: 1 } })).toEqual(basis);
  });
  it('sonst `regel` — angehängt hinter den alten Feldern, Vorgaben weggelassen, Unsinn → alter Rhythmus', () => {
    const r = sauberRoutine({ ...basis, rhythmus: 'woechentlich', regel: { art: 'wochentage', tage: [4, 1, 1, 9], alle: 1 }, rang: 3 })!;
    expect(Object.keys(r)).toEqual(['id', 'label', 'wann', 'kategorie', 'dauerMin', 'aktiv', 'rang', 'regel']);
    expect(r.regel).toEqual({ art: 'wochentage', tage: [1, 4] });
    expect(r.rhythmus).toBeUndefined();
    expect(regelSaeubern({ art: 'pro-woche', anzahl: 9 })).toBeNull();
    expect(regelSaeubern({ art: 'gibt-es-nicht' })).toBeNull();
    expect(sauberRoutine({ ...basis, rhythmus: 'monatlich', regel: { art: 'pro-woche', anzahl: 0 } })!.rhythmus).toBe('monatlich');
    expect(regelSaeubern({ art: 'wochentage', tage: [1], alle: 2, start: '2026-10-05' })).toEqual({ art: 'wochentage', tage: [1], alle: 2, start: '2026-10-05' });
    expect(regelSaeubern({ art: 'wochentage', tage: [1], start: '2026-10-05' })).toEqual({ art: 'wochentage', tage: [1] });
    expect(regelSaeubern({ art: 'monatlich', nter: { n: -1, tag: 5 }, monatstag: 3 })).toEqual({ art: 'monatlich', nter: { n: -1, tag: 5 } });
    expect(regelSaeubern({ art: 'intervall', alle: 400 })).toBeNull();
    expect(rhythmusAusRegel({ art: 'intervall', alle: 7 })).toBeNull(); // „alle 7 Tage“ bleibt, wie gewählt
  });
  it('„nächstes Mal am“ nur, wo ab dem letzten Mal gerechnet wird', () => {
    expect(sauberRoutine({ ...basis, regel: { art: 'intervall', alle: 10 }, naechstesMal: '2026-10-20' })).toMatchObject({ regel: { art: 'intervall', alle: 10 }, naechstesMal: '2026-10-20' });
    expect(sauberRoutine({ ...basis, regel: { art: 'wochentage', tage: [2] }, naechstesMal: '2026-10-20' })).not.toHaveProperty('naechstesMal');
  });
  it('die neuen Felder: nur Gültiges, in fester Reihenfolge; Kalender-Block nur an der Routine einer Person', () => {
    const r = sauberRoutine({
      ...basis, owner: 'pia', kalender: true, erinnerung: true, zielId: 'z-1~monat', angelegtAm: '2026-10-10', tagesZiel: 8, zaehlWort: '  Gläser ',
      uhrzeiten: ['20:00', '08:00', '08:00', '25:00'], zeitraum: { von: '2026-10-01', bis: '2026-12-31' },
      pausen: [{ von: '2026-11-02', bis: '2026-11-06', grund: 'krank' }, { von: '2026-10-20', bis: '2026-10-18' }, { von: '2026-10-12', bis: '2026-10-16', grund: 'quatsch' }],
    })!;
    expect(Object.keys(r).slice(6)).toEqual(['owner', 'tagesZiel', 'zaehlWort', 'uhrzeiten', 'zeitraum', 'pausen', 'zielId', 'erinnerung', 'kalender', 'angelegtAm']);
    expect(r).toMatchObject({ tagesZiel: 8, zaehlWort: 'Gläser', uhrzeiten: ['08:00', '20:00'], pausen: [{ von: '2026-10-12', bis: '2026-10-16' }, { von: '2026-11-02', bis: '2026-11-06', grund: 'krank' }] });
    expect(sauberRoutine({ ...basis, kalender: true })).not.toHaveProperty('kalender');
    expect(sauberRoutine({ ...basis, tagesZiel: 1, zeitraum: { von: '2026-12-01', bis: '2026-11-01' } })).toEqual(basis);
  });
  it('über den Grenzen: Ablehnung mit Satz statt Kürzen', () => {
    expect(routineGrenzenFehler({ uhrzeiten: Array.from({ length: 13 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`) })).toMatch(/höchstens 12 Uhrzeiten/);
    expect(routineGrenzenFehler({ pausen: Array.from({ length: 21 }, () => ({ von: '2026-10-01', bis: '2026-10-02' })) })).toMatch(/höchstens 20 Pausen/);
    expect(routineGrenzenFehler({ tagesZiel: 51 })).toMatch(/bis 50/);
    expect(routineGrenzenFehler({ tagesZiel: 8, uhrzeiten: ['08:00'] })).toBeNull();
  });
});

describe('Fälligkeit der neuen Regeln (über die Wiederholung der Aufgaben)', () => {
  const r = (regel: RoutineRegel, extra: Partial<Routine> = {}): Partial<Routine> & Pick<Routine, 'rhythmus' | 'naechstesMal'> => ({ regel, ...extra });

  it('feste Wochentage (Mo, Do): nur an diesen Tagen, ohne Nachholen', () => {
    const g: RoutineRegel = { art: 'wochentage', tage: [1, 4] };
    expect(faelligkeit(r(g), [], '2026-10-08')).toMatchObject({ faellig: true, naechstes: '2026-10-08' }); // Do
    expect(faelligkeit(r(g), [], '2026-10-07')).toMatchObject({ faellig: false, naechstes: '2026-10-08', ueberfaellig: false }); // Mi
    expect(faelligkeit(r(g), ['2026-10-08'], '2026-10-08')).toMatchObject({ faellig: false, naechstes: '2026-10-12' });
    expect(faelligkeit(r(g), [], '2026-10-09')).toMatchObject({ faellig: false, naechstes: '2026-10-12' }); // Do verpasst → kein „überfällig“
  });
  it('alle 2 Wochen montags ab dem 05.10.', () => {
    const g: RoutineRegel = { art: 'wochentage', tage: [1], alle: 2, start: '2026-10-05' };
    expect(termineIm(g, '2026-09-01', '2026-11-10')).toEqual(['2026-10-05', '2026-10-19', '2026-11-02']);
    expect(faelligkeit(r(g), [], '2026-10-12').faellig).toBe(false);
    expect(faelligkeit(r(g), [], '2026-10-12').naechstes).toBe('2026-10-19');
    // Ein Jahr später stimmt der Takt noch (schneller Vorlauf vom Anker).
    expect(termineIm(g, '2027-10-01', '2027-10-31')).toEqual(['2027-10-04', '2027-10-18']);
  });
  it('Werktage: Mo–Fr ohne Feiertage', () => {
    const g: RoutineRegel = { art: 'werktage' };
    expect(faelligkeit(r(g), [], '2026-12-24').faellig).toBe(true);
    expect(faelligkeit(r(g), [], '2026-12-25')).toMatchObject({ faellig: false, naechstes: '2026-12-28' }); // 1. Weihnachtstag (Fr)
    expect(faelligkeit(r(g), [], '2026-10-10')).toMatchObject({ faellig: false, naechstes: '2026-10-12' }); // Samstag
  });
  it('x-mal pro Woche (2×): zählt die Woche, egal an welchem Tag', () => {
    const g: RoutineRegel = { art: 'pro-woche', anzahl: 2 };
    expect(faelligkeit(r(g), ['2026-10-05'], '2026-10-07')).toMatchObject({ faellig: true, dieseWoche: 1, proWoche: 2 });
    expect(faelligkeit(r(g), ['2026-10-05', '2026-10-06'], '2026-10-07')).toMatchObject({ faellig: false, naechstes: '2026-10-12', dieseWoche: 2 });
  });
  it('alle 3 Tage ab dem letzten Mal, mit „überfällig“', () => {
    const g: RoutineRegel = { art: 'intervall', alle: 3 };
    expect(faelligkeit(r(g), ['2026-10-05'], '2026-10-07')).toMatchObject({ faellig: false, naechstes: '2026-10-08' });
    expect(faelligkeit(r(g), ['2026-10-05'], '2026-10-09')).toMatchObject({ faellig: true, ueberfaellig: true, naechstes: '2026-10-08' });
    expect(naechstesMalNachRegel(g, '2026-10-05')).toBe('2026-10-08');
  });
  it('monatlich am 15.: ab dem Tag dran bis erledigt, höchstens bis zum nächsten Termin', () => {
    const g: RoutineRegel = { art: 'monatlich', monatstag: 15 };
    const a = { angelegtAm: '2026-10-01' };
    expect(faelligkeit(r(g, a), [], '2026-10-14')).toMatchObject({ faellig: false, naechstes: '2026-10-15' });
    expect(faelligkeit(r(g, a), [], '2026-10-15')).toMatchObject({ faellig: true, ueberfaellig: false });
    expect(faelligkeit(r(g, a), [], '2026-10-20')).toMatchObject({ faellig: true, ueberfaellig: true, naechstes: '2026-10-15' });
    expect(faelligkeit(r(g, a), ['2026-10-16'], '2026-10-20')).toMatchObject({ faellig: false, naechstes: '2026-11-15' });
    // Oktober nie erledigt — im November zählt nur der November-Termin (kein Stapel).
    expect(faelligkeit(r(g, a), [], '2026-11-16')).toMatchObject({ faellig: true, naechstes: '2026-11-15' });
    // Vor dem Anlegen verpasst zählt nicht: angelegt am 20.10. → erst der 15.11. Ohne „angelegt am“ gilt der letzte Termin.
    expect(faelligkeit(r(g, { angelegtAm: '2026-10-20' }), [], '2026-10-21')).toMatchObject({ faellig: false, naechstes: '2026-11-15' });
    expect(faelligkeit(r(g), [], '2026-10-14')).toMatchObject({ faellig: true, ueberfaellig: true, naechstes: '2026-09-15' });
  });
  it('am 31. → Monatsende; alle 3 Monate am 1. ab Oktober', () => {
    expect(termineIm({ art: 'monatlich', monatstag: 31 }, '2027-01-15', '2027-03-31')).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
    const q: RoutineRegel = { art: 'monatlich', monatstag: 1, alle: 3, start: '2026-10-01' };
    expect(termineIm(q, '2026-09-01', '2027-07-15')).toEqual(['2026-10-01', '2027-01-01', '2027-04-01', '2027-07-01']);
    expect(faelligkeit(r(q), ['2026-10-01'], '2026-11-01')).toMatchObject({ faellig: false, naechstes: '2027-01-01' });
  });
  it('n-ter Wochentag: 1. Montag, letzter Freitag — eine Erweiterung der Wiederholung der Aufgaben', () => {
    expect(nterImMonat(2026, 11, 1, 1)).toBe('2026-11-02');
    expect(nterImMonat(2026, 10, -1, 5)).toBe('2026-10-30');
    expect(nterImMonat(2026, 10, 5, 4)).toBe('2026-10-29'); // keinen 5. Donnerstag? — doch, 29.10.
    expect(termineIm({ art: 'monatlich', nter: { n: 1, tag: 1 } }, '2026-10-01', '2026-12-31')).toEqual(['2026-10-05', '2026-11-02', '2026-12-07']);
    expect(termineIm({ art: 'monatlich', nter: { n: -1, tag: 5 } }, '2026-10-01', '2026-11-30')).toEqual(['2026-10-30', '2026-11-27']);
    expect(schritt({ regel: 'monatlich', nter: { n: 2, wochentag: 2 } }, '2026-10-13')).toBe('2026-11-10');
    expect(wiederholungText({ regel: 'monatlich', nter: { n: -1, wochentag: 5 } })).toBe('monatlich am letzten Freitag');
    // Aufgaben ohne `nter` rechnen unverändert.
    expect(schritt({ regel: 'monatlich', monatstag: 31 }, '2026-01-31')).toBe('2026-02-28');
  });
  it('Pause: nicht dran, „nächstes“ nach der Pause', () => {
    const p = [{ von: '2026-10-05', bis: '2026-10-09', grund: 'urlaub' as const }];
    expect(faelligkeit(r({ art: 'taeglich' }, { pausen: p }), [], '2026-10-07')).toMatchObject({ faellig: false, pausiert: true, naechstes: '2026-10-10' });
    expect(faelligkeit(r({ art: 'wochentage', tage: [1, 4] }, { pausen: p }), [], '2026-10-06')).toMatchObject({ faellig: false, naechstes: '2026-10-12' });
    expect(faelligkeit({ rhythmus: 'woechentlich', pausen: p }, ['2026-09-20'], '2026-10-07')).toMatchObject({ faellig: false, pausiert: true, naechstes: '2026-10-10' });
    expect(faelligkeit({ rhythmus: 'woechentlich', pausen: p }, ['2026-09-20'], '2026-10-10')).toMatchObject({ faellig: true, ueberfaellig: true });
    // Ein Monatstermin in der Pause wird danach nachgeholt; x-mal pro Woche zeigt den Stand DIESER Woche.
    expect(faelligkeit(r({ art: 'monatlich', monatstag: 15 }, { angelegtAm: '2026-10-01', pausen: [{ von: '2026-10-14', bis: '2026-10-18' }] }), [], '2026-10-16')).toMatchObject({ faellig: false, pausiert: true, naechstes: '2026-10-19' });
    expect(faelligkeit(r({ art: 'pro-woche', anzahl: 3 }, { pausen: p }), ['2026-10-05'], '2026-10-07')).toMatchObject({ pausiert: true, dieseWoche: 1, proWoche: 3, naechstes: '2026-10-10' });
  });
  it('Zeitraum: vorher / nachher nicht dran', () => {
    expect(faelligkeit(r({ art: 'taeglich' }, { zeitraum: { bis: '2026-10-01' } }), [], '2026-10-05')).toMatchObject({ faellig: false, ausserhalb: 'nachher' });
    expect(faelligkeit(r({ art: 'taeglich' }, { zeitraum: { von: '2026-10-20' } }), [], '2026-10-05')).toMatchObject({ faellig: false, ausserhalb: 'vorher', naechstes: '2026-10-20' });
    expect(faelligkeit(r({ art: 'wochentage', tage: [1] }, { zeitraum: { von: '2026-10-20' } }), [], '2026-10-05').naechstes).toBe('2026-10-26');
  });
  it('regelVon liest `regel` vor dem alten Rhythmus', () => {
    expect(regelVon({ rhythmus: 'quartal' })).toEqual({ art: 'intervall', alle: 3, einheit: 'monat' });
    expect(regelVon({ rhythmus: 'monatlich', regel: { art: 'werktage' } })).toEqual({ art: 'werktage' });
    expect(regelVon({})).toEqual({ art: 'taeglich' });
  });
});

describe('Zähler und mehrmals täglich', () => {
  it('Tagesziel: Uhrzeiten zählen mit, sonst das Ziel, sonst 1', () => {
    expect(tagesZielVon({ uhrzeiten: ['08:00', '20:00'] })).toBe(2);
    expect(tagesZielVon({ tagesZiel: 8, uhrzeiten: ['09:00'] })).toBe(8);
    expect(tagesZielVon({ tagesZiel: 2, uhrzeiten: ['07:00', '12:00', '19:00'] })).toBe(3);
    expect(tagesZielVon({})).toBe(1);
  });
  it('heuteIst: Zähler, alter Haken = voll, nichts = 0', () => {
    const z = { '2026-10-10': { 'r-x': 5 } };
    expect(heuteIst({ id: 'r-x', tagesZiel: 8 }, false, z, '2026-10-10')).toBe(5);
    expect(heuteIst({ id: 'r-x', tagesZiel: 8 }, true, null, '2026-10-10')).toBe(8);
    expect(heuteIst({ id: 'r-x', tagesZiel: 8 }, true, { '2026-10-10': { 'r-x': 9 } }, '2026-10-10')).toBe(9);
    expect(heuteIst({ id: 'r-x' }, false, null, '2026-10-10')).toBe(0);
  });
  it('heuteFaellig: „5 von 8“, der Haken erst mit erreichtem Ziel', () => {
    const trinken: Routine = { ...basis, id: 'trinken', tagesZiel: 8, zaehlWort: 'Gläser' };
    const l = heuteFaellig([trinken], 'pia', {}, '2026-10-10', 'alle', { '2026-10-10': { trinken: 5 } });
    expect(l[0]).toMatchObject({ ziel: 8, ist: 5, heuteErledigt: false, f: { faellig: true } });
    const voll = heuteFaellig([trinken], 'pia', { '2026-10-10': ['trinken'] }, '2026-10-10', 'alle', { '2026-10-10': { trinken: 8 } });
    expect(voll[0]).toMatchObject({ ist: 8, heuteErledigt: true });
  });
  it('Anzeige: Regel, Ziel, Uhrzeiten', () => {
    expect(routineRhythmusKurz({ tagesZiel: 8, zaehlWort: 'Gläser' })).toBe('8 Gläser');
    expect(routineRhythmusKurz({ uhrzeiten: ['08:00', '20:00'] })).toBe('2× täglich · 08:00 · 20:00');
    expect(routineRhythmusKurz({ regel: { art: 'wochentage', tage: [1, 3, 5] } })).toBe('Mo · Mi · Fr');
    expect(routineRhythmusKurz({ rhythmus: '3x-woche' })).toBe('3×/Woche');
    expect(routineRhythmusKurz({})).toBe('');
    expect(regelKurz({ art: 'monatlich', nter: { n: 1, tag: 1 } })).toBe('1. Mo im Monat');
    expect(regelText({ art: 'wochentage', tage: [1, 4] })).toBe('jeden Montag und Donnerstag');
    expect(regelText({ art: 'intervall', alle: 3 })).toBe('alle 3 Tage, gerechnet ab dem letzten Mal');
  });
});

describe('Streak und Erfüllungsquote — je Regel gerecht, Pause ohne Verlust', () => {
  const tageVon = (von: string, bis: string, ohne: string[] = []) => { const l: string[] = []; for (let d = von; d <= bis; d = tagePlus(d, 1)) if (!ohne.includes(d)) l.push(d); return l; };

  it('täglich: Streak in Tagen, heute zählt erst erledigt', () => {
    const e = tageVon('2026-10-01', '2026-10-09', ['2026-10-04']);
    const s = routineStatistik({ angelegtAm: '2026-10-01' }, e, '2026-10-10');
    expect(s).toMatchObject({ streak: 5, einheit: 'tag', erfuellt: 8, soll: 9 });
    expect(routineStatistik({ angelegtAm: '2026-10-01' }, [...e, '2026-10-10'], '2026-10-10').streak).toBe(6);
  });
  it('täglich mit Pause: der Pausentag reißt nichts und zählt nicht', () => {
    const e = tageVon('2026-10-01', '2026-10-09', ['2026-10-04']);
    const s = routineStatistik({ angelegtAm: '2026-10-01', pausen: [{ von: '2026-10-04', bis: '2026-10-04', grund: 'krank' }] }, e, '2026-10-10');
    expect(s).toMatchObject({ streak: 8, erfuellt: 8, soll: 8, quote: 1 });
  });
  it('feste Wochentage: nur Termin-Tage zählen', () => {
    const s = routineStatistik({ regel: { art: 'wochentage', tage: [1, 4] }, angelegtAm: '2026-09-28' }, ['2026-09-28', '2026-10-01', '2026-10-05', '2026-10-08'], '2026-10-10');
    expect(s).toMatchObject({ streak: 4, soll: 4, erfuellt: 4, quote: 1 });
  });
  it('x-mal pro Woche: die Woche zählt — laufende Woche erst, wenn erfüllt; Urlaub senkt das Wochenziel', () => {
    const g: RoutineRegel = { art: 'pro-woche', anzahl: 3 };
    const e = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-21', '2026-09-22', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-05'];
    expect(routineStatistik({ regel: g, angelegtAm: '2026-09-07' }, e, '2026-10-07')).toMatchObject({ streak: 1, einheit: 'woche', erfuellt: 11, soll: 12 });
    const mitUrlaub = routineStatistik({ regel: g, angelegtAm: '2026-09-07', pausen: [{ von: '2026-09-23', bis: '2026-09-27', grund: 'urlaub' }] }, e, '2026-10-07');
    // Urlaub Mi–So (09-23 … 09-27): die Woche 09-21 hat kein Soll mehr — sie zählt nicht und reißt nichts.
    expect(mitUrlaub).toMatchObject({ streak: 3, quote: 1, erfuellt: 9, soll: 9 });
  });
  it('monatlich am 15.: je Termin, der laufende zählt erst erledigt', () => {
    const s = routineStatistik({ regel: { art: 'monatlich', monatstag: 15 }, angelegtAm: '2026-06-01' }, ['2026-06-15', '2026-07-16', '2026-08-20', '2026-10-15'], '2026-10-20');
    expect(s).toMatchObject({ streak: 1, einheit: 'termin', erfuellt: 4, soll: 5 });
  });
  it('alle n …: rechtzeitig je Erledigung, überfällig = Streak 0', () => {
    const e = ['2026-09-01', '2026-09-08', '2026-09-14', '2026-09-25', '2026-10-01'];
    expect(routineStatistik({ rhythmus: 'woechentlich' }, e, '2026-10-05')).toMatchObject({ streak: 2, einheit: 'termin' });
    expect(routineStatistik({ rhythmus: 'woechentlich' }, e, '2026-10-12').streak).toBe(0);
    // Urlaub dazwischen verlängert die Frist.
    expect(routineStatistik({ rhythmus: 'woechentlich', pausen: [{ von: '2026-09-15', bis: '2026-09-24' }] }, e, '2026-10-05').streak).toBe(5);
  });
  it('ohne Haken und ohne „angelegt am“: nichts zu messen', () => {
    expect(routineStatistik({}, [], '2026-10-10')).toMatchObject({ quote: null, streak: 0 });
  });
});

describe('„Belegt“ für die andere Person: WANN ja, WAS nein', () => {
  it('Regel, Uhrzeiten, Zeitraum, Pausen ohne Grund — kein Zähler, kein Ziel, keine Erinnerung', () => {
    const r: Routine = { ...basis, owner: 'pia', regel: { art: 'wochentage', tage: [2] }, uhrzeiten: ['07:00'], tagesZiel: 3, zaehlWort: 'Tabletten', zielId: 'z-1', erinnerung: true, kalender: true, zeitraum: { von: '2026-10-01' }, pausen: [{ von: '2026-10-12', bis: '2026-10-14', grund: 'krank' }] };
    const b = routineBelegt(r);
    expect(b).toMatchObject({ label: 'Belegt', regel: { art: 'wochentage', tage: [2] }, uhrzeiten: ['07:00'], zeitraum: { von: '2026-10-01' }, pausen: [{ von: '2026-10-12', bis: '2026-10-14' }], belegt: true });
    expect(JSON.stringify(b)).not.toMatch(/Tabletten|krank|z-1|"tagesZiel"|"erinnerung"|"kalender"/);
  });
});
