# Welche KI für welche Aufgabe — Modelle, Anbieter, Schnittstellen

**Stand:** 08.10.2026 spät · Recherche und Empfehlung, **nichts gebaut** · ergänzt `AGENTEN_KONZEPT.md` (Frage 14 „Modelle“) und
`research/agenten/ARCHITEKTUR.md` (Modellstufen, Advisor, Kosten)
**Auftrag (Kevin, wörtlich):** „Andere KI für andere Sachen anbinden — z. B. ist Gemini bei manchen Sachen besser als Claude. Das müssen wir einmal
ausarbeiten, dass z. B. Research über die Google-API gemacht wird oder z. B. Banano die Bilder machen von Google, oder Videos sind mit die besten am
Markt, und da kann man das programmieren, soweit ich weiß … ausarbeiten, welche wir am besten nehmen für welche Aufgaben und welche Schnittstellen
gebaut werden müssen.“

> **Belastbarkeit:**
> - **[O]** = offizielle Doku, Preisseite, Rangliste oder Primärquelle selbst gelesen.
> - **[S]** = nur Suchausschnitt oder Drittquelle.
> - **„nicht belegt“** = gesucht, aber keine Quelle gefunden.
>
> Alle Quellen wurden am **08.10.2026** abgerufen (sechs parallele Recherche-Läufe, Quellenliste in Teil 9). Preise in US-Dollar.
> **Der Markt dreht sich monatlich.** Seit Juni sind Sora (API), Imagen und das erste „Nano Banana“ abgeschaltet worden. Modell-IDs und Preise darum
> vor dem Bau noch einmal prüfen und **nie fest im Code** führen (Teil 4). Hinweis, keine Rechtsberatung.

---

## 0 · Kurzfassung

1. **Kevins Bauchgefühl stimmt zweimal und einmal nur halb:**
   - **Bilder:** „Nano Banana“ heißt heute **Nano Banana 2.1** (`gemini-nano-banana-2.1`, GA seit 06.10.2026). Bei Artificial Analysis liegt es auf Platz 4 der Bild-Rangliste und kostet etwa **3,4 Cent je Bild**. OpenAI führt die Rangliste an, kostet aber das Sechsfache.
   - **Video:** Google ist vorn, aber mit **Gemini Omni Flash** (Platz 1 der Arena Text→Video), nicht mehr mit Veo. Sora gibt es als API nicht mehr (seit 24.09.2026).
   - **Research über Google** ist technisch stark (Deep Research Max). Googles Bedingungen verbieten aber, Ergebnisse zu speichern, zu „analysieren“ oder weiterzugeben. Für unsere Agenten, die Ergebnisse in Threads und Brain ablegen und an andere Agenten weiterreichen, passt das nicht. In der Search Arena liegen OpenAI und Claude vor Gemini.
2. **Denken, Text, Werkzeuge bleiben bei Claude.**
   - Opus 5.5 und Sonnet 5.5 führen den Artificial-Analysis-Index an (58/56).
   - **Unsere Stufen sind veraltet:** Im Code stehen Haiku 4.5 und Sonnet 5. Haiku 5.5 kostet 0,10 $ statt 1 $ je Mio. Eingabe-Token.
3. **Datenschutz-Befund:**
   - **Die Anthropic-API verarbeitet nie in der EU** (nur `global`/`us`). Anthropic steht **nicht** auf der DPF-Liste.
   - Unser Empfänger-Register sagt „DPF + SCC“ — das ist **zu korrigieren auf SCC**.
   - Claude in der EU gibt es über Google Vertex (`eu`, +10 %) oder AWS Bedrock Frankfurt.
4. **Sprache:**
   - Transkription in der EU über **Mistral Voxtral** (0,003 $/min, Firma und Daten in der EU).
   - Vorlesen weiter über die Gerätestimme, optional ElevenLabs v4.
   - Der Echtzeit-Assistent zu Hause ist als Kette machbar (Voxtral Realtime → Claude → Stimme). Ein reines Sprache-zu-Sprache-Modell mit belegter EU-Verarbeitung gibt es nur bei OpenAI, und nur nach Freigabe.
5. **Kein Gateway** (OpenRouter, Vercel, LiteLLM, Langdock): Jeder ist ein zusätzlicher Auftragsverarbeiter oder zu schwer für unseren Server. Stattdessen eigene schlanke Adapter hinter **einem Anbieter-Tor** neben `askText`.
6. **Bauen:** Schritt 0 (Register, Modellstufen, Protokoll-Feld „Anbieter“) → Anbieter-Tor + Preise/Budget + verschlüsselte Medien-Ablage → **Bilder** (Marketing) → **Transkription** → Research ausbauen → **Video** → Echtzeit.
7. **KI-VO:** Für neue Medien-Funktionen gilt die Kennzeichnungspflicht sofort. Die Übergangsfrist bis 02.12.2026 gilt nur für Systeme, die vor dem 02.08.2026 auf dem Markt waren. **Die Wasserzeichen und Herkunftsdaten der Anbieter nie entfernen.**

---

## 1 · Was der Code heute kann (geprüft 08.10.2026)

| Stelle | Stand | Folge für mehrere Anbieter |
|---|---|---|
| `lib/anthropic.ts` `askText` | einzige Modell-Tür; fest `api.anthropic.com`, Schlüssel `ANTHROPIC_API_KEY`, Guthaben-Schalter, Timeout/Retry | bleibt der Claude-Adapter; daneben ein Anbieter-Tor (Teil 4) |
| `lib/datenschutz/ki-tor.ts` | prüft Lauf-Art, Person, Kategorien, Web-Suche, Pseudonymisierung | kennt **keinen Anbieter** → je Anbieter erweitern |
| `lib/datenschutz/ki-protokoll.ts` | `KI_EMPFAENGER` fest „Anthropic PBC … Data Privacy Framework bzw. SCC“; Eintrag hat `modell`, kein `anbieter` | Feld `anbieter` + Empfänger aus dem Katalog; **DPF-Angabe für Anthropic falsch** (Teil 2.1) |
| `lib/datenschutz/einrichtung.ts` `EMPFAENGER_START` | einziger KI-Empfänger `anthropic`, `garantie: 'dpf-scc'` | auf `scc` korrigieren; neue Anbieter als archivierte Startwerte |
| `lib/datenschutz/ki-kennzeichnung.ts` `kiKennzeichen` | `durch: 'ZOE (KI-Modell von Anthropic)'` fest | je Anbieter/Modell |
| `lib/agent-config.ts` `MODEL_BY_TIER` | schnell `claude-haiku-4-5-20251001`, ausgewogen `claude-sonnet-5`, stark `claude-opus-5-5` | Haiku 5.5 / Sonnet 5.5 per Eval prüfen (ARCHITEKTUR.md Frage 11) |
| `lib/zoe/verbrauch.ts` `PREIS` | nur Token je Claude-Modell (Stand 07.09.); unbekannt = teuerster Preis | keine 5.5-Preise; keine Einheiten Bild/Sekunde/Minute/Zeichen/Suche |
| `lib/store/bild-ablage.ts` | verschlüsselt, AAD, `BILD_ORDNER` (Gerichte, Bauplan, WhatsApp) | neuer Ordner `ki-medien` |
| `hooks/useStimme.ts` | Diktat und Vorlesen über die Web-Speech-API im Browser („ohne fremden Dienst“) | Chrome schickt die Erkennung nach allgemeinem Kenntnisstand an Google-Server. **In dieser Recherche nicht belegt — prüfen**; bei Bestätigung den Kommentar und den Datenschutzhinweis anpassen |
| `lib/crm/netzwerken-karte.ts` `sprachnotizTranskribieren` | vorbereitet, Schalter `TRANSKRIPTION_AN`, sendet nie | hier dockt Voxtral an |
| `lib/brain/einbettung.ts` | lokal `Xenova/multilingual-e5-small` | bleibt |
| Web-Suche | `web_search_20250305` (Research-Agent) | ZDR-fähige Basisversion — gut |

---

## 2 · Markt je Aufgabe (Belege)

### 2.1 Denken, Text, Werkzeuge

| Modell (ID) | Ein/Aus $/Mio | Kontext | EU-Verarbeitung | ZDR | AA-Index |
|---|---|---|---|---|---|
| Claude Opus 5.5 (`claude-opus-5-5`) | 4 / 20 | 1 Mio | nur über Vertex `eu` oder Bedrock EU-Profil (+10 %) | auf Anfrage | 58 |
| Claude Sonnet 5.5 (`claude-sonnet-5-5`) | 2 / 10 | 1 Mio | wie Opus | auf Anfrage | 56 |
| Claude Haiku 5.5 (`claude-haiku-5-5`) | 0,10 / 0,50 (bis 100k Prompt) | 1 Mio | wie Opus | auf Anfrage | 43 |
| Claude Fable 5.1 (`claude-fable-5-1`) | 10 / 50 | 1 Mio | Bedrock nur `us-east-1`; **nie ZDR** (30 Tage Pflicht) | nein | 53 |
| OpenAI `gpt-6-astra` | 10 / 50 | 1,05 Mio | `eu.api.openai.com`, +10 %, **nur mit Freigabe + ZDR/MAM** | auf Freigabe | 53 |
| OpenAI `gpt-6.1-sol` | 2 / 10 | 1,05 Mio | wie Astra | wie Astra | 52 |
| OpenAI `gpt-6-luna` | 0,10 / 0,50 | 1,05 Mio | wie Astra | wie Astra | 38 |
| Gemini `gemini-3.8-flash` | 0,75 / 3,75 (ab 2027: 1,50 / 7,50) | 1 Mio | Vertex `eu` (+10 %) | Vertex: ja (Antrag + Einstellungen) | 41 |
| Gemini `gemini-3.1-pro-preview` | 2 / 12 | 1 Mio | **nicht belegt** (nur global) | wie oben | 30 |
| Gemini `gemini-3.5-flash-lite` | 0,30 / 2,50 | 1 Mio | Vertex `eu` | wie oben | 22 |
| Mistral Large 4 (`mistral-large-4`, Preview) | 0,68 / 2,09 Aktion (regulär 1,36 / 4,18) | 1 Mio | `api.eu.mistral.ai` (+10 %), Firma in Paris | auf Antrag [S] | 38 |
| Mistral Small 4 (`mistral-small-2603`) | 0,15 / 0,60 | 256k | wie Large | wie Large | 11 |

Quellen: A1–A10, O1–O3, G1–G7, M1–M9, B1 (AA-Index [S]).

- **Anthropic:**
  - Kein Training mit Kundeninhalten.
  - Löschung „within 30 days“; markierte Missbrauchsfälle bis 2 Jahre.
  - DPA mit SCC (Modul 2/3) gilt automatisch, EU-Vertragspartner ist Anthropic Ireland [O A4–A7].
  - **DPF: nicht auf der Liste** [O DPF-Abfrage].
  - Der Tokenizer ab Claude 4.7 erzeugt etwa 30 % mehr Tokens — wichtig für den Preisvergleich [O A1].
  - Batch −50 %. Cache-Lesen 0,05× bei Opus/Sonnet 5.5 [O A1].
- **OpenAI:**
  - Kein Training ohne Opt-in. Missbrauchs-Logs bis 30 Tage.
  - EU-Region nur nach Freigabe durch den Vertrieb [O O3].
  - DPF: nicht gefunden [O].
- **Google:**
  - Gemini Developer API (bezahlt): kein Training, DPA, Missbrauchs-Logs **55 Tage**, Speicherort beliebig.
  - Pflichten: Nutzer im EWR nur über bezahlte Dienste, Mindestalter 18, kein Konkurrenzmodell [O G3, G4].
  - Vertex AI (heißt jetzt „Gemini Enterprise Agent Platform“): ZDR erreichbar, EU-Region für einzelne Modelle [O G5–G7].
  - **Google LLC ist DPF-zertifiziert** [O DPF].
- **Mistral:**
  - **Training ist erst nach eigenem Opt-out im Admin-Panel aus** [O M6, M8].
  - Auf dem EU-Endpunkt gibt es nur Function Calling, kein Batch, keine Agents, keine Files [O M3].
  - **Schlüssel kaufen, verkaufen oder weitergeben ist verboten** (§ 2.2 h) [O M10].
- **Deutsch:** Ein unabhängiger aktueller Vergleich aller Anbieter ist **nicht belegt** (nur der MÖVE-Benchmark der Bundesdruckerei [S]) → eigener kleiner deutscher Testsatz.

### 2.2 Recherche mit Quellen

| Dienst | Preis | Qualität | Asynchron | Datenschutz/EU | Auflagen für Ergebnisse |
|---|---|---|---|---|---|
| **Claude `web_search` + `web_fetch`** | Suche 10 $/1.000 + Token; Fetch nur Token | Search Arena **Platz 2** (`claude-opus-4-6-search`, 1253) | Batches | ZDR mit Basisversionen (ab `_20260209` nur mit `allowed_callers:["direct"]`); nur US/global | Zitate anzeigen |
| **OpenAI `web_search`** (+ `gpt-5.6-sol` statt der abgeschalteten Deep-Research-Modelle) | 10 $/1.000 Aufrufe + Token; Modell 4/20 | Search Arena **Platz 1** (1257) | Hintergrundmodus + Webhook (dann **kein** ZDR) | EU nur mit ZDR/MAM-Zusatz, +10 % | Zitate „clearly visible and clickable“ |
| **Gemini + Google-Search-Grounding** | 14 $/1.000 Suchen (Gemini 3.x, 5.000/Monat frei) | Arena Platz 9 (3.1 Pro) | nein | API speichert 30 Tage, Vertex 3 Tage; ZDR nur „Web Grounding for Enterprise“ (Teilindex) | **Search Suggestions Pflicht; nur der fragenden Person zeigen; kein „cache, … analyze, train on“; speichern nur eng (z. B. Chatverlauf, ≤ 2 Jahre)** |
| **Gemini Deep Research (Max)** (`deep-research-preview-04-2026`, `deep-research-max-preview-04-2026`, Interactions API, Vorschau) | ca. 1–3 $ (Max 3–7 $) je Aufgabe | Herstellerwerte BrowseComp 85,9 % (Max) [S]; The Decoder: Vergleich „not quite apples to apples“ [S] | ja, Pflicht (`background`, `store=True`), bis 60 min, Polling | wie Grounding | wie Grounding; keine eigenen Function-Tools |
| **Perplexity Sonar** | `sonar` 1/1 + 5–12 $/1.000; `sonar-pro` 3/15 + 6–14 $ | Arena **Platz 29/31** | nur Deep Research (7 Tage vorgehalten) | ZDR (Chat Completions), SOC 2, USA, **DPF aktiv** | Output gehört dem Kunden [S] |
| Exa / Tavily / Brave (reine Suche) | 4–8 $/1.000 | nicht belegt | — | ZDR nur Enterprise; EU nicht belegt | Brave: speichern nur mit Speicherrecht im Plan |

Quellen: R1–R30.

**Bewertung:** Für Berichte, die MAKE OS **speichert, in Threads legt und an andere Agenten gibt**, passen Claude und OpenAI. Die Grounding-Auflagen von Google schließen genau das nach dem Wortlaut aus (eigene Einschätzung, keine Rechtsberatung). Gemini Deep Research taugt für einen **„Tiefenbericht zum Lesen“**: Er wird der fragenden Person angezeigt, mit Googles Suchvorschlägen, und wandert nicht ins Brain. Kevins bisherige Gemini-Deep-Research-Läufe in der Gemini-App (`research/ai-ceo/MORGEN_10_GEMINI_LAEUFE.md`) laufen unter den Bedingungen der App, nicht der API.

### 2.3 Bilder

| Modell (ID) | Preis je Bild | Stärke | Referenzen / Bearbeiten | Kennzeichnung | EU / Datenschutz |
|---|---|---|---|---|---|
| **Nano Banana 2.1** (`gemini-nano-banana-2.1`, GA 06.10.2026) | 1K 0,034 · 2K 0,050 · 4K 0,113 | AA Platz 4 (1160), Arena T2I Platz 6 (vorläufig) | bis 14 Referenzen (10 Objekt + 4 Charakter); Bearbeiten per Prompt, mehrstufig, keine Maske | **SynthID immer**; C2PA auf Vertex | EWR nur bezahlt; kein Training; Vertex nur Region `global` |
| **Nano Banana Pro** (`gemini-3-pro-image`) | 1K/2K 0,134 · 4K 0,24 | laut Google erste Wahl für Profi-Assets mit Text | 14 (inkl. 3 Stilbilder) | SynthID, C2PA (Vertex) | wie oben |
| Nano Banana 2 / 2 Lite (`gemini-3.1-flash-image` abgekündigt, `gemini-3.1-flash-lite-image`) | 0,067 / 0,034 (1K) | — | Lite „not optimized for multiple reference inputs“ | SynthID | wie oben |
| Nano Banana (`gemini-2.5-flash-image`) | — | **abgeschaltet 02.10.2026** laut Preisseite | — | — | — |
| Imagen 4 | — | **abgeschaltet** (Gemini API 17.08.2026) | — | — | — |
| **OpenAI GPT Image 2.5** (`gpt-image-2.5-sunburst` / `-flare`, seit 08.09.2026 [S]) | ca. 0,21 (max) [S] | **Arena-Platz 1/2** (Text→Bild und Bearbeiten, vorläufig) | Maske, mehrere Referenzen | C2PA + Wasserzeichen [S] | ZDR-fähig; EU nur mit Freigabe; Copyright Shield [S] |
| OpenAI GPT Image 2 | low 0,006 · medium 0,053 · high 0,211 (1024²) | Arena Platz 3 | wie oben | wie oben | wie oben |
| **FLUX 3 Image** (Black Forest Labs, Freiburg) | 1K 0,048 · 4K 0,607; FLUX.2 pro ab 0,03 | in den Ranglisten noch nicht gelistet | bis 10 Referenzen | „may embed Content Credentials“ | **EU-Endpunkt `api.eu.bfl.ai`**, aber **Standard-AGB: Training mit Ein- und Ausgaben erlaubt**, DPA nicht belegt, DPF nicht gefunden |
| Ideogram 4.5 | ca. 0,03–0,22 [S] | Text im Bild (4.0: 0,97 OCR [S]) | 4–5 Referenzen + Maske | nicht belegt | kein Training, aber „right to use … all User data“, **keine DPA**, Delaware |
| Recraft V4.1 | Raster 0,035, Vektor 0,08 | SVG/Vektor, Marken-Stile | Stil-Referenzen | nicht belegt | nicht belegt |
| Midjourney | — | **keine offizielle API**; AGB verbieten Automatisierung [S] | — | — | — |

Quellen: I1–I20.

### 2.4 Video

| Modell (ID) | Preis/Sek. | Länge | Ton | Auflösung | Kennzeichnung | EU / Datenschutz |
|---|---|---|---|---|---|---|
| **Gemini Omni Flash 1.1** (`gemini-omni-1.1-flash`, seit I/O 19.05.2026 [S]) | ca. 0,10 (720p), ca. 0,15 (1080p) | 10-s-Schritte, gesamt ≤ 40 s | ja | 360p–4K (ab 1080p hochskaliert) | SynthID; C2PA (Vertex, Vorschau) | **Arena Text→Video Platz 1/2**; im EWR/CH/UK kein Bearbeiten/Verlängern hochgeladener Videos; „nur Englisch vollständig“ |
| **Veo 3.1** (`veo-3.1-generate-preview` / Vertex `veo-3.1-generate-001` GA) | 0,40 (720p/1080p), 0,60 (4K), mit Ton | 4/6/8 s, verlängert ≤ 148 s (nur 720p) | immer | 720p–4K, 9:16 | **SynthID immer**; C2PA (Vertex) | Arena Platz 12, AA Platz 19; Vertex nur `us-central1`; EU nur `allow_adult` |
| Veo 3.1 Fast / Lite | 0,10–0,30 / 0,05–0,08 | wie Veo / ohne Verlängerung | ja | — | SynthID | wie Veo |
| OpenAI Sora 2 / 2 Pro | — | **API abgeschaltet seit 24.09.2026**, kein Nachfolger | — | — | — | — |
| Runway Gen-4.5 | 0,12 | 10 s [S] | unklar | 720p | nicht belegt | Training nur mit Enterprise-Vertrag ausgeschlossen [S] |
| Kling 3.0 | ca. 0,08–0,14 [S] | 15 s | ja | bis 4K | nicht belegt | Singapur, Mutterkonzern in China, Übermittlungsgrundlage unklar → **nein** |
| Luma Ray 3.2 | 0,06–0,36 | 10 s | nicht belegt | ≤ 1080p | nicht belegt | Training nur bei Provisioned Throughput ausgeschlossen |
| Wan 3.0, Seedance 2.x, MiniMax H3 | — | — | — | — | — | AA-Spitze, aber China-Risiko; MiniMax-H3-Gewichte in der EU nicht lizenziert [S] |

Quellen: V1–V15.

- **Ablauf:** Video läuft immer asynchron (Abfrage etwa alle 10 s, 11 s bis 6 min).
- **Ergebnisse liegen nur 2 Tage beim Anbieter** → sofort in die eigene Ablage holen.
- **Freistellung (Indemnity)** gibt es bei Google nur über Vertex und nur für GA-Modelle [S].

### 2.5 Sprache

**Transkription:**

| Dienst | Preis | Qualität (AA-WER, überwiegend Englisch) | EU / Datenschutz |
|---|---|---|---|
| **Mistral Voxtral Mini Transcribe V2** / Realtime | 0,003 / 0,006 $/min | 3,6 % (Voxtral Small 2,8 %) | Daten standardmäßig in der EU [S]; 30 Tage Logs außer ZDR; **Training-Opt-out nötig**; Realtime ohne Sprechertrennung |
| Speechmatics Melia / Enhanced | 0,24–0,80 $/h | 4,0 % | Region EU wählbar; Live nie gespeichert, Dateien 7 Tage; Training nur mit Zustimmung |
| Gladia Solaria-3 | 0,61–0,75 $/h (Growth ab 0,20) | 3,2 % | `eu-west` Standard; 3 Wochen Aufbewahrung; ZDR nur Enterprise |
| Gemini 3.5 Transcribe | ca. 0,005 $/min | **2,6 %** | EU nur über Vertex `eu` (für dieses Modell nicht belegt) |
| OpenAI `gpt-transcribe` | 0,0045 $/min | 3,3 % | EU nach Freigabe +10 % |
| ElevenLabs Scribe v2 | 0,22 $/h | **2,2 %** | EU nur Enterprise |
| Lokal (Whisper large-v3 / Voxtral Mini 4B) | Hardware | FLEURS DE 6,19 % (Voxtral rt) | ≥ 6–16 GB Grafikspeicher → **nicht auf unserem Server** |

**Eine unabhängige Deutsch-Bewertung ist nicht belegt** (AA misst fast nur Englisch) → eigener Test mit deutschem Gesprächsaudio.

**Vorlesen:**
- **ElevenLabs v4 / v4 Turbo:** 0,08 / 0,04 $ je 1.000 Zeichen, AA Platz 1 (1327), SynthID-Wasserzeichen [S], DPF aktiv; EU-Residenz nur Enterprise.
- **Gemini 3.8 Flash TTS:** 9 $/Mio. Audio-Token (ab 2027: 18 $), 1277 Punkte, 30 Stimmen mit Deutsch.
- **OpenAI `gpt-4o-mini-tts`:** Stimmen „für Englisch optimiert“; KI-Stimme muss den Hörern offengelegt werden.
- **Voxtral TTS** (`voxtral-mini-tts-2603`): 0,016 $/1.000 Zeichen [S], EU, aber nur 1083 Punkte; Gewichte CC BY-NC.
- **Azure Germany West Central:** 15 $/Mio. Zeichen.

**Echtzeit (Fernziel Sprachassistent zu Hause):**
- **OpenAI GPT-Live-1:** 0,05 $/min plus Hintergrundmodell für Werkzeuge; AA 83,2 Punkte, Werkzeugnutzung 74,5 %; Endpunkte EU-residenzfähig (Freigabe nötig); WebRTC/WebSocket/SIP.
- **Gemini 3.8 Live:** 0,005 $/min rein, 0,018 $/min raus; WebSocket, Funktionen, kurzlebige Schlüssel. EU nur für `gemini-live-2.5-flash-native-audio` belegt, das am 13.12.2026 abgeschaltet wird.
- **ElevenLabs Agents:** 0,08 $/min.
- **Mistral:** keine Sprache-zu-Sprache, nur Kette STT → LLM → TTS.
- **Anthropic: keine Sprach-API belegt.**

Quellen: S1–S25.

### 2.6 Embeddings (Brain-Suche)
- **Heute lokal** `multilingual-e5-small` — kein Byte verlässt den Server. Das ist ein Datenschutz-Vorteil, der bleiben sollte.
- **Extern, falls nötig:**
  - Mistral `mistral-embed-2312` (0,10 $/Mio., EU)
  - Google `gemini-embedding-001` auf Vertex `eu`
  - Voyage `voyage-4` (0,06 $; von Anthropic genannt)
  - OpenAI `text-embedding-3-small` (0,02 $)

  Quellen: E1–E3, G1, M4, O1, A11.

### 2.7 Vermittler und Gateways

| Dienst | Kosten | Datenschutz | Eignung |
|---|---|---|---|
| OpenRouter | 0 % auf Modelle, 5,5 % auf Guthaben; BYOK frei bis 25.000 $/Monat | US-Firma, **nicht im DPF**; EU-Routing nur Business/Enterprise; Stripe-Übernahme angekündigt [S] | nein — zusätzlicher Drittland-Verarbeiter |
| Vercel AI Gateway | 0 % (Guthaben Pflicht) | DPF aktiv, aber Gateway global; **scheitert ein BYOK-Aufruf, nimmt Vercel eigene Schlüssel** | nein |
| **Vercel AI SDK** (Bibliothek, Apache-2.0) | frei | kein zusätzlicher Verarbeiter; `generateImage`/`generateSpeech`/`transcribe` stabil, Video experimentell; Node ≥ 22, nur ESM | **möglich**, aber eigene Adapter sind schlanker (Teil 4.3) |
| LiteLLM (selbst gehostet) | MIT | ≥ 1 vCPU + 4 GiB je Worker + Postgres; Lieferketten-Vorfall 03/2026 (PyPI) [S] | nein — passt nicht auf 1 vCPU / 2 GB |
| Langdock API (Berlin) | Token; Aufschlag widersprüchlich (0 % bzw. 10 %) | EU-Endpunkt, Azure Frankfurt [S], AVV | Text ja; Bild/Video/Audio kaum belegt |
| Google Vertex AI | Anbieterpreis (+10 % EU) | Google im DPF; Claude, Gemini, Veo, Imagen hinter **einem** Vertrag | **guter EU-Weg für Claude und Gemini-Text** |

Quellen: W1–W32.

### 2.8 Recht
- **KI-VO Art. 50:**
  - Die Pflichten gelten seit **02.08.2026**.
  - **Digital Omnibus = VO (EU) 2026/1744** (in Kraft seit 27.07.2026). Für die maschinenlesbare Kennzeichnung (Abs. 2) gibt es eine Frist bis **02.12.2026**, aber **nur für Systeme, die vor dem 02.08.2026 auf dem Markt waren**. Neue Funktionen müssen sofort kennzeichnen [O W34, S W35].
  - Hochrisiko nach Anhang III gilt jetzt ab 02.12.2027.
- **Verhaltenskodex Kennzeichnung:**
  - Final seit 10.06.2026, freiwillig.
  - Mehrschichtig: wo nötig mindestens **zwei maschinenlesbare Schichten** (Metadaten/C2PA, Wasserzeichen); Erkennung muss bis 02.02.2027 anbieterübergreifend gehen [S].
  - Leitlinien vom 20.07.2026: Chatbots/Agenten müssen offenlegen, dass sie KI sind und **für wen sie handeln**. Ein Satz in den AGB reicht nicht. Zusammenfassungen sind nicht ausgenommen, geschlossene B2B-Umgebungen schon [S].
- **DPF:**
  - Das EuG hat die Klage Latombe am 03.09.2025 abgewiesen. Das Rechtsmittel C-703/25 P ist anhängig.
  - PCLOB ist nicht beschlussfähig. Die norwegische Datenschutzbehörde rät zu einer Exit-Strategie [O/S W40–W45].
- **DPF-Liste (abgefragt 08.10.):**

  | Status | Anbieter |
  |---|---|
  | aktiv | Google LLC, ElevenLabs, Perplexity, Vercel |
  | nicht gefunden | **Anthropic, OpenAI**, Black Forest Labs, Runway, OpenRouter |

- **`datenschutz/KI_VO.md` ist veraltet:** Dort fehlen der Omnibus, die neuen Daten zu Anhang III und der Kodex. Die Tabelle ist nachzuziehen.

---

## 3 · Routing-Tabelle: Aufgabe → Modell

Die **erste Wahl** ist Standard der Instanz, die **zweite Wahl** springt nur ein, wenn die erste ausfällt oder gesperrt ist — und **nie in eine schwächere
Datenschutzstufe** (Regel R3 in Teil 4). Kosten = Richtwert je typischem Vorgang.

| Aufgabe | Erste Wahl | Zweite Wahl | Begründung | Kosten (Richtwert) | Datenschutz |
|---|---|---|---|---|---|
| **ZOE-Gespräch, Head-Chat, Werkzeuge** | Claude **Sonnet 5.5** (ausgewogen); **Opus 5.5** für Reviews/stark | OpenAI `gpt-6.1-sol` | AA-Index-Spitze, Werkzeugnutzung; Prompts, Caching, Schema sind auf Claude gebaut | Zug mit 30k Ein / 2k Aus: ca. 0,08 $ (Sonnet), 0,16 $ (Opus) | direkte API: USA/global, SCC; EU über Vertex (Frage 1) |
| **Mitarbeiter, Klassifizieren, Extrahieren, Inbox-Einstufung, Zusammenfassen** | Claude **Haiku 5.5** (nach Eval) | Gemini `gemini-3.8-flash` (Vertex `eu`) | 10× günstiger als Haiku 4.5; laut Anthropic für „classification, extraction, routing“ | 30k Ein: ca. 0,003 $ | wie oben |
| **Privat sensibel: Gesundheit (Art. 9), Finanzen privat, Familie** | Claude Sonnet 5.5 **über Vertex `eu`** + ZDR-Antrag | Mistral Large 4 / Medium 3.5 auf `api.eu.mistral.ai` (Training-Opt-out!) | Verarbeitung in der EU; Google im DPF, Mistral EU-Firma | +10 % | **nur EU, nie Rückfall auf USA** |
| **Recherche mit Quellen** (Research-, Prospecting-Mitarbeiter) | Claude `web_search` + **`web_fetch`** (Basisversionen, ZDR-fähig) | OpenAI `web_search` | Search Arena Platz 2/1; Ergebnisse dürfen in Threads/Brain liegen | 10 Suchen + 100k Token Sonnet: ca. 0,35 $ | USA; Suchbegriffe ohne Personennamen, außer bei Lead-Recherche mit Zweck (Art. 14) |
| **Tiefenbericht zum Lesen** (Markt, Wettbewerb, 20–60 min) | **Gemini Deep Research (Max)** — nur Anzeige für die fragende Person, mit Google-Suchvorschlägen, nicht ins Brain | eigener Claude-Rechercheplan (Lead + Mitarbeiter, ARCHITEKTUR.md) | stark bei langen Recherchen; Kevins Wunsch | 1–3 $ (Max 3–7 $) | Google, DPF; `store=True` nötig; **Auflagen beachten** |
| **Bilder für Marketing** (LinkedIn, Einladung, Visual) | **Nano Banana 2.1** (1K/2K) | OpenAI GPT Image 2 (medium) | fast Spitze, günstigste der Spitzengruppe; 14 Referenzen für Markenkonsistenz; SynthID | 0,034–0,05 $ je Bild | Google DPF, kein Training; Vertex nur `global` |
| **Bilder mit viel Text / Profi-Assets** | **Nano Banana Pro** | GPT Image 2.5 (Qualitätsspitze, ca. 0,21 $) | Google empfiehlt Pro für Text; OpenAI führt die Arena | 0,134 $ | wie oben; OpenAI EU nur mit Freigabe |
| **Vektor/Logo-Varianten** (später) | Recraft V4.1 | — | SVG-Ausgabe | 0,08 $ | DPA nicht belegt → nur ohne Personendaten |
| **Kurzvideo** (Social, Teaser, ≤ 40 s) | **Gemini Omni Flash 1.1** | **Veo 3.1 Fast** | Arena Platz 1; Ton; SynthID | 10 s 1080p ≈ 1,50 $ | Google; im EWR keine Bearbeitung hochgeladener Videos, keine Kinder |
| **Längeres Video** (bis 148 s) | **Veo 3.1** (Verlängerung, 720p) | — | einziges mit 148 s | 60 s ≈ 24 $ (Standard) / 6 $ (Fast) | Vertex: `us-central1` |
| **Transkription** (Sprachnotiz, Meeting, Datei) | **Mistral Voxtral Mini Transcribe V2** | Speechmatics (EU-Region) | EU-Firma, EU-Daten, Sprechertrennung, sehr günstig | 60 min ≈ 0,18 $ | EU; ZDR + Training-Opt-out setzen |
| **Diktat live** | **Voxtral Realtime** (über unseren Server) | Gerät (Web Speech; Datenweg prüfen) | < 200 ms, EU | 0,006 $/min | EU |
| **Vorlesen** | **Gerätestimme** (Browser, lokal, kostenlos) | ElevenLabs **v4 Turbo** (Schalter je Person) | Privatheit; ElevenLabs bei Bedarf beste Qualität | 1.000 Zeichen ≈ 0,04 $ | ElevenLabs DPF; EU nur Enterprise |
| **Echtzeit-Assistent zu Hause** (Fernziel) | **Kette:** Voxtral Realtime → ZOE (Claude über KI-Tor) → Stimme | OpenAI **GPT-Live-1** (EU nach Freigabe) | Kette behält ZOEs Werkzeuge, Stapel und Tor; Sprache-zu-Sprache wäre ein zweites Gehirn | Kette ≈ 0,01 $/min + LLM; GPT-Live-1 0,05 $/min | Kette EU-fähig (Claude über Vertex `eu`) |
| **Bilder lesen** (Belege, Visitenkarten) | Claude Haiku/Sonnet 5.5 (wie heute) | Gemini 3.8 Flash | vorhanden | < 0,01 $ | wie Text |
| **Brain-Suche (Embeddings)** | **lokal** `multilingual-e5-small` (wie heute) | Mistral `mistral-embed` (EU) | nichts verlässt den Server | 0 | lokal |

**Monats-Richtwert für Kevins Instanz** (eigene Schätzung; nur die neuen Medien und Recherche, Text wie heute):

| Posten | Kosten |
|---|---|
| 200 Bilder (Nano Banana 2.1, ein Teil Pro) | 7–27 $ |
| 20 Kurzvideos à 10 s (Omni Flash) | 20–30 $ |
| 20 h Transkription (Voxtral) | ca. 4 $ |
| 60 Recherchen (Claude) | ca. 20 $ |
| 8 Tiefenberichte (Gemini) | 8–56 $ |
| **Summe** | **ca. 60–140 $ im Monat** |

---

## 4 · Schnittstellen-Bauplan für MAKE OS

### 4.1 Grundsätze (gelten für jeden neuen Anbieter)
- **R1 · Eine Tür je Fähigkeit, ein Tor für alle.** Jeder Modellaufruf, egal welcher Anbieter, läuft durch **ein** Anbieter-Tor. Wächter: kein `fetch` auf einen Anbieter-Host außerhalb von `lib/ki/adapter/*` (Scan wie `tests/ki-datenschutz.test.ts`).
- **R2 · IDs, Preise, Regionen sind Daten, kein Code.**
  - Katalog und Preisliste stehen mit **Stand-Datum und Quell-URL** je Eintrag.
  - Instanz-Einstellungen können sie überschreiben.
  - Ein abgeschaltetes Modell darf nie eine Seite brechen: Der Katalog führt `abgeschaltetAm`, das Tor nimmt dann die zweite Wahl.
- **R3 · Rückfall nie in eine schwächere Datenschutzstufe.**
  - Stufen: lokal > EU+ZDR > EU > DPF > SCC > keine.
  - Eine Kategorie mit Mindeststufe (Gesundheit: EU+ZDR) wird lieber gesperrt (`ki-gesperrt:anbieter-stufe`) als in die USA umgeleitet.
- **R4 · Kein Gateway, eigene schlanke Adapter** (REST mit `fetch`, wie `askText`; keine schweren SDKs). Die Gründe stehen in Teil 2.7.
- **R5 · Agenten wirken nur über `fuehreAus`.**
  - Bild, Video und Tiefenbericht sind **Werkzeuge im Register** mit Risiko-Stufe.
  - Veröffentlichen bleibt immer Klick-Sache (Regel 3).
- **R6 · Fremder Inhalt bleibt fremd.**
  - Rechercheergebnisse, Webseiten und Bildbeschreibungen kommen in `fremd()`.
  - Erzeugte Medien sind **unsere** Daten, aber mit Herkunft.

### 4.2 Bausteine

```
lib/ki/
  faehigkeiten.ts   rein: 'text'|'recherche'|'tiefenbericht'|'bild'|'video'|'stt'|'tts'|'echtzeit'|'embedding'
  anbieter.ts       rein: Katalog (Teil 4.2.1)
  routing.ts        rein: ROUTEN (Teil 3) + routeFuer(aufgabe, einstellung, verfuegbar, mindestStufe)
  preise.ts         rein: Preise mit Einheit, Stand, Quelle; schaetze(aufgabe, parameter)
  tor.ts            Server: anbieterTor() = kiTor() + Anbieter-Regeln + Budget
  aufruf.ts         Server: kiAufruf() — Tor → Adapter → Protokoll → Verbrauch (askText bleibt Hülle für Claude)
  medien.ts         Server: Ablage ki-medien (verschlüsselt) + Metadaten-Bestand
  adapter/
    anthropic.ts    (aus askTextSenden herausgelöst; optional Ziel Vertex `eu`)
    google.ts       Gemini-Text, Bild, Video (LRO), Deep Research (Interactions), TTS/STT
    mistral.ts      Voxtral STT/Realtime, Large/Medium EU
    openai.ts       (zweite Wahl: web_search, gpt-image, GPT-Live)
    elevenlabs.ts   (optional TTS)
```

**4.2.1 Anbieter-Katalog** (`lib/ki/anbieter.ts`, Daten, keine Namen von Personen):
```ts
type Stufe = 'lokal' | 'eu-zdr' | 'eu' | 'dpf' | 'scc' | 'keine';
interface KiAnbieter {
  id: 'anthropic' | 'anthropic-vertex-eu' | 'google' | 'google-vertex' | 'mistral' | 'openai' | 'elevenlabs' | 'lokal';
  name: string;                         // „Google (Gemini API)“
  empfaengerId: string;                 // Eintrag im Empfänger-Register (EMPFAENGER_START), Pflicht
  hosts: string[];                      // erlaubte Hosts (wie GOOGLE_HOSTS), Wächter
  umgebung: string[];                   // Namen der Variablen, nie Werte
  stufe: Stufe;                         // Datenschutz-Stufe dieses Zugangs
  faehigkeiten: Faehigkeit[];
  kennzeichnung: ('synthid' | 'c2pa')[];// was der Anbieter einbettet — nie entfernen
  modelle: { id: string; faehigkeit: Faehigkeit; stand: string; quelle: string; abgeschaltetAm?: string; vorschau?: boolean }[];
}
```

**4.2.2 Anbieter-Tor** (`anbieterTor({ anbieter, faehigkeit, ki, schaetzung })`), Reihenfolge:
1. Der Anbieter ist in der Instanz eingeschaltet und der Schlüssel ist vorhanden (sonst `nicht-eingerichtet`).
2. **Der Empfänger im Register ist nicht archiviert.** Mit Instanz-Schalter „streng“ (Vorgabe für Kunden-Instanzen) muss zusätzlich der **AVV bestätigt** sein (sonst `avv-offen`).
3. Das bestehende **`kiTor`** prüft wie heute Hintergrund, Bereiche, Einwilligung (b) und Pseudonymisierung.
4. **Mindeststufe je Kategorie:**
   - `gesundheit` → `eu-zdr`; Familie (neue Kategorie laut Konzept) → `eu`.
   - Neue Kategorien `stimme` (Audio einer Person) und `personenbild` (Foto einer realen Person als Eingabe): nur mit Einwilligung der abgebildeten bzw. sprechenden Person und nie für Stimmklone.
5. **Budget:** Monat gesamt, je Head, je Auftrag (Teil 4.5). Eine Schätzung über der Rückfrage-Schwelle führt zu `kosten-rueckfrage`.
6. Ergebnis: `{ ok, anbieter, modell, region, pseudonym }` bzw. `ki-gesperrt:<grund>` (bestehende `kiSperrText` um die neuen Gründe ergänzen).

**4.2.3 `askText` bleibt.** Die heutige Signatur gilt weiter (über 20 Aufrufer, Wächter). Intern ruft sie `kiAufruf({ faehigkeit: 'text', anbieter: wahl ?? 'anthropic' })` auf. `AskOptions.ki` bekommt optional `anbieter`/`mindestStufe`. Neue Medien-Aufrufer nehmen `kiBild`, `kiVideo`, `kiTranskript`, `kiStimme` und `kiTiefenbericht` aus `lib/ki/aufruf.ts`. **Guthaben-Schalter je Anbieter** (heute nur Anthropic).

### 4.3 Schlüssel je Instanz
- **Nur aus der Umgebung**, gesetzt über ein Skript `deploy/ki-anbieter-verbinden.sh <anbieter>`: fragt verdeckt, schreibt `.env`, kennt `--entfernen` (wie `whatsapp-verbinden.sh`/`whoop-verbinden.sh`). Nie im Browser, Log oder Protokoll.
  - **Google:** `GEMINI_API_KEY` (Gemini API) **oder** `GOOGLE_VERTEX_PROJEKT`, `GOOGLE_VERTEX_REGION` (`eu`), `GOOGLE_VERTEX_SCHLUESSEL_DATEI` (Dienstkonto, Datei außerhalb von `.data`, nur lesbar für den App-Nutzer). Der OAuth-Weg je Person (`lib/google/verbindung.ts`) ist **ein anderer Zugang** und bleibt für Kalender/Gmail.
  - **Mistral:** `MISTRAL_API_KEY`, `MISTRAL_REGION=eu`.
  - **OpenAI:** `OPENAI_API_KEY`, `OPENAI_REGION=eu` (nur nach Freigabe).
  - **ElevenLabs:** `ELEVENLABS_API_KEY`.
  - **Anthropic:** wie heute `ANTHROPIC_API_KEY`; optional `ANTHROPIC_ZIEL=vertex-eu`.
- **Oberfläche:** System › Verbindungen › „KI-Anbieter“ zeigt nur eingerichtet ja/nein, letzter Fehler, Region, Stufe und den AVV-Status aus dem Register.
- **HOI-Befund:**
  - Schlüssel abgelehnt (401) → rot.
  - Guthaben leer → gelb.
  - Vorschau-Modell in Gebrauch → gelb.
  - Modell abgekündigt → gelb mit Datum.
- **Verträge:** Jeder Kunde schließt seine eigenen Anbieter-Verträge, der Schlüssel liegt in seiner Instanz. MAKE ist dann kein Zwischenhändler — wichtig, weil Mistral die Weitergabe von Schlüsseln verbietet (§ 2.2 h) und Anthropic dem Weiterverkauf zustimmen muss (Frage 11).

### 4.4 Medien-Ablage (verschlüsselt)
- **Inhalt:** neuer Ordner `ki-medien` in `BILD_ORDNER` (`lib/store/datei-huelle.mjs`). Damit greifen Rotation, Umschlüsseln-Skript und Sicherungsprüfung automatisch. Name `km-<uuid>.bin`, Hülle `binImModus` mit AAD `ki-medien/<name>`.
- **Metadaten:** Bestand `ki-medien--<haushalt>` (Eintrag im Speicher-Register mit Rechtsgrundlage, Art. 15, Löschfrist):
  ```ts
  interface KiMedium { id: string; art: 'bild' | 'video' | 'audio'; mime: string; bytes: number;
    anbieter: string; modell: string; erzeugtAm: string; person: string; headId?: string; fadenId?: string;
    prompt: string;                       // eigener Text der Person/des Agenten, ≤ 4.000 (413), Kontaktnamen pseudonymisiert
    referenzen?: string[];                // ki-medien-/Datei-Kennungen, nie fremde URLs
    kennzeichnung: { synthid?: boolean; c2pa?: boolean; eigeneMarke: true };
    kosten: { einheit: string; menge: number; cent: number };
    freigegebenVon?: string; veroeffentlichtAm?: string; geloeschtAm?: string }
  ```
- **Grenzen:** Bild ≤ 15 MB, Video ≤ 60 MB, sonst 413. Video wird **gestreamt auf die Platte** geladen und danach verschlüsselt, damit nie 60 MB doppelt im Arbeitsspeicher liegen (Server 2 GB).
- **Abholen:** Video und Tiefenbericht laufen asynchron als Auftrag in `zoe-auftraege` (`art: 'agent', name: 'medien' | 'tiefenbericht'`, Pacht, 3 Versuche, Kostengrenze je Auftrag). Der Takt fragt die Operation des Anbieters ab und holt das Ergebnis **sofort** ab (Veo: 2 Tage Frist). **Keine Webhooks**, also kein neuer offener Pfad.
- **Rechte:** Zugriff je Haushalt bzw. Person wie die Aufgaben-Dateien; Wächter „Sicht X bekommt nichts aus Y“.
- **Löschen:** Papierkorb, endgültig nach 30 Tagen. Löschfrist für unbenutzte Entwürfe: Vorschlag 12 Monate (Frage in Teil 8).

### 4.5 Kostenmessung und Budget
- **`lib/ki/preise.ts`:** eine Zeile je Modell und Einheit (`token-ein`, `token-aus`, `cache-lesen`, `cache-schreiben`, `bild@1k`, `sekunde@1080p+ton`, `minute`, `zeichen-1000`, `suche-1000`, `aufgabe`), dazu `stand` und `quelle`. Unbekannt → höchster Preis der Fähigkeit + HOI gelb, wie heute.
- **`lib/zoe/verbrauch.ts`** bekommt `anbieter` und `einheit`. Die Auswertung je Zweck bleibt, „je Head“ und „je Auftrag“ kommen dazu.
- **Budget:** Bestand `ki-budget--<haushalt>` mit drei Grenzen: Monat gesamt (Warnung bei 80 %), je Head, je Auftrag. Bei erreichter Grenze sperrt das Tor (`ki-gesperrt:budget`); der Heads-Grundlauf bleibt der Rückfall.
- **Kostenschätzung vor dem Auftrag:** `schaetze('video', { sekunden: 10, aufloesung: '1080p' })` → „ca. 1,50 $“ steht im Bestätigungsdialog und im Stapel-Vorschlag.

### 4.6 Kennzeichnung nach KI-VO
- **Nie entfernen:** SynthID und C2PA der Anbieter bleiben erhalten. **Erzeugte Medien laufen nie durch `lib/netzwerken/bild-bereinigen.ts`** (der Exif-Säuberer würde die C2PA-Daten löschen) — Wächtertest mit Fixture.
- **Zweite Schicht (Kodex: zwei Schichten):** Herkunftsfeld `KiMedium.kennzeichnung` plus `kiKennzeichen(anbieter, modell)` in jeder Antwort. Bei Export/Download zusätzlich eine kleine Begleitdatei bzw. das Metadatenfeld „KI-generiert (Anbieter, Modell, Datum)“.
- **Sichtbar:**
  - `<KiMarke />` an jedem Medium in der App.
  - Beim Veröffentlichen realistischer Personen oder Orte (Deepfake, Abs. 4) eine sichtbare Kennzeichnung — Umfang entscheidet Kevin (Frage 14), Anwalt prüft.
- **Stimme:** Vorlesen über ElevenLabs bzw. OpenAI nur mit dem Hinweis „Stimme: KI“. ZOE nennt sich überall „ZOE (KI)“ (KI_VO.md K5).
- **Text:** K6 (Herkunftsfeld an Entwürfen) bleibt offen. Nach den Leitlinien sind **Zusammenfassungen nicht ausgenommen**.

### 4.7 Datenschutz-Nachzug je Anbieter (vor dem ersten Aufruf)
1. **Eintrag im Empfänger-Register:** Rolle, Zweck, Daten, Drittland, Garantie wie belegt.
   - Google: DPF + SCC.
   - Mistral: EU.
   - OpenAI: SCC, nicht DPF.
   - ElevenLabs: DPF.
   - Anthropic: **SCC** statt „DPF + SCC“.

   Die neuen Einträge stehen archiviert, bis der AVV abgelegt ist.
2. **Verzeichnis:** VVT-Eintrag (`verarbeitungenPlattform`) und `KONTO_VERARBEITUNGEN`.
3. **Art. 15:** Empfänger je tatsächlich genutztem Anbieter aus dem KI-Protokoll (`anbieter`-Feld), nicht mehr der feste `KI_EMPFAENGER`.
4. **Einstellungen beim Anbieter:**
   - Mistral: Training-Opt-out im Admin-Panel, ZDR beantragen.
   - Google Vertex: ZDR-Ausnahme beantragen und den 24-h-Cache abschalten.
   - OpenAI: EU-Projekt mit ZDR/MAM.
5. **KI-Schalter** (`lib/datenschutz/ki-einstellungen.ts`):
   - Neue Instanz („sparsam“): nur Text an.
   - Medien-Anbieter einzeln an/aus durch den Inhaber, jede Person kann für sich einschränken.

---

## 5 · Reihenfolge des Baus

| # | Paket | Inhalt | Warum jetzt | Aufwand (grob) |
|---|---|---|---|---|
| **0** | **Aufräumen ohne neuen Anbieter** | Empfänger `anthropic` → `scc`; `KI_EMPFAENGER`-Text; `MODEL_BY_TIER` auf 5.5 **nach Eval-Lauf** (`lib/heads/eval.ts`); Preise 5.5 in `verbrauch.ts`; `KI_VO.md` auf Omnibus/Kodex; Feld `anbieter` im KI-Protokoll | Falsche Rechtsangabe, Kostenschätzung „teuerster Preis“ | ½ Tag |
| **1** | **Anbieter-Tor (Fundament)** | `lib/ki/*` mit Katalog, Routing, Preisen, Tor, `kiAufruf`; Claude-Adapter herausgelöst; Budget; Medien-Ablage; Wächter R1/R3; **bit-gleich ohne neuen Anbieter** | Alles Weitere dockt hier an | 1–2 Nächte |
| **2** | **Bilder** (Marketing-Mitarbeiter „Design“) | Google-Adapter Bild (Nano Banana 2.1/Pro), Werkzeug `bild_erzeugen`, Referenzen aus der Ablage (Logo, Farben aus Gesellschafts-Steckbrief), Galerie im Head-Chat | Kevins „Zuerst: Marketing · Design“ (Antwort 5); größter sichtbarer Nutzen | 1 Nacht |
| **3** | **Transkription EU** | Mistral-Adapter Voxtral; `sprachnotizTranskribieren` scharf (Transkript ersetzt Audio); Meeting-Datei; Diktat über den Server | Haken liegt bereit; hilft Netzwerken und Meetings | 1 Nacht |
| **4** | **Research ausbauen** | `web_fetch` für den Research-Mitarbeiter; Gemini Deep Research als „Tiefenbericht“ (Auftrag, Anzeige mit Suchvorschlägen, nicht ins Brain) | Kevins Research-Wunsch, Auflagen sauber getrennt | 1 Nacht |
| **5** | **Video** | Omni Flash / Veo 3.1 Fast über die Warteschlange, Kostenschätzung + Klick | teuerste Fähigkeit, braucht Budget und Ablage | 1 Nacht |
| **6** | **Claude über Vertex `eu`** (nach Frage 1) | Adapter-Ziel `vertex-eu`, Mindeststufe für Gesundheit/Privat | DSGVO-Gewinn für Art. 9; vorher prüfen: Web-Suche, Caching, Schema auf Vertex (**nicht belegt**) | 1 Nacht + Test |
| **7** | **Stimme & Echtzeit** | Vorlesen-Schalter (ElevenLabs), Prototyp Kette Voxtral Realtime → ZOE → Stimme | Fernziel, nach Q1 | später |

Abhängigkeiten: 0 → 1 → (2, 3, 4 parallel möglich, getrennte Adapter-Dateien) → 5. Paket 6 kann nach 1 jederzeit kommen.
**Verträge/AVV** je Anbieter vor dem ersten echten Aufruf; Tests laufen mit Fakes (`tests/fixtures/ki-*-fake.ts`, kein Netz).

**Wächtertests:**
- Kein Host außerhalb der Adapter.
- Jeder Katalog-Anbieter hat einen Empfänger-Eintrag und einen VVT-Eintrag.
- Gesundheit nie unter `eu-zdr`.
- Das Protokoll trägt `anbieter` und keine Inhalte.
- Jede Preiszeile hat Stand und Quelle.
- C2PA bleibt erhalten.
- Rückfall nie in eine schwächere Stufe.
- Sicht X bekommt nichts aus Y (`ki-medien`).
- Keine Personennamen im Katalog (Plattform-Regel).

---

## 6 · Risiken

1. **Markt-Wechsel:** Sora-API, Imagen und Nano Banana 1 sind binnen Wochen verschwunden, viele Spitzenmodelle sind „Preview“. **Gegenmittel:** Katalog als Daten, `abgeschaltetAm`, HOI-Befund, zweite Wahl, nie Vorschau-Modelle für Pflichtwege.
2. **Google-Auflagen für Grounding/Deep Research:** Wer Ergebnisse speichert, an Agenten weitergibt oder weiterverkauft, verstößt nach dem Wortlaut gegen die Bedingungen. **Gegenmittel:** eigener Fluss „Tiefenbericht“, nur Anzeige; anwaltlich prüfen.
3. **Drittland:**
   - Anthropic und OpenAI stehen nicht im DPF (nur SCC).
   - Das DPF selbst wackelt (C-703/25 P, PCLOB).
   - Medienmodelle von Google laufen `global` bzw. `us-central1`.

   **Gegenmittel:** Stufen-Regel R3, EU-Wege für Art. 9, Exit-Plan „Mistral EU“.
4. **KI-VO ohne Übergangsfrist für Neues:** Bild, Video und Stimme müssen ab dem ersten Tag maschinenlesbar gekennzeichnet sein. Als Anbieter eines verkauften Produkts tragen wir die Pflicht nach Abs. 2 (Rolle anwaltlich klären).
5. **Personen und Stimmen:**
   - Fotos realer Menschen als Referenz, Gesichter in Videos, Stimmklone → Persönlichkeitsrecht, Art. 9 (biometrisch).
   - In der EU erlauben Google-Video und -Bild nur Erwachsene.

   **Gegenmittel:** Kategorie `personenbild`/`stimme` mit Einwilligung, keine Stimmklone.
6. **Kosten:** Video kostet 0,10–0,60 $ je Sekunde. Agenten verbrauchen das 4–15-Fache eines Chats. **Gegenmittel:** Schätzung, Klick vor Video, Budget je Auftrag.
7. **Training-Voreinstellungen:**
   - Mistral trainiert ohne Opt-out.
   - BFL-Standard-AGB erlauben Training.
   - Luma und Runway tun es ohne Enterprise-Vertrag.

   **Gegenmittel:** Einrichtungs-Checkliste je Anbieter, Selbstprüfung unter System › Datenschutz.
8. **Server-Last** (1 vCPU / 2 GB): Video-Downloads und Verschlüsselung brauchen Arbeitsspeicher, Abfragen laufen im Takt. **Gegenmittel:** streamen, Grenze 60 MB, höchstens 1 Medien-Auftrag gleichzeitig.
9. **Pseudonymisierung greift nicht bei Bild und Audio:** Ein Gesicht oder eine Stimme lässt sich nicht ersetzen → nur mit Einwilligung (siehe 5).
10. **Deutsch-Qualität unbelegt:** Für Transkription, Vorlesen und Text fehlen unabhängige Deutsch-Werte → eigener Testsatz vor der Wahl.
11. **Abhängigkeit von Google:** Bild, Video, Deep Research und der EU-Weg für Claude hängen an Google. **Gegenmittel:** Zweitwahl je Fähigkeit bei einem anderen Anbieter (OpenAI, Mistral).
12. **Lieferkette:** Proxys bündeln alle Schlüssel (LiteLLM-Vorfall 03/2026) → keine fremden Proxys, keine schweren SDKs, Abhängigkeiten fest gepinnt.

---

## 7 · Entscheidungsfragen an Kevin (je mit Empfehlung ★)

**1. Über welchen Weg läuft Claude?**
- (a) wie heute direkt bei Anthropic (USA/global, SCC)
- (b) alles über Google Vertex `eu` (+10 %)
- (c) ★ Vertex `eu` nur für Gesundheit, Privat-Finanzen und Familie; der Rest bleibt direkt
- (d) AWS Bedrock Frankfurt

★ (c), später (b), sobald Web-Suche, Caching und Schema auf Vertex geprüft sind.

**2. Welcher Google-Zugang?**
- (a) Gemini-API-Schlüssel (einfach; Logs 55 Tage weltweit)
- (b) ★ Vertex/Agent Platform mit Dienstkonto (ZDR, Freistellung für GA-Modelle, C2PA, EU wo vorhanden, Claude-EU im selben Vertrag)
- (c) erst (a), vor dem ersten Kunden (b)

**3. Bilder — erste Wahl?**
- (a) ★ Nano Banana 2.1, für Text-Assets Pro
- (b) OpenAI GPT Image 2/2.5 (Qualitätsspitze, 6× teurer, EU nur mit Freigabe)
- (c) FLUX von BFL (EU-Endpunkt, aber Training laut AGB)
- (d) je Auftrag zwei Anbieter zum Vergleich

**4. Research?**
- (a) ★ Claude-Websuche + Web-Fetch als Standard für alle Mitarbeiter
- (b) ★ zusätzlich Gemini Deep Research als „Tiefenbericht zum Lesen“ (nicht ins Brain, nicht an andere Agenten)
- (c) OpenAI Web-Suche/Deep Research als zweite Wahl
- (d) Perplexity Sonar
- (e) Gemini auch als Standard trotz Auflagen

★ (a) + (b).

**5. Video?**
- (a) Gemini Omni Flash
- (b) Veo 3.1 Fast
- (c) ★ beide: Omni Standard, Veo für längere Clips
- (d) noch nicht bauen, erst Bilder und Sprache

★ (c), Bau nach Bildern und Transkription.

**6. Transkription?**
- (a) ★ Mistral Voxtral (EU)
- (b) Gladia (FR)
- (c) Speechmatics EU-Region
- (d) Gemini Transcribe über Vertex
- (e) lokal (braucht eine GPU, nicht auf unserem Server)

★ (a), mit einem deutschen Test gegen (c) vor dem Einschalten.

**7. Vorlesen?**
- (a) ★ die Gerätestimme bleibt Standard
- (b) ElevenLabs v4 als Schalter je Person
- (c) Gemini TTS
- (d) Voxtral TTS (EU, schwächer)

★ (a) + (b).

**8. Diktat im Browser?** (Chrome schickt das Audio vermutlich an Google — prüfen)
- (a) so lassen
- (b) auf Voxtral Realtime über unseren Server umstellen
- (c) ★ beides wählbar, Vorgabe (b) für Kunden-Instanzen

**9. Sprachassistent zu Hause?**
- (a) ★ jetzt nur Konzept, Bau nach Q1 2027
- (b) Prototyp als Kette Voxtral → ZOE → Stimme noch dieses Jahr
- (c) OpenAI GPT-Live-1 (Sprache-zu-Sprache, EU nach Freigabe)
- (d) Gemini Live (günstig, EU nicht belegt)

**10. Gateway oder eigene Adapter?**
- (a) ★ eigene schlanke Adapter, kein Gateway
- (b) Vercel AI SDK als Bibliothek
- (c) OpenRouter
- (d) Langdock (DE)
- (e) LiteLLM selbst gehostet

**11. Verträge und Schlüssel bei Kunden?**
- (a) ★ jeder Kunde schließt eigene Anbieter-Verträge, der Schlüssel liegt in seiner Instanz
- (b) MAKE kauft zentral und rechnet weiter (Anthropic-Zustimmung nötig, Mistral verbietet es)
- (c) Text über MAKE, Medien über den Kunden

**12. Budget?**
- (a) nur Monatsgrenze mit Warnung bei 80 %
- (b) Grenze je Head und je Auftrag
- (c) Medien nur nach Kostenschätzung + Klick
- (d) erst einen Monat messen

★ (b) + (c), Höhe nach dem Messmonat (d).

**13. Freigabe beim Erzeugen?**
- (a) ★ Bilder frei bis Budget, Video und Tiefenbericht nur mit Klick
- (b) alle Medien nur mit Klick
- (c) alles frei bis Budget

**14. Sichtbare Kennzeichnung veröffentlichter Medien?**
- (a) nur maschinenlesbar (SynthID/C2PA behalten)
- (b) immer zusätzlich „KI-generiert“ sichtbar
- (c) ★ (a) + sichtbar bei realistischen Personen und Orten
- (d) Anwalt entscheidet vorher

★ (c), Anwalt gegenlesen.

**15. Gesundheitsdaten (Art. 9) — an welche KI?**
- (a) ★ nur EU-Verarbeitung mit ZDR (Claude über Vertex `eu` oder Mistral EU)
- (b) wie heute Anthropic USA mit Einwilligung (b)
- (c) gar nicht an KI, nur Regeln
- (d) Person wählt selbst zwischen (a) und (b)

---

## 8 · Offene Punkte, die nicht belegt sind
- Ob Claude auf Vertex `eu` dieselben Werkzeuge hat (Web-Suche, Web-Fetch, Prompt-Caching, `output_config`).
- Ob die Web-Speech-API in Chrome bzw. Safari Audio an Server schickt, und wohin (für `useStimme`).
- Die Freistellung durch Google für Gemini-Bildmodelle (nur Archivfassung als Suchausschnitt).
- Deutsch-Qualität aller Sprach- und Textmodelle (eigener Test nötig).
- Ein DPA für Black Forest Labs, Ideogram und Recraft.
- Ob MAKE beim Einbau fremder Modelle „Anbieter“ oder „Betreiber“ im Sinne von Art. 50 ist (Anwalt).
- Ein Webhook für Gemini Deep Research (nur Polling belegt).
- Die Löschfrist für erzeugte Medien und Entwürfe (Vorschlag 12 Monate unbenutzt).

---

## 9 · Quellen (alle abgerufen am 08.10.2026)

**Text/Denken:**
- **Anthropic:**
  - A1 https://platform.claude.com/docs/en/about-claude/pricing [O]
  - A2 https://platform.claude.com/docs/en/about-claude/models/overview [O]
  - A3 https://platform.claude.com/docs/en/manage-claude/data-residency [O]
  - A4 https://platform.claude.com/docs/en/manage-claude/api-and-data-retention [O]
  - A5 https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data [O]
  - A6 https://www.anthropic.com/legal/commercial-terms [O]
  - A7 https://www.anthropic.com/legal/data-processing-addendum [O]
  - A8 https://www.anthropic.com/legal/privacy [O]
  - A9 https://platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai [O]
  - A10 https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock [O]
  - A11 https://platform.claude.com/docs/en/build-with-claude/embeddings [O]
- **OpenAI:**
  - O1 https://developers.openai.com/api/docs/pricing [O]
  - O2 https://developers.openai.com/api/docs/models [O]
  - O3 https://developers.openai.com/api/docs/guides/your-data [O]
  - OSA https://cdn.openai.com/osa/openai-services-agreement.pdf [S]
- **Google:**
  - G1 https://ai.google.dev/gemini-api/docs/pricing [O]
  - G2 https://ai.google.dev/gemini-api/docs/models [O]
  - G3 https://ai.google.dev/gemini-api/terms [O]
  - G4 https://ai.google.dev/gemini-api/docs/usage-policies [O]
  - G5 https://docs.cloud.google.com/vertex-ai/generative-ai/docs/data-governance [O]
  - G6 https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/data-residency [O]
  - G7 https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing [O]
- **Mistral:**
  - M1 https://docs.mistral.ai/models [O]
  - M2 https://docs.mistral.ai/inference/pricing [O]
  - M3 https://docs.mistral.ai/inference/regional-inference [O]
  - M4 https://docs.mistral.ai/models/mistral-large-4-0 [O]
  - M5 https://legal.mistral.ai/terms/data-processing-addendum [O]
  - M6 https://legal.mistral.ai/terms/privacy-policy [O]
  - M7 https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr [S]
  - M8 https://help.mistral.ai/en/articles/455207-can-i-opt-out-of-my-input-or-output-data-being-used-for-training [O]
  - M9 https://help.mistral.ai/en/articles/347629-where-do-you-store-my-data-or-my-organization-s-data [O]
  - M10 https://legal.mistral.ai/terms/commercial-terms-of-service [O]
- **Bewertung:**
  - B1 https://artificialanalysis.ai/leaderboards/models [S]
  - MÖVE https://arxiv.org/pdf/2606.13111 [S]

**Recherche:**
- **Google:**
  - R1 https://ai.google.dev/gemini-api/docs/pricing [O]
  - R2 https://ai.google.dev/gemini-api/docs/google-search [O]
  - R3 https://ai.google.dev/gemini-api/terms [O]
  - R4 https://ai.google.dev/gemini-api/docs/url-context [O]
  - R5 https://ai.google.dev/gemini-api/docs/deep-research [O]
  - R6 https://blog.google/innovation-and-ai/models-and-research/gemini-models/next-generation-gemini-deep-research/ [O]
  - R7 https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention [O]
  - R8 https://docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/web-grounding-enterprise [O]
  - R9 https://cloud.google.com/vertex-ai/generative-ai/pricing [S]
- **Perplexity:**
  - R11 https://docs.perplexity.ai/getting-started/pricing [O]
  - R12 https://docs.perplexity.ai/guides/privacy-security [O]
  - R13 https://community.perplexity.ai/t/sonar-deep-research-async-mode-and-reasoning-effort-now-live/4736 [S]
  - R15 https://conductatlas.com/platform/perplexity-ai/perplexity-api-terms-of-service/provision/CA-P-061626/customer-owns-all-generated-output/ [S]
- **OpenAI:**
  - R16 https://developers.openai.com/api/docs/deprecations [O]
  - R17 https://developers.openai.com/api/docs/guides/deep-research [O]
  - R18 https://developers.openai.com/api/docs/models/GPT-5.6 [O]
  - R20 https://developers.openai.com/api/docs/guides/tools-web-search [O]
- **Anthropic:**
  - R22 https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool [O]
  - R23 https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool [O]
  - R24 https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools [O]
- **Reine Such-APIs:**
  - R26 https://exa.ai/pricing [O]
  - R27 https://www.tavily.com/pricing [O]
  - R30 https://brave.com/search/api/ [O]
- **Vergleiche:**
  - R31 https://arena.ai/leaderboard/search [O]
  - R32 https://the-decoder.com/google-launches-deep-research-and-deep-research-max-agents-to-automate-complex-research/ [S]
  - R33 https://analyticsindiamag.com/ai-news-updates/googles-new-deep-research-agent-scores-sota-results-on-benchmarks [S]

**Bilder:**
- **Google:**
  - I1 https://ai.google.dev/gemini-api/docs/image-generation [O]
  - I2 https://ai.google.dev/gemini-api/docs/changelog [O]
  - I3 https://ai.google.dev/gemini-api/docs/pricing [O]
  - I4 https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image [O]
  - I5 https://cloud.google.com/archive/terms/generative-ai-indemnified-services-20260422 [S]
- **OpenAI:**
  - I6 https://developers.openai.com/api/docs/guides/image-generation [O]
  - I7 https://datanorth.ai/news/openai-launches-chatgpt-images-2-5 [S]
  - I8 https://help.openai.com/en/articles/8912793-c2pa-in-chatgpt-images [S]
  - I9 https://www.proskauer.com/blog/openais-copyright-shield-broadens-user-ip-indemnities-for-ai-created-content [S]
- **Black Forest Labs:**
  - I10 https://docs.bfl.ai/flux_3/flux3_overview [O]
  - I11 https://docs.bfl.ai/quick_start/pricing [O]
  - I12 https://help.bfl.ai/articles/9532536301-which-api-endpoint-should-i-use [O]
  - I13 https://bfl.ai/legal/eu-developer-terms-of-service [O]
  - I14 https://bfl.ai/legal/flux-api-service-terms [O]
- **Ideogram:**
  - I15 https://developer.ideogram.ai/api-reference/images/generate/ideogram-4-5.md [O]
  - I16 https://ideogram.ai/legal/api-tos [O]
- **Weitere:**
  - I17 https://www.recraft.ai/docs/api-reference/pricing [O]
  - I18 https://artificial-intelligence-wiki.com/ai-tools/midjourney/midjourney-api-access-guide/ [S]
- **Ranglisten:**
  - I19 https://arena.ai/leaderboard/text-to-image und https://arena.ai/leaderboard/image-edit [O]
  - I20 https://artificialanalysis.ai/text-to-image/arena/leaderboard-text [O]

**Video:**
- **Google:**
  - V1 https://ai.google.dev/gemini-api/docs/veo [O]
  - V2 https://ai.google.dev/gemini-api/docs/omni [O]
  - V3 https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-1-generate [O]
  - V4 https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/content-credentials [O]
  - V5 https://decrypt.co/368393/google-unveils-gemini-omni-next-gen-ai-video-builder-simulate-world [S]
- **OpenAI:** V6 https://developers.openai.com/api/docs/deprecations [O]
- **Runway:**
  - V7 https://docs.dev.runwayml.com/guides/pricing/ [O]
  - V8 https://runway.com/enterprise-terms [S]
- **Kling:** V9 https://kling.ai/docs/privacy-policy [O]
- **Luma:** V10 https://docs.agents.lumalabs.ai/guides/pricing/ [O]
- **Weitere:**
  - V11 https://www.runpod.io/blog/minimax-h3-the-open-weight-omni-modal-video-model-and-what-it-takes-to-run-it [S]
  - V14 https://wavespeed.ai/blog/cost-and-billing/google-veo-3-pricing/ [S]
- **Ranglisten:**
  - V12 https://artificialanalysis.ai/video/leaderboard/text-to-video und https://artificialanalysis.ai/video/leaderboard/image-to-video [O]
  - V13 https://arena.ai/leaderboard/text-to-video [O]

**Sprache:**
- **Mistral:**
  - S1 https://mistral.ai/news/voxtral-transcribe-2 [O]
  - S2 https://docs.mistral.ai/en/studio-api/audio/overview [O]
  - S3 https://help.mistral.ai/en/articles/156206-when-using-mistral-ai-s-api-where-is-my-data-stored [S]
- **Gladia:**
  - S4 https://www.gladia.io/pricing [O]
  - S5 https://docs.gladia.io/chapters/limits-and-specifications/data-retention [O]
- **Speechmatics:** S6 https://www.speechmatics.com/pricing [O]
- **OpenAI:**
  - S7 https://developers.openai.com/api/docs/pricing [O]
  - S8 https://developers.openai.com/api/docs/guides/your-data [O]
  - S17 https://developers.openai.com/api/docs/guides/text-to-speech [O]
  - S18 https://developers.openai.com/api/docs/models/gpt-live-1 [O]
- **Google:**
  - S9 https://ai.google.dev/gemini-api/docs/pricing [O]
  - S10 https://cloud.google.com/speech-to-text/pricing [S]
  - S11 https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3 [S]
  - S16 https://ai.google.dev/gemini-api/docs/speech-generation [O]
  - S19 https://ai.google.dev/gemini-api/docs/live [O]
  - S20 https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-live-api [S]
- **ElevenLabs:**
  - S12 https://elevenlabs.io/pricing/api [O]
  - S13 https://elevenlabs.io/blog/eleven-v4 [O]
  - S14 https://elevenlabs.io/docs/overview/administration/data-residency [O]
- **Azure:** S21 https://prices.azure.com/api/retail/prices [O]
- **Ranglisten:**
  - S15 https://artificialanalysis.ai/text-to-speech/leaderboard [O]
  - S22 https://artificialanalysis.ai/speech-to-text/non-streaming [O]
  - S23 https://artificialanalysis.ai/speech-to-speech [O]
- **Lokal betreiben:** S24 https://wz-it.com/en/blog/local-speech-to-text-gdpr/ [S]
- **Anthropic:** S25 https://platform.claude.com/docs/en/build-with-claude/overview [O]

**Embeddings:**
- E1 https://www.mongodb.com/docs/voyageai/management/billing/ [O]
- E2 https://thenewstack.io/cohere-embed-pro-fast/ [S]
- E3 https://huggingface.co/intfloat/multilingual-e5-large [O]

**Gateways und Recht:**
- **OpenRouter:**
  - W1 https://openrouter.ai/docs/faq [O]
  - W3 https://openrouter.ai/docs/guides/features/zdr [S]
  - W4 https://openrouter.ai/docs/guides/features/in-region-routing [O]
  - W5 https://openrouter.ai/data-processing-agreement [O]
  - W7 https://www.orrick.com/en/News/2026/08/OpenRouter-to-be-Acquired-by-Stripe-to-Help-Businesses-Optimize-Token-Routing-and-Usage [S]
- **Vercel:**
  - W8 https://vercel.com/docs/ai-gateway/pricing [O]
  - W9 https://vercel.com/docs/ai-gateway/security-and-compliance/zdr [O]
  - W10 https://vercel.com/docs/ai-gateway/security-and-compliance/regional-inference [O]
  - W12 https://github.com/vercel/ai [O]
  - W14 https://vercel.com/changelog/ai-sdk-7 [O]
- **LiteLLM:**
  - W15 https://raw.githubusercontent.com/BerriAI/litellm/main/LICENSE [O]
  - W17 https://docs.litellm.ai/docs/proxy/prod [O]
  - W18 https://bastion.tech/blog/litellm-pypi-supply-chain-attack [S]
- **Langdock:**
  - W19 https://docs.langdock.com/api-endpoints/api-introduction [O]
  - W20 https://langdock.com/pricing [O/S]
  - W22 https://langdock.com/models [O]
  - W23 https://langdock.com/dpa [S]
- **Cloudflare:** W25 https://developers.cloudflare.com/ai-gateway/reference/pricing/ [O]
- **Vertex und Microsoft:**
  - W29 https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude/sonnet-5 [O]
  - W31 https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/claude-models/data-privacy [O]
- **DPF-Liste:** W30 https://www.dataprivacyframework.gov/list (Lese-Endpunkt `dpfapi.azurewebsites.net/api/participants`) [O]
- **KI-VO:**
  - W33 https://digital-strategy.ec.europa.eu/en/news/commission-publishes-code-practice-marking-and-labelling-ai-generated-content [O]
  - W34 https://eur-lex.europa.eu/eli/reg/2026/1744/oj [O]
  - W35 https://www.klgates.com/EU-Digital-Omnibus-on-AI-Enters-Into-Force-7-31-2026 [S]
  - W36 https://getactready.com/blog/eu-ai-act-code-of-practice-marking-ai-content [S]
  - W38 https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations [S]
- **DPF-Rechtslage:**
  - W40 https://eur-lex.europa.eu/eli/C/2025/6610/oj/eng [O]
  - W41 https://secureprivacy.ai/blog/is-the-eu-us-data-privacy-framework-at-risk-the-ftc-ruling-explained-2026 [S]
  - W43 https://www.morganlewis.com/pubs/2026/06/us-supreme-court-reshapes-independent-agency-removals-carves-out-fed [S]
  - W45 https://streamlex.eu/resources/dpf-developments-tracker/ [S]
