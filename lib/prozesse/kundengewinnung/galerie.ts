// ─── Prozesse · Kundengewinnung — Filter der Galerie „Aus Vorlage anlegen“ (Feinschliff 22.10., Sichtprüfung: Befund 5) ───────────────────────────────────
// Eigene kleine Datei OHNE die Vorlagen selbst: die Galerie (Browser) filtert die Kurzformen aus der Route und soll die Bibliothek nicht ins Bündel ziehen.
// Rein und client-sicher; Tests: tests/prozesse-vorlagen-bibliothek.test.ts.

import { PROZESS_BEREICHE } from '../definition';
import type { VorlageKurz } from './bibliothek';

// Befund 5: „Welle 1 · Regeln / Welle 2 · mit Agenten / Welle 3 · neue Quellen“ war unverständlich.
// Gefiltert wird nach dem Bereich (dieselben Namen wie auf der Landkarte: Marketing · Sales · Übergabe · Ausbau) und optional danach, ob Agenten mitarbeiten
// („mit Agenten“) oder nur Regeln laufen („nur Regeln“, mitgezählt die Teilprozesse). Die Welle bleibt nur die Bau-Reihenfolge der Bibliothek.

export type VorlagenArt = 'alle' | 'agenten' | 'regeln';
export const VORLAGEN_ARTEN: readonly { id: VorlagenArt; label: string }[] = [{ id: 'alle', label: 'Mit und ohne Agenten' }, { id: 'agenten', label: 'Mit Agenten' }, { id: 'regeln', label: 'Nur Regeln' }];
/** Die Bereiche, in denen es Vorlagen gibt — in der Reihenfolge der Landkarte, mit Anzahl (rein). */
export function galerieBereiche(l: readonly Pick<VorlageKurz, 'bereich'>[]): { id: string; titel: string; anzahl: number }[] {
  return PROZESS_BEREICHE.map(b => ({ id: b.id as string, titel: b.titel, anzahl: l.filter(v => v.bereich === b.id).length })).filter(b => b.anzahl > 0);
}
/** Die Vorlagen eines Bereichs bzw. einer Art (rein; „alle“ = kein Filter). */
export function vorlagenFiltern<T extends Pick<VorlageKurz, 'bereich' | 'agenten'>>(l: readonly T[], f: { bereich: string; art: VorlagenArt }): T[] {
  return l.filter(v => (f.bereich === 'alle' || v.bereich === f.bereich) && (f.art === 'alle' || (f.art === 'agenten' ? v.agenten > 0 : v.agenten === 0)));
}
