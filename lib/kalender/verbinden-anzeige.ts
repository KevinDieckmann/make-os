// ─── Kalender — „verbinden“ dort zeigen, wo es hingehört (rein, client-sicher, 06.10.2026) ─
// Kevin 06.10.: Im Kalender-Bereich Business steht gut sichtbar „<Firma> verbinden“, solange die EIGENE Person ihren Google-
// Kalender (Workspace) nicht verbunden hat — im Bereich Privat ebenso die eigene iCloud-Verbindung. Nicht nur in den Einstellungen.
// Diese Datei entscheidet nur, WAS gezeigt wird (Karte, kleiner Hinweis, nichts) — die Daten kommen aus den Status-Routen der
// eigenen Person (/api/kalender/google, /api/kalender/icloud; nie Zugangsdaten). Bereichstrennung: Google nur unter Business,
// iCloud nur unter Privat; „Alles“ zeigt keine Karte (die Einstellungen bleiben der Ort für alles zusammen).

export type KalenderBereich = 'alle' | 'privat' | 'business';

/**
 * Was die Business-Seite über die eigene Google-Verbindung weiß (Ausschnitt aus GET /api/kalender/google). `verbunden` = die
 * ALLGEMEINE Google-Verbindung (z. B. nur für Gmail); `bereit` = die Funktionen, deren Freigaben bei Google vollständig sind
 * (`googleStatus`) — für den Kalender zählt nur `bereit` enthält „kalender“.
 */
export interface GoogleKurz { konfiguriert: boolean; verbunden: boolean; getrennt?: { grund: string; seit?: string } | null; konto?: string; bereit?: readonly string[] }
/** Was die Privat-Seite über die eigene iCloud-Verbindung weiß (Ausschnitt aus GET /api/kalender/icloud). */
export interface IcloudKurz { verbunden: boolean; anmeldung?: boolean; haupt?: boolean; konto?: string }

export type Anzeige = 'karte' | 'hinweis' | null;

/** Der Google-Kalender ist nutzbar: verbunden UND die Kalender-Freigaben sind bei Google vollständig. */
export const googleKalenderBereit = (g: GoogleKurz): boolean => g.verbunden && !!g.bereit?.includes('kalender');

/**
 * Google ist verbunden (z. B. zuerst nur für Gmail), aber die Kalender-Freigabe fehlt — dann heißt es „Kalender bei Google
 * freigeben“ (inkrementell ergänzen, Gmail bleibt), nicht „verbinden“ und schon gar nicht „trennen“ (09.10.2026).
 */
export const googleKalenderFreigabeFehlt = (g: GoogleKurz): boolean => g.verbunden && !googleKalenderBereit(g);

/**
 * Business: Kalender nicht bereit (nicht verbunden, getrennt, noch nicht eingerichtet ODER nur für Gmail verbunden) → Karte;
 * Kalender bereit → kleiner Hinweis. Privat: nicht verbunden oder App-Passwort ungültig → Karte; verbunden → kleiner Hinweis.
 * Ohne Status (lädt, Fehler) → nichts. Andere Bereiche → nichts.
 */
export function verbindenAnzeige(bereich: KalenderBereich, google: GoogleKurz | null, icloud: IcloudKurz | null): { google: Anzeige; icloud: Anzeige } {
  return {
    google: bereich !== 'business' || !google ? null : googleKalenderBereit(google) ? 'hinweis' : 'karte',
    icloud: bereich !== 'privat' || !icloud ? null : !icloud.verbunden || icloud.anmeldung ? 'karte' : 'hinweis',
  };
}

/** „MAKE Innovation GmbH“ → „MAKE Innovation“ — der Name kommt aus der Instanz (lib/einheiten.ts), nie fest im Code. */
export function firmaOhneRechtsform(name: string): string {
  const n = name.trim().replace(/\s+(GmbH(\s*&\s*Co\.?\s*KG)?|UG(\s*\(haftungsbeschränkt\))?|AG|KG|OHG|e\.\s?K\.|GbR|SE|Ltd\.?|Inc\.?)$/i, '').trim();
  return n || name.trim();
}
