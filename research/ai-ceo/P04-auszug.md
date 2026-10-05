# P04 · Auszug — Wettbewerb III: Privatleben, Gesundheit, Familie, persönliche Finanzen, Second Brain

**Bericht:** `P04-privat.md` („Marktanalyse Privat- und Business-Software“, Gemini Deep Research) · **Drive:** https://docs.google.com/document/d/1Q-2gc78G1Ox4-qJHcYkSoKfC9uHxpTiiRJGdESa15NM
**Ausgewertet:** 05.10.2026 · vollständig gelesen (76.405 Zeichen, 75 Quellen) · **Status: ungeprüfte KI-Recherche, Stichprobe unten**

> **Wichtigster Vorbehalt vorab:** Quelle [1] ist **unsere eigene Datei `AI_CEO_MODUL.md`**. Darauf stützen sich: das „dreistufige Einwilligungsmodell als etablierter Standard“, die „modernen Schutzmuster“ (Single-Tenant + AES-256-GCM, Suchindex nur in tmpfs, Hash-Ketten, serverseitige Schirmung), die Kaufgrund-These „Asymmetrie“, die Funktionsrangliste und das Vermarktungsnarrativ. Das sind **unsere eigenen Entscheidungen, als Marktstandard ausgegeben** — kein externer Beleg.
> Zweiter Vorbehalt: Die Kernthese „Privat + Business zusammen ist ein Kaufgrund“ ist nur mit **indirekten** Belegen gestützt (Verkaufszahlen einer Notion-Vorlage, Sunsama-Werbeaussagen, Burnout-Statistiken aus Blogs). Eine Umfrage oder Studie zur Nachfrage nach einem gemeinsamen System gibt es im Bericht nicht.
> Dritter Vorbehalt: mehrere **innere Widersprüche** (Whoop-Bewertung 10,1 Mrd. $ vs. „1,1 Mrd.“ in der Quellentabelle; Oura „geplanter IPO 2026“ vs. „IPO verschoben“; Ultrahuman „> 150.000 Nutzer“ vs. ~700.000 monatlich aktive laut Presse).

---

## 1 · Kernaussagen

| # | Aussage | Beleg im Bericht | Einordnung (Bericht → unsere Bewertung) |
|---|---|---|---|
| 1 | Wenn Agenten die Routine übernehmen, wird die Energie und Aufmerksamkeit des Gründers zur Wachstumsgrenze. | [1] | Fakt → **Meinung/These** (unsere eigene A1-These) |
| 2 | Erholungs-Wearables sind ein Massenmarkt: Oura 5,7 Mio. zahlende Mitglieder (Sept. 2026), Whoop 2,5 Mio. Mitglieder und 10,1 Mrd. $ Bewertung (Series G). | Sacra [5][7], Wikipedia [6] | Fakt → **Fakt** (Stichprobe bestätigt) |
| 3 | HRV (RMSSD) hängt mit Arbeitsgedächtnis, Reaktionszeit, kognitiver Flexibilität zusammen (Neuroviszerales Integrationsmodell, Thayer & Lane; systematische Reviews). | Forte et al. [10], PMC-Review [14], PLOS ONE [11] | Fakt → **Fakt als Korrelation** |
| 4 | „Arbeit an Erholung anpassen verhindert nachweislich Fehlbelastungen.“ | Neurosity [13], [10] | Fakt/Meinung → **nicht belegt**: Die zitierten Studien zeigen Zusammenhänge, keine Wirksamkeit einer HRV-gesteuerten Tagesplanung. Neurosity ist ein Hersteller. |
| 5 | Gründer sind überlastet: 54 % Burnout (Sifted, 138 Gründer), 72 % Erschöpfung, 57 % > 80 h/Woche (StealthAgents); Mental Load trifft Gründer-Eltern besonders. | mean.ceo-Blog [15], StealthAgents [2], Pew [16] | Fakt → **schwach**: Sekundärblogs bzw. Agentur-„Research“; Pew (Juni 2026) plausibel, nicht geprüft |
| 6 | Solo-Selbstständige verbringen 8,7 % ihrer Arbeitszeit mit Bürokratie (KfW). | KfW [22] | Fakt → **Fakt** (bestätigt; Quelle ist das KfW-Mittelstandspanel, nicht der Gründungsmonitor) |
| 7 | Private Finanz-Apps (YNAB, Monarch, Copilot, Finanzguru, Outbank, MoneyWiz) trennen privat und geschäftlich oder behandeln Geschäftsüberschuss als Gehalt; keine kennt Steuer-Vorauszahlungen und „sicher entnehmbaren Unternehmerlohn“. | Sable Spend [20], bankdaten.de [21] | Fakt → **plausibel** (Funktionslisten), Lücke so nicht widerlegt |
| 8 | Second-Brain-Markt spaltet sich: Cloud mit Agenten (Tana, Notion) vs. lokal/dateibasiert (Obsidian, Anytype) mit Zulauf wegen Datenhoheit. | Blogs [23][25][26] | Fakt → **Meinung/Trend**, schwach belegt |
| 9 | EU AI Act Art. 50 (Transparenzpflichten) gilt seit 02.08.2026: KI-Interaktion kennzeichnen, synthetische Inhalte maschinenlesbar markieren; Bußgeld bis 15 Mio. € / 3 %. | EU-Kommission [27][58], Wavect [28] | Fakt → **Fakt** (Geltungsbeginn bestätigt; Digital-Omnibus hat Art. 50 **nicht** verschoben) — aber Details falsch, siehe Nr. 10 |
| 10 | Art. 50 verlange „menschliche Aufsichtspflichten“ und Freigabe vor Außenwirkung. | [1] | Fakt → **falsch zugeordnet**: Menschliche Aufsicht ist Art. 14 (Hochrisiko). Art. 50 ist Transparenz. Freigabe-Pflicht ist bei uns Produktentscheidung, keine Art.-50-Pflicht. |
| 11 | Zentrale Cloud-Speicher sind riskant: Ultrahuman-Vorfall 27.03.2026 (Mitarbeiter-Laptop mit Schadsoftware, Zugang zu Analysesystem). | MakeUseOf [31] | Fakt → **Fakt** (bestätigt; ~700 betroffene Nutzer, Lesezugriff, bekannt gemacht im Juni 2026) |
| 12 | Nachfrage nach „Leben + Arbeit in einem System“: Thomas Franks Notion-Vorlage „Ultimate Brain“ 760.000 $ im ersten Jahr, 2,5–3 Mio. $ gesamt; Sunsama-Nutzer berichten 78 % weniger Arbeitsangst, 87 % Kalenderruhe. | GreyJournal [55], easy.tools [60], Blogs [32][33] | Fakt → **schwach**: Vorlagen-Verkäufe sind ein Indiz, kein Beleg für „Privat + Business“; die 78/87 % stammen aus Blogs ohne Methodik |
| 13 | Forschungsstreit: Boundary Theory (Erholung braucht strikte Trennung) vs. Integration (Solo-Unternehmer können nicht trennen). Lösung laut Bericht: **asymmetrische Schirmung** — Ressourcen gemeinsam planen, Inhalte trennen. | Nippert-Eng (ohne Link), [1] | Meinung → **Meinung**; der Gegenpol (Trennung) ist ernst zu nehmen |
| 14 | Bewusst nicht bauen: keine medizinische Diagnostik (MDR), keine Steuerberatung/ELSTER-Übermittlung, keine Team-Chats/Feeds, keine Agenten-Autonomie nach außen. | [1] | Meinung → **sinnvolle Empfehlung** (rechtlich: MDR und Steuerberatungsgesetz anwaltlich bestätigen) |

## 2 · Zahlen

| Größe | Wert laut Bericht | Quelle (Bericht) | Datum | Belastbarkeit | Prüfvermerk |
|---|---|---|---|---|---|
| Oura zahlende Mitglieder | 5,7 Mio. | Wikipedia [6] | Sept. 2026 | hoch | ✅ bestätigt |
| Oura Umsatz / IPO | 1,4 Mrd. $ TTM; „geplanter IPO 2026“; Bewertung 11 Mrd. $ → Ziel 15,6 Mrd. $ | Sacra [5], Mostly Metrics [4] | 09/2026 | mittel | ⚠ **teils überholt**: IPO am 29.09.2026 **verschoben** (Bericht widerspricht sich selbst); IPO-Bewertung lag bei ~15 Mrd. $. 1,4 Mrd. $ TTM nicht geprüft |
| Whoop Bewertung | 10,1 Mrd. $ (Series G, 575 Mio. $, „April 2026“, „unter Führung von Abbott und Mayo Clinic“) | Sacra [7], Wikipedia [8] | 2026 | hoch (Wert) / gering (Details) | ✅ 10,1 Mrd. $ und 575 Mio. $ bestätigt — aber **31.03.2026**, angeführt von **Collaborative Fund** (Abbott, Mayo Clinic nur beteiligt). Quellentabelle nennt „1,1 Mrd.“ — Widerspruch |
| Whoop Mitglieder / Preis | > 2,5 Mio.; 30 $/Monat oder 239–399 $/Jahr | [7] | 2026 | hoch / mittel | ✅ 2,5 Mio. bestätigt; Preis nicht geprüft |
| Ultrahuman | > 150.000 aktive Nutzer [Schätzung], ~70 Mio. $ Umsatz; Ring 349 € ohne Abo | Sacra [45], [41] | 2026 | gering | ⚠ **abweichend**: Presse nennt ~700.000 monatlich aktive Nutzer |
| Ultrahuman-Vorfall | 27.03.2026, „Hunderte Kunden“ | MakeUseOf [31] | 03/2026 | hoch | ✅ bestätigt (~0,1 % von ~700.000 MAU, Lesezugriff, keine Passwörter/Zahlungsdaten) |
| Apple-Watch-Nutzer | > 150 Mio. [Schätzung] | — | — | gering | ⚠ ohne Quelle |
| Garmin Connect | > 50 Mio. Profile [Schätzung] | — | — | gering | ⚠ ohne Quelle |
| Skylight | > 1 Mio. Haushalte; Plus 79 $/Jahr | Skylight [18] | 10/2026 | mittel | Herstellerangabe, nicht geprüft |
| Maple / FamilyWall / Cozi / Hearth | 250.000 Familien / 5 Mio. Downloads / 20 Mio. registriert / < 50.000 | [47][19] | — | gering | ⚠ Schätzungen, z. T. aus Wettbewerber-Blog (Kinmory [47]) |
| Finanz-Apps Preise | YNAB 14,99 $/109 $; Monarch 99 $/Jahr; Copilot 95 $/Jahr; Finanzguru 2,99–3,99 €; Outbank 39,99 €/Jahr; MoneyWiz 49,99 $/Jahr | [20][21] | 2026 | mittel | nicht geprüft |
| PKM Preise | Obsidian Sync 4–5 $; Tana 14–20 $; Capacities ~10 $; Heptabase 8,99–23,99 $; Reflect 10 $ | [24] | 2026 | mittel | nicht geprüft |
| Gründer-Burnout | 54 % (Sifted, n = 138), 75 % Angst | mean.ceo-Blog [15] | 2025 | **gering** | ⚠ prüfen: Sifted-Originalumfrage nicht verlinkt |
| Gründer-Erschöpfung | 72 %; 57 % > 80 h/Woche; 19 % delegieren wirksam | StealthAgents [2] | 2026 | **gering** | ⚠ Quelle ist eine Personalagentur, keine Methodik |
| Bürokratie-Anteil Solo | 8,7 % der Arbeitszeit | KfW [22] | 04/2025 | hoch | ✅ bestätigt (KfW-Mittelstandspanel; Mittelstand gesamt 7 %) |
| Sunsama-Wirkung | 78 % weniger Arbeitsangst, 87 % Kalenderruhe | Blogs [32][33] | — | **gering** | ⚠ ohne Methodik, vermutlich Herstellerwerbung |
| Sunsama Preis | 16–20 $/Monat | [33] | — | gering | ⚠ veraltet: 17 $ jährl. / 22 $ monatl. (siehe P02) |
| Notion-Vorlage „Ultimate Brain“ | 760.000 $ im 1. Jahr; 2,5–3 Mio. $ gesamt | [55][60] | 2025/26 | gering–mittel | ⚠ prüfen: easy.tools-Titel spricht von „1 Mio. $“ |
| HRV-Review | 12 Studien, 24.390 Probanden | PMC10780278 [14] | 2024 | mittel | nicht geprüft (Primärquelle verlinkt) |
| AI Act Art. 50 | gilt ab 02.08.2026; bis 15 Mio. € / 3 % | [27][28] | 2026 | hoch | ✅ Geltungsbeginn bestätigt (nicht vom Digital-Omnibus verschoben, der am 27.07.2026 in Kraft trat); Bußgeldhöhe nicht neu geprüft |

**Stichprobe (Web, 05.10.2026):** 5 Angaben geprüft — **3 bestätigt** (Oura 5,7 Mio., KfW 8,7 %, AI-Act-Art.-50-Termin), **2 bestätigt mit Fehlern im Detail** (Whoop: Datum und Lead-Investor falsch; Ultrahuman: Vorfall stimmt, Nutzerzahl falsch). Zusätzlich: Oura-IPO wurde am 29.09.2026 verschoben.
Belege: [Oura verschiebt IPO (TechCrunch)](https://techcrunch.com/2026/09/29/oura-shelves-its-2-2b-ipo-citing-uncertainty-in-the-market/) · [Oura 5,7 Mio. Mitglieder (Pulse 2.0)](https://pulse2.com/oura-postpones-nasdaq-ipo-despite-strong-demand-as-membership-reaches-5-7-million/) · [Whoop Series G (BusinessWire)](https://www.businesswire.com/news/home/20260331399622/en/WHOOP-Raises-$575-Million-at-$10.1-Billion-Valuation-to-Advance-Global-Health-Platform) · [Ultrahuman-Vorfall (TechCrunch)](https://techcrunch.com/2026/06/03/ultrahuman-says-hackers-accessed-customers-wellness-data-via-internal-tool/) · [KfW: 7 % Bürokratie, Solo 8,7 % (VGSD)](https://www.vgsd.de/kfw-mittelstandspanel-buerokratiebelastung-bei-solo-selbststaendige-am-hoechsten/) · [Art. 50 nicht verschoben (Jones Walker)](https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html?id=102nbon) · [Digital Omnibus in Kraft (Usercentrics)](https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/)

## 3 · Was das für MAKE OS heißt

**Privat-Funktionen mit Priorität** (Bericht-Rangliste, von uns geprüft)
1. **Steuer- und Haushalts-Runway mit „sicher entnehmbarem Unternehmerlohn“** — die am klarsten belegte Lücke (keine Finanz-App kann das). Wir haben Finanzplanung Privat + Business und Runway Privat (B4.2/B5); neu wäre eine **eine Zahl** im Cockpit: „So viel kannst du diesen Monat gefahrlos entnehmen“ (Rücklagen für ESt/GewSt/USt-Vorauszahlungen abgezogen). Hohe Priorität, weil ohne Gesundheitsdaten und ohne Einwilligungsfragen.
2. **Geschützte Zeit, asymmetrisch** — Familien-/Gesundheitsblöcke sperren Agenten-Terminvorschläge; Business sieht nur „belegt“. Haben wir als Regel (D7), muss technisch erzwungen und sichtbar sein.
3. **Energie als Hinweis, nicht als Steuerung** — HRV/Schlaf nur mit Einwilligung, nur als Vorschlag („heute leichtere Arbeit“). Wirksamkeit ist **nicht** belegt → keine Leistungsversprechen, keine Gesundheitsaussagen (MDR).
4. **Mehr Wearables:** Oura (5,7 Mio.) ist mehr als doppelt so groß wie Whoop (2,5 Mio.); Apple Health hat keine Server-Schnittstelle (nur über das Gerät/den Mac-Zulieferer), Garmin hat ein Partnerprogramm. Für verkaufbare Instanzen: **Oura-Anbindung** als nächste Quelle prüfen; Nutzungsbedingungen der Whoop-/Oura-Schnittstellen für **gewerbliche Mehrkunden-Nutzung** klären.
5. **Rituale** (Tagesstart/Feierabend) — vorhanden; im Cockpit als „Feierabend freigeben“ ausformen.
6. **Dokumenten-Eingang** (Foto von Elternbrief/Rechnung → Termin/Aufgabe) — Muster aus Familien-Apps (Skylight „Magic Import“); mittlere Priorität.

**Wie wir die Verbindung verkaufen**
- Leitsatz aus dem Bericht (passt zu C4 Prinzip 4): **„Business sieht nie Privates — aber Privat steuert das Business.“**
- Gegenposition ernst nehmen: Ein Teil der Zielgruppe will **Trennung** (Boundary Theory). Deshalb Privat als **abschaltbaren** Bereich anbieten (Phase 0.4 Modul-Schalter, Edition ohne Privat) und den Nutzen über **gemeinsame Ressourcen** (Zeit, Geld, Energie) erklären, nicht über „alles an einem Ort“.
- Vertrauensargument mit echtem Fall: Ultrahuman 2026 — zentrale Cloud, ein kompromittierter Mitarbeiter-Laptop. Unser Gegenmodell: eigene Instanz, verschlüsselte Bestände, Index nur im Arbeitsspeicher. Belegbar, weil gebaut (B2.1).

**Bewusst nicht bauen** (Bericht, unterstützt): Diagnose/Therapie/Ernährungstherapie (MDR-Risiko), Steuerberatung und ELSTER-Übermittlung (Steuerberatungsgesetz — Export für Steuerberater statt eigener Erklärung), Team-Chats/Feeds, autonome Außenwirkung.

**Risiken**
- **Rechtsfrage Energie-Ableitung:** Wenn MAKE OS aus HRV/Schlaf „Belastung“ ableitet, ist zu prüfen, ob das als **Emotionserkennung** im Sinne des AI Act gilt (Art. 50 Abs. 3 Hinweis-Pflicht; für Arbeitsplätze mit Beschäftigten sogar Art. 5 Verbot). Für den Inhaber selbst vermutlich unkritisch, für spätere Kunden **mit Mitarbeitern** heikel → in P07 / anwaltlich klären.
- Gesundheits-Hinweise dürfen nicht als medizinische Aussage wirken (MDR).
- Die Kaufgrund-These „Privat + Business“ bleibt **unbewiesen** — erst Interviews/Piloten.

## 4 · Abgleich mit `AI_CEO_MODUL.md`

| Unsere Hypothese | Ergebnis | Begründung / Verweis |
|---|---|---|
| **A1/C2 „Ein AI CEO ist ein ganzer Mensch“, Privatleben zählt** | **gestützt, schwach belegt** | Burnout-/Mental-Load-Daten (Kap. 3) zeigen Belastung; Beleg, dass Kunden deshalb ein gemeinsames System **kaufen**, fehlt. |
| **C3 Kategorie „Life OS / persönliche Systeme“** (Notion-Vorlagen, Obsidian, Whoop/Oura — kein Business) | **bestätigt** | Alle untersuchten Privat-Produkte haben keine Business-Anbindung (Tabellen Kap. 2). |
| **C3 Behauptung Punkt (1)** (Privat + Business mit serverseitiger Trennung) | **nicht widerlegt** | Kein untersuchtes Produkt trennt asymmetrisch; ChatGPT-Gedächtnis und Gemini mischen beides in einem Profil (Kap. 2, persönliche KI). |
| **C4 Prinzip 4** (Trennung serverseitig) | **bestätigt als Verkaufsargument** | Leitsatz „Business sieht nie Privates — Privat steuert das Business“. |
| **D7 Balance-Steuerung** | **bestätigt mit Einschränkung** | HRV-Kognition-Zusammenhang belegt, **Wirksamkeit** einer HRV-gesteuerten Planung nicht. → D7 bleibt Hinweis, keine Automatik. Neu: Rechtsfrage Emotionserkennung (AI Act). |
| **D8 CEO-Index** | **nicht behandelt** | — |
| **D2 Cockpit** | **ergänzt** | Kachel „sicher entnehmbarer Unternehmerlohn“ (aus Finanzplan + Steuer-Rücklagen). |
| **B2.3 Datenschutz / D13** | **bestätigt (zirkulär)** | Drei Einwilligungen, tmpfs-Index, Hash-Kette — im Bericht als „Standard“ beschrieben, aber aus unserer Datei. Datenminimierung neu: Roh-Messwerte (RR-Intervalle) nicht speichern — prüfen, ob wir das schon tun. |
| **F Plan** | **ergänzt** | Phase 4.1 (Balance): Oura-Anbindung prüfen; „Unternehmerlohn“-Kennzahl kann schon in Phase 1.1 (Cockpit) kommen, da nur vorhandene Daten. |
| **G1 Editionen** | **gestützt** | Edition ohne Privat (Markttraktion) ist richtig — es gibt Nutzer, die Trennung wollen. |
| **G4 Kaufgrund 2** („Ein Ort für alles — inklusive Privatleben“) | **schwach gestützt / umformulieren** | Besser: „gemeinsame Ressourcen planen, Inhalte strikt trennen“. |
| **I2 Risiken** | **bestätigt + ergänzt** | Bestätigt: „Privates sickert ins Business“. Neu: AI-Act-Einordnung der Energie-Ableitung; MDR-Grenze; Steuerberatungsgesetz-Grenze; Abhängigkeit von Wearable-Schnittstellen (Nutzungsbedingungen). |

## 5 · Offene Fragen / Lücken des Berichts

1. **Kein direkter Beleg** (Umfrage, Studie, Interviews), dass Unternehmer Privat und Business **in einem System** wollen — Frage 3 des Prompts bleibt offen. Gegenbelege (Segmentierungs-Präferenz) nur theoretisch erwähnt.
2. **Frage 4 (Wirksamkeit HRV-gesteuerter Arbeitsplanung)** nicht beantwortet — nur Korrelationsstudien.
3. **Frage 5 (was hilft Gründer-Eltern nachweislich?)** nicht beantwortet.
4. **Frage 8 (welche Vertrauenslösungen überzeugen Nutzer?)** ohne Nutzerdaten, nur mit unseren eigenen Mustern beantwortet.
5. Im Prompt verlangte Anbieter fehlen: **OurHome, Ohai, Buddy, Mem, Pi, Google Fit (eigenständig), „Life OS“-Coaches**, Neulinge 2025/26 kaum (nur Kinmory/Our Life).
6. Viele Nutzerzahlen als „[Schätzung]“ ohne Quelle; mehrere innere Widersprüche (Whoop, Oura, Ultrahuman).
7. AI-Act-Kapitel mischt Art. 50 mit Aufsichtspflichten (Art. 14) — vor Verwendung mit P07 abgleichen.
8. Schnittstellen-Bedingungen von Whoop/Oura/Garmin für **gewerbliche** Nutzung durch eine Plattform nicht untersucht.
