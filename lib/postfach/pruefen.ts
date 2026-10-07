// ─── Postfächer — Verbindung prüfen, bevor etwas gespeichert wird (Server, 06.10.2026) ─────────────────────────────
// „Postfach hinzufügen“ und „Verbindung erneuern“ melden sich EINMAL beim Anbieter an, lesen die Ordnerliste (SPECIAL-USE: \Sent,
// \Archive; sonst bekannte Namen) und merken, ob der Server IDLE kann. Erst wenn das klappt, landen Register-Eintrag und Passwort im
// Bestand. SMTP wird hier nicht geprüft (ein Testversand wäre eine echte Mail) — scheitert das erste Senden an der Anmeldung, steht
// das als Fehler am Entwurf, nichts geht verloren.

import { VOREINSTELLUNGEN } from './anbieter';
import { leitungen, type OrdnerInfo } from './transport';
import type { Anbieter, Ordner, ServerAdresse } from './typen';

const GESENDET_NAMEN = /^(sent|sent messages|sent items|sent mail|gesendet|gesendete objekte|gesendete elemente|gesendete nachrichten)$/i;
const ARCHIV_NAMEN = /^(archive|archiv|archives|alle nachrichten|all mail)$/i;

const blatt = (pfad: string) => pfad.split(/[./]/).pop() ?? pfad;

/** Ordner aus der Liste bestimmen (rein): SPECIAL-USE zuerst, dann bekannte Namen (auch unter INBOX.*). */
export function ordnerBestimmen(liste: readonly OrdnerInfo[]): Ordner {
  const posteingang = liste.find(o => o.pfad.toUpperCase() === 'INBOX')?.pfad ?? 'INBOX';
  const gesendet = liste.find(o => o.specialUse === '\\Sent')?.pfad ?? liste.find(o => GESENDET_NAMEN.test(blatt(o.pfad)))?.pfad;
  const archiv = liste.find(o => o.specialUse === '\\Archive')?.pfad ?? liste.find(o => ARCHIV_NAMEN.test(blatt(o.pfad)) && o.specialUse !== '\\All')?.pfad;
  return { posteingang, ...(gesendet ? { gesendet } : {}), ...(archiv ? { archiv } : {}) };
}

export interface PruefErgebnis { ordner: Ordner; idle: boolean; posteingangAnzahl: number }

/** Einmal anmelden und die Ordner lesen. Wirft `PostfachFehler` (anmeldung · netz · tls · zeit · ziel …). */
export async function verbindungPruefen(z: { anbieter: Anbieter; imap: ServerAdresse; benutzer: string; passwort: string; adresse: string }): Promise<PruefErgebnis> {
  const l = await leitungen(z.anbieter === 'demo');
  const s = await l.imap({ host: z.imap.host, port: z.imap.port, benutzer: z.benutzer || VOREINSTELLUNGEN[z.anbieter].imapBenutzer(z.adresse), passwort: z.passwort });
  try {
    const ordner = ordnerBestimmen(await s.ordnerListe());
    const stand = await s.oeffnen(ordner.posteingang);
    return { ordner, idle: s.idle, posteingangAnzahl: stand.anzahl };
  } finally { await s.schliessen(); }
}
