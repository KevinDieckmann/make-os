'use client';

// ─── Markttraktion — Meldung als fixierter Hinweis (28.09., Ablaufprüfung K1) ─
// Vorher stand `api.fehler` als Zeile oben auf der Seite und wurde beim nächsten Laden gelöscht — ein 409
// („jemand war schneller“) verschwand, bevor ihn jemand sah, und wer unten in einer Karte tippte, sah ihn nie.
// Jetzt: unten fixiert (immer im Blick, auch am Handy), bleibt stehen, bis weggeklickt wird oder ~8 s vergehen;
// ein neuer Schreibvorgang nimmt sie ohnehin weg (`neuerVersuch` in components/os/crm/daten.ts).

import { useEffect } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Hinweis } from '../ui';

/** So lange bleibt eine Meldung stehen, wenn niemand sie wegklickt. */
export const HINWEIS_MS = 8_000;

/**
 * `ton="info"` + `bleibt`: ein Ergebnis zum Abarbeiten (etwa nach dem Löschen: Deals ohne Person, Aufgaben zum Prüfen) —
 * steht, bis es weggeklickt wird.
 */
export function FehlerHinweis({ text, onZu, ton = 'fehler', bleibt }: { text: string | null; onZu: () => void; ton?: 'fehler' | 'info'; bleibt?: boolean }) {
  useEffect(() => {
    if (!text || bleibt) return;
    const t = setTimeout(onZu, HINWEIS_MS);
    return () => clearTimeout(t);
  }, [text, onZu, bleibt]);
  if (!text) return null;
  return (
    <div role={ton === 'info' ? 'status' : 'alert'} aria-live={ton === 'info' ? 'polite' : 'assertive'} style={{ position: 'fixed', left: 16, right: 16, bottom: ton === 'info' ? 'calc(96px + env(safe-area-inset-bottom, 0px))' : 'calc(16px + env(safe-area-inset-bottom, 0px))', zIndex: 1500, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      {/* Hinweis nach Bedeutung (Standard) auf einem deckenden Grund — die Meldung liegt über dem Inhalt. */}
      <div style={{ pointerEvents: 'auto', maxWidth: 560, width: '100%', display: 'flex', alignItems: 'flex-start', gap: 4, borderRadius: 14, background: C.flaecheHoch, boxShadow: '0 18px 48px rgba(0,0,0,.55)', fontFamily: SCHRIFT.text, fontSize: TYP.body }}>
        <div style={{ flex: 1, minWidth: 0 }}><Hinweis art={ton === 'info' ? 'gut' : 'kritisch'} rolle={ton === 'info' ? 'status' : 'alert'}><span style={{ whiteSpace: 'pre-line' }}>{text}</span></Hinweis></div>
        <button type="button" onClick={onZu} aria-label="Hinweis schließen" style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 20, lineHeight: 1, width: 44, height: 44, flex: '0 0 auto' }}>×</button>
      </div>
    </div>
  );
}
