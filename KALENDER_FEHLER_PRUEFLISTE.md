# Kalender-System: die 100 typischen Fehler — Prüfliste (29.09.2026)

Gilt für die MAKE-OS-Bauart: iCloud per CalDAV als Wahrheit, ical.js, Next.js auf Hetzner (1 vCPU), Mac-Zulieferer per AppleScript, zwei Personen, Europe/Berlin, ZOE. Quellen stehen als Kurzverweis in jeder Zeile, die URLs gesammelt am Ende von Teil A. **[unsicher]** heißt: nicht belastbar dokumentiert, per Round-Trip-Test gegen das echte iCloud prüfen.

Wichtig zum Zeitpunkt: Die nächste Zeitumstellung ist am **So 25.10.2026** (03:00 → 02:00 MESZ→MEZ, der Tag hat 25 Stunden). Die EU-Kommission hat die Sommerzeit-Termine bis 2031 festgelegt, die Abschaffung ist nicht in Sicht ([giga][zeitum]). Das ist das natürliche Testdatum für alle Punkte unter A.

---

## A · Zeitzonen, Sommerzeit & Wandzeit

**#1** · Zeitzonen
- **Fehler:** Zukünftige Termine werden als UTC-Zeitpunkt gespeichert statt als Wandzeit + TZID. Dazu wird nach Wandzeit-Strings sortiert statt nach Zeitpunkt.
- **Folge:** Die Serie „Mo 09:00“ steht nach der Umstellung auf 08:00 oder 10:00 (bei MS Graph genau so beobachtet). Am Umstellungstag und bei gemischten Zonen stimmt die Reihenfolge nicht.
- **Prüfen:** Speichermodell = (lokale Zeit, IANA-Zone), der UTC-Wert wird nur abgeleitet. Sortierschlüssel = Zeitpunkt in ms. Test: Serie ab 05.10.2026 über den 25.10.
- **Quelle:** [RFC 5545 §3.3.5][5545], [outlook-mcp #71][graphdst]

**#2** · Zeitzonen
- **Fehler:** Bei der Serien-Expansion bleibt der Offset des ersten Vorkommens für alle Vorkommen stehen (bekannte ical.js-Falle).
- **Folge:** Eine Serie, die im Januar beginnt, liegt ab Ende März um 1 h falsch, betroffen sind alle Vorkommen im Sommerhalbjahr.
- **Prüfen:** Jedes Vorkommen neu in der Zone auflösen. Test: wöchentlich Mo 09:00 ab 05.01.2026, dann muss der 30.03.2026 = 07:00Z sein, nicht 08:00Z.
- **Quelle:** [inkwell #105][inkwell], [ical.js #257][icaljs257]

**#3** · Zeitzonen
- **Fehler:** Die VTIMEZONE wird in ical.js erst nach dem Erzeugen von `ICAL.Event` registriert, oder sie fehlt in der Datei.
- **Folge:** RECURRENCE-ID und DTSTART bleiben „floating“ zwischengespeichert. Ausnahmen passen dann nicht, Serien erscheinen nur einmal oder gar nicht.
- **Prüfen:** Reihenfolge ist Parsen → alle VTIMEZONE registrieren → Event erzeugen. Eine fehlende VTIMEZONE über den IANA-Namen auflösen.
- **Quelle:** [ical.js #455][icaljs455], [Mailspring PR 2877][mailspring]

**#4** · Sommerzeit
- **Fehler:** Nicht existierende Uhrzeit, z. B. 29.03.2026 02:30.
- **Folge:** Der Termin verschwindet, das Programm stürzt ab, oder er landet auf 01:30.
- **Prüfen:** Nach RFC gilt der Offset vor der Lücke, also 03:30 MESZ. Die Oberfläche soll darauf hinweisen.
- **Quelle:** [RFC 5545 §3.3.5][5545]

**#5** · Sommerzeit
- **Fehler:** Doppelte Stunde am 25.10.2026 von 02:00 bis 03:00.
- **Folge:** Falsche Reihenfolge, Erinnerung kommt doppelt oder gar nicht, Dauer ±1 h.
- **Prüfen:** Mehrdeutige Zeiten auf das erste Vorkommen (MESZ) legen. Dauer als Differenz der Zeitpunkte rechnen.
- **Quelle:** [RFC 5545 §3.3.5][5545], [Falsehoods][falsetime]

**#6** · Wandzeit
- **Fehler:** Floating Time (DTSTART ohne Z/TZID) wird in der Zone des Servers (UTC) gelesen.
- **Folge:** Termine aus Importen oder vom Mac stehen 1–2 h falsch.
- **Prüfen:** Floating immer in der Zone der Person (Europe/Berlin) lesen und im Bestand markieren. Selbst nie floating schreiben, außer bei ganztägigen Terminen (DATE).
- **Quelle:** [RFC 5545 §3.3.5][5545]

**#7** · Zeitzonen
- **Fehler:** Die Prozess-Zeitzone fließt ein, über `new Date(y,m,d)`, `getDay()`, `setHours()` oder die Mac-Zone im AppleScript-Zulieferer.
- **Folge:** Zwischen 22 und 24 Uhr stimmen Wochentag und Tag nicht. Lokal funktioniert es, auf Hetzner nicht.
- **Prüfen:** Server fest auf TZ=UTC, jede Rechnung mit expliziter Zone. Die Testsuite zusätzlich mit `TZ=America/Los_Angeles` laufen lassen.
- **Quelle:** [Falsehoods about time][falsetime]

**#8** · Wandzeit
- **Fehler:** JS-Datums-Parsing: `new Date("2026-10-25")` ist UTC-Mitternacht, `"2026-10-25T09:00"` dagegen lokal, und `toISOString().slice(0,10)` liefert den Vortag.
- **Folge:** Tagesfehler, vor allem bei ganztägigen Terminen und Geburtstagen.
- **Prüfen:** Lint-Regel gegen nackte Datums-Strings. Eine Bibliothek mit expliziter Zone verwenden (Luxon, date-fns-tz oder Temporal-Polyfill). Temporal ist nativ in neueren Browsern, in Node 22 ohne Flag nicht **[unsicher]**.
- **Quelle:** [MDN Date.parse][mdndate], [MDN Temporal][temporal]

**#9** · tzdata
- **Fehler:** Veraltete oder uneinheitliche Zeitzonendaten (Node-ICU, Browser, VTIMEZONE aus iCloud).
- **Folge:** Termine mit Personen in geänderten Zonen liegen 1 h falsch (Kasachstan 03/2024, Paraguay 10/2024). Für Berlin selbst gibt es bis 2031 keine Änderung.
- **Prüfen:** `process.versions.tz` protokollieren und Node regelmäßig aktualisieren. Bei Konflikt klar festlegen, ob IANA oder die eingebettete VTIMEZONE gilt.
- **Quelle:** [tzdb NEWS][tznews], [time.is Kasachstan][kz], [RFC 7809][7809]

**#10** · Zeitzonen
- **Fehler:** TZIDs, die nicht aus IANA stammen, etwa `W. Europe Standard Time` (Outlook), `/mozilla.org/.../Europe/Berlin` oder `GMT+0100`.
- **Folge:** Die Zone ist unbekannt und fällt still auf UTC oder floating zurück.
- **Prüfen:** Windows→IANA über CLDR `windowsZones.xml` abbilden, Präfixe entfernen. Wenn die Zone unbekannt ist, die eingebettete VTIMEZONE verwenden.
- **Quelle:** [MS Graph Event/Timezone][graphevent], [RFC 5545 §3.2.19][5545]

**#11** · Zeitzonen
- **Fehler:** Falsche Annahmen: Offsets in ganzen Stunden, Umstellung weltweit gleichzeitig, immer genau 1 h.
- **Folge:** Buchungsseite und Zeitzonen-Anzeige sind in den „Zwischenwochen“ falsch. 2026 stellen die USA am 08.03. um, die EU erst am 29.03.
- **Prüfen:** Tests mit America/New_York am 15.03., Asia/Kathmandu (+05:45) und Australia/Lord_Howe (30-Min-Umstellung).
- **Quelle:** [Falsehoods about time zones][falsetz]

**#12** · Zeit-Arithmetik
- **Fehler:** „+24 h“ statt „+1 Tag“, Drag-Deltas in Millisekunden, Verwechslung von DURATION `P1D` und `PT24H`.
- **Folge:** Beim Verschieben über den Umstellungstag und bei Tagesserien sitzt der Termin 1 h daneben.
- **Prüfen:** Kalenderarithmetik in Wandzeit. `P1D` ist ein nominaler Tag, `PT24H` exakt 24 Stunden.
- **Quelle:** [RFC 5545 §3.3.6][5545]

**#13** · Wandzeit
- **Fehler:** Flüge und Reisen werden mit Berliner Zeit angelegt, obwohl Start und Ziel in verschiedenen Zonen liegen.
- **Folge:** Die Landung steht zur falschen Uhrzeit im Kalender.
- **Prüfen:** DTSTART und DTEND dürfen verschiedene TZIDs haben. Die Zone je Termin wählbar machen und von der Anzeigezone trennen.
- **Quelle:** [RFC 5545 §3.8.2.2][5545]

## B · Ganztägig & mehrtägig

**#14** · Ganztägig
- **Fehler:** DTEND wird als einschließlich behandelt.
- **Folge:** Ein Urlaub vom 01. bis 05.10. wird einen Tag zu kurz oder zu lang angezeigt oder geschrieben.
- **Prüfen:** `DTSTART;VALUE=DATE:20261001` / `DTEND;VALUE=DATE:20261006`, DTEND ist ausschließend.
- **Quelle:** [RFC 5545 §3.6.1, §3.8.2.2][5545]

**#15** · Ganztägig
- **Fehler:** Ganztägige Termine werden als 00:00–23:59 oder als UTC-Mitternacht gespeichert.
- **Folge:** In einer anderen Zone oder nach einem Rundlauf über den Server rutscht der Geburtstag auf den Vortag.
- **Prüfen:** Durchgehend VALUE=DATE, nie in einen Zeitpunkt umwandeln.
- **Quelle:** [RFC 5545 §3.3.4][5545]

**#16** · Ganztägig
- **Fehler:** Weder DTEND noch DURATION vorhanden.
- **Folge:** Der Parser setzt die Dauer auf 0 oder 1 h. Richtig ist 1 Tag bei DATE und Dauer 0 bei DATE-TIME.
- **Prüfen:** Tests für beide Fälle.
- **Quelle:** [RFC 5545 §3.6.1][5545]

**#17** · Mehrtägig
- **Fehler:** Zeitgebundene Termine über Mitternacht (Fr 18:00 bis So 14:00) werden nur am Starttag gezeigt.
- **Folge:** Abwesenheit und Reisen sind an den Folgetagen unsichtbar, und die freie Zeit wird falsch berechnet.
- **Prüfen:** In Tagessegmente schneiden, im Monat als Balken zeigen, in der Agenda „läuft weiter“ anzeigen.
- **Quelle:** Praxis; [Falsehoods][falsetime]

**#18** · Ganztägig
- **Fehler:** Beim Umwandeln ganztägig ↔ zeitgebunden werden EXDATE, RDATE und RECURRENCE-ID nicht auf den neuen Werttyp umgestellt.
- **Folge:** iCloud lehnt ab (400/403), oder Ausnahmen verwaisen und Termine erscheinen wieder.
- **Prüfen:** Beim Typwechsel alle Datumsfelder der Serie mit umschreiben.
- **Quelle:** [RFC 5545 §3.8.5.1, §3.8.4.4][5545]

**#19** · Ganztägig
- **Fehler:** Termine, die als ganztägig gemeint sind, werden als 00:00–24:00 zeitgebunden angelegt (Mac-Zulieferer, Importe).
- **Folge:** Sie verstopfen das Raster und blockieren die freie Zeit.
- **Prüfen:** Normalisieren, wenn Mitternacht bis Mitternacht in der Zone der Person vorliegt. Nur Anzeige, nicht zurückschreiben.
- **Quelle:** Praxis

## C · Wiederholungen

**#20** · Serie
- **Fehler:** DTSTART passt nicht zur RRULE, z. B. DTSTART an einem Mittwoch mit BYDAY=MO.
- **Folge:** Das Ergebnis ist laut RFC „undefined“. Apple, Google und ical.js zählen den ersten Termin unterschiedlich.
- **Prüfen:** Beim Schreiben DTSTART auf das erste echte Vorkommen setzen.
- **Quelle:** [RFC 5545 §3.8.5.3][5545]

**#21** · Serie
- **Fehler:** UNTIL hat den falschen Typ. Bei DTSTART mit TZID muss UNTIL in UTC mit „Z“ stehen, bei DATE als DATE.
- **Folge:** Outlook oder iCloud verwerfen den Termin, oder das letzte Vorkommen fehlt bzw. ist zu viel.
- **Prüfen:** Beim Beenden einer Serie UNTIL = Start des letzten gewünschten Vorkommens in UTC (einschließlich).
- **Quelle:** [RFC 5545 §3.3.10][5545]

**#22** · Serie
- **Fehler:** COUNT und UNTIL sind beide gesetzt (MUST NOT), oder es wird nicht berücksichtigt, dass COUNT vor EXDATE zählt.
- **Folge:** „10 Termine“ zeigt nur 9.
- **Prüfen:** Validator beim Schreiben, Anzeige „10 (1 entfällt)“.
- **Quelle:** [RFC 5545 §3.3.10, §3.8.5.3][5545]

**#23** · Serie
- **Fehler:** Ungültige Daten, etwa „monatlich am 31.“ oder „jährlich am 29.02.“.
- **Folge:** Nach RFC werden diese Vorkommen übersprungen, die Nutzerin erwartet aber den letzten Tag des Monats.
- **Prüfen:** In der Oberfläche „letzter Tag im Monat“ anbieten (BYMONTHDAY=-1). RSCALE/SKIP unterstützen kaum Clients.
- **Quelle:** [RFC 5545 §3.3.10][5545], [RFC 7529][7529]

**#24** · Serie
- **Fehler:** Eigene Regel-Engine, oder BYDAY mit Zahl bzw. BYSETPOS ist falsch umgesetzt („letzter Werktag“ = `FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1`).
- **Folge:** Stille Fehlberechnung bei seltenen Mustern.
- **Prüfen:** Keine eigene Engine bauen. Alle ~40 RFC-Beispiele als Test-Fixtures übernehmen.
- **Quelle:** [RFC 5545 §3.8.5.3 Beispiele][5545]

**#25** · Serie
- **Fehler:** WKST wird ignoriert.
- **Folge:** `FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,SU` ergibt je nach WKST=MO oder SU andere Termine (steht so als Beispiel im RFC).
- **Prüfen:** WKST=MO immer ausdrücklich schreiben und beim Lesen beachten.
- **Quelle:** [RFC 5545 §3.3.10][5545]

**#26** · Ausnahmen
- **Fehler:** EXDATE hat einen anderen Werttyp oder eine andere TZID als DTSTART.
- **Folge:** Das gelöschte Vorkommen taucht wieder auf, oft erst in einem anderen Client.
- **Prüfen:** EXDATE mit demselben Typ und derselben TZID schreiben, beim Lesen über den Zeitpunkt vergleichen.
- **Quelle:** [RFC 5545 §3.8.5.1][5545]

**#27** · Ausnahmen
- **Fehler:** Override (RECURRENCE-ID) wird als eigenes Objekt oder mit neuer UID gespeichert.
- **Folge:** Doppelte Termine (Original und verschobenes Vorkommen), iCloud meldet einen UID-Konflikt.
- **Prüfen:** Master und alle Overrides gehören in dieselbe CalDAV-Ressource.
- **Quelle:** [RFC 4791 §4.1][4791]

**#28** · Ausnahmen
- **Fehler:** Beim Verschieben eines Vorkommens wird RECURRENCE-ID auf die neue statt auf die ursprüngliche Zeit gesetzt.
- **Folge:** Der Override passt nicht, das Vorkommen erscheint doppelt.
- **Prüfen:** RECURRENCE-ID = ursprünglicher Start (Google nennt das `originalStartTime`).
- **Quelle:** [RFC 5545 §3.8.4.4][5545], [Google Recurring Events][grec]

**#29** · Ausnahmen
- **Fehler:** Der Master-DTSTART wird verschoben („alle 1 h später“), vorhandene Overrides und EXDATEs aber nicht.
- **Folge:** Verwaiste Ausnahmen und Geistertermine. Bezüge `uid::RECURRENCE-ID` im eigenen Bestand (CRM, Aufgaben) zeigen ins Leere.
- **Prüfen:** RECURRENCE-IDs und EXDATEs mitziehen, oder wie Google fragen „Ausnahmen verwerfen?“. Bezüge im Bestand mit umschlüsseln.
- **Quelle:** [CalConnect Recurrence Problems][ccrec]

**#30** · „Diese und folgende“
- **Fehler:** Änderungen werden per `RANGE=THISANDFUTURE` geschrieben.
- **Folge:** Kaum ein Client oder Server setzt das um, die Änderungen verschwinden.
- **Prüfen:** Serie teilen. Alte Serie mit UNTIL = Vorkommen−1, neue Serie mit neuer UID (optional RELATED-TO). Overrides und EXDATEs nach dem Schnittpunkt umziehen, COUNT neu verteilen.
- **Quelle:** [CalConnect cc-r0604][ccrec], [CalConnect Series][ccseries], [Google Recurring][grec]

**#31** · Serie teilen
- **Fehler:** Nach dem Teilen behält die alte Serie ihr COUNT.
- **Folge:** Die Gesamtzahl verdoppelt sich, etwa bei 10er-Trainingsblöcken.
- **Prüfen:** Alte Serie auf UNTIL umstellen, neue Serie bekommt COUNT = Rest.
- **Quelle:** [CalConnect cc-r0604][ccrec]

**#32** · Löschen
- **Fehler:** „Nur dieses Vorkommen löschen“ löst ein DELETE auf die Ressource aus.
- **Folge:** Die ganze Serie ist weg, samt Overrides.
- **Prüfen:** EXDATE setzen, bei Einladungen einen Override mit STATUS:CANCELLED.
- **Quelle:** [Google Recurring (cancelled instances)][grec]

**#33** · Serie
- **Fehler:** Unendliche Serien oder FREQ=MINUTELY/SECONDLY aus fremden ICS werden ohne Grenze expandiert.
- **Folge:** Hänger, Speicherüberlauf, der Server mit 1 vCPU steht. ical.js hatte eine dokumentierte Endlosschleife.
- **Prüfen:** Nur im Sichtfenster expandieren, harte Obergrenze (z. B. 2.000 Vorkommen oder 10 Jahre), Zeitlimit pro Parse.
- **Quelle:** [ical.js #318][icaljs318], [iCloud-Limits (apiroc)][apiroc]

**#34** · Serie
- **Fehler:** RDATE (auch mit PERIOD) wird ignoriert, oder Altdaten mit mehreren RRULEs oder EXRULE lassen den Parser abstürzen.
- **Folge:** Zusatztermine fehlen.
- **Prüfen:** Tolerant lesen, selbst nur eine RRULE schreiben.
- **Quelle:** [RFC 5545 §3.8.5.2][5545]

**#35** · Serie × Fenster
- **Fehler:** Ein Override wird aus dem Abfragefenster hinaus oder in das Fenster hinein verschoben.
- **Folge:** Das Vorkommen fehlt oder erscheint doppelt (Original und Override).
- **Prüfen:** Serien immer als ganze Ressource laden und mit allen Overrides expandieren, dann filtern.
- **Quelle:** [RFC 4791 §9.9][4791]

**#36** · Serie × Zeitzone
- **Fehler:** Zwei Menschen in unterschiedlichen Zonen, die Serie ist in der Zone des Organizers verankert.
- **Folge:** Für den anderen verschiebt sich der Termin im März oder Oktober um 1 h, was korrekt ist, aber überrascht.
- **Prüfen:** In der Detailansicht „Zeit verankert in: Europe/Berlin“ anzeigen.
- **Quelle:** [Falsehoods about time zones][falsetz]

## D · Synchronisation (CalDAV/iCloud)

**#37** · Konflikt
- **Fehler:** PUT ohne `If-Match: <etag>`.
- **Folge:** Eine Änderung vom iPhone wird still überschrieben (lost update).
- **Prüfen:** Jeden Update-PUT mit If-Match senden.
- **Quelle:** [RFC 4791 §5.3.2][4791], [iCloud-Hinweise (apiroc)][apiroc]

**#38** · Duplikate
- **Fehler:** Neuanlage ohne `If-None-Match: *`, oder ein Retry nach Timeout mit neuer UID.
- **Folge:** Doppelte Termine, besonders bei langsamer Leitung oder bei Buchungen.
- **Prüfen:** UID und Dateinamen vor dem ersten Versuch festlegen und beim Retry beibehalten. 412 bedeutet „existiert schon“.
- **Quelle:** [RFC 4791 §5.3.2][4791]

**#39** · Konflikt
- **Fehler:** Auf 412 Precondition Failed folgt ein erneuter PUT ohne If-Match.
- **Folge:** Genau der lost update, den #37 verhindern soll.
- **Prüfen:** Neu per GET holen und feldweise zusammenführen (3-Wege). Gleiches Feld beidseitig geändert → nachfragen.
- **Quelle:** [RFC 4791][4791]

**#40** · ETag
- **Fehler:** Nach einem PUT wird die eigene Version als Wahrheit behalten, obwohl der Server sie verändert hat (iCloud ergänzt SCHEDULE-STATUS, DTSTAMP, X-APPLE-*). In dem Fall kommt kein starker ETag zurück.
- **Folge:** Der nächste PUT scheitert mit 412, oder serverseitige Felder gehen verloren.
- **Prüfen:** Fehlt der ETag in der PUT-Antwort, per GET neu holen und die lokale Kopie ersetzen.
- **Quelle:** [RFC 4791 §5.3.4][4791]

**#41** · Scheduling-Konflikt
- **Fehler:** Organizer-Updates werden aus einer veralteten Kopie geschrieben.
- **Folge:** Der Server trägt eingehende Zusagen (PARTSTAT) ein, der Client überschreibt sie mit NEEDS-ACTION, und alle Zusagen sind zurückgesetzt.
- **Prüfen:** Vor jedem Update frisch holen. Schedule-Tag/If-Schedule-Tag-Match nutzen, falls iCloud es anbietet **[unsicher]**.
- **Quelle:** [RFC 6638 §3.2.10][6638]

**#42** · Änderungserkennung
- **Fehler:** Nur ctag wird abgefragt, und bei jeder Änderung wird alles neu geladen. Oder ctag gilt als Standard.
- **Folge:** Viel Last, und iCloud drosselt mit 503.
- **Prüfen:** Standard ist WebDAV-Sync `sync-collection`. ctag (Apple-Erweiterung, veraltet) nur als schneller Vorab-Check.
- **Quelle:** [RFC 6578][6578], [ocis #3782][ocis], [kalendee #5][kalendee]

**#43** · Sync-Token
- **Fehler:** Ein ungültiges Token wird nicht behandelt (Fehler `DAV:valid-sync-token`, iCloud liefert stattdessen alles). Gekürzte Antworten (507) werden ebenfalls ignoriert.
- **Folge:** Absturz, fehlende Änderungen oder ein vollständiger Neuimport mit Duplikaten.
- **Prüfen:** Rückfall auf einen vollständigen Abgleich über (href, ETag). Einträge werden zugeordnet, nicht neu angelegt. Google verhält sich analog mit 410 Gone.
- **Quelle:** [RFC 6578 §3.2/§3.6][6578], [Google Sync][gsync]

**#44** · Löschungen
- **Fehler:** 404-Einträge im Sync-Report werden ignoriert, beim ctag-Polling fehlt der Vergleich der href-Liste.
- **Folge:** Zombie-Termine in MAKE OS, die in iCloud längst gelöscht sind.
- **Prüfen:** Test „auf dem iPhone löschen → nach X Sekunden in MAKE OS weg“.
- **Quelle:** [RFC 6578][6578]

**#45** · Identität
- **Fehler:** Es wird angenommen, href-Dateiname = UID.
- **Folge:** Falsche Zuordnung, besonders bei Einladungen und importierten Terminen.
- **Prüfen:** Die Zuordnung href↔UID getrennt pflegen.
- **Quelle:** [RFC 4791 §4.1][4791]

**#46** · Identität (Zwei-Personen-Falle)
- **Fehler:** Die UID gilt als global eindeutig. Ein Termin, zu dem Kevin und Malin beide eingeladen sind, liegt aber mit derselben UID in beiden Kalendern.
- **Folge:** Einträge verschmelzen, oder CRM-Bezüge landen am falschen Kalender.
- **Prüfen:** Schlüssel = (Kalender-URL, UID, RECURRENCE-ID). In der Anzeige bewusst zusammenführen („beide“).
- **Quelle:** [RFC 5545 §3.8.4.7][5545], [RFC 6638][6638]

**#47** · Eigene Eigenschaften
- **Fehler:** Es wird darauf vertraut, dass X-MAKE-ART, COLOR und CATEGORIES in iCloud überleben, auch wenn das Event am iPhone oder Mac bearbeitet wird.
- **Folge:** Termin-Arten und Farben gehen still verloren **[unsicher: für iCloud nicht dokumentiert; Apple schreibt nachweislich eigene X-Marker um]**.
- **Prüfen:** Round-Trip-Test (anlegen → am iPhone ändern → neu lesen). Die Art immer auch im eigenen Bestand (Schlüssel wie #46) spiegeln.
- **Quelle:** [RFC 7986 §5.9][7986], [caldir PR #71][caldir]

**#48** · Scheinänderungen
- **Fehler:** Apple-Artefakte wie `X-RECURRENCE-EXCEPTION` hängen vom abgefragten Zeitfenster ab.
- **Folge:** Termine gelten als geändert, obwohl sich nichts geändert hat. Das löst Sync-Stürme und Konfliktmeldungen aus.
- **Prüfen:** Den Hash über normalisierte Eigenschaften bilden, Apple-Marker vorher entfernen.
- **Quelle:** [caldir PR #71][caldir]

**#49** · Voll-PUT
- **Fehler:** iCloud kann kein PATCH. Der Client erzeugt das ICS aus seinem eigenen Modell neu.
- **Folge:** Unbekannte Felder (VALARM, ATTACH, X-APPLE-TRAVEL-*, ATTENDEE-Parameter) werden gelöscht.
- **Prüfen:** Immer die zuletzt geholte Original-Komponente (ical.js) verändern, nie neu bauen.
- **Quelle:** [apiroc iCloud][apiroc]

**#50** · Polling
- **Fehler:** Es gibt keinen Push für Drittanbieter-Apps. Zu häufiges Polling führt zu 503/Rate-Limit, zu seltenes zu veralteten Daten, etwa auf der Buchungsseite.
- **Folge:** Sperre oder Doppelbuchung.
- **Prüfen:** Adaptiv pollen (aktiv ca. 60 s, im Leerlauf 5–15 min), Backoff und Retry-After beachten. Vor Buchungen erzwungen frisch abfragen (#69).
- **Quelle:** [apiroc][apiroc], [Apple Dev Forum Rate Limit][applerl]

**#51** · Zugang
- **Fehler:** Der Partition-Host (pXX-caldav) ist fest eingetragen, und Redirects werden nicht verfolgt. Außerdem wird übersehen, dass eine Änderung des Apple-ID-Passworts alle app-spezifischen Passwörter widerruft.
- **Folge:** Der Sync hört still auf, und der Kalender „stimmt“ tagelang nicht.
- **Prüfen:** Discovery über `.well-known/caldav` → principal → calendar-home-set. Gut sichtbar anzeigen: „letzter erfolgreicher Abgleich vor X min“, Warnung nach 30 min.
- **Quelle:** [kalendee #5][kalendee], [Apple: app-spezifische Passwörter][appleasp]

**#52** · Mehrere Schreiber
- **Fehler:** Server, Mac-AppleScript und iPhone schreiben ohne Absprache. AppleScript arbeitet auf dem lokalen Cache von Kalender.app, hat also weder ETag noch Konfliktschutz.
- **Folge:** Doppelte Einträge und stille Überschreibungen.
- **Prüfen:** AppleScript nur lesend oder nur für Quellen ohne CalDAV einsetzen. Genau eine schreibende Instanz pro Kalender.
- **Quelle:** Praxis **[unsicher: AppleScript-Serienverhalten nicht offiziell dokumentiert]**

**#53** · Zeitraum-Abfragen
- **Fehler:** `calendar-query` mit time-range und `expand` wird dem Server überlassen.
- **Folge:** Server-Expansion ist uneinheitlich, iCloud begrenzt Zeiträume und Vorkommen, dadurch fehlen Termine.
- **Prüfen:** Rohdaten holen und selbst expandieren, große Zeiträume in Teilen abfragen.
- **Quelle:** [RFC 4791 §9.6.5/§9.9][4791], [apiroc][apiroc]

**#54** · Komponententyp
- **Fehler:** Ein VTODO wird in einen reinen VEVENT-Kalender geschrieben. Bei iCloud liegen Aufgaben und Termine in getrennten Kalendern.
- **Folge:** 403 oder Precondition-Fehler, und die Aufgabe ist verloren.
- **Prüfen:** `supported-calendar-component-set` lesen und das Ziel danach wählen.
- **Quelle:** [RFC 4791 §5.2.3][4791], [apiroc][apiroc]

**#55** · Parser/Serializer
- **Fehler:** Zeilen werden bei 75 Oktetten mitten in einem UTF-8-Zeichen gefaltet (Umlaute), `, ; \` und Zeilenumbrüche werden in TEXT nicht escaped, CRLF fehlt.
- **Folge:** „Müller“ wird zerstört, Beschreibungen sind abgeschnitten, iCloud antwortet mit 400.
- **Prüfen:** Serialisieren nur über ical.js. Test mit „Grüße; Straße, 3\nZeile“.
- **Quelle:** [RFC 5545 §3.1, §3.3.11][5545]

**#56** · Neuaufbau
- **Fehler:** „Spiegel zurücksetzen“ vergibt neue lokale IDs.
- **Folge:** Alle Bezüge zu CRM und Aufgaben brechen.
- **Prüfen:** Lokale Schlüssel ausschließlich aus (Kalender-URL, UID, RECURRENCE-ID) ableiten, nie Autoinkrement.
- **Quelle:** Praxis

## E · Einladungen & Scheduling (iTIP/iMIP)

**#57** · Impliziter Versand (Kernrisiko)
- **Fehler:** iCloud verschickt Einladungen serverseitig, sobald ein PUT ATTENDEE-Einträge enthält. Die Outbox ist nicht nutzbar.
- **Folge:** „Gäste erst nach Klick“ ist verletzt: Schon Autosave, ein Entwurf oder ein ZOE-Vorschlag mit Gästen löst Mails aus.
- **Prüfen:** Gäste bis zum Klick nur im eigenen Bestand halten. Erst der Klick schreibt ATTENDEE nach iCloud. Test mit einer Testadresse.
- **Quelle:** [RFC 6638 §3.2][6638], [apiroc][apiroc]

**#58** · Stummschalter
- **Fehler:** Man verlässt sich darauf, dass `SCHEDULE-AGENT=CLIENT` den Versand verhindert.
- **Folge:** Ob iCloud das beachtet, ist nicht dokumentiert **[unsicher]**. Im schlimmsten Fall gehen die Mails trotzdem raus.
- **Prüfen:** Isoliert testen. Bis dahin gilt #57 als einziger Schutz.
- **Quelle:** [RFC 6638 §7.1][6638]

**#59** · Massenabsagen
- **Fehler:** Löschen, Bereinigen, Migrieren oder Neu-Importieren von Terminen mit Gästen.
- **Folge:** Als Organizer verschickt iCloud CANCEL an alle Gäste, als Gast eine Absage an den Organizer. Ein Aufräumskript kann so Dutzende Kunden anschreiben.
- **Prüfen:** Jedes Skript bekommt eine Teilnehmer-Sperre und einen Probelauf (dry run). Vorher zählen: „N Termine mit Gästen“.
- **Quelle:** [RFC 6638 §3.2][6638], [RFC 5546 CANCEL][5546]

**#60** · Organizer-Adresse
- **Fehler:** ORGANIZER ist eine Adresse, die iCloud nicht als eigene kennt, z. B. die M365-Geschäftsadresse.
- **Folge:** Antworten landen im M365-Postfach, iCloud trägt keine Zusagen (PARTSTAT) ein, oder iCloud verschickt gar nicht **[wahrscheinlich, testen]**.
- **Prüfen:** ORGANIZER aus `calendar-user-address-set` des Principals nehmen. Zusage aus Outlook und aus Gmail testen.
- **Quelle:** [RFC 6638 §2.4.1][6638]

**#61** · SEQUENCE
- **Fehler:** SEQUENCE wird bei einer Zeitänderung nicht erhöht, oder bei jeder Kleinigkeit.
- **Folge:** Outlook und Gmail ignorieren das Update, oder alle Gäste müssen neu zusagen.
- **Prüfen:** Nur bei wesentlichen Änderungen erhöhen (DTSTART, DTEND, RRULE, EXDATE, STATUS, Ort).
- **Quelle:** [RFC 5546 §2.1.4][5546], [RFC 5545 §3.8.7.4][5545]

**#62** · DTSTAMP
- **Fehler:** DTSTAMP steht in lokaler Zeit, wird nicht aktualisiert oder ist das Erstelldatum.
- **Folge:** Antworten und Updates werden als veraltet verworfen.
- **Prüfen:** DTSTAMP immer in UTC und bei jeder Nachricht neu setzen.
- **Quelle:** [RFC 5545 §3.8.7.2][5545], [RFC 5546][5546]

**#63** · Rolle Gast
- **Fehler:** Bei fremden Einladungen lassen sich Zeit und Titel bearbeiten und zurückschreiben. Eine Antwort (REPLY) enthält alle Teilnehmer.
- **Folge:** Das nächste Organizer-Update überschreibt die Änderung, iCloud antwortet mit 403, oder falsche Antworten gehen raus.
- **Prüfen:** Bei fremden Terminen nur die eigene Zusage änderbar machen. Ein REPLY enthält genau einen ATTENDEE.
- **Quelle:** [RFC 5546 §3.2.3][5546], [RFC 6638 §3.2.2][6638]

**#64** · Ausnahmen × Gäste
- **Fehler:** Ein Gast steht im Master, fehlt aber im Override (oder umgekehrt).
- **Folge:** iCloud schickt für dieses Vorkommen eine Absage oder eine Einzel-Einladung. Outlook verarbeitet einzeln versandte Ausnahmen oft schlecht.
- **Prüfen:** Gästeliste bei Änderung einzelner Vorkommen bewusst übernehmen. Interop mit Outlook testen.
- **Quelle:** [CalConnect Interop-Bericht][ccinterop], [RFC 5546][5546]

**#65** · Eingehende Einladungen
- **Fehler:** Einladungen werden ohne Prüfung übernommen (Absender ≠ ORGANIZER, unbekannte Absender).
- **Folge:** Spam und Phishing im Kalender. Bekanntes Muster: iCloud-Einladungen mit Betrugstext in den Notizen, versendet über Apple-Server und mit gültigem SPF/DKIM.
- **Prüfen:** Unbekannte Absender nicht automatisch übernehmen, Links markieren oder nicht klickbar machen, Absenderabgleich.
- **Quelle:** [RFC 6047 §6][6047], [BleepingComputer][bleeping]

**#66** · iMIP-Format
- **Fehler:** Eigene Einladungsmails über M365 zusätzlich zum iCloud-Versand. Außerdem falscher Content-Type, fehlender METHOD oder keine VTIMEZONE.
- **Folge:** Gäste bekommen doppelte Mails, Outlook zeigt eine falsche Uhrzeit oder einen reinen Anhang statt einer Einladung.
- **Prüfen:** Genau einen Versandweg festlegen. Wenn M365: `text/calendar; method=REQUEST; charset=UTF-8` mit VTIMEZONE.
- **Quelle:** [RFC 6047 §2–3][6047]

**#67** · Adressen
- **Fehler:** `mailto:` wird mit unterschiedlicher Groß-/Kleinschreibung, Präfixen und Aliasen verglichen.
- **Folge:** Kevin erscheint als fremder Gast in seinem eigenen Termin, und die Zusage wird nicht erkannt.
- **Prüfen:** Adressen normalisieren, Alias-Liste je Person pflegen.
- **Quelle:** [RFC 5545 §3.3.3][5545]

## F · Frei/Beschäftigt & Verfügbarkeit

**#68** · Belegt-Logik
- **Fehler:** TRANSP, STATUS und PARTSTAT werden ignoriert. Abgelehnte, abgesagte und transparente Termine (Arbeitsort, Geburtstag, Feiertag) blockieren.
- **Folge:** Die gemeinsame freie Zeit ist künstlich knapp, die Buchungsseite zeigt zu wenig Slots.
- **Prüfen:** Standard-TRANSP je Termin-Art: Arbeitsort, Geburtstag und Feiertag TRANSPARENT, Abwesend und Fokuszeit OPAQUE. TENTATIVE als Option.
- **Quelle:** [RFC 5545 §3.8.2.7, §3.8.1.11][5545], [RFC 4791 §7.10][4791]

**#69** · Kalenderauswahl
- **Fehler:** Die freie Zeit wird nur aus einem Teil der Kalender berechnet (Familie, Abos und der Mac-Zulieferer fehlen). Außerdem gibt die API bei Malins Terminen Titel statt nur „belegt“ zurück.
- **Folge:** Doppelbelegungen, und die Privatsphäre ist verletzt.
- **Prüfen:** Je Kalender den Schalter „zählt als belegt“. Die Endpunkte für freie Zeit liefern nur Intervalle.
- **Quelle:** Praxis; [RFC 6638 VFREEBUSY][6638]

**#70** · Intervalle
- **Fehler:** Überlappungen werden mit geschlossenen Intervallen gerechnet.
- **Folge:** Der Anschlusstermin 10:00–11:00 nach 09:00–10:00 gilt als Konflikt, Termine mit Dauer 0 blockieren.
- **Prüfen:** Halboffene Intervalle [start, end).
- **Quelle:** [RFC 5545 §3.8.2.2][5545]

**#71** · Puffer & Reisezeit
- **Fehler:** Puffer und Reisezeit werden nicht als belegt gerechnet. Apples Reisezeit liegt nur in X-APPLE-Eigenschaften.
- **Folge:** Eine Buchung wird direkt nach einem Außentermin angeboten.
- **Prüfen:** Puffer je Termin-Art einrechnen, Apple-Reisezeit lesen **[unsicher: Feldnamen X-APPLE-TRAVEL-* per Export verifizieren]**.
- **Quelle:** Praxis; [Reclaim Buffer][reclaimbuffer]

**#72** · Feiertage NRW
- **Fehler:** Falsche Feiertagsliste: Reformationstag (31.10.) ist in NRW kein Feiertag, Allerheiligen und Fronleichnam schon. Heiligabend und Silvester sind keine gesetzlichen Feiertage, Rosenmontag auch nicht. Dazu eine falsche Osterformel.
- **Folge:** Die Buchungsseite bietet Termine an Feiertagen an oder sperrt Werktage.
- **Prüfen:** Feiertage aus der Osterformel ableiten und bis 2030 per Test gegen eine amtliche Liste prüfen. „Nicht gesetzlich, aber frei“ getrennt führen.
- **Quelle:** [Feiertagsgesetz NRW §2][ftgnrw]

## G · Öffentliche Buchungsseite

**#73** · Doppelbuchung (Race)
- **Fehler:** Zwei Gäste buchen denselben Slot, oder ein Gast bucht, während am iPhone ein Termin entsteht. Die Belegt-Daten stammen aus einem veralteten Cache.
- **Folge:** Doppelbuchung. Bei Cal.com war das ein S1-Fehler.
- **Prüfen:** Slot mit Ablaufzeit reservieren, Buchung und Reservierung in einer Transaktion. Direkt vor der Bestätigung frische CalDAV-Abfrage. Eindeutiger Index auf (Kalender, Slot).
- **Quelle:** [cal.com #23974][cal23974], [#22801][cal22801], [#13360][cal13360]

**#74** · Zeitzone des Gastes
- **Fehler:** Slots werden in der Zeitzone des Servers oder ohne Zeitzonen-Hinweis angezeigt.
- **Folge:** Gäste im Ausland erscheinen 1 h zu früh oder zu spät, vor allem in den Wochen zwischen US- und EU-Umstellung.
- **Prüfen:** Zone aus dem Browser übernehmen und umschaltbar machen. Die Bestätigung zeigt beide Zeiten, das ICS enthält die TZID.
- **Quelle:** [Falsehoods about time zones][falsetz]

**#75** · Informationsleck
- **Fehler:** Die Buchungsseite zeigt jede freie Lücke über Monate. Bei Paar-Buchungen fließt Malins Kalender mit ein.
- **Folge:** Muster wie Urlaub, Arzttermine oder Abwesenheit werden ablesbar.
- **Prüfen:** Nur definierte Buchungsfenster anbieten, Horizont z. B. 3 Wochen, keine Titel, Mindestvorlauf.
- **Quelle:** [easyRechtssicher][easyrecht]

**#76** · Missbrauch als Versandkanal
- **Fehler:** Der Gast trägt eine fremde Adresse ein, und MAKE OS schreibt ihn sofort als ATTENDEE nach iCloud.
- **Folge:** iCloud verschickt Einladungen an Dritte (dasselbe Muster wie beim Phishing). Rechtlich riskant nach §7 UWG.
- **Prüfen:** Erst Bestätigungslink per Mail, dann Eintrag. Rate-Limit je IP und Adresse, Honeypot.
- **Quelle:** [BleepingComputer][bleeping], [§7 UWG][uwg7]

**#77** · Absage- und Umbuchungslinks
- **Fehler:** Erratbare IDs (`/booking/123/cancel`) und nicht idempotente Aufrufe.
- **Folge:** Fremde können Termine absagen, doppelte Klicks lösen doppelte Mails aus.
- **Prüfen:** Zufällige Tokens mit mindestens 128 Bit und Ablaufzeit, idempotente Endpunkte.
- **Quelle:** Praxis

**#78** · ICS in der Bestätigung
- **Fehler:** `METHOD:PUBLISH` ohne stabile UID und SEQUENCE.
- **Folge:** Eine Umbuchung erzeugt beim Gast einen zweiten Termin, eine Absage entfernt nichts.
- **Prüfen:** REQUEST und CANCEL mit gleicher UID und SEQUENCE+1 senden.
- **Quelle:** [RFC 5546][5546]

**#79** · DSGVO
- **Fehler:** Die Pflichtinformation nach Art. 13 fehlt oder steht unter dem Formular. Zu viele Pflichtfelder, keine Löschfrist, Newsletter-Einwilligung an die Buchung gekoppelt, kein AV-Vertrag mit dem Mail-Dienst.
- **Folge:** Abmahnrisiko, Bußgeldrisiko.
- **Prüfen:** Hinweis über dem Formular, Datenminimierung, Löschung z. B. 6 Monate nach dem Termin, Einwilligung separat, AVV nach Art. 28.
- **Quelle:** [easyRechtssicher][easyrecht], [meetergo AVV][meetergo]

**#80** · Regeln
- **Fehler:** Mindestvorlauf, Tageslimit, Puffer, Feiertage und Abwesenheiten greifen nicht. Erinnerungs-Mails enthalten Werbung.
- **Folge:** Buchungen in 20 Minuten, am Feiertag oder im Urlaub. Werbung in Service-Mails ist nach §7 UWG problematisch.
- **Prüfen:** Regeln als Testfälle anlegen, Erinnerungen rein sachlich halten.
- **Quelle:** [Cal.com Limits][callimits], [§7 UWG][uwg7]

## H · Erinnerungen

**#81** · Doppelte Erinnerungen
- **Fehler:** MAKE-OS-Push, VALARM auf iPhone und Mac und die Watch melden sich alle.
- **Folge:** 3–4 Meldungen pro Termin, und Benachrichtigungen werden abgeschaltet.
- **Prüfen:** Je Termin-Art genau eine Quelle festlegen, nur bei Bedarf einen VALARM schreiben.
- **Quelle:** Praxis; [RFC 9074][9074]

**#82** · Trigger-Zeit
- **Fehler:** Server-Erinnerungen werden in der falschen Zone oder in Millisekunden über die Umstellung berechnet. Der relative TRIGGER bei ganztägigen Terminen (`-PT15H` zur floating Mitternacht) wird falsch gelesen.
- **Folge:** Die Erinnerung kommt 1 h daneben oder am falschen Tag.
- **Prüfen:** Trigger je Vorkommen in Europe/Berlin auflösen. Test am 25.10.2026.
- **Quelle:** [RFC 5545 §3.8.6.3][5545]

**#83** · VALARM-Hygiene
- **Fehler:** Apple-Standardalarme vervielfachen sich bei jedem Sync, fremde VALARMs kommen aus Einladungen, eigene gehen an Gäste mit.
- **Folge:** Erinnerungsflut, und Gäste bekommen Kevins Erinnerungen.
- **Prüfen:** VALARM-UID und ACKNOWLEDGED (RFC 9074) nutzen, Duplikate entfernen, VALARM nicht in iTIP-Nachrichten mitsenden.
- **Quelle:** [RFC 9074][9074]

**#84** · Veraltete Jobs
- **Fehler:** Erinnerungen werden einmalig eingeplant und nach dem Verschieben oder Löschen nicht zurückgezogen.
- **Folge:** Erinnerungen für Termine, die es nicht mehr gibt.
- **Prüfen:** Jobs aus dem aktuellen Zustand ableiten, Idempotenz-Schlüssel `kalender::uid::recurrence-id::trigger`.
- **Quelle:** Praxis

## I · Darstellung & Layout

**#85** · Überlappungen
- **Fehler:** Der Spalten-Algorithmus ist naiv (kein Cluster-Packing).
- **Folge:** Termine liegen verdeckt, ab 4–5 Überlappungen ist nichts mehr lesbar.
- **Prüfen:** Cluster bilden, dann Spalten, dann ausdehnen. Anzeige „+n“. Test mit 6 gleichzeitigen Terminen.
- **Quelle:** Praxis

**#86** · 23-/25-Stunden-Tag
- **Fehler:** Pixel = Minuten seit Mitternacht (Zeitpunkt).
- **Folge:** Am 29.03. und am 25.10. sind alle Termine nach 02:00 um 1 h versetzt. Die doppelte Stunde lässt sich nicht darstellen.
- **Prüfen:** Position aus der Wandzeit ableiten (wie Google mit 24-h-Raster) und dokumentieren. Termine zwischen 02:00 und 03:00 am 25.10. bekommen eine Markierung.
- **Quelle:** [Falsehoods][falsetime]

**#87** · Woche & KW
- **Fehler:** Sonntag als Wochenbeginn, US-Wochenzählung, date-fns `YYYY` (Wochenjahr) mit `yyyy` verwechselt.
- **Folge:** Falsche KW um den Jahreswechsel. **2026 hat 53 ISO-Wochen**, KW 53 = 28.12.2026–03.01.2027.
- **Prüfen:** ISO 8601 mit Montag als Wochenbeginn. Tests: 29.12.2025 = KW 1/2026, 01.01.2027 = KW 53/2026.
- **Quelle:** [ISO-Woche][isoweek], [date-fns Tokens][datefns]

**#88** · Monat, Jahr, Agenda
- **Fehler:** Monatsansicht mit festen 5 Zeilen, Balken brechen am Wochenumbruch nicht um, laufende mehrtägige Termine fehlen am Folgetag der Agenda, die Jahresansicht rendert alle Einzeltermine.
- **Folge:** Fehlende Termine, langsame Jahresansicht.
- **Prüfen:** 6 Zeilen, Balken-Segmentierung, Jahresansicht nur mit Dichte oder Markern.
- **Quelle:** Praxis

**#89** · Barrierefreiheit der Darstellung
- **Fehler:** Die Termin-Art wird nur über Farbe unterschieden, der Textkontrast auf Farbflächen ist zu gering (dunkler Grund #0E0E0E), kurze Termine sind kleiner als 24×24 px.
- **Folge:** Nicht unterscheidbar oder nicht anklickbar.
- **Prüfen:** Zusätzlich Symbol oder Muster je Art, Kontrast mindestens 4.5:1, Mindestgröße für Klickflächen.
- **Quelle:** [WCAG 1.4.1][wcag141], [WCAG 2.5.8][wcag258]

## J · Drag & Drop & Bearbeiten

**#90** · Serie vs. Vorkommen
- **Fehler:** Ein gezogenes Vorkommen verschiebt die ganze Serie (oder umgekehrt), ohne dass „Nur dieser / Dieser und folgende / Alle“ abgefragt wird.
- **Folge:** Massenänderung, bei Einladungen mit Mails an alle Gäste.
- **Prüfen:** Abfrage bei jeder Serie. Bei Terminen mit Gästen zusätzlich „Gäste benachrichtigen?“ (#57).
- **Quelle:** [Google Recurring][grec]

**#91** · Tastatur und Alternativen
- **Fehler:** Verschieben geht nur per Ziehen, der Datepicker lässt sich nicht per Tastatur bedienen.
- **Folge:** Verstoß gegen WCAG 2.2 AA, außerdem langsamer als per Tastatur.
- **Prüfen:** Einzelklick-Alternative (Menü „verschieben auf …“). Pfeiltasten, Bild↑/↓ und Pos1/Ende im Datums-Raster nach APG.
- **Quelle:** [WCAG 2.5.7 Dragging Movements][wcag257], [APG Date Picker][apgdp]

**#92** · Touch
- **Fehler:** Scrollen und Ziehen konkurrieren, es gibt kein langes Drücken zum Aufnehmen.
- **Folge:** Termine werden auf dem iPhone versehentlich verschoben.
- **Prüfen:** Aufnehmen per langem Drücken, Rückgängig-Toast 5–10 s.
- **Quelle:** Praxis

**#93** · Optimistische Oberfläche
- **Fehler:** Kein Rollback bei 412, 403 oder Netzfehler.
- **Folge:** Der Termin sieht verschoben aus, ist es in iCloud aber nicht.
- **Prüfen:** Status „wird gespeichert / Konflikt“ am Termin anzeigen, bei Fehler zurücksetzen und benennen.
- **Quelle:** [RFC 4791 §5.3.2][4791]

## K · Suche & Performance

**#94** · Suche
- **Fehler:** Es wird nur im Master gesucht, Titel von Overrides und Beschreibungen fehlen. Keine Normalisierung von Umlauten und ß.
- **Folge:** „Müller“ und „Mueller“ werden nicht gefunden, verschobene Einzeltermine auch nicht.
- **Prüfen:** Index über Master und Overrides, Unicode-Faltung.
- **Quelle:** Praxis

**#95** · Expansion auf 1 vCPU
- **Fehler:** Bei jeder Anfrage werden alle Serien über Jahre neu expandiert, und die Jahresansicht fragt 12 Monate × alle Kalender per CalDAV ab.
- **Folge:** Sekundenlange Antwortzeiten, Zeitüberschreitungen bei iCloud.
- **Prüfen:** Instanz-Cache je (Kalender, UID, ETag, Fenster), ungültig bei ETag-Wechsel. Rohdaten inkrementell per Sync (#42), nie direkt aus der Ansicht abfragen.
- **Quelle:** [apiroc][apiroc], [RFC 6578][6578]

## L · Datenschutz & Rechte

**#96** · „Privat“ ist keine Sicherheitsgrenze
- **Fehler:** Man verlässt sich auf `CLASS:PRIVATE`. CalDAV-Server setzen das nicht durch, geteilte iCloud-Kalender zeigen alles.
- **Folge:** Private Termine sind für den Partner oder bei ICS-Export sichtbar.
- **Prüfen:** Echte Trennung = getrennte Kalender. CLASS dient in MAKE OS nur als Anzeige-Filter und muss auch für ZOE und die API gelten.
- **Quelle:** [RFC 5545 §3.8.1.3][5545]

**#97** · Adressen Dritter
- **Fehler:** In Termin-Einladungen gibt es kein BCC. Jede Teilnehmerliste zeigt allen Gästen die Mailadressen der anderen.
- **Folge:** Adressen Externer werden offengelegt (DSGVO).
- **Prüfen:** Bei Gruppenterminen mit Externen warnen oder Einzeltermine anlegen.
- **Quelle:** [datenschutz-praxis][dspraxis]

**#98** · Art. 17 & Art. 9
- **Fehler:** Kontaktdaten stecken verstreut in iCloud-ATTENDEE/DESCRIPTION, im eigenen Bestand, in Backups, Logs und im KI-Gedächtnis. Gesundheitstermine (Art. 9) liegen im Klartext in Logs. App-Passwort in .env oder in Logs.
- **Folge:** Löschung ist nicht vollständig möglich, Gesundheitsdaten und Zugangsdaten liegen offen.
- **Prüfen:** Funktion „alle Spuren einer Adresse“. Logs ohne ICS-Inhalt, Geheimnisse verschlüsselt.
- **Quelle:** [Art. 17 DSGVO][gdpr17], [Art. 9 DSGVO][gdpr9]

**#99** · ICS-Abos für Externe
- **Fehler:** Eine geheime URL für alle, ohne Widerruf, mit vollen Details und internen X-Feldern (X-MAKE-ART, CRM-IDs). Außerdem wird angenommen, Abos aktualisieren sofort.
- **Folge:** Datenleck. Google holt Abos nur alle 8–24 h ab, Externe sehen also veraltete Zeiten.
- **Prüfen:** Token je Empfänger, widerrufbar, standardmäßig nur „belegt“. Interne Felder entfernen, REFRESH-INTERVAL setzen.
- **Quelle:** [RFC 7986 §5.7][7986], [ICS-Refresh-Raten][icsrefresh]

## M · Integration Aufgaben/CRM

**#100** · Doppelte Wahrheit & verwaiste Bezüge
- **Fehler:** Die Fälligkeit im Aufgaben-Modul und der Zeitblock im Kalender sind beide bearbeitbar. CRM-Aktivitäten zählen auch abgesagte oder abgelehnte Termine. Wird ein Termin am iPhone gelöscht und neu angelegt, entsteht eine neue UID, und der Bezug verwaist.
- **Folge:** Abweichende Stände, falsche Kennzahlen (Termine gehalten), Notizen ohne Termin.
- **Prüfen:** Je Feld genau eine führende Quelle. Nur STATUS≠CANCELLED und eigenes PARTSTAT≠DECLINED zählen. Wöchentlicher Waisen-Bericht mit Vorschlag zur Neuzuordnung (Titel + Zeit ± 1 Tag + Teilnehmer), nur per Klick bestätigt.
- **Quelle:** Praxis; [CalConnect cc-r0604][ccrec]

## N · KI-Assistenz im Kalender (Zusatzpunkte, ohne Nummer im 100er-Block, weil kritisch)

**#K1** · Prompt Injection
- **Fehler:** ZOE liest SUMMARY, DESCRIPTION und LOCATION fremder Einladungen als Anweisung.
- **Folge:** Nachgewiesen bei Gemini („Invitation Is All You Need“, 2025/26): Termine eines Tages wurden zusammengefasst und in einen neuen Termin geschrieben. Das ist ein Exfiltrationskanal.
- **Prüfen:** Fremdtext als Daten kennzeichnen. Werkzeuge mit Seiteneffekt nur nach Klick, keine Aktionen aus Kalenderinhalt heraus.
- **Quelle:** [SafeBreach][safebreach], [Miggo][miggo], [The Hacker News 01/2026][thn], [OWASP LLM01][owasp]

**#K2** · ZOE schreibt Gäste
- **Fehler:** ZOE darf Termine mit ATTENDEE anlegen.
- **Folge:** iCloud verschickt Mails (#57). Das ist ein offener Kanal nach außen und bei Injection ausnutzbar.
- **Prüfen:** Harte Regel: ZOE schreibt nie ATTENDEE und nie nach iCloud. Vorschläge liegen nur im eigenen Bestand.
- **Quelle:** [RFC 6638][6638], [SafeBreach][safebreach]

**#K3** · Relative Zeiten
- **Fehler:** „Nächsten Freitag“, „in zwei Wochen“ oder „morgen früh“ um 00:30 werden mit UTC oder ohne aktuelles Datum aufgelöst.
- **Folge:** Termin am falschen Tag.
- **Prüfen:** ZOE bekommt bei jeder Anfrage Datum, Wochentag und Zone mit. Ergebnis als strukturierte Vorschau mit Wochentag, Datum und Uhrzeit bestätigen lassen.
- **Quelle:** Praxis

**#K4** · Datenumfang
- **Fehler:** ZOE sieht Malins private Termine und Gesundheitstermine und schickt sie an externe LLM-Anbieter.
- **Folge:** Art.-9-Daten gehen an Dritte, und das Vertrauen im Paar leidet.
- **Prüfen:** Filter je Person und Kalender vor dem Prompt, AVV mit dem LLM-Anbieter.
- **Quelle:** [Art. 9 DSGVO][gdpr9]

## O · Import/Export/Backup (Zusatz)

**#K5** · Neuimport & Backup
- **Fehler:** „iCloud ist das Backup“: Löschungen synchronisieren sich überall hin. Ein Neuimport alter ICS erzeugt neue UIDs oder überschreibt neuere Stände. Bei Terminen mit Gästen verschickt iCloud dabei Mails (#59).
- **Folge:** Datenverlust, Duplikate, Mails an Kunden.
- **Prüfen:** Täglicher ICS-Export je Kalender, verschlüsselt auf Hetzner, Wiederherstellung einmal getestet. Import als Upsert nach UID mit Vergleich von SEQUENCE und LAST-MODIFIED, Teilnehmer-Sperre.
- **Quelle:** [RFC 5545 §3.8.7.3/§3.8.7.4][5545]

---

## Die 15 wichtigsten für genau diese Bauart

1. **#57 + #K2: iCloud versendet beim PUT mit ATTENDEE sofort.** Ohne Schutz ist die Regel „Gäste erst nach Klick“ technisch nicht eingehalten. Gäste bis zum Klick nur lokal halten, ZOE schreibt nie ATTENDEE.
2. **#59: Löschen oder Import mit Gästen löst Massen-Absagen aus.** Jedes Wartungsskript braucht eine Teilnehmer-Sperre und einen Probelauf.
3. **#37/#39: If-Match und 412 beim Zusammenführen.** Mit drei Schreibern (Server, iPhone, Mac) sind verlorene Änderungen sonst sicher.
4. **#49: Voll-PUT auf Basis des Originals.** Sonst löscht MAKE OS fremde Felder (Alarme, Reisezeit, Gäste-Parameter).
5. **#47: X-MAKE-ART und COLOR im Round-Trip testen und im Bestand spiegeln.** Die Termin-Arten hängen sonst an nicht dokumentiertem Apple-Verhalten.
6. **#1/#2: Wandzeit + TZID speichern, jedes Vorkommen neu auflösen.** Pflichttest vor dem 25.10.2026.
7. **#3: ical.js-Registrierreihenfolge der VTIMEZONEs.** Wenn sie falsch ist, fallen Ausnahmen still weg.
8. **#14/#15: DTEND bei DATE ausschließend, ganztägige Termine nie in UTC.** Betrifft Geburtstage, Feiertage und Urlaube.
9. **#27/#28: Overrides in derselben Ressource, RECURRENCE-ID = ursprüngliche Zeit.** Das ist die Hauptursache für doppelte Termine.
10. **#30/#31: „Diese und folgende“ als Split (UNTIL + neue UID), nicht über THISANDFUTURE.**
11. **#29 + #100: Master-Verschiebung und verwaiste `uid::RECURRENCE-ID`-Bezüge.** Die CRM- und Aufgaben-Bezüge sind genau so aufgebaut.
12. **#46: Gleiche UID in Kevins und Malins Kalender.** Die Falle, die es nur bei zwei Personen gibt. Schlüssel = Kalender + UID + RECURRENCE-ID.
13. **#43/#44/#51: Ungültiges Sync-Token, Löschungen, widerrufenes App-Passwort.** Ohne gut sichtbare Anzeige „letzter Abgleich“ fällt ein stiller Sync-Ausfall nicht auf.
14. **#73 + #76: Doppelbuchung auf der Buchungsseite, und die Buchungsseite als Spam-Kanal über iCloud.** Frische Abfrage, Transaktion, Bestätigungslink vor dem Eintrag.
15. **#K1: Prompt Injection über Einladungen an ZOE.** Die Gemini-Vorfälle 2025/26 zeigen, dass das real ausgenutzt wird.

Knapp dahinter: #60 (ORGANIZER-Adresse, relevant wegen M365 vs. iCloud), #68 (Belegt-Logik), #72 (Feiertage NRW), #87 (KW 53/2026).

[5545]: https://www.rfc-editor.org/rfc/rfc5545
[5546]: https://www.rfc-editor.org/rfc/rfc5546
[6047]: https://www.rfc-editor.org/rfc/rfc6047
[4791]: https://www.rfc-editor.org/rfc/rfc4791
[6638]: https://www.rfc-editor.org/rfc/rfc6638
[6578]: https://www.rfc-editor.org/rfc/rfc6578
[7986]: https://www.rfc-editor.org/rfc/rfc7986
[7529]: https://www.rfc-editor.org/rfc/rfc7529
[7809]: https://www.rfc-editor.org/rfc/rfc7809
[9074]: https://www.rfc-editor.org/rfc/rfc9074
[ccrec]: https://standards.calconnect.org/cc/cc-r0604-2006.html
[ccseries]: https://standards.calconnect.org/cc/cc-cd51003-2018.html
[ccinterop]: https://standards.calconnect.org/cc/cc-a0603-2006.html
[gsync]: https://developers.google.com/workspace/calendar/api/guides/sync
[grec]: https://developers.google.com/workspace/calendar/api/guides/recurringevents
[graphevent]: https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/api-reference/beta/resources/event.md
[graphdst]: https://github.com/mpalermiti/outlook-mcp/issues/71
[falsetime]: https://gist.github.com/timvisee/fcda9bbdff88d45cc9061606b4b923ca
[falsetz]: https://zainrizvi.io/blog/falsehoods-programmers-believe-about-time-zones/
[tznews]: https://data.iana.org/time-zones/tzdb/NEWS
[kz]: https://time.is/time_zone_news/kazakhstan_goes_from_two_time_zones_to_one
[zeitum]: https://giga.de/tech/die-eu-wollte-sie-abschaffen-doch-sie-kommt-trotzdem-wieder-das-ist-der-termin-fuer-die-zeitumstellung-2026--01JM28QBK4GNMQ342RS3FK4VAF
[icaljs257]: https://github.com/mozilla-comm/ical.js/issues/257
[icaljs318]: https://github.com/kewisch/ical.js/issues/318
[icaljs455]: https://github.com/mozilla-comm/ical.js/issues/455
[inkwell]: https://github.com/grantlucas/inkwell/issues/105
[mailspring]: https://github.com/Foundry376/Mailspring/pull/2877
[caldir]: https://github.com/t4t5/caldir/pull/71
[apiroc]: https://www.apiroc.com/blog/how-to-integrate-icloud-calendar-api-into-your-app
[kalendee]: https://github.com/KolektivComputer/kalendee/issues/5
[ocis]: https://github.com/owncloud/ocis/issues/3782
[applerl]: https://developer.apple.com/forums/thread/722170
[appleasp]: https://support.apple.com/en-us/102654
[bleeping]: https://www.bleepingcomputer.com/news/security/icloud-calendar-abused-to-send-phishing-emails-from-apples-servers/
[safebreach]: https://www.safebreach.com/blog/invitation-is-all-you-need-hacking-gemini/
[miggo]: https://www.miggo.io/post/weaponizing-calendar-invites-a-semantic-attack-on-google-gemini
[thn]: https://thehackernews.com/2026/01/google-gemini-prompt-injection-flaw.html
[owasp]: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
[cal23974]: https://github.com/calcom/cal.com/issues/23974
[cal22801]: https://github.com/calcom/cal.com/issues/22801
[cal13360]: https://github.com/calcom/cal.com/issues/13360
[callimits]: https://cal.com/docs/core-features/event-types/limit-future-bookings
[apgdp]: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/
[wcag257]: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
[wcag258]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
[wcag141]: https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
[easyrecht]: https://easyrechtssicher.de/blog/online-terminkalender-rechtlich-richtig-nutzen
[dspraxis]: https://www.datenschutz-praxis.de/datenschutzbeauftragte/meetings-datenschutzkonform-organisieren/
[meetergo]: https://meetergo.com/blog/auftragsverarbeitung-avv-terminbuchung-erklaert
[icsrefresh]: https://calfeed.ai/learn/ics-refresh-rate-apple-google
[gdpr17]: https://dsgvo-gesetz.de/art-17-dsgvo/
[gdpr9]: https://dsgvo-gesetz.de/art-9-dsgvo/
[uwg7]: https://www.gesetze-im-internet.de/uwg_2004/__7.html
[ftgnrw]: https://recht.nrw.de/
[isoweek]: https://de.wikipedia.org/wiki/Woche#Z%C3%A4hlweise_nach_ISO_8601
[datefns]: https://github.com/date-fns/date-fns/blob/main/docs/unicodeTokens.md
[mdndate]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse
[temporal]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal
[reclaimbuffer]: https://reclaim.ai/features/buffer-time
