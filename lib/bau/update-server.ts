// ─── MAKE OS — Update-Marke lesen (Server, 08.10., Phase 0) — Regeln: lib/bau/update.ts ──
// Die Marke schreibt deploy/ausrollen.sh am Host nach `<daten>/system/update.json` (im Container `<datenOrdner>/system`).
// Nur lesen: Lesen schreibt nicht, und ein Fehler (fehlt, unlesbar) heißt schlicht „kein Update“.

import fs from 'node:fs/promises';
import path from 'node:path';
import { datenOrdner } from '@/lib/store/local-db';
import { UPDATE_MARKE, updateLage, type UpdateLage } from './update';

/** Startzeit dieses Server-Prozesses (ms) — der Container startet beim Tausch neu. */
export const SERVER_START_MS = Date.now() - Math.round(process.uptime() * 1000);

export const updateMarkePfad = () => path.join(datenOrdner(), 'system', UPDATE_MARKE);

export async function updateStand(jetzt = Date.now(), start = SERVER_START_MS): Promise<UpdateLage> {
  let text: string | null = null;
  try { text = await fs.readFile(updateMarkePfad(), 'utf8'); } catch { /* keine Marke — kein Update */ }
  return updateLage(text, { jetzt, start });
}
