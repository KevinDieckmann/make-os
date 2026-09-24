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

export interface Befund { prio: 1 | 2 | 3 | 4 | 5; titel: string; grund: string; bereich: 'heute' | 'kontakte' | 'firmen' | 'pipeline' | 'kunden' | 'marketing' | 'events' | 'stammdaten'; ansicht?: string }

export function befunde(kontakte: Kontakt[], crm: CrmBestand, heute: string): Befund[] {
  const b: Befund[] = [];
  const bald = (d: string, n: number) => { const x = new Date(`${heute}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return d <= x.toISOString().slice(0, 10); };
  const antraege = crm.antraege.filter(a => a.status === 'offen' && bald(a.frist, 7));
  if (antraege.length) b.push({ prio: 1, titel: `${antraege.length} Betroffenenantrag${antraege.length > 1 ? 'e' : ''} mit knapper Frist`, grund: 'Monatsfrist nach Art. 12 DSGVO', bereich: 'stammdaten', ansicht: 'datenschutz' });
  const offen = crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe));
  const haengt = offen.filter(c => gesundheit(c, heute).ampel === 'rot');
  if (haengt.length) b.push({ prio: 1, titel: `${haengt.length} Chance${haengt.length > 1 ? 'n hängen' : ' hängt'}`, grund: 'Schritt überfällig oder über 30 Tage ohne Bewegung', bereich: 'pipeline' });
  const ablauf = crm.mandate.filter(m => m.status === 'aktiv' && (mandatLage(m, heute).endeIn ?? 999) <= 60);
  if (ablauf.length) b.push({ prio: 1, titel: `${ablauf.length} Mandat${ablauf.length > 1 ? 'e' : ''}: Laufzeit endet oder ist vorbei`, grund: ablauf.map(m => m.kunde).join(', '), bereich: 'kunden' });
  const art = kontakte.filter(k => art14(k, heute)?.faellig);
  if (art.length) b.push({ prio: 2, titel: `${art.length} Personen nach Art. 14 informieren`, grund: 'Daten aus Recherche, Frist ein Monat', bereich: 'marketing' });
  const mitChance = new Set(crm.chancen.flatMap(c => c.kontaktIds));
  const ohneChance = kontakte.filter(k => ['gespraech', 'termin', 'angebot'].includes(k.stufe) && !mitChance.has(k.id) && !k.werbesperre);
  if (ohneChance.length) b.push({ prio: 2, titel: `${ohneChance.length} Kontakte im Gespräch ohne Chance`, grund: 'Wert und nächsten Schritt festhalten, sonst fehlen sie in der Prognose', bereich: 'pipeline' });
  const ohneSchritt = offen.filter(c => !c.naechsterSchritt);
  if (ohneSchritt.length) b.push({ prio: 2, titel: `${ohneSchritt.length} Chancen ohne nächsten Schritt`, grund: 'Ohne Datum verliert sich jede Chance', bereich: 'pipeline' });
  const widersprueche = crm.mandate.filter(m => m.status !== 'beendet' && m.offen.length);
  if (widersprueche.length) b.push({ prio: 3, titel: `${widersprueche.length} Mandate mit offenen Punkten`, grund: `${widersprueche.reduce((a, m) => a + m.offen.length, 0)} Widersprüche und Klärungen`, bereich: 'kunden' });
  const ohneAngaben = kontakte.filter(k => !k.herkunft || !k.rechtsgrundlage).length;
  if (ohneAngaben) b.push({ prio: 3, titel: `${ohneAngaben} Kontakte ohne Herkunft oder Rechtsgrundlage`, grund: 'Vorschlag per Regel, Übernahme per Klick', bereich: 'stammdaten', ansicht: 'datenschutz' });
  const d = dubletten(kontakte).length;
  if (d) b.push({ prio: 4, titel: `${d} Dubletten zusammenführen`, grund: 'gleicher Name, gleiche Firma oder Kontaktdaten', bereich: 'stammdaten', ansicht: 'qualitaet' });
  // Events: überfällige Checklistenpunkte (vor dem Termin) — nach dem Event zählt das Nachfassen in der Power Hour.
  const evUeber = crm.events.filter(e => e.status !== 'abgesagt' && e.datum >= heute).map(e => ({ e, n: checklisteFaellig(e, heute).filter(pk => pk.ueberfaellig).length })).filter(x => x.n);
  if (evUeber.length) b.push({ prio: 2, titel: `${evUeber.reduce((a, x) => a + x.n, 0)} Punkte der Event-Checkliste überfällig`, grund: evUeber.map(x => x.e.titel).join(', '), bereich: 'events' });
  // Marketing: Rhythmus und Nachhalten (Beiträge, Newsletter-Zahlen).
  const vor7 = (() => { const x = new Date(`${heute}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - 6); return x.toISOString().slice(0, 10); })();
  if (crm.beitraege.length && !crm.beitraege.some(b => b.status === 'veroeffentlicht' && b.datum && b.datum >= vor7 && b.datum <= heute)) b.push({ prio: 4, titel: 'Diese Woche noch nichts veröffentlicht', grund: 'Zwei Beiträge je Woche halten die Zielgruppe warm — Ideen liegen im Redaktionsplan', bereich: 'marketing' });
  const ohneZahlen = crm.newsletter.filter(a => a.status === 'versendet' && a.empfaenger === undefined).length;
  if (ohneZahlen) b.push({ prio: 5, titel: `${ohneZahlen} versendete Newsletter ohne Zahlen`, grund: 'Empfänger, Antworten, Abmeldungen nachtragen', bereich: 'marketing' });
  const letzte = crm.sitzungen.map(s => s.datum).sort().pop();
  if (!letzte || !bald(letzte, 7) || letzte < (() => { const x = new Date(`${heute}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - 6); return x.toISOString().slice(0, 10); })()) b.push({ prio: 4, titel: letzte ? 'Diese Woche noch keine Power Hour' : 'Erste Power Hour', grund: 'Vier Stunden pro Woche halten die Pipeline in Bewegung', bereich: 'heute' });
  return b.sort((x, y) => x.prio - y.prio);
}
