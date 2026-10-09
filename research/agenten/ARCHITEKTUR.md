# Agenten-Architektur und Zusammenarbeit — Recherche für den Agenten-Bereich

**Stand:** 08.10.2026 spät · Recherche und Empfehlung, **nichts gebaut** · ergänzt `AGENTEN_KONZEPT.md` (Teil B Markt, Teil C Zielbild)
und `research/ai-ceo/P06-auszug.md` (Gemini-Bericht, geprüft am 05.10.)
**Auftrag:** Architektur und Zusammenarbeit von KI-Agenten für ZOE → Heads → Mitarbeiter → Skills → Hintergrundaufgaben. Kevins Zusatz wörtlich:
„Mitarbeiter können anderen helfen — bitte im Internet checken und Best Practice holen für das System, was wir aufbauen wollen.“

> **Belastbarkeit:** **[O]** = offizielle Doku, Hersteller-Blog oder Paper selbst gelesen · **[S]** = nur Such-Ausschnitt, Abstract oder Drittquelle ·
> **„nicht belegt“** = gesucht, keine Quelle gefunden. Alle Quellen am **08.10.2026** abgerufen (Liste in Teil 10). Hinweis, keine Rechtsberatung.
> Produkte und Preise ändern sich monatlich — vor dem Bau die markierten Punkte noch einmal ansehen.

---

## 0 · Kurzfassung

1. **Gemeinsamer Kern aller Baukästen:** ein Koordinator, Spezialisten darunter, zurück nur eine Zusammenfassung (Anthropic, OpenAI, Google ADK, LangChain, Microsoft). Freie Agenten-Netze: „mostly a distraction“ (Cognition 04/2026).
2. **Mehragenten kosten 3–15× die Token eines Chats.** Lohnend nur für Kontext-Schutz, Parallelität, klare Spezialisierung; zerlegt wird nach Kontext-Grenzen.
3. **„Mitarbeiter helfen einander“ ist belegt in drei Formen:** Prüfer mit frischem Kontext (MAST +15,6 %), „Rat holen“ beim stärkeren Modell (Haiku + Opus 41,2 % statt 19,7 %), gemeinsamer Arbeitsstand („Brett“), über den die Leitung vermittelt.
4. **Nicht bewährt:** parallele Schreiber, freie Agent-zu-Agent-Gespräche, Debatten (der Gewinn kommt fast nur aus Abstimmung).
5. **Häufigste Fehler (MAST, 1.600 Läufe):** Wiederholung 15,7 %, Denken ≠ Handeln 13,2 %, Ende nicht erkannt 12,4 %, Auftrag missachtet 11,8 %, Prüfung fehlt/falsch 17,3 %. Gegenmittel: harte Grenzen, Stall-Zähler, Erledigt-Kriterium, Prüfschritt.
6. **Prompt-Injection ist ungelöst** (12 Abwehren zu über 90 % überwunden). Daher „Rule of Two“ je Lauf, Fremdtext-Marke vererbt sich über Delegation, Agenten-Nachrichten sind nie Zustimmung.
7. **Auf 1 vCPU / 2 GB passt kein fremder Workflow- oder Tracing-Dienst** (Langfuse self-host: 4 Kerne/16 GiB). Aufträge, Absichtsprotokoll und Stapel sind schon „durable execution light“: ausbauen statt ersetzen.
8. **Kosten:** Modellstufen per Eval neu prüfen (Haiku 5.5 ab 0,10 $ statt 1 $ je Mio. Eingabe; Haiku 4.5 cacht erst ab 4.096 Token), Batch −50 % für Nachtläufe, ≤ 20 Werkzeuge je Head (Auswahl kippt ab 30–50).
9. **Empfehlung:** Tiefe 2, Hilfe nur über den Head (Brett + `hilfe_anfragen`), ein Schreiber je Vorgang, fester Prüfer je Head, eigenes Lauf-Protokoll mit OpenTelemetry-Namen. Regeln in Teil 8, 18 Entscheidungsfragen in Teil 9.

---

## 1 · Muster für Hierarchie und Delegation

### 1.1 Anthropic „Building effective agents“ (19.12.2024) [O]
- **Was:** Unterscheidet Workflows (feste Codepfade) und Agenten (das Modell steuert sich selbst). Fünf Muster: Kette, Routing, Parallelisierung (Aufteilen bzw. Abstimmen), **Orchestrator-Worker** („central LLM dynamically breaks down tasks“) und **Evaluator-Optimizer** (einer erzeugt, einer bewertet, in einer Schleife).
- **Stärken:** Einfach anfangen, Planung sichtbar machen, Werkzeuge sorgfältig beschreiben. Werkzeuge „poka-yoke“ bauen, also so, dass Fehlbedienung schwer ist. Abbruchbedingungen wie eine Höchstzahl an Runden.
- **Schwächen:** Bewusst allgemein, keine Aussagen zu Rechten oder Mehrbenutzer-Betrieb. Die Seite vermerkt selbst, dass sich die Werkzeuge seither geändert haben.
- **Für uns:** Die Heads arbeiten heute schon so: Grundlauf → Modell → Prüfer (= Evaluator-Optimizer). Der Weg Head → Mitarbeiter ist Orchestrator-Worker.

### 1.2 Anthropic „Multi-agent research system“ (13.06.2025) [O]
- **Was:** Ein Lead-Agent (Opus) plant und startet parallel Subagenten (Sonnet), die getrennt suchen. Danach setzt ein Zitier-Agent die Belege. Der Lead schreibt seinen Plan ins Gedächtnis, weil über 200.000 Token abgeschnitten wird.
- **Stärken:**
  - +90,2 % gegenüber Opus allein im eigenen Test.
  - Parallelität spart bei komplexen Fragen bis zu 90 % der Zeit.
  - Jeder Auftrag braucht **Ziel, Ausgabeformat, Werkzeug- und Quellenhinweise und klare Grenzen**, sonst doppelte Arbeit oder Lücken.
  - Aufwandsregel im Prompt: einfache Frage = 1 Agent mit 3–10 Aufrufen, Vergleich = 2–4 Subagenten, komplex = über 10.
  - Bewertung durch ein LLM mit Rubrik plus Menschen; etwa 20 echte Fälle reichen am Anfang. Bei Agenten, die etwas ändern, wird der **Endzustand** bewertet.
  - Läufe setzen nach einem Abbruch am Zwischenstand fort, mit vollem Tracing und schrittweiser Umstellung auf neue Versionen.
- **Schwächen:**
  - **Agenten brauchen etwa 4× die Token eines Chats, Mehragenten etwa 15×.** Die Token-Menge allein erklärt 80 % der Leistungsunterschiede.
  - Beobachtete Fehler: 50 Subagenten für einfache Fragen, endloses Suchen, Subagenten stören einander mit zu vielen Meldungen, Weiterarbeiten nach genug Ergebnissen.
  - Synchron: Der Lead wartet und kann nicht mittendrin steuern.
  - Schlecht geeignet, wenn alle denselben Kontext brauchen oder es viele Abhängigkeiten gibt.

### 1.3 Anthropic „Building multi-agent systems: when and how to use them“ (23.01.2026) [O]
- **Was:** Mehragenten lohnen nur in drei Lagen: **Kontext schützen** (laute Teilaufgaben abkapseln), **Parallelisieren** („benefit is thoroughness, not speed“) und **Spezialisieren** (Werkzeugauswahl, widersprüchliche Prompts). Sonst „the coordination costs typically exceed the benefits“.
- **Stärken:**
  - Zerlegen nach **Kontext-Grenzen** („context-centric … usually effective“) statt nach Arbeitsart („often counterproductive“). Beispiel: Wer ein Feature baut, schreibt auch dessen Tests.
  - **Prüf-Subagent** als bewährte Form, weil er wenig Kontext braucht.
- **Schwächen:**
  - 3–10× mehr Token als ein einzelner Agent.
  - Parallele Läufe dauern insgesamt oft länger.
  - Der Prüfer neigt zum „early victory problem“: Er erklärt nach wenigen Tests den Erfolg. Dagegen helfen konkrete Kriterien und Negativtests.

### 1.4 Claude Code Subagents [O]
- **Was:**
  - Definition als Markdown mit Kopf: `name`, `description` (wann delegieren), `tools`/`disallowedTools`, `model`, `maxTurns`, `skills`, `memory`, `background`.
  - Eigener Kontext; zurück geht **„only the summary“**.
  - Verschachtelung standardmäßig **bis 3 Ebenen** unter dem Hauptgespräch, abschaltbar (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`).
  - Fortsetzen per `SendMessage` mit vollem Verlauf.
  - Gedächtnis je Subagent: `MEMORY.md`, davon die ersten 200 Zeilen bzw. 25 KB im Systemprompt.
- **Stärken:** Werkzeug-Grenzen je Agent, Modell-Routing auf Haiku für günstige Arbeit, Hintergrundlauf.
- **Schwächen:** Ergebnisse belegen trotzdem Kontext im Hauptgespräch; jeder Subagent verbraucht eigene Token.

### 1.5 Claude Code Agent Teams (experimentell, abgerufen 08.10.2026) [O]
- **Was:**
  - Eine Teamleitung plus Teammitglieder, jedes mit eigenem Kontext.
  - **Gemeinsame Aufgabenliste** (pending, in progress, completed, mit Abhängigkeiten; das Übernehmen ist per Dateisperre geschützt).
  - **Postfach je Agent** (eine JSON-Datei); Teammitglieder schreiben einander direkt.
  - Der Mensch kann **jedes Mitglied direkt ansprechen**.
  - Hooks `TaskCreated`, `TaskCompleted` und `TeammateIdle` als Qualitäts-Schranken.
- **Stärken:**
  - Recherche, Review, „konkurrierende Hypothesen“: Mitglieder versuchen, einander zu widerlegen.
  - Empfohlen sind **3–5 Mitglieder** mit 5–6 Aufgaben je Mitglied.
  - **„A teammate can't approve a permission prompt or supply consent on your behalf“**: Eine Nachricht eines Agenten gilt als nicht vertrauenswürdige Eingabe.
- **Schwächen:**
  - „significantly more tokens“, Kosten linear je Mitglied.
  - **Keine verschachtelten Teams.**
  - Aufgabenstatus hinkt nach, Teammitglieder hören zu früh auf, und die Leitung erklärt die Arbeit zu früh für fertig.
  - Gleiche Dateien bearbeiten führt zu Überschreibungen.

### 1.6 OpenAI Agents SDK [O]
- **Was:** Zwei Formen:
  - **Agents as tools:** Ein Manager behält das Gespräch und ruft Spezialisten über `Agent.as_tool()` auf.
  - **Handoffs:** Ein Triage-Agent übergibt den Rest des Zugs an einen Spezialisten.
  - Beides lässt sich kombinieren. Daneben gibt es „code-driven orchestration“ (strukturierte Ausgabe → Code wählt den nächsten Agenten; parallel über `asyncio.gather`).
- **Mensch im Ablauf:**
  - `needs_approval` je Werkzeug: ein Lauf pausiert mit `interruptions`, der Zustand (`RunState`) lässt sich speichern und später fortsetzen.
  - Freigaben aus **verschachtelten Agenten erscheinen am äußeren Lauf**.
  - Die Doku warnt ausdrücklich: Freigebende authentifizieren, Entscheidungen gegen serverseitig gespeicherte offene Punkte prüfen, **atomar verbrauchen** und die Identität **nie aus dem Anfrage-Körper** nehmen. Dazu eine Versionsmarke im gespeicherten Zustand.
- **Leitplanken:** Eingabe-, Ausgabe- und Werkzeug-Leitplanken mit „tripwire“. „Blocking“ verhindert, dass das teure Modell überhaupt startet.
- **Werkzeuganzahl:** Der Leitfaden „A practical guide to building agents“ nennt keine harte Grenze; entscheidend ist die **Überschneidung** der Werkzeuge. [S: eigene Prüfung am 05.10. in P06; die Seite antwortet heute mit 403]
- **Schwächen:** Handoffs geben die Kontrolle ab; ohne eigene Schranken drohen Ping-Pong-Übergaben (**nicht belegt** als OpenAI-Aussage, allgemeine Folge der Kontrollübergabe).

### 1.7 Google ADK und Agent2Agent (A2A) [O/S]
- **ADK:**
  - **Sub-Agenten** übernehmen die Kontrolle und teilen Sitzung und Zustand. **Agent als Werkzeug** ist zustandslos, und der Aufrufer behält die Kontrolle.
  - Faustregel aus dem Google-Blog vom 08.11.2025: „tools for stateless, reusable capabilities“, Sub-Agenten für zustandsbehaftete Prozesse. [O]
  - Acht Muster laut Google-Blog vom 16.12.2025: Pipeline, Koordinator, Fan-out/Gather, hierarchische Zerlegung, Generator/Kritiker, iterative Verfeinerung, Mensch im Ablauf, Mischform.
  - Gemeinsamer Zustand `session.state` = „your whiteboard“. Bei Parallelität „make sure each agent writes its data to a unique key“.
  - „Do not build a nested loop system on day one.“ [O]
- **A2A:**
  - Offenes Protokoll für Agenten **verschiedener Systeme**, seit 06/2025 bei der Linux Foundation. [S]
  - **v1.0.0 vom 12.03.2026, v1.0.1 vom 28.05.2026** [O, GitHub-Releases].
  - Agent Card (Fähigkeiten, Endpunkt, Anmeldung) und Task-Zustände `submitted · working · input-required · auth-required · completed · failed · canceled · rejected`.
  - Agenten arbeiten als „opaque agents“, ohne innere Pläne oder Werkzeuge zu teilen. [O, Spezifikation]
- **Stärken:** Saubere Trennung „Kontrolle abgeben vs. behalten“. A2A ist ein Standard für die Zusammenarbeit über Firmengrenzen.
- **Schwächen:** Ein Fehler (#3758) zeigt, dass bei Übergaben Zustände verloren gehen können [S]. A2A lohnt erst, wenn fremde Agenten andocken. Innerhalb einer Instanz ist es Ballast.

### 1.8 LangChain / LangGraph [O/S]
- **Was:** Die Doku nennt fünf Muster: Subagents (Agenten als Werkzeuge über einen Hauptagenten), Handoffs (Zustandsvariable wechselt Agent oder Werkzeuge), **Skills** (ein Agent lädt Spezial-Prompts bei Bedarf), Router und eigener Workflow. Zitat: „a single agent with the right (sometimes dynamic) tools and prompt can often achieve similar results“. [O]
- **Modellaufrufe je Muster:**
  - Bei einer Folgeanfrage: Subagents 4 Aufrufe (zusammen 8), Handoffs bzw. Skills je 2 (zusammen 5).
  - Bei einem Vergleich über mehrere Bereiche: Subagents etwa 9.000 Token, Skills etwa 15.000.

  Subagents sind „stateless by design“. [O]
- **Supervisor-Bibliothek:** `langgraph-supervisor` gilt laut Migrationsleitfaden als nicht mehr aktiv gepflegt. Empfohlen ist der Supervisor über **Werkzeugaufrufe**. [S]
- **Pausen:** `interrupt()` pausiert und speichert über einen Checkpointer. **Beim Fortsetzen läuft der Knoten von vorn**, also müssen Nebenwirkungen vor der Pause idempotent sein. [O]

### 1.9 CrewAI „hierarchical process“ [O]
- **Was:** Ein Manager (`manager_llm` oder eigener `manager_agent`) verteilt nach Rolle und Fähigkeit und prüft Ergebnisse. Delegation ist standardmäßig **aus** („to give users explicit control“).
- **Stärken:** Einfache Rollen-Sprache (role, goal, backstory).
- **Schwächen:** Braucht ein starkes Manager-Modell; wenig Kontrolle über den Kontextfluss. Fehlerbilder offiziell **nicht belegt**.

### 1.10 Microsoft AutoGen → Agent Framework, Magentic [O/S]
- **Lage:** AutoGen und Semantic Kernel sind im **Microsoft Agent Framework** aufgegangen. 1.0 ist laut Drittquellen seit **April 2026** allgemein verfügbar, AutoGen läuft im Wartungsmodus. [S]
- **Magentic-Orchestrierung** (Doku aktualisiert am 06.10.2026) [O]:
  - Ein Manager plant (Task-Ledger), bewertet jede Runde im **Progress-Ledger** (erfüllt? in einer Schleife? Fortschritt? wer als Nächstes?) und plant bei Stillstand neu.
  - Grenzen: `max_round_count`, `max_stall_count`, `max_reset_count`. Optional **Plan-Freigabe durch den Menschen** (`approve`/`revise`) und Checkpoints.
  - Microsoft selbst: „untested how well the Magentic orchestration will perform outside of the original Magentic-One design“.
- **Für uns:** Die Idee eines **Stall-Zählers** und der **Plan-Freigabe vor großen Aufträgen** übernehmen, nicht das Framework (.NET/Python, Azure-nah).

### 1.11 MCP als Werkzeug-Schnittstelle [O]
- **Lage:** Spezifikation **2026-07-28**, laut Blog „the largest revision“:
  - **Zustandsloser Kern** (kein `initialize`-Handshake mehr, keine Sitzungs-Kopfzeile).
  - **Tasks** als Erweiterung für lange Arbeiten (`tasks/get`, `tasks/update`).
  - Rückfragen (Elicitation) über „Multi Round-Trip Requests“.
  - Roots, Sampling und Logging sind **deprecated** (mindestens 12 Monate Übergang).
  - Verschärfte Autorisierung (u. a. Dynamic Client Registration deprecated).
- **Stärken:** Weit verbreitet („close to half a billion downloads a month“ über die SDKs). Gut, um MAKE OS **später** als Werkzeugquelle für Kunden-Agenten anzubieten oder fremde Werkzeuge anzubinden.
- **Schwächen für uns:** Innerhalb einer Instanz gibt es kein Problem, das MCP löst: Die Werkzeuge liegen im Register (`lib/zoe/register.ts`). Jeder fremde MCP-Server bringt Fremdtext und Rechte mit (OWASP ASI04 Lieferkette).

### 1.12 Cognition: vom „Don't build multi-agents“ (12.06.2025) zu „What's actually working“ (22.04.2026) [O]
- **2025:**
  - „Share context, and share full agent traces“.
  - „Actions carry implicit decisions, and conflicting decisions carry bad results“.
  - Beispiel Flappy Bird: Zwei Subagenten bauen unpassende Teile. Empfehlung damals: ein einziger linearer Agent mit Verdichtung.
- **2026 bewährt:**
  - **Schreiben bleibt in einem Strang**, weitere Agenten liefern Intelligenz.
  - **Prüfer-Schleife** mit sauberem eigenem Kontext: Devin Review findet etwa 2 Fehler je PR, davon etwa 58 % schwer.
  - **„Smart friend“** = schwächeres Modell eskaliert an ein stärkeres.
  - **„map-reduce-and-manage“** mit verwalteten Kindern.
- **2026 nicht bewährt:**
  - Parallele Schreiber.
  - „Arbitrary agent networks … mostly a distraction“.
  - Manager waren „overly prescriptive“.
  - Kinder nahmen an, sie teilten Zustand mit dem Manager.
  - „cross-agent communication did not happen by default“.

### 1.13 Vergleich auf einen Blick

| Frage | Agent als Werkzeug (Aufrufer behält Kontrolle) | Übergabe / Handoff (Kontrolle wandert) | Team mit Postfach + Aufgabenliste | Brett (gemeinsamer Arbeitsstand) |
|---|---|---|---|---|
| Vorbilder | OpenAI `as_tool`, ADK AgentTool, LangChain Subagents, Claude Subagents, Dust `run_agent` | OpenAI Handoffs, ADK `transfer_to_agent` | Claude Code Agent Teams | ADK `session.state`, Magentic-Ledger, Blackboard-Papers |
| Kontext | getrennt, nur Auftrag rein, Zusammenfassung raus | geteilt | getrennt, plus Nachrichten | getrennt, plus gemeinsamer Ausschnitt |
| Wer antwortet dem Menschen | der Aufrufer | der Spezialist | jeder, den man öffnet | der Leiter |
| Schleifen-Gefahr | gering (Baum) | mittel (Ping-Pong) | hoch (freie Nachrichten) | mittel (Leiter vermittelt) |
| Kosten | am niedrigsten | mittel | am höchsten | mittel |
| Passt zu MAKE OS | **ja, Grundform** | nur Mensch-zu-Agent („Thread öffnen“) | nein (V1) | **ja, für Hilfe untereinander** |

---

## 2 · „Mitarbeiter helfen einander“ — was in der Praxis funktioniert

### 2.1 Die Formen im Überblick

| Form | Was | Belege | Funktioniert? | Risiken | Für MAKE OS |
|---|---|---|---|---|---|
| **A · Prüfer / Kritiker** | Ein zweiter Agent prüft das Ergebnis gegen Kriterien, mit frischem Kontext | MAST: Prüfschritt +15,6 % (ChatDev/ProgramDev) [O]; Cognition: Devin Review, sauberer Kontext findet mehr [O]; Anthropic: Prüf-Subagent „usually effective“ [O]; Evaluator-Optimizer [O] | **ja, am besten belegt** | „early victory“ (prüft zu wenig) [O]; doppelte Kosten je Ergebnis | **Fest einbauen:** erst der Code-Prüfer (`pruefer.ts`-Muster), dann ein „Prüfer“-Mitarbeiter nur für Ergebnisse mit Außenwirkung oder Freigabe-Pflicht |
| **B · Rat holen (Eskalation an stärkeres Modell)** | Der Arbeiter fragt bei Unsicherheit ein stärkeres Modell, das den ganzen Verlauf liest | Anthropic Advisor-Tool (Beta seit 09.04.2026): Haiku+Opus auf BrowseComp 41,2 % statt 19,7 % solo, 85 % günstiger als Sonnet allein, aber 29 % unter dessen Ergebnis; Sonnet+Opus +2,7 Punkte bei 11,9 % weniger Kosten [O]; Cognition „smart friend“ [O] | **ja** | Beta; Advisor-Text bei neueren Modellen verschlüsselt (nicht lesbar); Zusatzkosten bei Opus-Preis | **Option** für Mitarbeiter auf „schnell“; `max_uses` je Lauf (Frage 11) |
| **C · Brett / gemeinsamer Arbeitsstand** | Plan, Teilaufgaben, Funde und offene Fragen an einer Stelle; Agenten lesen einen Ausschnitt und tragen ein | ADK `session.state` „whiteboard“, eindeutige Schlüssel [O]; Magentic Task-/Progress-Ledger [O]; Claude Agent Teams Aufgabenliste mit Sperre [O]; Salemi et al.: Brett mit Freiwilligen +13–57 % gegenüber dem besten Vergleich (Data-Science-Suche) [O, Abstract]; Han & Zhang 2025: konkurrenzfähig bei weniger Token [S] | **ja, wenn eine Leitung vermittelt** | Wettlauf beim Schreiben (ADK-Warnung); „Ansteckung“: ein kompromittierter Agent erreicht über das Brett alle (Terrarium-Paper [S]) | **Ja, je Auftrag ein Brett im Thread des Heads.** Schreiben nur über feste Werkzeuge, Einträge mit Herkunft und Fremdtext-Marke |
| **D · Hilferuf / Rückfrage** | Ein Agent meldet „brauche X“; Leitung oder Mensch beantwortet | A2A-Zustand `input-required` [O]; Magentic: Manager wählt den nächsten Sprecher [O]; Cognition: Kinder melden Funde nicht von selbst an Geschwister (offenes Problem) [O] | **ja, über die Leitung** | Warten blockiert; Kettenfragen | **`hilfe_anfragen` nur an den eigenen Head**, Lauf endet mit Status „wartet“, kein synchrones Warten |
| **E · Direkte Nachrichten zwischen Mitarbeitern (peer)** | Agenten schreiben einander frei | Claude Agent Teams [O]; Lindy Agent-zu-Agent [O, Konzept B1] | **teilweise** — gut für Recherche/Debugging, schlecht beim Schreiben | Anthropic: Subagenten „distracting each other with excessive updates“ [O]; MAST FM-2.x (Fehlabstimmung) [O]; OWASP ASI07 unsichere Agent-Kommunikation [S]; Kosten | **Nicht in V1.** Erst wenn Messung zeigt, dass Hilfe über den Head zu langsam ist |
| **F · Übergabe (peer handoff)** | Ein Mitarbeiter gibt seinen Vorgang an einen anderen ab | OpenAI Handoffs, ADK transfer [O] | ja, für Routing | Ping-Pong; Kontext geht verloren | **Nur durch den Head** („an X weitergegeben“), nie Mitarbeiter → Mitarbeiter |
| **G · Debatte / mehrere Meinungen** | Mehrere Agenten diskutieren bzw. stimmen ab | „Debate or Vote“ (NeurIPS 2025): **Abstimmung allein erklärt den Großteil der Gewinne**, Debatte allein erhöht die Trefferwahrscheinlichkeit nicht [O, Abstract]; Agent Teams „konkurrierende Hypothesen“ [O] | Abstimmung ja, Debatte selten | Kosten ×n | **Nur auf Knopfdruck:** „zweite Meinung“ = 2 unabhängige Entwürfe + Prüfer wählt (Frage 10) |
| **H · Skills teilen** | Bewährte Abläufe gespeichert und wiederverwendet | Voyager: wachsende Skill-Bibliothek, wiederverwendbar und kombinierbar [S, Abstract]; Agent Skills (Konzept B1) [O]; LangChain-Muster „Skills“ [O] | ja | Skills sind Anweisungen = Einfallstor (Konzept C9.4) | Skills gehören einem Head; „teilen“ = Kopie in einen anderen Head **per Klick** (Stapel-Art `skill`) |

### 2.2 Grenzen: Tiefe, Budget, Zyklen — was die Quellen sagen
- **Tiefe:**
  - Claude Code Subagents: Standard 3 Ebenen, abschaltbar.
  - Agent Teams: **keine** verschachtelten Teams.
  - Google: „Do not build a nested loop system on day one.“
  - Anthropic arbeitet mit Lead plus einer Ebene Subagenten. [alle O]
- **Zyklen:**
  - MAST misst **Schritt-Wiederholung 15,7 %** und **Ende nicht erkannt 12,4 %**.
  - Magentic zählt Runden ohne Fortschritt (`max_stall_count`) und plant dann neu (`max_reset_count`).
  - OpenAI bricht bei `max_turns` ab (`MaxTurnsExceeded`); der Standardwert steht nicht auf der Seite, also **nicht belegt**. [O]
- **Budget:**
  - Token erklären 80 % der Leistung (Anthropic). Deshalb ist eine **Kostengrenze zugleich eine Qualitätsgrenze**: zu knapp gibt schlechte Ergebnisse, zu weit gibt teure Schleifen.
  - Das Advisor-Tool hat `max_uses` je Anfrage. [O]
- **Kaskaden:** OWASP ASI08 „Cascading Failures“ [S]; Terrarium: Angriff über ein Brett springt auf alle über [S]. → **Fremdtext-Marke vererben** (Regel R9).

### 2.3 Empfehlung „Hilfe über den Head“ (Ablauf)
```
Mitarbeiter A (Kampagnen)                Head (Marketing)                  Mitarbeiter B (Content & Social)
  │ arbeitet am Auftrag „Herbst-Kampagne“
  │ hilfe_anfragen{frage, warum, wer?:"content"} ──► Brett: Frage #3 (offen, von A, fremd:ja/nein)
  │ Lauf endet: Status „wartet auf Hilfe #3“         │ nächste Runde des Heads (sofort als Auftrag eingereiht)
  │                                                   │ entscheidet: selbst beantworten | an B | an den Menschen
  │                                                   │ an_mitarbeiter{B, auftrag: Ziel/Format/Grenzen/Erledigt} ─► neuer Thread B (Eltern = Head-Thread)
  │                                                   │                                            │ arbeitet (nur lesen + Vorschlag)
  │                                                   │ ◄── Bericht (≤ 1.500 Token, fremd(), Belege) ┘
  │ ◄── Antwort #3 im Brett + neuer Lauf für A ───────┘
  │ setzt fort (gleicher Thread, neuer Lauf)
```
- **A wartet nie synchron auf B.** Das vermeidet Verklemmungen und hält einen Platz im Arbeiter frei (der Server hat 2 Plätze).
- **B schreibt nichts Wirksames.** Es gibt genau einen Schreiber je Vorgang (Cognition), und Wirkung entsteht nur über `fuehreAus`/Stapel.
- **Eine Kette trägt `kette: [agentIds]`.** Kein Agent erscheint zweimal in einer Kette, und eine Hilfe-Anfrage aus einem Hilfe-Lauf ist verboten (Regel R3).
- **Sichtbar:** Im Head-Chat steht „A fragt: … → an B gesendet ›“; das Brett ist eine Karte „Arbeitsstand“.

---

## 3 · Gedächtnis und Kontext

### 3.1 Was die Quellen empfehlen
- **Context engineering** (Anthropic, 29.09.2025) [O]:
  - Kontext ist knapp („attention budget“, „context rot“).
  - System-Prompt in der „right altitude“: wenige, starke Token.
  - Keine aufgeblähten, überlappenden Werkzeuge.
  - Wenige kanonische Beispiele statt langer Regellisten.
  - **Just-in-time-Laden** über Verweise.
- **Für lange Aufgaben drei Techniken:**
  - **Verdichtung** (Compaction): zuerst auf Vollständigkeit abstimmen, dann auf Kürze.
  - **Strukturierte Notizen außerhalb des Kontexts**, z. B. `NOTES.md` oder eine To-do-Liste.
  - **Subagenten** mit Zusammenfassungen von „often 1,000-2,000 tokens“.
- **API-Bausteine (Stand 08.10.2026)** [O]:
  - **Compaction** auf dem Server (Beta `compact-2026-09-04`, „on demand“ oder ab einer Token-Schwelle, eigener Zusammenfassungs-Prompt möglich).
  - **Context editing** (Beta `context-management-2025-06-27`: alte Werkzeugergebnisse und Denkblöcke löschen; `clear_at_least`, damit sich das Brechen des Caches lohnt).
  - **Memory-Tool** (`memory_20250818`): wird **auf der eigenen Seite** ausgeführt, die Ablage bestimmen wir. Pfade auf `/memories` begrenzen, Größe deckeln, Altes ablaufen lassen.
- **Lange Läufe** („Effective harnesses“, 26.11.2025) [O]:
  - Ein Fortschrittsprotokoll und eine Liste „was ist fertig“ (JSON).
  - **Eine Sache nach der anderen.**
  - Fertig erst nach einer Prüfung von Ende zu Ende.
  - Fehlerbilder: zu viel auf einmal, zu früh „fertig“.
- **Gedächtnis-Vergiftung:** OWASP ASI06 „Memory & Context Poisoning“ [S]. Regel aus P06: **externe Inhalte nie ungeprüft ins Langzeitgedächtnis**.

### 3.2 Schichten für MAKE OS (an den Bestand angedockt)

| Schicht | Inhalt | Wo | Wer schreibt | Bestand heute |
|---|---|---|---|---|
| **Arbeitskontext** | letzte 16 Nachrichten des Threads + Werkzeugergebnisse | Prompt | Lauf | `kimmi` (Verlauf noch aus dem Browser — Konzept A12) |
| **Thread-Kurzfassung** | Verdichtung älterer Züge (nie Gelöschtes, nie Fremdtext ungerahmt) | `agenten-faeden--<person>` | Server (eigener Haiku-Lauf oder API-Compaction) | neu (Konzept C4) |
| **Arbeitszettel je Lauf** | Plan, Schritte erledigt/offen, Erledigt-Kriterium, Budget-Stand | im Lauf-Zustand am Thread | Lauf (nur über festes Werkzeug `zettel`) | Vorbild: Absichtsprotokoll-Schritte |
| **Brett je Auftrag** | Teilaufgaben, Funde mit Beleg-Verweis, offene Fragen, Entscheidungen | im Eltern-Thread des Heads | Head + Mitarbeiter über feste Werkzeuge | neu |
| **Merksätze** (semantisch) | kurze Regeln „so machen wir das“ je Head/Mitarbeiter | `head-<id>.gedaechtnis` bzw. neu je Mitarbeiter | **nur über den Stapel** (Mensch klickt) | `HeadStand.gedaechtnis`, `fakt_merken` über Stapel |
| **Episoden** | was wurde vorgeschlagen, angenommen, abgelehnt, mit Grund | `zoe-entscheidungen--…`, Lernen der Heads | Server | vorhanden (`entscheidungen.ts`, `lernen.ts`) |
| **Wissen** | Vault/Brain, Arbeits-Index | Brain | Menschen; ZOE nur Vorschläge | vorhanden (`suche`, `suche_arbeit`) |

- **Kein freies „Memory-Datei schreibt sich selbst“** wie bei Claude Code oder dem Memory-Tool: Bei uns stünde dort Text Dritter (Kontaktnamen, Mails) dauerhaft und unkontrolliert. Das Memory-Tool lohnt höchstens als **Arbeitszettel** mit Ablauf beim Lauf-Ende.
- **Geteilte Mitarbeiter:** Die Vorlage ist geteilt, **Gedächtnis und Threads liegen je Head** (Kontakte des Sales-Heads gelangen nie in den Event-Head). Siehe Frage 5.

---

## 4 · Zuverlässigkeit

### 4.1 Fehlerarten (MAST, „Why Do Multi-Agent LLM Systems Fail?“, v3 26.10.2025) [O]
14 Fehlerarten in 3 Gruppen; Datensatz über 1.600 Läufe aus 7 Frameworks; Übereinstimmung der Menschen κ = 0,88. Anteile laut HTML v3:

| Fehler | Anteil | Gegenmittel in MAKE OS |
|---|---|---|
| FM-1.1 Auftrag missachtet | 11,8 % | Auftrags-Schema mit Pflichtfeldern (Ziel, Format, Grenzen, Erledigt-Kriterium) — Regel R10 |
| FM-1.2 Rolle missachtet | 1,5 % | Werkzeuge ⊆ Rolle (Server erzwingt) |
| FM-1.3 Schritte wiederholt | 15,7 % | Dedup gleicher Werkzeugaufrufe je Lauf; Stall-Zähler (R5) |
| FM-1.4 Verlauf verloren | 2,8 % | Verlauf nur vom Server; Kurzfassung |
| FM-1.5 Ende nicht erkannt | 12,4 % | Erledigt-Kriterium + Rundengrenze + Zeitgrenze |
| FM-2.1 Gespräch neu begonnen | 2,2 % | Thread-Kennung fest, Fortsetzen statt Neustart |
| FM-2.2 keine Rückfrage | 6,8 % | `hilfe_anfragen` / Status „wartet auf dich“ |
| FM-2.3 vom Thema abgekommen | 7,4 % | Arbeitszettel, Prüfer gegen Auftrag |
| FM-2.4 Information zurückgehalten | 0,85 % | Bericht-Format mit „offene Punkte“ |
| FM-2.5 Eingaben anderer ignoriert | 1,9 % | Brett-Ausschnitt im Prompt, Head prüft |
| FM-2.6 Denken ≠ Handeln | 13,2 % | Code-Prüfer vergleicht Behauptung mit Werkzeug-Ergebnis (Belege, wie `belege.ts`) |
| FM-3.1 zu früh beendet | 6,2 % | Prüfer, „fertig“ nur mit erfülltem Kriterium |
| FM-3.2 keine/unvollständige Prüfung | 8,2 % | Prüfer-Pflicht bei Außenwirkung |
| FM-3.3 falsche Prüfung | 9,1 % | Code-Prüfung vor KI-Prüfung; Evals |

Die Autoren schreiben: Mit gezielten Verbesserungen werden „not all failure modes … resolved“; größter Einzelgewinn ist der Prüfschritt (+15,6 %).

### 4.2 Evals je Agent
- **Anthropic:**
  - Klein anfangen (etwa 20 echte Fälle).
  - Ein LLM-Richter mit Rubrik (0–1 plus bestanden/nicht bestanden) und zusätzlich Menschen.
  - Bei ändernden Agenten den **Endzustand** prüfen. [O]
- **MAKE OS hat:**
  - `lib/heads/eval.ts` (pass^k, Wiederholungsfälle).
  - Demo-Saat für erfundene Daten.

**Empfehlung:**
- Je Head und je Mitarbeiter-Vorlage 10–20 Gold-Fälle aus der Demo-Saat.
- Je Skill die 3 Testfälle aus dem Konzept.
- Vor jeder Prompt-, Modell- oder Skill-Änderung ein Offline-Lauf.
- Autonomie-Aufstieg nur mit pass^3 über einer Schwelle, die Kevin festlegt (P06: Vorschlag 0,85, **nicht belegt**).

### 4.3 Nachvollziehbarkeit (Tracing)
| Werkzeug | Lage (08.10.2026) | Für MAKE OS |
|---|---|---|
| **Langfuse** | Seit 16.01.2026 Teil von ClickHouse; bleibt MIT-lizenziert und selbst hostbar [S]. Cloud-EU-Region laut aktueller Seite **Irland** (eu-west-1), ältere FAQ sagt Frankfurt [S]; AVV mit Langfuse GmbH Berlin [S]. **Self-Host per Docker Compose: mind. 4 Kerne, 16 GiB RAM, nicht für Produktion** (Postgres, ClickHouse, Redis, S3) [O] | passt **nicht** auf den Server; Cloud = neuer Empfänger mit Prompt-Inhalten → AVV, Drittland-Prüfung |
| **LangSmith** | EU-Hosting auf allen Stufen, AVV auf Anfrage [S] | dasselbe Problem (Inhalte gehen raus) |
| **OpenTelemetry GenAI** | Konventionen weiter Status **Development** (Drittquellen Mai–Sept. 2026) [S]; Spans `invoke_agent`, `execute_tool`; Inhalte (Prompts, Antworten, Argumente) standardmäßig **nicht** erfasst [S]; Spezifikation in eigenes Repo umgezogen [O] | **Namen übernehmen**, keine Plattform |

**Empfehlung:**
- Das vorhandene **KI-Protokoll** (nur Metadaten) wird zum **Lauf-Protokoll** erweitert: `lauf_id`, `eltern_lauf_id`, `agent` (zoe | head:<id> | mitarbeiter:<head>/<id>), `operation` (invoke_agent | execute_tool | chat), `werkzeug`, `runden`, Token (ein, aus, Cache lesen, Cache schreiben), Cent, Dauer, Ergebnis (ok | gestapelt | abgebrochen:<grund> | fehler).
- Feldnamen an `gen_ai.*` anlehnen.
- Daraus speisen sich „Läuft / Fertig“, die Kosten je Head und HOI-Zähler (Abbrüche, Stillstände, Fehlerquote).
- Inhalte bleiben im verschlüsselten Thread, nie im Protokoll.

### 4.4 Sicherheit und Prompt-Injection
- **Lethal Trifecta** (Willison, 16.06.2025) [O]:
  - Gefährlich ist ein Agent mit **privaten Daten + nicht vertrauenswürdigem Inhalt + einem Weg nach draußen**.
  - Leitplanken, die „95 %“ der Angriffe erkennen, sind „a failing grade“; „we still don't know how to 100% reliably prevent this“.
- **Agents Rule of Two** (Meta, 31.10.2025) [O]:
  - Je Sitzung höchstens zwei von drei Eigenschaften: [A] nicht vertrauenswürdige Eingabe, [B] Zugriff auf Sensibles, [C] Zustand ändern bzw. nach außen kommunizieren.
  - Braucht ein Lauf alle drei, dann ein frischer Kontext oder **menschliche Freigabe**.
- **Design Patterns** (Beurer-Kellner et al., 06/2025) [O Abstract / S Zusammenfassung]:
  - Sechs Muster: Action-Selector, Plan-Then-Execute, LLM Map-Reduce, Dual LLM, Code-Then-Execute, Context-Minimization.
  - Kernsatz: „once an LLM agent has ingested untrusted input, it must be constrained“.
- **„The Attacker Moves Second“** (10/2025, USENIX Security '26) [S]: 12 veröffentlichte Abwehren mit angepassten Angriffen meist zu über 90 % überwunden; menschliches Red-Teaming 100 %. → **Filter allein sind kein Schutz.**
- **OWASP Top 10 for Agentic Applications** (veröffentlicht 09.12.2025) [O Datum / S Liste]: ASI01 Agent Goal Hijack · ASI02 Tool Misuse · ASI03 Identity & Privilege Abuse · ASI04 Supply Chain · ASI05 Unexpected Code Execution · ASI06 Memory & Context Poisoning · **ASI07 Insecure Inter-Agent Communication** · **ASI08 Cascading Failures** · ASI09 Human-Agent Trust Exploitation · ASI10 Rogue Agents.

**Abgleich mit MAKE OS:**
- **Was die Regeln schon leisten:**
  - [C] ist durch Stapel und `fuehreAus` gedeckt (nichts nach außen ohne Klick).
  - [A] ist durch `fremd()` und „nur Vorschlag nach Fremdtext“ gedeckt.
  - Die Web-Suche nach vertraulichem Lesen ist schon gesperrt (#91). Das ist wichtig, weil Suchanfragen selbst Daten hinaustragen können.
- **Neu für Mehragenten:**
  - (1) Die Marke `fremdGelesen` **vererbt sich vom Eltern- auf den Kind-Thread und vom Bericht zurück**.
  - (2) Ein Auftrag eines Agenten an einen Agenten ist **Daten mit Auftragsfeldern**, nie eine Freigabe.
  - (3) Brett-Einträge tragen Herkunft und Fremdtext-Marke.
  - (4) Mitarbeiter mit Web-Zugang bekommen keine privaten Pakete in denselben Lauf. Das ist **Map-Reduce**: Recherche-Mitarbeiter sehen nur die Frage, nicht die CRM-Akte.

---

## 5 · Mensch im Ablauf und dauerhafte Läufe

### 5.1 Freigabe-Muster
| Muster | Beleg | MAKE OS heute | Empfehlung |
|---|---|---|---|
| Freigabe je Werkzeug | OpenAI `needs_approval`, n8n, HubSpot, Relevance [O, Konzept B1] | **ja**, Risiko im Register, Stapel | bleibt die einzige Stufe |
| Plan-Freigabe vor großen Aufträgen | Magentic `approve`/`revise` [O] | nein | **neu:** ab Kostenschätzung über Schwelle oder mehr als 2 Mitarbeitern (Frage 9) |
| Rückfrage („input required“) | A2A-Zustand [O]; MCP Elicitation über MRTR [O] | nur im Chat | Thread-Status „wartet auf dich“ + Glocke (neutral) |
| Eskalation bei Stillstand/Fehler | Magentic Stall → Neuplanung; OpenAI-Leitfaden: Mensch bei Fehlerschwelle [S] | Takt-Pause nach Fehlern | nach 2 Stall-Runden oder 2 Fehlern: Bericht an den Head bzw. Menschen statt Weiterprobieren |
| Freigabe sicher verbuchen | OpenAI: Identität nie aus dem Körper, gegen gespeicherte offene Punkte prüfen, atomar verbrauchen, Versionsmarke [O] | **ja** (`beanspruche`, `entschiedenVon` aus der Sitzung) | Versionsmarke der Agent-Definition/des Skills an jedem Lauf speichern |
| Bündeln gegen Freigabe-Müdigkeit | P06 [Meinung] | Stapel, Sammelfreigabe `risikoarm` | bleibt |

### 5.2 Autonomie-Stufen
- Feng, McDonald und Zhang („Levels of Autonomy for AI Agents“, 06/2025) [O, Abstract] ordnen fünf Stufen nach der **Rolle des Menschen**: **Operator · Collaborator · Consultant · Approver · Observer**. Sie schlagen „Autonomie-Zertifikate“ vor.
- **Unsere Zuordnung** (Meinung):
  - Chat = Operator/Collaborator.
  - Schreiben über den Stapel = **Approver** (Standard).
  - Interne Kleinigkeiten mit Rücknahme (`autonomie.ts`) = Observer.
- Aufstieg nur auf Vorschlag mit Klick; Abstieg automatisch bei sinkender Annahme- oder Eval-Quote (Fehlerbudget, P06 — **nicht unabhängig belegt**).

### 5.3 Dauerhafte Läufe (durable execution) — was auf 1 vCPU / 2 GB passt
| Dienst | Form | Bedarf | Bewertung |
|---|---|---|---|
| **Temporal** | Cluster-Dienste + Datenbank (Compose-Standard Postgres + Elasticsearch) [O]; Dev-Server „nicht für Dauerlast“ [O] | groß (Mindestwerte **nicht belegt**) | zu schwer |
| **Trigger.dev** (self-host) | Webapp + Worker, Postgres, Redis, Objektspeicher, Registry [O] | **mind. 3 vCPU/6 GB + 4 vCPU/8 GB** [O] | zu schwer |
| **Inngest** (self-host) | **eine Binärdatei**, SQLite standardmäßig, Redis im Speicher [O] | Mindestwerte **nicht belegt** | leichtester Fremddienst, aber ein zweiter Prozess, eigene Lizenz (nicht geprüft), eigene Datenablage außerhalb unserer Verschlüsselung |
| **Restate** | eine Binärdatei, eingebauter Speicher [O] | **nicht belegt** | wie Inngest |
| **DBOS Transact (TS)** | Bibliothek, braucht **Postgres** [S]; SQLite nur für Go [S] | Postgres-Dienst nötig | passt nicht (wir haben JSON-Bestände) |
| **Vercel Workflow DevKit** | `"use workflow"`/`"use step"` in Next.js, selbst gehostet über „Postgres World“ [S] | Postgres | passt nicht ohne Postgres |
| **MAKE OS heute** | `zoe-auftraege` (Pacht, 3 Versuche, Idempotenz), `worker.mjs` (2 Plätze), Absichtsprotokoll (`mitVorgang`, Schritte idempotent, Wiederaufnahme im Takt), Stapel | läuft | **ausbauen** |

**Empfehlung: durable execution light im Bestand**
1. **Ein Lauf ist ein Auftrag** (`art: 'agent', name: 'faden' | 'skill'`). Jede Modellrunde ist ein **Schritt**. Vor dem Ausführen der Werkzeuge wird der Lauf-Zustand am Thread gespeichert (Runde, Werkzeugaufrufe mit Kennung, Token-Stand). Fällt der Prozess aus, setzt der Arbeiter nach Ablauf der Pacht **an der letzten gespeicherten Runde** fort (Anthropic: „resume from the point of failure“).
2. **Jede Wirkung hat einen festen Schlüssel** `<lauf>:<runde>:<toolUseId>`. Die Stapel-Dedup und `einmalig()` verhindern Doppeltes (die LangGraph-Warnung zu Nebenwirkungen vor einer Pause gilt hier genauso).
3. **Warten kostet nichts:** Ein Lauf, der auf Freigabe, Hilfe oder Rückfrage wartet, **endet** mit Status `wartet`. Der Klick, die Hilfe-Antwort oder die Rückfrage reiht einen Fortsetzungs-Auftrag ein. Kein offener Prozess, kein `sleep`.
4. **Abbrechen und Not-Aus:** Der Status `abgebrochen` am Thread wird vor jeder Runde geprüft. Der Not-Aus setzt eine Instanz-Marke, die Takt und Arbeiter vor jedem Schritt lesen.
5. **Neue Dienste: keine.** Erst wenn ein größerer Server kommt (Kunden-Instanzen), Inngest bzw. Restate erneut prüfen.

---

## 6 · Kosten und Tempo

### 6.1 Zahlen (Stand 08.10.2026) [O]
- **Token-Faktoren:** Agent etwa 4×, Mehragenten etwa 15× (Anthropic 2025); 3–10× gegenüber einem einzelnen Agenten (Anthropic 2026).
- **Preise je Mio. Token (Eingabe/Ausgabe):**
  - Fable 5.1: 10 $ / 50 $
  - **Opus 5.5:** 4 $ / 20 $
  - **Sonnet 5.5:** 2 $ / 10 $
  - **Haiku 5.5:** ab 0,10 $ / 0,50 $
  - Zum Vergleich die Stufen in MAKE OS laut Konzept A5: Haiku 4.5 mit 1 $ Eingabe und Sonnet 5 mit 2 $ Eingabe; beide stehen inzwischen als „legacy“ in der Doku.
  - Abschaltung frühestens am 22.09.2027 (Opus 5.5) bzw. 07.10.2027 (Haiku 5.5).
- **Prompt-Cache:**
  - Schreiben 1,25× (5 Min.) bzw. 2× (1 Std.), Lesen 0,1× (Opus 5.5 und Sonnet 5.5: 0,05×).
  - Höchstens 4 Cache-Punkte.
  - **Mindestlänge: Haiku 4.5 4.096 Token, Sonnet 5 1.024, Opus 5.5 / Sonnet 5.5 / Haiku 5.5 512.** Kürzere Prompts werden still nicht gecacht.
  - Caches sind je Workspace getrennt.
- **Batch-API:** −50 %, meist unter 1 Std., spätestens nach 24 Std. abgelaufen, Ergebnisse 29 Tage abrufbar. Cache-Treffer im Batch mit 1-Std.-Cache besser.
- **Advisor-Tool (Beta `advisor-tool-2026-03-01`):**
  - Gültige Paare u. a. Haiku 4.5 + Opus 5.5 und Sonnet 5 + Opus 5.5.
  - Der Advisor kostet zum Preis seines Modells, schreibt aber kurz (laut Blog 400–700 Token).
  - `max_uses` je Anfrage.
  - Antworten neuerer Advisor-Modelle sind verschlüsselt, ihr Text ist für uns nicht lesbar.
- **Tool Search:**
  - „Claude's ability to pick the right tool degrades once you exceed 30–50 available tools.“
  - Sinnvoll ab etwa 10 Werkzeugen; `defer_loading` erhält den Cache.

### 6.2 Was daraus für MAKE OS folgt
1. **Delegieren nur, wenn eine der drei Lagen vorliegt** (Kontext-Schutz, Parallelität, Spezialisierung). Sonst antwortet der Head selbst. Die Aufwandsregel gehört in den Head-Prompt (Anthropic-Vorbild): eine Frage = keine Delegation, Recherche/Entwurf = 1 Mitarbeiter, Kampagne = höchstens 3.
2. **Modellstufen per Eval neu prüfen** (Frage 11). Die günstigeren 5.5-Modelle bei gleicher Qualität senken die Kosten der Mitarbeiter deutlich. Haiku 4.5 cacht unsere kurzen Mitarbeiter-Prompts gar nicht (Grenze 4.096 Token).
3. **Cache bewusst setzen:**
   - System-Prompt des Heads und Werkzeugliste bleiben stabil, sie bilden Cache-Punkt 1.
   - Das Datenpaket ist Punkt 2 (heute schon so in `lib/heads/lauf.ts`).
   - Den 1-Std.-Cache nur dort, wo Menschen mit Pausen über 5 Min. im selben Thread weiterschreiben. Bei zwei Zügen mit mehr als 5 Min. Abstand innerhalb einer Stunde: 2,0 + 0,1 = 2,1 statt 1,25 + 1,25 = 2,5 (Faktor auf den Eingabepreis, eigene Rechnung).
   - Erst messen (`verbrauch.ts` kennt Cache lesen und schreiben).
4. **Nacht und ohne Eile über die Batch-API:** Wochen- und Monatsreviews, Skill-Testläufe, Evals, die App-Spiegel-Kurzfassung. Das braucht einen Batch-Weg in `lib/anthropic.ts` hinter dem KI-Tor.
5. **Parallelität:**
   - Server: 2 Arbeiter-Plätze (`MAX_PARALLEL` bei ≤ 2 Kernen).
   - Je Person höchstens 3 Mitarbeiter-Läufe (Konzept C3), je Auftrag höchstens 3 gleichzeitige Mitarbeiter.
   - Modellaufrufe warten auf das Netz, der Engpass ist der Arbeitsspeicher des einen Node-Prozesses, nicht die CPU (**eigene Einschätzung, nicht gemessen**).
6. **Werkzeuge:** Höchstens 20 je Head und höchstens 10 je Mitarbeiter, ohne Überschneidung. ZOE bekommt Lese- und Delegations-Werkzeuge statt heute etwa 66 (Frage 14). Tool Search ist nur der Notweg, falls ZOE doch viele behält.
7. **Kostenschätzung vor großen Aufträgen** aus dem gemessenen Mittel je Lauf-Art (`verbrauch.ts` nach `zweck`), nie geraten. Wenn noch keine Messung vorliegt, steht dort „noch keine Erfahrung“.

---

## 7 · Empfehlung für MAKE OS (passend zum Bestand)

### 7.1 Grundform
- **Hierarchie mit Agenten als Werkzeugen:** ZOE → Head → Mitarbeiter. Der Auftraggeber behält die Kontrolle, zurück kommt ein Bericht. Das ist das am breitesten belegte Muster mit den geringsten Kosten und Schleifen.
- **Direkt ansprechbar** (Kevins Wunsch, Vorbild Claude Projects und Agent Teams): Jeder Thread lässt sich öffnen und fortführen. Das ist **die einzige Form der Übergabe**: Nur der Mensch wechselt den Gesprächspartner, Agenten übergeben einander nie die Kontrolle.
- **Hilfe untereinander über das Brett des Heads** (2.3). Keine freien Agent-zu-Agent-Nachrichten in V1.
- **Ein Schreiber je Vorgang:** Nur der Thread, der den Auftrag führt, schlägt Wirkungen vor; Helfer liefern Text, Funde und Prüfungen.
- **Prüfer zweistufig:** erst der Code-Prüfer (IDs, Kanal-Ampel, Zahlen, Fristen; Muster aus `lib/heads/pruefer.ts` und `lib/finanzen/chef/pruefer.ts`), dann bei Außenwirkung ein KI-Prüfer mit frischem Kontext (nur Ergebnis + Kriterien + Belege).
- **Kein A2A, kein internes MCP, kein fremdes Framework.** Eine Schleife für alle (`lib/agenten/schleife.ts`, Konzept C7/Paket 4) direkt auf `askText`, wie Anthropic rät („start by calling LLM APIs directly“).

### 7.2 Andocken an den Bestand
| Bestand | Rolle im Agenten-Bereich |
|---|---|
| **KI-Tor** (`askText` → `kiTor`) | jeder Lauf mit `ki: { lauf, person, kategorien }` — Kategorien = die des Heads (Konzept C5); Mitarbeiter ⊆ Head |
| **Register + `fuehreAus`** | einzige Wirkungsstelle; Risiko bleibt am Werkzeug; Skills/Mitarbeiter können nie lockern |
| **Stapel + Entscheidungen** | Freigaben, auch neue Arten `skill`, `merksatz`, `plan` (Plan-Freigabe); Entscheidungs-Protokoll unverändert |
| **`fremd()` + Gesprächsschutz** | Marke am Thread (Server), **vererbt** über Delegation; Berichte immer gekapselt |
| **Heads-Lauf** (Grundlauf → Modell → Prüfer) | Motor der **eingebauten Skills**; Grundlauf = Rückfall bei Budget-Ende oder leerem Guthaben |
| **Aufträge + Arbeiter + Absichtsprotokoll** | dauerhafte Läufe (5.3); Pacht, 3 Versuche, Wiederaufnahme |
| **Takt** (`faellig`) | Zeitpläne der Skills und „Als Nächstes“ aus **denselben** Regeln |
| **Verbrauch + KI-Protokoll** | Lauf-Protokoll mit Eltern-Kennung (4.3), Budgets, Kostenschätzung |
| **JSON-Bestände** | Threads (mit Brett und Lauf-Zustand), Skills, Einstellungen — Einzeländerungen mit Stand, Sperren, nie still kürzen |

### 7.3 Bewusst nicht (V1)
- Kein freier Postfach-Verkehr zwischen Agenten, keine Debatte im Hintergrund, keine parallelen Schreiber.
- Keine Tiefe 3.
- Kein externer Tracing-Dienst, kein Workflow-Dienst, kein selbst schreibendes Langzeitgedächtnis.
- Kein Skill-Import aus fremden Quellen (Konzept C9.4).

---

## 8 · Konkrete Regeln

**R1 · Tiefe 2.**
- ZOE (Ebene 0) → Head (1) → Mitarbeiter (2).
- Mitarbeiter haben **kein** Delegations-Werkzeug.
- Ein Fach-Agent (`runAgent`) im Mitarbeiter zählt als Werkzeug-Aufruf ohne eigene Delegation.

**R2 · Wer beauftragt wen:**

| Auftraggeber | darf beauftragen | darf nicht |
|---|---|---|
| Mensch (Sitzung) | ZOE, jeden sichtbaren Head, jeden Mitarbeiter direkt, Skills starten | Heads/Threads außerhalb seiner Sicht (Server 403) |
| ZOE | Heads (`an_head`, `head_fragen`) | Mitarbeiter direkt (V1), Privat-Heads einer anderen Person |
| Head | eigene Mitarbeiter (`an_mitarbeiter`); andere Heads **nur über ZOE** (Kevin, Antwort 10) | fremde Mitarbeiter, sich selbst |
| Mitarbeiter | niemanden; nur `hilfe_anfragen` an den eigenen Head | andere Mitarbeiter, Heads, ZOE |
| Takt / Skill-Zeitplan | den Head bzw. Mitarbeiter des Skills, **im Namen der Person, der der Skill gehört** | Läufe ohne Person für persönliche Bestände (`KEINE_PERSON`) |

**R3 · Zyklen.**
- Jeder Lauf trägt `kette` (Agenten-Kennungen von ZOE abwärts). Kein Agent darf zweimal in einer Kette stehen.
- Ein Hilfe-Lauf darf keine Hilfe anfragen.
- Höchstens 1 Hilfe-Anfrage je Lauf und 3 je Thread.
- Dieselbe Frage (Fingerabdruck) wird nicht zweimal gestellt.

**R4 · Ein Schreiber.**
- Nur der Thread, der den Vorgang führt, darf Werkzeuge mit Wirkung aufrufen, und das immer über `fuehreAus`.
- Helfer, Prüfer und Recherche-Mitarbeiter haben nur Lese-Werkzeuge plus Brett-Werkzeuge.

**R5 · Grenzen je Lauf** (Startwerte, danach nach Messung anpassen):
- **Chat:** 3 Runden und 14 Werkzeuge je Zug (wie `kimmi` heute).
- **Mitarbeiter:** 6 Runden, 14 Werkzeugaufrufe, 5 Minuten, Kostendeckel je Lauf (Cent, aus Einstellungen).
- **Stall:** 2 Runden ohne neuen Brett-Eintrag und ohne erfolgreiches Werkzeug lösen den Abbruch mit Bericht „festgefahren“ aus.
- **Gleicher Werkzeugaufruf** (Name plus Eingabe) zweimal im selben Lauf: Der zweite wird nicht ausgeführt, sondern erhält die frühere Antwort.

**R6 · Parallelität.**
- Arbeiter 2 Plätze (Server).
- Je Person höchstens 3 laufende Mitarbeiter-Läufe, je Auftrag höchstens 3 gleichzeitig.
- Was darüber hinausgeht, wartet sichtbar in „Läuft“ als „wartet“.

**R7 · Budget.**
- Kostendeckel je Lauf (hart).
- Monatsgrenze je Head: Bei 80 % kommt eine Warnung (Glocke), bei 100 % gilt die Antwort auf Frage 16.
- Kostenschätzung vor Aufträgen mit mehr als einem Mitarbeiter oder über der Schwelle, aus gemessenen Mittelwerten.
- Im Messmonat (ROADMAP) wird nur angezeigt.

**R8 · Modelle.**
- Plan, Review und Prüfer bei Außenwirkung: „stark“.
- Chat mit Head oder ZOE: „ausgewogen“.
- Mitarbeiter: „schnell“, optional mit Advisor (Frage 11).
- Die Stufe steht an der Definition (Head, Mitarbeiter, Skill), nie im Prompt.

**R9 · Fremdtext.**
- `fremdGelesen` gilt am Thread (Server) und **vererbt sich** auf Kind-Threads (Auftrag) und zurück (Bericht).
- Danach gilt „nur Vorschlag“ für alle schreibenden Werkzeuge.
- Rule of Two je Lauf: Recherche-Mitarbeiter mit Web bekommen keine privaten Pakete in denselben Lauf (Map-Reduce).
- **Nachrichten von Agenten sind nie Zustimmung.**

**R10 · Auftrag-Schema** (Pflicht, vom Werkzeug-Schema erzwungen):
- Ziel (1 Satz)
- Ausgabeformat
- Grenzen (was nicht)
- Quellen bzw. Werkzeughinweise
- **Erledigt-Kriterium**
- Budget-Rahmen
- Frist (optional)

**R11 · Bericht-Schema.**
- Zusammenfassung höchstens 1.500 Token (Anthropic: 1.000–2.000).
- Belege als Verweise.
- Offene Punkte und Vorschläge (gestapelt bzw. nicht).
- Kosten.
- Der ganze Thread bleibt nachlesbar.

**R12 · Gedächtnis.**
- Merksätze nur über den Stapel, mit Herkunft („von dir“ / „aus Thread X, bestätigt“).
- Nie Fremdtext ins Langzeitgedächtnis.
- Kurzfassung und Arbeitszettel schreibt nur der Server.
- Gelöschtes kommt nie zurück.

**R13 · Skills.**
- Anleitung nur von Menschen oder per Klick freigegeben.
- Werkzeuge ⊆ Head bzw. Mitarbeiter.
- Version am Lauf gespeichert.
- „Teilen“ legt eine Kopie im Ziel-Head an und braucht eine Freigabe.

**R14 · Plan-Freigabe** bei Aufträgen über der Kostenschwelle, mit mehr als 2 Mitarbeitern oder an mehrere Heads (Frage 9).

**R15 · Unterbrechen.**
- Status `abgebrochen` und Not-Aus werden vor jeder Runde geprüft.
- Warten auf Mensch oder Hilfe beendet den Lauf (Status `wartet`), fortgesetzt wird über einen neuen Auftrag.

**R16 · Protokoll.**
- Jeder Lauf mit `lauf_id`/`eltern_lauf_id` und Werten nach `gen_ai.*`.
- Nie Inhalte, nie Namen.
- 12 Monate wie das KI-Protokoll.

**R17 · Evals.**
- Je Head und Mitarbeiter-Vorlage 10–20 Gold-Fälle (Demo-Saat).
- Je Skill mindestens 3 Fälle.
- Pflicht vor Prompt-, Modell- oder Skill-Änderung.
- Bei ändernden Agenten den Endzustand prüfen.

**R18 · Autonomie.**
- Aufstieg nur auf Vorschlag mit Klick.
- Abstieg automatisch, wenn die Annahmequote oder pass^k unter die Schwelle fällt.

**R19 · Schalter gelten für alle Ebenen:** Hintergrund-KI aus, Bereichs-Sperren, Business-frei, Not-Aus, Gesundheits-Einwilligung (b).

**R20 · Rechte.** Ein Lauf hat die Rechte der **auslösenden Person** ∩ der Werkzeuge der Rolle, nie mehr. Threads gehören dem Besitzer (Konzept C5).

---

## 9 · Entscheidungsfragen an Kevin

Jeweils mit Optionen; **★ = meine Empfehlung**.

1. **Wie helfen Mitarbeiter einander?**
   - a) ★ Nur über den Head: Brett + `hilfe_anfragen`, der Head vermittelt
   - b) Direkte Nachrichten zwischen Mitarbeitern (wie Claude Agent Teams)
   - c) Offenes Brett, Mitarbeiter melden sich freiwillig (Blackboard-Papers)
   - d) Gar nicht, nur der Head setzt zusammen
   - e) Nur als Prüfer
2. **Fester Prüfer je Head?**
   - a) ★ Ja, für alles mit Außenwirkung oder Freigabe-Pflicht (zuerst der Code-Prüfer, dann ein KI-Prüfer mit frischem Kontext)
   - b) Ja, für jedes Mitarbeiter-Ergebnis
   - c) Nur der vorhandene Code-Prüfer, kein KI-Prüfer
   - d) Nur auf Knopfdruck „prüfen lassen“
3. **Tiefe der Hierarchie?**
   - a) ★ 2 fest (ZOE → Head → Mitarbeiter)
   - b) 3 (Mitarbeiter dürfen Unter-Mitarbeiter)
   - c) 1 (Mitarbeiter nur als Werkzeug, ohne eigenen Thread)
   - d) Je Head einstellbar
4. **Darf ZOE Mitarbeiter direkt beauftragen?**
   - a) ★ Nein, nur Heads (sauberer Datenausschnitt)
   - b) Ja, wenn der Head zustimmt
   - c) Ja, frei
   - d) ZOE darf nur fragen, beauftragen tut immer der Mensch
5. **Geteilte Mitarbeiter (z. B. „Research“ für Sales und Marketing):**
   - a) ★ Eine Vorlage, je Head eigene Threads und eigenes Gedächtnis
   - b) Ein gemeinsamer Mitarbeiter mit einem Gedächtnis
   - c) Keine geteilten Mitarbeiter in V1
   - d) Geteilt nur Fachwissen (Skills), Kontakte und Daten je Head
6. **Wo liegt der gemeinsame Arbeitsstand („Brett“)?**
   - a) ★ Je Auftrag im Thread des Heads, sichtbar als Karte „Arbeitsstand“
   - b) Ein Brett je Head für alle Aufträge
   - c) Ein Brett auf ZOE-Ebene für alle Heads
   - d) Kein Brett, nur Threads und Berichte
7. **Gedächtnis der Mitarbeiter:**
   - a) ★ Merksätze je Mitarbeiter **nur über den Stapel** + serverseitige Thread-Kurzfassung
   - b) Lernt selbst ohne Klick (Memory-Datei wie bei Claude Code)
   - c) Nur das Gedächtnis des Heads
   - d) Kein Gedächtnis, jeder Auftrag frisch
8. **Motor für Hintergrundaufgaben:**
   - a) ★ Eigene Warteschlange + Absichtsprotokoll ausbauen (Schritte, Fortsetzen, Warten = Lauf endet)
   - b) Inngest als Einzel-Binärdatei auf dem Server
   - c) Vercel Workflow DevKit + Postgres
   - d) Temporal oder Trigger.dev (nur mit größerem Server)
9. **Plan-Freigabe vor großen Aufträgen?**
   - a) ★ Ja, ab Kostenschätzung über der Schwelle oder mehr als 2 Mitarbeitern oder bei Aufträgen an mehrere Heads
   - b) Immer
   - c) Nie, nur die Wirkungen gehen in den Stapel
   - d) Nur bei Aufträgen, die ZOE selbst startet
10. **„Zweite Meinung“ bei wichtigen Entwürfen?**
    - a) ★ Auf Knopfdruck: zwei unabhängige Entwürfe, der Prüfer wählt (Abstimmung statt Debatte)
    - b) Automatisch bei Außenwirkung
    - c) Debatte zwischen Mitarbeitern
    - d) Statt dessen „Rat holen“ beim stärkeren Modell (Advisor)
    - e) Gar nicht
11. **Modellstufen neu einordnen?**
    - a) ★ Nach Eval-Vergleich: schnell = Haiku 5.5, ausgewogen = Sonnet 5.5, stark = Opus 5.5
    - b) Bleiben (Haiku 4.5 / Sonnet 5 / Opus 5.5)
    - c) Wie a), dazu Fable 5.1 für Monats- und Strategie-Reviews
    - d) Wie a), dazu Advisor-Tool (Beta) für Mitarbeiter mit `max_uses` 1–2
12. **Nachtläufe über die Batch-API (−50 %)?**
    - a) ★ Ja, für Reviews, Skill-Tests und Evals ohne Eile
    - b) Nein, alles sofort
    - c) Alles im Hintergrund über Batch, auch Mitarbeiter-Läufe
13. **Nachvollziehbarkeit (Tracing):**
    - a) ★ Eigenes Lauf-Protokoll mit OpenTelemetry-Namen in MAKE OS, ohne Inhalte
    - b) Langfuse Cloud EU (neuer Empfänger mit Inhalten, AVV nötig)
    - c) Langfuse selbst gehostet (eigener Server ≥ 4 Kerne / 16 GiB)
    - d) LangSmith EU
14. **Was passiert mit ZOEs etwa 66 Werkzeugen?**
    - a) ★ ZOE behält Lesen, Delegieren und wenige Alltags-Werkzeuge (≤ 20), der Rest wandert zu den Heads
    - b) Alle behalten, dazu Tool Search (`defer_loading`)
    - c) Bleibt wie heute
    - d) a) und b) zusammen
15. **Autonomie und Fehlerbudget:**
    - a) ★ Abstieg automatisch bei sinkender Quote, Aufstieg nur per Klick
    - b) Stufen nur von Hand
    - c) Automatisch auf und ab
    - d) Keine Stufen, alles bleibt Freigabe
16. **Was passiert bei 100 % des Monatsbudgets eines Heads?**
    - a) ★ Regelwerk-Rückfall (Grundlauf), Chat nur noch auf „schnell“, Glocke
    - b) Head pausiert ganz bis Monatsende
    - c) Läuft weiter, nur Warnung
    - d) Nachfrage per Klick „Budget einmalig erhöhen“
17. **Offene Protokolle (MCP/A2A):**
    - a) ★ V1 nicht; später MAKE OS als MCP-Server für Kunden-Instanzen prüfen
    - b) Jetzt fremde MCP-Werkzeuge anbinden
    - c) A2A, damit Kunden-Agenten mit unseren Heads sprechen
    - d) Nie
18. **Andere KI-Anbieter (Kevins Idee: Gemini für Research, Bildmodelle):**
    - a) ★ Später, nur hinter dem KI-Tor als eigener Anbieter-Eintrag mit AVV und Empfänger-Register; vorher eigene Recherche
    - b) Jetzt für Research
    - c) Jetzt für Bilder
    - d) Nie, nur Claude

---

## 10 · Quellen (alle abgerufen am 08.10.2026)

**Anthropic**
- [O] Building effective agents (19.12.2024): https://www.anthropic.com/engineering/building-effective-agents
- [O] How we built our multi-agent research system (13.06.2025): https://www.anthropic.com/engineering/multi-agent-research-system
- [O] Effective context engineering for AI agents (29.09.2025): https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- [O] Effective harnesses for long-running agents (26.11.2025): https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- [O] Building multi-agent systems: when and how to use them (23.01.2026): https://www.claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them
- [O] The advisor strategy (09.04.2026): https://claude.com/blog/the-advisor-strategy
- [O] Claude Code Subagents: https://code.claude.com/docs/en/sub-agents
- [O] Claude Code Agent Teams: https://code.claude.com/docs/en/agent-teams
- [O] Advisor tool: https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool
- [O] Prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- [O] Batch processing: https://platform.claude.com/docs/en/build-with-claude/batch-processing
- [O] Context editing: https://platform.claude.com/docs/en/build-with-claude/context-editing
- [O] Compaction: https://platform.claude.com/docs/en/build-with-claude/compaction
- [O] Memory tool: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- [O] Tool search tool: https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
- [O] Models overview (Preise, Retirement): https://platform.claude.com/docs/en/about-claude/models/overview

**OpenAI**
- [O] Agents SDK, Orchestrating multiple agents: https://openai.github.io/openai-agents-python/multi_agent/
- [O] Human-in-the-loop: https://openai.github.io/openai-agents-python/human_in_the_loop/
- [O] Guardrails: https://openai.github.io/openai-agents-python/guardrails/
- [O] Running agents (`max_turns`, Sessions): https://openai.github.io/openai-agents-python/running_agents/
- [S] A practical guide to building agents: https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/ (heute 403; Prüfung vom 05.10. in `research/ai-ceo/P06-auszug.md`)

**Google**
- [O] Developer's guide to multi-agent patterns in ADK (16.12.2025): https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/
- [O] Where to use sub-agents versus agents as tools (08.11.2025): https://cloud.google.com/blog/topics/developers-practitioners/where-to-use-sub-agents-versus-agents-as-tools
- [O] A2A Releases: https://github.com/a2aproject/A2A/releases · Spezifikation: https://a2a-protocol.org/latest/specification/
- [S] A2A bei der Linux Foundation: https://en.wikipedia.org/wiki/Agent2Agent · ADK-Fehler #3758: https://github.com/google/adk-python/issues/3758

**LangChain / CrewAI / Microsoft**
- [O] LangChain Multi-agent: https://docs.langchain.com/oss/python/langchain/multi-agent
- [O] LangGraph Interrupts: https://docs.langchain.com/oss/python/langgraph/interrupts
- [S] Migration langgraph-supervisor: https://docs.langchain.com/oss/python/migrate/langgraph-supervisor.md · https://reference.langchain.com/python/langgraph-supervisor
- [O] CrewAI Hierarchical Process: https://docs.crewai.com/en/learn/hierarchical-process
- [O] Microsoft Agent Framework, Magentic (aktualisiert 06.10.2026): https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/magentic
- [O] Magentic-One (arXiv 2411.04468): https://arxiv.org/abs/2411.04468
- [S] Agent Framework 1.0 GA / AutoGen Wartung: https://rywalker.com/research/microsoft-agent-framework · https://rywalker.com/research/autogen

**MCP**
- [O] The 2026-07-28 Specification: https://blog.modelcontextprotocol.io/posts/2026-07-28/

**Cognition**
- [O] Don't Build Multi-Agents (12.06.2025): https://cognition.com/blog/dont-build-multi-agents
- [O] Multi-Agents: What's Actually Working (22.04.2026): https://cognition.com/blog/multi-agents-working

**Forschung**
- [O] Cemri et al., Why Do Multi-Agent LLM Systems Fail? (MAST, v3 26.10.2025): https://arxiv.org/abs/2503.13657 · https://arxiv.org/html/2503.13657v3
- [O, Abstract] Choi et al., Debate or Vote (NeurIPS 2025): https://arxiv.org/abs/2508.17536v1
- [O, Abstract] Salemi et al., LLM-Based Multi-Agent Blackboard System (v2 31.01.2026): https://arxiv.org/abs/2510.01285
- [S] Han & Zhang, Blackboard Architecture (07/2025): https://arxiv.org/pdf/2507.01701 · Terrarium (10/2025): https://arxiv.org/pdf/2510.14312
- [S] Wang et al., Voyager (Skill-Bibliothek): https://arxiv.org/abs/2305.16291
- [O, Abstract] Feng, McDonald, Zhang, Levels of Autonomy for AI Agents: https://arxiv.org/abs/2506.12469

**Sicherheit**
- [O] Willison, The lethal trifecta (16.06.2025): https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/
- [O] Meta, Agents Rule of Two (31.10.2025): https://ai.meta.com/blog/practical-ai-agent-security/
- [O, Abstract] Beurer-Kellner et al., Design Patterns for Securing LLM Agents (06/2025): https://arxiv.org/abs/2506.08837 · [S] Zusammenfassung: https://simonwillison.net/2025/Jun/13/prompt-injection-design-patterns/
- [S] Nasr et al., The Attacker Moves Second (10/2025): https://arxiv.org/abs/2510.09023 · https://simonw.substack.com/p/new-prompt-injection-papers-agents
- [O Datum / S Liste] OWASP Top 10 for Agentic Applications (09.12.2025): https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/ · Liste: https://cycode.com/blog/owasp-top-10-agentic-applications/

**Beobachtbarkeit**
- [O] Langfuse Self-Hosting: https://langfuse.com/self-hosting · Docker Compose (4 Kerne/16 GiB): https://langfuse.com/self-hosting/deployment/docker-compose
- [S] Langfuse Datenregionen: https://langfuse.com/security/data-regions · Übernahme durch ClickHouse (16.01.2026): https://clickhouse.com/blog/clickhouse-acquires-langfuse-open-source-llm-observability
- [S] LangSmith EU: https://changelog.langchain.com/announcements/eu-data-residency-for-langsmith
- [O] OpenTelemetry GenAI-Konventionen (umgezogen): https://github.com/open-telemetry/semantic-conventions-genai · [S] Status: https://www.dash0.com/knowledge/opentelemetry-genai-semantic-conventions-explained

**Dauerhafte Läufe**
- [O] Inngest Self-Hosting: https://www.inngest.com/docs/self-hosting
- [O] Trigger.dev Self-Hosting: https://trigger.dev/docs/self-hosting/docker
- [O] Temporal Deployment: https://docs.temporal.io/self-hosted-guide/deployment
- [O] Restate Server: https://docs.restate.dev/server/overview
- [S] DBOS Transact TS (v2.0): https://dbos.dev/blog/dbos-transact-v2-typescript · Juni 2026: https://dbos.dev/blog/new-in-dbos-june-2026
- [S] Vercel Workflow DevKit, Postgres World: https://useworkflow.dev/worlds/postgres · Human-in-the-loop: https://useworkflow.dev/docs/ai/human-in-the-loop
