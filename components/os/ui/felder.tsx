'use client';

// ─── Standard · Eingaben (03.10.) ────────────────────────────────────────────
// `eingabe` = Formularstil (Netzwerken): 48 px hoch, 16 px Schrift — kleiner zoomt iOS beim Antippen die Seite auf.
// `feld` = kompakter Stil für Zeilen, die beim Verlassen speichern (Kartei, Akte): 44 px, am Rechner 14 px. Beide mit sichtbarem Fokus (.ui-feld).

import type { CSSProperties, ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT, RAND, ECKE } from '@/lib/make-one/design';

export const eingabe: CSSProperties = {
  width: '100%', minHeight: 48, boxSizing: 'border-box', background: 'rgba(255,255,255,.05)', border: `1px solid ${RAND.stark}`, borderRadius: ECKE.eingabe,
  padding: '12px 14px', color: C.ink, fontFamily: SCHRIFT.text, fontSize: 16, outline: 'none', WebkitAppearance: 'none', appearance: 'none',
};

/** Kompakt: wie `eingabe`, aber 44 px und 15 px (am Handy erzwingt `.ui-seite` 16 px). */
export const feld: CSSProperties = {
  width: '100%', minHeight: 44, boxSizing: 'border-box', background: 'rgba(255,255,255,.05)', border: `1px solid ${RAND.flaeche}`, borderRadius: ECKE.eingabe,
  padding: '10px 14px', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.body, outline: 'none',
};

/** Beschriftung über dem Feld, Fehlertext darunter (in ganzen Sätzen). */
export function Feldzeile({ label, children, fehler }: { label: string; children: ReactNode; fehler?: string }) {
  return (
    <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>{label}</span>
      {children}
      {fehler && <span role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, lineHeight: 1.4 }}>{fehler}</span>}
    </label>
  );
}
