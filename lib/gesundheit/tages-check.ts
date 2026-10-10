// ─── Tages-Check „wie im WHOOP-Journal“ (09.10.2026) — Katalog, Säuberung, Auswertung (rein, getestet) ──────────────────
// Wunsch (Sport-Fragebogen, 09.10.): „Fragen wie im WHOOP-Journal“ — ein kurzer Check (Alkohol? Koffein spät? genug getrunken?
// spät gegessen? Bildschirm vor dem Schlafen?), in 10 Sekunden am Handy. Die WHOOP-API liefert die Journal-Antworten NICHT
// (kein Endpunkt, kein Scope, kein Datentyp — research/whoop/FAKTEN_WHOOP.md › 9), also fragt MAKE OS selbst.
//
// Kein Weg daneben: die Antworten stehen im vorhandenen Journal der Person (`journal--<person>`, Feld `check` am Tag — das Journal
// trägt schon den „Tages-Check“ Stimmung/Energie/Stress), geschrieben über PATCH /api/state/journal bzw. ZOE `journal_eintrag`.
// Welche Fragen eine Person sieht, ist IHRE Einstellung (lib/gesundheit/alltag.ts › check) — ohne Einstellung die Vorgabe unten.
//
// Auswertung (nur eigene Daten, ab einer Mindestmenge): eine Antwort für Tag D wirkt auf die Nacht D → D+1; WHOOP und der
// Morgen-Check schreiben diese Nacht auf den Tag des Aufwachens (D+1). Verglichen werden Ø Schlaf und Ø Recovery an Tagen mit
// „ja“ gegen Tage mit „nein“ — ein Zusammenhang, kein Beweis für eine Ursache (so steht es auch in der Karte).
//
// Stress (Entscheidung 10.10.: „Nur Anspannung 1–5“): die Ja/Nein-Frage „Stressiger Tag?“ gibt es nicht mehr (`CHECK_ABGELOEST`). Stress kommt in
// der Auswertung aus der Anspannung des Tages (Journal-Feld `stress`, 1–5, Morgen-Check unter Gesundheit › Heute): ≥ 4 = gestresst, 1–3 =
// nicht, fehlt = kein Datenpunkt (`gestresstAusAnspannung`, Merkmal `ANSPANNUNG_ID`). Gespeicherte `check.stress`-Antworten bleiben im
// Journal liegen (nichts gelöscht, auch nicht beim nächsten Schreiben des Tages), werden aber weder angezeigt noch ausgewertet.

import type { VitalsLog } from '@/lib/vitals';
import { tagePlus } from '@/lib/zeit';

export interface CheckFrage {
  id: string;
  /** Die Frage, wie sie am Handy steht (kurz). */
  frage: string;
  /** Kurzname für Auswertung und Listen. */
  kurz: string;
  /** true = „ja“ ist eher günstig (z. B. genug getrunken) — nur für die Farbe der Antwort, nie für eine Wertung der Person. */
  jaGut?: true;
}

/** Der Katalog (Daten, allgemein — keine Frage einer bestimmten Person). Kennung nie ändern: die Antworten liegen darunter. */
export const CHECK_FRAGEN: readonly CheckFrage[] = [
  { id: 'koffein-spaet', frage: 'Koffein nach 14 Uhr?', kurz: 'Koffein spät' },
  { id: 'alkohol', frage: 'Alkohol getrunken?', kurz: 'Alkohol' },
  { id: 'getrunken', frage: 'Genug Wasser getrunken?', kurz: 'Genug getrunken', jaGut: true },
  { id: 'bildschirm-spaet', frage: 'Bildschirm in der Stunde vor dem Schlafen?', kurz: 'Bildschirm spät' },
  { id: 'spaet-gegessen', frage: 'Spät gegessen (2–3 h vor dem Schlafen)?', kurz: 'Spät gegessen' },
  { id: 'training-spaet', frage: 'Am Abend trainiert?', kurz: 'Spät trainiert' },
  { id: 'draussen', frage: 'Tageslicht draußen getankt?', kurz: 'Draußen', jaGut: true },
];
export type CheckFrageId = string;
/** Vorgabe ohne eigene Auswahl: die fünf Fragen aus dem Wunsch (WHOOP-Journal-Stil), in 10 Sekunden beantwortet. */
export const CHECK_VORGABE: readonly string[] = ['koffein-spaet', 'alkohol', 'getrunken', 'bildschirm-spaet', 'spaet-gegessen'];
/** Höchstens so viele Fragen gleichzeitig (am Handy ohne Rollen). Mehr → 413. */
export const CHECK_MAX = 6;
/** Mindestmenge je Gruppe (Tage mit „ja“ UND Tage mit „nein“), bevor die Auswertung etwas sagt. */
export const CHECK_MINDEST = 3;
/** So weit zurück wertet die Karte aus (Tage). */
export const CHECK_TAGE = 60;
/** Bis zu dieser Stunde fragt die Karte nach GESTERN (morgens beantwortet man den Vortag, wie im WHOOP-Journal). */
export const CHECK_GESTERN_BIS = 14;

export const istCheckFrage = (id: unknown): boolean => typeof id === 'string' && CHECK_FRAGEN.some(f => f.id === id);

/**
 * Abgelöste Fragen: nicht mehr wählbar und nicht mehr zu beantworten (400), nicht angezeigt, nicht ausgewertet — gespeicherte Antworten
 * bleiben im Journal liegen (`checkAnwenden` nimmt sie mit). Kennung nie wiederverwenden.
 * `stress` (Entscheidung 10.10.: „Nur Anspannung 1–5“) → Stress kommt aus der Anspannung des Morgen-Checks (`gestresstAusAnspannung`).
 */
export const CHECK_ABGELOEST: readonly string[] = ['stress'];
export const istAbgeloest = (id: unknown): boolean => typeof id === 'string' && CHECK_ABGELOEST.includes(id);
/** Warum eine abgelöste Frage nicht mehr geht (Fehlertext für Journal, ZOE und Einstellungen). */
export const abgeloestText = (id: string): string => `„${id.slice(0, 40)}“ fragt der Check nicht mehr — Stress kommt aus der Anspannung 1–5 im Morgen-Check.`;

// ── Stress aus der Anspannung (10.10.) ─────────────────────────────────────────────────────────────────────────────────

/** Kennung des Merkmals „Stress“ in der Auswertung (kein Eintrag im Katalog, nicht wählbar — es kommt aus der Anspannung). */
export const ANSPANNUNG_ID = 'anspannung';
/** Ab dieser Anspannung (1–5) gilt ein Tag als gestresst. */
export const ANSPANNUNG_STRESS_AB = 4;
/** Das Merkmal, wie es in der Auswertung steht. */
export const ANSPANNUNG_MERKMAL = { id: ANSPANNUNG_ID, kurz: 'Stress', quelle: 'Anspannung (Morgen-Check)' } as const;
/** Hinweis zur Quelle (Karte). */
export const ANSPANNUNG_HINWEIS = `„Stress“ kommt aus deiner Anspannung (Morgen-Check): ${ANSPANNUNG_STRESS_AB}–5 zählt als gestresst, 1–${ANSPANNUNG_STRESS_AB - 1} nicht.`;

/**
 * War der Tag gestresst? Aus der Anspannung 1–5 des Tages (Journal-Feld `stress`): ≥ 4 → ja, 1–3 → nein, fehlt/ungültig → kein
 * Datenpunkt (undefined). Rein — die EINE Stelle dieser Regel.
 */
export function gestresstAusAnspannung(anspannung: unknown): boolean | undefined {
  if (typeof anspannung !== 'number' || !Number.isFinite(anspannung) || anspannung < 1 || anspannung > 5) return undefined;
  return Math.round(anspannung) >= ANSPANNUNG_STRESS_AB;
}

/** Die aktiven Fragen einer Person: ihre Auswahl (Reihenfolge des Katalogs), ohne Auswahl die Vorgabe. */
export function aktiveFragen(einstellung?: { fragen?: readonly string[] } | null): CheckFrage[] {
  const ids = new Set(einstellung?.fragen ?? CHECK_VORGABE);
  return CHECK_FRAGEN.filter(f => ids.has(f.id));
}

/** Antworten eines Tages: Frage → ja/nein. */
export type CheckAntworten = Record<string, boolean>;

/**
 * Eingang säubern (Route und ZOE): nur Kennungen aus dem Katalog, Werte `true`/`false` oder `null` (= Antwort entfernen).
 * Unbekannte Kennung oder anderer Wert → Fehler (400), nichts wird still verworfen.
 */
export function checkEingangSaeubern(roh: unknown): { ok: true; werte: Record<string, boolean | null> } | { ok: false; fehler: string } {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, fehler: 'check: bitte als Objekt { frage: true | false | null }.' };
  const werte: Record<string, boolean | null> = {};
  for (const [k, v] of Object.entries(roh as Record<string, unknown>)) {
    if (istAbgeloest(k)) return { ok: false, fehler: `check: ${abgeloestText(k)}` };
    if (!istCheckFrage(k)) return { ok: false, fehler: `check: unbekannte Frage „${k.slice(0, 40)}“.` };
    if (v !== true && v !== false && v !== null) return { ok: false, fehler: `check: „${k}“ braucht ja (true), nein (false) oder null.` };
    werte[k] = v;
  }
  if (!Object.keys(werte).length) return { ok: false, fehler: 'check: keine Antwort.' };
  return { ok: true, werte };
}

/** Gespeicherte Antworten säubern (beim Lesen) — nur Katalog-Kennungen mit echtem ja/nein. */
export function checkSaeubern(roh: unknown): CheckAntworten | undefined {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return undefined;
  const a: CheckAntworten = {};
  for (const [k, v] of Object.entries(roh as Record<string, unknown>)) if (istCheckFrage(k) && typeof v === 'boolean') a[k] = v;
  return Object.keys(a).length ? a : undefined;
}

/** Gespeicherte Antworten abgelöster Fragen (bleiben im Journal liegen, werden nie gezeigt oder ausgewertet). Rein. */
export function abgeloesteAntworten(roh: unknown): CheckAntworten {
  const a: CheckAntworten = {};
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return a;
  for (const [k, v] of Object.entries(roh as Record<string, unknown>)) if (istAbgeloest(k) && typeof v === 'boolean') a[k] = v;
  return a;
}

/**
 * Neue Antworten auf die alten legen; `null` entfernt eine. Antworten abgelöster Fragen bleiben stehen (nichts gelöscht).
 * Leer → undefined (das Feld fällt weg).
 */
export function checkAnwenden(alt: unknown, neu: Record<string, boolean | null>): CheckAntworten | undefined {
  const a: CheckAntworten = { ...abgeloesteAntworten(alt), ...(checkSaeubern(alt) ?? {}) };
  for (const [k, v] of Object.entries(neu)) { if (v === null) delete a[k]; else a[k] = v; }
  return Object.keys(a).length ? a : undefined;
}

/** Nach welchem Tag fragt die Karte gerade? Vor 14 Uhr nach gestern (Morgen-Check), sonst nach heute (Abend-Check). */
export function checkTagFuer(jetztWand: string): { tag: string; welcher: 'heute' | 'gestern' } {
  const heute = jetztWand.slice(0, 10);
  const h = Number(jetztWand.slice(11, 13));
  return Number.isFinite(h) && h < CHECK_GESTERN_BIS ? { tag: tagePlus(heute, -1), welcher: 'gestern' } : { tag: heute, welcher: 'heute' };
}

// ── Auswertung ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface CheckGruppe { n: number; schlaf?: number; rec?: number }
export interface CheckBefund {
  id: string;
  kurz: string;
  ja: CheckGruppe;
  nein: CheckGruppe;
  /** Ø Schlaf „ja“ minus „nein“ in Minuten, Ø Recovery „ja“ minus „nein“ in Punkten. */
  schlafDiffMin?: number;
  recDiff?: number;
  /** Ein Satz, neutral formuliert. */
  satz: string;
  /** Woher das Merkmal kommt, wenn nicht aus einer Check-Frage (Stress: „Anspannung (Morgen-Check)“). */
  quelle?: string;
}
/** Welche Tage hat die Person für eine Frage beantwortet — so wird in der Karte „noch n Tage“ angezeigt. */
export interface CheckFortschritt { id: string; kurz: string; ja: number; nein: number; fehlt: number }

type JournalLog = Record<string, { check?: unknown; stress?: unknown } | null | undefined>;
type JournalTag = { check?: unknown; stress?: unknown } | null | undefined;

/** Ein Merkmal der Auswertung: eine Check-Frage (Antwort ja/nein) oder Stress aus der Anspannung. Abgelöste Fragen → null. */
function merkmalVon(id: string): { kurz: string; quelle?: string; wert: (e: JournalTag) => boolean | undefined } | null {
  if (id === ANSPANNUNG_ID) return { kurz: ANSPANNUNG_MERKMAL.kurz, quelle: ANSPANNUNG_MERKMAL.quelle, wert: e => gestresstAusAnspannung(e?.stress) };
  const f = CHECK_FRAGEN.find(x => x.id === id);
  return f ? { kurz: f.kurz, wert: e => checkSaeubern(e?.check)?.[id] } : null;
}

const mittel = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : undefined);

/**
 * Auswertung je aktiver Frage (rein): Tage D der letzten `tage` (vor heute — die Nacht nach heute gibt es noch nicht) mit einer
 * Antwort UND einem Wert der folgenden Nacht (Vitalwerte von D+1: `sleep`, `rec`). Ein Befund erst, wenn „ja“ und „nein“ je
 * mindestens `mindest` Tage haben. Sortiert nach der Größe des Unterschieds. `ids` = Kennungen aus dem Katalog und/oder
 * `ANSPANNUNG_ID` (Stress aus der Anspannung des Tages); abgelöste oder unbekannte Kennungen zählen nicht.
 */
export function checkAuswertung(journal: JournalLog | null | undefined, vitals: VitalsLog | null | undefined, ids: readonly string[], heute: string, tage = CHECK_TAGE, mindest = CHECK_MINDEST): { befunde: CheckBefund[]; fortschritt: CheckFortschritt[] } {
  const befunde: CheckBefund[] = [];
  const fortschritt: CheckFortschritt[] = [];
  const ab = tagePlus(heute, -tage);
  for (const id of ids) {
    const f = merkmalVon(id);
    if (!f) continue;
    const ja: { s: number[]; r: number[]; n: number } = { s: [], r: [], n: 0 };
    const nein: { s: number[]; r: number[]; n: number } = { s: [], r: [], n: 0 };
    for (const [tag, e] of Object.entries(journal ?? {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || tag < ab || tag >= heute) continue;
      const a = f.wert(e);
      if (typeof a !== 'boolean') continue;
      const v = vitals?.[tagePlus(tag, 1)];
      const s = typeof v?.sleep === 'number' && v.sleep > 0 ? v.sleep : undefined;
      const r = typeof v?.rec === 'number' && v.rec > 0 ? v.rec : undefined;
      if (s === undefined && r === undefined) continue;
      const g = a ? ja : nein;
      g.n++;
      if (s !== undefined) g.s.push(s);
      if (r !== undefined) g.r.push(r);
    }
    fortschritt.push({ id, kurz: f.kurz, ja: ja.n, nein: nein.n, fehlt: Math.max(0, mindest - ja.n) + Math.max(0, mindest - nein.n) });
    if (ja.n < mindest || nein.n < mindest) continue;
    const gruppe = (g: typeof ja): CheckGruppe => {
      const s = mittel(g.s), r = mittel(g.r);
      return { n: g.n, ...(s !== undefined ? { schlaf: Math.round(s * 100) / 100 } : {}), ...(r !== undefined ? { rec: Math.round(r) } : {}) };
    };
    const gj = gruppe(ja), gn = gruppe(nein);
    const schlafDiffMin = gj.schlaf !== undefined && gn.schlaf !== undefined && ja.s.length >= mindest && nein.s.length >= mindest ? Math.round((mittel(ja.s)! - mittel(nein.s)!) * 60) : undefined;
    const recDiff = gj.rec !== undefined && gn.rec !== undefined && ja.r.length >= mindest && nein.r.length >= mindest ? Math.round(mittel(ja.r)! - mittel(nein.r)!) : undefined;
    if (schlafDiffMin === undefined && recDiff === undefined) continue;
    befunde.push({ id, kurz: f.kurz, ja: gj, nein: gn, ...(schlafDiffMin !== undefined ? { schlafDiffMin } : {}), ...(recDiff !== undefined ? { recDiff } : {}), satz: befundSatz(f.kurz, schlafDiffMin, recDiff, ja.n, nein.n), ...(f.quelle ? { quelle: f.quelle } : {}) });
  }
  const gewicht = (b: CheckBefund) => Math.abs(b.schlafDiffMin ?? 0) + 3 * Math.abs(b.recDiff ?? 0);
  befunde.sort((a, b) => gewicht(b) - gewicht(a));
  return { befunde, fortschritt };
}

/** Unter dieser Schwelle („kaum Unterschied“): 10 Minuten Schlaf und 3 Punkte Recovery. */
export const KAUM_MIN = 10;
export const KAUM_REC = 3;

/** Der Satz eines Befunds (rein) — neutral, mit der Zahl der Tage, nie als Urteil über die Person. */
export function befundSatz(kurz: string, schlafDiffMin: number | undefined, recDiff: number | undefined, nJa: number, nNein: number): string {
  const teile: string[] = [];
  if (schlafDiffMin !== undefined && Math.abs(schlafDiffMin) >= KAUM_MIN) teile.push(`${Math.abs(schlafDiffMin)} Min. ${schlafDiffMin < 0 ? 'weniger' : 'mehr'} Schlaf`);
  if (recDiff !== undefined && Math.abs(recDiff) >= KAUM_REC) teile.push(`eine um ${Math.abs(recDiff)} Punkte ${recDiff < 0 ? 'niedrigere' : 'höhere'} Recovery`);
  const tage = `(${nJa} Tage mit, ${nNein} ohne)`;
  if (!teile.length) return `„${kurz}“: kaum Unterschied in der Nacht danach ${tage}.`;
  return `An Tagen mit „${kurz}“ hattest du im Schnitt ${teile.join(' und ')} ${tage}.`;
}

/** Hinweis unter der Auswertung. */
export const CHECK_HINWEIS = 'Ein Zusammenhang aus deinen eigenen Tagen, kein Beweis für eine Ursache — keine ärztliche Beratung.';
