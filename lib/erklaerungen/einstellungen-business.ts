// ─── Erklärungen · Agenten, Markttraktion, Finanzplanung, Unternehmen (10.10.) ─────────────────────────────────────────────────
// Beispiele sind erfunden („Beispiel GmbH“, „Mira“) und neutral. Für die Heads und Mitarbeiter selbst (was er tut / nie tut / Beispiel-
// Vorschlag) siehe agenten.ts; für Kennzahlen siehe kennzahlen.ts.

import type { EinstellungsText } from './typen';

export const EINSTELLUNGEN_BUSINESS = {
  // ── Index (Business, Privat, Gesundheit, Markttraktion) ────────────────────────────────────────────────────────────────
  'index.gesamt': {
    was: 'Der Index fasst alle Säulen zu einer Zahl von 0 bis 100 zusammen: je Säule das gewichtete Mittel ihrer gemessenen Kennzahlen, dann das gewichtete Mittel der Säulen. Ab 80 heißt es „Souverän“, ab 60 „Solide“, ab 40 „Verbesserungsfähig“, darunter „Kritisch“. Ohne genug Messungen steht dort „Noch keine Daten“.',
    beispiel: 'Zwei Säulen zählen: Finanzen 70 (Gewicht 50 %) und Personal 50 (Gewicht 30 %), die dritte hat noch keine Messung. Gerechnet wird nur mit den beiden: (70 × 0,5 + 50 × 0,3) ÷ 0,8 ≈ 63 — „Solide“.',
  },
  'index.abdeckung': {
    was: 'Wie viel vom Gewicht des Index auf echt gemessenen Daten beruht, und wie viele Kennzahlen noch eine Messlücke haben. Der Index zählt erst, wenn die Säulen mit Messung mindestens 40 % des Gewichts tragen.',
    beispiel: '„60 % auf echten Daten · 4 Messlücken“ heißt: Die Zahl ist ein guter Hinweis, aber vier Kennzahlen warten noch auf eine Messung — jede Kachel mit „—“ sagt, was fehlt.',
  },

  // ── Einstellungen eines Heads ──────────────────────────────────────────────────────────────────────────────────────────
  'head.modell': {
    was: 'Welches KI-Modell der Head benutzt: „Schnell“ (klein, flink, günstig), „Ausgewogen“ (der Normalfall) oder „Stark“ (gründlicher, braucht länger, kostet mehr). Die Vorgabe steht je Head im Katalog; hier überschreibst du sie.',
    beispiel: 'Der Head of Strategy schreibt den Board-Bericht — „Stark“ lohnt sich. Der Mitarbeiter, der nur die Inbox sortiert, kommt mit „Schnell“ aus.',
    daten: 'Stärkere Modelle kosten mehr Guthaben je Antwort. Die Kosten dieses Monats stehen unter „Budget“.',
  },
  'head.aufwand': {
    was: 'Wie gründlich das Modell nachdenkt: gering, mittel oder hoch. Hoher Aufwand liefert oft bessere Antworten, dauert aber länger und kostet mehr.',
    beispiel: 'Für einen schnellen Tagescheck genügt „gering“. Für ein Monatsreview mit vielen Zahlen stellst du „hoch“ ein.',
    daten: 'Jede Stufe höher bedeutet mehr Rechenzeit — und mehr Kosten je Lauf.',
  },
  'head.autonomie': {
    was: 'Nach außen geht nie etwas ohne deinen Klick. Die Autonomie bestimmt nur, ob der Head interne Kleinigkeiten selbst erledigen darf („Risikoarm selbst“) oder alles als Vorschlag zeigt („Nur Vorschlag“). Je Head kannst du sie nur verschärfen, nie lockern.',
    beispiel: 'Der Head of Sales sieht, dass bei einem Kontakt der nächste Schritt fehlt. Mit „Risikoarm selbst“ trägt er „Angebot nachfassen“ ein. Mit „Nur Vorschlag“ landet derselbe Vorschlag in deinen Freigaben.',
    an: '„Risikoarm selbst“: nur interne Kleinigkeiten (z. B. ein leerer nächster Schritt) — nie Entwürfe, Kampagnen oder Merksätze. Ein Rücknehmen zählt wie eine Ablehnung.',
    aus: '„Nur Vorschlag“: alles wartet auf deinen Klick.',
  },
  'head.budget': {
    was: 'Eine Obergrenze in Euro für die Kosten dieses Heads im Monat. Leer heißt: keine Grenze, es wird nur gemessen. Ist das Budget erreicht, pausiert der Head bis zum Monatsende oder bis du es anhebst.',
    beispiel: 'Du setzt 20 € für den Head of Marketing. Nach 18 € Verbrauch steht daneben „18 € von 20 €“; erreicht er 20 €, wartet er ruhig und meldet das.',
    daten: 'Gemessen werden die Modellaufrufe dieses Heads samt Mitarbeitern.',
  },
  'head.zustaendig': {
    was: 'Welche Person des Haushalts sich um diesen Head kümmert. Hinweise und Vorschläge gehen vorrangig an sie, und bei gemeinsamen Themen verweist der Head auf sie. Die Person kommt aus den Konten.',
    beispiel: 'Mira ist für den Head of Event zuständig. Wenn er nach dem Abend die Danke-Nachrichten vorschlägt, landet der Hinweis bei ihr.',
  },
  'head.aktiv': {
    was: 'Schaltet den Head ganz an oder aus. Aus: Er antwortet nicht und läuft nicht im Takt. Seine Threads, Skills und Merksätze bleiben.',
    beispiel: 'Du brauchst den Head of Event nur vor Veranstaltungen. Außerhalb der Saison schaltest du ihn aus und vermeidest Kosten.',
    an: 'Der Head arbeitet im Takt und im Chat.',
    aus: 'Der Head ruht. Nichts geht verloren — beim Einschalten ist alles wieder da.',
  },
  'head.notaus': {
    was: 'Hält diesen Head sofort an: Laufende Läufe werden abgebrochen, Zeitpläne und neue Aufträge ruhen. Lösen geht jederzeit; angehaltene Läufe startest du von Hand neu.',
    beispiel: 'Ein Head schlägt ungewollt dasselbe mehrfach vor. Du drückst Not-Aus, prüfst den Auftrag und löst ihn erst wieder, wenn der Auftrag stimmt.',
  },
  'head.abschnitt.auftrag': {
    was: 'Dein eigener Auftrag an den Head: Wie soll er arbeiten, worauf soll er achten, was soll er lassen? Er steht bei jeder Antwort im Hintergrund. Die festen Regeln (nur Vorschläge, nichts nach außen ohne Klick) gelten immer darüber.',
    beispiel: '„Wir duzen unsere Kunden. Vorschläge immer mit nächstem Schritt und Datum.“ Danach schreiben Head und Mitarbeiter Entwürfe im Du und nennen ein Datum.',
    daten: 'Der Text geht mit jeder Antwort an die KI — schreibe keine Geheimnisse und keine Namen Dritter hinein.',
  },
  'head.abschnitt.wissen': {
    was: 'Ordner oder Notizen aus eurem Brain, in denen der Head sein Fachwissen findet. Er sucht dort und nennt die Quelle. Private Notizen sieht kein Agent.',
    beispiel: 'Du ordnest dem Head of Sales den Ordner „Sales-Playbook“ zu. Fragt jemand „Wie gehen wir mit Preiseinwänden um?“, antwortet er mit der passenden Notiz als Quelle.',
  },
  'head.abschnitt.unterlagen': {
    was: 'Dateien, die du dem Head bewusst gibst, zum Beispiel Befunde oder Pläne. Sie bleiben in deiner Instanz; er liest sie nur für deine Fragen.',
    beispiel: 'Du lädst einen Trainingsplan als PDF hoch. Der Agent berücksichtigt ihn, wenn du nach der nächsten Einheit fragst.',
  },
  'head.abschnitt.mitarbeiter': {
    was: 'Mitarbeiter sind Spezialisten unter einem Head, jeder mit eigener Aufgabe und eigenen Werkzeugen. Der Head übergibt ihnen Arbeit; sie delegieren nie weiter. Du kannst mit @Name direkt einen Auftrag geben.',
    beispiel: 'Unter dem Head of Sales arbeitet „Nachfassen & Power Hour“. Du schreibst „@Nachfassen Wer ist heute dran?“ — er stellt die Liste zusammen.',
  },
  'head.abschnitt.skills': {
    was: 'Ein Skill ist eine gespeicherte Anleitung für eine wiederkehrende Aufgabe: mit Beispielen, Werkzeugen und Tests. Du rufst ihn mit /name auf oder lässt ihn auf ein Ereignis oder eine Zeit hin laufen.',
    beispiel: 'Der Skill „/wochenreview“ fragt die Zahlen ab, schreibt drei Sätze und legt einen Vorschlag in die Freigaben — jeden Montag um 8 Uhr.',
  },
  'head.abschnitt.gedaechtnis': {
    was: 'Merksätze, die der Head bei jeder Antwort mitliest („Anrufe nie vor 9 Uhr“). Sie gelten für den Head und seine Mitarbeiter. Ein Vorschlag des Agenten wird erst mit deinem Klick zum Merksatz.',
    beispiel: 'Du lehnst einen Vorschlag mit „zu förmlich“ ab. Der Agent schlägt vor, sich „Kunden werden geduzt“ zu merken — du bestätigst.',
  },
  'head.abschnitt.leistung': {
    was: 'Zahlen zur Arbeit des Heads: Annahmequote seiner Vorschläge, Läufe, Kosten je Ergebnis und Erfolg je Skill. Gemessen werden Agenten, nie Menschen.',
    beispiel: 'Annahmequote 80 % heißt: Von zehn Vorschlägen hast du acht angenommen. Sinkt sie, passt der Auftrag oder die Anleitung nicht mehr.',
  },
  'head.abschnitt.einstellungen': {
    was: 'Modell, Aufwand, Autonomie, Budget, zuständige Person, an/aus und Not-Aus dieses Heads. Ändern dürfen volle Mitglieder des Haushalts (bei privaten Heads nur die Person selbst).',
    beispiel: 'Du hebst das Budget des Head of Finance auf 30 € an, weil er im Monatsabschluss mehr Läufe braucht.',
  },

  // ── Dialoge in der Agenten-Werkstatt ───────────────────────────────────────────────────────────────────────────────────
  'agenten.freigabePflicht': {
    was: 'Jede Wirkung dieses Skills geht als Vorschlag in die Freigaben, auch wenn das Werkzeug an sich frei wäre. Lockern geht nie — nur dieser Skill wird strenger.',
    beispiel: 'Ein Skill legt Aufgaben an, ein Werkzeug, das sonst frei ist. Mit Freigabe-Pflicht erscheint jede neue Aufgabe erst als Vorschlag und wird mit deinem Klick angelegt.',
    an: 'Jede Wirkung braucht deinen Klick.',
    aus: 'Der Skill handelt so, wie es das Werkzeug erlaubt — Freigabe-Werkzeuge bleiben trotzdem Vorschläge.',
  },
  'agenten.skill.ausloeser': {
    was: 'Wann der Skill läuft: von Hand (du rufst ihn mit /name auf), nach einem Zeitplan (mit Bestätigung in Klartext) oder bei einem Ereignis. Zeitpläne laufen nur, wenn die Hintergrund-KI erlaubt ist.',
    beispiel: 'Der Skill „Wochenreview“ läuft montags um 8 Uhr. Er liest die Zahlen, schreibt drei Sätze und legt einen Vorschlag in die Freigaben.',
    daten: 'Jeder Lauf ist ein bezahlter KI-Aufruf — Zeitpläne kosten also Guthaben, auch wenn du nicht hinsiehst.',
  },
  'agenten.skill.eingabefelder': {
    was: 'Was der Skill beim Start fragt. Ein Pflichtfeld (Schalter rechts in der Zeile) muss ausgefüllt sein, sonst startet der Skill nicht.',
    beispiel: 'Der Skill „Angebot vorbereiten“ fragt „Kunde“ (Pflicht) und „Hinweise“ (freiwillig). Ohne Kunde startet er nicht.',
  },
  'agenten.skill.ergebnis': {
    was: 'Wohin das Ergebnis geht: als Vorschlag in die Freigaben oder als Thread, den du liest. Die Freigabe-Pflicht darunter macht den Skill strenger, nie lockerer.',
    beispiel: 'Ein Skill, der Aufgaben anlegt, liefert sein Ergebnis „als Vorschlag in die Freigaben“: Jede Aufgabe wartet auf deinen Klick.',
  },
  'agenten.skill.kostengrenze': {
    was: 'Eine Obergrenze in Euro für einen einzelnen Lauf dieses Skills. Leer heißt: keine Grenze für den einzelnen Lauf (das Monatsbudget des Heads gilt trotzdem).',
    beispiel: 'Bei 0,50 € hält ein Lauf an, sobald er so viel gekostet hat. Er steht dann mit einem Grund als Fehler im Thread — so siehst du, dass die Grenze gegriffen hat.',
    daten: 'Schützt vor Ausreißern, etwa wenn ein Skill sehr lange Texte lesen soll.',
  },
  'brain.uebernahme.auftrag': {
    was: 'Übernimmt den Auftragstext aus der Notiz im Brain als Auftrag des Heads. Eigene Aufträge werden nur ersetzt, wenn du es ausdrücklich ankreuzt.',
    beispiel: 'In deiner Notiz „Sales Brain“ steht beschrieben, wie der Vertrieb arbeitet. Du übernimmst sie als Auftrag des Head of Sales.',
    an: 'Der Auftrag aus der Notiz wird zum Auftrag des Heads.',
    aus: 'Der Head behält seinen bisherigen Auftrag.',
  },
  'brain.uebernahme.stufe': {
    was: 'Stellt die Modellstufe des Heads auf den Wert aus der Notiz.',
    beispiel: 'Die Notiz sagt „stark“, der Head läuft heute „ausgewogen“. Du übernimmst — er rechnet danach gründlicher und teurer.',
    an: 'Die Modellstufe wird auf den Wert der Notiz gesetzt.',
    aus: 'Die Stufe bleibt, wie sie heute ist.',
    daten: 'Stärker bedeutet höhere Kosten je Antwort.',
  },
  'brain.uebernahme.mitarbeiter': {
    was: 'Schaltet den Mitarbeiter aus der Notiz ein oder legt ihn neu an.',
    beispiel: 'Die Notiz nennt einen Mitarbeiter „Recherche“. Du hakst ihn an: Er erscheint unter dem Head und kann Aufträge annehmen.',
    an: 'Der Mitarbeiter wird eingeschaltet bzw. neu angelegt.',
    aus: 'Der Mitarbeiter bleibt, wie er ist.',
  },
  'brain.uebernahme.wissen': {
    was: 'Ordnet den genannten Ordner oder die Notiz dem Head als Wissen zu. Private Notizen gehen nie an Agenten.',
    beispiel: 'Du übernimmst den Ordner „Playbooks“. Der Head findet dort künftig sein Fachwissen und nennt die Quelle.',
    an: 'Der Ordner bzw. die Notiz wird dem Head als Wissen zugeordnet.',
    aus: 'Es gibt keine Zuordnung.',
  },

  // ── Markttraktion, Netzwerken, Unternehmen ─────────────────────────────────────────────────────────────────────────────
  'crm.einwilligungMail': {
    was: 'Hält fest, dass die Person ausdrücklich zugestimmt hat, E-Mails von dir zu bekommen — mit dem Wortlaut der Frage und der Antwort. Eine Visitenkarte ersetzt das nicht.',
    beispiel: 'Im Gespräch fragst du: „Darf ich dir unseren Newsletter schicken?“ — „Ja, gern.“ Du trägst genau das als Wortlaut ein. Erst damit wird die Mail-Ampel grün.',
    an: 'Werbliche Mails an diese Person sind zulässig (Newsletter nur mit Double-Opt-in).',
    aus: 'Keine werbliche Mail. Persönliche Antworten auf Anfragen gehen weiter.',
    daten: 'Zeitpunkt, Person und Wortlaut werden unveränderlich festgehalten (Nachweis).',
  },
  'crm.systemereignisse': {
    was: 'Blendet automatische Einträge ein: Stufenwechsel, Übergaben, Systemhinweise. Normal sieht man nur Notizen, Mails, Anrufe, Meetings und Aufgaben.',
    beispiel: 'Du willst wissen, wann ein Deal von „Angebot“ auf „Abschluss“ rückte: Mit „an“ erscheint der Stufenwechsel mit Datum im Verlauf.',
    an: 'Der Verlauf zeigt auch automatische Ereignisse.',
    aus: 'Nur die Dinge, die Menschen getan haben.',
  },
  'netzwerken.gespraech': {
    was: 'Du hast die Person persönlich gesprochen. Nur dann gibt es morgen einen Danke-Entwurf. Ohne Gespräch bekommst du keine Danke-Mail, und beim ersten Kontakt gibst du den Datenschutzhinweis.',
    beispiel: 'Du hast beim Abend jemanden nur die Visitenkarte aus dem Korb gezogen, nicht gesprochen. Du stellst auf „aus“: Es gibt keinen Danke-Entwurf, nur den Hinweis zum Datenschutz.',
    an: 'Morgen liegt ein Danke-Entwurf bereit (nur als Entwurf; du schickst ihn selbst).',
    aus: 'Keine Danke-Mail — Werbung ohne Anlass ist nicht zulässig.',
  },
  'netzwerken.handy': {
    was: 'Legt nach dem Erfassen einen Knopf bereit, mit dem du die Person in die Kontakte deines Handys übernimmst. Die Daten bleiben bis dahin im Browser.',
    beispiel: 'Du tippst „Auch im Handy speichern“ und dann auf den Knopf: Die Karte landet in Apple Kontakte (iCloud). Löschen und Auskunft dazu dort selbst.',
    an: 'Der Kontakt-Knopf liegt auf der Fertig-Seite bereit.',
    aus: 'Der Kontakt bleibt nur in MAKE OS.',
    daten: 'Im Handy liegt der Kontakt danach bei Apple (iCloud), nicht mehr nur bei euch.',
  },
  'unternehmen.stimmrecht': {
    was: 'Ob der Gesellschafter bei Beschlüssen mitstimmt. Beteiligung und Stimmrecht müssen nicht gleich sein.',
    beispiel: 'Eine Investorin hält 10 % ohne Stimmrecht: Sie bekommt ihren Anteil am Gewinn, entscheidet aber bei Beschlüssen nicht mit.',
    an: 'Der Gesellschafter zählt bei Beschlüssen mit.',
    aus: 'Er hält Anteile, stimmt aber nicht mit.',
  },
  // Beschluss-Buch (10.10.): Unternehmen › Beschlüsse & Satzung.
  'unternehmen.beschlussNummer': {
    was: 'Jeder Beschluss bekommt eine laufende Nummer je Gesellschaft und Jahr. Sie vergibt MAKE OS, sobald der Beschluss nicht mehr Entwurf ist, und sie ändert sich nie. Ältere Beschlüsse ohne gespeicherte Nummer werden nur in der Anzeige nach Datum gezählt (mit Sternchen). „PDF“ lädt das Buch zum Drucken.',
    beispiel: 'Im Februar gefasst, ist die Bestellung der Geschäftsführung „Nr. 1/2026“; die Kapitalerhöhung im März wird „Nr. 2/2026“. Ein verworfener Entwurf bekommt nie eine Nummer, ein gelöschter Beschluss hinterlässt eine Lücke.',
  },
  'unternehmen.beschlussStatus': {
    was: 'Wo der Beschluss steht: Entwurf (noch nicht gefasst), gefasst, angemeldet (beim Handelsregister), eingetragen, aufgehoben. Beim Wechsel auf „angemeldet“ bzw. „eingetragen“ trägt MAKE OS den Tag ein, wenn er leer ist.',
    beispiel: 'Die Satzungsänderung ist am 01.03. gefasst und am 10.03. über den Notar angemeldet. Steht sie nach 60 Tagen noch auf „angemeldet“, fragt der Recht-Check nach der Eintragung.',
  },
  'unternehmen.beschlussWirkung': {
    was: 'Ab wann der Beschluss wirkt. Leer heißt: ab dem Beschlusstag. Eine Satzungsänderung wirkt erst mit der Eintragung im Handelsregister — die neue Fassung bekommt dann den Tag der Eintragung als „gültig ab“.',
    beispiel: 'Die Bestellung einer Geschäftsführerin wird am 15.05. gefasst, soll aber erst ab 01.07. gelten: Wirkung ab 01.07. eintragen.',
  },
  'unternehmen.abstimmung': {
    was: 'Wer beteiligt war (Gesellschafter oder Organe dieser Gesellschaft) und wie abgestimmt wurde. Gerechnet wird nach Anteilen zum Zeitpunkt der Abstimmung, stimmrechtslose Anteile zählen nicht; Enthaltungen zählen nicht als abgegeben. Die Mehrheit ist der gesetzliche Regelfall — eure Satzung kann abweichen.',
    beispiel: 'Zwei Gesellschafter mit 15.000 € und 10.000 € Nennbetrag: Ja und Enthaltung ergibt 15.000 € Ja und 0 € Nein — angenommen. Bei einer Satzungsänderung braucht es drei Viertel der abgegebenen Stimmen.',
  },
  'unternehmen.beschlussFolgen': {
    was: 'Was aus einem gefassten Beschluss folgt — als Vorschläge in den Freigaben: Pflichten im Pflichten-Kalender (Handelsregister, Gesellschafterliste, Transparenzregister mit Frist), die neue Fassung von Gegenstand oder Satzung, Cap-Table anpassen. Von selbst nur für Beschlüsse der letzten 90 Tage; nachgetragene ältere nur über „Folgen vorschlagen“. Nichts passiert ohne deinen Klick.',
    beispiel: 'Kapitalerhöhung gefasst: Es kommen „Pflichten anlegen: Kapitalmaßnahme“, „Neue Fassung: Stammkapital“ und „Cap-Table anpassen“ in die Freigaben. Gibst du die Pflichten frei, stehen Notar, Gesellschafterliste und Transparenzregister mit Frist im Kalender.',
  },
  'unternehmen.beschlussImport': {
    was: 'Lädt ein Beschluss- oder Satzungs-PDF in die Unterlagen der Gesellschaft und liest den Text ohne KI: Datum, Art, Titel, Gegenstand, Stammkapital, Sitz — als Vorschlag, jede Fundstelle wörtlich mit Seite. Beteiligte erscheinen nur als Text. Übernommen wird erst mit deinem Klick.',
    beispiel: 'Du lädst die Niederschrift einer Gesellschafterversammlung hoch. Der Vorschlag zeigt „Datum 12.03.2026“ mit dem Satz „Bielefeld, den 12.03.2026“ als Fundstelle; mit „Als Beschluss übernehmen“ füllt sich das Formular, gespeichert wird erst beim Eintragen.',
    daten: 'Die Datei liegt verschlüsselt in der Ablage der Gesellschaft; der Text wird nur auf eurem Server gelesen und an niemanden geschickt.',
  },
  'unternehmen.beschlussVorlage': {
    was: 'Startvorlagen für typische Beschlüsse — neutral, mit Platzhaltern. Gefüllt wird nur, was im Register steht (Firmierung, Sitz, Register, Geschäftsführung, Stammkapital); alles andere bleibt „[…]“. Mustertext, keine Rechtsberatung: vor Verwendung prüfen.',
    beispiel: '„Kapitalerhöhung“ füllt Firma, Sitz und das bisherige Stammkapital ein und legt die Änderung „Stammkapital“ an; den neuen Betrag und den Übernehmer trägst du ein.',
  },
  'unternehmen.fassung': {
    was: 'Gegenstand, Satzung, Stammkapital, Sitz, Geschäftsführung und Firmierung mit Historie: Jede Änderung ist eine neue Fassung mit „gültig ab“ und Verweis auf den Beschluss — nie überschrieben. Eine heute gültige neue Fassung zieht den Steckbrief gleich mit.',
    beispiel: 'Der Gegenstand galt seit der Gründung; die Satzungsänderung wird am 20.04. eingetragen. Neue Fassung ab 20.04. — die alte bleibt in der Historie, „Stand am“ einem Tag davor zeigt weiter den alten Wortlaut.',
  },
  'unternehmen.fassungSteckbrief': {
    was: 'Der gültige Gegenstand des Unternehmens und die gültige Satzungsfassung, wie sie im Beschluss-Buch festgehalten sind. Ist eine Änderung schon beschlossen, aber noch nicht gültig, steht hier „neu ab …“.',
    beispiel: 'Gegenstand „Beratung und Software“, gültig ab 10.01.2023; die beschlossene Erweiterung gilt erst ab der Eintragung und steht bis dahin als „neu ab …“ darunter.',
  },
  'unternehmen.standAm': {
    was: 'Zeigt, was an einem Tag galt: je Merkmal die jüngste Fassung mit „gültig ab“ bis zu diesem Tag. Ohne festgehaltene Fassung steht der Wert aus dem Steckbrief, solange er nicht schon durch eine neuere Fassung ersetzt ist.',
    beispiel: 'Du wählst den 31.12. des Vorjahres und siehst den damaligen Sitz und das damalige Stammkapital — etwa für einen Vertrag, der an diesem Tag geschlossen wurde.',
  },

  // ── Finanzplanung ──────────────────────────────────────────────────────────────────────────────────────────────────────
  'finanzplan.istJanSep': {
    was: 'Blendet die IST-Monate Januar bis September (die bereits abgeschlossenen) in der Tabelle ein oder aus. Sie sind die Historie, auf der der Plan aufbaut.',
    beispiel: 'Du vergleichst nur die kommenden Monate. Du schaltest die Historie aus: Die Tabelle wird schmaler und die Plan-Spalten stehen links.',
    an: 'Die Monate der Historie erscheinen mit den echten Werten.',
    aus: 'Nur der Plan ab dem ersten Planmonat.',
  },
  'finanzplan.nurOhneZuordnung': {
    was: 'Zeigt nur Buchungen, die noch keiner Planzeile zugeordnet sind. Die Zahl in Klammern sagt, wie viele es sind.',
    beispiel: 'Nach dem Kontoauszug-Import stehen 12 Buchungen offen. Mit dem Schalter siehst du nur diese zwölf und ordnest sie zu.',
    an: 'Die Liste ist kurz — nur Offenes.',
    aus: 'Alle Buchungen des Monats.',
  },
  'finanzplan.zuordnungMerken': {
    was: 'Merkt sich die Zuordnung für den Empfänger. Künftige Buchungen desselben Empfängers werden von selbst derselben Planzeile zugeordnet — auch rückwirkend.',
    beispiel: 'Du ordnest „Beispiel Software GmbH“ der Zeile „Software“ zu. Mit Merken landen alle früheren und künftigen Buchungen dort.',
    an: 'Die Regel gilt für alle Buchungen dieses Empfängers (rückwirkend, nicht mit Rückgängig zurückzunehmen).',
    aus: 'Nur diese eine Buchung wird zugeordnet.',
  },
  'finanzplan.darlehenAbloesen': {
    was: 'Legt im Szenario fest, dass ein Partnerdarlehen im Ausstiegsmonat zurückgezahlt wird.',
    beispiel: 'Im Ausstieg fließen 500.000 €. Mit „ablösen“ fließt ein Teil davon als Rückzahlung an den Darlehensgeber, bevor der Rest ausgeschüttet wird.',
    an: 'Das Darlehen wird mit dem Ausstieg zurückgezahlt.',
    aus: 'Das Darlehen läuft weiter wie geplant.',
  },
  'finanzplan.bausteine': {
    was: 'Bausteine sind die Umsätze und Kosten, aus denen der Plan besteht (Produkt, Stelle, Software, Miete). „An“ schaltet einen Baustein in der Rechnung ein oder aus — ohne ihn zu löschen.',
    beispiel: 'Du prüfst, ob eine neue Stelle ab Februar tragbar ist. Du schaltest den Baustein „Stelle Vertrieb“ ein und siehst sofort, wie sich Liquidität und Ergebnis verändern.',
    an: 'Der Baustein zählt im Szenario mit.',
    aus: 'Er bleibt gespeichert, rechnet aber nicht mit.',
  },
  'finanzplan.steuerSchalter': {
    was: 'Ja/Nein-Regeln der Steuerrechnung — zum Beispiel, ob ein Verlust die Steuer der Folgejahre mindert (Verlustvortrag) oder ob Gehälter in die Einkommensteuer einbezogen werden (Progression). „(Vorgabe)“ heißt: noch nicht von dir gesetzt.',
    beispiel: 'Das Jahr 2026 macht 40.000 € Verlust. Mit „Verlust mindert die Folgejahre“ auf ja fließt er in die Steuer von 2027 ein und senkt sie; mit nein bleibt er ohne Wirkung.',
    an: 'Die Regel wird in der Steuerrechnung angewendet (Näherung, keine Steuerberatung).',
    aus: 'Die Rechnung lässt die Regel weg.',
  },
  'finanzplan.steuer': {
    was: 'Welche Steuern für die Gesellschaft berechnet werden und mit welchen Sätzen. Leere Felder gelten als Vorgabe (grauer Wert); eingetragene überlagern sie. Das sind Näherungen — keine Steuerberatung.',
    beispiel: 'Der Gewerbesteuer-Hebesatz deiner Gemeinde weicht von der Vorgabe ab. Du trägst ihn ein; die Rechnung nimmt ihn sofort, „zurücksetzen“ geht auf die Vorgabe.',
  },
  // Nachgezogen bei der Zusammenführung (10.10.): Schalter aus Markttraktion › Planung und Unternehmen › Schild.
  'planung.kanalAktiv': {
    was: 'Ob dieser Leadkanal in der Planung mitrechnet und neue Leads ihm zugeordnet werden.',
    beispiel: 'Eine Messe läuft nur im Frühjahr: Im Sommer schaltest du den Kanal aus, die Wochenziele verteilen sich auf die übrigen Kanäle.',
    an: 'Der Kanal zählt im Rückwärts-Trichter, im Kreislauf und im Scoreboard.',
    aus: 'Der Kanal bleibt mit seiner Geschichte erhalten, rechnet aber nicht mehr mit.',
  },
  'schild.beraten': {
    was: 'Ob die Steuererklärungen der Gesellschaft über ein Steuerbüro laufen — davon hängt die Abgabefrist ab.',
    beispiel: 'Mit Steuerbüro rechnet der Pflichten-Kalender die längere Frist; ohne die reguläre.',
    an: 'Die Fristen für Erklärungen werden mit der verlängerten Frist gerechnet.',
    aus: 'Es gilt die reguläre Abgabefrist.',
  },
  'schild.kreativeHonorare': {
    was: 'Ob die Gesellschaft regelmäßig selbständige Kreative beauftragt (Design, Text, Foto) — das kann eine Abgabe zur Künstlersozialkasse auslösen.',
    beispiel: 'Ihr lasst jeden Monat Grafiken extern gestalten: Der Pflichten-Kalender erinnert an die jährliche Meldung.',
    an: 'Die Meldung zur Künstlersozialkasse steht im Pflichten-Kalender.',
    aus: 'Keine Erinnerung dazu.',
  },
  'schild.marke.inhaber': {
    was: 'Ob die Marke auf die Gesellschaft eingetragen ist (und nicht auf eine Person).',
    beispiel: 'Eine Marke steht noch auf einer Privatperson: Die Ampel zeigt das als Lücke, damit sie übertragen wird.',
    an: 'Gilt als sauber dokumentiert.',
    aus: 'Die Ampel meldet „Inhaber prüfen“.',
  },
  'schild.domain.auto': {
    was: 'Ob sich die Domain beim Anbieter automatisch verlängert.',
    beispiel: 'Ohne automatische Verlängerung erinnert der Kalender rechtzeitig vor dem Ablauf.',
    an: 'Keine Ablauf-Erinnerung nötig, nur ein Hinweis zur Zahlung.',
    aus: 'Vor dem Ablauf kommt eine Erinnerung in Kalender und Glocke.',
  },
  'schild.domain.zweiFaktor': {
    was: 'Ob das Konto beim Domain-Anbieter mit einem zweiten Faktor geschützt ist. Zugangsdaten selbst speichert MAKE OS nie.',
    beispiel: 'Ohne zweiten Faktor könnte jemand mit einem erratenen Passwort die Domain umleiten — die Ampel weist darauf hin.',
    an: 'Gilt als geschützt.',
    aus: 'Die Ampel meldet „zweiten Faktor einrichten“.',
  },
  'schild.domain.zugang': {
    was: 'Ob der Zugang zum Domain-Konto für den Notfall hinterlegt ist (z. B. im Passwort-Manager eurer Firma), damit ihr nicht ausgesperrt seid.',
    beispiel: 'Fällt eine Person aus, kommt die andere trotzdem an die Domain-Einstellungen.',
    an: 'Gilt als abgesichert.',
    aus: 'Die Ampel meldet „Notfallzugang klären“.',
  },
  'schild.domain.inhaber': {
    was: 'Ob die Domain auf die Gesellschaft eingetragen ist (und nicht auf eine Person oder Agentur).',
    beispiel: 'Die Domain läuft noch über eine Agentur: Die Ampel zeigt das, damit sie auf die Gesellschaft umgezogen wird.',
    an: 'Gilt als sauber dokumentiert.',
    aus: 'Die Ampel meldet „Inhaber prüfen“.',
  },
} as const satisfies Record<string, EinstellungsText>;
