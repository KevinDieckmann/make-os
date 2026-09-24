'use client';

// Kleine Bauteile der Familie-Seite — Eingaben, die beim Verlassen speichern.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { feld } from '../schlank';

/** Einzeiliges Feld: Enter legt an und leert (Modus „neu“) oder speichert beim Verlassen (Modus „wert“). */
export function Eingabe({ wert = '', onFertig, platzhalter, leeren, stil, label }: { wert?: string; onFertig: (text: string) => void; platzhalter?: string; leeren?: boolean; stil?: CSSProperties; label?: string }) {
  const [t, setT] = useState(wert);
  useEffect(() => { setT(wert); }, [wert]);
  const fertig = () => { const x = t.trim(); if (leeren ? x : x !== wert.trim()) { onFertig(x); if (leeren) setT(''); } };
  return (
    <input value={t} placeholder={platzhalter} aria-label={label ?? platzhalter} onChange={e => setT(e.target.value)}
      onBlur={leeren ? undefined : fertig} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fertig(); } }}
      style={{ ...feld, ...stil }} />
  );
}

/** Mehrzeilig, speichert beim Verlassen. */
export function Textfeld({ wert = '', onFertig, platzhalter, zeilen = 3, label }: { wert?: string; onFertig: (text: string) => void; platzhalter?: string; zeilen?: number; label?: string }) {
  const [t, setT] = useState(wert);
  useEffect(() => { setT(wert); }, [wert]);
  return (
    <textarea value={t} rows={zeilen} placeholder={platzhalter} aria-label={label ?? platzhalter} onChange={e => setT(e.target.value)}
      onBlur={() => { if (t.trim() !== wert.trim()) onFertig(t.trim()); }}
      style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} />
  );
}

export function Auswahl<T extends string | number>({ wert, liste, onWahl, label }: { wert: T; liste: { id: T; label: string }[]; onWahl: (id: T) => void; label: string }) {
  return (
    <select value={String(wert)} aria-label={label} onChange={e => { const x = liste.find(l => String(l.id) === e.target.value); if (x) onWahl(x.id); }}
      style={{ ...feld, width: 'auto', padding: '9px 12px', fontSize: TYP.bedien }}>
      {liste.map(l => <option key={String(l.id)} value={String(l.id)} style={{ background: C.flaeche }}>{l.label}</option>)}
    </select>
  );
}

/** Kleine Umschalter-Knöpfe (wer, Status, Kategorie). */
export function Wahl<T extends string>({ liste, aktiv, onWahl, farbe = C.aktiv }: { liste: { id: T; label: string }[]; aktiv: T | null; onWahl: (id: T) => void; farbe?: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {liste.map(l => {
        const an = l.id === aktiv;
        return (
          <button key={l.id} onClick={e => { e.stopPropagation(); onWahl(l.id); }} className="fassbar" style={{
            fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
            border: `1px solid ${an ? farbe : 'rgba(255,255,255,.1)'}`, background: an ? `${farbe}22` : 'transparent', color: an ? farbe : C.inkDim,
          }}>{l.label}</button>
        );
      })}
    </div>
  );
}

export function Klein({ children, farbe }: { children: ReactNode; farbe?: string }) {
  return <div style={{ fontSize: 12.5, color: farbe ?? C.inkLeise, lineHeight: 1.5 }}>{children}</div>;
}

export function Reihe({ children, gap = 8 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: 'flex', gap, alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>;
}

/** Aufklapper für Ruhiges (Hilfen, Kataloge). */
export function Mehr({ titel, children, offen: start = false }: { titel: string; children: ReactNode; offen?: boolean }) {
  const [offen, setOffen] = useState(start);
  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={() => setOffen(!offen)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.inkDim, fontSize: TYP.bedien, fontWeight: 600 }}>{offen ? '▾' : '▸'} {titel}</button>
      {offen && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

/** Ein-Klick-Symbol ohne Rahmen (löschen, bearbeiten). */
export function Symbol({ children, onClick, titel }: { children: ReactNode; onClick: () => void; titel: string }) {
  return <button onClick={e => { e.stopPropagation(); onClick(); }} title={titel} aria-label={titel} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 14, padding: '4px 6px' }}>{children}</button>;
}
