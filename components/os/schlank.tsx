'use client';

// ─── MAKE OS — Bausteine der lebendigen Oberfläche ──────────────────────────
// 23.09.: schlank (eine Ebene, keine Rahmen, große Zahlen, nie eine Null).
// 24.09.: lebendig — Kevin: „das sieht tot aus, ich soll doch Spaß haben, da
// reinzugucken." Whoops Rezept dazu: dunkle Karten mit Tiefe, leuchtende
// Kennzahlfarben, Ringe mit Glow, Zahlen, die hochzählen, Trendbalken, und
// alles erscheint gestaffelt. Wer eine Seite baut, nimmt das hier.

import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import { FARBE as C, LEUCHT, SCHRIFT, TYP, leuchtFarbe } from '@/lib/make-one/design';

export { LEUCHT };

/**
 * Breite der Arbeitsfläche (24.09., Kevin: „das Ganze ist jetzt nur in der
 * Mitte"). Vorher 900 px und eine Kartenspalte — auf einem breiten Bildschirm
 * blieb links und rechts die Hälfte leer. Jetzt bis 1440 px; der
 * Wachstums-Kopf nimmt dieselbe Breite, damit beide Kanten übereinander stehen.
 */
export const SEITE_BREIT = 1440;
/** Ab dieser Fensterbreite stehen Spalten nebeneinander (200 px Leiste + ~1000 px Fläche). */
export const SPALTEN_AB = 1180;
const HAAR = 'rgba(255,255,255,.06)';

export function Seite({ titel, unter, rechts, children, breit = SEITE_BREIT }: { titel: ReactNode; unter?: ReactNode; rechts?: ReactNode; children: ReactNode; breit?: number }) {
  return (
    <div style={{ maxWidth: breit, margin: '0 auto', padding: '30px clamp(18px,4vw,48px) 72px', color: C.ink, fontFamily: SCHRIFT.text }}>
      <div className="os-auf" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 'clamp(24px,3vw,30px)', letterSpacing: '-.025em', margin: 0, lineHeight: 1.1 }}>{titel}</h1>
          {unter && <div style={{ fontSize: TYP.body, color: C.inkDim, marginTop: 6 }}>{unter}</div>}
        </div>
        {rechts}
      </div>
      <div className="karten">{children}</div>
    </div>
  );
}

/** Eine Karte — dunkle Fläche mit Tiefe. `i` staffelt das Erscheinen, `akzent` legt einen farbigen Hauch an den Rand. */
export function Karte({ children, i = 0, akzent, style }: { children: ReactNode; i?: number; akzent?: string; style?: CSSProperties }) {
  return (
    <section className="karte os-auf" style={{ ['--i' as string]: i, ...(akzent ? { boxShadow: `inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35), inset 0 0 0 1px ${akzent}26, 0 0 40px -12px ${akzent}55` } : {}), ...style }}>
      {children}
    </section>
  );
}

/**
 * Dashboard-Aufteilung: zwei Spalten, die auf dem Handy untereinander stehen.
 * `verhaeltnis` 2:1 für Hauptsache + Seitenleiste, 1:1 für Gleichgewichtiges.
 * Jede Spalte stapelt ihre Karten für sich — nichts springt, wenn eine Karte
 * aufklappt, und es entstehen keine Löcher wie in einem starren Raster.
 */
export function Spalten({ children, verhaeltnis = '1:1' }: { children: ReactNode; verhaeltnis?: '1:1' | '2:1' | '1:2' | '3:2' }) {
  return <div className={`spalten spalten-${verhaeltnis.replace(':', '-')}`}>{children}</div>;
}
/** Eine Spalte in `Spalten`. `klebt` hält sie beim Scrollen oben (Lesefenster). */
export function Spalte({ children, klebt }: { children: ReactNode; klebt?: boolean }) {
  return <div className={`spalte${klebt ? ' spalte-klebt' : ''}`}>{children}</div>;
}
/** Gleich breite Karten nebeneinander, so viele, wie passen (`min` = Mindestbreite je Karte). */
export function Raster({ children, min = 360 }: { children: ReactNode; min?: number }) {
  return <div className="raster" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${min}px), 1fr))` }}>{children}</div>;
}
/** Teilt eine Liste abwechselnd auf zwei Spalten — für viele gleichartige Karten (Abteilungen, Gruppen). */
export function aufZwei<T>(liste: T[]): [T[], T[]] {
  return [liste.filter((_, i) => i % 2 === 0), liste.filter((_, i) => i % 2 === 1)];
}
/** Ist genug Platz für Spalten? Für Ansichten, die sich dann anders verhalten (Lesefenster statt Aufklappen). */
export function useBreit(): boolean {
  const [breit, setBreit] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${SPALTEN_AB}px)`);
    const an = () => setBreit(mq.matches);
    an(); mq.addEventListener('change', an);
    return () => mq.removeEventListener('change', an);
  }, []);
  return breit;
}

export function Ueberschrift({ children, rechts, farbe }: { children: ReactNode; rechts?: ReactNode; farbe?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, margin: '0 0 10px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: C.inkDim, letterSpacing: '.08em', textTransform: 'uppercase', margin: 0 }}>
        {farbe && <span style={{ width: 8, height: 8, borderRadius: '50%', background: farbe, boxShadow: `0 0 8px ${farbe}` }} />}{children}
      </h2>
      {rechts && <span style={{ fontSize: 12, color: C.inkLeise, display: 'flex', gap: 12, alignItems: 'center' }}>{rechts}</span>}
    </div>
  );
}

export function Liste({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

export function Zeile({ links, titel, unter, rechts, onClick, aktiv }: {
  links?: ReactNode; titel: ReactNode; unter?: ReactNode; rechts?: ReactNode; onClick?: () => void; aktiv?: boolean;
}) {
  return (
    <div onClick={onClick} className={`zeile${onClick ? ' zeile-klick fassbar' : ''}`} style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: onClick ? '11px 6px' : '11px 2px', margin: onClick ? '0 -6px' : 0, borderBottom: `1px solid ${HAAR}`, minHeight: 50,
      cursor: onClick ? 'pointer' : 'default', background: aktiv ? 'rgba(255,255,255,.05)' : 'transparent', borderRadius: aktiv ? 10 : 0,
    }}>
      {links}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: TYP.body, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titel}</div>
        {unter && <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unter}</div>}
      </div>
      {rechts}
    </div>
  );
}

export function Segmente<T extends string>({ liste, aktiv, onWahl }: { liste: { id: T; label: string }[]; aktiv: T; onWahl: (id: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: 3 }}>
      {liste.map(s => (
        <button key={s.id} onClick={() => onWahl(s.id)} style={{ padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, transition: 'background .2s ease, color .2s ease', background: aktiv === s.id ? C.ink : 'transparent', color: aktiv === s.id ? C.grund : C.inkDim }}>{s.label}</button>
      ))}
    </div>
  );
}

export function Leer({ children }: { children: ReactNode }) {
  return <div style={{ padding: '14px 2px', color: C.inkLeise, fontSize: TYP.bedien, lineHeight: 1.55 }}>{children}</div>;
}

/** Ein leuchtender Punkt in Zustandsfarbe. */
export function Punkt({ farbe, groesse = 9 }: { farbe: string; groesse?: number }) {
  const leise = farbe === C.inkLeise || farbe === C.linie;
  return <span style={{ width: groesse, height: groesse, borderRadius: '50%', background: farbe, flex: '0 0 auto', display: 'inline-block', boxShadow: leise ? undefined : `0 0 10px ${farbe}99` }} />;
}

/** Pille in Kennzahlfarbe — „Grün", „Prio A", „3 offen". */
export function Chip({ farbe, children }: { farbe: string; children: ReactNode }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${farbe}22`, color: farbe, borderRadius: 999, padding: '4px 11px', fontSize: 12, fontWeight: 700, letterSpacing: '.02em', whiteSpace: 'nowrap' }}>{children}</span>;
}

export function Haken({ an, onChange, farbe }: { an: boolean; onChange: () => void; farbe?: string }) {
  const f = farbe ?? C.inkLeise;
  return (
    <button onClick={e => { e.stopPropagation(); onChange(); }} aria-label={an ? 'erledigt' : 'offen'} className="fassbar" style={{
      width: 24, height: 24, borderRadius: 8, flex: '0 0 auto', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'background .2s ease, box-shadow .2s ease',
      border: `2px solid ${an ? LEUCHT.gut : f}`, background: an ? LEUCHT.gut : 'transparent', color: C.grund, fontSize: 13, fontWeight: 800, boxShadow: an ? `0 0 12px ${LEUCHT.gut}88` : undefined,
    }}>{an ? '✓' : ''}</button>
  );
}

export function Knopf({ children, onClick, leise, aus, farbe }: { children: ReactNode; onClick?: () => void; leise?: boolean; aus?: boolean; farbe?: string }) {
  const f = farbe ?? C.aktiv;
  return (
    <button onClick={onClick} disabled={aus} className="fassbar" style={{
      fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: '9px 15px', borderRadius: 11, cursor: aus ? 'default' : 'pointer', transition: 'transform .15s ease, box-shadow .2s ease',
      border: leise ? '1px solid rgba(255,255,255,.1)' : 'none', background: leise ? 'rgba(255,255,255,.04)' : aus ? 'rgba(255,255,255,.08)' : f, color: leise ? C.ink : aus ? C.inkLeise : C.grund,
      boxShadow: !leise && !aus ? `0 6px 18px -6px ${f}99` : undefined,
    }}>{children}</button>
  );
}

export const feld: CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '11px 14px',
  color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.body, outline: 'none',
};

/** Zahl, die beim Öffnen hochzählt — „6,2" bleibt „6,2", „81" wird von 0 an gezählt. */
export function useHochzaehlen(text?: string, dauer = 900): string | undefined {
  const [anzeige, setAnzeige] = useState<string | undefined>(text);
  useEffect(() => {
    if (text == null) { setAnzeige(undefined); return; }
    const ruhig = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (ruhig || !/^-?\d+([.,]\d+)?$/.test(text)) { setAnzeige(text); return; }
    const komma = text.includes(','); const dez = (text.split(/[.,]/)[1] ?? '').length; const ziel = Number(text.replace(',', '.'));
    const start = performance.now(); let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dauer); const e = 1 - Math.pow(1 - p, 3);
      const v = (ziel * e).toFixed(dez); setAnzeige(komma ? v.replace('.', ',') : v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, dauer]);
  return anzeige;
}

/** Der Ring — Zahl innen, Glow in der Kennzahlfarbe, füllt sich beim Öffnen. */
export function Ring({ wert, einheit, label, farbe, anteil, groesse = 'normal', unter }: {
  wert?: string; einheit?: string; label: string; farbe: string; anteil?: number; groesse?: 'klein' | 'normal' | 'gross'; unter?: ReactNode;
}) {
  const [an, setAn] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setAn(true)); return () => cancelAnimationFrame(t); }, []);
  const zahl = useHochzaehlen(wert);
  const r = 52, u = 2 * Math.PI * r;
  const ziel = anteil != null ? Math.max(0.02, Math.min(1, anteil)) : 0;
  const px = groesse === 'gross' ? 'clamp(150px, 20vw, 190px)' : groesse === 'klein' ? 'clamp(58px, 9vw, 72px)' : 'clamp(104px, 13vw, 128px)';
  const fs = groesse === 'gross' ? 'clamp(40px,5vw,52px)' : groesse === 'klein' ? 'clamp(15px,2vw,18px)' : 'clamp(26px,3.4vw,32px)';
  const hat = wert != null && anteil != null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: groesse === 'klein' ? 6 : 10 }}>
      <div style={{ position: 'relative', width: px, aspectRatio: '1' }}>
        <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', display: 'block', filter: hat ? `drop-shadow(0 0 ${groesse === 'klein' ? 5 : 10}px ${farbe}77)` : undefined }} aria-hidden>
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={groesse === 'klein' ? 8 : 9} />
          {hat && <circle cx="60" cy="60" r={r} fill="none" stroke={farbe} strokeWidth={groesse === 'klein' ? 8 : 9} strokeLinecap="round"
            strokeDasharray={u.toFixed(1)} strokeDashoffset={(u * (1 - (an ? ziel : 0))).toFixed(1)} transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)' }} />}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: fs, letterSpacing: '-.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: wert == null ? C.inkLeise : C.ink }}>
            {zahl ?? '—'}{wert != null && einheit && <span style={{ fontSize: '.42em', fontWeight: 600, color: C.inkDim, marginLeft: 1 }}>{einheit}</span>}
          </div>
        </div>
      </div>
      <div style={{ fontSize: groesse === 'klein' ? 11.5 : TYP.bedien, fontWeight: 600, color: groesse === 'klein' ? C.inkDim : C.ink, letterSpacing: groesse === 'klein' ? '.02em' : undefined, textAlign: 'center' }}>{label}</div>
      {unter}
    </div>
  );
}

/** Trendbalken — sieben oder vierzehn Tage, der letzte leuchtet. */
export function Balken({ werte, max, farbe, hoehe = 44, titel }: { werte: (number | null)[]; max: number; farbe: string; hoehe?: number; titel?: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: hoehe }}>
      {werte.map((w, i) => {
        const letzte = i === werte.length - 1;
        const h = w == null ? 3 : Math.max(3, Math.round((Math.min(w, max) / max) * hoehe));
        return <div key={i} className="balken-auf" title={titel?.[i]} style={{ ['--i' as string]: i, flex: 1, height: h, borderRadius: 3, background: w == null ? 'rgba(255,255,255,.08)' : farbe, opacity: w == null ? 1 : letzte ? 1 : .5, boxShadow: letzte && w != null ? `0 0 10px ${farbe}99` : undefined }} />;
      })}
    </div>
  );
}

/** Große Zahl mit Beschriftung — hochzählend. */
export function Zahl({ wert, label, farbe, gross }: { wert?: string; label: ReactNode; farbe?: string; gross?: boolean }) {
  const z = useHochzaehlen(wert);
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: gross ? 'clamp(38px,5.5vw,52px)' : 'clamp(20px,2.6vw,24px)', letterSpacing: '-.03em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', color: wert == null ? C.inkLeise : farbe ?? C.ink, textShadow: gross && farbe ? `0 0 24px ${farbe}55` : undefined }}>{z ?? '—'}</div>
      <div style={{ fontSize: 12.5, color: C.inkDim, marginTop: 4 }}>{label}</div>
    </div>
  );
}

/** Fortschrittsbalken in Kennzahlfarbe. */
export function Fortschritt({ anteil, farbe }: { anteil: number; farbe: string }) {
  const [an, setAn] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setAn(true)); return () => cancelAnimationFrame(t); }, []);
  return (
    <div style={{ height: 8, background: 'rgba(255,255,255,.07)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${Math.round(Math.max(0, Math.min(1, an ? anteil : 0)) * 100)}%`, height: '100%', background: farbe, borderRadius: 4, boxShadow: `0 0 12px ${farbe}88`, transition: 'width 1s cubic-bezier(.22,1,.36,1)' }} />
    </div>
  );
}

export const zoneFarbe = (v?: number | null) => leuchtFarbe(v);
export const prioFarbe = (p: string) => (p === 'critical' ? LEUCHT.kritisch : p === 'high' ? LEUCHT.achtung : p === 'medium' ? LEUCHT.puls : C.inkLeise);
