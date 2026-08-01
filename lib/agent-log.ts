// ─── MAKE OS — Agenten-Gedächtnis (server-seitiger Helfer) ──────────────────
// Jeder Agent schreibt sein Ergebnis hierhin. Damit verschwinden Läufe nicht
// beim Neuladen, Loops können „letzte Woche vs. diese Woche" vergleichen und
// MAKE kann sich auf frühere Ergebnisse beziehen.
//
// EINE Stelle für Anhängen/Lesen — jede weitere Kopie erzeugt sonst verlorene
// Einträge (gleichzeitiges Lesen-Ändern-Schreiben) und divergierende Formate.

import { loadJson, updateJson } from '@/lib/store/local-db';

export interface AgentLogEntry {
  id: string;
  agent: string;
  title: string;
  ts: string;
  payload: unknown;
}
interface LogFile { entries: AgentLogEntry[] }

export const MAX_ENTRIES = 200;

/** Defensiv lesen: auch bei fremdem/kaputtem Format nie werfen. */
async function readEntries(): Promise<AgentLogEntry[]> {
  const raw = await loadJson<LogFile>('agent-log');
  return Array.isArray(raw?.entries) ? raw.entries : [];
}

/** Hängt einen Lauf ans Gedächtnis. Schlägt nie fehl — Logging darf einen
 *  Agenten nie kaputt machen. Serialisiert über updateJson, damit parallele
 *  Läufe sich nicht gegenseitig überschreiben. */
export async function logRun(agent: string, title: string, payload: unknown): Promise<void> {
  try {
    const ts = new Date().toISOString();
    const entry: AgentLogEntry = {
      id: `${agent}-${ts.replace(/[^0-9]/g, '').slice(0, 17)}-${Math.random().toString(36).slice(2, 6)}`,
      agent,
      title: (title || agent).slice(0, 140),
      ts,
      payload,
    };
    await updateJson<LogFile>('agent-log', current => {
      const entries = Array.isArray(current?.entries) ? current.entries : [];
      return { entries: [...entries, entry].slice(-MAX_ENTRIES) };
    });
  } catch (err) {
    console.error('[agent-log] konnte nicht schreiben:', err instanceof Error ? err.message : err);
  }
}

/** Liest die letzten Läufe. `agent` filtert exakt, `prefix` per Anfang
 *  (z. B. 'loop-'). WICHTIG: erst filtern, dann kürzen — sonst verschwindet
 *  die Loop-Historie, sobald andere Agenten viel schreiben. */
export async function recentRuns(agent?: string, limit = 10, prefix?: string): Promise<AgentLogEntry[]> {
  const all = await readEntries();
  let list = all;
  if (agent) list = list.filter(e => e.agent === agent);
  if (prefix) list = list.filter(e => e.agent.startsWith(prefix));
  return [...list].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, Math.max(1, Math.min(50, limit)));
}
