// ─── Ereignisse — die Arten an EINER Stelle (09.10., E1 „Ereignisstelle“; rein, Server UND Browser) ─────────────────────────
// Kevin 09.10.: „Ja, vor Update 2“ (ANALYSE_AGENTEN_DATEN.md › E1). Die Art eines Ereignisses IST der Skill-Auslöser `SkillEreignis`
// (lib/agenten/typen.ts) — keine zweite Liste. Hier steht, welche Arten eine Quelle speist (`EREIGNISSE_ANGEBUNDEN`), welche nur intern
// etwas anstoßen (`EREIGNISSE_INTERN`) und wie sie heißen. Der Skill-Editor zeigt „noch nicht angebunden“ nur für die übrigen.
//
//   neue-mail         Gmail-Abgleich (lib/gmail/abgleich.ts) und IMAP-Postfächer (lib/postfach/abgleich.ts): neue EINGEHENDE Nachricht
//   neue-whatsapp     WhatsApp-Webhook (lib/whatsapp/webhook.ts): neue eingehende Nachricht der Business-Nummer
//   zahlungseingang   Kontoauszug übernommen (lib/finanzen/kontoauszug/server.ts, nur Eingänge der letzten 14 Tage) und Rechnung „bezahlt“
//   deal-stufe        CRM-Schreibweg (lib/crm/speicher.ts `crmSchreiben`): Deal neu bzw. in eine andere Stufe
//   lead-sql          Firma (CRM) bzw. Person (Kartei) wird SQL
//   neuer-lead        neue Anfrage (/api/crm/anfrage)
//   termin-abgesagt   iCloud-Abgleich: ein Termin mit CRM-Bezug wurde vom Gegenüber abgesagt (lib/kalender/icloud.ts)
//   aufgabe-zoe       „An ZOE geben“ (lib/zoe/aufgaben-werkzeuge.ts) — stößt den ZOE-Aufgaben-Lauf sofort an (intern, kein Skill-Auslöser)
//   webhook           Prozesse (21.10., B1): ein scharfer Webhook eines Prozesses hat einen Eingang angenommen (lib/prozesse/webhook-server.ts) —
//                     intern (kein Skill-Auslöser), nur Kennungen (Prozess, Eingang); gestartet wird erst vom Prozess-Motor (Etappe C)
// Prozesse C1 (21.10., „Laufen intern“) — aus VORHANDENEN Schreibwegen, nie aus einer neuen Abfrage (lib/ereignisse/quellen.ts):
//   termin-vorbei          CRM-Signal-Lauf (lib/crm/signale-server.ts): Termin mit Bezug, Ende ≤ jetzt (nie abgesagte, nie ganztägige)
//   mandat-angelegt/-beendet  CRM-Schreibweg (`crmDiff` über `mandate`)
//   rechnung-gestellt      Rechnungswesen „Rechnung stellen“ (lib/finanzen/rechnung/server.ts)
//   fall-schritt-erledigt  Fulfillment-Fall: ein Schritt wird erledigt (lib/fulfillment/prozesse/fall-server.ts — nur gemeldet, die Ausführung bleibt)
//   ziel-erreicht          Fulfillment-Fall: eine neue Messung bringt ein Ziel des Wert-Kontos auf 100 %
//   antwort-gesendet       eigene Mail (Inbox) bzw. WhatsApp an einen Kontakt gesendet — person = wer gesendet hat
//   followup-erledigt      Follow-up erledigt (/api/crm/followup)
// Prozesse × Fulfillment (22.10., Produkt → Prozess):
//   zusatz-gebucht         CRM-Schreibweg (`crmDiff` über `mandate[].zusatz`): ein neues Zusatzmodul an einem BESTEHENDEN Mandat — Bezug Mandat + Produkt
//                          (`leistungId`); beim Anlegen eines Mandats kommt nur „mandat-angelegt“ (der Motor liest Haupt- und Zusatzprodukte dann selbst)
// Begleit-Prozesse am Fall (22.10., Fulfillment in die Werkstatt B1) — alle Bereich Business, Bezug Mandat (+ Paket `vorlageId`), nur Kennungen:
//   fall-phase             nach dem Schreiben eines Falls: eine Phase wird „jetzt“ (Stufe `begonnen`) bzw. „fertig“ (`abgeschlossen`) — `phasenStaende` (regeln.ts)
//   fall-wartet-kunde      nach dem Schreiben eines Falls: ein Schritt des Kunden wird aktuell (`aktiveKnoten`) bzw. steht neu auf „wartet auf Kunde“
//   abstimmung-bestaetigt  nach dem Schreiben eines Falls: eine Bestätigung (F0 …) ist neu gegeben — Bezug `freigabeId`
//   fall-haengt            Morgenlauf: ein Hänger des Cockpits (`wasHaengt` — Willkommen-Uhr, Bestätigung, wartet, überfällig, Puls, Report), Stufe = Art, je Hänger einmal
//   kunde-geliefert        Kunden-Link bzw. Formular im Kick-off: Formular vollständig (Stufe `formular`), Unterlage hochgeladen (`unterlage`), Puls beantwortet (`puls`)
// Kreislauf Werkstatt (29.10., „Alle Automatisierungen kommen aus der Werkstatt“):
//   lead-mql               Firmen- bzw. Personen-Lead erreicht MQL (CRM- bzw. Kartei-Diff, EINE Regel `mqlErreicht` aus lib/crm/leads.ts — nur Marketing-Herkunft)
//   neuer-lead             zusätzlich: Person von Hand in der Kartei angelegt (nie beim Massen-Import) und Formular „Angebot anfordern“ (neue Person)
//   fall-abgeschlossen     Fulfillment-Fall neu auf „abgeschlossen“ — Stufe `mandatsende` (automatisch, wenn das Mandat endet) bzw. `hand`

import type { SkillEreignis } from '@/lib/agenten/typen';

// ── Block Kundengewinnung (22.10., Vorlagen der Prozesse; research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md › 5.1) ─────────────────────────────────────────
//   netzwerken-erfasst   E2  Netzwerken-Erfassung abgeschlossen (lib/crm/netzwerken-server.ts, nach Schritt „melden“) — Bezug Kontakt, Firma, Event
//   angebot-gestellt     E3  „Angebot stellen“ (lib/crm/angebot-server.ts) — auch Version 2, wenn der Deal schon auf „angebot“ steht
//   angebot-antwort      E3  angenommen bzw. abgelehnt (Stufe = Antwort)
//   buchung-angefragt    E5  Buchungsanfrage bestätigt der Gast (lib/kalender/buchung-ablauf.ts `anfrageLauf`) — Bezug `terminBuchungId`
//   buchung-bestaetigt   E5  Freigabe der Buchung abgeschlossen (Schritt „crm“)
//   einwilligung-erteilt E6  neue, nicht widerrufene Einwilligung mit vollem Nachweis (Kartei-Diff; Stufe = Kanal)
//   event-vorbei         E7  Event steht auf „durchgeführt“ (CRM-Diff) — Bezug Event
//   event-status         E7  Event wechselt den Status (Stufe = neuer Status)
//   linkedin-antwort     E10 Antwort in der Vernetzen-Runde (Kartei-Diff `netzwerk.<profil>.antwort`; Stufe = ja · gespraech · nein)
//   vernetzt             E10 Vernetzung angenommen (Kartei-Diff `netzwerk.<profil>.vernetztAm`)
//   kampagne-aktiv       E11 Kampagne wechselt auf „aktiv“ (CRM-Diff) — Bezug Kampagne
//   kampagnen-ergebnis   E11 neues Ergebnis einer Person in einer Kampagne (Stufe = Ergebnis)
// C1 (Lauf-Motor) ergänzt E1/E4/E8/E9 in seinem eigenen Block — beim Zusammenführen bleibt es EINE Liste.
export const EREIGNISSE_KUNDENGEWINNUNG = [
  'netzwerken-erfasst', 'angebot-gestellt', 'angebot-antwort', 'buchung-angefragt', 'buchung-bestaetigt', 'einwilligung-erteilt',
  'event-vorbei', 'event-status', 'linkedin-antwort', 'vernetzt', 'kampagne-aktiv', 'kampagnen-ergebnis',
] as const satisfies readonly SkillEreignis[];
const EREIGNIS_NAME_KUNDENGEWINNUNG: Readonly<Record<(typeof EREIGNISSE_KUNDENGEWINNUNG)[number], string>> = {
  'netzwerken-erfasst': 'Begegnung erfasst (Netzwerken)', 'angebot-gestellt': 'Angebot gestellt', 'angebot-antwort': 'Antwort auf ein Angebot',
  'buchung-angefragt': 'Buchung angefragt', 'buchung-bestaetigt': 'Buchung bestätigt', 'einwilligung-erteilt': 'Einwilligung erteilt',
  'event-vorbei': 'Event vorbei', 'event-status': 'Event in neuem Status', 'linkedin-antwort': 'Antwort auf LinkedIn', vernetzt: 'Vernetzung angenommen',
  'kampagne-aktiv': 'Kampagne aktiv', 'kampagnen-ergebnis': 'Ergebnis in einer Kampagne',
};

/** Wie die Arten heißen (Skill-Editor, „bei: …“, Head of IT, Heads-Paket). */
export const EREIGNIS_NAME: Readonly<Record<SkillEreignis, string>> = {
  'neue-mail': 'neue Mail', 'neue-whatsapp': 'neue WhatsApp-Nachricht', 'neuer-lead': 'neuer Lead', 'lead-sql': 'Lead wird SQL',
  'deal-stufe': 'Deal in neuer Stufe', zahlungseingang: 'Zahlungseingang', 'termin-abgesagt': 'Termin abgesagt', 'aufgabe-zoe': 'an ZOE gegeben',
  'neue-aufgabe': 'neue Aufgabe', 'termin-vorbei': 'Termin vorbei', 'frist-naht': 'Frist naht', 'neues-medium': 'neues Bild oder Video',
  webhook: 'Webhook von außen',
  'mandat-angelegt': 'Mandat angelegt', 'mandat-beendet': 'Mandat beendet', 'rechnung-gestellt': 'Rechnung gestellt',
  'fall-schritt-erledigt': 'Schritt im Fall erledigt', 'antwort-gesendet': 'Antwort gesendet', 'followup-erledigt': 'Follow-up erledigt', 'ziel-erreicht': 'Ziel erreicht',
  'zusatz-gebucht': 'Zusatzmodul gebucht',
  // ── Begleit-Prozesse am Fall (22.10., B1 — Quellen in ./quellen.ts: `fallEreignisse`, `fallHaengtEreignisse`, `kundeGeliefertEreignis`) ──
  'fall-phase': 'Phase im Fall begonnen bzw. abgeschlossen', 'fall-wartet-kunde': 'Schritt wartet auf den Kunden', 'abstimmung-bestaetigt': 'Bestätigung im Fall gegeben',
  'fall-haengt': 'Im Fall hängt etwas', 'kunde-geliefert': 'Kunde hat geliefert',
  // ── Kreislauf Werkstatt (29.10.) ──
  'lead-mql': 'Lead wird MQL', 'fall-abgeschlossen': 'Fall abgeschlossen',
  // ── Kundengewinnung (22.10., E2/E3/E5/E6/E7/E10/E11 — Quellen in ./quellen-kundengewinnung.ts) ──
  ...EREIGNIS_NAME_KUNDENGEWINNUNG,
};

/** Arten, die eine Quelle speist — nur diese lösen etwas aus. */
export const EREIGNISSE_ANGEBUNDEN: readonly SkillEreignis[] = ['neue-mail', 'neue-whatsapp', 'neuer-lead', 'lead-sql', 'deal-stufe', 'zahlungseingang', 'termin-abgesagt', 'aufgabe-zoe', 'webhook',
  // Prozesse C1 (21.10.)
  'termin-vorbei', 'mandat-angelegt', 'mandat-beendet', 'rechnung-gestellt', 'fall-schritt-erledigt', 'antwort-gesendet', 'followup-erledigt', 'ziel-erreicht',
  // Prozesse × Fulfillment (22.10.)
  'zusatz-gebucht',
  // Begleit-Prozesse am Fall (22.10., B1)
  'fall-phase', 'fall-wartet-kunde', 'abstimmung-bestaetigt', 'fall-haengt', 'kunde-geliefert',
  // Kreislauf Werkstatt (29.10.)
  'lead-mql', 'fall-abgeschlossen',
  // Kundengewinnung (22.10.): ein eigener Block — jede Art hat ihre Quelle in ./quellen-kundengewinnung.ts.
  ...EREIGNISSE_KUNDENGEWINNUNG];
/** Arten, die nur intern etwas anstoßen (kein Skill-Auslöser). */
export const EREIGNISSE_INTERN: readonly SkillEreignis[] = ['aufgabe-zoe', 'webhook'];
/** Alle Arten in der Reihenfolge der Anzeige (angebundene zuerst). */
export const EREIGNIS_ARTEN: readonly SkillEreignis[] = [...EREIGNISSE_ANGEBUNDEN, ...(Object.keys(EREIGNIS_NAME) as SkillEreignis[]).filter(a => !EREIGNISSE_ANGEBUNDEN.includes(a))];
/** Was ein Skill als Auslöser wählen darf: angebunden und nicht intern. */
export const SKILL_EREIGNISSE: readonly SkillEreignis[] = EREIGNISSE_ANGEBUNDEN.filter(a => !EREIGNISSE_INTERN.includes(a));
/** Was der Skill-Editor zeigt: alles außer den internen (nicht angebundene mit Hinweis). */
export const EREIGNISSE_ANZEIGE: readonly SkillEreignis[] = EREIGNIS_ARTEN.filter(a => !EREIGNISSE_INTERN.includes(a));

export const istEreignisArt = (v: unknown): v is SkillEreignis => typeof v === 'string' && Object.prototype.hasOwnProperty.call(EREIGNIS_NAME, v);
export const istAngebunden = (a: SkillEreignis): boolean => EREIGNISSE_ANGEBUNDEN.includes(a);

/** Hinweis im Skill-Editor für eine noch nicht angebundene Art (ehrlich statt still nie laufen). */
export const nochNichtAngebunden = (a: SkillEreignis): string =>
  `„${EREIGNIS_NAME[a]}“ ist noch nicht angebunden — so ein Skill lässt sich noch nicht speichern und startet nicht von selbst. Bis dahin: ein Zeitplan, oder ein Head lädt ihn im Chat.`;
