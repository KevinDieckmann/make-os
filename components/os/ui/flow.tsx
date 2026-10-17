'use client';

// ─── Standard · Markenzeichen: der Flow — `FlowLinie` (17.10.; DESIGN_STANDARD.md › Markenzeichen: der Flow) ──────────────────────────────────
// Kevin 17.10.: „Denke dir auch immer den Flow, diese Linie, mit — das ist unser Markenzeichen.“ — „Nach und nach kommt alles in den Flow.“
// Die kleine Schnittstelle, mit der JEDE Ansicht mit Weg, Verlauf, Reihenfolge oder Fortschritt den Lichtfaden einhängt — ein paar Zeilen:
//   <FlowLinie punkte={[[0, 12], [480, 12]]} bisHier={0.4} ton={JETZT} />          ← ein Weg in Pixeln der Leinwand
//   <FlowLinie faeden={[…]} />                                                       ← mehrere Fäden
//   <FlowLinie messen={(eltern, leinwand) => […]} />                                 ← die Fäden aus dem Bild messen (Reise, Fluss)
// Die Leinwand liegt `position: absolute` in ihrem Eltern-Element (die Ansicht setzt Lage und Größe per CSS, Klasse `ff-flow-ebene`), ist `aria-hidden`
// (die Bedeutung steht schon in Text und Zeichen) und zeichnet über lib/lichtfaeden/flow.ts — denselben Zeichner wie die FadenLinie, im gemeinsamen Takt.
// Regeln: nie ohne echte Daten (ohne Weg zeigt sie nichts), reduzierte Bewegung bzw. `still` = Standbild ohne Takt, im Druck aus (CSS), pausiert außer
// Sicht. Solange sie läuft, trägt das Eltern-Element `data-flow="an"` — dort blendet CSS die ruhige Ersatz-Linie aus (Druck und Start zeigen sie).

import { useEffect, useRef, type CSSProperties } from 'react';
import { flowEbene, bewegungReduziert, type FlowEbene, type FlowFaden, type FlowPunkt, type FlowStaerke } from '@/lib/lichtfaeden/flow';
import { FARBE as C } from '@/lib/make-one/design';

export interface FlowLinieProps {
  /** Kurzform: EIN Weg (px der Leinwand, mindestens zwei Punkte). */
  punkte?: readonly FlowPunkt[];
  /** Bis wohin der Weg erreicht ist (0 … 1 der Länge) — davor hell, dahinter gedämpft. Vorgabe 1. */
  bisHier?: number;
  /** Farbe (#RRGGBB, ein Token) — Vorgabe der Akzent der Instanz. */
  ton?: string;
  staerke?: FlowStaerke;
  /** Leuchtpunkt an „Hier“ und Ausfransen dahinter (Zukunft). */
  hier?: boolean;
  frans?: boolean;
  /** Mehrere Fäden (px der Leinwand). */
  faeden?: readonly FlowFaden[];
  /** Die Fäden aus dem Bild messen — bekommt das Eltern-Element und die Lage der Leinwand; läuft beim Einhängen, nach jedem Zeichnen und bei neuer Größe. */
  messen?: (eltern: HTMLElement, leinwand: DOMRect) => readonly FlowFaden[];
  /** Standbild ohne Takt (Kunden-Ansicht, Präsentation). Reduzierte Bewegung gilt immer. */
  still?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Die Fäden aus den Angaben (ohne Messung) — leer, wenn es keinen Weg gibt. Rein (für Tests). */
export function flowFaedenAus(p: Pick<FlowLinieProps, 'punkte' | 'bisHier' | 'ton' | 'staerke' | 'hier' | 'frans' | 'faeden'>): FlowFaden[] {
  if (p.faeden) return p.faeden.filter(f => f.punkte.length >= 2);
  if (!p.punkte || p.punkte.length < 2) return [];
  return [{
    id: 'flow', punkte: p.punkte, farbe: p.ton ?? C.aktiv, staerke: p.staerke ?? 'mittel', ...(p.bisHier != null ? { bisHier: p.bisHier } : {}),
    ...(p.hier ? { hier: true } : {}), ...(p.frans ? { frans: true } : {}),
  }];
}

/**
 * Der Lichtfaden als Ebene (siehe Kopf). Ohne `messen` und ohne Weg rendert sie nichts — nie ein Schmuck-Faden über einer leeren Ansicht.
 */
export function FlowLinie(p: FlowLinieProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ebene = useRef<FlowEbene | null>(null);
  const angaben = useRef(p);
  angaben.current = p;
  const geplant = useRef(0);
  const ohne = !p.messen && flowFaedenAus(p).length === 0;

  const neu = () => {
    const c = canvasRef.current, e = ebene.current;
    if (!c || !e) return;
    const eltern = c.parentElement;
    if (!eltern) return;
    const box = c.getBoundingClientRect();
    const a = angaben.current;
    const faeden = a.messen ? a.messen(eltern, box) : flowFaedenAus(a);
    e.setze(faeden, { breite: box.width, hoehe: box.height });
  };
  const planen = () => {
    if (geplant.current || typeof requestAnimationFrame !== 'function') return;
    geplant.current = requestAnimationFrame(() => { geplant.current = 0; neu(); });
  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || ohne) return;
    const eltern = c.parentElement;
    const e = flowEbene(c, eltern ?? c, { ruhig: !!p.still || bewegungReduziert(), handy: typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches });
    ebene.current = e;
    if (eltern) eltern.dataset.flow = 'an';
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(planen) : null;
    ro?.observe(c);
    if (eltern) ro?.observe(eltern);
    // Neuer Inhalt (z. B. „+n weitere Schritte“ aufgeklappt) misst neu — nur Kinder, keine Attribute (die Leinwand selbst ändert Attribute).
    const mo = typeof MutationObserver !== 'undefined' && eltern ? new MutationObserver(planen) : null;
    if (mo && eltern) mo.observe(eltern, { childList: true, subtree: true });
    neu();
    // Messpunkt (außerhalb der Produktion bzw. mit `data-messen`): Zeichenzeit je Bild — liest nur.
    const messen = process.env.NODE_ENV !== 'production' || !!c.closest('[data-messen]') || document.documentElement.hasAttribute('data-messen');
    const uhr = messen ? window.setInterval(() => { const m = e.lauf.messung(); c.dataset.bilder = String(m.bilder); c.dataset.mittelMs = m.mittelMs.toFixed(2); c.dataset.laengstesMs = m.laengstesMs.toFixed(2); }, 500) : undefined;
    return () => {
      if (uhr !== undefined) window.clearInterval(uhr);
      ro?.disconnect(); mo?.disconnect();
      if (geplant.current && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(geplant.current);
      geplant.current = 0;
      e.stop(); ebene.current = null;
      if (eltern) delete eltern.dataset.flow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- neu nur, wenn „still“ wechselt oder die Ebene entsteht
  }, [p.still, ohne]);

  // Nach jedem Zeichnen der Ansicht neu messen (zusammengefasst in einem Bild) — die Lage der Stufen bzw. Pfeile kann sich geändert haben.
  useEffect(() => { planen(); });

  if (ohne) return null;
  return <canvas ref={canvasRef} aria-hidden="true" data-flow-ebene="" className={`ff-flow-ebene${p.className ? ` ${p.className}` : ''}`} style={{ pointerEvents: 'none', ...p.style }} />;
}
