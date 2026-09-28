# Aufgaben-Management: die 100 typischen Fehler — Prüfliste (28.09.2026)

**Stand:** 28.09.2026 · **Zweck:** Prüfliste für das Aufgaben-Management von MAKE OS. Es besteht aus Spaces (Privat, eigene Firmen, Mandanten) → Projekte → Gruppen → Listen → Aufgaben → Unteraufgaben. Dazu kommen Status, Fristen, Zuständige, Prioritäten, Kommentare mit @, Benachrichtigungen, eigene Felder, Abhängigkeiten, Serien, Vorlagen, Dateien, Notizen, Verlauf, Zeiterfassung, die Ansichten Liste/Board/Tabelle/Kalender, ZOE mit Freigabe und die CRM-Verknüpfung. Technik: Next.js, JSON-Bestände mit Sperren, Stand/409, Europe/Berlin. Es geht um Bau-Fehler von Entwicklern, nicht um Fehler bei der Nutzung.
**Format je Punkt:** #Nr · Kategorie · **Fehler** · *Folge:* für die Nutzer · *Prüfen:* Gegenmaßnahme bzw. woran man es erkennt · *Quelle*. „(ergänzt)“ heißt: eigene Übertragung auf MAKE OS, nur der Kern ist belegt oder es gibt keine direkte Quelle.
**Hinweis:** Die Liste stammt aus einer Web-Recherche und ist noch nicht gegen den Code geprüft. Rechtliche Punkte geben den Recherche-Stand wieder und sind keine Rechtsberatung.

---

## 1 · Datenmodell & Hierarchie (8)

**#1 · Hierarchie** · **Verschieben ohne Zyklusprüfung.** Eine Aufgabe oder Liste lässt sich unter einen eigenen Nachfahren hängen. *Folge:* Rekursive Anzeige und Rollups hängen, ganze Zweige verschwinden. *Prüfen:* Vor jedem Verschieben die Vorfahrenkette des Ziels serverseitig prüfen. Testfall: gleichzeitig „A unter B“ und „B unter A“. *Quelle:* https://martin.kleppmann.com/2021/10/07/crdt-tree-move-operation.html · https://martin.kleppmann.com/papers/move-op.pdf

**#2 · Hierarchie** · **Waisen.** Eltern-Liste oder -Projekt ist gelöscht, die Kinder zeigen auf eine ID, die es nicht mehr gibt. *Folge:* Die Aufgaben sind unsichtbar, zählen aber in Zahlen und Suche mit. *Prüfen:* Ein Integritätslauf löst alle `parentId/listId/projectId/spaceId` auf. Fundstellen gehen in einen „Fundbüro“-Bereich statt verloren. *Quelle:* https://brandur.org/soft-deletion

**#3 · Hierarchie** · **Doppelte Zeiger ohne gemeinsame Aktualisierung.** Die Eltern führen eine Kind-Liste, die Kinder zusätzlich eine `parentId`. *Folge:* Eine Aufgabe steht in zwei Listen oder nirgends. *Prüfen:* Eine Wahrheit (`parentId` plus Sortschlüssel). Falls beides nötig ist: nur zusammen in einem gesperrten Schreibvorgang. *Quelle:* https://www.notion.com/blog/data-model-behind-notion

**#4 · Hierarchie** · **Verschieben zwischen Spaces ohne Neuberechnung des Geerbten** (Sichtbarkeit, Status-Satz, eigene Felder, Mandantenbezug). *Folge:* Eine private Aufgabe wird im Mandanten-Space sichtbar, oder sie hat einen Status bzw. ein Feld, das die Zielliste nicht kennt. *Prüfen:* Der Verschieben-Dialog ordnet Status und Felder zu und zeigt die Sichtbarkeit ausdrücklich an. Test über alle Space-Arten. *Quelle:* https://www.notion.com/blog/data-model-behind-notion (Rechte erben über den Parent-Zeiger)

**#5 · Hierarchie** · **Unbegrenzte oder uneinheitliche Verschachtelungstiefe.** *Folge:* Ab Tiefe 4–5 brechen Oberfläche, Rollups und Mobilansicht. Rekursion auf dem Server wird teuer. *Prüfen:* Eine maximale Tiefe festlegen und serverseitig erzwingen. Test mit 10 Ebenen. (ergänzt)

**#6 · Löschen** · **Kaskadenlöschung ohne Umfangsangabe; „in den Papierkorb“ und „endgültig löschen“ laufen über denselben Pfad.** *Folge:* Ein Klick löscht ein Projekt mit Hunderten Aufgaben, Kommentaren und Dateien. *Prüfen:* Der Dialog nennt die Anzahl. Standard ist der Papierkorb. Endgültiges Löschen ist ein getrennter Codepfad. *Quelle:* https://www.atlassian.com/blog/atlassian-engineering/post-incident-review-april-2022-outage

**#7 · Löschen** · **Papierkorb ohne Frist oder Wiederherstellen ins Nichts** (die Eltern sind inzwischen ebenfalls gelöscht). *Folge:* Wiederhergestellte Aufgaben sind unerreichbar, oder Daten liegen ewig herum (DSGVO-Speicherbegrenzung). *Prüfen:* Das Wiederherstellen holt die Kette zurück oder fragt nach dem Ziel. Feste Frist, z. B. 30 Tage, danach endgültig löschen inkl. Dateien. *Quelle:* https://www.notion.com/help/duplicate-delete-and-restore-content

**#8 · Datenmodell** · **Eine Aufgabe kann nur an einem Ort leben, Querbezüge entstehen per Kopie.** *Folge:* Die Kopie im Mandanten-Projekt und die in „Privat/Heute“ laufen auseinander, eine wird erledigt, die andere nicht. *Prüfen:* Mehrfachzugehörigkeit bzw. Verweis statt Kopie. In der Duplizieren-Funktion klar zwischen „Kopie“ und „Verknüpfen“ trennen. *Quelle:* https://help.asana.com/s/article/multi-home-tasks-to-avoid-information-silos?language=en_US

## 2 · Status & Workflow (5)

**#9 · Status** · **Eigene Status ohne feste Kategorie** (offen / in Arbeit / erledigt / abgebrochen). *Folge:* „Erledigt“-Zähler, Überfällig-Filter, Fortschritt und Serien-Auslöser rechnen falsch. *Prüfen:* Jeder eigene Status gehört Pflicht zu einer Kategorie. Die Logik fragt nur die Kategorie ab, nie den Namen. *Quelle:* https://support.atlassian.com/jira-cloud-administration/docs/what-is-a-workflow-status/

**#10 · Status** · **Status werden über den Anzeigenamen referenziert oder lassen sich löschen, obwohl Aufgaben sie tragen.** *Folge:* Aufgaben fallen aus den Board-Spalten und haben einen ungültigen Status. *Prüfen:* Status-ID statt Name. Löschen nur mit Pflicht-Zielstatus für die betroffenen Aufgaben. *Quelle:* https://apps.obss.tech/blog/jira-statuses-categories-custom-workflows (ergänzt)

**#11 · Status** · **„Abgebrochen/Verworfen“ zählt als „Erledigt“.** *Folge:* Die Erledigungsquote ist geschönt, abhängige Aufgaben gelten fälschlich als freigegeben. *Prüfen:* Eigene Kategorie „abgebrochen“ mit festgelegtem Verhalten für Abhängigkeiten und Serien. *Quelle:* https://community.atlassian.com/forums/Jira-questions/Help-needed-Jira-Status-Workflow-Question-Multiple-quot-Done/qaq-p/2606662

**#12 · Status** · **`completedAt` wird beim Wiedereröffnen nicht zurückgesetzt oder beim erneuten Erledigen überschrieben; Statuswechsel sind über mehrere Codestellen verteilt.** *Folge:* „Diese Woche erledigt“ ist falsch, Serien erzeugen doppelte Folgeinstanzen. *Prüfen:* Eine zentrale Übergangsfunktion setzt alle Nebenfelder. Test: offen→erledigt→offen→erledigt. (ergänzt)

**#13 · Status** · **Statuswechsel ohne Historie** (von, nach, wann, wer bzw. ZOE). *Folge:* Keine Durchlaufzeit, keine Antwort auf „seit wann liegt das auf Warten?“. *Prüfen:* Jeder Übergang als unveränderliches Ereignis mit Akteur-Typ. *Quelle:* https://apps.obss.tech/blog/jira-statuses-categories-custom-workflows (ergänzt)

## 3 · Datum, Zeit, Zeitzonen, Fälligkeit (9)

**#14 · Datum** · **Fälligkeit ohne Uhrzeit wird als Zeitstempel gespeichert** (`new Date("2026-10-01")` ist UTC-Mitternacht). *Folge:* Die Frist rutscht je nach Zeitzone einen Tag. *Prüfen:* Datum als reiner String `YYYY-MM-DD` (Temporal.PlainDate) und Uhrzeit getrennt. Kein `toISOString()` auf reinen Daten. *Quelle:* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal · https://dev.to/zachgoll/a-complete-guide-to-javascript-dates-and-why-your-date-is-off-by-1-day-fi1

**#15 · Datum** · **Ganztag und Uhrzeit teilen sich ein Feld.** *Folge:* Eine Ganztagsaufgabe ist ab 00:00 bzw. 00:01 „überfällig“, Erinnerungen kommen nachts. *Prüfen:* Eigener Typ (Ganztag vs. Uhrzeit). Ganztag gilt erst ab dem Folgetag als überfällig. *Quelle:* https://www.todoist.com/help/articles/introduction-to-dates-and-time-q7VobO

**#16 · Zeitzone** · **„Heute“, „Überfällig“ und „Diese Woche“ werden in der Server-Zeitzone berechnet** (Hetzner = UTC). *Folge:* Zwischen 0 und 1 bzw. 2 Uhr zeigt die Heute-Liste den falschen Tag. *Prüfen:* `Europe/Berlin` überall ausdrücklich setzen. Tests mit `TZ=UTC` und künstlicher Uhrzeit 00:30. *Quelle:* https://zainrizvi.io/blog/falsehoods-programmers-believe-about-time-zones/

**#17 · Zeitzone** · **Zukünftige Termine nur als UTC-Zeitpunkt, ohne Zeitzonen-ID.** *Folge:* Ändern sich Sommerzeit oder Zeitzonenregeln, steht der Termin eine Stunde daneben. *Prüfen:* Lokale Zeit plus `Europe/Berlin` speichern und UTC daraus ableiten. *Quelle:* https://codeblog.jonskeet.uk/2019/03/27/storing-utc-is-not-a-silver-bullet/

**#18 · DST** · **Nicht existierende bzw. doppelte Ortszeiten bei der Zeitumstellung** (29.03.2026 02:30 gibt es nicht, 25.10.2026 02:30 gibt es zweimal). *Folge:* Die Erinnerung fällt aus oder kommt doppelt. *Prüfen:* Die Regel nach RFC 5545 umsetzen (Lücke: Offset vor der Lücke). Tests für beide Umstellungstage. *Quelle:* https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.5

**#19 · DST** · **Erinnerungs- und Serien-Jobs per Cron in lokaler Zeit.** *Folge:* Beim Umstellen laufen sie doppelt oder gar nicht, es gibt doppelte Aufgaben und Mails. *Prüfen:* Planen auf UTC-Zeitpunkte aus lokaler Zeit plus Zeitzone. Idempotenzschlüssel je Auslösung. *Quelle:* https://dev.to/libme/your-nightly-job-ran-twice-on-the-dst-switch-making-scheduled-jobs-timezone-safe-32hn

**#20 · Uhr** · **„Jetzt“ kommt aus der Client-Uhr** (Handy mit falscher Zeit, Browser in anderer Zeitzone). *Folge:* Aufgaben erscheinen falsch überfällig, `completedAt` und Verlauf sind falsch. *Prüfen:* Zeitstempel für Schreibvorgänge setzt der Server. Die Client-Zeit dient nur der Anzeige. *Quelle:* https://dev.to/andystanly/the-last-write-wins-clock-was-wrong-and-i-wrote-it-5128

**#21 · Datum** · **Mehrdeutige Eingaben** („nächsten Freitag“ am Freitag, „nächste Woche“, US-Format 03/04) und Wochenbeginn Sonntag. *Folge:* Fristen landen eine Woche daneben. *Prüfen:* Das erkannte Datum wird vor dem Speichern immer ausgeschrieben angezeigt (Wochentag + Datum). de-DE, Woche ab Montag, ISO-Kalenderwoche. *Quelle:* https://www.todoist.com/help/articles/introduction-to-dates-and-time-q7VobO (ergänzt)

**#22 · Datum** · **„In 3 Werktagen“ ignoriert Feiertage des Bundeslands; Start nach Fälligkeit ist erlaubt.** *Folge:* Fristen fallen auf Feiertage, die Zeitachse hat negative Dauern. *Prüfen:* Feiertagskalender je Bundesland konfigurierbar. Invariante `start ≤ due` serverseitig prüfen. *Quelle:* https://arbeitsrechner.com/arbeitstage-rechner · https://help.clickup.com/hc/en-us/articles/6304547785367-Rescheduling-dependencies

## 4 · Wiederholungen (10)

**#23 · RRULE** · **Monatsende: Eine Serie am 31. wird im Februar auf den 28. gekürzt und bleibt danach dort hängen.** Oder sie lässt Monate aus, ohne dass der Nutzer das merkt. *Folge:* „Monatsabschluss“ läuft auf den 28. und kommt nicht mehr zurück, oder ein Monat fehlt. *Prüfen:* „Letzter Tag im Monat“ als eigene Option (`BYMONTHDAY=-1`). Tests ab 31.01., 29.02. und 30.03. RFC 5545 lässt ungültige Daten weg. *Quelle:* https://icalendar.org/iCalendar-RFC-5545/3-8-5-3-recurrence-rule.html · https://github.com/ggaabe/rrule-temporal/issues/140

**#24 · Serie** · **Die nächste Instanz berechnet sich nur ab Fälligkeit oder nur ab Erledigung, ohne Wahl.** *Folge:* Der Rhythmus driftet (Friseur „4 Wochen nach letztem Mal“) oder ist starr, wo er sich anpassen soll (Miete). *Prüfen:* Beide Modi anbieten (Todoist: `every` vs. `every!`) und in der Aufgabe sichtbar machen. *Quelle:* https://www.todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV

**#25 · Serie** · **Lawine: Eine überfällige Serie erzeugt beim Nachholen alle verpassten Instanzen.** *Folge:* 30× „Blumen gießen“ – die Liste wird unbrauchbar und man ignoriert sie. *Prüfen:* Beim Erledigen auf das nächste zukünftige Datum springen. Höchstens eine offene Instanz je Serie. Nachholen nur ausdrücklich. *Quelle:* https://www.todoist.com/help/todoist/features/complete-a-task-with-a-recurring-date-dmI6SVqdP

**#26 · Serie** · **Instanzen entstehen ohne Eindeutigkeitsschlüssel** (Doppelklick auf „erledigt“, doppelter Job-Lauf, zwei Geräte). *Folge:* Doppelte Folgeaufgaben. *Prüfen:* Eindeutiger Schlüssel `serieId + Instanzdatum`. Die Erzeugung ist idempotent. *Quelle:* https://developer.todoist.com/api/v1/ (Befehls-UUID, keine Doppelausführung)

**#27 · Serie** · **„Ganze Serie ändern“ überschreibt die Einzelausnahmen.** *Folge:* Einzeln verschobene Termine springen still zurück. *Prüfen:* Ausnahmen (`RECURRENCE-ID`) bleiben erhalten, sonst eine ausdrückliche Warnung mit Anzahl. *Quelle:* https://learn.microsoft.com/en-us/answers/questions/4571681/how-to-update-recurring-meeting-in-outlook-without

**#28 · Serie** · **„Diese und alle folgenden“ ändert `DTSTART` der Gesamtserie, statt die Serie zu teilen.** *Folge:* Die Vergangenheit wird umgeschrieben, erledigte Instanzen und Zeiten zeigen falsche Daten. *Prüfen:* Teilen: alte Serie `UNTIL` = Tag davor, neue Serie ab dem gewählten Termin, Verweis zwischen beiden. *Quelle:* https://developers.google.com/workspace/calendar/api/guides/recurringevents

**#29 · Serie** · **„Nur diese löschen“ ohne `EXDATE`.** *Folge:* Die gelöschte Instanz kommt bei der nächsten Neuberechnung zurück. *Prüfen:* Ausnahmedaten an der Serie speichern. Test: löschen → Serie neu berechnen → Instanz bleibt weg. *Quelle:* https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.5.1

**#30 · Serie** · **Die Serie wird in UTC ausgerechnet statt in Europe/Berlin.** *Folge:* Nach der Umstellung steht jede Instanz eine Stunde verschoben („09:00“ wird 10:00). *Prüfen:* Instanzen in lokaler Zeit plus Zeitzonen-ID erzeugen. Test über den 25.10. hinweg. *Quelle:* https://github.com/jens-maus/node-ical/issues/97 · https://github.com/mantisbt-plugins/Calendar/issues/104

**#31 · Serie** · **Das Serienende (`COUNT`/`UNTIL`) wird falsch gezählt** (UNTIL exklusiv statt inklusiv, anderer Typ als der Start, vorzeitig erledigte Instanzen nicht mitgezählt). *Folge:* Eine Instanz zu viel oder zu wenig, z. B. bei der 12. Rate. *Prüfen:* RFC-Regeln umsetzen (UNTIL inklusiv, gleicher Typ wie `DTSTART`). Grenzfall-Tests. *Quelle:* https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.10

**#32 · Serie** · **Unklar, was die Folgeinstanz erbt** (Unteraufgaben erledigt übernommen, Altkommentare und Anhänge kopiert). Wechselnde Zuständigkeit (Kevin/Malin im Wechsel) ist nicht abbildbar. Wiederkehrende Listen sind nur Kopien ohne Bezug zur Serie. *Folge:* Die nächste Instanz startet „fertig“ oder bleibt immer bei derselben Person hängen. Änderungen an der Vorlage kommen nicht an. *Prüfen:* Eine ausdrückliche Vererbungstabelle (zurücksetzen / kopieren / nicht kopieren). Rotation als Serien-Eigenschaft. Serienbezug `seriesId` an jeder Instanz. (ergänzt)

## 5 · Abhängigkeiten (4)

**#33 · Abhängigkeit** · **Keine Zykluserkennung** (A blockiert B blockiert A, auch über Unteraufgaben). *Folge:* Beide sind für immer blockiert, das automatische Terminschieben läuft in eine Endlosschleife. *Prüfen:* Tiefensuche vor dem Speichern mit Fehlermeldung, die den Zyklus benennt. *Quelle:* https://help.clickup.com/hc/en-us/articles/6309155073303-Intro-to-Dependency-Relationships (ergänzt)

**#34 · Abhängigkeit** · **Automatisches Nachschieben ohne Vorschau und ohne feste Termine.** *Folge:* 20 Fristen verschieben sich still, darunter externe Termine wie Finanzamt oder Gericht. *Prüfen:* Vorschau „diese n Aufgaben verschieben sich“, gesperrte Fristen werden nie geschoben. *Quelle:* https://help.clickup.com/hc/en-us/articles/6304547785367-Rescheduling-dependencies

**#35 · Abhängigkeit** · **Abhängigkeit auf eine gelöschte oder abgebrochene Aufgabe.** *Folge:* Die Aufgabe bleibt für immer „blockiert“ und niemand weiß warum. *Prüfen:* Beim Löschen oder Abbrechen die Beziehungen anzeigen und auflösen. Integritätslauf. (ergänzt)

**#36 · Abhängigkeit** · **„Blockiert“ wird nur angezeigt, nicht ausgewertet.** *Folge:* Heute-Liste und ZOE schlagen Aufgaben vor, die noch gar nicht machbar sind. *Prüfen:* Blockierte Aufgaben aus „Als Nächstes“ herausfiltern oder markieren. Test. (ergänzt)

## 6 · Zuweisung & Mehrpersonen (4)

**#37 · Zuweisung** · **Mehrere Zuständige ohne Hauptverantwortliche.** *Folge:* Jeder denkt, der andere macht es – im Zwei-Personen-Haushalt der Klassiker. *Prüfen:* Genau eine verantwortliche Person, dazu optional Beteiligte. Aufteilen über Unteraufgaben. *Quelle:* https://asana.com/resources/why-one-assignee

**#38 · Zuweisung** · **„Meine Aufgaben“ übersieht mir zugewiesene Unteraufgaben bzw. Checklistenpunkte; nicht zugewiesene Aufgaben tauchen in keiner Ansicht auf.** *Folge:* Vergessene Arbeit, eine „Niemandsland“-Liste. *Prüfen:* „Meine Aufgaben“ über alle Ebenen. Ansicht „ohne Zuständige“. Test mit Unteraufgaben in Tiefe 3. (ergänzt)

**#39 · Privatsphäre** · **Keine Sichtbarkeit „nur ich“ auf Aufgabenebene, oder sie wird nur in der Liste beachtet.** *Folge:* Überraschungen (Geschenk, Arzttermin) tauchen beim Partner in Suche, Benachrichtigungen, Verlauf, Kalender oder ZOE-Antworten auf. *Prüfen:* Die Sichtbarkeitsprüfung liegt serverseitig in einem gemeinsamen Filter für alle Lesepfade. Test je Pfad. (ergänzt)

**#40 · Zuweisung** · **Zuständige als Namens-String statt als Personen-ID.** *Folge:* Umbenennen oder Tippfehler brechen Filter und Benachrichtigungen. *Prüfen:* Nur IDs speichern, den Namen bei der Anzeige nachschlagen. (ergänzt)

## 7 · Benachrichtigungen & Erwähnungen (6)

**#41 · Benachrichtigung** · **Jede Feldänderung löst eine Benachrichtigung aus.** *Folge:* Man ist schnell ermüdet und schaltet alles ab – dann geht auch das Wichtige unter. *Prüfen:* Nur bei Zuweisung, @, Frist heute bzw. überfällig und Blockade gelöst. Alles andere nur im Verlauf. *Quelle:* https://www.courier.com/blog/how-to-reduce-notification-fatigue-7-proven-product-strategies-for-saas

**#42 · Benachrichtigung** · **Keine Bündelung und kein Digest.** *Folge:* 15 Einzelmeldungen für eine Umsortier-Aktion. *Prüfen:* Bündeln je Aufgabe bzw. Empfänger in einem Zeitfenster, Tageszusammenfassung wählbar. *Quelle:* https://knock.app/blog/building-a-batched-notification-engine

**#43 · Benachrichtigung** · **Man wird über eigene Handlungen benachrichtigt, ZOE-Änderungen laufen unter dem Namen der freigebenden Person, es gibt keine Ruhezeiten.** *Folge:* Rauschen, falsche Urheberschaft, Push um 02:00. *Prüfen:* Akteur ausschließen. Akteur-Typ „ZOE (freigegeben von …)“. Nicht-stören-Zeiten je Person. *Quelle:* https://www.courier.com/blog/slack-notifications-flowchart-strategy

**#44 · Erwähnung** · **Die @-Erwähnung feuert beim Bearbeiten des Kommentars erneut, feuert gar nicht, oder erwähnt jemanden ohne Zugriff.** *Folge:* Doppelte Meldungen, oder der Inhalt einer privaten bzw. Mandanten-Aufgabe gelangt per Mail oder Push an die falsche Person. *Prüfen:* Nur neu hinzugekommene Erwähnungen benachrichtigen. Zugriff vor dem Versand prüfen, im Zweifel ohne Inhalt. (ergänzt)

**#45 · Benachrichtigung** · **Die Meldung zeigt einen veralteten Zustand oder verlinkt ins Leere** (Aufgabe inzwischen erledigt, gelöscht oder verschoben). *Folge:* Man arbeitet an Erledigtem, oder der Link endet im 404. *Prüfen:* Beim Öffnen den aktuellen Zustand anzeigen, Weiterleitung nach dem Verschieben, Hinweis „inzwischen erledigt“. (ergänzt)

**#46 · Benachrichtigung** · **Doppelte Zustellung durch Wiederholungsversuche.** *Folge:* Zwei Pushes, zwei Mails, Vertrauensverlust. *Prüfen:* Idempotenzschlüssel je Ereignis und Empfänger. *Quelle:* https://developer.todoist.com/api/v1/

## 8 · Nebenläufigkeit, Sync & Konflikte (7)

**#47 · Konflikt** · **Lost Update: Gespeichert wird das ganze Objekt aus dem Formularzustand.** *Folge:* Malin ändert die Frist, Kevin kurz danach den Titel – Malins Frist ist still weg. *Prüfen:* Feldweise Patches mit Stand/Version, 409 bei echtem Konflikt auf demselben Feld. *Quelle:* https://vladmihalcea.com/a-beginners-guide-to-database-locking-and-the-lost-update-phenomena/ · https://www.fujimon.com/blog/linear-sync-engine

**#48 · Konflikt** · **409 ohne Auflösung in der Oberfläche.** *Folge:* Die Eingabe ist weg oder der Fehler wird verschluckt. *Prüfen:* Konfliktdialog „deins / aktuell / beides“, der Entwurf bleibt erhalten. *Quelle:* https://dev.to/subraatakumar/your-offline-first-app-can-lose-correct-data-without-showing-any-error-1bm4

**#49 · Sync** · **Optimistische Anzeige ohne Rücknahme bei Serverfehler.** *Folge:* Die Oberfläche zeigt „erledigt“, auf dem Server ist die Aufgabe offen – bis zum Neuladen. *Prüfen:* Ausstehende Änderungen sichtbar, bei Ablehnung zurückrollen mit Meldung. *Quelle:* https://linear.app/now/scaling-the-linear-sync-engine · https://github.com/wzhudev/reverse-linear-sync-engine

**#50 · Sync** · **Last-Write-Wins nach Client-Uhr.** *Folge:* Das Gerät mit der vorgehenden Uhr gewinnt immer, auch mit der älteren Änderung. *Prüfen:* Reihenfolge vom Server (Version bzw. Sequenz), keine Geräte-Zeitstempel. *Quelle:* https://dev.to/andystanly/the-last-write-wins-clock-was-wrong-and-i-wrote-it-5128 · https://jaredforsyth.com/posts/hybrid-logical-clocks/

**#51 · Sync** · **Verschieben als „löschen + neu einfügen“.** *Folge:* Zwei gleichzeitige Verschiebungen derselben Aufgabe ergeben ein Duplikat oder verlieren Kommentare, Verlauf und ID. *Prüfen:* Eigene Move-Operation, die ID bleibt stabil. *Quelle:* https://martin.kleppmann.com/2020/04/27/papoc-list-move.html

**#52 · Sync** · **Langtext (Beschreibung, Notiz) wird ganz überschrieben.** *Folge:* Parallel geschriebene Absätze gehen verloren. *Prüfen:* Mindestens Konflikterkennung mit Diff-Anzeige, ggf. CRDT nur für Langtext (so macht es Linear). *Quelle:* https://www.fujimon.com/blog/linear-sync-engine

**#53 · Speicher** · **JSON-Bestand: nicht-atomares Schreiben, Sperre nur um das Schreiben, kaputte Datei wird als leer gelesen und überschrieben.** *Folge:* Totalverlust aller Aufgaben eines Bestands. *Prüfen:* Lesen, Ändern und Schreiben in einer Sperre. Temp-Datei, fsync, rename. Parse-Fehler bedeutet Quarantäne statt `[]`. *Quelle:* https://github.com/npm/write-file-atomic · https://github.com/moxystudio/node-proper-lockfile

## 9 · Sortierung & Reihenfolge (4)

**#54 · Sortierung** · **Ganzzahl-Positionen: Jedes Ziehen nummeriert alle Geschwister neu.** *Folge:* Viele Schreibvorgänge, ständige 409, Reihenfolge springt. *Prüfen:* Fraktionale Schlüssel, ein Schreibvorgang pro Verschiebung. *Quelle:* https://www.figma.com/blog/realtime-editing-of-ordered-sequences/

**#55 · Sortierung** · **Fraktionale Schlüssel als Float.** *Folge:* Nach etwa 50 Einfügungen an derselben Stelle ist die Genauigkeit erschöpft, Positionen kollidieren. *Prüfen:* String-Schlüssel mit beliebiger Genauigkeit (fractional-indexing), Vergleich byteweise statt mit `localeCompare`. *Quelle:* https://www.figma.com/blog/realtime-editing-of-ordered-sequences/ · https://github.com/MichaelOstermann/fractional-indexing

**#56 · Sortierung** · **Gleiche Schlüssel bei gleichzeitigem Einfügen, ohne Tie-Breaker.** *Folge:* Nicht-deterministische Reihenfolge, Board-Karten tauschen bei jedem Laden die Plätze. *Prüfen:* Sortieren nach (Schlüssel, ID). Zufallsanteil oder Geräte-ID im Schlüssel. *Quelle:* https://madebyevan.com/algos/crdt-fractional-indexing/ · https://liveblocks.io/blog/how-crdts-and-sync-engines-keep-realtime-lists-ordered-with-fractional-indexing

**#57 · Sortierung** · **Schlüssel wachsen unbegrenzt, und es wird in einer automatisch sortierten Ansicht gezogen** (z. B. nach Frist). *Folge:* Aufgeblähte Daten. Die abgelegte Karte springt zurück, der Nutzer denkt, es sei kaputt. *Prüfen:* Gelegentlich neu durchnummerieren. Ziehen nur in manueller Sortierung erlauben oder beim Ziehen auf manuell umschalten, mit Hinweis. *Quelle:* https://www.bartoszsypytkowski.com/scaling-fractional-indexes/ (ergänzt)

## 10 · Suche & Filter (3)

**#58 · Suche** · **Keine Normalisierung** (ä/ae, ß/ss, NFC/NFD aus macOS-Importen, Groß/Klein). *Folge:* „Müller-Steuer“ wird nicht gefunden, die Aufgabe gilt als verloren. *Prüfen:* Index und Suchbegriff mit `normalize('NFC')`, Umlaut-Faltung, Kleinschreibung. *Quelle:* https://symbolfyi.com/guides/unicode-normalization-guide/

**#59 · Suche** · **Suche und Filter umgehen Papierkorb, Privat-Markierung oder Space-Rechte.** *Folge:* Gelöschtes oder Privates des Partners taucht in Treffern oder Zählern auf. *Prüfen:* Dieselbe serverseitige Sichtbarkeitsfunktion wie in #39 auf jedem Lesepfad. Test mit privater Aufgabe. *Quelle:* https://brandur.org/soft-deletion

**#60 · Filter** · **Unklare Behandlung leerer Werte und gespeicherte Filter über Namen statt IDs.** *Folge:* „Priorität ≠ hoch“ verschluckt Aufgaben ohne Priorität, gespeicherte Ansichten sind nach einer Umbenennung leer. *Prüfen:* Leere Werte ausdrücklich regeln („ist leer“). Filter speichern IDs. (ergänzt)

## 11 · Ansichten & Drag & Drop (5)

**#61 · DnD** · **Ziehen ist der einzige Weg zum Verschieben, Umsortieren oder Status-Ändern.** *Folge:* Mit Trackpad, Zittern oder einer Hand auf dem Handy nicht bedienbar. Verstößt gegen WCAG 2.2 AA. *Prüfen:* Zu jeder Ziehaktion eine Klick-Alternative („Verschieben nach…“, Status-Menü, Pfeiltasten). *Quelle:* https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html

**#62 · DnD** · **Keine Tastaturbedienung und keine Screenreader-Ansage beim Ziehen.** *Folge:* Ausschluss von Tastatur-Nutzern, keine Rückmeldung, wo das Element gelandet ist. *Prüfen:* Keyboard-Sensor (Leertaste/Pfeile/Leertaste), Live-Region mit „aufgenommen / über Spalte X / abgelegt an Position n“. *Quelle:* https://docs.dndkit.com/guides/accessibility · https://medium.com/salesforce-ux/4-major-patterns-for-accessible-drag-and-drop-1d43f64ebf09

**#63 · Board** · **Ablegen in einer Spalte ändert nur die Anzeige oder das falsche Feld** (Board nach Zuständigen gruppiert, das Ablegen setzt aber den Status). Übergangsregeln werden umgangen. *Folge:* Stille Fehländerungen. *Prüfen:* Das Ablegen setzt genau das Gruppierungsfeld über dieselbe Übergangsfunktion wie #12. Test je Gruppierung. (ergänzt)

**#64 · Kalender** · **Ganztägig oder mehrtägig falsch: Ende inklusiv statt exklusiv, Aufgaben ohne Datum sind unsichtbar.** *Folge:* Aufgaben um einen Tag verlängert oder verkürzt, iCal-Export fehlerhaft. Undatierte Aufgaben „verschwinden“. *Prüfen:* `DTEND;VALUE=DATE` = Folgetag. Seitenleiste „ohne Datum“ zum Hineinziehen bzw. Zuweisen. *Quelle:* https://github.com/ChalidNL/todoless/issues/13 · https://datatracker.ietf.org/doc/html/rfc5545#section-3.6.1

**#65 · Tabelle** · **Inline-Bearbeitung speichert bei jedem Tastendruck oder beim Tab-Wechsel ohne Bestätigung.** *Folge:* Viele Versionen, 409-Stürme, halbe Werte im Verlauf. *Prüfen:* Speichern bei Blur/Enter, Entprellung, pro Zelle ein Patch. (ergänzt)

## 12 · Unteraufgaben & Fortschritt (3)

**#66 · Unteraufgabe** · **Die Elternaufgabe lässt sich trotz offener Unteraufgaben still erledigen, oder das Erledigen reißt still alle Kinder mit.** *Folge:* Vergessene Teilschritte oder ungewollt abgehakte Arbeit. *Prüfen:* Dialog „3 offene Unteraufgaben: mit erledigen / offen lassen / abbrechen“. (ergänzt)

**#67 · Fortschritt** · **Fortschritt zählt nur direkte Kinder, abgebrochene Aufgaben zählen als offen bzw. erledigt, Rollups werden bei jedem Lesen rekursiv neu berechnet.** *Folge:* Falsche Prozente, langsame Listen. *Prüfen:* Rechenregel festlegen (Tiefe, Abgebrochene ausgenommen). Rollup zwischenspeichern und bei Änderung aktualisieren. (ergänzt)

**#68 · Unteraufgabe** · **Die Frist der Unteraufgabe darf nach der Frist der Elternaufgabe liegen, und beim Verschieben der Eltern bleiben die Kinder stehen.** *Folge:* Unmöglicher Plan. *Prüfen:* Warnung und optionales Mitverschieben (Offset erhalten). *Quelle:* https://help.clickup.com/hc/en-us/articles/6304547785367-Rescheduling-dependencies (Remap Subtask Due Dates)

## 13 · Vorlagen (2)

**#69 · Vorlage** · **Beim Anlegen aus einer Vorlage werden IDs flach kopiert.** Abhängigkeiten, Unteraufgaben und Verweise zeigen weiter auf die Vorlagen-Aufgaben. *Folge:* Das neue Projekt „erledigt“ Dinge in der Vorlage oder ist falsch verknüpft. *Prüfen:* Zuordnungstabelle alt→neu für alle Beziehungen. Test: Vorlage mit Abhängigkeitskette. (ergänzt)

**#70 · Vorlage** · **Relative Fristen werden nicht vom gewählten Startdatum (Werktage/Feiertage) berechnet; die Vorlage ist nicht versioniert.** *Folge:* Alle Fristen liegen am Anlagetag oder auf einem Sonntag. Eine Änderung an der Vorlage ändert laufende Projekte, oder niemand weiß, welche Version benutzt wurde. *Prüfen:* Offsets („Start+5 WT“) beim Anlegen auflösen. `templateVersion` an der Instanz. *Quelle:* https://help.clickup.com/hc/en-us/articles/6304547785367-Rescheduling-dependencies (ergänzt)

## 14 · Dateien & Anhänge (3)

**#71 · Upload** · **Dem Content-Type vertraut, kein Größenlimit, Dateiname geht in den Pfad.** *Folge:* Schadcode, Path Traversal, volle Platte auf dem kleinen Server. *Prüfen:* Allowlist nach Magic Bytes, Limit, zufälliger Speichername, Ablage außerhalb von `public/`. *Quelle:* https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

**#72 · Upload** · **Dateien sind über eine erratbare oder dauerhafte URL ohne Rechteprüfung erreichbar.** *Folge:* Mandanten-Unterlagen oder private Scans sind öffentlich abrufbar. *Prüfen:* Auslieferung nur über eine Route mit Sitzungs- und Rechteprüfung, sonst kurzlebige signierte Links. *Quelle:* https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

**#73 · Upload** · **Dateien bleiben nach endgültigem Löschen als Waisen liegen oder fehlen im Backup.** *Folge:* DSGVO-Löschung unvollständig. Nach einer Wiederherstellung sind Aufgaben da, die Anhänge weg. *Prüfen:* Speicher-Abgleich (Referenz ↔ Datei). Backup umfasst Dateien, Wiederherstellung einmal getestet. *Quelle:* https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/ (ergänzt)

## 15 · Kommentare, Verlauf, Audit (3)

**#74 · Verlauf** · **Verlauf ohne Akteur-Typ** (Mensch / ZOE / Automatik / Import / Serie) und ohne alt→neu. *Folge:* Nicht nachvollziehbar, wer oder was eine Frist verschoben hat. Die KI-Freigabe lässt sich nicht prüfen. *Prüfen:* Jeder Eintrag enthält `actorType`, `actorId`, `approvedBy`, Feld, alt, neu, Zeit. *Quelle:* https://appmaster.io/blog/audit-logging-internal-tools-activity-feed

**#75 · Kommentar** · **XSS über Markdown/HTML in Kommentaren, Notizen oder Aufgabentiteln** (`dangerouslySetInnerHTML`). *Folge:* Fremdcode läuft in der Sitzung – besonders heikel bei importierten oder per Mail bzw. KI erzeugten Inhalten. *Prüfen:* Serverseitiger Sanitizer (Allowlist), kein rohes HTML, Links mit `rel="noopener"`. *Quelle:* https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

**#76 · Verlauf** · **Kommentare lassen sich unmarkiert bearbeiten oder löschen; der Verlauf speichert Vollkopien des Objekts.** *Folge:* Geänderte Absprachen sind nicht belegbar, die JSON-Datei wächst unkontrolliert. *Prüfen:* Markierung „bearbeitet“ mit Vorversion, Verlauf nur als Diff, Rotation bzw. Archiv. (ergänzt)

## 16 · Berechtigungen & Datenschutz (4)

**#77 · Rechte** · **API-Routen bzw. Server Actions ohne Objekt-Rechteprüfung** (IDOR über `taskId`). *Folge:* Wer eingeloggt ist, liest oder ändert jede Aufgabe inkl. Mandanten und Privat. *Prüfen:* Jede Route prüft Besitz bzw. Sichtbarkeit des konkreten Objekts. Test mit fremder ID. *Quelle:* https://nextjs.org/docs/app/guides/data-security · https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/

**#78 · Rechte** · **Mass Assignment:** `{...task, ...body}` übernimmt auch `ownerId`, `visibility`, `completedAt`, `createdBy`. *Folge:* Rechte und Verlauf lassen sich per Request fälschen. *Prüfen:* Allowlist-Schema (zod) je Endpunkt. *Quelle:* https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/

**#79 · Datenschutz** · **Mandanten-Daten sind nicht getrennt** (in privaten Ansichten, Exporten, KI-Kontext, Kalender-Feed). *Folge:* Verstoß gegen Datenschutz durch Technik (Art. 25) und Vertraulichkeit gegenüber Mandanten. *Prüfen:* Space-Kennzeichen „Mandant“ steuert Sichtbarkeit, Export und KI-Freigabe. *Quelle:* https://dsgvo-gesetz.de/art-25-dsgvo/

**#80 · Datenschutz** · **Kalender-Abo bzw. ICS-Feed über eine ungeschützte oder nicht widerrufbare URL.** *Folge:* Eine weitergeleitete URL gibt dauerhaft alle Termine preis. *Prüfen:* Zufälliges Token je Person, jederzeit neu erzeugbar, nie im Log, ohne Mandanten und Privates standardmäßig. *Quelle:* https://www.usecarly.com/blog/how-to-get-google-calendar-ics-url/ (ergänzt)

## 17 · Import, Export, Backup (3)

**#81 · Export** · **Kein vollständiger Export** (Hierarchie, Serienregeln, Abhängigkeiten, Kommentare, Dateien) in einem offenen Format. *Folge:* Kein Umzug möglich, Auskunft nach Art. 15/20 kaum machbar. *Prüfen:* JSON-Gesamtexport plus ICS für Termine. Import des eigenen Exports als Test. *Quelle:* https://dsgvo-gesetz.de/art-20-dsgvo/

**#82 · Import** · **Beim Import aus Todoist, ClickUp oder Excel gehen Serien, Zeitzonen, Ganztag, Unteraufgaben-Tiefe und Reihenfolge verloren; es gibt keine Import-Charge.** *Folge:* Zerstörte Serien, verrutschte Fristen, kein Rückgängig. *Prüfen:* Vorschau, `importBatchId`, Rückgängig je Charge, Serien nie still in Einzelaufgaben verwandeln. (ergänzt)

**#83 · Backup** · **Backup nie zurückgespielt, liegt am selben Ort, JSON ohne `schemaVersion`.** *Folge:* Im Ernstfall ist die Sicherung unbrauchbar oder passt nicht zum Code. *Prüfen:* Regelmäßiger Wiederherstellungs-Test auf einer Kopie, Sicherung außer Haus, `schemaVersion` plus Migration. *Quelle:* https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/ · https://jsonic.io/guides/json-migrations

## 18 · Performance & Skalierung (3)

**#84 · Performance** · **Lange Listen und Boards ohne Virtualisierung.** *Folge:* Ab einigen Hundert Aufgaben ruckelt Scrollen und Ziehen, besonders auf dem Handy. *Prüfen:* Windowing (react-window/Virtuoso), Zeitmessung mit 2.000 Aufgaben. *Quelle:* https://web.dev/articles/virtualize-long-lists-react-window

**#85 · Performance** · **Der ganze Bestand wird bei jeder Änderung neu geschrieben und bei jeder Anfrage komplett geladen** (samt Verlauf und Kommentaren). *Folge:* Mit der Zeit langsam, lange Sperren, mehr 409. *Prüfen:* Bestände aufteilen (Aufgaben / Verlauf / Kommentare, ggf. je Space), Archiv für Erledigtes, Listen paginieren. *Quelle:* https://www.stacksync.com/blog/keyset-cursors-postgres-pagination-fast-accurate-scalable (ergänzt)

**#86 · Performance** · **Polling in kurzen Abständen aus vielen Komponenten, N+1-Nachladen je Karte** (Zuständige, CRM-Kontakt, Zähler). *Folge:* Hohe Serverlast auf der kleinen Maschine (1 vCPU), träge Oberfläche. *Prüfen:* Anfragen bündeln, ein Änderungszeiger (Stand) statt Voll-Polling, Nachschlagetabellen einmal laden. *Quelle:* https://www.scoutapm.com/blog/understanding-n1-database-queries

## 19 · Barrierefreiheit & UX (3)

**#87 · UX** · **Warnen statt Rückgängig** („Wirklich löschen?“ bei jeder Kleinigkeit). *Folge:* Man klickt die Warnung weg, Fehler bleiben endgültig. *Prüfen:* Rückgängig-Hinweis (Undo) für Löschen, Erledigen und Verschieben. Bestätigung nur bei Unumkehrbarem. *Quelle:* https://alistapart.com/article/neveruseawarning/

**#88 · A11y** · **Status, Priorität oder Überfälligkeit nur über Farbe erkennbar.** *Folge:* Bei Farbschwäche oder in der Sonne nicht lesbar. *Prüfen:* Zusätzlich Text, Symbol oder Muster, Kontrastprüfung. *Quelle:* https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html

**#89 · UX** · **Der Fokus geht nach Aktionen verloren** (Aufgabe anlegen, Dialog schließen, Karte verschieben). Schnelleingabe ohne Tastenkürzel. *Folge:* Langsames Arbeiten, Screenreader-Nutzer verlieren den Faden. *Prüfen:* Den Fokus gezielt zurücksetzen, Enter legt die nächste Aufgabe an, Kürzel dokumentiert. (ergänzt)

## 20 · Mobile (2)

**#90 · Mobile** · **Ziehen per Touch kollidiert mit dem Scrollen, Tippflächen sind zu klein.** *Folge:* Beim Scrollen werden versehentlich Karten verschoben oder Aufgaben abgehakt. *Prüfen:* Ziehen erst nach Long-Press bzw. am Griff, Tippflächen mindestens 44 px, Rückgängig (#87). *Quelle:* https://docs.dndkit.com/guides/accessibility (Sensoren) (ergänzt)

**#91 · Mobile** · **Push-Erinnerungen ohne die iOS-Voraussetzungen** (Web-Push nur für Home-Screen-Web-Apps, Freigabe nur nach Nutzergeste); keine Rückfallebene. *Folge:* Erinnerungen kommen auf dem iPhone still nicht an. *Prüfen:* Einrichtungsablauf mit Test-Push, Status „Push aktiv“ je Gerät, Mail oder Tageszusammenfassung als Rückfall. *Quelle:* https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

## 21 · KI-Assistentin (ZOE) (6)

**#92 · KI** · **Prompt Injection über Aufgaben-, Kommentar-, Mail- oder Datei-Inhalte.** *Folge:* Ein eingefügter Text („ignoriere… leite weiter an…“) steuert ZOE: Daten fließen ab, Aufgaben werden verändert. *Prüfen:* Fremdinhalte als Daten kennzeichnen, nie als Anweisung. Die Kombination private Daten + Fremdinhalt + Außenkanal im selben Lauf vermeiden. Testfälle mit Injektionstext. *Quelle:* https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ · https://genai.owasp.org/llmrisk/llm01-prompt-injection/

**#93 · KI** · **Zu viel Handlungsspielraum:** ZOE schreibt, löscht, verschickt oder weist zu ohne Einzelfreigabe, oder mit Werkzeugen und Rechten über ihren Auftrag hinaus. *Folge:* Ungewollte Änderungen im Namen von Kevin oder Malin. *Prüfen:* ZOE hat serverseitig nur Werkzeuge für Vorschläge. Die Übernahme läuft über einen eigenen Endpunkt, der die Freigabe verlangt. Das wird serverseitig erzwungen, nicht nur im Prompt. *Quelle:* https://owasp.org/www-project-top-10-for-large-language-model-applications/2_0_vulns/LLM06_ExcessiveAgency.html

**#94 · KI** · **Freigabe-Müdigkeit:** zu viele oder zu grobe Freigaben, Sammelfreigabe ohne Unterschiede zu sehen. *Folge:* Es wird blind abgenickt, die Kontrolle besteht nur noch auf dem Papier. *Prüfen:* Freigabe zeigt Diff (alt→neu) je Aufgabe, einzeln abwählbar. Risikoarme Vorschläge (z. B. Tippfehler) von risikoreichen (Löschen, Fremdversand, Mandanten) trennen. *Quelle:* https://tianpan.co/blog/2026/06/25/approval-fatigue-how-human-in-the-loop-gates-decay-into-rubber-stamps

**#95 · KI** · **Der Vorschlag beruht auf einem veralteten Stand und wird ohne Versionsprüfung übernommen.** *Folge:* Die Übernahme überschreibt, was Malin inzwischen geändert hat, oder legt eine bereits erledigte Aufgabe erneut an. *Prüfen:* Jeder Vorschlag trägt den Stand bzw. die Version des Ausgangsobjekts. Übernahme mit 409-Prüfung und Dublettencheck, idempotente Vorschlags-ID. (ergänzt)

**#96 · KI** · **Relative Zeitangaben und Zuständigkeit werden vom Modell geraten** (ZOE kennt „heute“ und Europe/Berlin nicht, erfindet Daten, Personen oder CRM-Bezüge). *Folge:* Fristen am falschen Tag, Aufgaben bei der falschen Person oder am falschen Kontakt. *Prüfen:* Datum und Zeitzone ins Prompt geben. Ausgabe per Schema prüfen (Datum gültig, Person und Kontakt-ID existieren). Unsichere Felder leer lassen statt raten. *Quelle:* https://genai.owasp.org/llmrisk/llm06-sensitive-information-disclosure/ (ergänzt)

**#97 · KI** · **KI-Änderungen ohne Charge und Rückgängig; private bzw. Mandanten-Daten gehen ungefiltert an den KI-Anbieter.** *Folge:* Eine fehlerhafte Sammelübernahme lässt sich nicht zurückdrehen. Datenabfluss ohne Auftragsverarbeitungsvertrag, Drittlandprüfung bzw. Datenschutz-Folgenabschätzung. *Prüfen:* `aiBatchId` im Verlauf, „Charge rückgängig“. Kontextfilter nach Space bzw. Sichtbarkeit vor jedem KI-Aufruf. *Quelle:* https://www.datenschutzkonferenz-online.de/media/oh/20240506_DSK_Orientierungshilfe_KI_und_Datenschutz.pdf

## 22 · Integration mit CRM & Kalender (3)

**#98 · CRM** · **Aufgaben verweisen auf Kontakt-, Firmen-, Mandats- oder Deal-IDs, die nach einer Zusammenführung oder Löschung im CRM nicht mehr existieren.** *Folge:* Die Aufgabe hängt am gelöschten Duplikat und fehlt in der Zeitlinie des echten Kontakts. *Prüfen:* Beim Zusammenführen im CRM auch die Aufgaben-Verweise umhängen. Integritätslauf über beide Bestände. *Quelle:* https://www.glean.com/perspectives/best-practices-for-avoiding-data-inconsistencies-with-ai-in-crm (ergänzt)

**#99 · CRM** · **Follow-ups im CRM und Aufgaben im Aufgaben-Management sind zwei getrennte Objekte ohne gemeinsame Wahrheit.** *Folge:* Doppelte Erinnerungen, oder ein Follow-up gilt im CRM als offen, obwohl die Aufgabe erledigt ist. *Prüfen:* Ein Objekt (Aufgabe mit CRM-Bezug), das CRM zeigt nur an. Erledigen wirkt in beiden Ansichten. (ergänzt)

**#100 · Kalender** · **Zweiwege-Sync mit einem externen Kalender (M365/Google) ohne Herkunftskennung und Sync-Token.** *Folge:* Schleifen und Dubletten (Aufgabe→Termin→Aufgabe), Löschungen kommen nicht an, Zeitzonen verschieben sich. *Prüfen:* Externe ID und Herkunft speichern, inkrementeller Sync mit Token, eine führende Seite je Feld, Löschungen als Ereignis. *Quelle:* https://developers.google.com/workspace/calendar/api/guides/sync (ergänzt)

---

## Die 15 wichtigsten für ein Zwei-Personen-System mit KI-Assistentin (Einschätzung der Recherche)

1. **#53** JSON-Bestand: nicht-atomares Schreiben bzw. kaputte Datei → leer → überschrieben. Totalverlust ist der schlimmste Fall.
2. **#47 / #48** Lost Update zwischen Kevin und Malin und 409 ohne Auflösung – im Zwei-Personen-Betrieb der häufigste stille Datenverlust.
3. **#93** ZOE übernimmt nur über einen serverseitig erzwungenen Freigabe-Endpunkt, nicht über Prompt-Disziplin.
4. **#92** Prompt Injection über Mail-, Kommentar- oder Datei-Inhalte, die ZOE liest.
5. **#95** ZOE-Vorschläge mit Versionsstand und Idempotenz – sonst überschreibt die Übernahme menschliche Änderungen oder erzeugt Dubletten.
6. **#94** Freigabe-Müdigkeit: Diff pro Aufgabe statt Pauschal-OK.
7. **#16 / #14** „Heute/Überfällig“ in Europe/Berlin statt Server-UTC; reines Datum als `YYYY-MM-DD`.
8. **#25 / #26** Serien-Lawine und doppelte Folgeinstanzen.
9. **#23 / #30** Monatsende-Serien und Serien über die Zeitumstellung.
10. **#27 / #28** „Serie ändern“ zerstört Ausnahmen; „diese und folgende“ als echter Split.
11. **#39 / #59 / #79** Sichtbarkeit „nur ich“ und Mandanten-Trennung auf allen Lesepfaden (Suche, Benachrichtigung, Kalender, KI-Kontext).
12. **#6 / #7** Kaskadenlöschung ohne Umfangsangabe; Papierkorb mit Frist und Wiederherstellen samt Kette.
13. **#37** Genau eine verantwortliche Person je Aufgabe (Haushalts-Klassiker „dachte, du machst das“).
14. **#41 / #43** Benachrichtigungen: nur Wichtiges, gebündelt, mit Ruhezeiten, ZOE als eigener Akteur.
15. **#83 / #73** Wiederherstellung einmal wirklich getestet, inklusive Dateien und `schemaVersion`.

Ebenfalls früh prüfen: #1 (Zyklen beim Verschieben), #9 (Status-Kategorien), #61/#62 (Klick-Alternative und Tastatur beim Ziehen), #77 (Objekt-Rechteprüfung).
