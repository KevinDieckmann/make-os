// ─── MAKE OS — Zeit & Fokus: das Modell (rein, getestet) ────────────────────
// Kevin (26.09. spät): „Wenn man im privaten Modus ist, wird auch dort Zeit
// gemessen — z. B. wenn man sich mit Gesundheit beschäftigt. Dann kann man das
// Ganze mit Fokus auch wieder messen: wo wie viel Zeit aufgenommen wird, was
// wieder in den Wachstums-Score einfließt."
//
// Zwei Arten von Zeit, beide je Person, je Tag, je Schlüssel `space:bereich`:
//   auto     — läuft mit, solange eine Seite sichtbar ist (Anwesenheits-Ping alle 30 s)
//   bewusst  — was man mit dem Fokus-Zähler im Kopf ausdrücklich gestartet hat
// Bewusste Zeit zählt in den Indizes stärker (Kevins Entscheidung 26.09.).
//
// Alles hier ist reine Rechnung ohne Dateizugriff; der Speicher liegt in speicher.ts.

import type { SpaceId } from '@/lib/make-one/space-regeln';
import { localDay } from '@/lib/zeit';

export type ZeitSpace = SpaceId | 'gemeinsam';

/**
 * Ein bewusster Block. Seit 27.09. spät (Kevin: „Fokus-Blöcke einer Aufgabe zuordnen, damit wir die Zeit je Einheit
 * sehen“) optional mit `aufgabeId` und `einheit` — beides nur im Business, gesäubert im Schreibweg
 * (lib/zeitmessung/einheiten.ts `zuordnungSaeubern`). Altbestand ohne die Felder bleibt gültig („ohne Einheit“).
 */
export interface FokusBlock { von: string; bis: string; schluessel: string; label: string; sek: number; aufgabeId?: string; einheit?: string; mandatId?: string; firmaId?: string }
/**
 * Zuordnung eines Blocks — nur die gesetzten Felder werden gespeichert. Seit 28.09. („Mandat an Zielen und Zeit“) auch
 * `mandatId`/`firmaId` (nur im Business): Zeit je Mandat für Abrechnung und Auslastung (lib/zeitmessung/mandate.ts).
 */
export interface BlockZuordnung { aufgabeId?: string; einheit?: string; mandatId?: string; firmaId?: string }
type ZuordnungsFeld = keyof BlockZuordnung;
const ZUORDNUNG_FELDER: readonly ZuordnungsFeld[] = ['aufgabeId', 'einheit', 'mandatId', 'firmaId'];
/** Ein Block ohne jede Zuordnung. */
const ohneZuordnung = (b: FokusBlock): Omit<FokusBlock, ZuordnungsFeld> => {
  const aus = { ...b };
  for (const f of ZUORDNUNG_FELDER) delete aus[f];
  return aus;
};
export interface ZeitTag { auto: Record<string, number>; bewusst: Record<string, number>; bloecke: FokusBlock[] }
export interface ZeitDatei {
  tage: Record<string, ZeitTag>;
  /** Der letzte Ping — daraus entsteht die Differenz, die verbucht wird. */
  letzter?: { at: string; schluessel: string };
}

export const LEER_ZEIT: ZeitDatei = { tage: {} };

/** Länger als so viel Stille zwischen zwei Pings zählt nicht (Fenster war zu, Rechner schlief). */
export const MAX_LUECKE_SEK = 90;
/** Ein bewusster Fokus-Block ist höchstens so lang (vergessener Zähler). */
export const MAX_FOKUS_SEK = 8 * 3600;
/** Ein Tag mit so viel bewusster Zeit zählt als Fokus-Tag. */
export const FOKUS_TAG_SEK = 25 * 60;
/** So viele Tage bleiben im Speicher. */
export const BEHALTEN_TAGE = 400;

export const schluesselFuer = (space: ZeitSpace, bereich: string): string => `${space}:${bereich}`;
export function teile(schluessel: string): { space: ZeitSpace; bereich: string } {
  const i = schluessel.indexOf(':');
  const space = i > 0 ? schluessel.slice(0, i) : 'gemeinsam';
  return { space: space === 'privat' || space === 'business' ? space : 'gemeinsam', bereich: i > 0 ? schluessel.slice(i + 1) : schluessel };
}

const leererTag = (): ZeitTag => ({ auto: {}, bewusst: {}, bloecke: [] });
const tagVon = (iso: string) => localDay(new Date(iso));
const ganz = (n: number) => Math.max(0, Math.round(n));

/** Ein Anwesenheits-Ping: die Zeit seit dem letzten Ping wird dem Schlüssel gutgeschrieben (höchstens MAX_LUECKE_SEK). */
export function verbuchen(d: ZeitDatei, at: string, schluessel: string): ZeitDatei {
  const tage = { ...d.tage };
  const letzter = d.letzter;
  if (letzter) {
    const delta = (Date.parse(at) - Date.parse(letzter.at)) / 1000;
    if (delta > 0 && delta <= MAX_LUECKE_SEK) {
      // Die Zeit gehört dem Schlüssel, auf dem man WAR (der letzte Ping), und dem Tag, an dem sie anfing.
      const tag = tagVon(letzter.at);
      const t = tage[tag] ? { ...tage[tag], auto: { ...tage[tag].auto } } : leererTag();
      t.auto[letzter.schluessel] = ganz((t.auto[letzter.schluessel] ?? 0) + delta);
      tage[tag] = t;
    }
  }
  return { ...d, tage, letzter: { at, schluessel } };
}

/** Nur gesetzte Zuordnungs-Felder übernehmen (kein `aufgabeId: undefined` im Bestand). */
const mitZuordnung = (b: Omit<FokusBlock, ZuordnungsFeld>, z: BlockZuordnung): FokusBlock => {
  const aus: FokusBlock = { ...b };
  for (const f of ZUORDNUNG_FELDER) if (z[f]) aus[f] = z[f];
  return aus;
};

/** Ein bewusster Fokus-Block ist zu Ende: Sekunden gutschreiben und den Block merken. Die Zuordnung muss schon gesäubert sein. */
export function fokusVerbuchen(d: ZeitDatei, block: { von: string; bis: string; schluessel: string; label: string } & BlockZuordnung): ZeitDatei {
  const sek = Math.min(MAX_FOKUS_SEK, ganz((Date.parse(block.bis) - Date.parse(block.von)) / 1000));
  if (!Number.isFinite(sek) || sek <= 0) return d;
  const tag = tagVon(block.von);
  const alt = d.tage[tag] ?? leererTag();
  const { von, bis, schluessel, label } = block;
  const neu = mitZuordnung({ von, bis, schluessel, label: label.slice(0, 60), sek }, block);
  const t: ZeitTag = { ...alt, bewusst: { ...alt.bewusst }, bloecke: [...alt.bloecke, neu].slice(-60) };
  t.bewusst[block.schluessel] = ganz((t.bewusst[block.schluessel] ?? 0) + sek);
  return { ...d, tage: { ...d.tage, [tag]: t } };
}

/**
 * Nachträglich zuordnen (27.09. spät): den Block mit diesem Anfang finden (zuerst am eigenen Tag, sonst überall) und
 * `aufgabeId`/`einheit`/`mandatId`/`firmaId` ersetzen — leere Felder entfernen die Zuordnung. Sekunden und Summen bleiben unverändert.
 * `gefunden: false` → Datei unverändert.
 */
export function blockZuordnen(d: ZeitDatei, von: string, z: BlockZuordnung): { datei: ZeitDatei; gefunden: boolean } {
  const tagDirekt = tagVon(von);
  const tage = [tagDirekt, ...Object.keys(d.tage).filter(t => t !== tagDirekt)];
  for (const tag of tage) {
    const t = d.tage[tag];
    const i = t?.bloecke?.findIndex(b => b.von === von) ?? -1;
    if (!t || i < 0) continue;
    const bloecke = [...t.bloecke];
    bloecke[i] = mitZuordnung(ohneZuordnung(t.bloecke[i]), z);
    return { datei: { ...d, tage: { ...d.tage, [tag]: { ...t, bloecke } } }, gefunden: true };
  }
  return { datei: d, gefunden: false };
}

/**
 * Umbuchen (27.09. spät, Kevin: „Privat-Blöcke nachträglich ins Business umbuchen können“): der Block bekommt den Space
 * `ziel` (Bereich bleibt), seine Sekunden wandern im selben Tag vom alten zum neuen Schlüssel der bewussten Zeit. Nach
 * Privat fallen Aufgabe, Einheit und Mandat weg (Privat trägt keine). Gleicher Space → unverändert, `gefunden: true`.
 */
export function blockUmbuchen(d: ZeitDatei, von: string, ziel: 'privat' | 'business'): { datei: ZeitDatei; gefunden: boolean } {
  const tagDirekt = tagVon(von);
  const tage = [tagDirekt, ...Object.keys(d.tage).filter(t => t !== tagDirekt)];
  for (const tag of tage) {
    const t = d.tage[tag];
    const i = t?.bloecke?.findIndex(b => b.von === von) ?? -1;
    if (!t || i < 0) continue;
    const alt = t.bloecke[i];
    const { space, bereich } = teile(alt.schluessel);
    if (space === ziel) return { datei: d, gefunden: true };
    const neuSchluessel = schluesselFuer(ziel, bereich);
    const bewusst = { ...t.bewusst };
    const rest = ganz((bewusst[alt.schluessel] ?? 0) - alt.sek);
    if (rest > 0) bewusst[alt.schluessel] = rest; else delete bewusst[alt.schluessel];
    bewusst[neuSchluessel] = ganz((bewusst[neuSchluessel] ?? 0) + alt.sek);
    const bloecke = [...t.bloecke];
    bloecke[i] = ziel === 'privat' ? { ...ohneZuordnung(alt), schluessel: neuSchluessel } : { ...alt, schluessel: neuSchluessel };
    return { datei: { ...d, tage: { ...d.tage, [tag]: { ...t, bewusst, bloecke } } }, gefunden: true };
  }
  return { datei: d, gefunden: false };
}

/** Alte Tage wegräumen, damit die Datei nicht endlos wächst. */
export function aufraeumen(d: ZeitDatei, heute: string, behalten = BEHALTEN_TAGE): ZeitDatei {
  const tage = Object.keys(d.tage).sort();
  if (tage.length <= behalten) return d;
  const weg = new Set(tage.slice(0, tage.length - behalten).filter(t => t < heute));
  if (!weg.size) return d;
  return { ...d, tage: Object.fromEntries(Object.entries(d.tage).filter(([t]) => !weg.has(t))) };
}

// ── Das Bild für Kopf, Widget und Indizes ───────────────────────────────────

export interface ZeitSumme {
  /** auto + bewusst je Space, Sekunden */
  gesamt: Record<ZeitSpace, number>;
  /** nur bewusst je Space, Sekunden */
  bewusst: Record<ZeitSpace, number>;
  /** auto + bewusst je Schlüssel `space:bereich` */
  jeSchluessel: Record<string, number>;
  /** nur bewusst je Schlüssel */
  bewusstJeSchluessel: Record<string, number>;
}
export interface ZeitBild {
  heute: string;
  tagHeute: ZeitSumme;
  /** die letzten 7 Tage inklusive heute */
  sieben: ZeitSumme;
  /** Tage der letzten 7 mit mindestens FOKUS_TAG_SEK bewusster Zeit, je Space */
  fokusTage: Record<ZeitSpace, number>;
  /** die bewussten Blöcke der letzten 7 Tage, neueste zuerst */
  bloecke: (FokusBlock & { tag: string })[];
}

const leereSumme = (): ZeitSumme => ({ gesamt: { privat: 0, business: 0, gemeinsam: 0 }, bewusst: { privat: 0, business: 0, gemeinsam: 0 }, jeSchluessel: {}, bewusstJeSchluessel: {} });

function summiere(in_: ZeitSumme, t: ZeitTag): void {
  for (const [k, sek] of Object.entries(t.auto)) { const { space } = teile(k); in_.gesamt[space] += sek; in_.jeSchluessel[k] = (in_.jeSchluessel[k] ?? 0) + sek; }
  for (const [k, sek] of Object.entries(t.bewusst)) {
    const { space } = teile(k);
    in_.gesamt[space] += sek; in_.bewusst[space] += sek;
    in_.jeSchluessel[k] = (in_.jeSchluessel[k] ?? 0) + sek;
    in_.bewusstJeSchluessel[k] = (in_.bewusstJeSchluessel[k] ?? 0) + sek;
  }
}

/** Die letzten n Tage als Liste YYYY-MM-DD, älteste zuerst, heute zuletzt. */
export function letzteTage(heute: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${heute}T12:00:00`);
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - i); out.push(localDay(x)); }
  return out;
}

export function bild(d: ZeitDatei, heute: string): ZeitBild {
  const tagHeute = leereSumme(), sieben = leereSumme();
  const fokusTage: Record<ZeitSpace, number> = { privat: 0, business: 0, gemeinsam: 0 };
  const bloecke: (FokusBlock & { tag: string })[] = [];
  for (const tag of letzteTage(heute, 7)) {
    const t = d.tage[tag];
    if (!t) continue;
    summiere(sieben, t);
    if (tag === heute) summiere(tagHeute, t);
    const bewusstJeSpace: Record<ZeitSpace, number> = { privat: 0, business: 0, gemeinsam: 0 };
    for (const [k, sek] of Object.entries(t.bewusst)) bewusstJeSpace[teile(k).space] += sek;
    for (const s of ['privat', 'business', 'gemeinsam'] as ZeitSpace[]) if (bewusstJeSpace[s] >= FOKUS_TAG_SEK) fokusTage[s] += 1;
    for (const b of t.bloecke ?? []) bloecke.push({ ...b, tag });
  }
  bloecke.sort((a, b) => b.von.localeCompare(a.von));
  return { heute, tagHeute, sieben, fokusTage, bloecke: bloecke.slice(0, 30) };
}

/** Zeit für einen Bereich in einem Space, Sekunden (auto + bewusst). */
export function bereichZeit(s: ZeitSumme, space: ZeitSpace, bereich: string): number {
  return s.jeSchluessel[schluesselFuer(space, bereich)] ?? 0;
}

/** Die Bereiche eines Space nach Zeit, größte zuerst. */
export function bereicheNachZeit(s: ZeitSumme, space: ZeitSpace, n = 6): { bereich: string; sek: number; bewusst: number }[] {
  return Object.entries(s.jeSchluessel)
    .map(([k, sek]) => ({ ...teile(k), sek, bewusst: s.bewusstJeSchluessel[k] ?? 0 }))
    .filter(x => x.space === space && x.sek > 0)
    .sort((a, b) => b.sek - a.sek)
    .slice(0, n)
    .map(({ bereich, sek, bewusst }) => ({ bereich, sek, bewusst }));
}

/** „1 h 20“, „25 min“, „—“ */
export function zeitText(sek: number): string {
  if (!sek || sek < 60) return sek > 0 ? '< 1 min' : '—';
  const min = Math.round(sek / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

export const stunden = (sek: number): number => Math.round((sek / 3600) * 10) / 10;
