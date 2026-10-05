# AI-CEO-Modul · 10 Recherche-Aufträge für Gemini Deep Research

**Stand:** 05.10.2026 · gehört zu `AI_CEO_MODUL.md`
**So benutzt du die Datei:**
1. Öffne **10 getrennte** Gemini-Läufe (Deep Research). Jeder Lauf bekommt **genau einen** Prompt (P1–P10). Jeder Prompt ist vollständig für sich, du musst nichts ergänzen.
2. Kopiere jeweils alles zwischen `--- PROMPT P… START ---` und `--- PROMPT P… ENDE ---`.
3. Wenn Gemini vorab einen Rechercheplan zeigt: prüfen, ob alle nummerierten Fragen drin sind, sonst „bitte alle Fragen 1–n abdecken“ antworten, dann starten.
4. Ergebnisse als Google Doc exportieren und als `research/ai-ceo/P01-markt.md` … `P10-gtm.md` ablegen (oder mir die Docs geben).
5. Zusätzlich **P12–P19** (Stimme der Kunden, Weg zu 100 Kunden, Integrationen, Förderung, Gestaltung, Homepage, Umsatzströme, KI-Brain) — damit ist das Bild rundum vollständig.
6. Zum Schluss den **Bonus-Prompt P11** mit allen achtzehn Ergebnissen laufen lassen (oder ich mache die Synthese mit dir). Mehr Prompts lohnen danach nicht — der nächste Erkenntnissprung kommt aus Gesprächen mit Pilotkunden (Leitfaden aus P12).

**Die 10 Läufe im Überblick**
| Nr. | Thema | Wofür wir es brauchen |
|---|---|---|
| P1 | Markt & Zielgruppe: Solo-/AI-native Unternehmen | Wie groß, wer genau, was zahlen sie |
| P2 | Wettbewerb I: Arbeits-, Planungs- und Produktivitätssoftware mit KI | Was es gibt, wo die Lücke ist |
| P3 | Wettbewerb II: Agenten-Plattformen, „KI-Mitarbeiter“, Founder-/CEO-Systeme | Wer dem AI-CEO-Gedanken am nächsten kommt |
| P4 | Wettbewerb III: Privatleben, Gesundheit, Familie, persönliche Finanzen, „Second Brain“ | Warum Privat + Business zusammen gewinnt |
| P5 | Wie sich KI 2026–2030 entwickelt | Trends, die wir heute schon einbauen |
| P6 | Agenten-Architektur und beste Praxis | Wie wir das Führungsteam technisch richtig bauen |
| P7 | Recht, Datenschutz, Sicherheit, Vertrauen (EU/DE) | Was Pflicht ist, was Verkaufsargument wird |
| P8 | Arbeit, Fokus, Gesundheit und Leistungsfähigkeit von Gründern | Belege für Balance als Funktion |
| P9 | Geschäftsmodell, Preise, Kosten der KI, Kennzahlen | Wie wir Geld verdienen, ohne Marge zu verlieren |
| P10 | Weg in den Markt, Positionierung, Marke, Vertrieb (DACH) | Wie wir es extrem gut verkaufen |
| P12 | Stimme der Kunden: Worte, Schmerzen, Wechselauslöser, Aha-Moment | Richtige Reihenfolge der Funktionen und die Sprache, die verkauft |
| P13 | Vom Plan zu 100 Kunden: Fallstudien, Reihenfolge, Betriebsmodell | Ein belastbarer Fahrplan mit Meilensteinen und Abbruchkriterien |
| P14 | Integrationen und Ökosystem DACH (DATEV, Banken, Buchhaltung, Signatur …) | Was angebunden sein muss, damit Steuerberater und Kunden Ja sagen |
| P15 | Förderung und Finanzierung des Baus | Geld für Entwicklung und Piloten, ohne die Richtung aufzugeben |
| P16 | Gestaltung von KI-Aufsicht, Cockpits und ruhiger Technik | Damit das Cockpit weltweit zu den besten Oberflächen gehört |
| P17 | Homepage und Außendarstellung, die alles schlägt | Website, Marke, Demo, Video, Suche/KI-Suche — besser als alles, was wir heute haben |
| P18 | Produkte verkaufen: alle Umsatzströme und Verkaufswege | Jede Möglichkeit, mit MAKE OS und den Produkten dahinter Geld zu verdienen |
| P19 | Das KI-Brain sauber auf dem eigenen Server | Architektur für Wissen, Suche und Gedächtnis — sicher, schnell, je Kunden-Instanz |
| P11 | Bonus: Synthese aller achtzehn Ergebnisse (zuletzt laufen lassen) | Ein Bauplan mit Prioritäten |

---

## Gemeinsame Qualitätsregeln (stehen in jedem Prompt schon drin)
- Nur **aktuelle** Quellen bevorzugen (letzte 12–18 Monate; ältere nur für Grundlagen, dann mit Hinweis), jede Quelle mit **Datum** und **Link**.
- Deutsch- **und** englischsprachige Quellen; Primärquellen vor Sekundärquellen (Studien, Behörden, Anbieterseiten, Geschäftsberichte, Gesetzestexte, wissenschaftliche Arbeiten).
- Jede Aussage einordnen: **Fakt** (belegt) · **Schätzung** (mit Methode) · **Meinung/Prognose** (wer sagt es).
- **Keine erfundenen Zahlen.** Wenn nichts Belastbares zu finden ist: „nicht belegt“ schreiben.
- Je Kapitel ein Abschnitt **„Was das für MAKE OS heißt“**: konkrete Funktionen, Trends zum Einbauen, Verkaufsargumente, Risiken.
- Ausgabe auf **Deutsch**, mit Tabellen, am Ende eine Quellenliste.

---

--- PROMPT P1 START ---

Du bist eine erfahrene Marktanalystin für Software und Arbeitswelt mit Schwerpunkt Europa/DACH. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (unser Produkt):** MAKE OS ist eine Software, mit der ein einzelner Mensch sein Unternehmen und sein Privatleben in einem System steuert: Fokus & Zeit (Kalender, Ziele, Meilensteine, Aufgaben, Kapazität), Business (CRM/Vertrieb, Marketing, Events, Finanzplanung, Steuern, Gesellschaften), Privat (Haushaltsfinanzen, Gesundheit, Familie) und ein KI-Führungsteam (ein KI-Chief-of-Staff und KI-Abteilungsleiter für Sales, Marketing, Finance, Operations, IT …), das vorschlägt, während der Mensch entscheidet. Business sieht nie Privates, Privat sieht das Business; jede Kundin, jeder Kunde bekommt eine eigene, verschlüsselte Instanz in Europa. Wir bauen als Nächstes ein „AI-CEO-Modul“: die Plattform für Menschen, die ihr Unternehmen ohne oder fast ohne Mitarbeiter mit KI-Agenten führen („AI CEO“) und Privat und Business zusammen steuern wollen.

**Ziel dieses Laufs:** Den Markt und die Zielgruppe „AI CEO / Solo- und Kleinstunternehmen mit KI“ vollständig vermessen, um zu entscheiden, für wen wir zuerst bauen und wie groß die Chance ist.

**Beantworte ausführlich und mit Quellen:**
1. Wie viele Solo-Selbstständige, Freiberufler, Einzelunternehmen und Kleinstunternehmen (0–9 Beschäftigte) gibt es in Deutschland, Österreich, der Schweiz, der EU und den USA (aktuellste amtliche Zahlen: Destatis, Statistik Austria, BFS, Eurostat, US Census/BLS)? Entwicklung der letzten 5–10 Jahre.
2. Welche Belege gibt es für den Trend „Unternehmen ohne Mitarbeiter“ / „One-Person-Companies mit KI“ / „AI-native Solopreneurs“ (Studien, Umfragen, Gründungsstatistiken, Aussagen von Investoren und KI-Unternehmen wie OpenAI, Anthropic, Y Combinator, Sequoia, a16z)? Was davon ist belegt, was ist Erzählung?
3. Welche Untergruppen gibt es (Berater/Experten, Coaches/Trainer, Agenturen ohne Angestellte, Software-/Produkt-Kleinunternehmen, Creator, E-Commerce, Holding-/Beteiligungsunternehmer, Event-/Community-Unternehmer)? Größe, Wachstum, typische Umsätze, typische Software-Ausgaben je Gruppe.
4. Wie viel geben Solo- und Kleinstunternehmen für Software und KI aus (pro Monat/Jahr, Anzahl Werkzeuge, „Tool-Wildwuchs“)? Aktuelle Umfragen (z. B. Bitkom, KfW, ZEW, Gartner, Capterra/GetApp, Zapier, Notion, HubSpot-Reports).
5. Wie verbreitet ist KI-Nutzung in dieser Gruppe heute (DACH vs. USA), wofür, mit welchen Hürden (Datenschutz, Vertrauen, Kompetenz, Kosten)?
6. Wie stark verschwimmen bei dieser Gruppe Privat und Business (gemeinsame Finanzen, Steuern, Kalender, Gesundheit/Belastung, Familie)? Gibt es Studien zum Bedarf, beides in einem System zu führen?
7. Personas: Beschreibe 4–6 realistische Personas (Demografie, Lebenslage, Geschäftsmodell, Tagesablauf, Schmerzen, Ziele, heutige Werkzeuge, Zahlungsbereitschaft, Kaufauslöser, Einwände) — jeweils mit Belegen aus Studien/Foren/Interviews, wo möglich.
8. Zahlungsbereitschaft: Was zahlen diese Gruppen heute für vergleichbare Produkte (Produktivität, CRM, Buchhaltung, KI-Assistenten)? Gibt es Studien zu Zahlungsbereitschaft für „KI-Mitarbeiter“?
9. Marktgröße: Leite eine nachvollziehbare TAM/SAM/SOM-Schätzung für DACH und EU her (Methode offenlegen, Annahmen in Tabelle), getrennt für die Editionen „nur Vertrieb/CRM“, „Privat+Business-Betriebssystem“, „AI CEO mit KI-Führungsteam“.
10. Wie wird sich die Zielgruppe bis 2030 entwickeln (Prognosen, Szenarien, Treiber, Bremsen)?

**Arbeitsweise:** Aktuelle Quellen bevorzugen (letzte 12–18 Monate), jede Quelle mit Datum und Link, Deutsch und Englisch, Primärquellen vor Sekundärquellen. Jede Aussage als Fakt / Schätzung / Meinung kennzeichnen. Keine erfundenen Zahlen — wenn nichts belegt ist, „nicht belegt“ schreiben.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (10 Kernaussagen mit Beleg)
2. Je Frage ein Kapitel mit Tabellen
3. TAM/SAM/SOM-Tabelle mit Annahmen
4. Persona-Steckbriefe
5. „Was das für MAKE OS heißt“: erste Zielgruppe (Empfehlung mit Begründung), Funktionen mit höchster Priorität, Verkaufsargumente, Risiken
6. Offene Fragen, die nur Interviews klären können (mit Interviewleitfaden, 10 Fragen)
7. Quellenliste (Titel, Herausgeber, Datum, Link)

--- PROMPT P1 ENDE ---

---

--- PROMPT P2 START ---

Du bist eine Produktstrategin und Wettbewerbsanalystin für Arbeits- und Produktivitätssoftware. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (unser Produkt):** MAKE OS ist eine Software, mit der ein einzelner Mensch sein Unternehmen und sein Privatleben in einem System steuert: Fokus & Zeit (Kalender, Ziele → Meilensteine → Aufgaben, Kapazitätsplanung, Routinen, Wochenplanung), Business (CRM, Vertrieb, Marketing, Events, Finanzplanung, Steuern, Gesellschaften), Privat (Haushaltsfinanzen, Gesundheit, Familie) und ein KI-Führungsteam (KI-Chief-of-Staff „ZOE“ plus KI-Abteilungsleiter), das vorschlägt, während der Mensch entscheidet. Eigene verschlüsselte Instanz je Kunde in Europa. Wir bauen ein „AI-CEO-Modul“ für Menschen, die ihr Unternehmen ohne Mitarbeiter mit KI führen und Privat + Business zusammen steuern.

**Ziel dieses Laufs:** Den Wettbewerb bei Arbeits-, Planungs- und Produktivitätssoftware mit KI vollständig kartieren und die Lücke für MAKE OS belegen.

**Untersuche mindestens:** Notion (inkl. Notion AI/Agents), ClickUp (Brain/Agents), Asana (AI Studio), Monday.com, Microsoft 365 Copilot (Planner/Loop), Google Workspace mit Gemini, Motion, Reclaim.ai, Sunsama, Akiflow, Amie, Morgen, Todoist, Things, TickTick, Superhuman, Shortwave, Fyxer, Linear (als Referenz für Qualität), Coda, Airtable — plus alle relevanten Neulinge 2025/2026 (bitte aktiv suchen).

**Beantworte ausführlich und mit Quellen:**
1. Funktionsmatrix: Kalender, Aufgaben, Ziele/OKR, Kapazitäts-/Zeitplanung, Wochenplanung, Routinen, CRM, Finanzen, Privatleben, KI-Agenten (was tun sie wirklich selbst?), Freigabe-Mechanismen, Gedächtnis, Integrationen, Mobil, Offline.
2. KI-Funktionen im Detail: Welche Agenten handeln eigenständig, welche schlagen nur vor? Wie lösen sie Vertrauen, Kontrolle, Rücknahme, Protokoll?
3. Preise (aktuell, je Edition, KI-Aufpreis), Preismodelle (Sitz, Verbrauch, Pauschale), Veränderungen 2025/2026.
4. Datenschutz und Betrieb: Datenstandort, EU-Option, eigene Instanz/Self-Hosting, Verschlüsselung, Zertifizierungen, AVV, Einstellungen zu KI-Training mit Kundendaten.
5. Zielgruppen und Positionierung (Wortlaut der Startseiten, Claims), Größe (Nutzer, Umsatz, Finanzierung, Bewertung — wo belegt).
6. Nutzerkritik: Was bemängeln Solo-Unternehmer an diesen Werkzeugen (G2, Capterra, Reddit, Product Hunt, Hacker News, YouTube-Rezensionen)? Häufigste Schmerzpunkte als Rangliste.
7. Welche Anbieter versuchen, Privat und Business zu verbinden? Wie gut, mit welcher Trennung?
8. Trends der Kategorie 2026–2028 (Agenten statt Apps, „Work OS“, Kalender als Steuerzentrale, KI-Planung) mit Belegen.
9. Lücke: Wo genau ist der freie Platz für „ein System für Unternehmen und Leben mit KI-Führungsteam, eigener Instanz und EU-Datenschutz“? Wer könnte ihn als Nächstes besetzen?
10. Was können wir von den Besten übernehmen (Bedienung, Onboarding, Preisgestaltung, Vorlagen, Community)? Konkrete Beispiele mit Screenshots-Beschreibung/Links.

**Arbeitsweise:** Aktuelle Quellen (letzte 12–18 Monate), jede Quelle mit Datum und Link, Deutsch und Englisch, Anbieterseiten und Preislisten direkt prüfen. Jede Aussage als Fakt / Schätzung / Meinung kennzeichnen. Keine erfundenen Zahlen — sonst „nicht belegt“.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (Lücke in 5 Sätzen + 10 Kernaussagen)
2. Große Vergleichstabelle (Anbieter × Funktionen × Preis × Datenschutz)
3. Steckbrief je Anbieter (Stärken, Schwächen, Preis, Zielgruppe, KI-Reife)
4. Rangliste der Nutzerschmerzen mit Belegen
5. Positionierungskarte (Achsen: Privat↔Business, Werkzeug↔Agenten-Team) mit Einordnung
6. „Was das für MAKE OS heißt“: Funktionen, die wir haben müssen; Funktionen, mit denen wir uns abheben; Verkaufsargumente gegen jeden Hauptwettbewerber („Warum MAKE OS statt X“)
7. Quellenliste

--- PROMPT P2 ENDE ---

---

--- PROMPT P3 START ---

Du bist Analystin für KI-Agenten und Automatisierungsplattformen. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (unser Produkt):** MAKE OS ist ein Betriebssystem für einen Menschen, der sein Unternehmen und sein Leben steuert. Es hat bereits ein KI-Führungsteam: einen KI-Chief-of-Staff (ZOE) und KI-Abteilungsleiter („Heads“) für Sales, Marketing, Events, Finance und IT — mit Regeln ohne KI als Rückfall, Prüfer (keine erfundenen Personen, erlaubte Kanäle, Werbesperren), Evals, Lernen aus Entscheidungen und Freigabe-Stapel (nichts mit Außenwirkung ohne Freigabe). Wir bauen ein „AI-CEO-Modul“: CEO-Cockpit, vollständiges KI-Führungsteam (auch Operations, Product, People, Strategy), Führungsrhythmus (Tag/Woche/Monat/Quartal), Entscheidungssystem, Delegation an Agenten und externe Menschen, Balance von Privat und Business. Eigene Instanz je Kunde, EU-Datenschutz.

**Ziel dieses Laufs:** Alle Anbieter kartieren, die „KI-Mitarbeiter“, Agenten-Teams oder Betriebssysteme für Gründer/CEOs anbieten, und herausfinden, wer dem AI-CEO-Gedanken am nächsten kommt.

**Untersuche mindestens:** Lindy, Relevance AI, Gumloop, n8n (inkl. AI Agents), Zapier Agents/Central, Make.com, Microsoft Copilot Studio/Agents, Salesforce Agentforce, Google Agentspace, OpenAI (Agents, Operator/ChatGPT Agent, GPTs), Anthropic (Claude, Projekte, Agenten-Funktionen), Sintra AI, Motion („AI Employees“), Artisan, 11x, Ema, Beam AI, CrewAI, Manus, Genspark, Devin (als Referenz), Personal-AI-Anbieter (z. B. Personal.ai, Rewind/Limitless, Granola), „Founder OS“/„CEO OS“-Startups — und **aktiv nach neuen Anbietern 2025/2026** suchen, die sich „AI CEO“, „AI COO“, „autonomous company“, „one-person company OS“ nennen.

**Beantworte ausführlich und mit Quellen:**
1. Steckbrief je Anbieter: Was tun die Agenten wirklich (Belege, Demos, unabhängige Tests), Autonomiegrad, Freigaben, Gedächtnis, Integrationen, Preis, Zielgruppe, Finanzierung.
2. Wer verkauft „ganze Abteilungen“ oder „ein Team“ statt einzelner Automatisierungen? Wie gut funktioniert das laut Nutzern?
3. Welche Probleme berichten Nutzer (Halluzinationen, Fehler mit Außenwirkung, Kosten, Wartungsaufwand, Vertrauensverlust)? Konkrete Vorfälle mit Quellen.
4. Wie lösen die Besten Kontrolle: Autonomiestufen, Freigaben, Protokolle, Rücknahme, Budgets, Evals?
5. Gibt es ein Produkt, das ein Unternehmen **und** das Privatleben einer Person mit Agenten führt? Wenn ja, wie weit ist es?
6. Wie entwickeln sich Preise und Geschäftsmodelle (pro Agent, pro Aufgabe, ergebnisbasiert, Sitz)?
7. Was sagen Investoren und Analysten (Gartner, Forrester, IDC, McKinsey, Sequoia, a16z, YC) zur Zukunft von „AI employees“ und „agentic enterprise“ für Kleinunternehmen?
8. Welche offenen Standards prägen die Kategorie (Model Context Protocol, Agent2Agent, OpenAI Agents SDK, Anthropic Agent SDK) und was heißt das für Anbindbarkeit?
9. Wo scheitern Agenten-Produkte bei Solo-Unternehmern typischerweise (Einrichtungsaufwand, „Werkzeugkasten statt Lösung“)?
10. Lücke und Bedrohung: Wer könnte MAKE OS kopieren oder überholen, und was wäre unser dauerhafter Vorsprung?

**Arbeitsweise:** Aktuelle Quellen (letzte 12–18 Monate), jede Quelle mit Datum und Link, Deutsch und Englisch, unabhängige Tests vor Herstellerangaben. Fakt / Schätzung / Meinung kennzeichnen. Keine erfundenen Zahlen.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (10 Kernaussagen)
2. Vergleichstabelle (Anbieter × Autonomie × Kontrolle × Preis × Zielgruppe × Datenschutz)
3. Steckbriefe
4. Liste dokumentierter Agenten-Fehler und wie man sie verhindert
5. „Muster der Besten“ für Kontrolle und Vertrauen
6. „Was das für MAKE OS heißt“: Was wir übernehmen, was wir besser machen, welche Abteilungen/Heads zuerst, Verkaufsargumente gegen Werkzeugkästen
7. Quellenliste

--- PROMPT P3 ENDE ---

---

--- PROMPT P4 START ---

Du bist Analystin für Verbraucher-Software rund um Gesundheit, Familie, persönliche Finanzen und persönliches Wissensmanagement. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (unser Produkt):** MAKE OS verbindet Unternehmen und Privatleben eines Menschen in einem System. Privat umfasst heute: Haushaltsfinanzen (Budget, Fixkosten, Runway), Gesundheit (Whoop-Daten, Routinen, Journal, Sport, Ernährung — nur mit ausdrücklicher Einwilligung), Familie & Partnerschaft (geteilte und „nur ich“-Bereiche), Kontakte, ein persönliches Wissensarchiv („Brain“ auf Obsidian-Basis) und einen KI-Chief-of-Staff. Business sieht nie Privates; Privat sieht das Business. Wir bauen ein „AI-CEO-Modul“, in dem Energie, Kapazität und geschützte Zeit für Familie und Gesundheit Führungsgrößen sind.

**Ziel dieses Laufs:** Verstehen, was es im Privat-Bereich gibt, und belegen, ob und warum die Verbindung von Privat und Business ein Kaufgrund ist.

**Untersuche mindestens:** Whoop, Oura, Garmin, Apple Health/Fitness, Google Fit/Fitbit, Ultrahuman; Familien-Organizer (Cozi, FamilyWall, OurHome, Maple, Ohai, Skylight); persönliche Finanzen (YNAB, Monarch, Copilot Money, Finanzguru, Outbank, Moneywiz, Buddy); Second Brain/Notizen (Obsidian, Reflect, Mem, Tana, Capacities, Notion Life-OS-Vorlagen, Heptabase); persönliche KI (Rewind/Limitless, Pi, ChatGPT-Gedächtnis, Gemini Personal Context, Apple Intelligence); „Life OS“-Angebote und Coaches — plus **neue Anbieter 2025/2026**.

**Beantworte ausführlich und mit Quellen:**
1. Was können diese Produkte, was kosten sie, wie viele Nutzer haben sie, wie gehen sie mit Daten um (insbesondere Gesundheitsdaten nach Art. 9 DSGVO)?
2. Gibt es Produkte, die Privatleben **und** Unternehmen verbinden? Wie trennen sie Daten, wie verkaufen sie das?
3. Welche Belege gibt es, dass Menschen mit eigenem Unternehmen Privat und Business gemeinsam planen wollen (Studien, Umfragen, Foren, Life-OS-Bewegung, Vorlagen-Verkäufe)?
4. Wie nutzen Menschen Gesundheits- und Erholungsdaten für die Arbeitsplanung (z. B. „Erholung niedrig → leichter Tag“)? Wirksamkeit laut Studien?
5. Familienkoordination: Welche Schmerzen haben Gründer mit Familie (Zeit, mentale Last, Kalender)? Was hilft nachweislich?
6. Persönliche Finanzen bei Selbstständigen: Vermischung mit Geschäftsfinanzen, Steuern, Runway — welche Werkzeuge lösen das, welche Lücke bleibt?
7. Second Brain und persönliches Gedächtnis mit KI: Trends, Datenschutz, Akzeptanz.
8. Was sind die größten Datenschutz- und Vertrauensbedenken bei solchen Daten, und welche Lösungen überzeugen Nutzer (lokal, eigene Instanz, Ende-zu-Ende)?
9. Trends 2026–2030 für persönliche KI, Gesundheitsdaten, Familien-Software.
10. Welche Funktionen im Privat-Bereich würden für AI CEOs den größten Unterschied machen (Rangliste mit Belegen)?

**Arbeitsweise:** Aktuelle Quellen (letzte 12–18 Monate), jede Quelle mit Datum und Link, Deutsch und Englisch, Studien vor Marketing. Fakt / Schätzung / Meinung kennzeichnen. Keine erfundenen Zahlen.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (10 Kernaussagen)
2. Vergleichstabellen je Kategorie
3. Belege für „Privat + Business zusammen“ (für und gegen)
4. Datenschutz- und Vertrauensmuster
5. „Was das für MAKE OS heißt“: Privat-Funktionen mit Priorität, wie wir die Verbindung zum Business verkaufen, was wir bewusst nicht bauen
6. Quellenliste

--- PROMPT P4 ENDE ---

---

--- PROMPT P5 START ---

Du bist eine führende Technologie-Analystin für künstliche Intelligenz mit Blick auf Produktstrategie. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (unser Produkt):** MAKE OS ist ein Betriebssystem für Menschen, die ihr Unternehmen ohne Mitarbeiter mit KI-Agenten führen und Privat + Business in einem System steuern. Es nutzt heute Claude-Modelle in drei Stufen (schnell/ausgewogen/stark), einen KI-Chief-of-Staff, KI-Abteilungsleiter mit Regeln-Rückfall ohne KI, Prüfer, Evals und Freigaben, eine lokale Wissensbasis mit Volltextsuche und Embeddings, Sprache, Kalender- und Mail-Anbindungen. Eigene Instanz je Kunde in Europa. Wir wollen heute so bauen, dass das Produkt in den nächsten Jahren mit der KI-Entwicklung **mitwächst** statt veraltet.

**Ziel dieses Laufs:** Eine belastbare, sehr ausführliche Analyse, wie sich KI 2026–2030 entwickelt und welche Trends wir **jetzt** in Architektur und Produkt einbauen müssen.

**Beantworte ausführlich und mit Quellen:**
1. **Fähigkeiten:** Wohin entwickeln sich Sprachmodelle bis 2030 (Schlussfolgern, lange Aufgaben, Planen, Werkzeugnutzung, Computer-Bedienung, Gedächtnis, Multimodalität, Sprache in Echtzeit)? Was sagen Benchmarks (z. B. METR-Messungen zur Länge autonom lösbarer Aufgaben, SWE-bench, GAIA, OSWorld) und die großen Labore (Anthropic, OpenAI, Google DeepMind, Meta, Mistral)?
2. **Kosten:** Wie entwickeln sich Preise je Token und je Aufgabe? Was wird praktisch kostenlos, was bleibt teuer? Folgen für Preismodelle von Software.
3. **Agenten:** Ab wann sind mehrstündige/mehrtägige autonome Agenten für Geschäftsaufgaben verlässlich? Welche Aufgaben eines Kleinunternehmens werden wann realistisch automatisierbar (Zeitleiste mit Unsicherheit)?
4. **Gedächtnis und Personalisierung:** Langzeitgedächtnis, persönliche Modelle, Kontextfenster, Abruf — Stand und Richtung.
5. **Lokal vs. Cloud:** Wie stark werden kleine/lokale/offene Modelle (Llama, Mistral, Qwen, Gemma usw.)? Was heißt das für Datenschutz-Positionierung und eigene Instanzen in Europa?
6. **Schnittstellen:** Sprache, Brillen/Wearables, Assistenten im Betriebssystem (Apple, Google, Microsoft), „Agent-zu-Agent“-Kommunikation, Protokolle (MCP, A2A). Welche Oberflächen verlieren, welche gewinnen?
7. **Plattformrisiko:** Werden große Anbieter (OpenAI, Google, Microsoft, Apple) Funktionen wie „KI-Chief-of-Staff“ selbst anbieten? Was bleibt für spezialisierte Anbieter (Daten, Vertrauen, Domäne, Arbeitsablauf, Regulierung)?
8. **Wirtschaft und Arbeit:** Prognosen zur Produktivität, zu Ein-Personen-Unternehmen, zu Berufen, die sich ändern (OECD, IMF, WEF, McKinsey, Stanford AI Index, Epoch AI) — mit Bandbreiten.
9. **Szenarien 2027/2028/2030:** drei Szenarien (langsam, erwartet, schnell) mit Kennzeichen, Wahrscheinlichkeit und Frühindikatoren, an denen wir erkennen, welches eintritt.
10. **Konkrete Bau-Empfehlungen:** Welche 15–20 Architektur- und Produktentscheidungen sollten wir **jetzt** treffen, damit MAKE OS mit jeder Modellgeneration besser wird (z. B. Modelle austauschbar kapseln, Evals als Fundament, Regeln-Rückfall, Daten- und Rechte-Schicht als Vorsprung, Gedächtnis in eigener Hand, Budgets, Protokolle)? Welche Fehler sollten wir vermeiden (Dinge bauen, die das nächste Modell gratis kann)?

**Arbeitsweise:** Aktuelle Quellen (letzte 12–18 Monate; Grundlagenarbeiten älter mit Hinweis), jede Quelle mit Datum und Link, Deutsch und Englisch, Primärquellen (Forschungsarbeiten, Labor-Veröffentlichungen, Benchmarks) vor Medien. Prognosen immer mit Urheber und Bandbreite. Keine erfundenen Zahlen.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (15 Kernaussagen)
2. Zeitleiste 2026–2030 (Tabelle: Fähigkeit × erwarteter Zeitpunkt × Sicherheit × Quelle)
3. Kapitel je Frage
4. Drei Szenarien mit Frühindikatoren
5. „Was das für MAKE OS heißt“: 15–20 Bau-Entscheidungen (Priorität, Aufwand, Begründung), Dinge, die wir nicht bauen sollten, Trends als Verkaufsargument („mitwachsend“)
6. Quellenliste

--- PROMPT P5 ENDE ---

---

--- PROMPT P6 START ---

Du bist eine Software-Architektin für KI-Agenten-Systeme in Produktion. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (unser Produkt):** MAKE OS (Next.js/TypeScript, verschlüsselte Bestände je Instanz, eigener Server in Europa) hat ein KI-Führungsteam: einen KI-Chief-of-Staff (ZOE) mit 36 Werkzeugen und KI-Abteilungsleiter („Heads“). Jeder Head: Datenpaket → Regeln-Grundlauf ohne KI → Modell-Lauf mit JSON-Schema → Prüfer (keine erfundenen Kennungen, erlaubte Kanäle, Werbesperre) → Freigabe-Stapel; Autonomie nur für Internes und Zurücknehmbares; deterministische Evals mit pass^k; Lernen aus angenommenen/abgelehnten Vorschlägen und gemessener Wirkung; Takt auf dem Server; KI-Protokoll nur mit Metadaten; Pseudonymisierung in automatischen Läufen. Wir wollen daraus einen allgemeinen „Head-Rahmen“ machen und das Team auf Operations, Product, People und Strategy ausweiten, mit Budgets je Head.

**Ziel dieses Laufs:** Den aktuellen Stand der besten Praxis für Agenten in Produktion zusammentragen und daraus eine Architektur-Empfehlung für unser Führungsteam ableiten.

**Beantworte ausführlich und mit Quellen:**
1. Orchestrierungsmuster: Einzelagent mit Werkzeugen vs. Mehr-Agenten (Supervisor, Hierarchie, Übergaben), Workflows vs. Agenten — was empfehlen Anthropic („Building effective agents“), OpenAI („A practical guide to building agents“), Google, Microsoft, LangChain/LangGraph, CrewAI? Wann lohnt sich was?
2. Evals für Agenten: Methoden (deterministische Prüfungen, Modell-als-Richter, pass^k, Regressionstests, Online-Bewertung), Werkzeuge (z. B. Braintrust, LangSmith, Langfuse, Arize, promptfoo, Inspect), beste Praxis für kleine Teams.
3. Autonomiestufen und menschliche Freigabe: Frameworks, Risikostufen, Muster für „Mensch entscheidet“ ohne Freigabe-Müdigkeit (Bündeln, Vorher/Nachher, Vertrauensaufbau, schrittweise mehr Autonomie).
4. Gedächtnis: Kurz-/Langzeitgedächtnis, Fakten vs. Episoden, Vergessen, Korrektur durch Nutzer, Datenschutz.
5. Werkzeuge und Protokolle: MCP, A2A, Funktionsaufrufe, strukturierte Ausgaben; Sicherheitsfragen (Prompt Injection über Mails/Webseiten, Rechte je Werkzeug, Sandbox). Bekannte Angriffe und Gegenmittel (OWASP Top 10 für LLM-Anwendungen, aktuelle Fälle).
6. Kostensteuerung: Modell-Routing, Caching (Prompt-Caching), Budgets, Abbruchregeln, Messung „Kosten je Ergebnis“.
7. Beobachtbarkeit und Nachweis: Tracing, Protokolle, Erklärbarkeit gegenüber Nutzern, Prüfpfade für Regulierung.
8. Zuverlässigkeit: Rückfälle ohne Modell, Wiederholungen, Idempotenz, Zeitpläne/Takt, Fehlerbudgets.
9. Lernen ohne Training: Rückmeldungen, Ablehnungsgründe, Beispiele im Kontext, automatische Prompt-Verbesserung (z. B. DSPy) — was funktioniert nachweislich?
10. Konkrete Architektur-Empfehlung für einen „Head-Rahmen“: Bausteine, Schnittstellen, Datenfluss, Tests, Rollout-Strategie; was wir weglassen sollten.

**Arbeitsweise:** Aktuelle Quellen (letzte 12–18 Monate), jede Quelle mit Datum und Link, Englisch und Deutsch, Primärquellen (Labor-Leitfäden, Forschungsarbeiten, Engineering-Blogs) vor Meinungsartikeln. Fakt / Schätzung / Meinung kennzeichnen.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (10 Kernaussagen)
2. Kapitel je Frage mit Mustern, Beispielen, Fallstricken
3. Tabelle „Risiko × Gegenmittel“ (Sicherheit, Zuverlässigkeit, Kosten)
4. Referenz-Architektur für den Head-Rahmen (Text-Diagramm + Komponenten)
5. „Was das für MAKE OS heißt“: priorisierte Bauliste (Must/Should/Could), Evals-Plan, Sicherheits-Checkliste
6. Quellenliste

--- PROMPT P6 ENDE ---

---

--- PROMPT P7 START ---

Du bist eine Expertin für europäisches Digitalrecht, Datenschutz und Informationssicherheit mit Praxis in Software-Produkten. Führe eine gründliche, belegte Tiefenrecherche durch (keine Rechtsberatung, aber präzise mit Fundstellen). Heute ist Oktober 2026.

**Kontext (unser Produkt):** MAKE OS ist eine Software aus Deutschland, mit der Einzelpersonen ihr Unternehmen und Privatleben führen; jede Kundin, jeder Kunde bekommt eine eigene, verschlüsselte Instanz auf einem Server in Deutschland. Verarbeitet werden u. a. Geschäftskontakte (CRM, Newsletter, Events), Finanz- und Steuerdaten, Kalender und Mails, Gesundheitsdaten (Art. 9, nur mit ausdrücklicher Einwilligung je Zweck), Familiendaten. KI: Anthropic (USA) als Modell-Anbieter, KI-Agenten schlagen vor, Menschen entscheiden; KI-Protokoll, Pseudonymisierung, KI-Kennzeichnung, Auskunft/Export/Löschung, Verzeichnis nach Art. 30, Pannen-Register, Hash-verkettete Protokolle sind gebaut. Wir bauen ein „AI-CEO-Modul“ mit KI-Abteilungsleitern, Delegation an externe Menschen (z. B. Steuerberater) und Balance-Steuerung.

**Ziel dieses Laufs:** Vollständige Übersicht, was rechtlich Pflicht ist, wo Risiken liegen und wie wir Recht, Datenschutz und Sicherheit zum **Verkaufsargument** machen.

**Beantworte ausführlich und mit Fundstellen:**
1. **KI-Verordnung (EU AI Act):** aktueller Zeitplan der Pflichten (inkl. etwaiger Verschiebungen/„Digital Omnibus“ 2025/2026), Einstufung eines solchen Produkts (Risikoklassen), Transparenzpflichten (Art. 50), Pflichten als Anbieter/Betreiber von KI-Systemen und bei Nutzung von GPAI-Modellen, KI-Kompetenz (Art. 4). Was gilt für uns konkret, ab wann?
2. **DSGVO:** Art. 6, 9 (Gesundheit), 13/14 (Information), 15–22 (Rechte, insbesondere Art. 22 automatisierte Entscheidungen), 25 (Datenschutz durch Technik), 28 (AVV), 30, 32, 33/34, 35 (DSFA). Wann ist eine DSFA Pflicht? Rolle Verantwortlicher vs. Auftragsverarbeiter, wenn wir Instanzen für Kunden betreiben.
3. **Drittlandübermittlung USA:** EU-US Data Privacy Framework (aktueller Stand, Klagen), Standardvertragsklauseln, Zero-Data-Retention-Optionen der KI-Anbieter, EU-Rechenzentren der Anbieter (Anthropic, OpenAI, Google, Microsoft, Mistral) — was ist heute möglich?
4. **Deutsches Recht:** § 7 UWG (Werbung per Mail), TDDDG, § 26 BDSG/Beschäftigtendaten bei kleinen Teams, Datenschutzbeauftragter (§ 38 BDSG), Berufsrecht/Steuerberatungsgesetz bei Finanz- und Steuerfunktionen (Abgrenzung erlaubte Software vs. unerlaubte Hilfeleistung in Steuersachen), GoBD bei Buchungen/Belegen.
5. **Haftung:** Wer haftet, wenn ein Agent mit Freigabe/ohne Freigabe Fehler macht (Produkthaftungsrichtlinie neu 2024/2026 für Software, vertragliche Haftung, AGB-Gestaltung)?
6. **Cyber Resilience Act und NIS2:** Gilt das für uns, ab wann, was ist zu tun?
7. **Sicherheitsstandards als Verkaufsargument:** ISO 27001, BSI C5, BSI IT-Grundschutz, TISAX (irrelevant?), SOC 2 — was erwarten Kleinunternehmen und ihre Steuerberater, was ist mit wenig Aufwand erreichbar?
8. **Gesundheitsdaten:** Grenzen für Wellbeing-Funktionen (kein Medizinprodukt nach MDR), Einwilligungsgestaltung, Weitergabe an Partner.
9. **Vertrauen:** Welche Datenschutz- und Sicherheitsmerkmale entscheiden laut Studien über Kauf und Wechsel bei KI-Software in DACH (Bitkom, eco, BSI, Umfragen)?
10. **Checkliste:** Was müssen wir vor dem Verkauf an die ersten Kunden haben (Dokumente, Verträge, technische Maßnahmen), was später?

**Arbeitsweise:** Aktuelle Quellen (letzte 12–18 Monate; Gesetzestexte in aktueller Fassung), jede Quelle mit Datum und Link (EUR-Lex, gesetze-im-internet.de, EDPB, DSK, BfDI, Landesdatenschutzbehörden, BSI, Kommission), Fachliteratur und Kanzlei-Analysen mit Angabe. Unsicherheiten offen benennen.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (10 Pflichten, 5 Risiken, 5 Verkaufsargumente)
2. Kapitel je Frage mit Fundstellen
3. Zeitleiste der Pflichten 2025–2028
4. Checkliste „vor dem ersten Kunden“ / „im ersten Jahr“ / „später“
5. „Was das für MAKE OS heißt“: Funktionen, die Recht erfüllen und zugleich verkaufen; Formulierungen für Website und Vertrieb (rechtssicher vorsichtig)
6. Quellenliste

--- PROMPT P7 ENDE ---

---

--- PROMPT P8 START ---

Du bist eine Forscherin für Arbeitspsychologie, Unternehmertum und Leistungsfähigkeit. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (unser Produkt):** MAKE OS hilft Menschen, die ihr Unternehmen ohne oder fast ohne Mitarbeiter mit KI führen („AI CEO“), Unternehmen und Privatleben zusammen zu steuern. Funktionen heute: Fokus-Blöcke, Wochenplanung, Kapazitätsplanung (machbar/eng/nicht machbar), Routinen, Gesundheitsdaten (Whoop: Erholung, HRV, Schlaf — nur mit Einwilligung), Familienbereiche, ein KI-Chief-of-Staff, der morgens und abends bündelt, und Freigaben gesammelt statt ständiger Unterbrechungen. Wir wollen Balance (Energie, Kapazität, geschützte Zeit) zu einer **Führungsgröße** machen — ohne zu bevormunden.

**Ziel dieses Laufs:** Wissenschaftlich belegen, welche Funktionen Leistung **und** Wohlbefinden von Solo-Unternehmern wirklich verbessern, und wie KI die Arbeit dieser Menschen in den nächsten Jahren verändert.

**Beantworte ausführlich und mit Quellen:**
1. Belastung von Gründern und Solo-Selbstständigen: Burnout, Stress, Einsamkeit, Entscheidungsmüdigkeit — aktuelle Studien und Zahlen (DACH, international).
2. Aufmerksamkeit und Fokus: Kosten von Unterbrechungen, Kontextwechsel, Deep Work, Bündeln von Entscheidungen — was ist belegt, was ist Mythos?
3. Planung: Wirkung von Wochenplanung, Zeitblöcken, Implementation Intentions, Kapazitätsgrenzen, Planungsfehlschluss — Belege und Effektgrößen.
4. Erholung und Leistung: Zusammenhang Schlaf/HRV/Erholung und Entscheidungsqualität/Produktivität; Nutzen und Risiken von Wearables (Orthosomnie, Datenangst).
5. Grenzen zwischen Arbeit und Privatleben: Segmentierung vs. Integration (Boundary Theory), was hilft Selbstständigen mit Familie?
6. KI und Arbeit: Studien zu Produktivität, Qualität, Kompetenzverlust („deskilling“), Vertrauen, Überwachung, „Automation Bias“ — was heißt das für einen KI-Chief-of-Staff?
7. Menschliche Kontrolle: Wie gestaltet man Freigaben, damit Menschen nicht blind bestätigen (Ermüdung, Automation Complacency)? Belegte Gestaltungsprinzipien.
8. Motivation und Gewohnheiten: Was hält Menschen dauerhaft in einer Software und in guten Gewohnheiten (Selbstbestimmungstheorie, Gewohnheitsforschung), ohne manipulative Muster?
9. Wie verändert sich die Arbeit von Solo-Unternehmern mit KI bis 2030 (Rollen, Fähigkeiten, Zeitverwendung)?
10. Konkrete, belegte Funktionsprinzipien für „Balance als Führungsgröße“ (Rangliste mit Evidenzstärke).

**Arbeitsweise:** Peer-reviewte Studien und Metaanalysen bevorzugen, Effektgrößen nennen, aktuelle Arbeiten (letzte 3–5 Jahre) mit Grundlagenarbeiten ergänzen, jede Quelle mit Datum und Link (DOI). Evidenzstärke je Aussage (hoch/mittel/gering). Populärliteratur nur mit Hinweis.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (10 Kernaussagen mit Evidenzstärke)
2. Kapitel je Frage
3. Tabelle „Funktion × Wirkung × Evidenz × Risiko“
4. „Was das für MAKE OS heißt“: Gestaltungsregeln für Cockpit, Freigaben, Balance, ZOE-Sprache; was wir nie tun sollten; Verkaufsargumente mit Beleg („Wissenschaft hinter MAKE OS“)
5. Quellenliste

--- PROMPT P8 ENDE ---

---

--- PROMPT P9 START ---

Du bist eine SaaS-Geschäftsmodell- und Preisstrategin mit Schwerpunkt KI-Produkte für Kleinunternehmen. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (unser Produkt):** MAKE OS wird als **eigene Instanz je Kunde** betrieben (eigener Container, eigene Schlüssel, eigene Sicherung, Server in Deutschland), nicht als gemeinsames SaaS. Geplante Editionen: „Markttraktion“ (CRM/Vertrieb/Marketing/Events mit KI-Abteilungsleitern), „MAKE OS“ (Fokus & Zeit, Business, Privat, KI-Chief-of-Staff), „AI CEO“ (alles + CEO-Cockpit + vollständiges KI-Führungsteam + Playbooks). Lizenzen sollen signiert und offline prüfbar sein; nach Ablauf nur lesen, nie Daten sperren. KI-Kosten entstehen pro Nutzung (Claude-Modelle in drei Stufen). Dazu bietet die MAKE Innovation GmbH Beratung/Einrichtung und Event-Formate an.

**Ziel dieses Laufs:** Ein belastbares Geschäftsmodell mit Preisen, Kostenrechnung und Kennzahlen.

**Beantworte ausführlich und mit Quellen:**
1. Preismodelle für KI-Software 2025/2026: Sitz, Verbrauch, Kredite, ergebnisbasiert, Pauschale mit Fair-Use, Hybrid — Beispiele und Erfahrungen (Intercom Fin, Salesforce Agentforce, Zapier, Notion, ClickUp, Lindy, Cursor u. a.).
2. Preise der Vergleichskategorien (Produktivität, CRM, Buchhaltung, KI-Assistenten, Agenten-Plattformen) für Solo-/Kleinstunternehmen in DACH/EU/USA — Tabelle mit Stand und Quelle.
3. Kosten der KI je Nutzer: realistische Token-Mengen für Chief-of-Staff + Abteilungsleiter mit Morgen-/Abendläufen, Kostenentwicklung, Caching, Modell-Routing — Rechenbeispiele.
4. Kosten einer eigenen Instanz je Kunde (Server, Sicherung, Überwachung, Support) vs. Mehrmandanten-SaaS; ab wie vielen Kunden lohnt Automatisierung; Beispiele von Anbietern mit „dedicated instance“/Self-Hosting-Modellen.
5. Kennzahlen-Benchmarks für SMB-Software: Bruttomarge (inkl. KI-Kosten), Kundengewinnungskosten, Abwanderung, Netto-Umsatzbindung, Amortisationszeit — aktuelle Reports (OpenView, KeyBanc, ChartMogul, Paddle/ProfitWell, Bessemer).
6. Zahlungsbereitschaft von Solo-Unternehmern für „KI-Mitarbeiter“ bzw. ein „Betriebssystem fürs Unternehmen“: Studien, Preistests, Anker (z. B. Kosten einer Assistenz/Teilzeitkraft).
7. Dienstleistung + Software: Wie kombinieren erfolgreiche Anbieter Einrichtung/Beratung mit Software (Marge, Skalierung, Abhängigkeit)?
8. Lizenz- und Vertragsgestaltung: Jahres- vs. Monatsverträge, Testphasen, Pilotpreise, Rabatte, Kündigung, Datenexport als Vertrauensmerkmal.
9. Finanzierung: Bootstrapping vs. Wagniskapital für diese Kategorie; was Investoren 2026 bei KI-Anwendungen sehen wollen (Kennzahlen, Defensibilität).
10. Konkreter Vorschlag: Preisliste je Edition (Monat/Jahr), Einrichtungspaket, KI-Budget-Regel, Pilotangebot — mit Unit-Economics-Rechnung (Tabelle) und Sensitivität (KI-Kosten ±50 %, Abwanderung ±50 %).

**Arbeitsweise:** Aktuelle Quellen (letzte 12–18 Monate), jede Quelle mit Datum und Link, Anbieter-Preisseiten direkt prüfen, Benchmarks mit Stichprobe/Herkunft. Fakt / Schätzung / Meinung kennzeichnen; Rechnungen mit offengelegten Annahmen.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (Empfehlung in 10 Punkten)
2. Kapitel je Frage mit Tabellen
3. Unit-Economics-Modell (Tabelle, Annahmen, Sensitivität)
4. „Was das für MAKE OS heißt“: Preisliste, Editionen, Lizenzregeln, Pilotangebot, Kennzahlen-Ziele Jahr 1/2/3
5. Quellenliste

--- PROMPT P9 ENDE ---

---

--- PROMPT P10 START ---

Du bist eine Go-to-Market- und Markenstrategin für B2B-Software im DACH-Raum mit Erfahrung bei Solo- und Kleinunternehmern. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (unser Produkt und Unternehmen):** MAKE OS ist das Betriebssystem für „AI CEOs“: Menschen, die ihr Unternehmen ohne oder fast ohne Mitarbeiter mit einem KI-Führungsteam führen und Privat + Business in einem System steuern — mit eigener, verschlüsselter Instanz in Deutschland und „Mensch entscheidet“ als Grundsatz. Anbieter ist die MAKE Innovation (Marke der KEMARIS Innovation GmbH, künftig MAKE Innovation GmbH, gehalten von KD Ventures), Gründer Kevin Dieckmann und Malin. Wir nutzen das Produkt selbst und führen damit zwei Gesellschaften. Kanäle heute: eigene Event-Reihe „Fokus Innovation“ (Make.One-Abende in mehreren Städten, Gespräche am Tisch), Netzwerk, Website makeinnovation.de. Markenbild: seriös (80 %), wenige futuristische Akzente (20 %), klare Linien.

**Ziel dieses Laufs:** Den besten Weg finden, MAKE OS im DACH-Raum extrem gut zu positionieren und zu verkaufen — erst an die ersten 10, dann an die ersten 100 und 1.000 Kunden.

**Beantworte ausführlich und mit Quellen:**
1. Wo erreicht man Solo-Unternehmer, Berater, Coaches, Agenturinhaber und Gründer im DACH-Raum (Communities, Verbände wie VGSD/BVMW/IHK, Coworkings, Podcasts, LinkedIn, Newsletter, Events, Steuerberater-/Berater-Netzwerke, Plattformen)? Reichweite und Wirkung mit Belegen.
2. Welche Go-to-Market-Strategien funktionieren 2025/2026 für KI-Software an Kleinunternehmen (produktgeführt vs. vertriebsgeführt vs. community-/eventgeführt, Gründer als Gesicht, „Build in Public“)? Fallbeispiele aus DACH und international mit Zahlen.
3. Events als Vertriebskanal: Wie wandeln erfolgreiche Anbieter Abende/Workshops in Kunden um (Formate, Nachfassen, Quoten)?
4. Positionierung und Botschaft: Welche Begriffe und Versprechen ziehen bei der Zielgruppe („AI CEO“, „Betriebssystem“, „KI-Team“, „Chief of Staff“, „Fokus“, „Privat und Business“)? Was wirkt abschreckend (Hype, Überwachung, Kontrollverlust)? Belege aus Umfragen, Suchvolumen, Social Listening.
5. Kategorie gestalten: Lohnt es sich, eine eigene Kategorie zu prägen („Plattform für AI CEOs“)? Beispiele erfolgreicher Kategorie-Schöpfung und Risiken.
6. Vertrauen verkaufen: Wie nutzen Anbieter Datenschutz, „Made in Germany“, eigene Instanz, Zertifikate und Transparenz im Vertrieb — was wirkt nachweislich?
7. Partner und Multiplikatoren: Steuerberater, Unternehmensberater, Coaches, Banken, Gründerzentren, Hochschulen — Partnerprogramme, Provisionen, Beispiele.
8. Beweise: Wie bauen erfolgreiche Anbieter Fallstudien, Demos (Demo-Instanz mit erfundenen Daten), Vorher/Nachher-Belege und Empfehlungen auf?
9. Startplan: Ein konkreter 90-Tage-Plan und ein 12-Monats-Plan für den Markteintritt (Pilotkunden, Inhalte, Events, Website, Kennzahlen je Stufe).
10. Investoren- und Presse-Geschichte: Wie erzählt man „AI CEO“ glaubwürdig, welche Medien/Investoren in DACH interessieren sich dafür?

**Arbeitsweise:** Aktuelle Quellen (letzte 12–18 Monate), jede Quelle mit Datum und Link, Deutsch und Englisch, Fallbeispiele mit Zahlen vor allgemeinen Ratschlägen. Fakt / Schätzung / Meinung kennzeichnen. Keine erfundenen Zahlen.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (10 Empfehlungen)
2. Kapitel je Frage mit Tabellen
3. Kanal-Bewertung (Kanal × Reichweite × Kosten × Wirkung × Aufwand)
4. Botschafts-Rahmen: Kernbotschaft, 3 Belege, Einwandbehandlung, Wortwahl (do/don't)
5. 90-Tage- und 12-Monats-Plan
6. „Was das für MAKE OS heißt“: Vertriebs- und Markenentscheidungen, Website-Aufbau, Event-Formate, Partnerprogramm
7. Quellenliste

--- PROMPT P10 ENDE ---

---

--- PROMPT P12 START ---

Du bist eine Forscherin für Kundenverständnis (Jobs-to-be-done, qualitative Marktforschung, Social Listening) mit Schwerpunkt Solo- und Kleinunternehmer. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (unser Produkt):** MAKE OS ist ein Betriebssystem für Menschen, die ihr Unternehmen ohne oder fast ohne Mitarbeiter mit KI führen („AI CEO“) und Privat + Business in einem System steuern: Fokus & Zeit (Kalender, Ziele → Meilensteine → Aufgaben, Kapazität), Business (CRM, Vertrieb, Marketing, Events, Finanzplanung, Steuern), Privat (Haushaltsfinanzen, Gesundheit, Familie), ein KI-Chief-of-Staff und KI-Abteilungsleiter, die vorschlagen, während der Mensch entscheidet. Eigene verschlüsselte Instanz je Kunde in Deutschland. Geplant: CEO-Cockpit, vollständiges KI-Führungsteam, Führungsrhythmus, Delegation, Balance als Führungsgröße.

**Ziel dieses Laufs:** Die **echte Stimme der Zielgruppe** einfangen — in ihren eigenen Worten —, damit wir (a) die Funktionen in der richtigen Reihenfolge bauen und (b) mit der Sprache verkaufen, die Kunden selbst benutzen. Keine Analystenmeinungen, sondern belegte Aussagen von Betroffenen.

**Quellen, die du systematisch auswerten sollst:** Reddit (z. B. r/Entrepreneur, r/solopreneur, r/smallbusiness, r/freelance, r/productivity, r/Notion, r/ObsidianMD, r/ChatGPT, r/ClaudeAI, r/AI_Agents, r/selbststaendig, r/de_EDV), Hacker News, Indie Hackers, Product Hunt-Kommentare, G2/Capterra/Trustpilot-Bewertungen (Notion, ClickUp, Motion, Reclaim, Sunsama, Lindy, HubSpot, Pipedrive, lexoffice, sevDesk, YNAB, Whoop), YouTube-Kommentare unter „AI solopreneur“/„one person business“-Videos, LinkedIn-Beiträge, deutschsprachige Foren und Gruppen (Gründerszene, t3n-Kommentare, VGSD, Facebook-/Xing-Gruppen für Selbstständige), Podcasts mit Solo-Gründern, veröffentlichte Interview-Studien.

**Beantworte ausführlich, jeweils mit wörtlichen Zitaten (Original + deutsche Übersetzung, Quelle, Datum, Link):**
1. **Jobs-to-be-done:** Welche Aufgaben will ein AI CEO „erledigt haben“ — funktional (z. B. „nie wieder einen Lead vergessen“), emotional („abends abschalten können“), sozial („professionell wirken, obwohl ich allein bin“)? Rangliste nach Häufigkeit und Dringlichkeit.
2. **Schmerzen in ihren Worten:** Die 30 häufigsten Klagen über Arbeit, Werkzeuge, KI, Zeit, Geld, Familie — mit Zitaten und Häufigkeitsschätzung (Methode offenlegen).
3. **Werkzeug-Müdigkeit:** Wie viele Werkzeuge nutzen sie, was nervt am Zusammenstecken (Zapier-Ketten, Notion-Vorlagen), wann geben sie auf?
4. **Wechselauslöser:** Was bringt Menschen dazu, ein neues System auszuprobieren (Ereignisse wie Gründung, Kind, Burnout, erster großer Kunde, Steuer-Schock)? Was hält sie beim alten (Datenumzug, Lernaufwand, Vertrauen)?
5. **Abbruchgründe:** Warum verlassen Menschen Produktivitäts- und KI-Werkzeuge nach Tagen/Wochen (Einrichtungsaufwand, zu viel Pflege, KI-Fehler, Preis)? Zitate und Muster.
6. **KI-Vertrauen:** Was sagen Solo-Unternehmer über KI-Agenten — Begeisterung, Angst, schlechte Erfahrungen, Grenzen („das würde ich nie automatisieren“)? Wo wollen sie Kontrolle, wo Entlastung?
7. **Privat + Business:** Wie sprechen sie über die Vermischung (Kalender, Geld, Steuern, Familie, Gesundheit)? Wünschen sie ein gemeinsames System oder strikte Trennung — und warum?
8. **Aha-Moment und Wert:** Welche Erlebnisse beschreiben Nutzer als „das hat mein Arbeiten verändert“ bei vergleichbaren Produkten? Daraus: Hypothesen für unseren Aha-Moment in den ersten 10 Minuten / 7 Tagen.
9. **Kaufsprache:** Welche Wörter und Bilder benutzen sie selbst (z. B. „Kopf frei“, „Überblick“, „Chief of Staff“, „zweites Gehirn“, „Betriebssystem“, „AI CEO“)? Welche Begriffe wirken abschreckend? Unterschiede DACH vs. USA.
10. **Funktionswert:** Bewerte unsere geplanten Bausteine (CEO-Cockpit, KI-Abteilungsleiter, Freigabe-Stapel, Führungsrhythmus, Kapazitätsplanung, Balance/Energie, Finanzplanung mit Privat, CRM/Vertrieb, Events, eigene Instanz/Datenschutz) nach Kano-Logik (Basis / Leistung / Begeisterung / egal / abschreckend) — begründet mit Zitaten.

**Arbeitsweise:** Nur echte, verlinkte Aussagen; keine erfundenen Zitate (wenn du ein Zitat nicht wörtlich belegen kannst, kennzeichne es als Zusammenfassung). Aktuelle Quellen (letzte 12–18 Monate) bevorzugen, Datum je Quelle. Deutsch und Englisch getrennt auswerten. Häufigkeiten als Schätzung mit Methode kennzeichnen.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (10 Erkenntnisse, die uns überraschen sollten)
2. Jobs-to-be-done-Karte (funktional / emotional / sozial) mit Rangliste
3. Schmerz-Rangliste mit Zitaten
4. Wechsel- und Abbruch-Muster (Tabelle: Auslöser × Häufigkeit × Zitat)
5. Kano-Tabelle unserer Bausteine
6. Wörterbuch der Kundensprache (sagen sie / sagen sie nicht / wirkt abschreckend), DACH und USA getrennt
7. Aha-Moment-Hypothesen + Test-Ideen
8. „Was das für MAKE OS heißt“: Reihenfolge der Funktionen (begründet), Onboarding-Ablauf, 5 Website-Überschriften in Kundensprache, 10 Interviewfragen für Pilotkunden
9. Quellenliste

--- PROMPT P12 ENDE ---

---

--- PROMPT P13 START ---

Du bist eine Beraterin für Unternehmensaufbau von Software-Firmen (0 → 1 → 100 Kunden) mit Erfahrung in KI-Anwendungen, kleinen Teams und Betrieb vieler Kunden-Instanzen. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (wir):** Zwei Gründer (Kevin und Malin), MAKE Innovation (Marke der KEMARIS Innovation GmbH, künftig MAKE Innovation GmbH), bauen MAKE OS — das Betriebssystem für „AI CEOs“ (Unternehmen ohne Mitarbeiter mit KI-Führungsteam, Privat + Business in einem System). Das Produkt läuft bereits produktiv für uns selbst (rund 70 Seiten, 250 Schnittstellen, 5.400 automatische Tests, eigener Server in Deutschland), gebaut mit KI-Programmier-Agenten. Betrieb als **eigene Instanz je Kunde**. Geplant: AI-CEO-Modul in Phasen (Plattform-Schulden → CEO-Cockpit → KI-Führungsteam → Delegation → Balance → Instanz-Fabrik, Lizenzen, Demo, 3–5 Piloten → Markt). Eigene Event-Reihe „Fokus Innovation“ als Bühne.

**Ziel dieses Laufs:** Aus echten Fallstudien ableiten, **in welcher Reihenfolge** wir bauen, testen, verkaufen und betreiben sollten — mit Meilensteinen, Kennzahlen und Abbruchkriterien —, damit unser Fahrplan belastbar ist.

**Beantworte ausführlich und mit Quellen:**
1. **Fallstudien 0 → 100 Kunden:** Analysiere 10–15 vergleichbare Unternehmen (KI-Anwendungen für Kleinunternehmen, Produktivitäts-/Planungs-Software, vertikale SaaS, „AI employees“, Produkte mit eigener Instanz/Self-Hosting — z. B. Motion, Reclaim, Sunsama, Superhuman, Linear, Notion früh, Lindy, Fyxer, Granola, Basecamp/HEY, Plausible, Cal.com, Nextcloud, n8n, deutsche Beispiele wie Personio/lexoffice/sevDesk in der Frühphase). Je Fall: Ausgangslage, erste 10 Kunden (woher, wie), Zeit bis 100 Kunden, was zuerst gebaut wurde, was weggelassen wurde, Preis am Anfang, größte Fehler, Wendepunkte.
2. **Reihenfolge:** Welche Muster zeigen die Fälle — erst eine Edition/ein Kernproblem oder sofort Plattform? Wann Onboarding automatisieren, wann Preise erhöhen, wann Partner? Belegte „Gesetze“ der Frühphase (z. B. „Do things that don't scale“, Concierge-Onboarding, Design-Partner).
3. **Pilot- und Design-Partner-Programme:** Auswahl, Vertrag, Preis, Feedback-Rhythmus, Erfolgskriterien, Übergang zu zahlenden Kunden — beste Praxis mit Beispielen.
4. **Meilensteine und Kennzahlen je Stufe:** Was sind belastbare Schwellen (Aktivierung, wöchentliche Nutzung, Bindung nach 4/12 Wochen, Weiterempfehlung, Umsatz) für „weiter zur nächsten Stufe“ — und Abbruch-/Umsteuer-Kriterien? Benchmarks mit Quellen.
5. **Kleines Team + KI-Programmierung:** Wie arbeiten 1–3-Personen-Softwarefirmen 2025/2026 mit KI-Coding-Agenten produktiv (Qualitätssicherung, Tests, Reviews, Release-Takt, technische Schulden, Support)? Belege, Erfahrungsberichte, Risiken.
6. **Viele Kunden-Instanzen betreiben:** Wie organisieren Anbieter mit eigener Instanz je Kunde Bereitstellung, Updates (gestaffelt), Überwachung, Sicherung, Notfall, Support, Kosten — ab wann lohnt welche Automatisierung (Instanz-Fabrik)? Beispiele (z. B. Nextcloud-Partner, Plausible, Mattermost, GitLab Dedicated, Basecamp ONCE).
7. **Onboarding und Aktivierung:** Was führt bei komplexen „Betriebssystem“-Produkten zur schnellen Aktivierung (Vorlagen/Playbooks, geführte Einrichtung, Import, Concierge, Demo-Daten)? Belegte Zahlen.
8. **Bindung:** Was hält Kunden bei Alltags-Software dauerhaft (Rituale, tägliche Berichte, Wechselkosten durch Daten, Gemeinschaft)? Was davon ist fair, was manipulativ?
9. **Typische Todesursachen** junger Software-Firmen dieser Art (zu breit, zu früh skaliert, kein Kanal, Support erdrückt das Team, KI-Kosten) — mit Beispielen und Frühwarnzeichen.
10. **Fahrplan-Vorlage:** Leite einen konkreten Stufenplan für MAKE OS ab: Stufe 0 „Kunde 0 (wir)“, Stufe 1 „3–5 Design-Partner“, Stufe 2 „10 zahlende Kunden“, Stufe 3 „100 Kunden“, Stufe 4 „1.000 Kunden“ — je Stufe Ziel, Produktumfang, Vertrieb, Betrieb, Team, Kennzahlen, Eintrittskriterium, Abbruchkriterium, typische Dauer laut Fallstudien.

**Arbeitsweise:** Primärquellen bevorzugen (Gründer-Interviews, Blogposts der Firmen, Podcasts, Vorträge, Geschäftsberichte), aktuelle Quellen (letzte 12–18 Monate) für Methoden, ältere für Fallgeschichten mit Datum. Jede Quelle mit Datum und Link. Fakt / Schätzung / Meinung kennzeichnen. Keine erfundenen Zahlen.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (10 Gesetze der Frühphase, belegt)
2. Fallstudien-Tabelle (Firma × erste Kunden × Zeit bis 100 × Erstes Produkt × Fehler × Wendepunkt) + Steckbriefe
3. Muster und Gegenmuster
4. Kennzahlen-Schwellen je Stufe (Tabelle mit Quellen)
5. Betriebsmodell für viele Instanzen (Ablauf, Werkzeuge, Kosten, Automatisierungsstufen)
6. Arbeitsweise kleines Team + KI-Programmierung (Regeln, Risiken)
7. **Fahrplan-Vorlage für MAKE OS** (Stufen 0–4, Tabelle) + 90-Tage-Plan für Stufe 1 im Wochenraster
8. Frühwarnzeichen und Abbruchkriterien
9. Quellenliste

--- PROMPT P13 ENDE ---

---

--- PROMPT P14 START ---

Du bist eine Produktmanagerin für Integrationen und Software-Ökosysteme im DACH-Mittelstand und bei Selbstständigen. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (unser Produkt):** MAKE OS ist das Betriebssystem für „AI CEOs“ (Unternehmen ohne Mitarbeiter mit KI-Führungsteam, Privat + Business in einem System), eigene verschlüsselte Instanz je Kunde in Deutschland. Heute angebunden: Microsoft 365 (Mail, Kalender), Google (Kalender, Gmail, OAuth je Person), Apple (Kalender, Erinnerungen, Kontakte über einen Mac-Zulieferer), Whoop, Telegram, Miro. Selbst gebaut: CRM, Rechnungen/Zahlungen, Buchungen, Belege, Finanzplanung mit Steuern (ESt, GewSt, KSt, USt), Liquidität. Nicht angebunden: Banken, DATEV, Buchhaltungssoftware, E-Rechnung, digitale Signatur, Zahlungsanbieter. Das geplante AI-CEO-Modul soll auch externe Menschen (z. B. den Steuerberater) sauber einbinden.

**Ziel dieses Laufs:** Herausfinden, welche Integrationen ein AI CEO im DACH-Raum **zwingend** braucht, welche Wettbewerbsvorteile bringen, wie man sie technisch und rechtlich baut — und was wir bewusst selbst lösen.

**Beantworte ausführlich und mit Quellen:**
1. **Steuerberater-Ökosystem:** DATEV (Unternehmen online, DATEV-Schnittstellen/Marktplatz, Belegtransfer, Buchungsdatenservice, Partnerprogramm, Voraussetzungen, Kosten, Dauer der Zertifizierung), Alternativen (Agenda, Addison, Stotax). Was erwarten Steuerberater von einer Software ihrer Mandanten? Wie viele Selbstständige arbeiten mit DATEV-Kanzleien?
2. **Banken:** Kontoanbindung über PSD2/XS2A-Aggregatoren (finAPI, Tink, GoCardless Bank Account Data, Plaid EU, Salt Edge, Yapily) und FinTS/HBCI; Kosten, Lizenz (Kontoinformationsdienst nach ZAG), Datenschutz, Abdeckung deutscher Banken (Sparkassen, Volksbanken, Neobanken wie Qonto, Kontist, Finom, N26).
3. **Buchhaltung und Rechnungen:** lexoffice/Lexware Office, sevDesk, Debitoor, Billomat, FastBill, Candis, BuchhaltungsButler — APIs, Marktanteile bei Solo-Selbstständigen, was man anbinden statt nachbauen sollte.
4. **E-Rechnung:** Pflichten in Deutschland seit 2025 (Empfang) und Übergangsfristen bis 2027/2028 (Versand), Formate XRechnung/ZUGFeRD, Peppol; was muss MAKE OS können, um rechtssicher zu sein (GoBD, Archivierung)?
5. **Zahlungen:** Stripe, Mollie, PayPal, SumUp, GoCardless (Lastschrift) — für Rechnungsstellung, Abos, Eventtickets; Gebühren und Integrationsaufwand.
6. **Signatur und Dokumente:** qualifizierte/fortgeschrittene elektronische Signatur (eIDAS 2.0), Anbieter (DocuSign, Skribble, Yousign, FP Sign), Kosten, Einsatz für Angebote/Verträge/Beschlüsse.
7. **Kommunikation und Kalender:** Tiefe der Microsoft-Graph- und Google-Workspace-APIs (Agenten-Zugriff, Grenzen, Verifizierung von Google-OAuth-Apps mit sensiblen Scopes, Kosten des Sicherheits-Assessments), WhatsApp Business API, Telefonie/Notetaker (Teams, Zoom, Meet) — was ist für AI CEOs wichtig?
8. **Offene Standards für Agenten:** Model Context Protocol (MCP) und Agent2Agent (A2A) — welche DACH-Dienste bieten 2026 schon MCP-Server an (DATEV? lexoffice? Banken?), und wie kann MAKE OS selbst MCP-Server/-Client sein (Chancen, Sicherheitsrisiken)?
9. **Behörden und Pflichten:** ELSTER/ERiC (Umsatzsteuer-Voranmeldung, Einkommensteuer), Unternehmensregister/Transparenzregister, Handelsregister-Abrufe, Bundesanzeiger — was davon ist für AI CEOs per Software sinnvoll und erlaubt (Abgrenzung Steuerberatungsgesetz)?
10. **Priorisierung:** Erstelle eine Integrations-Roadmap für MAKE OS: Muss (vor dem ersten Kunden), Soll (erste 100 Kunden), Kann (später) — mit Aufwand, Kosten, Abhängigkeiten, rechtlichen Voraussetzungen und dem Verkaufsargument je Integration.

**Arbeitsweise:** Aktuelle Quellen (letzte 12–18 Monate), Entwicklerdokumentation und Preisseiten direkt prüfen, Gesetzestexte/BMF-Schreiben für E-Rechnung und GoBD, jede Quelle mit Datum und Link. Fakt / Schätzung / Meinung kennzeichnen. Keine erfundenen Zahlen.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (10 Kernaussagen, davon die 5 Pflicht-Integrationen)
2. Kapitel je Frage mit Vergleichstabellen (Anbieter × API × Kosten × Abdeckung × Datenschutz × Aufwand)
3. Steuerberater-Sicht: Was eine Kanzlei braucht, damit sie MAKE OS ihren Mandanten empfiehlt
4. Integrations-Roadmap (Muss/Soll/Kann) mit Aufwand und Voraussetzungen
5. „Was das für MAKE OS heißt“: anbinden vs. selbst bauen, Partnerprogramme, Verkaufsargumente
6. Quellenliste

--- PROMPT P14 ENDE ---

---

--- PROMPT P15 START ---

Du bist eine Fördermittel- und Finanzierungsberaterin für Software- und KI-Unternehmen in Deutschland (Schwerpunkt Brandenburg/Berlin und bundesweit) mit Überblick über EU-Programme und Investoren. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (wir):** MAKE Innovation (Marke der KEMARIS Innovation GmbH, Sitz im Land Brandenburg, künftig MAKE Innovation GmbH, gehalten von der KD Ventures UG), zwei Gründer, entwickelt MAKE OS — das Betriebssystem für „AI CEOs“ (Unternehmen ohne Mitarbeiter mit KI-Führungsteam, Privat + Business in einem System, eigene verschlüsselte Instanz je Kunde in Deutschland, DSGVO und KI-Verordnung eingebaut). Das Produkt läuft produktiv für uns selbst; als Nächstes bauen wir ein AI-CEO-Modul, eine Instanz-Fabrik und ein Pilotprogramm mit 3–5 Kunden. Dazu betreiben wir die Event-Reihe „Fokus Innovation“.

**Ziel dieses Laufs:** Alle realistischen Wege finden, die Entwicklung, Piloten und den Markteintritt zu finanzieren — Zuschüsse, Darlehen, Beteiligungen —, mit Fristen, Bedingungen und einem Finanzierungsfahrplan.

**Beantworte ausführlich und mit Quellen:**
1. **Bundesprogramme:** ZIM (Zentrales Innovationsprogramm Mittelstand), Forschungszulage (steuerliche FuE-Förderung, auch für Software/KI — Voraussetzungen, Bescheinigung BSFZ, Höhe 2026), KI-Förderlinien des BMBF/BMWK (bzw. Nachfolge-Ministerien), Digital Jetzt (Status), go-digital/go-inno, INVEST-Zuschuss, EXIST (Eignung?), DLR/VDI-Projektträger-Ausschreibungen 2026.
2. **Land Brandenburg/Berlin:** ILB-Programme (z. B. ProFIT Brandenburg, BIG-Digital, Brandenburg-Kredit Innovativ), WFBB-Angebote, Innovationsgutscheine, Gründungszuschüsse, Beratungsförderung; Berliner Programme falls relevant (IBB).
3. **EU:** EIC Accelerator, Horizon Europe (Cluster 4), Digital Europe Programme (KI, Cybersicherheit), EIT Digital, EU-Programme für KMU-KI-Einführung — realistische Erfolgsquoten und Aufwand für ein Zwei-Personen-Team.
4. **KfW und Darlehen:** ERP-Gründerkredit, ERP-Digitalisierungs- und Innovationskredit, Bürgschaftsbanken — Bedingungen und Kombination mit Zuschüssen.
5. **Förderung für Kunden (indirekter Verkaufshebel):** Programme, die Kleinunternehmen die Einführung von Digitalisierung/KI bezuschussen (z. B. Digitalisierungsprämien der Länder, BAFA-Beratung, Weiterbildungsförderung) — kann MAKE OS bzw. unsere Einrichtung förderfähig sein, und wie verkauft man das?
6. **Beteiligungskapital:** Business Angels und Fonds in DACH für KI-Anwendungen/Produktivität/Future of Work (Seed/Pre-Seed), High-Tech Gründerfonds, Brandenburg Kapital/BFB-Fonds, ILB-Beteiligungen, Corporate-Programme; was erwarten Investoren 2026 bei KI-Anwendungen (Kennzahlen, Verteidigungsfähigkeit), typische Bewertungen und Beträge.
7. **Alternative Finanzierung:** Umsatzbasierte Finanzierung, Vorauszahlungen von Pilotkunden, Lizenz-Vorverkäufe, Crowdinvesting — Vor- und Nachteile.
8. **Kombinierbarkeit und Beihilferecht:** De-minimis-Grenzen (aktuelle Höhe), AGVO, Kumulierung, was man nicht kombinieren darf; Fallstricke (vorzeitiger Maßnahmenbeginn, Eigenanteil, Abrechnung von Eigenleistung der Gründer).
9. **Antragspraxis:** Was macht Anträge für Software-/KI-Projekte erfolgreich (Innovationshöhe, Arbeitspakete, Verwertung), typische Bearbeitungszeiten, Kosten von Antragsberatern, Fehler, die zur Ablehnung führen.
10. **Finanzierungsfahrplan:** Konkreter Vorschlag für MAKE OS über 24 Monate: welche Programme in welcher Reihenfolge, Beträge (Bandbreiten), Fristen/Stichtage 2026/2027, Eigenanteil, Abhängigkeiten zum Produktfahrplan (Phasen: Plattform-Schulden, CEO-Cockpit, KI-Führungsteam, Instanz-Fabrik, Piloten, Markt).

**Arbeitsweise:** Nur aktuelle, offizielle Quellen (Förderdatenbank des Bundes foerderdatenbank.de, Programmseiten ILB/WFBB/KfW/EU-Portale, Richtlinientexte mit Datum), Fristen und Beträge mit Stand angeben, Unsicherheiten benennen. Keine erfundenen Programme oder Beträge — nicht Gefundenes als „nicht belegt“ kennzeichnen.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (die 5 besten Hebel mit Betrag, Frist, Aufwand)
2. Tabelle aller Programme (Name × Träger × Förderart × Höhe/Quote × Bedingungen × Frist × Eignung für uns hoch/mittel/gering × Link)
3. Kapitel je Frage
4. Kombinations- und Beihilfe-Übersicht
5. 24-Monats-Finanzierungsfahrplan (Tabelle, an Produktphasen gekoppelt)
6. „Was das für MAKE OS heißt“: nächste 3 Anträge mit Checkliste, Förderung als Verkaufsargument für Kunden, Investoren-Geschichte
7. Quellenliste

--- PROMPT P15 ENDE ---

---

--- PROMPT P16 START ---

Du bist eine Design-Direktorin für Software, die Menschen und KI-Agenten zusammenarbeiten lässt — mit Schwerpunkt auf Aufsicht, Vertrauen, Ruhe und Klarheit. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (unser Produkt):** MAKE OS ist das Betriebssystem für „AI CEOs“. Geplant ist ein **CEO-Cockpit**: eine Seite mit Richtung (Nordstern, Quartalsziele), „Heute entscheiden“ (gebündelte Freigaben mit Vorher/Nachher und „was passiert, wenn ich nichts tue“), Abteilungen (eine Zeile je KI-Abteilungsleiter mit Ampel, Kennzahl, Vorschlägen, Budget), Balance (Kapazität, Energie mit Einwilligung, geschützte Zeit), einem Zeitstrahl („Lichtfäden“) und „Was ohne mich lief“ (zurücknehmbare Schritte). Dazu ein KI-Chief-of-Staff „ZOE“ (Gespräch, Sprache, als ruhige Partikel-Kugel dargestellt). Gestaltungsregeln: 80 % Seriosität, höchstens 20 % futuristische Akzente, klare Linien, kein Gewusel; dunkler Grund, Akzentfarben Granat (#C9465C) und Smaragd (#2FA878), Schriften Archivo und Public Sans; Business sieht nie Privates.

**Ziel dieses Laufs:** Die weltweit besten Muster für Oberflächen sammeln, in denen Menschen KI-Agenten führen, Entscheidungen treffen und ihren Tag steuern — damit unser Cockpit zu den besten Oberflächen der Welt gehört.

**Beantworte ausführlich und mit Quellen (mit Links zu Beispielen, Screenshots-Beschreibungen, Fallstudien):**
1. **Menschliche Aufsicht über KI:** Leitlinien und Forschung (Google PAIR Guidebook, Microsoft HAX Toolkit/Guidelines for Human-AI Interaction, Apple Human Interface Guidelines zu Apple Intelligence, Anthropic/OpenAI zu Agenten-Oberflächen, Nielsen Norman Group zu KI-UX, aktuelle CHI/CSCW-Arbeiten). Welche Prinzipien sind belegt?
2. **Freigabe-Gestaltung:** Wie zeigen die Besten Vorschläge von Agenten (Diff/Vorher-Nachher, Begründung, Zuversicht, Quellen, Rücknahme, Bündelung), ohne Freigabe-Müdigkeit und blindes Bestätigen? Beispiele: GitHub Copilot/Workspace-Reviews, Cursor, Linear-Agenten, Superhuman, Intercom Fin, Notion AI, Claude/ChatGPT-Agentenansichten, Banking-Freigaben.
3. **Cockpits und Lagebilder:** Beste Beispiele für ruhige, dichte Übersichten (Linear, Stripe Dashboard, Things, Arc, Apple Wetter/Fitness, Bloomberg vs. Gegenbeispiele, Flugzeug-Cockpits/„Glass Cockpit“-Prinzipien, Leitstände). Was macht eine Übersicht in 2 Minuten erfassbar? Informationsdesign (Tufte, Few, Pre-attentive Attributes).
4. **Ruhige Technik:** Calm Technology (Weiser/Brown, Amber Case), Benachrichtigungen bündeln, „Do not disturb“-Muster, Rhythmus statt Dauerfeuer — belegte Wirkung.
5. **KI-Persönlichkeit und Darstellung:** Wie wirken KI-Figuren/Avatare/abstrakte Formen (Kugeln, Wellen) auf Vertrauen und Ernsthaftigkeit? Beispiele (Siri, Gemini, ChatGPT Voice, Pi, Humane/Rabbit als Gegenbeispiele) und Forschung zu Anthropomorphisierung.
6. **Erklärbarkeit und Nachweis:** Wie zeigt man „warum“, „womit“ (Datenkategorien), „wer“ (welcher Agent) und „was danach passierte“ verständlich — ohne Textwüste?
7. **Privat und Business in einer Oberfläche:** Muster für Bereiche/Räume/Modi (Apple Focus-Modi, Arc Spaces, Slack Workspaces, Microsoft Profile), sichtbare Grenzen, Wechsel ohne Verwirrung.
8. **Mobil:** Freigaben unterwegs (Wischen, Widgets, Benachrichtigungen mit Aktionen, Sprachbedienung), Tagesübersicht auf kleinem Bildschirm, Apple Watch/Wear OS.
9. **Barrierefreiheit und Qualität:** WCAG 2.2 / EN 301 549 / Barrierefreiheitsstärkungsgesetz (seit 2025) — was gilt für uns, wie prüft man; dunkles Design und Kontrast.
10. **Gestaltungsregeln für unser Cockpit:** Leite 25–30 konkrete, begründete Regeln ab (Layout, Typografie, Farbe nur mit Bedeutung, Zahlen, Ampeln, Bewegung, Freigaben, Sprache der KI, Leere Zustände „keine Daten“, Fehlerzustände) und beschreibe einen Entwurf des Cockpits in Worten (Bereiche, Reihenfolge, Verhalten) sowie 3 Varianten zum Testen.

**Arbeitsweise:** Primärquellen (Leitlinien der Hersteller, Forschungsarbeiten mit DOI, Design-Fallstudien der Firmen), aktuelle Beispiele (letzte 12–18 Monate) mit Link und Datum. Belegte Wirkung von Geschmack trennen (kennzeichnen).

**Ausgabeformat (Deutsch):**
1. Kurzfassung (10 Prinzipien mit Beleg)
2. Kapitel je Frage mit Beispielen (Link, was gut ist, was wir übernehmen)
3. Muster-Bibliothek: Freigabe, Lagezeile, Begründung, Rücknahme, Bereichswechsel, Leerer Zustand
4. Gestaltungsregeln für das CEO-Cockpit (25–30 Regeln)
5. Cockpit-Entwurf in Worten + 3 Testvarianten + Testplan (5 Nutzer, Aufgaben, Messgrößen)
6. „Was das für MAKE OS heißt“: Änderungen am Design-Standard, ZOE-Darstellung, mobile Freigaben
7. Quellenliste

--- PROMPT P16 ENDE ---

---

--- PROMPT P17 START ---

Du bist eine Kreativdirektorin und Conversion-Strategin, die für die besten Software-Marken der Welt Websites gebaut hat (B2B-SaaS, KI-Produkte, Premium-Marken) und den DACH-Markt kennt. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (wir und unser Produkt):** MAKE Innovation (Marke der KEMARIS Innovation GmbH, künftig MAKE Innovation GmbH; Gründer Kevin Dieckmann und Malin) baut **MAKE OS** — das Betriebssystem für „AI CEOs“: Menschen, die ihr Unternehmen ohne oder fast ohne Mitarbeiter mit einem KI-Führungsteam führen und Privat + Business in einem System steuern (Fokus & Zeit, Vertrieb/CRM, Marketing, Events, Finanzplanung mit Steuern, Gesundheit, Familie; KI-Chief-of-Staff „ZOE“; Mensch entscheidet; eigene verschlüsselte Instanz je Kunde in Deutschland; DSGVO und KI-Verordnung eingebaut). Editionen geplant: „Markttraktion“ (einzeln verkaufbar), „MAKE OS“, „AI CEO“. Dazu Beratung/Einrichtung und die Event-Reihe „Fokus Innovation“ (eigene Seite fokusinnovation.de). Heutige Website makeinnovation.de: hell → dunkel, ruhig, klare Linien (80 % Seriosität, höchstens 20 % futuristische Akzente), eigene 3D-Szene „Der Weg“ (Partikel), Überschrift „Innovation braucht Umsetzung und Sichtbarkeit.“, Farben Granat (#C9465C) und Smaragd (#2FA878), Schriften Archivo und Public Sans. Zielgruppe: Solo- und Kleinstunternehmer, Berater, Coaches, Agenturinhaber, Holding-Unternehmer im DACH-Raum, die mit KI wachsen wollen, ohne ihr Leben zu verlieren.

**Ziel dieses Laufs:** Alles zusammentragen, was wir brauchen, um eine Website und Außendarstellung zu bauen, die **deutlich besser** ist als unsere heutige — und besser als die der Wettbewerber: klarer, glaubwürdiger, schöner, und sie verkauft.

**Beantworte ausführlich und mit Quellen (mit Links zu den Beispielseiten und genauer Beschreibung, was dort wirkt):**
1. **Die besten Websites 2025/2026:** Analysiere 20–30 herausragende Websites aus drei Gruppen: (a) KI-/Agenten-Produkte (z. B. Anthropic, Linear, Granola, Lindy, Motion, Reclaim, Sunsama, Superhuman, Arc/Dia, Raycast, Perplexity, Notion, Attio), (b) Premium-/Vertrauensmarken (z. B. Stripe, Apple, Mercury, Ramp, Teenage Engineering, Aesop), (c) DACH-Beispiele, die Vertrauen verkaufen (z. B. Personio, Qonto/Kontist, Langdock, DeepL, Celonis, Ottonova). Je Seite: Aufbau, Kernbotschaft, Beweisführung, Bildsprache, Bewegung, Typografie, Aufforderung zum Handeln — was übernehmen wir, was nicht?
2. **Aufbau einer Startseite, die verkauft:** Belegte Muster für den ersten Bildschirm (Botschaft in 5 Sekunden), Reihenfolge der Abschnitte, Länge, Beweise (Zahlen, Kundenstimmen, Logos, Demo), Preisseite, Aufforderungen zum Handeln; aktuelle Conversion-Studien (z. B. Unbounce, CXL, Baymard, Nielsen Norman Group, Wynter-Botschaftstests) und A/B-Ergebnisse.
3. **Produkt zeigen:** Wie zeigen die Besten ein komplexes Produkt (interaktive Demo, Produkt-Rundgang wie Arcade/Navattic/Storylane, kurze Filme, animierte Oberflächen, „Ein Tag mit …“, Demo-Instanz mit Beispieldaten)? Was wirkt nachweislich?
4. **Botschaft und Positionierung für AI CEOs:** Welche Überschriften, Versprechen und Begriffe funktionieren für diese Zielgruppe (DACH vs. international)? Wie verkauft man „Privat + Business“ und „KI-Führungsteam“, ohne Hype oder Angst auszulösen? Liefere 10 Überschrift-Varianten mit Begründung und 3 vollständige Botschafts-Rahmen (Problem → Wandel → Beweis → Angebot).
5. **Vertrauen und Datenschutz sichtbar machen:** Wie präsentieren die besten Anbieter Sicherheit, eigene Instanz, „Made in Germany“, Zertifikate, Transparenz (z. B. Trust Center, Statusseite, Datenschutz in Klartext)? Was wirkt in DACH?
6. **Gründer und Geschichte:** Wie nutzen erfolgreiche junge Firmen ihre Gründer, „wir nutzen es selbst“, Build in Public, Fallstudien — Formate und Belege.
7. **Gefunden werden — Google und KI-Suche:** SEO 2026 für SaaS im DACH-Raum, „Generative Engine Optimization“ (Sichtbarkeit in ChatGPT, Perplexity, Gemini, Google AI Overviews), strukturierte Daten, Inhalte, die zitiert werden, Vergleichsseiten („MAKE OS vs. …“), Glossar „AI CEO“. Was ist belegt, was Hype?
8. **Technik und Qualität:** Ladezeit (Core Web Vitals), 3D/WebGL ohne Leistungsverlust, Barrierefreiheit (WCAG 2.2, Barrierefreiheitsstärkungsgesetz), Datenschutz der Website selbst (cookiefreie Analyse wie Plausible/Matomo, keine US-Tracker, rechtssicheres Impressum/Datenschutz), Mehrsprachigkeit DE/EN.
9. **Gesamte Außendarstellung:** Markensystem (Logo-Einsatz, Farben, Bildsprache, Ton), LinkedIn-Auftritt der Gründer und der Firma, Präsentationen/Pitch-Deck, Event-Auftritt (Fokus Innovation), E-Mail-Signaturen, Produkt-Screenshots, Video-Stil — was haben die Besten gemeinsam? Wie verbindet man Firmenseite (makeinnovation.de), Produktseite (MAKE OS) und Event-Seite (fokusinnovation.de) sauber (eine Marke, mehrere Seiten oder Unterseiten)?
10. **Bauplan unserer neuen Website:** Seitenstruktur (Sitemap), Startseite Abschnitt für Abschnitt (Ziel, Inhalt, Beweis, Gestaltung, Bewegung), Texte-Entwürfe für die wichtigsten Abschnitte in Kundensprache, Preisseite, Demo-/Rundgang-Konzept, Seiten je Edition und je Zielgruppe, Vergleichsseiten, Trust Center, Kennzahlen (Besuch → Demo → Pilot), Testplan (was zuerst A/B-testen).

**Arbeitsweise:** Aktuelle Beispiele (letzte 12–18 Monate) mit Link und Datum, Studien und Tests mit Quelle, Geschmack klar von belegter Wirkung trennen. Keine erfundenen Zahlen.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (10 Prinzipien, die unsere Website von „gut“ zu „herausragend“ bringen)
2. Galerie der besten Seiten (Tabelle: Seite × was wirkt × was wir übernehmen × Link)
3. Kapitel je Frage
4. Botschafts-Rahmen + 10 Überschriften + Einwandbehandlung
5. **Website-Bauplan**: Sitemap, Startseite Abschnitt für Abschnitt mit Textentwürfen, Preisseite, Demo-Konzept, Trust Center, SEO/GEO-Plan
6. Markensystem und Außendarstellung (LinkedIn, Deck, Events, Video) als Checkliste
7. Testplan und Kennzahlen
8. Quellenliste

--- PROMPT P17 ENDE ---

---

--- PROMPT P18 START ---

Du bist eine Umsatz- und Vertriebsstrategin (Revenue Architect) für Software- und Dienstleistungsunternehmen mit Erfahrung in KI-Produkten, Kleinunternehmer-Märkten und dem DACH-Raum. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (wir und unsere Produkte):** MAKE Innovation (Marke der KEMARIS Innovation GmbH, künftig MAKE Innovation GmbH, gehalten von KD Ventures; Gründer Kevin Dieckmann und Malin) hat bzw. plant:
- **Software MAKE OS** als eigene Instanz je Kunde, Editionen „Markttraktion“ (CRM/Vertrieb/Marketing/Events mit KI-Abteilungsleitern, einzeln verkaufbar), „MAKE OS“ (Fokus & Zeit, Business, Privat, KI-Chief-of-Staff), „AI CEO“ (alles + CEO-Cockpit + vollständiges KI-Führungsteam + Playbooks); Lizenzen signiert, nach Ablauf nur lesen.
- **Dienstleistung:** Beratung/Einrichtung („MAKE Innovation Development“), Begleitung beim Aufbau als AI CEO.
- **Events:** Event-Reihe „Fokus Innovation“ / Make.One (Abende in mehreren Städten, Gespräche am Tisch, Workshops).
- **Weitere denkbare Produkte:** Playbooks/Vorlagen je Geschäftsmodell, Schulung/Akademie, Community/Mitgliedschaft, Partner- und Wiederverkaufsprogramme, Zusatzmodule (z. B. Integrationen), KI-Guthaben.
- Eigene Erfahrung: Wir führen zwei Gesellschaften mit MAKE OS selbst.

**Ziel dieses Laufs:** Jede realistische Möglichkeit finden, mit MAKE OS und den Produkten dahinter Umsatz zu machen, die besten Kombinationen auswählen und den Verkaufsprozess so bauen, dass er zuverlässig funktioniert.

**Beantworte ausführlich und mit Quellen:**
1. **Umsatzströme — vollständige Landkarte:** Software-Abos, Einrichtungspakete, Done-for-you/Managed Service („wir betreiben dein KI-Team“), Beratung, Schulung/Zertifizierung, Community-Mitgliedschaft, Events/Tickets/Sponsoring, Vorlagen-/Playbook-Marktplatz, Partner-/Reseller-/White-Label-Lizenzen, Affiliate, Integrationen/Add-ons, KI-Guthaben, Unternehmens-/Verbandslizenzen, Förder-Beratung als Dienstleistung. Je Strom: Beispiele erfolgreicher Firmen, Marge, Skalierbarkeit, Aufwand, Risiko, Passung zu uns.
2. **Kombinationen, die funktionieren:** Software + Dienstleistung + Community + Events — Fallstudien (z. B. HubSpot Academy/Partner, Notion-Ambassadors/Vorlagen, Webflow-Experten, Circle-Communitys, Lemlist/lempire, Sales-Communitys in DACH) mit Zahlen. Welche „Flywheels“ entstehen?
3. **Angebotsgestaltung:** Einstiegsangebote (Pilot, Audit, „AI-CEO-Check“), Kernangebot, Premium (z. B. Inner Circle, Begleitung), Garantie- und Risikoumkehr-Modelle, Preisanker, Paketierung (Good-Better-Best), Jahresvorauszahlung — belegte Wirkung.
4. **Verkaufsprozess:** Vom Erstkontakt (Event, Website, Empfehlung, LinkedIn) bis zur Unterschrift — Schritte, Skripte, Demo-Ablauf, Einwandbehandlung, Abschlussquoten-Benchmarks für Kleinunternehmer-Software und Beratung; Gründer-Vertrieb vs. erste Vertriebsperson; wie MAKE OS selbst (CRM, Heads, Power Hour) den Verkauf steuert.
5. **Events als Umsatzmaschine:** Wie verdienen die Besten mit Abenden/Workshops/Konferenzen direkt (Tickets, Sponsoren) und indirekt (Pipeline)? Umwandlungsquoten, Nachfass-Sequenzen, Formate (Dinner, Masterminds, Retreats).
6. **Partner und Multiplikatoren:** Steuerberater, Unternehmensberater, Coaches, Agenturen, Banken, IHKs, Coworkings — Provisionsmodelle (einmalig vs. wiederkehrend, Höhe), Partnerprogramm-Aufbau, Beispiele in DACH.
7. **Bestandskunden-Umsatz:** Upsell (Edition, Plätze, Module), Cross-Sell (Dienstleistung, Events), Kundenbindung, Empfehlungsprogramme, Netto-Umsatzbindung — Benchmarks und Taktiken.
8. **Preispsychologie und Zahlungsbereitschaft:** Was zahlen Solo-Unternehmer für Ergebnisse (Zeit gespart, Umsatz gewonnen) vs. für Software? Wert-basierte Preisargumente, ROI-Rechner, Vergleich mit Kosten einer Assistenz/Teilzeitkraft — mit Belegen.
9. **Recht und Steuern der Umsatzströme:** Wichtige Punkte für Verträge (AGB B2B, Abo-Kündigung, Fernabsatz falls B2C), Umsatzsteuer bei Events/Online-Kursen/Software in DACH, Provisionsverträge, Haftungsgrenzen für Beratung — mit Fundstellen (keine Rechtsberatung).
10. **Umsatz-Architektur für MAKE Innovation:** Konkreter Vorschlag: welche 3–5 Umsatzströme zuerst, welche später, Preisliste je Angebot, Verkaufsprozess je Kanal, Ziele und Kennzahlen für 12/24/36 Monate (Umsatz, Kunden, Mix Software vs. Dienstleistung vs. Events, Marge), Szenario-Rechnung (vorsichtig / erwartet / ehrgeizig) mit offengelegten Annahmen.

**Arbeitsweise:** Aktuelle Quellen (letzte 12–18 Monate), Fallstudien mit Zahlen vor allgemeinen Ratschlägen, Benchmarks mit Herkunft, jede Quelle mit Datum und Link, Deutsch und Englisch. Fakt / Schätzung / Meinung kennzeichnen. Keine erfundenen Zahlen.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (die 10 stärksten Umsatzhebel)
2. Landkarte aller Umsatzströme (Tabelle: Strom × Beispiele × Marge × Skalierbarkeit × Aufwand × Passung)
3. Kapitel je Frage
4. Angebots-Treppe (Einstieg → Kern → Premium) mit Preisen und Inhalten
5. Verkaufsprozess je Kanal (Schritte, Skripte, Quoten, Werkzeuge in MAKE OS)
6. Partnerprogramm-Entwurf
7. **Umsatz-Architektur** mit 12/24/36-Monats-Zielen und drei Szenarien
8. Quellenliste

--- PROMPT P18 ENDE ---

---

--- PROMPT P19 START ---

Du bist eine Software-Architektin für Wissenssysteme, Suche (Retrieval) und KI-Gedächtnis mit Erfahrung im Selbstbetrieb auf kleinen Servern und strengem europäischem Datenschutz. Führe eine gründliche, belegte Tiefenrecherche durch. Heute ist Oktober 2026.

**Kontext (unser heutiges „Brain“ in MAKE OS):**
- **Wahrheit:** ein Obsidian-Vault (Markdown, rund 400 Notizen, wächst), Ziel: Server-Vault als Git-Repo (`/srv/make-os/vault`), Abgleich mit dem Mac per Git, zusätzlich Kopie zu GitHub; Bereiche: eigene Notizen (nur Menschen schreiben), `_App/` (Spiegel aus der App, generiert), `_inbox/` (Vorschläge der KI, Menschen geben frei).
- **Index:** SQLite mit FTS5 (Volltext) + lokale Embeddings (`multilingual-e5-small`, Transformers.js/ONNX, int8, 384 Dimensionen; Modell ~120 MB außerhalb der Daten), Abschnitte ~400–600 Tokens an Überschriften mit 10 % Überlappung und vorangestelltem Kontext (nach Anthropic „Contextual Retrieval“), Frontmatter als Filter; zusätzlich Tabelle `app_chunks` für Arbeitsbestände (Aufgaben, Projekte, Angebote, Mandate, Kommentare). Index **nur im Arbeitsspeicher** (tmpfs 256 MB), nach jedem Start in ~1 s neu gebaut, nie im Klartext auf der Platte; Sichtrechte (wer darf was sehen) werden VOR dem Ranking angewandt.
- **Gedächtnis und Regeln:** KI-Chief-of-Staff „ZOE“ mit Faktengedächtnis (sichtbare Liste), dauerhaftem Entscheidungs-Log, KONSTITUTION.md (Werte, harte Grenzen, immer geladen) + Regel-Notizen mit Priorität, nach Relevanz geladen; nächtliche Konsolidierung → höchstens 5 Vorschläge in die Inbox.
- **Server:** Hetzner, **1 vCPU, 1,9 GB RAM**, 38 GB Platte, Docker (App-Grenze 1.280 MB), Daten verschlüsselt (AES-256-GCM), KI-Modelle über Anthropic-API (USA) mit KI-Schaltern, Pseudonymisierung und KI-Protokoll. Künftig: **eine Instanz je Kunde**, viele kleine Server oder mehrere Instanzen je Server.
- **Ziel:** Das Brain soll das Gedächtnis eines „AI CEO“ werden — alles Wissen aus Privat und Business, sauber getrennt, schnell durchsuchbar, verlässlich für Agenten, datensparsam, sicher, wartbar und je Kunden-Instanz reproduzierbar.

**Ziel dieses Laufs:** Die beste Architektur für ein selbst betriebenes KI-Brain finden — mit klaren Empfehlungen, was wir behalten, was wir ändern, und in welcher Reihenfolge.

**Beantworte ausführlich und mit Quellen:**
1. **Retrieval-Stand 2026:** Hybride Suche (BM25/FTS + Vektor), Neu-Sortierung (Reranker wie bge-reranker, Cohere Rerank, Jina), Contextual Retrieval, Late Chunking, Abfrage-Umformulierung, Agentic RAG, GraphRAG/Wissensgraphen (Microsoft GraphRAG, LightRAG), lange Kontextfenster vs. RAG — was bringt nachweislich wie viel (Benchmarks, Effektgrößen) für persönliche/kleine Wissensbasen?
2. **Embedding-Modelle für Deutsch + Englisch, lokal auf CPU:** Vergleich (z. B. multilingual-e5-small/base, bge-m3, jina-embeddings-v3, nomic-embed, gte-multilingual, EmbeddingGemma, Snowflake Arctic) nach Qualität (MTEB/MMTEB deutschsprachig), Größe, RAM, Geschwindigkeit auf 1 vCPU, Lizenz. Lohnt ein Wechsel von e5-small?
3. **Speicher für Vektoren:** SQLite (sqlite-vec, FTS5), DuckDB, LanceDB, pgvector, Qdrant, Chroma — für 1 vCPU/2 GB und für „eine Instanz je Kunde“: Leistung, Speicherbedarf, Verschlüsselung, Betrieb, Sicherung. Empfehlung mit Begründung.
4. **Gedächtnis für Agenten:** Muster und Werkzeuge (z. B. Letta/MemGPT, Mem0, Zep/Graphiti, LangMem, Anthropic Memory-Funktionen, OpenAI Memory) — Fakten vs. Episoden vs. Regeln, Vergessen und Korrektur, Konflikte, Zeitbezug; was übernehmen wir, was bauen wir selbst?
5. **Wissensqualität:** Wie verhindert man veraltetes/widersprüchliches Wissen (Konsolidierung, Gültigkeitsdatum, Quellenangabe, „Wahrheit“ vs. abgeleitete Daten), wie misst man Retrieval-Qualität (Evals: Recall@k, MRR, Ragas, eigene Fragensammlungen)? Konkreter Eval-Plan für uns.
6. **Datenschutz und Sicherheit:** Verschlüsselung im Ruhezustand und im Speicher, Index im RAM vs. verschlüsselter Index (z. B. SQLCipher), Rechte je Abschnitt (Privat/Business, Personen), Löschung nach Art. 17 inkl. Git-Historie des Vaults (git filter-repo, BFG) und Embeddings, Prompt Injection über Notizen/Mails, Pseudonymisierung vor dem Modell, Protokolle.
7. **Lokale Modelle vs. API:** Was kann auf 1 vCPU/2 GB oder einem etwas größeren Server lokal laufen (Embeddings, Reranker, kleine Sprachmodelle für Klassifikation/Zusammenfassung, z. B. Qwen/Gemma/Phi/Mistral klein, llama.cpp/Ollama)? Wo bleibt die API (Claude) sinnvoll? Kosten/Nutzen, EU-Optionen.
8. **Vault und Synchronisation:** Obsidian + Git auf Server und Mac (Konflikte, iCloud-Probleme, Obsidian Git/Sync, Self-hosted LiveSync/CouchDB), Wiki-Editor im Web als Alternative; App-Spiegel `_App/` ja/nein; Struktur-Konventionen (PARA, Zettelkasten, Frontmatter-Schema) für Agenten-Tauglichkeit.
9. **Je Kunden-Instanz:** Wie baut man das Brain reproduzierbar für viele Instanzen (Vorlagen-Vault, Konstitution je Kunde, Modelle teilen ohne Daten zu teilen, Ressourcen je Instanz, Update der Modelle, Neuaufbau-Zeiten bei 1.000–50.000 Notizen)? Server-Größen-Empfehlung (Hetzner-Typen) mit Kosten.
10. **Ziel-Architektur und Fahrplan:** Konkrete Empfehlung für MAKE OS: Komponenten, Datenfluss (Vault → Abschnitte → Index → Suche → Agenten → Inbox → Vault), was wir behalten, was wir ändern, Schritt-für-Schritt-Fahrplan (Stufe 1 sofort auf dem heutigen Server, Stufe 2 mit Kunden-Instanzen, Stufe 3 Skalierung), Tests/Evals je Schritt, Risiken und Rückwege.

**Arbeitsweise:** Primärquellen (Forschungsarbeiten mit DOI/arXiv, Benchmarks wie MTEB/BEIR, Herstellerdokumentation, Engineering-Blogs) vor Meinungen, aktuelle Quellen (letzte 12–18 Monate), jede Quelle mit Datum und Link. Zahlen zu Leistung/RAM immer mit Messumgebung. Fakt / Schätzung / Meinung kennzeichnen. Keine erfundenen Benchmarks.

**Ausgabeformat (Deutsch):**
1. Kurzfassung (10 Empfehlungen: behalten / ändern / neu)
2. Kapitel je Frage mit Vergleichstabellen (Modell/Speicher × Qualität × RAM × Geschwindigkeit × Lizenz × Datenschutz)
3. Ziel-Architektur (Text-Diagramm + Komponentenliste)
4. Eval-Plan für Suche und Gedächtnis (Fragensammlung, Kennzahlen, Schwellen)
5. Datenschutz- und Sicherheits-Checkliste (inkl. Art. 17 im Vault und Index)
6. **Fahrplan in 3 Stufen** mit Aufwand, Server-Bedarf, Kosten, Rückweg
7. Quellenliste

--- PROMPT P19 ENDE ---

---

--- PROMPT P11 (BONUS: SYNTHESE) START ---

Du bist eine Chief-Strategy-Officer-Beraterin. Dir liegen achtzehn Recherche-Berichte vor (P1 Markt & Zielgruppe, P2 Wettbewerb Produktivität, P3 Wettbewerb Agenten-Plattformen, P4 Privat-Bereich, P5 KI-Entwicklung 2026–2030, P6 Agenten-Architektur, P7 Recht & Vertrauen, P8 Arbeit & Wohlbefinden, P9 Geschäftsmodell & Preise, P10 Go-to-Market, P12 Stimme der Kunden, P13 Weg zu 100 Kunden, P14 Integrationen DACH, P15 Förderung & Finanzierung, P16 Gestaltung KI-Aufsicht, P17 Homepage & Außendarstellung, P18 Umsatzströme & Verkauf, P19 KI-Brain auf dem Server). Sie betreffen MAKE OS, das Betriebssystem für „AI CEOs“ (Unternehmen ohne Mitarbeiter mit KI-Führungsteam, Privat + Business in einem System, eigene Instanz in Deutschland, Mensch entscheidet). Heute ist Oktober 2026.

**Aufgabe:** Führe die Berichte zu **einer** Entscheidungsgrundlage zusammen.

1. Die 15 wichtigsten Erkenntnisse über alle Berichte (mit Verweis auf Bericht und Quelle). Wo Kundenstimme (P12) und Analysten-/Marktsicht (P1–P10) auseinandergehen, gewinnt die belegte Kundenstimme — markiere diese Stellen.
2. Widersprüche zwischen den Berichten und wie man sie auflöst.
3. Die erste Zielgruppe (eine), die erste Edition und der erste Preis — mit Begründung.
4. Die 10 Funktionen mit dem höchsten Wert für die erste Zielgruppe, sortiert nach Wirkung/Aufwand, mit Verweis auf die Belege.
5. Die 10 KI-Trends, die wir jetzt einbauen müssen, und 5 Dinge, die wir nicht bauen sollten.
6. Pflichten aus Recht und Sicherheit vor dem ersten Kunden; Pflicht-Integrationen (P14) je Stufe; Finanzierung des Fahrplans (P15: welche Förderung wann beantragen, Fristen); Gestaltungsprinzipien für das Cockpit (P16) als verbindliche Liste; Website-Bauplan (P17) und Umsatz-Architektur (P18) je Stufe; Brain-Architektur (P19) als Entscheidung mit Bauschritten.
7. Positionierung in einem Satz, Kernbotschaft, drei Belege, Einwandbehandlung.
8. Fahrplan in Stufen nach dem Muster aus P13 (z. B. Kunde 0 → 10 Piloten → 100 Kunden): je Stufe Ziel, Funktionen, Recht, Vertrieb, Events, Betrieb, Kennzahlen, Eintritts- und Abbruchkriterien; dazu 90-Tage-Plan im Wochenraster.
9. Die 10 größten Risiken mit Gegenmitteln und Frühindikatoren.
10. Offene Fragen, die nur Kundeninterviews oder Tests klären — mit Testdesign.

**Ausgabe:** Deutsch, klar, Tabellen, jede Aussage mit Verweis auf den Ursprungsbericht. Keine neuen Behauptungen ohne Beleg.

--- PROMPT P11 (BONUS: SYNTHESE) ENDE ---
