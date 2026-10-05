# P06 · Produktionsarchitektur für KI-Agenten

- **Quelle:** Gemini Deep Research, ungeprüft
- **Drive:** https://docs.google.com/document/d/1SASgEJsA3aUXffg3YKaNTiKH1XfL3JQq6j16xsOxvzU
- **Abgerufen:** 05.10.2026 (über die Google-Drive-Anbindung, Textfassung des Dokuments)
- **Auszug und Prüfung:** siehe `P06-auszug.md`
- **Hinweise zur Ablage:** Text vollständig, nicht gekürzt (Drive-Text ca. 54.000 Zeichen, bis Referenz 52). Formeln lagen im Dokument nur als Bilder vor und fehlten in der Textfassung; sie sind aus dem Word-Export abgelesen und als `[F: …]` nachgetragen (eine Stelle ist schon im Original unvollständig: „Wert fehlt im Original“). Tabellen: Export-Escapes entfernt, erste Zeile als Kopf. Ziffern direkt hinter Sätzen (z. B. „…Kosteneffizienz1“) sind Geminis Quellenverweise auf die Referenzliste am Ende. **Achtung: Referenz 9 ist unsere eigene Datei `AI_CEO_MODUL.md`** — alles mit „9“ belegte ist ein Echo unseres Plans, kein externer Beleg.

---

# **Produktionsreife Architekturen für autonome KI-Agenten-Systeme: Referenzrahmen für ein KI-geführtes Betriebssystem**

## **Kurzfassung: 10 Kernaussagen**

  - Deterministische Workflows übertreffen ungebundene autonome Agenten bei vorhersagbaren Geschäftsprozessen systematisch in Zuverlässigkeit, Latenz und Kosteneffizienz; autonome Schleifen dürfen ausschließlich für offene Problemlösungsräume mit verifizierbarem Feedback-Mechanismus eingesetzt werden \[Fakt\]1.
  - Einzelagenten mit klar voneinander abgegrenzten Werkzeugen skalieren verlässlich bis zu einem Grenzwert von 15 bis 20 Tools; darüber hinaus bricht das Tool-Retrieval ein, was eine modulare Aufteilung in spezialisierte Abteilungsleiter (Heads) unter zentraler Koordination zwingend erforderlich macht \[Fakt\]3.
  - Die Evaluierungsmetrik [F: pass@k] verschleiert systematisch Fehlerhäufigkeiten im produktiven Einsatz; für autonome Geschäftsprozesse ist die Zuverlässigkeitsmetrik [F: pass^k] maßgeblich, welche die Wahrscheinlichkeit misst, dass ein Agent [F: k] aufeinanderfolgende Durchläufe ohne Fehltritt besteht \[Fakt\]5.
  - LLM-as-a-Judge-Pipelines erfordern strikte Gegenmaßnahmen gegen Position Bias und Verbosity Bias; zur Qualitätssicherung müssen Pairwise Swapping und regelmäßige Kalibrierungen gegen menschliche Expertenentscheidungen automatisiert stattfinden \[Fakt\]7.
  - Freigabemüdigkeit bei menschlichen Prüfern (Human-in-the-Loop) wird primär durch asynchrone Bündelung, strukturierte Vorher/Nachher-Diffs und progressive Autonomie verhindert, bei der Aktionen basierend auf ihrer Umkehrbarkeit (Reversibilität) und historischen Annahmequoten freigegeben werden \[Fakt\]4.
  - Das agentische Gedächtnis erfordert eine strikte Trennung von semantisch-faktischen Wissensbasen und episodischen Ausführungshistorien; transiente Kontextkompaktierung und deterministische Grabsteine (Tombstones) sind für die DSGVO-Konformität (Art. 17) unverzichtbar \[Fakt\]9.
  - Indirekte Prompt Injections über unzuverlässige Datenquellen (E-Mails, Dokumente, Web-Inhalte) stellen die primäre Angriffsfläche dar; die einzige architektonisch robuste Abwehr besteht im Dual-LLM-Muster, das untrennbare Daten von unprivilegierten Modellen isoliert verarbeiten lässt \[Fakt\]12.
  - Die Kostenkontrolle erfordert hierarchisches Modell-Routing, strikte Token-Budgets pro Ausführungsintervall und Prompt-Caching mit einer Fünf-Minuten-Gültigkeit (TTL), wodurch die Kosten für wiederkehrende System-Prompts um bis zu 90 Prozent sinken \[Fakt\]9.
  - Vollständige Nachvollziehbarkeit und regulatorische Konformität (EU AI Act, DSGVO) werden über OpenTelemetry-GenAI-Semantikkonventionen sichergestellt, wobei sensible Nutzdaten opt-in in getrennten Ereignissen geführt und Systemzustände über kryptografische Hash-Ketten versiegelt werden \[Fakt\]9.
  - Kontinuierliche Performanzverbesserungen ohne Modellfeintuning werden durch deklarative Prompt-Optimierer (wie DSPy mit MIPROv2 und GEPA) erreicht, die Systeminstruktionen und Demonstrationen über bayesianische Suchverfahren auf Basis echter Nutzerentscheidungen optimieren \[Fakt\]19.

## **Detaillierte Analyse der Architekturfragen**

### **1. Orchestrierungsmuster: Workflows versus Agenten und Multi-Agenten-Topologien**

In der Architektur produktiver generativer Systeme hat sich eine grundlegende Verschiebung vollzogen: Die führenden Forschungslabore und Framework-Entwickler betonen einhellig, dass Komplexität erst dann eingeführt werden darf, wenn einfachere, deterministische Muster nachweislich versagen1. Anthropic differenziert in seiner wegweisenden Architekturübersicht strikt zwischen Workflows und Agenten1. Workflows zeichnen sich dadurch aus, dass Kontrollflüsse, Verzweigungen und Ausführungsreihenfolgen deterministisch im Programmcode fixiert sind1. Sie bieten maximale Vorhersehbarkeit, minimale Latenz, planbare Kosten und klare Verifikationspunkte2. Autonome Agenten hingegen nutzen das Sprachmodell als dynamische Steuerungsinstanz in einer Ausführungsschleife (Thought-Action-Observation-Zyklus), in welcher das Modell eigenständig über Tool-Aufrufe, Pfadkorrekturen und Beendigungsbedingungen entscheidet3. Diese Flexibilität erfordert jedoch ein signifikant höheres Fehlertoleranz- und Risikomanagement, da unkontrollierte Schleifen zu kumulierenden Fehlern, Latenzspitzen und unvorhersehbarem Ausgabeverhalten führen können1.

Anthropic isoliert fünf elementare Workflow-Muster, die in der betrieblichen Praxis vor dem Griff zu autonomen Schleifen evaluiert werden müssen1. Beim *Prompt Chaining* wird ein Problem sequenziell in Teilschritte zerlegt, wobei zwischen den Aufrufen deterministische Validierungsschranken greifen1. Das *Routing*-Muster klassifiziert Anfragen und leitet sie an spezialisierte Prompts oder Modelle weiter1. Die *Parallelisierung* unterteilt sich in *Sectioning*, bei dem unabhängige Subtasks zeitgleich berechnet werden, und *Voting*, bei dem identische Aufgaben redundant von mehreren Modellen gelöst werden, um über Konsensbildung Halluzinationen oder Sicherheitsrisiken zu minimieren1. Beim *Orchestrator-Workers*-Muster analysiert ein zentraler Koordinator die Aufgabenstellung, bricht sie dynamisch auf und delegiert die Teilaufgaben an parallele Worker, deren Ergebnisse er anschließend aggregiert1. Das *Evaluator-Optimizer*-Muster schließlich bildet eine Schleife aus Generierung und formaler Qualitätsprüfung, in der das Feedback eines Prüfmodells genutzt wird, um Entwürfe iterativ nachzubessern1.

OpenAI schließt sich dieser Einschätzung an und empfiehlt, stets mit einem minimalistischen Einzelagenten zu beginnen, der durch eine progressive Anreicherung mit Werkzeugen wächst3. Ein Einzelagent bleibt bis zu einer Obergrenze von 15 bis 20 disjunkten, semantisch scharf abgegrenzten Werkzeugen hochgradig präzise und wartbar4. Sobald jedoch Werkzeuge semantisch überlappen oder die Dokumentation den Prompt überfrachtet, degeneriert die Selektionsgenauigkeit rapide4. An dieser Schwelle empfiehlt OpenAI den Übergang zu Multi-Agenten-Architekturen, wobei zwei primäre Ansätze dominieren: das zentrale *Manager-Muster (Agent-as-a-Tool)* und das dezentrale *Handoff-Muster*3. Im Manager-Muster verbleibt der globale Kontrollfluss bei einem übergeordneten Koordinator, der Sub-Agenten wie Werkzeuge aufruft, deren Antworten synthetisiert und somit den globalen Zustand schützt4. Das Handoff-Muster, wie es ursprünglich im experimentellen Framework *Swarm* implementiert wurde, delegiert die gesamte Prozesshoheit an spezialisierte Routinen via Funktionsaufruf24. Handoffs eignen sich für Dialoge mit klaren Phasenübergängen, führen jedoch bei komplexen Managementaufgaben zu Problemen, da der Gesamtüberblick verloren geht und zirkuläre Delegationen drohen23.

Für Unternehmensplattformen wie die Google Cloud Gemini Enterprise Agent Platform (ehemals Vertex AI Agent Builder) sowie Microsoft und LangChain (LangGraph) stellen supervisor-basierte, hierarchische Multi-Agenten-Netze den Industriestandard dar26. Ein *LangGraph Supervisor* fungiert als zustandsbehafteter Graph, der Fachagenten deterministisch oder heuristisch ansteuert30. Frameworks wie CrewAI strukturieren Systeme nach Rollen und kollaborativen Zielvorgaben, stoßen im hochgradig regulierten Produktivbetrieb jedoch oft an Grenzen, wenn probabilistische Absprachen zwischen Agenten zu intransparentem Kontrollverlust führen32. Für MAKE OS leitet sich daraus die zwingende Empfehlung ab, auf unüberwachte Peer-to-Peer-Multi-Agenten-Netze zu verzichten und stattdessen eine strenge Hierarchie zu etablieren: ZOE fungiert als Chief of Staff (Manager), der als alleinige Schnittstelle zum Menschen dient und spezialisierte Fach-Heads über deterministische Verträge als isolierte Sub-Systeme ansteuert9.

  

| **Orchestrierungsmuster** | **Typische Einsatzbereiche** | **Stärken im Betrieb** | **Kritische Fallstricke** |
| --- | --- | --- | --- |
| **Deterministischer Workflow** (Chain / Routing) | Rechnungsverarbeitung, Datenextraktion, Compliance-Prüfungen | Höchste Vorhersehbarkeit, minimale Latenz, keine Rekursionsgefahr2 | Völlig unflexibel bei unerwarteten Eingabeformaten oder offenen Aufgaben |
| **Einzelagent mit Werkzeugen** | Standard-Kundenservice, fokussierte Fachaufgaben, Datenabfragen | Einfache Evaluation, geringe Latenz, transparenter Zustand3 | Werkzeug-Konfusion ab ~15 Tools; Kontextüberlauf durch Werkzeug-Schemata4 |
| **Supervisor / Hierarchie** (Agent-as-Tool) | Abteilungsleiter-Strukturen, ERP/CRM-Konsolidierung, Monatsabschlüsse | Klare Rollengrenzen, isolierte Kontexte, strikte Governance23 | Erhöhte Gesamtlatenz, Supervisor bildet potenziellen Single Point of Failure |
| **Dezentrale Handoffs** (Swarm) | Mehrstufige Triage-Systeme, Support-Routing mit klaren Schritten | Hohe Modularität, einfache Übergabeschnittstellen24 | Gefahr zirkulärer Weiterleitungen (Ping-Pong), Verlust des globalen Kontexts23 |

### **2. Evaluation von Agentensystemen: Methoden, Metriken und Werkzeuge**

Klassische Softwaretests verifizieren Systeme deterministisch über binäre Behauptungen, während herkömmliche LLM-Evaluationen statistische Maße über unstrukturierte Textausgaben erheben6. Die Evaluation autonomer Agenten erfordert jedoch ein grundlegend neues Paradigma: Da Agenten mehrstufige Entscheidungstrajektorien durchlaufen, Werkzeuge aufrufen, externe Datenbanken modifizieren und über dynamische Pfade dasselbe Ziel erreichen können, reicht die alleinige Bewertung der finalen Textausgabe nicht aus7. Eine unvollständige Prüfung birgt das Risiko, dass ein Agent zwar vordergründig ein korrektes Ergebnis präsentiert, dies jedoch über verbotene Systemoperationen, ineffiziente Schleifen oder eklatante Sicherheitsüberschreitungen erreicht hat7.

Agentische Evaluationssysteme müssen drei komplementäre Dimensionen synchron erfassen7: Erstens die *Outcome Metrics*, die über deterministische Assertions prüfen, ob der angestrebte Zielzustand der Umwelt – etwa eine korrekte Buchungszeile oder ein angelegter Meilenstein – exakt realisiert wurde7. Zweitens die *Trajectory Metrics*, welche die Validität des gesamten Ausführungspfades messen7. Hierbei wird überprüft, ob die Tool-Selektion präzise war, ob verbotene Werkzeuge gemieden wurden, ob die übergebenen Argumente fehlerfrei strukturiert waren und ob die Anzahl der Ausführungsschritte dem Optimum entsprach7. Drittens die *System Metrics*, die den Ressourcenverbrauch quantifizieren, namentlich Token-Verbrauch, Latenzzeiten und die monetären Gesamtkosten pro erfolgreicher Trajektorie7.

Ein zentraler methodischer Durchbruch betrifft die Differenzierung zwischen den Metriken [F: pass@k] und [F: pass^k]5. Die klassische Metrik [F: pass@k] misst die Wahrscheinlichkeit, dass bei [F: k] unabhängigen Generierungsversuchen *mindestens ein* Durchlauf das Kriterium erfüllt5:

[F: pass@k = 1 − C(n−c, k) / C(n, k)]

wobei [F: n] die Gesamtanzahl der Versuche und [F: c] die Anzahl der erfolgreichen Durchläufe abbildet5. Dieser Wert ist nützlich für softwaregestützte Entwicklungsumgebungen, in denen ein menschlicher Programmierer den besten aus mehreren Entwürfen auswählt5. Für autonome Unternehmensagenten im Produktivbetrieb ist diese Metrik jedoch trügerisch und gefährlich, da Endnutzer und Geschäftsprozesse keine [F: k] Versuche zur Auswahl erhalten, sondern auf die fehlerfreie Ausführung jedes einzelnen Taktes angewiesen sind5.

Hier greift die Zuverlässigkeitsmetrik [F: pass^k] (Pass power [F: k]), welche die Wahrscheinlichkeit modelliert, dass ein Agent [F: k] aufeinanderfolgende Aufgaben *ausnahmslos und konsistent* fehlerfrei bewältigt5:

[F: pass^k = (c/n)^k]

Besitzt ein Agent beispielsweise eine nominelle Einzelerfolgsquote von 70 Prozent ([F: c/n = 0,70]), suggeriert [F: pass@3] eine scheinbare Zuverlässigkeit von 97,3 Prozent5. In der betrieblichen Realität bedeutet dies jedoch, dass bei drei aufeinanderfolgenden Ausführungen die Wahrscheinlichkeit eines fehlerfreien Gesamtablaufs ([F: pass^3]) auf desaströse 34,3 Prozent absinkt5. Für produktive Führungsteams müssen daher Schwellenwerte für [F: pass^3] oder [F: pass^5] als harte Release-Gates definiert werden6.

Die Umsetzung automatisierter Prüfungen basiert auf dem Verfahren *LLM-as-a-Judge*, bei dem ein leistungsfähiges Frontier-Modell anhand detaillierter Rubriken die Qualität von Trajektorien bewertet7. Diese Methode skaliert hervorragend, birgt jedoch systematische Schwächen wie *Position Bias* (Präferenz für erstgenannte Optionen) und *Verbosity Bias* (Beurteilung längerer Antworten als qualitativ höherwertig)7. Zur Neutralisierung dieser Verzerrungen verlangen Best-Practice-Pipelines zwingend das *Pairwise Swapping*, bei dem die Reihenfolge der Optionen invertiert und nur bei übereinstimmendem Urteil gewertet wird, sowie die kontinuierliche Kalibrierung des Richtermodells gegen menschliche Gold-Standard-Entscheidungen7.

Im Werkzeugumfeld etablieren sich unterschiedliche Schwerpunkte: Plattformen wie Langfuse und Arize Phoenix zeichnen sich durch quelloffenes Tracing, CI-Konnektoren und tiefe OpenTelemetry-Integration aus; promptfoo bietet schlanke, entwicklerzentrierte Regressionstests auf der Kommandozeile; Braintrust und LangSmith fokussieren sich auf strukturierte Datensatzkuration und experimentelle Auswertung. Für kleine Entwicklungsteams empfiehlt sich ein schlanker dreistufiger Evaluierungsansatz: Deterministische Schema- und Assertion-Tests prüfen bei jedem Git-Commit in Sekunden; eine automatisierte Smoke-Eval mit rund 20 Gold-Standard-Datensätzen blockiert Regressionen bei Pull Requests; und eine periodische Staging-Evaluation auf der Demo-Saat stellt sicher, dass neue Prompts oder Modelle die definierte Schranke von [F: pass^3 ≥ 0,85] auf kritischen Pfaden nicht unterschreiten6.

  

| **Evaluierungsmethode** | **Implementierungsebene** | **Vorteile im Betrieb** | **Nachteile / Grenzen** |
| --- | --- | --- | --- |
| **Deterministische Assertions** | JSON-Schema, Regex, SQL-State, Typenprüfungen | Latenz <10 ms, kostenneutral, absolut reproduzierbar6 | Keine Erfassung semantischer Qualität oder Tonfall |
| **LLM-as-a-Judge** | Prompts mit Rubriken auf starken Modellen7 | Skalierbar, erfasst semantische Nuancen und Urteilsgründe7 | Anfällig für Position/Verbosity Bias; Token-Kosten7 |
| **pass^k Konsistenzlauf** | Mehrfachtests ([F: k = (Wert fehlt im Original)] bis [F: 5]) auf Testdaten6 | Erkennt Prompt-Fragilität und stochastische Ausfälle direkt6 | Vervielfacht Testlaufzeit und API-Kosten |
| **Shadow Mode Execution** | Parallelbetrieb neuer Versionen auf Live-Traffic22 | Maximale Realitätsnähe ohne Fehlerrisiko für Endnutzer22 | Erfordert deterministische Isolierung aller Seiteneffekte |

### **3. Autonomiestufen und menschliche Freigabe (Human-in-the-Loop)**

Die Gewährung von Handlungsspielräumen an KI-Systeme verlangt ein formales Risikomodell, das Handlungsfähigkeit und Haftungssicherheit austariert9. In Analogie zu ingenieurtechnischen Automatisierungsstufen unterteilt sich die Software-Autonomie in sechs klar abgegrenzte Niveaus36: Stufe L0 steht für rein manuelle Ausführung. Auf Stufe L1 agiert die KI assistierend und liefert kontextuelle Formulierungshilfen36. Stufe L2 definiert die überwachte Autonomie (*Supervised Execution*): Die KI analysiert Sachverhalte vollständig autonom, strukturiert Handlungsoptionen und legt einen bindenden Entwurf vor, der erst nach expliziter menschlicher Bestätigung exekutiert wird36. Stufe L3 bezeichnet die bedingte Autonomie (*Conditional Autonomy*): Die KI agiert innerhalb enger, vorab definierter Schwellenwerte eigenständig und eskaliert ausschließlich Ausnahmezustände36. Stufe L4 beschreibt hochgradige Autonomie, in der das System in abgegrenzten Domänen unüberwacht operiert und der Mensch lediglich stichprobenartig eingreift36. Stufe L5 markiert die theoretische Vollautonomie ohne menschliche Eingriffsmöglichkeit36.

Für den Betrieb eines unternehmerischen Führungssystems ist Stufe L2 für alle Prozesse mit irreversibler Außenwirkung der unverhandelbare Standard4. Hierzu zählen rechtsverbindliche Willenserklärungen, das Versenden von E-Mails an Externe, das Ausführen von Finanztransaktionen oder das Verändern von Zugriffsrechten4. Autonomie der Stufe L3 darf ausschließlich auf Aktionen angewendet werden, die rein interner Natur sind und jederzeit deterministisch rückgängig gemacht werden können (Transaktionsumkehrbarkeit), wie das Umsortieren interner Aufgaben oder das Ablegen von Zwischenentwürfen9.

Das zentrale Problem im Dauerbetrieb überwachter Systeme ist die Freigabemüdigkeit (*Approval Fatigue*)10. Werden Führungskräfte kontinuierlich mit isolierten, unstrukturierten Bestätigungsanfragen bombardiert, führt dies zwangsläufig zu kognitiver Überlastung und dem ungesehenen Durchwinken von Aktionen, was den menschlichen Kontrollmechanismus de facto außer Kraft setzt10.

Architektonisch wird dieser Degeneration durch vier strukturierte Muster begegnet: Erstens durch *asynchrone Bündelung (Batching)*: Vorschläge werden nicht synchron aufgeworfen, sondern in festen Rhythmen im Rahmen der Morgen- und Abendzyklen aggregiert vorgelegt9. Zweitens durch *Vorher/Nachher-Diffs mit Auswirkungsanalyse*: Jeder Freigabegegenstand dokumentiert präzise den Ist-Zustand, die geplante Mutation und die kalkulierte Konsequenz eines Nichthandelns9. Drittens durch *Reversibilitäts-Gating*: Interne Aktionen werden mit einer 24-stündigen „Rückgängig“-Frist autonom vollzogen und in einem übersichtlichen Journal visualisiert, wodurch der Freigabestapel von Trivialentscheidungen entlastet wird9. Viertens durch *progressive Autonomie*: Ein Vertrauens-Score aggregiert die historische Annahmequote bestimmter Vorschlagstypen \[Meinung\]. Erreicht ein Vorschlagstyp über 50 Durchläufe hinweg eine fehlerfreie Akzeptanz von über 98 Prozent, schlägt das System proaktiv vor, diesen spezifischen Pfad kontrolliert in Stufe L3 zu überführen \[Meinung\].

### **4. Speicherarchitektur: Kurz- und Langzeitgedächtnis, Vergessen und Datenschutz**

Ein industrietaugliches Agentengedächtnis erfordert die scharfe architektonische Trennung zwischen flüchtigem Arbeitsgedächtnis und persistenten Wissensspeichern2. Das flüchtige Kurzzeitgedächtnis existiert ausschließlich für die Dauer eines Ausführungstaktes im Kontextfenster des Modells2. Mit zunehmender Länge einer Session droht *Context Rot*, ein Phänomen, bei dem die Aufmerksamkeit des Modells für frühe Instruktionen erodiert2. Zur Vermeidung müssen Konversationsverläufe nach Erreichen von Schwellenwerten deterministisch kompaktiert werden, wobei standardisierte Flags wie gen\_ai.conversation.compacted = true die Reduktion kennzeichnen11.

Das Langzeitgedächtnis spaltet sich in zwei funktionale Kategorien: Das *faktisch-semantische Gedächtnis* umfasst zeitlose, verifizierte Fakten über das Unternehmen, Kundenstammdaten und Prozessdefinitionen26. Es wird in relationalen Datenbanken oder isolierten Vektorräumen abgelegt39. Das *episodische Gedächtnis* hingegen dokumentiert historische Ausführungsstränge: Welche Vorschläge wurden unterbreitet? Aus welchen Gründen lehnte die Geschäftsführung ab? Welche messbare Auswirkung hatte eine freigegebene Maßnahme nach 14 Tagen?9.

Die Verwaltung persistenter Speicher unterliegt im europäischen Rechtsraum strengen regulatorischen Vorgaben (DSGVO Art. 17 Recht auf Löschung sowie Art. 5 Grundsatz der Richtigkeit)9. Gelöschte Daten dürfen in Retrieval-Augmented-Generation-Systemen nicht einfach überschrieben werden, da verwaiste Vektoren zu Halluzinationen führen können35. Stattdessen setzt die Speicherarchitektur auf deterministische *Grabsteine (Tombstones)*: Wird ein Kontakt oder eine Information gelöscht, wird ein kryptografisch signierter Lösch-Eintrag persistiert, der bei künftigen semantischen Suchen als strikter Ausschlussfilter greift9.

Zudem muss dem Nutzer die vollständige Hoheit über das Gedächtnis eingeräumt werden: Sämtliche semantisch extrahierten Fakten müssen in einer transparenten Verwaltungsansicht editierbar, korrigierbar und mit einem Klick entfernbar sein9. Eine kritische Sicherheitsregel verbietet das unreflektierte Schreiben externer Inhalte in das Langzeitgedächtnis: Externe E-Mails oder Dokumente dürfen niemals ohne Filterung und Prüfung persistiert werden, da dies das Tor für persistente *Memory-Poisoning-Angriffe* öffnet10.

### **5. Werkzeuge, Protokolle und Sicherheitsarchitektur**

Die Koppelung von Sprachmodellen an Unternehmenssysteme basiert auf standardisierten Schnittstellenprotokollen. Das von Anthropic initiierte *Model Context Protocol (MCP)* hat sich als offener Industriestandard etabliert2. Es abstrahiert Werkzeuge (Tools), lesbare Kontexte (Resources) und vordefinierte Abfragevorlagen (Prompts) über standardisierte Transportschichten: lokale Prozesse kommunizieren effizient über Standard-Ein-/Ausgabe (stdio), während verteilte Cloud-Systeme auf serverseitige Ereignisse (SSE) und streamendes HTTP setzen2. Google flankiert diesen Ansatz mit dem *Agent2Agent (A2A)*-Protokoll, das die sichere Entdeckung, Aushandlung und Ausführung von Aufgaben zwischen autonomen Systemen über Plattformgrenzen hinweg regelt26. Ergänzend bieten die nativen *Function-Calling*-Schnittstellen der Modellhersteller in Verbindung mit strikten JSON-Schemata deterministische Garantien für Typisierung und Argumentenübergabe3.

Die Sicherheitsrisiken vernetzter Agenten werden durch die *OWASP Top 10 for LLM Applications 2025* präzise erfasst35. Die größte Bedrohung für Systeme mit E-Mail- und Webzugriff stellt *LLM01: Prompt Injection* in seiner indirekten Ausprägung dar35. Angreifer platzieren bösartige Instruktionen in eingehenden Rechnungs-PDFs, Support-Mails oder Webseiten, die der Agent autonom analysiert10. Ohne architektonische Isolation interpretiert das Modell diese Daten als neue Handlungsanweisungen, was zur Exfiltration von Betriebsgeheimnissen (*LLM02*) oder unautorisierten Aktionen über privilegierte Werkzeuge (*LLM06: Excessive Agency*) führen kann35.

Die einzig robuste architektonische Abwehr gegen indirekte Prompt Injections ist das *Dual-LLM-Muster*12:

  

| **Systemkomponente** | **Funktionale Verantwortung** | **Berechtigungsraum und Schnittstellen** |
| --- | --- | --- |
| **Privileged LLM** (Planer / Entscheider) | Verarbeitet legitime Systemanweisungen, plant Trajektorien, trifft Entscheidungen12 | Vollzugriff auf Werkzeuge und APIs; liest **niemals** unbereinigte externe Fremddaten12 |
| **Quarantined LLM** (Isolierter Parser) | Liest Fremddaten (E-Mail-Bodies, Webseiten, PDF-Anhänge, Rechnungen)12 | Verfügt über **keinerlei Werkzeugzugriff**; rein textuelle Transformation12 |
| **Schema-Gateway** (Typisierter Filter) | Validiert Extraktionen des Quarantined LLM gegen strikte Zod/JSON-Schemata14 | Übergibt nur validierte strukturierte Daten per Referenz an das Privileged LLM13 |

Flankiert wird dieses Muster durch Microsofts *Spotlighting*-Technik, bei der unzuverlässige Eingaben durch kryptografisch zufällige Begrenzungs-Token umschlossen werden, was die Angriffs-Erfolgsrate in empirischen Studien von über 50 Prozent auf unter 2 Prozent senkt42. Für Code-Ausführungen ist zwingend eine gehärtete Sandbox-Umgebung (z. B. Docker mit gVisor oder Micro-VMs) vorzusehen, die Netzwerkzugriffe blockiert und strikte Laufzeitbeschränkungen erzwingt27.

### **6. Kostensteuerung und Ressourcenmanagement**

Der wirtschaftliche Betrieb autonomer Agenten erfordert präzise Mechanismen zur Begrenzung von Token-Verbrauch und Rechenzeit, um unkontrollierte Kostenexplosionen (*LLM10: Unbounded Consumption*) zu unterbinden35.

Vier architektonische Hebel gewährleisten Budgettreue: Erstens das *hierarchische Modell-Routing*4. Aufgaben werden nach Komplexität klassifiziert: Das schnelle, kostengünstige Tier (z. B. Claude Haiku) übernimmt Routineklassifikationen, Quarantäne-Extraktionen und PII-Filterungen; das ausgewogene Tier (z. B. Claude Sonnet) fungiert als Standard für die Planung und Vorbereitung von Beschlussvorlagen; das Frontier-Tier (z. B. Claude Opus) wird exklusiv für komplexe strategische Synthesen und vielschichtige Konfliktbereinigungen im Führungsteam reserviert9.

Zweitens das *Prompt-Caching*9. Da Systemprompts, Tool-Deklarationen und Mandantenstammdaten bei jedem minütlichen Ausführungstakt redundant übertragen werden, senkt das Caching die Betriebskosten drastisch9. Durch die Platzierung statischer Instruktionen an den Anfang des Prompts und die Nutzung des standardisierten Fünf-Minuten-Ephemeral-Caches werden bis zu 90 Prozent der Eingabetoken-Kosten eingespart, während gleichzeitig die Time-to-First-Token signifikant sinkt15.

Drittens *harte Budgets und Abbruchregeln*9. Jeder Fachabteilungsleiter erhält ein festes monatliches Ausgabenlimit in Euro sowie ein striktes Token-Limit pro Einzellauf9. Sobald ein Head 100 Prozent seines Budgets erreicht, schaltet der Orchestrator das System automatisch auf den deterministischen Grundlauf ohne Modellunterstützung um9. Zur Verhinderung von Endlosschleifen werden harte Schranken erzwungen: maximal fünf Iterationen pro Aufgabe, maximal zehn Werkzeugaufrufe und ein harter Timeout nach 60 Sekunden3.

Viertens die Erhebung der betriebswirtschaftlichen Kennzahl *Kosten pro Ergebnis (Cost per Outcome)*7. Das bloße Messen von Token-Kosten verschleiert Ineffizienzen. Die Kennzahl setzt die Gesamtkosten eines Heads in Beziehung zu den tatsächlich durch den Menschen angenommenen und wirksam gewordenen Vorschlägen:

[F: Cost per Outcome = Gesamtausgaben des Heads im Monat / Anzahl angenommener und wirksamer Entscheidungen]

Steigt dieser Wert über einen definierten Schwellenwert, indiziert dies eine schlechte Treffsicherheit des System-Prompts und löst einen automatischen Evaluierungsalarm aus9.

### **7. Beobachtbarkeit, Tracing und regulatorische Nachweisführung**

Die Nachvollziehbarkeit agentischer Entscheidungen ist sowohl aus ingenieurtechnischer Sicht als auch zur Erfüllung europäischer Compliance-Vorgaben (DSGVO Art. 30 sowie EU AI Act Art. 12 und Art. 50) essenziell9. Proprietäre Tracing-Formate führen zu gefährlichem Vendor Lock-in45. Als herstellerunabhängiger Industriestandard haben sich die *OpenTelemetry GenAI Semantic Conventions* durchgesetzt17.

Das OTel-Schema strukturiert Telemetriedaten unter dem Namensraum gen\_ai.\* und erzwingt eine strenge Trennung zwischen Betriebsmetadaten und Inhalten17:

  

| **Telemetrie-Attribut** | **Funktionale Bedeutung** | **Compliance- und Datenschutz-Vorgabe** |
| --- | --- | --- |
| gen\_ai.operation.name | Identifiziert die Operation (z. B. chat, execute\_tool)17 | Standard-Span-Attribut; enthält keinerlei personenbezogene Daten17 |
| gen\_ai.request.model | Dokumentiert das konkret aufgerufene Sprachmodell11 | Essentiell für Audit-Trails und Provider-Vergleiche17 |
| gen\_ai.usage.input\_tokens / output\_tokens | Präzise Erfassung des Ressourcenverbrauchs17 | Basis für Kostenallokation und Budget-Enforcement17 |
| gen\_ai.tool.name / tool.call.result | Erfasst Werkzeugselektion und Ausführungsergebnisse17 | Tool-Ergebnisse müssen vor dem Logging auf PII bereinigt werden17 |
| gen\_ai.input.messages / output.messages | Speichert vollständige Prompt- und Antworttexte17 | **Opt-In Event**: Darf wegen DSGVO nicht in Standard-Spans indexiert werden11 |

Für MAKE OS wird die OTel-Instrumentierung mit der bewährten lokalen Hash-Kette gekoppelt9. Jeder Agentenlauf erzeugt ein kryptografisch versiegeltes Protokollfragment, das Metadaten, Prüfergebnisse und Freigabestati verkettet9. Bei regulatorischen Audits kann somit lückenlos nachgewiesen werden, zu welchem Zeitpunkt ein Agent auf Basis welcher anonymisierten Eingangsdaten agiert hat9.

Gegenüber dem Anwender visualisiert das System für jeden Vorschlag eine dreiteilige Herleitung (*Provenance*): Erstens die herangezogenen Faktenquellen, zweitens die angewendete Geschäftsregel des Grundlaufs und drittens die modellbasierte Synthesebegründung9.

### **8. Systemzuverlässigkeit, Resilienz und Fehlertoleranz**

Autonome Agenten dürfen bei Ausfällen externer KI-Dienstleister niemals den Kernbetrieb eines Unternehmens blockieren9. Ein stabiles Gesamtsystem basiert auf dem Prinzip der *Graceful Degradation* und setzt auf vier deterministische Resilienzanker9: Das tragende Fundament bildet der *deterministische Grundlauf ohne Modell*9. Jeder Fachabteilungsleiter führt zu Beginn seines Zyklus ein rein statisches Regelwerk aus, das aus den verschlüsselten Datenbeständen Kennzahlen, Fristüberschreitungen und Statusampeln berechnet9. Fällt der Modell-Provider aus, greifen Rate-Limits oder ist das Budget erschöpft, liefert der Grundlauf eine sachliche Basislage ab9. Das Gesamtsystem bleibt zu 100 Prozent verfügbar; es entfällt lediglich die sprachliche Textanreicherung9.

Die Vermeidung von Fehlern bei Wiederholungen erfordert strikte *Idempotenz auf Werkzeugebene*9. Da Netzwerkabbrüche während langer Agentenläufe unvermeidlich sind, generiert jeder Head-Lauf eine eindeutige run\_id9. Ausführende Werkzeuge bilden daraus zusammen mit der Mandanten-ID und dem Werkzeugnamen einen deterministischen Idempotency-Key9. Wird ein Schreibbefehl erneut abgesendet, blockiert die Datenbankschicht die doppelte Ausführung und liefert das Ergebnis des ersten Aufrufs zurück9.

Die Ausführung wird über einen *serverseitigen Taktgeber (Scheduler)* gesteuert, der unabhängig von aktiven Frontend-Sitzungen jede Minute fällige Routinen prüft und Arbeiter-Threads instruiert9. Schließlich regeln *Fehlerbudgets* die dynamische Drosselung: Registriert das Monitoring, dass ein Head über die letzten zehn Läufe eine Erfolgsquote von unter [F: pass^3 = 0,80] aufweist, wird seine Autonomie automatisch auf Stufe L2 zurückgestuft, sodass keinerlei autonome Hintergrundoperationen mehr erfolgen, bis das System neu evaluiert wurde \[Meinung\].

### **9. Kontinuierliches Lernen ohne Modelltraining**

Klassisches Feintuning (Fine-Tuning) von Modellgewichten ist für dynamische Führungssysteme ungeeignet: Es ist kostenintensiv, verlangt große Datenmengen, reagiert träge auf operative Änderungen und führt häufig zu *Catastrophic Forgetting*. Im modernen Agentenbetrieb erfolgt kontinuierliches Lernen nachweislich über zwei alternative Pfade: dynamisches In-Context-Lernen und algorithmische Prompt-Optimierung19.

Beim *dynamischen In-Context-Lernen* nutzt das System die menschlichen Interaktionen am Freigabe-Stapel als unmittelbare Trainingsdaten9. Lehnt die Geschäftsführung einen Entwurf ab, wird der strukturierte Ablehnungsgrund im episodischen Gedächtnis persistiert9. Bei zukünftigen Läufen desselben Heads sucht ein semantischer Index nach thematisch verwandten historischen Ablehnungen sowie nach besonders erfolgreichen Freigaben9. Diese Fälle werden dynamisch als Few-Shot-Demonstrationen in den Prompt-Kontext injiziert, wodurch das Modell lernt, identische Fehler zu vermeiden, ohne dass auch nur ein einziges Modellgewicht modifiziert werden muss9.

Die systematische Weiterentwicklung dieses Ansatzes stellt das Framework *DSPy* (Declarative Self-improving Python) der Stanford University dar19. DSPy bricht mit dem manuellen, intuitiven Prompt-Engineering und behandelt Prompts als optimierbare Programmparameter20. Entwickler deklarieren lediglich Signaturen (z. B. Eingabe- und Ausgabe-Typen), Verarbeitungsmodule und formale Bewertungsmetriken19.

Zur Optimierung stehen moderne Algorithmen bereit19:

  - *MIPROv2 (Multiprompt Instruction Proposal Optimizer):* Führt eine bayesianische Optimierung über den kombinierten Raum von Systeminstruktionen und Few-Shot-Demonstrationen durch, um koordinierte Prompts über mehrere Pipeline-Stufen hinweg zu finden19.
  - *GEPA (Reflective Prompt Evolution):* Nutzt ein zweites Sprachmodell zur Reflexion über Fehlertrajektorien; das Reflexionsmodell analysiert das Scheitern und formuliert gezielte Regelmutationen, die anschließend gegen das Validierungsset evaluiert werden19.

In empirischen Industrieanwendungen (unter anderem bei Dropbox) ermöglicht die DSPy-Kompilierung nachweislich, kleinere und kostengünstigere Modelle auf das Performanzniveau unoptimierter Frontier-Modelle zu heben und die Genauigkeit komplexer Pipelines massiv zu steigern \[Fakt\]21.

### **10. Konkrete Architektur-Empfehlung für den modularen Head-Rahmen**

Für MAKE OS wird die bisherige heterogene Struktur aufgelöst und in eine standardisierte *Head-Rahmen-Fabrik* (lib/heads/rahmen.ts) überführt9. Jeder Abteilungsleiter (Head) – ob bestehend oder neu konzipiert – implementiert eine einheitliche funktionale Schnittstelle9:

  
  
  

TypeScript

export interface HeadDefinition\<TData, TOutput extends z.ZodTypeAny\> {  
  id: 'sales' | 'marketing' | 'finance' | 'it' | 'operations' | 'product' | 'people' | 'strategy';  
  name: string;  
  auftrag: string;  
  kennzahlen: Array\<{ id: string; name: string; berechne: (data: TData) =\> number }\>;  
  datenPaketLader: (mandantId: string) =\> Promise\<TData\>;  
  grundlauf: (data: TData) =\> Promise\<GrundlaufErgebnis\>;  
  quarantaeneParser?: (roheFremddaten: unknown) =\> Promise\<z.infer\<TOutput\>\>;  
  schema: TOutput;  
  autonomieStufe: 'L2\_FREIGABE' | 'L3\_INTERN\_AUTONOM';  
  budgetMonatEur: number;  
  evaluierungsSuite: EvaluierungsFall\[\];  
}  
  

Die fachliche Ausgestaltung der acht Abteilungsleiter im AI-CEO-System folgt einem klaren Rollenprofil9:

| **Abteilungsleiter (Head)** | **Strategischer Kernauftrag** | **Leitkennzahlen** | **Autonom (L3: Intern & Reversibel)** | **Freigabepflichtig (L2: Außenwirkung)** |
| --- | --- | --- | --- | --- |
| **Head of Sales**[cite: 9] | Pipeline-Gesundheit und Abschlussquote steuern | Pipeline-Wert, Win-Rate, Reaktionszeit | Pipeline-Stufen pflegen, Aufgaben zuweisen | Angebote versenden, Kunden anschreiben |
| **Head of Marketing**[cite: 9] | Zielgruppenansprache und Einwilligungen pflegen | DSGVO-Einwilligungen, Inbound-Leads | Kampagnenentwürfe anlegen, Tags pflegen | Newsletter versenden, Posts veröffentlichen |
| **Head of Finance**[cite: 9] | Liquiditätssicherung und Fristenkontrolle | Runway (Monate), Offene Posten, USt-Last | Fristen-Monitoring, Rechnungsabgleich | Überweisungen initiieren, Erklärungen einreichen |
| **Head of IT**[cite: 9] | Systemsicherheit, Integrität und Backups | Server-Ampeln, Backup-Status, Hash-Kette | Nächtliche Integritätsprüfungen, Caches | Server-Updates, Infrastruktur-Neustarts |
| **Head of Operations**[cite: 9] | Reibungslose Abläufe und Terminordnung | Durchlaufzeit, Überfällige Tasks, Inbox-Zero | Aufgaben sortieren, Prioritäten anpassen | Externe Termine buchen/absagen |
| **Head of Product**[cite: 9] | Bauplanfortschritt und Spezifikationsschärfe | Meilenstein-Durchsatz, QA-Fehlerquote | Tickets strukturieren, Doku-Entwürfe | Features freigeben, Roadmap-Prioritäten |
| **Head of People**[cite: 9] | Erhalt der Gründer-Kapazität und Balance | Kapazitätsauslastung, Erholung (Whoop) | Schutzblöcke im Kalender vorschlagen | Private Termine blockieren (nur Vorschlag!) |
| **Head of Strategy**[cite: 9] | Validierung strategischer Wetten und Markt | Wetten-Fortschritt, Signalstärke Markttrends | Recherche-Dossiers erstellen | Strategische Richtungsentscheidungen |

Die Rollout-Strategie erfolgt streng phasenbasiert9: In *Phase 0* werden bestehende Instanzschulden beseitigt (Mandantenneutralität, Entkopplung persönlicher Hardcodierungen)9. In *Phase 1* wird das CEO-Cockpit als visuelle Schaltzentrale über dem Rhythmus-Register etabliert9. In *Phase 2* migrieren Sales, Marketing, Event, Finance und IT auf den neuen Rahmen, gefolgt von der schrittweisen Einführung von Operations, Product, People und Strategy9. In *Phase 3* greift die erweiterte Delegation mit externen Schnittstellen (z. B. Steuerberater)9.

Bewusst weggelassen werden: unüberwachte Peer-to-Peer-Kommunikationsschleifen zwischen Heads, lokale dynamische Code-Ausführung außerhalb sicherer Sandboxen, Modell-Feintuning für dynamische Geschäftslogik und proprietäre Tracing-Silos abseits des OpenTelemetry-Standards17.

## **Risiko- und Gegenmittel-Matrix**

Die folgende Matrix systematisiert die technischen, sicherheitsbezogenen und betriebswirtschaftlichen Risiken für autonome Agentensysteme in der Unternehmenspraxis:

  

| **Risikobereich** | **Konkrete Bedrohung** | **Schadenspotenzial** | **Architektonisches Gegenmittel** |
| --- | --- | --- | --- |
| **Sicherheit** | Indirekte Prompt Injection (OWASP LLM01) über E-Mails oder Webseiten35 | Kompromittierung des Agenten, unautorisierte Datenweitergabe, Systemmanipulation13 | **Dual-LLM-Muster**: Quarantined LLM ohne Werkzeuge extrahiert strukturierte Daten; Microsoft Spotlighting; Zod-Validierung12. |
| **Sicherheit** | Excessive Agency (OWASP LLM06) durch überprivilegierte Werkzeuge35 | Zerstörerische Datenbankoperationen, unautorisierter Versand von Willenserklärungen35 | Strikte Beschränkung externer Aktionen auf **L2-Freigabe-Stapel**; Principle of Least Privilege für MCP-Tools4. |
| **Sicherheit** | Mandantenübergreifender Datenabfluss im Vektorspeicher (OWASP LLM08)35 | Verletzung von Geschäftsgeheimnissen und DSGVO Art. 9/329 | Physisch isolierte SQLite/Vektor-Bestände je Mandant; In-Memory-Vektorindizes auf tmpfs9. |
| **Zuverlässigkeit** | Stille Fehlentscheidungen durch stochastische Modellfluktuation5 | Falsche Finanzberechnungen, invalide Prozessschritte5 | Release-Blockade bei Unterschreiten von [F: pass^3 ≥ 0,85]; deterministische Validierungsprüfer5. |
| **Zuverlässigkeit** | Totalausfall externer Modell-APIs oder Erschöpfung von Kontingenten9 | Vollständiger Stillstand des Führungscockpits und der Unternehmenssteuerung9 | **Deterministischer Grundlauf**: Regelbasierte Engine liefert verlässliche Lageberichte vollkommen ohne KI9. |
| **Zuverlässigkeit** | Unerwünschte Mehrfachausführung von Schreibaktionen nach Netzwerk-Timeouts9 | Doppelte E-Mail-Entwürfe, inkonsistente Transaktionsprotokolle9 | Deterministische Idempotency-Keys (mandantId\_runId\_toolName) für jede schreibende Werkzeugoperation9. |
| **Kosten** | Rekursive Endlosschleifen bei autonomen Werkzeugaufrufen (OWASP LLM10)35 | Rapide Budgeterschöpfung, Blockierung von Arbeiter-Threads35 | Harte Obergrenzen: Maximal 5 Iterationen pro Task; globaler Timeout nach 60 Sekunden3. |
| **Kosten** | Exzessive Token-Kosten durch redundante System-Prompts im Minutentakt9 | Unwirtschaftlicher Betrieb, Margenerosion im SaaS-Modell16 | **Prompt-Caching** (5-Minuten-TTL) für statische Systemteile; 3-Stufen-Modell-Routing (Haiku / Sonnet / Opus)9. |
| **Compliance** | Verletzung von Art. 17 DSGVO durch unvollständige Vektorlöschung9 | Bußgelder nach DSGVO, behördliche Beanstandung9 | Deterministische Grabsteine (*Tombstones*); PII-Pseudonymisierung vor jedem automatisierten Hintergrundlauf9. |

## **Referenz-Architektur für den allgemeinen Head-Rahmen**

Die Architektur des allgemeinen Head-Rahmens transformiert unstrukturierte Systemeingaben über fünf strikt voneinander getrennte Ausführungsschichten in sichere, geprüfte Handlungsvorlagen.

### **Schichtenmodell und Komponentenstruktur**

Die funktionale Gliederung der Schichten stellt sicher, dass zu keinem Zeitpunkt ungesicherte Daten mit privilegierten Ausführungswerkzeugen in Kontakt kommen12:

*Schicht 1: Datenisolierung und Heuristik (Data & Rule Layer)* Der Instanz-Adapter entschlüsselt mandantenspezifische Bestände (AES-256-GCM)9. Vor jeder weiteren Verarbeitung filtert eine Pseudonymisierungsroutine personenbezogene Merkmale9. Parallel führt der *deterministische Grundlauf* ein regelbasiertes Script aus, das fundamentale Kennzahlen, Fristen und Statusampeln ohne jeden Modellaufruf berechnet9.

*Schicht 2: Isolierte Extraktion (Quarantine & Extraction Layer)* Treffen unstrukturierte externe Rohdaten ein (E-Mails, Web-Dokumente, PDF-Anhänge), werden diese an das *Quarantined LLM* übergeben12. Dieses Modell besitzt keinerlei Werkzeugzugriff und operiert unter Spotlighting-Bedingungen12. Ein Schema-Gateway validiert die Antwort streng gegen typisierte Zod-Strukturen und liefert bereinigte Datenobjekte an die nächste Schicht14.

*Schicht 3: Synthese und interne Exekution (Privileged Execution Layer)* Der *Privileged Head Core* aggregiert das bereinigte Datenpaket, die Kennzahlen des Grundlaufs und dynamische Few-Shot-Beispiele aus vergangenem Feedback9. Über Prompt-Caching (5-Minuten-TTL) wird das System-Prompt referenziert15. Aktionen der Stufe L3 (interne, umkehrbare Mutationen) werden direkt über interne Werkzeuge ausgeführt und mit transaktionalen Undo-Protokollen versehen9.

*Schicht 4: Deterministische Validierung und Freigabe (Gate & Approval Layer)* Sämtliche Aktionsentwürfe durchlaufen den *Post-Execution Validator*9. Hier wird verifiziert, ob alle referenzierten Identifikatoren (IDs) in der Datenbank existieren, ob Werbesperren (Art. 21 DSGVO) oder UWG-Richtlinien eingehalten werden9. Besteht der Entwurf die Prüfung, wird er mit strukturierter Vorher/Nachher-Differenz im *Freigabe-Stapel* hinterlegt9.

*Schicht 5: Auditierung und Nachweisführung (Audit & Telemetry Layer)* Jede Operation emittiert standardisierte Spans gemäß OpenTelemetry GenAI Semantic Conventions17. Die Metadaten werden in der lokalen, manipulationssicheren Hash-Kette versiegelt9. Nutzerentscheidungen fließen in das Feedback-Register zur kontinuierlichen Systemoptimierung9.

### **Sequenzieller Verarbeitungs- und Datenfluss**

Der Ausführungspfad eines Abteilungsleiter-Takts vollzieht sich in folgenden Schritten:

1.  Der Server-Ticker initiiert den Lauf eines Heads gemäß Rhythmus-Register9.
2.  Der Instanz-Adapter liest die verschlüsselten Dateien und erzeugt ein pseudonymisiertes Datenpaket9.
3.  Der Grundlauf berechnet deterministische Kennzahlen und Lage-Indikatoren ohne Modellbeteiligung9.
4.  Sofern externe Fremddaten vorliegen, werden diese durch das Quarantined LLM geschleust und via Zod-Schema typisiert13.
5.  Das Privileged LLM erhält das bereinigte Paket, historische Feedback-Beispiele und formuliert Handlungsoptionen9.
6.  Interne reversible Operationen (L3) werden unmittelbar im Datenspeicher exekutiert und mit Undo-Informationen protokolliert9.
7.  Der Post-Execution Validator prüft externe Entwürfe deterministisch auf Halluzinationen, rechtliche Schranken und Schemata9.
8.  Freizugebende Maßnahmen (L2) werden im Freigabe-Stapel mit Vorher/Nachher-Diff für das Führungsteam hinterlegt9.
9.  Alle Ausführungsmetadaten werden als OTel-Spans erfasst und kryptografisch in der Hash-Kette signiert9.

## **Handlungsanweisungen für MAKE OS**

Aus der Synthese der aktuellen Best Practices leiten sich konkrete Prioritäten, Evaluierungsvorgaben und Sicherheitskontrollen für das System MAKE OS ab.

### **Priorisierte Umsetzungsliste**

*Must-Implementierungen (Sofortige Realisierung):*

  - Bereitstellung der generischen Head-Rahmen-Fabrik (lib/heads/rahmen.ts), welche die Ausführungsphasen Datenladen, Grundlauf, Quarantäne, Modell-Planung, Prüfung und Logging vereinheitlicht9.
  - Migration der bestehenden Abteilungsleiter (Sales, Marketing, Event, Finance, IT) auf den neuen Rahmen unter Wahrung vollständiger Regressionstreue9.
  - Implementierung des Dual-LLM-Quarantäne-Musters für sämtliche Schnittstellen, die externe E-Mails, Termineinladungen oder Dokumente verarbeiten12.
  - Einführung konfigurierbarer monatlicher Token- und Kostenbudgets pro Head mit automatischem Fallback auf den deterministischen Grundlauf bei Budgeterschöpfung9.
  - Implementierung der neuen Fach-Heads: Head of Operations (Inbox- und Task-Takt), Head of Product (Bauplan und Spezifikation), Head of People (Balance unter strikter Wahrung von Art. 9 DSGVO) und Head of Strategy (Validierung von Unternehmenswetten)9.

*Should-Implementierungen (Mittelfristige Realisierung):*

  - Restrukturierung aller Prompt-Vorlagen zur optimalen Ausnutzung des 5-Minuten-Prompt-Cachings (statischer Systemteil und Tool-Definitionen am Prompt-Anfang)15.
  - Erweiterung des Freigabe-Stapels um Vorher/Nachher-Diffs und Tracking historischer Annahmequoten zur Vorbereitung progressiver Autonomie9.
  - Standardisierung des internen Metadaten-Loggings auf die OpenTelemetry GenAI Semantic Conventions (gen\_ai.\*) unter partiellem Verzicht auf proprietäre Telemetriestrukturen17.

*Could-Implementierungen (Langfristige Optimierung):*

  - Aufbau einer Offline-Evaluierungs- und Optimierungspipeline mittels DSPy (MIPROv2 / GEPA), um Head-Prompts quartalsweise anhand echter Nutzerentscheidungen automatisiert zu verfeinern19.
  - Bereitstellung eines standardisierten Agent2Agent (A2A)-Konnektors zur kontrollierten Kollaboration mit externen Mandanten-Agenten26.

### **Evaluierungsplan für die Abteilungsleiter**

Die Qualitätssicherung der Heads wird tief in den Software-Lebenszyklus integriert:

*Metriken und Schwellenwerte:* Jeder Head muss vor einem Produktions-Rollout auf einem kuratierten Testset von mindestens 30 Domänenfällen eine Zuverlässigkeit von [F: pass^3 ≥ 0,85] nachweisen5. Für deterministische Prüfungen (Gültigkeit des JSON-Schemas, Abwesenheit halluzinierter IDs, strikte Beachtung von Art. 21 DSGVO Werbesperren) gilt ein Schwellenwert von ausnahmslos 100 Prozent9. Die maximale Pfadlänge wird auf vier Modell-Aufrufe und sechs Tool-Interaktionen begrenzt7.

*Teststufen in der Bereitstellungskette:* Auf Unit-Ebene testen deterministische Assertions die Grundläufe und Validierungsfilter in weniger als 15 Sekunden6. In der CI-Pipeline (Smoke Eval) prüft ein Set von zehn Gold-Standard-Szenarien pro Head gegen günstige Modell-Tiers, ob funktionale Regressionen vorliegen6. Vor dem Upload auf den Produktionsserver führt ein Staging-Lauf auf der Demo-Saat den vollständigen [F: pass^3]-Konsistenztest aus6. Bewertungen via LLM-as-a-Judge müssen obligatorisch mit invertierter Reihenfolge (Pairwise Swapping) durchgeführt werden, um systematische Positionsverzerrungen auszuschließen7.

### **Sicherheits- und Compliance-Checkliste für Produktions-Uploads**

Vor der Aktivierung neuer Heads oder veränderter Prompts müssen folgende Kontrollpunkte auditiert und bestätigt sein:

  - \[ \] Verarbeitet der Head externe E-Mails, Web-Daten oder PDF-Dokumente ausschließlich über das werkzeuglose Quarantined LLM?12
  - \[ \] Sind alle unzuverlässigen Dateninhalte im Prompt durch Spotlighting-Token syntaktisch abgegrenzt?43
  - \[ \] Besitzen alle schreibenden MCP-Tools strikt minimierte Datenbankberechtigungen nach dem Principle of Least Privilege?4
  - \[ \] Sind sämtliche Aktionen mit rechtlicher oder externer Außenwirkung ausnahmslos an den Freigabe-Stapel (Stufe L2) gebunden?4
  - \[ \] Enthält jeder ausgehende schreibende Werkzeugaufruf einen deterministischen Idempotency-Key zur Verhinderung von Doppelausführungen?9
  - \[ \] Liefert der Head bei vollständiger Trennung der externen Modell-API einen validen, ehrlichen Lagebericht aus dem deterministischen Grundlauf?9
  - \[ \] Werden personenbezogene Daten vor der Modellübergabe pseudonymisiert und bleiben Tracing-Spans frei von PII oder Art.-9-Gesundheitsdaten?9
  - \[ \] Sind harte Obergrenzen für Modell-Iterationen (maximal fünf Schleifen) und monatliche Budgetgrenzen technisch scharfgeschaltet?3
  - \[ \] Wird die Ausführungs-Signatur unveränderlich in der kryptografischen Hash-Kette versiegelt?9

#### **Referenzen**

1.  Building Effective AI Agents - Anthropic, <https://www.anthropic.com/engineering/building-effective-agents>
2.  building-effective-agents.md - GitHub, <https://github.com/machinedge/building-effective-agents/blob/main/building-effective-agents.md>
3.  A practical guide to building agents - OpenAI, <https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf>
4.  A practical guide to building agents | OpenAI, <https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/>
5.  Pass@k vs Pass^k: Understanding Agent Reliability - Philschmid, <https://www.philschmid.de/agents-pass-at-k-pass-power-k>
6.  AI Agent Testing vs Evaluation: Key Differences (2026) | Zyrix, <https://zyrix.ai/blogs/ai-agent-testing-vs-evaluation/>
7.  Chapter 8: Agent Evaluation for LLMs: How to Test Tools ... - Medium, <https://medium.com/@vinodkrane/chapter-8-agent-evaluation-for-llms-how-to-test-tools-trajectories-and-llm-as-judge-788f6f3e0d52>
8.  AI Agent Evaluation: What It Is and Why It Matters - Domo, <https://www.domo.com/glossary/ai-agent-evaluation>
9.  AI\_CEO\_MODUL.md
10. LLM Prompt Injection Prevention - OWASP Cheat Sheet Series, <https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html>
11. Semantic conventions for Generative AI events - GitHub, <https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-events.md>
12. Design Patterns for Securing LLM Agents against Prompt Injections, <https://www.alphaxiv.org/overview/2506.08837>
13. Design Patterns for Securing LLM Agents against Prompt Injections, <https://arxiv.org/html/2506.08837v1>
14. Indirect Prompt Injection Defense for AI Agents (2026) | Webemy, <https://webemyengineering.com/insights/indirect-prompt-injection-defense-production-agents/>
15. Claude Prompt Caching Pricing: 5-Min vs 1-Hour Cache (2026), <https://www.respan.ai/articles/claude-prompt-caching>
16. Claude Prompt Caching in 2026: The 5-Minute TTL Change That's, <https://dev.to/whoffagents/claude-prompt-caching-in-2026-the-5-minute-ttl-change-thats-costing-you-money-4363>
17. OpenTelemetry GenAI semantic conventions - Decagon, <https://decagon.ai/glossary/what-are-opentelemetry-genai-semantic-conventions>
18. OpenTelemetry GenAI Semantic Conventions Explained - Dash0, <https://www.dash0.com/knowledge/opentelemetry-genai-semantic-conventions-explained>
19. dspy/docs/docs/learn/optimization/optimizers.md at main - GitHub, <https://github.com/stanfordnlp/dspy/blob/main/docs/docs/learn/optimization/optimizers.md>
20. DSPy vs Prompt Engineering: A New Way to Program Language, <https://ai.plainenglish.io/dspy-vs-prompt-engineering-a-new-way-to-program-language-models-397bfb82e984>
21. GEPA optimization - DSPy, <https://dspy.ai/current/getting-started/gepa-optimization/>
22. https://www.anthropic.com/engineering/building-effective-agents, <https://blog.naitive.cloud/building-effective-agents/>
23. Multi-Agent Portfolio Collaboration with OpenAI Agents SDK, <https://developers.openai.com/cookbook/examples/agents_sdk/multi-agent-portfolio-collaboration/multi_agent_portfolio_collaboration>
24. New OpenAI Swarm Framework Designed to Simplify Multi-Agent AI, <https://www.geeky-gadgets.com/openai-swarm/>
25. Swarm from OpenAI - Routines, Handoffs, and Agents explained, <https://www.ai-bites.net/swarm-from-openai-routines-handoffs-and-agents-explained-with-code/>
26. Vertex AI Agent Builder: Build, Deploy, and Scale AI Agents (2026), <https://leanware.co/insights/vertex-ai-agent-builder>
27. Vertex AI Agent Builder: 2026 guide to Google's ... - UI Bakery, <https://uibakery.io/blog/vertex-ai-agent-builder>
28. langchain/langgraph-supervisor, <https://reference.langchain.com/javascript/langchain-langgraph-supervisor>
29. LangGraph: Multi-Agent Workflows - LangChain, <https://www.langchain.com/blog/langgraph-multi-agent-workflows>
30. Building Multi-Agent Systems with LangGraph-Supervisor, <https://dev.to/sreeni5018/building-multi-agent-systems-with-langgraph-supervisor-138i>
31. Building a Supervisor Multi-Agent System with LangGraph ... - Medium, <https://medium.com/@mnai0377/building-a-supervisor-multi-agent-system-with-langgraph-hierarchical-intelligence-in-action-3e9765af181c>
32. Multi-Agents using CrewAI and OpenAI's Swarm Framework - Medium, <https://medium.com/@shradhacea/multi-agents-using-crewai-and-openais-swarm-framework-fb3df17aaeeb>
33. What Is Agent Evaluation? Tasks and Criteria | Fiddler AI Blog, <https://www.fiddler.ai/blog/what-is-agent-evaluation>
34. Pass@k Metrics for LLM Evaluation - Emergent Mind, <https://www.emergentmind.com/topics/pass-k-metrics-2508a3b6-8dc0-488f-a854-891fb35d80b0>
35. The OWASP Top 10 for LLM Applications - Medium, <https://medium.com/@umesh382.kushwaha/the-owasp-top-10-for-llm-applications-a-complete-guide-with-examples-use-cases-and-fixes-519fad871010>
36. Autonomous AI Agents: Levels, Architecture & Safety - alloq.digital, <https://alloq.digital/en/blog/autonomous-ai-agents/>
37. AI Levels of Autonomy in Software Engineering, <https://blog.jread.com/posts/ai-levels-of-autonomy-in-software-engineering/>
38. OWASP Top 10 for LLM Applications 2025 - DEV Community, <https://dev.to/kuboidsecurelayer/owasp-top-10-for-llm-applications-2025-plain-english-explanation-with-real-examples-2i7f>
39. OWASP Top 10 for LLM Applications (2025): A Practical Guide, <https://www.gravitee.io/blog/owasp-top-10-for-llm-applications-2025-a-practical-guide>
40. Vertex AI Agent Builder: What It Was, What Replaced It - Carly AI, <https://www.usecarly.com/blog/vertex-ai-agent-builder/>
41. Indirect Prompt Injection: Things to Know - JFrog, <https://jfrog.com/learn/ai-security/indirect-prompt-injection/>
42. Defending Against Indirect Prompt Injection Attacks With Spotlighting, <https://arxiv.org/abs/2403.14720>
43. Defending Against Indirect Prompt Injection Attacks With Spotlighting, <https://www.microsoft.com/en-us/research/publication/defending-against-indirect-prompt-injection-attacks-with-spotlighting/>
44. OWASP Top 10 for LLMs (2025 Edition), Explained, <https://aisecurityplatform.com/guides/owasp-llm-top-10-explained/>
45. OpenTelemetry GenAI Semantic Conventions - The Standard for, <https://dev.to/x4nent/opentelemetry-genai-semantic-conventions-the-standard-for-llm-observability-1o2a>
46. How to write semantic conventions | OpenTelemetry, <https://opentelemetry.io/docs/specs/semconv/how-to-write-conventions/>
47. Inside the LLM Call: GenAI Observability with OpenTelemetry, <https://opentelemetry.io/blog/2026/genai-observability/>
48. Gen AI | OpenTelemetry, <https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/>
49. Prompt Optimisation: An Introduction to DSPy - Advancing Analytics, <https://www.advancinganalytics.co.uk/blog/prompt-optimisation-an-introduction-to-dspy>
50. Prompt Optimizer: DSpy Introduction - Medium, <https://medium.com/@nishthakukreti.01/prompt-optimizer-dspy-49a0da7feb91>
51. realArcherL/spotlighting-datamarking - GitHub, <https://github.com/realArcherL/spotlighting-datamarking>
52. Defending Against Indirect Prompt Injection Attacks With Spotlighting, <https://www.alphaxiv.org/abs/2403.14720>
