'use client';

// ─── Fulfillment · Prozess-Editor › Fläche — freies Zeichnen wie in Miro (17.10.; DESIGN_STANDARD.md › Prozess-Visualisierung › Fläche) ──────────
// Rückmeldung 17.10.: „Ich möchte, dass wir uns auf das Fulfillment konzentrieren — auf Miro und all diese Prozess-Themen.“ Gewählt: „Zeichnen wie in Miro:
// freie Fläche, Kästen frei platzieren, Pfeile ziehen, zoomen und schieben, Rahmen für Phasen — nicht nur die geordnete Liste von oben nach unten.“
// Die Fläche ist eine ANDERE ANSICHT DERSELBEN Vorlage (EINE Wahrheit, lib/fulfillment/prozesse/flaeche.ts): Lage und Pfeil-Texte sind optional; Pfeile sind
// die Reihenfolge + die Zweige. Alles schreibt über den Schreibweg des Editors (PATCH /api/fulfillment/editor, Stand, Rückgängig/Wiederholen).
//   · Fläche: SVG ohne Ende. Pinch bzw. ⌘ + Scrollen zoomt zum Zeiger, zwei Finger bzw. Leertaste + Ziehen verschiebt (components/os/ui/flaeche/*, Rechnung
//     der Brain-Kugel), Knöpfe − / + / „Alles zeigen“ / „Zurücksetzen“, Raster mit Einrasten (abschaltbar).
//   · Rahmen = Phasen: verschieben (die Knoten wandern mit), Größe ändern (Ecke unten rechts), umbenennen (Doppelklick auf den Titel). Die Reihenfolge der
//     Phasen bleibt die Reise-Zeile — ein Rahmen, der an einem anderen vorbeigezogen wird, stellt sie um.
//   · Knoten: aus der Palette ziehen (Start · Phase, Schritt, Nachricht, Entscheidung, Erinnerung, Termin, Baustein), verschieben (auch in einen anderen
//     Rahmen), Mehrfachauswahl (Aufziehen, ⇧-Klick, ⌘A), Kopieren/Einfügen (⌘C/⌘V), Löschen (Entf → Papierkorb), Text direkt bearbeiten (Doppelklick, Enter).
//   · Pfeile: von einem Anfasser zu einem anderen Knoten ziehen (an einer Entscheidung: ja/nein), beschriften (Doppelklick), Zweige lösen (Entf); gewinkelt.
//   · Tastatur: Tab wandert durch die Knoten, Pfeiltasten verschieben (⇧ = weiter), Entf löscht, Enter bearbeitet, + − 0 zoomen, „Verbinden mit …“ als Menü.
//   · Am Handy: nur ansehen (Pinch, zwei Finger schieben) — bearbeitet wird in der Liste. „Als Bild speichern“: SVG oder PNG, nur die Fläche mit Legende.
// Leistung: keine React-Zustände je Mausbewegung — Kamera und Ziehen in Refs, gezeichnet per requestAnimationFrame direkt am SVG (wie die Kugel).
// Markenzeichen: der Flow (17.10.): die Pfeile sind Lichtfäden auf einer Leinwand UNTER dem SVG (lib/lichtfaeden/flow.ts `flowEbene` — derselbe Zeichner wie
// Reise und Fluss, im gemeinsamen Takt). Die Ebene bekommt Kamera und Wege direkt (beim Ziehen nur die betroffenen), der neue Pfeil zieht einen Faden mit;
// reduzierte Bewegung = Standbild. „Als Bild speichern“ zeichnet die Fäden als ruhiges Standbild ins SVG (`FlaechePfeil still`).

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { Plus, Minus, Maximize2, LocateFixed, ImageDown, Grid3x3 } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, RAND, ECKE, SCHRIFT, FLAECHE_STIL, LEUCHT, TIEF } from '@/lib/make-one/design';
import { Knopf } from '../../ui';
import { neueKennung } from '@/lib/kennung';
import { flaecheBild, pfeilWeg, pfadVon, pfeilTextOrt, lagenAlle, allesFest, rahmenBei, knotenBei, FL, umrissVon, type Box, type FlaecheBild, type FlKnoten, type FlPfeil } from '@/lib/fulfillment/prozesse/flaeche';
import { umrissMass } from '@/lib/fulfillment/prozesse/flaeche-lage';
import { FORM_TITEL, FORM_VORGABE, type EditorOp, type EditorZiel } from '@/lib/fulfillment/prozesse/editor';
import { flussFormVon } from '@/lib/fulfillment/prozesse/reise-bild';
import { GRENZEN, LAGE } from '@/lib/fulfillment/grenzen';
import type { KnotenForm, ProzessVorlage } from '@/lib/fulfillment/typen';
import { FlaecheForm, FlaecheStart, FlaecheRahmen, FlaecheGruppe, FlaecheSpitze, FlaechePfeil, FlaecheLegende, FLAECHE_ZIEL } from '../../ui/reise/flaeche-formen';
import { FreigabeRaute, FLOW_TON } from '../../ui/reise/formen';
import { flowEbene, bewegungReduziert, type FlowEbene } from '@/lib/lichtfaeden/flow';
import { flaecheFaden } from '@/lib/reise/flow';
import { FormZeichen } from '../../ui/reise/ReiseBild';
import { allesZeigen, transformVon, zoomUm, ZOOM_SCHRITT, weltAus, bildAus, zwischen, sanft, einrasten, flaecheHinweis, type Kamera } from '../../ui/flaeche/kamera';
import { flaecheEingabe, type FlaecheEingabe } from '../../ui/flaeche/eingabe';
import { istZiehen } from '../../kugel/steuerung';
import { formFuerBaustein } from './bild';
import { EXPORT_SCHRIFT, exportRahmen, dateiName, svgText, svgZuPng, herunterladen } from './flaeche-export';
import { ZIEL_PX } from './SeitenFeld';

export type FlaechePaletteEintrag = 'phase' | KnotenForm | 'baustein';
/** Die Palette der Fläche — in dieser Reihenfolge (Start einer neuen Phase = ein neuer Rahmen). */
export const FLAECHE_PALETTE: readonly FlaechePaletteEintrag[] = ['phase', 'schritt', 'nachricht', 'entscheidung', 'erinnerung', 'termin', 'baustein'];
export const paletteTitel = (f: FlaechePaletteEintrag) => (f === 'phase' ? 'Start · Phase' : f === 'baustein' ? 'Baustein' : FORM_TITEL[f]);
/** Ab so vielen Pixeln Bewegung ist es Ziehen (wie überall im Editor). */
const ZIEH_PX = 5;
/** Kleinster Zoom beim Öffnen — darunter ist die Schrift nicht mehr lesbar (Knoten-Schrift 13 px → ≥ 8 px). */
const START_MIN = 0.6;
const MERKER_RASTER = 'make-ff-flaeche-raster';

type Baustein = { id: string; titel: string; art: string };
export interface FlaecheProps {
  vorlage: ProzessVorlage;
  bausteine: readonly Baustein[];
  darf: boolean; laeuft: boolean;
  /** Am Handy: nur ansehen. */
  handy?: boolean;
  senden: (ops: EditorOp[]) => Promise<boolean>;
  /** Gewählter Knoten im Editor (Seitenfeld). */
  gewaehlt: string | null;
  onWahl: (phaseId: string, knotenId: string | null) => void;
  /** Die Bibliothek öffnen; `fertig` bekommt den gewählten Baustein. */
  bausteinWaehlen: (fertig: (b: Baustein) => void) => void;
  meldung: (text: string, art: 'gut' | 'kritisch' | 'achtung') => void;
  /** Eine Phase löschen (mit Rückfrage, in den Papierkorb). */
  loeschenPhase: (id: string) => void;
  /** Das Seitenfeld (rechts). */
  feld?: ReactNode;
  /** Am Handy: zur Liste, um zu bearbeiten. */
  zurListe?: (knotenId: string | null) => void;
}

type Zug = {
  art: 'knoten' | 'rahmen' | 'groesse' | 'pfeil' | 'band';
  zeiger: number; start: [number, number]; welt0: [number, number]; aktiv: boolean;
  ids: string[]; versatz: [number, number];
  /** Rahmen/Größe/Pfeil: die Kennung; Pfeil: der Anker. */
  id?: string; anker?: [number, number]; ziel?: string | null; neu?: { b: number; h: number }; shift?: boolean;
};
interface Bearbeiten { art: 'knoten' | 'rahmen' | 'pfeil'; id: string; text: string; box: Box; pfeil?: { knotenId: string; art: 'weiter' | 'ja' | 'nein' } }

const sauberId = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '');
const ruhig = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const merkerLesen = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const merkerSchreiben = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* privates Fenster */ } };
/** Relative Lage eines Schritts im Rahmen: nie über die Titelzeile, nie links hinaus. */
const relKlemmen = (x: number, y: number) => ({ x: Math.max(0, Math.round(x)), y: Math.max(FL.kopf - 14, Math.round(y)) });

/** Die Fläche (siehe Kopf). */
export function EditorFlaeche(p: FlaecheProps) {
  const { vorlage, bausteine, darf, laeuft, handy, senden, onWahl, meldung } = p;
  const bild = useMemo(() => flaecheBild(vorlage, bausteine as Baustein[]), [vorlage, bausteine]);
  const darfZiehen = darf && !handy && !laeuft;
  const roh = useId();
  const spitzeId = `fl-spitze-${sauberId(roh)}`, rasterId = `fl-raster-${sauberId(roh)}`, hinweisId = `fl-hinweis-${sauberId(roh)}`;

  const [auswahl, setAuswahl] = useState<Set<string>>(() => new Set(p.gewaehlt && bild.knoten.some(k => k.id === p.gewaehlt) ? [p.gewaehlt] : []));
  const [pfeilWahl, setPfeilWahl] = useState<string | null>(null);
  const [raster, setRaster] = useState(true);
  const [bearbeiten, setBearbeiten] = useState<Bearbeiten | null>(null);
  const [zweigFrage, setZweigFrage] = useState<{ von: string; nach: string; x: number; y: number } | null>(null);
  const [neuZeichnen, setNeuZeichnen] = useState(0);
  const [exportArt, setExportArt] = useState<'svg' | 'png' | null>(null);
  const [kurzHinweis, setKurzHinweis] = useState<string | null>(null);
  const [geraet, setGeraet] = useState({ mac: true, touch: false });

  const buehne = useRef<HTMLDivElement | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const welt = useRef<SVGGElement | null>(null);
  const muster = useRef<SVGPatternElement | null>(null);
  const zoomText = useRef<HTMLSpanElement | null>(null);
  const anfasser = useRef<SVGGElement | null>(null);
  const zugPfad = useRef<SVGPathElement | null>(null);
  const band = useRef<SVGRectElement | null>(null);
  const geist = useRef<HTMLDivElement | null>(null);
  const exportSvg = useRef<SVGSVGElement | null>(null);
  const fadenLeinwand = useRef<HTMLCanvasElement | null>(null);
  const faeden = useRef<FlowEbene | null>(null);
  const kamera = useRef<Kamera>({ s: 1, x: 40, y: 40 });
  const bildEntwurf = useRef(0);
  const zug = useRef<Zug | null>(null);
  const eingabe = useRef<FlaecheEingabe | null>(null);
  const anfasserFuer = useRef<string | null>(null);
  const verstecken = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tasten = useRef<{ ids: string[]; art: 'knoten' | 'rahmen'; dx: number; dy: number; uhr: ReturnType<typeof setTimeout> | null } | null>(null);
  const ablage = useRef<{ phaseId: string; knoten: { form: KnotenForm; titel: string; frist?: number; zustaendig?: string; kundeSichtbar?: boolean; bausteine: string[]; rel: { x: number; y: number } }[] } | null>(null);
  const nachNeu = useRef<{ art: 'knoten' | 'rahmen'; id: string } | null>(null);
  const zeigerFokus = useRef(false);
  /** Das gerade offene Eingabefeld — festgeschrieben wird es genau einmal (Enter und Verlassen kämen sonst beide an). */
  const offenesFeld = useRef<Bearbeiten | null>(null);
  const starteBearbeiten = (b: Bearbeiten | null) => { offenesFeld.current = b; setBearbeiten(b); };
  const stand = useRef({ bild, vorlage, darfZiehen, raster, auswahl });
  stand.current = { bild, vorlage, darfZiehen, raster, auswahl };

  // ── Kamera zeichnen (ein Bild je Frame, kein React-Zustand) ──
  const zeichne = useCallback(() => {
    if (bildEntwurf.current) return;
    bildEntwurf.current = requestAnimationFrame(() => {
      bildEntwurf.current = 0;
      const k = kamera.current;
      welt.current?.setAttribute('transform', transformVon(k));
      muster.current?.setAttribute('patternTransform', `translate(${k.x} ${k.y}) scale(${k.s})`);
      if (zoomText.current) zoomText.current.textContent = `${Math.round(k.s * 100)} %`;
      faeden.current?.kamera(k);
    });
  }, []);
  const setzeKamera = useCallback((k: Kamera) => { kamera.current = k; zeichne(); }, [zeichne]);
  const fliege = useCallback((ziel: Kamera) => {
    if (ruhig()) { setzeKamera(ziel); return; }
    const von = kamera.current, t0 = performance.now(), dauer = 260;
    const schritt = (t: number) => {
      const a = Math.min(1, (t - t0) / dauer);
      setzeKamera(zwischen(von, ziel, sanft(a)));
      if (a < 1) requestAnimationFrame(schritt);
    };
    requestAnimationFrame(schritt);
  }, [setzeKamera]);
  const groesse = () => { const r = buehne.current?.getBoundingClientRect(); return { b: r?.width || 800, h: r?.height || 600 }; };
  const allesAnzeigen = useCallback(() => { const g = groesse(); fliege(allesZeigen(stand.current.bild.box, g.b, g.h, 40, 1)); }, [fliege]);
  const zuruecksetzen = useCallback(() => { const b = stand.current.bild.box; fliege({ s: 1, x: 40 - b.x, y: 40 - b.y }); }, [fliege]);
  const zoomen = (f: number) => { const g = groesse(); fliege(zoomUm(kamera.current, f, g.b / 2, g.h / 2)); };

  // Beim Öffnen: alles zeigen (höchstens 100 %) — aber nie unlesbar klein (17.10., Gesamtprüfung L4 B1: ein großer Ablauf öffnete bei 15 %, Schrift 2–6 px).
  // Passt er nicht lesbar hinein, beginnt die Fläche oben links mit `START_MIN`; „Alles zeigen“ holt den ganzen Ablauf. Raster-Merker lesen. Gerät (⌘ oder Strg, Touch).
  useEffect(() => {
    const g = groesse();
    const b = stand.current.bild.box;
    const alles = allesZeigen(b, g.b, g.h, 40, 1);
    setzeKamera(alles.s >= START_MIN ? alles : { s: START_MIN, x: 40 - b.x * START_MIN, y: 40 - b.y * START_MIN });
    if (merkerLesen(MERKER_RASTER) === 'aus') setRaster(false);
    setGeraet({ mac: /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), touch: !!window.matchMedia?.('(pointer: coarse)').matches });
    return () => { if (bildEntwurf.current) cancelAnimationFrame(bildEntwurf.current); };
  }, [setzeKamera]);

  // Zoom und Schieben am SVG (nur dort — außerhalb rollt die Seite).
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const e = flaecheEingabe(el, {
      kamera: () => kamera.current, setze: setzeKamera,
      freiSchiebt: () => !stand.current.darfZiehen,
      istFrei: z => !(z as Element | null)?.closest?.('[data-fl-knoten],[data-fl-kopf],[data-fl-anfasser],[data-fl-groesse],[data-fl-pfeil]'),
      hinweis: () => { setKurzHinweis(geraet.mac ? '⌘ + Scrollen zoomt — zwei Finger am Trackpad verschieben' : 'Strg + Scrollen zoomt'); },
    });
    eingabe.current = e;
    return () => { e.abbauen(); eingabe.current = null; };
  }, [setzeKamera, geraet.mac]);
  useEffect(() => { if (!kurzHinweis) return; const t = setTimeout(() => setKurzHinweis(null), 1800); return () => clearTimeout(t); }, [kurzHinweis]);

  // Der Flow: EINE Faden-Ebene unter dem SVG (gemeinsamer Takt; reduzierte Bewegung = Standbild). Die Bühne trägt dann `data-flow="an"` — CSS blendet die
  // Pfad-Striche aus (Spitze, Beschriftung und der gewählte Pfeil bleiben).
  const fadenSetzen = useCallback(() => {
    const e = faeden.current, b = buehne.current;
    if (!e || !b) return;
    const r = b.getBoundingClientRect();
    e.setze(stand.current.bild.pfeile.map(pf => flaecheFaden(pf, FLOW_TON)), { breite: r.width, hoehe: r.height });
    e.kamera(kamera.current);
  }, []);
  useEffect(() => {
    const c = fadenLeinwand.current, b = buehne.current;
    if (!c || !b) return;
    const e = flowEbene(c, b, { ruhig: bewegungReduziert(), handy: !!handy });
    faeden.current = e;
    b.dataset.flow = 'an';
    fadenSetzen();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fadenSetzen()) : null;
    ro?.observe(b);
    return () => { ro?.disconnect(); e.stop(); faeden.current = null; delete b.dataset.flow; };
  }, [handy, fadenSetzen]);
  // Neue Vorlage bzw. „wieder der gespeicherte Stand“ (nach Abbruch/Fehler): die Fäden aus dem Bild.
  useEffect(() => { fadenSetzen(); }, [bild, neuZeichnen, fadenSetzen]);

  // Auswahl von außen (Seitenfeld, Fluss) übernehmen.
  useEffect(() => {
    if (p.gewaehlt && bild.knoten.some(k => k.id === p.gewaehlt) && !auswahl.has(p.gewaehlt)) setAuswahl(new Set([p.gewaehlt]));
  }, [p.gewaehlt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ein gerade angelegter Knoten bzw. Rahmen: gleich den Titel bearbeiten.
  useEffect(() => {
    const n = nachNeu.current;
    if (!n) return;
    if (n.art === 'knoten') { const k = bild.knoten.find(x => x.id === n.id); if (!k) return; nachNeu.current = null; starteBearbeiten({ art: 'knoten', id: k.id, text: k.titel, box: k }); }
    else { const r = bild.rahmen.find(x => x.id === n.id); if (!r) return; nachNeu.current = null; starteBearbeiten({ art: 'rahmen', id: r.id, text: r.titel, box: { x: r.x, y: r.y, b: r.b, h: FL.kopf - 14 } }); }
  }, [bild]);

  // ── Werkzeuge über dem Bild ──
  const boxen = useMemo(() => {
    const m = new Map<string, Box>();
    for (const k of bild.knoten) m.set(k.id, k);
    for (const s of bild.starts) m.set(s.id, s);
    for (const a of bild.abstimmungen) m.set(a.id, a);
    return m;
  }, [bild]);
  const weltPunkt = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = svg.current!.getBoundingClientRect();
    return weltAus(kamera.current, e.clientX - r.left, e.clientY - r.top);
  };
  const el = (key: string) => welt.current?.querySelector<SVGGElement>(`[data-fl-el="${key}"]`) ?? null;
  const mitFest = (ops: EditorOp[]): EditorOp[] => (allesFest(stand.current.bild) ? ops : [{ op: 'lage', eintraege: lagenAlle(stand.current.bild, stand.current.vorlage) }, ...ops]);
  const schreiben = async (ops: EditorOp[]) => {
    if (ops.length > GRENZEN.opsJeAnfrage) { meldung(`Zu viel auf einmal — höchstens ${GRENZEN.opsJeAnfrage} Änderungen je Schritt. Bitte in kleineren Teilen.`, 'achtung'); setNeuZeichnen(n => n + 1); return false; }
    const ok = await senden(ops);
    if (!ok) setNeuZeichnen(n => n + 1); // die Zeichnung zeigt wieder den gespeicherten Stand
    return ok;
  };
  /** Wohin ein Schritt in der Reihenfolge kommt, der in einen Rahmen gelegt wird: hinter den Schritt, der darüber am tiefsten steht. */
  const zielInRahmen = (rahmenId: string, wy: number, ohne?: string): EditorZiel => {
    const haupt = stand.current.bild.knoten.filter(k => k.phaseId === rahmenId && !k.neinVon && k.id !== ohne);
    let best: FlKnoten | null = null;
    for (const k of haupt) if (k.y + k.h / 2 < wy && (!best || k.y + k.h / 2 > best.y + best.h / 2)) best = k;
    return best ? { phaseId: rahmenId, nach: best.id } : haupt.length ? { phaseId: rahmenId, anfang: true } : { phaseId: rahmenId };
  };
  const waehle = (ids: Set<string>) => {
    setAuswahl(ids);
    setPfeilWahl(null);
    if (ids.size === 1) {
      const id = [...ids][0];
      const k = stand.current.bild.knoten.find(x => x.id === id);
      if (k) onWahl(k.phaseId, k.id);
      else if (stand.current.bild.rahmen.some(r => r.id === id)) onWahl(id, null);
    }
  };

  // ── Pfeile beim Ziehen neu legen (nur die betroffenen) ──
  const wegeNeu = (versatz: Map<string, [number, number]>) => {
    const b = stand.current.bild;
    const box = (id: string): Box | undefined => { const x = boxen.get(id); if (!x) return undefined; const v = versatz.get(id); return v ? { x: x.x + v[0], y: x.y + v[1], b: x.b, h: x.h } : x; };
    const hind = [...boxen.keys()].map(id => box(id)!);
    for (const pf of b.pfeile) {
      if (!versatz.has(pf.von) && !versatz.has(pf.nach)) continue;
      const a = box(pf.von), z = box(pf.nach);
      const g = welt.current?.querySelector(`[data-fl-pfeil-g="${pf.id}"]`);
      if (!a || !z || !g) continue;
      const punkte = pfeilWeg(a, z, hind, pf.art);
      const d = pfadVon(punkte);
      for (const pfad of Array.from(g.querySelectorAll('path'))) pfad.setAttribute('d', d);
      faeden.current?.weg(pf.id, punkte);
      const t = g.querySelector('[data-teil="text"]');
      if (t) { const o = pfeilTextOrt(punkte); t.setAttribute('transform', `translate(${o[0]} ${o[1]})`); }
    }
  };
  /** Teile um (dx, dy) zeigen (ohne zu speichern). */
  const zeigeVersatz = (keys: string[], dx: number, dy: number) => {
    const b = stand.current.bild;
    const basis = new Map<string, [number, number]>([
      ...b.knoten.map(k => [k.id, [k.x, k.y]] as [string, [number, number]]),
      ...b.starts.map(s => [s.id, [s.x, s.y]] as [string, [number, number]]),
      ...b.abstimmungen.map(s => [s.id, [s.x, s.y]] as [string, [number, number]]),
      ...b.rahmen.map(r => [`rahmen:${r.id}`, [r.x, r.y]] as [string, [number, number]]),
      ...b.gruppen.map(g => [`gruppe:${g.id}`, [g.box.x, g.box.y]] as [string, [number, number]]),
    ]);
    const versatz = new Map<string, [number, number]>();
    for (const key of keys) {
      const o = basis.get(key);
      const e = el(key);
      if (!o || !e) continue;
      e.setAttribute('transform', `translate(${o[0] + dx} ${o[1] + dy})`);
      versatz.set(key, [dx, dy]);
    }
    wegeNeu(versatz);
  };
  const teileVonRahmen = (id: string) => {
    const b = stand.current.bild;
    return [`rahmen:${id}`, `start:${id}`, `ab:${id}`, ...b.knoten.filter(k => k.phaseId === id).map(k => k.id), ...b.gruppen.filter(g => g.phaseId === id).map(g => `gruppe:${g.id}`)];
  };

  // ── Anfasser (EIN Satz, er folgt dem Knoten unter dem Zeiger bzw. dem gewählten) ──
  const zeigeAnfasser = useCallback((id: string | null) => {
    const g = anfasser.current;
    if (!g) return;
    const k = id ? stand.current.bild.knoten.find(x => x.id === id) : null;
    if (!k || !stand.current.darfZiehen) { g.style.display = 'none'; anfasserFuer.current = null; return; }
    anfasserFuer.current = k.id;
    g.setAttribute('transform', `translate(${k.x} ${k.y})`);
    const orte: Record<string, [number, number]> = { oben: [k.b / 2, 0], rechts: [k.b, k.h / 2], unten: [k.b / 2, k.h], links: [0, k.h / 2] };
    for (const c of Array.from(g.querySelectorAll<SVGCircleElement>('[data-fl-anfasser]'))) {
      const o = orte[c.getAttribute('data-fl-anfasser') ?? ''];
      if (o) { c.setAttribute('cx', String(o[0])); c.setAttribute('cy', String(o[1])); }
    }
    g.style.display = '';
  }, []);
  const einzeln = auswahl.size === 1 ? [...auswahl][0] : null;
  useEffect(() => { zeigeAnfasser(einzeln && bild.knoten.some(k => k.id === einzeln) ? einzeln : null); }, [einzeln, bild, darfZiehen, zeigeAnfasser]);
  const knotenRein = (id: string) => { if (verstecken.current) clearTimeout(verstecken.current); if (!zug.current) zeigeAnfasser(id); };
  const knotenRaus = () => {
    if (verstecken.current) clearTimeout(verstecken.current);
    verstecken.current = setTimeout(() => { if (!zug.current) zeigeAnfasser(einzeln); }, 160);
  };

  // ── Zeiger auf der Fläche ──
  const runter = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || eingabe.current?.schiebt()) return;
    // Der Fokus, den dieser Klick setzt, ist kein Tab (danach gilt Tab wieder).
    zeigerFokus.current = true;
    setTimeout(() => { zeigerFokus.current = false; }, 0);
    svg.current?.focus({ preventScroll: true });
    setZweigFrage(null);
    const z = e.target as Element;
    const w = weltPunkt(e);
    const basis = { zeiger: e.pointerId, start: [e.clientX, e.clientY] as [number, number], welt0: w, aktiv: false, ids: [] as string[], versatz: [0, 0] as [number, number] };
    // Der Abstimmungspunkt am Ende einer Phase: antippen = seine Angaben im Seitenfeld.
    const ab = z.closest('[data-fl-ab]')?.getAttribute('data-fl-ab');
    if (ab) { setAuswahl(new Set()); onWahl(ab, `fg-${ab}`); return; }
    const knotenEl = z.closest('[data-fl-knoten]');
    const id = knotenEl?.getAttribute('data-fl-knoten') ?? null;
    if (!stand.current.darfZiehen) {
      // Nur ansehen: ein Tipp wählt (Schieben macht ./ui/flaeche/eingabe.ts).
      if (id) waehle(new Set([id]));
      return;
    }
    const seite = z.closest('[data-fl-anfasser]');
    if (seite && anfasserFuer.current) {
      const k = stand.current.bild.knoten.find(x => x.id === anfasserFuer.current)!;
      const s = seite.getAttribute('data-fl-anfasser');
      const anker: [number, number] = s === 'oben' ? [k.x + k.b / 2, k.y] : s === 'rechts' ? [k.x + k.b, k.y + k.h / 2] : s === 'links' ? [k.x, k.y + k.h / 2] : [k.x + k.b / 2, k.y + k.h];
      zug.current = { ...basis, art: 'pfeil', id: k.id, anker, ziel: null };
    } else if (z.closest('[data-fl-groesse]')) {
      const rid = z.closest('[data-fl-groesse]')!.getAttribute('data-fl-groesse')!;
      zug.current = { ...basis, art: 'groesse', id: rid };
    } else if (id) {
      if (e.shiftKey) { const n = new Set(auswahl); if (n.has(id)) n.delete(id); else n.add(id); waehle(n); return; }
      const ids = auswahl.has(id) ? [...auswahl].filter(x => stand.current.bild.knoten.some(k => k.id === x)) : [id];
      if (!auswahl.has(id)) waehle(new Set([id]));
      zug.current = { ...basis, art: 'knoten', id, ids };
    } else if (z.closest('[data-fl-kopf]')) {
      const rid = z.closest('[data-fl-kopf]')!.getAttribute('data-fl-kopf')!;
      waehle(new Set([rid]));
      zug.current = { ...basis, art: 'rahmen', id: rid, ids: teileVonRahmen(rid) };
    } else if (z.closest('[data-fl-pfeil]')) {
      setPfeilWahl(z.closest('[data-fl-pfeil]')!.getAttribute('data-fl-pfeil'));
      setAuswahl(new Set());
      return;
    } else {
      zug.current = { ...basis, art: 'band', shift: e.shiftKey };
    }
    try { svg.current?.setPointerCapture(e.pointerId); } catch { /* Zeiger schon weg */ }
  };

  const bewegt = (e: RPointerEvent<SVGSVGElement>) => {
    const zg = zug.current;
    if (!zg || zg.zeiger !== e.pointerId) return;
    if (eingabe.current?.schiebt()) { abbrechen(); return; }
    if (!zg.aktiv) {
      if (!istZiehen(e.clientX - zg.start[0], e.clientY - zg.start[1], ZIEH_PX)) return;
      zg.aktiv = true;
      if (anfasser.current && zg.art !== 'pfeil') anfasser.current.style.display = 'none';
    }
    const w = weltPunkt(e);
    const dx = w[0] - zg.welt0[0], dy = w[1] - zg.welt0[1];
    const b = stand.current.bild;
    const r = stand.current.raster;
    if (zg.art === 'knoten') {
      const k = b.knoten.find(x => x.id === zg.id)!;
      const sx = einrasten(k.x + dx, FL.raster, r) - k.x, sy = einrasten(k.y + dy, FL.raster, r) - k.y;
      zg.versatz = [sx, sy];
      zeigeVersatz(zg.ids, sx, sy);
      const ziel = rahmenBei(b, k.x + sx + k.b / 2, k.y + sy + k.h / 2);
      zielRahmen(ziel?.id ?? null);
    } else if (zg.art === 'rahmen') {
      const rr = b.rahmen.find(x => x.id === zg.id)!;
      const sx = einrasten(rr.x + dx, FL.raster, r) - rr.x, sy = einrasten(rr.y + dy, FL.raster, r) - rr.y;
      zg.versatz = [sx, sy];
      zeigeVersatz(zg.ids, sx, sy);
    } else if (zg.art === 'groesse') {
      const rr = b.rahmen.find(x => x.id === zg.id)!;
      const nb = Math.max(rr.inhalt.b, LAGE.rahmenMin, einrasten(rr.b + dx, FL.raster, r)), nh = Math.max(rr.inhalt.h, LAGE.rahmenMin, einrasten(rr.h + dy, FL.raster, r));
      zg.neu = { b: nb, h: nh };
      const g = el(`rahmen:${rr.id}`);
      for (const f of Array.from(g?.querySelectorAll('[data-teil="rahmen"], [data-fl-flaeche]') ?? [])) { f.setAttribute('width', String(nb)); f.setAttribute('height', String(nh)); }
      g?.querySelector('[data-teil="linie"]')?.setAttribute('x2', String(nb));
      g?.querySelector('[data-fl-kopf]')?.setAttribute('width', String(nb));
      g?.querySelector('[data-fl-groesse]')?.setAttribute('transform', `translate(${nb - 22} ${nh - 22})`);
    } else if (zg.art === 'pfeil') {
      const ziel = knotenBei(b, w[0], w[1], zg.id);
      zg.ziel = ziel?.id ?? null;
      const ende: [number, number] = ziel ? [ziel.x + ziel.b / 2, ziel.y + ziel.h / 2] : w;
      zugPfad.current?.setAttribute('d', `M${zg.anker![0]} ${zg.anker![1]} L${ende[0]} ${ende[1]}`);
      zugPfad.current?.setAttribute('stroke', ziel ? FLAECHE_ZIEL : C.inkDim);
      // Der Faden zieht mit — erst leise, über einem Ziel hell.
      faeden.current?.zug({ id: 'fl-zug', punkte: [zg.anker!, ende], farbe: FLOW_TON.basis, staerke: 'fein', ...(ziel ? { gluehen: true } : { bisHier: 0 }) });
      zielKnoten(ziel?.id ?? null);
    } else if (zg.art === 'band') {
      const x = Math.min(zg.welt0[0], w[0]), y = Math.min(zg.welt0[1], w[1]);
      const rect = band.current;
      if (rect) { rect.setAttribute('x', String(x)); rect.setAttribute('y', String(y)); rect.setAttribute('width', String(Math.abs(dx))); rect.setAttribute('height', String(Math.abs(dy))); rect.style.display = ''; }
    }
  };

  /** Markierung „hier landet es“ an einem Rahmen bzw. Knoten (direkt am SVG). */
  const zielRahmen = (id: string | null) => {
    for (const r of Array.from(welt.current?.querySelectorAll('[data-fl-flaeche]') ?? [])) r.removeAttribute('data-fl-ziel');
    if (id) el(`rahmen:${id}`)?.querySelector('[data-fl-flaeche]')?.setAttribute('data-fl-ziel', '');
  };
  const zielKnoten = (id: string | null) => {
    for (const k of Array.from(welt.current?.querySelectorAll('[data-fl-knoten][data-fl-ziel]') ?? [])) k.removeAttribute('data-fl-ziel');
    if (id) el(id)?.setAttribute('data-fl-ziel', '');
  };
  const aufraeumen = () => {
    zielRahmen(null); zielKnoten(null);
    zugPfad.current?.setAttribute('d', '');
    faeden.current?.zug(null);
    if (band.current) band.current.style.display = 'none';
  };
  const abbrechen = () => {
    const zg = zug.current;
    zug.current = null;
    aufraeumen();
    if (zg?.aktiv) setNeuZeichnen(n => n + 1);
  };

  const hoch = (e: RPointerEvent<SVGSVGElement>) => {
    const zg = zug.current;
    if (!zg || zg.zeiger !== e.pointerId) return;
    zug.current = null;
    try { svg.current?.releasePointerCapture(e.pointerId); } catch { /* frei */ }
    aufraeumen();
    if (!zg.aktiv) {
      // Ein Klick ohne Bewegung: freie Fläche → Auswahl weg (bzw. die Phase darunter fürs Seitenfeld).
      if (zg.art === 'band' && !zg.shift) {
        // In einem Rahmen gewählt = die Phase (Seitenfeld, Pfeiltasten verschieben den Rahmen); daneben = nichts.
        const r = rahmenBei(stand.current.bild, zg.welt0[0], zg.welt0[1]);
        setAuswahl(new Set(r ? [r.id] : [])); setPfeilWahl(null);
        if (r) onWahl(r.id, null);
      }
      zeigeAnfasser(einzeln);
      return;
    }
    if (zg.art === 'knoten') void knotenAblegen(zg.ids, zg.versatz[0], zg.versatz[1]);
    else if (zg.art === 'rahmen') void rahmenAblegen(zg.id!, zg.versatz[0], zg.versatz[1]);
    else if (zg.art === 'groesse' && zg.neu) void groesseAblegen(zg.id!, zg.neu.b, zg.neu.h);
    else if (zg.art === 'pfeil') {
      if (!zg.ziel) { meldung('Pfeile verbinden zwei Schritte — lass ihn auf einem Kasten los.', 'achtung'); return; }
      const von = stand.current.bild.knoten.find(k => k.id === zg.id)!;
      if (von.entscheid) { const r = buehne.current!.getBoundingClientRect(); setZweigFrage({ von: von.id, nach: zg.ziel, x: e.clientX - r.left, y: e.clientY - r.top }); return; }
      void verbinden(von.id, zg.ziel);
    } else if (zg.art === 'band') {
      const w = weltPunkt(e);
      const x0 = Math.min(zg.welt0[0], w[0]), x1 = Math.max(zg.welt0[0], w[0]), y0 = Math.min(zg.welt0[1], w[1]), y1 = Math.max(zg.welt0[1], w[1]);
      const drin = stand.current.bild.knoten.filter(k => k.x < x1 && k.x + k.b > x0 && k.y < y1 && k.y + k.h > y0).map(k => k.id);
      waehle(new Set([...(zg.shift ? [...auswahl] : []), ...drin]));
    }
  };

  // ── Ablegen = schreiben (über den Schreibweg des Editors) ──
  const knotenAblegen = async (ids: string[], dx: number, dy: number) => {
    if (!dx && !dy) return;
    const b = stand.current.bild;
    const eintraege: { id: string; pos: { x: number; y: number } }[] = [];
    const schieben: EditorOp[] = [];
    for (const id of ids) {
      const k = b.knoten.find(x => x.id === id);
      if (!k) continue;
      const nx = k.x + dx, ny = k.y + dy;
      const r = rahmenBei(b, nx + k.b / 2, ny + k.h / 2);
      if (!r) { meldung('Schritte stehen in einer Phase — leg ihn in einen Rahmen.', 'achtung'); setNeuZeichnen(n => n + 1); return; }
      if (r.id !== k.phaseId) {
        if (k.neinVon) { meldung('Ein Nein-Zweig bleibt bei seiner Entscheidung — erst den Zweig lösen.', 'achtung'); setNeuZeichnen(n => n + 1); return; }
        schieben.push({ op: 'schritt-schieben', id, ziel: zielInRahmen(r.id, ny + k.h / 2, id) });
      }
      eintraege.push({ id, pos: relKlemmen(nx - r.x, ny - r.y) });
    }
    await schreiben(mitFest([...schieben, { op: 'lage', eintraege }]));
  };
  const gespeicherteGroesse = (id: string) => { const pos = stand.current.vorlage.knoten.find(x => x.id === id)?.pos; return { ...(pos?.b ? { b: pos.b } : {}), ...(pos?.h ? { h: pos.h } : {}) }; };
  const rahmenAblegen = async (id: string, dx: number, dy: number) => {
    if (!dx && !dy) return;
    const b = stand.current.bild;
    const r = b.rahmen.find(x => x.id === id)!;
    const nx = Math.round(r.x + dx), ny = Math.round(r.y + dy);
    const ops: EditorOp[] = [{ op: 'lage', eintraege: [{ id, pos: { x: nx, y: ny, ...gespeicherteGroesse(id) } }] }];
    // Die Reihenfolge der Phasen = die Reihe der Rahmen von links nach rechts: an einem anderen vorbeigezogen → umstellen.
    const reihe = b.rahmen.map(x => ({ id: x.id, x: x.id === id ? nx : x.x })).sort((a, c) => a.x - c.x).map(x => x.id);
    if (reihe.join() !== b.rahmen.map(x => x.id).join()) { const i = reihe.indexOf(id); ops.push({ op: 'phase-schieben', id, nach: i > 0 ? reihe[i - 1] : null }); }
    await schreiben(mitFest(ops));
  };
  const groesseAblegen = async (id: string, nb: number, nh: number) => {
    const r = stand.current.bild.rahmen.find(x => x.id === id)!;
    await schreiben(mitFest([{ op: 'lage', eintraege: [{ id, pos: { x: Math.round(r.x), y: Math.round(r.y), b: nb, h: nh } }] }]));
  };
  const verbinden = async (von: string, nach: string, zweig?: 'ja' | 'nein') => {
    setZweigFrage(null);
    await schreiben([{ op: 'verbinden', von, nach, ...(zweig ? { zweig } : {}) }]);
  };
  const neuerKnoten = async (form: KnotenForm, rahmenId: string, w: [number, number] | null, baustein?: Baustein) => {
    const id = neueKennung('fk');
    const r = stand.current.bild.rahmen.find(x => x.id === rahmenId)!;
    const m = umrissMass(umrissVon(form));
    const lage: EditorOp[] = w ? [{ op: 'lage', eintraege: [{ id, pos: relKlemmen(einrasten(w[0] - m.b / 2, FL.raster, stand.current.raster) - r.x, einrasten(w[1] - m.h / 2, FL.raster, stand.current.raster) - r.y) }] }] : [];
    const ops = mitFest([
      { op: 'schritt-neu', id, ziel: w ? zielInRahmen(rahmenId, w[1]) : { phaseId: rahmenId }, form, titel: baustein ? baustein.titel.slice(0, 120) : FORM_VORGABE[form] },
      ...(baustein ? [{ op: 'baustein-dazu', id: neueKennung('fk'), schrittId: id, bausteinId: baustein.id }] : []),
      ...lage,
    ]);
    if (await schreiben(ops)) { setAuswahl(new Set([id])); onWahl(rahmenId, id); if (!baustein) nachNeu.current = { art: 'knoten', id }; }
  };
  const neuePhase = async (w: [number, number] | null) => {
    const id = neueKennung('fk');
    const b = stand.current.bild;
    const links = w ? b.rahmen.filter(r => r.x <= w[0]).sort((a, c) => a.x - c.x).at(-1) : b.rahmen.at(-1);
    const ops: EditorOp[] = [{ op: 'phase-neu', id, titel: 'Neue Phase', ...(w ? { nach: links ? links.id : null } : {}) }];
    if (w) ops.push({ op: 'lage', eintraege: [{ id, pos: { x: einrasten(w[0] - 40, FL.raster, stand.current.raster), y: einrasten(w[1] - 40, FL.raster, stand.current.raster) } }] });
    if (await schreiben(b.rahmen.length ? mitFest(ops) : ops)) { setAuswahl(new Set([id])); onWahl(id, null); nachNeu.current = { art: 'rahmen', id }; }
  };
  /** Aus der Palette ablegen: w = Punkt der Fläche (null = angetippt → ans Ende der gewählten Phase). */
  const paletteAblegen = (f: FlaechePaletteEintrag, w: [number, number] | null) => {
    const b = stand.current.bild;
    if (f === 'phase') { void neuePhase(w); return; }
    const kn = w ? knotenBei(b, w[0], w[1]) : null;
    const gewaehlterRahmen = [...stand.current.auswahl].map(id => b.knoten.find(k => k.id === id)?.phaseId ?? (b.rahmen.some(r => r.id === id) ? id : null)).find(Boolean) ?? null;
    const r = w ? rahmenBei(b, w[0], w[1]) : (gewaehlterRahmen ? b.rahmen.find(x => x.id === gewaehlterRahmen) : b.rahmen[0]) ?? null;
    if (f === 'baustein') {
      if (kn) { p.bausteinWaehlen(bs => { void schreiben([{ op: 'baustein-dazu', id: neueKennung('fk'), schrittId: kn.id, bausteinId: bs.id }]); }); return; }
      if (!r) { meldung('Leg den Baustein in einen Rahmen bzw. auf einen Schritt.', 'achtung'); return; }
      p.bausteinWaehlen(bs => { void neuerKnoten(formFuerBaustein(bs.art), r.id, w, bs); });
      return;
    }
    if (!r) { meldung('Leg ihn in einen Rahmen — jede Phase ist ein Rahmen. Einen neuen Rahmen bringt „Start · Phase“.', 'achtung'); return; }
    void neuerKnoten(f, r.id, w);
  };

  // ── Palette: ziehen (Geist folgt dem Zeiger) oder antippen ──
  const palettenZug = useRef<{ f: FlaechePaletteEintrag; zeiger: number; start: [number, number]; aktiv: boolean } | null>(null);
  /** Nach dem Ziehen kommt noch ein Klick — der legt nichts ein zweites Mal ab. */
  const paletteGezogen = useRef(false);
  const paletteRunter = (f: FlaechePaletteEintrag) => (e: RPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !darfZiehen) return;
    palettenZug.current = { f, zeiger: e.pointerId, start: [e.clientX, e.clientY], aktiv: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* frei */ }
  };
  const paletteBewegt = (e: RPointerEvent<HTMLButtonElement>) => {
    const z = palettenZug.current;
    if (!z || z.zeiger !== e.pointerId) return;
    if (!z.aktiv && !istZiehen(e.clientX - z.start[0], e.clientY - z.start[1], ZIEH_PX)) return;
    z.aktiv = true;
    const g = geist.current;
    if (g) { g.style.display = 'flex'; g.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 12}px)`; g.textContent = paletteTitel(z.f); }
    const r = svg.current?.getBoundingClientRect();
    const drin = !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (drin) { const w = weltPunkt(e); zielRahmen(z.f === 'phase' ? null : rahmenBei(stand.current.bild, w[0], w[1])?.id ?? null); } else zielRahmen(null);
  };
  const paletteHoch = (e: RPointerEvent<HTMLButtonElement>) => {
    const z = palettenZug.current;
    if (!z || z.zeiger !== e.pointerId) return;
    palettenZug.current = null;
    if (geist.current) geist.current.style.display = 'none';
    zielRahmen(null);
    if (!z.aktiv) return; // ein Klick — den macht onClick
    paletteGezogen.current = true;
    setTimeout(() => { paletteGezogen.current = false; }, 400);
    const r = svg.current?.getBoundingClientRect();
    if (!r || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    paletteAblegen(z.f, weltPunkt(e));
  };

  // ── Tastatur ──
  const tastenSchieben = (dx: number, dy: number) => {
    const b = stand.current.bild;
    const ids = [...stand.current.auswahl];
    const rahmen = ids.length === 1 && b.rahmen.some(r => r.id === ids[0]) ? ids[0] : null;
    const knoten = ids.filter(id => b.knoten.some(k => k.id === id));
    if (!rahmen && !knoten.length) return;
    const t = tasten.current ?? { ids: rahmen ? [rahmen] : knoten, art: rahmen ? 'rahmen' as const : 'knoten' as const, dx: 0, dy: 0, uhr: null };
    t.dx += dx; t.dy += dy;
    if (t.uhr) clearTimeout(t.uhr);
    tasten.current = t;
    zeigeVersatz(t.art === 'rahmen' ? teileVonRahmen(t.ids[0]) : t.ids, t.dx, t.dy);
    t.uhr = setTimeout(() => {
      tasten.current = null;
      if (t.art === 'rahmen') void rahmenAblegen(t.ids[0], t.dx, t.dy); else void knotenAblegen(t.ids, t.dx, t.dy);
    }, 450);
  };
  const loeschen = async () => {
    const b = stand.current.bild;
    if (pfeilWahl) {
      const pf = b.pfeile.find(x => x.id === pfeilWahl);
      if (!pf) return;
      if (!pf.zweig) { meldung('Dieser Pfeil ist die Reihenfolge — zieh einen neuen Pfeil zum Umhängen oder verschiebe den Schritt in einen anderen Rahmen.', 'achtung'); return; }
      if (await schreiben([{ op: 'zweig', id: pf.zweig.knotenId, [pf.zweig.art]: null }])) setPfeilWahl(null);
      return;
    }
    const ids = [...stand.current.auswahl];
    const rahmen = ids.find(id => b.rahmen.some(r => r.id === id));
    if (rahmen) { p.loeschenPhase(rahmen); return; }
    const knoten = ids.filter(id => b.knoten.some(k => k.id === id));
    if (!knoten.length) return;
    if (await schreiben(knoten.map(id => ({ op: 'weg', id })))) { setAuswahl(new Set()); meldung(knoten.length === 1 ? 'In den Papierkorb gelegt — „Rückgängig“ holt es zurück.' : `${knoten.length} Schritte in den Papierkorb gelegt — „Rückgängig“ holt sie zurück.`, 'gut'); }
  };
  const kopieren = () => {
    const v = stand.current.vorlage, b = stand.current.bild;
    const ids = [...stand.current.auswahl].filter(id => b.knoten.some(k => k.id === id));
    if (!ids.length) return;
    const erste = b.knoten.find(k => k.id === ids[0])!;
    ablage.current = {
      phaseId: erste.phaseId,
      knoten: ids.map(id => {
        const k = b.knoten.find(x => x.id === id)!, q = v.knoten.find(x => x.id === id)!;
        return { form: k.knotenForm === 'abstimmung' ? 'entscheidung' : k.knotenForm, titel: q.titel, ...(q.frist !== undefined ? { frist: q.frist } : {}), ...(q.zustaendig ? { zustaendig: q.zustaendig } : {}), ...(q.kundeSichtbar !== undefined ? { kundeSichtbar: q.kundeSichtbar } : {}), bausteine: v.knoten.filter(c => c.elternId === id && c.bausteinId).map(c => c.bausteinId!), rel: k.rel };
      }),
    };
    meldung(`${ids.length === 1 ? 'Ein Schritt' : `${ids.length} Schritte`} kopiert — ⌘V fügt ein.`, 'gut');
  };
  const einfuegen = async () => {
    const a = ablage.current, b = stand.current.bild;
    if (!a) return;
    const gew = [...stand.current.auswahl].find(id => b.rahmen.some(r => r.id === id));
    const ziel = gew ?? (b.rahmen.some(r => r.id === a.phaseId) ? a.phaseId : b.rahmen[0]?.id);
    if (!ziel) return;
    const neu: string[] = [];
    const ops: EditorOp[] = [];
    const eintraege: { id: string; pos: { x: number; y: number } }[] = [];
    for (const k of a.knoten) {
      const id = neueKennung('fk');
      neu.push(id);
      ops.push({ op: 'schritt-neu', id, ziel: { phaseId: ziel }, form: k.form, titel: k.titel, ...(k.frist !== undefined ? { frist: k.frist } : {}), ...(k.zustaendig ? { zustaendig: k.zustaendig } : {}), ...(k.kundeSichtbar !== undefined ? { kundeSichtbar: k.kundeSichtbar } : {}) });
      for (const bs of k.bausteine) ops.push({ op: 'baustein-dazu', id: neueKennung('fk'), schrittId: id, bausteinId: bs });
      eintraege.push({ id, pos: relKlemmen(k.rel.x + 40, k.rel.y + 40) });
    }
    if (await schreiben(mitFest([...ops, { op: 'lage', eintraege }]))) waehle(new Set(neu));
  };
  const titelBearbeiten = () => {
    const b = stand.current.bild;
    if (pfeilWahl) { const pf = b.pfeile.find(x => x.id === pfeilWahl); if (pf) pfeilTextBearbeiten(pf); return; }
    if (!einzeln) return;
    const k = b.knoten.find(x => x.id === einzeln);
    if (k) { starteBearbeiten({ art: 'knoten', id: k.id, text: k.titel, box: k }); return; }
    const r = b.rahmen.find(x => x.id === einzeln);
    if (r) starteBearbeiten({ art: 'rahmen', id: r.id, text: r.titel, box: { x: r.x, y: r.y, b: r.b, h: FL.kopf - 14 } });
  };
  const pfeilTextBearbeiten = (pf: FlPfeil) => {
    if (!pf.textAn) { meldung('Dieser Pfeil hat keine eigene Beschriftung.', 'achtung'); return; }
    const o = pfeilTextOrt(pf.punkte);
    starteBearbeiten({ art: 'pfeil', id: pf.id, text: pf.text ?? '', box: { x: o[0] - 90, y: o[1] - 22, b: 180, h: 44 }, pfeil: pf.textAn });
  };
  const taste = (e: RKeyboardEvent<SVGSVGElement>) => {
    if (bearbeiten) return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Escape') { if (zug.current) abbrechen(); else { setAuswahl(new Set()); setPfeilWahl(null); setZweigFrage(null); } return; }
    if (!mod && !e.altKey && (e.key === '+' || e.key === '=')) { e.preventDefault(); zoomen(ZOOM_SCHRITT); return; }
    if (!mod && !e.altKey && (e.key === '-' || e.key === '_')) { e.preventDefault(); zoomen(1 / ZOOM_SCHRITT); return; }
    if (!mod && e.key === '0') { e.preventDefault(); zuruecksetzen(); return; }
    if (!mod && e.key === '1') { e.preventDefault(); allesAnzeigen(); return; }
    if (!stand.current.darfZiehen) return;
    const schritt = e.shiftKey ? FL.raster * 5 : FL.raster;
    const r: Record<string, [number, number]> = { ArrowLeft: [-schritt, 0], ArrowRight: [schritt, 0], ArrowUp: [0, -schritt], ArrowDown: [0, schritt] };
    if (r[e.key] && !mod && !e.altKey && auswahl.size) { e.preventDefault(); tastenSchieben(...r[e.key]); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); void loeschen(); return; }
    if (e.key === 'Enter') { e.preventDefault(); titelBearbeiten(); return; }
    if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); kopieren(); return; }
    if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); void einfuegen(); return; }
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); waehle(new Set(stand.current.bild.knoten.map(k => k.id))); }
  };
  const doppelt = (e: RMouseEvent<SVGSVGElement>) => {
    if (!stand.current.darfZiehen) return;
    const z = e.target as Element;
    const b = stand.current.bild;
    const kid = z.closest('[data-fl-knoten]')?.getAttribute('data-fl-knoten');
    if (kid) { const k = b.knoten.find(x => x.id === kid); if (k) starteBearbeiten({ art: 'knoten', id: k.id, text: k.titel, box: k }); return; }
    const rid = z.closest('[data-fl-kopf]')?.getAttribute('data-fl-kopf');
    if (rid) { const r = b.rahmen.find(x => x.id === rid); if (r) starteBearbeiten({ art: 'rahmen', id: r.id, text: r.titel, box: { x: r.x, y: r.y, b: r.b, h: FL.kopf - 14 } }); return; }
    const pid = z.closest('[data-fl-pfeil]')?.getAttribute('data-fl-pfeil');
    if (pid) { const pf = b.pfeile.find(x => x.id === pid); if (pf) pfeilTextBearbeiten(pf); }
  };
  const bearbeitenFertig = async (text: string | null) => {
    const b = offenesFeld.current;
    starteBearbeiten(null);
    svg.current?.focus({ preventScroll: true });
    if (!b || text === null) return;
    const t = text.trim();
    if (b.art === 'pfeil') { if (t !== b.text) await schreiben([{ op: 'pfeil-text', id: b.pfeil!.knotenId, art: b.pfeil!.art, text: t || null }]); return; }
    if (!t || t === b.text) return;
    await schreiben([b.art === 'knoten' ? { op: 'schritt', id: b.id, titel: t } : { op: 'phase', id: b.id, titel: t }]);
  };
  /** Tab wandert durch die Knoten: der fokussierte wird gewählt und rückt ins Bild. */
  const knotenFokus = (k: FlKnoten) => {
    if (zeigerFokus.current) { zeigerFokus.current = false; return; }
    waehle(new Set([k.id]));
    const g = groesse();
    const [sx, sy] = bildAus(kamera.current, k.x, k.y);
    const s = kamera.current.s;
    if (sx < 0 || sy < 0 || sx + k.b * s > g.b || sy + k.h * s > g.h) fliege({ s, x: g.b / 2 - (k.x + k.b / 2) * s, y: g.h / 2 - (k.y + k.h / 2) * s });
  };

  // ── Als Bild speichern ──
  useEffect(() => {
    if (!exportArt) return;
    const el2 = exportSvg.current;
    if (!el2) return;
    const text = svgText(el2);
    const rahmen = exportRahmen(bild.box);
    const name = dateiName(vorlage.titel, exportArt);
    (async () => {
      try {
        herunterladen(exportArt === 'svg' ? new Blob([text], { type: 'image/svg+xml;charset=utf-8' }) : await svgZuPng(text, rahmen.b, rahmen.h), name);
        meldung(`Gespeichert: ${name}`, 'gut');
      } catch (f) {
        meldung(f instanceof Error ? f.message : 'Das Bild ließ sich nicht speichern.', 'kritisch');
      } finally { setExportArt(null); }
    })();
  }, [exportArt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Verbinden mit … (Tastatur) ──
  const einzelKnoten = einzeln ? bild.knoten.find(k => k.id === einzeln) ?? null : null;
  const verbindenMenue = darfZiehen && einzelKnoten ? (
    <select aria-label={`„${einzelKnoten.titel}“ verbinden mit …`} value="" disabled={laeuft} className="ff-flaeche-verbinden"
      onChange={e => { const v = e.target.value; if (!v) return; const [art, id] = v.split('|'); void verbinden(einzelKnoten.id, id, art === 'ja' || art === 'nein' ? art : undefined); }}
      style={{ minHeight: ZIEL_PX, fontSize: 16, maxWidth: 260, padding: '6px 10px', borderRadius: ECKE.eingabe, color: C.ink, ...FLAECHE_STIL.eingabe }}>
      <option value="">Verbinden mit …</option>
      {bild.rahmen.map(r => (
        <optgroup key={r.id} label={`Phase ${r.nr} · ${r.titel}`}>
          {bild.knoten.filter(k => k.phaseId === r.id && k.id !== einzelKnoten.id).flatMap(k => (einzelKnoten.entscheid
            ? [<option key={`ja${k.id}`} value={`ja|${k.id}`}>ja → {k.titel}</option>, <option key={`nein${k.id}`} value={`nein|${k.id}`}>nein → {k.titel}</option>]
            : [<option key={k.id} value={`weiter|${k.id}`}>→ {k.titel}</option>]))}
        </optgroup>
      ))}
    </select>
  ) : null;

  const knopf: CSSProperties = { minHeight: ZIEL_PX, minWidth: ZIEL_PX };
  const hinweis = flaecheHinweis(geraet.mac, geraet.touch || !!handy, darfZiehen);
  const k = kamera.current;
  const ex = exportRahmen(bild.box);
  const handyWahl = handy && einzelKnoten;

  return (
    <div className="ff-flaeche" data-ff-flaeche>
      <div className="ff-flaeche-leiste" role="toolbar" aria-label="Fläche: Ansicht">
        <Knopf leise style={knopf} onClick={() => zoomen(1 / ZOOM_SCHRITT)} ariaLabel="Verkleinern (−)" titel="Verkleinern (−)"><Minus size={16} aria-hidden /></Knopf>
        <span ref={zoomText} aria-live="off" style={{ ...MIKRO, minWidth: 48, textAlign: 'center' }}>{Math.round(k.s * 100)} %</span>
        <Knopf leise style={knopf} onClick={() => zoomen(ZOOM_SCHRITT)} ariaLabel="Vergrößern (+)" titel="Vergrößern (+)"><Plus size={16} aria-hidden /></Knopf>
        <Knopf leise style={knopf} onClick={allesAnzeigen} titel="Alles zeigen (1)"><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Maximize2 size={14} aria-hidden />Alles zeigen</span></Knopf>
        <Knopf leise style={knopf} onClick={zuruecksetzen} titel="Zurücksetzen auf 100 % (0)"><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><LocateFixed size={14} aria-hidden />Zurücksetzen</span></Knopf>
        <button type="button" className="fassbar" aria-pressed={raster} onClick={() => { const n = !raster; setRaster(n); merkerSchreiben(MERKER_RASTER, n ? 'an' : 'aus'); }}
          title="Raster mit Einrasten an/aus"
          style={{ ...knopf, display: 'inline-flex', gap: 6, alignItems: 'center', padding: '6px 12px', borderRadius: ECKE.knopf, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien,
            color: raster ? C.ink : C.inkDim, background: raster ? TIEF.flaeche(C.aktiv) : 'transparent', border: `1px solid ${raster ? TIEF.rand(C.aktiv) : RAND.flaeche}` }}>
          <Grid3x3 size={14} aria-hidden />Raster {raster ? 'an' : 'aus'}
        </button>
        <span style={{ flex: 1 }} />
        {verbindenMenue}
        <Knopf leise style={knopf} aus={!!exportArt} onClick={() => setExportArt('png')} titel="Als Bild speichern (PNG) — nur die Fläche mit Legende"><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ImageDown size={14} aria-hidden />Bild (PNG)</span></Knopf>
        <Knopf leise style={knopf} aus={!!exportArt} onClick={() => setExportArt('svg')} titel="Als Bild speichern (SVG) — nur die Fläche mit Legende">SVG</Knopf>
      </div>

      <div className={`ff-flaeche-raster${darfZiehen ? '' : ' ff-flaeche-ohne-palette'}${p.feld ? '' : ' ff-flaeche-ohne-feld'}`}>
        {darfZiehen && (
          <div className="ff-editor-palette" role="toolbar" aria-label="Palette — auf die Fläche ziehen oder antippen">
            <span style={{ ...MIKRO, alignSelf: 'center' }}>Palette</span>
            {FLAECHE_PALETTE.map(f => (
              <button key={f} type="button" className="fassbar ff-flaeche-palette" disabled={laeuft}
                onPointerDown={paletteRunter(f)} onPointerMove={paletteBewegt} onPointerUp={paletteHoch} onPointerCancel={() => { palettenZug.current = null; if (geist.current) geist.current.style.display = 'none'; }}
                onClick={() => { if (paletteGezogen.current) { paletteGezogen.current = false; return; } paletteAblegen(f, null); }}
                aria-label={`${paletteTitel(f)} einfügen — oder auf die Fläche ziehen`}
                style={{ display: 'inline-flex', gap: 8, alignItems: 'center', minHeight: ZIEL_PX, padding: '6px 12px', borderRadius: f === 'erinnerung' || f === 'phase' ? 18 : 8, cursor: 'grab', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.ink, textAlign: 'left', touchAction: 'none',
                  ...FLAECHE_STIL.flach, border: `1px solid ${RAND.flaeche}` }}>
                {f === 'phase' ? <span aria-hidden style={{ width: 16, height: 12, borderRadius: 6, border: `2px solid ${C.inkDim}` }} />
                  : f === 'baustein' ? <span aria-hidden style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${LEUCHT.planung}` }} />
                    : f === 'entscheidung' ? <FreigabeRaute gegeben={false} groesse={10} /> : f === 'schritt' ? <span aria-hidden style={{ width: 13, height: 10, borderRadius: 2, border: `1.5px solid ${LEUCHT.gut}` }} /> : <FormZeichen form={flussFormVon(f)} />}
                {paletteTitel(f)}
              </button>
            ))}
          </div>
        )}

        <div className="ff-flaeche-buehne" ref={buehne}>
          <canvas ref={fadenLeinwand} aria-hidden="true" data-flow-ebene="" className="ff-flow-ebene" style={{ pointerEvents: 'none' }} />
          <svg ref={svg} tabIndex={0} role="application" aria-roledescription="Zeichenfläche"
            aria-label={`Fläche des Ablaufs „${vorlage.titel}“: ${bild.rahmen.length} Phasen als Rahmen, ${bild.knoten.length} Schritte${darfZiehen ? ' — Tab wählt den nächsten Schritt, Pfeiltasten verschieben, Entf löscht, Enter bearbeitet' : ''}`}
            aria-describedby={hinweisId}
            onPointerDown={runter} onPointerMove={bewegt} onPointerUp={hoch} onPointerCancel={() => abbrechen()} onDoubleClick={doppelt} onKeyDown={taste}
            style={{ fontFamily: SCHRIFT.text }}>
            <defs>
              <pattern id={rasterId} ref={muster} width={FL.raster} height={FL.raster} patternUnits="userSpaceOnUse" patternTransform={`translate(${k.x} ${k.y}) scale(${k.s})`}>
                <circle cx={1} cy={1} r={1} fill={RAND.stark} />
              </pattern>
              <FlaecheSpitze id={spitzeId} />
            </defs>
            {/* Kein Grund-Rechteck: die Bühne trägt den Grund (C.grund), darunter liegt die Faden-Ebene. */}
            {raster &&<rect width="100%" height="100%" fill={`url(#${rasterId})`} style={{ pointerEvents: 'none' }} />}
            <g ref={welt} transform={transformVon(k)}>
              <g key={neuZeichnen}>
                <Zeichnung bild={bild} auswahl={auswahl} pfeilWahl={pfeilWahl} spitze={spitzeId} bearbeiten={darfZiehen}
                  onRein={knotenRein} onRaus={knotenRaus} onFokus={knotenFokus} />
              </g>
              {darfZiehen && (
                <g ref={anfasser} data-fl-nur-bearbeiten="" style={{ display: 'none' }} onPointerEnter={() => { if (verstecken.current) clearTimeout(verstecken.current); }} onPointerLeave={knotenRaus}>
                  {['oben', 'rechts', 'unten', 'links'].map(s => (
                    <g key={s}>
                      <circle data-fl-anfasser={s} r={22} fill="transparent" style={{ cursor: 'crosshair' }} />
                      <circle data-fl-anfasser={s} r={6} fill={C.grund} stroke={FLAECHE_ZIEL} strokeWidth={2} style={{ cursor: 'crosshair' }} />
                    </g>
                  ))}
                </g>
              )}
              <path ref={zugPfad} className="ff-fl-zug" d="" fill="none" stroke={C.inkDim} strokeWidth={2} strokeDasharray="6 5" markerEnd={`url(#${spitzeId})`} style={{ pointerEvents: 'none' }} />
              <rect ref={band} fill={TIEF.flaeche(C.aktiv)} stroke={TIEF.rand(C.aktiv)} strokeDasharray="5 4" style={{ display: 'none', pointerEvents: 'none' }} />
            </g>
          </svg>

          {bearbeiten && (() => {
            const [sx, sy] = bildAus(kamera.current, bearbeiten.box.x, bearbeiten.box.y);
            const s = kamera.current.s;
            const b = Math.max(180, bearbeiten.box.b * s);
            return (
              <input autoFocus defaultValue={bearbeiten.text} aria-label={bearbeiten.art === 'pfeil' ? 'Beschriftung des Pfeils' : bearbeiten.art === 'rahmen' ? 'Titel der Phase' : 'Titel des Schritts'}
                maxLength={bearbeiten.art === 'pfeil' ? 60 : 120} placeholder={bearbeiten.art === 'pfeil' ? 'z. B. ja, nein, nach 5 Tagen' : undefined}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void bearbeitenFertig((e.target as HTMLInputElement).value); } else if (e.key === 'Escape') { e.preventDefault(); void bearbeitenFertig(null); } }}
                onBlur={e => void bearbeitenFertig(e.target.value)}
                // 17.10. spät: der Vorgabe-Titel ist markiert — wer gleich tippt, ersetzt ihn (vorher hing „Neuer Schritt“ vor dem eigenen Text).
                onFocus={e => e.currentTarget.select()}
                style={{ position: 'absolute', left: sx, top: sy + Math.max(0, (bearbeiten.box.h * s - ZIEL_PX) / 2), width: b, minHeight: ZIEL_PX, fontSize: 16, boxSizing: 'border-box', padding: '8px 10px', borderRadius: ECKE.eingabe, color: C.ink, background: C.flaecheHoch, border: `2px solid ${FLAECHE_ZIEL}`, fontFamily: SCHRIFT.text, zIndex: 3 }} />
            );
          })()}

          {zweigFrage && (
            <div role="dialog" aria-label="Welcher Zweig?" style={{ position: 'absolute', left: Math.max(8, zweigFrage.x - 80), top: zweigFrage.y + 10, display: 'flex', gap: 6, padding: 8, borderRadius: ECKE.knopf, background: C.flaecheHoch, border: `1px solid ${RAND.stark}`, zIndex: 3 }}>
              <Knopf leise style={knopf} onClick={() => verbinden(zweigFrage.von, zweigFrage.nach, 'ja')}>ja</Knopf>
              <Knopf leise style={knopf} onClick={() => verbinden(zweigFrage.von, zweigFrage.nach, 'nein')}>nein</Knopf>
              <Knopf leise style={knopf} onClick={() => setZweigFrage(null)}>Abbrechen</Knopf>
            </div>
          )}

          <p id={hinweisId} className="ff-flaeche-hinweis" style={{ position: 'absolute', left: 12, bottom: 8, margin: 0, fontSize: TYP.bedien, color: C.inkLeise, pointerEvents: 'none', maxWidth: 'calc(100% - 24px)' }}>
            {kurzHinweis ?? hinweis}
          </p>
          {!bild.rahmen.length && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', color: C.inkDim, fontSize: TYP.body, textAlign: 'center', padding: 24 }}>
              {darfZiehen ? 'Noch keine Phase — zieh „Start · Phase“ auf die Fläche.' : 'Dieser Ablauf hat noch keine Phase.'}
            </div>
          )}
        </div>

        {p.feld && <div className="ff-editor-feld" style={{ display: 'grid', gap: 14, minWidth: 0 }}>{p.feld}</div>}
      </div>

      {handyWahl && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ flex: '1 1 200px', fontSize: TYP.bedien, color: C.ink }}>{FORM_TITEL[einzelKnoten.knotenForm]}: {einzelKnoten.titel}{einzelKnoten.unter ? <span style={{ color: C.inkLeise }}> · {einzelKnoten.unter}</span> : null}</span>
          {darf && p.zurListe && <Knopf leise style={knopf} onClick={() => p.zurListe!(einzelKnoten.id)}>In der Liste bearbeiten ›</Knopf>}
        </div>
      )}

      {/* Der Geist beim Ziehen aus der Palette. */}
      <div ref={geist} aria-hidden style={{ position: 'fixed', left: 0, top: 0, display: 'none', alignItems: 'center', padding: '6px 12px', borderRadius: 8, fontSize: TYP.bedien, color: C.ink, background: C.flaecheHoch, border: `1px solid ${FLAECHE_ZIEL}`, pointerEvents: 'none', zIndex: 50 }} />

      {/* Die Export-Zeichnung (nur während „Als Bild speichern“): dieselben Formen, ohne Auswahl und Bedienung, mit Titel und Legende. */}
      {exportArt && (
        <svg ref={exportSvg} aria-hidden width={ex.b} height={ex.h} viewBox={`${ex.x} ${ex.y} ${ex.b} ${ex.h}`} fontFamily={EXPORT_SCHRIFT} style={{ position: 'absolute', left: -100000, top: 0 }}>
          <defs><FlaecheSpitze id={`${spitzeId}-x`} /></defs>
          <rect x={ex.x} y={ex.y} width={ex.b} height={ex.h} fill={C.grund} />
          <text x={ex.x + 48} y={ex.y + 50} fontSize={26} fontWeight={700} fill={C.ink}>{vorlage.titel}</text>
          <Zeichnung bild={bild} auswahl={LEER} pfeilWahl={null} spitze={`${spitzeId}-x`} bearbeiten={false} nurBild />
          <FlaecheLegende x={ex.x + 48} y={ex.legendeY} />
        </svg>
      )}
    </div>
  );
}
const LEER: ReadonlySet<string> = new Set();

/** Die Zeichnung der Fläche (live und für den Export): Rahmen, Gruppen, Pfeile, Start/Abstimmung, Knoten — in dieser Ebenen-Reihenfolge. */
function Zeichnung({ bild, auswahl, pfeilWahl, spitze, bearbeiten, nurBild, onRein, onRaus, onFokus }: {
  bild: FlaecheBild; auswahl: ReadonlySet<string>; pfeilWahl: string | null; spitze: string; bearbeiten: boolean; nurBild?: boolean;
  onRein?: (id: string) => void; onRaus?: () => void; onFokus?: (k: FlKnoten) => void;
}) {
  return (
    <>
      {bild.rahmen.map(r => (
        <g key={r.id} data-fl-el={`rahmen:${r.id}`} data-fl-rahmen={r.id} transform={`translate(${r.x} ${r.y})`}>
          <FlaecheRahmen b={r.b} h={r.h} nr={r.nr} titel={r.titel} intern={!r.kundeSichtbar} gewaehlt={auswahl.has(r.id)} kopf={FL.kopf} />
          {!nurBild && <rect data-fl-flaeche="" width={r.b} height={r.h} rx={16} fill="none" stroke="none" className="ff-fl-rahmen-ziel" style={{ pointerEvents: 'none' }} />}
          {!nurBild && <rect data-fl-kopf={r.id} width={r.b} height={FL.kopf - 14} fill="transparent" style={{ cursor: bearbeiten ? 'move' : 'default' }}><title>{`Phase ${r.nr}: ${r.titel}`}</title></rect>}
          {!nurBild && bearbeiten && (
            <g data-fl-groesse={r.id} data-fl-nur-bearbeiten="" transform={`translate(${r.b - 22} ${r.h - 22})`} style={{ cursor: 'nwse-resize' }}>
              <rect width={44} height={44} fill="transparent" />
              <path d="M30 14 L14 30 M30 22 L22 30" stroke={C.inkLeise} strokeWidth={2} strokeLinecap="round" />
            </g>
          )}
        </g>
      ))}
      {bild.gruppen.map(g => (
        <g key={g.id} data-fl-el={`gruppe:${g.id}`} transform={`translate(${g.box.x} ${g.box.y})`}><FlaecheGruppe b={g.box.b} h={g.box.h} titel={g.titel} /></g>
      ))}
      {bild.pfeile.map(pf => {
        const d = pfadVon(pf.punkte);
        return (
          <g key={pf.id} data-fl-pfeil-g={pf.id}>
            {!nurBild && <path data-fl-pfeil={pf.id} d={d} fill="none" stroke="transparent" strokeWidth={16} style={{ pointerEvents: 'stroke', cursor: 'pointer' }}><title>{`Pfeil${pf.text ? ` „${pf.text}“` : ''}${pf.zweig ? ' — Entf löst den Zweig' : ''}`}</title></path>}
            <FlaechePfeil d={d} spitze={spitze} text={pf.text} textOrt={pf.text ? pfeilTextOrt(pf.punkte) : undefined} gewaehlt={pfeilWahl === pf.id} gestrichelt={pf.art === 'zurueck'}
              {...(nurBild ? { faden: flaecheFaden(pf, FLOW_TON) } : {})} />
          </g>
        );
      })}
      {bild.starts.map(s => <g key={s.id} data-fl-el={s.id} transform={`translate(${s.x} ${s.y})`}><FlaecheStart b={s.b} h={s.h} titel={s.titel} /></g>)}
      {bild.abstimmungen.map(a => <g key={a.id} data-fl-el={a.id} {...(nurBild ? {} : { 'data-fl-ab': a.phaseId, style: { cursor: 'pointer' } })} transform={`translate(${a.x} ${a.y})`}><FlaecheForm form="entscheidung" umriss="raute" b={a.b} h={a.h} titel={a.titel} /></g>)}
      {bild.knoten.map(k => {
        const an = auswahl.has(k.id);
        return (
          <g key={k.id} data-fl-el={k.id} data-fl-knoten={k.id} className="ff-fl-knoten" transform={`translate(${k.x} ${k.y})`}
            {...(nurBild ? {} : {
              tabIndex: 0, role: 'button', 'aria-pressed': an,
              'aria-label': `${FORM_TITEL[k.knotenForm]}: ${k.titel}${k.unter ? `, ${k.unter}` : ''} — Phase ${bild.rahmen.find(r => r.id === k.phaseId)?.nr ?? ''}${k.neinVon ? ', Nein-Zweig' : ''}`,
              onPointerEnter: () => onRein?.(k.id), onPointerLeave: () => onRaus?.(), onFocus: () => onFokus?.(k),
              style: { cursor: bearbeiten ? 'grab' : 'pointer' },
            })}>
            <FlaecheForm form={k.form} umriss={k.umriss} b={k.b} h={k.h} titel={k.titel} unter={k.unter} gewaehlt={an} />
            {!nurBild && <rect className="ff-fl-fokus" x={-5} y={-5} width={k.b + 10} height={k.h + 10} rx={12} fill="none" stroke={FLAECHE_ZIEL} strokeWidth={2} style={{ pointerEvents: 'none' }} />}
          </g>
        );
      })}
    </>
  );
}
