'use client';
// ─── Anfrage-Bündler einhängen (27.09.) ──────────────────────────────────────
// Liegt einmal im /os-Rahmen. Ab dann teilen sich alle Widgets, Leisten und
// Ansichten gleiche GET-Abfragen an /api/… (lib/http/anfrage-buendel.ts).
// Sichtbar nur an einer Stelle: window.__makeAnfragen.stand() zeigt, was
// gerade läuft; `leeren()` wirft den kurzen Zwischenspeicher weg.
import { useEffect } from 'react';
import { buendelnderFetch } from '@/lib/http/anfrage-buendel';

declare global { interface Window { __makeAnfragen?: ReturnType<typeof buendelnderFetch> } }

export function AnfrageBuendel() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.__makeAnfragen) return;
    const original = window.fetch.bind(window);
    const b = buendelnderFetch(original, window.location.origin, {
      // Der Verlauf und der Stapel wollen beim Nachfragen den echten Stand — die
      // Komponenten dort takten selbst; hier nur die kurze Teilung laufender Abfragen.
      frischMs: 8_000,
      ausnahmen: ['/api/zoe/chat', '/api/zoe/stimme', '/api/hoi/'],
    });
    window.__makeAnfragen = b;
    window.fetch = b;
    // Zurück zum Ursprung, falls der Rahmen einmal abgebaut wird (Abmelden).
    return () => { if (window.__makeAnfragen === b) { window.fetch = original; delete window.__makeAnfragen; } };
  }, []);
  return null;
}
