// ─── Erklärungen · Fulfillment — Prozesse, Fall, Onboarding, Wert, Wirkung (Paket C1, 10.10.) ───────────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 10: jede Schaltfläche, jede Kennzahl und jede Einstellung von C1 erklärt sich mit einem erfundenen,
// neutralen Fallbeispiel (Wächter tests/erklaerungen.test.ts: jeder Schlüssel wird in der Oberfläche benutzt, Schalter erklären „an“ und „aus“,
// keine Namen). Eingehängt in lib/erklaerungen/index.ts (EINSTELLUNGEN).

import type { EinstellungsText } from './typen';

export const EINSTELLUNGEN_FULFILLMENT_PROZESSE = {
  'fulfillment.landkarte': {
    was: 'Was ihr seht: das ganze Unternehmen als Hochhaus. Das Dach steuert (Ziele, Kennzahlen), die Etagen sind der Weg eines Kunden durch euch — von unten (Marketing) nach oben (Follow-up) —, das Fundament trägt alles (CRM, Recht, Finanzen). Je Etage stehen die Kunden, die gerade dort sind, mit Ampel. Ein Tipp auf einen Kasten öffnet darunter, was dort passiert.',
    beispiel: 'Die Etage „Fulfillment“ zeigt „2 Kunden“ mit gelber Ampel — ein Tipp öffnet die Paket-Vorlagen dieser Etage und die zwei Kunden; einer wartet seit neun Tagen auf eine Freigabe.',
  },
  'fulfillment.vorlageAusMuster': {
    was: 'Legt das neutrale Gerüst an: die Landkarte und drei Paket-Vorlagen mit Phasen und Freigabepunkten, dazu die Rituale und das Playbook-Formular. Inhalte (Texte, Skripte, Preise) kommen später per Import oder Editor dazu.',
    beispiel: 'Nach dem Klick steht „Vertriebsleitung auf Zeit“ mit acht Phasen von Vorlauf bis Übergabe bereit; ein zweiter Klick legt nichts doppelt an.',
  },
  'fulfillment.zuordnung': {
    was: 'Jedes Produkt bekommt genau eine Paket-Vorlage. Startet ein Mandat auf diesem Produkt sein Onboarding, kopiert der Fall die Struktur dieser Vorlage.',
    beispiel: 'Das Produkt „Diagnose“ liefert nach der Vorlage „Vertriebsleitung auf Zeit“ — ein neues Mandat startet damit direkt in Phase „Vorlauf / Onboarding“.',
  },
  'fulfillment.importRechtPruefen': {
    was: 'Ansprache-Texte (Telefon, Mail, Empfehlung, Provisionen) werden beim Import als „vor Einsatz rechtlich prüfen“ markiert. Das ist ein Hinweis, keine Rechtsberatung — erst nach dem Vermerk „geprüft“ gehen sie an Kunden.',
    beispiel: 'Ein importiertes Telefonskript trägt die Marke; nach dem Gespräch mit der Kanzlei vermerkt ihr „geprüft am 14.10. — Einleitung angepasst“.',
  },
  'fulfillment.urheberPruefen': {
    was: 'Material Dritter (gekaufte Playbooks, Seminar-Unterlagen) ist intern frei nutzbar. Bevor es an einen Kunden geht (Kunden-Link, Export, Report), steht eine Rückfrage, bis „vor Verkauf geprüft“ vermerkt ist.',
    beispiel: 'Ein Workbook aus einem gekauften Seminar wurde neu formuliert; nach der Prüfung der Rechte vermerkt ihr „geprüft“, danach erscheint es ohne Rückfrage beim Kunden.',
  },
  'fulfillment.nurIntern': {
    was: 'Ein Baustein „nur intern“ erscheint nie beim Kunden: nicht in der Kunden-Ansicht, nicht im Report, nicht im Wirkungsbericht und in keinem Export. Intern ist er normal nutzbar und sichtbar gekennzeichnet.',
    beispiel: 'Eine Checkliste aus früherem Agentur-Material bleibt euer Werkzeug — der Kunde sieht nur den Schritt, nie die Checkliste.',
    an: 'Der Baustein bleibt intern; „für Kunden sichtbar“ ist automatisch aus.',
    aus: 'Der Baustein kann an Kunden gehen, wenn „für Kunden sichtbar“ an ist.',
  },
  'fulfillment.kundeSichtbar': {
    was: 'Legt fest, ob der Kunde diesen Baustein in seiner Ansicht und im Report sieht. Interne Arbeitsmittel bleiben aus.',
    beispiel: 'Das Kick-off-Protokoll ist für den Kunden sichtbar, die interne Gesprächsvorbereitung nicht.',
    an: 'Der Kunde sieht Titel und Ergebnis dieses Bausteins.',
    aus: 'Der Baustein bleibt intern.',
  },
  'fulfillment.kundeFuellt': {
    was: 'Formulare und Workbooks mit dieser Einstellung füllt der Kunde selbst über seinen Link aus — die Antworten erscheinen intern am Fall.',
    beispiel: 'Das Messe-Workbook „vor der Messe“ füllt der Kunde aus; ihr seht im Fall, dass Abschnitt 2 von 4 fertig ist.',
    an: 'Der Kunde sieht das Formular in seiner Ansicht (sobald der Kunden-Link an ist).',
    aus: 'Nur ihr füllt das Formular aus, zum Beispiel im Gespräch.',
  },
  'fulfillment.ablaufErgaenzung': {
    was: 'Abläufe früherer Vertriebsprozesse sind Wissen, keine zweite Wahrheit — es gilt der heutige Kreislauf. Gestrichelt ist alles, was nicht aus der Quelle stammt, sondern ergänzt wurde; Bögen sind Rückwege, kleine Rundpfeile Schleifen.',
    beispiel: 'Im Telefon-Zyklus ist die Weiche „erreicht?“ aus der Quelle (durchgezogen), die Wiedervorlage nach drei Versuchen ergänzt (gestrichelt).',
  },
  'fulfillment.fortschritt': {
    was: 'Der Fortschritt zählt die erledigten Einzelschritte und Bausteine eines Falls; „entfällt“ zählt nicht mit. Hat ein Fall noch keine Einzelschritte, zählen seine untersten Schritte.',
    beispiel: 'Von 20 Einzelschritten sind 8 erledigt und 2 entfallen — der Fall steht bei 44 % (8 von 18).',
  },
  'fulfillment.wartetAufEuch': {
    was: '„Wartet auf euch“ sammelt, was beim Kunden liegt: Schritte im Status „wartet auf Kunde“ und offene Entscheidungen, die der Kunde trifft. Der älteste Punkt steht oben und geht in den Report.',
    beispiel: 'Der Zugang zum CRM wartet seit 9 Tagen — im Cockpit steht er unter „Was hängt“, im nächsten Report unter „Wartet auf euch“.',
  },
  'fulfillment.wertKonto': {
    was: 'Das Wert-Konto ist das gemeinsame Zielbild des Kunden: Ausgangslage, Zielwert und Datum, im Kick-off festgelegt. Jeder Report zeigt vorher, jetzt und Ziel. Es ist keine Garantie und es gibt kein Erfolgshonorar; Messwerte tragt nur ihr ein.',
    beispiel: 'Qualifizierte Termine je Monat: vorher 4, Ziel 12 bis Ende März; die Messung im Wochen-Check ergibt 7 — das steht auch gleich am Mandat.',
  },
  'fulfillment.quickWins': {
    was: 'Quick Wins sind drei schnelle, sichtbare Erfolge mit Frist innerhalb der ersten 30 Tage — aus der Diagnose übernommen oder von Hand angelegt.',
    beispiel: 'Pipeline-Stufen einheitlich benennen, bis Tag 14 — erledigt am Tag 11, im Wirkungsbericht steht er unter „Erledigte Quick Wins“.',
  },
  'fulfillment.befaehigung': {
    was: 'Befähigung misst, ob der Vertrieb ohne uns läuft. Die Kriterien sind eine Vorgabe und je Fall änderbar; am Mandatsende zählt der Anteil der erfüllten.',
    beispiel: 'Zwei Abschlüsse ohne Gründer und vier Wochen Rhythmus ohne uns sind erfüllt, Coverage und Pflichtfelder noch nicht — 2 von 4.',
  },
  'fulfillment.willkommen24h': {
    was: 'Innerhalb von 24 Stunden nach der Unterschrift geht die Willkommensmail raus: Dank, drei Terminvorschläge fürs Kick-off und der Link zum Playbook. Gesendet wird erst mit eurem Klick, aus eurem Postfach.',
    beispiel: 'Das Angebot wurde am Montag um 16 Uhr angenommen; die Uhr läuft bis Dienstag 16 Uhr und färbt sich danach rot.',
  },
  'fulfillment.einstellungWillkommen': {
    was: 'Wie viele Stunden nach der Unterschrift die Willkommensmail spätestens raus sein soll. Danach steht sie im Cockpit unter „Was hängt“.',
    beispiel: 'Mit 24 Stunden wird eine Unterschrift vom Freitagabend am Samstagabend rot; mit 72 Stunden erst am Montagabend.',
  },
  'fulfillment.freigabe': {
    was: 'Ein Freigabepunkt ist ein Halt, an dem der Kunde und ihr bestätigen. Vermerkt werden Tag, wer intern und wie der Kunde bestätigt hat; damit ist die Phase abgeschlossen. Die nächste Phase darf schon beginnen, dann erscheint ein Hinweis.',
    beispiel: 'F3 Diagnose-Abnahme: im Steering bestätigt, Notiz „Top-5 Maßnahmen angenommen, Maßnahme 4 später“.',
  },
  'fulfillment.vorlageDiff': {
    was: 'Der Fall arbeitet mit einer Kopie der Vorlage. Ändert ihr die Vorlage für künftige Kunden, zeigt der Fall, was neu oder geändert ist. „Übernehmen“ fügt hinzu und ändert — erledigte Schritte werden nie entfernt.',
    beispiel: 'Die Vorlage bekam den Schritt „Einwandmatrix testen“ — der laufende Fall zeigt „Fassung 3 → 4: 1 neu“ und nimmt ihn per Klick auf.',
  },
  'fulfillment.vereinbarung': {
    was: 'Die Zusammenarbeits-Vereinbarung hält Rollen, Reaktionszeiten, was wir brauchen, Eskalation, Scope und Entscheidungsrechte fest — bestätigt im Kick-off.',
    beispiel: 'Reaktionszeit 24 Stunden an Werktagen, Freigaben trifft die Geschäftsführung, Recruiting ist nicht im Scope.',
  },
  'fulfillment.stakeholder': {
    was: 'Die Stakeholder-Karte zeigt, wer beim Kunden entscheidet, unterstützt oder skeptisch ist. Personen kommen nur aus der Kartei; Haltung und Notiz sind intern und werden 12 Monate nach Mandatsende gelöscht.',
    beispiel: 'Die Geschäftsführerin entscheidet (Einfluss 3, positiv), der Vertriebsleiter ist skeptisch — im Kick-off bekommt er die Fragen zu Kennzahlen.',
  },
  'fulfillment.rituale': {
    was: 'Rituale geben den Takt: Kick-off, Wochen-Check, Steering, Quartals-Review — und auf Wunsch ein tägliches Huddle mit Zahlenrunde. „Termin anlegen“ öffnet den Kalender-Dialog, vorbelegt mit Titel, Dauer und Bezug zum Mandat; Gäste werden erst nach eurer Rückfrage eingeladen.',
    beispiel: 'Der Wochen-Check dauert 15 Minuten; im Dialog wählt ihr „wöchentlich“, danach steht der nächste Termin im Cockpit.',
  },
  'fulfillment.mitschrift': {
    was: 'Die Mitschrift hat vier Zeilen: Anlass, Ergebnis, nächster Schritt, Frist — ohne Freitext über Personen. Daraus wird per Klick ein Eintrag im Entscheidungs-Log oder eine Aufgabe.',
    beispiel: 'Anlass Wochen-Check · Ergebnis Skript Stufe 2 freigegeben · nächster Schritt Rollout im Team · Frist Freitag.',
  },
  'fulfillment.wirkung': {
    was: 'Der Wirkungsbericht schließt den Kreis: Wert-Konto vorher und nachher, erledigte Quick Wins, was geliefert wurde und wie weit der Vertrieb ohne uns läuft. Ein Kundenzitat steht nur mit vermerkter Einwilligung darin. Versendet wird per Klick über die Inbox.',
    beispiel: 'Termine je Monat von 4 auf 11, drei Quick Wins, Übergabe-Paket geliefert, 3 von 4 Befähigungs-Kriterien — daraus entsteht auf Wunsch eine anonyme Fallstudie.',
  },
  'fulfillment.nachsorge': {
    was: 'Nach dem Mandatsende legt der Morgenlauf an drei Tagen je einen Vorschlag in den Stapel: Check-in, Empfehlung erfragen, nächste Stufe anbieten. Erst eure Freigabe macht daraus ein Follow-up.',
    beispiel: 'Mandatsende am 1. März: Check-in am 15. März, Empfehlung am 15. April, nächste Stufe Ende Mai.',
  },
  'fulfillment.entscheidungGeteilt': {
    was: 'Eine geteilte Entscheidung steht in der Ansicht des Kunden und im Report — mit Titel, Status und Frist. Interne Abwägungen bleiben ungeteilt.',
    beispiel: '„Zielgruppe zuerst Handwerksbetriebe“ ist geteilt; „Preis für Stufe 2 noch offen“ bleibt intern.',
    an: 'Der Kunde sieht die Entscheidung in seiner Ansicht und im nächsten Report.',
    aus: 'Die Entscheidung bleibt im Team; der Kunde sieht sie nicht.',
  },
  'fulfillment.cockpit': {
    was: 'Das Cockpit zeigt je laufendem Fall Phase, Fortschritt, Health, Puls und nächsten Termin — und zuerst, was hängt: überfällige Willkommensmails und Freigaben, lange Wartezeiten beim Kunden, schlechter Puls, alter Report.',
    beispiel: 'Oben steht rot „Willkommensmail überfällig“ beim neuen Kunden, darunter gelb „Letzter Report vor 17 Tagen“ bei einem laufenden Fall.',
  },
  'fulfillment.kennzahl.willkommen': {
    was: 'Anteil der Fälle, deren Willkommensmail innerhalb der eingestellten Stunden nach der Unterschrift gesendet wurde. Gezählt werden Fälle, deren Frist schon abgelaufen ist oder deren Mail raus ist.',
    beispiel: 'Von fünf Fällen kam die Mail viermal rechtzeitig — 80 %.',
  },
  'fulfillment.kennzahl.kickoff': {
    was: 'Median der Tage von der Unterschrift bis zum Kick-off. Als Kick-off gilt die Mitschrift des Kick-off-Rituals oder eine Bestätigung „im Kick-off“.',
    beispiel: 'Kick-offs nach 6, 9 und 12 Tagen ergeben einen Median von 9 Tagen.',
  },
  'fulfillment.kennzahl.wertkonto': {
    was: 'Anteil der Fälle, deren Wert-Konto spätestens sieben Tage nach dem Kick-off vollständig festgelegt war.',
    beispiel: 'Zwei von drei Fällen hatten Ausgang, Ziel und Datum rechtzeitig — 67 %.',
  },
  'fulfillment.kennzahl.quickwin': {
    was: 'Anteil der Fälle, die mindestens einen Quick Win innerhalb von 30 Tagen nach dem Start erledigt haben.',
    beispiel: 'Drei Fälle laufen länger als 30 Tage, zwei hatten bis dahin einen erledigten Quick Win — 67 %.',
  },
  'fulfillment.kennzahl.reporttakt': {
    was: 'Anteil der laufenden Fälle, deren letzter Report höchstens 14 Tage alt ist.',
    beispiel: 'Vier laufende Fälle, einer ohne Report seit drei Wochen — 75 %.',
  },
  'fulfillment.kennzahl.wartet': {
    was: 'Der älteste offene Punkt „wartet auf euch“ über alle laufenden Fälle, in Tagen.',
    beispiel: 'Eine Freigabe liegt seit 12 Tagen beim Kunden — die Kennzahl zeigt 12 Tage.',
  },
  'fulfillment.kennzahl.puls': {
    was: 'Durchschnitt des letzten Kunden-Pulses je Fall (0 bis 10) aus den letzten 90 Tagen.',
    beispiel: 'Pulse von 8, 9 und 6 ergeben 7,7 von 10.',
  },
  'fulfillment.kennzahl.befaehigung': {
    was: 'Anteil der erfüllten Befähigungs-Kriterien „läuft ohne uns“ in abgeschlossenen Fällen.',
    beispiel: 'Zwei abgeschlossene Fälle mit je vier Kriterien, sechs davon erfüllt — 75 %.',
  },
  'fulfillment.kennzahl.dossier': {
    was: 'Anteil der Dossier-Aussagen mit Quelle und Datum, Ziel 100 %. Die Zahl kommt aus der Prüfung der Analyse eines Falls.',
    beispiel: 'Von 40 Aussagen haben 40 eine Quelle — 100 %; eine Aussage ohne Quelle wandert in die offenen Fragen.',
  },
  'fulfillment.kennzahl.kosten': {
    was: 'Durchschnittliche Kosten der Analyse-Läufe je Dossier in Euro — jeder Lauf wird einzeln bestätigt.',
    beispiel: 'Zwei Dossiers mit 6,40 und 9,10 Euro ergeben 7,75 Euro je Dossier.',
  },
  'fulfillment.reise': {
    was: 'Was ihr seht: die Reise des Kunden durch die Phasen des Pakets. Jeder Abschnitt ist eine Phase, gefüllt so weit, wie ihre Schritte erledigt sind; „Sie sind hier“ markiert die laufende Phase. Die Rauten sind Freigaben — Haltepunkte, an denen der Kunde (oder ihr) bestätigt, bevor es weitergeht. Darunter steht, was als Nächstes kommt und ob etwas hängt.',
    beispiel: 'Phase 3 von 8 „Diagnose“ ist zur Hälfte gefüllt, die Raute F3 „Diagnose-Abnahme“ ist noch offen. Als Nächstes steht „Diagnosebericht“, und „1 wartet auf den Kunden“ zeigt die offene Entscheidung.',
  },
  'fulfillment.ablaufPhasen': {
    was: 'Der Ablauf zeigt jede Phase als Zeile mit Stand und Freigabe. Die laufende Phase ist aufgeklappt — mit ihren nächsten Schritten; erledigte Phasen sind zu und öffnen sich mit einem Tipp. Bausteine hängen als Chip am Schritt. Mehr (Zusatz-Schritt, zurücknehmen) steht hinter „⋯“.',
    beispiel: 'In „Aufbau“ stehen „Skripte“ und „Einwände“ offen, „Prozess“ ist abgehakt; der Chip „Leitfaden Erstgespräch“ öffnet den Baustein. Am Ende der Phase wartet die Freigabe F4.',
  },
  'fulfillment.lage': {
    was: 'Die Lage aller Kunden in Lieferung in drei Antworten: wie viele laufen, was gerade hängt und welcher Handgriff als Nächstes am meisten bringt. Ein Tipp springt an die Stelle.',
    beispiel: '„3 Kunden in Lieferung, 1 im Onboarding“ · „2 hängen — Willkommensmail überfällig“ · „Als Nächstes: Willkommensmail an den neuen Kunden“.',
  },
  'fulfillment.kundenKarten': {
    was: 'Je Kunde eine Karte: Ampel, Phase als Mini-Strahl, Fortschritt, das Wert-Konto als Balken von „vorher“ bis „Ziel“, der nächste Schritt und was auf euch wartet. Oben steht, wer zuerst Aufmerksamkeit braucht.',
    beispiel: 'Ganz oben die rote Karte des neuen Kunden (Willkommensmail überfällig), darunter der laufende Kunde in Phase 3 mit 63 % des Wegs im Wert-Konto.',
  },
  'fulfillment.paketKarten': {
    was: 'Jede Paket-Vorlage als Karte: ihre Phasen als Mini-Strahl mit den Freigabe-Punkten, wie viele Schritte und Bausteine darin stecken, welches Produkt sie liefert und wie viele Kunden gerade darin laufen.',
    beispiel: 'Die Karte „Sales-Systematik“ zeigt sechs Phasen, 54 Schritte, 18 Bausteine, liefert das Produkt „Cockpit-Lizenz“ — ein Kunde läuft gerade darin.',
  },
  'fulfillment.ebenen': {
    was: 'Prozesse haben fünf Ebenen: Gesamt (das Paket) › Prozess (Phase) › Teilprozess › Schritt › Baustein (das Werkzeug, z. B. ein Skript). Die Leiter zeigt, auf welcher Ebene ihr gerade seid; die Brotkrumen führen zurück.',
    beispiel: '„Vertriebsleitung auf Zeit › Aufbau › Skripte › Leitfaden schreiben › Leitfaden Erstgespräch“ — ganz unten der Baustein, den der Schritt benutzt.',
  },
  'fulfillment.bibliothek': {
    was: 'Die Bibliothek zeigt jeden Baustein als Karte mit seiner Art (Skript, Mail, Checkliste …), wo er steckt und seinen Marken. Filter nach Art, Paket und Phase grenzen ein; die Marken zeigen, was vor dem Einsatz beim Kunden geprüft werden muss.',
    beispiel: 'Filter „Paket: Netzwerk-Vertrieb“ und „Phase: Messen & Events“ zeigt vier Bausteine; einer trägt „vor Einsatz rechtlich prüfen“.',
  },
  'fulfillment.onboardingBand': {
    was: 'Die acht Onboarding-Schritte als Band: grün erledigt, gelb offen, rot überfällig, grau „darf noch laufen“. Darunter stehen nur die offenen Schritte, jeder mit dem Weg dorthin, wo er erledigt wird. Erledigte klappen weg.',
    beispiel: 'Fünf Abschnitte sind grün, „Kick-off terminieren“ ist gelb und führt in den Takt, die Willkommensmail ist rot, weil die 24 Stunden um sind.',
  },
  'fulfillment.wellen': {
    was: 'Die Analyse läuft in vier Wellen: Start, Unternehmen, Vertiefung, Synthese und Prüfung. Jede Marke ist ein Agent — grün heißt im Dossier, gelb Entwurf zum Prüfen, blau läuft, gestrichelt noch gesperrt. Nichts startet von selbst; der Knopf schlägt den nächsten sinnvollen Lauf mit seinen Kosten vor.',
    beispiel: 'Welle 0 ist grün, in Welle 1 sind A1 und A7 grün, A2 ist bereit — der Knopf heißt „A2 starten“ mit der geschätzten Summe dahinter.',
  },
} as const satisfies Record<string, EinstellungsText>;
