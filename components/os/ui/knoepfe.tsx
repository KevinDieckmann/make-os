'use client';

// ─── Standard · Knöpfe, Wahl, Reiter (03.10., DESIGN_STANDARD.md) ───────────
// Abgeleitet aus Netzwerken (Gross, Wahl, Aktionsleiste) und schlank.tsx (Knopf mit Doppelklick-Sperre, Pillen, Segmente).
// Ziele: Hauptaktion 48 px, alles andere am Handy ≥ 44 px (Klassen `ui-knopf`/`ui-wahl` in globals.css, mit Medienabfrage —
// Inline-Stil kann das nicht). Farben nur aus lib/make-one/design.ts.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { klickSperren, type KlickSperre } from '@/lib/make-one/klick-sperre';
import { FARBE as C, SCHRIFT, TIEF, LEUCHT, RAND } from '@/lib/make-one/design';

export type KnopfTon = 'haupt' | 'leise' | 'gut' | 'warn';

/** Die Tönung eines Knopfes: Hauptaktion getönt mit farbiger Kontur (Rezept TIEF), leise = Weißhauch, aus = flach. */
function knopfFarbe(ton: KnopfTon, farbe: string | undefined, leise: boolean | undefined, aus: boolean | undefined): CSSProperties {
  const f = farbe ?? (ton === 'gut' ? LEUCHT.gut : ton === 'warn' ? LEUCHT.achtung : C.aktiv);
  if (aus) return { border: '1px solid transparent', background: 'rgba(255,255,255,.08)', color: C.inkLeise };
  if (leise || ton === 'leise') return { border: `1px solid ${RAND.stark}`, background: 'rgba(255,255,255,.05)', color: C.ink };
  return TIEF.knopf(f);
}

export interface KnopfProps {
  children: ReactNode;
  /** Liefert die Handlung ein Promise, ist der Knopf bis zu dessen Ende gesperrt (kein Doppelklick, `aria-busy`). */
  onClick?: () => unknown;
  /** Zurückhaltend (Abbrechen, Zweitaktion). */
  leise?: boolean;
  aus?: boolean;
  /** Akzentfarbe (Bereichsfarbe) — Standard POINCAP-Petrol. */
  farbe?: string;
  /** Die EINE Hauptaktion der Ansicht: 48 px hoch, 16 px Schrift. */
  haupt?: boolean;
  /** Über die ganze Breite. */
  voll?: boolean;
  /** Netzwerken-Schreibweise: haupt · leise · gut · warn. */
  ton?: KnopfTon;
  href?: string;
  titel?: string;
  typ?: 'button' | 'submit';
  ariaLabel?: string;
  style?: CSSProperties;
}

/**
 * EIN Knopf für alles. `haupt` = die Hauptaktion (48 px), sonst 40 px am Rechner und 44 px am Handy. Mit `href` ein Link (intern über next/link).
 * Hinweis: Ein Knopf ohne `haupt` sieht auch mit Tönung wie eine Nebenaktion aus — je Ansicht höchstens EIN `haupt`.
 */
export function Knopf({ children, onClick, leise, aus, farbe, haupt, voll, ton = 'haupt', href, titel, typ = 'button', ariaLabel, style }: KnopfProps) {
  const sperre = useRef<KlickSperre>({ laeuft: false });
  const [laeuft, setLaeuft] = useState(false);
  const lebt = useRef(true);
  useEffect(() => { lebt.current = true; return () => { lebt.current = false; }; }, []);
  const klick = () => { void klickSperren(sperre.current, onClick, l => { if (lebt.current) setLaeuft(l); }); };
  const klasse = `ui-knopf fassbar${haupt ? ' ui-knopf-haupt' : ''}${voll ? ' ui-knopf-voll' : ''}`;
  const stil: CSSProperties = { ...knopfFarbe(ton, farbe, leise, aus), cursor: aus ? 'default' : laeuft ? 'progress' : 'pointer', ...(laeuft ? { opacity: 0.6 } : {}), ...style };
  if (href && !aus) {
    const extern = /^(https?:|mailto:|tel:)/.test(href);
    return extern
      ? <a href={href} onClick={onClick ? () => { void onClick(); } : undefined} className={klasse} style={stil} title={titel} aria-label={ariaLabel} {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>
      : <Link href={href} onClick={onClick ? () => { void onClick(); } : undefined} className={klasse} style={stil} title={titel} aria-label={ariaLabel}>{children}</Link>;
  }
  return <button type={typ} onClick={klick} disabled={aus} aria-busy={laeuft || undefined} aria-label={ariaLabel} className={klasse} style={stil} title={titel}>{children}</button>;
}

/** Netzwerken-Name für den großen Knopf: über die ganze Breite; `haupt` = die Hauptaktion (52 px), sonst 48. */
export function Gross({ children, onClick, ton = 'leise', aus, href, kleinerAbstand, titel }: { children: ReactNode; onClick?: () => unknown; ton?: KnopfTon; aus?: boolean; href?: string; kleinerAbstand?: boolean; titel?: string }) {
  return <Knopf voll haupt ton={ton} aus={aus} href={href} onClick={onClick} titel={titel} style={{ minHeight: kleinerAbstand ? 48 : 52, borderRadius: 14 }}>{children}</Knopf>;
}

/** Wahl-Chip (ein Wert aus mehreren) — Tippziel wie ein Knopf. */
export function Wahl({ an, onClick, children, farbe = C.aktiv, klein }: { an: boolean; onClick: () => void; children: ReactNode; farbe?: string; klein?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={an} className={`ui-wahl fassbar${klein ? ' ui-wahl-klein' : ''}`} style={{
      border: `1px solid ${an ? TIEF.rand(farbe) : RAND.flaeche}`, background: an ? TIEF.flaeche(farbe) : 'rgba(255,255,255,.04)', color: an ? farbe : C.ink,
    }}>{children}</button>
  );
}

type Eintrag<T extends string> = { id: T; label: string };

/** Eine Reihe Wahl-Chips, genau einer an (Filter, Ansichten). `einzeilig` wischt am Handy seitwärts, statt umzubrechen. */
export function Pillen<T extends string>({ liste, aktiv, onWahl, farbe = C.aktiv, einzeilig }: { liste: Eintrag<T>[]; aktiv: T | null | undefined; onWahl: (id: T) => void; farbe?: string; einzeilig?: boolean }) {
  return (
    <div className={`ui-pillen${einzeilig ? ' ui-pillen-einzeilig' : ''}`}>
      {liste.map(l => <Wahl key={l.id} klein an={l.id === aktiv} farbe={farbe} onClick={() => onWahl(l.id)}>{l.label}</Wahl>)}
    </div>
  );
}

/** Mehrere Chips zugleich an (Kevin 26.09.: „immer alles mehrfach klickbar“). */
export function MehrfachPillen<T extends string>({ liste, aktiv, onWahl, farbe = C.aktiv }: { liste: Eintrag<T>[]; aktiv: T[]; onWahl: (ids: T[]) => void; farbe?: string }) {
  return (
    <div className="ui-pillen">
      {liste.map(l => {
        const an = aktiv.includes(l.id);
        return <Wahl key={l.id} klein an={an} farbe={farbe} onClick={() => onWahl(an ? aktiv.filter(x => x !== l.id) : [...aktiv, l.id])}>{l.label}</Wahl>;
      })}
    </div>
  );
}

/** Anzeige-Pille in Kennzahlfarbe („Prio A“, „3 offen“) — nicht anklickbar, deshalb ohne Tippziel. */
export function Chip({ farbe, children, umbrechen }: { farbe: string; children: ReactNode; umbrechen?: boolean }) {
  return <span className="ui-chip" style={{ background: `${farbe}22`, color: farbe, borderRadius: umbrechen ? 14 : 999, ...(umbrechen ? { whiteSpace: 'normal', overflowWrap: 'anywhere', maxWidth: '100%', minWidth: 0 } : { whiteSpace: 'nowrap' }) }}>{children}</span>;
}

/** Segment-Umschalter (zwei bis fünf Ansichten): eine Fläche, die aktive Wahl getönt — wie die Reiter in Netzwerken. */
export function Segmente<T extends string>({ liste, aktiv, onWahl, umbrechen, farbe = C.aktiv }: { liste: { id: T; label: ReactNode }[]; aktiv: T; onWahl: (id: T) => void; umbrechen?: boolean; farbe?: string }) {
  return (
    <div className={`ui-segmente${umbrechen ? ' ui-segmente-umbrechen' : ''}`}>
      {liste.map(s => {
        const an = s.id === aktiv;
        return <button key={s.id} type="button" onClick={() => onWahl(s.id)} aria-pressed={an} className="ui-segment fassbar"
          style={{ border: `1px solid ${an ? TIEF.rand(farbe) : 'transparent'}`, background: an ? TIEF.flaeche(farbe) : 'transparent', color: an ? farbe : C.inkDim }}>{s.label}</button>;
      })}
    </div>
  );
}

export interface ReiterEintrag<T extends string = string> { id: T; label: ReactNode; farbe?: string }

/**
 * Reiterleiste (Rolle tablist): alle Reiter in EINER wischbaren Zeile, der aktive wird sichtbar gehalten. `gruppe` = leise Rahmung für die zweite
 * Gruppe (z. B. die Welten rechts). Aktiv = Bereichsfarbe getönt (Rezept TIEF) — nie Vollfläche.
 */
export function Reiter<T extends string>({ liste, aktiv, onWahl, farbe = C.aktiv, gruppe, ariaLabel }: { liste: ReiterEintrag<T>[]; aktiv: T | null | undefined; onWahl: (id: T) => void; farbe?: string; gruppe?: boolean; ariaLabel?: string }) {
  const wurzel = useRef<HTMLDivElement>(null);
  // Der aktive Reiter bleibt im sichtbaren Ausschnitt der wischbaren Zeile (nur waagerecht — die Seite scrollt nicht mit).
  useEffect(() => {
    const w = wurzel.current; const el = w?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!w || !el) return;
    const scroller = w.closest<HTMLElement>('.ui-reiter-zeile');
    if (!scroller) return;
    const a = el.getBoundingClientRect(); const s = scroller.getBoundingClientRect();
    if (a.left < s.left + 8 || a.right > s.right - 8) scroller.scrollTo({ left: scroller.scrollLeft + (a.left - s.left) - 16, behavior: 'smooth' });
  }, [aktiv]);
  return (
    <div ref={wurzel} role="tablist" aria-label={ariaLabel} className={`ui-reiter${gruppe ? ' ui-reiter-gruppe' : ''}`}>
      {liste.map(b => {
        const an = aktiv === b.id;
        const f = b.farbe ?? farbe;
        return (
          <button key={b.id} type="button" role="tab" aria-selected={an} onClick={() => onWahl(b.id)} className="ui-reiter-knopf fassbar"
            style={{ border: `1px solid ${an ? TIEF.rand(f) : 'transparent'}`, background: an ? TIEF.flaeche(f) : 'transparent', color: an ? C.ink : C.inkDim, fontFamily: SCHRIFT.text }}>
            {b.farbe && <span aria-hidden className="ui-reiter-punkt" style={{ background: b.farbe }} />}
            {b.label}
          </button>
        );
      })}
    </div>
  );
}

/** Die Hauptaktion des Schritts: am Handy unten mitlaufend (globals.css › .ui-aktion), sonst ganz normal am Ende. */
export function Aktionsleiste({ children }: { children: ReactNode }) {
  const ueber = useTastaturHoehe();
  return <div className={ueber ? 'ui-aktion ui-aktion-tastatur' : 'ui-aktion'} style={ueber ? { bottom: ueber } : undefined}>{children}</div>;
}

/** Am iPhone schiebt die Bildschirmtastatur die Seite nicht hoch — `visualViewport` sagt, wie viel sie verdeckt. Solange ein
 *  Feld getippt wird, sitzt die Hauptaktion direkt über der Tastatur (statt am Ende der Seite). 0 = keine Tastatur/kein Handy. */
function useTastaturHoehe(): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv || !window.matchMedia) return;
    // Handy-Breite live beobachten (Drehen, Split View, Fenster ziehen) — nicht nur beim Öffnen: sonst bliebe die Leiste nach dem Drehen falsch.
    const handy = window.matchMedia('(max-width: 720px)');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const messen = () => {
      if (!handy.matches) { setH(0); return; }
      const a = document.activeElement;
      const tippt = !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !!a.closest('.ui-seite');
      const verdeckt = Math.round(document.documentElement.clientHeight - (vv.offsetTop + vv.height));
      setH(tippt && verdeckt > 120 ? verdeckt : 0);
    };
    // Fokuswechsel kommt vor dem Ausfahren der Tastatur — kurz danach noch einmal messen. Der Timer wird gemerkt und beim Aufräumen gelöscht (kein Setzen nach dem Abbau).
    const spaeter = () => { messen(); if (timer) clearTimeout(timer); timer = setTimeout(messen, 350); };
    vv.addEventListener('resize', messen);
    vv.addEventListener('scroll', messen);
    document.addEventListener('focusin', spaeter);
    document.addEventListener('focusout', spaeter);
    if (handy.addEventListener) handy.addEventListener('change', messen); else handy.addListener?.(messen);
    messen();
    return () => {
      if (timer) clearTimeout(timer);
      vv.removeEventListener('resize', messen); vv.removeEventListener('scroll', messen);
      document.removeEventListener('focusin', spaeter); document.removeEventListener('focusout', spaeter);
      if (handy.removeEventListener) handy.removeEventListener('change', messen); else handy.removeListener?.(messen);
    };
  }, []);
  return h;
}
