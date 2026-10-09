// ─── Hülle der Dateiablage (.bin), Schlüsselring und AAD (29.09., Paket D-C, Rest aus D-A #52/#54) ─
// Dateien der CRM- und Aufgaben-Ablage liegen unter <daten>/dateien/<haushalt>/<id>.bin. Zwei Fassungen:
//
//   v1 (28.09.)  „MKOSDAT1“ + IV (12) + Tag (16) + Chiffrat                   — ohne Schlüssel-ID, ohne AAD
//   v2 (29.09.)  „MKOSDAT2“ + Schlüssel-ID (12, ASCII-Hex) + IV (12) + Tag (16) + Chiffrat
//                AAD = `make-os|datei|<haushalt>/<id>` — eine vertauschte oder unter fremdem Namen/Haushalt abgelegte Datei
//                scheitert laut an der Prüfung (#54), statt still als fremde Unterlage geöffnet zu werden.
//
// Lesen über den Schlüsselring (lib/store/huelle.mjs): v2 nach Schlüssel-ID, v1 mit jedem Schlüssel des Rings (aktiv
// zuerst) — so bleiben Dateien während einer Rotation im laufenden Betrieb lesbar (#52; vorher nur der aktive Schlüssel).
// Geschrieben wird mit dem aktiven Schlüssel im Schreibformat MAKE_OS_FORMAT (huelle.mjs `formatModus`): kompatibel
// (Standard) = v1 „MKOSDAT1“ wie der alte Online-Stand aeb4964, v2 = „MKOSDAT2“. Bewusst .mjs: App (lib/dateien/ablage.ts,
// lib/store/umschluesseln.ts) UND Skripte (scripts/daten-verschluesselung.mjs, scripts/sicherung-pruefen.mjs) nutzen
// dieselbe Hülle. Typen: datei-huelle.d.mts.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { SchluesselFehlt, EntschluesselungFehlgeschlagen, schreibVersion } from './huelle.mjs';

export const MAGIE_V1 = Buffer.from('MKOSDAT1', 'ascii');
export const MAGIE_V2 = Buffer.from('MKOSDAT2', 'ascii');
const KID_LAENGE = 12;
const V1_KOPF = 8 + 12 + 16;
const V2_KOPF = 8 + KID_LAENGE + 12 + 16;

/** Welche Hülle trägt die Datei? 0 = keine (Klartext), 1 = v1, 2 = v2. */
export function binVersion(b) {
  if (!Buffer.isBuffer(b) && !(b instanceof Uint8Array)) return 0;
  const buf = Buffer.from(b.buffer, b.byteOffset, b.byteLength);
  if (buf.length >= V2_KOPF && buf.subarray(0, 8).equals(MAGIE_V2)) return 2;
  if (buf.length >= V1_KOPF && buf.subarray(0, 8).equals(MAGIE_V1)) return 1;
  return 0;
}

/**
 * Bilder-Ordner (05.10., lib/store/bild-ablage.ts): Fotos zu Gerichten und Bildschirmfotos im Bauplan — dieselbe Hülle,
 * AAD `make-os|datei|<ordner>/<name>` (binAad mit dem Ordner an der Stelle des Haushalts). Skripte stellen sie mit um.
 */
export const BILD_ORDNER = Object.freeze(['bilder-gerichte', 'bauplan-bilder', 'whatsapp-medien', 'zoe-whatsapp-medien', 'ki-medien', 'gesundheit-unterlagen']);
// `.bin` (07.10., WhatsApp): Medien der Business-Nummer (Bild, Dokument, Audio) unter einem Fingerabdruck-Namen (lib/whatsapp/medien.ts).
// `zoe-whatsapp-medien` (08.10.): Sprachnachrichten an die ZOE-Nummer — nur die Person selbst hört sie (lib/zoe-whatsapp/medien.ts).
// `ki-medien` (09.10., Anbieter-Tor): von der KI erzeugte Bilder und Videos (lib/ki/medien.ts) — Bytes UNVERÄNDERT (SynthID/C2PA bleiben).
// `gesundheit-unterlagen` (09.10.): Gesundheits-Unterlagen je Person (Art. 9; lib/gesundheit/unterlagen-server.ts, Name `gu-<uuid>.bin`) — nur die Person selbst.
export const BILD_NAME = /^[a-z0-9-]{8,60}\.(jpg|png|webp|bin)$/;

/** AAD je Datei: Haushalt + Kennung. */
export const binAad = (haushalt, id) => Buffer.from(`make-os|datei|${haushalt}/${id}`, 'utf8');

/** Haushalt und Kennung aus einem Pfad `…/dateien/<haushalt>/<id>.bin` (für Skripte). */
export function binAusPfad(pfad) {
  const m = /[\\/]dateien[\\/]([a-z0-9][a-z0-9-]{0,63})[\\/](d-[a-z0-9-]+)\.bin$/.exec(String(pfad));
  return m ? { haushalt: m[1], id: m[2] } : null;
}

/** Inhalt → v2-Hülle mit dem Schlüssel `{ kid, key }` (aktiv) und der AAD der Datei. */
export function binSchreiben(klar, schluessel, haushalt, id) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', schluessel.key, iv);
  c.setAAD(binAad(haushalt, id));
  const enc = Buffer.concat([c.update(klar), c.final()]);
  return Buffer.concat([MAGIE_V2, Buffer.from(String(schluessel.kid).padEnd(KID_LAENGE, '0').slice(0, KID_LAENGE), 'ascii'), iv, c.getAuthTag(), enc]);
}

/** Nur Altformat/Tests: v1-Hülle mit einem Schlüssel (ohne Schlüssel-ID, ohne AAD). */
export function binV1Schreiben(klar, key) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(klar), c.final()]);
  return Buffer.concat([MAGIE_V1, iv, c.getAuthTag(), enc]);
}

/** Inhalt → Hülle im aktuellen Schreibformat (kompatibel = v1 „MKOSDAT1“, v2 = „MKOSDAT2“ mit Schlüssel-ID + AAD). */
export function binImModus(klar, schluessel, haushalt, id, env = process.env) {
  return schreibVersion(env) === 2 ? binSchreiben(klar, schluessel, haushalt, id) : binV1Schreiben(klar, schluessel.key);
}

/** Liegt eine geöffnete Datei (Ergebnis von binOeffnen) schon im aktuellen Format mit dem aktiven Schlüssel? */
export function binAktuell(geoeffnet, aktiv, env = process.env) {
  return !!aktiv && geoeffnet.version === schreibVersion(env) && geoeffnet.kid === aktiv.kid;
}

function oeffne(key, iv, tag, daten, aad) {
  const d = createDecipheriv('aes-256-gcm', key, iv);
  if (aad) d.setAAD(aad);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(daten), d.final()]);
}

/**
 * Hülle → Inhalt über den Ring. v2: Schlüssel nach ID, mit AAD (Haushalt/Kennung); v1: alle Schlüssel des Rings.
 * Wirft SchluesselFehlt (kein passender Schlüssel) bzw. EntschluesselungFehlgeschlagen (Tag/AAD passt nicht).
 * @returns {{ klar: Buffer, version: 1 | 2, kid: string }}
 */
export function binOeffnen(b, ring, haushalt, id) {
  const v = binVersion(b);
  if (!v) throw new TypeError('keine Hülle');
  if (!ring.alle.length) throw new SchluesselFehlt('Die Datei ist verschlüsselt, der Datenschlüssel fehlt.');
  if (v === 2) {
    const kid = b.subarray(8, 8 + KID_LAENGE).toString('ascii');
    const s = ring.alle.find(x => x.kid === kid);
    if (!s) throw new SchluesselFehlt(`Datei mit einem anderen Schlüssel verschlüsselt (Schlüssel-ID ${kid}) — passt MAKE_OS_DATEN_SCHLUESSEL bzw. …_ALT?`);
    const o = 8 + KID_LAENGE;
    try { return { klar: oeffne(s.key, b.subarray(o, o + 12), b.subarray(o + 12, o + 28), b.subarray(o + 28), binAad(haushalt, id)), version: 2, kid: s.kid }; }
    catch { throw new EntschluesselungFehlgeschlagen(`Datei nicht lesbar — verändert oder unter falschem Namen (${haushalt}/${id})?`); }
  }
  for (const s of ring.alle) {
    try { return { klar: oeffne(s.key, b.subarray(8, 20), b.subarray(20, 36), b.subarray(36), null), version: 1, kid: s.kid }; } catch { /* nächster Schlüssel */ }
  }
  throw new EntschluesselungFehlgeschlagen('Datei nicht lesbar — falscher Schlüssel oder verändert.');
}
