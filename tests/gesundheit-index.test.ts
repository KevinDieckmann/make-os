// Gesundheits-Index (26.09.): dieselbe Logik wie Business und Privat für die
// Gesundheit — drei Säulen 40/30/30, jede Kennzahl mit Schwellen, Messlücken
// statt erfundener Nullen, hinter jeder die Punkte mit Weg dorthin, wo man
// handelt. Nur erfundene Beispieldaten einer Testperson.
import { describe, it, expect } from 'vitest';
import { berechneGesundheit, kennzahlenFuer, GESUNDHEIT_KENNZAHLEN, GESUNDHEIT_MESSEN, GESUNDHEIT_SAEULEN, type GesundheitBestand } from '../lib/gesundheit/index';
import { tageZurueck } from '../lib/gesundheit/eintraege';
import type { ErnaehrungFile } from '../lib/make-one/ernaehrung-data';

const HEUTE = '2026-09-25';
const PERSON = 'test';
const T = tageZurueck(HEUTE, 60);            // T[0] = heute, T[i] = vor i Tagen
const tag = (i: number) => T[i];

// Whoop: letzte 7 Tage besser als die 30-Tage-Basis.
const vitals: GesundheitBestand['vitals'] = {};
for (let i = 0; i < 30; i++) vitals[tag(i)] = i < 7 ? { rec: 70, sleep: 7.8, hrv: 60, rhr: 55 } : { rec: 60, sleep: 7, hrv: 50, rhr: 58 };
// Journal: 7 Tage, Stress niedrig, Energie hoch, 5× anti-entzündlich gegessen.
const journal: GesundheitBestand['journal'] = {};
for (let i = 0; i < 7; i++) journal[tag(i)] = { energy: 4, stress: 2, flags: i < 5 ? ['antiinflamm'] : [] };
// Routinen: an 5 von 7 Tagen alles, an 2 Tagen ohne Supplements.
const routinen = [{ id: 'reha', label: 'Reha & Mobilität', wann: 'morgen' }, { id: 'essen', label: 'Regelmäßig essen' }, { id: 'supps', label: 'Supplements' }];
const log: GesundheitBestand['log'] = {};
for (let i = 0; i < 7; i++) log[tag(i)] = i < 5 ? ['reha', 'essen', 'supps'] : ['reha', 'essen'];
// Haut: ruhige Woche (Ø 2), ein Schub in der Woche, einer vor 20 Tagen.
const haut: GesundheitBestand['haut'] = {};
for (let i = 0; i < 7; i++) haut[tag(i)] = { juckreiz: 2, schub: i === 3, ausloeser: i === 3 ? 'Stress' : undefined, at: `${tag(i)}T20:00:00.000Z` };
haut[tag(20)] = { juckreiz: 5, schub: true, ausloeser: 'Stress', at: `${tag(20)}T20:00:00.000Z` };
// Streak: 41 Tage geführt, Rückfall vor 35 Tagen → 35 saubere Tage.
const streak: GesundheitBestand['streak'] = {};
for (let i = 0; i <= 40; i++) streak[tag(i)] = { sauber: i !== 35, craving: 1, at: `${tag(i)}T21:00:00.000Z` };
// Wochenplan: je Woche zwei Reha-Blöcke à 90 min → 3 h/Woche.
const bloecke = [1, 3, 8, 10, 15, 17, 22, 24].map(i => ({ date: tag(i), dauerMin: 90, art: 'reha', titel: 'Reha' }));
const termine = [
  { start: '2026-09-30T10:00', title: 'Physio', owner: PERSON },
  { start: '2026-10-05T09:00', title: 'Hautarzt Dr. Müller', owner: 'beide' },
  { start: '2026-10-02T09:00', title: 'Kundentermin', owner: PERSON },     // kein Gesundheitstermin
  { start: '2026-10-03T18:00', title: 'Training', owner: 'jemand-anders' }, // nicht meiner
  { start: '2026-11-20T10:00', title: 'Physio', owner: PERSON },           // außerhalb 4 Wochen
];
const meilensteine = [
  { titel: 'Reha abgeschlossen', bereich: 'gesundheit', faellig: '2026-12-31', fortschritt: 80, erledigt: false },
  { titel: 'Rückenprogramm', bereich: 'gesundheit', faellig: '2026-09-01', fortschritt: 50, erledigt: false }, // überfällig → 0
  { titel: 'Business-Ziel', bereich: 'business', fortschritt: 10, erledigt: false },
];
const voll = { fruehstueck: 'Porridge', mittag: 'Salat', abend: 'Fisch' };
const ernaehrung = { grundsaetze: '', plan: { mo: voll, di: voll, mi: voll, do: voll, fr: voll, sa: voll, so: { ...voll, abend: '' } }, einkauf: [{ erledigt: false }, { erledigt: true }] } as unknown as ErnaehrungFile;

const bestand = (x: Partial<GesundheitBestand> = {}): GesundheitBestand => ({
  heute: HEUTE, person: PERSON, vitals, routinen, log, journal, haut, streak, bloecke, termine, kalenderFrisch: true, meilensteine, ernaehrung, ...x,
});
const k = (pi: ReturnType<typeof berechneGesundheit>, id: string) => pi.saeulen.flatMap(s => s.kennzahlen).find(x => x.id === id)!;

describe('Gesundheits-Index', () => {
  it('Aufbau: drei Säulen 40/30/30, jede Kennzahl mit Messung, Schwellen richtig herum, Weg zur Pflege', () => {
    expect(GESUNDHEIT_SAEULEN.map(s => [s.id, s.gewicht])).toEqual([['er', 0.4], ['ba', 0.3], ['ek', 0.3]]);
    for (const x of GESUNDHEIT_KENNZAHLEN) {
      expect(GESUNDHEIT_MESSEN[x.id], x.id).toBeTypeOf('function');
      expect(x.richtung === 'hoch' ? x.gruen > x.rot : x.gruen < x.rot, x.id).toBe(true);
      expect(x.pflegen?.href, x.id).toMatch(/^\/os\//);
    }
    expect(new Set(GESUNDHEIT_KENNZAHLEN.map(x => x.id)).size).toBe(GESUNDHEIT_KENNZAHLEN.length);
  });

  it('rechnet jede Kennzahl aus den eigenen Beständen', () => {
    const pi = berechneGesundheit(bestand());
    expect(k(pi, 'recovery')).toMatchObject({ wert: 70, ampel: 'gruen' });
    expect(k(pi, 'schlaf').wert).toBeCloseTo(7.8, 5);
    expect(k(pi, 'schlaf').ampel).toBe('gruen');
    expect(k(pi, 'hrv').wert).toBeCloseTo(60 / ((7 * 60 + 23 * 50) / 30) * 100, 5);
    expect(k(pi, 'hrv').ampel).toBe('gruen');
    expect(k(pi, 'ruhepuls').wert).toBeCloseTo(55 - (7 * 55 + 23 * 58) / 30, 5);
    expect(k(pi, 'ruhepuls').ampel).toBe('gruen');
    expect(k(pi, 'stress')).toMatchObject({ wert: 2, ampel: 'gruen' });
    expect(k(pi, 'datenstand')).toMatchObject({ wert: 0, anzeige: 'heute', ampel: 'gruen' });
    expect(k(pi, 'routinen').wert).toBeCloseTo(5 / 7 * 100, 5);
    expect(k(pi, 'routinen').ampel).toBe('gruen');
    expect(k(pi, 'reha')).toMatchObject({ wert: 100, ampel: 'gruen' });
    expect(k(pi, 'bewegung')).toMatchObject({ wert: 3, ampel: 'gruen' });
    expect(k(pi, 'termine')).toMatchObject({ wert: 2, ampel: 'gruen' });
    expect(k(pi, 'energie')).toMatchObject({ wert: 4, ampel: 'gruen' });
    expect(k(pi, 'meilensteine')).toMatchObject({ wert: 40, ampel: 'gelb' });
    expect(k(pi, 'meilensteine').quelle).toContain('1 überfällig');
    expect(k(pi, 'essen')).toMatchObject({ wert: 100, ampel: 'gruen' });
    expect(k(pi, 'plan').wert).toBeCloseTo(20 / 21 * 100, 5);
    expect(k(pi, 'antiinflamm')).toMatchObject({ wert: 5, ampel: 'gruen' });
    expect(k(pi, 'haut')).toMatchObject({ wert: 2, ampel: 'gruen' });
    expect(k(pi, 'schuebe')).toMatchObject({ wert: 2, ampel: 'gelb' });
    expect(k(pi, 'streak')).toMatchObject({ wert: 35, ampel: 'gruen' });
    expect(pi.luecken).toBe(0);
    expect(pi.index).toBeGreaterThan(60);
    expect(pi.saeulen.map(s => s.id)).toEqual(['er', 'ba', 'ek']);
    expect(pi.scope).toBe(PERSON);
  });

  it('die Punkte führen dorthin, wo man handelt — je Person', () => {
    const pi = berechneGesundheit(bestand());
    expect(k(pi, 'recovery').details).toHaveLength(3);
    expect(k(pi, 'recovery').details[0]).toMatchObject({ href: `/os/gesundheit?fuer=${PERSON}#morgen`, ampel: 'gruen' });
    expect(k(pi, 'routinen').details[0]).toMatchObject({ titel: 'Supplements', wert: '5/7', ampel: 'gruen' });
    expect(k(pi, 'termine').details.map(d => d.titel)).toEqual(['Physio', 'Hautarzt Dr. Müller']);
    expect(k(pi, 'meilensteine').details[0]).toMatchObject({ titel: 'Rückenprogramm', ampel: 'rot', unter: 'überfällig seit 01.09.' });
    expect(k(pi, 'schuebe').details.map(d => d.titel)).toContain('Auslöser: stress');
    expect(k(pi, 'plan').details[0]).toMatchObject({ wert: '20/21', unter: 'Lücken: so' });
    const alle = pi.saeulen.flatMap(s => s.kennzahlen).flatMap(x => [...x.details.map(d => d.href), x.pflegen?.href]).filter(Boolean) as string[];
    expect(alle.filter(h => !h.startsWith('/os/'))).toEqual([]);
  });

  it('ohne Daten: Messlücken mit Weg, kein erfundener Wert — Tagebücher nur, wenn geführt', () => {
    const leer = bestand({ vitals: {}, journal: {}, log: {}, haut: {}, streak: {}, bloecke: [], termine: [], kalenderFrisch: false, meilensteine: [], ernaehrung: null, routinen: [] });
    expect(kennzahlenFuer(leer).map(x => x.id)).not.toContain('haut');
    expect(kennzahlenFuer(leer).map(x => x.id)).not.toContain('streak');
    expect(kennzahlenFuer(bestand()).map(x => x.id)).toEqual(expect.arrayContaining(['haut', 'schuebe', 'streak']));
    const pi = berechneGesundheit(leer);
    expect(pi.index).toBeNull();
    expect(pi.label).toBe('Noch keine Daten');
    expect(pi.luecken).toBe(GESUNDHEIT_KENNZAHLEN.length - 3);
    for (const x of pi.saeulen.flatMap(s => s.kennzahlen)) {
      expect(x.gemessen, x.id).toBe(false);
      expect(x.ampel, x.id).toBe('grau');
      expect(x.details.length > 0 || !!x.pflegen, x.id).toBe(true);
    }
    expect(k(pi, 'datenstand').details[0]).toMatchObject({ titel: 'Whoop verbinden', href: '/os/verbindungen' });
    expect(k(pi, 'recovery').quelle).toBe('0 Whoop-Werte in 7 Tagen — mindestens 3 nötig');
  });

  it('eigene Schwellen gelten; Termine anderer zählen nicht; Kalender ohne Stand ist eine Lücke', () => {
    const pi = berechneGesundheit(bestand({ schwellen: { recovery: { gruen: 75, rot: 50 } } }));
    expect(k(pi, 'recovery')).toMatchObject({ wert: 70, ampel: 'gelb', angepasst: true, standard: { gruen: 66, rot: 40 } });
    const fremd = berechneGesundheit(bestand({ person: 'jemand-anders' }));
    expect(k(fremd, 'termine').details.map(d => d.titel)).toEqual(['Training', 'Hautarzt Dr. Müller']);
    expect(k(berechneGesundheit(bestand({ kalenderFrisch: false })), 'termine')).toMatchObject({ gemessen: false, quelle: 'Kalender-Stand fehlt' });
  });

  it('Streak ohne Eintrag seit 3 Tagen ist keine Zahl mehr, sondern eine Frage', () => {
    const alt: GesundheitBestand['streak'] = {};
    for (let i = 5; i <= 20; i++) alt[tag(i)] = { sauber: true, at: `${tag(i)}T21:00:00.000Z` };
    expect(k(berechneGesundheit(bestand({ streak: alt })), 'streak')).toMatchObject({ gemessen: false, quelle: 'Seit über 3 Tagen kein Streak-Eintrag' });
  });
});
