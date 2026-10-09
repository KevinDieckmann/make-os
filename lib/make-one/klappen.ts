// ─── Seitenfelder ein- und ausklappen — die gemeinsamen Regeln (09.10.) ──────────────────────────────────────────────────────
// Zuerst für die Agenten-Seite gebaut (components/os/agenten/klappen.ts), am 09.10. für den Kalender verallgemeinert (Kevin: „Kalender
// links einklappbar … dann sieht man den Kalender danach besser“). Rein und client-sicher: welche Taste klappt, wann die Taste dem
// Eingabefeld gehört und wie der Zustand je Browser gemerkt wird. Jede Seite hat ihren EIGENEN Merker-Schlüssel.
//   • links  — ⌘B bzw. Strg+B
//   • rechts — ⌘. bzw. Strg+.
// Wer klappt, nimmt `klappTaste` — nie eine eigene Tastenprüfung (Wächter in tests/agenten-aufraeumen.test.ts: keine Stelle unter
// components/ fragt ⌘B/⌘. selbst ab). Die Seiten liegen nie gleichzeitig offen, die Tasten stören sich also nicht.

export type KlappSeite = 'links' | 'rechts';

/** Die Tasten als Text für Tooltips und Ansagen. */
export const KLAPP_TASTE_TEXT: Readonly<Record<KlappSeite, string>> = { links: '⌘B · Strg+B', rechts: '⌘. · Strg+.' };

type Lesen = Pick<Storage, 'getItem'> | null;
type Schreiben = Pick<Storage, 'setItem'> | null;
const ortVon = <T>(speicher: T | null | undefined): T | Storage | null =>
  speicher === undefined ? (typeof localStorage === 'undefined' ? null : localStorage) : speicher;

/** Liest einen Merker „auf“/„zu“ — leerer Speicher, privates Fenster oder gesperrter Speicher → offen (Vorgabe). */
export function klappMerkerLesen(schluessel: string, speicher?: Lesen): boolean {
  try { return ortVon(speicher)?.getItem(schluessel) !== 'zu'; } catch { return true; }
}

/** Schreibt einen Merker; scheitert der Speicher, bleibt es beim Zustand auf dem Bildschirm (bis zum Neuladen). */
export function klappMerkerSchreiben(schluessel: string, offen: boolean, speicher?: Schreiben): void {
  try { ortVon(speicher)?.setItem(schluessel, offen ? 'auf' : 'zu'); } catch { /* egal */ }
}

/** Steht der Fokus in einem Eingabefeld? Dann gehört die Taste dem Feld. */
export function imEingabefeld(ziel: { tagName?: string; isContentEditable?: boolean } | null | undefined): boolean {
  if (!ziel) return false;
  const t = (ziel.tagName ?? '').toUpperCase();
  return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || !!ziel.isContentEditable;
}

/** Welche Seite eine Taste klappt: ⌘B/Strg+B → links, ⌘./Strg+. → rechts; sonst nichts (auch nicht mit Alt/Umschalt, bei Wiederholung oder im Feld). */
export function klappTaste(
  e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; defaultPrevented?: boolean; repeat?: boolean },
  fokus: { tagName?: string; isContentEditable?: boolean } | null | undefined,
): KlappSeite | null {
  if (e.defaultPrevented || e.repeat || e.altKey || e.shiftKey || !(e.metaKey || e.ctrlKey)) return null;
  if (imEingabefeld(fokus)) return null;
  const k = e.key.toLowerCase();
  if (k === 'b') return 'links';
  if (k === '.') return 'rechts';
  return null;
}
