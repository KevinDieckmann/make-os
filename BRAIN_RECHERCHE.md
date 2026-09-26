# BRAIN-Recherche — Best Practices für das MAKE-OS-Gedächtnis

**Datum:** 26.09.2026
**Auftrag (Kevin):** „Hol dir die Marktforschung der Top 1 % der KI-Hirne — 40 Berichte — und geh sie mit den Best Practices durch." Ziel: die Brain-Abteilung (`/os/wissen`, gespeist aus `make-vault`) neu aufbauen — Wiki-Chat über alles, Regelwerk fürs Brain, Informationsaustausch Kevin ↔ Malin ↔ Jarvis, selbstwachsendes Gedächtnis auf dem eigenen Server.
**Quellen:** 70 nummerierte Quellen (Paper, Hersteller-Doku, Standards, Praxisberichte), Schwerpunkt 2025/2026; ältere Grundlagenpapiere (CoALA, MemGPT, Reflexion, Generative Agents, Constitutional AI) nur dort, wo sie bis heute die Referenz sind.
**Methode:** 44 Web-Suchen über sechs Themenfelder, 17 Primärquellen per Volltext gegengelesen (Anthropic Memory-Tool-Doku, Claude-Code-Memory-Doku, Letta, Mem0 „State of Memory 2026", Model Spec 08/2026, Claude-Konstitution, LongMemEval, Governed Shared Memory, Mem0 Security, Wikimedia, Pexon-Embedding-Vergleich u. a.). Herstellerzahlen (Mem0, Zep) sind Eigenangaben und so markiert. Selbstgetestet wurde nichts; die Rahmenbedingungen (1 vCPU / 2 GB RAM, Next.js/TypeScript, SQLite geplant, Anthropic-API, zwei Personen, DSGVO) sind in jede Empfehlung eingerechnet.

---

## 1. Agenten-Gedächtnis-Architekturen

**Was die Besten tun**

- **Gemeinsame Taxonomie (CoALA):** Arbeitsgedächtnis = Kontextfenster; Langzeit = *episodisch* (Erlebnisse/Sitzungen), *semantisch* (Fakten/Wissen), *prozedural* (Regeln, Anweisungen, Abläufe). LangMem setzt genau diese drei um; „prozedural" heißt dort: der Agent schreibt seine eigenen Anweisungen fort. [8][11]
- **Gedächtnis als Betriebssystem (MemGPT → Letta):** kleine, immer geladene *Kern-Blöcke* (Persona, Nutzerprofil, aktueller Auftrag), die der Agent selbst per Tool editiert; *Recall* = durchsuchbare Historie; *Archiv* = Vektor/Graph. Neu 2025: „Sleep-time compute" — Konsolidierung läuft asynchron im Leerlauf, nicht während des Gesprächs. [1][2]
- **Extraktion statt Rohspeicherung (Mem0):** aus jedem Gespräch werden Fakten extrahiert und per LLM-Entscheid ADD / UPDATE / DELETE / NOOP gegen den Bestand abgeglichen; Retrieval fusioniert Semantik + BM25 + Entitäten. Eigenangabe: 92,5 auf LoCoMo bei ~6.900 Tokens/Anfrage statt ~26.000 bei Vollkontext. Der externe Graph wurde 2026 wieder durch Entity-Linking im Ranking ersetzt — Graphen lohnen nur, wenn man sie traversieren muss. [3][4]
- **Zeit als erste Dimension (Zep/Graphiti):** jede Tatsache trägt `gültig_ab` / `gültig_bis` / Quelle; Widersprüche werden nicht gelöscht, sondern zeitlich invalidiert (bitemporal). Eigenangabe: bis +18,5 % Genauigkeit auf LongMemEval bei 90 % weniger Latenz gegenüber Vollkontext. [5]
- **Abruf-Formel (Generative Agents):** Score = Aktualität (exponentieller Zerfall) + Wichtigkeit (LLM-Rating 1–10) + Relevanz (Kosinus). Dazu periodische *Reflexion*: der Agent stellt sich Fragen zu den letzten Erlebnissen und schreibt höhere Einsichten zurück in den Speicher. [12]
- **Lernen aus Fehlern als Text (Reflexion):** Lehren werden als kurze Sätze in einem episodischen Puffer gehalten — billiger und nachvollziehbarer als jede Gewichtsanpassung. [14]
- **Zettelkasten für Agenten (A-MEM, NeurIPS 2025):** jede Erinnerung bekommt Kontextsatz, Schlagwörter, Tags und Links; neue Notizen aktualisieren alte („memory evolution"). 85–93 % weniger Token für Gedächtnisoperationen. [9]
- **Assoziation über Graph + PageRank (HippoRAG 2):** für Multi-hop-Fragen; deutlich günstiger beim Indexieren als GraphRAG/LightRAG. [10]
- **Vergessen (MemoryBank):** Ebbinghaus-Kurve — Gedächtnisstärke steigt bei jedem Abruf, fällt sonst; selten Genutztes verblasst statt gelöscht zu werden. [15]
- **Titans (Google):** Gedächtnis in den Gewichten, „Überraschung" (Gradient) entscheidet, was gemerkt wird — für uns nicht direkt nutzbar, aber die Idee „Neuheit = speicherwürdig" ist übertragbar. [13]
- **Anthropic Memory-Tool:** dateibasiert unter `/memories`, client-seitig (Speicher liegt beim Betreiber), Claude prüft das Verzeichnis *vor* jeder Aufgabe und protokolliert Fortschritt („ASSUME INTERRUPTION"). Doku fordert explizit: Pfad-Traversal abfangen, Dateigrößen kappen, alte Dateien ablaufen lassen, mit Compaction kombinieren. [6][7]
- **Consumer-Vorbilder:** ChatGPT trennt „gespeicherte Erinnerungen" (editierbar) von „Chat-Verlauf-Referenz" (nicht editierbar, seit 04/2025). Claude legt pro Projekt ein *eigenes* Gedächtnis an, zeigt alles als editierbare Themen, schließt sensible Kategorien (Gesundheit, Religion …) standardmäßig aus und bietet Inkognito-Chats. [16][17]

**Was scheitert:** Vollkontext (teuer, „context rot"); naive Vektor-RAG über Chatprotokolle (kann weder Zeit noch Aktualisierungen); Anhäufen ohne Konsolidierung (Widersprüche, Veraltetes); LongMemEval zeigt: *Wissens-Updates*, *Enthaltung* („weiß ich nicht") und *zeitliches Schließen* sind die Schwachstellen aller Systeme. [60]

**Quellen**
- [1] MemGPT: Towards LLMs as Operating Systems — Packer et al. (UC Berkeley), 2023, https://arxiv.org/abs/2310.08560
- [2] Agent Memory: How to Build Agents That Learn and Remember — Letta, 07/2025, https://www.letta.com/blog/agent-memory/
- [3] Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory — Chhikara et al. (Mem0), ECAI 2025, https://arxiv.org/abs/2504.19413
- [4] State of AI Agent Memory 2026: Benchmarks & Trends — Mem0, 09/2026, https://mem0.ai/blog/state-of-ai-agent-memory-2026
- [5] Zep: A Temporal Knowledge Graph Architecture for Agent Memory — Rasmussen et al. (Zep), 2025, https://arxiv.org/abs/2501.13956
- [6] Memory tool — Anthropic, Claude Platform Docs, 2025/2026, https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- [7] Managing context on the Claude Developer Platform — Anthropic, 09/2025, https://www.anthropic.com/news/context-management
- [8] Cognitive Architectures for Language Agents (CoALA) — Sumers, Yao, Narasimhan, Griffiths (Princeton), 2023/2024, https://arxiv.org/abs/2309.02427
- [9] A-MEM: Agentic Memory for LLM Agents — Xu et al. (Rutgers), NeurIPS 2025, https://arxiv.org/abs/2502.12110
- [10] From RAG to Memory: Non-Parametric Continual Learning for LLMs (HippoRAG 2) — Gutiérrez et al. (Ohio State), 2025, https://arxiv.org/abs/2502.14802
- [11] Memory overview (semantic/episodic/procedural) + LangMem SDK — LangChain, 2025, https://docs.langchain.com/oss/python/concepts/memory · https://www.langchain.com/blog/langmem-sdk-launch
- [12] Generative Agents: Interactive Simulacra of Human Behavior — Park et al. (Stanford/Google), UIST 2023, https://dl.acm.org/doi/10.1145/3586183.3606763
- [13] Titans: Learning to Memorize at Test Time — Behrouz, Zhong, Mirrokni (Google Research), NeurIPS 2025, https://arxiv.org/abs/2501.00663
- [14] Reflexion: Language Agents with Verbal Reinforcement Learning — Shinn et al., NeurIPS 2023, https://arxiv.org/abs/2303.11366
- [15] MemoryBank: Enhancing LLMs with Long-Term Memory — Zhong et al., AAAI 2024, https://arxiv.org/abs/2305.10250
- [16] Memory and new controls for ChatGPT / Memory FAQ — OpenAI, 2024–2025, https://openai.com/index/memory-and-new-controls-for-chatgpt/ · https://help.openai.com/en/articles/8590148-memory-faq
- [17] Bringing memory to teams (Claude memory: Projekt-Gedächtnis, editierbar, Inkognito) — Anthropic, 09/2025, https://claude.com/blog/memory

---

## 2. RAG & Wiki-Chat über eigene Notizen

**Was die Besten tun**

- **Hybrid ist Standard:** BM25 (exakte Begriffe, Namen, Nummern) + Dense-Embeddings (Bedeutung), zusammengeführt per Reciprocal Rank Fusion (k = 60, keine Kalibrierung nötig), dann Cross-Encoder-Reranking der Top-20/50. Anthropic misst: kontextualisierte Chunks + BM25 + Rerank senken die Top-20-Fehlrate um 67 %. [18][29]
- **Contextual Retrieval:** jedem Chunk wird vor dem Einbetten ein kurzer Kontextsatz (Dokument, Abschnitt, Entitäten) vorangestellt. Bei Markdown-Notizen ist das fast gratis: Dateiname › Überschriftenpfad › Tags voranstellen — ohne LLM-Aufruf. [18]
- **Chunking schlägt Modellwahl:** Chroma misst bis 9 % Recall-Unterschied zwischen Chunkern; Praxis-Benchmarks bestätigen rekursives Splitten bei ~512 Tokens mit ~10 % Überlappung als robusten Default; „semantisches Chunking" erzeugt zu kleine Fragmente, die Antworten verschlechtern. Für Obsidian: an Überschriften schneiden, Frontmatter als Metadaten mitführen. [22][23]
- **Graph nur, wenn nötig:** GraphRAG (Microsoft) indexiert das gesamte Korpus per LLM in Communities — stark für „Worum geht es insgesamt?", aber teuer; LazyGraphRAG erreicht dieselbe Qualität bei 0,1 % der Index-Kosten; LightRAG (EMNLP 2025) macht Entitäts-Graph + Vektor inkrementell. Für einen Zwei-Personen-Vault gilt: die Wikilinks/Backlinks *sind* bereits der Graph — erst nutzen, dann ggf. extrahieren. [19][20][21][10]
- **Embeddings für Deutsch:** bge-m3 (1024 Dim., 8k Kontext, Apache 2.0, dense + sparse) oder multilingual-e5-large gelten als Referenz; Nomic ist der günstige Kompromiss, verliert aber bei Komposita/Fachbegriffen. API-Optionen: OpenAI text-embedding-3-small (1536 Dim.), Voyage-3-Familie + rerank-2/2.5 (31 Sprachen inkl. Deutsch getestet). [26][27][28]
- **Hardware-Realität 1 vCPU / 2 GB:** bge-m3 (568 M Parameter) läuft dort nicht sinnvoll. Lokal bleibt ein kleines Modell (z. B. multilingual-e5-small, ~118 M Parameter, 384 Dim., per ONNX/Transformers.js) oder eine Embedding-API. Reranking lokal (bge-reranker-v2-m3) erst nach RAM-Upgrade; bis dahin API oder ohne Reranker mit Top-5. [26][33]
- **Vektorspeicher:** sqlite-vec (reines C, keine Abhängigkeiten, Brute-Force „fast enough" bis in den sechsstelligen Bereich, eine `.db`-Datei) ist die natürliche Wahl neben dem geplanten SQLite; SQLite FTS5 liefert BM25 gratis — Hybrid komplett in einer Datei. pgvector nur, wenn Postgres ohnehin läuft; LanceDB spart RAM durch Memory-Mapping, ist aber ein weiterer Stack. [24][25][30]
- **Self-hosted Vorbilder:** Khoj (Python, PostgreSQL/pgvector — zu schwer für 2 GB), Open WebUI (Hybrid-Schalter, bge-reranker-v2-m3, Top-K 5–10), AnythingLLM („Pinning" = Kern-Dokument vollständig in jeden Prompt statt Retrieval; Zitate sind grob), Smart Connections (lokale Embeddings, Cache im Vault), Copilot for Obsidian V4 (kombiniert exakte Suche + Obsidian-Links/Properties + semantische Suche; Index-Refresh manuell), Reor (LanceDB + Transformers.js, automatische Verknüpfung per Ähnlichkeit). [31][32][33][34][35][36]
- **Zitieren wie NotebookLM:** nur aus Quellen antworten, jede Aussage mit Inline-Beleg auf die Passage; ohne Treffer → „nicht in den Quellen" statt raten. [63]

**Was scheitert:** reine Vektorsuche (verfehlt Namen, Zahlen, Kürzel); zu große Top-K (Kontext-Verstopfung); Index ohne Metadaten-Filter (Vertraulichkeit erst nach dem Retrieval prüfen ist zu spät); Graph-Extraktion über alles bei kleinem Korpus (Kosten ohne Nutzen).

**Quellen**
- [18] Contextual Retrieval — Anthropic Engineering, 2024, https://www.anthropic.com/engineering/contextual-retrieval
- [19] From Local to Global: A Graph RAG Approach to Query-Focused Summarization — Edge et al. (Microsoft Research), 2024, https://arxiv.org/abs/2404.16130
- [20] LazyGraphRAG: Setting a new standard for quality and cost — Microsoft Research, 2024/2025, https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/
- [21] LightRAG: Simple and Fast Retrieval-Augmented Generation — Guo et al. (HKU), EMNLP 2025, https://arxiv.org/abs/2410.05779
- [22] Evaluating Chunking Strategies for Retrieval — Chroma Research, 2024, https://www.trychroma.com/research/evaluating-chunking
- [23] RAG Chunking Strategies: The 2026 Benchmark Guide — PremAI, 2026, https://www.premai.io/blog/rag-chunking-strategies-the-2026-benchmark-guide/
- [24] Introducing sqlite-vec v0.1.0 — Alex Garcia, 2024, https://alexgarcia.xyz/blog/2024/sqlite-vec-stable-release/index.html · https://github.com/asg017/sqlite-vec
- [25] LanceDB vs Chroma vs SQLite-vec: Embedded Vector Databases — Kanopy Labs, 2025/2026, https://kanopylabs.com/blog/lancedb-vs-chroma-vs-sqlite-vec
- [26] Embedding-Modelle deutsch: BGE vs E5 vs Nomic — Pexon Consulting, 07/2026, https://pexon-consulting.de/blog/embedding-modelle-deutsch-bge-e5-nomic/
- [27] BGE-M3 (Model Card, Multilingual-Vergleich) — BAAI, 2024, https://huggingface.co/BAAI/bge-m3
- [28] rerank-2 and rerank-2-lite: multilingual rerankers — Voyage AI, 09/2024, https://blog.voyageai.com/2024/09/30/rerank-2/
- [29] Hybrid Search: BM25, Vector & Reranking Reference 2026 (RRF) — Digital Applied, 2026, https://www.digitalapplied.com/blog/hybrid-search-bm25-vector-reranking-reference-2026
- [30] pgvector vs sqlite-vec: You Probably Don't Need Postgres — LLBBL Blog, 04/2026, https://llbbl.blog/2026/04/26/pgvector-vs-sqlitevec-you-probably.html
- [31] Khoj — Your AI second brain (Repo) — khoj-ai, 2025, https://github.com/khoj-ai/khoj
- [32] Smart Connections (lokale Embeddings) — Brian Petro, 2025, https://github.com/brianpetro/obsidian-smart-connections · https://smartconnections.app/smart-connections/why-local-embeddings/
- [33] Retrieval Augmented Generation (RAG) — Open WebUI Docs, 2025, https://docs.openwebui.com/features/chat-conversations/rag/
- [34] Using Documents in AnythingLLM (Pinning, Zitate) — Mintplex Labs, 2025, https://docs.anythingllm.com/chatting-with-documents/introduction
- [35] Vault Search and Indexing (Copilot for Obsidian V4) — Logan Yang, 2026, https://docs.obsidiancopilot.com/vault-search-and-indexing/
- [36] Reor — Private & local AI PKM app — reorproject, 2024/2025, https://github.com/reorproject/reor

---

## 3. Second Brain / PKM-Methoden — Struktur für Mensch UND KI

**Was die Besten tun**

- **PARA + CODE (Forte):** Ordnung nach *Handlungsnähe* (Projekte › Bereiche › Ressourcen › Archiv), nicht nach Thema; Ablauf Capture → Organize → Distill → Express. *Progressive Summarization* legt Schichten an (Rohtext → Fett → Hervorhebung → Ein-Satz-Zusammenfassung). Diese Schichten sind für KI direkt nutzbar: die Zusammenfassung ist der ideale Chunk-Kontext. [37][38]
- **Zettelkasten / Evergreen (Luhmann, Ahrens, Matuschak):** atomar (ein Gedanke pro Notiz), konzeptorientiert (nicht nach Quelle/Buch), dicht verlinkt, in eigenen Worten. Das sind exakt die Eigenschaften, die Retrieval braucht: eine Notiz = ein sauberer Chunk, Links = Graph. A-MEM (Feld 1) hat genau dieses Prinzip für Agenten formalisiert. [39][40][9]
- **Maps of Content (Milo):** Hub-Notizen, die ein Thema kartieren. Für Jarvis die perfekte Einstiegsebene: erst die MOC laden, dann gezielt einzelne Notizen — „progressive disclosure" statt 50 Treffer. [41]
- **Obsidian Properties:** kleines, festes Schema pro Notiztyp; typisierte Felder (Datum, Liste, Zahl) via Template; Pluralformen `tags`/`aliases` (Singular seit Obsidian 1.9 veraltet). Freiform-Frontmatter ist der häufigste Fehler — nicht mehr abfragbar, weder für Dataview noch für einen Index. [42][43]
- **Typisierung (Tana Supertags, Capacities Objects):** „Person", „Meeting", „Entscheidung" als Objekttypen mit Feldern; Tana verkauft genau das als KI-Vorteil (Multi-hop über explizite Beziehungen, weniger Halluzination). Mem.ai verspricht „Organisation ist Aufgabe der KI" — scheitert an Vertrauen und Kontrolle; Reflect bleibt rein manuell. Der Mittelweg gewinnt: Mensch definiert Typen und Regeln, KI füllt Felder vor und schlägt Links vor. [44][45]
- **Notion AI Q&A / Perplexity Spaces:** Antworten pro Arbeitsbereich mit Quellenangabe und Custom Instructions je Raum — dasselbe Prinzip wie „ein Gedächtnis pro Projekt". [64]

**Was scheitert:** Ordner-Taxonomien als einzige Struktur; Sammeln ohne Verdichten („Collector's Fallacy"); Notizen, die mehrere Konzepte mischen (nicht verlinkbar, nicht sauber chunkbar); Metadaten, die je Notiz anders heißen.

**Quellen**
- [37] Progressive Summarization: A Practical Technique for Designing Discoverable Notes — Tiago Forte (Forte Labs), 2017 ff., https://fortelabs.com/blog/progressive-summarization-a-practical-technique-for-designing-discoverable-notes/
- [38] Building a Second Brain (PARA, CODE) — Tiago Forte, 2022; Zusammenfassung: Sloww, https://www.sloww.co/building-a-second-brain-book/
- [39] Evergreen notes (atomic · concept-oriented · densely linked) — Andy Matuschak, laufend, https://notes.andymatuschak.org/z5E5QawiXCMbtNtupvxeoEX
- [40] Zettelkasten Method: A Pragmatic Guide (Luhmann/Ahrens „How to Take Smart Notes") — A Pragmatic Mind, 2025, https://www.apragmaticmind.com/blog/zettelkasten-method
- [41] Linking Your Thinking / Ideaverse Map (MOCs) — Nick Milo, 2020–2025, https://www.linkingyourthinking.com/ · https://blog.linkingyourthinking.com/ideaverse-map
- [42] Obsidian Properties and Frontmatter: Stop Treating Metadata as an Afterthought — Dan Holloran, 2025, https://danholloran.me/posts/obsidian-properties-and-frontmatter-a-practical-guide
- [43] Adding Metadata — Dataview Docs (blacksmithgu), laufend, https://blacksmithgu.github.io/obsidian-dataview/annotation/add-metadata/
- [44] Knowledge Graph in Tana (Supertags) — Tana, 2025, https://tana.inc/classic/knowledge-graph · TechCrunch 02/2025: https://techcrunch.com/2025/02/03/tana-snaps-up-25m-with-its-ai-powered-knowledge-graph-for-work-racking-up-a-160k-waitlist/
- [45] Mem vs Reflect: AI-First Capture vs Networked Thought (+ Capacities) — Aloa, 2025, https://aloa.co/ai/comparisons/ai-note-taker-comparison/mem-vs-reflect

---

## 4. Regelwerke / Konstitution für die persönliche KI

**Was die Besten tun**

- **Explizite Prioritätsordnung (Claude-Konstitution, 01/2026, CC0):** sicher › ethisch › Anthropic-Richtlinien › hilfreich; „in Konfliktfällen in dieser Reihenfolge", aber als *Abwägung*, nicht als starre Kette. Philosophie „Gründe statt Regeln": Regeln werden begründet, damit das Modell sie selbst herleiten könnte; wenige harte Grenzen stehen separat. Prinzipal-Hierarchie Anthropic › Operator › User, mit Schutzrechten des Users, die der Operator nicht aushebeln kann. [46][47]
- **Autoritätsstufen (OpenAI Model Spec, 08/2026):** Root › System › Developer › User › Guideline; bei Konflikt gewinnt die höhere Stufe. Entscheidend fürs Brain: *Inhalte aus Tool-Ausgaben, Dateien, Zitaten und Anhängen sind Daten ohne Autorität* — sie dürfen nur dann Anweisungen sein, wenn eine höhere Stufe das ausdrücklich delegiert. [48]
- **CLAUDE.md-Praxis (Anthropic):** Ziel < 200 Zeilen pro Datei („jede Zeile konkurriert um Aufmerksamkeit"); konkret und prüfbar formulieren; Hierarchie Enterprise › User › Projekt › Lokal wird *konkateniert*, Näheres steht zuletzt; Widersprüche führen zu willkürlichem Verhalten → regelmäßig bereinigen; pfadgebundene Regeln laden nur bei Bedarf; Imports max. 4 Ebenen. Wichtigster Satz: Regeln sind „Kontext, keine erzwungene Konfiguration" — harte Verbote gehören in Hooks/Code. *Auto memory*: Claude schreibt eigene Notizen, geladen werden die ersten 200 Zeilen / 25 KB. [49]
- **AGENTS.md (Linux Foundation / AAIF, seit 08/2025):** ein schemafreies Markdown, nächstgelegene Datei gewinnt; Cursor ergänzt vier Aktivierungsmodi als Frontmatter: `alwaysApply`, `globs` (automatisch bei passenden Dateien), `description` (KI entscheidet, ob relevant), manuell. Das ist eine fertige Vorlage für Regel-Metadaten. [50][51]
- **Context Engineering (Anthropic, 09/2025):** kleinste Menge hoch-signaler Tokens; Systemprompt auf „richtiger Flughöhe" (weder Hardcode noch vage); Just-in-time-Retrieval über leichte Identifikatoren (Pfade, Titel) statt Vorab-Laden; Kompaktierung; strukturierte Notizen (`NOTES.md`) als externes Gedächtnis; Subagenten liefern 1–2k-Token-Zusammenfassungen. [52]
- **LLM OS (Karpathy):** Modell = CPU, Kontext = RAM, alles außerhalb = Disk, das *explizit* geladen werden muss. Gedächtnis ist also ein Lade-Problem, kein Speicher-Problem. [53]
- **Constitutional AI (2022):** Prinzipien in Klartext sind auditierbar und editierbar; Kritik-und-Revision-Schleife gegen die Prinzipien — übertragbar als „Jarvis prüft seine Antwort gegen die Brain-Regeln, bevor er sie ausgibt". [47]

**Was scheitert:** lange Regelwerke (Adhärenz sinkt messbar); Regeln ohne Herkunft, Gültigkeit und Freigabe; Prosa statt prüfbarer Sätze; Regeln, die sich widersprechen, ohne dass jemand die Rangfolge festgelegt hat.

**Quellen**
- [46] Claude's constitution — Anthropic, 22.01.2026, https://www.anthropic.com/constitution
- [47] Constitutional AI: Harmlessness from AI Feedback — Bai et al. (Anthropic), 2022, https://arxiv.org/abs/2212.08073
- [48] Model Spec (2026-08-18): Chain of Command — OpenAI, 08/2026, https://model-spec.openai.com/2026-08-18.html
- [49] How Claude remembers your project (CLAUDE.md, rules, imports, auto memory) — Anthropic, Claude Code Docs, 2026, https://code.claude.com/docs/en/memory
- [50] AGENTS.md — Agentic AI Foundation / OpenAI u. a., 2025, https://agents.md/ · InfoQ 08/2025: https://infoq.com/news/2025/08/agents-md/
- [51] Cursor Rules: Setup, Best Practices, and Examples (.mdc, alwaysApply, globs) — StackHawk, 2025, https://www.stackhawk.com/blog/cursor-rules
- [52] Effective context engineering for AI agents — Anthropic Engineering, 29.09.2025, https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- [53] Software 3.0 Explained: Why Karpathy Says the Context Window Is Your New RAM — MindStudio (zu Karpathys Vortrag „Software Is Changing (Again)", 06/2025), 2025, https://www.mindstudio.ai/blog/software-3-0-explained-karpathy-context-window-ram-model-weights-cpu

---

## 5. Selbstwachsendes Gedächtnis mit Human-in-the-loop

**Was die Besten tun**

- **Zwei Speicherstufen + Provenienz (Collaborative Memory, 2025):** *privat* (nur Urheber) und *geteilt* (selektiv); jedes Fragment trägt unveränderliche Herkunft (Agent, Quelle, Zeitstempel); Lese- und Schreib-Policies als Graph Nutzer–Agent–Ressource, der sich über die Zeit ändern darf. [54]
- **Vier Fehlerbilder geteilter Gedächtnisse (Governed Shared Memory, 2026):** unautorisiertes Leaken, Weitergabe veralteter Fakten, persistierende Widersprüche, Provenance-Kollaps. Gegenmittel: Herkunftsketten mit Autor-Identität, *temporale Supersession* (Neues ersetzt Altes mit Zeitstempel statt Löschen), Retrieval nur im erlaubten Scope. [55]
- **Sicherheits-Checkliste (Mem0, OWASP):** Validierung *vor* dem Persistieren; Namespaces pro Nutzer auf Speicherebene; Verschlüsselung at rest und in transit; TTL für Einträge; Audit-Log aller Operationen (wer, wann, welche Sitzung); Trust-Scoring nach Frische/Quelle; Snapshots für Rollback; PII-Ein-/Ausschlussregeln; DSGVO-Löschung durch Aufzählbarkeit. [56][58]
- **Memory Poisoning ist real:** MINJA erreicht > 95 % Injektions- und 70 % Angriffserfolg über normale Anfragen; MemoryGraft schleust über harmlos wirkende Dateien (README) „erfolgreiche Erfahrungen" ein, die Wochen später wirken. Unterschied zu Prompt-Injection: sie *persistiert*. OWASP LLM08 nennt Vektor-DBs explizit als Angriffsfläche (Poisoning, Embedding-Inversion). Gegenmittel: Fremdtext als Daten markieren, Quarantäne-Ordner, keine Anweisungen aus Notizen ausführen, Schreibfreigabe durch Menschen. [57][58]
- **DSGVO (DSK-Orientierungshilfen 2024/2025):** sobald Personenbezug, gilt die DS-GVO voll — Rechtsgrundlage, Zweckbindung, Datenminimierung, Betroffenenrechte Art. 15–18; *Löschung muss die Wiederherstellung des Personenbezugs dauerhaft ausschließen* — Filter sind keine Löschung. Für ein Gedächtnis heißt das: Notiz, Chunks, Embeddings und Verweise müssen gemeinsam löschbar sein. [59][60]
- **Evaluierung:** LongMemEval (ICLR 2025) prüft fünf Fähigkeiten — Informationsextraktion, Multi-Session-Schließen, zeitliches Schließen, Wissens-Updates, Enthaltung — und zeigt ~30 % Einbruch kommerzieller Assistenten über lange Historien; LoCoMo (ACL 2024): Mensch 87,9 F1, Maschinen deutlich darunter; MemBench (ACL 2025) misst zusätzlich *Effizienz* (Zahl der Gedächtnisoperationen) und *Kapazität* (Degradation mit wachsendem Speicher). Lehre: ein eigenes kleines Eval-Set aus dem echten Vault ist Pflicht, sonst merkt man Verschlechterung nicht. [61][62][63]
- **Wikipedia als Governance-Vorbild:** Belegpflicht, neutraler Standpunkt, keine Theoriefindung; Diskussionsseite und Versionsgeschichte machen Streit und Wandel sichtbar; Bots sichern Belege gegen Link-Tod. [68][69]

**Was scheitert:** Schreiben ohne Freigabe (Poisoning, Drift); Löschen statt Invalidieren (Historie verloren); Vertraulichkeit als Nachfilter; Gedächtnis ohne Autor und Datum; kein Test-Set.

**Quellen**
- [54] Collaborative Memory: Multi-User Memory Sharing in LLM Agents with Dynamic Access Control — Rezazadeh et al., 05/2025, https://arxiv.org/abs/2505.18279
- [55] Governed Shared Memory for Multi-Agent LLM Systems (MemClaw) — Margalit et al., 06/2026, https://arxiv.org/abs/2606.24535
- [56] AI Memory Security: Best Practices and Implementation — Mem0, 09/2026, https://mem0.ai/blog/ai-memory-security-best-practices
- [57] Memory and context poisoning: Don't let attackers rewrite your AI agent's memory (MINJA, MemoryGraft) — WorkOS, 2025/2026, https://workos.com/blog/ai-agent-memory-poisoning
- [58] OWASP Top 10 for LLM Applications 2025 (LLM01 Prompt Injection, LLM08 Vector & Embedding Weaknesses) — OWASP GenAI Security Project, 2025, https://genai.owasp.org/llm-top-10/ · Erläuterung: https://www.confident-ai.com/blog/owasp-top-10-2025-for-llm-applications-risks-and-mitigation-techniques
- [59] Orientierungshilfe „Künstliche Intelligenz und Datenschutz" — Datenschutzkonferenz (DSK), 06.05.2024, https://www.datenschutzkonferenz-online.de/media/oh/20240506_DSK_Orientierungshilfe_KI_und_Datenschutz.pdf
- [60] Datenschutzrechtliche Anforderungen an KI-Systeme — DSK, 17.06.2025, https://www.datenschutz-berlin.de/fileadmin/user_upload/pdf/publikationen/DSK/2025/20250617-DSK-OH_KI-Systeme.pdf
- [61] LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory — Wu et al., ICLR 2025, https://github.com/xiaowu0162/LongMemEval
- [62] Evaluating Very Long-Term Conversational Memory of LLM Agents (LoCoMo) — Maharana et al., ACL 2024, https://aclanthology.org/2024.acl-long.747/
- [63] MemBench: Towards More Comprehensive Evaluation on the Memory of LLM-based Agents — Tan et al., ACL Findings 2025, https://arxiv.org/abs/2506.21605

---

## 6. Produkt-Vorbilder

**Was die Besten tun**

- **NotebookLM (Google):** antwortet *nur* aus hochgeladenen Quellen, jede Aussage mit Inline-Zitat auf die Passage (Klick zeigt Original); Audio/Video-Overviews als Zweitformat; Grenzen 50 Quellen (frei) / 300 (Plus). Deutsch kam spät — Sprachqualität prüfen. [64]
- **Perplexity Spaces:** pro Raum eigene *Custom Instructions* + Dateien + Web; Rollen Viewer/Collaborator; Kontext bleibt über Sitzungen erhalten. Vorbild für „ein Raum pro Bereich/Projekt mit eigenen Regeln". [65]
- **ChatGPT Memory / Projects:** zwei Schichten — editierbare gespeicherte Erinnerungen und (seit 04/2025) nicht editierbare Referenz auf den gesamten Chat-Verlauf. Sicherheitsforscher (Rehberger) kritisieren die Intransparenz der zweiten Schicht: der Nutzer sieht nicht, was das Modell über ihn ableitet. [16][66]
- **Claude Memory:** getrennte Gedächtnisse pro Projekt, alles als editierbare Themen sichtbar, sensible Kategorien standardmäßig ausgeschlossen, Inkognito-Modus. Das ist der Goldstandard für Kontrolle. [17]
- **Rewind/Limitless:** Always-on-Aufzeichnung als „perfektes Gedächtnis"; 12/2025 von Meta übernommen, Rewind-App abgeschaltet, Dienst in EU/UK eingestellt, Daten unter Meta-AGB. Lehre: Gedächtnis auf fremden Servern kann über Nacht den Eigentümer wechseln — eigener Server ist die richtige Entscheidung; Aufzeichnung Dritter braucht Einwilligung. [67]
- **Glean vs. Guru (Firmen-Wiki):** Glean crawlt alles permissions-aware in Echtzeit ohne menschliche Prüfung; Guru pflegt kuratierte Wissenskarten mit *Experten-Verifikation alle 30/60/90 Tage* und sichtbarem „verifiziert"-Status. Für ein Zwei-Personen-Brain ist das Guru-Prinzip (Verifikationsdatum je Karte) das bessere Vertrauenssignal. [68]
- **Wikipedia:** drei Kernregeln (Belegpflicht, Neutralität, keine Theoriefindung), Diskussionsseite für Streit, Versionsgeschichte für Wandel, Konsens als Entscheidungsverfahren. Das ist die Governance-Vorlage für ein Wiki, an dem Menschen *und* eine KI schreiben. [69][70]

**Quellen**
- [64] NotebookLM (Quellen-Chat, Zitate, Audio Overviews, Limits) — Wikipedia-Eintrag & Google Blog, 2025, https://en.wikipedia.org/wiki/NotebookLM · https://blog.google/innovation-and-ai/products/notebooklm-audio-video-sources/
- [65] A student's guide to using Perplexity Spaces — Perplexity, 2024/2025, https://www.perplexity.ai/hub/blog/a-student-s-guide-to-using-perplexity-spaces
- [66] How ChatGPT Remembers You: A Deep Dive into Its Memory and Chat History Features — Johann Rehberger (Embrace The Red), 2025, https://embracethered.com/blog/posts/2025/chatgpt-how-does-chat-history-memory-preferences-work/
- [67] Meta Acquires Limitless AI: Rewind Shuts Down December 19, 2025 — Hedy AI, 12/2025, https://www.hedy.ai/post/meta-acquires-limitless-ai-privacy/
- [68] Guru vs Glean: Which AI Knowledge Management Tool is Better? — Coworker AI, 2026, https://coworker.ai/blog/guru-vs-glean · Glean Knowledge Graph: https://docs.glean.com/security/knowledge-graph
- [69] Wikipedia: Core content policies (Verifiability, NPOV, No original research) — Wikipedia, laufend, https://en.wikipedia.org/wiki/Wikipedia:Core_content_policies
- [70] The 3 building blocks of trustworthy information: Lessons from Wikipedia — Wikimedia Foundation, 02.10.2025, https://wikimediafoundation.org/news/2025/10/02/the-3-building-blocks-of-trustworthy-information-lessons-from-wikipedia/

---

## Was das für MAKE OS heißt — Entscheidungen und Bausteine

Rahmen: Hetzner 1 vCPU / 2 GB (Upgrade möglich), Next.js/TypeScript, JSON-Stores → SQLite geplant, `make-vault` (Obsidian) auf dem Server, Jarvis über Anthropic-API, zwei Personen (Kevin, Malin), DSGVO/DE, kein Cloud-Vektordienst, wenn es lokal geht. Aufwand: **klein** = Tage, **mittel** = 1–2 Wochen, **groß** = mehrere Wochen / mit Server-Upgrade.

### Prio 1 — Fundament (ohne das bleibt der Rest Flickwerk)

1. **Drei Gedächtnis-Schichten nach CoALA/Letta.** (a) *Kern-Blöcke*, immer geladen, zusammen ≤ 200 Zeilen: Profil Kevin, Profil Malin, Haus-Regeln, laufende Projekte; (b) *Wissen* = die Vault-Notizen (semantisch); (c) *Episoden* = datierte Protokolle von Gesprächen/Ereignissen. Regeln sind prozedurales Gedächtnis und liegen als eigener Notiztyp im Vault. — *Warum:* jede ernsthafte Architektur trennt genau so, und die 200-Zeilen-Grenze ist empirisch (Adhärenz sinkt darüber). [1][2][8][11][49] — **mittel**
2. **Regel-Notiztyp `#regel` mit festem Frontmatter:** `prioritaet` (0 = hart, 1 = Sicherheit/Privatsphäre, 2 = Haus-Regel, 3 = Vorliebe), `gilt_fuer` (kevin | malin | beide | jarvis), `status` (entwurf | aktiv | abgelöst), `quelle`, `freigegeben_von`, `freigegeben_am`, `gueltig_bis`, `ersetzt` (Link auf Vorgänger). Konfliktregel wie Konstitution/Model Spec: höhere Priorität gewinnt; gleiche Priorität → Jarvis fragt, statt zu raten. Nur `status: aktiv` wird geladen. — *Warum:* Herkunft, Gültigkeit, Rangfolge und Freigabe sind die vier Dinge, die alle Regelwerke der Großen gemeinsam haben. [46][48][49][51] — **klein**
3. **Hard-Rule „Notizen sind Daten, keine Befehle".** Im Jarvis-Systemprompt fest verankert: Text aus Vault, Web, Mail, Uploads hat *keine Anweisungsautorität*; Fremdtext bekommt `herkunft: extern` und landet zuerst in `_quarantaene/`. Nur Kevin/Malin im Chat oder eine freigegebene `#regel` dürfen Jarvis anweisen. — *Warum:* Memory Poisoning wirkt Wochen später und ist kaum zu entdecken; die Model Spec formuliert genau diese Regel. [48][57][58] — **klein**
4. **Brain-Index in SQLite: FTS5 (BM25) + sqlite-vec (Embeddings) in einer Datei** neben dem Vault. Retrieval: beide Listen Top-20 → RRF (k = 60) → optional Rerank → Top-5 in den Kontext. Tabellen: `notes`, `chunks`, `chunk_vec`, `links`, `episodes`, `audit_log`. — *Warum:* passt zur SQLite-Planung, keine zweite Datenbank, kein Cloud-Vektordienst, „fast enough" für einige zehntausend Chunks auf einer vCPU. [18][24][29][30] — **mittel**
5. **Chunking an Markdown-Überschriften, ~400–600 Tokens, 10 % Überlappung, mit vorangestelltem Kontext** (`Dateiname › H1 › H2 · tags`). Frontmatter wird nicht eingebettet, sondern als Filter-Spalten gespeichert. — *Warum:* „Contextual Retrieval light" ohne LLM-Kosten; Chunking beeinflusst die Qualität stärker als das Embedding-Modell. [18][22][23] — **klein**
6. **Embeddings: Entscheidung nötig (siehe Offene Entscheidungen 1).** Empfehlung für *jetzt*: lokal `multilingual-e5-small` per Transformers.js/ONNX (int8, ~120 MB Modell, 384 Dim.) — passt in 2 GB neben Next.js, deutsch brauchbar, keine Daten verlassen den Server. Bei Upgrade auf 4 GB: `bge-m3` (Referenz für Deutsch, dense + sparse). Reranker erst nach Upgrade (`bge-reranker-v2-m3`) oder per API. — *Warum:* Datenschutz-first und trotzdem realistisch für die Hardware. [26][27][33] — **mittel**
7. **Zitierpflicht + Enthaltung.** Jede Antwort im Wiki-Chat belegt mit `[[Notiz#Abschnitt]]`; ohne ausreichende Treffer antwortet Jarvis „Dazu steht nichts im Brain" statt zu raten. Antworten ohne Beleg werden farblich als „Vermutung" markiert. — *Warum:* NotebookLM-Prinzip, Wikipedia-Belegpflicht; Enthaltung ist die messbar schwächste Fähigkeit aller Systeme. [61][64][69] — **klein**

### Prio 2 — Selbstwachsendes Gedächtnis

8. **Schreibweg mit Freigabe.** Jarvis schreibt nur nach `_inbox/jarvis/` (Vorschläge mit Begründung und Quelle) und in sein eigenes Episoden-Log. Übernahme in den Vault per Klick in `/os/wissen` (Kevin oder Malin). Kern-Blöcke ändern sich *nur* mit Freigabe. — *Warum:* Human-in-the-loop ist der einzige zuverlässige Schutz gegen Drift und Poisoning; das Anthropic-Memory-Tool ist bewusst client-seitig, damit der Betreiber genau das kontrolliert. [6][54][55] — **mittel**
9. **Provenienz-Frontmatter für jede Notiz:** `erstellt_von`, `erstellt_am`, `geaendert_von`, `geaendert_am`, `quelle` (Gespräch/Datei/URL/Person), `verifiziert_am`, `vertraulichkeit` (privat-kevin | privat-malin | gemeinsam | extern). Jarvis schreibt diese Felder automatisch vor. — *Warum:* ohne Herkunft kein Vertrauen, keine Konfliktlösung, keine DSGVO-Auskunft. [54][56][68] — **klein**
10. **Versionsgeschichte + Diskussion:** Vault als Git-Repo auf dem Server, ein Commit pro Schreibvorgang mit Autor (kevin | malin | jarvis) = Versionsgeschichte, Diff und Rollback gratis. Pro Notiz ein `## Diskussion`-Abschnitt (oder eine `_diskussion/`-Notiz) für Einwände und offene Fragen. — *Warum:* Wikipedia-Prinzip; Snapshots für Rollback sind Sicherheits-Best-Practice. Vorbehalt: Git erschwert echte Löschung → siehe Punkt 16. [56][69][70] — **klein**
11. **Konsolidierung im Leerlauf („Sleep-time"):** nächtlicher Job liest neue Episoden, extrahiert Fakten, entscheidet ADD / UPDATE / DELETE / NOOP gegen den Bestand und legt *Vorschläge* in `_inbox/jarvis/` ab; Widersprüche werden als solche gemeldet. Veraltete Fakten bekommen `gueltig_bis` statt gelöscht zu werden (bitemporal wie Zep). — *Warum:* Konsolidierung ist der Unterschied zwischen Gedächtnis und Müllhalde; asynchron, damit der Chat schnell bleibt. [2][3][5][12] — **groß**
12. **Reflexions-Notizen:** wöchentlich schreibt Jarvis „Was habe ich über Kevin/Malin/das System gelernt, was ging schief, was sollte anders laufen" als Episode; Übernahme in Kern-Blöcke oder Regeln nur nach Freigabe. — *Warum:* Reflexion/Generative Agents zeigen, dass verbalisiertes Lernen billig und wirksam ist. [12][14] — **klein**
13. **Vergessen mit Maß:** Retrieval gewichtet Aktualität + Zugriffshäufigkeit + Relevanz (Generative-Agents-Formel); Episoden ohne Abruf > 12 Monate wandern nach `_archiv/` (aus dem Index, nicht gelöscht); Fremdtext in Quarantäne bekommt TTL 90 Tage. — *Warum:* Kapazität degradiert messbar (MemBench); Ebbinghaus-Vergessen hält das Aktive klein. [12][15][56][63] — **klein**

### Prio 3 — Zwei Personen und Datenschutz

14. **Drei Räume, ein Brain:** `vertraulichkeit` filtert *vor* der Suche (SQL-WHERE, nicht Nachfilter). Jarvis kennt die eingeloggte Person; privat-kevin ist für Malin unsichtbar und umgekehrt; gemeinsam sehen beide. — *Warum:* Collaborative Memory und Governed Shared Memory nennen Nachfiltern als Hauptursache von Leaks. [54][55][68] — **mittel**
15. **Konfliktregel für zwei Menschen:** Fakten *über* eine Person darf nur diese freigeben; gemeinsame Fakten brauchen eine Freigabe, die andere Person wird benachrichtigt; bei Widerspruch bleiben beide Versionen mit Zeitstempel stehen und Jarvis zeigt beide („Kevin sagt A (12.03.), Malin sagt B (14.03.)"). — *Warum:* temporale Supersession statt Überschreiben; Wikipedia-Konsensprinzip. [54][55][69] — **klein**
16. **DSGVO-Löschung als eine Funktion:** „Notiz löschen" entfernt Notiz, Chunks, Embeddings, Episoden-Verweise und Audit-Zeilen mit Personenbezug in *einem* Vorgang. Für Personendaten Dritter (Notiztyp `#person-extern`) gilt: außerhalb von Git oder mit `git filter-repo`-Routine, sonst ist keine echte Löschung möglich. Besondere Kategorien (Gesundheit, Religion, Sexualität) dürfen nur `privat-*` sein, nie `gemeinsam`. — *Warum:* DSK: Filter sind keine Löschung; Claude Memory schließt sensible Kategorien standardmäßig aus. [17][56][59][60] — **mittel**
17. **Verschlüsselung + Audit-Log erweitern:** die Index-Datei (Embeddings!) gehört mit in den verschlüsselten Ruhezustand (Embedding-Inversion ist ein realer Angriff); `audit_log` protokolliert jede Jarvis-Lese- und Schreiboperation (wer, wann, Sitzung, Notiz). — *Warum:* OWASP LLM08, Mem0-Checkliste. [56][58] — **klein**

### Prio 4 — Struktur und Bedienung

18. **Notiztypen mit festem Frontmatter:** Person, Projekt, Bereich, Entscheidung, Regel, Meeting, Episode, MOC — je ein Template, typisierte Properties (Datum, Liste), Pluralformen `tags`/`aliases`. Jarvis füllt Felder vor, der Mensch bestätigt. — *Warum:* Typisierung (Tana/Capacities) macht Wissen abfragbar; Freiform-Frontmatter ist der häufigste PKM-Fehler. [42][43][44] — **klein**
19. **MOCs als Einstiegs-Kontext:** zu jedem Bereich eine Map of Content; Jarvis lädt zuerst die MOC (≤ 1k Tokens), dann gezielt Notizen (Just-in-time, progressive disclosure). — *Warum:* Anthropic-Context-Engineering und LYT sagen dasselbe aus zwei Richtungen. [41][52] — **klein**
20. **Schreibregel „atomar + konzeptorientiert":** eine Notiz = ein Konzept; Jarvis schlägt bei > 800 Wörtern eine Aufteilung vor und setzt Wikilinks. — *Warum:* Evergreen/Zettelkasten = saubere Chunks + Graph gratis; A-MEM bestätigt das für Agenten. [9][39][40] — **klein**
21. **Wiki-Ansicht in `/os/wissen`:** Artikel · Belege · Diskussion · Versionen · Badge „verifiziert am … von …" (Guru-Prinzip, Erinnerung nach 90 Tagen). Chat-Panel daneben mit Zitaten, die in den Artikel springen. — *Warum:* Vertrauen entsteht durch sichtbare Herkunft und Prüfung. [64][68][69] — **mittel**
22. **Eval-Set aus dem echten Vault:** 40 Fragen (Fakt, Multi-hop, zeitlich, „hat sich geändert", „steht nicht drin") mit Soll-Antworten; läuft vor jedem Umbau von Retrieval oder Prompt. — *Warum:* LongMemEval/LoCoMo/MemBench zeigen, dass man Verschlechterung sonst nicht bemerkt. [61][62][63] — **klein**
23. **Kontext-Haushalt für Jarvis:** Kern-Blöcke ≤ 2k Tokens, Retrieval ≤ 5 Chunks, Kompaktierung langer Chats, Memory-Tool-Muster (`view` vor Aufgabe, Fortschritt notieren, „assume interruption") für Agenten-Läufe. — *Warum:* Aufmerksamkeit ist das knappe Gut, nicht Speicher. [6][7][52][53] — **klein**
24. **Kein LLM-Graph jetzt:** Wikilinks/Backlinks als `links`-Tabelle in SQLite; Retrieval expandiert Treffer um 1 Hop. GraphRAG/LightRAG/HippoRAG erst, wenn Multi-hop-Fragen im Eval-Set messbar scheitern. — *Warum:* Graph-Extraktion kostet bei kleinem Korpus mehr als sie bringt; Mem0 hat den externen Graphen 2026 wieder abgebaut. [4][10][19][20][21] — **klein**
25. **Inkrementeller Indexer:** Ordner-Watcher (z. B. chokidar) re-indexiert nur geänderte Dateien (Hash-Vergleich), Embeddings werden nur für geänderte Chunks neu berechnet. — *Warum:* auf einer vCPU ist ein Vollindex zu teuer; LightRAG und Smart Connections arbeiten genauso. [21][32] — **klein**

---

## Offene Entscheidungen für Kevin

1. **Embeddings — lokal oder API?**
   A) *Lokal klein* (`multilingual-e5-small`, 2 GB reichen, keine Daten verlassen den Server, Qualität „gut genug" für deutsche Notizen). B) *API* (Voyage/OpenAI; beste Qualität, Cent-Beträge, aber Notiz-Chunks gehen an einen US-Anbieter — mit AVV vertretbar, aber nicht „lokal"). C) *Server-Upgrade auf 4 GB + bge-m3* (Referenzqualität für Deutsch, lokal, ~5–8 €/Monat mehr).
2. **Wo liegt die Wahrheit?**
   A) *Vault-Markdown ist Single Source of Truth*, SQLite nur Index (jederzeit neu baubar, Obsidian bleibt Editor). B) *SQLite ist Quelle*, Markdown wird exportiert (bessere Transaktionen, aber Obsidian wird Zweitansicht). C) *Hybrid*: Notizen in Markdown, Episoden/Audit/Fakten-Tripel nur in SQLite.
3. **Wie viel darf Jarvis selbst schreiben?**
   A) *Nur Vorschläge* (alles über `_inbox/jarvis/`, Freigabe per Klick). B) *Vorschläge + eigenes Episoden-Log* ohne Freigabe (Empfehlung dieser Recherche). C) *Autonom in `gemeinsam`* mit Rückgängig-Knopf und täglichem Digest.
4. **Zwei Personen — ein Brain oder zwei?**
   A) *Ein Vault, Feld `vertraulichkeit`* (einfach, ein Index, Filter vor der Suche). B) *Drei Vaults* (kevin/malin/gemeinsam; härteste Trennung, drei Indizes, mehr Pflege). C) *Ein Vault, drei Ordner* mit Ordner-basierter Rechtevergabe.
5. **Versionierung mit Git oder eigener Tabelle?**
   A) *Git* (Rollback, Diff, gewohnt; echte Löschung nur mit Aufwand). B) *Versionstabelle in SQLite* (Löschung einfach, kein Diff-Komfort). C) *Beides*: Git für Notizen, SQLite-Versionen für Personendaten Dritter.
6. **Regelwerk — eine Konstitution oder viele Regel-Notizen?**
   A) *Eine `KONSTITUTION.md`* (≤ 200 Zeilen, immer geladen). B) *Viele `#regel`-Notizen* mit Frontmatter und Priorität, geladen nach Relevanz. C) *Beides*: kurze Konstitution (Werte, Rangfolge, harte Grenzen) + Regelregister (Details, nach Bedarf geladen) — Empfehlung dieser Recherche.
7. **Konsolidierung — wann räumt Jarvis auf?**
   A) *Nächtlich automatisch* (Vorschläge morgens in der Inbox). B) *Nur auf Zuruf* („Jarvis, räum auf"). C) *Wöchentlicher Review-Termin* mit Kevin/Malin gemeinsam (passt zum Wochenrhythmus).
8. **Deutsch-native Ausgabe — Sie/Du und Ton?**
   A) *Du, knapp, Jarvis-Persona* wie bisher. B) *Zwei Personas* (Kevin/Malin unterschiedlich). C) *Ton als `#regel` mit `gilt_fuer`*, damit jede Person ihren eigenen einstellt.

---

## Prüfung

- Nummerierte Quellen: 70 (Anforderung: mindestens 40).
- Jedes Themenfeld hat 6–17 Quellen; jede Entscheidung im Abschnitt „Was das für MAKE OS heißt" trägt Quellennummern, Begründung und Aufwand.
- Nicht selbst getestet: Laufzeitverhalten von e5-small/sqlite-vec auf der konkreten Hetzner-Instanz — das ist der erste Messpunkt beim Bau (Punkt 22, Eval-Set).
