// ─── Bauplan — Form der Karten (ohne Abhängigkeiten) ────────────────────────
// Steht getrennt von board.ts, weil backlog-data.ts die Typen braucht und
// board.ts seinerseits backlog-data.ts — so entsteht kein Import-Kreis.

export type Spalte = 'idee' | 'bereit' | 'arbeit' | 'test' | 'fertig';
export const SPALTEN: { id: Spalte; label: string; satz: string }[] = [
  { id: 'idee', label: 'Ideen', satz: 'Gesammelt — noch nicht entschieden' },
  { id: 'bereit', label: 'Bereit', satz: 'Entschieden — gebaut wird von oben nach unten' },
  { id: 'arbeit', label: 'In Arbeit', satz: 'Wird gerade gebaut' },
  { id: 'test', label: 'Zum Testen', satz: 'Gebaut — ihr probiert es aus und nehmt ab' },
  { id: 'fertig', label: 'Fertig', satz: 'Abgenommen' },
];

export type Art = 'fehler' | 'verbesserung' | 'neu' | 'anbindung' | 'frage';
export const ARTEN: { id: Art; label: string }[] = [
  { id: 'fehler', label: 'Fehler' }, { id: 'verbesserung', label: 'Verbesserung' }, { id: 'neu', label: 'Neue Funktion' },
  { id: 'anbindung', label: 'Anbindung' }, { id: 'frage', label: 'Frage' },
];

/** Die Bereiche der Software — für Filter und Zuordnung. */
export const BEREICHE = ['Heute', 'ZOE', 'Brain', 'Markttraktion', 'Mandate', 'Fokus', 'Aufgaben', 'Planung', 'Zahlen', 'Gesundheit', 'Familie', 'Inbox', 'Agenten', 'System', 'Allgemein'] as const;
/** Anzeigenamen (17.10., Abnahme 3 · C14): gespeichert bleiben die Kennungen, gezeigt die heutigen Namen der Leiste. */
const BEREICH_ANZEIGE: Readonly<Record<string, string>> = { Zahlen: 'Finanzen', Agenten: 'ZOE-Agenten', System: 'Einstellungen' };
export const bereichName = (b: string): string => BEREICH_ANZEIGE[b] ?? b;
