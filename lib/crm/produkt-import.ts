// ─── Produkte & Mandate · Produkt-Import (P4, 19.10.) — rein, Server + Browser ──────────────────────────────────────────────────
// PRODUKTE_KONZEPT.md › Import: Kevin bringt seine echten Produkte (Text, Tabelle, Dokument), Claude bringt sie selbstständig in die
// Software — über EINEN Weg: `POST /api/crm/produkte/import` (Vorschau schreibt nie, dann anlegen bzw. ändern über den CRM-Schreibweg).
// Hier steht nur die Regel (rein, ohne Ein-/Ausgabe):
//   · das Format `ProduktImport` = eine Produkt-Karte als JSON (alle Karten-Felder aus P1 + Name, Status, Gesellschaft, Texte, Lieferumfang,
//     Ablauf), Bezüge (Anrechnung, inklusive) über Produkt-NAMEN — aufgelöst gegen die Lieferung und den Katalog
//   · `importPlanen(bestand, eingaben, kontext)` → je Produkt neu · ändert (Feld alt → neu) · gleich · Fehler · übersprungen, dazu die Ops für den
//     CRM-Schreibweg (neu = upsert, ändert = teil mit NUR den gelieferten Feldern — Teil-Merge), die Ablauf-Zuordnungen und die Verknüpfung
//     gleichnamiger Treppen-Stufen ohne Produkt (nur `leistungIds`; sonst stünde die Stufe nach dem Import doppelt da)
//   · `importAusTabelle(csv)` → `ProduktImport[]` (eine Zeile je Produkt bzw. je Preis-Teil; gleiche Namen werden zusammengeführt)
// Regeln: Abgleich über den Namen ohne Groß/Klein und Leerzeichen (`nameSchluessel`); Papierkorb und Archiv werden erkannt und NIE wiederbelebt
// (nur Hinweis); geprüft über `produktPruefen`/`preisteilPruefen` (lib/crm/produkt-karte.ts) — nie still gekürzt (zu lang → Fehler 413);
// zweimal derselbe Import = beim zweiten Mal alles „gleich“. Keine echten Produkte, Preise oder Namen hier (Plattform-Regel).

import type { CrmBestand, Gesellschaft, Leistung, LeistungAngebot, LeistungTyp, PreisTeil, PreisTeilArt, ProduktRegeln, ProduktRolle, ProduktVertrag } from './typen';
import type { ListenOp } from '@/lib/sync';
import {
  kartenFelderSaeubern, produktPruefen, preiseText, PRODUKT_GRENZEN, VERTRAG_DANACH, RECHNUNGS_RHYTHMEN, REISEKOSTEN, INKLUSIVE_JE,
  KARTEN_FELDER, type PruefFehler,
} from './produkt-karte';
import { ANGEBOT_GRENZEN, leistungAngebotSaeubern } from './angebote';
import { csvLesenMitBefund } from '@/lib/make-one/csv';
import { inCent } from '@/lib/finanzen/ust';
import { KERN_EINHEITEN, gesellschaftAusEinheit, istRegisterKennung, bereichVonGesellschaft } from '@/lib/einheiten';

// ── Grenzen ──────────────────────────────────────────────────────────────────

/** Höchstens so viele Produkte je Import, höchstens so groß die Anfrage — darüber 413 (nie gekürzt). */
export const IMPORT_GRENZEN = { produkte: 100, bytes: 1_000_000, ablauf: 200 } as const;
/** Längen der Grundfelder (= die Säuberung in lib/crm/speicher.ts `leistung`) — darüber Fehler 413 statt still gekürzt. */
export const TEXT_GRENZEN = {
  name: 160, beschreibung: 1500, ergebnis: 600, grenzen: 600, linie: 80, lieferumfangEintrag: 300, lieferumfang: 500,
  angebotTitel: 200, einleitung: 3000, leistungstext: ANGEBOT_GRENZEN.text, angebotErgebnis: 2000, hinweise: 2000,
} as const;

// ── Das Format ───────────────────────────────────────────────────────────────

/** Ein Preis-Teil im Import — wie `PreisTeil` (lib/crm/typen.ts), Beträge wahlweise in Euro (`betrag`, auch „2.990,50“) oder Cent. */
export interface PreisTeilImport {
  /** kostenlos · fest · monatlich · jaehrlich · je_einheit · tagessatz · stundensatz · erfolg (gängige Synonyme werden erkannt). */
  art: PreisTeilArt | string;
  betrag?: number | string; betragCent?: number;
  bis?: number | string; bisCent?: number;
  /** Nur bei „je Einheit“: „je Event“, „je Seat“ … */
  einheit?: string;
  /** grund = immer dabei (Vorgabe), option = nur wenn gewählt. `optional: true` heißt dasselbe. */
  rolle?: 'grund' | 'option'; optional?: boolean;
  /** Anzahlung in Prozent (50/50 = 50) — kurz oder als `zahlplan`. */
  anzahlungProzent?: number | string; zahlplan?: { anzahlungProzent: number };
  kontingent?: string;
  /** Nur beim Stundensatz: höchstens N Stunden je Monat — kurz oder als `deckel`. */
  stundenJeMonat?: number | string; deckel?: { stundenJeMonat: number };
  text?: string;
  id?: string;
}
/** Regeln im Import — Bezüge über Produkt-NAMEN (oder Kennung des Katalogs). */
export interface RegelnImport {
  anrechnung?: { auf: string[]; anteilProzent?: number | string } | null;
  maxGleichzeitig?: number | string | null;
  inklusive?: { produkt: string; menge?: number | string; je: 'monat' | 'quartal' | 'jahr' | string }[] | null;
}
/**
 * EIN Produkt im Import = eine Produkt-Karte als JSON. Nur `name` ist Pflicht; leer gelassene Felder bleiben, wie sie sind (Teil-Merge),
 * `null` leert ein Feld. Abgleich über den Namen (ohne Groß/Klein und Leerzeichen).
 */
export interface ProduktImport {
  name: string;
  /** aktiv · entwurf. Fehlt er bei einem neuen Produkt: aktiv, wenn ein Leistungstext da ist, sonst Entwurf. */
  status?: 'aktiv' | 'entwurf' | string;
  /** Kennung (kdc · kdv · ug · g-… · offen) oder Anzeigename (Kerneinheiten, Register). Fehlt er bei einem neuen Produkt: offen. */
  gesellschaft?: string;
  typ?: LeistungTyp | string;
  linie?: string | null;
  /** EIN Satz Kurzbeschreibung. */
  beschreibung?: string | null;
  /** Kurzform für `angebot.leistungstext` (Pflicht für „aktiv“). */
  leistungstext?: string | null;
  angebot?: Partial<LeistungAngebot> | null;
  ergebnis?: string | null;
  grenzen?: string | null;
  lieferumfang?: string[] | null;
  preise?: PreisTeilImport[] | null;
  vertrag?: Partial<Record<keyof ProduktVertrag, unknown>> | null;
  regeln?: RegelnImport | null;
  rolle?: ProduktRolle | string | null;
  ebene?: number | string | null;
  aufgabe?: string | null;
  kennzahl?: string | null;
  dauerTage?: number | string | null;
  aufwandStundenWoche?: number | string | null;
  ziel?: { umsatz?: number | string | null; kunden?: number | string | null } | null;
  /** Name einer Fulfillment-Vorlage (Ablauf der Lieferung) — zugeordnet, wenn es genau eine mit diesem Namen gibt, sonst Hinweis. */
  ablauf?: string | null;
}
/** Die erlaubten Felder eines Produkts im Import (alles andere → Fehler, damit ein Tippfehler nie still verloren geht). */
export const IMPORT_FELDER = [
  'name', 'status', 'gesellschaft', 'typ', 'linie', 'beschreibung', 'leistungstext', 'angebot', 'ergebnis', 'grenzen', 'lieferumfang',
  'preise', 'vertrag', 'regeln', 'rolle', 'ebene', 'aufgabe', 'kennzahl', 'dauerTage', 'aufwandStundenWoche', 'ziel', 'ablauf',
] as const;
const PREIS_TEIL_FELDER = ['art', 'betrag', 'betragCent', 'bis', 'bisCent', 'einheit', 'rolle', 'optional', 'anzahlungProzent', 'zahlplan', 'kontingent', 'stundenJeMonat', 'deckel', 'text', 'id'];
const VERTRAG_FELDER = ['mindestlaufzeitMonate', 'danach', 'kuendigungsfristTage', 'rechnungsrhythmus', 'zahlungszielTage', 'ustSatz', 'reisekosten'] as const;
const ANGEBOT_FELDER = ['titel', 'einleitung', 'leistungstext', 'ergebnis', 'hinweise'] as const;

// ── Das Ergebnis ─────────────────────────────────────────────────────────────

export type ImportArt = 'neu' | 'aendert' | 'gleich' | 'fehler' | 'uebersprungen';
export const IMPORT_ART_TEXT: Record<ImportArt, string> = { neu: 'neu', aendert: 'ändert', gleich: 'gleich', fehler: 'Fehler', uebersprungen: 'übersprungen' };
/** Ein Feld, das sich ändert — zum Lesen (Texte), nie die Rohwerte. */
export interface ImportFeld { feld: string; label: string; alt: string; neu: string }
export interface ImportZeile {
  /** Stelle in der Lieferung (ab 1). */
  nr: number;
  name: string;
  art: ImportArt;
  /** Kennung des Produkts (bestehend bzw. die, unter der es angelegt wird). */
  id?: string;
  felder: ImportFeld[];
  fehler: string[];
  hinweise: string[];
  ablauf?: { name: string; stand: 'neu' | 'gleich' | 'fehlt' | 'mehrdeutig' | 'entfernen'; vorlageId?: string };
  /** Gleichnamige Stufe der Leistungstreppe: verknüpfen (sie hat kein Produkt), gleich (schon verknüpft), mehrdeutig/vergeben (nur Hinweis). */
  stufe?: { id?: string; name: string; stand: 'verknuepfen' | 'gleich' | 'mehrdeutig' | 'vergeben' };
}
export interface ImportPlan {
  zeilen: ImportZeile[];
  zahlen: Record<ImportArt, number>;
  /** Fehler, die zu keinem einzelnen Produkt gehören (Form, Grenzen, Tabelle). */
  fehler: string[];
  hinweise: string[];
  /** 200 = darf übernommen werden · 400 = Fehler · 413 = zu groß. */
  status: 200 | 400 | 413;
  /** Für den CRM-Schreibweg (nur bei Status 200 schreiben): neu = upsert, ändert = teil mit den gelieferten Feldern. */
  ops: ListenOp[];
  /** Ablauf-Zuordnungen Produkt → Paket-Vorlage (`null` = entfernen) — über den Fulfillment-Weg (`zuordnung`). */
  zuordnungen: { leistungId: string; vorlageId: string | null }[];
  /**
   * Gespeicherte Stufen der Leistungstreppe ohne Produkt, die mit einem Produkt der Lieferung gleich heißen — über den Treppen-Schreibweg
   * (Op `stufe` mit Stand) verknüpft: nur `leistungIds` ändert sich (das Produkt vorn, alte Verweise bleiben dahinter).
   */
  stufen: { stufeId: string; leistungId: string; leistungIds: string[]; stand?: string }[];
}
export interface ImportKontext {
  /** Kennung für ein neues Produkt (Server: `neueKennung('l')`). */
  neueId: () => string;
  /** Gesellschaften aus dem Register (`g-…` mit Anzeigename) — für Namen statt Kennungen. */
  register?: readonly { id: string; name: string; status?: string }[];
  /** Paket-Vorlagen des Fulfillments (Abläufe der Lieferung) und die bestehende Zuordnung Produkt → Vorlage. */
  vorlagen?: readonly { id: string; titel: string }[];
  zuordnung?: Readonly<Record<string, { vorlageId: string }>>;
  /** Konto „nur Business“: Produkte einer Privat-Einheit sind dann Fehler (wie überall in der Markttraktion). */
  nurBusiness?: boolean;
  /**
   * Die GESPEICHERTEN Stufen der Leistungstreppe (mit Stand des Eintrags) — eine gleichnamige Stufe ohne vorhandenes Produkt wird beim Übernehmen
   * mit dem Produkt verknüpft, sonst stünde sie nach dem Import doppelt da (Stufe ohne Produkt + neue Stufe der Karte).
   */
  stufen?: readonly { id: string; name: string; leistungIds: readonly string[]; stand?: string }[];
}

// ── Kleine Helfer ────────────────────────────────────────────────────────────

const G = PRODUKT_GRENZEN;
const istObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Abgleichs-Schlüssel eines Namens: ohne Groß/Klein und ohne Leerzeichen (NFC). */
export const nameSchluessel = (s: unknown): string => String(s ?? '').normalize('NFC').toLocaleLowerCase('de-DE').replace(/\s+/g, '');
/** Für Synonyme: klein, Umlaute ausgeschrieben, nur Buchstaben und Ziffern. */
const wort = (s: unknown): string => String(s ?? '').normalize('NFC').toLocaleLowerCase('de-DE')
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
/** Text wie die Säuberung des Servers (`txt`): ohne Nullzeichen, getrimmt. */
const text = (v: string) => v.replace(/\u0000/g, '').trim();
/** Absatz wie die Angebotstexte (`leistungAngebotSaeubern`): Zeilenenden vereinheitlicht. */
const absatz = (v: string) => v.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim();
const gleich = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const kurz = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Euro aus einer Zahl oder einem Text („2.990“, „2.990,50 €“, „1500.5“) — NaN, wenn nichts Lesbares. */
export function euroAus(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;
  let t = v.replace(/ /g, ' ').replace(/€|eur(o)?/gi, '').replace(/\s+/g, '').trim();
  if (!t) return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}
/** Zahl aus einer Zahl oder einem Text mit Einheit dahinter („6 Monate“, „30 %“, „7,5“) — NaN, wenn nichts Lesbares. */
export function zahlAus(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;
  const m = v.trim().match(/^(-?\d+(?:[.,]\d+)?)[\sa-zA-ZäöüÄÖÜß%./]*$/);
  return m ? Number(m[1].replace(',', '.')) : NaN;
}

// Synonyme (JSON und Tabelle) — die Kennungen selbst gelten immer.
const PREIS_ART_WORTE: Record<string, PreisTeilArt> = {
  kostenlos: 'kostenlos', gratis: 'kostenlos', frei: 'kostenlos', ohnekosten: 'kostenlos',
  fest: 'fest', festpreis: 'fest', einmalig: 'fest', pauschal: 'fest', pauschale: 'fest', pauschalpreis: 'fest', projektpreis: 'fest',
  monatlich: 'monatlich', monat: 'monatlich', promonat: 'monatlich', jemonat: 'monatlich', mtl: 'monatlich', monatspauschale: 'monatlich',
  jaehrlich: 'jaehrlich', jahr: 'jaehrlich', projahr: 'jaehrlich', jejahr: 'jaehrlich', jahreslizenz: 'jaehrlich', jahrespreis: 'jaehrlich',
  jeeinheit: 'je_einheit', proeinheit: 'je_einheit', einheit: 'je_einheit', stueck: 'je_einheit', jestueck: 'je_einheit',
  tagessatz: 'tagessatz', tag: 'tagessatz', protag: 'tagessatz', jetag: 'tagessatz',
  stundensatz: 'stundensatz', stunde: 'stundensatz', prostunde: 'stundensatz', jestunde: 'stundensatz', std: 'stundensatz',
  erfolg: 'erfolg', erfolgsanteil: 'erfolg', erfolgsbeteiligung: 'erfolg', erfolgshonorar: 'erfolg', bonus: 'erfolg', provision: 'erfolg',
};
/** Preis-Form aus Kennung oder Synonym; „je Event“/„pro Seat“ = je Einheit mit dieser Einheit. */
export function preisArtAus(v: unknown): { art: PreisTeilArt; einheit?: string } | null {
  const roh = String(v ?? '').trim();
  const a = PREIS_ART_WORTE[wort(roh)];
  if (a) return { art: a };
  const je = roh.match(/^(je|pro)\s+(.{1,38})$/i);
  if (je) return { art: 'je_einheit', einheit: `je ${je[2].trim()}` };
  return null;
}
const aus = <T extends string>(v: unknown, worte: Record<string, T>): T | undefined => worte[wort(v)];
const STATUS_WORTE: Record<string, 'aktiv' | 'entwurf'> = { aktiv: 'aktiv', active: 'aktiv', live: 'aktiv', entwurf: 'entwurf', draft: 'entwurf' };
const TYP_WORTE: Record<string, LeistungTyp> = {
  diagnose: 'diagnose', check: 'diagnose', workshop: 'workshop', retainer: 'retainer', begleitung: 'retainer', sprint: 'sprint', projekt: 'sprint',
  vermittlung: 'vermittlung', software: 'software', lizenz: 'software',
};
const ROLLE_WORTE: Record<string, ProduktRolle> = { haupt: 'haupt', hauptprodukt: 'haupt', zusatz: 'zusatz', zusatzmodul: 'zusatz', modul: 'zusatz', addon: 'zusatz', beides: 'beides', beide: 'beides' };
const DANACH_WORTE: Record<string, NonNullable<ProduktVertrag['danach']>> = {
  monatlichkuendbar: 'monatlich_kuendbar', monatlich: 'monatlich_kuendbar', kuendbar: 'monatlich_kuendbar',
  verlaengertumlaufzeit: 'verlaengert_um_laufzeit', verlaengert: 'verlaengert_um_laufzeit', verlaengertsich: 'verlaengert_um_laufzeit', automatisch: 'verlaengert_um_laufzeit',
  endet: 'endet', ende: 'endet', laeuftaus: 'endet',
};
const RHYTHMUS_WORTE: Record<string, NonNullable<ProduktVertrag['rechnungsrhythmus']>> = { monatlich: 'monatlich', monat: 'monatlich', quartal: 'quartal', quartalsweise: 'quartal', vierteljaehrlich: 'quartal', einmalig: 'einmalig' };
const REISE_WORTE: Record<string, NonNullable<ProduktVertrag['reisekosten']>> = { separat: 'separat', extra: 'separat', zusaetzlich: 'separat', inklusive: 'inklusive', inkl: 'inklusive', enthalten: 'inklusive' };
const JE_WORTE: Record<string, 'monat' | 'quartal' | 'jahr'> = { monat: 'monat', monatlich: 'monat', quartal: 'quartal', jahr: 'jahr', jaehrlich: 'jahr' };
for (const id of VERTRAG_DANACH) DANACH_WORTE[wort(id)] = id;
for (const id of RECHNUNGS_RHYTHMEN) RHYTHMUS_WORTE[wort(id)] = id;
for (const id of REISEKOSTEN) REISE_WORTE[wort(id)] = id;
for (const id of INKLUSIVE_JE) JE_WORTE[wort(id)] = id;

// ── Anzeige ──────────────────────────────────────────────────────────────────

const FELD_LABEL: Record<string, string> = {
  name: 'Name', status: 'Status', gesellschaft: 'Gesellschaft', typ: 'Typ', linie: 'Linie', beschreibung: 'Kurzbeschreibung', ergebnis: 'Ergebnis', grenzen: 'Grenzen',
  lieferumfang: 'Lieferumfang', 'angebot.titel': 'Titel im Angebot', 'angebot.einleitung': 'Einleitung', 'angebot.leistungstext': 'Leistungstext',
  'angebot.ergebnis': 'Ergebnis im Angebot', 'angebot.hinweise': 'Hinweise im Angebot', preise: 'Preis',
  'vertrag.mindestlaufzeitMonate': 'Mindestlaufzeit (Monate)', 'vertrag.danach': 'Danach', 'vertrag.kuendigungsfristTage': 'Kündigungsfrist (Tage)',
  'vertrag.rechnungsrhythmus': 'Rechnung', 'vertrag.zahlungszielTage': 'Zahlungsziel (Tage)', 'vertrag.ustSatz': 'USt-Satz (%)', 'vertrag.reisekosten': 'Reisekosten',
  'regeln.anrechnung': 'Anrechnung', 'regeln.maxGleichzeitig': 'Höchstens gleichzeitig', 'regeln.inklusive': 'Inklusive', rolle: 'Rolle', ebene: 'Stufe der Treppe',
  aufgabe: 'Aufgabe', kennzahl: 'Kennzahl', dauerTage: 'Dauer (Tage)', aufwandStundenWoche: 'Aufwand (Std./Woche)', 'ziel.umsatz': 'Umsatzziel (€)', 'ziel.kunden': 'Kundenziel',
  ablauf: 'Ablauf', stufe: 'Leistungstreppe',
};
const DANACH_TEXT: Record<string, string> = { monatlich_kuendbar: 'monatlich kündbar', verlaengert_um_laufzeit: 'verlängert sich um die Laufzeit', endet: 'endet' };
const ROLLE_TEXT: Record<string, string> = { haupt: 'Hauptprodukt', zusatz: 'Zusatzmodul', beides: 'Haupt- oder Zusatzmodul' };
const JE_TEXT: Record<string, string> = { monat: 'Monat', quartal: 'Quartal', jahr: 'Jahr' };

/** Anzeigename einer Gesellschaft (Kerneinheit, Register oder „offen“). */
export function gesellschaftName(g: string | undefined, register?: ImportKontext['register']): string {
  if (!g || g === 'offen') return 'offen';
  return KERN_EINHEITEN.find(e => e.id === g)?.label ?? register?.find(x => x.id === g)?.name ?? g;
}
function wertText(feld: string, v: unknown, namen: (id: string) => string, register?: ImportKontext['register']): string {
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return '—';
  switch (feld) {
    case 'preise': return preiseText({ preis: { betrag: 0, einheit: '' }, preise: v as PreisTeil[] });
    case 'gesellschaft': return gesellschaftName(String(v), register);
    case 'vertrag.danach': return DANACH_TEXT[String(v)] ?? String(v);
    case 'rolle': return ROLLE_TEXT[String(v)] ?? String(v);
    case 'regeln.anrechnung': { const a = v as NonNullable<ProduktRegeln['anrechnung']>; return `${a.anteilProzent === 100 ? 'voll' : `zu ${a.anteilProzent} %`} angerechnet auf ${a.auf.map(namen).join(', ')}`; }
    case 'regeln.inklusive': return (v as NonNullable<ProduktRegeln['inklusive']>).map(x => `${x.menge} × ${namen(x.leistungId)} je ${JE_TEXT[x.je] ?? x.je}`).join(' · ');
    case 'ziel.umsatz': return `${Number(v).toLocaleString('de-DE')} €`;
  }
  if (Array.isArray(v)) return kurz(v.map(String).join(' · '));
  if (typeof v === 'number') return v.toLocaleString('de-DE');
  return kurz(String(v));
}

// ── Planen ───────────────────────────────────────────────────────────────────

interface Vorbereitet {
  nr: number; roh: Record<string, unknown> | null; name: string; schluessel: string;
  alt?: Leistung; id?: string; fehler: PruefFehler[]; hinweise: string[]; ueberspringen?: string;
}
const fehler400 = (t: string): PruefFehler => ({ status: 400, text: t });
const fehler413 = (t: string): PruefFehler => ({ status: 413, text: t });

/** Typ eines neuen Produkts ohne Angabe — aus dem Hauptpreis (kostenlos → Diagnose, Erfolg → Vermittlung, fest/je Einheit → Projekt, sonst Begleitung). */
function typAusPreisen(p: PreisTeil[] | undefined): LeistungTyp {
  const h = p?.find(t => t.rolle === 'grund') ?? p?.[0];
  if (!h) return 'retainer';
  return h.art === 'kostenlos' ? 'diagnose' : h.art === 'erfolg' ? 'vermittlung' : h.art === 'fest' || h.art === 'je_einheit' ? 'sprint' : 'retainer';
}

/**
 * Den Import planen — rein, schreibt nichts. Je Produkt: neu · ändert (Feld alt → neu) · gleich · Fehler · übersprungen (Papierkorb/Archiv, nur
 * Hinweis). Status 200 nur ohne jeden Fehler; dann tragen `ops` (CRM-Schreibweg) und `zuordnungen` (Fulfillment) genau die Änderungen.
 */
export function importPlanen(bestand: Pick<CrmBestand, 'leistungen'>, eingaben: unknown, k: ImportKontext): ImportPlan {
  const plan: ImportPlan = { zeilen: [], zahlen: { neu: 0, aendert: 0, gleich: 0, fehler: 0, uebersprungen: 0 }, fehler: [], hinweise: [], status: 200, ops: [], zuordnungen: [], stufen: [] };
  const grenze: PruefFehler[] = [];
  if (!Array.isArray(eingaben)) { plan.fehler.push('„produkte“: eine Liste von Produkten (je Produkt ein Objekt mit mindestens „name“).'); plan.status = 400; return plan; }
  if (!eingaben.length) { plan.fehler.push('Keine Produkte in der Lieferung.'); plan.status = 400; return plan; }
  if (eingaben.length > IMPORT_GRENZEN.produkte) { plan.fehler.push(`Höchstens ${IMPORT_GRENZEN.produkte} Produkte je Import (geliefert: ${eingaben.length}) — bitte aufteilen. Nichts gespeichert.`); plan.status = 413; return plan; }

  const katalog = bestand.leistungen;
  const lebendig = katalog.filter(l => !l.geloeschtAm);

  // 1) Jedes Produkt dem Katalog zuordnen (Name ohne Groß/Klein und Leerzeichen) und eine Kennung festlegen.
  const vor: Vorbereitet[] = eingaben.map((e, i): Vorbereitet => {
    const nr = i + 1;
    if (!istObj(e)) return { nr, roh: null, name: `Produkt ${nr}`, schluessel: '', fehler: [fehler400('Jedes Produkt ist ein Objekt mit mindestens „name“.')], hinweise: [] };
    const name = typeof e.name === 'string' ? text(e.name) : '';
    if (!name) return { nr, roh: e, name: `Produkt ${nr}`, schluessel: '', fehler: [fehler400('Der Name fehlt — über ihn wird abgeglichen.')], hinweise: [] };
    const schluessel = nameSchluessel(name);
    const treffer = katalog.filter(l => nameSchluessel(l.name) === schluessel);
    const aktiv = treffer.filter(l => !l.geloeschtAm && l.status !== 'eingestellt');
    if (aktiv.length > 1) return { nr, roh: e, name, schluessel, fehler: [fehler400(`Im Katalog heißen ${aktiv.length} Produkte so — erst dort eindeutig benennen.`)], hinweise: [] };
    if (aktiv.length === 1) return { nr, roh: e, name, schluessel, alt: aktiv[0], id: aktiv[0].id, fehler: [], hinweise: [] };
    if (treffer.length) {
      const pk = treffer.some(l => l.geloeschtAm);
      return {
        nr, roh: e, name, schluessel, fehler: [], hinweise: [],
        ueberspringen: pk
          ? 'Ein Produkt mit diesem Namen liegt im Papierkorb — es wird nicht wiederbelebt. Erst in Produkte › Papierkorb wiederherstellen, dann erneut importieren.'
          : 'Ein Produkt mit diesem Namen ist archiviert — es wird nicht wiederbelebt. Erst in Produkte › Archiv zurückholen, dann erneut importieren.',
      };
    }
    return { nr, roh: e, name, schluessel, id: k.neueId(), fehler: [], hinweise: [] };
  });
  // Doppelt in der Lieferung → Fehler bei allen Vorkommen.
  const jeName = new Map<string, number[]>();
  for (const v of vor) if (v.schluessel) jeName.set(v.schluessel, [...(jeName.get(v.schluessel) ?? []), v.nr]);
  for (const v of vor) { const nrn = jeName.get(v.schluessel); if (nrn && nrn.length > 1) v.fehler.push(fehler400(`Steht mehrfach in der Lieferung (Nr. ${nrn.join(', ')}) — je Produkt bitte nur einmal.`)); }

  // Bezüge über Namen: zuerst die Lieferung (auch neue), dann der Katalog (ohne Papierkorb); eine Kennung des Katalogs gilt auch.
  const lieferung = new Map(vor.filter(v => v.id && v.schluessel).map(v => [v.schluessel, v.id!]));
  const bekannt = new Set([...lebendig.map(l => l.id), ...vor.filter(v => v.id && !v.alt).map(v => v.id!)]);
  const nameVonId = (id: string) => vor.find(v => v.id === id)?.name ?? katalog.find(l => l.id === id)?.name ?? id;
  const aufloesen = (ref: unknown, wo: string, f: PruefFehler[]): string | null => {
    const r = typeof ref === 'string' ? text(ref) : '';
    if (!r) { f.push(fehler400(`${wo}: Produktname fehlt.`)); return null; }
    const s = nameSchluessel(r);
    const aus1 = lieferung.get(s);
    if (aus1) return aus1;
    const imKatalog = lebendig.filter(l => nameSchluessel(l.name) === s);
    if (imKatalog.length === 1) return imKatalog[0].id;
    if (imKatalog.length > 1) { f.push(fehler400(`${wo}: „${kurz(r, 60)}“ ist mehrdeutig (${imKatalog.length} Produkte im Katalog).`)); return null; }
    if (lebendig.some(l => l.id === r)) return r;
    if (katalog.some(l => l.geloeschtAm && (nameSchluessel(l.name) === s || l.id === r))) { f.push(fehler400(`${wo}: „${kurz(r, 60)}“ liegt im Papierkorb.`)); return null; }
    f.push(fehler400(`${wo}: das Produkt „${kurz(r, 60)}“ gibt es weder in der Lieferung noch im Katalog.`));
    return null;
  };

  // Ablauf: Paket-Vorlagen über den Titel (ohne Groß/Klein und Leerzeichen).
  const vorlageZu = (titel: string) => (k.vorlagen ?? []).filter(x => nameSchluessel(x.titel) === nameSchluessel(titel));
  // Treppe: gespeicherte Stufen; „ohne Produkt“ = keine ihrer Kennungen ist ein vorhandenes Produkt (Papierkorb zählt nicht — wie `katalogTreppe`).
  const gespeichert = k.stufen ?? [];
  const vorhanden = new Set(lebendig.map(l => l.id));

  // 2) Je Produkt die Felder prüfen, auflösen und mit dem Katalog vergleichen.
  for (const v of vor) {
    const zeile: ImportZeile = { nr: v.nr, name: v.name, art: 'gleich', ...(v.id ? { id: v.id } : {}), felder: [], fehler: [], hinweise: [...v.hinweise] };
    plan.zeilen.push(zeile);
    if (v.ueberspringen) { zeile.art = 'uebersprungen'; zeile.hinweise.push(v.ueberspringen); continue; }
    const f: PruefFehler[] = [...v.fehler];
    const roh = v.roh;
    if (!roh || !v.id) { zeile.art = 'fehler'; zeile.fehler = f.map(x => x.text); for (const x of f) if (x.status === 413) grenze.push(x); continue; }
    const alt = v.alt;
    const unbekannt = Object.keys(roh).filter(x => !(IMPORT_FELDER as readonly string[]).includes(x));
    if (unbekannt.length) f.push(fehler400(`Unbekannte Felder: ${unbekannt.map(x => `„${kurz(x, 40)}“`).join(', ')} — erlaubt sind ${IMPORT_FELDER.join(', ')}.`));

    const felder: Record<string, unknown> = {};   // für `teil` (nur Geändertes) bzw. das neue Produkt
    const diff: ImportFeld[] = [];
    const merke = (feld: string, altW: unknown, neuW: unknown) => { if (!gleich(altW, neuW)) diff.push({ feld, label: FELD_LABEL[feld] ?? feld, alt: wertText(feld, altW, nameVonId, k.register), neu: wertText(feld, neuW, nameVonId, k.register) }); };
    const da = (feld: string) => Object.prototype.hasOwnProperty.call(roh, feld) && roh[feld] !== undefined;

    // Name (Schreibweise) — der Schlüssel bleibt derselbe.
    if (v.name.length > TEXT_GRENZEN.name) f.push(fehler413(`Der Name ist zu lang (höchstens ${TEXT_GRENZEN.name} Zeichen) — nichts gekürzt.`));
    if (!alt) felder.name = v.name;
    else if (v.name !== alt.name) { felder.name = v.name; merke('name', alt.name, v.name); }

    // Einfache Texte (null bzw. leer = leeren).
    const einfach = (feld: 'beschreibung' | 'ergebnis' | 'grenzen' | 'linie', max: number) => {
      if (!da(feld)) return;
      const w = roh[feld];
      if (w !== null && typeof w !== 'string') { f.push(fehler400(`${FELD_LABEL[feld]}: Text.`)); return; }
      const t = w === null ? '' : text(w);
      if (t.length > max) { f.push(fehler413(`${FELD_LABEL[feld]} ist zu lang (höchstens ${max.toLocaleString('de-DE')} Zeichen) — nichts gekürzt.`)); return; }
      const a = alt?.[feld] ?? '';
      if (t !== a) { felder[feld] = t || null; merke(feld, a, t); }
    };
    einfach('beschreibung', TEXT_GRENZEN.beschreibung);
    einfach('ergebnis', TEXT_GRENZEN.ergebnis);
    einfach('grenzen', TEXT_GRENZEN.grenzen);
    einfach('linie', TEXT_GRENZEN.linie);

    // Status (aktiv · entwurf) — Archivieren geht nicht über den Import.
    let status: Leistung['status'] | undefined = alt?.status;
    if (da('status')) {
      const s = aus(roh.status, STATUS_WORTE);
      if (!s) f.push(fehler400(['eingestellt', 'archiv', 'archiviert'].includes(wort(roh.status)) ? 'Status: archivieren bitte in der Produkt-Karte — der Import setzt nur aktiv oder Entwurf.' : 'Status: aktiv oder entwurf.'));
      else status = s;
    }

    // Gesellschaft: Kennung oder Anzeigename (Kerneinheiten, Register).
    let gesellschaft: Gesellschaft | undefined = alt?.gesellschaft;
    if (da('gesellschaft')) {
      const r = typeof roh.gesellschaft === 'string' ? text(roh.gesellschaft) : '';
      const g = gesellschaftAus(r, k.register);
      if (!g) f.push(fehler400(`Gesellschaft „${kurz(r, 60)}“ kenne ich nicht — Kennung (${[...KERN_EINHEITEN.map(e => e.id), 'offen'].join(', ')}, g-…) oder der Name aus Unternehmen.`));
      else gesellschaft = g;
    }

    // Typ.
    let typ: LeistungTyp | undefined = alt?.typ;
    if (da('typ')) { const t = aus(roh.typ, TYP_WORTE); if (!t) f.push(fehler400(`Typ: ${Object.values(TYP_WORTE).filter((x, i, l) => l.indexOf(x) === i).join(', ')}.`)); else typ = t; }

    // Lieferumfang (ersetzt die Liste; leer/null = leeren).
    if (da('lieferumfang')) {
      const w = roh.lieferumfang;
      if (w !== null && !Array.isArray(w)) f.push(fehler400('Lieferumfang: eine Liste von Texten.'));
      else {
        const liste = (w ?? []) as unknown[];
        if (liste.some(x => typeof x !== 'string')) f.push(fehler400('Lieferumfang: nur Texte.'));
        const l = liste.filter((x): x is string => typeof x === 'string').map(text).filter(Boolean);
        if (l.length > TEXT_GRENZEN.lieferumfang) f.push(fehler413(`Lieferumfang: höchstens ${TEXT_GRENZEN.lieferumfang} Einträge.`));
        if (l.some(x => x.length > TEXT_GRENZEN.lieferumfangEintrag)) f.push(fehler413(`Lieferumfang: je Eintrag höchstens ${TEXT_GRENZEN.lieferumfangEintrag} Zeichen.`));
        if (!gleich(alt?.lieferumfang ?? [], l)) { felder.lieferumfang = l; merke('lieferumfang', alt?.lieferumfang ?? [], l); }
      }
    }

    // Angebotstexte: `angebot` (Teil-Merge je Text) und die Kurzform `leistungstext`.
    const angebotAlt: Record<string, string> = { ...(alt?.angebot ?? {}) } as Record<string, string>;
    const angebotNeu: Record<string, string> = { ...angebotAlt };
    let angebotBeruehrt = false;
    const AG: Record<(typeof ANGEBOT_FELDER)[number], number> = { titel: TEXT_GRENZEN.angebotTitel, einleitung: TEXT_GRENZEN.einleitung, leistungstext: TEXT_GRENZEN.leistungstext, ergebnis: TEXT_GRENZEN.angebotErgebnis, hinweise: TEXT_GRENZEN.hinweise };
    const angebotText = (sub: (typeof ANGEBOT_FELDER)[number], w: unknown) => {
      angebotBeruehrt = true;
      if (w !== null && typeof w !== 'string') { f.push(fehler400(`${FELD_LABEL[`angebot.${sub}`]}: Text.`)); return; }
      const t = w === null ? '' : absatz(w);
      if (t.length > AG[sub]) { f.push(fehler413(`${FELD_LABEL[`angebot.${sub}`]} ist zu lang (höchstens ${AG[sub].toLocaleString('de-DE')} Zeichen) — nichts gekürzt.`)); return; }
      if (t) angebotNeu[sub] = t; else delete angebotNeu[sub];
    };
    if (da('angebot')) {
      if (roh.angebot === null) { angebotBeruehrt = true; for (const s of ANGEBOT_FELDER) delete angebotNeu[s]; }
      else if (!istObj(roh.angebot)) f.push(fehler400('Angebot: ein Objekt mit titel, einleitung, leistungstext, ergebnis, hinweise.'));
      else {
        const fremd = Object.keys(roh.angebot).filter(x => !(ANGEBOT_FELDER as readonly string[]).includes(x));
        if (fremd.length) f.push(fehler400(`Angebot: unbekannte Felder ${fremd.map(x => `„${kurz(x, 30)}“`).join(', ')}.`));
        for (const s of ANGEBOT_FELDER) if (roh.angebot[s] !== undefined) angebotText(s, roh.angebot[s]);
      }
    }
    if (da('leistungstext')) angebotText('leistungstext', roh.leistungstext);
    const angebotA = leistungAngebotSaeubern(angebotAlt), angebotN = leistungAngebotSaeubern(angebotNeu);
    if (angebotBeruehrt && !gleich(angebotA, angebotN)) {
      felder.angebot = angebotN ?? null;
      for (const s of ANGEBOT_FELDER) merke(`angebot.${s}`, (angebotA as Record<string, string> | undefined)?.[s], (angebotN as Record<string, string> | undefined)?.[s]);
    }

    // Felder der Karte: zusammenführen (vertrag/regeln/ziel je Unterfeld), Bezüge auflösen, prüfen, säubern, vergleichen.
    // `kartenRoh` trägt nur, was lesbar war (Wert oder `null` = leeren) — was nicht lesbar war, steht als Fehler da und bleibt unverändert.
    const kartenRoh: Record<string, unknown> = {};
    const altKarte = alt ? kartenFelderSaeubern(alt as unknown as Record<string, unknown>) : {};
    const vorKarte = f.length;
    const nimm = (feld: string, w: unknown) => { if (w !== undefined) kartenRoh[feld] = w; };
    if (da('preise')) nimm('preise', roh.preise === null ? null : preiseAus(roh.preise, alt?.preise ?? [], f));
    if (da('vertrag')) nimm('vertrag', roh.vertrag === null ? null : vertragAus(roh.vertrag, altKarte.vertrag, f));
    if (da('regeln')) nimm('regeln', roh.regeln === null ? null : regelnAus(roh.regeln, altKarte.regeln, f, aufloesen));
    if (da('ziel')) nimm('ziel', roh.ziel === null ? null : zielAus(roh.ziel, altKarte.ziel, f));
    if (da('rolle')) { if (roh.rolle === null) kartenRoh.rolle = null; else { const r = aus(roh.rolle, ROLLE_WORTE); if (!r) f.push(fehler400('Rolle: haupt, zusatz oder beides.')); else kartenRoh.rolle = r; } }
    for (const [feld, ganz] of [['ebene', true], ['dauerTage', true], ['aufwandStundenWoche', false]] as const) {
      if (!da(feld)) continue;
      if (roh[feld] === null) { kartenRoh[feld] = null; continue; }
      const n = zahlAus(roh[feld]);
      if (!Number.isFinite(n)) f.push(fehler400(`${FELD_LABEL[feld]}: eine Zahl.`));
      else kartenRoh[feld] = ganz ? n : Math.round(n * 100) / 100;
    }
    for (const feld of ['aufgabe', 'kennzahl'] as const) {
      if (!da(feld)) continue;
      if (roh[feld] !== null && typeof roh[feld] !== 'string') { f.push(fehler400(`${FELD_LABEL[feld]}: Text.`)); continue; }
      kartenRoh[feld] = roh[feld] === null ? null : absatz(roh[feld] as string) || null;
    }
    // Prüfen (nur, was mitkommt und nicht geleert wird) — dieselbe Regel wie der Schreibweg (400 Unsinn, 413 zu groß). Schon unlesbar → nicht doppelt.
    const pruef = Object.fromEntries(Object.entries(kartenRoh).filter(([, x]) => x !== null));
    if (f.length === vorKarte && Object.keys(pruef).length) f.push(...produktPruefen(pruef, { id: v.id, bekannt: x => bekannt.has(x) }));
    const neuKarte = kartenFelderSaeubern({ ...altKarte, ...Object.fromEntries(Object.entries(kartenRoh).map(([x, w]) => [x, w ?? undefined])) });
    for (const feld of KARTEN_FELDER) {
      if (!(feld in kartenRoh)) continue;
      const a = (altKarte as Record<string, unknown>)[feld], n = (neuKarte as Record<string, unknown>)[feld];
      if (gleich(a, n)) continue;
      felder[feld] = n ?? null;
      if (feld === 'vertrag' || feld === 'regeln' || feld === 'ziel') {
        const ao = (a ?? {}) as Record<string, unknown>, no = (n ?? {}) as Record<string, unknown>;
        for (const sub of Array.from(new Set([...Object.keys(ao), ...Object.keys(no)]))) merke(`${feld}.${sub}`, ao[sub], no[sub]);
      } else merke(feld, a, n);
    }

    // Neues Produkt: Vorgaben (Status aus dem Leistungstext, Gesellschaft offen, Typ aus dem Hauptpreis).
    const leistungstext = (angebotN as LeistungAngebot | undefined)?.leistungstext?.trim() ?? '';
    if (!alt) {
      if (!da('status')) { status = leistungstext ? 'aktiv' : 'entwurf'; if (!leistungstext) zeile.hinweise.push('Wird als Entwurf angelegt — für „aktiv“ fehlt der Leistungstext.'); }
      if (!da('gesellschaft')) { gesellschaft = 'offen'; zeile.hinweise.push('Gesellschaft offen — bitte in der Karte wählen (oder „gesellschaft“ mitliefern).'); }
      if (!da('typ')) typ = typAusPreisen(neuKarte.preise);
      if (!neuKarte.preise?.length) zeile.hinweise.push('Ohne Preis-Teile — der Preis steht als „offen“.');
    }
    if (status && status !== alt?.status) { felder.status = status; if (alt) merke('status', alt.status, status); }
    if (gesellschaft && gesellschaft !== alt?.gesellschaft) { felder.gesellschaft = gesellschaft; if (alt) merke('gesellschaft', alt.gesellschaft, gesellschaft); }
    if (typ && typ !== alt?.typ) { felder.typ = typ; if (alt) merke('typ', alt.typ, typ); }

    // „aktiv“ nur mit Leistungstext — dieselbe Regel wie der Server (`regelnAbgelehnt`), hier je Produkt statt für den ganzen Import.
    const altText = !!alt?.angebot?.leistungstext?.trim();
    if (status === 'aktiv' && alt?.status !== 'aktiv' && !leistungstext) f.push(fehler400('„aktiv“ geht erst mit Leistungstext — „leistungstext“ mitliefern oder Status „entwurf“.'));
    else if (status === 'aktiv' && alt?.status === 'aktiv' && altText && !leistungstext) f.push(fehler400('Das Produkt ist aktiv — der Leistungstext bleibt Pflicht (erst auf Entwurf stellen, dann leeren).'));
    // Konto „nur Business“: nie ein Produkt einer Privat-Einheit.
    if (k.nurBusiness && bereichVonGesellschaft(gesellschaft ?? 'offen') === 'privat') f.push(fehler400('Gehört nicht zum Business-Bereich — für dieses Konto nicht freigegeben.'));

    // Ablauf (Fulfillment-Vorlage): nur, wenn es genau eine Paket-Vorlage mit diesem Namen gibt — sonst Hinweis, nie Fehler.
    if (da('ablauf')) {
      const bisher = k.zuordnung?.[v.id]?.vorlageId;
      const bisherName = bisher ? (k.vorlagen ?? []).find(x => x.id === bisher)?.titel ?? 'ein Ablauf' : undefined;
      if (roh.ablauf === null || roh.ablauf === '') {
        if (bisher) { zeile.ablauf = { name: '', stand: 'entfernen' }; plan.zuordnungen.push({ leistungId: v.id, vorlageId: null }); merke('ablauf', bisherName, undefined); }
      } else if (typeof roh.ablauf !== 'string') f.push(fehler400('Ablauf: der Name einer Fulfillment-Vorlage (Text).'));
      else {
        const name = text(roh.ablauf);
        if (name.length > IMPORT_GRENZEN.ablauf) f.push(fehler413(`Ablauf: höchstens ${IMPORT_GRENZEN.ablauf} Zeichen.`));
        const t = vorlageZu(name);
        if (!t.length) { zeile.ablauf = { name, stand: 'fehlt' }; zeile.hinweise.push(`Einen Ablauf „${kurz(name, 60)}“ gibt es (noch) nicht im Fulfillment — Zuordnung übersprungen.`); }
        else if (t.length > 1) { zeile.ablauf = { name, stand: 'mehrdeutig' }; zeile.hinweise.push(`${t.length} Abläufe heißen „${kurz(name, 60)}“ — Zuordnung übersprungen, bitte im Fulfillment zuordnen.`); }
        else if (bisher === t[0].id) zeile.ablauf = { name: t[0].titel, stand: 'gleich', vorlageId: t[0].id };
        else { zeile.ablauf = { name: t[0].titel, stand: 'neu', vorlageId: t[0].id }; plan.zuordnungen.push({ leistungId: v.id, vorlageId: t[0].id }); merke('ablauf', bisherName, t[0].titel); }
      }
    }
    // Gleichnamige Stufe der Leistungstreppe ohne Produkt → verknüpfen (nur eindeutig; schon vergeben bzw. mehrdeutig → nur Hinweis).
    const gleichnamig = gespeichert.filter(x => nameSchluessel(x.name) === v.schluessel);
    if (gleichnamig.length) {
      const schon = alt ? gespeichert.find(x => x.leistungIds.includes(v.id!)) : undefined;
      const s0 = gleichnamig[0];
      const anderes = gleichnamig.length === 1 ? s0.leistungIds.find(x => x !== v.id && vorhanden.has(x)) : undefined;
      if (schon && gleichnamig.some(x => x.id === schon.id)) zeile.stufe = { id: schon.id, name: schon.name, stand: 'gleich' };
      else if (gleichnamig.length > 1) {
        zeile.stufe = { name: s0.name, stand: 'mehrdeutig' };
        zeile.hinweise.push(`${gleichnamig.length} Stufen der Leistungstreppe heißen „${kurz(s0.name, 60)}“ — nichts verknüpft, bitte in der Treppe zuordnen.`);
      } else if (anderes) {
        zeile.stufe = { id: s0.id, name: s0.name, stand: 'vergeben' };
        zeile.hinweise.push(`Die Stufe „${kurz(s0.name, 60)}“ der Leistungstreppe gehört schon zu „${kurz(nameVonId(anderes), 60)}“ — nichts verknüpft.`);
      } else if (schon) {
        zeile.stufe = { id: s0.id, name: s0.name, stand: 'vergeben' };
        zeile.hinweise.push(`Das Produkt hängt schon an der Stufe „${kurz(schon.name, 60)}“ — die gleichnamige Stufe „${kurz(s0.name, 60)}“ bleibt ohne Produkt.`);
      } else {
        zeile.stufe = { id: s0.id, name: s0.name, stand: 'verknuepfen' };
        plan.stufen.push({ stufeId: s0.id, leistungId: v.id, leistungIds: [v.id, ...s0.leistungIds.filter(x => x !== v.id)], ...(s0.stand ? { stand: s0.stand } : {}) });
        merke('stufe', undefined, `verknüpft Stufe „${s0.name}“`);
      }
    }

    zeile.fehler = f.map(x => x.text);
    for (const x of f) if (x.status === 413) grenze.push(x);
    if (f.length) { zeile.art = 'fehler'; zeile.felder = diff; continue; }
    if (!alt) {
      zeile.art = 'neu';
      zeile.felder = Object.entries(felder).filter(([x]) => x !== 'name').flatMap(([x, w]): ImportFeld[] => {
        if (x === 'angebot' && w) return Object.entries(w as Record<string, string>).map(([s, t]) => ({ feld: `angebot.${s}`, label: FELD_LABEL[`angebot.${s}`] ?? s, alt: '—', neu: wertText(`angebot.${s}`, t, nameVonId, k.register) }));
        if ((x === 'vertrag' || x === 'regeln' || x === 'ziel') && w) return Object.entries(w as Record<string, unknown>).map(([s, t]) => ({ feld: `${x}.${s}`, label: FELD_LABEL[`${x}.${s}`] ?? s, alt: '—', neu: wertText(`${x}.${s}`, t, nameVonId, k.register) }));
        return [{ feld: x, label: FELD_LABEL[x] ?? x, alt: '—', neu: wertText(x, w, nameVonId, k.register) }];
      });
      if (zeile.ablauf?.stand === 'neu') zeile.felder.push({ feld: 'ablauf', label: FELD_LABEL.ablauf, alt: '—', neu: zeile.ablauf.name });
      if (zeile.stufe?.stand === 'verknuepfen') zeile.felder.push({ feld: 'stufe', label: FELD_LABEL.stufe, alt: '—', neu: `verknüpft Stufe „${zeile.stufe.name}“` });
      const eintrag: Record<string, unknown> = { id: v.id, stufe: 'kern', lieferumfang: [], ...Object.fromEntries(Object.entries(felder).filter(([, w]) => w !== null && w !== undefined)) };
      plan.ops.push({ liste: 'leistungen', op: 'upsert', eintrag });
      continue;
    }
    zeile.felder = diff;
    if (!diff.length) { zeile.art = 'gleich'; continue; }
    zeile.art = 'aendert';
    if (Object.keys(felder).length) plan.ops.push({ liste: 'leistungen', op: 'teil', id: alt.id, felder });
  }

  for (const z of plan.zeilen) plan.zahlen[z.art]++;
  if (plan.zahlen.fehler || plan.fehler.length) {
    plan.status = grenze.length ? 413 : 400;
    plan.ops = []; plan.zuordnungen = []; plan.stufen = [];
  }
  return plan;
}

/** Gesellschaft aus Kennung oder Name — null, wenn unbekannt. Register-Kennungen nur, wenn das Register sie kennt (sofern übergeben). */
export function gesellschaftAus(r: string, register?: ImportKontext['register']): Gesellschaft | null {
  if (!r) return null;
  if (r === 'offen' || wort(r) === 'offen') return 'offen';
  if (istRegisterKennung(r)) return !register || register.some(g => g.id === r) ? r as Gesellschaft : null;
  const kern = KERN_EINHEITEN.find(e => e.id === r)?.id ?? gesellschaftAusEinheit(r);
  if (kern) return kern;
  const reg = (register ?? []).filter(g => istRegisterKennung(g.id) && nameSchluessel(g.name) === nameSchluessel(r));
  return reg.length === 1 ? reg[0].id as Gesellschaft : null;
}

/** Preis-Teile aus dem Import — Beträge in Euro oder Cent, Synonyme, Kurzformen; Kennungen vom alten Teil an derselben Stelle (stabil). */
function preiseAus(w: unknown, alt: readonly PreisTeil[], f: PruefFehler[]): unknown {
  if (!Array.isArray(w)) { f.push(fehler400('Preis-Teile: eine Liste.')); return undefined; }
  if (w.length > G.preise) { f.push(fehler413(`Höchstens ${G.preise} Preis-Teile je Produkt.`)); return undefined; }
  const vergeben = new Set<string>();
  const roh = w.map((t, i) => {
    const nr = i + 1;
    if (!istObj(t)) { f.push(fehler400(`Preis-Teil ${nr}: ein Objekt mit „art“.`)); return null; }
    const fremd = Object.keys(t).filter(x => !PREIS_TEIL_FELDER.includes(x));
    if (fremd.length) f.push(fehler400(`Preis-Teil ${nr}: unbekannte Felder ${fremd.map(x => `„${kurz(x, 30)}“`).join(', ')}.`));
    const art = preisArtAus(t.art);
    if (!art) { f.push(fehler400(`Preis-Teil ${nr}: unbekannte Preis-Form „${kurz(String(t.art ?? ''), 30)}“ (kostenlos, fest, monatlich, jaehrlich, je_einheit, tagessatz, stundensatz, erfolg).`)); return null; }
    const cent = (euro: unknown, c: unknown, name: string): number | undefined => {
      if (c !== undefined && c !== null) { if (typeof c !== 'number' || !Number.isInteger(c)) { f.push(fehler400(`Preis-Teil ${nr}: ${name} in Cent als ganze Zahl.`)); return undefined; } return c; }
      if (euro === undefined || euro === null || euro === '') return undefined;
      const e = euroAus(euro);
      if (!Number.isFinite(e)) { f.push(fehler400(`Preis-Teil ${nr}: ${name} „${kurz(String(euro), 30)}“ ist keine Zahl.`)); return undefined; }
      return inCent(e);
    };
    const betragCent = cent(t.betrag, t.betragCent, 'Betrag');
    const bisCent = cent(t.bis, t.bisCent, '„bis“');
    const ap = t.anzahlungProzent ?? (istObj(t.zahlplan) ? t.zahlplan.anzahlungProzent : undefined);
    const apZahl = ap === undefined || ap === null || ap === '' ? undefined : zahlAus(ap);
    const std = t.stundenJeMonat ?? (istObj(t.deckel) ? t.deckel.stundenJeMonat : undefined);
    const stdZahl = std === undefined || std === null || std === '' ? undefined : zahlAus(std);
    let id = typeof t.id === 'string' ? t.id : alt[i]?.id;
    if (!id || vergeben.has(id)) { let n = i + 1; id = `pt-${n}`; while (vergeben.has(id) || alt.some((x, j) => j !== i && x.id === id)) id = `pt-${++n}`; }
    vergeben.add(id);
    const einheit = typeof t.einheit === 'string' ? text(t.einheit) : art.einheit;
    if (t.rolle !== undefined && t.rolle !== 'grund' && t.rolle !== 'option') f.push(fehler400(`Preis-Teil ${nr}: Rolle „grund“ oder „option“.`));
    return {
      id, art: art.art,
      ...(betragCent !== undefined ? { betragCent } : {}), ...(bisCent !== undefined ? { bisCent } : {}),
      ...(einheit ? { einheit } : {}),
      rolle: t.rolle === 'option' || t.optional === true ? 'option' : 'grund',
      ...(apZahl !== undefined ? { zahlplan: { anzahlungProzent: apZahl } } : {}),
      ...(typeof t.kontingent === 'string' && text(t.kontingent) ? { kontingent: text(t.kontingent) } : {}),
      ...(stdZahl !== undefined ? { deckel: { stundenJeMonat: stdZahl } } : {}),
      ...(typeof t.text === 'string' && text(t.text) ? { text: text(t.text) } : {}),
    };
  });
  return roh.every(Boolean) ? roh : undefined;
}

/** Vertrag: Unterfelder zusammenführen (geliefert gewinnt, `null` leert), Synonyme für danach/Rechnung/Reisekosten. */
function vertragAus(w: unknown, alt: ProduktVertrag | undefined, f: PruefFehler[]): unknown {
  if (!istObj(w)) { f.push(fehler400('Vertrag: ein Objekt.')); return undefined; }
  const fremd = Object.keys(w).filter(x => !(VERTRAG_FELDER as readonly string[]).includes(x));
  if (fremd.length) f.push(fehler400(`Vertrag: unbekannte Felder ${fremd.map(x => `„${kurz(x, 30)}“`).join(', ')} — erlaubt: ${VERTRAG_FELDER.join(', ')}.`));
  const out: Record<string, unknown> = { ...(alt ?? {}) };
  for (const s of VERTRAG_FELDER) {
    if (w[s] === undefined) continue;
    if (w[s] === null || w[s] === '') { delete out[s]; continue; }
    if (s === 'danach') { const x = aus(w[s], DANACH_WORTE); if (!x) f.push(fehler400(`Danach: ${VERTRAG_DANACH.join(', ')}.`)); else out[s] = x; continue; }
    if (s === 'rechnungsrhythmus') { const x = aus(w[s], RHYTHMUS_WORTE); if (!x) f.push(fehler400(`Rechnung: ${RECHNUNGS_RHYTHMEN.join(', ')}.`)); else out[s] = x; continue; }
    if (s === 'reisekosten') { const x = aus(w[s], REISE_WORTE); if (!x) f.push(fehler400('Reisekosten: separat oder inklusive.')); else out[s] = x; continue; }
    const n = zahlAus(w[s]);
    if (!Number.isFinite(n)) f.push(fehler400(`${FELD_LABEL[`vertrag.${s}`] ?? s}: eine Zahl.`)); else out[s] = n;
  }
  return out;
}

/** Regeln: Anrechnung und Inklusive über Produkt-Namen (aufgelöst), Unterfelder zusammengeführt. */
function regelnAus(w: unknown, alt: ProduktRegeln | undefined, f: PruefFehler[], aufloesen: (r: unknown, wo: string, f: PruefFehler[]) => string | null): unknown {
  if (!istObj(w)) { f.push(fehler400('Regeln: ein Objekt mit anrechnung, maxGleichzeitig, inklusive.')); return undefined; }
  const fremd = Object.keys(w).filter(x => !['anrechnung', 'maxGleichzeitig', 'inklusive'].includes(x));
  if (fremd.length) f.push(fehler400(`Regeln: unbekannte Felder ${fremd.map(x => `„${kurz(x, 30)}“`).join(', ')}.`));
  const out: Record<string, unknown> = { ...(alt ?? {}) };
  if (w.anrechnung !== undefined) {
    if (w.anrechnung === null) delete out.anrechnung;
    else if (!istObj(w.anrechnung) || !Array.isArray(w.anrechnung.auf)) f.push(fehler400('Anrechnung: { auf: [Produktnamen], anteilProzent } (Vorgabe 100 %).'));
    else {
      const auf = w.anrechnung.auf.map(x => aufloesen(x, 'Anrechnung', f)).filter((x): x is string => !!x);
      const ap = w.anrechnung.anteilProzent === undefined || w.anrechnung.anteilProzent === null || w.anrechnung.anteilProzent === '' ? 100 : zahlAus(w.anrechnung.anteilProzent);
      if (!Number.isFinite(ap)) f.push(fehler400('Anrechnung: Anteil in Prozent (1–100).'));
      out.anrechnung = { auf: Array.from(new Set(auf)), anteilProzent: ap };
    }
  }
  if (w.maxGleichzeitig !== undefined) {
    if (w.maxGleichzeitig === null || w.maxGleichzeitig === '') delete out.maxGleichzeitig;
    else { const n = zahlAus(w.maxGleichzeitig); if (!Number.isFinite(n)) f.push(fehler400('Höchstens gleichzeitig: eine Zahl.')); else out.maxGleichzeitig = n; }
  }
  if (w.inklusive !== undefined) {
    if (w.inklusive === null) delete out.inklusive;
    else if (!Array.isArray(w.inklusive)) f.push(fehler400('Inklusive: eine Liste { produkt, menge, je }.'));
    else out.inklusive = w.inklusive.flatMap(x => {
      if (!istObj(x)) { f.push(fehler400('Inklusive: { produkt, menge, je }.')); return []; }
      const id = aufloesen(x.produkt, 'Inklusive', f);
      const menge = x.menge === undefined || x.menge === null || x.menge === '' ? 1 : zahlAus(x.menge);
      const je = aus(x.je, JE_WORTE);
      if (!Number.isFinite(menge)) f.push(fehler400('Inklusive: Menge als Zahl.'));
      if (!je) f.push(fehler400(`Inklusive: je ${INKLUSIVE_JE.join(', ')}.`));
      return id && je ? [{ leistungId: id, menge, je }] : [];
    });
  }
  return out;
}

/** Ziel: Umsatz (Euro) und Kunden (Anzahl), zusammengeführt. */
function zielAus(w: unknown, alt: Leistung['ziel'] | undefined, f: PruefFehler[]): unknown {
  if (!istObj(w)) { f.push(fehler400('Ziel: { umsatz, kunden }.')); return undefined; }
  const out: Record<string, unknown> = { ...(alt ?? {}) };
  if (w.umsatz !== undefined) { if (w.umsatz === null || w.umsatz === '') delete out.umsatz; else { const e = euroAus(w.umsatz); if (!Number.isFinite(e)) f.push(fehler400('Umsatzziel: Euro als Zahl.')); else out.umsatz = e; } }
  if (w.kunden !== undefined) { if (w.kunden === null || w.kunden === '') delete out.kunden; else { const n = zahlAus(w.kunden); if (!Number.isFinite(n)) f.push(fehler400('Kundenziel: eine Zahl.')); else out.kunden = n; } }
  return out;
}

// ── Aus einer Tabelle (CSV) ──────────────────────────────────────────────────

export interface TabellenErgebnis { produkte: ProduktImport[]; fehler: string[]; hinweise: string[] }

type SpaltenZiel =
  | { ebene: 'produkt'; feld: string; art: 'text' | 'liste' | 'zahl' }
  | { ebene: 'vertrag'; feld: keyof ProduktVertrag }
  | { ebene: 'ziel'; feld: 'umsatz' | 'kunden' }
  | { ebene: 'regel'; feld: 'anrechnungAuf' | 'anrechnungProzent' | 'maxGleichzeitig' | 'inklusive' }
  | { ebene: 'angebot'; feld: 'titel' | 'einleitung' | 'hinweise' }
  | { ebene: 'preis'; feld: 'art' | 'betrag' | 'bis' | 'einheit' | 'optional' | 'anzahlung' | 'kontingent' | 'deckel' | 'text' };
const P = (feld: string, art: 'text' | 'liste' | 'zahl' = 'text'): SpaltenZiel => ({ ebene: 'produkt', feld, art });
/** Spaltennamen (klein, ohne Leer-/Sonderzeichen, Umlaute ausgeschrieben) → Ziel. */
const SPALTEN: Record<string, SpaltenZiel> = {
  name: P('name'), produkt: P('name'), produktname: P('name'),
  status: P('status'), gesellschaft: P('gesellschaft'), firma: P('gesellschaft'), typ: P('typ'), linie: P('linie'), produktlinie: P('linie'),
  stufe: P('ebene', 'zahl'), ebene: P('ebene', 'zahl'), treppe: P('ebene', 'zahl'), treppenstufe: P('ebene', 'zahl'),
  rolle: P('rolle'), kurzbeschreibung: P('beschreibung'), beschreibung: P('beschreibung'), leistungstext: P('leistungstext'),
  ergebnis: P('ergebnis'), grenzen: P('grenzen'), lieferumfang: P('lieferumfang', 'liste'), aufgabe: P('aufgabe'), kennzahl: P('kennzahl'),
  dauer: P('dauerTage', 'zahl'), dauertage: P('dauerTage', 'zahl'), aufwand: P('aufwandStundenWoche', 'zahl'), aufwandstundenwoche: P('aufwandStundenWoche', 'zahl'),
  aufwandstdwoche: P('aufwandStundenWoche', 'zahl'), ablauf: P('ablauf'), ablaufvorlage: P('ablauf'), fulfillment: P('ablauf'),
  angebotstitel: { ebene: 'angebot', feld: 'titel' }, titelimangebot: { ebene: 'angebot', feld: 'titel' }, einleitung: { ebene: 'angebot', feld: 'einleitung' },
  hinweise: { ebene: 'angebot', feld: 'hinweise' },
  mindestlaufzeit: { ebene: 'vertrag', feld: 'mindestlaufzeitMonate' }, mindestlaufzeitmonate: { ebene: 'vertrag', feld: 'mindestlaufzeitMonate' }, laufzeit: { ebene: 'vertrag', feld: 'mindestlaufzeitMonate' },
  danach: { ebene: 'vertrag', feld: 'danach' }, kuendigungsfrist: { ebene: 'vertrag', feld: 'kuendigungsfristTage' }, kuendigungsfristtage: { ebene: 'vertrag', feld: 'kuendigungsfristTage' },
  rechnung: { ebene: 'vertrag', feld: 'rechnungsrhythmus' }, rechnungsrhythmus: { ebene: 'vertrag', feld: 'rechnungsrhythmus' }, abrechnung: { ebene: 'vertrag', feld: 'rechnungsrhythmus' },
  zahlungsziel: { ebene: 'vertrag', feld: 'zahlungszielTage' }, zahlungszieltage: { ebene: 'vertrag', feld: 'zahlungszielTage' },
  ust: { ebene: 'vertrag', feld: 'ustSatz' }, ustsatz: { ebene: 'vertrag', feld: 'ustSatz' }, mwst: { ebene: 'vertrag', feld: 'ustSatz' }, reisekosten: { ebene: 'vertrag', feld: 'reisekosten' },
  anrechnungauf: { ebene: 'regel', feld: 'anrechnungAuf' }, angerechnetauf: { ebene: 'regel', feld: 'anrechnungAuf' }, anrechnung: { ebene: 'regel', feld: 'anrechnungAuf' },
  anrechnungprozent: { ebene: 'regel', feld: 'anrechnungProzent' }, anrechnunganteil: { ebene: 'regel', feld: 'anrechnungProzent' },
  maxgleichzeitig: { ebene: 'regel', feld: 'maxGleichzeitig' }, hoechstensgleichzeitig: { ebene: 'regel', feld: 'maxGleichzeitig' }, maximalgleichzeitig: { ebene: 'regel', feld: 'maxGleichzeitig' },
  inklusive: { ebene: 'regel', feld: 'inklusive' }, enthalten: { ebene: 'regel', feld: 'inklusive' },
  zielumsatz: { ebene: 'ziel', feld: 'umsatz' }, umsatzziel: { ebene: 'ziel', feld: 'umsatz' }, zielkunden: { ebene: 'ziel', feld: 'kunden' }, kundenziel: { ebene: 'ziel', feld: 'kunden' },
  preisart: { ebene: 'preis', feld: 'art' }, preisform: { ebene: 'preis', feld: 'art' }, art: { ebene: 'preis', feld: 'art' },
  betrag: { ebene: 'preis', feld: 'betrag' }, preis: { ebene: 'preis', feld: 'betrag' }, betrageuro: { ebene: 'preis', feld: 'betrag' }, preiseuro: { ebene: 'preis', feld: 'betrag' }, netto: { ebene: 'preis', feld: 'betrag' },
  bis: { ebene: 'preis', feld: 'bis' }, betragbis: { ebene: 'preis', feld: 'bis' }, biseuro: { ebene: 'preis', feld: 'bis' },
  einheit: { ebene: 'preis', feld: 'einheit' }, je: { ebene: 'preis', feld: 'einheit' },
  optional: { ebene: 'preis', feld: 'optional' }, option: { ebene: 'preis', feld: 'optional' },
  anzahlung: { ebene: 'preis', feld: 'anzahlung' }, anzahlungprozent: { ebene: 'preis', feld: 'anzahlung' }, zahlplan: { ebene: 'preis', feld: 'anzahlung' },
  kontingent: { ebene: 'preis', feld: 'kontingent' }, deckel: { ebene: 'preis', feld: 'deckel' }, stundenjemonat: { ebene: 'preis', feld: 'deckel' }, deckelstundenjemonat: { ebene: 'preis', feld: 'deckel' },
  preistext: { ebene: 'preis', feld: 'text' }, preishinweis: { ebene: 'preis', feld: 'text' },
};
/** Listen in einer Zelle: „|“, Zeilenumbruch oder „•“ (linear geteilt, kein Rückverfolgen über lange Zellen). */
const liste = (w: string) => w.split(/[|\n•]/).map(x => x.trim()).filter(Boolean);
/** Längste Zelle, die gelesen wird — länger ist kein Produkttext (Leistungstext höchstens 6.000 Zeichen). */
const ZELLE_MAX = 10_000;
const ja = (v: string) => ['ja', 'j', 'x', 'true', '1', 'optional', 'option', 'yes'].includes(wort(v));

/** Trennzeichen der Tabelle aus der Kopfzeile: Tab, Semikolon oder Komma (was häufiger vorkommt). */
function trennerAus(csv: string): string {
  const kopf = csv.split('\n', 1)[0] ?? '';
  const n = (z: string) => kopf.split(z).length - 1;
  const t = n('\t'), s = n(';'), k = n(',');
  return t > s && t > k ? '\t' : s >= k ? ';' : ',';
}

/**
 * Eine Tabelle (CSV, Excel-Export, aus der Zwischenablage) in `ProduktImport[]` — eine Zeile je Produkt; mehrere Zeilen mit demselben Namen
 * sind EIN Produkt mit mehreren Preis-Teilen (Produktfelder aus der ersten gefüllten Zelle, widersprüchliche Werte → Fehler). Listen
 * (Lieferumfang, Anrechnung auf, Inklusive) mit „|“ oder Zeilenumbruch getrennt; Inklusive als „1 × Produkt je Quartal“.
 */
export function importAusTabelle(csv: string): TabellenErgebnis {
  const out: TabellenErgebnis = { produkte: [], fehler: [], hinweise: [] };
  const befund = csvLesenMitBefund(String(csv ?? ''), trennerAus(String(csv ?? '')));
  const ziele = befund.kopf.map(k => (k ? SPALTEN[wort(k)] : undefined));
  befund.kopf.forEach((k, i) => { if (k && !ziele[i]) out.hinweise.push(`Spalte „${kurz(k, 40)}“ kenne ich nicht — ignoriert.`); });
  if (!ziele.some(z => z?.ebene === 'produkt' && z.feld === 'name')) { out.fehler.push('Die Spalte „Name“ fehlt — über sie werden die Produkte abgeglichen.'); return out; }
  const je = new Map<string, { p: Record<string, unknown>; zeile: number; quelle: Record<string, number> }>();
  befund.zeilen.forEach((z, i) => {
    const nr = befund.zeileNr[i];
    if (befund.spalten[i] > befund.kopf.length) out.fehler.push(`Zeile ${nr}: mehr Felder als Spalten (${befund.spalten[i]} statt ${befund.kopf.length}) — steht ein Trennzeichen ohne Anführungszeichen im Text?`);
    const zellen = befund.kopf.map(k => z[k] ?? '');
    const nameIdx = ziele.findIndex(x => x?.ebene === 'produkt' && x.feld === 'name');
    const name = (zellen[nameIdx] ?? '').trim();
    if (!name) { out.fehler.push(`Zeile ${nr}: der Name fehlt.`); return; }
    const s = nameSchluessel(name);
    const e = je.get(s) ?? { p: { name }, zeile: nr, quelle: {} };
    je.set(s, e);
    const setze = (pfad: string, wert: unknown, label: string) => {
      const [a, b] = pfad.split('.');
      const ziel = b ? ((e.p[a] ??= {}) as Record<string, unknown>) : e.p;
      const feld = b ?? a;
      if (ziel[feld] !== undefined && !gleich(ziel[feld], wert)) { out.fehler.push(`Zeile ${nr}: „${label}“ widerspricht Zeile ${e.quelle[pfad]} desselben Produkts.`); return; }
      ziel[feld] = wert; e.quelle[pfad] ??= nr;
    };
    const teil: Record<string, unknown> = {};
    zellen.forEach((roh, j) => {
      const ziel = ziele[j]; const w = roh.trim();
      if (!ziel || !w) return;
      const label = befund.kopf[j];
      if (w.length > ZELLE_MAX) { out.fehler.push(`Zeile ${nr}: „${kurz(label, 40)}“ ist zu lang (höchstens ${ZELLE_MAX.toLocaleString('de-DE')} Zeichen) — nichts gekürzt.`); return; }
      switch (ziel.ebene) {
        case 'produkt':
          if (ziel.feld === 'name') return;
          setze(ziel.feld, ziel.art === 'liste' ? liste(w) : w, label); return;
        case 'angebot': setze(`angebot.${ziel.feld}`, w, label); return;
        case 'vertrag': setze(`vertrag.${ziel.feld}`, w, label); return;
        case 'ziel': setze(`ziel.${ziel.feld}`, w, label); return;
        case 'regel':
          if (ziel.feld === 'anrechnungAuf') setze('regeln.anrechnungAuf', liste(w), label);
          else if (ziel.feld === 'anrechnungProzent') setze('regeln.anrechnungProzent', w, label);
          else if (ziel.feld === 'maxGleichzeitig') setze('regeln.maxGleichzeitig', w, label);
          else {
            const eintraege = liste(w).map(x => {
              const m = x.length > 300 ? null : x.match(/^(?:(\d+)\s*[x×]\s*)?(.+?)\s+(?:je|pro)\s+(\S+)$/i);
              if (!m) { out.fehler.push(`Zeile ${nr}: Inklusive „${kurz(x, 50)}“ — Form „1 × Produkt je Quartal“.`); return null; }
              return { produkt: m[2].trim(), menge: m[1] ? Number(m[1]) : 1, je: m[3] };
            }).filter(Boolean);
            setze('regeln.inklusive', eintraege, label);
          }
          return;
        case 'preis':
          if (ziel.feld === 'optional') teil.optional = ja(w);
          else if (ziel.feld === 'anzahlung') teil.anzahlungProzent = /^\s*(\d{1,2})\s*\/\s*\d{1,2}\s*$/.test(w) ? Number(w.split('/')[0]) : w;
          else if (ziel.feld === 'deckel') teil.stundenJeMonat = w;
          else teil[ziel.feld] = w;
          return;
      }
    });
    if (Object.keys(teil).length) {
      if (teil.art === undefined) out.fehler.push(`Zeile ${nr}: Preis-Angaben ohne „Preis-Art“ (kostenlos, fest, monatlich, jährlich, je Event, Tagessatz, Stundensatz, Erfolg).`);
      else ((e.p.preise ??= []) as unknown[]).push(teil);
    }
  });
  for (const { p } of Array.from(je.values())) {
    // Regeln aus den Spalten in die Form des Imports.
    const r = p.regeln as Record<string, unknown> | undefined;
    if (r) {
      const regeln: Record<string, unknown> = {};
      if (r.anrechnungAuf) regeln.anrechnung = { auf: r.anrechnungAuf, ...(r.anrechnungProzent !== undefined ? { anteilProzent: r.anrechnungProzent } : {}) };
      else if (r.anrechnungProzent !== undefined) out.fehler.push(`„${kurz(String(p.name), 60)}“: Anrechnung in Prozent ohne „Anrechnung auf“.`);
      if (r.maxGleichzeitig !== undefined) regeln.maxGleichzeitig = r.maxGleichzeitig;
      if (r.inklusive !== undefined) regeln.inklusive = r.inklusive;
      p.regeln = regeln;
    }
    out.produkte.push(p as unknown as ProduktImport);
  }
  if (!out.produkte.length && !out.fehler.length) out.fehler.push('Die Tabelle enthält keine Produkte.');
  return out;
}
