# Prozesse — Teil 2: Automatisieren (wie Abläufe laufen)

Recherche vom 21.10.2026. Angeschaut wurden n8n, Make, Zapier, Power Automate, Pipedream und Activepieces. Dazu die CRM-Workflows von HubSpot, Salesforce Flow, Pipedrive und Attio, die Projekt-Werkzeuge monday, ClickUp und Asana sowie die Durable-Execution-Systeme Temporal, Inngest und Trigger.dev.

Alles ist in eigenen Worten wiedergegeben. Viele Hersteller-Dokus tragen kein Datum. Dort steht „ohne Datum, abgerufen 21.10.2026“. Aussagen aus Drittquellen (Blogs, Foren) sind als solche gekennzeichnet.

Für MAKE OS gilt dabei als feste Randbedingung: Nichts geht ohne den Klick eines Menschen an Dritte.

---

## A. Auslöser

### 1. Fünf Auslöser-Familien decken fast alles ab
- **Erkenntnis:** Bei allen Großen kehren dieselben Auslöser-Arten wieder:
  - ein Datensatz ändert sich (Ereignis),
  - ein Zeitplan,
  - ein eingehender Webhook,
  - ein manueller Start,
  - ein Formular,
  - ein Aufruf aus einem anderen Prozess.
- **Wie die Besten es machen:**
  - HubSpot führt Filter-, Ereignis-, Webhook-, Zeitplan- und manuelle Auslöser. Ein Workflow kann auch aus einem anderen Workflow eingeschrieben werden.
  - Salesforce unterscheidet nach dem Start:
    - datensatzgesteuerte Flows,
    - zeitgesteuerte Flows,
    - Flows auf Plattform-Ereignisse,
    - Flows, die von anderen Flows oder per API aufgerufen werden,
    - Bildschirm-Flows (mit Benutzer).
  - n8n hat dafür eigene Auslöser-Knoten: Zeitplan, Webhook, Formular, manuell, Fehler und Aufruf als Teil-Workflow.
  - Attio nennt Datensatz- und Attributänderungen, wiederkehrende Zeitpläne und eingehende Webhooks.
- **Bedeutung für MAKE OS:** Die erste Ausbaustufe braucht vor allem Ereignisse aus den eigenen Beständen, zum Beispiel:
  - Deal-Stufe wechselt,
  - Aufgabe erledigt,
  - Mandat angelegt,
  - Rechnung bezahlt,
  - Angebot gestellt,
  - Termin vorbei.

  Diese Ereignisse kommen aus den vorhandenen Schreibwegen und brauchen kein Abfragen im Takt.
  - Zeitplan und manueller Start sind billig.
  - Webhook und Formular kommen später, weil jeder neue offene Weg eine eng gefasste Regel und einen eigenen Test braucht.
- **Quellen:**
  - https://knowledge.hubspot.com/workflows/set-your-workflow-enrollment-triggers (aktualisiert 03.08.2026)
  - https://www.salesforceben.com/your-complete-guide-to-available-types-of-flow-in-salesforce/ (ohne Datum)
  - https://attio.com/help/reference/automations/workflows/overview-of-workflows (ohne Datum, abgerufen 21.10.2026)

### 2. Auslöser = Ereignis + Eintrittsbedingung, geprüft vor dem Lauf
- **Erkenntnis:** Gute Systeme trennen zwei Fragen: „Was ist passiert?“ (Ereignis) und „Gilt das für diesen Fall?“ (Bedingung). Die Bedingung wird geprüft, bevor überhaupt ein Lauf entsteht.
- **Wie die Besten es machen:**
  - HubSpot unterscheidet ausdrücklich zwischen Ereignis- und Filter-Auslösern.
  - Salesforce empfiehlt Eintrittsbedingungen für jeden datensatzgesteuerten Flow, damit nicht jede Änderung einen Lauf startet.
  - Bei Power Automate werten Trigger-Bedingungen vor dem Start aus. Ist die Bedingung falsch, entsteht kein Lauf und es fallen keine Kosten an.
- **Bedeutung für MAKE OS:** Auf der Fläche bekommt der Start-Knoten zwei Teile: Ereignis und „nur wenn …“. Nicht passende Ereignisse erzeugen keinen Lauf und füllen die Historie nicht. Gezählt werden sie höchstens als Zahl „übersprungen“.
- **Quellen:**
  - https://knowledge.hubspot.com/workflows/set-your-workflow-enrollment-triggers (aktualisiert 03.08.2026)
  - https://trailhead.salesforce.com/content/learn/modules/autolaunched-scheduled-flows/get-started-with-autolaunched-flows (ohne Datum)
  - https://tomriha.com/how-to-avoid-infinite-trigger-loop-in-power-automate/ (Drittquelle, ohne Datum)

### 3. Wiedereintritt ist eine bewusste Einstellung, nicht der Normalfall
- **Erkenntnis:** Ein Datensatz soll einen Prozess standardmäßig nur einmal durchlaufen. Ein erneutes Durchlaufen muss man ausdrücklich erlauben.
- **Wie die Besten es machen:**
  - In HubSpot werden Datensätze nur beim ersten Erfüllen eingeschrieben. Wiedereintritt gilt nur für ausgewählte Auslöser.
  - HubSpot rät davon ab, „heutiges Datum“ als Wiedereintritt-Auslöser zu nehmen. Stattdessen empfiehlt es wiederkehrende Zeitplan-Auslöser.
  - Beim Einschalten eines Workflows kann man wählen, bestehende Kontakte nicht einzuschreiben. Das ist wichtig, wenn der Workflow SMS oder Mails auslöst.
- **Bedeutung für MAKE OS:**
  - Die Vorgabe ist „ein Lauf je Fall und Prozess“.
  - Wiedereintritt wird je Prozess ausdrücklich eingeschaltet, mit Grund (z. B. „bei jeder neuen Deal-Stufe“).
  - Beim Veröffentlichen fragt MAKE OS: „Gilt das auch für die n bestehenden Fälle?“ Die Antwort steht im Klartext mit der Anzahl.
- **Quellen:**
  - https://knowledge.hubspot.com/workflows/add-re-enrollment-triggers-to-a-workflow (ohne Datum, abgerufen 21.10.2026)
  - https://blog.hubspot.com/customers/how-to-fix-workflow-mishaps (ohne Datum)

### 4. Datumsbezogene Auslöser („3 Tage vor …“) als eigene Art
- **Erkenntnis:** Viele Geschäftsabläufe hängen an einem Datum im Datensatz, nicht an einer Änderung. Beispiele:
  - Kündigungsfrist,
  - Review-Termin,
  - Fälligkeit,
  - Event-Datum.
- **Wie die Besten es machen:**
  - Salesforce hat dafür „Scheduled Paths“: geplante Pfade relativ zu einem Datumsfeld. Schlagen deren Aktionen fehl, wiederholt Salesforce den Pfad automatisch bis zu viermal.
  - HubSpot hat Zeitplan-Auslöser auf ein festes Datum oder eine Datums-Eigenschaft.
- **Bedeutung für MAKE OS:** Der Auslöser „relativ zu einem Datum am Fall“ (± n Tage bzw. Werktage NRW) ist für Fulfillment und Finanzen zentral. Die Fristen-Rechnung gibt es schon (`fristenLesen`, Kalender-Kern). Der Auslöser sollte sie nutzen und nicht selbst rechnen.
- **Quellen:**
  - https://salesforcetime.com/2025/07/03/retry-logic-in-record-triggered-flow-scheduled-paths/ (03.07.2025, Drittquelle)
  - https://knowledge.hubspot.com/workflows/set-your-workflow-enrollment-triggers (aktualisiert 03.08.2026)

### 5. Flutschutz bei Massenereignissen
- **Erkenntnis:** Wenn plötzlich sehr viele Auslöser auf einmal kommen (Import, Fehlbedienung, Fremdsystem spinnt), muss das System anhalten und fragen. Blind starten darf es nicht.
- **Wie die Besten es machen:**
  - Zapier hält Läufe zurück („held“), wenn ein Auslöser mehr als etwa 100 Datensätze auf einmal liefert. Ein Mensch entscheidet, ob sie laufen.
  - Die Schwelle ist je Zap bis 1.500 einstellbar.
- **Bedeutung für MAKE OS:** Ein Kontakt-Import mit 400 Personen darf nicht 400 Begrüßungs-Prozesse starten. Dafür braucht es:
  - eine Schwelle je Prozess und Zeitfenster,
  - darüber die Meldung in der Glocke: „n Läufe zurückgehalten: starten / verwerfen“.

  Das passt zur Regel „nie still kürzen“.
- **Quellen:**
  - https://help.zapier.com/hc/en-us/articles/14230420160269-Choose-your-Zaps-flood-protection-limit (ohne Datum, abgerufen 21.10.2026)

### 6. Abfragen nur für Fremdquellen, mit Doppelt-Erkennung über Kennungen
- **Erkenntnis:** Wo es kein Ereignis gibt, wird abgefragt. Doppelte Treffer verhindert man über eindeutige Kennungen.
- **Wie die Besten es machen:**
  - Zapier fragt je nach Tarif alle 15, 2 oder 1 Minute(n) ab.
  - Jede gefundene Kennung wird mit den schon gesehenen verglichen. Nur neue starten einen Lauf.
  - Sofort-Auslöser über Webhooks brauchen diesen Schritt nicht.
- **Bedeutung für MAKE OS:**
  - Mail, Kalender und WhatsApp haben bereits Spiegel und eigene Takte. Prozesse sollten an den Ereignissen der Spiegel hängen, z. B. „neue Nachricht im Gespräch X“.
  - Die Fremdquelle selbst wird nicht ein zweites Mal abgefragt.
  - Die Doppelt-Erkennung läuft über die vorhandenen Kennungen (z. B. Nachrichten-ID, WAMID).
- **Quellen:**
  - https://help.zapier.com/hc/en-us/articles/8495906143373 (ohne Datum, abgerufen 21.10.2026)

---

## B. Bausteine

### 7. Kleiner, fester Baukasten mit Grenzen je Prozess
- **Erkenntnis:** Projekt-Werkzeuge halten Regeln bewusst klein und lesbar. Komplexes wandert in Teilprozesse.
- **Wie die Besten es machen:**
  - Asana baut Regeln aus drei Kartenarten: Auslöser, Bedingung, Aktion. Laut Forum gelten diese Grenzen:
    - 5 Aktionen je Regel,
    - 5 Zweige je Regel,
    - 20 Bedingungen je Zweig,
    - 50 Bausteine je Regel.
  - ClickUp erlaubt je Automation 1 Auslöser, bis zu 15 Bedingungen und bis zu 6 Aktionen.
  - Bei Pipedrive reicht ein Auslöser plus eine Aktion für einen gültigen Ablauf. Ein leerer Zweig beendet den Lauf.
- **Bedeutung für MAKE OS:** Sechs Bausteine reichen:
  - Aktion,
  - Raute (Verzweigung),
  - Warten,
  - Schleife,
  - Teilprozess,
  - Fehlerpfad.

  Feste Grenzen je Prozess (z. B. Schritte, Zweige) halten die Fläche lesbar wie bei Miro. Darüber hinaus wird ein Teilprozess vorgeschlagen.
- **Quellen:**
  - https://help.asana.com/s/article/conditions-and-branching-in-rules (ohne Datum)
  - https://forum.asana.com/t/list-of-technical-and-data-limitations-in-asana/236641/64 (Forum, ohne Datum)
  - https://help.clickup.com/hc/en-us/articles/23477062949911-Automations-feature-availability-and-limits (ohne Datum, abgerufen 21.10.2026)
  - https://www.pipedrive.com/en/blog/if-else-conditions (ohne Datum)

### 8. Die Regel einer Verzweigung muss eindeutig und sichtbar sein
- **Erkenntnis:** Bei Verzweigungen muss klar sein: Gewinnt der erste passende Zweig, oder laufen alle passenden?
- **Wie die Besten es machen:**
  - Asana prüft Zweige der Reihe nach. Der erste zutreffende Zweig gewinnt, die übrigen werden ignoriert. Nutzer wünschen sich zusätzlich eine „alle Treffer“-Variante.
  - HubSpot bietet „Wert ist gleich“-Zweige, die automatisch einen Zweig je Wert anlegen (bis 250). Dort sind keine UND/ODER-Bedingungen möglich.
- **Bedeutung für MAKE OS:**
  - Die Raute auf der Fläche arbeitet fest nach „erster passender Zweig, sonst Standard-Zweig“.
  - Der Sonst-Zweig ist immer sichtbar, auch wenn er leer ist. So wird kein Fall still verschluckt.
  - Parallele Zweige sind ein eigener, ausdrücklicher Baustein.
- **Quellen:**
  - https://forum.asana.com/t/introducing-conditions-and-branching-in-rules/520062 (Forum, ohne Jahr)
  - https://knowledge.hubspot.com/workflows/use-if-then-branches-in-workflows (ohne Datum, abgerufen 21.10.2026)

### 9. Warten ist ein eigener Baustein, und jedes Warten braucht ein Ende
- **Erkenntnis:** Warten gibt es in drei Formen:
  - eine Dauer,
  - bis zu einem Datum,
  - bis eine Bedingung oder ein Ereignis eintritt.

  Gute Systeme verlangen bei jeder Form eine Obergrenze und einen Pfad für „abgelaufen“.
- **Wie die Besten es machen:**
  - Pipedrive beendet „Warten auf Bedingung“ mit dem Status „Abgelaufen“, wenn die Frist verstreicht. Verzögerungen sind insgesamt auf 90 Tage gedeckelt.
  - Bei Inngest belegen wartende Läufe (`step.waitForEvent`, `step.sleep`) keine Ausführungs-Kapazität.
  - Bei n8n wird der Warten-Knoten durch Zeit, einen eindeutigen Fortsetzen-Link oder ein Formular beendet.
  - Pipedream setzt ausgesetzte Läufe standardmäßig nach 24 Stunden selbst fort.
  - Power Automate begrenzt jeden Lauf auf 30 Tage.
- **Bedeutung für MAKE OS:**
  - Beispiel: „Warten auf Antwort des Kunden, höchstens 7 Tage, dann Erinnerung vorschlagen“.
  - Wartende Läufe werden nur im Takt geweckt und kosten nichts.
  - Die Fläche zeigt am Warten-Knoten zwei Ausgänge: „eingetreten“ und „abgelaufen“.
- **Quellen:**
  - https://support.pipedrive.com/en/article/automation-wait-for-condition (ohne Datum)
  - https://support.pipedrive.com/en/article/automation-limits (aktualisiert Sept. 2026)
  - https://www.inngest.com/docs/reference/typescript/functions/create (ohne Datum)
  - https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait (ohne Datum)
  - https://pipedream.com/docs/workflows/building-workflows/code/nodejs/rerun (ohne Datum)

### 10. „Ziel erreicht“ und „Abbrechen, wenn …“ beenden Läufe vorzeitig
- **Erkenntnis:** Viele falsche Erinnerungen entstehen, weil ein Lauf weiterläuft, obwohl sein Zweck längst erfüllt oder hinfällig ist.
- **Wie die Besten es machen:**
  - HubSpot hat Ziele: Wer das Ziel erfüllt, wird vor der nächsten Aktion ausgetragen. Wer es schon beim Eintritt erfüllt, kommt gar nicht erst hinein. Dazu kommen Ausschlusslisten mit derselben Wirkung.
  - Bei Inngest bricht `cancelOn` einen laufenden oder schlafenden Lauf ab, wenn ein passendes Ereignis kommt (Ereignisname plus Ausdruck, der den Fall zuordnet).
- **Bedeutung für MAKE OS:** Jeder Prozess bekommt zwei feste Felder: „Ziel erreicht, wenn …“ und „Abbrechen, wenn …“. Beispiele:
  - Deal verloren → der Nachfass-Prozess endet.
  - Kunde antwortet → die Erinnerung entfällt.
  - Art.-18-Einschränkung oder Werbesperre → alle Läufe zur Person enden (Pflicht, nicht wählbar).
- **Quellen:**
  - https://knowledge.hubspot.com/workflows/use-goals-in-contact-based-workflows (ohne Datum, abgerufen 21.10.2026)
  - https://www.inngest.com/docs/features/inngest-functions/cancellation (ohne Datum)

### 11. Schleifen nur mit harter Obergrenze
- **Erkenntnis:** Schleifen „für jede Position“ sind nötig. Ohne Grenze sind sie aber eine Quelle für Kosten und Endlosläufe.
- **Wie die Besten es machen:**
  - Zapier begrenzt Schleifen auf 500 Durchläufe. Sie laufen parallel und sind nur in einem Pfad je Zap erlaubt.
  - Make zerlegt Listen mit dem Iterator in Einzelpakete und fasst sie mit dem Aggregator wieder zusammen. Was zwischen den beiden liegt, ist danach nicht mehr erreichbar.
  - Im Forum zeigt sich ein häufiger Stolperstein: Die Quelle liefert nur 100 Einträge je Seite. Ohne Blättern läuft die Schleife also still zu kurz.
- **Bedeutung für MAKE OS:**
  - Die Schleife hat eine feste Obergrenze.
  - Darüber hinaus wird abgelehnt und sichtbar gemeldet (413-Prinzip: nie still kürzen).
  - Die Schleife liest immer den ganzen Bestand und keine Seite davon.
- **Quellen:**
  - https://help.zapier.com/hc/en-us/articles/42969233918477 (ohne Datum, abgerufen 21.10.2026)
  - https://community.zapier.com/troubleshooting-99/how-to-increase-the-maximum-number-of-iterations-in-a-zapier-loop-52380 (Forum, Dez. 2025)
  - https://help.make.com/iterator.md (ohne Datum)

### 12. Teilprozesse wiederverwenden, mit Ergebnis an den Eltern-Prozess
- **Erkenntnis:** Wiederkehrende Abschnitte wie „Onboarding-Paket“ oder „Rechnung stellen“ gehören in Teilprozesse. Entscheidend ist dabei:
  - Der Eltern-Prozess bekommt das Ergebnis des Teilprozesses.
  - Freigaben im Teilprozess müssen funktionieren.
- **Wie die Besten es machen:**
  - Mit n8n 2.0 erhält der Eltern-Workflow die Ausgabe vom Ende des Teil-Workflows. Vorher bekam er die Eingabe des Warten-Knotens. Damit gehen Freigaben im Teil-Workflow und ihr Ergebnis im Eltern-Workflow.
  - Nutzer berichten, dass sie von einer unveröffentlichten Teil-Workflow-Version überrascht wurden.
  - Bei Salesforce darf ein Teil-Flow mit Warten nicht aus einem datensatzgesteuerten Flow aufgerufen werden.
- **Bedeutung für MAKE OS:**
  - Ein Teilprozess ist ein eigener versionierter Prozess mit festen Ein- und Ausgaben.
  - Der Eltern-Lauf wartet auf das Ergebnis, auch über eine Freigabe hinweg.
  - Aufgerufen wird immer die veröffentlichte Version.
- **Quellen:**
  - https://docs.n8n.io/2-0-breaking-changes (ohne Datum, abgerufen 21.10.2026)
  - https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows/ (ohne Datum)
  - https://www.salesforceben.com/how-do-salesforce-flow-wait-elements-work-use-cases-examples-and-best-practices/ (ohne Datum)

### 13. Fehlerpfad je Schritt, dazu ein Fehler-Prozess für alles
- **Erkenntnis:** Die Besten bieten zwei Ebenen: einen Fehlerpfad direkt am Schritt und einen globalen Fehler-Workflow.
- **Wie die Besten es machen:**
  - **Zapier:** Ein eigener Fehler-Handler hängt unter einem Schritt. Er kann Bedingungen haben, bekommt die Fehlermeldung als Feld, und behandelte Fehler zählen nicht zur Fehlerquote.
  - **n8n:** Je Knoten gibt es drei Einstellungen: „anhalten“, „weiter“ oder „weiter über Fehler-Ausgang“. Dazu kommt ein Fehler-Workflow mit eigenem Auslöser.
  - **Power Automate:** Try/Catch/Finally entsteht über Bereiche (Scopes) und „Ausführen nach“.
  - **Salesforce:** Ohne Fehlerpfad bleibt ein Lauf hängen, bis ein Admin eingreift.
- **Bedeutung für MAKE OS:**
  - Jede Aktion auf der Fläche kann eine rote Kante „bei Fehler“ bekommen.
  - Ohne eigene Kante gilt der Standard: anhalten, dann eine Glocke an die Prozess-Verantwortliche.
- **Quellen:**
  - https://help.zapier.com/hc/en-us/articles/22495436062605 (ohne Datum, abgerufen 21.10.2026)
  - https://help.zapier.com/hc/en-us/articles/27853200252429-Custom-error-handling-is-more-powerful-now-with-conditional-logic (ohne Datum)
  - https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.errortrigger/ (ohne Datum)
  - https://www.matthewdevaney.com/power-automate-standards-error-handling/ (Drittquelle, ohne Datum)
  - https://www.salesforceben.com/avoid-headaches-with-error-management-and-fault-paths-in-salesforce-flow/ (ohne Datum)

---

## C. Daten zwischen Schritten

### 14. Daten über eine stabile Schritt-Kennung und mit bekanntem Aufbau holen
- **Erkenntnis:** Zwei Fehlerquellen kommen bei der Datenübergabe immer wieder vor:
  - Verweise auf „das, was gerade hereinkommt“ liefern nach einem Umbau still falsche Werte.
  - Unbekannte Ausgabe-Strukturen machen das Zuordnen blind.
- **Wie die Besten es machen:**
  - n8n kennt `$json` (aktuelles Element) und `$('Knotenname').item.json` (Element eines bestimmten früheren Knotens). Drittquellen warnen: `$json` kann nach dem Einfügen eines Knotens still die falschen Daten liefern. Der Namensverweis bleibt verlässlich.
  - Bei Make beschreibt jedes Modul seine Ausgaben. Fehlt diese Beschreibung (z. B. bei rohem JSON), zeigt die Zuordnung nur Zähler.
- **Bedeutung für MAKE OS:**
  - Jeder Schritt hat eine feste Kennung und einen festen Aufbau seiner Ausgabe.
  - Werte werden per Klick zugeordnet (z. B. „Deal › Wert“, „Kontakt › Vorname“), nicht über freie Ausdrücke.
  - Ein Umbenennen in der Anzeige bricht keinen Verweis.
- **Quellen:**
  - https://docs.n8n.io/data/data-mapping/referencing-other-nodes (ohne Datum, abgerufen 21.10.2026)
  - https://nordflux.de/en/guides/understanding-expressions-mapping-json-node-and-items-without-code (Drittquelle, ohne Datum)
  - https://help.make.com/iterator.md (ohne Datum)

### 15. Feste Formatierer statt Code im Prozess
- **Erkenntnis:** Code-Schritte sind mächtig, aber schwer prüfbar. Selbst bei den Großen lassen sich ihre Ergebnisse nicht überall weiterverwenden.
- **Wie die Besten es machen:**
  - HubSpot hat eine Code-Aktion (JavaScript/Python) mit Ausgabewerten. Laut Community (Juli 2025) lassen sich diese Ausgaben aber nicht direkt als Bedingung in Zweigen nutzen. Der Umweg führt über eine Eigenschaft am Datensatz.
  - Make bietet Funktionen wie `map()` und `get()` für Listen.
  - HubSpot hat daneben eine native Aktion zum Formatieren von Daten.
- **Bedeutung für MAKE OS:**
  - Es gibt eine kleine, feste Auswahl an Formatierern:
    - Datum ± n Tage/Werktage NRW über den Kalender-Kern,
    - Betrag in Euro und Cent über `lib/finanzen/ust.ts`,
    - Text-Vorlage mit Platzhaltern,
    - Liste zählen bzw. erste Zeile.
  - Benutzer-Code gibt es im Prozess nicht: Das ist eine Sicherheitsfrage und sie hält jede Instanz gleich.
- **Quellen:**
  - https://www.spotdev.co.uk/blog/custom-coded-action-vs-native-hubspot-action (Partner-Blog, ohne Datum)
  - https://community.hubspot.com/t5/Data-Hub/bd-p/Operations_Hub/label-name/Workflow%20Extension (Community, Juli 2025)
  - https://help.make.com/iterator.md (ohne Datum)

### 16. Das Lauf-Protokoll braucht Daten-Sparsamkeit als Einstellung
- **Erkenntnis:** Lauf-Protokolle mit vollen Nutzdaten helfen beim Debuggen. Sie sind aber eine eigene Ablage mit Personenbezug.
- **Wie die Besten es machen:**
  - Make hat die Einstellung „Daten sind vertraulich“. Dann wird keine Nutzlast im Protokoll gespeichert, nur dass ein Lauf stattfand. Make warnt, dass Fehler dann kaum noch zu lösen sind.
  - Gespeicherte unvollständige Läufe zählen bei Make auf den Speicher des Tarifs.
  - n8n löscht mit einem Workflow auch dessen Lauf-Historie.
- **Bedeutung für MAKE OS:**
  - Das Lauf-Protokoll speichert Kennungen, Schritt-Status und Feldnamen, keine Inhalte. Das entspricht dem Muster von Änderungs- und KI-Protokoll.
  - Inhalte stehen ohnehin in den Beständen, auf die die Kennungen zeigen.
  - Das Protokoll braucht dazu:
    - eine Löschfrist,
    - einen Eintrag im Speicher-Register,
    - Unterstützung für Art. 15 und Art. 17.
- **Quellen:**
  - https://help.make.com/scenario-settings (ohne Datum, abgerufen 21.10.2026)
  - https://docs.n8n.io/workflows/executions/all-executions (ohne Datum)

---

## D. Lauf und Fehlersuche

### 17. Probelauf mit festgehaltenen Beispieldaten, ohne echte Wirkung
- **Erkenntnis:** Bauen geht nur mit einem schnellen Testlauf. Der darf aber keine echten Daten verändern.
- **Wie die Besten es machen:**
  - n8n kann Ausgaben eines Knotens festhalten („pinnen“) und bearbeiten, um Grenzfälle zu üben. Das ist nur beim Entwickeln möglich, nie in Produktion.
  - Salesforce hat einen Debug-Modus mit „Rollback“, damit Testläufe nichts verändern. Testläufe können als ein anderer Nutzer laufen, um Rechte zu prüfen. Aus Debug-Werten lässt sich ein gespeicherter Flow-Test machen.
- **Bedeutung für MAKE OS:**
  - Der Knopf „Probelauf“ auf der Fläche spielt einen Beispiel-Fall durch (aus der Demo-Saat oder einem echten Fall).
  - Er schreibt nichts und zeigt je Schritt, was passieren würde (Trockenlauf).
  - Ein Probelauf lässt sich als Testfall speichern und vor jedem Veröffentlichen erneut abspielen.
- **Quellen:**
  - https://docs.n8n.io/build/work-with-data/pin-and-mock-data (ohne Datum, abgerufen 21.10.2026)
  - https://trailhead.salesforce.com/content/learn/modules/flow-implementation-2/debug-flows-as-another-user (ohne Datum)

### 18. Lauf-Historie direkt auf der Fläche einfärben
- **Erkenntnis:** Am verständlichsten ist ein Lauf, wenn man ihn auf demselben Bild sieht, auf dem der Prozess gebaut wurde.
- **Wie die Besten es machen:**
  - Attio öffnet einen Lauf als Leinwand im damaligen Zustand:
    - Grüne Pfeile zeigen den gelaufenen Weg.
    - Grüne Haken markieren erfolgreiche Blöcke, rote markieren fehlgeschlagene.
    - Laufzeit und verbrauchte Credits stehen am Lauf.
  - Bei n8n sind Läufe nach Status, Zeitraum und eigenen Merkmalen filterbar. Man kann einen alten Lauf in den Editor laden.
- **Bedeutung für MAKE OS:** Das ist genau „schönes Miro nach außen, dahinter Automatisierung“.
  - Die Fläche hat zwei Modi: „Bauen“ und „Läufe“.
  - Im Lauf-Modus färbt sich der Plan:
    - grün: gelaufen,
    - gelb: wartet,
    - rot: Fehler,
    - grau: nicht erreicht.
  - Daneben steht eine Liste der Fälle.
- **Quellen:**
  - https://attio.com/help/reference/automations/workflows/troubleshooting-workflows (ohne Datum, abgerufen 21.10.2026)
  - https://docs.n8n.io/workflows/executions/all-executions (ohne Datum)

### 19. Ab der Fehlerstelle wiederholen statt von vorn
- **Erkenntnis:** Ein gescheiterter Lauf soll an der Fehlerstelle weitermachen, nicht von vorn beginnen. Sonst werden erfolgreiche Schritte doppelt ausgeführt.
- **Wie die Besten es machen:**
  - Zapiers „Replay“ überspringt erfolgreiche Schritte und wiederholt nur den gescheiterten. Eine schon gesendete Mail geht also nicht noch einmal raus.
  - Bei n8n wählt man, ob mit der Original-Version oder der jetzt gespeicherten Version wiederholt wird.
  - Make legt unvollständige Läufe ab. Nach der Korrektur setzt man an der Fehlerstelle fort.
- **Bedeutung für MAKE OS:**
  - Der Lauf speichert den Status jedes Schritts (das Muster des Absichtsprotokolls `mitVorgang`/`schritt` existiert bereits).
  - Es gibt „erneut ab hier“ je Lauf und „alle mit diesem Fehler erneut“ je Prozess.
- **Quellen:**
  - https://help.zapier.com/hc/en-us/articles/8496241726989 (ohne Datum, abgerufen 21.10.2026)
  - https://docs.n8n.io/workflows/executions/all-executions (ohne Datum)
  - https://help.make.com/Overview-of-error-handling (ohne Datum)

### 20. Automatisch wiederholen mit Backoff, und Fehlerarten unterscheiden
- **Erkenntnis:** Nicht jeder Fehler ist wiederholbar.
  - Vorübergehende Fehler werden mit wachsendem Abstand wiederholt: Netz, Server-Fehler, „zu viele Anfragen“.
  - Dauerhafte Fehler nie: ungültige Eingabe, fehlende Rechte.
- **Wie die Besten es machen:**
  - HubSpot wiederholt Webhook-Aktionen bei Server-Fehlern (5xx) über bis zu 3 Tage, bei 429 ebenfalls, bei 4xx nie.
  - Zapier versucht bis zu fünfmal mit wachsendem Abstand. Die Fehler-Mail kommt erst, wenn der letzte Versuch scheitert.
  - Inngest wiederholt standardmäßig viermal je Schritt (0–20 einstellbar).
  - Temporal empfiehlt:
    - eine Obergrenze für Versuche und Gesamtzeit,
    - eine Markierung „nicht wiederholbar“ für bestimmte Fehler,
    - keine versteckten Wiederholungen innerhalb eines Schritts.
- **Bedeutung für MAKE OS:**
  - Jede Aktion meldet „vorübergehend“ oder „dauerhaft“.
  - Der vorhandene Backoff (`wartenNachFehler`: 5 · 3^(n−1) min, höchstens 3 h) wird auf Prozess-Schritte übertragen.
  - Eine Meldung kommt erst bei endgültigem Fehler.
- **Quellen:**
  - https://developers.hubspot.com/docs/methods/workflows/webhook_information (ohne Datum, abgerufen 21.10.2026)
  - https://help.zapier.com/hc/en-us/articles/14167175792909-Decide-how-your-Zap-handles-errors-with-advanced-settings (ohne Datum)
  - https://www.inngest.com/docs/reference/typescript/functions/create (ohne Datum)
  - https://docs.temporal.io/design-patterns (ohne Datum)
  - https://docs.temporal.io/best-practices/error-handling.md (ohne Datum)

### 21. Durable Execution: Schritt-Ergebnisse festhalten, Lauf jederzeit fortsetzbar
- **Erkenntnis:** Abläufe über Tage und Wochen überleben Neustarts nur, wenn jeder fertige Schritt sein Ergebnis dauerhaft ablegt. Beim Fortsetzen wird er dann nicht erneut ausgeführt.
- **Wie die Besten es machen:**
  - Inngest speichert das Ergebnis jedes `step.run` und setzt es beim Wiederanlauf ein, statt den Code erneut auszuführen. Jeder Schritt ist ein eigener Aufruf.
  - Temporal hält eine Ereignis-Historie und spielt sie beim Fortsetzen nach. Zeit, Zufall und Netzzugriffe gehören deshalb nicht in die Ablauf-Logik, sondern in Aktivitäten.
- **Bedeutung für MAKE OS:**
  - Ein Temporal-Cluster passt nicht zu 1 vCPU und 2 GB. Das Muster passt aber:
    - Ein Lauf ist ein Datensatz (Prozess-Version, Fall, aktueller Schritt, Ergebnisse je Schritt) in einem Bestand.
    - Der Takt nimmt fällige und wartende Läufe auf.
  - Die Zeit setzt immer der Server und speichert sie im Lauf. Der Prozess rechnet sie beim Fortsetzen nie neu.
- **Quellen:**
  - https://www.inngest.com/docs/learn/how-functions-are-executed (ohne Datum, abgerufen 21.10.2026)
  - https://docs.temporal.io/activities (ohne Datum)

### 22. Idempotenz auf zwei Ebenen: Lauf und Wirkung
- **Erkenntnis:** Wiederholungen sind nur sicher, wenn doppelte Starts und doppelte Wirkungen erkannt werden. Ein Schlüssel muss über Wiederholungen gleich bleiben.
- **Wie die Besten es machen:**
  - Inngest hat einen Idempotenz-Schlüssel je Auslöser (24 h).
  - Trigger.dev nutzt Idempotenz-Schlüssel beim Anlegen einer Freigabe-Marke, z. B. „approve-<Dokument>“. Eine Wiederholung legt so keine zweite Freigabe an.
  - Temporal empfiehlt fachliche Schlüssel (Bestell-Nr.) oder Lauf-ID plus Schritt-ID. Es empfiehlt außerdem eine Eindeutigkeits-Sperre in der Datenhaltung statt „erst prüfen, dann anlegen“, das unter Wiederholung zu Rennen führt.
- **Bedeutung für MAKE OS:**
  - Die Lauf-Kennung wird aus Prozess und Fall gebildet. Ein zweiter Start desselben Falls wird so erkannt.
  - Jede Wirkung trägt `<lauf>-<schritt>` als feste Kennung. MAKE OS macht das heute schon so bei `fu-…`, `nw-…`, `ch-nw-…` und `einmalig()`.
  - Gibt es die Kennung schon, wird der Schritt übersprungen.
- **Quellen:**
  - https://www.inngest.com/docs/reference/typescript/functions/create (ohne Datum)
  - https://trigger.dev/docs/wait-for-token (ohne Datum, abgerufen 21.10.2026)
  - https://temporal.io/blog/idempotency-and-durable-execution (27.02.2024)

### 23. Gleichzeitigkeit, Drosseln und Bündeln je Schlüssel
- **Erkenntnis:** Pro Fall soll nur ein Lauf gleichzeitig arbeiten. Schnelle Änderungsfolgen sollen einmal wirken, nicht zehnmal.
- **Wie die Besten es machen:**
  - Inngest hat dafür mehrere Werkzeuge:
    - Gleichzeitigkeit je Schlüssel (z. B. je Kunde),
    - Drosseln, das verzögert,
    - Ratenbegrenzung, die verwirft,
    - Entprellen: Erst nach Ruhe läuft es, mit dem letzten Ereignis.
    - Bündeln bis 100 Ereignisse.
  - Make bietet „sequenzielle Verarbeitung“: Ein Lauf wartet auf den vorigen.
  - Pipedream drosselt mit Warteschlange (Standard 100, bis 10.000).
  - Trigger.dev arbeitet mit Warteschlangen je Mandant über einen Gleichzeitigkeits-Schlüssel.
- **Bedeutung für MAKE OS:** Die Vorgaben sind:
  - ein Lauf je Fall und Prozess gleichzeitig,
  - Entprellen für Feld-Änderungen (z. B. 2 Minuten),
  - eine Obergrenze je Haushalt und Takt.

  Auf dem kleinen Server ist das keine Kür, sondern Pflicht.
- **Quellen:**
  - https://www.inngest.com/docs/reference/typescript/functions/create (ohne Datum)
  - https://help.make.com/scenario-settings (ohne Datum)
  - https://pipedream.com/docs/workflows/building-workflows/settings/concurrency-and-throttling (ohne Datum)
  - https://trigger.dev/docs/queue-concurrency (ohne Datum, abgerufen 21.10.2026)

### 24. Pausieren, Abbrechen, Massenabbruch: drei getrennte Hebel
- **Erkenntnis:** „Stopp“ kann drei Dinge heißen:
  - keine neuen Läufe mehr,
  - diesen einen Lauf beenden,
  - alle Läufe eines Prozesses beenden.

  Man braucht alle drei.
- **Wie die Besten es machen:**
  - Inngest bricht Läufe einzeln oder in Masse ab (Zeitraum plus Ausdruck). Ein gerade laufender Schritt wird dabei noch zu Ende ausgeführt.
  - Ein Massenabbruch verhindert bei Inngest keine neuen Läufe. Dafür pausiert man die Funktion.
  - Pipedream liefert beim Aussetzen je Lauf einen Fortsetzen- und einen Abbrechen-Link.
- **Bedeutung für MAKE OS:**
  - Am Prozess: „Pausieren“ (neue Fälle sammeln sich, starten nach dem Fortsetzen) und „Alle laufenden abbrechen“ (mit Vorschau „n Läufe“, Rückfrage).
  - Am Lauf: „Abbrechen“ mit Grund.
- **Quellen:**
  - https://www.inngest.com/docs/guides/cancel-running-functions (ohne Datum, abgerufen 21.10.2026)
  - https://pipedream.com/docs/workflows/building-workflows/code/nodejs/rerun (ohne Datum)

### 25. Versionen: laufende Fälle bleiben auf ihrer Version
- **Erkenntnis:** Ändert man einen Prozess, während Fälle mitten drin stehen, entstehen sonst Brüche: Schritte fehlen oder Pfade passen nicht mehr.
- **Wie die Besten es machen:**
  - Temporal bietet zwei Wege:
    - **Patching:** Der Code verzweigt nach Version.
    - **Worker Versioning:** Läufe werden an eine Version gebunden („pinning“).
  - Für große Änderungen legt Temporal den Ablauf unter neuem Namen an und lässt den alten auslaufen. Der experimentelle Vorgänger von Worker Versioning wird laut Doku ab März 2026 nicht mehr unterstützt.
  - Salesforce: Laut einer Drittquelle laufen pausierte Interviews mit der Version weiter, die beim Pausieren aktiv war.
- **Bedeutung für MAKE OS:**
  - Jeder Lauf trägt die Prozess-Version, mit der er gestartet ist.
  - Eine neue Version gilt nur für neue Fälle.
  - „Laufende Fälle umziehen“ gibt es nur ausdrücklich, mit einer Schritt-Zuordnung alt → neu und einer Vorschau.
- **Quellen:**
  - https://docs.temporal.io/develop/typescript/workflows/versioning (ohne Datum, abgerufen 21.10.2026)
  - https://rioeducation.helpjuice.com/form-save-and-continue (Drittquelle, ohne Datum)

### 26. Entwurf und Veröffentlicht trennen, mit Versionsliste und Rückkehr
- **Erkenntnis:** Gebaut wird in einem Entwurf. Live läuft nur eine bewusst veröffentlichte, gesperrte Version.
- **Wie die Besten es machen:**
  - **n8n (seit Jan. 2026, Version 2.x):**
    - Speichert alle 2 Sekunden selbst.
    - Bearbeitet wird im Entwurf; Produktion läuft immer auf der veröffentlichten Version.
    - Versionen bekommen Namen.
    - Bearbeitet jemand, ist die Fläche für andere nur lesbar.
  - **Zapier:** Entwürfe neben dem laufenden Zap, nummerierte Versionen und Rückkehr zu einer alten.
  - **Activepieces:** Eine veröffentlichte Version ist gesperrt. Bearbeiten erzeugt einen Entwurf als Kopie.
  - **HubSpot:** Revisionsverlauf mit Rückkehr.
  - **Attio:** Wiederherstellen ersetzt den Entwurf und muss neu veröffentlicht werden.
- **Bedeutung für MAKE OS:**
  - Die Fläche ist immer der Entwurf: automatisch gespeichert, mit Stand und 409 statt Bearbeitungssperre (bewährtes MAKE-OS-Muster).
  - „Veröffentlichen“ fragt nach Name und Notiz.
  - Die Versionsliste bietet „ansehen“, „als Entwurf übernehmen“ und „vergleichen“.
- **Quellen:**
  - https://alternativeto.net/news/2026/1/n8n-adds-autosave-versioned-publishing-and-concurrency-protection-for-workflow-automation/ (14.01.2026)
  - https://docs.n8n.io/workflows/history (ohne Datum)
  - https://help.zapier.com/hc/en-us/articles/8496260938125 (ohne Datum)
  - https://activepieces.com/docs/flows/versioning (ohne Datum)
  - https://knowledge.hubspot.com/workflows/view-workflow-changes (aktualisiert 03.08.2026)
  - https://attio.com/help/reference/automations/workflows/troubleshooting-workflows (ohne Datum)

---

## E. Freigabe und Benachrichtigung

### 27. Freigabe als eigener Schritt mit Zeitlimit, Ablaufpfad und „Ändern“
- **Erkenntnis:** Seit 2025 haben alle Großen einen Menschen-Schritt eingebaut. Er hält den Lauf an und fragt nach Ja oder Nein, nach Änderungen oder nach fehlenden Daten. Danach geht der Lauf mit dem Ergebnis weiter.
- **Wie die Besten es machen:**
  - **Zapier „Human in the Loop“ (2025):**
    - „Freigabe anfragen“: genehmigen, ablehnen oder Daten ändern.
    - „Daten einsammeln“: Formular mit Feldern.
    - Zeitlimit mit wählbarem Ergebnis (weiter oder stopp) und Erinnerungen an Prüfer.
    - Benachrichtigung per Mail, Slack oder über einen eigenen Auslöser.
    - Zählt nicht als Task.
  - **Trigger.dev v4:** Wartemarken (Waitpoint Tokens) mit Zeitlimit. Bei Ablauf kommt „nicht ok“ zurück.
  - **Power Automate:** Freigaben laufen standardmäßig nach 30 Tagen ab; der ganze Lauf darf nicht länger dauern. Für längere Wartezeiten nimmt man das Staffel-Muster mit zwei Abläufen.
  - **Salesforce (Spring ’25):** Freigabe-Abläufe mit Stufen und parallelen Schritten. Ein „Approval Trace“ zeigt, wer gerade am Zug ist.
- **Bedeutung für MAKE OS:** Der ZOE-Stapel ist schon dieser Baustein. Im Prozess wird er zum Schritt „Freigabe“:
  - **Ausgänge:** „freigegeben“, „abgelehnt (mit Grund)“ und „abgelaufen“.
  - **Aktionen:** „Ändern & freigeben“ ist erlaubt.
  - **Zeitlimit:** Vorgabe z. B. 3 Werktage, danach eine einzige Erinnerung.
  - **Zuständig:** Angezeigt wird, wer gerade dran ist.

  Jede Außenwirkung (Mail, WhatsApp, Angebot, Rechnung) geht zwingend über diesen Schritt. Das macht die Regel „nichts nach außen ohne Klick“ im Prozess-Modell sichtbar.
- **Quellen:**
  - https://www.zapier.com/blog/human-in-the-loop-guide (25.09.2025)
  - https://ob-zapier.helpjuice.com/request-approval-to-keep-your-workflow-running-with-human-in-the-loop (aktualisiert 20.08.2025)
  - https://trigger.dev/docs/wait-for-token (ohne Datum)
  - https://trigger.dev/changelog/trigger-v4-ga (2025)
  - https://nordflux.de/en/guides/30-day-timeout-on-approvals-in-power-automate-the-relay-pattern-as-a-solution (Drittquelle, 2026)
  - https://www.salesforceben.com/salesforce-spring-25-release-new-flow-approval-process-capabilities/ (2025)

### 28. Freigabe auch für das Veröffentlichen sensibler Prozesse
- **Erkenntnis:** Nicht nur Läufe, auch Änderungen an Prozessen können Schaden anrichten. Gute Plattformen prüfen deshalb das Veröffentlichen.
- **Wie die Besten es machen:**
  - Bei Activepieces („Flow Approvals“) brauchen Nicht-Admins in als sensibel markierten Projekten eine Freigabe zum Veröffentlichen. Eine abgelehnte Version kann als Entwurf weiterbearbeitet werden.
  - Zapier lässt das automatische Wiederholen für das ganze Konto nur Inhaber bzw. Super-Admins einschalten.
- **Bedeutung für MAKE OS:**
  - Prozesse mit Außenwirkung, Geldbezug oder Personendaten veröffentlicht nur die Inhaberin bzw. der Inhaber, oder sie brauchen deren Freigabe.
  - Team-Personen und Konten mit `finanzRecht: 'business'` bauen Entwürfe.
- **Quellen:**
  - https://www.activepieces.com/docs/flows/flow-approvals.md (ohne Datum, abgerufen 21.10.2026)
  - https://help.zapier.com/hc/en-us/articles/8496241726989 (ohne Datum)

### 29. Benachrichtigen: erst bei endgültigem Fehler, gebündelt und nach Wichtigkeit
- **Erkenntnis:** Die Menge an Meldungen entscheidet, ob man ihnen noch vertraut. Die Besten melden spät und gebündelt.
- **Wie die Besten es machen:**
  - Zapier schickt Fehler-Mails erst nach dem letzten automatischen Versuch.
  - Zapier warnt, wenn ein Zap in 7 Tagen zu 95 % fehlschlägt und mehr als 20 Mal lief. Danach schaltet es ab, mit 24 bzw. 72 Stunden Kulanz je Tarif.
  - Benachrichtigungs-Dienste empfehlen:
    - Stufen nach Wichtigkeit (kritisch sofort, Rest gebündelt),
    - Sammeln in Zeitfenstern (5–30 Minuten oder ein Tag),
    - Nicht-Handlungsrelevantes nur in Übersichten.
- **Bedeutung für MAKE OS:**
  - In die Glocke kommen nur:
    - endgültige Fehler,
    - Freigaben,
    - zurückgehaltene Massenläufe.
  - Alles andere geht in eine Tageszeile „Prozesse heute: n gelaufen, m warten“ auf „Heute“.
  - Je Prozess und Fehlerart gibt es höchstens eine ungelesene Meldung. Die Regel „neuere ersetzt“ steht schon in `lib/meldungen/regeln.ts`.
- **Quellen:**
  - https://help.zapier.com/hc/en-us/articles/19532291509901-More-time-to-fix-Zaps-that-error (Produkt-Update Sept. 2023, aktualisiert 29.05.2026)
  - https://www.courier.com/blog/what-is-alert-fatigue (ohne Datum)
  - https://knock.app/template-library/workflows/alert-digest (ohne Datum)
  - https://tines.com/blog/chatops-fatigue-how-to-create-alerts-that-matter (ohne Datum)

---

## F. Rechte, Kosten, Grenzen, Überwachung, Vorlagen

### 30. Mengen- und Kostenbudget sichtbar machen, gezielt bremsen
- **Erkenntnis:** Alle rechnen Automatisierung in Einheiten ab: Operationen, Credits oder Aktionen. Gute Systeme zeigen den Verbrauch je Lauf und warnen rechtzeitig.
- **Wie die Besten es machen:**
  - **Make:** Seit 27.08.2025 rechnet Make in Credits (1 Operation = 1 Credit). KI-Funktionen können mehr kosten.
  - **monday:** Je Konto 250, 25.000 oder 250.000 Aktionen pro Monat. Mehrschrittige Automationen verbrauchen das schnell.
  - **ClickUp:**
    - Warn-Mails bei 90 % und 100 %.
    - Bei Überschreitung pausieren alle Automationen bis Monatsende.
  - **Attio:** Zeigt die verbrauchten Credits je Lauf.
- **Bedeutung für MAKE OS:**
  - Je Lauf werden Schritte und KI-Aufrufe gezählt. Das KI-Protokoll misst schon.
  - Es gibt ein Budget je Instanz mit Warnung bei 80 % und 100 %.
  - Bei Überschreitung pausieren nie alle Prozesse stumm. Gebremst werden nur KI-Schritte bzw. der verursachende Prozess, mit Glocke.
- **Quellen:**
  - https://help.make.com/introducing-credits-new-billing-unit-live-in-make (27.08.2025)
  - https://support.monday.com/hc/en-us/articles/360002826680 (ohne Datum, abgerufen 21.10.2026)
  - https://help.clickup.com/hc/en-us/articles/23477062949911-Automations-feature-availability-and-limits (ohne Datum)
  - https://attio.com/help/reference/automations/workflows/troubleshooting-workflows (ohne Datum)

### 31. Frequenzgrenzen als Notbremse
- **Erkenntnis:** Harte Obergrenzen pro Zeitfenster fangen Endlosschleifen und Fehlbedienungen ab, bevor sie großen Schaden anrichten.
- **Wie die Besten es machen:**
  - Pipedrive erlaubt firmenweit 10.000 Ausführungen in 10 Minuten und je Automation 5.000. Danach wird bis zum nächsten Fenster nichts mehr angenommen.
  - Die Zahl aktiver Automationen ist je Tarif gedeckelt (50, 150 oder 250).
  - monday hat Minutengrenzen, die laut Hilfe gerade bei Endlosschleifen greifen.
- **Bedeutung für MAKE OS:**
  - Läuft ein Prozess mehr als n-mal je Stunde (Vorgabe aus der Fallzahl), pausiert er sich selbst.
  - Es gibt eine Glocke und einen HOI-Befund.
  - „Fortsetzen“ gibt es nur per Klick.
- **Quellen:**
  - https://support.pipedrive.com/en/article/workflow-automation-frequency-limits (ohne Datum, abgerufen 21.10.2026)
  - https://support.pipedrive.com/en/article/automation-limits (aktualisiert Sept. 2026)
  - https://support.monday.com/hc/en-us/articles/9060097050258-Automation-and-integration-rate-limits (ohne Datum)

### 32. Gesundheit der Prozesse messen: Fehlerquote, hängende Läufe, Wirkung
- **Erkenntnis:** Ohne eine Übersicht merkt niemand, dass ein Prozess seit Wochen still scheitert oder hängt.
- **Wie die Besten es machen:**
  - **n8n „Insights“** zeigt:
    - Produktionsläufe und fehlgeschlagene Läufe,
    - Fehlerquote,
    - durchschnittliche Laufzeit,
    - gesparte Zeit (je Lauf in Minuten eingetragen),
    - Vergleich zur Vorperiode.
  - **HubSpot:** Leistung je Aktion lässt sich nach Fehlern sortieren.
  - **Salesforce:** Eine eigene Liste zeigt pausierte und fehlgeschlagene Läufe. Achtung: Standardmäßig zeigt sie nur pausierte; behandelte Fehler erscheinen gar nicht.
- **Bedeutung für MAKE OS:** Ein HOI-Befund „Prozesse“ mit Zahlen:
  - Fehlerquote 7 Tage,
  - hängende Läufe (wartet länger als vorgesehen, Freigabe überfällig),
  - abgelaufene Wartestellen.

  Dazu kommt eine Kachel „gesparte Zeit“ je Prozess als Nutzen-Kennzahl, z. B. für den Business-Index.
- **Quellen:**
  - https://docs.n8n.io/administer/observe-and-log/track-usage-with-insights (ohne Datum, abgerufen 21.10.2026)
  - https://www.salesforceben.com/avoid-headaches-with-error-management-and-fault-paths-in-salesforce-flow/ (ohne Datum)
  - https://insidea.com/blog/hubspot/kb/how-to-monitor-workflow-health-in-hubspot (Drittquelle, ohne Datum)

### 33. Schleifenschutz über die Herkunft jeder Änderung
- **Erkenntnis:** Die häufigste Endlosschleife: Prozess A ändert ein Feld, das A selbst oder Prozess B wieder auslöst.
- **Wie die Besten es machen:**
  - **Power Automate:**
    - Warnt im Designer vor Auslöse-Schleifen.
    - Empfohlen sind Trigger-Bedingungen „nicht vom eigenen Dienstkonto“ oder ein Merkfeld.
    - Gleichzeitigkeits-Steuerung macht die Schleife nur langsamer, nicht weg.
  - **monday:** Laut Community lässt sich nicht erkennen, wer eine Änderung ausgelöst hat. Eine Änderung auf denselben Wert löst nichts aus, was viele Schleifen stoppt.
- **Bedeutung für MAKE OS:**
  - Jede Wirkung eines Prozesses trägt ihre Herkunft (`prozess:<id>`, `lauf:<id>`). Das Änderungsprotokoll hat das Feld schon („wer“).
  - Ein Auslöser ignoriert Änderungen aus demselben Prozess.
  - Ketten über mehrere Prozesse bekommen eine Tiefe (z. B. höchstens 3).
  - Eine Änderung auf denselben Wert ist kein Ereignis.
  - Beim Veröffentlichen prüft MAKE OS statisch, ob ein Prozess ein Feld schreibt, auf das er selbst hört.
- **Quellen:**
  - https://tomriha.com/how-to-avoid-infinite-trigger-loop-in-power-automate/ (Drittquelle, ohne Datum)
  - https://manueltgomes.com/microsoft/power-platform/powerautomate/power-automate-common-questions/how-to-stop-an-infinite-trigger-loop-in-power-automate/ (Drittquelle, ohne Datum)
  - https://community.monday.com/t/possible-infinite-loop-caused-by-api-and-monday-integrations-automations/49950 (Community, ohne Datum)

### 34. Rechte: wer baut, wer veröffentlicht, wer gibt frei, als wer läuft es
- **Erkenntnis:** Bei Prozessen gibt es vier Rollen:
  - Bauen,
  - Veröffentlichen,
  - Freigeben (Menschen-Schritt),
  - die Identität, unter der der Lauf schreibt.
- **Wie die Besten es machen:**
  - Zapier: Prüfer von Freigaben brauchen ein eigenes Konto, und der Zap muss mit ihnen geteilt sein.
  - Salesforce testet Abläufe „als anderer Nutzer“, um Rechte zu prüfen.
  - Activepieces trennt Admins (veröffentlichen direkt) von Nicht-Admins (brauchen Freigabe).
- **Bedeutung für MAKE OS:**
  - Ein Lauf schreibt im Namen einer benannten Person: der auslösenden Person bzw. der Prozess-Verantwortlichen.
  - Es gibt nie einen stillen Rückfall auf den Inhaber (Regel 5).
  - Privat- und Business-Prozesse werden serverseitig getrennt. Ein Business-Prozess sieht und schreibt nie Privat-Bestände. Dafür braucht es einen Wächtertest „Sicht X bekommt nichts aus Y“.
  - Freigaben sieht nur, wer sie entscheiden darf.
- **Quellen:**
  - https://www.zapier.com/blog/human-in-the-loop-guide (25.09.2025)
  - https://trailhead.salesforce.com/content/learn/modules/flow-implementation-2/debug-flows-as-another-user (ohne Datum)
  - https://www.activepieces.com/docs/flows/flow-approvals.md (ohne Datum)

### 35. Vorlagen-Bibliothek als Einstieg, mit Abhängigkeiten
- **Erkenntnis:** Die meisten starten mit einer Vorlage, nicht auf leerer Fläche. Vorlagen brauchen Filter nach Ziel und den Hinweis, was sie voraussetzen.
- **Wie die Besten es machen:**
  - HubSpot bietet „Aus Vorlage“ mit Suche nach Name, Beschreibung und Ziel und einem Filter nach nötigem Tarif.
  - Vorlagen aus dem HubSpot-Marktplatz können eine App voraussetzen, die vor dem Einschalten installiert sein muss.
  - Die n8n-Bibliothek wuchs laut Drittzählungen auf mehrere tausend Vorlagen.
- **Bedeutung für MAKE OS:**
  - Es gibt eine kleine, kuratierte Bibliothek je Bereich, z. B.:
    - Sales: Nachfassen nach Termin,
    - Fulfillment: Mandat-Start, Monatsabschluss,
    - Finanzen: Mahnlauf als Vorschlag,
    - Marketing: Danke nach Event.
  - Vorlagen liegen im Code ohne Daten und werden nie im Bestand gespeichert. Das Muster gibt es schon bei den Aufgaben-Startvorlagen.
  - Jede Vorlage zeigt „braucht: Gmail verbunden / Gesellschaft mit Absender“.
  - Sie lassen sich mit der Demo-Saat vorführen.
- **Quellen:**
  - https://knowledge.hubspot.com/workflows/create-workflows (ohne Datum, abgerufen 21.10.2026)
  - https://knowledge.hubspot.com/marketplace/install-workflow-templates-from-the-hubspot-marketplace (ohne Datum)
  - https://n8n-pulse.gui.do/templates?node=n8n (Drittquelle, ohne Datum)

---

## Anti-Pattern

1. **Selbstauslösende Schleife:** Ein Prozess schreibt ein Feld, auf das er selbst oder ein zweiter Prozess hört. Ohne Herkunft an der Änderung ist das nicht zu erkennen. Gleichzeitigkeits-Grenzen bremsen nur, sie heilen nichts (Power Automate, monday).

2. **Doppelte Ausführung durch Wiederholen:** Typische Ursachen sind:
   - Wiederholung ohne Idempotenz-Schlüssel,
   - „erst prüfen, dann anlegen“ unter gleichzeitigen Läufen,
   - Neustart von vorn statt ab der Fehlerstelle.

   Ergebnis: doppelte Mails, Aufgaben, Rechnungen (Temporal, Zapier Replay).

3. **Stille Fehler:**
   - „Weiter bei Fehler“ ohne Behandlung, oder Make-„Resume“ mit Ersatzwert, der den Fehler zudeckt.
   - In n8n kann ein Verweis auf „aktuelles Element“ nach einem Umbau still falsche Daten liefern.
   - Bei Salesforce erscheinen behandelte Fehler nicht in der Fehlerliste.

4. **Benachrichtigungsflut:** Jeder Versuch, jeder Schritt und jede Kleinigkeit meldet sich. Danach liest niemand mehr die wichtige Meldung. Gegenmittel: erst bei endgültigem Fehler melden, bündeln, nach Wichtigkeit stufen.

5. **Massenstart beim Einschalten oder Import:** Ein neuer Prozess erfasst plötzlich alle bestehenden Datensätze, oder ein Import startet hunderte Läufe (HubSpot „bestehende nicht einschreiben“, Zapier-Flutschutz).

6. **Warten ohne Ende:** Wartestellen ohne Obergrenze und ohne Ablaufpfad führen zu hängenden Läufen. Sie werden nie fertig und tauchen nirgends auf. Dazu kommen harte Plattform-Grenzen, die Läufe abbrechen (Salesforce „stuck paused“, Power Automate 30 Tage).

7. **Live-Änderung unter laufenden Fällen:** Wer die Version eines Prozesses tauscht, während Fälle mitten drin stehen, erzeugt fehlende Schritte und falsche Pfade. Laufende Fälle gehören an ihre Version gebunden (Temporal, Salesforce).

8. **Endlose oder versteckte Wiederholungen:** Dazu gehören:
   - Wiederholen ohne Obergrenze,
   - Wiederholen bei dauerhaften Fehlern (4xx),
   - Wiederholungs-Schleifen innerhalb eines Schritts.

   Das kostet Geld, verlängert Zeitlimits und versteckt Fehler vor der Überwachung (Temporal, HubSpot).

9. **Rollback-Illusion:** „Alles rückgängig“ funktioniert nur bei transaktionsfähigen Schritten. Bei Make gilt Rollback nur für entsprechende Module, der Rest bleibt verändert. Besser: ausgleichende Schritte (kompensieren) ausdrücklich modellieren.

10. **Alles-oder-nichts-Abschaltung:**
    - Bei Kontingent-Überschreitung pausieren alle Automationen bis Monatsende (ClickUp).
    - Fehlerhafte Prozesse werden ohne Rückfrage abgeschaltet.
    - Besser: gezielt den Verursacher bremsen, mit Kulanzfrist und Meldung (Zapier 24/72 h).

11. **Testdaten und Entwürfe in Produktion:** Festgehaltene Testdaten sind nur fürs Bauen da (n8n). Ein unveröffentlichter Teilprozess, auf den sich der Eltern-Prozess verlässt, überrascht im Betrieb (n8n-Community).

12. **Protokoll als Datenleck oder als Blindflug:** Entweder liegen volle Inhalte mit Personenbezug unbefristet im Lauf-Protokoll. Oder es wird so wenig gespeichert, dass kein Fehler mehr nachvollziehbar ist (Make „vertraulich“). Richtig: Kennungen und Status, Inhalte nur in den Beständen.

---

## Die 5 wichtigsten Empfehlungen

1. **Lauf-Motor nach dem Durable-Execution-Muster, auf dem Vorhandenen gebaut**
   - Ein Lauf ist ein Datensatz aus Prozess-Version, Fall, aktuellem Schritt und Ergebnis je Schritt.
   - Jede Wirkung trägt die feste Kennung `<lauf>-<schritt>` und wird übersprungen, wenn sie schon existiert.
   - Der Takt nimmt fällige und wartende Läufe auf.
   - „Erneut ab hier“ statt von vorn.
   - Wiederholung mit Backoff und Fehlerklassen (vorübergehend/dauerhaft).
   - Das sind Absichtsprotokoll, `einmalig()` und `wartenNachFehler`, nur verallgemeinert. Ein Temporal- oder Inngest-Cluster ist nicht nötig.

2. **Kleiner, fester Baukasten mit eingebauten Sicherungen**
   - Sechs Bausteine: Aktion, Raute, Warten, Schleife, Teilprozess, Fehlerkante.
   - Jede Raute hat einen sichtbaren Sonst-Zweig.
   - Jedes Warten hat Obergrenze und Ablauf-Ausgang.
   - Jede Schleife hat eine harte Grenze.
   - Jeder Prozess hat „Ziel erreicht, wenn …“ und „Abbrechen, wenn …“. Art. 18 und Werbesperre beenden immer.
   - Auslöser bestehen aus Ereignis plus Eintrittsbedingung (vor dem Lauf geprüft). Vorgabe „ein Lauf je Fall“, Wiedereintritt nur ausdrücklich.

3. **Freigabe ist ein Prozess-Schritt, und der Stapel ist dieser Schritt**
   - Jede Außenwirkung (Mail, WhatsApp, Angebot, Rechnung) läuft zwingend über „Freigabe“.
   - Ausgänge: freigegeben, abgelehnt mit Grund, abgelaufen.
   - „Ändern & freigeben“ ist möglich, mit Zeitlimit, einer Erinnerung und der Anzeige, wer gerade dran ist.
   - Prozesse mit Außenwirkung oder Geldbezug veröffentlicht nur der Inhaber bzw. sie brauchen dessen Freigabe.
   - Ein Lauf schreibt immer im Namen einer benannten Person. Business und Privat werden serverseitig getrennt.

4. **Entwurf, Veröffentlicht, Versioniert, dazu Probelauf und Lauf-Ansicht auf derselben Fläche**
   - Die Fläche ist der Entwurf (automatisch gespeichert, Stand/409).
   - Veröffentlichen mit Name und Notiz; laufende Fälle bleiben auf ihrer Version.
   - Probelauf als Trockenlauf mit einem Beispiel-Fall, speicherbar als Testfall.
   - Im Lauf-Modus färbt sich derselbe Plan nach dem echten Weg eines Falls: grün, gelb, rot, grau. Das ist das „schöne Miro nach außen“.

5. **Schutz und Überwachung ab Tag eins**
   - Schleifen: Herkunft an jeder Wirkung, Ketten-Tiefe begrenzt, Gleichwert-Änderung ist kein Ereignis, Selbst-Prüfung beim Veröffentlichen.
   - Massen: Flutschutz mit „n Läufe zurückgehalten“.
   - Pro Fall: ein Lauf gleichzeitig, Entprellen.
   - Kosten: Mengen- und Kostenbudget je Instanz; eine Notbremse pausiert nur den Verursacher.
   - Überwachung: HOI-Befund mit Fehlerquote, hängenden Läufen und überfälligen Freigaben.
   - Meldungen: Die Glocke meldet nur Endgültiges und Freigaben, alles andere kommt als Tageszeile auf „Heute“.
   - Das Lauf-Protokoll hält nur Kennungen und Status (Löschfrist, Register, Art. 15/17).
