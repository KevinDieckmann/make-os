'use client';
// ─── Ist die angemeldete Person Inhaber? (09.10., Endprüfung — Seiten-Durchlauf) ─────────────────────────────────────────
// Inhaber-Bausteine (WHOOP-Export vom Mac, Mac-Zulieferer, OAuth-Verbindungen) riefen ihre Routen für JEDE Person auf — bei der zweiten
// Person standen dann 403 in der Konsole. Die Routen bleiben die Schranke (serverseitig); dieser Haken spart nur die sinnlose Anfrage.
// Einmal je Seite über `/api/konto/ich` (Feld `inhaber`, mehrere Inhaber möglich). `null` = noch unbekannt.
import { useEffect, useState } from 'react';

let anfrage: Promise<boolean> | null = null;

export function useInhaber(): boolean | null {
  const [inhaber, setInhaber] = useState<boolean | null>(null);
  useEffect(() => {
    let lebt = true;
    if (!anfrage) anfrage = fetch('/api/konto/ich', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => !!(d as { inhaber?: boolean } | null)?.inhaber).catch(() => false);
    void anfrage.then(v => { if (lebt) setInhaber(v); });
    return () => { lebt = false; };
  }, []);
  return inhaber;
}
