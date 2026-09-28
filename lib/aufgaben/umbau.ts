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
export const UMBAU_VERSION = 1;
export const UMBAU_ARCHIV_PRAEFIX = 'tasks-vor-umbau-';

/** Liegt schon eine Kopie vor dem Umbau im Archiv? */
async function kopieDa(): Promise<boolean> {
  try { return (await fs.readdir(archivOrdner())).some(n => n.startsWith(UMBAU_ARCHIV_PRAEFIX)); }
  catch { return false; }
}

/** Vor dem ersten übernommenen Schreiben: Kopie des Rohstands ablegen (einmal). Liefert den Dateinamen oder null. */
export async function vorUmbauSichern(roh: TasksState | null, jetzt = new Date().toISOString()): Promise<string | null> {
  if (!roh || roh.umbauVersion === UMBAU_VERSION) return null;
  if (await kopieDa()) return null;
  return archivSchreiben(`${UMBAU_ARCHIV_PRAEFIX}${archivZeit(jetzt)}.json`, roh);
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
