'use client';

// ─── MAKE OS — Bausteine der schlanken Oberfläche (23.09.) ──────────────────
// Whoops Regeln in Bauteilen: keine Rahmen, Haarlinien, eine Schrift, große
// Zahlen, kleine Labels in normaler Schrift, nie eine Null. Wer eine Seite
// nach dem neuen Muster baut, nimmt das hier — und sonst nichts.

import type { ReactNode, CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';

export function Seite({ titel, rechts, children, breit = 860 }: { titel: ReactNode; rechts?: ReactNode; children: ReactNode; breit?: number }) {
  return (
    <div style={{ maxWidth: breit, margin: '0 auto', padding: '34px clamp(20px,4vw,56px) 60px', color: C.ink, fontFamily: SCHRIFT.text }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 26 }}>
        <h1 style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 22, letterSpacing: '-.02em', margin: 0 }}>{titel}</h1>
        {rechts}
      </div>
      {children}
    </div>
  );
}

export function Ueberschrift({ children, rechts }: { children: ReactNode; rechts?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '30px 0 6px' }}>
      <h2 style={{ fontSize: 12, fontWeight: 600, color: C.inkLeise, letterSpacing: '.04em', textTransform: 'uppercase', margin: 0 }}>{children}</h2>
      {rechts && <span style={{ fontSize: 12, color: C.inkLeise }}>{rechts}</span>}
    </div>
  );
}

export function Liste({ children }: { children: ReactNode }) {
  return <div style={{ borderTop: `1px solid ${C.linie}` }}>{children}</div>;
}

export function Zeile({ links, titel, unter, rechts, onClick, aktiv }: {
  links?: ReactNode; titel: ReactNode; unter?: ReactNode; rechts?: ReactNode; onClick?: () => void; aktiv?: boolean;
}) {
  return (
    <div onClick={onClick} className={onClick ? 'fassbar' : undefined} style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 2px', borderBottom: `1px solid ${C.linie}`, minHeight: 48,
      cursor: onClick ? 'pointer' : 'default', background: aktiv ? C.flaeche : 'transparent', borderRadius: aktiv ? 8 : 0,
    }}>
      {links}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: TYP.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titel}</div>
        {unter && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unter}</div>}
      </div>
      {rechts}
    </div>
  );
}

export function Segmente<T extends string>({ liste, aktiv, onWahl }: { liste: { id: T; label: string }[]; aktiv: T; onWahl: (id: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 2, background: C.flaeche, borderRadius: 10, padding: 3 }}>
      {liste.map(s => (
        <button key={s.id} onClick={() => onWahl(s.id)} style={{ padding: '6px 13px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, background: aktiv === s.id ? C.grund : 'transparent', color: aktiv === s.id ? C.ink : C.inkDim }}>{s.label}</button>
      ))}
    </div>
  );
}

export function Leer({ children }: { children: ReactNode }) {
  return <div style={{ padding: '18px 2px', color: C.inkLeise, fontSize: TYP.bedien, lineHeight: 1.5 }}>{children}</div>;
}

/** Ein Punkt in Zustandsfarbe — Priorität, Stufe, Lage. */
export function Punkt({ farbe, groesse = 8 }: { farbe: string; groesse?: number }) {
  return <span style={{ width: groesse, height: groesse, borderRadius: '50%', background: farbe, flex: '0 0 auto', display: 'inline-block' }} />;
}

export function Haken({ an, onChange, farbe }: { an: boolean; onChange: () => void; farbe?: string }) {
  return (
    <button onClick={e => { e.stopPropagation(); onChange(); }} aria-label={an ? 'erledigt' : 'offen'} style={{
      width: 22, height: 22, borderRadius: 7, flex: '0 0 auto', cursor: 'pointer', display: 'grid', placeItems: 'center',
      border: `1.5px solid ${an ? C.aktiv : (farbe ?? C.inkLeise)}`, background: an ? C.aktiv : 'transparent', color: C.grund, fontSize: 12, fontWeight: 700,
    }}>{an ? '✓' : ''}</button>
  );
}

export function Knopf({ children, onClick, leise, aus }: { children: ReactNode; onClick?: () => void; leise?: boolean; aus?: boolean }) {
  return (
    <button onClick={onClick} disabled={aus} className="fassbar" style={{
      fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, padding: '8px 14px', borderRadius: 9, cursor: aus ? 'default' : 'pointer',
      border: leise ? `1px solid ${C.linie}` : 'none', background: leise ? 'transparent' : aus ? C.linie : C.aktiv, color: leise ? C.inkDim : aus ? C.inkLeise : C.grund,
    }}>{children}</button>
  );
}

export const feld: CSSProperties = {
  width: '100%', background: 'transparent', border: 0, borderBottom: `1px solid ${C.linie}`, padding: '11px 2px',
  color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.body, outline: 'none',
};

export function Ring({ wert, einheit, label, farbe, anteil, klein }: { wert?: string; einheit?: string; label: string; farbe: string; anteil?: number; klein?: boolean }) {
  const r = 52, u = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '10px 0' }}>
      <svg viewBox="0 0 120 120" style={{ width: klein ? 'clamp(88px, 12vw, 110px)' : 'clamp(96px, 14vw, 124px)', height: 'auto' }} aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke={C.linie} strokeWidth="8" />
        {anteil != null && <circle cx="60" cy="60" r={r} fill="none" stroke={farbe} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={u.toFixed(1)} strokeDashoffset={(u * (1 - Math.max(0, Math.min(1, anteil)))).toFixed(1)} transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.22,1,.36,1)' }} />}
      </svg>
      <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: klein ? 'clamp(26px,3.5vw,32px)' : 'clamp(30px, 4vw, 38px)', letterSpacing: '-.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: wert == null ? C.inkLeise : C.ink }}>
        {wert ?? '—'}{wert != null && einheit && <span style={{ fontSize: 15, fontWeight: 600, color: C.inkDim, marginLeft: 2 }}>{einheit}</span>}
      </div>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{label}</div>
    </div>
  );
}

export const zoneFarbe = (v?: number | null) => (v == null ? C.inkLeise : v >= 66 ? C.gut : v >= 40 ? C.achtung : C.kritisch);
export const prioFarbe = (p: string) => (p === 'critical' ? C.kritisch : p === 'high' ? C.achtung : C.inkLeise);
