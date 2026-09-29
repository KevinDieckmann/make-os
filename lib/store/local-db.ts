// ─── MAKE OS — Lokale Persistenz (Datei-Store) ──────────────────────────────
// Bewusst simpel & abhängigkeitsfrei: JSON-Dateien unter ./.data (Server: /srv/make-os/daten).
// Die einzige Stelle, die „wo liegen die Daten“ kennt — API-Routes und UI merken nichts davon.
//
// Stand 29.09. (Paket D-A, Datenschicht-Kern und Betrieb) — was diese Datei garantiert:
//   · Schreiben ist atomar UND dauerhaft (lib/store/atomar.mjs: tmp → fsync → rename → Ordner-fsync),
//     auch die Tagessicherung (vorher copyFile ohne fsync).
//   · Je Bestand eine Schreibsperre (Warteschlange) auf globalThis — Hot-Reload und mehrfach geladene
//     Module teilen sie. Wiedereintritt (derselbe Bestand in seiner eigenen Sperre) und falsche
//     Rangfolge (kontakte vor crm) werfen sofort, statt still zu verklemmen; wer länger als 30 s auf
//     eine Sperre wartet, bekommt `SperreZeitlimit` mit Messwert.
//   · Verschlüsselung: v2-Hülle mit Schlüssel-ID + AAD (lib/store/huelle.mjs), v1 bleibt lesbar,
//     Schlüsselring für die Rotation im laufenden Betrieb. Klartext bei gesetztem Schlüssel wird
//     abgelehnt (`KlartextBestand`), außer mit MAKE_OS_KLARTEXT_MIGRATION=1 (#55).
//   · Lesefehler werfen (`BestandNichtLesbar`), kaputtes JSON wird beiseitegelegt und blockiert
//     Schreibungen (`BestandBeschaedigt`) — auch in saveJson; scheitert das Beiseitelegen, wird
//     geworfen statt überschrieben (#7/#86).
//   · Schemaversion `_v` je Objekt-Bestand beim Schreiben, Migrationen aus lib/store/schema.ts beim Lesen.
//   · JSON ohne Einrückung auf der Platte (Lesen bleibt tolerant), Lesecache mit LRU und Gesamtdeckel.
//   · Messwerte (Sperrwartezeit, Schreibdauer, Parse-Zeit) für den Head of IT (lib/store/messwerte.ts).
//   · Betrieb: Schreibpause für die Sicherung (≤ 30 s) und Abschaltung (SIGTERM) — lib/store/betrieb.ts.

import { standErhoehen } from './memo';
import { promises as fs } from 'fs';
import path from 'path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createDecipheriv } from 'crypto';
import { atomarSchreiben, atomarKopieren, ordnerSync as ordnerSyncKern, tmpName } from './atomar.mjs';
import {
  HUELLE as HUELLE_KERN, SchluesselFehlt as SchluesselFehltKern, EntschluesselungFehlgeschlagen,
  schluesselRing, huellenVersion, huelleSchreiben, huelleOeffnen, huelleV1Schreiben, aadAlternativen,
} from './huelle.mjs';
import { messe, zaehle, parseMessen } from './messwerte';
import { migriere, mitVersion } from './schema';
import { localDay } from '@/lib/zeit';

// Tests dürfen den Ordner umbiegen — nie die echten Bestände anfassen (26.09.).
const DATA_DIR = process.env.MAKE_OS_DATEN_DIR || path.join(process.cwd(), '.data');
/** Der Datenordner (Pfad) — für den Head of IT (Größen der Bestände, Lagebericht des Hosts unter system/). */
export const datenOrdner = () => DATA_DIR;

// ── Verschlüsselung im Ruhezustand ────────────────────────────────────────────
// Kevin (26.09.): „extrem sicher — unsere privatesten Themen.“ Mit MAKE_OS_DATEN_SCHLUESSEL (bzw.
// …_DATEI) schreibt der Store jede Sammlung als AES-256-GCM-Hülle. Verschlüsselt, aber kein oder
// falscher Schlüssel → Fehler, NIE „leer“ (sonst überschriebe der nächste Schreibvorgang die Daten).
export const HUELLE = HUELLE_KERN;
export const SchluesselFehlt = SchluesselFehltKern;
export type SchluesselFehlt = SchluesselFehltKern;

/** Der aktive Datenschlüssel (AES-256) — null ohne Schlüssel. Dateiablage und Altaufrufer nutzen ihn. */
export function datenSchluessel(): Buffer | null {
  return schluesselRing().aktiv?.key ?? null;
}
/** Altformat (v1, ohne Schlüssel-ID/AAD) — nur noch für Kompatibilität; neue Schreibungen gehen über die v2-Hülle. */
export function verschluesseln(text: string, key: Buffer): string {
  return huelleV1Schreiben(text, key);
}
/** v1-Hülle → Klartext; ist es keine Hülle, kommt der Text unverändert zurück. v2 braucht den Bestandsnamen (`huelleOeffnen`). */
export function entschluesseln(json: string, key: Buffer | null): string {
  const o = JSON.parse(json) as Record<string, unknown> | null;
  const v = huellenVersion(o);
  if (!v) return json;
  if (!key) throw new SchluesselFehlt('Der Bestand ist verschlüsselt, MAKE_OS_DATEN_SCHLUESSEL fehlt.');
  if (v === 2) throw new Error('v2-Hülle: mit huelleOeffnen(o, schluesselRing(), bestand) lesen.');
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(String(o!.iv), 'base64'));
  d.setAuthTag(Buffer.from(String(o!.tag), 'base64'));
  return Buffer.concat([d.update(Buffer.from(String(o!.daten), 'base64')), d.final()]).toString('utf8');
}

/** Klartext auf der Platte, obwohl ein Datenschlüssel gesetzt ist (#55) — abgelehnt, bis MAKE_OS_KLARTEXT_MIGRATION=1. */
export class KlartextBestand extends Error {}
export class BestandNichtLesbar extends Error {}
export class BestandBeschaedigt extends Error {}
/** Wiedereintritt (Bestand in seiner eigenen Sperre) oder falsche Rangfolge — ein Programmierfehler, der sonst still verklemmt. */
export class SperreFalsch extends Error {}
/** Länger als 30 s auf die Schreibsperre gewartet. */
export class SperreZeitlimit extends Error { readonly status = 503; }
/** Die App fährt herunter bzw. die Sicherung hält eine Schreibpause — später erneut versuchen. */
export class SchreibenGesperrt extends Error { readonly status = 503; }

const BACKUP_DIR = path.join(DATA_DIR, 'backup');
const BACKUPS_BEHALTEN = 14;
/** Höchstens so lange auf eine Schreibsperre warten (Tests biegen es mit MAKE_OS_SPERR_LIMIT_MS um). */
const sperrLimitMs = () => Number(process.env.MAKE_OS_SPERR_LIMIT_MS) || 30_000;
/** Nach SIGTERM dürfen laufende Vorgänge noch so lange schreiben (mehrstufige Abläufe fertig), danach 503. */
const ABSCHALT_NACHLAUF_MS = 20_000;
const PAUSE_MAX_MS = 30_000;
/** Lesecache: Gesamtdeckel ~64 MB (Zeichen), je Eintrag höchstens 16 MB, älteste zuerst hinaus (LRU). */
const CACHE_GESAMT = 64 * 1024 * 1024;
const CACHE_EINTRAG_MAX = 16 * 1024 * 1024;

// Rangfolge der Sperren (lib/crm/kartei-schreiben.ts): IMMER crm → kontakte. Wer kontakte hält, darf crm nicht mehr nehmen.
const RANG: Record<string, number> = { crm: 1, kontakte: 2 };

interface CacheEintrag { ino: number; mtimeMs: number; size: number; text: string; version: 0 | 1 | 2; kid: string | null; ring: string }
/** Ein gehaltener Bestand im Ablauf. `aendern` = die Änderung läuft noch (nur dann kann ein verschachtelter Zugriff eine Verklemmung sein). */
interface Rahmen { name: string; frei: boolean; aendern: boolean; oben: Rahmen | null }
interface Pause { bis: number; ende: Promise<void>; loese: () => void; timer: ReturnType<typeof setTimeout> }

/** Zustand der Datenschicht — auf globalThis, damit Hot-Reload (Dev) und mehrfach geladene Module dieselben Sperren sehen (#11). */
interface Zustand {
  schlange: Map<string, Promise<void>>;
  als: AsyncLocalStorage<Rahmen>;
  leseCache: Map<string, CacheEintrag>;
  cacheZeichen: number;
  gesichertHeute: Map<string, string>;
  zaehler: Map<string, number>;
  laufend: number;
  stillWarten: (() => void)[];
  pause: Pause | null;
  abschaltung: { seit: number } | null;
  sicherungFehler: { anzahl: number; letzter?: string; zeit?: string };
  klartext: Set<string>;
}
const glob = globalThis as unknown as { __makeosDatenschicht?: Zustand };
const Z: Zustand = (glob.__makeosDatenschicht ??= {
  schlange: new Map(), als: new AsyncLocalStorage<Rahmen>(), leseCache: new Map(), cacheZeichen: 0,
  gesichertHeute: new Map(), zaehler: new Map(), laufend: 0, stillWarten: [], pause: null, abschaltung: null,
  sicherungFehler: { anzahl: 0 }, klartext: new Set(),
});

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

// Nur einfache Namen — nie Pfade. Verhindert, dass ein manipulierter Aufruf
// über den Namen aus .data ausbricht (../../…).
const NAME_OK = /^[a-z0-9][a-z0-9-]*$/;
function pruefeName(name: string): void {
  if (!NAME_OK.test(name)) throw new Error(`[local-db] unzulässiger Store-Name: ${name}`);
}

/** Liegt neben dem Bestand eine beiseitegelegte, beschädigte Fassung (26.09.)? */
export async function beschaedigt(name: string): Promise<boolean> {
  try { return (await fs.readdir(DATA_DIR)).some(f => f.startsWith(`${name}.json.corrupt-`)); } catch { return false; }
}

/**
 * Die Tagessicherungen genau DIESES Stores, älteste zuerst.
 * 24.09.: vorher reichte „fängt mit name- an“ — damit zählten `vitals--malin-…` zu `vitals`. Jetzt nur `<name>-JJJJ-MM-TT.json`.
 */
export function sicherungenVon(name: string, dateien: string[]): string[] {
  const muster = new RegExp(`^${name}-\\d{4}-\\d{2}-\\d{2}\\.json$`);
  return dateien.filter(f => muster.test(f)).sort();
}

// Tägliche Sicherung: bevor eine Sammlung zum ERSTEN Mal am (Berliner) Tag überschrieben wird, den
// bisherigen Stand nach backup/<name>-<tag>.json kopieren — atomar und dauerhaft (29.09.). Schützt vor dem
// Fall, den .corrupt nicht abdeckt: ein Client-Fehler schreibt VALIDES, aber leeres JSON.
// Der Tag gilt erst nach Erfolg als gesichert; ein Fehler wird laut (console.error + Zähler im HOI, #5/#86).
async function taeglicheSicherung(name: string, dest: string): Promise<void> {
  const tag = localDay();
  if (Z.gesichertHeute.get(name) === tag) return;
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 });
    const ziel = path.join(BACKUP_DIR, `${name}-${tag}.json`);
    let schonDa = true;
    try { await fs.access(ziel); } catch { schonDa = false; }
    if (!schonDa) {
      try { await atomarKopieren(dest, ziel); }
      // Noch keine Datei: nichts zu sichern — der Tag bleibt offen, damit das erste ÜBERschreiben gesichert wird.
      catch (e) { if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return; throw e; }
    }
    const alle = sicherungenVon(name, await fs.readdir(BACKUP_DIR));
    for (const f of alle.slice(0, Math.max(0, alle.length - BACKUPS_BEHALTEN))) {
      await fs.unlink(path.join(BACKUP_DIR, f)).catch(e => { if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') throw e; });
    }
    Z.gesichertHeute.set(name, tag);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code ?? (e instanceof Error ? e.message.slice(0, 80) : 'unbekannt');
    Z.sicherungFehler = { anzahl: Z.sicherungFehler.anzahl + 1, letzter: `${name}: ${code}`, zeit: new Date().toISOString() };
    zaehle('sicherungFehler');
    console.error(`[local-db] Tagessicherung von ${name} gescheitert (${code}) — der Bestand wird trotzdem geschrieben; backup/ prüfen.`);
  }
}

/**
 * Stand mehrerer Sammlungen als kurzer Text: Änderungszeit, Größe, Inode und Änderungszähler je Datei.
 * Daraus bauen große Abfragen ihr ETag (25.09.). Seit 29.09. (#41) mit Inode (jede Schreibung ist ein
 * rename → neuer Inode) und dem Zähler dieses Prozesses — gleiche Größe in derselben Millisekunde
 * ergibt so nie mehr dasselbe ETag.
 */
export async function speicherStand(namen: string[]): Promise<string> {
  const teile = await Promise.all(namen.map(async name => {
    pruefeName(name);
    try {
      const st = await fs.stat(path.join(DATA_DIR, `${name}.json`));
      return `${Math.round(st.mtimeMs).toString(36)}.${st.size.toString(36)}.${(st.ino % 1_679_616).toString(36)}.${(Z.zaehler.get(name) ?? 0).toString(36)}`;
    } catch { return '0'; }
  }));
  return teile.join('-');
}

// ── Lesen ─────────────────────────────────────────────────────────────────────
// Lesefehler sind FEHLER, nie „leer“; nur „Datei fehlt“ (ENOENT) ist der saubere Erststart.
// Lesecache je Bestand: der entschlüsselte Text bleibt im Speicher, solange Inode, Änderungszeit,
// Größe und Schlüsselring gleich sind. Eigene Schreibungen füllen ihn direkt; fremde fallen über stat auf.
const ringKennung = () => schluesselRing().alle.map(s => s.kid).join(',') || 'klar';

export function leseCacheLeeren(): void { Z.leseCache.clear(); Z.cacheZeichen = 0; }

function cacheWeg(name: string): void {
  const c = Z.leseCache.get(name);
  if (c) { Z.cacheZeichen -= c.text.length; Z.leseCache.delete(name); }
}

function cacheHole(name: string): CacheEintrag | undefined {
  const c = Z.leseCache.get(name);
  if (c) { Z.leseCache.delete(name); Z.leseCache.set(name, c); } // zuletzt benutzt → hinten
  return c;
}

interface Gelesen {
  text: string; /** 0 = Klartext, 1/2 = Hüllen-Fassung */ version: 0 | 1 | 2; kid: string | null;
  /** v2-Hülle, die noch unter dem gleichwertigen Altnamen (jarvis-…) verschlüsselt ist — wird neu geschrieben. */
  aadAlt?: boolean;
}

function merkeGelesen(name: string, st: { ino: number; mtimeMs: number; size: number }, g: Gelesen): void {
  cacheWeg(name);
  if (g.text.length > CACHE_EINTRAG_MAX) return;
  Z.leseCache.set(name, { ino: st.ino, mtimeMs: st.mtimeMs, size: st.size, text: g.text, version: g.version, kid: g.kid, ring: ringKennung() });
  Z.cacheZeichen += g.text.length;
  for (const alt of Z.leseCache.keys()) {
    if (Z.cacheZeichen <= CACHE_GESAMT) break;
    if (alt !== name) cacheWeg(alt);
  }
}

/** `von` unter dem Namen `nach` ablegen, ohne eine dort schon liegende Datei zu überschreiben (link statt rename). */
async function ohneUeberschreiben(von: string, nach: string): Promise<'ok' | 'da'> {
  try { await fs.link(von, nach); }
  catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === 'EEXIST') return 'da';
    if (code !== 'EPERM' && code !== 'ENOTSUP' && code !== 'EOPNOTSUPP') throw e;
    // Dateisystem ohne harte Links: prüfen und umbenennen (kleines Fenster, wie vor dem 29.09.).
    try { await fs.access(nach); return 'da'; } catch { /* frei */ }
    await fs.rename(von, nach);
    return 'ok';
  }
  await fs.unlink(von).catch(() => {});
  return 'ok';
}

/**
 * Umbenennung Jarvis → ZOE (27.09.): Bestände hießen `jarvis-…`. Wird ein `zoe-…`-Bestand zum ersten Mal gelesen
 * und liegt noch die alte Datei, wird sie EINMAL übernommen — Daten auf dem Server bleiben so ohne Migration erhalten.
 * Seit 29.09. (Go-Live-Prüfung): eine v2-Hülle trägt den Bestandsnamen als AAD. Ein bloßes Umbenennen ließe sie unter
 * `zoe-…` mit der AAD `jarvis-…` liegen — darum wird sie mit dem aktiven Schlüssel unter dem NEUEN Namen neu verschlüsselt
 * (atomar: Temp-Datei mit fsync, dann ohne Überschreiben an den neuen Namen, erst danach die alte Datei weg).
 * Ohne aktiven Schlüssel (nur Alt-Schlüssel) oder bei v1/Klartext wird wie bisher nur umbenannt; die Hülle liest
 * die AAD ohnehin tolerant (huelle.mjs `aadAlternativen`) und die nächste Schreibung stellt sie um.
 */
async function altenNamenUebernehmen(name: string, file: string): Promise<boolean> {
  if (!/^zoe(-|$)/.test(name)) return false;
  const altName = name.replace(/^zoe/, 'jarvis');
  const alt = path.join(DATA_DIR, `${altName}.json`);
  const istDa = async () => { try { await fs.access(file); return true; } catch { return false; } };
  let roh: string;
  try { roh = await fs.readFile(alt, 'utf8'); } catch { return istDa(); } // keine alte Datei (oder schon übernommen)
  const aktiv = schluesselRing().aktiv;
  let neu: string | null = null;
  if (aktiv && siehtWieHuelleAus(roh)) {
    try {
      const o: unknown = JSON.parse(roh);
      if (huellenVersion(o) === 2) neu = huelleSchreiben(huelleOeffnen(o, schluesselRing(), altName).text, aktiv, name);
    } catch { /* nicht lesbar: unverändert übernehmen — der Leser meldet den Fehler danach laut */ }
  }
  try {
    if (neu === null) {
      if ((await ohneUeberschreiben(alt, file)) === 'da') return true;
    } else {
      const tmp = tmpName(file);
      await atomarSchreiben(tmp, neu);
      const r = await ohneUeberschreiben(tmp, file).catch(async e => { await fs.unlink(tmp).catch(() => {}); throw e; });
      if (r === 'da') { await fs.unlink(tmp).catch(() => {}); return true; }
      await fs.unlink(alt).catch(() => {});
    }
    await ordnerSyncKern(DATA_DIR);
    console.log(`[local-db] ${path.basename(alt)} → ${path.basename(file)} (ZOE${neu !== null ? ', mit neuem Namen verschlüsselt' : ''})`);
    return true;
  } catch { return istDa(); }
}

const siehtWieHuelleAus = (roh: string) => roh.startsWith('{') && roh.slice(0, 48).includes(`"${HUELLE}"`);

/**
 * Rohtext einer Bestandsdatei → Klartext. `aad` = Bestandsname (v2-Hülle). Kaputtes JSON kommt als Text zurück
 * (der Aufrufer legt beiseite). Klartext bei gesetztem Schlüssel wirft KlartextBestand (außer Migrationsschalter).
 * Exportiert für Werkzeuge, die Sicherungen/Archive lesen (Einzel-Restore, Durchsicht).
 */
export function rohOeffnen(roh: string, aad: string): Gelesen {
  const ring = schluesselRing();
  if (siehtWieHuelleAus(roh)) {
    let o: unknown = null;
    try { o = JSON.parse(roh); } catch { return { text: roh, version: 0, kid: null }; }
    if (huellenVersion(o)) {
      try { const r = huelleOeffnen(o, ring, aad); return { text: r.text, version: r.version, kid: r.kid, ...(r.aadAlt ? { aadAlt: true } : {}) }; }
      catch (e) {
        if (e instanceof SchluesselFehltKern) throw e;
        throw new Error(`[local-db] ${aad}: ${e instanceof EntschluesselungFehlgeschlagen ? e.message : 'Entschlüsselung fehlgeschlagen — stimmt MAKE_OS_DATEN_SCHLUESSEL?'}`);
      }
    }
  }
  if (ring.aktiv && process.env.MAKE_OS_KLARTEXT_MIGRATION !== '1') {
    try { JSON.parse(roh); } catch { return { text: roh, version: 0, kid: null }; } // kaputt ≠ Klartext: wird beiseitegelegt
    Z.klartext.add(aad);
    zaehle('klartextAbgelehnt');
    throw new KlartextBestand(`[local-db] ${aad}: liegt als Klartext vor, obwohl ein Datenschlüssel gesetzt ist — abgelehnt (Integritätsschutz). Einmalig mit MAKE_OS_KLARTEXT_MIGRATION=1 übernehmen oder scripts/daten-verschluesselung.mjs --verschluesseln laufen lassen.`);
  }
  return { text: roh, version: 0, kid: null };
}

/** Der entschlüsselte Text eines Bestands — null, wenn er noch nie geschrieben wurde. Wirft bei Lesefehlern. */
async function leseText(name: string): Promise<Gelesen | null> {
  const file = path.join(DATA_DIR, `${name}.json`);
  let st: Awaited<ReturnType<typeof fs.stat>>;
  try { st = await fs.stat(file); }
  catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      if (!(await altenNamenUebernehmen(name, file))) return null;
      try { st = await fs.stat(file); } catch { return null; }
    } else throw new BestandNichtLesbar(`[local-db] ${name}: nicht lesbar (${code ?? 'unbekannt'})`);
  }
  const c = cacheHole(name);
  if (c && c.ino === st.ino && c.mtimeMs === st.mtimeMs && c.size === st.size && c.ring === ringKennung()) return { text: c.text, version: c.version, kid: c.kid };
  let buf: string;
  try { buf = await fs.readFile(file, 'utf8'); }
  catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return null;
    throw new BestandNichtLesbar(`[local-db] ${name}: nicht lesbar (${code ?? 'unbekannt'})`);
  }
  const g = rohOeffnen(buf, name);
  if (g.aadAlt) altAadNachschreiben(name); // nicht cachen: bis zum Neuschreiben jedes Mal ehrlich lesen
  else if (g.version || buf === g.text) merkeGelesen(name, st, g);
  return g;
}

const nachschreibend = new Set<string>();
/**
 * Eine unter dem Altnamen verschlüsselte Hülle (jarvis-… → zoe-…) einmal mit dem richtigen Namen neu schreiben — in der
 * Schreibsperre des Bestands, außerhalb des Ablaufs des Lesers (sonst hielte ein updateJson-Leser die Sperre selbst).
 * Fehler werden nur gemeldet: der Bestand bleibt lesbar, die nächste gewöhnliche Schreibung stellt ihn ebenso um.
 */
function altAadNachschreiben(name: string): void {
  if (nachschreibend.has(name) || !schluesselRing().aktiv) return;
  nachschreibend.add(name);
  Z.als.exit(() => {
    void mitSperre(name, async () => {
      aenderungFertig();
      const file = path.join(DATA_DIR, `${name}.json`);
      let roh: string;
      try { roh = await fs.readFile(file, 'utf8'); } catch { return; }
      const g = rohOeffnen(roh, name);
      const aktiv = schluesselRing().aktiv;
      if (!g.aadAlt || !aktiv) return;
      await schreibeDatei(name, file, g.text);
      console.log(`[local-db] ${name}: Hülle vom Altnamen auf den Bestandsnamen umgestellt (AAD).`);
    }).catch(e => console.error(`[local-db] ${name}: Neuschreiben nach Altnamen gescheitert (${e instanceof Error ? e.message.slice(0, 120) : 'unbekannt'}) — die nächste Schreibung holt es nach.`))
      .finally(() => nachschreibend.delete(name));
  });
}

/**
 * Text → Daten (Zeit gemessen, Schema migriert, `_v` herausgenommen). Kaputtes JSON wird beiseitegelegt
 * (.corrupt-<ts>) und als null gelesen; Schreiber prüfen das (BestandBeschaedigt). Scheitert das
 * Beiseitelegen, wird BestandBeschaedigt geworfen — nie „leer“, das der nächste Schreiber überschriebe (#7/#86).
 */
async function parseOderBeiseite<T>(name: string, text: string): Promise<T | null> {
  const t0 = performance.now();
  let roh: unknown;
  try { roh = JSON.parse(text); }
  catch {
    const file = path.join(DATA_DIR, `${name}.json`);
    const backup = `${file}.corrupt-${Date.now()}`;
    cacheWeg(name);
    try { await fs.rename(file, backup); }
    catch (e) {
      console.error(`[local-db] ${name}.json ist beschädigt und ließ sich nicht beiseitelegen (${(e as NodeJS.ErrnoException)?.code ?? 'unbekannt'}) — nichts wird geschrieben.`);
      throw new BestandBeschaedigt(`[local-db] ${name}: beschädigt und nicht beiseitegelegt — erst prüfen, dann schreiben.`);
    }
    console.error(`[local-db] ${name}.json war beschädigt → gesichert unter ${path.basename(backup)}`);
    return null;
  }
  parseMessen(name, performance.now() - t0, text.length);
  return migriere<T>(name, roh as T).daten;
}

/** Liest eine Sammlung; null, wenn noch nichts persistiert wurde (oder der Bestand beschädigt beiseitegelegt ist).
 *  Lesefehler (Rechte, E/A) werfen BestandNichtLesbar — nie „leer“. */
export async function loadJson<T>(name: string): Promise<T | null> {
  pruefeName(name);
  const r = await leseText(name);
  if (!r) return null;
  return parseOderBeiseite<T>(name, r.text);
}

/** Verzeichnis-fsync — schluckt nur „nicht unterstützt“ (EINVAL/ENOTSUP), E/A-Fehler werfen (#5). */
export const ordnerSync = ordnerSyncKern;

/** Datei schreiben (atomar + dauerhaft) und den Lesecache mit dem geschriebenen Text füllen. */
async function schreibeDatei(name: string, dest: string, text: string): Promise<void> {
  const t0 = performance.now();
  await ensureDir();
  await taeglicheSicherung(name, dest);
  // Nur der Besitzer liest die Bestände (26.09.) — auf dem Server ist das der Container-Nutzer = make.
  const aktiv = schluesselRing().aktiv;
  await atomarSchreiben(dest, aktiv ? huelleSchreiben(text, aktiv, name) : text);
  Z.zaehler.set(name, (Z.zaehler.get(name) ?? 0) + 1);
  try { merkeGelesen(name, await fs.stat(dest), { text, version: aktiv ? 2 : 0, kid: aktiv?.kid ?? null }); } catch { cacheWeg(name); }
  messe('schreiben', performance.now() - t0);
  standErhoehen(name);
}

/** Unverändert? Dann nicht schreiben — außer die Datei liegt nicht in der aktuellen Hülle (Klartext → verschlüsseln, v1/alter Schlüssel → v2). */
function unveraendert(vorher: Gelesen | null, text: string): boolean {
  if (!vorher || vorher.text !== text || vorher.aadAlt) return false;
  const aktiv = schluesselRing().aktiv;
  if (!aktiv) return vorher.version === 0;
  return vorher.version === 2 && vorher.kid === aktiv.kid;
}

// ── Sperren ───────────────────────────────────────────────────────────────────
/**
 * Bestände, deren Sperre dieser Ablauf gerade hält UND auf deren Änderung er noch wartet. Ein Schritt, der erst
 * nach der Änderung weiterläuft (z. B. „nebenher“ angestoßen, während der Halter schon schreibt), wartet ganz
 * normal in der Schlange — das ist keine Verklemmung.
 */
function gehalten(): string[] {
  const namen: string[] = [];
  for (let r = Z.als.getStore() ?? null; r; r = r.oben) if (!r.frei && r.aendern) namen.push(r.name);
  return namen;
}
/** In updateJsonAsync nach `mutate`: ab hier schreibt der Halter nur noch. */
function aenderungFertig(): void { const r = Z.als.getStore(); if (r) r.aendern = false; }

function lassStill(): void {
  if (Z.laufend > 0) return;
  const w = Z.stillWarten.splice(0);
  for (const f of w) f();
}

/** Warten, bis keine Schreibsperre mehr gehalten wird (höchstens `ms`). true = still. */
export function warteBisStill(ms: number): Promise<boolean> {
  if (Z.laufend === 0) return Promise.resolve(true);
  return new Promise(ok => {
    const t = setTimeout(() => { Z.stillWarten = Z.stillWarten.filter(f => f !== fertig); ok(false); }, ms);
    t.unref?.();
    const fertig = () => { clearTimeout(t); ok(true); };
    Z.stillWarten.push(fertig);
  });
}

/**
 * Die Schreibsperre eines Bestands halten, während `fn` läuft. Serialisiert alle Schreiber desselben Bestands.
 * Wirft SperreFalsch bei Wiedereintritt/falscher Rangfolge, SperreZeitlimit nach 30 s Warten,
 * SchreibenGesperrt während der Abschaltung. Äußere Sperren warten eine Schreibpause ab (Sicherung).
 */
async function mitSperre<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const halte = gehalten();
  if (halte.includes(name)) throw new SperreFalsch(`[local-db] ${name}: Wiedereintritt — die Schreibsperre dieses Bestands wird in diesem Ablauf schon gehalten (${halte.join(' → ')}). Das würde für immer warten.`);
  const rang = RANG[name];
  if (rang !== undefined) {
    const hoeher = halte.find(h => RANG[h] !== undefined && RANG[h] > rang);
    if (hoeher) throw new SperreFalsch(`[local-db] Sperr-Rangfolge verletzt: ${name} nach ${hoeher} — verbindlich ist crm → kontakte (lib/crm/kartei-schreiben.ts).`);
  }
  const aussen = halte.length === 0;
  if (aussen && Z.abschaltung && Date.now() - Z.abschaltung.seit > ABSCHALT_NACHLAUF_MS) {
    throw new SchreibenGesperrt(`[local-db] ${name}: MAKE OS fährt gerade herunter — bitte gleich noch einmal versuchen.`);
  }
  if (aussen) {
    while (Z.pause && Date.now() < Z.pause.bis) {
      const p = Z.pause;
      await Promise.race([p.ende, new Promise(r => { const t = setTimeout(r, Math.max(0, p.bis - Date.now())); t.unref?.(); })]);
    }
  }

  const vorher = Z.schlange.get(name) ?? Promise.resolve();
  let frei!: () => void;
  const meins = new Promise<void>(r => { frei = r; });
  const ende = vorher.then(() => meins);
  Z.schlange.set(name, ende);
  const t0 = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rahmen: Rahmen | null = null;
  try {
    const dran = await Promise.race([
      vorher.then(() => true),
      new Promise<false>(r => { timer = setTimeout(() => r(false), sperrLimitMs()); timer.unref?.(); }),
    ]);
    const gewartet = performance.now() - t0;
    messe('sperrWarten', gewartet);
    if (!dran) {
      zaehle('sperrZeitlimit');
      throw new SperreZeitlimit(`[local-db] ${name}: Schreibsperre seit ${(gewartet / 1000).toFixed(1)} s belegt — nichts geschrieben, bitte erneut versuchen (Messwert im Head of IT).`);
    }
    rahmen = { name, frei: false, aendern: true, oben: Z.als.getStore() ?? null };
    Z.laufend++;
    const t1 = performance.now();
    try { return await Z.als.run(rahmen, fn); }
    finally { messe('sperrHalten', performance.now() - t1); }
  } finally {
    if (timer) clearTimeout(timer);
    if (rahmen) { rahmen.frei = true; Z.laufend--; lassStill(); }
    frei();
    // Aufräumen erst, wenn die ganze Kette bis hierher durch ist — ein Wartender, der am Zeitlimit aufgab,
    // darf den Platz des noch laufenden Halters nicht freigeben.
    void ende.then(() => { if (Z.schlange.get(name) === ende) Z.schlange.delete(name); });
  }
}

/**
 * Nur die Schreibsperre eines Bestands halten (ohne ihn zu lesen oder zu schreiben) — für Werkzeuge, die
 * Dateien NEBEN einem Bestand bearbeiten müssen, während dessen Schreiber warten (Rotation der Dateiablage).
 */
export async function mitBestandSperre<T>(name: string, fn: () => Promise<T>): Promise<T> {
  pruefeName(name);
  return mitSperre(name, async () => { aenderungFertig(); return fn(); });
}

/** Zum Schreiben: Schemaversion dran, ohne Einrückung (#76 — Lesen bleibt tolerant). */
const zuText = (name: string, daten: unknown) => JSON.stringify(mitVersion(name, daten));

/** Schreibt eine Sammlung atomar — und serialisiert gleichzeitige Schreiber derselben Sammlung.
 *  Liest vorher wie updateJson: kaputtes JSON wird beiseitegelegt statt überschrieben (#7). */
export async function saveJson<T>(name: string, data: T): Promise<void> {
  pruefeName(name);
  await mitSperre(name, async () => {
    const vorher = await leseText(name);
    const alt = vorher ? await parseOderBeiseite<T>(name, vorher.text) : null;
    // Ein beiseitegelegter Bestand wird nicht still ersetzt — erst die .corrupt-Kopie prüfen (Stufe 1).
    if (alt === null && await beschaedigt(name)) throw new BestandBeschaedigt(`[local-db] ${name}: liegt beschädigt beiseite (.corrupt-…) — erst prüfen oder wiederherstellen, dann schreiben.`);
    aenderungFertig();
    const text = zuText(name, data);
    if (unveraendert(vorher, text)) return; // nichts Neues → keine Schreibung, kein ETag-Sprung, kein Cache-Verlust
    await schreibeDatei(name, path.join(DATA_DIR, `${name}.json`), text);
  });
}

/** Liest, verändert und schreibt eine Sammlung in EINEM serialisierten Schritt.
 *  Verhindert verlorene Einträge beim gleichzeitigen Anhängen (agent-log!). */
export async function updateJson<T>(name: string, mutate: (current: T | null) => T): Promise<T> {
  return updateJsonAsync<T>(name, async cur => mutate(cur));
}

/**
 * Wie updateJson, aber die Änderung darf warten (28.09.): für Schritte, die in DERSELBEN Sperre einen zweiten
 * Bestand mitschreiben müssen (Finanzplan „bezahlt“ → Buchung). Innen nur ANDERE Bestände über updateJson
 * anfassen — derselbe Name wirft seit 29.09. `SperreFalsch` (vorher: ewiges Warten). Wirft `mutate`, wird
 * dieser Bestand nicht geschrieben.
 */
export async function updateJsonAsync<T>(name: string, mutate: (current: T | null) => Promise<T>): Promise<T> {
  pruefeName(name);
  return mitSperre(name, async () => {
    const vorher = await leseText(name);
    const current = vorher ? await parseOderBeiseite<T>(name, vorher.text) : null;
    // Beschädigt beiseitegelegt (jetzt oder früher): nicht mit einem frischen Stand überschreiben (Stufe 1).
    if (current === null && await beschaedigt(name)) throw new BestandBeschaedigt(`[local-db] ${name}: liegt beschädigt beiseite (.corrupt-…) — erst prüfen oder wiederherstellen, dann schreiben.`);
    const next = await mutate(current);
    aenderungFertig();
    const text = zuText(name, next);
    if (unveraendert(vorher, text)) return next; // unverändert → nichts geschrieben
    await schreibeDatei(name, path.join(DATA_DIR, `${name}.json`), text);
    return next;
  });
}

// ── Betrieb: Schreibpause (Sicherung) und Abschaltung ──────────────────────────
/**
 * Schreibpause für einen konsistenten Schnappschuss (deploy/sicherung.sh, #61): neue äußere Schreibungen
 * warten, bis die Pause endet (höchstens 30 s, dann läuft es von selbst weiter). Liefert, sobald keine
 * Sperre mehr gehalten wird — `still: false`, wenn nach `warteMs` noch geschrieben wird.
 */
export async function schreibpauseSetzen(ms: number, warteMs = 10_000): Promise<{ still: boolean; bis: string }> {
  schreibpauseAufheben();
  const dauer = Math.max(1000, Math.min(PAUSE_MAX_MS, ms));
  let loese!: () => void;
  const ende = new Promise<void>(r => { loese = r; });
  const timer = setTimeout(() => schreibpauseAufheben(), dauer);
  timer.unref?.();
  Z.pause = { bis: Date.now() + dauer, ende, loese, timer };
  const still = await warteBisStill(Math.min(warteMs, dauer));
  return { still, bis: new Date(Z.pause?.bis ?? Date.now()).toISOString() };
}
export function schreibpauseAufheben(): void {
  const p = Z.pause;
  if (!p) return;
  Z.pause = null;
  clearTimeout(p.timer);
  p.loese();
}

/** SIGTERM (lib/store/betrieb.ts): laufende Vorgänge dürfen noch 20 s schreiben, danach lehnt die Datenschicht mit 503 ab. */
export function abschaltungBeginnen(jetzt = Date.now()): void { Z.abschaltung ??= { seit: jetzt }; }
/** Nur für Tests. */
export function abschaltungZuruecksetzen(): void { Z.abschaltung = null; }

/** Was der Head of IT über die Datenschicht wissen muss — nur Zähler. */
export function datenschichtLage(): { laufend: number; pause: boolean; abschaltung: boolean; sicherungFehler: { anzahl: number; letzter?: string; zeit?: string }; klartext: string[]; cacheMb: number; cacheEintraege: number } {
  return {
    laufend: Z.laufend, pause: !!Z.pause, abschaltung: !!Z.abschaltung, sicherungFehler: { ...Z.sicherungFehler },
    klartext: Array.from(Z.klartext).sort(), cacheMb: Math.round((Z.cacheZeichen / 1_048_576) * 10) / 10, cacheEintraege: Z.leseCache.size,
  };
}

/**
 * Eine Bestandsdatei (Bestand, Tagessicherung) in die aktuelle Hülle bringen — für die Rotation im laufenden Betrieb.
 * Läuft in der Schreibsperre des Bestands, nie über Klartext auf der Platte. Liefert, was geschah.
 */
export async function bestandUmschluesseln(name: string): Promise<{ bestand: 'neu' | 'schon' | 'fehlt'; sicherungen: number; fehler: string[] }> {
  pruefeName(name);
  const aktiv = schluesselRing().aktiv;
  if (!aktiv) throw new SchluesselFehlt('Kein aktiver Datenschlüssel — Umschlüsseln nicht möglich.');
  return mitSperre(name, async () => {
    const fehler: string[] = [];
    const umstellen = async (pfad: string): Promise<'neu' | 'schon' | 'fehlt'> => {
      let roh: string;
      try { roh = await fs.readFile(pfad, 'utf8'); } catch (e) { if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return 'fehlt'; throw e; }
      let o: unknown = null;
      try { o = JSON.parse(roh); } catch { throw new Error('kein JSON'); }
      const v = huellenVersion(o);
      // Aktueller Schlüssel UND richtige AAD? Den Altnamen (jarvis-…) erkennt nur das Öffnen — nur bei zoe-… nötig.
      if (v === 2 && (o as { kid?: string }).kid === aktiv.kid && (!aadAlternativen(name).length || !huelleOeffnen(o, schluesselRing(), name).aadAlt)) return 'schon';
      const text = v ? huelleOeffnen(o, schluesselRing(), name).text : roh;
      JSON.parse(text);
      await atomarSchreiben(pfad, huelleSchreiben(text, aktiv, name));
      return 'neu';
    };
    let bestand: 'neu' | 'schon' | 'fehlt' = 'fehlt';
    try { bestand = await umstellen(path.join(DATA_DIR, `${name}.json`)); } catch (e) { fehler.push(`${name}: ${e instanceof Error ? e.message : String(e)}`); }
    if (bestand === 'neu') { cacheWeg(name); Z.zaehler.set(name, (Z.zaehler.get(name) ?? 0) + 1); }
    let sicherungen = 0;
    const kopien = sicherungenVon(name, await fs.readdir(BACKUP_DIR).catch(() => [] as string[]));
    for (const f of kopien) {
      try { if ((await umstellen(path.join(BACKUP_DIR, f))) === 'neu') sicherungen++; }
      catch (e) { fehler.push(`backup/${f}: ${e instanceof Error ? e.message : String(e)}`); }
    }
    return { bestand, sicherungen, fehler };
  });
}

// ── Schutz gegen stilles Schrumpfen ───────────────────────────────────────────
/**
 * Die eigentliche Regel hinter beiden Wächtern: schrumpft eine Liste um mehr als die Hälfte, ist das kein
 * Bearbeiten mehr, sondern ein Verlust. Eigene Funktion, damit sie prüfbar ist — sie ist die Zeile, die am
 * 06.09. verhindert hätte, dass 57 Aufgaben still verschwinden.
 *
 * @param alt     Länge vorher
 * @param neu     Länge nachher
 * @param abTeil  ab welcher Länge überhaupt geprüft wird (kurze Listen schwanken naturgemäß stark)
 */
export function schrumpftZuStark(alt: number, neu: number, abTeil: number): boolean {
  return alt >= abTeil && neu < alt / 2;
}

/**
 * Schreibt eine Sammlung mit Schrumpf-Schutz: hätte der neue Stand deutlich weniger Einträge als der alte,
 * wird abgelehnt statt überschrieben. Die Prüfung läuft INNERHALB der Schreib-Sperre.
 * @returns { ok: true, next } oder { ok: false } — dann wurde NICHT geschrieben
 */
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
 * Derselbe Schutz für Dateien mit MEHREREN Listen — etwa der Finanzplan mit Firmen, Rechnungen, Zahlungen
 * und Merkposten nebeneinander. Jede Liste wird einzeln geprüft; eine einzige schrumpfende reicht, um den
 * ganzen Schreibvorgang abzulehnen.
 * @returns bei Ablehnung zusätzlich `verloren`: welche Liste geschrumpft wäre
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
