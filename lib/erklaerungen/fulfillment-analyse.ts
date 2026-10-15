// ─── Erklärungen · Fulfillment — Analyse-Strecke (C3, 10.10.) ──────────────────────────────────────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 10: je Agent ein `AgentText` (tut · nie · Beispiel) in `FULFILLMENT_AGENT_TEXTE`, dazu `fulfillment.laufBestaetigen`
// (Kosten und Datenweg), `fulfillment.f1`, `fulfillment.f2`, `fulfillment.tiefenbericht` (Google, nur für dich), `fulfillment.personenteil`,
// `fulfillment.loeschfristPersonen` — mit erfundenem, neutralem Fallbeispiel (Wächter tests/erklaerungen.test.ts). Eingehängt in lib/erklaerungen/index.ts.
// Beispiele sind erfunden: eine „Beispiel GmbH“, Funktionen statt Namen, Beträge in Worten.

import type { AgentText, EinstellungsText } from './typen';
import type { AnalyseAgentId } from '@/lib/fulfillment/typen';

export const EINSTELLUNGEN_FULFILLMENT_ANALYSE = {
  'fulfillment.laufBestaetigen': {
    was: 'Jeder Analyse-Lauf startet nur, wenn du genau diesen Lauf mit seiner Kostenschätzung bestätigst. Es gibt keinen Autostart und keinen Knopf für alle; ist ein Lauf fertig, werden abhängige Läufe nur bereit.',
    beispiel: 'Der Steckbrief zeigt „ca. 30 Cent · höchstens 45 Cent“. Du bestätigst, der Lauf liest die Website der Beispiel GmbH und legt einen Entwurf ab, den du abschnittsweise übernimmst.',
    daten: 'Firma, Domain und die gelesenen Seiten gehen über das KI-Tor an das Modell (Kategorien Markttraktion und Web). Die Kosten zählen ins KI-Budget; über dem 1,5-fachen der Bestätigung bricht der Lauf ab.',
  },
  'fulfillment.f1': {
    was: 'Der Abstimmungspunkt „Analyse-Umfang & Personenliste“ legt fest, welche Analysen laufen dürfen und welche Funktionen beruflich recherchiert werden — Funktionen, keine Namen. Ohne ihn und ohne Interessenabwägung bleiben Gesellschafter- und Personen-Analyse gesperrt.',
    beispiel: 'Im Kick-off bestätigt der Kunde: Umfang Steckbrief, Register, Markt, Personen; Funktionen „Geschäftsführung“ und „Vertriebsleitung“. Du trägst das mit Datum und „im Kick-off“ ein.',
  },
  'fulfillment.f2': {
    was: 'Der Abstimmungspunkt „Dossier geprüft“ geht nur mit bestandener Prüfung: Datenschutz- und Quellen-Befunde müssen behoben sein, Qualitäts-Hinweise des Prüfers dürfen mit Grund überstimmt werden. Erst danach gehen Quick Wins, Kick-off-Fragen und Steckbrief-Felder weiter.',
    beispiel: 'Die Prüfung meldet eine Aussage ohne Quelle. Du entfernst sie, prüfst neu, überstimmst einen Qualitäts-Hinweis mit „Zahl stammt aus dem Kick-off“ und vermerkst „Dossier geprüft“.',
  },
  'fulfillment.tiefenbericht': {
    was: 'Der Tiefenbericht ist ein langer Recherche-Bericht über einen Dienst von Google. Er ist nur eine Lesehilfe für dich: er fließt nie in das Dossier, an Agenten, ins Brain oder in die Suche und nur du siehst ihn, mit den Suchvorschlägen des Dienstes.',
    beispiel: 'Du fragst nach dem Markt der Beispiel GmbH, bestätigst rund zwei Euro und liest den Bericht am nächsten Morgen. Eine zweite Person sieht nur, dass es einen Bericht von dir gibt.',
    daten: 'Die Frage geht an Google Vertex (EU-Zugang laut KI-Einstellungen). Der Bericht wird 30 Tage für dich aufbewahrt und dann gelöscht; die Kosten zählen ins KI-Budget.',
  },
  'fulfillment.personenteil': {
    was: 'Der Personenteil liegt getrennt vom Dossier: berufliche Karten zu den Funktionen aus dem vereinbarten Analyse-Umfang, je Angabe mit Quelle und Datum, nur nach Positivliste. Sehen dürfen ihn der Inhaber und Mitglieder mit vollem Zugang; jede Ansicht steht im Lese-Protokoll.',
    beispiel: 'Die Karte „Vertriebsleitung“ zeigt Werdegang und zwei Vorträge mit Quellen. Ein Konto mit „nur Business“ sieht im Dossier nur, dass es eine Karte gibt.',
  },
  'fulfillment.loeschfristPersonen': {
    was: 'Personenkarten werden 90 Tage nach Mandatsende gelöscht (einstellbar in der Löschfristen-Tabelle). Am Dossier bleibt nur der Vermerk mit der Anzahl, ohne Namen. Den Art.-14-Hinweis gibt MAKE als Verantwortlicher spätestens einen Monat nach der Erfassung.',
    beispiel: 'Das Mandat endet am 31. März. Am 29. Juni entfernt der tägliche Lauf beide Karten; das Dossier zeigt „Personenteil gelöscht (2 Karten)“.',
  },
} as const satisfies Record<string, EinstellungsText>;

/** Je Analyse-Agent: was er tut · was er nie tut · ein erfundener Beispiel-Vorschlag. */
export const FULFILLMENT_AGENT_TEXTE: Partial<Record<AnalyseAgentId, AgentText>> = {
  a0: { tut: 'Prüft die Eingaben, legt das Gerüst des Dossiers an und eine Aufgabe für den Registerauszug, wenn er fehlt.', nie: 'Ruft kein Modell auf und liest keine Register-Portale.', beispiel: 'Registerauszug fehlt — Aufgabe „Registerauszug und Gesellschafterliste als PDF ablegen“ angelegt.' },
  ap: { tut: 'Wertet die Antworten des Kunden-Playbooks aus und leitet Hypothesen und Kick-off-Fragen ab.', nie: 'Erfindet keine Antworten, die im Playbook nicht stehen.', beispiel: 'Hypothese: Abschlüsse hängen an einer Person — Frage fürs Kick-off: Wer führt die Erstgespräche?' },
  tb: { tut: 'Startet einen Tiefenbericht als Lesehilfe nur für dich.', nie: 'Gibt den Bericht an Agenten, das Dossier, das Brain oder andere Personen.', beispiel: 'Bericht zum Markt der Beispiel GmbH — nur in deinem Leseteil sichtbar.' },
  a1: { tut: 'Erstellt den Unternehmens-Steckbrief aus Website und Impressum.', nie: 'Nennt Personen mit Namen oder übernimmt unbelegte Werte.', beispiel: 'Sitz Musterstadt, rund 40 Mitarbeitende, drei Leistungsbereiche — je mit Seite und Abrufdatum.' },
  a2: { tut: 'Wertet abgelegte Registerunterlagen aus: Eckdaten und Kennzahlen je Jahr.', nie: 'Übernimmt Geburtsdatum oder Wohnort von Personen.', beispiel: 'Bilanzsumme drei Jahre in Folge gestiegen; Jahresabschluss zuletzt verspätet hinterlegt.' },
  a3: { tut: 'Ordnet Gesellschafter und Beteiligungen aus den Unterlagen.', nie: 'Nennt natürliche Personen mit Namen oder fragt das Transparenzregister ab.', beispiel: 'Eine Holding hält die Mehrheit; Geschäftsführung hält eine Minderheit.' },
  a4: { tut: 'Recherchiert eine Funktion aus dem vereinbarten Analyse-Umfang nur beruflich, mit Identitätsprüfung.', nie: 'Sammelt Privates, Art.-9-Angaben oder liest LinkedIn und XING.', beispiel: 'Vertriebsleitung seit 2022, vorher Key Account in der Branche, zwei Fachvorträge.' },
  a5: { tut: 'Sammelt Presse und Bewertungen als Zeitleiste mit Good und Bad News.', nie: 'Übernimmt Namen Dritter aus Bewertungstexten.', beispiel: 'Auszeichnung als Ausbildungsbetrieb; wiederkehrende Kritik an langen Antwortzeiten.' },
  a6: { tut: 'Baut Marktbild und Wettbewerbsmatrix aus Käufersicht.', nie: 'Stellt Hypothesen als Fakten dar.', beispiel: 'Drei Wettbewerber mit Festpreis-Paketen; Mandant gewinnt vermutlich über Service vor Ort.' },
  a7: { tut: 'Bewertet die Website nach Botschaft, Beweisen, Handlungsaufforderung, Ton und Rechtsminimum.', nie: 'Ändert etwas an der Website oder füllt Formulare aus.', beispiel: 'Kein klarer nächster Schritt auf der Startseite; Referenzen ohne Zahlen.' },
  a8: { tut: 'Prüft Sichtbarkeit: Titel, Themen, Auffindbarkeit.', nie: 'Nutzt Zugänge des Kunden ohne Freigabe.', beispiel: 'Leistungsseiten ohne Beschreibung; zu Kernbegriffen kaum sichtbar.' },
  a9: { tut: 'Wertet öffentliche Firmenkanäle und PR aus.', nie: 'Wertet Profile einzelner Mitarbeitender aus.', beispiel: 'Ein Kanal mit zwei Beiträgen im Monat, kaum Resonanz.' },
  a10: { tut: 'Liest Signale zur Vertriebsaufstellung aus Stellenanzeigen und Website.', nie: 'Bewertet einzelne Personen.', beispiel: 'Zwei offene Stellen im Innendienst — Hypothese: Aufbau eines Setter-Teams.' },
  a11: { tut: 'Bündelt Risiken aus den fertigen Abschnitten zu einem Register.', nie: 'Sammelt Daten natürlicher Personen zur Zahlungsfähigkeit.', beispiel: 'Abhängigkeit von einem Großkunden — Frage fürs Kick-off.' },
  a12: { tut: 'Schreibt Fazit, Hypothesen und den Diagnose-Entwurf mit Top-5 und drei Quick Wins.', nie: 'Fügt etwas hinzu, das nicht in den Abschnitten steht.', beispiel: 'Quick Win: Erstgespräche mit fester Agenda — bis Tag 30.' },
  a13: { tut: 'Prüft Zahlen, Widersprüche, Lücken und Datenschutz und meldet Befunde.', nie: 'Ändert das Dossier selbst.', beispiel: 'Umsatzangabe passt nicht zur Quelle — Befund Qualität.' },
};
