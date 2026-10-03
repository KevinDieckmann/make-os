// ─── Kalender — die Google-Kalender in MAKE OS beim Namen nennen (Server, 03.10.2026) ──
// Person → Name ihres Google-Kalenders („MAKE Kevin (Google)“) und umgekehrt. Nur Personen mit aktiver, SCHREIBBARER
// Verbindung für die Funktion „kalender“ und einem gewählten Kalender. Eigene Datei, damit die Einstellungen
// (`ladeEinstellungen`) und die Zuordnung (`ziel.ts`) sie nutzen können, ohne sich im Kreis zu importieren.

import { alleSpeicher } from '@/lib/zugang/konten';
import { personenMit } from '@/lib/google/verbindung';
import { ladeGoogleStand } from './stand';

/** Person → Kalendername. Fehler (Bestand nicht lesbar) → leer: nie ein Grund, den Kalender zu sperren. */
export async function googleKalenderNamen(): Promise<Record<string, string>> {
  try {
    const personen = await personenMit('kalender', await alleSpeicher().catch(() => [] as string[]));
    const raus: Record<string, string> = {};
    for (const p of personen) {
      const s = await ladeGoogleStand(p);
      if (s && s.schreibbar) raus[p] = s.kalenderName;
    }
    return raus;
  } catch { return {}; }
}

/** Kalendername → Person (für die Zuordnung „wem gehört der Kalender“ und den Space „Business“). */
export async function googleNamenZuPerson(): Promise<Record<string, string>> {
  return Object.fromEntries(Object.entries(await googleKalenderNamen()).map(([p, n]) => [n, p]));
}

/** Gibt es irgendeine Kalender-Quelle: iCloud (Zugang in der Umgebung) oder ein verbundener Google-Kalender? */
export async function kalenderQuelleDa(): Promise<boolean> {
  const { verbunden } = await import('../icloud');
  return verbunden() || Object.keys(await googleKalenderNamen()).length > 0;
}
