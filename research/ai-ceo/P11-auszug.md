# P11 (frühe Fassung) · Auszug — Strategische Synthese

**Volltext:** `P11-synthese-frueh.md` · **Drive:** https://docs.google.com/document/d/1T1Wa03bSrZbZLKUZQPRQWusMpHMvDkSM2rcdytLGz0A
**Abgerufen und geprüft:** 05.10.2026 · **Quelle:** Gemini Deep Research, ungeprüft

> **Status: frühe Synthese — vermutlich auf Basis weniger Berichte; nicht die endgültige P11.**
> - Sie nennt nur P1–P10 (nicht P12–P19, also **ohne Kundenstimme P12**, ohne Integrationen, Förderung, KI-Aufsicht, Homepage, Umsatzströme, Brain). Der Auftrag „Kundenstimme gewinnt“ konnte so nicht erfüllt werden.
> - Sie zitiert **keinen der Berichte P1–P10 direkt**, sondern fast nur `AI_CEO_MODUL.md` (Quelle 1) und eigene Web-Quellen. Zahlen aus P9/P10 tauchen teils **anders** auf (Hetzner 15–20 € statt 7,50 €; Preis 249 € statt 99/149/249 bzw. 149/299/499 €).
> - Mehrere Kernzahlen sind **falsch oder überdehnt** (4,2 Mio. Solo-Selbstständige; „87 % der Solo-Unternehmer mit Burnout-Symptomen“; „3,5 % Median-Abwanderung“). Siehe Prüfung.
> → Als **Arbeitshypothese** brauchbar, als Entscheidungsgrundlage erst nach der echten P11 mit allen Berichten.

---

## 1 · Kernaussagen

| # | Aussage | Beleg im Bericht | Art |
|---|---|---|---|
| 1 | **Erste Zielgruppe:** wissensbasierte Solo-Dienstleister **mit Mehrgesellschafts-Struktur** in DACH — Strategieberater, Fractional Executives, Agenturinhaber, Beteiligungsunternehmer; 150–600 T€ Umsatz, 110–150 €/Std. | AI_CEO_MODUL, findskill.ai | Meinung/Schätzung |
| 2 | Begründung: Rollenwechsel-Überlastung, Vertraulichkeit gegenüber Mandanten (lehnen US-SaaS ab), passt exakt zu Kevins eigenem Profil (Kunde 0 als Prüffilter). | AI_CEO_MODUL | Meinung |
| 3 | **Erste Edition „AI CEO Starter“:** Cockpit, **4 Heads** (Sales, Finance, Operations, IT), Freigabe-Stapel, Fokus & Zeit mit Kalender, eigene Instanz, vorbereitende Buchhaltung mit **DATEV-Export**. | AI_CEO_MODUL | Empfehlung |
| 4 | **Erster Preis: 249 €/Monat bei Jahreszahlung** (im Text „2.490 € = zwei Freimonate“); BYOK-Variante (eigener KI-Schlüssel) 199 €; Pilot-Vorzugspreis 149 €/Monat. | Relevance-AI-Preise, VA-Kosten | Empfehlung — **in sich widersprüchlich** (s. Prüfung) |
| 5 | Top-Funktionen nach Wirkung/Aufwand: 1 Cockpit · 2 Freigabe-Stapel · 3 Heads auf stabile Cache-Präfixe · 4 DATEV-Export · 5 geführte Einrichtung · 6 Kapazitäts-/Balance-Ampel · 7 Head of Sales · 8 Privat/Business-Trennung · 9 Head of Operations (Triage) · 10 Instanz-Fabrik. | AI_CEO_MODUL | Empfehlung |
| 6 | Fünf Zielkonflikte und Auflösungen: Grenzen vs. Alles-in-einem (→ asymmetrische serverseitige Trennung), Autonomie vs. Haftung (→ Außenwirkung nur über Stapel), Baukasten vs. fertiges OS (→ Heads + Playbooks), Pauschale vs. KI-Kosten (→ Regelwerk, Cache, Budget, BYOK), eigene Instanz vs. Skalierung (→ Instanz-Fabrik). | AI_CEO_MODUL | Meinung (stimmig) |
| 7 | **Nicht bauen:** eigene Modelle trainieren, No-Code-Agentenbaukasten, Steuerberatung/Bilanzierung, unüberwachte Kaltakquise-Bots, isolierte Fitness-/Ernährungs-Tracker. | AI_CEO_MODUL, StBerG, UWG | Meinung (gut begründet) |
| 8 | **Einbauen:** MCP (zustandslos, Spezifikation 2026-07-28), hierarchisches Prompt-Caching, pass@k-Evals, Prüf-/Reflexionsschleifen, JSON-Schema-Ausgaben, Brain-Suche im Arbeitsspeicher, Hintergrund-Arbeiter, Modell-Routing, Hash-Ketten, gebündelte Freigaben morgens/abends. | MCP-Blog, AI_CEO_MODUL | Fakt (MCP) + Empfehlung — vieles davon **ist schon gebaut** |
| 9 | **Pflichten vor dem ersten Kunden:** Art. 50 Abs. 1/2 KI-VO (KI-Kennzeichnung, maschinenlesbare Markierung), Hochrisiko vermeiden, Art.-9-Einwilligungen (drei getrennte), AVV (Art. 28), VVT + Pannenregister, Verschlüsselung, Hash-Kette, GoBD-Festschreibung, § 7 UWG-Freigabe-Tor. | KI-VO, DSGVO, AI_CEO_MODUL | Fakt (Normen) + Umsetzungsvorschlag |
| 10 | 12-Monats-Ziel: 5 → 15 → 50 → **100 Instanzen**, MRR 24.900 €, Abwanderung < 2 %/Monat; ab Q3 Steuerberater-Gastportal mit 5 Kanzlei-Partnerschaften. | — | Schätzung |
| 11 | Steuerungsgrößen: ≥ 70 % treffen binnen 48 Std. die erste Freigabe-Entscheidung · ≥ 60 % Head-Vorschläge angenommen · Abwanderung < 2 % · KI-Kosten < 15 % des Abo-Preises · Zufriedenheit > 60 nach 90 Tagen. | AI_CEO_MODUL, leanonmarketing | Schätzung/Ziel |
| 12 | **Offene Fragen mit Tests:** T-01 Aktivieren Kunden den Privatbereich? · T-02 Preisakzeptanz 249 € (Van Westendorp) · T-03 Freigabe-Müdigkeit (≤ 5 Freigaben/Tag?) · T-04 übernimmt die Kanzlei den DATEV-Export ohne Rückfragen? | — | Testdesign |
| 13 | Größte Risiken: Agentenfehler mit Außenwirkung, Leck Privat→Business, KI-Kosten, Anbieter-Ausfall, Abwanderung, Überkomplexität, Art. 50, Berufsrecht StBerG, Einrichtungszeit, **Überlastung des Gründerteams**. | AI_CEO_MODUL | Meinung |

---

## 2 · Zahlen und Prüfung

| Größe | Wert laut P11 | Quelle (laut Bericht) | Stand | Prüfung 05.10.2026 | Belastbarkeit |
|---|---|---|---|---|---|
| Solo-Selbstständige DE | **4,2 Mio.** | Destatis 2025, KfW | 2025/26 | ⚠ **abweichend**: Destatis (Mikrozensus 2024) ~**1,8 Mio.** Solo-Selbstständige bei 3,6 Mio. Selbstständigen gesamt. P10 nennt richtig 1,8–2,0 Mio. | falsch |
| Solo-Anteil an Gründungen | 86 % | KfW-Gründungsmonitor | 2026 | nicht geprüft | offen |
| KI-Nutzung wissensbasierte Solo-Dienstleister | 77 % | Freelancer-Kompass 2025 (via findskill.ai) | 2025 | nicht geprüft (Sekundärquelle) | niedrig |
| Burnout Gründer | „87 % der Solo-Unternehmer akute Erschöpfungs- oder Burnout-Symptome“ | Boundless Founder, Fortune | 2025/26 | ⚠ **überdehnt**: Die Zahlen (87 % bzw. 87,7 %) betreffen **Gründer allgemein** und „mindestens ein psychisches Problem“ (Angst, Stress, Burnout zusammen; u. a. Umfrage mit 227 Teilnehmern); Burnout allein ~34 % | niedrig |
| MCP-Spezifikation 2026-07-28, zustandslos | — | MCP-Blog | 2026 | **bestätigt**: Release Candidate mit „stateless protocol core“, finale Spezifikation für 28.07.2026 angekündigt | hoch |
| Prompt-Caching −90 % | — | tokenoptimize.dev | 2026 | **bestätigt** (Claude-Preisseite: Cache-Lesen 10 % des Eingabepreises bei Haiku/Sonnet, 5 % bei Opus 5.5) | hoch |
| Relevance AI | 199–349 $/Monat „auf Business-Ebene“ | theautomationsguide | 09/2026 | **teilweise bestätigt**: Team 199 $ (älteres Credit-Modell) bzw. 234 $ jährl./349 $ mtl. (neues Actions-Modell); „Business“ kostet 599 $ | mittel |
| Median-Abwanderung SaaS | 3,5 %/Monat | Artisan Growth Strategies | 2026 | ⚠ **nicht auffindbar**: die Seite sagt selbst, sie sei **keine** Erhebung bei 500 Firmen und nennt keinen Monats-Median | niedrig |
| „3,6-fach längere Verweildauer“ für Führungssoftware | — | Artisan, GrowthSpree | 2026 | ⚠ **nicht auffindbar** in der geprüften Quelle | niedrig |
| Art. 50 KI-VO ab 2.8.2026, bis 15 Mio. € / 3 % | — | KI-VO, DLA Piper | 2026 | **bestätigt** (Digital Omnibus verschiebt Art. 50 nicht; Übergang Abs. 2 bis 2.12.2026 nur für Altsysteme) | hoch |
| Instanz-Kosten | 15–20 €/Monat | — | — | Schätzung; widerspricht P9 (7,50 €); eher realistischer | mittel |
| KI-Kosten je Instanz | 20–30 €/Monat | tokenoptimize | — | Schätzung, gleiche Größenordnung wie P9; ungemessen | niedrig |
| Preis 249 € „bei jährlicher Abrechnung 2.490 €“ | — | — | — | ⚠ **in sich widersprüchlich**: 2.490 €/Jahr = 207,50 €/Monat (10 × 249 €). Entweder „249 € monatlich, 2.490 € jährlich“ oder „249 €/Monat jährlich = 2.988 €“ | — |
| MRR-Ziele | 750 → 3.735 → 12.450 → 24.900 € | — | — | rechnerisch = Instanzen × 149/249 € (stimmig), Kundenzahlen frei gesetzt | niedrig |

---

## 3 · Was das für MAKE OS heißt

### 3.1 Empfehlungen der frühen Synthese

| Frage | Empfehlung P11 | Meine Einschätzung |
|---|---|---|
| **Erste Zielgruppe** | Berater, Fractional Executives, Agenturinhaber, Beteiligungs-/Holding-Unternehmer **mit mehreren Gesellschaften**, DACH, ohne Angestellte | **Stark** — schärfer als C2, passt zum Gesellschafts-Register (B4.3), zu den Playbooks „Beratung“ und „Holding“ (D10) und zu Kevin selbst. Holding-Unternehmer sind zugleich der Fall, den kaum ein Werkzeug abdeckt. Mit P12 (Kundenstimme) gegenprüfen. |
| **Erste Edition** | „AI CEO Starter“: Cockpit + 4 Heads (Sales, Finance, Operations, IT) + Stapel + Fokus & Zeit + DATEV-Export | **Sinnvoll als Pilot-Edition**: nutzt, was da ist (Sales, Finance, IT gibt es; Operations ist Phase 2.2). Statt drei Editionen gleichzeitig **eine** starten — die anderen Editionen bleiben Plan. DATEV-Export ist neu und kostet Aufwand; vorher mit Kevins Steuerberater klären, ob er ihn wirklich braucht (T-04). |
| **Erster Preis** | 249 €/Monat (jährlich), BYOK 199 €, Pilot 149 €/Monat | Größenordnung plausibel und deckungsgleich mit P9-Spitzenedition; ChartMogul stützt Preise > 250 $ für bessere Bindung. Widerspruch 2.490/2.988 € klären. BYOK erst später (Support-Aufwand, Kostenkontrolle beim Kunden). |
| **Fahrplan** | 90 Tage: Phase 0 → Cockpit + Cache-Umbau + Einrichtungs-Assistent → Instanz-Fabrik v1 + DATEV + Demo; Recht: AVV, Art.-50-Hinweise, AGB-Prüfung, Lizenzen; Vertrieb: 10 Kandidaten → Demos → 3–5 zahlende Piloten; Events: „Fokus Innovation: AI CEO Roundtable“ mit 8 Gästen | **Deckt sich mit Teil F und P10.** In 90 Tagen ist es zu viel (Cockpit **und** Einrichtungs-Assistent **und** Instanz-Fabrik **und** DATEV **und** Lizenzen). Vorschlag: DATEV-Export und Lizenzen nach hinten, erst Phase 0 + Cockpit + Demo + 3 Piloten per Skript. |
| **Steuerung** | Aktivierung ≤ 48 Std., Annahmequote ≥ 60 %, Abwanderung < 2 %, KI < 15 % des Preises | Übernehmen — passt zu F2 und I3. „KI < 15 % des Preises“ = bei 249 € ≤ 37 € → gute KI-Budget-Grenze für D11. |
| **Nicht bauen** | Modelltraining, No-Code-Baukasten, Steuerberatung, Spam-Bots, isolierte Fitness-Tracker | Übernehmen. Punkt 5 betrifft uns: Gesundheit/Ernährung nur, wo es an Kapazität/Balance hängt (D7). |
| **Pflichten vor Kunde 1** | Art. 50, AVV, Art.-9-Einwilligungen, VVT, GoBD, § 7 UWG | Deckt sich weitgehend mit dem DSGVO-Ausbau (05.10.); **fehlt**: Datenübermittlung an den KI-Anbieter (Drittland, AVV mit Anbieter, Region) — kommt erst mit P7/P19. |

### 3.2 Was MAKE OS schon hat (P11 empfiehlt es als „einbauen“)
Prompt-Caching mit stabilem Systemteil, JSON-Schema, Prüfer, pass^k-Evals, Hintergrund-Arbeiter (Takt), Modellstufen, Hash-Kette, gebündelte Freigaben morgens/abends, Brain-Index nur im Arbeitsspeicher (B6.3–B6.6). → Gute Bestätigung des Bau-Stands; für die Außendarstellung nutzbar. Neu wären: **MCP als Anbindungsstandard** (eigene Werkzeuge als MCP-Server) und **Reflexions-/Prüfschleife vor Finanz-Ausgaben**.

---

## 4 · Abgleich mit `AI_CEO_MODUL.md`

| Abschnitt | Hypothese | P11 sagt | Ergebnis |
|---|---|---|---|
| C2 Für wen | Solo/Kleinst 0–5, DACH; Berater, Produkt, Agenturen, Coaches, Holding, Events | **eine** Zielgruppe: wissensbasierte Solo-Dienstleister mit Mehrgesellschafts-Struktur | **bestätigt + geschärft** (Coaches, Events, Produkt-Kleinunternehmen fallen vorerst raus) |
| C3 Positionierung | fertiges Führungsteam statt Werkzeugkasten | Konflikt „Baukasten vs. OS“ zugunsten OS aufgelöst | **bestätigt** |
| C4 Prinzipien | Mensch entscheidet, Trennung serverseitig, ehrliche Zahlen | als Auflösungen 1–2 und Risiken 1–2 | **bestätigt** — P11 selbst verletzt „ehrliche Zahlen“ (4,2 Mio., 87 %) |
| G1 Editionen | drei Editionen | **eine** Startedition „AI CEO Starter“ | **ergänzt/widerspricht** (Reihenfolge: erst eine Edition) |
| G2 Preis | Grundpreis + KI-Budget oder Pauschale | 249 € Pauschale mit Budget, BYOK-Variante | **bestätigt + ergänzt** (BYOK) |
| D3 / Phase 2 | Heads Operations, Product, People, Strategy ergänzen | Starter nur mit Operations neu; Product/People/Strategy später | **ergänzt** (Priorität: Operations zuerst) — beantwortet I1 Punkt 5 als Vorschlag |
| D7 Balance | Balance als Führungsgröße | Kapazitäts-/Balance-Ampel auf Rang 6; Boundary Theory als Begründung | **bestätigt** (Begründung wissenschaftlich, aber nicht geprüft) |
| D11 KI-Budget | Budget je Head | Budget je Head + Rückfall + BYOK; Ziel < 15 % des Preises | **bestätigt + Zielwert** |
| B4.2 Finanzen | Finanzplanung, Belege, Buchungen | **DATEV-Export** als Nutzen-Anker | **ergänzt** (nicht im Bauplan) |
| B9 Lücke 5 / Phase 3.2 | externe Menschen (Steuerberater) | Steuerberater-Gastportal ab Q3 | **bestätigt** |
| I2 Risiken | 8 Risiken | 10 Risiken mit Frühindikatoren; neu: Berufsrecht StBerG, Gründer-Überlastung, Einrichtungszeit | **ergänzt** |
| Teil F Phasen | 0 → 1 → 2 → 3 → 4 → 5 | 90-Tage-Plan zieht 5.1/5.3/5.4 nach vorn | **widerspricht teilweise** (zu viel parallel) |

---

## 5 · Offene Fragen und Lücken

1. **Endgültige P11 mit allen 18 Berichten** fehlt — besonders P12 (Kundenstimme), P13 (Weg zu 100 Kunden), P14 (Integrationen/DATEV), P18 (Umsatzströme), P7/P19 (KI-Anbieter, Brain).
2. **Preis-Widerspruch** P9 (99/149/249) · P10 (149/299/499) · P11 (249 Starter) → im Pilot testen (T-02), Kevin entscheidet danach.
3. **Wachstumsziele** Jahr 1: P9 35 · P11 100 · P10 1.000 Kunden — ein realistisches Zielbild wählen.
4. **DATEV-Export:** Wird er von der Zielgruppe wirklich gebraucht (Holding-Unternehmer mit Kanzlei vs. Berater mit Lexware/sevdesk)? Aufwand?
5. **Testwerte fehlen** im Export (T-01 bis T-03: Stichprobengrößen, Schwellen) — für die Piloten selbst festlegen (z. B. 5 Piloten, 30 Tage).
6. **Privatbereich-Akzeptanz (T-01)** ist die größte Wette des ganzen Produkts — erst Pilotdaten zeigen, ob Kunden Gesundheit/Familie ins selbe System geben.
7. **Freigabe-Müdigkeit (T-03):** Wie viele Freigaben am Tag erträgt ein AI CEO? Unser Stapel bündelt schon morgens/abends — messen.
8. **KI-Anbieter/Drittland** und „Zero-Data-Retention“-Behauptung im Einwand-Text vor jeder Außennutzung prüfen.

---

**Quellen der Prüfung (abgerufen 05.10.2026):**
[Destatis Erwerbstätige 2025](https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/01/PD26_001_13321.html) · [IfM Bonn Selbstständigenstatistik](https://www.ifm-bonn.org/en/statistics/self-employment-freelancers-in-the-liberal-professions/self-employment) · [MCP 2026-07-28 Release Candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) · [Claude-Preisseite](https://claude.com/pricing) · [Relevance AI Pricing 2026 (getmacha)](https://www.getmacha.com/blog/relevance-ai-complete-guide) · [Relevance AI Pricing (eesel)](https://www.eesel.ai/blog/relevance-ai-pricing) · [Artisan: SaaS Churn Benchmarks 2026](https://www.artisangrowthstrategies.com/blog/saas-churn-rate-benchmarks-2026-500-companies) · [Lonely Entrepreneur: 87,7 %](https://lonelyentrepreneur.com/founder-loneliness-mental-health-2026/) · [Sifted: Founders’ mental health 2025](https://sifted.eu/articles/founders-mental-health-2025) · [Digital Omnibus und Art. 50 (itmr-legal)](https://itmr-legal.de/blog/digitaler-omnibus-in-kraft) · [ChartMogul AI Churn Wave](https://chartmogul.com/reports/saas-retention-the-ai-churn-wave/)
