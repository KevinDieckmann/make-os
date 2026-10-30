// ─── MAKE OS — Social: Reel-Werkstatt — Werkzeuge (ffmpeg, whisper.cpp) — Server — 28.10.2026 ────────────────────────────────────────
// Kevins Entscheidung 28.10.: Rendern und Untertitel laufen auf dem SERVER — nichts verlässt ihn. Werkzeuge als Unterprozess (nie eine
// Shell, Argumente als Liste — keine Einschleusung), niedrige Priorität, begrenzte Threads, Zeitlimit; je Lauf ein eigener Arbeitsordner
// (0700) unter dem Temp-Ordner, der IMMER wieder gelöscht wird (auch bei Fehlern) — entschlüsselte Clips liegen nie länger als der Lauf.
// Umgebung (nie im Repo): MAKE_OS_FFMPEG (Vorgabe `ffmpeg` im PATH), MAKE_OS_WHISPER (Vorgabe `whisper-cli`), MAKE_OS_WHISPER_MODELL
// (Vorgabe `<MAKE_OS_MODELLE_DIR>/whisper/ggml-small.bin` — geladen über deploy/whisper-modell.sh), MAKE_OS_WERKSTATT_THREADS (Vorgabe 2).
// Fehlt ein Werkzeug, sagt die Oberfläche es ehrlich („Rendern ist auf dieser Instanz aus“) — es wird nie etwas vorgetäuscht.

import { spawn } from 'node:child_process';
import { promises as fs, constants as fsc } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const ffmpegPfad = () => process.env.MAKE_OS_FFMPEG?.trim() || 'ffmpeg';
export const whisperPfad = () => process.env.MAKE_OS_WHISPER?.trim() || 'whisper-cli';
export function whisperModell(): string {
  const m = process.env.MAKE_OS_WHISPER_MODELL?.trim();
  if (m) return m;
  const dir = process.env.MAKE_OS_MODELLE_DIR?.trim() || path.join(os.homedir(), '.cache', 'make-os', 'modelle');
  return path.join(dir, 'whisper', 'ggml-small.bin');
}
export const werkstattThreads = () => Math.max(1, Math.min(8, Number(process.env.MAKE_OS_WERKSTATT_THREADS) || 2));

export interface LaufErgebnis { ok: boolean; code: number | null; fehler: string; zeitUeber: boolean }

/** Ein Werkzeug ausführen: keine Shell, niedrige Priorität, Zeitlimit; stderr nur die letzten 2.000 Zeichen (für die Fehlermeldung). */
export function ausfuehren(bin: string, args: readonly string[], o: { zeitMs: number; ordner?: string }): Promise<LaufErgebnis> {
  return new Promise(resolve => {
    let fehler = '';
    let zeitUeber = false;
    let p: ReturnType<typeof spawn>;
    try { p = spawn(bin, args as string[], { cwd: o.ordner, stdio: ['ignore', 'ignore', 'pipe'], env: { PATH: process.env.PATH ?? '/usr/bin:/bin', LANG: 'C.UTF-8', ...(process.env.HOME ? { HOME: process.env.HOME } : {}), ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}) } as unknown as NodeJS.ProcessEnv }); }
    catch (e) { resolve({ ok: false, code: null, fehler: e instanceof Error ? e.message : 'Start fehlgeschlagen', zeitUeber: false }); return; }
    try { if (p.pid) os.setPriority(p.pid, 15); } catch { /* ohne Recht: normale Priorität */ }
    p.stderr?.on('data', (d: Buffer) => { fehler = (fehler + d.toString('utf8')).slice(-2000); });
    const uhr = setTimeout(() => { zeitUeber = true; p.kill('SIGKILL'); }, o.zeitMs);
    p.on('error', e => { clearTimeout(uhr); resolve({ ok: false, code: null, fehler: e.message, zeitUeber }); });
    p.on('close', code => { clearTimeout(uhr); resolve({ ok: code === 0 && !zeitUeber, code, fehler: fehler.trim(), zeitUeber }); });
  });
}

/** Ist das Werkzeug da? (`-version` bzw. `-h`, kurz). Ergebnis 10 Min. gemerkt. */
const stand = new Map<string, { ok: boolean; bis: number }>();
async function da(bin: string, probe: string[]): Promise<boolean> {
  const s = stand.get(bin);
  if (s && s.bis > Date.now()) return s.ok;
  const r = await ausfuehren(bin, probe, { zeitMs: 8000 });
  const ok = r.code === 0 || (r.code !== null && r.code <= 1 && !r.fehler.includes('ENOENT'));
  stand.set(bin, { ok, bis: Date.now() + 10 * 60_000 });
  return ok;
}

export interface WerkzeugStand { ffmpeg: boolean; whisper: boolean; modell: boolean }
export async function werkzeugStand(): Promise<WerkzeugStand> {
  const ffmpeg = await da(ffmpegPfad(), ['-hide_banner', '-version']);
  const modell = await fs.access(whisperModell(), fsc.R_OK).then(() => true, () => false);
  const whisper = modell && await da(whisperPfad(), ['-h']);
  return { ffmpeg, whisper, modell };
}
export function _werkzeugStandVergessen() { stand.clear(); }

/** Ein eigener Arbeitsordner (0700) mit sicheren Zeichen — `fn` arbeitet darin, danach wird er IMMER gelöscht. */
export async function imArbeitsordner<T>(fn: (ordner: string) => Promise<T>): Promise<T> {
  const basis = path.join(process.env.MAKE_OS_WERKSTATT_TMP?.trim() || os.tmpdir(), 'make-werkstatt');
  await fs.mkdir(basis, { recursive: true, mode: 0o700 });
  const ordner = path.join(basis, randomUUID());
  await fs.mkdir(ordner, { mode: 0o700 });
  try { return await fn(ordner); }
  finally { await fs.rm(ordner, { recursive: true, force: true }).catch(() => {}); }
}

/** Reste früherer Läufe (Absturz mitten im Rendern) wegräumen — älter als 2 h. */
export async function arbeitsordnerAufraeumen(jetzt = Date.now()): Promise<number> {
  const basis = path.join(process.env.MAKE_OS_WERKSTATT_TMP?.trim() || os.tmpdir(), 'make-werkstatt');
  let weg = 0;
  for (const n of await fs.readdir(basis).catch(() => [] as string[])) {
    const p = path.join(basis, n);
    const st = await fs.stat(p).catch(() => null);
    if (st && jetzt - st.mtimeMs > 2 * 3_600_000) { await fs.rm(p, { recursive: true, force: true }).catch(() => {}); weg++; }
  }
  return weg;
}
