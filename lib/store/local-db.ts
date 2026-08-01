// ─── MAKE OS — Lokale Persistenz (Datei-Store, nur auf diesem Mac) ───────────
// Bewusst simpel & abhängigkeitsfrei: JSON-Dateien unter ./.data.
// Alles läuft lokal, wenn der Rechner an ist. Die einzige Stelle, die "wo
// liegen die Daten" kennt — später 1:1 gegen Supabase/SQLite tauschbar,
// ohne dass API-Routes oder UI das merken.

import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const BACKUP_DIR = path.join(DATA_DIR, 'backup');

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

// Nur einfache Namen — nie Pfade. Verhindert, dass ein manipulierter Aufruf
// über den Namen aus .data ausbricht (../../…).
const NAME_OK = /^[a-z0-9][a-z0-9-]*$/;
function pruefeName(name: string): void {
  if (!NAME_OK.test(name)) throw new Error(`[local-db] unzulässiger Store-Name: ${name}`);
}

// Tägliche Sicherung: bevor eine Sammlung zum ERSTEN Mal am Tag überschrieben
// wird, den Vortags-Stand nach .data/backup/<name>-<tag>.json kopieren.
// Schützt vor dem Fall, den .corrupt nicht abdeckt: ein Client-Fehler schreibt
// VALIDES, aber leeres JSON — ohne Backup wären Monate Journal einfach weg.
const gesichertHeute = new Map<string, string>();
const BACKUPS_BEHALTEN = 14;

async function taeglicheSicherung(name: string, dest: string): Promise<void> {
  const p = (n: number) => String(n).padStart(2, '0');
  const d = new Date();
  const tag = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  if (gesichertHeute.get(name) === tag) return;
  gesichertHeute.set(name, tag);
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const ziel = path.join(BACKUP_DIR, `${name}-${tag}.json`);
    try { await fs.access(ziel); return; } catch { /* heute noch keins */ }
    await fs.copyFile(dest, ziel);
    // Alte Sicherungen dieses Stores auf die letzten N begrenzen.
    const alle = (await fs.readdir(BACKUP_DIR))
      .filter(f => f.startsWith(`${name}-`) && f.endsWith('.json'))
      .sort();
    for (const f of alle.slice(0, Math.max(0, alle.length - BACKUPS_BEHALTEN))) {
      await fs.unlink(path.join(BACKUP_DIR, f)).catch(() => {});
    }
  } catch { /* Sicherung ist best effort — Original existiert evtl. noch nicht */ }
}

/** Liest eine Sammlung; null wenn noch nichts persistiert wurde.
 *
 *  Wichtig: „Datei fehlt" und „Datei kaputt" werden UNTERSCHIEDEN. Früher fing
 *  ein pauschales catch beides ab → eine beschädigte tasks.json wurde als
 *  leerer Zustand gelesen und beim nächsten Speichern überschrieben (echter
 *  Datenverlust). Jetzt wird die kaputte Datei beiseitegelegt (.corrupt-<ts>),
 *  damit sie rettbar bleibt. */
export async function loadJson<T>(name: string): Promise<T | null> {
  pruefeName(name);
  const file = path.join(DATA_DIR, `${name}.json`);
  let buf: string;
  try {
    buf = await fs.readFile(file, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return null; // noch nie gespeichert → sauberer Erststart
    console.error(`[local-db] ${name}: nicht lesbar (${code})`);
    return null;
  }
  try {
    return JSON.parse(buf) as T;
  } catch {
    const backup = `${file}.corrupt-${Date.now()}`;
    try { await fs.rename(file, backup); } catch { /* Rettung ist best effort */ }
    console.error(`[local-db] ${name}.json war beschädigt → gesichert unter ${path.basename(backup)}`);
    return null;
  }
}

// Schreibvorgänge je Sammlung serialisieren. Ohne das überschreiben sich
// gleichzeitige Läufe (z. B. Board-Agent + Wochen-Loop) gegenseitig, weil beide
// lesen → ändern → schreiben. Die Kette hält Writes pro Name in Reihenfolge.
const writeChain = new Map<string, Promise<unknown>>();

/** Schreibt eine Sammlung atomar (tmp + rename), damit kein halber Zustand
 *  entsteht — und serialisiert gleichzeitige Schreiber derselben Sammlung. */
export async function saveJson<T>(name: string, data: T): Promise<void> {
  pruefeName(name);
  const previous = writeChain.get(name) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(async () => {
    await ensureDir();
    const dest = path.join(DATA_DIR, `${name}.json`);
    await taeglicheSicherung(name, dest);
    // Eindeutiger Temp-Name: zwei Prozesse/Läufe dürfen sich nicht dieselbe
    // .tmp-Datei wegziehen.
    const tmp = `${dest}.${process.pid}.${Math.random().toString(36).slice(2, 10)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, dest);
  });
  writeChain.set(name, run);
  try {
    await run;
  } finally {
    if (writeChain.get(name) === run) writeChain.delete(name);
  }
}

/** Liest, verändert und schreibt eine Sammlung in EINEM serialisierten Schritt.
 *  Verhindert verlorene Einträge beim gleichzeitigen Anhängen (agent-log!). */
export async function updateJson<T>(name: string, mutate: (current: T | null) => T): Promise<T> {
  pruefeName(name);
  const previous = writeChain.get(name) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(async () => {
    const current = await loadJson<T>(name);
    const next = mutate(current);
    await ensureDir();
    const dest = path.join(DATA_DIR, `${name}.json`);
    await taeglicheSicherung(name, dest);
    const tmp = `${dest}.${process.pid}.${Math.random().toString(36).slice(2, 10)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(next, null, 2), 'utf8');
    await fs.rename(tmp, dest);
    return next;
  });
  writeChain.set(name, run);
  try {
    return (await run) as T;
  } finally {
    if (writeChain.get(name) === run) writeChain.delete(name);
  }
}
