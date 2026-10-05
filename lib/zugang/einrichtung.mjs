// ─── Einrichtungs-Code für das allererste Konto (05.10., Paket „Zugang & Schlüssel härten“ Punkt 3) ──────────
// Bis 05.10. bewies man beim ersten Konto den Besitz der Installation mit dem Generalschlüssel MAKE_OS_KEY — der damit
// im Browser landete (und in jedem Passwort-Manager-Vorschlag). Jetzt: ein EINMAL-Code, den nur hat, wer auf dem Server
// (bzw. am Mac) ein Terminal öffnen kann:
//   node scripts/einrichtung-token.mjs            (am Server: docker compose exec app node scripts/einrichtung-token.mjs)
// Er liegt als Fingerabdruck (SHA-256, nie der Code) mit Ablauf in <daten>/system/einrichtung.json (0600), gilt
// höchstens 24 Stunden, einmal — nach dem ersten Konto wird die Datei gelöscht, ein abgelaufener Code ebenso.
//
// Bewusst .mjs: App (lib/zugang/einrichtung.ts) und Skript (scripts/einrichtung-token.mjs) nutzen dieselbe Regel.

import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink, chmod } from 'node:fs/promises';
import path from 'node:path';

export const EINRICHTUNG_STUNDEN = 24;
const ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const einrichtungDatei = ordner => path.join(ordner, 'system', 'einrichtung.json');

/** Eingabe vereinheitlichen: Groß, nur Zeichen des Alphabets (Bindestriche/Leerzeichen egal). */
export const codeNorm = c => String(c ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const fingerabdruck = c => createHash('sha256').update(`make-os-einrichtung:${codeNorm(c)}`).digest('hex');

/** Neuer Code: 5 × 4 Zeichen aus 32 (100 Bit), kryptografischer Zufall. */
export function neuerCode() {
  let c = '';
  for (let i = 0; i < 20; i++) c += ZEICHEN[randomInt(ZEICHEN.length)];
  return c.match(/.{4}/g).join('-');
}

/** Code erzeugen und (nur als Fingerabdruck) ablegen — ersetzt einen älteren. */
export async function codeAblegen(ordner, stunden = EINRICHTUNG_STUNDEN, jetzt = new Date()) {
  const code = neuerCode();
  const bis = new Date(jetzt.getTime() + Math.max(1, Math.min(stunden, 72)) * 3_600_000).toISOString();
  const datei = einrichtungDatei(ordner);
  await mkdir(path.dirname(datei), { recursive: true });
  await writeFile(datei, JSON.stringify({ fingerabdruck: fingerabdruck(code), bis, erzeugt: jetzt.toISOString() }), { mode: 0o600 });
  await chmod(datei, 0o600).catch(() => {});
  return { code, bis };
}

/** 'ok' | 'falsch' | 'fehlt' (kein Code abgelegt) | 'abgelaufen' (Datei wird dabei gelöscht). */
export async function codePruefen(ordner, eingabe, jetzt = new Date()) {
  let d;
  try { d = JSON.parse(await readFile(einrichtungDatei(ordner), 'utf8')); } catch { return 'fehlt'; }
  if (!d || typeof d.fingerabdruck !== 'string' || typeof d.bis !== 'string') return 'fehlt';
  if (!(Date.parse(d.bis) > jetzt.getTime())) { await codeVerbrauchen(ordner); return 'abgelaufen'; }
  if (codeNorm(eingabe).length !== 20) return 'falsch';
  const a = Buffer.from(fingerabdruck(eingabe), 'hex');
  const b = Buffer.from(d.fingerabdruck, 'hex');
  return a.length === b.length && timingSafeEqual(a, b) ? 'ok' : 'falsch';
}

/** Nach dem ersten Konto (oder abgelaufen): Datei weg. Wirft nie. */
export async function codeVerbrauchen(ordner) {
  await unlink(einrichtungDatei(ordner)).catch(() => {});
}
