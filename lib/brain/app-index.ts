// ─── Such-Index für Arbeitsbestände: `app_chunks` neben dem Brain-Index (29.09., B3) ─────────────
// Kevin: „Alle Infos müssen immer sauber gespeichert werden — online in unserem Brain.“ Der Brain-Index (lib/brain/
// index.ts) kannte nur den Vault. Hier kommen die Arbeitsbestände der App dazu — in DIESELBE SQLite-Datei, eigene
// Tabelle `app_chunks` + FTS5 (`app_chunks_fts`):
//   · Aufgaben: Titel + Beschreibung + Notiz · Kommentare (je Kommentar eine Zeile)
//   · Projekte: Titel + Beschreibung + Notiz
//   · Angebote: Titel + Einleitung · Mandate: Kunde + Titel
// Abgeleitet und jederzeit neu baubar (`appIndexNeuBauen`), inkrementell je Zeile über einen Hash
// (`appIndexAktualisieren` — vor jeder Suche, wenn sich die Bestände geändert haben, und im Takt mit dem Brain-Index).
// Sicht: jede Zeile trägt den Haushalt (Aufgaben und CRM gehören dem Haushalt des Inhabers) und ob sie im Privat-Space
// liegt — die Suche filtert IN der Abfrage (vor dem Ranking), Privates nur für Personen dieses Haushalts.
// Ausgeschlossen: Papierkorb (`geloeschtAm`, tolerant — das Feld kommt mit einem parallelen Paket), Aufgaben „nur ich“
// (tolerant, `nurIch` in lib/brain/app-material.ts) und alles, was an einem eingeschränkten Kontakt hängt (Art. 18).
// Keine Dateiinhalte, keine Kontakt-Notizen, keine IBAN. Der Vault selbst steht in `chunks` (lib/brain/index.ts) —
// `suche_arbeit` (lib/zoe/arbeit-werkzeug.ts) fragt beide Tabellen: eine Suche über Brain und App.
// Embeddings: bewusst nicht (optional) — die Volltextsuche reicht für Titel und Notizen.

import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { loadJson, speicherStand } from '@/lib/store/local-db';
import { oeffneIndex } from './index';
import { ftsAnfrage } from './chunks';
import { WEG } from '@/lib/wege';
import { bereichVonSpace } from '@/lib/aufgaben/struktur';
import { nurIch, imPapierkorb } from './app-material';
import type { TasksState, Task, Project } from '@/types/tasks';
import type { CrmBestand } from '@/lib/crm/typen';

export type AppArt = 'aufgabe' | 'kommentar' | 'projekt' | 'angebot' | 'mandat';
export interface AppZeile { schluessel: string; art: AppArt; refId: string; haushalt: string; privat: boolean; titel: string; text: string; link: string; geaendert: string }
export interface AppTreffer { art: AppArt; refId: string; titel: string; ausschnitt: string; link: string; privat: boolean; punkte: number; geaendert: string }
export interface AppLauf { neu: number; geaendert: number; entfernt: number; unveraendert: number; uebersprungen: boolean; dauerMs: number }

/** Bestände, deren Änderung den Index veraltet macht. */
export const APP_QUELLEN = ['tasks', 'crm', 'kontakte'] as const;
const TEXT_MAX = 20_000;
const HASH = (t: string) => createHash('sha1').update(t).digest('hex');
const sauber = (t: unknown, n = TEXT_MAX): string => (typeof t === 'string' ? t.replace(/\u0000/g, '').trim().slice(0, n) : '');
const verbinde = (...t: unknown[]) => t.map(x => sauber(x)).filter(Boolean).join('\n\n').slice(0, TEXT_MAX);

/** Die Zeilen aus den Beständen (rein, getestet). `eingeschraenkt` = Kennungen eingeschränkter Kontakte (Art. 18). */
export function appZeilen(state: Pick<TasksState, 'tasks' | 'projects'>, crm: Pick<CrmBestand, 'angebote' | 'mandate'> | null, opt: { haushalt: string; eingeschraenkt: ReadonlySet<string> }): AppZeile[] {
  const raus: AppZeile[] = [];
  const h = opt.haushalt;
  const gesperrt = (id?: string | null) => !!id && opt.eingeschraenkt.has(id);
  const projekte = new Map(state.projects.map(p => [p.id, p]));
  for (const t of state.tasks as Task[]) {
    // „nur ich“ (Aufgaben-Paket): gar nicht im Index — so taucht sie in keiner Suche einer anderen Person auf.
    if (imPapierkorb(t) || nurIch(t) || gesperrt(t.bezug?.kontaktId)) continue;
    const p = projekte.get(t.projectId);
    if (p && imPapierkorb(p)) continue;
    const privat = bereichVonSpace(t.spaceId ?? (t.space === 'privat' ? 'privat' : undefined)) === 'privat';
    const link = WEG.aufgabe(t.id);
    raus.push({ schluessel: `aufgabe:${t.id}`, art: 'aufgabe', refId: t.id, haushalt: h, privat, titel: sauber(t.title, 300), text: verbinde(t.description, t.notiz), link, geaendert: t.updatedAt ?? t.createdAt ?? '' });
    for (const k of t.kommentare ?? []) {
      if (!k?.id || !sauber(k.text)) continue;
      raus.push({ schluessel: `kommentar:${t.id}:${k.id}`, art: 'kommentar', refId: t.id, haushalt: h, privat, titel: `Kommentar an „${sauber(t.title, 120)}“`, text: sauber(k.text), link, geaendert: k.am ?? '' });
    }
  }
  for (const p of state.projects as Project[]) {
    if (imPapierkorb(p)) continue;
    const privat = bereichVonSpace(p.spaceId) === 'privat';
    raus.push({ schluessel: `projekt:${p.id}`, art: 'projekt', refId: p.id, haushalt: h, privat, titel: sauber(p.title, 300), text: verbinde(p.description, p.beschreibung, p.notiz),
      link: p.spaceId ? WEG.aufgaben({ s: p.spaceId, p: p.id }) : WEG.aufgaben(), geaendert: p.updatedAt ?? p.createdAt ?? '' });
  }
  for (const a of crm?.angebote ?? []) {
    if (gesperrt(a.kontaktId)) continue;
    raus.push({ schluessel: `angebot:${a.id}`, art: 'angebot', refId: a.id, haushalt: h, privat: false, titel: sauber(`${a.nummer ? `${a.nummer} · ` : ''}${a.titel}`, 300), text: sauber(a.einleitung),
      link: WEG.angebot({ angebotId: a.id }), geaendert: a.geaendert ?? '' });
  }
  for (const m of crm?.mandate ?? []) {
    if ((m.kontaktIds ?? []).some(gesperrt)) continue;
    raus.push({ schluessel: `mandat:${m.id}`, art: 'mandat', refId: m.id, haushalt: h, privat: false, titel: sauber(`${m.kunde} · ${m.titel}`, 300), text: '', link: WEG.mandat(m.id), geaendert: m.geaendert ?? '' });
  }
  return raus;
}

const zeilenHash = (z: AppZeile) => HASH(JSON.stringify([z.art, z.refId, z.haushalt, z.privat, z.titel, z.text, z.link, z.geaendert]));

let bereit: DatabaseSync | null = null;
/** Die Tabellen (einmal je Verbindung) — in derselben Datei wie der Brain-Index. */
export function appTabellen(): DatabaseSync {
  const d = oeffneIndex();
  if (bereit === d) return d;
  d.exec(`
    CREATE TABLE IF NOT EXISTS app_chunks(id INTEGER PRIMARY KEY AUTOINCREMENT, schluessel TEXT NOT NULL UNIQUE, art TEXT NOT NULL, ref_id TEXT NOT NULL, haushalt TEXT NOT NULL, privat INTEGER NOT NULL DEFAULT 0, titel TEXT, text TEXT, link TEXT, geaendert TEXT, hash TEXT);
    CREATE INDEX IF NOT EXISTS app_chunks_sicht ON app_chunks(haushalt, privat);
    CREATE VIRTUAL TABLE IF NOT EXISTS app_chunks_fts USING fts5(titel, text, content='app_chunks', content_rowid='id', tokenize='unicode61 remove_diacritics 2');
    CREATE TRIGGER IF NOT EXISTS app_chunks_ai AFTER INSERT ON app_chunks BEGIN INSERT INTO app_chunks_fts(rowid, titel, text) VALUES (new.id, new.titel, new.text); END;
    CREATE TRIGGER IF NOT EXISTS app_chunks_ad AFTER DELETE ON app_chunks BEGIN INSERT INTO app_chunks_fts(app_chunks_fts, rowid, titel, text) VALUES ('delete', old.id, old.titel, old.text); END;
  `);
  bereit = d;
  return d;
}

/** Die Bestände lesen → Zeilen. Ohne Haushalt des Inhabers: nichts (niemand dürfte sie sehen). */
async function zeilenLaden(): Promise<AppZeile[]> {
  const { haushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
  const haushalt = await haushaltDesInhabers();
  if (!haushalt) return [];
  const { ladeAufgaben } = await import('@/lib/aufgaben/speicher');
  const { sichtFuer } = await import('@/lib/aufgaben/sicht');
  const { ladeCrm } = await import('@/lib/crm/speicher');
  // Geteilter Such-Index: Systemsicht — keine „nur ich“-Aufgabe (29.09., lib/aufgaben/sicht.ts).
  const [state, crm, kartei] = await Promise.all([ladeAufgaben().then(s => sichtFuer(s, null)), ladeCrm(), loadJson<{ kontakte?: { id: string; eingeschraenkt?: unknown }[] }>('kontakte')]);
  // Nur die Kennungen eingeschränkter Kontakte — nichts von ihnen geht in den Index.
  const eingeschraenkt = new Set((kartei?.kontakte ?? []).filter(k => k.eingeschraenkt).map(k => k.id));
  return appZeilen(state, crm, { haushalt, eingeschraenkt });
}

const meta = (d: DatabaseSync, k: string): string | null => (d.prepare('SELECT v FROM meta WHERE k = ?').get(k) as { v: string } | undefined)?.v ?? null;
const setzeMeta = (d: DatabaseSync, k: string, v: string) => d.prepare('INSERT INTO meta(k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, v);

let laeuft: Promise<AppLauf> | null = null;

/**
 * Inkrementell abgleichen: nur, wenn sich einer der Bestände geändert hat (`speicherStand`, oder `erzwingen`);
 * je Zeile ein Hash — nur Geändertes wird neu geschrieben, Verschwundenes fliegt raus. Gleichzeitige Aufrufe teilen sich einen Lauf.
 */
export function appIndexAktualisieren(erzwingen = false): Promise<AppLauf> {
  if (laeuft) return laeuft;
  laeuft = (async () => {
    const start = Date.now();
    const d = appTabellen();
    const stand = await speicherStand([...APP_QUELLEN]);
    if (!erzwingen && meta(d, 'app_stand') === stand) return { neu: 0, geaendert: 0, entfernt: 0, unveraendert: 0, uebersprungen: true, dauerMs: Date.now() - start };
    const zeilen = await zeilenLaden();
    const bekannt = new Map((d.prepare('SELECT schluessel, hash FROM app_chunks').all() as { schluessel: string; hash: string }[]).map(r => [r.schluessel, r.hash]));
    const lauf: AppLauf = { neu: 0, geaendert: 0, entfernt: 0, unveraendert: 0, uebersprungen: false, dauerMs: 0 };
    const weg = d.prepare('DELETE FROM app_chunks WHERE schluessel = ?');
    const rein = d.prepare('INSERT INTO app_chunks(schluessel, art, ref_id, haushalt, privat, titel, text, link, geaendert, hash) VALUES (?,?,?,?,?,?,?,?,?,?)');
    const gesehen = new Set<string>();
    d.exec('BEGIN');
    try {
      for (const z of zeilen) {
        if (gesehen.has(z.schluessel)) continue;
        gesehen.add(z.schluessel);
        const h = zeilenHash(z);
        const alt = bekannt.get(z.schluessel);
        if (alt === h) { lauf.unveraendert++; continue; }
        if (alt !== undefined) { weg.run(z.schluessel); lauf.geaendert++; } else lauf.neu++;
        rein.run(z.schluessel, z.art, z.refId, z.haushalt, z.privat ? 1 : 0, z.titel, z.text, z.link, z.geaendert, h);
      }
      for (const s of bekannt.keys()) if (!gesehen.has(s)) { weg.run(s); lauf.entfernt++; }
      setzeMeta(d, 'app_stand', stand);
      setzeMeta(d, 'app_letzterLauf', new Date().toISOString());
      d.exec('COMMIT');
    } catch (err) { d.exec('ROLLBACK'); throw err; }
    lauf.dauerMs = Date.now() - start;
    return lauf;
  })().finally(() => { laeuft = null; });
  return laeuft;
}

/** Neubau: Tabelle leeren und alles neu einlesen (bei Zweifel — der Index ist abgeleitet). */
export async function appIndexNeuBauen(): Promise<AppLauf> {
  if (laeuft) await laeuft.catch(() => null);
  const d = appTabellen();
  d.exec('BEGIN');
  try { d.exec("DELETE FROM app_chunks; INSERT INTO app_chunks_fts(app_chunks_fts) VALUES('rebuild'); DELETE FROM meta WHERE k = 'app_stand';"); d.exec('COMMIT'); }
  catch (err) { d.exec('ROLLBACK'); throw err; }
  return appIndexAktualisieren(true);
}

export function appIndexStand(): { zeilen: number; letzterLauf: string | null } {
  const d = appTabellen();
  return { zeilen: Number((d.prepare('SELECT COUNT(*) n FROM app_chunks').get() as { n: number }).n), letzterLauf: meta(d, 'app_letzterLauf') };
}

/** Wer was sehen darf: der Haushalt der Person; Privates nur, wenn sie zu diesem Haushalt gehört. */
export interface AppSicht { haushalt: string; privat: boolean }

/**
 * Volltextsuche (BM25, Titel 3× gewichtet). Die Sicht steht IN der Abfrage — Zeilen anderer Haushalte und (ohne
 * Recht) private Zeilen kommen gar nicht erst ins Ranking. `arten` schränkt optional ein.
 */
export function appSuche(frage: string, sicht: AppSicht, anzahl = 8, arten?: readonly AppArt[]): { treffer: AppTreffer[]; durchsucht: number } {
  const d = appTabellen();
  const durchsucht = Number((d.prepare('SELECT COUNT(*) n FROM app_chunks WHERE haushalt = ? AND (privat = 0 OR ? = 1)').get(sicht.haushalt, sicht.privat ? 1 : 0) as { n: number }).n);
  const anfrage = ftsAnfrage(frage);
  if (!anfrage) return { treffer: [], durchsucht };
  const artFilter = arten?.length ? ` AND c.art IN (${arten.map(() => '?').join(',')})` : '';
  let zeilen: { art: AppArt; ref_id: string; titel: string; text: string; link: string; privat: number; geaendert: string; r: number }[] = [];
  try {
    zeilen = d.prepare(`SELECT c.art, c.ref_id, c.titel, c.text, c.link, c.privat, c.geaendert, bm25(app_chunks_fts, 3.0, 1.0) AS r
      FROM app_chunks_fts f JOIN app_chunks c ON c.id = f.rowid
      WHERE app_chunks_fts MATCH ? AND c.haushalt = ? AND (c.privat = 0 OR ? = 1)${artFilter}
      ORDER BY r LIMIT ?`).all(anfrage, sicht.haushalt, sicht.privat ? 1 : 0, ...(arten ?? []), Math.max(1, Math.min(50, anzahl))) as never;
  } catch { return { treffer: [], durchsucht }; }
  return {
    durchsucht,
    treffer: zeilen.map(z => ({ art: z.art, refId: z.ref_id, titel: z.titel, ausschnitt: (z.text || '').replace(/\s+/g, ' ').trim().slice(0, 400), link: z.link, privat: z.privat === 1, punkte: Math.round(-z.r * 100) / 100, geaendert: z.geaendert })),
  };
}
