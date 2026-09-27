# Finanzplanung jetzt — Plan und Stand (27.09.2026)

Kevin: „Unsere privaten Finanzen und die Firmenfinanzen in einem Szenario planen. Die Zahlen sind echt. Als ‚Finanzplanung jetzt‘
links unter die Agenten, die ganze Systematik, in unserem Design, sofort funktional. Malin sieht alles. Später wandern die Teile
unter Privat › Finanzen und Business — jetzt erst ein eigener Bereich.“

## Quelle
Kevins Einbaupaket „Modul Finanzen v3“ (Vault, 27.09.): Konzept `01. MAKE OS Brain/07_Roadmap/Modul_Finanzen_Konzept.md`
(kritische Prüfung eigener Entwürfe, Recherche YNAB · Monarch · Copilot · Actual · Agicap/Runway · Finanzguru · Profit First),
Rechenkern `finanzen-rechenkern.ts` (gegen Finanzplan v4/Excel geprüft), Mock-up v3 (Funktionsvorlage, Design wird nicht übernommen),
Startbestand `finanzen-plan.json` (🔒 echte Zahlen, nie ins Repo — kommt per Upload auf den Server).

## Aufbau (Konzept § 3)
| Bereich | Unterseiten | Frage |
|---|---|---|
| Überblick | Lage · Wochen-Check | Wo stehen wir, wo sollten wir stehen, was entscheiden wir diese Woche? |
| Monat | Budget · Buchungen | Sind wir im Tempo? Wofür ging das Geld? |
| Planen | Privat · UG · Töpfe UG · KD Ventures · Selbstständigkeit · Szenarien · Ziele | Was soll passieren — und was, wenn es anders kommt? |
| Verpflichtungen | Schulden · Zu erledigen · Kalender & Verträge | Was müssen wir zahlen, nachreichen, eintreiben — bis wann, wer? |
| Auswerten | Entwicklung · Geldfluss · Protokoll | Wie entwickelt es sich, wohin fließt es, wer hat was geändert? |

## Technik
- **Rechenkern:** `lib/finanzen/rechenkern.ts` — Kevins v3 unverändert übernommen (nur Typ `fokus.entscheidung` ergänzt, zwei Non-Null-Behauptungen
  im Zahlungskalender aufgelöst). EINE Wahrheit für Seite, Routen und Jarvis. Lokal gegen die echte Datei geprüft: Repo-Rechenkern = Mock-up-Rechenkern
  in allen fünf Szenarien (11.122 Vergleiche, 0 Abweichungen, keine nicht endlichen Werte).
- **Operationen:** `lib/finanzen/plan/operationen.ts` (rein, getestet) — Pfade `/plan/<zeile>:<monat>`, Listen über `id=<kennung>` oder Index, `/-` hängt an,
  fehlendes `neu` entfernt; gesperrt: version, stand, monate, historie, meta, protokoll. `/regeln/<empfänger>` merkt die Regel und ordnet rückwirkend zu
  (`lerneRegel`). Protokoll (wer/wann/feld/alt/neu, 500 Einträge), Zellen-Meta (wer/wann je Planzelle), neuer Stand = Zeitstempel, immer größer als der alte.
  `pruefeDokument` (strikt: version 3, szenarien, annahmen, Zeitachse Jan–Sep 26 + ≥ 15 Planmonate) und `leeresDokument`.
- **Speicher:** `lib/finanzen/plan/speicher.ts` — Bestand `finanzen-plan--<haushalt>` (Kevin + Malin = ein Haushalt), Prüfung und Schreiben in EINER
  `updateJson`-Sperre, 409 mit aktuellem Dokument bei fremdem Stand, Import ersetzt nur mit ausdrücklichem `ersetzen`.
- **Routen:** `GET /api/finanzplan` (ETag aus dem Dateistand, gepackt; `dokument: null` ohne Startbestand) · `GET ?nur=kennzahlen` (verdichtet, für Jarvis/
  Startfläche) · `PATCH { basisStand, ops }` · `POST /api/finanzplan/import` (multipart `datei` oder JSON `{ leer: true }` / `{ dokument }`, `ersetzen`).
  Zugang überall nur `haushaltVon(req)`.
- **Oberfläche:** `/os/finanzplan` (`app/os/finanzplan/page.tsx`, force-dynamic), `components/os/finanzplan/`: `Finanzplan.tsx` (Rahmen), `daten.ts`
  (Laden mit ETag, Abgleich 30 s, optimistisches Anwenden, Rückgängig-Stapel aus Gegenoperationen, Meldungen), `teile.tsx`, `diagramme.tsx` (SVG),
  `Blatt.tsx` (Excel-Gefühl), `ZeileDialog.tsx`, `Ueberblick.tsx`, `Planen.tsx`, `Monat.tsx`, `Verpflichtungen.tsx`, `Auswerten.tsx`, `Einrichtung.tsx`.
  Adresse: `?u=<unterseite>` (+ `monat`, `zeile` für Sprünge in die Buchungen).
- **Navigation:** Eintrag „Finanzplanung jetzt“ in `EIGEN` (`lib/make-one/spaces.ts`) direkt unter Agenten; eingeklappt nur das Symbol (Calculator).
- **Tests:** `tests/finanzplan-rechenkern.test.ts` (Rechenkern mit erfundenen Zahlen, von Hand nachgerechnet), `tests/finanzplan-operationen.test.ts`
  (Pfade, Operationen, Stand, Prüfung, Helfer), `tests/finanzplan-routen.test.ts` (Routen mit eigenem Datenordner: 403, Import, 409, ETag/304, Regel,
  Kennzahlen). 53 Tests grün (mit Lesbarkeit und Spaces). Dazu ein lokales Prüfskript, das alle 17 Unterseiten serverseitig rendert (20 Prüfungen grün) —
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
9. Doku — **fertig** (dieser Stand)

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
1. Startbestand auf dem Server hochladen (Einrichtungskarte oder `POST /api/finanzplan/import`) — lokal liegt die Datei zur Prüfung unter `.data/`.
2. Sichtprüfung im Dev-Server: Blatt am Handy (720 px), Kontextmenü per Langdruck, Verbergen, Rückgängig.
3. Kontostände aller Konten eintragen (Verpflichtungen › Zu erledigen › Kontostände).
4. Offene Familienposten klären; Jahreskosten-Topf füllen (welche Jahreszahlungen, welcher Monat); ein Konto oder drei.
5. Finanz-Cockpit abschalten oder als Import-Werkzeug behalten; danach die Buchungen aus dem Haushalts-Import hier hinein (ein IST).
6. Jarvis/Startfläche an `?nur=kennzahlen` anschließen; Export-Route; Schnellsuche und `lib/wege.ts` ergänzen.
7. vitest: `esbuild: { jsx: 'automatic' }` in `vitest.config.ts`, damit der Ansichten-Test ins Repo kann.
8. Danach: Privat-Teile unter Privat › Finanzen, UG/KD Ventures unter Business.
