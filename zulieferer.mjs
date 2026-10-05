#!/usr/bin/env node
// ─── MAKE OS · Zulieferer (läuft auf Kevins Mac) ────────────────────────────
// Kevins Entscheidung 24.09.: „Mac liefert zu.“ Der Server kennt kein Apple.
// Dieses Skript fragt die lokale MAKE-OS-Instanz auf dem Mac (die osascript
// kann) nach Kalender, Mail, Erinnerungen und Kontakten und schiebt den Stand
// an den Server. Ist der Mac aus, zeigt der Server den letzten Stand — mit
// Datum, nie still.
//
// Einstellungen in ~/.make-os/zulieferer.env (NIE ins Repo, nie in iCloud):
//   MAKE_OS_SERVER=https://<eure-adresse>
//   MAKE_OS_ZULIEFERER_KEY=<eigener Zulieferer-Schlüssel>   (seit 05.10. — öffnet am Server NUR die Zulieferung)
//   MAKE_OS_SERVER_KEY=<MAKE_OS_KEY des Servers>             (alt; nur noch Übergang, danach entfernen)
//   MAKE_OS_LOKAL=http://localhost:3001        (optional)
// Den Zulieferer-Schlüssel legt deploy/zulieferer-schluessel.sh an (verdeckt, nie im Chat). Sind beide gesetzt, nimmt
// das Skript zuerst den Zulieferer-Schlüssel und fällt nur bei 401/403 auf den alten zurück — so bleibt die Reihenfolge
// der Umstellung (Mac zuerst oder Server zuerst) egal.
// Den lokalen Schlüssel liest es aus .env.local.
//
//   node zulieferer.mjs            # dauerhaft (alle paar Minuten)
//   node zulieferer.mjs --einmal   # ein Durchgang, zum Testen

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function lies(pfad) {
  try {
    return Object.fromEntries(readFileSync(pfad, 'utf8').split('\n')
      .map(z => z.trim()).filter(z => z && !z.startsWith('#') && z.includes('='))
      .map(z => [z.slice(0, z.indexOf('=')), z.slice(z.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
  } catch { return {}; }
}
const env = { ...lies(join(homedir(), '.make-os', 'zulieferer.env')), ...process.env };
const lokalEnv = lies(new URL('.env.local', import.meta.url));
const SERVER = (env.MAKE_OS_SERVER ?? '').replace(/\/+$/, '');
const SERVER_KEYS = [env.MAKE_OS_ZULIEFERER_KEY, env.MAKE_OS_SERVER_KEY].map(k => (k ?? '').trim()).filter(Boolean);
const LOKAL = (env.MAKE_OS_LOKAL ?? 'http://localhost:3001').replace(/\/+$/, '');
const LOKAL_KEY = env.MAKE_OS_KEY ?? lokalEnv.MAKE_OS_KEY ?? '';
if (!SERVER || !SERVER_KEYS.length || !LOKAL_KEY) {
  console.error('[Zulieferer] Es fehlt MAKE_OS_SERVER, MAKE_OS_ZULIEFERER_KEY bzw. MAKE_OS_SERVER_KEY (~/.make-os/zulieferer.env) oder der lokale MAKE_OS_KEY. Beende.');
  process.exit(1);
}

/** Was, woher, wie oft (Minuten). */
const PLAN = [
  { art: 'kalender', pfad: '/api/apple-calendar?refresh=1', alle: 10 },
  { art: 'mail', pfad: '/api/apple-mail', alle: 10 },
  { art: 'erinnerungen', pfad: '/api/apple-reminders', alle: 30 },
  { art: 'kontakte', pfad: '/api/apple-contacts', alle: 24 * 60 },
];
const zuletzt = {};
const zeit = () => new Date().toLocaleTimeString('de-DE');

async function liefere(p) {
  const r = await fetch(`${LOKAL}${p.pfad}`, { headers: { 'x-make-key': LOKAL_KEY }, signal: AbortSignal.timeout(120_000) });
  const daten = await r.json();
  if (!r.ok || (daten && !Array.isArray(daten) && daten.error && p.art !== 'kontakte')) throw new Error(`lokal: ${daten?.error ?? r.status}`);
  if (p.art === 'kontakte' && daten?.error) throw new Error(`lokal: ${daten.error}`);
  const at = r.headers.get('x-stand') ?? new Date().toISOString();
  const body = JSON.stringify({ art: p.art, daten, at });
  let s;
  for (const [i, key] of SERVER_KEYS.entries()) {
    s = await fetch(`${SERVER}/api/zulieferung`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-make-key': key }, body, signal: AbortSignal.timeout(60_000),
    });
    // Abgewiesen (Schlüssel dem Server noch nicht bekannt bzw. alter Schlüssel nicht mehr erlaubt)? Den nächsten versuchen.
    if ((s.status === 401 || s.status === 403) && i < SERVER_KEYS.length - 1) continue;
    break;
  }
  const a = await s.json().catch(() => ({}));
  if (!a.ok) throw new Error(`Server: ${a.fehler ?? s.status}`);
  return a.anzahl;
}

async function runde() {
  for (const p of PLAN) {
    if (zuletzt[p.art] && Date.now() - zuletzt[p.art] < p.alle * 60_000) continue;
    try {
      const n = await liefere(p);
      zuletzt[p.art] = Date.now();
      console.log(`[${zeit()}] ${p.art}: geliefert${n != null ? ` (${n})` : ''}`);
    } catch (e) {
      console.log(`[${zeit()}] ${p.art}: nicht geliefert — ${String(e?.message ?? e).slice(0, 120)}`);
    }
  }
}

await runde();
if (!process.argv.includes('--einmal')) setInterval(runde, 60_000);
