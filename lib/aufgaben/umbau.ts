// ─── MAKE OS — Aufgaben-Bestand sicher im neuen Modell schreiben (Server, 29.09., A9) ─────
// Der Umbau „Aufgaben wie Monday/ClickUp“ (28.09.) übernimmt den Altbestand beim Lesen und in jeder Schreibsperre
// (`uebernehmen`, idempotent). Der erste Schreibvorgang auf dem Server schreibt damit den übernommenen Stand zurück —
// ab da gäbe es den alten nicht mehr. Deshalb legt DIESE Stelle vorher EINMAL eine Archiv-Kopie ab
// (`tasks-vor-umbau-<zeit>.json`, verschlüsselt wie alles, lib/store/archiv.ts) und setzt den Merker `umbauVersion` im
// Bestand. Idempotent: mit Merker nie wieder; ohne Merker, aber mit vorhandener Kopie (z. B. abgebrochener Lauf) keine
// zweite Kopie. Alle Schreiber, die den übernommenen Stand speichern, gehen über `aufgabenSchreiben`.

import { promises as fs } from 'fs';
import { updateJsonAsync } from '@/lib/store/local-db';
import { archivOrdner, archivSchreiben, archivZeit } from '@/lib/store/archiv';
import type { TasksState } from '@/types/tasks';

export const AUFGABEN_BESTAND = 'tasks';
/**
 * Versionen der Übernahme: 1 = Modell wie Monday/ClickUp (28.09., Kopie `tasks-vor-umbau-<zeit>`); 2 = Paket T1 (29.09.:
 * „both“ → eine Verantwortliche + Beteiligte, Anlegerin aus dem Verlauf, Deadlines als Tag — Kopie `tasks-vor-umbau-v2-<zeit>`).
 */
export const UMBAU_VERSION = 2;
export const UMBAU_ARCHIV_PRAEFIX = 'tasks-vor-umbau-';
/** Präfix der Archiv-Kopie je Version (v1 ohne Versionskennung — so heißen die schon abgelegten Kopien). */
export const umbauPraefix = (version: number): string => (version <= 1 ? UMBAU_ARCHIV_PRAEFIX : `${UMBAU_ARCHIV_PRAEFIX}v${version}-`);
const istKopieVon = (name: string, version: number) => (version <= 1 ? name.startsWith(UMBAU_ARCHIV_PRAEFIX) && /^\d/.test(name.slice(UMBAU_ARCHIV_PRAEFIX.length)) : name.startsWith(umbauPraefix(version)));

/** Liegt schon eine Kopie vor diesem Umbau im Archiv? */
async function kopieDa(version: number): Promise<boolean> {
  try { return (await fs.readdir(archivOrdner())).some(n => istKopieVon(n, version)); }
  catch { return false; }
}

/** Vor dem ersten übernommenen Schreiben einer Version: Kopie des Rohstands ablegen (einmal je Version). Liefert den Dateinamen oder null. */
export async function vorUmbauSichern(roh: TasksState | null, jetzt = new Date().toISOString()): Promise<string | null> {
  if (!roh || (roh.umbauVersion ?? 0) >= UMBAU_VERSION) return null;
  if (await kopieDa(UMBAU_VERSION)) return null;
  return archivSchreiben(`${umbauPraefix(UMBAU_VERSION)}${archivZeit(jetzt)}.json`, roh);
}

const NICHTS = Symbol('aufgaben-nichts-zu-schreiben');

/**
 * Den Aufgaben-Bestand in EINER Sperre ändern. `aendern` bekommt den Rohstand (oder null) und liefert den neuen — gibt es
 * den Rohstand unverändert zurück (dasselbe Objekt), wird nichts geschrieben (auch kein Merker). Sonst: vorher die
 * Archiv-Kopie (einmal), danach trägt der Bestand `umbauVersion`. Wirft `aendern`, wird nichts geschrieben.
 */
export async function aufgabenSchreiben(aendern: (roh: TasksState | null) => TasksState | null | Promise<TasksState | null>, jetzt?: string): Promise<TasksState | null> {
  try {
    return await updateJsonAsync<TasksState>(AUFGABEN_BESTAND, async roh => {
      const neu = await aendern(roh);
      if (neu === roh || !neu) { if (!roh) throw NICHTS; return roh; }
      await vorUmbauSichern(roh, jetzt);
      return { ...neu, umbauVersion: UMBAU_VERSION };
    });
  } catch (e) {
    if (e === NICHTS) return null;
    throw e;
  }
}
