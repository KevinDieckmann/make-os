// ─── Medien — die ganze Instanz: Bestand im Medienspeicher aufnehmen, auflisten und (nur beim Instanz-Löschen) leeren (09.10., Nachzug) ───
// Für den Instanz-Export (lib/medien/export.ts: Liste der Objekte neben den Metadaten) und das Löschskript (scripts/instanz-loeschen.mjs:
// Trockenlauf zeigt Anzahl und Größe, Ausführen löscht die Objekte im Bucket bzw. den Medien-Ordner). Als .mjs, weil das Skript mit nacktem
// Node läuft (kein TS-Lader im Server-Bild) — Signatur und Aufrufe aus lib/medien/s3-kern.mjs, dieselben wie in der App.
// Regeln:
//   · Nur unter dem Präfix der Instanz (`MAKE_OS_MEDIEN_PRAEFIX`, Vorgabe `m`) — teilen sich Instanzen einen Bucket, bleibt alles andere unberührt.
//   · Namen, die nicht wie Medien-Objekte aussehen (`fremd`), werden nur gezählt und genannt, nie gelöscht.
//   · Erst listen, dann löschen (nie während des Blätterns ändern). Scheitert ein Objekt, bricht das Skript ab, BEVOR es den Datenordner entfernt —
//     sonst lägen Objekte ohne Katalog und ohne Schlüssel im Bucket, die niemand mehr zuordnen kann.
//   · Nie `.data` (lokaler Datenordner), nie ein Ordner, der nicht wie ein Medien-Ordner aussieht (nur `obj/` und `teile/`).
// Nur Zahlen, Orte (ohne Zugangsdaten) und Objekt-Namen (zufällige Kennungen) — keine Inhalte. Hinweis, keine Rechtsberatung.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { objektOk, s3Angegeben, s3KonfigAus, s3Basis } from './s3-kern.mjs';

const mb = b => (b < 1_048_576 ? `${Math.ceil(b / 1024)} KB` : `${(b / 1_048_576).toFixed(1).replace('.', ',')} MB`);

/** Dateien und Bytes unter einem Ordner (rekursiv). */
export async function ordnerZaehlen(ordner) {
  let dateien = 0, bytes = 0;
  const lauf = async d => {
    for (const e of await fs.readdir(d, { withFileTypes: true }).catch(() => [])) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await lauf(p);
      else if (e.isFile()) { dateien++; bytes += (await fs.stat(p).catch(() => ({ size: 0 }))).size; }
    }
  };
  await lauf(ordner);
  return { dateien, bytes };
}

/** Ort ohne Zugangsdaten (für Trockenlauf, Bericht und Export). */
export function ortVon(k) {
  if (k.modus === 's3') return `${k.endpunkt}/${k.bucket}`;
  if (k.modus === 'ordner') return k.ordner;
  return 'aus';
}

/** Kennung (Medium `md-…` bzw. Einwilligung `ew-…`) und Variante aus `<präfix>/<kennung>/<variante>` (rein). */
export function objektTeile(objekt, praefix) {
  const t = objekt.split('/');
  return t.length === 3 && t[0] === praefix ? { kennung: t[1], variante: t[2] } : {};
}

/** Alle Objekte unter dem Präfix (mit Kennung/Variante) — für den Instanz-Export. Wirft, wenn der Speicher nicht erreichbar ist. */
export async function medienObjekteListen(s, praefix) {
  if (!s.auflisten) throw new Error('Dieser Medienspeicher kann nicht auflisten.');
  const raus = [];
  for await (const o of s.auflisten(praefix)) raus.push(o.fremd ? { objekt: o.objekt, bytes: o.bytes, fremd: true } : { objekt: o.objekt, bytes: o.bytes, ...objektTeile(o.objekt, praefix) });
  return raus;
}

/** Anzahl und Größe (Trockenlauf). Wirft, wenn der Speicher nicht erreichbar ist. */
export async function medienInventur(s, k) {
  if (!s.auflisten || !s.offeneUploads) throw new Error('Dieser Medienspeicher kann nicht auflisten.');
  const r = { modus: k.modus, ort: k.ort, praefix: k.praefix, objekte: 0, bytes: 0, fremd: 0, offeneUploads: 0 };
  for await (const o of s.auflisten(k.praefix)) {
    if (o.fremd) { r.fremd++; continue; }
    r.objekte++; r.bytes += o.bytes;
  }
  for await (const u of s.offeneUploads(k.praefix)) { if (u.objekt && !objektOk(u.objekt)) r.fremd++; else r.offeneUploads++; }
  return r;
}

/**
 * Alle Medien-Objekte der Instanz löschen und offene Uploads abbrechen (NUR für das Instanz-Löschen). Fehler je Objekt werden gezählt, nicht
 * verschluckt — der Aufrufer bricht bei `fehler > 0` ab, BEVOR er den Datenordner entfernt.
 */
export async function medienLeeren(s, praefix) {
  if (!s.auflisten || !s.offeneUploads) throw new Error('Dieser Medienspeicher kann nicht auflisten.');
  const r = { geloescht: 0, bytes: 0, abgebrochen: 0, fehler: 0, fremd: 0 };
  const uploads = [];
  for await (const u of s.offeneUploads(praefix)) uploads.push(u);
  for (const u of uploads) {
    if (u.objekt && !objektOk(u.objekt)) { r.fremd++; continue; }
    try { await s.abbrechen(u.objekt, u.upload); r.abgebrochen++; } catch { r.fehler++; }
  }
  const objekte = [];
  for await (const o of s.auflisten(praefix)) { if (o.fremd) r.fremd++; else objekte.push(o); }
  for (const o of objekte) {
    try { await s.loeschen(o.objekt); r.geloescht++; r.bytes += o.bytes; } catch { r.fehler++; }
  }
  return r;
}

const KATALOG = /^medien(-privat)?--[a-z0-9-]+\.json$/;

/**
 * Der Medien-Teil des Instanz-Löschens (scripts/instanz-loeschen.mjs) — rein bis auf Lesen von Ordner und Speicher; gelöscht wird erst in
 * `ausfuehren`. `env` = Umgebung der Instanz (MAKE_OS_MEDIEN_*), `datenOrdner` = realpath des Datenordners, `lokal` = realpath von `.data`
 * dieses Rechners (oder null). Liefert entweder `abbruch` (Satz) oder Zeilen für den Trockenlauf, einen `stand` für den Bestätigungs-Code und
 * `ausfuehren()`.
 */
export async function medienPlan({ env, datenOrdner, lokal = null, ohneMedien = false, holen = (...a) => fetch(...a) }) {
  const abbruch = text => ({ ok: false, abbruch: text });
  const kataloge = (await fs.readdir(datenOrdner).catch(() => [])).filter(n => KATALOG.test(n)).length;
  if (ohneMedien) {
    const satz = `NICHT geprüft und NICHT gelöscht (--ohne-medien)${kataloge ? ` — ${kataloge} Medien-Kataloge im Datenordner` : ''}: Object Storage bzw. Medien-Ordner von Hand leeren (Hetzner-Konsole: Bucket leeren, dann löschen; S3-Zugangsdaten löschen).`;
    return { ok: true, zeilen: [`Medienspeicher: ${satz}`], stand: 'ohne-medien', ausfuehren: async () => ({ ok: true, zeilen: [`Medien: ${satz}`] }) };
  }

  // ── Ordner (Rückfall ohne Object Storage; bzw. ein früherer Ordner neben dem Bucket) ──
  const ordnerRoh = String(env.MAKE_OS_MEDIEN_DIR ?? '').trim() || path.join(datenOrdner, 'medien');
  const ordner = await fs.realpath(path.resolve(ordnerRoh)).catch(() => null);
  const imDaten = !!ordner && (ordner === datenOrdner || ordner.startsWith(datenOrdner + path.sep));
  if (ordner && !imDaten) {
    if (lokal && (ordner === lokal || ordner.startsWith(lokal + path.sep))) return abbruch('Der Medien-Ordner liegt im lokalen Datenordner (.data) — den fasst dieses Skript nie an.');
    if (path.basename(ordner) === '.data' || ordner === path.parse(ordner).root || ordner === process.env.HOME || ordner === process.cwd()) return abbruch(`Unsicherer Medien-Ordner: ${ordner}`);
    if (!(await fs.stat(ordner).then(s => s.isDirectory(), () => false))) return abbruch(`Medien-Ordner ist kein Ordner: ${ordner}`);
    if ((await fs.readdir(ordner).catch(() => [])).some(n => n !== 'obj' && n !== 'teile')) return abbruch(`${ordner} sieht nicht wie ein Medien-Ordner aus (erwartet nur obj/ und teile/).`);
  }
  const ordnerStand = ordner ? await ordnerZaehlen(ordner) : null;

  // ── Object Storage ──
  let s3 = null;
  if (s3Angegeben(env)) {
    const k = s3KonfigAus(env);
    if (!k) return abbruch('Object Storage halb eingerichtet (eine MAKE_OS_MEDIEN_S3_*-Variable fehlt oder ist ungültig) — Variablen prüfen (--env <.env der Instanz>) oder --ohne-medien.');
    const basis = s3Basis(k, holen, (text, status, code) => Object.assign(new Error(text), { status, code }));
    try { s3 = { k, basis, inv: await medienInventur(basis, { modus: 's3', ort: ortVon(k), praefix: k.praefix }) }; }
    catch (e) { return abbruch(`${e instanceof Error ? e.message : 'Medienspeicher nicht erreichbar.'} Nichts gelöscht — später erneut, oder mit --ohne-medien, wenn der Bucket von Hand geleert wird.`); }
  } else if (kataloge && !ordner) {
    return abbruch(`${kataloge} Medien-Kataloge im Datenordner, aber weder Object Storage angegeben (--env <.env der Instanz>) noch ein Medien-Ordner gefunden — wo liegen die Dateien? Sonst --ohne-medien (Bucket von Hand leeren).`);
  }

  const zeilen = [];
  if (s3) {
    const i = s3.inv;
    zeilen.push(`Medienspeicher: Object Storage ${i.ort} (Präfix ${i.praefix}/) — ${i.objekte} Objekte, ${mb(i.bytes)}${i.offeneUploads ? `, ${i.offeneUploads} offene Uploads` : ''}${i.fremd ? ` · ${i.fremd} Namen, die nicht wie Medien aussehen (werden NICHT gelöscht — prüfen, ob sich Instanzen das Präfix teilen)` : ''}`);
  }
  if (ordner) zeilen.push(`Medien-Ordner:  ${ordner} — ${ordnerStand.dateien} Dateien, ${mb(ordnerStand.bytes)} (${imDaten ? 'im Datenordner — geht mit ihm' : 'außerhalb des Datenordners — wird mit gelöscht'})`);
  if (!s3 && ordner && kataloge) zeilen.push('                (kein Object Storage angegeben — lief die Instanz mit Object Storage, --env <.env der Instanz> angeben)');
  if (!zeilen.length) zeilen.push('Medienspeicher: keine Medien (keine Kataloge, kein Medien-Ordner, kein Object Storage angegeben)');
  const stand = [s3 ? `s3:${s3.inv.objekte}:${s3.inv.bytes}:${s3.inv.offeneUploads}:${s3.inv.fremd}` : '', ordner && !imDaten ? `ordner:${ordnerStand.dateien}:${ordnerStand.bytes}` : ''].filter(Boolean).join('|');

  async function ausfuehren() {
    const z = [];
    if (s3) {
      const r = await medienLeeren(s3.basis, s3.k.praefix);
      if (r.fehler) return abbruch(`Medienspeicher: ${r.fehler} Objekte bzw. Uploads ließen sich nicht löschen (${r.geloescht} gelöscht) — der Datenordner bleibt, damit nichts ohne Schlüssel im Bucket zurückbleibt. Erneut: Trockenlauf → neuer Code.`);
      z.push(`Medien: ${r.geloescht} Objekte (${mb(r.bytes)}) im Object Storage ${ortVon(s3.k)} (Präfix ${s3.k.praefix}/) gelöscht${r.abgebrochen ? `, ${r.abgebrochen} offene Uploads abgebrochen` : ''}${r.fremd ? `; ${r.fremd} Namen, die nicht wie Medien aussehen, NICHT gelöscht — prüfen` : ''}. Den (leeren) Bucket und die S3-Zugangsdaten in der Hetzner-Konsole löschen.`);
    }
    if (ordner && !imDaten) {
      await fs.rm(ordner, { recursive: true, force: true });
      z.push(`Medien: Medien-Ordner ${ordner} (${ordnerStand.dateien} Dateien, ${mb(ordnerStand.bytes)}) gelöscht.`);
    } else if (ordner) z.push(`Medien: Medien-Ordner im Datenordner (${ordnerStand.dateien} Dateien, ${mb(ordnerStand.bytes)}) mit ihm gelöscht.`);
    return { ok: true, zeilen: z };
  }
  return { ok: true, zeilen, stand, ausfuehren };
}
