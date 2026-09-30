'use client';

// ─── MAKE OS — Zeitstrahl: das sichtbare Fenster (30.09.) ───────────────────
// Kevin: „einzeln nach vorne und einzeln nach hinten scrollen“. Das Fenster sind
// ganze Monate: die Zeitraum-Wahl gibt die Breite (12 · 24 · 18, am Handy 6),
// `ab` den ersten Monat. Beides steht in der Adresse (`?raum=`, `?ab=2026-10`),
// damit Neuladen und geteilte Links die Stelle behalten; die Wahl wird je
// Gerät gemerkt (RAUM_MERKER, wie die anderen Ansichts-Merker). Ohne `ab` gilt
// der Standard der Wahl — „Heute“ springt dorthin zurück. Keine feste Grenze.
// Die Rechnung liegt rein in lib/planung/zeitstrahl.ts; hier nur Zustand + Adresse.

import { useCallback, useEffect, useRef, useState } from 'react';
import { localDay } from '@/lib/zeit';
import {
  RAUM_MERKER, STRAHL_STANDARD, abAus, blaettern as blaetternUm, fenster as fensterAus, fensterMonate, heuteAb, heuteIm,
  raumAus, standardAb, type Fenster, type StrahlRaum,
} from '@/lib/planung/zeitstrahl';

const lies = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const merke = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* egal */ } };

/** Adress-Parameter setzen/entfernen, ohne neu zu laden (die Seite liest sie selbst). */
export function adresseSetzen(patch: Record<string, string | null>) {
  if (typeof window === 'undefined') return;
  const u = new URL(window.location.href);
  for (const [k, v] of Object.entries(patch)) { if (v == null) u.searchParams.delete(k); else u.searchParams.set(k, v); }
  const neu = `${u.pathname}${u.search}${u.hash}`;
  if (neu !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, '', neu);
}

export interface StrahlFenster {
  raum: StrahlRaum;
  setRaum: (r: StrahlRaum) => void;
  fenster: Fenster;
  /** Um n Monate blättern (negativ = zurück). */
  blaettern: (n: number) => void;
  /** Zurück zu dem Fenster, in dem HEUTE steht. */
  zuHeute: () => void;
  /** Steht HEUTE im Fenster? (dann ist der Knopf „Heute“ leise) */
  heuteSichtbar: boolean;
  /** Vom Zeitstrahl gemessene Breite — daraus die Monate im Fenster (Handy weniger). */
  setBreite: (px: number) => void;
}

export function useStrahlFenster(planJahr: number): StrahlFenster {
  const heute = localDay();
  const [raum, setRaumRoh] = useState<StrahlRaum>(STRAHL_STANDARD);
  const [ab, setAb] = useState<string | null>(null);
  const [breite, setBreite] = useState(0);

  // Adresse gewinnt, sonst der Merker, sonst der Standard — nach dem ersten Zeichnen (kein Suspense nötig).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setRaumRoh(raumAus(q.get('raum')) ?? raumAus(lies(RAUM_MERKER)) ?? STRAHL_STANDARD);
    setAb(abAus(q.get('ab'), localDay()));
  }, []);

  // Wer bei „Dieses Jahr“ das Planungsjahr wechselt, will dieses Jahr sehen — nicht die alte Stelle.
  const vorher = useRef(planJahr);
  useEffect(() => {
    if (vorher.current === planJahr) return;
    vorher.current = planJahr;
    if (raum === 'jahr') { setAb(null); adresseSetzen({ ab: null }); }
  }, [planJahr, raum]);

  const monate = fensterMonate(raum, breite);
  const aktuellAb = ab ?? standardAb(raum, heute, monate, planJahr);
  const f = fensterAus(aktuellAb, monate);

  const setRaum = useCallback((r: StrahlRaum) => {
    setRaumRoh(r); merke(RAUM_MERKER, r); setAb(null);
    adresseSetzen({ raum: r, ab: null });
  }, []);
  const blaettern = useCallback((n: number) => {
    if (!n) return;
    const neu = blaetternUm(aktuellAb, n);
    setAb(neu); adresseSetzen({ ab: neu });
  }, [aktuellAb]);
  const zuHeute = useCallback(() => {
    const ziel = heuteAb(raum, heute, monate);
    const standard = standardAb(raum, heute, monate, planJahr);
    setAb(ziel === standard ? null : ziel);
    adresseSetzen({ ab: ziel === standard ? null : ziel });
  }, [raum, heute, monate, planJahr]);

  return { raum, setRaum, fenster: f, blaettern, zuHeute, heuteSichtbar: heuteIm(f, heute), setBreite };
}
