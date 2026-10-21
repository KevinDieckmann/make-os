# Prozesse in MAKE OS — die 100 wichtigsten Punkte und wie wir sie umsetzen

Stand 21.10.2026. Grundlage: die Bestandsaufnahme (`0-bestand.md`) und die vier Recherchen (Zeichnen, Automatisieren, Agenten, Sales · Marketing · Fulfillment). Kevins Entscheidungen gelten unverändert: Leistenpunkt „Prozesse“ mit Vollbild, Agenten in Reihenfolge, Heads setzen Prozesse mit auf, nur noch zwei Scores, eine Karte je Produkt, Miro-Stil, der Flow als Markenzeichen.

---

## 1. Auf einen Blick

„Prozesse“ wird ein eigener Punkt in der Business-Leiste: der EINE Ort, an dem Kevin und Malin alle Abläufe von Marketing über Sales bis Fulfillment sehen, bauen und laufen lassen. Das Bild ist eine Fliege (Bowtie) im Flow-Stil: links Kunden gewinnen, in der Mitte die Übergabe, rechts liefern und ausbauen; ein Klick fährt hinein bis zum einzelnen Schritt, auf Wunsch im Vollbild. Dahinter läuft genau dieser Plan als Automatik — jeder Kasten ist ein echter Schritt (Aufgabe, Nachricht, Entscheidung, Agent), nie eine zweite Zeichnung. Hebel 1: das vorhandene Fulfillment-Prozessmodell mit Editor, Fläche und Ausführung auf alle Bereiche verallgemeinern statt neu bauen. Hebel 2: ZOE, die Heads und die Fach-Agenten als begrenzte Schritte mit Vertrag, Budget und Freigabe einhängen, und die Heads schlagen Prozesse und Bausteine zur Entscheidung vor. Hebel 3: Übergaben zu Toren mit Uhr machen und den Fluss als Säule „Prozesse“ im Business-Score messen; oben auf „Heute“ stehen nur noch Business-Score und Privat-Score. Bewusst NICHT: kein freies Whiteboard neben dem Modell, keine fremde Plattform (n8n, Temporal), kein Agent, wo eine Regel reicht, kein Nutzer-Code, nichts nach außen ohne Klick, vorerst keine Prozesse im Privatbereich.

---

## 2. Die 100 Punkte

Etappen: **A** Sehen · **B** Bauen · **C** Laufen · **D** Messen & Verkaufen (Bauplan in Abschnitt 3).

### Kapitel 1 — Prozesslandkarte & Ebenen

| Nr | Punkt | Warum | Stand in MAKE OS | Umsetzung | Etappe |
|---|---|---|---|---|---|
| 1 | Eigener Leistenpunkt „Prozesse“ im Business, Landkarte als Startbild | Ein Ort für alle Abläufe statt verstreuter Bilder — Kevin 21.10., Bestandsaufnahme | neu — Business-Leiste hat 10 von 12 Punkten (`lib/make-one/spaces.ts`) | Eintrag in `spaces.ts`, `seiten.ts`, `WEG`, Routen-Register (Bereich business), Was-ist-neu; die Seite öffnet mit der Landkarte. | A |
| 2 | Landkarte als Bowtie: gewinnen · Übergabe · liefern und ausbauen | Gewinnung, Bindung und Ausbau sind ein System mit einem Datenmodell — Bowtie (Winning by Design) | teilweise — Landkarte „Hochhaus“ nur für Fulfillment (`lib/fulfillment/prozesse/landkarte.ts`) | Kern-Band links nach rechts: Marketing → Sales → Übergabe → Fulfillment → Ausbau; Lage-Rechnung des Hochhauses verallgemeinern, rein und getestet. | A |
| 3 | Drei Bänder: Führung oben, Kern Mitte, Unterstützung unten | Standardaufbau jeder Prozesslandkarte, nach Wertstrom statt Organigramm — Haufe, Signavio | teilweise — Hochhaus kennt Dach, Etagen, Fundament | Führung: Ziele, Planung, Monatsabschluss · Kern: Bowtie · Unterstützung: Finanzen, Recht, IT; Bänder als feste Bahnen, Prozesse als Kacheln. | A |
| 4 | Alle schon gebauten Prozesse als „System“-Kacheln zeigen, nur lesbar | Kevin will sehen, was schon läuft; eine Wahrheit statt Zweitbild — Bestandsaufnahme, Zapier | teilweise — rund 15 Prozesse verstreut im Code (Kreislauf, Lead → Mandat, Netzwerken, Head-Takt, Morgenlauf …) | Register der Code-Prozesse (Titel, Phasen, Auslöser, Eigner, Link); Bild aus vorhandenen Reise-Modellen (`lib/reise/*`); Marke „System“, nicht bearbeitbar. | A |
| 5 | Feste Ebenen: Landkarte · Prozess · Ablauf · Schritt-Detail | Jede Ebene hat eigene Bildsprache, Rauten erst im Ablauf — Signavio-Ebenen | teilweise — Ebenen 1–5 im Modell (`lib/fulfillment/typen.ts`) | Ebene 1 Landkarte, 2 Phasen, 3 Ablauf mit Rauten und Agenten, 4 Schritt-Detail, 5 Baustein; Raute und Erinnerung erst ab Ebene 3. | A |
| 6 | Ein Prozessmodell für alle Bereiche, nicht nur Fulfillment | Ein Modell, viele Sichten; heute fest an „Fall = Mandat“ — Bestandsaufnahme, n8n | teilweise — `ProzessVorlage` mit Fassung, Papierkorb, Grenzen (`lib/fulfillment/typen.ts`, `grenzen.ts`) | Additiv `bereich` (Marketing, Sales, Fulfillment, Führung, Unterstützung) und `fallArt` (Lead, Deal, Mandat, Event, Firma); Fulfillment-Vorlagen bleiben gültig. | B |
| 7 | Steckbrief je Prozess: Auslöser, Eingang, Phasen, Ergebnis, Empfänger, Eigner | Grenze und Zweck eines Prozesses auf einer Zeile — SIPOC (TechTarget), EOS | neu | Kachel klappt den Steckbrief auf; Felder im Modell; dient zugleich als Fragenliste, wenn ZOE oder ein Head einen Entwurf baut. | A |
| 8 | Wenige Kernprozesse, je Ebene höchstens etwa zehn Schritte | Wenige gelebte Kernprozesse schlagen Vollständigkeit — EOS, Bruce Silver (Trisotech) | teilweise — harte Grenze 400 Knoten (`lib/fulfillment/grenzen.ts`) | Ab zehn Schritten ruhiger Hinweis „Teilprozess bilden?“, ein Klick wandelt um; Teilprozess zugeklappt als Kachel; nie hart sperren. | B |
| 9 | Übergaben zwischen Prozessen als beschriftete Flow-Pfeile | Verluste entstehen am Übergang, nicht im Schritt — Rework, Umbrex | neu | Feld „Ende → Übergabe an Prozess X“; die Landkarte zieht daraus Lichtfaden-Pfeile mit Namen („SQL“, „gewonnen“, „Ziel erreicht“). | A |
| 10 | Genau eine verantwortliche Person je Prozess, aus dem Team | Mehrere Verantwortliche heißt am Ende keiner — RACI, Scaling Up | teilweise — `zustaendig` am Knoten | Pflichtfeld `eigner` (Team über `teamVon`, nie fest im Code); „aktiv“ erst mit Eigner, Start- und Endkriterium. | B |

### Kapitel 2 — Fläche bedienen

| Nr | Punkt | Warum | Stand in MAKE OS | Umsetzung | Etappe |
|---|---|---|---|---|---|
| 11 | Vollbild per Knopf, Esc führt zurück | Die Fläche muss den ganzen Bildschirm füllen können — Kevin 21.10., Miro | teilweise — Höhe begrenzt (`.ff-flaeche-buehne` in `app/globals.css`), Muster `components/os/fulfillment/reise/Praesentation.tsx` | Fullscreen-API, sonst festes Overlay; Leiste und Kopf weg, Werkzeuge schweben; `?voll=1` in der Adresse; gilt für Landkarte und jeden Prozess. | A |
| 12 | Hineinfahren statt Seitenwechsel, Brotkrumen, Esc eine Ebene hoch | Der Weg zurück bleibt immer sichtbar — bpmn-js, Camunda Cockpit | teilweise — Kamera (`components/os/ui/flaeche/kamera.ts`), Drill-down im Hochhaus | Klick auf Kachel = Kamerafahrt; „Landkarte › Fulfillment › Onboarding“; Pfad in der Adresse, Browser-Zurück funktioniert (`router.push`). | A |
| 13 | Feste Sprünge: Alles zeigen, Auswahl zeigen, Minimap auf Taste | Zwei Kürzel reichen für fast jede Orientierung — Miro, React Flow | teilweise — „Alles zeigen“ im Editor | Alt+1, Alt+2, Taste M für die Minimap (Formfarben, ziehbar); Kürzelübersicht hinter „?“; Einzeltasten abschaltbar. | A |
| 14 | Semantischer Zoom: weit weg Form und Zahl, nah dran Details | Zoombare Kartenbilder werden besser verstanden und behalten — KeyLines, De Luca (arXiv) | neu | Drei Stufen aus dem Zoomwert (Landkarte, Prozess, Detail), EINE Regel neben der Kamera; Knoten entscheiden das nie selbst. | A |
| 15 | Suche springt zum Knoten und lässt ihn aufleuchten | Suchen ist auf großen Flächen schneller als Scrollen — React Flow, Miro | neu (⌘K global vorhanden) | Sucht Knoten, Rahmen, Agenten und Fälle; Treffer = Kamerafahrt plus kurzes Aufleuchten des Lichtfadens am Knoten. | A |
| 16 | Rückgängig, Wiederholen, Kopieren mit Kanten für alle Prozesse | Grundausstattung jeder Fläche — React Flow, tldraw | teilweise — nur im Fulfillment-Editor (`lib/fulfillment/prozesse/editor-geschichte.ts`) | Vorhandene Geschichte auf das allgemeine Modell heben; Kopieren nimmt Kanten zwischen gewählten Knoten mit, Einfügen erzeugt neue Kennungen. | B |
| 17 | Mit Tastatur bauen: Alt+Pfeil legt verbundenen Schritt an | Der schnellste Weg zu einem Ablauf — Whimsical, bpmn.io | neu | Alt+Pfeil = gleiche Form in diese Richtung; Tab am Knoten öffnet die Formauswahl (Schritt, Nachricht, Raute, Erinnerung, Agent); deutsche Ansagen. | B |
| 18 | „Ordnen“ auf Knopfdruck, eine Leserichtung, rückgängig machbar | Ordnung auf Wunsch, Handarbeit bleibt erhalten — Lucid, ELK Layered | teilweise — automatische Lage ohne gespeicherte Position (`lib/fulfillment/prozesse/flaeche.ts`) | Prozess oben → unten, Landkarte links → rechts; Rückschleifen außen, beschriftet „zurück zu …“; gesetzte Lagen werden respektiert. | B |
| 19 | Raster, Hilfslinien, feste Andockpunkte an der Raute | Einrasten schafft Ordnung, Ja und Nein gehen sauber ab — React Flow Helper Lines, tldraw | teilweise — Raster im Editor | Hilfslinien zu Nachbarknoten beim Ziehen; Raute mit vier Andockpunkten; Pfeile bleiben beim Verschieben angeheftet. | B |
| 20 | Handy: Liste und Ansehen, Bauen erst ab Tablet | Ein Desktop-Editor auf dem Handy führt zu Fehlbedienung — Figma, draw.io | neu | Unter 720 px startet die Liste mit Fall-Zahlen; Fläche nur zoomen; Editor-Werkzeuge ab 768 px; Tippziele mindestens 44 px. | A |

### Kapitel 3 — Schön & verständlich (Flow-Standard, Formen, Farben, Live-Schicht)

| Nr | Punkt | Warum | Stand in MAKE OS | Umsetzung | Etappe |
|---|---|---|---|---|---|
| 21 | Der Lichtfaden ist die einzige Linienart auf allen Prozessflächen | Der Flow ist das Markenzeichen, ein durchgehendes Bild — Kevin 17.10. | vorhanden — `lib/reise/flow.ts`, `lib/lichtfaeden/*`, Formen `components/os/ui/reise/*` | Landkarte, Prozess und Lauf zeichnen mit demselben Zeichner: hell bis „Hier“, ruhig danach, still bei reduzierter Bewegung, nie ohne Daten. | A |
| 22 | Feste Formen nach Kevins Miro-Stil, dazu Agent und Auslöser | Kunden verstehen die Formen sofort; der Agent braucht eine eigene Gestalt — Kevin 17.10., Anthropic | teilweise — Schritt grün, Nachricht gelb, Raute, Erinnerung orange, Termin (`components/os/ui/reise/flaeche-formen.tsx`) | Zwei neue Formen im selben Satz: Agent (Ton der ZOE-Kugel, Kopf mit Rolle) und Auslöser (Startmarke mit Ereignis); sonst keine neuen Formen. | B |
| 23 | Beschriftung nach Regel: Verb + Gegenstand, Rauten-Ausgänge immer benannt | Beschriftung ist der größte Hebel für Verständlichkeit — Bruce Silver (Trisotech) | teilweise — Pfeil-Beschriftung im Editor | Platzhalter „Angebot senden“, Hinweis bei Einzelwort; leerer Rauten-Ausgang = Warnung; die Ende-Form zeigt den Zustand („Mandat aktiv“). | B |
| 24 | Wenig und klar: jede Information nur einmal je Ansicht | Kachel-Wände überfordern, laut ist nur die Abweichung — Kevin 17.10. (Miro-Stil), Camunda Optimize | Regel vorhanden (Fulfillment-Umbau 17.10.) | Je Knoten höchstens Titel, Zuständig, eine Zahl; der Rest auf Klick; Wächtertest „keine Kennzahl doppelt je Ansicht“. | A |
| 25 | Bahnen für Menschen, Agenten und den Kunden | Wer was tut, ist sofort sichtbar; KI-Schritte liegen offen — Bruce Silver, Miro AI Workflows | neu | Bahnen aus dem Team der Instanz, eine Agent-Bahn, Kunde als Außenbahn nur mit Nachrichten; nie Namen im Code. | B |
| 26 | Farbe nie allein: Form, Symbol und Text, Kontrast 3:1 | Lesbar für alle, auch in Graustufen — WCAG 1.4.1 und 1.4.11 | teilweise — eindeutige Formsprache | Status immer mit Symbol (Haken, Uhr, Ausrufezeichen); Klar·DARK-Token gegen 3:1 prüfen, Wächtertest wie beim Kalender. | A |
| 27 | Zahl der Fälle an jedem Knoten, Klick zeigt die Fälle | Wichtigste Live-Frage: wie viele stehen wo — Camunda Optimize, Celonis | teilweise — `kundenJeKnoten` im Hochhaus, Mandats-Cockpit (`lib/fulfillment/prozesse/cockpit.ts`) | Kleines Abzeichen je Knoten, zweite Zahl rot nur bei Fristüberschreitung; Klick öffnet eine Seitenleiste mit Links zu den Fällen. | A |
| 28 | Live-Schalter „Fälle · Dauer · Probleme“ über demselben Bild | Live-Daten als Schicht, nicht als zweites Bild — Camunda Optimize, Celonis | neu | Lichtfaden dicker, wo viele Fälle laufen; rot oder pulsierend nur bei gerissenem Zielwert; seltene Wege als „+3 Sonderwege“ eingeklappt. | C |
| 29 | Lauf-Ansicht: derselbe Plan färbt sich nach dem echten Weg | Ein Lauf ist am verständlichsten auf dem Bild, auf dem er gebaut wurde — Attio, LangGraph Studio | neu | Grün gelaufen, gelb wartet, rot Fehler, grau nicht erreicht; Status am Knoten nach A2A-Vorbild; „wartet auf dich“ pulsiert mit Frist. | C |
| 30 | Umschalter Bild · Liste aus demselben Modell | Screenreader, Handy und Export brauchen Text statt Alt-Text — Univ. Michigan, WebAIM | neu | Verschachtelte Liste je Ebene, Rauten als „Wenn … weiter bei …“; zugleich Handy-Ansicht, Text-Export und Prozessbeschreibung für ZOE. | A |

### Kapitel 4 — Auslöser & Ereignisse

| Nr | Punkt | Warum | Stand in MAKE OS | Umsetzung | Etappe |
|---|---|---|---|---|---|
| 31 | Auslöser-Baustein: Ereignis plus „nur wenn …“, vor dem Lauf geprüft | Unpassende Ereignisse erzeugen keinen Lauf und keine Kosten — HubSpot, Power Automate | teilweise — Skill-Auslöser hand · zeitplan · ereignis (`lib/agenten/typen.ts`) | Start-Knoten mit Ereignisart (= `SkillEreignis`, keine zweite Liste) und Bedingung per Klick über Felder; Übersprungenes nur als Zahl. | B |
| 32 | Auslöser-Arten: Ereignis, Zeitplan, Datum relativ, von Hand | Diese Familien decken fast alles ab — HubSpot, Salesforce Flow, n8n | teilweise — Takt, Hand-Start, Ereignisse vorhanden | Webhook und Formular bewusst später: jeder neue offene Weg braucht enge Regel, Eintrag im Routen-Register und eigenen Test. | B |
| 33 | Fehlende Ereignisse anschließen: Mandat, Rechnung, Fall-Schritt, Buchung, Event | Ohne Quelle gibt es keinen Auslöser — Bestandsaufnahme | teilweise — `lib/ereignisse/*`: 8 angebunden, 4 ohne Quelle, 7 fehlen | Aus vorhandenen Schreibwegen melden: Mandat angelegt/beendet, Rechnung gestellt, Fall-Schritt erledigt, Buchung bestätigt, Event vorbei, Kunden-Link-Antwort, Netzwerken-Erfassung. | C |
| 34 | Datums-Auslöser: „n Werktage vor einer Frist am Fall“ | Viele Abläufe hängen an einem Datum, nicht an einer Änderung — Salesforce Scheduled Paths | teilweise — `fristenLesen` (`lib/kalender/fristen-server.ts`), `lib/zeit/kalender-kern.ts` | Der Auslöser liest Fristen nur über diese zwei Stellen (Werktage NRW) und rechnet nie selbst: Kündigungsfrist, Review, Fälligkeit, Event-Datum. | C |
| 35 | Ein Lauf je Fall und Prozess, Wiedereintritt nur ausdrücklich | Verhindert doppelte Läufe und doppelte Post — HubSpot | neu | Lauf-Kennung aus Prozess + Fall; Schalter „erneut starten bei …“ mit Grund; gleichzeitig höchstens ein Lauf je Fall. | C |
| 36 | Beim Aktivieren fragen: „Gilt das für n bestehende Fälle?“ | Einschalten darf keinen Massenstart auslösen — HubSpot | neu | Rückfrage mit Anzahl in Klartext, Vorgabe „nur neue Fälle“; die Antwort steht im Verlauf des Prozesses. | C |
| 37 | Flutschutz: über einer Schwelle Läufe zurückhalten | Ein Import mit 400 Kontakten darf nicht 400 Läufe starten — Zapier | neu | Schwelle je Prozess und Stunde; Glocke „n Läufe zurückgehalten: starten / verwerfen“; nie still kürzen. | C |
| 38 | Ereignisse bleiben im Bereich: Business-Prozesse hören nie auf Privates | Trennung gehört auf den Server — Plattform-Regel MAKE OS, OWASP (Least Agency) | teilweise — Cursor je Konsument in `lib/ereignisse/*` | Ereignis trägt Bereich und Person; der Prozess-Leser filtert serverseitig; Wächtertest „Sicht Business bekommt nichts aus Privat“. | C |
| 39 | Fremdquellen nicht neu abfragen, an Spiegel-Ereignisse hängen | Doppelte erkennt man über feste Kennungen — Zapier | vorhanden — Spiegel und Ereignisse `neue-mail`, `neue-whatsapp` | Prozesse nutzen nur vorhandene Ereignisse; keine eigene Abfrage bei Gmail, IMAP oder Meta; doppelt erkannt über Nachrichten-ID bzw. WAMID. | C |
| 40 | Je Prozess „Ziel erreicht, wenn …“ und „Abbrechen, wenn …“ | Läufe enden, sobald ihr Zweck erfüllt oder hinfällig ist — HubSpot Goals, Inngest | neu | Zwei Felder im Steckbrief; Art.-18-Einschränkung und Werbesperre beenden immer alle Läufe zur Person, fest und nicht abwählbar. | C |

### Kapitel 5 — Lauf-Motor & Sicherheit

| Nr | Punkt | Warum | Stand in MAKE OS | Umsetzung | Etappe |
|---|---|---|---|---|---|
| 41 | Ein Lauf ist ein Datensatz: Version, Fall, Schritt, Ergebnisse | Läufe über Wochen überstehen Neustarts — Durable Execution (Inngest, Temporal) | teilweise — Absichtsprotokoll (`lib/store/absichten.ts`), Fulfillment-Ausführung (`lib/fulfillment/prozesse/ausfuehrung*.ts`) | Bestand `prozess-laeufe--<haushalt>`; der Takt weckt fällige und wartende Läufe; Fulfillment-Ausführung wird ein Fall davon; kein Temporal-Cluster (1 vCPU). | C |
| 42 | Jede Wirkung trägt die Kennung `<lauf>-<schritt>` | Wiederholen erzeugt sonst doppelte Mails, Aufgaben, Rechnungen — Temporal, Trigger.dev | vorhanden als Muster — `einmalig()` (`lib/store/anfragen.ts`), `fu-…`, `nw-…` | Gibt es die Kennung schon, wird übersprungen; Eindeutigkeit in der Schreibsperre, nie „erst prüfen, dann anlegen“. | C |
| 43 | Entwurf und veröffentlichte Version trennen, mit Versionsliste | Live läuft nur bewusst Veröffentlichtes — n8n 2.0, Zapier, Activepieces | teilweise — Vorlagen mit Fassung (`lib/fulfillment/typen.ts`) | Fläche = Entwurf (automatisch gespeichert, Stand/409); „Veröffentlichen“ mit Name und Notiz; Versionen ansehen, vergleichen, als Entwurf übernehmen. | B |
| 44 | Laufende Fälle bleiben auf ihrer Version | Ein Tausch mitten im Lauf erzeugt fehlende Schritte und falsche Pfade — Temporal | neu | Der Lauf speichert die Versionsnummer; eine neue Version gilt nur für neue Fälle; Umzug nur ausdrücklich mit Zuordnung alt → neu und Vorschau. | C |
| 45 | Kleiner Baukasten: Aktion, Raute, Warten, Schleife, Teilprozess, Fehlerkante | Feste, kleine Bausteine bleiben lesbar und prüfbar — Asana, ClickUp, Pipedrive | teilweise — Formen und Baustein-Bibliothek (`lib/fulfillment/prozesse/bausteine.ts`) | Fehlende Formen ergänzen; Teilprozess mit festen Ein- und Ausgaben; kein Nutzer-Code, nur feste Formatierer (Datum, Betrag, Textvorlage). | B |
| 46 | Jedes Warten hat Obergrenze und Ausgang „abgelaufen“ | Warten ohne Ende erzeugt hängende Läufe — Pipedrive, Power Automate | neu | Drei Arten: Dauer, Datum, Ereignis; zwei Ausgänge „eingetreten“ und „abgelaufen“; wartende Läufe kosten nichts, nur der Takt weckt. | C |
| 47 | Fehler: Fehlerkante, Wiederholen mit Backoff, „erneut ab hier“ | Nur Vorübergehendes wiederholen, Erfolgreiches nie doppelt — Zapier Replay, Temporal | teilweise — Backoff `wartenNachFehler` (`lib/zoe/takt.ts`) | Jede Aktion meldet vorübergehend oder dauerhaft; ohne Fehlerkante anhalten und Glocke an den Eigner; Wiederholen startet an der Fehlerstelle. | C |
| 48 | Probelauf ohne Wirkung, als Testfall speicherbar | Kein Live-Gang ohne Test, nie gegen echte Daten — n8n, Salesforce, Anthropic (Evals) | teilweise — Replay und pass^k der Heads (`lib/heads/eval.ts`), Demo-Saat | Spielt einen Beispiel-Fall durch, schreibt nichts, zeigt je Schritt „würde …“; Status Entwurf → Probelauf → Aktiv; Testfälle vor jedem Veröffentlichen. | B |
| 49 | Schleifenschutz über die Herkunft jeder Änderung | Häufigste Endlosschleife: ein Prozess löst sich selbst aus — Power Automate, monday | teilweise — das Änderungsprotokoll trägt „wer“ | Wirkung trägt `prozess:<id>`; eigene Änderungen lösen nichts aus; Ketten höchstens drei tief; Gleichwert ist kein Ereignis; Prüfung beim Veröffentlichen. | C |
| 50 | Drei Bremsen: Pausieren, Lauf abbrechen, Notbremse für den Verursacher | „Stopp“ heißt drei Dinge, nie alles still abschalten — Inngest, Pipedrive, ClickUp | teilweise — Not-Aus je Head (`lib/agenten/*`) | Pausieren sammelt neue Fälle; Abbrechen mit Grund; über n Läufe je Stunde pausiert sich nur dieser Prozess, mit Glocke und HOI-Befund. | C |

### Kapitel 6 — Agenten als Schritte

| Nr | Punkt | Warum | Stand in MAKE OS | Umsetzung | Etappe |
|---|---|---|---|---|---|
| 51 | Agenten-Baustein ruft vorhandene Skills und Heads in Reihenfolge auf | Kevin: Agents in Reihenfolge und Aufgaben packen; Agent als Schritt im Ablauf — Gumloop | teilweise — `Skill` (`lib/agenten/typen.ts`), `runAgent` (`lib/zoe/agenten.ts`), `LaufAuftrag 'skill'` | Knoten Form „Agent“ mit Skill bzw. Head und Auftrag; Start über `reihe(...)`; keine zweite Agenten- oder Werkzeugwelt neben ZOE. | B |
| 52 | Heads setzen Prozesse mit auf: Entwurf und Bausteine als Vorschlag | KI-Entwurf fragt nach und überschreibt nie — Kevin 21.10., Lucid Process Agent, Camunda Copilot | teilweise — Head-Vorschläge im Stapel, Import Vorschau → Übernehmen (`lib/fulfillment/prozesse/import.ts`) | Head des Bereichs legt Prozess- oder Baustein-Vorschlag in den Stapel, zeigt den Unterschied, fragt Lücken (Wer? Nein-Fall? Frist?); Übernahme per Klick. | B |
| 53 | Regel vor Agent: beim Einsetzen fragen „Warum reicht keine Regel?“ | Agenten kosten mehr und sind schwerer prüfbar — Anthropic, Gartner (Agent-Washing), Salesforce Agentforce | vorhanden als Linie — Heads: Regelwerk, Modell, Prüfer (`lib/heads/lauf.ts`) | Pflichtsatz am Agenten-Knoten; Rauten sind Regeln über Felder, eine Modell-Raute ist eigens markiert; Heads schlagen Ersatz durch Regel vor. | B |
| 54 | Vertrag je Agenten-Schritt: Eingabe- und Ausgabe-Schema, nur Kennungen | Freitext zwischen Schritten bricht — CrewAI, MCP-Spezifikation, 12-Factor Agents | teilweise — Skill-Eingaben, Ergebnis Faden/Stapel | Schema am Knoten, der Server prüft vor jeder Übergabe; ungültig → eine Korrekturrunde, dann Fehlerkante; die Kante zeigt, was fließt. | B |
| 55 | Rechte-Profil am Knoten mit Ampel „tödliches Dreieck“ | Private Daten, fremder Inhalt und Außenweg zusammen ergeben Datenabfluss — Willison, Meta Rule of Two, OWASP | teilweise — Werkzeugklassen lesen · vorschlag · intern · aussen · geld · loeschen, `lib/datenschutz/ki-werkzeuge.ts`, `fremd()` | Profil zeigt Lesebereiche und Werkzeugklassen mit Symbol; KI-Kategorien erben automatisch; alle drei Ecken → Freigabe Pflicht, nicht abschaltbar. | B |
| 56 | Fremder Text bestimmt nie Weg, Empfänger oder Betrag | Prompt-Injection ist nicht ganz lösbar, ein gezeichneter Plan schützt — Beurer-Kellner (arXiv), CaMeL | teilweise — Regel 6, `lib/zoe/fremd.ts` | Rauten auf fremdem Text führen nur in harmlose Äste oder in eine Freigabe; Ziele aus Stammdaten; „fremd gelesen“ gilt für den ganzen Lauf. | C |
| 57 | Ein Schreiber je Datensatz, Analyse-Agenten und Heads beraten nur | Parallel schreibende Agenten widersprechen sich still — Cognition, MAST (NeurIPS) | vorhanden als Linie — der Stapel ist der einzige Schreibweg für Agenten | Editor warnt, wenn zwei parallele Äste dieselbe Akte ändern; der Lauf sperrt je Datensatz, der zweite Ast wartet. | C |
| 58 | Autonomie-Stufe je Agenten-Schritt, verdient und wieder entziehbar | Beobachten, vorschlagen, mit Freigabe, selbst — je Aufgabe festgelegt — Smashing Magazine, n8n, Lindy | teilweise — Autonomie vorschlag/intern je Head (`lib/heads/autonomie.ts`) | Aufstieg nur mit Annahmequote und pass^k; Rückstufung bei über 5 % Rücknahmen oder Modellwechsel; „selbst“ nur für interne, umkehrbare Schritte. | C |
| 59 | Budget je Schritt, Lauf und Monat, Kostenschätzung beim Aktivieren | Ketten vervielfachen Kosten, Grenzen gehören in die Laufzeit — Claude Agent SDK, Gartner | teilweise — Budget je Head, `kostenGrenzeCent` am Skill, Hand-Start über 50 Cent bestätigen | Vorgabe: intern automatisch, KI-Kosten und außen mit Freigabe (Kevin 21.10.); Schätzung = Läufe × Schritte × Modell; Budget erreicht → pausieren, Glocke. | C |
| 60 | Sichtbarer Rückfall: wiederholen, Ersatzmodell, Regelwerk, Mensch | Ein Prozess darf nie still scheitern — n8n, OpenAI Agents SDK, HubSpot | teilweise — Heads laufen „ohne KI“ im Regelwerk | Feste Kaskade je Agenten-Schritt; der Knoten zeigt „lief im Regelwerk“ oder „wartet auf Mensch“. | C |

### Kapitel 7 — Mensch im Ablauf & Freigaben

| Nr | Punkt | Warum | Stand in MAKE OS | Umsetzung | Etappe |
|---|---|---|---|---|---|
| 61 | Der Freigabe-Baustein ist der ZOE-Stapel: freigegeben, abgelehnt, abgelaufen | Der Menschen-Schritt ist ein eigener Knoten mit Ästen — Zapier Human in the Loop, Dify | vorhanden als Stapel — `lib/zoe/stapel.ts`, Stapel-Arten | Neue Stapel-Art `prozess`; Ausgänge als Äste, „Ändern & freigeben“, Grund bei Ablehnung; kein zweites Postfach. | C |
| 62 | Jede Außenwirkung bekommt automatisch eine Freigabe-Form im Bild | Eiserne Regel 3 sichtbar machen; Freigabe am Werkzeug — n8n, Relevance AI | vorhanden als Regel — aussen · geld · loeschen immer über den Stapel | Editor setzt hinter Mail, WhatsApp, Angebot, Rechnung und Löschen eine Freigabe in die Menschen-Bahn, mit Schloss, nicht entfernbar. | B |
| 63 | Freigabe zeigt den konkreten Aufruf, Begründung und Belege | Erklärtes wird angenommen, Zusammenfassungen verschleiern — Relevance AI, Smashing Magazine | teilweise — Belege der Heads (`lib/heads/belege.ts`), Häkchen je Feld der ZOE-Freigabe | Empfänger, Text, Betrag wörtlich; ein bis zwei Sätze Grund mit Links (`WEG`); Kosten des Laufs; Häkchen je Feld. | C |
| 64 | Nach der Freigabe Stand und Version neu prüfen | Was beim Vorschlag galt, kann veraltet sein — OpenAI Agents SDK, Microsoft Agent Framework | vorhanden als Muster — `_stand` → 409 mit Unterschied | Vorbedingungen direkt vor der Ausführung erneut prüfen; geänderte Prozessversion → Rückfrage statt still weiter. | C |
| 65 | Jede Freigabe hat Frist, Zuständige und Ast „keine Antwort“ | Freigaben ohne Frist hängen ewig — Trigger.dev, Power Automate, Dify | neu | Vorgabe drei Werktage, eine Erinnerung, dann Weitergabe; sichtbar „wartet auf …“ mit dem Namen aus dem Konto. | C |
| 66 | Plan-Freigabe zu Beginn, Einzelfreigabe nur vor riskanten Schritten | Zu viele Klicks führen zu blindem Durchwinken — Meta Rule of Two, Microsoft Magentic-UI | teilweise — Sammelfreigabe nur für risikoarme Vorschläge | Vor dem Start „Das wird passieren: …“ einmal bestätigen; einzeln nur vor Außenwirkung und Unumkehrbarem; interne Schritte mit Rückgängig-Fenster. | C |
| 67 | Menschen-Schritte werden Aufgaben im Arbeitsfluss | Prozesse leben nur dort, wo gearbeitet wird — Process Street, EOS | vorhanden für Fulfillment — Schritt → Aufgabe, Nachricht → Stapel (`ausfuehrung*.ts`) | Allgemein machen: die Aufgabe trägt den Bezug zum Lauf; Abhaken treibt den Lauf weiter; Glocke und „Steht an“ nennen den Prozess. | C |
| 68 | Klare Rollen: wer baut, veröffentlicht, freigibt, als wer läuft | Vier Rollen sauber getrennt — Activepieces, Zapier, Salesforce | teilweise — Bearbeiten nur für volle Mitglieder | Volle Mitglieder veröffentlichen; Team und Business-Konten bauen Entwürfe; der Lauf schreibt als benannte Person, nie Rückfall auf den Inhaber (Regel 5). | B |
| 69 | Glocke nur für Freigaben und Endgültiges, Rest als Tageszeile | Meldungsflut zerstört Vertrauen — Zapier, Courier (Alert Fatigue) | teilweise — „neuere ersetzt“ (`lib/meldungen/regeln.ts`) | Glocke: Freigaben, endgültige Fehler, zurückgehaltene Läufe; auf Heute „Prozesse heute: n gelaufen, m warten“; je Prozess und Fehlerart eine Meldung. | C |
| 70 | Durchwinken erkennen: Freigaben unter drei Sekunden zählen | Schein-Aufsicht muss sichtbar werden — Meta Rule of Two, urandom.io | neu | Zähler je Prozess im Lagebild, ohne Inhalte; ab Schwelle ruhiger Hinweis an den Eigner, Plan-Freigabe anbieten. | D |

### Kapitel 8 — Sales · Marketing · Fulfillment als Prozess

| Nr | Punkt | Warum | Stand in MAKE OS | Umsetzung | Etappe |
|---|---|---|---|---|---|
| 71 | Übergabe Sales → Lieferung zuerst: „gewonnen“ nur mit vollständiger Übergabe | Der teuerste Knoten, zuerst reparieren — Rework, Birdview, Growigami | teilweise — Deal → Mandat → Fall, Onboarding (`lib/crm/mandat-anlegen.ts`, `lib/fulfillment/prozesse/onboarding.ts`) | Übergabe mit acht Blöcken (Kunde, Umfang, Zeit, Geld, Personal, Risiken, Erwartungen, Kickoff) übernimmt Deal und Angebot; „startklar“ gibt das Kickoff frei. | C |
| 72 | Kernprozess-Bibliothek: fünf bis sieben Vorlagen, Teilprozesse darunter | Wenige Kernprozesse, grob beschrieben, von allen befolgt — EOS, Scaling Up | teilweise — Fulfillment-Vorlagen, Aufgaben-Startvorlagen (`lib/aufgaben/vorlagen-start.ts`) | Vorlagen im Code ohne Daten: Marketing, Vertrieb, Übergabe, Lieferung, Kundenbindung, Finanzen; nutzen vorhandene Definitionen (Scoring, Lifecycle, BEAN); „braucht: Gmail verbunden“. | B |
| 73 | Jedes Produkt trägt seinen Standard-Ablauf | Ein Standard-Start bringt schneller ersten Nutzen als Maßarbeit — Gainsight, Kevin 19.10. (eine Karte je Produkt) | teilweise — Ablauf an der Produktkarte (`lib/crm/produkt-karte.ts`) | Die Produktkarte verweist auf eine Prozess-Vorlage (Haupt plus Zusatzmodule); das Mandat startet den Lauf daraus; nur Kennungen, keine Kopie. | B |
| 74 | Event-Nachfassen binnen 48 Stunden als sichtbarer Prozess | Event-Kontakte kühlen schnell ab — LeanData, Momencio (Richtwert) | teilweise — Netzwerken, Danke-Entwürfe, Follow-up-Quote (`lib/crm/besuche.ts`) | Als System-Prozess auf der Landkarte mit Zähler „offen · rechtzeitig nachgefasst“; der Dank bleibt ein Entwurf mit Klick. | A |
| 75 | Lead-Eingang mit Uhr und Pflicht-Ergebnis | Die Antwortzeit entscheidet, kein Lead bleibt ohne Status — LeanData, Growigami | teilweise — Ereignis `neuer-lead`, Lead-Status, Follow-up (`lib/crm/followup.ts`) | Prozess „Lead-Eingang“: Zeit bis zur ersten Reaktion, Pflichtfeld Ergebnis mit Grund, Eskalation über „Steht an“ an die Zuständige. | C |
| 76 | Nach jedem Termin mit CRM-Bezug: Nachbereiten binnen 24 Stunden | Liegengebliebene Zusagen kosten die meisten Deals — Gong | vorhanden — „Nachbereiten“, „Wie lief's?“ (`lib/heute/anstehend.ts`) | Schritt am Ereignis `termin-vorbei`; ein Agent entwirft Zusammenfassung und Follow-up als Vorschlag; ein Mensch gibt frei. | C |
| 77 | Kapazitätsprüfung vor „Angebot stellen“ | Lieferbarkeit vor der Unterschrift klären — SPI Benchmark (Certinia) | teilweise — Kapazität (`lib/kapazitaet/*`, `lib/fulfillment/prozesse/kapazitaet-vorschlag.ts`) | Raute „Zum Termin lieferbar?“ im Angebotsprozess liest `kapazitaetRechnen`; nein → Termin oder Umfang anpassen, bevor gestellt wird. | C |
| 78 | Rechte Seite: Verlängerung, Ausbau, Empfehlung als eigene Prozesse | Der Großteil des Umsatzes kommt von Bestandskunden — Bowtie (Winning by Design), Growigami, Rework | teilweise — Kündigungsfristen (`mandatFristen`), Wirkungsbericht (`lib/fulfillment/prozesse/wirkung.ts`) | Verlängerung 90 Tage vor Ende (Datums-Auslöser); Ausbau und Empfehlung beim Ereignis „Ziel erreicht“; die Empfehlung wird ein Lead mit Herkunft. | D |
| 79 | Auswertung nach Abschluss, auch für „keine Entscheidung“ | CRM-Gründe stimmen selten, Unentschlossenheit ist der größte Gegner — Clozd, JOLT (Dixon) | teilweise — Verlustgründe, Deal-Auswertung (`lib/crm/deal-auswertung.ts`) | Schritt nach gewonnen oder verloren: kurzes Gespräch, ZOE fasst zusammen; Rückfluss in Zielkundenprofil, Scoring, Angebotsvorlagen; „keine Entscheidung“ eigens gezählt. | D |
| 80 | Änderungsanfrage als kleiner Prozess mit Angebot und Rechnung | Mehrarbeit wird sonst nie berechnet — Accelo | teilweise — Angebot als neue Version, Mandat, Rechnung | Erfassen → Wirkung prüfen → Optionen → Freigabe → Angebot v2 und Rechnung anpassen; dockt an die vorhandenen Schreibwege an. | D |

### Kapitel 9 — Messen & Scores

| Nr | Punkt | Warum | Stand in MAKE OS | Umsetzung | Etappe |
|---|---|---|---|---|---|
| 81 | Oben auf Heute nur zwei Scores: Business und Privat | Ein Score je Bereich, nichts vermischt — Kevin 21.10. | teilweise — Business-Index (`lib/business/*`), Privat-Index (`lib/privat/*`) | Je Sicht ein Ring; antippen öffnet Säulen, Kennzahlen und größten Hebel; „Alles“ zeigt beide nebeneinander; Trennung auf dem Server. | D |
| 82 | Wachstums-Score entfernen, Finanzen zeigt nur Finanzen | Ein Gesamt-Score unter Finanzen verwirrt — Kevin 21.10. | vorhanden, wird abgebaut — `lib/performance.ts`, `lib/agenten-score.ts`, Finanzen › Cockpit | Score-Karte aus Finanzen und Heute raus; Finanzielle Gesundheit bleibt; gespeicherte Verläufe bleiben liegen (additiv); alte Links führen auf Heute. | D |
| 83 | Privat-Score aus vorhandenen Indizes über den gemeinsamen Kern | Eine Rechenquelle, keine eigene Punkte-Logik — Kern-Regel MAKE OS | teilweise — `lib/kennzahlen/kern.ts`, Gesundheits-, Familie- und Privat-Index | Säulen Gesundheit (nur eigene, mit Einwilligung), Familie & Partnerschaft, Finanzen privat, Planung und Fokus privat; je Person; Wächtertest Art. 9. | D |
| 84 | Säule „Prozesse“ im Business-Score, zählt nur mit Messung | Prozess-Kennzahlen gehören in den einen Business-Score — EOS (Scorecard), Bowtie (Winning by Design) | teilweise — Säule Fulfillment mit `nurMitMessung` (`lib/fulfillment/prozesse/kennzahlen.ts`) | Aus der Fulfillment-Säule weiterentwickeln; ohne Messung fällt sie heraus und der Index bleibt bit-gleich (Test wie heute). | D |
| 85 | Je Prozess drei Messpunkte: Menge, Umwandlung, Zeit | Erst alle drei zeigen Lecks und Staus — Bowtie (Winning by Design), Rework | teilweise — Deal-Auswertung, Fulfillment-Kennzahlen | Aus vorhandenen Daten gerechnet (CRM, Aufgaben, Kalender, Rechnungen, Läufe), nie doppelt gepflegt; ohne Messung eine Lücke, nie eine Null. | D |
| 86 | Leitkennzahl und Quartals-Durchsicht je Prozess | Jede Kennzahl hat genau eine Besitzerin und wird regelmäßig geprüft — EOS, Scaling Up | neu | Leitkennzahl im Steckbrief; Durchsicht als Serien-Aufgabe des Eigners; Verbesserung als 90-Tage-Ziel in Planung. | D |
| 87 | Befolgungsquote automatisch aus den Läufen | Dokumentation ohne Befolgung ist Theater — EOS („Followed by all“), Process Street | neu | Anteil der Läufe mit allen Pflichtschritten in der Frist, je Kernprozess; Kennzahl der Säule „Prozesse“. | D |
| 88 | Prozess-Gesundheit im HOI: Fehler, Hänger, überfällige Freigaben | Sonst scheitert ein Prozess wochenlang still — n8n Insights, Salesforce | teilweise — Lagebild (`lib/hoi/lage.ts`) | Befund „Prozesse“ nur mit Zählern (Fehlerquote 7 Tage, hängende Läufe, abgelaufene Wartestellen); Schwellen gelb/rot; Link zum Prozess. | C |
| 89 | Agenten-Kennzahlen: Annahme, Änderungsgrad, Rücknahmen, Kosten und gesparte Zeit | Wenige Zahlen zeigen, ob Agenten gut arbeiten — Smashing Magazine, n8n Insights | teilweise — Annahmequote und Änderungsgrad der Heads (`lib/heads/lernen.ts`) | Je Agenten-Schritt im Prozess-Lagebild, dazu „€ je qualifiziertem Lead“; Schwellen lösen Hinweis oder Rückstufung aus; nur Zähler. | D |
| 90 | Wartezeit zwischen den Schritten sichtbar machen | Die Durchlaufzeit steckt meist im Warten — Value Stream Mapping (Rother/Shook), Lucid | neu | Lichtfaden zwischen Schritten: dünn = kurz, blass = lange Wartezeit; optionales Band unten „Arbeit gegen Warten“. | D |

### Kapitel 10 — Nach außen, Kunden & Produkt

| Nr | Punkt | Warum | Stand in MAKE OS | Umsetzung | Etappe |
|---|---|---|---|---|---|
| 91 | Sichtbarkeitslinie: Kunden sehen nur, was über der Linie liegt | Vorderbühne und Hinterbühne sauber trennen — Service Blueprint (NN/g), Plattform-Regel | teilweise — `kundeSichtbar` am Knoten, Marke `nur-intern` (`lib/fulfillment/prozesse/bausteine.ts`) | Die Außenansicht liest nur sichtbare Knoten, der Server liefert nichts anderes; Wächtertest „Kunde bekommt nichts Internes“. | D |
| 92 | Außenansicht als drei bis sieben Etappen mit Lichtfaden | Kunden brauchen Position und nächsten Schritt, keinen Graphen — UXPin | teilweise — Kunden-Link, Dossier, Reise-Zeile (`lib/reise/*`) | Aus den sichtbaren Knoten automatisch erzeugt, „Hier“ markiert; im Kunden-Link und im PDF; dieselben Daten, andere Darstellung. | D |
| 93 | Präsentieren: Rahmen für Rahmen, Kamerafahrt entlang des Flows | Das schöne Bild nach außen im Termin zeigen — Kevin 21.10., Miro, Excalidraw+ | teilweise — `Praesentation.tsx` (Fulfillment) | Drei Modi: Bearbeiten · Ansehen · Präsentieren; Rahmen ohne Ränder; Bild-auf/ab blättert; Rechte serverseitig. | A |
| 94 | „Prozesse aufsetzen“ als Produkt auf der Leistungstreppe | Kunden kaufen Diagnose und Weg, kein Dokument — Winning by Design (Growth Advisory) | neu — Produktkarte vorhanden (`lib/crm/produkt-karte.ts`) | Stufen: Reifegrad-Check → Landkarte → Vorlagen → 90-Tage-Einführung → Quartals-Durchsicht; Preise nur als Instanz-Daten, die Kevin liefert. | D |
| 95 | Reifegrad-Check: Bowtie-Stufen mal fünf Reifegrade als Ampelbild | Ein einfacher Fragebogen zeigt den Engpass — Rework (Reifegrade), RevEngine | neu | Fragebogen als Daten; Ergebnis als Bowtie mit Ampeln im Kunden-Dossier; die Demo-Saat zeigt ein erfundenes Beispiel. | D |
| 96 | Vorlagen in Kunden-Instanzen übertragen: Struktur ja, Daten nie | Rohbau-Regel; die Bibliothek ist Teil der Leistung — Plattform-Regel MAKE OS, HubSpot-Vorlagen | teilweise — Import Vorschau → Übernehmen → Rückgängig (`lib/fulfillment/prozesse/import.ts`) | Export „Prozess-Paket“ (Knoten, Kanten, Verträge) ohne Personen und Beträge; `nur-intern` bleibt draußen; Import in eine leere Instanz. | D |
| 97 | KI-Texte nach außen gekennzeichnet, echte Bearbeitung belegt | Art. 50 ist seit 02.08.2026 durchsetzbar — AI Act Art. 50 | teilweise — `kiKennzeichen()` (`lib/datenschutz/ki-kennzeichnung.ts`), `<KiMarke />` | Schritte mit Außentext tragen die KiMarke; die Freigabe hält fest: geändert ja/nein, Dauer, Person; vor dem Produktverkauf die Anbieter-Rolle prüfen lassen. | C |
| 98 | Lauf-Protokoll nur Kennungen und Status, mit Frist und Register | Protokolle dürfen kein Datenleck werden — Make, OpenTelemetry (GenAI) | neu — Muster KI- und Änderungsprotokoll | Neue Bestände im Speicher-Register mit Rechtsgrundlage und Löschfrist; Art. 15/17 über `lib/crm/person-bestaende.ts`; Hash-Kette wie die Protokolle. | C |
| 99 | Alle Prozesse mit erfundenen Daten in der Demo-Instanz vorführbar | Verkaufen braucht Vorführen ohne echte Daten — Plattform-Regel MAKE OS („zeigbar“) | teilweise — Demo-Saat (`lib/demo/saat.ts`) | Die Saat legt Kernprozesse, Läufe in allen Zuständen und ein Reifegrad-Beispiel über die Routen an; Wächter `tests/demo.test.ts`. | B |
| 100 | Motor und Modell im eigenen Code, Modelle nur hinter dem KI-Tor | Fremde Builder werden abgeschaltet — OpenAI Agent Builder (Ende 30.11.2026), 12-Factor Agents | vorhanden als Linie — KI-Tor `askText`, eigene Bestände | Kein n8n oder Temporal; Prozesse als eigenes Modul mit Schnittstellen, sodass eine Instanz auch „nur Markttraktion“ oder ohne Prozesse sauber startet. | B |

---

## 3. Der Bauplan in Etappen

### A — Sehen · Größe M
**Kevin sieht danach:** Links in der Business-Leiste steht „Prozesse“. Dort liegt die Landkarte als Bowtie mit den drei Bändern und allen Prozessen, die heute schon im Code laufen, je Kachel mit der Zahl der Fälle. Ein Klick fährt hinein bis zum einzelnen Schritt, Esc führt zurück, ein Knopf macht Vollbild oder Präsentation, die Suche springt zum Knoten. Am Handy gibt es dieselben Prozesse als Liste.
**Punkte:** 1, 2, 3, 4, 5, 7, 9, 11, 12, 13, 14, 15, 20, 21, 24, 26, 27, 30, 74, 93 (20 Punkte)

### B — Bauen · Größe L
**Kevin sieht danach:** Jeder Prozess lässt sich im Editor bauen, nicht nur Fulfillment, mit Agenten-Baustein, Auslöser-Baustein, Bahnen und Freigabe-Schloss an jeder Außenwirkung. Die Heads legen Entwürfe und einzelne Bausteine in den Stapel, Kevin oder Malin übernehmen per Klick. Der Probelauf zeigt Schritt für Schritt, was passieren würde, ohne etwas zu schreiben; veröffentlicht wird mit Name und Notiz.
**Punkte:** 6, 8, 10, 16, 17, 18, 19, 22, 23, 25, 31, 32, 43, 45, 48, 51, 52, 53, 54, 55, 62, 68, 72, 73, 99, 100 (26 Punkte)

### C — Laufen · Größe L
**Kevin sieht danach:** Veröffentlichte Prozesse starten selbst auf Ereignisse, Zeitpläne und Fristen. Menschen-Schritte landen als Aufgaben bei der richtigen Person, Freigaben im Stapel, und derselbe Plan färbt sich nach dem echten Weg jedes Falls. Schutz ist eingebaut: ein Lauf je Fall, Flutschutz, Schleifenschutz, Budget, Notbremse, HOI-Befund.
**Punkte:** 28, 29, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 44, 46, 47, 49, 50, 56, 57, 58, 59, 60, 61, 63, 64, 65, 66, 67, 69, 71, 75, 76, 77, 88, 97, 98 (36 Punkte)

### D — Messen & Verkaufen · Größe L (die Scores allein: M)
**Kevin sieht danach:** Oben auf „Heute“ stehen nur noch Business-Score und Privat-Score, der Wachstums-Score ist weg, Finanzen zeigt nur Finanzen. Der Business-Score hat eine Säule „Prozesse“ mit Menge, Umwandlung, Zeit und Befolgungsquote. Nach außen gibt es eine Kundenansicht als Etappen-Leiste, und „Prozesse aufsetzen“ ist ein eigenes Produkt mit Reifegrad-Check.
**Punkte:** 70, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 89, 90, 91, 92, 94, 95, 96 (18 Punkte)

### Vorschlag für das große Update

| Teil | Punkte | Begründung |
|---|---|---|
| **Pflicht A** | alle 20 | Kevins Kern: sehen, Vollbild, Drill-down. Baut fast nur auf Vorhandenem auf (Hochhaus, Kamera, Präsentation, Reise). |
| **Pflicht B** | alle 26 | Editor für alle Prozesse, Agenten- und Auslöser-Baustein, Heads schlagen vor. Probelauf statt echter Wirkung hält B gefahrlos. |
| **Pflicht Scores** | 81, 82, 83, 84 | Zwei Scores, Wachstums-Score weg. Die Säule „Prozesse“ (84) ist dabei, zählt aber erst mit Messung; der Index bleibt sonst bit-gleich. |
| **C1 — sicher im Update** | 29, 33 (nur Mandat, Rechnung, Fall-Schritt), 35, 36, 37, 38, 40, 41, 42, 44, 46, 47, 49, 50, 59, 61, 64, 67, 69, 88, 98 | „Laufen, aber nur intern“: Menschen-Schritte werden Aufgaben, alles Äußere geht in den Stapel, Agenten-Schritte nur auf Stufe „Vorschlag“, keine Modell-Rauten. Jeder Prozess startet im Probelauf, erst ein Klick schaltet ihn scharf. |
| **Schnittlinie, falls es eng wird** | C1 nur 29, 41, 42, 44, 88, 98 | Schatten-Modus: Läufe rechnen und zeigen „würde …“, schreiben aber keine Aufgaben und keinen Stapel. Null Risiko für Live-Daten. |
| **Nach dem Update (C2)** | 28, 34, 39, 56, 57, 58, 60, 63, 65, 66, 71, 75, 76, 77, 97 | Live-Schalter, Datums-Auslöser, Mail-Ereignisse, Autonomie, die Sales-Kernprozesse mit Uhr. |
| **Danach (D)** | 70, 78, 79, 80, 85, 86, 87, 89, 90, 91, 92, 94, 95, 96 | Prozess-Kennzahlen, Außenansicht, „Prozesse aufsetzen“ als Produkt. |

Für das Update gilt wie immer: nur additiv, Update-Probe mit Altbestand, Sicherung vorher, Eintrag in „Was ist neu“.

---

## 4. Offene Entscheidungen für Kevin

| Nr | Frage | Optionen | Empfehlung |
|---|---|---|---|
| E1 | Welche Form hat die Landkarte der ganzen Firma? | (a) Bowtie links → rechts, wie die Recherche · (b) „Hochhaus“ unten → oben, wie heute im Fulfillment · (c) Bowtie für die Firma, das Hochhaus bleibt Drill-down im Fulfillment | **(c)** — die Firma liest sich als Kundenweg, das Bekannte bleibt erhalten. |
| E2 | Wie viel „Laufen“ kommt ins große Update? | (a) nur Schatten-Modus · (b) C1: interne Läufe, Freigaben über den Stapel, Agenten nur als Vorschlag · (c) ganz C | **(b)**, mit (a) als Schnittlinie, falls die Zeit nicht reicht. |
| E3 | Was passiert mit den Prozessen, die schon im Code laufen? | (a) dauerhaft nur zeigen · (b) erst zeigen, dann einzeln in den Motor überführen, je mit Gold-Test · (c) sofort alle umbauen | **(b)**, Fulfillment zuerst — keine zweite Wahrheit, kein großer Knall. |
| E4 | Wie wird der Privat-Score gebaut? | (a) je Person: eigene Gesundheit plus gemeinsame Familie, Finanzen, Planung · (b) je Haushalt, Gesundheit nur, wenn beide teilen · (c) je Person ohne Gesundheit | **(a)**, Gewichte wie im alten Wachstums-Score ohne Business und Agenten (Gesundheit 50 %, Finanzen 21 %, Planung 14 %, Familie 14 %), später einstellbar. |
| E5 | Wie hart ist das Übergabe-Tor vor „gewonnen“? | (a) hart: „gewonnen“ gesperrt, bis die Übergabe vollständig ist · (b) weich: „gewonnen“ geht, die Übergabe startet sofort mit Uhr und Erinnerung · (c) erst später | **(b)** — maximal einfach, kein Klick mehr; hart erst, wenn die Quote zeigt, dass es nötig ist. |
| E6 | Wo stellt man Auslöser ein, wenn Skills schon eigene haben? | (a) Skills behalten eigene Auslöser, Prozesse rufen Skills nur auf · (b) Auslöser nur noch im Prozess; ein Skill mit Auslöser erscheint als Ein-Schritt-Prozess · (c) beides parallel | **(b)** — eine Stelle für „wann passiert was“; vorhandene Skill-Auslöser werden ohne Datenumzug als Prozess gelesen. |

---

## 5. Anti-Pattern, die wir vermeiden

1. Zwei Wahrheiten: ein hübsches Bild neben der echten Automatik, die auseinanderlaufen.
2. Ein Agent, wo eine Regel reicht — teurer, unberechenbarer und schwerer zu prüfen.
3. Ebenen mischen oder die Landkarte mit Detail überladen, sodass niemand mehr den Überblick hat.
4. Alles leuchtet: jede Zahl gleich laut, Kennzahlen doppelt, das echte Problem geht unter.
5. Massenstart beim Einschalten oder Import und Prozesse, die sich selbst wieder auslösen.
6. Warten ohne Ende und stille Fehler, die nirgends auftauchen.
7. Freigabe als Durchwinken, weil zu viele kleine Rückfragen kommen.
8. Fremder Text entscheidet über Weg, Empfänger oder Betrag.
9. Neue Version unter laufenden Fällen tauschen oder Probeläufe gegen Live-Daten fahren.
10. Prozess als Dokument ohne Eigner, ohne Lauf und ohne Befolgungsquote.

---

## 6. Quellen (die wichtigsten 25)

| Nr | Kurzname | URL |
|---|---|---|
| 1 | Bowtie (Winning by Design) | https://winningbydesign.com/?p=10438 |
| 2 | Rework, Bowtie-Modell | https://resources.rework.com/libraries/revenue-operations/bowtie-model |
| 3 | EOS, Process Component | https://www.eosworldwide.com/process-component |
| 4 | Birdview, Übergabe-Checkliste | https://birdviewpsa.com/blog/sales-to-delivery-handoff-checklist-consulting/ |
| 5 | Signavio, Ebenen der Prozesslandkarte | https://www.signavio.com/wiki/process-discovery/business-process-mapping-levels/ |
| 6 | Haufe, Prozesslandkarte | https://www.haufe-akademie.de/blog/themen/projekt-prozessmanagement/prozesslandkarte/ |
| 7 | Bruce Silver (Trisotech), BPMN-Stilregeln | https://www.trisotech.com/bpmn-style-rules/ |
| 8 | NN/g, Service Blueprint | https://www.nngroup.com/articles/service-blueprints-definition/ |
| 9 | Miro, Kürzel | https://miro.com/shortcuts/ |
| 10 | ELK Layered | https://eclipse.dev/elk/blog/posts/2025/25-08-21-layered.html |
| 11 | Camunda Optimize | https://docs.camunda.io/docs/guides/improve-processes-with-optimize/ |
| 12 | Attio, Workflows | https://attio.com/help/reference/automations/workflows/troubleshooting-workflows |
| 13 | HubSpot, Auslöser | https://knowledge.hubspot.com/workflows/set-your-workflow-enrollment-triggers |
| 14 | Zapier, Flutschutz | https://help.zapier.com/hc/en-us/articles/14230420160269-Choose-your-Zaps-flood-protection-limit |
| 15 | Zapier, Human in the Loop | https://www.zapier.com/blog/human-in-the-loop-guide |
| 16 | n8n, Versionen | https://docs.n8n.io/workflows/history |
| 17 | Temporal, Idempotenz | https://temporal.io/blog/idempotency-and-durable-execution |
| 18 | Anthropic, Building effective agents | https://www.anthropic.com/engineering/building-effective-agents |
| 19 | Anthropic, Evals | https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents |
| 20 | Salesforce Agentforce, Hybrid Reasoning | https://architect.salesforce.com/docs/architect/fundamentals/guide/hybrid-reasoning-agentforce-builder-agent-script |
| 21 | Willison, Lethal Trifecta | https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ |
| 22 | Meta, Rule of Two | https://ai.meta.com/blog/practical-ai-agent-security/ |
| 23 | OWASP, Agentic Top 10 | https://genai.owasp.org |
| 24 | Smashing Magazine, Agentic UX | https://smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/ |
| 25 | AI Act Art. 50 (Verordnung 2024/1689) | https://eur-lex.europa.eu/eli/reg/2024/1689/oj |
