// ─── Löschfristen je Datenart (28.09., U2 #52, rein, getestet) ───────────────
// Art. 5 Abs. 1 lit. e DSGVO (Speicherbegrenzung): EINE Tabelle, welche Daten wie
// lange bleiben. Die Werte sind Vorschläge — unter Stammdaten › Datenschutz
// anpassbar. Gespeichert wird nur, was vom Standard abweicht (`fristenSpeichern`):
// der Standard steht im Code und wird nie in den Bestand geschrieben.
//
//   Datenart                   Standard    Wirkung (täglicher Takt-Lauf, lib/crm/loeschfristen-lauf.ts)
//   Kontakte ohne Beziehung    24 Monate   KEINE automatische Löschung — eine Aufgabe „prüfen: löschen
//                                          oder begründen“; je Person „Frist verlängern mit Grund“
//   Import-Konflikte           90 Tage     automatisch bereinigt (Protokoll „System“)
//   Import-Läufe               30 Tage     automatisch (lib/crm/import-lauf.ts, besteht seit K2)
//   Heads-Replay               90 Tage     automatisch bereinigt
//   Signale (Betreff/Titel)    12 Monate   Text der Signal-Aktivität entfernt, das Ereignis bleibt
//   Änderungsprotokoll         36 Monate   Monatsdateien geleert (Vermerk bleibt)
//   Aktivitäten-Texte bei      sofort      Art. 17 über lib/crm/person-bestaende.ts (fest, nicht einstellbar)
//     gelöschten Personen
//
// Keine Rechtsberatung — die Werte einmal anwaltlich gegenlesen.

import { letzterKontaktVon, type Kontakt, type Aktivitaet } from '@/lib/make-one/crm';
import type { CrmBestand } from './typen';

export type FristArt = 'kontakte' | 'import-konflikte' | 'import-laeufe' | 'heads-replay' | 'signale' | 'aenderungsprotokoll' | 'aktivitaeten-geloeschte';
export type Einheit = 'tage' | 'monate';

export interface FristDef {
  id: FristArt; titel: string; einheit: Einheit; standard: number; min: number; max: number;
  /** automatisch bereinigt (technischer Bestand) — sonst nur eine Aufgabe (Personen) bzw. fest (Art. 17). */
  wirkung: 'automatisch' | 'aufgabe' | 'fest';
  norm: string; hinweis: string;
}

export const LOESCHFRISTEN: readonly FristDef[] = [
  { id: 'kontakte', titel: 'Kontakte ohne Beziehung und Aktivität', einheit: 'monate', standard: 24, min: 6, max: 120, wirkung: 'aufgabe', norm: 'Art. 5 Abs. 1 lit. e DSGVO', hinweis: 'Nie automatisch gelöscht: der Takt legt eine Aufgabe an — löschen oder mit Grund verlängern.' },
  { id: 'import-konflikte', titel: 'Import-Konflikte', einheit: 'tage', standard: 90, min: 7, max: 365, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. e DSGVO', hinweis: 'Offene Konflikte eines Imports, der älter ist, fallen weg — der nächste Import legt sie neu vor.' },
  { id: 'import-laeufe', titel: 'Import-Läufe (Rückgängig)', einheit: 'tage', standard: 30, min: 1, max: 90, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. e DSGVO', hinweis: 'Vorher-Stände für „Import rückgängig“.' },
  { id: 'heads-replay', titel: 'Heads-Replay (Datenpakete für Evals)', einheit: 'tage', standard: 90, min: 7, max: 365, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. c, e DSGVO', hinweis: 'Gespeicherte Datenpakete der Heads-Läufe.' },
  { id: 'signale', titel: 'Signale (Betreff, Termintitel)', einheit: 'monate', standard: 12, min: 1, max: 60, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. c, e DSGVO', hinweis: 'Der Text der Signal-Aktivität fällt weg, das Ereignis (Tag, Art) bleibt für die Kadenz.' },
  { id: 'aenderungsprotokoll', titel: 'Änderungsprotokoll', einheit: 'monate', standard: 36, min: 12, max: 120, wirkung: 'automatisch', norm: 'Art. 5 Abs. 2, Art. 32 DSGVO', hinweis: 'Monatsdateien älter als die Frist werden geleert (ohne Werte, nur Kennungen).' },
  { id: 'aktivitaeten-geloeschte', titel: 'Aktivitäten-Texte bei gelöschten Personen', einheit: 'tage', standard: 0, min: 0, max: 0, wirkung: 'fest', norm: 'Art. 17 DSGVO', hinweis: 'Sofort mit der Löschung — über alle Speicher (lib/crm/person-bestaende.ts).' },
];

export type Fristen = Record<FristArt, number>;
/** Nur die Abweichungen vom Standard (so steht es im Bestand). */
export type FristenGespeichert = Partial<Record<FristArt, number>>;

export const LOESCHFRISTEN_SPEICHER = 'crm-loeschfristen';
export interface LoeschfristenBestand {
  fristen?: FristenGespeichert;
  /** Tagesmarke des Takt-Laufs und was er getan hat (nur Zahlen). */
  lauf?: { tag: string; am: string; ueberFrist: number; bereinigt: Record<string, number> };
}

const def = (id: FristArt) => LOESCHFRISTEN.find(f => f.id === id)!;

/** Wirksame Fristen: Standard, überschrieben von den gespeicherten Abweichungen (nur gültige). */
export function fristenWirksam(gespeichert?: FristenGespeichert | null): Fristen {
  const out = {} as Fristen;
  for (const f of LOESCHFRISTEN) {
    const v = gespeichert?.[f.id];
    out[f.id] = f.wirkung !== 'fest' && typeof v === 'number' && Number.isInteger(v) && v >= f.min && v <= f.max ? v : f.standard;
  }
  return out;
}

/**
 * Eine Änderung prüfen und das zu Speichernde bilden: nur bekannte, einstellbare Arten, ganze Zahlen im Rahmen;
 * `null` = zurück auf Standard. Ein Wert gleich dem Standard wird NICHT gespeichert (Standard nie im Bestand).
 */
export function fristenSpeichern(alt: FristenGespeichert | undefined, aenderung: unknown): { ok: true; fristen: FristenGespeichert } | { ok: false; fehler: string } {
  if (!aenderung || typeof aenderung !== 'object' || Array.isArray(aenderung)) return { ok: false, fehler: 'fristen: Objekt je Datenart erwartet.' };
  const out: FristenGespeichert = { ...(alt ?? {}) };
  for (const [id, v] of Object.entries(aenderung as Record<string, unknown>)) {
    const f = LOESCHFRISTEN.find(x => x.id === id);
    if (!f) return { ok: false, fehler: `Unbekannte Datenart: ${id}.` };
    if (f.wirkung === 'fest') return { ok: false, fehler: `${f.titel}: fest (${f.norm}), nicht einstellbar.` };
    if (v === null || v === f.standard) { delete out[f.id]; continue; }
    const n = Number(v);
    if (!Number.isInteger(n) || n < f.min || n > f.max) return { ok: false, fehler: `${f.titel}: ${f.min}–${f.max} ${f.einheit === 'monate' ? 'Monate' : 'Tage'}.` };
    out[f.id] = n;
  }
  return { ok: true, fristen: out };
}

/** Anzeige „24 Monate“, „90 Tage“, „sofort“. */
export function fristText(id: FristArt, wert: number): string {
  if (def(id).wirkung === 'fest' || wert === 0) return 'sofort';
  const monate = def(id).einheit === 'monate';
  return `${wert} ${monate ? (wert === 1 ? 'Monat' : 'Monate') : (wert === 1 ? 'Tag' : 'Tage')}`;
}

// ── Grenzen ──────────────────────────────────────────────────────────────────

const TAG = /^\d{4}-\d{2}-\d{2}/;
/** `heute` minus n Monate, am Monatsende gekappt (31.03. − 1 Monat = 28./29.02.). */
export function monateZurueck(heute: string, n: number): string {
  const [j, m, t] = heute.slice(0, 10).split('-').map(Number);
  const gesamt = j * 12 + (m - 1) - n;
  const jj = Math.floor(gesamt / 12), mm = gesamt % 12;
  const letzter = new Date(Date.UTC(jj, mm + 1, 0)).getUTCDate();
  return `${String(jj).padStart(4, '0')}-${String(mm + 1).padStart(2, '0')}-${String(Math.min(t, letzter)).padStart(2, '0')}`;
}
export function tageZurueck(heute: string, n: number): string {
  const d = new Date(`${heute.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
/** Der Stichtag einer Frist: älter (kleiner) als dieser Tag ist über der Frist. */
export function stichtag(id: FristArt, wert: number, heute: string): string {
  return def(id).einheit === 'monate' ? monateZurueck(heute, wert) : tageZurueck(heute, wert);
}

// ── Kontakte über der Frist (nie automatisch löschen) ─────────────────────────

/** Tag eines Zeitpunkts (ISO mit Zone → UTC-Tag reicht für eine Frist in Monaten; Tag bleibt Tag). */
const tagAus = (v?: string) => (v && TAG.test(v) ? v.slice(0, 10) : undefined);
/** Menschliche Aktivität (nicht vom System) — nur sie zählt als „Aktivität“ für die Frist. */
const menschlich = (a: Aktivitaet) => a.von !== 'system' && a.art !== 'system' && a.art !== 'uebergabe' && a.art !== 'stufe';

/** Die jüngste Spur der Person: letzter Kontakt, jüngste menschliche Aktivität (Ereignis- vor Erfassungszeit), Import. */
export function letzteSpur(k: Kontakt, heute: string): string {
  const l = [letzterKontaktVon(k, heute), tagAus(k.importiertAm), tagAus(k.geprueftAm),
    ...(k.aktivitaeten ?? []).filter(menschlich).map(a => tagAus(a.wann) ?? tagAus(a.am))].filter((x): x is string => !!x && x <= heute);
  return l.sort().pop() ?? heute;
}

export interface UeberFrist { id: string; seit: string }

/**
 * Personen ohne Beziehung und ohne Aktivität seit der Frist. Nie darunter: Kunden/Ex-Kunden/Partner/Multiplikatoren
 * (Lebensphase oder Rolle), Personen in einem Mandat oder offenen Deal, eingeschränkte Personen (Art. 18 heißt
 * „aufbewahren“) und Personen mit gültiger Fristverlängerung. Werbesperren zählen mit — die Sperre überlebt die
 * Löschung auf der gehashten Sperrliste.
 */
export function kontakteUeberFrist(kontakte: Kontakt[], crm: Pick<CrmBestand, 'mandate' | 'chancen'> | null | undefined, heute: string, monate: number): UeberFrist[] {
  const grenze = monateZurueck(heute, monate);
  const inMandat = new Set((crm?.mandate ?? []).flatMap(m => m.kontaktIds ?? []));
  const inDeal = new Set((crm?.chancen ?? []).filter(c => c.stufe !== 'gewonnen' && c.stufe !== 'verloren').flatMap(c => c.kontaktIds ?? []));
  const BEZIEHUNG = ['kunde', 'ex_kunde', 'partner', 'multiplikator'];
  const raus: UeberFrist[] = [];
  for (const k of kontakte) {
    if (BEZIEHUNG.includes(k.lebensphase ?? '') || (k.rollen ?? []).some(r => r === 'partner' || r === 'multiplikator' || r === 'investor')) continue;
    if (inMandat.has(k.id) || inDeal.has(k.id) || k.eingeschraenkt) continue;
    if (k.loeschfristVerlaengert && k.loeschfristVerlaengert.bis >= heute) continue;
    const seit = letzteSpur(k, heute);
    if (seit < grenze) raus.push({ id: k.id, seit });
  }
  return raus.sort((a, b) => a.seit.localeCompare(b.seit));
}

/** Eine Fristverlängerung prüfen (Grund Pflicht, bis höchstens 36 Monate ab heute). */
export function verlaengerungPruefen(roh: { bis?: unknown; grund?: unknown }, heute: string): { ok: true; bis: string; grund: string } | { ok: false; fehler: string } {
  const grund = String(roh.grund ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const bis = String(roh.bis ?? '');
  if (grund.length < 3) return { ok: false, fehler: 'Frist verlängern nur mit Grund.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bis) || bis <= heute) return { ok: false, fehler: 'bis: ein Tag nach heute.' };
  const spaetestens = monateZurueck(heute, -36);
  if (bis > spaetestens) return { ok: false, fehler: `Höchstens bis ${spaetestens} (36 Monate).` };
  return { ok: true, bis, grund };
}

// ── Technische Bestände (automatisch) ────────────────────────────────────────

/** Signal-Aktivität (Mail-Betreff/Termintitel aus lib/crm/signale.ts): vom System, Bezug mail-/termin-. */
export const istSignal = (a: Pick<Aktivitaet, 'von' | 'bezug'>) => a.von === 'system' && /^(mail|termin)-/.test(a.bezug ?? '');

/** Signal-Texte älter als die Frist entfernen — das Ereignis (am, art, bezug) bleibt. Liefert die Zahl der geleerten. */
export function signalTexteBereinigen(k: Kontakt, grenze: string): { kontakt: Kontakt; n: number } {
  let n = 0;
  const aktivitaeten = (k.aktivitaeten ?? []).map(a => {
    if (!istSignal(a) || !a.text || (a.am.slice(0, 10) >= grenze)) return a;
    n++;
    const { text: _t, ...rest } = a;
    return rest;
  });
  return n ? { kontakt: { ...k, aktivitaeten }, n } : { kontakt: k, n: 0 };
}

/** Replay-Fälle älter als die Frist raus (Zeitpunkt `zeit`, ISO). */
export function replayBereinigen<F extends { zeit: string }>(faelle: F[], grenze: string): { faelle: F[]; n: number } {
  const bleiben = faelle.filter(f => (f.zeit ?? '').slice(0, 10) >= grenze);
  return { faelle: bleiben, n: faelle.length - bleiben.length };
}

/** Monatsdateien (JJJJ-MM) des Änderungsprotokolls, die ganz vor dem Stichtag liegen. */
export function protokollMonateUeberFrist(monate: string[], grenze: string): string[] {
  const grenzMonat = grenze.slice(0, 7);
  return monate.filter(m => /^\d{4}-\d{2}$/.test(m) && m < grenzMonat).sort();
}
