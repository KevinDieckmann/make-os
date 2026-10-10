// ─── Kalender — Darstellung je Gerät, Kopfzeile, volle Höhe (rein, client-sicher, getestet, 10.10.) ─────────────────────────────
// Kevin 10.10.: „Den Kalender überall in der Ansicht anpassen — nicht gut zu sehen, nicht gut zu scrollen, man sieht einfach nichts,
// im Vergleich zu Google.“ Hier die reinen Regeln dafür (kein React, keine Server-Module):
//   · Darstellung je GERÄT (Merker im Browser, wie Einstellungen › Bedienung): Zeilenhöhe Kompakt · Normal · Groß, Zoom (Strg/⌘ + Rad bzw.
//     Pinch), „Aufgaben ohne Uhrzeit anzeigen“, Bedienungshilfe unter dem Raster. Warum im Browser: es hängt am Bildschirm, nicht an der Person
//     — am Handy will man es anders als am großen Monitor. Keine Personendaten, kein Bestand, sofort wirksam. Ohne Speicher gilt die Vorgabe.
//   · Kopfzeile: der Zeitraum in EINER Zeile („5.–11. Okt. 2026 · KW 41“) und die Ampel je Abgleich-Quelle (Punkt statt Textzeile).
//   · Volle Höhe: das Raster füllt den Bildschirm (Fenster − was darüber steht − die Handy-Leiste unten) und rollt in sich.
//   · Wohin das Raster beim Öffnen rollt: Arbeitsbeginn aus den eigenen Business-freien Zeiten (endet die Nacht um 8:00 → 8:00).
// Termine und Aufgaben selbst ändert hier nichts — nur, wie sie aussehen.

import { kalenderwoche } from '@/lib/zeit/kalender-kern';
import type { KalenderAnsicht } from './modus';

export type Zeilenhoehe = 'kompakt' | 'normal' | 'gross';

export const ZEILENHOEHEN: readonly { id: Zeilenhoehe; label: string }[] = [
  { id: 'kompakt', label: 'Kompakt' },
  { id: 'normal', label: 'Normal' },
  { id: 'gross', label: 'Groß' },
];

/** Pixel je Minute je Stufe — Normal = der bisherige Wert (54 px je Stunde). */
export const ZEILEN_PX: Readonly<Record<Zeilenhoehe, number>> = Object.freeze({ kompakt: 0.6, normal: 0.9, gross: 1.4 });

/** Zoom-Faktor auf die Stufe (Strg/⌘ + Rad, Pinch): halb bis zweieinhalbfach. */
export const ZOOM = Object.freeze({ min: 0.5, max: 2.5 });

export interface KalenderDarstellung {
  /** Zeilenhöhe des Stundenrasters. */
  zeilen: Zeilenhoehe;
  /** Zoom auf die Stufe (1 = wie gewählt). */
  zoom: number;
  /** Aufgaben ohne Uhrzeit in der Ganztags-Zeile und im Monat zeigen (Vorgabe an). */
  aufgabenOhneZeit: boolean;
  /** Die Bedienungshilfe unter dem Raster (Vorgabe zu). */
  hilfe: boolean;
}

export const DARSTELLUNG_VORGABE: Readonly<KalenderDarstellung> = Object.freeze({ zeilen: 'normal', zoom: 1, aufgabenOhneZeit: true, hilfe: false });

/** Merker im Browser (je Gerät). */
export const DARSTELLUNG_MERKER = 'make-kalender-darstellung';
/** Ereignis nach jeder Änderung — der offene Kalender liest neu. */
export const DARSTELLUNG_EREIGNIS = 'make-kalender-darstellung-geaendert';

/** Zoom in die Grenzen, auf drei Stellen gerundet (kein endloses Komma im Merker); Unsinn → 1. */
export function zoomKlemmen(z: unknown): number {
  if (typeof z !== 'number' || !Number.isFinite(z) || z <= 0) return 1;
  return Math.round(Math.min(ZOOM.max, Math.max(ZOOM.min, z)) * 1000) / 1000;
}

const istStufe = (x: unknown): x is Zeilenhoehe => x === 'kompakt' || x === 'normal' || x === 'gross';

/** Nimmt nur, was passt — alles andere fällt auf die Vorgabe zurück (alter/verdorbener Merker bricht nichts). */
export function darstellungSaeubern(roh: unknown): KalenderDarstellung {
  const o = roh && typeof roh === 'object' && !Array.isArray(roh) ? roh as Record<string, unknown> : {};
  const v = DARSTELLUNG_VORGABE;
  return {
    zeilen: istStufe(o.zeilen) ? o.zeilen : v.zeilen,
    zoom: o.zoom === undefined ? v.zoom : zoomKlemmen(o.zoom),
    aufgabenOhneZeit: typeof o.aufgabenOhneZeit === 'boolean' ? o.aufgabenOhneZeit : v.aufgabenOhneZeit,
    hilfe: typeof o.hilfe === 'boolean' ? o.hilfe : v.hilfe,
  };
}

type Lesen = Pick<Storage, 'getItem'> | null;
type Schreiben = Pick<Storage, 'setItem' | 'removeItem'> | null;
const ortVon = <T>(speicher: T | null | undefined): T | Storage | null =>
  speicher === undefined ? (typeof localStorage === 'undefined' ? null : localStorage) : speicher;

/** Liest die Darstellung dieses Geräts — leer, gesperrt oder kaputt → Vorgabe. */
export function darstellungLesen(speicher?: Lesen): KalenderDarstellung {
  try {
    const roh = ortVon(speicher)?.getItem(DARSTELLUNG_MERKER);
    return darstellungSaeubern(roh ? JSON.parse(roh) : null);
  } catch { return { ...DARSTELLUNG_VORGABE }; }
}

/** Schreibt nur Abweichungen von der Vorgabe (alles Vorgabe → Merker weg). `false`, wenn der Speicher scheitert. */
export function darstellungSchreiben(d: KalenderDarstellung, speicher?: Schreiben): boolean {
  const s = darstellungSaeubern(d);
  const ab: Partial<KalenderDarstellung> = {};
  for (const k of Object.keys(DARSTELLUNG_VORGABE) as (keyof KalenderDarstellung)[]) if (s[k] !== DARSTELLUNG_VORGABE[k]) (ab as Record<string, unknown>)[k] = s[k];
  try {
    const ort = ortVon(speicher);
    if (!ort) return false;
    if (Object.keys(ab).length) ort.setItem(DARSTELLUNG_MERKER, JSON.stringify(ab)); else ort.removeItem(DARSTELLUNG_MERKER);
    return true;
  } catch { return false; }
}

/**
 * Deckkraft der Blockfläche eines Termins im Raster (Farbe des Kalenders über dem Grund): kräftig genug, dass der Block als Fläche steht,
 * hell genug, dass Titel (≥ 4.5:1) und Zeitzeile (≥ 4.5:1) lesbar bleiben — geprüft für alle Art- und Terminfarben (tests/kalender-ansicht.test.ts).
 */
export const BLOCK_ALPHA = 0x33;
/** Dieselbe Deckkraft als Hex-Anhang an eine Farbe (`#4FC3F7` + `33`). */
export const BLOCK_HEX = BLOCK_ALPHA.toString(16).padStart(2, '0');

/** Pixel je Minute im Raster: Stufe × Zoom. */
export const pxJeMinute = (d: Pick<KalenderDarstellung, 'zeilen' | 'zoom'>): number => ZEILEN_PX[istStufe(d.zeilen) ? d.zeilen : 'normal'] * zoomKlemmen(d.zoom);

const PIXEL_JE_MODUS = [1, 16, 400];

/**
 * Strg/⌘ + Rad (am Trackpad: Pinch kommt als Rad mit Strg): Faktor für EIN Ereignis. Nach oben (deltaY < 0) = größer. Je Ereignis höchstens
 * ±25 %, damit ein Mausrad mit großen Schritten nicht springt.
 */
export function radZoomFaktor(deltaY: number, deltaMode = 0): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return 1;
  const px = deltaY * (PIXEL_JE_MODUS[deltaMode] ?? 1);
  return Math.min(1.25, Math.max(0.8, Math.exp(-px * 0.0025)));
}

/** Neuer Zoom nach einem Faktor (Rad oder Pinch), geklemmt. */
export const zoomMal = (zoom: number, faktor: number): number => zoomKlemmen(zoomKlemmen(zoom) * (Number.isFinite(faktor) && faktor > 0 ? faktor : 1));

/** Wohin das Raster rollen muss, damit `minute` an derselben Stelle (`versatz` px unter dem oberen Rand) bleibt. */
export const rollAnker = (minute: number, px: number, versatz: number): number => Math.max(0, Math.round(minute * px - versatz));

/**
 * Volle Höhe für den Kalender: sichtbare Fensterhöhe − was darüber steht (`oben`, ab dem oberen Rand des Inhalts) − was unten fest steht
 * (`unten`, die Handy-Leiste) − ein kleiner Rand. Nie unter `min` (sehr kleine Fenster rollen dann die Seite).
 */
export function volleHoehe(fenster: number, oben: number, o: { unten?: number; rand?: number; min?: number } = {}): number {
  const { unten = 0, rand = 12, min = 320 } = o;
  const h = Math.round(fenster - oben - unten - rand);
  return Number.isFinite(h) ? Math.max(min, h) : min;
}

// ── Kopfzeile ───────────────────────────────────────────────────────────────────────────────────────────────────────

const MONAT_KURZ = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
const MONAT_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WOCHENTAG_KURZ = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];

const teile = (tag: string) => ({ j: Number(tag.slice(0, 4)), m: Number(tag.slice(5, 7)), t: Number(tag.slice(8, 10)) });
const wochentag = (tag: string) => WOCHENTAG_KURZ[new Date(`${tag}T12:00:00Z`).getUTCDay()];

/** „5.–11. Okt. 2026“, „28. Sept. – 4. Okt. 2026“, „29. Dez. 2026 – 4. Jan. 2027“. */
export function spanneKurz(von: string, bis: string): string {
  const a = teile(von), b = teile(bis);
  if (von === bis) return `${a.t}. ${MONAT_KURZ[a.m - 1]} ${a.j}`;
  if (a.j !== b.j) return `${a.t}. ${MONAT_KURZ[a.m - 1]} ${a.j} – ${b.t}. ${MONAT_KURZ[b.m - 1]} ${b.j}`;
  if (a.m !== b.m) return `${a.t}. ${MONAT_KURZ[a.m - 1]} – ${b.t}. ${MONAT_KURZ[b.m - 1]} ${b.j}`;
  return `${a.t}.–${b.t}. ${MONAT_KURZ[b.m - 1]} ${b.j}`;
}

/**
 * Der Zeitraum der Ansicht für die Kopfzeile — EINE Zeile:
 *   Tag „Sa., 10. Okt. 2026“ · mehrere Tage „10.–13. Okt. 2026“ · Woche „5.–11. Okt. 2026 · KW 41“ · Monat „Oktober 2026“ · Jahr „2026“ ·
 *   Termine „ab 10. Okt. 2026 · 30 Tage“.
 * `kurz` (= heute, am Handy): ohne Jahr, solange alles im laufenden Jahr liegt, und ohne KW — „5.–11. Okt.“ passt neben die Knöpfe.
 */
export function zeitraumText(ansicht: KalenderAnsicht, tage: readonly string[], anker: string, o: { kurz?: string } = {}): string {
  const erster = tage[0] ?? anker, letzter = tage[tage.length - 1] ?? anker;
  const a = teile(anker);
  const jahr = o.kurz?.slice(0, 4);
  const ohneJahr = (text: string, ...tageImText: string[]) => (jahr && tageImText.every(t => t.slice(0, 4) === jahr) ? text.replace(` ${jahr}`, '') : text);
  switch (ansicht) {
    case 'tag': return ohneJahr(`${wochentag(anker)}, ${a.t}. ${MONAT_KURZ[a.m - 1]} ${a.j}`, anker);
    case 'woche': return jahr ? ohneJahr(spanneKurz(erster, letzter), erster, letzter) : `${spanneKurz(erster, letzter)} · KW ${kalenderwoche(erster)}`;
    case 'vier': return ohneJahr(spanneKurz(erster, letzter), erster, letzter);
    case 'monat': return ohneJahr(`${MONAT_LANG[a.m - 1]} ${a.j}`, anker);
    case 'jahr': return `${a.j}`;
    default: return ohneJahr(`ab ${a.t}. ${MONAT_KURZ[a.m - 1]} ${a.j} · ${tage.length || 30} Tage`, anker);
  }
}

// ── Abgleich als Ampel-Punkt ─────────────────────────────────────────────────────────────────────────────────────────

export type Ampel = 'gut' | 'achtung' | 'kritisch';

/** Was die Kalender-Antwort je Quelle über den Abgleich sagt (Form wie `AbgleichInfo` in components/os/kalender/AbgleichStand.tsx). */
export interface AbgleichKurz { vorMin: number | null; veraltet: boolean; fehler?: string; anmeldung?: true; hinweise?: readonly unknown[] }

/** Rot = Anmeldung abgelehnt oder Abgleich gescheitert · Gelb = älter als 30 Min., noch nie, oder ein Kalender übersprungen · sonst grün. */
export function abgleichAmpel(a: AbgleichKurz): Ampel {
  if (a.anmeldung || a.fehler) return 'kritisch';
  if (a.veraltet || a.vorMin === null || (a.hinweise?.length ?? 0) > 0) return 'achtung';
  return 'gut';
}

/** Die schlechteste Ampel mehrerer Quellen (für den Tooltip des Knopfs). */
export function schlechtesteAmpel(liste: readonly Ampel[]): Ampel | null {
  if (!liste.length) return null;
  return liste.includes('kritisch') ? 'kritisch' : liste.includes('achtung') ? 'achtung' : 'gut';
}

// ── Arbeitsbeginn ────────────────────────────────────────────────────────────────────────────────────────────────────

const minuteVon = (wand: string) => Number(wand.slice(11, 13)) * 60 + Number(wand.slice(14, 16));

/**
 * Arbeitsbeginn aus den eigenen Business-freien Zeiten (Wandzeit-Spannen): an jedem sichtbaren Tag, an dem eine Spanne über Mitternacht läuft
 * und am Vormittag (bis 13:00) endet, ist ihr Ende der Arbeitsbeginn — der früheste davon. Ganz freie Tage (Wochenende) zählen nicht.
 * `null`, wenn es keinen gibt (dann gilt die Vorgabe 7:00).
 */
export function arbeitsbeginnAus(fenster: readonly { start: string; ende: string }[] | undefined, tage: readonly string[]): number | null {
  if (!fenster?.length) return null;
  let frueh: number | null = null;
  for (const tag of tage) {
    const mitternacht = `${tag}T00:00:00`;
    for (const f of fenster) {
      if (f.start > mitternacht || f.ende <= mitternacht || f.ende.slice(0, 10) !== tag) continue;
      const m = minuteVon(f.ende);
      if (m > 0 && m <= 13 * 60) frueh = frueh === null ? m : Math.min(frueh, m);
    }
  }
  return frueh;
}
