// ─── Prozesse × Fulfillment — welche Mandate laufen schon in einem Prozess der Werkstatt (Server, 22.10.; Kevin: „Dort ausblenden“) ──────────────────────
// Liest NUR den Bestand der Läufe (`prozess-laeufe--<h>`, roh über `laeufeAus`), schreibt nie, wirft nie: bei einem Lesefehler die leere Menge — dann
// rechnen die Kandidaten des Fulfillments wie vorher (lieber einmal zu viel „Fall starten?“ als ein Mandat ohne Ablauf). Die Regel selbst ist rein:
// lib/prozesse/produkt-bindung.ts `mandateMitProduktLauf`. Genutzt von der EINEN Kandidaten-Rechnung (lib/fulfillment/regeln.ts `onboardingKandidaten`) über
// ihre beiden Aufrufer (GET /api/fulfillment → `kandidatenAnsicht`, Morgenlauf-Vorschläge).

import type { CrmBestand } from '@/lib/crm/typen';

export async function mandateMitProduktLaufLesen(crm: Pick<CrmBestand, 'mandate' | 'leistungen'>): Promise<Set<string>> {
  try {
    const [{ loadJson }, { laeufeBestand }, { laeufeAus }, { prozesseHaushalt }, { mandateMitProduktLauf }] = await Promise.all([
      import('@/lib/store/local-db'), import('./lauf-typen'), import('./lauf-regeln'), import('./werkstatt-server'), import('./produkt-bindung'),
    ]);
    const d = laeufeAus(await loadJson<unknown>(laeufeBestand(await prozesseHaushalt())));
    return mandateMitProduktLauf(d.laeufe, crm);
  } catch {
    return new Set();
  }
}
