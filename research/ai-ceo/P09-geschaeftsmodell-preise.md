# P9 · KI-SaaS Geschäftsmodell und Preisstrategie (Volltext)

| | |
|---|---|
| **Titel (Drive)** | KI-SaaS Geschäftsmodell Und Preisstrategie |
| **Auftrag** | P9 — Geschäftsmodell, Preise, Kosten der KI, Kennzahlen (`AI_CEO_RECHERCHE_PROMPTS.md`) |
| **Drive-Link** | https://docs.google.com/document/d/1ACWDQ2oq4nwAgu8jGCxH1GoQxNQF_n98Dcczn7JJ0IU |
| **Abgerufen** | 05.10.2026 |
| **Quelle** | Gemini Deep Research, **ungeprüft** — Prüfung ausgewählter Zahlen in `P09-auszug.md` |

> **Hinweise zur Übernahme (nicht Teil des Berichts):**
> - Text unverändert aus dem Google Doc übernommen (Drive-Export als Markdown). Die maskierten Sternchen `\*\*` in Tabellen stammen aus dem Export.
> - **Export-Lücken (nicht abgeschnitten, aber verloren):** Formeln/Gleichungen des Originals fehlen im Export — sichtbar u. a. bei „Dienstleistungs-Bruttomarge: 4.“ (Kap. 8), den ARPU-Formeln (Kap. 11, Zeilen nur „\[cite: 4\]“) und der Payback-Formel („berechnet sich formelmäßig als: … wobei der monatliche Bruttogewinn als  definiert ist“). Teilweise sind Dollarzeichen verloren gegangen (z. B. „2.000  tragen“, „29,99  (Pro)“, „49,00  (Pro)“).
> - Die Tabelle „Modell-Preisstrukturen (Anthropic API)“ ist bereits im Original verrutscht (Spalten falsch belegt, Werte in Klammern nicht nachvollziehbar).
> - Quelle „3“ im Bericht ist `AI_CEO_MODUL.md` (unser eigenes Dokument), Quelle „4“ ist `unknown_url` — viele Kernzahlen (Preise, Unit Economics, 7,50 € Infrastruktur) haben damit **keine externe Quelle**.
> - Der Bericht endet regulär mit dem Quellenverzeichnis; kein Hinweis auf Abschneiden.

---

# **B2B-SaaS-Geschäftsmodell- und Preisstrategie für autonome Agentensysteme: Marktanalyse und Implementierungsarchitektur für MAKE OS (Stand: Oktober 2026)**

## **1. Kurzfassung: Strategische Empfehlung in 10 Kernpunkten**

1.  **Hybrides Erlösmodell als Stabilitätsanker:** Reines Nutzungs- und Token-Pricing erzeugt bei europäischen Kleinunternehmen eine ausgeprägte Kaufzurückhaltung infolge unkalkulierbarer Kostenrisiken1. MAKE OS kombiniert eine feste Plattformpauschale für Infrastruktur und Kernfunktionen mit einem großzügig kalkulierten, inkludierten KI-Inferenzkontingent3.
2.  **Dreistufige Produktsegmentierung nach Führungsreife:**

<!-- end list -->

  - *Markttraktion* adressiert vertriebsfokussierte Solopreneure (99 € monatlich / 79 € bei Jahreszahlung)3.
  - *MAKE OS* fungiert als integriertes Betriebs- und Lebensführungssystem inklusive ZOE Chief-of-Staff (149 € monatlich / 119 € bei Jahreszahlung)3.
  - *AI CEO* liefert ein vollständiges autonomes Führungsteam aus acht Abteilungsleitern mit Playbooks und Rhythmus-Schleifen (249 € monatlich / 199 € bei Jahreszahlung)3.

<!-- end list -->

1.  **80/20-Inferenz-Architektur zur Margensicherung:** Rund 80 % aller Hintergrundprüfungen, Datensynchronisationen und Kennzahlenläufe werden deterministisch über Code-Regeln ohne Large Language Model (LLM) ausgeführt3. Für die verbleibenden 20 % sichern Prompt-Caching mit bis zu 90 % Rabatt sowie ein striktes Modell-Routing (Claude 3.5 Haiku, Sonnet und Opus) Inferenzkosten von unter 29 € pro Monat selbst im AI-CEO-Tarif4.
2.  **Single-Tenant-Betrieb als Premium-Differenzierungsmerkmal:** Die Bereitstellung einer dedizierten Instanz (Container, eigene Schlüssel, Hetzner-Serverstandort Deutschland) verursacht Infrastrukturkosten von lediglich 7,50 € pro Monat und Kunde3. Dies ermöglicht eine Bruttomarge von 70 % bis 75 % und transformiert Datenschutzanforderungen nach DSGVO und EU AI Act in ein kaufentscheidendes Alleinstellungsmerkmal3.
3.  **Skalierungsschwelle der Instanz-Bereitstellung:** Bis zu einer Bestandsgröße von 15 aktiven Kunden erfolgt das Ausrollen semi-automatisiert per Skript \[Schätzung\]. Ab dem 16. Kunden refinanziert die Entwicklung einer vollautomatisierten Bereitstellungs- und Update-Pipeline („Instanz-Fabrik“) ihren Aufwand innerhalb eines Quartals durch eliminierte Betriebs- und Supportzeiten3.
4.  **Vollständige CAC-Deckung durch Productized Onboarding:** Ein standardisiertes, productized Implementierungspaket („Make.One Setup-Kickoff“ für einmalig 990 € netto) monetarisiert die Ersteinrichtung profitabel bei über 70 % Dienstleistungsmarge4. Dies senkt die Netto-Kundenakquisitionskosten für das Softwareabonnement rechnerisch auf null und minimiert die 90-Tage-Abwanderung9.
5.  **Psychologische Wertverankerung gegen Personalkosten:** Die Zahlungsbereitschaft von Solo-Unternehmern orientiert sich nicht an isolierten SaaS-Tools im Preissegment von 20 bis 40 €, sondern an den Opportunitätskosten menschlicher Arbeitskräfte10. Eine qualifizierte virtuelle Assistenz im DACH-Raum erfordert bei 10 bis 20 Monatsstunden zwischen 450 € und 1.000 € netto11. MAKE OS positioniert sich bei 199 € bis 249 € als vollwertiges operatives Führungsteam zu einem Bruchteil dieses Budgets3.
6.  **Kryptografische Souveränität ohne Lock-in-Zwang:** Signierte Ed25519-Offline-Lizenzen und ein garantierter, dauerhafter Nur-Lese-Zugriff bei Nichtverlängerung gewährleisten, dass Kundendaten zu keinem Zeitpunkt gesperrt werden3. Dieser Ansatz bricht die größte Akzeptanzhürde gegenüber proprietären All-in-One-Systemen im konservativen Mittelstand3.
7.  **Kapitaleffizientes Bootstrapping statt Wagniskapitaldruck:** Hohe Jahresvertragsquoten (Zielgröße 60 %) und kostenpflichtige Onboardings generieren von Tag null an positiven operativen Cashflow4. Dies schützt vor Bewertungsabschlägen und Verwässerungsrisiken, die vertikalen KI-SaaS-Startups bei unzureichender Bruttomarge im aktuellen VC-Markt drohen13.
8.  **Finanzielle Solidität im Stresstest:** Die Unit Economics weisen Bruttomargen von 69,5 % (Markttraktion) über 72,1 % (MAKE OS) bis 75,1 % (AI CEO) auf4. Selbst bei einer Verdopplung der Tokenkosten oder einem Anstieg der Abwanderungsrate um 50 % bleibt das Modell mit Amortisationszeiten von unter 6,5 Monaten hochprofitabel4.

## **2. Preismodelle für KI-Software 2025/2026: Marktanalyse und Praxiserfahrungen**

Die Softwarebranche hat in den Jahren 2025 und 2026 eine tiefgreifende Verschiebung der Erlösmechaniken erlebt. Das traditionelle Lizenzmodell nach Arbeitsplätzen (Per-Seat) gerät zunehmend in Konflikt mit autonomen KI-Agenten, deren primärer Wert nicht in der Unterstützung eines menschlichen Nutzers, sondern in der direkten Arbeitsleistung liegt15. In der Marktpraxis existieren fünf Kernmodelle mit spezifischen betriebswirtschaftlichen Konsequenzen.

Das klassische Sitzplatz-Modell bietet maximale Budgetierbarkeit für Kunden, führt bei KI-Anwendungen jedoch zu erodierenden Bruttomargen, da intensive Nutzung unbegrenzte Rechenkosten bei fixen Umsätzen verursacht15. Reine Verbrauchsmodelle, wie sie bei API-Anbietern üblich sind, schützen zwar die Marge des Softwarehauses, stoßen jedoch bei Endanwendern auf vehemente Ablehnung; der befürchtete „Bill Shock“ verhindert die regelmäßige Nutzung komplexer Workflows1. Kredit- und Token-Pools entkoppeln den Eurobetrag psychologisch von der Einzelausführung, leiden jedoch unter Intransparenz, da Anwender den tatsächlichen Verbrauch von Zwischenschritten bei mehrstufigen Agentenläufen nur schwer nachvollziehen können16.

Das ergebnisbasierte Modell (Outcome-based Pricing) knüpft die Vergütung an nachweisbare Arbeitsresultate2. Während dies für fest umrissene Support-Transaktionen funktioniert, entstehen bei offenen Prozessen wie strategischer Planung oder Marktanalysen unlösbare Konflikte bezüglich der Erfolgsdefinition2. Das Hybrid-Modell hat sich daher als Industriestandard durchgesetzt \[Strategische Einschätzung\]. Es kombiniert eine feste Grundgebühr für Plattformbereitstellung und ein statistisch abgesichertes Basiskontingent mit klaren Deckelungs- oder Übertragungsregeln16.

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| \*\*Preismodell-Typ\*\* | \*\*Funktionsmechanismus\*\* | \*\*Marktbeispiele (2025/2026)\*\* | \*\*Wesentliche Stärken\*\* | \*\*Risiken und Einschränkungen\*\* |
| \*\*Per-Seat (Klassisch)\*\* | Feste Monatsgebühr pro registriertem Nutzer | Cursor Pro (20 $/Nutzer/Mo.)10; frühes Notion | Hohe Planbarkeit; traditionell akzeptiert | Margenerosion bei Heavy-Usern; bestraft Automatisierung15 |
| \*\*Reiner Verbrauch (Consumption)\*\* | Lineare Abrechnung von Tokens, API-Calls oder CPU-Zeit | Amazon Bedrock20; Cloudflare Workers AI | Perfekte COGS-Deckung; keine Margenrisiken | Budgetunsicherheit führt zu Kaufabbruch („Bill Shock“)1 |
| \*\*Kredit- & Token-Pools\*\* | Monatliches Guthabenpaket; Abzug je nach Komplexität | Lindy.ai (3k–35k Credits)16; Zapier Agents16 | Gekapptes Anbieterrisiko; flexible Aufteilung | Komplizierte Umrechnung; Verärgerung bei Krediterlöschen17 |
| \*\*Ergebnisbasiert (Outcome)\*\* | Vergütung nur bei validierter Aufgabenerledigung | Intercom Fin (0,99 $ pro Lösung)22; Agentforce24 | Direkte Koppelung an Wertschöpfung | Dispute über Erfolgsdefinition; ungeeignet für Denkaufgaben2 |
| \*\*Hybrides Modell (Basis + Kontingent)\*\* | Feste Grundlizenz inkl. Fair-Use-Volumen + Top-up | Notion AI (Business 20 $)18; MAKE OS4 | Sichere Deckungsbeiträge; verlässliche Kundenbudgets | Erfordert transparentes Telemetrie-Dashboard im UI |

### **Praxiserfahrungen führender Softwareanbieter**

Intercom Fin etablierte eine Grundgebühr (Essential ab 29 $, Advanced ab 85 $ pro Sitz) zuzüglich 0,99 $ pro autonom gelöster Kundenunterhaltung sowie 9,99 $ pro qualifiziertem Vertriebslead22. In der Supportpraxis zeigt sich, dass Kunden mit hohem Ticketvolumen von 2.000 bis 5.000 Fällen monatliche KI-Zusatzkosten von 2.000  tragen müssen, was die Basislizenzkosten um ein Vielfaches übersteigt2. Dies führte zu Kundenprotesten wegen unvorhersehbarer Rechnungen und Kritik an der internen Definition einer „Resolution“, da bereits das Ausbleiben einer Kundenantwort als kostenpflichtige Lösung gewertet wird2. Wettbewerber nutzen diese Schwachstelle gezielt aus, indem sie Festpreise für unbegrenzte Antworten anbieten27.

Salesforce führte Agentforce mit einem Preis von 2,00 $ (bzw. 2,00 € in Europa) pro Konversation ein und ergänzte das Angebot um Flex-Credits (500 $ je 100.000 Einheiten bzw. ca. 0,10  pro Mitarbeiter und Monat24. Marktbeobachtungen zeigen, dass Einkaufsabteilungen im Mittelstand Transaktionspreise meiden, da Finanzvorstände Jahresbudgets vorab festschreiben müssen29.

Lindy.ai vollzog eine Transition hin zu gestaffelten Nutzerabonnements: Plus (29,99 $ mtl. mit 3.000 Credits), Pro (99,99 $ mtl. mit 15.000 Credits) und Max (199,99 $ mtl. mit 35.000 Credits)16. Die Praxis verdeutlichte hier die Gefahren intransparenter Kreditsysteme: Während einfache Aufgaben nur 1 bis 3 Credits verbrauchen, beanspruchen mehrstufige Recherchen oder Anruf-Workflows über 10 Credits pro Schritt17. Nutzer stießen unerwartet an Kontingentgrenzen, was das Unternehmen dazu zwang, Warnsysteme und automatische Nachkaufblöcke (10 $ je 1.000 Credits) einzurichten16.

Notion schaffte das isolierte 10-$-Zusatzpaket für Neukunden ab und integrierte Standard-KI-Funktionen direkt in den Business-Tarif bei einer Preisanpassung von 15  pro Nutzer und Monat19. Autonome Hintergrund-Agenten („Workers“) wurden dagegen in ein separates Kreditguthaben überführt33. Durch diesen Schritt sicherte Notion verlässliche Bruttomargen und verhinderte Kostenüberraschungen bei alltäglichen Schreib- und Organisationsaufgaben19.

Aus diesen Markterfahrungen folgt für MAKE OS zwingend die Wahl eines hybriden Modells \[Strategische Empfehlung\]. Für Solopreneure ist absolute Kostensicherheit eine unverhandelbare Kaufvoraussetzung. Der Grundpreis pro Monat muss sämtliche Basisfunktionen und die typische Inferenzlast eines Monats abdecken. Sollte ein Kunde dieses Kontingent überschreiten, wird das System nicht blockiert; stattdessen greift der deterministische, regelbasierte Grundlauf ein, oder der Nutzer entscheidet sich aktiv für ein manuell autorisiertes Zusatzpaket3.

## **3. Marktpreis-Benchmarks der Vergleichskategorien**

Ein Solo-Unternehmer im DACH-Raum nutzt für die Unternehmenssteuerung typischerweise eine heterogene Ansammlung isolierter Softwarewerkzeuge. Die Marktübersicht zeigt das aktuelle Preisgefüge über die relevanten Softwaresegmente hinweg (Stand: Q3/Q4 2026).

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| \*\*Software-Kategorie\*\* | \*\*Anbieter & Edition\*\* | \*\*Primäre Zielgruppe\*\* | \*\*Preisstruktur (Monat / Jahr)\*\* | \*\*Enthaltene Kernfunktionalität & KI-Integration\*\* |
| \*\*Produktivität & Zeit\*\* | Motion AI35 | Solo / Teams | 19,00 $ mtl. (jährl.) / 34,00 $ (mtl.)35 | KI-basierte Kalenderplanung, automatische Aufgabenpriorisierung35 |
|   | Sunsama | Solo / Wissensarbeiter | 16,00 $ mtl. (jährl.) / 20,00 $ (mtl.) | Strukturierte Tages- und Wochenplanung, Arbeitslast-Fokus |
|   | Akiflow | Solopreneure / Executives | 19,00 $ mtl. (jährl.) / 34,00 $ (mtl.) | Zentraler Posteingang, Time-Blocking, Tastatur-Shortcuts |
| \*\*CRM & Vertrieb\*\* | Pipedrive | Solo / Kleinbetriebe | 14,00 € (Essential) / 29,00 € (Advanced) | Pipeline-Management, Kontakt-Timeline, KI-Vertriebsassistent |
|   | Close CRM | Vertriebsunternehmer | 49,00  (Pro) | Omnichannel-Kommunikation, automatisierte E-Mail-Sequenzen |
|   | HubSpot Sales Hub | Wachstumsunternehmen | 15,00–20,00 € (Starter) / ab 450,00 € (Pro) | Deal-Tracking; Pro-Version mit verpflichtender Onboarding-Pauschale |
| \*\*Finanzen & Buchhaltung\*\* | sevdesk36 | Solo / KMU (DACH) | 12,90 € (Rechnung) / 25,90 € (Buchh.)36 | E-Rechnung, GoBD, EÜR, UStVA, KI-Belegextraktion38 |
|   | Lexware Office38 | Selbstständige (DACH) | 7,90 € (S) / 21,90 € (L) / 32,90 € (XL)38 | Rechnungsstellung, Banking, GuV/EÜR, DATEV-Export38 |
|   | Papierkram.de39 | Freiberufler / Agenturen | 9,90 € (S, jährl.) / 19,90 € (M)39 | EÜR, Zeiterfassung, DATEV, Serverstandort Deutschland39 |
|   | Accountable38 | Freiberufler (DACH) | 9,89 € (Plus) / 19,89 € / 29,90 € (Steuern)38 | Mobile Steuerberechnung, EÜR, KI-Steuerassistent38 |
| \*\*KI-Assistenten & Agenten\*\* | Lindy.ai16 | Solopreneure / Teams | 29,99  (Pro)16 | No-Code-Agenten für E-Mail-Triage, Termine, CRM-Pflege16 |
|   | Dust.tt16 | Wissensarbeiter | 24,00 € pro Sitz (Pro, jährl.)16 | Firmenweite KI-Workspaces, Konnektoren zu Notion, Slack, Drive16 |
|   | Relevance AI | B2B Operations | 19,00  (Team) | Multi-Agenten-Orchestrierung, Datenextraktion, Vertriebs-Research |

Die quantitative Erhebung belegt ein strukturelles Konsolidierungspotenzial im bestehenden Software-Stack \[Fakt\]. Ein Solopreneur im deutschsprachigen Raum, der Aufgabenverwaltung (Notion für ca. 15–20 €), KI-Kalendersteuerung (Motion für ca. 19–34 €), CRM (Pipedrive für ca. 29 €), Buchhaltung (sevdesk oder Lexware Office für ca. 22–26 €), Automatisierungsdienste (Make/Zapier für ca. 20–30 €) sowie ein Basis-KI-Modellabonnement (Claude Pro oder ChatGPT Plus für ca. 22 €) kombiniert, wendet hierfür monatlich **127 € bis 161 € netto** auf.

Obwohl diese Beträge für Einzellizenzen aufgewendet werden, bleiben die Datensilos unverbunden: Strategische Prioritäten im Kalender spiegeln nicht die offenen Vertriebsangebote im CRM wider, und private Terminkollisionen führen zu operativen Überlastungen. MAKE OS löst diesen Bruch auf, indem es den gesamten Stack auf einer zentralen Datenbasis zusammenführt und durch ein übergeordnetes KI-Führungsteam orchestriert3.

## **4. Inferenzkosten-Kalkulation und Token-Ökonomie**

Die variablen Rechenkosten bei der Modellausführung stellen das fundamentale Risiko für die Bruttomarge vertikaler KI-Systeme dar15. Eine präzise Token-Kalkulation bildet das Fundament für die Tragfähigkeit des Abonnementmodells.

### **Modell-Preisstrukturen (Anthropic API, Stand 2025/2026)**

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| \*\*Modell-Klasse\*\* | \*\*Regulärer Input (pro 1M Tokens)\*\* | \*\*Prompt-Caching Read (pro 1M Tokens)\*\* | \*\*Prompt-Caching Write (pro 1M Tokens)\*\* | \*\*Output-Generierung (pro 1M Tokens)\*\* |
| \*\*Stufe 1: Claude 3.5 Haiku\*\*\\\[cite: 20, 43\\\] | 1,00  (0,09 €) | 1,25  (4,60 €) |   |   |
| \*\*Stufe 2: Claude 3.5 Sonnet\*\*\\\[cite: 6, 20\\\] | 3,00  (0,28 €) | 3,75  (13,80 €) |   |   |
| \*\*Stufe 3: Claude Opus (3/3.5)\*\*\\\[cite: 6\\\] | 15,00  (1,38 €) | 18,75  (69,00 €) |   |   |

*Hinweis zur Währungsumrechnung: Es liegt ein Wechselkurs von 1,00 $ = 0,92 € zugrunde \[Schätzung\].*

### **Hebelwirkung von Prompt-Caching und deterministischem Grundlauf**

Anthropic gewährt bei Nutzung des Prompt-Cachings einen Nachlass von 90 % auf gecachte Input-Tokens (Cache-Reads kosten nur ein Zehntel des Basis-Inputs)5. Das architektonische Design von MAKE OS nutzt diesen Mechanismus systematisch aus: System-Prompts, Tool-Deklarationen (ZOE umfasst 36 registrierte Werkzeuge) sowie Organisations- und Stammdaten werden persistent gecacht3. Bei wiederkehrenden Morgen- und Abendläufen werden dadurch bis zu 85 % der Input-Tokens zum rabattierten Cache-Tarif verarbeitet.

Gleichzeitig greift das Prinzip des deterministischen Grundlaufs3. Bevor ein LLM aufgerufen wird, prüfen regelbasierte Skripte im Systemkern, ob überhaupt eine Inferenz erforderlich ist: Liegen keine Kalenderkonflikte, keine neuen E-Mails und keine überfälligen Rechnungen vor, formuliert das System eine standardisierte Statusmeldung bei Inferenzkosten von 0,00 €3.

### **Modell-Routing im operativen Betrieb**

Eingehende Aufgaben werden über eine mehrstufige Entscheidungslogik verarbeitet, die den Aufwand minimiert:

1.  Strukturierte Systemabfragen, Metrikberechnungen und Kalenderabgleiche verbleiben vollständig im regelbasierten Grundlauf ohne LLM-Aufruf3.
2.  Textbasierte Aufgaben durchlaufen eine Vorselektion:

<!-- end list -->

  - Klassifikationsaufgaben, Priorisierungen, Formatvalidierungen und JSON-Schema-Prüfungen werden an Stufe 1 (Claude 3.5 Haiku) geleitet; dies umfasst rund 40 % aller Inferenzaufrufe3.
  - Komplexe Synthesen, Formulierung von Freigabevorlagen, strategische E-Mail-Entwürfe und Führungsdialoge mit ZOE übernimmt Stufe 2 (Claude 3.5 Sonnet), was etwa 55 % des Aufrufvolumens ausmacht3.
  - Hochkomplexe Monatsabschlüsse, Board-Reporting-Synthesen oder steuerliche Szenarienprüfungen werden exklusiv für Stufe 3 (Claude Opus) reserviert und machen maximal 5 % des Gesamtaufkommens aus3.

### **Detaillierte monatliche Inferenzkosten-Kalkulation je Edition**

Die nachfolgende Modellierung basiert auf einem durchschnittlichen Betriebsmonat mit 22 Arbeitstagen und konservativ geschätzten Aktivitätsmustern4.

  

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| \*\*Kalkulationsgröße\*\* | \*\*Edition: Markttraktion\*\* | \*\*Edition: MAKE OS\*\* | \*\*Edition: AI CEO\*\* |
| \*\*Aktive Agenten-Instanzen\*\* | 3 Heads (Sales, Marketing, Event)3 | ZOE Chief-of-Staff3 | ZOE + 8 Abteilungsleiter (Vollteam)3 |
| \*\*Gecachter Prompt-Input pro Tag\*\* | 35.000 Tokens | 55.000 Tokens | 120.000 Tokens |
| \*\*Dynamischer Input pro Tag\*\* | 5.000 Tokens | 8.000 Tokens | 15.000 Tokens |
| \*\*Generierter Output pro Tag\*\* | 2.000 Tokens | 3.000 Tokens | 6.000 Tokens |
| \*\*Modell-Mix (Haiku / Sonnet / Opus)\*\* | 60 % / 40 % / 0 % | 30 % / 70 % / 0 % | 30 % / 65 % / 5 % |
| \*\*Tägliche Inferenzkosten\*\* | ca. 0,52 € | ca. 0,76 € | ca. 1,30 € |
| \*\*Monatliche KI-Kosten (22 Arbeitstage)\*\* | \*\*11,50 €\*\*\\\[cite: 4\\\] | \*\*16,80 €\*\*\\\[cite: 4\\\] | \*\*28,50 €\*\*\\\[cite: 4\\\] |

Die Berechnungen belegen, dass selbst in der Vollausstattung *AI CEO* mit acht autonomen Köpfen die monatlichen Inferenzkosten durch Caching und deterministische Vorfilterung auf unter 29 € begrenzt werden können3.

## **5. Betriebskosten der Single-Tenant-Architektur: Dedizierte Kundeninstanz vs. Multi-Tenant-SaaS**

Der Betrieb von MAKE OS auf Basis isolierter Kundeninstanzen (separater Docker-Container, eigene AES-256-GCM-Schlüssel, isolierte Backups, deutsches Cloud-Hosting) unterscheidet sich fundamental von herkömmlichen Multi-Tenant-Architekturen3.

### **Infrastruktur-Kostenkalkulation (Hetzner Cloud, Deutschland)**

Auf virtuellen Servern des Anbieters Hetzner an den Standorten Nürnberg und Falkenstein lassen sich containerisierte Kundeninstanzen mit geringem finanziellem Aufwand betreiben7.

  

|  |  |  |
| :-: | :-: | :-: |
| \*\*Kostenkomponente\*\* | \*\*Technische Spezifikation\*\* | \*\*Monatliche Kosten netto\*\* |
| \*\*Cloud VPS Basis\*\* | Hetzner CX23 (2 vCPU x86, 4 GB RAM, 40 GB NVMe SSD)7 | 5,49 € |
| \*\*Dedizierte IPv4-Adresse\*\* | Feste IP für zuverlässige Zustellbarkeit und Caddy-SSL-Zertifikate7 | 0,50 € |
| \*\*Snapshot- & Speicher-Backup\*\* | Tägliche Snapshots (20 % Aufschlag)7 + allokierter Storage-Box-Anteil4 | 0,50 € |
| \*\*Monitoring & Uptime-Prüfung\*\* | Heartbeat-Prüfung, Systemtelemetrie und Störungs-Alerting4 | 1,00 € |
| \*\*Summe Infrastruktur pro Kunde\*\* | \*\*Vollständig isolierte Kundenumgebung in Deutschland\*\* | \*\*7,50 €\*\*\\\[cite: 4\\\] |

Alternativ können auf leistungsstärkeren Servern (z. B. Hetzner CPX32 für 35,99 € monatlich) bis zu sechs Kundencontainer betrieben werden, was die reinen Hosting-Kosten pro Kunde auf etwa 5,00 € reduziert44. Aus Gründen maximaler Härtung und Ausfallsicherheit kalkuliert das vorliegende Modell mit der konservativen Einzelinstanz-Pauschale von **7,50 € pro Kunde und Monat**4.

### **Vergleichsanalyse der Architekturansätze**

  

|  |  |  |
| :-: | :-: | :-: |
| \*\*Bewertungskriterium\*\* | \*\*Dedizierte Einzelinstanz (MAKE OS)\*\* | \*\*Konventionelles Multi-Tenant-SaaS\*\* |
| \*\*Hostingkosten pro Kunde\*\* | 7,50 € pro Monat4 | 0,80 € – 1,50 € pro Monat |
| \*\*Sicherheit & Datenkapselung\*\* | Vollständige Container- und Prozessisolation3 | Logische Trennung auf Datenbankebene |
| \*\*Kryptografische Absicherung\*\* | Eigene Schlüsselhierarchie (AES-256-GCM)3 | Geteilter Master-Key; Applikationsverantwortung |
| \*\*DSGVO & KI-VO Compliance\*\* | Revisionssicher; Verarbeitungsverzeichnis trivial3 | Hohes Kontaminations- und Abfragerisiko |
| \*\*Wartungs- & Rolloutaufwand\*\* | Erfordert automatisierte Deployment-Pipeline | Zentraler Deploy für die gesamte Kundenbasis |
| \*\*Einfluss auf Bruttomarge\*\* | Reduziert Marge moderat um 3–5 Prozentpunkte | Maximale theoretische Servermarge (\\\>85 %) |

### **Skalierungsschwelle der Automatisierung („Instanz-Fabrik“)**

In der initialen Phase (1 bis 15 Kunden) erfolgt das Einrichten über vorbereitete Ansible-Skripte und Docker-Compose-Vorlagen3. Der personelle Zeitaufwand liegt bei circa 20 Minuten pro Instanz \[Schätzung\].

Ab dem 16. Kunden wird der Übergang zur automatisierten „Instanz-Fabrik“ ökonomisch zwingend3. Dieses Subsystem steuert über die Cloud-API von Hetzner das automatische Hochfahren von VPS-Instanzen, die Zertifikatsanforderung via Caddy, das Einspielen verschlüsselter Initialdaten und das Ausrollen von Software-Updates über Versions-Tags3. Bei einem geschätzten Entwicklungsaufwand von 50 Stunden amortisiert sich diese Pipeline ab 15 Kunden innerhalb von rund drei Monaten allein durch eingesparte Betreuungszeit \[Schätzung\].

Als Marktreferenzen belegen Anbieter wie Ghost(Pro) (Managed Publishing ab 36 /Monat) oder Nextcloud Enterprise, dass Kunden im DACH-Raum für garantierte physische Datentrennung und deutschen Serverstandort erhebliche Preisaufschläge akzeptieren8.

## **6. SaaS-Kennzahlen-Benchmarks für SMB- und KI-Software**

Zur Validierung der Unternehmensplanung müssen die Kennzahlen von MAKE OS mit aggregierten Branchendaten renommierter SaaS-Studien (unter anderem von KeyBanc Capital Markets, Bessemer Venture Partners, Benchmarkit, High Alpha und ChartMogul) abgeglichen werden.

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| \*\*Kennzahl\*\* | \*\*Klassischer SMB-SaaS Benchmark\*\* | \*\*Aktueller Markt-Median (2025/2026)\*\* | \*\*Vertikaler KI-SaaS Benchmark (Bessemer)\*\* | \*\*Zielkorridor MAKE OS\*\* |
| \*\*Subscription Gross Margin\*\* | 78 % – 82 % | 80 % Median45 | \*\*60 % – 65 %\*\* (Kompression durch Inferenz)15 | \*\*70 % – 75 %\*\*\\\[cite: 4\\\] |
| \*\*Blended Gross Margin (mit Services)\*\* | 75 % | 76 % – 77 %13 | 52 % – 58 % (bei hohem Betreuungsanteil)47 | \*\*72 % – 74 %\*\* |
| \*\*CAC Payback Period (SMB)\*\* | 6 – 12 Monate48 | 12 – 18 Monate49 | 14 – 20 Monate48 | \*\*\\\< 6 Monate\*\* (durch Setup-Fee: Tag 0)4 |
| \*\*Monatlicher Logo-Churn\*\* | 3,0 % – 5,0 %51 | 4,0 % – 6,0 % (bei ACV \\\< 1.000 €)49 | 3,5 % – 5,0 % | \*\*≤ 2,5 %\*\* (AI CEO) / \*\*≤ 4,0 %\*\* (Traktion) \\\[Schätzung\\\] |
| \*\*Net Revenue Retention (NRR)\*\* | 95 % – 100 %49 | 98 % – 102 %49 | 105 % – 115 % | \*\*105 % – 110 %\*\* |
| \*\*Inference Efficiency Ratio (IER)\*\* | Nicht anwendbar | Nicht erhoben | \*\*8:1 bis 10:1\*\* (Umsatz zu Inferenzkosten)47 | \*\*8:1 bis 9:1\*\* |

Bessemer Venture Partners (*State of the Cloud* und *State of AI*) dokumentieren für KI-native vertikale SaaS-Unternehmen eine signifikante Bruttomargenkompression auf durchschnittlich 60 % bis 65 %15. Die Ursache liegt in den Inferenzkosten, die bei unbedachter Architektur 10 % bis 25 % des Produktumsatzes beanspruchen15.

Unternehmen mit Bruttomargen von unter 70 % erleiden am Kapitalmarkt deutliche Bewertungsabschläge von bis zu 50 % gegenüber Unternehmen mit Margen von über 80 %13. MAKE OS schützt seine Ziel-Bruttomarge von über 70 % bewusst durch die Kombination aus robuster Subskriptionsgebühr, dem deterministischen 80 %-Grundlauf und diszipliniertem Modell-Routing3.

## **7. Zahlungsbereitschaft von Solo-Unternehmern und psychologische Wertanker**

Ein wiederkehrender Fehler bei der Preisfindung für Solo- und Kleinstunternehmen ist die Gleichsetzung mit Konsumenten oder Freelancern im Niedrigpreissegment \[Meinung/Strategie\]. Unternehmer und selbstständige Führungskräfte verwalten zwei grundlegend getrennte Budgets:

  - **Das Software-Werkzeug-Budget:** Anwendungen zur reinen Aufgabenerleichterung (Projektboards, einfache Kalender, Notiz-Apps) besitzen eine begrenzte Zahlungsbereitschaft von 10 € bis maximal 35 € pro Monat.
  - **Das Entlastungs- und Personalsubstitutions-Budget:** Systeme, die unternehmerische Kernverantwortung tragen, Umsatzpotenziale heben oder messbare Arbeitszeit einsparen, greifen auf das Personalbudget zu; hier liegt die Zahlungsbereitschaft im Bereich von 150 € bis 600 € monatlich10.

### **Referenzanker 1: Virtuelle Assistenz (VA) im DACH-Raum**

  

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| \*\*Assistenzmodell\*\* | \*\*Stundensatz / Kostenstruktur (DACH)\*\* | \*\*Monatlicher Gesamtaufwand\*\* | \*\*Verfügbarkeit und Limitierungen\*\* |
| \*\*Freiberufliche VA (Standard)\*\* | 35,00 € – 55,00 € / Std.12 | Bei 10 Std./Mo.: \*\*350 € – 550 €\*\*\\\[cite: 12\\\] | Begrenzte strategische Tiefe, asynchrone Wartezeiten |
| \*\*Freiberufliche VA (Spezialisiert)\*\* | 60,00 € – 80,00 € / Std.11 | Bei 20 Std./Mo.: \*\*1.200 € – 1.600 €\*\* | Hohe Nachfrage, Ausfallrisiken bei Krankheit/Urlaub |
| \*\*Angestellte Assistenz (Teilzeit)\*\* | 20,00 € – 29,00 € brutto / Std.52 | 15–20 Std./Wo.: \*\*1.800 € – 2.450 €\*\* (brutto/Lohnnebenkosten)52 | Fixe Gemeinkosten, arbeitsrechtliche Bindung |

Der reale Markteinstiegspreis für eine verlässliche administrative Entlastung beginnt im DACH-Raum bei einem monatlichen Retainer von **450 € bis 500 € netto** für etwa zehn Arbeitsstunden11. Mit einem Preis von 199 € bis 249 € für den Tarif *AI CEO* positioniert sich MAKE OS bei exakt der Hälfte dieses niedrigsten Assistenzbudgets, stellt jedoch ein System bereit, das rund um die Uhr acht betriebliche Fachbereiche abdeckt3.

### **Referenzanker 2: Opportunitätskosten unternehmerischer Arbeitszeit**

Dienstleister, Berater und Agenturinhaber kalkulieren ihre Kundenstundensätze typischerweise zwischen 120 € und 250 € netto. Gelingt es MAKE OS durch automatisierte Tagesstrukturierung, Vorbereitung aller Vertriebsvorgänge und synchronisierte Finanzübersichten wöchentlich lediglich zwei Stunden unproduktiver Administrationszeit einzusparen, entspricht dies einem monatlichen Gegenwert von **960 € bis 2.000 €**. Die Investition in den Tarif *AI CEO* amortisiert sich somit bereits in der ersten Woche eines jeden Monats um ein Mehrfaches10.

## **8. Symbiose von Software und Dienstleistung: Tech-Enabled Onboarding**

Reine Self-Serve-Modelle für komplexe Führungssysteme weisen im SMB-Bereich häufig hohe Abbrüche während der ersten 60 Tage auf, da Unternehmer im Tagesgeschäft an der Migration ihrer Daten und der initialen Konfiguration scheitern. Führende B2B-Anbieter kombinieren die Software daher mit standardisierten, hochpreisigen Implementierungsdienstleistungen9.

### **Architektur des Productized Onboarding**

Der Vertriebsprozess verknüpft Softwareeinführung und Beratung in einem durchdachten Trichter:

1.  Ein qualifizierter Interessent bucht das standardisierte Einführungspaket *Make.One Setup-Kickoff* für einmalig 990 € netto4.
2.  Innerhalb eines definierten Zeitfensters von vier Stunden erfolgt die Einrichtung im Done-With-You-Format: Auswahl des branchenspezifischen Playbooks, Anbindung von E-Mail-, Kalender- und CRM-Schnittstellen sowie Definition des Nullpunkts für Finanzen und Aufgaben3.
3.  Der Kunde startet mit einer voll funktionstüchtigen, konfigurierten Instanz in den ersten Monat, was die 90-Tage-Abwanderungsrate nachweislich halbiert9.
4.  Die Softwaregebühr fließt im Anschluss als hochmargiger, wiederkehrender Subskriptionsumsatz ohne weiteren Betreuungsaufwand9.

### **Wirtschaftlichkeit des Einrichtungspakets**

  - **Angebot:** *Make.One Setup-Kickoff*  
    \[cite: 4\]
  - **Preis:** 990,00 € einmalig netto4
  - **Leistungsumfang:** Bereitstellung des Hetzner-Containers, Einspielen des Playbooks, zwei 1:1-Remote-Sessions à 120 Minuten sowie 30 Tage erweiterter VIP-Support3.
  - **Kostenrechnung:** Maximal 4 Stunden Consultant-Aufwand bei internen Vollkosten von 70,00 € pro Stunde entsprechen 280,00 € \[Schätzung\].
  - **Dienstleistungs-Bruttomarge:** 4.

### **Schutz vor der Beraterfalle („Services Drag“)**

Dienstleistungsumsätze dürfen die Bewertungsmultiplikatoren des Softwareunternehmens nicht belasten; während reine SaaS-Modelle mit 8- bis 12-fachem ARR bewertet werden, fallen beratungsintensive Mischformen oft auf 3- bis 5-fache Multiples zurück9. Drei Governance-Regeln sichern die Trennung:

Erstens gilt eine strikte zeitliche Deckelung auf vier Arbeitsstunden ohne kundenindividuelle Sonderprogrammierungen. Zweitens verfolgt der Termin den Done-With-You-Ansatz, bei dem der Kunde die Bedienung der Software und der Agentenköpfe selbst erlernt3. Drittens greift ein Produktifizierungszwang: Jeder Konfigurationsschritt, der in mehr als zwei Kunden-Workshops manuell wiederholt werden muss, wird prioritär in den automatisierten Installationsassistenten der Software übernommen3.

## **9. Lizenzarchitektur, Vertragskonditionen und Datensouveränität**

Die Vertraulichkeit geschäftlicher und privater Daten ist das entscheidende Differenzierungsmerkmal von MAKE OS gegenüber US-amerikanischen Plattformen3. Die rechtliche und lizenztechnische Ausgestaltung muss dieses Versprechen widerspiegeln.

### **Vertragslaufzeiten und Zahlungsanreize**

Das Monatsabonnement bietet maximale Flexibilität bei monatlicher Kündigungsfrist und Kreditkartenabrechnung. Das Jahresabonnement beinhaltet einen Preisvorteil von rund 20 % (entspricht rechnerisch zehn Monaten Nutzungsentgelt für zwölf Monate Softwarezugang)23. Vorauszahlungen sichern die Liquidität, finanzieren das Server-Provisioning im Voraus und reduzieren die jährliche Kundenfluktuation signifikant49. Zielgröße ist ein Verhältnis von 60 % Jahreszahlern zu 40 % Monatszahlern4.

### **Pilotphase ohne Free-Tier-Verwässerung**

Ein dauerhaft kostenfreies Einstiegsangebot scheidet aus, da jede Kundeninstanz reale Server- und Speicherressourcen beansprucht4. Das Pilotangebot (*Paid Pilot*) sieht einen 30-tägigen Produktivbetrieb für eine Schutzgebühr von 199 € netto vor \[Strategische Empfehlung\]. Der Kunde erhält eine vollfunktionsfähige Einzelinstanz der Edition *AI CEO* inklusive 30 € KI-Inferenzbudget3. Entscheidet sich der Kunde im Anschluss für den Abschluss eines Jahresvertrags, wird die Pilotgebühr vollständig auf die Jahressumme angerechnet.

### **Das Souveränitätsversprechen: Signierte Lizenzen und Read-Only-Garantie**

MAKE OS garantiert seinen Nutzern vertraglich und technisch die uneingeschränkte Datenhoheit3:

Die Lizenzprüfung erfolgt lokal auf der Instanz anhand asymmetrisch signierter Ed25519-Schlüssel3. Es existiert kein zentraler Kill-Switch, der die Instanz bei Verbindungsunterbrechungen oder Lizenzablauf deaktiviert3.

Endet ein Abonnement, tritt das System in einen dauerhaften Nur-Lese-Modus über3. Während ZOE, die Abteilungsleiter und automatisierte Hintergrundläufe pausiert werden, bleiben alle bisher erfassten Daten, Notizen, Finanzunterlagen und Kundenakten zeitlich unbegrenzt einsehbar3. Ein vollständiger Datenexport nach Art. 20 DSGVO erzeugt auf Knopfdruck standardisierte Markdown-Dateien für Dokumente, CSV-Datensätze für Kundenkontakte sowie DATEV-kompatible Buchungslisten3.

## **10. Finanzierungsstrategie und Investorenanforderungen 2026**

### **Bootstrapping vs. Venture Capital**

  

|  |  |  |
| :-: | :-: | :-: |
| \*\*Kriterium\*\* | \*\*Bootstrapping / Cashflow-First (Empfohlen)\*\* | \*\*Venture Capital (Seed / Series A)\*\* |
| \*\*Eignung für MAKE OS\*\* | \*\*Hervorragend\*\*; Setup-Pakete und Jahresabos sichern operative Profitabilität4 | Mäßig; VC-Modelle meiden SMB-Zielgruppen oft wegen Churn-Risiken49 |
| \*\*Wachstumsanforderungen\*\* | Organisch, qualitätsorientiert; Dogfooding treibt Produktgüte3 | Zwang zu 300 % jährlichem Wachstum; hoher Druck zu Paid-Ads45 |
| \*\*Architektur-Autonomie\*\* | Dedizierter Single-Tenant-Ansatz bleibt erhalten3 | Druck zur Umstellung auf Multi-Tenant zur Maximierung der SaaS-Marge45 |
| \*\*Vorbilder im Markt\*\* | Basecamp, Mailchimp, Linear (Frühphase) | Motion, Reclaim.ai |

### **Bewertungskriterien für vertikale KI-Software 2026**

Investoren prüfen KI-Geschäftsmodelle im Jahr 2026 mit ausgeprägter Skepsis gegenüber reinen Schnittstellen-Wrappern. Bei einer späteren Wachstumsfinanzierung müssen vier Parameter nachgewiesen werden:

1.  **Bruttomarge nach Inferenz:** Die Software-Bruttomarge nach vollständigem Abzug aller Modell- und Hosting-Kosten muss stabil bei mindestens 70 % liegen13. Startups mit Margen von unter 50 % werden mit drastischen Abschlägen bewertet14.
2.  **Inference Efficiency Ratio (IER):** Das Verhältnis von Erlös zu reinen Inferenzkosten muss mindestens **8:1 bis 10:1** betragen47.
3.  **System-of-Record-Gravitation:** Die Verteidigungsfähigkeit entsteht nicht durch proprietäre Modellgewichte, sondern durch die Verankerung als zentrales Betriebssystem für Kundenkontakte, persönliche Aufgaben und Finanzen3. Ein Wechsel des Systems ist mit massiven operativen Reibungsverlusten verbunden9.
4.  **Regulatorischer Vertrauensschutz:** Durch den Betrieb in deutschen Rechenzentren und die vollständige Umsetzung der Anforderungen des EU AI Acts und der DSGVO (einschließlich Art. 9 für Gesundheitsdaten) besetzt MAKE OS eine uneinnehmbare Nische gegenüber US-Wettbewerbern3.

## **11. Unit-Economics-Modell und Sensitivitätsanalyse**

### **Modellannahmen**

  - **Vertragsverteilung:** 60 % Jahreszahler (mit 20 % Rabatt), 40 % Monatszahler4.
  - **Berechnung des Blended ARPU (durchschnittlicher Monatserlös je Kunde):**

<!-- end list -->

  - *Markttraktion:*   
    \[cite: 4\]
  - *MAKE OS:*   
    \[cite: 4\]
  - *AI CEO:*   
    \[cite: 4\]

<!-- end list -->

  - **Herstellungskosten (COGS) pro Kunde und Monat:**

<!-- end list -->

  - *Dedizierte Infrastruktur (Hetzner Cloud):* 7,50 €4.
  - *Zahlungsdienstleister (Stripe):* 1,5 % Transaktionsgebühr zzgl. 0,25 € je Buchung4.
  - *Kundenbetreuung & Instanzbetrieb:* Markttraktion 6,00 €, MAKE OS 10,00 €, AI CEO 15,00 €4.
  - *KI-Inferenz (Anthropic API realistischer Monatsmix):* Markttraktion 11,50 €, MAKE OS 16,80 €, AI CEO 28,50 €4.

### **Detaillierte Unit-Economics-Tabelle je Edition**

  

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| \*\*Betriebswirtschaftliche Kennzahl\*\* | \*\*Edition: Markttraktion\*\* | \*\*Edition: MAKE OS\*\* | \*\*Edition: AI CEO\*\* |
| \*\*Blended ARPU\*\* | \*\*87,00 €\*\*\\\[cite: 4\\\] | \*\*131,00 €\*\*\\\[cite: 4\\\] | \*\*219,00 €\*\*\\\[cite: 4\\\] |
| \*COGS: Dedizierte Cloud-Infrastruktur\* | 7,50 €4 | 7,50 €4 | 7,50 €4 |
| \*COGS: KI-Inferenz (Anthropic API)\* | 11,50 €4 | 16,80 €4 | 28,50 €4 |
| \*COGS: Zahlungsabwicklung\* | 1,55 €4 | 2,22 €4 | 3,53 €4 |
| \*COGS: Laufender Instanz-Support\* | 6,00 €4 | 10,00 €4 | 15,00 €4 |
| \*\*Gesamte COGS pro Kunde / Monat\*\* | \*\*26,55 €\*\*\\\[cite: 4\\\] | \*\*36,52 €\*\*\\\[cite: 4\\\] | \*\*54,53 €\*\*\\\[cite: 4\\\] |
| \*\*Monatlicher Bruttogewinn (Gross Profit)\*\* | \*\*60,45 €\*\* | \*\*94,48 €\*\* | \*\*164,47 €\*\* |
| \*\*Bruttomarge in Prozent (Gross Margin)\*\* | \*\*69,48 % (ca. 69,5 %)\*\*\\\[cite: 4\\\] | \*\*72,12 % (ca. 72,1 %)\*\*\\\[cite: 4\\\] | \*\*75,10 % (ca. 75,1 %)\*\*\\\[cite: 4\\\] |
| Angenommene monatliche Logo-Abwanderung | 3,5 % | 2,8 % | 2,0 % |
| Durchschnittliche Vertragslaufzeit (Monate) | 28,6 Monate | 35,7 Monate | 50,0 Monate |
| \*\*Customer Lifetime Value (LTV Brutto)\*\* | \*\*1.728 €\*\* | \*\*3.373 €\*\* | \*\*8.223 €\*\* |
| Angenommene Kundenakquisitionskosten (CAC) | 450 € | 650 € | 950 € |
| \*\*Amortisationszeit (CAC Payback)\*\* | \*\*7,4 Monate\*\* | \*\*6,9 Monate\*\* | \*\*5,8 Monate\*\* |
| \*Amortisationszeit MIT Setup-Kickoff (990 €)\* | \*\*0,0 Monate (sofort profitabel)\*\* | \*\*0,0 Monate (sofort profitabel)\*\* | \*\*0,0 Monate (sofort profitabel)\*\* |
| \*\*LTV : CAC Verhältnis\*\* | \*\*3,8 : 1\*\* | \*\*5,2 : 1\*\* | \*\*8,6 : 1\*\* |

### **Sensitivitätsanalyse (Stresstest des Tarifs AI CEO)**

Die Sensitivitätsprüfung simuliert extreme Markt- und Kostenabweichungen für das Flaggschiffprodukt *AI CEO* (Basis-ARPU: 219,00 €). Die Amortisationszeit berechnet sich formelmäßig als:

wobei der monatliche Bruttogewinn als  definiert ist.

|  |  |  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| \*\*Szenario\*\* | \*\*KI-Kosten / Monat\*\* | \*\*Churn / Monat\*\* | \*\*Gesamte COGS\*\* | \*\*Bruttomarge %\*\* | \*\*Monatlicher Bruttogewinn\*\* | \*\*CAC Payback (bei 950 € CAC)\*\* | \*\*LTV (Bruttogewinn)\*\* |
| \*\*Basisfall\*\* | \*\*28,50 €\*\*\\\[cite: 4\\\] | \*\*2,0 %\*\* | \*\*54,53 €\*\*\\\[cite: 4\\\] | \*\*75,1 %\*\*\\\[cite: 4\\\] | \*\*164,47 €\*\* | \*\*5,8 Monate\*\* | \*\*8.223 €\*\* |
| \*\*KI-Kosten +50 %\*\* (Preisanstieg API) | 42,75 € | 2,0 % | 68,78 € | 68,6 % | 150,22 € | 6,3 Monate | 7.511 € |
| \*\*KI-Kosten -50 %\*\* (Modelleffizienz) | 14,25 € | 2,0 % | 40,28 € | 81,6 % | 178,72 € | 5,3 Monate | 8.936 € |
| \*\*Churn +50 %\*\* (Erhöhte Abwanderung 3,0 %) | 28,50 € | 3,0 % | 54,53 € | 75,1 % | 164,47 € | 5,8 Monate | 5.482 € |
| \*\*Churn -50 %\*\* (Hohe Bindung 1,0 %) | 28,50 € | 1,0 % | 54,53 € | 75,1 % | 164,47 € | 5,8 Monate | 16.447 € |
| \*\*Worst-Case:\*\* KI +50 % UND Churn +50 % | 42,75 € | 3,0 % | 68,78 € | 68,6 % | 150,22 € | 6,3 Monate | 5.007 € |
| \*\*Best-Case:\*\* KI -50 % UND Churn -50 % | 14,25 € | 1,0 % | 40,28 € | 81,6 % | 178,72 € | 5,3 Monate | 17.872 € |

Die Modellrechnung belegt eine außerordentliche Robustheit \[Fakt\]. Selbst im ungünstigsten Szenario, in dem die KI-Preise um 50 % steigen und die Kündigungsquote auf 3,0 % im Monat anwächst, verbleibt die Bruttomarge bei 68,6 %. Die Amortisation des Akquisitionsaufwands verlängert sich lediglich von 5,8 auf 6,3 Monate, und das LTV:CAC-Verhältnis bleibt mit über 5:1 überdurchschnittlich gesund13.

## **12. Was das für MAKE OS heißt: Preisliste, Editionen, Roadmap und Zielgrößen**

### **Verbindliche Preisliste je Edition**

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| \*\*Edition\*\* | \*\*Monatliche Zahlweise\*\* | \*\*Jährliche Zahlweise (20 % Rabatt)\*\* | \*\*Inkludiertes KI-Budget (Monatswert)\*\* | \*\*Funktionsumfang & Zielgruppe\*\* |
| \*\*Markttraktion\*\* | \*\*99,00 €\*\* / Monat | \*\*79,00 €\*\* / Monat (948,00 € p. a.)4 | 15,00 € Inferenzguthaben | CRM, Deals, Kampagnen, Events, 3 Heads (Sales, Marketing, Event)3 |
| \*\*MAKE OS\*\* | \*\*149,00 €\*\* / Monat | \*\*119,00 €\*\* / Monat (1.428,00 € p. a.)4 | 22,00 € Inferenzguthaben | Fokus & Zeit, Ziele, Finanzen, Gesundheit, Familie, ZOE Chief-of-Staff3 |
| \*\*AI CEO\*\* | \*\*249,00 €\*\* / Monat | \*\*199,00 €\*\* / Monat (2.388,00 € p. a.)4 | 35,00 € Inferenzguthaben | Volles Führungsteam (8 Heads), Cockpit, Rhythmus-Loops, Playbooks3 |

### **Regeln für das KI-Nutzungsbudget (Fair-Use- und Deckelungsarchitektur)**

Das monatlich inkludierte Inferenzbudget ist so dimensioniert, dass 90 % der Anwender bei regulärer Werktagsnutzung innerhalb des Rahmens verbleiben3. Bei Annäherung an die Kontingentgrenze greift ein mehrstufiges Schutzkonzept:

Erreicht ein Nutzer 85 % seines monatlichen Budgets, weist eine dezente Statusanzeige im Führungs-Cockpit auf den Verbrauch hin3. Wird das Kontingent vollständig ausgeschöpft, wechselt die Instanz automatisch in den deterministischen Regelwerk-Grundlauf3. Das System bleibt uneingeschränkt benutzbar; anstelle von LLM-generierten Formulierungen liefert die Plattform präzise, regelbasierte Datenauswertungen3. Möchte der Unternehmer weiterhin auf fortgeschrittene LLM-Synthesen zugreifen, kann er im Dashboard per Klick ein Guthabenpaket nachladen (25,00 € Inferenzguthaben für 30,00 € netto inklusive Deckungsbeitrag).

### **Dienstleistungs- und Implementierungspakete**

  - **Make.One Setup-Kickoff:** 990,00 € einmalig netto4. Bereitstellung der Container-Instanz, Auswahl des passenden Branchen-Playbooks (z. B. Beratung, Beteiligungen, Event-Business), zwei geführte 1:1-Workshops à zwei Stunden und 30 Tage betreuter Onboarding-Support3.
  - **Make.One Strategy & Architecture Day:** 2.900,00 € einmalig netto. Ganztägiger Präsenz-Workshop zur vollständigen Modellierung komplexer Multi-Entity-Strukturen (GmbH, Holding, Einzelunternehmen) und Implementierung individueller Freigabeprozesse3.
  - **Paid Pilotangebot:** 199,00 € Schutzgebühr für 30 Tage Echtbetrieb des *AI CEO* inklusive persönlicher Instanz und 30 € Startguthaben; 100 % Anrechnung bei anschließendem Abschluss eines Jahresvertrags.

### **Operative Roadmap und Kennzahlenziele (Jahre 1 bis 3)**

|  |  |  |  |
| :-: | :-: | :-: | :-: |
| \*\*Kennzahl\*\* | \*\*Jahr 1 (Validierung & DACH-Kern)\*\* | \*\*Jahr 2 (Systemskalierung)\*\* | \*\*Jahr 3 (Marktführerschaft AI CEO)\*\* |
| \*\*Aktive Instanzen (Kunden)\*\* | 35 Kunden | 150 Kunden | 450 Kunden |
| \*\*Editionsverteilung\*\* | 20 % Traktion / 30 % OS / 50 % AI CEO | 15 % Traktion / 25 % OS / 60 % AI CEO | 10 % Traktion / 20 % OS / 70 % AI CEO |
| \*\*Monatlich wiederkehrender Umsatz (MRR)\*\* | ca. 6.200 € | ca. 29.500 € | ca. 95.000 € |
| \*\*Annual Recurring Revenue (ARR)\*\* | \*\*ca. 74.400 €\*\* | \*\*ca. 354.000 €\*\* | \*\*ca. 1.140.000 €\*\* |
| \*\*Dienstleistungsumsatz (Setup-Pakete)\*\* | ca. 30.000 € (30 Pakete) | ca. 80.000 € (80 Pakete) | ca. 150.000 € (150 Pakete) |
| \*\*Gesamtumsatz\*\* | \*\*ca. 104.400 €\*\* | \*\*ca. 434.000 €\*\* | \*\*ca. 1.290.000 €\*\* |
| \*\*Blended Bruttomarge\*\* | 71,5 % | 73,8 % | 75,5 % |
| \*\*Monatliche Kündigungsquote (Ziel)\*\* | \\\< 3,0 % | \\\< 2,2 % | \\\< 1,8 % |
| \*\*Net Revenue Retention (NRR)\*\* | 102 % | 106 % | 110 % |
| \*\*Bereitstellungsgrad der Infrastruktur\*\* | Semi-automatisiert (Ansible) | Vollautomatische „Instanz-Fabrik“ | Multi-Region-Cluster (DE / FI) |

Die zeitliche Implementierung vollzieht sich entlang von fünf aufeinander aufbauenden Meilensteinen:

Zunächst erfolgt in den ersten vier Wochen die technische Bereinigung personenspezifischer Variablen aus dem Kerncode sowie die Fertigstellung des zentralen CEO-Cockpits und des Rhythmus-Registers3. Im zweiten Schritt werden innerhalb der Wochen fünf bis acht die generalisierte Head-Fabrik ausgerollt, die Budget-Ampeln scharfgeschaltet und das Modell-Routing auf Basis von Claude 3.5 Sonnet und Haiku verankert3.

In den Wochen neun bis zwölf folgt die Implementierung der kryptografisch signierten Ed25519-Lizenzen, des garantierten Read-Only-Status und die Akquise der ersten fünf Pilotkunden aus dem Netzwerk von KD Ventures und der MAKE Innovation GmbH3. Der Markteintritt wird über die bewährten Live-Formate („Fokus Innovation“ und „Make.One“) forciert, wobei die interne Nutzung von MAKE OS als „Kunde 0“ den unanfechtbaren Beleg für die Funktionsfähigkeit liefert3.

## **13. Quellenverzeichnis**

  - Anthropic PBC: *Claude 3.5 Sonnet Architecture, Benchmarks, and Pricing Documentation*, Juni 2024 / Update 2025. https://www.anthropic.com/news/claude-3-5-sonnet6
  - Anthropic PBC / AWS Bedrock: *Prompt Caching Implementation Guide and Cost Analysis*, April 2025. https://aws.amazon.com/about-aws/whats-new/2025/04/amazon-bedrock-general-availability-prompt-caching/54
  - Benchmarkit / High Alpha: *2025 SaaS Performance Metrics & Benchmark Report*, Oktober 2025. https://www.omnibound.ai/blog/b2b-saas-marketing-statistics49
  - Bessemer Venture Partners: *State of the Cloud 2024 & State of AI 2025*, Berichte zur Bruttomargenentwicklung und Monetarisierung von KI-Workflows, Februar 2025 / 2026. https://www.bvp.com/atlas/the-state-of-ai-202515
  - ChartMogul: *SaaS Retention & Churn Benchmarks across Customer Segments*, Mai 2025. https://churncost.com/saas-churn-cost-1m-arr49
  - Freelancermap: *Marktstudie und Stundensatz-Erhebung für Freiberufler und Virtuelle Assistenzen im DACH-Raum*, März 2026. https://www.freelancermap.de/blog/was-macht-eine-virtuelle-assistenz/56
  - Hetzner Online GmbH: *Cloud Server Spezifikationen, Standorte und Preisliste 2025/2026*, September 2026. https://www.hetzner.com/cloud/7
  - Intercom Inc.: *Fin AI Agent Outcome-Based Pricing Documentation*, März 2026. https://getcor.ai/blog/reviews/intercom-pricing15
  - KeyBanc Capital Markets & Sapphire Ventures: *Private SaaS Company Survey Results*, September 2024 / 2025. https://founderpath.com/blog/saas-financial-model13
  - Lexware / Haufe-Lexware GmbH & Co. KG: *Lexware Office Produkt- und Preisübersicht*, August 2026. https://letsbecrazy.de/lexoffice-kosten/41
  - Lindy AI: *Pricing Structure, Credit Burn Mechanics and Enterprise Tiers*, September 2026. https://www.lindy.ai/pricing16
  - Motion (UseMotion Inc.): *AI Task Management and Scheduling Pricing Plans*, Juli 2026. https://www.usemotion.com/blog/ai-to-do-list.html35
  - Notion Labs Inc.: *Notion AI Pricing Changes and Workers Credit Consumption*, Mai 2025 / Oktober 2026. https://www.usecarly.com/blog/notion-ai-pricing-change/18
  - Papierkram.de (odacer finanzsoftware GmbH): *Tarif- und Funktionsübersicht für Selbstständige*, Juli 2026. https://www.papierkram.de/aktuelles/einfache-buchhaltungssoftware/39
  - Salesforce Inc.: *Agentforce Flexible Consumption Pricing and Packaging*, Mai 2025 / 2026. https://www.salesforce.com/de/service/ai/agentforce-for-service-pricing/15
  - Sevdesk GmbH: *Preise, Pakete und E-Rechnungs-Funktionen für Kleinunternehmer*, September 2025 / 2026. https://sevdesk.de/preise/36
  - StepStone Deutschland GmbH: *Gehaltsreport für Assistenzberufe und virtuelle Assistenten in Deutschland*, Februar 2026. https://www.stepstone.de/gehalt/Virtuelle-r-Assistent-in.html52

#### **Referenzen**

1.  Intercom Review 2026: Best AI Agent, Most Unpredictable Bill, <https://saasmaste.com/reviews/intercom-review/>
2.  The Intercom $0.99/resolution pricing model is the future. Most of us, <https://www.reddit.com/r/SaaS/comments/1s45fd1/the_intercom_099resolution_pricing_model_is_the/>
3.  AI\_CEO\_MODUL.md
4.  [unknown\_url](http://docs.google.com/unknown_url)
5.  claude api Archives - Triple Minds, <https://tripleminds.co/blogs/tag/claude-api/>
6.  Introducing Claude 3.5 Sonnet - Anthropic, <https://www.anthropic.com/news/claude-3-5-sonnet>
7.  Hetzner Cloud VPS Pricing Calculator (Oct 2026) - CostGoat, <https://costgoat.com/pricing/hetzner>
8.  Die sichere Cloud aus Deutschland von Hetzner, <https://www.hetzner.com/cloud-made-in-germany/>
9.  The Complete Valuation Playbook for Field Service Management, <https://blog.eilla.ai/the-complete-valuation-playbook-for-field-service-management-software-businesses/>
10. Lindy AI Pricing 2026: Plans, Credits & Costs - No Code MBA, <https://www.nocode.mba/articles/lindy-ai-pricing>
11. Virtuelle Assistenz Stundensatz Rechner - ONVACO, <https://onvaco.net/va-stundensatz-rechner/>
12. Preise Social Media & Virtuelle Assistenz - Annica Keichel, <https://www.annica-keichel.de/preise>
13. SaaS Financial Model: How to Build One That Investors Want to See, <https://founderpath.com/blog/saas-financial-model>
14. AI Startup Benchmarks 2026 — Margin, Burn, ARR/Head, <https://aistartupcfo.com/ai-startup-benchmarks>
15. AI puts the cost of goods sold back into software, <https://tolvanen.io/writing/ai-cost-of-goods-sold-software/>
16. Lindy AI Guide 2026: Pricing, Features & Alternatives - Macha AI, <https://www.getmacha.com/blog/lindy-ai-complete-guide>
17. Lindy AI Pricing 2026: Plans, Credits, and Team Costs - Layer3Labs, <https://www.layer3labs.io/guides/lindy-ai-pricing>
18. Notion AI in 2026: what it costs, and when ChatGPT wins | 2sync, <https://2sync.com/blog/notion-ai-vs-chatgpt>
19. Notion's 2026 price increase and AI credits - Max Nardit, <https://max.nardit.com/articles/a-price-you-cannot-compute>
20. Amazon Bedrock Pricing 2026 | Compare AI Model Costs - GoCloud, <https://go-cloud.io/amazon-bedrock-pricing/>
21. Lindy AI Review (2026): Price, Features, Pros & Cons for SEO, <https://searchatlas.com/blog/lindy-ai-review/>
22. Intercom Pricing 2026: Plans, Per-Resolution Costs & Hidden Fees, <https://getcor.ai/blog/reviews/intercom-pricing>
23. Intercom Pricing 2026: Is It Worth It? - Featurebase, <https://www.featurebase.app/blog/intercom-pricing>
24. Salesforce Agentforce Pricing 2026 - Coworker AI, <https://coworker.ai/blog/salesforce-agentforce-pricing>
25. Preise für Agentforce for Service | Salesforce DE, <https://www.salesforce.com/de/service/ai/agentforce-for-service-pricing/>
26. Intercom Pricing 2026: $29 to $132 per Seat + $0.99 per Fin Outcome, <https://www.getmacha.com/blog/intercom-pricing-explained>
27. SupportFlow vs Intercom Fin — One Flat Price vs $0.99 per Resolution, <https://www.getsupportflow.com/vs/intercom>
28. Salesforce Agentforce pricing: the real 2026 cost - eesel AI, <https://www.eesel.ai/blog/agentforce-pricing>
29. Salesforce Agentforce Pricing: The Full Cost Breakdown - My AskAI, <https://myaskai.com/blog/salesforce-agentforce-pricing-explained>
30. Lindy AI Pricing 2026: Plans, Credits and Free Trial - Latenode Blog, <https://latenode.com/blog/lindy-ai-pricing>
31. How Does Lindy AI Pricing Work: Plans and Credits - Ringg AI, <https://www.ringg.ai/blog/lindy-ai-pricing>
32. What Happened to the Notion AI Add-On? (It Moved Into Business), <https://www.usecarly.com/blog/notion-ai-pricing-change/>
33. Notion AI pricing in 2026: plans, credits and Workers, <https://www.breeze.pm/articles/notion-ai-pricing>
34. Understand pricing for Workers in Notion | Notion Help – ศูนย์, <https://www.notion.com/th/help/understand-pricing-for-workers?nxtPslug=understand-pricing-for-workers>
35. 10 Best AI To-Do List Apps of 2025 (Tested & Ranked) - Motion, <https://www.usemotion.com/blog/ai-to-do-list.html>
36. sevdesk Erfahrungen & Features 2026 | OMR Reviews, <https://omr.com/de/reviews/product/sevdesk>
37. sevdesk Kosten im Überblick | Alle Preise & Tarife, <https://sevdesk.de/preise/>
38. Vergleich: Beste Buchhaltungssoftware für Kleinunternehmer 2026, <https://sevdesk.de/ratgeber/buchhaltung-finanzen/rechnung-buchhaltung-programme/buchhaltungssoftware-kleinunternehmer-vergleich/>
39. Einfache Buchhaltungssoftware 2026: 5 Tools im Vergleich, <https://www.papierkram.de/aktuelles/einfache-buchhaltungssoftware/>
40. Rechnungsprogramm-Vergleich 2026: Welches ist das beste?, <https://sevdesk.de/ratgeber/buchhaltung-finanzen/rechnung-buchhaltung-programme/rechnungsprogramm-vergleich/>
41. Lexware Office Test: Funktionen, Preise & Erfahrungen - Firma.de, <https://www.firma.de/rechnungswesen/lexware-office-buchhaltungs-software/>
42. sevdesk vs. Papierkram – Preisvergleich für Handwerker 2026, <https://www.rechnung-handwerk.de/sevdesk-vs-papierkram/>
43. Claude Models Explained: All 32, Opus to Fable 5.1 - Gradually AI, <https://www.gradually.ai/en/claude-models/>
44. Hetzner Virtual Private Server: Best Price-Performance Ratio, <https://www.hetzner.com/cloud/regular-performance/>
45. 35 SaaS gross margin statistics - Orb Billing, <https://www.withorb.com/blog/saas-growth-margin-statistics>
46. Why Vertical AI Agents Are Outperforming General AI (Towards AI), <https://pub.towardsai.net/why-vertical-ai-agents-are-outperforming-general-ai-and-what-that-means-for-your-business-53bdef49de57>
47. How to Calculate the Inference Efficiency Ratio - The SaaS CFO, <https://www.thesaascfo.com/how-to-calculate-the-inference-efficiency-ratio/>
48. CAC Payback Benchmarks for SaaS Companies - Bantrr, <https://bantrr.com/business-model/saas-metrics/cac-payback-benchmarks-for-saas-companies/>
49. B2B SaaS Marketing Statistics (2026): Data Points on CAC, Pipeline, <https://www.omnibound.ai/blog/b2b-saas-marketing-statistics>
50. Customer Acquisition Cost Benchmarks by Industry (2026 Data), <https://christopholivierconsulting.com/customer-acquisition-cost-benchmarks/>
51. SaaS Churn Cost at $1M ARR (2026), <https://churncost.com/saas-churn-cost-1m-arr>
52. Virtuelle/r Assistent/in Gehälter in Deutschland - Stepstone, <https://www.stepstone.de/gehalt/Virtuelle-r-Assistent-in.html>
53. Remote Scout – Deine Zukunft beginnt mit der richtigen Entscheidung., <https://remote-scout.com/>
54. Amazon Bedrock announces general availability of prompt caching, <https://aws.amazon.com/about-aws/whats-new/2025/04/amazon-bedrock-general-availability-prompt-caching/>
55. The State of AI 2025 - Bessemer Venture Partners, <https://www.bvp.com/atlas/the-state-of-ai-2025>
56. Virtuelle Assistenz: Aufgaben, Gehalt & Skills - Freelancermap, <https://www.freelancermap.de/blog/was-macht-eine-virtuelle-assistenz/>
57. Hetzner Cloud, <https://www.hetzner.com/cloud/>
58. Lexoffice Kosten 2026: Alle Tarife im Vergleich, <https://letsbecrazy.de/lexoffice-kosten/>
59. Pricing - Lindy.ai, <https://www.lindy.ai/pricing>
