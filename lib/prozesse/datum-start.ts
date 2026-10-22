// ─── Prozesse · Datums-Start — die reinen Regeln (22.10.; ANALYSE_100.md Punkt 34 „n Werktage vor einer Frist am Fall“) ──────────────────────────────────────
// Der Auslöser „Datum am Fall“ startet einen Lauf, wenn der Stichtag eines Falls erreicht ist: Datum am Fall ± Versatz (Kalendertage bzw. Werktage NRW) zur
// Uhrzeit des Auslösers. Hier steht NUR die Regel — rein und client-sicher (die Werkstatt zeigt damit ehrlich, worauf der Auslöser schaut):
//   · `stichtagVon`   Stichtag aus Datum + Versatz; Werktage über den Kalender-Kern (lib/zeit/kalender-kern.ts — Mo–Fr ohne Feiertage NRW, keine eigene Rechnung).
//                     Auch „Warten bis Datum“ rechnet damit (lib/prozesse/lauf-regeln.ts) — eine Stelle.
//   · `datumFaellig`  welche Stichtage ein Takt jetzt prüft — gegen den Merker im Lauf-Zustand (`ProzessLaufStand.datum`, der zuletzt behandelte Moment je
//                     Auslöser-Knoten). Ohne Merker (erster Takt nach dem Scharfschalten bzw. nach dem Update): NUR merken, nichts nachholen. Danach jeder Moment
//                     genau einmal; nach einem Ausfall höchstens `LAUF_GRENZEN.datumNachholenTage` Tage zurück.
//   · `datumPeriode`  die feste Kennung „Prozess + Fall + Stichtag“: der Lauf trägt sie als `ausloeser.quelle` (der Fall steht im Schlüssel des Laufs) — je Fall und
//                     Stichtag höchstens ein Lauf (lib/prozesse/lauf-regeln.ts `starten`), eine neue Periode (neues Ende, neue Wiedervorlage) darf neu starten.
// Die Kandidaten liest der Server (lib/prozesse/lauf-server.ts `datumKandidaten`): Fristen NUR über `fristenLesen` (lib/kalender/fristen-server.ts), Daten am
// Objekt über die vorhandenen Leser (CRM, Leads; Ende des Mandats über `mandatFristen` — dieselbe Regel wie der Kalender). Tests: tests/prozesse-datum-ausloeser.test.ts.

import { istWerktag, tagPlus, werktagePlus } from '@/lib/zeit/kalender-kern';
import type { Ausloeser, DatumsFeld } from './definition';

export type DatumAusloeser = Extract<Ausloeser, { art: 'datum' }>;

/** Ohne Uhrzeit startet ein Datums-Auslöser um 08:00 (Berliner Zeit) — wie die Vorgabe des Zeitplans. */
export const DATUM_UHRZEIT_VORGABE = '08:00';

const TAG = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Der Stichtag (rein): Datum am Fall plus `versatzTage` — in Kalendertagen, mit `werktage` in Werktagen NRW (Kalender-Kern). Mit Werktagen und Versatz 0 gilt
 * ein Wochenende bzw. Feiertag als der Werktag DAVOR (vor einer Frist nie zu spät). null bei unlesbarem Datum.
 */
export function stichtagVon(datum: string, a: { versatzTage?: number; werktage?: boolean }): string | null {
  const t = datum.slice(0, 10);
  if (!TAG.test(t)) return null;
  const v = a.versatzTage ?? 0;
  if (!a.werktage) return tagPlus(t, v);
  if (v === 0) return istWerktag(t) ? t : werktagePlus(t, -1);
  return werktagePlus(t, v);
}

/** Der Moment, zu dem ein Datums-Auslöser an einem Stichtag startet (Berliner Wandzeit `YYYY-MM-DDTHH:MM`). */
export const datumMoment = (stichtag: string, uhrzeit?: string): string => `${stichtag}T${uhrzeit || DATUM_UHRZEIT_VORGABE}`;

/** Die Periode eines Datums-Starts (Auslöser-Knoten + Stichtag) — mit dem Fall-Schlüssel des Laufs die feste Kennung „Prozess + Fall + Stichtag“. */
export const datumPeriode = (knotenId: string, stichtag: string): string => `datum:${knotenId}:${stichtag}`;
export const istDatumPeriode = (p: string | undefined): p is string => typeof p === 'string' && p.startsWith('datum:');

/**
 * Welche Stichtage ein Takt jetzt prüft (rein). `jetztWand` = Berliner Wandzeit (`YYYY-MM-DDTHH:MM…`). Der jüngste fällige Moment ist heute zur Uhrzeit (sonst
 * gestern); gilt er schon als behandelt (Merker), gibt es nichts zu tun (null). Ohne Merker: nur merken (`tage` leer) — nie nachholen. Sonst die Tage, deren
 * Moment nach dem Merker liegt, höchstens `nachholen` Tage (nach einem Ausfall bzw. einer Pause). `ab` (optional, Wandzeit): nur Momente danach — scharfe Läufe
 * starten nie für einen Stichtag, der vor dem Scharfschalten lag. `merker` = der neue Merker.
 */
export function datumFaellig(merker: string | undefined, jetztWand: string, uhrzeit: string | undefined, nachholen: number, ab?: string): { merker: string; tage: string[] } | null {
  const heute = jetztWand.slice(0, 10);
  const uhr = uhrzeit || DATUM_UHRZEIT_VORGABE;
  const bis = jetztWand.slice(0, 16) >= datumMoment(heute, uhr) ? datumMoment(heute, uhr) : datumMoment(tagPlus(heute, -1), uhr);
  if (!merker) return { merker: bis, tage: [] };
  if (merker >= bis) return null;
  const tage: string[] = [];
  for (let d = bis.slice(0, 10), i = 0; i < Math.max(1, nachholen); i++, d = tagPlus(d, -1)) {
    if (datumMoment(d, uhr) <= merker || (ab && datumMoment(d, uhr) <= ab.slice(0, 16))) break;
    tage.unshift(d);
  }
  return { merker: bis, tage };
}

/**
 * Das Fenster der Daten am Fall, deren Stichtag in [von, bis] liegen kann (rein, großzügig — genau gefiltert wird mit `stichtagVon`). Werktage dehnen den Versatz
 * (5 Werktage ≈ 7 Kalendertage, dazu Feiertage) — daher der Spielraum.
 */
export function datumFeldFenster(von: string, bis: string, a: { versatzTage?: number; werktage?: boolean }): { von: string; bis: string } {
  const v = a.versatzTage ?? 0;
  const spiel = a.werktage ? Math.ceil(Math.abs(v) * 0.6) + 10 : 0;
  return { von: tagPlus(von, -v - spiel), bis: tagPlus(bis, -v + spiel) };
}

/** Worauf ein Datums-Auslöser schaut (Werkstatt — ehrlich, aus welcher Quelle der Motor das Datum liest). */
export const DATUM_QUELLE: Readonly<Record<DatumsFeld, string>> = {
  'mandat.kuendigungsfrist': 'die Kündigungsfrist aus den Kalender-Fristen (aktive und pausierte Mandate: Ende minus Kündigungsfrist)',
  'mandat.review': 'das nächste Review aus den Kalender-Fristen (aktive Mandate)',
  'mandat.start': 'den Start, der am Mandat eingetragen ist',
  'mandat.ende': 'das Ende des Mandats — eingetragen bzw. aus Start und Mindestlaufzeit (dieselbe Regel wie im Kalender), auch bei beendeten Mandaten',
  'deal.entscheidung': '„Entscheidung bis“ offener Deals aus den Kalender-Fristen',
  'angebot.gueltig-bis': '„Gültig bis“ gestellter Angebote aus den Kalender-Fristen — der Fall ist der Deal des Angebots',
  'rechnung.faellig': 'die Fälligkeit gestellter Rechnungen aus den Kalender-Fristen — der Fall ist das Mandat der Rechnung',
  'event.datum': 'den Tag des Events (eigene und besuchte Events — „Nur wenn …“ grenzt ein)',
  'lead.wiedervorlage': 'die Wiedervorlage der Leads (ohne eingeschränkte Personen)',
};

/** Der Satz zum Datums-Auslöser für die Werkstatt: worauf er schaut, wann er startet, wie oft. */
export function datumErklaerung(a: Pick<DatumAusloeser, 'feld' | 'versatzTage' | 'werktage' | 'uhrzeit'>): string {
  const n = Math.abs(a.versatzTage);
  const wann = a.versatzTage === 0 ? 'am Tag selbst' : `${n} ${a.werktage ? (n === 1 ? 'Werktag' : 'Werktage') : (n === 1 ? 'Tag' : 'Tage')} ${a.versatzTage < 0 ? 'vorher' : 'danach'}`;
  const quelle = DATUM_QUELLE[a.feld] ?? a.feld;
  return `Schaut auf ${quelle}. Startet ${wann} um ${a.uhrzeit || DATUM_UHRZEIT_VORGABE} Uhr${a.werktage ? ' (Werktage: Mo–Fr ohne Feiertage NRW)' : ''} — je Fall und Stichtag höchstens einmal. Beim ersten Takt nach dem Scharfschalten wird nur gemerkt, nichts nachgeholt.`;
}
