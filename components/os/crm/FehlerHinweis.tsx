'use client';

// ─── Markttraktion — Meldung als fixierter Hinweis (28.09., Ablaufprüfung K1) ─
// Vorher stand `api.fehler` als Zeile oben auf der Seite und wurde beim nächsten Laden gelöscht — ein 409
// („jemand war schneller“) verschwand, bevor ihn jemand sah, und wer unten in einer Karte tippte, sah ihn nie.
// Jetzt: unten fixiert (immer im Blick, auch am Handy), bleibt stehen, bis weggeklickt wird oder ~8 s vergehen;
// ein neuer Schreibvorgang nimmt sie ohnehin weg (`neuerVersuch` in components/os/crm/daten.ts).

import { useEffect } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { LEUCHT } from '../schlank';

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
  const farbe = ton === 'info' ? LEUCHT.gut : LEUCHT.kritisch;
  return (
    <div role={ton === 'info' ? 'status' : 'alert'} aria-live={ton === 'info' ? 'polite' : 'assertive'} style={{ position: 'fixed', left: 16, right: 16, bottom: ton === 'info' ? 'calc(96px + env(safe-area-inset-bottom, 0px))' : 'calc(16px + env(safe-area-inset-bottom, 0px))', zIndex: 1500, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto', maxWidth: 560, width: '100%', display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 14, background: C.flaecheHoch, border: `1px solid ${farbe}66`, boxShadow: '0 18px 48px rgba(0,0,0,.55)', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, lineHeight: 1.45 }}>
        <span aria-hidden style={{ color: farbe, fontWeight: 700 }}>{ton === 'info' ? 'i' : '!'}</span>
        <span style={{ flex: 1, whiteSpace: 'pre-line' }}>{text}</span>
        <button type="button" onClick={onZu} aria-label="Hinweis schließen" style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
      </div>
    </div>
  );
}
