// Typen zu lib/neustart/umzug.mjs (reiner Kern des Neustart-Umzugs, 09.10.2026).
export const UMZUG_VERSION: number;
export const NEUSTART_MARKE: 'system/neustart.json';
export const BESTAND_NAME: RegExp;
export const NAME_OK: RegExp;

export type Entscheidung = 'mit' | 'gefiltert' | 'bedingt' | 'nicht' | 'nie';
export interface Regel { muster: string; art: string; grund: string; bearbeiten?: 'aufgaben' | 'aufgaben-dateien' | 'grabstein-marke' }
export const MITNEHMEN: readonly Regel[];
export const NICHT_MITNEHMEN: readonly { muster: string; grund: string }[];
export const NIE_MITNEHMEN: readonly string[];
export function bereichVon(name: string): string;
export function musterTrifft(muster: string, name: string): boolean;
export interface Einteilung { entscheidung: Entscheidung; grund: string; bereich: string; art?: string; bearbeiten?: Regel['bearbeiten'] }
export function bestandEinteilen(name: string, opt?: { auch?: readonly string[]; mitBauplan?: boolean }): Einteilung;
export function auchPruefen(muster: readonly string[]): string[];

export function abbildungAus(angaben: readonly string[], was?: string): Map<string, string>;
export function abbildungenVereinen(personen: ReadonlyMap<string, string>, haushalte: ReadonlyMap<string, string>): Map<string, string>;
export function namenErsetzen<T>(wert: T, paare: ReadonlyMap<string, string>): { wert: T; n: number };
export function bestandsnameAbbilden(name: string, paare: ReadonlyMap<string, string>): string;

export const SYSTEM_AUFGABEN: readonly { muster: RegExp; grund: string; schalter?: 'mitHeadAufgaben' }[];
export const UEBERNOMMEN_TITEL: string;
export function systemGrund(id: string, opt?: { mitHeadAufgaben?: boolean }): string | null;
export interface AufgabenBericht {
  alt: { aufgaben: number; projekte: number; listen: number };
  neu: { aufgaben: number; projekte: number; listen: number };
  nicht: { papierkorb: number; archiv: number; modul: Record<string, number>; meilensteinListenLeer: number; listenArchiv: number; projektePapierkorb: number; projekteArchiv: number };
  uebernommenProjekte: { space: string; id: string }[];
  umgehaengt: { listen: number; aufgaben: number };
  geloest: { ziel: number; zoe: number; abhaengig: number; liste: number };
}
export interface AufgabenErgebnis {
  stand: Record<string, unknown>;
  bericht: AufgabenBericht;
  projektUm: Map<string, string>;
  listeUm: Map<string, string>;
  aufgabenIds: Set<string>;
  listenIds: Set<string>;
  projektIds: Set<string>;
}
export function aufgabenUebernehmen(stand: unknown, opt?: { kennung?: (praefix: string) => string; jetzt?: string; mitHeadAufgaben?: boolean }): AufgabenErgebnis;
export function belegKennungen(kartei: unknown): Set<string>;
export function aufgabenDateienUebernehmen(datei: unknown, ctx: { projektUm: ReadonlyMap<string, string>; listeUm: ReadonlyMap<string, string>; aufgabenIds: ReadonlySet<string>; listenIds: ReadonlySet<string>; projektIds: ReadonlySet<string>; belege: ReadonlySet<string> }): { datei: { eintraege: Record<string, unknown>[] } & Record<string, unknown>; bericht: { alt: number; neu: number; nicht: number; beleg: number } };

export const LISTEN_NAMEN: Readonly<Record<string, string>>;
export interface Fingerabdruck { anzahl: Record<string, number>; kennungen: number; hash: string }
export function fingerabdruck(wert: unknown): Fingerabdruck;
export function textFingerabdruck(text: string): string;
export interface Verweise {
  aufgabeKontaktTot: number; aufgabeFirmaTot: number; aufgabeMandatTot: number; aufgabeDealTot: number; aufgabeElternTot: number; aufgabeProjektTot: number;
  aufgabeListeTot: number; aufgabeAbhaengigTot: number; crmAufgabeTot: number; crmAufgabeNichtUebernommen: number;
  crmDateiBezugTot: number; crmDateiFehlt: number; aufgabenDateiBezugTot: number; aufgabenDateiFehlt: number; einwilligungBelegTot: number;
}
export function verweisePruefen(d: { kartei: unknown; crm: unknown; tasks: unknown; crmDateien: unknown[]; aufgabenDateien: unknown[]; dateienDa?: ReadonlySet<string>; nichtUebernommen?: ReadonlySet<string> }): Verweise;

export const ABSICHTEN_KERN: readonly string[];
export function absichtenOffen(datei: unknown): { kern: Record<string, number>; sonst: Record<string, number> };
export function grabsteinStandAus(roh: Buffer | Uint8Array | null | undefined): string;
export function pepperFingerabdruck(env?: NodeJS.ProcessEnv, lesen?: (pfad: string) => string | null): string | null;
export function pfadeGruende(von: string | undefined, nach: string | undefined, pfad: typeof import('node:path'), cwd: string): string[];
