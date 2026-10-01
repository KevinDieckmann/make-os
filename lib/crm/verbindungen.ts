// ─── Markttraktion · Verbindungsprüfung (rein, getestet, 28.09.) ─────────────
// Kevin 28.09.: „Einmal nochmal alle Verbindungen im Hintergrund prüfen. Das muss
// einfach sauber funktionieren, die Daten müssen sauber laufen.“ Hier steht an
// EINER Stelle, welche Kennung auf welche zeigen darf — Personen, Firmen, Deals,
// Mandate, Rechnungen, Follow-ups, Events, Marketing, Aufgaben, Fokus-Blöcke,
// Dateiablage, Import-Konflikte. Jede neue Verknüpfung gehört hier mitgeprüft.
//
//   verbindungenPruefen(bestaende)                → Befunde (nur die mit Anzahl > 0)
//   verbindungenReparieren(bestaende, ids, …)     → nur sichere Fälle: tote Verweise
//                                                   entfernen, verwaiste Follow-ups absagen,
//                                                   veraltete Konflikte entfernen, fehlende
//                                                   Dateien markieren — nie ganze Datensätze löschen.
//
// Beispiele tragen NUR Kennungen (c-…, f-…, Deal-/Mandats-Kennungen) — nie Namen,
// nie Inhalte. Was nicht geladen wurde (z. B. `rechnungen: null`), wird nicht geprüft.
// Die Route ist app/api/crm/verbindungen, die Oberfläche Stammdaten › Datenqualität.
// 28.09. abends (Integritätsprüfung): dazu Firmentext ↔ Hauptstation, Typ ↔ Typen, Aktivität → Firma/Bezug,
// Deal-Quelle, Mandat → Planposten/Phase, doppelte Teilnahmen, Kampagnen-Ergebnisse außerhalb, Head-Vorschläge,
// Einwilligungs-Belege; Leads mit totem Deal fallen beim Reparieren von „SQL“ auf „Qualifizierung“ zurück.
// 28.09. spät (Aufgaben wie Monday/ClickUp): CRM-Bezug der Aufgaben (`bezug` → Kontakt, Firma, Mandat, Deal) —
// Reparieren entfernt nur die toten Einzelverweise; Aufgaben mit Space (`spaceId`) haben ihre Einheit aus dem Space.
// 28.09. („Mandat an Zielen und Zeit“): Ziele, Meilensteine und Fokus-Blöcke mit totem Mandat/Firma —
// die drei Prüfungen und ihre Reparatur liegen in lib/crm/verbindungen-planung.ts.
// 28.09. (C2): Dateien an Projekten/Aufgaben (eigener Bestand, selber Ordner) — tote Projekt-/Aufgaben-Verweise und
// fehlende Inhalte (lib/dateien/aufgaben-pruefung.ts); ihre .bin zählen nicht als „Datei ohne Eintrag“.

import { HERKUNFT, LEBENSPHASEN, type Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, CrmListe, Firma, FirmaRolle, FollowUp, SegmentKriterien, Teilnahme, TeilnahmeStatus } from './typen';
import { CRM_LISTEN } from './typen';
import { OFFENE_STUFEN } from './pipeline';
import { mandatZuFirma } from './firmen-bezug';
import { LIFECYCLE_PHASEN } from './lifecycle';
import { BEAN_IDS } from './bean';
import type { KonfliktStand } from './import-konflikte';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import type { FokusBlock } from '@/lib/zeitmessung/modell';
import { spaceVonAufgabe } from '@/lib/make-one/space-regeln';
import { istSpaceId } from '@/lib/aufgaben/struktur';
import type { AufgabeBezug } from '@/types/tasks';
import { einheitenListe } from '@/lib/planung/einheiten';
import { einheitName } from '@/lib/einheiten';
import { personenJeFirma, stationenBefund, firmenDerPerson, hauptStation, stationenVon } from './stationen';
import { firmenSchluessel } from './firmen';
import { einwilligungBelegTot } from '@/lib/dateien/einwilligung-beleg';
import { aufgabenDateienPruefen } from '@/lib/dateien/aufgaben-pruefung';
import { alleAdressen, emailsBefund } from './emails';
import { kreisFirmen } from './konzern';
import { typenVon, kategorienVon, labelsVon } from './mehrfach';
import { wertelistenVollstaendig, wertelistenPruefen, WERT_MIN, WERT_MAX } from './wertelisten';

import { tagVon } from '@/lib/zeit';
import { PRUEFUNGEN_PLANUNG, planungPruefen, planungReparieren, type PlanungBestand } from './verbindungen-planung';
import { PRUEFUNGEN_KALENDER, kalenderPruefen, kalenderReparieren, type KalenderPruefBestand, type KalenderLebend } from './verbindungen-kalender';
import { PRUEFUNGEN_BUCHUNG, buchungenPruefen, type BuchungenStand } from '@/lib/kalender/buchung-verbindungen';
import { PRUEFUNGEN_SPIEGEL, spiegelPruefen, type SpiegelStand } from '@/lib/kalender/spiegel-verbindungen';
import { PRUEFUNGEN_TERMINE, terminePruefen, termineReparieren, type TermineStand } from './verbindungen-termine';
import { PRUEFUNGEN_FAMILIE, familiePruefen, familieReparieren, type FamilieTageStand } from './verbindungen-familie';
import { elternOrdnen, AUFGABEN_EBENEN_MAX } from '@/lib/aufgaben/ebenen';
// ── Eingang ─────────────────────────────────────────────────────────────────

/** Eine Rechnung aus dem Finanzplan (Speicher „finanzplan“) — nur, was die Prüfung braucht. */
export interface RechnungKurz { id: string; firmaId?: string; mandatId?: string; status?: string; betrag?: number; bezahltAm?: string; datum?: string; faellig?: string }
/** Eine Aufgabe (Speicher „tasks“) — nur, was die Prüfung braucht. */
export interface AufgabeKurz {
  id: string; title: string; description?: string; projectId: string; status?: string; space?: 'privat' | 'business'; einheit?: string;
  /** Aufgaben-Space (28.09. abends) — ein gültiger gibt die Einheit vor (lib/aufgaben/struktur.ts `einheitFuer`). */
  spaceId?: string;
  /** CRM-Bezug (Kontakt, Firma, Mandat, Deal) — nur Kennungen. */
  bezug?: AufgabeBezug;
  /** Übergeordnete Aufgabe (mehrstufige Unteraufgaben, 01.10.) — für „verwaiste Eltern“, Kreise und zu tiefe Ketten. */
  parentId?: string;
}

export interface VerbindungsBestaende {
  heute: string;
  kontakte: Kontakt[];
  crm: CrmBestand;
  /** Finanzplan: Rechnungen und die Gesellschaften dort (firmaId der Rechnung). null = nicht geprüft. */
  finanzplan?: { rechnungen: RechnungKurz[]; firmen: string[] } | null;
  /** Aufgaben + Orte (Board › Ort) + eigene Einheiten des Haushalts. null = nicht geprüft. */
  aufgaben?: { liste: AufgabeKurz[]; orte: Record<string, string>; eigeneEinheiten: string[] } | null;
  /** Fokus-Blöcke je Person (Speicher `zeit`/`zeit--<person>`). null = nicht geprüft. */
  fokus?: { person: string; bloecke: FokusBlock[] }[] | null;
  /** Dateiablage des Haushalts: Metadaten + Kennungen der Dateien, die auf der Platte liegen. null = nicht geprüft. */
  dateien?: { eintraege: DateiEintrag[]; aufPlatte: string[] } | null;
  /**
   * Dateien an Projekten und Aufgaben (28.09., C2): eigener Bestand `aufgaben-dateien--<haushalt>` im selben Ordner wie
   * die CRM-Ablage (`dateien.aufPlatte`). `projekte` = Projekt-Kennungen im Aufgaben-Bestand. null = nicht geprüft.
   */
  aufgabenDateien?: { eintraege: DateiEintrag[]; projekte: string[] } | null;
  /** Offene Import-Konflikte (Speicher `crm-import-konflikte`). null = nicht geprüft. */
  konflikte?: KonfliktStand | null;
  /** Kennungen der Planposten im Liquiditätsplan (Speicher „liquiplan“, 28.09. abends). null = nicht geprüft. */
  liquiplan?: { posten: string[] } | null;
  /** Vorschläge der Heads — nur Kennung, Person, Status (28.09. abends). null = nicht geprüft. */
  heads?: { head: string; vorschlaege: { id: string; kontakt_id?: string | null; status?: string }[] }[] | null;
  /** Ziele und Meilensteine — nur Kennung und Mandats-/Firmen-Bezug (28.09.). null = nicht geprüft. */
  planung?: PlanungBestand | null;
  /** Kalender (29.09., K1): iCloud-UIDs, Holfenster, Einträge `kalender-bezug` — nur Kennungen. null = nicht geprüft. */
  kalender?: KalenderPruefBestand | null;
  /** Terminbuchungen (29.09., K4): nur Kennungen/Status, Seiten, UIDs des iCloud-Stands. null = nicht geprüft. */
  buchungen?: BuchungenStand | null;
  /** Spiegel im Kalender (29.09., K5): Familie des Inhabers (Dates, Gespräche) — nur Kennungen/UIDs. Events kommen aus `crm`. */
  familieSpiegel?: SpiegelStand['familie'];
  /** K6a (29.09.): lebende Termine im Holfenster (Schlüssel, Tag, Titel nur zum Vergleichen) + Buchung → Follow-up. null = nicht geprüft. */
  termine?: TermineStand | null;
  /** F2 N4: Familie des Inhabers — Kennungen der Menschen und Wichtigen Tage (Verweis `menschId`). null = nicht geprüft. */
  familieTage?: FamilieTageStand | null;
}

// ── Befunde ─────────────────────────────────────────────────────────────────

export type Schwere = 'fehler' | 'warnung' | 'hinweis';
export type VerbindungsBereich = 'kennungen' | 'kontakte' | 'firmen' | 'deals' | 'mandate' | 'rechnungen' | 'followup' | 'events' | 'marketing' | 'datenschutz' | 'aufgaben' | 'zeit' | 'planung' | 'dateien' | 'import' | 'angebote' | 'kalender';
/** Wofür die Beispiel-Kennungen stehen — die Oberfläche macht daraus Links. */
export type BeispielArt = 'kontakt' | 'firma' | 'deal' | 'mandat' | 'rechnung' | 'followup' | 'event' | 'kampagne' | 'beitrag' | 'newsletter' | 'segment' | 'antrag' | 'aufgabe' | 'datei' | 'kennung' | 'angebot' | 'produkt';

export interface VerbindungsBefund {
  id: string;
  schwere: Schwere;
  bereich: VerbindungsBereich;
  text: string;
  anzahl: number;
  /** Höchstens fünf Kennungen — nie Namen, nie Inhalte (bei Werten außerhalb der Wertelisten: „typ:Wert“). */
  beispiele: string[];
  reparierbar: boolean;
  /** Beschriftung des Reparieren-Knopfs (Standard „Reparieren“). */
  knopf?: string;
  art?: BeispielArt;
}

interface Pruefung { schwere: Schwere; bereich: VerbindungsBereich; reparierbar: boolean; art?: BeispielArt; text: (n: number) => string; /** Beschriftung des Reparieren-Knopfs, wenn nicht „Reparieren“. */ knopf?: string }
const e = (n: number, ein: string, mehr: string) => (n === 1 ? ein : mehr);

/** Alle Prüfungen mit Schwere, Bereich und Satz — die eine Liste, gegen die auch das Skript zählt. */
export const PRUEFUNGEN = {
  'doppelt-kennung': { schwere: 'fehler', bereich: 'kennungen', reparierbar: false, art: 'kennung', text: n => `${n} ${e(n, 'Kennung kommt', 'Kennungen kommen')} in derselben Liste mehrfach vor — Verweise darauf sind nicht eindeutig.` },
  'kontakt-email-doppelt': { schwere: 'warnung', bereich: 'kontakte', reparierbar: false, art: 'kontakt', text: n => `${n} ${e(n, 'Person teilt', 'Personen teilen')} sich eine E-Mail-Adresse mit einer anderen — in der Kartei unter „Dubletten“ prüfen.` },
  'kontakt-firma-tot': { schwere: 'fehler', bereich: 'kontakte', reparierbar: false, art: 'kontakt', text: n => `${n} ${e(n, 'Person zeigt', 'Personen zeigen')} auf eine Firma, die es nicht mehr gibt — „Firmen abgleichen“ verknüpft neu.` },
  'kontakt-station-firma-tot': { schwere: 'fehler', bereich: 'kontakte', reparierbar: false, art: 'kontakt', text: n => `${n} ${e(n, 'Person hat', 'Personen haben')} eine Station (Firma in der Beschäftigungshistorie), deren Firma es nicht mehr gibt.` },
  'kontakt-station-haupt': { schwere: 'fehler', bereich: 'kontakte', reparierbar: false, art: 'kontakt', text: n => `${n} ${e(n, 'Person hat', 'Personen haben')} nicht genau eine Hauptstation, oder die angezeigte Firma weicht von der Hauptstation ab — in der Kontaktseite unter „Stationen“ die Hauptstation wählen.` },
  'kontakt-email-haupt': { schwere: 'warnung', bereich: 'kontakte', reparierbar: false, art: 'kontakt', text: n => `${n} ${e(n, 'Person hat', 'Personen haben')} mehrere E-Mail-Adressen, aber nicht genau eine Haupt-Adresse (oder sie weicht von der angezeigten ab) — in der Kontaktseite die Haupt-Adresse wählen.` },
  'firma-mutter-tot': { schwere: 'fehler', bereich: 'firmen', reparierbar: true, art: 'firma', text: n => `${n} ${e(n, 'Firma zeigt', 'Firmen zeigen')} auf eine Mutterfirma, die es nicht mehr gibt — Reparieren entfernt den Verweis.` },
  'werte-ausserhalb-wertelisten': { schwere: 'hinweis', bereich: 'kontakte', reparierbar: true, art: 'kennung', knopf: 'In Werteliste aufnehmen', text: n => `${n} ${e(n, 'Wert', 'Werte')} außerhalb der Wertelisten (Typ, Kategorie, Label) — „In Werteliste aufnehmen“ legt sie dort an.` },
  'firma-mutter-zyklus': { schwere: 'fehler', bereich: 'firmen', reparierbar: false, art: 'firma', text: n => `${n} ${e(n, 'Firma liegt', 'Firmen liegen')} auf einem Kreis von Mutterfirmen (eine Firma wäre ihre eigene Mutter) — in der Firmenkarte eine Mutter lösen.` },
  'firma-ohne-personen': { schwere: 'hinweis', bereich: 'firmen', reparierbar: false, art: 'firma', text: n => `${n} ${e(n, 'Firma hat', 'Firmen haben')} keine Person in der Kartei.` },
  'kunde-ohne-mandat-person': { schwere: 'hinweis', bereich: 'kontakte', reparierbar: false, art: 'kontakt', text: n => `${n} ${e(n, 'Person ist', 'Personen sind')} als Kunde geführt, aber es gibt kein Mandat dazu — Mandat nachtragen (zählt bis dahin als Bestandskunde).` },
  'kunde-ohne-mandat-firma': { schwere: 'hinweis', bereich: 'firmen', reparierbar: false, art: 'firma', text: n => `${n} ${e(n, 'Firma ist', 'Firmen sind')} als Kunde geführt, aber es gibt kein Mandat dazu — Mandat nachtragen (zählt bis dahin als Bestandskunde).` },
  'firma-lead-deal-tot': { schwere: 'fehler', bereich: 'firmen', reparierbar: true, art: 'firma', text: n => `${n} ${e(n, 'Lead an einer Firma zeigt', 'Leads an Firmen zeigen')} auf einen Deal, den es nicht mehr gibt.` },
  'kontakt-lead-deal-tot': { schwere: 'fehler', bereich: 'kontakte', reparierbar: true, art: 'kontakt', text: n => `${n} ${e(n, 'Lead an einer Person zeigt', 'Leads an Personen zeigen')} auf einen Deal, den es nicht mehr gibt.` },
  'deal-kontakt-tot': { schwere: 'fehler', bereich: 'deals', reparierbar: true, art: 'deal', text: n => `${n} ${e(n, 'Deal nennt', 'Deals nennen')} Personen, die es nicht mehr gibt.` },
  'deal-firma-tot': { schwere: 'fehler', bereich: 'deals', reparierbar: false, art: 'deal', text: n => `${n} ${e(n, 'Deal zeigt', 'Deals zeigen')} auf eine Firma, die es nicht mehr gibt.` },
  'deal-rolle-tot': { schwere: 'fehler', bereich: 'deals', reparierbar: true, art: 'deal', text: n => `${n} ${e(n, 'Deal trägt', 'Deals tragen')} Rollen für Personen, die es nicht mehr gibt.` },
  'deal-rolle-ausserhalb': { schwere: 'warnung', bereich: 'deals', reparierbar: false, art: 'deal', text: n => `${n} ${e(n, 'Deal trägt', 'Deals tragen')} eine Rolle für eine Person, die nicht zum Deal gehört — Person aufnehmen oder Rolle entfernen.` },
  'deal-produkt-tot': { schwere: 'fehler', bereich: 'deals', reparierbar: false, art: 'deal', text: n => `${n} ${e(n, 'Deal zeigt', 'Deals zeigen')} auf ein Produkt, das es nicht mehr gibt.` },
  'deal-gewonnen-ohne-mandat': { schwere: 'hinweis', bereich: 'deals', reparierbar: false, art: 'deal', text: n => `${n} ${e(n, 'gewonnener Deal hat', 'gewonnene Deals haben')} noch kein Mandat.` },
  'deal-offen-doppelt': { schwere: 'warnung', bereich: 'deals', reparierbar: false, art: 'firma', text: n => `${n} ${e(n, 'Firma hat', 'Firmen haben')} zwei oder mehr offene Deals gleichzeitig.` },
  'mandat-deal-tot': { schwere: 'fehler', bereich: 'mandate', reparierbar: false, art: 'mandat', text: n => `${n} ${e(n, 'Mandat zeigt', 'Mandate zeigen')} auf einen Deal, den es nicht mehr gibt.` },
  'mandat-firma-tot': { schwere: 'fehler', bereich: 'mandate', reparierbar: false, art: 'mandat', text: n => `${n} ${e(n, 'Mandat zeigt', 'Mandate zeigen')} auf eine Firma, die es nicht mehr gibt.` },
  'mandat-kontakt-tot': { schwere: 'fehler', bereich: 'mandate', reparierbar: true, art: 'mandat', text: n => `${n} ${e(n, 'Mandat nennt', 'Mandate nennen')} Personen, die es nicht mehr gibt.` },
  'mandat-produkt-tot': { schwere: 'fehler', bereich: 'mandate', reparierbar: false, art: 'mandat', text: n => `${n} ${e(n, 'Mandat zeigt', 'Mandate zeigen')} auf ein Produkt, das es nicht mehr gibt.` },
  'mandat-ohne-rechnung': { schwere: 'hinweis', bereich: 'mandate', reparierbar: false, art: 'mandat', text: n => `${n} ${e(n, 'aktives Mandat hat', 'aktive Mandate haben')} keine Rechnung in den letzten 60 Tagen (Quartal: 120) — oder die Rechnung ist nicht mit dem Mandat verknüpft.` },
  'rechnung-mandat-tot': { schwere: 'fehler', bereich: 'rechnungen', reparierbar: false, art: 'rechnung', text: n => `${n} ${e(n, 'Rechnung zeigt', 'Rechnungen zeigen')} auf ein Mandat, das es nicht mehr gibt.` },
  'rechnung-gesellschaft-tot': { schwere: 'fehler', bereich: 'rechnungen', reparierbar: false, art: 'rechnung', text: n => `${n} ${e(n, 'Rechnung gehört', 'Rechnungen gehören')} zu keiner Gesellschaft im Finanzplan.` },
  'rechnung-bezahlt-ohne-datum': { schwere: 'warnung', bereich: 'rechnungen', reparierbar: false, art: 'rechnung', text: n => `${n} ${e(n, 'Rechnung ist', 'Rechnungen sind')} bezahlt, aber ohne Eingangsdatum.` },
  'rechnung-betrag': { schwere: 'warnung', bereich: 'rechnungen', reparierbar: false, art: 'rechnung', text: n => `${n} ${e(n, 'Rechnung hat', 'Rechnungen haben')} keinen Betrag über 0 €.` },
  'followup-kontakt-tot': { schwere: 'fehler', bereich: 'followup', reparierbar: true, art: 'followup', text: n => `${n} ${e(n, 'offenes Follow-up gilt', 'offene Follow-ups gelten')} einer Person, die es nicht mehr gibt — Reparieren sagt sie mit Grund ab.` },
  'followup-bezug-tot': { schwere: 'fehler', bereich: 'followup', reparierbar: true, art: 'followup', text: n => `${n} ${e(n, 'offenes Follow-up hängt', 'offene Follow-ups hängen')} an einem Deal, Mandat, Event oder einer Firma, die es nicht mehr gibt — Reparieren sagt sie mit Grund ab.` },
  'followup-alt-tot': { schwere: 'hinweis', bereich: 'followup', reparierbar: false, art: 'followup', text: n => `${n} ${e(n, 'abgeschlossenes Follow-up zeigt', 'abgeschlossene Follow-ups zeigen')} auf etwas, das es nicht mehr gibt — bleibt als Verlauf stehen.` },
  'followup-erledigt-ohne-datum': { schwere: 'warnung', bereich: 'followup', reparierbar: false, art: 'followup', text: n => `${n} ${e(n, 'Follow-up ist', 'Follow-ups sind')} erledigt, aber ohne Datum.` },
  'teilnahme-event-tot': { schwere: 'fehler', bereich: 'events', reparierbar: false, art: 'kontakt', text: n => `${n} ${e(n, 'Person hat eine Teilnahme', 'Personen haben Teilnahmen')} an einem Event, das es nicht mehr gibt.` },
  'teilnahme-kontakt-tot': { schwere: 'fehler', bereich: 'events', reparierbar: false, art: 'event', text: n => `${n} ${e(n, 'Event führt', 'Events führen')} Teilnahmen von Personen, die es nicht mehr gibt.` },
  'segment-verweis-tot': { schwere: 'warnung', bereich: 'marketing', reparierbar: false, art: 'kennung', text: n => `${n} ${e(n, 'Segment', 'Segmente')}, auf die Events oder Kampagnen zeigen, gibt es nicht mehr.` },
  'segment-kriterien': { schwere: 'warnung', bereich: 'marketing', reparierbar: false, art: 'segment', text: n => `${n} ${e(n, 'Segment filtert', 'Segmente filtern')} mit Werten, die es nicht gibt (Temperatur, Lifecycle, BEAN, Kreis …) — das Kriterium trifft niemanden.` },
  'kampagne-kriterien': { schwere: 'warnung', bereich: 'marketing', reparierbar: false, art: 'kampagne', text: n => `${n} ${e(n, 'Kampagne filtert', 'Kampagnen filtern')} ihre Zielgruppe mit Werten, die es nicht gibt.` },
  'kampagne-kontakt-tot': { schwere: 'fehler', bereich: 'marketing', reparierbar: true, art: 'kampagne', text: n => `${n} ${e(n, 'Kampagne nennt', 'Kampagnen nennen')} Personen, die es nicht mehr gibt.` },
  'kampagne-ergebnis-tot': { schwere: 'warnung', bereich: 'marketing', reparierbar: false, art: 'kampagne', text: n => `${n} ${e(n, 'Kampagne zählt', 'Kampagnen zählen')} Ergebnisse von Personen, die es nicht mehr gibt.` },
  'beitrag-kontakt-tot': { schwere: 'fehler', bereich: 'marketing', reparierbar: true, art: 'beitrag', text: n => `${n} ${e(n, 'Beitrag nennt', 'Beiträge nennen')} als Quelle Personen, die es nicht mehr gibt.` },
  'beitrag-wirkung-tot': { schwere: 'warnung', bereich: 'marketing', reparierbar: false, art: 'beitrag', text: n => `${n} ${e(n, 'Beitrag zählt', 'Beiträge zählen')} Wirkung bei Personen, die es nicht mehr gibt.` },
  'newsletter-beitrag-tot': { schwere: 'warnung', bereich: 'marketing', reparierbar: false, art: 'newsletter', text: n => `${n} ${e(n, 'Newsletter-Ausgabe zeigt', 'Newsletter-Ausgaben zeigen')} auf Beiträge, die es nicht mehr gibt.` },
  'powerhour-kontakt-tot': { schwere: 'hinweis', bereich: 'followup', reparierbar: false, art: 'kennung', text: n => `${n} Power-${e(n, 'Hour nennt', 'Hours nennen')} Personen, die es nicht mehr gibt — bleibt als Verlauf stehen.` },
  'antrag-kontakt-tot': { schwere: 'warnung', bereich: 'datenschutz', reparierbar: true, art: 'antrag', text: n => `${n} ${e(n, 'Betroffenenantrag zeigt', 'Betroffenenanträge zeigen')} auf eine Person, die es nicht mehr gibt — der Vorgang bleibt, der Verweis geht.` },
  'werbesperre-kampagne': { schwere: 'fehler', bereich: 'datenschutz', reparierbar: true, art: 'kampagne', text: n => `${n} ${e(n, 'laufende Kampagne enthält', 'laufende Kampagnen enthalten')} Personen mit Werbesperre (Art. 21) — dort herausnehmen.` },
  'werbesperre-einladung': { schwere: 'fehler', bereich: 'datenschutz', reparierbar: false, art: 'event', text: n => `${n} ${e(n, 'kommendes Event hat', 'kommende Events haben')} Personen mit Werbesperre auf der Einladungsliste — dort herausnehmen.` },
  'einschraenkung-kampagne': { schwere: 'fehler', bereich: 'datenschutz', reparierbar: true, art: 'kampagne', text: n => `${n} ${e(n, 'laufende Kampagne enthält', 'laufende Kampagnen enthalten')} Personen mit eingeschränkter Verarbeitung (Art. 18) — Reparieren nimmt sie heraus.` },
  'einschraenkung-einladung': { schwere: 'fehler', bereich: 'datenschutz', reparierbar: false, art: 'event', text: n => `${n} ${e(n, 'kommendes Event hat', 'kommende Events haben')} Personen mit eingeschränkter Verarbeitung (Art. 18) auf der Einladungsliste — dort herausnehmen.` },
  'werbesperre-followup': { schwere: 'warnung', bereich: 'datenschutz', reparierbar: false, art: 'followup', text: n => `${n} ${e(n, 'offenes Follow-up geht', 'offene Follow-ups gehen')} an Personen mit Werbesperre — nur mit Vertrag oder ihrer Anfrage weiterverfolgen.` },
  'aufgabe-einheit-ungueltig': { schwere: 'warnung', bereich: 'aufgaben', reparierbar: false, art: 'aufgabe', text: n => `${n} ${e(n, 'Aufgabe trägt', 'Aufgaben tragen')} eine Einheit, die es in der Liste nicht gibt (oder liegen privat).` },
  'aufgabe-ohne-einheit': { schwere: 'hinweis', bereich: 'aufgaben', reparierbar: false, art: 'aufgabe', text: n => `${n} offene Business-${e(n, 'Aufgabe hat', 'Aufgaben haben')} keine Einheit.` },
  'aufgabe-bezug-tot': { schwere: 'fehler', bereich: 'aufgaben', reparierbar: true, art: 'aufgabe', text: n => `${n} ${e(n, 'Aufgabe zeigt', 'Aufgaben zeigen')} auf Kontakt, Firma, Mandat oder Deal, den es nicht mehr gibt — Reparieren entfernt den Verweis.` },
  'aufgabe-eltern-fehlt': { schwere: 'hinweis', bereich: 'aufgaben', reparierbar: false, art: 'aufgabe', text: n => `${n} ${e(n, 'Unteraufgabe zeigt', 'Unteraufgaben zeigen')} auf eine übergeordnete Aufgabe, die es nicht mehr gibt — sie ${e(n, 'steht', 'stehen')} als Hauptaufgabe da und ${e(n, 'wird', 'werden')} beim nächsten Speichern so abgelegt (nichts geht verloren).` },
  'aufgabe-ebene-ungueltig': { schwere: 'warnung', bereich: 'aufgaben', reparierbar: false, art: 'aufgabe', text: n => `${n} ${e(n, 'Aufgabe liegt', 'Aufgaben liegen')} in einem Kreis oder tiefer als ${AUFGABEN_EBENEN_MAX} Ebenen — die Anzeige ordnet sie (Kreis aufgebrochen bzw. eine Ebene höher), beim nächsten Speichern wird es so abgelegt.` },
  'aufgabe-verweis-tot': { schwere: 'hinweis', bereich: 'aufgaben', reparierbar: false, art: 'kennung', text: n => `${n} gelöschte ${e(n, 'Aufgabe wird', 'Aufgaben werden')} noch aus Follow-ups, Kampagnen oder Event-Checklisten genannt.` },
  'fokus-aufgabe-tot': { schwere: 'hinweis', bereich: 'zeit', reparierbar: false, art: 'kennung', text: n => `${n} gelöschte ${e(n, 'Aufgabe hängt', 'Aufgaben hängen')} noch an Fokus-Blöcken — die Zeit zählt mit der gespeicherten Einheit weiter.` },
  'datei-verweis-tot': { schwere: 'fehler', bereich: 'dateien', reparierbar: false, art: 'datei', text: n => `${n} ${e(n, 'Eintrag der Dateiablage zeigt', 'Einträge der Dateiablage zeigen')} auf Kontakt, Firma, Mandat, Deal oder Rechnung, die es nicht mehr gibt.` },
  'datei-fehlt': { schwere: 'fehler', bereich: 'dateien', reparierbar: true, art: 'datei', text: n => `${n} ${e(n, 'Eintrag der Dateiablage hat', 'Einträge der Dateiablage haben')} keine Datei mehr auf der Platte — Reparieren markiert sie.` },
  'datei-fehlt-markiert': { schwere: 'hinweis', bereich: 'dateien', reparierbar: false, art: 'datei', text: n => `${n} ${e(n, 'Eintrag ist', 'Einträge sind')} als „Datei fehlt“ markiert — neu hochladen oder den Eintrag entfernen.` },
  'aufgaben-datei-verweis-tot': { schwere: 'warnung', bereich: 'dateien', reparierbar: false, art: 'datei', text: n => `${n} ${e(n, 'Projekt-/Aufgaben-Datei zeigt', 'Projekt-/Aufgaben-Dateien zeigen')} auf ein Projekt oder eine Aufgabe, die es nicht mehr gibt — auf keiner Projektseite mehr zu sehen.` },
  'aufgaben-datei-fehlt': { schwere: 'fehler', bereich: 'dateien', reparierbar: false, art: 'datei', text: n => `${n} ${e(n, 'Projekt-/Aufgaben-Datei hat', 'Projekt-/Aufgaben-Dateien haben')} keinen Inhalt mehr auf der Platte — neu hochladen und den Eintrag entfernen.` },
  'datei-ohne-eintrag': { schwere: 'warnung', bereich: 'dateien', reparierbar: false, art: 'kennung', text: n => `${n} ${e(n, 'Datei liegt', 'Dateien liegen')} ohne Eintrag in der Ablage — niemand findet sie.` },
  // Angebote (28.09., Angebots-Tool)
  'angebot-verweis-tot': { schwere: 'fehler', bereich: 'angebote', reparierbar: false, art: 'angebot', text: n => `${n} ${e(n, 'Angebot zeigt', 'Angebote zeigen')} auf eine Person, Firma, einen Deal, ein Mandat oder eine Vorversion, die es nicht mehr gibt.` },
  'angebot-produkt-tot': { schwere: 'hinweis', bereich: 'angebote', reparierbar: false, art: 'angebot', text: n => `${n} ${e(n, 'Angebot hat eine Position', 'Angebote haben Positionen')} aus einem Produkt, das es nicht mehr gibt — Text und Preis stehen im Angebot, es bleibt lesbar.` },
  'angebot-ohne-pdf': { schwere: 'fehler', bereich: 'angebote', reparierbar: false, art: 'angebot', text: n => `${n} ${e(n, 'gestelltes Angebot hat', 'gestellte Angebote haben')} kein PDF (oder es fehlt in der Dateiablage).` },
  'produkt-ohne-angebotstext': { schwere: 'hinweis', bereich: 'angebote', reparierbar: false, art: 'produkt', text: n => `${n} ${e(n, 'aktives Produkt hat', 'aktive Produkte haben')} noch keinen Leistungstext — im Angebots-Tool als „Text fehlt“ markiert (Produkte & Mandate › Produkte).` },
  'konflikt-veraltet': { schwere: 'warnung', bereich: 'import', reparierbar: true, art: 'kennung', text: n => `Import-Konflikte gelten ${n} ${e(n, 'Person', 'Personen')}, die es nicht mehr gibt — Reparieren räumt sie ab.` },
  // Integritätsprüfung 28.09. abends: Verknüpfungen, die bis dahin niemand prüfte.
  'kontakt-firma-text-abweichend': { schwere: 'warnung', bereich: 'kontakte', reparierbar: true, art: 'kontakt', knopf: 'Firmennamen übernehmen', text: n => `${n} ${e(n, 'Person zeigt', 'Personen zeigen')} einen anderen Firmennamen als die Firma ihrer Hauptstation (Jobwechsel?) — „Firmennamen übernehmen“ setzt den Namen der Hauptstation; bei einem Jobwechsel stattdessen die Station wechseln.` },
  'kontakt-typ-abweichend': { schwere: 'hinweis', bereich: 'kontakte', reparierbar: true, art: 'kontakt', text: n => `${n} ${e(n, 'Person trägt', 'Personen tragen')} einen Typ, der nicht an erster Stelle der Typen steht (alter Schreiber) — Reparieren stellt ihn nach vorn, wie er angezeigt wird.` },
  'aktivitaet-firma-tot': { schwere: 'hinweis', bereich: 'kontakte', reparierbar: false, art: 'kontakt', text: n => `${n} ${e(n, 'Person hat Aktivitäten', 'Personen haben Aktivitäten')} bei einer Firma, die es nicht mehr gibt — bleibt als Verlauf stehen.` },
  'aktivitaet-bezug-tot': { schwere: 'hinweis', bereich: 'kontakte', reparierbar: false, art: 'kontakt', text: n => `${n} ${e(n, 'Person hat Aktivitäten', 'Personen haben Aktivitäten')} zu einem Deal, Mandat, Event oder einer Kampagne, die es nicht mehr gibt — bleibt als Verlauf stehen.` },
  'deal-quelle-bezug-tot': { schwere: 'warnung', bereich: 'deals', reparierbar: false, art: 'deal', text: n => `${n} ${e(n, 'Deal nennt', 'Deals nennen')} als Quelle ein Event, eine Kampagne oder einen Beitrag, die es nicht mehr gibt — in der Deal-Akte die Quelle neu wählen.` },
  'mandat-planposten-tot': { schwere: 'warnung', bereich: 'mandate', reparierbar: false, art: 'mandat', text: n => `${n} ${e(n, 'Mandat zeigt', 'Mandate zeigen')} auf einen Posten im Liquiditätsplan, den es nicht mehr gibt — im Mandat neu verknüpfen.` },
  'mandat-phase-ungueltig': { schwere: 'warnung', bereich: 'mandate', reparierbar: false, art: 'mandat', text: n => `${n} ${e(n, 'Mandat steht', 'Mandate stehen')} in einer Phase, die das Produkt nicht (mehr) hat — im Mandat die Phase neu wählen.` },
  'teilnahme-doppelt': { schwere: 'warnung', bereich: 'events', reparierbar: true, art: 'event', text: n => `${n} ${e(n, 'Event führt', 'Events führen')} dieselbe Person mehrfach als Gast — Reparieren führt die Teilnahmen zusammen (nichts geht verloren).` },
  'kampagne-ergebnis-ausserhalb': { schwere: 'hinweis', bereich: 'marketing', reparierbar: false, art: 'kampagne', text: n => `${n} ${e(n, 'Kampagne zählt', 'Kampagnen zählen')} Ergebnisse von Personen, die nicht (mehr) in der Kampagne sind.` },
  'head-vorschlag-kontakt-tot': { schwere: 'hinweis', bereich: 'kontakte', reparierbar: false, art: 'kennung', text: n => `${n} ${e(n, 'offener Vorschlag eines Heads nennt', 'offene Vorschläge der Heads nennen')} eine Person, die es nicht mehr gibt — in der Freigabe-Liste ablehnen.` },
  'einwilligung-beleg-tot': { schwere: 'fehler', bereich: 'datenschutz', reparierbar: false, art: 'kontakt', text: n => `${n} ${e(n, 'Person hat eine Einwilligung', 'Personen haben Einwilligungen')}, deren Beleg (Dateiablage) es nicht mehr gibt — Nachweis nach Art. 7 Abs. 1 DSGVO fehlt; Beleg neu ablegen.` },
  // Mandat an Zielen und Zeit (28.09.): ziel-/meilenstein-/zeit-mandat-tot — lib/crm/verbindungen-planung.ts.
  ...PRUEFUNGEN_PLANUNG,
  // Kalender (29.09., K1): termin-uid-tot, kalender-bezug-kennung-tot, termin-art-verloren, zeit-termin-tot — lib/crm/verbindungen-kalender.ts.
  ...PRUEFUNGEN_KALENDER,
  // Buchung ↔ Seite ↔ Kontakt ↔ Termin (29.09., K4): lib/kalender/buchung-verbindungen.ts.
  ...PRUEFUNGEN_BUCHUNG,
  // Spiegel Event/Familie ↔ iCloud-Termin (29.09., K5): lib/kalender/spiegel-verbindungen.ts.
  ...PRUEFUNGEN_SPIEGEL,
  // K6a (29.09.): Event gelöscht → Termin, Waisen (#100), Follow-ups am Termin — lib/crm/verbindungen-termine.ts.
  ...PRUEFUNGEN_TERMINE,
  // F2 N4 (29.09.): Wichtige Tage mit totem Menschen-Verweis — lib/crm/verbindungen-familie.ts.
  ...PRUEFUNGEN_FAMILIE,
} as const satisfies Record<string, Pruefung>;

export type PruefungId = keyof typeof PRUEFUNGEN;
export const PRUEFUNG_IDS = Object.keys(PRUEFUNGEN) as PruefungId[];
/** Befunde, die „Reparieren“ anfassen darf. */
export const REPARIERBAR: readonly PruefungId[] = PRUEFUNG_IDS.filter(id => PRUEFUNGEN[id].reparierbar);
export const istReparierbar = (id: unknown): id is PruefungId => typeof id === 'string' && (REPARIERBAR as readonly string[]).includes(id);

const BEISPIELE = 5;
const SCHWERE_RANG: Record<Schwere, number> = { fehler: 0, warnung: 1, hinweis: 2 };

// ── Hilfen ──────────────────────────────────────────────────────────────────
const tagPlus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const liste = <T>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);
const OFFEN_FU: readonly FollowUp['status'][] = ['offen', 'verpasst'];
const FIRMA_ROLLEN: readonly FirmaRolle[] = ['zielkunde', 'kunde', 'ex_kunde', 'partner', 'dienstleister', 'investor', 'netzwerk', 'wettbewerb', 'offen'];
const KREISE = ['A', 'B', 'C', 'D'];
const PRIOS = ['A', 'B', 'C'];
const KANAELE = ['mail', 'telefon', 'linkedin', 'newsletter', 'einladung'];
const TEMPERATUREN = ['kalt', 'lau', 'warm', 'heiss'];
const HERKUENFTE = HERKUNFT.map(h => h.id as string);

/** Die Mengen aller Kennungen — einmal gebaut, von jeder Prüfung gelesen. */
function mengen(b: VerbindungsBestaende) {
  const crm = b.crm;
  return {
    kontakte: new Set(liste(b.kontakte).map(k => k.id)),
    firmen: new Set(liste(crm.firmen).map(f => f.id)),
    chancen: new Set(liste(crm.chancen).map(c => c.id)),
    mandate: new Set(liste(crm.mandate).map(m => m.id)),
    leistungen: new Set(liste(crm.leistungen).map(l => l.id)),
    events: new Set(liste(crm.events).map(x => x.id)),
    segmente: new Set(liste(crm.segmente).map(s => s.id)),
    beitraege: new Set(liste(crm.beitraege).map(x => x.id)),
    angebote: new Set(liste(crm.angebote).map(x => x.id)),
  };
}
type Mengen = ReturnType<typeof mengen>;

/** Lebende Kennungen für die Kalender-Bezüge (Aufgaben nur, wenn geladen). */
const kalenderLebend = (b: VerbindungsBestaende, m: Mengen): KalenderLebend => ({
  kontaktId: m.kontakte, firmaId: m.firmen, mandatId: m.mandate, dealId: m.chancen, eventId: m.events,
  ...(b.aufgaben ? { aufgabeId: new Set(liste(b.aufgaben.liste).map(t => t.id)) } : {}),
});

const kontaktTot = (id: string | undefined, m: Mengen) => !!id && !m.kontakte.has(id);
/** Die Felder des Aufgaben-Bezugs, deren Kennung es nicht (mehr) gibt. */
function bezugTot(bz: AufgabeBezug | undefined, m: Mengen): (keyof AufgabeBezug)[] {
  if (!bz) return [];
  const tot: (keyof AufgabeBezug)[] = [];
  if (bz.kontaktId && !m.kontakte.has(bz.kontaktId)) tot.push('kontaktId');
  if (bz.firmaId && !m.firmen.has(bz.firmaId)) tot.push('firmaId');
  if (bz.mandatId && !m.mandate.has(bz.mandatId)) tot.push('mandatId');
  if (bz.dealId && !m.chancen.has(bz.dealId)) tot.push('dealId');
  return tot;
}
/** Die Rollen-Schlüssel eines Deals, deren Person es nicht gibt. */
const deadRollen = (r: Record<string, unknown> | undefined, m: Mengen) => Object.keys(r ?? {}).filter(id => !m.kontakte.has(id));
/** Hängt ein Follow-up an etwas, das es nicht gibt? Getrennt: Person vs. Bezug. */
function followupTot(f: FollowUp, m: Mengen): { kontakt: boolean; bezug: boolean } {
  const bz = f.bezug ?? { art: 'kontakt', id: '' };
  const kontakt = kontaktTot(f.kontaktId, m) || (bz.art === 'kontakt' && !m.kontakte.has(bz.id));
  const bezug = bz.art === 'firma' ? !m.firmen.has(bz.id) : bz.art === 'chance' ? !m.chancen.has(bz.id) : bz.art === 'mandat' ? !m.mandate.has(bz.id) : bz.art === 'event' ? !m.events.has(bz.id) : false;
  return { kontakt, bezug };
}

/** Die Firma der Hauptstation (gespeichert oder aus dem Altbestand abgeleitet) — nur, wenn es sie gibt. */
function hauptFirma(k: Kontakt, firmen: Map<string, Firma>): Firma | undefined {
  const h = hauptStation(stationenVon(k));
  return h ? firmen.get(h.firmaId) : undefined;
}
/** Weicht der Firmentext von der Firma der Hauptstation ab (Rechtsform, Schreibweise egal; W4 28.09.)? */
const firmaTextAbweichend = (k: Kontakt, firmen: Map<string, Firma>) => { const f = hauptFirma(k, firmen); return !!f && !!(k.firma ?? '').trim() && firmenSchluessel(k.firma ?? '') !== firmenSchluessel(f.name); };
const klein = (t: string | undefined) => (t ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
/** `typ` ≠ `typen[0]` — ein alter Schreiber hat nur den Einzelwert gesetzt (gelesen wird er vorn, `typenVon`). */
const typAbweichend = (k: Kontakt) => Array.isArray(k.typen) && k.typen.length > 0 && !!klein(k.typ) && klein(k.typ) !== klein(k.typen[0]);
/** Doppelte Teilnahmen je Event+Person: Gruppen mit mehr als einer Teilnahme. */
function doppelteTeilnahmen(teilnahmen: Teilnahme[]): Teilnahme[][] {
  const je = new Map<string, Teilnahme[]>();
  for (const t of teilnahmen) { const s = `${t.eventId}|${t.kontaktId}`; je.set(s, [...(je.get(s) ?? []), t]); }
  return Array.from(je.values()).filter(g => g.length > 1);
}
/** Teilnahme-Status nach Aussagekraft — bei doppelten bleibt die „stärkste“. */
const TEILNAHME_RANG: Record<TeilnahmeStatus, number> = { da: 0, zugesagt: 1, no_show: 2, eingeladen: 3, vorgemerkt: 4, abgesagt: 5 };
/** Quellen eines Beitrags, die wie Personen-Kennungen aussehen, aber keine Person mehr haben (freie Quellen-Texte zählen nicht). */
const beitragQuellenTot = (q: string[] | undefined, m: Mengen) => liste(q).filter(x => /^c-[a-z0-9-]{4,60}$/.test(x) && !m.kontakte.has(x));

/** Kriterien mit Werten, die das Modell nicht kennt — trifft dann niemanden bzw. fällt beim nächsten Speichern weg. */
function kriterienUngueltig(k: SegmentKriterien | undefined): boolean {
  if (!k || typeof k !== 'object') return false;
  const aussen = (v: unknown, gut: readonly string[]) => Array.isArray(v) && v.some(x => !gut.includes(String(x)));
  return aussen(k.temperatur, TEMPERATUREN) || aussen(k.lifecycle, LIFECYCLE_PHASEN) || aussen(k.bean, BEAN_IDS)
    || aussen(k.lebensphase, LEBENSPHASEN) || aussen(k.kreis, KREISE) || aussen(k.prio, PRIOS) || aussen(k.firmaRolle, FIRMA_ROLLEN) || aussen(k.herkunft, HERKUENFTE)
    || (k.kanal !== undefined && !KANAELE.includes(String(k.kanal)));
}

/** Liegt die Rechnung im Fenster [heute − Tage, …]? Maßgeblich: gestellt, fällig oder bezahlt. */
const rechnungTag = (r: RechnungKurz) => r.datum ?? r.faellig ?? r.bezahltAm;

// ── Prüfen ──────────────────────────────────────────────────────────────────

/**
 * Alle Verbindungen prüfen — rein, ohne Platte. Liefert nur Befunde mit Anzahl > 0,
 * sortiert nach Schwere (Fehler zuerst), dann nach Anzahl.
 */
export function verbindungenPruefen(b: VerbindungsBestaende): VerbindungsBefund[] {
  const crm = b.crm;
  const m = mengen(b);
  const kontakte = liste(b.kontakte);
  const funde = new Map<PruefungId, string[]>();
  const melde = (id: PruefungId, kennung: string) => { const l = funde.get(id) ?? []; l.push(kennung); funde.set(id, l); };

  // Doppelte Kennungen je Liste (die Beispiele nennen die Liste: „chancen:ch-1“).
  const doppelt = (name: string, l: { id?: string }[]) => {
    const gesehen = new Set<string>(), gemeldet = new Set<string>();
    for (const x of l) { const id = String(x?.id ?? ''); if (!id) continue; if (gesehen.has(id) && !gemeldet.has(id)) { gemeldet.add(id); melde('doppelt-kennung', `${name}:${id}`); } gesehen.add(id); }
  };
  doppelt('kontakte', kontakte);
  for (const l of CRM_LISTEN) doppelt(l, liste(crm[l] as unknown as { id?: string }[]));
  if (b.finanzplan) doppelt('rechnungen', b.finanzplan.rechnungen);
  if (b.aufgaben) doppelt('aufgaben', b.aufgaben.liste);
  if (b.dateien) doppelt('dateien', b.dateien.eintraege);
  if (b.aufgabenDateien) doppelt('aufgaben-dateien', b.aufgabenDateien.eintraege);

  // Personen — alle Adressen (28.09., #11), Stationen und Haupt-Adresse (28.09.)
  const jeMail = new Map<string, string[]>();
  for (const k of kontakte) {
    for (const mail of alleAdressen(k)) jeMail.set(mail, Array.from(new Set([...(jeMail.get(mail) ?? []), k.id])));
    if (k.firmaId && !m.firmen.has(k.firmaId)) melde('kontakt-firma-tot', k.id);
    if (k.lead?.chanceId && !m.chancen.has(k.lead.chanceId)) melde('kontakt-lead-deal-tot', k.id);
    const st = stationenBefund(k, id => m.firmen.has(id));
    if (st.firmaTot) melde('kontakt-station-firma-tot', k.id);
    if (st.hauptFalsch) melde('kontakt-station-haupt', k.id);
    if (emailsBefund(k)) melde('kontakt-email-haupt', k.id);
  }
  for (const ids of Array.from(jeMail.values())) if (ids.length > 1) for (const id of ids) melde('kontakt-email-doppelt', id);

  // Firmen — Personen einer Firma nur über die Stationen (28.09.)
  const jeFirma = personenJeFirma(kontakte, { nurAktiv: true });
  const firmenNachId = new Map<string, Firma>(liste(crm.firmen).map(f => [f.id, f]));
  for (const f of liste(crm.firmen)) {
    if (!jeFirma.has(f.id)) melde('firma-ohne-personen', f.id);
    if (f.lead?.chanceId && !m.chancen.has(f.lead.chanceId)) melde('firma-lead-deal-tot', f.id);
    if (f.mutterId && !m.firmen.has(f.mutterId)) melde('firma-mutter-tot', f.id);
  }
  for (const id of kreisFirmen(liste(crm.firmen))) melde('firma-mutter-zyklus', id);

  // Typ, Kategorie, Label außerhalb der Wertelisten (Kevin 28.09.) — EIN Sammel-Hinweis, gezählt je Wert.
  for (const w of werteAusserhalb(kontakte, crm.wertelisten)) melde('werte-ausserhalb-wertelisten', `${w.feld}:${w.wert}`);

  // Kunde ohne Mandat (Kevin 28.09.: zählt in BEAN als Bestandskunde, bis das Mandat nachgetragen ist).
  const mandate = liste(crm.mandate);
  for (const k of kontakte) {
    if (k.lebensphase !== 'kunde') continue;
    const firmen = firmenDerPerson(k).map(id => firmenNachId.get(id)).filter((x): x is Firma => !!x);
    if (!mandate.some(x => liste(x.kontaktIds).includes(k.id) || firmen.some(f => mandatZuFirma(x, f)))) melde('kunde-ohne-mandat-person', k.id);
  }
  for (const f of liste(crm.firmen)) {
    if (f.rolle !== 'kunde') continue;
    const personen = new Set((jeFirma.get(f.id) ?? []).map(k => k.id));
    if (!mandate.some(x => mandatZuFirma(x, f) || liste(x.kontaktIds).some(id => personen.has(id)))) melde('kunde-ohne-mandat-firma', f.id);
  }

  // Deals
  const offeneJeFirma = new Map<string, number>();
  const mandatZuDeal = new Set(mandate.map(x => x.chanceId).filter((x): x is string => !!x));
  for (const c of liste(crm.chancen)) {
    const ids = liste(c.kontaktIds);
    if (ids.some(id => !m.kontakte.has(id))) melde('deal-kontakt-tot', c.id);
    if (c.firmaId && !m.firmen.has(c.firmaId)) melde('deal-firma-tot', c.id);
    if (deadRollen(c.personenRollen, m).length) melde('deal-rolle-tot', c.id);
    if (Object.keys(c.personenRollen ?? {}).some(id => m.kontakte.has(id) && !ids.includes(id))) melde('deal-rolle-ausserhalb', c.id);
    if (c.leistungId && !m.leistungen.has(c.leistungId)) melde('deal-produkt-tot', c.id);
    if (c.stufe === 'gewonnen' && !mandatZuDeal.has(c.id)) melde('deal-gewonnen-ohne-mandat', c.id);
    if (OFFENE_STUFEN.includes(c.stufe) && c.firmaId && m.firmen.has(c.firmaId)) offeneJeFirma.set(c.firmaId, (offeneJeFirma.get(c.firmaId) ?? 0) + 1);
  }
  for (const [fid, n] of Array.from(offeneJeFirma.entries())) if (n > 1) melde('deal-offen-doppelt', fid);

  // Mandate
  const rechnungen = b.finanzplan ? liste(b.finanzplan.rechnungen) : null;
  for (const x of mandate) {
    if (x.chanceId && !m.chancen.has(x.chanceId)) melde('mandat-deal-tot', x.id);
    if (x.firmaId && !m.firmen.has(x.firmaId)) melde('mandat-firma-tot', x.id);
    if (liste(x.kontaktIds).some(id => !m.kontakte.has(id))) melde('mandat-kontakt-tot', x.id);
    if (x.leistungId && !m.leistungen.has(x.leistungId)) melde('mandat-produkt-tot', x.id);
    if (rechnungen && x.status === 'aktiv' && x.rechnungsrhythmus !== 'einmalig') {
      const fenster = x.rechnungsrhythmus === 'quartal' ? 120 : 60;
      const ab = tagPlus(b.heute, -fenster);
      const laeuftLangGenug = !x.start || x.start <= ab;
      // Eine stornierte Rechnung (28.09., K3) zählt nicht als gestellt.
      if (laeuftLangGenug && !rechnungen.some(r => r.mandatId === x.id && r.status !== 'storniert' && (rechnungTag(r) ?? '') >= ab)) melde('mandat-ohne-rechnung', x.id);
    }
  }

  // Rechnungen
  if (rechnungen) {
    const gesellschaften = new Set(liste(b.finanzplan?.firmen));
    for (const r of rechnungen) {
      if (r.mandatId && !m.mandate.has(r.mandatId)) melde('rechnung-mandat-tot', r.id);
      if (r.firmaId && gesellschaften.size && !gesellschaften.has(r.firmaId)) melde('rechnung-gesellschaft-tot', r.id);
      if (r.status === 'bezahlt' && !r.bezahltAm) melde('rechnung-bezahlt-ohne-datum', r.id);
      if (!(typeof r.betrag === 'number' && Number.isFinite(r.betrag) && r.betrag > 0)) melde('rechnung-betrag', r.id);
    }
  }

  // Follow-ups
  const gesperrt = new Set(kontakte.filter(k => k.werbesperre).map(k => k.id));
  // Art. 18 (U2): eingeschränkte Personen dürfen in keiner laufenden Kampagne und auf keiner Einladungsliste stehen.
  const eingeschraenkt = new Set(kontakte.filter(k => k.eingeschraenkt).map(k => k.id));
  for (const f of liste(crm.followups)) {
    const tot = followupTot(f, m);
    const offen = OFFEN_FU.includes(f.status);
    if (offen && tot.kontakt) melde('followup-kontakt-tot', f.id);
    else if (offen && tot.bezug) melde('followup-bezug-tot', f.id);
    else if (!offen && (tot.kontakt || tot.bezug)) melde('followup-alt-tot', f.id);
    if (f.status === 'erledigt' && !f.erledigtAm) melde('followup-erledigt-ohne-datum', f.id);
    const an = f.kontaktId ?? (f.bezug?.art === 'kontakt' ? f.bezug.id : undefined);
    if (offen && an && gesperrt.has(an) && f.art !== 'sonstig') melde('werbesperre-followup', f.id);
  }

  // Events und Teilnahmen
  const eventNachId = new Map(liste(crm.events).map(x => [x.id, x]));
  for (const t of liste(crm.teilnahmen)) {
    if (!m.events.has(t.eventId)) melde('teilnahme-event-tot', t.kontaktId);
    if (!m.kontakte.has(t.kontaktId)) melde('teilnahme-kontakt-tot', t.eventId);
    const ev = eventNachId.get(t.eventId);
    const kommend = !!ev && (t.status === 'vorgemerkt' || t.status === 'eingeladen') && ev.datum >= b.heute && ev.status !== 'abgesagt' && ev.status !== 'durchgefuehrt';
    if (ev && kommend && gesperrt.has(t.kontaktId)) melde('werbesperre-einladung', ev.id);
    if (ev && kommend && eingeschraenkt.has(t.kontaktId)) melde('einschraenkung-einladung', ev.id);
  }
  for (const x of liste(crm.events)) if (x.segmentId && !m.segmente.has(x.segmentId)) melde('segment-verweis-tot', x.segmentId);

  // Marketing
  for (const s of liste(crm.segmente)) if (kriterienUngueltig(s.kriterien)) melde('segment-kriterien', s.id);
  for (const k of liste(crm.kampagnen)) {
    const ids = liste(k.kontaktIds);
    if (k.segmentId && !m.segmente.has(k.segmentId)) melde('segment-verweis-tot', k.segmentId);
    if (kriterienUngueltig(k.zielgruppe)) melde('kampagne-kriterien', k.id);
    if (ids.some(id => !m.kontakte.has(id))) melde('kampagne-kontakt-tot', k.id);
    if (liste(k.ergebnisse).some(r => !m.kontakte.has(r.kontaktId))) melde('kampagne-ergebnis-tot', k.id);
    if ((k.status === 'aktiv' || k.status === 'entwurf') && ids.some(id => gesperrt.has(id))) melde('werbesperre-kampagne', k.id);
    if ((k.status === 'aktiv' || k.status === 'entwurf') && ids.some(id => eingeschraenkt.has(id))) melde('einschraenkung-kampagne', k.id);
  }
  for (const x of liste(crm.beitraege)) {
    if (beitragQuellenTot(x.quellen, m).length) melde('beitrag-kontakt-tot', x.id);
    if (liste(x.wirkung).some(w => !m.kontakte.has(w.kontaktId))) melde('beitrag-wirkung-tot', x.id);
  }
  for (const n of liste(crm.newsletter)) if (liste(n.beitragIds).some(id => !m.beitraege.has(id))) melde('newsletter-beitrag-tot', n.id);
  for (const s of liste(crm.sitzungen)) for (const k of liste(s.karten)) if (k.kontaktId && !m.kontakte.has(k.kontaktId)) melde('powerhour-kontakt-tot', s.id);
  for (const a of liste(crm.antraege)) if (a.kontaktId && !m.kontakte.has(a.kontaktId)) melde('antrag-kontakt-tot', a.id);

  // Aufgaben
  if (b.aufgaben) {
    const aufgaben = liste(b.aufgaben.liste);
    const ids = new Set(aufgaben.map(t => t.id));
    const erlaubt = new Set(einheitenListe(b.aufgaben.eigeneEinheiten).map(x => x.toLocaleLowerCase('de-DE')));
    for (const t of aufgaben) {
      const business = spaceVonAufgabe(t, b.aufgaben.orte) === 'business';
      if (t.einheit) {
        const name = (einheitName(t.einheit) ?? '').toLocaleLowerCase('de-DE');
        if (!business || !erlaubt.has(name)) melde('aufgabe-einheit-ungueltig', t.id);
      } else if (business && t.status !== 'done' && !istSpaceId(t.spaceId)) melde('aufgabe-ohne-einheit', t.id); // mit Space: Einheit aus dem Space
      if (bezugTot(t.bezug, m).length) melde('aufgabe-bezug-tot', t.id);
    }
    // Ebenen (01.10.): verwaiste Eltern, Kreise, zu tiefe Ketten im gespeicherten Stand (`elternOrdnen` = dieselbe Regel wie die Übernahme).
    for (const [id] of Array.from(elternOrdnen(aufgaben).entries())) {
      const t = aufgaben.find(x => x.id === id);
      melde(t?.parentId && !ids.has(t.parentId) ? 'aufgabe-eltern-fehlt' : 'aufgabe-ebene-ungueltig', id);
    }
    const verweis = (aid: string | undefined) => { if (aid && !ids.has(aid)) melde('aufgabe-verweis-tot', aid); };
    for (const f of liste(crm.followups)) verweis(f.aufgabeId);
    for (const k of liste(crm.kampagnen)) for (const s of liste(k.schritte)) verweis(s.aufgabeId);
    for (const x of liste(crm.events)) for (const c of liste(x.checkliste)) verweis(c.aufgabeId);
    if (b.fokus) for (const p of b.fokus) for (const bl of liste(p.bloecke)) if (bl.aufgabeId && !ids.has(bl.aufgabeId)) melde('fokus-aufgabe-tot', bl.aufgabeId);
  }

  // Dateiablage
  if (b.dateien) {
    const platte = new Set(liste(b.dateien.aufPlatte));
    const eintraege = liste(b.dateien.eintraege);
    const rechnungIds = rechnungen ? new Set(rechnungen.map(r => r.id)) : null;
    for (const d of eintraege) {
      const tot = (d.kontaktId && !m.kontakte.has(d.kontaktId)) || (d.firmaId && !m.firmen.has(d.firmaId)) || (d.mandatId && !m.mandate.has(d.mandatId))
        || (d.dealId && !m.chancen.has(d.dealId)) || (d.rechnungId && rechnungIds && !rechnungIds.has(d.rechnungId)) || (d.angebotId && !m.angebote.has(d.angebotId));
      if (tot) melde('datei-verweis-tot', d.id);
      if (d.datei && !platte.has(d.id)) melde(d.dateiFehlt ? 'datei-fehlt-markiert' : 'datei-fehlt', d.id);
    }
    // Derselbe Ordner trägt auch die Projekt-/Aufgaben-Dateien (C2) — sie haben ihren Eintrag im eigenen Bestand.
    const aufgabenDateien = liste(b.aufgabenDateien?.eintraege);
    const mitEintrag = new Set([...eintraege, ...aufgabenDateien].map(d => d.id));
    for (const id of Array.from(platte)) if (!mitEintrag.has(id)) melde('datei-ohne-eintrag', id);
    if (b.aufgabenDateien) {
      const r = aufgabenDateienPruefen(aufgabenDateien, b.aufgaben ? { aufgaben: liste(b.aufgaben.liste).map(t => t.id), projekte: liste(b.aufgabenDateien.projekte) } : null, Array.from(platte));
      for (const id of r.verweisTot) melde('aufgaben-datei-verweis-tot', id);
      for (const id of r.fehlt) melde('aufgaben-datei-fehlt', id);
    }
  }

  // Angebote (28.09.): tote Verweise, Positionen aus gelöschten Produkten, gestellte ohne PDF; Produkte ohne Leistungstext.
  const pdfIds = b.dateien ? new Set(liste(b.dateien.eintraege).map(d => d.id)) : null;
  for (const a of liste(crm.angebote)) {
    if ((a.kontaktId && !m.kontakte.has(a.kontaktId)) || (a.firmaId && !m.firmen.has(a.firmaId)) || (a.dealId && !m.chancen.has(a.dealId)) || (a.mandatId && !m.mandate.has(a.mandatId)) || (a.vorgaengerId && !m.angebote.has(a.vorgaengerId))) melde('angebot-verweis-tot', a.id);
    if (liste(a.positionen).some(p => p.leistungId && !m.leistungen.has(p.leistungId))) melde('angebot-produkt-tot', a.id);
    if (a.status !== 'entwurf' && (!a.pdfDateiId || (pdfIds && !pdfIds.has(a.pdfDateiId)))) melde('angebot-ohne-pdf', a.id);
  }
  for (const l of liste(crm.leistungen)) if (l.status === 'aktiv' && !l.angebot?.leistungstext?.trim()) melde('produkt-ohne-angebotstext', l.id);

  // Ergänzung (Integritätsprüfung 28.09. abends): Firmentext, Typ, Aktivitäten, Deal-Quelle, Planposten, Phase,
  // doppelte Teilnahmen, Kampagnen-Ergebnisse außerhalb, Head-Vorschläge, Einwilligungs-Belege.
  {
    const firmenMap = new Map<string, Firma>(liste(crm.firmen).map(f => [f.id, f]));
    const kampagnen = new Set(liste(crm.kampagnen).map(x => x.id));
    const irgendein = (id: string) => m.chancen.has(id) || m.mandate.has(id) || m.events.has(id) || kampagnen.has(id) || m.beitraege.has(id) || m.angebote.has(id) || m.firmen.has(id) || m.kontakte.has(id);
    for (const k of kontakte) {
      if (firmaTextAbweichend(k, firmenMap)) melde('kontakt-firma-text-abweichend', k.id);
      if (typAbweichend(k)) melde('kontakt-typ-abweichend', k.id);
      const akt = liste(k.aktivitaeten);
      if (akt.some(a => a.firmaId && !m.firmen.has(a.firmaId))) melde('aktivitaet-firma-tot', k.id);
      if (akt.some(a => a.bezug && !irgendein(a.bezug))) melde('aktivitaet-bezug-tot', k.id);
    }
    for (const c of liste(crm.chancen)) {
      if (!c.quelleBezug) continue;
      const tot = c.quelle === 'event' ? !m.events.has(c.quelleBezug) : c.quelle === 'kampagne' ? !kampagnen.has(c.quelleBezug) : c.quelle === 'content' ? !m.beitraege.has(c.quelleBezug) : !irgendein(c.quelleBezug);
      if (tot) melde('deal-quelle-bezug-tot', c.id);
    }
    const leistungen = new Map(liste(crm.leistungen).map(l => [l.id, l]));
    const posten = b.liquiplan ? new Set(liste(b.liquiplan.posten)) : null;
    for (const x of mandate) {
      if (posten && x.planpostenId && !posten.has(x.planpostenId)) melde('mandat-planposten-tot', x.id);
      const l = x.leistungId ? leistungen.get(x.leistungId) : undefined;
      if (x.phase && l && !liste(l.phasen).some(p => p.id === x.phase)) melde('mandat-phase-ungueltig', x.id);
    }
    for (const g of doppelteTeilnahmen(liste(crm.teilnahmen))) melde('teilnahme-doppelt', g[0].eventId);
    for (const kp of liste(crm.kampagnen)) {
      const drin = new Set(liste(kp.kontaktIds));
      if (liste(kp.ergebnisse).some(r => m.kontakte.has(r.kontaktId) && !drin.has(r.kontaktId))) melde('kampagne-ergebnis-ausserhalb', kp.id);
    }
    for (const h of liste(b.heads ?? undefined)) for (const v of liste(h.vorschlaege)) if ((v.status ?? 'offen') === 'offen' && v.kontakt_id && !m.kontakte.has(v.kontakt_id)) melde('head-vorschlag-kontakt-tot', `${h.head}:${v.id}`);
    if (b.dateien) for (const id of einwilligungBelegTot(kontakte, new Set(liste(b.dateien.eintraege).map(d => d.id)))) melde('einwilligung-beleg-tot', id);
  }

  // Mandat an Zielen und Zeit (28.09.): Ziele, Meilensteine, Fokus-Blöcke mit totem Mandat/Firma.
  planungPruefen(b, { mandate: m.mandate, firmen: m.firmen }, melde);
  // Kalender (29.09., K1): Bezüge, gelöschte Termine, verlorene Art, Fokus-Blöcke aus gelöschten Fokuszeiten.
  kalenderPruefen(b, kalenderLebend(b, m), melde);

  // Terminbuchungen (29.09., K4): Seite, Kontakt, Termin.
  buchungenPruefen(b.buchungen, m.kontakte, b.kalender, melde);
  // Spiegel (29.09., K5): Event-/Familien-Termine mit echter UID.
  spiegelPruefen(b.crm ? { events: b.crm.events.map(x => ({ id: x.id, datum: x.datum, ...(x.kalenderUid ? { kalenderUid: x.kalenderUid } : {}) })), familie: b.familieSpiegel ?? null } : null, b.kalender, melde);
  // K6a (29.09.): Termine gelöschter Events, Waisen (#100), Follow-ups am Termin.
  terminePruefen({ kalender: b.kalender, termine: b.termine, kontakte, aufgaben: b.aufgaben, followups: liste(crm.followups), heute: b.heute }, m.events, melde);
  // F2 N4: Wichtige Tage der Familie, deren Mensch gelöscht ist.
  familiePruefen(b.familieTage, melde);

  // Import-Konflikte
  if (b.konflikte) {
    for (const k of liste(b.konflikte.konflikte)) if (!m.kontakte.has(k.kontaktId)) melde('konflikt-veraltet', k.kontaktId);
    for (const d of liste(b.konflikte.moeglicheDubletten)) if (!m.kontakte.has(d.kontaktId) || (d.mitId && !m.kontakte.has(d.mitId))) melde('konflikt-veraltet', d.kontaktId);
  }

  return PRUEFUNG_IDS.filter(id => funde.has(id)).map(id => {
    const p: Pruefung = PRUEFUNGEN[id];
    const alle = funde.get(id)!;
    // Anzahl = betroffene Einträge (einmalig), Beispiele = die ersten fünf Kennungen.
    const eindeutig = Array.from(new Set(alle));
    return { id, schwere: p.schwere, bereich: p.bereich, text: p.text(eindeutig.length), anzahl: eindeutig.length, beispiele: eindeutig.slice(0, BEISPIELE), reparierbar: p.reparierbar, ...(p.art ? { art: p.art } : {}), ...(p.knopf ? { knopf: p.knopf } : {}) };
  }).sort((x, y) => SCHWERE_RANG[x.schwere] - SCHWERE_RANG[y.schwere] || y.anzahl - x.anzahl);
}

/** Gesamtzustand für die Ampel: rot bei Fehlern, gelb bei Warnungen, sonst grün. */
export function verbindungsAmpel(befunde: readonly Pick<VerbindungsBefund, 'schwere'>[]): 'rot' | 'gelb' | 'gruen' {
  return befunde.some(x => x.schwere === 'fehler') ? 'rot' : befunde.some(x => x.schwere === 'warnung') ? 'gelb' : 'gruen';
}

/** Welche Liste zu welchem Feld gehört. */
const LISTE_ZU_FELD = { typ: 'typen', kategorie: 'kategorien', label: 'labels' } as const;
type WertFeld = keyof typeof LISTE_ZU_FELD;

/**
 * Werte an Personen, die in keiner Werteliste stehen (Groß-/Kleinschreibung egal) — je Feld und Wert einmal,
 * in der Schreibweise, in der sie zuerst vorkommen. Werte, die die Werteliste nie aufnähme (Länge), fehlen hier.
 */
export function werteAusserhalb(kontakte: readonly Kontakt[], wertelisten: CrmBestand['wertelisten']): { feld: WertFeld; wert: string }[] {
  const voll = wertelistenVollstaendig(wertelisten);
  const raus: { feld: WertFeld; wert: string }[] = [];
  const s = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();
  for (const [feld, von] of [['typ', typenVon], ['kategorie', kategorienVon], ['label', labelsVon]] as const) {
    const bekannt = new Set(voll[LISTE_ZU_FELD[feld]].map(x => s(x.wert)));
    for (const k of kontakte) for (const w of von(k)) {
      const t = w.replace(/\s+/g, ' ').trim();
      if (t.length < WERT_MIN || t.length > WERT_MAX || bekannt.has(s(t))) continue;
      bekannt.add(s(t));
      raus.push({ feld, wert: t });
    }
  }
  return raus;
}

// ── Reparieren ──────────────────────────────────────────────────────────────

/**
 * Lead ohne (gelöschten) Deal (28.09. abends): der Verweis geht, und ein „SQL“ ohne Deal ist keiner mehr —
 * Status zurück auf „Qualifizierung“, `sqlAm` weg. Andere Status (Kunde, ruht …) bleiben.
 */
function leadOhneDeal<L extends { status: string; chanceId?: string; sqlAm?: string }>(lead: L): L {
  const { chanceId: _c, ...rest } = lead;
  if (lead.status !== 'sql') return rest as L;
  const { sqlAm: _s, ...ohne } = rest as L;
  return { ...ohne, status: 'qualifizierung' } as L;
}

export type ReparaturSpeicher = 'crm' | 'kontakte' | 'import-konflikte' | 'dateien' | 'tasks' | 'ziele' | 'meilensteine' | 'zeit' | 'kalender-bezug' | 'kalender-termine' | 'familie';
export interface Aenderung { befundId: PruefungId; speicher: ReparaturSpeicher; anzahl: number; text: string }

/**
 * Tote Einzelverweise aus dem CRM-Bezug der Aufgaben entfernen — rein. Angefasst wird NUR das Feld `bezug`
 * (lebende Verweise bleiben; leerer Bezug → Feld weg), die Aufgabe selbst und ihre Zeitstempel bleiben.
 * Unveränderte Aufgaben behalten ihre Referenz. Der Schreibweg (`aufgabenBezugZurueckschreiben` in
 * verbindungen-laden.ts) rechnet damit in der Sperre auf dem aktuellen Aufgaben-Stand.
 */
export function aufgabenBezugReparieren<T extends { bezug?: AufgabeBezug }>(tasks: readonly T[], b: Pick<VerbindungsBestaende, 'kontakte' | 'crm'>): { tasks: T[]; n: number } {
  const m = mengen(b as VerbindungsBestaende);
  let n = 0;
  const neu = tasks.map(t => {
    const tot = bezugTot(t.bezug, m);
    if (!tot.length) return t;
    n++;
    const rest = Object.fromEntries(Object.entries(t.bezug ?? {}).filter(([k]) => !(tot as string[]).includes(k))) as AufgabeBezug;
    const { bezug: _weg, ...ohne } = t;
    return (Object.keys(rest).length ? { ...ohne, bezug: rest } : ohne) as T;
  });
  return { tasks: n ? neu : [...tasks], n };
}

/**
 * Sichere Reparaturen für die gewählten Befunde — rein. Entfernt nur tote Verweise
 * (Personen in Deals/Mandaten/Kampagnen/Beitrags-Quellen, Rollen-Schlüssel, Lead → Deal,
 * Antrag → Person), sagt offene Follow-ups ohne Ziel mit Grund ab, räumt veraltete
 * Import-Konflikte ab und markiert Einträge der Ablage, deren Datei fehlt.
 * Nie wird ein ganzer Datensatz gelöscht; Zeitstempel von Deals, Mandaten und Personen
 * bleiben (eine Verweis-Bereinigung ist keine Bewegung im Deal und keine Handarbeit
 * an Stammdaten — sonst kippten Deal-Ampel und „Online gewinnt“).
 * Zweimal angewandt ändert sich nichts mehr.
 */
export function verbindungenReparieren(b: VerbindungsBestaende, ids: readonly string[], jetzt: string, person: string): { aenderungen: Aenderung[]; bestaende: VerbindungsBestaende } {
  const will = new Set(ids.filter(istReparierbar));
  const m = mengen(b);
  const aenderungen: Aenderung[] = [];
  const zaehle = (befundId: PruefungId, speicher: ReparaturSpeicher, anzahl: number, text: string) => { if (anzahl) aenderungen.push({ befundId, speicher, anzahl, text }); };
  const tag = tagVon(jetzt);
  let crm = b.crm;
  const setze = <L extends CrmListe>(l: L, neu: CrmBestand[L]) => { crm = { ...crm, [l]: neu }; };

  if (will.has('deal-kontakt-tot') || will.has('deal-rolle-tot')) {
    let personen = 0, rollen = 0;
    setze('chancen', liste(crm.chancen).map(c => {
      let x = c;
      if (will.has('deal-kontakt-tot') && liste(c.kontaktIds).some(id => !m.kontakte.has(id))) { personen++; x = { ...x, kontaktIds: liste(c.kontaktIds).filter(id => m.kontakte.has(id)) }; }
      const tot = deadRollen(c.personenRollen, m);
      if (will.has('deal-rolle-tot') && tot.length) {
        rollen++;
        const rest = Object.fromEntries(Object.entries(c.personenRollen ?? {}).filter(([id]) => !tot.includes(id)));
        const { personenRollen: _weg, ...ohne } = x;
        x = Object.keys(rest).length ? { ...ohne, personenRollen: rest as typeof c.personenRollen } : ohne;
      }
      return x;
    }));
    zaehle('deal-kontakt-tot', 'crm', personen, `${personen} ${e(personen, 'Deal', 'Deals')}: tote Personen-Verweise entfernt`);
    zaehle('deal-rolle-tot', 'crm', rollen, `${rollen} ${e(rollen, 'Deal', 'Deals')}: Rollen toter Personen entfernt`);
  }
  if (will.has('mandat-kontakt-tot')) {
    let n = 0;
    setze('mandate', liste(crm.mandate).map(x => (liste(x.kontaktIds).some(id => !m.kontakte.has(id)) ? (n++, { ...x, kontaktIds: liste(x.kontaktIds).filter(id => m.kontakte.has(id)) }) : x)));
    zaehle('mandat-kontakt-tot', 'crm', n, `${n} ${e(n, 'Mandat', 'Mandate')}: tote Personen-Verweise entfernt`);
  }
  if (will.has('firma-mutter-tot')) {
    let n = 0;
    setze('firmen', liste(crm.firmen).map(f => {
      if (!f.mutterId || m.firmen.has(f.mutterId)) return f;
      n++;
      const { mutterId: _weg, ...rest } = f;
      return rest;
    }));
    zaehle('firma-mutter-tot', 'crm', n, `${n} ${e(n, 'Firma', 'Firmen')}: Verweis auf gelöschte Mutterfirma entfernt`);
  }
  if (will.has('firma-lead-deal-tot')) {
    let n = 0;
    setze('firmen', liste(crm.firmen).map(f => {
      if (!f.lead?.chanceId || m.chancen.has(f.lead.chanceId)) return f;
      n++;
      return { ...f, lead: leadOhneDeal(f.lead) };
    }));
    zaehle('firma-lead-deal-tot', 'crm', n, `${n} ${e(n, 'Firmen-Lead', 'Firmen-Leads')}: Verweis auf gelöschten Deal entfernt (SQL → Qualifizierung)`);
  }
  if (will.has('followup-kontakt-tot') || will.has('followup-bezug-tot')) {
    let nk = 0, nb = 0;
    setze('followups', liste(crm.followups).map(f => {
      if (!OFFEN_FU.includes(f.status)) return f;
      const tot = followupTot(f, m);
      const grund = tot.kontakt && will.has('followup-kontakt-tot') ? 'die Person gibt es nicht mehr' : !tot.kontakt && tot.bezug && will.has('followup-bezug-tot') ? `${f.bezug.art === 'chance' ? 'der Deal' : f.bezug.art === 'mandat' ? 'das Mandat' : f.bezug.art === 'event' ? 'das Event' : 'die Firma'} existiert nicht mehr` : '';
      if (!grund) return f;
      if (tot.kontakt) nk++; else nb++;
      const vermerk = `Verbindungsprüfung ${tag}: abgesagt — ${grund}.`;
      return { ...f, status: 'abgesagt' as const, notiz: [f.notiz, vermerk].filter(Boolean).join(' · ').slice(0, 1000), geaendert: jetzt, geaendertVon: person };
    }));
    zaehle('followup-kontakt-tot', 'crm', nk, `${nk} ${e(nk, 'Follow-up', 'Follow-ups')} ohne Person abgesagt (mit Grund)`);
    zaehle('followup-bezug-tot', 'crm', nb, `${nb} ${e(nb, 'Follow-up', 'Follow-ups')} ohne Bezug abgesagt (mit Grund)`);
  }
  if (will.has('kampagne-kontakt-tot')) {
    let n = 0;
    setze('kampagnen', liste(crm.kampagnen).map(k => (liste(k.kontaktIds).some(id => !m.kontakte.has(id)) ? (n++, { ...k, kontaktIds: liste(k.kontaktIds).filter(id => m.kontakte.has(id)) }) : k)));
    zaehle('kampagne-kontakt-tot', 'crm', n, `${n} ${e(n, 'Kampagne', 'Kampagnen')}: tote Personen-Verweise entfernt`);
  }
  // Kevin 28.09.: gesperrte Personen (Werbewiderspruch, Art. 21) aus laufenden und geplanten Kampagnen herausnehmen — rechtlich geboten.
  if (will.has('werbesperre-kampagne')) {
    const gesperrt = new Set(liste(b.kontakte).filter(k => k.werbesperre).map(k => k.id));
    let n = 0, personen = 0;
    setze('kampagnen', liste(crm.kampagnen).map(k => {
      if (!(k.status === 'aktiv' || k.status === 'entwurf')) return k;
      const raus = liste(k.kontaktIds).filter(id => gesperrt.has(id));
      if (!raus.length) return k;
      n++; personen += raus.length;
      return { ...k, kontaktIds: liste(k.kontaktIds).filter(id => !gesperrt.has(id)) };
    }));
    zaehle('werbesperre-kampagne', 'crm', n, `${n} ${e(n, 'Kampagne', 'Kampagnen')}: ${personen} ${e(personen, 'gesperrte Person', 'gesperrte Personen')} herausgenommen (Werbewiderspruch)`);
  }
  // Art. 18 (U2): eingeschränkte Personen aus laufenden und geplanten Kampagnen herausnehmen — die Person selbst bleibt unberührt.
  if (will.has('einschraenkung-kampagne')) {
    const raus = new Set(liste(b.kontakte).filter(k => k.eingeschraenkt).map(k => k.id));
    let n = 0, personen = 0;
    setze('kampagnen', liste(crm.kampagnen).map(k => {
      if (!(k.status === 'aktiv' || k.status === 'entwurf')) return k;
      const weg = liste(k.kontaktIds).filter(id => raus.has(id));
      if (!weg.length) return k;
      n++; personen += weg.length;
      return { ...k, kontaktIds: liste(k.kontaktIds).filter(id => !raus.has(id)) };
    }));
    zaehle('einschraenkung-kampagne', 'crm', n, `${n} ${e(n, 'Kampagne', 'Kampagnen')}: ${personen} ${e(personen, 'eingeschränkte Person', 'eingeschränkte Personen')} herausgenommen (Art. 18)`);
  }
  if (will.has('beitrag-kontakt-tot')) {
    let n = 0;
    setze('beitraege', liste(crm.beitraege).map(x => { const tot = beitragQuellenTot(x.quellen, m); return tot.length ? (n++, { ...x, quellen: liste(x.quellen).filter(q => !tot.includes(q)) }) : x; }));
    zaehle('beitrag-kontakt-tot', 'crm', n, `${n} ${e(n, 'Beitrag', 'Beiträge')}: tote Quellen-Verweise entfernt`);
  }
  if (will.has('antrag-kontakt-tot')) {
    let n = 0;
    setze('antraege', liste(crm.antraege).map(a => { if (!a.kontaktId || m.kontakte.has(a.kontaktId)) return a; n++; const { kontaktId: _weg, ...rest } = a; return rest; }));
    zaehle('antrag-kontakt-tot', 'crm', n, `${n} ${e(n, 'Antrag', 'Anträge')}: Verweis auf gelöschte Person entfernt (Vorgang bleibt)`);
  }

  // „In Werteliste aufnehmen“ (Kevin 28.09.): fehlende Werte über denselben Schreibweg wie Stammdaten › Wertelisten
  // (`wertelistenPruefen`) als eigene Werte anlegen. An den Personen ändert sich nichts.
  if (will.has('werte-ausserhalb-wertelisten')) {
    const fehlend = werteAusserhalb(liste(b.kontakte), crm.wertelisten);
    if (fehlend.length) {
      const voll = wertelistenVollstaendig(crm.wertelisten);
      const teil: Record<string, string[]> = {};
      for (const feld of ['typ', 'kategorie', 'label'] as const) {
        const neu = fehlend.filter(w => w.feld === feld).map(w => w.wert);
        if (neu.length) teil[LISTE_ZU_FELD[feld]] = [...voll[LISTE_ZU_FELD[feld]].filter(x => !x.fest).map(x => x.wert), ...neu];
      }
      const p = wertelistenPruefen(teil, crm.wertelisten);
      if (p.ok) {
        crm = { ...crm, wertelisten: p.wertelisten };
        zaehle('werte-ausserhalb-wertelisten', 'crm', fehlend.length, `${fehlend.length} ${e(fehlend.length, 'Wert', 'Werte')} in die Wertelisten aufgenommen`);
      }
    }
  }

  let kontakte = b.kontakte;
  if (will.has('kontakt-lead-deal-tot')) {
    let n = 0;
    kontakte = liste(b.kontakte).map(k => {
      if (!k.lead?.chanceId || m.chancen.has(k.lead.chanceId)) return k;
      n++;
      return { ...k, lead: leadOhneDeal(k.lead) };
    });
    zaehle('kontakt-lead-deal-tot', 'kontakte', n, `${n} ${e(n, 'Personen-Lead', 'Personen-Leads')}: Verweis auf gelöschten Deal entfernt (SQL → Qualifizierung)`);
  }

  // Firmentext aus der Hauptstation, Typ nach vorn (28.09. abends) — Zeitstempel bleiben (keine Handarbeit).
  if (will.has('kontakt-firma-text-abweichend') || will.has('kontakt-typ-abweichend')) {
    const firmenMap = new Map<string, Firma>(liste(crm.firmen).map(f => [f.id, f]));
    let nf = 0, nt = 0;
    kontakte = liste(kontakte).map(k => {
      let x = k;
      if (will.has('kontakt-firma-text-abweichend') && firmaTextAbweichend(x, firmenMap)) { nf++; x = { ...x, firma: hauptFirma(x, firmenMap)!.name }; }
      if (will.has('kontakt-typ-abweichend') && typAbweichend(x)) { nt++; x = { ...x, typen: typenVon(x) }; }
      return x;
    });
    zaehle('kontakt-firma-text-abweichend', 'kontakte', nf, `${nf} ${e(nf, 'Person', 'Personen')}: Firmenname aus der Hauptstation übernommen`);
    zaehle('kontakt-typ-abweichend', 'kontakte', nt, `${nt} ${e(nt, 'Person', 'Personen')}: Typ an die erste Stelle gestellt`);
  }
  // Doppelte Teilnahmen: je Event+Person EINE — die stärkste bleibt, leere Felder aus den anderen, Notizen aneinander.
  if (will.has('teilnahme-doppelt')) {
    const gruppen = doppelteTeilnahmen(liste(crm.teilnahmen));
    if (gruppen.length) {
      const weg = new Set<string>();
      const ersatz = new Map<string, Teilnahme>();
      for (const g of gruppen) {
        const sortiert = [...g].sort((x, y) => (TEILNAHME_RANG[x.status] ?? 9) - (TEILNAHME_RANG[y.status] ?? 9));
        let behalten = sortiert[0];
        for (const t of sortiert.slice(1)) {
          const fuell: Partial<Teilnahme> = {};
          for (const f of ['notiz', 'followUpAm', 'nachfassenVerzichtet', 'rolle', 'fotofreigabe', 'feedback', 'eingeladenAm', 'einladungsweg', 'einladenDurch', 'eingechecktVon'] as const) {
            if (behalten[f] === undefined && t[f] !== undefined) (fuell as Record<string, unknown>)[f] = t[f];
          }
          if (t.notiz && behalten.notiz && !behalten.notiz.includes(t.notiz)) fuell.notiz = `${behalten.notiz}\n${t.notiz}`;
          behalten = { ...behalten, ...fuell };
          weg.add(t.id);
        }
        ersatz.set(behalten.id, behalten);
      }
      setze('teilnahmen', liste(crm.teilnahmen).filter(t => !weg.has(t.id)).map(t => ersatz.get(t.id) ?? t));
      zaehle('teilnahme-doppelt', 'crm', gruppen.length, `${gruppen.length} ${e(gruppen.length, 'doppelte Teilnahme', 'doppelte Teilnahmen')} zusammengeführt (${weg.size} ${e(weg.size, 'Eintrag', 'Einträge')} in die behaltene übernommen)`);
    }
  }

  let konflikte = b.konflikte;
  if (will.has('konflikt-veraltet') && b.konflikte) {
    const k = b.konflikte;
    const neuK = liste(k.konflikte).filter(x => m.kontakte.has(x.kontaktId));
    const neuD = liste(k.moeglicheDubletten).filter(d => m.kontakte.has(d.kontaktId) && (!d.mitId || m.kontakte.has(d.mitId)));
    const n = liste(k.konflikte).length - neuK.length + liste(k.moeglicheDubletten).length - neuD.length;
    if (n) konflikte = { ...k, konflikte: neuK, moeglicheDubletten: neuD };
    zaehle('konflikt-veraltet', 'import-konflikte', n, `${n} veraltete ${e(n, 'Import-Konflikt', 'Import-Konflikte')} abgeräumt`);
  }

  let dateien = b.dateien;
  if (will.has('datei-fehlt') && b.dateien) {
    const platte = new Set(liste(b.dateien.aufPlatte));
    let n = 0;
    const eintraege = liste(b.dateien.eintraege).map(d => (d.datei && !platte.has(d.id) && !d.dateiFehlt ? (n++, { ...d, dateiFehlt: tag }) : d));
    if (n) dateien = { ...b.dateien, eintraege };
    zaehle('datei-fehlt', 'dateien', n, `${n} ${e(n, 'Eintrag', 'Einträge')} der Ablage als „Datei fehlt“ markiert`);
  }

  // CRM-Bezug der Aufgaben (28.09. spät): nur die toten Einzelverweise gehen, die Aufgabe bleibt.
  let aufgaben = b.aufgaben;
  if (will.has('aufgabe-bezug-tot') && b.aufgaben) {
    const r = aufgabenBezugReparieren(liste(b.aufgaben.liste), b);
    if (r.n) aufgaben = { ...b.aufgaben, liste: r.tasks };
    zaehle('aufgabe-bezug-tot', 'tasks', r.n, `${r.n} ${e(r.n, 'Aufgabe', 'Aufgaben')}: tote Verweise auf Kontakt, Firma, Mandat oder Deal entfernt (Aufgabe bleibt)`);
  }

  // Mandat an Zielen und Zeit (28.09.): tote Mandats-/Firmen-Bezüge an Zielen, Meilensteinen, Fokus-Blöcken entfernen.
  const planung = planungReparieren(b, will, { mandate: m.mandate, firmen: m.firmen });
  aenderungen.push(...planung.aenderungen);
  // Kalender (29.09., K1): Einträge zu gelöschten Terminen, tote Kennungen, Fokus-Blöcke aus gelöschten Fokuszeiten.
  // K3 (30.09.): Meetings mit Verweis auf gelöschte Termine — auf der schon reparierten Kartei (`kontakte`).
  // K6a (29.09.): Follow-ups am Termin (CRM), Meetings an Waisen-Terminen (Kartei); iCloud/Bezug schreibt die Route.
  // VOR der K1-Reparatur: ein Meeting, das an den neuen Termin wandert, verliert seinen Verweis sonst als „tot“.
  const ter = termineReparieren({ kalender: b.kalender, termine: b.termine, kontakte, aufgaben: b.aufgaben, followups: liste(crm.followups), heute: b.heute }, will, jetzt, person, m.events);
  if (ter.aenderungen.some(a => a.speicher === 'crm')) crm = { ...crm, followups: ter.followups };
  const kal = kalenderReparieren({ ...b, kalender: ter.kalender, kontakte: ter.kontakte, fokus: planung.fokus }, will, kalenderLebend(b, m));
  aenderungen.push(...kal.aenderungen, ...ter.aenderungen);
  // F2 N4: Wichtige Tage ohne Menschen (geschrieben von der Route in `familie--<haushalt>`).
  const fam = familieReparieren(b.familieTage, will);
  aenderungen.push(...fam.aenderungen);

  return { aenderungen, bestaende: { ...b, crm, kontakte: kal.kontakte, konflikte, dateien, aufgaben, planung: planung.planung, fokus: kal.fokus, kalender: kal.kalender, familieTage: fam.familie } };
}
