# Recherche Teil 1 von 4 — Prozesse zeichnen, darstellen, verstehen

Stand: 21.10.2026. Quellen aus dem Web, in eigenen Worten zusammengefasst. Wo eine Seite kein Datum trägt, steht „ohne Datum“ und das Abrufdatum. Ältere Quellen (vor 2025) nur dort, wo sie bis heute der Maßstab sind (z. B. BPMN-Stilregeln) — so gekennzeichnet.

Bezug MAKE OS (aus `0-bestand.md`): vorhandener Editor mit Palette, Raster, „Alles zeigen“, PNG/SVG, Formen Schritt · Nachricht · Entscheidung · Erinnerung · Termin · Abstimmung/Bestätigung · Baustein, Ebenen 1–5, Grenze 400 Knoten, Fläche heute höhenbegrenzt, Flow-Linie (Lichtfaden) als Markenzeichen.

---

## A. Die große Fläche bedienen

### 1. Zwei Sprünge reichen für 90 % der Orientierung: „Alles zeigen“ und „Auswahl zeigen“
- **Erkenntnis:** Die Besten haben genau zwei feste Zoom-Kürzel — auf alles und auf die Auswahl — statt vieler Zoomstufen.
- **Wie die Besten es machen:** Miro: Opt/Alt + 1 = alles einpassen, Opt/Alt + 2 = auf Auswahl zoomen; M blendet die Minimap ein; Cmd/Ctrl + Shift + Pfeil hoch/runter geht in einen Rahmen hinein bzw. heraus. Die Kürzel wurden in der Vergangenheit geändert (Community-Beiträge mit Cmd + 1), Miro verweist deshalb auf die Kürzelliste im Programm (F1 bzw. „?“). tldraw bietet „fit to screen“ als Grundfunktion.
- **Bedeutung für MAKE OS:** „Alles zeigen“ gibt es schon — dazu „Auswahl zeigen“ und „in Rahmen hinein/heraus“ als feste Kürzel plus eine Kürzelübersicht hinter „?“.
- **Quelle(n):** https://miro.com/shortcuts/ (ohne Datum, © 2026, abgerufen 21.10.2026) · https://community.miro.com/ask-the-community-45/shortcuts-changed-9906 (2022) · https://tldraw.dev/features/out-of-the-box-whiteboard (ohne Datum, © 2026)

### 2. Minimap: klein, einfärbbar, anklickbar — aber optional
- **Erkenntnis:** Eine Minimap hilft auf großen Flächen nur, wenn man in ihr ziehen/zoomen kann und die Knoten darin nach Art gefärbt sind.
- **Wie die Besten es machen:** React Flow MiniMap: `pannable`/`zoomable` (Ziehen in der Minimap bewegt die Ansicht), `nodeColor` als Funktion (Farbe je Knotenart), eigener `ariaLabel`. tldraw liefert eine Minimap als Grundbaustein. Miro blendet sie per Taste M ein und aus; die Navigation über das Rahmen-Panel gilt dort als Hauptweg (Community-Wunsch nach einem umfassenderen Navigationspanel, März 2026).
- **Bedeutung für MAKE OS:** Minimap standardmäßig zu, per Taste an; Knoten darin in den Formfarben (grün/gelb/orange) und Status-Rot nur bei echtem Problem.
- **Quelle(n):** https://reactflow.dev/api-reference/components/minimap (zuletzt aktualisiert 11.10.2026) · https://tldraw.dev/features/out-of-the-box-whiteboard (© 2026) · https://community.miro.com/ask-the-community-45/would-a-universal-board-navigation-panel-be-useful-27865 (März 2026)

### 3. Semantischer Zoom: weit weg Formen und Zahlen, nah dran Text
- **Erkenntnis:** Gute Graph-Flächen zeigen je nach Zoomstufe unterschiedlich viel — weit weg nur farbige Formen und Titel, nah dran den vollen Inhalt.
- **Wie die Besten es machen:** KeyLines blendet Beschriftungen beim Zoomen abhängig von ihrer Größe aus und ein (Standard an). Obsidian Canvas schaltet ab einer festen Zoomschwelle von vollem Text auf reine Titel um (Nutzer wünschen sich die Schwelle einstellbar). Forschung (De Luca u. a., arXiv 2019) zeigt, dass kartenartige, zoombare Darstellungen bei Aufgaben und Erinnern besser abschneiden als normale Knoten-Kanten-Bilder.
- **Bedeutung für MAKE OS:** Drei Stufen festlegen — Landkarte (Form + Titel + Fall-Zahl), Prozess (Titel + Zuständig), Detail (Frist, Agent, Freigabe) — und die Stufe aus dem Zoom ableiten, nie im Knoten selbst entscheiden.
- **Quelle(n):** https://keylines.cambridge-intelligence.com/detailonzoom.htm (ohne Datum, abgerufen 21.10.2026) · https://forum.obsidian.md/t/option-to-adjust-canvas-text-visibility-threshold/50402 (2022) · https://arxiv.org/pdf/1906.05996v1.pdf (Juni 2019, Forschungsgrundlage)

### 4. Rahmen/Abschnitte sind gleichzeitig Ordnung, Navigation und Präsentation
- **Erkenntnis:** Die Besten nutzen Rahmen (Frames/Sections) als die eine Gliederung, aus der Inhaltsverzeichnis, Suche, Sprunglinks und Präsentationsfolge entstehen.
- **Wie die Besten es machen:** FigJam-Sections bündeln Objekte, lassen sich ein-/ausblenden und als Link an Kollegen geben. Excalidraw+ macht seit Mai 2025 Rahmennamen in der Flächensuche findbar und kann seit August 2025 Präsentationen ab einer bestimmten Folie teilen. Miro nutzt Rahmen als Folien im Präsentationsmodus und als Rahmen-Panel zur Navigation.
- **Bedeutung für MAKE OS:** Jede Prozessgruppe (Sales, Marketing, Fulfillment, Finanzen) ist ein Rahmen mit Namen — daraus entstehen Leiste links, Suchtreffer, Deep-Link (`?rahmen=`) und die Reihenfolge der Präsentation.
- **Quelle(n):** https://help.figma.com/hc/en-us/articles/1500004362321 (ohne Datum, abgerufen 21.10.2026) · https://plus.excalidraw.com/changelog/2 (Einträge Feb.–Nov. 2025) · https://community.miro.com/product-news-31/new-on-interactive-presentation-mode-click-to-zoom-lightbox-effect-13709 (ohne Datum)

### 5. Suche springt zum Knoten und rückt ihn ins Bild
- **Erkenntnis:** Auf großen Flächen ist Suchen schneller als Scrollen — der Treffer muss die Kamera dorthin fahren.
- **Wie die Besten es machen:** React Flow UI „Node Search“ (Befehlspalette, sucht in Knotentiteln, passt die Ansicht auf den gewählten Knoten an). Miro: Cmd/Ctrl + F auf der Fläche. Excalidraw durchsucht seit 2025 auch Rahmennamen und Bibliothekselemente.
- **Bedeutung für MAKE OS:** Suche (⌘K-artig) über Knoten, Rahmen, Agenten und Fälle der Prozessfläche; Treffer = Kamerafahrt + kurzes Aufleuchten des Lichtfadens am Knoten.
- **Quelle(n):** https://reactflow.dev/ui/components/node-search (ohne Datum; Bibliothek seit https://reactflow.dev/whats-new/2024-11-04) · https://miro.com/shortcuts/ (© 2026) · https://plus.excalidraw.com/changelog/2 (Mai und Sept. 2025)

### 6. Raster plus Hilfslinien statt freiem Schieben
- **Erkenntnis:** Ordnung entsteht, wenn Knoten beim Ziehen an Nachbarn (Kante/Mitte) einrasten und Pfeilenden an Formkanten andocken.
- **Wie die Besten es machen:** React Flow „Helper Lines“: beim Ziehen erscheinen Ausrichtungslinien, der Knoten rastet ein, auch bei Zoom/Verschieben korrekt. tldraw kennt drei Arten des Einrastens, u. a. Pfeilspitzen an Formkanten und Schlüsselpunkte; Rahmen sind Einrastziele. Excalidraw gab Rauten 2025 zusätzliche Andockpunkte.
- **Bedeutung für MAKE OS:** Raster bleibt, dazu Hilfslinien zu Nachbarknoten; die Raute (Entscheidung) bekommt vier feste Andockpunkte, damit Ja/Nein-Zweige sauber abgehen.
- **Quelle(n):** https://reactflow.dev/examples/interaction/helper-lines (zuletzt aktualisiert 11.10.2026) · https://tldraw.dev/sdk-features/snapping (ohne Datum, abgerufen 21.10.2026) · https://plus.excalidraw.com/changelog/2 (31.05.2025)

### 7. Auto-Layout auf Knopfdruck, nicht dauernd
- **Erkenntnis:** Die Besten ordnen auf Wunsch (Auswahl → „anordnen“) und halten danach die Hand des Menschen in Ruhe.
- **Wie die Besten es machen:** Whimsical: zwei oder mehr verbundene Formen wählen, vertikal oder horizontal anordnen — Verbinder werden neu geführt. Zapier Canvas hat „Auto layout“ für Verbinder und Schrittfolge. Lucid (März 2026): „Assisted layout“ und „Nudging“ — beim Aufklappen eines Containers rücken Nachbarn weg, statt zu überlappen. Technisch: React Flow empfiehlt dagre für Bäume (schnell, einfach) und elkjs für alles mit Containern und Kantenführung; ELK Layered (Blog 21.08.2025) arbeitet in fünf Phasen bis zur orthogonalen Kantenführung und kann mit „interaktiven“ Strategien die bisherigen Positionen respektieren.
- **Bedeutung für MAKE OS:** Ein Knopf „Ordnen“ (oben → unten im Prozess, links → rechts auf der Landkarte) mit ELK Layered und interaktiver Strategie, damit Handarbeit nicht jedes Mal zerstört wird; Ergebnis ist rückgängig machbar.
- **Quelle(n):** https://whimsical.com/learn/get-started/flowcharts (ohne Datum, abgerufen 21.10.2026) · https://www.zapier.com/blog/zapier-canvas-guide (aktualisiert Sept. 2025) · https://community.lucid.co/product-updates/lucid-suite-release-notes-march-2026-13072 (30.03.2026) · https://reactflow.dev/learn/layouting/layouting (11.10.2026) · https://eclipse.dev/elk/blog/posts/2025/25-08-21-layered.html (21.08.2025)

### 8. Bauen mit der Tastatur: Pfeiltaste legt den nächsten Schritt an
- **Erkenntnis:** Der schnellste Weg zu einem Ablauf ist „nächster Schritt in diese Richtung“ — die neue Form übernimmt den Stil der vorigen und ist schon verbunden.
- **Wie die Besten es machen:** Whimsical: S für Form, Alt/Option + Pfeiltaste fügt verbundene Form in dieser Richtung an, Schnell-Hinzufügen übernimmt Stil der letzten Form. Miro: Buchstabentasten je Werkzeug (S Form, L Verbinder, F Rahmen, C Kommentar), Cmd/Ctrl + D dupliziert, Cmd/Ctrl + G gruppiert. bpmn.io hat das „Anhängen über das Kontextmenü am Element“ zum Standard gemacht (seit 2014).
- **Bedeutung für MAKE OS:** Alt + Pfeil = nächster Schritt (gleiche Form), Tab am Knoten öffnet eine kleine Formauswahl (Schritt/Nachricht/Entscheidung/Erinnerung/Agent) — ohne Maus baubar.
- **Quelle(n):** https://whimsical.com/learn/get-started/flowcharts (ohne Datum) · https://miro.com/shortcuts/ (© 2026) · https://bpmn.io/blog/posts/2014-simple-process-modeling (2014, Ursprung des Musters)

### 9. Verbinder bleiben angeheftet und tragen eine Beschriftung
- **Erkenntnis:** Ein Pfeil ist ein Objekt mit eigener Bedeutung (Ergebnis, Bedingung, Wartezeit), nicht nur eine Linie.
- **Wie die Besten es machen:** tldraw: Pfeile sind über „Bindings“ an Formen gebunden und folgen beim Verschieben. FigJam: Verbinder mit eigener Farbe, Text, Endpunkten, Stärke; gerade und rechtwinklige Variante per Kürzel. BPMN-Stil (Bruce Silver): die Ausgänge einer Entscheidung tragen das Ergebnis des vorigen Schritts als Beschriftung („angenommen“, „abgelehnt“); bei zwei Ausgängen ist Ja/Nein auf eine Frage erlaubt.
- **Bedeutung für MAKE OS:** Zweige der Raute immer beschriftet (Pflicht im Editor), sonst Warnung; die Flow-Linie bleibt die eine Linienart, Beschriftung sitzt mittig auf der Linie.
- **Quelle(n):** https://tldraw.dev/features/out-of-the-box-whiteboard (© 2026) · https://help.figma.com/hc/en-us/articles/1500004362321 (ohne Datum) · https://www.trisotech.com/bpmn-style-rules/ (04.11.2019, bis heute Maßstab)

### 10. Container, die man zuklappen kann: Gruppen, Rahmen, Bahnen
- **Erkenntnis:** Große Prozesse bleiben lesbar, wenn Teile in Containern stecken, die man zu einer kompakten Form zuklappen kann.
- **Wie die Besten es machen:** Lucid (März 2026): Rahmen und Container zu- und aufklappen, auch bei Containern mit Assisted Layout; Nachbarn rücken mit. React Flow: Unterflüsse über `parentId`, `extent: 'parent'` hält Kinder im Container, der Typ `group` hat keine Anschlüsse. Node-RED: Gruppen mit Rahmen-/Hintergrundfarbe und Beschriftung, rein optisch ohne Wirkung auf den Ablauf; Zuklappen von Gruppen ist dort noch ein offener Wunsch.
- **Bedeutung für MAKE OS:** Ein Container-Typ für Rahmen und Bahnen (Swimlanes), zuklappbar zu einer Kachel mit Titel + Zahl der Schritte + Status — eingeklappt bleibt der Lichtfaden durch die Kachel sichtbar.
- **Quelle(n):** https://help.lucid.co/hc/en-us/articles/47610955892756 (ohne Datum) · https://community.lucid.co/product-updates/lucid-suite-release-notes-march-2026-13072 (30.03.2026) · https://reactflow.dev/learn/layouting/sub-flows (11.10.2026) · https://nodered.org/docs/user-guide/editor/workspace/groups (ohne Datum)

### 11. Rückgängig, Kopieren, Mehrfachauswahl sind Grundausstattung
- **Erkenntnis:** Nutzer erwarten auf jeder Fläche Undo/Redo, Kopieren/Einfügen von Knoten samt Kanten und Mehrfachauswahl — auch per Tastatur.
- **Wie die Besten es machen:** React Flow liefert dafür eigene Beispiele (Undo/Redo für Verschieben/Anlegen/Löschen, Copy-Paste von Knoten + Kanten, Auswahl-Gruppierung). Miro hat seit Juni 2025 Größe ändern und Mehrfachauswahl per Tastatur. tldraw: automatisches Undo/Redo.
- **Bedeutung für MAKE OS:** Undo als Gegen-Operation (wie im Finanzplan) über der Prozessfassung; Kopieren nimmt Kanten zwischen den gewählten Knoten mit, Einfügen erzeugt neue Kennungen.
- **Quelle(n):** https://reactflow.dev/pro/content (ohne Datum, © 2026) · https://miro.com/accessibility/changelog/ (Eintrag 01.06.2025) · https://tldraw.dev/features/out-of-the-box-whiteboard (© 2026)

### 12. Kommentare am Objekt, Versionen mit Namen
- **Erkenntnis:** Zusammenarbeit an Prozessen braucht Kommentare, die am Knoten hängen, und benannte Fassungen, zu denen man zurückkann.
- **Wie die Besten es machen:** Figma/FigJam: automatischer Prüfpunkt alle 30 Minuten, Fassungen benennen und beschreiben, Wiederherstellen fügt neue Prüfpunkte hinzu; gelöschte Kommentare kommen beim Wiederherstellen nicht zurück. Miro: Wiederherstellen nur in bezahlten Plänen; Kommentare wandern beim Kopieren von Objekten nicht mit und lassen sich nicht exportieren. Excalidraw+: Gäste sehen seit April 2025 Kommentare. Warnsignal: FigJam-Nutzer meldeten im August 2025 eine leere Fläche nach dem Wiederherstellen.
- **Bedeutung für MAKE OS:** Fassungen gibt es im Prozessmodell schon — „Fassung benennen“ + „Vergleichen“ (was hat sich geändert) ergänzen; Kommentare über den vorhandenen Beitragsverlauf an Knoten hängen und beim Kopieren bewusst nicht mitnehmen.
- **Quelle(n):** https://help.figma.com/hc/en-us/articles/360038006754 (ohne Datum) · https://community.miro.com/ask-the-community-45/any-way-to-restore-a-previous-version-of-a-miro-from-outside-of-the-board-view-28601 (ohne Datum) · https://plus.excalidraw.com/changelog/2 (30.04.2025) · https://forum.figma.com/report-a-problem-6/figjam-content-disappeared-44335 (Aug. 2025)

### 13. Vorlagen und KI-Entwurf: KI baut den ersten Wurf und fragt nach
- **Erkenntnis:** 2025/2026 haben alle großen Werkzeuge „Prozess aus Beschreibung“ — die besseren stellen Rückfragen, statt einfach zu zeichnen.
- **Wie die Besten es machen:** Lucid AI in Lucidchart (01.10.2025) erzeugt Flussdiagramme aus einer Eingabe; der „Process Agent“ (26.03.2026) baut einen Entwurf und schließt Lücken über Rückfragen. FigJam erzeugt seit Januar 2026 mit Claude bearbeitbare Diagramme aus Text, PDFs oder Bildschirmfotos. Camunda BPMN Copilot erzeugt BPMN aus Beschreibung und seit März 2025 auch Text aus dem Diagramm — überschreibt beim Erzeugen aber bestehende Arbeit. Zapier Canvas baut Prozesse aus Klartext und schlägt Bausteine vor, die man vorab ansieht.
- **Bedeutung für MAKE OS:** ZOE schlägt einen Prozessentwurf als Vorschlag vor (nie überschreiben), stellt Rückfragen zu Lücken (Wer? Was passiert bei Nein? Frist?) und zeigt den Unterschied vor dem Übernehmen.
- **Quelle(n):** https://community.lucid.co/community-news-and-announcements-9/welcome-to-the-future-of-work-with-lucid-ai-in-lucidchart-11767 (01.10.2025) · https://community.lucid.co/community-news-and-announcements-9/new-ai-features-latl-march-2026-12923 (26.03.2026) · https://www.cmswire.com/digital-experience/figma-integrates-anthropics-claude-to-generate-diagrams-inside-figjam (Jan. 2026) · https://docs.camunda.io/docs/components/early-access/alpha/bpmn-copilot/ (aktuelle Doku, abgerufen 21.10.2026) · https://camunda.com/blog/2025/03/camunda-alpha-release-march-2025/ (März 2025)

### 14. Export in drei Formen: Bild, Folien, Text
- **Erkenntnis:** Die Besten exportieren nicht nur Bilder, sondern auch Text/Daten — für Dokumentation, Barrierefreiheit und andere Werkzeuge.
- **Wie die Besten es machen:** Excalidraw+ 2025: SVG-, PPTX- und Arbeitsbereich-Export mit Verlauf. Camunda Copilot erzeugt eine Textbeschreibung aus dem BPMN-Diagramm. Lucid: Diagrammdaten per CSV oder REST-API als JSON (Community-Tipp April 2026). React Flow: serverseitige Bilderzeugung als eigenes Beispiel.
- **Bedeutung für MAKE OS:** PNG/SVG gibt es — dazu „Als Text“ (verschachtelte Liste je Ebene, siehe Nr. 34) und PDF für Kunden; dieselbe Textfassung dient ZOE als Prozessbeschreibung.
- **Quelle(n):** https://plus.excalidraw.com/changelog/2 (Feb.–Nov. 2025) · https://camunda.com/blog/2025/03/camunda-alpha-release-march-2025/ (März 2025) · https://community.lucid.co/inspiration-5/lucid-expert-tip-building-dynamic-data-backed-diagrams-13155 (April 2026) · https://reactflow.dev/pro/content (© 2026)

---

## B. Die Prozesslandkarte der ganzen Firma

### 15. Drei Bänder: Führung oben, Kern in der Mitte, Unterstützung unten
- **Erkenntnis:** Die Prozesslandkarte (Ebene 0) gliedert sich fast überall in Führungs-, Kern- und Unterstützungsprozesse, entlang der Wertschöpfung statt entlang von Abteilungen.
- **Wie die Besten es machen:** Haufe Akademie (aktualisiert 20.02.2026): Führung oben, Kern in der Mitte, Unterstützung unten; nach Wertschöpfungskette gruppieren, nicht nach Abteilung. Signavio Level 0 zeigt genau diese drei Gruppen, meist nicht in BPMN. Primeo Energie (BOC) zeichnet die Hauptkarte als ein verbundenes System statt getrennter Bahnen je Prozessart. CQI warnt, Prozesskarten mit dem Organigramm zu verwechseln.
- **Bedeutung für MAKE OS:** Landkarte = Kern-Band Marketing → Sales → Fulfillment (Kunde links rein, Kunde rechts raus), darüber Führung (Planung, Ziele, Monatsabschluss), darunter Unterstützung (Finanzen, Recht, IT) — Bänder als feste Bahnen, Prozesse als Kacheln.
- **Quelle(n):** https://www.haufe-akademie.de/blog/themen/projekt-prozessmanagement/prozesslandkarte/ (20.02.2026) · https://www.signavio.com/wiki/process-discovery/business-process-mapping-levels/ (ohne Datum, Bild-Pfad 2025/07) · https://www.boc-group.com/en/blog/bpm/why-primeo-energie-relies-on-a-central-process-architecture (ohne Datum) · https://knowledge.quality.org/article/process-mapping-context (ohne Datum)

### 16. Ebenen 0 bis 4 mit passender Darstellung je Ebene
- **Erkenntnis:** Jede Ebene hat ihre eigene Bildsprache — oben einfach, erst ab Ebene 2–3 die volle Ablauflogik mit Entscheidungen.
- **Wie die Besten es machen:** Signavio: Ebene 0 Wertschöpfung (Führung/Kern/Unterstützung), Ebene 1 End-to-End-Prozesse (z. B. Order-to-Cash), Ebene 2 Teilprozesse, Ebene 3 detaillierter Ablauf mit Entscheidungen und Übergaben (hier BPMN), Ebene 4+ Arbeitsanweisungen. BPMN ist eine Notation, keine Ebene; oben bewusst einfache Bilder für Führungsgespräche.
- **Bedeutung für MAKE OS:** Die vorhandenen Ebenen 1–5 so belegen: 1 Landkarte, 2 Prozess (Kette von Phasen), 3 Ablauf (Schritte, Rauten, Agenten), 4 Schritt-Detail (Anleitung, Vorlage, Agent-Einstellungen) — Raute und Erinnerung erst ab Ebene 3 zulassen.
- **Quelle(n):** https://www.signavio.com/wiki/process-discovery/business-process-mapping-levels/ (ohne Datum, abgerufen 21.10.2026)

### 17. Wenig ist Pflicht: 8–12 Prozesse auf der Landkarte, höchstens 10 Schritte je Ebene
- **Erkenntnis:** Lesbarkeit hat Obergrenzen — die Besten zerlegen, bevor eine Ebene überläuft.
- **Wie die Besten es machen:** Secjur (10.09.2026): kleine Firmen kommen auf etwa 8–12 Prozesse insgesamt (Faustregel, keine Normvorgabe). Bruce Silver: höchstens 10 Aktivitäten je Prozessebene, damit sie auf eine Seite passt. SIPOC-Leitfäden: 4–7 Hauptschritte.
- **Bedeutung für MAKE OS:** Weiche Grenzen im Editor: ab 10 Schritten je Ebene ein ruhiger Hinweis „Teilprozess bilden?“ mit Ein-Klick-Umwandlung — nie hart sperren.
- **Quelle(n):** https://www.secjur.com/blog/iso-9001-prozesslandkarte (10.09.2026) · https://www.trisotech.com/bpmn-style-rules/ (04.11.2019, Maßstab) · https://www.techtarget.com/searchcio/definition/SIPOC-diagram-suppliers-inputs-process-outputs-customers (ohne Datum)

### 18. Drill-down mit Brotkrumen: hinein klicken, Weg zurück immer sichtbar
- **Erkenntnis:** Von der Landkarte in den Prozess und weiter ins Detail geht es per Doppelklick in einen „zugeklappten Teilprozess“; eine Brotkrumenleiste zeigt den Weg zurück.
- **Wie die Besten es machen:** bpmn-js (seit v9) erlaubt das Hineingehen in zugeklappte Teilprozesse mit Brotkrumen-Navigation; Camunda Cockpit zeigt dieselbe Brotkrumenlogik. Miro: Kürzel zum Hinein-/Herausgehen in Rahmen. Lucid: zuklappbare Container als Zwischenstufe ohne Seitenwechsel.
- **Bedeutung für MAKE OS:** Jede Kachel der Landkarte öffnet ihren Prozess (Kamerafahrt, nicht Seitenwechsel), Brotkrumen oben „Landkarte › Fulfillment › Onboarding“, Esc = eine Ebene hoch; Adresse trägt den Pfad, damit Zurück im Browser funktioniert.
- **Quelle(n):** https://bpmn.io/blog/posts/2022-bpmn-js-900-collapsed-subprocesses (2022, Maßstab) · https://docs.camunda.org/manual/7.18/webapps/cockpit/bpmn/drilldown/ (ohne Datum) · https://miro.com/shortcuts/ (© 2026)

### 19. SIPOC als Steckbrief je Prozess
- **Erkenntnis:** Vor dem Ablauf klärt ein SIPOC (Lieferant, Eingang, Prozess, Ergebnis, Kunde) Grenze und Zweck eines Prozesses auf einer Zeile.
- **Wie die Besten es machen:** TechTarget: SIPOC in der Define-Phase von DMAIC, 4–5 Hauptschritte aus Tätigkeit + Gegenstand, 3–4 Ergebnisse, Kunden auch intern. AHRQ nutzt SIPOC als Einstieg in die Ablaufanalyse.
- **Bedeutung für MAKE OS:** Die Kachel auf der Landkarte klappt einen Steckbrief auf: Auslöser (Ereignis), Eingaben, 4–7 Phasen, Ergebnis, Kunde/Empfänger, Eigner — das ist auch die Vorlage für ZOEs Rückfragen beim Entwurf.
- **Quelle(n):** https://www.techtarget.com/searchcio/definition/SIPOC-diagram-suppliers-inputs-process-outputs-customers (ohne Datum) · https://digital.ahrq.gov/health-it-tools-and-resources/evaluation-resources/workflow-assessment-health-it-toolkit/all-workflow-tools/sipoc (ohne Datum)

### 20. Wartezeit sichtbar machen: Bearbeitungszeit gegen Durchlaufzeit
- **Erkenntnis:** Value Stream Mapping trennt die Zeit, in der gearbeitet wird, von der Zeit, in der gewartet wird — und zeigt beides als Zeitleiste unter dem Ablauf.
- **Wie die Besten es machen:** VSM nach Rother/Shook (Learning to See, LEI): Datenkasten unter jedem Schritt, Zeitleiste unten mit Warte- und Bearbeitungszeiten, daraus Durchlaufzeit; Prozess-Effizienz = Bearbeitungszeit ÷ Durchlaufzeit. Lucid beschreibt die Zeitleiste als festen Teil der Karte.
- **Bedeutung für MAKE OS:** Zwischen zwei Schritten zeigt der Lichtfaden die mittlere Wartezeit (dünn = kurz, gestrichelt/blasser = lang); ein optionales Band unten fasst Bearbeitung vs. Warten je Prozess zusammen.
- **Quelle(n):** https://lucid.co/diagram/vsm/value-stream-mapping-symbols (ohne Datum) · https://resources.rework.com/fr/libraries/process-management/value-stream-mapping (ohne Datum)

### 21. Bahnen für Rollen — und eine eigene Bahn für KI-Agenten
- **Erkenntnis:** Wer etwas tut, zeigt man mit Bahnen (Lanes) innerhalb eines Prozesses; Externe sind „Black Boxes“, mit denen nur Nachrichten fließen.
- **Wie die Besten es machen:** Bruce Silver: Rollen/Abteilungen der eigenen Firma als Bahnen in einem Pool, nicht als getrennte Pools; Bahnen benennen den Ausführenden; externe Beteiligte als leere Pools mit Nachrichtenflüssen. Miro AI Workflows (12.01.2026): KI-Schritte liegen sichtbar auf derselben Fläche wie das Team, jeder Schritt offen, Menschen behalten die Kontrolle.
- **Bedeutung für MAKE OS:** Bahnen Kevin · Malin · Team · ZOE/Agent · Kunde (Kunde als Außenbahn, nur Nachrichten); jeder Agent-Schritt steht in der Agent-Bahn und hat, wo er nach außen wirkt, eine Bestätigungs-Form in einer Menschen-Bahn direkt dahinter.
- **Quelle(n):** https://www.trisotech.com/bpmn-style-rules/ (04.11.2019, Maßstab) · https://miro.com/newsroom/miro-launches-ai-workflows/ (12.01.2026)

---

## C. Schön und verständlich

### 22. Namen nach Regel: Verb + Gegenstand, Ergebnisse als Zustand
- **Erkenntnis:** Einheitliche Beschriftung ist der größte Hebel für Verständlichkeit — wichtiger als Farben.
- **Wie die Besten es machen:** Bruce Silver: Tätigkeiten als „Verb + Objekt“, Endereignisse als Zustand („Anfrage erledigt“) nur bei mehreren Enden, Nachrichten als Hauptwort, Startereignis bei Nachricht „Empfange …“; ein formal fehlerfreies BPMN kann trotzdem nichts erklären, wenn die Beschriftungen fehlen. Haufe empfiehlt sprechende Namen wie „Kundenanfrage bearbeiten“.
- **Bedeutung für MAKE OS:** Eingabefeld mit Platzhalter „Angebot senden“, Hinweis bei Einzelwörtern ohne Verb; Ende-Formen zeigen den erreichten Zustand („Mandat aktiv“).
- **Quelle(n):** https://www.trisotech.com/bpmn-style-rules/ (04.11.2019, Maßstab) · https://www.trisotech.com/standardizing-bpmn-labels/ (ohne Datum) · https://www.haufe-akademie.de/blog/themen/projekt-prozessmanagement/prozesslandkarte/ (20.02.2026)

### 23. Farbe nie allein: Form + Symbol + Text, Kontrast 3:1
- **Erkenntnis:** Farbcodes funktionieren nur, wenn dieselbe Bedeutung auch über Form, Symbol oder Text erkennbar ist.
- **Wie die Besten es machen:** WCAG 1.4.1 (Stufe A): Farbe darf nicht der einzige Träger einer Bedeutung sein. WCAG 1.4.11 (AA): grafische Teile, die man zum Verstehen braucht, mindestens 3:1 Kontrast — entfällt, wenn ein Textlabel die Bedeutung trägt (DAISY). Fortschritts-Leitfäden kombinieren Farbe, Symbol und Verbindungsbalken.
- **Bedeutung für MAKE OS:** Die Formsprache (Raute, Kreis für Erinnerung, Karte für Schritt) bleibt eindeutig auch in Graustufen; Status zusätzlich mit Symbol (Haken, Uhr, Ausrufezeichen); Kontraste im Klar·DARK-Thema gegen 3:1 prüfen.
- **Quelle(n):** https://dequeuniversity.com/resources/wcag2.1/1.4.11-non-text-contrast (ohne Datum) · https://kb.daisy.org/publishing/docs/wcag/non-text-contrast.html (ohne Datum) · https://www.designsystem.qld.gov.au/styles/colour/accessibility (ohne Datum)

### 24. Eine Leserichtung, wenige Kreuzungen
- **Erkenntnis:** Ein Bild bleibt verständlich, wenn es durchgehend in eine Richtung läuft und Linien sich kaum kreuzen.
- **Wie die Besten es machen:** Creately: eine Richtung wählen (links → rechts oder oben → unten) und beibehalten. Visual Paradigm: links → rechts für Geschäftsprozesse, ab mehr als zwei Kreuzungen an einer Stelle neu anordnen, unvermeidbare Kreuzungen mit kleinem Bogen. ELK Layered minimiert Kreuzungen in einer eigenen Phase.
- **Bedeutung für MAKE OS:** Landkarte links → rechts (Kunde → Kunde), Prozess innen oben → unten (wie Kevins Fulfillment-Stil); Rückschleifen laufen außen herum und sind als „zurück zu …“ beschriftet.
- **Quelle(n):** https://creately.com/guides/flowchart-rules/ (ohne Datum) · https://skills.visual-paradigm.com/?p=583 (ohne Datum) · https://eclipse.dev/elk/blog/posts/2025/25-08-21-layered.html (21.08.2025)

---

## D. Live-Zustand auf der Karte

### 25. Kennzahlen als Schicht über dem Modell: Häufigkeit, Dauer, Kantendicke
- **Erkenntnis:** Die Prozess-Werkzeuge zeigen Live-Daten als umschaltbare Schicht über demselben Bild — nicht als zweites Bild.
- **Wie die Besten es machen:** Camunda Optimize: Heatmap über dem BPMN nach Häufigkeit oder Dauer; mit Zielwerten je Schritt werden nur die Schritte hervorgehoben, die das Ziel reißen. Celonis Process Explorer: Kennzahl umschaltbar (Fallhäufigkeit, Aktivitätshäufigkeit, Durchlaufzeit als Median/Mittel), häufige Kanten werden dicker gezeichnet; Klick auf Schritt oder Kante filtert die Fälle, die dort durchlaufen. Lucid: bedingte Formatierung nach Formdaten (Regeln in Reihenfolge, z. B. „größer als“).
- **Bedeutung für MAKE OS:** Schalter oben rechts „Fälle · Dauer · Probleme“; der Lichtfaden wird dicker, wo viele Fälle laufen; rot/pulsierend nur, wo ein Zielwert gerissen ist (Frist, Wartezeit) — sonst ruhig.
- **Quelle(n):** https://docs.camunda.io/docs/guides/improve-processes-with-optimize/ (aktuelle Doku, abgerufen 21.10.2026) · https://camunda.com/platform/optimize/reports/ (ohne Datum) · https://help.celonis.com/cpm47/en/process-explorer (CPM 4.7, ohne Datum) · https://help.lucid.co/hc/en-us/articles/16293796201108 (ohne Datum)

### 26. Zahl der Fälle je Schritt: wo stehen wie viele, wo hängt es
- **Erkenntnis:** Die wichtigste Live-Frage lautet „wie viele stehen gerade wo“ — als kleine Zahl am Knoten, mit Klick auf die Liste der Fälle.
- **Wie die Besten es machen:** Camunda Optimize zeigt absolute Instanzzahlen je Schritt und die meistgenutzten Schritte für Engpass-Analysen; Camunda Cockpit (7) zeigt Tokens je Knoten als Heatmap. Celonis: Klick auf Schritt wählt die betroffenen Fälle. Zapier Canvas zeigt an verknüpften Automationen Kennzahlen wie Läufe, Einsendungen, Datensätze und geschätzte gesparte Zeit.
- **Bedeutung für MAKE OS:** Jeder Knoten trägt ein Zähler-Abzeichen (offene Fälle), ab Frist-Überschreitung eine zweite Zahl in Rot; Klick öffnet die Fälle (Mandate) in einer Seitenleiste mit Link.
- **Quelle(n):** https://camunda.com/platform/optimize/reports/ (ohne Datum) · https://docs.camunda.org/manual/webapps/cockpit/bpmn/process-history-views/ (ohne Datum) · https://help.celonis.com/cpm47/en/process-explorer (CPM 4.7) · https://www.zapier.com/blog/zapier-canvas-guide (Sept. 2025)

### 27. Vereinfachen per Regler: „So laufen 80 % unserer Fälle“
- **Erkenntnis:** Echte Abläufe sind Spaghetti — die Besten blenden seltene Wege per Regler aus, ohne die Daten zu verändern.
- **Wie die Besten es machen:** Fluxicon Disco: Regler „Wege“ zuerst senken (seltene Übergänge verschwinden), dann „Schritte“; die Regler vereinfachen nur die Darstellung, Statistik bleibt vollständig; oft decken die 5–10 häufigsten Varianten 70–80 % der Fälle ab und man kann genau so beschriften. Celonis zeigt standardmäßig 9 Varianten und fasst den Rest als „andere“ zusammen.
- **Bedeutung für MAKE OS:** Im Live-Modus zeigt die Karte zuerst den Hauptweg; seltene Abzweige erscheinen als „+3 Sonderwege“ und klappen auf Klick auf.
- **Quelle(n):** https://fluxicon.com/book/read/simplification/ (© 2024) · https://help.celonis.com/cpm47/en/the-variant-explorer (CPM 4.7, ohne Datum)

### 28. Status direkt am Knoten: bereit, läuft, fertig, Fehler
- **Erkenntnis:** Automatisierte Schritte brauchen einen sichtbaren Laufzustand am Knoten selbst — knapp, mit Form und Text.
- **Wie die Besten es machen:** React Flow UI „Node Status Indicator“: Zustände initial, loading (drehender Rand oder Overlay), success, error. Node-RED: Status unter dem Knoten als Punkt oder Ring mit Farbe und kurzem Text; Unterflüsse können einen eigenen Status nach außen melden.
- **Bedeutung für MAKE OS:** Agent- und Baustein-Knoten bekommen einen Statusrand (läuft = Lichtfaden umläuft den Rand, Fehler = Granat + Ausrufezeichen + Satz „Budget erreicht“), Menschen-Schritte zeigen „wartet auf Kevin“ statt Spinner.
- **Quelle(n):** https://reactflow.dev/ui/components/node-status-indicator (11.10.2026) · https://nodered.org/docs/user-guide/editor/workspace/subflows (ohne Datum) · https://flowfuse.com/node-red/core-nodes/status/ (ohne Datum)

### 29. Zeichnung und Automation sind dasselbe Objekt
- **Erkenntnis:** Die neue Generation (Zapier Canvas, Miro Flows) verbindet Prozessbild und Ausführung auf einer Fläche — der Schritt im Bild IST die Automation.
- **Wie die Besten es machen:** Zapier Canvas (Guide aktualisiert Sept. 2025): bestehende oder neue Zaps, Tabellen, Chatbots, Agenten als Schritte; Feldzuordnung direkt auf der Fläche; „Schritte zeigen“ klappt die inneren Schritte einer Automation auf; Zapier selbst sagt, das Werkzeug sei nicht für chaotisches freies Whiteboarding gedacht. Miro Flows (Beta Oktober 2025, Unternehmen Januar 2026): verkettete KI-Aktionen auf dem Board, jeder Schritt offen.
- **Bedeutung für MAKE OS:** Kein freies Zeichnen neben dem Modell — jede Form ist ein Prozessknoten mit Ausführungsbedeutung; „Schritte zeigen“ klappt einen Agent-Skill in seine inneren Schritte auf (Ebene 4).
- **Quelle(n):** https://www.zapier.com/blog/zapier-canvas-guide (Sept. 2025) · https://zapier.com/blog/process-mapping-tools/ (ohne Datum, Anbieterblog) · https://www.businesswire.com/news/home/20251014500530/en (14.10.2025) · https://miro.com/newsroom/miro-launches-ai-workflows/ (12.01.2026)

---

## E. Nach außen anders als nach innen

### 30. Eine Sichtbarkeitslinie: was der Kunde sieht, liegt darüber
- **Erkenntnis:** Das Service Blueprint trennt mit der „Line of Visibility“ sauber, was der Kunde erlebt (oben), von dem, was intern passiert (unten).
- **Wie die Besten es machen:** NN/g (zuletzt geprüft 15.07.2026): Kundenhandlungen, Frontstage (sichtbar), Backstage (unsichtbar), unterstützende Prozesse, Belege (E-Mail, Website); drei Linien: Interaktion, Sichtbarkeit, interne Interaktion; je Szenario ein eigenes Blueprint.
- **Bedeutung für MAKE OS:** Jeder Knoten trägt ein Feld „sichtbar für Kunde ja/nein“; die Außenansicht zeigt nur die Knoten oberhalb der Linie — serverseitig gefiltert, nie nur ausgeblendet (Plattform-Regel).
- **Quelle(n):** https://www.nngroup.com/articles/service-blueprints-definition/ (veröffentlicht 27.08.2017, zuletzt geprüft 15.07.2026)

### 31. Nach außen: 3–7 Etappen als Fortschrittsleiste, nicht als Diagramm
- **Erkenntnis:** Kunden brauchen keinen Prozessgraphen, sondern wenige benannte Etappen, ihre aktuelle Position und was als Nächstes passiert.
- **Wie die Besten es machen:** UXPin (04.05.2026): 3–7 Schritte (unter 3 lohnt keine Leiste, über 7 überfordert), sprechende Beschriftungen statt Nummern, aktuelle Etappe unverwechselbar (Farbe + Symbol + Verbindungsbalken), erledigte mit Haken, WAI: Anzahl und aktuelle Etappe auch nicht-visuell mitteilen. Fortschrittsleisten senken Unsicherheit und Rückfragen.
- **Bedeutung für MAKE OS:** Aus den sichtbaren Knoten entsteht automatisch die Kundenleiste (Kunden-Link/Dossier) mit dem Lichtfaden als Verbindungsbalken — gleiche Daten, andere Darstellung.
- **Quelle(n):** https://www.uxpin.com/studio/blog/design-progress-trackers/ (04.05.2026) · https://app.uxcel.com/glossary/progress-trackers (ohne Datum)

### 32. Für das Team: ansehen, erklären, kommentieren — ohne Bearbeiten
- **Erkenntnis:** Fürs Zeigen nach außen und ins Team gibt es eigene Modi: nur ansehen, geführte Präsentation, aufgezeichnete Erklärung.
- **Wie die Besten es machen:** Miro Live Embed „nur ansehen“ ohne Werkzeuge (Schwenken/Zoomen ja, Ändern nein; als experimentell markiert); Talktrack nimmt Audio-/Video-Rundgänge über das Board auf, Zuschauer können pausieren und kommentieren. Excalidraw+ (2025): Präsentation ab bestimmter Folie, Auto-Weiter, Bild-auf/ab blättert. Nutzer bemängeln bei Miro, dass Rahmenränder im Ansichtslink stören.
- **Bedeutung für MAKE OS:** Drei Modi: Bearbeiten · Ansehen (ohne Werkzeuge, Rahmenränder aus) · Präsentieren (Rahmen für Rahmen, Kamerafahrt entlang des Lichtfadens); Rechte serverseitig, Kunde nur Außenansicht.
- **Quelle(n):** https://developers.miro.com/docs/miro-live-embed-view-only-mode (ohne Datum) · https://miro.com/talktrack (ohne Datum) · https://plus.excalidraw.com/changelog/2 (Aug./Okt. 2025) · https://community.miro.com/ideas/shareable-board-in-presentation-mode-only-with-url-2664 (ohne Datum)

---

## F. Barrierefreiheit und Handy

### 33. Tastatur auf der Fläche: linear, räumlich, hierarchisch
- **Erkenntnis:** Eine Fläche ist barrierefrei, wenn man Knoten in Lesereihenfolge, nach Richtung und in Container hinein/heraus anspringen kann und dabei Ansagen bekommt.
- **Wie die Besten es machen:** Miro (Changelog): drei Navigationsarten (Lesereihenfolge, 2D-Richtung, Container betreten/verlassen), Board-Zusammenfassung mit Zahl und Art der Objekte, Verbinder in Diagrammen per Tastatur begehbar, Mehrfachauswahl per Tastatur (06/2025), Lesereihenfolge im DOM korrigiert (11/2025), Flows-Knoten per Tastatur (03/2026), Positionieren relativ zu anderen Objekten per Befehlspalette, Ansagen auch für Bahnen geplant (09/2026); Einzeltasten-Kürzel abschaltbar. React Flow (11.10.2026): Tab über Knoten/Kanten, Enter/Leertaste wählt, Pfeile verschieben (Shift schneller), Kamera folgt dem Fokus, `aria-live`-Ansagen, `ariaLabelConfig` für übersetzte Texte.
- **Bedeutung für MAKE OS:** Tab/Pfeile/Enter/Esc wie React Flow, Ansagen auf Deutsch („Entscheidung: Angebot angenommen? Zwei Ausgänge“), Einzeltasten-Kürzel in den Einstellungen abschaltbar.
- **Quelle(n):** https://miro.com/accessibility/changelog/ (Einträge 2023 bis 01.09.2026) · https://reactflow.dev/learn/advanced-use/accessibility (11.10.2026)

### 34. Textfassung als verschachtelte Liste — aus demselben Modell
- **Erkenntnis:** Für Screenreader ist die beste Alternative zu einem Ablaufbild eine strukturierte Liste im Seitentext, nicht ein langer Alt-Text.
- **Wie die Besten es machen:** University of Michigan: Flussdiagramme als nummerierte, verschachtelte Liste mit klaren Weiter-Anweisungen bei Verzweigungen. Clemson: Kurz-Alt-Text plus Langbeschreibung, z. B. als verschachtelte Liste. WebAIM-Diskussion: langer Alt-Text wird am Stück vorgelesen und verliert die Struktur — besser echtes Markup auf der Seite.
- **Bedeutung für MAKE OS:** Umschalter „Bild · Liste“ über jeder Prozessfläche; die Liste wird aus dem Modell erzeugt (Ebenen = Verschachtelung, Rauten = „Wenn … dann weiter bei …“) und ist zugleich Handy-Ansicht und Text-Export.
- **Quelle(n):** https://teamdynamix.umich.edu/TDClient/30/Portal/KB/Article/14349/Creating-Accessible-Flow-Charts-and-Org-Charts (ohne Datum) · https://clemson.edu/accessibility/digital/concepts/complex-images.html (ohne Datum) · https://webaim.org/discussion/mail_message?id=39461 (ohne Datum)

### 35. Handy: ansehen, kommentieren, Status — bauen ab Tablet
- **Erkenntnis:** Die Großen trennen: Telefon = ansehen, kommentieren, kleine Änderungen; volles Bauen auf Tablet/Desktop.
- **Wie die Besten es machen:** Figma-App: FigJam-Dateien ansehen, Kommentare schreiben/lösen, Push bei Antworten; Bearbeiten in einer eigenen iPad-App. Miro-App: Bearbeiten möglich, Community-Antwort (Nov. 2024) sieht volles Bearbeiten vor allem am Desktop; Tablet mit Stift-Werkzeugen. Excalidraw+ führte im Oktober 2025 ein eigenes Handy-Layout mit kompakter Werkzeugleiste ein. Gesten: ein Finger auf leerer Fläche verschiebt, langes Drücken startet Auswahlrahmen (draw.io), Zwei-Finger-Pinch zoomt; GoJS lässt wählen, ob Pinch das Diagramm oder die Seite zoomt.
- **Bedeutung für MAKE OS:** Am Handy (< 720 px) startet die Prozessseite in der Listenansicht mit Fall-Zahlen; die Fläche ist nur ansehen/zoomen; Bearbeiten und Agent-Einstellungen ab Tablet.
- **Quelle(n):** https://apps.apple.com/app/figma-and-figjam/id1152747299 (Store-Eintrag, abgerufen 21.10.2026) · https://help.figma.com/hc/en-us/articles/4502073572247 (ohne Datum) · https://community.miro.com/ask-the-community-45/can-t-edit-kanban-cards-from-my-phone-14177 (Nov. 2024) · https://plus.excalidraw.com/changelog/2 (31.10.2025) · https://www.drawio.com/blog/touch-screen-diagrams (ohne Datum) · https://gojs.net/api/symbols/GestureMode.html (ohne Datum)

---

## Anti-Pattern (was die Besten vermeiden)

1. **Ebenen mischen:** In einem Bild stehen „Mandat gewinnen“ und „Button klicken“ nebeneinander — der Ablauf kippt zwischen grob und fein. Quelle: https://skills.visual-paradigm.com/vn/?p=592 (ohne Datum) · https://www.boc-group.com/en/?p=132984 (ohne Datum)
2. **Landkarte mit Detail überladen:** Die oberste Karte modelliert schon Abläufe statt Überblick. Quelle: https://www.haufe-akademie.de/blog/themen/projekt-prozessmanagement/prozesslandkarte/ (20.02.2026) · https://www.brix.ch/en/about-us/news/process-documentation-and-acceptance-the-3-most-common-mistakes-and-how-to-avoid-them (Feb. 2026)
3. **Organigramm statt Wertstrom:** Prozesse nach Abteilungen sortiert, Übergaben verschwinden. Quelle: https://knowledge.quality.org/article/process-mapping-context (ohne Datum) · Haufe (20.02.2026)
4. **Nur der Idealweg:** Ausnahmen, Schleifen und Nacharbeit fehlen; Soll und Ist werden vermischt. Quelle: https://www.signavio.com/wiki/process-discovery/process-mapping-mistakes/ (ohne Datum)
5. **Vage Namen und unbeschriftete Rauten:** „Bearbeitung“, „Prüfen“ ohne Ergebnis an den Ausgängen. Quelle: Signavio (ohne Datum) · https://www.trisotech.com/bpmn-style-rules/ (2019, Maßstab)
6. **Farbe als einzige Bedeutung, Regenbogen-Paletten:** für Farbenblinde unlesbar, in Graustufen sinnlos. Quelle: https://www.designsystem.qld.gov.au/styles/colour/accessibility (ohne Datum)
7. **Alles leuchtet:** Jeder Knoten zeigt Zahlen und Farben gleich laut — Probleme gehen unter. Besser: nur Abweichungen über Zielwert hervorheben. Quelle: https://docs.camunda.io/docs/guides/improve-processes-with-optimize/ (abgerufen 21.10.2026)
8. **Schwere Effekte auf vielen Knoten:** Schatten, Verläufe, Animationen bremsen große Flächen spürbar. Quelle: https://reactflow.dev/learn/advanced-use/performance (11.10.2026)
9. **Zwei Wahrheiten:** Ein hübsches Whiteboard-Bild neben der echten Automation, die auseinanderlaufen. Quelle: https://zapier.com/blog/process-mapping-tools/ (ohne Datum, Anbieterblog) · https://www.zapier.com/blog/zapier-canvas-guide (Sept. 2025)
10. **KI überschreibt:** Generieren ersetzt die bestehende Arbeit ohne Vergleich. Quelle: https://docs.camunda.io/docs/components/early-access/alpha/bpmn-copilot/ (abgerufen 21.10.2026)
11. **Die Karte als Grab:** kein Eigner, kein Prüfrhythmus, nie genutzt außer als Dokumentation. Quelle: Signavio (ohne Datum) · Haufe (20.02.2026)
12. **Desktop-Editor auf dem Handy verkleinert:** Gesten kollidieren (Verschieben vs. Auswählen vs. Seite scrollen), versehentliche Änderungen. Quelle: https://www.drawio.com/blog/touch-screen-diagrams (ohne Datum) · https://gojs.net/api/symbols/GestureMode.html (ohne Datum)

---

## Die 5 wichtigsten Empfehlungen für MAKE OS

1. **Ein Modell, mehrere Sichten.** Landkarte (drei Bänder Führung/Kern/Unterstützung, Kern links → rechts vom Kunden zum Kunden) → Prozess → Ablauf → Schritt-Detail, verbunden per Drill-down mit Kamerafahrt, Brotkrumen und Esc. Aus demselben Modell entstehen Außenansicht (nur Knoten über der Sichtbarkeitslinie, serverseitig gefiltert, als 3–7-Etappen-Leiste), Textliste (Screenreader, Handy, Export) und Präsentation. Kein freies Zeichnen neben dem Modell.
2. **Bedienung nach Miro/Whimsical-Standard, aber schlank.** Feste Kürzel „Alles zeigen“/„Auswahl zeigen“/„in Rahmen hinein–heraus“, Suche mit Sprung zum Knoten, Minimap auf Taste, Raster + Hilfslinien, Alt + Pfeil legt den nächsten Schritt an, Undo/Redo, Kopieren mit Kanten, Rahmen und Bahnen zuklappbar, „Ordnen“ per Knopf (ELK Layered, interaktiv, rückgängig machbar), benannte Fassungen mit Vergleich.
3. **Semantischer Zoom und eine ruhige Live-Schicht.** Weit weg nur Form, Titel, Fall-Zahl; nah dran Details. Live-Schalter „Fälle · Dauer · Probleme“: Lichtfaden dicker, wo viele Fälle laufen; Zähler-Abzeichen je Knoten mit Klick auf die Fälle; Status-Rand für Agenten (läuft/fertig/Fehler); rot oder pulsierend nur bei gerissenem Zielwert; Sonderwege per „So laufen 80 % unserer Fälle“ eingeklappt.
4. **Strenge, kleine Formensprache.** Verb + Gegenstand, beschriftete Rauten-Ausgänge als Ergebnis, Ende als Zustand, höchstens etwa 10 Schritte je Ebene (sonst Teilprozess vorschlagen), Farbe nie allein (Form + Symbol + Text, Kontrast mindestens 3:1). KI-Agenten bekommen eine eigene Bahn und Form; jede Wirkung nach außen hat eine sichtbare Bestätigungs-Form in einer Menschen-Bahn. ZOE entwirft Prozesse nur als Vorschlag mit Rückfragen und Unterschied, nie überschreibend.
5. **Barrierefrei und Handy von Anfang an.** Tastatur-Navigation linear/räumlich/hierarchisch mit deutschen Ansagen und abschaltbaren Einzeltasten-Kürzeln; Umschalter „Bild · Liste“ auf jeder Prozessfläche; am Handy Listenansicht mit Fall-Zahlen und Kommentaren, die Fläche nur ansehen; Bauen und Agent-Einstellungen ab Tablet/Desktop.
