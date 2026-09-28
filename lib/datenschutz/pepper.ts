// ─── Pepper für Fingerabdrücke von Personen (29.09., Paket D-B #71/#68) ───────
// Sperrliste (lib/crm/sperrliste.ts), Protokoll-Kennungen (lib/store/aenderungsprotokoll.ts
// `protokollKennung`) und Grabsteine (lib/datenschutz/grabsteine.ts) hielten bis 29.09. nur einen
// UNGESALZENEN SHA-256 — wer den entschlüsselten Bestand und eine Mail-Liste hatte, erkannte jede
// gesperrte oder gelöschte Person wieder. Ab jetzt: HMAC-SHA-256 mit einem geheimen Pepper, getrennt
// vom Datenschlüssel (Version „v2“).
//
//   Pepper    MAKE_OS_PEPPER (Umgebung) — sonst MAKE_OS_PEPPER_DATEI (Datei, erste Zeile), wie beim
//             Datenschlüssel. Mindestens 32 Zeichen (openssl rand -hex 32). Nie im Repo, nie im Vault.
//   ohne      weiter v1 (ungesalzen) — kein Ausfall, aber eine gelbe Warnung im Head of IT.
//   Wechsel   NIE einfach tauschen: v2-Fingerabdrücke gelöschter Personen (Sperrliste, Grabsteine)
//             ließen sich dann nicht mehr zuordnen. Ein neuer Pepper gilt nur für Neues.
//
// Rein bis auf das Lesen der Datei (30 s zwischengespeichert). Wirft nie.

import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

export type KennungsVersion = 'v1' | 'v2';
/** Kürzester zulässiger Pepper (Zeichen). Kürzer → gilt als nicht gesetzt (Warnung im HOI). */
export const PEPPER_MIN = 32;
const DATEI_TTL_MS = 30_000;

let datei: { pfad: string; zeit: number; text: string | null } | null = null;

function ausDatei(pfad: string | undefined): string | null {
  if (!pfad?.trim()) return null;
  const jetzt = Date.now();
  if (datei && datei.pfad === pfad && jetzt - datei.zeit < DATEI_TTL_MS) return datei.text;
  let text: string | null = null;
  try { text = readFileSync(pfad.trim(), 'utf8').split(/\r?\n/)[0].trim() || null; } catch { text = null; }
  datei = { pfad, zeit: jetzt, text };
  return text;
}

/** Woher der Pepper kommt — `null`, wenn keiner (ausreichend langer) gesetzt ist. */
export function pepperQuelle(): 'umgebung' | 'datei' | null {
  const env = (process.env.MAKE_OS_PEPPER ?? '').trim();
  if (env.length >= PEPPER_MIN) return 'umgebung';
  const d = ausDatei(process.env.MAKE_OS_PEPPER_DATEI);
  return d && d.length >= PEPPER_MIN ? 'datei' : null;
}

/** Der Pepper als Text — oder null (dann gilt v1). */
function pepperText(): string | null {
  const env = (process.env.MAKE_OS_PEPPER ?? '').trim();
  if (env.length >= PEPPER_MIN) return env;
  const d = ausDatei(process.env.MAKE_OS_PEPPER_DATEI);
  return d && d.length >= PEPPER_MIN ? d : null;
}

/** Ist ein Pepper gesetzt? Ohne: v1 und eine Warnung im HOI. */
export const pepperGesetzt = (): boolean => pepperText() !== null;
/** Die Version, in der NEUE Fingerabdrücke entstehen. */
export const kennungsVersion = (): KennungsVersion => (pepperGesetzt() ? 'v2' : 'v1');

/** HMAC-SHA-256 (hex) über `zweck|wert` — null ohne Pepper. */
export function hmacHex(zweck: string, wert: string): string | null {
  const p = pepperText();
  return p ? createHmac('sha256', p).update(`${zweck}|${wert}`).digest('hex') : null;
}

/** Der alte, ungesalzene Fingerabdruck (v1) — nur noch zum Prüfen und Migrieren. */
export const shaHex = (text: string): string => createHash('sha256').update(text).digest('hex');

/**
 * Kurzer Fingerabdruck des Peppers selbst (12 hex) — damit ein Lauf erkennt, ob er für DIESEN Pepper schon
 * migriert hat. Verrät den Pepper nicht (HMAC mit festem Text).
 */
export function pepperFingerabdruck(): string | null {
  const h = hmacHex('make-os-pepper-fingerabdruck', 'v2');
  return h ? h.slice(0, 12) : null;
}

/** Nur für Tests: den Datei-Zwischenspeicher leeren. */
export function pepperVergessen(): void { datei = null; }
