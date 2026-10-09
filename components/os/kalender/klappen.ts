// ─── Kalender: linke Spalte ein- und ausklappen (09.10.) ─────────────────────────────────────────────────────────────────────
// Kevin 09.10.: „Guck mal, ob du den Kalender links einklappbar machen kannst, das sieht noch so verloren aus. Die Monatsansicht etc.
// einfach einklappbar — dann sieht man den Kalender danach besser und er hat ausreichend Platz.“
// Rein (getestet in tests/kalender-klappen.test.ts). Taste und Merker kommen aus der gemeinsamen Regel (lib/make-one/klappen.ts, Vorbild
// Agenten-Seite): ⌘B bzw. Strg+B, nur ohne Fokus im Eingabefeld; je Browser gemerkt, Vorgabe offen. Die Kalender-Kürzel ohne Modifier
// (t, ←, →, d/x/w/m/y/a, p, k, u, c, n) bleiben unberührt — der Kalender kennt sonst keine Taste mit ⌘/Strg.
// Einklappen gilt nur, wenn Spalte und Raster NEBENEINANDER stehen (`breit` = `useBreit`, ab `SPALTEN_AB`); schmal liegt die Spalte unter dem Raster und
// bleibt immer sichtbar. Zugeklappt sitzen „Spalte öffnen“ und ein kleines „Erstellen“ vorne in der Kopfzeile (dazu die Kürzel c/n).
// Planen: die Bausteine stehen links („antippen, dann in den Kalender klicken“). Wechselt jemand mit zugeklappter Spalte nach „Planen“
// (Segment, Taste p oder Link `?modus=planen`), öffnet sich die Spalte — nur für den Moment, gemerkt wird nur ein Klick bzw. ⌘B.
// Wer danach im Planen-Modus selbst zuklappt, behält das (die Bausteine kommen mit ⌘B zurück).

import { KLAPP_TASTE_TEXT, klappMerkerLesen, klappMerkerSchreiben, klappTaste } from '@/lib/make-one/klappen';
import type { Modus } from '@/lib/kalender/modus';

/** Merker je Browser: „auf“ / „zu“ (ohne Eintrag offen). */
export const LINKS_MERKER = 'make-kalender-links';
/** Kennung der linken Spalte (für `aria-controls` der Knöpfe). */
export const LINKS_ID = 'kalender-links';
/** Taste als Text für Tooltip und Ansage. */
export const LINKS_TASTE = KLAPP_TASTE_TEXT.links;

export const linksOffenLesen = (speicher?: Pick<Storage, 'getItem'> | null): boolean => klappMerkerLesen(LINKS_MERKER, speicher);
export const linksOffenMerken = (offen: boolean, speicher?: Pick<Storage, 'setItem'> | null): void => klappMerkerSchreiben(LINKS_MERKER, offen, speicher);

/** Klappt diese Taste die linke Spalte? Nur ⌘B / Strg+B (⌘. bleibt im Kalender frei). */
export function linksTaste(
  e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; defaultPrevented?: boolean; repeat?: boolean },
  fokus: { tagName?: string; isContentEditable?: boolean } | null | undefined,
): boolean {
  return klappTaste(e, fokus) === 'links';
}

/** Ist die linke Spalte zu sehen? Schmal (untereinander) immer; breit nach dem Zustand. */
export function linksSichtbar(breit: boolean, offen: boolean): boolean {
  return !breit || offen;
}

/** Muss die Spalte für Planen aufgehen? Nur breit, nur zugeklappt, nur im Planen-Modus. */
export function oeffnenFuerPlanen(modus: Modus, breit: boolean, offen: boolean): boolean {
  return modus === 'planen' && breit && !offen;
}
