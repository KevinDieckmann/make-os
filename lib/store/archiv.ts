// ─── Archiv-Kopien (<daten>/archiv) — verschlüsselt wie die Bestände (28.09., F2) ─
// Vor Umzügen und Aufräumarbeiten legen Routen eine Kopie des alten Stands ab
// (CRM vor dem Brain-Umzug, MAKE.ORGA-Rohdaten, Business vor der Entflechtung,
// Kategorien vor dem Aufräumen). Prüfbericht 28.09.: diese Kopien lagen im
// KLARTEXT neben den verschlüsselten Beständen — ein kopierter Datenordner hätte
// sie verraten. Ab jetzt schreibt nur diese Stelle ins Archiv: mit
// MAKE_OS_DATEN_SCHLUESSEL als dieselbe AES-256-GCM-Hülle wie local-db
// (`verschluesseln`), ohne Schlüssel (lokale Entwicklung) Klartext wie alles.
// Gelesen wird mit `entschluesseln` — beide Fassungen. Dateien 0600, Ordner 0700,
// Schreiben über tmp + rename. `scripts/daten-verschluesselung.mjs` stellt auch
// das Archiv um (alte Klartext-Kopien einmal verschlüsseln).

import { promises as fs } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { datenOrdner, datenSchluessel, entschluesseln, verschluesseln } from './local-db';

export const archivOrdner = () => path.join(datenOrdner(), 'archiv');
const NAME = /^[a-z0-9][a-z0-9._-]{0,150}\.json$/i;

function pfad(datei: string): string {
  if (!NAME.test(datei) || datei.includes('..')) throw new Error('Unzulässiger Archivname.');
  return path.join(archivOrdner(), datei);
}

/** Kopie ablegen. Liefert den Dateinamen (ohne Pfad). `einruecken` wie JSON.stringify. */
export async function archivSchreiben(datei: string, daten: unknown, einruecken?: number): Promise<string> {
  const ziel = pfad(datei);
  await fs.mkdir(archivOrdner(), { recursive: true, mode: 0o700 });
  const text = JSON.stringify(daten, null, einruecken);
  const key = datenSchluessel();
  const tmp = `${ziel}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(tmp, key ? verschluesseln(text, key) : text, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, ziel);
  return path.basename(ziel);
}

/** Kopie lesen (Hülle oder Klartext). Wirft ohne passenden Schlüssel. */
export async function archivLesen<T>(datei: string): Promise<T> {
  return JSON.parse(entschluesseln(await fs.readFile(pfad(datei), 'utf8'), datenSchluessel())) as T;
}

/** Zeitstempel für Dateinamen (ISO ohne Doppelpunkte/Punkte). */
export const archivZeit = (iso: string) => iso.replace(/[:.]/g, '-');
