// ─── Gmail — Jobs im Takt (Server, 03.10.2026) ───────────────────────────────
// Der Takt (app/api/zoe/takt, jede Minute, vom Arbeiter) hält die Spiegel frisch:
//   · Abgleich je Person mit Gmail: alle 2 Minuten (ohne Push) bzw. alle 15 Minuten, solange `users.watch` läuft (der Webhook stößt
//     Änderungen ohnehin sofort an) — nie während einer Pause nach Fehler (`gmailFaellig`)
//   · `users.watch` anlegen/erneuern (nur mit Pub/Sub-Einrichtung, sonst still aus), „Senden als“-Aliase alle 6 Stunden
// Nie blockierend: gestartet wird im Hintergrund; Fehler gehen als EINE Zeile ins Server-Protokoll (`[gmail] …`), nie mit Betreff
// oder Adresse. Unabhängig von den Kalender-Jobs.

import { alleSpeicher } from '@/lib/zugang/konten';
import { personenMit, googleKonfiguriert } from '@/lib/google/verbindung';
import { gmailAbgleichen, gmailAbgleichLaeuft, gmailEinrichten, gmailFaellig, aliaseSicherstellen } from './abgleich';
import { watchSicherstellen } from './meldung';
import { ladeGmailStand } from './stand';

const kurz = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message.slice(0, 160)}` : 'Fehler');

export async function gmailJobsImTakt(jetzt = Date.now()): Promise<{ gestartet: string[] }> {
  if (!googleKonfiguriert()) return { gestartet: [] };
  const personen = await personenMit('gmail', await alleSpeicher().catch(() => [] as string[]));
  const gestartet: string[] = [];
  for (const p of personen) {
    if (gmailAbgleichLaeuft(p)) continue;
    const s = await ladeGmailStand(p).catch(() => null);
    if (!s) {
      // Verbunden, aber noch kein Spiegel: erste Lesung (30 Tage) — auch nach einem fehlgeschlagenen Start aus dem Rückruf.
      gestartet.push(p);
      void gmailEinrichten(p).then(() => watchSicherstellen(p)).catch(e => console.warn(`[gmail] Einrichten: ${kurz(e)}`));
    } else if (gmailFaellig(s, jetzt)) {
      gestartet.push(p);
      void gmailAbgleichen(p).then(() => Promise.all([watchSicherstellen(p, jetzt), aliaseSicherstellen(p).catch(() => [])])).catch(e => console.warn(`[gmail] Abgleich: ${kurz(e)}`));
    } else {
      void watchSicherstellen(p, jetzt).catch(e => console.warn(`[gmail] watch: ${kurz(e)}`));
    }
  }
  return { gestartet };
}
