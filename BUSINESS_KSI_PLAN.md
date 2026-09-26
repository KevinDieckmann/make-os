# Plan: KSI-Kennzahlen als Rückgrat des Business-Bereichs

Kevin 25.09.2026: „Das CapOS-Operationssystem einmal mit in den Business-Bereich
übernehmen. Die ganzen Kennzahlen des KSI-Scores sind Gold wert für den
kompletten Business-Bereich — darauf können wir sämtliche Berechnungen
innerhalb des Business anstellen.“

Status: **gebaut (25.09.) auf `entwicklung`** — online mit dem nächsten geplanten Update (UPDATES.md). Umsetzung auf `entwicklung`, online mit
einem geplanten Update (siehe `UPDATES.md`).

---

## 1. Was es gibt (geprüft, nur gelesen)

**Die KSI-Logik** (KEMARIS/POINCAP, `CAPOS_PROGRAMM.md`, KPI-Briefing 08.07.):
`KSI = Financial Health × 50 % + Management DNA × 30 % + Markttraktion × 20 %`
(arithmetisch; Bänder Sehr gut / Verbesserungsfähig / Kritisch).

| Säule | Stand in KEMARIS | brauchbar für uns |
|---|---|---|
| Markttraktion | **ausspezifiziert** — 24 KPIs (DevSpec) mit Formel, Quelle, Ampel; 70er-Register | ja — MAKE OS hat den Traktions-Score schon daraus (`lib/crm/traktion.ts`) |
| Financial Health | **nur Konzept** — 4 Gruppen × 6 Kennzahlen (Liquidität, Forderungen, Ausgaben, Kapital); Formeln/Schwellen nur in der FH-Marktanalyse; die Oberfläche zeigt Beispielzahlen | ja — Standard-Kennzahlen, die wir mit eigenen Zahlen rechnen |
| Management DNA | **nur Konzept** — Personalkosten, Fluktuation, Produktivität, Kultur; fast alles erst ab ~10–40 Mitarbeitenden aussagekräftig | nur angepasst (siehe Entscheidung 2) |

Offene Punkte dort, die wir **nicht** erben: Teilwerte addieren sich nicht zur
Säule (F1/F3/F8), arithmetisch vs. geometrisch ungeklärt, Code rechnet anders
als die DevSpec (Win Rate ≥35 % statt ≥25 %).

**Was MAKE OS schon rechnet** (eigene Daten): Kasse, Runway, Burn, Umsatz/Kosten/
Gewinn gg. Ziel (`finance-data.ts`), 12-Wochen-Liquidität mit Engpass
(`liquiditaet.ts`), Fixkosten, Schuldenrate, Ergebnis (`grundlage.ts`), offene/
überfällige Forderungen (`finanzbild.ts`), MRR, Konzentration, Pipeline,
Gewinnquote, Traktion (`lib/crm/*`), Termine (iCloud), Fokus-Blöcke (Planer).

## 2. Leitplanken

- **Nur Logik und Standard-Kennzahlen, kein Code und keine Daten** aus
  KEMARIS/POINCAP/Operations/HubSpot. DSO, Runway, Quick Ratio, Win Rate, NRR
  sind Lehrbuch-Kennzahlen — wir bauen sie selbst, mit euren Zahlen.
- Hintergrund: Eigentum an CapOS/POINCAP (Marke, IP, Code) ist laut euren
  eigenen Notizen ungeklärt, und die Regel lautet „KD Ventures nie in
  Konkurrenz zu KEMARIS“ und „KEMARIS aus dem privaten Leben“. Interne
  Steuerung der eigenen Firmen ist keine Konkurrenz — **rechtlich entscheidest
  du**, ich baue es so, dass nichts Fremdes drinsteckt.
- **Privat bleibt privat:** Haushaltsfinanzen fließen nie in Business-Kennzahlen.
- Jede Zahl zeigt Formel, Quelle, Stand — und wo sie fehlt, eine **Messlücke**
  mit dem Weg, sie zu schließen (statt einer erfundenen Zahl).

## 3. Aufbau: der Business-Index

Drei Säulen wie beim KSI, **arithmetisch 50/30/20** (nachvollziehbar, wie im
KSI-Briefing A.1). Jede Kennzahl → 0–100 über ihre eigenen Schwellen
(an der roten Schwelle 20, an der grünen 100, dazwischen linear). Säule =
Mittel ihrer gemessenen Kennzahlen; unter 40 % Abdeckung zählt sie nicht und
steht als „zu wenig Daten“ da (wie im Wachstums-Score). Gesamt wird über die
zählenden Säulen neu gewichtet.

### Finanzielle Gesundheit — 50 %
| Kennzahl | Formel | grün / rot | Quelle | Stand |
|---|---|---|---|---|
| Liquidität | Summe Geschäftskonten | ≥ 3 / < 1 Monatsfixkosten | Kontostände | ✅ |
| Runway | Liquidität ÷ Ø Netto-Burn (3 Mon.) | ≥ 6 / < 3 Monate | finance-data | ✅ |
| 13-Wochen-Deckung | tiefster Kassenstand der Vorschau | Puffer ≥ 1 Mon. / Engpass | liquiditaet | ✅ |
| Quick Ratio | (Kasse + Forderungen) ÷ kurzfr. Verbindlichkeiten | ≥ 1,0 / < 0,8 | Monatsabschluss | 🔴 |
| Überfällige Forderungen | überfällig ÷ offen | ≤ 10 / > 25 % | Rechnungen | ✅ |
| DSO | Ø Tage Rechnung → Zahlung | ≤ 40 / > 55 Tage | Rechnungsdaten | 🟡 Datum „gestellt/bezahlt“ |
| Kundenkonzentration | größter Kunde ÷ MRR | ≤ 30 / > 50 % | Mandate | ✅ |
| Kostenquote (CIR) | Kosten ÷ Umsatz | ≤ 85 / ≥ 95 % | Grundlage | ✅ |
| Fixkostenquote | Fixkosten ÷ Umsatz | ≤ 50 / > 70 % | Grundlage | ✅ |
| Plan-Ist Kosten | Ist ÷ Plan − 1 | ≤ 5 / > 15 % | Liquiplan + Buchungen | 🟡 |
| Kapitaldienstfähigkeit | (Ergebnis + AfA) ÷ Schuldendienst | ≥ 1,2 / < 1,0 | Grundlage + Monatsabschluss | 🟡 |
| EK-Quote | Eigenkapital ÷ Bilanzsumme | ≥ 30 / < 10 % | Monatsabschluss | 🔴 |

### Führung & Team — 30 %  (Variante: Entscheidung 2)
Vorschlag „Unternehmer-DNA“ (passt zu 1–5 Personen, Daten hat MAKE OS schon):
| Kennzahl | Formel | grün / rot | Quelle | Stand |
|---|---|---|---|---|
| Umsatz je Kopf | Umsatz 12 M ÷ FTE | ≥ 120 / < 80 T€ | Umsatz + FTE-Einstellung | 🟡 FTE eintragen |
| Personalaufwandsquote | Personal ÷ Umsatz | ≤ 60 / > 75 % | Kategorie „personal“ | 🟡 |
| Fokuszeit | Fokus-Blöcke h/Woche | ≥ 10 / < 4 h | Planer | ✅ |
| Meeting-Last | Termin-h/Woche | ≤ 20 / > 30 h | iCloud-Kalender | ✅ |
| Delegation | erledigte Agenten-Aufträge ÷ Woche | Ziel einstellbar | Jarvis | ✅ |
Klassische MDNA (Fluktuation, eNPS, Krankenquote) kommt dazu, sobald ein Team da ist.

### Markttraktion — 20 %
Kern: der bestehende **Traktions-Score** (Sales/Marketing/Event). Dazu die
DevSpec-Kennzahlen, die mit Mandaten/Pipeline rechenbar sind:
| Kennzahl | Formel | grün / rot | Stand |
|---|---|---|---|
| Win Rate | gewonnen ÷ (gewonnen + verloren) | ≥ 25 / < 15 % (DevSpec) | ✅ ab 10 Entscheidungen |
| Pipeline-Deckung | gewichtete Pipeline ÷ Umsatzlücke zum Ziel | ≥ 3× / < 1× | ✅ |
| Sales Cycle | Ø Tage Erstkontakt → gewonnen | ≤ 60 / > 120 | 🟡 Stufen-Historie |
| NRR | (MRR Start + Expansion − Downgrade − Churn) ÷ MRR Start | ≥ 110 / < 100 % | 🟡 Monats-Schnappschuss |
| Logo-Churn | beendete Mandate ÷ aktive / Monat | ≤ 1 / > 2,5 % | 🟡 |
| CAC | (Marketing + Vertrieb) ÷ Neukunden | ≤ 2.500 / > 5.000 € | 🟡 Kostenkategorie |

✅ sofort aus eurem Bestand · 🟡 kleine Ergänzung · 🔴 braucht den Monatsabschluss

## 4. Technik

- `lib/business/` (rein, getestet): **Register** (id, Name, Säule, Formel als
  Text, Einheit, Richtung, Schwellen, Quelle, `berechne()`), **Normierung**,
  **Quellen** (nur Business-Speicher, nie Haushalt), **Index**.
- **Verlauf:** täglicher Schnappschuss `business-verlauf` → Trends, NRR/Churn.
- **Ampel-Wechsel** (nicht jeder Wert) → Hinweis auf „Heute“ und an den Head
  of Finance (wie DevSpec: Alarm nur bei Statuswechsel).
- **Monatsabschluss in 5 Minuten:** kleine Eingabe je Gesellschaft (Umsatz,
  Personal, sonstige Kosten, AfA, kurzfr. Verbindlichkeiten, Eigenkapital,
  Bankschulden); später DATEV-BWA-Import.
- **Oberfläche:** der Kopf-Ring „Business“ (`/os/saeule/business`) wird das
  Business-Cockpit: Index + drei Säulen, je Kennzahl Kachel mit Ampel,
  Formel/Quelle auf Klick, Messlücken mit „so schließen“, Verlauf.
- **Jarvis & Head of Finance** bekommen den Index und die roten Kennzahlen.

## 5. Ablauf (≈ 5 Arbeitstage, ein geplantes Update)

1. **Entscheidungen** (heute, siehe unten).
2. **Fundament** (1,5 T): Register, Normierung, Quellen, Index + Tests; Finanz-
   Kennzahlen aus dem Bestand, Traktion angebunden.
3. **Cockpit** (1 T): Business-Seite, Verlauf, Messlücken, Drilldown.
4. **Lücken schließen** (1,5 T): Rechnungsdaten (gestellt/bezahlt), Monats-
   abschluss, Mandats-Verlauf (NRR/Churn), CAC.
5. **Einbindung** (1 T): Wachstums-Score, Jarvis/Head of Finance, Hinweise,
   Führung & Team.

## 6. Entscheidungen (Kevin, 25.09.2026)

1. **Name:** „Business-Index“ — eigene Bezeichnung, gleiche Logik 50/30/20.
2. **Führung & Team:** Unternehmer-DNA (Umsatz je Kopf, Personalquote, Fokuszeit,
   Meeting-Last, Delegation); klassische MDNA kommt dazu, sobald ein Team da ist.
3. **Eine Wahrheit:** Die Business-Säule des Wachstums-Scores IST der
   Business-Index; die Business-Hälfte der Finanzen-Säule ist die Finanzielle
   Gesundheit.
4. **Gesellschaften:** je Firma (Consulting, KD Ventures) + gesamt, Umschalter im Cockpit.

## 7. Umgesetzt (25.09.2026)

- `lib/business/register.ts` — 26 Kennzahlen (FH 12 · Unternehmer-DNA 6 · MT 8) mit Formel, Quelle,
  Schwellen, „so schließen“. Zusätzlich zum Plan: Meilenstein-Kurs (UD) und Umsatz-Kurs (MT), damit
  nichts aus der alten Business-Säule verloren geht.
- `lib/business/messen.ts` — jede Kennzahl je Sicht; Ist-Monate aus Monatsabschluss > Grundlage
  (Consulting) > Controlling (gesamt). Private Kredite aus dem V1-Export zählen nie.
- `lib/business/index.ts` — Punkte (rot 20 · grün 100 · linear), Säulen (ab 40 % Abdeckung), Gesamt 50/30/20.
- `lib/business/speicher.ts` + `app/api/business` — Monatsabschluss, Köpfe, täglicher Schnappschuss
  (Trend, Ampel-Wechsel, MRR für die NRR).
- `/os/business` (Kopf-Ring „Business“) — Cockpit; Wachstums-Score: Business-Säule = Index,
  Finanzen-Business-Hälfte = Finanzielle Gesundheit; Jarvis bekommt Index, Rotes und Messlücken.
- Tests: `tests/business-index.test.ts`.

## 8. Tiefer verankert (25.09.2026, Kevin: Fachseiten · Jarvis & Head of Finance · Feinjustierung)

- Fachseiten: `components/os/business/IndexStreifen.tsx` auf Zahlen (Business), Markttraktion
  (Überblick), Mandate — dieselbe Zahl wie im Cockpit, Klick öffnet die Kennzahl dort.
- Jarvis: `business_index` (frei) · `monatsabschluss_erfassen` (Freigabe, nur genannte Zahlen).
- Head of Finance: `business_index` im Datenpaket, Hinweise bei roter Kennzahl (FH = hoch) und
  fehlendem Monatsabschluss des Vormonats — nur für den Haushalt des Inhabers.
- Feinjustierung: eigene Schwellen je Kennzahl (alle Sichten oder je Firma, mit Rückweg zum
  Standard), Jahresumsatzziele je Firma (Umsatz-Kurs und Pipeline-Deckung jetzt auch je Firma),
  Verlaufs-Diagramm (Index + drei Säulen, 90 Tage).


## 9. Business-Modell maximal (25.09.2026, Kevin: „hinter jeder Kachel 2–3 Punkte“, Geschäftsmodell, Index verfeinern)

- Kern `lib/kennzahlen/kern.ts`: gewichtete Säulen (Liquidität, Runway 1,5 · 13-Wochen-Deckung,
  Überfällige Forderungen, Break-even 1,25), Details je Kennzahl (bis 8, Kachel zeigt 3).
- Neue Kennzahlen: Break-even-Abstand, Auslastung, effektiver Tagessatz, wiederkehrender Umsatz,
  Kundenwert (LTV), LTV ÷ CAC. `nichtFuer: ['kdv']` für Vertrieb/Beratung — KD Ventures ist Holding.
- Geschäftsmodell-Karte (`lib/business/modell.ts`): Umsatz je Produktlinie/Produkt, Mandate mit Anteil
  und Fixkosten-Deckung. Echter Deckungsbeitrag je Mandat braucht direkte Kosten — noch nicht erfasst.
- Cockpit lebt unter Zahlen → Business; alle Links über `lib/wege.ts`.

## 10. Ein Kern, drei weitere Indizes (26.09.2026, Kevin: „Gesundheit und Markttraktion auf denselben Kern")

- **Gesundheits-Index** (`lib/gesundheit/index.ts`): Erholung & Schlaf 40 · Bewegung & Aufbau 30 · Ernährung &
  Körper 30 — 19 Kennzahlen aus den eigenen Beständen der Person (Whoop, Journal, Routinen, Wochenplan,
  Kalender, Meilensteine, Essensplan, Haut, Streak). Haut/Streak zählen nur, wenn geführt. Die
  Gesundheits-Säule des Wachstums-Scores ist dieser Index; der alte Faktor-Block in `performance.ts` ist weg.
- **Traktions-Index** (`lib/crm/traktion-index.ts`): die Kennzahlen der drei Welten laufen durch den Kern —
  Sales 50 · Marketing 40 · Event 10 als gewichtetes geometrisches Mittel (KEMARIS-Konzept, `geometrisch`),
  Grundlage (Ansprechbar, Datenreife, Art. 14) sichtbar mit Gewicht 0. `mrr` = Anteil des größten Kunden,
  `ansprechbar` = Anteil statt Anzahl, direkte Ampeln (Gästemischung) 100/60/20. `events_90`: grün ab 1,
  rot bei 0 (26.09. korrigiert — Grün = Rot ergab 20 Punkte trotz grüner Ampel).
- **Gemeinsamer Speicher** `lib/kennzahlen/speicher.ts` für Business, Privat, Gesundheit, Traktion: Tages-
  Schnappschuss, 90 Tage Verlauf, Vergleich zu vor 30 Tagen, Ampel-Wechsel, eigene Schwellen.
- Tests: `tests/gesundheit-index.test.ts`, `tests/traktion-index.test.ts`, `tests/kennzahlen-speicher.test.ts`.

