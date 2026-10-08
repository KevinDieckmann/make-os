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
// Dateien können nicht mit MKOSDAT1 beginnen (Typprüfung am Inhalt: PDF/PNG/JPG/DOCX; bei den
// Aufgaben-Dateien lehnt `aufgabenTypErkennen` Text, der mit MKOSDAT beginnt, ausdrücklich ab).
// Seit 29.09. (Paket D-C): Hülle v2 „MKOSDAT2“ mit Schlüssel-ID und AAD (Haushalt/Kennung) — lib/store/datei-huelle.mjs.
// Geschrieben wird nach MAKE_OS_FORMAT (29.09. abends): kompatibel (Standard) = „MKOSDAT1“ wie der alte Online-Stand
// aeb4964 (der „MKOSDAT2“ nicht lesen kann), v2 = „MKOSDAT2“. Gelesen wird über den Schlüsselring (v1 und v2, aktiver
// UND alte Schlüssel), damit
// eine Rotation im laufenden Betrieb keine Datei kurz unlesbar macht. Kennungen `d-<uuid>` (ohne Zeitanteil).
// Der Inhalt selbst (Schreiben/Lesen/Entfernen) liegt in `inhaltAblegen`/`inhaltLaden`/`inhaltEntfernen` —
// dieselben Wege nutzt die Aufgaben-Ablage (lib/dateien/aufgaben-ablage.ts, 28.09. C2): gleicher Ordner,
// gleiche Hülle, eigener Metadaten-Bestand `aufgaben-dateien--<haushalt>`.
//
// Sicherheit: Kennungen nur `d-[a-z0-9-]`, Haushalt nur HAUSHALT_OK — kein Pfad
// kommt durch; zusätzlich wird geprüft, dass der Pfad im Haushaltsordner liegt.
// Dateien 0600, Ordner 0700, Schreiben über tmp + rename. Zugang regelt die Route
// (Default-Deny, Haushalt des Inhabers). Die CRM-Ablage geht nie an KI/Agenten.

import { promises as fs } from 'fs';
import { atomarSchreiben } from '@/lib/store/atomar.mjs';
import path from 'path';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { datenOrdner, loadJson, updateJson } from '@/lib/store/local-db';
import { schluesselRing, SchluesselFehlt } from '@/lib/store/huelle.mjs';
import { binOeffnen, binImModus, binVersion } from '@/lib/store/datei-huelle.mjs';
import { neueKennung } from '@/lib/kennung';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import type { Kontakt } from '@/lib/make-one/crm';
import { einwilligungenMitBeleg, belegGesperrtText } from './einwilligung-beleg';
import { DATEI_ID, MAX_EINTRAEGE, hatBezug, istBeleg, metaSaeubern, type DateiEintrag, type DateiInfo, type FesteBezuege } from './regeln';

const MAGIE = Buffer.from('MKOSDAT1', 'ascii');

export class AblageFehler extends Error { constructor(msg: string, readonly status: number) { super(msg); } }

export const ablageName = (haushalt: string) => {
  if (!HAUSHALT_OK.test(haushalt)) throw new AblageFehler('Unzulässiger Haushalt.', 400);
  return `crm-dateien--${haushalt}`;
};

export function haushaltOrdner(haushalt: string): string {
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

/** Liegt die Datei als Hülle auf der Platte (v1 „MKOSDAT1“ oder v2 „MKOSDAT2“)? */
export const istHuelle = (b: Buffer) => binVersion(b) > 0;

/** Nur Altformat (v1) und Tests: Inhalt → Hülle v1 (MAGIE + IV + Tag + Chiffrat). Neue Dateien: `inhaltAblegen` (v2). */
export function inhaltVerschluesseln(klar: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(klar), c.final()]);
  return Buffer.concat([MAGIE, iv, c.getAuthTag(), enc]);
}
/** Nur Altformat (v1) und Tests: Hülle v1 → Inhalt mit EINEM Schlüssel. Gelesen wird sonst über `inhaltLaden` (Ring, v1+v2). */
export function inhaltEntschluesseln(huelle: Buffer, key: Buffer | null): Buffer {
  if (binVersion(huelle) !== 1) throw new AblageFehler('Datei ist keine verschlüsselte Ablage (v1).', 500);
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

/** Kennung einer Datei: `d-<uuid>` (Paket D-C: ohne Zeitanteil, lib/kennung.ts). */
export const neueDateiId = () => neueKennung('d');

export interface NeueDatei { bytes: Buffer; name: string; typ: DateiInfo['typ'] }

/**
 * Inhalt ablegen: verschlüsselt (wenn ein Datenschlüssel da ist), 0600 im Ordner 0700 — atomar UND dauerhaft über
 * `atomarSchreiben` (29.09.: tmp → fsync → rename → Ordner-fsync, wie local-db; vorher ohne fsync, nach einem Stromausfall
 * konnte eine leere/halbe .bin unter dem richtigen Namen stehen). Liefert, ob verschlüsselt abgelegt wurde.
 * Geteilt mit der Aufgaben-Ablage.
 */
export async function inhaltAblegen(haushalt: string, id: string, bytes: Buffer): Promise<boolean> {
  const aktiv = schluesselRing().aktiv;
  const ordner = haushaltOrdner(haushalt);
  await fs.mkdir(ordner, { recursive: true, mode: 0o700 });
  // Format des Modus: kompatibel „MKOSDAT1“ (alter Stand lesbar), v2 „MKOSDAT2“ mit Schlüssel-ID + AAD (Haushalt/Kennung) —
  // dann öffnet sich eine unter anderem Namen/Haushalt abgelegte Datei nicht.
  await atomarSchreiben(dateiPfad(haushalt, id), aktiv ? binImModus(bytes, aktiv, haushalt, id) : bytes);
  return !!aktiv;
}
/** Inhalt lesen (Hülle v1/v2 → über den Schlüsselring entschlüsselt, sonst wie abgelegt) — null, wenn die Datei fehlt. */
export async function inhaltLaden(haushalt: string, id: string): Promise<Buffer | null> {
  let roh: Buffer;
  try { roh = await fs.readFile(dateiPfad(haushalt, id)); }
  catch (e) { if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return null; throw e; }
  if (!binVersion(roh)) return roh;
  try { return binOeffnen(roh, schluesselRing(), haushalt, id).klar; }
  catch (e) {
    if (e instanceof SchluesselFehlt) throw new AblageFehler('Die Datei ist verschlüsselt, der passende Datenschlüssel fehlt.', 503);
    throw new AblageFehler('Datei nicht lesbar — falscher Schlüssel oder verändert.', 500);
  }
}
/** Inhalt entfernen (fehlt er schon, ist das kein Fehler). */
export async function inhaltEntfernen(haushalt: string, id: string): Promise<void> {
  await fs.unlink(dateiPfad(haushalt, id)).catch(() => {});
}

/**
 * Ablegen: erst die Datei (verschlüsselt, tmp + rename), dann der Eintrag. Scheitert
 * der Eintrag, wird die Datei wieder entfernt — keine verwaisten Inhalte.
 */
export async function ablegen(haushalt: string, person: string, metaRoh: unknown, datei: NeueDatei | null, jetzt = new Date().toISOString(), feste: FesteBezuege = {}): Promise<DateiEintrag> {
  // Feste Bezüge (Angebots-PDF, Rechnungs-PDF, Logo einer Gesellschaft) kommen nur vom Server-Aufrufer, nie aus dem Netz.
  const rechnungsPdf = feste.rechnungsPdf && /^[a-z0-9][a-z0-9-]{1,39}$/.test(feste.rechnungsPdf) ? feste.rechnungsPdf : undefined;
  const meta = { ...metaSaeubern(metaRoh), ...(feste.angebotId && /^[a-z0-9][a-z0-9-]{1,63}$/.test(feste.angebotId) ? { angebotId: feste.angebotId } : {}), ...(rechnungsPdf ? { rechnungsPdf, rechnungId: rechnungsPdf } : {}), ...(feste.gesellschaft ? { gesellschaft: feste.gesellschaft } : {}) };
  if (!meta.art) throw new AblageFehler('Art fehlt (vertrag, angebot, rechnung, sonstig).', 400);
  if (!hatBezug(meta)) throw new AblageFehler('Bezug fehlt (Kontakt, Firma, Mandat, Deal oder Rechnung).', 400);
  if (!datei && meta.art !== 'angebot') throw new AblageFehler('Datei fehlt.', 400);
  if (!datei && meta.art === 'angebot' && !meta.titel && !meta.angebot?.nummer && meta.angebot?.betrag == null) throw new AblageFehler('Angebot ohne Datei braucht Nummer, Titel oder Betrag.', 400);
  const id = neueDateiId();
  let info: DateiInfo | undefined;
  let pfad: string | null = null;
  if (datei) {
    const verschluesselt = await inhaltAblegen(haushalt, id, datei.bytes);
    pfad = dateiPfad(haushalt, id);
    info = { name: datei.name, typ: datei.typ, groesse: datei.bytes.length, verschluesselt };
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
        // Feste Bezüge (Angebot, Gesellschaft) bleiben, wie der Server sie setzte — ein PATCH ändert sie nie.
        // Rechnungs-PDF (08.10.): Bezug zur Rechnung bleibt fest — eine Geschäftsunterlage wird nie „vom Bezug gelöst“.
        const m = { ...metaSaeubern(roh), ...(e.angebotId ? { angebotId: e.angebotId } : {}), ...(e.rechnungsPdf ? { rechnungsPdf: e.rechnungsPdf, rechnungId: e.rechnungsPdf } : {}), ...(e.gesellschaft ? { gesellschaft: e.gesellschaft } : {}) };
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
  const bytes = await inhaltLaden(haushalt, id);
  return bytes ? { eintrag, bytes } : null;
}

/**
 * Eintrag und Datei entfernen. true, wenn es ihn gab. Belege (Rechnung/Mandat/Angebot) → AblageFehler 409, nichts gelöscht.
 * Seit 28.09. abends (W10) ebenso: die Datei ist der Beleg einer Einwilligung (`belegRef` = d-…, auch widerrufen) —
 * der Nachweis nach Art. 7 Abs. 1 DSGVO muss bleiben.
 */
export async function entfernen(haushalt: string, id: string): Promise<boolean> {
  if (!DATEI_ID.test(id)) throw new AblageFehler('Unzulässige Kennung.', 400);
  const einwilligungen = einwilligungenMitBeleg((await loadJson<{ kontakte?: Kontakt[] }>('kontakte'))?.kontakte ?? [], id);
  if (einwilligungen.anzahl) throw new AblageFehler(belegGesperrtText(einwilligungen.anzahl), 409);
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
  if (beleg) throw new AblageFehler('Der Eintrag hängt an einer Rechnung, einem Mandat oder einem gestellten Angebot und wird nicht gelöscht — Rechnung/Mandat erst vom Bezug lösen; Angebots-PDFs sind Geschäftsunterlagen.', 409);
  // Nur, wenn es den Eintrag HIER gab: im selben Ordner liegen auch die Projekt-/Aufgaben-Dateien (C2, eigener Bestand).
  if (gab) await inhaltEntfernen(haushalt, id);
  return gab;
}
