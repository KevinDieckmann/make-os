// ─── Unternehmen › Schild: Pflichten-Kalender — Fristen GERECHNET aus Rechtsform, Geschäftsjahr und Ereignissen (rein, 10.10.) ──
// Research › 2a–2d: Jahreszyklus (aufstellen → feststellen → offenlegen), Register-/Behörden-Pflichten nach Ereignissen, Abgaben-Takt,
// Schwellen-Wächter. Fristen werden NIE gespeichert — nur der Vermerk „erledigt am“ (bzw. „trifft nicht zu“) je Regel und Periode.
// „Unverzüglich“ steht im Kalender als Vorschlag E + 14 Tage (Annahme der Recherche). Der Steuer-Takt (USt-VA, Vorauszahlungen,
// Erklärungen) wird hier NICHT ein zweites Mal gerechnet — er steht im Steuer-Modul; hier nur der Verweis (eine Quelle).
// Wer verantwortlich ist, steht als Rolle (Organ), nie als Name. Hinweis, keine Rechtsberatung — anwaltlich gegenlesen.

import { STEUER_FIRMEN } from '@/lib/steuern/rechnen';
import { aktiveEintraege } from '@/lib/gesellschaften/modell';
import type { Ereignis, EreignisArt, Rolle, SchildGesellschaft, Vermerk } from './typen';
import type { SchildKontext } from './kontext';
import { geschaeftsjahresEnden, gjLabel, monatePlus, tagePlus, tageZwischen } from './zeit';

export type PflichtGruppe = 'jahresabschluss' | 'register' | 'abgaben' | 'holding' | 'ereignis';
export const PFLICHT_GRUPPEN: readonly { id: PflichtGruppe; label: string }[] = [
  { id: 'jahresabschluss', label: 'Jahresabschluss & Gesellschafter' }, { id: 'register', label: 'Register & Transparenz' },
  { id: 'abgaben', label: 'Abgaben & Meldungen' }, { id: 'holding', label: 'Holding' }, { id: 'ereignis', label: 'Nach Ereignissen' },
];

/** „Unverzüglich“ als Kalender-Vorschlag (Annahme der Recherche, Notation `unverzüglich`). */
export const UNVERZUEGLICH_TAGE = 14;

export interface PflichtRegel {
  id: string;
  titel: string;
  gruppe: PflichtGruppe;
  gilt: (k: SchildKontext) => boolean;
  /** `gje` = je Geschäftsjahres-Ende (Periode = Stichtag), `kje` = je Kalenderjahr (Periode = Jahr des Fristtags). */
  anker: 'gje' | 'kje';
  /** Fristtag aus dem Anker (Stichtag bzw. Jahr als `JJJJ-01-01`). */
  frist: (anker: string, k: SchildKontext) => string;
  /** Anzeige der Periode (Vorgabe: „GJ 2025“ bzw. das Jahr). */
  periode?: (periode: string) => string;
  norm: string;
  folge?: string;
  verantwortlich: Rolle;
  vorlaufTage: number;
  quelle: string;
  annahme?: true;
  hinweis?: string;
  /** Welche Dokument-Art die Erledigung belegt. */
  belegArt?: string;
}

const klein = (k: SchildKontext) => k.profil.groessenklasse === 'kleinst' || k.profil.groessenklasse === 'klein';
const feststellenFrist = (gje: string, k: SchildKontext) => monatePlus(gje, klein(k) ? 11 : 8);
const jahr = (a: string) => Number(a.slice(0, 4));

export const PFLICHT_REGELN: readonly PflichtRegel[] = [
  { id: 'groessenklasse', titel: 'Größenklasse bestimmen (Kleinst · klein · mittel · groß)', gruppe: 'jahresabschluss', gilt: k => k.hgbKapital, anker: 'gje', frist: gje => gje, norm: '§§ 267, 267a HGB', folge: 'Falsche Erleichterung → Ordnungsgeld-Risiko', verantwortlich: 'gf', vorlaufTage: 14, quelle: 'Q19, Q20', hinweis: 'Ein Wechsel gilt erst nach zwei aufeinanderfolgenden Stichtagen. Eine reine Beteiligungs-Holding ist nie Kleinstkapitalgesellschaft (§ 267a Abs. 3 Nr. 3 HGB). Die Größenklasse im Profil bestimmt die Fristen unten.' },
  { id: 'ja-aufstellen', titel: 'Jahresabschluss aufstellen', gruppe: 'jahresabschluss', gilt: k => k.hgbKapital, anker: 'gje', frist: (gje, k) => monatePlus(gje, klein(k) ? 6 : 3), norm: '§ 264 Abs. 1 HGB', folge: 'Pflichtverletzung der Geschäftsführung; Probleme mit Finanzamt und Bank', verantwortlich: 'gf', vorlaufTage: 30, quelle: 'Q04', hinweis: '3 Monate nach dem Stichtag; kleine und Kleinstgesellschaften bis 6 Monate, wenn das einem ordnungsgemäßen Geschäftsgang entspricht. Ohne Größenklasse im Profil rechnet MAKE OS vorsichtig mit 3 Monaten.', belegArt: 'jahresabschluss' },
  { id: 'gv-einladung', titel: 'Gesellschafterversammlung einladen (Zugang mindestens eine Woche vorher)', gruppe: 'jahresabschluss', gilt: k => k.kapital && k.gesellschafter >= 2, anker: 'gje', frist: (gje, k) => tagePlus(feststellenFrist(gje, k), -7), norm: '§ 51 GmbHG', folge: 'Beschlüsse angreifbar', verantwortlich: 'gf', vorlaufTage: 21, quelle: 'Q75', hinweis: 'Per Einschreiben, sofern die Satzung nichts anderes sagt; ohne Einladung nur als Vollversammlung (§ 51 Abs. 3). Vorlage unter „Vorlagen“.' },
  { id: 'ja-feststellen', titel: 'Jahresabschluss feststellen, Gewinnverwendung beschließen', gruppe: 'jahresabschluss', gilt: k => k.kapital, anker: 'gje', frist: feststellenFrist, norm: '§ 42a Abs. 2, § 46 Nr. 1 GmbHG', folge: 'Die Satzung kann die Frist nicht verlängern', verantwortlich: 'gesellschafter', vorlaufTage: 30, quelle: 'Q03', hinweis: '8 Monate nach dem Stichtag (kleine 11). Einpersonen-Gesellschaft: Niederschrift unverzüglich nach dem Beschluss (§ 48 Abs. 3). Üblich zugleich: Entlastung der Geschäftsführung.', belegArt: 'jahresabschluss' },
  { id: 'ug-ruecklage', titel: 'UG: ¼ des Jahresüberschusses in die gesetzliche Rücklage', gruppe: 'jahresabschluss', gilt: k => k.ug, anker: 'gje', frist: feststellenFrist, norm: '§ 5a Abs. 3 GmbHG', folge: 'Fehlerhafter Abschluss', verantwortlich: 'gf', vorlaufTage: 30, quelle: 'Q21', hinweis: 'Mit jedem Abschluss — nach Abzug eines Verlustvortrags.' },
  // Prüf-Fund 11.10.: führt das Steuer-Modul die Gesellschaft, rechnet ES die Offenlegung (eine Quelle — sonst zwei Aufgaben, zwei Fristen).
  { id: 'ja-offenlegen', titel: 'Jahresabschluss offenlegen (Unternehmensregister)', gruppe: 'jahresabschluss', gilt: k => k.hgbKapital && !steuerImModul(k.id), anker: 'gje', frist: gje => monatePlus(gje, 12), norm: '§ 325 Abs. 1a, § 326 HGB', folge: 'Ordnungsgeld 2.500–25.000 € (§ 335 HGB)', verantwortlich: 'gf', vorlaufTage: 45, quelle: 'Q05, Q06, Q18', hinweis: 'Kleine: Bilanz und Anhang; Kleinst: Hinterlegung der Bilanz.', belegArt: 'jahresabschluss' },
  { id: 'konzern-pruefen', titel: 'Konzernabschluss: Befreiung prüfen', gruppe: 'holding', gilt: k => k.holding && k.hgbKapital, anker: 'gje', frist: gje => gje, norm: '§ 293 HGB', verantwortlich: 'gf', vorlaufTage: 14, quelle: 'Q83', hinweis: 'Befreit, wenn an zwei Stichtagen zwei von drei Größenmerkmalen nicht überschritten sind.' },
  { id: 'holding-quote', titel: 'Beteiligungsquoten zum 01.01. festhalten', gruppe: 'holding', gilt: k => k.holding, anker: 'kje', frist: a => `${jahr(a)}-01-01`, norm: '§ 8b Abs. 4 KStG, § 9 Nr. 2a GewStG', folge: 'Unter 10 % (Dividenden) bzw. 15 % (Gewerbesteuer) zu Jahresbeginn fallen Steuerprivilegien weg', verantwortlich: 'gf', vorlaufTage: 14, quelle: 'Q44, Q46', belegArt: 'beteiligungsquoten' },
  { id: 'transparenz-abgleich', titel: 'Transparenzregister mit der Cap-Table abgleichen', gruppe: 'register', gilt: k => k.kapital, anker: 'kje', frist: a => `${jahr(a)}-01-31`, norm: '§ 20 GwG', folge: 'Bußgeld bis 100.000 € (§ 56 GwG)', verantwortlich: 'gf', vorlaufTage: 21, quelle: 'Q09, Q12', annahme: true, hinweis: 'Jährlicher Abgleich als Schild (Termin Ende Januar ist ein Vorschlag); jede Änderung ist ohnehin unverzüglich mitzuteilen.', belegArt: 'transparenzregister' },
  { id: 'bg-lohnnachweis', titel: 'BG-Lohnnachweis für das Vorjahr (elektronisch)', gruppe: 'abgaben', gilt: k => (k.beschaeftigte ?? 0) > 0, anker: 'kje', frist: a => `${jahr(a)}-02-16`, periode: p => `für ${Number(p) - 1}`, norm: '§ 99 Abs. 1 SGB IV, § 165 SGB VII', verantwortlich: 'gf', vorlaufTage: 21, quelle: 'Q34' },
  { id: 'ksk-meldung', titel: 'Künstlersozialabgabe für das Vorjahr melden', gruppe: 'abgaben', gilt: k => !!k.profil.kreativeHonorare, anker: 'kje', frist: a => `${jahr(a)}-03-31`, periode: p => `für ${Number(p) - 1}`, norm: '§ 27 Abs. 1 KSVG', verantwortlich: 'gf', vorlaufTage: 21, quelle: 'Q35' },
  { id: 'sb-anzeige', titel: 'Anzeige schwerbehinderter Beschäftigter für das Vorjahr', gruppe: 'abgaben', gilt: k => (k.beschaeftigte ?? 0) >= 20, anker: 'kje', frist: a => `${jahr(a)}-03-31`, periode: p => `für ${Number(p) - 1}`, norm: '§ 163 Abs. 2 SGB IX', verantwortlich: 'gf', vorlaufTage: 21, quelle: 'Q71' },
];

// ── Ereignis-Pflichten (research › 2b) ───────────────────────────────────────────────────────────────────────────

export interface EreignisPflicht {
  key: string;
  titel: string;
  /** Frist ab dem Ereignis: Tage oder Monate. 0 = am Tag des Ereignisses („gleichzeitig“, „vorher“). */
  tage?: number;
  monate?: number;
  norm: string;
  verantwortlich: Rolle;
  quelle: string;
  /** „Unverzüglich“ → Vorschlag E + 14 Tage. */
  unverzueglich?: true;
  annahme?: true;
  hinweis?: string;
  /** Hier lohnt eine anwaltliche/steuerliche Einschätzung, bevor ihr handelt. */
  eskalation?: true;
  /** Die Frist ist ein FRÜHESTER Tag (Wartezeit, z. B. Sperrjahr) — in Worten „nach …“ statt „binnen …“ (11.10.). */
  nach?: true;
}
export interface EreignisDef { id: EreignisArt; label: string; gilt: (k: SchildKontext) => boolean; pflichten: EreignisPflicht[] }

const U = (key: string, titel: string, norm: string, quelle: string, x: Partial<EreignisPflicht> = {}): EreignisPflicht => ({ key, titel, tage: UNVERZUEGLICH_TAGE, unverzueglich: true, norm, verantwortlich: 'gf', quelle, ...x });
const ESKALATION = 'Hier lohnt eine anwaltliche Einschätzung, bevor ihr handelt — für Geschäftsleiter gelten kurze, strafbewehrte Fristen.';

export const EREIGNIS_ARTEN: readonly EreignisDef[] = [
  { id: 'anteilsuebertragung', label: 'Anteilsübertragung', gilt: k => k.kapital, pflichten: [
    U('gesellschafterliste', 'Neue Gesellschafterliste einreichen', '§ 40 GmbHG', 'Q01', { hinweis: 'Hat ein Notar mitgewirkt, reicht er sie ein.' }),
    U('transparenzregister', 'Transparenzregister aktualisieren', '§ 20 GwG', 'Q09'),
    { key: 'sv-status', titel: 'Sozialversicherungs-Status der Gesellschafter-Geschäftsführung prüfen (vorher!)', tage: 0, norm: '§ 7a SGB IV', verantwortlich: 'gesellschafter', quelle: 'Q41', annahme: true },
  ] },
  { id: 'kapitalmassnahme', label: 'Kapitalerhöhung, -herabsetzung oder Einziehung', gilt: k => k.kapital, pflichten: [
    { key: 'notar-hr', titel: 'Notariell beurkunden und zum Handelsregister anmelden', tage: 0, norm: '§§ 53, 54 GmbHG', verantwortlich: 'gf', quelle: 'Q25', hinweis: 'Wirksam erst mit Eintragung.' },
    U('gesellschafterliste', 'Neue Gesellschafterliste einreichen', '§ 40 GmbHG', 'Q01'),
    U('transparenzregister', 'Transparenzregister aktualisieren', '§ 20 GwG', 'Q09'),
  ] },
  { id: 'gf-wechsel', label: 'Wechsel in der Geschäftsführung', gilt: k => k.kapital, pflichten: [
    U('hr-anmeldung', 'Änderung zum Handelsregister anmelden', '§ 39 GmbHG', 'Q24', { annahme: true }),
    { key: 'briefbogen', titel: 'Briefbogen, E-Mail-Signatur und Impressum anpassen', tage: 0, norm: '§ 35a GmbHG, § 5 DDG', verantwortlich: 'gf', quelle: 'Q23, Q56' },
    { key: 'vollmachten', titel: 'Vollmachten, Bank- und Portalzugänge prüfen', tage: 7, norm: '—', verantwortlich: 'gf', quelle: 'Annahme', annahme: true },
    U('transparenzregister', 'Transparenzregister prüfen (falls die Geschäftsführung fiktiv wirtschaftlich berechtigt ist)', '§ 20 GwG, § 3 Abs. 2 GwG', 'Q09'),
    U('do-nachmeldung', 'D&O-Versicherung: versicherte Personen und Nachmeldefrist prüfen', '—', 'Q84', { annahme: true }),
  ] },
  { id: 'satzungsaenderung', label: 'Satzungsänderung', gilt: k => k.kapital, pflichten: [
    U('notar-hr', 'Notariell beurkunden und zum Handelsregister anmelden', '§§ 53, 54 GmbHG', 'Q25', { hinweis: 'Wirksam erst mit Eintragung; danach den neuen Wortlaut mit Notarbescheinigung ablegen.' }),
  ] },
  { id: 'sitz-anschrift', label: 'Sitz oder Geschäftsanschrift geändert', gilt: () => true, pflichten: [
    { key: 'hr', titel: 'Zum Handelsregister anmelden', tage: 0, norm: '§ 31 Abs. 1 HGB', verantwortlich: 'gf', quelle: 'Q76' },
    { key: 'gewerbeamt', titel: 'Gewerbeamt: Ummeldung (gleichzeitig)', tage: 0, norm: '§ 14 GewO', verantwortlich: 'gf', quelle: 'Q60' },
    { key: 'finanzamt', titel: 'Finanzamt informieren', monate: 1, norm: '§ 138 AO', verantwortlich: 'gf', quelle: 'Q59' },
    { key: 'impressum', titel: 'Impressum und Briefbogen anpassen', tage: 0, norm: '§ 5 DDG, § 35a GmbHG', verantwortlich: 'gf', quelle: 'Q56, Q23' },
  ] },
  { id: 'prokura', label: 'Prokura erteilt oder erloschen', gilt: () => true, pflichten: [
    { key: 'hr', titel: 'Zum Handelsregister anmelden', tage: 0, norm: '§ 53 HGB', verantwortlich: 'gf', quelle: 'Annahme', annahme: true },
  ] },
  { id: 'gewerbe-aenderung', label: 'Gewerbe: Beginn, Verlegung, Gegenstand oder Aufgabe', gilt: () => true, pflichten: [
    { key: 'gewerbeamt', titel: 'Gewerbeamt (gleichzeitig mit dem Ereignis)', tage: 0, norm: '§ 14 GewO', verantwortlich: 'gf', quelle: 'Q60' },
    { key: 'finanzamt', titel: 'Finanzamt: Fragebogen bzw. Mitteilung', monate: 1, norm: '§ 138 Abs. 1, 1b, 4 AO', verantwortlich: 'gf', quelle: 'Q59' },
  ] },
  { id: 'betriebseroeffnung', label: 'Betriebseröffnung', gilt: () => true, pflichten: [
    { key: 'gewerbeamt', titel: 'Gewerbe anmelden (gleichzeitig)', tage: 0, norm: '§ 14 GewO', verantwortlich: 'gf', quelle: 'Q60' },
    { key: 'finanzamt', titel: 'Fragebogen zur steuerlichen Erfassung', monate: 1, norm: '§ 138 AO', verantwortlich: 'gf', quelle: 'Q59' },
    { key: 'bg', titel: 'Unfallversicherungsträger (BG) — die Gewerbeanzeige genügt', tage: 7, norm: '§ 192 SGB VII', verantwortlich: 'gf', quelle: 'Q33' },
  ] },
  { id: 'erste-beschaeftigung', label: 'Erste Beschäftigung', gilt: () => true, pflichten: [
    { key: 'nachweis', titel: 'Wesentliche Arbeitsbedingungen schriftlich (ab dem ersten Arbeitstag)', tage: 0, norm: '§ 2 NachwG', verantwortlich: 'gf', quelle: 'Q68' },
    { key: 'lohnkonto', titel: 'Lohnkonto und SV-Meldungen einrichten', tage: 0, norm: '§ 41 EStG, § 28a SGB IV', verantwortlich: 'gf', quelle: 'Q88', annahme: true },
    { key: 'bg', titel: 'BG-Mitgliedschaft (binnen einer Woche)', tage: 7, norm: '§ 192 SGB VII', verantwortlich: 'gf', quelle: 'Q33' },
    { key: 'zeiterfassung', titel: 'Arbeitszeiterfassung einrichten', tage: 0, norm: 'BAG 1 ABR 22/21', verantwortlich: 'gf', quelle: 'Q70' },
    { key: 'gefaehrdung', titel: 'Gefährdungsbeurteilung erstellen', tage: 30, norm: '§ 6 ArbSchG', verantwortlich: 'gf', quelle: 'Q69', annahme: true },
  ] },
  { id: 'neuer-vertrag', label: 'Wesentlicher Vertrag geschlossen', gilt: () => true, pflichten: [
    { key: 'fristen', titel: 'Laufzeit, Kündigung, Verlängerung unter „Verträge“ eintragen (Kalender)', tage: 7, norm: '§ 257 HGB (Aufbewahrung)', verantwortlich: 'gf', quelle: 'Q07', annahme: true },
    { key: 'avv', titel: 'Auftragsverarbeitung? AVV prüfen', tage: 14, norm: 'Art. 28 DSGVO', verantwortlich: 'gf', quelle: 'Q51' },
    { key: 'haftung', titel: 'Haftung, Pönalen, Rechte und Kündigung prüfen (Checkliste)', tage: 14, norm: '—', verantwortlich: 'gf', quelle: 'Annahme', annahme: true },
  ] },
  { id: 'verlust-haelfte', label: 'Hälfte des Stammkapitals verloren', gilt: k => k.gmbh, pflichten: [
    U('gv', 'Gesellschafterversammlung einberufen', '§ 49 Abs. 3 GmbHG', 'Q22', { eskalation: true, hinweis: ESKALATION }),
  ] },
  { id: 'ug-drohende-zu', label: 'UG: drohende Zahlungsunfähigkeit', gilt: k => k.ug, pflichten: [
    U('gv', 'Gesellschafterversammlung einberufen', '§ 5a Abs. 4 GmbHG', 'Q21', { eskalation: true, hinweis: ESKALATION }),
  ] },
  { id: 'zahlungsunfaehigkeit', label: 'Zahlungsunfähigkeit', gilt: k => k.kapital || k.hgbKapital, pflichten: [
    { key: 'insolvenzantrag', titel: 'Insolvenzantrag — ohne schuldhaftes Zögern, spätestens nach 3 Wochen', tage: 21, norm: '§ 15a InsO; ab Eintritt Zahlungsverbot § 15b InsO', verantwortlich: 'gf', quelle: 'Q14, Q15', eskalation: true, hinweis: ESKALATION },
  ] },
  { id: 'ueberschuldung', label: 'Überschuldung', gilt: k => k.kapital || k.hgbKapital, pflichten: [
    { key: 'insolvenzantrag', titel: 'Insolvenzantrag — ohne schuldhaftes Zögern, spätestens nach 6 Wochen', tage: 42, norm: '§ 15a InsO; § 19 InsO', verantwortlich: 'gf', quelle: 'Q14, Q81', eskalation: true, hinweis: ESKALATION },
  ] },
  // ── Ereignis-Assistent (11.10., „Was ist passiert?“) — weitere Lebensereignisse; Quelle „Gesetzestext“ = Norm nicht aus der Recherche, sondern
  //    aus dem Wortlaut; Fristen ohne gesetzliche Zahl sind Vorschläge (`annahme`). Hinweis, keine Rechtsberatung.
  { id: 'beteiligung-erwerb', label: 'Neue Beteiligung erworben', gilt: () => true, pflichten: [
    { key: 'notar', titel: 'Anteilskauf notariell beurkunden (bei GmbH-Anteilen)', tage: 0, norm: '§ 15 Abs. 3, 4 GmbHG', verantwortlich: 'gf', quelle: 'Gesetzestext' },
    { key: 'register', titel: 'Beteiligung in MAKE OS eintragen (Gesellschaft › Beteiligungen)', tage: 7, norm: '—', verantwortlich: 'gf', quelle: 'Annahme', annahme: true, hinweis: 'Daraus zeichnet MAKE OS die Struktur „wer hält wen“.' },
    U('transparenzregister', 'Transparenzregister: wirtschaftlich Berechtigte über die neue Kette prüfen', '§§ 19, 20 GwG', 'Q09', { annahme: true }),
    { key: 'quote', titel: 'Beteiligungsquote zum nächsten 01.01. festhalten (Holding)', monate: 1, norm: '§ 8b Abs. 4 KStG, § 9 Nr. 2a GewStG', verantwortlich: 'gf', quelle: 'Q44, Q46', annahme: true, hinweis: 'Steuerlich zählt die Quote zu Beginn des Kalenderjahres.' },
  ] },
  { id: 'gruendung', label: 'Gründung der Gesellschaft', gilt: k => k.kapital, pflichten: [
    { key: 'notar', titel: 'Gesellschaftsvertrag notariell beurkunden', tage: 0, norm: '§ 2 Abs. 1 GmbHG', verantwortlich: 'gesellschafter', quelle: 'Gesetzestext' },
    { key: 'einlage', titel: 'Einlagen einzahlen — vor der Anmeldung', tage: 7, norm: '§ 7 Abs. 2, § 5a Abs. 2 GmbHG', verantwortlich: 'gesellschafter', quelle: 'Gesetzestext', annahme: true, hinweis: 'GmbH: auf jeden Anteil mindestens ein Viertel, zusammen mindestens die Hälfte des Mindeststammkapitals; UG: voll.' },
    { key: 'hr', titel: 'Zum Handelsregister anmelden (über den Notar)', tage: 14, norm: '§§ 7, 8 GmbHG; § 12 HGB', verantwortlich: 'gf', quelle: 'Gesetzestext', annahme: true },
    U('transparenzregister', 'Wirtschaftlich Berechtigte dem Transparenzregister mitteilen', '§ 20 GwG', 'Q09'),
    { key: 'gewerbeamt', titel: 'Gewerbe anmelden (mit Beginn der Tätigkeit)', tage: 30, norm: '§ 14 GewO', verantwortlich: 'gf', quelle: 'Q60', annahme: true },
    { key: 'finanzamt', titel: 'Fragebogen zur steuerlichen Erfassung', monate: 1, norm: '§ 138 AO', verantwortlich: 'gf', quelle: 'Q59' },
  ] },
  { id: 'aufloesung', label: 'Auflösung (Liquidation)', gilt: k => k.kapital, pflichten: [
    { key: 'beschluss', titel: 'Auflösung beschließen (drei Viertel der Stimmen, wenn die Satzung nichts anderes sagt)', tage: 0, norm: '§ 60 Abs. 1 Nr. 2 GmbHG', verantwortlich: 'gesellschafter', quelle: 'Gesetzestext' },
    U('hr', 'Auflösung und Liquidatoren zum Handelsregister anmelden', '§§ 65, 67 GmbHG', 'Gesetzestext'),
    U('glaeubiger', 'Auflösung bekanntmachen und Gläubiger zur Meldung auffordern', '§ 65 Abs. 2 GmbHG', 'Gesetzestext'),
    { key: 'finanzamt', titel: 'Finanzamt informieren (Besteuerung der Abwicklung)', monate: 1, norm: '§ 11 KStG, § 138 AO', verantwortlich: 'gf', quelle: 'Gesetzestext', annahme: true },
    { key: 'sperrjahr', titel: 'Nach dem Sperrjahr: verbleibendes Vermögen verteilen', monate: 12, nach: true, norm: '§ 73 Abs. 1 GmbHG', verantwortlich: 'gf', quelle: 'Gesetzestext', annahme: true, hinweis: 'Vorher darf nichts verteilt werden. Das Jahr läuft ab der Bekanntmachung — im Kalender gerechnet ab dem Tag des Ereignisses.' },
    { key: 'loeschung', titel: 'Schluss der Abwicklung zum Handelsregister anmelden (Löschung)', monate: 13, nach: true, norm: '§ 74 Abs. 1 GmbHG', verantwortlich: 'gf', quelle: 'Gesetzestext', annahme: true },
  ] },
];

/**
 * Zusatz-Schritte des Ereignis-Assistenten (11.10.): was nach einem Ereignis üblicherweise noch zu tun ist, aber keine eigene Register- oder
 * Behördenpflicht ist (Bank, Versicherungen, Geschäftspartner informieren …). Sie gelten NUR, wenn die Person sie im Assistenten anhakt
 * (`Ereignis.zusatz`) — ein Ereignis ohne Zusatz rechnet bit-gleich wie bisher. Kennungen beginnen mit `z-` (keine Überschneidung mit den
 * Pflicht-Kennungen) und ändern sich nie. Fristen sind Vorschläge (`annahme`).
 */
export const ZUSATZ_SCHRITTE: readonly EreignisPflicht[] = [
  { key: 'z-bank', titel: 'Bank informieren (Vertretung, Anschrift bzw. Firma, Kontovollmachten)', tage: 14, norm: '—', verantwortlich: 'gf', quelle: 'Annahme', annahme: true },
  { key: 'z-versicherungen', titel: 'Versicherungen informieren (Anschrift, versicherte Personen, Risiko)', tage: 14, norm: '§ 23 VVG (Gefahrerhöhung)', verantwortlich: 'gf', quelle: 'Gesetzestext', annahme: true, hinweis: 'Was das versicherte Risiko erhöht, ist dem Versicherer anzuzeigen.' },
  { key: 'z-partner', titel: 'Kunden, Lieferanten und Dienstleister informieren (Rechnungsangaben, Verträge)', tage: 30, norm: '§ 14 Abs. 4 UStG (Rechnungsangaben)', verantwortlich: 'gf', quelle: 'Gesetzestext', annahme: true },
  { key: 'z-marken-domains', titel: 'Marken, Domains und Verträge auf die neue Lage prüfen (Inhaber, Firma)', tage: 30, norm: '—', verantwortlich: 'gf', quelle: 'Annahme', annahme: true },
  { key: 'z-steuerbuero', titel: 'Steuerbüro informieren (Folgen für Steuern und Abschluss)', tage: 14, norm: '—', verantwortlich: 'gf', quelle: 'Annahme', annahme: true, hinweis: 'Etwa beim Wechsel von Gesellschaftern: Verlustvorträge können wegfallen (§ 8c KStG).' },
  { key: 'z-cap-table', titel: 'Gesellschafter in MAKE OS nachziehen (Cap-Table)', tage: 7, norm: '—', verantwortlich: 'gf', quelle: 'Annahme', annahme: true, hinweis: 'Unter Gesellschaft › Gesellschafter — daraus rechnet MAKE OS Anteile, Stimmen und die Struktur.' },
  { key: 'z-einlage', titel: 'Einlage leisten und den Nachweis ablegen', tage: 0, norm: '§ 57 Abs. 2 GmbHG', verantwortlich: 'gesellschafter', quelle: 'Gesetzestext', hinweis: 'Angemeldet wird die Kapitalerhöhung erst, wenn die Einlage geleistet ist.' },
  { key: 'z-notar-anteile', titel: 'Abtretung der Anteile notariell beurkunden', tage: 0, norm: '§ 15 Abs. 3 GmbHG', verantwortlich: 'gesellschafter', quelle: 'Gesetzestext' },
  { key: 'z-konto', titel: 'Geschäftskonto eröffnen (für die Einlagen)', tage: 0, norm: '—', verantwortlich: 'gf', quelle: 'Annahme', annahme: true },
  { key: 'z-impressum', titel: 'Impressum, Briefbogen und E-Mail-Signatur anpassen', tage: 0, norm: '§ 5 DDG, § 35a GmbHG', verantwortlich: 'gf', quelle: 'Q56, Q23', hinweis: 'Ab der Eintragung im Handelsregister.' },
  { key: 'z-gewerbe', titel: 'Gewerbeamt: Ummeldung', tage: 30, norm: '§ 14 GewO', verantwortlich: 'gf', quelle: 'Q60', annahme: true },
  { key: 'z-finanzamt', titel: 'Finanzamt informieren', monate: 1, norm: '§ 138 AO', verantwortlich: 'gf', quelle: 'Q59', annahme: true },
];
export const zusatzSchritt = (key: string): EreignisPflicht | undefined => ZUSATZ_SCHRITTE.find(z => z.key === key);
/** Pflichten eines Ereignisses samt angehakter Zusatz-Schritte (unbekannte Kennungen fallen weg) — EINE Liste für Kalender, Vermerke und Assistent. */
export function ereignisSchritte(e: Pick<Ereignis, 'art' | 'zusatz'>): EreignisPflicht[] {
  const def = ereignisDef(e.art);
  if (!def) return [];
  const zusatz = (e.zusatz ?? []).map(zusatzSchritt).filter((z): z is EreignisPflicht => !!z && !def.pflichten.some(p => p.key === z.key));
  return [...def.pflichten, ...zusatz];
}
export const ereignisDef = (art: string): EreignisDef | undefined => EREIGNIS_ARTEN.find(e => e.id === art);

// ── Schwellen-Wächter (research › 2d) ────────────────────────────────────────────────────────────────────────────

export type SchwelleStand = 'erreicht' | 'nicht' | 'unbekannt';
export interface SchwelleDef { id: string; titel: string; pflicht: string; norm: string; quelle: string; annahme?: true; pruefe: (k: SchildKontext) => SchwelleStand }

const mio = (n: number) => n * 100_000_000;
const ma = (k: SchildKontext, ab: number): SchwelleStand => (typeof k.beschaeftigte !== 'number' ? 'unbekannt' : k.beschaeftigte >= ab ? 'erreicht' : 'nicht');
const beide = (k: SchildKontext, grenzeCent: number): SchwelleStand => {
  const u = k.profil.umsatzVorjahrCent, b = k.profil.bilanzsummeCent;
  if (typeof u !== 'number' || typeof b !== 'number') return 'unbekannt';
  return u > grenzeCent && b > grenzeCent ? 'erreicht' : 'nicht';
};
const oder = (a: SchwelleStand, b: SchwelleStand): SchwelleStand => (a === 'erreicht' || b === 'erreicht' ? 'erreicht' : a === 'unbekannt' || b === 'unbekannt' ? 'unbekannt' : 'nicht');

export const SCHWELLEN: readonly SchwelleDef[] = [
  { id: 'erste-beschaeftigte', titel: 'Erste/r Beschäftigte/r', pflicht: 'Lohnkonto, SV-Meldungen, BG, Gefährdungsbeurteilung, Zeiterfassung, Nachweisgesetz', norm: 'NachwG, ArbSchG, SGB IV/VII', quelle: 'Q33, Q68–Q70', pruefe: k => ma(k, 1) },
  { id: 'bfsg', titel: '10 Personen oder Umsatz und Bilanz je über 2 Mio. €', pflicht: 'Barrierefreiheit (BFSG) gilt dann auch für Dienstleister — nur für erfasste Produkte/Dienstleistungen, z. B. elektronischer Geschäftsverkehr mit Verbrauchern', norm: '§ 2 Nr. 17, § 3 Abs. 3 BFSG', quelle: 'Q57', annahme: true, pruefe: k => oder(ma(k, 10), beide(k, mio(2))) },
  { id: 'dsb', titel: '20 Personen in automatisierter Verarbeitung', pflicht: 'Datenschutzbeauftragte(n) benennen und melden', norm: '§ 38 BDSG', quelle: 'Q38', pruefe: k => ma(k, 20) },
  { id: 'schwerbehinderte', titel: '20 Arbeitsplätze', pflicht: 'Beschäftigungspflicht schwerbehinderter Menschen bzw. Ausgleichsabgabe, Anzeige bis 31.03.', norm: '§§ 154, 163 SGB IX', quelle: 'Q71', pruefe: k => ma(k, 20) },
  { id: 'hinschg', titel: '50 Beschäftigte', pflicht: 'Interne Hinweisgeber-Meldestelle', norm: '§ 12 Abs. 2 HinSchG', quelle: 'Q37', pruefe: k => ma(k, 50) },
  { id: 'nis2', titel: '50 Beschäftigte oder Umsatz und Bilanz je über 10 Mio. €', pflicht: 'NIS2 prüfen (nur in den Sektoren der Anlagen 1/2 BSIG; ein SaaS-Anbieter kann als Cloud-Dienst gelten): Registrierung, Risikomaßnahmen, Meldepflichten', norm: '§ 28 Abs. 2, § 33 BSIG', quelle: 'Q39', annahme: true, pruefe: k => oder(ma(k, 50), beide(k, mio(10))) },
  { id: 'erechnung', titel: 'Vorjahresumsatz über 800.000 €', pflicht: 'E-Rechnungen ausstellen ab 01.01.2027 (ab 2028 alle im B2B)', norm: '§ 27 Abs. 38 UStG', quelle: 'Q77', pruefe: k => (typeof k.profil.umsatzVorjahrCent !== 'number' ? 'unbekannt' : k.profil.umsatzVorjahrCent > 80_000_000 ? 'erreicht' : 'nicht') },
  { id: 'buchfuehrung', titel: 'Einzelunternehmen: über 800.000 € Umsatz oder 80.000 € Gewinn', pflicht: 'Buchführungspflicht nach Mitteilung des Finanzamts', norm: '§ 141 AO', quelle: 'Q72', pruefe: k => {
    if (!k.einzel) return 'nicht';
    const u = k.profil.umsatzVorjahrCent, g = k.profil.gewinnVorjahrCent;
    if (typeof u !== 'number' && typeof g !== 'number') return 'unbekannt';
    return (u ?? 0) > 80_000_000 || (g ?? 0) > 8_000_000 ? 'erreicht' : 'nicht';
  } },
];

export interface SchwelleZeile { def: SchwelleDef; stand: SchwelleStand; umgesetzt?: Vermerk }
/** Schwellen mit Stand; „umgesetzt“ = Vermerk `schwelle:<id>` / `laufend`. */
export function schwellenFuer(k: SchildKontext, s: SchildGesellschaft | null | undefined): SchwelleZeile[] {
  return SCHWELLEN.map(def => {
    const v = vermerkVon(s, `schwelle:${def.id}`, 'laufend');
    return { def, stand: def.pruefe(k), ...(v?.status === 'erledigt' ? { umgesetzt: v } : {}) };
  }).filter(z => !(z.def.id === 'buchfuehrung' && !k.einzel));
}

// ── Pflichten einer Gesellschaft ─────────────────────────────────────────────────────────────────────────────────

export type PflichtStatus = 'erledigt' | 'nicht-zutreffend' | 'offen' | 'faellig' | 'ueberfaellig';
export interface PflichtEintrag {
  /** `<regelId>|<periode>` — eindeutig je Gesellschaft. */
  schluessel: string;
  regelId: string;
  periode: string;
  periodeLabel: string;
  titel: string;
  gruppe: PflichtGruppe;
  frist: string;
  norm: string;
  folge?: string;
  verantwortlich: Rolle;
  quelle: string;
  annahme?: true;
  hinweis?: string;
  eskalation?: true;
  belegArt?: string;
  vorlaufTage: number;
  status: PflichtStatus;
  /** Tage bis zur Frist (negativ = überfällig). */
  inTagen: number;
  vermerk?: Vermerk;
  ereignisId?: string;
}

export const vermerkVon = (s: SchildGesellschaft | null | undefined, regelId: string, periode: string): Vermerk | undefined =>
  (s?.vermerke ?? []).find(v => v.regelId === regelId && v.periode === periode);

/** Wie weit zurück und voraus der Kalender rechnet. */
export const FENSTER = { zurueckTage: 365, vorausTage: 400 } as const;

function status(frist: string, vorlauf: number, heute: string, v?: Vermerk): PflichtStatus {
  if (v) return v.status === 'erledigt' ? 'erledigt' : 'nicht-zutreffend';
  if (frist < heute) return 'ueberfaellig';
  return tagePlus(frist, -vorlauf) <= heute ? 'faellig' : 'offen';
}

/**
 * Alle Pflichten einer Gesellschaft im Fenster (rein): Jahreszyklus aus Rechtsform + Geschäftsjahr (ab Gründung), Abgaben nach Profil,
 * Ereignis-Pflichten aus den gespeicherten Ereignissen. Sortiert nach Frist. Geplante und aufgelöste Gesellschaften haben keine laufenden
 * Pflichten; eine Gesellschaft in Gründung erst mit Gründungs- bzw. Eintragungsdatum.
 */
export function pflichtenFuer(k: SchildKontext, s: SchildGesellschaft | null | undefined, heute: string): PflichtEintrag[] {
  const raus: PflichtEintrag[] = [];
  const von = tagePlus(heute, -FENSTER.zurueckTage), bis = tagePlus(heute, FENSTER.vorausTage);
  const jahresZyklus = k.aktiv && !(k.status === 'gruendung' && !k.gegruendet);
  if (jahresZyklus) {
    const enden = geschaeftsjahresEnden(k.gjBeginn, tagePlus(heute, -3 * 366), bis, k.gegruendet);
    const jahre: string[] = [];
    for (let j = Number(heute.slice(0, 4)) - 1; j <= Number(heute.slice(0, 4)) + 1; j++) jahre.push(String(j));
    for (const r of PFLICHT_REGELN) {
      if (!r.gilt(k)) continue;
      // Kalenderjahr-Pflichten erst ab dem ersten Jahr nach der Gründung (sie betreffen das Vorjahr bzw. den 01.01.).
      const perioden = r.anker === 'gje' ? enden : jahre.filter(j => !k.gegruendet || Number(j) > Number(k.gegruendet.slice(0, 4)));
      for (const p of perioden) {
        const frist = r.frist(r.anker === 'gje' ? p : `${p}-01-01`, k);
        if (frist < von || frist > bis) continue;
        const v = vermerkVon(s, r.id, p);
        raus.push({
          schluessel: `${r.id}|${p}`, regelId: r.id, periode: p, periodeLabel: r.periode ? r.periode(p) : r.anker === 'gje' ? gjLabel(p) : p,
          titel: r.titel, gruppe: r.gruppe, frist, norm: r.norm, ...(r.folge ? { folge: r.folge } : {}), verantwortlich: r.verantwortlich, quelle: r.quelle,
          ...(r.annahme ? { annahme: true as const } : {}), ...(r.hinweis ? { hinweis: r.hinweis } : {}), ...(r.belegArt ? { belegArt: r.belegArt } : {}),
          vorlaufTage: r.vorlaufTage, status: status(frist, r.vorlaufTage, heute, v), inTagen: tageZwischen(heute, frist), ...(v ? { vermerk: v } : {}),
        });
      }
    }
  }
  for (const e of aktiveEintraege(s?.ereignisse)) raus.push(...ereignisPflichten(e, k, s, heute));
  return raus.sort((a, b) => a.frist.localeCompare(b.frist) || a.titel.localeCompare(b.titel, 'de'));
}

/** Die Pflichten eines Ereignisses (rein). */
export function ereignisPflichten(e: Ereignis, k: SchildKontext, s: SchildGesellschaft | null | undefined, heute: string): PflichtEintrag[] {
  const def = ereignisDef(e.art);
  if (!def || !def.gilt(k)) return [];
  return ereignisSchritte(e).map(p => {
    const frist = p.monate ? monatePlus(e.datum, p.monate) : tagePlus(e.datum, p.tage ?? 0);
    const regelId = `ev:${p.key}`;
    const v = vermerkVon(s, regelId, e.id);
    const vorlauf = Math.min(7, Math.max(0, tageZwischen(e.datum, frist)));
    return {
      schluessel: `${regelId}|${e.id}`, regelId, periode: e.id, periodeLabel: `${def.label} am ${e.datum.slice(8, 10)}.${e.datum.slice(5, 7)}.${e.datum.slice(0, 4)}`,
      titel: p.titel, gruppe: 'ereignis' as const, frist, norm: p.norm, verantwortlich: p.verantwortlich, quelle: p.quelle,
      ...(p.annahme || p.unverzueglich ? { annahme: true as const } : {}),
      ...(p.hinweis || p.unverzueglich ? { hinweis: [p.unverzueglich ? `„Unverzüglich“ — im Kalender als Vorschlag ${UNVERZUEGLICH_TAGE} Tage nach dem Ereignis.` : '', p.hinweis ?? ''].filter(Boolean).join(' ') } : {}),
      ...(p.eskalation ? { eskalation: true as const } : {}),
      vorlaufTage: vorlauf, status: status(frist, vorlauf, heute, v), inTagen: tageZwischen(heute, frist), ...(v ? { vermerk: v } : {}), ereignisId: e.id,
    };
  });
}

/** Schwere einer Pflicht für die Ampel. */
export function pflichtSchwere(p: PflichtEintrag): 'rot' | 'gelb' | 'ok' {
  if (p.status === 'ueberfaellig') return 'rot';
  if (p.status === 'faellig') return p.eskalation ? 'rot' : 'gelb';
  return 'ok';
}

// ── Steuer-Takt: nur der Verweis (eine Quelle) ───────────────────────────────────────────────────────────────────

export const STEUER_TAKT: readonly string[] = [
  'Umsatzsteuer-Voranmeldung am 10. (§ 18 UStG)', 'Lohnsteuer-Anmeldung am 10. (§ 41a EStG)', 'SV-Beiträge am drittletzten Bankarbeitstag (§ 23 SGB IV)',
  'KSt-/ESt-Vorauszahlungen 10.03., 10.06., 10.09., 10.12.', 'Gewerbesteuer-Vorauszahlungen 15.02., 15.05., 15.08., 15.11.', 'Jahreserklärungen (§ 149 AO; beraten länger)',
];
/** Führt das Steuer-Modul die Fristen dieser Gesellschaft? (Liste aus lib/steuern/rechnen.ts — keine zweite Rechnung hier.) */
export const steuerImModul = (id: string): boolean => (STEUER_FIRMEN as readonly string[]).includes(id);
