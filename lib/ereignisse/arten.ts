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

import type { SkillEreignis } from '@/lib/agenten/typen';

/** Wie die Arten heißen (Skill-Editor, „bei: …“, Head of IT, Heads-Paket). */
export const EREIGNIS_NAME: Readonly<Record<SkillEreignis, string>> = {
  'neue-mail': 'neue Mail', 'neue-whatsapp': 'neue WhatsApp-Nachricht', 'neuer-lead': 'neuer Lead', 'lead-sql': 'Lead wird SQL',
  'deal-stufe': 'Deal in neuer Stufe', zahlungseingang: 'Zahlungseingang', 'termin-abgesagt': 'Termin abgesagt', 'aufgabe-zoe': 'an ZOE gegeben',
  'neue-aufgabe': 'neue Aufgabe', 'termin-vorbei': 'Termin vorbei', 'frist-naht': 'Frist naht', 'neues-medium': 'neues Bild oder Video',
  webhook: 'Webhook von außen',
  'mandat-angelegt': 'Mandat angelegt', 'mandat-beendet': 'Mandat beendet', 'rechnung-gestellt': 'Rechnung gestellt',
  'fall-schritt-erledigt': 'Schritt im Fall erledigt', 'antwort-gesendet': 'Antwort gesendet', 'followup-erledigt': 'Follow-up erledigt', 'ziel-erreicht': 'Ziel erreicht',
};

/** Arten, die eine Quelle speist — nur diese lösen etwas aus. */
export const EREIGNISSE_ANGEBUNDEN: readonly SkillEreignis[] = ['neue-mail', 'neue-whatsapp', 'neuer-lead', 'lead-sql', 'deal-stufe', 'zahlungseingang', 'termin-abgesagt', 'aufgabe-zoe', 'webhook',
  // Prozesse C1 (21.10.)
  'termin-vorbei', 'mandat-angelegt', 'mandat-beendet', 'rechnung-gestellt', 'fall-schritt-erledigt', 'antwort-gesendet', 'followup-erledigt', 'ziel-erreicht'];
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
