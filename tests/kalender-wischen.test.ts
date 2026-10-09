// Kalender: Wischen blättert (09.10.). Kevin: „Wenn ich mit 2 Fingern nach links wische, soll die nächste Woche angezeigt werden, nach
// rechts wieder zurück.“ Geprüft: Schwelle, Richtung, Sperre gegen Mehrfachauslösung (auch bei nachlaufendem Schwung), senkrecht und
// Pinch werden nie abgefangen, blockiert (Ziehen/Dialog) gehört alles dem Browser, Touch auf der Kopfzeile, wo es gilt — und die Seite
// hängt es so ein (dieselbe Funktion wie die Pfeile, Kopfzeile markiert, Hinweis in der Hilfezeile).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RAD_START, WISCH, kopfWischRichtung, radSchritt, wischenAktiv, type RadZustand, type Richtung } from '@/components/os/kalender/wischen';

const lies = (rel: string) => readFileSync(path.resolve(__dirname, '..', rel), 'utf8');

/** Spielt eine Folge von Rad-Ereignissen ab und sammelt Schritte und Abfang-Entscheidungen. */
function spiele(folge: { dx: number; dy?: number; t: number; mode?: number; ctrl?: boolean }[], blockiert = false) {
  let z: RadZustand = RAD_START;
  const schritte: Richtung[] = [];
  const abgefangen: boolean[] = [];
  for (const e of folge) {
    const r = radSchritt(z, { deltaX: e.dx, deltaY: e.dy ?? 0, deltaMode: e.mode, ctrlKey: e.ctrl, zeit: e.t }, blockiert);
    z = r.zustand;
    if (r.richtung) schritte.push(r.richtung);
    abgefangen.push(r.abfangen);
  }
  return { schritte, abgefangen, z };
}

/** Ein Wischer: `n` Ereignisse alle 16 ms mit `dx` Pixeln. */
const wischer = (start: number, dx: number, n: number) => Array.from({ length: n }, (_, i) => ({ dx, t: start + i * 16 }));

describe('Kalender — Wischen am Trackpad', () => {
  it('unter der Schwelle passiert nichts, ab der Schwelle genau ein Schritt', () => {
    const klein = spiele(wischer(0, 10, Math.floor((WISCH.schwelle - 1) / 10)));
    expect(klein.schritte).toEqual([]);
    expect(klein.abgefangen.every(Boolean)).toBe(true); // waagerecht → abgefangen (keine Zurück-Geste), auch ohne Schritt
    expect(spiele(wischer(0, 10, 8)).schritte).toEqual([1]);
  });

  it('Richtung: deltaX > 0 (Finger nach links bei natürlichem Scrollen) = weiter, deltaX < 0 = zurück', () => {
    expect(spiele(wischer(0, 20, 4)).schritte).toEqual([1]);
    expect(spiele(wischer(0, -20, 4)).schritte).toEqual([-1]);
  });

  it('Sperre: ein langer Wischer mit Schwung springt nur EINEN Zeitraum, auch über 600 ms hinaus', () => {
    // 1,2 s lang Ereignisse (Schwung läuft nach) — der Nachlauf hält die Sperre offen.
    const lang = spiele(wischer(0, 30, 75));
    expect(lang.schritte).toEqual([1]);
    expect(lang.abgefangen.every(Boolean)).toBe(true);
  });

  it('Sperre ist gedeckelt: ein Strom ohne Ende hält sie höchstens maxSperreMs offen', () => {
    // 2 s lang alle 16 ms — nach der Höchstdauer zählt es wieder (nie für immer gesperrt).
    const lang = spiele(wischer(0, 30, 130));
    expect(lang.schritte).toEqual([1, 1]);
  });

  it('Gegenrichtung nach der Mindest-Sperre löst sofort (Schwung kehrt nie um), davor nicht', () => {
    // Schwung nach rechts läuft nach, dann wischt jemand zurück.
    const folge = [...wischer(0, 30, 50), ...wischer(50 * 16, -30, 3)];
    expect(spiele(folge).schritte).toEqual([1, -1]);
    // Innerhalb der 600 ms: zurück wird verschluckt.
    expect(spiele([...wischer(0, 30, 3), ...wischer(100, -30, 3)]).schritte).toEqual([1]);
  });

  it('zwei Wischer mit Pause: zwei Schritte; zwei Wischer innerhalb der Sperre: einer', () => {
    expect(spiele([...wischer(0, 40, 2), ...wischer(WISCH.sperreMs + 300, -40, 2)]).schritte).toEqual([1, -1]);
    expect(spiele([...wischer(0, 40, 2), ...wischer(300, 40, 2)]).schritte).toEqual([1]);
  });

  it('Pause setzt die Summe zurück: viele kleine, weit auseinander liegende Stöße lösen nie aus', () => {
    const folge = Array.from({ length: 20 }, (_, i) => ({ dx: 15, t: i * (WISCH.pauseMs + 50) }));
    expect(spiele(folge).schritte).toEqual([]);
  });

  it('senkrechtes (und schräges) Rollen wird nie abgefangen und zählt nicht', () => {
    const senkrecht = spiele(Array.from({ length: 30 }, (_, i) => ({ dx: 5, dy: 40, t: i * 16 })));
    expect(senkrecht.schritte).toEqual([]);
    expect(senkrecht.abgefangen.some(Boolean)).toBe(false);
    // Schräg: dx nur wenig größer als dy → gilt nicht als waagerecht.
    const schraeg = spiele(Array.from({ length: 30 }, (_, i) => ({ dx: 30, dy: 25, t: i * 16 })));
    expect(schraeg.schritte).toEqual([]);
    expect(schraeg.abgefangen.some(Boolean)).toBe(false);
    // Ein senkrechtes Ereignis mitten im Ansatz beginnt die Summe neu.
    expect(spiele([{ dx: 40, t: 0 }, { dx: 0, dy: 50, t: 16 }, { dx: 40, t: 32 }]).schritte).toEqual([]);
  });

  it('Pinch (ctrlKey) und blockiert (Ziehen, offenes Fenster) gehören dem Browser', () => {
    const pinch = spiele(wischer(0, 40, 5).map(e => ({ ...e, ctrl: true })));
    expect(pinch.schritte).toEqual([]);
    expect(pinch.abgefangen.some(Boolean)).toBe(false);
    const blockiert = spiele(wischer(0, 40, 5), true);
    expect(blockiert.schritte).toEqual([]);
    expect(blockiert.abgefangen.some(Boolean)).toBe(false);
  });

  it('Zeilen- und Seitenmodus (Firefox) werden in Pixel umgerechnet', () => {
    expect(spiele([{ dx: 2, t: 0, mode: 1 }, { dx: 2, t: 16, mode: 1 }]).schritte).toEqual([1]); // 2 × 16 px × 2
    expect(spiele([{ dx: -1, t: 0, mode: 2 }]).schritte).toEqual([-1]);
  });
});

describe('Kalender — Wischen auf der Kopfzeile (Touch)', () => {
  it('Finger nach links = weiter, nach rechts = zurück; kurz oder senkrecht = nichts', () => {
    expect(kopfWischRichtung(-80, 5)).toBe(1);
    expect(kopfWischRichtung(80, -5)).toBe(-1);
    expect(kopfWischRichtung(-(WISCH.touchSchwelle - 1), 0)).toBe(0);
    expect(kopfWischRichtung(-60, 60)).toBe(0);
    expect(kopfWischRichtung(0, 200)).toBe(0);
  });
});

describe('Kalender — wo Wischen gilt und wie die Seite es einhängt', () => {
  it('Tag, 4 Tage, Woche, Monat — nicht Jahr, Termine, nicht im Aufgaben-Modus', () => {
    for (const a of ['tag', 'vier', 'woche', 'monat'] as const) { expect(wischenAktiv(a, 'kalender')).toBe(true); expect(wischenAktiv(a, 'planen')).toBe(true); }
    expect(wischenAktiv('jahr', 'kalender')).toBe(false);
    expect(wischenAktiv('agenda', 'kalender')).toBe(false);
    expect(wischenAktiv('woche', 'aufgaben')).toBe(false);
  });

  it('Kalender.tsx ruft dieselbe Funktion wie die Pfeile, nicht über offenen Fenstern; Kopfzeilen markiert; Hinweis unter dem Raster', () => {
    const k = lies('components/os/kalender/Kalender.tsx');
    expect(k).toMatch(/useKalenderWischen\(inhalt, \{ aktiv: wischenAktiv\(ansicht, modus\) && !offen && !neu, weiter: springe \}\)/);
    expect(k).toMatch(/ref=\{inhalt\}[^>]*overscrollBehaviorX: 'none'/);
    const z = lies('components/os/kalender/Zeitraster.tsx');
    expect(z).toMatch(/data-wisch-kopf=""[^>]*touchAction: 'pan-y'/);
    expect(z).toMatch(/data-kalender-zieht=\{zieh\?\.aktiv \|\| aufzug\?\.aktiv \|\| ablage/);
    expect(z).toContain('wischen blättert');
    expect(lies('components/os/kalender/Monat.tsx')).toMatch(/data-wisch-kopf=""[^>]*touchAction: 'pan-y'/);
    // Nur der Rad-Hörer ist nicht-passiv; der Raster-Hörer für Touch bleibt, wie er ist.
    expect(lies('components/os/kalender/wischen.ts')).toMatch(/addEventListener\('wheel', amRad, \{ passive: false \}\)/);
  });
});
