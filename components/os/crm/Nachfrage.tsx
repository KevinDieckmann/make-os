'use client';
// ─── Nachfrage: eine kurze Texteingabe im Fenster (27.09.) ──────────────────
// Ersetzt window.prompt an vier Stellen (Firma anlegen, Lead-Grund, Antrag
// erledigt, Löschgrund): sieht aus wie der Rest, lässt sich mit Escape
// abbrechen, Enter übernimmt — und funktioniert auch dort, wo der Browser
// prompt() blockiert (eingebettet, iOS-Startbildschirm).
//
//   const { frage, dialog } = useNachfrage();
//   const grund = await frage('Warum kein Fit?', { hinweis: 'kurz' });   // null = abgebrochen
//   … {dialog} irgendwo im JSX rendern.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Knopf, feld } from '../schlank';

interface Offen { titel: string; vorgabe: string; hinweis?: string; pflicht: boolean; resolve: (v: string | null) => void }
export interface NachfrageOptionen { vorgabe?: string; hinweis?: string; /** leer nicht zulassen (Vorgabe: ja) */ pflicht?: boolean }

export function useNachfrage(): { frage: (titel: string, o?: NachfrageOptionen) => Promise<string | null>; dialog: ReactNode } {
  const [offen, setOffen] = useState<Offen | null>(null);
  const frage = useCallback((titel: string, o: NachfrageOptionen = {}) => new Promise<string | null>(resolve => {
    setOffen(alt => { alt?.resolve(null); return { titel, vorgabe: o.vorgabe ?? '', hinweis: o.hinweis, pflicht: o.pflicht ?? true, resolve }; });
  }), []);
  const fertig = useCallback((v: string | null) => { setOffen(alt => { alt?.resolve(v); return null; }); }, []);
  return { frage, dialog: offen ? <NachfrageDialog o={offen} onFertig={fertig} /> : null };
}

function NachfrageDialog({ o, onFertig }: { o: Offen; onFertig: (v: string | null) => void }) {
  const [wert, setWert] = useState(o.vorgabe);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const ok = () => { const v = wert.trim(); if (o.pflicht && !v) return; onFertig(v); };
  return (
    <div role="presentation" onClick={() => onFertig(null)} style={{ position: 'fixed', inset: 0, zIndex: 96, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={o.titel} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onFertig(null); } }}
        style={{ width: 'min(460px, 100%)', background: C.flaecheHoch, border: `1px solid ${C.linie}`, borderRadius: 16, padding: 18, display: 'grid', gap: 10, fontFamily: SCHRIFT.text, boxShadow: '0 20px 60px rgba(0,0,0,.45)' }}>
        <div style={{ fontSize: TYP.body, fontWeight: 700, color: C.ink }}>{o.titel}</div>
        {o.hinweis && <div style={{ fontSize: 12.5, color: C.inkDim }}>{o.hinweis}</div>}
        <input ref={ref} value={wert} onChange={e => setWert(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } }} aria-label={o.titel} style={{ ...feld, width: '100%', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Knopf leise onClick={() => onFertig(null)}>Abbrechen</Knopf>
          <Knopf aus={o.pflicht && !wert.trim()} onClick={ok}>Übernehmen</Knopf>
        </div>
      </div>
    </div>
  );
}
