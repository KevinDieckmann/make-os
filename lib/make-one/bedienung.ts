// ─── Bedienung: Zeilen-Aktionen und Listen — die Regeln (10.10., DESIGN_STANDARD.md › Zeilen-Aktionen) ─────────────────────────
// Kevin 10.10. (Bildschirmfoto Mandate): die Rand-Knöpfe Archivieren/Löschen lagen beim Überfahren ÜBER dem Inhalt. „Löschen und
// Archivieren muss anders laufen — z. B. nach links wischen oder rechts mit drei Punkten und Einstellungen. Denk drauf rum, was für
// Einstellungen zusätzlich Sinn machen. Bau den Standard überall mit ein.“
//   · Rechner: rechts ein ruhiges „⋯“ in einer EIGENEN Spalte (nie über dem Inhalt) → Menü mit Öffnen · Link kopieren · In neuem Tab ·
//     Einträge der Liste · ─ · Archivieren/Zurückholen · Löschen.
//   · Handy: nach LINKS wischen = Archivieren, nach RECHTS = Löschen (Vorgabe) — ab der Schwelle ausgelöst, darunter schnappt die Zeile zurück.
//   · Einstellungen je Gerät (Einstellungen › Bedienung): Wisch-Richtungen, „Vor dem Löschen nachfragen“, „⋯ immer sichtbar“, Dichte der
//     Listen, kurzes Vibrieren.
// Warum im Browser (localStorage) und nicht auf dem Server: es sind Eigenschaften des GERÄTS (Wischen gibt es nur am Handy, Vibrieren
// kann nicht jedes Gerät, die Dichte hängt am Bildschirm) — keine Personendaten, kein Bestand, kein Netz nötig, sofort wirksam. Ohne
// Speicher (privates Fenster, gesperrt) gilt die Vorgabe. Rein und client-sicher (kein React), damit Baustein, Seite und Wächter dieselbe
// Regel lesen.

export type WischWahl = 'archivieren' | 'loeschen' | 'aktionen' | 'aus';
export type WischRichtung = 'links' | 'rechts';
export type WischZiel = Exclude<WischWahl, 'aus'>;
export type Dichte = 'normal' | 'kompakt';

export interface Bedienung {
  /** Was „nach links wischen“ tut (Vorgabe Archivieren). */
  wischenLinks: WischWahl;
  /** Was „nach rechts wischen“ tut (Vorgabe Löschen). */
  wischenRechts: WischWahl;
  /** Vor dem Löschen eine Rückfrage zeigen (Vorgabe aus — danach steht 10 s „Rückgängig“). */
  loeschenNachfragen: boolean;
  /** „⋯“ am Rechner immer zeigen (Vorgabe: nur beim Überfahren/Fokus — am Handy steht es immer). */
  mehrImmer: boolean;
  /** Dichte der Listen-Zeilen (kompakt = weniger Luft, Tippziel bleibt ≥ 44 px). */
  dichte: Dichte;
  /** Kurz vibrieren, wenn ein Wischen auslöst (nur Geräte, die es können; Vorgabe aus). */
  haptik: boolean;
}

export const BEDIENUNG_VORGABE: Readonly<Bedienung> = Object.freeze({
  wischenLinks: 'archivieren', wischenRechts: 'loeschen', loeschenNachfragen: false, mehrImmer: false, dichte: 'normal', haptik: false,
});

/** Merker im Browser (je Gerät). */
export const BEDIENUNG_MERKER = 'make-bedienung';
/** Ereignis nach jeder Änderung — alle Zeilen der offenen Seite lesen neu. */
export const BEDIENUNG_EREIGNIS = 'make-bedienung-geaendert';

export const WISCH_WAHLEN: readonly { id: WischWahl; label: string }[] = [
  { id: 'archivieren', label: 'Archivieren' },
  { id: 'loeschen', label: 'Löschen' },
  { id: 'aktionen', label: 'Aktionen zeigen' },
  { id: 'aus', label: 'Aus' },
];
export const DICHTEN: readonly { id: Dichte; label: string }[] = [{ id: 'normal', label: 'Normal' }, { id: 'kompakt', label: 'Kompakt' }];

const istWisch = (x: unknown): x is WischWahl => typeof x === 'string' && WISCH_WAHLEN.some(w => w.id === x);

/** Nimmt nur, was passt — alles andere fällt auf die Vorgabe zurück (alter/verdorbener Merker bricht nichts). */
export function bedienungSaeubern(roh: unknown): Bedienung {
  const o = roh && typeof roh === 'object' && !Array.isArray(roh) ? roh as Record<string, unknown> : {};
  const v = BEDIENUNG_VORGABE;
  return {
    wischenLinks: istWisch(o.wischenLinks) ? o.wischenLinks : v.wischenLinks,
    wischenRechts: istWisch(o.wischenRechts) ? o.wischenRechts : v.wischenRechts,
    loeschenNachfragen: typeof o.loeschenNachfragen === 'boolean' ? o.loeschenNachfragen : v.loeschenNachfragen,
    mehrImmer: typeof o.mehrImmer === 'boolean' ? o.mehrImmer : v.mehrImmer,
    dichte: o.dichte === 'kompakt' || o.dichte === 'normal' ? o.dichte : v.dichte,
    haptik: typeof o.haptik === 'boolean' ? o.haptik : v.haptik,
  };
}

type Lesen = Pick<Storage, 'getItem'> | null;
type Schreiben = Pick<Storage, 'setItem' | 'removeItem'> | null;
const ortVon = <T>(speicher: T | null | undefined): T | Storage | null =>
  speicher === undefined ? (typeof localStorage === 'undefined' ? null : localStorage) : speicher;

/** Liest die Einstellungen dieses Geräts — leer, gesperrt oder kaputt → Vorgabe. */
export function bedienungLesen(speicher?: Lesen): Bedienung {
  try {
    const roh = ortVon(speicher)?.getItem(BEDIENUNG_MERKER);
    return bedienungSaeubern(roh ? JSON.parse(roh) : null);
  } catch { return { ...BEDIENUNG_VORGABE }; }
}

/**
 * Schreibt nur Abweichungen von der Vorgabe (wie die Flächen: der Standard wird nie gespeichert) — alles Vorgabe → Merker weg.
 * `false`, wenn der Speicher scheitert (dann gilt die Wahl bis zum Neuladen).
 */
export function bedienungSchreiben(b: Bedienung, speicher?: Schreiben): boolean {
  const s = bedienungSaeubern(b);
  const ab: Partial<Bedienung> = {};
  for (const k of Object.keys(BEDIENUNG_VORGABE) as (keyof Bedienung)[]) if (s[k] !== BEDIENUNG_VORGABE[k]) (ab as Record<string, unknown>)[k] = s[k];
  try {
    const ort = ortVon(speicher);
    if (!ort) return false;
    if (Object.keys(ab).length) ort.setItem(BEDIENUNG_MERKER, JSON.stringify(ab)); else ort.removeItem(BEDIENUNG_MERKER);
    return true;
  } catch { return false; }
}

// ── Wischen ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ab so vielen Pixeln steht fest, ob gewischt (waagerecht) oder gescrollt (senkrecht) wird. */
export const RICHTUNG_AB = 10;
/** Waagerecht erst, wenn |dx| > WAAGERECHT_FAKTOR · |dy| — schräg zählt als Scrollen (senkrecht hat Vorrang). */
export const WAAGERECHT_FAKTOR = 1.2;

/** Was ein Wischen in diese Richtung tut — `null`, wenn die Einstellung „aus“ sagt oder die Liste die Aktion nicht hat. */
export function wischZiel(richtung: WischRichtung, b: Pick<Bedienung, 'wischenLinks' | 'wischenRechts'>, kann: { archivieren: boolean; loeschen: boolean; menue: boolean }): WischZiel | null {
  const w = richtung === 'links' ? b.wischenLinks : b.wischenRechts;
  if (w === 'archivieren') return kann.archivieren ? w : null;
  if (w === 'loeschen') return kann.loeschen ? w : null;
  if (w === 'aktionen') return kann.menue ? w : null;
  return null;
}

/** Auslöse-Schwelle in Pixeln: ein knappes Drittel der Zeile, mindestens 72, höchstens 140 (am Handy ≈ 110 px). */
export function wischSchwelle(breite: number): number {
  const b = Number.isFinite(breite) && breite > 0 ? breite : 340;
  return Math.round(Math.min(140, Math.max(72, b * 0.32)));
}

/** Versatz der Zeile beim Ziehen: bis 1,25 × Schwelle 1:1, darüber zäh (Gummiband) — so sieht man, dass es „reicht“. */
export function wischVersatz(dx: number, schwelle: number): number {
  const grenze = schwelle * 1.25;
  const a = Math.abs(dx);
  const v = a <= grenze ? a : grenze + (a - grenze) * 0.3;
  return Math.sign(dx) * v;
}

/** Löst das Wischen aus? Erst ab der Schwelle — darunter schnappt die Zeile zurück. */
export const wischScharf = (dx: number, schwelle: number): boolean => Math.abs(dx) >= schwelle;

// ── Menü ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Nur interne Wege der App (`/os…`, `/zoe…`) — „Link kopieren“ und „In neuem Tab öffnen“ bieten nie eine fremde Adresse an.
 * Links baut der Aufrufer über `WEG` (lib/wege.ts).
 */
export function internerWeg(href: string | undefined | null): href is string {
  return typeof href === 'string' && /^\/(os|zoe)(\/|\?|#|$)/.test(href) && !href.startsWith('//') && !/[\s\\]/.test(href);
}

/** Die drei Gruppen des Menüs in fester Reihenfolge: Allgemeines oben, Einträge der Liste, unten getrennt Archiv/Papierkorb. */
export const MENUE_GRUPPEN = ['allgemein', 'mehr', 'ablage'] as const;
export type MenueGruppe = typeof MENUE_GRUPPEN[number];
