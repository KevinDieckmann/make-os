'use client';
// ─── Datumsfeld, das erst beim Verlassen speichert (29.09., #65) ────────────
// Beim Tippen des Jahres entstanden Zwischenwerte („0002-10-05“), die samt Verlaufseintrag gespeichert wurden. Jetzt:
// Eingabe lokal, übernommen bei Blur oder Enter — nur ein gültiger Kalendertag (oder leer). Esc setzt zurück.
// Trefferfläche ≥ 44 px über `minHeight` (#90).

import { useEffect, useState, type CSSProperties } from 'react';
import { istTag } from '@/lib/aufgaben/wiederholung';

export function DatumFeld({ wert, onWert, label, style, min }: { wert?: string; onWert: (tag: string | undefined) => void; label: string; style?: CSSProperties; min?: string }) {
  const [v, setV] = useState(wert ?? '');
  useEffect(() => { setV(wert ?? ''); }, [wert]);
  const uebernehmen = () => {
    if (v === (wert ?? '')) return;
    if (!v) { onWert(undefined); return; }
    if (istTag(v)) onWert(v); else setV(wert ?? '');
  };
  return (
    <input type="date" value={v} min={min} aria-label={label} onChange={e => setV(e.target.value)} onBlur={uebernehmen}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') setV(wert ?? ''); }}
      style={{ minHeight: 36, ...style }} />
  );
}

/** Uhrzeit „HH:MM“, übernommen bei Blur oder Enter (leer = ohne Uhrzeit) — Deadline-Uhrzeit (29.09., Kalender K1). */
export function UhrzeitFeld({ wert, onWert, label, style }: { wert?: string; onWert: (zeit: string | undefined) => void; label: string; style?: CSSProperties }) {
  const [v, setV] = useState(wert ?? '');
  useEffect(() => { setV(wert ?? ''); }, [wert]);
  const uebernehmen = () => {
    if (v === (wert ?? '')) return;
    if (!v) { onWert(undefined); return; }
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) onWert(v); else setV(wert ?? '');
  };
  return (
    <input type="time" step={300} value={v} aria-label={label} onChange={e => setV(e.target.value)} onBlur={uebernehmen}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') setV(wert ?? ''); }}
      style={{ minHeight: 36, ...style }} />
  );
}
