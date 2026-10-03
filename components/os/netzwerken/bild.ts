// ─── Netzwerken — Foto im Browser verkleinern (02.10.) ───────────────────────
// Eine Karte bleibt bei 1400 px Kante gut lesbar (auch für das spätere Auslesen), der Upload bleibt klein (150–350 KB statt 4 MB vom iPhone). Ausgabe ist
// immer JPEG (weißer Grund, damit transparente PNGs nicht schwarz werden); Base64 ohne Präfix für den Körper der Erfassung,
// die Data-URL für die Vorschau. Kann der Browser das Format nicht öffnen und ist es klein genug, geht das Original mit.

export const MAX_KANTE = 1400;
export const JPEG_QUALITAET = 0.78;
/** Größte Datei, die unverkleinert mitgeht (Rückfall) — der Server nimmt höchstens 3 MB je Foto. */
const ORIGINAL_MAX = 2.5 * 1024 * 1024;

export interface Foto { id: string; dataUrl: string; daten: string; typ: 'image/jpeg' | 'image/png'; name: string; groesse: number }

/** Längste Kante nach dem Verkleinern (rein): nie hochskalieren. */
export function zielMasse(breite: number, hoehe: number, max = MAX_KANTE): { b: number; h: number } {
  const f = Math.min(1, max / Math.max(breite, hoehe, 1));
  return { b: Math.max(1, Math.round(breite * f)), h: Math.max(1, Math.round(hoehe * f)) };
}

const lesen = (datei: File) => new Promise<string>(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result ?? '')); r.onerror = () => ok(''); r.readAsDataURL(datei); });

export async function fotoVorbereiten(datei: File, id: string, nr: number): Promise<Foto | { fehler: string }> {
  const url = URL.createObjectURL(datei);
  try {
    const bild = await new Promise<HTMLImageElement>((ok, nein) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => nein(new Error('nicht lesbar')); i.src = url; });
    if (!bild.naturalWidth || !bild.naturalHeight) throw new Error('leer');
    const { b, h } = zielMasse(bild.naturalWidth, bild.naturalHeight);
    const leinwand = document.createElement('canvas');
    leinwand.width = b; leinwand.height = h;
    const ctx = leinwand.getContext('2d');
    if (!ctx) throw new Error('kein Canvas');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, b, h);
    ctx.drawImage(bild, 0, 0, b, h);
    const dataUrl = leinwand.toDataURL('image/jpeg', JPEG_QUALITAET);
    const daten = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return { id, dataUrl, daten, typ: 'image/jpeg', name: `karte-${nr}.jpg`, groesse: Math.floor((daten.length * 3) / 4) };
  } catch {
    // Nicht öffnbar (z. B. ein Format, das dieser Browser nicht kennt): ein kleines JPEG/PNG geht unverändert mit.
    const typ = datei.type === 'image/png' ? 'image/png' : datei.type === 'image/jpeg' ? 'image/jpeg' : null;
    if (!typ || datei.size > ORIGINAL_MAX) return { fehler: 'Das Foto lässt sich hier nicht verkleinern — bitte noch einmal aufnehmen (JPG).' };
    const dataUrl = await lesen(datei);
    return dataUrl ? { id, dataUrl, daten: dataUrl.slice(dataUrl.indexOf(',') + 1), typ, name: `karte-${nr}.${typ === 'image/png' ? 'png' : 'jpg'}`, groesse: datei.size } : { fehler: 'Das Foto ließ sich nicht öffnen — bitte noch einmal aufnehmen.' };
  } finally { URL.revokeObjectURL(url); }
}

/** Datei (Sprachnotiz) → Base64 ohne Präfix. */
export async function dateiAlsBase64(datei: Blob): Promise<string> {
  const url = await new Promise<string>(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result ?? '')); r.onerror = () => ok(''); r.readAsDataURL(datei); });
  return url.slice(url.indexOf(',') + 1);
}
