'use client';

// ─── Standard · Arbeitsfläche (29.10., DESIGN_STANDARD.md › Arbeitsfläche) ─────────────────────────────────────────────────────────────────
// Kevin 29.10.: „manchmal die Aufteilung, z. B. in der Inbox, schlecht von der Darstellung her … bei den Kontakten auch … das Thema Scrolling macht
// manchmal keinen Sinn.“ EIN Muster für Listen-/Detail-Seiten:
//   · Kopf in EINER Zeile: Titel (kein erklärender Untertitel), daneben ein ruhiger Zähler, rechts EINE Hauptaktion, Nebenaktionen hinter „⋯“.
//   · Suche + Filter in EINER Zeile (`leiste`); weitere Filter hinter `FilterKnopf` (Popover mit Zähler) — nie eine abgeschnittene Chip-Reihe.
//   · Die Fläche füllt den sichtbaren Bereich bis unten; Liste und Detail scrollen JE FÜR SICH (eine Scrollfläche je Spalte, Kopf und Filter bleiben
//     stehen). Die Seite selbst scrollt dann nicht. Unten bleibt die Ablage (ZOE-Kugel) frei — `<main>` endet schon darüber.
//   · Zwei Spalten, sobald die Fläche selbst breit genug ist (`ZWEI_AB`, gemessen an der Fläche, nicht am Fenster); schmaler zeigt sie das Detail
//     ODER die Liste (das Detail trägt dann „‹ Zurück“, `useArbeitsflaeche().zwei`). Handy (≤ 720 px): kein fester Rahmen — Liste → Detail als
//     Schritt im gewohnten Seitenfluss.
// Nur Darstellung: Daten, Adressen (`?offen=`, `?k=`) und Tasten bleiben bei der Seite.

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal, SlidersHorizontal } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { useHandy } from './medien';

/** Ab dieser Breite der FLÄCHE (nicht des Fensters) stehen Liste und Detail nebeneinander. */
export const ZWEI_AB = 720;
/** Kleinste Höhe der Fläche — darunter scrollt die Seite wie gewohnt (sehr flache Fenster). */
export const FLAECHE_MIN = 340;

export interface FlaecheStand { zwei: boolean; frei: boolean }
/** Ein Inhalt der Fläche — fest oder abhängig davon, ob zwei Spalten stehen (die Seite weiß das erst, wenn die Fläche gemessen hat). */
export type FlaecheInhalt = ReactNode | ((s: FlaecheStand) => ReactNode);
const aufloesen = (x: FlaecheInhalt, s: FlaecheStand): ReactNode => (typeof x === 'function' ? x(s) : x);
const FlaecheKontext = createContext<FlaecheStand | null>(null);
/** In einer Arbeitsfläche? `zwei` = Liste und Detail nebeneinander, `frei` = Handy (Seitenfluss). Außerhalb: null. */
export function useArbeitsflaeche(): FlaecheStand | null { return useContext(FlaecheKontext); }

const useIsoLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Breite eines Elements (ResizeObserver) — `[ref, breite]`, `breite` = null bis zur ersten Messung. Die Ref ist eine Funktion: auch ein Element, das erst
 * später erscheint (nach dem Laden), wird gemessen.
 */
export function useBreite(): [(el: HTMLElement | null) => void, number | null] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [b, setB] = useState<number | null>(null);
  useIsoLayout(() => {
    if (!el) return;
    const lesen = () => { const w = Math.round(el.getBoundingClientRect().width); setB(alt => (alt === w ? alt : w)); };
    lesen();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(lesen); ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, b];
}

/**
 * Höhe vom oberen Rand des Elements bis zum unteren Rand des Inhaltsbereichs (`<main>` rollt, der Kopf steht darin oben fest; `<main>` endet
 * über der Ablage unten) — wie `useVolleHoehe` im Kalender. Neu bei Fenstergröße und wenn über der Fläche etwas wächst (Hinweis, Kopf).
 */
function useRestHoehe(ref: { current: HTMLElement | null }, aus: boolean): number | null {
  const [h, setH] = useState<number | null>(null);
  useIsoLayout(() => {
    if (aus) { setH(null); return; }
    const el = ref.current; if (!el) return;
    let bild = 0;
    const messen = () => {
      bild = 0;
      const e = ref.current; if (!e) return;
      const main = e.closest('main');
      const mr = main?.getBoundingClientRect();
      const unten = mr ? Math.min(window.innerHeight, mr.bottom) : window.innerHeight;
      const neu = Math.max(FLAECHE_MIN, Math.floor(unten - e.getBoundingClientRect().top - 12));
      setH(alt => (alt === neu ? alt : neu));
    };
    const spaeter = () => { if (!bild) bild = requestAnimationFrame(messen); };
    messen();
    window.addEventListener('resize', spaeter);
    const main = el.closest('main');
    main?.addEventListener('scroll', spaeter, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(spaeter);
    const seite = el.closest('.af'); if (ro && seite) for (const k of Array.from(seite.children)) if (k !== el) ro.observe(k);
    const kopf = document.querySelector('.wachstum-kopf'); if (ro && kopf) ro.observe(kopf);
    return () => { window.removeEventListener('resize', spaeter); main?.removeEventListener('scroll', spaeter); ro?.disconnect(); if (bild) cancelAnimationFrame(bild); };
  }, [ref, aus]);
  return h;
}

/** Ein Popover am Knopf: schließt bei Klick daneben und Esc. */
function usePopover() {
  const [auf, setAuf] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!auf) return;
    // Menüs, die aus dem Popover heraus öffnen (Wahl-Chips, Dialoge), liegen in einem Portal — ein Klick dort gehört noch zum Popover.
    const inPortal = (t: EventTarget | null) => !!(t as Element | null)?.closest?.('[data-wahl-menue], .wahl-hinter, .os-fenster, [role="alertdialog"]');
    const weg = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node) && !inPortal(e.target) && !document.querySelector('[data-wahl-menue]')) setAuf(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !inPortal(e.target) && !document.querySelector('[data-wahl-menue]')) setAuf(false); };
    document.addEventListener('mousedown', weg); document.addEventListener('touchstart', weg); window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', weg); document.removeEventListener('touchstart', weg); window.removeEventListener('keydown', esc); };
  }, [auf]);
  return { auf, setAuf, ref };
}

/** „⋯“ — Nebenaktionen der Ansicht in einem Menü (beliebige Knöpfe, untereinander; ein Klick darin schließt es). */
export function MehrMenue({ children, label = 'Weitere Aktionen' }: { children: ReactNode; label?: string }) {
  const p = usePopover();
  return (
    <div ref={p.ref} className="af-pop-anker">
      <button type="button" className="af-mehr fassbar" aria-label={label} title={label} aria-expanded={p.auf} aria-haspopup="menu" onClick={() => p.setAuf(a => !a)}>
        <MoreHorizontal size={18} aria-hidden />
      </button>
      {p.auf && <div role="menu" aria-label={label} className="af-pop af-pop-menue" onClick={e => { if ((e.target as HTMLElement).closest('button,a')) p.setAuf(false); }}>{children}</div>}
    </div>
  );
}

/** „Filter ▾“ mit Zähler aktiver Filter — die weiteren Filter stehen im Popover (umbrechend), nie als abgeschnittene Reihe. */
export function FilterKnopf({ aktiv, children, label = 'Filter', onZuruecksetzen }: { aktiv: number; children: ReactNode; label?: string; onZuruecksetzen?: () => void }) {
  const p = usePopover();
  return (
    <div ref={p.ref} className="af-pop-anker">
      <button type="button" className={`af-filter fassbar${aktiv ? ' af-filter-an' : ''}`} aria-expanded={p.auf} aria-haspopup="dialog" onClick={() => p.setAuf(a => !a)}>
        <SlidersHorizontal size={15} aria-hidden /><span>{label}</span>{aktiv > 0 && <span className="af-filter-zahl" aria-label={`${aktiv} aktiv`}>{aktiv}</span>}<span aria-hidden style={{ color: C.inkLeise }}>▾</span>
      </button>
      {p.auf && (
        <div role="dialog" aria-label={label} className="af-pop af-pop-filter">
          {children}
          {onZuruecksetzen && aktiv > 0 && <button type="button" className="af-pop-zurueck fassbar" onClick={() => { onZuruecksetzen(); p.setAuf(false); }}>Alle Filter zurücksetzen</button>}
        </div>
      )}
    </div>
  );
}

/** Eine Gruppe im Filter-Popover: Beschriftung + Inhalt (Pillen, Wahl …). */
export function FilterGruppe({ titel, children }: { titel: string; children: ReactNode }) {
  return <div className="af-filter-gruppe"><div className="af-filter-titel">{titel}</div><div className="af-filter-inhalt">{children}</div></div>;
}

/** Abschnittskopf IN einer Liste (Gruppe): klebt oben in der Scrollfläche der Liste — statt Karten in Karten. */
export function ListenAbschnitt({ titel, farbe, rechts, children, id }: { titel: ReactNode; farbe?: string; rechts?: ReactNode; children?: ReactNode; id?: string }) {
  return (
    <section className="af-abschnitt" data-abschnitt={id}>
      <div className="af-abschnitt-kopf">
        <h2 className="af-abschnitt-titel">{farbe && <span aria-hidden className="af-abschnitt-punkt" style={{ background: farbe }} />}{titel}</h2>
        {rechts && <span className="af-abschnitt-rechts">{rechts}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * Die Arbeitsfläche: Kopf · Leiste (Suche + Filter) · Hinweise · Liste | Detail (· Kontext im Detail selbst).
 * `detail` = null → in zwei Spalten steht `leer` rechts (z. B. das Lagebild), schmal nur die Liste. `listeKopf` klebt oben in der Liste (Tabellenkopf).
 * `breite` = höchste Breite (Standard 1600 px; die Fläche nutzt breite Bildschirme).
 */
export function Arbeitsflaeche({ titel, zaehler, haupt, neben, mehr, leiste, hinweise, liste, listeKopf, detail, detailKennung, leer, leerOben, verhaeltnis = '2:3', breite = 1600, className, label }: {
  titel: ReactNode; /** Ruhiger Zähler neben dem Titel („4 brauchen Antwort“). */ zaehler?: ReactNode;
  /** Die EINE Hauptaktion. */ haupt?: ReactNode; /** Leise Knöpfe vor „⋯“ (sparsam: ZOE/Head). */ neben?: ReactNode; /** Inhalt des „⋯“-Menüs. */ mehr?: ReactNode;
  leiste?: ReactNode; hinweise?: ReactNode; liste: FlaecheInhalt; listeKopf?: FlaecheInhalt; detail?: FlaecheInhalt | null; leer?: FlaecheInhalt;
  /** In EINER Spalte (schmal, Handy) steht `leer` über der Liste statt zu fehlen (z. B. das Lagebild der Inbox). */ leerOben?: boolean;
  /** Wechselt sie (anderes Gespräch, andere Person), beginnt die Scrollfläche des Details oben. */ detailKennung?: string | null;
  /** Liste : Detail in zwei Spalten. */ verhaeltnis?: '1:1' | '2:3' | '1:2' | '3:2'; breite?: number; className?: string; label?: string;
}) {
  const handy = useHandy();
  const [huelle, b] = useBreite();
  const koerper = useRef<HTMLDivElement | null>(null);
  const zwei = !handy && (b ?? 0) >= ZWEI_AB;
  const hoehe = useRestHoehe(koerper, handy);
  const stand = useMemo<FlaecheStand>(() => ({ zwei, frei: handy }), [zwei, handy]);
  const d0 = detail == null ? null : aufloesen(detail, stand);
  const istDetail = d0 !== null && d0 !== undefined && d0 !== false;
  const zeigeListe = zwei || !istDetail;
  const leerInhalt = leer == null ? null : aufloesen(leer, stand);
  const rechts = istDetail ? d0 : zwei ? leerInhalt : null;
  const [l, d] = verhaeltnis.split(':').map(Number);
  // Wechselt das Detail (anderes Gespräch, andere Person), beginnt seine Scrollfläche oben.
  const detailRef = useRef<HTMLDivElement | null>(null);
  const detailSchluessel = `${istDetail ? 'd' : 'l'}:${detailKennung ?? ''}`;
  useEffect(() => { detailRef.current?.scrollTo?.({ top: 0 }); }, [detailSchluessel]);
  return (
    <FlaecheKontext.Provider value={stand}>
      <div ref={huelle} className={`ui-seite af${handy ? ' af-frei' : ''}${className ? ` ${className}` : ''}`} aria-label={label}
        style={{ ['--ui-breit' as string]: `${breite}px`, color: C.ink, fontFamily: SCHRIFT.text }}>
        <header className="af-kopf os-auf">
          <h1 className="af-titel" style={{ fontFamily: SCHRIFT.display }}>{titel}</h1>
          {zaehler && <span className="af-zaehler">{zaehler}</span>}
          <span className="af-kopf-rechts">{neben}{mehr && <MehrMenue>{mehr}</MehrMenue>}{haupt}</span>
        </header>
        {/* Suche und Filter gehören zur Liste: steht in einer Spalte nur das Detail, treten sie zurück (das Detail trägt „‹ Zurück“). */}
        {leiste && zeigeListe && <div className="af-leiste">{leiste}</div>}
        {hinweise && <div className="af-hinweise">{hinweise}</div>}
        <div ref={koerper} className={`af-koerper${zwei && rechts ? ' af-zwei' : ''}`}
          style={{ ...(hoehe && !handy ? { height: hoehe } : {}), ...(zwei && rechts ? { gridTemplateColumns: `minmax(0, ${l}fr) minmax(0, ${d}fr)` } : {}) }}>
          {zeigeListe && (
            <div className="af-spalte af-liste" data-af="liste">
              {leerOben && !zwei && !istDetail && leerInhalt ? <div className="af-liste-oben">{leerInhalt}</div> : null}
              {listeKopf ? <div className="af-liste-kopf">{aufloesen(listeKopf, stand)}</div> : null}
              {aufloesen(liste, stand)}
            </div>
          )}
          {rechts && <div ref={detailRef} className="af-spalte af-detail" data-af="detail" style={{ fontSize: TYP.body }}>{rechts}</div>}
        </div>
      </div>
    </FlaecheKontext.Provider>
  );
}
