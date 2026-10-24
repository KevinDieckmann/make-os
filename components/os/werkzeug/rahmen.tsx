'use client';

// ─── Werkzeug-Muster — der Werkzeugmodus (ganzer Bildschirm, 22.10.; lib/make-one/werkzeuge.ts) ─────────────────────────────────────────────
// Rückmeldung: „Innerhalb der Maske auf jeden Fall einen Pfeil oben rechts, der diesen Bereich einfach als Ganzes macht.“ Der Werkzeugmodus IST das Vollbild der
// Flächen (`?voll=1`, ../ui/flaeche/vollbild.ts) — die Seite schaltet ihn, der Rahmen zeichnet ihn (Miro-Art):
//   · Kopf der Schale und Leiste weichen (ein Overlay über allem, Portal in den Body); links die schmale Symbol-Leiste des Werkzeugs (./menue.tsx `schiene`).
//   · Oben schwebt die Kopfzeile „← MAKE OS · <Werkzeug> · <Titel>“, rechts Aktionen und „Vollbild verlassen“ (⤡); Esc verlässt (abschaltbar, wenn die Seite
//     Esc selbst führt).
//   · Orte für schwebende Leisten (`WerkzeugSlot`): `titel` (hinter dem Titel), `aktionen` (oben rechts), `links` (Werkzeugleiste), `unten-links` (ZOE/Head
//     fragen), `unten-rechts` (Zoom). Leer = unsichtbar. Außerhalb des Rahmens zeichnet ein Slot nichts — die Seite legt ihre Leisten dann selbst hin.
//   · `WerkzeugFeld`: das Seitenfeld (Steckbrief, Maske) schwebt rechts und klappt ein/aus (gemerkt je Werkzeug, öffnet sich bei neuer Auswahl).
//   · `GanzerBildschirmKnopf`: der Pfeil ⤢ oben rechts IN jeder Fläche (außerhalb des Werkzeugmodus).
// Keine Transformation und kein Weichzeichner an den schwebenden Leisten: Fenster (`Fenster`, position: fixed), die aus ihnen öffnen, bleiben so am Bildschirm.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Maximize2, Minimize2, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { SPACE_FARBE } from '@/lib/make-one/space-regeln';
import { werkzeugKontext, imWerkzeugModus, zurUebersicht, type Werkzeug } from '@/lib/make-one/werkzeuge';
import { Knopf, SymbolKnopf } from '../ui';
import { WerkzeugMenue, RueckwegKnopf } from './menue';

export type SlotOrt = 'titel' | 'aktionen' | 'links' | 'unten-links' | 'unten-rechts';
const ORTE: readonly SlotOrt[] = ['titel', 'aktionen', 'links', 'unten-links', 'unten-rechts'];

interface RahmenStand { werkzeug: Werkzeug; flaechig: boolean; orte: Partial<Record<SlotOrt, HTMLElement>> }
const RahmenKontext = createContext<RahmenStand | null>(null);

/** Steht die Ansicht im Werkzeugmodus? `flaechig` = die Fläche füllt den Bildschirm (Leisten schweben). Außerhalb: null. */
export function useWerkzeugModus(): { werkzeug: Werkzeug; flaechig: boolean } | null {
  const s = useContext(RahmenKontext);
  return s ? { werkzeug: s.werkzeug, flaechig: s.flaechig } : null;
}

/** Inhalt für einen Ort des Rahmens (schwebende Leiste, Kopfzeile). Außerhalb des Werkzeugmodus: nichts. */
export function WerkzeugSlot({ ort, children }: { ort: SlotOrt; children: ReactNode }) {
  const el = useContext(RahmenKontext)?.orte[ort];
  return el ? createPortal(children, el) : null;
}

const farbeVon = (w: Werkzeug) => SPACE_FARBE[w.spaces[0] ?? 'business'];

export function WerkzeugRahmen({ werkzeug, titel, flaechig = false, onVerlassen, esc = true, label, children }: {
  werkzeug: Werkzeug;
  /** Hinter „<Werkzeug> ·“ — z. B. die Brotkrumen bzw. der Name des offenen Prozesses. */ titel?: ReactNode;
  /** Die Fläche füllt den Bildschirm (Leisten schweben darüber); sonst eine Seite mit Rand unter der Kopfzeile. */ flaechig?: boolean;
  /** Vollbild verlassen (⤡, Esc) — die Adresse ohne `voll`. */ onVerlassen: () => void;
  /** Esc verlässt — `false`, wenn die Seite Esc selbst führt (eine Ebene hinaus, Dialoge zuerst). */ esc?: boolean;
  label?: string;
  children: ReactNode;
}) {
  const pfad = usePathname() ?? '';
  const params = useSearchParams();
  const suche = params?.toString() ?? '';
  const kontext = useMemo(() => werkzeugKontext(pfad, suche), [pfad, suche]);
  const farbe = farbeVon(werkzeug);
  const [montiert, setMontiert] = useState(false);
  useEffect(() => { setMontiert(true); }, []);
  // Die Orte der schwebenden Leisten: feste Ref-Funktionen (eine je Ort), sonst setzte jeder Neuaufbau sie zweimal.
  const [orte, setOrte] = useState<Partial<Record<SlotOrt, HTMLElement>>>({});
  const refs = useMemo(() => Object.fromEntries(ORTE.map(o => [o, (el: HTMLElement | null) => setOrte(v => (v[o] === (el ?? undefined) ? v : { ...v, [o]: el ?? undefined }))])) as Record<SlotOrt, (el: HTMLElement | null) => void>, []);
  const stand = useMemo<RahmenStand>(() => ({ werkzeug, flaechig, orte }), [werkzeug, flaechig, orte]);
  // Die Höhe der Kopfzeile (sie bricht auf schmalen Bildschirmen um) — Seitenfeld, Hinweise und der Rand einer Seite beginnen darunter.
  const wurzel = useRef<HTMLDivElement | null>(null);
  const kopf = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const k = kopf.current, w = wurzel.current;
    if (!k || !w || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { w.style.setProperty('--wz-oben', `${Math.ceil(k.getBoundingClientRect().height) + 20}px`); });
    ro.observe(k);
    return () => ro.disconnect();
  }, [montiert]);
  const verlassen = useRef(onVerlassen);
  verlassen.current = onVerlassen;
  const zurueck = useCallback(() => { zurUebersicht(); verlassen.current(); }, []);
  useEffect(() => {
    if (!esc) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const t = e.target as Element | null;
      if (t?.closest?.('input,textarea,select,[contenteditable="true"]') || document.querySelector('.os-fenster, [role="alertdialog"]')) return;
      e.preventDefault();
      verlassen.current();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [esc]);

  if (!montiert) return null;
  const Icon = werkzeug.icon;
  return createPortal(
    <div ref={wurzel} className="wz-modus" role="dialog" aria-modal="true" aria-label={label ?? `${werkzeug.name} — ganzer Bildschirm`} data-werkzeug={werkzeug.id} style={{ fontFamily: SCHRIFT.text }}>
      <nav className="wz-schiene" aria-label={`${werkzeug.name} — Leiste`}>
        <WerkzeugMenue werkzeug={werkzeug} kontext={kontext} variante="schiene" farbe={farbe} onZurueck={zurueck} />
      </nav>
      <div className="wz-buehne">
        <RahmenKontext.Provider value={stand}>
          <div className={`wz-inhalt${flaechig ? ' wz-inhalt-flaeche' : ''}`}>{children}</div>
        </RahmenKontext.Provider>
        <header ref={kopf} className="wz-kopf">
          <div className="wz-kopf-teil wz-kopf-links">
            <RueckwegKnopf onZurueck={zurueck} stil={{ width: 'auto', padding: '6px 10px' }} />
            <span aria-hidden className="wz-trenner">·</span>
            <Link href={imWerkzeugModus(werkzeug.start)} className="fassbar wz-kopf-name" title={werkzeug.name} style={{ color: C.ink, fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body }}>
              <Icon size={16} strokeWidth={1.9} color={farbe} aria-hidden />{werkzeug.name}
            </Link>
            {titel && <><span aria-hidden className="wz-trenner">·</span><div className="wz-titel">{titel}</div></>}
            <div ref={refs.titel} className="wz-ort" />
          </div>
          <div className="wz-kopf-teil wz-kopf-rechts">
            <div ref={refs.aktionen} className="wz-ort" />
            <Knopf leise onClick={() => verlassen.current()} titel="Vollbild verlassen (Esc)" ariaLabel="Vollbild verlassen (Esc)">
              <span className="pz-knopf-inhalt"><Minimize2 size={15} aria-hidden /><span className="wz-text">Vollbild verlassen</span></span>
            </Knopf>
          </div>
        </header>
        <div ref={refs.links} className="wz-schwebe wz-links" />
        <div ref={refs['unten-links']} className="wz-schwebe wz-unten-links" />
        <div ref={refs['unten-rechts']} className="wz-schwebe wz-unten-rechts" />
      </div>
    </div>,
    document.body,
  );
}

const FELD_MERKER = (id: string) => `make-werkzeug-feld:${id}`;
const merkerLesen = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const merkerSchreiben = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* privates Fenster */ } };

/**
 * Das Seitenfeld im Werkzeugmodus: schwebt rechts, klappt ein und aus (gemerkt je Werkzeug). `oeffnenBei` — wechselt der Wert (neue Auswahl), öffnet es
 * sich wieder: wer einen Schritt wählt, will seine Maske sehen.
 */
export function WerkzeugFeld({ titel, oeffnenBei, zuBei, children }: { titel: string; oeffnenBei?: string | null;
  /** Feinschliff 24.10.: ein neuer Wert klappt das Feld für den Augenblick ein (z. B. Probelauf — das Ergebnis steht auf der Fläche); nicht gemerkt. */ zuBei?: number;
  children: ReactNode }) {
  const id = useContext(RahmenKontext)?.werkzeug.id ?? 'werkzeug';
  const [offen, setOffen] = useState(true);
  useEffect(() => { setOffen(merkerLesen(FELD_MERKER(id)) !== 'zu'); }, [id]);
  const vorher = useRef(oeffnenBei);
  useEffect(() => { if (oeffnenBei && oeffnenBei !== vorher.current) setOffen(true); vorher.current = oeffnenBei; }, [oeffnenBei]);
  const zuVorher = useRef(zuBei);
  useEffect(() => { if (zuBei && zuBei !== zuVorher.current) setOffen(false); zuVorher.current = zuBei; }, [zuBei]);
  const setzen = (an: boolean) => { setOffen(an); merkerSchreiben(FELD_MERKER(id), an ? 'auf' : 'zu'); };
  if (!offen) {
    return (
      <div className="wz-feld-zu">
        <SymbolKnopf ariaLabel={`${titel} ausklappen`} offen={false} onClick={() => setzen(true)}><PanelRightOpen size={16} /></SymbolKnopf>
      </div>
    );
  }
  return (
    <aside className="wz-feld" aria-label={titel}>
      <div className="wz-feld-kopf">
        <b style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>{titel}</b>
        <SymbolKnopf ariaLabel={`${titel} einklappen`} offen onClick={() => setzen(false)}><PanelRightClose size={16} /></SymbolKnopf>
      </div>
      <div className="wz-feld-inhalt">{children}</div>
    </aside>
  );
}

/** Der Pfeil oben rechts IN einer Fläche: ⤢ „Ganzer Bildschirm“ (bzw. ⤡ im Vollbild, wo die Kopfzeile ihn nicht schon trägt). */
export function GanzerBildschirmKnopf({ onClick, an = false, kuerzel }: { onClick: () => void; an?: boolean; kuerzel?: string }) {
  const name = an ? 'Vollbild verlassen' : 'Ganzer Bildschirm';
  return (
    <div className="wz-ganz">
      <SymbolKnopf ariaLabel={`${name}${kuerzel ? ` (${kuerzel})` : ''}`} titel={`${name}${kuerzel ? ` (${kuerzel})` : ''} — dieser Bereich als Ganzes`} onClick={onClick}>
        {an ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </SymbolKnopf>
    </div>
  );
}
