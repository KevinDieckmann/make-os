'use client';

// ─── Standard · Flächen: Seite, Karte, Abschnitt, Kennzahl, Liste (03.10.) ──
// Die Flächen-Hierarchie des Standards: Grund → Fläche (flach) → gehobene Karte. Die Bereichsfarbe tönt nur die EINE Karte, die zählt
// („Heute bei“ in Netzwerken) — sonst bleibt alles neutral. Ablauf der Stile: lib/make-one/design.ts › FLAECHE_STIL, Klassen `ui-*` in globals.css.

import { type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP, TIEF, FLAECHE_STIL, ECKE, LEUCHT } from '@/lib/make-one/design';
import { useHochzaehlen } from '../schlank';

/** Breite der Arbeitsfläche — wie schlank.tsx (bis 1440 px, Kanten wie der Wachstums-Kopf). */
export const SEITE_BREIT = 1440;

/**
 * Die Seite: Titel, ein Satz darunter, rechts die Aktionen, darunter die Karten im Abstand 16.
 * Am Handy wird der Kopf kompakt (Titel 24 px, der Satz höchstens zwei Zeilen, Aktionen neben dem Titel): der Inhalt gehört nach oben.
 * `ui-seite` ist außerdem der Ankerpunkt der Handy-Regeln (Tippziele ≥ 44 px, Eingaben 16 px) in globals.css.
 */
export function Seite({ titel, unter, rechts, children, breit = SEITE_BREIT, ton, className }: { titel: ReactNode; unter?: ReactNode; rechts?: ReactNode; children: ReactNode; breit?: number; ton?: string; className?: string }) {
  return (
    <div className={`ui-seite${className ? ` ${className}` : ''}`} style={{ ['--ui-breit' as string]: `${breit}px`, color: C.ink, fontFamily: SCHRIFT.text }}>
      <header className="ui-kopf os-auf">
        <div className="ui-kopf-text">
          <h1 className="ui-kopf-titel" style={{ fontFamily: SCHRIFT.display }}>{ton && <span aria-hidden className="ui-kopf-punkt" style={{ background: ton }} />}{titel}</h1>
          {unter && <div className="ui-kopf-unter">{unter}</div>}
        </div>
        {rechts && <div className="ui-kopf-aktion">{rechts}</div>}
      </header>
      <div className="ui-karten">{children}</div>
    </div>
  );
}

/**
 * Eine Karte. Standard = gehoben (Verlauf, Lichtkante, Tiefenschatten). `flach` = ein Weißhauch mit Haarrand (Karte in der Karte, Listenblock),
 * `ton` = die Bereichsfarbe als Hauch (die EINE wichtige Karte der Ansicht). `i` staffelt das Erscheinen, `akzent` legt nur einen leisen Rand an.
 */
export function Karte({ children, i = 0, akzent, ton, flach, dicht, style, id, className, onClick, rolle, ariaLabel }: {
  children: ReactNode; i?: number; akzent?: string; ton?: string; flach?: boolean; /** Engerer Innenabstand (Listenkarte, Hero-Karte am Handy). */ dicht?: boolean; style?: CSSProperties; id?: string; className?: string; onClick?: () => void; rolle?: string; ariaLabel?: string;
}) {
  const stufe = ton ? FLAECHE_STIL.getoent(ton) : akzent ? { ...FLAECHE_STIL.gehoben, boxShadow: `${FLAECHE_STIL.gehoben.boxShadow}, inset 0 0 0 1px ${akzent}1F, 0 0 44px -18px ${akzent}40` } : flach ? FLAECHE_STIL.flach : FLAECHE_STIL.gehoben;
  return (
    <section id={id} role={rolle} aria-label={ariaLabel} onClick={onClick} className={`ui-karte${flach && !ton ? ' ui-karte-flach' : ''}${dicht ? ' ui-karte-dicht' : ''}${onClick ? ' ui-karte-klick' : ''} os-auf${className ? ` ${className}` : ''}`}
      style={{ ['--i' as string]: i, ...stufe, ...style }}>
      {children}
    </section>
  );
}

/** Überschrift einer Karte: Beschriftung in GROSSBUCHSTABEN (Mikro-Stufe), optional mit Bereichspunkt, rechts Zusatz (Zähler, Link). */
export function Ueberschrift({ children, rechts, farbe }: { children: ReactNode; rechts?: ReactNode; farbe?: string }) {
  return (
    <div className="ui-abschnitt">
      <h2 className="ui-abschnitt-titel">
        {farbe && <span aria-hidden className="ui-abschnitt-punkt" style={{ background: farbe }} />}{children}
      </h2>
      {rechts && <span className="ui-abschnitt-rechts">{rechts}</span>}
    </div>
  );
}
export const Abschnitt = Ueberschrift;

/** Titel in Anzeigeschrift (20 px) mit einem Satz darunter — für den Kopf einer Karte oder eines Blattes. */
export function Titel({ children, unter, rechts }: { children: ReactNode; unter?: ReactNode; rechts?: ReactNode }) {
  return (
    <div className="ui-titel">
      <div style={{ minWidth: 0, flex: 1 }}>
        <h2 style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, letterSpacing: '-.015em', lineHeight: 1.25, margin: 0, color: C.ink, overflowWrap: 'anywhere' }}>{children}</h2>
        {unter && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 3, lineHeight: 1.45 }}>{unter}</div>}
      </div>
      {rechts}
    </div>
  );
}

/** Beschriftung über einem Feld oder einer Gruppe (Mikro-Stufe). */
export function Beschriftung({ children, rechts }: { children: ReactNode; rechts?: ReactNode }) {
  return <div className="ui-beschriftung"><span>{children}</span>{rechts && <span className="ui-beschriftung-rechts">{rechts}</span>}</div>;
}

/** Kennzahl-Kachel: große Zahl (zählt hoch), Beschriftung darunter; mit `onClick` ein Tippziel. `ton` färbt die Zahl (Zustand!). */
export function Kennzahl({ wert, label, ton, unter, onClick, klein }: { wert?: string; label: ReactNode; ton?: string; unter?: ReactNode; onClick?: () => void; klein?: boolean }) {
  const z = useHochzaehlen(wert);
  const inhalt = (
    <>
      <span className="ui-kennzahl-wert" style={{ fontFamily: SCHRIFT.display, fontSize: klein ? 'clamp(18px,2.4vw,22px)' : 'clamp(22px,2.8vw,28px)', color: wert == null ? C.inkLeise : ton ?? C.ink }}>{z ?? '—'}</span>
      <span className="ui-kennzahl-label">{label}</span>
      {unter && <span className="ui-kennzahl-unter">{unter}</span>}
    </>
  );
  const stil: CSSProperties = { ...FLAECHE_STIL.flach, borderRadius: ECKE.flach };
  return onClick
    ? <button type="button" onClick={onClick} className="ui-kennzahl ui-kennzahl-klick fassbar" style={stil}>{inhalt}</button>
    : <div className="ui-kennzahl" style={stil}>{inhalt}</div>;
}
/** Alter Name aus schlank.tsx (Zahl mit Beschriftung, ohne Fläche) — bleibt für Stellen, an denen die Zahl frei steht. */
export function Zahl({ wert, label, farbe, gross }: { wert?: string; label: ReactNode; farbe?: string; gross?: boolean }) {
  const z = useHochzaehlen(wert);
  return (
    <div className="ui-zahl" style={{ minWidth: 0 }}>
      <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: gross ? 'clamp(38px,5.5vw,52px)' : 'clamp(20px,2.6vw,24px)', letterSpacing: '-.03em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', color: wert == null ? C.inkLeise : farbe ?? C.ink }}>{z ?? '—'}</div>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 4 }}>{label}</div>
    </div>
  );
}

export function Liste({ children }: { children: ReactNode }) {
  return <div className="ui-liste">{children}</div>;
}

/**
 * Eine Zeile einer Liste: links Symbol/Kürzel, Titel + ein Zusatz, rechts Zustand. Mit `onClick` ein Tippziel (≥ 44 px) mit Pfeil, wenn rechts nichts steht.
 * `umbrechen`: lange Titel brechen um (Dialoge am Handy), sonst werden sie abgeschnitten.
 */
export function Zeile({ links, titel, unter, rechts, onClick, aktiv, umbrechen }: {
  links?: ReactNode; titel: ReactNode; unter?: ReactNode; rechts?: ReactNode; onClick?: () => void; aktiv?: boolean; umbrechen?: boolean;
}) {
  const kurz = umbrechen ? { overflowWrap: 'anywhere' as const } : { overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const };
  return (
    <div onClick={onClick} className={`ui-zeile zeile${onClick ? ' ui-zeile-klick zeile-klick fassbar' : ''}${aktiv ? ' ui-zeile-aktiv' : ''}`}>
      {links}
      <div className="ui-zeile-text">
        <div className="ui-zeile-titel" style={kurz}>{titel}</div>
        {unter && <div className="ui-zeile-unter" style={kurz}>{unter}</div>}
      </div>
      {rechts && <div className="ui-zeile-rechts">{rechts}</div>}
      {onClick && !rechts && <span aria-hidden className="ui-zeile-pfeil">›</span>}
    </div>
  );
}

/** Zwei Spalten „Beschriftung · Wert“ (Akte, Eigenschaften) — am Handy steht die Beschriftung über dem Wert. */
export function Eigenschaft({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ui-eigenschaft">
      <span className="ui-eigenschaft-label">{label}</span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

/** Kreis mit den Anfangsbuchstaben einer Person — tiefer Akzent statt Neon (Rezept TIEF). */
export function Initialen({ name, farbe = LEUCHT.beziehung, groesse = 40 }: { name: string; farbe?: string; groesse?: number }) {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  const kuerzel = ((teile[0]?.[0] ?? '?') + (teile.length > 1 ? teile[teile.length - 1][0] : '')).toUpperCase();
  return <span aria-hidden style={{ width: groesse, height: groesse, borderRadius: groesse / 2, flex: '0 0 auto', display: 'grid', placeItems: 'center', fontFamily: SCHRIFT.display, fontSize: groesse > 36 ? 15 : 13, fontWeight: 700, color: farbe, background: TIEF.flaeche(farbe), border: `1px solid ${TIEF.rand(farbe)}` }}>{kuerzel}</span>;
}

/** Fortschrittsbalken in Kennzahlfarbe (Verlauf vom tiefen Ton in die volle Farbe); füllt sich beim Öffnen, bei „Bewegung reduzieren“ steht er sofort. */
export function Fortschritt({ anteil, farbe }: { anteil: number; farbe: string }) {
  const p = Math.round(Math.max(0, Math.min(1, anteil)) * 100);
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p} style={{ height: 8, background: 'rgba(255,255,255,.07)', borderRadius: 4, overflow: 'hidden' }}>
      <div className="ui-fuell" style={{ width: `${p}%`, height: '100%', background: TIEF.verlauf(farbe), borderRadius: 4 }} />
    </div>
  );
}

/**
 * Gleich breite Karten oder Kennzahlen nebeneinander, so viele, wie passen (`min` = Mindestbreite je Eintrag). Ab `min` ≤ 180 ist es ein Kennzahl-Raster:
 * `Zahl` steht darin als flache Kachel (ui-raster-kacheln, globals.css) und am Handy passen zwei nebeneinander.
 */
export function Raster({ children, min = 360 }: { children: ReactNode; min?: number }) {
  const kacheln = min <= 180;
  const m = kacheln ? Math.round(min * 0.8) : min;
  return <div className={`raster${kacheln ? ' ui-raster-kacheln' : ''}`} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${m}px), 1fr))` }}>{children}</div>;
}
