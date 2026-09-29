// ─── Verbindungsprüfung: Spiegel Event/Familie ↔ iCloud-Termin (rein, 29.09., Paket K5) ─
// Eingehängt in lib/crm/verbindungen.ts (Prüfungen) und lib/crm/verbindungen-laden.ts (Laden, nur Kennungen):
//   event-termin-tot     Event trägt `kalenderUid`, den Termin gibt es in iCloud nicht (mehr) — in Apple gelöscht?
//                        Nur im Holfenster eines gelungenen Stands (wie K1 `termin-uid-tot`). Die Event-Seite bietet
//                        „Termin neu anlegen“ (feste UID) — kein Knopf hier (Termine legt MAKE OS nur auf Klick an).
//   event-termin-schein  Event trägt noch eine erfundene Kennung (`mac-…`, vor K5, Verbindungskarte Befund 4) — beim
//                        nächsten Ändern bzw. „Mit dem Kalender verknüpfen“ auf der Event-Seite wird sie ersetzt.
//   familie-termin-tot   Date/Paar-Gespräch trägt eine UID, deren Termin es in iCloud nicht mehr gibt.
// Beispiele sind Kennungen (Event, Date, Datum des Gesprächs) — nie Titel.

import { istScheinUid } from './spiegel';
import type { IcloudUids } from './buchung-verbindungen';

export interface SpiegelStand {
  events: { id: string; datum: string; kalenderUid?: string }[];
  /** Familie des Inhabers — null, wenn nicht geladen. */
  familie: { dates: { id: string; datum: string; kalenderUid?: string }[]; gespraeche: { datum: string; uid: string }[] } | null;
}

const e = (n: number, ein: string, mehr: string) => (n === 1 ? ein : mehr);

export const PRUEFUNGEN_SPIEGEL = {
  'event-termin-tot': { schwere: 'hinweis', bereich: 'events', reparierbar: false, art: 'event', text: (n: number) => `${n} ${e(n, 'Event hat', 'Events haben')} keinen Termin mehr im Kalender (in Apple gelöscht?) — auf der Event-Seite „Termin neu anlegen“.` },
  'event-termin-schein': { schwere: 'hinweis', bereich: 'events', reparierbar: false, art: 'event', text: (n: number) => `${n} ${e(n, 'Event trägt', 'Events tragen')} noch eine alte Kalender-Marke ohne echten Termin-Bezug — auf der Event-Seite „Mit dem Kalender verknüpfen“ (oder beim nächsten Ändern von selbst).` },
  'familie-termin-tot': { schwere: 'hinweis', bereich: 'kalender', reparierbar: false, art: 'kennung', text: (n: number) => `${n} ${e(n, 'Date/Paar-Gespräch zeigt', 'Dates/Paar-Gespräche zeigen')} auf einen Termin, den es im Kalender nicht mehr gibt (in Apple gelöscht?).` },
} as const;
export type SpiegelPruefungId = keyof typeof PRUEFUNGEN_SPIEGEL;

export function spiegelPruefen(s: SpiegelStand | null | undefined, icloud: IcloudUids | null | undefined, melde: (id: SpiegelPruefungId, kennung: string) => void): void {
  if (!s) return;
  for (const ev of s.events) if (istScheinUid(ev.kalenderUid)) melde('event-termin-schein', ev.id);
  const fenster = icloud?.fenster ?? null;
  if (!fenster) return;
  const da = new Set(icloud!.objekte.map(o => o.uid));
  const imFenster = (tag: string) => tag >= fenster.von && tag < fenster.bis;
  for (const ev of s.events) if (ev.kalenderUid && !istScheinUid(ev.kalenderUid) && imFenster(ev.datum) && !da.has(ev.kalenderUid)) melde('event-termin-tot', ev.id);
  for (const d of s.familie?.dates ?? []) if (d.kalenderUid && imFenster(d.datum) && !da.has(d.kalenderUid)) melde('familie-termin-tot', d.id);
  for (const g of s.familie?.gespraeche ?? []) if (imFenster(g.datum) && !da.has(g.uid)) melde('familie-termin-tot', `gespraech:${g.datum}`);
}
