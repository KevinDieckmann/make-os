// ─── Prozesse · Kundengewinnung — die Felder des Falls für die Rauten der 18 Vorlagen (22.10.; research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md) ───────────
// Eine Raute nach Regel nennt nur Felder des Falls (lib/prozesse/ausloeser.ts `FALL_FELDER`), des Webhook-Auslösers und der Agenten-Ausgaben. Die Vorlagen der
// Kundengewinnung brauchen dazu diese Felder — ein klar abgegrenzter Block, den `FALL_FELDER` je Fall-Art anhängt (nur ADDITIV, nie umbenannt).
// Jedes Feld nennt in `liest`, aus welchem VORHANDENEN Leser der Motor (Etappe C) den Wert holt — nie eine eigene Rechnung, nie Freitext Dritter, nur Kennungen,
// Zahlen, ja/nein und feste Wörter (Ampel-Farben, Kanäle, Stufen). Personen nur über `kontakteFuerVerarbeitung` (Art. 18). Rein und client-sicher (nur Typen).

import type { FeldDef } from '../ausloeser';
import type { FallArt } from '../definition';

/** Ein Feld mit seiner Quelle (für den Motor und die Werkstatt — „woher kommt der Wert?“). */
export type KgFeld = FeldDef & { liest: string };

const f = (id: string, titel: string, art: FeldDef['art'], liest: string): KgFeld => ({ id, titel, art, liest });

/** Die Felder je Fall-Art (Block Kundengewinnung). */
export const KG_FALL_FELDER: Readonly<Record<FallArt, readonly KgFeld[]>> = {
  lead: [
    f('lead.grund-art', 'Warum geparkt', 'text', 'Lead.grundArt (lib/crm/lead-grund.ts GRUND_PARKEN)'),
    f('lead.anfrage-kanal', 'Kanal der Anfrage', 'text', 'Kanal der Anfrage-Aktivität (lib/crm/anfragen.ts ANFRAGE_KANAELE)'),
    f('lead.bester-kanal', 'Bester Kanal', 'text', 'besterKanal (lib/crm/recht.ts) — mail · telefon · linkedin · keiner'),
    f('lead.ampel-mail', 'Mail-Ampel', 'text', 'kanalStatus(…, mail) (lib/crm/recht.ts) — gruen · gelb · rot'),
    f('lead.ampel-telefon', 'Telefon-Ampel', 'text', 'kanalStatus(…, telefon) (lib/crm/recht.ts) — gruen · gelb · rot'),
    f('lead.netzwerken-schritt', 'Vereinbarter Schritt (Netzwerken)', 'text', 'Teilnahme.netzwerken.schritt (lib/crm/netzwerken.ts SCHRITTE)'),
    f('lead.danke-moeglich', 'Danke möglich', 'ja-nein', 'dankeOffen (lib/crm/netzwerken.ts): gesprochen, Mail-Ampel nicht rot, Frist nicht abgelaufen'),
    f('lead.nachweis-vollstaendig', 'Newsletter-Nachweis vollständig', 'ja-nein', 'nachweisLuecken leer (lib/crm/einwilligung.ts)'),
    f('lead.neue-signale', 'Neue Signale seit dem Start', 'ja-nein', 'eingehende Aktivität, Zusage, Kampagnen-Reaktion, neuer Deal bzw. höhere Temperatur (lib/crm/score.ts) seit dem Start bzw. dem Parken + ereignisseSeit (lib/ereignisse/server.ts)'),
    f('lead.gespraech-zugeordnet', 'Gespräch zugeordnet', 'ja-nein', 'Inbox-Zustand der Person (lib/inbox/zustand.ts zuordnung)'),
    f('lead.mail-fach', 'Fach der Mail', 'text', 'fachVon (lib/inbox/faecher.ts) über den Spiegel der Person (lib/inbox/strom-server.ts) — antworten · termine · info · warten …'),
    f('lead.waerme-gestiegen', 'Wärme gestiegen', 'ja-nein', 'Temperatur vor/nach der Nachricht (lib/crm/score.ts leadScore)'),
    f('lead.einladungsweg', 'Einladungsweg', 'text', 'Teilnahme.einladungsweg, sonst einladungswegAus (lib/crm/eventplanung.ts) nach der Ampel „Einladung“ — mail · persoenlich'),
    f('lead.buchung-folge', 'Folge der Buchung', 'text', 'folgeVorschlag (lib/kalender/buchung-ablauf.ts) — deal · qualifizierung · keine'),
    f('lead.kampagnen-ergebnis', 'Ergebnis in der Kampagne', 'text', 'Kampagne.ergebnisse (lib/crm/typen.ts KampagnenErgebnis) — „offen“, solange es keins gibt'),
  ],
  deal: [
    f('deal.ampel', 'Ampel des Deals', 'text', 'gesundheit (lib/crm/pipeline.ts) — gruen · gelb · rot'),
    f('deal.verschoben', 'Entscheidung verschoben (mal)', 'zahl', 'Chance.erwartetVerschoben (lib/crm/pipeline.ts erwartetVerschiebung)'),
    f('deal.grund', 'Grund (verloren/geparkt)', 'text', 'Chance.grund (lib/crm/pipeline.ts verlustgruende)'),
    f('deal.mandat-da', 'Mandat schon da', 'ja-nein', 'Mandat mit chanceId = Deal (CRM-Bestand)'),
    f('deal.vertrag-unterschrieben', 'Vertrag unterschrieben', 'ja-nein', 'Mandat.vertragUnterschrieben des Mandats zum Deal'),
    f('deal.ampel-mail', 'Mail-Ampel (Hauptkontakt)', 'text', 'kanalStatus(…, mail) des Hauptkontakts (lib/crm/recht.ts)'),
    f('deal.nachfass-followup', 'Nachfass-Follow-up offen', 'ja-nein', 'Follow-up fu-<angebot> offen (lib/crm/angebot-server.ts)'),
    f('deal.offen', 'Deal offen', 'ja-nein', 'OFFENE_STUFEN (lib/crm/pipeline.ts)'),
  ],
  mandat: [
    f('mandat.ampel', 'Ampel des Mandats', 'text', 'mandatLage (lib/crm/kunden.ts) — gruen · gelb · rot'),
    f('mandat.health', 'Health (0–100)', 'zahl', 'mandatLage (lib/crm/kunden.ts)'),
    f('mandat.verlaengerung', 'Verlängerung', 'text', 'Mandat.verlaengerung (lib/crm/typen.ts) — auto · manuell · offen'),
    f('mandat.verlaengert', 'Verlängerung gesichert', 'ja-nein', 'Angebot am Mandat angenommen (ab 180 Tagen vor dem Ende) bzw. „auto“ ohne festes Ende (lib/crm/angebote.ts, lib/crm/kunden.ts)'),
    f('mandat.tage-seit-empfehlung', 'Tage seit der letzten Empfehlungsfrage', 'zahl', 'markeNachsorge (lib/fulfillment/prozesse/wirkung.ts) bzw. Läufe dieses Prozesses — leer: noch nie gefragt'),
    f('mandat.ampel-mail', 'Mail-Ampel (Ansprechpartner)', 'text', 'kanalStatus(…, mail) (lib/crm/recht.ts)'),
  ],
  event: [
    f('event.quote-48h', 'Anteil rechtzeitig nachgefasst (%)', 'zahl', 'besuchWirkung (lib/crm/besuche.ts) bzw. nachfassen_48h (lib/crm/traktion.ts) — leer, solange niemand fällig ist'),
    f('event.mix-erreicht', 'Mischung der Gäste erreicht', 'ja-nein', 'mix gegen das Ziel (lib/crm/eventplanung.ts)'),
    f('event.status', 'Status des Events', 'text', 'Event.status (lib/crm/typen.ts)'),
  ],
  firma: [
    f('firma.daten-fehlen', 'Stammdaten fehlen', 'ja-nein', 'vollstaendigkeit (lib/crm/akte.ts) und Firmenfelder Branche, Mitarbeitende, Webseite'),
    f('firma.bester-kanal', 'Bester Kanal (Ansprechpartner)', 'text', 'besterKanal (lib/crm/recht.ts) — mail · telefon · linkedin · keiner'),
  ],
  // Kampagne (Fall-Art seit C1, M3): die Felder der Kampagne selbst stehen dort; die Vorlage V06 braucht keine weiteren.
  kampagne: [],
  keiner: [
    f('abfrage.anzahl', 'Treffer der CRM-Abfrage', 'zahl', 'Ergebnis der letzten CRM-Abfrage im Lauf (lib/prozesse/kundengewinnung/abfrage.ts)'),
  ],
};
