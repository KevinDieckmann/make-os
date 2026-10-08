// ─── Medien — Exif lesen, bevor er wegfällt; Drehung behalten (09.10., Paket 5; rein, getestet) ─────────────────────────────
// Der Säuberer (lib/netzwerken/bild-bereinigen.ts `jpegOhneMetadaten`) entfernt das ganze APP1 (Exif/XMP) — mit dem Ort (GPS), dem Gerät,
// aber auch mit der Drehung (Orientation): Hochkant-Fotos stünden danach quer. Deshalb: VORHER Drehung und Aufnahmezeit lesen, dann säubern,
// dann ein winziges APP1 mit NUR der Drehung wieder einsetzen (keine Zeit, kein Ort, kein Gerät — research/agenten/MEDIEN.md D2).

const lese16 = (b: Uint8Array, o: number, le: boolean) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
const lese32 = (b: Uint8Array, o: number, le: boolean) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);

/** Drehung (1–8) und Aufnahmezeit („YYYY-MM-DDTHH:MM:SS“ mit Versatz, wenn bekannt) aus einem JPEG — leer, wenn nichts lesbar ist. */
export function exifLesen(b: Uint8Array): { drehung?: number; aufgenommen?: string } {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return {};
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const m = b[i + 1];
    if (m === 0xda || m === 0xd9) break;
    const laenge = (b[i + 2] << 8) | b[i + 3];
    if (laenge < 2 || i + 2 + laenge > b.length) break;
    if (m === 0xe1 && laenge >= 16 && String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]) === 'Exif') {
      try { return tiffLesen(b.subarray(i + 10, i + 2 + laenge)); } catch { return {}; }
    }
    i += 2 + laenge;
  }
  return {};
}

function tiffLesen(t: Uint8Array): { drehung?: number; aufgenommen?: string } {
  const le = t[0] === 0x49 && t[1] === 0x49;
  if (!le && !(t[0] === 0x4d && t[1] === 0x4d)) return {};
  if (lese16(t, 2, le) !== 42) return {};
  const raus: { drehung?: number; aufgenommen?: string } = {};
  const eintraege = (ifd: number) => {
    if (ifd + 2 > t.length) return [] as { tag: number; typ: number; anzahl: number; wert: number }[];
    const n = lese16(t, ifd, le);
    return Array.from({ length: n }, (_, k) => ifd + 2 + 12 * k).filter(o => o + 12 <= t.length)
      .map(o => ({ tag: lese16(t, o, le), typ: lese16(t, o + 2, le), anzahl: lese32(t, o + 4, le), wert: o + 8 }));
  };
  const text = (e: { anzahl: number; wert: number }) => {
    const o = e.anzahl > 4 ? lese32(t, e.wert, le) : e.wert;
    return String.fromCharCode(...t.subarray(o, Math.min(t.length, o + e.anzahl))).replace(/\0.*$/, '');
  };
  let exifIfd = 0;
  for (const e of eintraege(lese32(t, 4, le))) {
    if (e.tag === 0x0112) { const d = lese16(t, e.wert, le); if (d >= 1 && d <= 8) raus.drehung = d; }
    if (e.tag === 0x8769) exifIfd = lese32(t, e.wert, le);
  }
  if (exifIfd) {
    let zeit = '', versatz = '';
    for (const e of eintraege(exifIfd)) {
      if (e.tag === 0x9003 && e.typ === 2) zeit = text(e);
      if (e.tag === 0x9011 && e.typ === 2) versatz = text(e);
    }
    const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(zeit);
    if (m) raus.aufgenommen = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${/^[+-]\d{2}:\d{2}$/.test(versatz) ? versatz : ''}`;
  }
  return raus;
}

/** Ein JPEG ohne Metadaten bekommt NUR die Drehung zurück (APP1 „Exif“ mit einem einzigen Eintrag Orientation). Drehung 1 = nichts. */
export function jpegMitDrehung(sauber: Uint8Array, drehung: number | undefined): Uint8Array {
  if (!drehung || drehung === 1 || drehung < 1 || drehung > 8 || sauber[0] !== 0xff || sauber[1] !== 0xd8) return sauber;
  // TIFF (MM): Kopf 8 + IFD (2 + 12 + 4) = 26 Byte; APP1 = FFE1 + Länge(2) + „Exif\0\0“(6) + TIFF
  const tiff = new Uint8Array(26);
  tiff.set([0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, drehung, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const laenge = 2 + 6 + tiff.length;
  const app1 = new Uint8Array(2 + laenge);
  app1.set([0xff, 0xe1, laenge >> 8, laenge & 0xff, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 0);
  app1.set(tiff, 10);
  const raus = new Uint8Array(sauber.length + app1.length);
  raus.set(sauber.subarray(0, 2), 0);
  raus.set(app1, 2);
  raus.set(sauber.subarray(2), 2 + app1.length);
  return raus;
}

/**
 * Prüfung auf dem Server (erstes Stück reicht — Metadaten stehen vor den Bilddaten): trägt das JPEG noch Metadaten außer der reinen Drehung
 * (Exif mit Ort/Gerät, XMP, IPTC, Kommentar)? Dann gilt es als „Ortsdaten nicht entfernt“ — egal, was das Gerät meldet.
 */
export function jpegMetadatenUebrig(b: Uint8Array): boolean {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return false;
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const m = b[i + 1];
    if (m === 0xda || m === 0xd9) return false;
    const laenge = (b[i + 2] << 8) | b[i + 3];
    if (laenge < 2) return true;
    if (m === 0xfe) return true;
    if (m >= 0xe0 && m <= 0xef && m !== 0xe0 && m !== 0xe2 && m !== 0xee) {
      const nurDrehung = m === 0xe1 && laenge === 34 && i + 36 <= b.length && String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]) === 'Exif'
        && b[i + 18] === 0x00 && b[i + 19] === 0x01 && b[i + 20] === 0x01 && b[i + 21] === 0x12;
      if (!nurDrehung) return true;
    }
    i += 2 + laenge;
  }
  return false;
}
