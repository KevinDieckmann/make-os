// ─── Netzwerken — Karte automatisch auslesen (vorbereitet, abgeschaltet; 02.10.) ──
// Die Schnittstelle für die spätere KI-Erkennung: Fotos der Visitenkarte rein, Felder raus. Heute ist sie AUS — die Felder
// füllt die Person von Hand aus, die Fotos gehen unverändert in die Dateiablage. Die Oberfläche (components/os/netzwerken/
// Erfassen.tsx) ruft `karteAuslesen` nach jedem Foto auf und übernimmt zurückgegebene Felder nur in LEERE Eingabefelder —
// sobald die Erkennung läuft (in ein bis zwei Wochen), schaltet nur `KARTE_AUSLESEN_AN` um und die Funktion liefert Felder.
// Anders als der ältere Weg `/api/crm/visitenkarte` (ein Foto, nicht gespeichert, sofort an das Modell) gehört hier das Foto
// zur Erfassung: mehrere Bilder (Vorder- und Rückseite), verschlüsselt am Kontakt abgelegt, die Erkennung liest nur mit.

import type { KontaktFelder } from './netzwerken';

/** Die Erkennung ist noch nicht eingeschaltet. */
export const KARTE_AUSLESEN_AN = false;

/** Ein Foto der Karte: Base64 ohne Präfix und sein Medientyp. */
export interface KartenBild { daten: string; typ: string }

/**
 * Fotos der Karte → erkannte Felder oder `null` (nicht erkannt bzw. abgeschaltet). Nie erfinden: nur, was auf der Karte
 * steht; ein zurückgegebenes Feld ersetzt nie etwas, das die Person schon getippt hat.
 */
export async function karteAuslesen(_bilder: readonly KartenBild[]): Promise<Partial<KontaktFelder> | null> {
  if (!KARTE_AUSLESEN_AN) return null;
  return null;
}

/** Erkannte Felder in die Eingabe übernehmen — nur dort, wo noch nichts steht. */
export function ausgelesenesUebernehmen(eingabe: KontaktFelder, erkannt: Partial<KontaktFelder> | null): KontaktFelder {
  if (!erkannt) return eingabe;
  const raus: KontaktFelder = { ...eingabe };
  for (const [k, v] of Object.entries(erkannt) as [keyof KontaktFelder, string | undefined][]) {
    if (typeof v === 'string' && v.trim() && !(raus[k] ?? '').toString().trim()) (raus as Record<string, string>)[k] = v;
  }
  return raus;
}
