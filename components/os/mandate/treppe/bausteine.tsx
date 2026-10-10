'use client';

// ─── Produkte · Leistungstreppe — kleine Bausteine der Ansichten (10.10.) ───────────────────────────────────────────
// Farbe je Ebene der Treppe und ein mehrzeiliges Feld, das beim Verlassen speichert — geteilt von Treppe, Teilen und Fortschritt.

import { useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { feld, LEUCHT } from '../../ui';

const FARBE_EBENE = [LEUCHT.business, C.aktiv, LEUCHT.gut, LEUCHT.geld, LEUCHT.schlaf, LEUCHT.puls];
/** Farbe einer Ebene der Treppe (1 = Einstieg) — wiederholt sich nach sechs Ebenen. */
export const farbeVonEbene = (e: number) => FARBE_EBENE[(Math.max(1, e) - 1) % FARBE_EBENE.length];

/** Mehrzeiliges Feld, das beim Verlassen speichert. */
export function TextFeld({ wert = '', onFertig, platzhalter, zeilen = 3 }: { wert?: string; onFertig: (t: string) => void; platzhalter?: string; zeilen?: number }) {
  const [t, setT] = useState(wert);
  const [alt, setAlt] = useState(wert);
  if (alt !== wert) { setAlt(wert); setT(wert); }
  return <textarea value={t} rows={zeilen} placeholder={platzhalter} aria-label={platzhalter} onChange={e => setT(e.target.value)} onBlur={() => { if (t !== wert) onFertig(t); }}
    style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', resize: 'vertical', minHeight: 44, fontFamily: SCHRIFT.text }} />;
}
