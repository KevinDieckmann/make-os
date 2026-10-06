'use client';
// ─── Pro Ebene genau EIN Eingabefeld (06.10., Malins Bauplan-Karte) ─────────────────────────────────
// Vorher standen vier gleich aussehende gestrichelte Felder untereinander („+ Aufgabe (Enter)“, „+ Liste (Enter)“, „+ Liste, z. B.
// Januar“, „+ Gruppe, z. B. Marketing“) — Malin tippte eine Aufgabe ins Listenfeld. Jetzt sieht jedes Feld aus wie das, was es
// anlegt, und sagt es in Worten:
//   · Projekt unten „+ Neue Liste“ — im Stil einer Listen-Überschrift (Großbuchstaben, fett, mit Listen-Symbol).
//   · Liste unten „+ Neue Aufgabe“ — als Aufgaben-Zeile mit leerem Haken davor.
//   · geöffnete Aufgabe „+ Unteraufgabe“ — eingerückt, kleiner, mit Abzweig-Pfeil.
// Enter legt an, das Feld bleibt für die nächste offen; Escape leert. Am Handy 16 px Schrift (`.ui-seite`), Ziele ≥ 44 px.

import { useState, type CSSProperties } from 'react';
import { ListPlus, CornerDownRight } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, RAND, ECKE, ZIEL } from '@/lib/make-one/design';

function useZeile(onNeu: (text: string) => void) {
  const [text, setText] = useState('');
  return {
    text,
    props: {
      value: text,
      onChange: (e: { target: { value: string } }) => setText(e.target.value),
      onKeyDown: (e: { key: string; preventDefault: () => void }) => {
        if (e.key === 'Enter' && text.trim()) { e.preventDefault(); onNeu(text.trim()); setText(''); }
        if (e.key === 'Escape') setText('');
      },
    },
  };
}

const ohneRahmen: CSSProperties = { flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: C.ink, padding: 0 };

/** Projekt unten: „+ Neue Liste“ — sieht aus wie eine Listen-Überschrift. */
export function NeueListeFeld({ projektTitel, onNeu }: { projektTitel: string; onNeu: (titel: string) => void }) {
  const z = useZeile(t => onNeu(t.slice(0, 80)));
  return (
    <label className="aufgaben-neu-liste" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '0 10px', minHeight: ZIEL.handy, borderRadius: ECKE.eingabe, border: RAND.leer, cursor: 'text' }}>
      <ListPlus size={16} aria-hidden style={{ color: C.inkDim, flex: '0 0 auto' }} />
      <input {...z.props} maxLength={80} aria-label={`Neue Liste im Projekt „${projektTitel}“`} placeholder="+ Neue Liste"
        style={{ ...ohneRahmen, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, letterSpacing: '.08em', textTransform: z.text ? 'none' : 'uppercase' }} />
      {z.text && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, whiteSpace: 'nowrap' }}>Enter = Liste anlegen</span>}
    </label>
  );
}

/** Liste unten: „+ Neue Aufgabe“ — eine Aufgaben-Zeile mit leerem Haken davor. */
export function NeueAufgabeFeld({ listeTitel, onNeu }: { listeTitel: string; onNeu: (titel: string) => void }) {
  const z = useZeile(onNeu);
  return (
    <label className="aufgaben-neu-aufgabe" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 4px 4px 42px', minHeight: ZIEL.handy, borderBottom: `1px solid ${RAND.haar}`, cursor: 'text' }}>
      <span aria-hidden style={{ width: 20, height: 20, borderRadius: 999, border: `1.5px dashed ${RAND.stark}`, flex: '0 0 auto' }} />
      <input {...z.props} maxLength={300} aria-label={`Neue Aufgabe in „${listeTitel}“`} placeholder="+ Neue Aufgabe"
        style={{ ...ohneRahmen, fontFamily: SCHRIFT.text, fontSize: 14.5 }} />
    </label>
  );
}

/** Geöffnete Aufgabe: „+ Unteraufgabe“ — eingerückt, kleiner, mit Abzweig-Pfeil. */
export function NeueUnteraufgabeFeld({ elternTitel, einzug, onNeu }: { elternTitel: string; einzug: number; onNeu: (titel: string) => void }) {
  const z = useZeile(onNeu);
  return (
    <label className="aufgaben-neu-unter" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `2px 4px 2px ${einzug}px`, minHeight: ZIEL.rechner, cursor: 'text' }}>
      <CornerDownRight size={14} aria-hidden style={{ color: C.inkLeise, flex: '0 0 auto' }} />
      <input {...z.props} maxLength={300} aria-label={`Neue Unteraufgabe von „${elternTitel}“`} placeholder="+ Unteraufgabe"
        style={{ ...ohneRahmen, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkDim }} />
    </label>
  );
}
