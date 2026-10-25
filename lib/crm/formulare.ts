// ─── Markttraktion › Formulare · „Angebot anfordern“ — Regeln (rein, Server UND Browser; 25.10.2026) ─────────────────────────────────────
// Kevin 25.10.: „Wir brauchen ein Formular, wo die Vertriebler Kunden eintragen können, die ein Angebot brauchen. Die müssen aus den Produkten
// auswählen können; wenn der Kunde nicht in der Datenbank ist, muss er angelegt werden. Wenn er das eingetragen hat, muss automatisiert das
// Angebot abgeschickt werden.“ Entscheidungen (Klickrunde 25.10.): Versand automatisch MIT Leitplanken (sonst Freigabe), Absender = ein vom
// Inhaber gewähltes Postfach, Quellen „intern“ (Sitzung) und „link“ (externer Vertriebler) — eine dritte Quelle (Brevo) dockt später an
// `angebotAnfordern(eingabe, quelle)` an (lib/crm/formulare-server.ts).
//
// Hier steht NUR, was Server und Browser beide brauchen: Formen, Grenzen, die Prüfung der Eingabe, die Positionen aus der Produktwahl
// (über die EINE Stelle `angebotPositionenAusProdukt`), die Leitplanken (versenden oder Freigabe), die Mail-Vorlage mit Platzhaltern samt
// Datenschutzhinweis (Art. 13), Link-Formen und der öffentliche Katalog eines Links. Keine Namen, keine Firmen, keine Preise im Code.

import type { AngebotPosition, Leistung, PreisTeil } from './typen';
import { angebotPositionenAusProdukt, geplanteMenge, istSatz, preisteileVon, hauptpreis, teilLabel, preisText, mengeEinheit } from './produkt-karte';
import { produktAngebotFehlt } from './angebote';
import { istKalendertag } from '@/lib/zeit';
import { bereichVon, istBusinessGesellschaft, istGesellschaft, zaehltAlsArbeit } from '@/lib/einheiten';

// ── Bestand ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ein Bestand je Haushalt, nur Business (Speicher-Register `angebot-formular--*`, IN_BUSINESS): Einstellungen, externe Links, Eingänge. */
export const formularBestandName = (haushalt: string) => `angebot-formular--${haushalt}`;

export type AnfrageQuelle = 'intern' | 'link';
export type EingangStatus = 'laeuft' | 'verschickt' | 'freigabe' | 'abgelehnt';
export const EINGANG_STATUS_LABEL: Record<EingangStatus, string> = { laeuft: 'in Arbeit', verschickt: 'verschickt', freigabe: 'zur Freigabe', abgelehnt: 'abgelehnt' };

export interface FormularEinstellungen {
  /** Absender-Postfach — der Inhaber wählt eines SEINER Postfächer mit Business-Bereich (Inbox 2). Ohne Eintrag wird nie automatisch verschickt. */
  absender?: { person: string; postfach: string; gesetztAm: string };
  /** Mail-Vorlage mit Platzhaltern (`MAIL_PLATZHALTER`) — leer = Standard (`MAIL_STANDARD`). Der Datenschutzhinweis hängt immer darunter. */
  betreff?: string;
  text?: string;
  geaendert?: string;
  geaendertVon?: string;
}

export interface ExternerLink {
  /** `fl-<uuid>` */
  id: string;
  /** Name des Vertrieblers (Pflicht) — steht als Herkunft „Vertrieb (Link: <Name>)“ am neu angelegten Kontakt. */
  name: string;
  /** Optional: Adresse des Vertrieblers (nur Anzeige für das Team). */
  email?: string;
  /** Lesbarer Teil der Adresse (`<vorsatz>-<24 hex>`). Der ganze Link wird NUR einmal gezeigt — gespeichert ist sein Fingerabdruck. */
  vorsatz: string;
  tokenHash: string;
  /** Freigegebene Produkte (Kennungen) — mindestens eines; nur aktive davon erscheinen auf der Seite. */
  produkte: string[];
  /** Gilt bis einschließlich (Berliner Tag); fehlt = unbefristet. */
  bis?: string;
  widerrufenAm?: string;
  angelegt: string;
  angelegtVon: string;
  erneuertAm?: string;
  /** Letzte Nutzung (Berliner Tag) und Zahl der Anfragen — nur Zahlen. */
  zuletzt?: string;
  anzahl?: number;
}

export interface Eingang {
  /** `af-<uuid>` — aus der Anfrage-Kennung des Browsers (eine Anfrage = ein Eingang, Wiederholung = derselbe). */
  id: string;
  /**
   * Absender-Gesellschaft (25.10., optional, additiv): seit das Formular auch die Selbstständigkeit kennt (Privat-Arbeits-Einheit), filtert die Route danach —
   * ein Konto „nur Business“ sieht Eingänge einer Privat-Einheit nie. Altbestand ohne Feld stammt aus der Zeit „nur Business“.
   */
  gesellschaft?: import('@/lib/einheiten').Gesellschaftskennung;
  am: string;
  quelle: AnfrageQuelle;
  /** Intern: Speichername der Person; Link: Kennung des Links (der Name steht am Link). */
  von?: string;
  linkId?: string;
  status: EingangStatus;
  /** Warum nicht automatisch verschickt (Leitplanken) bzw. warum abgelehnt — Sätze ohne Kundendaten. */
  gruende?: string[];
  kontaktId?: string;
  firmaId?: string;
  dealId?: string;
  angebotId?: string;
  nummer?: string;
  produkte: string[];
  /** Empfänger nur als Fingerabdruck (HMAC mit Pepper) und maskiert — nie die Adresse im Klartext. */
  an?: { hash: string; maskiert: string };
  /** Der Vorschlag im Freigabe-Stapel (Art „angebot-anfrage“). */
  vorschlagId?: string;
  /** Versand begonnen (vor dem Senden gesetzt) — ein Abbruch danach sendet nie ein zweites Mal von selbst. */
  versandBegonnen?: string;
  versendet?: { am: string; ueber: string; von: string };
  entschieden?: { am: string; von: string; art: 'gesendet' | 'abgelehnt'; grund?: string };
}

export interface FormularBestand { v: 1; einstellungen: FormularEinstellungen; links: ExternerLink[]; eingaenge: Eingang[] }
export const leererFormularBestand = (): FormularBestand => ({ v: 1, einstellungen: {}, links: [], eingaenge: [] });

/** Grenzen — darüber 413 mit Grund, nie gekürzt. Eingänge rollen nach `EINGANG_FRIST_MONATE` heraus (Löschfrist, Speicher-Register). */
export const FORMULAR_GRENZEN = {
  name: 80, firma: 160, strasse: 160, plz: 10, ort: 80, email: 160, telefon: 60, notiz: 2000, produkte: 10, optionen: 12,
  links: 100, linkProdukte: 50, betreff: 300, text: 6000, eingaenge: 5000,
} as const;
export const EINGANG_FRIST_MONATE = 24;
/** Menge eines Tagessatzes: höchstens die Werktage eines Monats (das Produkt kennt keine Tages-Grenze). Stundensatz: der Deckel des Produkts. */
export const TAGE_JE_MONAT_MAX = 23;
export const STUNDEN_OHNE_DECKEL_MAX = 160;

// ── Links ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Die Adresse eines externen Links: `<vorsatz>-<24 hex>` (96 Bit Zufall) — wie die Buchungsseite. Middleware und Route nehmen nur diese Form. */
export const LINK_SLUG = /^[a-z0-9-]{1,40}-[a-f0-9]{24}$/;
export const linkSlugOk = (s: unknown): s is string => typeof s === 'string' && LINK_SLUG.test(s);
export const ANGEBOT_SEITE = (slug: string) => `/angebot/${slug}`;
/** Lesbarer Vorsatz aus dem Namen (ohne Umlaute, höchstens 24 Zeichen; leer → „angebot“). */
export function linkVorsatz(name: string): string {
  const s = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24).replace(/-+$/, '');
  return s || 'angebot';
}
export type LinkLage = 'aktiv' | 'abgelaufen' | 'widerrufen';
/** Aktiv, abgelaufen (nach `bis`) oder widerrufen. Rein. */
export function linkLage(l: Pick<ExternerLink, 'bis' | 'widerrufenAm'>, heute: string): LinkLage {
  if (l.widerrufenAm) return 'widerrufen';
  return l.bis && l.bis < heute ? 'abgelaufen' : 'aktiv';
}

// ── Eingabe ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ProduktWahl {
  id: string;
  /** Gewählte Optionen (Preis-Teile mit Rolle „option“). */
  optionen?: string[];
  /** Menge je Tages-/Stundensatz-Teil (Kennung → Menge je Monat) — nur in den Grenzen des Produkts. */
  mengen?: Record<string, number>;
  /** Rabatt in Prozent — erlaubt, aber dann geht das Angebot zur Freigabe. */
  rabattProzent?: number;
  /** Abweichender Preis je Teil (Cent, netto) — erlaubt, dann zur Freigabe. */
  preise?: Record<string, number>;
}
export interface AnfrageEingabe {
  firma: { name: string; strasse?: string; plz?: string; ort?: string };
  person: { anrede: 'Sie' | 'Du'; vorname: string; nachname: string; email: string; telefon?: string };
  /** Nur intern (Kundensuche): eine vorhandene Person bzw. Firma. Ein Link kann keine Kennungen wählen. */
  kontaktId?: string;
  firmaId?: string;
  produkte: ProduktWahl[];
  start?: string;
  /** Notiz für intern — geht an den Deal, NIE ins Angebot. */
  notiz?: string;
}
export type EingabeErgebnis = { ok: true; e: AnfrageEingabe } | { ok: false; status: 400 | 413; fehler: string };

/** E-Mail-Form (wie lib/gmail/mime.ts `ADRESSE_OK` — dort mit Node-Abhängigkeiten, deshalb hier gespiegelt). */
export const MAIL_OK = /^[^\s@<>(),;:"\\[\]]{1,64}@[^\s@<>(),;:"\\[\]]{1,190}\.[^\s@<>(),;:"\\[\]]{2,63}$/;
export const mailOk = (e: unknown): e is string => typeof e === 'string' && e.length <= 254 && MAIL_OK.test(e) && !e.includes('..');
const KENNUNG = /^[a-z0-9][a-z0-9-]{1,63}$/;
const TEIL = /^pt-[a-z0-9-]{1,60}$/;

/**
 * Eingabe aus dem Netz prüfen — nie kürzen (zu lang → 413), Pflicht: Firmenname, Vor- und Nachname, E-Mail, mindestens ein Produkt.
 * `quelle: 'link'` nimmt keine Kennungen an (ein Externer wählt nie aus dem Bestand).
 */
export function anfrageEingabePruefen(roh: unknown, quelle: AnfrageQuelle): EingabeErgebnis {
  const o = roh && typeof roh === 'object' && !Array.isArray(roh) ? roh as Record<string, unknown> : {};
  const G = FORMULAR_GRENZEN;
  const zuLang: string[] = [];
  const t = (v: unknown, feld: string, n: number): string | undefined => {
    const s = typeof v === 'string' ? v.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim() : '';
    if (s.length > n) zuLang.push(feld);
    return s || undefined;
  };
  const f = o.firma && typeof o.firma === 'object' ? o.firma as Record<string, unknown> : {};
  const p = o.person && typeof o.person === 'object' ? o.person as Record<string, unknown> : {};
  const firma = { name: t(f.name, 'Firma', G.firma) ?? '', strasse: t(f.strasse, 'Straße', G.strasse), plz: t(f.plz, 'PLZ', G.plz), ort: t(f.ort, 'Ort', G.ort) };
  const email = t(p.email, 'E-Mail', G.email)?.toLowerCase();
  const person = { anrede: p.anrede === 'Du' ? 'Du' as const : 'Sie' as const, vorname: t(p.vorname, 'Vorname', G.name) ?? '', nachname: t(p.nachname, 'Nachname', G.name) ?? '', email: email ?? '', telefon: t(p.telefon, 'Telefon', G.telefon) };
  const notizRoh = typeof o.notiz === 'string' ? o.notiz.replace(/\u0000/g, '').trim() : '';
  if (notizRoh.length > G.notiz) zuLang.push('Notiz');
  const liste = Array.isArray(o.produkte) ? o.produkte : [];
  if (liste.length > G.produkte) zuLang.push('Produkte');
  if (zuLang.length) return { ok: false, status: 413, fehler: `Zu lang — nichts gespeichert: ${zuLang.join(', ')}.` };
  if (!firma.name) return { ok: false, status: 400, fehler: 'Bitte die Firma des Kunden angeben.' };
  if (!person.vorname || !person.nachname) return { ok: false, status: 400, fehler: 'Bitte Vor- und Nachname des Ansprechpartners angeben.' };
  if (!mailOk(person.email)) return { ok: false, status: 400, fehler: 'Bitte eine gültige E-Mail-Adresse des Ansprechpartners angeben — an sie geht das Angebot.' };
  const produkte: ProduktWahl[] = [];
  for (const x of liste) {
    const w = x && typeof x === 'object' ? x as Record<string, unknown> : {};
    if (typeof w.id !== 'string' || !KENNUNG.test(w.id)) return { ok: false, status: 400, fehler: 'Ein Produkt hat keine gültige Kennung.' };
    if (produkte.some(y => y.id === w.id)) continue;
    const optionen = Array.isArray(w.optionen) ? [...new Set(w.optionen.filter((v): v is string => typeof v === 'string' && TEIL.test(v)))] : [];
    if (optionen.length > G.optionen) return { ok: false, status: 413, fehler: 'Zu viele Optionen bei einem Produkt.' };
    const zahlen = (v: unknown): Record<string, number> | undefined => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
      const e = Object.entries(v as Record<string, unknown>).filter(([k, n]) => TEIL.test(k) && typeof n === 'number' && Number.isFinite(n)) as [string, number][];
      return e.length ? Object.fromEntries(e) : undefined;
    };
    const rabatt = typeof w.rabattProzent === 'number' && Number.isFinite(w.rabattProzent) && w.rabattProzent > 0 ? Math.min(100, Math.round(w.rabattProzent * 100) / 100) : undefined;
    const mengen = zahlen(w.mengen), preise = zahlen(w.preise);
    produkte.push({ id: w.id, ...(optionen.length ? { optionen } : {}), ...(mengen ? { mengen } : {}), ...(rabatt ? { rabattProzent: rabatt } : {}), ...(preise ? { preise } : {}) });
  }
  if (!produkte.length) return { ok: false, status: 400, fehler: 'Bitte mindestens ein Produkt wählen.' };
  const start = typeof o.start === 'string' && o.start ? o.start : undefined;
  if (start && !istKalendertag(start)) return { ok: false, status: 400, fehler: 'Der gewünschte Start ist kein gültiges Datum.' };
  const kontaktId = quelle === 'intern' && typeof o.kontaktId === 'string' && /^c-[a-z0-9-]{4,60}$/.test(o.kontaktId) ? o.kontaktId : undefined;
  const firmaId = quelle === 'intern' && typeof o.firmaId === 'string' && /^f-[a-z0-9-]{2,63}$/.test(o.firmaId) ? o.firmaId : undefined;
  return {
    ok: true, e: {
      firma: Object.fromEntries(Object.entries(firma).filter(([, v]) => v)) as AnfrageEingabe['firma'],
      person: Object.fromEntries(Object.entries(person).filter(([, v]) => v)) as AnfrageEingabe['person'],
      ...(kontaktId ? { kontaktId } : {}), ...(firmaId ? { firmaId } : {}), produkte, ...(start ? { start } : {}), ...(notizRoh ? { notiz: notizRoh } : {}),
    },
  };
}

// ── Produkte → Positionen ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Grenzen der Menge eines Tages-/Stundensatz-Teils (Menge je Monat). */
export function mengeGrenzen(t: Pick<PreisTeil, 'art'> & Partial<Pick<PreisTeil, 'deckel' | 'mengeJeMonat'>>): { min: number; max: number; vorgabe: number; einheit: string } {
  const max = t.art === 'stundensatz' ? (t.deckel?.stundenJeMonat ?? STUNDEN_OHNE_DECKEL_MAX) : TAGE_JE_MONAT_MAX;
  return { min: 0.5, max, vorgabe: Math.min(max, geplanteMenge(t as PreisTeil) || 1), einheit: mengeEinheit(t.art) };
}
/** Ist das Produkt wählbar (aktiv, nicht im Papierkorb)? */
export const produktWaehlbar = (l: Pick<Leistung, 'status' | 'geloeschtAm'>) => l.status === 'aktiv' && !l.geloeschtAm;

export interface PositionenErgebnis {
  positionen: AngebotPosition[];
  /** Abweichungen vom Listenpreis (Rabatt, eigener Preis) — dann Freigabe. */
  abweichungen: string[];
  /** Weitere Gründe gegen den automatischen Versand (Preis offen, Angebotstext fehlt). */
  offen: string[];
}

/**
 * Die Angebots-Positionen aus der Produktwahl — EIN Weg wie „Angebot erstellen“ am Deal (`angebotPositionenAusProdukt`: je Grund-Teil eine
 * Position, gewählte Optionen dazu). Danach: Menge der Sätze (in den Grenzen, sonst 400), Rabatt bzw. eigener Preis (→ `abweichungen`). Ein
 * unbekanntes oder nicht wählbares Produkt bzw. eine unbekannte Option → Fehler. Rein.
 */
export function positionenAusWahl(wahl: readonly ProduktWahl[], leistungen: readonly Leistung[], opt: { kleinunternehmer?: boolean; erlaubt?: readonly string[] } = {}): { ok: true; r: PositionenErgebnis } | { ok: false; fehler: string } {
  const positionen: AngebotPosition[] = [];
  const abweichungen: string[] = [], offen: string[] = [];
  for (const [i, w] of wahl.entries()) {
    const l = leistungen.find(x => x.id === w.id);
    if (!l || !produktWaehlbar(l) || (opt.erlaubt && !opt.erlaubt.includes(l.id))) return { ok: false, fehler: 'Ein gewähltes Produkt gibt es nicht (mehr) bzw. ist hier nicht freigegeben.' };
    const teile = preisteileVon(l);
    for (const o of w.optionen ?? []) if (!teile.some(t => t.id === o && t.rolle === 'option')) return { ok: false, fehler: `„${l.name}“: unbekannte Option.` };
    const pos = angebotPositionenAusProdukt(l, w.optionen ?? [], { idBasis: `p${i + 1}`, kleinunternehmer: opt.kleinunternehmer });
    if (produktAngebotFehlt(l).length) offen.push(`„${l.name}“ hat keinen Angebotstext.`);
    for (const p of pos) {
      const t = p.preisTeilId ? teile.find(x => x.id === p.preisTeilId) : undefined;
      if (t && istSatz(t.art) && p.satz) {
        const g = mengeGrenzen(t);
        const m = w.mengen?.[t.id];
        if (m !== undefined) {
          if (!(m >= g.min && m <= g.max)) return { ok: false, fehler: `„${l.name}“: ${teilLabel(t)} höchstens ${g.max.toLocaleString('de-DE')} ${g.einheit} je Monat (mindestens ${g.min.toLocaleString('de-DE')}).` };
          p.menge = Math.round(m * 100) / 100;
        }
      }
      if (t && typeof t.betragCent !== 'number' && t.art !== 'kostenlos') offen.push(`„${l.name}“: Preis offen (${teilLabel(t)}).`);
      const eigen = t ? w.preise?.[t.id] : undefined;
      if (eigen !== undefined) {
        if (!(eigen >= 0 && eigen <= 1_000_000_000)) return { ok: false, fehler: `„${l.name}“: der Preis ist ungültig.` };
        if (Math.round(eigen) !== p.einzelpreisCent) { p.einzelpreisCent = Math.round(eigen); abweichungen.push(`„${l.name}“: eigener Preis statt Listenpreis.`); }
      }
      if (w.rabattProzent) { p.rabattProzent = w.rabattProzent; }
      positionen.push(p);
    }
    if (w.rabattProzent) abweichungen.push(`„${l.name}“: ${w.rabattProzent.toLocaleString('de-DE')} % Rabatt.`);
  }
  return { ok: true, r: { positionen, abweichungen: [...new Set(abweichungen)], offen: [...new Set(offen)] } };
}

/**
 * Nur Listenpreise? (Prüfung am fertigen Positions-Stand, unabhängig vom Formular): jede Position kommt aus einem Produkt, trägt keinen Rabatt
 * und steht auf dem Preis ihres Preis-Teils. Rein.
 */
export function nurListenpreise(positionen: readonly AngebotPosition[], leistungen: readonly Leistung[]): boolean {
  return positionen.every(p => {
    if (!p.leistungId || p.rabattProzent) return false;
    const l = leistungen.find(x => x.id === p.leistungId);
    if (!l) return false;
    const t = p.preisTeilId ? preisteileVon(l).find(x => x.id === p.preisTeilId) : hauptpreis(l);
    const liste = t ? (typeof t.betragCent === 'number' ? t.betragCent : 0) : Math.round((l.preis?.betrag ?? 0) * 100);
    return p.einzelpreisCent === liste;
  });
}

// ── Leitplanken ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface LeitplankenLage {
  /** Positionen nur aus Produkten zum Listenpreis (`nurListenpreise`) und ohne Abweichungen aus dem Formular. */
  listenpreise: boolean;
  abweichungen: readonly string[];
  offen: readonly string[];
  /** Gültige Empfänger-Adresse. */
  adresseOk: boolean;
  /** Die erkannte Person hat eine Werbesperre (Art. 21) — dann nur Freigabe. */
  werbesperre: boolean;
  /** Absender-Postfach gewählt und verbunden. */
  absenderOk: boolean;
  /** Datenschutzhinweis vollständig (Verantwortlicher + Kontaktweg eingerichtet). */
  datenschutzOk: boolean;
}
export const ABSENDER_FEHLT = 'Absender-Postfach fehlt — unter Markttraktion › Formulare › Einstellungen wählen.';
/**
 * Versenden oder zur Freigabe? Automatisch NUR, wenn alles stimmt (Kevin 25.10.): Listenpreise ohne Rabatt/eigenen Preis, gültige Adresse,
 * keine Werbesperre, Absender-Postfach da, Datenschutzhinweis vollständig, kein offener Preis/Text. Der Text kommt nur aus Vorlagen — KI gibt
 * es auf diesem Weg nicht. Art. 18 entscheidet vorher (abgelehnt, nichts angelegt). Rein.
 */
export function leitplanken(l: LeitplankenLage): { versenden: boolean; gruende: string[] } {
  const g: string[] = [];
  if (!l.listenpreise || l.abweichungen.length) g.push(...(l.abweichungen.length ? l.abweichungen : ['Nicht nur Listenpreise der Produkte.']));
  g.push(...l.offen);
  if (!l.adresseOk) g.push('Die Empfänger-Adresse ist nicht gültig.');
  if (l.werbesperre) g.push('Die Person hat eine Werbesperre — ein Mensch entscheidet.');
  if (!l.absenderOk) g.push(ABSENDER_FEHLT);
  if (!l.datenschutzOk) g.push('Datenschutzhinweis unvollständig — Verantwortlichen und Kontaktweg unter Einstellungen › Datenschutz eintragen.');
  return { versenden: g.length === 0, gruende: [...new Set(g)] };
}

// ── Mail-Vorlage ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const MAIL_PLATZHALTER = ['{gruss}', '{vorname}', '{nachname}', '{firma}', '{nummer}', '{titel}', '{gueltig_bis}', '{absender}'] as const;
export const MAIL_STANDARD = {
  betreff: 'Angebot {nummer} – {titel}',
  text: '{gruss}\n\nanbei erhalten Sie, wie besprochen, unser Angebot {nummer} für „{titel}“ (gültig bis {gueltig_bis}).\n\nBei Fragen melden Sie sich gern.\n\nMit freundlichen Grüßen\n{absender}',
  textDu: '{gruss}\n\nanbei, wie besprochen, unser Angebot {nummer} für „{titel}“ (gültig bis {gueltig_bis}).\n\nMelde dich gern bei Fragen.\n\nViele Grüße\n{absender}',
} as const;
export interface MailWerte { anrede: 'Sie' | 'Du'; vorname?: string; nachname?: string; firma?: string; nummer: string; titel: string; gueltigBis: string; absender: string }
const datumDe = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : d);
const gruss = (w: MailWerte) => (w.anrede === 'Du' ? `Hallo ${(w.vorname ?? '').trim()},`.replace(' ,', ',') : `Guten Tag ${`${w.vorname ?? ''} ${w.nachname ?? ''}`.trim()},`.replace(' ,', ','));
/** Platzhalter ersetzen (nur die bekannten; Zeilenumbrüche im Betreff weg). Rein. */
export function vorlageFuellen(vorlage: string, w: MailWerte): string {
  const werte: Record<string, string> = {
    '{gruss}': gruss(w), '{vorname}': w.vorname ?? '', '{nachname}': w.nachname ?? '', '{firma}': w.firma ?? '', '{nummer}': w.nummer, '{titel}': w.titel,
    '{gueltig_bis}': datumDe(w.gueltigBis), '{absender}': w.absender,
  };
  return vorlage.replace(/\{[a-z_]+\}/g, m => (m in werte ? werte[m] : m));
}

export interface DatenschutzZeile { verantwortlich: string; mail: string; seite: string }
/**
 * Datenschutzhinweis (Art. 13/14) unter jeder Angebots-Mail — immer, auch mit eigener Vorlage: wer verarbeitet, wozu, Grundlage
 * (Vertragsanbahnung, Art. 6 Abs. 1 lit. b), woher die Daten stammen (unser Vertrieb), Rechte und Kontaktweg. Hinweis, keine Rechtsberatung.
 */
export function datenschutzZeilen(d: DatenschutzZeile, du: boolean): string {
  const ihr = du ? 'deine' : 'Ihre', ihnen = du ? 'dir' : 'Ihnen', ihrer = du ? 'deiner' : 'Ihrer';
  const weg = [d.mail, d.seite].filter(Boolean).join(' · ');
  return `Datenschutz: ${d.verantwortlich} verarbeitet ${ihr} Kontaktdaten, um ${ihnen} das angefragte Angebot zu senden und es mit ${ihnen} zu besprechen (Art. 6 Abs. 1 lit. b DSGVO). Die Angaben stammen aus dem Gespräch mit unserem Vertrieb. Werbung senden wir nur mit ${ihrer} Einwilligung. Auskunft, Berichtigung, Löschung, Widerspruch: ${weg}`;
}
/** Betreff und Text der Angebots-Mail aus der Vorlage (Einstellungen, sonst Standard je Anrede) + Datenschutzhinweis. Rein, ohne KI. */
export function angebotMail(e: Pick<FormularEinstellungen, 'betreff' | 'text'>, w: MailWerte, d: DatenschutzZeile): { betreff: string; text: string } {
  const betreff = vorlageFuellen(e.betreff?.trim() || MAIL_STANDARD.betreff, w).replace(/[\r\n]+/g, ' ').trim();
  const roh = e.text?.trim() || (w.anrede === 'Du' ? MAIL_STANDARD.textDu : MAIL_STANDARD.text);
  return { betreff, text: `${vorlageFuellen(roh, w).trim()}\n\n--\n${datenschutzZeilen(d, w.anrede === 'Du')}` };
}

// ── Welche Gesellschaft, welches Postfach (25.10., Kevin: „Mandate laufen vorerst über die Selbstständigkeit“) ──────────────────────

/**
 * Darf eine Gesellschaft Angebote über das Formular stellen? Jede feste Gesellschaft, deren Zeit als ARBEIT zählt (`zaehltAlsArbeit`, lib/einheiten.ts) —
 * also die Business-Gesellschaften UND die Privat-Arbeits-Einheit (Selbstständigkeit). Nie eine feste Kennung abfragen, nie `privat`.
 */
export const formularGesellschaftOk = (g: unknown): g is import('@/lib/einheiten').Gesellschaftskennung => istGesellschaft(g) && zaehltAlsArbeit(g);
/** Darf ein Postfach Absender der Formular-Angebote sein? Ein Business-Bereich oder der Bereich einer Arbeits-Einheit (nie `privat`). */
export const formularPostfachBereichOk = (bereich: unknown): boolean => !!bereich && bereich !== 'privat' && (bereichVon(bereich) === 'business' || zaehltAlsArbeit(bereich));
/** Ein Konto „nur Business“ sieht nur Eingänge einer Business-Gesellschaft (ohne Angabe: Altbestand aus der Zeit „nur Business“). */
export const eingangFuerNurBusiness = (g: unknown): boolean => g === undefined || g === null || istBusinessGesellschaft(g);

// ── Öffentlicher Katalog eines Links ─────────────────────────────────────────────────────────────────────────────────────────────

export interface KatalogTeil { id: string; label: string; preis: string; rolle: 'grund' | 'option'; menge?: { min: number; max: number; vorgabe: number; einheit: string } }
export interface KatalogProdukt { id: string; name: string; text?: string; teile: KatalogTeil[] }
/**
 * Was eine Formular-Seite über ein Produkt zeigt: Name (Angebotstitel), kurzer Leistungstext, Preis-Teile mit Listenpreis und Mengen-Grenzen.
 * Nie Gesellschaft, Kosten, Aufwand, Mandate, Kunden. Rein.
 */
export function katalogProdukt(l: Leistung): KatalogProdukt {
  const teile = preisteileVon(l).map((t): KatalogTeil => ({ id: t.id, label: teilLabel(t), preis: preisText(t), rolle: t.rolle, ...(istSatz(t.art) ? { menge: mengeGrenzen(t) } : {}) }));
  const text = (l.angebot?.leistungstext ?? '').trim().slice(0, 400);
  return { id: l.id, name: (l.angebot?.titel?.trim() || l.name).slice(0, 160), ...(text ? { text } : {}), teile };
}

// ── Konto der Person: Export und Löschen (lib/datenschutz/konto-daten.ts) ────────────────────────────────────────────────────────

export const GETILGT_PERSON = '[gelöscht]';
/** Die eigenen Stempel einer Kontoperson im Formular-Bestand (Anfragen, Links, Einstellungen) — nur Kennung, Art und Zeit. Rein. */
export function formularEintraegeVon(b: FormularBestand, speicher: string): { art: string; id: string; am?: string }[] {
  return [
    ...b.eingaenge.filter(e => e.von === speicher || e.entschieden?.von === speicher || e.versendet?.von === speicher).map(e => ({ art: 'anfrage', id: e.id, am: e.am })),
    ...b.links.filter(l => l.angelegtVon === speicher).map(l => ({ art: 'link', id: l.id, am: l.angelegt })),
    ...(b.einstellungen.absender?.person === speicher || b.einstellungen.geaendertVon === speicher ? [{ art: 'einstellungen', id: 'einstellungen', ...(b.einstellungen.geaendert ? { am: b.einstellungen.geaendert } : {}) }] : []),
  ];
}
/** Konto gelöscht: Einträge bleiben (Nachweis), der Speichername wird „[gelöscht]“; ein Absender-Postfach der Person fällt weg (es gibt es nicht mehr). Rein. */
export function formularOhnePerson(b: FormularBestand, speicher: string): { neu: FormularBestand; n: number } {
  let n = 0;
  const t = (v: string | undefined) => (v === speicher ? (n++, GETILGT_PERSON) : v);
  const eingaenge = b.eingaenge.map(e => ({
    ...e, ...(e.von ? { von: t(e.von) } : {}),
    ...(e.entschieden ? { entschieden: { ...e.entschieden, von: t(e.entschieden.von)! } } : {}),
    ...(e.versendet ? { versendet: { ...e.versendet, von: t(e.versendet.von)! } } : {}),
  }));
  const links = b.links.map(l => ({ ...l, angelegtVon: t(l.angelegtVon)! }));
  const { absender, geaendertVon, ...rest } = b.einstellungen;
  const absWeg = absender?.person === speicher;
  if (absWeg) n++;
  const einstellungen: FormularEinstellungen = { ...rest, ...(absender && !absWeg ? { absender } : {}), ...(geaendertVon ? { geaendertVon: t(geaendertVon)! } : {}) };
  return { neu: { ...b, eingaenge, links, einstellungen }, n };
}
