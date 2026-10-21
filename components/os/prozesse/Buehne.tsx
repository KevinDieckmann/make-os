'use client';

// ─── Prozesse — die Bühne: Fläche mit Kamera, Flow und Kamerafahrt (Etappe A, 21.10.; ANALYSE_100.md Punkte 11–15, 21, 93) ─────────────────────
// Eine Fläche für alle Ebenen (Landkarte, Prozess, Ablauf) — dieselben Bausteine wie die Fläche des Prozess-Editors: Kamera (../ui/flaeche/kamera.ts),
// Eingabe nur am SVG (../ui/flaeche/eingabe.ts: Pinch bzw. ⌘ + Scrollen zoomt, zwei Finger bzw. Ziehen auf freier Fläche schiebt), der Flow als EINE
// Faden-Ebene unter dem SVG (lib/lichtfaeden/flow.ts `flowEbene`, gemeinsamer Takt, reduzierte Bewegung = Standbild).
//   · Hineinfahren statt Seitenwechsel (Punkt 12): `fliegeIn(id, dann)` fährt in ein Element, dann wechselt die Szene; die neue Szene „landet“ (rein: aus
//     der Weite heran, raus: aus dem Element heraus). Keine React-Zustände je Bild — Kamera in Refs, gezeichnet per requestAnimationFrame.
//   · Semantischer Zoom (Punkt 14): die Stufe kommt NUR aus `zoomStufe` (../ui/flaeche/stufe.ts) — die Zeichnung bekommt sie, nie ein Knoten selbst.
//   · Alles zeigen, Auswahl zeigen, Minimap (Punkt 13), Aufleuchten nach der Suche (Punkt 15): ein Lichtfaden umrundet das Element kurz.
//   · Präsentieren (Punkt 93): Rahmen für Rahmen — die Kamera fährt entlang des Flows.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, TYP, RAND } from '@/lib/make-one/design';
import { flowEbene, bewegungReduziert, type FlowEbene, type FlowFaden } from '@/lib/lichtfaeden/flow';
import { allesZeigen, transformVon, zoomUm, zwischen, sanft, flaecheHinweis, type Kamera, type Rechteck } from '../ui/flaeche/kamera';
import { flaecheEingabe } from '../ui/flaeche/eingabe';
import { zoomStufe, type ZoomStufe } from '../ui/flaeche/stufe';
import { JETZT } from '../ui/reise/formen';

export interface BuehneSteuerung {
  allesZeigen(): void;
  /** Auf ein Element fahren (Auswahl zeigen, Suche) — ohne Szenenwechsel. */
  zeige(id: string, leuchten?: boolean): void;
  /** In ein Element hineinfahren, danach `dann` (der Szenenwechsel). */
  fliegeIn(id: string, dann: () => void): void;
  zoomen(faktor: number): void;
  /** Auf einen Rahmen (Präsentieren). */
  rahmen(box: Rechteck): void;
}
export type Einflug = { art: 'neu' } | { art: 'rein' } | { art: 'raus'; von: string };
export interface MinimapTeil { box: Rechteck; farbe: string }

export interface BuehneProps {
  /** Schlüssel der Szene — wechselt er, landet die neue Szene (siehe `einflug`). */
  szene: string;
  einflug: Einflug;
  box: Rechteck;
  boxen: ReadonlyMap<string, Rechteck>;
  faeden: readonly FlowFaden[];
  /** Element, auf das die Kamera nach dem Landen fährt (Phase im Ablauf, gewählter Schritt). */
  ziel?: string | null;
  /** Kurzes Aufleuchten (`n` zählt hoch — gleiche Kennung leuchtet erneut). */
  leuchten?: { id: string; n: number } | null;
  minimap: boolean;
  minimapTeile: readonly MinimapTeil[];
  handy?: boolean;
  label: string;
  children: (stufe: ZoomStufe) => ReactNode;
  /** Klick auf freie Fläche (Auswahl lösen). */
  onFrei?: () => void;
  /** Präsentieren: ohne Hinweis und ohne Rand. */
  praesentieren?: boolean;
}

const ruhig = () => typeof window !== 'undefined' && bewegungReduziert();
/** Wie lange eine Kamerafahrt dauert (ms) — Hineinfahren etwas länger, damit man sieht, wohin. */
const FAHRT = { zeige: 420, rein: 360, landen: 460 } as const;
const LEUCHT_MS = 1800;
/** Kleinster Zoom beim Fahren auf ein Ziel — darunter wird die Schrift der Formen (15 px) unlesbar. */
const LESBAR = 0.7;
/** Rand bei „Alles zeigen“ (Bildschirm-px) — schmal, damit die Gesamtansicht so groß wie möglich steht (die Szene bringt ihren eigenen Rand mit). */
const RAND_ALLES = 20;

/** Ein geschlossener Weg um eine Box (der Lichtfaden beim Aufleuchten). */
export function ringUm(b: Rechteck, rand = 12): [number, number][] {
  const x0 = b.x - rand, y0 = b.y - rand, x1 = b.x + b.b + rand, y1 = b.y + b.h + rand;
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
}

export const Buehne = forwardRef<BuehneSteuerung, BuehneProps>(function Buehne(p, ref) {
  const buehne = useRef<HTMLDivElement | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const welt = useRef<SVGGElement | null>(null);
  const leinwand = useRef<HTMLCanvasElement | null>(null);
  const ebene = useRef<FlowEbene | null>(null);
  const kamera = useRef<Kamera>({ s: 1, x: 0, y: 0 });
  const bild = useRef(0);
  const fahrt = useRef(0);
  const sicht = useRef<SVGRectElement | null>(null);
  const [stufe, setStufe] = useState<ZoomStufe>('mittel');
  const stufeRef = useRef<ZoomStufe>('mittel');
  const [ring, setRing] = useState<FlowFaden | null>(null);
  const [geraet, setGeraet] = useState({ mac: true, touch: false });
  const stand = useRef(p);
  stand.current = p;

  const groesse = () => { const r = buehne.current?.getBoundingClientRect(); return { b: r?.width || 960, h: r?.height || 600 }; };
  const zeichne = useCallback(() => {
    if (bild.current) return;
    bild.current = requestAnimationFrame(() => {
      bild.current = 0;
      const k = kamera.current;
      welt.current?.setAttribute('transform', transformVon(k));
      welt.current?.style.setProperty('--pz-s', String(k.s));
      ebene.current?.kamera(k);
      const neu = zoomStufe(k.s);
      if (neu !== stufeRef.current) { stufeRef.current = neu; setStufe(neu); }
      // Minimap: der sichtbare Ausschnitt in Welt-Koordinaten.
      const r = sicht.current, g = groesse();
      if (r) { r.setAttribute('x', String(-k.x / k.s)); r.setAttribute('y', String(-k.y / k.s)); r.setAttribute('width', String(g.b / k.s)); r.setAttribute('height', String(g.h / k.s)); }
    });
  }, []);
  const setze = useCallback((k: Kamera) => { kamera.current = k; zeichne(); }, [zeichne]);
  const fliege = useCallback((ziel: Kamera, dauer: number = FAHRT.zeige, dann?: () => void) => {
    if (fahrt.current) cancelAnimationFrame(fahrt.current);
    if (ruhig()) { setze(ziel); dann?.(); return; }
    const von = kamera.current, t0 = performance.now();
    const schritt = (t: number) => {
      const a = Math.min(1, (t - t0) / dauer);
      setze(zwischen(von, ziel, sanft(a)));
      if (a < 1) fahrt.current = requestAnimationFrame(schritt);
      else { fahrt.current = 0; dann?.(); }
    };
    fahrt.current = requestAnimationFrame(schritt);
  }, [setze]);
  const passend = useCallback((b: Rechteck, max = 1.2, rand = 48) => { const g = groesse(); return allesZeigen(b, g.b, g.h, rand, max); }, []);
  /** Auf ein Ziel (Phase, Schritt): passend — aber nie unlesbar klein; ist es zu groß, beginnt das Bild oben an seiner Mitte (wie der Editor, START_MIN). */
  const aufZiel = useCallback((b: Rechteck) => {
    const k = passend(b, 1.1, 60);
    if (k.s >= LESBAR) return k;
    const g = groesse();
    return { s: LESBAR, x: Math.round(g.b / 2 - (b.x + b.b / 2) * LESBAR), y: Math.round(40 - b.y * LESBAR) };
  }, [passend]);

  const leuchte = useCallback((id: string) => {
    const b = stand.current.boxen.get(id);
    if (!b) return;
    setRing({ id: 'pz-leuchten', punkte: ringUm(b), farbe: JETZT, staerke: 'mittel', gluehen: true });
    const el = welt.current?.querySelector(`[data-pz-id="${CSS.escape(id)}"]`);
    el?.setAttribute('data-pz-leuchten', '');
    window.setTimeout(() => { setRing(null); el?.removeAttribute('data-pz-leuchten'); }, LEUCHT_MS);
  }, []);

  useImperativeHandle(ref, () => ({
    allesZeigen: () => fliege(passend(stand.current.box, 1, RAND_ALLES)),
    zeige: (id, mitLeuchten) => { const b = stand.current.boxen.get(id); if (!b) return; fliege(aufZiel(b)); if (mitLeuchten) leuchte(id); },
    fliegeIn: (id, dann) => {
      const b = stand.current.boxen.get(id);
      if (!b) { dann(); return; }
      fliege(passend(b, 2.5, 16), FAHRT.rein, dann);
    },
    zoomen: f => { const g = groesse(); fliege(zoomUm(kamera.current, f, g.b / 2, g.h / 2), 220); },
    rahmen: b => fliege(passend(b, 1.6, 24), 700),
  }), [fliege, passend, aufZiel, leuchte]);

  // ── Landen: eine neue Szene erscheint (rein: aus der Weite heran · raus: aus dem Element heraus · neu: gleich passend) ──
  useEffect(() => {
    const e = stand.current.einflug;
    const zielBox = stand.current.ziel ? stand.current.boxen.get(stand.current.ziel) : undefined;
    const endKamera = zielBox ? aufZiel(zielBox) : passend(stand.current.box, 1, RAND_ALLES);
    if (e.art === 'neu' || ruhig()) { setze(endKamera); return; }
    const g = groesse();
    if (e.art === 'rein') setze(zoomUm(endKamera, 0.62, g.b / 2, g.h / 2));
    else { const von = stand.current.boxen.get(e.von); setze(von ? passend(von, 2.5, 16) : zoomUm(endKamera, 1.6, g.b / 2, g.h / 2)); }
    fliege(endKamera, FAHRT.landen);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Szenenwechsel
  }, [p.szene]);
  // Innerhalb einer Szene: auf das Ziel fahren (Phase bzw. Schritt gewählt).
  const erstesZiel = useRef(true);
  useEffect(() => {
    if (erstesZiel.current) { erstesZiel.current = false; return; }
    const b = p.ziel ? stand.current.boxen.get(p.ziel) : undefined;
    if (b) fliege(aufZiel(b));
  }, [p.ziel, fliege, aufZiel]);
  useEffect(() => { if (p.leuchten) leuchte(p.leuchten.id); }, [p.leuchten, leuchte]);

  // ── Eingabe (nur am SVG) ──
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    setGeraet({ mac: /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), touch: !!window.matchMedia?.('(pointer: coarse)').matches });
    const e = flaecheEingabe(el, {
      kamera: () => kamera.current, setze: k => { if (fahrt.current) { cancelAnimationFrame(fahrt.current); fahrt.current = 0; } setze(k); },
      freiSchiebt: () => true,
      // Ziehen schiebt überall (auch über einer Kachel) — ein Klick nach dem Ziehen zählt nicht (`klickNachZiehen`).
      istFrei: () => true,
    });
    return () => { e.abbauen(); if (bild.current) cancelAnimationFrame(bild.current); if (fahrt.current) cancelAnimationFrame(fahrt.current); };
  }, [setze]);

  // ── Der Flow: EINE Faden-Ebene unter dem SVG ──
  const faeden = useMemo(() => (ring ? [...p.faeden, ring] : p.faeden), [p.faeden, ring]);
  const faedenRef = useRef(faeden);
  faedenRef.current = faeden;
  const fadenSetzen = useCallback(() => {
    const e = ebene.current, b = buehne.current;
    if (!e || !b) return;
    const r = b.getBoundingClientRect();
    e.setze(faedenRef.current, { breite: r.width, hoehe: r.height });
    e.kamera(kamera.current);
  }, []);
  useEffect(() => {
    const c = leinwand.current, b = buehne.current;
    if (!c || !b) return;
    const e = flowEbene(c, b, { ruhig: bewegungReduziert(), handy: !!stand.current.handy });
    ebene.current = e;
    b.dataset.flow = 'an';
    fadenSetzen();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { fadenSetzen(); zeichne(); }) : null;
    ro?.observe(b);
    return () => { ro?.disconnect(); e.stop(); ebene.current = null; delete b.dataset.flow; };
  }, [fadenSetzen, zeichne]);
  useEffect(() => { fadenSetzen(); }, [faeden, fadenSetzen]);
  useEffect(() => { if (p.minimap) zeichne(); }, [p.minimap, zeichne]);

  // ── Minimap: Klick bzw. Ziehen setzt die Mitte des Ausschnitts ──
  const mm = useMemo(() => {
    const B = 200, H = 130, b = p.box;
    const s = Math.min(B / Math.max(1, b.b), H / Math.max(1, b.h)) * 0.92;
    return { B, H, s, ox: (B - b.b * s) / 2 - b.x * s, oy: (H - b.h * s) / 2 - b.y * s };
  }, [p.box]);
  const mmZiehen = useRef(false);
  const mmSetze = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const wx = (e.clientX - r.left - mm.ox) / mm.s, wy = (e.clientY - r.top - mm.oy) / mm.s;
    const g = groesse(), k = kamera.current;
    setze({ s: k.s, x: g.b / 2 - wx * k.s, y: g.h / 2 - wy * k.s });
  };

  const hinweis = flaecheHinweis(geraet.mac, geraet.touch || !!p.handy, false);
  // Ein Klick am Ende eines Zugs (Schieben) öffnet nichts — sonst führe jedes Verschieben über einer Kachel in sie hinein.
  const druck = useRef<{ x: number; y: number } | null>(null);
  return (
    <div ref={buehne} className={`ff-flaeche-buehne pz-buehne${p.praesentieren ? ' pz-buehne-praes' : ''}`}>
      <canvas ref={leinwand} aria-hidden="true" data-flow-ebene="" className="ff-flow-ebene" style={{ pointerEvents: 'none' }} />
      <svg ref={svg} tabIndex={0} role="group" aria-roledescription="Fläche" aria-label={p.label} className="pz-svg"
        onPointerDownCapture={e => { druck.current = { x: e.clientX, y: e.clientY }; }}
        onClickCapture={e => { const d = druck.current; if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) { e.stopPropagation(); e.preventDefault(); } }}
        onClick={e => { if (!(e.target as Element).closest?.('[data-pz-klick]')) p.onFrei?.(); }} style={{ fontFamily: 'inherit' }}>
        <g ref={welt} transform={transformVon(kamera.current)} data-stufe={stufe}>{p.children(stufe)}</g>
      </svg>
      {!p.praesentieren && <p className="ff-flaeche-hinweis pz-hinweis" style={{ position: 'absolute', left: 12, bottom: 8, margin: 0, fontSize: TYP.bedien, color: C.inkLeise, pointerEvents: 'none', maxWidth: 'calc(100% - 240px)' }}>{hinweis}</p>}
      {p.minimap && (
        <div className="pz-minimap" role="group" aria-label="Minimap — klicken oder ziehen, um den Ausschnitt zu verschieben">
          <svg width={mm.B} height={mm.H} style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }}
            onPointerDown={e => { mmZiehen.current = true; e.currentTarget.setPointerCapture(e.pointerId); mmSetze(e); }}
            onPointerMove={e => { if (mmZiehen.current) mmSetze(e); }}
            onPointerUp={e => { mmZiehen.current = false; e.currentTarget.releasePointerCapture(e.pointerId); }}>
            <g transform={`translate(${mm.ox} ${mm.oy}) scale(${mm.s})`}>
              {p.minimapTeile.map((t, i) => <rect key={i} x={t.box.x} y={t.box.y} width={t.box.b} height={t.box.h} rx={6 / mm.s} fill={t.farbe} fillOpacity={0.55} />)}
              <rect ref={sicht} fill="none" stroke={C.ink} strokeWidth={2 / mm.s} />
            </g>
          </svg>
        </div>
      )}
      <span aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', boxShadow: p.praesentieren ? 'none' : `inset 0 0 0 1px ${RAND.haar}` }} />
    </div>
  );
});
