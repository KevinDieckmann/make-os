// ─── Kalender — Jobs im Takt, gestaffelt (Upload U1 M4, 29.09.) ─────────────
// Der Takt (app/api/zoe/takt, jede Minute) hat drei iCloud-Jobs: den Abgleich (alle 5 Min.), die Tagessicherung (nachts)
// und den Event-Spiegel (alle 30 Min.). Früher starteten sie im selben Takt gleichzeitig — beim ersten Start nach einem
// Upload alle drei auf einmal gegen iCloud. Jetzt höchstens EINER je Takt, in dieser Reihenfolge:
//   1. Abgleich, wenn fällig (Kalender frisch halten; nie während einer iCloud-Pause, `naechsterVersuchFaellig`)
//   2. Tagessicherung, wenn fällig (03:00–05:00, ≥ 30 Min. nach dem Start, keine iCloud-Pause — lib/kalender/sicherung.ts)
//   3. Event-Spiegel (hält selbst 30 Min. Abstand, lib/kalender/spiegel-server.ts)
// Google (03.10.) läuft daneben, unabhängig (lib/kalender/google/takt.ts). Läuft noch ein Abgleich oder eine Sicherung, startet nichts. Nie blockierend: gestartet wird im Hintergrund; Fehler
// gehen als eine Zeile ins Server-Protokoll (`[kalender-sicherung] …`, `[spiegel] …`), nie mit Titeln.

import { verbunden, ladeStand, abgleichen, naechsterVersuchFaellig, abgleichLaeuft } from './icloud';
import { kalenderSicherungFaellig, kalenderSicherungTaeglich, sicherungLaeuft } from './sicherung-server';
import { eventSpiegelImTakt } from './spiegel-server';
import { googleJobsImTakt } from './google/takt';

export type TaktJob = 'abgleich' | 'sicherung' | 'spiegel' | 'wartet' | 'nichts';

const kurz = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message.slice(0, 160)}` : 'Fehler');

/** Welcher Kalender-Job in diesem Takt startet (höchstens einer). Liefert ihn — für Tests und das Protokoll. */
export async function kalenderJobsImTakt(jetzt = new Date()): Promise<TaktJob> {
  // Google (03.10.): eigene, von iCloud unabhängige Jobs — Abgleich und Push-Kanal je verbundener Person, nie blockierend.
  void googleJobsImTakt(jetzt.getTime()).catch(e => console.warn(`[kalender-google] Takt: ${kurz(e)}`));
  if (!verbunden()) {
    // Ohne iCloud (nur Google, 03.10.) laufen weder Abgleich noch Sicherung dort — der Event-Spiegel schon (er prüft selbst, ob es eine Quelle gibt).
    void eventSpiegelImTakt(jetzt.getTime()).catch(e => console.warn(`[spiegel] Takt: ${kurz(e)}`));
    return 'nichts';
  }
  if (abgleichLaeuft() || sicherungLaeuft()) return 'wartet';
  const s = await ladeStand();
  const zuletzt = Date.parse(s.at ?? '') || 0;
  if (jetzt.getTime() - zuletzt > 5 * 60_000 && naechsterVersuchFaellig(s, jetzt.getTime())) {
    void abgleichen().catch(() => { /* Fehler steht im Stand */ });
    return 'abgleich';
  }
  if (await kalenderSicherungFaellig(jetzt).catch(e => { console.warn(`[kalender-sicherung] Stand nicht lesbar: ${kurz(e)}`); return false; })) {
    void kalenderSicherungTaeglich(jetzt)
      .then(r => { if (r) console.info(`[kalender-sicherung] ${r.gesichert} Kalender gesichert, ${r.fehler} Fehler`); })
      .catch(e => console.warn(`[kalender-sicherung] abgebrochen: ${kurz(e)}`));
    return 'sicherung';
  }
  void eventSpiegelImTakt(jetzt.getTime()).catch(e => console.warn(`[spiegel] Takt: ${kurz(e)}`));
  return 'spiegel';
}
