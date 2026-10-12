// ─── Unternehmen › Schild: Pflichtdokumente — Soll-Liste je Rechtsform und Status (rein, client-sicher, 10.10.) ───────
// „Welche Infos muss ich immer dokumentiert bei mir haben?“ — der Dokumentations-Pflichtsatz der Recherche (Abschnitt 1, 44 Punkte) als
// Katalog mit Rechtsform-Filter, Pflicht/empfohlen, Norm, Aufbewahrung und Prüf-Rhythmus. Gespeichert wird nur, was ein Mensch festhält
// (Dokument mit Status, Fassung, Ablauf, Datei-Kennungen); Soll, „fehlt“, „abgelaufen“, „prüfen“, „veraltet“ und „aufbewahren bis“ sind
// GERECHNET. Manches erkennt das Register selbst (Gesellschaftsvertrag, Gesellschaftervereinbarung, GF-Vertrag, Beschlüsse) — dann gilt
// es als vorhanden mit Weg dorthin, ohne doppelte Pflege. Keine Namen, keine Beträge.
// Hinweis, keine Rechtsberatung — anwaltlich gegenlesen.

import { aktiveEintraege, type RegisterGesellschaft } from '@/lib/gesellschaften/modell';
import type { Dokument, SchildGesellschaft } from './typen';
import type { SchildKontext } from './kontext';
import { geschaeftsjahresEnden, jahrePlus, jahresende, monatePlus, tagePlus } from './zeit';

export type DokGruppe = 'gesellschaft' | 'rechnungslegung' | 'personal' | 'datenschutz' | 'vertraege';
export const DOK_GRUPPEN: readonly { id: DokGruppe; label: string }[] = [
  { id: 'gesellschaft', label: 'Gesellschaftsrecht & Register' }, { id: 'rechnungslegung', label: 'Rechnungslegung, Steuern, Gewerbe' },
  { id: 'personal', label: 'Personal & Sozialversicherung' }, { id: 'datenschutz', label: 'Datenschutz, IT, Außenauftritt' },
  { id: 'vertraege', label: 'Verträge, Rechte, Entscheidungen' },
];

/** Aufbewahrung: Jahre ab Ende des Kalenderjahres der Fassung (§ 257 Abs. 5 HGB, § 147 Abs. 4 AO), dauerhaft, oder Laufzeit + 10 J. */
export type Aufbewahrung = { jahre: number; annahme?: true } | 'dauerhaft' | 'laufzeit10';

export interface DokKatalog {
  art: string;
  titel: string;
  gruppe: DokGruppe;
  /** Gilt für diese Gesellschaft? */
  gilt: (k: SchildKontext) => boolean;
  /** Pflicht oder empfohlen — kann vom Kontext abhängen (Beschlüsse: bei Einpersonen-Gesellschaft Pflicht). */
  stufe: (k: SchildKontext) => 'pflicht' | 'empfohlen';
  /** Steht auf der Soll-Liste (sonst nur ablegbar, z. B. Steuerbescheide). */
  soll: boolean;
  norm: string;
  aufbewahrung: Aufbewahrung;
  /** Alle n Monate prüfen (aus „Fassung vom“). */
  pruefenMonate?: number;
  /** Hat ein Ablaufdatum (Zertifikat …) — „gültig bis“ zählt. */
  ablauf?: true;
  /** Je Geschäftsjahr (Jahresabschluss, EÜR): Soll ist das Dokument des letzten Geschäftsjahres, dessen Frist verstrichen ist. */
  jeGeschaeftsjahr?: { fristMonate: number };
  /** Mehrere gleichzeitig üblich (AVV je Dienstleister, Vollmachten). */
  mehrfach?: true;
  /** Erkennt das Register selbst (dann vorhanden mit Weg dorthin). */
  ausRegister?: (g: RegisterGesellschaft) => boolean;
  /** Ganzer Satz: was genau gemeint ist, und wo es in MAKE OS sonst schon steht. */
  hinweis: string;
  /** Quelle laut Recherche (Kürzel) bzw. „Annahme“. */
  quelle: string;
}

const K = (k: SchildKontext) => k.kapital;
const HGB = (k: SchildKontext) => k.hgbKapital;
const ALLE = () => true;
const PFLICHT = () => 'pflicht' as const;
const EMPFOHLEN = () => 'empfohlen' as const;
const mitBeschaeftigten = (k: SchildKontext) => (k.beschaeftigte ?? 0) > 0;
const vertragDa = (art: string) => (g: RegisterGesellschaft) => aktiveEintraege(g.vertraege).some(v => v.art === art && (v.status === 'unterschrieben' || v.status === 'beurkundet'));

/** Der Katalog (research › 1a–1e). Neue Art = Zeile hier (Kennung nie ändern), Test in tests/unternehmen-schild.test.ts. */
export const DOKUMENT_KATALOG: readonly DokKatalog[] = [
  // ── 1a Gesellschaftsrecht & Register ──
  { art: 'satzung', titel: 'Gesellschaftsvertrag / Satzung (aktueller Wortlaut)', gruppe: 'gesellschaft', gilt: K, stufe: PFLICHT, soll: true, norm: '§ 54 Abs. 1 GmbHG', aufbewahrung: 'dauerhaft', ausRegister: g => vertragDa('gesellschaftsvertrag')(g) || aktiveEintraege(g.fassungen).some(f => f.merkmal === 'satzung' && !!f.dateiIds?.length), hinweis: 'Vollständiger Wortlaut mit Notarbescheinigung und alle früheren Fassungen (Historie unter „Beschlüsse & Satzung“); eine Änderung wirkt erst mit Eintragung (§ 54 Abs. 3 GmbHG).', quelle: 'Q25' },
  { art: 'hr-auszug', titel: 'Handelsregister-Auszug (aktuell und chronologisch)', gruppe: 'gesellschaft', gilt: K, stufe: EMPFOHLEN, soll: true, norm: '§ 29 HGB', aufbewahrung: 'dauerhaft', pruefenMonate: 12, hinweis: 'Nach jeder Eintragung neu abrufen; Banken, Notare und Kunden verlangen ihn. Jährlich prüfen (Annahme).', quelle: 'Q76' },
  { art: 'gesellschafterliste', titel: 'Gesellschafterliste (zuletzt im Register aufgenommen)', gruppe: 'gesellschaft', gilt: K, stufe: PFLICHT, soll: true, norm: '§ 40 GmbHG, § 16 Abs. 1 GmbHG', aufbewahrung: 'dauerhaft', hinweis: 'Unverzüglich nach jeder wirksamen Änderung neu einreichen; gegenüber der Gesellschaft gilt nur, wer in der Liste steht. „Veraltet“, sobald sich die Gesellschafter nach dieser Fassung geändert haben.', quelle: 'Q01' },
  { art: 'transparenzregister', titel: 'Transparenzregister: Mitteilung, Bestätigung und Ermittlung der wirtschaftlich Berechtigten', gruppe: 'gesellschaft', gilt: K, stufe: PFLICHT, soll: true, norm: '§§ 19, 20 GwG', aufbewahrung: 'dauerhaft', pruefenMonate: 12, hinweis: 'Einholen, aufbewahren, aktuell halten, unverzüglich mitteilen — ohne Mitteilungsfiktion seit 2021. Den Ermittlungsweg dokumentieren (wer hält über welche Kette was); jährlich mit der Cap-Table abgleichen.', quelle: 'Q09–Q12' },
  { art: 'gf-bestellung', titel: 'Bestellung der Geschäftsführung und Registeranmeldung', gruppe: 'gesellschaft', gilt: K, stufe: PFLICHT, soll: true, norm: '§ 46 Nr. 5, § 39 GmbHG', aufbewahrung: 'dauerhaft', hinweis: 'Gesellschafterbeschluss zur Bestellung (und Abberufung/Entlastung) samt Anmeldung zum Handelsregister.', quelle: 'Q24' },
  { art: 'gf-vertrag', titel: 'Anstellungsvertrag der Geschäftsführung', gruppe: 'gesellschaft', gilt: K, stufe: EMPFOHLEN, soll: true, norm: '§ 8 Abs. 3 S. 2 KStG', aufbewahrung: 'laufzeit10', ausRegister: vertragDa('gf-vertrag'), hinweis: 'Bei beherrschendem Gesellschafter-GF steuerlich faktisch Pflicht: im Voraus, klar, eindeutig, tatsächlich durchgeführt — sonst verdeckte Gewinnausschüttung.', quelle: 'Q47, Q48' },
  { art: 'befreiung-181', titel: 'Befreiung von § 181 BGB und Niederschrift jedes Insichgeschäfts', gruppe: 'gesellschaft', gilt: k => k.kapital && k.einpersonen, stufe: PFLICHT, soll: true, norm: '§ 35 Abs. 3 GmbHG', aufbewahrung: 'dauerhaft', hinweis: 'Einpersonen-Gesellschaft: jedes Rechtsgeschäft der Geschäftsführung mit sich selbst unverzüglich niederschreiben. Vorlage unter „Dokumente › Vorlagen“.', quelle: 'Q74' },
  { art: 'beschluesse', titel: 'Gesellschafterbeschlüsse und Protokolle', gruppe: 'gesellschaft', gilt: K, stufe: k => (k.einpersonen ? 'pflicht' : 'empfohlen'), soll: true, norm: '§ 48 Abs. 3, § 51 GmbHG', aufbewahrung: 'dauerhaft', ausRegister: g => aktiveEintraege(g.beschluesse).some(b => b.status === 'gefasst' || b.status === 'angemeldet' || b.status === 'eingetragen'), hinweis: 'Einpersonen-Gesellschaft: Niederschrift unverzüglich nach dem Beschluss, unterschreiben. Beschlüsse führt ihr im Beschluss-Buch unter „Beschlüsse & Satzung“.', quelle: 'Q02, Q75' },
  { art: 'vollmachten', titel: 'Vollmachten-Register (Prokura, Bank-, Portal-, Einzelvollmachten)', gruppe: 'gesellschaft', gilt: ALLE, stufe: EMPFOHLEN, soll: true, norm: '§ 53 HGB (Prokura)', aufbewahrung: 'dauerhaft', pruefenMonate: 12, mehrfach: true, hinweis: 'Je Vollmacht „gültig bis“ und Widerrufsstand; bei jedem Wechsel in der Geschäftsführung sofort prüfen (Annahme).', quelle: 'Annahme' },
  { art: 'gesellschaftervereinbarung', titel: 'Gesellschaftervereinbarung', gruppe: 'gesellschaft', gilt: k => k.kapital && k.gesellschafter >= 2, stufe: EMPFOHLEN, soll: true, norm: '§ 15 Abs. 4 GmbHG (Form)', aufbewahrung: 'dauerhaft', ausRegister: vertragDa('gesellschaftervereinbarung'), hinweis: 'Ab zwei Gesellschaftern: Vorkauf, Mitverkauf/Mitnahme, Vesting, Leaver, Wettbewerb, Informationsrechte; notariell, sobald sie Pflichten zur Abtretung enthält.', quelle: 'Q75' },
  { art: 'gesellschafterdarlehen', titel: 'Gesellschafterdarlehen, Rangrücktritt, Verrechnungskonten', gruppe: 'gesellschaft', gilt: K, stufe: EMPFOHLEN, soll: false, norm: '§ 19 Abs. 2 S. 2, § 39 Abs. 1 Nr. 5 InsO', aufbewahrung: 'laufzeit10', ausRegister: vertragDa('darlehen'), hinweis: 'Schriftlich und fremdüblich; ein Rangrücktritt lässt das Darlehen bei der Überschuldungsprüfung außer Betracht.', quelle: 'Q81, Q42' },
  { art: 'notfallplan', titel: 'Notfall- und Vertretungsplan', gruppe: 'gesellschaft', gilt: ALLE, stufe: EMPFOHLEN, soll: true, norm: '§ 15a Abs. 3 InsO', aufbewahrung: 'dauerhaft', pruefenMonate: 12, hinweis: 'Wer handelt, wenn die Geschäftsführung ausfällt (Vorsorgevollmacht mit Unternehmensbezug, Ersatz, Zugänge — nie Passwörter hier). Bei Führungslosigkeit werden Gesellschafter selbst antragspflichtig.', quelle: 'Q14' },
  { art: 'beteiligungsquoten', titel: 'Beteiligungsquoten zum 01.01. (Holding)', gruppe: 'gesellschaft', gilt: k => k.holding, stufe: EMPFOHLEN, soll: true, norm: '§ 8b Abs. 4 KStG, § 9 Nr. 2a GewStG', aufbewahrung: { jahre: 10 }, pruefenMonate: 12, hinweis: 'Steuerlich zählt die Quote zu Beginn des Jahres: unter 10 % (Dividenden) bzw. 15 % (Gewerbesteuer) fallen Privilegien weg.', quelle: 'Q44, Q46' },
  // ── 1b Rechnungslegung, Steuern, Gewerbe ──
  { art: 'jahresabschluss', titel: 'Jahresabschluss mit Feststellungsbeschluss und Offenlegungsnachweis', gruppe: 'rechnungslegung', gilt: HGB, stufe: PFLICHT, soll: true, norm: '§§ 264, 325 HGB; § 42a GmbHG', aufbewahrung: { jahre: 10 }, jeGeschaeftsjahr: { fristMonate: 12 }, mehrfach: true, hinweis: 'Bilanz, GuV, Anhang; Feststellung und Gewinnverwendung (UG: ¼ des Jahresüberschusses in die Rücklage), Nachweis der Offenlegung im Unternehmensregister. Soll ist der Abschluss des letzten Geschäftsjahres, dessen Offenlegungsfrist verstrichen ist.', quelle: 'Q03–Q07' },
  { art: 'euer', titel: 'Einnahmenüberschussrechnung bzw. Bilanz', gruppe: 'rechnungslegung', gilt: k => k.einzel, stufe: PFLICHT, soll: true, norm: '§ 4 Abs. 3 EStG, § 141 AO, § 241a HGB', aufbewahrung: { jahre: 10 }, jeGeschaeftsjahr: { fristMonate: 7 }, mehrfach: true, hinweis: 'Über 800.000 € Umsatz bzw. 80.000 € Gewinn: Buchführung nach Mitteilung des Finanzamts.', quelle: 'Q72, Q73' },
  { art: 'verfahrensdoku', titel: 'Verfahrensdokumentation (GoBD, inkl. E-Rechnung)', gruppe: 'rechnungslegung', gilt: ALLE, stufe: PFLICHT, soll: true, norm: 'GoBD; §§ 146, 147 AO', aufbewahrung: { jahre: 10 }, pruefenMonate: 12, hinweis: 'Wie Belege entstehen, erfasst und archiviert werden; bei E-Rechnungen den XML-Teil archivieren. Empfang von E-Rechnungen ist seit 2025 Pflicht.', quelle: 'Q79, Q77' },
  { art: 'steuer-stammdaten', titel: 'Steuer-Stammdaten (Steuernummer, USt-IdNr., W-IdNr.)', gruppe: 'rechnungslegung', gilt: ALLE, stufe: PFLICHT, soll: true, norm: '§ 139c AO; § 5 DDG', aufbewahrung: 'dauerhaft', hinweis: 'Nummern an einer Stelle; das Impressum nennt USt-IdNr. oder W-IdNr.', quelle: 'Q56, Q64' },
  { art: 'elster-zertifikat', titel: 'ELSTER-Organisationszertifikat', gruppe: 'rechnungslegung', gilt: ALLE, stufe: PFLICHT, soll: true, norm: 'ELSTER (3 Jahre gültig)', aufbewahrung: { jahre: 3, annahme: true }, ablauf: true, hinweis: '„Gültig bis“ eintragen — MAKE OS erinnert 90 Tage vorher. Das Zertifikat selbst gehört nie in die Ablage, nur der Vermerk.', quelle: 'Q65' },
  { art: 'steuerbescheide', titel: 'Steuerbescheide, Vorauszahlungsbescheide, Prüfungsberichte', gruppe: 'rechnungslegung', gilt: ALLE, stufe: PFLICHT, soll: false, norm: '§ 147 Abs. 1 Nr. 5 AO', aufbewahrung: { jahre: 6 }, mehrfach: true, hinweis: 'Ablaufhemmung, solange die Festsetzungsfrist offen ist.', quelle: 'Q08' },
  { art: 'gewerbeanmeldung', titel: 'Gewerbeanmeldung und Fragebogen zur steuerlichen Erfassung', gruppe: 'rechnungslegung', gilt: k => k.kapital || k.einzel, stufe: PFLICHT, soll: true, norm: '§ 14 GewO; § 138 AO', aufbewahrung: 'dauerhaft', hinweis: 'Mit allen Um- und Abmeldungen.', quelle: 'Q59, Q60' },
  { art: 'ihk', titel: 'IHK-Zugehörigkeit und Beitragsbescheide', gruppe: 'rechnungslegung', gilt: k => k.kapital || k.einzel, stufe: PFLICHT, soll: true, norm: '§§ 2, 3 IHKG', aufbewahrung: { jahre: 6, annahme: true }, pruefenMonate: 12, hinweis: 'Mitgliedschaft kraft Gesetzes; Befreiungen gibt es nicht für GmbH/UG.', quelle: 'Q58' },
  // ── 1c Personal & Sozialversicherung ──
  { art: 'arbeitsvertraege', titel: 'Arbeitsverträge und Nachweis der wesentlichen Bedingungen', gruppe: 'personal', gilt: mitBeschaeftigten, stufe: PFLICHT, soll: true, norm: '§ 2 NachwG', aufbewahrung: 'laufzeit10', mehrfach: true, hinweis: 'Fristen ab dem ersten Arbeitstag; Textform mit Empfangsnachweis möglich. Inhalte gehören nicht hierher — nur der Vermerk.', quelle: 'Q68' },
  { art: 'gefaehrdungsbeurteilung', titel: 'Gefährdungsbeurteilung und Unterweisungen', gruppe: 'personal', gilt: mitBeschaeftigten, stufe: PFLICHT, soll: true, norm: '§ 6 Abs. 1 ArbSchG', aufbewahrung: 'dauerhaft', pruefenMonate: 12, hinweis: 'Auch Büro und Homeoffice; Umfang nach Größe.', quelle: 'Q69' },
  { art: 'bg', titel: 'BG-Mitgliedschaft (Mitgliedsnummer, Veranlagungsbescheid)', gruppe: 'personal', gilt: mitBeschaeftigten, stufe: PFLICHT, soll: true, norm: '§ 192 SGB VII', aufbewahrung: 'dauerhaft', hinweis: 'Anmeldung binnen einer Woche nach Beginn (die Gewerbeanzeige gilt als Meldung).', quelle: 'Q33' },
  { art: 'zeiterfassung', titel: 'Arbeitszeiterfassung', gruppe: 'personal', gilt: mitBeschaeftigten, stufe: PFLICHT, soll: true, norm: 'BAG 13.09.2022 – 1 ABR 22/21', aufbewahrung: { jahre: 2, annahme: true }, hinweis: 'Beginn, Ende, Dauer inkl. Überstunden.', quelle: 'Q70' },
  { art: 'statusfeststellung', titel: 'Statusfeststellung Gesellschafter-Geschäftsführung', gruppe: 'personal', gilt: K, stufe: EMPFOHLEN, soll: true, norm: '§ 7a SGB IV', aufbewahrung: 'dauerhaft', hinweis: 'Empfohlen unter 50 % ohne Sperrminorität in der Satzung; bei jeder Anteilsänderung neu prüfen.', quelle: 'Q41' },
  { art: 'ksk', titel: 'Künstlersozialabgabe: Aufzeichnungen', gruppe: 'personal', gilt: k => !!k.profil.kreativeHonorare, stufe: PFLICHT, soll: true, norm: '§§ 27, 28 KSVG', aufbewahrung: { jahre: 5, annahme: true }, hinweis: 'Honorare an selbständige Kreative (Design, Text, Web, Foto).', quelle: 'Q35' },
  // ── 1d Datenschutz, IT, Außenauftritt ──
  { art: 'vvt', titel: 'Verzeichnis von Verarbeitungstätigkeiten', gruppe: 'datenschutz', gilt: ALLE, stufe: PFLICHT, soll: true, norm: 'Art. 30 DSGVO', aufbewahrung: 'dauerhaft', pruefenMonate: 12, hinweis: 'Praktisch immer Pflicht. MAKE OS führt das Verzeichnis der Instanz unter Einstellungen › Datenschutz — hier den Stand der Gesellschaft vermerken.', quelle: 'Q51, Q52' },
  { art: 'tom', titel: 'Technisch-organisatorische Maßnahmen (TOM)', gruppe: 'datenschutz', gilt: ALLE, stufe: PFLICHT, soll: true, norm: 'Art. 32, Art. 5 Abs. 2 DSGVO', aufbewahrung: 'dauerhaft', pruefenMonate: 12, hinweis: 'Jährlich prüfen.', quelle: 'Q51' },
  { art: 'avv', titel: 'Auftragsverarbeitungsverträge mit Dienstleistern', gruppe: 'datenschutz', gilt: ALLE, stufe: PFLICHT, soll: true, norm: 'Art. 28 Abs. 3 DSGVO', aufbewahrung: 'laufzeit10', pruefenMonate: 12, mehrfach: true, hinweis: 'Hosting, Mail, KI, Lohn-Rechenzentrum; Steuerberatung/Kanzlei i. d. R. keine Auftragsverarbeitung. Empfänger/AVV der Instanz: Einstellungen › Datenschutz.', quelle: 'Q51, Q85' },
  { art: 'datenschutzhinweise', titel: 'Datenschutzhinweise (Website, Kunden, Bewerber, Beschäftigte), Löschkonzept', gruppe: 'datenschutz', gilt: ALLE, stufe: PFLICHT, soll: true, norm: 'Art. 13/14, Art. 17, Art. 33 Abs. 5 DSGVO', aufbewahrung: 'dauerhaft', pruefenMonate: 12, hinweis: 'Mit Einwilligungsnachweisen und Pannen-Register (MAKE OS: Einstellungen › Datenschutz).', quelle: 'Q51' },
  { art: 'dsb', titel: 'Benennung Datenschutzbeauftragte(r)', gruppe: 'datenschutz', gilt: k => (k.beschaeftigte ?? 0) >= 20, stufe: PFLICHT, soll: true, norm: '§ 38 Abs. 1 BDSG', aufbewahrung: 'dauerhaft', hinweis: 'Ab 20 Personen, die ständig automatisiert verarbeiten (oder bei DSFA-pflichtiger Verarbeitung).', quelle: 'Q38' },
  { art: 'impressum', titel: 'Impressum und Pflichtangaben auf Geschäftsbriefen/E-Mails', gruppe: 'datenschutz', gilt: ALLE, stufe: PFLICHT, soll: true, norm: '§ 5 DDG; § 35a GmbHG', aufbewahrung: 'dauerhaft', pruefenMonate: 12, hinweis: 'Rechtsform, Sitz, Registergericht und Nummer, alle Geschäftsführer mit ausgeschriebenem Vornamen; nach jeder Änderung anpassen.', quelle: 'Q56, Q23' },
  { art: 'agb', titel: 'AGB, Datenschutzerklärung, Impressum — Versionen mit Gültig-ab', gruppe: 'datenschutz', gilt: ALLE, stufe: EMPFOHLEN, soll: true, norm: 'ODR-VO aufgehoben (VO (EU) 2024/3228)', aufbewahrung: 'dauerhaft', pruefenMonate: 12, mehrfach: true, hinweis: 'Beweis, welche Fassung galt; den OS-Plattform-Link seit 20.07.2025 entfernen.', quelle: 'Q87' },
  { art: 'ki-inventar', titel: 'KI-Inventar (Systeme, Zweck, Kennzeichnung, Schulung)', gruppe: 'datenschutz', gilt: ALLE, stufe: EMPFOHLEN, soll: true, norm: 'KI-VO Art. 4, Art. 50', aufbewahrung: 'dauerhaft', pruefenMonate: 12, hinweis: 'Art.-50-Transparenz gilt seit 02.08.2026.', quelle: 'Q40' },
  { art: 'notfallhandbuch-it', titel: 'Notfallhandbuch IT (Backups, Wiederanlauf, wer ruft wen)', gruppe: 'datenschutz', gilt: ALLE, stufe: EMPFOHLEN, soll: true, norm: 'GDV AVB Cyber (Obliegenheiten)', aufbewahrung: 'dauerhaft', pruefenMonate: 12, hinweis: 'In Cyber-Policen oft Obliegenheit; jährlich testen (Annahme).', quelle: 'Q84' },
  // ── 1e Verträge, Rechte, Entscheidungen ──
  { art: 'rechtekette', titel: 'Rechte-Kette (Nutzungsrechte an Software, Design, Texten, Fotos)', gruppe: 'vertraege', gilt: ALLE, stufe: EMPFOHLEN, soll: true, norm: '§ 31 UrhG', aufbewahrung: 'dauerhaft', mehrfach: true, hinweis: 'Ohne Vertrag bleiben die Rechte beim Urheber (Freelancer, Agentur).', quelle: 'Annahme' },
  { art: 'entscheidungsprotokolle', titel: 'Entscheidungsprotokolle wesentlicher Entscheidungen', gruppe: 'vertraege', gilt: ALLE, stufe: EMPFOHLEN, soll: true, norm: '§ 93 Abs. 1 S. 2 AktG (für GmbH entsprechend)', aufbewahrung: { jahre: 10, annahme: true }, mehrfach: true, hinweis: 'Das Schild der Business Judgement Rule: Informationsgrundlage, Alternativen, Risiken, Abwägung — vorher festhalten. Vorlage unter „Vorlagen“.', quelle: 'Q16, Q17' },
  { art: 'krisenfrueherkennung', titel: 'Krisenfrüherkennung (Liquiditätsplanung 24 Monate, Fortbestehensprognose)', gruppe: 'vertraege', gilt: K, stufe: PFLICHT, soll: true, norm: '§ 1 StaRUG; §§ 18, 19 InsO', aufbewahrung: { jahre: 10, annahme: true }, pruefenMonate: 1, hinweis: 'Form frei — die Finanzplanung in MAKE OS kann der Nachweis sein; einmal im Monat fortschreiben und hier bestätigen (Annahme).', quelle: 'Q13, Q81, Q82' },
  { art: 'vertrag', titel: 'Wesentlicher Vertrag', gruppe: 'vertraege', gilt: ALLE, stufe: EMPFOHLEN, soll: false, norm: '§ 257 HGB, § 147 AO', aufbewahrung: 'laufzeit10', mehrfach: true, hinweis: 'Verträge mit Fristen pflegt ihr unter „Verträge“ der Gesellschaft — sie erscheinen im Kalender.', quelle: 'Q07, Q08' },
  { art: 'sonstiges', titel: 'Sonstige Unterlage', gruppe: 'vertraege', gilt: ALLE, stufe: EMPFOHLEN, soll: false, norm: '—', aufbewahrung: { jahre: 10, annahme: true }, mehrfach: true, hinweis: 'Alles, was zur Firmen-Akte gehört.', quelle: '—' },
];

export const katalogVon = (art: string): DokKatalog | undefined => DOKUMENT_KATALOG.find(k => k.art === art);
export const DOK_ARTEN: readonly string[] = DOKUMENT_KATALOG.map(k => k.art);

// ── Status ───────────────────────────────────────────────────────────────────────────────────────────────────────

export type DokZustand = 'vorhanden' | 'fehlt' | 'abgelaufen' | 'pruefen' | 'veraltet' | 'entwurf' | 'nicht-noetig' | 'noch-nicht-faellig';
export const DOK_ZUSTAND_TEXT: Record<DokZustand, string> = {
  vorhanden: 'vorhanden', fehlt: 'fehlt', abgelaufen: 'abgelaufen', pruefen: 'prüfen', veraltet: 'veraltet', entwurf: 'Entwurf',
  'nicht-noetig': 'nicht nötig', 'noch-nicht-faellig': 'noch nicht fällig',
};

export interface DokSoll {
  katalog: DokKatalog;
  stufe: 'pflicht' | 'empfohlen';
  zustand: DokZustand;
  /** Das maßgebliche Dokument (jüngste Fassung dieser Art). */
  dok?: Dokument;
  /** Alle Dokumente dieser Art (ohne Papierkorb), jüngste zuerst. */
  alle: Dokument[];
  /** Im Register erkannt (Vertrag/Beschluss) — vorhanden ohne eigenen Eintrag. */
  ausRegister?: true;
  pruefenAm?: string;
  /** Bis wann aufbewahren (gerechnet) — `dauerhaft` = solange die Gesellschaft besteht + 10 J. nach Ende der Liquidation. */
  aufbewahrenBis?: string | 'dauerhaft';
  /** Für Dokumente je Geschäftsjahr: das Geschäftsjahr (Stichtag), das jetzt vorliegen muss. */
  noetigFuer?: string;
  /** Ganzer Satz zum Zustand. */
  grund?: string;
}

/** Jüngste Fassung zuerst (Fassung vom → Geschäftsjahr → angelegt). */
const juengste = (a: Dokument, b: Dokument) =>
  (b.fassungVom ?? '').localeCompare(a.fassungVom ?? '') || (b.geschaeftsjahr ?? 0) - (a.geschaeftsjahr ?? 0) || (b.angelegt ?? '').localeCompare(a.angelegt ?? '');

/** Aufbewahren bis — Fristbeginn ist das Ende des Kalenderjahres (§ 257 Abs. 5 HGB, § 147 Abs. 4 AO). */
export function aufbewahrenBis(d: Pick<Dokument, 'fassungVom' | 'gueltigBis' | 'angelegt' | 'geschaeftsjahr'>, a: Aufbewahrung): string | 'dauerhaft' | undefined {
  if (a === 'dauerhaft') return 'dauerhaft';
  const basis = a === 'laufzeit10' ? (d.gueltigBis ?? d.fassungVom) : (d.fassungVom ?? (d.geschaeftsjahr ? `${d.geschaeftsjahr}-12-31` : undefined) ?? d.angelegt?.slice(0, 10));
  if (!basis) return undefined;
  return jahrePlus(jahresende(basis), a === 'laufzeit10' ? 10 : a.jahre);
}

/** Letzte Gesellschafter-Änderung laut Register (Ein-/Austritt) — eine Gesellschafterliste davor ist veraltet. */
export function letzteGesellschafterAenderung(g: RegisterGesellschaft): string | undefined {
  const tage = aktiveEintraege(g.gesellschafter).flatMap(x => [x.eingetretenAm, x.ausgeschiedenAm]).filter((t): t is string => !!t).sort();
  return tage[tage.length - 1];
}

/**
 * Das Geschäftsjahr, dessen Dokument jetzt vorliegen muss: der jüngste Stichtag, dessen Frist (`fristMonate` nach dem Stichtag) schon
 * verstrichen ist — `undefined`, solange es keinen gibt (junge Gesellschaft).
 */
export function noetigesGeschaeftsjahr(k: SchildKontext, fristMonate: number, heute: string): string | undefined {
  const enden = geschaeftsjahresEnden(k.gjBeginn, tagePlus(heute, -3 * 366), heute, k.gegruendet);
  return enden.filter(e => monatePlus(e, fristMonate) < heute).pop();
}

/** Soll-Liste einer Gesellschaft mit Zustand je Dokument (rein). `nurSoll` = ohne frei ablegbare Arten ohne Eintrag. */
export function dokumenteSoll(g: RegisterGesellschaft, s: SchildGesellschaft | null | undefined, k: SchildKontext, heute: string): DokSoll[] {
  const docs = aktiveEintraege(s?.dokumente);
  const raus: DokSoll[] = [];
  for (const kat of DOKUMENT_KATALOG) {
    const alle = docs.filter(d => d.art === kat.art).sort(juengste);
    const gilt = kat.gilt(k);
    if (!gilt && !alle.length) continue;
    if (!kat.soll && !alle.length) continue;
    const stufe = kat.stufe(k);
    const basis = { katalog: kat, stufe, alle };
    const dok = alle.find(d => d.status !== 'entwurf') ?? alle[0];
    const auf = dok ? aufbewahrenBis(dok, kat.aufbewahrung) : undefined;
    const mit = (z: DokZustand, x: Partial<DokSoll> = {}): DokSoll => ({ ...basis, zustand: z, ...(dok ? { dok } : {}), ...(auf ? { aufbewahrenBis: auf } : {}), ...x });
    if (dok?.status === 'nicht-noetig') { raus.push(mit('nicht-noetig', { grund: dok.grund ? `Nicht nötig: ${dok.grund}` : 'Als „nicht nötig“ vermerkt.' })); continue; }
    if (!gilt) { raus.push(mit(dok?.status === 'entwurf' ? 'entwurf' : 'vorhanden', { grund: 'Gilt für diese Gesellschaft heute nicht — abgelegt bleibt es.' })); continue; }
    // Je Geschäftsjahr: das Dokument des Jahres, dessen Frist verstrichen ist.
    if (kat.jeGeschaeftsjahr) {
      const noetig = noetigesGeschaeftsjahr(k, kat.jeGeschaeftsjahr.fristMonate, heute);
      if (!noetig) { raus.push(mit(dok ? (dok.status === 'entwurf' ? 'entwurf' : 'vorhanden') : 'noch-nicht-faellig', dok ? {} : { grund: 'Noch kein Geschäftsjahr, dessen Frist verstrichen ist.' })); continue; }
      const jahr = Number(noetig.slice(0, 4));
      const passend = alle.find(d => d.status !== 'entwurf' && (d.geschaeftsjahr ?? Number((d.fassungVom ?? '').slice(0, 4))) >= jahr);
      if (!passend) { raus.push(mit(alle.some(d => d.status === 'entwurf') ? 'entwurf' : 'fehlt', { noetigFuer: noetig, grund: `Für das Geschäftsjahr bis ${noetig.slice(8, 10)}.${noetig.slice(5, 7)}.${noetig.slice(0, 4)} fehlt der Nachweis.` })); continue; }
      raus.push({ ...basis, zustand: 'vorhanden', dok: passend, noetigFuer: noetig, ...(aufbewahrenBis(passend, kat.aufbewahrung) ? { aufbewahrenBis: aufbewahrenBis(passend, kat.aufbewahrung) } : {}) });
      continue;
    }
    if (!dok) {
      if (kat.ausRegister?.(g)) { raus.push({ ...basis, zustand: 'vorhanden', ausRegister: true, grund: 'Im Gesellschafts-Register erfasst (Vertrag bzw. Beschluss).' }); continue; }
      raus.push(mit('fehlt'));
      continue;
    }
    if (dok.status === 'entwurf') { raus.push(mit('entwurf')); continue; }
    if (kat.ablauf && dok.gueltigBis && dok.gueltigBis < heute) { raus.push(mit('abgelaufen', { grund: `Gültig bis ${dok.gueltigBis.slice(8, 10)}.${dok.gueltigBis.slice(5, 7)}.${dok.gueltigBis.slice(0, 4)} — abgelaufen.` })); continue; }
    if (kat.art === 'gesellschafterliste') {
      const letzte = letzteGesellschafterAenderung(g);
      if (letzte && (!dok.fassungVom || dok.fassungVom < letzte)) { raus.push(mit('veraltet', { grund: 'Die Gesellschafter haben sich nach dieser Fassung geändert — neue Liste einreichen (§ 40 GmbHG).' })); continue; }
    }
    const pruefenAm = kat.pruefenMonate && dok.fassungVom ? monatePlus(dok.fassungVom, kat.pruefenMonate) : undefined;
    if (pruefenAm && pruefenAm <= heute) { raus.push(mit('pruefen', { pruefenAm, grund: `Zuletzt geprüft am ${dok.fassungVom!.slice(8, 10)}.${dok.fassungVom!.slice(5, 7)}.${dok.fassungVom!.slice(0, 4)} — fällige Prüfung (alle ${kat.pruefenMonate} Monat${kat.pruefenMonate === 1 ? '' : 'e'}).` })); continue; }
    if (kat.pruefenMonate && !dok.fassungVom) { raus.push(mit('pruefen', { grund: 'Ohne „Fassung vom“ lässt sich der Prüftermin nicht rechnen — Datum eintragen.' })); continue; }
    raus.push(mit('vorhanden', pruefenAm ? { pruefenAm } : {}));
  }
  return raus;
}

/** Schwere eines Zustands für die Ampel: rot · gelb · ok. */
export function dokSchwere(z: DokSoll): 'rot' | 'gelb' | 'ok' {
  if (z.zustand === 'vorhanden' || z.zustand === 'nicht-noetig' || z.zustand === 'noch-nicht-faellig') return 'ok';
  if (z.stufe === 'pflicht' && (z.zustand === 'fehlt' || z.zustand === 'abgelaufen')) return 'rot';
  return 'gelb';
}

/** Dokumente mit Ablauf (Zertifikate …) — Stichtage für Kalender und Erinnerung (90 Tage vorher). */
export const ABLAUF_VORLAUF_TAGE = 90;
