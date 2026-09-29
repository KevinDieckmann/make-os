# Kalender: Abgleich mit der 100-Fehler-Prüfliste (29.09.2026)

Zwei Prüfer, nur gelesen. Teil 1: A–D. Teil 2: E–O. Reparatur-Stand wird unten nachgetragen.

## Teil 1 · Kalender-Prüfung, Abschnitte A–D (#1–#56), Stand `entwicklung` (ff69ebd)

Ich habe nur gelesen. Im Repo ist nichts geändert, `git status` ist leer. `.data/` habe ich nicht geöffnet, iCloud nicht angefasst.

**Wie geprüft:**
- Wegwerf-Tests im Scratchpad (`…/scratchpad/kal/*.probe.ts`, eigene vitest-Konfiguration). Sie rufen die echten Funktionen `termineAus`, `baueTermin`, `aendereTermin`, `termineImZeitraum` mit ical.js 2.2.1 auf.
- Diese Tests liefen unter `TZ=Europe/Berlin`, `UTC` und `America/Los_Angeles`.
- Die bestehenden Kalender-Tests laufen grün (5 Dateien, 41 Tests).

**Wichtigster Befund:** Am 25.10.2026 (die doppelte Stunde) und am 29.03. (die fehlende Stunde) schreibt MAKE OS Termine zwischen 02:00 und 03:59 falsch. Ursache ist ein Fehler in ical.js `convertToZone` an der Umstellung. Beispiel: 02:00–03:00 am 25.10. wird zu einem Termin 03:00–03:00 ohne Dauer. Alle anderen Uhrzeiten und alle Serien über die Umstellung stimmen.

## Lücken nach Schwere

| # | Schwere | Aufwand | Wo | Fehlerszenario (belegt) | Reparatur |
|---|---|---|---|---|---|
| **#5** | mittel | S | `lib/kalender/ics.ts:318` (`fromJSDate(...).convertToZone`), `lib/kalender/zeit.ts:38-45` | Am 25.10.2026 wird 02:00–03:00 als `DTSTART=DTEND=…T030000` geschrieben, also 0 Minuten. 02:30 wird zu 03:30. Eine mehrdeutige Uhrzeit wird auf das zweite Vorkommen (MEZ, 01:30Z) gelegt statt auf das erste (MESZ). Der Pflichttest der Prüfliste schlägt damit fehl. Die Daten werden still verfälscht, betroffen sind aber nur Nachtstunden. | ICAL.Time direkt aus den Wandzeit-Teilen bauen: `ICAL.Time.fromData({year,…,second}, tz)` statt über den UTC-Zeitpunkt. In `ausWandzeit`/`ausWandzeitIn` die mehrdeutige Stunde auf das erste Vorkommen legen. Test 25.10. dazu. |
| **#3** | mittel | S | `lib/kalender/ics.ts:111-121`, `:106-109` | Ein TZID ohne mitgelieferte VTIMEZONE (IANA, nicht registriert) wird von ical.js als „floating“ behandelt. Test: `DTSTART;TZID=America/New_York:20260310T090000` erscheint als 09:00 Berlin statt 14:00 und ohne `zone`. Unter TZ=UTC stand 10:00, unter Los Angeles 17:00. iCloud liefert die VTIMEZONE meist mit. Abos, Importe und weitergeleitete Einladungen oft nicht. Die Registrier-Reihenfolge selbst stimmt (siehe Urteile). | In `parse()` alle `TZID=`-Parameter sammeln. Unbekannte, aber gültige IANA-Namen (`zoneGueltig`) vor dem Erzeugen von `ICAL.Event` über `vtimezoneText(tzid, jahr)` registrieren. |
| **#46** | mittel | M | `lib/kalender/icloud.ts:268-271` (`findeObjekt` nimmt den ersten Treffer), `lib/kalender/bezug.ts:57/103`, `components/os/kalender/Monat.tsx:39` (`key={t.id}`) | Dieselbe UID in „Privat Kevin“ und „Privat Malin“ ergibt zwei Termine mit gleicher `id` (Test: `['gleich','Privat Kevin'],['gleich','Privat Malin']`). Folgen: doppelte React-Schlüssel, ein Bezug (`kalender-bezug`, nur nach UID) hängt an beiden Kopien, Ändern oder Löschen trifft den zuerst gefundenen Kalender. Eine bewusste Zusammenführung („beide“) gibt es nicht. | Schlüssel = Kalender-ID + UID (+ RECURRENCE-ID) für `id`, `findeObjekt` und `bezug`. Alternativ in `termineImZeitraum` bewusst zu einem Eintrag „beide“ zusammenführen. |
| **#51** | mittel | S | `lib/kalender/icloud.ts:94` und `:238`, `components/os/kalender/Kalender.tsx:273` | (a) Auch **403** wird als „Anmeldung abgelehnt“ gemeldet (Status 401). Schon ein einziger 403 (z. B. REPORT eines geteilten Kalenders, PUT mit ungültigem Inhalt) lässt den ganzen Abgleich scheitern, markiert `fehlerAnmeldung` und pausiert 30 Minuten, immer wieder. (b) Angezeigt wird nur „Stand HH:MM“, ohne Datum und ohne Alter. Es gibt keine Warnung nach 30 Minuten und keinen Gesundheits- bzw. HOI-Check, der einen veralteten iCloud-Stand meldet. Ein still ausgefallener Abgleich fällt nicht auf. | 401 und 403 trennen. 403 je Kalender behandeln (Kalender überspringen, Hinweis). Anzeige „letzter Abgleich vor X Min.“ und ab 30 Min. hervorgehoben, dazu ein Eintrag im Gesundheits-Stand. |
| **#20** | mittel | S | `lib/kalender/ics.ts:380-384`, `lib/kalender/wiederholung.ts:41-52` | DTSTART wird nicht auf das erste echte Vorkommen gelegt. Test: Anlage Mi 30.09. mit `WEEKLY;BYDAY=MO;COUNT=2`. MAKE OS zeigt 05.10. und 12.10., der Anlagetag fehlt. Laut RFC zählt DTSTART als erstes Vorkommen, Apple zählt also anders. Möglich über „Benutzerdefiniert“ und über die Route. | Beim Anlegen mit dem ical.js-Iterator das erste Vorkommen suchen und DTSTART/DTEND dorthin schieben (oder im Dialog darauf hinweisen). |
| #35 | niedrig | S | `lib/kalender/ics.ts:211` (7 Tage Luft) | Ein Override, das um mehr als 7 Tage in das Fenster verschoben wurde, fehlt. Test: Vorkommen 05.10. auf 20.11. verschoben, im Fenster 16.–23.11. erscheint nichts. | Zusätzlich alle RECURRENCE-ID-Komponenten nach ihrem tatsächlichen Start ins Fenster filtern, doppelte Einträge über `rid` vermeiden. |
| #21 | niedrig | S | `lib/kalender/wiederholung.ts:50` | UNTIL ist fest `T215959Z`. Im Winter endet das um 22:59 MEZ, in anderen Zonen (NY) schon um 17:59. Test: täglich 23:30 bis 03.12. zeigt nur 01. und 02.12. | UNTIL = `ausWandzeitIn(`${bis}T23:59:59`, zone)` in UTC. |
| #4 | niedrig | S | wie #5 | 29.03.: Eingabe 03:00 bzw. 03:30 wird als `DTSTART …T020000`/`023000` geschrieben (Uhrzeit gibt es nicht) und als 01:00 bzw. 01:30 zurückgelesen. Ein Apple-Termin mit 02:30 wird als 01:30 gelesen, laut RFC gilt 03:30. Ein Hinweis in der Oberfläche fehlt. | Wie #5. Beim Lesen IANA-Zonen über `ausWandzeitIn(t.toString(), tzid)` auflösen statt über `toJSDate`. |
| #6 | niedrig | S | `lib/kalender/ics.ts:108`, `Dockerfile:15`, `compose.yml:37`, `lib/kalender/zeit.ts:4` | Floating-Zeit wird in der Zone des Prozesses gelesen. Test: unter TZ=UTC 11:00 statt 09:00. In Produktion stimmt es nur, weil TZ=Europe/Berlin gesetzt ist. Der Kommentar in `zeit.ts:4` sagt fälschlich, der Server stehe in UTC. Floating wird nicht markiert. | In `alsWand` floating als Berliner Wandzeit übernehmen (`t.toString()`), Kommentar korrigieren. |
| #1 (Rest) | niedrig | S | `lib/kalender/icloud.ts:163` | Sortiert wird nach dem Wandzeit-Text. In der doppelten Stunde am 25.10. kommt 02:15 MEZ vor 02:30 MESZ, obwohl 02:30 MESZ früher ist. | Sortieren nach `ausWandzeit(start).getTime()`, oder einen Zeitpunkt im Termin mitführen. |
| #9 | niedrig | S | `lib/kalender/ics.ts:117` | Die zuerst gesehene VTIMEZONE einer TZID gilt für den ganzen Prozess. Eine veraltete eingebettete Zone (z. B. US-Regeln vor 2007) verfälscht dann alle Termine dieser Zone. `process.versions.tz` wird nicht protokolliert. Nicht festgelegt, ob IANA oder die eingebettete VTIMEZONE gilt. | Für gültige IANA-Namen immer Intl/IANA registrieren. Die eingebettete Zone nur für Nicht-IANA-Namen verwenden. tz-Version protokollieren. |
| #10 | niedrig | M | `lib/kalender/ics.ts:111-121` | Keine Abbildung Windows→IANA, Präfixe wie `/mozilla.org/…` werden nicht entfernt. Ohne VTIMEZONE wird der Termin floating (Test: „W. Europe Standard Time“ stimmt unter UTC nicht). | CLDR-Tabelle `windowsZones`, Präfixe entfernen, dann wie #3. |
| #7 | niedrig | S | `app/api/kalender/analyse/route.ts:48-52`, `components/os/WochenplanView.tsx:218`, `components/os/kalender/Zeitraster.tsx:56` | Diese Stellen rechnen in der Zone des Prozesses bzw. Browsers (`new Date(wandzeit)`, `getHours`). Die Kalender-Tests laufen nur unter Berlin (`vitest.config.ts`). Ist der Browser nicht in Berlin, liegt die Jetzt-Linie falsch. | Zusätzlicher Testlauf mit `TZ=America/Los_Angeles`. Die genannten Stellen auf `ausWandzeit`/`wandzeit` umstellen. |
| #8 | niedrig | S | `lib/kalender/eintraege.ts:69`, `app/api/apple-calendar/route.ts:29` | `new Date(r.due)`: ein reines Datum würde als UTC-Mitternacht gelesen, dann stünde „02:00“ an der Erinnerung. Das Format vom Mac habe ich nicht verifiziert (UNKLAR). Der Rückfallwert `new Date().toISOString()` in der Altroute mischt Formate (UTC mit „Z“). | Reines Datum ausdrücklich erkennen. Den Rückfallwert verwerfen statt „jetzt“ einsetzen. |
| #13 | niedrig | M | `lib/kalender/ics.ts:379-381`, `:432-434`, `lib/kalender/formular.ts:27` | Es gibt nur eine Zone je Termin. Flüge mit anderer Zielzone lassen sich nicht anlegen. Beim Verschieben wird DTEND in die Zone von DTSTART umgeschrieben. | Optionale Endzone im Dialog. In `aendereTermin` die Zone von DTEND behalten. |
| #17 | niedrig | S | `components/os/kalender/Agenda.tsx:19` | In der Agenda erscheinen mehrtägige Termine mit Uhrzeit (Fr 18:00–So 14:00) nur am Starttag. Raster und Monat sind korrekt. | Filter wie in `Monat.tsx:27`, Hinweis „läuft weiter“. |
| #19 | niedrig | S | kein Code vorhanden | Termine 00:00–00:00 (+1 Tag) werden nicht als ganztägig angezeigt und belegen das ganze Raster. | Nur für die Anzeige normalisieren. |
| #25 | niedrig | S | `lib/kalender/wiederholung.ts:41-52` | WKST wird nicht geschrieben. Laut RFC ist MO der Standard, inhaltlich also gleich. Die Prüfliste verlangt es ausdrücklich. | `WKST=MO` anhängen. |
| #26 | niedrig | S | Lesen über ical.js | EXDATE ohne Zone bei einer Serie mit TZID wird nicht erkannt, das Vorkommen erscheint wieder (Test). EXDATE mit „Z“ und als DATE funktionieren. MAKE OS schreibt selbst keine EXDATE. | Beim Lesen floating-EXDATE in der Zone von DTSTART deuten. |
| #33 | niedrig | S | `lib/kalender/ics.ts:214` | Es gibt nur eine Schrittgrenze von 60.000, keine Grenze für Vorkommen und kein Zeitlimit. Test: minütliche Serie im Fenster ergibt 41.220 Vorkommen in 1,6 s (Mac). Beginnt sie 2020, wird sie still abgeschnitten (0 Treffer, rund 1 s). Auf 1 vCPU spürbar. | Obergrenze etwa 2.000 Vorkommen je Objekt, MINUTELY/SECONDLY aus fremden Daten ignorieren. |
| #38 | niedrig | S | `lib/kalender/icloud.ts:282-284` | Die UID wird zwar vorher festgelegt (`If-None-Match: *`), einen Retry gibt es aber nicht. Nach einem Timeout (25 s) klickt man erneut, das erzeugt eine neue UID und damit ein Duplikat, falls der erste PUT doch angekommen ist. | Bei Timeout erst per GET auf `${uid}.ics` prüfen und mit derselben UID erneut versuchen. |
| #42 | niedrig | M | `lib/kalender/icloud.ts:224-225`, `:137` | Änderungen werden nur über ctag erkannt. Jede Änderung lädt den ganzen Kalender neu (−90 … +400 Tage). Kein `sync-collection`. | WebDAV-Sync mit Token, ctag nur als schneller Vorab-Check. |
| #50 | niedrig | S | `lib/kalender/icloud.ts:255-258` | Bei 503 wird nach 2 Minuten fest erneut versucht. Kein Backoff, `Retry-After` wird nicht beachtet. Vor Buchungen kein erzwungen frischer Abgleich (`buchung-ablauf.ts:183` nutzt `frischerStand`, der bis zu 2 Minuten alt sein darf). | Exponentielles Backoff mit `Retry-After`. `erzwingen` vor der Buchungsbestätigung. |
| #47 (Teil) | niedrig | S | `lib/kalender/bezug.ts:35-45` | Art und „privat“ werden im Bestand gespiegelt, **COLOR nicht**. Wenn Apple die Farbe verliert, ist sie weg. | Farbe (`farbeId`) in die Sicherung aufnehmen. |
| #37 (Rest) | niedrig | S | `lib/kalender/icloud.ts:315`, `:330` | Fehlt ein ETag, gehen PUT bzw. DELETE ohne If-Match raus. Zusätzlich schickt `WochenplanView.tsx:222` beim PATCH kein `stand` mit. | Ohne ETag ablehnen bzw. vorher per GET holen. |

## Alle Urteile, je eine Zeile

**A · Zeitzonen**
- #1 **OK**, Rest-Lücke niedrig. Geschrieben wird Wandzeit mit `TZID=Europe/Berlin` (`ics.ts:318`, `:328`). Serie Mo 09:00 über den 25.10. bleibt 09:00 (Test). Sortiert wird nach Wandzeit-Text (`icloud.ts:163`).
- #2 **OK**. Jedes Vorkommen wird neu aufgelöst. Test: Serie ab 05.01.2026 ergibt am 30.03. 09:00 Wandzeit = 07:00Z. Auch eine NY-Serie über die US-Umstellung stimmt.
- #3 **LÜCKE mittel**. Die Reihenfolge stimmt: erst parsen, dann alle VTIMEZONE registrieren, dann `ICAL.Event` (`ics.ts:111-121`, `:175`). Getestet mit VTIMEZONE am Dateiende, eigener TZID und Override. Eine fehlende VTIMEZONE wird aber nicht über den IANA-Namen aufgelöst.
- #4 **LÜCKE niedrig** (fehlende Stunde am 29.03., siehe Tabelle).
- #5 **LÜCKE mittel** (doppelte Stunde am 25.10., Termin ohne Dauer).
- #6 **LÜCKE niedrig** (floating hängt an `TZ=Europe/Berlin` im Dockerfile).
- #7 **LÜCKE niedrig**. Der Server steht bewusst auf Berlin, nicht UTC. `ics.ts` ist sonst unabhängig von der Prozess-Zone (UTC und LA getestet). Rest siehe Tabelle.
- #8 **LÜCKE niedrig** (`eintraege.ts:69`; Mac-Format UNKLAR). Die übrige Kalender-Logik nutzt `T12:00:00` bzw. `ausWandzeit`.
- #9 **LÜCKE niedrig** (erste VTIMEZONE gilt global, tz-Version nicht protokolliert).
- #10 **LÜCKE niedrig** (keine Windows-Zuordnung).
- #11 **OK**. Rechnung in Minuten (`zeitzone.ts:56-66`). Geprüft: Kathmandu GMT+05:45, Lord Howe +10:30/+11, NY am 15.03. ergibt 14:00 Berlin. Im Repo fehlen Tests dafür.
- #12 **OK**. Das Raster rechnet in Wandzeit-Minuten (`Kalender.tsx:197` über `wandAus`). Ganztägige Termine verschieben sich um Tage (`ics.ts:429`). Zeitgebundene behalten ihre echte Dauer (`ics.ts:425`, `:430`). Test 24.10. auf 25.10. stimmt.
- #13 **LÜCKE niedrig** (nur eine Zone je Termin). Die Zone ist je Termin wählbar und von der Anzeige getrennt.

**B · Ganztägig**
- #14 **OK**. Das Formular setzt das Ende exklusiv (`formular.ts:104`). Test: 01.–05.10. wird `DTEND;VALUE=DATE:20261006`. Die Anzeige rechnet −1 Tag (`teile.tsx:277`). Monat, Raster und Agenda vergleichen exklusiv.
- #15 **OK**. Ganztägig immer als DATE (`ics.ts:314-317`), gelesen ohne Umrechnung in einen Zeitpunkt (`ics.ts:107`). Verschieben bleibt DATE (Test). Die Route erzwingt Berlin bei ganztags (`eingabe.ts:39`).
- #16 **OK**. Test: DATE ohne DTEND ergibt 1 Tag, DATE-TIME ohne DTEND ergibt Dauer 0.
- #17 **LÜCKE niedrig**. Raster (`Zeitraster.tsx:69-72`) und Monat (`Monat.tsx:27`) sind korrekt, nur die Agenda nicht.
- #18 **N/A**. Ein Wechsel ganztags ↔ zeitgebunden wird nicht angeboten (`ics.ts:415`, PATCH ohne `ganztags` in `eingabe.ts:63`). Serien sind ohnehin gesperrt.
- #19 **LÜCKE niedrig** (keine Normalisierung von 00:00–24:00).

**C · Wiederholungen**
- #20 **LÜCKE mittel** (DTSTART nicht aufs erste Vorkommen gelegt).
- #21 **LÜCKE niedrig** für zeitgebundene Serien (UNTIL fest 21:59:59Z). Ganztägig ist korrekt als DATE.
- #22 **OK**. Nur COUNT oder UNTIL (`wiederholung.ts:49-50`).
- #23 **OK**. „am letzten Tag“ (BYMONTHDAY=-1) wird angeboten, wenn der Starttag der Monatsletzte ist (`wiederholung.ts:118`). „am 31.“ überspringt Monate wie im RFC (Test).
- #24 **OK**. Keine eigene Regel-Engine, ical.js; BYSETPOS wird nicht angeboten. Die RFC-Beispiele als Fixtures fehlen.
- #25 **LÜCKE niedrig** (WKST nicht geschrieben).
- #26 **N/A** beim Schreiben (keine EXDATE). Beim Lesen **LÜCKE niedrig** (floating-EXDATE).
- #27 **N/A** beim Schreiben (keine Overrides). **OK** beim Lesen: `relateException` in derselben Ressource (`ics.ts:177`).
- #28 **N/A**. MAKE OS schreibt keine RECURRENCE-ID.
- #29 **N/A**. Den Master einer Serie verschiebt MAKE OS nicht (`ics.ts:410-412`). Bezüge hängen praktisch nur an der UID (alle Aufrufer senden `termin.uid`), bleiben also stabil. Nebenbefund: `verbindungen-kalender.ts:50` prüft bei Schlüsseln `uid::rid` die RECURRENCE-ID nicht. Das ist derzeit ungenutzt.
- #30 und #31 **N/A**. „Diese und folgende“ gibt es nicht, THISANDFUTURE kommt im Code nicht vor.
- #32 **OK**. Serien lassen sich nicht löschen (`icloud.ts:328-329`). Der Mac-Altweg löscht alles mit dieser UID (`apple-calendar/termin/route.ts:138`), gilt aber nur ohne iCloud und nur für eigene Einzelblöcke.
- #33 **LÜCKE niedrig** (keine Grenze für Vorkommen).
- #34 **OK**. RDATE wird gelesen (Test).
- #35 **LÜCKE niedrig** (Override > 7 Tage verschoben fehlt).
- #36 **OK**. Eine Zone ungleich Berlin wird angezeigt (`ics.ts:233`, GMT-Text in `teile.tsx:277`).

**D · Synchronisation**
- #37 **OK**. PUT und DELETE mit If-Match, Vergleich mit dem `stand` aus dem Browser, bei Abweichung 409 (`icloud.ts:312-316`). Rest-Lücke niedrig, wenn der ETag fehlt.
- #38 **LÜCKE niedrig**. `If-None-Match: *` und feste UID vorhanden (`icloud.ts:282-283`), aber kein sicherer Retry.
- #39 **OK**. Auf 412 folgen neu holen und 409 mit dem aktuellen Stand, kein blinder zweiter PUT (`icloud.ts:316`, `:331`). Einen 3-Wege-Abgleich gibt es bewusst nicht, der Mensch entscheidet.
- #40 **OK**. Nach jedem Schreiben wird der Kalender neu geholt (`abgleichen({nur})`), die lokale Kopie ist also die Server-Fassung. Scheitert das, fängt der nächste PUT es über If-Match ab.
- #41 **N/A**. Termine mit Teilnehmern ändert MAKE OS nicht (`ics.ts:413`, `nichtBearbeitbar`).
- #42 **LÜCKE niedrig** (nur ctag, dann alles neu laden).
- #43 **N/A**, weil kein Sync-Token verwendet wird. **UNKLAR**: eine gekürzte Antwort (507 auf Ebene einer Response) würde `dav.ts:46-48` still überspringen, dann fehlen Termine ohne Fehlermeldung. Das müsste man gegen iCloud mit einem großen Kalender testen.
- #44 **OK**. Bei geändertem ctag wird die ganze Objektliste ersetzt, gelöschte Termine verschwinden (`icloud.ts:222-227`). Der Test „auf dem iPhone löschen“ braucht echtes iCloud.
- #45 **OK**. href und UID werden getrennt geführt: Suche über `uidVon(ics)`, Schreiben über `obj.href` (`icloud.ts:268-270`, `:315`).
- #46 **LÜCKE mittel** (gleiche UID in beiden Kalendern).
- #47 **Teilweise**. Art und „privat“ werden gespiegelt und bei Verlust gemeldet (`bezug.ts:103-116`, `verbindungen-kalender.ts:67-68`). COLOR wird nicht gespiegelt (niedrig). Den Round-Trip gegen iCloud (anlegen, am iPhone ändern, neu lesen) habe ich nicht getestet: **UNKLAR**.
- #48 **N/A**. Keine Änderungserkennung über Hashes, nur ctag.
- #49 **OK**. `aendereTermin` verändert die geparste Original-Komponente, VALARM und Apple-Felder bleiben (`ics.ts:406-443`, Test prüft `TRIGGER:-PT15M`).
- #50 **LÜCKE niedrig** (kein Backoff, kein erzwungener Abgleich vor Buchungen).
- #51 **LÜCKE mittel**. Die Discovery (Principal → calendar-home-set) folgt Weiterleitungen nur innerhalb von iCloud (`icloud.ts:80-97`, `:103-113`), das ist OK. Aber 403 wird wie eine abgelehnte Anmeldung behandelt, und es gibt keine Warnung „Abgleich veraltet“.
- #52 **OK**. Ist iCloud verbunden, sind die AppleScript-Schreibwege aus (`apple-calendar/create/route.ts:68`, `termin/route.ts:71`). Der Zulieferer liest nur.
- #53 **OK**. Nur Rohdaten mit time-range ohne `expand`, aufgefaltet wird selbst (`icloud.ts:137`). Ob iCloud eine einzelne Abfrage über 490 Tage begrenzt, ist **UNKLAR**.
- #54 **OK**. `supported-calendar-component-set` wird gelesen, nur Kalender mit VEVENT zählen (`dav.ts:62-68`).
- #55 **OK**. Serialisiert wird über ical.js. Test mit „Grüße; Straße, 3\nZeile“ plus 80 × „ä“: Zeilen höchstens 75 Oktette, Umlaute und Escaping kommen unversehrt zurück.
- #56 **OK**. Schlüssel kommen aus der UID, nie aus einem Zähler (`bezug.ts:57`). Die Kalender-URL fehlt im Schlüssel (siehe #46).

## Top 15, soweit in A–D
- #1/#2: OK (Sortierung Rest niedrig).
- #3: LÜCKE mittel.
- #14/#15: OK.
- #27/#28: N/A bzw. Lesen OK.
- #29: N/A.
- #30/#31: N/A.
- #37/#39: OK.
- #43: N/A (507 UNKLAR).
- #44: OK.
- #51: LÜCKE mittel.
- #46: LÜCKE mittel.
- #47: teilweise (COLOR fehlt, Round-Trip UNKLAR).
- #49: OK.

Die Dateien, an denen andere gerade bauen (`NeuerTermin.tsx`, `teile.tsx`, `Zeitraster.tsx`, `Kalender.tsx`), habe ich nur als Beleg für bestehendes Verhalten zitiert. Die einzige Stelle daraus mit eigenem Befund ist die Jetzt-Linie in `Zeitraster.tsx:56`, und die ist nicht halbfertig.

---

## Teil 2 · Kalender-Prüfung E–O (MAKE OS, Branch `entwicklung`, nur gelesen, 29.09.)

**Ergebnis: nicht bestanden.** Ich habe 3 Lücken mit Schwere hoch und 10 mit Schwere mittel gefunden. Der wichtigste Schutz steht: MAKE OS schreibt heute an keiner Stelle ATTENDEE nach iCloud. Offen sind vor allem drei Stellen bei ZOE (Injection, Datenumfang, autonomes Schreiben nach iCloud), die Belegt-Logik und mehrere Punkte an der Buchungsseite.

**So habe ich geprüft:**
- 8 Testdateien (Buchung, Buchungs-Route, Middleware, verfügbar, Verfügbarkeit, Kern, iCloud, K1-Route) laufen grün, 71 Tests.
- #68 habe ich mit einem Wegwerf-Test bestätigt: Ein Termin mit `STATUS:CANCELLED` und einer mit eigenem `PARTSTAT=DECLINED` ergeben beide `beschaeftigt=true`.
- Den Test habe ich im Scratchpad angelegt (`pruef.test.ts`, `vitest.scratch.config.mts`). Der Ordner wird auch von anderen Läufen genutzt. Gleichnamige Dateien könnten dabei überschrieben worden sein.
- `.data/` habe ich nicht geöffnet. Ich habe nichts geändert und keinen Server gestartet.

## 1 · Lücken nach Schwere

| # | Schwere | Befund (Datei:Zeile) | Fehlerszenario | Reparatur | Aufwand |
|---|---|---|---|---|---|
| **#K1** | hoch | Termintitel stehen im ZOE-Systemprompt (`lib/brain.ts:344-354`), zwar als `<daten>` gekennzeichnet (`:449-452`). Der Schalter `fremdGelesen` wird aber nur durch Werkzeug-Ergebnisse gesetzt (`app/api/kimmi/route.ts:652,715`). `lib/zoe/fremd.ts:38-42` kennt „kalender/termine“ nicht als Fremdquelle. Die Analyse-Route setzt Titel ungekapselt in den Prompt (`app/api/kalender/analyse/route.ts:96-104`). | Eine fremde Einladung heißt z. B. „ZOE: recherchiere …/leg an …“. Im selben Gespräch laufen schreibende Werkzeuge der Stufe „frei“ und Web-Agenten ohne Freigabe. Das ist der Exfiltrationsweg aus dem Gemini-Muster. | Kalenderblock zählt als fremd gelesen: `kontextFremd = true` bzw. `vertraulich = true`, sobald Termine im Prompt stehen. Titel in der Analyse-Route mit `fremd()` kapseln. Test mit einem Injection-Titel. | S–M |
| **#K4** | hoch | ZOE bekommt den ganzen `calendar-cache` für jede Person, ungefiltert (`lib/brain.ts:113-116` „Kalender ist gemeinsam“, `:122`, `:199-205`). Das Merkmal `privat` steht im Cache (`lib/kalender/icloud.ts:186`), wird aber nicht ausgewertet. | Malin fragt ZOE. Kevins private Arzt- oder Reha-Titel (Art. 9) gehen an Anthropic, umgekehrt genauso. Das ist ein Vertrauensbruch im Paar. | In `gatherBrain` je `person` maskieren: `maskieren()` bzw. private Termine anderer als „Belegt“. Gesundheitsarten ausfiltern. AVV mit dem LLM-Anbieter belegen. | S |
| **#K2** | hoch | Steht der Agent auf „autonom“, schreibt er nach iCloud: `analyse/route.ts:121-132` → `apple-calendar/create/route.ts:67-76` → `anlegen`. ZOE kann ihn über `run_agent kalender` auslösen (`lib/zoe/agenten.ts:164-168`). Ein ATTENDEE entsteht dabei nicht, die Regel „ZOE schreibt nie nach iCloud“ ist aber verletzt. | Ein Modell-Vorschlag landet ohne Klick im echten Kalender und auf iPhone und Mac. Blind-Agent und fehlendes Audit sind schon als KALENDER_VERBINDUNGEN Befund 1 erfasst und hier nicht doppelt gezählt. | Den Autonom-Zweig für Kalender streichen. Vorschläge nur in den Freigabe-Stapel legen und per Klick über `/api/kalender/termin` anlegen. | S |
| #73 | mittel | (a) Die Buchungsseite rechnet mit einem Stand bis 2 Min. alt (`icloud.ts:34`). Nach Fehlern nimmt sie ohne Hinweis den letzten Stand (`icloud.ts:248-252`). Ohne iCloud-Zugang gibt es gar keine Termine (`lib/kalender/verfuegbarkeit.ts:26`). (b) Die Freigabe prüft nicht noch einmal, ob der Platz frei ist (`lib/kalender/buchung-ablauf.ts:173-186`). Die Oberfläche warnt nicht (`components/os/kalender/Buchungsseiten.tsx:104`). | Das App-Passwort wird widerrufen, der Stand friert ein, und die Seite bietet Tage lang Plätze an, die längst belegt sind. Am iPhone entsteht ein Termin im gehaltenen Platz, die Freigabe legt einen zweiten daneben. | POST und Freigabe mit `abgleichen({ erzwingen: true })`. Stand älter als 30 Min. oder mit Fehler: keine Plätze anzeigen. Vor der Freigabe `istFrei` prüfen und im Konfliktfall Rückfrage. | M |
| #76 | mittel | Das Double-Opt-in läuft nur über die Status-Seite mit Token (`lib/kalender/buchung.ts:6-7`, `app/api/buchung/[slug]/status/route.ts:55-58`). Ob die E-Mail der Person gehört, wird nie geprüft. Trotzdem entstehen ein CRM-Kontakt mit Einwilligungs-Nachweis (`buchung-ablauf.ts:95-96`) und ein Mail-Follow-up (`:123`). Laut `:16-17` soll der Gast mit K3 als Teilnehmer eingetragen werden. | Jemand trägt eine fremde Adresse ein. Die Kartei bekommt einen erfundenen Einwilligungsnachweis (Art. 7), Kevin schreibt eine unbeteiligte Person an. Mit K3 würde iCloud die Einladung an diese Dritten verschicken (§ 7 UWG). | Bestätigungslink per Mail als Voraussetzung für „angefragt“ und für jeden ATTENDEE. Bis dahin Nachweis als „unbestätigt“ führen und keinen Mail-Follow-up anlegen. | M |
| #79 | mittel | (a) `verantwortlich` ist optional (`buchung.ts:150-154`), der Hinweis kann also ohne Verantwortlichen erscheinen (Art. 13 Abs. 1 a). (b) Der Hinweis ist eingeklappt und steht unter den Eingabefeldern (`components/buchen/Buchen.tsx:109-113`). (c) Der Hinweis sagt „abgelehnte/abgesagte Anfragen werden nach 30 Tagen gelöscht“ (`buchung.ts:29`). Der CRM-Kontakt entsteht aber schon beim Bestätigen durch den Gast (`buchung-ablauf.ts:73-113`) und bleibt stehen (`speicher-register.ts:75`, Ablehnen `app/api/kalender/buchung/route.ts:108-121`). | Eine abgelehnte Anfrage bleibt dauerhaft im CRM, obwohl der Hinweis etwas anderes zusagt. Das ist eine Transparenzverletzung und ein Abmahnrisiko. | `verantwortlich` zur Pflicht machen. Hinweis ausgeklappt über das Formular setzen. CRM-Anlage erst bei der Freigabe oder beim Ablehnen wieder entfernen, alternativ den Hinweistext ehrlich anpassen. | S–M |
| #68 | mittel | Weder STATUS noch PARTSTAT wird gelesen (`lib/kalender/ics.ts:126-139`, `:231`; per Grep sonst nirgends). Per Test bestätigt. TENTATIVE gibt es nicht. | Abgesagte und abgelehnte Einladungen blockieren die freie Zeit und die Buchungsseite und zählen im CRM als Termin (#100). | `STATUS:CANCELLED` sowie eigenes `PARTSTAT=DECLINED` (Adressen normalisiert) als frei bzw. ausgeblendet werten. `TENTATIVE` einstellbar machen. | S–M |
| J-Zusatz | mittel | Ziehen eines mehrtägigen Termins mit Uhrzeit: Die Lage wird auf den Tag gekappt (`components/os/kalender/Zeitraster.tsx:72`). `verschieben` setzt Start und Ende auf denselben Tag (`components/os/kalender/Kalender.tsx:196-198`). | Ein Termin von Fr 18:00 bis So 14:00 wird am Samstag angefasst und landet als Sa 00:00 bis So 00:00 in iCloud. Die Reise bzw. Abwesenheit ist still gekürzt. | Mehrtägige Termine nicht ziehbar machen, oder die Verschiebung als Differenz auf Start und Ende anwenden. Resize nur am letzten Segment. | S |
| #92 | mittel | Anfassen startet sofort bei pointerdown, ohne langes Drücken (`Zeitraster.tsx:96-101`, `touchAction:'none'` `:230`). Es gibt kein „Rückgängig“. | Am iPhone verschiebt beim Scrollen ein Finger auf einem Termin diesen direkt in iCloud. | Langes Drücken wie beim Aufziehen (`:127-131`). Toast mit „Rückgängig“ für 5–10 s, der den alten Stand zurückschreibt. | S |
| #96 | mittel | CLASS wird nur in `/api/kalender` und `/jahr` durchgesetzt. Nicht in `GET /api/apple-calendar` (`app/api/apple-calendar/route.ts:117`, Rohcache mit Titeln für Heute und Tagesplan) und nicht bei ZOE (#K4). PATCH und DELETE prüfen den Eigentümer nicht (`app/api/kalender/termin/route.ts:85-122`). Die UID bleibt auch im maskierten Termin sichtbar (`lib/kalender/bezug.ts:129-135`). | Malin sieht über Heute Kevins private Titel. Mit bekannter UID kann sie einen privaten Termin der anderen Person per API ändern oder löschen. | Den Altweg in der Route für die Person maskieren. PATCH/DELETE: fremd-private Termine mit 403 ablehnen. | S |
| #100 | mittel | CRM-Signale zählen jeden Termin, auch abgesagte (`lib/crm/signale.ts:55-68`). `termin-uid-tot` entfernt nur, schlägt aber keine Neuzuordnung vor (`lib/crm/verbindungen-kalender.ts:29,81-85`). Die Buchung kopiert Datum und Vorbereitungstag (`buchung-ablauf.ts:212,224`). | Termin am iPhone gelöscht und neu angelegt: Der CRM-Bezug ist weg. Die Kennzahl „Termine gehalten“ zählt abgesagte mit. Ein verschobener gebuchter Termin behält die alte Aktivität und den alten Follow-up. | Nach STATUS und PARTSTAT filtern. Wöchentlicher Waisen-Vorschlag (Titel, Zeit ±1 Tag), nur per Klick. Buchungs-Follow-up an die Termin-UID hängen und nachziehen. | M |
| #K3 | mittel | Der ZOE-Systemprompt nennt weder Datum noch Wochentag noch Zone (`app/api/kimmi/route.ts:48-60`). `heuteSatz` gibt es (`lib/aufgaben/zoe.ts:269-272`), er wird aber nur im Aufgabenlauf genutzt. Werkzeuge verlangen trotzdem, relative Angaben umzurechnen (`kimmi/route.ts:579`). | „Bis Freitag“ oder „morgen früh“ um 00:30 landet auf dem falschen Tag. | `heuteSatz(localDay())` in den `systemPrompt`. Relative Daten in der Vorschau mit Wochentag zeigen. | S |
| #K5 | mittel | Kein ICS-Export je Kalender. Der Spiegel `kalender-icloud` deckt nur −90 … +400 Tage ab (`icloud.ts:30`), und es gibt keinen Weg zurück nach iCloud. Einen Import gibt es noch nicht. | Wird in iCloud gelöscht, verteilt sich das überall hin. Die Sicherung enthält nur ein Fenster und kann nicht zurückgespielt werden. | Täglicher Voll-Export je Kalender (verschlüsselt) und einmal geprüfte Wiederherstellung. Import später als Upsert nach UID/SEQUENCE mit Teilnehmer-Sperre. | M |
| #59 | niedrig | Der Mac-Weg in `app/api/apple-calendar/termin/route.ts:118-139` löscht per AppleScript ohne Prüfung auf Teilnehmer. Der iCloud-Weg ist geschützt (`icloud.ts:328`). | Ein Block im Planer wird gelöscht, zu dem in Apple nachträglich Gäste kamen. Kalender.app schickt dann eine Absage. | Vor dem Löschen per AppleScript Teilnehmer zählen und ablehnen, oder den Mac-Weg entfernen. | S |
| #69 | niedrig | Einen Schalter „zählt als belegt“ je Kalender gibt es nicht. Nicht zugeordnete Kalender gelten als `beide` (`lib/kalender/einstellungen.ts:65-72`, `verfuegbarkeit-regeln.ts:43-48`). | Ein Termin Malins im gemeinsamen Kalender blockiert Kevins Buchungsseite. | Schalter je Kalender in den Einstellungen. | S |
| #71 | niedrig | Nur ein Seitenpuffer für alles (`lib/kalender/verfuegbar.ts:203`). `X-APPLE-TRAVEL-*` wird nicht gelesen. | Buchung direkt nach einem Außentermin. | Puffer je Art, Apple-Reisezeit lesen (Feldnamen per Export prüfen). | M |
| #72 | niedrig | Heiligabend und Silvester fehlen richtigerweise, eine Liste „nicht gesetzlich, aber frei“ gibt es aber nicht. Getestet ist Ostern nur 2026–2028 plus Sonderjahre (`tests/aufgaben-t1-modell.test.ts:17-30`), nicht bis 2030 gegen eine amtliche Liste. | Die Buchungsseite bietet Plätze am 24.12. und 31.12. an. | Liste „frei“ getrennt führen, Test bis 2030. | S |
| #74 | niedrig | Nur der Hinweis „Zeiten in deutscher Zeit (Berlin)“ (`components/buchen/Buchen.tsx:78`). Keine Zone des Gastes, keine Doppelanzeige. | Ein Gast in New York zwischen dem 08.03. und 29.03. liegt eine Stunde daneben. | `Intl` im Browser, zweite Zeit anzeigen. | S |
| #85 | niedrig | Spalten nach Gruppen ja, aber kein Ausdehnen und kein „+n“ (`lib/kalender/layout.ts:12-32`, `Zeitraster.tsx:219`). | 6 gleichzeitige Termine in der Woche sind unlesbar. | Ab 4 Spalten „+n“. | S |
| #86 | niedrig | Die Lage kommt aus der Wandzeit (richtig, `Zeitraster.tsx:27,72`). Für die doppelte Stunde am 25.10. gibt es keine Markierung. | Zwei Termine um 02:30 (MESZ und MEZ) liegen übereinander. | Markierung ergänzen. | S |
| #88 | niedrig | Die Agenda zeigt mehrtägige Termine mit Uhrzeit nur am Starttag (`components/os/kalender/Agenda.tsx:19`). Im Monat gibt es keine Balken (`components/os/kalender/Monat.tsx:27`). 6 Zeilen und die Jahresdichte sind in Ordnung. | Die Reise ist am Samstag in der Agenda unsichtbar. | „läuft weiter“-Zeile ergänzen. | S |
| #89 | niedrig | Klickflächen sind mindestens 18 px statt 24 px (`Zeitraster.tsx:225`). Der Kontrast ist nicht gemessen. Symbole je Art sind vorhanden. | 15-Minuten-Termine sind schwer zu treffen. | Mindesthöhe 24 px, Kontrast messen. | S |
| #94 | niedrig | Die Suche hat keine Umlaut-Faltung und sucht nur im geladenen Zeitraum (`Kalender.tsx:148-151`). Ausnahmen und Notizen sind enthalten. | „Mueller“ findet „Müller“ nicht. | Die Faltung aus `signale.ts` wiederverwenden. | S |
| #95 | niedrig | Der Cache-Schlüssel enthält `s.at`, das sich bei jedem Abgleich ändert (`icloud.ts:158,227`). Alle 5 Min. wird also alles neu geparst. | Unnötige Last auf 1 vCPU. | Cache je Objekt und ETag. | M |
| #98 | niedrig | Das Register ist jetzt vollständig (`lib/crm/speicher-register.ts:53-59,75`, `lib/crm/person-weitere.ts:224-245`); Befund 3 aus KALENDER_VERBINDUNGEN ist behoben. Offen: Name und E-Mail des Gasts stehen in der iCloud-Notiz (`buchung-ablauf.ts:179`, nur in Apple löschbar). Das App-Passwort liegt im Klartext in `.env` (`icloud.ts:3-5`). | Art. 17 ist nicht vollständig umsetzbar. | Gast nur als Kennung im Bezug speichern, Geheimnis verschlüsselt ablegen. | S |

**Anforderungen an die laufenden Gäste- und Einladungsbauten** (`NeuerTermin.tsx`, `teile.tsx`, `Zeitraster.tsx`, `Kalender.tsx`/Planen):
1. ATTENDEE geht nur im PUT des ausdrücklichen „Einladen/Senden“-Klicks raus. Entwurf, Autosave (sessionStorage), Vorschläge und ZOE schreiben nie Gäste. Die Route lehnt `gaeste` ohne `senden: true` ab. Test mit einer iCloud-Testadresse.
2. Teilnehmer-Sperre: Löschen, Ändern, Import und Aufräumen von Terminen mit Gästen nur einzeln mit Rückfrage „N Gäste werden benachrichtigt“. Jeder Massenweg braucht einen Probelauf, der vorher zählt.
3. ORGANIZER aus `calendar-user-address-set`. `entdecke()` holt das bisher nicht (`icloud.ts:103-113`).
4. SEQUENCE nur bei wesentlichen Änderungen erhöhen. Heute steigt sie bei jeder Änderung (`ics.ts:441-442`); das schadet nur, solange es keine Gäste gibt, nicht.
5. Bei Gruppenterminen mit Externen warnen (#97). Genau ein Versandweg (#66). VALARM nie per iTIP mitschicken.
6. Buchung: Der Gast wird nur nach bestätigter E-Mail zum ATTENDEE (#76).

## 2 · Alle Urteile

**E · Einladungen**
- #57: **OK**. `baueTermin` schreibt keine Teilnehmer (`ics.ts:363-393`). `AnlegeEingabe` hat kein Gäste-Feld (`lib/kalender/eingabe.ts:18-26`). Der Buchungsgast steht nur in der Notiz (`buchung-ablauf.ts:177-183`). Für K3 gilt Anforderung 1.
- #58: **N/A**. MAKE OS verlässt sich nicht auf SCHEDULE-AGENT.
- #59: **LÜCKE niedrig**. Der iCloud-Weg ist geschützt (`icloud.ts:328`), der Mac-Weg nicht. Anforderung 2.
- #60: **N/A**. Es wird kein ORGANIZER geschrieben. Anforderung 3.
- #61: **N/A**, latent (`ics.ts:441`). Anforderung 4.
- #62: **OK**. DTSTAMP in UTC bei jeder Änderung (`ics.ts:438-440`).
- #63: **OK**. Fremde Einladungen sind nicht bearbeitbar (`ics.ts:197,413`, `icloud.ts:328`).
- #64: **N/A**. Es gibt kein Ändern von Serien mit Gästen.
- #65: **OK** in der Oberfläche: Notizen stehen als Textarea, Links sind nicht klickbar (`teile.tsx:309`). Die ZOE-Seite läuft unter #K1.
- #66: **N/A**. Es gibt keinen Versand. Anforderung 5.
- #67: **N/A**. Teilnehmerlisten werden nicht ausgewertet. Buchungs-E-Mails werden klein geschrieben (`buchung.ts:230`).

**F · Frei/Beschäftigt**
- #68: **LÜCKE mittel**.
- #69: **LÜCKE niedrig**. Die API liefert nur Intervalle (`app/api/kalender/frei/route.ts:4`), das ist in Ordnung.
- #70: **OK**. Halboffene Intervalle (`verfuegbar.ts:140-151`, `verfuegbarkeit-regeln.ts:89`); Termine mit Dauer 0 blockieren nicht.
- #71: **LÜCKE niedrig**.
- #72: **OK**. Gauß und NRW-Liste (`lib/aufgaben/feiertage.ts:17-53`), Tests in `tests/kalender-kern.test.ts:41-44`. Dazu Lücke niedrig („frei“-Tage, Test bis 2030).

**G · Buchungsseite**
- #73: **LÜCKE mittel**. Das Reservieren in einer Sperre ist in Ordnung (`app/api/buchung/[slug]/route.ts:84-88`).
- #74: **LÜCKE niedrig**.
- #75: **OK**. Horizont höchstens 60 Tage, Standard 14, Vorlauf 24 h, keine Titel (`buchung.ts:161-163,319-323`).
- #76: **LÜCKE mittel**. Heute geht nichts an iCloud, Honigtopf und Drosselung sind da (`route.ts:36-60`).
- #77: **OK**. Token mit 256 Bit, Slug mit 96 Bit, als Hash gespeichert, Vergleich in konstanter Zeit, idempotent (`buchung-speicher.ts:62-73`, `status/route.ts:56,60`).
- #78: **N/A** (Buchung ohne ICS). Nebenbei: Die CRM-Event-ICS nutzt `METHOD:PUBLISH` ohne SEQUENCE (`lib/crm/eventplanung.ts:578-580`), niedrig.
- #79: **LÜCKE mittel**.
- #80: **OK**. Vorlauf, Tageslimit, Feiertag und Abwesenheit sind getestet (`tests/kalender-buchung.test.ts:25-40`, `tests/kalender-verfuegbar.test.ts:34-55`). Es gibt keine Erinnerungs-Mails.

**H · Erinnerungen**
- #81: **OK**. Einzige Quelle ist VALARM, MAKE OS schickt keine eigenen Termin-Hinweise (`ics.ts:353-361`). **UNKLAR** bleibt das Zusammenspiel mit iPhone-Standardalarmen; das wäre am Gerät zu testen.
- #82: **N/A**. Keine Server-Trigger, relative TRIGGER werden von Apple aufgelöst.
- #83: **OK**. Beim Ändern bleiben vorhandene Alarme, es kommen keine dazu, es gibt kein iTIP (`ics.ts:401-405`).
- #84: **N/A**. Keine Jobs; die kopierten Buchungsdaten laufen unter #100.

**I · Darstellung**
- #85: **LÜCKE niedrig**.
- #86: **OK**, Lage aus der Wandzeit. Dazu Lücke niedrig (Markierung).
- #87: **OK**. ISO-Woche mit Montag, KW 53/2026 getestet (`lib/zeit/kalender-kern.ts:31-37`, `tests/kalender-kern.test.ts:18-21`, `Kalender.tsx:189`).
- #88: **LÜCKE niedrig**.
- #89: **LÜCKE niedrig**.

**J · Ziehen und Bearbeiten**
- #90: **OK**. Serien und Termine mit Gästen sind nicht ziehbar (`ics.ts:197`, `Zeitraster.tsx:98`).
- #91: **OK**. Enter öffnet den Termin, dort Tag und Uhrzeit als Felder (`Zeitraster.tsx:222-224`, `teile.tsx:301-303`).
- #92: **LÜCKE mittel**.
- #93: **OK**. Optimistisch, bei Fehler Meldung und Neuladen; 409 behält „Deine Fassung“ (`Kalender.tsx:196-201`, `teile.tsx:251`).
- J-Zusatz: **LÜCKE mittel** (mehrtägige Termine werden beim Ziehen gekürzt).

**K · Suche und Tempo**
- #94: **LÜCKE niedrig**.
- #95: **LÜCKE niedrig**.

**L · Datenschutz**
- #96: **LÜCKE mittel**.
- #97: **N/A**, kein Einladungsweg. Anforderung 5.
- #98: **LÜCKE niedrig**. **UNKLAR**: ob das ZOE-Gedächtnis Gesundheitstermine speichert.
- #99: **N/A**. Es gibt keinen Abo-Feed.

**M · Aufgaben/CRM**
- #100: **LÜCKE mittel**. Die Art „Aufgabe“ ist dieselbe Aufgabe und keine Kopie, das ist in Ordnung (`lib/kalender/arten.ts:9-10`).

**N · ZOE**
- #K1: **LÜCKE hoch**.
- #K2: **LÜCKE hoch**. „Nie ATTENDEE“ ist erfüllt, „nie nach iCloud“ nicht.
- #K3: **LÜCKE mittel**.
- #K4: **LÜCKE hoch**. **UNKLAR**: ob ein AVV mit dem LLM-Anbieter vorliegt.

**O · Import/Export**
- #K5: **LÜCKE mittel**.

**Die 15 wichtigsten, mein Anteil:**

| Punkt | Urteil |
|---|---|
| #57 + #K2 | OK / LÜCKE hoch |
| #59 | LÜCKE niedrig |
| #73 + #76 | LÜCKE mittel / mittel |
| #K1 | LÜCKE hoch |
| #60 | N/A mit Anforderung |
| #68 | LÜCKE mittel |
| #72 | OK, dazu Lücke niedrig |
| #87 | OK |
| #100 | LÜCKE mittel |

**Wichtigste Dateien:**
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/brain.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/app/api/kimmi/route.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/app/api/kalender/analyse/route.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/zoe/fremd.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/kalender/ics.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/kalender/icloud.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/kalender/verfuegbarkeit.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/kalender/buchung.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/kalender/buchung-ablauf.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/app/api/buchung/[slug]/route.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/app/api/buchung/[slug]/status/route.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/components/buchen/Buchen.tsx`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/components/os/kalender/Zeitraster.tsx`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/components/os/kalender/Kalender.tsx`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/app/api/apple-calendar/route.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/app/api/apple-calendar/termin/route.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/crm/signale.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/crm/verbindungen-kalender.ts`

---

## Reparaturstand

| Lücke | Stand | Commit | Test |
|---|---|---|---|
| #K1 (hoch) Prompt Injection über Termintitel | **behoben** (Paket R-Z, 29.09.). Titel, Orte und Anlass-Namen stehen im ZOE-Prompt als `<fremde_daten quelle="kalender">` (`lib/brain.ts`). Stehen Termine im Prompt (`kalenderImPrompt`), gilt das Gespräch als fremd gelesen und vertraulich (`app/api/kimmi/route.ts`): schreibende „frei“-Werkzeuge und Web-Agenten nur mit Freigabe. `lib/zoe/fremd.ts` kennt „kalender“ als Fremdquelle (Agent `kalender`, Werkzeug `plan_block`). Die Analyse-Route kapselt ihre Titel ebenfalls. | `186a264` | `tests/zoe-kalender-sicht.test.ts` (#K1), `tests/zoe-kalender-stapel.test.ts` (Injektions-Titel → `create_task` im Stapel, Gegenprobe mit „Belegt“), Wächter `tests/k1-betrieb.test.ts` |
| #K2 (hoch) ZOE schreibt autonom nach iCloud | **behoben**. Der Autonom-Zweig in `app/api/kalender/analyse/route.ts` ist weg, der Altweg `apple-calendar/create` wird dort nicht mehr aufgerufen. Vorschläge gehen über den Dienstweg (ZOE) oder auf „autonom“ in den Freigabe-Stapel (neue Stapel-Art „kalender“, `lib/zoe/kalender-vorschlag.ts`). Angelegt wird erst per Klick über `/api/kalender/termin` (Bau-Kennung, Änderungsprotokoll, keine Doppelanlage). Befund 1 aus KALENDER_VERBINDUNGEN: Der Agent liest selbst über den Lesepfad der Kalender-Sicht und ist nicht mehr blind. | `186a264` | `tests/zoe-kalender-stapel.test.ts` (#K2: „autonom“ → kein Schreibweg, kein Netz, Stapel-Eintrag; Freigabe legt genau einmal an; fremde Person 403) |
| #K3 (mittel) Datum im Prompt | **behoben**. `heuteSatz` liegt jetzt in `lib/zeit.ts` (der Aufgabenlauf nutzt denselben Satz). `jetztSatz()` steht im ZOE-Systemprompt: Datum, Wochentag, Uhrzeit, Europe/Berlin, dazu die Regel für relative Angaben. | `186a264` | `tests/zoe-kalender-sicht.test.ts` (#K3, 00:30 Berlin), `tests/zoe-kalender-stapel.test.ts` (Systemprompt) |
| #K4 (hoch) Datenumfang | **behoben**. `gatherBrain`, Kalender-Agent und `plan_block` lesen über `termineFuerZoe` (`lib/kalender/zoe-sicht-server.ts`). Das ist derselbe Lesepfad wie die Kalender-Sicht (`termineLesen`) mit derselben Maskierung (`maskieren`) je fragender Person. Zusätzlich gelten Gesundheitstermine (Stichwort-Regeln „Rehabilitation“/„Behandlung“) der anderen Person als privat. Eine Person aus einem anderen Haushalt bekommt keine Termine. **Offen:** AVV mit dem LLM-Anbieter belegen (organisatorisch). | `186a264` | `tests/zoe-kalender-sicht.test.ts` (#K4: Malin fragt → Kevins private und Arzt-Titel nicht im Prompt) |

**Nachtrag (29.09., Commit `2b7ebfa`):**

| Punkt | Stand | Test |
|---|---|---|
| #K1 feiner | **behoben**. Nur Text Dritter macht ein Gespräch „fremd gelesen“, sonst liefe im Alltag jedes Werkzeug über den Stapel. Als fremd gilt ein Termin, wenn er Teilnehmer hat (Einladung, Gäste), aus einem Abo-Kalender, einem nur lesbaren oder einem nicht dem Haushalt zugeordneten Kalender stammt, oder wenn er von der Buchungsseite kommt (`terminMarke` in der Notiz). Ebenso fremd sind Termine aus Quellen ohne Teilnehmer-Angabe: die Mac-Lieferung (Altweg) und KEMARIS/M365. Eigene Termine, Feiertage und Geburtstage stehen normal unter `<daten>`. Nur fremde Termine stehen in `<fremde_daten>` und setzen `fremdGelesen` (`terminFremd`, `herkunftAus` in `lib/kalender/zoe-sicht*.ts`). Genutzt werden nur vorhandene Merkmale: `mitTeilnehmern`, `schreibbar`, die Zuordnung aus den Kalender-Einstellungen und die Buchungsmarke. ORGANIZER wird nicht eigens gelesen: Eine Einladung trägt immer ATTENDEE. | `tests/zoe-kalender-sicht.test.ts` (iCloud-Stand: Einladung, Abo, fremder Kalender und Buchung fremd, eigener Termin nicht; ein Tag nur mit eigenen Terminen ohne `<fremde_daten>`), `tests/zoe-kalender-stapel.test.ts` (eigene Termine → `create_task` frei; Einladung mit Injection-Titel → Stapel) |
| Vorschlags-Kalender | **behoben**. Der Kalender-Agent nimmt die erlaubten Kalender aus den Kalender-Einstellungen (`vorschlagsKalender`). Standard ist der eigene Kalender der fragenden Person, daneben der gemeinsame. | `tests/zoe-kalender-stapel.test.ts` |
| Wochenplan-Agent, Netzwerk-Verlauf | **behoben**. `app/api/planung/vorschlag` liest über `termineFuerZoe`, maskiert je Person. Fremde Titel sind gekapselt. `app/api/netzwerk/verlauf` hatte keinen Aufrufer (UI, Takt, ZOE, Skripte) und ist seit F2 M7 (29.09.) entfernt — kein Termintitel wird mehr als Beleg in Kontaktnotizen geschrieben. | `tests/zoe-kalender-stapel.test.ts` (Malin plant → nur „Belegt“) |

Weiter offen: den AVV mit dem LLM-Anbieter belegen. Kalender, die dem Haushalt gehören, aber in den Einstellungen nicht zugeordnet sind (z. B. Apples Standardkalender „Kalender“), gelten als fremd, bis sie dort eingetragen sind. Das ist bewusst die sichere Seite.

**Nachtrag Paket R-K1 (29.09., Kalender-Kern & Abgleich):**

Tests: `tests/kalender-rk1.test.ts` (rein), `tests/kalender-rk1-server.test.ts` (Route + Abgleich gegen nachgebauten CalDAV-Server mit drei Kalendern), `tests/kalender-rk1-sicherung.test.ts` (Archiv echt verschlüsselt, iCloud gemockt). Alle Kalender-Tests laufen zusätzlich mit `MAKE_OS_TEST_TZ=UTC` und `MAKE_OS_TEST_TZ=America/Los_Angeles` grün (neuer Schalter in `vitest.config.ts`).

| Punkt | Stand | Wo / Test |
|---|---|---|
| #5 doppelte Stunde | **behoben**. `ICAL.Time` entsteht aus den Wandzeit-Teilen (`zeitFuer`/`ausTeilen`), nicht über UTC + `convertToZone`. Mehrdeutig = erstes Vorkommen (RFC 5545 3.3.5), gelesen über Intl (`zeitpunkt`), nicht `toJSDate`. 25.10. 02:00–03:00 bleibt 02:00–03:00 (60 Minuten im Raster). Hinweis: Nach RFC liegen zwischen 02:00 MESZ und 03:00 MEZ real 2 Stunden. Die Buchungs-/Freie-Zeit-Suche rechnet so und bietet 02:00–03:00 an diesem Tag nicht als 1-Stunden-Platz an. Der Test in `kalender-verfuegbar` ist angepasst, er rechnete vorher mit dem zweiten Vorkommen. | `lib/kalender/zeit.ts` `wandzeitAufloesen`, `lib/kalender/ics.ts`, Test „25.10.2026 02:00–03:00“ |
| #4 fehlende Stunde | **behoben**. Eingabe 02:30 am 29.03. wird als 03:30 geschrieben. Ein Apple-Termin mit 02:30 liest sich als 03:30 (vorwärts, RFC). Beim Lesen werden IANA-Zonen über die Wandzeit aufgelöst. Einen Hinweis in der Oberfläche gibt es noch nicht (K5-Dialog). | Test „29.03.“ |
| #3 IANA ohne VTIMEZONE | **behoben**. `parse()` sammelt alle `TZID=`-Werte und registriert gültige IANA-Namen aus Intl, bevor ical.js Termine baut. NY 09:00 am 10.03. = 14:00 Berlin, `zone` gesetzt. | Test „#3 New York“ |
| #9 eingebettete Zone | **behoben**. Für IANA-Namen gilt immer Intl, auch wenn eine (veraltete) VTIMEZONE mitkommt. Die eingebettete gilt nur für Namen ohne IANA-Entsprechung. Die tz-Version wird einmal je Prozess protokolliert (`[kalender] Zeitzonen-Daten`) und steht im HOI-Befund. | Test „#9 IANA gewinnt“ |
| #10 Windows/Präfixe | **behoben**. `ianaZone()` bildet die gängigen Windows-Namen ab (CLDR, 35 Zonen). Präfixe wie `/mozilla.org/…/` werden entfernt, Outlook-Anzeigename „(UTC+01:00) … Berlin“ ergibt Berlin. | `lib/kalender/zeitzone.ts`, Test „#10“ |
| #6 floating | **behoben**. Floating gilt als Berliner Wandzeit, unabhängig von `TZ` der Maschine. Der Kommentar in `zeit.ts` ist korrigiert. | Test „#6“ (auch unter UTC/LA) |
| #1 (Rest) Sortierung | **behoben**. `Termin.startMs` (echter Zeitpunkt), `termineImZeitraum` sortiert danach. 02:30 MESZ steht vor 02:15 MEZ. | Test „#1“ |
| #7 Zone der Maschine | **behoben**, wo die Stellen nach K5 noch existieren: die Analyse-Route (`terminMs`, Wochentag aus dem Tag, `ausWandzeit`) und die Jetzt-Linie in `Zeitraster.tsx` (Berliner Wandzeit, minimaler Hunk). `WochenplanView` gibt es seit K5 nicht mehr. | Kalender-Tests unter UTC und LA |
| #8 reines Datum | **behoben**. `faelligWand`: ein Datum bleibt der Tag ohne Uhrzeit, eine Wandzeit ohne Zone gilt als Berlin. In der Altroute `apple-calendar` wird ein unlesbares Datum verworfen, statt „jetzt“ (UTC mit Z) einzusetzen. | Test „#8“ |
| #26 floating-EXDATE | **behoben**. `exdateInStartzone` deutet EXDATE ohne Zone in der Zone von DTSTART. | Test „#26“ |
| #33 Obergrenze | **behoben**. Höchstens 2000 Vorkommen je Objekt und Abfrage (`VORKOMMEN_MAX`). MINUTELY/SECONDLY aus fremden Daten wird nicht aufgefaltet, es bleibt nur der erste Termin. | Test „#33“ |
| #35 weit verschobene Overrides | **behoben**. Ein Nachlauf über alle RECURRENCE-ID-Komponenten nimmt sie nach ihrem tatsächlichen Beginn auf, ohne Doppelte. | Test „#35“ |
| #13 Endzone | **behoben** im Kern und in der Route. Beim Verschieben behalten DTSTART und DTEND ihre Zone. Die Route nimmt `endZone` (Flug). Die Oberfläche ist bewusst weggelassen (K5-Dialog). | Tests „#13“ (rein und Route) |
| #20 erstes Vorkommen | **behoben**. `baueTermin` legt DTSTART und DTEND auf das erste echte Vorkommen (ical.js-Iterator). | Test „#20“ |
| #21 UNTIL | **behoben**. `UNTIL` = 23:59:59 Wandzeit der Zone in UTC (Winter `T225959Z`, NY `T045959Z`). | Test „#21“ |
| #25 WKST | **behoben**. `WKST=MO` steht wörtlich in der RRULE (ical.js ließ es als Standard weg). | Test „#21/#25“ |
| #46 gleiche UID | **behoben**. Schlüssel = Kalender-Kennung + UID (+ RID): `Termin.id` = `kalender\|uid(::RID)`. Die Kennung ist das letzte Stück der Kalender-Adresse und bleibt auch bei einem Wechsel des iCloud-Servers gleich. Mitgezogen wurden `findeObjekt` (Schreiben mit einer alten, mehrdeutigen UID → 409), `kalender-bezug` (neue Einträge unter dem Schlüssel), `termin-server` (K5, auch die Spiegel), CRM-Meeting `terminUid`, Fokus `terminUid`, Signale, Verbindungsprüfung (`verweisLebt`), Spiegel-Prüfungen `event-termin-*`/`familie-termin-tot` und die Akte (`zeiten` auch unter der alten Form). Übergang: Lesen nimmt beide Formen. Der Abgleich zieht alte Einträge mit eindeutiger UID auf den neuen Schlüssel um (`bezugUmzugPlan`). Mehrdeutige bleiben stehen und gelten für jede Kopie, damit „privat“ nie verloren geht. Die Spiegel behalten ihre feste UID als Verweis. Die Buchung (R-K2-Dateien) behält `terminUid` = UID und bleibt über die alte Form lesbar. | Tests „#46“ rein + Server (zwei Kalender, Ändern trifft den richtigen, Umzug) |
| #51 401/403, Alter | **behoben**. 401 = Anmeldung (30 Min. Pause). 403 bzw. eine gekürzte Antwort betrifft nur diesen einen Kalender: Er wird übersprungen, sein alter Stand und der alte ctag bleiben, `hinweise` im Stand, der Rest läuft weiter. `GET /api/kalender` liefert `abgleich: { letzter, vorMin, veraltet (ab 30 Min.), fehler?, hinweise? }`. HOI-Befund „iCloud-Kalender“ (gelb ab 30 Min. bzw. bei übersprungenen Kalendern, rot ab 3 h oder bei abgelehnter Anmeldung). Die Anzeige „vor X Min.“ in der Oberfläche fehlt noch (K5-Datei `Kalender.tsx`, die API liefert den Wert). | Tests „403 eines Kalenders“, „#51“, `kalenderBefunde` |
| #43 gekürzte Antwort | **behoben** (vorher UNKLAR). `unvollstaendig()` erkennt 507 je Response und `number-of-matches-within-limits`. Der Kalender wird mit Hinweis übersprungen, nie still übernommen. | Tests „#43“, „507“ |
| #38 Retry | **behoben**. Bei einer Zeitüberschreitung prüft MAKE OS erst per GET auf `${uid}.ics`, dann folgt ein Retry mit derselben UID. Ein 412 nach dem Retry zählt als angelegt. Nie eine zweite UID. | Test „Zeitüberschreitung“ |
| #50 Backoff | **behoben** für den Abgleich: `Retry-After` wird beachtet, die Pause wächst exponentiell 2 → 30 Min. (`pauseBis`, `fehlerFolge`). **Offen:** den Abgleich vor der Buchungsbestätigung erzwingen (`buchung-ablauf.ts` gehört R-K2). | Tests „#50“, „401/503“ |
| #37 (Rest) ohne ETag | **behoben**. Ohne ETag wird er erst per GET geholt. Weicht der Text ab, kommt 409. PUT und DELETE gehen nie ohne If-Match raus. | Test „ohne ETag“ |
| #42 sync-collection | **offen** (Aufwand M, nicht S). Es bleibt beim ctag je Kalender. Seit #95 parst ein Abgleich nur noch geänderte Objekte neu. | — |
| #95 Parse-Cache | **behoben**. Der Cache gilt je Objekt + ETag (+ Zeitraum, Kalender, Konto), nicht mehr je Abgleich. | `lib/kalender/icloud.ts` `objektTermine` |
| #47 (Teil) Farbe | **behoben**. COLOR wird im Bezug gespiegelt: beim Anlegen, bei Änderungen und im Abgleich. `mitBezug` füllt `farbeId`, wenn Apple die Farbe verlor. | Tests „#47“, K1-Route |
| #68 abgesagt/abgelehnt | **behoben**. `Termin.status` (bestätigt/vorläufig/abgesagt) und `abgesagt` kommen aus STATUS:CANCELLED oder der eigenen Antwort DECLINED (`meineAntwort` = eigene Antwort). Solche Termine belegen nicht (`beschaeftigt: false`, `verfuegbarkeitAus`) und sind markiert, nicht ausgeblendet. TENTATIVE belegt. | Tests „#68“ rein + Route |
| #100 (Teil) CRM | **behoben** für „abgesagte zählen nicht“: Der Signal-Lauf überspringt sie (kein Signal, kein Meeting, kein „letzter Kontakt“). Die Signal-Kennung der Titel-Termine bleibt in der alten Form, damit keine Doppelten entstehen. **Offen:** Waisen-Vorschlag und Buchungs-Follow-up nachziehen (M, R-K2/CRM). | Test „#100“ |
| #96 (Teil) Route | **behoben**. PATCH und DELETE lehnen fremd-private Termine der anderen Person mit 403 ab, auch mit Schlüssel. Maskierte Termine gehen ohne echte UID nach außen (`belegt-<hash>`), ohne `href` und ohne `stand`. **Offen** (nicht dieses Paket): Maskierung im Altweg `GET /api/apple-calendar`. | Tests „#96“ rein + Route (Malin → 403) |
| #K5 Sicherung | **behoben**. Der Takt legt nachts (03:00–05:00, frühestens 30 Min. nach dem Start, U1 M4) je Kalender einen Export (Fenster −400 … +800 Tage, U1 H2) als ICS **verschlüsselt** ins Archiv (`kalender-export-<kalender>-<tag>.json`, `lib/store/archiv.ts`), 14 Tage — nicht im Nachtarchiv. Stand im Bestand `kalender-sicherung` (im Speicher-Register). Wiederherstellung: `kalenderWiederherstellen` bzw. `POST /api/kalender/sicherung`. Der Probelauf zählt und schreibt nichts. Mit Bestätigung kommt nur Fehlendes ohne Gäste zurück (Teilnehmer-Sperre), nie wird überschrieben. Nur von Hand, der Dienstweg bekommt 403. HOI-Befund „Kalender-Sicherung“. **Offen:** Import als Upsert nach UID/SEQUENCE (später). | `tests/kalender-rk1-sicherung.test.ts` |

**Nachtrag Paket R-K2 (29.09., Buchungsseite & Bedienung):**

| Lücke | Stand | Test |
|---|---|---|
| #73 Buchung frisch | **behoben**. Plätze nur mit frischem Stand (`standBuchbar` in `lib/kalender/buchung.ts` über R-K1 `abgleichAlter`: iCloud verbunden, nicht veraltet (30 Min.), kein gescheiterter Abgleich) — sonst zeigt die Seite „Gerade sind keine Termine buchbar“ statt veralteter Plätze. POST reserviert erst nach einem erzwungenen Abgleich (höchstens einer je 10 s für die Route, dazwischen der ctag-Abgleich); scheitert er → 503, nichts reserviert. Die Freigabe gleicht erzwungen ab und prüft `istFrei` (K1-Verfügbarkeit); belegt → 409 `{ konflikt }`, im Buchungs-Panel „Trotzdem freigeben · Ablehnen · Abbrechen“. Ohne erreichbares iCloud keine Freigabe (503). Zusammengeführt mit R-K1: dieselbe Regel `abgleichAlter` wie der Kalender-Kopf; der Kopf zeigt jetzt „letzter Abgleich vor X Min.“ (ab 30 Min. hervorgehoben) und die Hinweise je Kalender (403, gekürzte Antwort 507) — `components/os/kalender/AbgleichStand.tsx`. Damit ist auch der offene Rest von R-K1 #50 (Abgleich vor der Freigabe erzwingen) erledigt. Abgesagte Termine blockieren nicht (R-K1-Regel `abgesagt` in der Verfügbarkeit, keine eigene). Die Buchung verweist seit R-K2 mit dem Schlüssel Kalender + UID auf ihren Termin (ältere: nackte UID, beide werden gelesen). | `tests/buchung-rk2.test.ts` (#73), `tests/kalender-rk2.test.ts` (`standBuchbar`), `tests/buchung-route.test.ts` (erzwungener Abgleich bei der Freigabe) |
| #76 E-Mail des Gasts | **behoben**. Die Adresse gilt als „unbestätigt“, bis der Gast den Bestätigungslink anklickt. Im Panel erzeugt „Bestätigungslink senden …“ (nur von Hand, Dienstweg 403) einen Mail-ENTWURF (`bestaetigungsMail` + `mailtoLink`, Versand per Klick in der Mail-App — MAKE OS verschickt nichts) mit einmaligem Link `/buchen/<slug>/status#mail=<token>` (256 Bit, eigener Hash-Vorsatz, im Bestand nur der Hash, gilt 7 Tage, ein neuer ersetzt den alten). Erst der Klick setzt `emailBestaetigtAm`. Einwilligungs-Nachweis im CRM: „E-Mail-Adresse unbestätigt“ bzw. „per Bestätigungslink bestätigt“; bestätigt der Gast nach der Freigabe, kommt eine zweite Einwilligung dazu (Liste wächst nur). Kein Mail-Follow-up mehr (das frühere „Anfrage beantworten“ entfällt, nur „Termin vorbereiten“, Art Termin). Einladen an eine unbestätigte Adresse nur nach dem K3-Warnhinweis (Server: `adresseUnbestaetigt`, sonst 409). | `tests/buchung-rk2.test.ts` (#76: nur Hash, einmalig, Ablauf, Status-Token passt nicht, Nachweis vor/nach Freigabe, Einladen 409), `tests/buchung-route.test.ts` |
| #79 Datenschutzhinweis | **behoben**. `verantwortlich` ist Pflicht beim Anlegen (Altbestand ohne → keine Plätze, Hinweis im Panel). Der Hinweis steht ausgeklappt über dem Formular. Der CRM-Kontakt entsteht erst bei der Freigabe (neuer Freigabe-Schritt `kontakt`, Anfrage mit dem Tag der Anfrage); abgelehnte, abgesagte und abgelaufene Anfragen hinterlassen im CRM nichts und fallen nach 30 Tagen aus der Terminverwaltung. Der Hinweistext (`DATENSCHUTZ_HINWEIS`, Fassung `buchung-2026-09-29-2`) sagt genau das. Laufende Absichten von vor R-K2 werden fortgesetzt (fehlende Schritte übersprungen). | `tests/buchung-rk2.test.ts` (#79), `tests/buchung-route.test.ts` (kein Kontakt vor der Freigabe, Abbruch nach jedem der fünf Schritte), `tests/kalender-buchung.test.ts` |
| #69 zählt als belegt | **behoben**. Schalter je Kalender in den Kalender-Einstellungen (`belegt`, `lib/kalender/belegt.ts` `werFuerBelegung`, eine Zeile in `verfuegbarkeit.ts`). Ohne Schalter zählen zugeordnete Kalender, nicht zugeordnete blockieren niemanden mehr (vorher „beide“). | `tests/kalender-rk2.test.ts`, `tests/buchung-rk2.test.ts` (#69) |
| #72 frei, aber nicht gesetzlich | **behoben**. Liste `freieTage` in den Kalender-Einstellungen (Standard 24.12., 31.12., einstellbar, `lib/kalender/freie-tage.ts`); sperrt Buchungsseite (`sperrTageAus`) und freie-Zeit-Suche. Feiertage NRW 2026–2030 gegen die amtliche Liste getestet. | `tests/kalender-rk2.test.ts`, `tests/buchung-rk2.test.ts` (#72) |
| #74 Gast-Zeitzone | **behoben**. Zone per `Intl` nur im Browser (nie gespeichert); weicht sie ab, steht die zweite Uhrzeit an jedem Platz, in der Auswahl und auf der Status-Seite (`lib/kalender/gast-zeit.ts`). | `tests/kalender-rk2.test.ts` (New York, Umstellungslücke März, Tageswechsel) |
| #71 Puffer je Art | **offen** (M: braucht `verfuegbar.ts`, Paket R-K1). | — |
| J-Zusatz mehrtägig ziehen | **behoben**. Verschieben als Differenz auf Start und Ende (`verschiebeDifferenz`), Dauer nur am letzten Segment (`endeAmTag`), Vorschau „Sa 10:00 → Mo 14:00“ beim Ziehen. | `tests/kalender-rk2.test.ts` |
| #92 Touch + Rückgängig | **behoben**. Termine und Blöcke (auch Modus Planen, dasselbe Raster) auf Touch erst nach 350 ms Halten ziehbar, vorher rollt die Liste; nach Verschieben/Dauer 8 s „Rückgängig“ (`useVerschieben`), zurück über denselben PATCH (Schlüssel `objektSchluessel`, R-K1) mit frischem `stand` — inzwischen woanders geändert → 409/Meldung, nichts überschrieben. | Sichtprüfung; Logik `tests/kalender-rk2.test.ts` |
| #17/#88 Agenda mehrtägig | **behoben**. Folgetage zeigen „läuft weiter · bis So 04.10. 14:00“ (`laeuftWeiter`). | `tests/kalender-rk2.test.ts` |
| #85 „+n“ | **behoben**. Ab 4 Spalten zwei sichtbar + „+n“ in der dritten; Klick klappt den Tag auf, „−“ wieder zu (`rasterLage`). | `tests/kalender-rk2.test.ts` |
| #86 doppelte Stunde | **behoben**. Band „2–3 Uhr doppelt“ (25.10.) bzw. „entfällt“ (29.03.) im Raster (`zeitumstellung`). | `tests/kalender-rk2.test.ts` |
| #89 Klickfläche/Kontrast | **behoben**. Blöcke mindestens 24 px; Art-, Plan- und Terminfarben ≥ 3:1 gegen Grund und Blockfläche, Titel/Zeitzeile ≥ 4,5:1 (gemessen im Test, alle CI-Farben bestehen). | `tests/kalender-rk2.test.ts` |
| #94 Suche mit Umlauten | **behoben**. Kalender-Suche über `suchPasst` (Termine, Quellen, Fristen, Erinnerungen; Aufgaben-Modus nutzte sie schon). Weiterhin nur im geladenen Zeitraum. | `tests/kalender-rk2.test.ts` |
| #78 Event-ICS | **behoben**. `SEQUENCE` (steigt mit `geaendert`) und `LAST-MODIFIED` in `lib/crm/eventplanung.ts`; DTSTAMP = Erzeugung der Datei. | `tests/kalender-rk2.test.ts` |

**Nachtrag Gesamtprüfung Prüfer 1 (29.09., Paket F1, adversarial am Kern):**

| Fund | Stand | Test |
|---|---|---|
| #1 Doppelte Freigabe (HOCH) | **behoben**. Der Termin einer Buchung trägt eine feste UID (`buchungTerminUid` = `makeos-buchung-<id>`, `lib/kalender/buchung.ts`). `anlegen({ uid })` legt ihn per If-None-Match nur einmal an (`schonDa`: kein zweites Protokoll, keine zweite Einladung). `buchungFreigeben` sperrt je Buchung im Prozess: eine zweite Freigabe gleichzeitig bekommt 409 `{ laeuft }`, ebenso wenn dieselbe Absicht gerade im Takt läuft. Schon bestätigt und kein Vorgang offen → nichts zu tun. Die Freigabe-Knöpfe sind während der Anfrage gesperrt. Die Wiederaufnahme nach einem Absturz findet den Termin über die feste UID (auch ohne Marke in der Notiz). | `tests/kalender-f1-freigabe.test.ts` (#1: Kevin + Malin gleichzeitig, zweiter Klick, Absturz nach dem PUT) |
| #2 Freigabe überschreibt Absage (HOCH) | **behoben**. `kontakt` und `termin` lesen den Status frisch (auch direkt vor dem Anlegen). `buchung` entscheidet in der Sperre des Bestands: nur „angefragt“ wird „bestätigt“ (schon „bestätigt“ mit genau diesem Termin = Wiederaufnahme). Sonst wird die Absicht „verworfen“: kein Kontakt, kein Termin, keine Einladung, der Status bleibt (409 `{ verworfen }`). Lag der Termin schon in iCloud, bleibt er stehen: Verweis an der Buchung (Knopf „Termin entfernen“) und Glocke „… kam zu spät — Termin entfernen?“. Nie automatisch gelöscht. Die Takt-Wiederaufnahme prüft dasselbe. | `tests/kalender-f1-freigabe.test.ts` (#2: Absage im Abgleich, Absage zwischen Termin und Status, Ablehnung vor der Wiederaufnahme) |
| #3 Übernahme: veraltete Apple-Kopie | **behoben**. Die Apple-Kopie wird nur dann DER Block, wenn sie ein änderbarer Einzeltermin ist. Passen Start, Ende oder Titel nicht mehr, schreibt die Übernahme die des Blocks mit (der Block ist die Wahrheit). | `tests/kalender-f1-uebernahme.test.ts` |
| #4 Übernahme bleibt an einem Block hängen | **behoben**. Serie, Gäste, nur lesbar, mehrdeutig → Rückfall auf einen neuen Termin mit `uidFuerBlock`. Scheitert auch das, steht der Block als „übersprungen“ mit technischem Grund im Stand (`uebersprungen`, nie Titel), und es geht mit dem nächsten Block weiter. Übersprungene bleiben Archiv (ohne „wartet“), kein endloser neuer Versuch; `uebersprungen` steht in der Antwort. | `tests/kalender-f1-uebernahme.test.ts` |
| #5 Spiegel schluckt Fehler | **behoben**. `eventSpiegelNachziehen` und `familieSpiegelNachziehen` fangen je Eintrag ab, speichern das Teilergebnis und liefern `hinweise` (Kennung + Grund). `spiegelHinweiseMelden` schreibt ins Server-Protokoll (ohne Titel und Adressen) und in die Glocke der auslösenden Person (neue Meldungsart „kalender“); der Takt nur ins Protokoll. `crm/bestand`, `familie` und `zoe/takt` schweigen nicht mehr. | `tests/kalender-f1-spiegel.test.ts` |
| #6 Termin anlegen doppelt | **behoben**. Die UID entsteht im Browser (`neueTerminUid`; das Format `UID_FEST` liegt jetzt in `lib/kalender/eingabe.ts`), steht im Entwurf (`Formular.uid`) und geht als `uid` mit. Ein zweites Senden ergibt `schonDa` = Erfolg. Was nach dem iCloud-Schreiben scheitert (Protokoll; im PATCH ein zu großer Bezug), kommt als `hinweis` statt 502/413. Reine Bezug-Änderungen ohne iCloud bleiben bei 413. | `tests/kalender-f1-termin.test.ts` |
| #7 Auswertung zeigt Privates | **behoben**. `zeitAuswertungFuer` maskiert vorher (`maskieren`): Privates der anderen Person zählt nur als belegte Zeit, ohne Mandat, Kontakte und Gäste. | `tests/kalender-f1-auswertung.test.ts` |
| #8 Einstellungs-Route | **behoben**. `kalenderZugang` (403) für GET und PUT, `bauPruefen` für PUT. `PUT { teil }` mischt auf dem frischen Stand, verschachtelte Felder je Schlüssel (`einstellungenTeilMischen`). Den Client in `Kalender.tsx` baut F2. | `tests/kalender-f1-rest.test.ts` (#8) |
| #9 Mail-Link beim Aufruf eingelöst | **behoben**. Den Bestätigungslink löst erst der Knopf „E-Mail-Adresse bestätigen“ ein. Link-Vorschauen und Virenscanner bestätigen nichts mehr (`fragmentLesen`, `MailBestaetigen`). | `tests/kalender-f1-rest.test.ts` (#9) |
| #10 Sicherung ohne Build-Kennung | **behoben**. `POST /api/kalender/sicherung` prüft `bauPruefen`. | `tests/kalender-f1-rest.test.ts` (#10) |
| #11 Wiederherstellung | **behoben**. Termine einer Buchung (UID `makeos-buchung-…` oder Marke in der Notiz) sind gesperrt wie Termine mit Gästen. Die Tagessicherung trägt `von`/`privat` je UID aus `kalender-bezug` mit, das Zurückspielen setzt beides wieder in den Bezug. Der Probelauf nennt `buchung` und `bezug`. Ältere Sicherungen ohne diese Angaben spielen wie bisher zurück. | `tests/kalender-f1-rest.test.ts` (#11) |
| #12 „Termin entfernen“ | **behoben**. Bei 409 `einladung` kommt die Rückfrage „Absage senden?“ mit den Adressen, danach der zweite Versuch mit Bestätigung. Anschließend löst `{ aktion: 'termin-geloest' }` den Verweis an der Buchung (nie an einer bestätigten). Die Liste zeigt auch abgelehnte und abgelaufene Buchungen mit stehengebliebenem Termin. | `tests/kalender-f1-freigabe.test.ts` (Verweis lösen) |
| #13 Öffentliche Buchungsseite | **behoben**. Drosselung je Netz (IPv6 auf /64 gekürzt, `netzVon`/`adresseNetz`, auch in der Status-Route). Erfolgreiche GETs zählen (eigenes Budget: 40 je 15 Min.). Vor dem Reservieren wird nur der Zielkalender neu geholt (`nur`), die übrigen über ihren ctag. Höchstens `GRENZEN.neueJeStunde` (20) neue Buchungen je Seite und Stunde, sonst 429. | `tests/kalender-f1-rest.test.ts` (#13), `tests/kalender-buchung.test.ts` (Stundengrenze), `tests/buchung-rk2.test.ts` |
| #14 Vorschlag mit `new Date(wandzeit)` | **behoben**. `ausWandzeit`/`minutenVon`, die Tage über `tagePlus`. | — (Rechnung über die getesteten Helfer) |
| #15 Auswertung zeigt Kennungen | **behoben**. „Meistbesuchte Kontakte“ zeigt Namen mit Link auf die Akte (`useCrmVerweise`/`bezugName`, wie „Verknüpfen“). | `tests/kalender-f1-auswertung.test.ts` (#15) |
| N10 Aktivitätstext | **behoben**. „Termin gebucht: „…““ trägt mit Termin-Verweis kein kopiertes Datum mehr (die Akte leitet die Zeit aus dem Termin ab). | `tests/kalender-f1-freigabe.test.ts` |
| Nachtrag 1 Anfangszeit | **behoben**. Neuer Termin: eine neue Anfangszeit behält die Dauer, das Ende wandert mit (wie Google; `vonAendern` in `lib/kalender/formular.ts`, höchstens bis 23:59). | `tests/kalender-f1-rest.test.ts` (Nachträge) |
| Nachtrag 2 Glocke „Neue Terminanfrage“ | **behoben**. Die Meldung trägt den Bezug `buchung` (neue Bezugsart neben `aufgabe`); die Glocke zählt sie nicht mehr, sobald die Buchung nicht mehr offen ist — freigegeben, abgelehnt, abgesagt oder abgelaufen (`buchungenErledigen` in der Sicht, der Buchungs-Bestand zählt zum ETag). Der Hinweis „Termin entfernen?“ bleibt. | `tests/kalender-f1-rest.test.ts`, `tests/kalender-f1-freigabe.test.ts` |
| Nachtrag 3 Neue Buchungsseite | **behoben**. Titel und Zielkalender ohne Platzhalter, die wie Werte aussehen; „Titel fehlt“, „Zielkalender fehlt“ und „Verantwortlich fehlt“ stehen schon vor dem Speichern am Feld, Speichern ist bis dahin aus. | — (reine Oberfläche; tsc/eslint, im Browser noch nicht angesehen) |

**Nachtrag Gesamtprüfung Restfunde (29.09., Paket F3):**

| Fund | Stand | Test |
|---|---|---|
| Kontaktakte: zwei „nächste Termine“ | **behoben**. Kopf der Akte, Karteikarte und Verlauf („Termin im Kalender“) lesen denselben Kalender-Leser wie die Termin-Liste und die Zusammenfassung (`useNaechsterTermin` in `TermineAkte.tsx` → GET `/api/kalender/bezug`, über den Bezug, maskiert je Person; `naechsterTermin` in `lib/kalender/termine-zu.ts`: abgesagte nie). Abgesagte stehen in der Liste durchgestrichen. `crm-signale.kommend` ist abgelöst: `/api/crm/bestand` liefert kein `termine` mehr, der Signal-Lauf schreibt nur noch Zeitpunkt + Zahl (ein alter `kommend` verschwindet beim nächsten Lauf; bis dahin räumen Art. 15/17 und Umzug ihn mit — Register-Grund angepasst). Termine ohne Bezug (nur Name im Titel) sind damit kein „nächster Termin“ mehr — wie in der Akte seit K3. | `tests/kalender-f3.test.ts`, angepasst `crm-signale`, `kalender-k3-crm`, `kalender-rk1` |
| Nach „+ Meeting“ bleibt die Liste alt | **behoben**. `MeetingNeu` ruft nach dem Anlegen `termineZuNeuLaden()` — alle offenen Leser der Akte (Liste, Kopf, Zusammenfassung, Verlauf) laden neu; gleichzeitige Leser derselben Frage teilen sich eine Anfrage. | — (Oberfläche; tsc/eslint, im Browser noch nicht angesehen) |
| Planen zählt Überlappungen doppelt | **behoben**. `wochenStunden` rechnet als Vereinigung mit derselben Hilfsfunktion wie die Zeit-Auswertung (`minutenBelegung` in `lib/kalender/auswertung.ts`, dort jetzt auch benutzt): 6 × 1 h parallel = 1 h; ein Block unter einem Termin zählt als Termin. | `tests/kalender-f3.test.ts`, `kalender-k5` unverändert grün |
| Verbindungsprüfung: „sauber“ trotz Hinweisen, rohe Kennungen | **behoben**. Überschrift nach Schwere (`verbindungsUeberschrift`: „Keine Fehler — n Hinweise offen“, Zahlen je Schwere). GET liefert `namen` (Kennung → Name/Titel, `lib/crm/verbindungen-namen.ts`) aus den geladenen Beständen; Termin-Titel nur, wenn für die fragende Person nicht maskiert; private Aufgaben und tote Kennungen bleiben Kennung (Kennung im Tooltip). Person im ETag. | `tests/kalender-f3.test.ts` |
| Kleinkram | **behoben**. Zeitzonen-Auswahl im Termin-Dialog mit `aria-label`. Sicht-Umschalter der Seitenleiste bricht um, statt „Gemeinsam“ abzuschneiden (`Segmente umbrechen`). Neue Buchungslinks mit ä→ae, ö→oe, ü→ue, ß→ss (`suchNorm`); bestehende Slugs bleiben (einmal beim Anlegen vergeben). | `tests/kalender-f3.test.ts`, angepasst `kalender-buchung`, `buchung-route` |

**Nachtrag Schlussprüfung (29.09., Klicktest im Prüfbau, 1440 + 375 px):** F1/F3 im Browser bestätigt (Freigabe-Doppelklick = 1 PUT, Knöpfe während der Anfrage aus; „Termin entfernen“ erst nach „Absage senden?“; Bestätigungslink erst per Knopf; Anfangszeit behält Dauer; zweites Speichern nach verlorener Antwort = 1 Termin; Auswertung mit Namen, Privates der anderen Person nur „Belegt“; Glocke „kalender“ mit Symbol, Anfrage nach Freigabe erledigt; Übernahme-Karte + Übernahme; Kopf/Liste/Zusammenfassung ein nächster Termin, nach „+ Meeting“ ohne Neuladen; Planen als Vereinigung; ae/oe/ue-Slug). Kleine Funde:

| Fund | Stand | Test |
|---|---|---|
| NeuerTermin: „Dein Entwurf bleibt gemerkt.“ doppelt nach verlorener Antwort | **behoben**. `speicherFehlerText` (lib/kalender/formular.ts) hängt den Hinweis nur an, wenn er nicht schon im Text steht. | `tests/kalender-schluss.test.ts` |
| Einzahl: „1 Termine“ (Auswertung, Markdown), „1 künftige Blöcke liegen“ / „1 Blöcke … anlegen?“ (Planen) | **behoben**. `termineText` (lib/kalender/auswertung.ts), `uebernahmeTexte` (lib/planung/wochenplan-uebernahme.ts). | `tests/kalender-schluss.test.ts`, angepasst `kalender-auswertung` |
| Neue Buchungsseite zeigte eine alte Leisten-Meldung („Termin im Kalender entfernt.“) rot als Fehler | **behoben**. Öffnen („+ Seite“, Seite anklicken) leert die Meldung (`oeffnen`). | `tests/kalender-schluss.test.ts` |
| Verbindungsprüfung: Buchungen als „bu-…“ | **behoben**. „Buchung Name · T.M.“ über den Kontakt der Buchung (ohne Kontakt bleibt die Kennung). | `tests/kalender-schluss.test.ts` |

**Nachtrag Restpunkte (29.09., nach der Schlussprüfung):**

| Fund | Stand | Test |
|---|---|---|
| Glocke „… Termin entfernen?“ blieb nach dem Entfernen ungelesen | **behoben**. Die Meldung (Gast sagt eine bestätigte Buchung ab, `app/api/buchung/[slug]/status`; Freigabe kam zu spät, `buchung-ablauf.ts` `freigabeVerwerfen`) trägt den Bezug `buchung-termin` (Buchungs-Kennung). Eigene Erledigt-Regel „Termin gelöst“ in derselben `buchungenErledigen` (lib/meldungen/regeln.ts): erledigt, sobald die Buchung keinen Termin-Verweis mehr hat oder der Termin laut iCloud-Stand nicht mehr steht (nur bei gelungenem Abgleich und im Holfenster — sonst gilt er als da). | `tests/restpunkte-2909.test.ts`, `tests/kalender-f1-freigabe.test.ts` (Restpunkte), angepasst `kalender-f1-rest` |
| „Termin entfernen“ ließ „Termin vorbereiten“ am toten Termin offen (→ `followup-termin-tot`) | **behoben**. Aktion `termin-geloest` erledigt offene „Termin vorbereiten“ mit `terminUid` dieses Termins (`vorbereitenErledigen`, lib/kalender/buchung.ts) — nie gelöscht, Notiz „Termin entfernt“, eine verknüpfte Aufgabe wird mit erledigt. Knopf „Termin entfernen“ ist während der Anfrage gesperrt („entfernt …“). | `tests/restpunkte-2909.test.ts`, `tests/kalender-f1-freigabe.test.ts` |
| Fälligkeit ohne Jahr („25.09.“ auch für 2027) | **behoben**. Eine Regel `tagKurz`/`anderesJahr` (lib/zeit/kalender-kern.ts): Jahreszahl nur außerhalb des laufenden Jahres — Aufgaben-Modus, Agenda (Tageskopf, „bis …“, „seit …“), Glocke (überfällig seit, Fristen, Absage-Meldung) und Heute („Was ansteht“). | `tests/restpunkte-2909.test.ts` |
| „Termin vorschlagen“ im Angebot ohne Titel: „Angebot besprechen: Angebot“ | **behoben**. `angebotTerminTitel`: Titel, sonst Nummer · Kunde (Firma bzw. Kontakt), sonst nur „Angebot besprechen“. | `tests/restpunkte-2909.test.ts` |
