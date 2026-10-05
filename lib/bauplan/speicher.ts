// ─── Bauplan — Speicher (Server) ────────────────────────────────────────────
// Eine Datei „backlog“ ({ items, etappen }), geschrieben nur über updateJson —
// jede Handlung ist eine Einzeländerung, so überschreiben sich Kevin, Malin,
// ZOE und der Loop nie gegenseitig. Bilder liegen daneben als Dateien unter
// <daten>/bauplan-bilder (nie im Repo, mit der nächtlichen Sicherung gesichert).
// DSGVO 05.10.: Bildschirmfotos können Personendaten zeigen → mit Datenschlüssel VERSCHLÜSSELT abgelegt wie die Dateiablage
// (Hülle MKOSDAT1/2 im Format des Modus, AAD `bauplan-bilder/<name>`, lib/store/datei-huelle.mjs); ältere Klartext-Bilder bleiben
// lesbar und werden bei der Umschlüsselung (lib/store/umschluesseln.ts) verschlüsselt. Löschfrist: lib/bauplan/bilder-frist.ts.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { datenOrdner, loadJson, updateJson } from '@/lib/store/local-db';
import { schluesselRing } from '@/lib/store/huelle.mjs';
import { binImModus, binOeffnen, binVersion } from '@/lib/store/datei-huelle.mjs';
import { atomarSchreiben } from '@/lib/store/atomar.mjs';
import { bilderFaellig, VERWAIST_TAGE } from './bilder-frist';
import { SEED, type BacklogItem } from '@/lib/make-one/backlog-data';
import { neueKarte, bildNameOk, type BauplanDatei } from './board';
import { neueKennung } from '@/lib/kennung';

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

/** Neue Karte oben in „Ideen“ — aus dem Formular, dem Knopf auf jeder Seite oder von ZOE. */
export async function karteAnlegen(roh: Record<string, unknown>, von: string): Promise<BacklogItem | null> {
  const jetzt = new Date().toISOString();
  const karte = neueKarte(roh, von, jetzt, neueKennung('bp'));
  if (!karte) return null;
  await aendereBauplan(d => ({ ...d, items: [karte, ...d.items] }));
  return karte;
}

/** Ordner der Bildschirmfotos — im Datenordner (Tests biegen ihn mit MAKE_OS_DATEN_DIR um). */
export const bilderOrdner = () => path.join(datenOrdner(), 'bauplan-bilder');
/** „Haushalt“ der Hülle (AAD) — eine Datei, die unter anderem Namen liegt, öffnet sich nicht. */
export const BILD_AAD = 'bauplan-bilder';
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
  await fs.mkdir(bilderOrdner(), { recursive: true, mode: 0o700 });
  const name = `${randomUUID()}.${TYPEN[m[1]].ext}`;
  const aktiv = schluesselRing().aktiv;
  await atomarSchreiben(path.join(bilderOrdner(), name), aktiv ? binImModus(buf, aktiv, BILD_AAD, name) : buf);
  return { name };
}

export async function bildLesen(name: string): Promise<{ daten: Buffer; mime: string } | null> {
  if (!bildNameOk(name)) return null;
  try {
    const roh = await fs.readFile(path.join(bilderOrdner(), name));
    const daten = binVersion(roh) ? binOeffnen(roh, schluesselRing(), BILD_AAD, name).klar : roh;
    const ext = name.split('.').pop()!;
    return { daten, mime: ext === 'jpg' ? 'image/jpeg' : `image/${ext}` };
  } catch { return null; }
}

/**
 * Löschfrist der Bildschirmfotos (Löschfristen-Lauf): fällige Dateien weg, ihre Namen aus den Karten. `grenze` = Stichtag der Frist
 * „bauplan-bilder“ (JJJJ-MM-TT); verwaiste Bilder nach VERWAIST_TAGE. Gibt die Zahl gelöschter Dateien zurück.
 */
export async function bauplanBilderAufraeumen(grenze: string, jetzt = new Date()): Promise<number> {
  const namen = (await fs.readdir(bilderOrdner()).catch(() => [] as string[])).filter(bildNameOk);
  if (!namen.length) return 0;
  const dateien = await Promise.all(namen.map(async name => ({ name, tag: new Date((await fs.stat(path.join(bilderOrdner(), name))).mtimeMs).toISOString().slice(0, 10) })));
  const grenzeVerwaist = new Date(jetzt.getTime() - VERWAIST_TAGE * 86_400_000).toISOString().slice(0, 10);
  const weg = new Set(bilderFaellig((await ladeBauplan()).items, dateien, grenze, grenzeVerwaist));
  if (!weg.size) return 0;
  // Erst die Karten (kein Verweis ins Leere), dann die Dateien.
  await aendereBauplan(d => (d.items.some(k => (k.bilder ?? []).some(b => weg.has(b)))
    ? { ...d, items: d.items.map(k => (k.bilder ?? []).some(b => weg.has(b)) ? { ...k, bilder: (k.bilder ?? []).filter(b => !weg.has(b)) } : k) }
    : d));
  for (const n of weg) await fs.unlink(path.join(bilderOrdner(), n)).catch(() => {});
  return weg.size;
}
