// ─── MAKE OS — CRM: die Regeln hinter der Kundenansprache ───────────────────
// Kevins Ansage vom 18.09.: „Lass uns das CRM System bauen damit wir Kunden
// ansprechen können." Das Wort ist ANSPRECHEN. Ein CRM, das nur Kontakte
// verwaltet, ist eine Adressliste. Dieses hier beantwortet jeden Morgen eine
// Frage: Wer ist heute dran, und warum?
//
// Quelle ist Kevins fertig angereicherte Masterliste (443 Kontakte, 40
// Spalten, Stand 28.08.). Sie wird IMPORTIERT, nicht gespiegelt: die Felder
// aus der Liste kommen herein, die Pipeline (Stufe, Wiedervorlage,
// Aktivitäten) lebt nur hier. Ein erneuter Import frischt die Stammdaten auf
// und rührt die Pipeline nicht an — sonst würde jeder Abgleich mit der
// Excel-Datei die Arbeit einer Woche löschen.
//
// Alles hier ist reine Logik in einer .ts-Datei, damit vitest es prüfen kann.
// Nichts sendet. Versand bleibt bei Kevin — das ist eiserne Regel 3.

import { leadSaeubern } from '@/lib/crm/lead-form';
import { netzwerkSaeubern, netzwerkVereinen } from '@/lib/crm/netzwerk-form';
import { zahlungSaeubern, zahlungMaskiert } from '@/lib/crm/zahlung';
import { istLifecycle, lifecycleAusListe, type LifecyclePhase } from '@/lib/crm/lifecycle';
import { istBean, type BeanId } from '@/lib/crm/bean';
import { markenSaeubern, ohneMarkierte } from '@/lib/crm/aktivitaet-marke';
import { stationenSaeubern, stationenSynchron, STATIONEN_MAX, type Station } from '@/lib/crm/stationen';
import { werteSaeubern, mehrfachSynchron, hatTyp, kategorieBeginnt, MEHRFACH_MAX } from '@/lib/crm/mehrfach';
import { emailsSaeubern, emailsSynchron, alleAdressen, adresseAnhaengen, hatAdresse, EMAILS_MAX, type EmailAdresse } from '@/lib/crm/emails';
import { einwilligungSaeubern } from '@/lib/crm/einwilligung';
import { neueKontaktKennung } from '@/lib/kennung';
import { einschraenkungSaeubern } from '@/lib/crm/einschraenkung';
import { geburtstagSaeubern } from '@/lib/kalender/geburtstag';
import { TEAM as CRM_TEAM, BEIDE as CRM_BEIDE } from '@/lib/crm/team-liste';

export const STUFEN = [
  'neu', 'ansprechen', 'angesprochen', 'gespraech', 'termin', 'angebot',
  'gewonnen', 'verloren', 'ruht',
] as const;
export type Stufe = typeof STUFEN[number];

export const STUFE_LABEL: Record<Stufe, string> = {
  neu: 'Neu', ansprechen: 'Ansprechen', angesprochen: 'Angesprochen', gespraech: 'Im Gespräch',
  termin: 'Termin', angebot: 'Angebot', gewonnen: 'Gewonnen', verloren: 'Verloren', ruht: 'Ruht',
};

/** Stufen, in denen ein Kontakt für die Tagesliste nicht mehr in Frage kommt. */
export const ABGESCHLOSSEN: readonly Stufe[] = ['gewonnen', 'verloren', 'ruht'];

/**
 * `whatsapp` (07.10. abends): eine GESENDETE WhatsApp-Nachricht über die Business-Nummer — wie `linkedin` eine Nachricht auf einem eigenen
 * Kanal (Ansprache, Kategorie „E-Mails & Nachrichten“). Eingehende WhatsApp bleiben `antwort` (kanal-neutral „Antwort erhalten“, Text
 * „WhatsApp erhalten“) — wie bei LinkedIn. Der alte Stand kennt die Art nicht (Rückweg: UPDATES.md 07.10.).
 */
export type AktivitaetArt = 'mail' | 'linkedin' | 'anruf' | 'antwort' | 'termin' | 'notiz' | 'stufe' | 'gespraech' | 'event' | 'system' | 'uebergabe' | 'whatsapp';
export const AKTIVITAET_ARTEN: readonly AktivitaetArt[] = ['mail', 'linkedin', 'anruf', 'antwort', 'termin', 'notiz', 'stufe', 'gespraech', 'event', 'system', 'uebergabe', 'whatsapp'];

/** Ergebnis eines Anrufs oder Gesprächsversuchs (Power Hour). */
export type Ergebnis = 'gespraech' | 'termin' | 'mailbox' | 'nicht_erreicht' | 'rueckruf' | 'kein_bedarf' | 'sperre';
export const ERGEBNISSE: readonly Ergebnis[] = ['gespraech', 'termin', 'mailbox', 'nicht_erreicht', 'rueckruf', 'kein_bedarf', 'sperre'];

/** Die Notizvorlage (24.09.): was nach jedem echten Gespräch festgehalten wird. */
export interface NotizVorlage { anlass?: string; erkenntnisse?: string; bedarf?: string; signale?: string; zusage?: string; naechster?: string }
export const NOTIZ_FELDER: { id: keyof NotizVorlage; label: string }[] = [
  { id: 'anlass', label: 'Anlass' }, { id: 'erkenntnisse', label: 'Erkenntnisse' }, { id: 'bedarf', label: 'Bedarf / Schmerz' },
  { id: 'signale', label: 'Signale' }, { id: 'zusage', label: 'Unsere Zusage' }, { id: 'naechster', label: 'Nächster Schritt' },
];

export interface Aktivitaet {
  am: string;
  art: AktivitaetArt;
  text?: string;
  von: string;
  ergebnis?: Ergebnis;
  notiz?: NotizVorlage;
  /** Bezug: Chance, Mandat oder Event. */
  bezug?: string;
  /**
   * Wann es stattfindet bzw. stattfand (28.09., H4) — EIN Format (30.09., K3, Datenregel KALENDER_VERBINDUNGEN.md 4d):
   * Berliner Wandzeit `YYYY-MM-DD` oder `YYYY-MM-DDTHH:MM`, nie mit Zone (`wannSaeubern` rechnet ISO mit Zone beim
   * Speichern um). `am` bleibt, wann es festgehalten wurde. Altbestand ohne `wann` trägt das Datum in der ersten
   * Textzeile (`meetingAusText`). Ein Meeting mit `terminUid` hat KEIN `wann` — seine Zeit steht nur im Termin.
   */
  wann?: string;
  /**
   * Der Kalendertermin dieses Meetings (30.09., K3): Schlüssel `uid` bzw. `uid::RECURRENCE-ID` (ein Vorkommen). Eine
   * Aktivität je Termin/Vorkommen; Zeit, Ort und Titel liest die Akte über diesen Verweis aus dem Termin (verschiebt
   * sich der Termin, zeigt die Aktivität die neue Zeit). Angelegt nur in lib/crm/termin-aktivitaet.ts.
   */
  terminUid?: string;
  /** Ort oder Videolink eines Meetings (28.09., H4). */
  ort?: string;
  /**
   * Gmail (03.10.): Link in die Inbox zur Mail dieses Eintrags (`/os/inbox?offen=gmail-<Nachrichten-Kennung>`) — der Verlauf trägt
   * nur Betreff + diesen Link, nie den Text. Nur der Server setzt ihn (lib/gmail/zuordnung.ts); die Mail liegt im Spiegel der
   * Person, die sie hat — andere sehen den Eintrag, nicht die Mail.
   */
  mailLink?: string;
  /**
   * Konkreter Anlass eines Anrufs bei gelber Telefon-Ampel (28.09., U2 #58) — mutmaßliche Einwilligung
   * (§ 7 Abs. 2 Nr. 1 UWG) trägt nur mit Anlass aus der Beziehung; ohne ihn lehnt die Route ab.
   */
  anlass?: string;
  /** Wann der Text zuletzt geändert wurde (eigene Notiz bearbeiten, 28.09.) — ISO. */
  bearbeitet?: string;
  /**
   * Die Firma der Person zum Zeitpunkt der Aktivität (28.09., Stationen) — damit die Zeitlinie einer Firma
   * ihre Aktivitäten behält, auch wenn die Person weitergezogen ist. Altbestand ohne: über die Station (von/bis).
   */
  firmaId?: string;
  /**
   * Kennung des ZOE-Vorschlags (`v-…`, 29.09.), aus dem die Aktivität übernommen wurde — eine zweite Freigabe
   * desselben Vorschlags legt nichts doppelt an (app/api/crm/aktivitaet `vorschlagId`).
   */
  vorschlagId?: string;
  /**
   * Die Aufgabe, aus der diese Aktivität stammt (08.10., Woche 1 · 4.7): eine erledigte Aufgabe mit Kontakt-Bezug hinterlässt genau EINE
   * Aktivität am Kontakt (idempotent über diese Kennung) — ebenso die Power-Hour-Karte einer Aufgabe. Nur der Server setzt sie.
   */
  aufgabeId?: string;
  /**
   * Herkunft (29.09., Paket D-B #94): `zoe` = ZOE hat den Eintrag vorbereitet, eine Person hat ihn im Stapel freigegeben
   * (`freigegebenVon`). `von` bleibt die Person, in deren Auftrag gearbeitet wurde — so sieht niemand eine ZOE-Notiz
   * für Kevins eigene Eingabe an. Fehlt = von Hand.
   */
  quelle?: 'zoe';
  freigegebenVon?: string;
}

/** Beziehungskreis A–D: bestimmt den Takt, in dem man sich meldet (Dunbar-Schichten). */
export type Kreis = 'A' | 'B' | 'C' | 'D';
export const KREIS_TAKT: Record<Kreis, number> = { A: 30, B: 60, C: 90, D: 180 };
export type Lebensphase = 'kontakt' | 'interessent' | 'kunde' | 'ex_kunde' | 'partner' | 'multiplikator';
export const LEBENSPHASEN: readonly Lebensphase[] = ['kontakt', 'interessent', 'kunde', 'ex_kunde', 'partner', 'multiplikator'];
/** Rollen (26.09., Kevin: „immer alles mehrfach klickbar — er kann Kunde, Multiplikator und Partner sein“): beliebig viele je Person, unabhängig von der Lebensphase. */
export type Rolle = 'partner' | 'multiplikator' | 'dienstleister' | 'investor' | 'netzwerk' | 'freund';
export const ROLLEN: readonly Rolle[] = ['partner', 'multiplikator', 'dienstleister', 'investor', 'netzwerk', 'freund'];
export const ROLLE_LABEL: Record<Rolle, string> = { partner: 'Partner', multiplikator: 'Multiplikator', dienstleister: 'Dienstleister', investor: 'Investor', netzwerk: 'Netzwerk', freund: 'Freund' };
/** Alle Rollen einer Person — die alte Lebensphase „partner/multiplikator“ zählt weiter als Rolle. */
export function rollenVon(k: { rollen?: Rolle[]; lebensphase?: string }): Rolle[] {
  const r = [...(k.rollen ?? [])];
  if ((k.lebensphase === 'partner' || k.lebensphase === 'multiplikator') && !r.includes(k.lebensphase)) r.push(k.lebensphase);
  return r;
}

export type Herkunft = 'selbst' | 'bekannt' | 'hubspot' | 'empfehlung' | 'recherche' | 'veranstaltung' | 'vertrag';
export const HERKUNFT: { id: Herkunft; label: string; fremd: boolean }[] = [
  { id: 'selbst', label: 'Selbst angegeben', fremd: false }, { id: 'bekannt', label: 'Persönlich bekannt', fremd: false },
  { id: 'vertrag', label: 'Aus Auftrag / Vertrag', fremd: false }, { id: 'veranstaltung', label: 'Veranstaltung', fremd: false },
  { id: 'hubspot', label: 'Früheres CRM (HubSpot)', fremd: false }, { id: 'empfehlung', label: 'Empfehlung', fremd: true }, { id: 'recherche', label: 'Recherche / Liste', fremd: true },
];
export type Rechtsgrundlage = 'einwilligung' | 'vertrag' | 'rechtspflicht' | 'berechtigt';
export const RECHTSGRUNDLAGEN: { id: Rechtsgrundlage; label: string; norm: string }[] = [
  { id: 'einwilligung', label: 'Einwilligung', norm: 'Art. 6 Abs. 1 lit. a' }, { id: 'vertrag', label: 'Vertrag / Anbahnung', norm: 'Art. 6 Abs. 1 lit. b' },
  { id: 'rechtspflicht', label: 'Rechtliche Pflicht', norm: 'Art. 6 Abs. 1 lit. c' }, { id: 'berechtigt', label: 'Berechtigtes Interesse', norm: 'Art. 6 Abs. 1 lit. f' },
];

/** Rechtsgrundlage je Kanal (DSGVO/§ 7 UWG). Keine Rechtsberatung — einmal anwaltlich gegenlesen. */
export type Grundlage = 'einwilligung' | 'bestandskunde_7_3' | 'mutmasslich_b2b_tel' | 'anfrage' | 'vertrag' | 'intro_akzeptiert';
export type EinwilligungKanal = 'mail' | 'telefon' | 'social' | 'newsletter' | 'einladung' | 'whatsapp';
export interface Einwilligung {
  kanal: EinwilligungKanal; grundlage: Grundlage; erteiltAm: string;
  /** Kurzer Nachweis (Altbestand: Wortlaut oder Beleg in einem, „DOI 12.03.“, „im Gespräch am …: … — ja“). */
  nachweis: string; widerrufenAm?: string;
  // ── Voller Nachweis (28.09., U2 #55, lib/crm/einwilligung.ts) — fehlt im Altbestand (= „unvollständiger Nachweis“) ──
  /** Wann genau erfasst (ISO mit Uhrzeit) — stempelt der Server. */
  zeitpunkt?: string;
  /** Wer sie aufgenommen hat (Person aus der Sitzung) — stempelt der Server. */
  erfasstVon?: string;
  /** Text der Einwilligung (Frage + Antwort, Formulartext). */
  wortlaut?: string;
  /** Fassung eines festen Textes („Formular v2“, „DOI-Text 2026-03“). */
  wortlautVersion?: string;
  /** Wo der Beleg liegt: Dateiablage-Eintrag (d-…), Formular, Mail, Gespräch vom … */
  belegRef?: string;
  /** Wer den Widerruf festgehalten hat — stempelt der Server. */
  widerrufenVon?: string;
}

export type Prio = 'A' | 'B' | 'C' | '';
export type Eignung = 'ja' | 'vielleicht' | 'nein' | '';

export interface Kontakt {
  id: string;
  // ── Person ──
  vorname: string;
  nachname: string;
  email?: string;
  telefon?: string;
  sms?: string;
  jobtitel?: string;
  position?: string;
  senioritaet?: string;
  linkedin?: string;
  personInfo?: string;
  // ── Firma ──
  firma?: string;
  firmaDomain?: string;
  firmaWebseite?: string;
  firmaBranche?: string;
  firmaMitarbeiter?: string;
  firmaUmsatz?: string;
  firmaStadt?: string;
  firmaGegruendet?: string;
  firmaLinkedin?: string;
  firmaTelefon?: string;
  firmaEmail?: string;
  marktinfo?: string;
  signale?: string;
  kiBezug?: string;
  // ── Klassifikation (aus der Anreicherung) ──
  /** Erster Wert von `typen` (abgeleitet, 28.09.) — Fragen nach dem Typ über `hatTyp` (lib/crm/mehrfach.ts). */
  typ?: string;
  /** Typen mehrfach (28.09.) — fehlt im Altbestand (dann gilt `typ` allein). Geschrieben über `mehrfachSynchron`. */
  typen?: string[];
  /** Kategorien mehrfach (28.09.) — `kategorie` ist der erste Wert. */
  kategorien?: string[];
  /** Frei vergebbare Labels (28.09., Werteliste „labels“) — kein Altfeld. */
  labels?: string[];
  eignung: Eignung;
  prio: Prio;
  aufhaenger?: string;
  kategorie?: string;
  owner?: string;
  lifecycle?: string;
  quelle?: string;
  recherche?: string;
  notiz?: string;
  hubspotId?: string;
  steckbrief?: string;
  /**
   * Verweis auf die Firma (CRM-Stammdaten, lib/crm/firmen.ts) — seit 28.09. die ABGELEITETE Hauptstation
   * aus `stationen` (lib/crm/stationen.ts). Lesen wie bisher; „Personen einer Firma“ nur über `personenDerFirma`.
   */
  firmaId?: string;
  /**
   * Stationen (28.09., #2/#3): die Person in mehreren Firmen mit Rolle und Beschäftigungshistorie.
   * Fehlt im Altbestand — dann gilt `firmaId`/`position` als eine aktive Hauptstation (`stationenVon`).
   * Geschrieben nur über `stationenSynchron` (hält `firmaId`/`firma`/`position` mit).
   */
  stationen?: Station[];
  /**
   * Alle E-Mail-Adressen (28.09., #11) — `email` bleibt die Haupt-Adresse (abgeleitet). Fehlt im Altbestand
   * (dann gilt `email` allein, `emailsVon`). Geschrieben nur über `emailsSynchron`.
   */
  emails?: EmailAdresse[];
  // ── Beziehung & Recht (24.09., alles optional — der Import kennt es nicht) ──
  kreis?: Kreis;
  /** Eigener Takt in Tagen, sonst aus dem Kreis. */
  taktTage?: number;
  besitzer?: string;
  /** Ebene 1 (Lead) für Personen OHNE Firma — mit Firma liegt die Qualifizierung an der Firma. */
  lead?: import('@/lib/crm/typen').Lead;
  /** LinkedIn je Profil (kevin, malin): angefragt, vernetzt, Nachricht geschrieben (25.09., lib/crm/netzwerk.ts). */
  netzwerk?: Record<string, import('@/lib/crm/netzwerk-form').NetzStand>;
  /** Beim Anreichern kein LinkedIn-Profil gefunden (Tag) — fällt aus der Vernetzen-Runde, bis ein Profil eingetragen wird. */
  linkedinNichtGefunden?: string;
  lebensphase?: Lebensphase;
  /**
   * Lifecycle (28.09., HubSpot-Vorbild, lib/crm/lifecycle.ts): Lead · MQL · SQL · Opportunity · Angebot · Kunde · Follow Up.
   * Von Hand gesetzt (Wahl-Chip mit Vorschlag); der Import belegt es nur vor, solange es leer ist — überschreibt es nie.
   */
  phase?: LifecyclePhase;
  /**
   * BEAN-Kundengruppe von Hand (28.09., H4, lib/crm/bean.ts): B Bestandskunde · E Ehemalig ·
   * A Angebotskunde · N Neu. Fehlt es, gilt die Ableitung (`beanVon`). Handfeld wie `phase` — der Import überschreibt es nie.
   */
  bean?: BeanId;
  /**
   * Löschmarken entfernter Fassungen im Verlauf (28.09., H4, lib/crm/aktivitaet-marke.ts) —
   * damit ein Speichern ohne Stand eine gelöschte/geänderte Notiz nicht zurückholt. Setzt nur der Server.
   */
  geloeschteAktivitaeten?: string[];
  /** Mehrfach: Partner, Multiplikator, Dienstleister, Investor, Netzwerk, Freund (26.09.). */
  rollen?: Rolle[];
  anrede?: 'Sie' | 'Du';
  /**
   * Geburtstag (29.09., Paket K2) — „TT.MM.“ oder „JJJJ-MM-TT“ (lib/kalender/geburtstag.ts), von Hand gepflegt, der Import
   * fasst ihn nie an (PIPELINE_FELDER). Eine Stelle je Person: ist die Person auch in der Familie (verknüpft/gleicher
   * Name), hat der Tag der Familie Vorrang (lib/kalender/quellen-geburtstage.ts). Art. 15 über die Kartei, Art. 17 mit ihr.
   */
  geburtstag?: string;
  vorgestelltDurch?: string;
  einwilligungen?: Einwilligung[];
  /** Werbewiderspruch (Art. 21 DSGVO): sofort, dauerhaft, kein Import überschreibt ihn. */
  werbesperre?: { seit: string; grund: string };
  /**
   * Einschränkung der Verarbeitung (Art. 18 DSGVO, 28.09., U2 #51, lib/crm/einschraenkung.ts): gespeichert ja,
   * verarbeitet nein — raus aus Ampel, Listen, Paketen; Bearbeiten gesperrt. Setzen/Aufheben nur über
   * POST /api/crm/datenschutz (nie über die Kartei).
   */
  eingeschraenkt?: import('@/lib/crm/einschraenkung').Einschraenkung;
  /** „Stammdaten geprüft“ (28.09., U2 #34): Tag und Person — stempelt der Server. */
  geprueftAm?: string;
  geprueftVon?: string;
  /**
   * Bestandskundenprivileg (§ 7 Abs. 3 Nr. 4 UWG, 28.09., U2 #57): Hinweis auf das Widerspruchsrecht bei
   * Erhebung der Adresse erteilt — Tag und Person (Person stempelt der Server).
   */
  hinweisBeiErhebung?: { am: string; von?: string };
  /** Löschfrist mit Grund verlängert (28.09., U2 #52, lib/crm/loeschfristen.ts) — nur über POST /api/crm/datenschutz. */
  loeschfristVerlaengert?: { bis: string; grund: string; von: string; am: string };
  /** Woher die Daten stammen (Art. 14 DSGVO) und worauf die Verarbeitung beruht (Art. 6). */
  herkunft?: Herkunft;
  rechtsgrundlage?: Rechtsgrundlage;
  /**
   * Netzwerken (03.10., Paket „netz-recht“) — alle drei NUR vom Server gestempelt (`datenschutzStempeln`), alle optional:
   *  · `rechtsgrundlageNotiz` — Verweis auf die dokumentierte Interessenabwägung (z. B. „LIA-Netzwerken v1“, DATENSCHUTZ_NETZWERKEN.md)
   *  · `kennengelerntFuer` — auf einem Event „für einen Kunden“ kennengelernt (Kunden-Firma, Event, Tag): MAKE bleibt eigener
   *    Verantwortlicher; die Übergabe an den Kunden ist eine Übermittlung (Protokoll am Event, Art. 13/15/19)
   *  · `datenschutzInformiertAm` — Tag, an dem die Person den Datenschutzhinweis (Art. 13) bekam (Danke-Mail „ist raus“ oder von Hand)
   */
  rechtsgrundlageNotiz?: string;
  kennengelerntFuer?: { firmaId: string; eventId: string; am: string }[];
  datenschutzInformiertAm?: string;
  /** Daten nicht von der Person selbst (Recherche, Liste, Empfehlung) → Art.-14-Information fällig. */
  fremddaten?: boolean;
  art14InformiertAm?: string;
  naechsterSchritt?: { text: string; datum: string };
  /** Nie in ein Agentenpaket. */
  privatNotiz?: string;
  /** Wer die private Notiz geschrieben hat — nur diese Person sieht sie (Kevins Entscheidung 25.09.). */
  privatNotizVon?: string;
  // ── Pipeline (lebt nur hier) ──
  stufe: Stufe;
  wiedervorlage?: string;
  letzterKontakt?: string;
  aktivitaeten: Aktivitaet[];
  importiertAm: string;
  geaendertAm: string;
  /** Fingerabdruck des gespeicherten Datensatzes (Stufe 2, 27.09.) — kommt vom Server, geht mit jeder Änderung zurück; nie gespeichert. */
  stand?: string;
  /**
   * Herkunft je Feld (27.09., „Online gewinnt“): Namen der Stammdaten-Felder, die online von Hand
   * gesetzt wurden (Kartei, Akte, ZOE). Ein Import füllt solche Felder nur, wenn sie leer sind — weicht
   * die Liste ab, wird das ein Konflikt, nie ein Überschreiben. Fehlt die Liste (Bestand vor dem 27.09.),
   * gilt die Faustregel in `istVonHand`.
   */
  vonHand?: string[];
  /** Zahlungsmöglichkeiten (28.09., lib/crm/zahlung.ts) — nur bei Personen OHNE Firma; mit Firma gelten die Werte der Firma. IBAN nie in Export/Agenten. */
  zahlung?: import('@/lib/crm/typen').Zahlungsdaten;
  /**
   * Archiv (04.10., optional — Kompatibilitätsmodus): archiviert am (ISO). Die Person steht dann nur noch in der Kartei-Ansicht
   * „Archiv“ — überall sonst (Segmente, Deals, Verlauf, Recht) bleibt sie, wie sie ist. Löschen geht weiter nur über Art. 17.
   */
  archiviertAm?: string;
}

/** Felder, die der Import NIE anfasst — das ist die Arbeit im CRM. */
export const PIPELINE_FELDER: (keyof Kontakt)[] = ['stufe', 'wiedervorlage', 'letzterKontakt', 'aktivitaeten', 'importiertAm',
  'firmaId', 'herkunft', 'rechtsgrundlage', 'kreis', 'taktTage', 'besitzer', 'lebensphase', 'anrede', 'vorgestelltDurch', 'einwilligungen', 'werbesperre', 'fremddaten', 'art14InformiertAm', 'naechsterSchritt', 'privatNotiz', 'netzwerk', 'linkedinNichtGefunden',
  'lead', 'rollen', 'privatNotizVon', 'stand', 'vonHand', 'phase', 'zahlung', 'bean', 'geloeschteAktivitaeten', 'stationen',
  'eingeschraenkt', 'geprueftAm', 'geprueftVon', 'hinweisBeiErhebung', 'loeschfristVerlaengert', 'geburtstag',
  'rechtsgrundlageNotiz', 'kennengelerntFuer', 'datenschutzInformiertAm', 'archiviertAm'];

/** Höchstens so viele Feldnamen in `vonHand` — mehr Stammdaten-Felder gibt es nicht. */
export const VON_HAND_MAX = 60;

/** Die Stammdaten-Felder — genau das, was `ausZeile` aus der Liste setzt und ein Import anfassen darf. */
export const STAMMDATEN_FELDER: readonly (keyof Kontakt & string)[] = [
  'vorname', 'nachname', 'email', 'telefon', 'sms', 'jobtitel', 'position', 'senioritaet', 'linkedin', 'personInfo',
  'firma', 'firmaDomain', 'firmaWebseite', 'firmaBranche', 'firmaMitarbeiter', 'firmaUmsatz', 'firmaStadt', 'firmaGegruendet', 'firmaLinkedin', 'firmaTelefon', 'firmaEmail',
  'marktinfo', 'signale', 'kiBezug', 'typ', 'eignung', 'prio', 'aufhaenger', 'kategorie', 'owner', 'lifecycle', 'quelle', 'recherche', 'notiz', 'hubspotId', 'steckbrief',
];
const STAMMDATEN = new Set<string>(STAMMDATEN_FELDER);
/** Stammdaten-Feld = darf vom Import gefüllt und von Hand als „meins“ markiert werden (keine Pipeline, keine Kennung). */
export const istStammdatenFeld = (f: string): f is keyof Kontakt & string => STAMMDATEN.has(f);

const s = (v: unknown, n = 400) => String(v ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, n);
/** Kennungen (HubSpot-ID) — NFC, klein, nur Buchstaben/Ziffern. Nie für E-Mails (siehe `mailSchluessel`). */
const norm = (v: string) => v.normalize('NFC').toLowerCase().replace(/[^a-z0-9äöüß@.]/g, '');

// ── Tolerantes Matching (27.09., K2 28.09.) ──────────────────────────────────
// Die Masterliste schreibt „Dr. Jörg Müller“ und „Müller, Jörg“, die Kartei
// „Joerg Mueller“; die Firma heißt einmal „Testfirma GmbH & Co. KG“, einmal
// „Testfirma“ oder „Testfirma G.m.b.H.“. Für den Schlüssel zählt nur der Kern:
// NFC zuerst (macOS liefert NFD — „u“ + Trema als zwei Zeichen), Umlaute
// aufgelöst, Titel und Rechtsformen weg, Satzzeichen weg.
const UMLAUTE: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
const entumlauten = (t: string) => t.normalize('NFC').toLowerCase().replace(/[äöüß]/g, c => UMLAUTE[c] ?? c).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const TITEL = new Set(['dr', 'prof', 'dipl', 'ing', 'mba', 'llm', 'phd', 'med', 'jur', 'rer', 'nat', 'pol', 'oec', 'habil', 'mag', 'msc', 'bsc', 'hc', 'dipling', 'diplkfm', 'kfm']);
const RECHTSFORMEN = new Set(['gmbh', 'ag', 'ug', 'kg', 'ohg', 'gbr', 'se', 'kgaa', 'mbh', 'inc', 'ltd', 'llc', 'corp', 'plc', 'sa', 'sarl', 'bv', 'nv', 'partg', 'mbb', 'eg', 'ev', 'ek', 'haftungsbeschraenkt', 'co', 'cokg', 'gmbhcokg', 'und', 'and']);
// Punkte nach einem einzelnen Buchstaben gehören zu einer Abkürzung: „G.m.b.H.“ → „gmbh“, „e.K.“ → „ek“ — vor dem Wort-Split.
const woerter = (t: string) => entumlauten(t).replace(/\be\.\s?(k|v)\.?/g, ' ').replace(/\b([a-z])\./g, '$1').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

/** Name ohne Titel, Umlaute und Satzzeichen — leer, wenn nichts übrig bleibt. */
export function normName(vorname?: string, nachname?: string): string {
  return woerter(`${vorname ?? ''} ${nachname ?? ''}`).filter(w => !TITEL.has(w)).join('');
}
/** Firma ohne Rechtsform (auch „G.m.b.H.“, „GmbH & Co. KG“), Umlaute und Satzzeichen. */
export function normFirma(firma?: string): string {
  return woerter(firma ?? '').filter(w => !RECHTSFORMEN.has(w)).join('');
}
/**
 * DIE Telefon-Normalisierung (K2, 28.09.) — Import, Dubletten und Kartei nutzen nur diese.
 * E.164-nah: „+49 (0)30 12 34“, „0049 30 1234“, „030 1234“ → „+49301234“; andere Länder behalten
 * ihre Vorwahl („0041 …“ → „+41…“). Leer unter sechs Ziffern (keine Durchwahl-Treffer).
 */
export function normTelefon(t?: string): string {
  const roh = (t ?? '').normalize('NFC').replace(/\(0\)/g, '').trim();
  const plus = roh.startsWith('+');
  let z = roh.replace(/[^0-9]/g, '');
  if (z.length < 6) return '';
  if (plus) z = z.startsWith('490') ? `+49${z.slice(3)}` : `+${z}`;   // „+49 030 …“ (Verkehrsnull doppelt) → +4930…
  else if (z.startsWith('00')) z = `+${z.slice(2)}`;
  else if (z.startsWith('0')) z = `+49${z.slice(1)}`;
  else if (z.startsWith('49') && z.length >= 11) z = `+${z}`;
  else if (z) z = `+49${z}`;
  return z;
}

/**
 * Sammel- und Rollenadressen (info@, kontakt@, office@ …) gehören keinem Menschen — mehrere Personen
 * einer Firma teilen sie. Als Schlüssel würden sie verschiedene Menschen verschmelzen (K2 #11).
 */
const SAMMEL = new Set(['info', 'infos', 'kontakt', 'contact', 'office', 'hallo', 'hello', 'hi', 'mail', 'email', 'e-mail', 'post', 'postfach', 'service', 'kundenservice', 'customerservice',
  'support', 'team', 'buero', 'büro', 'zentrale', 'empfang', 'rezeption', 'sekretariat', 'verwaltung', 'vertrieb', 'sales', 'anfrage', 'anfragen', 'admin', 'administrator',
  'noreply', 'no-reply', 'webmaster', 'marketing', 'presse', 'press', 'jobs', 'karriere', 'bewerbung', 'rechnung', 'rechnungen', 'buchhaltung', 'invoice', 'invoices', 'order',
  'bestellung', 'shop', 'hr', 'personal', 'datenschutz', 'privacy', 'legal', 'impressum', 'newsletter', 'events', 'einkauf', 'kanzlei', 'praxis', 'mitglieder', 'geschaeftsfuehrung', 'gf']);
/** Ist das eine Sammel-/Rollenadresse (nur der Teil vor dem @ zählt, NFC, klein)? */
export function istSammelAdresse(email?: string): boolean {
  const lokal = (email ?? '').normalize('NFC').trim().toLowerCase().split('@')[0] ?? '';
  return SAMMEL.has(lokal);
}
/**
 * E-Mail als Schlüssel: NFC, trim, klein — sonst nichts. Bindestrich, Unterstrich und Plus bleiben:
 * „max-muster@…“ und „maxmuster@…“ sind zwei Postfächer (vor K2 verschmolzen sie). Leer ohne @.
 */
export function mailSchluessel(email?: string): string {
  const m = (email ?? '').normalize('NFC').trim().toLowerCase();
  return m.includes('@') ? m : '';
}

/**
 * Der Schlüssel, unter dem ein Kontakt wiedererkannt wird.
 *
 * Reihenfolge: persönliche E-Mail vor HubSpot-ID vor Name+Firma. E-Mail ist am stabilsten;
 * die HubSpot-ID kennt nur der HubSpot-Teil der Liste; Name+Firma ist der
 * Notnagel für die Kontakte ohne Mail — seit 27.09. tolerant (normName/normFirma).
 * Sammeladressen (info@ …) zählen nicht als Personenschlüssel (K2, 28.09.).
 * Ohne diesen Schlüssel würde jeder Import alle Zeilen neu anlegen.
 */
export function schluessel(k: { email?: string; hubspotId?: string; vorname?: string; nachname?: string; firma?: string }): string {
  const mail = mailSchluessel(k.email);
  if (mail && !istSammelAdresse(mail)) return `m:${mail}`;
  if ((k.hubspotId ?? '').trim()) return `h:${norm(k.hubspotId!)}`;
  return `n:${normName(k.vorname, k.nachname)}|${normFirma(k.firma)}`;
}

/**
 * Übergangsregel (K2, 28.09.): die Schlüsselform VOR K2 — E-Mail ohne Satzzeichen außer „.“ und „@“
 * (auch bei Sammeladressen), HubSpot-ID wie gehabt. Name+Firma ist seit K2 nur toleranter geworden
 * (jeder alte Treffer ist auch ein neuer), deshalb dort dieselbe Form. Nur `importieren` fragt sie —
 * damit ein Bestand, der unter der alten Form zusammengefunden hatte, nicht verdoppelt wird.
 */
export function schluesselAlt(k: { email?: string; hubspotId?: string; vorname?: string; nachname?: string; firma?: string }): string {
  const mail = (k.email ?? '').toLowerCase().replace(/[^a-z0-9äöüß@.]/g, '');
  if (mail.includes('@')) return `m:${mail}`;
  if ((k.hubspotId ?? '').trim()) return `h:${norm(k.hubspotId!)}`;
  return `n:${normName(k.vorname, k.nachname)}|${normFirma(k.firma)}`;
}

/**
 * Alle Merkmale, an denen dieselbe Person wiedererkannt wird (Sperrliste, K2 #60): persönliche
 * E-Mail, HubSpot-ID, Name+Firma (nur mit Namen). Klartext — gehasht wird in lib/crm/sperrliste.ts.
 */
export function identitaetsMerkmale(k: { email?: string; emails?: EmailAdresse[]; hubspotId?: string; vorname?: string; nachname?: string; firma?: string }): string[] {
  const l: string[] = [];
  // Alle Adressen der Person (28.09., #11) — eine gesperrte Person bleibt auch unter ihrer zweiten Adresse gesperrt.
  for (const mail of alleAdressen(k)) if (!istSammelAdresse(mail)) l.push(`m:${mail}`);
  if ((k.hubspotId ?? '').trim()) l.push(`h:${norm(k.hubspotId!)}`);
  const name = normName(k.vorname, k.nachname);
  if (name) l.push(`n:${name}|${normFirma(k.firma)}`);
  return l;
}

/**
 * OWNER der Masterliste → Besitzer in der Kartei (Entscheidung 27.09.): nennt der Eintrag genau eine Person des Teams (Vorname
 * bzw. Kürzel aus lib/crm/team-liste.ts, an Wortgrenzen) → diese · mehrere → „beide“ · „(kein Owner)“, leer oder ein fremder Name
 * → kein Besitzer (bleibt für die Qualifizierungsrunde offen). 09.10.: keine festen Namen mehr — die Team-Liste entscheidet.
 */
export function besitzerAusOwner(owner?: string, team: readonly { id: string; name: string }[] = CRM_TEAM): string | undefined {
  const o = (owner ?? '').toLocaleLowerCase('de-DE');
  if (!o.trim()) return undefined;
  const wort = (w: string) => new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u');
  const treffer = team.filter(m => [m.id, (m.name.split(/\s+/)[0] ?? '')].filter(x => x.length >= 2).some(x => wort(x.toLocaleLowerCase('de-DE')).test(o)));
  if (treffer.length > 1) return CRM_BEIDE;
  return treffer[0]?.id;
}

function prioAus(v: string): Prio {
  const p = v.trim().toUpperCase().charAt(0);
  return p === 'A' || p === 'B' || p === 'C' ? p : '';
}
function eignungAus(v: string): Eignung {
  const e = v.trim().toLowerCase();
  return e === 'ja' || e === 'vielleicht' || e === 'nein' ? e : '';
}

/**
 * Die Stufe beim ersten Import. Die Liste hat kaum Pipeline-Information
 * (LEAD_STATUS bei 11 von 443) — deshalb wird aus dem Wenigen abgeleitet,
 * das da ist, und der Rest startet bei „neu". Das ist ehrlich: niemand hat
 * diese Leute bisher aus dem CRM heraus angesprochen.
 */
export function stufeAusImport(zeile: Record<string, string>): Stufe {
  const status = s(zeile.LEAD_STATUS).toUpperCase();
  if (status === 'OPEN_DEAL') return 'angebot';
  if (status === 'IN_PROGRESS') return 'gespraech';
  if (s(zeile.LIFECYCLE).toLowerCase() === 'opportunity') return 'gespraech';
  return 'neu';
}

/**
 * Datum aus der Liste (K2 #10/#23): ISO bleibt, deutsches `TT.MM.JJJJ` (auch `T.M.JJ`) wird ISO,
 * Excel-Seriennummern nicht (zu unsicher). Unlesbares → `unlesbar` (der Import verwirft es und meldet es).
 */
export function datumAusListe(v?: string): { iso?: string; unlesbar: boolean } {
  const t = (v ?? '').normalize('NFC').trim();
  if (!t) return { unlesbar: false };
  let j: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(t);
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(t);
  if (iso) { j = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else if (de) { d = +de[1]; m = +de[2]; j = de[3].length === 2 ? 2000 + +de[3] : +de[3]; }
  else return { unlesbar: true };
  const dt = new Date(Date.UTC(j, m - 1, d));
  if (j < 1900 || j > 2100 || dt.getUTCFullYear() !== j || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return { unlesbar: true };
  return { iso: `${String(j).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, unlesbar: false };
}

/**
 * Herkunft einer importierten Zeile (Art. 14, K2 #27/#62): aus der Spalte QUELLE, wenn sie es klar sagt,
 * sonst „Recherche / Liste“ — die Masterliste ist eine angereicherte Recherche.
 */
export function herkunftAusQuelle(quelle?: string): Herkunft {
  const q = (quelle ?? '').toLowerCase();
  if (/empfehl|empfohlen/.test(q)) return 'empfehlung';
  if (/hubspot/.test(q)) return 'hubspot';
  if (/veranstaltung|event|messe|konferenz/.test(q)) return 'veranstaltung';
  return 'recherche';
}
const herkunftIstFremd = (h: Herkunft) => HERKUNFT.find(x => x.id === h)?.fremd ?? true;

/** Eine Zeile der Masterliste wird ein Kontakt. Spaltennamen sind die der Datei. */
export function ausZeile(z: Record<string, string>, heute: string): Kontakt {
  const k: Kontakt = {
    id: '',
    vorname: s(z.VORNAME, 80), nachname: s(z.NACHNAME, 80),
    email: s(z.EMAIL, 160).toLowerCase() || undefined,
    telefon: s(z.TELEFON, 60) || undefined, sms: s(z.SMS, 60) || undefined,
    jobtitel: s(z.JOBTITEL, 120) || undefined, position: s(z.POSITION_AKTUELL, 160) || undefined,
    senioritaet: s(z.SENIORITAET, 60) || undefined, linkedin: s(z.LINKEDIN, 200) || undefined,
    personInfo: s(z.PERSON_INFO, 800) || undefined,
    firma: s(z.FIRMA, 160) || undefined, firmaDomain: s(z.FIRMA_DOMAIN, 120) || undefined,
    firmaWebseite: s(z.FIRMA_WEBSEITE, 200) || undefined, firmaBranche: s(z.FIRMA_BRANCHE, 120) || undefined,
    firmaMitarbeiter: s(z.FIRMA_MITARBEITER, 40) || undefined, firmaUmsatz: s(z.FIRMA_UMSATZ, 60) || undefined,
    firmaStadt: s(z.FIRMA_STADT, 80) || undefined, firmaGegruendet: s(z.FIRMA_GEGRUENDET, 20) || undefined,
    firmaLinkedin: s(z.FIRMA_LINKEDIN, 200) || undefined, firmaTelefon: s(z.FIRMA_TELEFON, 60) || undefined,
    firmaEmail: s(z.FIRMA_EMAIL, 160) || undefined,
    marktinfo: s(z.MARKTINFO, 800) || undefined, signale: s(z.SIGNALE, 600) || undefined,
    kiBezug: s(z.KI_BEZUG, 400) || undefined,
    typ: s(z.KONTAKT_TYP, 40) || undefined, eignung: eignungAus(s(z.VERTRIEBS_EIGNUNG)), prio: prioAus(s(z.PRIORITAET)),
    aufhaenger: s(z.GESPRAECHSAUFHAENGER, 600) || undefined,
    kategorie: s(z.KATEGORIE, 80) || undefined, owner: s(z.OWNER, 60) || undefined,
    lifecycle: s(z.LIFECYCLE, 40) || undefined, quelle: s(z.QUELLE, 120) || undefined,
    recherche: s(z.STATUS_RECHERCHE, 60) || undefined, notiz: s(z.KEVIN_NOTIZ, 800) || undefined,
    hubspotId: s(z.HUBSPOT_ID, 40) || undefined, steckbrief: s(z.STECKBRIEF, 400) || undefined,
    stufe: stufeAusImport(z),
    letzterKontakt: datumAusListe(z.LETZTER_KONTAKT).iso,
    aktivitaeten: [],
    importiertAm: heute, geaendertAm: heute,
  };
  const besitzer = besitzerAusOwner(k.owner);
  if (besitzer) k.besitzer = besitzer;
  // Herkunft (Art. 14, K2): Daten aus der Liste stammen nicht von der Person selbst → Art.-14-Uhr ab `importiertAm`.
  k.herkunft = herkunftAusQuelle(k.quelle);
  if (herkunftIstFremd(k.herkunft)) k.fremddaten = true;
  // Lifecycle (28.09.): die HubSpot-Spalte LIFECYCLE belegt die Phase nur vor — gesetzt wird sie von Hand.
  const phase = lifecycleAusListe(k.lifecycle);
  if (phase) k.phase = phase;
  // Kennung (29.09., Paket D-C #35): zufällig `c-<uuid>` — nie mehr aus E-Mail/Name (trug die Adresse lesbar in URLs,
  // Logs, Protokolle; nach Art. 17 kam dieselbe Kennung wieder). Wiedererkannt wird über den fachlichen Schlüssel
  // (`schluessel`, Index in `importieren`), nicht über die Kennung — deshalb bleibt der Import idempotent.
  k.id = neueKontaktKennung();
  return k;
}

// ── Online gewinnt (Kevins Entscheidung 27.09.) ──────────────────────────────
// Malin pflegt online, Kevin pflegt die Liste. Beim Import füllt die Liste nur
// Lücken. Weicht ein gefülltes Feld ab, entscheidet die Herkunft: von Hand
// gesetzt → Konflikt (Feld, online, Liste) und nichts überschreiben; nur vom
// Import gesetzt → die Liste darf auffrischen wie bisher.

/** Ein Feld, bei dem Liste und Kartei auseinanderliegen — wird nicht angewandt, sondern vorgelegt. */
export interface Konflikt {
  kontaktId: string; feld: string; online: unknown; liste: unknown;
  /** Worum es vermutlich geht (28.09.): „Firmenwechsel?“ — die Liste nennt eine ANDERE Firma als die Kartei. */
  hinweis?: string;
}
/** Hinweis an Import-Konflikten, wenn die Liste eine andere Firma nennt (Integritätsprüfung W4, 28.09.). */
export const FIRMENWECHSEL_HINWEIS = 'Firmenwechsel?';

/**
 * Gilt dieses Feld als von Hand gesetzt? Mit `vonHand` ist die Antwort exakt.
 * Ohne (Bestand vor dem 27.09.): konservativ — wurde der Kontakt nach dem
 * Import noch geändert, könnte jedes Feld von Hand sein. Lieber ein Konflikt
 * zu viel als Malins Arbeit weg.
 */
const nachImportGeaendert = (k: Pick<Kontakt, 'geaendertAm' | 'importiertAm'>) => !!k.geaendertAm && !!k.importiertAm && k.geaendertAm > k.importiertAm;
export function istVonHand(k: Pick<Kontakt, 'vonHand' | 'geaendertAm' | 'importiertAm'>, feld: string): boolean {
  if (k.vonHand) return k.vonHand.includes(feld);
  return nachImportGeaendert(k);
}

const leer = (v: unknown) => v === undefined || v === null || v === '';
const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Bestehenden Kontakt mit frischen Stammdaten zusammenführen.
 * Die Pipeline-Felder bleiben, wie sie sind. Leere Felder im Import
 * überschreiben keine gefüllten — eine Excel-Zeile mit gelöschter Notiz soll
 * nicht die Notiz im CRM löschen. Gefüllte, von Hand gesetzte Felder werden
 * nie überschrieben, sondern als Konflikt zurückgegeben.
 * Der Besitzer ist Pipeline: die Liste setzt ihn nur, wenn online keiner steht.
 */
export function zusammenfuehren(alt: Kontakt, neu: Kontakt, heute: string): { kontakt: Kontakt; geaendert: boolean; konflikte: Konflikt[] } {
  const out: Kontakt = { ...alt };
  const konflikte: Konflikt[] = [];
  let geaendert = false;
  const setze = (f: keyof Kontakt, v: unknown) => { (out as unknown as Record<string, unknown>)[f] = v; geaendert = true; };
  // E-Mail (28.09., #11): eine neue Adresse zu einer bekannten Person wird als WEITERE Adresse angehängt —
  // nie überschrieben, die Haupt-Adresse bleibt. Nur wenn die Person noch gar keine hat, füllt die Liste
  // die Lücke (von Hand geleert → Konflikt, „Online gewinnt“).
  if (neu.email && !hatAdresse(out, neu.email)) {
    if (!alleAdressen(out).length && alt.vonHand?.includes('email')) konflikte.push({ kontaktId: alt.id, feld: 'email', online: out.email, liste: neu.email });
    else { const mit = adresseAnhaengen(out, neu.email); if (mit.email !== out.email) setze('email', mit.email); if (mit.emails !== out.emails) setze('emails', mit.emails); }
  }
  // Firmenwechsel (28.09., Integritätsprüfung W4): nennt die Liste eine ANDERE Firma als die Kartei, wird der
  // Firmentext nicht überschrieben — sonst stünde der neue Name über der alten Hauptstation (firmaId/Stationen
  // blieben alt). Stattdessen ein Konflikt „Firmenwechsel?“ (Feld firma, Listenwert); die Position und die
  // Firmendaten der Zeile gehören dann zur neuen Firma und bleiben ebenfalls liegen (Position als Konflikt).
  const firmaAlt = String(alt.firma ?? '').trim(), firmaNeu = String(neu.firma ?? '').trim();
  const firmenwechsel = !!firmaAlt && !!firmaNeu && normFirma(firmaAlt) !== normFirma(firmaNeu);
  if (firmenwechsel) {
    konflikte.push({ kontaktId: alt.id, feld: 'firma', online: alt.firma, liste: neu.firma, hinweis: FIRMENWECHSEL_HINWEIS });
    if (!leer(neu.position) && !leer(alt.position) && !gleich(alt.position, neu.position)) konflikte.push({ kontaktId: alt.id, feld: 'position', online: alt.position, liste: neu.position, hinweis: FIRMENWECHSEL_HINWEIS });
  }
  for (const f of Object.keys(neu) as (keyof Kontakt)[]) {
    if (!istStammdatenFeld(f) || f === 'email') continue;
    if (firmenwechsel && (f === 'firma' || f === 'position' || String(f).startsWith('firma'))) continue;
    // Gleiche Firma, andere Schreibweise („Muster GmbH“ ↔ „Muster“): der Kartei-Text bleibt.
    if (f === 'firma' && firmaAlt && normFirma(firmaAlt) === normFirma(firmaNeu)) continue;
    const v = neu[f];
    if (leer(v)) continue;
    const a = out[f];
    if (gleich(a, v)) continue;
    // Ausdrücklich von Hand geleert (steht in `vonHand`, ist aber leer): kein stilles Wiederauffüllen.
    if (leer(a) && !(alt.vonHand?.includes(f))) { setze(f, v); continue; }
    if (istVonHand(alt, f)) { konflikte.push({ kontaktId: alt.id, feld: f, online: a, liste: v }); continue; }
    setze(f, v);
  }
  if (!alt.besitzer && neu.besitzer) setze('besitzer', neu.besitzer);
  // Lifecycle (28.09.): wie der Besitzer — nur vorbelegen, wenn online noch keine Phase steht; nie überschreiben.
  if (!alt.phase && neu.phase) setze('phase', neu.phase);
  // Herkunft (Art. 14, K2 28.09.): nur, wenn noch nichts gesetzt ist UND der Kontakt aus derselben Liste stammt
  // (gleiche QUELLE) — eine von Hand angelegte Person (Visitenkarte, Anfrage) wird nie still zur „Recherche“.
  if (!alt.herkunft && alt.fremddaten === undefined && neu.herkunft && (alt.quelle ?? '') === (neu.quelle ?? '')) {
    setze('herkunft', neu.herkunft);
    if (neu.fremddaten) setze('fremddaten', true);
  }
  if (geaendert) {
    out.geaendertAm = heute;
    // Ohne Herkunftsliste und ohne Handänderung (Faustregel sagt „nur Import“): ab jetzt exakt führen —
    // sonst würde das frische Änderungsdatum beim nächsten Import jede Abweichung zum Konflikt machen.
    if (!alt.vonHand && !nachImportGeaendert(alt)) out.vonHand = [];
  }
  // Stationen (28.09.): eine neue Position aus der Liste wird die Rolle der Hauptstation (Firma bleibt, wie sie ist).
  // Typ/Kategorie aus der Liste füllen den ersten Wert (mehrfach, 28.09.) — „Online gewinnt“ gilt über `vonHand` wie bisher.
  return { kontakt: geaendert ? bezuegeSynchron(out, alt, heute) : out, geaendert, konflikte };
}

/**
 * Herkunft je Feld beim Schreiben von Hand (Kartei, Akte, ZOE): jedes Stammdaten-Feld, das sich gegenüber
 * dem gespeicherten Stand ändert (auch Leeren), kommt in `vonHand`. Ohne Altstand (neu angelegt) zählt
 * jedes gefüllte Feld. Was schon drinsteht, bleibt — ein älterer Browser-Stand ohne `vonHand` löscht nichts.
 */
export function vonHandMarkieren(alt: Kontakt | undefined, neu: Kontakt): Kontakt {
  const felder = new Set<string>([...(alt?.vonHand ?? []), ...(neu.vonHand ?? [])]);
  const alle = new Set([...Object.keys(neu), ...Object.keys(alt ?? {})]);
  for (const f of alle) {
    if (!istStammdatenFeld(f)) continue;
    const v = neu[f], a = alt?.[f];
    if (leer(v) && leer(a)) continue;
    if (!gleich(v, a)) felder.add(f);
  }
  // Mehrfach-Listen (28.09.): wer Typen/Kategorien von Hand ändert, hat auch den ersten Wert in der Hand — kein Import überschreibt ihn still.
  if (alt && !gleich(neu.typen, alt.typen) && neu.typen !== undefined) felder.add('typ');
  if (alt && !gleich(neu.kategorien, alt.kategorien) && neu.kategorien !== undefined) felder.add('kategorie');
  if (!felder.size && !alt?.vonHand && !neu.vonHand) return neu;
  return { ...neu, vonHand: Array.from(felder).slice(0, VON_HAND_MAX) };
}

/** Kein sicherer Treffer, aber vielleicht derselbe Mensch — Vorschlag, nie automatisch verschmolzen. */
export interface MoeglicheDublette { kontaktId: string; mitId?: string; grund: string }

/**
 * Mögliche Dubletten, die der Schlüssel nicht fängt: gleicher Name bei anderer
 * Firma (Jobwechsel? zweiter Eintrag?) oder gleiche Telefonnummer. Nur Paare,
 * an denen mindestens einer aus `nur` (die gerade importierten) beteiligt ist —
 * den ganzen Bestand prüft Kontakte › Dubletten. Nie gekürzt (28.09.; vorher still höchstens 300) —
 * `max` nur für einen ausdrücklich gewollten Ausschnitt.
 */
export function moeglicheDubletten(kontakte: Kontakt[], nur?: Set<string>, max = Number.POSITIVE_INFINITY): MoeglicheDublette[] {
  const r: MoeglicheDublette[] = [];
  const gesehen = new Set<string>();
  const melde = (a: Kontakt, b: Kontakt, grund: string) => {
    if (a.id === b.id || (nur && !nur.has(a.id) && !nur.has(b.id))) return;
    const paar = [a.id, b.id].sort().join('|') + grund;
    if (gesehen.has(paar) || r.length >= max) return;
    gesehen.add(paar);
    const [erst, zweit] = nur?.has(a.id) || !nur ? [a, b] : [b, a];
    r.push({ kontaktId: erst.id, mitId: zweit.id, grund });
  };
  const jeName = new Map<string, Kontakt[]>();
  const jeTel = new Map<string, Kontakt[]>();
  for (const k of kontakte) {
    const n = normName(k.vorname, k.nachname);
    if (n.length >= 5) jeName.set(n, [...(jeName.get(n) ?? []), k]);
    for (const t of [normTelefon(k.telefon), normTelefon(k.sms)]) if (t) jeTel.set(t, [...(jeTel.get(t) ?? []), k]);
  }
  for (const l of Array.from(jeName.values())) for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
    if (normFirma(l[i].firma) !== normFirma(l[j].firma)) melde(l[i], l[j], 'gleicher Name, andere Firma');
  }
  for (const l of Array.from(jeTel.values())) for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) melde(l[i], l[j], 'gleiche Telefonnummer');
  return r;
}

export interface ImportErgebnis {
  kontakte: Kontakt[]; neu: number; aktualisiert: number; unveraendert: number;
  /** Abweichungen, die NICHT angewandt wurden (online gewinnt). */
  konflikte: Konflikt[];
  /** Vorschläge, nichts verschmolzen. */
  moeglicheDubletten: MoeglicheDublette[];
  /** Importierte Zeilen, deren Kontakt danach keinen Besitzer hat — für die Qualifizierungsrunde. */
  ohneBesitzer: number;
  /** Kennungen aller Kontakte, die diese Liste getroffen hat (neu oder bestehend). */
  betroffen: string[];
  /** Kennungen der neu angelegten Kontakte (für „Import rückgängig“). */
  neuIds: string[];
  /** Zeilen, die auf der Sperrliste stehen und deshalb NICHT angelegt wurden (K2 #60). */
  gesperrt: number;
  /** Bestehende Kontakte, die nur über die alte Schlüsselform wiedererkannt wurden (Übergangsregel K2). */
  uebergang: number;
  /** Bekannte Personen, an die eine neue E-Mail-Adresse als weitere angehängt wurde (28.09., #11). */
  weitereAdressen: number;
}

export interface ImportOptionen {
  /** Steht diese (neue) Person auf der Sperrliste? Dann wird sie nicht angelegt (lib/crm/sperrliste.ts). */
  gesperrt?: (k: Kontakt) => boolean;
}

/** Widersprechen sich zwei Namen? Leer widerspricht nie; sonst muss der Kern gleich sein. */
const namenVertraeglich = (a: Kontakt, b: Kontakt) => { const x = normName(a.vorname, a.nachname), y = normName(b.vorname, b.nachname); return !x || !y || x === y; };

/**
 * Ein Import über den ganzen Bestand — idempotent: zweimal laufen ändert nichts (Konflikte bleiben, bis sie gelöst sind).
 * Kein Kontakt des Bestands geht verloren, auch wenn zwei denselben Schlüssel tragen (vorher fiel einer still weg).
 *
 * Übergangsregel (K2, 28.09.): findet eine Zeile unter dem NEUEN Schlüssel niemanden, wird der Bestand auch unter
 * der ALTEN Form (`schluesselAlt`) gesucht — aber nur, wenn der Treffer eindeutig ist, in diesem Lauf von keiner
 * anderen Zeile direkt getroffen wird und die Namen sich nicht widersprechen. So verdoppelt die neue Form keinen
 * Bestand, und zwei verschiedene Menschen (andere Namen) verschmelzen trotzdem nicht mehr.
 */
export function importieren(bestand: Kontakt[], zeilen: Record<string, string>[], heute: string, opt: ImportOptionen = {}): ImportErgebnis {
  const nachId = new Map(bestand.map(k => [k.id, k]));
  const index = new Map<string, string>();
  // Alle Adressen einer Person zählen (28.09., #11): wer eine Zeile unter seiner zweiten Adresse trifft, ist derselbe Mensch.
  const indizieren = (k: Kontakt) => {
    index.set(schluessel(k), k.id);
    for (const a of alleAdressen(k)) if (!istSammelAdresse(a) && !index.has(`m:${a}`)) index.set(`m:${a}`, k.id);
  };
  for (const k of bestand) index.set(schluessel(k), k.id);
  for (const k of bestand) indizieren(k);
  // Rückfall für eine NEUE Adresse (28.09., #11): dieselbe HubSpot-ID oder derselbe Name bei derselben Firma —
  // nur eindeutig (mehrdeutig = null). So hängt die neue Adresse an, statt die Person doppelt anzulegen.
  const eindeutig = (schl: (k: Kontakt) => string | null) => { const m = new Map<string, string | null>(); for (const k of bestand) { const x = schl(k); if (x) m.set(x, m.has(x) ? null : k.id); } return m; };
  const hubKey = (k: Pick<Kontakt, 'hubspotId'>) => ((k.hubspotId ?? '').trim() ? `h:${norm(k.hubspotId!)}` : null);
  const nameKey = (k: Pick<Kontakt, 'vorname' | 'nachname' | 'firma'>) => { const n = normName(k.vorname, k.nachname), f = normFirma(k.firma); return n.length >= 5 && f ? `n:${n}|${f}` : null; };
  const nachHub = eindeutig(hubKey), nachName = eindeutig(nameKey);
  // Alte Form: nur eindeutige Treffer (mehrdeutig = null).
  const altIndex = new Map<string, string | null>();
  for (const k of bestand) { const a = schluesselAlt(k); altIndex.set(a, altIndex.has(a) ? null : k.id); }
  const kandidaten = zeilen.map(z => ausZeile(z, heute));
  // Bestand, den irgendeine Zeile direkt trifft — den darf keine andere Zeile über die alte Form an sich ziehen.
  const direkt = new Set(kandidaten.flatMap(k => { const id = index.get(schluessel(k)); return id ? [id] : []; }));
  const perUebergang = new Set<string>();

  let neu = 0, aktualisiert = 0, unveraendert = 0, ohneBesitzer = 0, gesperrt = 0, weitereAdressen = 0;
  const konflikte: Konflikt[] = [];
  const hinweise: MoeglicheDublette[] = [];
  const betroffen = new Set<string>();
  const neuIds: string[] = [];
  zeilen.forEach((z, i) => {
    const k = kandidaten[i];
    if (!k.vorname && !k.nachname && !k.firma) return;   // leere Zeile
    const key = schluessel(k);
    let altId = index.get(key);
    if (!altId) {
      const a = altIndex.get(schluesselAlt(k));
      const kand = a ? nachId.get(a) : undefined;
      if (kand && !direkt.has(kand.id) && !perUebergang.has(kand.id) && namenVertraeglich(kand, k)) { altId = kand.id; perUebergang.add(kand.id); }
    }
    if (!altId && mailSchluessel(k.email)) {
      const h = hubKey(k), n = nameKey(k);
      const id = (h ? nachHub.get(h) : undefined) ?? (n ? nachName.get(n) : undefined);
      const kand = id ? nachId.get(id) : undefined;
      if (kand && !direkt.has(kand.id) && namenVertraeglich(kand, k)) altId = kand.id;
    }
    let fertig: Kontakt;
    if (!altId) {
      if (opt.gesperrt?.(k)) { gesperrt++; return; }
      let id = k.id, n = 2;
      while (nachId.has(id)) id = `${k.id.slice(0, 56)}-${n++}`;
      fertig = id === k.id ? k : { ...k, id };
      nachId.set(fertig.id, fertig); index.set(key, fertig.id); neu++; neuIds.push(fertig.id);
    } else {
      const vorher = nachId.get(altId)!;
      // Art. 18 (U2 #51): eine eingeschränkte Person wird nicht bearbeitet — auch nicht vom Import.
      if (vorher.eingeschraenkt) { unveraendert++; betroffen.add(vorher.id); return; }
      const r = zusammenfuehren(vorher, k, heute);
      if (alleAdressen(r.kontakt).length > alleAdressen(vorher).length && alleAdressen(vorher).length) weitereAdressen++;
      nachId.set(altId, r.kontakt); index.set(key, altId); indizieren(r.kontakt);
      konflikte.push(...r.konflikte);
      if (r.geaendert) aktualisiert++; else unveraendert++;
      fertig = r.kontakt;
    }
    betroffen.add(fertig.id);
    if (!fertig.besitzer) ohneBesitzer++;
    // Vermerk aus der Liste („⚠ Owner klären (Dublette Kevin/Malin)“) — als Hinweis, nicht als Feld.
    if (/dublette/i.test(s(z.STATUS_RECHERCHE, 200))) hinweise.push({ kontaktId: fertig.id, grund: 'Liste: Owner klären' });
  });
  const kontakte = Array.from(nachId.values());
  return {
    kontakte, neu, aktualisiert, unveraendert, konflikte, ohneBesitzer, betroffen: Array.from(betroffen), neuIds, gesperrt, uebergang: perUebergang.size, weitereAdressen,
    moeglicheDubletten: [...moeglicheDubletten(kontakte, betroffen), ...hinweise],
  };
}

// ── Die Tagesliste ──────────────────────────────────────────────────────────

export interface Kanal { art: 'mail' | 'linkedin' | 'anruf'; ziel: string }

/** Über welche Wege der Kontakt erreichbar ist — in der Reihenfolge, in der
 *  Kevin sie nutzen sollte. LinkedIn zuerst bei kaltem Kontakt (§7 UWG),
 *  Mail zuerst, wenn es schon einen Draht gibt. */
export function kanaele(k: Kontakt): Kanal[] {
  const warm = k.stufe !== 'neu' && k.stufe !== 'ansprechen' || kategorieBeginnt(k, 'Apple') || hatTyp(k, 'Netzwerk');
  const l: Kanal[] = [];
  if (k.linkedin) l.push({ art: 'linkedin', ziel: k.linkedin });
  if (k.email) l.push({ art: 'mail', ziel: k.email });
  if (k.telefon || k.sms) l.push({ art: 'anruf', ziel: (k.telefon ?? k.sms)! });
  if (warm && k.email) { const i = l.findIndex(x => x.art === 'mail'); if (i > 0) l.unshift(...l.splice(i, 1)); }
  return l;
}

/** Ansprechbar = es gibt einen Weg UND einen Grund. Ohne Aufhänger wäre die
 *  Ansprache Kaltakquise ohne Anlass, und die macht Kevin nicht. */
export function ansprechbar(k: Kontakt): boolean {
  return kanaele(k).length > 0 && !!(k.aufhaenger ?? '').trim();
}

const PRIO_RANG: Record<Prio, number> = { A: 0, B: 1, C: 2, '': 3 };
const EIGNUNG_RANG: Record<Eignung, number> = { ja: 0, vielleicht: 1, '': 2, nein: 3 };

export interface Tagesposten { kontakt: Kontakt; grund: string }

/**
 * Wer ist heute dran?
 *
 * 1. Fällige Wiedervorlagen — ein Versprechen an den Kontakt geht vor.
 * 2. Prio A, ansprechbar, noch nicht angesprochen — nach Vertriebseignung.
 * 3. Prio B, dito.
 * Abgeschlossene bleiben draußen, „Dienstleister" und „Investor" auch — die
 * sind Kontakte, keine Kunden.
 */
export function tagesliste(kontakte: Kontakt[], heute: string, n = 10): Tagesposten[] {
  const offen = kontakte.filter(k => !ABGESCHLOSSEN.includes(k.stufe));
  const faellig = offen
    .filter(k => k.wiedervorlage && k.wiedervorlage <= heute)
    .sort((a, b) => (a.wiedervorlage! < b.wiedervorlage! ? -1 : 1))
    .map(k => ({ kontakt: k, grund: k.wiedervorlage! < heute ? `Wiedervorlage überfällig seit ${k.wiedervorlage}` : 'Wiedervorlage heute' }));
  const schonDrin = new Set(faellig.map(p => p.kontakt.id));
  const frisch = offen
    .filter(k => !schonDrin.has(k.id))
    .filter(k => (k.stufe === 'neu' || k.stufe === 'ansprechen') && ansprechbar(k))
    .filter(k => !hatTyp(k, 'Dienstleister') && !hatTyp(k, 'Investor'))
    .filter(k => k.prio === 'A' || k.prio === 'B')
    .sort((a, b) =>
      PRIO_RANG[a.prio] - PRIO_RANG[b.prio]
      || EIGNUNG_RANG[a.eignung] - EIGNUNG_RANG[b.eignung]
      || (a.nachname || '').localeCompare(b.nachname || ''))
    .map(k => ({ kontakt: k, grund: `Prio ${k.prio}${k.eignung ? ` · Eignung ${k.eignung}` : ''} · noch nicht angesprochen` }));
  return [...faellig, ...frisch].slice(0, n);
}

/**
 * Wann der Kontakt wieder auf die Liste soll, nachdem etwas passiert ist.
 * Nach einer Ansprache fünf Tage — kürzer wirkt drängend, länger vergisst man
 * es. Nach einer Antwort oder einem Termin entscheidet Kevin selbst.
 */
export function wiedervorlageNach(art: AktivitaetArt, heute: string, tagePlus: (d: string, n: number) => string): string | undefined {
  if (art === 'mail' || art === 'linkedin' || art === 'whatsapp') return tagePlus(heute, 5);
  if (art === 'anruf') return tagePlus(heute, 3);
  return undefined;
}

/** Welche Stufe eine Aktivität nach sich zieht — nur vorwärts, nie zurück. */
export function stufeNach(art: AktivitaetArt, aktuell: Stufe): Stufe {
  const rang = (st: Stufe) => STUFEN.indexOf(st);
  let ziel: Stufe = aktuell;
  if (art === 'mail' || art === 'linkedin' || art === 'whatsapp' || art === 'anruf') ziel = 'angesprochen';
  if (art === 'antwort') ziel = 'gespraech';
  if (art === 'termin') ziel = 'termin';
  return rang(ziel) > rang(aktuell) && !ABGESCHLOSSEN.includes(aktuell) ? ziel : aktuell;
}

/**
 * Massen-Wache für Stufen — dieselbe Lehre wie bei den Aufgaben am 06.09.:
 * mehr als zwölf Kontakte auf einmal in eine andere Stufe zu schieben ist
 * nie ein Klick, sondern ein Fehler.
 */
export const MASSEN_GRENZE = 12;
export function massenStufe(alt: Kontakt[], neu: Kontakt[]): number {
  const vorher = new Map(alt.map(k => [k.id, k.stufe]));
  return neu.filter(k => vorher.has(k.id) && vorher.get(k.id) !== k.stufe).length;
}

/** Zusammenfassung für ZOE und die Kopfzeile. */
export function pipelineStand(kontakte: Kontakt[]): Record<Stufe, number> & { gesamt: number; ansprechbar: number } {
  const r = Object.fromEntries(STUFEN.map(st => [st, 0])) as Record<Stufe, number>;
  for (const k of kontakte) r[k.stufe] = (r[k.stufe] ?? 0) + 1;
  return { ...r, gesamt: kontakte.length, ansprechbar: kontakte.filter(k => !ABGESCHLOSSEN.includes(k.stufe) && ansprechbar(k)).length };
}

/** Anzeigename — nie leer, damit keine Zeile ohne Namen dasteht. */
export function anzeigename(k: Pick<Kontakt, 'vorname' | 'nachname' | 'firma' | 'email'>): string {
  const n = `${k.vorname ?? ''} ${k.nachname ?? ''}`.trim();
  return n || k.firma || k.email || 'Unbekannt';
}

/**
 * Einen Kontakt aus dem Netz prüfen. Alles, was nicht passt, fällt weg —
 * unbekannte Stufen, überlange Texte, fremde Felder. Was durchkommt, ist
 * genau das, was auch der Import erzeugt hätte.
 */
/**
 * Zeitpunkt eines Meetings (`Aktivitaet.wann`, 28.09.): Tag, Tag mit Uhrzeit (Berliner Zeit,
 * ohne Zone) oder ISO mit Zone. Alles andere fällt weg.
 */
export function wannSaeubern(v: unknown): string | undefined {
  const t = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(t)) return undefined;
  if (Number.isNaN(Date.parse(t.length === 10 ? `${t}T12:00:00Z` : mitZone(t) ? t : `${t.slice(0, 16)}:00Z`))) return undefined;
  // Ein Format (K3): ISO mit Zone → Berliner Wandzeit `YYYY-MM-DDTHH:MM`; Sekunden fallen weg.
  return wannNorm(t);
}
/** `wann` in das EINE Format bringen (Tag oder Berliner Wandzeit ohne Sekunden) — auch für Altbestand beim Lesen. */
export function wannNorm(t: string): string {
  if (t.length === 10) return t;
  return mitZone(t) ? (berlinWand(t) ?? t.slice(0, 16)) : t.slice(0, 16);
}
const BERLIN_WAND = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** Berliner Wandzeit `YYYY-MM-DDTHH:MM` eines Zeitpunkts mit Zone. */
function berlinWand(iso: string): string | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const p = Object.fromEntries(BERLIN_WAND.formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function mitZone(t: string): boolean { return /(Z|[+-]\d{2}:\d{2})$/.test(t); }
/** Der Berliner Tag eines Meeting-Zeitpunkts (`wann`; Altbestand mit Zone wird umgerechnet). */
export function wannTag(wann: string): string {
  return wannNorm(wann).slice(0, 10);
}
/**
 * Liegt das Meeting noch vor uns (28.09., Prüfbericht F1)? Ein geplantes Meeting ist noch kein
 * Kontakt — erst wenn es vorbei ist, zählt es (Kadenz über `letzterKontaktVon`). Ein Meeting nur
 * mit Tag gilt am Tag selbst als stattgefunden.
 */
export function wannInZukunft(wann: string | undefined, jetztIso: string): boolean {
  if (!wann) return false;
  const w = wannNorm(wann);
  const jetzt = berlinWand(jetztIso);
  if (!jetzt) return false;
  if (w.length === 10) return w > jetzt.slice(0, 10);
  return w > jetzt;
}
/**
 * Letzter echter Kontakt für die Kadenz: das gespeicherte Feld oder ein Meeting, dessen Tag
 * inzwischen erreicht ist (geplante Meetings setzen `letzterKontakt` beim Eintragen nicht).
 */
export function letzterKontaktVon(k: Pick<Kontakt, 'letzterKontakt' | 'aktivitaeten'>, heute: string): string | undefined {
  let letzter = k.letzterKontakt;
  for (const a of k.aktivitaeten ?? []) {
    // Ereigniszeit für alle echten Kontakte (U2 #46): `wann ?? am` — hier zählt nur, was `wann` trägt
    // (ohne `wann` hat `wendeAktivitaetAn` den letzten Kontakt schon beim Festhalten gesetzt).
    if (!a.wann || !echterKontakt(a)) continue;
    const t = wannTag(a.wann);
    if (t <= heute && (!letzter || t > letzter)) letzter = t;
  }
  return letzter;
}

/** Ein echter Kontakt (zählt für „letzter Kontakt“): keine Notiz/Stufe/Systemzeile/Übergabe, kein bloßer Versuch. */
export function echterKontakt(a: Pick<Aktivitaet, 'art' | 'ergebnis'>): boolean {
  return a.art !== 'notiz' && a.art !== 'stufe' && a.art !== 'system' && a.art !== 'uebergabe' && a.ergebnis !== 'nicht_erreicht' && a.ergebnis !== 'mailbox';
}

/**
 * Ereigniszeit einer Aktivität in Millisekunden (U2 #46): `wann` (Tag = 12 Uhr, Wandzeit = Berliner Zeit,
 * ISO mit Zone), sonst `am`. Zum Sortieren „wann ?? am“.
 */
export function ereignisMs(a: Pick<Aktivitaet, 'am' | 'wann'>): number {
  const w = a.wann ? wannNorm(a.wann) : undefined;
  if (w) {
    if (w.length === 10) return Date.parse(`${w}T12:00:00Z`);
    // Berliner Wandzeit → UTC: Versatz des Tages aus der Zeitzone rechnen (Sommer +2, Winter +1).
    const roh = Date.parse(`${w.slice(0, 16)}:00Z`);
    const wand = berlinWand(new Date(roh).toISOString());
    const versatz = wand ? Date.parse(`${wand}:00Z`) - roh : 0;
    return roh - versatz;
  }
  const t = Date.parse(a.am);
  return Number.isNaN(t) ? 0 : t;
}

/** Ort oder Videolink: eine Zeile, höchstens 160 Zeichen. */
export function ortSaeubern(v: unknown): string | undefined {
  const t = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  return t || undefined;
}
const zeitpunktSaeubern = (v: unknown): string | undefined => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(v) && v.length <= 30 ? v : undefined);

/**
 * Obergrenzen je Kontakt (K2, 28.09.) — „nie abschneiden“: vorher kürzte die Säuberung still auf die letzten
 * 600 Aktivitäten und 30 Einwilligungen, jedes Speichern verlor so den ältesten Verlauf. Jetzt gilt: liegt ein
 * Eintrag darüber, wird er ABGELEHNT (die Route antwortet 413), nie gekürzt. Lesen kürzt nie.
 */
export const AKTIVITAETEN_MAX = 10_000;
export const EINWILLIGUNGEN_MAX = 500;
/** Überschreitet ein roher Kontakt (oder die Felder eines `teil`) eine Obergrenze? Dann der Grund, sonst null. */
export function kontaktZuGross(e: unknown): string | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  if (Array.isArray(o.aktivitaeten) && o.aktivitaeten.length > AKTIVITAETEN_MAX) return `Mehr als ${AKTIVITAETEN_MAX} Aktivitäten an einem Kontakt — abgelehnt, nichts gekürzt.`;
  if (Array.isArray(o.einwilligungen) && o.einwilligungen.length > EINWILLIGUNGEN_MAX) return `Mehr als ${EINWILLIGUNGEN_MAX} Einwilligungen an einem Kontakt — abgelehnt, nichts gekürzt.`;
  if (Array.isArray(o.stationen) && o.stationen.length > STATIONEN_MAX) return `Mehr als ${STATIONEN_MAX} Stationen an einem Kontakt — abgelehnt, nichts gekürzt.`;
  if (Array.isArray(o.emails) && o.emails.length > EMAILS_MAX) return `Mehr als ${EMAILS_MAX} E-Mail-Adressen an einem Kontakt — abgelehnt, nichts gekürzt.`;
  if (Array.isArray(o.kennengelerntFuer) && o.kennengelerntFuer.length > KENNENGELERNT_MAX) return `Mehr als ${KENNENGELERNT_MAX} Einträge in „kennengelerntFuer“ an einem Kontakt — abgelehnt, nichts gekürzt.`;
  for (const f of ['typen', 'kategorien', 'labels'] as const) if (Array.isArray(o[f]) && (o[f] as unknown[]).length > MEHRFACH_MAX) return `Mehr als ${MEHRFACH_MAX} Einträge in „${f}“ an einem Kontakt — abgelehnt, nichts gekürzt.`;
  return null;
}

/** Höchstens so viele „für Kunden kennengelernt“-Einträge an einer Person (darüber lehnt `kontaktZuGross` ab, nie still gekürzt). */
export const KENNENGELERNT_MAX = 200;
/** Verweis auf die Interessenabwägung — nur Buchstaben, Ziffern, Leerzeichen und .-_ (Server stempelt, z. B. „LIA-Netzwerken v1“). */
const RG_NOTIZ = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,59}$/;
function kennengelerntFuerSaeubern(v: unknown): NonNullable<Kontakt['kennengelerntFuer']> | undefined {
  if (!Array.isArray(v)) return undefined;
  const raus: NonNullable<Kontakt['kennengelerntFuer']> = [];
  const gesehen = new Set<string>();
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const firmaId = String(o.firmaId ?? ''), eventId = String(o.eventId ?? ''), am = String(o.am ?? '');
    if (!/^f-[a-z0-9-]{2,63}$/.test(firmaId) || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(eventId) || !/^\d{4}-\d{2}-\d{2}$/.test(am)) continue;
    const s = `${firmaId}|${eventId}`;
    if (gesehen.has(s)) continue;
    gesehen.add(s);
    raus.push({ firmaId, eventId, am });
  }
  return raus.length ? raus : undefined;
}

/** ISO-Zeitpunkt wie `toISOString` (Archiv-Marke der Kartei, 04.10.). */
const ISO_ZEIT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export function saeubereKontakt(e: unknown): Kontakt | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  const id = String(o.id ?? '').trim();
  if (!/^c-[a-z0-9-]{4,60}$/.test(id)) return null;
  const st = String(o.stufe ?? 'neu') as Stufe;
  if (!STUFEN.includes(st)) return null;
  const tag = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const txt = (v: unknown, n: number) => { const t = String(v ?? '').trim().slice(0, n); return t || undefined; };
  // Nie kürzen (K2): über der Grenze ist der ganze Eintrag ungültig — die Route lehnt vorher mit 413 ab.
  if (kontaktZuGross(o)) return null;
  const akt = Array.isArray(o.aktivitaeten) ? (o.aktivitaeten as unknown[]).map(a => {
    const x = (a ?? {}) as Record<string, unknown>;
    const art = String(x.art ?? '') as AktivitaetArt;
    if (!AKTIVITAET_ARTEN.includes(art)) return null;
    // Regel 5 (K2): ohne gültiges `von` nie „kevin“ — ein Eintrag ohne Urheber gilt als System.
    const von = typeof x.von === 'string' && /^[a-z0-9-]{1,40}$/.test(x.von) && x.von !== 'undefined' && x.von !== 'null' ? x.von : 'system';
    const ergebnis = ERGEBNISSE.includes(x.ergebnis as Ergebnis) ? (x.ergebnis as Ergebnis) : undefined;
    const n = x.notiz && typeof x.notiz === 'object' ? x.notiz as Record<string, unknown> : null;
    const notiz = n ? Object.fromEntries(NOTIZ_FELDER.map(f => [f.id, txt(n[f.id], 1500)]).filter(([, v]) => v)) as NotizVorlage : undefined;
    const wann = wannSaeubern(x.wann), ort = ortSaeubern(x.ort), bearbeitet = zeitpunktSaeubern(x.bearbeitet), anlass = txt(x.anlass, 600);
    // Termin-Verweis (K3): Schlüssel `uid` bzw. `uid::RECURRENCE-ID` — eine Zeile, begrenzt.
    const terminUid = typeof x.terminUid === 'string' && /^[^\u0000-\u001f\u007f]{1,300}$/.test(x.terminUid) ? x.terminUid : undefined;
    const aktFirma = typeof x.firmaId === 'string' && /^f-[a-z0-9-]{2,63}$/.test(x.firmaId) ? x.firmaId : undefined;
    const mailLink = typeof x.mailLink === 'string' && /^\/os\/inbox\?offen=(gmail-[A-Za-z0-9]{6,40}|im~pf-[0-9a-f-]{36}~[0-9a-f]{20})$/.test(x.mailLink) ? x.mailLink : undefined;
    const aufgabeId = typeof x.aufgabeId === 'string' && AUFGABE_KENNUNG.test(x.aufgabeId) ? x.aufgabeId : undefined;
    return {
      am: String(x.am ?? '').slice(0, 25), art, ...(txt(x.text, 3000) ? { text: txt(x.text, 3000) } : {}), von,
      ...(ergebnis ? { ergebnis } : {}), ...(notiz && Object.keys(notiz).length ? { notiz } : {}), ...(txt(x.bezug, 60) ? { bezug: txt(x.bezug, 60) } : {}),
      ...(wann && !terminUid ? { wann } : {}), ...(terminUid ? { terminUid } : {}), ...(ort ? { ort } : {}), ...(bearbeitet ? { bearbeitet } : {}), ...(aktFirma ? { firmaId: aktFirma } : {}),
      ...(anlass ? { anlass } : {}), ...(mailLink ? { mailLink } : {}), ...(aufgabeId ? { aufgabeId } : {}),
    } as Aktivitaet;
  }).filter((a): a is Aktivitaet => !!a) : [];
  // Löschmarken (28.09., H4): markierte Fassungen fallen hier heraus — egal, welcher Weg sie zurückbringen wollte.
  const geloeschteAktivitaeten = markenSaeubern(o.geloeschteAktivitaeten);
  const verlauf = ohneMarkierte(akt, geloeschteAktivitaeten);
  // Einwilligungen mit vollem Nachweis (28.09., U2 #55): Zeitpunkt, erfasst von, Wortlaut, Beleg, Widerruf — lib/crm/einwilligung.ts.
  const einwilligungen = Array.isArray(o.einwilligungen) ? (o.einwilligungen as unknown[]).map(einwilligungSaeubern).filter((e): e is Einwilligung => !!e) : undefined;
  const eingeschraenkt = einschraenkungSaeubern(o.eingeschraenkt);
  const pv = typeof o.geprueftVon === 'string' && /^[a-z0-9-]{1,40}$/.test(o.geprueftVon) ? o.geprueftVon : undefined;
  const hbe = o.hinweisBeiErhebung && typeof o.hinweisBeiErhebung === 'object' ? o.hinweisBeiErhebung as Record<string, unknown> : null;
  const lfv = o.loeschfristVerlaengert && typeof o.loeschfristVerlaengert === 'object' ? o.loeschfristVerlaengert as Record<string, unknown> : null;
  const loeschfristVerlaengert = lfv && tag(lfv.bis) && tag(lfv.am) && txt(lfv.grund, 300) ? { bis: tag(lfv.bis)!, grund: txt(lfv.grund, 300)!, von: /^[a-z0-9-]{1,40}$/.test(String(lfv.von ?? '')) ? String(lfv.von) : 'system', am: tag(lfv.am)! } : undefined;
  const ws = o.werbesperre && typeof o.werbesperre === 'object' ? o.werbesperre as Record<string, unknown> : null;
  const ns = o.naechsterSchritt && typeof o.naechsterSchritt === 'object' ? o.naechsterSchritt as Record<string, unknown> : null;
  const kreis = ['A', 'B', 'C', 'D'].includes(String(o.kreis)) ? String(o.kreis) as Kreis : undefined;
  const lebensphase = LEBENSPHASEN.includes(o.lebensphase as Lebensphase) ? o.lebensphase as Lebensphase : undefined;
  const rollen = Array.isArray(o.rollen) ? Array.from(new Set((o.rollen as unknown[]).filter((r): r is Rolle => ROLLEN.includes(r as Rolle)))).slice(0, ROLLEN.length) : undefined;
  const takt = Number(o.taktTage);
  // Herkunft je Feld (27.09.): nur bekannte Stammdaten-Feldnamen, höchstens VON_HAND_MAX.
  const vonHand = Array.isArray(o.vonHand) ? Array.from(new Set((o.vonHand as unknown[]).filter((f): f is string => typeof f === 'string' && istStammdatenFeld(f)))).slice(0, VON_HAND_MAX) : undefined;
  // Stationen und Adressen (28.09.): ein leeres Array bleibt (ausdrücklich „keine“) — fehlt es, bleibt das Feld weg.
  const stationen = stationenSaeubern(o.stationen);
  const emails = emailsSaeubern(o.emails);
  const typen = werteSaeubern(o.typen, 40), kategorien = werteSaeubern(o.kategorien, 80), labels = werteSaeubern(o.labels, 60);
  const k: Kontakt = {
    id, vorname: String(o.vorname ?? '').trim().slice(0, 80), nachname: String(o.nachname ?? '').trim().slice(0, 80),
    email: txt(o.email, 160)?.toLowerCase(), telefon: txt(o.telefon, 60), sms: txt(o.sms, 60),
    jobtitel: txt(o.jobtitel, 120), position: txt(o.position, 160), senioritaet: txt(o.senioritaet, 60),
    linkedin: txt(o.linkedin, 200), personInfo: txt(o.personInfo, 800),
    firma: txt(o.firma, 160), firmaDomain: txt(o.firmaDomain, 120), firmaWebseite: txt(o.firmaWebseite, 200),
    firmaBranche: txt(o.firmaBranche, 120), firmaMitarbeiter: txt(o.firmaMitarbeiter, 40), firmaUmsatz: txt(o.firmaUmsatz, 60),
    firmaStadt: txt(o.firmaStadt, 80), firmaGegruendet: txt(o.firmaGegruendet, 20), firmaLinkedin: txt(o.firmaLinkedin, 200),
    firmaTelefon: txt(o.firmaTelefon, 60), firmaEmail: txt(o.firmaEmail, 160),
    marktinfo: txt(o.marktinfo, 800), signale: txt(o.signale, 600), kiBezug: txt(o.kiBezug, 400),
    typ: txt(o.typ, 40), eignung: (['ja', 'vielleicht', 'nein'].includes(String(o.eignung)) ? String(o.eignung) : '') as Eignung,
    prio: (['A', 'B', 'C'].includes(String(o.prio)) ? String(o.prio) : '') as Prio,
    aufhaenger: txt(o.aufhaenger, 600), kategorie: txt(o.kategorie, 80), owner: txt(o.owner, 60),
    lifecycle: txt(o.lifecycle, 40), quelle: txt(o.quelle, 120), recherche: txt(o.recherche, 60),
    notiz: txt(o.notiz, 2000), hubspotId: txt(o.hubspotId, 40), steckbrief: txt(o.steckbrief, 400),
    ...(/^f-[a-z0-9-]{2,60}$/.test(String(o.firmaId ?? '')) ? { firmaId: String(o.firmaId) } : {}),
    ...(kreis ? { kreis } : {}), ...(takt >= 7 && takt <= 730 ? { taktTage: Math.round(takt) } : {}),
    ...(txt(o.besitzer, 40) ? { besitzer: txt(o.besitzer, 40) } : {}), ...(lebensphase ? { lebensphase } : {}), ...(istLifecycle(o.phase) ? { phase: o.phase } : {}), ...(rollen?.length ? { rollen } : {}), ...(leadSaeubern(o.lead) ? { lead: leadSaeubern(o.lead) } : {}),
    ...(netzwerkSaeubern(o.netzwerk) ? { netzwerk: netzwerkSaeubern(o.netzwerk) } : {}), ...(tag(o.linkedinNichtGefunden) ? { linkedinNichtGefunden: tag(o.linkedinNichtGefunden) } : {}),
    ...(o.anrede === 'Sie' || o.anrede === 'Du' ? { anrede: o.anrede } : {}), ...(geburtstagSaeubern(o.geburtstag) ? { geburtstag: geburtstagSaeubern(o.geburtstag) } : {}), ...(txt(o.vorgestelltDurch, 60) ? { vorgestelltDurch: txt(o.vorgestelltDurch, 60) } : {}),
    ...(einwilligungen?.length ? { einwilligungen } : {}),
    ...(ws && tag(ws.seit) ? { werbesperre: { seit: tag(ws.seit)!, grund: txt(ws.grund, 300) ?? 'Widerspruch' } } : {}),
    ...(eingeschraenkt ? { eingeschraenkt } : {}),
    ...(tag(o.geprueftAm) ? { geprueftAm: tag(o.geprueftAm), ...(pv ? { geprueftVon: pv } : {}) } : {}),
    ...(hbe && tag(hbe.am) ? { hinweisBeiErhebung: { am: tag(hbe.am)!, ...(/^[a-z0-9-]{1,40}$/.test(String(hbe.von ?? '')) ? { von: String(hbe.von) } : {}) } } : {}),
    ...(loeschfristVerlaengert ? { loeschfristVerlaengert } : {}),
    ...(HERKUNFT.some(h => h.id === o.herkunft) ? { herkunft: o.herkunft as Herkunft } : {}),
    ...(RECHTSGRUNDLAGEN.some(r => r.id === o.rechtsgrundlage) ? { rechtsgrundlage: o.rechtsgrundlage as Rechtsgrundlage } : {}),
    ...(typeof o.rechtsgrundlageNotiz === 'string' && RG_NOTIZ.test(o.rechtsgrundlageNotiz) ? { rechtsgrundlageNotiz: o.rechtsgrundlageNotiz } : {}),
    ...(kennengelerntFuerSaeubern(o.kennengelerntFuer) ? { kennengelerntFuer: kennengelerntFuerSaeubern(o.kennengelerntFuer) } : {}),
    ...(tag(o.datenschutzInformiertAm) ? { datenschutzInformiertAm: tag(o.datenschutzInformiertAm) } : {}),
    ...(o.fremddaten === true ? { fremddaten: true } : {}), ...(tag(o.art14InformiertAm) ? { art14InformiertAm: tag(o.art14InformiertAm) } : {}),
    ...(ns && txt(ns.text, 300) && tag(ns.datum) ? { naechsterSchritt: { text: txt(ns.text, 300)!, datum: tag(ns.datum)! } } : {}),
    ...(txt(o.privatNotiz, 2000) ? { privatNotiz: txt(o.privatNotiz, 2000), ...(/^[a-z0-9-]{1,40}$/.test(String(o.privatNotizVon ?? '')) ? { privatNotizVon: String(o.privatNotizVon) } : {}) } : {}),
    stufe: st, wiedervorlage: tag(o.wiedervorlage), letzterKontakt: tag(o.letzterKontakt),
    aktivitaeten: verlauf,
    importiertAm: String(o.importiertAm ?? '').slice(0, 10) || '', geaendertAm: String(o.geaendertAm ?? '').slice(0, 10) || '',
    ...(vonHand ? { vonHand } : {}),
    ...(zahlungSaeubern(o.zahlung) ? { zahlung: zahlungSaeubern(o.zahlung) } : {}),
    ...(istBean(o.bean) ? { bean: o.bean } : {}),
    ...(geloeschteAktivitaeten ? { geloeschteAktivitaeten } : {}),
    ...(stationen ? { stationen } : {}), ...(emails ? { emails } : {}),
    // Archiv der Kartei (04.10.): nur ein gültiger ISO-Zeitpunkt.
    ...(typeof o.archiviertAm === 'string' && ISO_ZEIT.test(o.archiviertAm) ? { archiviertAm: o.archiviertAm } : {}),
    ...(typen ? { typen } : {}), ...(kategorien ? { kategorien } : {}), ...(labels ? { labels } : {}),
  };
  if (!k.vorname && !k.nachname && !k.firma) return null;
  return k;
}

export interface AktivitaetEingabe {
  art: AktivitaetArt;
  text?: string;
  von: Aktivitaet['von'];
  ergebnis?: Ergebnis;
  notiz?: NotizVorlage;
  bezug?: string;
  /**
   * Wann es war bzw. ist (28.09.; seit U2 #46 für alle Arten — nachgetragener Anruf, Mail): gesäubert über
   * wannSaeubern. Ort nur bei Meetings.
   */
  wann?: string;
  ort?: string;
  /** Anlass eines Anrufs (U2 #58) — Pflicht bei gelber Telefon-Ampel (prüft die Route). */
  anlass?: string;
  /** Kennung des ZOE-Vorschlags, aus dem die Aktivität stammt (29.09., idempotente Freigabe). */
  vorschlagId?: string;
  /** Die Aufgabe, aus der die Aktivität stammt (08.10., 4.7, idempotent). */
  aufgabeId?: string;
  /** Aus einem ZOE-Vorschlag, freigegeben von … (29.09., #94). */
  quelle?: 'zoe';
  freigegebenVon?: string;
  /** Ausdrückliche Stufe gewinnt über die Regel. */
  stufe?: Stufe;
  wiedervorlage?: string;
}

/**
 * Eine Aktivität auf einen Kontakt anwenden — die eine Stelle, an der die
 * Regeln zusammenkommen: protokollieren, letzter Kontakt, Stufe vorwärts,
 * Wiedervorlage. Route und ZOE-Werkzeug rufen beide genau das hier.
 */
/** Form einer ZOE-Vorschlags-Kennung (lib/zoe/stapel.ts: `v-<zeit>-<zufall>`). */
export const VORSCHLAG_KENNUNG = /^v-[a-z0-9-]{4,40}$/;
/** Form einer Aufgaben-Kennung am Verlauf (4.7) — alle Kennungsformen der Aufgaben (Unteraufgaben mit „--“ eingeschlossen). */
export const AUFGABE_KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

export function wendeAktivitaetAn(
  k: Kontakt, e: AktivitaetEingabe, heute: string, jetztIso: string,
  tagePlus: (d: string, n: number) => string,
): Kontakt {
  const eintrag: Aktivitaet = { am: jetztIso, art: e.art, ...(e.text ? { text: e.text } : {}), von: e.von,
    ...(e.ergebnis ? { ergebnis: e.ergebnis } : {}), ...(e.notiz ? { notiz: e.notiz } : {}), ...(e.bezug ? { bezug: e.bezug } : {}),
    ...(wannSaeubern(e.wann) ? { wann: wannSaeubern(e.wann) } : {}), ...(ortSaeubern(e.ort) ? { ort: ortSaeubern(e.ort) } : {}),
    ...(e.anlass?.trim() ? { anlass: e.anlass.trim().slice(0, 600) } : {}),
    ...(e.vorschlagId && VORSCHLAG_KENNUNG.test(e.vorschlagId) ? { vorschlagId: e.vorschlagId } : {}),
    ...(e.aufgabeId && AUFGABE_KENNUNG.test(e.aufgabeId) ? { aufgabeId: e.aufgabeId } : {}),
    ...(e.quelle === 'zoe' ? { quelle: 'zoe' as const, ...(e.freigegebenVon && /^[a-z0-9-]{1,40}$/.test(e.freigegebenVon) ? { freigegebenVon: e.freigegebenVon } : {}) } : {}),
    // Firma zum Zeitpunkt (28.09., Stationen): die Zeitlinie der Firma behält die Aktivität nach einem Jobwechsel.
    ...(k.firmaId ? { firmaId: k.firmaId } : {}) };
  const out: Kontakt = { ...k, aktivitaeten: [...(k.aktivitaeten ?? []), eintrag] };
  // Nur echter Kontakt zählt: ein nicht erreichter Anruf ist ein Versuch, kein Kontakt.
  const echt = echterKontakt(e);
  // Ein geplantes Meeting (wann in der Zukunft) ist noch kein Kontakt: weder letzter Kontakt noch
  // Stufe oder Wiedervorlage nach Regel — nur, was ausdrücklich mitkommt (Prüfbericht 28.09., F1).
  const geplant = e.art === 'termin' && wannInZukunft(eintrag.wann, jetztIso);
  // Ereigniszeit (U2 #46): ein nachgetragener Anruf von letzter Woche setzt den letzten Kontakt auf seinen Tag —
  // nie zurück (ein jüngerer Kontakt bleibt), nie in die Zukunft.
  if (echt && !geplant) {
    const tag = eintrag.wann ? wannTag(eintrag.wann) : heute;
    const t = tag > heute ? heute : tag;
    out.letzterKontakt = !k.letzterKontakt || t > k.letzterKontakt ? t : k.letzterKontakt;
  }
  out.stufe = e.stufe ?? (geplant ? k.stufe : stufeNach(e.art, k.stufe));
  const wv = e.wiedervorlage ?? (geplant ? undefined : wiedervorlageNach(e.art, heute, tagePlus));
  if (wv) out.wiedervorlage = wv;
  else if (!geplant && (e.art === 'antwort' || e.art === 'termin')) out.wiedervorlage = undefined;
  out.geaendertAm = heute;
  return out;
}

/**
 * Zu zweit und mit Hintergrundläufen (Signale, Heads, Aktivitäts-Route):
 * Die Oberfläche schickt den ganzen Kontakt aus IHREM Stand. Der Verlauf ist
 * ein Anhänge-Log — was der Server inzwischen angehängt hat, darf ein älterer
 * Stand nie wegwischen. Deshalb: Verlauf vereinen, letzter Kontakt = jüngster.
 */
export function kontaktVereinen(neu: Kontakt, alt: Kontakt, person?: string): Kontakt {
  const schluessel = (a: Aktivitaet) => `${a.am}|${a.art}|${a.bezug ?? ''}|${a.text ?? ''}`;
  // Löschmarken (28.09., H4): es gelten die gespeicherten — nur der Server setzt sie (POST /api/crm/aktivitaet).
  // Eine gelöschte oder geänderte Notiz im älteren Stand fällt heraus; beim Ändern gibt es so keine Doppelung.
  const marken = alt.geloeschteAktivitaeten;
  // System-Signale (Mail-Betreff, Termintitel — lib/crm/signale.ts) gehören dem Server: gibt es sie gespeichert, gilt
  // die gespeicherte Fassung (U2 #52 — ein älterer Stand holt keinen nach der Frist entfernten Betreff zurück).
  const signalAlt = new Map((alt.aktivitaeten ?? []).filter(a => a.von === 'system' && /^(mail|termin)-/.test(a.bezug ?? '')).map(a => [`${a.art}|${a.bezug}`, a]));
  const eigene = ohneMarkierte(neu.aktivitaeten ?? [], marken).map(a => (a.von === 'system' && a.bezug ? signalAlt.get(`${a.art}|${a.bezug}`) ?? a : a));
  const bekannt = new Set(eigene.map(schluessel));
  const fehlend = ohneMarkierte(alt.aktivitaeten ?? [], marken).filter(a => !bekannt.has(schluessel(a)));
  const letzter = [neu.letzterKontakt, alt.letzterKontakt].filter(Boolean).sort().pop();
  const { geloeschteAktivitaeten: _m, ...ohneMarken } = privatNotizVereinen(neu, alt, person);
  return {
    ...ohneMarken,
    aktivitaeten: fehlend.length ? [...eigene, ...fehlend].sort((a, b) => a.am.localeCompare(b.am)) : eigene,
    ...(marken?.length ? { geloeschteAktivitaeten: marken } : {}),
    ...(letzter ? { letzterKontakt: letzter } : {}),
    // LinkedIn je Profil: der weitere Schritt gewinnt — ein älterer Stand wischt kein „vernetzt“ weg.
    ...(neu.netzwerk || alt.netzwerk ? { netzwerk: netzwerkVereinen(neu.netzwerk, alt.netzwerk) } : {}),
  };
}


/**
 * Felder, die ein `teil` nie leert — Kennung, Pipeline-Kern und was nur der Server setzt.
 * Die Zahlung hat ihren eigenen Weg (`ibanEntfernen`, lib/crm/zahlung.ts).
 */
const NIE_LEEREN = new Set(['id', 'stufe', 'aktivitaeten', 'importiertAm', 'geaendertAm', 'vonHand', 'geloeschteAktivitaeten', 'stand', 'zahlung', 'stationen', 'emails', 'typen', 'kategorien', 'labels',
  // U2 (28.09.): Einwilligungen sind ein Nachweis (wächst nur), Einschränkung und Fristverlängerung setzt nur /api/crm/datenschutz, geprüft stempelt der Server.
  'einwilligungen', 'eingeschraenkt', 'loeschfristVerlaengert', 'geprueftAm', 'geprueftVon',
  // Netzwerken (03.10.): Server-Felder (Interessenabwägung, „für Kunden kennengelernt“, Datenschutzhinweis erteilt).
  'rechtsgrundlageNotiz', 'kennengelerntFuer', 'datenschutzInformiertAm']);

/**
 * Einzelne Felder auf den gespeicherten Kontakt legen (PATCH /api/state/kontakte, op `teil`).
 * `null` heißt „Feld entfernen“ (28.09., Prüfbericht F1): JSON kennt kein `undefined`, der Browser
 * übersetzt es in `kontaktTeil` zu `null` — sonst verschwände der Schlüssel unterwegs und das alte
 * Feld bliebe stehen („✓ erledigt“, Firma lösen, Sperre aufheben …). Das Ergebnis läuft danach
 * durch `saeubereKontakt`; `vonHandMarkieren` zählt ein geleertes Stammdaten-Feld als von Hand.
 */
export function teilAnwenden(alt: Kontakt, felder: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...alt };
  for (const [f, v] of Object.entries(felder)) {
    if (f === 'stand' || f === 'geloeschteAktivitaeten') continue;
    if (v === null) {
      if (NIE_LEEREN.has(f)) continue;
      delete out[f];
      if (f === 'privatNotiz') delete out.privatNotizVon;
    } else if (v !== undefined) out[f] = v;
  }
  return { ...out, id: alt.id, geloeschteAktivitaeten: alt.geloeschteAktivitaeten };
}

// ── Server-Felder und Werbesperre (K2, 28.09.) ───────────────────────────────

/**
 * `geaendertAm`, `importiertAm` und `vonHand` stempelt der Server (K2 #68) — was der Browser dafür schickt,
 * zählt nicht: `importiertAm` bleibt der gespeicherte (neu: heute), `geaendertAm` ist heute, `vonHand` ist
 * der gespeicherte plus jedes Stammdaten-Feld, das sich gegenüber dem Gespeicherten wirklich ändert.
 */
export function serverStempel(neu: Kontakt, alt: Kontakt | undefined, heute: string): Kontakt {
  const { vonHand: _browser, ...rest } = neu;
  const basis: Kontakt = { ...rest, importiertAm: alt?.importiertAm || heute, geaendertAm: heute, ...(alt?.vonHand ? { vonHand: alt.vonHand } : {}) };
  return vonHandMarkieren(alt, basis);
}

/**
 * Stationen und E-Mail-Adressen (28.09.) mit den abgeleiteten Feldern (`firmaId`/`firma`/`position`, `email`)
 * synchron halten — jeder Schreibweg der Kartei ruft das VOR `serverStempel` (lib/crm/stationen.ts, lib/crm/emails.ts).
 */
export function bezuegeSynchron(neu: Kontakt, alt: Kontakt | undefined, heute: string, firmaName?: (id: string) => string | undefined): Kontakt {
  return stationenSynchron(emailsSynchron(mehrfachSynchron(neu, alt), alt), alt, heute, firmaName);
}

/** Die neuen, gültigen Einwilligungen in `neu` gegenüber `alt` (gleiche Fassung zählt nicht). */
function neueEinwilligungen(alt: Kontakt, neu: unknown): Einwilligung[] {
  if (!Array.isArray(neu)) return [];
  const da = new Set((alt.einwilligungen ?? []).map(e => JSON.stringify(e)));
  return (neu as Einwilligung[]).filter(e => e && typeof e === 'object' && !da.has(JSON.stringify(e)));
}

/**
 * Werbesperre aufheben (K2 #64) nur mit Nachweis im SELBEN Schritt: der `teil` bringt eine neue, nicht
 * widerrufene Einwilligung mit Wortlaut/Beleg (≥ 3 Zeichen), erteilt am Tag der Sperre oder danach.
 * Liefert den Ablehnungsgrund oder null. Ein ganzer Eintrag (`upsert`) hebt nie auf (`sperreBehalten`).
 */
export function sperreAufhebenPruefen(alt: Kontakt, felder: Record<string, unknown>): string | null {
  if (!alt.werbesperre || felder.werbesperre !== null) return null;
  const ok = neueEinwilligungen(alt, felder.einwilligungen).some(e => typeof e.nachweis === 'string' && e.nachweis.trim().length >= 3 && !e.widerrufenAm
    && typeof e.erteiltAm === 'string' && e.erteiltAm >= alt.werbesperre!.seit);
  return ok ? null : 'Werbesperre aufheben nur mit neuer Einwilligung samt Nachweis im selben Schritt.';
}

/** Nach dem Aufheben: System-Aktivität mit Kanal und Nachweis (wer, wann, worauf gestützt). */
export function sperreAufhebenVermerk(alt: Kontakt, neu: Kontakt, person: string, jetztIso: string): Kontakt {
  if (!alt.werbesperre || neu.werbesperre) return neu;
  const e = neueEinwilligungen(alt, neu.einwilligungen).find(x => x.nachweis?.trim());
  const text = `Werbesperre aufgehoben (seit ${alt.werbesperre.seit}) — neue Einwilligung${e ? ` (${e.kanal}, ${e.erteiltAm}): „${e.nachweis.trim().slice(0, 200)}“` : ''}`;
  return { ...neu, aktivitaeten: [...(neu.aktivitaeten ?? []), { am: jetztIso, art: 'system', text, von: person }] };
}

/** Ein ganzer Eintrag ohne Sperre (älteres Fenster, ZOE) hebt eine gespeicherte Sperre nie auf — Sperre gewinnt. */
export function sperreBehalten(neu: Kontakt, alt: Kontakt): Kontakt {
  return alt.werbesperre && !neu.werbesperre ? { ...neu, werbesperre: alt.werbesperre } : neu;
}

// ── Private Notiz: nur für die Person, die sie schrieb (Kevins Entscheidung 25.09.) ──
/** Vor dem 25.09. schrieb nur Kevin private Notizen — ohne Verfasser gelten sie als seine. */
export const privatNotizVerfasser = (k: Pick<Kontakt, 'privatNotiz' | 'privatNotizVon'>) => (k.privatNotiz ? k.privatNotizVon ?? 'kevin' : undefined);

/**
 * Die private Notiz beim Speichern: Wer nicht Verfasser ist, kann sie weder
 * sehen noch überschreiben oder löschen — sein Stand trägt sie ja gar nicht.
 * Der Verfasser (oder wer die erste Notiz schreibt) setzt sie frei.
 */
export function privatNotizVereinen(neu: Kontakt, alt: Kontakt | undefined, person?: string): Kontakt {
  const { privatNotiz: _n, privatNotizVon: _v, ...rest } = neu;
  const verfasser = alt ? privatNotizVerfasser(alt) : undefined;
  if (verfasser && person && verfasser !== person) return { ...rest, privatNotiz: alt!.privatNotiz, privatNotizVon: verfasser };
  if (!person) return neu.privatNotiz ? { ...rest, privatNotiz: neu.privatNotiz, privatNotizVon: neu.privatNotizVon ?? verfasser } : rest;
  return neu.privatNotiz ? { ...rest, privatNotiz: neu.privatNotiz, privatNotizVon: person } : rest;
}

/**
 * Für die Anzeige (jede Antwort an den Browser): fremde private Notizen entfernen und die
 * IBAN nur maskiert (28.09., H4 — `zahlungMaskiert`, dazu `ibanGesetzt`). `ibanVoll` nur für
 * die Auskunft nach Art. 15 (app/api/crm/datenschutz): dort gehört die IBAN der Person selbst.
 */
export function fuerPerson(k: Kontakt, person: string, opts: { ibanVoll?: boolean } = {}): Kontakt {
  const v = privatNotizVerfasser(k);
  const z = !opts.ibanVoll && k.zahlung?.iban ? { ...k, zahlung: zahlungMaskiert(k.zahlung) } : k;
  if (!v || v === person) return z;
  const { privatNotiz: _n, privatNotizVon: _v, ...rest } = z;
  return rest;
}

/** Kontakt nach Name, Firma, Mail oder Branche finden — für ZOE und die Suche. */
export function findeKontakte(kontakte: Kontakt[], frage: string, n = 5): Kontakt[] {
  const w = frage.toLowerCase().split(/\s+/).filter(Boolean);
  if (!w.length) return [];
  const punkte = (k: Kontakt) => {
    const name = anzeigename(k).toLowerCase();
    // Alle Adressen (28.09., #11) — wer unter seiner zweiten Adresse gesucht wird, wird gefunden.
    const mails = alleAdressen(k).join(' ');
    const felder = [name, k.firma ?? '', mails, k.firmaBranche ?? '', k.position ?? '', k.firmaStadt ?? ''].map(x => x.toLowerCase());
    let p = 0;
    for (const t of w) {
      if (name.includes(t)) p += 6;
      if ((k.firma ?? '').toLowerCase().includes(t)) p += 5;
      if (mails.includes(t)) p += 5;
      if (felder.some(f => f.includes(t))) p += 1;
    }
    return p;
  };
  return kontakte.map(k => ({ k, p: punkte(k) })).filter(x => x.p > 0)
    .sort((a, b) => b.p - a.p || PRIO_RANG[a.k.prio] - PRIO_RANG[b.k.prio]).slice(0, n).map(x => x.k);
}
