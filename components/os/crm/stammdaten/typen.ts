// ─── Stammdaten — Antwort von /api/crm/stammdaten und die POST-Hand ─────────
// Ein Ort für die Form der Daten, damit Übersicht, Wertelisten und
// Import & Export dieselbe Wahrheit haben.

import type { Antrag, Verarbeitung } from '@/lib/crm/typen';
import type { Kpi } from '@/lib/crm/kennzahlen';
import type { Befund } from '@/lib/crm/befunde';
import type { Pruefpunkt } from '@/lib/crm/datenschutz';
import type { FristDef, FristArt, LoeschfristenBestand } from '@/lib/crm/loeschfristen';

export interface WertelistenAntwort {
  /** `gemessen` (28.09., K4): Gewinnquote der entschiedenen Deals, die die Stufe erreichten — `quote` erst ab MINDESTMENGE. */
  stufen: { id: string; label: string; standard: number; p: number; vonHand: boolean; weiterWenn: string; offen: boolean; gemessen?: { n: number; gewonnen: number; quote: number | null } | null }[];
  /** Fest (aus dem Code) und eigene; `anzahl` = wie oft als Grund an verlorenen Deals. */
  verlustgruende: { grund: string; fest: boolean; anzahl: number }[];
  /** Wirksamer Takt je Kreis, der Standard dazu und wie viele Personen im Kreis sind. */
  kadenzTage: Record<string, number>;
  kadenzStandard: Record<string, number>;
  kadenzPersonen: Record<string, number>;
  ergebnisse: { wert: string; label: string; fest: boolean }[];
  branchen: { wert: string; fest: boolean }[];
  typen: { wert: string; fest: boolean }[];
  kategorien: { wert: string; fest: boolean }[];
  /** Labels (28.09.) — nur eigene. */
  labels: { wert: string; fest: boolean }[];
  ziele: { umsatzNeuMonat?: number; sqlMonat?: number; gespraecheWoche?: number };
  /** Ist zu den Zielen — null, solange nichts gemessen ist. */
  ist: { umsatzNeu30: number | null; sql30: number | null; gespraecheWoche: number | null; dealsOffen: number };
}

export interface StammdatenDaten {
  heute: string; kennzahlen: Kpi[]; befunde: Befund[]; selbstpruefung: Pruefpunkt[];
  qualitaet: { kontakte: number; firmen: number; vollstaendigkeit: { feld: string; label: string; anzahl: number; anteil: number }[]; dublettenPersonen: number; dublettenFirmen: number; ohneFirmenverweis: number; art14: number; speicherbegrenzung: number; werbesperren: { id: string; seit: string }[];
    /** U2 #34: aktive Beziehungen/Leads seit über `pruefenMonate` nicht geprüft. */
    nichtGeprueft: { id: string; name: string; seit: string; nie: boolean }[]; pruefenMonate: number };
  wertelisten: WertelistenAntwort;
  letzterImport: { zeit: string; text: string } | null;
  pflichtangaben: { anzahl: number; herkunft: Record<string, number>; rechtsgrundlage: Record<string, number>; fremddaten: number; beispiele: { name: string; herkunft?: string; rechtsgrundlage?: string; fremddaten: boolean; grund: string }[] };
  loeschregeln: { id: string; titel: string; frist: string; aktion: string; norm: string }[];
  speicherbegrenzung: { id: string; name: string; seit: string }[];
  /** Löschfristen je Datenart (U2 #52): Tabelle, wirksame Werte, gespeicherte Abweichungen, letzter Takt-Lauf. */
  loeschfristen: { tabelle: FristDef[]; wirksam: Record<FristArt, number>; gespeichert: Partial<Record<FristArt, number>>; lauf: LoeschfristenBestand['lauf'] | null };
  antraege: Antrag[]; verarbeitungen: Verarbeitung[]; loeschprotokoll: { id: string; datum: string; grund: string; von: string }[];
}

/** POST an /api/crm/stammdaten — die Antwort trägt `ok` und bei Ablehnung `fehler`. */
export type StammdatenPost = (body: Record<string, unknown>) => Promise<{ ok: boolean; fehler?: string } & Record<string, unknown>>;
