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

export type AktivitaetArt = 'mail' | 'linkedin' | 'anruf' | 'antwort' | 'termin' | 'notiz' | 'stufe' | 'gespraech' | 'event' | 'system' | 'uebergabe';
export const AKTIVITAET_ARTEN: readonly AktivitaetArt[] = ['mail', 'linkedin', 'anruf', 'antwort', 'termin', 'notiz', 'stufe', 'gespraech', 'event', 'system', 'uebergabe'];

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
   * Wann es stattfindet bzw. stattfand (28.09., H4) — v. a. Meetings: `YYYY-MM-DD` oder
   * `YYYY-MM-DDTHH:MM` (Berliner Zeit) bzw. ISO mit Zone. `am` bleibt, wann es festgehalten wurde.
   * Altbestand ohne `wann` trägt das Datum in der ersten Textzeile (`meetingAusText`).
   */
  wann?: string;
  /** Ort oder Videolink eines Meetings (28.09., H4). */
  ort?: string;
  /** Wann der Text zuletzt geändert wurde (eigene Notiz bearbeiten, 28.09.) — ISO. */
  bearbeitet?: string;
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
export type EinwilligungKanal = 'mail' | 'telefon' | 'social' | 'newsletter' | 'einladung';
export interface Einwilligung {
  kanal: EinwilligungKanal; grundlage: Grundlage; erteiltAm: string;
  /** Wortlaut oder Beleg („DOI 12.03.“, „im Gespräch am …: darf ich Ihnen … schicken? — ja“). */
  nachweis: string; widerrufenAm?: string;
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
  typ?: string;
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
  /** Verweis auf die Firma (CRM-Stammdaten, lib/crm/firmen.ts). */
  firmaId?: string;
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
  vorgestelltDurch?: string;
  einwilligungen?: Einwilligung[];
  /** Werbewiderspruch (Art. 21 DSGVO): sofort, dauerhaft, kein Import überschreibt ihn. */
  werbesperre?: { seit: string; grund: string };
  /** Woher die Daten stammen (Art. 14 DSGVO) und worauf die Verarbeitung beruht (Art. 6). */
  herkunft?: Herkunft;
  rechtsgrundlage?: Rechtsgrundlage;
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
}

/** Felder, die der Import NIE anfasst — das ist die Arbeit im CRM. */
export const PIPELINE_FELDER: (keyof Kontakt)[] = ['stufe', 'wiedervorlage', 'letzterKontakt', 'aktivitaeten', 'importiertAm',
  'firmaId', 'herkunft', 'rechtsgrundlage', 'kreis', 'taktTage', 'besitzer', 'lebensphase', 'anrede', 'vorgestelltDurch', 'einwilligungen', 'werbesperre', 'fremddaten', 'art14InformiertAm', 'naechsterSchritt', 'privatNotiz', 'netzwerk', 'linkedinNichtGefunden',
  'lead', 'rollen', 'privatNotizVon', 'stand', 'vonHand', 'phase', 'zahlung', 'bean', 'geloeschteAktivitaeten'];

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

const s = (v: unknown, n = 400) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9äöüß@.]/g, '');

// ── Tolerantes Matching (27.09.) ─────────────────────────────────────────────
// Die Masterliste schreibt „Dr. Jörg Müller“ und „Müller, Jörg“, die Kartei
// „Joerg Mueller“; die Firma heißt einmal „Testfirma GmbH & Co. KG“, einmal
// „Testfirma“. Für den Schlüssel zählt nur der Kern: Umlaute aufgelöst, Titel
// und Rechtsformen weg, Satzzeichen weg.
const UMLAUTE: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
const entumlauten = (t: string) => t.toLowerCase().replace(/[äöüß]/g, c => UMLAUTE[c] ?? c).normalize('NFKD').replace(/[̀-ͯ]/g, '');
const TITEL = new Set(['dr', 'prof', 'dipl', 'ing', 'mba', 'llm', 'phd', 'med', 'jur', 'rer', 'nat', 'pol', 'oec', 'habil', 'mag', 'msc', 'bsc', 'hc', 'dipling', 'diplkfm', 'kfm']);
const RECHTSFORMEN = new Set(['gmbh', 'ag', 'ug', 'kg', 'ohg', 'gbr', 'se', 'kgaa', 'mbh', 'inc', 'ltd', 'llc', 'corp', 'plc', 'sa', 'sarl', 'bv', 'nv', 'partg', 'mbb', 'eg', 'ev', 'ek', 'haftungsbeschraenkt', 'co', 'cokg', 'und', 'and']);
const woerter = (t: string) => entumlauten(t).replace(/\be\.\s?(k|v)\.?/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

/** Name ohne Titel, Umlaute und Satzzeichen — leer, wenn nichts übrig bleibt. */
export function normName(vorname?: string, nachname?: string): string {
  return woerter(`${vorname ?? ''} ${nachname ?? ''}`).filter(w => !TITEL.has(w)).join('');
}
/** Firma ohne Rechtsform, Umlaute und Satzzeichen. */
export function normFirma(firma?: string): string {
  return woerter(firma ?? '').filter(w => !RECHTSFORMEN.has(w)).join('');
}
/** Telefonnummer nur als Ziffern, Landesvorwahl 49 → 0. Leer unter sechs Ziffern (keine Durchwahl-Treffer). */
export function normTelefon(t?: string): string {
  const z = (t ?? '').replace(/\(0\)/g, '').replace(/[^0-9]/g, '').replace(/^0049/, '0').replace(/^49/, '0');
  return z.length >= 6 ? z : '';
}

/**
 * Der Schlüssel, unter dem ein Kontakt wiedererkannt wird.
 *
 * Reihenfolge: E-Mail vor HubSpot-ID vor Name+Firma. E-Mail ist am stabilsten;
 * die HubSpot-ID kennt nur der HubSpot-Teil der Liste; Name+Firma ist der
 * Notnagel für die Kontakte ohne Mail — seit 27.09. tolerant (normName/normFirma).
 * Ohne diesen Schlüssel würde jeder Import alle Zeilen neu anlegen.
 */
export function schluessel(k: { email?: string; hubspotId?: string; vorname?: string; nachname?: string; firma?: string }): string {
  const mail = norm(k.email ?? '');
  if (mail.includes('@')) return `m:${mail}`;
  if ((k.hubspotId ?? '').trim()) return `h:${norm(k.hubspotId!)}`;
  return `n:${normName(k.vorname, k.nachname)}|${normFirma(k.firma)}`;
}

/**
 * OWNER der Masterliste → Besitzer in der Kartei (Kevins Entscheidung 27.09.):
 * „Malin …“ → malin · „Kevin …“ → kevin · „… & …“ → beide · „(kein Owner)“, leer
 * oder ein fremder Name → kein Besitzer (bleibt für die Qualifizierungsrunde offen).
 * Die Kürzel sind die aus lib/crm/team.ts (kevin, malin, BEIDE) — hier ohne
 * Import, weil team.ts diese Datei einbindet.
 */
export function besitzerAusOwner(owner?: string): 'kevin' | 'malin' | 'beide' | undefined {
  const o = (owner ?? '').toLowerCase();
  const kevin = /\bkevin\b/.test(o), malin = /\bmalin\b/.test(o);
  if (kevin && malin) return 'beide';
  if (kevin) return 'kevin';
  if (malin) return 'malin';
  return undefined;
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
    letzterKontakt: s(z.LETZTER_KONTAKT, 20) || undefined,
    aktivitaeten: [],
    importiertAm: heute, geaendertAm: heute,
  };
  const besitzer = besitzerAusOwner(k.owner);
  if (besitzer) k.besitzer = besitzer;
  // Lifecycle (28.09.): die HubSpot-Spalte LIFECYCLE belegt die Phase nur vor — gesetzt wird sie von Hand.
  const phase = lifecycleAusListe(k.lifecycle);
  if (phase) k.phase = phase;
  k.id = 'c-' + schluessel(k).replace(/[^a-z0-9]/g, '').slice(0, 40) + '-' + kurzHash(schluessel(k));
  return k;
}

/** Kleiner, deterministischer Hash — damit die ID stabil bleibt und lesbar ist. */
function kurzHash(t: string): string {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36).slice(0, 6);
}

// ── Online gewinnt (Kevins Entscheidung 27.09.) ──────────────────────────────
// Malin pflegt online, Kevin pflegt die Liste. Beim Import füllt die Liste nur
// Lücken. Weicht ein gefülltes Feld ab, entscheidet die Herkunft: von Hand
// gesetzt → Konflikt (Feld, online, Liste) und nichts überschreiben; nur vom
// Import gesetzt → die Liste darf auffrischen wie bisher.

/** Ein Feld, bei dem Liste und Kartei auseinanderliegen — wird nicht angewandt, sondern vorgelegt. */
export interface Konflikt { kontaktId: string; feld: string; online: unknown; liste: unknown }

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
  for (const f of Object.keys(neu) as (keyof Kontakt)[]) {
    if (!istStammdatenFeld(f)) continue;
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
  if (geaendert) {
    out.geaendertAm = heute;
    // Ohne Herkunftsliste und ohne Handänderung (Faustregel sagt „nur Import“): ab jetzt exakt führen —
    // sonst würde das frische Änderungsdatum beim nächsten Import jede Abweichung zum Konflikt machen.
    if (!alt.vonHand && !nachImportGeaendert(alt)) out.vonHand = [];
  }
  return { kontakt: out, geaendert, konflikte };
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
  if (!felder.size && !alt?.vonHand && !neu.vonHand) return neu;
  return { ...neu, vonHand: Array.from(felder).slice(0, VON_HAND_MAX) };
}

/** Kein sicherer Treffer, aber vielleicht derselbe Mensch — Vorschlag, nie automatisch verschmolzen. */
export interface MoeglicheDublette { kontaktId: string; mitId?: string; grund: string }

/**
 * Mögliche Dubletten, die der Schlüssel nicht fängt: gleicher Name bei anderer
 * Firma (Jobwechsel? zweiter Eintrag?) oder gleiche Telefonnummer. Nur Paare,
 * an denen mindestens einer aus `nur` (die gerade importierten) beteiligt ist —
 * den ganzen Bestand prüft Kontakte › Dubletten.
 */
export function moeglicheDubletten(kontakte: Kontakt[], nur?: Set<string>, max = 300): MoeglicheDublette[] {
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
}

/** Ein Import über den ganzen Bestand — idempotent: zweimal laufen ändert nichts (Konflikte bleiben, bis sie gelöst sind). */
export function importieren(bestand: Kontakt[], zeilen: Record<string, string>[], heute: string): ImportErgebnis {
  const nachSchluessel = new Map(bestand.map(k => [schluessel(k), k]));
  let neu = 0, aktualisiert = 0, unveraendert = 0, ohneBesitzer = 0;
  const konflikte: Konflikt[] = [];
  const hinweise: MoeglicheDublette[] = [];
  const betroffen = new Set<string>();
  for (const z of zeilen) {
    const k = ausZeile(z, heute);
    if (!k.vorname && !k.nachname && !k.firma) continue;   // leere Zeile
    const key = schluessel(k);
    const alt = nachSchluessel.get(key);
    let fertig: Kontakt;
    if (!alt) { nachSchluessel.set(key, k); neu++; fertig = k; }
    else {
      const r = zusammenfuehren(alt, k, heute);
      nachSchluessel.set(key, r.kontakt);
      konflikte.push(...r.konflikte);
      if (r.geaendert) aktualisiert++; else unveraendert++;
      fertig = r.kontakt;
    }
    betroffen.add(fertig.id);
    if (!fertig.besitzer) ohneBesitzer++;
    // Vermerk aus der Liste („⚠ Owner klären (Dublette Kevin/Malin)“) — als Hinweis, nicht als Feld.
    if (/dublette/i.test(s(z.STATUS_RECHERCHE, 200))) hinweise.push({ kontaktId: fertig.id, grund: 'Liste: Owner klären' });
  }
  const kontakte = Array.from(nachSchluessel.values());
  return { kontakte, neu, aktualisiert, unveraendert, konflikte, ohneBesitzer, betroffen: Array.from(betroffen), moeglicheDubletten: [...moeglicheDubletten(kontakte, betroffen), ...hinweise] };
}

// ── Die Tagesliste ──────────────────────────────────────────────────────────

export interface Kanal { art: 'mail' | 'linkedin' | 'anruf'; ziel: string }

/** Über welche Wege der Kontakt erreichbar ist — in der Reihenfolge, in der
 *  Kevin sie nutzen sollte. LinkedIn zuerst bei kaltem Kontakt (§7 UWG),
 *  Mail zuerst, wenn es schon einen Draht gibt. */
export function kanaele(k: Kontakt): Kanal[] {
  const warm = k.stufe !== 'neu' && k.stufe !== 'ansprechen' || (k.kategorie ?? '').startsWith('Apple') || k.typ === 'Netzwerk';
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
    .filter(k => k.typ !== 'Dienstleister' && k.typ !== 'Investor')
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
  if (art === 'mail' || art === 'linkedin') return tagePlus(heute, 5);
  if (art === 'anruf') return tagePlus(heute, 3);
  return undefined;
}

/** Welche Stufe eine Aktivität nach sich zieht — nur vorwärts, nie zurück. */
export function stufeNach(art: AktivitaetArt, aktuell: Stufe): Stufe {
  const rang = (st: Stufe) => STUFEN.indexOf(st);
  let ziel: Stufe = aktuell;
  if (art === 'mail' || art === 'linkedin' || art === 'anruf') ziel = 'angesprochen';
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
  return Number.isNaN(Date.parse(t.length === 10 ? `${t}T12:00:00Z` : t)) ? undefined : t;
}
const BERLIN_WAND = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** Berliner Wandzeit `YYYY-MM-DDTHH:MM` eines Zeitpunkts mit Zone. */
function berlinWand(iso: string): string | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const p = Object.fromEntries(BERLIN_WAND.formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
const mitZone = (t: string) => /(Z|[+-]\d{2}:\d{2})$/.test(t);
/** Der Berliner Tag eines Meeting-Zeitpunkts (`wann`: Tag, Wandzeit oder ISO mit Zone). */
export function wannTag(wann: string): string {
  return mitZone(wann) ? (berlinWand(wann) ?? wann).slice(0, 10) : wann.slice(0, 10);
}
/**
 * Liegt das Meeting noch vor uns (28.09., Prüfbericht F1)? Ein geplantes Meeting ist noch kein
 * Kontakt — erst wenn es vorbei ist, zählt es (Kadenz über `letzterKontaktVon`). Ein Meeting nur
 * mit Tag gilt am Tag selbst als stattgefunden.
 */
export function wannInZukunft(wann: string | undefined, jetztIso: string): boolean {
  if (!wann) return false;
  if (mitZone(wann)) return Date.parse(wann) > Date.parse(jetztIso);
  const jetzt = berlinWand(jetztIso);
  if (!jetzt) return false;
  if (wann.length === 10) return wann > jetzt.slice(0, 10);
  return wann.slice(0, 16) > jetzt;
}
/**
 * Letzter echter Kontakt für die Kadenz: das gespeicherte Feld oder ein Meeting, dessen Tag
 * inzwischen erreicht ist (geplante Meetings setzen `letzterKontakt` beim Eintragen nicht).
 */
export function letzterKontaktVon(k: Pick<Kontakt, 'letzterKontakt' | 'aktivitaeten'>, heute: string): string | undefined {
  let letzter = k.letzterKontakt;
  for (const a of k.aktivitaeten ?? []) {
    if (a.art !== 'termin' || !a.wann) continue;
    const t = wannTag(a.wann);
    if (t <= heute && (!letzter || t > letzter)) letzter = t;
  }
  return letzter;
}

/** Ort oder Videolink: eine Zeile, höchstens 160 Zeichen. */
export function ortSaeubern(v: unknown): string | undefined {
  const t = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  return t || undefined;
}
const zeitpunktSaeubern = (v: unknown): string | undefined => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(v) && v.length <= 30 ? v : undefined);

export function saeubereKontakt(e: unknown): Kontakt | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  const id = String(o.id ?? '').trim();
  if (!/^c-[a-z0-9-]{4,60}$/.test(id)) return null;
  const st = String(o.stufe ?? 'neu') as Stufe;
  if (!STUFEN.includes(st)) return null;
  const tag = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const txt = (v: unknown, n: number) => { const t = String(v ?? '').trim().slice(0, n); return t || undefined; };
  const akt = Array.isArray(o.aktivitaeten) ? (o.aktivitaeten as unknown[]).slice(-600).map(a => {
    const x = (a ?? {}) as Record<string, unknown>;
    const art = String(x.art ?? '') as AktivitaetArt;
    if (!AKTIVITAET_ARTEN.includes(art)) return null;
    const von = /^[a-z0-9-]{1,40}$/.test(String(x.von)) ? String(x.von) : 'kevin';
    const ergebnis = ERGEBNISSE.includes(x.ergebnis as Ergebnis) ? (x.ergebnis as Ergebnis) : undefined;
    const n = x.notiz && typeof x.notiz === 'object' ? x.notiz as Record<string, unknown> : null;
    const notiz = n ? Object.fromEntries(NOTIZ_FELDER.map(f => [f.id, txt(n[f.id], 1500)]).filter(([, v]) => v)) as NotizVorlage : undefined;
    const wann = wannSaeubern(x.wann), ort = ortSaeubern(x.ort), bearbeitet = zeitpunktSaeubern(x.bearbeitet);
    return {
      am: String(x.am ?? '').slice(0, 25), art, ...(txt(x.text, 3000) ? { text: txt(x.text, 3000) } : {}), von,
      ...(ergebnis ? { ergebnis } : {}), ...(notiz && Object.keys(notiz).length ? { notiz } : {}), ...(txt(x.bezug, 60) ? { bezug: txt(x.bezug, 60) } : {}),
      ...(wann ? { wann } : {}), ...(ort ? { ort } : {}), ...(bearbeitet ? { bearbeitet } : {}),
    } as Aktivitaet;
  }).filter((a): a is Aktivitaet => !!a) : [];
  // Löschmarken (28.09., H4): markierte Fassungen fallen hier heraus — egal, welcher Weg sie zurückbringen wollte.
  const geloeschteAktivitaeten = markenSaeubern(o.geloeschteAktivitaeten);
  const verlauf = ohneMarkierte(akt, geloeschteAktivitaeten);
  const GRUNDLAGEN: Grundlage[] = ['einwilligung', 'bestandskunde_7_3', 'mutmasslich_b2b_tel', 'anfrage', 'vertrag', 'intro_akzeptiert'];
  const EW_KANAELE: EinwilligungKanal[] = ['mail', 'telefon', 'social', 'newsletter', 'einladung'];
  const einwilligungen = Array.isArray(o.einwilligungen) ? (o.einwilligungen as unknown[]).slice(0, 30).map(e => {
    const x = (e ?? {}) as Record<string, unknown>;
    if (!EW_KANAELE.includes(x.kanal as EinwilligungKanal) || !GRUNDLAGEN.includes(x.grundlage as Grundlage) || !tag(x.erteiltAm)) return null;
    return { kanal: x.kanal, grundlage: x.grundlage, erteiltAm: tag(x.erteiltAm), nachweis: txt(x.nachweis, 400) ?? '', ...(tag(x.widerrufenAm) ? { widerrufenAm: tag(x.widerrufenAm) } : {}) } as Einwilligung;
  }).filter((e): e is Einwilligung => !!e) : undefined;
  const ws = o.werbesperre && typeof o.werbesperre === 'object' ? o.werbesperre as Record<string, unknown> : null;
  const ns = o.naechsterSchritt && typeof o.naechsterSchritt === 'object' ? o.naechsterSchritt as Record<string, unknown> : null;
  const kreis = ['A', 'B', 'C', 'D'].includes(String(o.kreis)) ? String(o.kreis) as Kreis : undefined;
  const lebensphase = LEBENSPHASEN.includes(o.lebensphase as Lebensphase) ? o.lebensphase as Lebensphase : undefined;
  const rollen = Array.isArray(o.rollen) ? Array.from(new Set((o.rollen as unknown[]).filter((r): r is Rolle => ROLLEN.includes(r as Rolle)))).slice(0, ROLLEN.length) : undefined;
  const takt = Number(o.taktTage);
  // Herkunft je Feld (27.09.): nur bekannte Stammdaten-Feldnamen, höchstens VON_HAND_MAX.
  const vonHand = Array.isArray(o.vonHand) ? Array.from(new Set((o.vonHand as unknown[]).filter((f): f is string => typeof f === 'string' && istStammdatenFeld(f)))).slice(0, VON_HAND_MAX) : undefined;
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
    ...(o.anrede === 'Sie' || o.anrede === 'Du' ? { anrede: o.anrede } : {}), ...(txt(o.vorgestelltDurch, 60) ? { vorgestelltDurch: txt(o.vorgestelltDurch, 60) } : {}),
    ...(einwilligungen?.length ? { einwilligungen } : {}),
    ...(ws && tag(ws.seit) ? { werbesperre: { seit: tag(ws.seit)!, grund: txt(ws.grund, 300) ?? 'Widerspruch' } } : {}),
    ...(HERKUNFT.some(h => h.id === o.herkunft) ? { herkunft: o.herkunft as Herkunft } : {}),
    ...(RECHTSGRUNDLAGEN.some(r => r.id === o.rechtsgrundlage) ? { rechtsgrundlage: o.rechtsgrundlage as Rechtsgrundlage } : {}),
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
  /** Zeitpunkt und Ort eines Meetings (28.09.) — gesäubert über wannSaeubern/ortSaeubern. */
  wann?: string;
  ort?: string;
  /** Ausdrückliche Stufe gewinnt über die Regel. */
  stufe?: Stufe;
  wiedervorlage?: string;
}

/**
 * Eine Aktivität auf einen Kontakt anwenden — die eine Stelle, an der die
 * Regeln zusammenkommen: protokollieren, letzter Kontakt, Stufe vorwärts,
 * Wiedervorlage. Route und ZOE-Werkzeug rufen beide genau das hier.
 */
export function wendeAktivitaetAn(
  k: Kontakt, e: AktivitaetEingabe, heute: string, jetztIso: string,
  tagePlus: (d: string, n: number) => string,
): Kontakt {
  const eintrag: Aktivitaet = { am: jetztIso, art: e.art, ...(e.text ? { text: e.text } : {}), von: e.von,
    ...(e.ergebnis ? { ergebnis: e.ergebnis } : {}), ...(e.notiz ? { notiz: e.notiz } : {}), ...(e.bezug ? { bezug: e.bezug } : {}),
    ...(wannSaeubern(e.wann) ? { wann: wannSaeubern(e.wann) } : {}), ...(ortSaeubern(e.ort) ? { ort: ortSaeubern(e.ort) } : {}) };
  const out: Kontakt = { ...k, aktivitaeten: [...(k.aktivitaeten ?? []), eintrag] };
  // Nur echter Kontakt zählt: ein nicht erreichter Anruf ist ein Versuch, kein Kontakt.
  const echt = e.art !== 'notiz' && e.art !== 'stufe' && e.art !== 'system' && e.ergebnis !== 'nicht_erreicht' && e.ergebnis !== 'mailbox';
  // Ein geplantes Meeting (wann in der Zukunft) ist noch kein Kontakt: weder letzter Kontakt noch
  // Stufe oder Wiedervorlage nach Regel — nur, was ausdrücklich mitkommt (Prüfbericht 28.09., F1).
  const geplant = e.art === 'termin' && wannInZukunft(eintrag.wann, jetztIso);
  if (echt && !geplant) out.letzterKontakt = heute;
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
  const eigene = ohneMarkierte(neu.aktivitaeten ?? [], marken);
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
const NIE_LEEREN = new Set(['id', 'stufe', 'aktivitaeten', 'importiertAm', 'geaendertAm', 'vonHand', 'geloeschteAktivitaeten', 'stand', 'zahlung']);

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
    const felder = [name, k.firma ?? '', k.email ?? '', k.firmaBranche ?? '', k.position ?? '', k.firmaStadt ?? ''].map(x => x.toLowerCase());
    let p = 0;
    for (const t of w) {
      if (name.includes(t)) p += 6;
      if ((k.firma ?? '').toLowerCase().includes(t)) p += 5;
      if ((k.email ?? '').includes(t)) p += 5;
      if (felder.some(f => f.includes(t))) p += 1;
    }
    return p;
  };
  return kontakte.map(k => ({ k, p: punkte(k) })).filter(x => x.p > 0)
    .sort((a, b) => b.p - a.p || PRIO_RANG[a.k.prio] - PRIO_RANG[b.k.prio]).slice(0, n).map(x => x.k);
}
