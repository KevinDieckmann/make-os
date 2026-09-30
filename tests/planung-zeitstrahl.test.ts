// ─── Zeitstrahl, Planungsjahr, Forecast (30.09.) ────────────────────────────
// Kevin: „bis Ende nächsten Jahres gucken und planen“ + „einzeln nach vorne und
// hinten scrollen“. Rein gerechnet (lib/planung/zeitstrahl.ts, jahr-fokus.ts):
// Fenster über den Jahreswechsel, 29.02., Standard „bis Ende nächsten Jahres“,
// Grenzen der Adresse, Heute-Sprung, Jahr-Ableitung, Filter, Forecast, Stapeln.

import { describe, expect, it } from 'vitest';
import {
  abAus, anteilIm, beginntText, bisBeginn, blaettern, fenster, fensterMonate, heuteAb, heuteIm, jahrAus, jahrLage, letzterTag,
  meilensteinImJahr, meilensteinJahr, monatPlus, monatsTicks, planJahre, planTag, quartale, raumAus, raumSpanne, stapeln,
  standardAb, tagBeiAnteil, tagPlusMonate, zaehltImKurs, zielJahr, STRAHL_STANDARD,
} from '@/lib/planung/zeitstrahl';
import { fokusFuerLaufendesJahr, fokusImJahr, fokusSchreibSchluessel, istJahrFokusSchluessel } from '@/lib/planung/jahr-fokus';
import { jahrStempeln, sauberZiel } from '@/lib/planung/ziele';
import { sauberMeilenstein } from '@/lib/planung/meilensteine';
import { kaskadeAnwenden, meilensteineAbleiten } from '@/lib/planung/kaskade';
import type { Ziel, ZieleDatei } from '@/lib/planung/typen';

const HEUTE = '2026-09-30';

describe('Monate rechnen', () => {
  it('über den Jahreswechsel vor und zurück', () => {
    expect(monatPlus('2026-11', 3)).toBe('2027-02');
    expect(monatPlus('2026-01', -1)).toBe('2025-12');
    expect(monatPlus('2026-12', 1)).toBe('2027-01');
    expect(monatPlus('2026-03', -27)).toBe('2023-12');
  });
  it('29.02. — Monatsletzter im Schaltjahr, geklemmt beim Verschieben', () => {
    expect(letzterTag('2028-02')).toBe('2028-02-29');
    expect(letzterTag('2027-02')).toBe('2027-02-28');
    expect(tagPlusMonate('2028-02-29', 12)).toBe('2029-02-28');
    expect(tagPlusMonate('2026-08-31', 6)).toBe('2027-02-28');
  });
});

describe('Zeitraum-Wahl und Fenster', () => {
  it('Standard ist „bis Ende nächsten Jahres“: Januar dieses bis Dezember nächsten Jahres', () => {
    expect(STRAHL_STANDARD).toBe('bis-naechstes-jahr');
    const ab = standardAb(STRAHL_STANDARD, HEUTE, 24);
    const f = fenster(ab, 24);
    expect(f).toMatchObject({ von: '2026-01-01', bis: '2027-12-31', label: 'Jan 2026 – Dez 2027' });
  });
  it('„Dieses Jahr“ folgt dem Planungsjahr, „18 Monate“ beginnt im laufenden Monat', () => {
    expect(fenster(standardAb('jahr', HEUTE, 12), 12)).toMatchObject({ von: '2026-01-01', bis: '2026-12-31' });
    expect(fenster(standardAb('jahr', HEUTE, 12, 2027), 12)).toMatchObject({ von: '2027-01-01', bis: '2027-12-31' });
    expect(fenster(standardAb('18-monate', HEUTE, 18), 18)).toMatchObject({ von: '2026-09-01', bis: '2028-02-29' });
  });
  it('am 29.02. eines Schaltjahres', () => {
    const h = '2028-02-29';
    expect(fenster(standardAb('18-monate', h, 18), 18)).toMatchObject({ von: '2028-02-01', bis: '2029-07-31' });
    expect(fenster(standardAb('bis-naechstes-jahr', h, 24), 24)).toMatchObject({ von: '2028-01-01', bis: '2029-12-31' });
    expect(heuteIm(fenster(standardAb('bis-naechstes-jahr', h, 24), 24), h)).toBe(true);
  });
  it('am Handy weniger Monate — und das Fenster rückt so, dass HEUTE mit einem Monat davor sichtbar ist', () => {
    expect(fensterMonate('bis-naechstes-jahr', 300)).toBe(6);
    expect(fensterMonate('bis-naechstes-jahr', 1100)).toBe(24);
    expect(fensterMonate('jahr', 1100)).toBe(12);
    expect(fensterMonate('18-monate', 600)).toBe(15);
    expect(standardAb('bis-naechstes-jahr', HEUTE, 6)).toBe('2026-08');
    // „Dieses Jahr“ mit 6 Monaten: nie über Dezember hinaus — Juli bis Dezember enthält den September.
    expect(standardAb('jahr', HEUTE, 6)).toBe('2026-07');
    expect(standardAb('jahr', '2026-01-10', 6)).toBe('2026-01');
    // Planungsjahr 2027 auf dem Handy: dessen Januar (HEUTE liegt nicht darin).
    expect(standardAb('jahr', HEUTE, 6, 2027)).toBe('2027-01');
  });
  it('Blättern hat keine feste Grenze und geht über den Jahreswechsel', () => {
    let ab = standardAb('bis-naechstes-jahr', HEUTE, 24);
    ab = blaettern(ab, 1); expect(fenster(ab, 24)).toMatchObject({ von: '2026-02-01', bis: '2028-01-31' });
    ab = blaettern(ab, -3); expect(fenster(ab, 24).von).toBe('2025-11-01');
    ab = blaettern(ab, -120); expect(ab).toBe('2015-11');
    ab = blaettern(ab, 240); expect(ab).toBe('2035-11');
  });
  it('„Heute“ springt zurück in das Fenster mit HEUTE', () => {
    const weit = fenster(blaettern('2026-01', 40), 24);
    expect(heuteIm(weit, HEUTE)).toBe(false);
    const zurueck = fenster(heuteAb('bis-naechstes-jahr', HEUTE, 24), 24);
    expect(heuteIm(zurueck, HEUTE)).toBe(true);
    expect(zurueck.von).toBe('2026-01-01');
    // Auch wenn „Dieses Jahr“ gerade 2027 zeigt: Heute heißt das laufende Jahr.
    expect(heuteAb('jahr', HEUTE, 12)).toBe('2026-01');
    expect(heuteIm(fenster(heuteAb('18-monate', HEUTE, 6), 6), HEUTE)).toBe(true);
  });
  it('Grenzen der Adresse: nur echte Monate in ±50 Jahren, sonst Standard', () => {
    expect(abAus('2026-10', HEUTE)).toBe('2026-10');
    expect(abAus(' 2027-01 ', HEUTE)).toBe('2027-01');
    expect(abAus('2076-12', HEUTE)).toBe('2076-12');
    for (const kaputt of ['2026-13', '2026-00', '2077-01', '1975-12', '2026-1', 'abc', '', null, undefined, 202610]) expect(abAus(kaputt, HEUTE)).toBeNull();
    expect(raumAus('18-monate')).toBe('18-monate');
    expect(raumAus('alles')).toBeNull();
    expect(raumSpanne('jahr', HEUTE, 2027)).toEqual({ ab: '2027-01', monate: 12 });
  });
});

describe('Achse', () => {
  it('Monate mit Jahreswechsel: Januar trägt die Jahreszahl und die Trennlinie, der erste Monat das Startjahr', () => {
    const t = monatsTicks('2026-11-01', '2027-02-28');
    expect(t.map(x => x.label)).toEqual(['Nov', 'Dez', 'Jan', 'Feb']);
    // Start im November: die Jahreszahl stünde neben der des Januars — dort nur 2027.
    expect(t[0].jahr).toBeUndefined();
    expect(monatsTicks('2026-08-01', '2027-01-31')[0]).toMatchObject({ label: 'Aug', jahr: '2026' });
    expect(t[0].wechsel).toBeUndefined();
    expect(t[2]).toMatchObject({ date: '2027-01-01', jahr: '2027', wechsel: true });
    expect(t[1].jahr).toBeUndefined();
  });
  it('Quartale am Rand abgeschnitten', () => {
    const q = quartale('2026-08-01', '2027-01-31');
    expect(q.map(x => `${x.label} ${x.jahr}`)).toEqual(['Q3 2026', 'Q4 2026', 'Q1 2027']);
    expect(q[0]).toMatchObject({ von: '2026-08-01', bis: '2026-09-30' });
    expect(q[2]).toMatchObject({ von: '2027-01-01', bis: '2027-01-31' });
  });
  it('Klick-Stelle → Tag und zurück', () => {
    const von = '2026-01-01', bis = '2027-12-31';
    for (const tag of ['2026-01-01', '2026-09-30', '2027-02-28', '2027-12-31']) expect(tagBeiAnteil(von, bis, anteilIm(tag, von, bis))).toBe(tag);
    expect(tagBeiAnteil(von, bis, -1)).toBe(von);
    expect(tagBeiAnteil(von, bis, 2)).toBe(bis);
  });
});

describe('Planungsjahr: Ableitung und Filter', () => {
  it('Jahr eines Ziels: `jahr`, sonst Jahr der Frist, sonst das laufende', () => {
    expect(zielJahr({ jahr: 2027 }, 2026)).toBe(2027);
    expect(zielJahr({ termin: '2027-03-01' }, 2026)).toBe(2027);
    expect(zielJahr({}, 2026)).toBe(2026);
    expect(zielJahr({ jahr: 'x', termin: 'kaputt' }, 2026)).toBe(2026);
    expect(zielJahr({ jahr: 2027, termin: '2028-01-15' }, 2026)).toBe(2027);
  });
  it('Jahr eines Meilensteins aus Datum oder Zeitfenster; offene Überfällige stehen im laufenden Jahr', () => {
    expect(meilensteinJahr({ faellig: '2027-04-01' })).toBe(2027);
    expect(meilensteinJahr({ zeitfenster: 'Q3 2027' })).toBe(2027);
    expect(meilensteinJahr({ zeitfenster: 'Q3' })).toBeNull();
    expect(meilensteinJahr({ erledigt: true, erledigtAm: '2026-05-01' })).toBe(2026);
    expect(meilensteinImJahr({ faellig: '2027-04-01' }, 2027, 2026)).toBe(true);
    expect(meilensteinImJahr({ faellig: '2027-04-01' }, 2026, 2026)).toBe(false);
    expect(meilensteinImJahr({ faellig: '2025-11-01', erledigt: false }, 2026, 2026)).toBe(true);
    expect(meilensteinImJahr({ faellig: '2025-11-01', erledigt: true }, 2026, 2026)).toBe(false);
    expect(meilensteinImJahr({}, 2026, 2026)).toBe(true);
    expect(meilensteinImJahr({}, 2027, 2026)).toBe(false);
  });
  it('Jahresauswahl: mindestens laufendes + nächstes, belegte Jahre dazu (drei zurück, fünf voraus)', () => {
    expect(planJahre(2026)).toEqual([2026, 2027]);
    expect(planJahre(2026, [2029, 2025, null, 2040, 2020])).toEqual([2025, 2026, 2027, 2029]);
    expect(jahrAus('2027', 2026)).toBe(2027);
    expect(jahrAus('2040', 2026)).toBeNull();
    expect(jahrAus('27', 2026)).toBeNull();
  });
  it('Plan-Datum (ZOE): echte Tage, ausdrücklich im nächsten Jahr, höchstens 10 Jahre', () => {
    expect(planTag('2027-03-15', HEUTE)).toBe('2027-03-15');
    expect(planTag('2028-02-29', HEUTE)).toBe('2028-02-29');
    expect(planTag('2027-02-29', HEUTE)).toBeNull();
    expect(planTag('2027-13-01', HEUTE)).toBeNull();
    expect(planTag('2037-01-01', HEUTE)).toBeNull();
    expect(planTag('morgen', HEUTE)).toBeNull();
  });
  it('Indizes: Geplantes fürs nächste Jahr zählt nicht im Kurs', () => {
    expect(zaehltImKurs({ faellig: '2026-12-31' }, HEUTE)).toBe(true);
    expect(zaehltImKurs({ faellig: '2027-01-01' }, HEUTE)).toBe(false);
    expect(zaehltImKurs({}, HEUTE)).toBe(true);
  });
});

describe('Forecast je Jahr', () => {
  it('das laufende Jahr: Zeit vorbei und Prognose', () => {
    const l = jahrLage(2026, HEUTE, 60);
    expect(l).toMatchObject({ art: 'laeuft', verstrichen: 75, schnitt: 60, prognose: 80 });
  });
  it('das nächste Jahr: „beginnt in n Monaten“, nie 0 % Zeit vorbei', () => {
    const l = jahrLage(2027, HEUTE, 0);
    expect(l).toEqual({ art: 'zukunft', monate: 3, tage: 2 });
    expect(beginntText(l as { monate: number; tage: number })).toBe('beginnt in 3 Monaten');
    expect(bisBeginn('2026-12-31', '2027-01-01')).toEqual({ monate: 0, tage: 1 });
    expect(beginntText(bisBeginn('2026-12-31', '2027-01-01'))).toBe('beginnt morgen');
    expect(beginntText(bisBeginn('2026-12-10', '2027-01-01'))).toBe('beginnt in 22 Tagen');
    expect(beginntText(bisBeginn('2026-11-30', '2027-01-01'))).toBe('beginnt in 1 Monat');
  });
  it('ein vergangenes Jahr ist abgeschlossen', () => {
    expect(jahrLage(2025, HEUTE, 70)).toEqual({ art: 'vorbei', schnitt: 70 });
  });
});

describe('Stapeln ohne Überlappung', () => {
  it('Reihen kollidieren nie, Überlauf wird gebündelt, Bündel halten Abstand', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ x: 100 + (i % 10) * 4 + Math.floor(i / 10) * 300, w: 120 }));
    items.sort((a, b) => a.x - b.x);
    const r = stapeln(items, 1000, 3);
    const jeReihe = new Map<number, { l: number; r: number }[]>();
    r.lagen.forEach((l, i) => { if ('reihe' in l) jeReihe.set(l.reihe, [...(jeReihe.get(l.reihe) ?? []), { l: l.links, r: l.links + items[i].w }]); });
    for (const liste of jeReihe.values()) for (let k = 1; k < liste.length; k++) expect(liste[k].l).toBeGreaterThanOrEqual(liste[k - 1].r);
    expect(Math.max(...jeReihe.keys())).toBeLessThan(3);
    const gebuendelt = r.lagen.filter(l => 'buendel' in l).length;
    expect(gebuendelt).toBe(r.buendel.reduce((s, b) => s + b.idx.length, 0));
    expect(gebuendelt).toBeGreaterThan(0);
    for (let k = 1; k < r.buendel.length; k++) expect(r.buendel[k].x - r.buendel[k - 1].x).toBeGreaterThanOrEqual(34);
  });
  it('wenige Marker: alles in Reihen, kein Bündel', () => {
    const r = stapeln([{ x: 50, w: 100 }, { x: 400, w: 100 }], 800, 5);
    expect(r.buendel).toEqual([]);
    expect(r.reihen).toBe(1);
  });
});

describe('Fokus des Jahres je Jahr', () => {
  it('das laufende Jahr wird doppelt geschrieben, andere Jahre nur mit Jahr', () => {
    expect(fokusSchreibSchluessel('business:jahr', 2026)).toEqual(['business:jahr', 'business:jahr:2026']);
    expect(fokusSchreibSchluessel('jahr:2026', 2026)).toEqual(['jahr', 'jahr:2026']);
    expect(fokusSchreibSchluessel('privat:jahr:2027', 2026)).toEqual(['privat:jahr:2027']);
    expect(fokusSchreibSchluessel('business:woche', 2026)).toEqual(['business:woche']);
    expect(istJahrFokusSchluessel('business:jahr:2027', 2026)).toBe(true);
    expect(istJahrFokusSchluessel('business:jahr:2099', 2026)).toBe(false);
  });
  it('lesen je Jahr; im neuen Jahr gilt der vorgeplante Satz, der alte wandert nicht mit', () => {
    const alle = { 'business:jahr': 'Aufbau', 'business:jahr:2026': 'Aufbau', 'business:jahr:2027': 'Skalieren' };
    expect(fokusImJahr(alle, 'business:jahr', 2026, 2026)).toBe('Aufbau');
    expect(fokusImJahr(alle, 'business:jahr', 2027, 2026)).toBe('Skalieren');
    expect(fokusImJahr({ jahr: 'alt' }, 'jahr', 2026, 2026)).toBe('alt');
    expect(fokusImJahr({ jahr: 'alt' }, 'jahr', 2027, 2026)).toBe('');
    // Januar 2027: der alte Schlüssel zeigt den vorgeplanten Satz …
    expect(fokusFuerLaufendesJahr(alle, 2027)['business:jahr']).toBe('Skalieren');
    // … ohne Vorplanung bleibt er leer statt 2026 still weiterzuführen.
    expect(fokusFuerLaufendesJahr({ jahr: 'Aufbau', 'jahr:2026': 'Aufbau' }, 2027).jahr).toBe('');
    // Altbestand ohne Jahres-Schlüssel bleibt, wie er ist.
    expect(fokusFuerLaufendesJahr({ jahr: 'Aufbau' }, 2026).jahr).toBe('Aufbau');
  });
});

describe('Datenmodell: Jahr am Ziel, Ziel-Bezug am Meilenstein, Kaskade nur im laufenden Jahr', () => {
  const z = (p: Partial<Ziel>): Ziel => ({ id: 'z', titel: 'Ziel', fortschritt: 0, ...p });
  it('die Säuberung behält ein plausibles `jahr` und `zielId`, verwirft Unsinn', () => {
    expect(sauberZiel({ titel: 'A', jahr: 2027 })!.jahr).toBe(2027);
    expect(sauberZiel({ titel: 'A', jahr: 1800 })!.jahr).toBeUndefined();
    expect(sauberZiel({ titel: 'A', jahr: '2027' })!.jahr).toBeUndefined();
    expect(sauberMeilenstein({ titel: 'M', zielId: 'z-1', faellig: '2027-05-01' })).toMatchObject({ zielId: 'z-1', faellig: '2027-05-01' });
    expect(sauberMeilenstein({ titel: 'M', zielId: '<script>' })!.zielId).toBeUndefined();
  });
  it('Stempeln: fehlendes Jahr aus Frist bzw. laufendem Jahr, vorhandenes bleibt (dasselbe Objekt)', () => {
    const a = z({ id: 'a' }), b = z({ id: 'b', termin: '2027-02-01' }), c = z({ id: 'c', jahr: 2028 });
    const [x, y, w] = jahrStempeln([a, b, c], 2026);
    expect(x.jahr).toBe(2026); expect(y.jahr).toBe(2027); expect(w).toBe(c);
  });
  it('ein Zahlenziel für nächstes Jahr kaskadiert nicht in dieses Quartal — ab dessen Januar schon', () => {
    const datei: ZieleDatei = { tag: [], woche: [], monat: [], quartal: [], jahr: [z({ id: 'n', titel: 'Neukunden', zielwert: 120, jahr: 2027 }), z({ id: 'j', titel: 'Umsatz', zielwert: 40 })] };
    const jetzt = kaskadeAnwenden(datei, 2026);
    expect(jetzt.quartal.map(q => q.abgeleitetVon)).toEqual(['j']);
    const spaeter = kaskadeAnwenden({ ...jetzt, jahr: jahrStempeln(jetzt.jahr, 2026) }, 2027);
    expect(spaeter.quartal.map(q => q.abgeleitetVon)).toEqual(['n']);
  });
  it('ein Termin-Ziel im nächsten Jahr wird Meilenstein im nächsten Jahr', () => {
    const ms = meilensteineAbleiten([z({ id: 't', titel: 'Launch', termin: '2027-03-15', space: 'business', jahr: 2027 })], []);
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ faellig: '2027-03-15', abgeleitetVon: 't' });
    expect(meilensteinJahr(ms[0])).toBe(2027);
  });
});
