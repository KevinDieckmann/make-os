// Typen zu lib/neustart/nachholen-lauf.mjs (Nachholen einzelner Business-Bestände aus dem Archiv, 09.10.2026 spät).

export class NachholenAbbruch extends Error {
  constructor(gruende: string[], code?: number);
  gruende: string[];
  /** 2 = Eingaben/Inhalt (nichts geschrieben), 3 = eine App hält einen Ordner, 1 = Fehler beim Schreiben/Prüfen. */
  code: number;
}

export function pfadeGruende(archiv: string | undefined, daten: string | undefined, cwd: string): string[];

export interface HeadZaehler { merksaetze: number; entschieden: number; offen: number; berichte: number; autonomie: 'intern' | 'aus' | null }
export interface NachholenBericht {
  probelauf: boolean;
  am: string;
  archiv: string;
  daten: string;
  format: 'kompatibel' | 'v2';
  verschluesselt: boolean;
  bestaende: { name: string; aktion: 'neu' | 'zusammengefuehrt' | 'unveraendert' | 'fehlt-im-archiv'; archiv: HeadZaehler | null; vorher: HeadZaehler | null; nachher: HeadZaehler | null }[];
  geschrieben: { bestaende: number; gesichert: string[] } | null;
}

export function nachholenLaufen(opt: { archiv?: string; daten?: string; bestaende?: string[]; ausfuehren?: boolean; env?: NodeJS.ProcessEnv; jetzt?: Date; cwd?: string; host?: string }): Promise<NachholenBericht>;
