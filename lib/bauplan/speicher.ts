// ─── Bauplan — Speicher (Server) ────────────────────────────────────────────
// Eine Datei „backlog“ ({ items, etappen }), geschrieben nur über updateJson —
// jede Handlung ist eine Einzeländerung, so überschreiben sich Kevin, Malin,
// Jarvis und der Loop nie gegenseitig. Bilder liegen daneben als Dateien unter
// .data/bauplan-bilder (nie im Repo, mit der nächtlichen Sicherung gesichert).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { SEED, type BacklogItem } from '@/lib/make-one/backlog-data';
import { neueKarte, bildNameOk, type BauplanDatei } from './board';

export async function ladeBauplan(): Promise<BauplanDatei> {
  const f = await loadJson<BauplanDatei>('backlog');
  if (f && Array.isArray(f.items) && f.items.length) return { items: f.items, etappen: f.etappen ?? [] };
  const jetzt = new Date().toISOString();
  return { items: SEED.map(s => ({ ...s, angelegt: jetzt })), etappen: [] };
}

export async function aendereBauplan(mut: (d: BauplanDatei) => BauplanDatei): Promise<BauplanDatei> {
  return updateJson<BauplanDatei>('backlog', cur => {
    const basis: BauplanDatei = cur && Array.isArray(cur.items) && cur.items.length ? { ...cur, etappen: cur.etappen ?? [] } : { items: SEED.map(s => ({ ...s, angelegt: new Date().toISOString() })), etappen: [] };
    return mut(basis);
  });
}

/** Neue Karte oben in „Ideen“ — aus dem Formular, dem Knopf auf jeder Seite oder von Jarvis. */
export async function karteAnlegen(roh: Record<string, unknown>, von: string): Promise<BacklogItem | null> {
  const jetzt = new Date().toISOString();
  const karte = neueKarte(roh, von, jetzt, `bp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  if (!karte) return null;
  await aendereBauplan(d => ({ ...d, items: [karte, ...d.items] }));
  return karte;
}

const BILDER = path.join(process.cwd(), '.data', 'bauplan-bilder');
const TYPEN: Record<string, { ext: string; mime: string }> = { 'image/jpeg': { ext: 'jpg', mime: 'image/jpeg' }, 'image/png': { ext: 'png', mime: 'image/png' }, 'image/webp': { ext: 'webp', mime: 'image/webp' } };
export const BILD_MAX_BYTES = 3 * 1024 * 1024;

/** Ein Bildschirmfoto ablegen (data-URL). Prüft Typ an den ersten Bytes, nicht nur am Etikett. */
export async function bildSpeichern(dataUrl: string): Promise<{ name: string } | { fehler: string }> {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { fehler: 'Nur JPEG, PNG oder WebP.' };
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > BILD_MAX_BYTES) return { fehler: 'Bild zu groß (höchstens 3 MB).' };
  const echt = buf.subarray(0, 4).toString('hex');
  const passt = m[1] === 'image/jpeg' ? echt.startsWith('ffd8ff') : m[1] === 'image/png' ? echt === '89504e47' : buf.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!passt) return { fehler: 'Die Datei ist kein echtes Bild.' };
  await fs.mkdir(BILDER, { recursive: true });
  const name = `${randomUUID()}.${TYPEN[m[1]].ext}`;
  await fs.writeFile(path.join(BILDER, name), buf, { mode: 0o600 });
  return { name };
}

export async function bildLesen(name: string): Promise<{ daten: Buffer; mime: string } | null> {
  if (!bildNameOk(name)) return null;
  try {
    const daten = await fs.readFile(path.join(BILDER, name));
    const ext = name.split('.').pop()!;
    return { daten, mime: ext === 'jpg' ? 'image/jpeg' : `image/${ext}` };
  } catch { return null; }
}
