# P9 · Auszug — Geschäftsmodell, Preise, KI-Kosten

**Volltext:** `P09-geschaeftsmodell-preise.md` · **Drive:** https://docs.google.com/document/d/1ACWDQ2oq4nwAgu8jGCxH1GoQxNQF_n98Dcczn7JJ0IU
**Abgerufen und geprüft:** 05.10.2026 · **Quelle:** Gemini Deep Research, ungeprüft — Stichproben unten geprüft (Web, Stand Oktober 2026)

> **Wichtigste Vorwarnung:** Die Kernzahlen des Berichts (Preisliste, 7,50 € Infrastruktur, KI-Kosten je Edition, Bruttomargen, Unit Economics) tragen als Quelle nur „4 = unknown_url“ oder „3 = AI_CEO_MODUL.md“ (unser eigenes Dokument). Das sind **Geminis eigene Modellrechnungen**, keine Marktbelege. Die Rechnungen sind in sich stimmig (nachgerechnet), aber die **KI-Kosten beruhen auf veralteten Modellpreisen** („Claude 3.5“) und nicht nachvollziehbaren Tokenmengen.

---

## 1 · Kernaussagen

| # | Aussage | Beleg im Bericht | Art |
|---|---|---|---|
| 1 | Für Solo-/Kleinstunternehmen ist ein **Hybridmodell** richtig: fester Grundpreis mit enthaltenem KI-Budget; reiner Verbrauch („Bill Shock“) und Kredit-Pools schrecken ab. | Intercom-, Lindy-, Notion-Erfahrungen (Blogs, Reddit) | Meinung, gestützt auf Fakten |
| 2 | Intercom Fin: Sitz 29 $ / 85 $ + **0,99 $ je gelöster Unterhaltung** — führte zu Beschwerden über unplanbare Rechnungen. | getcor.ai, saasmaste, Reddit | Fakt (Preis bestätigt), Beschwerden = Meinung |
| 3 | Lindy: Kredit-Stufen 3.000 / 15.000 / 35.000 Credits für 29,99 / 99,99 / 199,99 $, Nachkauf 10 $ je 1.000 — Nutzer stoßen unerwartet an Grenzen. | lindy.ai, Blogs | Fakt (Preise bestätigt) |
| 4 | Notion hat KI in den Business-Tarif gezogen; Hintergrund-Agenten („Workers“) laufen über separates Guthaben. | usecarly, breeze.pm | Fakt (bestätigt) |
| 5 | Ein Solo-Unternehmer zahlt für seinen Werkzeug-Stapel (Aufgaben, Kalender, CRM, Buchhaltung, Automatisierung, KI-Abo) heute **127–161 € netto im Monat** — ohne verbundene Daten. | Eigene Summe aus Einzelpreisen | Schätzung |
| 6 | Zwei Budgets: „Werkzeug“ (10–35 €/Monat) vs. „Entlastung/Personal“ (**150–600 €/Monat**). MAKE OS muss ins zweite. | Lindy-Blog (nocode.mba) | Meinung, schwach belegt |
| 7 | Preisanker virtuelle Assistenz: 35–55 €/Std., **ca. 450–1.000 € für 10–20 Std./Monat**. | onvaco, Anbieter-Websites, Stepstone | Fakt/Schätzung (Anbieterseiten) |
| 8 | Eigene Instanz kostet **ca. 7,50 €/Kunde/Monat** (Hetzner CX23 5,49 € + IPv4 + Sicherung + Überwachung); senkt Marge nur um 3–5 Punkte. | unknown_url, Hetzner | Schätzung |
| 9 | KI-Kosten je Monat: **11,50 € (Markttraktion) / 16,80 € (MAKE OS) / 28,50 € (AI CEO)** dank Regelwerk-Grundlauf (~80 % ohne Modell), Caching (−90 % auf gecachte Eingabe) und Modell-Routing (Haiku 30–60 %, Sonnet 40–70 %, Opus ≤ 5 %). | unknown_url | Schätzung (nicht nachvollziehbar, s. Prüfung) |
| 10 | Bruttomarge **69,5 / 72,1 / 75,1 %**; LTV:CAC 3,8 / 5,2 / 8,6; Amortisation 5,8–7,4 Monate. Auch bei KI +50 % und Abwanderung +50 % bleibt die Marge bei 68,6 %. | eigene Rechnung | Schätzung (rechnerisch stimmig) |
| 11 | **Einrichtungspaket 990 €** (4 Std. Aufwand, ~280 € Kosten) deckt die Kundengewinnungskosten und senkt die Abwanderung in den ersten 90 Tagen. | eilla.ai (Bewertungs-Blog) | Empfehlung; „halbiert Abwanderung“ unbelegt |
| 12 | **Kein Gratis-Tarif** (jede Instanz kostet echte Server); stattdessen bezahlter Pilot 199 € für 30 Tage, voll angerechnet bei Jahresvertrag. | — | Empfehlung |
| 13 | Instanz-Fabrik lohnt ab ca. **15–16 Kunden** (~50 Std. Aufwand, Amortisation ~1 Quartal); bis dahin halbautomatisch per Skript (~20 Min./Instanz). | — | Schätzung |
| 14 | Signierte Lizenzen + dauerhaftes Nur-Lesen nach Ablauf + Export (Markdown, CSV, DATEV) sind ein **Verkaufsargument**, nicht nur Technik. | AI_CEO_MODUL.md | Meinung |
| 15 | **Bootstrapping statt Wagniskapital**; falls später Investoren: Bruttomarge nach KI ≥ 70 %, Umsatz/KI-Kosten ≥ 8–10:1, „System of Record“ als Burggraben. | founderpath, thesaascfo, Bessemer | Meinung + Benchmark |

---

## 2 · Zahlen und Prüfung

| Größe | Wert laut P9 | Quelle (laut Bericht) | Stand | Prüfung 05.10.2026 | Belastbarkeit |
|---|---|---|---|---|---|
| Intercom Fin | 0,99 $ je Lösung; Sitz Essential 29 $, Advanced 85 $ | getcor.ai u. a. | 2026 | **bestätigt** (29/39 $ und 85/99 $ je Sitz jährl./mtl.; 0,99 $ je Lösung, Mindestabnahme 50/Monat) | hoch |
| Lindy | 29,99 / 99,99 / 199,99 $ für 3k / 15k / 35k Credits; Nachkauf 10 $ je 1.000 | lindy.ai | 09/2026 | **bestätigt** (Preise und Credits stimmen; heutiger Planname „Team“ mit Credit-Stufen, nicht „Plus/Pro/Max“) | hoch |
| Notion Business | inkl. KI; im Text „Preisanpassung von 15“ (Zahl verstümmelt) | usecarly | 2026 | **abweichend/unklar**: Business 20 $ jährl. / 24 $ mtl. je Sitz, KI enthalten; Credits 10 $ je 1.000; Workers ab 15.10.2026 0,0023 $ je Lauf | mittel |
| sevdesk | 12,90 € / 25,90 € | sevdesk.de | 2026 | **bestätigt** (Rechnung 12,90 €, Buchhaltung 25,90 €, Pro 34,90 € netto, monatlich) | hoch |
| Hetzner CX23 | 5,49 €/Monat (2 vCPU, 4 GB, 40 GB) | Hetzner/costgoat | 10/2026 | **bestätigt mit Vorbehalt**: 5,49 € wird genannt, einige Quellen nennen nach den Preiserhöhungen 2026 bereits **5,99 €** | mittel |
| Infrastruktur je Kunde | 7,50 € | unknown_url | — | ⚠ prüfen: nur Rohserver; P11 nennt 15–20 €. Unser eigener Server (1 vCPU/1,9 GB) ist laut Tempo-Befund bereits knapp → eher 10–15 € inkl. Sicherung, Überwachung, Speicher | niedrig |
| Claude-Preise | „Claude 3.5 Haiku/Sonnet, Opus 3/3.5“; Opus 15 $ Eingabe | Anthropic 2024/25 | veraltet | ⚠ **abweichend**: Preisseite 10/2026: Haiku 4.5 1 $/5 $, **Sonnet 5.5 2 $/10 $**, **Opus 5.5 4 $/20 $** je Mio. Token (Ein-/Ausgabe); Cache-Lesen 0,10–0,20 $. MAKE OS nutzt laut `AI_CEO_MODUL.md` B1 Haiku 4.5 / Sonnet 5 / Opus 5.5. Tabelle im Bericht zudem verrutscht | niedrig |
| Caching-Rabatt | 90 % auf gecachte Eingabe | Anthropic/AWS | 2025 | **bestätigt** (Cache-Lesen = 10 % des Eingabepreises bei Haiku/Sonnet; Opus 5.5 sogar 5 %) | hoch |
| KI-Kosten AI CEO | 28,50 €/Monat | unknown_url | — | ⚠ **nicht nachvollziehbar**: mit den im Bericht genannten Tokenmengen (120k gecacht + 15k neu + 6k Ausgabe pro Tag) und heutigen Preisen ergeben sich nur ca. **2–8 €/Monat**. Die Tokenmengen selbst wirken aber zu niedrig für 9 Agenten mit Werkzeug-Schleifen. → Nur echte Messung aus dem KI-Protokoll hilft | niedrig |
| Bruttomarge vertikale KI-SaaS | 60–65 % | Bessemer, tolvanen.io | 2025 | **teilweise bestätigt**: Bessemer „State of AI 2025“ nennt ~60 % für „Shooting Stars“ (und ~25 % für „Supernovas“); „vertikal 60–65 %“ ist Geminis Verallgemeinerung | mittel |
| Monatliche Abwanderung SMB | 3–5 % (klassisch), 4–6 % bei Jahreswert < 1.000 € | omnibound, churncost | 2025/26 | nicht geprüft; Sekundärblogs | niedrig–mittel |
| Umsatz : KI-Kosten | 8:1 bis 10:1 | thesaascfo | — | nicht geprüft; Blog-Faustregel | niedrig |
| VA-Stundensatz DACH | 35–55 €, spezialisiert 60–80 € | onvaco, Anbieterseiten | 2026 | nicht geprüft; Anbieterwerbung, plausibel | mittel |
| Unit Economics (ARPU 87 / 131 / 219 €; LTV 1.728 / 3.373 / 8.223 €) | — | eigene Rechnung | — | **nachgerechnet, stimmig** (60 % Jahreszahler; Stripe 1,5 % + 0,25 €). Aber: CAC 450/650/950 € frei angenommen; Support 6/10/15 €/Monat sehr niedrig | rechnerisch hoch, Annahmen niedrig |

---

## 3 · Was das für MAKE OS heißt

### 3.1 Preisliste — wie P9 sie empfiehlt

| Edition | Monatlich | Jährlich (je Monat) | Jahressumme | Enthaltenes KI-Budget | Inhalt |
|---|---|---|---|---|---|
| **Markttraktion** | 99 € | 79 € | 948 € | 15 € | CRM, Deals, Kampagnen, Events, Heads Sales/Marketing/Event |
| **MAKE OS** | 149 € | 119 € | 1.428 € | 22 € | Fokus & Zeit, Ziele, Finanzen, Gesundheit, Familie, ZOE |
| **AI CEO** | 249 € | 199 € | 2.388 € | 35 € | volles Führungsteam (8 Heads), Cockpit, Rhythmus, Playbooks |

Alle Preise netto. Jahreszahlung ≈ 20 % Nachlass, Ziel 60 % Jahreszahler.

**Dienstleistung:**
- **Make.One Setup-Kickoff:** 990 € einmalig — Instanz bereitstellen, Playbook wählen, 2 × 2 Std. 1:1, 30 Tage Begleitung; harte Grenze 4 Std., keine Sonderprogrammierung; was zweimal manuell passiert, wandert in die geführte Einrichtung.
- **Make.One Strategy & Architecture Day:** 2.900 € — ganztägig, Mehrgesellschafts-Strukturen (Holding/GmbH/Einzelunternehmen) und Freigabewege.

**KI-Budget-Regel (P9):** Budget so bemessen, dass 90 % der Nutzer im Rahmen bleiben → bei **85 %** ruhiger Hinweis im Cockpit → bei **100 %** automatischer Rückfall auf den Regelwerk-Grundlauf (nichts blockiert) → Nachkauf nur per Klick: **25 € Guthaben für 30 €**.

**Pilotangebot (P9):** 199 € Schutzgebühr für 30 Tage AI CEO auf eigener Instanz inkl. 30 € KI-Startguthaben; 100 % Anrechnung bei Jahresvertrag.

**Unit Economics (P9, Basisfall):**

| | Markttraktion | MAKE OS | AI CEO |
|---|---|---|---|
| Ø Monatsumsatz je Kunde | 87,00 € | 131,00 € | 219,00 € |
| Kosten (Server 7,50 + KI + Zahlung + Betreuung) | 26,55 € | 36,52 € | 54,53 € |
| Bruttomarge | 69,5 % | 72,1 % | 75,1 % |
| Abwanderung/Monat (Annahme) | 3,5 % | 2,8 % | 2,0 % |
| Kundenwert (Rohertrag über Laufzeit) | 1.728 € | 3.373 € | 8.223 € |
| Gewinnungskosten (Annahme) | 450 € | 650 € | 950 € |
| Amortisation | 7,4 Mon. | 6,9 Mon. | 5,8 Mon. |

**Zielgrößen (P9):** Jahr 1: 35 Kunden, ~74 T€ wiederkehrend + ~30 T€ Einrichtung · Jahr 2: 150 Kunden, ~354 T€ · Jahr 3: 450 Kunden, ~1,14 Mio. €.

### 3.2 Meine Einschätzung

1. **Hybridmodell und Budget-Regel übernehmen — sie passen exakt zu dem, was schon gebaut ist.** Der Regelwerk-Rückfall (B6.1) ist genau der „Deckel ohne Blockade“, den P9 empfiehlt. Das ist ein echter Vorteil gegenüber Lindy/Relevance (Kredite verfallen, Arbeit stoppt).
2. **Preisniveau eher nicht nach unten drücken.** ChartMogul (AI-Churn-Report, geprüft) zeigt: KI-Produkte **über 250 $/Monat** halten Kunden ähnlich gut wie klassische B2B-Software (ca. 70 % Umsatz ohne Ausbau, 85 % mit Ausbau), KI-Produkte **unter 50 $** verlieren dagegen drei Viertel. Für die AI-CEO-Edition sind 249 € monatlich / 199 € jährlich ein vernünftiger **Start**, 299 € sollten im Pilot getestet werden. P10 schlägt 149/299/499 € vor, P11 249 € — die Spanne zeigt: **der Preis ist unbelegt und gehört in den Pilottest** (Van-Westendorp-Fragen, s. P11).
3. **KI-Kosten selbst messen, bevor Preise fix werden.** P9 rechnet mit veralteten Preisen und Tokenmengen, die eher zu niedrig sind. Heute sind die Modelle deutlich billiger (Opus 5.5: 4 $/20 $ statt 15 $/75 $), Agenten-Läufe mit Werkzeugen aber viel tokenreicher. Vorschlag: 4 Wochen Echtverbrauch von Kunde 0 aus dem KI-Protokoll je Head auswerten (Paket D11), dann Inklusiv-Budget festlegen. Bis dahin als Planwert **30 € KI je AI-CEO-Instanz** (= Budget-Grenze, nicht Erwartungswert).
4. **Infrastruktur und Betreuung konservativer planen.** 7,50 € Server und 15 € Betreuung sind optimistisch. Gegenrechnung AI CEO mit 12 € Server, 30 € KI, 3,50 € Zahlung, 25 € Betreuung = 70,50 € Kosten → **Bruttomarge ≈ 68 %**, Amortisation ≈ 6,4 Monate (bei 950 € Gewinnungskosten). Das Modell trägt also auch konservativ — aber ohne die 75 %-Glanzzahl.
5. **Einrichtungspaket ja, Preis prüfen.** 990 € sind für Berater/Holding-Unternehmer plausibel; für die ersten Piloten eher reduziert (z. B. im Pilot enthalten), damit wir die geführte Einrichtung (5.1) lernen. Wichtig ist P9s Regel „was zweimal manuell passiert, wird Produkt“.
6. **Pilot: 30 Tage sind zu kurz** für ein Führungssystem mit Wochen- und Monatsrhythmus. Besser 60–90 Tage zu Vorzugspreis (P11 nennt 149 €/Monat) gegen strukturierte Rückmeldung — Entscheidung für Kevin (I1 Punkt 6).
7. **„Autonomes Führungsteam“ nicht als Wording übernehmen** — widerspricht C4 Prinzip 1 („Mensch entscheidet“) und P10s eigener Wortwahl-Empfehlung.

---

## 4 · Abgleich mit `AI_CEO_MODUL.md`

| Abschnitt | Hypothese | P9 sagt | Ergebnis |
|---|---|---|---|
| G2 Preisgestaltung | Grundpreis + KI-Verbrauch mit Budget **oder** Pauschale mit enthaltener KI | Pauschale mit enthaltenem KI-Budget, Rückfall statt Sperre, Nachkauf per Klick | **bestätigt** (Variante „Pauschale mit Budget“) |
| G2 | Einrichtung als Dienstleistung (Make.One) | 990 € Kickoff, 2.900 € Architektur-Tag | **bestätigt + konkretisiert** |
| G1 Editionen | drei Editionen Markttraktion / MAKE OS / AI CEO | gleiche Dreiteilung, Preise 99/149/249 € | **bestätigt** |
| D11 KI-Budget | Budget je Head, Ampel, Rückfall | Budget je Instanz, Warnung bei 85 %, Nachkaufpaket | **bestätigt + ergänzt** (85 %-Schwelle, Nachkauf); Budget je Head bleibt unsere Idee |
| B8 Lizenzen | signiert, offline, Schonfrist, nie Daten sperren | genau so, als Verkaufsargument | **bestätigt** |
| B8 / 5.3 Instanz-Fabrik | fehlt | Schwelle ~15 Kunden, ~50 Std. Aufwand | **ergänzt** |
| I2 Risiko KI-Kosten | Budget, Rückfall, Modellstufen | gleiche Gegenmittel, Stresstest ±50 % | **bestätigt** |
| F2 Punkt 5 | KI-Kosten je Instanz unter Plan | Planwert < 29 € (AI CEO) | **ergänzt** (Zielwert, aber erst messen) |
| B1 Modelle | Haiku 4.5 / Sonnet 5 / Opus 5.5 | „Claude 3.5“-Modelle | **widerlegt im Bericht** — P9 ist hier veraltet |
| C4 Prinzip 1 | Mensch entscheidet | spricht von „autonomem Führungsteam“ | **Wording-Konflikt**, Inhalt (Freigabe) aber gleich |
| Phase 5.6 Piloten | 3–5 Piloten, Preis offen | Pilot 199 €/30 Tage, Anrechnung | **ergänzt** (Dauer aus meiner Sicht zu kurz) |

---

## 5 · Offene Fragen und Lücken

1. **Echte KI-Kosten je Head und Monat** (aus dem KI-Protokoll der Produktivinstanz) — die wichtigste Zahl des ganzen Modells, im Bericht nur geschätzt.
2. **Server-Größe je Kunde:** Reicht CX23 (2 vCPU/4 GB) für Next.js + Brain-Suche + Arbeiter? Mehrere Kunden auf einem Server (P9 nennt CPX32 für ~6 Kunden) oder strikt einer je Server?
3. **Betreuungsaufwand** je Kunde und Monat — 6–15 € sind ohne Messung nicht glaubwürdig (Updates, Fragen, Fehler).
4. **Zahlungsbereitschaft ist ungetestet.** Keine Studie im Bericht misst sie für „KI-Führungsteam“; die 150–600 €-Spanne stammt aus einem Blog.
5. **Gewinnungskosten (CAC)** 450–950 € sind frei angenommen; mit Make.One-Abenden konkret messen (Kosten je Abend ÷ Abschlüsse).
6. **KI-Anbieter und Drittland:** Der Bericht verschweigt, dass KI-Läufe zum Modellanbieter (USA/global) gehen. Das betrifft Preis (z. B. Aufschlag für Regionsbindung), AVV und das Versprechen „Daten in Deutschland“ — siehe P7.
7. **Eigener Schlüssel (BYOK)** als Option — kommt in P11 vor, in P9 nicht durchgerechnet.
8. **Rechtliches zu Lizenzen/Nur-Lesen:** Wie lange müssen wir eine abgelaufene Instanz betreiben (Kosten!)? Export und Abschaltung nach Frist klären.
9. Fehlende Formeln im Drive-Export (Bruttomarge Einrichtungspaket, ARPU-Formeln) — inhaltlich nachgerechnet, aber Original prüfen, falls die Zahlen zitiert werden.

---

**Quellen der Prüfung (abgerufen 05.10.2026):**
[Claude-Preisseite](https://claude.com/pricing) · [Lindy Pricing](https://www.lindy.ai/pricing) · [Intercom Pricing 2026 (getmacha)](https://www.getmacha.com/blog/intercom-pricing-explained) · [Intercom Pricing (chatarmin)](https://chatarmin.com/en/blog/intercom-pricing) · [Hetzner CX23 (bitdoze)](https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans/) · [Hetzner CX23 (cloudhim)](https://www.cloudhim.com/cloud-costs/hetzner-cx22-pricing-2026) · [sevdesk Kosten 2026 (michael-bickel.de)](https://www.michael-bickel.de/2026/08/sevdesk-kosten-2026-preise-tarife-und-funktionen-im-ueberblick/) · [Notion AI Pricing 2026 (breeze.pm)](https://www.breeze.pm/articles/notion-ai-pricing) · [Bessemer State of AI 2025](https://www.bvp.com/atlas/the-state-of-ai-2025) · [ChartMogul AI Churn Wave](https://chartmogul.com/reports/saas-retention-the-ai-churn-wave/)
