// ─── Prozesse — der Baustein-Katalog als Daten (Etappe B1, 21.10.; ANALYSE_100.md Punkte 22, 45, 51, 62; Entscheidung 21.10.) ──────────────────────────
// Entscheidung 21.10.: „Jede vorhandene Anbindung wird ein Baustein mit eigener Einstellungs-Maske“ — Inbox (Gmail/IMAP), WhatsApp, Kalender, CRM (Kontakt, Firma,
// Deal, Lead, Follow-up), Angebot, Rechnung, Aufgabe, Glocke, Telegram-Hinweis, ZOE, Heads, Fach-Agenten/Skills — und der Baukasten: Aktion, Raute,
// Warten, Schleife, Teilprozess, Fehlerkante (die Fehlerkante ist ein Ausgang jedes Knotens, `zweige.fehler`), Freigabe, Ende.
//
// Je Eintrag: Kennung, Name, Form, Kategorie (Auslöser · Aktion · Entscheidung · Warten · Agent · Teilprozess · Ende), Bahn, die Maske (Felder mit Typ,
// Pflicht, Vorgabe, Auswahlquelle) und WOHER die Werkzeugklasse kommt — nie doppelt gepflegt:
//   werkzeug   ein ZOE-Werkzeug: Klasse aus lib/werkzeuge/einordnung.ts (`EINORDNUNG`), KI-Kategorie aus dessen Gruppe (der Server löst sie auf:
//              lib/prozesse/werkstatt-server.ts `katalogAufgeloest`) — hier steht beides NICHT noch einmal;
//   rechte     nur, wo es (bewusst) kein Werkzeug gibt — z. B. Mail-/WhatsApp-Entwurf, Angebot stellen, Löschen (`aussen`/`loeschen` sind heute bewusst
//              kein Werkzeug) — dann auch `ki` (welche Bereichsdaten der Baustein nutzt);
//   agent      Klasse aus dem Rechte-Profil des Agenten-Schritts (lib/prozesse/agent-schritt.ts `rechteProfil`).
//   feld       die Maske schreibt in ein eigenes Feld des Knotens (Auslöser, Agent, Raute, Warten, Schleife, Teilprozess, Ende) — geprüft von dessen
//              Regel; sonst stehen die Werte in `knoten.katalog.werte` (`maskeSaeubern`).
// Neue Anbindung später = ein Eintrag hier (Wächter tests/prozesse-katalog.test.ts: Werkzeug gibt es, keine doppelte Klasse, Masken gültig).
// „Auto-Reply“ gibt es nicht: Mail und WhatsApp sind Entwürfe — hinter jedem Baustein der Klassen aussen · geld · loeschen setzt die Regel ein
// Freigabe-Schloss (lib/prozesse/schloss.ts). Kein Nutzer-Code — nur feste Formatierer (`FORMATIERER`).
// Rein und client-sicher.

import { EINORDNUNG } from '@/lib/werkzeuge/einordnung';
import { IMMER_FREIGABE, type Rechteklasse } from '@/lib/werkzeuge/vertrag';
import type { Kanal } from '@/lib/crm/recht';
import { LIFECYCLE_WAHL } from '@/lib/crm/lifecycle';
import { UEBERFUEHRBAR } from './ueberfuehrung';
import {
  CRM_ABFRAGE_ARTEN, FELD_KENNUNG, LOOP_ARTEN, PERSON_TAGE, PROZESS_GRENZEN, PROZESS_TEXT, SCORE_PRUEFUNGEN, TEMPERATUREN, VORSCHLAG_ZIELFELDER,
  type AgentWer, type Bahn, type Befund, type FallArt, type KiKategorie, type MaskenWert, type ProzessForm,
} from './definition';

export type KatalogKategorie = 'ausloeser' | 'aktion' | 'entscheidung' | 'warten' | 'agent' | 'teilprozess' | 'ende';
export const KATALOG_KATEGORIEN: readonly { id: KatalogKategorie; titel: string }[] = [
  { id: 'ausloeser', titel: 'Auslöser' }, { id: 'aktion', titel: 'Aktion' }, { id: 'entscheidung', titel: 'Entscheidung' },
  { id: 'warten', titel: 'Warten' }, { id: 'agent', titel: 'Agent' }, { id: 'teilprozess', titel: 'Teilprozess' }, { id: 'ende', titel: 'Ende' },
];

/** Woher eine Auswahl ihre Werte bekommt — der Server liefert die Liste (GET /api/prozesse/katalog?auswahl=1), nie Namen im Code. */
export type AuswahlQuelle =
  | 'team-person'      // Team des Haushalts (teamVon) — Kennungen
  | 'konto-person'     // Konten des Haushalts (Speichername) — z. B. „läuft als“, Telegram
  | 'pipeline-stufe'   // Deal-Stufen (lib/crm/pipeline.ts STUFEN)
  | 'postfach'         // eigene Postfächer mit Business-Bereich
  | 'head'             // Business-Heads (lib/agenten/katalog.ts)
  | 'skill'            // Skills der Business-Heads
  | 'ereignis'         // Ereignis-Arten, die einen Prozess starten (PROZESS_EREIGNISSE)
  | 'prozess'          // veröffentlichte Prozesse (Teilprozess, Schleife, Übergabe)
  | 'gesellschaft'     // Business-Gesellschaften (lib/einheiten.ts)
  | 'whatsapp-vorlage' // genehmigte WhatsApp-Vorlagen (erst mit eingerichteter Nummer)
  | 'datumsfeld'       // Datumsfelder am Fall (lib/prozesse/ausloeser.ts DATUMS_FELDER)
  | 'fall-feld'        // Felder des Falls bzw. des Laufs (Empfänger = Kontakt des Falls …)
  | 'modell'           // angebundene Modelle der Instanz (lib/prozesse/modell-wahl.ts `modellOptionen`) — nie fest in der Maske
  | 'werkzeug'         // ZOE-Werkzeuge des Business-Bereichs
  | 'schritt'          // Schritte DIESES Prozesses (die Werkstatt kennt sie selbst)
  | 'liste';           // Listen im Lauf: Ergebnis einer CRM-Abfrage dieses Prozesses (`abfrage:<Knoten>`) bzw. eine Liste am Fall
export const AUSWAHL_QUELLEN = ['team-person', 'konto-person', 'pipeline-stufe', 'postfach', 'head', 'skill', 'ereignis', 'prozess', 'gesellschaft', 'whatsapp-vorlage', 'datumsfeld', 'fall-feld', 'modell', 'werkzeug', 'schritt', 'liste'] as const satisfies readonly AuswahlQuelle[];
/** Quellen, deren Werte aus dem Prozess selbst kommen (kein Abruf beim Server). */
export const QUELLEN_IM_PROZESS: readonly AuswahlQuelle[] = ['schritt', 'liste'];

/** Feldtypen einer Maske. `textvorlage` = Text mit {{Platzhaltern}} und festen Formatierern — kein Code. */
export type MaskenTyp = 'text' | 'langtext' | 'zahl' | 'ja-nein' | 'auswahl' | 'mehrfach' | 'uhrzeit' | 'tage' | 'textvorlage' | 'bedingungen' | 'webhook-felder' | 'vertrag';
export interface MaskenFeld {
  id: string; label: string; typ: MaskenTyp;
  pflicht?: boolean;
  vorgabe?: MaskenWert;
  /** Feste Optionen (Auswahl, Mehrfach). */
  optionen?: readonly { id: string; label: string }[];
  /** Optionen aus dem Bestand der Instanz (der Server liefert sie). */
  quelle?: AuswahlQuelle;
  min?: number; max?: number;
  hilfe?: string;
}
/** In welches Feld des Knotens die Maske schreibt (statt `katalog.werte`). */
export type KatalogFeld = 'ausloeser' | 'agent' | 'raute' | 'warten' | 'schleife' | 'teilprozess' | 'ende' | 'abfrage' | 'erneut';
export interface KatalogEintrag {
  id: string; name: string;
  /** Ein Satz: was der Baustein tut (Palette, Tooltip). */
  satz: string;
  /** Welche Anbindung (Gruppe der Palette). */
  anbindung: string;
  form: ProzessForm; kategorie: KatalogKategorie; bahn: Bahn;
  /** ZOE-Werkzeug — Klasse und KI-Kategorie kommen von dort. */
  werkzeug?: string;
  /** Nur ohne Werkzeug: die Klasse (bewusst kein Werkzeug, z. B. Außenwirkung). */
  rechte?: Rechteklasse;
  /** Nur ohne Werkzeug: welche Bereichsdaten der Baustein nutzt (KI-Kategorien, lib/datenschutz/ki-einstellungen.ts). */
  ki?: readonly KiKategorie[];
  /** Agenten-Schritt: Klasse aus dem Rechte-Profil. */
  agent?: true;
  /** Bringt Text Dritter in den Lauf (Webhook) — danach gilt der ganze Lauf als „fremd gelesen“ (Punkt 56). */
  fremd?: true;
  /** Eigens markierte Modell-Raute (Punkt 53). */
  modellRaute?: true;
  /** Die Maske schreibt in dieses Feld des Knotens. */
  feld?: KatalogFeld;
  /** Feste Werte (z. B. die Art eines CRM-Vorschlags) — nicht in der Maske, nicht überschreibbar. */
  fest?: Readonly<Record<string, string>>;
  /** Agenten-Bausteine mit festem Agenten (Research): wer arbeitet und dass das Ergebnis ein Vorschlag ist — die Prüfung erzwingt es. */
  agentFest?: { wer: AgentWer; ergebnis?: 'vorschlag' };
  /**
   * Spricht eine Person an (Mail, WhatsApp, Einladung, Angebot, Outreach): vor jeder Wirkung Kanal-Ampel und § 7 UWG, Werbesperre und Art. 18
   * (lib/crm/recht.ts `kanalStatus`, lib/prozesse/ansprache.ts) — rot heißt: nicht. `kanal` fest bzw. aus dem Maskenfeld `kanalFeld`.
   */
  ansprache?: { kanal?: Kanal; kanalFeld?: string };
  /** Der EINE Schreibweg, den der Motor nehmen muss (Regel aus CLAUDE.md, z. B. `dealAnlegen` mit Pflicht „nächster Schritt“). */
  schreibweg?: string;
  /** Über welche vorhandenen Leser der Baustein liest (z. B. Kontakte NUR über `kontakteFuerVerarbeitung`, Art. 18). */
  liest?: string;
  /**
   * Nur in einem überführten Prozess (22.10., Paket Ü): steht nicht in der Knoten-Auswahl — er kommt mit „In die Werkstatt überführen“ und wirkt nur im
   * Prozess, der den System-Ablauf ersetzt (lib/prozesse/ueberfuehrung.ts).
   */
  nurUeberfuehrung?: true;
  maske: readonly MaskenFeld[];
}

// ── Bausteine der Masken (wiederkehrende Felder) ──────────────────────────────────────────────────────────────────────────────────────────────────
const TV = (id: string, label: string, pflicht = true, hilfe?: string): MaskenFeld => ({ id, label, typ: 'textvorlage', pflicht, max: PROZESS_TEXT.textvorlage, ...(hilfe ? { hilfe } : {}) });
const WER = (label = 'Wer', pflicht = false): MaskenFeld => ({ id: 'wer', label, typ: 'auswahl', quelle: 'team-person', pflicht });
const TAGE = (id: string, label: string, max = 365, pflicht = false): MaskenFeld => ({ id, label, typ: 'zahl', min: 0, max, pflicht });
const AN_FALL: MaskenFeld = { id: 'an', label: 'An', typ: 'auswahl', quelle: 'fall-feld', pflicht: true, hilfe: 'Empfänger aus dem Fall (Kontakt, Ansprechpartner) — nie eine Adresse aus fremdem Text.' };
const RHYTHMUS: MaskenFeld = { id: 'rhythmus', label: 'Rhythmus', typ: 'auswahl', pflicht: true, optionen: [{ id: 'taeglich', label: 'täglich' }, { id: 'werktags', label: 'werktags' }, { id: 'woechentlich', label: 'wöchentlich' }, { id: 'monatlich', label: 'monatlich' }] };
const BEDINGUNGEN = (pflicht = false): MaskenFeld => ({ id: 'bedingungen', label: 'Nur wenn …', typ: 'bedingungen', pflicht });
const VERKNUEPFUNG: MaskenFeld = { id: 'verknuepfung', label: 'Verknüpfung', typ: 'auswahl', optionen: [{ id: 'und', label: 'alle' }, { id: 'oder', label: 'mindestens eine' }], vorgabe: 'und' };
/** Modellstufe (Vorgabe am Agenten-Knoten — nie eine feste Modell-Kennung): die Rollen des Anbieter-Tors (lib/ki/modelle.ts `STUFE_JE_ROLLE`). */
const STUFE = (vorgabe: 'schnell' | 'ausgewogen' = 'ausgewogen'): MaskenFeld => ({ id: 'modell', label: 'Stufe', typ: 'auswahl', pflicht: true, vorgabe,
  optionen: [{ id: 'schnell', label: 'wie Mitarbeiter (schnell)' }, { id: 'ausgewogen', label: 'wie ein Head (ausgewogen)' }, { id: 'stark', label: 'wie ein Review (stark)' }] });
/** Ein bestimmtes angebundenes Modell — die Werte liefert die Instanz (Anbieter + Modell + Stufe), nie diese Maske. Ohne Wahl: das Modell der Stufe. */
const MODELL: MaskenFeld = { id: 'modellWahl', label: 'Modell', typ: 'auswahl', quelle: 'modell', hilfe: 'Nur angebundene Anbieter mit Eintrag im Empfänger-Register. Ohne Wahl gilt das Modell der Stufe.' };
const BUDGET: MaskenFeld = { id: 'budgetCent', label: 'Budget je Schritt (Cent)', typ: 'zahl', min: 1, max: PROZESS_GRENZEN.budgetCentMax, pflicht: true };
/**
 * „Nur öffentliche Angaben“ am Web-Recherche-Agenten (Entscheidung 22.10. nachts) — die Erklärung mit Fallbeispiel steht als `hilfe` am Schalter. Die Regel dahinter:
 * lib/prozesse/agent-schritt.ts `oeffentlichModus`, erzwungen im Motor (lib/prozesse/lauf-server.ts, lib/prozesse/agent-felder.ts `oeffentlicheAngaben`).
 */
export const NUR_OEFFENTLICH: MaskenFeld = {
  id: 'nurOeffentlich', label: 'Nur öffentliche Angaben (Firmenname, Website)', typ: 'ja-nein', vorgabe: true,
  hilfe: 'An: Das Modell bekommt nur Firmenname, Website und Branche aus der Firmenkarte — keine Notizen, keine Kontaktdaten, keine Personen; Akte und Brain bleiben aus. '
    + 'Darum steht hinter der Recherche kein Extra-Klick: du bestätigst nur die gefundenen Felder im Stapel (einzeln oder alle auf einmal). '
    + 'Beispiel: Zu „Beispiel GmbH · beispiel.de · Maschinenbau“ findet die Recherche Mitarbeiterzahl und LinkedIn-Seite — die Notiz an der Firma sieht das Modell nie. '
    + 'Aus: Der Agent darf die Akte des Falls mitlesen — dann steht hinter ihm eine Freigabe (private Daten, fremder Text, Weg nach außen).',
};
const WARUM: MaskenFeld = { id: 'warumKeineRegel', label: 'Warum reicht keine Regel?', typ: 'langtext', pflicht: true, max: PROZESS_TEXT.warum, hilfe: 'Pflichtsatz: Agenten kosten mehr und sind schwerer zu prüfen.' };
const HOECHSTENS = (pflicht = true): MaskenFeld => ({ id: 'hoechstensTage', label: 'Höchstens (Tage)', typ: 'zahl', min: 1, max: PROZESS_GRENZEN.wartenTageMax, pflicht, hilfe: 'Danach geht es über den Ausgang „abgelaufen“ weiter.' });
const FIRMA_GESELLSCHAFT: MaskenFeld = { id: 'gesellschaft', label: 'Gesellschaft', typ: 'auswahl', quelle: 'gesellschaft', pflicht: true };
const PRIO: MaskenFeld = { id: 'prioritaet', label: 'Priorität', typ: 'auswahl', optionen: [{ id: 'low', label: 'niedrig' }, { id: 'medium', label: 'mittel' }, { id: 'high', label: 'hoch' }, { id: 'critical', label: 'kritisch' }], vorgabe: 'medium' };

/**
 * Rollen statt Personen (22.10., Vorlagen der Kundengewinnung — Regel R8): Masken mit Quelle `team-person` nehmen außer einer Person des Teams auch eine
 * ROLLE, die der Motor erst im Lauf auflöst — nie fällt ein Lauf auf den Inhaber zurück. `rolle:eigner` = der Eigner des Prozesses; `rolle:zustaendig` = die
 * zuständige Person des Falls (Besitzer des Leads/Deals, Zuständige des Mandats, die Person, die erfasst bzw. den Termin angelegt hat — lib/crm/team.ts
 * `zustaendig`), ohne sie der Eigner. Die Auflösung steht EINMAL in lib/prozesse/kundengewinnung/rollen.ts `personAusRolle`.
 */
export const ROLLE_EIGNER = 'rolle:eigner';
export const ROLLE_ZUSTAENDIG = 'rolle:zustaendig';
export const ROLLEN_WERTE: readonly { id: string; label: string }[] = [
  { id: ROLLE_ZUSTAENDIG, label: 'Zuständig im Fall' }, { id: ROLLE_EIGNER, label: 'Eigner des Prozesses' },
];
/** Gesellschaft des Falls (Deal, Mandat, Angebot) — statt einer festen Gesellschaft in einer Vorlage. */
export const GESELLSCHAFT_DES_FALLS = 'fall.gesellschaft';
/**
 * Postfach statt fester Kennung (Vorlagen): das Business-Postfach der Person, als die der Lauf schreibt, bzw. das Postfach der Nachricht, die den Lauf
 * gestartet hat (Antwort im selben Gespräch). Der Motor löst es auf; ohne passendes Postfach endet der Schritt über seine Fehlerkante — nie ein privates.
 */
export const POSTFACH_DES_LAUFS = 'postfach.lauf';
export const POSTFACH_DER_NACHRICHT = 'postfach.nachricht';
export const POSTFACH_WERTE: readonly { id: string; label: string }[] = [
  { id: POSTFACH_DES_LAUFS, label: 'Business-Postfach der Person des Laufs' }, { id: POSTFACH_DER_NACHRICHT, label: 'Postfach der Nachricht (Antwort im Gespräch)' },
];

/** Neutrale Telegram-Hinweise — fest, ohne Werte, Beträge, Namen (lib/datenschutz/telegram-text.ts). */
export const TELEGRAM_HINWEISE: readonly { id: string; label: string }[] = [
  { id: 'freigabe', label: 'Ein Prozess braucht deine Freigabe — Details in MAKE OS.' },
  { id: 'wartet', label: 'Ein Prozess wartet auf dich — Details in MAKE OS.' },
  { id: 'fertig', label: 'Ein Prozess ist abgeschlossen — Details in MAKE OS.' },
  { id: 'fehler', label: 'Ein Prozess braucht Hilfe — Details in MAKE OS.' },
];

/** Wie die CRM-Abfragen heißen. */
export const ABFRAGE_NAME: Readonly<Record<(typeof CRM_ABFRAGE_ARTEN)[number], string>> = {
  leads: 'Leads (nach Status, Temperatur, BEAN, Lifecycle)', 'neue-leads': 'Neue Leads seit n Tagen', 'firmen-ruhend': 'Ruhende Firmen (ohne Kontakt seit n Tagen)',
  'deals-ohne-schritt': 'Deals ohne nächsten Schritt', 'angebote-ohne-antwort': 'Angebote gestellt, ohne Antwort seit n Tagen',
  // Kundengewinnung (22.10., N1) — gelesen über die vorhandenen Leser (lib/prozesse/kundengewinnung/abfrage.ts).
  'leads-wiedervorlage': 'Geparkte Leads mit fälliger Wiedervorlage', 'deals-wiedervorlage': 'Geparkte Deals mit fälliger Wiedervorlage',
  'deals-haengen': 'Hängende Deals (Ampel rot/gelb oder ohne nächsten Schritt)', 'netzwerken-offen': 'Erfassungen des Events ohne Nachfassen',
  nachbereiten: 'Termine mit CRM-Bezug, die nachbereitet werden wollen', 'vernetzen-runde': 'Vernetzen-Runde der Person (LinkedIn)',
  'powerhour-karten': 'Power Hour: wer heute dran ist', 'kampagne-personen': 'Personen einer Kampagne', 'mandate-laufzeitende': 'Mandate mit Laufzeitende in n Tagen',
};
/** Lead-Status (lib/crm/lead-form.ts) — als Auswahl der Abfrage. */
const LEAD_STATUS: readonly { id: string; label: string }[] = [
  { id: 'neu', label: 'neu' }, { id: 'kontaktiert', label: 'kontaktiert' }, { id: 'im_gespraech', label: 'im Gespräch' }, { id: 'qualifizierung', label: 'Qualifizierung' },
  { id: 'sql', label: 'SQL' }, { id: 'kein_fit', label: 'kein Fit' }, { id: 'ruht', label: 'ruht' }, { id: 'kunde', label: 'Kunde' },
];
/** Felder der Akte, die „Karte ergänzen“ vorschlagen darf (N4 — dieselbe Whitelist wie lib/zoe/crm-vorschlag.ts `KARTE_KONTAKT_FELDER`/`KARTE_FIRMA_FELDER`). */
export const KARTE_FELDER: readonly { id: string; label: string }[] = [
  { id: 'aufhaenger', label: 'Aufhänger (Kontakt)' }, { id: 'signale', label: 'Signale (Kontakt)' }, { id: 'marktinfo', label: 'Marktinfo (Kontakt)' },
  { id: 'recherche', label: 'Stand der Recherche (Kontakt)' }, { id: 'steckbrief', label: 'Steckbrief (Kontakt)' }, { id: 'vorgestelltDurch', label: 'Vorgestellt durch (Kontakt)' },
  { id: 'branche', label: 'Branche (Firma)' }, { id: 'branchen', label: 'Branchen (Firma)' }, { id: 'mitarbeiter', label: 'Mitarbeitende (Firma)' },
  { id: 'stadt', label: 'Stadt (Firma)' }, { id: 'webseite', label: 'Webseite (Firma)' }, { id: 'linkedin', label: 'LinkedIn (Kontakt bzw. Firma)' },
];
/** Wie die Zielfelder eines Agenten-Vorschlags heißen. */
export const ZIELFELD_NAME: Readonly<Record<(typeof VORSCHLAG_ZIELFELDER)[number], string>> = {
  'firma.branche': 'Branche', 'firma.website': 'Website', 'firma.sitz': 'Sitz', 'firma.mitarbeiter': 'Mitarbeitende', 'firma.umsatz-klasse': 'Umsatzklasse',
  'firma.beschreibung': 'Beschreibung', 'firma.linkedin': 'LinkedIn-Seite',
  'lead.schmerz': 'Schmerz', 'lead.entscheider': 'Entscheider', 'lead.budget': 'Budget', 'lead.zeitpunkt': 'Zeitpunkt', 'lead.wirkung': 'Wirkung', 'lead.alternative': 'Alternative',
};

// ── Der Katalog ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const BAUSTEIN_KATALOG: readonly KatalogEintrag[] = [
  // ── Auslöser (Startmarke) ──
  { id: 'ausloeser.ereignis', name: 'Ereignis', satz: 'Startet, wenn in MAKE OS etwas passiert — nur wenn die Bedingungen passen.', anbindung: 'Ablauf', form: 'ausloeser', kategorie: 'ausloeser', bahn: 'system', rechte: 'lesen', ki: [], feld: 'ausloeser',
    maske: [{ id: 'ereignis', label: 'Ereignis', typ: 'auswahl', quelle: 'ereignis', pflicht: true }, BEDINGUNGEN(), VERKNUEPFUNG] },
  { id: 'ausloeser.zeitplan', name: 'Zeitplan', satz: 'Startet regelmäßig zu einer festen Uhrzeit.', anbindung: 'Ablauf', form: 'ausloeser', kategorie: 'ausloeser', bahn: 'system', rechte: 'lesen', ki: [], feld: 'ausloeser',
    maske: [RHYTHMUS, { id: 'uhrzeit', label: 'Uhrzeit', typ: 'uhrzeit', pflicht: true, vorgabe: '08:00' }, { id: 'tage', label: 'Tage', typ: 'tage' }] },
  { id: 'ausloeser.datum', name: 'Datum am Fall', satz: 'Startet n Tage vor oder nach einem Datum am Fall (z. B. Kündigungsfrist) — je Fall und Stichtag einmal.', anbindung: 'Ablauf', form: 'ausloeser', kategorie: 'ausloeser', bahn: 'system', rechte: 'lesen', ki: [], feld: 'ausloeser',
    maske: [{ id: 'feld', label: 'Datum', typ: 'auswahl', quelle: 'datumsfeld', pflicht: true }, { id: 'versatzTage', label: 'Tage (negativ = vorher)', typ: 'zahl', min: -365, max: 365, pflicht: true, vorgabe: -14 },
      { id: 'werktage', label: 'Werktage zählen (Mo–Fr ohne Feiertage NRW)', typ: 'ja-nein', vorgabe: false }, { id: 'uhrzeit', label: 'Uhrzeit (ohne: 08:00)', typ: 'uhrzeit' }, BEDINGUNGEN(), VERKNUEPFUNG] },
  { id: 'ausloeser.hand', name: 'Von Hand', satz: 'Startet, wenn jemand auf „Starten“ klickt.', anbindung: 'Ablauf', form: 'ausloeser', kategorie: 'ausloeser', bahn: 'mensch', rechte: 'lesen', ki: [], feld: 'ausloeser', maske: [] },
  { id: 'ausloeser.loop', name: 'Nach einem Loop', satz: 'Startet nach dem Morgen-Loop, dem Wochen-Loop oder dem Rückblick.', anbindung: 'ZOE', form: 'ausloeser', kategorie: 'ausloeser', bahn: 'system', rechte: 'lesen', ki: [], feld: 'ausloeser',
    maske: [{ id: 'loop', label: 'Loop', typ: 'auswahl', pflicht: true, optionen: LOOP_ARTEN.map(id => ({ id, label: { morgen: 'Morgen-Loop', woche: 'Wochen-Loop', rueckblick: 'Rückblick' }[id] })) }] },
  // 24.10. (Paket Ü 2): je Person ab Uhrzeit — einmal am Tag je Person des Teams mit Konto, Business-frei ruht er und kommt danach am selben Tag.
  { id: 'ausloeser.person', name: 'Je Person ab Uhrzeit', satz: 'Startet für jede Person des Teams einmal am Tag ab einer Uhrzeit — Business-frei ruht er und kommt danach am selben Tag.', anbindung: 'Ablauf', form: 'ausloeser', kategorie: 'ausloeser', bahn: 'system', rechte: 'lesen', ki: [], feld: 'ausloeser',
    maske: [{ id: 'uhrzeit', label: 'Ab Uhrzeit', typ: 'uhrzeit', pflicht: true, vorgabe: '08:00' }, { id: 'bis', label: 'Bis (ohne: bis Mitternacht)', typ: 'uhrzeit' },
      { id: 'tage', label: 'Tage', typ: 'auswahl', pflicht: true, vorgabe: 'mo-fr', optionen: PERSON_TAGE.map(id => ({ id, label: { 'mo-fr': 'Mo–Fr (Feiertage zählen mit)', werktage: 'Werktage (ohne Feiertage NRW)', taeglich: 'täglich' }[id] })) },
      { id: 'nachMorgenlauf', label: 'Erst nach dem Morgenlauf', typ: 'ja-nein', vorgabe: false }] },
  { id: 'ausloeser.webhook', name: 'Webhook von außen', satz: 'Eigene Adresse mit eigenem Schlüssel — nimmt nur die Felder des Schemas an, alles ist fremder Text.', anbindung: 'Webhook', form: 'ausloeser', kategorie: 'ausloeser', bahn: 'system', rechte: 'lesen', ki: [], fremd: true, feld: 'ausloeser',
    maske: [{ id: 'felder', label: 'Felder', typ: 'webhook-felder' }, BEDINGUNGEN(), VERKNUEPFUNG] },

  // ── Aufgabe ──
  { id: 'aufgabe.anlegen', name: 'Aufgabe anlegen', satz: 'Legt eine Aufgabe für eine Person an — Abhaken treibt den Lauf weiter.', anbindung: 'Aufgabe', form: 'schritt', kategorie: 'aktion', bahn: 'mensch', werkzeug: 'create_task',
    maske: [TV('titel', 'Titel'), WER('Verantwortlich', true), TAGE('fristTage', 'Fällig in (Tagen)'), PRIO, TV('beschreibung', 'Beschreibung', false)] },
  { id: 'aufgabe.an-zoe', name: 'An ZOE geben', satz: 'Gibt eine Aufgabe an ZOE — sie bereitet einen Vorschlag vor, übernommen wird per Klick.', anbindung: 'ZOE', form: 'schritt', kategorie: 'aktion', bahn: 'agent', werkzeug: 'aufgabe_an_zoe',
    maske: [TV('hinweis', 'Hinweis an ZOE', false)] },
  // ── Inbox, WhatsApp (nur Entwürfe — gesendet wird erst nach der Freigabe) ──
  { id: 'inbox.mail-entwurf', name: 'Mail-Entwurf', satz: 'Bereitet eine Mail im Postfach vor — gesendet wird erst nach der Freigabe.', anbindung: 'Inbox', form: 'nachricht', kategorie: 'aktion', bahn: 'system', rechte: 'aussen', ki: ['postfach', 'crm'], ansprache: { kanal: 'mail' },
    maske: [{ id: 'postfach', label: 'Postfach', typ: 'auswahl', quelle: 'postfach', pflicht: true }, AN_FALL, TV('betreff', 'Betreff'), TV('text', 'Text')] },
  { id: 'whatsapp.entwurf', name: 'WhatsApp-Entwurf', satz: 'Bereitet eine WhatsApp-Nachricht vor — gesendet wird erst nach der Freigabe.', anbindung: 'WhatsApp', form: 'nachricht', kategorie: 'aktion', bahn: 'system', rechte: 'aussen', ki: ['crm'], ansprache: { kanal: 'whatsapp' },
    maske: [AN_FALL, { id: 'vorlage', label: 'Vorlage (außerhalb des 24-h-Fensters)', typ: 'auswahl', quelle: 'whatsapp-vorlage' }, TV('text', 'Text', false)] },
  // ── Kalender ──
  { id: 'kalender.block', name: 'Kalender-Block', satz: 'Plant einen Block im Kalender der Person ein (über den Freigabe-Stapel).', anbindung: 'Kalender', form: 'termin', kategorie: 'aktion', bahn: 'mensch', werkzeug: 'plan_block',
    maske: [TV('titel', 'Titel'), WER('Für wen', true), { id: 'dauerMin', label: 'Dauer (Minuten)', typ: 'zahl', min: 15, max: 480, pflicht: true, vorgabe: 60 }] },
  { id: 'kalender.einladung', name: 'Termin mit Einladung', satz: 'Bereitet einen Termin mit Gästen vor — die Einladung geht erst nach der Freigabe raus.', anbindung: 'Kalender', form: 'termin', kategorie: 'aktion', bahn: 'system', rechte: 'aussen', ki: ['kalender', 'crm'], ansprache: { kanal: 'einladung' },
    maske: [TV('titel', 'Titel'), { ...AN_FALL, id: 'gaeste', label: 'Gäste' }, { id: 'dauerMin', label: 'Dauer (Minuten)', typ: 'zahl', min: 15, max: 480, pflicht: true, vorgabe: 30 }] },
  // ── CRM: Kontakt, Firma, Deal, Lead, Follow-up ──
  { id: 'crm.abfragen', name: 'CRM abfragen', satz: 'Liefert eine Liste von Fällen: Leads, neue Leads, ruhende Firmen, Deals ohne nächsten Schritt, Angebote ohne Antwort.', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'system', rechte: 'lesen', ki: ['crm'], feld: 'abfrage',
    liest: 'lib/crm/leads.ts `leads` (Score, Lifecycle, BEAN) und die Kartei NUR über `kontakteFuerVerarbeitung` (Art. 18: eingeschränkte Personen fehlen ganz)',
    maske: [{ id: 'art', label: 'Was', typ: 'auswahl', pflicht: true, optionen: CRM_ABFRAGE_ARTEN.map(id => ({ id, label: ABFRAGE_NAME[id] })) },
      { id: 'status', label: 'Lead-Status', typ: 'mehrfach', optionen: LEAD_STATUS },
      { id: 'temperatur', label: 'Temperatur', typ: 'mehrfach', optionen: TEMPERATUREN.map(id => ({ id, label: id === 'heiss' ? 'heiß' : id })) },
      { id: 'bean', label: 'Kundengruppe (BEAN)', typ: 'mehrfach', optionen: [{ id: 'B', label: 'Bestand' }, { id: 'E', label: 'Ehemalig' }, { id: 'A', label: 'Angebot' }, { id: 'N', label: 'Neu' }] },
      { id: 'lifecycle', label: 'Lifecycle', typ: 'mehrfach', optionen: LIFECYCLE_WAHL.map(l => ({ id: l.id, label: l.label })) },
      TAGE('tage', 'Seit bzw. ohne Kontakt seit (Tagen)', 3650),
      { id: 'hoechstens', label: 'Höchstens', typ: 'zahl', min: 1, max: PROZESS_GRENZEN.abfrageHoechstens, pflicht: true, vorgabe: 50, hilfe: 'Mehr wird nie still gekürzt — der Lauf zeigt, wie viele übrig sind.' }] },
  { id: 'crm.outreach-aufgabe', name: 'Outreach-Aufgabe', satz: 'Legt eine Aufgabe zur Ansprache an — nur, wenn der Kanal nicht rot ist (Kanal-Ampel, Werbesperre).', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'mensch', werkzeug: 'create_task',
    ansprache: { kanalFeld: 'kanal' },
    maske: [{ id: 'kanal', label: 'Kanal', typ: 'auswahl', pflicht: true, optionen: [{ id: 'telefon', label: 'Anruf' }, { id: 'mail', label: 'Mail' }, { id: 'linkedin', label: 'LinkedIn' }] },
      TV('titel', 'Titel'), WER('Verantwortlich', true), TAGE('fristTage', 'Fällig in (Tagen)')] },
  { id: 'crm.kontakt-notiz', name: 'Notiz am Kontakt', satz: 'Hält eine Notiz am Kontakt des Falls fest.', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'system', werkzeug: 'notiere_kontakt',
    maske: [TV('text', 'Notiz')] },
  { id: 'crm.kontakt-pflegen', name: 'Kontakt pflegen', satz: 'Schlägt Änderungen an Feldern des Kontakts vor — übernommen per Klick.', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'system', werkzeug: 'crm_vorschlag', fest: { art: 'kontakt_felder' },
    maske: [{ id: 'felder', label: 'Felder', typ: 'mehrfach', pflicht: true, optionen: [{ id: 'phase', label: 'Lifecycle' }, { id: 'bean', label: 'Kundengruppe' }, { id: 'naechsterSchritt', label: 'Nächster Schritt' }, { id: 'wiedervorlage', label: 'Wiedervorlage' }] }] },
  { id: 'crm.firma-akte', name: 'Firmenakte lesen', satz: 'Liest die Firmenakte des Falls (Kennzahlen, Deals, Mandate) — nur für den nächsten Schritt.', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'system', werkzeug: 'firma_akte', maske: [] },
  { id: 'crm.deal-anlegen', name: 'Deal anlegen', satz: 'Legt einen Deal mit nächstem Schritt an (der Lead wird SQL).', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'system', werkzeug: 'chance_anlegen',
    schreibweg: 'dealAnlegen (lib/crm/deal-anlegen.ts über POST /api/crm/deal) — nächster Schritt mit Datum Pflicht, zweiter offener Deal 409',
    maske: [TV('titel', 'Titel'), TV('naechsterSchritt', 'Nächster Schritt'), TAGE('inTagen', 'Nächster Schritt in (Tagen)', 365, true)] },
  { id: 'crm.deal-stufe', name: 'Deal-Stufe ändern', satz: 'Schlägt die nächste Stufe des Deals vor — übernommen per Klick.', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'system', werkzeug: 'crm_vorschlag', fest: { art: 'deal_aendern' },
    maske: [{ id: 'stufe', label: 'Stufe', typ: 'auswahl', quelle: 'pipeline-stufe', pflicht: true }, { id: 'grund', label: 'Grund', typ: 'text', max: PROZESS_TEXT.feldText }] },
  { id: 'crm.lead-qualifizieren', name: 'Lead qualifizieren', satz: 'Schlägt den nächsten Lead-Status vor (Kernfragen, SQL) — übernommen per Klick.', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'system', werkzeug: 'crm_vorschlag', fest: { art: 'qualifizierung' },
    maske: [{ id: 'status', label: 'Status', typ: 'auswahl', pflicht: true, optionen: LEAD_STATUS.filter(x => x.id !== 'neu' && x.id !== 'kunde') }] },
  { id: 'crm.followup', name: 'Follow-up', satz: 'Schlägt ein Follow-up mit Datum vor — übernommen per Klick.', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'system', werkzeug: 'crm_vorschlag', fest: { art: 'followup' },
    maske: [TV('text', 'Was'), TAGE('inTagen', 'In (Tagen)', 365, true), WER('Zuständig')] },
  { id: 'crm.uebergeben', name: 'Übergeben', satz: 'Übergibt den Fall an eine andere Person — mit Aufgabe und Verlauf.', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'mensch', werkzeug: 'uebergeben',
    maske: [WER('An', true), TV('notiz', 'Notiz', false)] },
  // ── Angebot, Rechnung ──
  { id: 'angebot.entwurf', name: 'Angebots-Entwurf', satz: 'Bereitet einen Angebots-Entwurf vor — nie gestellt, übernommen per Klick.', anbindung: 'Angebot', form: 'schritt', kategorie: 'aktion', bahn: 'system', werkzeug: 'crm_vorschlag', fest: { art: 'angebot_entwurf' },
    maske: [FIRMA_GESELLSCHAFT] },
  { id: 'angebot.stellen', name: 'Angebot stellen', satz: 'Schreibt das Angebot fest und schickt es dem Kunden — erst nach der Freigabe.', anbindung: 'Angebot', form: 'nachricht', kategorie: 'aktion', bahn: 'system', rechte: 'aussen', ki: ['crm', 'finanzen'], ansprache: { kanal: 'mail' },
    maske: [AN_FALL] },
  { id: 'rechnung.erfassen', name: 'Rechnung erfassen', satz: 'Erfasst eine Rechnung zur Gesellschaft — erst nach der Freigabe.', anbindung: 'Rechnung', form: 'schritt', kategorie: 'aktion', bahn: 'system', werkzeug: 'erfasse_rechnung',
    maske: [FIRMA_GESELLSCHAFT, TV('beschreibung', 'Leistung')] },
  // ── Glocke, Telegram (nur intern bzw. neutral an die eigene Person) ──
  { id: 'glocke.melden', name: 'Glocke', satz: 'Meldet etwas in der Glocke einer Person (nur intern).', anbindung: 'Glocke', form: 'nachricht', kategorie: 'aktion', bahn: 'system', rechte: 'intern', ki: [],
    maske: [WER('An', true), TV('text', 'Text')] },
  { id: 'telegram.hinweis', name: 'Telegram-Hinweis', satz: 'Schickt einen neutralen Hinweis mit Link an die eigene Person — nie Inhalte.', anbindung: 'Telegram', form: 'nachricht', kategorie: 'aktion', bahn: 'system', rechte: 'intern', ki: [],
    maske: [{ id: 'an', label: 'An', typ: 'auswahl', quelle: 'konto-person', pflicht: true }, { id: 'hinweis', label: 'Hinweis', typ: 'auswahl', pflicht: true, optionen: TELEGRAM_HINWEISE }] },
  // ── Löschen ──
  { id: 'loeschen.papierkorb', name: 'In den Papierkorb', satz: 'Legt einen Eintrag des Falls in den Papierkorb — erst nach der Freigabe.', anbindung: 'Ablauf', form: 'schritt', kategorie: 'aktion', bahn: 'system', rechte: 'loeschen', ki: [],
    maske: [{ id: 'ziel', label: 'Was', typ: 'auswahl', pflicht: true, optionen: [{ id: 'aufgabe', label: 'Aufgabe des Laufs' }, { id: 'followup', label: 'Follow-up des Laufs' }, { id: 'entwurf', label: 'Entwurf des Laufs' }] }] },
  // ── Erinnerung (wie im Fulfillment: Runden auf dem Nein-Pfad) ──
  { id: 'erinnerung.runde', name: 'Erinnerung', satz: 'Erinnert und fragt danach wieder — höchstens so viele Runden.', anbindung: 'Ablauf', form: 'erinnerung', kategorie: 'aktion', bahn: 'mensch', rechte: 'intern', ki: [],
    maske: [{ id: 'versuche', label: 'Höchstens (Runden)', typ: 'zahl', min: 1, max: 20, vorgabe: 5 }, TAGE('fristTage', 'Abstand (Tage)', 90)] },

  // ── Entscheidung, Freigabe ──
  { id: 'entscheidung.mensch', name: 'Entscheidung (Mensch)', satz: 'Eine Person entscheidet ja oder nein.', anbindung: 'Ablauf', form: 'entscheidung', kategorie: 'entscheidung', bahn: 'mensch', rechte: 'intern', ki: [],
    // 22.10.: die Frist der Entscheidung (Vorlagen „entscheiden in n Tagen“) — vorher nur am Knoten, ohne Eingabe; ohne Wert gilt die Freigabe-Frist des Laufs.
    maske: [{ id: 'frage', label: 'Frage', typ: 'text', pflicht: true, max: PROZESS_TEXT.frage }, WER('Wer entscheidet', true), TAGE('fristTage', 'Entscheiden binnen (Tagen)', 90)] },
  { id: 'entscheidung.regel', name: 'Entscheidung (Regel)', satz: 'Entscheidet nach Feldern: passt es, geht es über „ja“, sonst über „nein“.', anbindung: 'Ablauf', form: 'entscheidung', kategorie: 'entscheidung', bahn: 'system', rechte: 'lesen', ki: [], feld: 'raute',
    maske: [BEDINGUNGEN(true), VERKNUEPFUNG] },
  { id: 'entscheidung.score', name: 'Entscheidung (Score)', satz: 'Lead-Score ≥ Schwelle, Temperatur, SQL-bereit oder MQL — aus der Scoring-Rechnung, nie gespeichert.', anbindung: 'CRM', form: 'entscheidung', kategorie: 'entscheidung', bahn: 'system', rechte: 'lesen', ki: [], feld: 'raute',
    liest: 'lib/crm/score.ts `leadScore` mit `scoringKontext` bzw. lib/crm/leads.ts `salesBereit`/`mqlErreicht` (der Score bleibt abgeleitet)',
    maske: [{ id: 'pruefung', label: 'Prüfung', typ: 'auswahl', pflicht: true, optionen: SCORE_PRUEFUNGEN.map(id => ({ id, label: { score: 'Lead-Score ≥ Schwelle', temperatur: 'Temperatur ist …', 'sql-bereit': 'SQL-bereit', mql: 'MQL erreicht' }[id] })) },
      { id: 'schwelle', label: 'Schwelle (0–100)', typ: 'zahl', min: 0, max: 100 },
      { id: 'temperatur', label: 'Temperatur', typ: 'mehrfach', optionen: TEMPERATUREN.map(id => ({ id, label: id === 'heiss' ? 'heiß' : id })) }] },
  { id: 'entscheidung.modell', name: 'Entscheidung (Modell)', satz: 'Ein Modell ordnet ein — eigens markiert, mit Budget und Pflichtsatz.', anbindung: 'ZOE', form: 'entscheidung', kategorie: 'entscheidung', bahn: 'agent', rechte: 'lesen', ki: ['allgemein'], modellRaute: true, feld: 'raute',
    maske: [{ id: 'frage', label: 'Frage an das Modell', typ: 'langtext', pflicht: true, max: PROZESS_TEXT.frage }, WARUM, STUFE(), MODELL, BUDGET] },
  { id: 'freigabe.stapel', name: 'Freigabe', satz: 'Wartet auf die Freigabe einer Person im Stapel: freigegeben, abgelehnt, abgelaufen.', anbindung: 'ZOE', form: 'freigabe', kategorie: 'entscheidung', bahn: 'mensch', rechte: 'vorschlag', ki: [],
    maske: [WER('Wer gibt frei'), TAGE('fristTage', 'Frist (Tage)', 30)] },

  // ── Warten ──
  { id: 'warten.dauer', name: 'Warten (Dauer)', satz: 'Wartet eine feste Zeit.', anbindung: 'Ablauf', form: 'warten', kategorie: 'warten', bahn: 'system', rechte: 'lesen', ki: [], feld: 'warten',
    maske: [{ id: 'tage', label: 'Tage', typ: 'zahl', min: 0, max: PROZESS_GRENZEN.wartenTageMax, pflicht: true, vorgabe: 3 }, { id: 'stunden', label: 'Stunden', typ: 'zahl', min: 0, max: 23 },
      { id: 'arbeitszeit', label: 'Arbeitszeit zählen (Werktage, 9–18 Uhr)', typ: 'ja-nein', vorgabe: false }] },
  { id: 'warten.datum', name: 'Warten bis Datum', satz: 'Wartet bis zu einem Datum am Fall — höchstens n Tage.', anbindung: 'Ablauf', form: 'warten', kategorie: 'warten', bahn: 'system', rechte: 'lesen', ki: [], feld: 'warten',
    maske: [{ id: 'feld', label: 'Datum', typ: 'auswahl', quelle: 'datumsfeld', pflicht: true }, { id: 'versatzTage', label: 'Tage (negativ = vorher)', typ: 'zahl', min: -365, max: 365 },
      { id: 'werktage', label: 'Werktage zählen (Mo–Fr ohne Feiertage NRW)', typ: 'ja-nein', vorgabe: false }, HOECHSTENS()] },
  { id: 'warten.ereignis', name: 'Warten auf Ereignis', satz: 'Wartet, bis ein Ereignis zum Fall passiert — höchstens n Tage.', anbindung: 'Ablauf', form: 'warten', kategorie: 'warten', bahn: 'system', rechte: 'lesen', ki: [], feld: 'warten',
    maske: [{ id: 'ereignis', label: 'Ereignis', typ: 'auswahl', quelle: 'ereignis', pflicht: true }, BEDINGUNGEN(), VERKNUEPFUNG, HOECHSTENS(false),
      { id: 'hoechstensStunden', label: 'Höchstens (Stunden)', typ: 'zahl', min: 1, max: PROZESS_GRENZEN.wartenStundenMax, hilfe: 'Statt Tagen — z. B. „Antwort binnen 4 Stunden“.' },
      { id: 'arbeitszeit', label: 'Arbeitszeit zählen (Werktage, 9–18 Uhr)', typ: 'ja-nein', vorgabe: false }] },

  // ── Agenten (ZOE, Heads, Skills) ──
  { id: 'agent.zoe', name: 'ZOE', satz: 'ZOE arbeitet einen Schritt ab — mit Vertrag, Budget und Rechte-Profil.', anbindung: 'ZOE', form: 'agent', kategorie: 'agent', bahn: 'agent', agent: true, feld: 'agent',
    maske: [{ id: 'auftrag', label: 'Auftrag', typ: 'langtext', pflicht: true, max: PROZESS_TEXT.auftrag }, STUFE(), MODELL, BUDGET, WARUM,
      { id: 'werkzeuge', label: 'Werkzeuge', typ: 'mehrfach', quelle: 'werkzeug' }, { id: 'brain', label: 'Gedächtnis: Brain', typ: 'ja-nein', vorgabe: false }, { id: 'akte', label: 'Gedächtnis: Akte des Falls', typ: 'ja-nein', vorgabe: true },
      { id: 'eingabe', label: 'Eingabe (Vertrag)', typ: 'vertrag' }, { id: 'ausgabe', label: 'Ausgabe (Vertrag)', typ: 'vertrag' }] },
  { id: 'agent.head', name: 'Head', satz: 'Ein Head (Sales, Marketing, Finance …) arbeitet einen Schritt ab — mit seinen Werkzeugen.', anbindung: 'Heads', form: 'agent', kategorie: 'agent', bahn: 'agent', agent: true, feld: 'agent',
    maske: [{ id: 'headId', label: 'Head', typ: 'auswahl', quelle: 'head', pflicht: true }, { id: 'auftrag', label: 'Auftrag', typ: 'langtext', pflicht: true, max: PROZESS_TEXT.auftrag }, STUFE(), MODELL, BUDGET, WARUM,
      { id: 'werkzeuge', label: 'Werkzeuge', typ: 'mehrfach', quelle: 'werkzeug' }, { id: 'brain', label: 'Gedächtnis: Brain', typ: 'ja-nein', vorgabe: false }, { id: 'akte', label: 'Gedächtnis: Akte des Falls', typ: 'ja-nein', vorgabe: true },
      { id: 'eingabe', label: 'Eingabe (Vertrag)', typ: 'vertrag' }, { id: 'ausgabe', label: 'Ausgabe (Vertrag)', typ: 'vertrag' }] },
  { id: 'agent.skill', name: 'Skill', satz: 'Ein Skill eines Heads läuft als Schritt — mit seinen Werkzeugen und Tests.', anbindung: 'Skills', form: 'agent', kategorie: 'agent', bahn: 'agent', agent: true, feld: 'agent',
    maske: [{ id: 'skillId', label: 'Skill', typ: 'auswahl', quelle: 'skill', pflicht: true }, { id: 'auftrag', label: 'Auftrag', typ: 'langtext', pflicht: true, max: PROZESS_TEXT.auftrag }, STUFE('schnell'), MODELL, BUDGET, WARUM,
      { id: 'brain', label: 'Gedächtnis: Brain', typ: 'ja-nein', vorgabe: false }, { id: 'akte', label: 'Gedächtnis: Akte des Falls', typ: 'ja-nein', vorgabe: true },
      { id: 'eingabe', label: 'Eingabe (Vertrag)', typ: 'vertrag' }, { id: 'ausgabe', label: 'Ausgabe (Vertrag)', typ: 'vertrag' }] },

  { id: 'agent.research', name: 'Research-Agent', satz: 'Reichert den Fall aus dem Web an — das Ergebnis ist IMMER ein Vorschlag (fremder Text), übernommen per Häkchen je Feld.', anbindung: 'Fach-Agenten', form: 'agent', kategorie: 'agent', bahn: 'agent', agent: true, feld: 'agent',
    agentFest: { wer: { art: 'fach', agentId: 'research' }, ergebnis: 'vorschlag' },
    maske: [{ id: 'auftrag', label: 'Auftrag', typ: 'langtext', pflicht: true, max: PROZESS_TEXT.auftrag }, STUFE('schnell'), MODELL, BUDGET, WARUM,
      { id: 'vorschlagFelder', label: 'Felder des Vorschlags', typ: 'mehrfach', pflicht: true, optionen: VORSCHLAG_ZIELFELDER.map(id => ({ id, label: ZIELFELD_NAME[id] })) },
      { id: 'uebernahme', label: 'Übernahme', typ: 'auswahl', optionen: [{ id: 'je-feld', label: 'Häkchen je Feld' }, { id: 'sammel', label: 'Sammelfreigabe' }], vorgabe: 'je-feld' },
      // Entscheidung 22.10. nachts („Nur öffentliche Angaben“): Vorgabe AN — dann liest die Recherche nur Firmenname, Website und Branche, kein Extra-Klick dahinter.
      NUR_OEFFENTLICH,
      { id: 'akte', label: 'Gedächtnis: Akte des Falls', typ: 'ja-nein', vorgabe: true, hilfe: 'Liest der Agent die Akte des Falls mit (Notizen, Aktivitäten, Personen)? Bei „Nur öffentliche Angaben“ bleibt sie immer aus.' }] },

  // ── Teilprozess, Schleife ──
  { id: 'teilprozess.aufruf', name: 'Teilprozess', satz: 'Ruft einen veröffentlichten Prozess mit festen Ein- und Ausgaben auf.', anbindung: 'Ablauf', form: 'teilprozess', kategorie: 'teilprozess', bahn: 'system', rechte: 'lesen', ki: [], feld: 'teilprozess',
    maske: [{ id: 'prozessId', label: 'Prozess', typ: 'auswahl', quelle: 'prozess', pflicht: true }] },
  { id: 'teilprozess.starten', name: 'Prozess starten', satz: 'Startet einen anderen veröffentlichten Prozess für diesen Fall — ohne auf ihn zu warten.', anbindung: 'Ablauf', form: 'teilprozess', kategorie: 'teilprozess', bahn: 'system', rechte: 'lesen', ki: [], feld: 'teilprozess',
    maske: [{ id: 'prozessId', label: 'Prozess', typ: 'auswahl', quelle: 'prozess', pflicht: true }, { id: 'warten', label: 'Auf das Ergebnis warten', typ: 'ja-nein', vorgabe: false }] },
  { id: 'lauf.erneut-ab', name: 'Erneut ab Schritt', satz: 'Geht im Lauf zurück zu einem früheren Schritt — höchstens n-mal, danach weiter.', anbindung: 'Ablauf', form: 'schritt', kategorie: 'teilprozess', bahn: 'system', rechte: 'lesen', ki: [], feld: 'erneut',
    maske: [{ id: 'ab', label: 'Ab Schritt', typ: 'auswahl', quelle: 'schritt', pflicht: true }, { id: 'hoechstens', label: 'Höchstens (mal)', typ: 'zahl', min: 1, max: PROZESS_GRENZEN.erneutHoechstens, pflicht: true, vorgabe: 1 }] },
  { id: 'schleife.je-eintrag', name: 'Schleife', satz: 'Ruft je Eintrag einer Liste einen Teilprozess auf — mit harter Obergrenze.', anbindung: 'Ablauf', form: 'schleife', kategorie: 'teilprozess', bahn: 'system', rechte: 'lesen', ki: [], feld: 'schleife',
    maske: [{ id: 'liste', label: 'Liste', typ: 'auswahl', quelle: 'liste', pflicht: true }, { id: 'prozessId', label: 'Teilprozess (je Fall)', typ: 'auswahl', quelle: 'prozess', pflicht: true },
      { id: 'hoechstens', label: 'Höchstens je Lauf', typ: 'zahl', min: 1, max: PROZESS_GRENZEN.schleifeHoechstens, pflicht: true, vorgabe: 50, hilfe: 'Der Rest wird nie still gekürzt — er bleibt mit Hinweis für den nächsten Lauf.' }] },

  // ── Kundengewinnung (22.10., N3–N10 aus research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md › 5.2) — nur über VORHANDENE Schreibwege; alles, was eine Person
  //    anspricht, prüft die Kanal-Ampel (`ansprache`), Art. 18 und Werbesperre prüft der Vorschlag (lib/zoe/crm-vorschlag.ts). Nichts geht nach außen. ──
  { id: 'crm.entwurf-text', name: 'Text-Entwurf', satz: 'Bereitet einen Text zum Kopieren vor — LinkedIn-Nachricht, Anruf-Leitfaden, Intro, Danke, Einladung. Versendet wird nichts.', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'system', werkzeug: 'crm_vorschlag',
    ansprache: { kanalFeld: 'kanal' }, schreibweg: 'crm_vorschlag (Arten nachricht_entwurf · anruf_leitfaden · einladung_entwurf · danke_entwurf — NUR_TEXT, lib/zoe/crm-vorschlag.ts)',
    maske: [{ id: 'art', label: 'Was', typ: 'auswahl', pflicht: true, optionen: [{ id: 'nachricht_entwurf', label: 'Nachricht (LinkedIn bzw. Mail)' }, { id: 'anruf_leitfaden', label: 'Anruf-Leitfaden' }, { id: 'einladung_entwurf', label: 'Einladung' }, { id: 'danke_entwurf', label: 'Danke-Nachricht' }] },
      { id: 'kanal', label: 'Kanal', typ: 'auswahl', pflicht: true, optionen: [{ id: 'linkedin', label: 'LinkedIn' }, { id: 'mail', label: 'Mail' }, { id: 'telefon', label: 'Telefon' }, { id: 'einladung', label: 'Einladung' }] },
      TV('text', 'Text bzw. Gerüst', false, 'Ohne Text baut der Lauf ein Gerüst aus dem Fall (Anrede, Anlass, nächster Schritt, offene Kernfragen) — immer nur als Vorschlag.'), { id: 'anlass', label: 'Anlass (Pflicht bei gelbem Telefon)', typ: 'text', max: PROZESS_TEXT.feldText }] },
  { id: 'crm.karte-ergaenzen', name: 'Karte ergänzen', satz: 'Bringt ein Ergebnis aus Recherche oder Agent in die Akte — als Vorschlag mit Häkchen je Feld, Quelle als Beleg.', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'system', werkzeug: 'crm_vorschlag',
    schreibweg: 'crm_vorschlag (Art kontakt_felder bzw. firma_felder — Whitelist, Art. 18 und Werbesperre geprüft)',
    maske: [{ id: 'ziel', label: 'Wo', typ: 'auswahl', pflicht: true, vorgabe: 'firma', optionen: [{ id: 'firma', label: 'Firma des Falls' }, { id: 'kontakt', label: 'Kontakt des Falls' }] },
      { id: 'felder', label: 'Felder', typ: 'mehrfach', pflicht: true, optionen: KARTE_FELDER },
      { id: 'uebernahme', label: 'Übernahme', typ: 'auswahl', vorgabe: 'je-feld', optionen: [{ id: 'je-feld', label: 'Häkchen je Feld' }, { id: 'sammel', label: 'Sammelfreigabe (nur Stammdaten)' }] }] },
  { id: 'crm.lead-parken', name: 'Lead parken', satz: 'Schlägt vor, den Lead mit Wiedervorlage zu parken — übernommen per Klick, dann kommt er am Tag zurück.', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'system', werkzeug: 'crm_vorschlag', fest: { art: 'lead_parken' },
    schreibweg: 'crm_vorschlag Art lead_parken → lib/crm/lead-parken-server.ts `leadParken` (dieselbe Regel wie „Parken“ in der Runde, mit Follow-up)',
    maske: [{ id: 'parkTage', label: 'Wiedervorlage in (Tagen)', typ: 'zahl', min: 1, max: 365, pflicht: true, vorgabe: 90 },
      { id: 'grundArt', label: 'Warum', typ: 'auswahl', vorgabe: 'spaeter', optionen: [{ id: 'spaeter', label: 'Später — der Anlass fehlt' }, { id: 'budget_spaeter', label: 'Budget kommt später' }, { id: 'wartet', label: 'Wartet auf andere' }, { id: 'nicht_erreicht', label: 'Nicht erreicht' }, { id: 'sonstiges', label: 'Sonstiges' }] }] },
  { id: 'crm.deal-vorschlagen', name: 'Deal vorschlagen', satz: 'Schlägt einen Deal mit nächstem Schritt vor — angelegt wird erst per Klick (der Lead wird SQL, wenn die Kriterien erfüllt sind).', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'system', werkzeug: 'crm_vorschlag', fest: { art: 'deal_anlegen' },
    schreibweg: 'crm_vorschlag Art deal_anlegen → POST /api/crm/deal (dealAnlegen: nächster Schritt mit Datum Pflicht, zweiter offener Deal 409)',
    maske: [TV('titel', 'Titel', false), TV('naechsterSchritt', 'Nächster Schritt'), TAGE('inTagen', 'Nächster Schritt in (Tagen)', 365, true)] },
  { id: 'crm.deal-schritt', name: 'Nächster Schritt am Deal', satz: 'Schlägt den nächsten Schritt mit Datum am Deal vor — übernommen per Klick.', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'system', werkzeug: 'crm_vorschlag', fest: { art: 'deal_aendern' },
    maske: [TV('naechsterSchritt', 'Nächster Schritt', false, 'Ohne Text kommt er aus dem Agent-Schritt davor.'), TAGE('inTagen', 'In (Tagen)', 365, true)] },
  { id: 'crm.mandat-anlegen', name: 'Mandat anlegen', satz: 'Legt aus einem gewonnenen Deal das Mandat an — Honorar zählt in MRR und Index, darum erst nach der Freigabe (ein Klick).', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'system', rechte: 'geld', ki: ['crm', 'finanzen'],
    schreibweg: 'POST /api/crm/lead `mandat` (nur gewonnen, 409 bei vorhandenem; Vorbelegung aus dem angenommenen Angebot bzw. der Produkt-Karte) — das Freigabe-Schloss IST der Klick (Wirkung crm_vorschlag Art mandat_anlegen, lib/prozesse/bausteine-server.ts); schon da → weiter ohne Vorschlag',
    maske: [] },
  { id: 'fulfillment.fall-starten', name: 'Fall starten', satz: 'Schlägt vor, den Fulfillment-Fall des Mandats sofort zu starten (statt erst im Morgenlauf) — übernommen per Klick.', anbindung: 'Fulfillment', form: 'schritt', kategorie: 'aktion', bahn: 'system', rechte: 'vorschlag', ki: ['crm'],
    schreibweg: 'Vorschlag des Laufs (Wirkung fulfillment, lib/prozesse/bausteine-server.ts) → fallStartenServer (lib/fulfillment/prozesse/fall-server.ts) — Vorlage aus der Produkt-Karte; setzt die Marke des Morgenlaufs (ein Vorschlag je Mandat); ohne Ablauf bzw. schon gestartet → weiter',
    maske: [] },
  { id: 'event.gaeste', name: 'Gäste vorschlagen', satz: 'Schlägt eine Gästeliste in der richtigen Mischung vor — nur zulässige Einladungswege, Werbesperre nie; vorgemerkt wird per Klick.', anbindung: 'Events', form: 'schritt', kategorie: 'aktion', bahn: 'system', werkzeug: 'crm_vorschlag', fest: { art: 'gaesteliste' },
    liest: 'lib/crm/eventplanung.ts `gaesteVorschlag` und `mix` — Kartei nur über `kontakteFuerVerarbeitung`',
    maske: [{ id: 'n', label: 'Wie viele', typ: 'zahl', min: 1, max: 200, pflicht: true, vorgabe: 12 }, { id: 'mixZielkunden', label: 'Anteil Zielkunden (%)', typ: 'zahl', min: 0, max: 100, vorgabe: 40 }, { id: 'mixKunden', label: 'Anteil Kunden (%)', typ: 'zahl', min: 0, max: 100, vorgabe: 20 }] },
  { id: 'crm.kampagnen-ergebnis', name: 'Kampagnen-Ergebnis', satz: 'Hält das Ergebnis einer Person in der Kampagne fest (angesprochen, reagiert, Gespräch, Chance, kein Interesse) — „Chance“ bringt den Lead in die Qualifizierung.', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'mensch', werkzeug: 'crm_vorschlag', fest: { art: 'kampagnen_ergebnis' },
    schreibweg: 'POST /api/crm/kampagnen `ergebnis` (Art. 18 → 409)',
    maske: [{ id: 'ergebnis', label: 'Vorgabe (sonst aus dem Verlauf seit dem Start abgeleitet — ablehnen und selbst setzen geht immer)', typ: 'auswahl', optionen: [{ id: 'angesprochen', label: 'angesprochen' }, { id: 'reagiert', label: 'reagiert' }, { id: 'gespraech', label: 'Gespräch' }, { id: 'chance', label: 'Chance' }, { id: 'kein_interesse', label: 'kein Interesse' }] }] },
  { id: 'crm.anfrage-anlegen', name: 'Anfrage übernehmen', satz: 'Macht aus den Feldern eines Webhooks (z. B. Website-Formular) eine Anfrage — nur als Vorschlag, der Empfänger kommt aus der Kartei, die Uhr läuft ab Eingang.', anbindung: 'CRM', form: 'schritt', kategorie: 'aktion', bahn: 'system', werkzeug: 'crm_vorschlag', fest: { art: 'anfrage_anlegen' },
    schreibweg: 'POST /api/crm/anfrage `anlegen` (anfrageBauen: Dublette, Art. 18, Werbesperre, Einwilligung „Anfrage“, Follow-up „Anfrage beantworten“)',
    maske: [{ id: 'kanal', label: 'Kanal', typ: 'auswahl', pflicht: true, vorgabe: 'website', optionen: [{ id: 'website', label: 'Website' }, { id: 'mail', label: 'Mail' }, { id: 'linkedin', label: 'LinkedIn' }, { id: 'telefon', label: 'Telefon' }, { id: 'empfehlung', label: 'Empfehlung' }, { id: 'event', label: 'Event' }] }] },

  // ── Überführung (22.10., Paket Ü): der Kern eines alten System-Ablaufs als EIN Schritt — dieselbe Regel, dieselben Kennungen, derselbe Schreibweg wie der Code.
  //    Der Prozess steuert, wann er läuft (Auslöser, Bedingungen, Anhalten); nur im Prozess, der den System-Ablauf ersetzt (sonst hält der Lauf mit Grund). ──
  { id: 'system.fest', name: 'Fester Schritt', satz: 'Tut genau, was der alte Ablauf im Code tat — dieselbe Regel und dieselben Kennungen (überführter System-Prozess).', anbindung: 'Ablauf', form: 'schritt', kategorie: 'aktion', bahn: 'system',
    rechte: 'intern', ki: [], nurUeberfuehrung: true,
    schreibweg: 'lib/prozesse/system-schritte-server.ts `systemSchrittAusfuehren` → der Kern des alten Ablaufs (Mahnaufgaben: `mahnAufgabenKern`, Fortschritts-Report: `treppeReportsKern`, Onboarding-Vorschlag: `onboardingVorschlaegeKern`, Power Hour: `powerHourKern` je Person des Laufs) — nur Business',
    maske: [{ id: 'schritt', label: 'Was', typ: 'auswahl', pflicht: true, optionen: UEBERFUEHRBAR.map(u => ({ id: u.schritt, label: u.teil })), hilfe: 'Kommt mit der Überführung — die Regel und ihre Stellschrauben bleiben dort, wo sie heute schon stehen.' }] },

  // ── Ende ──
  { id: 'ende.ziel', name: 'Ziel erreicht', satz: 'Der Lauf endet erfolgreich.', anbindung: 'Ablauf', form: 'ende', kategorie: 'ende', bahn: 'system', rechte: 'lesen', ki: [], feld: 'ende', maske: [] },
  { id: 'ende.abbruch', name: 'Abbruch', satz: 'Der Lauf endet ohne Ziel (mit Grund im Verlauf).', anbindung: 'Ablauf', form: 'ende', kategorie: 'ende', bahn: 'system', rechte: 'lesen', ki: [], feld: 'ende', maske: [] },
  { id: 'ende.uebergabe', name: 'Übergabe', satz: 'Der Lauf endet und übergibt den Fall an einen anderen Prozess.', anbindung: 'Ablauf', form: 'ende', kategorie: 'ende', bahn: 'system', rechte: 'lesen', ki: [], feld: 'ende',
    maske: [{ id: 'uebergabeAn', label: 'An Prozess', typ: 'auswahl', quelle: 'prozess', pflicht: true }] },
];

const NACH_ID: ReadonlyMap<string, KatalogEintrag> = new Map(BAUSTEIN_KATALOG.map(e => [e.id, e]));
export const katalogEintrag = (id: string | undefined | null): KatalogEintrag | null => (id ? NACH_ID.get(id) ?? null : null);
/** Die Freigabe des Schlosses ist dieser Baustein. */
export const FREIGABE_BAUSTEIN = 'freigabe.stapel';

// ── Klasse (nie doppelt gepflegt) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Rangfolge der Klassen (für „die stärkste Klasse“ eines Agenten bzw. den Grund eines Schlosses). */
export const KLASSE_RANG: Readonly<Record<Rechteklasse, number>> = { lesen: 0, vorschlag: 1, intern: 2, geld: 3, aussen: 4, loeschen: 5 };
export const staerkste = (l: readonly Rechteklasse[]): Rechteklasse => l.reduce<Rechteklasse>((a, b) => (KLASSE_RANG[b] > KLASSE_RANG[a] ? b : a), 'lesen');

/** Klasse eines Bausteins: vom Werkzeug (`EINORDNUNG`), sonst die eigene Angabe; Agenten-Bausteine: null (aus dem Rechte-Profil). */
export function klasseVonEintrag(e: KatalogEintrag): Rechteklasse | null {
  if (e.agent) return null;
  if (e.werkzeug) return EINORDNUNG[e.werkzeug]?.rechte ?? null;
  return e.rechte ?? null;
}
/** Klasse eines Knotens ohne Katalog-Bezug (z. B. alte Formen aus dem Fulfillment-Editor) — aus der Form. */
export const FORM_KLASSE: Readonly<Record<ProzessForm, Rechteklasse>> = {
  schritt: 'intern', nachricht: 'aussen', entscheidung: 'intern', erinnerung: 'intern', termin: 'intern', abstimmung: 'intern',
  ausloeser: 'lesen', agent: 'lesen', warten: 'lesen', schleife: 'lesen', teilprozess: 'lesen', freigabe: 'vorschlag', ende: 'lesen',
};
/** Braucht diese Klasse ein Freigabe-Schloss? (aussen · geld · loeschen — dieselbe Menge wie der Stapel, lib/werkzeuge/vertrag.ts `IMMER_FREIGABE`). */
export const brauchtSchloss = (k: Rechteklasse | null | undefined): k is 'aussen' | 'geld' | 'loeschen' => !!k && IMMER_FREIGABE.has(k);

/**
 * KI-Kategorien eines Bausteins (rein; die Kategorie eines Werkzeugs löst der Aufrufer auf — Server: `kategorieVonWerkzeug(name, gruppeVon(name))`).
 * Ohne Werkzeug: die eigene Angabe. Agenten-Bausteine: aus dem Rechte-Profil (lib/prozesse/agent-schritt.ts).
 */
export function kategorienVonEintrag(e: KatalogEintrag, werkzeugKategorie: (name: string) => KiKategorie | null): KiKategorie[] {
  if (e.agent) return [];
  if (e.werkzeug) { const k = werkzeugKategorie(e.werkzeug); return k ? [k] : []; }
  return [...(e.ki ?? [])];
}

// ── Masken prüfen und säubern ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Was die Prüfung einer Maske vom Bestand wissen kann (alles optional — ohne Liste wird nur die Form geprüft). */
export interface MaskenKontext {
  /** Gültige Werte einer Auswahlquelle (Team-Kennungen, Stufen, Prozesse …). null = unbekannt → nur Form prüfen. */
  auswahl?: (q: AuswahlQuelle) => readonly string[] | null;
  /** Erlaubte Platzhalter in Textvorlagen (lib/prozesse/baustein-katalog.ts `platzhalterFuer`). */
  platzhalter?: readonly string[];
}
type O = Record<string, unknown>;
const UHRZEIT = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Die Werte einer Maske säubern und prüfen (rein): nur Felder der Maske (Unbekanntes fällt weg), feste Werte stehen nie darin; Typen geprüft (`fehler`),
 * fehlende Pflichtfelder bzw. nicht mehr vorhandene Auswahl-Werte sind `offen` (Entwurf ja, Veröffentlichen nein). Bausteine mit eigenem Feld
 * (`feld`) prüft dessen Regel — hier nur leer.
 */
export function maskeSaeubern(e: KatalogEintrag, roh: unknown, k: MaskenKontext = {}, knotenId?: string): { werte: Record<string, MaskenWert>; befunde: Befund[] } {
  const werte: Record<string, MaskenWert> = {};
  const befunde: Befund[] = [];
  if (e.feld) return { werte, befunde };
  const o: O = roh && typeof roh === 'object' && !Array.isArray(roh) ? roh as O : {};
  const b = (stufe: Befund['stufe'], f: MaskenFeld, text: string) => befunde.push({ stufe, text: `${e.name} › ${f.label}: ${text}`, feld: f.id, ...(knotenId ? { knotenId } : {}) });
  for (const f of e.maske) {
    const v = o[f.id];
    const leer = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
    if (leer) { if (f.pflicht) b('offen', f, 'fehlt.'); continue; }
    switch (f.typ) {
      case 'text': case 'langtext': case 'textvorlage': {
        if (typeof v !== 'string') { b('fehler', f, 'Text erwartet.'); break; }
        const max = f.max ?? (f.typ === 'text' ? PROZESS_TEXT.feldText : PROZESS_TEXT.textvorlage);
        if (v.length > max) { b('fehler', f, `höchstens ${max.toLocaleString('de-DE')} Zeichen.`); break; }
        if (f.typ === 'textvorlage') for (const x of textvorlagePruefen(v, k.platzhalter)) b('fehler', f, x);
        werte[f.id] = v;
        break;
      }
      case 'zahl': {
        const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : NaN;
        if (!Number.isFinite(n) || !Number.isInteger(n)) { b('fehler', f, 'ganze Zahl erwartet.'); break; }
        if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) { b('fehler', f, `${f.min ?? '…'} bis ${f.max ?? '…'}.`); break; }
        werte[f.id] = n;
        break;
      }
      case 'ja-nein': if (typeof v === 'boolean') werte[f.id] = v; else b('fehler', f, 'ja oder nein.'); break;
      case 'uhrzeit': if (typeof v === 'string' && UHRZEIT.test(v)) werte[f.id] = v; else b('fehler', f, '„HH:MM“.'); break;
      case 'tage': {
        if (!Array.isArray(v) || !v.every(t => Number.isInteger(t) && t >= 1 && t <= 31)) { b('fehler', f, 'Tage 1 bis 31.'); break; }
        werte[f.id] = Array.from(new Set(v as number[])).sort((x, y) => x - y);
        break;
      }
      case 'auswahl': {
        if (typeof v !== 'string') { b('fehler', f, 'eine Auswahl.'); break; }
        if (f.optionen && !f.optionen.some(x => x.id === v)) { b('fehler', f, 'unbekannter Wert.'); break; }
        const liste = f.quelle ? k.auswahl?.(f.quelle) ?? null : null;
        if (liste && !liste.includes(v)) b('offen', f, 'gibt es nicht (mehr) — bitte neu wählen.');
        werte[f.id] = v;
        break;
      }
      case 'mehrfach': {
        if (!Array.isArray(v) || !v.every(x => typeof x === 'string')) { b('fehler', f, 'Liste erwartet.'); break; }
        const l = Array.from(new Set(v as string[]));
        if (l.length > PROZESS_GRENZEN.optionen) { b('fehler', f, `höchstens ${PROZESS_GRENZEN.optionen}.`); break; }
        if (f.optionen && l.some(x => !f.optionen!.some(y => y.id === x))) { b('fehler', f, 'unbekannter Wert.'); break; }
        const liste = f.quelle ? k.auswahl?.(f.quelle) ?? null : null;
        if (liste && l.some(x => !liste.includes(x))) b('offen', f, 'nicht alles gibt es (noch).');
        werte[f.id] = l;
        break;
      }
      case 'bedingungen': case 'webhook-felder': case 'vertrag':
        b('fehler', f, 'gehört in das eigene Feld des Knotens.');
        break;
    }
  }
  return { werte, befunde };
}

/** Die Vorgaben einer Maske (für einen neuen Knoten). */
export function maskeVorgaben(e: KatalogEintrag): Record<string, MaskenWert> {
  const raus: Record<string, MaskenWert> = {};
  for (const f of e.maske) if (f.vorgabe !== undefined) raus[f.id] = f.vorgabe;
  return raus;
}

// ── Feste Formatierer und Textvorlagen (kein Nutzer-Code) ─────────────────────────────────────────────────────────────────────────────────────────

export type FormatiererId = 'datum' | 'datum-lang' | 'betrag' | 'zahl' | 'gross' | 'klein';
export const FORMATIERER: readonly { id: FormatiererId; titel: string; beispiel: string }[] = [
  { id: 'datum', titel: 'Datum', beispiel: '24.10.2026' },
  { id: 'datum-lang', titel: 'Datum mit Wochentag', beispiel: 'Samstag, 24. Oktober 2026' },
  { id: 'betrag', titel: 'Betrag (aus Cent)', beispiel: '1.234,50 €' },
  { id: 'zahl', titel: 'Zahl', beispiel: '1.234' },
  { id: 'gross', titel: 'GROSS', beispiel: 'TEXT' },
  { id: 'klein', titel: 'klein', beispiel: 'text' },
];
const FORMATIERER_IDS = new Set<string>(FORMATIERER.map(f => f.id));
const TAG = /^(\d{4})-(\d{2})-(\d{2})/;
/** Einen Wert formatieren (rein, deutsch, Berliner Kalendertag aus `YYYY-MM-DD`). Unpassender Wert → als Text. */
export function formatieren(art: FormatiererId, wert: unknown): string {
  const text = wert === undefined || wert === null ? '' : String(wert);
  switch (art) {
    case 'datum': { const m = TAG.exec(text); return m ? `${m[3]}.${m[2]}.${m[1]}` : text; }
    case 'datum-lang': {
      const m = TAG.exec(text);
      if (!m) return text;
      const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
      return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
    }
    case 'betrag': { const n = typeof wert === 'number' ? wert : Number(text); return Number.isFinite(n) ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Math.round(n) / 100) : text; }
    case 'zahl': { const n = typeof wert === 'number' ? wert : Number(text); return Number.isFinite(n) ? new Intl.NumberFormat('de-DE').format(n) : text; }
    case 'gross': return text.toLocaleUpperCase('de-DE');
    case 'klein': return text.toLocaleLowerCase('de-DE');
  }
}

/** Platzhalter `{{feld}}` bzw. `{{feld|formatierer}}` — nur Kennungen, kein Ausdruck. */
const PLATZHALTER = /\{\{\s*([a-z][a-z0-9_.-]{0,59})\s*(?:\|\s*([a-z-]{1,20})\s*)?\}\}/g;
const KLAMMERN = /\{\{|\}\}/;

/** Platzhalter, die eine Textvorlage je Fall-Art nennen darf (Daten des Falls und des Laufs — der Motor füllt sie). */
export const PLATZHALTER_JE_FALL: Readonly<Record<FallArt, readonly string[]>> = {
  // `kontakt.gruss` (22.10.): die Grußzeile nach Du/Sie aus der Akte („Guten Tag Vorname Nachname“ / „Hallo Vorname“) — `kontakt.anrede` ist nur Sie/Du, nie Frau/Herr.
  lead: ['kontakt.anrede', 'kontakt.vorname', 'kontakt.nachname', 'kontakt.gruss', 'firma.name', 'lead.status'],
  deal: ['kontakt.anrede', 'kontakt.vorname', 'kontakt.nachname', 'kontakt.gruss', 'firma.name', 'deal.titel', 'deal.stufe', 'deal.naechster-schritt'],
  // Kunden-Begleitung (22.10., B2): Grußzeile nach Du/Sie aus der Akte, aktuelle Etappe und nächster Termin des Fulfillment-Falls.
  mandat: ['kontakt.anrede', 'kontakt.vorname', 'kontakt.nachname', 'kontakt.gruss', 'firma.name', 'mandat.titel', 'mandat.start', 'mandat.produkt', 'kunde.gruss', 'fall.phase', 'fall.termin'],
  event: ['kontakt.anrede', 'kontakt.vorname', 'kontakt.nachname', 'kontakt.gruss', 'event.titel', 'event.datum', 'event.ort'],
  firma: ['firma.name', 'firma.branche'],
  kampagne: ['kampagne.titel'],
  keiner: [],
};
const PLATZHALTER_IMMER = ['prozess.titel', 'heute', 'lauf.start'];
/** Erlaubte Platzhalter eines Prozesses: Lauf + Fall + Felder des Webhook-Auslösers (`webhook.<id>` — fremder Text). */
export function platzhalterFuer(fall: FallArt, webhookFelder: readonly string[] = []): string[] {
  return [...PLATZHALTER_IMMER, ...PLATZHALTER_JE_FALL[fall], ...webhookFelder.map(f => `webhook.${f}`)];
}

/** Eine Textvorlage prüfen (rein): nur bekannte Platzhalter (ohne Liste: jede gültige Kennung), nur feste Formatierer, keine losen Klammern. Sätze. */
export function textvorlagePruefen(vorlage: string, erlaubt?: readonly string[]): string[] {
  const raus: string[] = [];
  const ohne = vorlage.replace(PLATZHALTER, '');
  if (KLAMMERN.test(ohne)) raus.push('ein Platzhalter ist nicht lesbar (Form: {{feld}} oder {{feld|datum}}).');
  for (const m of vorlage.matchAll(PLATZHALTER)) {
    if (erlaubt && !erlaubt.includes(m[1])) raus.push(`den Platzhalter {{${m[1]}}} gibt es hier nicht.`);
    if (m[2] && !FORMATIERER_IDS.has(m[2])) raus.push(`den Formatierer „${m[2]}“ gibt es nicht.`);
  }
  return Array.from(new Set(raus));
}

/**
 * Eine Textvorlage füllen (rein): bekannte Platzhalter aus `daten` (ggf. formatiert), fehlende Werte → leer (in `fehlend` genannt). Werte aus fremdem Text
 * bleiben fremder Text — wer das Ergebnis an ein Modell gibt, kapselt es (`fremd()`); hier wird nichts ausgeführt.
 */
export function textvorlageFuellen(vorlage: string, daten: Readonly<Record<string, unknown>>): { text: string; fehlend: string[] } {
  const fehlend = new Set<string>();
  const text = vorlage.replace(PLATZHALTER, (_g, feld: string, fmt?: string) => {
    const v = daten[feld];
    if (v === undefined || v === null || v === '') { fehlend.add(feld); return ''; }
    return fmt && FORMATIERER_IDS.has(fmt) ? formatieren(fmt as FormatiererId, v) : String(v);
  });
  return { text, fehlend: Array.from(fehlend) };
}

/** Prüft die Form der Masken im Katalog selbst (Wächter): eindeutige Kennungen, gültige Feld-Kennungen, Optionen, Grenzen. Sätze. */
export function katalogSelbstpruefung(): string[] {
  const raus: string[] = [];
  const ids = new Set<string>();
  for (const e of BAUSTEIN_KATALOG) {
    if (ids.has(e.id)) raus.push(`${e.id}: doppelt`);
    ids.add(e.id);
    if (!/^[a-z]+\.[a-z0-9-]+$/.test(e.id)) raus.push(`${e.id}: Kennung`);
    const quellen = [e.werkzeug ? 'werkzeug' : null, e.rechte ? 'rechte' : null, e.agent ? 'agent' : null].filter(Boolean);
    if (quellen.length !== 1) raus.push(`${e.id}: genau eine Quelle der Klasse (Werkzeug, eigene Angabe oder Agent) — jetzt ${quellen.join('+') || 'keine'}`);
    if (e.werkzeug && e.ki) raus.push(`${e.id}: KI-Kategorie kommt vom Werkzeug — nicht doppelt`);
    if (e.werkzeug && !EINORDNUNG[e.werkzeug]) raus.push(`${e.id}: Werkzeug ${e.werkzeug} gibt es nicht`);
    if (e.rechte && !e.ki) raus.push(`${e.id}: ohne Werkzeug braucht es die KI-Kategorien (auch leer)`);
    const f = new Set<string>();
    for (const m of e.maske) {
      if (!FELD_KENNUNG.test(m.id.toLowerCase()) || f.has(m.id)) raus.push(`${e.id}: Feld ${m.id}`);
      f.add(m.id);
      if ((m.typ === 'auswahl' || m.typ === 'mehrfach') && !m.optionen && !m.quelle) raus.push(`${e.id}: ${m.id} ohne Optionen/Quelle`);
      if (m.optionen && m.quelle) raus.push(`${e.id}: ${m.id} mit Optionen UND Quelle`);
    }
  }
  return raus;
}
