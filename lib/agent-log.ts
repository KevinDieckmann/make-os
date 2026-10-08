// ─── MAKE OS — Agenten-Gedächtnis (server-seitiger Helfer) ──────────────────
// Jeder Agent schreibt sein Ergebnis hierhin. Damit verschwinden Läufe nicht
// beim Neuladen, Loops können „letzte Woche vs. diese Woche" vergleichen und
// MAKE kann sich auf frühere Ergebnisse beziehen.
//
// EINE Stelle für Anhängen/Lesen — jede weitere Kopie erzeugt sonst verlorene
// Einträge (gleichzeitiges Lesen-Ändern-Schreiben) und divergierende Formate.
//
// Je Person (08.10., Kevin, Phase 0): ein Lauf trägt `person` = wer ihn ausgelöst hat (Sitzung bzw. Dienstweg mit
// `x-make-person`); Systemläufe (Takt ohne Person) tragen keine. Gelesen wird NUR über `laeufeFuer`/`recentRuns` mit der
// lesenden Person: eigene Läufe + Systemläufe, die Läufe einer anderen Person nie. Altbestand ohne `person` gilt als
// Systemlauf (bleibt gemeinsam sichtbar). Konto löschen nimmt die Läufe der Person heraus (lib/datenschutz/konto-daten.ts).

import { loadJson, updateJson } from '@/lib/store/local-db';

export interface AgentLogEntry {
  id: string;
  agent: string;
  title: string;
  ts: string;
  payload: unknown;
  /** Wer den Lauf ausgelöst hat (Speichername) — fehlt bei Systemläufen und im Altbestand (08.10.). */
  person?: string;
}

const PERSON = /^[a-z0-9-]{1,40}$/;

/** Darf `betrachter` diesen Lauf sehen? Eigene und Systemläufe (ohne Person) ja, die einer anderen Person nie. Ohne Person nur Systemläufe. */
export const laufSichtbar = (e: Pick<AgentLogEntry, 'person'>, betrachter: string | null | undefined): boolean => !e.person || e.person === betrachter;
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
export async function logRun(agent: string, title: string, payload: unknown, o: { person: string | null | undefined }): Promise<void> {
  try {
    const ts = new Date().toISOString();
    const entry: AgentLogEntry = {
      id: `${agent}-${ts.replace(/[^0-9]/g, '').slice(0, 17)}-${Math.random().toString(36).slice(2, 6)}`,
      agent,
      title: (title || agent).slice(0, 140),
      ts,
      payload,
      // Wer den Lauf ausgelöst hat (Pflicht-Angabe beim Aufruf, `null` = Systemlauf) — nie geraten, nie Rückfall auf den Inhaber.
      ...(o.person && PERSON.test(o.person) ? { person: o.person } : {}),
    };
    await updateJson<LogFile>('agent-log', current => {
      const entries = Array.isArray(current?.entries) ? current.entries : [];
      return { entries: [...entries, entry].slice(-MAX_ENTRIES) };
    });
  } catch (err) {
    console.error('[agent-log] konnte nicht schreiben:', err instanceof Error ? err.message : err);
  }
}

/** Alle Läufe, die `betrachter` sehen darf (eigene + Systemläufe; `null` = Systemlauf → nur Systemläufe). */
export async function laeufeFuer(betrachter: string | null | undefined): Promise<AgentLogEntry[]> {
  return (await readEntries()).filter(e => laufSichtbar(e, betrachter));
}

/** Liest die letzten Läufe, die `betrachter` sehen darf. `agent` filtert exakt, `prefix` per Anfang
 *  (z. B. 'loop-'). WICHTIG: erst filtern, dann kürzen — sonst verschwindet
 *  die Loop-Historie, sobald andere Agenten viel schreiben. */
export async function recentRuns(betrachter: string | null | undefined, o: { agent?: string; limit?: number; prefix?: string } = {}): Promise<AgentLogEntry[]> {
  const { agent, limit = 10, prefix } = o;
  let list = await laeufeFuer(betrachter);
  if (agent) list = list.filter(e => e.agent === agent);
  if (prefix) list = list.filter(e => e.agent.startsWith(prefix));
  return [...list].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, Math.max(1, Math.min(50, limit)));
}
