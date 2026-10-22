// ─── Unternehmen — die Orte der Seite (/os/unternehmen) als Daten (22.10. abends, Werkzeug-Muster Gruppe A) ─────────────────────────────────────────
// Kevin 11.10.: „neun Reiter laufen über, keiner versteht, was zuerst zu tun ist“ — zwei Gruppen: „Lage“ (was ist zu tun) und „Akte“ (was gilt, wer hält wen).
// Seit 22.10. abends ist Unternehmen ein Werkzeug (lib/make-one/werkzeuge.ts `UNTERNEHMEN_WERKZEUG`): die Gruppen stehen als Menü in der linken Leiste — die
// Seite liest hier NUR, wo sie steht (`unternehmenOrt`); dieselbe Regel sagt dem Menü, welcher Punkt leuchtet. Kennungen und alte Adressen bleiben (`?s=`):
// `s=liste|archiv|papierkorb` → Gesellschaften mit Filter; `?g=<kennung>` (Steckbrief) und `?ablage=<kennung>` gehören zu den Gesellschaften.
// Rein und client-sicher (nur Typen importiert).

import type { SchildReiter } from './ampel';

/** Wo die Seite steht: ein Reiter des Schilds oder „Automationen & Head“ des Werkzeugs (`s=automationen`). */
export type UnternehmenSicht = SchildReiter | 'automationen';
/** Der Filter der Gesellschaften (Ebene 2 der Seite; Archiv und Papierkorb stehen auch unten im Menü). */
export type UnternehmenFilter = 'liste' | 'archiv' | 'papierkorb';

/** Gruppe „Lage“: was ist zu tun. „Marken & Versicherungen“ hat die Kennung `schutz` (alte Adressen). */
export const LAGE_REITER: readonly { id: SchildReiter; label: string }[] = [
  { id: 'ueberblick', label: 'Überblick' }, { id: 'pflichten', label: 'Pflichten & Fristen' }, { id: 'dokumente', label: 'Dokumente' },
  { id: 'risiken', label: 'Risiken' }, { id: 'schutz', label: 'Marken & Versicherungen' },
];
/** Gruppe „Akte“: was gilt, wer hält wen. */
export const AKTE_REITER: readonly { id: SchildReiter; label: string }[] = [
  { id: 'struktur', label: 'Struktur' }, { id: 'beschluesse', label: 'Beschlüsse & Satzung' }, { id: 'vertraege', label: 'Verträge & Organe' }, { id: 'gesellschaften', label: 'Gesellschaften' },
];
export const UNTERNEHMEN_FILTER: readonly { id: UnternehmenFilter; label: string }[] = [{ id: 'liste', label: 'Aktiv' }, { id: 'archiv', label: 'Archiv' }, { id: 'papierkorb', label: 'Papierkorb' }];
const SICHTEN: readonly UnternehmenSicht[] = [...LAGE_REITER.map(r => r.id), ...AKTE_REITER.map(r => r.id), 'automationen'];

/** Reiter mit „Alle“ im Gesellschafts-Filter (ohne `w` das Bild über alle Gesellschaften). */
export const MIT_ALLE: readonly UnternehmenSicht[] = ['ueberblick', 'pflichten', 'dokumente', 'risiken'];
/** Reiter, die je Business-Gesellschaft gelten (ohne `w` die erste aktive). */
export const JE_GESELLSCHAFT: readonly UnternehmenSicht[] = ['schutz', 'beschluesse'];
/** Reiter, in die die gewählte Gesellschaft (`w`) beim Wechsel mitwandert. */
export const MIT_WAHL: readonly UnternehmenSicht[] = [...MIT_ALLE, ...JE_GESELLSCHAFT];

/** Reiter + Filter aus der Adresse — alte Adressen (`s=liste|archiv|papierkorb`) bleiben gültig; Unbekanntes = Überblick. */
export function unternehmenSicht(s: string | null | undefined, f: string | null | undefined): { sicht: UnternehmenSicht; filter: UnternehmenFilter } {
  if (s === 'liste' || s === 'archiv' || s === 'papierkorb') return { sicht: 'gesellschaften', filter: s };
  const sicht = SICHTEN.find(x => x === s) ?? 'ueberblick';
  return { sicht, filter: UNTERNEHMEN_FILTER.find(x => x.id === f)?.id ?? 'liste' };
}

/** Der Ort für das Menü: ein Steckbrief (`g`) oder die Ablage (`ablage`) gehört zu den Gesellschaften; Archiv und Papierkorb sind eigene Punkte (Fuß). */
export type UnternehmenOrt = UnternehmenSicht | 'archiv' | 'papierkorb';
export function unternehmenOrt(q: { get(name: string): string | null }): UnternehmenOrt {
  if (q.get('g') || q.get('ablage')) return 'gesellschaften';
  const { sicht, filter } = unternehmenSicht(q.get('s'), q.get('f'));
  return sicht === 'gesellschaften' && filter !== 'liste' ? filter : sicht;
}
