// ─── Medien — Verschlüsselung je Segment, Schlüssel je Medium (09.10., Paket 5; Kevin: „auf unserem Server je Segment, Schlüssel je
// Medium, Hauptschlüssel verlässt nie den Server“) ─────────────────────────────────────────────────────────────────────────────
// Format eines Objekts im Medienspeicher (Muster age/STREAM, research/agenten/MEDIEN.md B4):
//   Kopf 16 Byte   „MKOSMED1“ + Segmentgröße (u32 BE) + 4 Byte frei
//   Segmente       je 64 KiB Klartext → AES-256-GCM, Chiffrat + 16 Byte Prüfwert; das letzte Segment darf kürzer sein
//   Nonce          Salz des Stücks (4 Byte, je Versuch neu) ‖ Segment-Nr. (7 Byte, BE) ‖ Letzt-Merker (1 Byte)
//   AAD            `make-os|medien|<medium>|<variante>` — ein vertauschtes, umbenanntes oder unter fremdem Medium abgelegtes Objekt
//                  öffnet sich nicht; Abschneiden fällt am Letzt-Merker auf, Umsortieren an der Segment-Nr.
// Ein Upload-Stück (8 MiB) = genau 128 Segmente — jedes Stück lässt sich einzeln verschlüsseln und als S3-Teil weiterreichen; Lesen
// eines Bereichs (Range, Safari-Player) entschlüsselt nur die nötigen Segmente.
//
// Schlüssel je Medium (DEK, 32 Byte Zufall), gewickelt mit dem AKTIVEN Datenschlüssel der Instanz (Schlüsselring lib/store/huelle.mjs,
// AES-256-GCM, AAD `make-os|medien-dek|<medium>`, `kid` dabei). Er steht nur im Katalog-Bestand (der selbst verschlüsselt liegt), nie im
// Browser, nie in einer Antwort, nie in einem Protokoll. Rotation: nur die DEKs neu wickeln (`schluesselNeuWickeln`, Rotation
// lib/store/umschluesseln.ts + täglich lib/medien/pflege.ts) — kein Video wird neu geschrieben. Ohne Datenschlüssel (lokale Entwicklung)
// steht der DEK ungewickelt (`kid: null`) — wie alle Bestände dort im Klartext; die Objekte sind trotzdem verschlüsselt.
// Rein bis auf Node-crypto — getestet in tests/medien-krypto.test.ts.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { schluesselRing, SchluesselFehlt, EntschluesselungFehlgeschlagen } from '@/lib/store/huelle.mjs';
import { GRENZEN, type GewickelterSchluessel } from './typen';

export { SchluesselFehlt, EntschluesselungFehlgeschlagen };

export const MAGIE = Buffer.from('MKOSMED1', 'ascii');
export const KOPF = 16;
export const SEGMENT = GRENZEN.segment;
export const PRUEF = 16;
export const SEGMENT_CHIFFRAT = SEGMENT + PRUEF;
export const SEGMENTE_JE_TEIL = GRENZEN.teil / SEGMENT; // 128

type Ring = ReturnType<typeof schluesselRing>;

const aad = (mediumId: string, variante: string) => Buffer.from(`make-os|medien|${mediumId}|${variante}`, 'utf8');
const dekAad = (mediumId: string) => Buffer.from(`make-os|medien-dek|${mediumId}`, 'utf8');

/** Wie viele Segmente hat ein Klartext dieser Länge? (mindestens eines) */
export const segmentAnzahl = (klar: number): number => Math.max(1, Math.ceil(klar / SEGMENT));
/** Länge des Objekts im Speicher für einen Klartext dieser Länge. */
export const objektGroesse = (klar: number): number => KOPF + segmentAnzahl(klar) * PRUEF + klar;

function kopf(): Buffer {
  const k = Buffer.alloc(KOPF);
  MAGIE.copy(k, 0);
  k.writeUInt32BE(SEGMENT, 8);
  return k;
}

function nonce(salz: Buffer, segment: number, letzt: boolean): Buffer {
  if (salz.length !== 4) throw new Error('Salz muss 4 Byte haben.');
  const n = Buffer.alloc(12);
  salz.copy(n, 0);
  n.writeUIntBE(Math.floor(segment / 2 ** 24), 4, 3); // Segment-Nr. als 7 Byte: hoch 3 …
  n.writeUIntBE(segment % 2 ** 24, 7, 3);             // … tief 3 (+ 1 Byte Rest unten bleibt 0 — reicht bis 2^48 Segmente)
  n[11] = letzt ? 1 : 0;
  return n;
}

/** Neues Salz für ein Stück (je Versuch neu — ein wiederholtes Stück bekommt nie dieselbe Nonce mit anderem Inhalt). */
export const neuesSalz = (): string => randomBytes(4).toString('hex');

// ── Schlüssel je Medium ────────────────────────────────────────────────────────────────────────────────────────────────

/** Neuer Schlüssel für ein Medium: roh (nur im Prozess) und gewickelt (für den Katalog). */
export function neuerSchluessel(mediumId: string, ring: Ring = schluesselRing()): { dek: Buffer; gewickelt: GewickelterSchluessel } {
  const dek = randomBytes(32);
  return { dek, gewickelt: wickeln(dek, mediumId, ring) };
}

function wickeln(dek: Buffer, mediumId: string, ring: Ring): GewickelterSchluessel {
  if (!ring.aktiv) return { kid: null, dek: dek.toString('base64') };
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', ring.aktiv.key, iv);
  c.setAAD(dekAad(mediumId));
  const ct = Buffer.concat([c.update(dek), c.final()]);
  return { kid: ring.aktiv.kid, dek: Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64') };
}

/** Gewickelten Schlüssel öffnen. Wirft SchluesselFehlt (kein passender Datenschlüssel) bzw. EntschluesselungFehlgeschlagen. */
export function schluesselOeffnen(g: GewickelterSchluessel, mediumId: string, ring: Ring = schluesselRing()): Buffer {
  const roh = Buffer.from(String(g?.dek ?? ''), 'base64');
  if (g?.kid === null) {
    if (roh.length !== 32) throw new EntschluesselungFehlgeschlagen('Medien-Schlüssel beschädigt.');
    return roh;
  }
  const s = ring.alle.find(x => x.kid === g?.kid);
  if (!s) throw new SchluesselFehlt(`Medien-Schlüssel mit einem anderen Datenschlüssel gewickelt (Schlüssel-ID ${String(g?.kid).slice(0, 12)}) — passt MAKE_OS_DATEN_SCHLUESSEL bzw. …_ALT?`);
  if (roh.length !== 12 + 16 + 32) throw new EntschluesselungFehlgeschlagen('Medien-Schlüssel beschädigt.');
  try {
    const d = createDecipheriv('aes-256-gcm', s.key, roh.subarray(0, 12));
    d.setAAD(dekAad(mediumId));
    d.setAuthTag(roh.subarray(12, 28));
    return Buffer.concat([d.update(roh.subarray(28)), d.final()]);
  } catch { throw new EntschluesselungFehlgeschlagen('Medien-Schlüssel lässt sich nicht öffnen — verändert oder zu einem anderen Medium?'); }
}

/** Ist der Schlüssel mit dem aktiven Datenschlüssel gewickelt? (Ohne Datenschlüssel: ungewickelt = aktuell.) */
export const schluesselAktuell = (g: GewickelterSchluessel, ring: Ring = schluesselRing()): boolean => (ring.aktiv ? g.kid === ring.aktiv.kid : g.kid === null);

/** Rotation: mit dem aktiven Datenschlüssel neu wickeln — `null`, wenn er schon aktuell ist. Wirft, wenn er sich nicht öffnen lässt. */
export function schluesselNeuWickeln(g: GewickelterSchluessel, mediumId: string, ring: Ring = schluesselRing()): GewickelterSchluessel | null {
  if (schluesselAktuell(g, ring)) return null;
  return wickeln(schluesselOeffnen(g, mediumId, ring), mediumId, ring);
}

// ── Stücke und Segmente ────────────────────────────────────────────────────────────────────────────────────────────────

export interface Ziel { mediumId: string; variante: string }

/**
 * Ein Upload-Stück verschlüsseln. `nr` = Stück-Nummer (0-basiert), `gesamt` = Klartext-Länge der ganzen Datei. Das erste Stück trägt den
 * Kopf. Jedes Stück außer dem letzten muss genau `GRENZEN.teil` lang sein.
 */
export function teilVerschluesseln(dek: Buffer, z: Ziel, nr: number, klar: Buffer, gesamt: number, salzHex: string): Buffer {
  const teile = Math.max(1, Math.ceil(gesamt / GRENZEN.teil));
  if (!Number.isInteger(nr) || nr < 0 || nr >= teile) throw new RangeError('Stück außerhalb der Datei.');
  const soll = Math.min(GRENZEN.teil, gesamt - nr * GRENZEN.teil);
  if (klar.length !== soll) throw new RangeError(`Stück ${nr} hat ${klar.length} statt ${soll} Byte.`);
  const salz = Buffer.from(salzHex, 'hex');
  const letztesSeg = segmentAnzahl(gesamt) - 1;
  const raus: Buffer[] = nr === 0 ? [kopf()] : [];
  const a = aad(z.mediumId, z.variante);
  for (let i = 0, seg = nr * SEGMENTE_JE_TEIL; i < Math.max(1, klar.length); i += SEGMENT, seg++) {
    const c = createCipheriv('aes-256-gcm', dek, nonce(salz, seg, seg === letztesSeg));
    c.setAAD(a);
    raus.push(c.update(klar.subarray(i, i + SEGMENT)), c.final(), c.getAuthTag());
    if (klar.length === 0) break;
  }
  return Buffer.concat(raus);
}

/** Eine kleine Datei (Vorschau, Poster, Beleg) am Stück: ein Stück, neues Salz. */
export function ganzVerschluesseln(dek: Buffer, z: Ziel, klar: Buffer): { bytes: Buffer; salz: string } {
  if (klar.length > GRENZEN.teil) throw new RangeError('Für ein Stück zu groß.');
  const salz = neuesSalz();
  return { bytes: teilVerschluesseln(dek, z, 0, klar, klar.length, salz), salz };
}

/** Welche Bytes des Objekts braucht der Klartext-Bereich [von, bis] (inklusive)? */
export function chiffratBereich(von: number, bis: number, gesamt: number): { von: number; bis: number; ersterSeg: number; letzterSeg: number } {
  if (!(von >= 0 && bis >= von && bis < gesamt)) throw new RangeError('Bereich außerhalb der Datei.');
  const ersterSeg = Math.floor(von / SEGMENT), letzterSeg = Math.floor(bis / SEGMENT);
  const ende = Math.min(objektGroesse(gesamt), KOPF + (letzterSeg + 1) * SEGMENT_CHIFFRAT);
  return { von: KOPF + ersterSeg * SEGMENT_CHIFFRAT, bis: ende - 1, ersterSeg, letzterSeg };
}

/**
 * Segmente entschlüsseln. `chiffrat` = die Bytes ab Segment `ersterSeg` (wie `chiffratBereich` sie liefert), `salze` = Salz je Stück,
 * `gesamt` = Klartext-Länge der Datei. Wirft EntschluesselungFehlgeschlagen bei jeder Veränderung (auch Abschneiden).
 */
export function segmenteEntschluesseln(dek: Buffer, z: Ziel, salze: readonly string[], gesamt: number, chiffrat: Buffer, ersterSeg: number): Buffer {
  const letztes = segmentAnzahl(gesamt) - 1;
  const a = aad(z.mediumId, z.variante);
  const raus: Buffer[] = [];
  let o = 0, seg = ersterSeg;
  while (o < chiffrat.length) {
    if (seg > letztes) throw new EntschluesselungFehlgeschlagen('Mehr Daten als die Datei hat.');
    const klarLaenge = seg === letztes ? gesamt - seg * SEGMENT : SEGMENT;
    const ende = o + klarLaenge + PRUEF;
    if (ende > chiffrat.length) throw new EntschluesselungFehlgeschlagen('Medium abgeschnitten.');
    const salzHex = salze[Math.floor(seg / SEGMENTE_JE_TEIL)];
    if (!salzHex) throw new EntschluesselungFehlgeschlagen('Salz des Stücks fehlt.');
    try {
      const d = createDecipheriv('aes-256-gcm', dek, nonce(Buffer.from(salzHex, 'hex'), seg, seg === letztes));
      d.setAAD(a);
      d.setAuthTag(chiffrat.subarray(ende - PRUEF, ende));
      raus.push(d.update(chiffrat.subarray(o, ende - PRUEF)), d.final());
    } catch { throw new EntschluesselungFehlgeschlagen('Medium lässt sich nicht öffnen — verändert, vertauscht oder falscher Schlüssel.'); }
    o = ende; seg++;
  }
  return Buffer.concat(raus);
}

/** Ein ganzes Objekt (Kopf + alle Segmente) entschlüsseln — für kleine Varianten. Prüft den Kopf. */
export function ganzEntschluesseln(dek: Buffer, z: Ziel, salze: readonly string[], gesamt: number, objekt: Buffer): Buffer {
  if (objekt.length !== objektGroesse(gesamt) || !objekt.subarray(0, 8).equals(MAGIE)) throw new EntschluesselungFehlgeschlagen('Kein Medien-Objekt bzw. falsche Länge.');
  return segmenteEntschluesseln(dek, z, salze, gesamt, objekt.subarray(KOPF), 0);
}

/** Klartext-Bereich [von, bis] aus den Segment-Bytes schneiden (die Segmente beginnen bei `ersterSeg * SEGMENT`). */
export const bereichSchneiden = (segmente: Buffer, von: number, bis: number, ersterSeg: number): Buffer =>
  segmente.subarray(von - ersterSeg * SEGMENT, bis - ersterSeg * SEGMENT + 1);

/** SHA-256 (hex). */
export const sha256 = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');
/** Prüfsumme der ganzen Datei = SHA-256 über die SHA-256 der Stücke (in Reihenfolge) — der Browser rechnet dasselbe. */
export function pruefsummeAusTeilen(teilHashes: readonly string[]): string {
  const h = createHash('sha256');
  for (const t of teilHashes) h.update(Buffer.from(t, 'hex'));
  return h.digest('hex');
}
