// ─── Netzwerken · QR-Code im Browser erzeugen (02.10., Paket B) ────────────────
// Lokal gebündelt (`qrcode-generator`, MIT) — kein Dienst, nichts verlässt das Gerät, funktioniert auch ohne Netz.
// Die Bibliothek macht aus einer Zeichenkette Byte-Modus mit `c & 0xff` je Zeichen (also nur Latin-1). Damit Umlaute,
// Akzente und alles andere als echtes UTF-8 im Code stehen, wandeln wir den Text vorher selbst in UTF-8-Bytes und
// reichen sie als „Binärstring“ (ein Zeichen = ein Byte) hinein. Scanner (iPhone-Kamera, Android, jsQR) lesen Byte-Modus
// ohne Kennzeichnung als UTF-8.

import qrcode from 'qrcode-generator';

/** UTF-8-Bytes eines Textes als Binärstring (jedes Zeichen 0–255). */
export function alsBinaerString(text: string): string {
  let s = '';
  for (const b of new TextEncoder().encode(text)) s += String.fromCharCode(b);
  return s;
}

export type QrKorrektur = 'L' | 'M' | 'Q' | 'H';
export interface QrMatrix { groesse: number; dunkel: (zeile: number, spalte: number) => boolean }

/** Die Modul-Matrix zu einem Text. Wirft, wenn der Text für einen QR-Code (Version 40) zu lang ist. */
export function qrMatrix(text: string, korrektur: QrKorrektur = 'M'): QrMatrix {
  const q = qrcode(0, korrektur); // 0 = kleinste passende Version
  q.addData(alsBinaerString(text), 'Byte');
  q.make();
  return { groesse: q.getModuleCount(), dunkel: (r, c) => q.isDark(r, c) };
}

/**
 * Der Code als ein SVG-Pfad (eine Fläche, scharf bei jeder Größe) in einem Quadrat von `n` Einheiten, mit der ruhigen
 * Zone (4 Module, QR-Norm) als Rand. Die Oberfläche setzt daraus ein <svg viewBox="0 0 n n"> mit weißem Grund.
 */
export function qrPfad(text: string, opt: { korrektur?: QrKorrektur; rand?: number } = {}): { pfad: string; n: number; module: number } {
  const m = qrMatrix(text, opt.korrektur ?? 'M');
  const rand = opt.rand ?? 4;
  let pfad = '';
  for (let r = 0; r < m.groesse; r++) {
    let c = 0;
    while (c < m.groesse) {
      if (!m.dunkel(r, c)) { c++; continue; }
      const start = c;
      while (c < m.groesse && m.dunkel(r, c)) c++;
      pfad += `M${start + rand} ${r + rand}h${c - start}v1h-${c - start}z`;
    }
  }
  return { pfad, n: m.groesse + rand * 2, module: m.groesse };
}

/** Dasselbe als fertiger SVG-Text (Dunkel auf Weiß — hell auf dunkel liest nicht jeder Scanner). */
export function qrSvg(text: string, opt: { korrektur?: QrKorrektur; rand?: number } = {}): string {
  const { pfad, n } = qrPfad(text, opt);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#ffffff"/><path d="${pfad}" fill="#000000"/></svg>`;
}
