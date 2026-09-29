// ─── Archiv-Kopien (<daten>/archiv) — verschlüsselt wie die Bestände (28.09., F2) ─
// Vor Umzügen und Aufräumarbeiten legen Routen eine Kopie des alten Stands ab
// (CRM vor dem Brain-Umzug, MAKE.ORGA-Rohdaten, Business vor der Entflechtung,
// Kategorien vor dem Aufräumen). Nur diese Stelle schreibt ins Archiv: mit Datenschlüssel
// als Hülle im Schreibformat MAKE_OS_FORMAT (lib/store/huelle.mjs `huelleImModus`): kompatibel (Standard) = v1 wie der
// alte Online-Stand aeb4964, v2 = Schlüssel-ID + AAD `archiv/<datei>`; ohne Schlüssel
// (lokale Entwicklung) Klartext wie alles. Seit 29.09. (Paket D-A #2/#55):
//   · Schreiben atomar und dauerhaft (atomarSchreiben: fsync + rename + Ordner-fsync);
//   · Lesen über denselben Weg wie die Bestände (rohOeffnen): v1 und v2, Schlüsselring,
//     Klartext bei gesetztem Schlüssel nur mit MAKE_OS_KLARTEXT_MIGRATION=1.
// Dateien 0600, Ordner 0700. `scripts/daten-verschluesselung.mjs` stellt auch das Archiv um.

import { promises as fs } from 'fs';
import path from 'path';
import { datenOrdner, rohOeffnen } from './local-db';
import { atomarSchreiben } from './atomar.mjs';
import { schluesselRing, huelleImModus } from './huelle.mjs';

export const archivOrdner = () => path.join(datenOrdner(), 'archiv');
const NAME = /^[a-z0-9][a-z0-9._-]{0,150}\.json$/i;

function pfad(datei: string): string {
  if (!NAME.test(datei) || datei.includes('..')) throw new Error('Unzulässiger Archivname.');
  return path.join(archivOrdner(), datei);
}

/** AAD einer Archivkopie — der Name im Archiv (eine umbenannte Kopie fällt beim Lesen auf). */
export const archivAad = (datei: string) => `archiv/${datei}`;

/** Kopie ablegen. Liefert den Dateinamen (ohne Pfad). `einruecken` wie JSON.stringify. */
export async function archivSchreiben(datei: string, daten: unknown, einruecken?: number): Promise<string> {
  const ziel = pfad(datei);
  await fs.mkdir(archivOrdner(), { recursive: true, mode: 0o700 });
  const text = JSON.stringify(daten, null, einruecken);
  const aktiv = schluesselRing().aktiv;
  await atomarSchreiben(ziel, aktiv ? huelleImModus(text, aktiv, archivAad(path.basename(ziel))) : text);
  return path.basename(ziel);
}

/** Kopie lesen (Hülle oder Klartext). Wirft ohne passenden Schlüssel. */
export async function archivLesen<T>(datei: string): Promise<T> {
  return JSON.parse(rohOeffnen(await fs.readFile(pfad(datei), 'utf8'), archivAad(datei)).text) as T;
}

/** Zeitstempel für Dateinamen (ISO ohne Doppelpunkte/Punkte). */
export const archivZeit = (iso: string) => iso.replace(/[:.]/g, '-');
