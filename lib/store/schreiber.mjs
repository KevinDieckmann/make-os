// ─── Wer schreibt in diesen Datenordner? Lockfile `.schreiber` (29.09., Paket D-A #9/#10) ─
// Die Schreibsperre der App gilt nur IM Prozess. Ein Skript, das bei laufender App dieselben
// Bestände umschreibt (Verschlüsseln, Rotation, Einzel-Restore), verliert still Änderungen:
// es liest, die App schreibt, das Skript benennt seine ältere Fassung darüber.
//
// Deshalb setzt die App beim Start `<daten>/.schreiber` = { pid, host, start, herz, art } und
// frischt `herz` alle 30 s auf (lib/store/betrieb.ts). Skripte, die in den Datenordner
// schreiben, rufen `skriptSperreOderAbbruch(ordner)` und brechen ab, solange eine LEBENDE App
// den Ordner hält. „Lebt“ = Herzschlag jünger als 90 s — und auf demselben Rechner zusätzlich
// die PID vorhanden. Über Container-Grenzen (`docker compose run` hat einen anderen Host-Namen
// und eigene PIDs) zählt nur der Herzschlag. Beim geordneten Beenden entfernt die App die Datei.
// Bricht die App hart ab (SIGKILL), ist der Herzschlag nach 90 s alt — dann dürfen Skripte wieder.

import { promises as fs, unlinkSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SCHREIBER_DATEI = '.schreiber';
export const HERZ_MS = 30_000;
export const LEBT_MS = 90_000;

const datei = ordner => path.join(ordner, SCHREIBER_DATEI);

function pidLebt(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (e) { return e?.code === 'EPERM'; }
}

/** Den Eintrag lesen — null, wenn keiner da oder unlesbar. */
export async function schreiberLesen(ordner) {
  try { const o = JSON.parse(await fs.readFile(datei(ordner), 'utf8')); return o && typeof o === 'object' ? o : null; }
  catch { return null; }
}

/** Lebt der eingetragene Schreiber? Rein (bis auf die PID-Probe auf demselben Rechner). */
export function schreiberLebt(e, jetzt = Date.now(), host = os.hostname()) {
  if (!e) return false;
  const herz = Date.parse(e.herz ?? e.start ?? '');
  if (!Number.isFinite(herz) || jetzt - herz > LEBT_MS) return false;
  if (e.host === host) return e.pid === process.pid || pidLebt(Number(e.pid));
  return true;
}

/** Ist es dieser Prozess? */
export const istEigener = e => !!e && e.pid === process.pid && e.host === os.hostname();

async function schreiben(ordner, e) {
  await fs.mkdir(ordner, { recursive: true });
  const ziel = datei(ordner);
  const tmp = `${ziel}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(e), { mode: 0o600 });
  await fs.rename(tmp, ziel);
}

/**
 * Die App trägt sich als Schreiber ein. Hält schon ein ANDERER lebender Prozess den Ordner
 * (lokal: Dev-Server 3001 und Prüfbau 3011 teilen `.data`), wird das zurückgegeben — die App
 * startet trotzdem (lokal gewollt), der Head of IT zeigt es als Befund.
 */
export async function schreiberSetzen(ordner, art = 'app') {
  const vorher = await schreiberLesen(ordner);
  const fremd = vorher && !istEigener(vorher) && schreiberLebt(vorher) ? vorher : null;
  const jetzt = new Date().toISOString();
  await schreiben(ordner, { pid: process.pid, host: os.hostname(), start: jetzt, herz: jetzt, art });
  return { fremd };
}

/** Herzschlag auffrischen. Hat inzwischen ein anderer lebender Prozess übernommen, wird er gemeldet (nicht überschrieben). */
export async function schreiberHerz(ordner, start, art = 'app') {
  const e = await schreiberLesen(ordner);
  if (e && !istEigener(e) && schreiberLebt(e)) return { fremd: e };
  await schreiben(ordner, { pid: process.pid, host: os.hostname(), start, herz: new Date().toISOString(), art });
  return { fremd: null };
}

/** Beim Beenden (synchron, auch aus process.on('exit')): nur den EIGENEN Eintrag entfernen. */
export function schreiberEntfernenSync(ordner) {
  try {
    const e = JSON.parse(readFileSync(datei(ordner), 'utf8'));
    if (istEigener(e)) unlinkSync(datei(ordner));
  } catch { /* keiner da */ }
}

/**
 * Für Skripte: abbrechen, wenn eine lebende App den Datenordner hält. Gibt bei freiem Ordner
 * nichts zurück; sonst beendet es den Prozess mit Code 3 und einer klaren Meldung.
 * `MAKE_OS_PRUEF_HOST` biegt den Rechnernamen nur für Tests um.
 */
export async function skriptSperreOderAbbruch(ordner, was = 'Dieses Skript') {
  const e = await schreiberLesen(ordner);
  if (!schreiberLebt(e, Date.now(), process.env.MAKE_OS_PRUEF_HOST || os.hostname())) return;
  const alter = Math.round((Date.now() - Date.parse(e.herz ?? e.start)) / 1000);
  console.error(`${was} bricht ab: eine laufende App hält den Datenordner (${ordner}) — PID ${e.pid} auf „${e.host}“, Herzschlag vor ${alter} s.`);
  console.error('Erst die App anhalten (Server: `docker compose stop app arbeiter`, dann `docker compose run --rm -T --no-deps app node …`; lokal: Dev-Server/Prüfbau beenden).');
  process.exit(3);
}
