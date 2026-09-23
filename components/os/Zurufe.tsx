'use client';

// ─── MAKE OS — Zurufe ───────────────────────────────────────────────────────
// Kleine Nachrichten, die unregelmäßig auftauchen: Haltung, ein Hinweis auf
// den Körper — und für Malin Zeilen von Kevin.
//
// Sie erscheinen unten rechts über dem Jarvis-Kreis, verschwinden nach einer
// Weile von selbst und lassen sich wegklicken. Der Abstand ist absichtlich
// unregelmäßig (70 bis 230 Minuten): Ein fester Takt wird zur Tapete.

import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { personLesen } from '@/lib/make-one/arbeitsplatz-browser';
import { naechsterZuruf, naechsterAbstandMs, type Zuruf } from '@/lib/make-one/zurufe-data';

const MERKER_ZEIT = 'make-os-zuruf-zeit';
const MERKER_GEZEIGT = 'make-os-zuruf-gezeigt';

const FARBE: Record<Zuruf['art'], string> = {
  liebe: '#FF5C5C',
  mindset: T.accent,
  ruhe: '#58D9CD',
};

export function Zurufe() {
  const [zuruf, setZuruf] = useState<Zuruf | null>(null);
  const [weg, setWeg] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // React montiert Effekte im Entwicklungsmodus doppelt. Ohne diese Sperre
    // laufen zwei Zeitgeber nebeneinander und es kämen zwei Zurufe kurz
    // hintereinander — beim Testen genau so passiert.
    const w = window as Window & { __makeZurufe?: boolean };
    if (w.__makeZurufe) return;
    w.__makeZurufe = true;

    let abgebrochen = false;

    const lies = <X,>(key: string, sonst: X): X => {
      try { return JSON.parse(localStorage.getItem(key) ?? '') as X; } catch { return sonst; }
    };

    const planen = (verzoegerung: number) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        if (abgebrochen) return;
        // Wer hier sitzt, steht im Browser — nicht zentral. Sonst bekäme Kevin
        // Malins Zeilen, sobald sie an ihrem Rechner umschaltet.
        const person = personLesen();
        const gezeigt = lies<Record<string, string>>(MERKER_GEZEIGT, {});
        const z = naechsterZuruf(person, gezeigt);
        if (!z) return;
        setZuruf(z); setWeg(false);
        try {
          localStorage.setItem(MERKER_GEZEIGT, JSON.stringify({ ...gezeigt, [z.id]: new Date().toISOString() }));
          localStorage.setItem(MERKER_ZEIT, String(Date.now()));
        } catch { /* egal */ }
        // Von selbst wieder verschwinden — niemand soll wegklicken müssen.
        setTimeout(() => { if (!abgebrochen) setWeg(true); }, 18_000);
        planen(naechsterAbstandMs());
      }, verzoegerung);
    };

    // Beim Öffnen nicht sofort loslegen: erst ankommen lassen. War aber lange
    // keiner mehr da, muss man auch nicht nochmal Minuten warten.
    const zuletzt = Number(localStorage.getItem(MERKER_ZEIT) ?? 0);
    const seither = zuletzt ? Date.now() - zuletzt : Infinity;
    const faellig = seither > 3 * 3600_000;
    planen(faellig ? 45_000 : Math.max(5 * 60_000, naechsterAbstandMs() - seither));

    return () => { abgebrochen = true; clearTimeout(timer.current); w.__makeZurufe = false; };
  }, []);

  if (!zuruf) return null;
  const farbe = FARBE[zuruf.art];

  return (
    <div
      onClick={() => setWeg(true)}
      style={{
        position: 'fixed', right: 22, bottom: 88, zIndex: 66, width: 'min(300px, calc(100vw - 44px))',
        background: T.panel, border: `1px solid ${farbe}55`, borderLeft: `3px solid ${farbe}`,
        borderRadius: 13, padding: '13px 15px', cursor: 'pointer',
        boxShadow: '0 16px 44px rgba(0,0,0,.45)',
        opacity: weg ? 0 : 1, transform: weg ? 'translateY(8px)' : 'none',
        transition: 'opacity .5s ease, transform .5s ease',
        pointerEvents: weg ? 'none' : 'auto',
      }}
    >
      {zuruf.von && (
        <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: farbe, marginBottom: 5 }}>
          von {zuruf.von}
        </div>
      )}
      <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.55 }}>{zuruf.text}</div>
    </div>
  );
}
