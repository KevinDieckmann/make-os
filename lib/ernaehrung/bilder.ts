// ─── MAKE OS — Fotos zu Gerichten (Server) ──────────────────────────────────
// Kevin (26.09.): „Foto zum Gericht — vom Handy, erscheint in Bibliothek und Plan.“
// Dateien liegen unter .data/bilder-gerichte (nie im Repo, mit der nächtlichen
// Sicherung gesichert; im Ruhezustand NICHT verschlüsselt — Paket B). Das Handy
// verkleinert vor dem Hochladen (ErnaehrungView), der Server prüft Typ an den
// ersten Bytes und Größe. Muster wie lib/bauplan/speicher.ts.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const ORDNER = path.join(process.env.MAKE_OS_DATEN_DIR ?? path.join(process.cwd(), '.data'), 'bilder-gerichte');
const TYPEN: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const GERICHT_BILD_MAX = 2 * 1024 * 1024;

export const bildNameOk = (n: string) => /^[a-f0-9-]{10,60}\.(jpg|png|webp)$/.test(n);

export async function gerichtBildSpeichern(dataUrl: string): Promise<{ name: string } | { fehler: string }> {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { fehler: 'Nur JPEG, PNG oder WebP.' };
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > GERICHT_BILD_MAX) return { fehler: 'Bild zu groß (höchstens 2 MB).' };
  const echt = buf.subarray(0, 4).toString('hex');
  const passt = m[1] === 'image/jpeg' ? echt.startsWith('ffd8ff') : m[1] === 'image/png' ? echt === '89504e47' : buf.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!passt) return { fehler: 'Die Datei ist kein echtes Bild.' };
  await fs.mkdir(ORDNER, { recursive: true, mode: 0o700 });
  const name = `${randomUUID()}.${TYPEN[m[1]]}`;
  await fs.writeFile(path.join(ORDNER, name), buf, { mode: 0o600 });
  return { name };
}

export async function gerichtBildLesen(name: string): Promise<{ daten: Buffer; mime: string } | null> {
  if (!bildNameOk(name)) return null;
  try {
    const daten = await fs.readFile(path.join(ORDNER, name));
    const ext = name.split('.').pop()!;
    return { daten, mime: ext === 'jpg' ? 'image/jpeg' : `image/${ext}` };
  } catch { return null; }
}

export async function gerichtBildLoeschen(name: string): Promise<void> {
  if (!bildNameOk(name)) return;
  try { await fs.unlink(path.join(ORDNER, name)); } catch { /* schon weg */ }
}
