// ─── Gmail — Lage für den Head of IT (Server, 03.10.2026) ────────────────────
// Nur Zähler und Zustände (lib/hoi/lage.ts `gmailBefunde`): wie viele Personen Gmail nutzen, wie alt der älteste Abgleich ist, wie
// viele Verbindungen Google nicht mehr akzeptiert, wie viele Push-Überwachungen laufen. Nie Adressen, nie Betreffs.

import { alleSpeicher } from '@/lib/zugang/konten';
import { ladeVerbindung } from '@/lib/google/verbindung';
import type { GmailLage } from '@/lib/hoi/lage';
import { ladeGmailStand } from './stand';
import { gmailAlter } from './abgleich';
import { gmailWebhookAdresse, pushKonfig } from './meldung';

export async function gmailLage(jetzt = Date.now()): Promise<GmailLage | null> {
  let personen = 0, getrennt = 0, aktiv = 0;
  let vorMin: number | null = 0;
  let veraltet = false;
  let fehler: string | undefined;
  for (const p of await alleSpeicher()) {
    const v = await ladeVerbindung(p);
    if (!v || !v.funktionen.includes('gmail')) continue;
    personen++;
    if (v.status !== 'verbunden') { getrennt++; continue; }
    const s = await ladeGmailStand(p);
    const a = gmailAlter(s, jetzt);
    if (!a) { vorMin = null; veraltet = true; continue; }
    if (a.vorMin === null) vorMin = null; else if (vorMin !== null) vorMin = Math.max(vorMin, a.vorMin);
    if (a.veraltet) veraltet = true;
    if (a.fehler && !fehler) fehler = a.fehler;
    if (s?.watch && s.watch.ablauf > jetzt) aktiv++;
  }
  if (!personen) return null;
  return { personen, vorMin, veraltet, getrennt, ...(fehler ? { fehler } : {}), push: { aktiv, von: personen - getrennt, moeglich: !!pushKonfig() && !!gmailWebhookAdresse() } };
}
