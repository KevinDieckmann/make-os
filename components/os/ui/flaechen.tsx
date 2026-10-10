'use client';

// ─── Standard · Flächen: Seite, Karte, Abschnitt, Kennzahl, Liste (03.10.) ──
// Die Flächen-Hierarchie des Standards: Grund → Fläche (flach) → gehobene Karte. Die Bereichsfarbe tönt nur die EINE Karte, die zählt
// („Heute bei“ in Netzwerken) — sonst bleibt alles neutral. Ablauf der Stile: lib/make-one/design.ts › FLAECHE_STIL, Klassen `ui-*` in globals.css.

import { useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP, TIEF, FLAECHE_STIL, ECKE, LEUCHT, FOKUS_LICHT, FOKUS_STIL } from '@/lib/make-one/design';
import { abschnitteVon, type ErklaerungsQuelle } from '@/lib/erklaerungen';
import { useHochzaehlen } from '../schlank';
import { FokusKante, NetzMotiv } from './fokus';
import { ErklaerKnopf, ErklaerPanel, ErklaerZeichen, ZeileErklaerung, useErklaerung } from './erklaerung';

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
 * `ton="fokus"` (Fokus-Signatur, 04.10.): gläserner, minimal hellerer Grund, feine Kante, über die ein Lichtfaden langsam von links nach
 * rechts läuft — in `licht` (Standard: das Fokus-Cyan, sonst die Bereichsfarbe); `netz` legt das kleine Netz-Motiv in die Ecke.
 * Höchstens EINE Fokus-Karte je Ansicht (DESIGN_STANDARD.md › Fokus-Signatur).
 */
export function Karte({ children, i = 0, akzent, ton, licht, netz, flach, dicht, style, id, className, onClick, rolle, ariaLabel }: {
  children: ReactNode; i?: number; akzent?: string; ton?: string; /** Lichtfarbe der Fokus-Karte (`ton="fokus"`). */ licht?: string; /** Netz-Motiv in der Ecke der Fokus-Karte. */ netz?: boolean; flach?: boolean; /** Engerer Innenabstand (Listenkarte, Hero-Karte am Handy). */ dicht?: boolean; style?: CSSProperties; id?: string; className?: string; onClick?: () => void; rolle?: string; ariaLabel?: string;
}) {
  const fokus = ton === 'fokus';
  const lichtFarbe = licht ?? FOKUS_LICHT;
  const stufe = fokus ? FOKUS_STIL.karte(lichtFarbe) : ton ? FLAECHE_STIL.getoent(ton) : akzent ? { ...FLAECHE_STIL.gehoben, boxShadow: `${FLAECHE_STIL.gehoben.boxShadow}, inset 0 0 0 1px ${akzent}1F, 0 0 44px -18px ${akzent}40` } : flach ? FLAECHE_STIL.flach : FLAECHE_STIL.gehoben;
  return (
    <section id={id} role={rolle} aria-label={ariaLabel} onClick={onClick} className={`ui-karte${flach && !ton ? ' ui-karte-flach' : ''}${fokus ? ' ui-karte-fokus' : ''}${dicht ? ' ui-karte-dicht' : ''}${onClick ? ' ui-karte-klick' : ''} os-auf${className ? ` ${className}` : ''}`}
      style={{ ['--i' as string]: i, ...stufe, ...style }}>
      {fokus && <FokusKante farbe={lichtFarbe} />}
      {fokus && netz && <NetzMotiv farbe={lichtFarbe} />}
      {children}
    </section>
  );
}

/**
 * Überschrift einer Karte: Beschriftung in GROSSBUCHSTABEN (Mikro-Stufe), optional mit Bereichspunkt, rechts Zusatz (Zähler, Link).
 * Mit `erklaerung` (10.10.) steht hinter dem Titel ein „i“; die Erklärung (Was es bedeutet · Beispiel …) klappt unter der Überschrift auf.
 */
export function Ueberschrift({ children, rechts, farbe, erklaerung }: { children: ReactNode; rechts?: ReactNode; farbe?: string; erklaerung?: ErklaerungsQuelle }) {
  const e = useErklaerung();
  const abschnitte = erklaerung ? abschnitteVon(erklaerung) : [];
  return (
    <>
      <div className="ui-abschnitt">
        <h2 className="ui-abschnitt-titel">
          {farbe && <span aria-hidden className="ui-abschnitt-punkt" style={{ background: farbe }} />}{children}
          {abschnitte.length > 0 && <ErklaerKnopf offen={e.offen} onClick={e.umschalten} id={e.id} name={typeof children === 'string' ? children : undefined} />}
        </h2>
        {rechts && <span className="ui-abschnitt-rechts">{rechts}</span>}
      </div>
      {e.offen && abschnitte.length > 0 && <div style={{ marginBottom: 12 }}><ErklaerPanel id={e.id} abschnitte={abschnitte} /></div>}
    </>
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

/** Beschriftung über einem Feld oder einer Gruppe (Mikro-Stufe). Mit `erklaerung` (10.10.): „i“ dahinter, die Erklärung klappt darunter auf. */
export function Beschriftung({ children, rechts, erklaerung }: { children: ReactNode; rechts?: ReactNode; erklaerung?: ErklaerungsQuelle }) {
  const e = useErklaerung();
  const abschnitte = erklaerung ? abschnitteVon(erklaerung) : [];
  return (
    <>
      <div className="ui-beschriftung">
        <span>{children}{abschnitte.length > 0 && <ErklaerKnopf offen={e.offen} onClick={e.umschalten} id={e.id} name={typeof children === 'string' ? children : undefined} />}</span>
        {rechts && <span className="ui-beschriftung-rechts">{rechts}</span>}
      </div>
      {e.offen && abschnitte.length > 0 && <div style={{ marginBottom: 8 }}><ErklaerPanel id={e.id} abschnitte={abschnitte} /></div>}
    </>
  );
}

/**
 * Kennzahl-Kachel: große Zahl (zählt hoch), Beschriftung darunter; mit `onClick` ein Tippziel. `ton` färbt die Zahl (Zustand!).
 * Mit `erklaerung` (10.10.: „Wie gerechnet · Beispiel · Was ihr tun könnt“) ist die Kachel antippbar: die Erklärung klappt in der Kachel auf,
 * die Kachel nimmt dann die ganze Rasterzeile ein. Hat sie schon einen `onClick` (öffnet etwas), bleibt der Klick; das „i“ steht dann oben rechts.
 */
export function Kennzahl({ wert, label, ton, unter, onClick, klein, erklaerung }: { wert?: string; label: ReactNode; ton?: string; unter?: ReactNode; onClick?: () => void; klein?: boolean; erklaerung?: ErklaerungsQuelle }) {
  const z = useHochzaehlen(wert);
  const e = useErklaerung();
  const abschnitte = erklaerung ? abschnitteVon(erklaerung) : [];
  const inhalt = (
    <>
      <span className="ui-kennzahl-wert" style={{ fontFamily: SCHRIFT.display, fontSize: klein ? 'clamp(18px,2.4vw,22px)' : 'clamp(22px,2.8vw,28px)', color: wert == null ? C.inkLeise : ton ?? C.ink }}>{z ?? '—'}</span>
      <span className="ui-kennzahl-label">{label}</span>
      {unter && <span className="ui-kennzahl-unter">{unter}</span>}
    </>
  );
  const stil: CSSProperties = { ...FLAECHE_STIL.flach, borderRadius: ECKE.flach };
  if (abschnitte.length) {
    const name = typeof label === 'string' ? label : undefined;
    const huelle: CSSProperties = { ...stil, position: 'relative', ...(e.offen ? { gridColumn: '1 / -1' } : null) };
    const knopfStil: CSSProperties = { display: 'grid', gap: 2, width: '100%', margin: 0, padding: 0, background: 'none', border: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' };
    return (
      <div className="ui-kennzahl ui-kennzahl-erkl" style={huelle}>
        {onClick
          ? <button type="button" onClick={onClick} className="fassbar" style={knopfStil}>{inhalt}</button>
          : <button type="button" onClick={e.umschalten} aria-expanded={e.offen} aria-controls={e.id} className="fassbar" title="Was bedeutet das?" style={knopfStil}>{inhalt}</button>}
        {onClick
          ? <span style={{ position: 'absolute', top: 0, right: 0 }}><ErklaerKnopf offen={e.offen} onClick={e.umschalten} id={e.id} name={name} /></span>
          : <span style={{ position: 'absolute', top: 12, right: 12 }}><ErklaerZeichen offen={e.offen} /></span>}
        {e.offen && <ErklaerPanel id={e.id} abschnitte={abschnitte} style={{ marginTop: 8 }} />}
      </div>
    );
  }
  return onClick
    ? <button type="button" onClick={onClick} className="ui-kennzahl ui-kennzahl-klick fassbar" style={stil}>{inhalt}</button>
    : <div className="ui-kennzahl" style={stil}>{inhalt}</div>;
}
/** Alter Name aus schlank.tsx (Zahl mit Beschriftung, ohne Fläche) — bleibt für Stellen, an denen die Zahl frei steht. Mit `erklaerung` antippbar (wie `Kennzahl`). */
export function Zahl({ wert, label, farbe, gross, erklaerung }: { wert?: string; label: ReactNode; farbe?: string; gross?: boolean; erklaerung?: ErklaerungsQuelle }) {
  const z = useHochzaehlen(wert);
  const e = useErklaerung();
  const abschnitte = erklaerung ? abschnitteVon(erklaerung) : [];
  const koerper = (
    <>
      <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: gross ? 'clamp(38px,5.5vw,52px)' : 'clamp(20px,2.6vw,24px)', letterSpacing: '-.03em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', color: wert == null ? C.inkLeise : farbe ?? C.ink }}>{z ?? '—'}</div>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 4 }}>{label}{abschnitte.length > 0 && <ErklaerZeichen offen={e.offen} />}</div>
    </>
  );
  if (!abschnitte.length) return <div className="ui-zahl" style={{ minWidth: 0 }}>{koerper}</div>;
  return (
    <div className="ui-zahl ui-zahl-erkl" style={{ minWidth: 0, ...(e.offen ? { gridColumn: '1 / -1' } : null) }}>
      <button type="button" onClick={e.umschalten} aria-expanded={e.offen} aria-controls={e.id} title="Was bedeutet das?" className="fassbar"
        style={{ display: 'block', width: '100%', margin: 0, padding: 0, background: 'none', border: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>{koerper}</button>
      {e.offen && <ErklaerPanel id={e.id} abschnitte={abschnitte} style={{ marginTop: 8 }} />}
    </div>
  );
}

export function Liste({ children }: { children: ReactNode }) {
  return <div className="ui-liste">{children}</div>;
}

/**
 * Eine Zeile einer Liste: links Symbol/Kürzel, Titel + ein Zusatz, rechts Zustand. Mit `onClick` ein Tippziel (≥ 44 px) mit Pfeil, wenn rechts nichts steht.
 * `umbrechen`: lange Titel brechen um (Dialoge am Handy), sonst werden sie abgeschnitten.
 * `erklaerung` (10.10.): der TITEL der Zeile klappt die Erklärung (Was es bedeutet · Beispiel …) darunter auf — „die Zeile antippen, nicht den
 * Schalter“. Ein `Schalter` in `rechts` meldet seine Erklärung selbst an die Zeile. Ist die Zeile ein Tippziel (`onClick`), steht stattdessen ein „i“ vor `rechts`.
 */
export function Zeile({ links, titel, unter, rechts, onClick, aktiv, umbrechen, erklaerung }: {
  links?: ReactNode; titel: ReactNode; unter?: ReactNode; rechts?: ReactNode; onClick?: () => void; aktiv?: boolean; umbrechen?: boolean; erklaerung?: ErklaerungsQuelle;
}) {
  const kurz = umbrechen ? { overflowWrap: 'anywhere' as const } : { overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const };
  const [vomKind, setVomKind] = useState<ErklaerungsQuelle | null>(null);
  const melden = useCallback((q: ErklaerungsQuelle | null) => setVomKind(q), []);
  const e = useErklaerung();
  const q = erklaerung ?? vomKind;
  const abschnitte = q ? abschnitteVon(q) : [];
  const titelKnopf = abschnitte.length > 0 && !onClick;
  const text = (
    <>
      <div className="ui-zeile-titel" style={kurz}>{titel}{titelKnopf && <ErklaerZeichen offen={e.offen} />}</div>
      {unter && <div className="ui-zeile-unter" style={kurz}>{unter}</div>}
    </>
  );
  return (
    <div onClick={onClick} className={`ui-zeile zeile${onClick ? ' ui-zeile-klick zeile-klick fassbar' : ''}${aktiv ? ' ui-zeile-aktiv' : ''}`}>
      {links}
      {titelKnopf
        ? <div className="ui-zeile-text ui-zeile-erkl" role="button" tabIndex={0} aria-expanded={e.offen} aria-controls={e.id} title="Was bedeutet das?" style={{ cursor: 'pointer' }}
          onClick={e.umschalten} onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); e.umschalten(); } }}>{text}</div>
        : <div className="ui-zeile-text">{text}</div>}
      {(rechts || (abschnitte.length > 0 && onClick)) && (
        <div className="ui-zeile-rechts">
          {abschnitte.length > 0 && onClick && <ErklaerKnopf offen={e.offen} onClick={e.umschalten} id={e.id} name={typeof titel === 'string' ? titel : undefined} />}
          <ZeileErklaerung.Provider value={onClick ? null : melden}>{rechts}</ZeileErklaerung.Provider>
        </div>
      )}
      {onClick && !rechts && abschnitte.length === 0 && <span aria-hidden className="ui-zeile-pfeil">›</span>}
      {e.offen && abschnitte.length > 0 && <ErklaerPanel id={e.id} abschnitte={abschnitte} style={{ flex: '1 0 100%', marginBottom: 4 }} />}
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
