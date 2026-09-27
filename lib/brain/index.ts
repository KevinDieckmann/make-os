// ─── Brain-Index: SQLite FTS5 neben dem Vault (Server, 27.09.) ──────────────
// Kevins Entscheidung 27.09.: Volltext-Index lokal (dazu Embeddings, lib/brain/
// einbettung.ts). Der Vault bleibt die Wahrheit — der Index ist abgeleitet und
// jederzeit neu baubar (Datei löschen genügt). Er liegt unter <daten>/brain-index.
// sqlite: Klartext wie der Vault selbst (Git-Repo), außerhalb der verschlüsselten
// JSON-Bestände und außerhalb des Vault-Repos (sonst würde vault-abgleich.sh ihn
// einchecken). Inkrementell: je Notiz ein Hash — nur Geändertes wird neu zerlegt.
// Sicht (scope/owner) wird VOR dem Ranking angewandt (lib/zoe/vault.ts darfSehen).

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { datenOrdner } from '@/lib/store/local-db';
import { bestand, leseKopf, darfSehen, type Sicht, type Treffer } from '@/lib/zoe/vault';
import { abschnitte, verweise, ftsAnfrage } from './chunks';

export interface IndexStand { notizen: number; chunks: number; vektoren: number; letzterLauf: string | null; dauerMs: number | null; datei: string }
export interface IndexLauf { neu: number; geaendert: number; entfernt: number; unveraendert: number; chunks: number; dauerMs: number }
export interface IndexTreffer extends Treffer { abschnitt: string; chunkId: number; notizId: string }

let db: DatabaseSync | null = null;
let dbPfad = '';
const HASH = (t: string) => createHash('sha1').update(t).digest('hex');

export function indexPfad(): string { return process.env.MAKE_OS_BRAIN_INDEX?.trim() || path.join(datenOrdner(), 'brain-index.sqlite'); }

/** Die Datenbank (einmal je Prozess). */
export function oeffneIndex(): DatabaseSync {
  const pfad = indexPfad();
  if (db && dbPfad === pfad) return db;
  mkdirSync(path.dirname(pfad), { recursive: true });
  db = new DatabaseSync(pfad); dbPfad = pfad;
  db.exec(`
    PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
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
}

interface Zeile { id: number; notiz_id: string; ueberschrift: string; kontext: string; text: string; r: number; titel: string; bereich: string; scope: string | null; owner: string | null; stand: string | null; wurzel: string; geaendert: string; typ: string | null }

/**
 * Volltextsuche über Abschnitte (BM25, Kontextzeile 3× gewichtet). Gruppiert je
 * Notiz: bester Abschnitt zählt, ein zweiter gibt einen kleinen Bonus; das Brain
 * (+) und Frisches (+) wie bisher; Notizen, auf die ein Treffer per Wikilink zeigt,
 * bekommen einen Nachbarschafts-Bonus (1 Hop).
 */
export function indexSuche(frage: string, anzahl = 6, sicht: Sicht, bereich?: string): { treffer: IndexTreffer[]; durchsucht: number } {
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
export async function hybridSuche(frage: string, anzahl = 6, sicht: Sicht, bereich?: string): Promise<{ treffer: IndexTreffer[]; durchsucht: number; hybrid: boolean }> {
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
