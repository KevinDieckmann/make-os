// ─── MAKE OS — Kugel: Bedienung am Element (16.10.2026) ──────────────────────
// Kevin: „Das Brain muss zoombar sein … am besten wie beim MacBook auf dem Touchpad.“ und „das muss beweglicher sein“.
// Hängt Zoom, Drehen, Verschieben und Tastatur an EIN Element (die Fläche der Brain-Kugel) — nie an Fenster oder Dokument:
// außerhalb der Kugel rollt die Seite wie immer. Rad, Geste und Touch mit { passive: false }, damit preventDefault wirkt.
//   · Pinch: Chrome/Firefox melden ihn als Rad mit ctrlKey, Safari als gesturestart/-change/-end (`scale`); ⌘/Strg + Mausrad
//     ebenso → Zoom zum Punkt unter dem Zeiger.
//   · Zwei-Finger-Wischen (Trackpad) dreht, mit ⇧ verschiebt es. Ein Mausrad ohne ⌘/Strg bleibt bei der Seite (+ kurzer Hinweis)
//     — welche Art es ist, sagt `radArt` (steuerung.ts).
//   · Ziehen (Maus links, ein Finger) dreht ab ZIEH_SCHWELLE px, mit ⇧ verschiebt es; Loslassen → Schwung. Darunter ist es ein
//     Klick (der Stern öffnet sich wie bisher — `warZiehen` sagt der Ansicht, wann nicht). Zwei Finger: Pinch + Verschieben.
//   · Doppelklick zoomt zum Punkt; Tasten + − 0, Pfeile drehen, ⇧ + Pfeil verschiebt.
// Die Werte hält der Motor (keine React-Zustände je Bild); hier steht nur, welche Eingabe was auslöst.

import type { Motor } from './motor';
import { istZiehen, radArt, radFaktor, schwungAus, tasteAktion, LUPE_MAX, type Probe, type RadStand } from './steuerung';

/** Alle Lauscher — nur am übergebenen Element (Wächter tests/kugel-steuerung.test.ts). */
export const EINGABE_LAUSCHER = ['wheel', 'gesturestart', 'gesturechange', 'gestureend', 'touchmove', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'dblclick', 'keydown'] as const;
/** Diese brauchen preventDefault — also nie passiv. */
export const AKTIVE_LAUSCHER: readonly string[] = ['wheel', 'gesturestart', 'gesturechange', 'gestureend', 'touchmove'];

export interface EingabeOptionen {
  /** Der Motor wird bei Änderungen neu gestartet — deshalb immer frisch holen. */
  motor: () => Motor | null;
  /** Taste 0 und Doppelklick ganz drinnen: zurück auf das Ausgangsbild (die Ansicht beendet auch den Bereichs-Fokus). */
  zuruecksetzen: () => void;
  /** Mausrad ohne ⌘/Strg über der Kugel: die Seite rollt weiter — kurz den Hinweis zeigen. */
  hinweis?: () => void;
  uhr?: () => number;
}

export interface KugelEingabe {
  /** Gerade wird gezogen bzw. mit zwei Fingern bedient (kein Zeigen von Sternen). */
  zieht(): boolean;
  /** Die letzte Berührung war Ziehen oder Pinch — ihr Loslassen ist kein Klick. */
  warZiehen(): boolean;
  abbauen(): void;
}

interface Ort { x: number; y: number }
interface Finger extends Ort { touch: boolean }
/** Safari: GestureEvent steht nicht in den DOM-Typen. */
interface GestenEreignis extends Event { scale: number; clientX: number; clientY: number }

export function kugelEingabe(el: HTMLElement, o: EingabeOptionen): KugelEingabe {
  const uhr = o.uhr ?? (() => performance.now());
  const ort = (e: { clientX: number; clientY: number }): Ort => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  /** Knöpfe, Links und Felder in der Fläche behalten ihr eigenes Verhalten. */
  const bedienelement = (z: EventTarget | null) => !!(z as Element | null)?.closest?.('button,a,input,textarea,select');

  let rad: RadStand | null = null;
  let geste: number | null = null;
  const finger = new Map<number, Finger>();
  let zug: { id: number; start: Ort; letzt: Ort; aktiv: boolean; verschoben: boolean; proben: Probe[] } | null = null;
  let pinch: { abstand: number; mitte: Ort } | null = null;
  let gezogen = false;
  let zeigerVorher: string | null = null;

  const touchFinger = () => [...finger.values()].filter(f => f.touch);
  const zweiFinger = () => touchFinger().length >= 2;
  const pinchStand = () => {
    const [a, b] = touchFinger();
    return a && b ? { abstand: Math.hypot(a.x - b.x, a.y - b.y), mitte: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } } : null;
  };
  const zugEnde = (id: number, mitSchwung: boolean) => {
    if (!zug || zug.id !== id) return;
    if (zug.aktiv) {
      const v = mitSchwung && !zug.verschoben ? schwungAus(zug.proben, uhr()) : { x: 0, y: 0 };
      o.motor()?.loslassen(v.x, v.y);
      if (zeigerVorher !== null) { el.style.cursor = zeigerVorher; zeigerVorher = null; }
      try { el.releasePointerCapture?.(id); } catch { /* Zeiger schon frei */ }
    }
    zug = null;
  };

  const radGedreht = (e: WheelEvent) => {
    const m = o.motor();
    if (!m) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (geste !== null) return; // Safari meldet denselben Pinch als Geste
      const p = ort(e);
      m.zoome(radFaktor(e.deltaY, e.deltaMode), p.x, p.y);
      return;
    }
    rad = radArt({ deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, wheelDeltaY: (e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY, shiftKey: e.shiftKey }, rad, uhr());
    if (rad.art !== 'trackpad') { o.hinweis?.(); return; } // Mausrad (oder noch unklar): die Seite rollt weiter
    e.preventDefault();
    // Wie beim Blättern folgt der Inhalt den Fingern.
    if (e.shiftKey) m.verschiebe(-e.deltaX, -e.deltaY); else m.drehe(-e.deltaX, -e.deltaY);
  };

  const gesteStart = (e: Event) => { e.preventDefault(); if (zweiFinger()) return; geste = (e as GestenEreignis).scale || 1; };
  const gesteWechsel = (e: Event) => {
    e.preventDefault();
    const g = e as GestenEreignis;
    // Am iPhone kommt der Pinch zusätzlich über die Zeiger — dort zählt nur der Zeiger-Weg.
    if (geste === null || zweiFinger() || !(g.scale > 0)) return;
    const p = ort(g);
    o.motor()?.zoome(g.scale / geste, p.x, p.y);
    geste = g.scale;
  };
  const gesteEnde = (e: Event) => { e.preventDefault(); geste = null; };

  /** Zwei Finger: die Seite soll dabei weder rollen noch zoomen. */
  const touchBewegt = (e: TouchEvent) => { if (e.touches.length >= 2 && e.cancelable) e.preventDefault(); };

  const runter = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (bedienelement(e.target)) return;
    if (!finger.size) gezogen = false;
    const p = ort(e);
    finger.set(e.pointerId, { ...p, touch: e.pointerType !== 'mouse' });
    if (finger.size === 1) { zug = { id: e.pointerId, start: p, letzt: p, aktiv: false, verschoben: false, proben: [{ t: uhr(), ...p }] }; return; }
    if (zweiFinger()) {
      if (zug) zugEnde(zug.id, false);
      gezogen = true;
      pinch = pinchStand();
    }
  };

  const bewegt = (e: PointerEvent) => {
    const f = finger.get(e.pointerId);
    if (!f) return;
    const p = ort(e);
    finger.set(e.pointerId, { ...p, touch: f.touch });
    const m = o.motor();
    if (!m) return;
    if (pinch) {
      const neu = pinchStand();
      if (!neu) return;
      if (pinch.abstand > 0 && neu.abstand > 0) m.zoome(neu.abstand / pinch.abstand, neu.mitte.x, neu.mitte.y);
      m.verschiebe(neu.mitte.x - pinch.mitte.x, neu.mitte.y - pinch.mitte.y);
      pinch = neu;
      return;
    }
    if (!zug || zug.id !== e.pointerId) return;
    if (!zug.aktiv) {
      if (!istZiehen(p.x - zug.start.x, p.y - zug.start.y)) return;
      zug.aktiv = true; gezogen = true;
      m.greifen();
      try { el.setPointerCapture?.(e.pointerId); } catch { /* Zeiger schon weg */ }
      zeigerVorher = el.style.cursor; el.style.cursor = 'grabbing';
    }
    const dx = p.x - zug.letzt.x, dy = p.y - zug.letzt.y;
    if (e.shiftKey) { m.verschiebe(dx, dy); zug.verschoben = true; } else { m.drehe(dx, dy); zug.verschoben = false; }
    zug.letzt = p;
    zug.proben.push({ t: uhr(), ...p });
    if (zug.proben.length > 12) zug.proben.shift();
  };

  const hoch = (e: PointerEvent) => {
    if (!finger.delete(e.pointerId)) return;
    if (pinch) { if (!zweiFinger()) pinch = null; zug = null; return; }
    zugEnde(e.pointerId, e.type === 'pointerup');
  };

  const doppelklick = (e: MouseEvent) => {
    if (bedienelement(e.target)) return;
    const m = o.motor();
    if (!m) return;
    e.preventDefault();
    if (m.kameraStand().s >= LUPE_MAX - 0.01) { o.zuruecksetzen(); return; }
    const p = ort(e);
    m.zoome(2, p.x, p.y);
  };

  const taste = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return; // ⌘ + / ⌘ − bleibt der Zoom des Browsers
    if ((e.target as Element | null)?.closest?.('input,textarea,select')) return;
    const a = tasteAktion(e.key, e.shiftKey);
    const m = o.motor();
    if (!a || !m) return;
    e.preventDefault();
    if (a.art === 'zoom') m.zoome(a.faktor);
    else if (a.art === 'drehen') m.drehe(a.dx, a.dy);
    else if (a.art === 'verschieben') m.verschiebe(a.dx, a.dy);
    else o.zuruecksetzen();
  };

  const lauscher: Record<(typeof EINGABE_LAUSCHER)[number], (e: never) => void> = {
    wheel: radGedreht, gesturestart: gesteStart, gesturechange: gesteWechsel, gestureend: gesteEnde, touchmove: touchBewegt,
    pointerdown: runter, pointermove: bewegt, pointerup: hoch, pointercancel: hoch, dblclick: doppelklick, keydown: taste,
  };
  const optionen = (typ: string): AddEventListenerOptions | undefined => (AKTIVE_LAUSCHER.includes(typ) ? { passive: false } : undefined);
  for (const typ of EINGABE_LAUSCHER) el.addEventListener(typ, lauscher[typ] as EventListener, optionen(typ));

  return {
    zieht: () => !!zug?.aktiv || !!pinch,
    warZiehen: () => gezogen,
    abbauen() {
      for (const typ of EINGABE_LAUSCHER) el.removeEventListener(typ, lauscher[typ] as EventListener, optionen(typ));
      if (zug?.aktiv) o.motor()?.loslassen(0, 0);
      if (zeigerVorher !== null) el.style.cursor = zeigerVorher;
      finger.clear(); zug = null; pinch = null;
    },
  };
}
