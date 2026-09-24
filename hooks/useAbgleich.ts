'use client';

// ─── Abgleich: sehen, was der andere geändert hat (24.09.) ──────────────────
// Kevin und Malin arbeiten gleichzeitig. Eine offene Seite holt deshalb
// regelmäßig den aktuellen Stand — alle paar Sekunden, beim Zurückkehren in
// den Tab und beim Fokus. Nie, während noch Ungespeichertes anliegt: sonst
// würde der Abgleich die eigene Eingabe überschreiben.

import { useEffect, useRef } from 'react';

export function useAbgleich(laden: () => unknown, opt: { alle?: number; pausiert?: () => boolean } = {}) {
  const ladenRef = useRef(laden);
  ladenRef.current = laden;
  const pausiertRef = useRef(opt.pausiert);
  pausiertRef.current = opt.pausiert;
  const alle = opt.alle ?? 15_000;
  useEffect(() => {
    const zug = () => {
      if (document.visibilityState !== 'visible') return;
      if (pausiertRef.current?.()) return;
      void ladenRef.current();
    };
    const t = setInterval(zug, alle);
    const sicht = () => { if (document.visibilityState === 'visible') zug(); };
    window.addEventListener('focus', zug);
    document.addEventListener('visibilitychange', sicht);
    return () => { clearInterval(t); window.removeEventListener('focus', zug); document.removeEventListener('visibilitychange', sicht); };
  }, [alle]);
}
