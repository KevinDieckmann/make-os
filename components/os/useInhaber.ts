'use client';
// ─── Ist die angemeldete Person Inhaber? (09.10., Endprüfung — Seiten-Durchlauf) ─────────────────────────────────────────
// Inhaber-Bausteine (WHOOP-Export vom Mac, Mac-Zulieferer, OAuth-Verbindungen) riefen ihre Routen für JEDE Person auf — bei der zweiten
// Person standen dann 403 in der Konsole. Die Routen bleiben die Schranke (serverseitig); dieser Haken spart nur die sinnlose Anfrage.
// Einmal je Seite über `/api/konto/ich` (Feld `inhaber`, mehrere Inhaber möglich). `null` = noch unbekannt.
// Seit 09.10. (E4-Rest) liest dieselbe Anfrage auch `nurBusiness` (EINE Konto-Sicht, serverseitig gerechnet) — `useNurBusiness` für den
// Kopf-Schalter und den Fokus-Satz in „Alles“. Die Trennung selbst geschieht auf dem Server; der Browser blendet nur aus, was leer bliebe.
import { useEffect, useState } from 'react';

interface Ich { inhaber: boolean; nurBusiness: boolean; betreiber: boolean; haushaltZugang: boolean; privatFinanzen: boolean }
let anfrage: Promise<Ich> | null = null;
const FELDER: (keyof Ich)[] = ['inhaber', 'nurBusiness', 'betreiber', 'haushaltZugang', 'privatFinanzen'];
const ich = (): Promise<Ich> => {
  if (!anfrage) {
    anfrage = fetch('/api/konto/ich', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => Object.fromEntries(FELDER.map(f => [f, !!(d as Partial<Record<keyof Ich, unknown>> | null)?.[f]])) as unknown as Ich)
      .catch(() => Object.fromEntries(FELDER.map(f => [f, false])) as unknown as Ich);
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

/**
 * Zugang zu den privaten Haushaltsfinanzen (15.10., Abnahme 2 B8 — Regel `haushaltFuer`, wie `/api/haushalt?nur=zugang`): Seiten fragen hier,
 * statt eine Anfrage zu stellen, die für ein Konto „nur Business“ mit 403 endet. `null` = noch unbekannt.
 */
export function useHaushaltZugang(): boolean | null {
  return useIchFeld('haushaltZugang');
}

/** Privater Finanzzugang (`privatFinanzZugang`: volles Mitglied im Haushalt des Inhabers) — Liquiplan, Buchungen, Finanzplan voll. */
export function usePrivatFinanzen(): boolean | null {
  return useIchFeld('privatFinanzen');
}
