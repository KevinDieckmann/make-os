// ─── Meldungen (Glocke oben rechts, 28.09. abends) — Schnittstelle ─────────────
// Kevin/Malin: „Wenn Kevin Malin eine Aufgabe zuteilt, bekommt sie eine Benachrichtigung —
// oben rechts leuchtet es rot.“ Gemeldet werden: Zuweisung an mich, Kommentar/Erwähnung,
// fällig/überfällig. Telegram ist mitgedacht (Kanal-Feld), kommt aber erst später.
//
// Diese Datei legt die Schnittstelle fest (Aufgaben-Umbau und Glocke wurden parallel gebaut).
// Umsetzung seit Paket „Glocke“ (B2): Speicher je Person `lib/meldungen/speicher.ts`, reine Regeln
// `lib/meldungen/regeln.ts`, Route `/api/meldungen`, Glocke `components/os/Glocke.tsx` im Kopf.

/** `zoe` (Paket C4): ZOE hat eine Aufgabe vorbereitet — an die Auftraggeberin, `von: 'zoe'`.
 *  `buchung` (29.09., K4): neue Terminanfrage über eine Buchungsseite — an die Person der Seite.
 *  `kalender` (29.09., F1 #5): ein Kalender-Spiegel (Event, Date, Paar-Gespräch) ließ sich nicht nachziehen — an die
 *  Person, die die Änderung ausgelöst hat (lib/kalender/spiegel-server.ts `spiegelHinweiseMelden`). */
/**
 * `buchung-termin` (Restpunkte 29.09.): „… Termin im Kalender entfernen?“ zu einer Buchung (id = Buchungs-Kennung) — eigene
 * Erledigt-Regel „Termin gelöst“: erledigt, sobald die Buchung keinen Termin-Verweis mehr hat oder der Termin nicht mehr
 * im iCloud-Stand steht (lib/meldungen/regeln.ts `buchungenErledigen`).
 */
export interface MeldungBezug { art: 'aufgabe' | 'buchung' | 'buchung-termin' | 'netzwerken'; id: string }
/**
 * `netzwerken` (02.10.): jemand hat dir beim Netzwerken einen Termin gebucht oder eine Person zugeteilt (Bezug `netzwerken` =
 * Kennung der Erfassung, eine Meldung je Erfassung) — gespeichert in der Glocke der anderen Person, das Pop-up zeigt sie einmal.
 */
/**
 * `sicherheit` (03.10.): etwas am eigenen Zugang hat sich geändert (Anmelde-Adresse hinzugefügt/zur Hauptadresse gemacht/entfernt) —
 * an das Konto selbst, damit eine fremde Änderung auffällt. Der Titel nennt die Adresse nur maskiert.
 */
export type MeldungArt = 'zuweisung' | 'kommentar' | 'erwaehnung' | 'faellig' | 'ueberfaellig' | 'zoe' | 'buchung' | 'kalender' | 'netzwerken' | 'sicherheit';

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
  /**
   * Worum es geht — für Zusammenfassen/Entdoppeln (eine offene Meldung je Bezug und Art). `buchung` (Nachtrag F1): die
   * Meldung „Neue Terminanfrage“ gilt als erledigt, sobald die Buchung nicht mehr „angefragt“ ist (lib/meldungen/speicher.ts).
   */
  bezug?: MeldungBezug;
}

/**
 * Meldung ablegen (serverseitig). Wirft nie; ein Fehler beim Melden bricht keinen Schreibweg ab.
 * Nie an sich selbst (`von === an` → nichts), nur an Personen im Haushalt des Inhabers.
 * Der Speicher wird dynamisch geladen — Aufrufer ziehen so keine Platten-Module in fremde Bündel.
 */
export async function melde(m: MeldungEingabe): Promise<void> {
  try {
    const { meldungAblegen } = await import('./speicher');
    const r = await meldungAblegen(m);
    if (!r.ok && r.grund !== 'nie an sich selbst') console.warn(`[meldungen] nicht abgelegt: ${r.grund ?? 'unbekannt'}`);
  } catch (e) {
    console.warn(`[meldungen] nicht abgelegt: ${e instanceof Error ? e.message.slice(0, 160) : 'Fehler'}`);
  }
}
