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
import { ChevronsLeftRight, ChevronsRightLeft, User, Users, Cog, Bot, Heart, Plus } from 'lucide-react';
import { FARBE as C, TIEF, RAND, LEUCHT, FLAECHE_STIL, TYP } from '@/lib/make-one/design';
import type { NotizZettel, ProzessDefinition, ProzessForm, ProzessKnoten } from '@/lib/prozesse/definition';
import type { Ausgang } from '@/lib/prozesse/fluss';
import {
  WS, kantenWege, hilfslinien, startKamera, fadenWeg, anschlussAbs, einpassKamera, inhaltBox, kameraZu, chipBreite, kantenPlus, titelBox, ausgangChips,
  type WerkstattLage, type Hilfslinie, type Box, type BahnSchluessel,
} from '@/lib/prozesse/werkstatt-lage';
import { freiesFeld, type Raender } from '@/lib/einpassen';
import { schwebeRaender } from '../ui/flaeche/schwebe';
import { kanteAufWeg, type LaufMarke } from '@/lib/prozesse/laeufe-ansicht';
import { tasteZuAktion, type TastenAktion } from '@/lib/prozesse/werkstatt-tastatur';
import type { ProbeStatus } from '@/lib/prozesse/werkstatt-hinweise';
import { BAHN_TON, ZETTEL_TON, WERKSTATT_FORM_FARBE } from '@/lib/prozesse/farben';
import { pfadVon, pfeilTextOrt } from '@/lib/fulfillment/prozesse/flaeche';
import { flowEbene, bewegungReduziert, type FlowEbene, type FlowFaden } from '@/lib/lichtfaeden/flow';
import { transformVon, zoomUm, weltAus, bildAus, zwischen, sanft, flaecheHinweis, type Kamera } from '../ui/flaeche/kamera';
import { flaecheEingabe } from '../ui/flaeche/eingabe';
import { FlaechePfeil, FlaecheSpitze, textZeilen, FLAECHE_SCHRIFT } from '../ui/reise/flaeche-formen';
import { FLOW_TON } from '../ui/reise/formen';
import { KnotenZeichnung, ZuKachel } from './WerkstattKnoten';

type K = ProzessKnoten<ProzessForm>;
export interface AnhangZiel { nach?: string; ausgang?: Ausgang; vor?: string; phaseId?: string; platz?: [number, number]; /** Werkstatt bau-fertig (Punkt 3): mitten auf diesem Faden einfügen. */ zwischen?: string }
export interface FlaecheSteuerung {
  allesZeigen(): void; zoomen(f: number): void; zeige(id: string): void; mitte(): [number, number]; bildschirm(x: number, y: number): [number, number]; fokus(): void;
  /**
   * Feinschliff 22.10. (Befund 2): die Kamera fährt nur so weit, dass der Knoten ganz zu sehen ist (der Zoom bleibt). Werkstatt-Fäden (24.10.): `ausgaenge` nimmt die „+“
   * rechts am Knoten mit — sie liegen nie unter dem Seitenfeld.
   */
  insBild(id: string, o?: { ausgaenge?: boolean }): void;
  /** Werkstatt-Fäden (24.10.): wo der Zeiger zuletzt auf der Fläche war (Welt-Koordinaten) — ⌘V fügt dort ein; null = noch nie bzw. nicht über der Fläche. */
  zeiger(): [number, number] | null;
  /** Feinschliff 22.10. (Vorlagen, Befund 6): die Größe der Bühne (für „Alles zeigen“ als Kacheln) und eine Phase einpassen (nach dem Aufklappen einer Kachel). */
  groesse(): { b: number; h: number };
  /** Feinschliff 1 (23.10.): was Seitenfeld und schwebende Leisten gerade verdecken (für „Alles zeigen“ als Kacheln — dieselben Ränder wie beim Einpassen). */
  raender(): Raender;
  rahmenZeigen(phaseId: string): void;
}

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
  /** Lauf-Ansicht (22.10., Punkt 29): Stand je Knoten und der echte Weg (`<von>><nach>`) — nicht erreichte Knoten grau, der Lichtfaden leuchtet nur den Weg. */
  lauf?: { marken: ReadonlyMap<string, LaufMarke>; weg: ReadonlySet<string> } | null;
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
  /** Werkzeug-Muster (22.10.): der Maßstab je gezeichnetem Bild (Zoom-Leiste „87 %“) — schreibt direkt, kein Zustand je Bild. */
  onMassstab?: (s: number) => void;
  // ── Werkstatt bau-fertig (22.10., n8n-Niveau) ──
  /** Fäden, auf denen mitten ein „+“ steht (dazwischen einfügen) — die Regel sagt die Werkstatt (`zwischenGrund`). */
  zwischen?: ReadonlySet<string>;
  onZwischen?: (kanteId: string, bildschirm: [number, number]) => void;
  /** Das Ende eines gewählten Fadens auf einen anderen Schritt gezogen. */
  onUmhaengen?: (kanteId: string, ziel: string) => void;
  /** Doppelklick auf einen Knoten (erster: Namen direkt ändern, zweiter: großes Fenster). */
  onDoppel?: (id: string) => void;
  /** Dieser Knoten wird gerade direkt auf der Fläche umbenannt. */
  umbenennen?: string | null;
  /** Ende des Umbenennens: neuer Name bzw. null (abgebrochen). */
  onUmbenannt?: (id: string, titel: string | null) => void;
  /** Punkt 6: die Sätze der Befunde je Knoten — beim Überfahren der Marke; ein Klick springt ins Feld. */
  befundTexte?: ReadonlyMap<string, readonly { text: string; feld?: string; stufe: 'fehler' | 'offen' }[]>;
  onBefund?: (id: string, feld?: string) => void;
  /** Punkt 12: die Karte (Minimap) unten rechts. */
  karte?: boolean;
  /** Punkt „Zettelgröße ziehen“: die neue Größe eines Zettels (Welt-Bildpunkte). */
  onZettelGroesse?: (id: string, b: number, h: number) => void;
  /** Im Werkzeugmodus verschiebt das Mausrad die Fläche (keine Seite zum Rollen). */
  radSchiebt?: boolean;
}

type Zug =
  | { art: 'knoten'; zeiger: number; start: [number, number]; ids: string[]; aktiv: boolean; erweitern: boolean; id: string }
  | { art: 'faden'; zeiger: number; start: [number, number]; von: string; ausgang: Ausgang; aktiv: boolean }
  | { art: 'band'; zeiger: number; start: [number, number]; aktiv: boolean; erweitern: boolean }
  | { art: 'ende'; zeiger: number; start: [number, number]; kante: string; von: [number, number]; aktiv: boolean }
  | { art: 'groesse'; zeiger: number; start: [number, number]; id: string; b: number; h: number; aktiv: boolean };

const ZIEH_PX = 5;
const ruhig = () => typeof window !== 'undefined' && bewegungReduziert();
const sauberId = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '');
const imFeld = (t: EventTarget | null) => !!(t as Element | null)?.closest?.('input,textarea,select,[contenteditable="true"]');

/** Lauf-Ansicht: der echte Weg leuchtet (kräftig, Hauptfarbe), der Rest ist gedämpft (fein, nicht erreicht). */
function fadenImLauf(k: { id: string; von: string; nach: string | null; ausgang: Ausgang; zurueck: boolean; punkte: [number, number][] }, weg: ReadonlySet<string>): FlowFaden {
  const an = kanteAufWeg(weg, k);
  return { id: k.id, punkte: k.punkte, farbe: k.ausgang === 'fehler' ? LEUCHT.kritisch : FLOW_TON.basis, staerke: an ? 'mittel' : 'fein', ...(an ? {} : { bisHier: 0 }) };
}

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
  const [befundHover, setBefundHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [groesse_, setGroesse] = useState<{ id: string; b: number; h: number } | null>(null);
  const sicht = useRef<SVGRectElement | null>(null);
  const stand = useRef(p);
  stand.current = p;
  /** Das Feld zum Umbenennen auf der Fläche (Punkt 2) — seine Lage folgt der Kamera (gesetzt im Bild, kein Zustand je Bild). */
  const namensFeld = useRef<HTMLInputElement | null>(null);
  const namensOrt = useCallback(() => {
    const el = namensFeld.current, id = stand.current.umbenennen;
    const lk = id ? stand.current.lage.knoten.get(id) : undefined;
    if (!el || !lk) return;
    const t = titelBox(lk) ?? { x: lk.x + lk.koerper.x, y: lk.y + lk.koerper.y + lk.koerper.h / 2 - 20, b: lk.koerper.b, h: 40 };
    const k = kamera.current;
    const [x, y] = bildAus(k, t.x, t.y);
    el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`;
    el.style.width = `${Math.max(160, Math.round(t.b * k.s))}px`;
  }, []);

  const groesse = () => { const r = buehne.current?.getBoundingClientRect(); return { b: r?.width || 960, h: r?.height || 600 }; };
  /** Feinschliff 1 (23.10.): eingepasst wird ins freie Feld — Seitenfeld, Kopfzeile, Leisten und Knoten-Auswahl schweben über der Fläche (../ui/flaeche/schwebe.ts). */
  const raender = () => schwebeRaender(buehne.current);
  const zeichne = useCallback(() => {
    if (bild.current) return;
    bild.current = requestAnimationFrame(() => {
      bild.current = 0;
      const k = kamera.current;
      welt.current?.setAttribute('transform', transformVon(k));
      muster.current?.setAttribute('patternTransform', `translate(${k.x} ${k.y}) scale(${k.s})`);
      ebene.current?.kamera(k);
      stand.current.onMassstab?.(k.s);
      namensOrt();
      // Punkt 12: der sichtbare Ausschnitt in der Karte (Welt-Koordinaten).
      const r = sicht.current;
      if (r) { const g = groesse(); r.setAttribute('x', String(-k.x / k.s)); r.setAttribute('y', String(-k.y / k.s)); r.setAttribute('width', String(g.b / k.s)); r.setAttribute('height', String(g.h / k.s)); }
    });
  }, [namensOrt]);
  const setze = useCallback((k: Kamera) => { kamera.current = k; zeichne(); }, [zeichne]);
  const fliege = useCallback((ziel: Kamera) => {
    if (ruhig()) { setze(ziel); return; }
    const von = kamera.current, t0 = performance.now();
    const schritt = (t: number) => { const a = Math.min(1, (t - t0) / 260); setze(zwischen(von, ziel, sanft(a))); if (a < 1) requestAnimationFrame(schritt); };
    requestAnimationFrame(schritt);
  }, [setze]);

  useImperativeHandle(ref, () => ({
    // Feinschliff 22.10. (Befund 4): auf den Inhalt einpassen (nicht auf leere Bahnränder), höchstens 100 % — seit 23.10. im freien Feld (`raender`).
    allesZeigen: () => { const g = groesse(); fliege(einpassKamera(inhaltBox(stand.current.lage, stand.current.d.zettel ?? []), g, undefined, undefined, raender())); },
    insBild: (id, o) => {
      const k = stand.current.lage.knoten.get(id);
      if (!k) return;
      const g = groesse();
      // Die „+“ der Ausgänge stehen rechts neben dem Körper (hinter Beschriftungen auch weiter) — mit ihnen, damit keines unter dem Seitenfeld liegt.
      const rechts = o?.ausgaenge ? Math.max(0, ...(chipsRef.current.get(id) ?? []).map(c => c.box.x + c.box.b - k.b)) + 2 * (WS.ausgang.abstand + WS.ausgang.r) : 0;
      const z = kameraZu(kamera.current, { x: k.x, y: k.y, b: k.b + rechts, h: k.h }, g, undefined, raender());
      if (z !== kamera.current) fliege(z);
    },
    zoomen: f => { const g = groesse(); fliege(zoomUm(kamera.current, f, g.b / 2, g.h / 2)); },
    groesse: () => groesse(),
    raender: () => raender(),
    rahmenZeigen: phaseId => {
      const r = stand.current.lage.rahmen.find(x => x.id === phaseId);
      if (!r) return;
      const drin = [...stand.current.lage.knoten.values()].filter(k => k.phaseId === phaseId);
      fliege(einpassKamera(drin.length ? inhaltBox({ knoten: new Map(drin.map(k => [k.id, k])), box: r }) : r, groesse(), undefined, undefined, raender()));
    },
    zeige: id => {
      const k = stand.current.lage.knoten.get(id);
      if (!k) return;
      // Mitten ins freie Feld (nicht unter das Seitenfeld, das die Einstellungen des gewählten Schritts zeigt).
      const f = freiesFeld(groesse(), raender()), s = Math.max(kamera.current.s, 0.9);
      fliege({ s, x: Math.round(f.x + f.b / 2 - (k.x + k.b / 2) * s), y: Math.round(f.y + f.h / 2 - (k.y + k.h / 2) * s) });
    },
    mitte: () => { const g = groesse(); return weltAus(kamera.current, g.b / 2, g.h / 2); },
    zeiger: () => letzterZeiger.current,
    bildschirm: (x, y) => bildAus(kamera.current, x, y),
    fokus: () => svg.current?.focus({ preventScroll: true }),
  }), [fliege]);

  // Beim Öffnen (je Szene): lesbar einpassen — alles, wenn es lesbar passt, sonst oben links am Anfang (lib/prozesse/werkstatt-lage.ts `startKamera`). Ein Bild
  // später (noch vor dem ersten Zeichnen): im Vollbild stehen die schwebenden Leisten erst dann im Rahmen (Feinschliff 1, 23.10.). Eine Kamerafahrt, die schon
  // läuft (Schritt aus der Adresse), bleibt.
  useEffect(() => {
    const vorher = kamera.current;
    const t = requestAnimationFrame(() => { if (kamera.current === vorher) setze(startKamera(stand.current.lage.box, groesse(), undefined, raender())); });
    setGeraet({ mac: /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), touch: !!window.matchMedia?.('(pointer: coarse)').matches });
    return () => cancelAnimationFrame(t);
  }, [p.szene, setze]);

  // Zoom und Schieben am SVG (nur dort). Am Handy bzw. nur lesend schiebt auch das Ziehen auf freier Fläche.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const e = flaecheEingabe(el, {
      kamera: () => kamera.current, setze,
      freiSchiebt: () => stand.current.nurLesen,
      radSchiebt: () => !!stand.current.radSchiebt,
      istFrei: z => !(z as Element | null)?.closest?.('[data-ws-knoten],[data-ws-anschluss],[data-ws-plus],[data-ws-kante],[data-ws-zettel],[data-ws-rahmen],[data-ws-unter],[data-ws-zu],[data-ws-zwischen],[data-ws-ende],[data-ws-befund],[data-ws-groesse]'),
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
  const zettel = useMemo(() => (p.d.zettel ?? []).map(z => {
    let x = zieh?.ids.includes(z.id) ? { ...z, pos: { ...z.pos, x: z.pos.x + zieh.dx, y: z.pos.y + zieh.dy } } : z;
    if (groesse_?.id === z.id) x = { ...x, pos: { ...x.pos, b: groesse_.b, h: groesse_.h } };
    return x;
  }), [p.d.zettel, zieh, groesse_]);
  const nach = useMemo(() => new Map(p.d.knoten.map(k => [k.id, k])), [p.d.knoten]);
  /** Feinschliff 1 (23.10.): die Beschriftungen der Fäden je Knoten — die „+“ der Ausgänge weichen ihnen aus, ein Ausgang mit Beschriftung trägt keinen zweiten Namen. */
  const chips = useMemo(() => ausgangChips({ knoten, kanten }), [knoten, kanten]);
  const chipsRef = useRef(chips);
  chipsRef.current = chips;
  /** Punkt 14: ausgeschaltete Schritte und die Schlösser dahinter (sie werden mit übersprungen). */
  const aus = useMemo(() => { const m = new Set(p.d.knoten.filter(k => k.deaktiviert).map(k => k.id)); for (const k of p.d.knoten) if (k.schloss && m.has(k.schloss.fuer)) m.add(k.id); return m; }, [p.d.knoten]);
  const belegt = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const k of p.lage.kanten) { const s = m.get(k.von) ?? new Set<string>(); s.add(k.ausgang === 'ja' && nach.get(k.von)?.form !== 'entscheidung' && nach.get(k.von)?.form !== 'freigabe' ? 'weiter' : k.ausgang); m.set(k.von, s); }
    return m;
  }, [p.lage.kanten, nach]);

  // ── Der Flow: alle Fäden (Kanten + feine Fäden der Andockpunkte) auf EINER Ebene ──
  const faeden = useMemo<FlowFaden[]>(() => {
    const weg = p.lauf?.weg;
    const l: FlowFaden[] = kanten.map(k => (weg ? fadenImLauf(k, weg) : fadenVon(k)));
    for (const k of knoten.values()) {
      if (!k.unterknoten) continue;
      const c = k.koerper;
      for (const t of k.unterknoten.teile) {
        const a = k.unterknoten.andocks.find(x => x.art === t.art)!;
        l.push({ id: `${t.id}~faden`, punkte: [[k.x + a.x, k.y + c.y + c.h], [k.x + a.x, k.y + c.y + c.h + 26], [k.x + t.cx, k.y + t.cy - WS.andock.r]], farbe: WERKSTATT_FORM_FARBE.agent, staerke: 'fein', ...(t.leer ? { bisHier: 0 } : {}) });
      }
    }
    return l;
  }, [kanten, knoten, p.lauf]);
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
  /** Werkstatt-Fäden (24.10.): die letzte Lage des Zeigers über der Fläche (für ⌘V an der Mausposition). */
  const letzterZeiger = useRef<[number, number] | null>(null);
  const welt0 = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = svg.current!.getBoundingClientRect();
    return weltAus(kamera.current, e.clientX - r.left, e.clientY - r.top);
  };
  const runter = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || imFeld(e.target)) return;
    svg.current?.focus({ preventScroll: true }); // Tastatur gehört danach der Fläche
    const t = e.target as Element;
    const w = welt0(e);
    const plus = t.closest('[data-ws-plus],[data-ws-zwischen]');
    if (plus) return; // Klick (onClick) öffnet die Formauswahl
    // Punkt 6: die Befund-Marke am Knoten — ein Klick springt in das betroffene Feld.
    const bf = t.closest('[data-ws-befund]')?.getAttribute('data-ws-befund');
    if (bf) { e.preventDefault(); p.onBefund?.(bf, p.befundTexte?.get(bf)?.find(x => x.feld)?.feld); return; }
    // Zettelgröße ziehen (Anfasser unten rechts am gewählten Zettel).
    const gz = t.closest('[data-ws-groesse]')?.getAttribute('data-ws-groesse');
    if (gz && !p.nurLesen) {
      const z = (stand.current.d.zettel ?? []).find(x => x.id === gz);
      if (z) { zug.current = { art: 'groesse', zeiger: e.pointerId, start: w, id: gz, b: z.pos.b ?? WS.zettel.b, h: z.pos.h ?? WS.zettel.h, aktiv: false }; svg.current?.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    }
    // Werkstatt bau-fertig (Punkt 4): das Ende eines gewählten Fadens greifen und auf einen anderen Schritt ziehen.
    const ende = t.closest('[data-ws-ende]')?.getAttribute('data-ws-ende');
    if (ende && !p.nurLesen) {
      const k = stand.current.lage.kanten.find(x => x.id === ende);
      if (k?.punkte.length) { zug.current = { art: 'ende', zeiger: e.pointerId, start: w, kante: k.id, von: k.punkte[0], aktiv: false }; svg.current?.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    }
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
    // Eine zugeklappte Phase (Kachel): ein Klick klappt sie auf (Befund 6) — der Rahmen-Kopf wählt weiter die Phase.
    const zuK = t.closest('[data-ws-zu]')?.getAttribute('data-ws-zu');
    if (zuK) { p.onZuklappen(zuK); return; }
    const rahmen = t.closest('[data-ws-rahmen]')?.getAttribute('data-ws-rahmen');
    if (rahmen) { p.onRahmen(rahmen); return; }
    if (!p.nurLesen) { zug.current = { art: 'band', zeiger: e.pointerId, start: w, aktiv: false, erweitern: e.shiftKey }; svg.current?.setPointerCapture(e.pointerId); }
  };
  const bewegt = (e: RPointerEvent<SVGSVGElement>) => {
    const z = zug.current;
    letzterZeiger.current = welt0(e);
    if (!z) {
      // Punkt 6: über der Befund-Marke steht der Satz (nicht nur das Symbol).
      const bf = (e.target as Element).closest?.('[data-ws-befund]')?.getAttribute('data-ws-befund') ?? null;
      if (bf !== (befundHover?.id ?? null)) {
        const r = buehne.current?.getBoundingClientRect();
        setBefundHover(bf && r ? { id: bf, x: e.clientX - r.left, y: e.clientY - r.top } : null);
      }
      return;
    }
    if (z.zeiger !== e.pointerId) return;
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
    } else if (z.art === 'groesse') {
      setGroesse({ id: z.id, b: Math.max(160, Math.round(z.b + dx)), h: Math.max(160, Math.round(z.h + dy)) });
    } else if (z.art === 'ende') {
      const ziel = (document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ws-knoten]')?.getAttribute('data-ws-knoten')) ?? null;
      const zk = ziel ? stand.current.lage.knoten.get(ziel) : null;
      const ein = zk ? anschlussAbs(zk, 'ein') : null;
      setFadenZiel(ziel ? { id: ziel, nein: !ein } : null);
      setZugPunkte(fadenWeg(z.von, 'rechts', ein ? ein.abs : w, Math.max(z.von[1], w[1]) + 40).punkte);
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
    if (z.art === 'groesse') {
      const g = groesse_;
      setGroesse(null);
      if (z.aktiv && g) p.onZettelGroesse?.(g.id, g.b, g.h);
      return;
    }
    if (z.art === 'ende') {
      const ziel = fadenZiel;
      setZugPunkte(null); setFadenZiel(null);
      if (z.aktiv && ziel && !ziel.nein) p.onUmhaengen?.(z.kante, ziel.id);
      return;
    }
    if (z.art === 'faden') {
      const ziel = fadenZiel;
      setZugPunkte(null); setFadenZiel(null);
      if (z.aktiv && ziel && !ziel.nein) { p.onVerbinden(z.von, z.ausgang, ziel.id); return; }
      // Werkstatt-Fäden (24.10., Bau-Test): nur geklickt (nicht gezogen) wählt den Knoten — die Bausteinauswahl öffnet nur das „+“.
      if (!z.aktiv) { p.onAuswahl([z.von]); return; }
      // Ins Leere gezogen: die Formauswahl — dort, wo losgelassen wurde.
      const r = svg.current!.getBoundingClientRect();
      const w = welt0(e);
      p.onAnhaengen({ nach: z.von, ausgang: z.ausgang, platz: [Math.round(w[0]), Math.round(w[1])] }, [e.clientX - r.left, e.clientY - r.top]);
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
    const zw = (e.target as Element).closest('[data-ws-zwischen]')?.getAttribute('data-ws-zwischen');
    if (zw && !p.nurLesen) { const r = svg.current!.getBoundingClientRect(); p.onZwischen?.(zw, [e.clientX - r.left, e.clientY - r.top]); return; }
    const pl = (e.target as Element).closest('[data-ws-plus]')?.getAttribute('data-ws-plus');
    if (!pl || p.nurLesen) return;
    const [von, art] = pl.split('|');
    const r = svg.current!.getBoundingClientRect();
    p.onAnhaengen({ nach: von, ausgang: art as Ausgang }, [e.clientX - r.left, e.clientY - r.top]);
  };
  const doppel = (e: RMouseEvent<SVGSVGElement>) => {
    const id = (e.target as Element).closest('[data-ws-knoten]')?.getAttribute('data-ws-knoten');
    if (id) { e.preventDefault(); p.onDoppel?.(id); }
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
        onPointerDown={runter} onPointerMove={bewegt} onPointerUp={hoch} onPointerCancel={hoch} onPointerLeave={() => { if (!zug.current) letzterZeiger.current = null; }} onClick={plusKlick} onDoubleClick={doppel} onKeyDown={taste}
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
          {zettel.map(z => <Zettel key={z.id} z={z} gewaehlt={gewaehlt.has(z.id)} anfasser={!p.nurLesen && p.auswahl.length === 1 && gewaehlt.has(z.id)} />)}
          {/* Fäden: der Strich darunter (blendet CSS aus, solange der Flow läuft), Fehlerkante rot gestrichelt, Beschriftung, breite Trefferfläche. */}
          {kanten.map(k => {
            const dd = pfadVon(k.punkte);
            const an = p.kanteWahl === k.id;
            const zw = !p.nurLesen && !zieh && p.zwischen?.has(k.id);
            const mp = zw ? kantenPlus(k) : null;
            const ende = an && !p.nurLesen && !zieh ? k.punkte.at(-1) : undefined;
            return (
              <g key={k.id} className={`pw-kante${an ? ' pw-kante-an' : ''}`}>
                <FlaechePfeil d={dd} spitze={spitze} gewaehlt={an} gestrichelt={k.zurueck} />
                {k.ausgang === 'fehler' && <path d={dd} fill="none" stroke={LEUCHT.kritisch} strokeOpacity={0.85} strokeWidth={1.6} strokeDasharray="6 5" style={{ pointerEvents: 'none' }} />}
                <path data-ws-kante={k.id} d={dd} fill="none" stroke="transparent" strokeWidth={16} style={{ cursor: p.nurLesen ? 'default' : 'pointer' }} />
                {k.text && (() => { const o = k.textOrt ?? pfeilTextOrt(k.punkte); const b = chipBreite(k.text); return (
                  <g transform={`translate(${o[0]} ${o[1]})`} style={{ pointerEvents: 'none' }}>
                    <rect x={k.zurueck ? -b / 2 : 0} y={-WS.chip.hoehe / 2} width={b} height={WS.chip.hoehe} rx={WS.chip.hoehe / 2} fill={C.grund} stroke={k.ausgang === 'fehler' ? TIEF.rand(LEUCHT.kritisch) : an ? C.ink : RAND.stark} />
                    <text x={k.zurueck ? 0 : b / 2} textAnchor="middle" dominantBaseline="central" fontSize={WS.chip.schrift} fill={k.ausgang === 'fehler' ? LEUCHT.kritisch : C.inkDim}>{k.text}</text>
                  </g>
                ); })()}
                {/* Werkstatt bau-fertig (Punkt 3): „+“ mitten auf dem Faden — dazwischen einfügen (beim Überfahren bzw. am gewählten Faden). */}
                {mp && (
                  <g className="pw-kante-plus" data-ws-zwischen={k.id} transform={`translate(${mp[0]} ${mp[1]})`} role="button" style={{ cursor: 'pointer' }}
                    aria-label={`Dazwischen einfügen: zwischen „${nach.get(k.von)?.titel ?? ''}“ und „${(k.nach && nach.get(k.nach)?.titel) || ''}“`}>
                    <circle r={13} fill={C.flaeche} stroke={C.aktiv} strokeWidth={1.6} />
                    <Plus x={-7} y={-7} width={14} height={14} color={C.aktiv} aria-hidden />
                  </g>
                )}
                {/* Punkt 4: das Ende des gewählten Fadens greifen und umhängen. */}
                {ende && (
                  <g data-ws-ende={k.id} transform={`translate(${ende[0]} ${ende[1]})`} style={{ cursor: 'grab' }} role="button" aria-label="Ende des Fadens greifen und auf einen anderen Schritt ziehen">
                    <circle r={14} fill="transparent" />
                    <circle r={8} fill={C.aktiv} stroke={C.grund} strokeWidth={2} />
                  </g>
                )}
              </g>
            );
          })}
          {/* Knoten. */}
          {[...knoten.values()].map(lk => {
            const k = nach.get(lk.id);
            const ziel = fadenZiel?.id === lk.id;
            return (
              <g key={lk.id} data-ws-knoten={lk.zu ? undefined : lk.id} data-ws-zu={lk.zu ? lk.zu.phaseId : undefined} transform={`translate(${lk.x} ${lk.y})`}
                style={{ cursor: lk.zu ? 'pointer' : p.nurLesen ? 'default' : 'grab' }} {...(lk.zu ? { role: 'button' } : {})}
                aria-label={lk.zu ? `Phase „${lk.zu.titel}“ aufklappen (${lk.zu.schritte} Schritte)` : k ? `${k.titel} — ${p.unterzeile(k)}` : undefined}>
                {lk.zu || !k ? <ZuKachel l={lk} /> : (
                  <KnotenZeichnung k={k} l={lk} unterzeile={p.unterzeile(k)} gewaehlt={gewaehlt.has(k.id)} ziel={ziel} zielNein={ziel && fadenZiel?.nein} belegt={belegt.get(k.id) ?? new Set()} chips={chips.get(lk.id)}
                    schloss={p.mitSchloss.has(k.id)} befund={p.befundJe.get(k.id) ?? null} probe={p.probe?.get(k.id)} nurLesen={p.nurLesen} aus={aus.has(k.id)}
                    {...(p.lauf ? { marke: p.lauf.marken.get(k.id), grau: !p.lauf.marken.has(k.id) } : {})}
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
      {/* Punkt 2: den Namen direkt auf der Fläche ändern (Doppelklick bzw. F2) — Enter übernimmt, Esc bricht ab, Verlassen übernimmt. */}
      {p.umbenennen && nach.get(p.umbenennen) && (
        <NamensFeld key={p.umbenennen} feld={namensFeld} wert={nach.get(p.umbenennen)!.titel} onSetzen={namensOrt}
          onFertig={t => p.onUmbenannt?.(p.umbenennen!, t)} />
      )}
      {/* Punkt 6: der Satz des Befunds beim Überfahren der Marke — ein Klick springt ins Feld. */}
      {befundHover && p.befundTexte?.get(befundHover.id)?.length ? (
        <div role="tooltip" className="pw-befund-tipp" style={{ left: Math.max(8, befundHover.x + 14), top: Math.max(8, befundHover.y + 14) }}>
          {p.befundTexte.get(befundHover.id)!.slice(0, 4).map((b, i) => <span key={i} style={{ color: b.stufe === 'fehler' ? LEUCHT.kritisch : LEUCHT.achtung }}>{b.text}</span>)}
          {(p.befundTexte.get(befundHover.id)!.length > 4) && <span style={{ color: C.inkLeise }}>{`+${p.befundTexte.get(befundHover.id)!.length - 4} weitere`}</span>}
          <span style={{ color: C.inkLeise }}>Klick springt ins Feld.</span>
        </div>
      ) : null}
      {/* Punkt 12: die Karte (Minimap) — klicken bzw. ziehen setzt den Ausschnitt. */}
      {p.karte && <Karte lage={p.lage} d={p.d} sicht={sicht} onMitte={(wx, wy) => { const g = groesse(), k = kamera.current; setze({ s: k.s, x: g.b / 2 - wx * k.s, y: g.h / 2 - wy * k.s }); }} onZeigen={zeichne} />}
    </div>
  );
});

/** Das Feld zum Umbenennen auf der Fläche (Punkt 2): liegt über dem Namen des Knotens, wählt den Text beim Öffnen; Enter übernimmt, Esc bricht ab. */
function NamensFeld({ feld, wert, onSetzen, onFertig }: { feld: { current: HTMLInputElement | null }; wert: string; onSetzen: () => void; onFertig: (t: string | null) => void }) {
  const fertig = useRef(false);
  const ende = (t: string | null) => { if (fertig.current) return; fertig.current = true; onFertig(t); };
  useEffect(() => { onSetzen(); feld.current?.focus({ preventScroll: true }); feld.current?.select(); }, [feld, onSetzen]);
  return (
    <input ref={el => { feld.current = el; }} className="pw-namensfeld" aria-label="Name des Schritts" defaultValue={wert} maxLength={120}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); ende((e.target as HTMLInputElement).value.trim() || null); }
        else if (e.key === 'Escape') { e.preventDefault(); ende(null); }
      }}
      onBlur={e => ende(e.target.value.trim() || null)}
      onPointerDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()} />
  );
}

/** Die Karte (Minimap, Punkt 12 — wie die Bühne der Landkarte): Rahmen und Knoten in ihren Farben, der sichtbare Ausschnitt als Rahmen. */
function Karte({ lage, d, sicht, onMitte, onZeigen }: { lage: WerkstattLage; d: Pick<ProzessDefinition, 'knoten'>; sicht: { current: SVGRectElement | null }; onMitte: (x: number, y: number) => void; onZeigen: () => void }) {
  const mm = useMemo(() => {
    const B = 200, H = 130, b = lage.box;
    const s = Math.min(B / Math.max(1, b.b), H / Math.max(1, b.h)) * 0.92;
    return { B, H, s, ox: (B - b.b * s) / 2 - b.x * s, oy: (H - b.h * s) / 2 - b.y * s };
  }, [lage.box]);
  const form = useMemo(() => new Map(d.knoten.map(k => [k.id, k.form ?? 'schritt'])), [d.knoten]);
  useEffect(() => { onZeigen(); }, [onZeigen]);
  const ziehen = useRef(false);
  const setze = (e: RPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onMitte((e.clientX - r.left - mm.ox) / mm.s, (e.clientY - r.top - mm.oy) / mm.s);
  };
  return (
    <div className="pz-minimap pw-karte" role="group" aria-label="Karte — klicken oder ziehen, um den Ausschnitt zu verschieben">
      <svg width={mm.B} height={mm.H} style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }}
        onPointerDown={e => { ziehen.current = true; e.currentTarget.setPointerCapture(e.pointerId); setze(e); }}
        onPointerMove={e => { if (ziehen.current) setze(e); }}
        onPointerUp={e => { ziehen.current = false; e.currentTarget.releasePointerCapture(e.pointerId); }}>
        <g transform={`translate(${mm.ox} ${mm.oy}) scale(${mm.s})`}>
          {lage.rahmen.map(r => <rect key={r.id} x={r.x} y={r.y} width={r.b} height={r.h} rx={12 / mm.s} fill="none" stroke={C.inkLeise} strokeWidth={1.5 / mm.s} />)}
          {[...lage.knoten.values()].map(k => <rect key={k.id} x={k.x + k.koerper.x} y={k.y + k.koerper.y} width={k.koerper.b} height={k.koerper.h} rx={6 / mm.s} fill={WERKSTATT_FORM_FARBE[form.get(k.id) ?? 'schritt']} fillOpacity={0.7} />)}
          <rect ref={sicht} fill="none" stroke={C.ink} strokeWidth={2 / mm.s} />
        </g>
      </svg>
    </div>
  );
}

function Zettel({ z, gewaehlt, anfasser }: { z: NotizZettel; gewaehlt: boolean; anfasser?: boolean }) {
  const ton = ZETTEL_TON[z.farbe ?? 'gelb'];
  const b = z.pos.b ?? WS.zettel.b, h = z.pos.h ?? WS.zettel.h;
  const zeilen = textZeilen(z.text || 'Notiz', b - 28, FLAECHE_SCHRIFT.unter, Math.max(1, Math.floor((h - 24) / 18)));
  return (
    <g data-ws-zettel={z.id} transform={`translate(${z.pos.x} ${z.pos.y})`} style={{ cursor: 'grab' }} aria-label={`Notiz: ${z.text}`}>
      <rect width={b} height={h} rx={10} fill={C.flaeche} />
      <rect width={b} height={h} rx={10} fill={TIEF.flaeche(ton)} stroke={gewaehlt ? C.ink : TIEF.rand(ton)} strokeWidth={gewaehlt ? 2.2 : 1.2} />
      <rect width={b} height={6} rx={3} fill={TIEF.fuellung(ton)} />
      {zeilen.map((t, i) => <text key={i} x={14} y={30 + i * 18} fontSize={FLAECHE_SCHRIFT.unter} fill={z.text ? C.ink : C.inkLeise} style={{ pointerEvents: 'none' }}>{t}</text>)}
      {anfasser && (
        <g data-ws-groesse={z.id} transform={`translate(${b - 18} ${h - 18})`} style={{ cursor: 'nwse-resize' }} role="button" aria-label="Größe des Zettels ziehen">
          <rect width={22} height={22} fill="transparent" />
          <path d="M16 4 L4 16 M16 10 L10 16" stroke={C.inkDim} strokeWidth={1.6} strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

