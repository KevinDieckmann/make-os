// ─── Mac oder Server? (24.09., Vorbereitung Hetzner) ────────────────────────
// Kalender, Erinnerungen und Kontakte liest MAKE OS über osascript (Mail seit 06.10. nicht mehr — Inbox 2 holt sie per IMAP) — das
// gibt es nur auf Kevins Mac. Kevins Entscheidung: „Mac liefert zu.“ Auf dem
// Mac lesen die Apple-Routen wie bisher direkt und merken sich den Stand; auf
// dem Server liefern sie, was der Mac zuletzt hochgeschoben hat
// (/api/zulieferung, Skript zulieferer.mjs). Nie ein Absturz, nie ein
// stilles Nichts: Stand und Herkunft stehen im Antwortkopf.

import { NextResponse } from 'next/server';
import { loadJson, saveJson } from '@/lib/store/local-db';

// Prüf- und Testumgebungen (03.10.): Läuft MAKE OS mit eigenem Datenordner (`MAKE_OS_DATEN_DIR`, Sandbox/Prüfbau) oder mit
// `MAKE_OS_OHNE_APPLE=1`, liest es NIE Kevins echte Apple-Daten (Mail, Kalender, Erinnerungen, Kontakte) — ein Prüflauf auf
// dem Mac hatte sonst den echten Posteingang in der Sandbox gezeigt. Der normale Start nutzt `<repo>/.data` ohne Variable.
export const AUF_DEM_MAC = process.platform === 'darwin' && !process.env.MAKE_OS_DATEN_DIR && !/^(1|ja|true)$/i.test(process.env.MAKE_OS_OHNE_APPLE ?? '');
export const NUR_MAC = 'Das geht nur direkt auf Kevins Mac (Apple). Auf dem Server siehst du den zuletzt zugelieferten Stand.';

// Mail kommt seit 06.10. (Inbox 2) nicht mehr vom Mac: der Server holt die Postfächer selbst (IMAP/Gmail, lib/postfach/*). Der alte
// Bestand `apple-mail-cache` bleibt liegen (Löschfrist „Postfach-Zwischenspeicher“), wird aber nicht mehr geschrieben.
export type Zulieferung = 'kalender' | 'erinnerungen' | 'kontakte';
export const ZULIEFERUNGEN: Zulieferung[] = ['kalender', 'erinnerungen', 'kontakte'];
/** Der Kalender hat seinen Speicher schon (calendar-cache, Format {events, at}). */
export const SPEICHER: Record<Zulieferung, string> = {
  kalender: 'calendar-cache', erinnerungen: 'apple-reminders-cache', kontakte: 'apple-contacts-cache',
};
export interface Gemerkt { daten: unknown; at: string; quelle: 'mac' | 'zulieferung' }

/** Auf dem Mac: gelesenen Stand merken (für Zulieferer und Ausfälle). */
export async function merke(art: Exclude<Zulieferung, 'kalender'>, daten: unknown): Promise<void> {
  try { await saveJson<Gemerkt>(SPEICHER[art], { daten, at: new Date().toISOString(), quelle: 'mac' }); } catch { /* Merken darf nie eine Antwort verhindern */ }
}

/** Auf dem Server: den zugelieferten Stand ausliefern — oder leer mit Hinweis. */
export async function vomMac(art: Exclude<Zulieferung, 'kalender'>, leer: unknown): Promise<NextResponse> {
  const g = await loadJson<Gemerkt>(SPEICHER[art]);
  if (g?.at) return NextResponse.json(g.daten, { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'zulieferung', 'X-Stand': g.at } });
  return NextResponse.json(leer, { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'leer', 'X-Nur-Mac': '1' } });
}

/** Für schreibende Apple-Aktionen (Termin anlegen, Entwurf in Mail): nur auf dem Mac. */
export function nurMac(): NextResponse {
  return NextResponse.json({ ok: false, error: NUR_MAC }, { status: 200 });
}
