// ─── Dateiablage · verschlüsselt je Haushalt (Server, 28.09.) ───────────────
// Verträge, Angebote und Rechnungs-PDFs aus dem Reiter „Umsatz“ (Kontakt öffnen).
//
//   Inhalt:     <daten>/dateien/<haushalt>/<id>.bin
//   Metadaten:  Bestand `crm-dateien--<haushalt>` (local-db, wie jeder Bestand verschlüsselt)
//
// Verschlüsselung: derselbe Datenschlüssel wie local-db (`datenSchluessel()`,
// aus MAKE_OS_DATEN_SCHLUESSEL), AES-256-GCM, je Datei ein frischer IV. Auf der
// Platte liegt dann `MKOSDAT1` + IV (12) + Tag (16) + Chiffrat — ohne Schlüssel
// wertlos, jede Veränderung fällt beim Lesen auf (GCM-Tag). OHNE Schlüssel (lokale
// Entwicklung) bleibt der Inhalt wie der Rest der Bestände Klartext. Beim Lesen
// entscheidet der Kopf der Datei (MKOSDAT1 = Hülle), nicht der Eintrag — so liest
// die Ablage nach `scripts/daten-verschluesselung.mjs` (Ein-/Ausschalten, Schlüssel
// rotieren; das Skript stellt auch dateien/<haushalt>/*.bin um) beide Fassungen.
// `datei.verschluesselt` hält nur fest, wie die Datei abgelegt wurde. Hochgeladene
// Dateien können nicht mit MKOSDAT1 beginnen (Typprüfung am Inhalt: PDF/PNG/JPG/DOCX).
//
// Sicherheit: Kennungen nur `d-[a-z0-9-]`, Haushalt nur HAUSHALT_OK — kein Pfad
// kommt durch; zusätzlich wird geprüft, dass der Pfad im Haushaltsordner liegt.
// Dateien 0600, Ordner 0700, Schreiben über tmp + rename. Zugang regelt die Route
// (Default-Deny, Haushalt des Inhabers). Nie an KI/Agenten.

import { promises as fs } from 'fs';
import path from 'path';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { datenOrdner, datenSchluessel, loadJson, updateJson } from '@/lib/store/local-db';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { DATEI_ID, MAX_EINTRAEGE, hatBezug, istBeleg, metaSaeubern, type DateiEintrag, type DateiInfo, type DateiTyp } from './regeln';

const MAGIE = Buffer.from('MKOSDAT1', 'ascii');

export class AblageFehler extends Error { constructor(msg: string, readonly status: number) { super(msg); } }

export const ablageName = (haushalt: string) => {
  if (!HAUSHALT_OK.test(haushalt)) throw new AblageFehler('Unzulässiger Haushalt.', 400);
  return `crm-dateien--${haushalt}`;
};

function haushaltOrdner(haushalt: string): string {
  if (!HAUSHALT_OK.test(haushalt)) throw new AblageFehler('Unzulässiger Haushalt.', 400);
  return path.join(datenOrdner(), 'dateien', haushalt);
}
/** Pfad der Datei — nur für geprüfte Kennungen und nur innerhalb des Haushaltsordners. */
export function dateiPfad(haushalt: string, id: string): string {
  if (!DATEI_ID.test(id)) throw new AblageFehler('Unzulässige Kennung.', 400);
  const basis = haushaltOrdner(haushalt);
  const p = path.resolve(basis, `${id}.bin`);
  if (path.dirname(p) !== path.resolve(basis)) throw new AblageFehler('Unzulässiger Pfad.', 400);
  return p;
}

/** Liegt die Datei als Hülle auf der Platte? */
export const istHuelle = (b: Buffer) => b.length >= MAGIE.length + 28 && b.subarray(0, MAGIE.length).equals(MAGIE);

/** Inhalt → Hülle (MAGIE + IV + Tag + Chiffrat). */
export function inhaltVerschluesseln(klar: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(klar), c.final()]);
  return Buffer.concat([MAGIE, iv, c.getAuthTag(), enc]);
}
/** Hülle → Inhalt. Wirft ohne passenden Schlüssel oder bei veränderter Datei. */
export function inhaltEntschluesseln(huelle: Buffer, key: Buffer | null): Buffer {
  if (!istHuelle(huelle)) throw new AblageFehler('Datei ist keine verschlüsselte Ablage.', 500);
  if (!key) throw new AblageFehler('Die Datei ist verschlüsselt, der Datenschlüssel fehlt.', 503);
  const iv = huelle.subarray(MAGIE.length, MAGIE.length + 12);
  const tag = huelle.subarray(MAGIE.length + 12, MAGIE.length + 28);
  const d = createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  try { return Buffer.concat([d.update(huelle.subarray(MAGIE.length + 28)), d.final()]); }
  catch { throw new AblageFehler('Datei nicht lesbar — falscher Schlüssel oder verändert.', 500); }
}

interface AblageDatei { eintraege: DateiEintrag[] }

/** Alle Einträge des Haushalts (nur Metadaten). */
export async function ablageListe(haushalt: string): Promise<DateiEintrag[]> {
  return (await loadJson<AblageDatei>(ablageName(haushalt)))?.eintraege ?? [];
}

export const neueDateiId = () => `d-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;

export interface NeueDatei { bytes: Buffer; name: string; typ: DateiTyp }

/**
 * Ablegen: erst die Datei (verschlüsselt, tmp + rename), dann der Eintrag. Scheitert
 * der Eintrag, wird die Datei wieder entfernt — keine verwaisten Inhalte.
 */
export async function ablegen(haushalt: string, person: string, metaRoh: unknown, datei: NeueDatei | null, jetzt = new Date().toISOString()): Promise<DateiEintrag> {
  const meta = metaSaeubern(metaRoh);
  if (!meta.art) throw new AblageFehler('Art fehlt (vertrag, angebot, rechnung, sonstig).', 400);
  if (!hatBezug(meta)) throw new AblageFehler('Bezug fehlt (Kontakt, Firma, Mandat, Deal oder Rechnung).', 400);
  if (!datei && meta.art !== 'angebot') throw new AblageFehler('Datei fehlt.', 400);
  if (!datei && meta.art === 'angebot' && !meta.titel && !meta.angebot?.nummer && meta.angebot?.betrag == null) throw new AblageFehler('Angebot ohne Datei braucht Nummer, Titel oder Betrag.', 400);
  const id = neueDateiId();
  let info: DateiInfo | undefined;
  let pfad: string | null = null;
  if (datei) {
    const key = datenSchluessel();
    const ordner = haushaltOrdner(haushalt);
    await fs.mkdir(ordner, { recursive: true, mode: 0o700 });
    pfad = dateiPfad(haushalt, id);
    const tmp = `${pfad}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
    await fs.writeFile(tmp, key ? inhaltVerschluesseln(datei.bytes, key) : datei.bytes, { mode: 0o600 });
    await fs.rename(tmp, pfad);
    info = { name: datei.name, typ: datei.typ, groesse: datei.bytes.length, verschluesselt: !!key };
  }
  const eintrag: DateiEintrag = { id, ...meta, art: meta.art, ...(info ? { datei: info } : {}), hochgeladenAm: jetzt, hochgeladenVon: person };
  try {
    await updateJson<AblageDatei>(ablageName(haushalt), cur => {
      const l = cur?.eintraege ?? [];
      if (l.length >= MAX_EINTRAEGE) throw new AblageFehler(`Ablage voll (${MAX_EINTRAEGE} Einträge).`, 409);
      return { eintraege: [...l, eintrag] };
    });
  } catch (e) {
    if (pfad) await fs.unlink(pfad).catch(() => {});
    throw e;
  }
  return eintrag;
}

/** Metadaten ändern (Titel, Bezüge, Vertragsdaten, Angebotsstatus) — Art, Datei und Herkunft bleiben. */
export async function aendern(haushalt: string, person: string, id: string, felder: unknown, jetzt = new Date().toISOString()): Promise<DateiEintrag | null> {
  if (!DATEI_ID.test(id)) throw new AblageFehler('Unzulässige Kennung.', 400);
  let neu: DateiEintrag | null = null;
  let ohneBezug = false;
  await updateJson<AblageDatei>(ablageName(haushalt), cur => {
    const l = cur?.eintraege ?? [];
    return {
      eintraege: l.map(e => {
        if (e.id !== id) return e;
        const roh = { ...e, ...(felder && typeof felder === 'object' ? felder as Record<string, unknown> : {}), art: e.art };
        const m = metaSaeubern(roh);
        if (!hatBezug(m)) { ohneBezug = true; return e; }
        neu = { id: e.id, ...m, art: e.art, ...(e.datei ? { datei: e.datei } : {}), hochgeladenAm: e.hochgeladenAm, hochgeladenVon: e.hochgeladenVon, ...(e.dateiFehlt ? { dateiFehlt: e.dateiFehlt } : {}), geaendert: jetzt, geaendertVon: person };
        return neu;
      }),
    };
  });
  // Vom Bezug lösen geht nur, solange ein anderer Bezug bleibt — sonst wäre der Eintrag nirgends mehr zu finden.
  if (ohneBezug) throw new AblageFehler('Ohne Bezug wäre der Eintrag nirgends mehr zu finden — erst einen anderen Bezug setzen (z. B. Kontakt oder Firma).', 400);
  return neu;
}

/** Eintrag + entschlüsselter Inhalt — null, wenn es ihn nicht gibt oder er keine Datei hat. */
export async function lesen(haushalt: string, id: string): Promise<{ eintrag: DateiEintrag; bytes: Buffer } | null> {
  if (!DATEI_ID.test(id)) throw new AblageFehler('Unzulässige Kennung.', 400);
  const eintrag = (await ablageListe(haushalt)).find(e => e.id === id);
  if (!eintrag?.datei) return null;
  let roh: Buffer;
  try { roh = await fs.readFile(dateiPfad(haushalt, id)); }
  catch (e) { if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return null; throw e; }
  const bytes = istHuelle(roh) ? inhaltEntschluesseln(roh, datenSchluessel()) : roh;
  return { eintrag, bytes };
}

/** Eintrag und Datei entfernen. true, wenn es ihn gab. Belege (Rechnung/Mandat) → AblageFehler 409, nichts gelöscht. */
export async function entfernen(haushalt: string, id: string): Promise<boolean> {
  if (!DATEI_ID.test(id)) throw new AblageFehler('Unzulässige Kennung.', 400);
  let gab = false;
  let beleg = false;
  await updateJson<AblageDatei>(ablageName(haushalt), cur => {
    const l = cur?.eintraege ?? [];
    const e = l.find(x => x.id === id);
    gab = !!e;
    // In der Sperre geprüft: ein Beleg bleibt samt Datei.
    if (e && istBeleg(e)) { beleg = true; return cur ?? { eintraege: l }; }
    return { eintraege: l.filter(x => x.id !== id) };
  });
  if (beleg) throw new AblageFehler('Der Eintrag hängt an einer Rechnung oder einem Mandat und wird nicht gelöscht — erst vom Bezug lösen.', 409);
  await fs.unlink(dateiPfad(haushalt, id)).catch(() => {});
  return gab;
}
