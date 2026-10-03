'use client';

// ─── Das Seitenfenster der Qualifizierungsrunde (03.10.) ──────────────────────────────────────
// Kevin: „Klick auf Kontakt oder Firma öffnet rechts die volle Bearbeitung; man bleibt an seiner Stelle in der Runde.“
// Am Rechner eine Spalte rechts (die Runde rückt zur Seite, nichts wird verdeckt), am Handy ein Blatt von unten.
// Esc und das Kreuz schließen; Klick daneben schließt nur das Blatt am Handy (am Rechner arbeitet man links weiter).

import { useEffect, useRef, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { useSchmal } from './hilfen';

/** So breit ist die Spalte am Rechner — die Runde lässt diesen Platz frei (`SEITENBLATT_BREITE`). */
export const SEITENBLATT_BREITE = 500;

export function Seitenblatt({ titel, unter, onZu, children, kopfRechts }: { titel: ReactNode; unter?: ReactNode; onZu: () => void; children: ReactNode; kopfRechts?: ReactNode }) {
  const schmal = useSchmal();
  const zu = useRef(onZu); zu.current = onZu;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // Ein offenes Fenster (Rückfrage, Firma wechseln …) und Eingabefelder behalten ihr Esc.
      const el = e.target as HTMLElement | null;
      if (document.querySelector('[role="dialog"]:not([data-seitenblatt])')) return;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      zu.current();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, []);
  // Beim Öffnen und bei jedem Wechsel (anderer Titel = andere Person/Firma) oben anfangen, den Fokus ins Blatt holen.
  useEffect(() => { ref.current?.scrollTo?.({ top: 0 }); ref.current?.focus({ preventScroll: true }); }, [titel]);

  const inhalt = (
    <aside ref={ref} role="dialog" aria-modal={schmal ? true : undefined} aria-label={typeof titel === 'string' ? titel : 'Seitenfenster'} data-seitenblatt className="quali-seite" tabIndex={-1}
      style={{
        position: 'fixed', zIndex: schmal ? 97 : 60, background: C.flaeche, color: C.ink, fontFamily: SCHRIFT.text, overflowY: 'auto', overscrollBehavior: 'contain', outline: 'none',
        ...(schmal
          ? { left: 0, right: 0, bottom: 0, maxHeight: '90dvh', borderRadius: '18px 18px 0 0', borderTop: '1px solid rgba(255,255,255,.1)', boxShadow: '0 -20px 60px rgba(0,0,0,.6)', padding: '0 16px max(20px, env(safe-area-inset-bottom))' }
          : { top: 0, right: 0, bottom: 0, width: `min(${SEITENBLATT_BREITE}px, 100vw)`, borderLeft: '1px solid rgba(255,255,255,.08)', boxShadow: '-24px 0 60px -20px rgba(0,0,0,.7)', padding: '0 20px 28px' }),
      }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 1, background: C.flaeche, padding: schmal ? '14px 0 10px' : '18px 0 12px', display: 'flex', alignItems: 'flex-start', gap: 10, borderBottom: '1px solid rgba(255,255,255,.06)', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {schmal && <div aria-hidden style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.18)', margin: '0 auto 10px' }} />}
          <div style={{ fontFamily: SCHRIFT.display, fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.25, overflowWrap: 'anywhere' }}>{titel}</div>
          {unter && <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 3 }}>{unter}</div>}
        </div>
        {kopfRechts}
        <button onClick={onZu} aria-label="Seitenfenster schließen" className="fassbar" style={{ width: 44, height: 44, flex: '0 0 auto', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ display: 'grid', gap: 16 }}>{children}</div>
    </aside>
  );
  if (!schmal) return inhalt;
  return <div role="presentation" onClick={onZu} style={{ position: 'fixed', inset: 0, zIndex: 96, background: 'rgba(0,0,0,.5)' }}><div onClick={e => e.stopPropagation()}>{inhalt}</div></div>;
}
