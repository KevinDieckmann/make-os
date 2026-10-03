// ─── Google Kalender — Jobs im Takt (Server, 03.10.2026) ─────────────────────
// Der Takt (app/api/zoe/takt, jede Minute, vom Arbeiter) hält die Google-Kalender frisch:
//   · Abgleich je verbundener Person: alle 5 Min. (Rückfall ohne Push) bzw. alle 30 Min., solange ein Push-Kanal läuft
//     (der Webhook stößt Änderungen ohnehin sofort an) — nie während einer Pause nach Fehler (`naechsterVersuchFaellig`)
//   · Push-Kanal anlegen/erneuern (`kanalSicherstellen`, ab 36 Stunden Restlaufzeit)
// Nie blockierend: gestartet wird im Hintergrund; Fehler gehen als EINE Zeile ins Server-Protokoll (`[kalender-google] …`),
// nie mit Titeln. Unabhängig von den iCloud-Jobs (lib/kalender/takt-jobs.ts) — Google und Apple sind getrennte Server.

import { alleSpeicher } from '@/lib/zugang/konten';
import { personenMit, googleKonfiguriert } from '@/lib/google/verbindung';
import { ladeGoogleStand } from './stand';
import { googleAbgleichen, googleAbgleichLaeuft } from './abgleich';
import { kanalSicherstellen } from './kanal';
import { naechsterVersuchFaellig } from '../icloud';
import { sicherungAufraeumen } from './umzug';

const kurz = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message.slice(0, 160)}` : 'Fehler');
const MIN = 60_000;

/** Wie alt darf der Stand sein, bevor der Takt abgleicht? Mit Push-Kanal 30 Min., sonst 5 Min. */
export function abgleichIntervallMs(kanalAblauf: number | undefined, jetzt: number): number {
  return kanalAblauf && kanalAblauf > jetzt ? 30 * MIN : 5 * MIN;
}

/** Welche Personen gleicht dieser Takt ab? — rein (Tests). */
export function faelligFuer(s: { at?: string; fehlerAt?: string; pauseBis?: string; fehlerAnmeldung?: boolean; kanal?: { ablauf: number } } | null, jetzt: number): boolean {
  if (!s) return true; // verbunden, aber noch kein Stand: einrichten + erste Lesung
  if (s.at && jetzt - Date.parse(s.at) < abgleichIntervallMs(s.kanal?.ablauf, jetzt)) return false;
  return naechsterVersuchFaellig(s, jetzt);
}

const aufgeraeumt = new Map<string, number>();

export async function googleJobsImTakt(jetzt = Date.now()): Promise<{ gestartet: string[] }> {
  if (!googleKonfiguriert()) return { gestartet: [] };
  const personen = await personenMit('kalender', await alleSpeicher().catch(() => [] as string[]));
  const gestartet: string[] = [];
  for (const p of personen) {
    const s = await ladeGoogleStand(p).catch(() => null);
    // Die Sicherung des Umzugs (30 Tage) einmal je Stunde aufräumen.
    if (jetzt - (aufgeraeumt.get(p) ?? 0) > 3600_000) { aufgeraeumt.set(p, jetzt); void sicherungAufraeumen(p, jetzt).catch(() => { /* nächste Stunde */ }); }
    if (googleAbgleichLaeuft(p)) continue;
    if (faelligFuer(s, jetzt)) {
      gestartet.push(p);
      void googleAbgleichen(p).then(() => kanalSicherstellen(p)).catch(e => console.warn(`[kalender-google] Abgleich: ${kurz(e)}`));
    } else if (s) {
      void kanalSicherstellen(p).catch(e => console.warn(`[kalender-google] Kanal: ${kurz(e)}`));
    }
  }
  return { gestartet };
}
