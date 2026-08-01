'use client';

import Link from 'next/link';
// ─── MAKE OS — UI-Baukasten (Klar·Dark) ─────────────────────────────────────
// Gemeinsame Bausteine für alle Agenten-Views. Eine Quelle statt zwölf Kopien:
// Header, Panel, Label, KPI, Buttons, Zustände. Alles token-getrieben (THEME).

import type { CSSProperties, ReactNode } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';

// ── Basis-Styles ──
export const lbl: CSSProperties = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: T.muted };
export const panelStyle: CSSProperties = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };

export function Lbl({ children, color, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return <div style={{ ...lbl, ...(color ? { color } : {}), ...style }}>{children}</div>;
}

export function Panel({ children, accent, style }: { children: ReactNode; accent?: string; style?: CSSProperties }) {
  return <div style={{ ...panelStyle, ...(accent ? { borderTop: `2px solid ${accent}` } : {}), ...style }}>{children}</div>;
}

// ── Seiten-Header für Agenten-Views ──
export function AgentHeader({ label, badge, badgeColor, title, children, backHref = '/os/agenten', backLabel = '‹ Agenten' }: {
  label: string; badge?: string; badgeColor?: string; title: string; children?: ReactNode; backHref?: string; backLabel?: string;
}) {
  const bc = badgeColor ?? T.accent;
  return (
    <>
      <Link href={backHref} style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>{backLabel}</Link>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <Lbl>{label}</Lbl>
        {badge && <span style={{ fontFamily: T.mono, fontSize: 9.5, color: bc, border: `1px solid ${bc}55`, borderRadius: 5, padding: '2px 7px' }}>{badge}</span>}
      </div>
      <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>{title}</h1>
      {children && <p style={{ fontSize: 13.5, color: T.inkDim, maxWidth: 680, lineHeight: 1.5 }}>{children}</p>}
    </>
  );
}

// ── Seiten-Rahmen ──
export function Page({ children, maxWidth = 900 }: { children: ReactNode; maxWidth?: number }) {
  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>{children}</div>
    </div>
  );
}

// ── KPI-Kachel ──
export function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ ...panelStyle, padding: '12px 16px', minWidth: 140, flex: 1 }}>
      <Lbl>{label}</Lbl>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? T.ink, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Buttons ──
export function PrimaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ fontFamily: T.sans, fontSize: 13.5, fontWeight: 700, padding: '11px 20px', borderRadius: 9, border: 'none', cursor: disabled ? 'default' : 'pointer', background: disabled ? T.line : T.accent, color: disabled ? T.muted : '#04110F' }}>
      {children}
    </button>
  );
}

export function GhostButton({ onClick, disabled, children, color }: { onClick: () => void; disabled?: boolean; children: ReactNode; color?: string }) {
  const c = color ?? T.inkDim;
  return (
    <button onClick={onClick} disabled={disabled} style={{ fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '9px 14px', borderRadius: 9, border: `1px solid ${T.line}`, background: 'transparent', color: c, cursor: disabled ? 'default' : 'pointer' }}>
      {children}
    </button>
  );
}

export function SelectButton({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: ReactNode; color?: string }) {
  const c = color ?? T.accent;
  return (
    <button onClick={onClick} style={{ fontFamily: T.sans, fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${active ? c : T.line}`, background: active ? `${c}22` : 'transparent', color: active ? c : T.inkDim }}>
      {children}
    </button>
  );
}

// ── Kleine Bausteine ──
export function Pill({ children, color }: { children: ReactNode; color: string }) {
  return <span style={{ fontFamily: T.mono, fontSize: 9.5, color, border: `1px solid ${color}55`, borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap' }}>{children}</span>;
}

export function Loading({ text = 'lade …' }: { text?: string }) {
  return <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>{text}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div style={{ ...panelStyle, padding: '22px', textAlign: 'center', color: T.inkDim, fontSize: 13.5, lineHeight: 1.5 }}>{children}</div>;
}

export function BulletRow({ icon, color, children }: { icon: string; color: string; children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, fontSize: 13, color: T.inkDim, lineHeight: 1.5, marginTop: 3 }}><span style={{ color, flex: '0 0 auto' }}>{icon}</span>{children}</div>;
}

/** Heute als YYYY-MM-DD in LOKALER Zeit — EINE Quelle statt hartkodierter
 *  Konstanten. Bewusst nicht toISOString(): das liefert UTC und damit nachts
 *  (00:00–02:00 MESZ) den Vortag — Tages-Keys landeten sonst am falschen Tag. */
export { localDay as todayISO } from '@/lib/zeit';
