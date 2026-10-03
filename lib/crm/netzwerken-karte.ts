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

// ─── KI-Transkript der Sprachnotiz (vorbereitet, abgeschaltet; 03.10., netz-recht) ──
// Die Sprachnotiz ist heute nur Audio (verschlüsselt am Kontakt, 90 Tage). Ein Transkript würde die Stimme eines Menschen an einen
// KI-Anbieter schicken — das geht erst mit Auftragsverarbeitungsvertrag und Standardvertragsklauseln/DPF des Anbieters (Art. 28, 44 ff. DSGVO).
// Deshalb ein SERVER-Schalter, Standard AUS: `TRANSKRIPTION_AN=1` in der Umgebung des Servers (nie `NEXT_PUBLIC_`, nie im Browser). Läuft
// das Transkript einmal, ERSETZT es das Audio (Text als Notiz am Kontakt, die Audio-Datei fällt weg) — so liegt die Stimme nie länger als nötig.
// Nichts schaltet das ein: dieser Haken liefert heute immer `null`.

/** Server-Schalter: nur mit gesetzter Umgebungsvariable `TRANSKRIPTION_AN=1` — sonst aus. */
export const transkriptionAn = (): boolean => process.env.TRANSKRIPTION_AN === '1';
/** Regel für später: ein erfolgreiches Transkript ersetzt das Audio. */
export const TRANSKRIPT_ERSETZT_AUDIO = true;

/** Sprachnotiz → Text oder `null` (abgeschaltet, nicht erkannt). Heute: nie ein Aufruf nach außen. */
export async function sprachnotizTranskribieren(_bytes: Uint8Array, _typ: string): Promise<string | null> {
  if (!transkriptionAn()) return null;
  // Hier käme der Aufruf des Anbieters — erst nach AVV/SCC. Bis dahin auch bei gesetztem Schalter: nichts senden.
  return null;
}
