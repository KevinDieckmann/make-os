// ─── MAKE OS — Bilder auf dem Gerät verkleinern (Client) ────────────────────
// Fotos vom Handy sind 3–8 MB; hoch geht eine JPEG-Fassung mit höchstens
// `max` Pixeln Kante. Die Ausrichtung (EXIF) übernimmt der Browser beim Zeichnen.

export function bildVerkleinern(datei: File, max = 1280, qualitaet = 0.82): Promise<string> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(datei);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
      const ctx = c.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) { rej(new Error('Kein Canvas.')); return; }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', qualitaet));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Bild nicht lesbar — bitte als JPEG oder PNG.')); };
    img.src = url;
  });
}
