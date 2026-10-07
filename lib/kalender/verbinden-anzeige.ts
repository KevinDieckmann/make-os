// ─── Kalender — „verbinden“ dort zeigen, wo es hingehört (rein, client-sicher, 06.10.2026) ─
// Kevin 06.10.: Im Kalender-Bereich Business steht gut sichtbar „<Firma> verbinden“, solange die EIGENE Person ihren Google-
// Kalender (Workspace) nicht verbunden hat — im Bereich Privat ebenso die eigene iCloud-Verbindung. Nicht nur in den Einstellungen.
// Diese Datei entscheidet nur, WAS gezeigt wird (Karte, kleiner Hinweis, nichts) — die Daten kommen aus den Status-Routen der
// eigenen Person (/api/kalender/google, /api/kalender/icloud; nie Zugangsdaten). Bereichstrennung: Google nur unter Business,
// iCloud nur unter Privat; „Alles“ zeigt keine Karte (die Einstellungen bleiben der Ort für alles zusammen).

export type KalenderBereich = 'alle' | 'privat' | 'business';

/** Was die Business-Seite über die eigene Google-Verbindung weiß (Ausschnitt aus GET /api/kalender/google). */
export interface GoogleKurz { konfiguriert: boolean; verbunden: boolean; getrennt?: { grund: string; seit?: string } | null; konto?: string }
/** Was die Privat-Seite über die eigene iCloud-Verbindung weiß (Ausschnitt aus GET /api/kalender/icloud). */
export interface IcloudKurz { verbunden: boolean; anmeldung?: boolean; haupt?: boolean; konto?: string }

export type Anzeige = 'karte' | 'hinweis' | null;

/**
 * Business: nicht verbunden (auch: getrennt, noch nicht eingerichtet) → Karte; verbunden → kleiner Hinweis. Privat: nicht verbunden
 * oder App-Passwort ungültig → Karte; verbunden → kleiner Hinweis. Ohne Status (lädt, Fehler) → nichts. Andere Bereiche → nichts.
 */
export function verbindenAnzeige(bereich: KalenderBereich, google: GoogleKurz | null, icloud: IcloudKurz | null): { google: Anzeige; icloud: Anzeige } {
  return {
    google: bereich !== 'business' || !google ? null : google.verbunden ? 'hinweis' : 'karte',
    icloud: bereich !== 'privat' || !icloud ? null : !icloud.verbunden || icloud.anmeldung ? 'karte' : 'hinweis',
  };
}

/** „MAKE Innovation GmbH“ → „MAKE Innovation“ — der Name kommt aus der Instanz (lib/einheiten.ts), nie fest im Code. */
export function firmaOhneRechtsform(name: string): string {
  const n = name.trim().replace(/\s+(GmbH(\s*&\s*Co\.?\s*KG)?|UG(\s*\(haftungsbeschränkt\))?|AG|KG|OHG|e\.\s?K\.|GbR|SE|Ltd\.?|Inc\.?)$/i, '').trim();
  return n || name.trim();
}
