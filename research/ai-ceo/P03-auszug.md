# P03 · Auszug — Wettbewerb II: Agenten-Plattformen, „KI-Mitarbeiter“, AI-CEO-Systeme

**Bericht:** `P03-wettbewerb-agenten.md` („Marktanalyse KI-Agenten Und AI CEO“, Gemini Deep Research) · **Drive:** https://docs.google.com/document/d/1FGBTus0CRd0DwTRp5iEOnA_b1-ktolnaDp2mHY9iwIQ
**Ausgewertet:** 05.10.2026 · vollständig gelesen (75.711 Zeichen, 86 Quellen) · **Status: ungeprüfte KI-Recherche, Stichprobe unten**

> **Wichtigster Vorbehalt vorab:** Quelle [10] ist **unsere eigene Datei `AI_CEO_MODUL.md`** (in der Quellentabelle sogar als „Fakt (System-Spezifikation)“ geführt). Das ganze Kapitel **„Muster der Besten für Kontrolle und Vertrauen“** (vier Autonomiestufen, Freigabe-Stapel morgens/abends, Prüfer gegen erfundene IDs, Hash-Ketten, Budget mit Regelwerk-Rückfall, pass^k-Evals, Lernen aus Ablehnungen) ist fast vollständig mit [10] belegt. Das sind **unsere eigenen Bausteine, als Branchen-Bestpraxis zurückgespielt** — kein Beleg, dass „führende Systeme“ das so machen. Ebenso die Aussagen „kein Anbieter verbindet Unternehmen und Privatleben“ und alle Burggraben-Argumente.
> Zweiter Vorbehalt: Viele Anbieterangaben kommen aus Review-/Verzeichnisblogs (Aheri, agentsai.fyi, eesel, Crevio, Dooza — letzterer ist selbst Sintra-Wettbewerber). Für Voyd gibt es nur die Herstellerdoku. „Unabhängige Tests vor Herstellerangaben“ (Prompt) ist kaum eingelöst.

---

## 1 · Kernaussagen

| # | Aussage | Beleg im Bericht | Einordnung (Bericht → unsere Bewertung) |
|---|---|---|---|
| 1 | Der Markt teilt sich in Baukästen (n8n, Make, Zapier, Relevance AI, CrewAI) und teure vertikale „KI-Mitarbeiter“ (Artisan, 11x). Ein fertiges Führungssystem für einen Menschen gibt es kommerziell nicht. | [1][4][6] | Fakt → **Einteilung plausibel**; „gibt es nicht“ stimmt so nicht (siehe 2) |
| 2 | **„AI CEO“ ist als Begriff besetzt:** Tycoon.us (Gründerin Xiaoyin Qu) verkauft „Astra“ als AI CEO, die Spezial-Agenten (CTO, CMO, Finanzen, Recht, Recherche) für Ein-Personen-Firmen steuert; ab 50 $/Monat Wallet, US-Cloud, Freigaben per Chat. Voyd.sh: „Runtime für Unternehmen“ mit Rollen CEO/CTO/CMO/CFO, Autonomie-Regler, „Overnight Loops“, 40 $/Monat. | Product Hunt [9], Voyd-Doku [8] | Fakt (Herstellerangaben) → **Fakt** (Tycoon/Astra per Stichprobe bestätigt; Inc. und Product Hunt berichten) |
| 3 | Kein Anbieter führt Unternehmen **und** Privatleben mit serverseitiger Trennung. | **[10] = unsere Datei** | Fakt → **plausibel, Zirkelbeleg** |
| 4 | Horizontale „KI-Team“-Pakete (Sintra AI: 12 Rollen, 39–97 $/Monat, 250 Credits) enttäuschen: flache Prompt-Hüllen, kein geteilter Kontext, Credits nach 2–3 Tagen leer. | Crevio [11], eesel [12] | Fakt/Meinung → **Kritik plausibel**, aber Sintra hat laut Stichprobe > 40.000 zahlende Kunden und 12 Mio. $ ARR (2025) — Nachfrage nach billigem „KI-Team“ ist real |
| 5 | Unternehmen haften für Aussagen ihrer Bots: *Moffatt v. Air Canada* (2024 BCCRT 149), NYC-MyCity-Bot riet zu Rechtsverstößen, Chevrolet-Händler-Bot „verkaufte“ ein Auto für 1 $. | Wikipedia [15], Entrepreneur [16], The Markup [80] | Fakt → **Fakt** (bekannte, gut dokumentierte Fälle; nicht neu geprüft) |
| 6 | Gartner (Juni 2025): > 40 % der Agenten-Projekte werden bis Ende 2027 abgebrochen; nur ~130 Anbieter haben echte Agenten („Agent Washing“). Deloitte Tech Trends 2026: nur 11 % nutzen Agenten produktiv. | Gartner [19], digitalapplied [20] | Fakt/Prognose → **bestätigt** (Stichprobe). Kleine Unschärfe: Deloitte nennt 42 % „Strategie in Arbeit“ und 35 % „keine Strategie“ — der Bericht macht daraus „42 % ohne formale Strategie“ |
| 7 | Preismodelle: weg vom Sitz, hin zu Aktions-/Token-Guthaben (Relevance, Make, Zapier), Retainern (Artisan/11x 3.750–5.000 $/Monat, Jahresvertrag), Ergebnispreisen (Agentforce 2 $/Gespräch) und Wallets (Tycoon). | [2][5][24][29] | Fakt → **Richtung plausibel**; Agentforce-Preis wohl veraltet (Salesforce hat 2025 auf Flex Credits umgestellt — aus Wissen, nicht nachgeschlagen) |
| 8 | MCP (Anthropic, Nov. 2024) ist Standard für Werkzeuganbindung, von OpenAI, Microsoft, Google übernommen; A2A (Google) regelt Agent-zu-Agent. | [26][27][28] | Fakt → **Fakt** (allgemein bekannt) |
| 9 | Solo-Unternehmer scheitern an „Werkzeugkasten statt Lösung“: Einrichtung + Wartung > Zeitersparnis; Agenten sind entweder träge (warten auf Prompts) oder überdrehen ohne Leitplanken. | [2][21] | Meinung → **Meinung**, gut begründet |
| 10 | Dokumentierte Fehlerbilder: „Hallucination Amplification“ (erfundene Fakten landen im gemeinsamen Speicher, Experiment Ratliff/ikangai), Kostenexplosion durch Endlosschleifen, „Domain Burning“ durch autonome Kaltakquise (11x), Prompt Injection. | ikangai-Blog [21], Aheri [5] | Fakt → **Einzelfälle/Blog**; als Risikokatalog brauchbar, Ratliff-Experiment ungeprüft |
| 11 | Investoren (Sequoia, a16z, YC): Der Wert liegt in Zustand/Daten/Orchestrierung, nicht im Modell; reine API-Hüllen werden von Modellanbietern verdrängt. | Evalyze-Blog [86] | Meinung → **Meinung**, Quelle schwach (Pitchdeck-Sammlung, keine Primärquelle) |
| 12 | Empfehlung für MAKE OS: ZOE- und Head-Werkzeuge auf MCP umstellen; Cockpit je Abteilung auf Ampel + Leitkennzahl + Freigaben verdichten (wie Voyd); Evals vor jedem Prompt-/Modellwechsel; Kosten-Circuit-Breaker je Abteilung. | [10][8][26] | Meinung → **Meinung, teils unsere eigene Planung** |
| 13 | Reihenfolge neuer Heads: **Operations → Strategy → Product → People/Founder-Care**. | [10] | Meinung → **Meinung** (weicht von unserer F-Reihenfolge ab, siehe Abgleich) |

## 2 · Zahlen

| Größe | Wert laut Bericht | Quelle (Bericht) | Datum | Belastbarkeit | Prüfvermerk |
|---|---|---|---|---|---|
| Gartner Abbruchquote Agenten-Projekte | > 40 % bis Ende 2027 | Gartner [19] | 25.06.2025 | hoch | ✅ bestätigt (inkl. „nur ~130 echte Anbieter“) |
| Gartner Durchdringung | 33 % der Unternehmensanwendungen mit Agenten bis 2028; 15 % der Alltagsentscheidungen autonom | [19][83] | 2024/25 | mittel | Prognosen, nicht neu geprüft |
| Deloitte produktive Agenten | 11 % | digitalapplied [20] | Dez. 2025 | hoch | ✅ bestätigt (30 % erkunden, 38 % Pilot, 14 % bereit, 11 % produktiv) |
| Forrester | ~75 % experimentieren | [20] | „Juni 2026“ | gering | ⚠ prüfen: nur Sekundärblog |
| Tycoon.us | ab 50 $/Monat (Wallet) | [29] | Mai/Juni 2026 | mittel | ✅ Existenz, Zielgruppe und Konzept bestätigt; Preis nicht geprüft |
| Voyd.sh | 40 $/Monat Plus; 2.200 Firmenprojekte | Voyd-Doku [8] | 2026 | gering | ⚠ nur Herstellerangabe |
| Relevance AI | ab 234 $/Monat; 24 Mio. $ Series B (Mai 2025) | [23][59] | 2025/26 | mittel | nicht geprüft |
| n8n Cloud | ab 20 €/Monat; Self-Hosting gratis | [2] | 2026 | mittel | nicht geprüft |
| Artisan | 3.750 $/Monat, Jahresverträge ab 45.000 $; 25 Mio. $ Series A (April 2025) | [24][4] | 2025 | mittel | nicht geprüft |
| 11x | 3.750–5.000 $/Monat (Voice 8.500 $); ~76 Mio. $ Kapital | [5][25] | 2025/26 | mittel | nicht geprüft |
| Sintra AI | 39–97 $/Monat, 250 Credits; Seed 17 Mio. $ (Earlybird, Juni 2025); Trustpilot-Score ausgesetzt | [11][12] | 2025/26 | mittel | ✅ Seed 17 Mio. $ / Earlybird / Juni 2025 bestätigt; **ergänzend**: > 40.000 zahlende Kunden, 12 Mio. $ ARR nach 12 Monaten. Trustpilot-Aussetzung **nicht geprüft** |
| Cognition (Devin) | > 1 Mrd. $ bei 26 Mrd. $ Bewertung (Mai 2026); ab 20 $/Monat | [35][36] | 05/2026 | hoch | ✅ bestätigt (27.05.2026, Series D) |
| Manus | „nach gescheitertem Übernahmeversuch durch Meta Anfang 2026 eigenständig aus Singapur“; 20–200 $/Monat | [37][38] | 2026 | mittel | ⚠ **ungenau**: Meta hatte Manus (~2 Mrd. $) übernommen; China hat die Übernahme am **27.04.2026 untersagt** und die Rückabwicklung verlangt |
| Genspark | Series B 485 Mio. $ bei 2,6 Mrd. $ (Juni 2026); 24,99 / 249,99 $ | GetLatka [40] | 2026 | gering | ⚠ prüfen: GetLatka-Schätzungen sind oft unzuverlässig; Quellentabelle sagt „485 Mio. kumuliert“ — widersprüchlich |
| Salesforce Agentforce | 2 $ je Konversation | [42] | — | gering | ⚠ vermutlich veraltet (Preismodell 2025 umgestellt) |
| Microsoft Copilot Studio | ab ~200 $/Monat je Tenant | [44] | — | mittel | nicht geprüft |
| Beam AI | ab 499 €/Monat | Beam [54] | — | gering | ⚠ Herstellerseite, nicht geprüft |
| CrewAI | 18 Mio. $ Series A (Okt. 2024) | SiliconANGLE [63] | 10/2024 | hoch | nicht neu geprüft (Primärmeldung) |
| Anthropic Agent SDK | „senkt Kosten/Latenz um bis zu 50 %“ | Relevance-Blog [23] | — | **gering** | ⚠ unbelegt, Quelle passt nicht |
| Limitless | 2025 von Meta übernommen, Pendant eingestellt | [76] | Dez. 2025 | mittel | nicht neu geprüft |

**Stichprobe (Web, 05.10.2026):** 6 Angaben geprüft — **5 bestätigt** (Gartner 40 %/130 Anbieter, Deloitte 11 %, Sintra-Seed, Cognition 26 Mrd. $, Tycoon/Astra als AI-CEO-Produkt), **1 ungenau** (Manus/Meta: Übernahme erfolgte, wurde von China untersagt).
Belege: [Gartner-Prognose (RCR Wireless)](https://www.rcrwireless.com/20250627/business/agentic-ai-gartner) · [Gartner „130 vendors“](https://www.cdomagazine.tech/aiml/over-40-of-agentic-ai-projects-likely-to-be-abandoned-by-2027-gartner-forecast) · [Deloitte Agentic AI Strategy](https://www.deloitte.com/us/en/insights/topics/technology-management/tech-trends/2026/agentic-ai-strategy.html) · [Sintra Seed (Vestbee)](https://www.vestbee.com/insights/articles/sintra-ai-raises-17-m) · [Cognition 26 Mrd. $ (TNW)](https://thenextweb.com/news/cognition-just-raised-1-billion-at-a-26-billion-valuation-and-90-of-its-own-code-is-written-by-its-ai) · [Tycoon auf Product Hunt](https://www.producthunt.com/products/tycoon-us) · [Inc.: „This Startup Just Promoted an AI to CEO“](https://www.inc.com/peter-cohan/this-startup-just-promoted-an-ai-to-ceo/91176312) · [China untersagt Meta–Manus (TechCrunch)](https://techcrunch.com/2026/04/27/china-vetoes-metas-2b-manus-deal-after-months-long-probe/)

## 3 · Was das für MAKE OS heißt

**Positionierung — die wichtigste Erkenntnis dieses Berichts**
- **„AI CEO“ ist nicht mehr frei.** Bei Tycoon ist die **KI** der CEO (Astra führt, der Mensch gibt Ziele). Bei uns ist der **Mensch** der AI CEO, der ein KI-Team führt. Das ist ein klarer, verkaufbarer Gegensatz („Sie bleiben CEO“), aber eine echte Verwechslungsgefahr für den Modulnamen (I1 Nr. 3). Empfehlung: Namensfrage bewusst entscheiden; Botschaft „Der Mensch führt, die KI arbeitet zu“.
- „Fertiges KI-Führungsteam“ allein ist **kein Alleinstellungsmerkmal** mehr (Tycoon, Voyd, Sintra werben damit). Tragfähig ist die **Kombination**: Führungsteam **mit** Freigabe-Pflicht + Privat/Business serverseitig getrennt + eigene Instanz in der EU + Fokus & Zeit als Kern.

**Funktionen / Technik (konkret)**
1. **Gedächtnis-Schutz gegen „Hallucination Amplification“:** Agenten dürfen nur in Entwurfs-/Vorschlagsräume schreiben, nie direkt in Faktenbestände. Prüfen, ob ZOE „sofort merken“ (B6.1) das schon erzwingt; sonst Merk-Einträge als „unbestätigt“ markieren, bis der Mensch sie bestätigt.
2. **Eingangs-Schutz gegen Prompt Injection:** Heads lesen fremde Mails/Webseiten. Unser Prüfer (B6.3) prüft die **Ausgabe**; ein Eingangsfilter (fremde Inhalte als Daten markieren, Anweisungen darin ignorieren) fehlt in Teil D/I.
3. **Circuit Breaker je Lauf:** harte Schritt- und Token-Grenzen pro Lauf zusätzlich zum Monatsbudget (D11).
4. **MCP als Schnittstelle prüfen:** ZOE-/Head-Werkzeuge als MCP-Server kapseln senkt die Abhängigkeit von einem Modellanbieter (I2) und macht MAKE OS für fremde Agenten anschließbar. Achtung: jede neue Schnittstelle braucht Routen-Register und Zugangsklasse.
5. **Autonomie-Regler sichtbar machen** (Voyd „own the dial“): unsere vier Stufen (`entwurf`/`freigabe`/`vorschlag`/`autonom`) als einfacher Regler je Head im Cockpit. Die vom Bericht vorgeschlagene Stufe „zeitverzögert ausführen, wenn kein Veto“ **nicht** für Außenwirkung übernehmen — widerspricht C4 Prinzip 1.
6. **Nacht-Läufe** (Voyd „Overnight Loops“) als Muster für Head of Strategy/Research: Recherche über Nacht, Ergebnis morgens im Stapel.

**Verkaufsargumente gegen Baukästen und „KI-Mitarbeiter“**
- „Ein eingespieltes Führungsteam statt Kiste voller Einzelteile“ (gegen n8n/Make/Zapier).
- „Sie haften für jede Nachricht Ihrer KI“ — Moffatt v. Air Canada als Aufhänger; deshalb verlässt bei uns nichts das Haus ohne Freigabe (gegen 11x/Artisan-Autonomie).
- „Kein Credit-Schock“: Budget je Abteilung mit Regelwerk-Rückfall (gegen Sintra, Manus, Zapier).
- „Sie bleiben CEO“ (gegen Tycoon).

**Risiken**
- **Fast Follower mit Kapital:** Tycoon (Ein-Personen-Firmen, AI CEO, Juni 2026) zielt auf dieselbe Gruppe — bisher US, ohne Privat, ohne EU-Instanz. Beobachten.
- **Niedriger Preisanker** für „KI-Team“: Sintra 39–97 $ mit > 40.000 zahlenden Kunden. Unsere Preisstufe muss den Unterschied (Tiefe, Daten, Kontrolle) zeigen.
- **Agent Washing**: Kunden sind misstrauisch; wir brauchen **nachprüfbare** Belege (Demo-Instanz, Protokoll „was die KI tat“, D12).

## 4 · Abgleich mit `AI_CEO_MODUL.md`

| Unsere Hypothese | Ergebnis | Begründung / Verweis |
|---|---|---|
| **C2 Zielgruppe** | **bestätigt — und umkämpft** | Tycoon und Voyd zielen auf Solo-Gründer/Indie-Hacker (US, tech-lastig). Unser Fokus DACH + Privatleben + Beratung/Holding grenzt ab. |
| **C3 Kategorie „Agenten-Plattformen“** (Werkzeugkasten, Mensch baut selbst) | **bestätigt** für n8n, Make, Zapier, Relevance, CrewAI | Lindy und Gumloop (in C3 genannt) wurden **nicht untersucht**. |
| **C3 Behauptung** (niemand vereint 1–4) | **in der Kombination bestätigt, Punkt (2) allein widerlegt** | Tycoon/Voyd liefern ein „fertiges Team“ (2), aber nicht (1) Privat, (3) EU-Instanz, (4) Fokus & Zeit. → C3-Tabelle um Zeile **„AI-CEO-/Company-OS-Startups (Tycoon, Voyd)“** ergänzen. |
| **C3 Kategorie „Founder-/CEO-Werkzeuge“** | **ergänzt** | Neue Unterkategorie: KI als CEO (Tycoon) vs. Mensch als CEO (wir). |
| **C4 Prinzip 1 „Mensch entscheidet“** | **stark bestätigt** | Haftungsfälle (Moffatt, MyCity, Chevrolet), Artisan führt nachträglich „Approval Gates“ ein. |
| **D3 Head-Rahmen** | **bestätigt (aber Zirkelbeleg)** | „Muster der Besten“ = unsere Bausteine. Unabhängig belegt sind nur: Freigabe-Gates (Artisan), Autonomie-Regler (Voyd), Pull-Request-Freigabe (Devin), Wallet-Budget (Tycoon). |
| **D3.2 neue Heads / F Phase 2 Reihenfolge** | **abweichende Empfehlung** | Bericht: Operations → **Strategy** → Product → People. Unser Plan: Operations → Product → People → Strategy. P01 empfiehlt Operations (+ Sales) zuerst. **Operations zuerst ist in beiden Berichten gleich.** Rest: Kevins Entscheidung (I1 Nr. 5). |
| **D11 KI-Budget** | **bestätigt + ergänzt** | Wallet-Modell (Tycoon) ist Marktpraxis; zusätzlich Lauf-Grenzen (Circuit Breaker). |
| **D12 Vertrauen & Nachweis** | **bestätigt** | Agent Washing + Haftung machen Nachweis zum Verkaufsargument. |
| **G1/G2 Editionen & Preise** | **ergänzt** | Preisbänder: Baukästen 9–234 $/Monat, Solo-KI-Team 39–97 $, AI-CEO-Startups 40–50 $ (+ Verbrauch), vertikale KI-SDR 3.750–5.000 $. Unser Korridor muss zwischen „Sintra billig“ und „KI-SDR teuer“ begründet werden. |
| **I1 Nr. 3 Name des Moduls** | **neuer Befund** | „AI CEO“ wird von Tycoon im Sinne „KI ist CEO“ verwendet → Verwechslungsrisiko. |
| **I2 Risiken** | **ergänzt** | Neu: Prompt Injection über Eingänge; Hallucination Amplification im Gedächtnis; Endlosschleifen-Kosten je Lauf; Namenskonflikt „AI CEO“; schnelle US-Nachahmer. Bestätigt: Agenten-Fehler mit Außenwirkung, Kosten, Anbieter-Abhängigkeit (→ MCP). |

## 5 · Offene Fragen / Lücken des Berichts

1. **Lindy und Gumloop** (im Prompt ausdrücklich verlangt, in C3 genannt) fehlen komplett; ebenso eine echte Analyse von **OpenAI ChatGPT Agent/Operator** und **Anthropic** (nur zwei Sätze), **Ema** und **Personal.ai/Granola** nur als Einzeiler.
2. **Weitere „AI CEO / AI COO / one-person company OS“-Anbieter** nur Tycoon und Voyd — die Suche wirkt nicht erschöpfend (Prompt verlangte aktive Suche).
3. **Nutzerurteile zu Tycoon/Voyd** fehlen weitgehend (nur „LLM reviews LLM“-Kritik aus Product-Hunt-Kommentaren). Wie gut funktionieren sie wirklich? → selbst testen (beide haben günstige Einstiege).
4. Viele Finanzierungs-/Preisangaben aus Blogs/Verzeichnissen (GetLatka, Tracxn, Aheri) — nur Stichproben geprüft.
5. Frage 5 (Produkt für Unternehmen **und** Privatleben) nur mit „gibt es nicht“ beantwortet, belegt mit unserer Datei.
6. Keine Aussage zu **Datenschutz/EU-Betrieb** der AI-CEO-Startups jenseits „US-Cloud“.
7. Investoren-Kapitel ohne Primärquellen (keine Sequoia-/a16z-Texte verlinkt).
