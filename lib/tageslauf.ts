// ─── MAKE OS — Der Tageslauf ────────────────────────────────────────────────
// Eine feste Kette, die jeden Tag dieselbe Reihenfolge durchläuft. Der Sinn:
// Kevin soll morgens nichts entscheiden und nichts suchen müssen — er macht auf,
// die Kette ist durchgelaufen, der Tag liegt sortiert da.
//
// Drei Läufe pro Tag:
//   voll   (morgens)      — die ganze Kette inkl. News und Ausrichtung
//   kurz   (mittags/nachm.) — nur was sich ändern kann: Postfach, Termine,
//                             Aufgaben, Prioritäten-Wächter
//   puls   (stündlich)     — leise: meldet sich nur, wenn wirklich etwas ist

export type LaufArt = 'voll' | 'kurz' | 'puls';

export interface SchrittDef {
  id: string;
  name: string;
  /** Was dieser Schritt tut — wird in der Oberfläche gezeigt. */
  tut: string;
  /** In welchen Lauf-Arten er vorkommt. */
  bei: LaufArt[];
}

export const KETTE: SchrittDef[] = [
  { id: 'postfach', name: 'Postfächer', tut: 'Neue Nachrichten sichten und einordnen', bei: ['voll', 'kurz', 'puls'] },
  { id: 'kalender', name: 'Termine', tut: 'Den Tag ansehen: Last, Lücken, Kollisionen', bei: ['voll', 'kurz', 'puls'] },
  { id: 'aufgaben', name: 'Aufgaben validieren', tut: 'Überfällig, kritisch, was heute kippt', bei: ['voll', 'kurz', 'puls'] },
  { id: 'transkripte', name: 'Transkripte', tut: 'Gesprächsnotizen einsammeln und auswerten', bei: ['voll'] },
  { id: 'news', name: 'Lage draußen', tut: 'Je drei Meldungen: Welt, Business, Wettbewerb', bei: ['voll'] },
  { id: 'prioritaet', name: 'Prioritäten-Wächter', tut: 'Ist etwas reingekommen, das vorgezogen werden muss?', bei: ['voll', 'kurz', 'puls'] },
  { id: 'ausrichtung', name: 'Ausrichtung', tut: 'Alles zusammenziehen: Tagesform, max. 3 Prioritäten, Schutz', bei: ['voll', 'kurz'] },
];

export const schritteFuer = (art: LaufArt) => KETTE.filter(s => s.bei.includes(art));

export interface SchrittErgebnis {
  id: string;
  name: string;
  /** 'ok' | 'leer' (nichts zu tun) | 'fehler' | 'uebersprungen' */
  stand: 'ok' | 'leer' | 'fehler' | 'uebersprungen';
  /** Eine Zeile für die Übersicht. */
  kurz: string;
  /** Ausführliches Ergebnis (Liste, Text) für die Aufklappung. */
  detail?: unknown;
  /** Dauer in ms — damit man sieht, was bremst. */
  ms?: number;
}

export interface Lauf {
  id: string;
  art: LaufArt;
  gestartet: string;
  fertig?: string;
  schritte: SchrittErgebnis[];
  /** Das Ergebnis der Ausrichtung (Gruß, Prioritäten …). */
  ausrichtung?: Record<string, unknown>;
  /** Wenn der Wächter angeschlagen hat. */
  alarm?: string;
}

export interface LaufFile { laeufe: Lauf[] }
export const MAX_LAEUFE = 60;

/** Welche Lauf-Art ist zu dieser Stunde dran? */
export function artFuerStunde(h: number): LaufArt {
  if (h < 11) return 'voll';
  if (h === 13 || h === 16) return 'kurz';
  return 'puls';
}

// Datums-Key aus der einen Zeit-Quelle.
export { localDay as tagKey } from '@/lib/zeit';
