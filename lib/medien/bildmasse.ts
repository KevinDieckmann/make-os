// ─── Medien — Bildmaße aus dem Dateikopf (09.10., Paket 4c) — rein, Server UND Browser ──────────────────────────────────────────
// Für KI-Bilder, die der SERVER ablegt (lib/medien/ki-ablage.ts): Breite und Höhe ohne Bild-Bibliothek, nur aus dem Kopf (PNG: IHDR,
// JPEG: erster SOF-Marker). Die Bytes werden nie verändert (SynthID/C2PA bleiben) — hier wird nur gelesen. Unbekannt → null.

export function bildMasse(b: Uint8Array): { breite: number; hoehe: number } | null {
  // PNG: Signatur (8) + Länge (4) + „IHDR“ (4) + Breite (4, BE) + Höhe (4, BE).
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[12] === 0x49 && b[13] === 0x48 && b[14] === 0x44 && b[15] === 0x52) {
    const breite = ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0;
    const hoehe = ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0;
    return breite > 0 && hoehe > 0 ? { breite, hoehe } : null;
  }
  // JPEG: Segmente ab Byte 2 durchgehen, bis ein SOF (C0–CF außer C4, C8, CC) kommt.
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker === 0xff) { i++; continue; }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const laenge = (b[i + 2] << 8) | b[i + 3];
      if (laenge < 2) return null;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const hoehe = (b[i + 5] << 8) | b[i + 6];
        const breite = (b[i + 7] << 8) | b[i + 8];
        return breite > 0 && hoehe > 0 ? { breite, hoehe } : null;
      }
      if (marker === 0xd9 || marker === 0xda) return null;
      i += 2 + laenge;
    }
  }
  return null;
}
