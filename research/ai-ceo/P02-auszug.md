# P02 · Auszug — Wettbewerb I: Arbeits-, Planungs- und Produktivitätssoftware mit KI

**Bericht:** `P02-wettbewerb-produktivitaet.md` („Wettbewerbsanalyse KI-Produktivitätssoftware 2026“, Gemini Deep Research) · **Drive:** https://docs.google.com/document/d/1dDbCJEXjBigG8trmrQhzhvJhu3Ph84WDS8xUsxDlkYI
**Ausgewertet:** 05.10.2026 · vollständig gelesen (52.206 Zeichen, 56 Quellen) · **Status: ungeprüfte KI-Recherche, Stichprobe unten**

> **Wichtigster Vorbehalt vorab:** Quelle [1] ist **unsere eigene Datei `AI_CEO_MODUL.md`**. Alle Aussagen zur Überlegenheit von MAKE OS, zur „unbesetzten Lücke“ und die komplette MAKE-OS-Zeile der Vergleichstabelle stützen sich darauf. Die Lücke ist damit **nicht unabhängig belegt**, sondern unsere Behauptung in Gemini-Worten.
> Zweiter Vorbehalt: Die übrigen Quellen sind fast ausschließlich **Review- und Vergleichsblogs**, oft Content-Marketing von Wettbewerbern (ClickUp schreibt über Sunsama [32], Saner.ai über Akiflow [35], Akiflow über sich selbst [36], Fyxer-Alternativen-Anbieter [16]). Herstellerpreisseiten wurden kaum direkt geprüft. Viele Aussagen sind als „Fakt“ markiert, sind aber Wertungen („überladene Oberfläche“, „Kollaps der persönlichen Kapazität“).

---

## 1 · Kernaussagen

| # | Aussage | Beleg im Bericht | Einordnung (Bericht → unsere Bewertung) |
|---|---|---|---|
| 1 | Die großen Work-OS (Notion, ClickUp, Asana, monday) sind auf Teams und Sitze gebaut; Solo-Nutzer zahlen für Team-Funktionen mit (monday: Mindestens 3 Sitze). | monday-Preisguides [4][10] | Fakt → **Fakt** (3-Sitze-Minimum ist bekannt; nicht separat geprüft) |
| 2 | KI wird 2025/26 zum Aufpreis mit Credits: Notion KI nur noch im Business-Plan (20 $/Nutzer jährl.), Custom Agents seit 04.05.2026 für 10 $ je 1.000 Credits; ClickUp Brain AI 9 $ / Everything AI 28 $ je Nutzer + Super Credits. | eesel [2], felloai [5], checkthat [3] | Fakt → **Fakt** (Stichprobe bestätigt; Bericht verschweigt 300 Gratis-Credits/Monat bei Notion und die Monatspreise 18 $/68 $ bei ClickUp) |
| 3 | Kein Anbieter verbindet Vertrieb, Finanzen, Steuern, Gesellschaften mit Kapazität, Gesundheit, Familie. | **[1] = unsere Datei** | Fakt → **plausibel, aber Zirkelbeleg**; für die untersuchten Anbieter stimmt es nach ihren Funktionslisten |
| 4 | Agenten handeln zunehmend selbst (Notion Agents bis 20 Min. mehrschrittig, ClickUp Super Agents als „Kollegen“, Motion „AI Employees“ verschieben Termine ohne Bestätigung), aber ohne formalen Freigabe-Stapel für Außenwirkung. | [13][22][15] | Fakt (Funktionen) / Meinung (Bewertung) → **Funktionen plausibel**; „keine Freigabe“ ist Wertung |
| 5 | Datenschutz-Merkmale (EU-Datenhaltung, Zero Data Retention bei LLM-Anbietern, Audit-Logs, SSO) liegen meist nur im Enterprise-Tarif. | [2][10] | Fakt → **plausibel**, nicht je Anbieter geprüft |
| 6 | Spezial-Assistenten (Fyxer 30–50 $/Monat, Reclaim, Akiflow 34 $/Monat) lösen Teilprobleme und treiben den Stack auf 150–300 $/Monat je Person. | [7][16][35] | Fakt → **Einzelpreise plausibel**, Stack-Summe ist Schätzung |
| 7 | Nutzerschmerz Nr. 1: Werkzeug-Ermüdung, 6–10 Apps, Datensilos, Kontextwechsel. | [56] (Autorenseite Henrique.AI) | Fakt → **Meinung**, Quelle ungeeignet |
| 8 | Nutzerschmerz: intransparente Preise durch Sitz-Minima und Credit-Pools („Kostenexplosion zum Monatsende“). | [3] | Fakt → **plausibel** (Credit-Modelle belegt, Kostenexplosion anekdotisch) |
| 9 | Dilemma: Baukästen (Notion, Airtable) = tagelange Einrichtung; Projekt-Werkzeuge (Asana, ClickUp) = Bürokratie für Teams. | [11][3] | Meinung → **Meinung**, gut nachvollziehbar |
| 10 | Trends 2026–28: Agentic Workspaces, Kalender als Steuerzentrale, Energie/Privat in der Planung, EU-Datensouveränität, Human-in-the-Loop als Standard. | überwiegend [1] | Trend → **Meinung**, teils aus unserer Datei gespiegelt |
| 11 | Mögliche Nachrücker: Motion („AI Employee SuperApp“), Reclaim (über Dropbox), Notion (Custom Agents + Mail + Kalender), Saner.ai (ADHS/Solo-Gründer). | [18][7][2][19] | Schätzung → **plausibel**; Liste unvollständig (Microsoft/Google fehlen als Bedrohung, Tycoon fehlt — siehe P03) |
| 12 | Übernehmenswert: Tastatur/Command-Bar (Linear, Superhuman, Akiflow), geführte Morgen-/Abendrituale (Sunsama), Playbooks statt leerer Fläche (Gegenmodell zu Notion), feste KI-Budgets statt Credits. | [52][8][36] | Meinung → **Meinung**, sinnvoll |

## 2 · Zahlen

| Größe | Wert laut Bericht | Quelle (Bericht) | Datum | Belastbarkeit | Prüfvermerk |
|---|---|---|---|---|---|
| Notion Business inkl. KI | 20 $/Nutzer/Monat jährl. (24 $ monatl.); 10-$-Add-on ab Mai 2025 für Neukunden eingestellt | felloai [5] | Mai 2025 | hoch | ✅ im Kern bestätigt |
| Notion Custom Agents | 10 $ je 1.000 Credits seit 04.05.2026 | eesel [2] | 05/2026 | hoch | ✅ bestätigt; **fehlt im Bericht:** 300 Credits/Workspace/Monat gratis, nur Business/Enterprise, ~30–100 Läufe je 1.000 Credits |
| Notion Nutzer / Bewertung | > 100 Mio. registriert / ~10 Mrd. $ | [2] | — | mittel | ⚠ prüfen: 10 Mrd. $ ist die Bewertung von **2021**, veraltet |
| ClickUp KI | Brain AI 9 $, Everything AI 28 $ je Nutzer; Super Credits 0,001 $ | checkthat [3] | 2026 | hoch | ✅ bestätigt (bei Jahreszahlung; monatlich 18 $ / 68 $) |
| ClickUp Finanzierung | 537 Mio. $, 4 Mrd. $ Bewertung | — | — | mittel | ⚠ prüfen: 4 Mrd. $ ist Stand **2021** |
| monday Preise | 9/12/19 $ je Sitz, min. 3 Sitze | [4] | 2026 | hoch | nicht geprüft (bekannte Preisstruktur) |
| monday Kunden / Umsatz | > 225.000 / > 800 Mio. $ | — | — | gering | ⚠ veraltet: monday lag schon 2024 bei ~972 Mio. $ Umsatz (aus Wissen, nicht nachgeschlagen) |
| monday KI-Credits | ~8 Credits je Aktion, ~0,01 $/Credit | [10] | 2026 | gering | ⚠ prüfen: nur ein Blog |
| Asana Preise | Starter 10,99 $, Advanced 24,99 $ | [3] | 2026 | hoch | nicht geprüft |
| Asana Kunden / Umsatz | > 150.000 / ~650 Mio. $ | — | — | gering | ⚠ veraltet/zu niedrig (Asana lag im GJ 2025 über 700 Mio. $; aus Wissen, nicht nachgeschlagen) |
| Motion Preise | Pro AI 19 $ jährl. / 29 $ monatl.; Business 29 $; „AI Employees“ bis 49 $ | [25][6] | 2026 | mittel | nicht geprüft |
| Motion Umsatz | „zweistelliger Millionen-ARR“ | — | — | gering | ⚠ unbelegt |
| Reclaim | 0 / 10 / 15 $; > 40.000 Organisationen; von Dropbox übernommen | [7] | 2026 | mittel | Übernahme durch Dropbox (2024) bekannt; Zahl nicht geprüft |
| Sunsama | 17 $ jährl. (204 $/Jahr) / 22 $ monatl., kein Gratisplan | [8] | 2026 | hoch | ✅ bestätigt (Stand Juli 2026). **Widerspruch zu P04**, dort 16–20 $ (veraltet) |
| Akiflow | 34 $/Monat monatlich | [35] | 2026 | mittel | nicht geprüft |
| Fyxer | 30 $/22,50 $ Starter; 50 $/37,50 $ Pro; ARR ~35 Mio. $ (Feb. 2026) nach 10-Mio.-$-Runde (20VC), Bewertung ~60 Mio. $ | Sacra [9], eesel [16] | 02/2026 | **gering** | ⚠ **abweichend**: Die 10-Mio.-$-Series-A (20VC) war **März 2025**; danach kam eine **30-Mio.-$-Series-B (Madrona, Sept. 2025)**, die der Bericht verschweigt. ~30 Mio. $ ARR Ende 2025 ist belegt; die Bewertung „60 Mio. $“ ist nicht auffindbar und bei 30+ Mio. $ ARR unplausibel. |
| Microsoft 365 Business | „ab ~12,50 [Bild]/Nutzer/Monat“ | — | — | gering | ⚠ Text im Original kaputt (Formelbild), Copilot-Aufpreis fehlt |
| Google Workspace + Gemini | ab ~6 $ + Gemini-Add-on ~20–30 $ | — | — | gering | ⚠ veraltet: Gemini ist seit 2025 in Workspace-Tarife eingepreist (aus Wissen, nicht nachgeschlagen) |
| Stack-Kosten Solo | 150–300 $/Monat | [7] | — | gering | ⚠ Schätzung aus einem Reclaim-Review |
| Apps je Solo-Unternehmer | 6–10 | [56] | — | gering | ⚠ Quelle ungeeignet |

**Stichprobe (Web, 05.10.2026):** 4 Zahlen geprüft — **3 bestätigt** (Notion-Credits, ClickUp-KI-Preise, Sunsama-Preis), **1 abweichend** (Fyxer: Finanzierung falsch datiert, Series B verschwiegen, Bewertung nicht auffindbar).
Belege: [Notion Credits ab 04.05.2026](https://techresolve.blog/2026/03/04/notion-credits-to-cost-10-per-1000-for-notions/) · [Notion Custom Agents Pricing](https://almcorp.com/blog/notion-custom-agents/) · [ClickUp Pricing (eesel)](https://www.eesel.ai/blog/clickup-pricing) · [ClickUp Pricing (Rock)](https://www.rock.so/blog/clickup-pricing) · [Fyxer Series B (LionHerald)](https://lionherald.com/uk-ai-startup-fyxer-ai-secures-30-million-series-b-as-it-eyes-50-million-arr-by-year%E2%80%90end/) · [Madrona zu Fyxer](https://www.madrona.com/fyxer-ai-productivity-tools-for-email-and-meetings/) · [Sunsama Pricing 2026](https://ellieplanner.com/productivity-copilot/sunsama-pricing)

## 3 · Was das für MAKE OS heißt

**Pflicht (sonst kein Wechsel)**
1. **Kalender bidirektional und verlässlich** (M365, Google, Apple) — Kalender ist laut Bericht die Steuerzentrale der Kategorie. Unser Apple-Weg läuft über den Mac-Zulieferer; für Kunden ohne Mac braucht es einen Plan (CalDAV/iCloud).
2. **Geführte Rituale** (Tagesstart, Tagesabschluss, Woche) im Stil Sunsama — haben wir als Tageslauf/Loops; im Cockpit sichtbar und zeitlich begrenzt machen („in 10 Minuten durch“).
3. **Schnellerfassung + Tastatursteuerung** (Command-Bar, globale Kürzel) — Maßstab Linear/Akiflow/Superhuman. Fehlt in Teil D; als Paket ergänzen.
4. **Import-Assistenten** (Kontakte, Aufgaben, Notion-Strukturen, Kalender) — Wechselhürde; gehört in Phase 5.1 (geführte Einrichtung).
5. **„Belegt“-Spiegelung privater Termine** (Reclaim-Muster) — haben wir als Sichtregel (D7); als Funktion klar benennen.

**Abheben**
- Freigabe-Stapel mit Vorher/Nachher und „was passiert, wenn ich nichts tue“ — Reclaim führt gerade erst einen „Preview Mode“ (Beta) ein; Motion verschiebt ohne Bestätigung. Das ist ein echter, prüfbarer Unterschied.
- Finanzen/Steuern/Gesellschaften im selben System wie Zeit — kein untersuchter Anbieter hat das.
- **KI-Budget statt Credit-Falle** (D11) — direkte Antwort auf das, was Notion/ClickUp/monday 2025/26 eingeführt haben. Preisseite muss das sichtbar machen.
- Kein Sitz-Minimum, Instanz-Preis.

**Verkaufsargumente** („Warum MAKE OS statt X“, verkürzt aus dem Bericht, geprüft)
- *statt Notion:* fertig statt Baukasten; KI ohne Credit-Rechnung. (Das „US-Multi-Tenant“-Argument nur mit Belegen nutzen — Notion bietet nach unserem Kenntnisstand für Enterprise EU-Datenhaltung an — vor Verwendung prüfen.)
- *statt Motion:* Mensch entscheidet statt Algorithmus verschiebt; dazu Geschäftslage.
- *statt Sunsama/Akiflow:* Ritual **plus** die Daten dahinter (CRM, Finanzen) — ersetzt Abos statt sie zu bündeln.
- *statt ClickUp/monday/Asana:* für einen Menschen gebaut, keine Sitze, keine Team-Bürokratie.
- *statt Fyxer/Superhuman:* Mail als Teil von Kundenakte, Pipeline und Woche.

**Risiken**
- **Preisanker sind niedrig** (10–34 $ je Nutzer). Ein Preis von 99–199 € muss mit „ersetzt X Abos + Führungsteam“ begründet und vorgerechnet werden.
- **Konvergenz der Großen:** Notion (Agents + Mail + Calendar), Microsoft (Copilot + EU Data Boundary), Google (Gemini im Workspace) — der Bericht unterschätzt Microsoft/Google als Bedrohung; beide haben EU-Datenhaltung und Freigabe vor dem Senden.
- „EU-Datenhaltung“ allein ist **kein Alleinstellungsmerkmal** mehr; unser Unterschied ist **eigene Instanz + serverseitige Privat/Business-Trennung + Freigabe-Pflicht** — so formulieren.

## 4 · Abgleich mit `AI_CEO_MODUL.md`

| Unsere Hypothese | Ergebnis | Begründung / Verweis |
|---|---|---|
| **C3 Kategorie „Aufgaben/Projekt mit KI“** (Notion, ClickUp, Asana, monday: kein Privatleben, keine Führungsebene, keine Finanzen) | **bestätigt** | Steckbriefe Notion/ClickUp/monday/Asana; Funktionslücken plausibel. |
| **C3 Kategorie „KI-Kalender“** (Motion, Reclaim, Sunsama, Akiflow: nur Zeit) | **bestätigt, mit Nuance** | Motion wandert Richtung „AI Employees“ (→ Kategorie Agenten), Reclaim spiegelt Privat/Business als „Busy“ — also eine **Teil**-Verbindung von Privat und Business existiert schon. |
| **C3 Behauptung** (niemand vereint die vier Punkte) | **nicht widerlegt, aber nur zirkulär belegt** | Gap-Kapitel stützt sich auf [1]. Neulinge 2025/26 kaum gesucht (nur Saner.ai). P03 findet mit **Tycoon** einen direkten „AI-CEO“-Anbieter. |
| **D2 Cockpit / D4 Rhythmus** | **bestätigt (Muster)** | Sunsama-Rituale als bewährtes Muster; Kalender als Steuerzentrale. |
| **D5 Entscheidungssystem / Stapel** | **bestätigt als Unterschied** | Kein untersuchter Anbieter hat einen Freigabe-Stapel für Außenwirkung (Fyxer: Entwurf + Klick ist das nächste Muster). |
| **D10 Playbooks** | **bestätigt** | Empfehlung „Playbooks statt leerer Fläche“. |
| **D11 KI-Budget** | **stark bestätigt** | Credit-Modelle bei Notion, ClickUp, monday, Motion belegt. |
| **D (neu)** | **ergänzt** | Command-Bar/Tastatur, Import-Assistenten fehlen in Teil D. |
| **F Plan** | **ergänzt** | Import + Kalender-Verlässlichkeit gehören in Phase 5.1 (Einrichtung); Command-Bar als kleines Paket in Phase 1. |
| **G1/G2 Editionen & Preise** | **gestützt** | Markt bewegt sich zu Sitz + Credits; unser „Instanz + Budget“-Modell ist Gegenposition. Vergleichspreise der C3-Kategorien liegen jetzt vor (Tabelle oben). |
| **G4 Kaufgründe** | **teilweise bestätigt** | „Ein Ort für alles“ und „fertiges Team statt Werkzeugkasten“ passen zu Schmerz 1 und 3; Belege schwach. |
| **I2 Risiken** | **ergänzt** | Neu: Konvergenz Notion/Microsoft/Google; niedrige Preisanker; EU-Datenhaltung kein Alleinstellungsmerkmal mehr. |

## 5 · Offene Fragen / Lücken des Berichts

1. **Frage 7 (wer verbindet Privat und Business?)** praktisch nicht beantwortet — nur Reclaim-„Busy“ und Motion-Zeitfenster. Life-OS-Anbieter, Notion-Vorlagen fehlen hier (teilweise in P04).
2. **Neulinge 2025/2026** nicht aktiv gesucht (Prompt verlangte das ausdrücklich); nur Saner.ai.
3. Todoist, Things, TickTick, Amie, Morgen, Superhuman, Shortwave, Linear, Coda, Airtable nur in einem Sammelabsatz, **ohne Preise, ohne Datenschutzangaben**.
4. **Microsoft 365 Copilot und Google Gemini** ohne Quellen, mit kaputtem/veraltetem Preis; keine Bewertung als Hauptbedrohung.
5. **Nutzerschmerzen** ohne Zahlen, ohne Zitate, ohne Häufigkeiten — „Rangliste“ ist eine Gliederung, keine Auswertung von G2/Capterra/Reddit.
6. **Datenschutz je Anbieter** (EU-Region, AVV, Training) nur pauschal; ob und für welche Tarife Notion, ClickUp, Motion EU-Datenhaltung anbieten, ist nicht sauber geklärt (selbst nachschlagen).
7. Frage 10 („Screenshots-Beschreibung/Links“ der besten Muster) fehlt.
8. Unternehmenszahlen (Bewertungen, Umsätze) teils von 2021 — veraltet.
