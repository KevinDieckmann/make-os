// ─── Mac-Zulieferer: Übergang zum eigenen Schlüssel (05.10.) ────────────────
// Bis 05.10. schickte der Mac (zulieferer.mjs) den Dienstschlüssel MAKE_OS_KEY über das Internet. Seitdem gibt es
// MAKE_OS_ZULIEFERER_KEY, der NUR die Zulieferung öffnet (middleware.ts). Solange er auf dem Server fehlt, nimmt
// die Zulieferung von außen weiter MAKE_OS_KEY an (Kopf `x-make-zulieferer: alt`) — jeder solche Aufruf wird hier
// vermerkt (nur der Zeitpunkt, Klartext in <daten>/system wie takt.txt), und der Head of IT zeigt gelb, bis der
// Mac umgestellt ist (UPDATES.md › „Zugang & Schlüssel härten“, deploy/zulieferer-schluessel.sh).

import fs from 'node:fs/promises';
import path from 'node:path';
import { datenOrdner } from '@/lib/store/local-db';

const datei = () => path.join(datenOrdner(), 'system', 'zulieferer-alt.txt');

/** Ein Übergangs-Aufruf (MAKE_OS_KEY von außen) ist angekommen. Wirft nie. */
export async function altSchluesselVermerken(jetzt = new Date()): Promise<void> {
  try { await fs.mkdir(path.dirname(datei()), { recursive: true }); await fs.writeFile(datei(), jetzt.toISOString()); } catch { /* nur Hinweis */ }
}

/** Wann zuletzt ein Übergangs-Aufruf kam — null, wenn nie (oder die Datei fehlt). */
export async function altSchluesselZuletzt(): Promise<string | null> {
  try { const t = (await fs.readFile(datei(), 'utf8')).trim(); return Number.isNaN(Date.parse(t)) ? null : t; } catch { return null; }
}
