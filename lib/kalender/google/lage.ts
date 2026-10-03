// ─── Google Kalender — Lage für den Head of IT (Server, 03.10.2026) ──────────
// Nur Zähler und Zustände (lib/hoi/lage.ts `googleKalenderBefunde`): wie viele Personen verbunden sind, wie alt der älteste
// Abgleich ist, wie viele Verbindungen Google nicht mehr akzeptiert, wie viele Push-Kanäle laufen. Nie Adressen, nie Titel.

import { alleSpeicher } from '@/lib/zugang/konten';
import { ladeVerbindung } from '@/lib/google/verbindung';
import type { GoogleKalenderLage } from '@/lib/hoi/lage';
import { ladeGoogleStand } from './stand';
import { googleAlter } from './abgleich';
import { webhookAdresse } from './kanal';

export async function googleLage(jetzt = Date.now()): Promise<GoogleKalenderLage | null> {
  let personen = 0, getrennt = 0, aktiv = 0;
  let vorMin: number | null = 0;
  let veraltet = false;
  let fehler: string | undefined;
  for (const p of await alleSpeicher()) {
    const v = await ladeVerbindung(p);
    if (!v || !v.funktionen.includes('kalender')) continue;
    personen++;
    if (v.status !== 'verbunden') { getrennt++; continue; }
    const s = await ladeGoogleStand(p);
    const a = googleAlter(s, jetzt);
    if (!a) { vorMin = null; veraltet = true; continue; }
    if (a.vorMin === null) vorMin = null; else if (vorMin !== null) vorMin = Math.max(vorMin, a.vorMin);
    if (a.veraltet) veraltet = true;
    if (a.fehler && !fehler) fehler = a.fehler;
    if (s?.kanal && s.kanal.ablauf > jetzt) aktiv++;
  }
  if (!personen) return null;
  return { personen, vorMin, veraltet, getrennt, ...(fehler ? { fehler } : {}), push: { aktiv, von: personen - getrennt, moeglich: !!webhookAdresse() } };
}
