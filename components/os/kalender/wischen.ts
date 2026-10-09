// ─── Kalender: Wischen blättert vor/zurück (09.10.) ─────────────────────────────────────────────────────────────────────────────
// Kevin 09.10.: „Wenn ich mit 2 Fingern nach links wische, soll die nächste Woche angezeigt werden, nach rechts wieder zurück.“
// Gilt in Tag · 4 Tage · Woche · Monat (nicht in Jahr, Termine und im Aufgaben-Modus) und ruft DIESELBE Funktion wie die Pfeile
// (`springe` in Kalender.tsx) — also nächster/voriger Zeitraum der Ansicht.
//
// Zwei Wege, beide rein geregelt (Test: tests/kalender-wischen.test.ts):
//   • Trackpad (Mac, auch iPad mit Trackpad): zwei Finger waagerecht = `wheel` mit überwiegend `deltaX`. Aufsummiert, ab `schwelle`
//     ein Schritt; danach eine Sperre (~600 ms, verlängert sich, solange der Schwung nachläuft — höchstens `maxSperreMs`), damit ein
//     Wischer nie zwei Wochen springt. Senkrechtes Rollen (auch schräg, solange `deltaY` nicht deutlich kleiner ist) bleibt beim Raster.
//     Richtung wie beim Rollen: `deltaX > 0` = weiter. Mit „natürlichem Scrollen“ (Vorgabe am Mac) heißt das: Finger nach LINKS =
//     nächste Woche. `preventDefault` NUR bei einem waagerechten Wischer — sonst löst der Browser seine Zurück-Geste aus; senkrecht
//     bleibt alles beim Browser. Pinch (ctrlKey) und gedrückte Maustaste (Ziehen) zählen nie.
//   • Touch (Handy/iPad ohne Trackpad): EIN Finger auf der Kopfzeile der Tage (`data-wisch-kopf`, `touch-action: pan-y`).
//     Entscheidung: zwei Finger am Handy gehen nicht sauber — iOS ignoriert `maximum-scale` und zoomt bei zwei Fingern (Pinch), und
//     einhändig ist es unbequem. Ein Finger im RASTER kollidiert mit Rollen, Aufziehen und Verschieben (350 ms Halten). Die Kopfzeile
//     rollt nicht und trägt keine Knöpfe — dort ist ein waagerechter Wischer eindeutig.
// Nie während Ziehen/Aufziehen (`data-kalender-zieht` am Raster, gedrückte Taste) und nie, solange ein Fenster/Dialog offen ist.

import { useEffect, useRef, type RefObject } from 'react';
import type { KalenderAnsicht, Modus } from '@/lib/kalender/modus';

export const WISCH = {
  /** Aufsummierte Pixel bis zum Schritt (Trackpad). */
  schwelle: 60,
  /** Sperre nach einem Schritt. */
  sperreMs: 600,
  /** Solange der Schwung nachläuft, hält er die Sperre um so viel offen … */
  nachlaufMs: 140,
  /** … höchstens bis so lange nach dem Schritt. */
  maxSperreMs: 1400,
  /** Längere Pause zwischen zwei Rad-Ereignissen = neuer Ansatz (Summe beginnt bei 0). */
  pauseMs: 250,
  /** Waagerecht nur, wenn |dx| deutlich größer ist als |dy|. */
  dominanz: 1.5,
  /** Touch auf der Kopfzeile: Mindestweg in Pixeln. */
  touchSchwelle: 50,
} as const;

/** Wo Wischen blättert. */
export const WISCH_ANSICHTEN: readonly KalenderAnsicht[] = ['tag', 'vier', 'woche', 'monat'];

export const wischenAktiv = (ansicht: KalenderAnsicht, modus: Modus): boolean => modus !== 'aufgaben' && WISCH_ANSICHTEN.includes(ansicht);

export type Richtung = -1 | 0 | 1;

export interface RadZustand { summe: number; letzte: number; gesperrtBis: number; ausgeloestAm: number; /** Richtung des letzten Schritts. */ richtung: Richtung }
export const RAD_START: RadZustand = { summe: 0, letzte: Number.NEGATIVE_INFINITY, gesperrtBis: Number.NEGATIVE_INFINITY, ausgeloestAm: Number.NEGATIVE_INFINITY, richtung: 0 };

export interface RadEreignis {
  deltaX: number; deltaY: number;
  /** 0 Pixel · 1 Zeilen · 2 Seiten (WheelEvent.deltaMode). */
  deltaMode?: number;
  /** Pinch-Zoom am Trackpad kommt als `wheel` mit ctrlKey. */
  ctrlKey?: boolean;
  /** Zeitstempel in ms (performance.now bzw. event.timeStamp). */
  zeit: number;
}
export interface RadErgebnis { zustand: RadZustand; richtung: Richtung; /** preventDefault? Nur bei einem waagerechten Wischer. */ abfangen: boolean }

const PIXEL_JE_MODUS = [1, 16, 400];
const pixel = (d: number, modus = 0) => d * (PIXEL_JE_MODUS[modus] ?? 1);

/**
 * Ein Rad-Ereignis. `blockiert` = gerade Ziehen/Aufziehen, Taste gedrückt oder ein Fenster offen — dann gehört das Ereignis dem Browser.
 */
export function radSchritt(z: RadZustand, e: RadEreignis, blockiert: boolean): RadErgebnis {
  if (blockiert || e.ctrlKey) return { zustand: { ...z, summe: 0 }, richtung: 0, abfangen: false };
  const dx = pixel(e.deltaX, e.deltaMode), dy = pixel(e.deltaY, e.deltaMode);
  const waagerecht = dx !== 0 && Math.abs(dx) > WISCH.dominanz * Math.abs(dy);
  if (!waagerecht) return { zustand: { ...z, summe: 0, letzte: e.zeit }, richtung: 0, abfangen: false };
  // Gesperrt: der Schwung desselben Wischers — abfangen (sonst Zurück-Geste), nichts auslösen, Sperre nachziehen (gedeckelt).
  // Nach der Mindest-Sperre löst ein Wischer in die GEGENRICHTUNG sie (Schwung kehrt nie um — das ist ein neuer Wischer).
  const gegenrichtung = e.zeit >= z.ausgeloestAm + WISCH.sperreMs && Math.sign(dx) !== z.richtung;
  if (e.zeit < z.gesperrtBis && !gegenrichtung) {
    const gesperrtBis = Math.min(z.ausgeloestAm + WISCH.maxSperreMs, Math.max(z.gesperrtBis, e.zeit + WISCH.nachlaufMs));
    return { zustand: { ...z, summe: 0, letzte: e.zeit, gesperrtBis }, richtung: 0, abfangen: true };
  }
  // Gegenrichtung löst die Sperre: die Summe beginnt neu, die Sperre ist vorbei (`gesperrtBis` zurück).
  const frei = e.zeit < z.gesperrtBis ? { ...z, summe: 0, gesperrtBis: Number.NEGATIVE_INFINITY } : z;
  const summe = (e.zeit - frei.letzte > WISCH.pauseMs ? 0 : frei.summe) + dx;
  if (Math.abs(summe) >= WISCH.schwelle) {
    const richtung: Richtung = summe > 0 ? 1 : -1;
    return { zustand: { summe: 0, letzte: e.zeit, gesperrtBis: e.zeit + WISCH.sperreMs, ausgeloestAm: e.zeit, richtung }, richtung, abfangen: true };
  }
  return { zustand: { ...frei, summe, letzte: e.zeit }, richtung: 0, abfangen: true };
}

/** Touch auf der Kopfzeile: Finger nach links (dx < 0) = weiter, nach rechts = zurück; senkrecht oder zu kurz = nichts. */
export function kopfWischRichtung(dx: number, dy: number): Richtung {
  if (Math.abs(dx) < WISCH.touchSchwelle || Math.abs(dx) <= WISCH.dominanz * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

/** Steht gerade etwas im Weg? (Ziehen im Raster, gedrückte Taste, offenes Fenster/Dialog.) */
function imWeg(wurzel: HTMLElement, buttons: number): boolean {
  if (buttons !== 0) return true;
  if (wurzel.querySelector('[data-kalender-zieht]')) return true;
  return !!document.querySelector('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
}

/**
 * Hängt beide Wege an `ref` (den Inhalt des Kalenders). `weiter` ist dieselbe Funktion wie die Pfeile.
 * Der Rad-Hörer ist nicht-passiv (React-Hörer sind passiv — `preventDefault` ginge dort nicht).
 */
export function useKalenderWischen(ref: RefObject<HTMLElement | null>, opt: { aktiv: boolean; weiter: (r: -1 | 1) => void }): void {
  const optRef = useRef(opt);
  optRef.current = opt;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let rad: RadZustand = RAD_START;
    let kopf: { id: number; x: number; y: number } | null = null;
    const amRad = (e: WheelEvent) => {
      const { aktiv, weiter } = optRef.current;
      const r = radSchritt(rad, { deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, ctrlKey: e.ctrlKey, zeit: e.timeStamp }, !aktiv || imWeg(el, e.buttons));
      rad = r.zustand;
      if (r.abfangen) e.preventDefault();
      if (r.richtung) weiter(r.richtung);
    };
    const runter = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !optRef.current.aktiv) return;
      kopf = (e.target as HTMLElement | null)?.closest?.('[data-wisch-kopf]') ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
    };
    const hoch = (e: PointerEvent) => {
      const k = kopf; kopf = null;
      if (!k || k.id !== e.pointerId || !optRef.current.aktiv || imWeg(el, 0)) return;
      const r = kopfWischRichtung(e.clientX - k.x, e.clientY - k.y);
      if (r) optRef.current.weiter(r);
    };
    const abbruch = () => { kopf = null; };
    el.addEventListener('wheel', amRad, { passive: false });
    el.addEventListener('pointerdown', runter);
    el.addEventListener('pointerup', hoch);
    el.addEventListener('pointercancel', abbruch);
    return () => {
      el.removeEventListener('wheel', amRad);
      el.removeEventListener('pointerdown', runter);
      el.removeEventListener('pointerup', hoch);
      el.removeEventListener('pointercancel', abbruch);
    };
  }, [ref]);
}
