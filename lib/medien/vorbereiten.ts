// ─── Medien — Vorbereiten im Browser (09.10., Paket 5) ──────────────────────────────────────────────────────────────────────
// Was der schwache Server nicht soll, macht das Gerät (research/agenten/MEDIEN.md B5):
//   Foto   Drehung + Aufnahmezeit aus Exif lesen → Exif/GPS entfernen (`jpegOhneMetadaten`, ohne Neukodierung, ICC bleibt) → nur die
//          Drehung wieder einsetzen → Vorschauen per Canvas (Raster 480 px, Ansicht 1568 px, JPEG).
//   Video  Ort- und (ohne Ton-Schalter) Ton-Spuren als Patches (lib/medien/mp4-ort.ts, ohne Neukodierung) → Poster + Raster per <video>/Canvas,
//          Abmessungen und Dauer aus dem Element. Videos starten nie von selbst (das Element spielt nicht ab, es liefert nur ein Bild).
// Nur im Browser (DOM) — die reinen Teile sind getestet (exif.ts, mp4-ort.ts).

import { jpegOhneMetadaten, pngOhneMetadaten } from '@/lib/netzwerken/bild-bereinigen';
import { exifLesen, jpegMitDrehung } from './exif';
import { ortUndTonEntfernen, type Patch } from './mp4-ort';
import { GRENZEN, BILD_TYPEN, VIDEO_TYPEN, type MedienTyp, type Ton } from './typen';

export interface Vorbereitet {
  typ: MedienTyp;
  art: 'bild' | 'video';
  bytes: number;
  /** Foto: gesäuberte Bytes (ganz). Video: null — gelesen wird stückweise aus der Datei mit den Patches. */
  daten: Uint8Array | null;
  datei: File | null;
  patches: Patch[];
  vorschau: { raster: Blob; ansicht?: Blob; poster?: Blob };
  meta: { breite?: number; hoehe?: number; dauerSek?: number; drehung?: number; aufgenommen?: string; ortsdatenEntfernt: boolean; ton?: Ton };
  bericht: string[];
}

/** Typ aus den ersten Bytes (wie der Server) — HEIC lehnen wir ab (iOS liefert JPEG, solange `image/heic` nicht in `accept` steht). */
export function typAusKopf(b: Uint8Array): MedienTyp | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  const atom = String.fromCharCode(b[4], b[5], b[6], b[7]);
  if (atom === 'ftyp') {
    const marke = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (/^(heic|heix|hevc|heim|heis|mif1|msf1|avif|avis)$/.test(marke)) return null;
    return marke === 'qt  ' ? 'video/quicktime' : 'video/mp4';
  }
  if (atom === 'wide' || atom === 'moov' || atom === 'mdat' || atom === 'free') return 'video/quicktime';
  return null;
}

const leseTeil = async (f: Blob, von: number, laenge: number) => new Uint8Array(await f.slice(von, von + laenge).arrayBuffer());

async function leinwand(quelle: CanvasImageSource, breite: number, hoehe: number, kante: number, qualitaet: number): Promise<Blob> {
  const f = Math.min(1, kante / Math.max(breite, hoehe));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(breite * f)); c.height = Math.max(1, Math.round(hoehe * f));
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas nicht verfügbar');
  g.drawImage(quelle, 0, 0, c.width, c.height);
  return new Promise((ok, nein) => c.toBlob(b => (b ? ok(b) : nein(new Error('Vorschau nicht erzeugbar'))), 'image/jpeg', qualitaet));
}

/** Ein Foto oder Video vorbereiten. `tonBehalten` = Ton-Schalter (mit Hinweis § 201 StGB) an. */
export async function vorbereiten(datei: File, o: { tonBehalten: boolean }): Promise<Vorbereitet> {
  const kopf = await leseTeil(datei, 0, 64);
  const typ = typAusKopf(kopf);
  if (!typ) throw new Error('Nur Fotos (JPEG, PNG) und Videos (MOV, MP4) — bitte in den Kamera-Einstellungen „Maximale Kompatibilität“ wählen oder neu aufnehmen.');
  const art = (BILD_TYPEN as readonly string[]).includes(typ) ? 'bild' : 'video';
  if (art === 'bild' && datei.size > GRENZEN.bild) throw new Error('Fotos höchstens 50 MB.');
  if (art === 'video' && datei.size > GRENZEN.video) throw new Error('Videos höchstens 2 GB — in der Kamera 1080p/30 (HEVC) einstellen oder kürzer aufnehmen.');
  if (!(VIDEO_TYPEN as readonly string[]).includes(typ) && art === 'video') throw new Error('Unbekanntes Videoformat.');

  if (art === 'bild') {
    const roh = new Uint8Array(await datei.arrayBuffer());
    const exif = typ === 'image/jpeg' ? exifLesen(roh) : {};
    const sauber = typ === 'image/jpeg' ? jpegOhneMetadaten(roh) : pngOhneMetadaten(roh);
    if (!sauber) throw new Error('Das Foto ist beschädigt.');
    const daten = typ === 'image/jpeg' ? jpegMitDrehung(sauber, exif.drehung) : sauber;
    const blob = new Blob([daten as BlobPart], { type: typ });
    const bild = await createImageBitmap(blob);
    try {
      const vorschau = { raster: await leinwand(bild, bild.width, bild.height, GRENZEN.rasterPx, 0.72), ansicht: await leinwand(bild, bild.width, bild.height, GRENZEN.ansichtPx, 0.82) };
      return { typ, art, bytes: daten.length, daten, datei: null, patches: [], vorschau, meta: { breite: bild.width, hoehe: bild.height, ...(exif.drehung ? { drehung: exif.drehung } : {}), ...(exif.aufgenommen ? { aufgenommen: exif.aufgenommen } : {}), ortsdatenEntfernt: true }, bericht: ['Exif/GPS entfernt'] };
    } finally { bild.close?.(); }
  }

  const mp4 = await ortUndTonEntfernen((von, laenge) => leseTeil(datei, von, laenge), datei.size, o.tonBehalten);
  const url = URL.createObjectURL(datei);
  try {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    await new Promise<void>((ok, nein) => { v.onloadedmetadata = () => ok(); v.onerror = () => nein(new Error('Video nicht lesbar')); setTimeout(() => nein(new Error('Video lädt nicht')), 20_000); });
    const breite = v.videoWidth, hoehe = v.videoHeight, dauerSek = Number.isFinite(v.duration) ? v.duration : undefined;
    v.currentTime = Math.min(1, (dauerSek ?? 2) / 2);
    await new Promise<void>((ok, nein) => { v.onseeked = () => ok(); setTimeout(() => nein(new Error('Bild aus dem Video nicht lesbar')), 20_000); });
    const poster = await leinwand(v, breite, hoehe, GRENZEN.ansichtPx, 0.82);
    const raster = await leinwand(v, breite, hoehe, GRENZEN.rasterPx, 0.72);
    v.removeAttribute('src'); v.load();
    return {
      typ, art, bytes: datei.size, daten: null, datei, patches: mp4.patches, vorschau: { raster, poster },
      meta: { breite, hoehe, ...(dauerSek ? { dauerSek } : {}), ortsdatenEntfernt: mp4.ortEntfernt, ton: mp4.ton, ...(datei.lastModified ? { aufgenommen: new Date(datei.lastModified).toISOString() } : {}) },
      bericht: mp4.bericht,
    };
  } finally { URL.revokeObjectURL(url); }
}

/** Bild zuschneiden (Rechteck in Anteilen) — für Head-Vorschläge nach Klick. Ergebnis: JPEG ohne Metadaten (Canvas). */
export async function zuschneiden(quelle: Blob, r: { x: number; y: number; b: number; h: number }): Promise<Blob> {
  const bild = await createImageBitmap(quelle);
  try {
    const sx = Math.round(r.x * bild.width), sy = Math.round(r.y * bild.height), sb = Math.round(r.b * bild.width), sh = Math.round(r.h * bild.height);
    const c = document.createElement('canvas');
    c.width = Math.max(1, sb); c.height = Math.max(1, sh);
    const g = c.getContext('2d');
    if (!g) throw new Error('Canvas nicht verfügbar');
    g.drawImage(bild, sx, sy, sb, sh, 0, 0, c.width, c.height);
    return await new Promise((ok, nein) => c.toBlob(b => (b ? ok(b) : nein(new Error('Zuschnitt nicht erzeugbar'))), 'image/jpeg', 0.9));
  } finally { bild.close?.(); }
}
