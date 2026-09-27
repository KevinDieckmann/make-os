# MAKE OS — Updates planen

Kevin 25.09.2026: „Das Ganze hier vorbereiten und später ein Update sauber
planen — dann müssen wir nicht immer wieder hochladen. Dann haben wir einen
Stand hier und einen Stand, der online ist.“

## Zwei Stände

| Stand | Git | Wo | Wer ändert |
|---|---|---|---|
| **Online** | `main` | Hetzner, https://2-28-108-162.sslip.io | nur beim geplanten Update |
| **Hier (Entwicklung)** | `entwicklung` | Kevins Mac (`start.sh --entwicklung`) | laufend |

- Gebaut wird **nur auf `entwicklung`**. Ein Push auf `entwicklung` rollt nichts
  aus — ausgerollt wird ausschließlich, was auf `main` landet (GitHub Action).
- Ein Update = `entwicklung` nach `main` bringen, einmal pushen, einmal prüfen.
- Dringende Fehler im Online-Stand: kleiner Fix auf `main` (Hotfix), danach
  `main` wieder in `entwicklung` holen.

## Online seit 25.09.2026 (Stand `e2c52a3`)

- Bauplan als Board (Ideen → Bereit → In Arbeit → Zum Testen → Fertig), Knopf „Idee“, Planung mit Etappen
- Produkte & Mandate
- Kalender oben neben der Inbox (Woche mit Terminen, Blöcken, Aufgaben, Fristen) — **iCloud verbunden seit 25.09. 19:14**
  (Privat Kevin, Privat Malin und seit 25.09. abends „MAKE Gemeinsam“ — in iCloud angelegt, mit Malin geteilt, in den Einstellungen als gemeinsamer Kalender eingetragen)
- iCloud-Skript vereinfacht (Update 25.09. abends, `3b042a7`)

## Update 25.09.2026 abends — online

- Kalender: gemeinsamer Kalender heißt standardmäßig „Gemeinsam“; beim Anlegen werden nur Kalender angeboten, die es in iCloud gibt.
- **Business-Index** (unsere KSI-Logik, eigene Zahlen): Cockpit `/os/business` hinter dem Kopf-Ring „Business“
  mit 26 Kennzahlen, je Firma + gesamt, Monatsabschluss, Köpfe; Wachstums-Score und Jarvis rechnen damit
  („eine Wahrheit“). Nach dem Update: einmal Köpfe (FTE) und den letzten Monatsabschluss eintragen.
- **Business-Index tiefer verankert:** Streifen auf Zahlen · Markttraktion · Mandate; Jarvis beantwortet
  Kennzahl-Fragen und nimmt den Monatsabschluss auf (mit Freigabe); Head of Finance warnt bei Rot und
  fehlendem Abschluss; eigene Schwellen und Jahresziele je Firma; Verlauf 90 Tage.
- **Design: tiefe Akzente überall** — Ringe, Balken, Kopf-Ringe, Hauptknöpfe, Häkchen im Stil des
  Kontakt-Kürzels; Leuchtkränze gedämpft (54 Stellen).

Einmalig danach: im Cockpit `/os/business` Köpfe (FTE) und Jahresziele je Firma eintragen, dazu den
Monatsabschluss August — das schließt die meisten Messlücken.

## Online seit 26.09.2026 (Stand `400c9a1`, letztes Ausrollen 13:45)

Alles aus den Blöcken „Nächstes Update“ unten ist seit 26.09. online: Next 15.5, Sicherheits-Wellen 1–4 (zuletzt
zweiter Faktor, `__Host`-Cookie, Verschlüsselung im Ruhezustand — auf dem Server eingeschaltet, 151 Bestände
umgestellt), Gesundheits-Index, Traktions-Index, keine toten Stellen, Whoop-Import online. Die Blöcke bleiben als
Ansage stehen, bis das nächste Update sie ablöst.

**Für Kevin und Malin jetzt:** einmal neu anmelden → Konto → „Zweiter Faktor“ einrichten. Kevin: die Zeile
`MAKE_OS_DATEN_SCHLUESSEL=…` aus `/srv/make-os/app/.env` in den Passwort-Manager
(`ssh make@2.28.108.162 grep MAKE_OS_DATEN_SCHLUESSEL /srv/make-os/app/.env`).

## Nächstes Update — vorbereitet, noch nicht online

### Markttraktion komplett (27.09. nachts, nur lokal)

Kevin: „Marketing noch gar nicht angepasst, Events nicht drin, neben Firmen und Kontakten Deals einpflegen, dann Follow-up-Ebene, dann erst Stammdaten. Deal- und Follow-up-Ebene sauber, das ganze System dahinter sauber aufgesetzt.“

- **Reiter in Kevins Reihenfolge:** Überblick · Kontakte · Firmen · Deals · Follow-up · Marketing · Events · Stammdaten. Der Reiter „Sales“ ist aufgegangen:
  Leads stehen bei den Firmen (Alle Firmen · Leads qualifizieren), die Power Hour im Follow-up, Kampagnen im Marketing. Alle alten Links laufen weiter.
- **Fundament:** Deals und Mandate hängen an der Firma per Kennung (nicht mehr per Name; alte Einträge werden beim Laden nachgezogen).
  Deals entstehen nur noch auf EINEM Weg (Dialog „Neuer Deal“ überall: Pipeline, Karteikarte, Leads, Jarvis) — Kernfragen vom Lead, nächster Schritt Pflicht,
  kein zweiter offener Deal an derselben Firma ohne Absicht, der Lead wird SQL mit Verweis. Stufenwechsel prüft der Server: verloren nur mit Grund,
  geparkt nur mit Wiedervorlage, eine offene Zielstufe nur mit nächstem Schritt; die Historie hängt der Server an.
- **Deals:** Board mit Ziehen (auf Gewonnen/Verloren/Geparkt mit Nachfrage), Liste, **Deal-Akte** (Stufen-Treppe mit Austrittskriterium, Personen mit
  Rolle Entscheider/Fürsprecher/Nutzer/Bremst, Verlauf mit Verweildauer, Aktivitäten der Beteiligten, offene Follow-ups), **Auswertung** (Prognose nach
  Monat der Entscheidung, Win/Loss mit Gründen, Zyklus, Ø Deal-Größe, Verweildauer und Umwandlung je Stufe, hängt nach Wert). Quoten erst ab 5 Fällen.
- **Follow-up (neu):** EINE Liste aus Zusagen, Wiedervorlagen, Deal-Schritten, Nachfassen nach Events, Reviews und der Kadenz je Kreis (A 30 · B 60 · C 90 · D 180 Tage) —
  überfällig · heute · diese Woche · später, Filter Alle / je Person (aus dem Team), Wochenansicht (mit „Nächste Woche“ darunter), Kadenz-Ansicht. Erledigen fragt Ergebnis und **nächsten Schritt**
  (Pflichtfrage, bewusst „kein nächster Schritt“ möglich) und schreibt eine Aktivität an die Person; Verschieben +1/+3/+7 (ab dem dritten Mal ein Hinweis), Absagen. „+ Follow-up“ von Hand.
- **Kennzahlen (Traktions-Index, Sales):** Win Rate 180 Tage, Sales-Zyklus Median, hängt nach Wert, Follow-ups pünktlich, überfällige Follow-ups, Neuumsatz gegen Monatsziel.
- **Stammdaten:** Wertelisten pflegbar (Verlustgründe, Kadenz je Kreis, Gesprächsergebnisse, Ziele je Monat — Ziele sind die Messlatte für Gespräche/Woche und SQL/Monat),
  fünf CSV-Exporte (Kontakte, Firmen, Deals, Follow-ups, Mandate; nie die private Notiz), Karten Produkte/Segmente/Team, Unter-Reiter in der Adresse, Ladefehler mit „Noch einmal“.
- **Marketing:** oben die **Marketing-Strecke** Reichweite → Resonanz → Anfragen → Übergabe (30/90 Tage) mit Kosten je Anfrage und je SQL; neuer Reiter **Anfragen** (Eingang: Person
  vorhanden oder neu, Kanal, Bezug Beitrag/Kampagne/Event → Aktivität, Follow-up „Anfrage beantworten“, Lead „kontaktiert“, Wirkung am Beitrag); Startassistent, wenn Positionierung
  und Beiträge fehlen (Positionierung mit drei Säulen → erster Beitrag → erste Zielgruppe); Kosten (€) an Kampagne und Beitrag; „Deal aus dieser Kampagne“ (Quelle Kampagne am Deal);
  Newsletter mit Stimme (Kevin/Malin/Marke). Recht: eine Anfrage erlaubt die Antwort, keine Werbung — die braucht weiter die Einwilligung.
- **Events:** Start ohne Daten (Vorlage, Ziel Pflicht — „Netzwerken“ ist kein Ziel), Nachfassen hebt den Lead der Firma auf „Im Gespräch“, „Deal daraus“ (Quelle Event),
  „Follow-up anlegen“ für Gäste ohne Nachfassen, Feedback je Gast (Note 1–5 + Satz, Ø Note je Event), Budget → Planposten in der Liquiditätsplanung (Kategorie Marketing & Events,
  nie doppelt), Termin im Kalender „Gemeinsam“ (drei Stunden, ohne Gäste) mit Kennung am Event.
- **Kennzahlen (Traktions-Index, Marketing):** Anfragen · 90 Tage, Kosten je Anfrage.
- **Feinschliff:** alle Ziele, Texte und die Schnellsuche zeigen auf die neuen Reiter; Deal löschen nur noch bei Fehlanlagen (Sperre statt Löschen).
- **Feinschliff 2 (Prüfbericht, 57 Punkte):**
  - **Zugang:** jede `/api/crm/*`-Route prüft jetzt den Haushalt des Inhabers (vorher nur die Anmeldung) — ein fremdes Konto sieht kein CRM.
  - **Ein Deal-Weg wirklich überall:** Leads › SQL, Event „Deal daraus“ (Quelle geht in den Dialog, kein Nach-PATCH), Jarvis — alles durch `dealAnlegen`,
    Prüfen und Schreiben in einer Schreibsperre (keine zwei offenen Deals bei gleichzeitiger Anlage); Schritt-Datum in der Vergangenheit wird abgelehnt.
  - **Server-Regeln geschärft:** neue Deals nicht per Upsert, Löschen nur bei Fehlanlagen, `letzteAktivitaet` setzt nur der Server, Vergleich auf den
    lokalen Tag (nachts kein UTC-Versatz mehr — auch in Win Rate, Zyklus, Neuumsatz), überfälliger Schritt wird beim Ziehen im Board genannt, statt still zu scheitern.
  - **Follow-up-Route neu:** Erledigen liest den Bestand frisch (kein Überschreiben paralleler Änderungen), fasst Personen-Felder nur an, wenn sie die Quelle sind,
    „Als Nächstes“ am Deal wird sein nächster Schritt, Event-Follow-up erledigt = Gast nachgefasst + Lead gehoben, Kadenz verschieben/absagen legt einen echten
    Termin im nächsten Takt an, Vergangenheit wird abgelehnt, überfällig abgesagt = „verpasst“.
  - **Firma per Kennung überall:** Deal-Karte wählt die Firma aus der Liste (setzt Kennung + Name), Listenzeile, Akte, Leads und Export lesen über die Kennung.
  - **Deal-Akte:** Treppe zeigt bei verloren/geparkt die letzte erreichte offene Stufe, Follow-ups nur zum Deal und zu den Beteiligten (keine Kadenz-Erinnerungen),
    Verlauf sortiert, Win Rate und „hängt“ mit denselben Schwellen wie die Kennzahlen (40/20 % · 15/40 %).
  - **Nachfragen im Fenster** statt Browser-`prompt` (Firma anlegen, Lead-Grund, Antrag erledigt, Löschgrund) — Escape bricht ab, Enter übernimmt.
  - Kleinigkeiten: Deal-Pillen Board · Liste · Kunden · Auswertung; Art.-14-Befund führt zu den Kontakten; eigener Kadenz-Takt ab 1 Tag; „Deal“ statt „Chance“ im Sichtbaren;
    Löschen meldet Fehler; „heute“-Rückfall im Browser lokal statt UTC; Gäste „Nachgefasst“ nutzt denselben Weg wie das Nachfassen; Suche führt Deals in die Akte.
  - Tests: `crm-deal-regeln` (Server-Regeln), `crm-fundament` angepasst (Upsert neuer Deals ist jetzt ein Fehler). Stand: 100 Dateien · 877 Tests grün, tsc und Lint sauber.
  - **Offen (Kevin entscheidet):** Farbe des Reiters „Firmen“ (heute neutral wie Kontakte, obwohl die Leads darin liegen); ob „Meins/Malin“-Filter auch im Board sichtbar sein soll.

### Brain-Abteilung (27.09., nur lokal)

Kevin: „wie ein Wikipedia mit allen Infos chatten … alle wichtigen Regeln fürs Brain festlegen … ein Gedächtnis auf dem Hetzner-Server, das die KI selbst ausbaut.“
Recherche mit 70 Quellen in `BRAIN_RECHERCHE.md`; Kevins Entscheidungen (klickbar, 27.09.): Volltext-Index **und** lokale Embeddings · Jarvis nur Vorschläge + eigenes Log · Konstitution + Regelregister · nächtliche Konsolidierung.

- **Brain-Index** (`lib/brain/index.ts`): SQLite FTS5 (Node-eigen, kein Zusatzpaket) über **Abschnitte** der Notizen (an Überschriften geschnitten, mit Kontextzeile
  „Notiz › H1 › H2 · tags“, ~2.000 Zeichen, 10 % Überlappung), inkrementell je Notiz-Hash, Wikilinks als Nachbarschaft (1 Hop), Sicht (scope/owner) vor dem Ranking,
  Titel-/Überschriften-Treffer wiegen extra. Alle 10 Minuten vom Takt abgeglichen; die Suche des Vaults (Jarvis, Wissen-Seite, Brain-Chat) läuft darüber, Rückfall ist die alte Dateisuche.
  Datei `.data/brain-index.sqlite` — Klartext wie der Vault selbst, außerhalb des Vault-Git-Repos, jederzeit neu baubar.
- **Lokale Embeddings** (`lib/brain/einbettung.ts`): multilingual-e5-small (Transformers.js/ONNX, int8, 384 Dim.), faul geladen, Vektoren im Index, Kosinus im Speicher,
  **hybrid** mit BM25 per Reciprocal Rank Fusion. Gemessen auf dem Mac: Laden 7 s, drei Einbettungen 47 ms, Prozess ~600 MB. Auf dem 2-GB-Server knapp: Ladeschutz
  unter 400 MB frei, Schalter `MAKE_OS_EMBEDDINGS=aus`; der Head of IT zeigt den Hinweis. Modell-Cache außerhalb der Daten (`/srv/make-os/modelle`, `~/.cache/make-os/modelle`).
- **Konstitution + Regelregister** (`lib/brain/regeln.ts`, Wissen › Regeln): `00. Fundament/KONSTITUTION.md` (≤ 250 Zeilen, in jedem Jarvis-Gespräch geladen) und Regel-Notizen
  `00. Fundament/Regeln/*.md` mit Frontmatter (Priorität 0–3, gilt_fuer kevin/malin/beide/jarvis, Status entwurf/aktiv/abgelöst, Quelle, erstellt/geändert/freigegeben von+am).
  Anlegen, freigeben, ablösen in MAKE OS; nur **aktive** Regeln gehen in den Prompt (Jarvis und Brain-Chat), hart zuerst. Versionen über das Git-Repo des Vaults.
- **Brain-Inbox** (`lib/brain/inbox.ts`, Wissen › Inbox): Jarvis legt Vorschläge nach `_inbox/jarvis/` (neue Notiz, Ergänzung einer Notiz, Regel) mit Begründung, Quelle und
  Vertraulichkeit (gemeinsam · privat-kevin · privat-malin). Annehmen macht Wissen daraus — mit Provenienz (`erstellt_von: jarvis`, `freigegeben_von: <Person>`); Ablehnen bewahrt den Grund.
  `_inbox` ist aus der Suche ausgeschlossen: ein Vorschlag ist kein Wissen, bis ihn ein Mensch freigibt.
- **Nächtliche Konsolidierung** (`lib/brain/konsolidierung.ts`, Systemlauf `konsolidierung` ab 21 Uhr): verdichtet neue Gedächtnis-Fakten, das Jarvis-Log und heute geänderte
  Protokolle zu höchstens fünf Vorschlägen (Fremdtext als Daten, Widersprüche als eigener Vorschlag). Ohne KI-Guthaben als Regelwerk: die Fakten des Tages als ein Vorschlag. Auf Zuruf per Knopf.
- **Brain-Chat:** zitiert `[[Titel#Abschnitt]]`, kennzeichnet Unbelegtes als „(Vermutung)“, kennt Konstitution und Regeln.
- Von mir gesetzt (Recherche-Empfehlung): Vault-Markdown bleibt die Wahrheit, ein Vault mit Sicht-Filter, Git des Vaults für Versionen, Ton bleibt Du.
- Tests: `brain-chunks`, `brain-index`, `brain-einbettung`, `brain-regeln`, `brain-inbox`, `brain-konsolidierung` (Test-Vaults im Temp-Ordner, nie der echte).
- **Offen (Kevin):** Server-RAM für Embeddings (2 GB reichen kaum neben App und Arbeiter — Upgrade auf 4 GB oder `MAKE_OS_EMBEDDINGS=aus`); Eval-Set mit 40 Fragen aus dem echten
  Vault (`scripts/`, braucht den Vault — kommt als nächster Schritt); Kern-Blöcke (Profil Kevin/Malin, laufende Projekte) als eigene Notizen anlegen, dann lädt Jarvis sie immer.

### Datenschicht Stufe 2 — zu zweit sicher (27.09., nur lokal)

Kevin (27.09., klickbar): JSON bleibt, Stufe 2 jetzt; danach Brain, dann Kalender.

- **Stand je Kontakt:** jede Zeile trägt einen Fingerabdruck des gespeicherten Datensatzes. Der Browser schickt ihn mit jeder Änderung zurück — hat inzwischen jemand
  anderes geschrieben (Malin, Jarvis, ein Signal), kommt 409 mit dem aktuellen Stand, die Kartei lädt neu und sagt es. Nichts wird mehr still überschrieben.
- **Nur Felder ändern:** Akte, Kartei, Firmen-Zuordnung und Kreis-Runde senden nur noch die geänderten Felder (`teil`), nicht den ganzen Kontakt.
- **Alles in der Sperre:** Massen-Wache (Stufenwechsel), Massenlösch-Schutz, Stand-Prüfung, CSV-Import (Einarbeiten + Schrumpf-Schutz) und Lead→Mandat prüfen und
  schreiben denselben Bestand — ein Doppelklick legt kein zweites Mandat mehr an.
- **Abgleich überträgt nur Änderungen:** kennt der Server den Stand, den das Fenster hat, gehen nur geänderte Zeilen und gelöschte Kennungen über die Leitung
  (statt 750 KB für 453 Kontakte bei jeder Änderung).
- Tests: `patch-liste-stufe2` (7 Fälle). Stand: 105 Dateien · 899 Tests grün, tsc und Lint sauber.

### Datenschicht Stufe 1 (27.09., nur lokal)

Kevin (26.09.): „die ganze Datenarchitektur verbessern, sodass es sehr gut läuft“ — als dringend für den 27.09. eingeplant. Plan und Befund in `DATENARCHITEKTUR.md`.

- **Lesefehler sind Fehler:** `loadJson` liefert bei Rechte-/E/A-Fehlern kein „leer“ mehr, sondern wirft — der nächste Schreiber hätte sonst den Bestand mit `cur ?? {…}` überschrieben (Befund 1, Datenverlust-Lücke).
- **Beschädigtes bleibt geschützt:** liegt eine `.corrupt-`Kopie neben dem Bestand, lehnt der Store jede Schreibung ab, bis die Kopie geprüft ist.
- **Unverändertes wird nicht geschrieben:** GETs, die „nur nachtragen“ (Traktion, Stammdaten, Kalender-Caches), lassen die Datei in Ruhe, wenn sich nichts ändert — kein ETag-Sprung, kein Neuladen aller Fenster.
- **Lesecache je Bestand** im Prozess (entschlüsselter Text, gültig bei gleichem Inode/Zeit/Größe/Schlüssel) — spart Platte und Entschlüsselung bei jedem Seitenwechsel.
- **Zwischenspeicher bleibt warm:** Rauschen (Anwesenheit alle 30 s, Nutzung, Änderungsprotokoll, Läufe, Warteschlange …) leert die Index-Berechnungen nicht mehr.
- Tests: `local-db-stufe1` (6 Fälle). Stand: 104 Dateien · 893 Tests grün, tsc und Lint sauber.
- **Offen (Kevin):** Speicherfrage für Stufe 2/3 — JSON bleibt (Empfehlung bei 6 MB Gesamtbestand), eine Datei je Kontakt, oder SQLite.

### Agenten live-fähig, Runde 1 (27.09. nachts, nur lokal)

Kevin: „Arbeite alle Agenten, die wir machen wollten, weiter aus, dass sie live gehen können.“ Zuerst das Querliegende, an dem jeder Agent hängt:

- **Guthaben-Schalter** (`lib/anthropic.ts`): die Antwort „credit balance too low“ merkt sich die eine Stelle, durch die jeder Modellaufruf geht — danach 30 Minuten
  kein Aufruf mehr (sofort „guthaben-leer“ statt Gehirn einlesen und scheitern). Der Head of IT zeigt den Stand als Befund „KI-Guthaben“ (grau ohne Schlüssel, rot leer).
- **ok-Vertrag der Läufe** (`lib/jarvis/agenten.ts`): antwortet eine Route mit Fehlerstatus, `ok:false` oder `error`, ist der Lauf ein Fehlschlag — vorher stand so etwas
  bei Verbesserungs-Loop, Delegation, CRM-Tagesliste und Tagesstart als „Erfolg mit 0 Ergebnissen“ in der Warteschlange (und der Takt wartete nicht).
- **Regelwerk statt Ausfall:** Morgen- und Abendlauf liefern ohne KI (kein Schlüssel / Guthaben leer) einen ehrlichen Lagesatz aus den Zahlen (`lib/jarvis/regelwerk.ts`) —
  Aufgaben überfällig/heute/kritisch, Termine, überfällige Forderungen, Frühwarnungen — und stapeln nichts. Der Takt zählt das als Erfolg.
- **Head of IT im Takt:** ab 7:45 der Tagesbericht, danach stündlich der Blick auf NEUES Rot (nur mit Boten); Nachricht an den Inhaber per Telegram, Riegel `hoi-meldung`.
  Im Agenten-Katalog steht der HOI als live (Product), ohne KI.
- **Schalter wirken überall:** „Aus“ unter /os/agenten galt nur für Jarvis und den Takt — jetzt auch für den direkten Aufruf von Wochenplan, CRM-Entwurf, Head of Finance und den Heads (409).
- **Eine Freigabe-Sicht:** /os/stapel zeigt zusätzlich „Freigaben der Heads“ (Sales, Marketing, Event, Finance) mit Anzahl und Titeln — entschieden wird weiter beim Head.
- **Verbesserungs-Loop mit Riegel:** jeder echte Versuch (auch ein übersprungener: zu wenig Nutzung, kein Schlüssel) wird in `nutzung.letzterLoopVersuch` vermerkt, der Takt wartet danach 24 h —
  bis dahin stand der Loop, sobald er 7 Tage her war, jede Minute neu in der Warteschlange (8 Läufe in 3 Stunden, alle „0 Vorschläge“).
- **Fremd-Regel:** der Prospecting-Agent heißt `prospect` — der Eintrag in `FREMD_AGENTEN` zeigte auf `prospecting` und griff nie.
- Tests: `anthropic-guthaben`, `regelwerk`, `hoi-lage` erweitert. Stand: 103 Dateien · 887 Tests grün, tsc und Lint sauber.
- **Runde 2 — jedes Ergebnis hat einen Platz** (vorher nur Text in der Warteschlange, wenn Jarvis oder der Takt den Agenten liefen):
  Wochenplan → jeder Block ein `plan_block`-Vorschlag im Stapel (Freigeben trägt ein) · Meeting → Aufgaben aus dem Protokoll als `create_task`-Vorschläge ·
  Prospecting → Scores wirklich in der Zielliste gespeichert (stand bisher nur im Text) · Content → Ablage „Entwürfe von Jarvis“ auf der Content-Seite (Öffnen/Löschen) ·
  Delegation → letzte Runde erscheint unter Aufgaben („Runde von Jarvis · Datum“, 7 Tage) · Ernährung → Vorschlag wartet auf der Ernährungs-Seite auf „Übernehmen“ (14 Tage).
- **Bleibt geplant** (Katalog sagt jeweils warum): Funnel, SEO, Roadmap, Feedback, Eng/QA, Team.

### Sicherheit & Head of IT (27.09. nachts, nur lokal)

Kevin: „Geh an die Sicherheit … und baue den HOI, den Head of IT: überwacht das ganze System, achtet auf Sicherheit, verbessert den Code — auch von außen.“
Recherche und Zielbild in `HOI_RECHERCHE.md`. Der HOI arbeitet ohne KI-Aufruf: reine Zahlen, Ampeln, Schwellen.

- **Seite `/os/hoi` (System › Head of IT):** Gesamtampel, dann je Bereich (Von außen · Sicherheit · Server · App · Sicherung) die Befunde mit Wert und Satz,
  Kurzbericht (derselbe Text geht später an Telegram). Grau sagt jeweils, welcher einmalige Schritt fehlt.
- **Drei Quellen:** innen (`lib/hoi/innen.ts`: Prozess, Bestände, Arbeiter-Herzschlag `system/takt.txt`, Fehlerquote der Läufe, Oberflächenfehler,
  Fehlanmeldungen und neue Netze, CSP-Meldungen) · Host (`deploy/lage-sammeln.sh`, Cron alle 5 min → `daten/system/lage.json`: Platte, Speicher, Last,
  Container, fail2ban, Zertifikat, Sicherung, Vault, Updates) · außen (`.github/workflows/hoi-aussenblick.yml`, alle 6 h wie ein Fremder: Status, Antwortzeit,
  Sicherheits-Kopfzeilen, Zertifikatsrest). Bewertung rein und getestet in `lib/hoi/lage.ts`.
- **Routen:** `GET /api/hoi/lage` (Haushalt des Inhabers oder HOI-Schlüssel), `POST/GET /api/hoi/aussen` (Meldung des Läufers, letzte 60),
  `POST /api/hoi/csp` (offen für den Browser: nur Zähler — Richtlinie, Quelle ohne Pfad, Seite ohne Parameter; 60/min; 30 Tage; 200 Einträge).
- **Eingeschränkter Schlüssel `MAKE_OS_KEY_HOI`:** öffnet in der Middleware NUR `/api/hoi/*` — der GitHub-Läufer kennt den Dienstschlüssel nicht.
- **CSP meldet Verstöße** (`report-uri` + `report-to` → `/api/hoi/csp`, nur im Produktionsbau, wo die CSP gilt).
- **Anmelde-Alarm** (`lib/zugang/anmelde-alarm.ts`): Anmeldung aus einem neuen Netz und 5+ Fehlversuche in 15 Minuten melden sich bei der Person (Telegram, sobald der Bote läuft) — nie blockierend.
- **Betrieb gehärtet:** `compose.yml` mit Protokollgrenzen (10 MB × 3) und Speichergrenzen (App 1280 MB · Arbeiter 384 MB · Caddy 128 MB);
  Arbeiter und Bote beenden sich bei unbehandelten Fehlern sauber (Docker startet neu, statt halb tot weiterzulaufen);
  `sicherung.sh`/`vault-abgleich.sh` können einen Dead-Man-Ping senden (Datei `.healthchecks-sicherung` / `.healthchecks-vault` mit der URL).
- **Code-Wache in der CI:** Job `sicherheit` (npm audit hoch, gitleaks, knip — meldet, blockiert nicht); Dependabot zielt auf `entwicklung`.
- **Client-Fehler löschen** nur noch der Inhaber.
- Tests: `hoi-lage`, `hoi-rechnen`, `anmelde-alarm`. Stand: tsc, Lint und alle Tests grün.
- **Offen (Kevin):** Telegram-Meldung des Kurzberichts bei Rot (braucht den Boten mit Token); Mozilla-Observatory-Note im Außenblick (die Aktion kann sie holen, wenn gewünscht).

### Zeit & Fokus + Kopf (26.09. spät, nur lokal)

- **Schalter oben rechts:** der Index-Chip wechselt per Klick den Modus Privat ↔ Business (Index und Seiten folgen; auf einer
  Space-Seite geht es zur Übersicht des anderen Space, gemeinsame Seiten wie Home/Heute bleiben). Der kleine Pfeil öffnet die Index-Seite.
  Im Chip steht die Zeit von heute in diesem Modus.
- **Zeit läuft mit:** die Anwesenheit (alle 30 s, nur sichtbares Fenster) schreibt die Zeit dem Bereich gut, in dem man war
  (Gesundheit, Finanzen, Markttraktion, Home …), je Modus. Gemeinsame Seiten zählen für den Modus, in dem man gerade ist.
- **Fokus-Zähler im Kopf:** „Fokus“ startet bewusste Zeit für den aktuellen Bereich, läuft über Seitenwechsel weiter, Stopp verbucht den Block.
- **Säule „Fokus & Zeit“ (10 %) in Privat- und Business-Index:** Zeit im Modus (7 Tage), bewusste Fokus-Zeit (wiegt 1,25), Fokus-Tage,
  Zeit für Gesundheit bzw. in Markttraktion. Die anderen Säulen behalten ihr Verhältnis (50/30/20 bzw. 40/35/25). Unter einer Stunde
  in 7 Tagen zählt die Säule noch nicht (Anlaufphase). Über die Indizes fließt sie in den Wachstums-Score.
- **Widget „Zeit & Fokus“** (Privat/Business) im Katalog: heute, 7 Tage, bewusster Anteil, Bereiche nach Zeit.
- **Wachstums-Score oben links** als Zahl (Klick → Wachstum), Suchfeld ausgeglichen in der Mitte; der Wachstum-Knopf in der Leiste ist weg.
- Neuer Bestand je Person: `zeit` / `zeit--<person>` (400 Tage), Route `/api/state/zeit`. Schwellen sind Annahmen und über die Index-Seite anpassbar.


## Online seit 26.09.2026 spät (Stand `59f275e`, ausgerollt 22:47 auf Kevins Wort)

Alles, was unten in diesem Block steht, ist seit 22:47 online: Tempo, Aufteilung Privat/Business, Spaces zweite Fassung (Home · Heute · Wachstum · Agenten · einklappbare Leiste · Übersicht je Space · Fokus je Space · Jarvis kennt den Space), Durchsicht der ganzen Software. Geprüft 22:50: Server auf `59f275e`, App und Arbeiter gesund.

_(hier sammeln, was auf `entwicklung` fertig ist)_

**Spaces, zweite Fassung — nur lokal, noch nicht hochgeladen (26.09. abends, Kevin: „vieles macht noch keinen
Sinn, überarbeite das Ganze hier auf dem Klickdummy“)**
- **Home-Knopf** über den Spaces (Kevin): das eigene Dashboard, frei gestaltbar über „Anpassen“. Startstand: Überblick
  Privat und Business zusammen — Privat-Index | Business-Index, Aufgaben Privat | Aufgaben Business, Finanzen privat |
  Wer heute dran ist, Körper | Jarvis & Inbox, Nächste 3 Tage | Fokus, Wachstums-Score.
- **Spaces klappen sofort auf** (Kevin: „muss immer sauber aufgehen“): ein Tipp auf Privat/Business klappt den Kasten
  auf und den anderen zu — ohne wegzuspringen; die Seite wählt man aus den Punkten.
- **Sechs Punkte je Space, symmetrisch:** Privat = Finanzen · Aufgaben · Ziele & Planung · Gesundheit · Familie ·
  Kontakte (neue Seite „Kontakte · privat“ = eure Menschen + wichtige Tage). Business = Finanzen · Aufgaben · Ziele &
  Planung · Markttraktion · Mandate · Agenten. Inbox und Kalender stehen im Kopf oben und folgen dem aktiven Space.
- **Seiten passen zum Space:** Zahlen zeigt im Privat-Space nur Privat + Gesamt, im Business-Space Business, Steuern,
  Gesamt, Head of Finance. Der Planer (Tag/Woche/Monat/Quartal/Jahr/Routinen) nimmt den Space in allen Reitern mit.
- **Farben:** Privat Bernstein, Business Indigo wie in Malins Bild — keine Neonfarben; Leiste nach Malins Aufbau
  (Kästen mit Pfeil, Punkte darunter, unten Jarvis · Brain · System · Konto).
- **Heute und Home getrennt** (Kevin: „oben wieder Heute, Heute mit eigenem Bild, Home baut jeder selbst“): oben im
  Kopf steht wieder „Heute“ → feste Tagesseite (Gruß, Datum, Tagesstart/-ende, Fokus heute, Aufgaben beider Spaces,
  Termine, Körper, Jarvis, Essen). Home (links oben) ist das frei gestaltbare Dashboard, Startstand = Überblick Privat
  und Business. **Wachstum** steht als eigener Knopf unter Home und führt auf die Gesamtansicht: erst die sechs Säulen,
  danach der Score (Kevin: „das zentrale Stück“).
- **Aufgeräumt (Architektur):** `Kopf.tsx` (vorher WachstumsKopf), `HomeView` (/os) und `HeuteView` (/os/heute) klar getrennt,
  alte Navigation (`lib/make-one/navigation.ts`) entfernt, Adressen in `WEG` (home, heute, uebersicht, menschen), Schnellsuche kennt
  Home/Heute/Wachstum/Übersichten, Idee-Erfassung ordnet neue Seiten richtig zu, Jarvis `setze_fokus` je Space; Tests für die Spaces.
- **Leiste einklappbar** (Kevin): das Zeichen oben rechts in der Leiste klappt sie auf eine schmale Symbolspalte zusammen
  (Home, Wachstum, Privat, Business, Agenten, Jarvis, Brain, System, Konto als Symbole mit Tooltip); der Stand bleibt gemerkt.
- **Agenten als eigener Knopf** unter den beiden Spaces (Kevin: „das Agenten-Thema einzeln unter Business“) — nicht mehr
  im Business-Untermenü; Business hat damit Übersicht · Finanzen · Aufgaben · Ziele & Planung · Markttraktion · Mandate.
- **Übersicht je Space** (Kevin: „Privat und Business separat aufbauen“): jeder Space hat als ersten Punkt seine
  eigene Übersicht — ein eigenes Dashboard nur mit dem, was zu ihm gehört (Privat: Privat-Index, Fokus, Körper,
  Aufgaben, Finanzen, Termine, Familie, Essen, Routinen, Jarvis · Business: Business-Index, Fokus, Traktion, Aufgaben,
  Wer dran, Termine, Jarvis, Score). Home bleibt der Überblick über beide.
- **Fokus je Space:** der Fokus-Satz je Horizont gibt es gemeinsam, privat und business (Kompass: Gemeinsam · Privat ·
  Business; Jahres-/Quartals-/Monatsseite im Space schreibt den Space-Satz). Tages- und Wochenplaner zeigen im Space
  den Space-Fokus, sonst den gemeinsamen. Widgets Fokus und Termine lassen sich auf einen Space begrenzen; Termine
  tragen den Space ihres Kalenders.
- **Jarvis kennt den aktiven Space:** jede Nachricht trägt Privat/Business mit; Jarvis antwortet aus dieser Sicht und
  legt Aufgaben im aktiven Space an (Werkzeug `create_task` hat das Feld `space`). Die Jahresseite zeigt im
  Privat-Space keinen Nordstern und nur Gesundheits-Meilensteine, im Business-Space Nordstern und Business-Meilensteine.
  Die Schnellsuche (⌘K) sucht im Privat-Space eure Menschen statt der Kartei.

**Tempo (26.09. abends, Kevin: „die Ladezeit ist extrem langsam“)**
- **Ursache 1 — Bauen auf dem Server:** jede Auslieferung baute das Docker-Image auf dem 1-CPU-Server, 8–12 Minuten
  Volllast, 667 MB im Auslagerungsspeicher; an einem Tag mit sieben Auslieferungen war die App über eine Stunde zäh.
  Jetzt baut GitHub das Bild und schickt es fertig (`docker save | gzip | ssh … bild`); der Server lädt es nur noch.
  `deploy/ausrollen.sh` kennt drei Modi (ziehen · bild · Altweg). Die ERSTE Auslieferung nach diesem Stand baut noch
  einmal auf dem Server (altes Skript), ab der zweiten nicht mehr.
- **Ursache 2 — Indizes bei jedem Seitenwechsel neu gerechnet:** Wachstums-Score, Business-, Privat-, Gesundheits-
  Index, Traktion, Familie, Bauplan rechnen jetzt einmal und merken sich das Ergebnis kurz (`lib/store/memo.ts`,
  1–5 Minuten; jede Schreibung in einen Bestand setzt alles zurück, Schlüssel je Person/Haushalt).
- **Ursache 3 — der Kopf über jeder Seite holte den Score:** der Wachstums-Score steht jetzt als Widget auf Heute
  (oben links, Standard) und groß im Bereich Wachstum; der Kopf ist Malins Bild: Suchfeld im Space, Idee, Heute,
  Inbox, Kalender, rechts der Index des Space (fünf Minuten gemerkt). Widgets holen dieselbe Adresse nur einmal je 20 s.
- Empfehlung an Kevin: Server auf 2 vCPU / 4 GB heben (Hetzner CX32, wenige Euro mehr) — der Arbeiter, Caddy und Next
  teilen sich heute einen Kern.

**Aufteilung Privat/Business greift in den Aufgaben (26.09. abends, Kevin: „im Business wie privat Aufgaben — muss bei
beiden hin“)** — Grundregel (Kevins Entscheidung): jeder Eintrag trägt seinen Space; der Space filtert, Heute und Jarvis
sehen beides.
- **Aufgaben:** der Ort (KD Ventures, Consulting, KEMARIS = Business · Privat = Privat) gibt den Space vor, eine
  Aufgabe kann per Klick abweichen (Detail → Space, „wieder aus dem Ort“). Aufgaben-Seite: Pillen Privat · Business ·
  Alle (aus dem Menü kommt der Space mit, `?space=`); Zähler, Kritisch, Aufwand folgen dem Filter; neue Aufgaben
  landen im gerade gewählten Space. Beide Spaces haben „Aufgaben“ im Menü. Heute-Widget zeigt beide mit Space-Hinweis
  und lässt sich per Einstellung auf einen Space begrenzen.
- Beleg-Aufgaben aus den Haushaltsfinanzen tragen den Space ihrer Einheit (Selbständigkeit/UG = Business, privat =
  Privat); bestehende werden beim nächsten Abgleich nachgezogen.
- **Ziele je Space:** in Monat/Quartal/Jahr Pillen Privat · Business · Alle; jedes Ziel ist Privat, Business oder
  gemeinsam (Klick auf das Etikett wechselt); neue Ziele landen im gewählten Space.
- **Kalender → Space:** in den Kalender-Einstellungen bekommt jeder Kalender Privat oder Business (ohne Eintrag:
  KEMARIS/Arbeit = Business). Der Wochenplaner zeigt im Privat-Space Business-Termine als „belegt“ (gedimmt) und
  umgekehrt — nichts wird doppelt gebucht.
- **Inbox nach Postfach:** unten in der Inbox lassen sich Postfächer (Apple-Konten, Microsoft 365) Privat oder
  Business zuordnen (`/api/state/spaces`); „Inbox privat/Business“ im Menü filtern danach.
- Noch offen: Kontaktbuch privat (eigene Seite), Jarvis kennt den aktiven Space.

**Bauplan-Punkte von Kevin & Malin (26.09., erste Runde: die schnellen Fixes)**
- **Erfassen-Karte ohne Kürzung** (Kevin: „so genau wie möglich beschreiben“): vorher schnitt der Titel bei 160 und die
  Beschreibung bei 800 Zeichen ab — deshalb enden eure fünf Punkte vom 26.09. mitten im Satz. Jetzt: keine praktische
  Grenze (4000 Zeichen je Feld), ein langer Titel wird von selbst geteilt (erster Satz = Titel, Rest → Problem), die
  Felder Problem/Wunsch/Warum/Fertig-wenn sind von Anfang an offen, Enter springt zur Beschreibung, Cmd+Enter speichert.
- **Bildschirmfoto einfügen** (Kevin): Bilder ins Erfassen- oder Karten-Fenster **ziehen** (Vorschaubild nach
  Cmd+Shift+4 oder Datei vom Schreibtisch) → hochgeladen; Cmd+V geht weiter (Cmd+Ctrl+Shift+4 kopiert direkt in die
  Zwischenablage — steht jetzt als Hinweis dabei). Cmd+Shift+3/4 allein legt nur eine Datei auf den Schreibtisch, das
  kann keine Web-App von selbst holen.
- **Masterdatei online abgleichen** (Malin: „Datei nicht lesbar“): Markttraktion → Stammdaten → Import & Export hat
  jetzt „CSV-Datei wählen und abgleichen“ — die Datei wird hochgeladen (UTF-8 oder Excel-Export, bis 12 MB), dann läuft
  derselbe Abgleich wie vom Mac-Schreibtisch. Der Schreibtisch-Weg bleibt als zweiter Knopf (nur am Mac).
- **Mehrfach-Zuordnung** (Kevin: „er kann Kunde, Multiplikator und Partner sein“): Kontakte haben jetzt **Rollen**
  (mehrere zugleich: Partner, Multiplikator, Dienstleister, Investor, Netzwerk, Freund) neben der Lebensphase — in der
  Akte unter Beziehung anklickbar, als Chips in Kartei und Akte, als Filter in Segmenten. Alte Lebensphase
  „Partner/Multiplikator“ zählt weiter als Rolle.
- **Fokus je Priorität und je Person** (Malin: „die Kreise 1–4, dann Kevin/Malin einzeln“): Kompass → Fokus hat oben
  „Wir · Ich · <andere Person>“ — gemeinsamer Fokus, eigener Fokus (nur selbst änderbar), der der anderen Person nur
  lesbar; unter den Horizonten je Satz für die vier obersten Prioritäten. Eigene Ziele/Fokus liegen je Person
  (`ziele-eigen--<person>`), die gemeinsamen bleiben in `ziele`.
- **Menü mit zwei Spaces (Malins Vorschlag, erste Fassung):** links „Privat“ (rosé) und „Business“ (indigo), ein Tipp
  klappt das Untermenü auf — Privat: Finanzen, Ziele & Fokus, Aufgaben, Gesundheit, Familie, Menschen, Inbox privat,
  Kalender privat · Business: Finanzen, Planung, Markttraktion, Mandate, Agenten, Inbox Business, Kalender Business.
  Unten gesondert Jarvis und Brain, darunter System und Konto. Oben: Suchfeld, das im aktiven Space sucht (⌘K), und
  der Index des Space (Privat-/Business-Index) neben dem Wachstums-Score; die sechs Säulen-Ringe stecken im Bereich
  Wachstum. Der Space merkt sich die letzte Wahl; eine Business-Seite schaltet automatisch um. Handy: Leiste unten
  Heute · Privat · Business · Jarvis · System, Privat/Business öffnen ihr Untermenü als Blatt.
  Inbox mit `?space=`: Privat zeigt Apple-Postfächer, Business Microsoft 365 (Trennung nach Adresse folgt).
  Noch offen: Kalender zeigt den anderen Space als „belegt“; eigenes Kontaktbuch für Privat.
- **Wochenplanung je Person** (Kevin: „Malin hat ihre eigene Planung“): der Wochenplaner (Blöcke: Fokus, Reha,
  Routinen, Pausen, eingeplante Aufgaben) liegt jetzt je Person — Kevin behält seinen gewachsenen Plan, Malin bekommt
  ihren eigenen; der Gesundheits-Index und Jarvis' Einplanen nehmen den Plan der jeweiligen Person. Den Plan der
  anderen Person kann man lesen (`?fuer=`), schreiben nur den eigenen. Feste Termine kommen weiter aus den Kalendern.

**Seiten selbst gestalten — Flächen & Widgets (26.09., Kevin: „alle Widgets immer zu bearbeiten, andere hinzufügen;
seine eigene Seite vorne soll man sich selber gestalten — auch wenn wir am Anfang unsere jetzt lassen“)**
- **Heute ist die erste Fläche:** oben rechts „✎ Anpassen“ oder eine Karte länger gedrückt halten → Bearbeiten-Modus.
  Dort: am ⋮⋮ ziehen (Maus und Finger), Breite ⅓ · ½ · ⅔ · volle Breite, ✕ ausblenden, ⚙ Einstellungen je Widget,
  „+ Widget“ aus dem Katalog, „Zurücksetzen“. Jede Person hat ihr eigenes Layout (Kevin und Malin unabhängig);
  der heutige Aufbau bleibt der Startstand, solange niemand etwas ändert.
- **Katalog aus dem Bestand:** Aufgaben (fällig/alle, Anzahl), Termine heute, Nächste 7 Tage (privat + KEMARIS),
  Fokus / Wochenfokus / Monatsfokus, Körper, Routinen & Streak, Essen heute (mit Foto und Rezept-Link, offene
  Einkaufsliste), Business-/Privat-/Gesundheits-Index und Traktions-Score (mit Säulen), Finanzen · privat,
  Jarvis & Inbox, Wer heute dran ist, Familie & Partnerschaft. Widgets zeigen nur, was es für die Person gibt.
- Technik: `lib/flaeche/modell.ts` (rein, getestet), `/api/state/flaeche` je Person, `components/os/flaeche/`
  (Flaeche + Kachel + Widget-Register). Raster mit 6 Spalten und dichtem Packen, am Handy eine Spalte. Weitere
  Karten-Seiten folgen mit demselben Bauteil; die alte Startflächen-Schnittstelle ohne Oberfläche ist entfernt.
- **Weitere Flächen (gleiche Bedienung, je Person):** Gesundheit → Heute und Körper, Ernährung, Zahlen → Business,
  Konto, Wachstum, Familie → Wir zwei / Familie / Rahmen. Feste Karten einer Seite lassen sich ordnen, in der Breite
  ändern und ausblenden (kommen über „+ Widget → Ausgeblendet“ zurück); Katalog-Widgets kann man überall dazunehmen.
- **Dritte Runde Flächen:** Fokus, Journal, Der Weg auf 1 Mio. (OKR), System, Business-Index, Markttraktion → Überblick,
  Zahlen → Head of Finance, Loops, Kalender-Agent. Noch feste Seiten: Wochen-/Tagesplaner, Aufgaben-Board, Inbox,
  Kompass, Säulen-Seiten, Stapel, CRM-Unterseiten, Finanz-Details — folgen häppchenweise.

**Ernährung & Einkauf zu zweit (26.09., Kevin: „Lebensmittel bevorzugt nehmen, meine Bedürfnisse und Malins, was wir
zuhause haben soll benutzt werden, an jedem Gericht das Rezept“)** — Gesundheit → Ernährung
- **Profile je Person:** Bedürfnisse & Regeln, Verträgt nicht, Nie, Gern, Ziel — jeder pflegt sein eigenes (Malin ihres in
  ihrem Konto), beide sehen beide; Gäste/Kinder als eigene Profile, die der Haushalt pflegt und beim Planen anklickt.
- **Stammliste „unsere Lebensmittel“:** Lebensmittel + Hinweis („Haferflocken · Bio, grob“), Kategorie, Standardmenge,
  Stern = bevorzugt. Ein Tipp → auf die Liste. Jarvis nimmt sie zuerst und benennt sie so.
- **Vorrat „was da ist“:** eintragen, was zuhause ist — Jarvis plant damit und lässt es auf der Liste weg; „Eingekauft →
  Vorrat“ schiebt Abgehaktes hinein; „→ Liste“ zum Nachkaufen; Rezepte zeigen je Zutat „im Vorrat / auf der Liste / fehlt“.
- **Rezepte an jedem Gericht:** 📖 am Plan-Feld öffnet Zutaten mit Mengen, Zubereitung in Schritten, Dauer, Portionen,
  für wen; „＋“ lässt Jarvis das Rezept schreiben; „fehlende auf die Liste“ setzt nur, was nicht da ist.
- **Jarvis plant die Woche für alle** (Profile, Grundsätze, bevorzugte Lebensmittel, Vorrat, Hinweis): Plan + Rezepte +
  Liste mit Mengen und Kategorien; „Übernehmen“ ergänzt die Liste (nichts doppelt, nichts aus dem Vorrat).
- **Einkaufsliste wie ein Einkauf:** nach Kategorie (Obst & Gemüse → Frische → Vorrat → Tiefkühl → Getränke →
  Haushalt), Menge, für wen, von wem, Quelle; Eingabe versteht „2x Tomaten“, „500 g Lachs“; **„Warenkorb kopieren“** als
  Text für REWE Lieferservice/Picnic; Lebensmittel-Budget des Monats aus Zahlen → Privat steht dabei.
- **Jarvis per Zuruf:** „setz Tomaten und 500 g Lachs auf die Liste“ (`einkauf_setzen`).
- **Unsere Gerichte (Kevin 26.09.: „ein Bereich, wo wir unsere Gerichte abspeichern“):** die Bibliothek unter der
  Essens-Woche — alle Rezepte (von Jarvis' Wochen und von Hand), Suche über Name/Zutat/Tag, Tag-Chips, ★ Lieblinge;
  ein Klick öffnet das Rezept mit Notiz („Malin ohne Feta“), „in den Plan“ (Tag + Mahlzeit), „fehlende Zutaten auf die
  Liste“, bearbeiten, löschen (mit Rückfrage). **„+ Gericht“** dreifach: von Hand (Zutaten und Schritte je Zeile —
  „200 g Lachs“, „Olivenöl – 2 EL“), ✨ Jarvis schreibt (Name + Wunsch), Rezept einfügen (kopierter Text wird in Form
  gebracht, nichts dazuerfunden). Ein Plan-Feld, das wie ein gespeichertes Gericht heißt, bekommt sein Rezept
  automatisch; leere Plan-Felder bieten „aus euren Gerichten wählen“. Jarvis kennt beim Planen eure Gerichte (Lieblinge
  zuerst) und schreibt für sie kein neues Rezept. Direktlink `?s=ernaehrung&g=<id>` (`WEG.gericht`).
- **Gerichte schlanker + Foto (Kevin 26.09.):** Anlegen ist ein Schritt — Name tippen, Enter, Jarvis schreibt das
  Rezept; „von Hand“ und „Text einfügen“ nur als kleine Zusatzwege (kann Jarvis nicht, geht es mit dem Namen von Hand
  weiter). Je Gericht ein Foto vom Handy (wird vor dem Hochladen auf 1280 px verkleinert, `/api/ernaehrung/bild`,
  Dateien unter `.data/bilder-gerichte`, nur Haushalt) — sichtbar im Rezept, in der Bibliothek und am Plan-Feld.
- Technik: `lib/ernaehrung/modell.ts` (rein, getestet), Änderungen in kleinen Schritten (PATCH) — zu zweit am Handy
  überschreibt niemand den anderen; Zugriff nur Haushalt des Inhabers.

**Sicherheits-Welle 4 (26.09., „extrem sicher — unsere privatesten Themen“)**
- **Zweiter Faktor (Authenticator-App):** unter Konto → „Zweiter Faktor“ einrichten — Schlüssel in Apple
  Passwörter / Google Authenticator / 1Password (am Handy per Link), Sechssteller bestätigen, acht
  Wiederherstellungscodes einmalig sichern. Danach fragt die Anmeldung nach Passwort UND Code; ein Code gilt
  nur einmal, fünf Fehlversuche bremsen. Ausschalten nur mit Passwort. Einrichten meldet alle anderen Geräte ab.
  **Bitte beide einschalten** — das ist der wichtigste Schutz für ein Login im offenen Netz.
- **Sitzungs-Cookie mit `__Host-`** in Produktion (nur HTTPS, nur dieser Host — kein Nachbar unter sslip.io kann
  ein Cookie unterschieben); `SESSION_SECRET` ist auf dem Server Pflicht (503 statt Rückfall); „alle anderen
  Geräte abmelden“ wirkt sofort, nicht erst nach einer Minute.
- **Server:** root-Login per SSH ist aus, Verwaltung als `make` mit `sudo` (`ssh make@… sudo …`), SSH nur für
  `make`, kein Port-Forwarding; Datendateien nicht mehr weltlesbar.
- **Lieferkette:** Docker-Basisbilder und GitHub-Actions per Digest/SHA festgenagelt (Dependabot hält sie
  aktuell), Action nur mit Leserecht.
- **Verschlüsselung im Ruhezustand:** liegt `MAKE_OS_DATEN_SCHLUESSEL` in der Server-`.env`, schreibt MAKE OS
  jede Sammlung in `.data` (und die Tagessicherungen) als AES-256-GCM-Hülle — ein kopierter Datenordner, ein
  Server-Abbild oder eine Sicherung ohne Schlüssel sind wertlos. Ohne passenden Schlüssel bricht das Lesen laut
  ab (nie „leer“). Einmalige Umstellung aller Bestände: `scripts/daten-verschluesselung.mjs --verschluesseln`.
  **Der Schlüssel gehört in Kevins Passwort-Manager** — ohne ihn sind die Daten weg.

- **Whoop-Import online:** auf dem Server gibt es keinen Downloads-Ordner — der Knopf „Aus Downloads einlesen“
  erscheint dort nicht mehr; stattdessen „ZIP oder CSV wählen“ mit Hinweis (am Handy die Datei erst in „Dateien“
  sichern). Die Dateiauswahl funktionierte schon, war aber nicht als der Weg erkennbar.
- **Caddy überschrieb die App-Kopfzeilen:** Content-Security-Policy und X-Frame-Options kommen jetzt nur aus der
  App (je Pfad) — damit gilt online die volle CSP, und der Altbestand `/finanz-dashboard.html` darf wieder im
  eigenen Rahmen laufen (Caddys `frame-ancestors 'none'` hatte ihn im iframe blockiert).

**Business-Modell, Privat-Index, Steuern — „Verbindungen, die nicht enden“ (25.09. abends)**
- **Alles unter Zahlen:** Reiter Privat · Business · Steuern · Gesamt · Head of Finance. Business ist jetzt
  das Cockpit (Business-Index oben, darunter Konten, Fälliges, Grundlage, Belege); `/os/business` und der
  Kopf-Ring „Business“ führen dorthin, alte Links bleiben gültig.
- **Hinter jeder Kachel 2–3 Punkte mit Link:** die überfällige Rechnung (springt hin und hebt sie hervor),
  der Kunde/das Mandat, der Monat, der Planposten (öffnet ihn), der Deal, die Woche im Kalender, die
  gefilterten Buchungen. Ein Test prüft, dass kein Link ins Leere zeigt.
- **Geschäftsmodell:** neue Kennzahlen Break-even-Abstand, Auslastung, effektiver Tagessatz,
  wiederkehrender Umsatz, Kundenwert (LTV), LTV ÷ Gewinnungskosten; Karte „Geschäftsmodell“ (Umsatz je
  Produktlinie/Produkt, je Mandat mit Fixkosten-Deckung). Kernkennzahlen wiegen mehr; KD Ventures
  (Holding) ohne Vertriebs-/Beratungskennzahlen. Monatsabschluss: neues Feld „fakturierte Beratertage“;
  Einstellungen: Kapazität (Beratertage/Monat).
- **Privat-Index** oben unter Privat: Reserve & Liquidität 40 · Ausgaben & Budget 35 · Vermögen & Schulden 25,
  14 Kennzahlen mit Ampeln, Verlauf, eigenen Schwellen; Punkte führen in Buchungen (Monat + Kategorie),
  Budgets, Schulden. Rücklage (Notgroschen) tragt ihr einmal ein. Der Wachstums-Score nimmt ihn als
  private Hälfte der Finanzen.
- **Steuern** (Hinweis, keine Steuerberatung): Fristen je Consulting · KD Ventures · Privat mit Countdown,
  Abhaken und einer Aufgabe 7 Tage vorher; Rücklage & Prognose (USt, ESt-Anteil, KSt/GewSt); Umsatzsteuer
  je Voranmeldungszeitraum mit Vorsteuer; fehlende Belege direkt als „nachgereicht/bezahlt“ markieren;
  Übergabe-Checkliste an den Steuerberater (Monat + Jahr).

Einmalig danach: unter Zahlen → Steuern die Einstellungen prüfen (Rechtsform, Rhythmus, Steuerquote,
Vorauszahlungen laut Bescheid, Rücklage-Konten); unter Privat die Rücklage eintragen; unter Business
Kapazität und im Monatsabschluss die fakturierten Tage.

**Sicherheit, Gesundheits-Index, Traktions-Index, keine toten Stellen (26.09.)**
- **Sicherheit (Audit 26.09., alle kritischen und hohen Funde behoben):** Jarvis-Aufträge, Protokoll und
  Freigabe-Stapel sind je Person getrennt (kein Lesen oder Zurücknehmen fremder Schritte); Worker-Endpunkte
  und der Telegram-Eingang nur mit Dienstschlüssel (Vergleich in konstanter Zeit); die Anmeldung leitet nur
  noch auf eigene Pfade weiter; Jarvis behandelt gelesene Mails und Recherche als fremden Text — danach werden
  schreibende Werkzeuge nur noch vorgeschlagen (Freigabe), `setze_kunde` braucht immer Freigabe; Apple Mail und
  Kontakte nur für den Inhaber, Erinnerungen nur im Haushalt; Whoop-Sync, Fokus, Board, Loop und Tageslauf
  laufen je angemeldeter Person (kein Rückfall auf „kevin“); eine Einladung bindet den Speicher-Namen, der
  Vorname „Malin“ übernimmt nicht Malins Bestände; Beitrags-Links nur https; Aufgaben-Speicher prüft Felder;
  `start.sh` erzeugt das Sitzungsgeheimnis; der eingefrorene Postfach-Schnappschuss (Namen Dritter) ist aus dem
  Code raus, der alte Klickdummy `public/make-os.html` anonymisiert.
- **Gesundheits-Index** (Gesundheit → Index): dieselbe Logik wie Business und Privat — Erholung & Schlaf 40 ·
  Bewegung & Aufbau 30 · Ernährung & Körper 30, 19 Kennzahlen aus Whoop, Journal, Routinen, Wochenplan,
  Kalender, Meilensteinen, Essensplan, Haut-Tagebuch und Streak (Tagebücher nur, wenn geführt); hinter jeder
  die Punkte mit Weg (Morgen-Check, Journal, Routinen, Woche, Ernährung). Die Gesundheits-Säule des
  Wachstums-Scores IST dieser Index; Jarvis kennt `gesundheits_index`; Heute-Karte, Hebel und Meilensteine
  auf Gesundheit hängen daran. Anspannung 1–5 direkt auf Heute.
- **Traktions-Index** (Markttraktion → Überblick): der Traktions-Score auf demselben Kern — Sales 50 ·
  Marketing 40 · Event 10 (geometrisch), Grundlage sichtbar ohne Gewicht; 19 Kennzahlen mit eigenen Schwellen,
  Verlauf, Punkten (Personen → Akte, Deals, Beiträge, Events); dieselbe Zahl im Business-Index.
- **Keine toten Stellen:** Aufgaben aus Kampagnen, Event-Checkliste, Head of Finance und Steuerfristen sind
  verlinkt; Kontostände werden nur noch unter Liquidität gepflegt (Controlling und Finanzplanung zeigen sie mit
  Weg); Controlling nimmt die Ist-Monate aus dem Monatsabschluss (Altbestand nur Rückfall); eine bezahlte
  Rechnung legt ihre Buchung an (Buchungen zeigen „Rechnung ›“, Rechnungen „Buchung ›“ und „Mandat ›“);
  Mandate zeigen ihre Rechnungen und legen sie aus dem Honorar an; gewonnene Deals ohne Mandat werden unter
  Produkte & Mandate angeboten; Deals tragen Produkt und Herkunft (Event/Beitrag); Gesamt-Stufen, Privat-Kacheln
  und Zahlen-Zeilen führen an ihre Quelle; Journal (`/os/journal`) und Tagesritual (`/os/ritual`) sind wieder
  eigene Seiten (die Umleitung hatte sie unerreichbar gemacht), `/os/saeule/health` führt zum Gesundheits-Index;
  „Chance“ heißt überall „Deal“.

**Zweite Welle (26.09., nachmittags)**
- **Passwortwechsel meldet andere Geräte ab:** die Sitzung trägt den Passwort-Stand; wer sein Passwort ändert,
  bleibt auf dem eigenen Gerät drin, alle anderen Zettel sind ab dem nächsten Klick ungültig (Middleware fragt den
  Stand beim Server nach, höchstens einmal je Minute je Konto). Alte Zettel (ohne Stand) gelten nicht mehr.
- **Markttraktion:** die Punkte hinter „Veröffentlichungen“ und „Abmeldequote“ öffnen den Beitrag bzw. die
  Ausgabe direkt (`?a=redaktion&k=…`); die Zeilen im Wochen-Scoreboard öffnen ihre Kennzahl im Traktions-Index;
  Sales → Heute zeigt „Letzte Power Hours“ (Datum, Karten, Gespräche, Gelerntes) — dorthin führen die Punkte.
- **Inbox:** „Delegiert“ legt jetzt eine Aufgabe für die gewählte Person an (An Malin / An Kevin …); „Delegiert
  (extern)“ markiert nur.
- **Familie:** Paar-Gespräch und Dates lassen sich mit einem Klick in den gemeinsamen iCloud-Kalender legen
  (ohne Teilnehmer, keine Einladungs-Mail; MAKE OS merkt sich die Uid — kein Doppel).
- **Aufgaben:** iCloud-Erinnerungen lassen sich als Aufgabe übernehmen („→ Aufgabe“, mit Fälligkeit und Liste im
  Text); übernommene sind markiert. Nach iCloud wird nie zurückgeschrieben.

**Sicherheits-Welle 3 (26.09., „sicher auf Hetzner“ — zwei Audits, Betrieb + Anwendung)**
- **Next.js 15.5.26** statt 14.2 (die 14er-Linie hatte ~20 offene Advisories: Bildoptimierer-RCE, SSRF,
  DoS, Cache-Poisoning). Codemod für `params`/`searchParams`/`cookies()`; alles geprüft.
- **Zugriff je Person, lückenlos:** interne Dienstaufrufe reichen die anfragende Person weiter (Tageslauf,
  Tagesstart, Agenten, Jarvis-Werkzeuge) — Kevins Mac-Postfach ist damit wirklich nur für den Inhaber;
  Tageslauf-Bestand ohne Mail-Details; `person:` im Auftragstext gilt nur für den Takt; Whoop-Sync/-Import,
  OAuth (Whoop/M365), Mail-Entwurf, Agenten-Regler, Postfach-Spiegel, Agentenlog nur Inhaber bzw. Dienstweg;
  Business-Zahlen (Finanzen, Finanzplan, Buchungen, Liquiplan, Grundlage, Controlling) nur für den Haushalt
  des Inhabers (Malin ist drin); Privatnotizen bleiben auch in „Heute ansprechen“, Auskunft und Dubletten
  beim Verfasser; Startfläche/Verlauf je Person.
- **Jarvis gegen eingeschleuste Anweisungen:** alle Kanäle mit Text Dritter (Kontaktnotizen, Bank-
  Verwendungszwecke, Notizen, Gedächtnis, Agentenläufe, Web, Postfach) sind gekapselt — danach nur noch
  Vorschläge statt Ausführung; Termine, Aufgaben, Deals und Läufe stehen im Prompt als Daten mit Regel.
- **Kostenschutz:** höchstens 40 Modellzüge je Person in 10 Minuten (Takt 120), Body-Grenzen (Jarvis 2 MB,
  Beleg 12 MB, Grundlage 4 MB, Zielkunden 2 MB), `heads/eval` und Loop-„jetzt“ nur Inhaber.
- **Sitzungen:** 14 Tage; Abmelden widerruft den Zettel; „Alle anderen Geräte abmelden“ (Konto);
  Anmelde-Protokoll (Konto → „Zuletzt: …“); Passwortwechsel gebremst; Erstkonto: Schlüsselvergleich in
  konstanter Zeit, Bremse, fail-closed bei beschädigter Kontendatei; Drossel traut X-Forwarded-For nur hinter
  Caddy; Sperre je Paar Adresse+E-Mail (kein Aussperren von außen); `secure`-Cookie in Produktion immer.
- **Middleware:** Navigation von fremden Seiten auf `/api/*` wird abgewiesen (kein GET mit Wirkung per Link).
- **Betrieb:** Container ohne Rechte-Zuwachs/Fähigkeiten, Speichergrenzen, Arbeiter nur mit Dienstschlüssel;
  Sicherheits-Kopfzeilen + CSP aus der App; `deploy/ausrollen.sh` als prüfbarer Forced Command; Sicherung
  optional mit `age` (nur Kevin kann entschlüsseln); Dependabot; Klickdummys aus `public/` nach `prototype/`;
  auf dem Server bereits erledigt: Datendateien nicht mehr weltlesbar, SSH ohne Port-Forwarding.

Nach dem Update: alle müssen sich einmal neu anmelden (Sitzungsgeheimnis und neues Sitzungsformat).
`SESSION_SECRET` liegt auf dem Server schon in der `.env` — der Einzeiler unten ist nur Rückfall. Einmalig auf dem Server, falls
`SESSION_SECRET` dort noch fehlt:
`ssh make@2.28.108.162 'grep -q SESSION_SECRET /srv/make-os/app/.env || echo SESSION_SECRET=$(openssl rand -hex 32) >> /srv/make-os/app/.env && cd /srv/make-os/app && docker compose up -d'`
(seit 26.09. mittags: SSH nur noch als `make`, Verwaltung mit `sudo`; root-Login ist aus)
Malin einladen: unter Konto → Einladung im Feld „Vorname“ **Malin** eintragen — dann bekommt sie ihre Bestände.
Offen (bewusst): `public/make-os.html` (Juli-Klickdummy) könnte ganz raus — Kevins Entscheidung.

### Durchsicht der ganzen Software (26.09. spät, nur lokal)

- Prod-Bau geprüft (Port 3011, Testkonto): rund 100 GET-Routen und 70 Seiten — keine 500er, keine React-Laufzeitfehler.
  Alle Routen zusammen 0,9 s, alle Seiten 0,5 s. Die „extrem langsame Ladezeit“ lokal war die Dev-Kompilierung (bis 55 s je Route beim ersten Treffer), nicht die Software.
- Behoben: doppelte Weiterleitungen — die Seiten unter `/os/ernaehrung`, `/os/energie`, `/os/woche`, `/os/planung/fokus` waren toter Code,
  weil `next.config.mjs` gewinnt; `/os/woche` zeigte dadurch auf Gesundheit statt auf den Wochenplaner. Alt-Adressen leben jetzt nur noch in `next.config.mjs`.
  Ernährung/Energie-Verweise (`WEG`) gehen ohne Umweg ans Ziel. Das alte V1-Cockpit (`public/finanz-dashboard.html`) warf in der Jahresübersicht einen Fehler.
  9 Lint-Warnungen (unnötige Neuberechnungen in Tagesplaner, Inbox, Kartei, Firmen, Abhängigkeiten) — Lint, tsc und 771 Tests sauber.
- Offen, braucht Kevins Wort (Löschen): alte englische Seitengruppe `/dashboard`, `/tasks`, `/calendar`, `/wellness`, `/dog`, `/groceries`, `/routines`
  (Juli-Prototyp, 65 Dateien, nirgends verlinkt, per Adresse erreichbar); tote API-Routen ohne Aufrufer (`/api/startflaeche`, `/api/state/dashboard`,
  `/api/state/arbeitsplatz`, `/api/apple-contacts`, `/api/netzwerk/*`, `/api/state/netzwerk`, `/api/eingang`, `/api/crm/umzug`);
  ungenutzte Pakete (`@radix-ui/*`, `class-variance-authority`, `cmdk`).

## Ablauf eines Updates (Checkliste)

1. Auf `entwicklung`: `tsc`, `next lint`, `vitest run` grün; Probe-Build (`MAKE_OS_DIST=.next-pruefbau npx next build`, danach Ordner löschen).
2. Liste oben „Nächstes Update“ vollständig — das ist die Ansage an Kevin & Malin.
3. Zeitpunkt wählen, an dem niemand mitten in der Arbeit ist (Ausrollen ~5 Min., die alte Version läuft solange weiter).
4. Kevin: `git -C ~/Claude/Projects/MakeOS switch main && git -C ~/Claude/Projects/MakeOS merge --ff-only entwicklung && git -C ~/Claude/Projects/MakeOS push && git -C ~/Claude/Projects/MakeOS switch entwicklung`
5. Warten, bis GitHub ausgerollt hat — **nicht** parallel von Hand ausrollen (sonst stoßen zwei Auslieferungen zusammen).
6. Prüfen über **eine** SSH-Verbindung (ControlMaster), keine Schleifen — sonst sperrt der Server die eigene Adresse bis zu 1 h.
7. Einmalige Schritte des Updates erledigen (siehe unten), dann Liste „Online“ nachtragen.

## Einmalige Schritte, die noch offen sind

- **Head of IT scharf schalten (27.09.):**
  1. Server: `openssl rand -hex 32` → als `MAKE_OS_KEY_HOI=` in `/srv/make-os/app/.env` (nach dem nächsten Ausrollen; `docker compose up -d` liest sie neu).
  2. GitHub → Settings → Secrets and variables → Actions: Secret `MAKE_OS_KEY_HOI` (derselbe Wert), Variable `MAKE_OS_ADRESSE` (`https://2-28-108-162.sslip.io`).
  3. Cron für den Lage-Sammler: `deploy/server-einrichten.sh` trägt ihn beim nächsten Lauf ein — oder einmal von Hand als make:
     `( crontab -l; echo '*/5 * * * * bash /srv/make-os/app/deploy/lage-sammeln.sh >> /srv/make-os/lage-sammeln.txt 2>&1 # make-os' ) | crontab -`
  4. Optional Dead-Man-Ping (healthchecks.io, kostenlos): URL in `/srv/make-os/.healthchecks-sicherung` bzw. `.healthchecks-vault` legen.
- ~~iCloud-Kalender verbinden~~ — erledigt 25.09. (Befehl bleibt zum Wechseln des Passworts):
  vorher bei Apple ein app-spezifisches Passwort „MAKE OS“ anlegen (appleid.apple.com → Anmelden & Sicherheit), dann
  `ssh -t make@2.28.108.162 sudo bash /srv/make-os/app/deploy/icloud-verbinden.sh <apple-id>` (fragt dann nur das App-Passwort)
  — Alternative ohne Terminal: eine Eingabe „iCloud verbinden“ unter System (nur Inhaber, verschlüsselt gespeichert), wenn gewünscht.
