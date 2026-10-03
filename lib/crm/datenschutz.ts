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

import { tagVon } from '@/lib/zeit';
import { hatTyp, kategorienVon } from './mehrfach';
import { informationOffen, INFO_FRIST_TAGE } from './netzwerken-recht';
import { UG_NAME } from '@/lib/einheiten';
export interface PflichtVorschlag { id: string; herkunft?: Herkunft; rechtsgrundlage?: Rechtsgrundlage; fremddaten?: boolean; grund: string }

export function pflichtangaben(kontakte: Kontakt[], crm: CrmBestand): PflichtVorschlag[] {
  const mandat = new Set(crm.mandate.flatMap(m => m.kontaktIds));
  const raus: PflichtVorschlag[] = [];
  for (const k of kontakte) {
    const v: PflichtVorschlag = { id: k.id, grund: '' };
    const gruende: string[] = [];
    if (!k.herkunft) {
      const q = `${k.quelle ?? ''} ${kategorienVon(k).join(' ')}`.toLowerCase();
      if (mandat.has(k.id) || k.lebensphase === 'kunde' || k.lebensphase === 'ex_kunde') { v.herkunft = 'vertrag'; gruende.push('Kunde/Mandat'); }
      else if (/apple|adressbuch/.test(q) || hatTyp(k, 'Netzwerk')) { v.herkunft = 'bekannt'; gruende.push('persönliches Adressbuch'); }
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

export function selbstpruefung(kontakte: Kontakt[], crm: CrmBestand, heute: string, anmeldung: { konten: number; mitPasswort: number }, loeschMonate = 24): Pruefpunkt[] {
  const n = kontakte.length || 1;
  const quote = (x: number) => (x === 0 ? 'erfuellt' : x / n > 0.5 ? 'offen' : 'teilweise') as PruefStatus;
  const ohneRg = kontakte.filter(k => !k.rechtsgrundlage).length, ohneHerkunft = kontakte.filter(k => !k.herkunft).length;
  const art14faellig = kontakte.filter(k => art14(k, heute)?.faellig).length;
  const widerrufenOhneSperre = kontakte.filter(k => !k.werbesperre && (k.einwilligungen ?? []).length > 0 && (k.einwilligungen ?? []).every(e => e.widerrufenAm)).length;
  const antraegeUeber = crm.antraege.filter(a => a.status === 'offen' && a.frist < heute).length;
  const alt = speicherbegrenzung(kontakte, heute, loeschMonate, crm).length;
  // Netzwerken (03.10., netz-recht): die drei Verarbeitungen von Veranstaltungs-Kontakten müssen im Verzeichnis stehen; Personen ohne Datenschutzhinweis (Art. 13) zählen.
  const nwFehlt = VV_NETZWERKEN_IDS.filter(id => !crm.verarbeitungen.some(v => v.id === id));
  const ohneInfo = informationOffen(kontakte, heute).length;
  const nwPersonen = kontakte.filter(k => !!k.rechtsgrundlageNotiz).length;
  return [
    { id: 'verzeichnis', titel: 'Verzeichnis der Verarbeitungstätigkeiten', status: nwFehlt.length ? 'teilweise' : crm.verarbeitungen.length >= 4 ? 'erfuellt' : crm.verarbeitungen.length ? 'teilweise' : 'offen', befund: `${crm.verarbeitungen.length} Verarbeitungen beschrieben${nwFehlt.length ? ` — es fehlt: ${nwFehlt.map(id => VV_NETZWERKEN_NAMEN[id]).join(', ')}` : ''}`, norm: 'Art. 30 DSGVO' },
    { id: 'rechtsgrundlage', titel: 'Rechtsgrundlage je Kontakt', status: quote(ohneRg), befund: ohneRg ? `${ohneRg} von ${kontakte.length} ohne dokumentierte Grundlage` : 'bei allen dokumentiert', norm: 'Art. 6 DSGVO' },
    { id: 'herkunft', titel: 'Herkunft der Daten', status: quote(ohneHerkunft), befund: ohneHerkunft ? `${ohneHerkunft} ohne Herkunft` : 'bei allen dokumentiert', norm: 'Art. 14 DSGVO' },
    { id: 'info-veranstaltung', titel: 'Information bei Veranstaltungs-Kontakten', status: !ohneInfo ? 'erfuellt' : ohneInfo / Math.max(1, nwPersonen) > 0.5 ? 'offen' : 'teilweise', befund: ohneInfo ? `${ohneInfo} Personen aus Netzwerken seit über ${INFO_FRIST_TAGE} Tagen ohne Datenschutzhinweis (Danke-Mail „ist raus“ oder von Hand vermerkt)` : nwPersonen ? 'alle Personen aus Netzwerken informiert (Danke-Mail oder persönlich)' : 'keine Personen aus Netzwerken', norm: 'Art. 13 DSGVO' },
    { id: 'art14', titel: 'Information bei Fremddaten', status: art14faellig ? 'offen' : 'erfuellt', befund: art14faellig ? `${art14faellig} Personen seit über 25 Tagen nicht informiert` : 'keine Frist überschritten', norm: 'Art. 14 Abs. 3 DSGVO' },
    { id: 'widerspruch', titel: 'Werbewiderspruch wirksam gesperrt', status: widerrufenOhneSperre ? 'offen' : 'erfuellt', befund: widerrufenOhneSperre ? `${widerrufenOhneSperre} haben alles widerrufen, sind aber nicht gesperrt` : 'Sperre greift in Liste, Entwurf und Agenten', norm: 'Art. 21 Abs. 3 DSGVO' },
    { id: 'antraege', titel: 'Betroffenenanträge fristgerecht', status: antraegeUeber ? 'offen' : 'erfuellt', befund: antraegeUeber ? `${antraegeUeber} Anträge über der Monatsfrist` : `${crm.antraege.filter(a => a.status === 'offen').length} offen, keiner überfällig`, norm: 'Art. 12 Abs. 3 DSGVO' },
    { id: 'loeschkonzept', titel: 'Speicherbegrenzung', status: alt ? 'teilweise' : 'erfuellt', befund: alt ? `${alt} Kontakte ohne Beziehung und Aktivität seit ${loeschMonate} Monaten — löschen oder Frist mit Grund verlängern` : 'nichts über der Frist', norm: 'Art. 5 Abs. 1 lit. e DSGVO' },
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
  const s = tagVon(jetzt);
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

// ── Verarbeitungen von „Netzwerken“ (03.10., netz-recht) — idempotent nachgetragen ──

export const VV_NETZWERKEN_NAMEN: Record<string, string> = {
  'vv-netzwerken': 'Netzwerken — Kontakte von Veranstaltungen',
  'vv-besuche-kunde': 'Kontakte für Kunden-Events (Übermittlung an den Kunden)',
  'vv-kunden-export': 'Kunden-Export (CSV)',
};
export const VV_NETZWERKEN_IDS = Object.keys(VV_NETZWERKEN_NAMEN);

/** Die drei Verarbeitungen, die „Netzwerken“ und „Für Kunden“ im Verzeichnis (Art. 30) brauchen. Hinweis, keine Rechtsberatung — anwaltlich gegenlesen. */
export function verarbeitungenNetzwerken(jetzt: string): Verarbeitung[] {
  const stand = tagVon(jetzt);
  const gemein = {
    toms: 'Zugang nur mit Anmeldung (zwei Konten, zweiter Faktor), HTTPS, Server in Deutschland (Hetzner), Bestände verschlüsselt auf der Platte, nächtliche verschlüsselte Sicherung, Fotos/Sprachnotizen verschlüsselt abgelegt, Art. 18 und Werbesperre greifen überall',
    verantwortlich: UG_NAME, stand,
  };
  const dritt = 'Microsoft, Apple, Anthropic (USA): Standardvertragsklauseln bzw. Data Privacy Framework — prüfen';
  return [
    { id: 'vv-netzwerken', name: VV_NETZWERKEN_NAMEN['vv-netzwerken'], zweck: 'Pflege geschäftlicher Kontakte nach der persönlichen Begegnung auf Veranstaltungen (Visitenkarte, Gespräch): Nachfassen, Danke-Mail, Terminvereinbarung. Keine Werbung ohne Einwilligung.', personen: 'Geschäftskontakte, die auf einer Veranstaltung persönlich ihre Visitenkarte gegeben haben', daten: 'Name, Firma, Position, Geschäftskontaktdaten, Foto der Visitenkarte, Gesprächs-Info (Freitext), optional eigene Sprachnotiz, Event, Zeitpunkt, nächster Schritt, Vermerk Danke-Mail und Datenschutzhinweis', rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO (Interessenabwägung LIA-Netzwerken v1, DATENSCHUTZ_NETZWERKEN.md); Werbung nur mit Einwilligung (Art. 6 Abs. 1 lit. a, § 7 UWG)', empfaenger: 'Kevin, Malin; Hetzner (Hosting, Auftragsverarbeitung); Microsoft 365 (Mail, Kalender); Apple iCloud (Kalender; optional Kontakte-App auf dem Gerät); Anthropic (ZOE, KI-Auswertung, nur gekapselt)', drittland: dritt, loeschfrist: 'Kartenfoto 6 Monate, Sprachnotiz 90 Tage, Gesprächs-Info 12 Monate nach dem Event; Kontakt ohne Interaktion: Prüf-Aufgabe nach 12 Monaten', ...gemein },
    { id: 'vv-besuche-kunde', name: VV_NETZWERKEN_NAMEN['vv-besuche-kunde'], zweck: 'Interim-Vertrieb für Kunden (Head of Sales): Kontakte, die wir auf einer Kunden-Veranstaltung kennenlernen, gehören auch uns (eigener Verantwortlicher); Weitergabe an den Kunden zur Weiterführung der Gespräche', personen: 'Geschäftskontakte, die auf einem Event „für einen Kunden“ ihre Visitenkarte gegeben haben', daten: 'Name, Firma, Position, E-Mail, Telefon, LinkedIn, Webseite, Herkunft, Tag der Begegnung, Vermerk Datenschutzhinweis — nie Fotos, Sprachnotizen, Gesprächsnotizen', rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO (eigenes berechtigtes Interesse; Übermittlung an den Kunden, Information in der Danke-Mail nach Art. 13 mit Empfänger); Rolle mit dem Kunden und Vertrag zu klären', empfaenger: 'Der jeweilige Kunde des Events; Kevin, Malin; Hetzner (Hosting)', drittland: 'keines (Empfänger im Inland, soweit der Kunde nicht anderes meldet) — prüfen', loeschfrist: 'Übergabe-Protokoll 36 Monate (Event bzw. Übergabe-Journal); beim Empfänger gilt dessen Frist; Mitteilung bei Löschung/Berichtigung an den Empfänger (Art. 19)', ...gemein },
    { id: 'vv-kunden-export', name: VV_NETZWERKEN_NAMEN['vv-kunden-export'], zweck: 'Bereitstellen der Kontaktliste eines Kunden-Events als Datei (CSV) für die Weitergabe an den Kunden', personen: 'An diesem Event neu angelegte Personen; Bestandspersonen nur mit ausdrücklichem Haken je Person', daten: 'Name, Firma, Position, E-Mail, Telefon, LinkedIn, Webseite, Herkunft je Zeile, Datum, Vermerk Datenschutzhinweis und „keine Werbe-Einwilligung“', rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO; Protokoll der Übergabe mit Empfänger und Personen-Kennungen (Art. 5 Abs. 2, 15, 19)', empfaenger: 'Der Kunde (Datei außerhalb der Software); Kevin, Malin', drittland: 'keines — prüfen', loeschfrist: 'Datei: nach der Weitergabe sofort löschen; Protokoll 36 Monate', ...gemein, toms: `${gemein.toms}; Export nur mit Sitzung (nie über den Dienstweg), Datei nach Weitergabe löschen, nie gesperrte Personen` },
  ];
}

/** Fehlende Netzwerken-Verarbeitungen nach `id` ergänzen (idempotent; vorhandene — auch von Hand geänderte — bleiben unverändert). */
export function verarbeitungenNachtragen(vorhanden: readonly Verarbeitung[], jetzt: string): Verarbeitung[] {
  const da = new Set(vorhanden.map(v => v.id));
  const dazu = verarbeitungenNetzwerken(jetzt).filter(v => !da.has(v.id));
  return dazu.length ? [...vorhanden, ...dazu] : [...vorhanden];
}

// ── Verarbeitung „Kalender (Google Workspace)“ (03.10., google-kal) — idempotent nachgetragen ──
// Kevin 03.10.: Business-Termine liegen im Google Kalender der Person. Hinweis, keine Rechtsberatung — anwaltlich gegenlesen.

export const VV_KALENDER_GOOGLE_ID = 'vv-kalender-google';

export function verarbeitungKalenderGoogle(jetzt: string): Verarbeitung {
  return {
    id: VV_KALENDER_GOOGLE_ID, name: 'Kalender (Google Workspace)',
    zweck: 'Business-Termine (Gespräche, Events, Fristen mit Zeit) im Google-Kalender der Beteiligten führen und mit MAKE OS in beide Richtungen abgleichen; Verknüpfung mit CRM-Meetings und Follow-ups',
    personen: 'Gesprächspartner und Teilnehmende, die in Terminen genannt oder eingeladen sind; Kevin, Malin',
    daten: 'Terminzeit, Titel, Ort, Notiz, Teilnehmer-Adressen mit Antwortstatus, Meet-Link, Erinnerungen — keine Mails, keine Dateien; Verbindung je Person über OAuth (Zugriffstoken nur verschlüsselt auf dem Server)',
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Termine mit Vertragspartnern) bzw. lit. f (Geschäftsbetrieb); Einladungen nur nach ausdrücklichem Klick',
    empfaenger: 'Google Ireland Ltd. / Google LLC (Google Workspace — Auftragsverarbeiter; Datenverarbeitungszusatz in der Workspace-Admin-Konsole bestätigen); Kevin, Malin; Hetzner (Hosting, Spiegel der Termine)',
    drittland: 'Google: Standardvertragsklauseln bzw. Data Privacy Framework, Datenstandort laut Workspace-Einstellung — prüfen',
    loeschfrist: 'Wahrheit ist Google (Löschung dort, Art. 17); der Spiegel in MAKE OS baut sich bei jedem Abgleich neu auf und fällt beim Trennen weg; Sicherung des iCloud→Google-Umzugs 30 Tage; Termine mit Personenbezug wie bei iCloud (Löschlauf meldet sie)',
    toms: 'Zugang nur mit Anmeldung (zwei Konten, zweiter Faktor), HTTPS, Server in Deutschland (Hetzner), Bestände verschlüsselt auf der Platte, Token nie im Browser und nie in Protokollen, OAuth mit PKCE und state, nur die Domain der Firma, Push-Meldungen nur mit Kanal-Token',
    verantwortlich: UG_NAME, stand: tagVon(jetzt),
  };
}

/** Die Verarbeitung „Kalender (Google Workspace)“ ergänzen, falls sie fehlt (vorhandene — auch von Hand geänderte — bleiben unverändert). */
export function verarbeitungKalenderNachtragen(vorhanden: readonly Verarbeitung[], jetzt: string): Verarbeitung[] {
  return vorhanden.some(v => v.id === VV_KALENDER_GOOGLE_ID) ? [...vorhanden] : [...vorhanden, verarbeitungKalenderGoogle(jetzt)];
}
