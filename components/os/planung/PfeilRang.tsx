'use client';

// ─── MAKE OS — Priorität per Pfeil ▲▼ ───────────────────────────────────────
// Malin (27.09.): rechts an jeder Zeile (Ziele, Meilensteine, Routinen, Blöcke).
// Zwei kleine Tasten übereinander; per Tastatur erreichbar (Tab + Enter/Leertaste),
// dazu Alt+↑/↓ auf der Gruppe. Am Anfang/Ende ist die jeweilige Taste aus.

import type { CSSProperties, KeyboardEvent } from 'react';
import { FARBE as C } from '@/lib/make-one/design';

const taste = (aus: boolean): CSSProperties => ({
  width: 22, height: 15, lineHeight: '13px', fontSize: 11, padding: 0, border: 'none', borderRadius: 4, cursor: aus ? 'default' : 'pointer',
  background: aus ? 'transparent' : 'rgba(255,255,255,.08)', color: aus ? 'rgba(255,255,255,.14)' : C.inkDim, fontFamily: 'inherit',
});

export function PfeilRang({ label, obenAus, untenAus, onAuf, onAb }: { label: string; obenAus?: boolean; untenAus?: boolean; onAuf: () => void; onAb: () => void }) {
  const tasten = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (!e.altKey) return;
    if (e.key === 'ArrowUp' && !obenAus) { e.preventDefault(); onAuf(); }
    if (e.key === 'ArrowDown' && !untenAus) { e.preventDefault(); onAb(); }
  };
  return (
    <span role="group" aria-label={`Priorität: ${label}`} onKeyDown={tasten} title="Priorität — auch Alt+↑/↓" style={{ display: 'inline-flex', flexDirection: 'column', gap: 1, flex: '0 0 auto' }}>
      <button type="button" aria-label={`${label} nach oben`} disabled={!!obenAus} onClick={e => { e.stopPropagation(); onAuf(); }} style={taste(!!obenAus)}>▲</button>
      <button type="button" aria-label={`${label} nach unten`} disabled={!!untenAus} onClick={e => { e.stopPropagation(); onAb(); }} style={taste(!!untenAus)}>▼</button>
    </span>
  );
}
