'use client';

// ─── „Idee“ von jeder Seite (25.09.) ────────────────────────────────────────
// Der Knopf oben im Kopf (oder ein Ereignis `make-idee`) öffnet das
// Erfassen-Fenster — die Seite, auf der es aufgefallen ist, geht mit und
// bestimmt den Bereich vor. Danach kurz: „Im Bauplan unter Ideen“.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { LEUCHT } from '../schlank';
import type { BacklogItem } from '@/lib/make-one/backlog-data';
import { Fenster, ErfassenFormular, BAUPLAN_NEU } from './gemeinsam';

export const IDEE_OEFFNEN = 'make-idee';

export function IdeeErfassen() {
  const [seite, setSeite] = useState<string | null>(null);
  const [fertig, setFertig] = useState<BacklogItem | null>(null);
  useEffect(() => {
    const auf = () => setSeite(window.location.pathname + window.location.search);
    window.addEventListener(IDEE_OEFFNEN, auf);
    return () => window.removeEventListener(IDEE_OEFFNEN, auf);
  }, []);
  useEffect(() => { if (!fertig) return; const t = setTimeout(() => setFertig(null), 7000); return () => clearTimeout(t); }, [fertig]);
  return (
    <>
      {seite !== null && (
        <Fenster titel="Idee oder Fehler notieren" onZu={() => setSeite(null)}>
          <ErfassenFormular seite={seite} onAbbruch={() => setSeite(null)} onFertig={k => { setSeite(null); setFertig(k); window.dispatchEvent(new Event(BAUPLAN_NEU)); }} />
        </Fenster>
      )}
      {fertig && (
        <div role="status" style={{ position: 'fixed', left: '50%', bottom: 'max(20px, env(safe-area-inset-bottom))', transform: 'translateX(-50%)', zIndex: 97, display: 'flex', gap: 14, alignItems: 'center', padding: '11px 16px', borderRadius: 14, background: C.flaecheHoch, border: `1px solid ${LEUCHT.gut}55`, boxShadow: '0 16px 40px -12px rgba(0,0,0,.8)', fontSize: TYP.bedien, color: C.ink, maxWidth: 'calc(100vw - 32px)' }}>
          <span>Im Bauplan unter „Ideen“ ✓</span>
          <Link href={`/os/bauplan?k=${fertig.id}`} onClick={() => setFertig(null)} style={{ color: LEUCHT.gut, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>Ansehen ›</Link>
        </div>
      )}
    </>
  );
}
