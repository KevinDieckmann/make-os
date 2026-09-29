# Verbindungskarte „Zeit & Termine“ (MakeOS, Branch `entwicklung`, nur gelesen, Stand 29.09.)

Ich habe nur gelesen und nichts geändert. `.data/` habe ich nicht geöffnet. Ergebnis vorweg: **Das Paket ist nicht fertig.** Der Kalender zeigt heute nur iCloud-Termine, 5 Fristarten, Apple-Erinnerungen und Aufgaben (diese nur in Tag- und Wochenansicht). Die meisten Zeitdaten aus den Modulen kommen gar nicht an. Änderbar zurück in die Quelle sind nur iCloud-Termine.

### Befunde nach Schwere

**Hoch**
1. **Der ZOE-Kalender-Agent arbeitet blind.** `lib/zoe/agenten.ts:165` schickt `post('/api/kalender/analyse', {})`. Die Route nimmt dann `events = []` (`app/api/kalender/analyse/route.ts:61`), sieht also keine Konflikte und keine Termine. Steht der Agent auf „autonom“, trägt er Blöcke über `/api/apple-calendar/create` in den echten Kalender ein (`route.ts:116-126`), ohne die Woche zu kennen. Die erlaubten Kalender sind fest `'Privat Kevin','Kalender'` (`route.ts:107`), Malin kommt nie vor. Weder dieser Schreibvorgang noch `/api/kalender/termin` landen im Audit-Log.
2. **Die Wiedervorlage an geparkten Deals kommt nie wieder hoch.** `Chance.wiedervorlage` (`lib/crm/typen.ts:66`) ist Pflicht bei „geparkt“ (`lib/crm/pipeline.ts:108`). Sie wird aber weder in `faellige` (`lib/crm/followup.ts:126-131`, nur offene Stufen) noch in `lib/crm/heute.ts:118` (nur der Kontakt) noch im Kalender gelesen.
3. **Das Speicher-Register hat Lücken bei den Zeit-Beständen.** Der Wächter `tests/datenschutz-register.test.ts:14` findet nur Namen, die als fester Text im Aufruf stehen. Namen aus Konstanten oder `speicherFuer()` rutschen durch. Deshalb fehlen im Register: `kalender-icloud` (`lib/kalender/icloud.ts:24`, Rohdaten mit Teilnehmer-Adressen Dritter), `apple-reminders-cache`, `apple-contacts-cache` (`lib/mac.ts:18-19`), `familie--*`, `zeit`/`zeit--*`, `fokus-laufend--*`, `wochenplan--malin`, `sport`, `vitals`, `steuern`. Beim Löschen nach Art. 17 tilgt `person-weitere.ts:195` nur `calendar-cache`. Der Abgleich baut diesen Zwischenspeicher alle 5 Min. aus `kalender-icloud` bzw. iCloud neu, die Tilgung ist also sofort wieder aufgehoben.

**Mittel**
4. **Event im Kalender hat eine Schein-Kennung.** Das Event bekommt eine erfundene Kennung statt der echten iCloud-UID (`components/os/crm/events/Kalender.tsx:50`, `kalenderUid: neueKennung('mac')`, über den Altweg `/create`). Wird das Datum im Event geändert, bleibt der Termin in iCloud stehen. Löschen oder Nachziehen ist nicht möglich.
5. **Verschobene Wochenplan-Blöcke bleiben in Apple am alten Platz.** Verschieben ändert nur den Block (`components/os/WochenplanView.tsx:309-310`). Der gespiegelte Apple-Termin (`appleUid`) bleibt stehen. Anlegen und Löschen laufen noch über `/api/apple-calendar/termin` (`:258`, `:280`).
6. **Kündigungsfrist wird zweimal und verschieden gerechnet.** Der Kalender nimmt nur `m.ende` (`lib/kalender/eintraege.ts:43-47`). `mandatLage` leitet das Ende aus Start + Mindestlaufzeit und automatischer Verlängerung ab (`lib/crm/kunden.ts:61-68`). Mandate ohne `ende` haben deshalb auf der Mandatsseite eine Frist, im Kalender keine.
7. **Ein Meeting kann doppelt als Gespräch zählen.** Die CRM-Aktivität „+ Meeting“ (`art:'termin'`, `wann`; `components/os/crm/KontaktSpalten.tsx:374`) und das Kalender-Signal (`art:'termin'`, `bezug` = Termin; `lib/crm/signale.ts:63`) beschreiben dasselbe Meeting. `lib/crm/akte.ts:87` zählt beide. Eine Verknüpfung zwischen den beiden gibt es nicht.
8. **Kalender-Zuordnung steht an zwei Stellen.** `lib/kalender/icloud.ts:163-171` legt fest im Code fest, welcher Kalender wem und welchem Bereich gehört. Daneben gibt es die Kalender-Einstellungen (`wemGehoert`, `lib/kalender/space.ts`). Die Signale nehmen nur `category==='holding'` (`app/api/crm/signale/route.ts:49`). Ein Kalender, den Kevin in den Einstellungen auf „Business“ stellt, wird dort ignoriert.
9. **Aufgaben im Kalender (`/os/kalender`) sind halb angebunden.**
   - Der Klick auf eine Aufgabe führt nur zu `/os/aufgaben`, ohne die Aufgabe zu öffnen (`Kalender.tsx:237`). Der Hinweistext sagt aber „Klick hakt ab“ (`teile.tsx:116`); im Wochenplan hakt derselbe Klick tatsächlich ab (`WochenplanView.tsx:435`).
   - Abgebrochene Aufgaben (`cancelled`) werden angezeigt (`Kalender.tsx:87`).
   - Monats- und Agenda-Ansicht zeigen keine Aufgaben (`:239-240`).
   - Das Startdatum (`startDate`) wird nicht gezeigt; Ziehen geht nicht.
10. **Event-Checkliste: Frist wird beim Anlegen kopiert.** `dueDate = e.datum − tageVorher` wird einmal festgeschrieben (`lib/crm/eventplanung.ts:277`), dazu das Datum als Text in der Beschreibung. Verschiebt sich das Event, bleiben die Aufgaben auf dem alten Datum. Die Aufgabe hat auch keinen Bezug zum Event.

**Niedrig**
11. `signale.ts:61` vergleicht `t.start` (Berliner Wandzeit) mit `jetzt` (ISO in UTC). Ein Termin gilt dadurch bis zu 2 Stunden zu spät als vergangen.
12. **Drei Feiertagsrechnungen:**
    - `lib/aufgaben/feiertage.ts` (NRW)
    - `lib/finanzen/chef/steuertermine.ts:31` (nur bundesweite Feiertage; für § 108 AO gelten aber die NRW-Feiertage)
    - `lib/crm/angebote.ts:166` (ignoriert Feiertage ganz)
13. Die Kalenderwoche wird an 7 Stellen eigens gerechnet: `crm/marketing.ts:100`, `crm/scoreboard.ts:114`, `aufgaben/ansichten.ts:284`, `aufgaben/wiederholung.ts:196`, `zeitmessung/einheiten.ts:108`, `planung/zeitraum.ts:44`, `Kalender.tsx:36`.
14. Die Beispieldaten von `kemaris-calendar` (fest Juli 2026, `app/api/kemaris-calendar/route.ts:17`) laufen noch in Heute, Wochenplan, ZOE, `planung/vorschlag` und die Signale.
15. `/api/kalender` liefert höchstens 120 Tage (`route.ts:36`). Die geplante Jahresansicht (K2) braucht mehr.

---

### (1) Tabelle: Modul → Datum-Quelle → im Kalender? → änderbar? → Probleme

| Modul | Datum-Quelle (Datei:Zeile), Format | Im Kalender? / zurück ins Modul | Änderbar im Kalender → Quelle? | Probleme |
|---|---|---|---|---|
| iCloud-Termine | `kalender-icloud` → `calendar-cache`; `lib/kalender/ics.ts:17-36`; Berliner Wandzeit ohne Zone | ja | ja (PATCH/DELETE mit ETag); Serien und Termine mit Teilnehmern nein | Keine Arten (Abwesend, Fokuszeit, Arbeitsort), kein frei/beschäftigt (TRANSP), kein privat (CLASS), keine Bezüge |
| Aufgaben | `types/tasks.ts:48` `dueDate`, `:71` `startDate` (Tag), Serie `:108-131` | teilweise: nur Tag/Woche, Deadline, keine Unteraufgaben-Kennzeichnung; Klick nur zur Liste | nein (nur in der Aufgaben-Kalenderansicht per `verschiebenTeil`) | Befund 9; künftige Serien-Termine unsichtbar |
| Unteraufgaben | `parentId` + eigene `dueDate` | wie Aufgaben, ohne Hinweis auf die übergeordnete Aufgabe | nein | – |
| Ziele | `lib/planung/typen.ts:36` `termin` (Tag) | nein (nur als abgeleiteter Meilenstein) | nein | wird zu `Meilenstein.faellig` abgeleitet (`kaskade.ts:142`), „angepasst“ trennt die Verbindung |
| Meilensteine | `typen.ts:66` `faellig` (Tag) | ja; Link nur zu `/os/planung/jahr` (kein Sprung zum Meilenstein) | nein | – |
| Routinen | `typen.ts:112` `naechstesMal` (Tag), `wann` morgen/tag/abend | nein | – | Arzt- und Steuertermine fehlen im Kalender |
| Wochenvorlage (Privat/Arbeit) | `typen.ts:125-137` Wochentag + `HH:MM` | nein | – | wäre die Soll-Verfügbarkeit; ungenutzt |
| Wochenplan-Blöcke | `types/planer.ts:9-22` `date` + `startMin`, je Person (`speicherFuer`) | nur im Wochenplaner (`/os/planung/woche`) | Block ja, Apple-Spiegel nein | Befund 5; `taskId` wird nicht geprüft |
| Zeit & Fokus | `lib/zeitmessung/modell.ts:24` `FokusBlock.von/bis` (ISO UTC), `arbeitsmodus` `HH:MM` | nein | – | drei Arten Ist-Zeit (automatisch, bewusst, An/Aus-Schalter) |
| CRM-Aktivitäten | `Aktivitaet.wann` (`lib/make-one/crm.ts:72`): Tag, Berliner Zeit **oder** ISO mit Zone | nein (Kalender-Signal führt nur in die Gegenrichtung) | – | zwei Formate in einem Feld; Befund 7 |
| Follow-ups | `crm/typen.ts:495` `faellig` (Tag) + `uhrzeit`; dazu virtuelle aus Altfeldern | **nein** | – | Punkt (2) unten |
| Deals | `typen.ts:59` `naechsterSchritt.datum`, `:66` `wiedervorlage`, `:67` `erwartetAm` | nein | – | Befund 2 |
| Angebote | `typen.ts:217` `gueltigBis`; Ablauf erzeugt ein Follow-up (`angebote.ts:295-310`) | nein | – | Nachfass-Termin ohne Feiertage |
| Mandate | `typen.ts:98-110` `start`/`ende`/`kuendigungsfristTage`/`naechstesReview` | ja: Ende, Frist, Review; Link zum Mandat | nein | Befund 6; Review zusätzlich als virtuelles Follow-up |
| Kampagnen | `typen.ts:439` `start`/`ende`, Schritte `tag` relativ zum Start | nein | – | Schritt-Aufgaben mit festkopierter Frist |
| Make.One-Events | `typen.ts:321` `datum` + `uhrzeit`, `:341` `kalenderUid` | nur, wenn ein iCloud-Termin angelegt wurde | nein | Befund 4 |
| Teilnahmen | `typen.ts:357` `followUpAm` (Datum des Nachfassens, **keine** Frist) | nein | – | irreführender Feldname |
| Power Hour | `typen.ts:464-466` `datum` Tag, `start` freier Text ≤ 25 Zeichen | nein | – | Format von `start` wird nicht geprüft; keine Verfügbarkeit |
| Qualifizierungsrunden | keine eigenen Daten (`lib/crm/runden.ts`) | – | – | – |
| DSGVO-Anträge | `typen.ts:474` `frist` (Eingang + 1 Monat) | **nein** | – | gesetzliche Frist, gehört in den Kalender |
| Löschfristen | Lauf `crm-loeschfristen` | nein (braucht es nicht) | – | – |
| Finanzen Business | `finanzplan` Zahlungen/Rechnungen `faellig` | ja; Link nur zu `/os/finanzen` | nein | – |
| Finanzplanung v3 | `finanzen-plan--<haushalt>` `posten.faellig` (`plan/hilfen.ts:101-103`) | nein | – | zweiter Finanz-Bestand fehlt im Kalender |
| Steuertermine | berechnet, `lib/steuern/rechnen.ts:105` (`aufgabeAb`) | nein | – | Befund 12 |
| Haushalt | `lib/finanzen/haushalt/typen.ts:92` `naechste_faelligkeit`, `:103` `faellig_am`; `liquiditaet.ts:153` | nein | – | – |
| Familie | `lib/familie/typen.ts:40` Date (+`kalenderUid`), `:29` Gespräch (`kalenderTermine[datum]`), `:36` Vereinbarung (`faellig`, `taskId`), `:47` WichtigerTag (`MM-TT`), `:50` `Mensch.geburtstag` | nur als iCloud-Kopie auf Klick (`WirZwei.tsx:129`) | nein | Absagen löscht den iCloud-Termin nicht (`:178`); Geburtstag doppelt |
| Sport | `lib/sport/modell.ts:33` Ziel `datum`, Einheiten `datum` (Ist) | nein | – | – |
| Ernährung | `lib/ernaehrung/modell.ts:71` Wochentag mo–so (kein Datum) | nein | – | Vorlage, nicht datiert |
| Inbox | `inbox-status` Zurückstellen `bis` (`InboxSchlank.tsx:193-210`) | nein | – | weitere Wiedervorlage-Stelle; Einladungen (ICS) in Mails werden nicht erkannt |
| ZOE / Morgenlauf / Heads | lesen `calendar-cache`/`kemaris-calendar` (`zoe/werkzeuge.ts:41-44`, `planung/vorschlag:52-55`) | – | – | Befund 1; kennen keine Abwesenheit und keine Feiertage |
| Glocke | `lib/meldungen/regeln.ts:32`: nur Aufgaben fällig/überfällig | – | – | keine Termine, Follow-ups oder Fristen |
| Heute / Tagesplan | `flaeche/widgets.tsx:142`, `TagesplanView.tsx:115` über `/api/apple-calendar` (Altweg) | – | – | keine Fristen, Follow-ups, Blöcke, Feiertage |
| Brain `_App/Woche` | `lib/brain/app-spiegel.ts:175-183` | – | – | keine Termine, keine Meetingzeit |
| Bauplan-Etappen | `etappen.ziel` | ja; Link nur zu `/os/bauplan?s=plan` | nein | – |
| HOI | – | – | – | kein Zeitbezug |

**Zeitzone:** Das Kernmodul `lib/kalender/zeit.ts` ist korrekt. Der Server läuft mit `TZ=Europe/Berlin` (`Dockerfile:15`), das verdeckt die Stellen, an denen `new Date(wandzeit)` benutzt wird (`analyse/route.ts:28,48`, `WochenplanView.tsx:188`). **Verfügbarkeit** (Abwesend, Arbeitsort, Feiertage) kennt bisher nur die Aufgaben-Serie (`wiederholung.feiertage`, `types/tasks.ts:123`).

**Verbindungsprüfung:** Keine Prüfung für `PlanBlock.taskId`/`appleUid`, `Event.kalenderUid`, `familie.dates.kalenderUid`, `Vereinbarung.taskId` oder abweichende Daten zwischen Follow-up und Aufgabe. Vorhanden sind nur `fokus-aufgabe-tot` und `aufgabe-verweis-tot` (`lib/crm/verbindungen.ts:173-174, 459-463`).

---

### (2) Doppelte Wahrheiten → Vorschlag „eine Quelle“

1. **`FollowUp.faellig` gegen `Task.dueDate`** (über `aufgabeId`): abgeglichen wird nur der Status (`lib/crm/followup-aufgabe.ts:1-30`). → Ist eine Aufgabe verknüpft, führt die Aufgabe. Das Follow-up liest seine Fälligkeit von dort; Verschieben geht immer auf die Aufgabe.
2. **Nachfassen liegt an 8 Stellen:**
   - `Kontakt.naechsterSchritt`/`wiedervorlage` (`make-one/crm.ts:274,281`)
   - `Chance.naechsterSchritt` und `wiedervorlage`
   - `Teilnahme.followUpAm`
   - `Mandat.naechstesReview`
   - Kampagnen-Schritte
   - Zurückstellen in der Inbox
   - `crm.followups`

   Doppelte werden nur über dieselbe Kombination aus Kontakt und Tag erkannt (`followup.ts:92`). → Nur `crm.followups` (mit `bezug`) bleibt. Die Altfelder werden per Umzug zu Follow-ups; das Review bleibt ein Mandatsfeld und erzeugt genau ein Follow-up mit fester Kennung.
3. **Kündigungsfrist:** zwei Rechnungen (Befund 6) → eine Funktion `mandatFristen(m, heute)` in `lib/crm/kunden.ts`, die auch der Kalender benutzt.
4. **Wochenplan-Block gegen Apple-Spiegel** (`appleUid`) → Ein Block ist ein iCloud-Termin der Art „Fokuszeit“ bzw. „Block“. Der Wochenplan-Bestand hält nur noch Blöcke, die nicht gespiegelt werden (Modus „Planen“, K5).
5. **Event, Familien-Date und Paar-Gespräch gegen iCloud-Kopie** → Das Modul führt Datum und Titel. Der iCloud-Termin ist ein abgeleiteter Spiegel mit echter UID. Jede Änderung, Absage oder Löschung zieht ihn über `/api/kalender/termin` nach.
6. **CRM-Meeting (`Aktivitaet.wann`) gegen iCloud-Termin gegen Kalender-Signal** → Der Termin ist die Quelle für die Zeit. Die Aktivität verweist über `terminUid` darauf, das Signal schreibt nicht zusätzlich, wenn es diesen Verweis schon gibt.
7. **Wem gehört ein Kalender:** `icloud.ts:163` gegen Einstellungen → nur noch die Einstellungen.
8. **Geburtstag:** `Mensch.geburtstag` gegen `WichtigerTag(art:'geburtstag')` → Der Mensch führt, der WichtigerTag verweist nur auf ihn.
9. **`Ziel.termin` gegen `Meilenstein.faellig`** → Solange der Meilenstein nicht von Hand angepasst ist, schreibt Ziehen im Kalender auf `Ziel.termin`.
10. **Ist-Arbeitszeit an drei Stellen:** `arbeitsmodus`, automatische Zeit, Fokus-Blöcke. Soll-Zeit an drei Stellen: Wochenvorlage, Wochenplan, künftig „Arbeitsort“. → Soll kommt aus dem Kalender (Arten), Ist aus der Zeitmessung. Die Auswertung (K2) rechnet an einer Stelle.
11. **Feiertage und Kalenderwoche** (Befunde 12, 13) → `lib/zeit/kalender-kern.ts`: Tag, Wandzeit, Kalenderwoche, Montag, Feiertage NRW, Werktag.
12. **Event-Checkliste und Kampagnen-Schritte:** Frist beim Anlegen kopiert → Die Aufgabe bekommt `bezug.eventId` bzw. `kampagneId`. Verschiebt sich das Event oder der Start, werden die abgeleiteten Fristen nachgezogen (außer bei Aufgaben, die von Hand verschoben wurden).

---

### (3) Die 15 sinnvollsten fehlenden Verbindungen (nach Nutzen für Kevin und Malin)

1. **ZOE-Kalender-Agent reparieren:** die Woche aus `ladeStand()` serverseitig lesen, nicht aus dem Browser; Kalender nicht fest im Code; Schreiben ins Audit-Log. *klein*
2. **Follow-ups (echte und virtuelle) als Kalender-Ebene:** mit Link über `WEG`; Ziehen läuft über die Verschieben-Aktion von `/api/crm/followup`. *mittel*
3. **Aufgaben im Kalender vollständig:** Link über `WEG.aufgabe(id)`, echtes Abhaken über den Aufgaben-Schreibweg (Serien, Follow-up-Abgleich), Ziehen ändert `dueDate`, Monat und Agenda, Start-bis-Deadline-Balken, abgebrochene ausblenden. *klein–mittel*
4. **Wiedervorlage geparkter Deals und `erwartetAm`** in Follow-ups und Kalender. *klein*
5. **Verfügbarkeit an einer Stelle** (`lib/kalender/verfuegbarkeit.ts`: Feiertage NRW, Abwesend, Arbeitsort, Wochenvorlage). Nutzen sollen es: Follow-up-Fälligkeit (Wochenende/Feiertag → nächster Werktag), `angebote.werktagePlus`, `planung/vorschlag`, Kalender-Agent, Heute, Power Hour. *mittel*
6. **CRM am Termin** (K3): Bezug-Speicher (Punkt 4a), Termin wird zur CRM-Aktivität mit `terminUid`, Signale per Bezug statt über den Namen im Titel; Doppelzählung beheben. *mittel–groß*
7. **Weitere Fristen lesend in den Kalender:** Steuertermine (`steuern/rechnen.ts:105`), DSGVO-Anträge, `Angebot.gueltigBis`, `Routine.naechstesMal`, Posten aus der Finanzplanung v3, Haushalt-Fälligkeiten. Jeweils mit genauem Sprung ins Modul statt Sammelseite. *klein*
8. **Glocke:** Termin-Erinnerung, Follow-up heute oder überfällig, Steuer- und Kündigungsfrist mit Vorlauf. Abgeleitet wie Aufgaben, nie gespeichert. *mittel*
9. **Heute und Tagesplan auf `/api/kalender` umstellen:** dazu Fristen, Follow-ups von heute, Wochenplan-Blöcke, Hinweis auf Feiertag oder Abwesenheit; `kemaris-calendar`-Beispiele raus. *klein–mittel*
10. **Make.One-Event als echter iCloud-Termin** mit echter UID. Datumsänderung zieht Termin und Checklisten-Aufgaben nach; Event-Ebene im Kalender. *mittel*
11. **Wochenplaner wird Modus „Planen“** (K5): Verschieben eines Blocks schreibt nach iCloud, Altwege entfernen. Neue Prüfungen `wochenplan-aufgabe-tot` und `termin-uid-tot`. *mittel*
12. **Geburtstage** (Familie `Mensch` + Jahrestage) als eigener, schaltbarer Kalender; der Vorlauf wird zur Aufgabe. Beim CRM braucht es erst ein Geburtstagsfeld am Kontakt (gibt es nicht; Zweck, Datensparsamkeit und Art. 17 klären). *klein (Familie) / mittel (CRM)*
13. **Familie:** Verschieben oder Absagen von Dates und Paar-Gesprächen zieht den iCloud-Termin mit oder löscht ihn; `Vereinbarung.faellig` wird von der Aufgabe gelesen. *klein*
14. **Power Hour:** freien Slot vorschlagen und als Fokuszeit blocken; das Ergebnis „Termin“ öffnet den Anlege-Dialog mit Kontakt-Bezug. *mittel*
15. **Zeit-Auswertung (K2) aus einer Quelle:** Termine mit `mandatId` zusammen mit Fokus-Blöcken ergeben die Zeit je Mandat inklusive Meetings; im Brain landet sie in `_App/Woche`. Gemeinsame freie Zeit (K4) nutzt die Wochenvorlage beider. *mittel*

---

### (4) Datenhaltungs-Regeln für den Kalender-Ausbau

**a) Wo Zusatzdaten zum Termin liegen**
- Was es als Standard gibt, steht im ICS-Termin: Art (Abwesend/Fokuszeit/Arbeitsort über `X-MAKE-ART` + TRANSP), `CLASS`, `COLOR` (RFC 7986), `RRULE`, `EXDATE`.
- Bezüge zu MAKE OS stehen **nur** in einem eigenen Bestand `kalender-bezug`. Schlüssel ist `uid` bzw. `uid::RECURRENCE-ID`, Inhalt nur Kennungen (`kontaktId`/`firmaId`/`mandatId`/`dealId`/`aufgabeId`/`eventId`), keine Namen.
- Diesen Bestand ins Register eintragen (Bezug „dritte“, Behandlung „entfernen“) und in die Verbindungsprüfung aufnehmen (UID tot, Kennung tot).

**b) Führung von Termin und Modul**
- Das Modul führt fachliche Daten (Frist, Event-Datum, Deadline).
- Ein iCloud-Termin ist entweder die Quelle (echter Termin) oder ein Spiegel. Ein Spiegel wird nur über `/api/kalender/termin` geschrieben und trägt die **echte UID**, nie eine erfundene.
- Jede Datumsänderung im Modul zieht den Spiegel im selben Schreibweg nach.

**c) Ziehen im Kalender**
- Geschrieben wird immer über den Schreibweg des Moduls (Aufgaben-Route, `/api/crm/followup`, Planung), nie über einen Kalender-eigenen Bestand.
- Virtuelle Einträge (`v:…`) schreiben auf ihr Altfeld oder werden zum echten Follow-up.

**d) Formate**
- Tag: `YYYY-MM-DD`.
- Uhrzeit: `HH:MM` als eigenes Feld, oder Wandzeit `YYYY-MM-DDTHH:mm:ss` nur im Kalender.
- Zeitpunkte von Ereignissen (erfasst, erledigt): ISO in UTC.
- Nie beides in einem Feld (`Aktivitaet.wann` bereinigen). Nie `new Date(wandzeit)`: immer `ausWandzeit` bzw. `tagVon` nur für ISO.
- Feldnamen sagen, was drinsteht (`followUpAm` → `nachgefasstAm`).

**e) Serien**
- Ein Termin ist eindeutig über `uid` + `RECURRENCE-ID`. Einzelne Vorkommen werden als Ausnahme geändert, nie die ganze Serie.
- Solange K1 keine Serien schreiben kann, bleibt die Regel „in Apple ändern“.
- Bezüge an einem einzelnen Vorkommen werden unter `uid::rid` gespeichert, an der Serie unter `uid`.

**f) Art. 17**
- `kalender-icloud`, `calendar-cache`, `apple-reminders-cache` und `kalender-bezug` gehören ins Register.
- Die Spiegel externer Quellen sind „ausgenommen: Löschung nur in Apple“; der Löschlauf zeigt dann „n Termine nennen die Person — in Apple löschen“.
- `kalender-bezug` wird entfernt.
- Neue Namen für Bestände nur als fester Text oder über `DYNAMISCHE_NAMEN` (`speicher-register.ts:120`). Der Wächter muss auch Konstanten und `speicherFuer()` erkennen.

**g) Eine Stelle für Kalenderrechnung**
Tag, Wandzeit, Kalenderwoche, Montag, Feiertage NRW, Werktag und Verfügbarkeit in je einem Modul. Alle anderen Stellen importieren von dort.

**h) Ausgehendes**
Einladungen nur nach Klick (K3/K5). Jede Kalender-Schreibaktion, besonders die autonome des Agenten, kommt ins Audit-Log: wer, welche UID, welche Aktion, ohne Titel.

**i) Lesezugriff**
Die Fristen-Ebene respektiert Sicht (Kevin/Malin/Gemeinsam) und Bereich (Privat/Business). Ohne Filter nach Sicht und Bereich landen heute alle Fristen und Aufgaben des Haushalts in jeder Ansicht.

### Wichtigste Dateien
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/kalender/eintraege.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/app/api/kalender/route.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/app/api/kalender/analyse/route.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/zoe/agenten.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/components/os/kalender/Kalender.tsx`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/components/os/kalender/teile.tsx`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/components/os/WochenplanView.tsx`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/components/os/crm/events/Kalender.tsx`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/components/os/familie/WirZwei.tsx`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/crm/followup.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/crm/followup-aufgabe.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/crm/kunden.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/crm/signale.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/crm/akte.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/crm/eventplanung.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/crm/speicher-register.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/crm/person-weitere.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/crm/verbindungen.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/kalender/icloud.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/aufgaben/feiertage.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/lib/finanzen/chef/steuertermine.ts`
- `/Users/kevindieckmann/Claude/Projects/MakeOS/tests/datenschutz-register.test.ts`
