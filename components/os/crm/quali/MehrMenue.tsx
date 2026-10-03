'use client';

// ─── „Mehr ⋯“ — der Rest hinter einem Menü (03.10.) ────────────────────────────────────────────
// Kevin: „Es darf nicht zu unübersichtlich werden. Das meiste können wir nachher in der Akte machen.“ Sichtbar je Karte bleibt
// nur Kontakt, Firma und „Gespräch starten“; alles andere steht hier: Firma wechseln, Zusammenführen, weitere Person, Abgeben,
// Parken, Raus. Menü mit Tastatur (Pfeile, Enter, Esc), Ziele ≥ 44 px.

import { useEffect, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { LEUCHT } from '../../schlank';

export interface MenuPunkt { id: string; label: string; hinweis?: string; gefahr?: boolean; onClick: () => void }

export function MehrMenue({ punkte, label = 'Mehr' }: { punkte: MenuPunkt[]; label?: string }) {
  const [offen, setOffen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const knopf = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!offen) return;
    const aussen = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOffen(false); };
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOffen(false); knopf.current?.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const l = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
        const i = l.findIndex(x => x === document.activeElement);
        l[(i + (e.key === 'ArrowDown' ? 1 : -1) + l.length) % l.length]?.focus();
      }
    };
    document.addEventListener('mousedown', aussen);
    document.addEventListener('keydown', taste, true);
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => { document.removeEventListener('mousedown', aussen); document.removeEventListener('keydown', taste, true); };
  }, [offen]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button ref={knopf} type="button" aria-haspopup="menu" aria-expanded={offen} onClick={() => setOffen(!offen)} className="fassbar"
        style={{ minHeight: 44, padding: '9px 15px', borderRadius: 11, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, color: C.ink, border: '1px solid rgba(255,255,255,.1)', background: offen ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.04)' }}>{label} ⋯</button>
      {offen && (
        <div role="menu" aria-label={label} style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 6px)', zIndex: 50, minWidth: 'min(300px, 86vw)', display: 'grid', padding: 6, borderRadius: 14, background: C.flaecheHoch, border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 18px 50px -12px rgba(0,0,0,.75)' }}>
          {punkte.map(p => (
            <button key={p.id} role="menuitem" type="button" onClick={() => { setOffen(false); p.onClick(); }} className="fassbar"
              style={{ display: 'grid', gap: 1, textAlign: 'left', minHeight: 44, padding: '8px 12px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: SCHRIFT.text, color: p.gefahr ? LEUCHT.kritisch : C.ink }}>
              <span style={{ fontSize: TYP.bedien, fontWeight: 600 }}>{p.label}</span>
              {p.hinweis && <span style={{ fontSize: 11.5, color: C.inkLeise, lineHeight: 1.35 }}>{p.hinweis}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
