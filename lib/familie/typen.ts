// ─── Familie & Partnerschaft — Datenmodell (24.09.) ─────────────────────────
// Kevin: „Man muss eine Familie darüber managen. Wichtig ist mir, dass ein
// klarer Fokus auf den Ehepartner gelegt wird, ansonsten geht das Fundament
// kaputt.“ Recherche 24.09. (Gottman, Berger „Marriage Meetings“, Aron,
// National Marriage Project, Fair Play, Feiler, Covey, EPL): das Paar vor der
// Familie · kleine Dinge oft · ein fester Wochentermin mit Agenda · Neues
// erleben · volle Verantwortung statt Mithelfen · Konflikte begleiten ·
// Ehe ≠ Business · gemeinsam und transparent, nie eine Person gegen die andere.
//
// Ein Speicher je Haushalt (familie--<haushalt>), Zugriff wie bei den
// Haushaltsfinanzen. Jeder Eintrag hat eine Kennung — zu zweit werden nur
// Einzeländerungen geschrieben (lib/sync.ts).

export type Sichtbarkeit = 'paar' | 'nur-ich';
export interface Basis { id: string; von: string; am: string; sichtbarkeit?: Sichtbarkeit }

export interface Einstellungen {
  gespraech: { wochentag: number; uhrzeit: string; dauerMin: number };
  /** Business-freie Zeiten (Ehe ≠ Business). */
  businessFrei: { tage: number[]; von: string; bis: string }[];
  kinder: boolean;
  /** Urlaub, Krankheit, Geburt — der Rhythmus pausiert. */
  ausnahmeBis: string | null;
  /** Paar-Gespräche im gemeinsamen iCloud-Kalender: Datum → Termin-Uid (26.09.). */
  kalenderTermine?: Record<string, string>;
}

export interface Gespraech extends Basis {
  datum: string; status: 'geplant' | 'gehalten' | 'ausgefallen';
  wertschaetzungen: { von: string; text: string }[];
  lief_gut: string[]; orga: string[]; themenIds: string[];
  wuensche: { von: string; text: string }[];
  schoeneZeit: string; businessGrenzeGehalten: boolean | null; notiz: string;
}
export interface Thema extends Basis { titel: string; art: 'loesbar' | 'dauerhaft' | 'unklar'; status: 'offen' | 'besprochen' | 'vereinbart' | 'geparkt'; hut: 'privat' | 'business' }
export interface Vereinbarung extends Basis { text: string; wer: string; faellig: string | null; status: 'offen' | 'erledigt' | 'verworfen'; taskId?: string }
export interface Wertschaetzung extends Basis { an: string; text: string; datum: string }
export interface Ritualtag { datum: string; erledigt: string[] }   // Ritual-Kennungen, gemeinsam
export interface DateIdee extends Basis { titel: string; tags: string[]; aufwand: 1 | 2 | 3; kosten: 0 | 1 | 2 | 3; dauer: 'abend' | 'halbtag' | 'tag' | 'wochenende'; neu: boolean }
export interface Date extends Basis { titel: string; ideeId: string | null; datum: string; planer: string; status: 'geplant' | 'stattgefunden' | 'abgesagt'; neuesErlebnis: boolean; nachklang: { von: string; text: string }[]; /** Termin im gemeinsamen iCloud-Kalender (26.09.). */ kalenderUid?: string }
export interface LoveMapAntwort extends Basis { frageId: string; person: string; antwort: string }
export interface Wunsch extends Basis { text: string; kategorie: 'alltag' | 'zeit' | 'naehe' | 'erlebnis' | 'geschenk'; status: 'offen' | 'erfuellt' | 'zurueckgezogen' }
export interface Profil { person: string; stress: string; traeume: string; wasMirGuttut: string; stand: string }
export interface Reparatur extends Basis { datum: string; pauseBis: string | null; reflexionen: { person: string; gefuehle: string; meineSicht: string; meinAnteil: string; wunsch: string; geteilt: boolean }[]; abgeschlossen: string | null; vereinbarung: string }
export interface Vision { jahr: number; leitbild: string; ziele: { id: string; text: string; erreicht: boolean }[]; traeume: { person: string; text: string }[] }

export interface WichtigerTag extends Basis { titel: string; art: 'geburtstag' | 'jahrestag' | 'gedenktag' | 'sonstig'; datum: string /* MM-TT oder JJJJ-MM-TT */; vorlaufTage: number; wer: string; aktion: 'geschenk' | 'karte' | 'anruf' | 'feier'; erledigt: number[] }
export interface Karte extends Basis { titel: string; bereich: 'zuhause' | 'unterwegs' | 'fuersorge' | 'magie' | 'wild'; inhaber: string | null; mindeststandard: string; rhythmus: string; aufwandMinWoche: number | null; geprueft: string | null; aktiv: boolean }
export interface Ritual extends Basis { titel: string; ebene: 'paar' | 'familie'; rhythmus: 'taeglich' | 'woechentlich' | 'monatlich' | 'jaehrlich' }
export interface Mensch extends Basis { name: string; rolle: 'kind' | 'eltern' | 'geschwister' | 'freund' | 'sonstig'; geburtstag: string | null; kontaktAlleTage: number | null; letzterKontakt: string | null; notiz: string }

export interface Familie {
  einstellungen: Einstellungen;
  gespraeche: Gespraech[]; themen: Thema[]; vereinbarungen: Vereinbarung[]; wertschaetzungen: Wertschaetzung[];
  rituale: Ritual[]; ritualtage: Ritualtag[];
  ideen: DateIdee[]; dates: Date[];
  lovemap: LoveMapAntwort[]; wuensche: Wunsch[]; profile: Profil[]; reparaturen: Reparatur[];
  visionen: Vision[]; tage: WichtigerTag[]; karten: Karte[]; menschen: Mensch[];
}

/** Listen mit Kennung — zu zweit einzeln änderbar. */
export const LISTEN = ['gespraeche', 'themen', 'vereinbarungen', 'wertschaetzungen', 'rituale', 'ideen', 'dates', 'lovemap', 'wuensche', 'reparaturen', 'tage', 'karten', 'menschen'] as const;
export type Liste = typeof LISTEN[number];
