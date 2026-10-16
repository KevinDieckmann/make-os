'use client';

// ─── Kleine Marke „Beispiel“ (Demo-Instanz, 15.10.) ─────────────────────────────────────────────────────────────────
// Steht an jedem Ergebnis, das die Demo als Beispiel gesät hat (`beispiel: true` an den Daten, lib/demo/beispiel.ts) — Heads, Head of Finance,
// ZOE-Vorschläge, ZOE-Gespräch, Analyse. Ruhig wie die KI-Marke: kein Alarm, nur ehrlich.

import { FARBE as C, TYP } from '@/lib/make-one/design';
import { BEISPIEL_HINWEIS } from '@/lib/demo/beispiel';

export function BeispielMarke() {
  return (
    <span role="note" aria-label="Beispiel der Demo" title={BEISPIEL_HINWEIS}
      style={{ display: 'inline-flex', alignItems: 'center', fontSize: TYP.mikro, fontWeight: 700, padding: '1px 6px', borderRadius: 6, border: `1px solid ${C.linie}`, color: C.inkDim, letterSpacing: '.02em', flex: '0 0 auto' }}>
      Beispiel
    </span>
  );
}
