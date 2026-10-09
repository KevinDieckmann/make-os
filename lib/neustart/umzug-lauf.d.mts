// Typen zu lib/neustart/umzug-lauf.mjs (Ablauf des Neustart-Umzugs mit Dateien, 09.10.2026).
import type { AufgabenBericht, Entscheidung, Verweise } from './umzug.mjs';

export class UmzugAbbruch extends Error {
  constructor(gruende: string[], code?: number);
  gruende: string[];
  /** 2 = Eingaben/Inhalt (nichts geschrieben), 3 = eine App hält einen Ordner, 1 = Fehler beim Schreiben/Prüfen. */
  code: number;
}

export interface UmzugOptionen {
  von: string;
  nach: string;
  ausfuehren?: boolean;
  auch?: string[];
  mitBauplan?: boolean;
  mitHeadAufgaben?: boolean;
  personen?: Map<string, string>;
  haushalte?: Map<string, string>;
  grabsteinOrdner?: string;
  absichtenIgnorieren?: boolean;
  env?: NodeJS.ProcessEnv;
  jetzt?: Date;
  kennung?: (praefix: string) => string;
  cwd?: string;
  host?: string;
}

export interface BestandBericht {
  name: string; neuName?: string; entscheidung: Entscheidung; grund: string;
  alt: Record<string, number>; neu: Record<string, number>; kennungenAlt: string; kennungenNeu: string; inhalt: 'unverändert' | 'angepasst';
}
export interface DateienZaehler { eintraege: number; mitDatei: number; fehlen: number; groesseAbweichend: number }

export interface UmzugBericht {
  version: number;
  probelauf: boolean;
  am: string;
  von: string;
  nach: string;
  format: 'kompatibel' | 'v2';
  verschluesselt: boolean;
  pepper: 'gesetzt' | 'fehlt' | null;
  konten: { personen: { speicher: string; rolle: 'inhaber' | 'mitglied'; haushalt?: string; finanzRecht?: 'business'; hauptInhaber?: boolean }[]; haushalt: string | null };
  haushalteImAlten: string[];
  bestaende: BestandBericht[];
  nicht: { name: string; entscheidung: Entscheidung; bereich: string; grund: string }[];
  aufgaben: AufgabenBericht | null;
  aufgabenDateien: { name: string; alt: number; neu: number; nicht: number; beleg: number }[];
  dateien: { crm: DateienZaehler; aufgaben: DateienZaehler; nichtUebernommen: number; ohneEintrag: number; bilder: number; bytes: number } | null;
  grabsteine: { ordner: string; gefunden: boolean; anzahl: number; angewendetAufDemStand: boolean; markeUebernommen: boolean } | null;
  verweise: { alt: Verweise; neu: Verweise } | null;
  hinweise: string[];
  geschrieben: { bestaende: number; dateien: number; bytes: number; geprueft: number } | null;
}

export function umzugLaufen(opt: UmzugOptionen): Promise<UmzugBericht>;
