# Qualifizierung & Scoring — Methode, Standard, MQL-Begriff (03.10.2026)

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

## Begriff: Lead → MQL (nur Marketing) → SQL

Kevin (03.10.): „MQL sind nur die Leads, die aus dem Marketing kommen. Wenn jemand auf dem Event kommt, ist es ein Lead, bis es durch die
Qualifragen gekommen ist. Und dann können wir gucken, was er nachher ist, aber dafür muss er erst mal qualifiziert werden.“

- **Lead** ist jeder. **MQL** ist nur ein Lead mit **Marketing-Herkunft** (und einem Signal bzw. der Marketing-Schwelle). **SQL** entscheidet
  für alle die Qualifizierung (Sales-Scoring + Muss-Kriterien).
- Eine Funktion entscheidet, ob ein Lead aus dem Marketing kommt: `istMarketingLead` / `marketingHerkunft` in `lib/crm/scoring.ts`. Sie steckt im
  Kern (`scoringRechnen` → `ScoringErgebnis.marketingLead`, `SeitenErgebnis.gilt`) — Lifecycle-Vorschlag, Leads-Zeile (`mqlErreicht`, `qualiStand`),
  Runde, Kontaktakte, Scoring-Vorschau, Heads (`marketing_lead`, `lifecycle.vorgeschlagen`) und ZOE lesen dasselbe.
- **Marketing-Herkunft** (je Person der Firma, ein Treffer genügt):

| Quelle | Gilt als Marketing, wenn … |
|---|---|
| Website-/Inbound-Anfrage | eine Anfrage im Verlauf („Anfrage über …“, nicht über Empfehlung/Event und nicht zu einem besuchten Event) oder die Quelle (Website/Anfrage) — seit 08.10. nie die Datenschutz-Herkunft „selbst angegeben“ |
| Newsletter | Einwilligung Newsletter mit **nachgewiesenem Double-Opt-in**, nicht widerrufen |
| Kampagne | Mitglied einer **gestarteten** Kampagne (nicht Entwurf), die nicht Direktansprache ist (Playbook „LinkedIn: vernetzen“, Kanal persönlich oder Telefon zählen nicht) — oder Quelle „Kampagne“ in der Liste |
| Content / Leadmagnet | Quelle Content, Beitrag, Newsletter, LinkedIn-Beitrag (Kanal „Content“ in `lib/crm/kanal.ts`) |
| Eigenes Event | Zusage oder Teilnahme (`zugesagt`/`da`) an einem **eigenen** Event (Make.One), nicht persönlich oder telefonisch eingeladen |

- **Kein Marketing** (bleiben „Lead · noch zu qualifizieren“, bis die Qualifizierung durch ist): Begegnungen und besuchte Events („Netzwerken“),
  Empfehlungen, Direktansprache und Kaltakquise, Recherche/Listen, persönlich bekannt, Bestand (HubSpot, Auftrag/Vertrag). Parken oder Raus
  geht aus der Runde wie bisher.
- **Wirkung im Score:** Die Marketing-Punkte werden für jeden Lead gerechnet (Wärme bestimmt die Reihenfolge in der Runde, die Temperatur
  bleibt vergleichbar) — aber die **Marketing-Schwelle gilt nur für Marketing-Leads**: Bei allen anderen ist `gilt` false, es gibt nie „MQL
  erreicht“, und die Oberfläche zeigt statt des MQL-Balkens „Lead · noch zu qualifizieren“. Eine Begegnung wird damit nie MQL — die
  frühere Ausnahme „MQL-Schwelle 35, damit eine Begegnung kein MQL wird“ ist überflüssig (Schwelle jetzt 8).
- **Lifecycle-Vorschlag „MQL“:** nur bei Marketing-Herkunft **und** Signal (Antwort/Anfrage, eigenes Event besucht, Marketing-Schwelle
  erreicht). Ein Lead ohne Marketing-Herkunft schlägt nie MQL vor, egal wie warm er ist; von Hand lässt sich die Phase weiter frei setzen.

Der **Gesamtwert 0–100** (Anteil aller erreichten an allen möglichen Punkten) und die **Temperatur** (kalt/lau/warm/heiß, Stufen
einstellbar) kommen aus derselben Rechnung — Leads-Liste, Runde, Kontakt-/Firmenakte, Heads, Segmente, Lifecycle (MQL vorgeschlagen, wenn
ein Marketing-Lead die Marketing-Schwelle erreicht) und ZOE sehen überall denselben Score (`leadScore` in `score.ts` ist die Brücke,
`leadZeileFuer` rechnet die Akte über dieselbe `leads()`-Funktion).

Messfühler (Marketing): Wärme (Gespräch/Antwort/Ansprache, verblasst nach 180 Tagen) · E-Mail/Telefon/LinkedIn · Erreichbarkeit ·
Vertriebseignung (Liste) · echtes Gespräch · Antwort · Termin angefragt/gebucht · Event besucht (Netzwerken) · Make.One-Gast ·
Newsletter mit Double-Opt-in (nur mit vollem Nachweis voll) · Empfehlung · Website-Anfrage.

## Standard seit 03.10. = der geschärfte Vorschlag

Kevin (03.10.): „Sofort übernehmen, macht am meisten Sinn … wir müssen unsere Leads eh noch qualifizieren.“ Der bisherige Vorschlag ist der
**Standard** — für neue **und** bestehende Instanzen: Wer keine eigenen Einstellungen gespeichert hat, rechnet damit; wer schon gespeichert hat,
behält seine Fassung (auf dem Live-System gibt es noch keine, der Bestand ist neu). „Auf Standard zurück“ führt hierher.

Marketing (Schwelle MQL **8** von 53, gilt für Marketing-Leads — siehe oben): Gespräch (×2: 5/3/1 nach Alter), Antwort (×2), Termin, Event besucht (1/3/5 nach Anzahl),
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
die vorhandenen Leads** (MQL und SQL-bereit vorher/nachher, Temperatur-Verteilung, Beispiele). „Letzte Änderung zurücknehmen“,
„Auf Standard zurück“ und „Bisherige Rechnung (bis 03.10.)“ gibt es mit einem Klick.

## Bisherige Rechnung (bis 03.10.) — wählbar, nicht mehr Standard

Fit 30 · Wärme 30 · Qualifizierung 30 · Erreichbarkeit 10 = 100; MQL ab 35 Marketing-Punkten (frisches Gespräch + mindestens zwei Wege);
SQL bei Schmerz + Entscheider + Budget **oder** Zeitpunkt (Schwelle 15 = die Mindestsumme dieser Regel); Temperatur 25 / 50 / 75. Sie bleibt als Fassung
„Bisherige Rechnung (bis 03.10.)“ in den Scoring-Einstellungen wählbar (`bisherigeRechnung()`, Etikett `bisherig`) — „Auf Standard zurück“ bringt den
neuen Standard wieder. Eine früher als „Standard“ gespeicherte alte Rechnung wird beim Lesen als „bisherig“ erkannt (nur das Etikett, nie die Zahlen).
**Bewiesen**, nicht behauptet: `tests/scoring-standard-paritaet.test.ts` vergleicht den Kern mit diesen Einstellungen bei 500 zufälligen Leads Teil
für Teil mit der wörtlich übernommenen alten Rechnung (`tests/fixtures/lead-score-vor-scoring.ts`).

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
- Kein Ein-Klick-Rückgängig für „Firmen zusammenführen“ in der Runde; stattdessen: Vermerk an der behaltenen Firma (Name und abweichende Angaben
  der anderen), Ablehnung, solange außerhalb von Kartei und CRM (Aufgaben, Ziele, Zeit, Finanzplan, Dateiablage …) noch etwas an der anderen Firma
  hängt — und seit 03.10. eine **Sicherung vor dem ersten Schreibschritt** (30 Tage, siehe unten) mit dokumentiertem Weg zurück.

## Firmen zusammenführen: Sicherung (30 Tage) und Weg zurück

Kevin (03.10.): Vor jedem Firmen-Zusammenführen eine Archivkopie aller betroffenen Einträge — wie beim Kennungs-Umzug.

- **Schritt `archiv`** (erster Schritt der Absicht `firma-umhaengen`): `lib/crm/firma-umhaengen-server.ts` schreibt über `archivSchreiben`
  `archiv/crm-vor-firmen-zusammenfuehren-<zeit>.json` — **verschlüsselt** wie die Bestände (Datenschlüssel, `lib/store/archiv.ts` / local-db-Hülle).
  Inhalt (`firmenArchivInhalt`): beide Firmen (und Töchter), die betroffenen Kontakte (`kontakte.kontakte`), je CRM-Liste (Deals, Mandate, Angebote,
  Events mit Bezug, Follow-ups, Kampagnen, Leads an Firmen …) genau die Einträge, in denen die Kennung der weggeführten Firma vorkommt. Abgelehnte
  Zusammenführungen (Art. 18, Fremdbestand) legen keine Sicherung an. Eine Wiederaufnahme nach Abbruch legt keine zweite an.
- **30 Tage:** der Präfix `crm-vor-` ist eine Umzugs-Kopie — die Löschfrist `archiv-umzug` (Standard 30 Tage, einstellbar 7–365) entfernt sie
  automatisch (`loeschfristen-lauf.ts`). **Art. 17:** `archivTilgen` nimmt eine gelöschte Person auch aus der Sicherung (Kartei-Eintrag raus, Rest
  getilgt) — sie kommt beim Wiederherstellen nicht zurück. Speicher-Register: Kommentar bei den Archivkopien in `lib/crm/speicher-register.ts`;
  Wächter: `tests/firma-archiv.test.ts` (Sicherung vor dem ersten Schritt, verschlüsselt, 30 Tage, Art. 17).
- **Wiederherstellen:** `POST /api/crm/firma-archiv` — `{ aktion: 'liste' }` zeigt die Sicherungen (Firmen, Person, Resttage, ob es geht);
  `{ aktion: 'wiederherstellen', datei }` legt die weggeführte Firma wieder an und setzt Personen, Deals, Mandate, Angebote, Events, Follow-ups auf den
  gesicherten Stand — **nur dort, wo sie seit dem Zusammenführen unverändert sind** (das Ergebnis der Zusammenführung wird mit denselben Funktionen
  nachgerechnet und verglichen). Was seitdem jemand angefasst oder gelöscht hat, bleibt und wird in der Antwort genannt. Nur der Inhaber, von Hand
  (Dienstweg/ZOE und Mitglieder → 403; Art. 18 → 409; zweites Mal → 409). Läuft über dieselbe Absicht (`aktion: 'zurueck'`), Abbruch wird fortgesetzt.
- Im Dialog „Zusammenführen › Firmen“ steht: „Vor dem Zusammenführen wird eine Sicherung angelegt (30 Tage).“
