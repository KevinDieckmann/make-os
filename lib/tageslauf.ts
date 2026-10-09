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

// ── Task-Agent „autonom“: Prioritäten der Ausrichtung als Aufgaben (09.10., KI-Etiketten K6) ───────────────────────────────────
// Vorher legte die Kette JEDE Priorität mit festem `space: 'business'` und dem „warum“ des Modells als Beschreibung an — die Ausrichtung
// rechnet aber mit Tagesform/Vitalwerten, Privatem und der Inbox: der ganze Haushalt (auch „nur Business“) sah das. Jetzt (rein):
//   • Bereich aus der Priorität selbst (`bereich`, vom Modell) — nur „business“ wird Business; alles andere (auch fehlend) bleibt PRIVAT
//     und „nur ich“ (sieht nur die Person, für die der Lauf läuft).
//   • keine Begründung des Modells in der Beschreibung (sie kann Gesundheitswerte tragen) — die steht im eigenen Tageslauf der Person.

export interface AutoPrioritaet { titel?: unknown; warum?: unknown; wann?: unknown; bereich?: unknown }
export interface AutoAufgabe { title: string; description: string; priority: 'high'; space: 'privat' | 'business'; sichtbarkeit?: 'nur-ich' }

/** Aus einer Priorität der Ausrichtung die Eingabe für /api/tasks/create (rein) — null ohne Titel. */
export function autoAufgabe(p: AutoPrioritaet): AutoAufgabe | null {
  const title = typeof p.titel === 'string' ? p.titel.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300) : '';
  if (!title) return null;
  const business = p.bereich === 'business';
  const wann = typeof p.wann === 'string' && p.wann.trim() ? `Wann: ${p.wann.trim().slice(0, 120)} · ` : '';
  return {
    title,
    description: `${wann}Automatisch aus der Tages-Ausrichtung (Task-Agent: autonom) — das Warum steht im eigenen Tageslauf.`,
    priority: 'high',
    space: business ? 'business' : 'privat',
    ...(business ? {} : { sichtbarkeit: 'nur-ich' as const }),
  };
}
