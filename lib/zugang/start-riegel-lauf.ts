// ─── Start-Riegel: beim Start prüfen (nur Node, instrumentation.ts) ─────────
// Liest nur LÄNGEN (Datenschlüssel aus Umgebung/Datei, Pepper aus Umgebung/Datei), nie Werte ins Log. Blockiert der
// Riegel (lib/zugang/start-riegel.ts), endet der Prozess mit einer klaren Meldung im Log — Docker startet ihn neu,
// bis die .env stimmt; Caddy antwortet solange 502. Das Bild bleibt für den Head of IT im Prozess gemerkt.

import { readFileSync } from 'node:fs';
import { schluesselLaenge } from '@/lib/store/huelle.mjs';
import { startPruefung, mangelSatz, type RiegelBild } from './start-riegel';

const g = globalThis as unknown as { __makeosRiegel?: RiegelBild };

function pepperLaenge(env: NodeJS.ProcessEnv): number {
  const e = (env.MAKE_OS_PEPPER ?? '').trim();
  if (e) return e.length;
  const d = env.MAKE_OS_PEPPER_DATEI?.trim();
  if (!d) return 0;
  try { return readFileSync(d, 'utf8').split(/\r?\n/)[0].trim().length; } catch { return 0; }
}

/** Das Bild des Riegels (für den HOI) — beim ersten Aufruf ermittelt. */
export function riegelBild(env: NodeJS.ProcessEnv = process.env): RiegelBild {
  return (g.__makeosRiegel ??= startPruefung(env, { datenSchluessel: schluesselLaenge(env), pepper: pepperLaenge(env) }));
}

/** Beim Start: prüfen, melden, bei Blockade beenden. `beenden` nur für Tests austauschbar. */
export function startRiegel(env: NodeJS.ProcessEnv = process.env, beenden: (code: number) => void = c => process.exit(c)): RiegelBild {
  g.__makeosRiegel = undefined;
  const b = riegelBild(env);
  if (b.blockiert) {
    console.error(`[MAKE OS] START-RIEGEL (${b.modus}): MAKE OS startet nicht — ${b.maengel.filter(m => m.hart).map(mangelSatz).join('; ')}.`);
    console.error('[MAKE OS] Geheimnisse in /srv/make-os/app/.env bzw. als Datei setzen (deploy/env.server.beispiel, UPDATES.md › „Zugang & Schlüssel härten“), dann docker compose up -d.');
    beenden(1);
    return b;
  }
  if (b.maengel.length) console.warn(`[MAKE OS] Start-Riegel (${b.modus}): ${b.maengel.map(mangelSatz).join('; ')} — läuft trotzdem${b.modus === 'scharf' ? ' (erst „streng“ bricht ab)' : ''}.`);
  if (b.modus === 'aus') console.warn('[MAKE OS] Start-Riegel ist AUSGESCHALTET (MAKE_OS_START_RIEGEL=aus) — nur für Sandbox/Prüfbau, nie auf einer Instanz mit echten Daten.');
  return b;
}
