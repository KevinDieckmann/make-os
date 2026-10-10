// ─── Erklärungen · Heads und Mitarbeiter (10.10.) ──────────────────────────────────────────────────────────────────────────
// Je Head: was er tut · was er nie tut · ein erfundener Beispiel-Vorschlag. Je Mitarbeiter: sein Beispiel-Vorschlag; „was er tut“ ist
// seine Rolle aus dem Katalog (lib/agenten/katalog.ts), „was er nie tut“ erbt er von seinem Head. Neuer Head / neue Vorlage im Katalog
// = hier ein Eintrag (der Wächter tests/erklaerungen.test.ts wird sonst rot). Beispiele sind erfunden: „Beispiel GmbH“, „Mira“, runde Zahlen.

import { vorlageVon, headDef } from '@/lib/agenten/katalog';
import { agentAbschnitte, type AgentText, type ErklaerAbschnitt } from './typen';

export const HEAD_TEXTE: Readonly<Record<string, AgentText>> = {
  sales: {
    tut: 'Führt den Vertrieb: prüft Leads und Deals, stellt die Power-Hour-Liste zusammen, bereitet Qualifizierung und Angebote vor und behält Follow-ups im Blick.',
    nie: 'Verschickt nie eine Mail, Nachricht oder ein Angebot, legt keinen Deal an und ändert keine Stufe ohne deinen Klick. Er liest keine privaten Notizen und sieht keine eingeschränkten Kontakte (Art. 18).',
    beispiel: '„Beispiel GmbH: Das Angebot ist seit 6 Tagen offen. Nächster Schritt: Anruf am Donnerstag, Gesprächsleitfaden liegt bei.“ Du übernimmst, änderst oder lehnst mit Grund ab.',
  },
  marketing: {
    tut: 'Macht das Business sichtbar: plant Kampagnen nach den Playbooks, entwirft Beiträge, Newsletter und Netzwerk-Nachrichten und beachtet die Rechts-Ampel je Kanal.',
    nie: 'Veröffentlicht und versendet nie selbst. Er schlägt keinen Kanal vor, den die Ampel sperrt (zum Beispiel werbliche Mail ohne Einwilligung), und nimmt keine Kontakte mit Werbesperre auf.',
    beispiel: '„Newsletter-Entwurf ‚Drei Dinge, die wir diesen Monat gelernt haben‘ an das Segment ‚Kunden‘ — Double-Opt-in vorhanden, 84 Empfänger.“ Versenden musst du selbst.',
  },
  event: {
    tut: 'Plant eigene Abende und begleitet besuchte Events: Ziel, Gästemischung, Einladungen, Nachfassen binnen 48 Stunden und die Wirkung danach.',
    nie: 'Lädt nie selbst ein und verschickt keine Danke-Nachrichten. Personen mit Werbesperre nimmt er nicht in Gästelisten auf; besuchte Events zählen nicht in die Kennzahlen der eigenen Abende.',
    beispiel: '„Abend ‚Zukunft der Arbeit‘ am 14.11.: 14 Zusagen. Vorschlag: 6 weitere Einladungen an Personen aus drei Branchen, damit die Mischung stimmt.“',
  },
  finanzen: {
    tut: 'Führt die Finanzen der Business-Gesellschaften: Liquidität, Rechnungen, Monatsabschluss und Fristen. Er rechnet aus euren Zahlen und ordnet sie ein — Hinweis, keine Steuer- oder Rechtsberatung.',
    nie: 'Bewegt nie Geld, stellt keine Rechnung aus und überweist nichts. Gestellte Rechnungen ändert er nicht. Privates sieht er nicht.',
    beispiel: '„Die Liquidität reicht rechnerisch bis März. Rechnung 2026-041 der Beispiel GmbH ist 12 Tage überfällig — Entwurf einer Zahlungserinnerung liegt bei.“',
  },
  it: {
    tut: 'Erklärt das Lagebild aus Server, App, Sicherheit und Außenblick in Ampeln und schlägt nächste Schritte vor.',
    nie: 'Greift nie in den Server ein, führt keine Befehle aus und sieht keine Inhalte, Personen oder Adressen — nur Zähler und Zustände.',
    beispiel: '„Die Sicherung ist 26 Stunden alt (gelb). Prüfe, ob der Nachtlauf gelaufen ist; eine Aufgabe dafür liegt als Vorschlag bereit.“',
  },
  operations: {
    tut: 'Hält Projekte, Aufgaben, Business-Postfächer und Termine am Laufen: ordnet die Inbox, schlägt Delegation und Zeitblöcke vor.',
    nie: 'Sendet nie eine Mail, löscht nichts und liest nur Business-Postfächer — nie ein privates.',
    beispiel: '„3 Mails warten seit gestern, eine davon ist eine Terminanfrage. Aufgabe ‚Termin mit Beispiel AG bestätigen‘ bis Freitag — Freigabe wartet.“',
  },
  kundenerfolg: {
    tut: 'Sorgt dafür, dass laufende Mandate gelingen: bereitet Reviews vor, behält Kündigungsfristen und offene Zusagen im Blick und findet Anlässe für Folgeangebote.',
    nie: 'Kündigt, ändert oder beendet nie ein Mandat und schreibt Kunden nicht selbst an.',
    beispiel: '„Review mit Beispiel GmbH in 9 Tagen. Die Kündigungsfrist endet am 31.12. Ein Agenda-Entwurf liegt bei.“',
  },
  strategie: {
    tut: 'Hält Ziele, Board-Bericht und OKR zusammen und zeigt, wo der Kurs zum Jahresziel wackelt.',
    nie: 'Ändert nie Ziele oder Meilensteine selbst — nur als Vorschlag mit Begründung — und verschickt keinen Bericht.',
    beispiel: '„Der Meilenstein ‚Angebot Produkt A‘ hat keinen Aufwand eingetragen, das Jahresziel hängt daran. Bitte 20 Stunden eintragen oder den Termin verschieben.“',
  },
  produkt: {
    tut: 'Entwickelt die eigene Software als Produkt weiter: sammelt Rückmeldungen, schreibt Spezifikationen und ordnet Karten im Bauplan.',
    nie: 'Programmiert nichts, startet keine Entwicklung und schiebt keine Karte nach „Fertig“ — das macht nur die Abnahme durch Menschen.',
    beispiel: '„Drei Rückmeldungen nennen den Datei-Export des Kalenders. Neue Karte ‚Kalender als Datei‘ mit Beschreibung und Testschritten.“',
  },
  recht: {
    tut: 'Hält Pflichten, Fristen, Verträge und Datenschutz der Business-Gesellschaften im Blick: montags der Recht-Check (Fristen der nächsten vier Wochen, Ampel je Gesellschaft, was fehlt), die Vorbereitung der Risikorunde, eine Checkliste zu jedem neuen Vertrag und auf Knopfdruck eine Anwalts-Mappe.',
    nie: 'Gibt keine Rechtsberatung und bewertet keine Klausel, keinen Vertrag und kein Risiko — er zeigt Fundstellen, Fristen und Prüffragen; entscheiden und bewerten tut ihr. Er reicht nichts bei Register, Finanzamt oder Gericht ein, verschickt nichts und unterschreibt nichts; alles wirkt erst nach deinem Klick im Stapel.',
    beispiel: '„Recht-Check KW 42: Beispiel GmbH gelb — Jahresabschluss offenlegen bis 31.12., die Gesellschafterliste fehlt in der Firmen-Akte. Aufgabe ‚Gesellschafterliste ablegen‘ liegt als Vorschlag bereit.“',
  },
  research: {
    tut: 'Recherchiert Markt, Wettbewerb und Themen mit Quellen und legt Ergebnisse als Notiz-Vorschlag im Brain ab.',
    nie: 'Erfindet keine Quellen, schreibt nie direkt ins Brain (nur als Vorschlag) und sucht im Internet nur, wenn die Web-Suche erlaubt ist.',
    beispiel: '„Marktübersicht ‚Beratung für Familienunternehmen‘: 5 Anbieter, je mit Quelle und Preislage. Als Notiz im Brain ablegen?“',
  },
  gesundheit: {
    tut: 'Begleitet Training, Erholung und Routinen mit den eigenen Werten der Person: schlägt morgens den Trainingstag vor (Plan, Tagesform, Wettkampf) und auf Wunsch eine Trainingswoche.',
    nie: 'Gibt keine medizinische oder Trainingsberatung und stellt keine Diagnosen. Er liest nur deine eigenen Werte — die einer anderen Person nur mit deren Einwilligung (c) — und erscheint erst mit deinen Einwilligungen (a) und (b).',
    beispiel: '„Recovery heute niedrig, Schlaf kurz. Statt Intervalle: lockere 40 Minuten oder Mobility. Als Block für 17 Uhr eintragen?“',
  },
  ernaehrung: {
    tut: 'Plant Essen und Einkauf für den Haushalt, personenneutral: Wochenplan mit Rezepten und eine Einkaufsliste aus Plan und Vorrat.',
    nie: 'Nennt weder Personen noch Beschwerden oder Gründe aus Profilen in seinen Antworten und gibt keine Ernährungsberatung oder Mengenvorgaben.',
    beispiel: '„Wochenplan: 5 Abendessen, 2 davon aus ‚Unsere Gerichte‘. Einkaufsliste: 14 Posten, Vorrat schon abgezogen.“',
  },
  familie: {
    tut: 'Hält Dates, wichtige Tage, Urlaube und Gesprächsthemen im Blick und schlägt Zeitfenster vor.',
    nie: 'Liest nie Einträge, die jemand als „nur ich“ markiert hat, und sagt nie, was eine Person privat eingetragen hat. Er trägt nichts in den Kalender ein, ohne dass jemand klickt.',
    beispiel: '„Der Jahrestag ist in 12 Tagen. Freitagabend und Samstagmittag sind für beide frei — ein Date-Vorschlag liegt bereit.“',
  },
  'finanzen-privat': {
    tut: 'Hält Budget, Fixkosten, offene Rechnungen und private Steuerfristen im Blick — auch die Einheit, die zu Privat gehört.',
    nie: 'Bewegt nie Geld, gibt keine Steuer- oder Anlageberatung und läuft nur mit privatem Finanzzugang.',
    beispiel: '„Die Versicherung ist um 8 € teurer geworden (Fixkosten). Die Buchung vom 02.10. hat noch keine Zuordnung — soll sie unter ‚Versicherungen‘ stehen?“',
  },
  assistenz: {
    tut: 'Kümmert sich um Termine, Erinnerungen und die Wochenplanung der Person: findet freie Zeiten und schlägt Blöcke vor.',
    nie: 'Trägt nie selbst einen Termin ein und lädt niemanden ein — Blöcke entstehen erst mit deinem Klick. Termine anderer Personen sieht er nur als „Belegt“.',
    beispiel: '„Für den Bericht brauchst du 2 Stunden am Stück. Donnerstag von 9 bis 11 Uhr ist frei — als Fokus-Block eintragen?“',
  },
};

/** Der Beispiel-Vorschlag je Mitarbeiter-Vorlage (Kennung wie im Katalog). */
export const MITARBEITER_BEISPIELE: Readonly<Record<string, string>> = {
  'sales-recherche': '„7 Firmen mit 50 bis 200 Beschäftigten in der Region passen zu eurem Zielkunden-Profil; für 3 gibt es einen Ansprechpartner. Als Leads vormerken?“',
  'sales-qualifizierung': '„Beispiel GmbH: Schmerz ja, Entscheider ja, Budget offen — noch kein SQL. Frage für das nächste Gespräch: ‚Bis wann soll entschieden werden?‘“',
  'sales-angebote': '„Angebots-Entwurf für Beispiel GmbH: Beratung Paket M, 3 Monate, 4.500 € netto, 30 Tage gültig. Zum Prüfen im Angebots-Editor ablegen?“',
  'sales-nachfassen': '„Power Hour heute: 5 Personen. Reihenfolge nach Wärme, ein Anlass je Person und ein kurzer Gesprächsleitfaden.“',
  'sales-crm-pflege': '„2 mögliche Dubletten (Mira Beispiel und M. Beispiel) und 4 Kontakte ohne Firma. Zusammenführen und Verknüpfen vorschlagen?“',
  'marketing-design': '„Die Einladung zum Abend nutzt noch das alte Logo. Briefing fürs neue: Farben, Schrift, Abstände — als Notiz ablegen?“',
  'marketing-bild-video': '„Aus 12 Fotos vom Abend passen 4 für LinkedIn, eines als Titelbild; Zuschnitt 4:5 und Bildtexte liegen bei. Ein 15-Sekunden-Video würde etwa 1,20 € kosten — gestartet wird nur mit deinem Klick.“',
  'marketing-kampagnen': '„Kampagne ‚Alte Kunden wieder ansprechen‘: Segment ‚Kunden 2025‘, Kanal Mail (Ampel grün), 3 Schritte über 10 Tage, Nachfassen nach 4 Tagen.“',
  'marketing-social': '„LinkedIn-Beitrag ‚Drei Dinge, die wir bei der ersten Kundenanfrage lernen‘: 120 Wörter, Ich-Form. Veröffentlichen musst du selbst.“',
  'event-gaeste': '„Gästeliste für den Abend: 12 Zusagen, 8 offen. Vorschlag: 5 Einladungen an Personen aus Branchen, die noch fehlen — nur über Kanäle mit grüner Ampel.“',
  'event-nachfassen': '„Danke-Nachrichten für 6 Personen vom Abend, Frist morgen. Jede mit einem Satz zum Gespräch; abschicken musst du selbst.“',
  'event-abendbericht': '„Abendbericht: 9 Begegnungen erfasst, 6 Gespräche, 3 Nachfass-Termine. Zwei Personen ohne nächsten Schritt — vormerken?“',
  'finanzen-rechnungen': '„2 Rechnungen überfällig (zusammen 3.800 €). Entwurf einer freundlichen Zahlungserinnerung für die ältere.“',
  'finanzen-liquiditaet': '„Kontostand 18.400 €, Planposten im Dezember 22.000 €. Engpass ab Mitte Dezember — Zahlung vorziehen oder Teilzahlung vereinbaren?“',
  'it-betrieb': '„Der Außenblick meldet ein Zertifikat, das in 12 Tagen abläuft (gelb). Aufgabe ‚Zertifikat prüfen‘ bis Freitag.“',
  'it-bauplan': '„Neue Karte im Bauplan: ‚Export als Datei im Kalender‘ — Art Wunsch, mit Seite und Beschreibung.“',
  'operations-inbox': '„Postfach Anfragen: 5 neue Mails — 2 Terminanfragen, 1 Rechnung, 2 Rundschreiben. Zu den Anfragen je ein Antwort-Entwurf.“',
  'operations-aufgaben': '„Die Aufgabe ‚Angebot prüfen‘ ist seit 3 Tagen überfällig und liegt bei Mira. Vorschlag: an die zweite Person im Team abgeben, Termin Donnerstag.“',
  'operations-meeting': '„Protokoll des Wochentreffens: 4 Beschlüsse, 6 Aufgaben mit Zuständigen und Fristen — zum Anlegen freigeben?“',
  'kundenerfolg-betreuung': '„Review mit Beispiel GmbH in 9 Tagen: Agenda-Entwurf, 2 offene Zusagen, Kündigungsfrist 31.12.“',
  'kundenerfolg-ausbau': '„Beispiel GmbH hat das Paket vor 5 Monaten gebucht und zweimal nach Schulungen gefragt — Anlass für ein Folgeangebot ‚Schulung‘. Entwurf liegt bei.“',
  'strategie-board': '„Board-Bericht Woche 41: Liquidität stabil, 3 Deals in Angebot, Kapazität in zwei Wochen eng. Drei Punkte zum Besprechen.“',
  'strategie-ziele': '„Jahresziel ‚10 Neukunden‘: 4 erreicht. Zwei Meilensteine ohne Termin — Termine vorschlagen?“',
  'strategie-gesellschaften': '„Der Vertrag mit dem Steuerbüro lässt sich bis 30.11. kündigen. Erinnerung 30 Tage vorher als Aufgabe anlegen?“',
  'produkt-fahrplan': '„Karte ‚Rechnungen exportieren‘: Spezifikation in 6 Punkten, Testschritte, Einordnung in Etappe 2.“',
  'produkt-rueckmeldungen': '„4 Rückmeldungen zur Suche diese Woche: Treffer schwer zu finden. Eine Karte ‚Suche verbessern‘ mit den vier Stimmen als Beleg.“',
  'recht-fristen': '„Für die Beispiel GmbH ist die Schwelle von 20 Beschäftigten erreicht: Datenschutzbeauftragte benennen (§ 38 BDSG). Aufgabe mit Frist als Vorschlag — oder schon erledigt? Dann im Schild vermerken.“',
  'recht-datenschutz': '„Selbstprüfung: 2 Punkte offen, 1 Auftragsverarbeiter ohne bestätigten AVV. Was der AVV regelt, in einfachen Worten, und wo du die Bestätigung einträgst.“',
  'recht-vertraege': '„Checkliste zum Dienstleistungsvertrag: Kündigung in § 9 (3 Monate zum Quartalsende), Haftung in § 7 — zur Datenverarbeitung keine Stelle gefunden. Stichtag 31.03. als Vertragsfrist eintragen?“',
  'research-markt': '„Vergleich von drei Mitbewerbern: Preislage, Zielgruppe, Besonderheit — jede Aussage mit Quelle. Als Notiz im Brain ablegen?“',
  'research-themen': '„Drei Themen, die in der Zielgruppe diese Woche diskutiert wurden — mit Quellen und einem Satz, warum sie fürs Marketing zählen.“',
  'gesundheit-training': '„Heute: lockerer Lauf, 40 Minuten; Qualität steht am Donnerstag im Plan. Eine Trainingswoche mit 4 Einheiten liegt als Vorschlag zum Übernehmen bereit.“',
  'gesundheit-erholung': '„Schlaf zuletzt 6:10 Stunden, Ziel 8. Rahmen für heute: Bildschirm ab 22 Uhr aus, Pause am Nachmittag, früher ins Bett.“',
  'ernaehrung-plan': '„Wochenplan mit 5 Abendessen — 2 aus ‚Unsere Gerichte‘, Rezepte mit Zutaten. Als Plan übernehmen?“',
  'ernaehrung-einkauf': '„Einkaufsliste: 14 Posten nach Plan, 6 schon im Vorrat und abgezogen. Nach Kategorie sortiert.“',
  'familie-anlaesse': '„Geburtstag in 9 Tagen. Geschenk-Aufgabe mit 5 Tagen Vorlauf anlegen und Freitagabend als Termin vorschlagen?“',
  'familie-urlaub': '„Zwei Zeitfenster im Sommer, in denen beide frei sind: 12. bis 19.7. und 2. bis 9.8. Als Ideensammlung ablegen?“',
  'familie-gespraeche': '„Für das ruhige Gespräch am Sonntag: drei gemeinsame Themen aus den Einträgen der Woche — keines davon ‚nur ich‘.“',
  'finanzen-privat-budget': '„6 Buchungen ohne Zuordnung, davon 3 vom gleichen Empfänger. Zuordnung ‚Lebensmittel‘ vorschlagen und für künftige Buchungen merken?“',
  'finanzen-privat-rechnungen': '„Steuervorauszahlung am 10.12., laut Plan 1.200 €. Aufgabe ‚Vorauszahlung prüfen‘ ohne Betrag im Titel anlegen?“',
  'assistenz-termine': '„Für das Gespräch mit Beispiel GmbH (45 Minuten) passen Dienstag 14:00 oder Mittwoch 10:30. Als Terminentwurf anlegen?“',
  'assistenz-erinnerungen': '„3 Aufgaben ohne Datum, eine davon seit 2 Wochen offen. Fristen vorschlagen, die älteste zuerst?“',
  'assistenz-woche': '„Wochenplan: Montag Angebote (2 h), Dienstag Termine, Mittwoch Fokus Bericht (3 h). Die Blöcke erscheinen erst mit deinem Klick im Kalender.“',
};

/** Die Erklärung eines Heads — oder keine Abschnitte, wenn der Katalog ihn nicht kennt. */
export function headAbschnitte(headId: string): ErklaerAbschnitt[] {
  const t = HEAD_TEXTE[headId];
  return t ? agentAbschnitte(t) : [];
}

/**
 * Die Erklärung einer Mitarbeiter-Vorlage: was er tut (seine Rolle), was er nie tut (das Gleiche wie sein Head — und er delegiert nie
 * weiter), ein Beispiel-Vorschlag. Eigene, selbst angelegte Mitarbeiter haben keine Vorlage → keine Abschnitte.
 */
export function mitarbeiterAbschnitte(mitarbeiterId: string): ErklaerAbschnitt[] {
  const v = vorlageVon(mitarbeiterId);
  const beispiel = MITARBEITER_BEISPIELE[mitarbeiterId];
  const kopf = v ? HEAD_TEXTE[v.head.id] : undefined;
  if (!v || !beispiel || !kopf) return [];
  return agentAbschnitte({ tut: v.vorlage.rolle, nie: `${kopf.nie} Er delegiert nie weiter.`, beispiel });
}

/** Ob der Katalog den Head kennt — für Wächter und Aufrufer. */
export const headBekannt = (id: string): boolean => !!headDef(id);
