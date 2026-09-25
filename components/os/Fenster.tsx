'use client';

// ─── Fenster (Dialog) — eins für alle ───────────────────────────────────────
// Entstanden im Bauplan (25.09.), jetzt auch im Kalender: Esc und Klick
// daneben schließen, am Handy ganzflächig, Text markieren schließt nicht.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';

/** Ein Fenster über der Seite: Esc und Klick daneben schließen, am Handy ganzflächig. */
export function Fenster({ titel, onZu, children, breit = 720 }: { titel: ReactNode; onZu: () => void; children: ReactNode; breit?: number }) {
  const [schmal, setSchmal] = useState(false);
  useEffect(() => { const mq = window.matchMedia('(max-width: 640px)'); const an = () => setSchmal(mq.matches); an(); mq.addEventListener('change', an); return () => mq.removeEventListener('change', an); }, []);
  const zu = useRef(onZu); zu.current = onZu;
  // Nur ein Klick, der auch DANEBEN begonnen hat, schließt — wer Text markiert und dabei hinauszieht, verliert nichts.
  const daneben = useRef(false);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); zu.current(); } };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, []);
  return (
    <div onMouseDown={e => { daneben.current = e.target === e.currentTarget; }} onClick={e => { if (daneben.current && e.target === e.currentTarget) zu.current(); }} style={{ position: 'fixed', inset: 0, zIndex: 96, background: 'rgba(5,7,8,.62)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: schmal ? 'stretch' : 'flex-start', padding: schmal ? 0 : '6vh 16px' }}>
      <div role="dialog" aria-modal="true"
        style={{ width: schmal ? '100%' : `min(${breit}px, 100%)`, maxHeight: schmal ? '100%' : '88vh', height: schmal ? '100%' : undefined, overflowY: 'auto', overscrollBehavior: 'contain',
          background: C.flaeche, borderRadius: schmal ? 0 : 18, border: schmal ? 'none' : '1px solid rgba(255,255,255,.07)', boxShadow: '0 30px 80px -20px rgba(0,0,0,.8)',
          padding: schmal ? '14px 16px max(20px, env(safe-area-inset-bottom))' : '18px 22px 22px', color: C.ink, fontFamily: SCHRIFT.text, display: 'grid', gap: 14, alignContent: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: 0, fontFamily: SCHRIFT.display, fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.3, minWidth: 0, flex: 1 }}>{titel}</h2>
          <button onClick={onZu} aria-label="Schließen" className="fassbar" style={{ width: 40, height: 40, flex: '0 0 auto', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.inkDim, fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
