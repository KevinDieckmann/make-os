# Finanzplanung jetzt — Plan und Stand (27.09.2026, abends: Szenario-Baukasten)

> 30.09.: Die Gesellschaft `ug` heißt **MAKE Innovation GmbH** (kurz „MAKE“, vorher „MAKE OS UG“). Anzeigenamen kommen aus
> `lib/einheiten.ts` (`UG_NAME`/`UG_KURZ`); Kennungen und Code-Namen im Rechenkern (`ug`, `rechneUG`, `MonatUG`, `steuerUG`) bleiben.

Kevin: „Unsere privaten Finanzen und die Firmenfinanzen in einem Szenario planen. Die Zahlen sind echt. Als ‚Finanzplanung jetzt‘
links unter die Agenten, die ganze Systematik, in unserem Design, sofort funktional. Malin sieht alles. Später wandern die Teile
unter Privat › Finanzen und Business — jetzt erst ein eigener Bereich.“

## Quelle
Kevins Einbaupaket „Modul Finanzen v3“ (Vault, 27.09.): Konzept `01. MAKE OS Brain/07_Roadmap/Modul_Finanzen_Konzept.md`
(kritische Prüfung eigener Entwürfe, Recherche YNAB · Monarch · Copilot · Actual · Agicap/Runway · Finanzguru · Profit First),
Rechenkern `finanzen-rechenkern.ts` (gegen Finanzplan v4/Excel geprüft), Mock-up v3 (Funktionsvorlage, Design wird nicht übernommen),
Startbestand `finanzen-plan.json` (🔒 echte Zahlen, nie ins Repo — kommt per Upload auf den Server).

## Aufbau (seit 27.09. abends — Kevin: „so können wir damit noch nichts machen und auch nichts planen“)
| Bereich | Unterseiten | Frage |
|---|---|---|
| Lage | Lage | Frei verfügbar diesen Monat · Runway · Ziele im Plan — und was jetzt zu entscheiden ist (mit Sprung ins Feld) |
| Planen | Szenarien bauen · Treiber & Annahmen | Szenario = Basis + Bausteine + Annahmen; Regler; Vergleich; Arbeitsplan |
| Privat | Privat | Das Privat-Blatt (IST-Historie + Plan) |
| Business | MAKE Innovation GmbH · KD Ventures · Selbstständigkeit | Die Gesellschaften getrennt |
| Gesamt | Gesamt · Entwicklung · Geldfluss | Übergänge (Gehalt, Ausschüttung), Mindestumsatz, Steuerrücklage, Gruppe je Monat |
| Buchungen & Check | Buchungen · Budget · Wochen-Check · Zu erledigen · Kalender & Verträge · Schulden | IST, Tempo, Verpflichtungen, Rhythmus |
| Ziele & Töpfe | Ziele · Töpfe MAKE | Ziele mit Tempo, Profit-First-Töpfe |
| Protokoll | Protokoll | Wer hat was geändert |

Die 17 alten Unterseiten leben darunter weiter; alte `?u=`-Adressen lösen auf (`bereichVon` in `lib/finanzen/plan/hilfen.ts`). Bei einem Bereich mit nur
einer Unterseite verschwindet die Pillenzeile. Das ursprüngliche Konzept-Raster (§ 3: Überblick · Monat · Planen · Verpflichtungen · Auswerten) steht in
der Git-Geschichte (82e43c2).

## Szenario-Baukasten (Kevins Entscheidungen 27.09.)
**Modell.** Ein `Planszenario` (`lib/finanzen/szenarien.ts`) = Basis + Bausteine + Annahmen:
- **Basis** = der Ist-Plan des Dokuments (Zeilen `privatBudget`/`sachkosten`/…, Zellen-Überschreibungen `plan`, gemeinsame `annahmen`) + ein
  **Treiber-Szenario** des Rechenkerns (`basis` = `d.szenarien[].id`, Kevins S1–S5 mit One Banking, Retainern, ASTARNA, Events, KEMARIS-Ausstieg).
- **Umsatzbaustein** = Produkt/Leistung × Kunde/Segment × Preis netto × Menge × Rhythmus (monatlich · jährlich · einmalig) × Start × Laufzeit ×
  Zahlungsziel, Einheit MAKE · Privat · KD Ventures. `produktId` zeigt auf den Katalog; ohne = „ohne Produkt“.
- **Kostenbaustein** = Art (Stelle · Software · Miete · Rate · Sonstiges) × Betrag × Menge × Rhythmus × Start × Laufzeit, Einheit wie oben.
  Stelle = Brutto, der Kern rechnet den Arbeitgeberanteil dazu; Software → Sachkosten; Miete/Rate wirken meist privat.
- **Annahmen je Szenario** (`PlanAnnahmen`): Kevin/Malin brutto, Steuerquote MAKE, Vorgabe Zahlungsziel, Ausschüttung MAKE → Privat ab Monat (brutto) und
  **pauschale Steuer auf die Ausschüttung** (`ausschuettungSteuer`, Vorgabe 26,4 % = Kapitalertragsteuer + Soli, Kevin 27.09.; Hinweis, keine
  Steuerberatung). Leer = wie im Dokument bzw. Vorgabe.
- **Regler** (Was wäre wenn) sind gewöhnliche Bausteine mit `regler`-Marke bzw. Annahmen — die Oberfläche findet sie wieder, die Rechnung nicht.
- Jeder Baustein hat `an` (aus- und einschaltbar ohne Löschen).

**Rechenweg.** `reihen(ps, N)` löst Bausteine in Monatsreihen `Zusatz` auf (Index = Plan-Monat − 1): `ugUmsatz` (Leistung, Gewinn), `ugEingang`
(Kasse, um das Zahlungsziel verschoben; USt kommt wie beim Retainer obendrauf), `ugPersonal` (Brutto weiterer Stellen), `ugSach`, `ausschuettung` (brutto,
verlässt die MAKE-Kasse), `ausschuettungSteuer` (= brutto × Quote; privat kommt brutto − Steuer an, `MonatPrivat.ausschuettung` ist netto,
`ausschuettungSteuer` der Abzug), `privatEin`/`privatAus`, `kdvEin`/`kdvAus`. `annahmenMit()` legt die Szenario-Annahmen über `d.annahmen`. `rechneMit(d, ps, treiber?)` ruft
`rechneUG(d', sz, x)` und `rechnePrivat(d', ug, sz, x)` — der Kern **addiert** die Reihen nur (`+ zx(x?.…, i)`); ohne Zusatz rechnet er Zeile für Zeile wie
bisher (Test „ohne Planszenario rechnet der Kern exakt wie bisher“). Neue Kern-Felder: `MonatUG.bausteineUmsatz/bausteineEingang/stellen/bausteineSach/
ausschuettung/kdvBausteineEin/kdvBausteineAus`, `MonatPrivat.ausschuettung/bausteineEin/bausteineAus`; `toepfeUG` zählt Stellen zu den laufenden Kosten,
der Zahlungskalender zeigt Bausteine, Stellen und Ausschüttung.

**Auswertung** (`auswertung(d, ug, pr)`): `m0` = Plan-Monat von „jetzt“ (vor Okt 26 = 1) · **frei verfügbar** = MAKE frei (nach Steuer/USt) + KD-Ventures-Konto
+ (bekannte private Kontostände aus den Posten + Luft des Monats; fehlende Konten werden gezählt) · **Runway** MAKE = Monate ab jetzt bis `frei < 0`, Privat =
bis (Konten + kumulierte Luft) < 0, sonst null (= über den Horizont) · **Ziele** im Plan/knapp/gekippt aus `zielStaende` · **Mindestumsatz** = Personal inkl.
Stellen + Sachkosten + Holding je Monat (jetzt, Ø 12 Monate, gegen Umsatz Ø 12) · **Steuer** Rücklage jetzt, USt offen, nächste Ertragsteuerzahlung ·
**Übergänge** Gehälter brutto/netto, Ausschüttung brutto/Steuer/netto (Gesamt zeigt alle drei; die Steuer steht auch in der Steuerrücklage-Kachel). `entscheidungen()` leitet daraus Punkte ab (MAKE unter null, Privat im Minus, Runway < 6, Umsatz unter
Mindestumsatz, Ziele gekippt/knapp, Steuer fällig, Konten fehlen, Buchungen offen, kein Arbeitsplan) — kritisch zuerst, jeder mit Sprung
(`?u=planen&sz=…&feld=umsatz|privat`, `ziele`, `toepfe`, `posten`, `buchungen`, `gesamt`). `vergleich(d, [null, ps…], 3)` rechnet bis zu drei
Spalten (null = Basis).

**Arbeitsplan.** `arbeitsplan` (Kennung) im Dokument; `rechne()` in der Oberfläche und `kennzahlenVon()` (ZOE) rechnen immer mit ihm — Privat-Blatt, MAKE,
KDV, Gesamt, Lage, Treiber-Vergleich (dort mit den Bausteinen des Arbeitsplans je Treiber). Ohne Arbeitsplan gilt der reine Treiber (`aktiv`). Klick auf
einen Treiber setzt `aktiv` und die `basis` des Arbeitsplans.

**Speicherung.** Neue Schlüssel `planszenarien: Planszenario[]` und `arbeitsplan: string | null` im Plan-Dokument (nicht `szenarien` — der Schlüssel war
schon von Kevins Treiber-Szenarien belegt). Operationen wie bisher (`/planszenarien/id=ps1/bausteine/id=b1/preis`, `/planszenarien/-`, `/arbeitsplan`),
Rückgängig als Gegenoperation, 409 bei fremdem Stand. Server-Regeln: Arbeitsplan nur auf vorhandene Kennung (oder null), neues Planszenario braucht freie
Kennung, gelöschtes Planszenario → Arbeitsplan null, gelöschter Treiber → Basis der Planszenarien auf den aktiven. `pruefeDokument` bereinigt
(`pruefePlanszenarien`) und ergänzt fehlende Schlüssel — **ältere Dokumente ohne `planszenarien` laufen** (Test).

**Oberfläche.** `components/os/finanzplan/Baukasten.tsx` (Planen › Szenarien bauen): Szenario-Pillen (★ = Arbeitsplan), + Szenario (Dialog mit Treiber),
Duplizieren/Umbenennen/Löschen, Treiber wählen; Karten Umsatzbausteine (Tabelle, Produkt-Auswahl, Kunde, Wo, Preis, Menge, Rhythmus, ab, Monate,
Zahlungsziel, Summe im Plan; Chips „+ Produkt“ aus dem Katalog — gelb, wenn dem Produkt etwas fehlt — und „Ist-Basis“ aus Mandaten/gewonnenen Deals),
Kostenbausteine (+ Stelle · Software · Miete · Rate), Annahmen dieses Szenarios, Regler; rechts Wirkung gegen Basis (Kacheln + Linie MAKE frei/Privat
angespart, gestrichelt = Basis), Ziele/Mindestumsatz; unten Vergleich nebeneinander (Basis + bis zu zwei, ★ Arbeitsplan je Spalte). Felder speichern bei
Enter/Verlassen (sofort lokal gerechnet), Regler beim Loslassen. `Gesamt.tsx`: Kacheln (frei jetzt, Mindestumsatz-Deckung, Steuerrücklage, USt, Gehälter,
Ausschüttung, Selbstständigkeit 2026), Linie, Blatt „Gesamt je Monat“. `Ueberblick.tsx › LageKopf`: drei Zahlen + „Was jetzt zu entscheiden ist“ +
„Planungsrunde öffnen“; darunter die bisherige Lage.

## Produkte → Deals → Mandate → Planung (Kevin: „clean von vorne bis hinten“)
- **Produkt** (`Leistung`, Katalog im CRM, Seite `/os/mandate?s=produkte`) trägt, was die Planung braucht: `preis.betrag`, `preis.basis`
  (monat · jahr · einmalig — neu, additiv in `lib/crm/typen.ts`; fehlt sie, leitet `preisBasisVon()` sie aus der Freitext-Einheit ab, „festklicken“ speichert
  sie), `laufzeitMonate` (neu), `aufwand { anteil, stunden }` (neu, Marge), `gesellschaft` (→ Plan-Einheit: kdv → KD Ventures, sonst MAKE), `status`.
  `planungFehlt(l)` nennt, was fehlt — auf der Produktseite als „für die Planung fehlt: …“, im Kopf als Zähler, im Baukasten als gelber Chip.
- **Deal** (`Chance`, `leistungId`, `wert {betrag, basis, laufzeitMonate}`) → **Mandat** (`leistungId`, `honorar {betrag, basis}`, `start/ende`,
  `mindestlaufzeitMonate`, `gesellschaft`): aktive Mandate und gewonnene Deals ohne Mandat sind die **Ist-Basis** (`istBasisVorschlaege()`), per Klick ein
  Umsatzbaustein mit Kunde, Produkt, Betrag, Rhythmus, Start (Mandatsbeginn bzw. jetzt) und Laufzeit.
- **Planung**: Umsatzbaustein = Produkt (aus dem Katalog, `bausteinAusProdukt()`: Preis, Rhythmus aus der Basis, Laufzeit, Einheit vorbelegt) × Menge ×
  Preis (überschreibbar) × Start × Laufzeit. Freie Bausteine bleiben möglich („ohne Produkt“). Produkt im Baustein wechseln übernimmt Preis/Rhythmus/
  Laufzeit des neuen Produkts.
- **Zurück**: Produktseite zeigt „In Szenarien: ★ Arbeitsplan (2×) · …“ (`produktInSzenarien()`) und verlinkt „In der Finanzplanung verwenden ›“; der
  Baukasten verlinkt „Produktseite ›“ (kein zweiter Editor). Alles über `GET /api/finanzplan/vorschlaege` (nur lesen, Haushalt-Zugang; ohne CRM leere Listen).
- **Kein Schreibzugriff ins CRM.** Offen: `lib/crm/speicher.ts::leistung()` reicht `preis.basis`, `laufzeitMonate`, `aufwand` noch nicht durch
  (Datei war für dieses Paket gesperrt) — bis dahin verliert die Produktseite diese drei Felder beim Speichern.

## Technik
- **Rechenkern:** `lib/finanzen/rechenkern.ts` — Kevins v3 unverändert übernommen (nur Typ `fokus.entscheidung` ergänzt, zwei Non-Null-Behauptungen
  im Zahlungskalender aufgelöst). EINE Wahrheit für Seite, Routen und ZOE. Lokal gegen die echte Datei geprüft: Repo-Rechenkern = Mock-up-Rechenkern
  in allen fünf Szenarien (11.122 Vergleiche, 0 Abweichungen, keine nicht endlichen Werte).
- **Operationen:** `lib/finanzen/plan/operationen.ts` (rein, getestet) — Pfade `/plan/<zeile>:<monat>`, Listen über `id=<kennung>` oder Index, `/-` hängt an,
  fehlendes `neu` entfernt; gesperrt: version, stand, monate, historie, meta, protokoll. `/regeln/<empfänger>` merkt die Regel und ordnet rückwirkend zu
  (`lerneRegel`). Protokoll (wer/wann/feld/alt/neu, 500 Einträge), Zellen-Meta (wer/wann je Planzelle), neuer Stand = Zeitstempel, immer größer als der alte.
  `pruefeDokument` (strikt: version 3, szenarien, annahmen, Zeitachse Jan–Sep 26 + ≥ 15 Planmonate) und `leeresDokument`.
- **Speicher:** `lib/finanzen/plan/speicher.ts` — Bestand `finanzen-plan--<haushalt>` (Kevin + Malin = ein Haushalt), Prüfung und Schreiben in EINER
  `updateJson`-Sperre, 409 mit aktuellem Dokument bei fremdem Stand, Import ersetzt nur mit ausdrücklichem `ersetzen`.
- **Routen:** `GET /api/finanzplan` (ETag aus dem Dateistand, gepackt; `dokument: null` ohne Startbestand) · `GET ?nur=kennzahlen` (verdichtet, für ZOE/
  Startfläche) · `PATCH { basisStand, ops }` · `POST /api/finanzplan/import` (multipart `datei` oder JSON `{ leer: true }` / `{ dokument }`, `ersetzen`).
  Zugang überall nur `haushaltVon(req)`.
- **Oberfläche:** `/os/finanzplan` (`app/os/finanzplan/page.tsx`, force-dynamic), `components/os/finanzplan/`: `Finanzplan.tsx` (Rahmen), `daten.ts`
  (Laden mit ETag, Abgleich 30 s, optimistisches Anwenden, Rückgängig-Stapel aus Gegenoperationen, Meldungen), `teile.tsx`, `diagramme.tsx` (SVG),
  `Blatt.tsx` (Excel-Gefühl), `ZeileDialog.tsx`, `Ueberblick.tsx`, `Planen.tsx`, `Monat.tsx`, `Verpflichtungen.tsx`, `Auswerten.tsx`, `Einrichtung.tsx`.
  Adresse: `?u=<unterseite>` (+ `monat`, `zeile` für Sprünge in die Buchungen).
- **Navigation:** Eintrag „Finanzplanung jetzt“ in `EIGEN` (`lib/make-one/spaces.ts`) direkt unter Agenten; eingeklappt nur das Symbol (Calculator).
- **Tests:** `tests/finanzplan-rechenkern.test.ts` (Rechenkern mit erfundenen Zahlen, von Hand nachgerechnet), `tests/finanzplan-operationen.test.ts`
  (Pfade, Operationen, Stand, Prüfung, Helfer), `tests/finanzplan-routen.test.ts` (Routen mit eigenem Datenordner: 403, Import, 409, ETag/304, Regel,
  Kennzahlen, Baukasten per PATCH, Vorschläge), `tests/finanzplan-szenarien.test.ts` (Bausteine → Reihen → Kern von Hand, Auswertung, Entscheidungen,
  Vergleich, Produkte als Quelle, Migration ohne `planszenarien`, Operationen auf `planszenarien`/`arbeitsplan`). 81 Tests grün. Dazu ein lokales Prüfskript, das alle 17 Unterseiten serverseitig rendert (20 Prüfungen grün) —
  nicht im Repo, weil vitest hier kein JSX übersetzt (siehe Offenes).

## Bedienung (Konzept § 4)
- Zelle anklicken oder Ziffer tippen · Enter übernimmt · Tab übernimmt und geht nach rechts · Pfeile bewegen die Auswahl · Entf/Backspace setzt zurück ·
  Escape bricht ab · Rechtsklick oder langer Druck: Wert ab hier / 12 Monate fortschreiben, zurücksetzen, ab hier alle zurücksetzen, Notiz.
- Überschriebene Planzellen tragen links den Strich der Person (Farben aus dem CRM-Team: Kevin türkis, Malin lila), Tooltip mit Datum; Notiz = kleiner Punkt.
- Rückgängig: Knopf oben rechts oder Cmd+Z (außerhalb von Feldern). Nach jedem Speichern eine Meldung mit „Rückgängig“; Fehler bleiben rot stehen.
- Verbergen: verwischt alle Beträge (Kacheln, Blatt, Diagramme, Felder ohne Fokus) — gemerkt je Browser.
- Wer plant, kommt aus dem Konto — kein Umschalter.

## Stufen und Stand
1. Rechenkern + Tests — **fertig** (a26d859)
2. Speicher + Routen + Import — **fertig** (4c4d511)
3. Seite, Navigation, Rahmen — **fertig** (9bc0dd9 Grundlage, 06080a0 Rahmen)
4. Überblick — **fertig** (74a75a9)
5. Planen — **fertig** (c5daadd)
6. Verpflichtungen — **fertig** (77d172d)
7. Monat — **fertig** (b9b081b)
8. Auswerten — **fertig** (87da885)
9. Doku — **fertig** (82e43c2)
10. Szenario-Baukasten, Lage, Gesamt, Produkte als Quelle, neue Navigation — **fertig** (27.09. abends, dieser Stand)

Alles nur lokal auf `entwicklung`; nichts gepusht. Sichtprüfung im Dev-Server steht aus (Browser war belegt).

## Abweichungen vom Konzept
- **Speichern:** Konzept § 6.3 nennt `POST /api/state/finanzen-plan/op` mit `basisVersion`; gebaut ist `PATCH /api/finanzplan` mit `basisStand` und
  einer Liste von Operationen (Vorgabe des Einbau-Auftrags). Dafür ist `stand` jetzt ein Zeitstempel statt nur ein Datum — die Seite zeigt den Tag.
- **Wer plant:** kein Umschalter oben rechts (Mock-up), sondern das angemeldete Konto; Personen heißen im Dokument `kevin`/`malin` (Speichernamen).
  Alte Einträge mit „Kevin“/„Malin“/„Beide“ werden beim Anzeigen abgebildet.
- **Regel „merken“:** läuft serverseitig als Operation auf `/regeln/<empfänger>` (rückwirkend über `lerneRegel`) und ist bewusst nicht rückgängig-fähig —
  der Browser lädt danach neu. Ohne „merken“ ändert sich nur die eine Buchung.
- **Dialoge:** keine Browser-`prompt`/`confirm` (können abgeschaltet sein) — eigener Notiz-Dialog, Löschen als zweiter Klick „Wirklich …“.
- **Export/Zurücksetzen:** die Knöpfe des Mock-ups fehlen bewusst. Import läuft über die Einrichtungskarte bzw. die Route (ersetzen nur ausdrücklich).
  Ein JSON-Export ist eine kleine Route — auf Kevins Wort.
- **Sondertilgung** ist eine Probe (nicht gespeichert), wie im Mock-up.
- **Stichtag:** `einstellungen.heute` steuert die Rechnung (wie im Rechenkern). Weicht er vom echten Tag ab, bietet der Überblick „auf heute setzen“ an.
- **Konzept § 6.5/6.6** (sechs Finanzseiten ablösen, Cockpit/Supabase-Anbindung) sind nicht Teil dieser Stufe — Kevins Ansage: erst ein eigener Bereich.
- **Außerhalb der Dateiliste:** `tests/spaces.test.ts` bekam eine Zeile (der neue EIGEN-Eintrag), sonst wäre die Prüfkette rot.
- **Nicht angeschlossen** (Dateien nicht freigegeben): Schnellsuche (`SEITEN` in `components/os/Schnellsuche.tsx`) und `lib/wege.ts` — je ein Eintrag,
  wenn Kevin es will.

## Offen für Kevin und Malin
0. **Sanitizer im CRM** (`lib/crm/speicher.ts::leistung()`): `preis.basis`, `laufzeitMonate`, `aufwand` durchreichen — sonst gehen sie beim Speichern
   auf der Produktseite verloren. Dann auf der Produktseite je Produkt Basis, Laufzeit und Gesellschaft festziehen („für die Planung fehlt“ leer bekommen).
0a. Erstes Szenario bauen: Planen › Szenarien bauen → „Aus Mandaten und gewonnenen Deals anlegen“ oder leer → Bausteine → ★ Arbeitsplan.
0b. Entschieden (Kevin 27.09.): Ausschüttung mit pauschaler Steuerquote je Szenario (Vorgabe 26,4 %); Selbstständigkeit 2026 bleibt Abschlusszahl; „frei verfügbar“ bleibt wie definiert.
1. Startbestand auf dem Server hochladen (Einrichtungskarte oder `POST /api/finanzplan/import`) — lokal liegt die Datei zur Prüfung unter `.data/`.
2. Sichtprüfung im Dev-Server: Blatt am Handy (720 px), Kontextmenü per Langdruck, Verbergen, Rückgängig.
3. Kontostände aller Konten eintragen (Verpflichtungen › Zu erledigen › Kontostände).
4. Offene Familienposten klären; Jahreskosten-Topf füllen (welche Jahreszahlungen, welcher Monat); ein Konto oder drei.
5. Finanz-Cockpit abschalten oder als Import-Werkzeug behalten; danach die Buchungen aus dem Haushalts-Import hier hinein (ein IST).
6. ZOE/Startfläche an `?nur=kennzahlen` anschließen; Export-Route; Schnellsuche und `lib/wege.ts` ergänzen.
7. vitest: `esbuild: { jsx: 'automatic' }` in `vitest.config.ts`, damit der Ansichten-Test ins Repo kann.
8. Danach: Privat-Teile unter Privat › Finanzen, MAKE/KD Ventures unter Business.
