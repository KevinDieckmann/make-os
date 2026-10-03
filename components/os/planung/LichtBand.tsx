'use client';

// ─── MAKE OS — Lichtfäden-Band im Zeitstrahl (03.10.) ───────────────────────
// Die React-Hülle um den framework-freien Zeichner lib/lichtfaeden/zeitband.ts: eine Leinwand hinter den Markierungen
// des Zeitstrahls (components/os/Zeitstrahl.tsx, Modus `licht`). Rein dekorativ (`aria-hidden`) — das Textäquivalent
// steht im Zeitstrahl. Der Lauf pausiert außerhalb des Bildes/Tabs; „Bewegung reduzieren“ = Standbild.

import { useEffect, useRef } from 'react';
import { zeitband, type Zeitband, type ZeitbandDaten } from '@/lib/lichtfaeden/zeitband';
import { bewegungReduziert } from '@/lib/lichtfaeden/zeichnen';

export function LichtBand({ daten }: { daten: ZeitbandDaten }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const band = useRef<Zeitband | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const b = zeitband(c, c.parentElement ?? c, bewegungReduziert());
    band.current = b;
    // Messpunkt für Prüfungen (Zeichenzeit je Bild) — liest nur, ändert nichts.
    const messe = window.setInterval(() => { const m = b.lauf.messung(); c.dataset.bilder = String(m.bilder); c.dataset.mittelMs = m.mittelMs.toFixed(2); c.dataset.laengstesMs = m.laengstesMs.toFixed(2); }, 1000);
    return () => { window.clearInterval(messe); b.stop(); band.current = null; };
  }, []);
  useEffect(() => { band.current?.setze(daten); }, [daten]);
  return (
    <canvas ref={ref} aria-hidden="true" data-lichtfaeden=""
      style={{ position: 'absolute', left: 0, top: 0, width: daten.breite, height: daten.hoehe, pointerEvents: 'none', zIndex: 0 }} />
  );
}
