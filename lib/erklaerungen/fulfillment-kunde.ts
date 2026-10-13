// ─── Erklärungen · Fulfillment — Kunden-Link, Formulare, Upload, Puls (angelegt in C0, gefüllt in C2, 10.10.) ───────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 10: `fulfillment.kundenLink` (an/aus, Datenweg), `fulfillment.kundenLinkFormular`, `fulfillment.kundenLinkUpload`,
// `fulfillment.kundenLinkPuls`, `fulfillment.pulsSchwelle`, `fulfillment.pulsInHealth` — mit erfundenem, neutralem Fallbeispiel (Wächter
// tests/erklaerungen.test.ts). Eingehängt in lib/erklaerungen/index.ts (EINSTELLUNGEN). Genutzt in components/os/fulfillment/kunde/FallKunde.tsx.

import type { EinstellungsText } from './typen';

export const EINSTELLUNGEN_FULFILLMENT_KUNDE = {
  'fulfillment.kundenLink': {
    was: 'Der Kunden-Link ist eine eigene Seite je Mandat: Der Kunde sieht dort den Stand, beantwortet sein Playbook, lädt Unterlagen hoch und gibt den Kunden-Puls ab — ohne Anmeldung, nur mit dem geheimen Teil der Adresse. Er kommt ausgeschaltet; nur der Inhaber schaltet ihn ein, und der Betrieb muss ihn vorher freigegeben haben.',
    beispiel: 'Ein erfundener Kunde „Beispiel Werkzeugbau“ bekommt nach dem Kick-off einen Link. Er sieht oben „Wir warten auf euren Input“, den Strahl mit „hier stehen wir“ bei der Analyse, sein Ziel als Balken (vorher 4 → jetzt 7 → Ziel 12 Termine) und unter „Das braucht es von euch“ die Preisliste mit Frist. Er füllt drei Abschnitte des Playbooks aus und lädt den Registerauszug hoch.',
    an: 'Für jedes Mandat lässt sich ein Link anlegen. Ihr seht ihn genau einmal zum Kopieren; danach steht nur noch ein Fingerabdruck bei uns. Ein neuer Link widerruft den alten.',
    aus: 'Jeder Kunden-Link antwortet „nicht (mehr) gültig“ — auch schon verschickte. Nichts geht verloren: Antworten, Unterlagen und Puls bleiben intern sichtbar.',
    daten: 'Der Kunde schickt seine Antworten und Dateien an euren eigenen Server; sie liegen dort verschlüsselt. Kein fremder Dienst, kein Tracking. Hochgeladene Dateien prüft MAKE OS am Inhalt; ein Virenscanner läuft nicht.',
  },
  'fulfillment.kundenLinkFormular': {
    was: 'Erlaubt dem Kunden, über seinen Link die Formulare des Falls auszufüllen (Playbook, Workbooks). Er sieht nur Formulare, die für Kunden gedacht und geprüft sind, und nur seine eigenen Antworten.',
    beispiel: 'Im Abschnitt „Vertriebsprozess heute“ schreibt der erfundene Kunde vier Sätze und markiert ihn als fertig — intern steht das Playbook dann auf 50 Prozent.',
    an: 'Die Formular-Abschnitte stehen auf der Kunden-Seite und lassen sich speichern.',
    aus: 'Die Kunden-Seite zeigt keine Formulare; bisherige Antworten bleiben intern erhalten.',
  },
  'fulfillment.kundenLinkUpload': {
    was: 'Erlaubt dem Kunden, über seinen Link Unterlagen hochzuladen — nur PDF, Bilder und Office-Dateien ohne Makros, am Inhalt geprüft, höchstens zwanzig Dateien. Jede Datei bleibt „ungeprüft“, bis jemand von euch sie freigibt.',
    beispiel: 'Der erfundene Kunde lädt eine Preisliste als PDF hoch. Ihr bekommt eine Glocke „Neue Unterlagen eingegangen“, seht die Datei unter Kunde & Reports und gebt sie frei — erst dann liest die Analyse sie.',
    an: 'Die Kunden-Seite zeigt das Upload-Feld und den Stand nur als Zahlen — eingegangen, geprüft, in Prüfung (ohne Liste der Dateien).',
    aus: 'Kein Upload-Feld auf der Kunden-Seite; schon eingegangene Dateien bleiben.',
    daten: 'Dateien liegen verschlüsselt auf eurem Server, Fotos ohne Ortsangaben. Intern gibt es sie nur als Download, nie im Browser geöffnet.',
  },
  'fulfillment.kundenLinkPuls': {
    was: 'Erlaubt den Kunden-Puls: eine Frage von 0 bis 10 plus ein Satz. Mit dem 2-Wochen-Report geht ein eigener Puls-Link mit, der nur diese Frage öffnet — ein weitergeleiteter Report öffnet nie Playbook oder Uploads.',
    beispiel: 'Der erfundene Kunde antwortet „8 — die Termine sind gut vorbereitet“. Der Wert erscheint intern unter Kunde & Reports und im nächsten Report.',
    an: 'Reports fragen nach dem Puls, solange der Kunden-Link aktiv ist; offene Fragen stehen auch auf der Kunden-Seite.',
    aus: 'Keine Puls-Frage im Report und auf der Kunden-Seite; von Hand eingetragene Werte bleiben möglich.',
  },
  'fulfillment.pulsSchwelle': {
    was: 'Bis zu diesem Wert gilt ein Kunden-Puls als „braucht Aufmerksamkeit“: Die zuständige Person bekommt eine Glocke (ohne den Wert) und im Freigabe-Stapel den Vorschlag „Gespräch anbieten“.',
    beispiel: 'Bei Schwelle 6 löst eine 5 die Glocke und den Vorschlag aus; eine 7 nicht. Die Freigabe legt ein Follow-up am Mandat an, in zwei Tagen fällig.',
  },
  'fulfillment.pulsInHealth': {
    was: 'Übernimmt einen Puls in die Zufriedenheit des Mandats (Health): Wert mal zehn, also 7 von 10 als 70. Die vorhandene Zufriedenheits-Ampel rechnet damit unverändert weiter. Es passiert nur auf diesen Klick.',
    beispiel: 'Der erfundene Kunde gibt eine 4. Ihr übernehmt sie — die Zufriedenheit des Mandats steht dann auf 40, und die Health-Ampel springt auf gelb.',
  },
} as const satisfies Record<string, EinstellungsText>;
