// ─── Fulfillment — Typen (C0, 10.10.; FULFILLMENT_KONZEPT.md Abschnitt 8.3) ───────────────────────────────────────────────────────────
// Fulfillment beschreibt, WIE wir liefern: Prozess-Vorlagen (Landkarte „Hochhaus“, Paket-Vorlagen je Produkt, gezeichnete Abläufe), die
// Bibliothek der Bausteine, je Mandat der laufende Fall, Kunden-Link/Formulare/Puls (C2), Dossier + Analyse-Läufe + berufliche Personenkarten (C3).
// Rein und client-sicher: nur Typen (und eine Konstante). Alle Bestände liegen im Bereich Business (Speicher-Register `IN_BUSINESS`).
// Die Typen folgen dem Konzept wörtlich; was C0 zusätzlich braucht (Schnittstellen der Hub-Dateien), steht am Ende („Schnittstellen“).
// Neue Felder nur optional (Live-Daten: nur additiv) — und dann auch in den Säuberer (lib/fulfillment/lesen.ts).
//
// Ebenen (Regel `ebeneVon`, lib/fulfillment/regeln.ts): ein Knoten ohne `elternId` ist Ebene 1 (Gesamtprozess, je Vorlage genau einer),
// seine Kinder Ebene 2 (Prozess/Phase/Zone), dann 3 (Teilprozess), 4 (Einzelschritt), 5 (Baustein — nur `bausteinId`).

import type { KreislaufId } from '@/lib/crm/planung';
import type { KundenAnrede, KundenLage, KundenPhase, KundenQuickWin } from './kunde/bild';

export const FULFILLMENT_VERSION = 1;
export type Zone = 'dach' | 'etage' | 'fundament';
export type ProzessArt = 'landkarte' | 'paket' | 'ablauf';
export type Zustaendig = 'intern' | 'kunde' | 'beide';
export interface Herkunft { art: 'muster' | 'import' | 'hand' | 'demo'; datei?: string; quelleIds?: string[]; importLauf?: string; am: string }

export interface ProzessKnoten {
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
  form?: KnotenForm; frist?: number; zweige?: Zweige;
  // Prozess-Editor › Fläche (17.10.) — beide optional; ohne sie legt die Fläche alles automatisch aus der Reihenfolge aus. Reine Lage: zählt nicht als neue
  // Fassung (laufende Fälle sehen keine Änderung) und geht nie in einen Fall.
  pos?: KnotenLage; pfeilText?: PfeilText;
}
/**
 * Lage auf der Fläche (Prozess-Editor, 17.10.): an einer Phase der Rahmen (absolut, mit Breite `b` und Höhe `h` — fehlen sie, passt sich der Rahmen dem Inhalt an),
 * an einem Schritt die linke obere Ecke RELATIV zu seinem Rahmen (der Rahmen nimmt seine Schritte beim Verschieben mit). Ganze Zahlen in Bildpunkten der Fläche.
 */
export interface KnotenLage { x: number; y: number; b?: number; h?: number }
/** Beschriftung der Pfeile, die von einem Schritt ausgehen (Fläche): `weiter` = zum nächsten, `ja`/`nein` an einer Entscheidung (fehlt = „ja“/„nein“). */
export interface PfeilText { weiter?: string; ja?: string; nein?: string }
/**
 * Form eines Knotens im Fluss (Prozess-Editor, 17.10.). Fehlt sie, leitet die Ansicht sie ab (Abstimmungspunkt → Raute, Mail-Baustein → Nachricht,
 * Ritual → Termin, sonst Schritt — lib/fulfillment/prozesse/reise-bild.ts `knotenForm`). Das Feld heißt `form`, weil `art` an Ablauf-Stufen schon belegt ist.
 */
export type KnotenForm = 'schritt' | 'nachricht' | 'entscheidung' | 'erinnerung' | 'termin' | 'abstimmung';
/**
 * Ausgänge im Fluss (Prozess-Editor): an einer Entscheidung `ja` (fehlt = der nächste Schritt) und `nein` (typisch eine Erinnerung); an einer Erinnerung nur
 * `ja` = „danach zurück zu …“ (fehlt = es geht nach der Entscheidung weiter). Kennungen von Knoten derselben Phase; Kreise nur über Erinnerung → Entscheidung.
 */
export interface Zweige { ja?: string; nein?: string }
/** Ein gelöschter Teil einer Paket-Vorlage im Papierkorb der Vorlage (Prozess-Editor) — 30 Tage zurückholbar, dann fällt er beim nächsten Schreiben weg. */
export interface VorlagenPapierkorb {
  /** Kennung des obersten gelöschten Knotens. */
  id: string; am: string; von: string; art: 'phase' | 'gruppe' | 'schritt' | 'baustein';
  /**
   * Wo er stand (Zurückholen setzt ihn wieder dorthin): Phase, Eltern-Knoten und die Geschwister davor/danach (Phase, Gruppe, Baustein); ein Schritt merkt sich
   * seinen Platz im Fluss (`platz` — wie lib/fulfillment/prozesse/editor.ts `positionVon`, unabhängig von Sammel-Teilprozessen, die inzwischen fehlen).
   */
  phaseId?: string; elternId?: string; nachId?: string; vorId?: string;
  platz?: { nach?: string; vor?: string; inGruppe?: string; nachGruppe?: string; anfang?: true };
  knoten: ProzessKnoten[];
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
export interface ProzessVorlage {
  id: string; art: ProzessArt; titel: string; beschreibung?: string;
  form?: AblaufForm;                                    // Zeichenform (Ablauf); fehlt = baum
  quelleHinweis?: string; vorbehalt?: string; zeichenhinweise?: string[];
  knoten: ProzessKnoten[]; uebergaenge: Uebergang[]; freigaben: Freigabepunkt[]; rollen: Rolle[];
  fassung: number; herkunft?: Herkunft; geaendert: string; geaendertVon: string;
  /** Phasen (Ebene 2) von Hand umgestellt (12.10.) — dann gilt diese Reihenfolge statt der Regel in lib/fulfillment/prozesse/phasen.ts. Nur Pakete. */
  phasenVonHand?: true;
  /** Papierkorb des Prozess-Editors (17.10.) — nur Pakete; die Knoten darin zählen nirgends mit. */
  papierkorb?: VorlagenPapierkorb[];
}

export type BausteinArt = 'aufgabe' | 'dokument' | 'skript' | 'checkliste' | 'mail' | 'kennzahl' | 'ritual' | 'formular' | 'workbook' | 'analyse' | 'freigabe';
export type AnalyseAgentId = 'a0' | 'ap' | 'tb' | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6' | 'a7' | 'a8' | 'a9' | 'a10' | 'a11' | 'a12' | 'a13';
export interface Frage { id: string; abschnitt?: string; frage: string; art: 'text' | 'langtext' | 'zahl' | 'auswahl' | 'ja-nein'; optionen?: string[]; pflicht?: boolean; hilfe?: string }
export interface Baustein {
  id: string; art: BausteinArt; titel: string;
  zweck?: string; warum?: string; ergebnis?: string; kennzahl?: string; hinweis?: string;
  gliederung: string[]; text?: string; platzhalter: string[];
  fragen?: Frage[];                    // formular | workbook
  kundeFuellt?: boolean;               // formular | workbook über den Kunden-Link
  wer: Zustaendig; kundeSichtbar: boolean;
  lieferobjekt?: string; analyse?: AnalyseAgentId; ritualId?: string;
  rechtPruefen?: { seit: string; grund: string };                // „vor Einsatz rechtlich prüfen“
  rechtGeprueft?: { am: string; von: string; notiz: string };
  urheberPruefen?: { seit: string; grund: string };              // „vor Einsatz Urheberrecht prüfen“ (Material Dritter)
  herkunftText?: string;
  tags: string[]; vonHand?: true; herkunft?: Herkunft;
  fassung: number; geaendert: string; geaendertVon: string;
}
/** Rhythmus eines Rituals — `taeglich`/`werktags` seit 11.10. (Entscheidung: tägliches Vertriebs-Huddle, kurz, MIT Zahlenrunde). */
export type Rhythmus = 'einmal' | 'taeglich' | 'werktags' | 'woche' | 'zwei-wochen' | 'monat' | 'quartal';
export interface RitualVorlage {
  id: string; titel: string; rhythmus: Rhythmus; dauerMin: number; agenda: string[]; teilnehmende: ('intern' | 'entscheider' | 'tagesverantwortlich' | 'team')[]; geaendert: string; geaendertVon: string;
  /** 17.10. (dritte Abnahme C6): nur in diesen Paket-Vorlagen im Takt vorgeschlagen (fehlt/leer = in jedem Fall) — z. B. das tägliche Huddle nur im Vertriebsaufbau. */
  pakete?: string[];
}
export interface FulfillmentEinstellungen { kundenLink: { an: boolean; am?: string; von?: string }; pulsSchwelle: number; willkommenStunden: number; nachsorgeTage: number[] }
export interface ImportLauf { id: string; am: string; von: string; datei: string; neu: string[]; geaendert: { id: string; vorher: Baustein | ProzessVorlage }[] }
export interface VorlagenDatei {
  version: number; prozesse: ProzessVorlage[]; bausteine: Baustein[]; rituale: RitualVorlage[];
  zuordnung: Record<string, { vorlageId: string }>; agentZusatz: Partial<Record<AnalyseAgentId, string>>;
  einstellungen: FulfillmentEinstellungen; importLaeufe: ImportLauf[]; marken: Record<string, string>;
}

export type KnotenStatus = 'offen' | 'in_arbeit' | 'wartet_kunde' | 'erledigt' | 'entfaellt';
export interface FallKnoten extends Pick<ProzessKnoten, 'id' | 'elternId' | 'titel' | 'rang' | 'ziel' | 'ergebnis' | 'kennzahl' | 'zustaendig' | 'freigabe' | 'kundeSichtbar' | 'phaseId' | 'bausteinId' | 'dauerTage' | 'form' | 'frist' | 'zweige'> {
  status: KnotenStatus; seit?: string; faelligAm?: string; erledigtAm?: string; erledigtVon?: string; grund?: string; extra?: true;
}
export interface Vereinbarung { rollen?: string; reaktionszeiten?: string; wirBrauchen?: string; eskalation?: string; scopeDrin?: string; scopeDraussen?: string; entscheidungsrechte?: string; bestaetigtAm?: string; bestaetigtWie?: 'kickoff' | 'mail' | 'termin' }
export interface Stakeholder { id: string; kontaktId: string; rolle: 'entscheider' | 'unterstuetzer' | 'skeptiker' | 'nutzer' | 'einkauf' | 'sponsor'; einfluss: 1 | 2 | 3; haltung?: 'positiv' | 'neutral' | 'kritisch'; notiz?: string }
export interface Entscheidung { id: string; am: string; titel: string; inhalt?: string; status: 'offen' | 'entschieden' | 'verworfen'; wer: Zustaendig; frist?: string; geteilt: boolean; von: string }
export interface Mitschrift { id: string; ritualId?: string; am: string; anlass: string; ergebnis: string; naechster: string; frist?: string; von: string }
export interface WertKontoEintrag { ausgang?: string; ausgangZahl?: number; zielZahl?: number; einheit?: string; richtung?: 'hoch' | 'runter'; zielBis?: string; festgelegtAm?: string; messungen: { am: string; wert: number; quelle: 'hand' | 'kunde' }[] }
export interface Fall {
  mandatId: string; vorlageId: string; vorlageFassung: number;
  gestartetAm: string; gestartetVon: string; status: 'onboarding' | 'laeuft' | 'pausiert' | 'abgeschlossen';
  /** Gewählter Starttag (YYYY-MM-DD, 12.10.) — kann vor dem Anlegen liegen (Bestandsmandat). Fehlt: Tag von `gestartetAm`. Lesen nur über `fallStartTag`. */
  startAm?: string;
  knoten: FallKnoten[];
  freigaben: Record<string, { am: string; von: string; kunde?: { wie: 'kickoff' | 'mail' | 'link' | 'termin'; am: string }; notiz?: string }>;
  onboarding: { willkommenGesendetAm?: string; willkommenVon?: string };
  vereinbarung?: Vereinbarung; stakeholder: Stakeholder[]; entscheidungen: Entscheidung[];
  rituale: { ritualId: string; terminUids: string[]; angelegtAm: string }[]; mitschriften: Mitschrift[];
  quickWins: { id: string; text: string; bis: string; erledigtAm?: string; quelle: 'analyse' | 'hand' }[];
  kickoffFragen: { id: string; frage: string; an: 'gruender' | 'entscheider' | 'vertrieb'; warum?: string; quelle: 'analyse' | 'hand'; erledigt?: true }[];
  wertKonto: Record<string, WertKontoEintrag>;                                         // Schlüssel = Mandat.ziele[].id
  befaehigung: { id: string; text: string; erfuellt: boolean; am?: string }[];
  wirkung?: { erstelltAm: string; dateiName?: string; zitat?: { text: string; einwilligungAm: string; wie: string } };
  marken: Record<string, string>; geaendert: string; geaendertVon: string;
  /** Aus der Vorlage beim Start (12.10.): ihre Phasen waren von Hand geordnet — der Fall behält dann seine Reihenfolge. */
  phasenVonHand?: true;
}
export interface FaelleDatei { version: number; faelle: Record<string, Fall> }

export interface KundenLink { id: string; mandatId: string; tokenHash: string; erstelltAm: string; erstelltVon: string; ablaufAm: string; status: 'aktiv' | 'widerrufen' | 'abgelaufen'; rechte: { formular: boolean; upload: boolean; puls: boolean }; zuletztAm?: string; hinweisFassung: string }
export interface FormularStand { mandatId: string; bausteinId: string; fassung: number; antworten: Record<string, string>; fertig: string[]; geaendertAm: string; quelle: 'kunde' | 'intern' }
export interface PulsAnfrage { id: string; mandatId: string; tokenHash: string; erstelltAm: string; offenBis: string; beantwortetAm?: string }
export interface Puls { id: string; mandatId: string; am: string; wert: number; satz?: string; anfrageId?: string; quelle: 'link' | 'hand' }
export interface Unterlage { id: string; mandatId: string; name: string; typ: string; groesse: number; am: string; herkunft: 'kunde' | 'intern'; linkId?: string; von?: string; zweck: 'register' | 'playbook' | 'notiz' | 'sonstig'; status: 'ungeprueft' | 'freigegeben' | 'gesperrt'; beleg?: true }
export interface KundeDatei { version: number; links: KundenLink[]; formulare: FormularStand[]; pulsAnfragen: PulsAnfrage[]; puls: Puls[]; unterlagen: Unterlage[] }

export type AbschnittId = 'fazit' | 'unternehmen' | 'gesellschafter' | 'markt' | 'aussen' | 'vertrieb' | 'reputation' | 'finanzen' | 'chancen_risiken' | 'good_bad' | 'hypothesen' | 'fragen' | 'recht';
export interface Quelle { id: string; url?: string; unterlageId?: string; titel?: string; domain?: string; abgerufenAm: string }
export interface Aussage { id: string; text: string; art: 'fakt' | 'schaetzung' | 'hypothese'; quellen: string[]; stand: string; agent: AnalyseAgentId | 'hand'; personRef?: string; veraltet?: true; gekuerzt?: true }
export interface Abschnitt { id: AbschnittId; aussagen: Aussage[]; tabelle?: { spalten: string[]; zeilen: { werte: string[]; quellen: string[] }[] }; status: 'leer' | 'entwurf' | 'geprueft'; stand?: string }
export type LaufStatus = 'bereit' | 'laeuft' | 'fertig' | 'fehler' | 'abgebrochen' | 'uebernommen' | 'verworfen';
export interface AnalyseLauf { id: string; agent: AnalyseAgentId; status: LaufStatus; schaetzungCent: number; bestaetigtCent: number; grenzeCent: number; kostenCent?: number; gestartetAm?: string; gestartetVon?: string; laeuftSeit?: string; fertigAm?: string; fehler?: string; grund?: string; ergebnis?: unknown; versuch: number; /** Erfundenes Beispiel der Demo-Instanz (15.10., lib/demo/beispiel.ts). */ beispiel?: true }
export interface Massnahme { id: string; text: string; hebel: 'zufluss' | 'umwandlung' | 'zyklus' | 'dealwert' | 'bindung'; wirkung: string; aufwand: 'klein' | 'mittel' | 'gross'; evidenz: 'A' | 'B' | 'C'; abhaengig?: string }
export interface Dossier {
  mandatId: string; firmaId?: string; version: number;
  eingaben: { firma: string; domains: string[]; registerNr?: string; sitz?: string; branche?: string; urls: string[] };
  f1?: { am: string; von: string; umfang: AnalyseAgentId[]; funktionen: string[]; kundeBestaetigtAm?: string; wie?: 'kickoff' | 'mail' };
  interessenabwaegung?: { zweck: string; erforderlichkeit: string; abwaegung: string; schutz: string; am: string; von: string };
  abschnitte: Partial<Record<AbschnittId, Abschnitt>>; quellen: Quelle[]; laeufe: AnalyseLauf[];
  pruefung?: { am: string; bestanden: boolean; befunde: { art: 'dsgvo' | 'quelle' | 'qualitaet'; text: string; bezug?: string; ueberstimmt?: { von: string; grund: string } }[] };
  f2?: { am: string; von: string };
  leseteil?: { id: string; person: string; gestartetAm: string };
  diagnose?: { top5: Massnahme[]; quickWins: string[]; fragen: { frage: string; an: 'gruender' | 'entscheider' | 'vertrieb'; warum: string }[] };
  personenGeloescht?: { am: string; anzahl: number }[];
  geaendert: string; geaendertVon: string;
  /** Erfundenes Beispiel der Demo-Instanz (15.10., lib/demo/beispiel.ts) — die Oberfläche zeigt „Beispiel“. */
  beispiel?: true;
}
export interface DossierDatei { version: number; dossiers: Record<string, Dossier> }
export interface PersonenKarte {
  id: string; mandatId: string; funktion: string; name: string; kontaktId?: string; rolleSeit?: string;
  werdegang: Aussage[]; themen: Aussage[]; auftritte: Aussage[]; aufhaenger: Aussage[];
  identitaet: 'hoch' | 'mittel' | 'niedrig'; ausgelassen: string[]; quellen: Quelle[];
  art14: { faelligAm: string; gegebenAm?: string; wie?: 'kickoff' | 'mail' | 'erster-kontakt'; von?: string };
  erfasstAm: string; loeschAm?: string; status: 'entwurf' | 'geprueft';
}
export interface PersonenDatei { version: number; karten: PersonenKarte[] }

// Schnittstellen zwischen den Paketen (Signaturen in den Stub-Dateien, Abschnitt 11):
export interface FallKurz {
  mandatId: string; status: Fall['status']; phase?: string; fortschritt: number; naechster?: string; wartet: number; wartetAeltesterTage?: number; onboardingOffen: number; willkommenUeberfaellig: boolean;
  /** Onboarding-Schritte, die erfüllt sind oder entfallen (alle acht, auch „darf noch laufen“) — dieselbe Zahl wie das Band im Fall (14.10.). */
  onboardingErfuellt?: number;
}
export interface KundeKurz {
  link: 'keiner' | 'aktiv' | 'abgelaufen' | 'widerrufen' | 'aus'; formularProzent: number | null; ungepruefteUnterlagen: number; letzterPuls?: { wert: number; am: string }; pulsOffen: boolean;
  /** Nur das Kunden-Playbook des Falls (Formular unter dem Schritt „Kunden-Playbook“) in % — misst den Onboarding-Schritt (Prüf-Fund 11.10.: vorher alle Formulare). */
  playbookProzent?: number | null;
}
export interface DossierKurz { vorhanden: boolean; f1: boolean; f2: boolean; laeufe: Partial<Record<AnalyseAgentId, LaufStatus>>; kostenCent: number; art14Bald: number }

// ── Schnittstellen der Hub-Dateien (C0) — Signaturen, die C1/C2/C3 in ihren Stubs liefern ─────────────────────────────────────────────

/** Die fünf Bestände eines Haushalts und ihre Dateien (lib/fulfillment/speicher.ts `fulfillmentSpeicherFuer`). */
export type FulfillmentArt = 'vorlagen' | 'faelle' | 'kunde' | 'dossiers' | 'personen';
export interface FulfillmentDateien { vorlagen: VorlagenDatei; faelle: FaelleDatei; kunde: KundeDatei; dossiers: DossierDatei; personen: PersonenDatei }

/** Ergebnis eines reinen `<bestand>Anwenden(datei, ops, kontext)` — alles oder nichts; 409 mit Konflikten, 400 Unsinn, 413 Grenze. */
export type AnwendenErgebnis<D> =
  | { ok: true; datei: D; geaendert: string[] }
  | { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string; konflikte?: { id: string; stand: string }[] };

/** Ergebnis eines Morgenlauf-Teils (nur Vorschläge in den Stapel + Glocke, nie eine Wirkung nach außen). */
export interface MorgenlaufTeil { vorschlaege: number; info?: string }

/** Was der Löschfristen-Lauf den Paketen mitgibt (wirksame Fristen aus `LOESCHFRISTEN`, Einheit wie dort). */
export interface FristenKontext {
  heute: string; jetzt: Date;
  fristen: { personenTage: number; unterlagenTage: number; mandatsdatenMonate: number };
}

/** Art. 15 — Stakeholder-Einträge der Person (C1). */
export interface StakeholderAuskunft { mandatId: string; rolle: Stakeholder['rolle']; einfluss: Stakeholder['einfluss']; haltung?: Stakeholder['haltung']; notiz?: string }
/** Art. 15 — Antworten, Puls-Sätze und Unterlagen-Metadaten, die die Person nennen (C2). */
export interface KundeAuskunft { mandatId: string; art: 'formular' | 'puls' | 'unterlage'; am: string; text: string }
/** Art. 15 — berufliche Personenkarten, die die Person nennen (C3). */
export interface PersonenAuskunft { mandatId: string; funktion: string; name: string; erfasstAm: string; loeschAm?: string; art14: PersonenKarte['art14']; angaben: string[]; quellen: string[] }
export interface FulfillmentAuskunft { stakeholder: StakeholderAuskunft[]; kunde: KundeAuskunft[]; personen: PersonenAuskunft[] }

/** Zusatz zum 2-Wochen-Report (C2 `reportZusatzFuer`, Abschnitt 5.2) — ohne Fall null (Report Byte für Byte wie heute). */
export interface ReportZusatz {
  wartetAufEuch: string[];
  /** Mit `anteil` (0–100), wenn das Ziel messbar ist (seit 12.10.). */
  wertKonto: (WertKontoZeile & { anteil?: number })[];
  puls?: { wert: number; am: string };
  pulsFrage?: boolean;
  // Seit 12.10. (Fulfillment extern): dieselben Teile wie die Kunden-Seite (`kundenTeile`, lib/fulfillment/kunde/bild.ts) — für Seite 1 des Reports.
  anrede?: KundenAnrede;
  lage?: KundenLage;
  phasen?: KundenPhase[];
  fortschritt?: number;
  erledigt?: string[];
  naechstes?: string[];
  quickWins?: KundenQuickWin[];
  naechsterTermin?: { titel: string; am: string };
}
/** Eine Zeile „vorher → jetzt → Ziel“ (Regel `wertKontoZeilen`), schon als Text. */
export interface WertKontoZeile { zielId: string; name: string; vorher: string; jetzt: string; ziel: string; bis?: string; festgelegt: boolean }
/** Ein offener Punkt „wartet auf euch“ (Regel `wartetAufEuch`) — ältester zuerst. */
export interface WartetPunkt { art: 'knoten' | 'entscheidung' | 'freigabe'; id: string; titel: string; seit?: string; tage?: number }

/** Ein Kandidat für „Kundenonboarding starten“ (Regel `onboardingKandidaten`, Abschnitt 3.1). */
export interface OnboardingKandidat {
  mandatId: string; titel: string; kunde: string; leistungId?: string; zustaendig?: string;
  /** Warum er Kandidat ist (der erste zutreffende Grund). */
  grund: 'vertrag' | 'angebot' | 'deal';
  unterschrift: Unterschrift | null;
  /** Bestandsmandat (vor der Einrichtung von Fulfillment unterschrieben, älter als 14 Tage) — nur ruhig „Fall starten?“, ohne Vorschlag/Glocke/Uhr. */
  bestand?: true;
}
/** Zeitpunkt der Unterschrift (Regel `unterschriftAm`) und woher er kommt. `am` ist eine ISO-Zeit oder ein Tag (YYYY-MM-DD). */
export interface Unterschrift { am: string; quelle: 'angebot' | 'deal' | 'start' | 'fall' }
