// ─── Mac oder Server? (24.09., Vorbereitung Hetzner) ────────────────────────
// Kalender, Mail, Erinnerungen und Kontakte liest MAKE OS über osascript — das
// gibt es nur auf Kevins Mac. Kevins Entscheidung: „Mac liefert zu.“ Auf dem
// Mac lesen die Apple-Routen wie bisher direkt und merken sich den Stand; auf
// dem Server liefern sie, was der Mac zuletzt hochgeschoben hat
// (/api/zulieferung, Skript zulieferer.mjs). Nie ein Absturz, nie ein
// stilles Nichts: Stand und Herkunft stehen im Antwortkopf.

import { NextResponse } from 'next/server';
import { loadJson, saveJson } from '@/lib/store/local-db';

export const AUF_DEM_MAC = process.platform === 'darwin';
export const NUR_MAC = 'Das geht nur direkt auf Kevins Mac (Apple). Auf dem Server siehst du den zuletzt zugelieferten Stand.';

export type Zulieferung = 'kalender' | 'mail' | 'erinnerungen' | 'kontakte';
export const ZULIEFERUNGEN: Zulieferung[] = ['kalender', 'mail', 'erinnerungen', 'kontakte'];
/** Der Kalender hat seinen Speicher schon (calendar-cache, Format {events, at}). */
export const SPEICHER: Record<Zulieferung, string> = {
  kalender: 'calendar-cache', mail: 'apple-mail-cache', erinnerungen: 'apple-reminders-cache', kontakte: 'apple-contacts-cache',
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
