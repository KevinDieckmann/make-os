// ─── Kalender — Ansicht wie Google (10.10.) ────────────────────────────────────────────────────────────────────────────────────
// Kevin 10.10.: „Den Kalender überall in der Ansicht anpassen — nicht gut zu sehen, nicht gut zu scrollen, man sieht einfach nichts, im
// Vergleich zu Google.“ Hier die reinen Regeln (Bahnen der Ganztags-Zeile, Spalten füllen nach rechts, Zeitraum der Kopfzeile, Abgleich als
// Ampel, Darstellung je Gerät, Zoom, volle Höhe, Arbeitsbeginn, 3 Tage am Handy) und was die Oberfläche daraus macht.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spaltenLegen, rasterLage, ganztagsLegen, ganztagsSicht, startMinute, GANZTAGS_ZEILEN, MAX_SPALTEN } from '@/lib/kalender/layout';
import { ganztagsAm, ganztagsSpanne, type KalenderAufgabe } from '@/lib/kalender/aufgaben';
import {
  abgleichAmpel, arbeitsbeginnAus, darstellungLesen, darstellungSaeubern, darstellungSchreiben, pxJeMinute, radZoomFaktor, rollAnker, schlechtesteAmpel, spanneKurz,
  volleHoehe, zeitraumText, zoomKlemmen, zoomMal, BLOCK_ALPHA, DARSTELLUNG_MERKER, DARSTELLUNG_VORGABE, ZEILEN_PX, ZOOM,
} from '@/lib/kalender/darstellung';
import { mehrereTage, mehrereTageLabel } from '@/lib/kalender/modus';
import { tagPlus } from '@/lib/kalender/zeit';
import { FARBE, LEUCHT } from '@/lib/make-one/design';
import { ART_INFO, TERMIN_FARBEN } from '@/lib/kalender/arten';
import { ART_FARBE } from '@/types/planer';
import { VierTage } from '@/components/os/kalender/VierTage';
import { RASTER_HILFE } from '@/components/os/kalender/Zeitraster';
import { Monat } from '@/components/os/kalender/Monat';
import type { KTermin } from '@/components/os/kalender/teile';

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
const h = (c: unknown, props: unknown) => createElement(c as never, props as never);
const WOCHE = Array.from({ length: 7 }, (_, i) => tagPlus('2026-10-05', i)); // Mo 05.10. – So 11.10.

describe('Spalten füllen nach rechts (wie Google)', () => {
  it('ein Block füllt die Nachbarspalte, solange dort zur selben Zeit niemand liegt', () => {
    // a 9–10 · b 9–10 · c 9:30–11 → drei Spalten; e 10–11 liegt in Spalte 0 und darf Spalte 1 (b ist um 10 vorbei) mitnehmen, nicht Spalte 2 (c läuft).
    const lagen = [{ id: 'a', von: 540, bis: 600 }, { id: 'b', von: 540, bis: 600 }, { id: 'c', von: 570, bis: 660 }, { id: 'e', von: 600, bis: 660 }];
    const p = Object.fromEntries(spaltenLegen(lagen).map(x => [x.id, x]));
    expect(p.a).toMatchObject({ spalte: 0, spalten: 3, spanne: 1 });
    expect(p.c).toMatchObject({ spalte: 2, spanne: 1 });
    expect(p.e).toMatchObject({ spalte: 0, spanne: 2 });
    const s = rasterLage(Object.values(p), new Map(lagen.map(l => [l.id, l])), false).sicht;
    expect(s.get('e')!.breite).toBeCloseTo(200 / 3);
    expect(s.get('a')!.breite).toBeCloseTo(100 / 3);
  });
  it('allein steht ein Block in voller Breite; zugeklappt nie in die Spalte von „+n“', () => {
    expect(spaltenLegen([{ id: 'x', von: 0, bis: 60 }])[0]).toMatchObject({ spalte: 0, spalten: 1, spanne: 1 });
    // Fünf gleichzeitige + einer, der später in Spalte 0 beginnt und rechts frei hätte: zugeklappt höchstens bis vor „+n“.
    const lagen = [...['a', 'b', 'c', 'd', 'e'].map(id => ({ id, von: 600, bis: 660 })), { id: 'f', von: 660, bis: 700 }, { id: 'g', von: 600, bis: 720 }];
    const p = spaltenLegen(lagen);
    const zu = rasterLage(p, new Map(lagen.map(l => [l.id, l])), false);
    for (const [id, s] of zu.sicht) expect(s.links + s.breite, id).toBeLessThanOrEqual((100 * (MAX_SPALTEN - 1)) / MAX_SPALTEN + 0.001);
  });
});

describe('Ganztags-Zeile als Bahnen', () => {
  it('ein mehrtägiger Eintrag ist EIN Platz über die Tage — nicht ein Eintrag je Tag', () => {
    const l = ganztagsLegen([{ id: 'reise', von: '2026-10-06', bis: '2026-10-09' }], WOCHE);
    expect(l.plaetze).toEqual([{ id: 'reise', bahn: 0, a: 1, b: 4, linksOffen: false, rechtsOffen: false }]);
    expect(l.bahnen).toBe(1);
  });
  it('läuft über den Rand: offen markiert und auf den Zeitraum gekappt; außerhalb fällt weg', () => {
    const l = ganztagsLegen([
      { id: 'vorher', von: '2026-10-01', bis: '2026-10-06' },
      { id: 'danach', von: '2026-10-10', bis: '2026-10-20' },
      { id: 'weg', von: '2026-09-01', bis: '2026-09-03' },
    ], WOCHE);
    expect(l.plaetze.map(p => p.id).sort()).toEqual(['danach', 'vorher']);
    expect(l.plaetze.find(p => p.id === 'vorher')).toMatchObject({ a: 0, b: 1, linksOffen: true, rechtsOffen: false });
    expect(l.plaetze.find(p => p.id === 'danach')).toMatchObject({ a: 5, b: 6, linksOffen: false, rechtsOffen: true });
  });
  it('Bahnen wie Google: früher zuerst, bei gleichem Beginn das Längere, dann der Rang; freie Lücken werden genutzt', () => {
    const l = ganztagsLegen([
      { id: 'frist', von: '2026-10-05', bis: '2026-10-05', rang: 1 },
      { id: 'lang', von: '2026-10-05', bis: '2026-10-08', rang: 2 },
      { id: 'feiertag', von: '2026-10-05', bis: '2026-10-05', rang: 0 },
      { id: 'spaeter', von: '2026-10-09', bis: '2026-10-10' },
    ], WOCHE);
    const bahn = Object.fromEntries(l.plaetze.map(p => [p.id, p.bahn]));
    expect(bahn).toEqual({ lang: 0, feiertag: 1, frist: 2, spaeter: 0 });
    expect(l.bahnen).toBe(3);
  });
  it('zugeklappt höchstens zwei Bahnen, der Rest als „+n“ je Tag; aufgeklappt alles', () => {
    const l = ganztagsLegen(['a', 'b', 'c', 'd'].map(id => ({ id, von: '2026-10-06', bis: '2026-10-07' })), WOCHE);
    expect(GANZTAGS_ZEILEN).toBe(2);
    const zu = ganztagsSicht(l, 7, false);
    expect(zu.sichtbar.map(p => p.id)).toEqual(['a', 'b']);
    expect(zu.mehr).toEqual([0, 2, 2, 0, 0, 0, 0]);
    expect(zu).toMatchObject({ zeilen: 2, klappbar: true });
    const auf = ganztagsSicht(l, 7, true);
    expect(auf.sichtbar).toHaveLength(4);
    expect(auf.mehr.every(n => n === 0)).toBe(true);
    expect(auf.zeilen).toBe(4);
    expect(ganztagsSicht(ganztagsLegen([{ id: 'x', von: '2026-10-05', bis: '2026-10-05' }], WOCHE), 7, false)).toMatchObject({ klappbar: false, zeilen: 1 });
  });
  it('Aufgaben: die Tage des Balkens sind genau die Tage, an denen `ganztagsAm` sie zeigt', () => {
    const faelle: Pick<KalenderAufgabe, 'tag' | 'start' | 'zeit'>[] = [
      { tag: '2026-10-08' }, { tag: '2026-10-08', start: '2026-10-05' }, { tag: '2026-10-08', zeit: '14:00' }, { tag: '2026-10-08', start: '2026-10-06', zeit: '09:30' },
    ];
    for (const f of faelle) {
      const a = { id: 'a', title: 'A', done: false, ...f } as KalenderAufgabe;
      const s = ganztagsSpanne(a);
      for (const tag of WOCHE) expect(ganztagsAm([a], tag).length > 0, `${JSON.stringify(f)} @ ${tag}`).toBe(!!s && tag >= s.von && tag <= s.bis);
    }
    expect(ganztagsSpanne({ tag: '2026-10-08', zeit: '14:00' })).toBeNull();
    expect(ganztagsSpanne({ tag: '2026-10-08', start: '2026-10-06', zeit: '09:30' })).toEqual({ von: '2026-10-06', bis: '2026-10-07' });
  });
});

describe('Kopfzeile: Zeitraum in EINER Zeile', () => {
  it('Woche mit KW, Monatswechsel, Jahreswechsel', () => {
    expect(zeitraumText('woche', WOCHE, '2026-10-07')).toBe('5.–11. Okt. 2026 · KW 41');
    expect(zeitraumText('woche', Array.from({ length: 7 }, (_, i) => tagPlus('2026-09-28', i)), '2026-09-30')).toBe('28. Sept. – 4. Okt. 2026 · KW 40');
    expect(spanneKurz('2026-12-28', '2027-01-03')).toBe('28. Dez. 2026 – 3. Jan. 2027');
  });
  it('Tag, 3/4 Tage, Monat, Jahr, Termine', () => {
    expect(zeitraumText('tag', ['2026-10-10'], '2026-10-10')).toBe('Sa., 10. Okt. 2026');
    expect(zeitraumText('vier', ['2026-10-10', '2026-10-11', '2026-10-12'], '2026-10-10')).toBe('10.–12. Okt. 2026');
    expect(zeitraumText('monat', [], '2026-10-10')).toBe('Oktober 2026');
    expect(zeitraumText('jahr', [], '2026-10-10')).toBe('2026');
    expect(zeitraumText('agenda', Array.from({ length: 30 }, (_, i) => tagPlus('2026-10-10', i)), '2026-10-10')).toBe('ab 10. Okt. 2026 · 30 Tage');
  });
  it('am Handy kurz: ohne Jahr im laufenden Jahr, ohne KW; über den Jahreswechsel mit Jahr', () => {
    expect(zeitraumText('woche', WOCHE, '2026-10-07', { kurz: '2026-10-10' })).toBe('5.–11. Okt.');
    expect(zeitraumText('tag', ['2026-10-10'], '2026-10-10', { kurz: '2026-10-10' })).toBe('Sa., 10. Okt.');
    expect(zeitraumText('tag', ['2027-01-04'], '2027-01-04', { kurz: '2026-10-10' })).toBe('Mo., 4. Jan. 2027');
    const wechsel = Array.from({ length: 7 }, (_, i) => tagPlus('2026-12-28', i));
    expect(zeitraumText('woche', wechsel, '2026-12-30', { kurz: '2026-12-30' })).toBe('28. Dez. 2026 – 3. Jan. 2027');
  });
});

describe('Abgleich als Punkt (Ampel)', () => {
  it('rot bei Anmeldung/Fehler, gelb bei veraltet/noch nie/übersprungen, sonst grün', () => {
    expect(abgleichAmpel({ vorMin: 3, veraltet: false })).toBe('gut');
    expect(abgleichAmpel({ vorMin: 45, veraltet: true })).toBe('achtung');
    expect(abgleichAmpel({ vorMin: null, veraltet: false })).toBe('achtung');
    expect(abgleichAmpel({ vorMin: 3, veraltet: false, hinweise: [{ kalender: 'X', grund: '403' }] })).toBe('achtung');
    expect(abgleichAmpel({ vorMin: 3, veraltet: false, fehler: 'Zeitüberschreitung' })).toBe('kritisch');
    expect(abgleichAmpel({ vorMin: 3, veraltet: false, anmeldung: true })).toBe('kritisch');
    expect(schlechtesteAmpel(['gut', 'achtung'])).toBe('achtung');
    expect(schlechtesteAmpel(['gut', 'kritisch', 'achtung'])).toBe('kritisch');
    expect(schlechtesteAmpel([])).toBeNull();
  });
});

describe('Darstellung je Gerät', () => {
  const speicher = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, m }; };
  it('Vorgabe: Normal (= der bisherige Wert), Zoom 1, Aufgaben ohne Uhrzeit an, Hilfe zu', () => {
    expect(DARSTELLUNG_VORGABE).toEqual({ zeilen: 'normal', zoom: 1, aufgabenOhneZeit: true, hilfe: false });
    expect(pxJeMinute(DARSTELLUNG_VORGABE)).toBe(0.9);
    expect(ZEILEN_PX.kompakt).toBeLessThan(ZEILEN_PX.normal);
    expect(ZEILEN_PX.gross).toBeGreaterThan(ZEILEN_PX.normal);
  });
  it('säubern: Unsinn fällt auf die Vorgabe, Zoom wird geklemmt', () => {
    expect(darstellungSaeubern({ zeilen: 'riesig', zoom: 'x', aufgabenOhneZeit: 'ja', hilfe: 1 })).toEqual(DARSTELLUNG_VORGABE);
    expect(darstellungSaeubern({ zoom: 99 }).zoom).toBe(ZOOM.max);
    expect(darstellungSaeubern({ zoom: 0.01 }).zoom).toBe(ZOOM.min);
    expect(darstellungSaeubern(null)).toEqual(DARSTELLUNG_VORGABE);
    expect(zoomKlemmen(1.23456)).toBe(1.235);
  });
  it('schreibt nur Abweichungen; alles Vorgabe → Merker weg; kaputter Merker → Vorgabe', () => {
    const s = speicher();
    expect(darstellungSchreiben({ ...DARSTELLUNG_VORGABE, zeilen: 'gross', aufgabenOhneZeit: false }, s)).toBe(true);
    expect(JSON.parse(s.m.get(DARSTELLUNG_MERKER)!)).toEqual({ zeilen: 'gross', aufgabenOhneZeit: false });
    expect(darstellungLesen(s)).toEqual({ ...DARSTELLUNG_VORGABE, zeilen: 'gross', aufgabenOhneZeit: false });
    darstellungSchreiben({ ...DARSTELLUNG_VORGABE }, s);
    expect(s.m.has(DARSTELLUNG_MERKER)).toBe(false);
    s.m.set(DARSTELLUNG_MERKER, '{kaputt');
    expect(darstellungLesen(s)).toEqual(DARSTELLUNG_VORGABE);
    expect(darstellungLesen(null)).toEqual(DARSTELLUNG_VORGABE);
    expect(darstellungSchreiben(DARSTELLUNG_VORGABE, null)).toBe(false);
  });
  it('Zoom: Rad nach oben = größer, je Ereignis höchstens ±25 %, geklemmt; die Minute unter dem Zeiger bleibt stehen', () => {
    expect(radZoomFaktor(-100)).toBeGreaterThan(1);
    expect(radZoomFaktor(100)).toBeLessThan(1);
    expect(radZoomFaktor(-100000)).toBe(1.25);
    expect(radZoomFaktor(100000)).toBe(0.8);
    expect(radZoomFaktor(0)).toBe(1);
    expect(radZoomFaktor(-3, 1)).toBeCloseTo(Math.exp(48 * 0.0025)); // Zeilen-Modus: 3 Zeilen ≈ 48 px
    expect(zoomMal(2.4, 1.25)).toBe(ZOOM.max);
    expect(zoomMal(1, 1.1)).toBe(1.1);
    // 10:00 lag 200 px unter dem oberen Rand; bei 1,8 px/min muss das Raster auf 600 · 1,8 − 200 = 880 rollen.
    expect(rollAnker(600, 1.8, 200)).toBe(880);
    expect(rollAnker(10, 1, 200)).toBe(0);
  });
  it('volle Höhe: Fenster − darüber − Handy-Leiste − Rand, nie unter dem Minimum', () => {
    expect(volleHoehe(900, 150)).toBe(738);
    expect(volleHoehe(812, 130, { unten: 72 })).toBe(598);
    expect(volleHoehe(400, 300)).toBe(320);
    expect(volleHoehe(Number.NaN, 0)).toBe(320);
  });
});

describe('Rollen beim Öffnen und 3 Tage am Handy', () => {
  it('Arbeitsbeginn aus den eigenen Business-freien Zeiten (Ende der Nacht), ganz freie Tage zählen nicht', () => {
    const fenster = [
      { start: '2026-10-05T19:00:00', ende: '2026-10-06T08:30:00' }, // Mo-Abend → Di 8:30
      { start: '2026-10-06T19:00:00', ende: '2026-10-07T08:00:00' }, // → Mi 8:00
      { start: '2026-10-10T00:00:00', ende: '2026-10-12T00:00:00' }, // Wochenende ganz frei
    ];
    expect(arbeitsbeginnAus(fenster, WOCHE)).toBe(8 * 60);
    expect(arbeitsbeginnAus([], WOCHE)).toBeNull();
    expect(arbeitsbeginnAus([{ start: '2026-10-05T12:00:00', ende: '2026-10-05T18:00:00' }], WOCHE)).toBeNull();
    expect(startMinute(WOCHE, '2026-09-29', 19 * 60, 8 * 60)).toBe(8 * 60);
    expect(startMinute(WOCHE, '2026-09-29', 19 * 60)).toBe(7 * 60);
    expect(startMinute(WOCHE, '2026-10-07', 19 * 60, 8 * 60)).toBe(18 * 60);
  });
  it('„4 Tage“ zeigt am Handy drei Tage (Kennung und Kürzel bleiben)', () => {
    expect(mehrereTage(true)).toBe(3);
    expect(mehrereTage(false)).toBe(4);
    expect(mehrereTageLabel(true)).toBe('3 Tage');
    expect(mehrereTageLabel(false)).toBe('4 Tage');
  });
});

describe('Lesbare Blöcke: Kontrast der Blockfläche', () => {
  // Wie #89 (tests/kalender-rk2.test.ts), aber mit der neuen, kräftigeren Fläche BLOCK_ALPHA.
  const lum = (x: string) => { const c = [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const mix = (f: string, b: string, a: number) => `#${[1, 3, 5].map(i => Math.round(parseInt(f.slice(i, i + 2), 16) * a + parseInt(b.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('')}`;
  const kr = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  it('Titel ≥ 4.5:1, Zeitzeile ≥ 4.5:1, Rand ≥ 3:1 — für alle Art-, Termin- und Bereichsfarben', () => {
    const farben = [...Object.values(ART_INFO).map(a => a.farbe).filter((f): f is string => !!f), ...Object.values(ART_FARBE), ...TERMIN_FARBEN.map(f => f.hex), LEUCHT.puls, LEUCHT.beziehung, LEUCHT.geld, LEUCHT.kritisch];
    for (const f of farben) {
      const flaeche = mix(f, FARBE.grund, BLOCK_ALPHA / 255);
      expect(kr(FARBE.ink, flaeche), `Titel auf ${f}`).toBeGreaterThanOrEqual(4.5);
      expect(kr(FARBE.inkDim, flaeche), `Zeit auf ${f}`).toBeGreaterThanOrEqual(4.5);
      expect(kr(f, flaeche), `Rand ${f}`).toBeGreaterThanOrEqual(3);
    }
  });
});

const termin = (t: Partial<KTermin> & Pick<KTermin, 'start' | 'ende' | 'titel'>): KTermin => ({ id: `k|${t.titel}`, uid: t.titel, ganztags: false, kalender: 'Arbeit', wer: 'beide', serie: false, mitTeilnehmern: false, bearbeitbar: true, ...t });
const aufgabe = (id: string, tag: string, start?: string): KalenderAufgabe => ({ id, title: `Aufgabe ${id}`, done: false, tag, ...(start ? { start } : {}) });
const rasterProps = (extra: Record<string, unknown> = {}) => ({
  start: '2026-10-05', anzahl: 7, heute: '2026-09-29', termine: [] as KTermin[], fristen: [], erinnerungen: [], aufgaben: [] as KalenderAufgabe[], farbe: () => '#4FC3F7',
  onOeffnen: () => {}, onNeu: () => {}, onVerschieben: () => {}, onAufgabe: () => {}, onAufgabeHaken: () => {}, ...extra,
});

describe('Oberfläche: Raster und Monat', () => {
  it('eine Aufgabe vom Start bis zur Deadline steht EINMAL als Balken (vorher je Tag einzeln)', () => {
    const html = renderToStaticMarkup(h(VierTage, rasterProps({ aufgaben: [aufgabe('lang', '2026-10-09', '2026-10-05')] })));
    expect(html.match(/data-ganztags-eintrag="a:lang"/g)).toHaveLength(1);
    expect(html).toContain('grid-column:1 / 6');
  });
  it('mehr als zwei Bahnen: „+n“ je Tag; „Aufgaben ohne Uhrzeit“ aus → keine Aufgaben in der Ganztags-Zeile', () => {
    const aufgaben = ['a', 'b', 'c', 'd'].map(id => aufgabe(id, '2026-10-07', '2026-10-06'));
    const html = renderToStaticMarkup(h(VierTage, rasterProps({ aufgaben })));
    expect(html.match(/data-ganztags-eintrag=/g)).toHaveLength(2);
    expect(html).toContain('2 weitere ganztägige Einträge am 6. zeigen');
    expect(html).toContain('aria-label="Alles Ganztägige zeigen"');
    const ohne = renderToStaticMarkup(h(VierTage, rasterProps({ aufgaben, aufgabenGanztags: false })));
    expect(ohne).not.toContain('data-ganztags-eintrag=');
  });
  it('Bedienungshilfe nur, wenn an; Planen-Stunden im Tageskopf; Termine lesbar mit Titel und Uhrzeit', () => {
    const t = termin({ titel: 'Abstimmung Team', start: '2026-10-06T10:00:00', ende: '2026-10-06T10:30:00' });
    const mit = renderToStaticMarkup(h(VierTage, rasterProps({ termine: [t], hilfe: true, onHilfe: () => {}, tagZusatz: { '2026-10-06': { text: '6,5 h' } } })));
    expect(mit).toContain(RASTER_HILFE.slice(0, 30));
    expect(mit).toContain('6,5 h');
    expect(mit).toContain('Abstimmung Team');
    expect(mit).toContain(', 10:00'); // kurzer Termin: „Titel, 10:00“ in einer Zeile
    const ohne = renderToStaticMarkup(h(VierTage, rasterProps({ termine: [t], hilfe: false, onHilfe: () => {} })));
    expect(ohne).not.toContain(RASTER_HILFE.slice(0, 30));
    expect(ohne).toContain('aria-label="Bedienungshilfe zeigen"');
  });
  it('Monat: ein mehrtägiger ganztägiger Termin ist je Woche EIN Balken, keine Pille je Tag', () => {
    const blatt = Array.from({ length: 42 }, (_, i) => tagPlus('2026-09-28', i));
    const urlaub = termin({ titel: 'Urlaub', ganztags: true, start: '2026-10-08T00:00:00', ende: '2026-10-14T00:00:00' }); // Do 08. – Di 13.
    const html = renderToStaticMarkup(h(Monat, { blatt, monat: 10, heute: '2026-10-01', termine: [urlaub], fristen: [], erinnerungen: [], farbe: () => '#4FC3F7', onTag: () => {}, onOeffnen: () => {} }));
    expect(html.match(/data-monat-balken="k\|Urlaub"/g)).toHaveLength(2); // Woche 05.–11. und 12.–18.
    expect(html.match(/>Urlaub</g)).toHaveLength(2);
  });
});

describe('Quelle: Kalender-Seite hängt alles ein', () => {
  const k = lies('components/os/kalender/Kalender.tsx');
  const z = lies('components/os/kalender/Zeitraster.tsx');
  it('volle Höhe statt fester Rechnung, kein sichtbarer Seitenkopf, eine Kopfzeile', () => {
    expect(k).toContain('useVolleHoehe(flaeche)');
    expect(k).not.toContain('calc(100vh - 190px)');
    expect(k).toContain('<Seite titel="Kalender" className="kalender-seite"');
    expect(k).not.toMatch(/<Seite[^>]*unter=/);
    expect(k).toContain('<AbgleichPunkte');
    expect(k).not.toContain('<AbgleichStand');
    expect(k).toContain('<DarstellungKnopf />');
    expect(k).toContain('zeitraumText(ansicht, tage, anker)');
    expect(lies('app/globals.css')).toContain('.kalender-seite > .ui-kopf { position: absolute;');
  });
  it('Raster: Zoom nur mit Strg/⌘ im Raster (nicht-passiv), Business-frei ruhig statt kräftig', () => {
    expect(z).toMatch(/if \(!\(e\.ctrlKey \|\| e\.metaKey\) \|\| !onZoomRef\.current\) return;/);
    expect(z).toContain("addEventListener('wheel', rad, { passive: false })");
    expect(z).not.toMatch(/LEUCHT\.beziehung/);
    expect(z).toContain('FREI_SCHRAFFUR');
  });
  it('die Darstellung steht auch unter Einstellungen › Bedienung', () => {
    expect(lies('components/os/BedienungView.tsx')).toContain('<DarstellungFelder />');
  });
});
