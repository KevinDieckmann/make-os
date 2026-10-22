// ─── Prozesse — das EINE Prozessmodell (Etappe B1 „Modell & Bausteine“, 21.10.; research/prozesse/ANALYSE_100.md Punkte 6, 10, 22, 31, 32, 43, 45,
// 51, 53, 54, 55, 62, 68, 100) ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Entscheidung 21.10.: Prozesse für ALLE Business-Bereiche (Marketing, Sales, Übergabe, Fulfillment, Ausbau, Führung, Unterstützung) — EIN Modell, additiv
// erweitert. Das Fulfillment-Prozessmodell (Vorlagen mit Landkarte, Paketen, Abläufen — Prozess-Editor 17.10.) IST dieses Modell: seine Typen stehen
// hier und lib/fulfillment/typen.ts exportiert sie nur weiter (Re-Export statt Kopie). Alte Fulfillment-Vorlagen bleiben bit-gleich gültig — ihnen
// fehlen die neuen Felder, und Fehlen heißt: Bereich Fulfillment, Fall = Mandat (`bereichVon`, `fallArtVon`).
//
// Diese Datei ist der VERTRAG (wie lib/agenten/typen.ts): nur Typen, Konstanten und Namens-Funktionen, rein und client-sicher (nur Typ-Importe).
// Regeln:
//   • nur ADDITIV ändern (neue optionale Felder, neue Union-Glieder) — nie umbenennen, nie ein Feld zur Pflicht machen;
//   • nichts Persönliches (Plattform-Regel): keine Namen, keine Firmen, keine Beträge — Personen sind Team-Kennungen bzw. Speichernamen aus den Konten;
//   • gesteuert wird NUR in MAKE OS (kein n8n/Zapier/Temporal, Punkt 100); Modelle nur hinter dem KI-Tor `askText` (lib/anthropic.ts).
//
// Modul `lib/prozesse/*` (Punkt 100) — Schnittstelle für Werkstatt (B2) und Motor (C1): lib/prozesse/schnittstelle.ts. Eine Instanz ohne Prozesse startet
// sauber: ohne Bestand `prozesse--<haushalt>` liest alles leer, nichts läuft.
//
// Aufbau eines Prozesses = Aufbau einer Paket-Vorlage (damit Fläche und Editor des Fulfillments ihn zeichnen können): ein Knoten ohne `elternId` ist der
// Gesamtprozess (Ebene 1), seine Kinder sind die Phasen (Ebene 2, Rahmen auf der Fläche), deren Kinder die Schritte (bzw. eine Gruppe mit Schritten).
// Reihenfolge = `rang` im Strang einer Phase, Verzweigungen = `zweige` (lib/prozesse/fluss.ts rechnet daraus die Kanten — EINE Stelle für Werkstatt
// und Motor). Neue Formen (Punkte 22, 45): Auslöser, Agent, Warten, Schleife, Teilprozess, Freigabe, Ende — die alten bleiben (Schritt, Nachricht,
// Entscheidung, Erinnerung, Termin, Abstimmung).

import type { KreislaufId } from '@/lib/crm/planung';
import type { KiKategorie } from '@/lib/datenschutz/ki-einstellungen';
import type { ModelTier, Rhythmus, SkillEreignis } from '@/lib/agenten/typen';
import type { Rechteklasse } from '@/lib/werkzeuge/vertrag';
import type { Temperatur } from '@/lib/crm/typen';
import type { AnbieterId } from '@/lib/ki/anbieter';

// ══ Grundmodell — gemeinsam mit Fulfillment (bis 21.10. in lib/fulfillment/typen.ts; Wortlaut unverändert, nur verallgemeinert) ══════════════════

export type Zone = 'dach' | 'etage' | 'fundament';
export type ProzessArt = 'landkarte' | 'paket' | 'ablauf';
export type Zustaendig = 'intern' | 'kunde' | 'beide';
export interface Herkunft { art: 'muster' | 'import' | 'hand' | 'demo'; datei?: string; quelleIds?: string[]; importLauf?: string; am: string }

/**
 * Ein Knoten eines Prozesses. `F` = die Formen, die er tragen darf: Fulfillment-Vorlagen nur `KnotenForm` (Vorgabe — damit ändert sich für Fulfillment
 * nichts), allgemeine Prozesse `ProzessForm`. Die Felder ab „B1“ tragen nur allgemeine Prozesse; der Säuberer des Fulfillments liest sie nicht.
 */
export interface ProzessKnoten<F extends string = KnotenForm> {
  id: string; elternId?: string; titel: string; rang: number;
  zone?: Zone; kreislauf?: KreislaufId[]; ort?: string; verweis?: string;          // Landkarte
  ziel?: string; warum?: string; eingang?: string; ergebnis?: string; kennzahl?: string;
  zustaendig?: Zustaendig; rolle?: string; dauerTage?: number; aufwandStunden?: number;
  freigabe?: string; kundeSichtbar?: boolean; phaseId?: string;
  bausteinId?: string;                                                              // NUR Ebene 5 (dort Pflicht)
  heute?: string; werkzeuge?: string[]; dokumentation?: string;                     // Ablauf-Stufen
  art?: 'einstieg' | 'stufe' | 'ausstieg' | 'routine'; optional?: boolean; ausgang?: string; original?: string;
  beleg?: 'quelle' | 'ergaenzung';                                                 // ergaenzung = gestrichelt
  // Prozess-Editor (17.10.) — alle optional; ohne Feld gilt das bisherige Verhalten (Form aus Baustein/Abstimmungspunkt abgeleitet).
  form?: F; frist?: number; zweige?: Zweige;
  // Prozess-Editor › Fläche (17.10.) — beide optional; ohne sie legt die Fläche alles automatisch aus der Reihenfolge aus. Reine Lage: zählt nicht als neue
  // Fassung (laufende Fälle sehen keine Änderung) und geht nie in einen Fall.
  pos?: KnotenLage; pfeilText?: PfeilText;
  /**
   * Ausführung (17.10. abends): an einer Erinnerung auf dem Nein-Pfad — höchstens so viele Runden (Erinnerung → wieder fragen), danach „eskaliert“.
   * Fehlt = `VERSUCHE_VORGABE` (5 — „5 Kontaktversuche“; lib/fulfillment/prozesse/ausfuehrung.ts). Ganze Zahl 1 … 20.
   */
  versuche?: number;
  // ── B1 (21.10.) — allgemeine Prozesse, alle optional (Säuberer lib/prozesse/bestand.ts; Regeln in lib/prozesse/*) ──
  /** Welcher Baustein des Katalogs (lib/prozesse/baustein-katalog.ts) und die Werte seiner Maske. */
  katalog?: KatalogBezug;
  /** Auslöser (Form `ausloeser`, Punkte 31/32). */
  ausloeser?: Ausloeser;
  /** Agenten-Schritt (Form `agent`, Punkte 51, 53–55). */
  agent?: AgentSchritt;
  /** Raute nach Regel bzw. eigens markierte Modell-Raute (Form `entscheidung`, Punkt 53). Fehlt = ein Mensch entscheidet. */
  raute?: RautenRegel;
  /** Warten mit Obergrenze (Form `warten`, Punkt 45). */
  warten?: WartenRegel;
  /** Schleife „je Eintrag“ mit harter Obergrenze je Lauf (Form `schleife`, Punkt 45). */
  schleife?: SchleifeRegel;
  /** CRM abfragen — liefert eine Liste von Fällen (Entscheidung 21.10.: Kundengewinnung, nächtlicher Prospecting-Lauf). */
  abfrage?: CrmAbfrage;
  /** „Erneut ab Schritt …“ — der Lauf geht (höchstens n-mal) zurück zu einem früheren Schritt. */
  erneut?: ErneutAb;
  /** Teilprozess mit festen Ein- und Ausgaben (Form `teilprozess`, Punkt 45). */
  teilprozess?: TeilprozessAufruf;
  /** Ende mit Ergebnis (Form `ende`). */
  ende?: EndeAngabe;
  /** Freigabe-Schloss (Form `freigabe`, Punkt 62): setzt NUR die Regel lib/prozesse/schloss.ts — nicht entfernbar. */
  schloss?: SchlossMarke;
  /** Bahn auf der Fläche (wer handelt). Fehlt = aus dem Baustein. */
  bahn?: Bahn;
  /**
   * Werkstatt bau-fertig (22.10., Punkt 14): der Schritt ist ausgeschaltet — der Lauf überspringt ihn (Status „übersprungen“, Grund „ausgeschaltet“) und geht über
   * den Hauptweg weiter; ein Freigabe-Schloss dahinter wird MIT übersprungen (es bleibt im Prozess, fällt nie still weg). Nie an Auslöser, Ende oder Schloss.
   */
  deaktiviert?: boolean;
}
/**
 * Lage auf der Fläche (Prozess-Editor, 17.10.): an einer Phase der Rahmen (absolut, mit Breite `b` und Höhe `h` — fehlen sie, passt sich der Rahmen dem Inhalt an),
 * an einem Schritt die linke obere Ecke RELATIV zu seinem Rahmen (der Rahmen nimmt seine Schritte beim Verschieben mit). Ganze Zahlen in Bildpunkten der Fläche.
 */
export interface KnotenLage { x: number; y: number; b?: number; h?: number }
/**
 * Beschriftung der Pfeile, die von einem Schritt ausgehen (Fläche): `weiter` = zum nächsten, `ja`/`nein` an einer Entscheidung (fehlt = „ja“/„nein“).
 * B1: `fehler` (Fehlerkante) und `abgelaufen` (Warten/Freigabe) — nur allgemeine Prozesse.
 */
export interface PfeilText { weiter?: string; ja?: string; nein?: string; fehler?: string; abgelaufen?: string }
/**
 * Form eines Knotens im Fluss (Prozess-Editor, 17.10.). Fehlt sie, leitet die Ansicht sie ab (Abstimmungspunkt → Raute, Mail-Baustein → Nachricht,
 * Ritual → Termin, sonst Schritt — lib/fulfillment/prozesse/reise-bild.ts `knotenForm`). Das Feld heißt `form`, weil `art` an Ablauf-Stufen schon belegt ist.
 * Die Formen des Fulfillments — unverändert. Allgemeine Prozesse: `ProzessForm`.
 */
export type KnotenForm = 'schritt' | 'nachricht' | 'entscheidung' | 'erinnerung' | 'termin' | 'abstimmung';
/**
 * Formen allgemeiner Prozesse (B1, Punkte 22 und 45): die des Fulfillments und dazu Auslöser (Startmarke mit Ereignis), Agent (Ton der ZOE-Kugel, Kopf mit
 * Rolle), Warten, Schleife, Teilprozess, Freigabe (Menschen-Bahn, mit Schloss hinter jeder Außenwirkung) und Ende. Sonst keine neuen Formen.
 */
export type ProzessForm = KnotenForm | 'ausloeser' | 'agent' | 'warten' | 'schleife' | 'teilprozess' | 'freigabe' | 'ende';
export const PROZESS_FORMEN = ['schritt', 'nachricht', 'entscheidung', 'erinnerung', 'termin', 'abstimmung', 'ausloeser', 'agent', 'warten', 'schleife', 'teilprozess', 'freigabe', 'ende'] as const satisfies readonly ProzessForm[];
/**
 * Ausgänge im Fluss (Prozess-Editor): an einer Entscheidung `ja` (fehlt = der nächste Schritt) und `nein` (typisch eine Erinnerung); an einer Erinnerung nur
 * `ja` = „danach zurück zu …“ (fehlt = es geht nach der Entscheidung weiter). Kennungen von Knoten derselben Phase; Kreise nur über Erinnerung → Entscheidung.
 * B1 (allgemeine Prozesse): `ja` an jedem Schritt = „weiter bei …“ (ein Sprung), `nein` auch an einer Freigabe (abgelehnt), `fehler` = Fehlerkante (Aktion,
 * Agent, Teilprozess, Schleife), `abgelaufen` an Warten und Freigabe. Regeln: lib/prozesse/fluss.ts.
 */
export interface Zweige { ja?: string; nein?: string; fehler?: string; abgelaufen?: string }
/** Ein gelöschter Teil einer Paket-Vorlage im Papierkorb der Vorlage (Prozess-Editor) — 30 Tage zurückholbar, dann fällt er beim nächsten Schreiben weg. */
export interface VorlagenPapierkorb<F extends string = KnotenForm> {
  /** Kennung des obersten gelöschten Knotens. */
  id: string; am: string; von: string; art: 'phase' | 'gruppe' | 'schritt' | 'baustein';
  /**
   * Wo er stand (Zurückholen setzt ihn wieder dorthin): Phase, Eltern-Knoten und die Geschwister davor/danach (Phase, Gruppe, Baustein); ein Schritt merkt sich
   * seinen Platz im Fluss (`platz` — wie lib/fulfillment/prozesse/editor.ts `positionVon`, unabhängig von Sammel-Teilprozessen, die inzwischen fehlen).
   */
  phaseId?: string; elternId?: string; nachId?: string; vorId?: string;
  platz?: { nach?: string; vor?: string; inGruppe?: string; nachGruppe?: string; anfang?: true };
  knoten: ProzessKnoten<F>[];
  /** Zweige anderer Knoten, die in den gelöschten Teil zeigten (beim Zurückholen wieder gesetzt, wenn der Knoten noch da und der Zweig frei ist). */
  verweise?: { knotenId: string; zweig: 'ja' | 'nein'; ziel: string }[];
  /** Ein Rückgängig im Editor (kein bewusstes Löschen) — die Liste „Papierkorb“ zeigt ihn nicht. */
  still?: true;
}
/** Zeichenform eines Ablaufs — `kreis` (Entscheidung 11.10.: Sales Circle „schön visualisieren“): Stufen im Uhrzeigersinn, Ergänzungen auf einem gestrichelten äußeren Ring. */
export type AblaufForm = 'baum' | 'trichter' | 'fluss' | 'zeitachse' | 'kreis';
export interface Uebergang { von: string; nach: string; art: 'weiter' | 'rueckweg' | 'ausstieg' | 'schleife' | 'kreislauf'; weiche?: string; beleg?: 'quelle' | 'ergaenzung' }
export interface Freigabepunkt { id: string; titel: string; wer: Zustaendig }
export interface Rolle { id: string; titel: string; aufgabe?: string }
export interface ProzessVorlage<F extends string = KnotenForm> {
  id: string; art: ProzessArt; titel: string; beschreibung?: string;
  form?: AblaufForm;                                    // Zeichenform (Ablauf); fehlt = baum
  quelleHinweis?: string; vorbehalt?: string; zeichenhinweise?: string[];
  knoten: ProzessKnoten<F>[]; uebergaenge: Uebergang[]; freigaben: Freigabepunkt[]; rollen: Rolle[];
  fassung: number; herkunft?: Herkunft; geaendert: string; geaendertVon: string;
  /** Phasen (Ebene 2) von Hand umgestellt (12.10.) — dann gilt diese Reihenfolge statt der Regel in lib/fulfillment/prozesse/phasen.ts. Nur Pakete. */
  phasenVonHand?: true;
  /** Papierkorb des Prozess-Editors (17.10.) — nur Pakete; die Knoten darin zählen nirgends mit. */
  papierkorb?: VorlagenPapierkorb<F>[];
  /**
   * Zusatzmodul (17.10. spät, z. B. Telefonie) — nur Pakete. Läuft am Mandat schon ein Fall, wird KEIN zweiter Fall angelegt: die Phasen des Pakets hängen als
   * eigener Abschnitt am laufenden Fall (`Fall.zusaetze`, `FallKnoten.zusatz`, lib/fulfillment/prozesse/fall.ts `zusatzAnhaengen`); ohne Fall startet es als
   * normaler Fall OHNE vorangestellte Onboarding-Phase (`Fall.ohneOnboarding`). Ändert nur, wie ein Fall startet — keine neue Fassung.
   */
  zusatz?: true;
  // ── B1 (21.10.) — allgemeine Prozesse, alle optional. Fehlen = Fulfillment-Vorlage: Bereich Fulfillment, Fall = Mandat. ──
  /** Bereich auf der Landkarte (Punkt 6). Fehlt = `fulfillment`. */
  bereich?: ProzessBereich;
  /** Woran ein Lauf hängt (Punkt 6). Fehlt = `mandat`. */
  fallArt?: FallArt;
  /** Genau eine verantwortliche Person (Punkt 10): Team-Kennung (`teamVon`, lib/make-one/team-speicher.ts) — nie ein Name im Code. Pflicht für „aktiv“. */
  eigner?: string;
  /** Als wer der Lauf schreibt (Punkt 68): Speichername eines Kontos des Haushalts. Fehlt = der Eigner, wenn er ein Konto hat — nie Rückfall auf den Inhaber. */
  laeuftAls?: string;
  /** Wann ein Fall hineingehört bzw. wann der Prozess erfüllt ist (Punkt 10) — Pflicht für „aktiv“. Klartext, Daten (nie eine Anweisung an ein Modell). */
  startKriterium?: string;
  endKriterium?: string;
  /** Feste Ein- und Ausgaben, wenn der Prozess als Teilprozess aufgerufen wird (Punkt 45) — nur Kennungen, Zahlen, Daten, Auswahl. */
  schnittstelle?: ProzessSchnittstelle;
  /** Notiz-Zettel auf der Fläche (Entscheidung 21.10.) — nur Text, keine Wirkung, NIE im Lauf (sie sind keine Knoten). */
  zettel?: NotizZettel[];
}
/** Ein Notiz-Zettel auf der Fläche: Text an einer Stelle — keine Form, kein Pfeil, kein Lauf. Farbe nur als Name (Token der Oberfläche), nie ein Farbwert. */
export interface NotizZettel { id: string; text: string; pos: KnotenLage; farbe?: ZettelFarbe; von?: string; am?: string }
export type ZettelFarbe = 'gelb' | 'gruen' | 'blau' | 'rosa' | 'grau';
export const ZETTEL_FARBEN = ['gelb', 'gruen', 'blau', 'rosa', 'grau'] as const satisfies readonly ZettelFarbe[];

// ══ Bereiche und Fälle (Punkt 6) ════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Die Business-Bereiche eines Prozesses — dieselben Stufen wie die Fliege der Landkarte (Kern) und die Bänder Führung/Unterstützung. Nur Business. */
export type ProzessBereich = 'marketing' | 'sales' | 'uebergabe' | 'fulfillment' | 'ausbau' | 'fuehrung' | 'unterstuetzung';
export const PROZESS_BEREICHE: readonly { id: ProzessBereich; titel: string; band: 'kern' | 'fuehrung' | 'unterstuetzung' }[] = [
  { id: 'marketing', titel: 'Marketing', band: 'kern' },
  { id: 'sales', titel: 'Sales', band: 'kern' },
  { id: 'uebergabe', titel: 'Übergabe', band: 'kern' },
  { id: 'fulfillment', titel: 'Fulfillment', band: 'kern' },
  { id: 'ausbau', titel: 'Ausbau', band: 'kern' },
  { id: 'fuehrung', titel: 'Führung', band: 'fuehrung' },
  { id: 'unterstuetzung', titel: 'Unterstützung', band: 'unterstuetzung' },
];
export const BEREICH_IDS = PROZESS_BEREICHE.map(b => b.id) as readonly ProzessBereich[];
/**
 * Woran ein Lauf hängt: ein Lead, ein Deal, ein Mandat, ein Event, eine Firma, eine Kampagne — oder an nichts (z. B. Monatsabschluss).
 * C1 (21.10., M3): `kampagne` dazu (Kampagnen-Playbooks als Prozesse) — additiv; ein älterer Stand liest einen Prozess mit Fall „Kampagne“ als ohne Fall-Art.
 */
export type FallArt = 'lead' | 'deal' | 'mandat' | 'event' | 'firma' | 'kampagne' | 'keiner';
export const FALL_ARTEN: readonly { id: FallArt; titel: string }[] = [
  { id: 'lead', titel: 'Lead' }, { id: 'deal', titel: 'Deal' }, { id: 'mandat', titel: 'Mandat' },
  { id: 'event', titel: 'Event' }, { id: 'firma', titel: 'Firma' }, { id: 'kampagne', titel: 'Kampagne' }, { id: 'keiner', titel: 'ohne Fall' },
];
export const FALL_ART_IDS = FALL_ARTEN.map(f => f.id) as readonly FallArt[];
/** Fehlt der Bereich, ist es eine Fulfillment-Vorlage. */
export const BEREICH_VORGABE: ProzessBereich = 'fulfillment';
/** Fehlt die Fall-Art, hängt der Lauf an einem Mandat (wie jeder Fulfillment-Fall). */
export const FALL_ART_VORGABE: FallArt = 'mandat';
export const bereichVon = (v: { bereich?: ProzessBereich }): ProzessBereich => v.bereich ?? BEREICH_VORGABE;
export const fallArtVon = (v: { fallArt?: FallArt }): FallArt => v.fallArt ?? FALL_ART_VORGABE;

// ══ Bahnen, Katalog-Bezug, Bedingungen ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Wer handelt (Bahnen auf der Fläche): ein Mensch, ein Agent, das System (Regel ohne Modell) oder der Kunde (nur Nachrichten). */
export type Bahn = 'mensch' | 'agent' | 'system' | 'kunde';
export const BAHNEN = ['mensch', 'agent', 'system', 'kunde'] as const satisfies readonly Bahn[];

/** Ein Wert einer Maske (je Feldtyp, lib/prozesse/baustein-katalog.ts `MaskenTyp`). */
export type MaskenWert = string | number | boolean | readonly string[] | readonly number[] | readonly Bedingung[] | readonly WebhookFeld[] | readonly VertragFeld[] | Readonly<Record<string, string>> | null;
/** Bezug eines Knotens auf einen Baustein des Katalogs: Kennung + Werte seiner Maske. Unbekannte Werte fallen beim Prüfen weg (nie gespeichert). */
export interface KatalogBezug { id: string; werte?: Record<string, MaskenWert> }

/** Vergleich einer Bedingung („nur wenn …“, Punkt 31; Rauten nach Regel, Punkt 53) — reine Auswertung über Felder, nie Code. */
export type BedingungOp = 'gleich' | 'ungleich' | 'enthaelt' | 'beginnt' | 'groesser' | 'kleiner' | 'gesetzt' | 'leer' | 'einer-von';
export const BEDINGUNG_OPS = ['gleich', 'ungleich', 'enthaelt', 'beginnt', 'groesser', 'kleiner', 'gesetzt', 'leer', 'einer-von'] as const satisfies readonly BedingungOp[];
export interface Bedingung { feld: string; op: BedingungOp; wert?: string | number | boolean | readonly string[] }
export type Verknuepfung = 'und' | 'oder';

// ══ Auslöser (Punkte 31, 32) ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Wodurch ein Lauf startet. Ereignis-Arten = `SkillEreignis` (lib/agenten/typen.ts — keine zweite Liste). Datum relativ rechnet der Motor (22.10., lib/prozesse/datum-start.ts +
 * `datumStarten` im Takt: Fristen über `fristenLesen`, Werktage NRW über den Kalender-Kern). Webhook (Entscheidung 21.10.: „Ja, abgesichert“): je Prozess eigene Adresse mit eigenem Schlüssel —
 * der Webhook legt NUR ein Ereignis `webhook` ab (lib/prozesse/webhook-server.ts), gestartet wird erst vom Motor.
 */
export type Ausloeser =
  | { art: 'ereignis'; ereignis: SkillEreignis; bedingungen?: Bedingung[]; verknuepfung?: Verknuepfung }
  | { art: 'zeitplan'; rhythmus: Rhythmus; /** „HH:MM“ Berliner Zeit */ uhrzeit: string; /** woechentlich 1–7, monatlich 1–31 */ tage?: number[] }
  /**
   * Datum am Fall (22.10., Datums-Start — lib/prozesse/datum-start.ts): `werktage` zählt Werktage NRW (Kalender-Kern), `uhrzeit` fehlt = 08:00; „nur wenn …“ über die
   * Felder des Falls (optional — z. B. nur besuchte Events, nur ruhende Leads).
   */
  | { art: 'datum'; feld: DatumsFeld; /** −365 … 365 Tage (negativ = vorher) */ versatzTage: number; werktage?: boolean; uhrzeit?: string; bedingungen?: Bedingung[]; verknuepfung?: Verknuepfung }
  | { art: 'hand' }
  | { art: 'webhook'; felder: WebhookFeld[]; bedingungen?: Bedingung[]; verknuepfung?: Verknuepfung }
  /** Nach einem der vorhandenen Loops (app/api/loop/route.ts: morgen · woche · rueckblick) — „nach dem Morgen-Loop“. */
  | { art: 'loop'; loop: LoopArt };
export type AusloeserArt = Ausloeser['art'];
export const AUSLOESER_ARTEN = ['ereignis', 'zeitplan', 'datum', 'hand', 'webhook', 'loop'] as const satisfies readonly AusloeserArt[];
/** Die Loops (app/api/loop/route.ts, POST `{ loop }`). */
export type LoopArt = 'morgen' | 'woche' | 'rueckblick';
export const LOOP_ARTEN = ['morgen', 'woche', 'rueckblick'] as const satisfies readonly LoopArt[];
/** Datumsfelder am Fall für „n Tage vor/nach …“ (Punkt 34 rechnet sie in Etappe C über die vorhandenen Fristen-Leser). */
export type DatumsFeld = 'mandat.kuendigungsfrist' | 'mandat.review' | 'mandat.ende' | 'mandat.start' | 'deal.entscheidung' | 'angebot.gueltig-bis' | 'rechnung.faellig' | 'event.datum' | 'lead.wiedervorlage'
  /** Begleit-Prozesse am Fall (22.10., B1): der nächste Termin mit dem Kunden (Kick-off, Review …) — aus DERSELBEN Rechnung wie das Cockpit (`naechsterFallTermin`). */
  | 'fall.termin';
/**
 * Ein bekanntes Feld des Webhook-Körpers (Schema am Auslöser): nur diese Felder werden angenommen, der Rest verworfen. Alles Eingehende ist fremder Text
 * (`fremd()`), auch Kennungen — Weg, Empfänger und Beträge entscheidet es nie (Punkt 56, Etappe C).
 */
export interface WebhookFeld { id: string; art: WebhookFeldArt; pflicht?: boolean; optionen?: string[]; max?: number }
export type WebhookFeldArt = 'text' | 'zahl' | 'ja-nein' | 'datum' | 'kennung' | 'auswahl' | 'email';
export const WEBHOOK_FELD_ARTEN = ['text', 'zahl', 'ja-nein', 'datum', 'kennung', 'auswahl', 'email'] as const satisfies readonly WebhookFeldArt[];

// ══ Bausteine des Baukastens (Punkt 45) ═════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Raute: nach Regel über Felder („erster passender Zweig“: ja, sonst nein) oder eigens markierte Modell-Raute mit Pflichtsatz (Punkt 53). */
export type RautenRegel =
  | { art: 'regel'; bedingungen: Bedingung[]; verknuepfung?: Verknuepfung }
  | { art: 'modell'; frage: string; warumKeineRegel: string; modell: ModelTier; budgetCent: number; modellWahl?: ModellWahl }
  /**
   * Score-Raute (Kundengewinnung, 21.10.): „Lead-Score ≥ Schwelle“, „Temperatur ist …“, „SQL-bereit“, „MQL erreicht“ — der Motor liest sie über
   * lib/crm/score.ts `leadScore` mit `scoringKontext` bzw. lib/crm/leads.ts `salesBereit`/`mqlErreicht`. Der Score bleibt abgeleitet, nie gespeichert.
   */
  | { art: 'score'; pruefung: ScorePruefung; schwelle?: number; temperatur?: Temperatur[] };
export type ScorePruefung = 'score' | 'temperatur' | 'sql-bereit' | 'mql';
export const SCORE_PRUEFUNGEN = ['score', 'temperatur', 'sql-bereit', 'mql'] as const satisfies readonly ScorePruefung[];
export const TEMPERATUREN = ['kalt', 'lau', 'warm', 'heiss'] as const satisfies readonly Temperatur[];
/**
 * Warten — jedes Warten hat eine Obergrenze und den Ausgang „abgelaufen“ (`zweige.abgelaufen`). Wartende Läufe kosten nichts (der Takt weckt).
 * C1 (21.10., M1): Obergrenze auch in STUNDEN (`hoechstensStunden`, z. B. „Antwort binnen 4 Stunden“) und „Arbeitszeit zählen“ (`arbeitszeit`: Tage =
 * Werktage NRW, Stunden = Arbeitsstunden Mo–Fr 9–18 Uhr; Entscheidung 21.10.: „48 Stunden = Werktage“) — beide optional, ohne sie wie bisher.
 */
export type WartenRegel =
  | { art: 'dauer'; tage: number; stunden?: number; arbeitszeit?: boolean }
  /** `werktage` (22.10., optional): der Versatz zählt Werktage NRW — dieselbe Regel wie der Datums-Auslöser (lib/prozesse/datum-start.ts `stichtagVon`). */
  | { art: 'datum'; feld: DatumsFeld; versatzTage?: number; hoechstensTage: number; werktage?: boolean }
  | { art: 'ereignis'; ereignis: SkillEreignis; bedingungen?: Bedingung[]; verknuepfung?: Verknuepfung; hoechstensTage: number; hoechstensStunden?: number; arbeitszeit?: boolean };
/**
 * Schleife „je Eintrag einer Liste“: ruft je Eintrag (je Fall) einen veröffentlichten Teilprozess auf. `liste` = `abfrage:<Knoten>` (Ergebnis einer
 * CRM-Abfrage dieses Prozesses) oder eine Liste am Fall. Harte Obergrenze JE LAUF: mehr Einträge werden nie still gekürzt — der Rest bleibt mit
 * sichtbarem Hinweis für den nächsten Lauf liegen (Motor, Etappe C).
 */
export interface SchleifeRegel { liste: string; prozessId: string; hoechstens: number }
/** Teilprozess: immer die veröffentlichte Version; feste Eingaben (Feld der Schnittstelle → Quelle im Lauf). `warten: false` = nur starten, nicht aufs Ergebnis warten. */
export interface TeilprozessAufruf { prozessId: string; eingaben?: Record<string, string>; warten?: boolean }
/**
 * Was eine CRM-Abfrage liefert (Entscheidung 21.10.: ruhende Accounts, neue Leads, Deals ohne nächsten Schritt …). Seit 22.10. (Kundengewinnung, N1 aus
 * research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md › 5.2) dazu die Arten der 18 Vorlagen — gelesen NUR über die vorhandenen Leser (lib/prozesse/kundengewinnung/abfrage.ts):
 *   leads-wiedervorlage   Leads „ruht“ mit Wiedervorlage bis heute (lib/crm/leads.ts)      deals-wiedervorlage   geparkte Deals, Wiedervorlage fällig (`dealWiedervorlagen`)
 *   deals-haengen         offene Deals mit Ampel rot/gelb oder ohne nächsten Schritt (`gesundheit`, lib/crm/pipeline.ts)
 *   netzwerken-offen      Erfassungen des Event-Falls ohne Nachfassen und ohne Verzicht     nachbereiten          Termine mit CRM-Bezug vorbei, ohne Notiz (`nachbereitung`)
 *   vernetzen-runde       die Vernetzen-Runde der Person (`netzRunde`)                     powerhour-karten      wer heute dran ist (`werIstDran`)
 *   kampagne-personen     die Personen einer Kampagne (Kampagne des Falls bzw. jede aktive) mandate-laufzeitende  aktive Mandate mit Ende in n Tagen (`mandatFristen`)
 */
export type CrmAbfrageArt = 'leads' | 'neue-leads' | 'firmen-ruhend' | 'deals-ohne-schritt' | 'angebote-ohne-antwort'
  | 'leads-wiedervorlage' | 'deals-wiedervorlage' | 'deals-haengen' | 'netzwerken-offen' | 'nachbereiten' | 'vernetzen-runde' | 'powerhour-karten' | 'kampagne-personen' | 'mandate-laufzeitende';
export const CRM_ABFRAGE_ARTEN = ['leads', 'neue-leads', 'firmen-ruhend', 'deals-ohne-schritt', 'angebote-ohne-antwort',
  'leads-wiedervorlage', 'deals-wiedervorlage', 'deals-haengen', 'netzwerken-offen', 'nachbereiten', 'vernetzen-runde', 'powerhour-karten', 'kampagne-personen', 'mandate-laufzeitende'] as const satisfies readonly CrmAbfrageArt[];
/** Abfrage-Arten, die eine Zahl „Tage“ brauchen (seit bzw. ohne Kontakt seit bzw. Vorlauf). */
export const ABFRAGE_MIT_TAGEN: readonly CrmAbfrageArt[] = ['neue-leads', 'firmen-ruhend', 'angebote-ohne-antwort', 'mandate-laufzeitende'];
export type BeanGruppe = 'B' | 'E' | 'A' | 'N';
/**
 * Eine CRM-Abfrage (liefert eine Liste von Fällen — nur Kennungen). Filter über die VORHANDENEN Leser (lib/crm/leads.ts `leads`, Lifecycle, BEAN,
 * Score); Kontakte NUR über `kontakteFuerVerarbeitung` (Art. 18 — eingeschränkte Personen fehlen ganz). `tage` = „seit n Tagen“ bzw. „ohne Kontakt seit
 * n Tagen“. `hoechstens` begrenzt die Liste — darüber ein sichtbarer Hinweis, nie still gekürzt.
 */
export interface CrmAbfrage {
  art: CrmAbfrageArt;
  status?: string[]; temperatur?: Temperatur[]; bean?: BeanGruppe[]; lifecycle?: string[];
  tage?: number;
  hoechstens: number;
}
/** „Erneut ab Schritt …“: zurück zu einem früheren Schritt dieses Prozesses, höchstens `hoechstens`-mal je Lauf (danach weiter). */
export interface ErneutAb { ab: string; hoechstens: number }
export interface ProzessSchnittstelle { eingaben: VertragFeld[]; ausgaben: VertragFeld[] }
/** Ende: Ziel erreicht, abgebrochen oder Übergabe an einen anderen Prozess (Lichtfaden auf der Landkarte, Punkt 9). */
export interface EndeAngabe { ergebnis: 'erfolg' | 'abbruch' | 'uebergabe'; uebergabeAn?: string }
/** Freigabe-Schloss (Punkt 62): steht direkt hinter dem Knoten `fuer` — Grund: seine Klasse (außen, Geld, Löschen) bzw. das „tödliche Dreieck“ (Punkt 55). */
export interface SchlossMarke { fuer: string; grund: Extract<Rechteklasse, 'aussen' | 'geld' | 'loeschen'> | 'dreieck' }

// ══ Agenten-Schritt (Punkte 51, 53, 54, 55) ═══════════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Wer arbeitet: ZOE, ein Head (lib/agenten/katalog.ts, nur Business), ein Skill (er gehört einem Head) oder ein vorhandener Fach-Agent (lib/zoe/agenten.ts
 * `AUSFUEHRBAR`, z. B. Research). Keine zweite Agentenwelt.
 */
export type AgentWer = { art: 'zoe' } | { art: 'head'; headId: string } | { art: 'skill'; skillId: string } | { art: 'fach'; agentId: string };
/** Gedächtnis des Schritts: Brain (Wissen des Haushalts, Sicht wie immer) und die Akte des Falls (nur über die vorhandenen Lesewege). */
export interface AgentGedaechtnis { brain: boolean; akte: boolean }
/** Worauf eine Kennung zeigt (Vertrag: nur Kennungen fließen zwischen Schritten, nie Freitext). */
export type KennungArt = 'kontakt' | 'firma' | 'lead' | 'deal' | 'mandat' | 'event' | 'aufgabe' | 'angebot' | 'rechnung' | 'termin' | 'vorschlag' | 'faden' | 'prozess';
export const KENNUNG_ARTEN = ['kontakt', 'firma', 'lead', 'deal', 'mandat', 'event', 'aufgabe', 'angebot', 'rechnung', 'termin', 'vorschlag', 'faden', 'prozess'] as const satisfies readonly KennungArt[];
/** Ein Feld im Vertrag eines Schritts (Punkt 54): Kennung, Zahl, Tag, ja/nein oder Auswahl — kein Freitext. */
export interface VertragFeld { id: string; art: 'kennung' | 'zahl' | 'datum' | 'ja-nein' | 'auswahl'; kennung?: KennungArt; optionen?: string[]; pflicht?: boolean; liste?: boolean }
/**
 * Der Agenten-Baustein (Entscheidung 21.10.: „wie ein n8n-AI-Agent-Knoten, aber mit unseren Dingen“): drei Andockpunkte — Modell (nur über das KI-Tor, Budget je Schritt),
 * Gedächtnis (Brain, Akte), Werkzeuge (ZOE-Werkzeuge mit ihrer Rechte-Klasse). Vertrag: Ein- und Ausgabe nur Kennungen. Pflichtsatz „Warum reicht keine Regel?“.
 */
export interface AgentSchritt {
  wer: AgentWer;
  /** Der Auftrag — von einem Menschen geschrieben (Anweisung). */
  auftrag: string;
  /** Stufe: schnell (klein) · ausgewogen · stark. Ohne `modellWahl` wählt das KI-Tor das Modell der Stufe (lib/ki/modelle.ts `stufenModelle`). */
  modell: ModelTier;
  /**
   * Ein bestimmtes angebundenes Modell (Entscheidung 21.10.: später auch andere Anbieter, sobald angebunden) — nur aus der Liste der Instanz
   * (lib/prozesse/modell-wahl.ts `modellOptionen`: angebunden UND im Empfänger-/AVV-Register). Aufgerufen wird trotzdem nur über das KI-Tor.
   */
  modellWahl?: ModellWahl;
  /** Budget je Schritt in Cent (Pflicht, > 0). */
  budgetCent: number;
  gedaechtnis: AgentGedaechtnis;
  /** ZOE-Werkzeuge (Namen aus lib/werkzeuge/einordnung.ts) — Teilmenge dessen, was ZOE, der Head bzw. der Skill hat. */
  werkzeuge: string[];
  eingabe: VertragFeld[];
  ausgabe: VertragFeld[];
  /** Pflichtsatz (Punkt 53): warum hier keine Regel reicht. */
  warumKeineRegel: string;
  /**
   * Was mit dem Ergebnis geschieht: `daten` (Vorgabe) = Kennungen nach dem Vertrag an den nächsten Schritt; `vorschlag` = ein Vorschlag in den Stapel
   * (Häkchen je Feld bzw. Sammelfreigabe), der nächste Schritt bekommt nur seine Kennung. Liest der Schritt fremden Text aus dem Web (Research), ist es
   * IMMER ein Vorschlag (Regel 6) — lib/prozesse/agent-schritt.ts erzwingt das. Seit 22.10. spät (Motor, M6): auch bei `vorschlag` gehen die Werte des
   * VERTRAGS (nur Kennungen, Zahlen, Tage, ja/nein, Auswahl) als `agent.<feld>` an die Rauten (z. B. „Fit ≥ 70“ — nur in harmlose Äste, Punkt 56); die Felder
   * der Akte (`vorschlagFelder`, Text) gehen nie in den Lauf, nur als CRM-Vorschlag (lib/prozesse/agent-felder.ts).
   */
  ergebnis?: 'daten' | 'vorschlag';
  /** Bei `vorschlag`: welche Felder der Akte der Vorschlag füllen darf (`VORSCHLAG_ZIELFELDER`) — nichts sonst. */
  vorschlagFelder?: string[];
  /** Bei `vorschlag`: Übernahme mit Häkchen je Feld (Vorgabe) oder als Sammelfreigabe. */
  uebernahme?: 'je-feld' | 'sammel';
  /**
   * „Nur öffentliche Angaben“ (Entscheidung 22.10. nachts) — nur für Web-Recherche-Fach-Agenten (Research, Prospecting, Content; sonst wirkungslos): an das Modell
   * gehen NUR Firmenname, Website/Domain und Branche aus der Firmenkarte des Falls (lib/prozesse/agent-felder.ts `oeffentlicheAngaben`) — nie Notizen,
   * Aktivitäten, Kontaktdaten, Personen, Brain, Akte, Deal- oder Angebotsdaten. Der Motor erzwingt das (lib/prozesse/lauf-server.ts), Akte und Brain sind
   * aus, die KI-Kategorien nur `web` + `allgemein`. Damit fehlt die Ecke „private Daten“ des tödlichen Dreiecks → kein Pflicht-Schloss dahinter; das
   * Ergebnis bleibt IMMER ein Vorschlag im Stapel (Häkchen je Feld bzw. Sammelfreigabe). Fehlt das Feld, gilt alles wie bisher (Akte, Schloss).
   */
  nurOeffentlich?: true;
}
/** Ein angebundenes Modell: Anbieter (lib/ki/anbieter.ts `KI_ANBIETER`) + Modell-Kennung (lib/ki/modelle.ts) + Stufe. Nie fest in einer Maske. */
export interface ModellWahl { anbieter: AnbieterId; modell: string; stufe: ModelTier }
/** Felder der Akte, die ein Agenten-Vorschlag füllen darf (Firmen-Stammdaten, Kernfragen der Qualifizierung — lib/crm/lead-form.ts). */
export const VORSCHLAG_ZIELFELDER = [
  'firma.branche', 'firma.website', 'firma.sitz', 'firma.mitarbeiter', 'firma.umsatz-klasse', 'firma.beschreibung', 'firma.linkedin',
  'lead.schmerz', 'lead.entscheider', 'lead.budget', 'lead.zeitpunkt', 'lead.wirkung', 'lead.alternative',
] as const;
export type VorschlagZielfeld = typeof VORSCHLAG_ZIELFELDER[number];

// ══ Bestand `prozesse--<haushalt>`: Entwurf und veröffentlichte Versionen (Punkt 43) ═════════════════════════════════════════════════════════════

/** Ein allgemeiner Prozess = eine Paket-Vorlage mit allen Formen. */
export type ProzessDefinition = ProzessVorlage<ProzessForm>;
/** Status eines Prozesses: Entwurf (nie veröffentlicht oder zurückgestellt) → Probelauf → aktiv; pausiert; archiviert. Wer was darf: lib/prozesse/rollen.ts. */
export type ProzessStatus = 'entwurf' | 'probelauf' | 'aktiv' | 'pausiert' | 'archiviert';
export const PROZESS_STATUS = ['entwurf', 'probelauf', 'aktiv', 'pausiert', 'archiviert'] as const satisfies readonly ProzessStatus[];
/** Eine veröffentlichte Version — unveränderlich. Neue Fälle laufen auf der jüngsten, laufende bleiben auf ihrer (Punkt 44, Motor). */
export interface ProzessVersion { nr: number; name: string; notiz?: string; am: string; von: string; definition: ProzessDefinition }
export interface ProzessEintrag {
  /** `pz-<uuid>` — dieselbe Kennung trägt die Definition (`entwurf.id`, `versionen[].definition.id`). */
  id: string;
  /** Der Entwurf (die Fläche der Werkstatt): wird gespeichert, läuft nie. */
  entwurf: ProzessDefinition;
  versionen: ProzessVersion[];
  status: ProzessStatus;
  angelegtAm: string; angelegtVon: string;
  entwurfAm: string; entwurfVon: string;
  statusAm?: string; statusVon?: string;
  /**
   * Werkstatt bau-fertig (22.10.): Testdaten des Prozesses — erfundene Beispiel-Werte und „Weg annehmen“ für den Probelauf (lib/prozesse/testdaten.ts; nur
   * `*.invalid`-Adressen, Platzhalter-Telefon, Annahmen nur als Kennungen). Gehört zum Eintrag, nicht zur Version — läuft nie, geht nie in einen Fall.
   */
  testdaten?: import('./testdaten').ProzessTestdaten;
}
export interface ProzesseDatei { v: 1; prozesse: ProzessEintrag[] }

// ══ Bestand `prozesse-webhook--<haushalt>`: Adressen, Schlüssel (nur Fingerabdruck), Eingänge ════════════════════════════════════════════════════

export interface WebhookEintrag {
  prozessId: string;
  /** Öffentliche Adresse `pw-<24 hex>` (96 Bit) — `/api/prozesse/webhook/<kennung>`. */
  kennung: string;
  /** SHA-256 (hex) des Schlüssels — der Schlüssel selbst wird genau einmal angezeigt und nie gespeichert. */
  schluesselHash: string;
  /** Erst nach Klick „scharf“ nimmt die Adresse etwas an. */
  scharf: boolean;
  angelegtAm: string; angelegtVon: string;
  erneuertAm?: string; erneuertVon?: string;
  scharfAm?: string; scharfVon?: string;
  /** Zähler (nur Zahlen): angenommene Eingänge und der letzte. */
  anzahl?: number; zuletztAm?: string;
}
/** Ein angenommener Eingang: nur die bekannten Felder des Schemas — fremder Text, Frist „ereignisse“. */
export interface WebhookEingang { id: string; prozessId: string; version: number; am: string; felder: Record<string, string | number | boolean>; fremd: true }
export interface WebhookDatei { v: 1; webhooks: WebhookEintrag[]; eingaenge: WebhookEingang[] }

// ══ Grenzen (über einer Grenze wird ABGELEHNT — 413 mit Satz, nie still gekürzt) ═════════════════════════════════════════════════════════════════

export const PROZESS_GRENZEN = {
  prozesse: 200,
  knotenJeProzess: 400,
  versionenJeProzess: 100,
  ausloeserJeProzess: 5,
  bedingungen: 20,
  webhookFelder: 30,
  /** Körper eines Webhook-Aufrufs (Bytes). */
  webhookKoerper: 64_000,
  /** Eingänge aller Webhooks des Haushalts im Bestand — darüber 503 „voll“ (die Frist räumt), nie gekürzt. */
  eingaenge: 2000,
  vertragFelder: 20,
  werkzeugeJeAgent: 20,
  schleifeHoechstens: 500,
  wartenTageMax: 90,
  /** Obergrenze eines Wartens in Stunden (C1, M1) — 30 Tage. */
  wartenStundenMax: 720,
  /** Höchstes Budget je Agenten- bzw. Modell-Schritt in Cent (darüber: erst einen Teilprozess bilden oder bewusst mehrere Schritte). */
  budgetCentMax: 500,
  opsJeAnfrage: 60,
  optionen: 50,
  /** Ab so vielen Schritten je Phase ein ruhiger Hinweis „Teilprozess bilden?“ (Punkt 8) — nie hart gesperrt. */
  schritteHinweis: 10,
  zettel: 100,
  /** Obergrenze einer CRM-Abfrage bzw. „erneut ab Schritt“. */
  abfrageHoechstens: 1000,
  erneutHoechstens: 5,
} as const;
/** Textgrenzen (Zeichen) — darüber 413 im Schreibweg. */
export const PROZESS_TEXT = {
  titel: 120,
  beschreibung: 2000,
  kriterium: 500,
  versionName: 80,
  notiz: 500,
  auftrag: 4000,
  warum: 1000,
  frage: 500,
  textvorlage: 4000,
  feldText: 300,
  /** Ein Textfeld im Webhook-Körper (Vorgabe, wenn das Schema kein `max` nennt). */
  webhookText: 2000,
  zettel: 1000,
} as const;

// ══ Kennungen ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Prozess `pz-<uuid>`. */
export const PROZESS_KENNUNG = /^pz-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Knoten (wie der Editor): `fk-<uuid>`. Ältere Kennungen (Fulfillment-Vorlagen, Muster) liest der Säuberer weiter. */
export const KNOTEN_KENNUNG = /^fk-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Öffentliche Webhook-Adresse `pw-<24 hex>` — dieselbe Form in der Middleware (`PROZESS_WEBHOOK`). */
export const WEBHOOK_KENNUNG = /^pw-[a-f0-9]{24}$/;
/** Eingang `we-<uuid>`. */
export const EINGANG_KENNUNG = /^we-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Feld-Kennung (Masken, Vertrag, Webhook-Schema): klein, Ziffern, Bindestrich/Unterstrich/Punkt. */
export const FELD_KENNUNG = /^[a-z][a-z0-9_.-]{0,39}$/;

/** Die Bestandsnamen (je Haushalt). */
export const prozesseBestand = (h: string): string => `prozesse--${h}`;
export const webhookBestand = (h: string): string => `prozesse-webhook--${h}`;

/**
 * Ein Ergebnis eines Prüfschritts (die Werkstatt zeigt alle, nicht nur den ersten):
 *   fehler   unlesbar bzw. gegen eine Regel — wird nicht gespeichert (auch nicht als Entwurf)
 *   offen    unvollständig — der Entwurf wird gespeichert, veröffentlichen bzw. aktiv schalten geht erst ohne
 *   hinweis  nur ein Rat (z. B. „Teilprozess bilden?“) — sperrt nichts
 */
export type BefundStufe = 'fehler' | 'offen' | 'hinweis';
export interface Befund { stufe: BefundStufe; text: string; knotenId?: string; feld?: string }
/** KI-Kategorien eines Bausteins (Typ-Durchreiche für die Schnittstelle). */
export type { KiKategorie, ModelTier, Rechteklasse, SkillEreignis };
