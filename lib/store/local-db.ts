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

/**
 * Die Tagessicherungen genau DIESES Stores, älteste zuerst.
 *
 * 24.09.: vorher reichte „fängt mit name- an“. Damit zählten `vitals--malin-…`
 * und handgemachte Sicherungen wie `vitals-vor-whoop-…` zu `vitals` und wurden
 * beim Aufräumen mitgelöscht. Jetzt nur `<name>-JJJJ-MM-TT.json`.
 */
/** Liegt neben dem Bestand eine beiseitegelegte, beschädigte Fassung (26.09.)? */
export async function beschaedigt(name: string): Promise<boolean> {
  try { return (await fs.readdir(DATA_DIR)).some(f => f.startsWith(`${name}.json.corrupt-`)); } catch { return false; }
}

export function sicherungenVon(name: string, dateien: string[]): string[] {
  const muster = new RegExp(`^${name}-\\d{4}-\\d{2}-\\d{2}\\.json$`);
  return dateien.filter(f => muster.test(f)).sort();
}

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
    const alle = sicherungenVon(name, await fs.readdir(BACKUP_DIR));
    for (const f of alle.slice(0, Math.max(0, alle.length - BACKUPS_BEHALTEN))) {
      await fs.unlink(path.join(BACKUP_DIR, f)).catch(() => {});
    }
  } catch { /* Sicherung ist best effort — Original existiert evtl. noch nicht */ }
}

/**
 * Stand mehrerer Sammlungen als kurzer Text: Änderungszeit und Größe je Datei.
 * Ändert sich eine Sammlung, ändert sich der Stand — daraus bauen große
 * Abfragen ihr ETag, damit der 20-Sekunden-Abgleich nur Neues überträgt (25.09.).
 * Schreiben geht immer über tmp + rename, die Änderungszeit springt also verlässlich.
 */
export async function speicherStand(namen: string[]): Promise<string> {
  const teile = await Promise.all(namen.map(async name => {
    pruefeName(name);
    try { const st = await fs.stat(path.join(DATA_DIR, `${name}.json`)); return `${Math.round(st.mtimeMs).toString(36)}.${st.size.toString(36)}`; }
    catch { return '0'; }
  }));
  return teile.join('-');
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
    // Nur der Besitzer liest die Bestände (26.09.) — auf dem Server ist das der Container-Nutzer = make.
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
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
    await fs.writeFile(tmp, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
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

/**
 * Schreibt eine Sammlung mit Schrumpf-Schutz: Wenn der neue Stand deutlich
 * weniger Einträge hätte als der alte, wird abgelehnt statt überschrieben.
 *
 * Warum: Eine Ansicht, die ihren Stand nicht laden konnte, startet leer —
 * und der erste Klick würde diesen leeren Stand speichern. Genau so gehen
 * mühsam gepflegte Listen verloren, ohne dass es jemand merkt.
 *
 * Die Prüfung läuft INNERHALB der Schreib-Sperre, greift also auch dann,
 * wenn zwei Anfragen gleichzeitig kommen.
 *
 * @param zaehle  liefert die Anzahl der Einträge, die geschützt werden soll
 * @param abTeil  ab welcher Größe geprüft wird (kleine Listen ändern sich stark)
 * @returns       { ok: true, next } oder { ok: false } — dann wurde NICHT geschrieben
 */
/**
 * Die eigentliche Regel hinter beiden Wächtern: schrumpft eine Liste um mehr
 * als die Hälfte, ist das kein Bearbeiten mehr, sondern ein Verlust.
 *
 * Steht als eigene Funktion da, damit sie prüfbar ist. Sie ist die Zeile, die
 * am 06.09. verhindert hätte, dass 57 Aufgaben still verschwinden — so etwas
 * gehört nicht in eine Bedingung mitten in einer Schreiboperation, wo es
 * niemand testen kann.
 *
 * @param alt     Länge vorher
 * @param neu     Länge nachher
 * @param abTeil  ab welcher Länge überhaupt geprüft wird (kurze Listen
 *                schwanken naturgemäß stark — bei 2 von 3 wäre jede Änderung
 *                verdächtig)
 */
export function schrumpftZuStark(alt: number, neu: number, abTeil: number): boolean {
  return alt >= abTeil && neu < alt / 2;
}

export async function updateGeschuetzt<T>(
  name: string,
  neu: T,
  zaehle: (stand: T) => number,
  abTeil = 10,
): Promise<{ ok: boolean; next: T }> {
  let abgelehnt = false;
  const next = await updateJson<T>(name, current => {
    if (!current) return neu;
    const alt = zaehle(current);
    if (schrumpftZuStark(alt, zaehle(neu), abTeil)) {
      abgelehnt = true;
      return current;
    }
    return neu;
  });
  return { ok: !abgelehnt, next };
}

/**
 * Derselbe Schutz für Dateien mit MEHREREN Listen — etwa der Finanzplan mit
 * Firmen, Rechnungen, Zahlungen und Merkposten nebeneinander.
 *
 * Warum eigens dafür: mit `updateGeschuetzt` müsste man sich für EINE Liste
 * entscheiden. Dann kämen zwar die Rechnungen durch, aber die neun offenen
 * Zahlungen könnten still verschwinden. Hier wird jede Liste einzeln geprüft;
 * eine einzige schrumpfende reicht, um den ganzen Schreibvorgang abzulehnen.
 *
 * @param felder  welche Listen geschützt werden (Schlüssel der Datei)
 * @param abTeil  ab welcher Länge geprüft wird — kurze Listen ändern sich stark
 * @returns       bei Ablehnung zusätzlich `verloren`: welche Liste geschrumpft wäre
 */
export async function updateGeschuetztListen<T extends object>(
  name: string,
  neu: T,
  felder: (keyof T)[],
  abTeil = 3,
): Promise<{ ok: boolean; next: T; verloren?: string }> {
  let verloren: string | undefined;
  const laenge = (o: T | null, k: keyof T) => {
    const v = o ? (o as Record<string, unknown>)[String(k)] : undefined;
    return Array.isArray(v) ? v.length : 0;
  };

  const next = await updateJson<T>(name, current => {
    if (!current) return neu;
    for (const k of felder) {
      const alt = laenge(current, k);
      if (schrumpftZuStark(alt, laenge(neu, k), abTeil)) {
        verloren = `${String(k)} (${alt} → ${laenge(neu, k)})`;
        return current;
      }
    }
    return neu;
  });
  return { ok: !verloren, next, verloren };
}
