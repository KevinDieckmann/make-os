'use client';

// ─── Standard · Fokus-Signatur: Kante, FadenLinie, Segmentbalken, Netz (04.10.) ─
// Kevin (04.10.): „Diese Akzente will ich überall drauf haben, wo Fokus ist. Dezent, aber immer wichtig. Und der Strahl läuft
// im Grunde genommen immer von links nach rechts.“ Regeln: DESIGN_STANDARD.md › Fokus-Signatur — nur wo Fokus ist, höchstens
// EINE Fokus-Karte und ZWEI FadenLinien je Ansicht, nie Schmuck ohne Daten, Bewegung sehr langsam, reduzierte Bewegung = still.
//   · `FokusKante`  — der Lichtfaden, der langsam von links nach rechts über die obere Kante einer Karte läuft (`Karte ton="fokus"`).
//   · `FadenLinie`  — der Mini-Strahl über EINER echten Zeitreihe (lib/lichtfaeden/fadenlinie.ts, derselbe Zeichner wie das Band).
//   · `Segmentbalken` — Anteil/Fortschritt als schräge Segmente (wie im Vorbild „//////“).
//   · `NetzMotiv`  — ein kleines Netz aus Knoten und Linien in der Ecke einer Fokus-Karte, treibt sehr langsam.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FOKUS_LICHT, FOKUS_STIL, FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { fadenlinie, type FadenLinieZeichner } from '@/lib/lichtfaeden/fadenlinie';
import { normalisiere, reiheGueltig, reiheText } from '@/lib/lichtfaeden/reihen';
import { bewegungReduziert } from '@/lib/lichtfaeden/zeichnen';

/** Der Lichtfaden an der oberen Kante einer Fokus-Karte: leise Grundlinie, darüber ein Licht, das langsam nach rechts wandert. */
export function FokusKante({ farbe = FOKUS_LICHT }: { farbe?: string }) {
  return (
    <span aria-hidden="true" className="ui-fokus-kante" style={{ background: FOKUS_STIL.kanteGrund(farbe) }}>
      <span className="ui-fokus-licht" style={{ background: FOKUS_STIL.kanteLicht(farbe), boxShadow: `0 0 10px 1px ${farbe}66` }} />
    </span>
  );
}

// Feste Knoten des Netz-Motivs (Anteile der Fläche) — keine Zufallswerte im Render (gleich auf Server und Gerät).
const NETZ_KNOTEN: readonly [number, number, number][] = [
  [0.12, 0.2, 1.6], [0.38, 0.1, 1.2], [0.64, 0.26, 2], [0.9, 0.12, 1.4], [0.24, 0.52, 1.3],
  [0.52, 0.6, 1.8], [0.8, 0.5, 1.2], [0.36, 0.86, 1.4], [0.7, 0.84, 1.6],
];
const NETZ_LINIEN: readonly [number, number][] = [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 2], [5, 6], [6, 3], [4, 7], [7, 5], [5, 8], [8, 6], [1, 5]];

/** Kleines Netz-Motiv (Knoten + Linien) für die Ecke einer Fokus-Karte — rein dekorativ, `aria-hidden`, treibt sehr langsam. */
export function NetzMotiv({ farbe = FOKUS_LICHT, breite = 132, hoehe = 72 }: { farbe?: string; breite?: number; hoehe?: number }) {
  const p = NETZ_KNOTEN.map(([x, y, r]) => ({ x: x * breite, y: y * hoehe, r }));
  return (
    <svg aria-hidden="true" className="ui-netz" width={breite} height={hoehe} viewBox={`0 0 ${breite} ${hoehe}`} style={{ color: farbe }}>
      <g className="ui-netz-treiben">
        {NETZ_LINIEN.map(([a, b], i) => <line key={i} x1={p[a].x} y1={p[a].y} x2={p[b].x} y2={p[b].y} stroke="currentColor" strokeOpacity={0.22} strokeWidth={0.7} />)}
        {p.map((k, i) => <circle key={i} cx={k.x} cy={k.y} r={k.r} fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeOpacity={0.6} strokeWidth={0.8} />)}
      </g>
    </svg>
  );
}

export interface FadenLinieProps {
  /** Die echte Zeitreihe (mindestens zwei Werte) — ohne sie zeigt die FadenLinie nichts. */
  reihe: readonly number[];
  /** Was die Reihe ist, z. B. „Fällige Follow-ups, nächste 14 Tage“ — Anfang des Textes für Screenreader. */
  label: string;
  /** Beschriftung je Feld für den Text („heute“, „morgen“, „Woche ab 29.9.“); Standard „1.“, „2.“ … */
  beschriftung?: (i: number) => string;
  /** Zahlen im Text (z. B. Euro). */
  format?: (v: number) => string;
  farbe?: string;
  /** Höhe der Leinwand (px), 32 … 56 im Mini-Modus, mehr als Band (Liquidität). */
  hoehe?: number;
  /** Feld von HEUTE — rechts davon fransen die Fäden aus (Zukunft). */
  heute?: number | null;
  /** Beschriftung unter der Linie (links … rechts), leise. */
  achse?: readonly ReactNode[];
  /** Hinweis je Feld beim Zeigen (title), z. B. die Buchungen einer Woche. */
  spalten?: readonly string[];
  style?: CSSProperties;
}

/**
 * Der Mini-Strahl: eine Zeitreihe als Bündel feiner Fäden (derselbe Zeichner wie das Lichtfäden-Band). Die Leinwand ist
 * `aria-hidden`, die Reihe steht vollständig im `aria-label`. Ohne gültige Reihe (≥ 2 Werte) wird nichts gezeigt.
 */
export function FadenLinie({ reihe, label, beschriftung, format, farbe = FOKUS_LICHT, hoehe = 44, heute = null, achse, spalten, style }: FadenLinieProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zeichner = useRef<FadenLinieZeichner | null>(null);
  const [breite, setBreite] = useState(0);
  const ok = reiheGueltig(reihe);
  const schluessel = ok ? reihe.join(',') : '';
  // Die Reihe wird über ihren Inhalt gemerkt — eine neue Liste mit gleichen Werten zeichnet nicht neu.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const norm = useMemo(() => normalisiere(ok ? reihe : []), [schluessel]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const mess = () => { const b = el.clientWidth; if (b > 0) setBreite(b); };
    mess();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mess) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [ok]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !ok) return;
    const z = fadenlinie(c, c.parentElement ?? c, bewegungReduziert());
    zeichner.current = z;
    // Messpunkt (nur außerhalb der Produktion oder mit `data-messen`): Zeichenzeit je Bild — liest nur.
    const messen = process.env.NODE_ENV !== 'production' || !!c.closest('[data-messen]') || document.documentElement.hasAttribute('data-messen');
    const messe = messen ? window.setInterval(() => { const m = z.lauf.messung(); c.dataset.bilder = String(m.bilder); c.dataset.mittelMs = m.mittelMs.toFixed(2); c.dataset.laengstesMs = m.laengstesMs.toFixed(2); c.dataset.aufbau = String(z.aufbau() ?? ''); }, 500) : undefined;
    return () => { if (messe !== undefined) window.clearInterval(messe); z.stop(); zeichner.current = null; };
  }, [ok]);

  useEffect(() => {
    if (!ok || !breite) return;
    zeichner.current?.setze({ breite, hoehe, werte: norm.werte, null0: norm.null0, farbe, heute, handy: breite < 420, saat: label });
  }, [ok, breite, hoehe, norm, farbe, heute, label]);

  if (!ok) return null;
  const text = reiheText(label, reihe, beschriftung ?? (i => `${i + 1}.`), format);
  return (
    <figure className="ui-fadenlinie" role="img" aria-label={text} style={{ margin: 0, minWidth: 0, ...style }}>
      <div ref={boxRef} style={{ position: 'relative', height: hoehe, minWidth: 0 }}>
        <canvas ref={canvasRef} aria-hidden="true" data-fadenlinie="" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: hoehe, pointerEvents: 'none' }} />
        {spalten && spalten.length === reihe.length && (
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex' }}>
            {spalten.map((t, i) => <span key={i} title={t} style={{ flex: 1, minWidth: 0 }} />)}
          </div>
        )}
      </div>
      {achse && achse.length > 0 && (
        <figcaption aria-hidden="true" className="ui-fadenlinie-achse">
          {achse.map((a, i) => <span key={i}>{a}</span>)}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Segmentbalken: ein Anteil als schräge Segmente (Vorbild „//////“) — belegte in der Farbe, das letzte mit leisem Schein.
 * Fortschritt oder Anteil; Rolle `progressbar` mit Wert in Prozent. Füllt sich beim Öffnen, bei „Bewegung reduzieren“ sofort.
 */
export function Segmentbalken({ anteil, label, farbe = FOKUS_LICHT, segmente = 12, hoehe = 12, breite, zahl }: {
  anteil: number; label: string; farbe?: string; segmente?: number; hoehe?: number; breite?: number | string; /** Prozent rechts daneben zeigen. */ zahl?: boolean;
}) {
  const p = Math.max(0, Math.min(1, Number.isFinite(anteil) ? anteil : 0));
  const n = Math.max(3, Math.round(segmente));
  const voll = Math.round(p * n);
  const prozent = Math.round(p * 100);
  return (
    <span className="ui-segmentbalken-zeile" style={{ width: breite }}>
      <span role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={prozent} className="ui-segmentbalken" style={{ height: hoehe }}>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={i < voll ? 'ui-segbalken-teil ui-segbalken-an' : 'ui-segbalken-teil'}
            style={{ ['--i' as string]: i, background: i < voll ? farbe : FOKUS_STIL.segmentLeer, boxShadow: i === voll - 1 ? `0 0 8px ${farbe}80` : undefined }} />
        ))}
      </span>
      {zahl && <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.bedien, fontWeight: 700, color: voll ? farbe : C.inkLeise, fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>{prozent} %</span>}
    </span>
  );
}
