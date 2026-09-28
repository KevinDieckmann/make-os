// ─── Atomar und dauerhaft schreiben (29.09., Paket D-A, Prüfliste #2/#3/#5/#32) ─
// EINE Stelle für „Datei ersetzen, ohne dass nach einem Absturz oder Stromausfall
// eine leere oder halbe Datei unter dem richtigen Namen steht“:
//
//   open(tmp im Zielordner, 0600) → write → fsync(Datei) → close → rename → fsync(Ordner)
//
// rename ist atomar, aber ohne fsync nicht dauerhaft: die Datei-Daten und der neue
// Verzeichniseintrag müssen beide auf der Platte sein. Die Temp-Datei liegt im
// Zielordner (rename über Dateisystemgrenzen wäre eine Kopie) und trägt PID + Zufall,
// damit sich zwei Prozesse nie dieselbe .tmp-Datei wegziehen.
//
// Bewusst .mjs: dieselbe Funktion nutzen die App (lib/store/local-db.ts, archiv.ts)
// UND die Skripte (scripts/*.mjs laufen ohne Übersetzer). Typen: atomar.d.mts.
// Übernahme offen: lib/dateien/ablage.ts (inhaltAblegen) schreibt noch ohne fsync —
// dort `atomarSchreiben(pfad, bytes)` einsetzen (anderes Paket).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

/** Fehlercodes, bei denen ein Verzeichnis-fsync „kann dieses System nicht“ heißt — nur die werden geschluckt. */
const ORDNER_SYNC_NICHT_UNTERSTUETZT = new Set(['EINVAL', 'ENOTSUP', 'EOPNOTSUPP']);

/**
 * Verzeichnis-fsync: macht den neuen Namen nach einem rename dauerhaft.
 * Nur „nicht unterstützt“ (EINVAL/ENOTSUP) wird geschluckt; E/A-Fehler (EIO, ENOSPC …)
 * werfen — sonst meldete der Aufrufer „gespeichert“, obwohl der Name nicht sicher auf der Platte ist.
 */
export async function ordnerSync(ordner) {
  let d;
  try { d = await fs.open(ordner, 'r'); }
  catch (e) { if (ORDNER_SYNC_NICHT_UNTERSTUETZT.has(e?.code)) return; throw e; }
  try { await d.sync(); }
  catch (e) { if (!ORDNER_SYNC_NICHT_UNTERSTUETZT.has(e?.code)) throw e; }
  finally { await d.close().catch(() => {}); }
}

/** Temp-Name im Zielordner — erkennbar an `.tmp` (der Head of IT zählt liegengebliebene Reste). */
export function tmpName(pfad) {
  return `${pfad}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
}

/**
 * Datei atomar und dauerhaft ersetzen (oder anlegen).
 * @param {string} pfad  Zielpfad (der Ordner muss existieren)
 * @param {string | Uint8Array} daten  Inhalt (Text wird als UTF-8 geschrieben)
 * @param {{ modus?: number }} [opt]  Dateirechte der neuen Datei (Vorgabe 0600)
 */
export async function atomarSchreiben(pfad, daten, opt = {}) {
  const tmp = tmpName(pfad);
  const fh = await fs.open(tmp, 'w', opt.modus ?? 0o600);
  try {
    await fh.writeFile(daten, typeof daten === 'string' ? { encoding: 'utf8' } : undefined);
    await fh.sync();
  } catch (e) {
    await fh.close().catch(() => {});
    await fs.unlink(tmp).catch(() => {});
    throw e;
  }
  await fh.close();
  try { await fs.rename(tmp, pfad); }
  catch (e) { await fs.unlink(tmp).catch(() => {}); throw e; }
  await ordnerSync(path.dirname(pfad));
}

/** Eine Datei byte-genau kopieren — atomar und dauerhaft (statt fs.copyFile, das weder fsync noch tmp kennt). */
export async function atomarKopieren(quelle, ziel, opt = {}) {
  await atomarSchreiben(ziel, await fs.readFile(quelle), opt);
}
