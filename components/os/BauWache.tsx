'use client';
// ─── Bau-Wache (29.09., A2) ─────────────────────────────────────────────────
// Liegt einmal im Wurzel-Rahmen (app/layout.tsx). Hängt beim ersten Laden des Moduls die Fetch-Hülle ein
// (lib/bau/kennung.ts `bauHuelle`): jede schreibende Anfrage an /api trägt `x-make-bau`. Lehnt der Server mit
// „bitte neu laden“ ab (dieser Tab läuft mit altem Code), steht oben ein fester Hinweis mit „Neu laden“ — für alle
// Bereiche gleich. Offene Aufgaben-Änderungen merkt sich der Tab (TasksContext, sessionStorage) und schickt sie nach dem
// Neuladen mit ihrem alten Stand erneut (Konflikt statt Überschreiben).

import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { bauHuelle, bauKennung, NEU_LADEN_EREIGNIS, NEU_LADEN_TEXT } from '@/lib/bau/kennung';

declare global { interface Window { __makeBau?: string } }

function einhaengen() {
  if (typeof window === 'undefined' || window.__makeBau) return;
  const kennung = bauKennung();
  window.__makeBau = kennung ?? 'ohne';
  window.fetch = bauHuelle(window.fetch.bind(window), window.location.origin, kennung, () => window.dispatchEvent(new CustomEvent(NEU_LADEN_EREIGNIS)));
}
// Sofort beim Laden des Moduls — vor jedem Effekt, damit auch die allererste Schreibung die Kennung trägt.
einhaengen();

export function BauWache() {
  const [neuLaden, setNeuLaden] = useState(false);
  useEffect(() => {
    einhaengen();
    const an = () => setNeuLaden(true);
    window.addEventListener(NEU_LADEN_EREIGNIS, an);
    return () => window.removeEventListener(NEU_LADEN_EREIGNIS, an);
  }, []);
  if (!neuLaden) return null;
  return (
    <div role="alert" style={{
      position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10000, maxWidth: 'min(560px, calc(100vw - 24px))',
      display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 14, background: C.flaecheHoch,
      border: `1px solid ${LEUCHT.achtung}55`, boxShadow: '0 10px 30px rgba(0,0,0,.45)', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.ink,
    }}>
      <span style={{ flex: 1, lineHeight: 1.45 }}>{NEU_LADEN_TEXT}</span>
      <button onClick={() => window.location.reload()} style={{ background: LEUCHT.achtung, color: '#111', border: 'none', borderRadius: 999, padding: '6px 14px', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Neu laden</button>
    </div>
  );
}
