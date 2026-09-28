// ─── Meldungen (Glocke oben rechts, 28.09. abends) — Schnittstelle ─────────────
// Kevin/Malin: „Wenn Kevin Malin eine Aufgabe zuteilt, bekommt sie eine Benachrichtigung —
// oben rechts leuchtet es rot.“ Gemeldet werden: Zuweisung an mich, Kommentar/Erwähnung,
// fällig/überfällig. Telegram ist mitgedacht (Kanal-Feld), kommt aber erst später.
//
// Diese Datei legt NUR die Schnittstelle fest, damit Aufgaben-Umbau und Glocke parallel
// gebaut werden können. Die Umsetzung (Speicher je Person, API, Kopf-Glocke) folgt im Paket „Glocke“.

export type MeldungArt = 'zuweisung' | 'kommentar' | 'erwaehnung' | 'faellig' | 'ueberfaellig';

export interface MeldungEingabe {
  /** Empfänger: Speichername der Person (z. B. „malin“). Nie an sich selbst melden. */
  an: string;
  art: MeldungArt;
  /** Kurzer Satz ohne vertrauliche Werte, z. B. „Kevin hat dir „Belege Januar“ zugewiesen“. */
  titel: string;
  /** Ziel in MAKE OS, z. B. WEG.aufgabe(id). */
  link: string;
  /** Auslöser (Speichername), falls eine Person. */
  von?: string;
  /** Worum es geht — für Zusammenfassen/Entdoppeln (eine offene Meldung je Bezug und Art). */
  bezug?: { art: 'aufgabe'; id: string };
}

/**
 * Meldung ablegen (serverseitig). Bis das Paket „Glocke“ fertig ist, tut sie nichts —
 * Aufrufer dürfen sie schon jetzt benutzen. Wirft nie; ein Fehler beim Melden bricht keinen Schreibweg ab.
 */
export async function melde(_m: MeldungEingabe): Promise<void> {
  // Umsetzung folgt im Paket „Glocke“ (lib/meldungen/speicher.ts).
}
