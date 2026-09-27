// Wertelisten (Stammdaten, 27.09.): Standard + Eigenes, Prüfen/Säubern eines Teil-Updates, feste Werte bleiben. Erfundene Daten.
import { describe, it, expect } from 'vitest';
import { wertelistenVollstaendig, wertelistenPruefen, eigeneErgebnisse, eigeneVerlustgruende, ERGEBNIS_LABEL, ergebnisLabel, KADENZ_MIN, KADENZ_MAX, wertelisteZurWahl, BRANCHEN_STANDARD, TYPEN_STANDARD, SUCHE_AB } from '../lib/crm/wertelisten';
import { VERLUSTGRUENDE, verlustgruende } from '../lib/crm/pipeline';
import { ERGEBNISSE, KREIS_TAKT } from '../lib/make-one/crm';
import { taktVon } from '../lib/crm/followup';
import type { Wertelisten } from '../lib/crm/typen';

describe('Wertelisten — Standard + Eigenes', () => {
  it('ohne Speicher: nur die festen Werte, Standard-Kadenz, keine Ziele', () => {
    const v = wertelistenVollstaendig(undefined);
    expect(v.verlustgruende.map(g => g.wert)).toEqual(VERLUSTGRUENDE);
    expect(v.verlustgruende.every(g => g.fest)).toBe(true);
    expect(v.kadenzTage).toEqual(KREIS_TAKT);
    expect(v.kadenzStandard).toEqual(KREIS_TAKT);
    expect(v.ergebnisse.map(e => e.wert)).toEqual([...ERGEBNISSE]);
    expect(v.ergebnisse.find(e => e.wert === 'nicht_erreicht')).toMatchObject({ label: 'nicht erreicht', fest: true });
    expect(v.ziele).toEqual({});
  });
  it('eigene Werte hängen hinter den festen, Doppelungen und feste Werte im Speicher fallen weg', () => {
    const w: Wertelisten = { verlustgruende: ['  Zu   klein ', 'preis', 'Zu klein', 'Kein Fit'], ergebnisse: ['Empfehlung erhalten', 'Gespräch', 'termin', 'empfehlung   erhalten'], kadenzTage: { A: 14, B: 60, C: 3, X: 20 } as Record<string, number>, ziele: { umsatzNeuMonat: 15000, sqlMonat: -1, gespraecheWoche: 8 } };
    const v = wertelistenVollstaendig(w);
    expect(v.verlustgruende.map(g => g.wert)).toEqual([...VERLUSTGRUENDE, 'Zu klein', 'Kein Fit']);
    expect(v.verlustgruende.filter(g => !g.fest).map(g => g.wert)).toEqual(['Zu klein', 'Kein Fit']);
    expect(verlustgruende(w)).toEqual(v.verlustgruende.map(g => g.wert));
    expect(eigeneVerlustgruende(w)).toEqual(['Zu klein', 'Kein Fit']);
    expect(eigeneErgebnisse(w)).toEqual(['Empfehlung erhalten']);
    expect(v.ergebnisse.filter(e => !e.fest)).toEqual([{ wert: 'Empfehlung erhalten', label: 'Empfehlung erhalten', fest: false }]);
    // Kadenz: A eigen, B = Standard, C unter der Untergrenze → Standard, X kein Kreis
    expect(v.kadenzTage).toEqual({ A: 14, B: 60, C: 90, D: 180 });
    // Ziele: negative Werte zählen nicht
    expect(v.ziele).toEqual({ umsatzNeuMonat: 15000, gespraecheWoche: 8 });
  });
  it('Kadenz aus den Wertelisten greift im Follow-up (taktVon)', () => {
    expect(taktVon({ kreis: 'A' }, { kadenzTage: { A: 14 } })).toBe(14);
    expect(taktVon({ kreis: 'B' }, { kadenzTage: { A: 14 } })).toBe(KREIS_TAKT.B);
  });
  it('Labels der festen Ergebnisse', () => {
    expect(Object.keys(ERGEBNIS_LABEL).sort()).toEqual([...ERGEBNISSE].sort());
    expect(ergebnisLabel('rueckruf')).toBe('Rückruf');
    expect(ergebnisLabel('Eigenes')).toBe('Eigenes');
  });
});

describe('Wertelisten — Teil-Update prüfen und säubern', () => {
  const alt: Wertelisten = { verlustgruende: ['Zu klein'], kadenzTage: { A: 14 }, ziele: { sqlMonat: 3 } };

  it('nur gesendete Listen ändern sich; Leerraum, Doppelungen und feste Werte werden gesäubert', () => {
    const p = wertelistenPruefen({ verlustgruende: [' Kein  Fit ', 'kein fit', 'Preis', ''] }, alt);
    expect(p.ok).toBe(true);
    expect(p.wertelisten).toEqual({ verlustgruende: ['Kein Fit'], kadenzTage: { A: 14 }, ziele: { sqlMonat: 3 } });
  });
  it('feste Werte lassen sich nicht löschen — eine leere Liste lässt die festen stehen', () => {
    const p = wertelistenPruefen({ verlustgruende: [], ergebnisse: null }, alt);
    expect(p.ok).toBe(true);
    expect(p.wertelisten.verlustgruende).toBeUndefined();
    expect(wertelistenVollstaendig(p.wertelisten).verlustgruende.map(g => g.wert)).toEqual(VERLUSTGRUENDE);
    expect(wertelistenVollstaendig(p.wertelisten).ergebnisse.map(e => e.wert)).toEqual([...ERGEBNISSE]);
  });
  it('Verlustgrund 2–60 Zeichen — sonst Fehler, und nichts wird geschrieben', () => {
    const zuLang = 'x'.repeat(61);
    const p = wertelistenPruefen({ verlustgruende: ['A', zuLang, 'Passt'] }, alt);
    expect(p.ok).toBe(false);
    expect(p.fehler).toHaveLength(2);
    expect(p.fehler[0]).toMatch(/2–60 Zeichen/);
    expect(p.wertelisten).toEqual(alt);
  });
  it('Kadenz 7–730 Tage je Kreis, Standard löscht die Abweichung, leer auch, Zahlentext geht', () => {
    const p = wertelistenPruefen({ kadenzTage: { A: '', B: '45', C: 90, D: 365 } }, alt);
    expect(p.ok).toBe(true);
    expect(p.wertelisten.kadenzTage).toEqual({ B: 45, D: 365 });
    expect(wertelistenPruefen({ kadenzTage: { A: 6 } }, alt).fehler[0]).toMatch(new RegExp(`${KADENZ_MIN}–${KADENZ_MAX}`));
    expect(wertelistenPruefen({ kadenzTage: { A: 731 } }, alt).ok).toBe(false);
    expect(wertelistenPruefen({ kadenzTage: { A: 30.5 } }, alt).ok).toBe(false);
    expect(wertelistenPruefen({ kadenzTage: { E: 30 } }, alt).fehler[0]).toMatch(/unbekannt/);
    expect(wertelistenPruefen({ kadenzTage: null }, alt).wertelisten.kadenzTage).toBeUndefined();
  });
  it('Ziele als Zahlen ≥ 0, deutsche Schreibweise erlaubt, leer löscht, Unbekanntes wird abgelehnt', () => {
    const p = wertelistenPruefen({ ziele: { umsatzNeuMonat: '12.500,50', sqlMonat: '' } }, alt);
    expect(p.ok).toBe(true);
    expect(p.wertelisten.ziele).toEqual({ umsatzNeuMonat: 12500.5 });
    expect(wertelistenPruefen({ ziele: { gespraecheWoche: 0 } }, alt).wertelisten.ziele).toEqual({ sqlMonat: 3, gespraecheWoche: 0 });
    expect(wertelistenPruefen({ ziele: { sqlMonat: -2 } }, alt).fehler[0]).toMatch(/≥ 0/);
    expect(wertelistenPruefen({ ziele: { umsatz: 1 } }, alt).fehler[0]).toMatch(/unbekannt/);
    expect(wertelistenPruefen({ ziele: 'viel' }, alt).ok).toBe(false);
  });
  it('kein Objekt → Fehler, alter Stand bleibt', () => {
    const p = wertelistenPruefen('x', alt);
    expect(p.ok).toBe(false);
    expect(p.wertelisten).toEqual(alt);
    expect(wertelistenPruefen(null, undefined).wertelisten).toEqual({});
  });
  it('Gesprächsergebnisse: fest bleibt fest, eigene 2–40 Zeichen', () => {
    const p = wertelistenPruefen({ ergebnisse: ['Nicht erreicht', 'Empfehlung erhalten', 'x'] }, undefined);
    expect(p.ok).toBe(false);
    expect(p.fehler[0]).toMatch(/Gesprächsergebnis/);
    const q = wertelistenPruefen({ ergebnisse: ['Nicht erreicht', 'Empfehlung erhalten'] }, undefined);
    expect(q.ok).toBe(true);
    expect(q.wertelisten.ergebnisse).toEqual(['Empfehlung erhalten']);
  });
});

describe('Wertelisten — Wahl in der Akte (27.09.)', () => {
  const liste = wertelistenVollstaendig({ branchen: ['Luftfahrt'] }).branchen;
  it('zeigt alle Werte (fest + eigene) und hängt gewählte Bestandswerte an, die in keiner Liste stehen', () => {
    const o = wertelisteZurWahl(liste, ['Handwerk', 'Altbestand XY']);
    expect(o.map(x => x.wert)).toEqual([...BRANCHEN_STANDARD, 'Luftfahrt', 'Altbestand XY']);
    expect(o.at(-1)).toEqual({ wert: 'Altbestand XY', fest: false, fremd: true });
    expect(o.find(x => x.wert === 'Handwerk')).toEqual({ wert: 'Handwerk', fest: true });
  });
  it('sucht ohne Groß/Klein im Teilwort — Gewähltes bleibt stehen', () => {
    const o = wertelisteZurWahl(liste, ['Handwerk'], 'fin');
    expect(o.map(x => x.wert)).toEqual(['Finanzen & Fintech', 'Handwerk']);
    expect(wertelisteZurWahl(liste, [], 'LUFT').map(x => x.wert)).toEqual(['Luftfahrt']);
    expect(wertelisteZurWahl(liste, [], 'gibt es nicht')).toEqual([]);
  });
  it('Einzelwahl (Typ) mit leerem Bestand: nur die Liste; Suchfeld ab SUCHE_AB Werten', () => {
    expect(wertelisteZurWahl(wertelistenVollstaendig(undefined).typen, []).map(x => x.wert)).toEqual([...TYPEN_STANDARD]);
    expect(BRANCHEN_STANDARD.length).toBeGreaterThanOrEqual(SUCHE_AB);
    expect(TYPEN_STANDARD.length).toBeLessThan(SUCHE_AB);
  });
});
