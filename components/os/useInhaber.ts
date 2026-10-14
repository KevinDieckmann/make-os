'use client';
// ─── Ist die angemeldete Person Inhaber? (09.10., Endprüfung — Seiten-Durchlauf) ─────────────────────────────────────────
// Inhaber-Bausteine (WHOOP-Export vom Mac, Mac-Zulieferer, OAuth-Verbindungen) riefen ihre Routen für JEDE Person auf — bei der zweiten
// Person standen dann 403 in der Konsole. Die Routen bleiben die Schranke (serverseitig); dieser Haken spart nur die sinnlose Anfrage.
// Einmal je Seite über `/api/konto/ich` (Feld `inhaber`, mehrere Inhaber möglich). `null` = noch unbekannt.
// Seit 09.10. (E4-Rest) liest dieselbe Anfrage auch `nurBusiness` (EINE Konto-Sicht, serverseitig gerechnet) — `useNurBusiness` für den
// Kopf-Schalter und den Fokus-Satz in „Alles“. Die Trennung selbst geschieht auf dem Server; der Browser blendet nur aus, was leer bliebe.
import { useEffect, useState } from 'react';

interface Ich { inhaber: boolean; nurBusiness: boolean; betreiber: boolean }
let anfrage: Promise<Ich> | null = null;
const ich = (): Promise<Ich> => {
  if (!anfrage) {
    anfrage = fetch('/api/konto/ich', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => ({ inhaber: !!(d as { inhaber?: boolean } | null)?.inhaber, nurBusiness: !!(d as { nurBusiness?: boolean } | null)?.nurBusiness, betreiber: !!(d as { betreiber?: boolean } | null)?.betreiber }))
      .catch(() => ({ inhaber: false, nurBusiness: false, betreiber: false }));
  }
  return anfrage;
};

function useIchFeld(feld: keyof Ich): boolean | null {
  const [wert, setWert] = useState<boolean | null>(null);
  useEffect(() => {
    let lebt = true;
    void ich().then(v => { if (lebt) setWert(v[feld]); });
    return () => { lebt = false; };
  }, [feld]);
  return wert;
}

export function useInhaber(): boolean | null {
  return useIchFeld('inhaber');
}

/**
 * Ist das die Betreiber-Instanz (14.10., lib/betrieb/betreiber.ts — der Server entscheidet)? Nur dann nennen Texte den Weg am Server; sonst
 * „richtet der Betreiber eurer Instanz ein“. `null` = noch unbekannt (dann neutral).
 */
export function useBetreiber(): boolean | null {
  return useIchFeld('betreiber');
}

/** Sieht das angemeldete Konto nur den Business-Bereich (`finanzRecht: 'business'`)? `null` = noch unbekannt. */
export function useNurBusiness(): boolean | null {
  return useIchFeld('nurBusiness');
}
