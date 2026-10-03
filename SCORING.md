# Qualifizierung & Scoring — Methode, Standard, Vorschlag (03.10.2026)

Kevin: „Leadscoring ist der Oberbegriff der Qualifizierung — mach das ‚Qualifizierung & Scoring‘, darunter Qualifizierung und die
Scoring-Einstellungen von Marketing und auf Sales, also von MQL zu SQL.“

Der Schnellknopf in der Mitte der Markttraktion-Leiste heißt **Qualifizierung & Scoring** (Kennung `qualifizierung`, alle alten
Links bleiben). Darin: **Qualifizierung** (die Runde) · **Scoring** mit **Marketing-Scoring** (bis MQL) und **Sales-Scoring**
(MQL → SQL). Adressen: `?s=qualifizierung` · `&a=scoring` · `&a=scoring-sales` · `&k=<Firma|Person>` springt in die Runde.

## Methode (nur das Verfahren — Kriterien und Texte sind unsere eigenen)

Die Vorlage (Lead-Scoring-Dokument von mybestconcept) ist urheberrechtlich geschützt; übernommen ist nur das Verfahren:

- Kriterien stehen in **Blöcken** — Interaktionen und Signale · Qualifikationsfragen und Fit · Potenzial.
- Je Kriterium gibt es **Stufen mit Punkten** (im Vorschlag 1 · 3 · 5, 0 = trifft nicht zu), optional ein **Gewicht** (Faktor).
- Die Summe geht gegen eine **Mindestpunktzahl** (Schwelle MQL bzw. SQL); die **mögliche Höchstpunktzahl** steht immer daneben.
- **Muss-Kriterien** sind Ausschlusskriterien (MEDDICC/BANT): „mindestens n der Kriterien a, b, c auf einer Stufe mit ≥ p Punkten“.
  Ohne sie hilft keine Punktzahl. Ein **Deckel** an einer Stufe kappt einen Block (z. B. „kein Schmerz“).

Zwei Seiten, **eine Rechnung** (`lib/crm/scoring.ts`, rein, getestet):

| | Marketing-Scoring | Sales-Scoring |
|---|---|---|
| Frage | Ist jemand ansprechbar? | Ist er kaufbereit und passt er? |
| Quelle der Werte | **gemessen** aus den Daten (Messfühler) | **gefragt** im Gespräch (Stufe je Frage am Lead) |
| Ziel | MQL (Marketing Qualified Lead) | SQL (Sales Qualified Lead) |
| Tor | Punkte ≥ Schwelle | Punkte ≥ Schwelle **und** alle Muss-Kriterien |

Der **Gesamtwert 0–100** (Anteil aller erreichten an allen möglichen Punkten) und die **Temperatur** (kalt/lau/warm/heiß, Stufen
einstellbar) kommen aus derselben Rechnung — Leads-Liste, Runde, Kontakt-/Firmenakte, Heads, Segmente, Lifecycle (MQL vorgeschlagen,
wenn die Marketing-Schwelle erreicht ist) und ZOE sehen überall denselben Score (`leadScore` in `score.ts` ist die Brücke,
`leadZeileFuer` rechnet die Akte über dieselbe `leads()`-Funktion).

Messfühler (Marketing): Wärme (Gespräch/Antwort/Ansprache, verblasst nach 180 Tagen) · E-Mail/Telefon/LinkedIn · Erreichbarkeit ·
Vertriebseignung (Liste) · echtes Gespräch · Antwort · Termin angefragt/gebucht · Event besucht (Netzwerken) · Make.One-Gast ·
Newsletter mit Double-Opt-in (nur mit vollem Nachweis voll) · Empfehlung · Website-Anfrage.

## Standard = die bisherige Rechnung

Fit 30 · Wärme 30 · Qualifizierung 30 · Erreichbarkeit 10 = 100; MQL ab 20 Marketing-Punkten; SQL bei Schmerz + Entscheider +
Budget **oder** Zeitpunkt (Schwelle 15 = die Mindestsumme dieser Regel). **Bewiesen**, nicht behauptet: `tests/scoring-standard-paritaet.test.ts`
vergleicht den neuen Kern bei 500 zufälligen Leads Teil für Teil mit der wörtlich übernommenen alten Rechnung
(`tests/fixtures/lead-score-vor-scoring.ts`) — die Scores ändern sich nicht, solange niemand etwas einstellt.

## Vorschlag (geschärft) — mit einem Klick „Vorschlag übernehmen“

Marketing (Schwelle MQL **8** von 53): Gespräch (×2: 5/3/1 nach Alter), Antwort (×2), Termin, Event besucht (1/3/5 nach Anzahl),
Make.One-Gast (3/5), Newsletter mit Double-Opt-in (3, ohne vollen Nachweis 1), Empfehlung (5, Netzwerk 3), Website-Anfrage (5),
Erreichbarkeit (1/3/5 nach Zahl der Wege).

Sales (Schwelle SQL **28** von 70), Stufen 5 · 3 · 1 · 0, **Muss: Schmerz ≥ 3 · Entscheider ≥ 3 · (Budget oder Zeitpunkt) ≥ 3**:

| Block | Kriterium | Gewicht | Quelle / Begründung |
|---|---|---|---|
| Fit | Passt zum Kundenprofil (Liste → Antwort) | 1 | wie bisher, jetzt 1/3/5 |
| Fit | Unternehmensgröße | 1 | BANT „Authority/Budget“-Vorfilter: Kernzielgruppe Mittelstand 10–250 MA |
| Fit | Passung & Chemie | 1 | Interim-Geschäft lebt von Vertrauen; früh erkennbar, spät teuer |
| Qualifikation | Schmerz | **2** | MEDDICC „Identify Pain“ · BANT „Need“ — ohne Schmerz kein Auftrag |
| Qualifikation | Entscheider | **2** | MEDDICC „Economic Buyer“ · BANT „Authority“ |
| Qualifikation | Budget | 1 | BANT „Budget“ (Rahmen oder Schmerz groß genug, einen zu schaffen) |
| Qualifikation | Zeitpunkt | 1 | BANT „Timeline“, mit Anlass |
| Qualifikation | Fürsprecher im Haus | 1 | MEDDICC „Champion“ — Aufträge entstehen intern, nicht durch uns |
| Qualifikation | Entscheidungsprozess | 1 | MEDDICC „Decision Process/Criteria“ |
| Qualifikation | Wirkung | 1 | MEDDICC „Metrics“ — woran merkt man den Erfolg |
| Qualifikation | Alternative | 1 | MEDDICC „Competition“ (auch: Nichtstun, intern lösen) |
| Potenzial | Folgeauftrag & Empfehlung | 1 | Make.Beteiligungen, Retainer, Netzwerkhebel |

Temperatur-Stufen im Vorschlag **5 / 12 / 25** (statt 25 / 50 / 75): der Gesamtwert ist der Anteil an allen 123 möglichen Punkten,
wer erst wenige der zwölf Fragen beantwortet hat, liegt zwangsläufig niedrig. **Vor dem Übernehmen zeigt der Dialog die Wirkung auf
die vorhandenen Leads** (MQL und SQL-bereit vorher/nachher, Temperatur-Verteilung, Beispiele). „Letzte Änderung zurücknehmen“ und
„Auf Standard zurück“ gibt es mit einem Klick.

## Wie es in der App wirkt

- **Einstellungen** liegen im eigenen Bestand `crm-scoring` (Stand/409, nur eine angemeldete Person des Haushalts schreibt — Dienstweg
  403; Version, die letzten 10 Fassungen für „Zurück“, Vermerk wer/wann). `ladeCrm()` hängt sie beim Lesen an (`crm.scoring`),
  gespeichert wird dort nie etwas. Beschädigte Einstellungen fallen auf den Standard zurück (nie ein Absturz beim Rechnen).
- **Editor** (Scoring › Marketing/Sales): umbenennen, Punkte und Gewicht ändern, Kriterien/Blöcke/Stufen hinzufügen und entfernen,
  Muss-Regeln, Temperatur-Stufen; Live-Vorschau, geprüft wird live (`scoringPruefen`, nichts wird still gekürzt: 400/413 mit Pfad);
  ungespeicherter Entwurf bleibt im Browser, `beforeunload` warnt.
- **Leads**: `Lead.stufen` (gewählte Stufe je Frage) ist neu und optional; ältere Leads tragen nur `kriterien` (ja/nein/unklar) und `fit` —
  der Kern liest beides (ja = beste Stufe, nein = schlechteste), der Schreibweg spiegelt die Stufe an die alten Felder (beste/≥ 60 % = ja,
  0 = nein, sonst unklar), damit Deal-Kopie und ältere Leser stimmig bleiben. **SQL-bereit** entscheidet überall `salesBereit` (Schwelle +
  Muss), „fehlt noch …“ kommt von `fehltBisSqlZeile`.
- **Runde**: Fragen und Stufen aus den Einstellungen; je Karte nur Kontakt · Firma · Gespräch starten, der Rest unter „Mehr ⋯“; Seitenfenster
  (Kontakt/Firma voll bearbeitbar, Score rechnet sofort neu); Herkunft; Gesprächsmodus; Firma wechseln/neu; Zusammenführen; weitere Person;
  Abgeben · Parken · Raus (Grund-Art fließt in Sales › Auswertung und den Datenblock der Heads).
- **Rechtlich**: Qualifizierungsnotizen sind Personendaten (Speicher-Register: `crm-scoring` ohne Personenbezug, die Antworten liegen im
  Lead bzw. an der Person) — keine sensiblen Kategorien abfragen (Hinweis im Gesprächsmodus); weitere Person = Herkunft „Recherche“
  (Art.-14-Frist an der Person), keine Einwilligung; Art. 18: eingeschränkte Personen werden nie umgehängt (409).

## Bewusst nicht gebaut

- Kein Import der Excel/des Dokuments (Urheberrecht) — nur die Methode.
- Keine automatische Änderung von Lifecycle oder Lead-Status durch den Score (nur Vorschlag/Anzeige, wie bisher).
- Kein Rückgängig für „Firmen zusammenführen“ (Personen-Zusammenführung hat es 30 Tage); stattdessen Vermerk an der behaltenen Firma
  (Name und abweichende Angaben der anderen) und Ablehnung, solange außerhalb von Kartei und CRM (Aufgaben, Ziele, Zeit, Finanzplan,
  Dateiablage …) noch etwas an der anderen Firma hängt.
