// ─── Standard · Fläche — Zoom und Schieben am Element (17.10.) ─────────────────────────────────────────────────────────────────────────
// Vorbild und Rechnung: die Brain-Kugel (components/os/kugel/eingabe.ts, steuerung.ts) — dieselbe Erkennung von Pinch, Mausrad und Trackpad, dieselbe Regel
// „nur am Element“: Rad, Geste und Touch hängen mit { passive: false } an der FLÄCHE, nie an Fenster oder Dokument — außerhalb rollt die Seite wie immer.
//   · Pinch (Chrome/Firefox: Rad mit ctrlKey, Safari: gesture*) und ⌘/Strg + Mausrad → Zoom zum Punkt unter dem Zeiger.
//   · Zwei-Finger-Wischen am Trackpad → verschieben (wie in Miro). Ein Mausrad ohne ⌘/Strg bleibt bei der Seite (+ kurzer Hinweis).
//   · Leertaste + Ziehen, die mittlere Maustaste, zwei Finger (Touch: Pinch + Schieben) → verschieben; mit `freiSchiebt` auch Ziehen auf freier Fläche
//     (nur ansehen). Alles andere (Knoten ziehen, Pfeile, Aufziehen) gehört der Ansicht — sie fragt `schiebt()`, ob gerade geschoben wird.
// Die Werte hält die Ansicht in Refs (keine React-Zustände je Bewegung); hier steht nur, welche Eingabe was auslöst.

import { istZiehen, radArt, radFaktor, type RadStand } from '../../kugel/steuerung';
import { verschiebe, zoomUm, type Kamera } from './kamera';

/** Alle Lauscher — nur am übergebenen Element (Wächter tests/fulfillment-flaeche-oberflaeche.test.ts). */
export const FLAECHE_LAUSCHER = ['wheel', 'gesturestart', 'gesturechange', 'gestureend', 'touchmove', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'keydown', 'keyup', 'blur'] as const;
/** Diese brauchen preventDefault — also nie passiv. */
export const FLAECHE_AKTIV: readonly string[] = ['wheel', 'gesturestart', 'gesturechange', 'gestureend', 'touchmove'];

export interface FlaecheEingabeOptionen {
  kamera: () => Kamera;
  /** Neue Kamera — die Ansicht zeichnet im nächsten Bild (requestAnimationFrame). */
  setze: (k: Kamera) => void;
  /** Ziehen mit der Maus auf freier Fläche schiebt (z. B. „nur ansehen“). */
  freiSchiebt?: () => boolean;
  /** Ist das Ziel freie Fläche (kein Knoten, kein Rahmen-Titel, kein Anfasser)? */
  istFrei?: (z: EventTarget | null) => boolean;
  /** Mausrad ohne ⌘/Strg über der Fläche: die Seite rollt weiter — kurz den Hinweis zeigen. */
  hinweis?: () => void;
  /**
   * Das Mausrad verschiebt die Fläche (22.10., Werkstatt bau-fertig: im Werkzeugmodus füllt die Fläche den Bildschirm — es gibt keine Seite zum Rollen). ⇧ + Rad
   * verschiebt waagerecht. Ohne Angabe wie bisher (das Rad bleibt bei der Seite).
   */
  radSchiebt?: () => boolean;
  uhr?: () => number;
}

export interface FlaecheEingabe {
  /** Gerade wird geschoben bzw. mit zwei Fingern bedient — die Ansicht zieht dann nichts. */
  schiebt(): boolean;
  /** Die Leertaste ist gedrückt (Zeiger „Hand“). */
  leertaste(): boolean;
  abbauen(): void;
}

interface Ort { x: number; y: number }
interface GestenEreignis extends Event { scale: number; clientX: number; clientY: number }

export function flaecheEingabe(el: HTMLElement | SVGElement, o: FlaecheEingabeOptionen): FlaecheEingabe {
  const uhr = o.uhr ?? (() => performance.now());
  const ort = (e: { clientX: number; clientY: number }): Ort => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const feld = (z: EventTarget | null) => !!(z as Element | null)?.closest?.('input,textarea,select,[contenteditable="true"]');

  let rad: RadStand | null = null;
  let geste: number | null = null;
  let leer = false;
  const finger = new Map<number, Ort & { touch: boolean }>();
  let zug: { id: number; letzt: Ort; aktiv: boolean } | null = null;
  let pinch: { abstand: number; mitte: Ort } | null = null;
  let zeigerVorher: string | null = null;

  const touchFinger = () => [...finger.values()].filter(f => f.touch);
  const pinchStand = () => {
    const [a, b] = touchFinger();
    return a && b ? { abstand: Math.hypot(a.x - b.x, a.y - b.y), mitte: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } } : null;
  };
  const zeiger = (c: string | null) => {
    const s = (el as HTMLElement).style;
    if (c === null) { if (zeigerVorher !== null) { s.cursor = zeigerVorher; zeigerVorher = null; } return; }
    if (zeigerVorher === null) zeigerVorher = s.cursor;
    s.cursor = c;
  };

  const radGedreht = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (geste !== null) return; // Safari meldet denselben Pinch als Geste
      const p = ort(e);
      o.setze(zoomUm(o.kamera(), radFaktor(e.deltaY, e.deltaMode), p.x, p.y));
      return;
    }
    rad = radArt({ deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, wheelDeltaY: (e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY, shiftKey: e.shiftKey }, rad, uhr());
    if (rad.art !== 'trackpad' && o.radSchiebt?.()) {
      e.preventDefault();
      const m = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1; // Zeilen bzw. Seiten (Firefox) in Bildpunkte
      o.setze(verschiebe(o.kamera(), (e.shiftKey ? -e.deltaY : -e.deltaX) * m, (e.shiftKey ? 0 : -e.deltaY) * m));
      return;
    }
    if (rad.art !== 'trackpad') { o.hinweis?.(); return; } // Mausrad (oder noch unklar): die Seite rollt weiter
    e.preventDefault();
    o.setze(verschiebe(o.kamera(), -e.deltaX, -e.deltaY));
  };
  const gesteStart = (e: Event) => { e.preventDefault(); if (touchFinger().length >= 2) return; geste = (e as GestenEreignis).scale || 1; };
  const gesteWechsel = (e: Event) => {
    e.preventDefault();
    const g = e as GestenEreignis;
    if (geste === null || touchFinger().length >= 2 || !(g.scale > 0)) return;
    const p = ort(g);
    o.setze(zoomUm(o.kamera(), g.scale / geste, p.x, p.y));
    geste = g.scale;
  };
  const gesteEnde = (e: Event) => { e.preventDefault(); geste = null; };
  const touchBewegt = (e: TouchEvent) => { if (e.touches.length >= 2 && e.cancelable) e.preventDefault(); };

  const runter = (e: PointerEvent) => {
    const touch = e.pointerType === 'touch';
    finger.set(e.pointerId, { ...ort(e), touch });
    if (touch && touchFinger().length >= 2) {
      // Zwei Finger: Pinch + Schieben — was die Ansicht mit dem ersten Finger begonnen hat, gilt nicht mehr.
      zug = null; pinch = pinchStand();
      e.stopPropagation();
      return;
    }
    if (feld(e.target)) return;
    const mitte = e.pointerType === 'mouse' && e.button === 1;
    const haupt = e.button === 0;
    const frei = haupt && !touch && !!o.freiSchiebt?.() && (o.istFrei ? o.istFrei(e.target) : true);
    if (!(mitte || (haupt && leer) || frei)) return;
    // Schieben gehört der Fläche: die Ansicht sieht diesen Zeiger nicht (kein Aufziehen, kein Ziehen eines Knotens).
    e.stopPropagation();
    e.preventDefault();
    (el as HTMLElement).focus?.({ preventScroll: true });
    zug = { id: e.pointerId, letzt: ort(e), aktiv: mitte || leer };
  };
  const bewegt = (e: PointerEvent) => {
    const f = finger.get(e.pointerId);
    if (!f) return;
    const p = ort(e);
    finger.set(e.pointerId, { ...p, touch: f.touch });
    if (pinch) {
      const neu = pinchStand();
      if (!neu) return;
      let k = o.kamera();
      if (pinch.abstand > 0 && neu.abstand > 0) k = zoomUm(k, neu.abstand / pinch.abstand, neu.mitte.x, neu.mitte.y);
      o.setze(verschiebe(k, neu.mitte.x - pinch.mitte.x, neu.mitte.y - pinch.mitte.y));
      pinch = neu;
      e.stopPropagation();
      return;
    }
    if (!zug || zug.id !== e.pointerId) return;
    if (!zug.aktiv) {
      if (!istZiehen(p.x - zug.letzt.x, p.y - zug.letzt.y)) return;
      zug.aktiv = true;
    }
    if (zeigerVorher === null) { zeiger('grabbing'); try { el.setPointerCapture?.(e.pointerId); } catch { /* Zeiger schon frei */ } }
    o.setze(verschiebe(o.kamera(), p.x - zug.letzt.x, p.y - zug.letzt.y));
    zug.letzt = p;
    e.stopPropagation();
  };
  const hoch = (e: PointerEvent) => {
    if (!finger.delete(e.pointerId)) return;
    if (pinch) { if (touchFinger().length < 2) pinch = null; zug = null; e.stopPropagation(); return; }
    if (zug && zug.id === e.pointerId) {
      zug = null;
      zeiger(leer ? 'grab' : null);
      try { el.releasePointerCapture?.(e.pointerId); } catch { /* Zeiger schon frei */ }
      e.stopPropagation();
    }
  };
  const taste = (e: KeyboardEvent) => {
    if (e.key !== ' ' || feld(e.target)) return;
    e.preventDefault(); // die Seite rollt nicht
    if (!leer) { leer = true; zeiger('grab'); }
  };
  const loslassen = (e: KeyboardEvent) => { if (e.key === ' ' && leer) { leer = false; if (!zug) zeiger(null); } };
  const weg = () => { leer = false; if (!zug) zeiger(null); };

  const lauscher: Record<(typeof FLAECHE_LAUSCHER)[number], (e: never) => void> = {
    wheel: radGedreht, gesturestart: gesteStart, gesturechange: gesteWechsel, gestureend: gesteEnde, touchmove: touchBewegt,
    pointerdown: runter, pointermove: bewegt, pointerup: hoch, pointercancel: hoch, keydown: taste, keyup: loslassen, blur: weg,
  };
  const optionen = (typ: string): AddEventListenerOptions | undefined => (FLAECHE_AKTIV.includes(typ) ? { passive: false } : typ === 'blur' ? { capture: true } : undefined);
  for (const typ of FLAECHE_LAUSCHER) el.addEventListener(typ, lauscher[typ] as EventListener, optionen(typ));

  return {
    schiebt: () => !!zug?.aktiv || !!pinch,
    leertaste: () => leer,
    abbauen() {
      for (const typ of FLAECHE_LAUSCHER) el.removeEventListener(typ, lauscher[typ] as EventListener, optionen(typ));
      zeiger(null);
      finger.clear(); zug = null; pinch = null; leer = false;
    },
  };
}
