// ─── CRM — Import-Konflikte und das Segment „Vernetzen“ (27.09.) ─────────────
// „Online gewinnt“: was die Masterliste anders sieht als die Kartei, wird nicht
// überschrieben, sondern hier abgelegt und einzeln entschieden (Stammdaten ›
// Austausch). Reine Formen und Konstanten — die Route und die Oberfläche teilen sie.

import type { Konflikt, MoeglicheDublette } from '@/lib/make-one/crm';
import type { Segment, SegmentKriterien } from './typen';

/**
 * Speicher der offenen Import-Konflikte. Seit 28.09. (Ablaufprüfung a) ersetzt ein neuer Import ihn NICHT mehr, sondern
 * führt zusammen (`konflikteZusammenfuehren`): offene Konflikte früherer Listen bleiben, bis sie entschieden sind.
 */
export const KONFLIKT_SPEICHER = 'crm-import-konflikte';

export interface KonfliktStand {
  konflikte: Konflikt[];
  moeglicheDubletten: MoeglicheDublette[];
  /** Importierte Zeilen ohne Besitzer — in der Qualifizierungsrunde übernehmen. */
  ohneBesitzer: number;
  stand: string;
  quelle: string;
}
export const leererKonfliktStand = (): KonfliktStand => ({ konflikte: [], moeglicheDubletten: [], ohneBesitzer: 0, stand: '', quelle: '' });

/**
 * Neuen Import-Stand mit dem gespeicherten zusammenführen (28.09., Ablaufprüfung a): Konflikte je `kontaktId|feld` —
 * der jüngste Listenwert gewinnt (neu vor alt), offene Konflikte früherer Listen bleiben. Mögliche Dubletten ohne
 * Doppelte. `ohneBesitzer`, `stand`, `quelle` vom jüngsten Import.
 */
export function konflikteZusammenfuehren(alt: KonfliktStand | null | undefined, neu: KonfliktStand): KonfliktStand {
  const k = new Map<string, Konflikt>();
  for (const x of alt?.konflikte ?? []) k.set(`${x.kontaktId}|${x.feld}`, x);
  for (const x of neu.konflikte) k.set(`${x.kontaktId}|${x.feld}`, x);
  const d = new Map<string, MoeglicheDublette>();
  const schluessel = (x: MoeglicheDublette) => JSON.stringify([x.kontaktId, x.mitId ?? '', x.grund]);
  for (const x of [...(alt?.moeglicheDubletten ?? []), ...neu.moeglicheDubletten]) d.set(schluessel(x), x);
  return { ...neu, konflikte: Array.from(k.values()), moeglicheDubletten: Array.from(d.values()) };
}

/** Segment „Vernetzen“: kalte Leads aus der Masterliste landen nur hier (Marketing), nicht in Firmen › Leads. */
export const SEGMENT_VERNETZEN_ID = 'seg-vernetzen';
export const segmentVernetzen = (jetzt: string): Segment => ({
  id: SEGMENT_VERNETZEN_ID, name: 'Vernetzen · kalte Leads',
  beschreibung: 'Kalte Leads aus der Masterliste — erst vernetzen, dann qualifizieren.',
  // `temperatur` kommt parallel in SegmentKriterien (lib/crm/typen.ts + segmente.ts) — bis dahin gecastet.
  kriterien: { temperatur: ['kalt'] } as SegmentKriterien,
  geaendert: jetzt, geaendertVon: 'system',
});
