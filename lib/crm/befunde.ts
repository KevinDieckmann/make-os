// ─── CRM — „Was jetzt zu tun ist“ (rein, getestet) ─────────────────────────
// Wie die roten Befunde in KEMARIS Operations: aus dem Bestand gerechnet,
// nach Priorität, jeder mit Ziel-Bereich. Kein Modell.

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from './typen';
import { OFFENE_STUFEN, gesundheit } from './pipeline';
import { mandatLage } from './kunden';
import { art14 } from './recht';
import { dubletten } from './dubletten';
import { checklisteFaellig } from './eventplanung';
import { faellige } from './followup';
import { verbindungenPruefen } from './verbindungen';
import { kontakteUeberFrist } from './loeschfristen';
import { nichtGeprueft, PRUEFEN_MONATE } from './geprueft';
import { nachweisOffen } from './einwilligung';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import { labelsVon } from './mehrfach';
import { LABEL_DUBLETTE, LABEL_LEAD_PRUEFEN } from './netzwerken';
import { WEG } from '@/lib/wege';

export interface Befund { prio: 1 | 2 | 3 | 4 | 5; titel: string; grund: string; bereich: 'heute' | 'followup' | 'kontakte' | 'firmen' | 'pipeline' | 'kunden' | 'marketing' | 'events' | 'stammdaten'; ansicht?: string;
  /** Ziel außerhalb der Markttraktion (6.7, 08.10.: Mandate liegen unter /os/mandate) — gewinnt vor `bereich`. */
  href?: string }

export function befunde(kontakte: Kontakt[], crm: CrmBestand, heute: string, opts: { loeschMonate?: number } = {}): Befund[] {
  const b: Befund[] = [];
  const bald = (d: string, n: number) => { const x = new Date(`${heute}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return d <= x.toISOString().slice(0, 10); };
  const antraege = crm.antraege.filter(a => a.status === 'offen' && bald(a.frist, 7));
  if (antraege.length) b.push({ prio: 1, titel: `${antraege.length} Betroffenenantrag${antraege.length > 1 ? 'e' : ''} mit knapper Frist`, grund: 'Monatsfrist nach Art. 12 DSGVO', bereich: 'stammdaten', ansicht: 'datenschutz' });
  const offen = crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe));
  const haengt = offen.filter(c => gesundheit(c, heute).ampel === 'rot');
  if (haengt.length) b.push({ prio: 1, titel: `${haengt.length} Deal${haengt.length > 1 ? 's hängen' : ' hängt'}`, grund: 'Schritt überfällig oder über 30 Tage ohne Bewegung', bereich: 'pipeline' });
  // Follow-up-Ebene (27.09.): Überfälliges aus EINER Liste — Zusagen, Wiedervorlagen, Nachfassen, Reviews, Kadenz (Deal-Schritte zählen oben bei den Deals).
  const ueber = faellige(kontakte, crm, heute, { wertelisten: crm.wertelisten }).filter(f => f.gruppe === 'ueberfaellig' && f.quelle !== 'dealschritt');
  if (ueber.length) b.push({ prio: 1, titel: `${ueber.length} Follow-up${ueber.length > 1 ? 's' : ''} überfällig`, grund: `${ueber.filter(f => f.tageUeber >= 7).length} davon über eine Woche — Follow-up › Fällig`, bereich: 'followup', ansicht: 'faellig' });
  const ablauf = crm.mandate.filter(m => m.status === 'aktiv' && (mandatLage(m, heute).endeIn ?? 999) <= 60);
  if (ablauf.length) b.push({ prio: 1, titel: `${ablauf.length} Mandat${ablauf.length > 1 ? 'e' : ''}: Laufzeit endet oder ist vorbei`, grund: ablauf.map(m => m.kunde).join(', '), bereich: 'kunden', href: ablauf.length === 1 ? WEG.mandat(ablauf[0].id) : WEG.mandat() });
  const art = kontakte.filter(k => art14(k, heute)?.faellig);
  if (art.length) b.push({ prio: 2, titel: `${art.length} Personen nach Art. 14 informieren`, grund: 'Daten aus Recherche, Frist ein Monat', bereich: 'kontakte', ansicht: 'art14' });
  // Nur offene Chancen zählen — Ebene 1 (Leads) endet erst mit einem Deal.
  const mitChance = new Set(crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe)).flatMap(c => c.kontaktIds));
  const ohneChance = kontakte.filter(k => ['gespraech', 'termin', 'angebot'].includes(k.stufe) && !mitChance.has(k.id) && !ausgenommen(k));
  if (ohneChance.length) b.push({ prio: 2, titel: `${ohneChance.length} Kontakte im Gespräch ohne Deal`, grund: 'Qualifizierungs-Runde: sechs Kernfragen je Lead — SQL-bereite werden Deals', bereich: 'kontakte', ansicht: 'runde-chancen' });
  // Ohne Kreis kein Pflege-Takt in der Power Hour — die Kreis-Runde sortiert Karte für Karte.
  const ohneKreis = kontakte.filter(k => !k.kreis && !ausgenommen(k) && (k.lebensphase === 'kunde' || k.prio === 'A' || k.prio === 'B' || ['gespraech', 'termin', 'angebot', 'gewonnen'].includes(k.stufe)));
  if (ohneKreis.length) b.push({ prio: 3, titel: `${ohneKreis.length} wichtige Kontakte ohne Kreis`, grund: 'Kreis-Runde: A/B/C/D und wer die Beziehung hält — dann greift der Pflege-Takt', bereich: 'kontakte', ansicht: 'runde-kreis' });
  const ohneSchritt = offen.filter(c => !c.naechsterSchritt);
  if (ohneSchritt.length) b.push({ prio: 2, titel: `${ohneSchritt.length} Deals ohne nächsten Schritt`, grund: 'Ohne Datum verliert sich jeder Deal', bereich: 'pipeline' });
  const widersprueche = crm.mandate.filter(m => m.status !== 'beendet' && m.offen.length);
  if (widersprueche.length) b.push({ prio: 3, titel: `${widersprueche.length} Mandate mit offenen Punkten`, grund: `${widersprueche.reduce((a, m) => a + m.offen.length, 0)} Widersprüche und Klärungen`, bereich: 'kunden' });
  const ohneAngaben = kontakte.filter(k => !k.herkunft || !k.rechtsgrundlage).length;
  if (ohneAngaben) b.push({ prio: 3, titel: `${ohneAngaben} Kontakte ohne Herkunft oder Rechtsgrundlage`, grund: 'Vorschlag per Regel, Übernahme per Klick', bereich: 'stammdaten', ansicht: 'datenschutz' });
  // Datenschutz (U2, 28.09.): Löschfrist (nie automatisch löschen) und „zuletzt geprüft“ (Richtigkeit).
  const ueberFrist = kontakteUeberFrist(kontakte, crm, heute, opts.loeschMonate ?? 24).length;
  if (ueberFrist) b.push({ prio: 3, titel: `${ueberFrist} Kontakte über der Löschfrist`, grund: 'prüfen: löschen oder Frist mit Grund verlängern — gelöscht wird nie automatisch', bereich: 'stammdaten', ansicht: 'datenschutz' });
  const ungeprueft = nichtGeprueft(kontakte, crm, heute).length;
  if (ungeprueft) b.push({ prio: 4, titel: `${ungeprueft} Kontakte seit über ${PRUEFEN_MONATE} Monaten nicht geprüft`, grund: 'aktive Beziehungen und Leads — in der Kontaktseite „Stammdaten geprüft“', bereich: 'stammdaten', ansicht: 'qualitaet' });
  const nw = nachweisOffen(kontakte).liste.length;
  if (nw) b.push({ prio: 4, titel: `${nw} Kontakte mit Einwilligung ohne vollständigen Nachweis`, grund: 'Wortlaut, Beleg, Zeitpunkt oder wer fehlt — Mail/Newsletter bleiben gelb, bis ergänzt', bereich: 'stammdaten', ansicht: 'qualitaet' });
  const d = dubletten(kontakte).length;
  if (d) b.push({ prio: 4, titel: `${d} Dubletten zusammenführen`, grund: 'gleicher Name, gleiche Firma oder Kontaktdaten', bereich: 'stammdaten', ansicht: 'qualitaet' });
  // Arbeitslisten aus „Netzwerken“ (N3): die Erfassung setzt „Dublette prüfen“ (vermutlich schon in der Kartei) und „Lead prüfen“ (Lead nicht angefasst) — ohne diese
  // Befunde blieben die Labels unsichtbare Marken. Die Kartei hat dazu je eine eigene Ansicht.
  const dubL = kontakte.filter(k => !ausgenommen(k) && labelsVon(k).includes(LABEL_DUBLETTE)).length;
  if (dubL) b.push({ prio: 3, titel: `${dubL} Person${dubL > 1 ? 'en' : ''} aus Netzwerken: Dublette prüfen`, grund: 'vermutlich schon in der Kartei — zusammenführen oder das Label entfernen', bereich: 'kontakte', ansicht: 'dublette-pruefen' });
  const leadL = kontakte.filter(k => !ausgenommen(k) && labelsVon(k).includes(LABEL_LEAD_PRUEFEN)).length;
  if (leadL) b.push({ prio: 4, titel: `${leadL} Person${leadL > 1 ? 'en' : ''} aus Netzwerken: Lead prüfen`, grund: 'Firma ohne Vertrieb oder Lead schon weiter — kein neuer Lead gesetzt', bereich: 'kontakte', ansicht: 'lead-pruefen' });
  // Events: überfällige Checklistenpunkte (vor dem Termin) — nach dem Event zählt das Nachfassen in der Power Hour.
  const evUeber = crm.events.filter(e => e.status !== 'abgesagt' && e.datum >= heute).map(e => ({ e, n: checklisteFaellig(e, heute).filter(pk => pk.ueberfaellig).length })).filter(x => x.n);
  if (evUeber.length) b.push({ prio: 2, titel: `${evUeber.reduce((a, x) => a + x.n, 0)} Punkte der Event-Checkliste überfällig`, grund: evUeber.map(x => x.e.titel).join(', '), bereich: 'events' });
  // Marketing: Rhythmus und Nachhalten (Beiträge, Newsletter-Zahlen).
  const vor7 = (() => { const x = new Date(`${heute}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - 6); return x.toISOString().slice(0, 10); })();
  if (crm.beitraege.length && !crm.beitraege.some(b => b.status === 'veroeffentlicht' && b.datum && b.datum >= vor7 && b.datum <= heute)) b.push({ prio: 4, titel: 'Diese Woche noch nichts veröffentlicht', grund: 'Zwei Beiträge je Woche halten die Zielgruppe warm — Ideen liegen im Redaktionsplan', bereich: 'marketing' });
  const ohneZahlen = crm.newsletter.filter(a => a.status === 'versendet' && a.empfaenger === undefined).length;
  if (ohneZahlen) b.push({ prio: 5, titel: `${ohneZahlen} versendete Newsletter ohne Zahlen`, grund: 'Empfänger, Antworten, Abmeldungen nachtragen', bereich: 'marketing' });
  const letzte = crm.sitzungen.map(s => s.datum).sort().pop();
  if (!letzte || letzte < vor7) b.push({ prio: 4, titel: letzte ? 'Diese Woche noch keine Power Hour' : 'Erste Power Hour', grund: 'Vier Stunden pro Woche halten die Pipeline in Bewegung', bereich: 'heute' });
  // Verbindungsprüfung (28.09.): Fehler in den Verknüpfungen (tote Verweise, doppelte Kennungen, Werbesperre in
  // laufender Kampagne) sollen im Überblick auffallen — hier nur, was Personen und CRM-Bestand allein zeigen;
  // die volle Prüfung (Rechnungen, Aufgaben, Ablage) steht unter Stammdaten › Datenqualität.
  const vf = verbindungenPruefen({ heute, kontakte, crm }).filter(x => x.schwere === 'fehler');
  if (vf.length) {
    const n = vf.reduce((a, x) => a + x.anzahl, 0);
    b.push({ prio: 1, titel: `${n} Verbindungsfehler im Bestand`, grund: vf.slice(0, 2).map(x => x.text).join(' · '), bereich: 'stammdaten', ansicht: 'qualitaet' });
  }
  return b.sort((x, y) => x.prio - y.prio);
}
