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
import { SICHERUNG_GENERATIONEN, SICHERUNG_SATZ } from './loeschfristen';

import { tagVon } from '@/lib/zeit';
import { hatTyp, kategorienVon } from './mehrfach';
import { informationOffen, INFO_FRIST_TAGE } from './netzwerken-recht';
import { UG_NAME } from '@/lib/einheiten';
import { createHash } from 'node:crypto';
import { VERANTWORTLICH_EINRICHTUNG, avvOffen, avvText, drittlandOhneGarantie, type Empfaenger } from '@/lib/datenschutz/einrichtung';
import { WEG } from '@/lib/wege';
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
/** `weg`: wohin der Knopf „Beheben“ führt (05.10.: jede Prüfung mit Weg zum Beheben). */
export interface Pruefpunkt { id: string; titel: string; status: PruefStatus; befund: string; norm: string; weg?: { text: string; href: string } }

/**
 * Was die Selbstprüfung außerhalb des CRM braucht (05.10., Paket „DSGVO-Grundlagen im Code“) — der Server sammelt es
 * (`datenschutzUmfeld`, lib/datenschutz/umfeld.ts). Fehlt es (alte Aufrufer, Tests), prüfen die betroffenen Punkte ehrlich
 * „nicht geprüft“ statt „erfüllt“.
 */
export interface DatenschutzUmfeld {
  verantwortlicher: { gesetzt: boolean; quelle: 'einrichtung' | 'umgebung' | null; luecken: string[] };
  empfaenger: readonly Empfaenger[];
  /** Zweiter Faktor der Konten im Haushalt des Inhabers (die Konten, die an die Daten kommen). */
  zweiterFaktor: { konten: number; mit: number };
  /** Letzte Nachtsicherung laut Statusdatei vom Server (`system/sicherung.json`); null = keine Datei (lokal, oder Server meldet nicht). */
  sicherung: { verfahren: 'age' | 'openssl' | null; zeit?: string } | null;
  /** Agenten (automatische KI-Läufe), je einzeln abschaltbar unter Agenten (agents-config). */
  agenten: { aktiv: number; gesamt: number };
  /** Pannen-Register (05.10., Zusatz): offene Pannen und davon dringende (Meldung/Benachrichtigung fällig). Optional. */
  pannen?: { offen: number; dringend: number };
}

const W = {
  stammdaten: { text: 'Stammdaten › Datenschutz', href: WEG.stammdaten('datenschutz') },
  qualitaet: { text: 'Stammdaten › Datenqualität', href: WEG.stammdaten('qualitaet') },
  verantwortlicher: { text: 'Verantwortlichen eintragen', href: WEG.datenschutz('verantwortlicher') },
  empfaenger: { text: 'AVV-Nachweise eintragen', href: WEG.datenschutz('empfaenger') },
  verzeichnis: { text: 'Verzeichnis öffnen', href: WEG.datenschutz('verzeichnis') },
  konto: { text: 'Konto › Zweiter Faktor', href: WEG.konto() },
  agenten: { text: 'Agenten einzeln abschalten', href: WEG.agenten() },
  hoi: { text: 'Head of IT › Sicherung (age einrichten, DEPLOY.md)', href: '/os/hoi' },
} as const;

export function selbstpruefung(kontakte: Kontakt[], crm: CrmBestand, heute: string, anmeldung: { konten: number; mitPasswort: number }, loeschMonate = 24, umfeld?: DatenschutzUmfeld): Pruefpunkt[] {
  const n = kontakte.length || 1;
  const quote = (x: number) => (x === 0 ? 'erfuellt' : x / n > 0.5 ? 'offen' : 'teilweise') as PruefStatus;
  const ohneRg = kontakte.filter(k => !k.rechtsgrundlage).length, ohneHerkunft = kontakte.filter(k => !k.herkunft).length;
  const art14faellig = kontakte.filter(k => art14(k, heute)?.faellig).length;
  const widerrufenOhneSperre = kontakte.filter(k => !k.werbesperre && (k.einwilligungen ?? []).length > 0 && (k.einwilligungen ?? []).every(e => e.widerrufenAm)).length;
  const offeneAntraege = crm.antraege.filter(a => a.status === 'offen');
  const antraegeUeber = offeneAntraege.filter(a => a.frist < heute).length;
  const alt = speicherbegrenzung(kontakte, heute, loeschMonate, crm).length;
  // Netzwerken (03.10., netz-recht): die drei Verarbeitungen von Veranstaltungs-Kontakten müssen im Verzeichnis stehen; Personen ohne Datenschutzhinweis (Art. 13) zählen.
  const nwFehlt = VV_NETZWERKEN_IDS.filter(id => !crm.verarbeitungen.some(v => v.id === id));
  const ohneInfo = informationOffen(kontakte, heute).length;
  const nwPersonen = kontakte.filter(k => !!k.rechtsgrundlageNotiz).length;
  const raus: Pruefpunkt[] = [];
  // ── Einrichtung (05.10.): Verantwortlicher ──
  if (umfeld) {
    const v = umfeld.verantwortlicher;
    raus.push({ id: 'verantwortlicher', titel: 'Verantwortlicher benannt', status: v.gesetzt ? 'erfuellt' : 'offen', befund: v.gesetzt ? (v.quelle === 'umgebung' ? 'aus der Umgebung der Instanz (in der Einrichtung überschreibbar)' : 'in der Einrichtung eingetragen') : `fehlt — ${v.luecken.length ? `es fehlt: ${v.luecken.join(', ')}` : 'eintragen'}; Auskunft und Verzeichnis zeigen „Verantwortlicher fehlt“`, norm: 'Art. 13 Abs. 1 lit. a, Art. 30 Abs. 1 lit. a DSGVO', ...(v.gesetzt ? {} : { weg: W.verantwortlicher }) });
  }
  raus.push(
    { id: 'verzeichnis', titel: 'Verzeichnis der Verarbeitungstätigkeiten', status: nwFehlt.length ? 'teilweise' : crm.verarbeitungen.length >= 4 ? 'erfuellt' : crm.verarbeitungen.length ? 'teilweise' : 'offen', befund: `${crm.verarbeitungen.length} Verarbeitungen beschrieben${nwFehlt.length ? ` — es fehlt: ${nwFehlt.map(id => VV_NETZWERKEN_NAMEN[id]).join(', ')}` : ''}`, norm: 'Art. 30 DSGVO', weg: W.verzeichnis },
    { id: 'rechtsgrundlage', titel: 'Rechtsgrundlage je Kontakt', status: quote(ohneRg), befund: ohneRg ? `${ohneRg} von ${kontakte.length} ohne dokumentierte Grundlage` : 'bei allen dokumentiert', norm: 'Art. 6 DSGVO', weg: W.stammdaten },
    { id: 'herkunft', titel: 'Herkunft der Daten', status: quote(ohneHerkunft), befund: ohneHerkunft ? `${ohneHerkunft} ohne Herkunft` : 'bei allen dokumentiert', norm: 'Art. 14 DSGVO', weg: W.stammdaten },
    { id: 'info-veranstaltung', titel: 'Information bei Veranstaltungs-Kontakten', status: !ohneInfo ? 'erfuellt' : ohneInfo / Math.max(1, nwPersonen) > 0.5 ? 'offen' : 'teilweise', befund: ohneInfo ? `${ohneInfo} Personen aus Netzwerken seit über ${INFO_FRIST_TAGE} Tagen ohne Datenschutzhinweis (Danke-Mail „ist raus“ oder von Hand vermerkt)` : nwPersonen ? 'alle Personen aus Netzwerken informiert (Danke-Mail oder persönlich)' : 'keine Personen aus Netzwerken', norm: 'Art. 13 DSGVO', weg: { text: 'Netzwerken › Danke-Mails', href: WEG.netzwerken() } },
    { id: 'art14', titel: 'Information bei Fremddaten', status: art14faellig ? 'offen' : 'erfuellt', befund: art14faellig ? `${art14faellig} Personen seit über 25 Tagen nicht informiert` : 'keine Frist überschritten', norm: 'Art. 14 Abs. 3 DSGVO', weg: W.stammdaten },
    { id: 'widerspruch', titel: 'Werbewiderspruch wirksam gesperrt', status: widerrufenOhneSperre ? 'offen' : 'erfuellt', befund: widerrufenOhneSperre ? `${widerrufenOhneSperre} haben alles widerrufen, sind aber nicht gesperrt` : 'Sperre greift in Liste, Entwurf und Agenten', norm: 'Art. 21 Abs. 3 DSGVO', weg: W.qualitaet },
    { id: 'antraege', titel: 'Betroffenenanträge fristgerecht', status: antraegeUeber ? 'offen' : 'erfuellt', befund: antraegeUeber ? `${antraegeUeber} von ${offeneAntraege.length} offenen Anträgen über der Monatsfrist` : offeneAntraege.length ? `${offeneAntraege.length} offen, keiner überfällig — nächste Frist ${offeneAntraege.map(a => a.frist).sort()[0]}` : 'kein offener Antrag', norm: 'Art. 12 Abs. 3 DSGVO', weg: W.stammdaten },
    { id: 'loeschkonzept', titel: 'Speicherbegrenzung', status: alt ? 'teilweise' : 'erfuellt', befund: alt ? `${alt} Kontakte ohne Beziehung und Aktivität seit ${loeschMonate} Monaten — löschen oder Frist mit Grund verlängern` : 'nichts über der Frist', norm: 'Art. 5 Abs. 1 lit. e DSGVO', weg: W.stammdaten },
  );
  // ── Zugang (05.10.: auch der zweite Faktor) ──
  const pw = anmeldung.konten > 0 && anmeldung.mitPasswort === anmeldung.konten;
  const zf = umfeld?.zweiterFaktor;
  const zfVoll = !!zf && zf.konten > 0 && zf.mit === zf.konten;
  raus.push({ id: 'zugang', titel: 'Zugang nur mit Anmeldung und zweitem Faktor', status: pw && zfVoll ? 'erfuellt' : 'teilweise', befund: `${anmeldung.mitPasswort} von ${anmeldung.konten} Konten mit Passwort · ${zf ? `${zf.mit} von ${zf.konten} Konten im Haushalt mit zweitem Faktor` : 'zweiter Faktor nicht geprüft'}`, norm: 'Art. 32 DSGVO', ...(pw && zfVoll ? {} : { weg: W.konto }) });
  if (!umfeld) {
    raus.push({ id: 'ki', titel: 'KI nur mit Arbeitsfeldern und AVV', status: 'teilweise', befund: 'Arbeitsfelder gekapselt (im Code erzwungen) · AVV und Schalter nicht geprüft (ohne Einrichtung)', norm: 'Art. 5 Abs. 1 lit. c, Art. 28 DSGVO', weg: W.empfaenger });
    return raus;
  }
  // ── KI (05.10.: echt — AVV des KI-Anbieters bestätigt? automatische Läufe abschaltbar?) ──
  const ki = umfeld.empfaenger.filter(e => !e.archiviert && /anthropic/i.test(`${e.id} ${e.name}`));
  const kiAvv = ki.length > 0 && ki.every(e => e.avv.status === 'bestaetigt');
  const lauf = `automatische Läufe: ${umfeld.agenten.aktiv} von ${umfeld.agenten.gesamt} Agenten an — je Agent abschaltbar`;
  raus.push({ id: 'ki', titel: 'KI nur mit Arbeitsfeldern und AVV', status: !ki.length ? 'teilweise' : kiAvv ? 'erfuellt' : 'offen',
    befund: `Arbeitsfelder gekapselt, ohne Privatnotiz und gesperrte Personen (im Code erzwungen) · ${!ki.length ? 'KI-Anbieter fehlt im Empfänger-Register' : kiAvv ? `AVV ${ki.map(e => e.name).join(', ')}: ${avvText(ki[0].avv)}` : `AVV ${ki.map(e => e.name).join(', ')}: offen`} · ${lauf}`,
    norm: 'Art. 5 Abs. 1 lit. c, Art. 28, Art. 44 ff. DSGVO', weg: kiAvv ? W.agenten : W.empfaenger });
  // ── AVV-Nachweise je Auftragsverarbeiter, Drittland-Garantien ──
  const inGebrauch = umfeld.empfaenger.filter(e => !e.archiviert && e.rolle === 'auftragsverarbeiter');
  const offen = avvOffen(umfeld.empfaenger), ohneGarantie = drittlandOhneGarantie(umfeld.empfaenger);
  raus.push({ id: 'avv', titel: 'AVV je Auftragsverarbeiter, Garantien für Drittländer', status: !inGebrauch.length && !ohneGarantie.length ? 'erfuellt' : !offen.length && !ohneGarantie.length ? 'erfuellt' : offen.length === inGebrauch.length ? 'offen' : 'teilweise',
    befund: `${inGebrauch.length - offen.length} von ${inGebrauch.length} AVV bestätigt${offen.length ? ` — offen: ${offen.map(e => e.name).join(', ')}` : ''}${ohneGarantie.length ? ` · Drittland ohne Garantie: ${ohneGarantie.map(e => e.name).join(', ')}` : ''}`,
    norm: 'Art. 28 Abs. 3, Art. 44–46 DSGVO', ...(offen.length || ohneGarantie.length ? { weg: W.empfaenger } : {}) });
  // ── Sicherungen verschlüsselt (age = öffentlicher Schlüssel, privater nicht auf dem Server) ──
  const s = umfeld.sicherung;
  raus.push({ id: 'sicherung', titel: 'Sicherungen verschlüsselt (age)', status: s?.verfahren === 'age' ? 'erfuellt' : 'teilweise',
    befund: !s ? 'unbekannt — keine Statusdatei vom Server (lokal normal; auf dem Server schreibt deploy/sicherung.sh system/sicherung.json)' : s.verfahren === 'age' ? `age (privater Schlüssel nicht auf dem Server)${s.zeit ? ` · letzte ${tagVon(s.zeit)}` : ''}` : s.verfahren === 'openssl' ? 'Übergangsverfahren (openssl mit Passwort auf demselben Server) — age einrichten' : 'Verfahren nicht gemeldet',
    norm: 'Art. 32 Abs. 1 lit. a, c DSGVO', ...(s?.verfahren === 'age' ? {} : { weg: W.hoi }) });
  // ── Datenpannen (Art. 33/34): Meldung binnen 72 h, Benachrichtigung bei hohem Risiko ──
  if (umfeld.pannen) {
    const p = umfeld.pannen;
    raus.push({ id: 'pannen', titel: 'Datenpannen dokumentiert und gemeldet', status: p.dringend ? 'offen' : p.offen ? 'teilweise' : 'erfuellt', befund: p.dringend ? `${p.dringend} Panne(n) mit fälliger Meldung bzw. Benachrichtigung` : p.offen ? `${p.offen} Panne(n) noch nicht abgeschlossen` : 'keine offene Panne im Register', norm: 'Art. 33, 34 DSGVO', ...(p.offen ? { weg: { text: 'Pannen-Register', href: WEG.datenschutz('pannen') } } : {}) });
  }
  return raus;
}

/** Löschkonzept — Regeln und was davon heute fällig ist. */
export const LOESCHREGELN = [
  { id: 'interessent', titel: 'Interessent ohne Geschäftsbeziehung', frist: '24 Monate ab letztem Kontakt', aktion: 'Löschen oder Begründung', norm: 'Art. 5 Abs. 1 lit. e DSGVO' },
  { id: 'widerspruch', titel: 'Werbewiderspruch', frist: 'sofort', aktion: 'Sperren (Werbesperre bleibt stehen)', norm: 'Art. 21 Abs. 3, Art. 17 Abs. 3 DSGVO' },
  { id: 'kunde', titel: 'Kunde nach Vertragsende', frist: '36 Monate', aktion: 'Prüfen', norm: '§ 195 BGB (Verjährung)' },
  { id: 'korrespondenz', titel: 'Geschäftliche Korrespondenz', frist: '6 Jahre ab Jahresende', aktion: 'Sperren', norm: '§ 257 HGB' },
  { id: 'rechnung', titel: 'Rechnungen und Buchungsbelege', frist: '8 Jahre ab Jahresende', aktion: 'Sperren', norm: '§ 147 AO, § 257 HGB' },
  // DSGVO-Prüfung 04.10.: die Papierkörbe (CRM-Listen, Produkte, Aufgaben, Gesellschafts-Register) — Art. 15/17 erfassen sie mit.
  { id: 'papierkorb', titel: 'Papierkorb (CRM-Listen, Produkte, Aufgaben, Gesellschafts-Register)', frist: '30 Tage nach dem Löschen', aktion: 'Löschen (Morgenlauf; mit Verweisen bleibt der Eintrag im Papierkorb)', norm: 'Art. 5 Abs. 1 lit. e, Art. 17 DSGVO' },
  // DSGVO-Nachtrag 04.10. (Kevin): Kapazitätsdaten deaktivierter Team-Personen (lib/kapazitaet/aufraeumen.ts).
  { id: 'kapazitaet-team', titel: 'Kapazität deaktivierter Team-Personen (Grundwert, Urlaub/Blöcke, Zuweisungen, Einwilligung Erholung)', frist: '30 Tage nach dem Deaktivieren', aktion: 'Löschen (Morgenlauf; Reaktivieren davor erhält alles)', norm: 'Art. 5 Abs. 1 lit. e, Art. 17 DSGVO, § 26 BDSG' },
  // Kevin 05.10.: festgehaltene Wochenpläne der Kapazität (lib/kapazitaet/plan.ts).
  { id: 'kapazitaet-plan', titel: 'Festgehaltene Wochenpläne (Kapazität: verfügbar, geplant je Meilenstein/Zuweisung)', frist: '24 Monate je Woche', aktion: 'Löschen (Morgenlauf „Wochenplan festhalten“; Team-Personen ohne Konto mit ihren Kapazitätsdaten 30 Tage nach dem Deaktivieren)', norm: 'Art. 5 Abs. 1 lit. e, Art. 17 DSGVO, § 26 BDSG' },
  // DSGVO-Nachtrag 04.10. (Kevin): Unterlagen gelöschter Gesellschaften/Verträge bleiben (Aufbewahrungspflicht).
  { id: 'kapazitaet-konto', titel: 'Kapazität eines entfernten Kontos (Grundwert, Ausnahmen, Zuweisungen, Wochenplan-Zeilen)', frist: 'beim nächsten Morgenlauf nach dem Entfernen', aktion: 'Löschen (Morgenlauf)', norm: 'Art. 5 Abs. 1 lit. e, Art. 17 DSGVO, § 26 BDSG' },
  { id: 'loeschprotokoll', titel: 'Löschprotokoll (nur Protokoll-ID, Tag, Grund, wer)', frist: '36 Monate (abgeschlossene Einträge)', aktion: 'Löschen (Morgenlauf, Frist einstellbar)', norm: 'Art. 5 Abs. 2, Art. 17 DSGVO' },
  { id: 'pannen', titel: 'Pannen-Register (Art. 33 Abs. 5)', frist: '36 Monate ab Abschluss der Panne', aktion: 'Löschen (Morgenlauf, Frist einstellbar — anwaltlich bestätigen)', norm: 'Art. 33 Abs. 5, Art. 5 Abs. 2 DSGVO' },
  { id: 'bauplan-bilder', titel: 'Bauplan: Bildschirmfotos (können Personendaten zeigen)', frist: '90 Tage nach Abschluss der Karte, nicht zugeordnete 7 Tage', aktion: 'Löschen (Morgenlauf, Frist einstellbar)', norm: 'Art. 5 Abs. 1 lit. c, e DSGVO' },
  // 05.10. (DSGVO-Grundlagen): Sicherungen wahrheitsgemäß — Generationen bis ~12 Monate (deploy/generationen.sh), nicht 14 Tage.
  { id: 'sicherungen', titel: 'Verschlüsselte Sicherungen (Tages-, Wochen-, Monatsgenerationen)', frist: `bis zu ${SICHERUNG_GENERATIONEN.monatlich} Monate, danach überschrieben`, aktion: 'Überschreiben (gelöschte Daten nicht mehr verwendet; nach einem Zurückspielen löschen die Grabsteine erneut)', norm: 'Art. 5 Abs. 1 lit. e, Art. 17, Art. 32 DSGVO' },
  { id: 'unterlagen-register', titel: 'Unterlagen einer endgültig gelöschten Gesellschaft bzw. eines Vertrags (Dateiablage)', frist: '6 bzw. 10 Jahre ab Jahresende', aktion: 'Aufbewahren (Ablage, Bezug „(gelöscht)“ bleibt lesbar)', norm: '§ 257 HGB, § 147 AO' },
] as const;

/** Schutzmaßnahmen, die für jede Verarbeitung gelten (Art. 32) — Stand 05.10.; Einzelheiten: datenschutz/TOM.md. */
export const TOMS_BASIS = 'Zugang nur mit Anmeldung (Passwort, zweiter Faktor), Trennung je Haushalt serverseitig, HTTPS, Server in Deutschland (Hetzner), Bestände und Dateien verschlüsselt auf der Platte (AES-256-GCM), nächtliche verschlüsselte Sicherung (bis zu 12 Monate, danach überschrieben), Änderungsprotokoll ohne Werte, KI nur mit gekapselten Arbeitsfeldern (ohne Privatnotiz, ohne gesperrte Personen)';
/** Alte Fassung der Schutzmaßnahmen im Startbestand (bis 05.10.) — wird gehoben, solange unverändert. */
const TOMS_START_ALT = 'Zugang nur mit Anmeldung (zwei Konten), HTTPS, Server in Deutschland (Hetzner), nächtliche verschlüsselte Sicherung, Agentenpakete ohne Privatnotiz';
/** Empfänger-Register (System › Datenschutz) je Verarbeitung des Startbestands — der Export nennt sie mit AVV-Status. */
const START_EMPFAENGER: Record<string, string[]> = {
  'vv-kontakte': ['hetzner', 'anthropic', 'microsoft-365', 'google-workspace', 'apple-icloud'],
  'vv-vertrieb': ['hetzner', 'anthropic'],
  'vv-mandate': ['hetzner', 'anthropic'],
  'vv-events': ['hetzner', 'google-workspace', 'microsoft-365', 'apple-icloud'],
  'vv-netzwerken': ['hetzner', 'microsoft-365', 'google-workspace', 'apple-icloud', 'anthropic'],
  'vv-besuche-kunde': ['hetzner'],
  'vv-kunden-export': ['hetzner'],
  'vv-kalender-google': ['google-workspace', 'hetzner'],
  'vv-email-google': ['google-workspace', 'hetzner', 'anthropic'],
  'vv-gesellschaften': ['hetzner', 'anthropic'],
  'vv-kapazitaet': ['hetzner'],
};

/** Startbestand für das Verzeichnis (Art. 30) — MAKE OS, nicht Operations. Wird einmal angelegt, danach gepflegt. */
export function verarbeitungenStart(jetzt: string): Verarbeitung[] {
  const s = tagVon(jetzt);
  const v = (id: string, name: string, zweck: string, personen: string, daten: string, rechtsgrundlage: string, empfaenger: string, loeschfrist: string): Verarbeitung => ({
    id, name, zweck, personen, daten, rechtsgrundlage, empfaenger, drittland: 'Anthropic (USA) nur für KI-Auswertung: Standardvertragsklauseln / Data Privacy Framework — prüfen', loeschfrist,
    // Verantwortlicher (05.10.): nie fest im Code — der Platzhalter verweist auf die Einrichtung (System › Datenschutz).
    toms: TOMS_BASIS, verantwortlich: VERANTWORTLICH_EINRICHTUNG, stand: s, ...(START_EMPFAENGER[id] ? { empfaengerIds: START_EMPFAENGER[id] } : {}),
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
    verantwortlich: VERANTWORTLICH_EINRICHTUNG, stand,
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
    verantwortlich: VERANTWORTLICH_EINRICHTUNG, stand: tagVon(jetzt),
  };
}

/** Die Verarbeitung „Kalender (Google Workspace)“ ergänzen, falls sie fehlt (vorhandene — auch von Hand geänderte — bleiben unverändert). */
export function verarbeitungKalenderNachtragen(vorhanden: readonly Verarbeitung[], jetzt: string): Verarbeitung[] {
  return vorhanden.some(v => v.id === VV_KALENDER_GOOGLE_ID) ? [...vorhanden] : [...vorhanden, verarbeitungKalenderGoogle(jetzt)];
}

// ── Verarbeitung „E-Mail (Google Workspace)“ (03.10., gmail) — idempotent nachgetragen ──
// Kevin 03.10.: Mails ziehen von IONOS zu Gmail; gelesen, zugeordnet und beantwortet wird in MAKE OS. Hinweis, keine Rechtsberatung —
// anwaltlich gegenlesen.

export const VV_EMAIL_GOOGLE_ID = 'vv-email-google';

export function verarbeitungEmailGoogle(jetzt: string): Verarbeitung {
  return {
    id: VV_EMAIL_GOOGLE_ID, name: 'E-Mail (Google Workspace)',
    zweck: 'Geschäftliche E-Mails im Postfach (Gmail, Google Workspace) lesen, den Kontakten, Firmen und Deals in MAKE OS zuordnen, beantworten (nur auf Klick) und daraus Aufgaben, Follow-ups und Termine machen',
    personen: 'Absender und Empfänger geschäftlicher Mails (Interessenten, Kunden, Partner, Dienstleister); Kevin, Malin',
    daten: 'Absender, Empfänger, Betreff, Datum, Ausschnitt, Textkörper (reiner Text), Anhang-Metadaten (Name, Typ, Größe), Labels, Verknüpfung zu Kontakt/Firma/Deal; je Person ein Spiegel der letzten 30 Tage beim Verbinden, danach laufend; Anhänge liegen nie im Spiegel; Verbindung je Person über OAuth (Zugriffstoken nur verschlüsselt auf dem Server)',
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Anbahnung und Durchführung von Verträgen) bzw. lit. f (Geschäftsbetrieb, Interessenabwägung); Antworten nur 1:1 auf Klick, Werbung nur mit Einwilligung (§ 7 UWG); Art. 18 und Werbesperre greifen',
    empfaenger: 'Google Ireland Ltd. / Google LLC (Google Workspace — Auftragsverarbeiter; Datenverarbeitungszusatz in der Workspace-Admin-Konsole bestätigen); Kevin, Malin (je nur das eigene Postfach); Hetzner (Hosting, Spiegel); Anthropic (ZOE-Entwurf auf Klick, gekapselt, nie bei eingeschränkten Personen)',
    drittland: 'Google, Anthropic: Standardvertragsklauseln bzw. Data Privacy Framework, Datenstandort laut Workspace-Einstellung — prüfen',
    loeschfrist: 'Wahrheit ist Gmail (Löschung dort, Art. 17); Spiegel in MAKE OS 180 Tage (Löschfrist „Mail-Spiegel“, einstellbar 30–730 Tage) und beim Trennen sofort; Mails einer Person fallen mit Art. 17 im Spiegel weg (Antwort nennt „dort in Gmail löschen“); Verlaufszeile in der Kontaktakte = Betreff + Link, gilt wie die Kartei',
    toms: 'Zugang nur mit Anmeldung (zwei Konten, zweiter Faktor), HTTPS, Server in Deutschland (Hetzner), Bestände verschlüsselt auf der Platte, je Person getrennt (nie für das andere Konto lesbar), Token nie im Browser und nie in Protokollen, nur die Scope gmail.modify (kein Löschen, keine Einstellungen), HTML nie gerendert (nur Text), Bilder nie geladen, Anhänge nur als Download auf Klick, Senden nie über den Dienstweg, keine Mail-Inhalte in Logs, Push nur mit OIDC-Token von Google',
    verantwortlich: VERANTWORTLICH_EINRICHTUNG, stand: tagVon(jetzt),
  };
}

/** Die Verarbeitung „E-Mail (Google Workspace)“ ergänzen, falls sie fehlt (vorhandene — auch von Hand geänderte — bleiben unverändert). */
export function verarbeitungEmailNachtragen(vorhanden: readonly Verarbeitung[], jetzt: string): Verarbeitung[] {
  return vorhanden.some(v => v.id === VV_EMAIL_GOOGLE_ID) ? [...vorhanden] : [...vorhanden, verarbeitungEmailGoogle(jetzt)];
}

// ── Verarbeitungen „Gesellschafts-Register“ und „Kapazität“ (DSGVO-Prüfung 04.10.) — idempotent nachgetragen ──
// Kevin 04.10.: „DSGVO und Datenschutz — alles verbessern, anpassen.“ Hinweis, keine Rechtsberatung — anwaltlich gegenlesen.

export const VV_ORGANISATION_NAMEN: Record<string, string> = {
  'vv-gesellschaften': 'Gesellschafts-Register (Gesellschafter, Organe, Beschlüsse, Verträge)',
  'vv-kapazitaet': 'Kapazitätsplanung (Arbeitszeit, Urlaub, Zuweisungen)',
};
export const VV_ORGANISATION_IDS = Object.keys(VV_ORGANISATION_NAMEN);

/** Löschfrist der Kapazitätsplanung (seit dem DSGVO-Nachtrag 04.10. mit der 30-Tage-Frist für deaktivierte Team-Personen). */
const KAPA_LOESCHFRIST_0410 = 'bis zur Löschung durch Person bzw. Inhaber; Team-Personen ohne Konto: 30 Tage nach dem Deaktivieren automatisch (Morgenlauf; Reaktivieren davor erhält alles); Erholung wird nicht gespeichert (Rechnung im Speicher höchstens 60 s)';
/** Seit 05.10. mit den festgehaltenen Wochenplänen (24 Monate). */
const KAPA_LOESCHFRIST_0510 = `${KAPA_LOESCHFRIST_0410}; festgehaltene Wochenpläne (montags) 24 Monate je Woche`;
/** Seit 05.10. (DSGVO-Grundlagen) auch für entfernte Konten. */
const KAPA_LOESCHFRIST = `${KAPA_LOESCHFRIST_0510}; Konto entfernt: Kapazitätsdaten und Plan-Zeilen beim nächsten Morgenlauf`;
/** Löschfrist des Registers (DSGVO-Nachtrag 04.10.: Unterlagen bleiben nach dem endgültigen Löschen in der Ablage). */
const GES_LOESCHFRIST = 'Papierkorb 30 Tage; Verträge/Beschlüsse als Geschäftsunterlagen 6 bzw. 10 Jahre (§ 257 HGB); Unterlagen in der Dateiablage bleiben auch nach dem endgültigen Löschen einer Gesellschaft bzw. eines Vertrags erhalten (Aufbewahrungspflicht, Bezug als „(gelöscht)“ lesbar); Art. 17 einer Person tilgt ihre Kennung (auch im Papierkorb), Cap-Table und Vertrag bleiben';
/** Fassungen, die der Nachtrag ersetzt, solange niemand sie von Hand geändert hat (vorhandene Verzeichnisse). */
const ALTE_FASSUNGEN: Record<string, Partial<Record<keyof Verarbeitung, { alt: string | string[]; neu: string }>>> = {
  'vv-gesellschaften': { loeschfrist: { alt: 'Papierkorb 30 Tage; Verträge/Beschlüsse als Geschäftsunterlagen 6 bzw. 10 Jahre (§ 257 HGB); Art. 17 einer Person tilgt ihre Kennung (auch im Papierkorb), Cap-Table und Vertrag bleiben', neu: GES_LOESCHFRIST } },
  'vv-kapazitaet': { loeschfrist: { alt: ['bis zur Löschung durch Person bzw. Inhaber; Erholung wird nicht gespeichert (Rechnung im Speicher höchstens 60 s); offen: Einträge deaktivierter Team-Personen', KAPA_LOESCHFRIST_0410, KAPA_LOESCHFRIST_0510], neu: KAPA_LOESCHFRIST } },
};

export function verarbeitungenOrganisation(jetzt: string): Verarbeitung[] {
  const stand = tagVon(jetzt);
  const toms = 'Zugang nur im Haushalt des Inhabers mit Anmeldung (zweiter Faktor), Trennung serverseitig (fremder Haushalt/Testkunde → 403), HTTPS, Server in Deutschland (Hetzner), Bestände verschlüsselt auf der Platte, nächtliche verschlüsselte Sicherung, Änderungsprotokoll nur mit Kennungen/Feldnamen (nie Werte)';
  return [
    {
      id: 'vv-gesellschaften', name: VV_ORGANISATION_NAMEN['vv-gesellschaften'],
      zweck: 'Führung der eigenen Gesellschaften: Steckbrief, Gesellschafterliste/Cap-Table, Organe (Geschäftsführung, Prokura, Beirat), Beschlüsse, Beteiligungen und Verträge mit Fristen und Erinnerungen',
      personen: 'Gesellschafter, Organmitglieder und Vertragspartner (Personen des Haushalts oder CRM-Kontakte); Kevin, Malin',
      daten: 'Bezug nur als Kennung (Konto bzw. CRM-Kontakt/-Firma), Nennbetrag, Einlage, Stimmrecht, Klauseln, Funktion und Zeitraum, Vertragsart/-titel/-status/-fristen, Unterlagen (Dateiablage, verschlüsselt); keine Namen Dritter im Register selbst',
      rechtsgrundlage: 'Art. 6 Abs. 1 lit. c DSGVO (Gesellschafterliste § 40 GmbHG, Aufbewahrung § 257 HGB / § 147 AO), lit. b (Verträge mit der Person), lit. f (Führung der eigenen Gesellschaften)',
      empfaenger: 'Kevin, Malin; Hetzner (Hosting, Auftragsverarbeitung); Anthropic (ZOE liest das Register auf Frage — nur Kennungen, keine Kontaktnamen); Glocke/Telegram nur neutral („Eine Vertragsfrist naht“)',
      drittland: 'Anthropic (USA) nur für ZOE: Standardvertragsklauseln / Data Privacy Framework — prüfen',
      loeschfrist: GES_LOESCHFRIST,
      toms, verantwortlich: VERANTWORTLICH_EINRICHTUNG, stand,
    },
    {
      id: 'vv-kapazitaet', name: VV_ORGANISATION_NAMEN['vv-kapazitaet'],
      zweck: 'Realistische Planung: verfügbare Arbeitszeit je Person gegen den Aufwand von Meilensteinen/Zielen und wiederkehrende Mandats-/Kundenzeit; Engpässe sichtbar machen',
      personen: 'Personen des Teams (Konten des Haushalts, Team-Personen ohne Konto wie Mitarbeitende/Freie)',
      daten: 'Stunden je Woche, Urlaub und feste Blöcke (Titel nur für die Person selbst sichtbar), Zuweisungen Person × Mandat/Kunde (Kennung), Termine im Arbeitsfenster (nur Dauer/Anzahl, aus dem Kalender), gemessene Business-Fokuszeit, montags festgehaltener Wochenplan (verfügbar ohne Erholungs-Faktor, geplant je Meilenstein/Zuweisung — nur Kennungen); aus Gesundheitsdaten NUR ein Team-Faktor (Erholung), wenn die Person in der Kapazität selbst eingewilligt hat (Vorgabe aus, Zeitpunkt als Nachweis) UND ihre Gesundheit mit allen Konten des Haushalts teilt — der Wert nie gespeichert, nie im Business-Index, nie an ZOE',
      rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO / § 26 BDSG (Arbeitszeitplanung im Beschäftigungs- bzw. Auftragsverhältnis), lit. f (realistische Planung); Erholungs-Faktor: Art. 9 Abs. 2 lit. a (ausdrückliche, widerrufbare Einwilligung der Person in der Kapazität) — Einwilligungstext und Freiwilligkeit bei Beschäftigten (§ 26 Abs. 2 BDSG) prüfen',
      empfaenger: 'Personen des Haushalts (Einzelwerte der Erholung und Ausnahme-Titel nur die Person selbst); Hetzner (Hosting)',
      drittland: 'keines',
      loeschfrist: KAPA_LOESCHFRIST,
      toms: `${toms}; Privatfilter serverseitig (fuerBetrachter), Index ohne Gesundheits-Ableitung (ohneGesundheit)`, verantwortlich: VERANTWORTLICH_EINRICHTUNG, stand,
    },
  ];
}

/**
 * Fehlende Verarbeitungen „Gesellschafts-Register“/„Kapazität“ ergänzen (idempotent; vorhandene — auch geänderte — bleiben).
 * DSGVO-Nachtrag 04.10.: eine unveränderte alte Fassung (`ALTE_FASSUNGEN`) wird auf die neue gehoben — von Hand Geändertes bleibt.
 */
export function verarbeitungenOrganisationNachtragen(vorhanden: readonly Verarbeitung[], jetzt: string): Verarbeitung[] {
  const da = new Set(vorhanden.map(v => v.id));
  const dazu = verarbeitungenOrganisation(jetzt).filter(v => !da.has(v.id));
  let gehoben = false;
  const neu = vorhanden.map(v => {
    const f = ALTE_FASSUNGEN[v.id];
    if (!f) return v;
    let x = v;
    for (const [k, w] of Object.entries(f) as [keyof Verarbeitung, { alt: string | string[]; neu: string }][]) {
      if ((Array.isArray(w.alt) ? w.alt : [w.alt]).includes(String(x[k]))) { x = { ...x, [k]: w.neu }; gehoben = true; }
    }
    return x;
  });
  return dazu.length || gehoben ? [...neu, ...dazu] : [...vorhanden];
}

// ── Verantwortlicher im Verzeichnis: EINE Quelle (05.10., Paket „DSGVO-Grundlagen im Code“) ──
// Früher stand im Feld `verantwortlich` ein fester Name (Startbestand) bzw. der Anzeigename der Gesellschaft (UG_NAME) — drei Stellen,
// drei verschiedene Angaben. Jetzt steht dort der Platzhalter VERANTWORTLICH_EINRICHTUNG, aufgelöst aus der Einrichtung
// (lib/datenschutz/einrichtung.ts `verantwortlichAufloesen`). Unveränderte alte Fassungen werden gehoben; was jemand von Hand
// eingetragen hat, bleibt. Die alten festen Namen stehen hier nur als Fingerabdruck (SHA-256, gekürzt) — kein Name im Code.
const ALTE_VERANTWORTLICHE = new Set(['b5537dcde8cd44109c31cbab39db8a16', '460c542df6eebc66dfe3c80f81b8adce']);
const fingerabdruck = (t: string) => createHash('sha256').update(t).digest('hex').slice(0, 32);
/** Ist das eine unveränderte alte Fassung (fester Name aus dem Startbestand oder der Gesellschafts-Anzeigename)? */
export const verantwortlichAlt = (t: string | undefined): boolean => !!t && (t === UG_NAME || ALTE_VERANTWORTLICHE.has(fingerabdruck(t.trim())));

/** Alte feste Verantwortliche → Platzhalter (idempotent; gibt dieselbe Liste zurück, wenn nichts zu heben ist). */
export function verantwortlichHeben(vorhanden: readonly Verarbeitung[]): Verarbeitung[] {
  if (!vorhanden.some(v => verantwortlichAlt(v.verantwortlich))) return [...vorhanden];
  return vorhanden.map(v => (verantwortlichAlt(v.verantwortlich) ? { ...v, verantwortlich: VERANTWORTLICH_EINRICHTUNG } : v));
}

/**
 * Das Verzeichnis vollständig machen — EINE Stelle für alle Nachträge (Stammdaten, System › Datenschutz, Export):
 * Startbestand (wenn leer), Netzwerken, Organisation (Register/Kapazität), Google-Kalender/-Mail (wenn Google eingerichtet),
 * und alte feste Verantwortliche heben. Idempotent: `geaendert` = false, wenn nichts zu tun war.
 */
export function verzeichnisVervollstaendigen(vorhanden: readonly Verarbeitung[], jetzt: string, opt: { google?: boolean } = {}): { liste: Verarbeitung[]; geaendert: boolean } {
  let l: Verarbeitung[] = vorhanden.length ? [...vorhanden] : verarbeitungenStart(jetzt);
  l = verarbeitungenNachtragen(l, jetzt);
  l = verarbeitungenOrganisationNachtragen(l, jetzt);
  if (opt.google) { l = verarbeitungKalenderNachtragen(l, jetzt); l = verarbeitungEmailNachtragen(l, jetzt); }
  l = verarbeitungenPlattformNachtragen(l, jetzt);
  l = alteFassungenHeben(l);
  l = verantwortlichHeben(l);
  const geaendert = l.length !== vorhanden.length || l.some((v, i) => v !== vorhanden[i] && JSON.stringify(v) !== JSON.stringify(vorhanden[i]));
  return { liste: geaendert ? l : [...vorhanden], geaendert };
}

// ── Verzeichnis vervollständigt (05.10., Punkt 5 des Pakets): alle Verarbeitungen der Plattform ──
// Das Verzeichnis kannte bis hierher das CRM, Netzwerken, Register und Kapazität. Es fehlten: Konten, Terminbuchung, Gesundheit (Art. 9),
// Familie, Finanzen, ZOE/KI, Brain/Vault, Telegram, Mac-Zulieferer/M365, Aufgaben + Zeit, Kampagnen/Scoring, Sicherungen/Protokolle, Bauplan.
// Idempotent nach `id` nachgetragen; von Hand Geändertes bleibt. Hinweis, keine Rechtsberatung — anwaltlich gegenlesen (datenschutz/).

export const VV_PLATTFORM_NAMEN: Record<string, string> = {
  'vv-konten': 'Nutzerkonten und Anmeldeprotokoll',
  'vv-buchung': 'Terminbuchung (öffentliche Buchungsseiten)',
  'vv-gesundheit': 'Gesundheit, Sport und Körperwerte (Art. 9)',
  'vv-familie': 'Familie und Partnerschaft',
  'vv-finanzen': 'Finanzen, Haushalt und Rechnungen',
  'vv-zoe': 'ZOE und KI-Auswertung (auch automatische Läufe)',
  'vv-brain': 'Brain (Wissensbasis, Vault auf GitHub)',
  'vv-telegram': 'Hinweise per Telegram',
  'vv-mac-m365': 'Zulieferung vom Rechner und Microsoft 365 (Postfach, Kalender, Kontakte)',
  'vv-aufgaben-zeit': 'Aufgaben, Zeit und Fokus',
  'vv-kampagnen': 'Newsletter, Kampagnen und Scoring (Profiling)',
  'vv-sicherungen': 'Sicherungen, Server- und Sicherheitsprotokolle',
  'vv-bauplan': 'Bauplan (Verbesserungen, Bildschirmfotos)',
};
export const VV_PLATTFORM_IDS = Object.keys(VV_PLATTFORM_NAMEN);

export function verarbeitungenPlattform(jetzt: string): Verarbeitung[] {
  const stand = tagVon(jetzt);
  const v = (id: string, x: Omit<Verarbeitung, 'id' | 'name' | 'toms' | 'verantwortlich' | 'stand'> & { toms?: string }): Verarbeitung => ({ id, name: VV_PLATTFORM_NAMEN[id], ...x, toms: x.toms ? `${TOMS_BASIS}; ${x.toms}` : TOMS_BASIS, verantwortlich: VERANTWORTLICH_EINRICHTUNG, stand });
  const USA = 'USA: Data Privacy Framework bzw. Standardvertragsklauseln — prüfen';
  return [
    v('vv-konten', { zweck: 'Bereitstellung der Anwendung: Anmeldung, Sitzungen, zweiter Faktor, Einladungen, Schutz vor Missbrauch (Anmelde-Bremse, Alarm bei neuem Netz)', personen: 'Nutzerinnen und Nutzer der Instanz (Haushalt, Team, eingeladene Personen)', daten: 'Name, Hauptadresse und bis zu drei weitere Anmelde-Adressen, Passwort-Hash und Salz, zweiter Faktor (Geheimnis, Hashes der Wiederherstellungscodes), Rolle, Haushalt; Anmeldeprotokoll: Zeit, Ergebnis, Art, Netzadresse (höchstens 300 Einträge, rollierend)', rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Nutzung), lit. f bzw. Art. 32 (Sicherheit, Anmeldeprotokoll)', empfaenger: 'nur intern; Hetzner (Hosting); Telegram nur für den Anmelde-Alarm der Person selbst (neutral)', empfaengerIds: ['hetzner', 'telegram'], drittland: 'keines (Telegram ohne Personendaten Dritter)', loeschfrist: 'Konto bis zum Entfernen; Anmeldeprotokoll rollierend (die letzten 300 Einträge); Sitzungen laufen ab bzw. werden beim Abmelden widerrufen' }),
    v('vv-buchung', { zweck: 'Terminanfragen über öffentliche Buchungsseiten annehmen, bestätigen und vorbereiten', personen: 'Gäste, die einen Termin anfragen', daten: 'Name, E-Mail, Firma, Anliegen, gewählter Termin, Nachweis der Kenntnisnahme des Hinweises (Wortlaut, Fassung, Zeitpunkt), Status, Schlüssel-Hash der Status-Seite', rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahme auf Anfrage)', empfaenger: 'Kevin bzw. die Person der Buchungsseite; Hetzner; der Kalender der Person (Apple iCloud bzw. Google) nach Bestätigung', empfaengerIds: ['hetzner', 'apple-icloud', 'google-workspace'], drittland: USA, loeschfrist: 'nicht bestätigte/abgelehnte/abgesagte/abgelaufene Anfragen 30 Tage nach der letzten Änderung, bestätigte 30 Tage nach dem Termin (Frist „buchungen“, einstellbar); danach gilt die Frist der Kartei', toms: 'keine Cookies, nichts von fremden Servern, Honigtopf, Drosselung, Status-Link nur mit Schlüssel' }),
    v('vv-gesundheit', { zweck: 'Eigene Gesundheit verstehen und planen: Körperwerte, Sport, Haut-Tagebuch, Gesundheits-Log, Ernährung', personen: 'die Person selbst (Konto); andere Konten nur, wenn sie „Teilen“ einschaltet', daten: 'Gesundheitsdaten (Art. 9): Erholung, Schlaf, Belastung (WHOOP), Trainings, Haut-Tagebuch, Gesundheits-Log, Ernährungsprofil', rechtsgrundlage: 'Art. 9 Abs. 2 lit. a DSGVO — ausdrückliche Einwilligung durch eigenes Erfassen bzw. Verbinden; Teilen nur auf Schalter; in der Kapazität nur mit gesonderter Einwilligung als Team-Faktor', empfaenger: 'nur die Person (und wem sie teilt); Hetzner; WHOOP als Quelle (eigener Verantwortlicher); Anthropic nur für die eigenen Werte der fragenden Person', empfaengerIds: ['hetzner', 'whoop', 'anthropic'], drittland: USA, loeschfrist: 'bis die Person sie löscht bzw. ihr Konto entfernt wird', toms: 'nie im Business-Index, nie in Prompts für andere, kein Gesundheitskontext im Code' }),
    v('vv-familie', { zweck: 'Familie und Partnerschaft des Haushalts: Rituale, Menschen mit Geburtstag, gemeinsame Planung', personen: 'Personen des Haushalts, Familienmitglieder und Freunde', daten: 'Name, Geburtstag, Beziehung, Notizen, Rituale', rechtsgrundlage: 'überwiegend persönlich-familiär (Art. 2 Abs. 2 lit. c DSGVO); soweit nicht: Art. 6 Abs. 1 lit. f', empfaenger: 'nur der Haushalt; Hetzner; Anthropic nur im eigenen ZOE-Kontext', empfaengerIds: ['hetzner', 'anthropic'], drittland: USA, loeschfrist: 'bis zur Löschung durch den Haushalt; eine verknüpfte CRM-Person verliert bei Art. 17 nur die Verknüpfung' }),
    v('vv-finanzen', { zweck: 'Haushalts- und Geschäftsfinanzen: Konten, Buchungen, Rechnungen, Liquidität, Steuern, Finanzplanung', personen: 'Personen des Haushalts; Kunden und Zahlungspartner auf Rechnungen und Buchungen', daten: 'Buchungen (Betrag, Verwendungszweck, Gegenpartei), Rechnungen (Kunde, Leistung, Betrag), IBAN (im Browser maskiert), Steuerdaten', rechtsgrundlage: 'Art. 6 Abs. 1 lit. b, c DSGVO (Buchführung, § 147 AO, § 257 HGB), lit. f (Planung)', empfaenger: 'Haushalt (Business-Sicht ohne Privates für Team-Konten); Steuerberatung auf Weitergabe; Hetzner; Anthropic für den Finanzchef (gekapselt)', empfaengerIds: ['hetzner', 'anthropic'], drittland: USA, loeschfrist: 'Rechnungen und Buchungsbelege 8 bzw. 10 Jahre ab Jahresende (§ 147 AO, § 257 HGB); sonst bis zur Löschung durch den Haushalt' }),
    v('vv-zoe', { zweck: 'Assistenz durch ZOE: Fragen beantworten, Entwürfe, Vorschläge zur Freigabe, automatische Läufe (Morgen-/Abendlauf, Heads, Markttraktion, Durchsicht) — jede Wirkung nach außen nur nach Freigabe', personen: 'die fragende Person; Personen, die in gekapselten Arbeitsfeldern vorkommen (Kontakte, Absender, Teilnehmende)', daten: 'Gesprächsverlauf, Gedächtnis-Fakten, Protokoll (Kennungen, Feldnamen), Vorschläge; an den KI-Anbieter nur gekapselte Ausschnitte — nie private Notizen, nie eingeschränkte/gesperrte Personen, IBAN maskiert', rechtsgrundlage: 'Art. 6 Abs. 1 lit. b (Nutzung), lit. f DSGVO (Unterstützung der Arbeit, Interessenabwägung); keine Entscheidung mit Rechtswirkung (Art. 22) — Human-in-the-Loop', empfaenger: 'Anthropic (Auftragsverarbeiter); Hetzner', empfaengerIds: ['anthropic', 'hetzner'], drittland: USA, loeschfrist: 'Gespräche 12 Monate, Gedächtnis 24 Monate ohne Erneuerung, Protokoll/entschiedene Vorschläge 90 Tage, Entscheidungen 36 Monate (Löschfristen-Tabelle)', toms: 'Text Dritter läuft durch fremd() und darf nur Vorschläge auslösen; Agenten einzeln abschaltbar; Modell-Drossel je Person' }),
    v('vv-brain', { zweck: 'Wissensbasis des Haushalts (Vault): Notizen, Berichte, Suche und Konsolidierung; Spiegel ausgewählter App-Inhalte', personen: 'Personen, die in Notizen genannt sind (Geschäftskontakte, Partner)', daten: 'Notizen und Berichte (Freitext), Such-Index', rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO (Wissensmanagement des Geschäftsbetriebs)', empfaenger: 'Haushalt; GitHub (privates Repository des Vaults, Abgleich alle 10 Minuten); Hetzner; Anthropic (Suche/Fragen, gekapselt)', empfaengerIds: ['github', 'hetzner', 'anthropic'], drittland: USA, loeschfrist: 'bis zur Löschung im Vault; Git-Historie nur über das dokumentierte Verfahren (DATENARCHITEKTUR.md); Such-Index zieht sofort nach' }),
    v('vv-telegram', { zweck: 'Neutrale Hinweise aufs Telefon (Fristen, Alarm, Tagesbericht des Head of IT)', personen: 'Personen des Haushalts, die Telegram verbunden haben', daten: 'Chat-Kennung, neutrale Hinweistexte ohne Namen Dritter', rechtsgrundlage: 'Art. 6 Abs. 1 lit. a DSGVO (die Person verbindet selbst) bzw. lit. f', empfaenger: 'Telegram (eigener Verantwortlicher, kein AVV möglich)', empfaengerIds: ['telegram'], drittland: 'außerhalb der EU, ohne Garantie — deshalb nie Daten Dritter', loeschfrist: 'Verknüpfung bis zum Trennen; Nachrichten im Telegram-Konto der Person' }),
    v('vv-mac-m365', { zweck: 'Postfach, Kalender, Erinnerungen und Adressbuch des Inhabers in MAKE OS anzeigen und zuordnen (Zulieferung vom Rechner bzw. Microsoft Graph)', personen: 'Absender und Empfänger von Mails, Teilnehmende von Terminen, Kontakte des Adressbuchs', daten: 'Mail-Köpfe und Vorschau, Termine samt Teilnehmern, Erinnerungen, Adressbuch-Einträge (Zwischenspeicher)', rechtsgrundlage: 'Art. 6 Abs. 1 lit. b, f DSGVO (Geschäftsbetrieb)', empfaenger: 'nur der Inhaber; Microsoft (Auftragsverarbeiter); Apple iCloud; Hetzner', empfaengerIds: ['microsoft-365', 'apple-icloud', 'hetzner'], drittland: USA, loeschfrist: 'Postfach-Zwischenspeicher 30 Tage, Kalender-Zwischenspeicher 12 Monate; Wahrheit beim Anbieter (Löschung dort)' }),
    v('vv-aufgaben-zeit', { zweck: 'Aufgaben, Projekte, Meilensteine und Ziele führen; Zeit und Fokus messen und planen', personen: 'Personen des Haushalts/Teams; in Aufgaben genannte Kontakte', daten: 'Aufgaben (Titel, Beschreibung, Fälligkeit, Zuständigkeit, Verweise), Dateien zu Aufgaben, Fokus-Blöcke und gemessene Zeiten je Person', rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO / § 26 BDSG (Arbeitsorganisation), lit. f', empfaenger: 'Haushalt/Team; Hetzner; Anthropic (ZOE-Vorschläge, gekapselt)', empfaengerIds: ['hetzner', 'anthropic'], drittland: USA, loeschfrist: 'Papierkorb 30 Tage; sonst bis zur Löschung; Art. 17 einer Person tilgt Namen und Verweise in Aufgaben' }),
    v('vv-kampagnen', { zweck: 'Kampagnen und Newsletter an Personen mit Einwilligung; Lead-Score und Qualifizierung zur Priorisierung der Ansprache', personen: 'Interessenten, Kontakte mit Einwilligung', daten: 'Einwilligungs-Nachweis (Double-Opt-in), Kampagnen-Schritte, Öffnungen/Klicks (beim Versanddienst), Scoring-Antworten und Stufe (MQL/SQL)', rechtsgrundlage: 'Werbung: Art. 6 Abs. 1 lit. a DSGVO, § 7 UWG; Scoring: Art. 6 Abs. 1 lit. f — Profiling ohne automatisierte Entscheidung (Art. 22), Widerspruch nach Art. 21 jederzeit', empfaenger: 'Haushalt; Newsletter-Werkzeug (sobald in Gebrauch); Hetzner; Anthropic (Entwürfe, gekapselt)', empfaengerIds: ['newsletter', 'hetzner', 'anthropic'], drittland: 'je nach Versanddienst — EU bevorzugt', loeschfrist: 'Einwilligungs-Nachweis mit dem Kontakt, auch nach Widerruf als Nachweis (Art. 7 Abs. 1); Scoring mit dem Kontakt (Frist der Kartei); Werbesperre bleibt' }),
    v('vv-sicherungen', { zweck: 'Wiederherstellbarkeit (Art. 32 Abs. 1 lit. c) und Sicherheit: nächtliche Sicherung, Tageskopien je Bestand, Server-/Sicherheitsprotokolle, Head of IT, Außenprüfung', personen: 'alle Personen, deren Daten in der Instanz liegen; Zugreifende (Netzadressen)', daten: 'verschlüsselte Abbilder aller Bestände; Protokolle: Zeit, Netzadresse, Anfrage, Fehler (keine Inhalte), CSP-Meldungen, Lage-Zahlen', rechtsgrundlage: 'Art. 6 Abs. 1 lit. c, f DSGVO i. V. m. Art. 32', empfaenger: 'Hetzner (Server, Abbilder 7 Tage); Healthchecks (nur Ping); GitHub (Außenprüfung: nur Erreichbarkeit)', empfaengerIds: ['hetzner', 'healthchecks', 'github'], drittland: 'keines für die Sicherungen (Hetzner, Deutschland); GitHub: USA — prüfen', loeschfrist: SICHERUNG_SATZ, toms: 'age-Verschlüsselung der Sicherung (privater Schlüssel nicht auf dem Server), Grabsteine außerhalb des Datenordners, Probe-Wiederherstellung' }),
    v('vv-bauplan', { zweck: 'Verbesserung der Software: Ideen, Fehler, Abnahmen, Bildschirmfotos von Hand angehängt', personen: 'Personen des Haushalts; Personen, die auf einem Bildschirmfoto zu sehen sind (z. B. Kontakte in einer Liste)', daten: 'Karten (Titel, Beschreibung, Kommentare, wer), Bildschirmfotos (können Personendaten zeigen)', rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO (Weiterentwicklung und Fehlerbehebung)', empfaenger: 'Haushalt; Hetzner; Anthropic nur für Kartentexte (ZOE), nie die Bilder', empfaengerIds: ['hetzner', 'anthropic'], drittland: USA, loeschfrist: 'Bildschirmfotos fertiger oder verworfener Karten 90 Tage nach Abschluss, nicht zugeordnete nach 7 Tagen (Frist „bauplan-bilder“); Karten bis zur Löschung', toms: 'Bildschirmfotos verschlüsselt abgelegt (wie die Dateiablage), nur angemeldet abrufbar; vor dem Anhängen Personendaten möglichst schwärzen' }),
  ];
}

/** Fehlende Plattform-Verarbeitungen ergänzen (idempotent nach `id`; vorhandene — auch geänderte — bleiben). */
export function verarbeitungenPlattformNachtragen(vorhanden: readonly Verarbeitung[], jetzt: string): Verarbeitung[] {
  const da = new Set(vorhanden.map(v => v.id));
  const dazu = verarbeitungenPlattform(jetzt).filter(v => !da.has(v.id));
  return dazu.length ? [...vorhanden, ...dazu] : [...vorhanden];
}

/**
 * Unveränderte alte Fassungen heben (05.10.): Schutzmaßnahmen des Startbestands, alle Einträge aus `ALTE_FASSUNGEN`, und das neue
 * Feld `empfaengerIds` dort, wo es noch fehlt (der Startwert je bekannter Verarbeitung). Von Hand Geändertes bleibt.
 */
export function alteFassungenHeben(vorhanden: readonly Verarbeitung[]): Verarbeitung[] {
  let gehoben = false;
  const neu = vorhanden.map(v => {
    let x = v;
    if (x.toms === TOMS_START_ALT) { x = { ...x, toms: TOMS_BASIS }; gehoben = true; }
    const f = ALTE_FASSUNGEN[x.id];
    if (f) for (const [k, w] of Object.entries(f) as [keyof Verarbeitung, { alt: string | string[]; neu: string }][]) {
      if ((Array.isArray(w.alt) ? w.alt : [w.alt]).includes(String(x[k]))) { x = { ...x, [k]: w.neu }; gehoben = true; }
    }
    if (!x.empfaengerIds && START_EMPFAENGER[x.id]) { x = { ...x, empfaengerIds: START_EMPFAENGER[x.id] }; gehoben = true; }
    return x;
  });
  return gehoben ? neu : [...vorhanden];
}
