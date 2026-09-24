'use client';

// ─── MAKE OS — Protokollant ─────────────────────────────────────────────────
// Hängt sich EINMAL in fetch ein und meldet jede erfolgreiche Änderung an
// einem Bestand ans Änderungsprotokoll: wer, was, von welcher Seite.
//
// Warum an dieser Stelle und nicht in den 80 Routen: der Server sieht nicht,
// WER schreibt — die Person steht im Browser (jeder Rechner hat seinen eigenen
// Arbeitsplatz). Ein einziger Haken hier deckt alles ab, auch alles, was
// später dazukommt.
//
// Es wird nichts vom Inhalt gelesen und nichts verändert — nur beobachtet.

import { useEffect } from 'react';
import { personLesen } from '@/lib/make-one/arbeitsplatz-browser';

/** Nicht protokollieren: das Protokoll selbst und reine Mitschriften. */
const STILL = new Set(['aenderungen', 'nutzung', 'client-fehler', 'arbeitsplatz', 'anwesenheit']);

export function Protokollant() {
  useEffect(() => {
    const w = window as Window & { __makeProtokoll?: boolean; fetch: typeof fetch };
    if (w.__makeProtokoll) return;
    w.__makeProtokoll = true;

    const original = w.fetch.bind(w);

    w.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const antwort = await original(input, init);
      try {
        const art = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (art === 'GET' || art === 'HEAD' || !antwort.ok) return antwort;

        const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
        const treffer = /\/api\/state\/([a-z0-9-]+)/i.exec(url);
        if (!treffer || STILL.has(treffer[1])) return antwort;

        original('/api/state/aenderungen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bestand: treffer[1], art, person: personLesen(), seite: location.pathname,
          }),
          keepalive: true,
        }).catch(() => { /* Protokollieren darf nie stören */ });
      } catch { /* still */ }
      return antwort;
    };

    return () => { w.fetch = original; w.__makeProtokoll = false; };
  }, []);

  return null;
}
