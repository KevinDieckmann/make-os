// ─── Netzwerken — Metadaten aus Fotos entfernen (rein, getestet; 03.10., Paket „netz-recht“) ───
// Ein Foto vom Handy trägt Exif: Aufnahmeort (GPS), Zeit, Gerät, manchmal Vorschaubild und Hersteller-Notizen. Für eine Visitenkarte braucht
// das niemand (Datenminimierung, Art. 5 Abs. 1 lit. c DSGVO) — und der Ort verrät, wo die Person war.
//   · Der Browser rendert jedes Foto über ein Canvas neu (`components/os/netzwerken/bild.ts`) — Exif fällt dabei weg.
//   · Der Rückfall dort (Original bis 2,5 MB, wenn der Browser das Format nicht öffnen kann) behielt Exif/GPS — jetzt geht er durch diese Funktionen.
//   · Der Server säubert JEDES Foto vor dem Ablegen noch einmal (`erfassungPruefen`) — auch Erfassungen aus der Warteschlange älterer Stände.
// JPEG: Segmente APP1 (Exif/XMP), APP3–APP13 (u. a. IPTC), APP15 und Kommentare fallen weg; JFIF (APP0), ICC-Profil (APP2) und Adobe (APP14,
// Farbumrechnung) bleiben, sonst sähe das Bild anders aus. PNG: eXIf, tEXt, zTXt, iTXt, tIME, dSIG fallen weg. Ist der Aufbau kaputt → `null`.

const JPEG_BEHALTEN = new Set([0xe0, 0xe2, 0xee]);

/** JPEG ohne Exif/XMP/IPTC/Kommentare; `null` bei beschädigtem Aufbau. Liefert dieselben Bytes zurück (===), wenn nichts zu entfernen war. */
export function jpegOhneMetadaten(b: Uint8Array): Uint8Array | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const teile: Uint8Array[] = [b.subarray(0, 2)];
  let entfernt = false;
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    let m = b[i + 1];
    while (m === 0xff && i + 2 < b.length) { i++; m = b[i + 1]; } // Füllbytes
    if (m === undefined) return null;
    if (m === 0xd9) { teile.push(b.subarray(i, i + 2)); i = b.length; break; } // EOI
    if (m === 0xda) { teile.push(b.subarray(i)); i = b.length; break; } // SOS: ab hier Bilddaten, unverändert bis zum Ende
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) { teile.push(b.subarray(i, i + 2)); i += 2; continue; } // Marker ohne Länge
    if (i + 4 > b.length) return null;
    const laenge = (b[i + 2] << 8) | b[i + 3];
    if (laenge < 2 || i + 2 + laenge > b.length) return null;
    const segment = b.subarray(i, i + 2 + laenge);
    const appn = m >= 0xe0 && m <= 0xef;
    if (m === 0xfe || (appn && !JPEG_BEHALTEN.has(m))) entfernt = true; else teile.push(segment);
    i += 2 + laenge;
  }
  if (i < b.length) return null;
  // Ohne SOS (abgeschnittene Datei) bleibt, was da ist — ohne Metadaten; die Ablage prüft Typ und Größe, ein Bild ohne Daten zeigt eben nichts.
  if (!entfernt) return b;
  const raus = new Uint8Array(teile.reduce((s, t) => s + t.length, 0));
  let o = 0;
  for (const t of teile) { raus.set(t, o); o += t.length; }
  return raus;
}

const PNG_KOPF = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_WEG = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME', 'dSIG']);

/** PNG ohne Text-/Exif-/Zeit-Blöcke; `null` bei beschädigtem Aufbau. (===, wenn nichts zu entfernen war.) */
export function pngOhneMetadaten(b: Uint8Array): Uint8Array | null {
  if (b.length < 20 || PNG_KOPF.some((x, i) => b[i] !== x)) return null;
  const teile: Uint8Array[] = [b.subarray(0, 8)];
  let entfernt = false;
  let i = 8;
  let ende = false;
  while (i + 12 <= b.length) {
    const laenge = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const typ = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    const gesamt = 12 + laenge;
    if (i + gesamt > b.length) return null;
    if (PNG_WEG.has(typ)) entfernt = true; else teile.push(b.subarray(i, i + gesamt));
    i += gesamt;
    if (typ === 'IEND') { ende = true; break; }
  }
  if (!ende || i !== b.length) return null;
  if (!entfernt) return b;
  const raus = new Uint8Array(teile.reduce((s, t) => s + t.length, 0));
  let o = 0;
  for (const t of teile) { raus.set(t, o); o += t.length; }
  return raus;
}

/** Bytes eines Bildes ohne Metadaten — nur JPEG und PNG; `null` bei anderem Format oder beschädigtem Aufbau. */
export function bildOhneMetadaten(b: Uint8Array, typ: 'jpeg' | 'png'): Uint8Array | null {
  return typ === 'jpeg' ? jpegOhneMetadaten(b) : pngOhneMetadaten(b);
}

const VON_BASE64 = (s: string): Uint8Array => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export function alsBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Wie `bildOhneMetadaten`, aber Base64 → Base64 (der Körper einer Erfassung trägt Fotos so). `null`: nicht lesbar. Unverändert (===), wenn nichts zu entfernen war. */
export function base64OhneMetadaten(daten: string, typ: 'jpeg' | 'png'): string | null {
  let bytes: Uint8Array;
  try { bytes = VON_BASE64(daten); } catch { return null; }
  const r = bildOhneMetadaten(bytes, typ);
  if (!r) return null;
  return r === bytes ? daten : alsBase64(r);
}

/** Enthält das Bild noch Exif/XMP/Text-Metadaten? (Test und Selbstprüfung) */
export function hatMetadaten(b: Uint8Array, typ: 'jpeg' | 'png'): boolean {
  const r = bildOhneMetadaten(b, typ);
  return !!r && r !== b;
}
