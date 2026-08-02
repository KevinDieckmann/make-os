'use client';

// ─── MAKE OS — Fehler-Melder ────────────────────────────────────────────────
// Fängt Browser-Fehler ab und schreibt sie mit. Ohne ihn sieht Fehler nur,
// wer gerade davorsitzt — und muss sie abtippen. Rein passiv: keine Anzeige,
// keine Störung, nur Mitschrift.

import { useEffect } from 'react';

export function FehlerMelder() {
  useEffect(() => {
    // Mehrfach-Registrierung vermeiden (StrictMode montiert doppelt).
    const w = window as Window & { __makeFehlerMelder?: boolean };
    if (w.__makeFehlerMelder) return;
    w.__makeFehlerMelder = true;

    const melde = (art: 'fehler' | 'versprechen' | 'react', text: string, quelle?: string) => {
      try {
        fetch('/api/client-fehler', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ art, text: text.slice(0, 600), quelle, seite: location.pathname }),
          keepalive: true,
        }).catch(() => { /* Melden darf nie selbst stören */ });
      } catch { /* still */ }
    };

    const onError = (e: ErrorEvent) => {
      melde('fehler', e.message || String(e.error ?? 'Unbekannter Fehler'), e.filename ? `${e.filename}:${e.lineno}` : undefined);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      melde('versprechen', r instanceof Error ? `${r.message}\n${(r.stack ?? '').split('\n').slice(0, 3).join('\n')}` : String(r));
    };

    // React meldet Hydration- und Render-Probleme über console.error —
    // deshalb hören wir dort mit, ohne die Ausgabe zu verändern.
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      try {
        const text = args.map(a => (a instanceof Error ? a.message : typeof a === 'string' ? a : '')).filter(Boolean).join(' ');
        if (text && !text.startsWith('[MAKE OS]')) melde('react', text);
      } catch { /* still */ }
      originalError.apply(console, args as []);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      console.error = originalError;
      w.__makeFehlerMelder = false;
    };
  }, []);

  return null;
}
