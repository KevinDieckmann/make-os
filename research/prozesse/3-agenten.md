# Prozesse, Teil 3 von 4: KI-Agenten in Prozessen

Stand: 21.10.2026. Grundlage ist eine Web-Recherche. Jede Quelle trägt ein Datum. Wo eine Seite kein Datum nennt, steht „abgerufen 21.10.2026“. Sekundärquellen (Blogs, Zusammenfassungen) sind als solche gekennzeichnet. Rechtliche Punkte sind Hinweise und keine Rechtsberatung.

Begriffe in diesem Dokument:
- **Schritt:** ein Baustein auf der Prozess-Fläche.
- **Lauf:** eine Ausführung eines Prozesses.
- **Agenten-Schritt:** ein Schritt, in dem ein Modell arbeitet. Das kann ZOE sein, ein Head oder ein Research-, Content-, Prospecting- oder Analyse-Agent.

---

## Erkenntnisse

### A. Grundmuster und Aufbau

#### 1. Erst Workflow, dann Agent
- **Erkenntnis:** Die Fachwelt trennt zwei Bauarten:
  - **Workflows:** Das Modell läuft in fest vorgegebenen Pfaden.
  - **Agenten:** Das Modell steuert Ablauf und Werkzeugwahl selbst.

  Agenten liefern bei offenen Aufgaben bessere Ergebnisse, kosten dafür aber mehr Geld und Zeit. Oft reicht ein einziger, gut gebauter Modellaufruf mit Abruf von Wissen und Beispielen.
- **Wie die Besten es machen:** Anthropic rät, mit der einfachsten Lösung zu beginnen. Komplexität kommt nur dazu, wenn sie messbar mehr bringt. Agenten setzt Anthropic nur ein, wo die Zahl der Schritte nicht vorhersehbar ist, und dann immer mit Abbruchbedingungen wie einer Höchstzahl an Runden. Gartner erwartet, dass bis Ende 2027 über 40 % der Agenten-Projekte eingestellt werden. Die Gründe sind Kosten, unklarer Nutzen und schwache Risikokontrolle. Gartner warnt außerdem vor „Agent-Washing“, also alten Chatbots und RPA-Werkzeugen, die nur als Agenten umetikettiert werden.
- **Bedeutung für MAKE OS:**
  - Die Prozess-Fläche ist im Kern ein Workflow-Editor. Der Agenten-Schritt ist ein Baustein unter mehreren: Regel, Aufgabe, Nachricht, Entscheidung, Erinnerung.
  - Wer einen Agenten-Schritt einsetzt, beantwortet beim Einsetzen kurz „Warum reicht keine Regel?“.
  - Die Heads dürfen beim Aufsetzen ausdrücklich vorschlagen, einen Agenten-Schritt durch eine Regel zu ersetzen.
- **Quellen:**
  - Anthropic, „Building effective agents“, https://www.anthropic.com/engineering/building-effective-agents (19.12.2024, mit späterem Aktualisierungshinweis)
  - Gartner, Pressemitteilung, https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027 (25.06.2025)

#### 2. Sechs Grundmuster ergeben sechs Baustein-Formen
- **Erkenntnis:** Fast alle Agenten-Prozesse setzen sich aus sechs Mustern zusammen:
  1. **Kette:** mehrere Schritte nacheinander, dazwischen programmierte Prüf-Tore.
  2. **Router:** einordnen, dann an einen Spezialisten weitergeben (oder an ein kleines bzw. großes Modell).
  3. **Parallel:** Arbeit aufteilen (Sectioning) oder dieselbe Aufgabe mehrfach lösen und abstimmen lassen (Voting).
  4. **Orchestrator-Worker:** Die Teilaufgaben stehen erst zur Laufzeit fest.
  5. **Evaluator-Optimizer:** erzeugen, bewerten und in einer Schleife verbessern.
  6. **Autonomer Agent.**
- **Wie die Besten es machen:**
  - **LangGraph** bildet alle Muster als Graph ab. Bedingte Kanten sind Router, und mit der Send-API startet man Worker dynamisch.
  - **OpenAI Agent Builder** hatte diese Knoten-Typen: Agent, If/else (Bedingung als Ausdruck), While, Guardrails, User approval, Transform und Set state (globale Variablen).
  - **n8n, Dify, Flowise und Gumloop** bieten ähnliche Knoten.
  - **Gumloop** trennt dabei Agenten (entscheiden, schreiben, einordnen) von Abläufen (bewegen Daten Schritt für Schritt). Ein Agent kann dort ein Schritt in einem Ablauf sein.
- **Bedeutung für MAKE OS:** Die Bausteine der Fläche werden direkt nach den Mustern benannt:

  | Muster | Baustein auf der Fläche |
  |---|---|
  | Kette | Pfeil, optional mit Prüf-Tor |
  | Router | Raute; sichtbar unterschieden, ob eine Regel oder ein Modell entscheidet |
  | Parallel | Gabel |
  | Orchestrator | Head |
  | Evaluator | „Prüfen“, mit Rundenzahl |

  Die Miro-Farben (grün Schritt, gelb Nachricht, Raute, orange Erinnerung) bekommen eine eigene Form für den Agenten-Schritt dazu.
- **Quellen:**
  - Anthropic (wie oben)
  - OpenAI, Node reference, https://developers.openai.com/api/docs/guides/node-reference (abgerufen 21.10.2026)
  - LangChain, „Workflows and agents“, https://docs.langchain.com/oss/python/langgraph/workflows-agents (abgerufen 21.10.2026)
  - Arize, LangGraph-Muster, https://arize.com/docs/phoenix/cookbook/agent-workflow-patterns/langgraph (abgerufen, sekundär)
  - Nocodefounders, „Intro to Gumloop“, https://www.nocodefounders.com/guides/intro-to-gumloop (abgerufen, sekundär)

#### 3. Hybrid: Code bestimmt den Weg, das Modell urteilt
- **Erkenntnis:** Salesforce hat Agentforce umgebaut, allgemein verfügbar seit Februar 2026. Die Aufteilung ist jetzt:
  - **Deterministisch (Code):** Reihenfolge, Bedingungen, Rechnen, Daten holen, Validieren.
  - **LLM:** Einordnen, Urteilen, Text erzeugen.

  Der Grund für den Umbau: Wenn das Modell jeden Schritt selbst entschied, ließen sich die Pfade weder garantieren noch prüfen.
- **Wie die Besten es machen:** Salesforce setzt das mit „Agent Script“ um:
  - Variablen sind typisiert und haben sichere Startwerte, zum Beispiel „Tor zu“.
  - `available when` nimmt eine Aktion aus der Werkzeugliste des Modells, solange die Bedingung falsch ist. Das erzwingt die Plattform, nicht der Prompt.
  - Die Tor-Variable setzt nur Code.
  - Nach der Ausführung wird das Tor wieder geschlossen, damit keine Schleife entsteht.

  Die Leitregel lautet: Alles, was sich als Regel, Schwelle oder Reihenfolge ausdrücken lässt, gehört in Code.
- **Bedeutung für MAKE OS:**
  - Das ist dieselbe Linie wie bei den Heads (Grundlauf/Regelwerk + Modell + Prüfer).
  - Entscheidungs-Bausteine sind standardmäßig Regeln über Felder, Kennzahlen und Status.
  - Eine Modell-Entscheidung ist eine ausdrücklich markierte, eigene Raute.
  - Riskante Werkzeuge werden per Bedingung erst freigeschaltet. Beispiel: „Angebot stellen“ ist erst verfügbar, wenn der Deal in Stufe X ist und eine Freigabe vorliegt.
- **Quellen:**
  - Salesforce Architects, „Hybrid reasoning with Agentforce Builder and Agent Script“, https://architect.salesforce.com/docs/architect/fundamentals/guide/hybrid-reasoning-agentforce-builder-agent-script (Stand 2026, GA Februar 2026)
  - Salesforce Developers Blog, „Agent Script Recipes“, https://developer.salesforce.com/blogs/2025/12/master-hybrid-reasoning-with-the-new-agent-script-recipes-sample-app.html (Dezember 2025)

#### 4. Den Ablauf selbst besitzen, die Fläche ist nur die Sicht darauf
- **Erkenntnis:** Wer seine Prozesse in einem fremden visuellen Builder baut, trägt ein Plattform-Risiko.
  - OpenAI hat am 03.06.2026 angekündigt, Agent Builder einzustellen. Abschaltung ist am 30.11.2026, die Evals-Plattform geht am selben Tag.
  - Laut Community lassen sich Workflows nur exportieren, solange das Dashboard läuft.
  - Der Migrationsweg ist Code (Agents SDK) oder ein anderes OpenAI-Produkt.
- **Wie die Besten es machen:**
  - Anthropic warnt, dass Frameworks Prompts und Antworten hinter Abstraktionen verstecken. Man soll verstehen, was darunter passiert.
  - Die „12-Factor Agents“ von HumanLayer fordern, Prompts, Kontextfenster und Kontrollfluss selbst zu besitzen.
  - Dazu gehören dort auch: den Zustand des Laufs mit den Geschäftsdaten zusammenführen und Starten, Pausieren und Fortsetzen über einfache Schnittstellen anbieten.
- **Bedeutung für MAKE OS:**
  - Die Prozess-Engine lebt im eigenen Code: eigene Bestände, Absichtsprotokoll, Stand/409.
  - Die Fläche ist Editor und Sicht auf ein eigenes Datenmodell aus Knoten, Kanten und Verträgen.
  - Die Modelle bleiben hinter dem KI-Tor austauschbar.
  - Es gibt keine Abhängigkeit von einem externen Builder.
- **Quellen:**
  - OpenAI, Deprecations, https://developers.openai.com/api/docs/deprecations (Ankündigung 03.06.2026)
  - OpenAI Community, „Deprecation notice: Agent Builder“, https://community.openai.com/t/deprecation-notice-agent-builder/1382650 (Juni 2026)
  - HumanLayer, „12-Factor Agents“, https://github.com/humanlayer/12-factor-agents (seit etwa April 2025)
  - Anthropic, „Building effective agents“ (19.12.2024)

#### 5. Orchestrator-Worker nur dort, wo es sich rechnet
- **Erkenntnis:** Das Research-System von Anthropic (ein Lead-Agent plus parallele Sub-Agenten) war bei Recherche deutlich besser als ein einzelner Agent. Es kostet aber viel mehr:
  - Ein Agent verbraucht etwa 4-mal so viele Tokens wie ein Chat.
  - Mehrere Agenten zusammen verbrauchen etwa 15-mal so viele.
  - Allein der Token-Verbrauch erklärt rund 80 % der Leistungsunterschiede.

  Das Muster passt zu Aufgaben, die sich breit aufteilen lassen. Für eng verzahnte Aufgaben passt es schlecht.
- **Wie die Besten es machen:**
  - Der Orchestrator gibt jedem Worker vier Dinge mit: ein klares Ziel, ein Rückgabeformat, Hinweise zu Werkzeugen und Quellen sowie feste Grenzen. Vage Aufträge führten zu doppelter Suche und zu Lücken.
  - Der Aufwand wird im Prompt ausdrücklich an die Schwierigkeit gekoppelt: Eine einfache Frage bekommt einen Agenten mit wenigen Aufrufen.
- **Bedeutung für MAKE OS:**
  - Das Orchestrator-Muster gehört zu Research und Prospecting, zum Beispiel „20 Firmen parallel anreichern“.
  - Für Schreibschritte im Sales-Prozess wird es nicht eingesetzt.
  - Auf der Fläche hat der Worker-Baustein Pflichtfelder: Ziel, Rückgabeformat, Grenzen und eine Höchstzahl an Workern.
- **Quelle:** Anthropic, „How we built our multi-agent research system“, https://www.anthropic.com/engineering/multi-agent-research-system (13.06.2025)

#### 6. Ein Schreiber, viele Berater
- **Erkenntnis:** Agenten, die parallel schreiben, treffen widersprüchliche stille Entscheidungen, und das Ergebnis wird brüchig. Cognition (Devin) berichtet, welche Muster funktionieren: Nur ein Agent schreibt, die anderen lesen, prüfen und beraten.
  - Ein Reviewer mit frischem Kontext findet im Schnitt 2 Fehler pro Pull Request.
  - Ein kleines Modell holt bei harten Fällen ein großes dazu und gibt ihm den vollen Kontext mit.
  - Unstrukturierte Agenten-Schwärme hält Cognition „größtenteils für Ablenkung“.

  Die Fehler-Taxonomie MAST (NeurIPS 2025) bestätigt das. Sie unterscheidet 14 Fehlerarten in 3 Gruppen. Die meisten Ursachen liegen im Systemdesign und in der Abstimmung zwischen Agenten, nicht im Modell selbst.
- **Wie die Besten es machen:** Bei Cognition bleiben Schreibvorgänge auf einem einzigen Strang. Ein Manager zerlegt die Arbeit, Kind-Agenten führen aus, der Manager führt zusammen. Das funktionierte erst nach Nachbesserungen gegen zu detaillierte Manager-Vorgaben und gegen falsche Annahmen über gemeinsamen Zustand.
- **Bedeutung für MAKE OS:**
  - Je Datensatz und Lauf gibt es genau einen schreibenden Schritt. Der Freigabe-Stapel bleibt der einzige Schreibweg für Agenten.
  - Analyse-Agenten und Heads beraten nur.
  - Der Editor warnt, wenn zwei parallele Äste dieselbe Akte ändern wollen.
- **Quellen:**
  - Cognition, „Multi-Agents: What's Actually Working“, https://cognition.com/blog/multi-agents-working (22.04.2026)
  - Cognition, „Don't Build Multi-Agents“ (Juni 2025). Zusammenfassung: https://jxnl.co/writing/2025/09/11/why-cognition-does-not-use-multi-agent-systems/ (11.09.2025, sekundär)
  - Cemri et al., „Why Do Multi-Agent LLM Systems Fail?“, https://arxiv.org/abs/2503.13657 (März 2025, NeurIPS 2025)

#### 7. Evaluator-Optimizer: Prüfer mit frischem Blick und begrenzten Runden
- **Erkenntnis:** Eine Schleife aus Erzeugen und Bewerten lohnt sich, wenn die Kriterien klar sind und eine weitere Runde messbar hilft. Ein Prüfer arbeitet besser, wenn er nur das Ergebnis und die Kriterien sieht, statt den langen Verlauf des Erzeugers. Ohne Filter führt Kritik zu Endlosschleifen und zu Arbeit außerhalb des Auftrags.
- **Wie die Besten es machen:**
  - Anthropic stellt Rezepte bereit, zum Beispiel Code-Erzeuger plus Code-Prüfer.
  - Bei Cognition prüft der Reviewer nur den Diff. Der Erzeuger gleicht die Befunde mit dem ursprünglichen Auftrag ab.
  - CrewAI hängt Guardrails an Tasks. Eine Prüffunktion bewertet die Ausgabe, gibt bei einem Fehler Rückmeldung, und der Task wird wiederholt.
- **Bedeutung für MAKE OS:**
  - Der Baustein „Prüfen“ hat eine Rubrik, ähnlich der Qualitätsrubrik der Heads, und eine Rundengrenze. Vorgabe ist 1 Korrekturrunde, wie heute.
  - Danach übernimmt das Regelwerk oder ein Mensch.
  - Der Prüfer bekommt nur das Ergebnis, die Kriterien und die Belege.
- **Quellen:**
  - Anthropic, „Building effective agents“ (19.12.2024)
  - Cognition (22.04.2026)
  - CrewAI, Production Architecture, https://docs.crewai.com/en/concepts/production-architecture (v1.15.x, abgerufen 21.10.2026)

### B. Übergaben und Verträge

#### 8. Typisierte Verträge zwischen Schritten
- **Erkenntnis:** Strukturierte Ein- und Ausgaben sind bei den führenden Werkzeugen Standard. Freitext zwischen Agenten führt zu Parse-Fehlern und Missverständnissen.
- **Wie die Besten es machen:**
  - **CrewAI** empfiehlt `output_pydantic`/`output_json` zwischen Tasks. In Flows ist der Zustand ein typisiertes Pydantic-Modell. Flows steuern, Crews arbeiten.
  - **MCP (Spezifikation 2025-11-25)** kennt ein `outputSchema`. Server müssen konforme Ergebnisse liefern, Clients sollen sie prüfen.
  - **Microsoft Agent Framework** arbeitet mit stark typisierten Nachrichten zwischen den Knoten.
  - **12-Factor Agents** sehen Werkzeugaufrufe als nichts anderes als strukturierte Ausgaben.
- **Bedeutung für MAKE OS:**
  - Jeder Agenten-Schritt deklariert ein Eingabe- und ein Ausgabe-Schema: Felder, Typen, Pflichtangaben.
  - Der Server prüft vor jeder Übergabe. Ist das Ergebnis ungültig, folgt eine Korrekturrunde, danach der Fehler-Ast.
  - Auf der Fläche zeigt jede Kante, was fließt, etwa „Lead + Score + Begründung“.
  - Übergeben werden Kennungen (Kontakt `c-…`, Deal), kein Freitext.
- **Quellen:**
  - CrewAI, Production Architecture (wie oben)
  - MCP-Spezifikation, Tools, https://modelcontextprotocol.io/specification/2025-11-25/server/tools (25.11.2025)
  - Microsoft Learn, Agent Framework Workflows/Checkpoints, https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints (abgerufen 21.10.2026)
  - HumanLayer, „12-Factor Agents“ (2025)

#### 9. Übergabe: eine schlanke Referenz und bewusst gewählter Kontext
- **Erkenntnis:** Bei Übergaben drohen zwei Gefahren:
  - **Stille Post:** Wenn der Orchestrator zusammenfasst, gehen Informationen verloren.
  - **Kontextfäule:** Je mehr im Kontext steht, desto schlechter erinnert sich das Modell.

  Die Gegenmittel:
  - Worker legen ihr Ergebnis als Artefakt in einem Speicher ab und geben nur einen Verweis zurück.
  - Sub-Agenten liefern verdichtete Zusammenfassungen von etwa 1.000 bis 2.000 Tokens.
  - Daten werden erst bei Bedarf über Referenzen geladen (Just-in-time-Abruf).
- **Wie die Besten es machen:** Das OpenAI Agents SDK trennt drei Dinge sauber:
  - **App-Kontext:** Zustand und Abhängigkeiten, nicht im Prompt.
  - **`input_type`:** kleine Metadaten bei der Übergabe, etwa Grund, Priorität oder Sprache.
  - **`input_filter`:** welcher Verlauf beim nächsten Agenten ankommt.

  Wichtig: Die Doku sagt ausdrücklich, dass diese Filter keine sensiblen Daten schwärzen.
- **Bedeutung für MAKE OS:**
  - Ein Übergabe-Objekt je Kante enthält Kennungen, eine Kurzfassung und einen Verweis auf das Artefakt im Lauf-Speicher.
  - Ganze Mails oder Verläufe werden nie weitergereicht.
  - Datenschutz bleibt Sache des KI-Tors (Kategorien, Pseudonymisierung), nicht der Übergabe-Filter.
- **Quellen:**
  - Anthropic, Multi-Agent-Research (13.06.2025)
  - Anthropic, „Effective context engineering for AI agents“, https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents (29.09.2025)
  - OpenAI Agents SDK, Handoffs, https://openai.github.io/openai-agents-python/handoffs/ (abgerufen 21.10.2026)

#### 10. Werkzeuge sind die eigentliche Schnittstelle des Agenten
- **Erkenntnis:** Wie zuverlässig ein Agent arbeitet, hängt stärker an seinen Werkzeugen als am Prompt. Bei der SWE-bench-Arbeit steckte Anthropic mehr Zeit in Werkzeuge als in den Gesamt-Prompt.
- **Wie die Besten es machen:** Anthropic empfiehlt:
  - wenige gebündelte Werkzeuge statt einer Hülle um jeden API-Endpunkt;
  - Namensräume, etwa `asana_search` und `asana_projects_search`;
  - lesbare Namen statt UUIDs;
  - einen Parameter für kurze oder ausführliche Antworten;
  - Paginierung und Kürzung mit sinnvollen Vorgaben;
  - Fehlermeldungen, die sagen, wie der Aufruf richtig geht;
  - eindeutige Parameternamen;
  - Parameter, die Fehler schwer machen („poka-yoke“).

  MCP sieht vor, dass Ausführungsfehler ans Modell zurückgehen, damit es sich selbst korrigieren kann.
- **Bedeutung für MAKE OS:**
  - Agenten-Schritte nutzen dieselben kuratierten Werkzeug-Sätze wie ZOE (`crm_…`, `finanz_…`, `kalender_…`). Es gibt keine zweite Werkzeugwelt für Prozesse.
  - Antworten kommen gekapselt (`fremd()`) und mit Kennungen plus Namen.
  - Parameter sind so geschnitten, dass Fehler schwer sind, zum Beispiel ein Datum immer als Berliner Tag.
- **Quellen:**
  - Anthropic, „Writing effective tools for agents“, https://www.anthropic.com/engineering/writing-tools-for-agents (11.09.2025)
  - MCP-Spezifikation (25.11.2025)
  - Anthropic, „Building effective agents“ (19.12.2024)

### C. Mensch im Ablauf (Human-in-the-loop)

#### 11. Die Freigabe ist ein eigener Baustein, mit Ästen, Feldern und Zeitlimit
- **Erkenntnis:** Bei allen führenden Werkzeugen ist die menschliche Freigabe ein eigener Knoten im Ablauf, keine Nebenfunktion.
- **Wie die Besten es machen:**
  - **OpenAI Agent Builder:** Knoten „User/Human approval“, zum Beispiel vor einem Mailversand.
  - **Dify, Human-Input-Knoten (v1.13.0, März 2026):**
    - Formular mit Markdown und Variablen; vorbefüllte Felder wie ein KI-Entwurf lassen sich bearbeiten.
    - Die Knöpfe sind frei benannt, und jeder Knopf ist ein eigener Ast.
    - Für das Zeitlimit gibt es einen eigenen Ast (Vorgabe 3 Tage).
    - Zustellung über Web-App oder E-Mail.
  - **Microsoft Copilot Studio:** „Request for information“ (Preview August 2025) fragt fehlende Angaben ab. Dazu kommen mehrstufige Freigaben mit Bedingungen zwischen den Stufen (Preview Mai 2025).
  - **CrewAI, `@human_feedback`:** Ein Modell ordnet freie Rückmeldung festen Ausgängen zu, etwa freigegeben / abgelehnt / überarbeiten.
- **Bedeutung für MAKE OS:** Der Freigabe-Baustein hat:
  - eine Vorschau des Ergebnisses;
  - bearbeitbare Felder („Ändern & freigeben“);
  - frei definierte Ausgänge als Äste, zum Beispiel Freigeben / Überarbeiten mit Hinweis / Ablehnen mit Grund;
  - Zuständigkeit (Person oder Rolle);
  - eine Frist mit eigenem Ast für „keine Antwort“ (Erinnerung, Weitergabe).

  Freigaben laufen im vorhandenen Stapel und in der Glocke auf. Ein zweites Postfach gibt es nicht.
- **Quellen:**
  - OpenAI, Node reference (abgerufen 21.10.2026)
  - Dify Blog, https://www.dify.ai/blog/the-human-input-node-bringing-human-judgment-into-automated-workflows (03.03.2026)
  - Microsoft Copilot Blog, https://www.microsoft.com/en-us/microsoft-copilot/blog/copilot-studio/build-advanced-approvals-in-agent-flows/ (08.05.2025)
  - Microsoft Message Center MC1163768, über https://www.itelio.com/en/microsoft-message-center/MC1163768 (August 2025)
  - CrewAI, Human Feedback in Flows, https://docs.crewai.com/en/learn/human-feedback-in-flows (ab v1.8.0, abgerufen 21.10.2026)

#### 12. Freigabe am Werkzeug, nicht am ganzen Agenten
- **Erkenntnis:** Gute Systeme sperren gezielt die riskanten Werkzeuge und nicht den ganzen Agenten. So bleibt Routinearbeit schnell, und nur gefährliche Aufrufe warten.
- **Wie die Besten es machen:**
  - **n8n:** Human Review je Werkzeug am AI-Agent-Knoten.
    - Der Prüfer sieht den Werkzeugnamen und die gewählten Parameter.
    - Bei Ablehnung entfällt der Aufruf, und der Agent erfährt davon.
    - Das Ablehnungsverhalten soll man im Systemprompt beschreiben.
  - **Relevance AI:** Einstellung je Kante (Agent → Werkzeug oder Agent → Agent) mit drei Optionen:
    - Auto run, mit Obergrenze „Max auto runs“;
    - Approval required;
    - „Let agent decide“.
  - **Lindy:** „Ask for confirmation“ je Aktion.
  - **HubSpot/Sinch:** Die SMS-Aktion verlangt standardmäßig eine Freigabe und zeigt dabei exakten Text, Nummer und Absender.
- **Bedeutung für MAKE OS:**
  - Die Risikoklasse je Werkzeug (frei oder Freigabe) gibt es im ZOE-Register schon.
  - Im Prozess wird sie an der Kante bzw. am Werkzeug sichtbar, als Schloss-Symbol.
  - Die Freigabe zeigt den konkreten Aufruf (Empfänger, Text, Betrag), keine Zusammenfassung.
  - „Agent entscheidet“ gibt es nur für interne, umkehrbare Aktionen.
- **Quellen:**
  - n8n Docs, https://docs.n8n.io/advanced-ai/human-in-the-loop-tools (abgerufen 21.10.2026)
  - Relevance AI Docs, https://relevanceai.com/docs/build/workforces/workforce-features/approvals-and-escalations (abgerufen 21.10.2026)
  - Lindy Docs, https://docs.lindy.ai/testing/human-in-the-loop (abgerufen 21.10.2026)
  - Sinch, https://sinch.com/engage/product-updates/let-your-hubspot-breeze-agents-text-for-you/ (abgerufen 21.10.2026)

#### 13. Pausieren muss dauerhaft sein, und nach der Freigabe wird neu geprüft
- **Erkenntnis:** Eine Freigabe kann Stunden oder Tage dauern. Der Lauf muss das unbeschadet überstehen. Und was zum Zeitpunkt des Vorschlags galt, kann bei der Freigabe schon veraltet sein.
- **Wie die Besten es machen:**
  - **LangGraph:** `interrupt()` speichert den Zustand über einen Checkpointer (produktiv in einer Datenbank) und wartet unbegrenzt. Fortgesetzt wird über die Thread-Kennung. Derselbe Mechanismus erlaubt Zeitreise und Fehlertoleranz.
  - **OpenAI Agents SDK:**
    - Der Lauf hält vor einem freigabepflichtigen Werkzeug an und wird aus einem gespeicherten RunState fortgesetzt.
    - Die Eingabeprüfungen laufen standardmäßig erst nach der Freigabe, direkt vor der Ausführung.
    - Optional laufen sie zusätzlich davor; zeitkritische Prüfungen werden dann erneut ausgeführt.
  - **Microsoft Agent Framework:** Ein Checkpoint enthält auch offene Anfragen und einen Fingerabdruck des Graphen. So erkennt das System, wenn der Graph beim Fortsetzen geändert wurde.
  - **Anthropic:** dauerhafte Ausführung; nach einem Fehler geht es an der Fehlerstelle weiter.
- **Bedeutung für MAKE OS:**
  - Der Lauf-Zustand liegt im eigenen Bestand, nach dem Muster des Absichtsprotokolls.
  - Nach jeder Freigabe werden Vorbedingungen und Stand neu geprüft, wie heute bei der ZOE-Freigabe (`_stand` → 409 mit Diff).
  - Hat sich die Prozessversion inzwischen geändert, wird das erkannt und nachgefragt.
- **Quellen:**
  - LangChain, LangGraph Human-in-the-loop, https://docs.langchain.com/oss/python/langgraph/human-in-the-loop (abgerufen 21.10.2026)
  - OpenAI Agents SDK, Running agents, https://openai.github.io/openai-agents-python/running_agents/ (abgerufen 21.10.2026)
  - Microsoft Learn, Agent Framework Checkpoints (abgerufen 21.10.2026)
  - R. Chaganti, https://ravichaganti.com/blog/visualizing-and-checkpointing-workflows-in-microsoft-agent-framework/ (abgerufen, sekundär)
  - Anthropic, Multi-Agent-Research (13.06.2025)

#### 14. Konfidenz-Schwellen nicht auf die Selbstauskunft des Modells bauen
- **Erkenntnis:** Wenn ein Modell selbst sagt, wie sicher es ist, ist dieser Wert nachweislich schlecht kalibriert: hohe Zuversicht trotz niedriger Trefferquote. In Ketten aus mehreren Agenten verstärkt sich der Fehler.
- **Wie die Besten es machen:** Die Eskalation hängt an prüfbaren Signalen.
  - **HubSpot Customer Agent:**
    - Er antwortet nur, wenn er eine belegbare Quelle hat; sonst fragt er nach.
    - Klappt das nicht, übergibt er an einen Menschen.
    - Dazu kommen feste Auslöser: Der Kunde will einen Menschen, oder Stichworte wie Kündigung oder Erstattung fallen.
  - **OpenAI-Leitfaden:** Eskalation bei Fehlerschwellen (mehrere gescheiterte Versuche) und vor riskanten oder unumkehrbaren Aktionen.
  - **Smashing Magazine:** Konfidenz soll man nur anzeigen, wenn sie gegen echte Annahmen kalibriert ist.
- **Bedeutung für MAKE OS:** „Konfidenz“ ist in MAKE OS ein berechneter Wert aus prüfbaren Signalen:
  - Hat der Prüfer bestanden?
  - Gibt es Belege (wie `belege.ts` bei den Heads)?
  - Sind sich Regelwerk und Modell einig?
  - Sind die Pflichtfelder gefüllt?
  - Wie hoch war die bisherige Annahmequote dieser Vorschlagsart (`lernen.ts`)?

  Jeder Schritt hat eine Schwelle. Liegt der Wert darunter, geht der Vorschlag in die Freigabe bzw. an einen Menschen.
- **Quellen:**
  - „Calibrating Verbalized Confidence with Self-Generated Distractors“, https://arxiv.org/abs/2509.25532 (September 2025, ICLR 2026)
  - tianpan.co, https://tianpan.co/blog/2026-04-20-llm-calibration-production-overconfidence (20.04.2026, Praxisblog, Rechenbeispiel)
  - HubSpot Knowledge Base, https://knowledge.hubspot.com/customer-agent/understand-the-customer-agent und https://knowledge.hubspot.com/customer-agent/set-up-and-customize-the-customer-agents-handoff-process (aktualisiert 16.03.2026)
  - OpenAI, „A practical guide to building agents“, https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf (April 2025)
  - Maginative, Zusammenfassung des Leitfadens, https://www.maginative.com/article/how-to-build-ai-agents-a-detailed-practical-guide-from-openai/ (sekundär)

#### 15. Autonomie wird verdient, und sie kann wieder entzogen werden
- **Erkenntnis:** In der Praxis hat sich eine Stufenleiter durchgesetzt, festgelegt je Aufgabentyp:
  1. **Schatten:** Der Agent entscheidet, nichts wird ausgeführt. Seine Entscheidung wird mit der des Menschen verglichen.
  2. **Vorschlag.**
  3. **Ausführen mit Bestätigung.**
  4. **Selbstständig.**

  Die Stufe geht auch wieder zurück, etwa bei einem Modellwechsel, einer Prompt-Änderung oder wenn sich die Anfragen verändern.
- **Wie die Besten es machen:**
  - n8n, Lindy und HubSpot (Prospecting-Agent im Prüfmodus) empfehlen alle, mit Prüfung zu starten und Freigaben schrittweise abzubauen.
  - Smashing Magazine beschreibt einen „Autonomie-Regler“ je Aufgabentyp und nennt Richtwerte:
    - Rücknahmequote über 5 % → Automatik für diese Aufgabe abschalten.
    - Eine gesunde Eskalationsquote liegt bei 5–15 %.
- **Bedeutung für MAKE OS:**
  - Jeder Agenten-Schritt hat eine Autonomie-Stufe als Feld: Beobachten · Vorschlagen · Mit Freigabe · Selbst (nur intern).
  - Aufsteigen geht nur mit Nachweis, also Annahmequote und pass^k.
  - Zurückgestuft wird automatisch, wenn Ablehnungen oder Rücknahmen steigen oder das Modell wechselt.
  - Nach außen bleibt immer ein Klick (eiserne Regel). Die höchste Stufe gilt nur für interne, umkehrbare Aktionen.
- **Quellen:**
  - urandom.io, „Shadow Mode for Agentic AI“, https://urandom.io/blog/2026-03-02-shadow-mode-for-agentic-ai (02.03.2026, Praxisblog)
  - Smashing Magazine, „Designing For Agentic AI“, https://smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/ (11.02.2026)
  - n8n Docs, Lindy Docs (wie oben)
  - New Breed, https://www.newbreedrevenue.com/blog/how-to-choose-hubspot-breeze-agents (abgerufen 21.10.2026, sekundär)

#### 16. Freigabe-Müdigkeit ist ein echtes Risiko
- **Erkenntnis:** Zu viele Rückfragen führen dazu, dass Menschen blind durchklicken. Dann gibt es nur noch den Anschein von Aufsicht. Meta nennt genau das als Grenze seiner eigenen Sicherheitsregel. Auch die Kommentare zu CaMeL und die Praxisberichte zum Schattenmodus beschreiben es: Staut sich die Warteschlange, wird abgenickt.
- **Wie die Besten es machen:**
  - Reibung wird nach Risiko gestaffelt: Niedriges wird nur protokolliert, Hohes wird gesperrt.
  - Microsoft Research setzt bei Magentic-UI auf gemeinsames Planen. Der Plan wird vorab bearbeitet und einmal freigegeben.
  - Einzelne Aktionswächter gibt es nur vor unumkehrbaren Schritten, und wie oft sie fragen, ist einstellbar.
- **Bedeutung für MAKE OS:**
  - Zu Beginn eines Laufs steht eine Plan-Freigabe („Das wird passieren: …“).
  - Einzelfreigaben gibt es nur vor externen oder unumkehrbaren Schritten.
  - Die Sammelfreigabe bleibt auf risikoarme Fälle beschränkt, wie heute.
  - Warnsignal im Lagebild: Wie oft wurde etwas in unter 3 Sekunden freigegeben, ohne es zu öffnen?
- **Quellen:**
  - Meta AI, „Agents Rule of Two“, https://ai.meta.com/blog/practical-ai-agent-security/ (31.10.2025)
  - Microsoft Research, Magentic-UI, https://www.microsoft.com/en-us/research/blog/magentic-ui-an-experimental-human-centered-web-agent (19.05.2025)
  - urandom.io (02.03.2026)
  - SSOJet, CaMeL-Kommentar, https://ssojet.com/blog/camel-a-robust-defense-against-llm-prompt-injection-attacks (abgerufen, sekundär)

### D. Rechte und Sicherheit

#### 17. Least Agency statt nur Least Privilege
- **Erkenntnis:** Die „OWASP Top 10 for Agentic Applications 2026“ (veröffentlicht 09.12.2025) stellen zwei Grundprinzipien voran: „Least Agency“ und Beobachtbarkeit. Least Agency begrenzt mehr als Zugriffsrechte. Es begrenzt auch, was ein Agent entscheiden, aufrufen und dauerhaft speichern darf.
- **Wie die Besten es machen:** Die Liste benennt unter anderem:
  - ASI01 Zielentführung (Agent Goal Hijack);
  - ASI02 Werkzeugmissbrauch;
  - ASI03 Identitäts- und Rechtemissbrauch;
  - ASI10 außer Kontrolle geratene Agenten.

  Ein häufiges Beispiel: Ein Agent, der Dokumente zusammenfasst, darf keine Mails senden.
- **Bedeutung für MAKE OS:**
  - Jeder Agenten-Schritt hat ein Rechte-Profil: Lesebereiche (CRM, Finanzen …), nur die nötigen Werkzeuge, Speichern ja/nein, Zeitfenster.
  - Der Agent handelt immer als die Person, die den Lauf ausgelöst hat (Regel 5), und nie mit mehr Rechten als sie.
  - Business-Prozesse bekommen serverseitig nichts aus dem Privatbereich.
  - Der Editor zeigt das Rechte-Profil direkt am Knoten.
- **Quellen:**
  - OWASP GenAI Security Project, https://genai.owasp.org (09.12.2025)
  - HUMAN Security, https://www.humansecurity.com/learn/blog/owasp-top-10-agentic-applications/ (Dezember 2025, sekundär)
  - Auth0, https://auth0.com/blog/owasp-top-10-agentic-applications-lessons/ (abgerufen, sekundär)
  - NHI Mgmt Group, Glossar „Least Agency“, https://nhimg.org/glossary/least-agency/ (abgerufen, sekundär)

#### 18. Das „tödliche Dreieck“ und die „Rule of Two“ als Prüfregel im Editor
- **Erkenntnis:** Simon Willison nennt drei Fähigkeiten, die zusammen gefährlich sind:
  - Zugriff auf private Daten;
  - Kontakt mit nicht vertrauenswürdigen Inhalten;
  - die Möglichkeit, nach außen zu kommunizieren.

  Hat ein Agent alle drei, lässt er sich zum Datenabfluss bringen. Meta formuliert daraus die „Rule of Two“: In einer Sitzung höchstens zwei dieser drei Eigenschaften. Braucht eine Aufgabe alle drei, darf der Agent nicht autonom arbeiten.
- **Wie die Besten es machen:** Meta sieht die Regel als Ergänzung zu Least Privilege, nicht als Ersatz. Willison kritisiert, dass auch zwei Eigenschaften schaden können, etwa fremder Input plus Zustandsänderung.
- **Bedeutung für MAKE OS:** Der Prozess-Editor prüft die drei Eigenschaften je Schritt und je Lauf-Abschnitt und zeigt eine Ampel:
  - **Fremder Inhalt:** Daten, die durch `fremd()` laufen.
  - **Private Daten:** Kategorien des KI-Tors.
  - **Nach außen:** Werkzeug sendet oder schreibt extern.

  Sind alle drei erfüllt, ist die Freigabe Pflicht und nicht abschaltbar. Wer zwischen „fremde Daten lesen“ und „handeln“ einen neuen Kontext setzt, bricht das Dreieck auf.
- **Quellen:**
  - Simon Willison, „The lethal trifecta“, https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ (16.06.2025)
  - Meta AI, „Agents Rule of Two“ (31.10.2025)
  - Simon Willison, „New prompt injection papers“, https://simonw.substack.com/p/new-prompt-injection-papers-agents (November 2025)

#### 19. Fremder Text darf Inhalte beeinflussen, aber nie den Weg
- **Erkenntnis:** Prompt-Injection gilt als nicht vollständig lösbar. OpenAI hat das im Dezember 2025 für seinen Browser-Agenten Atlas selbst eingeräumt. Robuste Ansätze begrenzen deshalb den möglichen Schaden über die Architektur.
- **Wie die Besten es machen:**
  - **Plan-then-Execute:** Die Kette der Werkzeugaufrufe steht fest, bevor fremder Inhalt gelesen wird. Der Text einer Mail kann verdorben werden, der Empfänger nicht.
  - **Action-Selector:** Es gibt keine Rückkopplung von Werkzeug-Ergebnissen ins Modell.
  - **Dual-LLM / CaMeL:**
    - Ein privilegiertes Modell plant, ohne fremde Daten zu sehen.
    - Ein isoliertes Modell liest das Fremde, hat aber keine Werkzeuge.
    - Werte tragen Herkunftsmarken.
    - CaMeL löste 77 % der Aufgaben mit beweisbarer Sicherheit, gegenüber 84 % ohne Schutz (Benchmark AgentDojo).
- **Bedeutung für MAKE OS:**
  - Ein von Kevin gezeichneter Prozess ist von Natur aus Plan-then-Execute. Das ist ein Sicherheitsvorteil, den man bewahren sollte.
  - Rauten, die auf fremdem Text entscheiden (z. B. Mail-Klassifikation), führen nur in ungefährliche Äste oder brauchen eine Freigabe.
  - Empfänger, Beträge und Ziele kommen aus Stammdaten, nie aus fremdem Text.
  - Die Marke „fremd gelesen“ gilt heute für ein ganzes ZOE-Gespräch. Im Prozess gilt sie für den ganzen Lauf.
- **Quellen:**
  - Beurer-Kellner et al., „Design Patterns for Securing LLM Agents against Prompt Injections“, https://arxiv.org/abs/2506.08837 (Juni 2025)
  - Simon Willison dazu, https://simonwillison.net/2025/Jun/13/prompt-injection-design-patterns/ (13.06.2025)
  - Debenedetti et al., „Defeating Prompt Injections by Design“ (CaMeL), https://arxiv.org/abs/2503.18813 (März 2025)
  - Fortune, https://fortune.com/2025/12/23/openai-ai-browser-prompt-injections-cybersecurity-hackers/ (23.12.2025)

#### 20. Werkzeugklassen sichtbar machen, aber nur eigenen Angaben trauen
- **Erkenntnis:** MCP (2025-11-25) beschreibt Werkzeuge mit vier Hinweisen: nur lesend, zerstörend, wiederholbar ohne Zusatzwirkung, Kontakt zur Außenwelt. Clients müssen diese Hinweise als nicht vertrauenswürdig behandeln, solange der Server nicht vertrauenswürdig ist.
- **Wie die Besten es machen:** Die Spezifikation empfiehlt:
  - Ein Mensch kann jeden Werkzeugaufruf ablehnen.
  - Die Oberfläche zeigt, welche Werkzeuge freigegeben sind, und markiert jeden Aufruf deutlich.
  - Eingaben werden vor dem Aufruf gezeigt.
  - Es gibt Zeitlimits und ein Protokoll.
- **Bedeutung für MAKE OS:**
  - Ein eigenes Werkzeug-Register mit vier Klassen: lesen · intern schreiben · nach außen · zerstörend. Die Klassen pflegt MAKE OS selbst; was ein Werkzeug über sich behauptet, zählt nicht.
  - Jede Klasse hat auf der Fläche eine Farbe bzw. ein Symbol.
  - „Nach außen“ und „zerstörend“ brauchen immer eine Freigabe.
  - Künftige fremde MCP-Werkzeuge gelten bis zur Prüfung als „nach außen + zerstörend“.
- **Quelle:** MCP-Spezifikation, Tools, https://modelcontextprotocol.io/specification/2025-11-25/server/tools (25.11.2025)

#### 21. Ein Vertrauens-Tor vor jedem Modellaufruf
- **Erkenntnis:** Die großen Anbieter führen jeden Modellaufruf durch eine zentrale Schutzschicht. Agenten haben keinen eigenen Weg am Tor vorbei.
- **Wie die Besten es machen:**
  - **Salesforce Einstein Trust Layer:**
    - Sensible Daten werden vor dem Modell durch Platzhalter ersetzt und in der Antwort zurückgetauscht.
    - Der Modellanbieter speichert nichts.
    - Ausgaben werden auf Toxizität geprüft.
    - Ein Prüfpfad hält je Interaktion fest: maskierte Daten, Scores, verwendete Grounding-Daten.
  - **OpenAI:** Guardrails (personenbezogene Daten maskieren, Jailbreaks erkennen) gibt es als eigenen Knoten und als offene Bibliothek.
- **Bedeutung für MAKE OS:**
  - Das KI-Tor (`askText`) ist genau diese Schicht und gilt für jeden Prozess-Schritt. Es gibt keinen Agenten-Knoten mit eigenem Modellzugang.
  - Ein Schritt erbt seine Kategorien (crm, finanzen …) automatisch aus seinem Rechte-Profil.
  - Hintergrundläufe werden pseudonymisiert.
  - Das Protokoll enthält nur Metadaten.
- **Quellen:**
  - Salesforce Developers, Trust Layer, https://developer.salesforce.com/docs/ai/agentforce/guide/trust.html (abgerufen 21.10.2026)
  - Trailhead, „Secure agents with the Einstein Trust Layer“, https://trailhead.salesforce.com/content/learn/modules/conversational-marketing-fundamentals-for-marketing-cloud-next/secure-agents-with-the-einstein-trust-layer (abgerufen 21.10.2026)
  - OpenAI, „Introducing AgentKit“, https://openai.com/index/introducing-agentkit/ (06.10.2025)

### E. Kosten und Laufzeit

#### 22. Harte Grenzen gehören in die Laufzeit, nicht in den Prompt
- **Erkenntnis:** Ein Agent in einer Schleife kann viel Geld verbrennen oder Systeme lahmlegen. Grenzen müssen deshalb technisch erzwungen werden.
- **Wie die Besten es machen:**
  - **Claude Agent SDK:** `max_turns` zählt die Werkzeug-Runden. `max_budget_usd` beendet einen Lauf, sobald ein Kostenbetrag erreicht ist; für Produktion wird ein Budget empfohlen.
  - **OpenAI Agents SDK:** `max_turns` löst einen definierten Fehler aus. Fehler-Handler liefern stattdessen eine kontrollierte Endausgabe (bei Rundengrenze, Verweigerung, ungültiger Ausgabe).
  - **Zapier Agents:** Bei einer Aktivitätsgrenze je Lauf pausiert der Agent und fragt nach.
  - **Relevance AI:** kostenbasierte Pausen, Schrittgrenzen, „Max auto runs“.
- **Bedeutung für MAKE OS:**
  - Budgets gibt es je Schritt und je Lauf (Modellaufrufe, Werkzeug-Runden, €, Laufzeit) sowie je Prozess und Monat.
  - Ist ein Budget erreicht, wird pausiert, die Glocke informiert und das Zwischenergebnis gesichert. Still abgebrochen wird nie.
  - Die Werte sind Felder mit Vorgabe und je Instanz einstellbar (Plattform-Regel).
  - Das KI-Tor kennt die Kosten schon, also prüft es dort auch das Budget.
- **Quellen:**
  - Claude Agent SDK, Agent loop, https://code.claude.com/docs/en/agent-sdk/agent-loop (abgerufen 21.10.2026)
  - OpenAI Agents SDK, Running agents (abgerufen 21.10.2026)
  - Zapier Help, https://help.zapier.com/hc/en-us/articles/45697420326285-Zapier-Agents-unexpected-activity-usage (abgerufen 21.10.2026)
  - Relevance AI, Features, https://relevanceai.com/features (abgerufen 21.10.2026)

#### 23. Kosten vorher zeigen und Modelle routen
- **Erkenntnis:** Agenten kosten ein Vielfaches eines Chats, Multi-Agent-Systeme noch einmal deutlich mehr (siehe Nr. 5). Das lohnt sich nur bei Aufgaben mit hohem Wert. Kosten ohne klaren Nutzen sind laut Gartner der Hauptgrund, warum Agenten-Projekte scheitern.
- **Wie die Besten es machen:**
  - Das Router-Muster schickt einfache Fälle an ein kleines Modell und schwierige an ein großes.
  - Cognition nutzt einen „Smart Friend“: Das kleine Modell holt bei harten Fällen das große dazu und gibt ihm den vollen Kontext mit.
  - Relevance AI schlüsselt die Kosten je Lauf auf: Werkzeuge, Modell und Grundkosten.
- **Bedeutung für MAKE OS:**
  - Beim Aktivieren eines Prozesses gibt es eine Kostenschätzung: Läufe pro Monat × Schritte × Modellklasse.
  - Die Ist-Kosten je Lauf stehen auf der Fläche.
  - Je Schritt ist standardmäßig ein kleines Modell eingestellt; „großes Modell bei Bedarf“ ist eine Option.
  - Kosten je Ergebnis (z. B. € je qualifiziertem Lead) werden als Prozess-Kennzahl geführt.
- **Quellen:**
  - Anthropic, Multi-Agent-Research (13.06.2025)
  - Anthropic, „Building effective agents“ (19.12.2024)
  - Cognition (22.04.2026)
  - Relevance AI, Plans, https://relevanceai.com/docs/admin/subscriptions/plans (abgerufen 21.10.2026)
  - Gartner (25.06.2025)

### F. Nachvollziehbarkeit

#### 24. Spuren nach Standard, mit Metadaten statt Inhalten
- **Erkenntnis:** Für Agenten-Spuren entsteht ein Standard, und er erfasst Inhalte bewusst nicht.
- **Wie die Besten es machen:**
  - **OpenTelemetry (GenAI-Konventionen)** definiert drei Spannen:
    - `invoke_agent` für einen ganzen Agentenlauf;
    - `execute_tool` für einen Werkzeugaufruf;
    - `chat` für einen Modellaufruf.

    Prompts, Antworten und Werkzeug-Argumente werden standardmäßig nicht erfasst, wegen des Personenbezugs. Der Standard hat 2026 noch den Status „Development“.
  - **Anthropic** verfolgt Entscheidungsmuster und Interaktionsstruktur statt Gesprächsinhalte.
  - **OpenAI** hat einen eigenen Schalter dafür, ob sensible Inhalte in Spuren landen.
- **Bedeutung für MAKE OS:**
  - Das Lauf-Protokoll ist ein Baum: Lauf → Schritt → Modellaufruf/Werkzeug.
  - Erfasst werden Dauer, Kosten, Status, Kategorien und Fehlerart.
  - Die Namen lehnen sich an OpenTelemetry an, damit ein späterer Export möglich ist.
  - Inhalte liegen nur im Lauf selbst, nur für Berechtigte und mit Löschfrist. Das KI-Protokoll bleibt bei Metadaten.
- **Quellen:**
  - OpenTelemetry, GenAI agent spans, https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/ (abgerufen 21.10.2026, Status „Development“)
  - GreptimeDB, https://greptime.com/blogs/2026-05-09-opentelemetry-genai-semantic-conventions (09.05.2026, sekundär)
  - Anthropic, Multi-Agent-Research (13.06.2025)
  - OpenAI Agents SDK, Running agents

#### 25. Das „Warum?“ hängt direkt am Ergebnis
- **Erkenntnis:** Akzeptiert wird, was sich erklären lässt. Die Begründung muss neben dem Ergebnis stehen und darf nicht in einem Protokoll versteckt sein.
- **Wie die Besten es machen:**
  - **Microsoft Copilot Studio:** Eine „Activity Map“ zeigt je Lauf bzw. Testfall, wie der Agent vorging und wo er scheiterte. Sie ist direkt mit den Evaluationsergebnissen verknüpft.
  - **LangGraph Studio:** zeigt Graph und tatsächlich genommenen Pfad. Mit Zeitreise kann man zurückspringen, den Zustand ändern und einen neuen Ast starten.
  - **Relevance AI:** Die Freigabe zeigt die vorgeschlagene Aktion mit Begründung und Verlauf.
  - **Smashing Magazine:** kurze Begründung in Alltagssprache, die sich auf eine Vorgabe bezieht.
- **Bedeutung für MAKE OS:**
  - Jedes Agenten-Ergebnis trägt eine Begründung in 1–2 Sätzen, Belege mit Links (WEG), die beteiligte Regel bzw. den beteiligten Schritt und die Kosten.
  - Ein Klick auf einen Schritt öffnet Eingang, Ausgang, Werkzeugaufrufe und Grund.
  - Für die Fehlersuche gibt es im Testmodus „Erneut ab hier“ mit geändertem Eingang.
- **Quellen:**
  - Microsoft Copilot Blog, https://www.microsoft.com/microsoft-copilot/blog/copilot-studio/new-and-improved-agent-evaluations-computer-use-and-advanced-maker-training/ (04.03.2026)
  - LangChain, LangSmith Studio, https://docs.langchain.com/langsmith/studio (abgerufen 21.10.2026)
  - Smashing Magazine (11.02.2026)
  - Relevance AI Docs (abgerufen 21.10.2026)

### G. Evaluation vor dem Live-Gang

#### 26. Kein Live-Gang ohne Testfälle
- **Erkenntnis:** Ohne Evals bleibt bei Änderungen nur Raten. Starten kann man mit wenigen Fällen.
- **Wie die Besten es machen:** Anthropic empfiehlt (09.01.2026):
  - früh beginnen, mit 20–50 Aufgaben aus echten Fehlern;
  - das Ergebnis bewerten, also den Endzustand, nicht den Weg dorthin;
  - pass^k für Beständigkeit messen: Wer einzeln zu 75 % trifft, schafft 3 von 3 nur zu etwa 42 %;
  - ausgewogene Fälle bauen: Fälle, in denen der Agent handeln soll, und Fälle, in denen er es nicht soll;
  - Transkripte lesen;
  - Modell-Richter an menschlichen Urteilen ausrichten und ihnen „unbekannt“ als Antwort erlauben;
  - Fähigkeits-Tests, die fast immer bestehen, in die Regressionstests übernehmen.

  Beim Research-System reichten anfangs etwa 20 Testfragen.
- **Bedeutung für MAKE OS:**
  - Ein Prozess durchläuft die Status Entwurf → Probelauf → Aktiv.
  - Die Testfälle für den Probelauf kommen aus Ablehnungen im Stapel, gespeicherten Läufen und Demo-Daten.
  - Geprüft wird zuerst per Code (Schema, Pflichtfelder, Kanal-Ampel), danach mit einem Rubrik-Richter.
  - Mehr Autonomie gibt es nur ab einer pass^k-Schwelle.
  - Die Heads haben das Muster schon (`eval.ts` mit Replay und pass^k). Es wird auf Prozess-Schritte übertragen.
- **Quellen:**
  - Anthropic, „Demystifying evals for AI agents“, https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents (09.01.2026)
  - Anthropic, Multi-Agent-Research (13.06.2025)

#### 27. Im Sandkasten testen, Versionen vergleichen, laufende Läufe schützen
- **Erkenntnis:** Die großen Plattformen haben eigene Testumgebungen und vergleichen Versionen, bevor eine Änderung live geht.
- **Wie die Besten es machen:**
  - **Agentforce Testing Center:**
    - Ein Modell erzeugt synthetische Testfälle aus den Metadaten und dem Wissen des Agenten.
    - Die Fälle laufen parallel im Stapel.
    - Salesforce warnt: Tests verbrauchen Credits und können CRM-Daten verändern, deshalb nur in der Sandbox testen.
  - **Copilot Studio (Preview, März 2026):** Testsets aus Import, Chats oder KI; mehrere Prüfer je Set; Versionen im direkten Vergleich; Import von Produktionsdaten.
  - **Vellum:** Testsuiten und Umgebungen (Entwicklung, Staging, Produktion) mit Rücksprung.
  - **Anthropic, „Rainbow Deployments“:** Laufende Agenten werden nicht mitten in einer Aufgabe auf eine neue Version umgestellt.
- **Bedeutung für MAKE OS:**
  - Probeläufe schreiben nie ins Live-CRM. Schreibschritte werden nur simuliert („würde schreiben …“) oder laufen gegen die Demo-Instanz, die es mit Demo-Saat schon gibt.
  - Jeder Prozess hat Versionen, und alt und neu werden auf denselben Testfällen verglichen.
  - Jeder Lauf bleibt bei der Version, mit der er gestartet ist.
- **Quellen:**
  - Salesforce Admins Blog, https://admin.salesforce.com/blog/2025/ensuring-ai-accuracy-5-steps-to-test-agentforce (2025)
  - Salesforce Developers Blog, https://developer.salesforce.com/blogs/2025/11/auto-generate-agent-test-cases-from-agentforce-data-libraries (November 2025)
  - Trailhead, „Use AI to generate tests“, https://trailhead.salesforce.com/content/learn/modules/agentforce-agent-testing/use-ai-to-generate-tests (abgerufen 21.10.2026)
  - Microsoft Copilot Blog (04.03.2026)
  - Vellum Docs, https://docs.vellum.ai/product/getting-started/overview (abgerufen 21.10.2026)
  - Anthropic, Multi-Agent-Research (13.06.2025)

### H. Gedächtnis und Wissen

#### 28. Gedächtnis nach Art trennen und mit Herkunft speichern
- **Erkenntnis:** Gedächtnis macht Agenten über Zeit besser. Es ist aber auch ein Angriffsweg: OWASP führt Gedächtnis- und Kontextvergiftung als eigenes Risiko.
- **Wie die Besten es machen:**
  - **LangGraph** unterscheidet drei Arten:
    - **semantisch:** Fakten;
    - **episodisch:** Erfahrungen, oft als Beispiele genutzt;
    - **prozedural:** Regeln und Anweisungen.

    Langzeitgedächtnis liegt in Namensräumen je Nutzer oder App, Kurzzeitgedächtnis je Gesprächsfaden. Geschrieben wird entweder direkt im Lauf oder im Hintergrund.
  - **Magentic-UI** speichert erfolgreiche Pläne. Man kann sie ansehen, bearbeiten und wiederverwenden.
  - **Anthropic** empfiehlt strukturierte Notizen außerhalb des Kontextfensters.
- **Bedeutung für MAKE OS:** Jeder Prozess hat drei Speicher:
  - **Fakten:** aus den Stammdaten gelesen, nie kopiert.
  - **Erfahrungen:** gute und abgelehnte Beispiele aus Freigaben, wie `lernen.ts` bei den Heads.
  - **Regeln:** Merksätze, nur nach Freigabe durch einen Menschen und mit Herkunft und Datum.

  Gelungene Läufe lassen sich als Vorlage speichern. Nichts aus `fremd()` wird ohne Klick zu Regel oder Merksatz. Der Namensraum ist Haushalt bzw. Instanz, private Bereiche bleiben getrennt.
- **Quellen:**
  - LangChain, Memory, https://docs.langchain.com/oss/python/concepts/memory (abgerufen 21.10.2026)
  - Microsoft Research, Magentic-UI (19.05.2025)
  - Anthropic, Context engineering (29.09.2025)
  - OWASP Agentic Top 10 (09.12.2025, über Sekundärquellen)

### I. Fehler und Rückfall-Wege

#### 29. Eine sichtbare Rückfall-Kaskade
- **Erkenntnis:** Modelle fallen aus, liefern Unbrauchbares oder verweigern. Ein Prozess darf daran nicht still scheitern.
- **Wie die Besten es machen:**
  - **n8n:** ein Ersatzmodell am AI-Agent-Knoten (derzeit nur eines).
  - **OpenAI SDK:** Fehler-Handler liefern eine kontrollierte Ausgabe statt Absturz.
  - **MCP:** Ausführungsfehler gehen zur Selbstkorrektur ans Modell zurück.
  - **Anthropic:** Wiederaufnahme ab der Fehlerstelle; der Agent passt sich an, wenn ein Werkzeug ausfällt.
  - **HubSpot:** Übergabe an einen Menschen.
- **Bedeutung für MAKE OS:** Jeder Agenten-Schritt hat dieselbe Kaskade:
  1. Wiederholen bei Netzfehler oder 429, mit Backoff wie im Takt.
  2. Ersatzmodell.
  3. Regelwerk bzw. Grundlauf. Bei den Heads ist das schon Praxis („ohne KI“).
  4. Aufgabe an die zuständige Person.

  Ungültige Ausgaben bekommen zuerst eine Korrekturrunde mit dem Fehlertext. Auf der Fläche ist sichtbar, was passiert ist, etwa „lief im Regelwerk“ oder „wartet auf Mensch“. Ein stiller Fehlschlag kommt nicht vor.
- **Quellen:**
  - Hackceleration, n8n AI Agent, https://hackceleration.com/resources/integrations/n8n/ai-agent (abgerufen, sekundär)
  - n8n Community, https://community.n8n.io/t/ai-agent-add-prioritized-fallback-list-for-llm-providers/296810 (abgerufen 21.10.2026)
  - OpenAI Agents SDK, Running agents
  - MCP-Spezifikation (25.11.2025)
  - Anthropic, Multi-Agent-Research
  - HubSpot Knowledge Base (wie oben)

### J. Recht: EU AI Act

#### 30. Art. 50 gilt seit 02.08.2026: Kennzeichnung im Prozess mitdenken
- **Erkenntnis:** Die Transparenzpflichten aus Art. 50 sind seit dem 02.08.2026 durchsetzbar.
  - Der Verhaltenskodex zur Kennzeichnung KI-erzeugter Inhalte ist seit Juni 2026 final. Kommission und KI-Gremium halten ihn als Nachweis für geeignet.
  - Die Leitlinien sind seit dem 20.07.2026 final.
  - Bußgelder können bis zu 15 Mio. € oder 3 % des weltweiten Jahresumsatzes betragen.
- **Wie die Pflichten aussehen:**
  - **Interaktion (Art. 50 Abs. 1):** Wer direkt mit Menschen interagiert, muss erkennbar machen, dass eine KI spricht.
  - **Markierung (Abs. 2):** Anbieter markieren synthetische Inhalte maschinenlesbar. Laut Kanzleibericht haben schon am Markt befindliche Systeme dafür eine Übergangsfrist bis 02.12.2026 (Digital Omnibus).
  - **Veröffentlichte Texte (Abs. 4):** Betreiber kennzeichnen KI-Texte zu Themen öffentlichen Interesses. Ausnahme ist echte redaktionelle Verantwortung; eine bloß formale Durchsicht reicht nicht. Maßgeblich ist das Datum der Veröffentlichung.
- **Bedeutung für MAKE OS (Hinweis, keine Rechtsberatung):**
  - Schritte, die Text für draußen erzeugen, tragen weiter `kiKennzeichen()` bzw. die KiMarke.
  - Sollten Antworten an Kunden (WhatsApp, Mail, Chat) je ohne Klick rausgehen, müssen sie sich als KI zu erkennen geben.
  - Der Freigabe-Baustein dokumentiert echte Bearbeitung: Änderung ja/nein, Dauer, Person. Das dient als Nachweis der redaktionellen Verantwortung für veröffentlichte Inhalte wie Newsletter und Beiträge.
  - Bevor MAKE OS als Produkt an Kunden geht, sollte jemand prüfen, ob MAKE OS dann „Anbieter“ im Sinne von Abs. 2 ist und seine Ausgaben markieren muss.
- **Quellen:**
  - Verordnung (EU) 2024/1689, https://eur-lex.europa.eu/eli/reg/2024/1689/oj (13.06.2024)
  - Faegre Drinker, https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations (30.07.2026)
  - Jones Day, https://www.jonesday.com/en/insights/2026/01/european-commission-publishes-draft-code-of-practice-on-ai-labelling-and-transparency (Januar 2026)
  - Mishcon de Reya, https://www.mishcon.com/news/ai-act-transparency-obligations-code-of-practice-and-draft-guidelines (abgerufen 21.10.2026)

### K. Darstellung auf der Fläche

#### 31. Ein einheitliches Status-Modell für Agenten-Schritte
- **Erkenntnis:** Das Agent-to-Agent-Protokoll (A2A) definiert diese Aufgaben-Zustände: eingereicht, läuft, braucht Eingabe, braucht Anmeldung, erledigt, fehlgeschlagen, abgebrochen, abgelehnt.
  - **Unterbrochen und fortsetzbar:** „braucht Eingabe“ und „braucht Anmeldung“. „Braucht Eingabe“ ist eine bewusste Pause, kein Fehler.
  - **Endgültig:** erledigt, fehlgeschlagen, abgebrochen, abgelehnt.
  - **„Abgelehnt“ ist nicht „abgebrochen“:** Abgelehnt hat der Agent selbst (Regel, Fähigkeit). Abgebrochen hat ein Mensch oder das System.
- **Wie die Besten es machen:** Zapier Agents führt einen eigenen Status für „wartet auf Eingabe/Freigabe“. Google nutzt dieselben Zustände in seinen Agenten-Schnittstellen.
- **Bedeutung für MAKE OS:**
  - Feste Status je Schritt: geplant · läuft · wartet auf dich · wartet auf Verbindung · erledigt · fehlgeschlagen · abgebrochen · abgelehnt (Regel). Dazu kommt „im Regelwerk gelaufen“.
  - „Wartet auf dich“ pulsiert (Regel „kritisch pulsiert“) und zeigt eine Frist.
  - Glocke, Heute und ZOE verwenden dieselben Begriffe.
- **Quellen:**
  - Google Cloud, REST Resource tasks, https://docs.cloud.google.com/customer-engagement-ai/conversational-agents/ps/reference/rest/v1/tasks (abgerufen 21.10.2026)
  - Sim, A2A-Integration, https://docs.sim.ai/integrations/a2a (abgerufen, sekundär)
  - Zapier Help, „Add approval steps to your agent's instructions“, https://help.zapier.com/hc/en-us/articles/41776074420493 (abgerufen 21.10.2026)

#### 32. Erst den Plan zeigen, dann handeln, und den gegangenen Weg sichtbar machen
- **Erkenntnis:** Wer den Plan vorher sieht und jederzeit eingreifen kann, vertraut dem Agenten mehr, und der Agent arbeitet besser. In Microsofts Versuch mit Magentic-UI stieg die Erfolgsquote von 30 % (autonom) auf 42–52 %. Der Agent bat dafür nur bei 4–10 % der Aufgaben um Hilfe. Einschränkung: Die Nutzer im Versuch waren simuliert.
- **Wie die Besten es machen:**
  - **Magentic-UI:** gemeinsames Planen vorab, jederzeit unterbrechen oder übernehmen, Aktionswächter vor unumkehrbaren Schritten.
  - **Smashing Magazine:**
    - Absichtsvorschau mit den Wahlen „fortfahren“, „bearbeiten“, „selbst machen“;
    - ein Aktions-Protokoll mit Rückgängig und klarem Zeitpunkt, ab dem etwas endgültig ist;
    - ein Eskalationspfad.
  - **MCP:** sichtbare Anzeige bei jedem Werkzeugaufruf.
  - **LangGraph Studio:** zeigt den tatsächlichen Pfad im Graphen.
- **Bedeutung für MAKE OS:**
  - Jeder Agenten-Schritt ist auf der Fläche eine Karte mit:
    - Rolle (welcher Agent bzw. Head);
    - „tut gerade“ als Live-Zeile, z. B. „liest 12 Kontakte“ oder „schreibt Entwurf“;
    - Ergebnis-Vorschau (erste Zeilen oder Kennzahl);
    - Kosten und Status.
  - Der Lichtfaden (das Markenzeichen) läuft den tatsächlich gegangenen Pfad entlang. Nicht gegangene Äste sind gedimmt.
  - Vor dem Start steht die Vorschau „Das wird passieren“.
  - Interne Aktionen haben ein Rückgängig-Fenster.
- **Quellen:**
  - Microsoft Research, Magentic-UI (19.05.2025) und arXiv 2507.22358, https://arxiv.org/abs/2507.22358 (Juli 2025)
  - Smashing Magazine (11.02.2026)
  - MCP-Spezifikation (25.11.2025)
  - LangChain, LangSmith Studio (abgerufen 21.10.2026)

#### 33. Messgrößen für den laufenden Betrieb
- **Erkenntnis:** Ob Agenten im Prozess gut arbeiten, zeigen wenige Zahlen. Sie lassen sich ohne Inhalte erheben.
- **Wie die Besten es machen:**
  - **Smashing Magazine** nennt Richtwerte:
    - Annahme der Absichtsvorschau über 85 %;
    - mehr als 10 % Übersteuerungen → Modell prüfen;
    - mehr als 5 % Rücknahmen → Automatik aus;
    - Eskalation 5–15 % ist gesund;
    - Erfolg nach Eskalation über 90 %.
  - **Copilot Studio** bewertet mit mehreren Prüfern auf Ebene ganzer Testsets.
  - **Anthropic** empfiehlt Ausgangswerte für Latenz, Tokens, Kosten und Fehler.
- **Bedeutung für MAKE OS:**
  - Ein Prozess-Lagebild (wie beim HOI) zeigt je Agenten-Schritt: Annahmequote, wie stark Entwürfe geändert wurden, Rücknahmen, Eskalationen, Kosten je Lauf, Dauer, Anteil der Rückfälle.
  - Schwellen lösen einen Hinweis oder eine Rückstufung aus.
  - Erfasst werden nur Zähler, keine Inhalte.
- **Quellen:**
  - Smashing Magazine (11.02.2026)
  - Anthropic, Evals (09.01.2026)
  - Microsoft Copilot Blog (04.03.2026)

---

## Anti-Pattern

1. **Agent, wo eine Regel reicht („Agent-Washing“).**
   - *Problem:* Das kostet mehr, ist schwerer vorherzusagen und schlechter zu prüfen.
   - *Besser:* Regeln zuerst, das Modell nur für Urteil und Text.
   - *Quellen:* Gartner 25.06.2025; Anthropic 19.12.2024; Salesforce Hybrid Reasoning 2026.
2. **Parallel schreibende Agenten oder unstrukturierte Schwärme.**
   - *Problem:* Widersprüchliche stille Entscheidungen machen das Ergebnis brüchig.
   - *Besser:* Ein Schreiber, viele Berater.
   - *Quellen:* Cognition 22.04.2026; MAST 2025.
3. **Stille Post oder Kontextflut bei Übergaben.**
   - *Problem:* Ganze Verläufe weiterzureichen verschlechtert die Ergebnisse. Zu knappe Zusammenfassungen verlieren Wesentliches.
   - *Besser:* Referenzen auf Artefakte plus verdichtete Kurzfassung.
   - *Quellen:* Anthropic 13.06.2025 und 29.09.2025.
4. **Die Selbstauskunft des Modells als Konfidenz-Schwelle.**
   - *Problem:* Diese Werte sind schlecht kalibriert, in Ketten wird es schlimmer.
   - *Besser:* Schwellen auf prüfbare Signale bauen.
   - *Quelle:* arXiv 2509.25532.
5. **Freigabe als Durchwinken.**
   - *Problem:* Zu viele, zu kleinteilige Rückfragen erzeugen nur den Anschein von Aufsicht.
   - *Besser:* Plan-Freigabe zu Beginn, Einzelfreigaben nur vor riskanten Schritten.
   - *Quellen:* Meta 31.10.2025; urandom.io 02.03.2026.
6. **Fremder Text steuert den Weg.**
   - *Problem:* Eine Raute auf Mail-Inhalt ohne Absicherung, Empfänger oder Beträge aus fremdem Text, alle drei Teile des „tödlichen Dreiecks“ in einem Schritt.
   - *Besser:* Pfad und Ziele aus Stammdaten, fremder Text nur als Inhalt.
   - *Quellen:* Willison 16.06.2025; arXiv 2506.08837.
7. **Grenzen nur im Prompt.**
   - *Problem:* Ohne harte Grenzen für Runden, Kosten und Zeit drohen Endlosschleifen und unerwartete Rechnungen.
   - *Besser:* Grenzen in der Laufzeit, mit Pause und Nachfrage.
   - *Quellen:* Claude Agent SDK; urandom.io 02.03.2026.
8. **Live ohne Evals, oder Tests gegen echte Daten.**
   - *Problem:* Regressionen bemerkt man erst beim Kunden. Testläufe können das Live-CRM verändern.
   - *Besser:* Probelauf mit simulierten Schreibschritten oder in der Demo-Instanz.
   - *Quellen:* Anthropic 09.01.2026; Salesforce Testing Center.
9. **Den Weg bewerten statt das Ergebnis, und Transkripte nie lesen.**
   - *Problem:* Starre Schrittfolge-Prüfungen bestrafen gute Lösungswege. Ohne Transkripte unterscheidet niemand einen Agentenfehler von einem Prüferfehler.
   - *Quelle:* Anthropic 09.01.2026.
10. **Abhängigkeit von einem fremden Builder oder Framework.**
    - *Problem:* Prozesse hängen an einer Plattform, die abgeschaltet werden kann.
    - *Besser:* Engine und Datenmodell selbst besitzen.
    - *Quellen:* OpenAI Deprecations, Ankündigung 03.06.2026; HumanLayer 12-Factor Agents.
11. **Gedächtnis ohne Herkunft und Freigabe.**
    - *Problem:* Was ein Agent aus fremden Daten als „Regel“ lernt, vergiftet künftige Läufe.
    - *Besser:* Merksätze nur mit Klick, mit Herkunft und Datum.
    - *Quelle:* OWASP Agentic Top 10, 09.12.2025.
12. **Werkzeug-Wildwuchs.**
    - *Problem:* Jeder API-Endpunkt als eigenes Werkzeug, UUIDs statt Namen, kryptische Fehlermeldungen: Das verwirrt den Agenten und kostet Tokens.
    - *Besser:* Wenige gebündelte Werkzeuge in Namensräumen.
    - *Quelle:* Anthropic 11.09.2025.

---

## Die 5 wichtigsten Empfehlungen

1. **Den Prozess als deterministischen Graphen bauen, den Agenten als begrenzten Schritt darin.**
   - Kanten und Rauten zeichnet ein Mensch oder sie folgen einer Regel. Das Modell kommt nur für Urteil und Text zum Einsatz, und eine Modell-Raute ist ausdrücklich markiert.
   - Das ist Plan-then-Execute und schützt vor Prompt-Injection: Fremder Text kann Inhalte beeinflussen, aber nicht den Weg.
   - Die Engine lebt im eigenen Code, die Fläche ist nur die Sicht darauf. Modelle laufen ausschließlich über das KI-Tor.
2. **Jeder Agenten-Schritt bekommt einen Vertrag mit fünf Teilen, und der Server erzwingt ihn:**
   - Eingabe- und Ausgabe-Schema;
   - Rechte-Profil nach dem Prinzip „Least Agency“: nur die nötigen Werkzeuge in Klassen (lesen, intern schreiben, nach außen, zerstörend), mit Prüfung auf das „tödliche Dreieck“;
   - Budget (Runden, €, Zeit);
   - Autonomie-Stufe;
   - Rückfall-Kaskade (Ersatzmodell → Regelwerk → Mensch).
3. **Die Freigabe als eigenen Baustein bauen.**
   - Sie pausiert dauerhaft und zeigt den konkreten Aufruf.
   - Sie hat bearbeitbare Felder, Ausgänge als Äste und einen Frist-Ast.
   - Nach der Freigabe wird der Stand neu geprüft (409 mit Diff).
   - Eskaliert wird nach prüfbaren Signalen (Prüfer, Belege, Annahmequote), nicht nach der Selbstauskunft des Modells.
   - Am Anfang eines Laufs steht eine Plan-Freigabe; danach gibt es Einzelfreigaben nur vor riskanten Schritten.
   - Nach außen bleibt immer ein Klick.
4. **Kein Live-Gang ohne Probelauf, und Autonomie wird verdient.**
   - 20–50 Testfälle aus echten Ablehnungen und Läufen.
   - Bewertet wird das Ergebnis; pass^k misst die Beständigkeit.
   - Neue und alte Version laufen gegen dieselben Fälle.
   - Schreibschritte sind im Probelauf simuliert oder laufen gegen die Demo-Instanz.
   - Die Stufe steigt Schatten → Vorschlag → Mit Freigabe → Selbst (nur intern). Bei Ablehnungen, Rücknahmen oder einem Modellwechsel wird automatisch zurückgestuft.
5. **Nachvollziehbarkeit direkt auf der Fläche zeigen.**
   - Ein einheitliches Status-Modell nach A2A-Vorbild; „wartet auf dich“ pulsiert.
   - Der Lichtfaden läuft den tatsächlich gegangenen Pfad entlang.
   - Je Schritt sichtbar: „tut gerade“, Ergebnis-Vorschau, Begründung mit Belegen, Kosten.
   - Die Spuren folgen OpenTelemetry und enthalten Metadaten statt Inhalte.
   - Rückfälle sind sichtbar („lief im Regelwerk“).
   - Ausgaben nach draußen tragen die KI-Kennzeichnung nach Art. 50.
