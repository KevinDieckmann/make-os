// ─── Brain-Index: SQLite FTS5 neben dem Vault (Server, 27.09.) ──────────────
// Kevins Entscheidung 27.09.: Volltext-Index lokal (dazu Embeddings, lib/brain/
// einbettung.ts). Der Vault bleibt die Wahrheit — der Index ist abgeleitet und
// jederzeit neu baubar. Inkrementell: je Notiz ein Hash — nur Geändertes wird neu zerlegt.
// Sicht (scope/owner) wird VOR dem Ranking angewandt (lib/zoe/vault.ts darfSehen).
// 29.09. (Paket D-B #99): `secure_delete=ON` — gelöschte Zeilen (entfernte Notizen, nach Art. 17 nachgezogene
// Arbeitsbestände in `app_chunks`) werden mit Nullen überschrieben, statt in freien Seiten lesbar zu bleiben. Nach einer
// Löschung zieht lib/crm/person-bestaende.ts den Such-Index sofort nach (nicht erst im 30-Minuten-Takt).
//
// 05.10. (Paket „Verschlüsselung lückenlos“): der Index enthält Vault-Abschnitte UND die Arbeitsbestände (`app_chunks`:
// Aufgaben, Notizen, Angebote, Mandate) — er liegt NIE MEHR im Klartext auf der Platte, sobald ein Datenschlüssel gesetzt
// ist. Wo er liegt, entscheidet `indexOrtWaehlen` (lib/brain/index-ort.ts): tmpfs (Server: compose.yml `/brain-index`,
// Größenlimit) oder der Arbeitsspeicher des Prozesses. Nach jedem Start ist er leer und wird neu gebaut (`indexNachStart`,
// lib/store/betrieb.ts); bis dahin sucht lib/zoe/vault.ts über die Dateien (Rückfall wie bisher). Ein alter Klartext-Index
// unter <daten>/brain-index.sqlite wird beim Start überschrieben und gelöscht. Ohne Schlüssel (lokale Entwicklung mit
// Wegwerfdaten) bleibt er wie bisher als Datei im Datenordner. Begründung und Rückweg: UPDATES.md (05.10.).

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { datenOrdner } from '@/lib/store/local-db';
import { schluesselRing } from '@/lib/store/huelle.mjs';
import { indexOrtWaehlen, ramDateisystem, type IndexOrt } from './index-ort';
import { bestand, leseKopf, darfSehen, sichtAufloesen, type Sicht, type VaultSicht, type Treffer } from '@/lib/zoe/vault';
import { abschnitte, verweise, ftsAnfrage } from './chunks';

export interface IndexStand { notizen: number; chunks: number; vektoren: number; letzterLauf: string | null; dauerMs: number | null; datei: string }
export interface IndexLauf { neu: number; geaendert: number; entfernt: number; unveraendert: number; chunks: number; dauerMs: number }
export interface IndexTreffer extends Treffer { abschnitt: string; chunkId: number; notizId: string }

let db: DatabaseSync | null = null;
let dbPfad = '';
const HASH = (t: string) => createHash('sha1').update(t).digest('hex');

/** Der alte Ort des Index (bis 05.10.) — dort darf er bei gesetztem Datenschlüssel nicht mehr liegen. */
export const alterIndexPfad = (): string => path.join(datenOrdner(), 'brain-index.sqlite');

/** Wo der Index liegt (tmpfs, Arbeitsspeicher oder — nur ohne Datenschlüssel — Platte). */
export function indexOrt(): IndexOrt {
  return indexOrtWaehlen({ env: process.env, schluessel: !!schluesselRing().aktiv, ramDateisystem, datenOrdner: datenOrdner() });
}
/** Der Pfad für SQLite (`:memory:` im Arbeitsspeicher). */
export function indexPfad(): string { return indexOrt().pfad; }

/** Die Datenbank (einmal je Prozess). */
export function oeffneIndex(): DatabaseSync {
  const pfad = indexPfad();
  if (db && dbPfad === pfad) return db;
  if (db) schliesseIndex(); // Ort gewechselt (Schlüssel neu gesetzt, Tests): alte Verbindung zu
  if (pfad !== ':memory:') mkdirSync(path.dirname(pfad), { recursive: true, mode: 0o700 });
  db = new DatabaseSync(pfad); dbPfad = pfad;
  if (pfad !== ':memory:') { try { chmodSync(pfad, 0o600); } catch { /* tmpfs ohne chmod: egal, nur der Container-Nutzer */ } }
  db.exec(`
    PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA secure_delete=ON;
    CREATE TABLE IF NOT EXISTS notizen(id TEXT PRIMARY KEY, wurzel TEXT, titel TEXT, bereich TEXT, typ TEXT, scope TEXT, owner TEXT, stand TEXT, tags TEXT, geaendert TEXT, hash TEXT, zeichen INTEGER);
    CREATE TABLE IF NOT EXISTS chunks(id INTEGER PRIMARY KEY AUTOINCREMENT, notiz_id TEXT NOT NULL, position INTEGER, ueberschrift TEXT, kontext TEXT, text TEXT, hash TEXT);
    CREATE INDEX IF NOT EXISTS chunks_notiz ON chunks(notiz_id);
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(kontext, text, content='chunks', content_rowid='id', tokenize='unicode61 remove_diacritics 2');
    CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN INSERT INTO chunks_fts(rowid, kontext, text) VALUES (new.id, new.kontext, new.text); END;
    CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN INSERT INTO chunks_fts(chunks_fts, rowid, kontext, text) VALUES ('delete', old.id, old.kontext, old.text); END;
    CREATE TABLE IF NOT EXISTS links(von TEXT NOT NULL, nach TEXT NOT NULL, PRIMARY KEY(von, nach));
    CREATE TABLE IF NOT EXISTS vektoren(chunk_id INTEGER PRIMARY KEY, modell TEXT NOT NULL, dim INTEGER NOT NULL, v BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
  `);
  return db;
}

/** Für Tests: Verbindung schließen (danach öffnet der nächste Aufruf neu). */
export function schliesseIndex(): void { try { db?.close(); } catch { /* egal */ } db = null; dbPfad = ''; }

/** Die Dateien einer SQLite-Datenbank samt WAL/SHM/Journal. */
const sqliteDateien = (pfad: string) => [pfad, `${pfad}-wal`, `${pfad}-shm`, `${pfad}-journal`];

/**
 * Eine Klartext-Datei bestmöglich unlesbar machen: mit Nullen überschreiben, fsync, löschen. Auf SSD/ext4 ohne Garantie
 * (Copy-on-Write, Journale, Abbilder des Hosters) — aber die Datei liegt danach nicht mehr lesbar im Datenordner, und
 * jede Sicherung ab jetzt enthält sie nicht. Liefert, ob etwas zu tun war.
 */
async function ueberschreibenUndLoeschen(pfad: string): Promise<boolean> {
  const { open, unlink } = await import('node:fs/promises');
  let fh: Awaited<ReturnType<typeof open>>;
  try { fh = await open(pfad, 'r+'); } catch (e) { if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return false; throw e; }
  try {
    const groesse = (await fh.stat()).size;
    const null1mb = Buffer.alloc(Math.min(1_048_576, Math.max(1, groesse)));
    for (let pos = 0; pos < groesse; pos += null1mb.length) await fh.write(null1mb, 0, Math.min(null1mb.length, groesse - pos), pos);
    await fh.sync();
  } finally { await fh.close().catch(() => {}); }
  await unlink(pfad).catch(e => { if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') throw e; });
  return true;
}

/** Liegt (bei gesetztem Schlüssel) noch ein alter Klartext-Index im Datenordner? Für den Head of IT. */
export async function alterIndexDa(): Promise<boolean> {
  const ort = indexOrt();
  if (ort.art === 'platte') return false;
  const { access } = await import('node:fs/promises');
  for (const p of [...sqliteDateien(alterIndexPfad()), ...(ort.verworfen ? sqliteDateien(ort.verworfen) : [])]) {
    try { await access(p); return true; } catch { /* nächste */ }
  }
  return false;
}

/** Alte Klartext-Indexdateien (Datenordner bzw. ein verworfener Plattenpfad) entfernen — nur, wenn der Index nicht dort liegen darf. */
export async function alterIndexEntfernen(): Promise<number> {
  const ort = indexOrt();
  if (ort.art === 'platte') return 0;
  let n = 0;
  for (const p of [...sqliteDateien(alterIndexPfad()), ...(ort.verworfen ? sqliteDateien(ort.verworfen) : [])]) {
    try { if (await ueberschreibenUndLoeschen(p)) n++; }
    catch (e) { console.error(`[brain-index] ${path.basename(p)} nicht entfernt:`, e instanceof Error ? e.message : e); }
  }
  if (n) console.log(`[brain-index] alter Klartext-Index entfernt (${n} Datei${n === 1 ? '' : 'en'} überschrieben und gelöscht) — der Index liegt jetzt ${ort.art === 'tmpfs' ? 'im tmpfs' : 'im Arbeitsspeicher'}.`);
  return n;
}

/** Stand des letzten Neubaus nach dem Start (für den Head of IT) — nur Zahlen. */
export interface NeubauStand { gestartet: string | null; fertig: string | null; dauerMs: number | null; notizen: number; appZeilen: number; fehler: string | null }
const neubau: NeubauStand = { gestartet: null, fertig: null, dauerMs: null, notizen: 0, appZeilen: 0, fehler: null };
export const neubauStand = (): NeubauStand => ({ ...neubau });

/**
 * Nach dem Start (lib/store/betrieb.ts, verzögert): alten Klartext-Index entfernen und — liegt der Index im tmpfs bzw.
 * Arbeitsspeicher, also leer — Vault und Arbeitsbestände neu einlesen. Wirft nie. Bis der Neubau fertig ist, sucht
 * lib/zoe/vault.ts über die Dateien (`indexBereit` ist false) und `suche_arbeit` baut `app_chunks` vor der Suche selbst.
 */
export async function indexNachStart(): Promise<NeubauStand> {
  try { await alterIndexEntfernen(); } catch { /* gemeldet */ }
  if (process.env.MAKE_OS_BRAIN_INDEX === 'aus') return neubauStand();
  const t0 = Date.now();
  neubau.gestartet = new Date(t0).toISOString(); neubau.fehler = null;
  try {
    const l = await aktualisieren(true);
    const a = await (await import('./app-index')).appIndexAktualisieren(true);
    neubau.notizen = l.neu + l.geaendert + l.unveraendert; neubau.appZeilen = a.neu + a.geaendert + a.unveraendert;
    neubau.dauerMs = Date.now() - t0; neubau.fertig = new Date().toISOString();
    console.log(`[brain-index] Neubau nach dem Start: ${neubau.notizen} Notizen, ${neubau.appZeilen} App-Zeilen in ${(neubau.dauerMs / 1000).toFixed(1)} s (${indexOrt().art}).`);
  } catch (e) {
    neubau.fehler = e instanceof Error ? e.message.slice(0, 160) : 'unbekannt';
    console.error('[brain-index] Neubau nach dem Start gescheitert:', neubau.fehler);
  }
  return neubauStand();
}

/** Größe der Datenbank in MB (Seiten × Seitengröße — gilt für Datei, tmpfs und Arbeitsspeicher). */
export function indexGroesseMb(): number {
  try {
    const d = oeffneIndex();
    const n = (d.prepare('PRAGMA page_count').get() as { page_count: number }).page_count;
    const g = (d.prepare('PRAGMA page_size').get() as { page_size: number }).page_size;
    return Math.round((n * g) / 104_857.6) / 10;
  } catch { return 0; }
}

const meta = (d: DatabaseSync, k: string): string | null => (d.prepare('SELECT v FROM meta WHERE k = ?').get(k) as { v: string } | undefined)?.v ?? null;
const setzeMeta = (d: DatabaseSync, k: string, v: string) => d.prepare('INSERT INTO meta(k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, v);

export function indexStand(): IndexStand {
  const d = oeffneIndex();
  const z = (sql: string) => Number((d.prepare(sql).get() as { n: number }).n);
  return { notizen: z('SELECT COUNT(*) n FROM notizen'), chunks: z('SELECT COUNT(*) n FROM chunks'), vektoren: z('SELECT COUNT(*) n FROM vektoren'), letzterLauf: meta(d, 'letzterLauf'), dauerMs: Number(meta(d, 'dauerMs')) || null, datei: indexPfad() };
}

/** Gibt es einen brauchbaren Index (mindestens eine Notiz, Lauf nicht älter als ein Tag)? */
export function indexBereit(): boolean {
  try {
    const s = indexStand();
    return s.notizen > 0 && !!s.letzterLauf && Date.now() - Date.parse(s.letzterLauf) < 24 * 3_600_000;
  } catch { return false; }
}

let laeuft: Promise<IndexLauf> | null = null;

/** Index mit dem Vault abgleichen — nur Geändertes wird neu zerlegt. Gleichzeitige Aufrufe teilen sich einen Lauf. */
export function aktualisieren(frisch = false): Promise<IndexLauf> {
  if (laeuft) return laeuft;
  laeuft = (async () => {
    const start = Date.now();
    const d = oeffneIndex();
    const b = await bestand(frisch);
    const bekannt = new Map((d.prepare('SELECT id, hash FROM notizen').all() as { id: string; hash: string }[]).map(r => [r.id, r.hash]));
    const ergebnis: IndexLauf = { neu: 0, geaendert: 0, entfernt: 0, unveraendert: 0, chunks: 0, dauerMs: 0 };
    const loescheChunks = d.prepare('DELETE FROM chunks WHERE notiz_id = ?');
    const loescheLinks = d.prepare('DELETE FROM links WHERE von = ?');
    const loescheVektoren = d.prepare('DELETE FROM vektoren WHERE chunk_id IN (SELECT id FROM chunks WHERE notiz_id = ?)');
    const setzeNotiz = d.prepare('INSERT INTO notizen(id, wurzel, titel, bereich, typ, scope, owner, stand, tags, geaendert, hash, zeichen) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET wurzel=excluded.wurzel, titel=excluded.titel, bereich=excluded.bereich, typ=excluded.typ, scope=excluded.scope, owner=excluded.owner, stand=excluded.stand, tags=excluded.tags, geaendert=excluded.geaendert, hash=excluded.hash, zeichen=excluded.zeichen');
    const setzeChunk = d.prepare('INSERT INTO chunks(notiz_id, position, ueberschrift, kontext, text, hash) VALUES (?,?,?,?,?,?)');
    const setzeLink = d.prepare('INSERT OR IGNORE INTO links(von, nach) VALUES (?, ?)');
    const gesehen = new Set<string>();
    for (const n of b.notizen) {
      gesehen.add(n.id);
      let text: string;
      try { text = await readFile(n.pfad, 'utf8'); } catch { continue; }
      const h = HASH(text);
      if (bekannt.get(n.id) === h) { ergebnis.unveraendert++; continue; }
      const { kopf, rumpf } = leseKopf(text);
      const teile = abschnitte(n.titel, rumpf, kopf.tags);
      d.exec('BEGIN');
      try {
        loescheVektoren.run(n.id); loescheChunks.run(n.id); loescheLinks.run(n.id);
        setzeNotiz.run(n.id, n.wurzel, n.titel, n.bereich, n.typ ?? null, n.scope ?? null, n.owner ?? null, n.stand ?? null, kopf.tags.join(','), n.geaendert, h, rumpf.length);
        for (const a of teile) setzeChunk.run(n.id, a.position, a.ueberschrift, a.kontext, a.text, HASH(a.text));
        for (const z of verweise(rumpf)) setzeLink.run(n.id, z);
        d.exec('COMMIT');
      } catch (err) { d.exec('ROLLBACK'); throw err; }
      ergebnis.chunks += teile.length;
      if (bekannt.has(n.id)) ergebnis.geaendert++; else ergebnis.neu++;
    }
    // Was im Vault nicht mehr da ist, fliegt aus dem Index.
    for (const id of bekannt.keys()) {
      if (gesehen.has(id)) continue;
      d.exec('BEGIN');
      try { loescheVektoren.run(id); loescheChunks.run(id); loescheLinks.run(id); d.prepare('DELETE FROM notizen WHERE id = ?').run(id); d.exec('COMMIT'); } catch (err) { d.exec('ROLLBACK'); throw err; }
      ergebnis.entfernt++;
    }
    ergebnis.dauerMs = Date.now() - start;
    setzeMeta(d, 'letzterLauf', new Date().toISOString()); setzeMeta(d, 'dauerMs', String(ergebnis.dauerMs));
    return ergebnis;
  })().finally(() => { laeuft = null; });
  return laeuft;
}

let zuletztFrisch = 0;
/** Alle paar Minuten leise abgleichen (der Takt ruft das) — nie blockierend, nie doppelt. */
export function indexFrischHalten(minuten = 10): void {
  if (Date.now() - zuletztFrisch < minuten * 60_000) return;
  zuletztFrisch = Date.now();
  void aktualisieren(true)
    .then(async () => { const e = await import('./einbettung'); if (e.embeddingsAktiv()) await e.vektorenAuffuellen(64); })
    .catch(err => console.error('[brain-index] Abgleich fehlgeschlagen:', err instanceof Error ? err.message : err));
  // Arbeitsbestände der App (29.09., lib/brain/app-index.ts): im selben Takt, nur wenn sich Aufgaben/CRM geändert haben.
  void import('./app-index').then(a => a.appIndexAktualisieren())
    .catch(err => console.error('[brain-index] App-Bestände nicht abgeglichen:', err instanceof Error ? err.message : err));
  // _App-Spiegel im Server-Vault (lib/brain/app-spiegel.ts): nur eingeschaltet und nur bei Änderung.
  if (process.env.MAKE_OS_APP_SPIEGEL?.trim() === 'an') void import('./app-spiegel').then(a => a.appSpiegel()).catch(() => {});
}

interface Zeile { id: number; notiz_id: string; ueberschrift: string; kontext: string; text: string; r: number; titel: string; bereich: string; scope: string | null; owner: string | null; stand: string | null; wurzel: string; geaendert: string; typ: string | null }

/**
 * Volltextsuche über Abschnitte (BM25, Kontextzeile 3× gewichtet). Gruppiert je
 * Notiz: bester Abschnitt zählt, ein zweiter gibt einen kleinen Bonus; das Brain
 * (+) und Frisches (+) wie bisher; Notizen, auf die ein Treffer per Wikilink zeigt,
 * bekommen einen Nachbarschafts-Bonus (1 Hop).
 */
export function indexSuche(frage: string, anzahl = 6, sicht: VaultSicht, bereich?: string): { treffer: IndexTreffer[]; durchsucht: number } {
  const d = oeffneIndex();
  const durchsucht = Number((d.prepare('SELECT COUNT(*) n FROM notizen').get() as { n: number }).n);
  const anfrage = ftsAnfrage(frage);
  if (!anfrage) return { treffer: [], durchsucht };
  let zeilen: Zeile[] = [];
  try {
    zeilen = d.prepare(`SELECT c.id, c.notiz_id, c.ueberschrift, c.kontext, c.text, bm25(chunks_fts, 3.0, 1.0) AS r,
        n.titel, n.bereich, n.scope, n.owner, n.stand, n.wurzel, n.geaendert, n.typ
      FROM chunks_fts f JOIN chunks c ON c.id = f.rowid JOIN notizen n ON n.id = c.notiz_id
      WHERE chunks_fts MATCH ? ORDER BY r LIMIT 120`).all(anfrage) as unknown as Zeile[];
  } catch { return { treffer: [], durchsucht }; }
  const sichtbar = zeilen.filter(z => darfSehen({ scope: z.scope ?? undefined, owner: z.owner ?? undefined }, sicht) && (!bereich || z.bereich === bereich));
  // BM25 ist negativ (kleiner = besser) → in positive Punkte drehen.
  const jeNotiz = new Map<string, { beste: Zeile; punkte: number; weitere: number }>();
  for (const z of sichtbar) {
    const p = -z.r;
    const e = jeNotiz.get(z.notiz_id);
    if (!e) jeNotiz.set(z.notiz_id, { beste: z, punkte: p, weitere: 0 });
    else if (e.weitere < 2) { e.punkte += p * 0.3; e.weitere++; }
  }
  // Nachbarschaft: Titel, auf die Treffer zeigen.
  const ids = Array.from(jeNotiz.keys());
  const nachbarn = new Set<string>();
  if (ids.length) {
    const platz = ids.slice(0, 20).map(() => '?').join(',');
    for (const l of d.prepare(`SELECT nach FROM links WHERE von IN (${platz})`).all(...ids.slice(0, 20)) as { nach: string }[]) nachbarn.add(l.nach.toLowerCase());
  }
  const jetzt = Date.now();
  // Wörter der Frage — Titel- und Überschriften-Treffer wiegen wie in der alten Suche schwer (BM25 allein ist bei kleinen Korpora blind für den Titel).
  const woerter = frage.toLowerCase().split(/[^a-z0-9äöüß]+/i).filter(w => w.length >= 3).slice(0, 8);
  const liste = Array.from(jeNotiz.entries()).map(([id, e]) => {
    let punkte = e.punkte;
    const titel = e.beste.titel.toLowerCase(); const kopf = e.beste.ueberschrift.toLowerCase();
    for (const w of woerter) { if (titel.includes(w)) punkte += 2; else if (kopf.includes(w)) punkte += 0.8; }
    if (e.beste.wurzel === 'make') punkte += 1.5;
    const tage = (jetzt - Date.parse(e.beste.geaendert)) / 864e5;
    if (tage < 2) punkte += 1; else if (tage < 14) punkte += 0.5; else if (tage > 120) punkte -= 0.3;
    if (nachbarn.has(e.beste.titel.toLowerCase())) punkte += 0.8;
    const ausschnitt = e.beste.text.replace(/\s+/g, ' ').trim().slice(0, 700);
    return { id, titel: e.beste.titel, wurzel: e.beste.wurzel, bereich: e.beste.bereich, scope: e.beste.scope ?? undefined, stand: e.beste.stand ?? undefined, punkte: Math.round(punkte * 100) / 100,
      ausschnitt: ausschnitt + (e.beste.text.length > 700 ? ' …' : ''), ueberschriften: [] as string[], geaendert: e.beste.geaendert, abschnitt: e.beste.ueberschrift, chunkId: e.beste.id, notizId: id } as IndexTreffer;
  });
  liste.sort((a, b) => b.punkte - a.punkte);
  return { treffer: liste.slice(0, anzahl), durchsucht };
}

/**
 * Hybrid (27.09.): Volltext (BM25) und Embeddings (Kosinus) liefern je eine Rangliste von
 * Abschnitten; Reciprocal Rank Fusion (k = 60) verbindet sie. Ohne Modell/Vektoren bleibt es
 * bei der Volltextsuche — dieselbe Form, derselbe Aufrufer (lib/zoe/vault.ts suche).
 */
export async function hybridSuche(frage: string, anzahl = 6, sichtRoh: Sicht | VaultSicht, bereich?: string): Promise<{ treffer: IndexTreffer[]; durchsucht: number; hybrid: boolean }> {
  const sicht = await sichtAufloesen(sichtRoh); // aus den Konten, vor dem Ranking (09.10.)
  const volltext = indexSuche(frage, Math.max(anzahl * 3, 20), sicht, bereich);
  let semantisch: { chunkId: number; notizId: string; aehnlichkeit: number }[] | null = null;
  try {
    const e = await import('./einbettung');
    if (e.embeddingsAktiv() && indexStand().vektoren > 0) semantisch = await e.aehnlicheChunks(frage, 30);
  } catch { semantisch = null; }
  if (!semantisch || !semantisch.length) return { ...volltext, treffer: volltext.treffer.slice(0, anzahl), hybrid: false };

  const d = oeffneIndex();
  const { rrf } = await import('./einbettung');
  // Semantische Kandidaten auf die Sicht filtern (Notizdaten nachladen).
  const notizIds = Array.from(new Set(semantisch.map(s => s.notizId)));
  const platz = notizIds.map(() => '?').join(',');
  const notizen = new Map((d.prepare(`SELECT id, titel, bereich, scope, owner, stand, wurzel, geaendert FROM notizen WHERE id IN (${platz})`).all(...notizIds) as { id: string; titel: string; bereich: string; scope: string | null; owner: string | null; stand: string | null; wurzel: string; geaendert: string }[]).map(n => [n.id, n]));
  const semantischSichtbar = semantisch.filter(s => { const n = notizen.get(s.notizId); return n && darfSehen({ scope: n.scope ?? undefined, owner: n.owner ?? undefined }, sicht) && (!bereich || n.bereich === bereich); });
  const fusion = rrf([volltext.treffer.map(t => t.chunkId), semantischSichtbar.map(s => s.chunkId)]);
  const jeChunkVolltext = new Map(volltext.treffer.map(t => [t.chunkId, t]));
  const raus: IndexTreffer[] = [];
  const gesehen = new Set<string>();
  for (const f of fusion) {
    const vt = jeChunkVolltext.get(f.id);
    const notizId = vt?.notizId ?? semantischSichtbar.find(s => s.chunkId === f.id)?.notizId;
    if (!notizId || gesehen.has(notizId)) continue;
    gesehen.add(notizId);
    if (vt) { raus.push({ ...vt, punkte: Math.round(f.punkte * 10000) / 100 }); continue; }
    const n = notizen.get(notizId)!;
    const c = d.prepare('SELECT ueberschrift, text FROM chunks WHERE id = ?').get(f.id) as { ueberschrift: string; text: string } | undefined;
    const text = c?.text ?? '';
    raus.push({ id: notizId, notizId, chunkId: f.id, titel: n.titel, wurzel: n.wurzel, bereich: n.bereich, scope: n.scope ?? undefined, stand: n.stand ?? undefined, punkte: Math.round(f.punkte * 10000) / 100,
      ausschnitt: text.replace(/\s+/g, ' ').trim().slice(0, 700) + (text.length > 700 ? ' …' : ''), ueberschriften: [], geaendert: n.geaendert, abschnitt: c?.ueberschrift ?? '' });
    if (raus.length >= anzahl) break;
  }
  return { treffer: raus.slice(0, anzahl), durchsucht: volltext.durchsucht, hybrid: true };
}

/** Abschnitte einer Notiz (für Zitate „[[Titel#Abschnitt]]“ und die Einbettung). */
export function abschnitteVon(notizId: string): { id: number; position: number; ueberschrift: string; kontext: string; text: string }[] {
  return oeffneIndex().prepare('SELECT id, position, ueberschrift, kontext, text FROM chunks WHERE notiz_id = ? ORDER BY position').all(notizId) as { id: number; position: number; ueberschrift: string; kontext: string; text: string }[];
}
