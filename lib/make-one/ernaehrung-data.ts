// ─── MAKE OS — Ernährung: Modell (client-sicher) ────────────────────────────
// Gemeinsame Typen/Konstanten für Store-Route, Vorschlags-Route und View.
// (route.ts darf keine Extra-Exporte tragen — deshalb liegt das hier.)

export type Tag = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so';
export interface Mahlzeiten { fruehstueck: string; mittag: string; abend: string }
export interface EinkaufPosten { id: string; text: string; erledigt: boolean }
export interface ErnaehrungFile {
  grundsaetze: string;
  plan: Record<Tag, Mahlzeiten>;
  einkauf: EinkaufPosten[];
}

export const TAGE: Tag[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
export const TAG_LABEL: Record<Tag, string> = { mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag', fr: 'Freitag', sa: 'Samstag', so: 'Sonntag' };
