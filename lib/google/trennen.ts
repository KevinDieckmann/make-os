// ─── Google — Trennen mit Aufräumen der Module (Server, 03.10.2026) ──────────
// `googleTrennen` (verbindung.ts) widerruft das Token bei Google und löscht den Bestand — vorher räumt jedes Modul auf,
// das an der Verbindung hängt, solange das Token noch gilt. Ein weiteres Modul (z. B. Gmail) trägt hier SEINE Aufräum-
// Funktion ein; es ändert sonst nichts.

import { googleTrennen } from './verbindung';
import { ladeGoogleStand, leereGoogleStand } from '@/lib/kalender/google/stand';
import { kanalStoppenFuer } from '@/lib/kalender/google/kanal';
import { cacheNeuSchreiben } from '@/lib/kalender/icloud';

/** Kalender: Push-Kanal bei Google stoppen (Token gilt noch). */
async function kalenderVorher(person: string): Promise<void> {
  const s = await ladeGoogleStand(person);
  if (s) await kanalStoppenFuer(person, s);
}

/** Kalender: den Spiegel der Google-Termine verwerfen (Wahrheit bleibt Google) und den Zwischenspeicher neu schreiben. */
async function kalenderNachher(person: string): Promise<void> {
  await leereGoogleStand(person);
  await cacheNeuSchreiben();
}

export async function googleTrennenAlles(person: string): Promise<{ war: boolean; widerrufen: boolean }> {
  const r = await googleTrennen(person, async () => { await kalenderVorher(person); });
  await kalenderNachher(person).catch(() => { /* der nächste Lauf räumt auf */ });
  return r;
}
