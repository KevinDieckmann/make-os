// ─── MAKE OS — Planung: Bereich und Arbeit eines Planungseintrags (05.10. abends, rein, client-sicher) ─────────────────────────────
// Kevin 05.10.: Ziele, Meilensteine und Routinen mit der Einheit „Selbstständigkeit“ gehören automatisch zu Privat — „wie bei den
// Aufgaben: Einheit, Kennungen und Verknüpfungen bleiben, nur der abgeleitete Bereich wechselt“. Und: „Die Selbstständigkeit zählt WEITER
// als Arbeit“ (Kapazität, Fokus, Zeit je Einheit) — Arbeit ist nicht dasselbe wie Bereich.
//
// Regel (EINE Stelle, alle Ansichten lesen hier):
//   · Speicherform: ein Eintrag einer Privat-Einheit (lib/einheiten.ts `privatEinheit`, unsere Instanz: die Selbstständigkeit) bleibt so
//     gespeichert, wie er immer gespeichert war — `space: 'business'` + `einheit`. So liest der alte Stand ihn unverändert (nichts geht
//     beim Rückweg verloren: Einheit, Mandat, Aufwand und Personen hängen am Business-Space). Wird er im Privat-Bereich mit der Einheit
//     angelegt, legt der Schreibweg ihn in genau dieser Form ab (`speicherSpace`). Kein Umzug, keine neue Pflicht-Angabe.
//   · Bereich (Anzeige, Filter, Fluss, Lichtfäden, Kalender, Brain, Business-Index): IMMER abgeleitet — `wirksamerSpace`. Eine Privat-Einheit
//     ergibt `privat`, sonst gilt der gespeicherte Space. Stellt eine Instanz die Selbstständigkeit ins Business
//     (`NEXT_PUBLIC_MAKE_OS_EINHEITEN`), ist alles wieder wie vorher.
//   · Arbeit (Kapazität, Ist-Zeit): `zaehltAlsArbeit` — Business-Einträge immer, Privat-Einträge nur mit einer Arbeits-Einheit.

import { privatArbeitsEinheit, privatEinheit } from '@/lib/einheiten';
import type { SpaceId } from '@/lib/make-one/space-regeln';

/** Was die Regel von einem Ziel, Meilenstein, einer Routine oder einem Block braucht. */
export interface MitSpaceUndEinheit { space?: SpaceId; einheit?: string }

/** Gehört die Einheit eines Eintrags zu Privat (unsere Instanz: „Selbstständigkeit“, auch Altnamen)? */
export const hatPrivatEinheit = (x: { einheit?: unknown }): boolean => !!privatEinheit(x.einheit);

/**
 * Der wirksame Bereich eines Planungseintrags: eine Privat-Einheit → `privat`; sonst der gespeicherte Space (undefined = ohne Angabe,
 * z. B. ein gemeinsames Ziel — die Leser behalten ihren bisherigen Rückfall).
 */
export function wirksamerSpace(x: MitSpaceUndEinheit): SpaceId | undefined {
  return hatPrivatEinheit(x) ? 'privat' : x.space;
}

/**
 * Die Speicherform des Space (Schreibweg): `privat` + eine Privat-Einheit wird als `business` + Einheit abgelegt — die Form, die der alte
 * Stand kennt (dort verwirft Privat jede Einheit). Alles andere bleibt, wie es kommt.
 */
export function speicherSpace(space: SpaceId | undefined, einheit: unknown): SpaceId | undefined {
  return space === 'privat' && privatEinheit(einheit) ? 'business' : space;
}

/**
 * Zählt ein Planungseintrag als Arbeit (Kapazität: Aufwand, Machbarkeit, Ist-Zeit)? Business immer (wie bisher, auch ohne Angabe, wenn
 * `ohneSpaceIstArbeit`), Privat nur mit einer Einheit, deren Zeit als Arbeit zählt (unsere Instanz: die Selbstständigkeit).
 */
export function zaehltAlsArbeit(x: MitSpaceUndEinheit, ohneSpaceIstArbeit = false): boolean {
  if (privatEinheit(x.einheit)) return !!privatArbeitsEinheit(x.einheit);
  if (x.space === 'business') return true;
  return x.space === undefined && ohneSpaceIstArbeit;
}
