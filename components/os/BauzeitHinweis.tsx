'use client';

// ─── MAKE OS — Bauzeit-Hinweis ──────────────────────────────────────────────
// Steht der Schalter unter Zusammenarbeit an, sieht man das hier auf JEDER
// Seite. Kevins Ansage: „programmierfreie Zonen" — dieser Streifen ist die
// Zone in sichtbarer Form. Malin muss nicht raten, ob gerade gebaut wird.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';

interface Bauzeit { aktiv: boolean; woran: string; seit: string | null; von: string }

export function BauzeitHinweis() {
  const [b, setB] = useState<Bauzeit | null>(null);

  useEffect(() => {
    const holen = () => fetch('/api/state/bauzeit').then(r => r.json()).then(setB).catch(() => {});
    holen();
    // Malin arbeitet in derselben Instanz — sie soll es mitbekommen, wenn Kevin
    // mitten in ihrer Sitzung anfängt zu bauen.
    const t = setInterval(holen, 60_000);
    return () => clearInterval(t);
  }, []);

  if (!b?.aktiv) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      background: `${T.amber}18`, borderBottom: `1px solid ${T.amber}55`,
      padding: '8px clamp(14px,3vw,26px)', color: T.amber,
      fontFamily: T.mono, fontSize: 11, position: 'sticky', top: 0, zIndex: 45,
    }}>
      <span style={{ fontWeight: 700, letterSpacing: '.1em' }}>● BAUZEIT</span>
      <span style={{ color: T.inkDim }}>
        {b.von} baut gerade{b.woran ? ` an: ${b.woran}` : ''}
        {b.seit ? ` · seit ${b.seit.slice(11, 16)} Uhr` : ''} — nichts Wichtiges eintragen.
      </span>
      <Link href="/os/onboarding/zusammenarbeit" style={{ marginLeft: 'auto', color: T.amber, textDecoration: 'none' }}>Regeln ›</Link>
    </div>
  );
}
