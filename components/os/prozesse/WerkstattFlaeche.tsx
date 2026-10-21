'use client';

// ─── Prozesse · Werkstatt — die Fläche (Etappe B2, 21.10.; ANALYSE_100.md Punkte 16–19, 22, 25; Kevins Bild der Werkstatt) ─────────────────────────────────
// Dunkle Fläche mit Punktraster, Knoten im n8n-Stil (components/os/prozesse/WerkstattKnoten.tsx), quer darüber die Bahnen (Kunde · Menschen aus dem Team ·
// System · Agenten), Phasen als Rahmen. JEDE Verbindung ist ein Lichtfaden aus unserem Flow (lib/lichtfaeden/flow.ts `flowEbene` unter dem SVG): Hauptweg kräftig,
// Abzweige und die Andockpunkte des Agenten fein, „nein“ im Ton der Erinnerung, die Fehlerkante rot gestrichelt; beim Ziehen eines Fadens zeichnet er sich mit
// (`zug`). Nie eine graue Standardlinie (der Strich unter dem Faden blendet CSS aus, solange der Flow läuft — `.ff-flaeche-buehne[data-flow="an"]`).
// Bewegung still bei `prefers-reduced-motion` (Standbild der Ebene). Bedienung:
//   · Pinch bzw. ⌘ + Scrollen zoomt, zwei Finger bzw. Leertaste + Ziehen verschiebt (components/os/ui/flaeche/eingabe.ts — dieselbe Eingabe wie überall).
//   · Knoten ziehen (Hilfslinien zu Nachbarn, Raster), Aufziehen wählt mehrere, ⇧ + Klick ergänzt; vom Ausgang einen Faden ziehen → auf einen Knoten =
//     verbinden, ins Leere = Formauswahl an dieser Stelle; „+“ am Ausgang = Formauswahl; Klick auf einen Faden wählt ihn (Entf löst einen Zweig).
//   · Tastatur über lib/prozesse/werkstatt-tastatur.ts (die Werkstatt führt aus).
// Leistung: Kamera in Refs, gezeichnet per requestAnimationFrame; React-Zustand nur beim Ziehen (wenige Dutzend Knoten).

import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type KeyboardEvent as RKeyboardEvent, type MouseEvent as RMouseEvent } from 'react';
import { ChevronsLeftRight, ChevronsRightLeft, User, Users, Cog, Bot, Heart } from 'lucide-react';
import { FARBE as C, TIEF, RAND, LEUCHT, FLAECHE_STIL, TYP } from '@/lib/make-one/design';
import type { NotizZettel, ProzessDefinition, ProzessForm, ProzessKnoten } from '@/lib/prozesse/definition';
import type { Ausgang } from '@/lib/prozesse/fluss';
import {
  WS, kantenWege, hilfslinien, startKamera, fadenWeg, anschlussAbs, type WerkstattLage, type Hilfslinie, type Box, type BahnSchluessel,
} from '@/lib/prozesse/werkstatt-lage';
import { tasteZuAktion, type TastenAktion } from '@/lib/prozesse/werkstatt-tastatur';
import type { ProbeStatus } from '@/lib/prozesse/werkstatt-hinweise';
import { BAHN_TON, ZETTEL_TON, WERKSTATT_FORM_FARBE } from '@/lib/prozesse/farben';
import { pfadVon, pfeilTextOrt } from '@/lib/fulfillment/prozesse/flaeche';
import { flowEbene, bewegungReduziert, type FlowEbene, type FlowFaden } from '@/lib/lichtfaeden/flow';
import { allesZeigen, transformVon, zoomUm, weltAus, bildAus, zwischen, sanft, flaecheHinweis, type Kamera } from '../ui/flaeche/kamera';
import { flaecheEingabe } from '../ui/flaeche/eingabe';
import { FlaechePfeil, FlaecheSpitze, textZeilen, FLAECHE_SCHRIFT } from '../ui/reise/flaeche-formen';
import { FLOW_TON } from '../ui/reise/formen';
import { KnotenZeichnung, ZuKachel } from './WerkstattKnoten';

type K = ProzessKnoten<ProzessForm>;
export interface AnhangZiel { nach?: string; ausgang?: Ausgang; vor?: string; phaseId?: string; platz?: [number, number] }
export interface FlaecheSteuerung { allesZeigen(): void; zoomen(f: number): void; zeige(id: string): void; mitte(): [number, number]; bildschirm(x: number, y: number): [number, number]; fokus(): void }

export interface WerkstattFlaecheProps {
  d: Pick<ProzessDefinition, 'knoten' | 'zettel'>;
  lage: WerkstattLage;
  /** Schlüssel der Szene (Prozess + Version) — wechselt er, öffnet die Fläche neu (lesbar eingepasst). */
  szene: string;
  auswahl: readonly string[];
  kanteWahl: string | null;
  rahmenWahl: string | null;
  andockWahl: { id: string; art: string } | null;
  probe: ReadonlyMap<string, ProbeStatus> | null;
  befundJe: ReadonlyMap<string, 'fehler' | 'offen'>;
  unterzeile: (k: K) => string;
  /** Knoten, hinter denen ein Freigabe-Schloss steht. */
  mitSchloss: ReadonlySet<string>;
  nurLesen: boolean;
  raster: boolean;
  handy?: boolean;
  label: string;
  onAuswahl: (ids: string[], o?: { erweitern?: boolean }) => void;
  onKante: (id: string | null) => void;
  onRahmen: (id: string | null) => void;
  onUnter: (id: string, art: string) => void;
  onZiehen: (ids: string[], dx: number, dy: number) => void;
  onVerbinden: (von: string, ausgang: Ausgang, nach: string) => void;
  onAnhaengen: (ziel: AnhangZiel, bildschirm: [number, number]) => void;
  onZuklappen: (phaseId: string) => void;
  onTaste: (a: TastenAktion) => boolean;
}

type Zug =
  | { art: 'knoten'; zeiger: number; start: [number, number]; ids: string[]; aktiv: boolean; erweitern: boolean; id: string }
  | { art: 'faden'; zeiger: number; start: [number, number]; von: string; ausgang: Ausgang; aktiv: boolean }
  | { art: 'band'; zeiger: number; start: [number, number]; aktiv: boolean; erweitern: boolean };

const ZIEH_PX = 5;
const ruhig = () => typeof window !== 'undefined' && bewegungReduziert();
const sauberId = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '');
const imFeld = (t: EventTarget | null) => !!(t as Element | null)?.closest?.('input,textarea,select,[contenteditable="true"]');

/** Die Farbe eines Fadens: Hauptweg im Akzent, „nein“ im Ton der Erinnerung, Fehler rot, abgelaufen gelb. */
function fadenVon(k: { id: string; ausgang: Ausgang; zurueck: boolean; punkte: [number, number][] }): FlowFaden {
  const nein = k.ausgang === 'nein';
  const farbe = k.ausgang === 'fehler' ? LEUCHT.kritisch : k.ausgang === 'abgelaufen' ? FLOW_TON.gelb : nein || k.zurueck ? FLOW_TON.nein : FLOW_TON.basis;
  const haupt = (k.ausgang === 'weiter' || k.ausgang === 'ja') && !k.zurueck;
  return { id: k.id, punkte: k.punkte, farbe, staerke: haupt ? 'mittel' : 'fein', ...(k.zurueck || k.ausgang === 'fehler' ? { bisHier: 0 } : {}) };
}

export const WerkstattFlaeche = forwardRef<FlaecheSteuerung, WerkstattFlaecheProps>(function WerkstattFlaeche(p, ref) {
  const roh = useId();
  const spitze = `ws-spitze-${sauberId(roh)}`, rasterId = `ws-raster-${sauberId(roh)}`;
  const buehne = useRef<HTMLDivElement | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const welt = useRef<SVGGElement | null>(null);
  const muster = useRef<SVGPatternElement | null>(null);
  const leinwand = useRef<HTMLCanvasElement | null>(null);
  const ebene = useRef<FlowEbene | null>(null);
  const kamera = useRef<Kamera>({ s: 1, x: 0, y: 0 });
  const bild = useRef(0);
  const zug = useRef<Zug | null>(null);
  const [zieh, setZieh] = useState<{ ids: string[]; dx: number; dy: number; linien: Hilfslinie[] } | null>(null);
  const [band, setBand] = useState<Box | null>(null);
  const [fadenZiel, setFadenZiel] = useState<{ id: string; nein: boolean } | null>(null);
  const [zugPunkte, setZugPunkte] = useState<[number, number][] | null>(null);
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
      muster.current?.setAttribute('patternTransform', `translate(${k.x} ${k.y}) scale(${k.s})`);
      ebene.current?.kamera(k);
    });
  }, []);
  const setze = useCallback((k: Kamera) => { kamera.current = k; zeichne(); }, [zeichne]);
  const fliege = useCallback((ziel: Kamera) => {
    if (ruhig()) { setze(ziel); return; }
    const von = kamera.current, t0 = performance.now();
    const schritt = (t: number) => { const a = Math.min(1, (t - t0) / 260); setze(zwischen(von, ziel, sanft(a))); if (a < 1) requestAnimationFrame(schritt); };
    requestAnimationFrame(schritt);
  }, [setze]);

  useImperativeHandle(ref, () => ({
    allesZeigen: () => { const g = groesse(); fliege(allesZeigen(stand.current.lage.box, g.b, g.h, 32, 1)); },
    zoomen: f => { const g = groesse(); fliege(zoomUm(kamera.current, f, g.b / 2, g.h / 2)); },
    zeige: id => {
      const k = stand.current.lage.knoten.get(id);
      if (!k) return;
      const g = groesse(), s = Math.max(kamera.current.s, 0.9);
      fliege({ s, x: Math.round(g.b / 2 - (k.x + k.b / 2) * s), y: Math.round(g.h / 2 - (k.y + k.h / 2) * s) });
    },
    mitte: () => { const g = groesse(); return weltAus(kamera.current, g.b / 2, g.h / 2); },
    bildschirm: (x, y) => bildAus(kamera.current, x, y),
    fokus: () => svg.current?.focus({ preventScroll: true }),
  }), [fliege]);

  // Beim Öffnen (je Szene): lesbar einpassen — alles, wenn es lesbar passt, sonst oben links am Anfang (lib/prozesse/werkstatt-lage.ts `startKamera`).
  useEffect(() => {
    const g = groesse();
    setze(startKamera(stand.current.lage.box, g));
    setGeraet({ mac: /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), touch: !!window.matchMedia?.('(pointer: coarse)').matches });
  }, [p.szene, setze]);

  // Zoom und Schieben am SVG (nur dort). Am Handy bzw. nur lesend schiebt auch das Ziehen auf freier Fläche.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const e = flaecheEingabe(el, {
      kamera: () => kamera.current, setze,
      freiSchiebt: () => stand.current.nurLesen,
      istFrei: z => !(z as Element | null)?.closest?.('[data-ws-knoten],[data-ws-anschluss],[data-ws-plus],[data-ws-kante],[data-ws-zettel],[data-ws-rahmen],[data-ws-unter]'),
    });
    return () => { e.abbauen(); if (bild.current) cancelAnimationFrame(bild.current); };
  }, [setze]);

  // ── Was gezeichnet wird: während des Ziehens die verschobenen Knoten mit ihren Fäden neu ──
  const knoten = useMemo(() => {
    if (!zieh) return p.lage.knoten;
    const m = new Map(p.lage.knoten);
    for (const id of zieh.ids) { const k = m.get(id); if (k) m.set(id, { ...k, x: k.x + zieh.dx, y: k.y + zieh.dy }); }
    return m;
  }, [p.lage.knoten, zieh]);
  const kanten = useMemo(() => (zieh ? kantenWege(p.d, knoten) : p.lage.kanten), [zieh, p.d, knoten, p.lage.kanten]);
  const zettel = useMemo(() => (p.d.zettel ?? []).map(z => (zieh?.ids.includes(z.id) ? { ...z, pos: { ...z.pos, x: z.pos.x + zieh.dx, y: z.pos.y + zieh.dy } } : z)), [p.d.zettel, zieh]);
  const nach = useMemo(() => new Map(p.d.knoten.map(k => [k.id, k])), [p.d.knoten]);
  const belegt = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const k of p.lage.kanten) { const s = m.get(k.von) ?? new Set<string>(); s.add(k.ausgang === 'ja' && nach.get(k.von)?.form !== 'entscheidung' && nach.get(k.von)?.form !== 'freigabe' ? 'weiter' : k.ausgang); m.set(k.von, s); }
    return m;
  }, [p.lage.kanten, nach]);

  // ── Der Flow: alle Fäden (Kanten + feine Fäden der Andockpunkte) auf EINER Ebene ──
  const faeden = useMemo<FlowFaden[]>(() => {
    const l: FlowFaden[] = kanten.map(fadenVon);
    for (const k of knoten.values()) {
      if (!k.unterknoten) continue;
      const c = k.koerper;
      for (const t of k.unterknoten.teile) {
        const a = k.unterknoten.andocks.find(x => x.art === t.art)!;
        l.push({ id: `${t.id}~faden`, punkte: [[k.x + a.x, k.y + c.y + c.h], [k.x + a.x, k.y + c.y + c.h + 26], [k.x + t.cx, k.y + t.cy - WS.andock.r]], farbe: WERKSTATT_FORM_FARBE.agent, staerke: 'fein', ...(t.leer ? { bisHier: 0 } : {}) });
      }
    }
    return l;
  }, [kanten, knoten]);
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
  // Der Faden, der beim Ziehen eines neuen Pfeils mitläuft.
  useEffect(() => { ebene.current?.zug(zugPunkte ? { id: 'ws-zug', punkte: zugPunkte, farbe: FLOW_TON.basis, staerke: 'mittel', gluehen: true } : null); }, [zugPunkte]);

  // ── Zeiger ──
  const welt0 = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = svg.current!.getBoundingClientRect();
    return weltAus(kamera.current, e.clientX - r.left, e.clientY - r.top);
  };
  const runter = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || imFeld(e.target)) return;
    svg.current?.focus({ preventScroll: true }); // Tastatur gehört danach der Fläche
    const t = e.target as Element;
    const w = welt0(e);
    const plus = t.closest('[data-ws-plus]');
    if (plus) return; // Klick (onClick) öffnet die Formauswahl
    const unter = t.closest('[data-ws-unter]')?.getAttribute('data-ws-unter');
    if (unter) { const [id, art] = unter.split('|'); p.onUnter(id, art); return; }
    const an = t.closest('[data-ws-anschluss]')?.getAttribute('data-ws-anschluss');
    if (an && !p.nurLesen) {
      const [von, art] = an.split('|');
      if (art !== 'ein') { zug.current = { art: 'faden', zeiger: e.pointerId, start: w, von, ausgang: art as Ausgang, aktiv: false }; svg.current?.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    }
    const knotenId = t.closest('[data-ws-knoten]')?.getAttribute('data-ws-knoten') ?? t.closest('[data-ws-zettel]')?.getAttribute('data-ws-zettel');
    if (knotenId) {
      const ids = p.auswahl.includes(knotenId) && !e.shiftKey ? [...p.auswahl] : [knotenId];
      zug.current = { art: 'knoten', zeiger: e.pointerId, start: w, ids, aktiv: false, erweitern: e.shiftKey, id: knotenId };
      svg.current?.setPointerCapture(e.pointerId);
      return;
    }
    const kante = t.closest('[data-ws-kante]')?.getAttribute('data-ws-kante');
    if (kante) { p.onKante(kante); return; }
    const rahmen = t.closest('[data-ws-rahmen]')?.getAttribute('data-ws-rahmen');
    if (rahmen) { p.onRahmen(rahmen); return; }
    if (!p.nurLesen) { zug.current = { art: 'band', zeiger: e.pointerId, start: w, aktiv: false, erweitern: e.shiftKey }; svg.current?.setPointerCapture(e.pointerId); }
  };
  const bewegt = (e: RPointerEvent<SVGSVGElement>) => {
    const z = zug.current;
    if (!z || z.zeiger !== e.pointerId) return;
    const w = welt0(e);
    const dx = w[0] - z.start[0], dy = w[1] - z.start[1];
    if (!z.aktiv) { if (Math.hypot(dx, dy) * kamera.current.s < ZIEH_PX) return; z.aktiv = true; }
    if (z.art === 'knoten') {
      if (p.nurLesen) return;
      const haupt = stand.current.lage.knoten.get(z.id);
      if (haupt) {
        const andere = [...stand.current.lage.knoten.values()].filter(k => !z.ids.includes(k.id)).map(k => ({ x: k.x + k.koerper.x, y: k.y + k.koerper.y, b: k.koerper.b, h: k.koerper.h }));
        const box = { x: haupt.x + haupt.koerper.x + dx, y: haupt.y + haupt.koerper.y + dy, b: haupt.koerper.b, h: haupt.koerper.h };
        const h = hilfslinien(box, andere, { raster: stand.current.raster ? WS.raster : 0 });
        setZieh({ ids: z.ids, dx: h.x - haupt.x - haupt.koerper.x, dy: h.y - haupt.y - haupt.koerper.y, linien: h.linien });
      } else setZieh({ ids: z.ids, dx: Math.round(dx), dy: Math.round(dy), linien: [] });
    } else if (z.art === 'faden') {
      const von = stand.current.lage.knoten.get(z.von);
      const a = von ? anschlussAbs(von, z.ausgang) : null;
      if (!a) return;
      const ziel = (document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ws-knoten]')?.getAttribute('data-ws-knoten')) ?? null;
      const zk = ziel ? stand.current.lage.knoten.get(ziel) : null;
      const ein = zk && ziel !== z.von ? anschlussAbs(zk, 'ein') : null;
      setFadenZiel(ziel && ziel !== z.von ? { id: ziel, nein: !ein } : null);
      setZugPunkte(fadenWeg(a.abs, a.richtung, ein ? ein.abs : w, Math.max(a.abs[1], w[1]) + 40).punkte);
    } else {
      setBand({ x: Math.min(z.start[0], w[0]), y: Math.min(z.start[1], w[1]), b: Math.abs(dx), h: Math.abs(dy) });
    }
  };
  const hoch = (e: RPointerEvent<SVGSVGElement>) => {
    const z = zug.current;
    if (!z || z.zeiger !== e.pointerId) return;
    zug.current = null;
    try { svg.current?.releasePointerCapture(e.pointerId); } catch { /* Zeiger schon frei */ }
    if (z.art === 'knoten') {
      if (z.aktiv && zieh && !p.nurLesen) p.onZiehen(zieh.ids, zieh.dx, zieh.dy);
      else if (!z.aktiv) p.onAuswahl([z.id], { erweitern: z.erweitern });
      setZieh(null);
      return;
    }
    if (z.art === 'faden') {
      const ziel = fadenZiel;
      setZugPunkte(null); setFadenZiel(null);
      if (z.aktiv && ziel && !ziel.nein) { p.onVerbinden(z.von, z.ausgang, ziel.id); return; }
      // Ins Leere gezogen bzw. nur geklickt: die Formauswahl — dort, wo losgelassen wurde (bzw. am Ausgang).
      const r = svg.current!.getBoundingClientRect();
      const w = welt0(e);
      p.onAnhaengen({ nach: z.von, ausgang: z.ausgang, ...(z.aktiv ? { platz: [Math.round(w[0]), Math.round(w[1])] as [number, number] } : {}) }, [e.clientX - r.left, e.clientY - r.top]);
      return;
    }
    setBand(null);
    if (!z.aktiv) { p.onAuswahl([]); return; }
    const b = band ?? { x: 0, y: 0, b: 0, h: 0 };
    const drin = [...stand.current.lage.knoten.values()].filter(k => !k.zu && k.x + k.koerper.x < b.x + b.b && k.x + k.koerper.x + k.koerper.b > b.x && k.y < b.y + b.h && k.y + k.koerper.h > b.y).map(k => k.id);
    const zt = (stand.current.d.zettel ?? []).filter(x => x.pos.x < b.x + b.b && x.pos.x + (x.pos.b ?? WS.zettel.b) > b.x && x.pos.y < b.y + b.h && x.pos.y + (x.pos.h ?? WS.zettel.h) > b.y).map(x => x.id);
    p.onAuswahl([...drin, ...zt], { erweitern: z.erweitern });
  };
  const plusKlick = (e: RMouseEvent<SVGSVGElement>) => {
    const pl = (e.target as Element).closest('[data-ws-plus]')?.getAttribute('data-ws-plus');
    if (!pl || p.nurLesen) return;
    const [von, art] = pl.split('|');
    const r = svg.current!.getBoundingClientRect();
    p.onAnhaengen({ nach: von, ausgang: art as Ausgang }, [e.clientX - r.left, e.clientY - r.top]);
  };
  const taste = (e: RKeyboardEvent<SVGSVGElement>) => {
    if (imFeld(e.target)) return;
    const a = tasteZuAktion(e, geraet.mac);
    if (!a) return;
    if (a.art === 'formauswahl' && !p.auswahl.length) return; // Tab ohne Auswahl: weiter zum nächsten Bedienelement
    if (p.onTaste(a)) { e.preventDefault(); e.stopPropagation(); }
  };

  // ── Zeichnung ──
  const l = p.lage;
  const gewaehlt = new Set(p.auswahl);
  const bahnSymbol = (s: BahnSchluessel) => (s === 'kunde' ? Heart : s === 'agent' ? Bot : s === 'system' ? Cog : s === 'mensch' ? Users : User);
  const bahnTon = (s: BahnSchluessel) => (s.startsWith('person:') ? BAHN_TON.mensch : BAHN_TON[s as keyof typeof BAHN_TON]);
  const hinweis = flaecheHinweis(geraet.mac, geraet.touch || !!p.handy, !p.nurLesen);
  return (
    <div ref={buehne} className="ff-flaeche-buehne pw-buehne">
      <canvas ref={leinwand} aria-hidden="true" data-flow-ebene="" className="ff-flow-ebene" style={{ pointerEvents: 'none' }} />
      <svg ref={svg} tabIndex={0} role="application" aria-roledescription="Werkstatt-Fläche" aria-label={p.label} className="pw-svg"
        onPointerDown={runter} onPointerMove={bewegt} onPointerUp={hoch} onPointerCancel={hoch} onClick={plusKlick} onKeyDown={taste}
        style={{ fontFamily: 'inherit', cursor: p.nurLesen ? 'grab' : 'default', touchAction: p.nurLesen ? undefined : 'none' }}>
        <defs>
          <pattern ref={muster} id={rasterId} width={WS.raster} height={WS.raster} patternUnits="userSpaceOnUse"><circle cx={1} cy={1} r={1.1} fill={RAND.stark} /></pattern>
          <FlaecheSpitze id={spitze} />
        </defs>
        {p.raster && <rect width="100%" height="100%" fill={`url(#${rasterId})`} style={{ pointerEvents: 'none' }} />}
        <g ref={welt} transform={transformVon(kamera.current)}>
          {/* Bahnen (Punkt 25): quer, Name in der Spalte links. */}
          {l.bahnen.map((b, i) => {
            const B = bahnSymbol(b.schluessel);
            return (
              <g key={b.schluessel} style={{ pointerEvents: 'none' }}>
                <rect x={b.x} y={b.y} width={b.b} height={b.h} fill={i % 2 ? FLAECHE_STIL.leise.background : 'none'} stroke={RAND.haar} strokeWidth={1} />
                <B x={16} y={b.y + 16} width={18} height={18} color={bahnTon(b.schluessel)} aria-hidden />
                {textZeilen(b.titel, WS.bahnKopf - 56, FLAECHE_SCHRIFT.unter, 2).map((t, j) => <text key={j} x={42} y={b.y + 30 + j * 16} fontSize={FLAECHE_SCHRIFT.unter} fontWeight={600} fill={C.inkDim}>{t}</text>)}
              </g>
            );
          })}
          {/* Rahmen = Phasen; ein Knopf klappt zu (Teilprozess als Kachel). */}
          {l.rahmen.map(r => {
            const zu = [...l.knoten.values()].some(k => k.zu?.phaseId === r.id);
            const Z = zu ? ChevronsLeftRight : ChevronsRightLeft;
            return (
              <g key={r.id} data-ws-rahmen={r.id} transform={`translate(${r.x} ${r.y})`}>
                <rect width={r.b} height={r.h} rx={16} fill="none" stroke={p.rahmenWahl === r.id ? C.ink : RAND.stark} strokeWidth={p.rahmenWahl === r.id ? 2.2 : 1.4} style={{ pointerEvents: 'none' }} />
                <rect width={r.b} height={WS.rahmenKopf - 8} rx={16} fill="transparent" style={{ cursor: 'pointer' }} />
                <text x={18} y={22} fontSize={FLAECHE_SCHRIFT.mikro} fontWeight={600} letterSpacing="1.1" fill={C.inkLeise} style={{ pointerEvents: 'none' }}>{`PHASE ${r.nr}`}</text>
                <text x={18} y={46} fontSize={FLAECHE_SCHRIFT.titel + 2} fontWeight={700} fill={C.ink} style={{ pointerEvents: 'none' }}>{textZeilen(r.titel, r.b - 80, FLAECHE_SCHRIFT.titel + 2, 1)[0] ?? ''}</text>
                <g transform={`translate(${r.b - 44} 12)`} style={{ cursor: 'pointer' }} role="button" aria-label={zu ? `Phase „${r.titel}“ aufklappen` : `Phase „${r.titel}“ zuklappen`}
                  onClick={ev => { ev.stopPropagation(); p.onZuklappen(r.id); }} onPointerDown={ev => ev.stopPropagation()}>
                  <rect width={32} height={32} rx={10} fill={C.flaeche} stroke={RAND.stark} />
                  <Z x={7} y={7} width={18} height={18} color={C.inkDim} aria-hidden />
                </g>
              </g>
            );
          })}
          {/* Notiz-Zettel (reiner Text, kein Knoten). */}
          {zettel.map(z => <Zettel key={z.id} z={z} gewaehlt={gewaehlt.has(z.id)} />)}
          {/* Fäden: der Strich darunter (blendet CSS aus, solange der Flow läuft), Fehlerkante rot gestrichelt, Beschriftung, breite Trefferfläche. */}
          {kanten.map(k => {
            const dd = pfadVon(k.punkte);
            const an = p.kanteWahl === k.id;
            return (
              <g key={k.id}>
                <FlaechePfeil d={dd} spitze={spitze} gewaehlt={an} gestrichelt={k.zurueck} />
                {k.ausgang === 'fehler' && <path d={dd} fill="none" stroke={LEUCHT.kritisch} strokeOpacity={0.85} strokeWidth={1.6} strokeDasharray="6 5" style={{ pointerEvents: 'none' }} />}
                <path data-ws-kante={k.id} d={dd} fill="none" stroke="transparent" strokeWidth={16} style={{ cursor: p.nurLesen ? 'default' : 'pointer' }} />
                {k.text && (() => { const o = k.textOrt ?? pfeilTextOrt(k.punkte); const b = Math.max(28, k.text.length * FLAECHE_SCHRIFT.unter * 0.56 + 14); return (
                  <g transform={`translate(${o[0]} ${o[1]})`} style={{ pointerEvents: 'none' }}>
                    <rect x={k.zurueck ? -b / 2 : 0} y={-11} width={b} height={22} rx={11} fill={C.grund} stroke={k.ausgang === 'fehler' ? TIEF.rand(LEUCHT.kritisch) : an ? C.ink : RAND.stark} />
                    <text x={k.zurueck ? 0 : b / 2} textAnchor="middle" dominantBaseline="central" fontSize={FLAECHE_SCHRIFT.unter} fill={k.ausgang === 'fehler' ? LEUCHT.kritisch : C.inkDim}>{k.text}</text>
                  </g>
                ); })()}
              </g>
            );
          })}
          {/* Knoten. */}
          {[...knoten.values()].map(lk => {
            const k = nach.get(lk.id);
            const ziel = fadenZiel?.id === lk.id;
            return (
              <g key={lk.id} data-ws-knoten={lk.zu ? undefined : lk.id} data-ws-rahmen={lk.zu ? lk.zu.phaseId : undefined} transform={`translate(${lk.x} ${lk.y})`}
                style={{ cursor: p.nurLesen ? 'default' : 'grab' }} aria-label={k ? `${k.titel} — ${p.unterzeile(k)}` : lk.zu?.titel}>
                {lk.zu || !k ? <ZuKachel l={lk} /> : (
                  <KnotenZeichnung k={k} l={lk} unterzeile={p.unterzeile(k)} gewaehlt={gewaehlt.has(k.id)} ziel={ziel} zielNein={ziel && fadenZiel?.nein} belegt={belegt.get(k.id) ?? new Set()}
                    schloss={p.mitSchloss.has(k.id)} befund={p.befundJe.get(k.id) ?? null} probe={p.probe?.get(k.id)} nurLesen={p.nurLesen}
                    andockGewaehlt={p.andockWahl?.id === k.id ? p.andockWahl.art : null} />
                )}
              </g>
            );
          })}
          {/* Hilfslinien (Punkt 19), Aufziehen, der mitlaufende Faden (Strich nur ohne Flow sichtbar). */}
          {zieh?.linien.map((h, i) => <line key={i} x1={h.x1} y1={h.y1} x2={h.x2} y2={h.y2} stroke={C.aktiv} strokeOpacity={0.7} strokeWidth={1} strokeDasharray="4 4" style={{ pointerEvents: 'none' }} />)}
          {band && <rect x={band.x} y={band.y} width={band.b} height={band.h} fill={C.aktivSanft} stroke={C.aktiv} strokeWidth={1} strokeDasharray="4 3" style={{ pointerEvents: 'none' }} />}
          {zugPunkte && <path className="ff-fl-zug" d={pfadVon(zugPunkte)} fill="none" stroke={C.aktiv} strokeWidth={2} markerEnd={`url(#${spitze})`} style={{ pointerEvents: 'none' }} />}
        </g>
      </svg>
      <p className="ff-flaeche-hinweis pz-hinweis" style={{ position: 'absolute', left: 12, bottom: 8, margin: 0, fontSize: TYP.bedien, color: C.inkLeise, pointerEvents: 'none', maxWidth: 'calc(100% - 24px)' }}>{hinweis}</p>
    </div>
  );
});

function Zettel({ z, gewaehlt }: { z: NotizZettel; gewaehlt: boolean }) {
  const ton = ZETTEL_TON[z.farbe ?? 'gelb'];
  const b = z.pos.b ?? WS.zettel.b, h = z.pos.h ?? WS.zettel.h;
  const zeilen = textZeilen(z.text || 'Notiz', b - 28, FLAECHE_SCHRIFT.unter, Math.max(1, Math.floor((h - 24) / 18)));
  return (
    <g data-ws-zettel={z.id} transform={`translate(${z.pos.x} ${z.pos.y})`} style={{ cursor: 'grab' }} aria-label={`Notiz: ${z.text}`}>
      <rect width={b} height={h} rx={10} fill={C.flaeche} />
      <rect width={b} height={h} rx={10} fill={TIEF.flaeche(ton)} stroke={gewaehlt ? C.ink : TIEF.rand(ton)} strokeWidth={gewaehlt ? 2.2 : 1.2} />
      <rect width={b} height={6} rx={3} fill={TIEF.fuellung(ton)} />
      {zeilen.map((t, i) => <text key={i} x={14} y={30 + i * 18} fontSize={FLAECHE_SCHRIFT.unter} fill={z.text ? C.ink : C.inkLeise} style={{ pointerEvents: 'none' }}>{t}</text>)}
    </g>
  );
}

