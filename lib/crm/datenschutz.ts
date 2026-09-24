// ─── CRM — Datenschutz als Code (rein, getestet) ───────────────────────────
// Konzept aus KEMARIS Operations (Stammdaten: Selbstprüfung, Pflichtangaben,
// Löschkonzept, Verarbeitungsverzeichnis, Betroffenenrechte), eigener Code:
// - Pflichtangaben: Herkunft (Art. 14) und Rechtsgrundlage (Art. 6) werden
//   per Regel VORGESCHLAGEN — erste passende Regel gewinnt, im Zweifel die
//   schwächere Grundlage (nie „Einwilligung“ raten). Übernommen wird per Klick.
// - Selbstprüfung aus den echten Beständen gerechnet, nicht abgehakt.
// Keine Rechtsberatung — einmal anwaltlich gegenlesen.

import type { Kontakt, Herkunft, Rechtsgrundlage } from '@/lib/make-one/crm';
import type { CrmBestand, Verarbeitung } from './typen';
import { art14 } from './recht';
import { speicherbegrenzung } from './kennzahlen';

export interface PflichtVorschlag { id: string; herkunft?: Herkunft; rechtsgrundlage?: Rechtsgrundlage; fremddaten?: boolean; grund: string }

export function pflichtangaben(kontakte: Kontakt[], crm: CrmBestand): PflichtVorschlag[] {
  const mandat = new Set(crm.mandate.flatMap(m => m.kontaktIds));
  const raus: PflichtVorschlag[] = [];
  for (const k of kontakte) {
    const v: PflichtVorschlag = { id: k.id, grund: '' };
    const gruende: string[] = [];
    if (!k.herkunft) {
      const q = `${k.quelle ?? ''} ${k.kategorie ?? ''}`.toLowerCase();
      if (mandat.has(k.id) || k.lebensphase === 'kunde' || k.lebensphase === 'ex_kunde') { v.herkunft = 'vertrag'; gruende.push('Kunde/Mandat'); }
      else if (/apple|adressbuch/.test(q) || k.typ === 'Netzwerk') { v.herkunft = 'bekannt'; gruende.push('persönliches Adressbuch'); }
      else if (k.vorgestelltDurch) { v.herkunft = 'empfehlung'; gruende.push('vorgestellt'); }
      else if (/leadliste|recherche|explorium|vibe|liste/.test(q)) { v.herkunft = 'recherche'; gruende.push('aus Recherche/Liste'); }
      else if (/hubspot/.test(q)) { v.herkunft = 'hubspot'; gruende.push('aus dem früheren CRM'); }
    }
    if (!k.rechtsgrundlage) {
      if ((k.einwilligungen ?? []).some(e => !e.widerrufenAm && e.grundlage === 'einwilligung')) { v.rechtsgrundlage = 'einwilligung'; gruende.push('Einwilligung liegt vor'); }
      else if (mandat.has(k.id) || k.lebensphase === 'kunde') { v.rechtsgrundlage = 'vertrag'; gruende.push('Vertrag'); }
      else { v.rechtsgrundlage = 'berechtigt'; gruende.push('im Zweifel berechtigtes Interesse (B2B-Anbahnung)'); }
    }
    const h = v.herkunft ?? k.herkunft;
    if ((h === 'recherche' || h === 'empfehlung') && !k.fremddaten && !k.art14InformiertAm) v.fremddaten = true;
    if (v.herkunft || v.rechtsgrundlage || v.fremddaten) { v.grund = gruende.join(' · '); raus.push(v); }
  }
  return raus;
}

export type PruefStatus = 'erfuellt' | 'teilweise' | 'offen';
export interface Pruefpunkt { id: string; titel: string; status: PruefStatus; befund: string; norm: string }

export function selbstpruefung(kontakte: Kontakt[], crm: CrmBestand, heute: string, anmeldung: { konten: number; mitPasswort: number }): Pruefpunkt[] {
  const n = kontakte.length || 1;
  const quote = (x: number) => (x === 0 ? 'erfuellt' : x / n > 0.5 ? 'offen' : 'teilweise') as PruefStatus;
  const ohneRg = kontakte.filter(k => !k.rechtsgrundlage).length, ohneHerkunft = kontakte.filter(k => !k.herkunft).length;
  const art14faellig = kontakte.filter(k => art14(k, heute)?.faellig).length;
  const widerrufenOhneSperre = kontakte.filter(k => !k.werbesperre && (k.einwilligungen ?? []).length > 0 && (k.einwilligungen ?? []).every(e => e.widerrufenAm)).length;
  const antraegeUeber = crm.antraege.filter(a => a.status === 'offen' && a.frist < heute).length;
  const alt = speicherbegrenzung(kontakte, heute).length;
  return [
    { id: 'verzeichnis', titel: 'Verzeichnis der Verarbeitungstätigkeiten', status: crm.verarbeitungen.length >= 4 ? 'erfuellt' : crm.verarbeitungen.length ? 'teilweise' : 'offen', befund: `${crm.verarbeitungen.length} Verarbeitungen beschrieben`, norm: 'Art. 30 DSGVO' },
    { id: 'rechtsgrundlage', titel: 'Rechtsgrundlage je Kontakt', status: quote(ohneRg), befund: ohneRg ? `${ohneRg} von ${kontakte.length} ohne dokumentierte Grundlage` : 'bei allen dokumentiert', norm: 'Art. 6 DSGVO' },
    { id: 'herkunft', titel: 'Herkunft der Daten', status: quote(ohneHerkunft), befund: ohneHerkunft ? `${ohneHerkunft} ohne Herkunft` : 'bei allen dokumentiert', norm: 'Art. 14 DSGVO' },
    { id: 'art14', titel: 'Information bei Fremddaten', status: art14faellig ? 'offen' : 'erfuellt', befund: art14faellig ? `${art14faellig} Personen seit über 25 Tagen nicht informiert` : 'keine Frist überschritten', norm: 'Art. 14 Abs. 3 DSGVO' },
    { id: 'widerspruch', titel: 'Werbewiderspruch wirksam gesperrt', status: widerrufenOhneSperre ? 'offen' : 'erfuellt', befund: widerrufenOhneSperre ? `${widerrufenOhneSperre} haben alles widerrufen, sind aber nicht gesperrt` : 'Sperre greift in Liste, Entwurf und Agenten', norm: 'Art. 21 Abs. 3 DSGVO' },
    { id: 'antraege', titel: 'Betroffenenanträge fristgerecht', status: antraegeUeber ? 'offen' : 'erfuellt', befund: antraegeUeber ? `${antraegeUeber} Anträge über der Monatsfrist` : `${crm.antraege.filter(a => a.status === 'offen').length} offen, keiner überfällig`, norm: 'Art. 12 Abs. 3 DSGVO' },
    { id: 'loeschkonzept', titel: 'Speicherbegrenzung', status: alt ? 'teilweise' : 'erfuellt', befund: alt ? `${alt} Interessenten ohne Interaktion seit 24 Monaten — löschen oder begründen` : 'nichts über der Frist', norm: 'Art. 5 Abs. 1 lit. e DSGVO' },
    { id: 'zugang', titel: 'Zugang nur mit Anmeldung', status: anmeldung.konten && anmeldung.mitPasswort === anmeldung.konten ? 'erfuellt' : 'teilweise', befund: `${anmeldung.mitPasswort} von ${anmeldung.konten} Konten mit Passwort`, norm: 'Art. 32 DSGVO' },
    { id: 'ki', titel: 'KI nur mit Arbeitsfeldern', status: 'erfuellt', befund: 'Agentenpakete ohne Privatnotiz und ohne gesperrte Personen (im Code erzwungen)', norm: 'Art. 5 Abs. 1 lit. c, Art. 28 DSGVO' },
  ];
}

/** Löschkonzept — Regeln und was davon heute fällig ist. */
export const LOESCHREGELN = [
  { id: 'interessent', titel: 'Interessent ohne Geschäftsbeziehung', frist: '24 Monate ab letztem Kontakt', aktion: 'Löschen oder Begründung', norm: 'Art. 5 Abs. 1 lit. e DSGVO' },
  { id: 'widerspruch', titel: 'Werbewiderspruch', frist: 'sofort', aktion: 'Sperren (Werbesperre bleibt stehen)', norm: 'Art. 21 Abs. 3, Art. 17 Abs. 3 DSGVO' },
  { id: 'kunde', titel: 'Kunde nach Vertragsende', frist: '36 Monate', aktion: 'Prüfen', norm: '§ 195 BGB (Verjährung)' },
  { id: 'korrespondenz', titel: 'Geschäftliche Korrespondenz', frist: '6 Jahre ab Jahresende', aktion: 'Sperren', norm: '§ 257 HGB' },
  { id: 'rechnung', titel: 'Rechnungen und Buchungsbelege', frist: '8 Jahre ab Jahresende', aktion: 'Sperren', norm: '§ 147 AO, § 257 HGB' },
] as const;

/** Startbestand für das Verzeichnis (Art. 30) — MAKE OS, nicht Operations. Wird einmal angelegt, danach gepflegt. */
export function verarbeitungenStart(jetzt: string): Verarbeitung[] {
  const s = jetzt.slice(0, 10);
  const v = (id: string, name: string, zweck: string, personen: string, daten: string, rechtsgrundlage: string, empfaenger: string, loeschfrist: string): Verarbeitung => ({
    id, name, zweck, personen, daten, rechtsgrundlage, empfaenger, drittland: 'Anthropic (USA) nur für KI-Auswertung: Standardvertragsklauseln / Data Privacy Framework — prüfen', loeschfrist,
    toms: 'Zugang nur mit Anmeldung (zwei Konten), HTTPS, Server in Deutschland (Hetzner), nächtliche verschlüsselte Sicherung, Agentenpakete ohne Privatnotiz', verantwortlich: 'Kevin Dieckmann (KD Ventures / Kevin Dieckmann Consulting)', stand: s,
  });
  return [
    v('vv-kontakte', 'Kontakt- und Interessentenverwaltung', 'Pflege geschäftlicher Kontakte, Anbahnung von Mandaten, persönliche Ansprache', 'Geschäftskontakte, Interessenten, Kunden, Partner', 'Name, Firma, Position, Kontaktdaten, Gesprächsnotizen, Einwilligungen', 'Art. 6 Abs. 1 lit. b, f; lit. a bei Einwilligung', 'Kevin, Malin; KI-Auswertung (Auftragsverarbeiter)', '24 Monate ohne Interaktion, Kunden 36 Monate nach Vertragsende'),
    v('vv-vertrieb', 'Vertriebssteuerung (Pipeline, Power Hour, Kennzahlen)', 'Priorisierung der Ansprache, Prognose, Nachhalten von Zusagen', 'Interessenten, Kunden', 'Chancen, Stufen, Werte, Aktivitäten', 'Art. 6 Abs. 1 lit. f', 'Kevin, Malin', 'mit dem Kontakt'),
    v('vv-mandate', 'Kunden- und Mandatsverwaltung', 'Durchführung und Abrechnung von Beratungsmandaten', 'Kunden und deren Ansprechpartner', 'Vertragsdaten, Honorare, Leistungen, Zahlungsstand', 'Art. 6 Abs. 1 lit. b, c', 'Kevin, Malin; Steuerberatung', '8 Jahre (Buchungsbelege), sonst 36 Monate nach Vertragsende'),
    v('vv-events', 'Veranstaltungen', 'Planung, Einladung und Nachbereitung eigener Events', 'Gäste, Co-Hosts', 'Name, Firma, Teilnahmestatus, Notizen', 'Art. 6 Abs. 1 lit. f; Einladung per Mail nur mit Einwilligung (§ 7 UWG)', 'Kevin, Malin', '24 Monate nach dem Event'),
  ];
}
