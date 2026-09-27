// ─── CRM — Import-Konflikte und das Segment „Vernetzen“ (27.09.) ─────────────
// „Online gewinnt“: was die Masterliste anders sieht als die Kartei, wird nicht
// überschrieben, sondern hier abgelegt und einzeln entschieden (Stammdaten ›
// Austausch). Reine Formen und Konstanten — die Route und die Oberfläche teilen sie.

import type { Konflikt, MoeglicheDublette } from '@/lib/make-one/crm';
import type { Segment, SegmentKriterien } from './typen';

/** Speicher der offenen Import-Konflikte — der letzte Import ersetzt ihn (Konflikte kehren wieder, bis sie gelöst sind). */
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

/** Segment „Vernetzen“: kalte Leads aus der Masterliste landen nur hier (Marketing), nicht in Firmen › Leads. */
export const SEGMENT_VERNETZEN_ID = 'seg-vernetzen';
export const segmentVernetzen = (jetzt: string): Segment => ({
  id: SEGMENT_VERNETZEN_ID, name: 'Vernetzen · kalte Leads',
  beschreibung: 'Kalte Leads aus der Masterliste — erst vernetzen, dann qualifizieren.',
  // `temperatur` kommt parallel in SegmentKriterien (lib/crm/typen.ts + segmente.ts) — bis dahin gecastet.
  kriterien: { temperatur: ['kalt'] } as SegmentKriterien,
  geaendert: jetzt, geaendertVon: 'system',
});
