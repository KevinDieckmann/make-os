// ─── Verschlüsselungs-Hülle der Bestände, Schlüsselring (29.09., Paket D-A #52/#54/#55/#50) ─
// Auf der Platte liegt je Bestand eine AES-256-GCM-Hülle. Zwei Fassungen:
//
//   v1 (26.09.)  { __verschluesselt: 1, iv, tag, daten }              — ohne Schlüssel-ID, ohne AAD
//   v2 (29.09.)  { __verschluesselt: 2, kid, iv, tag, daten }         — Schlüssel-ID + AAD
//
// AAD (Additional Authenticated Data) = `make-os|2|<bestand>`: der Bestandsname trägt den
// Haushalt (`haushalt--<id>`, `crm-dateien--<id>` …) und die Formatversion. Eine vertauschte
// oder unter fremdem Namen zurückgespielte Datei scheitert damit laut an der Prüfung, statt
// still als fremder Bestand gelesen zu werden (#54). Gelesen werden immer beide Fassungen.
//
// Geschrieben wird nach dem Schreibformat MAKE_OS_FORMAT (29.09. abends, „Kompatibilitätsmodus“):
//   kompatibel (Standard, auch ohne Variable)  v1 — genau das Format des alten Online-Stands (aeb4964). Eine gelesene
//                                              v2-Hülle wird beim nächsten Schreiben wieder v1. So bleibt der Rückweg
//                                              zum alten Stand offen (er kennt v2 nicht und läse es still als Klartext).
//   v2                                         v2 mit Schlüssel-ID und AAD. Danach geht es zurück nur per Sicherung.
// Umstellen: `.env` MAKE_OS_FORMAT=v2 + `docker compose up -d` (DEPLOY.md, NOTFALL.md). Die Dateiablage
// (datei-huelle.mjs), das Archiv, die Rotation und scripts/daten-verschluesselung.mjs richten sich nach demselben Schalter.
//
// Schlüsselring (#52): der aktive Schlüssel verschlüsselt, alle bekannten entschlüsseln. So lässt
// sich im laufenden Betrieb rotieren — alter und neuer Schlüssel zugleich lesbar, Bestand für
// Bestand umschlüsseln, nie Klartext auf der Platte (scripts/datenschluessel-rotieren-live.mjs).
//
// Woher die Geheimnisse kommen (#50 — Datei 0400 statt Umgebung empfohlen):
//   aktiv:  MAKE_OS_DATEN_SCHLUESSEL (Umgebung), sonst MAKE_OS_DATEN_SCHLUESSEL_DATEI (Datei, wenn lesbar).
//           Die Umgebung gewinnt, damit ein ausdrückliches `-e MAKE_OS_DATEN_SCHLUESSEL=…` (deploy/datenschluessel-
//           rotieren.sh) immer gilt; wer auf die Datei umstellt, nimmt die Zeile aus der .env (DEPLOY.md, NOTFALL.md).
//   alt:    MAKE_OS_DATEN_SCHLUESSEL_ALT_DATEI und/oder MAKE_OS_DATEN_SCHLUESSEL_ALT (nur lesen)
// Die Datei wird höchstens alle 30 s neu gelesen (schluesselNeuLaden() erzwingt es sofort).
//
// Bewusst .mjs: App (lib/store/local-db.ts, archiv.ts) UND Skripte (scripts/*.mjs) nutzen dieselbe
// Hülle — eine zweite Kopie der Kryptografie wäre die nächste Fehlerquelle. Typen: huelle.d.mts.

import { readFileSync, statSync } from 'node:fs';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const HUELLE = '__verschluesselt';
export const HUELLE_VERSION = 2;

/** Das Schreibformat: 'v2' nur ausdrücklich, alles andere (auch ohne Variable) = 'kompatibel'. */
export function formatModus(env = process.env) {
  return String(env.MAKE_OS_FORMAT ?? '').trim().toLowerCase() === 'v2' ? 'v2' : 'kompatibel';
}
/** Steht in MAKE_OS_FORMAT ein Wert, den es nicht gibt (Tippfehler)? Dann gilt kompatibel — der HOI sagt es. */
export function formatModusUnbekannt(env = process.env) {
  const w = String(env.MAKE_OS_FORMAT ?? '').trim().toLowerCase();
  return w !== '' && w !== 'v2' && w !== 'kompatibel';
}
/** Die Hüllen-Fassung, die im aktuellen Modus geschrieben wird (1 = kompatibel, 2 = v2). */
export const schreibVersion = (env = process.env) => (formatModus(env) === 'v2' ? 2 : 1);

export class SchluesselFehlt extends Error {}
export class EntschluesselungFehlgeschlagen extends Error {}

/** Aus dem Geheimnis: AES-Schlüssel (wie seit 26.09.) und eine Schlüssel-ID, die nichts über den Schlüssel verrät. */
export function schluesselAus(geheim) {
  const g = String(geheim).trim();
  return {
    kid: createHash('sha256').update(`make-os-kid:${g}`).digest('hex').slice(0, 12),
    key: createHash('sha256').update(`make-os-daten:${g}`).digest(),
  };
}

const DATEI_TTL_MS = 30_000;
const dateiCache = new Map(); // pfad → { zeit, mtimeMs, text }

function ausDatei(pfad) {
  if (!pfad) return '';
  const jetzt = Date.now();
  const c = dateiCache.get(pfad);
  if (c && jetzt - c.zeit < DATEI_TTL_MS) return c.text;
  try {
    const st = statSync(pfad);
    const text = c && c.mtimeMs === st.mtimeMs ? c.text : readFileSync(pfad, 'utf8').trim();
    dateiCache.set(pfad, { zeit: jetzt, mtimeMs: st.mtimeMs, text });
    return text;
  } catch {
    dateiCache.set(pfad, { zeit: jetzt, mtimeMs: -1, text: '' });
    return '';
  }
}

/** Datei-Schlüssel sofort neu lesen (Rotation im laufenden Betrieb). */
export function schluesselNeuLaden() { dateiCache.clear(); }

/** Wo der aktive Schlüssel herkommt — für den Head of IT (nie der Wert). */
export function schluesselQuelle(env = process.env) {
  if (env.MAKE_OS_DATEN_SCHLUESSEL?.trim()) return 'umgebung';
  if (env.MAKE_OS_DATEN_SCHLUESSEL_DATEI && ausDatei(env.MAKE_OS_DATEN_SCHLUESSEL_DATEI)) return 'datei';
  return 'keiner';
}

const ringCache = new Map(); // Geheimnisse (verkettet) → Ring — abgeleitet wird nur einmal je Stand

/** Aktiver Schlüssel + alle lesbaren (aktiv zuerst). Ohne Geheimnis: aktiv = null, alle = []. */
export function schluesselRing(env = process.env) {
  const aktivGeheim = (env.MAKE_OS_DATEN_SCHLUESSEL ?? '').trim() || ausDatei(env.MAKE_OS_DATEN_SCHLUESSEL_DATEI);
  const alt = [ausDatei(env.MAKE_OS_DATEN_SCHLUESSEL_ALT_DATEI), ...String(env.MAKE_OS_DATEN_SCHLUESSEL_ALT ?? '').split(',')]
    .map(s => s.trim()).filter(Boolean);
  const merk = [aktivGeheim, ...alt].join('\u0000');
  const c = ringCache.get(merk);
  if (c) return c;
  const aktiv = aktivGeheim ? schluesselAus(aktivGeheim) : null;
  const alle = [];
  for (const s of [...(aktiv ? [aktiv] : []), ...alt.map(schluesselAus)]) if (!alle.some(x => x.kid === s.kid)) alle.push(s);
  const ring = { aktiv, alle };
  if (ringCache.size > 16) ringCache.clear();
  ringCache.set(merk, ring);
  return ring;
}

/** AAD je Bestand: Formatversion + Bestandsname (trägt den Haushalt). */
export const aadFuer = bestand => Buffer.from(`make-os|${HUELLE_VERSION}|${bestand}`, 'utf8');

/**
 * Gleichwertige Bestandsnamen für die AAD (29.09., Go-Live-Prüfung): ZOE hieß bis 27.09. Jarvis. Eine v2-Hülle, die noch
 * unter `jarvis-…` verschlüsselt wurde (scripts/daten-verschluesselung.mjs vor der Umbenennung), muss unter `zoe-…` lesbar
 * bleiben — und umgekehrt (verwaiste `jarvis-…`-Datei, die das Skript schon mit dem Zielnamen verschlüsselt hat).
 * Nur diese eine feste Umbenennung, kein freies Raten: eine unter einem ANDEREN Namen zurückgespielte Datei scheitert weiter.
 */
export function aadAlternativen(bestand) {
  const b = String(bestand);
  if (/^zoe(-|$)/.test(b)) return [b.replace(/^zoe/, 'jarvis')];
  if (/^jarvis(-|$)/.test(b)) return [b.replace(/^jarvis/, 'zoe')];
  return [];
}

/** Welche Hülle ist das? 0 = keine (Klartext), 1 = v1, 2 = v2. */
export function huellenVersion(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return 0;
  return o[HUELLE] === 1 ? 1 : o[HUELLE] === 2 ? 2 : 0;
}

/** Text → v2-Hülle (JSON-Text) mit Schlüssel-ID und AAD des Bestands. */
export function huelleSchreiben(text, schluessel, bestand) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', schluessel.key, iv);
  c.setAAD(aadFuer(bestand));
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return JSON.stringify({ [HUELLE]: HUELLE_VERSION, kid: schluessel.kid, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), daten: enc.toString('base64') });
}

/** v1-Hülle mit einem Schlüssel (Altformat; nur noch für Kompatibilität/Tests). */
export function huelleV1Schreiben(text, key) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return JSON.stringify({ [HUELLE]: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), daten: enc.toString('base64') });
}

function oeffne(o, key, aad) {
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(String(o.iv), 'base64'));
  if (aad) d.setAAD(aad);
  d.setAuthTag(Buffer.from(String(o.tag), 'base64'));
  return Buffer.concat([d.update(Buffer.from(String(o.daten), 'base64')), d.final()]).toString('utf8');
}

/**
 * Hülle (bereits geparst) → Klartext. v2: Schlüssel nach `kid`, mit AAD des Bestands.
 * v1: alle Schlüssel des Rings der Reihe nach (aktiv zuerst), ohne AAD.
 * Passt die AAD des Namens nicht, wird der gleichwertige Altname versucht (aadAlternativen: jarvis ↔ zoe) — dann trägt
 * das Ergebnis `aadAlt` (der Name, unter dem die Hülle wirklich verschlüsselt ist); der Aufrufer sollte neu schreiben.
 * Wirft SchluesselFehlt (kein passender Schlüssel im Ring) bzw. EntschluesselungFehlgeschlagen (Tag/AAD passt nicht).
 * @returns {{ text: string, version: 1 | 2, kid: string | null, aadAlt?: string }}
 */
export function huelleOeffnen(o, ring, bestand) {
  const v = huellenVersion(o);
  if (!v) throw new TypeError('keine Hülle');
  if (!ring.alle.length) throw new SchluesselFehlt('Der Bestand ist verschlüsselt, MAKE_OS_DATEN_SCHLUESSEL fehlt.');
  if (v === 2) {
    const s = ring.alle.find(x => x.kid === o.kid);
    if (!s) throw new SchluesselFehlt(`Entschlüsselung nicht möglich: der Bestand ist mit einem anderen Schlüssel verschlüsselt (Schlüssel-ID ${String(o.kid).slice(0, 12)}) — passt MAKE_OS_DATEN_SCHLUESSEL bzw. …_ALT?`);
    try { return { text: oeffne(o, s.key, aadFuer(bestand)), version: 2, kid: s.kid }; }
    catch { /* gleich: gleichwertiger Altname */ }
    for (const alt of aadAlternativen(bestand)) {
      try { return { text: oeffne(o, s.key, aadFuer(alt)), version: 2, kid: s.kid, aadAlt: alt }; } catch { /* nächster */ }
    }
    throw new EntschluesselungFehlgeschlagen(`Entschlüsselung fehlgeschlagen — Datei verändert oder unter falschem Namen (${bestand})?`);
  }
  for (const s of ring.alle) {
    try { return { text: oeffne(o, s.key, null), version: 1, kid: s.kid }; } catch { /* nächster Schlüssel */ }
  }
  throw new EntschluesselungFehlgeschlagen('Entschlüsselung fehlgeschlagen — stimmt MAKE_OS_DATEN_SCHLUESSEL?');
}

/** Text → Hülle im aktuellen Schreibformat: kompatibel = v1 (ohne Schlüssel-ID/AAD, wie aeb4964), v2 = mit AAD des Bestands. */
export function huelleImModus(text, schluessel, bestand, env = process.env) {
  return schreibVersion(env) === 2 ? huelleSchreiben(text, schluessel, bestand) : huelleV1Schreiben(text, schluessel.key);
}

/**
 * Liegt die (geparste) Hülle schon so, wie der aktuelle Modus schreiben würde — richtige Fassung, aktiver Schlüssel und
 * (v2) richtige AAD? Dann muss eine Umstellung (Rotation, Skript) sie nicht anfassen. Wirft wie huelleOeffnen, wenn sie
 * sich nicht öffnen lässt.
 */
export function huelleAktuell(o, ring, bestand, env = process.env) {
  const v = huellenVersion(o);
  if (!v || !ring.aktiv || v !== schreibVersion(env)) return false;
  if (v === 2) return o.kid === ring.aktiv.kid && (!aadAlternativen(bestand).length || !huelleOeffnen(o, ring, bestand).aadAlt);
  return huelleOeffnen(o, ring, bestand).kid === ring.aktiv.kid; // v1 trägt keine Schlüssel-ID: welcher Schlüssel öffnet?
}
