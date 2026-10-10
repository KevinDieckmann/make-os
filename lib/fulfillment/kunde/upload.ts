// ─── Fulfillment · Kunde — Unterlagen hochladen: Typ am Inhalt, Grenzen, Metadaten weg (rein; C2, 10.10.; FULFILLMENT_KONZEPT.md 5.4) ──────────────
// Kevin 23:25: „nur sichere Dateitypen (PDF, Bilder, Office ohne Makros, am INHALT geprüft wie die Aufgaben-Ablage), nie öffnen/ausführen, verschlüsselt
// ablegen, nur als Download — kein Virenscanner“. Deshalb:
//   · Typ NUR am Inhalt über `aufgabenTypErkennen` (lib/dateien/aufgaben-regeln.ts) und dann eingeschränkt auf PDF, PNG, JPG, WEBP, HEIC, DOCX, XLSX,
//     PPTX — Office mit Makro-Projekt erkennt jene Regel schon als „kein Office“. CSV/TXT/MD, SVG, ZIP, ausführbare Dateien: nie (415).
//   · Bilder ohne Exif/GPS/XMP: JPEG/PNG über lib/netzwerken/bild-bereinigen.ts; WEBP (RIFF-Teile EXIF/XMP raus, Merker im VP8X gelöscht) und HEIC
//     (Inhalt der Exif-/XMP-Elemente laut `iloc` mit Nullen überschrieben — Aufbau und Versätze bleiben) hier. Kaputter Aufbau → null (415).
//   · Grenzen: je Datei 25 MB, je Link höchstens 20 Dateien und 200 MB (FU §7 S2) — darüber 413, nie gekürzt.
// Abgelegt wird über lib/store/bild-ablage.ts (Ordner `fulfillment-unterlagen`, verschlüsselt, AAD = Ordner/Name) — das macht der Server.

import { aufgabenTypErkennen, type AufgabenDateiTyp } from '@/lib/dateien/aufgaben-regeln';
import { jpegOhneMetadaten, pngOhneMetadaten } from '@/lib/netzwerken/bild-bereinigen';

export const KUNDE_TYPEN = [
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const satisfies readonly AufgabenDateiTyp[];
export type KundeDateiTyp = (typeof KUNDE_TYPEN)[number];
/** Für das `accept` des Datei-Felds (nur ein Hinweis an den Browser — entschieden wird am Inhalt). */
export const KUNDE_ANNEHMEN = '.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.docx,.xlsx,.pptx';
export const KUNDE_TYPEN_TEXT = 'PDF, Bilder (PNG, JPG, WEBP, HEIC), Word, Excel oder PowerPoint ohne Makros';

export const UPLOAD_GRENZEN = { dateiBytes: 25 * 1024 * 1024, dateienJeLink: 20, bytesJeLink: 200 * 1024 * 1024 } as const;
/** Umschlag des multipart-Körpers (Grenzen, Feldnamen, Stempel) — großzügig, aber begrenzt. */
export const UMSCHLAG_BYTES = 64 * 1024;

/** Typ am Inhalt — nur die sicheren Typen der Kunden-Ablage, sonst null (415). */
export function kundeTypErkennen(name: string, b: Uint8Array): KundeDateiTyp | null {
  const t = aufgabenTypErkennen(name, b);
  return t && (KUNDE_TYPEN as readonly string[]).includes(t) ? (t as KundeDateiTyp) : null;
}

/** Wie viele Dateien/Bytes gehen über diesen Link noch? (bisherige Uploads des Links) */
export function uploadFrei(bisher: readonly { groesse: number }[]): { dateien: number; bytes: number } {
  return {
    dateien: Math.max(0, UPLOAD_GRENZEN.dateienJeLink - bisher.length),
    bytes: Math.max(0, UPLOAD_GRENZEN.bytesJeLink - bisher.reduce((s, u) => s + (u.groesse || 0), 0)),
  };
}

// ── WEBP (RIFF) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const u32le = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...Array.from(b.subarray(o, o + n)));

/** WEBP ohne EXIF- und XMP-Teil; Merker im VP8X werden gelöscht. Dieselben Bytes (===), wenn nichts zu entfernen war; null bei kaputtem Aufbau. */
export function webpOhneMetadaten(b: Uint8Array): Uint8Array | null {
  if (b.length < 12 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return null;
  const ende = Math.min(b.length, 8 + u32le(b, 4));
  const teile: Uint8Array[] = [];
  let o = 12, entfernt = false, vp8x = -1, laenge = 4;
  while (o < ende) {
    if (o + 8 > ende) return null;
    const art = ascii(b, o, 4);
    const groesse = u32le(b, o + 4);
    const gesamt = 8 + groesse + (groesse & 1);
    if (o + 8 + groesse > ende) return null;
    if (art === 'EXIF' || art === 'XMP ') { entfernt = true; o += gesamt; continue; }
    const stueck = b.slice(o, Math.min(o + gesamt, ende));
    if (art === 'VP8X') vp8x = teile.length;
    teile.push(stueck);
    laenge += stueck.length;
    o += gesamt;
  }
  if (!entfernt) return b;
  if (vp8x >= 0 && teile[vp8x].length > 8) teile[vp8x][8] &= ~0x0c; // Merker EXIF (0x08) und XMP (0x04)
  const raus = new Uint8Array(8 + laenge);
  raus.set([0x52, 0x49, 0x46, 0x46], 0);
  raus[4] = laenge & 0xff; raus[5] = (laenge >>> 8) & 0xff; raus[6] = (laenge >>> 16) & 0xff; raus[7] = (laenge >>> 24) & 0xff;
  raus.set([0x57, 0x45, 0x42, 0x50], 8);
  let p = 12;
  for (const t of teile) { raus.set(t, p); p += t.length; }
  return raus;
}

// ── HEIC (ISO BMFF) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
function uN(b: Uint8Array, o: number, n: number): number | null {
  if (n === 0) return 0;
  if (n === 4) return u32be(b, o);
  if (n === 8) { const hoch = u32be(b, o); if (hoch > 0x1fffff) return null; return hoch * 2 ** 32 + u32be(b, o + 4); }
  return null;
}
interface Box { art: string; start: number; inhalt: number; ende: number }
function boxen(b: Uint8Array, von: number, bis: number): Box[] | null {
  const raus: Box[] = [];
  let o = von;
  while (o < bis) {
    if (o + 8 > bis) return null;
    let groesse = u32be(b, o);
    const art = ascii(b, o + 4, 4);
    let kopf = 8;
    if (groesse === 1) { const g = uN(b, o + 8, 8); if (g === null) return null; groesse = g; kopf = 16; }
    else if (groesse === 0) groesse = bis - o;
    if (groesse < kopf || o + groesse > bis) return null;
    raus.push({ art, start: o, inhalt: o + kopf, ende: o + groesse });
    o += groesse;
  }
  return raus;
}

/**
 * HEIC/HEIF ohne Exif und XMP: die Elemente vom Typ `Exif` bzw. `mime` mit `application/rdf+xml` (laut `iinf`) werden laut `iloc` mit Nullen
 * überschrieben — Größe und Versätze bleiben, das Bild selbst ist unberührt. Dieselben Bytes (===), wenn es nichts gibt; null, wenn sich der
 * Aufbau nicht sicher lesen lässt (dann lieber ablehnen als Ortsangaben ablegen).
 */
export function heicOhneMetadaten(b: Uint8Array): Uint8Array | null {
  const oben = boxen(b, 0, b.length);
  if (!oben || oben[0]?.art !== 'ftyp') return null;
  const meta = oben.find(x => x.art === 'meta');
  if (!meta) return b;
  const kinder = boxen(b, meta.inhalt + 4, meta.ende); // FullBox: Version + Merker
  if (!kinder) return null;
  const iinf = kinder.find(x => x.art === 'iinf');
  const iloc = kinder.find(x => x.art === 'iloc');
  if (!iinf) return b;
  // iinf: Version, Anzahl (16/32 Bit), dann `infe`
  const vI = b[iinf.inhalt];
  const nachAnzahl = iinf.inhalt + 4 + (vI === 0 ? 2 : 4);
  const infes = boxen(b, nachAnzahl, iinf.ende);
  if (!infes) return null;
  const weg = new Set<number>();
  for (const e of infes) {
    if (e.art !== 'infe') continue;
    const v = b[e.inhalt];
    if (v < 2) continue; // alte Fassungen tragen keinen Element-Typ
    let o = e.inhalt + 4;
    const id = v === 2 ? u16be(b, o) : u32be(b, o);
    o += v === 2 ? 2 : 4;
    o += 2; // protection index
    if (o + 4 > e.ende) return null;
    const typ = ascii(b, o, 4);
    o += 4;
    let nameEnde = o; while (nameEnde < e.ende && b[nameEnde] !== 0) nameEnde++;
    let inhaltTyp = '';
    if (typ === 'mime') { let x = nameEnde + 1; const s = x; while (x < e.ende && b[x] !== 0) x++; inhaltTyp = ascii(b, s, x - s); }
    if (typ === 'Exif' || (typ === 'mime' && /rdf\+xml/i.test(inhaltTyp))) weg.add(id);
  }
  if (!weg.size) return b;
  if (!iloc) return null;
  const idat = kinder.find(x => x.art === 'idat');
  const raus = b.slice();
  const v = b[iloc.inhalt];
  if (v > 2) return null;
  let o = iloc.inhalt + 4;
  const offsetGr = b[o] >> 4, laengeGr = b[o] & 0x0f, basisGr = b[o + 1] >> 4, indexGr = v === 1 || v === 2 ? b[o + 1] & 0x0f : 0;
  o += 2;
  const anzahl = v < 2 ? u16be(b, o) : u32be(b, o);
  o += v < 2 ? 2 : 4;
  for (let i = 0; i < anzahl; i++) {
    if (o + 4 > iloc.ende) return null;
    const id = v < 2 ? u16be(b, o) : u32be(b, o);
    o += v < 2 ? 2 : 4;
    let methode = 0;
    if (v === 1 || v === 2) { methode = u16be(b, o) & 0x0f; o += 2; }
    o += 2; // data_reference_index
    const basis = uN(b, o, basisGr); if (basis === null) return null;
    o += basisGr;
    const n = u16be(b, o);
    o += 2;
    for (let j = 0; j < n; j++) {
      o += indexGr;
      const off = uN(b, o, offsetGr); o += offsetGr;
      const len = uN(b, o, laengeGr); o += laengeGr;
      if (off === null || len === null || o > iloc.ende) return null;
      if (!weg.has(id)) continue;
      if (methode !== 0 && methode !== 1) return null;
      if (methode === 1 && !idat) return null;
      const start = (methode === 1 ? idat!.inhalt : 0) + basis + off;
      const grenze = methode === 1 ? idat!.ende : b.length;
      if (len === 0 || start + len > grenze) return null;
      raus.fill(0, start, start + len);
    }
  }
  return raus;
}

/** Metadaten je Typ entfernen (Bilder); andere Typen unverändert. null = Aufbau kaputt bzw. nicht sicher lesbar (→ 415). */
export function ohneMetadaten(typ: KundeDateiTyp, b: Uint8Array): Uint8Array | null {
  if (typ === 'image/jpeg') return jpegOhneMetadaten(b);
  if (typ === 'image/png') return pngOhneMetadaten(b);
  if (typ === 'image/webp') return webpOhneMetadaten(b);
  if (typ === 'image/heic') return heicOhneMetadaten(b);
  return b;
}

/** Zweck einer Unterlage (Konzept 8.3). */
export const ZWECKE = ['register', 'playbook', 'notiz', 'sonstig'] as const;
export const ZWECK_TEXT: Record<(typeof ZWECKE)[number], string> = { register: 'Registerauszug', playbook: 'Playbook', notiz: 'Notiz', sonstig: 'Sonstiges' };
