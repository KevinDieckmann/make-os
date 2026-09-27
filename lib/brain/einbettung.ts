// ─── Brain: lokale Embeddings (Server, 27.09.) ───────────────────────────────
// Kevins Entscheidung 27.09.: Volltext UND lokale Embeddings — multilingual-e5-
// small per Transformers.js/ONNX, int8, 384 Dimensionen. Nichts verlässt den
// Server. Das Modell (~120 MB) wird beim ersten Gebrauch geladen und liegt unter
// MAKE_OS_MODELLE_DIR (Standard ~/.cache/make-os/modelle) — bewusst NICHT im
// Datenordner, damit es nicht in jede Sicherung wandert.
//
// Vektoren liegen im Brain-Index (Tabelle vektoren, Float32 als BLOB). Bei ein
// paar tausend Abschnitten reicht Kosinus-Ähnlichkeit im Speicher — keine
// Vektordatenbank (BRAIN_RECHERCHE.md, Punkt 6/24). Hybrid mit BM25 über
// Reciprocal Rank Fusion (k = 60) in lib/brain/index.ts.
//
// Aus: MAKE_OS_EMBEDDINGS=aus (dann bleibt es bei FTS5). Bei wenig Speicher
// (unter 400 MB frei) wird das Modell nicht geladen, sondern ein Hinweis notiert.

import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { oeffneIndex, indexStand } from './index';

export const MODELL = process.env.MAKE_OS_EMBEDDING_MODELL?.trim() || 'Xenova/multilingual-e5-small';
export const DIM = 384;
export const modelleOrdner = () => process.env.MAKE_OS_MODELLE_DIR?.trim() || path.join(os.homedir(), '.cache', 'make-os', 'modelle');
export const embeddingsAktiv = () => process.env.MAKE_OS_EMBEDDINGS !== 'aus' && process.env.NODE_ENV !== 'test';

/**
 * Tempo (27.09.): das Modell rechnet auf allen Kernen (ONNX-Thread-Pool — auf dem Mac 300 % CPU beim Auffüllen). Auf einem
 * Server mit höchstens zwei CPUs würde es die Software selbst ausbremsen; dort bleibt es aus, es sei denn, jemand setzt
 * MAKE_OS_EMBEDDINGS=an ausdrücklich. Rein, getestet.
 */
export function embeddingsErlaubt(cpus = os.cpus().length, env: Record<string, string | undefined> = process.env): { ok: boolean; grund?: string; faeden: number } {
  const faeden = Math.max(1, Math.min(4, cpus - 2));
  if (env.MAKE_OS_EMBEDDINGS === 'aus') return { ok: false, grund: 'Embeddings sind aus (MAKE_OS_EMBEDDINGS=aus).', faeden };
  if (cpus <= 2 && env.MAKE_OS_EMBEDDINGS !== 'an') return { ok: false, grund: `Embeddings auf einem Rechner mit ${cpus} CPU${cpus === 1 ? '' : 's'} aus — sie würden die Software ausbremsen (MAKE_OS_EMBEDDINGS=an erzwingt, dann nur Volltext-Suche fehlt nichts).`, faeden };
  return { ok: true, faeden };
}

/**
 * Verfügbarer Speicher in MB. `os.freemem()` zählt auf macOS und Linux nur wirklich ungenutzte Seiten — Dateicache
 * gilt als belegt, und der ist fast immer groß. Linux: MemAvailable aus /proc/meminfo (was ein Prozess bekäme).
 * Sonst: Gesamtspeicher minus eigener RSS als grobe Obergrenze, höchstens 4 GB angenommen.
 */
export function speicherVerfuegbarMb(): number {
  try {
    if (process.platform === 'linux') {
      const m = readFileSync('/proc/meminfo', 'utf8').match(/MemAvailable:\s+(\d+) kB/);
      if (m) return Number(m[1]) / 1024;
    }
  } catch { /* unten weiter */ }
  return Math.max(os.freemem(), Math.min(4096 * 1_048_576, os.totalmem()) - process.memoryUsage().rss) / 1_048_576;
}

type Extraktor = (texte: string[], opt: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>;
let lader: Promise<Extraktor | null> | null = null;
let hinweis: string | null = null;
export const embeddingHinweis = () => hinweis;

/** Das Modell — einmal je Prozess, faul geladen. null, wenn aus oder nicht ladbar (dann bleibt es bei FTS5). */
export function modell(): Promise<Extraktor | null> {
  if (lader) return lader;
  lader = (async () => {
    if (!embeddingsAktiv()) { hinweis = 'Embeddings sind aus (MAKE_OS_EMBEDDINGS=aus).'; return null; }
    const erlaubt = embeddingsErlaubt();
    if (!erlaubt.ok) { hinweis = erlaubt.grund ?? null; return null; }
    const freiMb = speicherVerfuegbarMb();
    if (freiMb < 500) { hinweis = `zu wenig freier Speicher für das Modell (${Math.round(freiMb)} MB verfügbar) — nur Volltext`; return null; }
    try {
      const tf = await import('@huggingface/transformers');
      tf.env.cacheDir = modelleOrdner();
      tf.env.allowRemoteModels = true;
      // Fäden begrenzen: nie alle Kerne, damit Seiten und Takt daneben flüssig bleiben.
      const p = await tf.pipeline('feature-extraction', MODELL, { dtype: 'q8', session_options: { intraOpNumThreads: erlaubt.faeden, interOpNumThreads: 1 } } as Parameters<typeof tf.pipeline>[2]);
      hinweis = null;
      return p as unknown as Extraktor;
    } catch (err) {
      hinweis = `Modell nicht ladbar: ${err instanceof Error ? err.message.slice(0, 160) : 'unbekannt'}`;
      console.error('[brain-embeddings]', hinweis);
      return null;
    }
  })();
  return lader;
}

/** e5 erwartet Präfixe: „query: “ für Fragen, „passage: “ für Abschnitte. */
export async function einbetten(texte: string[], art: 'query' | 'passage'): Promise<Float32Array[] | null> {
  const m = await modell();
  if (!m || !texte.length) return null;
  const aus = await m(texte.map(t => `${art}: ${t.slice(0, 2400)}`), { pooling: 'mean', normalize: true });
  return aus.tolist().map(v => Float32Array.from(v));
}

export function kosinus(a: Float32Array, b: Float32Array): number {
  let s = 0; const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s; // beide normalisiert
}

/** Reciprocal Rank Fusion zweier Ranglisten (k = 60) — rein, getestet. */
export function rrf<T extends string | number>(listen: T[][], k = 60): { id: T; punkte: number }[] {
  const s = new Map<T, number>();
  for (const l of listen) l.forEach((id, i) => s.set(id, (s.get(id) ?? 0) + 1 / (k + i + 1)));
  return Array.from(s.entries()).map(([id, punkte]) => ({ id, punkte })).sort((a, b) => b.punkte - a.punkte);
}

/** Abschnitte ohne Vektor nachziehen — in Portionen, damit ein Lauf den Prozess nicht blockiert. */
export async function vektorenAuffuellen(hoechstens = 64): Promise<{ neu: number; offen: number; hinweis: string | null }> {
  const d = oeffneIndex();
  const offenZaehlen = () => Number((d.prepare(`SELECT COUNT(*) n FROM chunks c WHERE NOT EXISTS (SELECT 1 FROM vektoren v WHERE v.chunk_id = c.id AND v.modell = ?)`).get(MODELL) as { n: number }).n);
  const m = await modell();
  if (!m) return { neu: 0, offen: offenZaehlen(), hinweis };
  const zeilen = d.prepare(`SELECT c.id, c.kontext, c.text FROM chunks c WHERE NOT EXISTS (SELECT 1 FROM vektoren v WHERE v.chunk_id = c.id AND v.modell = ?) LIMIT ?`).all(MODELL, hoechstens) as { id: number; kontext: string; text: string }[];
  if (!zeilen.length) return { neu: 0, offen: 0, hinweis: null };
  const setze = d.prepare('INSERT INTO vektoren(chunk_id, modell, dim, v) VALUES (?, ?, ?, ?) ON CONFLICT(chunk_id) DO UPDATE SET modell = excluded.modell, dim = excluded.dim, v = excluded.v');
  let neu = 0;
  for (let i = 0; i < zeilen.length; i += 16) {
    const teil = zeilen.slice(i, i + 16);
    const vs = await einbetten(teil.map(z => `${z.kontext}\n${z.text}`), 'passage');
    if (!vs) break;
    d.exec('BEGIN');
    try { teil.forEach((z, j) => { setze.run(z.id, MODELL, vs[j].length, Buffer.from(vs[j].buffer, vs[j].byteOffset, vs[j].byteLength)); neu++; }); d.exec('COMMIT'); }
    catch (err) { d.exec('ROLLBACK'); throw err; }
  }
  speicher = null; // Vektor-Cache neu laden
  return { neu, offen: offenZaehlen(), hinweis: null };
}

let speicher: { stand: string; ids: Int32Array; vektoren: Float32Array[]; notizen: string[] } | null = null;

/** Alle Vektoren im Speicher (ein paar MB) — neu geladen, wenn der Index sich geändert hat. */
function ladeVektoren(): NonNullable<typeof speicher> {
  const d = oeffneIndex();
  const st = indexStand();
  const stand = `${st.letzterLauf}|${st.vektoren}`;
  if (speicher && speicher.stand === stand) return speicher;
  const zeilen = d.prepare('SELECT v.chunk_id, v.v, c.notiz_id FROM vektoren v JOIN chunks c ON c.id = v.chunk_id WHERE v.modell = ?').all(MODELL) as { chunk_id: number; v: Uint8Array; notiz_id: string }[];
  speicher = {
    stand,
    ids: Int32Array.from(zeilen.map(z => z.chunk_id)),
    vektoren: zeilen.map(z => new Float32Array(z.v.buffer, z.v.byteOffset, z.v.byteLength / 4)),
    notizen: zeilen.map(z => z.notiz_id),
  };
  return speicher;
}

/** Semantisch ähnlichste Abschnitte (Kennungen, beste zuerst) — null, wenn kein Modell/keine Vektoren. */
export async function aehnlicheChunks(frage: string, anzahl = 20): Promise<{ chunkId: number; notizId: string; aehnlichkeit: number }[] | null> {
  const q = await einbetten([frage], 'query');
  if (!q) return null;
  const s = ladeVektoren();
  if (!s.ids.length) return null;
  const punkte: { chunkId: number; notizId: string; aehnlichkeit: number }[] = [];
  for (let i = 0; i < s.ids.length; i++) punkte.push({ chunkId: s.ids[i], notizId: s.notizen[i], aehnlichkeit: kosinus(q[0], s.vektoren[i]) });
  punkte.sort((a, b) => b.aehnlichkeit - a.aehnlichkeit);
  return punkte.slice(0, anzahl);
}
