// ─── CRM — Exporte als CSV (rein, getestet, 27.09.) ─────────────────────────
// Stammdaten › Import & Export: fünf Tabellen für Kevins eigene
// Weiterverarbeitung (Excel, Brevo später, Steuerberater). Regeln:
//   · UTF-8 mit BOM, Semikolon, deutsche Spaltenköpfe, Datum ISO (YYYY-MM-DD)
//   · Zellen maskiert wie im Marketing-Export (csvZelle: ; " und Formeln)
//   · `privatNotiz` verlässt die Kartei NIE — steht in keiner Spalte
//   · Gesperrte Personen bleiben drin, aber markiert (WERBESPERRE), damit eine
//     Werbeliste sie ausschließen kann — nie stillschweigend weglassen
//   · Deals und Mandate tragen die Firma per Kennung (firmaId → Name über
//     firmen-bezug.ts), Follow-ups Person und Bezug in Klartext
// Kein Dateisystem hier — die Route (app/api/crm/export) liefert nur aus.

import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import type { Chance, CrmBestand, Firma, FollowUp, Mandat } from './typen';
import { kanalStatus } from './recht';
import { csvZelle } from './marketing';
import { firmaVonDeal, firmaVonMandat, dealZuFirma, mandatZuFirma } from './firmen-bezug';
import { gesamtwert, OFFENE_STUFEN, STUFEN, wahrscheinlichkeit } from './pipeline';
import { lifecycleVon } from './vorschlaege';
import type { LifecyclePhase } from './lifecycle';
import { beanVon, beanFirma, type BeanId } from './bean';

import { localDay } from '@/lib/zeit';
import { stationenVon, personenDerFirma, STATION_ART_LABEL } from './stationen';
import { emailsVon, EMAIL_ART_LABEL } from './emails';
import { typenVon, kategorienVon, labelsVon } from './mehrfach';
export const EXPORTE = ['kontakte', 'firmen', 'deals', 'followups', 'mandate'] as const;
export type ExportArt = typeof EXPORTE[number];
export const istExportArt = (v: unknown): v is ExportArt => typeof v === 'string' && (EXPORTE as readonly string[]).includes(v);

/** Beschriftung für die Knöpfe — was drin ist und was nicht. */
export const EXPORT_INFO: Record<ExportArt, { label: string; datei: string; text: string }> = {
  kontakte: { label: 'Kontakte', datei: 'Kontakte', text: 'Personen mit Firma, Kreis, Lifecycle, BEAN, Phase, Stufe, nächstem Schritt und Kanal-Freigabe. Ohne Privatnotiz und Verlauf.' },
  firmen: { label: 'Firmen', datei: 'Firmen', text: 'Unternehmen mit Branche, Rolle, Lead-Status und Zahl der Personen, offenen Deals und aktiven Mandate.' },
  deals: { label: 'Deals', datei: 'Deals', text: 'Pipeline mit Firma (per Kennung), Personen, Stufe, Wert, Gesamtwert, Wahrscheinlichkeit und nächstem Schritt.' },
  followups: { label: 'Follow-ups', datei: 'Follow-ups', text: 'Alle Follow-ups mit Person, Bezug (Deal, Mandat, Event, Firma), Fälligkeit, Status und Ergebnis.' },
  mandate: { label: 'Mandate', datei: 'Mandate', text: 'Kunden und Mandate mit Honorar, Laufzeit, Rechnungsrhythmus, Phase und Health-Werten.' },
};

export interface ExportQuelle {
  kontakte: Kontakt[]; crm: CrmBestand;
  /** Stichtag für den Lifecycle-Vorschlag (Score-Wärme); ohne: heute (UTC). */
  heute?: string;
}

type Wert = string | number | boolean | null | undefined;
type Spalte<T> = [kopf: string, wert: (x: T) => Wert];

const text = (v: Wert): string => (v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'ja' : 'nein') : String(v));
const tagISO = (v?: string | null): string => (v ?? '').slice(0, 10);
const zahlDE = (n?: number | null): string => (typeof n === 'number' && Number.isFinite(n) ? String(Math.round(n * 100) / 100).replace('.', ',') : '');

/** Kopfzeile + Zeilen als CSV-Text (BOM, Semikolon, Zeilen mit \n). */
export function csvTabelle<T>(spalten: Spalte<T>[], zeilen: T[]): string {
  const kopf = spalten.map(s => s[0]).join(';');
  const koerper = zeilen.map(z => spalten.map(([, f]) => csvZelle(text(f(z)))).join(';'));
  return '﻿' + [kopf, ...koerper].join('\n');
}

/** Dateiname: MAKE-OS-<Tabelle>-<Tag>.csv */
export const exportDateiname = (was: ExportArt, tag: string): string => `MAKE-OS-${EXPORT_INFO[was].datei}-${tag}.csv`;

// ── Helfer über den Bestand ─────────────────────────────────────────────────
function nachId<T extends { id: string }>(liste: T[]): Map<string, T> { return new Map(liste.map(x => [x.id, x])); }
const personenNamen = (ids: string[], k: Map<string, Kontakt>) => ids.map(id => { const p = k.get(id); return p ? anzeigename(p) : ''; }).filter(Boolean).join(', ');
const firmaDerPerson = (p: Kontakt | undefined, f: Map<string, Firma>) => (p ? (p.firmaId ? f.get(p.firmaId)?.name : undefined) ?? p.firma : undefined);

// ── Kontakte (die Kartei) ───────────────────────────────────────────────────
type KontaktZeile = { k: Kontakt; f?: Firma; l: { phase: LifecyclePhase; vonHand: boolean }; bean: BeanId; firmen: Map<string, Firma> };
const KONTAKT_SPALTEN: Spalte<KontaktZeile>[] = [
  ['ID', z => z.k.id], ['VORNAME', z => z.k.vorname], ['NACHNAME', z => z.k.nachname], ['ANREDE', z => z.k.anrede], ['EMAIL', z => z.k.email], ['TELEFON', z => z.k.telefon ?? z.k.sms], ['LINKEDIN', z => z.k.linkedin],
  ['POSITION', z => z.k.position ?? z.k.jobtitel], ['FIRMA_ID', z => z.k.firmaId], ['FIRMA', z => z.f?.name ?? z.k.firma], ['BRANCHE', z => z.f?.branche ?? z.k.firmaBranche], ['STADT', z => z.f?.stadt ?? z.k.firmaStadt], ['WEBSEITE', z => z.f?.webseite ?? z.k.firmaWebseite],
  ['PRIORITAET', z => z.k.prio], ['KREIS', z => z.k.kreis], ['LIFECYCLE_PHASE', z => z.l.phase], ['LIFECYCLE_GESETZT', z => (z.l.vonHand ? z.l.phase : '')], ['BEAN', z => z.bean], ['LEBENSPHASE', z => z.k.lebensphase], ['ROLLEN', z => (z.k.rollen ?? []).join(', ')], ['STUFE', z => z.k.stufe], ['HAELT_BEZIEHUNG', z => z.k.besitzer], ['LETZTER_KONTAKT', z => tagISO(z.k.letzterKontakt)],
  ['NAECHSTER_SCHRITT_DATUM', z => z.k.naechsterSchritt?.datum], ['NAECHSTER_SCHRITT', z => z.k.naechsterSchritt?.text], ['WIEDERVORLAGE', z => z.k.wiedervorlage],
  ['MAIL_ERLAUBT', z => kanalStatus(z.k, 'mail').farbe === 'gruen'], ['NEWSLETTER_DOI', z => kanalStatus(z.k, 'newsletter').farbe === 'gruen'],
  ['WERBESPERRE', z => (z.k.werbesperre ? `seit ${z.k.werbesperre.seit}` : '')], ['HERKUNFT', z => z.k.herkunft], ['RECHTSGRUNDLAGE', z => z.k.rechtsgrundlage], ['QUELLE', z => z.k.quelle], ['IMPORTIERT_AM', z => tagISO(z.k.importiertAm)],
  // 28.09. (am Ende angehängt — bestehende Spalten bleiben an ihrem Platz): Mehrfachwerte mit „ · “ verbunden.
  ['TYPEN', z => typenVon(z.k).join(' · ')], ['KATEGORIEN', z => kategorienVon(z.k).join(' · ')], ['LABELS', z => labelsVon(z.k).join(' · ')],
  ['WEITERE_EMAILS', z => emailsVon(z.k).filter(a => a.adresse !== (z.k.email ?? '')).map(a => `${a.adresse}${a.art ? ` (${EMAIL_ART_LABEL[a.art]})` : ''}`).join(' · ')],
  ['STATIONEN', z => stationenVon(z.k).map(st => `${z.firmen.get(st.firmaId)?.name ?? st.firmaId}${st.rolle ? `, ${st.rolle}` : ''}${st.art ? ` (${STATION_ART_LABEL[st.art]})` : ''}${st.von || st.bis ? ` ${st.von ?? '…'}–${st.bis ?? (st.aktiv ? 'heute' : '…')}` : ''}${st.aktiv ? '' : ' [ehemalig]'}`).join(' · ')],
];
export function kontakteCsv(q: ExportQuelle): string {
  const firmen = nachId(q.crm.firmen);
  // Lifecycle (28.09., H4): LIFECYCLE_PHASE = was gilt (gesetzt, sonst Lead); LIFECYCLE_GESETZT = nur die von Hand
  // gesetzte Phase, leer wenn nicht gesetzt. BEAN: von Hand, sonst abgeleitet (ohne Dateiablage).
  const heute = q.heute ?? localDay();
  return csvTabelle(KONTAKT_SPALTEN, q.kontakte.map(k => ({ k, f: k.firmaId ? firmen.get(k.firmaId) : undefined, l: lifecycleVon(k, q.crm, heute), bean: beanVon(k, q.crm).bean, firmen })));
}

// ── Firmen ──────────────────────────────────────────────────────────────────
type FirmaZeile = { f: Firma; personen: number; dealsOffen: number; mandateAktiv: number; bean: BeanId };
const FIRMA_SPALTEN: Spalte<FirmaZeile>[] = [
  ['ID', z => z.f.id], ['NAME', z => z.f.name], ['DOMAIN', z => z.f.domain], ['WEBSEITE', z => z.f.webseite], ['BRANCHE', z => z.f.branche], ['MITARBEITER', z => z.f.mitarbeiter], ['UMSATZ', z => z.f.umsatz],
  ['STADT', z => z.f.stadt], ['GEGRUENDET', z => z.f.gegruendet], ['RECHTSFORM', z => z.f.rechtsform], ['LINKEDIN', z => z.f.linkedin], ['TELEFON', z => z.f.telefon], ['EMAIL', z => z.f.email],
  ['ROLLE', z => z.f.rolle], ['BEAN', z => z.bean], ['LEAD_STATUS', z => z.f.lead?.status], ['LEAD_FIT', z => z.f.lead?.fit], ['SQL_AM', z => z.f.lead?.sqlAm],
  ['PERSONEN', z => z.personen], ['DEALS_OFFEN', z => z.dealsOffen], ['MANDATE_AKTIV', z => z.mandateAktiv], ['GEAENDERT', z => tagISO(z.f.geaendert)],
  // Mutterfirma (28.09., #7) — am Ende angehängt.
  ['MUTTER_ID', z => z.f.mutterId],
];
export function firmenCsv(q: ExportQuelle): string {
  const zeilen = q.crm.firmen.map(f => ({
    f,
    // Personen der Firma nur über die Stationen (28.09.) — laufende.
    personen: personenDerFirma(q.kontakte, f.id).length,
    dealsOffen: q.crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe) && dealZuFirma(c, f)).length,
    mandateAktiv: q.crm.mandate.filter(m => m.status === 'aktiv' && mandatZuFirma(m, f)).length,
    bean: beanFirma(f, q.crm, q.kontakte).bean,
  }));
  return csvTabelle(FIRMA_SPALTEN, zeilen);
}

// ── Deals ───────────────────────────────────────────────────────────────────
type DealZeile = { c: Chance; firma?: Firma; personen: string; p: number };
const DEAL_SPALTEN: Spalte<DealZeile>[] = [
  ['ID', z => z.c.id], ['TITEL', z => z.c.titel], ['FIRMA_ID', z => z.firma?.id ?? z.c.firmaId], ['FIRMA', z => z.firma?.name ?? z.c.firma], ['PERSONEN', z => z.personen],
  ['ART', z => z.c.art], ['STUFE', z => z.c.stufe], ['STUFE_NAME', z => STUFEN.find(s => s.id === z.c.stufe)?.label],
  ['WERT_BETRAG', z => zahlDE(z.c.wert.betrag)], ['WERT_BASIS', z => z.c.wert.basis], ['LAUFZEIT_MONATE', z => z.c.wert.laufzeitMonate], ['GESAMTWERT', z => zahlDE(gesamtwert(z.c))],
  ['WAHRSCHEINLICHKEIT_PROZENT', z => z.p], ['GEWICHTET', z => zahlDE(Math.round(gesamtwert(z.c) * z.p / 100))],
  ['QUELLE', z => z.c.quelle], ['GESELLSCHAFT', z => z.c.gesellschaft], ['BESITZER', z => z.c.besitzer],
  ['NAECHSTER_SCHRITT_DATUM', z => z.c.naechsterSchritt?.datum], ['NAECHSTER_SCHRITT', z => z.c.naechsterSchritt?.text], ['ERWARTET_AM', z => z.c.erwartetAm],
  ['GRUND', z => z.c.grund], ['WIEDERVORLAGE', z => z.c.wiedervorlage], ['LETZTE_AKTIVITAET', z => tagISO(z.c.letzteAktivitaet)], ['ANGELEGT', z => tagISO(z.c.angelegt)], ['GEAENDERT', z => tagISO(z.c.geaendert)],
];
export function dealsCsv(q: ExportQuelle): string {
  const kontakte = nachId(q.kontakte);
  const zeilen = q.crm.chancen.map(c => ({ c, firma: firmaVonDeal(c, q.crm.firmen), personen: personenNamen(c.kontaktIds, kontakte), p: wahrscheinlichkeit(c.stufe, q.crm.wahrscheinlichkeiten) }));
  return csvTabelle(DEAL_SPALTEN, zeilen);
}

// ── Follow-ups ──────────────────────────────────────────────────────────────
type FollowUpZeile = { f: FollowUp; person?: Kontakt; firma?: string; bezugTitel?: string };
const FOLLOWUP_SPALTEN: Spalte<FollowUpZeile>[] = [
  ['ID', z => z.f.id], ['FAELLIG', z => z.f.faellig], ['UHRZEIT', z => z.f.uhrzeit], ['STATUS', z => z.f.status], ['ART', z => z.f.art], ['TEXT', z => z.f.text],
  ['PERSON_ID', z => z.f.kontaktId], ['PERSON', z => (z.person ? anzeigename(z.person) : '')], ['FIRMA', z => z.firma],
  ['BEZUG_ART', z => z.f.bezug.art], ['BEZUG_ID', z => z.f.bezug.id], ['BEZUG', z => z.bezugTitel],
  ['ZUSTAENDIG', z => z.f.zustaendig], ['QUELLE', z => z.f.quelle], ['ERGEBNIS', z => z.f.ergebnis], ['NOTIZ', z => z.f.notiz], ['VERSCHOBEN', z => z.f.verschoben],
  ['ERLEDIGT_AM', z => tagISO(z.f.erledigtAm)], ['ANGELEGT', z => tagISO(z.f.angelegt)], ['GEAENDERT', z => tagISO(z.f.geaendert)],
];
/** Klartext zum Bezug: Deal-Titel, Kunde des Mandats, Event-Titel, Firmenname, Person. */
export function bezugTitel(f: Pick<FollowUp, 'bezug'>, q: ExportQuelle): string | undefined {
  const { art, id } = f.bezug;
  if (art === 'chance') return q.crm.chancen.find(c => c.id === id)?.titel;
  if (art === 'mandat') { const m = q.crm.mandate.find(x => x.id === id); return m ? firmaVonMandat(m, q.crm.firmen)?.name ?? m.kunde : undefined; }
  if (art === 'event') return q.crm.events.find(e => e.id === id)?.titel;
  if (art === 'firma') return q.crm.firmen.find(x => x.id === id)?.name;
  const p = q.kontakte.find(k => k.id === id);
  return p ? anzeigename(p) : undefined;
}
export function followupsCsv(q: ExportQuelle): string {
  const kontakte = nachId(q.kontakte), firmen = nachId(q.crm.firmen);
  const zeilen = [...(q.crm.followups ?? [])].sort((a, b) => a.faellig.localeCompare(b.faellig) || a.id.localeCompare(b.id)).map(f => {
    const person = f.kontaktId ? kontakte.get(f.kontaktId) : undefined;
    return { f, person, firma: firmaDerPerson(person, firmen), bezugTitel: bezugTitel(f, q) };
  });
  return csvTabelle(FOLLOWUP_SPALTEN, zeilen);
}

// ── Mandate ─────────────────────────────────────────────────────────────────
type MandatZeile = { m: Mandat; firma?: Firma; personen: string };
const MANDAT_SPALTEN: Spalte<MandatZeile>[] = [
  ['ID', z => z.m.id], ['KUNDE', z => z.firma?.name ?? z.m.kunde], ['FIRMA_ID', z => z.firma?.id ?? z.m.firmaId], ['TITEL', z => z.m.titel], ['PERSONEN', z => z.personen],
  ['ART', z => z.m.art], ['STATUS', z => z.m.status], ['PHASE', z => z.m.phase], ['GESELLSCHAFT', z => z.m.gesellschaft], ['ZUSTAENDIG', z => z.m.zustaendig],
  ['START', z => z.m.start], ['ENDE', z => z.m.ende], ['MINDESTLAUFZEIT_MONATE', z => z.m.mindestlaufzeitMonate], ['KUENDIGUNGSFRIST_TAGE', z => z.m.kuendigungsfristTage], ['VERLAENGERUNG', z => z.m.verlaengerung],
  ['HONORAR_BETRAG', z => zahlDE(z.m.honorar.betrag)], ['HONORAR_BASIS', z => z.m.honorar.basis], ['NETTO', z => z.m.honorar.netto], ['UST_SATZ', z => z.m.ustSatz],
  ['RECHNUNGSRHYTHMUS', z => z.m.rechnungsrhythmus], ['ZAHLUNGSZIEL_TAGE', z => z.m.zahlungszielTage], ['VERTRAG_UNTERSCHRIEBEN', z => z.m.vertragUnterschrieben], ['NAECHSTES_REVIEW', z => z.m.naechstesReview],
  ['HEALTH_BETEILIGUNG', z => z.m.health.beteiligung], ['HEALTH_UMSETZUNG', z => z.m.health.umsetzung], ['HEALTH_WIRKUNG', z => z.m.health.wirkung], ['HEALTH_ZAHLUNG', z => z.m.health.zahlung], ['HEALTH_STIMMUNG', z => z.m.health.stimmung],
  ['OFFENE_PUNKTE', z => z.m.offen.length], ['DEAL_ID', z => z.m.chanceId], ['QUELLE', z => z.m.quelle], ['GEAENDERT', z => tagISO(z.m.geaendert)],
];
export function mandateCsv(q: ExportQuelle): string {
  const kontakte = nachId(q.kontakte);
  return csvTabelle(MANDAT_SPALTEN, q.crm.mandate.map(m => ({ m, firma: firmaVonMandat(m, q.crm.firmen), personen: personenNamen(m.kontaktIds, kontakte) })));
}

/** Die eine Einstiegsfunktion für die Route. */
export function exportCsv(was: ExportArt, q: ExportQuelle): string {
  switch (was) {
    case 'kontakte': return kontakteCsv(q);
    case 'firmen': return firmenCsv(q);
    case 'deals': return dealsCsv(q);
    case 'followups': return followupsCsv(q);
    case 'mandate': return mandateCsv(q);
  }
}

/** Alle Spaltenköpfe je Tabelle — für den Test, dass nichts Privates darin steht. */
export const EXPORT_SPALTEN: Record<ExportArt, string[]> = {
  kontakte: KONTAKT_SPALTEN.map(s => s[0]), firmen: FIRMA_SPALTEN.map(s => s[0]), deals: DEAL_SPALTEN.map(s => s[0]),
  followups: FOLLOWUP_SPALTEN.map(s => s[0]), mandate: MANDAT_SPALTEN.map(s => s[0]),
};
