'use client';

// ─── Unternehmen › „in einem Blick“ · gemeinsame Zeichen (11.10.) ───────────────────────────────────────────────────────────────────
// Schild-Zeichen (Ton als Form + Farbe + Symbol — nie Farbe allein), Dimensions-Balken, „Was sehe ich?“-Satz, Zeile eines Handgriffs. Ruhige Tonalität:
// rot nur bei drohender Folge, gelb „bald“, sonst neutral (Regel: lib/gesellschaften/schild/blick.ts). Zeichnen nur — gerechnet wird in lib/.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { FARBE as C, TYP, LEUCHT, TIEF, RAND, SCHRIFT } from '@/lib/make-one/design';
import { TON_TEXT, type Dimension, type Handgriff, type Ton } from '@/lib/gesellschaften/schild/blick';
import { tagText } from '@/lib/gesellschaften/schild/zeit';

export const TON_FARBE: Record<Ton, string> = { rot: LEUCHT.kritisch, gelb: LEUCHT.achtung, ruhig: C.inkDim, gruen: LEUCHT.gut };
export const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;
export const beschriftung = { fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600 } as const;

/** Das Schild-Zeichen: Form eines Schilds, getönt in der Farbe des Tons, mit Symbol (✓ · ! · Uhr · Punkte) — lesbar auch ohne Farbe. */
export function SchildZeichen({ ton, groesse = 44, titel }: { ton: Ton; groesse?: number; titel?: string }) {
  const f = TON_FARBE[ton];
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 48 48" role="img" aria-label={titel ?? `Schild: ${TON_TEXT[ton]}`} style={{ flex: '0 0 auto', display: 'block' }}>
      <path d="M24 3 L41 9 V22 C41 33 33.5 41 24 45 C14.5 41 7 33 7 22 V9 Z" fill={TIEF.flaeche(f)} stroke={TIEF.rand(f)} strokeWidth={1.6} strokeLinejoin="round" />
      {ton === 'gruen' && <path d="M16.5 24.5 L22 30 L32 18.5" fill="none" stroke={f} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}
      {ton === 'rot' && <><path d="M24 14 V27" stroke={f} strokeWidth={3.4} strokeLinecap="round" /><circle cx={24} cy={33.5} r={2.2} fill={f} /></>}
      {ton === 'gelb' && <><circle cx={24} cy={25} r={9} fill="none" stroke={f} strokeWidth={2.6} /><path d="M24 19.5 V25.5 L28 28" fill="none" stroke={f} strokeWidth={2.6} strokeLinecap="round" /></>}
      {ton === 'ruhig' && [17, 24, 31].map(x => <circle key={x} cx={x} cy={25} r={2.3} fill={f} />)}
    </svg>
  );
}

/** Der Ton als Text-Chip (Form + Text, Farbe nur zusätzlich). */
export function TonChip({ ton }: { ton: Ton }) {
  const f = TON_FARBE[ton];
  return <span className="ui-chip" style={{ background: `${f}22`, color: ton === 'ruhig' ? C.ink : f, whiteSpace: 'nowrap' }}>{TON_TEXT[ton]}</span>;
}

/** Eine Dimension als kleiner Balken mit Zahl — die ganze Zeile führt in den Reiter. */
export function DimBalken({ d, href }: { d: Dimension; href: string }) {
  const f = TON_FARBE[d.ton];
  const p = d.anteil === null ? 0 : Math.round(d.anteil * 100);
  return (
    <Link href={href} className="fassbar" style={{ display: 'grid', gridTemplateColumns: 'minmax(72px, 88px) minmax(0, 1fr) auto', gap: 10, alignItems: 'center', minHeight: 44, color: C.ink, textDecoration: 'none' }}
      aria-label={`${d.label}: ${d.zahl}${d.anteil === null ? '' : ` (${p} %)`} — ${TON_TEXT[d.ton]}`}>
      <span style={{ fontSize: TYP.bedien, fontWeight: 600 }}>{d.label}</span>
      <span aria-hidden style={{ position: 'relative', height: 8, borderRadius: 4, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
        {d.anteil !== null && <span style={{ position: 'absolute', inset: 0, width: `${Math.max(4, p)}%`, borderRadius: 4, background: d.ton === 'ruhig' ? 'rgba(255,255,255,.28)' : TIEF.verlauf(f) }} />}
      </span>
      <span style={{ fontSize: TYP.bedien, color: d.ton === 'rot' || d.ton === 'gelb' ? f : C.inkDim, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{d.zahl}</span>
    </Link>
  );
}

/** Der Satz unter jedem Bild: was man sieht — in einem Satz, ohne Fachwort. */
export function WasSeheIch({ children }: { children: ReactNode }) {
  return <p style={{ ...klein, margin: '8px 0 0' }}><strong style={{ color: C.ink, fontWeight: 600 }}>Was sehe ich?</strong> {children}</p>;
}

/** Frist in Worten: „seit 12.03. verstrichen“ · „bis 31.12. (in 20 Tagen)“. */
export function fristText(h: Pick<Handgriff, 'frist' | 'inTagen'>): string | undefined {
  if (!h.frist) return undefined;
  if (h.inTagen === undefined) return `bis ${tagText(h.frist)}`;
  if (h.inTagen < 0) return `seit ${tagText(h.frist)} verstrichen`;
  if (h.inTagen === 0) return 'heute fällig';
  return `bis ${tagText(h.frist)} (in ${h.inTagen} Tag${h.inTagen === 1 ? '' : 'en'})`;
}

/** Ein Handgriff: Ton-Punkt, Klartext vorne, darunter Grund und Frist, die Norm klein dahinter. */
export function HandgriffZeile({ h, mitGesellschaft }: { h: Handgriff; mitGesellschaft?: boolean }) {
  const f = TON_FARBE[h.ton];
  const unter = [mitGesellschaft ? h.gesellschaft : undefined, fristText(h), h.anzahl && h.anzahl > 1 ? `${h.anzahl}×` : undefined, h.warum].filter(Boolean).join(' · ');
  return (
    <Link href={h.weg} className="fassbar" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: 44, padding: '8px 2px', color: C.ink, textDecoration: 'none' }}>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, marginTop: 6, flex: '0 0 auto', background: h.ton === 'ruhig' ? 'transparent' : f, border: `2px solid ${f}` }} />
      <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
        <span style={{ fontSize: TYP.body, fontWeight: 600, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{h.titel}</span>
        {unter && <span style={{ ...klein, overflowWrap: 'anywhere' }}>{unter}{h.norm && h.norm !== '—' ? <span style={{ color: C.inkLeise }}> · {h.norm}</span> : null}</span>}
      </span>
      <span aria-hidden style={{ color: C.inkLeise, marginTop: 2 }}>›</span>
    </Link>
  );
}

/** Legende der Töne — dieselben Wörter wie am Schild. */
export function TonLegende({ toene = ['rot', 'gelb', 'ruhig', 'gruen'] }: { toene?: readonly Ton[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: TYP.bedien, color: C.inkDim }}>
      {toene.map(t => (
        <span key={t} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: t === 'ruhig' ? 'transparent' : TON_FARBE[t], border: `2px solid ${TON_FARBE[t]}` }} />{TON_TEXT[t]}
        </span>
      ))}
    </div>
  );
}

/** Ein Fortschritts-Ring (SVG, fest in der Größe) mit Zahl in der Mitte — für die Vollständigkeit der Dokumente. */
export function KleinRing({ anteil, farbe, mitte, unter, groesse = 96, label }: { anteil: number; farbe: string; mitte: string; unter?: string; groesse?: number; label: string }) {
  const r = 40, u = 2 * Math.PI * r, p = Math.max(0, Math.min(1, anteil));
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 100 100" role="img" aria-label={label} style={{ flex: '0 0 auto', display: 'block', fontFamily: SCHRIFT.display }}>
      <circle cx={50} cy={50} r={r} fill="none" stroke={RAND.stark} strokeWidth={9} />
      {p > 0 && <circle cx={50} cy={50} r={r} fill="none" stroke={farbe} strokeWidth={9} strokeLinecap="round" strokeDasharray={`${Math.max(2, p * u)} ${u}`} transform="rotate(-90 50 50)" />}
      <text x={50} y={unter ? 50 : 56} textAnchor="middle" fontSize={20} fontWeight={700} fill={C.ink}>{mitte}</text>
      {unter && <text x={50} y={68} textAnchor="middle" fontSize={11} fill={C.inkDim}>{unter}</text>}
    </svg>
  );
}
