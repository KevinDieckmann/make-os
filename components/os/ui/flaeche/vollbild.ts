'use client';

// ─── Standard · Fläche — Vollbild per Knopf (21.10.; research/prozesse/ANALYSE_100.md Punkt 11) ──────────────────────────────────────────────
// Rückmeldung 21.10.: „Die Fläche muss sich aufklappen oder größer machen lassen, damit ich da spielen kann, zu einem ganzen Bildschirm.“ EIN Weg für jede Fläche
// (Prozesse: Landkarte und jeder Prozess; Fulfillment: Prozess-Editor):
//   · `?voll=1` in der Adresse — Browser-Zurück verlässt das Vollbild, ein Link öffnet es direkt.
//   · Die Ansicht legt sich als festes Overlay über Leiste und Kopf (die Werkzeuge schweben); dazu, wo der Browser es kann, die Fullscreen-API des
//     Dokuments (nie eines einzelnen Elements — Menüs, die in den Body springen, blieben sonst unsichtbar).
//   · Esc bzw. „Schließen“ führt zurück; verlässt der Browser sein Vollbild selbst (Esc), folgt die Adresse.
// Der Rand: `vollAdresse` ist rein (Tests: tests/prozesse-oberflaeche.test.ts).

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { vollAdresse } from '@/lib/make-one/werkzeuge';

// Die Adresse mit bzw. ohne Vollbild: EINE Regel für Flächen und Werkzeuge (22.10., Werkzeug-Muster — der Werkzeugmodus IST dieses Vollbild).
export { vollAdresse };

const nativAn = () => typeof document !== 'undefined' && !!document.fullscreenElement;

/**
 * Vollbild der Fläche: Zustand aus der Adresse, `an` (aus einem Klick — die Fullscreen-API braucht die Geste; `zusatz` setzt weitere Parameter, z. B.
 * `modus: 'praesentieren'`), `aus` (Esc, Schließen).
 */
export function useVollbild(): { voll: boolean; an: (zusatz?: Record<string, string>) => void; aus: () => void } {
  const router = useRouter();
  const pfad = usePathname() ?? '';
  const params = useSearchParams();
  const suche = params?.toString() ?? '';
  const voll = params?.get('voll') === '1' || params?.get('modus') === 'praesentieren';
  const selbst = useRef(false);
  /** Gerade beim Verlassen (das eigene `exitFullscreen` meldet sich gleich noch einmal — nie zweimal zurück). */
  const verlassen = useRef(false);
  const stand = useRef({ pfad, suche, voll });
  stand.current = { pfad, suche, voll };

  const aus = useCallback(() => {
    if (verlassen.current) return;
    if (nativAn()) void document.exitFullscreen?.().catch(() => undefined);
    if (!stand.current.voll) return;
    verlassen.current = true;
    // Selbst geöffnet: einen Schritt zurück (kein doppelter Verlaufseintrag); per Link geöffnet: die Adresse ohne Vollbild.
    if (selbst.current) { selbst.current = false; router.back(); }
    else router.replace(vollAdresse(stand.current.pfad, stand.current.suche, false), { scroll: false });
  }, [router]);
  const an = useCallback((zusatz: Record<string, string> = {}) => {
    try { const r = document.documentElement.requestFullscreen?.(); if (r) void r.catch(() => undefined); } catch { /* nur das Overlay */ }
    const q = new URLSearchParams(stand.current.suche);
    for (const [k, v] of Object.entries(zusatz)) q.set(k, v);
    const ziel = vollAdresse(stand.current.pfad, q.toString(), true);
    if (stand.current.voll) { router.replace(ziel, { scroll: false }); return; }
    selbst.current = true;
    router.push(ziel, { scroll: false });
  }, [router]);

  // Der Browser verlässt sein Vollbild (Esc) → die Adresse folgt; die Adresse verlässt das Vollbild (Zurück) → der Browser folgt.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const wechsel = () => { if (!nativAn() && stand.current.voll && !verlassen.current) aus(); };
    document.addEventListener('fullscreenchange', wechsel);
    return () => document.removeEventListener('fullscreenchange', wechsel);
  }, [aus]);
  useEffect(() => {
    if (!voll) verlassen.current = false;
    if (!voll && nativAn()) void document.exitFullscreen?.().catch(() => undefined);
    if (!voll || typeof document === 'undefined') return;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = vorher; };
  }, [voll]);
  return { voll, an, aus };
}
