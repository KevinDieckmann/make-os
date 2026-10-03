// ─── Google — Trennen mit Aufräumen der Module (Server, 03.10.2026) ──────────
// `googleTrennen` (verbindung.ts) widerruft das Token bei Google und löscht den Bestand — vorher räumt jedes Modul auf,
// das an der Verbindung hängt, solange das Token noch gilt. Ein weiteres Modul (z. B. Gmail) trägt hier SEINE Aufräum-
// Funktion ein; es ändert sonst nichts. Gmail (03.10.): `users.stop` vorher (Token gilt noch), danach Köpfe und Texte des Spiegels weg
// (Wahrheit bleibt Gmail — Nachrichten werden dort nicht berührt).

import { updateJson } from '@/lib/store/local-db';
import { googleTrennen, ladeVerbindung, verbindungName, type GoogleVerbindung } from './verbindung';
import { ladeGoogleStand, leereGoogleStand } from '@/lib/kalender/google/stand';
import { kanalStoppenFuer } from '@/lib/kalender/google/kanal';
import { cacheNeuSchreiben } from '@/lib/kalender/icloud';
import { ladeGmailStand, leereGmail } from '@/lib/gmail/stand';
import { watchStoppen } from '@/lib/gmail/meldung';

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

/** Gmail: die Überwachung (`users.stop`) beenden, solange das Token noch gilt. */
async function gmailVorher(person: string): Promise<void> {
  const s = await ladeGmailStand(person);
  if (s?.watch) await watchStoppen(person);
}

/** Gmail: den Spiegel (Köpfe + Texte) verwerfen — Gmail selbst bleibt unberührt. */
async function gmailNachher(person: string): Promise<void> {
  if (await ladeGmailStand(person)) await leereGmail(person);
}

export async function googleTrennenAlles(person: string): Promise<{ war: boolean; widerrufen: boolean }> {
  const r = await googleTrennen(person, async () => { await kalenderVorher(person).catch(() => { /* Trennen geht vor */ }); await gmailVorher(person).catch(() => { /* Trennen geht vor */ }); });
  await kalenderNachher(person).catch(() => { /* der nächste Lauf räumt auf */ });
  await gmailNachher(person).catch(() => { /* der nächste Lauf räumt auf */ });
  return r;
}

/**
 * Nur Gmail ausschalten (Kalender bleibt verbunden): Überwachung stoppen, Spiegel verwerfen, die Funktion aus der Verbindung nehmen.
 * Der Zugriff selbst (Scope) bleibt bei Google gewährt, bis die Person ganz trennt — MAKE OS nutzt ihn dann nicht mehr.
 */
export async function gmailAusschalten(person: string): Promise<boolean> {
  const v = await ladeVerbindung(person);
  if (!v || !v.funktionen.includes('gmail')) return false;
  await gmailVorher(person).catch(() => { /* weiter */ });
  await gmailNachher(person).catch(() => { /* weiter */ });
  await updateJson<GoogleVerbindung | null>(verbindungName(person), cur => (cur && cur.v === 1 ? { ...cur, funktionen: cur.funktionen.filter(f => f !== 'gmail') } : cur));
  return true;
}
