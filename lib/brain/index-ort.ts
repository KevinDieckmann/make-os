// ─── Wo der Brain-Index liegt (05.10., Paket „Verschlüsselung lückenlos“) — rein, getestet ─────────────────────────
// Der Such-Index (lib/brain/index.ts) hält Vault-Abschnitte UND die Arbeitsbestände der App (`app_chunks`: Aufgaben,
// Notizen, Angebote, Mandate) im Klartext — FTS5 braucht Klartext. Darum darf er bei gesetztem Datenschlüssel nie auf
// der Platte liegen. Entscheidung (UPDATES.md 05.10., Abwägung SQLCipher / tmpfs / Spalten-Verschlüsselung): der Index
// lebt nur im Arbeitsspeicher — auf dem Server in einem tmpfs mit Größenlimit (compose.yml `/brain-index`), sonst im
// Speicher des Prozesses (`:memory:`) — und wird nach jedem Start aus Vault + verschlüsselten Beständen neu gebaut.
//
// Regeln (in dieser Reihenfolge):
//   MAKE_OS_BRAIN_INDEX=speicher (oder :memory:)      → Arbeitsspeicher
//   MAKE_OS_BRAIN_INDEX=<pfad> auf tmpfs/ramfs        → tmpfs (Server)
//   <pfad> auf der Platte, OHNE Datenschlüssel        → Platte (lokale Entwicklung, Tests — Wegwerfdaten)
//   <pfad> auf der Platte, MIT Datenschlüssel         → Arbeitsspeicher (der Pfad wird verworfen, alte Dateien dort gelöscht)
//                                                        — außer MAKE_OS_BRAIN_INDEX_PLATTE=1 (Notweg, HOI rot)
//   nichts gesetzt, MIT Datenschlüssel                → Arbeitsspeicher
//   nichts gesetzt, OHNE Datenschlüssel               → Platte: <daten>/brain-index.sqlite (wie bis 05.10.)
// WAL/SHM liegen immer neben der Datenbank — im tmpfs also ebenfalls nur im Speicher; `:memory:` hat keine.

import { readFileSync } from 'node:fs';
import path from 'node:path';

export type IndexOrtArt = 'tmpfs' | 'arbeitsspeicher' | 'platte';
export interface IndexOrt {
  art: IndexOrtArt;
  /** Pfad für SQLite — `:memory:` im Arbeitsspeicher. */
  pfad: string;
  /** Liegt Klartext auf der Platte, obwohl ein Datenschlüssel gesetzt ist? (nur mit dem Notweg) */
  klartextAufPlatte: boolean;
  /** Ein ausdrücklich gesetzter Plattenpfad, der wegen des Schlüssels verworfen wurde — dort liegende Dateien werden gelöscht. */
  verworfen?: string;
  /** Warum hier — für Log und Head of IT. */
  grund: string;
}

export interface OrtEingabe {
  env: Record<string, string | undefined>;
  /** Ist ein Datenschlüssel gesetzt (Bestände verschlüsselt)? */
  schluessel: boolean;
  /** Liegt dieser Pfad auf einem Dateisystem im Arbeitsspeicher (tmpfs/ramfs)? */
  ramDateisystem: (pfad: string) => boolean;
  datenOrdner: string;
}

const SPEICHER = new Set(['speicher', ':memory:', 'arbeitsspeicher']);

export function indexOrtWaehlen(e: OrtEingabe): IndexOrt {
  const roh = (e.env.MAKE_OS_BRAIN_INDEX ?? '').trim();
  const speicher = (grund: string, verworfen?: string): IndexOrt => ({ art: 'arbeitsspeicher', pfad: ':memory:', klartextAufPlatte: false, grund, ...(verworfen ? { verworfen } : {}) });
  if (SPEICHER.has(roh.toLowerCase())) return speicher('MAKE_OS_BRAIN_INDEX=speicher');
  const notweg = e.env.MAKE_OS_BRAIN_INDEX_PLATTE?.trim() === '1';
  if (roh && roh !== 'aus') {
    const pfad = path.resolve(roh);
    if (e.ramDateisystem(pfad)) return { art: 'tmpfs', pfad, klartextAufPlatte: false, grund: 'tmpfs (MAKE_OS_BRAIN_INDEX)' };
    if (!e.schluessel) return { art: 'platte', pfad, klartextAufPlatte: false, grund: 'Datei (ohne Datenschlüssel — lokale Entwicklung)' };
    if (notweg) return { art: 'platte', pfad, klartextAufPlatte: true, grund: 'Notweg MAKE_OS_BRAIN_INDEX_PLATTE=1 — Klartext auf der Platte' };
    return speicher(`${pfad} liegt nicht im Arbeitsspeicher (kein tmpfs) — Index im Arbeitsspeicher des Prozesses`, pfad);
  }
  const standard = path.join(e.datenOrdner, 'brain-index.sqlite');
  if (!e.schluessel) return { art: 'platte', pfad: standard, klartextAufPlatte: false, grund: 'Datei im Datenordner (ohne Datenschlüssel — lokale Entwicklung)' };
  if (notweg) return { art: 'platte', pfad: standard, klartextAufPlatte: true, grund: 'Notweg MAKE_OS_BRAIN_INDEX_PLATTE=1 — Klartext auf der Platte' };
  return speicher('Datenschlüssel gesetzt, kein tmpfs eingerichtet — Index im Arbeitsspeicher des Prozesses');
}

let mountsCache: { zeit: number; text: string | null } | null = null;
/** /proc/self/mounts — höchstens einmal je Minute gelesen (oeffneIndex fragt bei jeder Suche nach dem Ort). */
function mountsText(): string | null {
  if (process.platform !== 'linux') return null;
  const jetzt = Date.now();
  if (mountsCache && jetzt - mountsCache.zeit < 60_000) return mountsCache.text;
  let text: string | null = null;
  try { text = readFileSync('/proc/self/mounts', 'utf8'); } catch { text = null; }
  mountsCache = { zeit: jetzt, text };
  return text;
}

/** Einhängepunkte aus /proc/self/mounts (Linux) — `null` auf anderen Systemen. Rein bis aufs Lesen. */
export function einhaengepunkte(text?: string): { ziel: string; typ: string }[] | null {
  const t = text ?? mountsText();
  if (t === null) return null;
  // Zeile: <quelle> <ziel> <typ> <optionen> 0 0 — Leerzeichen im Ziel sind als \040 kodiert.
  return t.split('\n').map(z => z.split(' ')).filter(f => f.length >= 3).map(f => ({ ziel: f[1].replace(/\\040/g, ' '), typ: f[2] }));
}

/** Liegt der Pfad (bzw. sein Ordner) auf tmpfs/ramfs? Längster passender Einhängepunkt entscheidet. */
export function ramDateisystem(pfad: string, punkte = einhaengepunkte()): boolean {
  if (!punkte) return false;
  const ordner = path.dirname(path.resolve(pfad));
  let bester: { ziel: string; typ: string } | null = null;
  for (const p of punkte) {
    const z = p.ziel === '/' ? '/' : p.ziel.replace(/\/+$/, '');
    if ((ordner === z || ordner.startsWith(z === '/' ? '/' : `${z}/`)) && (!bester || z.length > bester.ziel.length)) bester = { ziel: z, typ: p.typ };
  }
  return !!bester && (bester.typ === 'tmpfs' || bester.typ === 'ramfs');
}
