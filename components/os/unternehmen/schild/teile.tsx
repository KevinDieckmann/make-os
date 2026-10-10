'use client';

// ─── Unternehmen › Schild · gemeinsame Teile der Oberfläche (10.10.) ─────────────────────────────────────────────────
// Ampel-Chip, Gesellschaft-Wahl, „was fehlt“-Liste mit Weg, Fuß mit Hinweis und Regelstand. Farbe bedeutet Zustand (rot handeln · gelb
// prüfen · grün im Lot); Texte ohne Namen und Beträge im Code.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Chip, Pillen, Liste } from '../../ui';
import { AMPEL_TEXT, type Ampel, type Punkt } from '@/lib/gesellschaften/schild/ampel';
import { REGEL_STAND, SCHILD_HINWEIS } from '@/lib/gesellschaften/schild/typen';
import { tagText } from '@/lib/gesellschaften/schild/zeit';

export const AMPEL_FARBE: Record<Ampel | 'offen', string> = { rot: LEUCHT.kritisch, gelb: LEUCHT.achtung, gruen: LEUCHT.gut, offen: C.inkDim };
export const AmpelChip = ({ a, text }: { a: Ampel | 'offen'; text?: string }) => <Chip farbe={AMPEL_FARBE[a]}>{text ?? (a === 'offen' ? 'nicht bewertet' : AMPEL_TEXT[a])}</Chip>;
export const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;

/** Welche Gesellschaft? — Pillen (nur, wenn es mehr als eine gibt). */
export function GesellschaftWahl({ liste, aktiv, onWahl }: { liste: readonly { id: string; name: string }[]; aktiv: string; onWahl: (id: string) => void }) {
  if (liste.length < 2) return null;
  return <div style={{ marginBottom: 4 }}><Pillen liste={liste.map(g => ({ id: g.id, label: g.name }))} aktiv={aktiv} onWahl={onWahl} /></div>;
}

/** „Was fehlt“ — jeder Punkt mit Weg zum Beheben. */
export function PunktListe({ punkte, max = 6 }: { punkte: readonly Punkt[]; max?: number }) {
  if (!punkte.length) return <span style={klein}>Nichts offen.</span>;
  const mehr = punkte.length - max;
  return (
    <Liste>
      {punkte.slice(0, max).map((p, i) => (
        <Link key={`${p.text}-${i}`} href={p.weg} className="fassbar" style={{ display: 'flex', gap: 10, alignItems: 'baseline', minHeight: 40, padding: '6px 2px', color: C.ink, textDecoration: 'none', fontSize: TYP.bedien, lineHeight: 1.45 }}>
          <span aria-hidden style={{ color: AMPEL_FARBE[p.schwere === 'rot' ? 'rot' : 'gelb'], fontWeight: 700 }}>●</span>
          <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{p.text}</span>
          <span aria-hidden style={{ color: C.inkLeise }}>›</span>
        </Link>
      ))}
      {mehr > 0 && <span style={klein}>… und {mehr} weitere</span>}
    </Liste>
  );
}

/** Fuß jeder Karte des Bereichs: keine Rechtsberatung, Stand der Regeln. */
export function SchildFuss({ children }: { children?: ReactNode }) {
  return <div style={{ ...klein, marginTop: 8 }}>{children ? <>{children} </> : null}{SCHILD_HINWEIS} Stand der Regeln: {tagText(REGEL_STAND)}.</div>;
}

export const datum = (t?: string) => (t ? tagText(t) : '—');
